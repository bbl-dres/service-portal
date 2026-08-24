// Search — federated results page across all content types (#/search?q=…).
// Structured after the CD (searchResults.vue, search.postcss «SEARCH RESULTS PAGE»):
// a large search field (search--large search--page-result), followed by the
// results header with the count on the left and sorting on the right, then hits.
//
// Use one result stream rather than groups by content type; type is a facet, so
// sorting, filtering, view switching, and pagination work across ALL hits. List
// view is the default (as in the CD), with gallery view available.
//
// SEPARATION: this file builds and renders the INDEX (what is searchable, what
// a hit is called, and where it leads). Search itself — folding, tokenising,
// and scoring — lives in js/search/search-engine.js so it can be tested without a
// browser (scripts/test-search.mjs).
//
// THREE STEPS SIT IN FRONT OF AND ABOVE THE RESULT LIST, each its own module so
// none of them can quietly become part of the retriever:
//
//   js/search/query-resolve.js   turns a question into keywords BEFORE the
//                                engine sees it. German UI: «Wie melde ich eine
//                                defekte Heizung?» finds 0 literally, 20 resolved.
//   js/search/search-sources.js  decides which kinds are searched at all, as a
//                                lasting preference rather than a facet.
//   js/search/answer.js          assembles a simulated, fully cited answer, and
//                                withholds it when the question was not
//                                understood.
//
// The engine itself is untouched: the finding behind all three is that the
// retriever is not weak, it is missing the step in front of it.

import { search as runSearch, fold, prepare as prepareRow } from '../search/search-engine.js';
import { isQuestion, resolve } from '../search/query-resolve.js';
import { build as buildAnswer } from '../search/answer.js';
import * as searchSources from '../search/search-sources.js';
import { answerBlock, sourcesControl, wireSources, restoreSourcesFocus } from '../search/search-ui.js';
import { byKind } from '../search/search-kinds.js';
import { domainLabel as domainLabelShared } from '../domain.js';
import * as links from '../links.js';
import { knowledgeIndex } from '../knowledge-content.js';
import { record as logQuery, summary as logSummary, clear as logClear } from '../search/search-log.js';
import { classifyUrl, newWindowAttrs, safeLinkUrl } from '../security/urls.js';

// Deferred collections for this route. The router calls core.ensure(needs)
// BEFORE render(); without this declaration, an accessor would read the still
// empty list and the view would show «no entries» instead of data
// (docs/code-review.md §3).
//
// `buildings` and `projects` were added during the search overhaul. Previously,
// «Guisanplatz» found only documents ABOUT the property, never the property
// itself. This costs about 76KB, acceptable because other routes load both
// collections anyway and the browser then has them cached.
//
// `dataTables` follows on the same terms (61KB, 2026-08-12): both routes that
// show a table — the metadata catalogue and a dataset's «Datenfelder» tab —
// load it too, so a search leading there hits a warm cache.
// `processes` and `businessObjects` complete the architecture layers (2026-08-13).
// Together ~90KB, and both routes that display them load them anyway, so a search
// leading there lands on a warm cache — the same trade `dataTables` made.
export const needs = ['applications', 'datasets', 'documents', 'news', 'contacts', 'buildings', 'projects',
  'dataTables', 'processes', 'businessObjects'];

// The index folds, tokenises and stems three text fields for every one of
// several hundred rows — and it used to be rebuilt on EVERY render, i.e. on
// each source-checkbox tick and answers toggle (code review 2026-08, F-S3).
// One module cache, invalidated when deferred data arrives, mirrors the
// suggest index's documented pattern (js/search/search-suggest.js).
let INDEX_CACHE = null;
document.addEventListener('core:data-loaded', () => { INDEX_CACHE = null; });
function cachedIndex(core) {
  if (!INDEX_CACHE) INDEX_CACHE = buildIndex(core);
  return INDEX_CACHE;
}

export default async function render(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  const state = C.catalogueState(query, {
    base: '#/search', perPage: 10,
    sortOpts: ['title', 'kind'],
    defaultView: 'list', filters: { kind: null },
  });
  const { q: rawQ, view, sort: sortKey, hash } = state;
  setTitle(rawQ ? `Suche: ${rawQ}` : 'Suche');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Suche' }]);

  // Diagnostic view instead of results (#/search?log=1); see js/search/search-log.js.
  const showLog = query.get('log') === '1';

  const index = cachedIndex(core);
  // The source selection applies BEFORE the search, with the same call every
  // other search path uses. Searching first and discarding afterwards would mean
  // fetching the full set in order to shrink it — and on a real backend this is
  // a WHERE clause, not a post-filter.
  const pool = searchSources.filterRows(index);
  const literalHits = rawQ && !showLog ? runSearch(pool, rawQ) : [];

  // TWO SEPARATE FUNCTIONS, and that is the decision behind these lines:
  //   question resolution → improves the RESULTS
  //   answer building     → produces the BLOCK
  // While both hung off one condition, hiding the answers also emptied the
  // result list, because a literal search finds nothing for a question. Whoever
  // switches the answers off wants no answer — not a broken search.
  const question = !!rawQ && !showLog && isQuestion(rawQ);
  const answer = question ? buildAnswer(rawQ, index) : null;

  // The relevance gate (js/search/answer.js) decides WHETHER the question was
  // understood, not how much is shown afterwards. The two sides need different
  // things: an answer may only rest on strong results, while a LIST offers
  // rather than claims, so related results are useful there. Narrowed to
  // `strong`, «defekte Heizung» shrank from 20 rows to 2 — precision in the
  // wrong place. If nothing is strong the question was not understood, and the
  // list falls back to the literal search.
  const resolved = !!(answer && answer.strong.length);
  const hits = resolved ? answer.hits : literalHits;
  const total = hits.length;

  // Is the source selection to blame? ASKED ONLY when nothing was found, and as
  // a yes/no. In the normal case nothing is counted at all — what is switched
  // off is named beside the field, read from storage rather than computed from
  // the index. On a real database this is a LIMIT 1, not an aggregate. The empty
  // case is also the only moment the answer changes anything: while results are
  // on screen nobody looks for an explanation.
  const activeKinds = searchSources.activeKinds();
  const hiddenElsewhere = !!(rawQ && !showLog && !total && activeKinds
    && runSearch(index.filter((row) => !activeKinds.has(row.kind)), rawQ).length > 0);

  // The log records the state as well. Without it «0 results» and «20 results»
  // would stand next to each other for the same term as a contradiction.
  const sourceRatio = searchSources.ratio();
  if (rawQ && !showLog) {
    logQuery(rawQ, total, `${resolved ? 'aufgelöst' : 'wörtlich'}${sourceRatio ? ` · ${sourceRatio} Quellen` : ''}`);
  }

  // Rows carry the record's IMAGE where one exists (alignment D47) — the CD
  // SearchResultsList passes each item's image into the card--list slot; the
  // thumbnail sits on the right and disappears on phones
  // (`.search-result__link--media` in sections/search.css).
  const resultRow = (r) => {
    const href = safeLinkUrl(r.href);
    const body = `
        <div class="search-result__body">
        <p class="meta-info search-result__meta">
          <span class="meta-info__item">${C.escape(r.type)}</span>
          ${r.meta ? `<span class="meta-info__item">${C.escape(r.meta)}</span>` : ''}
        </p>
        <h3 class="search-result__title">${C.escape(r.title)}${
          r.external ? ' ' + C.icon('External', 'icon--sm') : ''}</h3>
        ${r.desc ? `<p class="search-result__desc">${C.escape(r.desc)}</p>` : ''}
        </div>
        ${r.image ? `<img class="search-result__image" src="${C.escape(r.image)}" alt="" loading="lazy" decoding="async" width="180" height="120">` : ''}`;
    return `<li class="search-result">${href
      ? `<a class="search-result__link plain-link search-result__link--media" href="${C.escape(href)}"${
        r.external ? newWindowAttrs(href, { external: classifyUrl(href) === 'external' }) : ''}>${body}</a>`
      : `<div class="search-result__link plain-link search-result__link--media" aria-disabled="true">${body}</div>`}</li>`;
  };

  // --- State from the shareable hash, as in the three catalogues ---
  const selectedKinds = state.selected.kind;
  // CD presents search results as a LIST first (searchResults.vue → SearchResultsList).
  const SORT_OPTIONS = [
    { value: '', label: 'Relevanz' },
    { value: 'title', label: 'Titel (A–Z)' },
    { value: 'kind', label: 'Inhaltsart' },
  ];
  const SORTS = {
    title: (a, b) => String(a.title).localeCompare(String(b.title), 'de'),
    kind: (a, b) => String(a.kind).localeCompare(String(b.kind), 'de') || b._score - a._score,
  };
  const filtered = hits.filter(r => !selectedKinds.length || selectedKinds.includes(r.kind));
  // With no explicit sort, use the search engine's score; runSearch() already
  // returns relevance order.
  const sorted = sortKey ? filtered.slice().sort(SORTS[sortKey]) : filtered;
  const { visible, totalPages, page } = state.clamp(sorted);

  // Facet options with a hit count per content type, derived from HITS rather
  // than the index so no empty checkboxes appear.
  // Derived from the HITS rather than the index, so no empty checkbox appears.
  // Because `pool` is already filtered, a switched-off kind cannot show up here
  // either — the two controls cannot contradict each other without a special
  // rule saying so. Ordered by js/search/search-kinds.js, the one list the
  // facets, the suggestions and the source panel share.
  const kindCounts = new Map();
  for (const r of hits) kindCounts.set(r.kind, (kindCounts.get(r.kind) || 0) + 1);
  const kindOptions = [...kindCounts.entries()]
    .sort((a, b) => byKind(a[0], b[0]))
    .map(([kind, count]) => ({ value: kind, label: `${kind} (${count})` }));

  const listView = (items) => `<ul class="search-results-list">${items.map(resultRow).join('')}</ul>`;
  const card = (r) => C.card({
    title: r.title, desc: r.desc, href: r.href, titleTag: 'h3',
    badges: [C.badge(r.kind, 'blue')],
    // Gallery cards show the record's image where one exists (alignment D47).
    photo: r.image ? { src: r.image, alt: '' } : undefined,
    footerInfo: C.escape(r.type) + (r.meta ? ` · ${C.escape(r.meta)}` : ''),
    footerAction: C.cardAction(r.external),
  });

  const toolbar = C.catalogueBar({
    // No second search field; the query comes from the large field in the hero.
    showSearch: false, formId: 'sr-form', inputId: 'sr-q', searchLabel: 'Treffer eingrenzen',
    countId: 'sr-count',
    count: `${C.countText({ nom: 'Treffer', dat: 'Treffern' }, total, sorted.length)} für «${C.escape(rawQ)}»`,
    sort: { id: 'sr-sort', value: sortKey, options: SORT_OPTIONS.filter(o => o.value) },
    filterId: 'sr-filter', filterCount: selectedKinds.length,
    panelId: 'sr-filters',
    panel: C.filterGroup({ dim: 'kind', legend: 'Inhaltsart', selected: selectedKinds, options: kindOptions })
      + C.panelReset({ href: hash({ kind: [], page: 1 }) }),
    view, views: [['list', 'Listenansicht', 'List'], ['gallery', 'Galerieansicht', 'Apps']],
  });

  const activePills = C.activeFilters({
    filters: selectedKinds.map(kind => ({ label: kind, href: hash({ kind: selectedKinds.filter(x => x !== kind), page: 1 }) })),
    resetHref: hash({ kind: [], page: 1 }),
  });

  // The answer block stands above the list for EVERY query, not only for
  // questions — its idle state is what makes the trigger condition visible at
  // all, and it keeps the list from jumping by the block's height depending on
  // the input. It disappears only when somebody switches it off.
  const answerHtml = rawQ && !showLog && searchSources.answersAllowed()
    ? answerBlock(answer, total)
    : '';

  const sourcesHint = hiddenElsewhere
    ? C.notificationHtml(`<p><strong class="text--bold">Ihre Quellenauswahl blendet Treffer aus.</strong>
        Ohne ${C.escape(searchSources.offKinds().join(', '))} findet diese Suche nichts —
        mit allen Inhaltsarten gäbe es Treffer.</p>
        <p><button type="button" class="btn btn--outline btn--sm" data-search-sources-all><span
          class="btn__text">Alle Quellen einschalten</span></button></p>`, 'warning')
    : '';

  const body = showLog
    ? logView(C, index.length)
    : !rawQ
      ? `<p class="muted">Geben Sie einen Suchbegriff ein — zum Beispiel «Störung», «Mustervorlage» oder «Guisanplatz». Durchsucht werden ${index.length} Einträge aus Dienstleistungen, Anwendungen, Wissen und Hilfsmitteln, Datensätzen, Dokumenten, News, Liegenschaften und Bauprojekten.</p>`
      : total
        ? `${toolbar}${activePills}${C.catalogueResults({
            visible, count: sorted.length, view, page, totalPages,
            card, listView, unit: 'Treffer',
            gridCls: 'grid grid--responsive-cols-3 catalogue-grid',
            paginationInputId: 'sr-page', paginationLabel: 'Seitennavigation Suchergebnisse',
            paginationHref: (p) => hash({ page: p }),
          })}`
        : `${sourcesHint}${noResults(C, rawQ, pool)}`;

  // Bands through C.pageSection. This was the only page that hand-wrote the
  // section anatomy (B18); output is byte-identical.
  mount.innerHTML = C.pageSection({
    alt: true,
    // Suchfeld und Trefferliste sind EIN Block, nicht zwei Bänder. Die Referenz
    // sagt das über die Klassen: ihr getöntes Band trägt zusätzlich
    // `section--default`, wodurch CD's Paarregel greift und der Ergebnis-
    // Abschnitt bündig anschliesst (gemessen: padding-top 0 statt 80 px).
    // Den Abstand darunter setzt der Ergebniskopf selbst.
    collapseNext: true,
    body: `<h1 tabindex="-1">Suche</h1>
        <form class="search search--large search--page-result" id="search-page-form" role="search">
          <div class="search__group">
            <label class="sr-only" for="search-page-input">Im Portal suchen</label>
            <input id="search-page-input" class="search__field" type="search" name="q"
              placeholder="Suchen…" value="${C.escape(rawQ)}" autocomplete="off">
            <button class="btn btn--bare btn--lg btn--icon-only search__submit" type="submit" aria-label="Suchen">
              ${C.icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span>
            </button>
          </div>
        </form>
        ${showLog ? '' : sourcesControl()}`,
  }) + C.pageSection({
    // No aria-live here: the node is created NEW on every render, and a newly
    // inserted live region does not fire. Announcements use the persistent
    // #live region through C.announce() (Item 3.8).
    body: `<div class="search-results">${answerHtml}${body}</div>`,
  });

  // Announce the hit count; results were previously silent for screen readers.
  if (!showLog) C.announce(rawQ
    ? (answer && answer.state === 'answer'
        ? `KI-Antwort verfügbar, ${answer.sources.length} Quellen. ${total} Treffer für ${rawQ}.`
        : total
          ? `${total} Treffer für ${rawQ}`
          : `Keine Treffer für ${rawQ}.${hiddenElsewhere ? ' Ihre Quellenauswahl blendet Treffer aus.' : ''}`)
    : 'Suchbegriff eingeben');

  const form = mount.querySelector('#search-page-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = mount.querySelector('#search-page-input').value.trim();
    location.hash = v ? `#/search?q=${encodeURIComponent(v)}` : '#/search';
  });

  mount.querySelector('#log-clear')?.addEventListener('click', () => { logClear(); location.reload(); });

  // A changed source selection changes what the page finds, so the page renders
  // again. `render` is idempotent for the same route, and `restoreSourcesFocus`
  // puts the caret back on the control that was just used.
  const redraw = () => { void render(ctx); };
  wireSources(mount, redraw);
  restoreSourcesFocus(mount);
  // The off switch sits ON the block: whoever sees an answer is the only person
  // who can decide whether they want it.
  mount.querySelector('[data-answers-off]')?.addEventListener('click', () => {
    searchSources.toggle(searchSources.ANSWERS);
    redraw();
  });

  // Sorting, facet, view switching, and pagination use the same result-bar
  // wiring as the catalogue pages.
  if (rawQ && total && !showLog) {
    C.wireCatalogue(mount, {
      formId: 'sr-form', inputId: 'sr-q', pageInputId: 'sr-page', page, totalPages, hash,
      sortId: 'sr-sort', filterToggleId: 'sr-filter', panelId: 'sr-filters',
    });
  }
}

/* ================================== INDEX ================================= */
// One row per discoverable item. `extra` is searchable but invisible and holds
// domain vocabulary FROM THE DATA (domain label, prerequisites, keywords,
// responsible office, location). This replaces a hand-maintained synonym table
// that would inevitably become stale (docs/search-review.md B8).
//
// `boost` orders similarly matched text: a startable case outranks a reference
// page, and items the home page marks as frequently used come first. Both are
// small nudges, not ranking dictates.
function buildIndex(core) {
  const t = core.t;
  // `answerText` is the ONE field js/search/answer.js may turn into a cited
  // sentence. It is a separate field rather than a reuse of `desc` because the
  // two answer different questions: `desc` is the line under a result title and
  // is written to be scanned, while this is the sentence a citation stands
  // behind. Where a record has no prose it stays empty, and the record can then
  // appear as a result but never as a source — a source with nothing to say
  // would sit in the list with no citation pointing at it.
  // domainLabel comes from js/domain.js. The local copy was exactly the drift
  // that module was introduced to eliminate (B23).
  const domainLabel = (k) => domainLabelShared(core, k);
  const dataDomainLabel = (k) => (core.dataDomains().find((d) => d.key === k) || {}).label || k || '';
  const contactName = (id) => (core.contacts() || []).find(c => c.contactId === id)?.name || '';
  const rows = [];

  for (const s of core.services()) {
    rows.push({
      kind: 'Dienstleistungen', type: s.type === 'action' ? 'Dienstleistung · Vorgang' : 'Dienstleistung',
      title: s.title, desc: s.short,
      href: links.service(s.serviceId),
      extra: [domainLabel(s.domain), s.description, (s['voraussetzungen'] || []).join(' '),
        contactName(s.contact), s.serviceId.replace(/-/g, ' ')].join(' '),
      answerText: s.description || s.short,
      // What somebody has to know BEFORE starting — the most useful second line
      // a service can offer. Raw field: `voraussetzungen`.
      requires: s['voraussetzungen'] || [],
      // Rank 1 receives +18, rank 8 still +4; any case receives +12.
      boost: (s.type === 'action' ? 12 : 0) + (s.popular ? Math.max(0, 20 - s.popular * 2) : 0),
    });
  }

  for (const a of core.applications()) {
    rows.push({
      kind: 'Anwendungen', type: 'Anwendung', title: a.name, desc: a.description,
      answerText: a.description,
      href: links.application(a.appId),
      extra: [a.group, a.area, (a.entries || []).map(e => e.label).join(' '),
        contactName(a.contact), a.appId.replace(/-/g, ' ')].join(' '),
      image: a.bild && a.bild.src,
    });
  }

  // Knowledge and resources — 113 documents that were entirely undiscoverable
  // before the search overhaul (docs/search-review.md B1). The target is the
  // subject page SECTION, not the file: the document appears there in its domain
  // context, and the prototype has no real file URL anyway.
  for (const k of knowledgeIndex()) {
    rows.push({
      kind: 'Wissen und Hilfsmittel', type: k.sectionTitle ? `Unterlage · ${k.sectionTitle}` : 'Unterlage',
      title: k.title, desc: k.desc, href: k.href, external: k.external,
      meta: k.area, extra: k.extra, answerText: k.desc,
    });
  }

  // `kind` is a facet, not indexed text (search-engine.js prepare()). The two
  // data-layer kinds therefore carry their own category noun in `extra`: someone
  // typing «Daten» is naming the category, and without this the word matched only
  // where it happened to appear in a title. Measured on «daten»: the five data
  // tables sat at ranks 21–41, past the first page of 20.
  const DATASET_CATEGORY = 'Datensatz Datensätze';
  const TABLE_CATEGORY = 'Datentabelle Datentabellen';
  // The same reasoning for the two architecture layers. The word the request
  // came in under is the one nobody's title carries, so both kinds answer to it.
  // German UI term: «Geschäftsarchitektur»
  const ARCHITECTURE_CATEGORY = 'Geschäftsarchitektur Architektur Dokumentation';
  const PROCESS_CATEGORY = `Prozess Prozesse Prozessdokumentation ${ARCHITECTURE_CATEGORY}`;
  const OBJECT_CATEGORY = `Geschäftsobjekt Geschäftsobjekte Fachbegriff ${ARCHITECTURE_CATEGORY}`;

  for (const d of core.datasets()) {
    rows.push({
      kind: 'Datensätze', type: 'Datensatz', title: t(d.title), desc: t(d.description),
      answerText: t(d.description),
      href: links.dataset(d.id),
      extra: [DATASET_CATEGORY, t(d.fullDescription), (d.tags || []).join(' '), t(d.meta && d.meta['thema'])].join(' '),
    });
  }

  // Data tables (2026-08-12). A dataset says WHAT exists; a data table says which
  // fields it actually has — and the field name is exactly what a developer or an
  // analyst types into the search box. Before this the whole physical layer was
  // reachable only by already knowing #/app/metadata-catalog existed.
  //
  // One row per TABLE, not per field: 325 field rows would bury every other kind
  // of result. The field names ride along in `extra` instead, so searching a
  // column («COMP_CODE», «Buchungskreis») finds the table that carries it.
  for (const table of core.dataTables()) {
    rows.push({
      kind: 'Datentabellen', type: table.systemName ? `Datentabelle · ${table.systemName}` : 'Datentabelle',
      title: table.displayName || table.name,
      desc: table.description,
      answerText: table.description,
      href: links.dataTable(table.tableId),
      meta: table.systemName || '',
      extra: [
        TABLE_CATEGORY, table.name, table.schema, table.schemaLabel, table.systemName,
        // Both halves of a field: the technical name and its German description.
        (table.fields || []).map((f) => `${f.name} ${f.description || ''}`).join(' '),
      ].filter(Boolean).join(' '),
    });
  }

  // Business architecture (2026-08-13). Two process names returned ZERO hits
  // before this, and a business-object name found a building and a dataset but
  // never the object itself.
  // German UI term: «Objektübernahme» · «Lösungsvorschläge Anmiete Kauf» · «Areal»
  // The physical layer had been indexed and the two layers above it had not, so
  // the model was reachable only by someone who already knew the two apps
  // existed — which is the whole complaint the directory is meant to answer.
  for (const p of core.processes()) {
    const portalWorkflow = p.branch === 'portal';
    rows.push({
      kind: 'Prozesse', type: portalWorkflow
        ? (p.groupLabel ? `Portal-Ablauf · ${p.groupLabel}` : 'Portal-Ablauf')
        : (p.groupLabel ? `Prozess · ${p.groupLabel}` : 'Prozess'),
      title: p.name, desc: p.description, answerText: p.description,
      href: links.processDocumentation(p.processId, p.branch),
      meta: p.areaLabel || '',
      extra: [
        PROCESS_CATEGORY, p.processId, p.areaLabel, p.groupLabel,
        (p.tags || []).join(' '), (p.systems || []).join(' '),
        // The process number is how it is cited in a document, with and without
        // its dots: «TQ.21.00.00.01» and «TQ 21 00 00 01» both have to find it.
        String(p.processId).replace(/\./g, ' '),
      ].filter(Boolean).join(' '),
    });
  }

  // One row per OBJECT, with its attribute names riding along — the same shape
  // as data tables above, and for the same reason: 85 attribute rows would bury
  // everything else, but an attribute name still has to find its owning object.
  for (const o of core.businessObjects()) {
    rows.push({
      kind: 'Geschäftsobjekte', type: 'Geschäftsobjekt',
      title: o.name, desc: o.definition, answerText: o.definition,
      href: links.businessObject(o.objectId),
      // A business object answers to `dataDomains`, NOT the service domains
      // `domainLabel` resolves — different vocabularies, same word.
      meta: dataDomainLabel(o.domain),
      extra: [
        OBJECT_CATEGORY, o.objectId, dataDomainLabel(o.domain), o.comment,
        (o.attributes || []).map((a) => `${a.name} ${a.definition || ''}`).join(' '),
      ].filter(Boolean).join(' '),
    });
  }

  // Target with `q`: the archive can filter (`?q=`) but was never given the
  // term, so every document hit landed in the unfiltered archive (B6).
  for (const d of core.documents()) {
    const linkedProperties = (d.linkedTo || []).map(id => core.building(id)?.name).filter(Boolean);
    rows.push({
      kind: 'Dokumente', type: 'Dokument',
      title: d.title, desc: [d.type, d.category].filter(Boolean).join(' · '),
      href: links.documentSearch(d.title),
      meta: [d.format, d.year].filter(Boolean).join(' · '),
      extra: [d.type, d.category, d.classification, ...linkedProperties].join(' '),
    });
  }

  for (const n of core.news()) {
    rows.push({
      kind: 'News', type: 'News', title: n.title, desc: n.teaser, meta: n.date,
      answerText: n.teaser,
      href: links.news(n.id), extra: n.body || '',
      // Results carry the record's image where one exists (alignment D47) —
      // the CD SearchResultsList shows thumbnails in both display types.
      image: n.bild && n.bild.src,
    });
  }

  // Properties: index bbl_id without slashes, so both «1080 4840» and
  // «1080/4840/AF» lead to the property.
  for (const b of core.buildings()) {
    rows.push({
      kind: 'Liegenschaften', type: 'Liegenschaft',
      image: (b.images && b.images[0] && b.images[0].src) || undefined,
      title: b.name, desc: [b.street, [b.zip, b.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      // A property has no description text of its own; the one sentence it can
      // support is where it stands, assembled from the fields that carry it.
      answerText: [b.street, [b.zip, b.city].filter(Boolean).join(' ')].filter(Boolean).length
        ? `${b.name} liegt an der Adresse ${[b.street, [b.zip, b.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}.`
        : '',
      href: links.portfolioItem(b.bbl_id),
      meta: b.portfolioCategory,
      extra: [String(b.bbl_id).replace(/\//g, ' '), b.city, b.canton, b.portfolioCategory,
        b.buildingType, b.architect, b.occupants, b.ownership].join(' '),
    });
  }

  // The construction-project app addresses projects through a path segment, not
  // `?id=`, unlike the portfolio where detail view is map state. Location comes
  // directly from the project record: EPPM stores it itself, with no join to the
  // property inventory (js/apps/projects.js).
  for (const p of core.projects()) {
    rows.push({
      kind: 'Bauprojekte', type: 'Bauprojekt', title: p.name, desc: p.teaser || '',
      answerText: p.teaser || '',
      href: links.constructionProject(p.projectId),
      meta: [p.projectNumber, p.status].filter(Boolean).join(' · '),
      extra: [p.projectId, p.projectNumber, p.status, p.siaPhaseLabel, p.subPortfolio,
        p.pm, p.buildingId, p.siteName, p.street, p.city, p.canton].filter(Boolean).join(' '),
    });
  }

  // DELIBERATELY NOT INDEXED: personal cases. This is a personal work
  // list with its own filtering, not portal content. Anyone looking for their
  // case goes there, not to portal search. Including it here would also mix
  // applicants and organisations into a result stream that otherwise contains
  // only published content.

  // prepare() folds title/description/extra ONCE up front. Otherwise every row
  // would be normalised again for every term.
  return rows.map(prepareRow);
}

/* ============================== EMPTY RESULTS ============================= */
// CD pattern (searchResults.vue): repeat the search term, then tips and a contact
// hint. Suggestions add term-by-term retries when the full query returns nothing:
// «vorlage vertrag xyz» finds nothing, while «vorlage» does. This costs less than
// spelling correction and addresses the most common case (one restrictive term
// too many).
function noResults(C, rawQ, index) {
  const words = fold(rawQ).split(/[^a-z0-9]+/).filter(w => w.length >= 3);
  const alt = words.length > 1
    ? words.map(w => ({ w, n: runSearch(index, w).length })).filter(x => x.n)
    : [];
  const altHtml = alt.length
    ? `<h3>Einzelne Begriffe führen weiter</h3><ul class="list--default">${
        alt.map(x => `<li><a href="#/search?q=${encodeURIComponent(x.w)}">${C.escape(x.w)}</a> — ${x.n} Treffer</li>`).join('')}</ul>`
    : '';
  return `
    <div class="search-results__no-results">
      <h2 class="text--xl">Die Suche nach <strong>«${C.escape(rawQ)}»</strong> ergab keine Treffer.</h2>
      ${altHtml}
      <h3>Tipps zur Suche</h3>
      <ul class="list--default">
        <li>Überprüfen Sie die Schreibweise Ihres Suchbegriffs.</li>
        <li>Verwenden Sie einen anderen oder allgemeineren Begriff.</li>
        <li>Verwenden Sie weniger Suchbegriffe — es müssen alle vorkommen.</li>
      </ul>
      ${C.notificationHtml(`<strong>Nicht gefunden, wonach Sie suchen?</strong><br>
        Wenden Sie sich an die zuständige Stelle oder öffnen Sie die
        <a href="#/services">Dienstleistungen</a>.`, 'info')}
    </div>`;
}

/* ================================ SEARCH LOG ============================== */
function logView(C, indexSize) {
  const { rows, total, zero } = logSummary();
  const body = rows.length
    ? C.table({
        caption: 'Suchbegriffe dieses Geräts',
        zebra: true,
        columns: [
          { key: 'q', label: 'Suchbegriff', render: r => `<a href="#/search?q=${encodeURIComponent(r.q)}">${C.escape(r.q)}</a>` },
          // Which search produced the count. Without this column the same term
          // appears twice with different numbers and reads as a contradiction.
          { key: 'mode', label: 'Zustand', render: r => C.escape(r.mode || '—') },
          { key: 'count', label: 'Anfragen', align: 'right', render: r => C.escape(String(r.count)) },
          { key: 'hits', label: 'Treffer', align: 'right', render: r => r.hits === 0 ? C.badge('0 Treffer', 'error') : C.escape(String(r.hits)) },
        ],
        rows,
      })
    : '<p class="muted">Noch keine Suchanfragen auf diesem Gerät protokolliert.</p>';

  return `
    <h2>Suchprotokoll</h2>
    <p class="muted">${total} Anfragen, ${rows.length} verschiedene Kombinationen aus Begriff und Zustand, davon <strong>${zero} ohne Treffer</strong>.
      Index: ${indexSize} Einträge.</p>
    ${C.notificationHtml(`Nur auf diesem Gerät gespeichert (localStorage), ohne Kennung und ohne Übertragung —
      ein Notizblock, kein Tracking. Er beantwortet die Frage, welche Begriffe ins Leere laufen.
      <a href="#/search">Zurück zur Suche</a>`, 'info')}
    ${body}
    <div class="row mt-4"><button class="btn btn--outline btn--sm btn--icon-left" type="button" id="log-clear">${
      C.icon('Trash', 'btn__icon icon--base')}<span class="btn__text">Protokoll löschen</span></button></div>`;
}
