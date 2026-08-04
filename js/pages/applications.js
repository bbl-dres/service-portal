// Anwendungen — Katalog und Landingpage je Anwendung.
//
// Gleiches Muster wie #/services: Suche links, zwei Filter-Dropdowns,
// Ansichtswechsel rechts, aktive Filter als Pills, Galerie/Liste, Pagination.
// Die Seite hat immer denselben Kopf — «Fachanwendungen Bauten» ist kein
// eigener Seitentyp, sondern nur ?area=buildings.
//
// Karten führen auf #/applications/<appId>, nicht direkt in die Anwendung:
// jede Anwendung hat eigene Einstiegspunkte, Zugriffsregeln und Ansprechstellen.


import { APP_AREAS, audienceOptions, audienceLabel, audienceTags } from '../domain.js';

// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
export const needs = ['applications', 'contacts'];
// 12 wie die Geschwister-Kataloge: teilbar durch 2 UND 3 Rasterspalten (B16).
const PER_PAGE = 12;

// Die Bereiche stehen in js/domain.js — dieselbe Liste trägt den Filter hier
// und die Bereichszeile der Landingpage (application.js).
const AREAS = APP_AREAS;

// Zielgruppen-Nachschläge kommen aus js/domain.js, die Liste selbst aus
// data/reference-data.json (`audiences`) — `audience` ist ein Array (B23).

// Sortierung (catbar): leer = Standard (Schlüsselanwendungen zuerst, «Sortieren»-Platzhalter).
// «Bezeichnung (A–Z)» — Kanon: «Titel» nur für Titel-Felder, sonst Bezeichnung (B24).
const SORT_OPTS = [{ value: 'name', label: 'Bezeichnung (A–Z)' }, { value: 'group', label: 'Bereich' }];
const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name, 'de'),
  group: (a, b) => a.group.localeCompare(b.group, 'de') || a.name.localeCompare(b.name, 'de'),
};

export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs } = ctx;
  if (params[0]) {
    // Die Landingpage-Inhalte stehen am Anwendungsdatensatz selbst (siehe
    // application.js), es gibt also keinen nachzuladenden Bestand mehr — nur
    // das Modul selbst wird dynamisch geladen.
    const mod = await import('./application.js');
    if (ctx.stale()) return;   // A2: nach dem await keine überholte Navigation überschreiben
    return mod.default(ctx, params[0]);
  }

  setTitle('Anwendungen');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Anwendungen' },
  ]);

  // Lese-Seite des Katalog-Musters aus EINER Quelle (C.catalogueState, B16) —
  // vorher trug das Quartett je ~35 Zeilen identisches Parsen/Klemmen/Schneiden.
  const st = C.catalogueState(query, {
    base: '#/applications', perPage: PER_PAGE,
    sortOpts: SORT_OPTS.map(o => o.value),
    filters: { area: AREAS.map(b => b.key), audience: audienceOptions(core).map(a => a.value) },
  });
  const { q: rawQ, view, sort: sortKey, hash } = st;
  const q = rawQ.toLowerCase();
  const areas = st.selected.area, audiences = st.selected.audience;

  const all = core.applications();
  const matches = (a) =>
    (!q || (a.name + ' ' + a.description + ' ' + a.group).toLowerCase().includes(q)) &&
    (!areas.length || areas.includes(a.area)) &&
    (!audiences.length || audiences.some(v => (a.audience || []).includes(v)));

  // Standard: Schlüsselanwendungen zuerst; explizite Sortierung überschreibt das.
  const filtered = all.filter(matches);
  const apps = sortKey ? filtered.slice().sort(SORTS[sortKey]) : filtered.slice().sort((a, b) => (b.hero ? 1 : 0) - (a.hero ? 1 : 0));
  const { visible, totalPages, page } = st.clamp(apps);

  // Jede Pill verlinkt auf dieselbe Ansicht ohne diesen einen Wert.
  const active = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hash({ q: '' }) }] : []),
    ...areas.map(x => ({ label: areaLabel(x), href: hash({ area: areas.filter(y => y !== x) }) })),
    ...audiences.map(x => ({ label: audienceLabel(core, x), href: hash({ audience: audiences.filter(y => y !== x) }) })),
  ];
  const filterBar = C.activeFilters({ filters: active, resetHref: '#/applications' });

  const card = (a) => C.card({
    title: a.name,
    desc: a.description,
    href: `#/applications/${encodeURIComponent(a.appId)}`,
    // Die Aufnahmen liegen lokal und frei lizenziert unter
    // assets/images/applications/ (Nachweis in `bild`). Kein Unsplash-Rückfall
    // mehr — wie beim Gebäudebestand bleibt ohne Datei die Farbfläche.
    photo: { src: a.bild && a.bild.src, alt: '' },
    badges: [
      audienceTags(core, C, a.audience),
      ...(a.hero ? [C.badge('Schlüsselanwendung', 'info')] : []),
      ...(a.link && a.link.kind === 'external' ? [C.badge('Externes System', 'gray')] : []),
    ],
    footerInfo: C.escape(a.group), footerAction: C.cardAction(),
  });

  const listView = (rows) => C.table({
    caption: 'Anwendungen',
    zebra: true,
    // Erste Spalte ist der Zeilenlink — wie in allen Katalog-Listenansichten
    // folgt die ganze Zeile ihm per Mausklick (einheitliche Affordanz, tbl-8).
    rowsClickable: true,
    columns: [
      { key: 'name', label: 'Anwendung', render: a =>
        `<a href="#/applications/${encodeURIComponent(a.appId)}">${C.escape(a.name)}</a>
         <br><span class="small muted">${C.escape(a.description)}</span>` },
      { key: 'group', label: 'Bereich', render: a => C.escape(a.group) },
      { key: 'audience', label: 'Zielgruppe', render: a => audienceTags(core, C, a.audience) },
      { key: 'link', label: 'Einstieg', render: a =>
        a.link && a.link.kind === 'external' ? C.badge('Externes System', 'gray') : C.badge('Im Kundenportal', 'blue') },
    ],
    rows,
  });

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Anwendungen',
      lead: 'Alle Anwendungen des BBL an einem Ort — von den Fachanwendungen für Bauten über Logistik bis zu den zentralen Systemen der Bundesverwaltung.',
    })}
    ${C.catalogueBar({
      formId: 'app-search', inputId: 'aq', searchLabel: 'Anwendung suchen', placeholder: 'Anwendung suchen…', q: rawQ,
      countId: 'app-count', count: `<strong>${apps.length}</strong> von ${all.length} Anwendungen${totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : ''}`,
      sort: { id: 'app-sort', value: sortKey, options: SORT_OPTS },
      filterId: 'app-filter', filterLabel: 'Filter', filterCount: areas.length + audiences.length,
      panelId: 'app-filters', panel: `
        ${/* navLabel auch im Filter: der Nav-Klick «Fachanwendungen Bauten»
              erzeugte vorher die Pille «Immobilien & Bau» — zwei Namen für
              denselben Wert in EINEM Klickpfad (D24); `label` bleibt der
              group-Spaltenwert. */''}
        ${C.filterGroup({ dim: 'area', legend: 'Bereich', selected: areas, options: AREAS.map(b => ({ value: b.key, label: b.navLabel })) })}
        ${C.filterGroup({ dim: 'audience', legend: 'Zielgruppe', selected: audiences, options: audienceOptions(core) })}
        ${C.panelReset({ href: hash({ area: [], audience: [] }) })}`,
      view, views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List']],
    })}
    ${filterBar}
    ${C.catalogueResults({
      resetHref: '#/applications',
      visible, count: apps.length, total: all.length, view, page, totalPages, header: false,
      card, listView, unit: 'Anwendungen',
      paginationInputId: 'app-page', paginationLabel: 'Seitennavigation Anwendungen',
      paginationHref: (p) => hash({ page: p }),
      available: core.available('applications'),
    })}
  </div>`;

  C.announceCatalogue({ count: apps.length, total: all.length, unit: 'Anwendungen', page, totalPages, view });

  C.wireCatalogue(mount, {
    formId: 'app-search', inputId: 'aq', pageInputId: 'app-page', page, totalPages, hash,
    sortId: 'app-sort', filterToggleId: 'app-filter', panelId: 'app-filters',
  });
  // Zeilenklick der Listenansicht. Abbau via onUnmount, sonst sammelt der
  // wiederverwendete mount pro Besuch einen weiteren Klick-Horcher an.
  ctx.onUnmount(C.wireTableRows(mount));
}

function areaLabel(key) { const b = AREAS.find(x => x.key === key); return b ? b.navLabel : key; }
