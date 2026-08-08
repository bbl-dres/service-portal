// Mietende (Portal) — die Sicht der Verwaltungseinheit auf ihre gemieteten
// Flächen. Gegenstück zum Liegenschaften Inventar (js/apps/portfolio.js), aber
// mit umgedrehter Perspektive:
//
//   Inventar        zeigt OBJEKTE, die der Bund besitzt oder bewirtschaftet.
//   Mietendenportal zeigt FLÄCHEN, die meine Verwaltungseinheit gemietet hat.
//
// Deshalb ist die Einheit das MIETVERHÄLTNIS und nicht das Gebäude: gemietet
// wird selten ein ganzes Haus, sondern ein Geschoss oder ein Geschossteil, und
// ein Gebäude trägt oft mehrere Mietverhältnisse verschiedener VE. Im Bestand
// ist das Liebefeld doppelt belegt (BAFU und BLV) — genau der Regelfall.
//
// KEIN JOIN: Standort, Bild und Ansprechstellen stehen im Mietverhältnis selbst
// (data/tenancies.json), so wie EPPM seine Projektstandorte selbst führt.
// `buildingId` ist ein Querverweis ins Inventar, kein Nachschlageschlüssel.

import { floorplanSvg, floorplanLegend, wireFloorplan, COLOR_MODES } from '../floorplan.js';
import { initEstateMap } from '../buildings-map.js';
import { createMapSlot } from '../map-slot.js';
import { treeHTML, wireTree, restoreTreeSelection, syncTreeCounts, markTree } from '../spatial-tree.js';
import { heroMosaic, galleryItemsFrom, wireHeroMosaic } from '../hero-mosaic.js';
import { openGallery, restoreGalleryFromQuery } from '../gallery.js';
import { num, chf, m2, datum } from '../format.js';
import { landName, statusLabel } from '../domain.js';
import { ANWENDUNGEN } from '../crumbs.js';
import * as links from '../links.js';

export const needs = ['tenancies', 'floors', 'spaces', 'contracts'];

const CRUMBS = ANWENDUNGEN;
// Restlaufzeit in Monaten — die Zahl, auf die Mietende zuerst schauen.
const monateBis = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return Math.max(0, Math.round((d - new Date()) / (30.44 * 86400000)));
};
// Restlaufzeit als Abzeichen. Abgestuft (Warnung ≤ 12 Monate, Hinweis ≤ 36,
// sonst Erfolg) trägt es Information statt Dringlichkeit — ein einfarbiges
// Warnabzeichen hätte jedes Mietverhältnis alarmiert. EINE Fassung für
// Übersichtsliste UND Detailkopf (Design-Review B21): die beiden wortgleichen
// Kopien wären bei der nächsten Schwellen-Änderung stumm auseinandergelaufen,
// und Liste und Detail müssen dieselbe Aussage machen.
const restBadge = (C, iso) => {
  const m = monateBis(iso);
  if (m == null) return '';
  return C.badge(m < 24 ? `noch ${m} Monate` : `noch ${Math.floor(m / 12)} Jahre`,
    m <= 12 ? 'warning' : m <= 36 ? 'info' : 'success');
};

export default async function render(ctx) {
  const { params } = ctx;
  if (params[0]) return detail(ctx, params[0]);
  return overview(ctx);
}

/* ================================ ÜBERSICHT =============================== */
// Aufbau wie das Liegenschaften Inventar (js/apps/portfolio.js): links der
// räumliche Baum, rechts Katalogleiste und Ergebnisse in Galerie, Liste oder
// Karte. Der Zustand liegt in `state` und wird nur teilweise neu gezeichnet —
// ein voller Neuaufbau würde bei jedem Baumklick die Karte verwerfen und neu
// aufbauen (WebGL-Kontext), und der Fokus spränge zur Überschrift zurück.
const mtMap = createMapSlot();   // Besitz/Abbau: js/map-slot.js

function overview(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs, onUnmount } = ctx;
  mtMap.free();
  onUnmount(mtMap.free);
  setTitle('Mietende');
  setCrumbs([...CRUMBS, { label: 'Mietende' }]);

  const all = core.tenancies();
  const esc = C.escape;   // koerziert selbst (null → '') — kein eigener Wrapper nötig

  const SORTS = {
    name: (a, b) => a.buildingName.localeCompare(b.buildingName, 'de'),
    area: (a, b) => b.areaHnf - a.areaHnf,
    // Restlaufzeit aufsteigend: das Mietverhältnis, das zuerst ausläuft, ist
    // das dringlichste — Verlängerungen brauchen Vorlauf.
    end: (a, b) => String(a.leaseEnd).localeCompare(String(b.leaseEnd)),
    cost: (a, b) => b.yearlyCost - a.yearlyCost,
  };
  const SORT_OPTS = [
    { value: 'name', label: 'Objekt (A–Z)' },
    { value: 'area', label: 'Fläche (grösste zuerst)' },
    { value: 'end', label: 'Vertragsende (nächstes zuerst)' },
    { value: 'cost', label: 'Jahresmiete (höchste zuerst)' },
  ];

  // Zustand aus der URL lesen (Review apps/url-state-1): ein kopierter Link
  // reproduziert Suche, Filter, Baumauswahl, Sortierung, Seite und Ansicht —
  // dasselbe Versprechen, das die Detailseite mit `syncHash` bereits einlöst
  // und die Mediathek über C.catalogueHash vollständig vormacht.
  const state = {
    view: ['gallery', 'list', 'map'].includes(query.get('view')) ? query.get('view') : 'gallery',
    q: (query.get('q') || '').trim(),
    sort: SORT_OPTS.some((o) => o.value === query.get('sort')) ? query.get('sort') : 'end',
    page: Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1),
    perPage: { gallery: 9, list: 25 },
    // Nur bekannte VE-Kürzel übernehmen: ein Tippfehler in der URL erzeugte
    // sonst einen unsichtbaren Filter ohne zugehörige Checkbox zum Abwählen.
    filters: { ve: (query.get('ve') || '').split(',').filter((v) => all.some((t) => t.ve === v)) },
    sel: {},
  };
  // Baumauswahl: Parameternamen wie die data-Attribute des Baums (`obj` = Blatt).
  for (const [key, param] of [['land', 'land'], ['region', 'region'], ['city', 'city'], ['id', 'obj']]) {
    const v = query.get(param);
    if (v) state.sel[key] = v;
  }

  const inSel = (t) => (!state.sel.id || t.tenancyId === state.sel.id)
    && (!state.sel.land || t.land === state.sel.land)
    && (!state.sel.region || t.canton === state.sel.region)
    && (!state.sel.city || t.city === state.sel.city);
  const inFilters = (t) => !state.filters.ve.length || state.filters.ve.includes(t.ve);
  const inSearch = (t) => {
    const q = state.q.trim().toLowerCase();
    return !q || `${t.buildingName} ${t.city} ${t.veName} ${t.department} ${t.tenancyId} ${t.street}`.toLowerCase().includes(q);
  };
  const filtered = () => all.filter((t) => inSel(t) && inFilters(t) && inSearch(t));

  /* ------------------------------------------- räumlicher Baum (Sidebar) -- */
  // Land › Kanton › Ort › Mietverhältnis — über den geteilten Bauplan in
  // js/spatial-tree.js (Design-Review A1). Alle vier Stufen stehen als
  // Attribute im Mietverhältnis (data/tenancies.json) — der Baum entsteht ohne
  // einen einzigen Zugriff auf den Gebäudebestand. Der Kanton heisst am Knoten
  // `data-region`, damit die Auswahl-Schlüssel über alle Explorer gleich sind.
  // Länder sortieren nach dem ANGEZEIGTEN Namen (Vorgabe des Bauplans), nicht
  // nach dem Ländercode: sonst stünde «Schweiz» (CH) zwischen Brasilien und
  // Deutschland.
  const treeMarkup = treeHTML(C, all, {
    levels: [
      { key: 'land', icon: 'Globe', label: (k) => landName(k) },
      { key: 'canton', attr: 'region', icon: 'Map' },
      { key: 'city', icon: 'MapMarker' },
    ],
    leaf: { icon: () => 'Home', idText: (t) => t.ve, label: (t) => t.buildingName,
      objId: (t) => t.tenancyId, sort: (a, b) => a.buildingName.localeCompare(b.buildingName, 'de') },
  });

  /* ----------------------------------------------------------- Ansichten -- */

  const card = (t) => C.card({
    title: t.buildingName,
    desc: `${t.veName} · ${t.department}`,
    href: links.mietverhaeltnis(t.tenancyId),
    photo: { src: t.photoSrc, color: 'var(--color-secondary-600)', alt: `${t.buildingName}, ${t.city}` },
    chips: [t.ve, t.floorLabels.join(' + ')],
    footerInfo: `${m2(t.areaHnf)} · ${t.workstations} AP`,
    footerAction: C.cardAction(),
  });
  const galleryHTML = (slice) => `<div class="pf-gallery">${slice.map(card).join('')}</div>`;

  // `rowsClickable` wie in jeder Listenansicht, deren erste Spalte der Link der
  // Zeile ist (Review tables/tbl-8) — Zeilenklick und Cursor verhalten sich
  // damit wie in der Geschosstabelle des Details und den übrigen Katalogen.
  const listHTML = (slice) => C.table({
    caption: 'Mietverhältnisse', zebra: true, rowsClickable: true,
    columns: [
      { key: 'buildingName', label: 'Objekt', render: (t) => `<a href="${links.mietverhaeltnis(t.tenancyId)}">${esc(t.buildingName)}</a><br><span class="small muted">${esc(t.street)}, ${esc(t.zip)} ${esc(t.city)}</span>` },
      { key: 've', label: 'Verwaltungseinheit', render: (t) => `${esc(t.ve)}<br><span class="small muted">${esc(t.department)}</span>` },
      { key: 'floors', label: 'Geschosse', render: (t) => esc(t.floorLabels.join(', ')) },
      { key: 'areaHnf', label: 'Fläche', align: 'right', render: (t) => m2(t.areaHnf) },
      { key: 'workstations', label: 'AP', align: 'right', render: (t) => String(t.workstations) },
      { key: 'leaseEnd', label: 'Vertragsende', render: (t) => `${datum(t.leaseEnd)}<br>${restBadge(C, t.leaseEnd)}` },
    ],
    rows: slice,
  });

  // Kartenpunkte kommen aus `lat`/`lon` DES MIETVERHÄLTNISSES — kein Zugriff
  // auf buildings.geojson. Zwei Mietverhältnisse im selben Haus liegen damit
  // exakt übereinander; das ist fachlich richtig (es ist dasselbe Objekt) und
  // die Bündelung der Karte fasst sie zusammen.
  async function mountMap(list) {
    const el = mount.querySelector('#mt-map-el');
    if (!el) return;
    const points = list.filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lon))
      .map((t) => ({ lat: t.lat, lon: t.lon, label: t.buildingName, bblId: t.tenancyId,
        sub: `${t.ve} · ${t.floorLabels.join(' + ')} · ${m2(t.areaHnf)}`,
        href: links.mietverhaeltnis(t.tenancyId) }));
    await mtMap.mount(el, (node) => initEstateMap(node, points, { type: 'FeatureCollection', features: [] }, state.sel.id || null));
  }

  /* ------------------------------------------------- Teil-Neuzeichnung ---- */
  const syncTree = () => syncTreeCounts(mount.querySelector(".pf-tree"),
    all.filter((t) => inSearch(t) && inFilters(t)),
    (t) => [t.land, t.canton, t.city], (t) => t.tenancyId);

  function renderMain() {
    syncTree();
    // Zustand in die URL spiegeln (Review apps/url-state-1) — replaceState statt
    // location.hash, weil der Router auf hashchange die Seite neu aufbaute und
    // dabei die Karte (WebGL-Kontext) verwürfe. Standardwerte bleiben draussen,
    // damit der Link kurz bleibt (C.catalogueHash).
    history.replaceState(history.state, '', C.catalogueHash('#/app/tenancies', {
      q: state.q, page: state.page, view: state.view,
      sort: state.sort === 'end' ? '' : state.sort,
      ve: state.filters.ve,
      land: state.sel.land, region: state.sel.region, city: state.sel.city, obj: state.sel.id,
    }));
    // Den gedrückten Ansichtsknopf hier pflegen: wireCatalogueState schaltet
    // nur den Zustand um — aria-pressed ist Teil der Neuzeichnung. (Der
    // Filter-Zähler am Umschalter wohnt seit A2 in wireCatalogueState selbst.)
    mount.querySelectorAll('.view-switch__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    const list = filtered().slice().sort(SORTS[state.sort] || SORTS.end);
    const cnt = mount.querySelector('#mt-count');
    const main = mount.querySelector('#mt-main');
    mtMap.free();

    // NUR die Trefferzahl — keine Summen. Fläche und Jahresmiete über die
    // gefilterte Menge zu addieren wäre eine Auswertung, und Auswertungen
    // gehören ins Datenportal (#/app/dataportal), nicht in eine Katalogleiste.
    // Die Zahlen des einzelnen Mietverhältnisses stehen auf dessen Detailseite.
    const zaehler = (n, suffix = '') => {
      if (cnt) cnt.innerHTML = `<strong>${n}</strong> von ${all.length} Mietverhältnissen${suffix}`;
    };

    mount.querySelector('#mt-activefilters').innerHTML = C.activeFilters({
      filters: [
        ...(state.q ? [{ label: `Suche: «${state.q}»`, remove: 'q' }] : []),
        ...state.filters.ve.map((v) => ({ label: v, remove: 've:' + v })),
        ...(state.sel.city ? [{ label: state.sel.city, remove: 'sel' }]
          : state.sel.region ? [{ label: state.sel.region, remove: 'sel' }]
          : state.sel.land ? [{ label: landName(state.sel.land), remove: 'sel' }] : []),
      ],
    });

    if (state.view === 'map') {
      // Bewusst OHNE Seiten-Suffix: die Karte zeigt ALLE Treffer, nicht eine
      // Seite — «Seite 1 von 2» neben einer ungeschnittenen Karte wäre falsch
      // (dokumentierte Abweichung, docs/design-review.md).
      zaehler(list.length);
      main.innerHTML = `<div class="pf-map dash-map" id="mt-map-el" role="group" aria-label="Karte der Mietverhältnisse"></div>`;
      mountMap(list);
      C.announceCatalogue({ count: list.length, total: all.length,
        unit: { nom: 'Mietverhältnisse', dat: 'Mietverhältnissen' },
        page: 1, totalPages: 1, view: state.view });
      return;
    }
    if (!list.length) {
      zaehler(0);
      // Leerzustand mit Ausweg (Explorer-Kanon): der Rat allein verlangte,
      // hochzuscrollen und die Leiste zu suchen — der Knopf ist der Weg.
      main.innerHTML = C.empty('Keine Mietverhältnisse gefunden.', {
        hint: 'Passen Sie Ihre Suche, die Filter oder die Auswahl im Baum an.',
        action: { id: 'mt-empty-reset', label: 'Suche und Filter zurücksetzen' },
      });
      C.announceCatalogue({ count: 0, total: all.length,
        unit: { nom: 'Mietverhältnisse', dat: 'Mietverhältnissen' },
        page: 1, totalPages: 1, view: state.view });
      return;
    }
    const per = state.perPage[state.view];
    const pages = Math.max(1, Math.ceil(list.length / per));
    if (state.page > pages) state.page = pages;
    const slice = list.slice((state.page - 1) * per, state.page * per);
    zaehler(list.length, pages > 1 ? ` · Seite ${state.page} von ${pages}` : '');
    // Ohne href-Builder rendert C.pagination echte <button data-page>, die
    // C.wirePagination zusammen mit dem Seitenfeld bindet (Design-Review A3) —
    // der frühere Regex-Klickhandler auf das deutsche aria-label entfällt.
    main.innerHTML = (state.view === 'gallery' ? galleryHTML(slice) : listHTML(slice))
      + C.pagination({ page: state.page, totalPages: pages, inputId: 'mt-page' });
    C.wirePagination(main, 'mt-page', state.page, pages, (p) => { state.page = p; renderMain(); });
    C.announceCatalogue({ count: list.length, total: all.length,
      unit: { nom: 'Mietverhältnisse', dat: 'Mietverhältnissen' },
      page: state.page, totalPages: pages, view: state.view });
  }

  /* ------------------------------------------------------------- Gerüst ---- */
  const veOptions = [...new Set(all.map((t) => t.ve))].sort()
    .map((v) => ({ value: v, label: `${v} (${all.filter((t) => t.ve === v).length})` }));

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Mietende',
      lead: 'Ihre gemieteten Flächen: Verträge, Grundrisse und laufende Anliegen — aus Sicht der mietenden Verwaltungseinheit.',
    })}
    ${C.catalogueBar({
      formId: 'mt-search', inputId: 'mt-q', searchLabel: 'Mietverhältnis suchen',
      placeholder: 'Objekt, Ort oder Verwaltungseinheit suchen…', q: state.q,
      countId: 'mt-count', count: '',
      sort: { id: 'mt-sort', value: state.sort, options: SORT_OPTS },
      filterId: 'mt-filter', filterLabel: 'Filter', filterCount: state.filters.ve.length, panelId: 'mt-filters',
      panel: C.filterGroup({ dim: 've', legend: 'Verwaltungseinheit', selected: state.filters.ve, options: veOptions })
        + C.panelReset({ id: 'mt-reset' }),
      view: state.view,
      views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List'], ['map', 'Kartenansicht', 'Map']],
    })}
    <div id="mt-activefilters"></div>
    <div class="pf-layout">
      <aside class="pf-sidebar" aria-label="Struktur der Mietverhältnisse">
        <div class="pf-sidebar__head">
          <h2 class="pf-sidebar__title">Standorte</h2>
          <button type="button" class="btn btn--bare btn--sm" id="mt-clear" hidden>${C.icon('Cancel', 'icon--base')}<span class="btn__text">Auswahl zurücksetzen</span></button>
        </div>
        ${treeMarkup}
      </aside>
      <div class="pf-main" id="mt-main"></div>
    </div>
  </div>`;

  /* ---------------------------------------------------------- Verdrahten ---- */
  const clearBtn = mount.querySelector('#mt-clear');
  const sidebar = mount.querySelector('.pf-sidebar');
  const qEl = mount.querySelector('#mt-q');

  // Auswahl von aussen aufheben (Pille «sel», Reset-Pille, Leerzustands-Knopf):
  // dieselbe Pflege, die wireTree beim Klick auf den Auswahl-Knopf leistet.
  const clearSelection = () => {
    markTree(sidebar, null);
    clearBtn.hidden = true;
    state.sel = {};
    state.page = 1;
    renderMain();
  };

  // Katalogleiste über die geteilte Verdrahtung (Design-Review A2): Suche mit
  // Tipp-Verzögerung, Sortierung, Ansichtswechsel, Filterpanel samt Zähler-
  // Badge, Panel-Reset und Aktiv-Pillen. Der data-reset-Zweig macht den zuvor
  // TOTEN «Alle Filter zurücksetzen»-Knopf funktionsfähig (A5): Suche und
  // Filter räumt wireCatalogueState selbst ab, onReset zusätzlich den Baum.
  const cat = C.wireCatalogueState(mount, {
    formId: 'mt-search', inputId: 'mt-q', sortId: 'mt-sort',
    filterToggleId: 'mt-filter', panelId: 'mt-filters', resetId: 'mt-reset',
    activeFiltersId: 'mt-activefilters', state,
    onChange: renderMain,
    onRemove: (tok) => { if (tok === 'sel') clearSelection(); },
    onReset: clearSelection,
  });
  onUnmount(cat.destroy);

  // Raumbaum: Klick-Verdrahtung, Zweiton-Markierung (is-active/is-path) und
  // Auswahl-Knopf aus js/spatial-tree.js (A1) — die alte lokale Kopie
  // markierte mit `is-selected`, wofür am Baum keine CSS-Regel existiert:
  // die Auswahl blieb unsichtbar.
  wireTree(sidebar, {
    attrs: ['land', 'region', 'city'], clearBtn,
    onSelect: (sel) => { state.sel = sel; state.page = 1; renderMain(); },
  });
  // Eine aus der URL übernommene Baumauswahl sichtbar machen (Review
  // apps/url-state-1): Pfad aufklappen, Knoten markieren, Lösch-Knopf zeigen —
  // sonst stünde eine gefilterte Trefferliste neben einem Baum, der nichts
  // davon erkennen liesse.
  restoreTreeSelection(sidebar, state.sel, { attrs: ['land', 'region', 'city'], clearBtn });

  // Zeilenklick der Listenansicht (C.table `rowsClickable`) — einmal delegiert
  // auf #mt-main, das jede Teil-Neuzeichnung überlebt.
  C.wireTableRows(mount.querySelector('#mt-main'));

  // Der Leerzustands-Knopf entsteht bei jedem Zeichnen neu — Delegation statt
  // Einzelbindung. Voller Reset wie die Reset-Pille: Suche, Filter UND Baum.
  mount.querySelector('#mt-main').addEventListener('click', (e) => {
    if (!e.target.closest('#mt-empty-reset')) return;
    state.q = ''; qEl.value = '';
    cat.clearFilters();
    clearSelection();
  });

  renderMain();
}

/* ================================== DETAIL ================================ */
function detail(ctx, id) {
  const { mount, query, core, engine, session, C, setTitle, setCrumbs, onUnmount } = ctx;
  const t = core.tenancy(id);
  if (!t) {
    C.renderNotFound(ctx, { thing: 'Dieses Mietverhältnis', title: 'Mietverhältnis nicht gefunden',
      backHref: '#/app/tenancies', backLabel: 'Mietende',
      crumbs: [...CRUMBS, { label: 'Mietende', href: '#/app/tenancies' }] });
    return;
  }
  setTitle(t.buildingName);
  setCrumbs([...CRUMBS, { label: 'Mietende', href: '#/app/tenancies' }, { label: t.buildingName }]);

  const floors = core.floorsForTenancy(t);
  const contracts = core.contractsForBuilding(t.buildingId);
  // Laufende Vorgänge zu diesem Objekt — die Prozess-Engine führt sie unter
  // `linkedEntities.buildingId`. Das ist der Grund, warum Mietende hier
  // überhaupt nachschauen: «was ist offen bei uns?»
  const cases = (engine.instances() || []).filter((i) => i.linkedEntities && i.linkedEntities.buildingId === t.buildingId);

  const tabs = [
    { id: 'uebersicht', label: 'Übersicht' },
    // Reiterbeschriftungen tragen im ganzen Portal den Plural, sobald eine Zahl
    // danebensteht — «Übersicht» ist die einzige Ausnahme. «Vertrag (3)» und
    // «Grundriss (2)» lasen sich wie ein einzelner Gegenstand mit einer Zahl
    // dahinter. «Verträge (0)» ist ausdrücklich richtig.
    // «Grundrisse» ist ein eigener Reiter — nach einem Zwischenschritt als
    // Abschnitt der Übersicht. Der Grund für den Rückweg: der Betrachter
    // braucht BREITE. Als Abschnitt teilte er sich die Inhaltsspalte mit der
    // Randspalte (929px statt 1329px), und daneben stand die Geschosstabelle,
    // die Vertragsdaten und die Anträge — vier Dinge auf einer Fläche. Als
    // eigener Reiter bekommt der Plan die volle Containerbreite, und das
    // Raumdetail mit «Vorgang starten» hat rechts Platz, ohne mit einer
    // zweiten Randspalte um dieselbe Kante zu streiten.
    { id: 'grundriss', label: `Grundrisse (${floors.length})` },
    { id: 'vertrag', label: `Verträge (${contracts.length})` },
    // «Vorgänge» bleibt dagegen ein Abschnitt der Übersicht: die laufenden
    // Anträge sind der Grund, warum eine Verwaltungseinheit diese Ansicht
    // überhaupt öffnet — hinter einem Reiter waren sie einen Klick von der
    // Frage entfernt, die sie beantworten. Ein alter Link mit `?tab=vorgaenge`
    // fällt über die Prüfung unten stillschweigend auf die Übersicht zurück.
  ];
  let active = query.get('tab') || 'uebersicht';
  if (!tabs.some((x) => x.id === active)) active = 'uebersicht';

  // Zustand des Grundrisses lebt im Hash: Geschoss, Einfärbung, gewählter Raum.
  // Damit ist eine bestimmte Ansicht teilbar — «schau dir 2. OG, nach Verwaltungseinheit
  // eingefärbt, Raum 14 an» ist ein Link.
  // OHNE `?floor=` steht die GESCHOSSTABELLE, nicht gleich ein Plan: ein
  // Mietobjekt umfasst mehrere Geschosse, und welches man ansehen will, ist
  // eine Entscheidung — sie vorwegzunehmen (erstes Geschoss automatisch) hätte
  // die übrigen versteckt und die Kennzahlen je Geschoss gar nicht gezeigt.
  let floorId = query.get('floor') || '';
  if (floorId && !floors.some((f) => f.floorId === floorId)) floorId = '';
  // Ein Link, der ein Geschoss nennt, meint den Grundriss — auch ohne `tab=`.
  // Die Geschosstabelle verlinkt genau so (nur `?floor=`), und geteilte Links
  // aus der Zeit, als der Plan ein Abschnitt der Übersicht war, landen damit
  // weiterhin dort, wo der Plan steht.
  if (floorId && !query.get('tab')) active = 'grundriss';
  // VORGABE «Verwaltungseinheit», nicht «Keine»: ein einfarbiger Plan lässt
  // nicht erkennen, dass er überhaupt eingefärbt werden KANN — die Auswahl
  // daneben las sich wie eine Zierde. Mit der Verwaltungseinheit als Startbild ist der
  // Nutzen sofort sichtbar, und wer etwas anderes braucht, stellt um. Die
  // Verwaltungseinheit ist zudem die Frage, mit der man in ein Mietobjekt
  // schaut: wer sitzt wo.
  const COLOR_DEFAULT = 've';
  let colorMode = COLOR_MODES.some((m) => m.value === query.get('color')) ? query.get('color') : COLOR_DEFAULT;
  let spaceId = query.get('space') || '';

  const syncHash = () => {
    const p = new URLSearchParams();
    if (active !== 'uebersicht') p.set('tab', active);
    // Der Grundrisszustand hängt nicht mehr an einem Reiter — er gehört zur
    // Übersicht und bleibt deshalb unabhängig von `active` im Hash stehen.
    if (floorId) p.set('floor', floorId);
    if (colorMode !== COLOR_DEFAULT) p.set('color', colorMode);
    if (spaceId) p.set('space', spaceId);
    const qs = p.toString();
    history.replaceState(history.state, '', `${links.mietverhaeltnis(t.tenancyId)}${qs ? '?' + qs : ''}`);
  };

  const galleryItems = galleryItemsFrom(t.bilder, {
    idPrefix: t.tenancyId, title: t.buildingName, ort: t.city,
  });

  /* ------------------------------------------------------------ Übersicht -- */
  function panelUebersicht() {
    // Vier Zahlen zuerst, Einzelheiten danach. Vorher standen alle zehn
    // Merkmale gleichgewichtig untereinander — «wie gross, wie teuer» musste
    // man sich aus der Liste zusammensuchen. Vorbild: `.property-stats` im
    // Mieterportal-Prototyp.
    const kpis = `<div class="kpi-strip">
      <div class="kpi-strip__item"><span class="kpi-strip__label">Fläche (HNF)</span>
        <span class="kpi-strip__value">${num(t.areaHnf)}<small> m²</small></span></div>
      <div class="kpi-strip__item"><span class="kpi-strip__label">Arbeitsplätze</span>
        <span class="kpi-strip__value">${t.workstations}</span></div>
      <div class="kpi-strip__item"><span class="kpi-strip__label">Fläche je Arbeitsplatz</span>
        <span class="kpi-strip__value">${(t.areaHnf / t.workstations).toFixed(1)}<small> m²</small></span></div>
      <div class="kpi-strip__item"><span class="kpi-strip__label">Jahresmiete</span>
        <span class="kpi-strip__value">${chf(t.yearlyCost)}</span></div>
    </div>`;
    // Fläche, Arbeitsplätze und Jahresmiete stehen jetzt oben in der
    // Kennzahlenzeile — hier bleiben die Merkmale, die man liest und nicht
    // überfliegt.
    const kv = `<dl class="kv">
      <dt>Verwaltungseinheit</dt><dd>${C.escape(t.veName)}<br><span class="small muted">${C.escape(t.department)}</span></dd>
      <dt>Objekt</dt><dd>${C.escape(t.buildingName)}<br><span class="small muted">${C.escape(t.street)}, ${C.escape(t.zip)} ${C.escape(t.city)}</span></dd>
      <dt>Geschosse</dt><dd>${C.escape(t.floorLabels.join(', '))}</dd>
      <dt>Mietbeginn</dt><dd>${datum(t.leaseStart)}</dd>
      ${/* «Vertragsende», nicht «Mietende» (Review D19): «Mietende» ist hier
            der Name der App und ihrer Nutzenden — als Beschriftung eines
            Datums las es sich doppeldeutig. */''}
      <dt>Vertragsende</dt><dd>${datum(t.leaseEnd)}</dd>
      <dt>Kostenstelle</dt><dd>${C.escape(t.costCentre)}</dd>
      <dt>Objekt im Inventar</dt><dd><a href="${links.objekt(t.buildingId)}">${C.escape(t.buildingId)}</a></dd>
    </dl>`;
    // Die Randspalte gehört IN dieses Panel: die Reiterleiste darüber behält so
    // die volle Containerbreite und fluchtet mit dem Hero, und der Reiter
    // «Verträge» bekommt seine siebenspaltige Tabelle ungeschmälert. Der
    // Klebeweg bleibt erhalten — dieses Panel ist 1227px hoch, die Randspalte
    // 772px.
    return `<div class="detail-layout"><div>
        <section>
          <h2 class="detail-section__title">Vertrag und Mengengerüst</h2>
          ${kpis}
          ${kv}
        </section>
        ${/* Als eigener Reiter war das einen Klick weit weg von genau der
              Frage, mit der man in diese Ansicht kommt: «was läuft bei uns?» */''}
        <section class="detail-section">
          <h2 class="detail-section__title">Anträge zu diesem Mietobjekt</h2>
          <div id="mt-dt-vorgaenge"></div>
        </section>
      </div>${asideHtml()}</div>`;
  }

  // Randspalte NEBEN der ganzen Reiterfläche (wie im Liegenschafteninventar):
  // Aktionen und Ansprechstellen gelten dem MIETOBJEKT, nicht einem Reiter.
  // EIN Kasten für alle Ansprechstellen, nicht einer je Stelle: zuvor stand je
  // Kontakt eine vollständige Kartenhülle um drei Textzeilen (191px hoch, davon
  // das meiste Polsterung). Die Rolle ist die Beschriftung, der Name entfällt,
  // wo er sie nur wiederholt («Portfoliomanagement / Portfoliomanagement» in
  // 18 von 18 Datensätzen las sich wie ein Anzeigefehler). Beide Karten kommen
  // aus js/components.js — dieselben wie im Inventar.
  const asideHtml = () => `<aside class="detail-layout__aside" aria-label="Aktionen und Ansprechpersonen">
    ${C.actionCard({ lead: 'Für dieses Objekt vorbelegt.', links: aktionLinks() })}
    ${C.contactCard({ contacts: (t.contacts || []).map((c) => ({
      label: c.rolle, name: c.name, email: c.email, phone: c.phone })) })}
  </aside>`;

  /* ------------------------------------------------------------- Grundriss -- */
  // Zwei Zustände: die Geschossübersicht als Tabelle, und der Plan eines
  // Geschosses. Ein Mietobjekt umfasst mehrere Geschosse — die Tabelle ist die
  // Einstiegsebene und beantwortet die Mengenfragen (wie viele Räume, wie viel
  // Fläche, wie viele Arbeitsplätze je Geschoss), bevor man in die Zeichnung geht.
  // Zwei Zustände in EINEM Reiter: die Geschosstabelle, und an ihrer Stelle der
  // Betrachter. Der Wechsel tauscht nur `#mt-grundriss__body` aus — Seitenkopf,
  // Bildmosaik und Reiterleiste bleiben stehen, es wird nicht navigiert.
  function panelGrundriss() {
    return `<div id="mt-grundriss__body" class="floorplan-body">${
      grundrissBodyHtml()}</div>`;
  }

  const grundrissBodyHtml = () => !floors.length
    ? C.empty('Für dieses Mietverhältnis ist kein Grundriss hinterlegt.')
    : floorId ? floorplanView() : floorTable();

  // Geschosszeilen — angereichert um die Summen aus den Räumen. Wird von der
  // Datentabelle unten gelesen.
  const floorRows = () => floors.map((f) => {
    const sp = core.spacesForFloor(f.floorId);
    // «Davon <meine VE>»: die Tabelle listete bisher nur ALLE belegenden
    // Einheiten als Textkette. Für die mietende VE ist aber genau die eine
    // Frage interessant — wie viele der Räume auf diesem Geschoss gehören uns.
    // Ein Gebäude trägt oft mehrere Mietverhältnisse (Liebefeld: BAFU und BLV),
    // die Unterscheidung ist also nicht theoretisch.
    const meine = sp.filter((s) => s.occupierVe === t.ve);
    return {
      ...f,
      arbeitsplaetze: sp.reduce((n, s) => n + (s.capacity || 0), 0),
      meineRaeume: meine.length,
      meineFlaeche: meine.reduce((n, s) => n + (s.area || 0), 0),
      belegung: [...new Set(sp.map((s) => s.occupierVe).filter(Boolean))].sort().join(', ') || '—',
    };
  });

  // Geschosse als Datentabelle mit Katalogleiste — dieselbe Komponente wie die
  // Register des Liegenschafteninventars (C.mountDataTable). Erste Spalte ist
  // ein echter Link; er trägt Tastatur und Screenreader. `rowsClickable` legt
  // den Mausklick auf die ganze Zeile darüber.
  function floorTable() {
    return '<div id="mt-dt-floors"></div>';
  }

  function floorplanView() {
    const floor = floors.find((f) => f.floorId === floorId) || floors[0];
    const spaces = core.spacesForFloor(floor.floorId);
    const sel = spaces.find((s) => s.spaceId === spaceId) || null;

    // Geschosswahl als CD-`tag-item` — dieselbe Chip-Komponente, die auch die
    // Katalogfilter tragen, statt eines bespoken Knopfs mit voller Markenfarbe.
    // IMMER sichtbar, auch bei nur einem Geschoss: die aktive Pille IST seit
    // dem Wegfall von `.fp-head__name` die Angabe, welches Geschoss gezeichnet
    // ist. Sie bei einem einzelnen Geschoss auszublenden liesse die Kopfzeile
    // ohne diese Angabe zurück.
    const geschossWahl = `
        <div class="fp-floors" role="group" aria-label="Geschoss wechseln">${floors.map((f) => {
          const aktiv = f.floorId === floor.floorId;
          // Echtes Ziel statt href="#" (Review apps/floors-chip-1): der Chip
          // trägt denselben kanonischen Link wie die Geschosstabelle (?floor=…)
          // — Mittelklick und Link-Kopieren funktionieren, der Klick-Handler
          // zeichnet weiterhin nur den Grundrissbereich um.
          return `<a class="tag-item${aktiv ? ' tag-item--active' : ''}" href="${
            links.mietverhaeltnis(t.tenancyId)}?floor=${encodeURIComponent(f.floorId)}" data-floor="${C.escape(f.floorId)}"${
            aktiv ? ' aria-current="true"' : ''}><span class="tag-item__inner"><span class="tag-item__text">${
            C.escape(f.label)}</span></span></a>`;
        }).join('')}</div>`;

    // Kopfleiste des Betrachters — EINE Zeile: Rücksprung · Geschosswahl ·
    // Einfärbung · Vollbild/Drucken. Der Rücksprung gehört als erstes Element
    // in dieselbe Leiste; eine eigene Zeile darüber verbrauchte Höhe, ohne eine
    // zweite Informationsebene zu bilden.
    // Klebend, damit die Bedienung beim Scrollen eines hohen Plans erreichbar
    // bleibt — dasselbe Idiom wie `.docviewer__bar`. `#fp-wrap` umschliesst
    // Kopf UND Betrachter, damit im Vollbild die Bedienung mitkommt und nicht
    // nur die Zeichnung dasteht.
    const farbLabel = (COLOR_MODES.find((m) => m.value === colorMode) || {}).label || '';
    return `
      <div class="fp-wrap" id="fp-wrap">
        <div class="fp-head">
          <div class="fp-head__top">
            ${/* Auch der Rücksprung trägt sein echtes Ziel (wie die Geschoss-
                  Chips, Review apps/floors-chip-1): die Geschosstabelle ist die
                  Detailseite mit tab=grundriss ohne floor-Parameter. */''}
            <p class="fp-back"><a href="${links.mietverhaeltnis(t.tenancyId)}?tab=grundriss" id="fp-zurueck">${C.icon('ArrowLeft', 'icon--base')} Alle Geschosse</a></p>
            ${/* KEIN eigener Geschossname mehr: die aktive Pille der Geschosswahl
                  sagt bereits, welches Geschoss gezeichnet ist — zwei Angaben
                  nebeneinander waren eine zu viel. Bei nur EINEM Geschoss
                  entfällt die Wahl, dann trägt der Reitername «Grundrisse (1)»
                  zusammen mit dem Rücksprung «Alle Geschosse» den Kontext. */''}
            ${geschossWahl}
            ${/* Vollwertiges CD-Auswahlfeld (`C.select`) statt eines baren
                  Toolbar-Selects: ohne Rahmen las sich «Verwaltungseinheit» wie
                  eine Beschriftung, nicht wie ein Bedienelement — und dies ist
                  der einzige Regler, der das Bild verändert. */''}
            ${C.select({ id: 'fp-color', label: 'Einfärben nach', value: colorMode,
              size: 'sm', wrapClass: 'fp-color', options: COLOR_MODES })}
            <div class="fp-head__actions">
              <button class="btn btn--outline btn--sm" type="button" id="fp-vollbild">
                ${C.icon('Expand', 'btn__icon icon--base')}<span class="btn__text">Vollbild</span></button>
              <button class="btn btn--outline btn--sm" type="button" id="fp-drucken">
                ${C.icon('Printer', 'btn__icon icon--base')}<span class="btn__text">Drucken</span></button>
            </div>
          </div>
        </div>
        <div class="fp-viewer">
          ${/* data-scroll-region (Review apps/fp-scroll-1): unter ~640px läuft
                die Zeichnung waagrecht über — über den geteilten Mechanismus
                (C.wireScrollRegions, zentral im Router) bekommt die Fläche dann
                Fokus, Gruppenrolle und Scrollhinweis wie jede Tabelle. */''}
          <div class="fp-stage" id="fp-stage" data-scroll-region aria-label="Grundriss ${C.escape(floor.label)}">${floorplanSvg({ floor, spaces, mode: colorMode, selectedId: spaceId })}</div>
          <div class="fp-side">
            ${/* Die Kennzahlen des Geschosses stehen HIER, nicht im Kopf: sie
                  gehören zur Auswertung der Zeichnung — wie die Legende
                  darunter, die dieselbe Fläche noch einmal aufteilt. Im Kopf
                  standen sie zwischen Rücksprung und Bedienelementen und
                  gehörten dort zu nichts. */''}
            <dl class="kv kv--tight fp-facts">
              <dt>Räume</dt><dd>${floor.rooms}</dd>
              <dt>Fläche (HNF)</dt><dd>${m2(floor.areaHnf)}</dd>
              <dt>Bruttofläche</dt><dd>${m2(floor.areaGross)}</dd>
            </dl>
            ${colorMode === 'none' ? '' : `<div>
              <h4 class="fp-side__title">Einfärbung: ${C.escape(farbLabel)}</h4>
              ${floorplanLegend(spaces, colorMode)}
            </div>`}
            <div class="fp-room-host" id="fp-room">${roomPanel(sel)}</div>
          </div>
        </div>
        ${/* Nur im Druck sichtbar: das Blatt trägt sonst keinen Bezug — eine
              Zeichnung ohne Objekt, Geschoss und Einfärbung ist auf Papier
              nicht zuzuordnen. */''}
        <p class="fp-print-foot">${C.escape(t.buildingName)} — ${C.escape(floor.label)} ·
          ${C.escape(t.street)}, ${C.escape(t.zip)} ${C.escape(t.city)} ·
          Einfärbung: ${C.escape(farbLabel)}</p>
      </div>`;
  }

  // Seitenspalte zum gewählten Raum. Sie ist der Ort, an dem der Grundriss ans
  // Portal andockt: von hier startet man die passende Dienstleistung mit
  // vorbelegtem Objekt, statt sie im Katalog zu suchen.
  function roomPanel(s) {
    if (!s) return `<div class="box fp-room fp-room--empty"><p class="small muted">Wählen Sie einen Raum im Grundriss, um Details und passende Dienstleistungen zu sehen.</p></div>`;
    const kv = [
      ['Nutzung', s.useLabel],
      ['Fläche', `${s.area} m²`],
      ['SIA 416', `${s.siaLabel} (${s.sia})`],
      s.capacity ? ['Arbeitsplätze', String(s.capacity)] : null,
      ['Verwaltungseinheit', s.occupierVe || 'nicht zugeteilt'],
      s.bookable ? ['Buchbar', 'ja'] : null,
    ].filter(Boolean);
    return `<div class="box fp-room">
      <h3>${C.escape(s.roomNumber)}</h3>
      <dl class="kv kv--tight">${kv.map(([k, v]) => `<dt>${C.escape(k)}</dt><dd>${C.escape(v)}</dd>`).join('')}</dl>
      ${s.bookable ? `<a class="btn btn--outline btn--sm" href="#/app/room-booking?building=${encodeURIComponent(t.buildingId)}&room=${encodeURIComponent(s.spaceId)}" target="_blank" rel="noopener">${C.icon('External', 'btn__icon icon--base')}<span class="btn__text">Raum buchen</span></a>` : ''}
      ${/* «Vorgang starten» (Sprachkanon): der Klick erstellt einen VORGANG im
            Portal — «Dienstleistung» ist die Katalogseite, nicht die Handlung. */''}
      <h4 class="fp-room__sub">Vorgang starten</h4>
      ${serviceLinks(s)}
    </div>`;
  }

  /* ------------------------------------------------- Dienstleistungs-Wege -- */
  // Kurzwege in bestehende Dienstleistungen aus data/services.json — mit
  // vorbelegtem Gebäude, damit der Vorgang nicht bei null beginnt. Die Auswahl
  // ist bewusst kurz: was Mietende an einer Fläche tatsächlich auslösen.
  function svc(serviceId) { return core.service(serviceId); }
  // Ohne führendes Symbol — wie C.actionCard: das Symbol wiederholte nur die
  // Beschriftung daneben. Der Folgepfeil bleibt, er trägt die Information,
  // dass die Zeile wegführt.
  function serviceLink(serviceId, href) {
    const s = svc(serviceId);
    if (!s) return '';
    return `<a class="fp-svc" href="${href}" target="_blank" rel="noopener">
      <span>${C.escape(s.title)}</span>${C.icon('External', 'icon--sm fp-svc__go')}</a>`;
  }
  const objektQ = `building=${encodeURIComponent(t.buildingId)}`;
  function serviceLinks(s) {
    const raumQ = s ? `&room=${encodeURIComponent(s.roomNumber)}` : '';
    return `<div class="fp-svc-list">
      ${serviceLink('stoerung-melden', `#/app/fault-report?${objektQ}${raumQ}`)}
      ${serviceLink('kleinauftrag-gebaeude', `#/app/fault-report?type=kleinauftrag&${objektQ}${raumQ}`)}
      ${serviceLink('umzug-anmelden', `#/app/fault-report?type=umzug&${objektQ}${raumQ}`)}
    </div>`;
  }
  // Randspalten-Aktionen für C.actionCard (Design-Review B21): der Kasten kam
  // zuvor handgerollt daher, obwohl die geteilte Karte genau dafür existiert.
  // Fehlt eine Dienstleistung in data/services.json, fällt ihre Zeile weg,
  // statt eine leere Beschriftung zu verlinken.
  const aktionLinks = () => [
    ['stoerung-melden', `#/app/fault-report?${objektQ}`],
    ['kleinauftrag-gebaeude', `#/app/fault-report?type=kleinauftrag&${objektQ}`],
    ['umzug-anmelden', `#/app/fault-report?type=umzug&${objektQ}`],
    ['raumbedarf-melden', `#/app/space-request?${objektQ}`],
    ['reklamation', `#/app/fault-report?type=reklamation&${objektQ}`],
  ].map(([sid, href]) => ({ label: (svc(sid) || {}).title, href, newWindow: true })).filter((l) => l.label)
    // Dokumente hängen am GEBÄUDE, nicht am Mietverhältnis — deshalb hier kein
    // Dokumentenabschnitt, sondern der Weg in die Bauwerksdokumentation, auf
    // dieses Gebäude vorgefiltert.
    .concat({ label: 'Dokumente zum Gebäude', href: `#/app/document-archive?building=${encodeURIComponent(t.buildingId)}`, newWindow: true });

  /* ------------------------------------------------- Vertrag und Vorgänge -- */
  // Beide Reiter tragen NUR ihre Tabelle. Die Vertragseckdaten standen zuvor
  // als Merkmalliste darüber — sie stehen ohnehin im Reiter «Übersicht», und
  // zwei Darstellungen derselben Zahlen auf einer Seite lassen offen, welche
  // gilt. Die Dienstleistungs-Kurzwege liegen aus demselben Grund nur noch in
  // der Seitenspalte der Übersicht und im Raumdetail des Grundrisses.
  const panelVertrag = () => '<div id="mt-dt-vertraege"></div>';

  /* ------------------------------------------------------- Datentabellen ---- */
  // Alle Tabellen der Reiter laufen über dieselbe Komponente wie die Register
  // des Liegenschafteninventars: Katalogleiste (Suche, Sortierung, Filter,
  // Trefferzahl) über der Tabelle, Blätterleiste darunter. Das ersetzt drei
  // handgebaute Tabellen und macht sie durchsuchbar und sortierbar.
  const uniqOpts = (rows, key) => [...new Set(rows.map((r) => String(r[key] || '')).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'de')).map((v) => ({ value: v, label: v }));

  function dataTables() {
    return {
      'mt-dt-floors': {
        id: 'mt-dt-geschosse', rows: floorRows(), unit: { nom: 'Geschosse', dat: 'Geschossen' },
        caption: 'Geschosse dieses Mietverhältnisses', perPage: 10, rowsClickable: true,
        searchKeys: ['label', 'belegung'],
        sorts: [
          { value: 'level', label: 'Niveau (unten zuerst)', cmp: (a, b) => a.level - b.level },
          { value: 'area', label: 'Fläche (grösste zuerst)', cmp: (a, b) => b.areaHnf - a.areaHnf },
          { value: 'rooms', label: 'Räume (meiste zuerst)', cmp: (a, b) => b.rooms - a.rooms },
        ],
        columns: [
          { key: 'label',
            label: 'Geschoss',
            render: (f) => `<a href="${links.mietverhaeltnis(t.tenancyId)}?floor=${encodeURIComponent(f.floorId)}">${C.escape(f.label)}</a>${
              f.meineRaeume ? ` ${C.badge('Ihr Standort', 'success')}` : ''}` },
          { key: 'rooms', label: 'Räume', align: 'right', render: (f) => String(f.rooms) },
          { key: 'areaHnf', label: 'HNF', align: 'right', render: (f) => m2(f.areaHnf) },
          { key: 'arbeitsplaetze', label: 'Arbeitsplätze', align: 'right', render: (f) => String(f.arbeitsplaetze) },
          { key: 'meineRaeume', label: `Davon ${t.ve}`, align: 'right',
            render: (f) => f.meineRaeume ? `${f.meineRaeume} <span class="small muted">(${m2(f.meineFlaeche)})</span>` : '<span class="muted">—</span>' },
        ],
        // Summenzeile über die GEFILTERTE Menge, nicht über die Seite: sonst
        // stünde bei zwei Seiten eine Teilsumme unter der Tabelle. Keine eigene
        // Klasse und kein <strong> mehr (Review tables/tbl-4): das CD zeichnet
        // den <tfoot> selbst aus (2px-Linien oben und unten, nur die
        // Zeilenbeschriftung im <th> fett, Werte regulär) — die Optik kommt
        // vollständig aus der tfoot-Regel in css/app.css.
        foot: (_sichtbar, alle) => `<tr>
          <th scope="row" class="text-left">Total (${alle.length})</th>
          <td class="text-right">${alle.reduce((n, f) => n + f.rooms, 0)}</td>
          <td class="text-right">${m2(alle.reduce((n, f) => n + f.areaHnf, 0))}</td>
          <td class="text-right">${alle.reduce((n, f) => n + f.arbeitsplaetze, 0)}</td>
          <td class="text-right">${alle.reduce((n, f) => n + f.meineRaeume, 0)}</td></tr>`,
      },
      'mt-dt-vertraege': {
        id: 'mt-dt-vertrag', rows: contracts, unit: { nom: 'Verträge', dat: 'Verträgen' },
        caption: 'Verträge zum Objekt',
        // Inventar-Leerzustands-Kanon: «Keine ‹X› erfasst.» — der Halbsatz
        // «Zu diesem Objekt … im Inventar» wiederholte nur die Tabellenüberschrift.
        emptyMsg: 'Keine Verträge erfasst.',
        perPage: 10, searchKeys: ['contractId', 'type', 'contractPartner'],
        sorts: [
          { value: 'until', label: 'Gültig bis (nächstes zuerst)', cmp: (a, b) => String(a.validUntil).localeCompare(String(b.validUntil)) },
          { value: 'amount', label: 'Betrag (höchster zuerst)', cmp: (a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0) },
        ],
        facets: [{ dim: 'type', legend: 'Vertragsart', options: uniqOpts(contracts, 'type'), match: (r, v) => v.includes(String(r.type)) }],
        columns: [
          { key: 'contractId', label: 'Vertrag', render: (c) => C.escape(c.contractId) },
          { key: 'type', label: 'Art', render: (c) => C.escape(c.type) },
          { key: 'contractPartner', label: 'Partnerin', render: (c) => C.escape(c.contractPartner || '—') },
          { key: 'validFrom', label: 'Gültig ab', render: (c) => datum(c.validFrom) },
          { key: 'validUntil', label: 'Gültig bis', render: (c) => datum(c.validUntil) },
          { key: 'amount', label: 'Betrag', align: 'right', render: (c) => c.amount ? chf(c.amount) : '—' },
          { key: 'status', label: 'Status', render: (c) => C.badge(c.status || '—', c.status === 'aktiv' ? 'success' : 'gray') },
        ],
      },
      'mt-dt-vorgaenge': {
        // «Antrag» ist hier das richtige Wort, nicht «Vorgang»: das ist die
        // Sicht der mietenden Verwaltungseinheit auf das, was SIE eingereicht
        // hat. Die Referenzspalte führt weiterhin zum «Vorgang» unter «Meine
        // Vorgänge» — das ist derselbe Gegenstand aus Sicht der Bearbeitung.
        id: 'mt-dt-vorgang', rows: cases, unit: { nom: 'Anträge', dat: 'Anträgen' },
        caption: 'Anträge zu diesem Mietobjekt',
        emptyMsg: 'Zu diesem Mietobjekt ist derzeit kein Antrag offen.',
        perPage: 10, searchKeys: ['reference', 'title', 'defName'],
        sorts: [{ value: 'updated', label: 'Aktualisiert (neuste zuerst)', cmp: (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) }],
        columns: [
          { key: 'reference', label: 'Referenz', render: (i) => `<a href="${links.vorgang(i.instanceId)}">${C.escape(i.reference || i.instanceId)}</a>` },
          { key: 'title', label: 'Anliegen', render: (i) => C.escape(i.title || '—') },
          { key: 'defName', label: 'Ablauf', render: (i) => C.escape(i.defName || '—') },
          { key: 'status', label: 'Status', render: (i) => C.badge(statusLabel(core, i.status), 'info') },
          { key: 'updatedAt', label: 'Aktualisiert', render: (i) => datum(i.updatedAt || i.createdAt) },
        ],
      },
    };
  }

  const panels = { uebersicht: panelUebersicht, grundriss: panelGrundriss, vertrag: panelVertrag };

  /* ---------------------------------------------------------------- Zeichnen */
  function draw() {
    // Restlaufzeit als Abzeichen im Kopf — es ist die erste Frage an ein
    // Mietverhältnis. DIESELBE Modul-Funktion wie in der Übersichtsliste
    // (restBadge, Design-Review B21), damit Liste und Detail dieselbe Aussage
    // machen; Abstufung und Begründung stehen dort.
    const restChip = restBadge(C, t.leaseEnd);

    mount.innerHTML = `
    <div class="container section">
      ${/* CD-Detailkopf (Review apps/share-1): Zurück-Link UND Share-Bar in
            einer Zeile — der Hash trägt den ganzen Grundrisszustand, gerade
            diese Seite ist zum Teilen gebaut. */''}
      ${C.detailBar({ backHref: '#/app/tenancies', backLabel: 'Mietende' })}
      ${/* Augenbrauenzeile: die Kennungen, nach denen gesucht und in Mails
            zitiert wird. Als Teil der Lead-Zeile gingen sie zwischen Adresse
            und Fläche unter. */''}
      <p class="eyebrow">${C.escape(t.tenancyId)} · Objekt ${C.escape(t.buildingId)}</p>
      <h1 tabindex="-1">${C.escape(t.buildingName)}</h1>
      <p class="lead">${C.escape(t.street)}, ${C.escape(t.zip)} ${C.escape(t.city)} · ${
        C.escape(t.ve)} · ${C.escape(t.floorLabels.join(' + '))}</p>
      ${restChip ? `<p class="pill-row mt-2">${restChip}</p>` : ''}
      ${/* Derselbe Kopf wie im Liegenschafteninventar (js/hero-mosaic.js):
            Bildmosaik links, Standortkarte rechts, jede Kachel öffnet die
            Vollbildgalerie. Ein einzelnes Bild wie zuvor liess offen, dass es
            zum Objekt weitere Aufnahmen gibt, und zeigte die Lage gar nicht. */''}
      ${heroMosaic(C, { items: galleryItems, id: 'mt-mosaic', mapId: 'mt-hero-map', lat: t.lat, lon: t.lon,
        mapLabel: `Standort von ${t.buildingName} auf der Karte` })}
      ${/* Reiterrahmen und Abstände wie im Liegenschafteninventar
            (js/apps/portfolio.js): `.tabs mt-6` um Leiste und Panels, alles auf
            weissem Grund im selben `.container.section`. Zwischenzeitlich lag
            hier ein getöntes Band mit weissen Karten (Vorbild
            Mieterportal-Prototyp) — verworfen, weil es diese eine Detailseite
            gegen alle anderen Micro-Apps abgesetzt hätte. */''}
      <div class="tabs mt-6">
        ${C.tabBar({ items: tabs, active, idPrefix: 'mt-tab', ariaLabel: 'Mietverhältnis' })}
        ${C.tabPanels({ items: tabs, active, idPrefix: 'mt-tab', heading: true, render: (id2) => panels[id2]() })}
      </div>
    </div>`;

    C.wireTabs(mount, { syncHash: (tab) => { active = tab; syncHash(); } });
    // Alle Tabellen genau einmal beim Aufbau montieren. Partielle
    // Grundriss-Neuzeichnungen fassen danach nur noch die Geschosstabelle an.
    wireGrundriss({ mountAllTables: true });
    wireHero();
    // KEIN eigenes scrollTo/Fokussieren mehr: Scroll und Fokus gehören dem
    // Router — echte Navigation beginnt dort am Seitenanfang, ein reiner
    // Zustandswechsel (?floor=/?tab=) behält Position und Bedienpfad. Das
    // unbedingte scrollTo(0,0) hier warf beim Öffnen eines Grundrisses aus
    // der Geschosstabelle die Seite nach oben (Nutzerbefund 2026-07-30).
  }

  // Nur den Grundriss-Bereich neu zeichnen statt der ganzen Seite: ein voller
  // draw() würde den Fokus auf die h1 zurückwerfen und nach oben scrollen —
  // beim Durchklicken von Räumen wäre das unbenutzbar.
  function redrawGrundriss() {
    const host = mount.querySelector('#mt-grundriss__body');
    if (!host) return draw();
    if (detach) { detach(); detach = null; }
    unmountTable('mt-dt-floors');

    const currentWrap = host.querySelector('#fp-wrap');
    if (currentWrap && floorId) {
      // Bei Raumwahl, Einfärbung und Geschosswechsel bleibt #fp-wrap selbst
      // stehen. Ist er das native Fullscreen-Element, würde outerHTML/innerHTML
      // am Host den Vollbildmodus sofort beenden. Nur seine Kinder werden aus
      // der neu berechneten Ansicht übernommen; floorId/spaceId/colorMode sind
      // weiterhin die einzige Zustandsquelle.
      const template = document.createElement('template');
      template.innerHTML = floorplanView();
      const nextWrap = template.content.querySelector('#fp-wrap');
      currentWrap.replaceChildren(...nextWrap.childNodes);
    } else {
      // Wechsel zwischen Geschosstabelle und Plan. In diesem Fall existiert
      // kein stabiler Betrachter, den es zu erhalten gäbe.
      host.innerHTML = grundrissBodyHtml();
    }
    wireGrundriss();
  }

  // Kopf verdrahten: jede Mosaikkachel öffnet die Vollbildgalerie bei ihrem
  // eigenen Bild, und die Standortkarte bekommt einen Punkt auf das Objekt.
  // Koordinaten stehen im Mietverhältnis — kein Zugriff auf den Gebäudebestand.
  const heroMap = createMapSlot();
  async function wireHero() {
    // Derselbe klassenbasierte Galerie-Vertrag wie Portfolio und Workspace;
    // die app-eigene id bleibt nur ein stabiler Test-/Kartenanker.
    wireHeroMosaic(mount, openGallery, galleryItems, C);
    restoreGalleryFromQuery(query, galleryItems, C);
    const el = mount.querySelector('#mt-hero-map');
    if (!el || !Number.isFinite(t.lat) || !Number.isFinite(t.lon)) { heroMap.free(); return; }
    await heroMap.mount(el, (node) => initEstateMap(node,
      [{ lat: t.lat, lon: t.lon, label: t.buildingName, sub: `${t.street}, ${t.zip} ${t.city}`, bblId: t.tenancyId }],
      { type: 'FeatureCollection', features: [] }, t.tenancyId, { focusPopup: false }));
  }

  // Datentabellen in ihre Montagepunkte hängen. Alle Reiterpanels liegen im
  // DOM (inaktive sind `hidden`), deshalb werden alle drei gemountet — sonst
  // stünde beim Reiterwechsel ein leerer Kasten da.
  const detachTables = new Map();
  function unmountTable(hostId) {
    const off = detachTables.get(hostId);
    if (off) { try { off(); } catch { /* schon abgebaut */ } }
    detachTables.delete(hostId);
  }
  function mountTable(hostId, cfg) {
    unmountTable(hostId);
    const host = mount.querySelector('#' + hostId);
    if (host && cfg) detachTables.set(hostId, C.mountDataTable(host, cfg) || (() => {}));
  }
  function mountTables() {
    const cfgs = dataTables();
    for (const [hostId, cfg] of Object.entries(cfgs)) {
      mountTable(hostId, cfg);
    }
  }

  let detach = null;
  function wireGrundriss({ mountAllTables: allTables = false } = {}) {
    if (detach) { detach(); detach = null; }
    // draw() montiert alle Tabellen genau einmal. Bei partiellen
    // Grundriss-Neuzeichnungen wird ausschliesslich die allenfalls neu
    // entstandene Geschosstabelle montiert; die versteckten Vertrags- und
    // Vorgangstabellen behalten Zustand, Beobachter und genau einen Handler.
    if (allTables) mountTables();
    else mountTable('mt-dt-floors', dataTables()['mt-dt-floors']);
    // Rücksprung aus dem Betrachter in die Geschossübersicht.
    mount.querySelector('#fp-zurueck')?.addEventListener('click', (e) => {
      e.preventDefault();
      // Erst das Vollbild verlassen: sonst stünde die Geschosstabelle im
      // Vollbild-Element, das gleich darauf aus dem DOM ersetzt wird.
      if (document.fullscreenElement) document.exitFullscreen?.();
      floorId = ''; spaceId = '';
      syncHash(); redrawGrundriss();
      mount.querySelector('#mt-dt-floors a')?.focus({ preventScroll: true });
    });
    const stage = mount.querySelector('#fp-stage');
    if (!stage) return;
    detach = wireFloorplan(stage, (sid) => {
      spaceId = spaceId === sid ? '' : sid;      // erneuter Klick hebt die Auswahl auf
      syncHash();
      redrawGrundriss();
      // Fokus zurück auf denselben Raum, auch wenn der zweite Klick seine
      // Auswahl gerade aufgehoben hat. `spaceId` ist dann leer, `sid` bleibt
      // aber die Identität des ersetzten Controls.
      mount.querySelector(`[data-space="${CSS.escape(sid)}"] rect`)?.focus({ preventScroll: true });
    });
    mount.querySelector('#fp-color')?.addEventListener('change', (e) => {
      colorMode = e.target.value; syncHash(); redrawGrundriss();
      mount.querySelector('#fp-color')?.focus();
    });
    mount.querySelectorAll('[data-floor]').forEach((el) => el.addEventListener('click', (e) => {
      e.preventDefault();
      // Erneuter Klick auf das aktive Geschoss ist ein Leerlauf (Review
      // badges/tag-1): die aktive Pille ist per CSS zwar stillgelegt
      // (pointer-events:none), aber die Tastatur erreicht den Link weiterhin —
      // ohne die Wache zeichnete Enter den Plan grundlos neu.
      if (el.dataset.floor === floorId) return;
      floorId = el.dataset.floor; spaceId = '';
      syncHash(); redrawGrundriss();
      // Das angeklickte Element gehört zum ersetzten Teilbaum. Auf der neu
      // gezeichneten Geschoss-Pille weiterarbeiten statt Fokus zu verlieren.
      mount.querySelector(`[data-floor="${CSS.escape(floorId)}"]`)?.focus({ preventScroll: true });
    }));

    // Vollbild über die native Fullscreen-API auf `#fp-wrap` — also samt
    // Kopfleiste und Seitenpanel, nicht nur der Zeichnung. Dieselbe API, die
    // die Dashboard-Karte schon nutzt (js/charts.js:512). Esc beendet es vom
    // Browser aus; der Knopf schaltet in beide Richtungen.
    const wrap = mount.querySelector('#fp-wrap');
    const vollbild = mount.querySelector('#fp-vollbild');
    vollbild?.addEventListener('click', () => {
      if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
      wrap?.requestFullscreen?.().catch(() => { /* vom Browser abgelehnt — Ansicht bleibt inline */ });
    });

    // Drucken: `body.print--plan` blendet für die Dauer des Druckdialogs alles
    // ausser dem Plan aus (siehe @media print in css/app.css). Ohne die Marke
    // druckte der Browser die ganze Detailseite mitsamt Eckdaten und Anträgen.
    mount.querySelector('#fp-drucken')?.addEventListener('click', () => {
      document.body.classList.add('print--plan');
      const auf = () => { document.body.classList.remove('print--plan'); window.removeEventListener('afterprint', auf); };
      window.addEventListener('afterprint', auf);
      window.print();
      // Sicherheitsnetz: `afterprint` feuert nicht in jedem Browser zuverlässig.
      setTimeout(auf, 1000);
    });
  }

  onUnmount(() => {
    if (detach) detach();
    heroMap.free();
    detachTables.forEach((f) => { try { f(); } catch { /* egal */ } });
    detachTables.clear();
  });
  draw();
}
