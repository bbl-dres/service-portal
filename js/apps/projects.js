// Bauprojekte / EPPM — map-first Explorer (Karte/Galerie/Liste + räumlicher Baum +
// catbar), dieselben Muster wie das Liegenschaften Inventar (js/apps/portfolio.js).
// Standort, Koordinaten und Titelbild führt das Projekt SELBST (data/projects.json) —
// EPPM und SAP RE-FX sind zwei Führungssysteme, es gibt keinen Join;
// `buildingId` ist nur ein Querverweis ins Liegenschaftsinventar.
//
// SYSTEMGRENZE: SAP RE-FX führt Wirtschaftseinheit, Gebäude, Grundstück und
// Bemessungen sowie die Mietverwaltung (Mietobjekt, Mietvertrag). Bauprojekte
// stehen dort NICHT — Führungssystem ist SAP ePPM. Ein Projekt «liegt» also
// nicht in einem RE-FX-Gebäude; es verweist nur darauf.
// Ein Projekt wird über #/app/projects/<projectId> angesprochen.
import { initEstateMap } from '../buildings-map.js';
import { createMapSlot } from '../map-slot.js';
import { treeHTML, wireTree, restoreTreeSelection, syncTreeCounts, markTree } from '../spatial-tree.js';
import { openGallery, restoreGalleryFromQuery } from '../gallery.js';
import { galleryItemsFrom } from '../hero-mosaic.js';
import { chf } from '../format.js';
import { landName, weOf, projectStatusLabel } from '../domain.js';
import { ANWENDUNGEN } from '../crumbs.js';
import * as links from '../links.js';

// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
// `buildings` wird NICHT mehr gebraucht: mit dem Wegfall des Joins spart die
// Route 66 KB und einen Request.
export const needs = ['projects'];
const pjMap = createMapSlot();   // Besitz/Abbau: js/map-slot.js

const CRUMBS = ANWENDUNGEN;

const PROJECT_STATUS_VARIANT = { geplant: 'info', aktiv: 'warning', sistiert: 'gray', abgeschlossen: 'success', abgebrochen: 'error' };
const AMPEL_VARIANT = { gruen: 'success', gelb: 'warning', rot: 'error' };
const AMPEL_LABEL = { gruen: 'Grün', gelb: 'Gelb', rot: 'Rot' };

// Sortierung der Ergebnisliste (Galerie/Liste; die Karte ist reihenfolgeunabhängig).
const nameCmp = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'de');
const SORTS = {
  name: nameCmp,
  cost: (a, b) => (b.plannedTotalCost || 0) - (a.plannedTotalCost || 0) || nameCmp(a, b),
  status: (a, b) => String(a.status || '').localeCompare(String(b.status || ''), 'de') || nameCmp(a, b),
  sia: (a, b) => String(a.siaPhase || '').localeCompare(String(b.siaPhase || '')) || nameCmp(a, b),
};
const SORT_OPTS = [
  { value: 'name', label: 'Bezeichnung (A–Z)' },
  { value: 'cost', label: 'Investition (grösste zuerst)' },
  { value: 'status', label: 'Status' },
  { value: 'sia', label: 'SIA-Phase' },
];

export default async function render(ctx) {
  ctx.onUnmount(pjMap.free);
  const { params } = ctx;
  if (params[0]) return detail(ctx, params[0]);
  return overview(ctx);
}

// ---- shared badges ------------------------------------------------------
function projectStatusBadge(C, core, status) { return C.badge(projectStatusLabel(core, status), PROJECT_STATUS_VARIANT[status] || 'gray'); }
function ampelBadge(C, prefix, value) { return C.badge(`${prefix}: ${AMPEL_LABEL[value] || value}`, AMPEL_VARIANT[value] || 'gray'); }

// ---- overview (map-first explorer) --------------------------------------
function overview(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  pjMap.free();
  setTitle('Bauprojekte / EPPM');
  setCrumbs([...CRUMBS, { label: 'Bauprojekte / EPPM' }]);

  const projectStatuses = core.ref().projectStatuses || [];
  // KEIN Join mehr ins Liegenschaftsinventar: SAP ePPM (Bauprojekte) und SAP
  // RE-FX (Wirtschaftseinheit, Gebäude, Grundstück, Bemessungen, Mietverwaltung)
  // sind zwei Führungssysteme, und ePPM führt die Adresse seiner Projekt-
  // standorte selbst. `buildingId` bleibt als fachlicher Querverweis erhalten,
  // ist aber keine Bezugsquelle mehr.
  //
  // Der Join war zudem stillschweigend falsch: er zog die Adresse aus einem
  // Gebäude, das bei neun von zehn Projekten nichts mit dem Projekt zu tun
  // hatte — «Campus Guisanplatz» lag damit in Tokio. Erst als die Adresse als
  // Attribut in der Datei stand, war das zu sehen.
  const objects = core.projects().map((p) => ({
    ...p, id: p.projectId,
    region: p.canton || '', we: p.buildingId ? weOf(p.buildingId) : '',
    lon: p.lon, buildingName: p.siteName || p.buildingId,
  }));
  const subPortfolios = [...new Set(objects.map((o) => o.subPortfolio))].filter(Boolean);
  const phases = [...new Set(objects.map((o) => o.siaPhaseLabel))].filter(Boolean);

  // Der GESAMTE Zustand kommt aus der URL, nicht nur `view`: eine kopierte
  // Adresse reproduziert Suche, Filter, Baum-Auswahl, Sortierung und Seite —
  // wie in der Mediathek (js/apps/media-library.js). renderMain() spiegelt den
  // Zustand über C.catalogueHash wieder zurück in den Hash.
  const csv = (k) => (query.get(k) || '').split(',').filter(Boolean);
  const state = {
    // Galerie als Standard — wie im Liegenschaften-Inventar. Die Karte zeigt
    // Punkte ohne Namen und Kennzahlen; für den Einstieg in eine Projektliste
    // sind die Kacheln die informativere Ansicht (und die schnellere: kein
    // WebGL-Kontext beim ersten Aufruf).
    view: ['map', 'gallery', 'list'].includes(query.get('view')) ? query.get('view') : 'gallery',
    sel: {}, focus: null,
    q: query.get('q') || '',
    sort: SORT_OPTS.some((o) => o.value === query.get('sort')) ? query.get('sort') : 'name',
    filters: { status: csv('status'), sia: csv('sia'), sub: csv('sub') },
    page: Math.max(1, parseInt(query.get('page'), 10) || 1),
    perPage: { gallery: 9, list: 25 },
  };
  // Baum-Auswahl (Land/Region/Stadt/WE/Projekt) als eigene Parameter; ein aus
  // der URL gewähltes Projekt fokussiert — wie der Klick aufs Blatt — die Karte.
  for (const k of ['land', 'region', 'city', 'we', 'id']) if (query.get(k)) state.sel[k] = query.get(k);
  if (state.sel.id) state.focus = state.sel.id;

  const inSel = (o) => (!state.sel.id || o.id === state.sel.id)
    && (!state.sel.land || o.land === state.sel.land) && (!state.sel.region || o.region === state.sel.region)
    && (!state.sel.city || o.city === state.sel.city) && (!state.sel.we || o.we === state.sel.we);
  const inFilters = (o) => (!state.filters.status.length || state.filters.status.includes(o.status))
    && (!state.filters.sia.length || state.filters.sia.includes(o.siaPhaseLabel))
    && (!state.filters.sub.length || state.filters.sub.includes(o.subPortfolio));
  const inSearch = (o) => { const q = state.q.trim().toLowerCase(); return !q || `${o.name} ${o.projectNumber} ${o.pm} ${o.buildingName} ${o.city}`.toLowerCase().includes(q); };
  const filtered = () => objects.filter((o) => inSel(o) && inFilters(o) && inSearch(o));

  // --- spatial tree: Land › Region › Stadt › WE › Projekte -----------------
  // Aufbau aus dem geteilten Bauplan (js/spatial-tree.js) — dieselbe Anatomie
  // wie Inventar und Mietende. Die WE-Stufe zeigt den Gebäudenamen des ersten
  // Eintrags und sortiert nach der WE-Nummer; Blätter sind Projekte
  // (Auswahl-Button, kein Detail-Sprung — wie im Liegenschaften Inventar).
  const esc = C.escape;
  const tree = treeHTML(C, objects, {
    levels: [
      { key: 'land', icon: 'Globe', label: (k) => landName(k) },
      { key: 'region', icon: 'Map' },
      { key: 'city', icon: 'MapMarker' },
      { key: 'we', icon: 'Building', idText: (k) => `WE ${k}`,
        label: (k, es) => (es[0] || {}).buildingName || '',
        sort: (a, b) => String(a).localeCompare(String(b)) },
    ],
    leaf: {
      icon: () => 'Briefcase', idText: (o) => o.projectNumber,
      label: (o) => o.name, objId: (o) => o.id,
      sort: (a, b) => String(a.name).localeCompare(String(b.name), 'de'),
    },
  });

  // --- views (renderMain slices + appends CD pagination) -------------------
  // Land und Status liegen als Auflage AUF dem Bild — wie in der Galerie des
  // Liegenschaften-Inventars (`.pf-card__chips`). Vorher standen sie als
  // Pillenzeile zwischen Titel und Beschreibung: drei farbige Abzeichen (Status,
  // Ziele, Risiko) drängten sich vor den Text, und beim Überfliegen des Rasters
  // las man zuerst Ampelfarben statt Projektnamen. Die Ampeln bleiben in der
  // Listenansicht und auf der Detailseite, wo sie mit ihrer Erklärung stehen.
  function pjCard(o) {
    return C.card({
      title: o.name, desc: o.teaser, href: links.bauprojekt(o.id),
      // Projektnummer als Kennzeile unter dem Titel (`idLine`, .pf-card__id) —
      // wie die bbl_id im Inventar; der CD-Fuss trägt links die SIA-Phase und
      // rechts den Pfeil (footerInfo/footerAction wie Inventar und Mietende).
      idLine: o.projectNumber,
      photo: { src: o.photoSrc, color: 'var(--color-secondary-600)', alt: `${o.name} — ${o.buildingName}` },
      chips: [landName(o.land), projectStatusLabel(core, o.status)],
      footerInfo: `SIA ${esc(o.siaPhase)} · ${esc(o.siaPhaseLabel)}`,
      footerAction: C.cardAction(),
    });
  }
  const galleryHTML = (slice) => `<div class="pf-gallery">${slice.map(pjCard).join('')}</div>`;
  // `rowsClickable`: die erste Zelle ist der Zeilen-Link — dieselbe Anatomie wie
  // die Vorgangstabelle (home) und die Geschosstabelle (tenancies), also auch
  // dieselbe Zeigen-und-Klicken-Affordanz. Verdrahtet EINMAL unten über
  // C.wireTableRows auf dem stabilen #pj-main (überlebt jedes Neurendern).
  const listHTML = (slice) => C.table({ zebra: true, caption: 'Bauprojekte', rowsClickable: true, columns: [
    { key: 'projectNumber', label: 'Projektnr.', render: (o) => `<a href="${links.bauprojekt(o.id)}">${esc(o.projectNumber)}</a>` },
    { key: 'name', label: 'Bezeichnung', render: (o) => `${esc(o.name)}<br><span class="small muted">${esc(o.buildingName)}</span>` },
    { key: 'ort', label: 'Ort', render: (o) => `${esc(o.city)}<br><span class="small muted">${esc(landName(o.land))}</span>` },
    { key: 'status', label: 'Status', render: (o) => projectStatusBadge(C, core, o.status) },
    { key: 'sia', label: 'SIA-Phase', render: (o) => `${esc(o.siaPhase)} · ${esc(o.siaPhaseLabel)}` },
    { key: 'plannedTotalCost', label: 'Investition', align: 'right', render: (o) => esc(chf(o.plannedTotalCost)) },
  ], rows: slice });
  async function mountMap(list, focus) {
    const el = mount.querySelector('#pj-map-el'); if (!el) return;
    const points = list.filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lon))
      .map((o) => ({ lat: o.lat, lon: o.lon, label: o.name, bblId: o.id, sub: `${o.projectNumber} · ${o.buildingName}`.trim(), href: links.bauprojekt(o.id) }));
    await pjMap.mount(el, (node) => initEstateMap(node, points, { type: 'FeatureCollection', features: [] }, focus));
  }

  // --- partial render of the main pane ------------------------------------
  const syncTree = () => syncTreeCounts(mount.querySelector(".pf-tree"),
    objects.filter((o) => inSearch(o) && inFilters(o)),
    (o) => [o.land, o.region, o.city, o.we], (o) => o.id);

  function renderMain() {
    syncTree();
    const list = filtered().sort(SORTS[state.sort] || SORTS.name);
    const cnt = mount.querySelector('#pj-count');
    const main = mount.querySelector('#pj-main');
    // Seitenzahl VOR den Zweigen: die Ansage unten braucht sie in jedem Fall,
    // und eine zu grosse Seite (etwa aus einer alten URL) wird sofort geklemmt.
    const pages = state.view === 'map' ? 1 : Math.max(1, Math.ceil(list.length / state.perPage[state.view]));
    if (state.page > pages) state.page = pages;
    pjMap.free();
    if (state.view === 'map') {
      if (cnt) cnt.innerHTML = `<strong>${list.length}</strong> ${list.length === 1 ? 'Projekt' : 'Projekte'}`;
      main.innerHTML = `<div class="pf-map dash-map" id="pj-map-el" role="group" aria-label="Karte der Bauprojekte"></div>`;
      mountMap(list, state.focus);
    } else if (!list.length) {
      if (cnt) cnt.innerHTML = `<strong>0</strong> von ${objects.length} Projekten`;
      // Leerzustand mit Ausweg (Kanon): Hinweis + voller Reset — der Knopf ist
      // unten EINMAL auf dem stabilen #pj-main delegiert, weil er hier bei
      // jedem Neuzeichnen neu entsteht.
      main.innerHTML = C.empty('Keine Projekte gefunden.', {
        hint: 'Passen Sie Ihre Suche oder die Filter an.',
        action: { id: 'pj-empty-reset', label: 'Suche und Filter zurücksetzen' },
      });
    } else {
      const per = state.perPage[state.view];
      const slice = list.slice((state.page - 1) * per, state.page * per);
      if (cnt) cnt.innerHTML = `<strong>${list.length}</strong> von ${objects.length} Projekten${pages > 1 ? ` · Seite ${state.page} von ${pages}` : ''}`;
      // Ohne href-Builder rendert C.pagination echte <button data-page>, die
      // C.wirePagination zusammen mit dem Seitenfeld bindet.
      main.innerHTML = (state.view === 'gallery' ? galleryHTML(slice) : listHTML(slice))
        + C.pagination({ page: state.page, totalPages: pages, inputId: 'pj-page' });
      if (pages > 1) C.wirePagination(mount, 'pj-page', state.page, pages, (t) => { state.page = t; renderMain(); });
    }
    mount.querySelectorAll('.view-switch__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    renderActiveFilters();
    // Screenreader-Rückmeldung nach jedem Ergebnis-Neuaufbau (Suche, Filter,
    // Baum, Seite, Ansicht) — Standard der Katalogseiten (WCAG 4.1.3), wie in
    // Mediathek und Mietverhältnissen. Einheit im Dativ («von … Projekten»).
    C.announceCatalogue({ count: list.length, total: objects.length, unit: 'Projekten',
      page: state.page, totalPages: pages, view: state.view });
    // Zustand VOLLSTÄNDIG in die URL spiegeln (nicht nur `view`): erst mit
    // Suche, Filtern, Baum-Auswahl, Sortierung und Seite reproduziert eine
    // kopierte Adresse die sichtbare Treffermenge. C.catalogueHash hält die
    // Default-Werte heraus; replaceState statt location.hash, damit weder ein
    // Router-Neurender noch ein History-Eintrag pro Tastendruck entsteht.
    try {
      history.replaceState(history.state, '', C.catalogueHash('#/app/projects', {
        q: state.q.trim(), page: state.page, view: state.view,
        sort: state.sort === 'name' ? '' : state.sort,
        status: state.filters.status, sia: state.filters.sia, sub: state.filters.sub,
        ...state.sel,
      }));
    } catch { /* nicht kritisch */ }
  }

  // Active-Filter-Zeile (Suche, Baum-Auswahl, Panel-Filter) — entfernbare Pillen.
  const selPill = () => {
    const s = state.sel;
    if (!Object.keys(s).length) return null;
    const label = s.id ? ((objects.find((o) => o.id === s.id) || {}).name || s.id) : s.we ? `WE ${s.we}` : s.city || s.region || landName(s.land);
    return { label: `Auswahl: ${label}`, remove: 'sel' };
  };
  function renderActiveFilters() {
    const box = mount.querySelector('#pj-activefilters'); if (!box) return;
    const pills = [];
    if (state.q.trim()) pills.push({ label: `Suche: «${state.q.trim()}»`, remove: 'q' });
    const sp = selPill(); if (sp) pills.push(sp);
    state.filters.status.forEach((v) => pills.push({ label: projectStatusLabel(core, v), remove: `status:${v}` }));
    state.filters.sia.forEach((v) => pills.push({ label: v, remove: `sia:${v}` }));
    state.filters.sub.forEach((v) => pills.push({ label: v, remove: `sub:${v}` }));
    box.innerHTML = C.activeFilters({ filters: pills });
  }

  // --- chrome (once) ------------------------------------------------------
  const filterPanel = `
      ${C.filterGroup({ dim: 'status', legend: 'Status', selected: state.filters.status, options: projectStatuses.map((s) => ({ value: s.id, label: s.label })) })}
      ${C.filterGroup({ dim: 'sia', legend: 'SIA-Phase', selected: state.filters.sia, options: phases.map((p) => ({ value: p, label: p })) })}
      ${C.filterGroup({ dim: 'sub', legend: 'Teilportfolio', selected: state.filters.sub, options: subPortfolios.map((s) => ({ value: s, label: s })) })}
      ${C.panelReset({ id: 'pj-freset' })}`;

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({ title: 'Bauprojekte / EPPM', lead: 'Laufende und abgeschlossene Bauprojekte des BBL — Enterprise Portfolio and Project Management. Führungssystem ist SAP ePPM; diese Ansicht ist eine Leseansicht.' })}
    ${C.catalogueBar({
      formId: 'pj-search', inputId: 'pj-q', searchLabel: 'Projekt, Nummer, Projektleitung oder Gebäude suchen',
      placeholder: 'Projekt, Nummer, PL oder Gebäude suchen…', countId: 'pj-count',
      // Aus der URL initialisiert (teilbarer Zustand): Suchfeld und Filterzähler
      // zeigen sonst beim Laden Leere, obwohl die Treffer bereits gefiltert sind.
      q: state.q,
      filterCount: state.filters.status.length + state.filters.sia.length + state.filters.sub.length,
      sort: { id: 'pj-sort', value: state.sort, options: SORT_OPTS },
      filterId: 'pj-filter-btn', filterLabel: 'Filter', panelId: 'pj-filters', panel: filterPanel,
      view: state.view, views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List'], ['map', 'Kartenansicht', 'Map']],
    })}
    <div id="pj-activefilters"></div>
    <div class="pf-layout">
      <aside class="pf-sidebar" aria-label="Projektstruktur">
        <div class="pf-sidebar__head"><h2 class="pf-sidebar__title">Projekte</h2>
          <button type="button" class="btn btn--bare btn--sm btn--icon-left" id="pj-clear" hidden>${C.icon('Cancel', 'btn__icon')}<span class="btn__text">Auswahl zurücksetzen</span></button></div>
        ${tree}
      </aside>
      <div class="pf-main" id="pj-main"></div>
    </div>
  </div>`;

  // --- wiring -------------------------------------------------------------
  // Baum: Klick (auf/zu + Auswahl), Zweiton-Markierung und der «Auswahl
  // zurücksetzen»-Knopf kommen aus dem geteilten Bauplan (js/spatial-tree.js).
  // Ein Blatt liefert `sel.id` mit — das fokussiert wie bisher die Karte.
  const sidebar = mount.querySelector('.pf-sidebar');
  const clearBtn = mount.querySelector('#pj-clear');
  const onTreeSelect = (sel) => { state.sel = sel; state.focus = sel.id || null; state.page = 1; renderMain(); };
  wireTree(sidebar, { onSelect: onTreeSelect, clearBtn });
  // Voller Auswahl-Reset von ausserhalb des Baums (Reset-Pille, Leerzustand):
  // dasselbe wie der Knopf im Baumkopf, nur ohne Klick auf ihn.
  const resetSelection = () => { markTree(sidebar, null); clearBtn.hidden = true; onTreeSelect({}); };

  // Suche (mit Tipp-Verzögerung), Sortierung, Ansichtswechsel, Filterpanel
  // samt Zähler-Badge und Aktiv-Pillen: geteilte Explorer-Verdrahtung
  // (C.wireCatalogueState). 'sel' ist das einzige Pillen-Token ausserhalb von
  // q/Filtern und gehört dem Baum; nach «Alle Filter zurücksetzen» fällt auch
  // die Baum-Auswahl (onReset).
  const qEl = mount.querySelector('#pj-q');
  const cat = C.wireCatalogueState(mount, {
    formId: 'pj-search', inputId: 'pj-q', sortId: 'pj-sort',
    filterToggleId: 'pj-filter-btn', panelId: 'pj-filters', resetId: 'pj-freset',
    activeFiltersId: 'pj-activefilters', state,
    onChange: renderMain,
    onRemove: (tok) => { if (tok === 'sel') resetSelection(); },
    onReset: resetSelection,
  });
  ctx.onUnmount(cat.destroy);

  // Leerzustands-Aktion «Suche und Filter zurücksetzen»: gleicher Umfang wie
  // die Reset-Pille (Suche + Filter + Baum-Auswahl). Delegiert auf dem stabilen
  // #pj-main, weil der Knopf mit jedem Neuzeichnen neu entsteht.
  mount.querySelector('#pj-main').addEventListener('click', (e) => {
    if (!e.target.closest('#pj-empty-reset')) return;
    state.q = ''; qEl.value = '';
    cat.clearFilters();
    resetSelection();
  });
  // Zeilenklick der Listenansicht (C.table `rowsClickable`): delegiert auf dem
  // stabilen #pj-main, deshalb genügt EINE Verdrahtung für alle Neurender.
  C.wireTableRows(mount.querySelector('#pj-main'));

  // Baum-Auswahl aus der URL wiederherstellen (Teil des teilbaren Zustands).
  // Veraltete URL (Auswahl existiert nicht mehr): still verwerfen statt eine
  // unsichtbare Filterung stehen zu lassen.
  if (Object.keys(state.sel).length && !restoreTreeSelection(sidebar, state.sel, { clearBtn })) {
    state.sel = {}; state.focus = null;
  }

  renderMain();
}

// ---- detail -------------------------------------------------------------
function detail(ctx, id) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  pjMap.free();
  const p = core.project(id);
  if (!p) {
    // Titel und Brotkrumen fehlten hier ganz (siehe media-library.js).
    C.renderNotFound(ctx, { thing: 'Dieses Bauprojekt', title: 'Projekt nicht gefunden',
      backHref: '#/app/projects', backLabel: 'Bauprojekte / EPPM',
      crumbs: [...CRUMBS, { label: 'Bauprojekte / EPPM', href: '#/app/projects' }] });
    return;
  }
  setTitle(p.name);
  setCrumbs([...CRUMBS, { label: 'Bauprojekte / EPPM', href: '#/app/projects' }, { label: p.name }]);

  // Standort und Bild kommen aus dem Projektdatensatz selbst (siehe overview()).
  // `buildingId` bleibt nur als Querverweis ins Liegenschaftsinventar — der Link
  // wird gesetzt, ohne den Gebäudebestand zu lesen.
  const ort = [p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  // Bilder samt Nachweis stehen im Projektdatensatz (`media`) — dieselbe Form
  // wie `bilder` am Gebäude, deshalb baut die geteilte Fassung
  // (galleryItemsFrom, js/hero-mosaic.js) die Galerieeinträge: gleiche Angaben
  // inklusive Bildnachweis und historisch-Graustufe wie bei den
  // Geschwister-Detailseiten. Ein Bestand, den niemand liest, verfällt;
  // deshalb hängt am Hero die Vollbildgalerie statt eines toten Feldes.
  const galleryItems = galleryItemsFrom(p.media, { idPrefix: p.projectId, title: p.name, ort: p.city });
  const tabs = [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'kennzahlen', label: 'Kennzahlen' },
    { id: 'risiken', label: 'Risiken & Ziele' },
  ];
  let active = query.get('tab') || 'uebersicht';
  if (!tabs.some(t => t.id === active)) active = 'uebersicht';

  function panelUebersicht() {
    return `<h2 class="detail-section__title">Projektdaten</h2>
    <dl class="kv">
      <dt>Projektnummer</dt><dd>${C.escape(p.projectNumber)}</dd>
      <dt>Standort</dt><dd>${C.escape(p.siteName || '—')}${ort ? `<br><span class="small muted">${C.escape(ort)}</span>` : ''}</dd>
      <dt>Objekt im Inventar</dt><dd>${p.buildingId
        ? `<a href="${links.objekt(p.buildingId)}">${C.escape(p.buildingId)}</a>` : '—'}</dd>
      <dt>Projektleitung</dt><dd>${C.escape(p.pm || '—')}</dd>
      <dt>Teilportfolio</dt><dd>${C.escape(p.subPortfolio || '—')}</dd>
      <dt>SIA-Phase</dt><dd>${C.escape(p.siaPhase)} · ${C.escape(p.siaPhaseLabel)}</dd>
      <dt>BIM-Level</dt><dd>${C.escape(p.bimLevel || '—')}</dd>
      <dt>Start</dt><dd>${C.escape(p.start || '—')}</dd>
      <dt>Ende</dt><dd>${C.escape(p.end || '—')}</dd>
    </dl>
    <p class="mt-6">${C.escape(p.teaser || '')}</p>`;
  }
  function panelKennzahlen() {
    return `<div class="stats">
      <div class="stat"><div class="stat__num">${C.escape(chf(p.plannedTotalCost))}</div><div class="stat__label">Geplante Gesamtkosten</div></div>
      <div class="stat"><div class="stat__num">${C.escape(chf(p.bkp2))}</div><div class="stat__label">BKP 2 — Gebäude</div></div>
    </div>
    <dl class="kv mt-6">
      <dt>Geplante Gesamtkosten</dt><dd>${C.escape(chf(p.plannedTotalCost))}</dd>
      <dt>BKP 2 (Gebäude)</dt><dd>${C.escape(chf(p.bkp2))}</dd>
      <dt>SIA-Phase</dt><dd>${C.escape(p.siaPhase)} · ${C.escape(p.siaPhaseLabel)}</dd>
      <dt>Laufzeit</dt><dd>${C.escape(p.start || '—')} – ${C.escape(p.end || '—')}</dd>
    </dl>`;
  }
  function panelRisiken() {
    const row = (icon, prefix, value, desc) => `
      <div class="box">
        <div class="row gap-sm">${C.icon(icon, 'icon--lg')}<strong>${C.escape(prefix)}</strong> ${ampelBadge(C, prefix === 'Projektziele' ? 'Ziele' : 'Risiko', value)}</div>
        <p class="small muted mt-2">${C.escape(desc)}</p>
      </div>`;
    const zielDesc = {
      gruen: 'Projektziele (Termine, Kosten, Qualität) werden voraussichtlich erreicht.',
      gelb: 'Projektziele unter Beobachtung — einzelne Abweichungen möglich.',
      rot: 'Projektziele gefährdet — Massnahmen erforderlich.',
    }[p.zielAmpel] || 'Keine Bewertung verfügbar.';
    const risikoDesc = {
      gruen: 'Keine wesentlichen Risiken identifiziert.',
      gelb: 'Mittlere Risiken — werden aktiv überwacht.',
      rot: 'Hohe Risiken — eskaliert, Steuerung durch Projektleitung.',
    }[p.risikoAmpel] || 'Keine Bewertung verfügbar.';
    return `<div class="grid grid--responsive-cols-2">
      ${row('CheckmarkCircle', 'Projektziele', p.zielAmpel, zielDesc)}
      ${row('WarningCircle', 'Risiken', p.risikoAmpel, risikoDesc)}
    </div>
    ${C.notification('Ampelbewertung gemäss BBL-Projektreporting (Demo-Daten): <strong>Grün</strong> = im Plan, <strong>Gelb</strong> = unter Beobachtung, <strong>Rot</strong> = kritisch.', 'info')}`;
  }
  const panels = { uebersicht: panelUebersicht, kennzahlen: panelKennzahlen, risiken: panelRisiken };

  // Titelbild: ohne Bilder eine Farbfläche wie bisher, mit Bildern ein Knopf,
  // der die Vollbildgalerie öffnet. BEWUSSTE Abweichung vom heroMosaic der
  // Geschwister-Detailseiten (dokumentierte Einbild-Variante): das Projekt
  // führt EIN Titelbild (`photoSrc`) als Kopfbild — weitere Aufnahmen (`media`,
  // meist keine oder eine) liegen in der Vollbildgalerie hinter dem Knopf, ein
  // Mosaik bestünde hier oft nur aus leeren Nebenkacheln. KEINE Bildlegende
  // mehr (Nutzerentscheid
  // 2026-07-30: Detailseiten prototypweit ohne figcaption) — der Urheber-
  // nachweis der nicht frei lizenzierten BBL-Aufnahmen bleibt in data/media.json
  // erfasst und steht im Metadaten-Panel der Vollbildgalerie, nur nicht mehr
  // als Legende auf der Seite.
  function heroFigure() {
    const bild = C.photo({
      src: p.photoSrc, color: 'var(--color-secondary-600)', alt: `${p.name}${p.siteName ? ' — ' + p.siteName : ''}`, w: 1600,
      // Verhältnis und Radius in CSS (.pj-hero__photo, 16/10 wie Mosaik und
      // Mediathek) statt Inline-Stil: `max-height` UND `aspect-ratio` auf
      // demselben Element rechneten die BREITE zurück — genau der Fehlerfall,
      // vor dem der Mosaik-Kommentar in css/app.css warnt.
      cls: 'pj-hero__photo',
    });
    if (!galleryItems.length) return `<div class="mt-4">${bild}</div>`;
    return `<div class="pj-hero">
      <button type="button" class="pj-hero__btn" data-gallery="0"
        aria-label="Bildergalerie öffnen — ${galleryItems.length} Aufnahme${galleryItems.length === 1 ? '' : 'n'}">${bild}</button>
    </div>`;
  }

  function draw() {
    mount.innerHTML = `
    <div class="container section">
      ${/* Kopf wie im Liegenschaften Inventar: Zurück- und Teilen-Leiste
            (C.detailBar — CD: back-bar + share-bar in EINER Zeile), Titel,
            Fakten als Lead-Zeile. Die frühere Abzeichenreihe (`pill-row` mit
            Status und zwei Ampeln) ist entfallen — das Inventar kennt sie
            nicht, und drei farbige Abzeichen ÜBER dem Titel lasen sich vor dem
            Projektnamen. Der Status steht jetzt als Wort in der Lead-Zeile,
            die beiden Ampeln im Reiter «Risiken & Ziele», wo ihre Erklärung
            danebensteht. */''}
      ${C.detailBar({ backHref: '#/app/projects', backLabel: 'Bauprojekte / EPPM' })}
      <h1 tabindex="-1">${C.escape(p.name)}</h1>
      <p class="lead">${C.escape(p.projectNumber)}${p.siteName ? ' · ' + C.escape(p.siteName) : ''}${
        p.city ? ', ' + C.escape(p.city) : ''} · ${C.escape(projectStatusLabel(core, p.status))}</p>
      ${heroFigure()}
      ${/* Reiterrahmen wie bei den Geschwistern (portfolio/tenancies/
            media-library): `.tabs mt-6` um Leiste UND Panels; `heading:true`
            stellt jedem Panel eine sr-only-<h2> voran — Kennzahlen und Risiken
            hatten sonst keine Stufe zwischen <h1> und Inhalt (WCAG 2.4.10). */''}
      <div class="tabs mt-6">
        ${C.tabBar({ items: tabs, active, idPrefix: 'pj-tab', ariaLabel: 'Projektdetails' })}
        ${C.tabPanels({ items: tabs, active, idPrefix: 'pj-tab', heading: true, render: (t) => panels[t]() })}
      </div>
    </div>`;
    C.wireTabs(mount, {
      syncHash: (tab) => history.replaceState(history.state, '', `#/app/projects/${p.projectId}${tab === 'uebersicht' ? '' : '?tab=' + tab}`),
    });
    // draw() läuft EINMAL je Aufruf — C.wireTabs schaltet die Reiter ohne
    // Neuzeichnen um, der Hero-Knopf wird also genau einmal verdrahtet.
    // Kein eigenes scrollTo/h1-Fokus: Bildlauf und Fokus nach einem
    // Routenwechsel gehören dem Router (Archetyp-Rezept Objekt-Detail).
    mount.querySelector('.pj-hero__btn')?.addEventListener('click', () =>
      openGallery(galleryItems, 0, C, { param: 'bild' }));
    restoreGalleryFromQuery(query, galleryItems, C);
  }
  draw();
}
