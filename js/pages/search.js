// Suche — föderierte Ergebnisseite über alle Inhaltsarten (#/search?q=…).
// Aufbau nach dem CD (searchResults.vue, search.postcss «SEARCH RESULTS PAGE»):
// grosses Suchfeld (search--large search--page-result), darunter der Ergebniskopf
// mit Trefferzahl links und Sortierung rechts, dann die Treffer.
//
// Ein Ergebnisstrom statt Gruppen pro Inhaltsart: die Art ist eine Facette. Damit
// wirken Sortierung, Filter, Ansichtswechsel und Paginierung über ALLE Treffer —
// die frühere Gruppierung zeigte pro Art nur vier und schickte für den Rest in
// den jeweiligen Katalog. CD nutzt dafür Reiter (Webseiten / Dokumente); eine
// Facette skaliert bei sechs Inhaltsarten besser.
// Ansicht: Liste ist der Standard (wie im CD), Galerie ist zuschaltbar.


// Synonyme: die Nutzenden kennen nicht die BBL-Terminologie (Review P1-4).
const SYNONYMS = {
  heizung: 'störung', lüftung: 'störung', kaputt: 'störung', defekt: 'störung',
  plan: 'dokument', grundriss: 'dokument', pläne: 'dokument',
  umzug: 'transport', parkplatz: 'buchung', sitzungszimmer: 'buchung',
  material: 'bestellen', möbel: 'mobiliar',
};

export default async function render(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  const rawQ = (query.get('q') || '').trim();
  setTitle(rawQ ? `Suche: ${rawQ}` : 'Suche');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Suche' }]);

  const q = rawQ.toLowerCase();
  const terms = [...new Set([q, ...q.split(/\s+/).map(t => SYNONYMS[t]).filter(Boolean)])].filter(Boolean);
  const hit = (...parts) => {
    if (!terms.length) return false;
    const hay = parts.filter(Boolean).join(' ').toLowerCase();
    return terms.some(t => hay.includes(t));
  };
  const t = core.t;

  // ---- Gruppen: je Inhaltsart eine Trefferliste + Katalog-Verweis mit q ----
  const groups = rawQ ? [
    {
      label: 'Dienstleistungen', icon: 'Briefcase',
      all: core.services().filter(s => hit(s.title, s.short, s.description)),
      more: `#/services?q=${encodeURIComponent(rawQ)}`,
      row: s => ({ type: 'Dienstleistung', title: s.title, desc: s.short,
        href: `#/services/${encodeURIComponent(s.serviceId)}` }),
    },
    {
      label: 'Anwendungen', icon: 'Apps',
      all: core.applications().filter(a => hit(a.name, a.description, a.group)),
      more: `#/applications?q=${encodeURIComponent(rawQ)}`,
      row: a => ({ type: 'Anwendung', title: a.name, desc: a.description,
        href: `#/applications/${encodeURIComponent(a.appId)}` }),
    },
    {
      label: 'Datensätze', icon: 'FileDatabase',
      all: core.datasets().filter(d => hit(t(d.title), t(d.description), t(d.fullDescription), (d.tags || []).join(' '))),
      more: `#/data/katalog?q=${encodeURIComponent(rawQ)}`,
      row: d => ({ type: 'Datensatz', title: t(d.title), desc: t(d.description),
        href: `#/data/katalog/${encodeURIComponent(d.id)}` }),
    },
    {
      label: 'Dokumente', icon: 'Folder',
      all: core.documents().filter(d => hit(d.title, d.type, d.category)),
      more: '#/app/document-archive',
      row: d => ({ type: 'Dokument', title: d.title, desc: [d.type, d.year].filter(Boolean).join(' · '),
        href: '#/app/document-archive' }),
    },
    {
      label: 'Gesetzliche Grundlagen und Vorgaben', icon: 'Book',
      all: core.weisungen().filter(w => hit(w.title, w.summary, w.code, w.topic)),
      more: '#/knowledge/grundlagen',
      row: w => ({ type: w.type || 'Weisung', title: w.title, desc: w.summary,
        href: `#/knowledge/grundlagen/${encodeURIComponent(w.directiveId)}` }),
    },
    {
      label: 'News', icon: 'Bell',
      all: core.news().filter(n => hit(n.title, n.teaser, n.body)),
      more: '#/knowledge/news',
      row: n => ({ type: 'News', title: n.title, desc: n.teaser, date: n.date,
        href: `#/knowledge/news/${encodeURIComponent(n.id)}` }),
    },
  ].filter(g => g.all.length) : [];

  const total = groups.reduce((s, g) => s + g.all.length, 0);

  const resultRow = (r) => `
    <li class="search-result">
      <a class="search-result__link plain-link" href="${r.href}">
        <p class="meta-info search-result__meta">
          <span class="meta-info__item">${C.escape(r.type)}</span>
          ${r.date ? `<span class="meta-info__item">${C.escape(r.date)}</span>` : ''}
        </p>
        <h3 class="search-result__title">${C.escape(r.title)}</h3>
        ${r.desc ? `<p class="search-result__desc">${C.escape(r.desc)}</p>` : ''}
      </a>
    </li>`;

  // Ergebnisse in EINE Liste zusammenführen: die Inhaltsart wird zur Facette statt
  // zu einer festen Gruppe mit «Alle N ansehen»-Deckel. Damit greifen Sortierung,
  // Facettenfilter, Ansichtswechsel und Paginierung über alle Treffer hinweg —
  // vorher waren pro Art nur vier Treffer erreichbar (PER_GROUP).
  // Die Reihenfolge der Gruppen ist die Relevanzordnung (Dienstleistungen zuerst).
  const flat = groups.flatMap((g, gi) => g.all.map((item, ii) => {
    const r = g.row(item);
    return { ...r, art: g.label, icon: g.icon, more: g.more, rank: gi * 1000 + ii };
  }));

  // --- Zustand aus dem Hash (teilbar), wie beim Katalog-Trio ---
  const selectedArt = (query.get('art') || '').split(',').map(s => s.trim()).filter(Boolean);
  // CD zeigt Suchergebnisse zuerst als LISTE (searchResults.vue → SearchResultsList).
  const view = query.get('view') === 'galerie' ? 'galerie' : 'liste';
  const SORT_OPTS = [
    { value: '', label: 'Relevanz' },
    { value: 'title', label: 'Titel (A–Z)' },
    { value: 'art', label: 'Inhaltsart' },
  ];
  const SORTS = {
    title: (a, b) => String(a.title).localeCompare(String(b.title), 'de'),
    art: (a, b) => String(a.art).localeCompare(String(b.art), 'de') || a.rank - b.rank,
  };
  const sortKey = SORT_OPTS.some(o => o.value && o.value === query.get('sort')) ? query.get('sort') : '';
  const currentPage = Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1);
  const perPage = 10;

  const filtered = flat.filter(r => !selectedArt.length || selectedArt.includes(r.art));
  const sorted = sortKey ? filtered.slice().sort(SORTS[sortKey]) : filtered.slice().sort((a, b) => a.rank - b.rank);
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const page = Math.min(currentPage, totalPages);
  const visible = sorted.slice((page - 1) * perPage, page * perPage);

  const base = { q: rawQ, art: selectedArt, sort: sortKey, view };
  const hash = (patch = {}) => C.catalogueHash('#/search', { ...base, ...patch, defaultView: 'liste' });

  const artOptions = [...new Set(flat.map(r => r.art))].map(a => ({ value: a, label: a }));
  const listView = (items) => `<ul class="search-results-list">${items.map(resultRow).join('')}</ul>`;
  // Galerieansicht: dieselben Treffer als CD-Karten.
  const card = (r) => C.card({
    title: r.title, desc: r.desc, href: r.href, titleTag: 'h3',
    badges: [C.badge(r.art, 'blue')],
    footerInfo: C.escape(r.type) + (r.date ? ` · ${C.escape(r.date)}` : ''),
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
    panel: C.filterGroup({ dim: 'art', legend: 'Inhaltsart', selected: selectedArt, options: artOptions })
      + `<div class="catbar__panel__actions"><a class="btn btn--bare btn--sm" href="${hash({ art: [] })}">${C.icon('Refresh', 'icon--base')}<span class="btn__text">Zurücksetzen</span></a></div>`,
    view, views: [['liste', 'Listenansicht', 'List'], ['galerie', 'Galerieansicht', 'Apps']],
  });

  const activePills = C.activeFilters({
    filters: selectedArt.map(a => ({ label: a, href: hash({ art: selectedArt.filter(x => x !== a) }) })),
    resetHref: hash({ art: [] }),
  });

  const body = !rawQ
    ? `<p class="muted">Geben Sie einen Suchbegriff ein — zum Beispiel «Störung», «Raumbedarf» oder «Bauprojekt».</p>`
    : total
      ? `${toolbar}${activePills}${C.catalogueResults({
          visible, count: sorted.length, total, view, page, totalPages, header: false,
          card, listView, unit: 'Treffer',
          gridCls: 'grid grid--3 catalogue-grid',
          paginationInputId: 'sr-page', paginationLabel: 'Seitennavigation Suchergebnisse',
          paginationHref: (p) => hash({ page: p }),
        })}`
      : noResults(C, rawQ);

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
  C.announce(rawQ
    ? (total ? `${total} Treffer für ${rawQ}` : `Keine Treffer für ${rawQ}`)
    : 'Suchbegriff eingeben');

  const form = mount.querySelector('#search-page-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = mount.querySelector('#search-page-input').value.trim();
    location.hash = v ? `#/search?q=${encodeURIComponent(v)}` : '#/search';
  });

  // Sortierung, Facette, Ansichtswechsel und Paginierung der Ergebnisleiste —
  // dieselbe Verdrahtung wie auf den Katalogseiten.
  if (rawQ && total) {
    C.wireCatalogue(mount, {
      formId: 'sr-form', inputId: 'sr-q', pageInputId: 'sr-page', page, totalPages, hash,
      sortId: 'sr-sort', filterToggleId: 'sr-filter', panelId: 'sr-filters',
    });
  }
}

// CD-Muster (searchResults.vue): Suchbegriff wiederholen, Tipps, Kontakthinweis.
function noResults(C, rawQ) {
  return `
    <div class="search-results__no-results">
      <h2 class="text--xl">Die Suche nach <strong>«${C.escape(rawQ)}»</strong> ergab keine Treffer.</h2>
      <h3>Tipps zur Suche</h3>
      <ul class="list--default">
        <li>Überprüfen Sie die Schreibweise Ihres Suchbegriffs.</li>
        <li>Verwenden Sie einen anderen oder allgemeineren Begriff.</li>
        <li>Verwenden Sie weniger Suchbegriffe.</li>
      </ul>
      ${C.notification(`<strong>Nicht gefunden, wonach Sie suchen?</strong><br>
        Wenden Sie sich an die zuständige Stelle oder öffnen Sie die
        <a href="#/services">Dienstleistungen</a>.`, 'info')}
    </div>`;
}
