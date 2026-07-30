// Suche — föderierte Ergebnisseite über alle Inhaltsarten (#/search?q=…).
// Aufbau nach dem CD (searchResults.vue, search.postcss «SEARCH RESULTS PAGE»):
// grosses Suchfeld (search--large search--page-result), darunter der Ergebniskopf
// mit Trefferzahl links und Sortierung rechts, dann die Treffer.
//
// Ein Ergebnisstrom statt Gruppen pro Inhaltsart: die Art ist eine Facette. Damit
// wirken Sortierung, Filter, Ansichtswechsel und Paginierung über ALLE Treffer.
// Ansicht: Liste ist der Standard (wie im CD), Galerie ist zuschaltbar.
//
// TRENNUNG: diese Datei baut den INDEX (was ist durchsuchbar, wie heisst der
// Treffer, wohin führt er) und stellt ihn dar. Das Suchen selbst — falten,
// zerlegen, bewerten — liegt in js/search-engine.js, damit es ohne Browser
// prüfbar ist (scripts/test-search.mjs).

import { search as runSearch, fold, prepare as prepareRow } from '../search-engine.js';
import { knowledgeIndex } from '../knowledge-content.js';
import { record as logQuery, summary as logSummary, clear as logClear } from '../search-log.js';

// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
//
// `buildings` und `projects` kamen mit der Suchüberarbeitung dazu: «Guisanplatz»
// fand vorher nur Dokumente ÜBER das Objekt, nie das Objekt selbst. Das kostet
// rund 76 KB — vertretbar, weil beide Bestände auf anderen Routen ohnehin
// geladen werden und der Browser sie dann im Cache hat.
export const needs = ['applications', 'datasets', 'documents', 'news', 'contacts', 'buildings', 'projects'];

export default async function render(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  const rawQ = (query.get('q') || '').trim();
  setTitle(rawQ ? `Suche: ${rawQ}` : 'Suche');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Suche' }]);

  // Diagnoseansicht statt Ergebnissen (#/search?log=1) — siehe js/search-log.js.
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

  // --- Zustand aus dem Hash (teilbar), wie beim Katalog-Trio ---
  const selectedArt = (query.get('kind') || '').split(',').map(s => s.trim()).filter(Boolean);
  // CD zeigt Suchergebnisse zuerst als LISTE (searchResults.vue → SearchResultsList).
  const view = query.get('view') === 'gallery' ? 'gallery' : 'list';
  const SORT_OPTS = [
    { value: '', label: 'Relevanz' },
    { value: 'title', label: 'Titel (A–Z)' },
    { value: 'kind', label: 'Inhaltsart' },
  ];
  const SORTS = {
    title: (a, b) => String(a.title).localeCompare(String(b.title), 'de'),
    kind: (a, b) => String(a.art).localeCompare(String(b.art), 'de') || b._score - a._score,
  };
  const sortKey = SORT_OPTS.some(o => o.value && o.value === query.get('sort')) ? query.get('sort') : '';
  const currentPage = Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1);
  const perPage = 10;

  const filtered = hits.filter(r => !selectedArt.length || selectedArt.includes(r.art));
  // Ohne Sortierwahl gilt die Bewertung aus der Suchmaschine — die Reihenfolge
  // von runSearch() ist bereits die Relevanzordnung.
  const sorted = sortKey ? filtered.slice().sort(SORTS[sortKey]) : filtered;
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const page = Math.min(currentPage, totalPages);
  const visible = sorted.slice((page - 1) * perPage, page * perPage);

  const base = { q: rawQ, kind: selectedArt, sort: sortKey, view };
  const hash = (patch = {}) => C.catalogueHash('#/search', { ...base, ...patch, defaultView: 'list' });

  // Facettenoptionen mit Trefferzahl je Inhaltsart — aus den TREFFERN, nicht aus
  // dem Index, damit keine leeren Kästchen erscheinen.
  const artCount = new Map();
  for (const r of hits) artCount.set(r.art, (artCount.get(r.art) || 0) + 1);
  const artOptions = [...artCount.entries()].map(([a, n]) => ({ value: a, label: `${a} (${n})` }));

  const listView = (items) => `<ul class="search-results-list">${items.map(resultRow).join('')}</ul>`;
  const card = (r) => C.card({
    title: r.title, desc: r.desc, href: r.href, titleTag: 'h3',
    badges: [C.badge(r.art, 'blue')],
    footerInfo: C.escape(r.type) + (r.meta ? ` · ${C.escape(r.meta)}` : ''),
    footerAction: C.cardAction(r.external),
  });

  const toolbar = C.catalogueBar({
    // Kein zweites Suchfeld: die Anfrage kommt aus dem grossen Feld im Hero.
    showSearch: false, formId: 'sr-form', inputId: 'sr-q', searchLabel: 'Treffer eingrenzen',
    countId: 'sr-count',
    count: `<strong>${sorted.length}</strong> von ${total} Treffern für „${C.escape(rawQ)}“${
      totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : ''}`,
    sort: { id: 'sr-sort', value: sortKey, options: SORT_OPTS.filter(o => o.value) },
    filterId: 'sr-filter', filterCount: selectedArt.length,
    panelId: 'sr-filters',
    panel: C.filterGroup({ dim: 'kind', legend: 'Inhaltsart', selected: selectedArt, options: artOptions })
      + `<div class="catbar__panel__actions"><a class="btn btn--bare btn--sm" href="${hash({ kind: [] })}">${C.icon('Refresh', 'icon--base')}<span class="btn__text">Zurücksetzen</span></a></div>`,
    view, views: [['list', 'Listenansicht', 'List'], ['gallery', 'Galerieansicht', 'Apps']],
  });

  const activePills = C.activeFilters({
    filters: selectedArt.map(a => ({ label: a, href: hash({ kind: selectedArt.filter(x => x !== a) }) })),
    resetHref: hash({ kind: [] }),
  });

  const body = showLog
    ? logView(C, index.length)
    : !rawQ
      ? `<p class="muted">Geben Sie einen Suchbegriff ein — zum Beispiel «Störung», «Mustervorlage» oder «Guisanplatz». Durchsucht werden ${index.length} Einträge aus Dienstleistungen, Anwendungen, Unterlagen, Daten, Dokumenten, News, Liegenschaften und Bauprojekten.</p>`
      : total
        ? `${toolbar}${activePills}${C.catalogueResults({
            visible, count: sorted.length, total, view, page, totalPages, header: false,
            card, listView, unit: 'Treffer',
            gridCls: 'grid grid--3 catalogue-grid',
            paginationInputId: 'sr-page', paginationLabel: 'Seitennavigation Suchergebnisse',
            paginationHref: (p) => hash({ page: p }),
          })}`
        : noResults(C, rawQ, index);

  mount.innerHTML = `
    <section class="section section--default bg--secondary-50">
      <div class="container">
        <h1 tabindex="-1">Suche</h1>
        <form class="search search--large search--page-result" id="search-page-form" role="search">
          <div class="search__group">
            <label class="sr-only" for="search-page-input">Im Portal suchen</label>
            <input id="search-page-input" class="search__field" type="search" name="q"
              placeholder="Suche" value="${C.escape(rawQ)}" autocomplete="off">
            <button class="btn btn--bare btn--lg btn--icon-only search__submit" type="submit" aria-label="Suchen">
              ${C.icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span>
            </button>
          </div>
        </form>
      </div>
    </section>
    <section class="section section--default">
      <div class="container">
        <!-- Kein aria-live hier: der Knoten wird bei jedem Rendern NEU erzeugt,
             und eine frisch eingefügte Live-Region feuert nicht. Die Ansage läuft
             über die persistente Region #live via C.announce() (Item 3.8). -->
        <div class="search-results">${body}</div>
      </div>
    </section>`;

  // Trefferzahl ansagen — bisher war das Ergebnis für Screenreader stumm.
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

  // Sortierung, Facette, Ansichtswechsel und Paginierung der Ergebnisleiste —
  // dieselbe Verdrahtung wie auf den Katalogseiten.
  if (rawQ && total && !showLog) {
    C.wireCatalogue(mount, {
      formId: 'sr-form', inputId: 'sr-q', pageInputId: 'sr-page', page, totalPages, hash,
      sortId: 'sr-sort', filterToggleId: 'sr-filter', panelId: 'sr-filters',
    });
  }
}

/* ================================== INDEX ================================= */
// Eine Zeile je auffindbarem Ding. `extra` ist durchsuchbar, aber unsichtbar —
// dort steht das Fachvokabular AUS DEN DATEN (Domänenlabel, Voraussetzungen,
// Schlagwörter, zuständige Stelle, Ort). Das ersetzt eine handgepflegte
// Synonymtabelle, die unweigerlich veraltet (docs/search-review.md B8).
//
// `boost` ordnet bei ähnlicher Textgüte: ein startbarer Vorgang schlägt eine
// Nachschlageseite, und was die Startseite als häufig gebraucht führt, kommt
// zuerst. Beides sind kleine Ausschläge, keine Rangdiktate.
function buildIndex(core) {
  const t = core.t;
  const domainLabel = (k) => (core.ref().domains || []).find(d => d.key === k)?.label || k;
  const contactName = (id) => (core.contacts() || []).find(c => c.contactId === id)?.name || '';
  const rows = [];

  for (const s of core.services()) {
    rows.push({
      art: 'Dienstleistungen', type: s.type === 'action' ? 'Dienstleistung · Vorgang' : 'Dienstleistung',
      title: s.title, desc: s.short,
      href: `#/services/${encodeURIComponent(s.serviceId)}`,
      extra: [domainLabel(s.domain), s.description, (s.voraussetzungen || []).join(' '),
        contactName(s.contact), s.serviceId.replace(/-/g, ' ')].join(' '),
      // Rang 1 bekommt +18, Rang 8 noch +4; ein Vorgang generell +12.
      boost: (s.type === 'action' ? 12 : 0) + (s.popular ? Math.max(0, 20 - s.popular * 2) : 0),
    });
  }

  for (const a of core.applications()) {
    rows.push({
      art: 'Anwendungen', type: 'Anwendung', title: a.name, desc: a.description,
      href: `#/applications/${encodeURIComponent(a.appId)}`,
      extra: [a.group, a.area, (a.entries || []).map(e => e.label).join(' '),
        contactName(a.contact), a.appId.replace(/-/g, ' ')].join(' '),
    });
  }

  // Wissen und Hilfsmittel — 113 Unterlagen, bis zur Suchüberarbeitung
  // vollständig unauffindbar (docs/search-review.md B1). Ziel ist der ABSCHNITT
  // der Fachgebietsseite, nicht die Datei: die Unterlage steht dort mit ihrem
  // fachlichen Umfeld, und im Prototyp gibt es ohnehin keine echte Datei-URL.
  for (const k of knowledgeIndex()) {
    rows.push({
      art: 'Wissen und Hilfsmittel', type: k.sectionTitle ? `Unterlage · ${k.sectionTitle}` : 'Unterlage',
      title: k.title, desc: k.desc, href: k.href, external: k.external,
      meta: k.area, extra: k.extra,
    });
  }

  for (const d of core.datasets()) {
    rows.push({
      art: 'Datensätze', type: 'Datensatz', title: t(d.title), desc: t(d.description),
      href: `#/data/catalog/${encodeURIComponent(d.id)}`,
      extra: [t(d.fullDescription), (d.tags || []).join(' '), t(d.meta && d.meta.thema)].join(' '),
    });
  }

  // Ziel mit `q`: das Archiv kann filtern (`?q=`), bekam den Begriff aber nie
  // übergeben — jeder Dokumenttreffer landete im ungefilterten Archiv (B6).
  for (const d of core.documents()) {
    const objekt = (d.linkedTo || []).map(id => core.building(id)?.name).filter(Boolean);
    rows.push({
      art: 'Dokumente', type: 'Dokument',
      title: d.title, desc: [d.type, d.category].filter(Boolean).join(' · '),
      href: `#/app/document-archive?q=${encodeURIComponent(d.title)}`,
      meta: [d.format, d.year].filter(Boolean).join(' · '),
      extra: [d.type, d.category, d.classification, ...objekt].join(' '),
    });
  }

  for (const n of core.news()) {
    rows.push({
      art: 'News', type: 'News', title: n.title, desc: n.teaser, meta: n.date,
      href: `#/news/${encodeURIComponent(n.id)}`, extra: n.body || '',
    });
  }

  // Liegenschaften: die bbl_id wird mitindexiert, aber ohne Schrägstriche —
  // «1080 4840» und «1080/4840/AF» führen so beide zum Objekt.
  for (const b of core.buildings()) {
    rows.push({
      art: 'Liegenschaften', type: 'Liegenschaft',
      title: b.name, desc: [b.street, [b.zip, b.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      href: `#/app/portfolio?id=${encodeURIComponent(b.bbl_id)}`,
      meta: b.portfolioCategory,
      extra: [String(b.bbl_id).replace(/\//g, ' '), b.city, b.canton, b.portfolioCategory,
        b.typ, b.architekt, b.nutzer, b.ownership].join(' '),
    });
  }

  // Bauprojekte adressiert die App über ein Pfadsegment, nicht über `?id=` —
  // anders als das Portfolio (dort ist die Detailansicht ein Zustand der Karte).
  // Standort direkt aus dem Projektdatensatz: EPPM führt ihn selbst, es gibt
  // keinen Join ins Liegenschaftsinventar (js/apps/projects.js).
  for (const p of core.projects()) {
    rows.push({
      art: 'Bauprojekte', type: 'Bauprojekt', title: p.name, desc: p.teaser || '',
      href: `#/app/projects/${encodeURIComponent(p.projectId)}`,
      meta: [p.projectNumber, p.status].filter(Boolean).join(' · '),
      extra: [p.projectId, p.projectNumber, p.status, p.siaPhaseLabel, p.subPortfolio,
        p.pm, p.buildingId, p.siteName, p.street, p.city, p.canton].filter(Boolean).join(' '),
    });
  }

  // BEWUSST NICHT INDEXIERT: die eigenen Vorgänge. «Meine Vorgänge» ist eine
  // persönliche Arbeitsliste mit eigener Filterung, kein Portalinhalt — wer
  // seinen Fall sucht, geht dorthin, nicht in die Portalsuche. Sie hier zu
  // führen hätte ausserdem Antragstellende und Organisationen in einen
  // Ergebnisstrom gemischt, der sonst nur veröffentlichte Inhalte zeigt.

  // prepare() faltet Titel/Beschreibung/extra EINMAL vor. Ohne das würde jede
  // Zeile für jeden Begriff neu normalisiert.
  return rows.map(prepareRow);
}

/* ============================== LEERE TREFFER ============================= */
// CD-Muster (searchResults.vue): Suchbegriff wiederholen, Tipps, Kontakthinweis.
// Neu mit Vorschlägen: wenn die ganze Anfrage nichts bringt, wird sie
// begriffsweise wiederholt — «vorlage vertrag xyz» findet nichts, «vorlage»
// aber schon. Das ist billiger als eine Rechtschreibkorrektur und trifft den
// häufigsten Fall (ein zu enger Begriff zu viel).
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

/* ============================== SUCHPROTOKOLL ============================= */
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
    <div class="row mt-4"><button class="btn btn--outline btn--sm" type="button" id="log-clear">${
      C.icon('Trash', 'btn__icon icon--base')}<span class="btn__text">Protokoll löschen</span></button></div>`;
}
