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

import { search as runSearch, fold, prepare as prepareRow } from '../search/search-engine.js';
import { domainLabel as domainLabelShared } from '../domain.js';
import * as links from '../links.js';
import { knowledgeIndex } from '../knowledge-content.js';
import { record as logQuery, summary as logSummary, clear as logClear } from '../search/search-log.js';

// Deferred collections for this route. The router calls core.ensure(needs)
// BEFORE render(); without this declaration, an accessor would read the still
// empty list and the view would show «no entries» instead of data
// (docs/code-review.md §3).
//
// `buildings` and `projects` were added during the search overhaul. Previously,
// «Guisanplatz» found only documents ABOUT the property, never the property
// itself. This costs about 76KB, acceptable because other routes load both
// collections anyway and the browser then has them cached.
export const needs = ['applications', 'datasets', 'documents', 'news', 'contacts', 'buildings', 'projects'];

export default async function render(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  const rawQ = (query.get('q') || '').trim();
  setTitle(rawQ ? `Suche: ${rawQ}` : 'Suche');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Suche' }]);

  // Diagnostic view instead of results (#/search?log=1); see js/search/search-log.js.
  const showLog = query.get('log') === '1';

  const index = buildIndex(core);
  const hits = rawQ && !showLog ? runSearch(index, rawQ) : [];
  const total = hits.length;
  if (rawQ && !showLog) logQuery(rawQ, total);

  const resultRow = (r) => `
    <li class="search-result">
      <a class="search-result__link plain-link" href="${C.escape(r.href)}"${
        r.external ? ' target="_blank" rel="noopener external"' : ''}>
        <p class="meta-info search-result__meta">
          <span class="meta-info__item">${C.escape(r.type)}</span>
          ${r.meta ? `<span class="meta-info__item">${C.escape(r.meta)}</span>` : ''}
        </p>
        <h3 class="search-result__title">${C.escape(r.title)}${
          r.external ? ' ' + C.icon('External', 'icon--sm') : ''}</h3>
        ${r.desc ? `<p class="search-result__desc">${C.escape(r.desc)}</p>` : ''}
      </a>
    </li>`;

  // --- State from the shareable hash, as in the three catalogues ---
  const selectedKinds = (query.get('kind') || '').split(',').map(s => s.trim()).filter(Boolean);
  // CD presents search results as a LIST first (searchResults.vue → SearchResultsList).
  const view = query.get('view') === 'gallery' ? 'gallery' : 'list';
  const SORT_OPTIONS = [
    { value: '', label: 'Relevanz' },
    { value: 'title', label: 'Titel (A–Z)' },
    { value: 'kind', label: 'Inhaltsart' },
  ];
  const SORTS = {
    title: (a, b) => String(a.title).localeCompare(String(b.title), 'de'),
    kind: (a, b) => String(a.kind).localeCompare(String(b.kind), 'de') || b._score - a._score,
  };
  const sortKey = SORT_OPTIONS.some(o => o.value && o.value === query.get('sort')) ? query.get('sort') : '';
  const currentPage = Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1);
  const perPage = 10;

  const filtered = hits.filter(r => !selectedKinds.length || selectedKinds.includes(r.kind));
  // With no explicit sort, use the search engine's score; runSearch() already
  // returns relevance order.
  const sorted = sortKey ? filtered.slice().sort(SORTS[sortKey]) : filtered;
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const page = Math.min(currentPage, totalPages);
  const visible = sorted.slice((page - 1) * perPage, page * perPage);

  const base = { q: rawQ, kind: selectedKinds, sort: sortKey, view };
  const hash = (patch = {}) => C.catalogueHash('#/search', { ...base, ...patch, defaultView: 'list' });

  // Facet options with a hit count per content type, derived from HITS rather
  // than the index so no empty checkboxes appear.
  const kindCounts = new Map();
  for (const r of hits) kindCounts.set(r.kind, (kindCounts.get(r.kind) || 0) + 1);
  const kindOptions = [...kindCounts.entries()].map(([kind, count]) => ({ value: kind, label: `${kind} (${count})` }));

  const listView = (items) => `<ul class="search-results-list">${items.map(resultRow).join('')}</ul>`;
  const card = (r) => C.card({
    title: r.title, desc: r.desc, href: r.href, titleTag: 'h3',
    badges: [C.badge(r.kind, 'blue')],
    footerInfo: C.escape(r.type) + (r.meta ? ` · ${C.escape(r.meta)}` : ''),
    footerAction: C.cardAction(r.external),
  });

  const toolbar = C.catalogueBar({
    // No second search field; the query comes from the large field in the hero.
    showSearch: false, formId: 'sr-form', inputId: 'sr-q', searchLabel: 'Treffer eingrenzen',
    countId: 'sr-count',
    count: `<strong>${sorted.length}</strong> von ${total} Treffern für «${C.escape(rawQ)}»${
      totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : ''}`,
    sort: { id: 'sr-sort', value: sortKey, options: SORT_OPTIONS.filter(o => o.value) },
    filterId: 'sr-filter', filterCount: selectedKinds.length,
    panelId: 'sr-filters',
    panel: C.filterGroup({ dim: 'kind', legend: 'Inhaltsart', selected: selectedKinds, options: kindOptions })
      + C.panelReset({ href: hash({ kind: [] }) }),
    view, views: [['list', 'Listenansicht', 'List'], ['gallery', 'Galerieansicht', 'Apps']],
  });

  const activePills = C.activeFilters({
    filters: selectedKinds.map(kind => ({ label: kind, href: hash({ kind: selectedKinds.filter(x => x !== kind) }) })),
    resetHref: hash({ kind: [] }),
  });

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
        : noResults(C, rawQ, index);

  // Bands through C.pageSection. This was the only page that hand-wrote the
  // section anatomy (B18); output is byte-identical.
  mount.innerHTML = C.pageSection({
    alt: true,
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
        </form>`,
  }) + C.pageSection({
    // No aria-live here: the node is created NEW on every render, and a newly
    // inserted live region does not fire. Announcements use the persistent
    // #live region through C.announce() (Item 3.8).
    body: `<div class="search-results">${body}</div>`,
  });

  // Announce the hit count; results were previously silent for screen readers.
  if (!showLog) C.announce(rawQ
    ? (total ? `${total} Treffer für ${rawQ}` : `Keine Treffer für ${rawQ}`)
    : 'Suchbegriff eingeben');

  const form = mount.querySelector('#search-page-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = mount.querySelector('#search-page-input').value.trim();
    location.hash = v ? `#/search?q=${encodeURIComponent(v)}` : '#/search';
  });

  mount.querySelector('#log-clear')?.addEventListener('click', () => { logClear(); location.reload(); });

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
  // domainLabel comes from js/domain.js. The local copy was exactly the drift
  // that module was introduced to eliminate (B23).
  const domainLabel = (k) => domainLabelShared(core, k);
  const contactName = (id) => (core.contacts() || []).find(c => c.contactId === id)?.name || '';
  const rows = [];

  for (const s of core.services()) {
    rows.push({
      kind: 'Dienstleistungen', type: s.type === 'action' ? 'Dienstleistung · Vorgang' : 'Dienstleistung',
      title: s.title, desc: s.short,
      href: links.service(s.serviceId),
      extra: [domainLabel(s.domain), s.description, (s['voraussetzungen'] || []).join(' '),
        contactName(s.contact), s.serviceId.replace(/-/g, ' ')].join(' '),
      // Rank 1 receives +18, rank 8 still +4; any case receives +12.
      boost: (s.type === 'action' ? 12 : 0) + (s.popular ? Math.max(0, 20 - s.popular * 2) : 0),
    });
  }

  for (const a of core.applications()) {
    rows.push({
      kind: 'Anwendungen', type: 'Anwendung', title: a.name, desc: a.description,
      href: links.application(a.appId),
      extra: [a.group, a.area, (a.entries || []).map(e => e.label).join(' '),
        contactName(a.contact), a.appId.replace(/-/g, ' ')].join(' '),
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
      meta: k.area, extra: k.extra,
    });
  }

  for (const d of core.datasets()) {
    rows.push({
      kind: 'Datensätze', type: 'Datensatz', title: t(d.title), desc: t(d.description),
      href: links.dataset(d.id),
      extra: [t(d.fullDescription), (d.tags || []).join(' '), t(d.meta && d.meta['thema'])].join(' '),
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
      href: links.news(n.id), extra: n.body || '',
    });
  }

  // Properties: index bbl_id without slashes, so both «1080 4840» and
  // «1080/4840/AF» lead to the property.
  for (const b of core.buildings()) {
    rows.push({
      kind: 'Liegenschaften', type: 'Liegenschaft',
      title: b.name, desc: [b.street, [b.zip, b.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
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
      ${C.notification(`<strong>Nicht gefunden, wonach Sie suchen?</strong><br>
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
          { key: 'count', label: 'Anfragen', render: r => String(r.count) },
          { key: 'hits', label: 'Treffer', render: r => r.hits === 0 ? C.badge('0 Treffer', 'error') : String(r.hits) },
        ],
        rows,
      })
    : '<p class="muted">Noch keine Suchanfragen auf diesem Gerät protokolliert.</p>';

  return `
    <h2>Suchprotokoll</h2>
    <p class="muted">${total} Anfragen, ${rows.length} verschiedene Begriffe, davon <strong>${zero} ohne Treffer</strong>.
      Index: ${indexSize} Einträge.</p>
    ${C.notification(`Nur auf diesem Gerät gespeichert (localStorage), ohne Kennung und ohne Übertragung —
      ein Notizblock, kein Tracking. Er beantwortet die Frage, welche Begriffe ins Leere laufen.
      <a href="#/search">Zurück zur Suche</a>`, 'info')}
    ${body}
    <div class="row mt-4"><button class="btn btn--outline btn--sm btn--icon-left" type="button" id="log-clear">${
      C.icon('Trash', 'btn__icon icon--base')}<span class="btn__text">Protokoll löschen</span></button></div>`;
}
