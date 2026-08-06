// Liegenschaften Inventar — map-first real-estate portfolio explorer.
//
// Datenquelle: SAP-RE-FX-Golden-Record (core.buildings() + core.parcels()), dieselben
// bbl_id wie das Immobilienportfolio-Dashboard. Ein Objekt wird über ?id=<bbl_id>
// angesprochen (Query-Param, weil SAP-ids «/» enthalten). Aufbau: links ein räumlicher
// Baum (Land › Region › Stadt › Wirtschaftseinheit › Gebäude/Grundstück), rechts die
// Ansicht Karte (Default, geclustert) · Galerie · Liste. Siehe docs/portfolio-redesign.md.

import { openGallery } from '../gallery.js';
import { heroMosaic, galleryItemsFrom, wireHeroMosaic } from '../hero-mosaic.js';
import { initEstateMap } from '../buildings-map.js';
import { createMapSlot } from '../map-slot.js';
import { treeHTML, wireTree, restoreTreeSelection, markTree, syncTreeCounts } from '../spatial-tree.js';
import { num, m2, chf, datum, dateiGroesse } from '../format.js';
import { landName, weOf } from '../domain.js';
import { ANWENDUNGEN } from '../crumbs.js';
import * as links from '../links.js';

// Bildergalerie eines Objekts aus seiner kuratierten Auswahl `bilder` (direkt am
// Objekt in buildings.geojson / parcels.geojson). data/media.json wird NICHT
// gelesen — das Register bleibt der Mediathek vorbehalten. Erstes Bild = Hauptbild.
//
// Baut auf `galleryItemsFrom` (js/hero-mosaic.js) auf. Vorher stand hier eine
// eigene Fassung, der genau eine Zeile fehlte: die Quellenangabe. Folge war,
// dass der Bildnachweis im Metadatenpanel der Vollbildgalerie im Inventar
// fehlte, im Mietendenportal aber stand — bei Aufnahmen, die nicht frei
// lizenziert sind.
const bilderGalleryItems = (o) => galleryItemsFrom(o.bilder, {
  idPrefix: o.bbl_id, title: o.name, ort: o.city,
});

// Besitz und Abbau der Karte liegen im gemeinsamen Slot (js/map-slot.js);
// er trägt auch die Rennmarke gegen den asynchronen CDN-Ladevorgang.
const pfMap = createMapSlot();

// Sortierung der Ergebnisliste (Galerie/Liste; die Karte ist reihenfolgeunabhängig).
const nameCmp = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'de');
const SORTS = {
  name: nameCmp,
  area: (a, b) => (b.area || 0) - (a.area || 0) || nameCmp(a, b),
  status: (a, b) => String(a.status || '').localeCompare(String(b.status || ''), 'de') || nameCmp(a, b),
  land: (a, b) => landName(a.land).localeCompare(landName(b.land), 'de') || nameCmp(a, b),
};
const SORT_OPTIONS = [
  { value: 'name', label: 'Bezeichnung (A–Z)' },
  { value: 'area', label: 'Fläche (grösste zuerst)' },
  { value: 'status', label: 'Status' },
  { value: 'land', label: 'Land' },
];

const CRUMBS = ANWENDUNGEN;

// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
export const needs = ['areas', 'assets', 'buildingContacts', 'buildings', 'contracts', 'costs', 'documents', 'landcovers', 'parcels'];

export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs } = ctx;
  // Karte beim Verlassen der Route abbauen — sonst bleibt ein WebGL-Kontext je
  // Besuch stehen (Browser kappen bei ~16 und verwerfen die ältesten).
  ctx.onUnmount(pfMap.free);
  const detailId = (query && query.get('id')) || params[0];
  if (detailId) {
    const b = core.building(detailId);
    if (b) return buildingDetail(ctx, b);
    const p = core.parcel(detailId);
    if (p) return parcelDetail(ctx, p);
    pfMap.free();
    C.renderNotFound(ctx, { title: 'Objekt nicht gefunden',
      backHref: '#/app/portfolio', backLabel: 'Liegenschaften Inventar',
      crumbs: [...CRUMBS, { label: 'Liegenschaften Inventar', href: '#/app/portfolio' }],
      body: `Zu der ID «${C.escape(String(detailId))}» gibt es kein Gebäude und kein Grundstück. <a href="#/app/portfolio">Zur Übersicht «Liegenschaften Inventar»</a>` });
    return;
  }
  pfMap.free();
  setTitle('Liegenschaften Inventar');
  setCrumbs([...CRUMBS, { label: 'Liegenschaften Inventar' }]);

  const ref = core.ref();
  // Gebäude + Grundstücke als einheitliche Objektliste
  const objects = [
    ...core.buildings().map((b) => ({ kind: 'building', id: b.bbl_id, we: b.bbl_we || weOf(b.bbl_id), land: b.land, region: b.canton, city: b.city, name: b.name, cat: b.portfolioCategory, ownership: b.ownership, status: b.status, area: b.gf, lat: b.lat, lon: b.lng, photo: b.photo, photoSrc: b.photoSrc, street: b.street, zip: b.zip })),
    ...core.parcels().map((p) => ({ kind: 'parcel', id: p.bbl_id, we: p.bbl_we || weOf(p.bbl_id), land: p.land, region: p.canton, city: p.city, name: p.name, cat: p.zone || 'Grundstück', ownership: p.ownership, status: p.status, area: p.gsf, lat: p.lat, lon: p.lng, geom: p.geom, street: p.street, zip: p.zip })),
  ];

  // Zustand VOLLSTÄNDIG aus der URL lesen (Review url-state-1): eine kopierte
  // Adresse stellt Suche, Facetten, Baum-Auswahl, Sortierung und Seite wieder
  // her — dasselbe Modell wie die Mediathek (C.catalogueHash). Die Baum-Auswahl
  // steht als `land/region/city/we/obj` im Hash; `obj` statt `id`, weil `id`
  // oben für die Detailroute reserviert ist. `kind` hat als einzige Dimension
  // einen NICHT-leeren Default (nur Gebäude); «alle» kodiert deshalb die bewusst
  // geleerte Auswahl — sonst wäre sie von «Param fehlt» nicht zu unterscheiden.
  const csv = (k) => (query.get(k) || '').split(',').filter(Boolean);
  const kindParam = query.get('kind');
  const urlSel = {};
  for (const k of ['land', 'region', 'city', 'we']) if (query.get(k)) urlSel[k] = query.get(k);
  if (query.get('obj')) urlSel.id = query.get('obj');
  const state = {
    view: ['map', 'gallery', 'list'].includes(query.get('view')) ? query.get('view') : 'gallery',
    // Standard: NUR GEBÄUDE (Nutzerentscheid 2026-07-30) — Grundstücke blendet
    // man über die Objekttyp-Facette dazu oder entfernt die «Gebäude»-Pille.
    // `?kind=alle` kodiert die bewusst geleerte Auswahl (sonst wäre sie von
    // «Param fehlt» nicht zu unterscheiden); eine explizite Objektauswahl aus
    // Baum/Karte hebt den Typfilter auf, damit auch ein Grundstück erscheint.
    sel: urlSel, focus: urlSel.id || null, q: query.get('q') || '',
    sort: SORT_OPTIONS.some((o) => o.value === query.get('sort')) ? query.get('sort') : 'name',
    filters: {
      status: csv('status'), ownership: csv('ownership'),
      kind: kindParam == null ? ['building'] : (kindParam === 'alle' ? [] : csv('kind')),
    },
    page: Math.max(1, Number(query.get('page')) || 1),
    perPage: { gallery: 9, list: 25 },
  };

  // --- filtering --------------------------------------------------------------
  const inSel = (o) => (!state.sel.id || o.id === state.sel.id)
    && (!state.sel.land || o.land === state.sel.land) && (!state.sel.region || o.region === state.sel.region)
    && (!state.sel.city || o.city === state.sel.city) && (!state.sel.we || o.we === state.sel.we);
  const inFilters = (o) => (!state.filters.status.length || state.filters.status.includes(o.status))
    && (!state.filters.ownership.length || state.filters.ownership.includes(o.ownership))
    && (!state.filters.kind.length || state.filters.kind.includes(o.kind));
  const inSearch = (o) => { const q = state.q.trim().toLowerCase(); return !q || `${o.name} ${o.id} ${o.street} ${o.zip} ${o.city}`.toLowerCase().includes(q); };
  const filtered = () => objects.filter((o) => inSel(o) && inSearch(o) && (state.sel.id ? true : inFilters(o)));

  // --- spatial tree -----------------------------------------------------------
  const esc = C.escape;
  // SAP-Objekt-ID = drittes Segment der bbl_id (Gebäude: AA/AF …, Grundstück: 01/02 …).
  const objId = (o) => String(o.id).split('/')[2] || o.id;
  // Aufbau über den gemeinsamen Bauplan (js/spatial-tree.js) statt einer lokalen
  // Kopie (Design-Review A1). Länder sortieren sich über den ANGEZEIGTEN Namen
  // (label = landName), Regionen/Städte über ihren Wert — beides der Default.
  const treeMarkup = treeHTML(C, objects, {
    levels: [
      { key: 'land', icon: 'Globe', label: (v) => landName(v) },
      { key: 'region', icon: 'Map' },
      { key: 'city', icon: 'MapMarker' },
      // WE-Knoten: Code als Mono-Kennung, benannt nach dem ersten Gebäude der
      // WE; sortiert nach dem Code (roh, wie bisher), nicht nach dem Namen.
      { key: 'we', icon: 'Folder', idText: (v) => `WE ${v}`,
        label: (v, es) => ((es.find((x) => x.kind === 'building') || es[0] || {}).name || ''),
        sort: (a, b) => (a < b ? -1 : a > b ? 1 : 0) },
    ],
    // Blatt = Auswahl-Button (kein Detail-Link): filtert auf das Objekt und öffnet auf
    // der Karte sein Info-Popup. Das Detail öffnet man über Galerie/Liste oder das Popup.
    leaf: {
      icon: (o) => (o.kind === 'building' ? 'Building' : 'Crop'),
      idText: objId, label: (o) => o.name, objId: (o) => o.id,
      sort: (a, b) => a.kind.localeCompare(b.kind) || nameCmp(a, b),
    },
  });

  // --- views (renderMain slices the list + appends the CD pagination) ---------
  function pfCard(o) {
    const vis = o.kind === 'building'
      ? C.photo({ src: o.photoSrc, id: o.photo, color: 'var(--color-secondary-600)', alt: `${o.name}, ${o.city}`, w: 480, cls: 'pf-card__img' })
      : `<div class="pf-card__parcel">${C.icon('Crop', 'icon--2xl')}</div>`;
    // Land und Status — NICHT die Objektart: dass hier ein Grundstück steht,
    // sagt schon das Bild (Foto gegen schraffierte Parzelle) und die Einheit im
    // Fuss (GF gegen GSF). Als dritter Chip neben «Schweiz» und «in Betrieb»
    // las sich «Gebäude» wie ein Filterwert, den es so nicht gibt.
    const chips = [landName(o.land), o.status]
      .filter(Boolean).map((c) => `<span class="pf-card__land">${esc(c)}</span>`).join('');
    // C.card statt einer handgerollten Karte (Design-Review A11): Stretched-Link,
    // card--default und die Kennzeile (`idLine` → .pf-card__id) kommen aus der
    // einen Quelle. Eigen bleibt nur der Vis-Block (16:10-Foto bzw. Parzellen-
    // Schraffur samt Chips-Auflage), der als `media` hineingeht — die Klassen
    // .pf-card/__vis/__chips/__land/__id bleiben unverändert (test-gepinnt).
    return C.card({
      cls: 'pf-card',
      media: `<div class="pf-card__vis">${vis}<div class="pf-card__chips">${chips}</div></div>`,
      title: o.name, href: `#/app/portfolio?id=${encodeURIComponent(o.id)}`,
      idLine: o.id,
      desc: `${o.street}${o.city ? `, ${o.zip} ${o.city}` : ''}`,
      footer: `<span>${esc(o.cat)}</span><span>${m2(o.area)} <span class="muted">${o.kind === 'building' ? 'GF' : 'GSF'}</span></span>`,
    });
  }
  const galleryHTML = (slice) => `<div class="pf-gallery">${slice.map(pfCard).join('')}</div>`;
  // Compact table: Typ as an icon (no label/emoji), Ort merged with Land, GF/GSF unit — fits without a horizontal scrollbar.
  // `rowsClickable` wie in den übrigen Bestandslisten (Review tbl-8): die Zeile
  // folgt ihrem ersten Link (Bezeichnung); Tastatur/SR nutzen weiterhin den Link.
  const listHTML = (slice) => C.table({ zebra: true, rowsClickable: true, caption: 'Liegenschaften', columns: [
    { key: 'kind', label: 'Typ', render: (o) => `<span class="pf-typ" title="${o.kind === 'building' ? 'Gebäude' : 'Grundstück'}" aria-label="${o.kind === 'building' ? 'Gebäude' : 'Grundstück'}">${C.icon(o.kind === 'building' ? 'Building' : 'Crop', 'icon--base')}</span>` },
    { key: 'name', label: 'Bezeichnung', render: (o) => `<a href="#/app/portfolio?id=${encodeURIComponent(o.id)}">${esc(o.name)}</a><br><span class="small muted">${esc(o.id)}</span>` },
    { key: 'ort', label: 'Ort', render: (o) => `${esc(o.city)}<br><span class="small muted">${esc(landName(o.land))}</span>` },
    { key: 'cat', label: 'Kategorie', render: (o) => esc(o.cat) },
    { key: 'area', label: 'Fläche', align: 'right', render: (o) => `${m2(o.area)}<br><span class="small muted">${o.kind === 'building' ? 'GF' : 'GSF'}</span>` },
    { key: 'status', label: 'Status', render: (o) => statusBadge(C, ref, o.status) },
  ], rows: slice });
  async function mountMap(list, focus) {
    const el = mount.querySelector('#pf-map-el');
    if (!el) return;
    const points = list.filter((o) => o.kind === 'building' && Number.isFinite(o.lat) && Number.isFinite(o.lon))
      .map((o) => ({ lat: o.lat, lon: o.lon, label: o.name, bblId: o.id, sub: `${o.street}, ${o.zip} ${o.city}`.trim(), href: `#/app/portfolio?id=${encodeURIComponent(o.id)}` }));
    const parcels = { type: 'FeatureCollection', features: list.filter((o) => o.kind === 'parcel' && o.geom).map((o) => ({
      type: 'Feature', geometry: o.geom, properties: { label: o.name, sub: `${o.street}, ${o.zip} ${o.city}`.trim(), id: o.id, area: o.area, href: `#/app/portfolio?id=${encodeURIComponent(o.id)}` } })) };
    await pfMap.mount(el, (node) => initEstateMap(node, points, parcels, focus));
  }

  // Baumzahlen an Suche und Facetten angleichen — OHNE die Baumauswahl selbst
  // (js/spatial-tree.js erklärt, warum).
  const syncTree = () => syncTreeCounts(mount.querySelector(".pf-tree"),
    objects.filter((o) => inSearch(o) && inFilters(o)),
    (o) => [o.land, o.region, o.city, o.we], (o) => o.id);

  // Zustand → URL (Review url-state-1): ALLE Dimensionen serialisieren, nicht nur
  // die Ansicht — sonst reproduziert eine kopierte Adresse nicht die sichtbare
  // Treffermenge. Defaults bleiben aus der URL (kurz und teilbar, wie
  // C.catalogueHash); die Gegenrichtung (URL → state) steht oben bei der
  // state-Initialisierung. replaceState statt location.hash, damit der Router
  // die Seite nicht neu zeichnet (JS-State, kein Hash-Roundtrip).
  const syncHash = () => {
    const p = new URLSearchParams();
    if (state.q.trim()) p.set('q', state.q.trim());
    for (const k of ['land', 'region', 'city', 'we']) if (state.sel[k]) p.set(k, state.sel[k]);
    if (state.sel.id) p.set('obj', state.sel.id);
    if (state.filters.status.length) p.set('status', state.filters.status.join(','));
    if (state.filters.ownership.length) p.set('ownership', state.filters.ownership.join(','));
    // Nur bei Abweichung vom Default «nur Gebäude»; leer → Marke «alle» (s. oben).
    if (state.filters.kind.length !== 1 || state.filters.kind[0] !== 'building') {
      p.set('kind', state.filters.kind.length ? state.filters.kind.join(',') : 'alle');
    }
    if (state.sort !== 'name') p.set('sort', state.sort);
    if (state.page > 1) p.set('page', String(state.page));
    if (state.view !== 'gallery') p.set('view', state.view);
    const s = p.toString();
    try { history.replaceState(history.state, '', `#/app/portfolio${s ? `?${s}` : ''}`); } catch { /* nicht kritisch */ }
  };

  // --- partial render of the main pane ---------------------------------------
  function renderMain() {
    syncTree();
    const list = filtered().sort(SORTS[state.sort] || SORTS.name);
    const cnt = mount.querySelector('#pf-count');
    const main = mount.querySelector('#pf-main');
    let pages = 1;   // für Ansage + URL; geblättert wird nur in Galerie/Liste
    pfMap.free();
    if (state.view === 'map') {
      // Karte: nur die Anzahl (kein «von … · Seite …» — das ist nur für Galerie/Liste).
      if (cnt) cnt.innerHTML = `<strong>${list.length}</strong> ${list.length === 1 ? 'Objekt' : 'Objekte'}`;
      main.innerHTML = `<div class="pf-map dash-map" id="pf-map-el" role="group" aria-label="Karte der Liegenschaften"></div>`;
      mountMap(list, state.focus);
    } else if (!list.length) {
      // Dativ nach «von» (Review count-gram-1) — wie «… von N Mietverhältnissen».
      if (cnt) cnt.innerHTML = `<strong>0</strong> von ${objects.length} Objekten`;
      // Nullzustand mit Ausweg: der Knopf räumt Suche, Filter UND Baum-Auswahl
      // ab — derselbe volle Reset wie die Pille «Alle Filter zurücksetzen».
      main.innerHTML = C.empty('Keine Objekte gefunden.', {
        hint: 'Passen Sie Suche, Filter oder die Auswahl im Baum an.',
        action: { id: 'pf-empty-reset', label: 'Suche und Filter zurücksetzen' },
      });
      const rst = mount.querySelector('#pf-empty-reset');
      if (rst) rst.addEventListener('click', fullReset);
    } else {
      const per = state.perPage[state.view];
      pages = Math.max(1, Math.ceil(list.length / per));
      if (state.page > pages) state.page = pages;
      const slice = list.slice((state.page - 1) * per, state.page * per);
      // CD-Ergebniskopf: «N von M Objekten · Seite X von Y» (wie #/services).
      if (cnt) cnt.innerHTML = `<strong>${list.length}</strong> von ${objects.length} Objekten${pages > 1 ? ` · Seite ${state.page} von ${pages}` : ''}`;
      // Ohne href-Builder rendert C.pagination echte <button data-page> —
      // gebunden über C.wirePagination (Design-Review A3).
      main.innerHTML = (state.view === 'gallery' ? galleryHTML(slice) : listHTML(slice))
        + C.pagination({ page: state.page, totalPages: pages, inputId: 'pf-page' });
      if (pages > 1) C.wirePagination(mount, 'pf-page', state.page, pages, (t) => { state.page = t; renderMain(); });
    }
    mount.querySelectorAll('.view-switch__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    renderActiveFilters();
    // Treffer-Ansage für die Live-Region (Review announce-1) — wie Mediathek und
    // Mietendenportal; ohne sie blieben Suche/Filter/Baum für Screenreader stumm.
    C.announceCatalogue({ count: list.length, total: objects.length, unit: 'Objekten',
      page: state.page, totalPages: pages, view: state.view });
    syncHash();
  }

  // Active-Filter-Zeile (wie #/applications, C.activeFilters): Suche, Baum-Auswahl und
  // Panel-Filter als entfernbare Pillen — konsistent über Karte/Galerie/Liste.
  const kindLabel = (k) => (k === 'building' ? 'Gebäude' : 'Grundstück');
  function selPill() {
    const s = state.sel;
    if (!Object.keys(s).length) return null;
    const label = s.id ? ((objects.find((o) => o.id === s.id) || {}).name || s.id)
      : s.we ? `WE ${s.we}` : s.city || s.region || landName(s.land);
    return { label: `Auswahl: ${label}`, remove: 'sel' };
  }
  function renderActiveFilters() {
    const box = mount.querySelector('#pf-activefilters');
    if (!box) return;
    const pills = [];
    if (state.q.trim()) pills.push({ label: `Suche: «${state.q.trim()}»`, remove: 'q' });
    const sp = selPill(); if (sp) pills.push(sp);
    state.filters.status.forEach((v) => pills.push({ label: v, remove: `status:${v}` }));
    state.filters.ownership.forEach((v) => pills.push({ label: v, remove: `ownership:${v}` }));
    state.filters.kind.forEach((v) => pills.push({ label: kindLabel(v), remove: `kind:${v}` }));
    box.innerHTML = C.activeFilters({ filters: pills });
  }

  // --- chrome (once) ----------------------------------------------------------
  const statuses = [...new Set(objects.map((o) => o.status))].filter(Boolean);
  const owns = [...new Set(objects.map((o) => o.ownership))].filter(Boolean);
  // C.filterGroup statt einer eigenen Fassung: der lokale Nachbau wertete
  // `selected` nicht aus und vergab keine `id`. Folge war ein Panel, das seinem
  // eigenen Zustand widersprach — `state.filters.kind` steht auf `['building']`,
  // das Inventar öffnet also auf Gebäude gefiltert, die Checkbox «Gebäude»
  // rendert aber ungehakt. Ohne `id` konnte `C.preserveFocus` zudem den Fokus
  // nach dem Neuzeichnen nicht zurücksetzen.
  // `idPrefix` hält die Checkbox-ids dokumentweit eindeutig (Review a11y-dup-ids-1)
  // — die Detail-Tabellen prefixen über C.mountDataTable mit ihrer Tabellen-id.
  const fgroup = (dim, legend, opts) => C.filterGroup({
    dim, legend, options: opts, selected: state.filters[dim] || [], idPrefix: 'pf',
  });

  const filterPanel = `
      ${fgroup('status', 'Status', statuses.map((s) => ({ value: s, label: s })))}
      ${fgroup('ownership', 'Eigentumsverhältnis', owns.map((o) => ({ value: o, label: o })))}
      ${fgroup('kind', 'Objekttyp', [{ value: 'building', label: 'Gebäude' }, { value: 'parcel', label: 'Grundstück' }])}
      ${C.panelReset({ id: 'pf-freset' })}`;

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({ title: 'Liegenschaften Inventar', lead: 'Weltweites Immobilienportfolio des BBL — Gebäude und Grundstücke aus dem SAP-RE-FX-Stammdatenbestand.' })}
    ${C.catalogueBar({
      formId: 'pf-search', inputId: 'pf-q', searchLabel: 'Adresse, Objekt oder ID suchen',
      placeholder: 'Adresse, Objekt oder ID suchen…', q: state.q, countId: 'pf-count',
      sort: { id: 'pf-sort', value: state.sort, options: SORT_OPTIONS },
      filterId: 'pf-filter-btn', filterLabel: 'Filter', panelId: 'pf-filters', panel: filterPanel,
      view: state.view, views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List'], ['map', 'Kartenansicht', 'Map']],
    })}
    <div id="pf-activefilters"></div>
    <div class="pf-layout">
      <aside class="pf-sidebar" aria-label="Standorte">
        <div class="pf-sidebar__head"><h2 class="pf-sidebar__title">Standorte</h2>
          <button type="button" class="btn btn--bare btn--sm btn--icon-left" id="pf-clear" hidden>${C.icon('Cancel', 'btn__icon icon--base')}<span class="btn__text">Auswahl zurücksetzen</span></button></div>
        ${treeMarkup}
      </aside>
      <div class="pf-main" id="pf-main"></div>
    </div>
  </div>`;

  // --- wiring -----------------------------------------------------------------
  const sidebar = mount.querySelector('.pf-sidebar');
  const clearBtn = mount.querySelector('#pf-clear');
  // Auswahl setzen: Markierung und Auswahl-zurücksetzen-Knopf pflegt wireTree —
  // hier nur Zustand + Neuzeichnen. Blatt: focus = sel.id, damit die Karte das
  // Info-Popup des Objekts öffnet.
  const setSelection = (sel, focus) => {
    state.sel = sel; state.focus = focus || null;
    state.page = 1; renderMain();
  };
  // Auswahl von AUSSEN aufheben (Pille, Reset, Leerzustand): die Markierung im
  // Baum muss mit, sonst zeigte er eine Auswahl, die nicht mehr filtert.
  const clearSelection = () => {
    markTree(sidebar, null); clearBtn.hidden = true;
    setSelection({}, null);
  };
  // Voller Reset (Leerzustands-Knopf): Suche + Panel-Filter + Baum-Auswahl —
  // dasselbe wie die Pille [data-reset]. Funktionsdeklaration, weil renderMain
  // (oben) sie referenziert, bevor `cat` unten zugewiesen ist.
  function fullReset() {
    state.q = '';
    const qEl = mount.querySelector('#pf-q'); if (qEl) qEl.value = '';
    cat.clearFilters();
    clearSelection();
  }

  // Katalogleisten-Verdrahtung über den gemeinsamen Baustein (Design-Review A2):
  // Suche mit Tipp-Verzögerung, Sort, Ansichtswechsel, Filterpanel samt Badge,
  // Panel-Reset und Aktiv-Pillen in EINEM Aufruf statt der lokalen Kopie.
  const cat = C.wireCatalogueState(mount, {
    formId: 'pf-search', inputId: 'pf-q', sortId: 'pf-sort',
    filterToggleId: 'pf-filter-btn', panelId: 'pf-filters', resetId: 'pf-freset',
    activeFiltersId: 'pf-activefilters',
    state, onChange: renderMain,
    onRemove: (tok) => { if (tok === 'sel') clearSelection(); },   // die Baum-Pille
    // «Alle Filter zurücksetzen» räumt hier AUCH die Baum-Auswahl ab.
    onReset: clearSelection,
  });
  ctx.onUnmount(cat.destroy);

  wireTree(sidebar, { clearBtn, onSelect: (sel) => setSelection(sel, sel.id || null) });

  // Zeilenklick der Listenansicht (Review tbl-8): EINMAL auf dem beständigen
  // Container delegiert — renderMain tauscht nur dessen innerHTML, ein Aufruf je
  // Render würde Listener anhäufen.
  C.wireTableRows(mount.querySelector('#pf-main'));

  // Baum-Auswahl aus der URL wiederherstellen (Review url-state-1): Pfad
  // aufklappen + markieren. Die FILTERUNG wirkt über state.sel ohnehin — hier
  // geht es um die sichtbare Hervorhebung im Baum.
  restoreTreeSelection(sidebar, state.sel, { clearBtn });

  renderMain();
}

// ---------------------------------------------------------------------------
// Building detail (Phase 1 — tabs Übersicht / Bauprojekte / Dokumente / Medien).
// Phase 2 erweitert dies um Flächen, Ausstattung, Verträge, Kosten, Kontakte …
// ---------------------------------------------------------------------------
function buildingDetail(ctx, b) {
  const { mount, core, C, setTitle, setCrumbs, query } = ctx;
  pfMap.free();
  const ref = core.ref();
  setTitle(b.name);
  setCrumbs([...CRUMBS, { label: 'Liegenschaften Inventar', href: '#/app/portfolio' }, { label: b.name }]);

  const areas = core.areasForBuilding(b.bbl_id);
  const assets = core.assetsForBuilding(b.bbl_id);
  const contracts = core.contractsForBuilding(b.bbl_id);
  const costs = core.costsForBuilding(b.bbl_id);
  const contacts = core.buildingContactsFor(b.bbl_id);
  const documents = core.documentsForBuilding(b.bbl_id);
  const parcels = core.parcelsForBuilding(b.bbl_id);
  const regionLabel = [b.land, b.canton].filter(Boolean).join(' · ');
  // Bildergalerie (Modal auf dem Hero-Bild) aus der kuratierten Bildauswahl des Objekts.
  const galleryItems = bilderGalleryItems(b);

  const tabs = [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'flaechen', label: `Flächen (${areas.length})` },
    // Plural, weil eine Zahl danebensteht — siehe js/apps/tenancies.js.
    { id: 'ausstattung', label: `Ausstattungen (${assets.length})` },
    { id: 'vertraege', label: `Verträge (${contracts.length})` },
    { id: 'kosten', label: `Kosten (${costs.length})` },
    { id: 'dokumente', label: `Dokumente (${documents.length})` },
    { id: 'kontakte', label: `Kontakte (${contacts.length})` },
  ];
  // ?tab=-Deeplink (wie Bauprojekte und Mietende): ein geteilter Link öffnet
  // direkt den gemeinten Reiter; Unbekanntes fällt still auf die Übersicht zurück.
  let active = query.get('tab') || 'uebersicht';
  if (!tabs.some((t) => t.id === active)) active = 'uebersicht';

  // Randspalte wie im Mietendenportal: was kann ich hier auslösen, wen frage
  // ich. Beide Karten kommen aus `js/components.js`, damit die zwei
  // Objekt-Detailseiten nicht auseinanderlaufen.
  const asideHtml = () => {
    const dienst = (id, iconName, href) => {
      const s = core.service(id);
      return s ? { icon: iconName, label: s.title, href } : null;
    };
    const bq = `building=${encodeURIComponent(b.bbl_id)}`;
    const aktionen = [
      // «Stammdaten mutieren» steht zuerst: das ist die Aktion, für die man ein
      // Objekt im Inventar aufschlägt. Melde- und Nachschlagewege folgen.
      dienst('stammdaten-mutieren', 'FileCheckmark', `#/services/stammdaten-mutieren?${bq}`),
      dienst('stoerung-melden', 'Wrench', `#/app/fault-report?${bq}`),
      dienst('bautendokumentation-abrufen', 'File', `#/app/document-archive?${bq}`),
      { icon: 'Image', label: 'Aufnahmen in der Mediathek', href: `#/app/media-library?objekt=${encodeURIComponent(b.bbl_id)}` },
    ].filter(Boolean);
    return `<aside class="detail-layout__aside" aria-label="Aktionen und Ansprechpersonen">
      ${C.actionCard({ lead: 'Für dieses Objekt vorbelegt.', links: aktionen })}
      ${C.contactCard({ contacts: contacts.slice()
        .sort((x, y) => (y.isPrimary ? 1 : 0) - (x.isPrimary ? 1 : 0))
        .slice(0, 4)
        .map((c) => ({ label: c.role || c.organisation, name: c.name, email: c.email, phone: c.phone })) })}
    </aside>`;
  };

  function tabUebersicht() {
    return `<div class="detail-layout"><div>
      <h2 class="detail-section__title">Eckdaten</h2>
      <dl class="kv">
        <dt>BBL-ID</dt><dd>${C.escape(b.bbl_id)}</dd>
        <dt>Wirtschaftseinheit (WE)</dt><dd>${C.escape(b.bbl_we)}</dd>
        <dt>EGID</dt><dd>${C.escape(b.egid || '—')}</dd>
        <dt>Adresse</dt><dd>${C.escape(b.street)}, ${C.escape(b.zip)} ${C.escape(b.city)}</dd>
        <dt>Land / Region</dt><dd>${C.escape(regionLabel)}</dd>
        <dt>Portfolio-Kategorie</dt><dd>${C.escape(b.portfolioCategory)}</dd>
        <dt>Gebäudetyp</dt><dd>${C.escape(b.typ || '—')}</dd>
        <dt>Eigentumsverhältnis</dt><dd>${C.escape(b.ownership)}</dd>
        <dt>Baujahr</dt><dd>${C.escape(String(b.buildYear || '—'))}${
          b.renovationYear ? ` <span class="muted">· saniert ${C.escape(String(b.renovationYear))}</span>` : ''}</dd>
        ${b.architekt ? `<dt>Architektur</dt><dd>${C.escape(b.architekt)}</dd>` : ''}
        ${b.nutzer ? `<dt>Nutzer</dt><dd>${C.escape(b.nutzer)}</dd>` : ''}
        <dt>Geschossfläche (GF)</dt><dd>${m2(b.gf)}</dd>
        <dt>Hauptnutzfläche (HNF)</dt><dd>${m2(b.hnf)}</dd>
        ${b.erhaltung ? `<dt>Erhaltungsstrategie</dt><dd>${C.escape(b.erhaltung)}</dd>` : ''}
        ${b.heritage || b.kgsKat ? `<dt>Baudenkmal</dt><dd>${b.kgsKat
          ? `Ja — KGS-Kategorie ${C.escape(b.kgsKat)}${b.kgsNr ? `, Nr. ${C.escape(String(b.kgsNr))}` : ''}`
          : 'Ja'}</dd>` : ''}
        ${parcels.length ? `<dt>Grundstück${parcels.length > 1 ? 'e' : ''}</dt><dd>${parcels.map(pc => `<a href="#/app/portfolio?id=${encodeURIComponent(pc.bbl_id)}">${C.escape(pc.name)}</a>`).join(', ')}</dd>` : ''}
        <dt>Status</dt><dd>${statusBadge(C, ref, b.status)}</dd>
      </dl>
    </div>${asideHtml()}</div>`;
    // Kein Quellen- und kein Bildnachweis mehr unter der Tabelle: die Bildangaben
    // (Urheber, Copyright, Lizenz) stehen im Metadaten-Panel der Vollbildgalerie,
    // wo das Bild auch betrachtet wird. Die Attribution geht dadurch nicht
    // verloren — sie steht nur an der richtigen Stelle.
  }
  // Alle Detail-Tabellen folgen demselben Muster (Suche · Sortierung · Facetten ·
  // Paginierung) und werden darum über EINEN Baustein gerendert: C.mountDataTable.
  // Bei realen Gebäuden werden diese Listen — besonders Dokumente und Ausstattung —
  // sehr lang; vorher gab es weder Suche noch Paginierung.
  const uniqOpts = (arr, key) => [...new Set(arr.map((x) => x[key]).filter(Boolean))]
    .sort((a, z) => String(a).localeCompare(String(z), 'de'))
    .map((v) => ({ value: String(v), label: String(v) }));

  // Eine Facette ohne Optionen ist keine Facette: bei leerem Bestand fällt sie
  // weg, damit über der leeren Tabelle kein Filterknopf mit leerem Panel steht.
  const FACETS = (list) => list.filter((f) => (f.options || []).length);

  const DT = {
    flaechen: {
      id: 'pf-dt-flaechen', emptyMsg: 'Keine Flächen- oder Bemessungsdaten erfasst.', rows: areas, unit: 'Bemessungen', caption: 'Flächen und Bemessungen',
      searchKeys: ['type', 'accuracy', 'standard'], perPage: 10,
      sorts: [
        { value: 'type', label: 'Bemessungsart', cmp: (x, y) => String(x.type).localeCompare(String(y.type), 'de') },
        { value: 'value', label: 'Wert (grösste zuerst)', cmp: (x, y) => (Number(y.value) || 0) - (Number(x.value) || 0) },
      ],
      // `.filter`: bei leerem Bestand hat jede Facette null Optionen — ohne das
      // stünde über der leeren Tabelle ein Filterknopf mit leerem Panel.
      facets: FACETS([{ dim: 'standard', legend: 'Standard', options: uniqOpts(areas, 'standard'),
        match: (r, v) => v.includes(String(r.standard)) }]),
      columns: [
        { key: 'type', label: 'Bemessungsart', render: (a) => C.escape(a.type) },
        { key: 'value', label: 'Wert', align: 'right', render: (a) => `${num(a.value)} <span class="muted">${C.escape(a.unit || '')}</span>` },
        { key: 'accuracy', label: 'Genauigkeit', render: (a) => C.escape(a.accuracy || '—') },
        { key: 'standard', label: 'Standard', render: (a) => C.escape(a.standard || '—') },
        { key: 'validFrom', label: 'Gültig ab', render: (a) => datum(a.validFrom) },
      ],
    },
    ausstattung: {
      // Dativ nach «von» (unit { nom, dat }): «3 von 6 Ausstattungsobjekten».
      id: 'pf-dt-ausstattung', emptyMsg: 'Keine Ausstattung erfasst.', rows: assets,
      unit: { nom: 'Ausstattungsobjekte', dat: 'Ausstattungsobjekten' }, caption: 'Ausstattung',
      searchKeys: ['name', 'manufacturer', 'location', 'category'], perPage: 10,
      sorts: [
        { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (x, y) => String(x.name).localeCompare(String(y.name), 'de') },
        { value: 'year', label: 'Baujahr (neueste zuerst)', cmp: (x, y) => (Number(y.installationYear) || 0) - (Number(x.installationYear) || 0) },
      ],
      // `.filter`: bei leerem Bestand hat jede Facette null Optionen — ohne das
      // stünde über der leeren Tabelle ein Filterknopf mit leerem Panel.
      facets: FACETS([
        { dim: 'category', legend: 'Kategorie', options: uniqOpts(assets, 'category'), match: (r, v) => v.includes(String(r.category)) },
        { dim: 'status', legend: 'Status', options: uniqOpts(assets, 'status'), match: (r, v) => v.includes(String(r.status)) },
      ]),
      columns: [
        { key: 'name', label: 'Bezeichnung', render: (a) => `<strong>${C.escape(a.name)}</strong>` },
        { key: 'category', label: 'Kategorie', render: (a) => C.badge(a.category, 'blue') },
        { key: 'manufacturer', label: 'Hersteller', render: (a) => C.escape(a.manufacturer || '—') },
        { key: 'installationYear', label: 'Baujahr', align: 'right', render: (a) => C.escape(String(a.installationYear || '—')) },
        { key: 'location', label: 'Standort', render: (a) => C.escape(a.location || '—') },
        { key: 'status', label: 'Status', render: (a) => C.badge(a.status, a.status === 'In Betrieb' ? 'success' : 'gray') },
      ],
    },
    vertraege: {
      // Dativ nach «von» (unit { nom, dat }): «3 von 6 Verträgen».
      id: 'pf-dt-vertraege', emptyMsg: 'Keine Verträge erfasst.', rows: contracts,
      unit: { nom: 'Verträge', dat: 'Verträgen' }, caption: 'Verträge',
      searchKeys: ['type', 'contractPartner'], perPage: 10,
      sorts: [
        { value: 'type', label: 'Vertragsart', cmp: (x, y) => String(x.type).localeCompare(String(y.type), 'de') },
        { value: 'amount', label: 'Betrag (grösste zuerst)', cmp: (x, y) => (Number(y.amount) || 0) - (Number(x.amount) || 0) },
        { value: 'from', label: 'Beginn (neueste zuerst)', cmp: (x, y) => String(y.validFrom || '').localeCompare(String(x.validFrom || '')) },
      ],
      // `.filter`: bei leerem Bestand hat jede Facette null Optionen — ohne das
      // stünde über der leeren Tabelle ein Filterknopf mit leerem Panel.
      facets: FACETS([{ dim: 'status', legend: 'Status', options: uniqOpts(contracts, 'status'), match: (r, v) => v.includes(String(r.status)) }]),
      columns: [
        { key: 'type', label: 'Vertragsart', render: (c) => C.escape(c.type) },
        { key: 'contractPartner', label: 'Vertragspartner', render: (c) => C.escape(c.contractPartner || '—') },
        { key: 'laufzeit', label: 'Laufzeit', render: (c) => `${datum(c.validFrom)} – ${c.validUntil ? datum(c.validUntil) : 'unbefristet'}` },
        { key: 'amount', label: 'Betrag/Jahr', align: 'right', render: (c) => chf(c.amount, c.currency) },
        { key: 'status', label: 'Status', render: (c) => C.badge(c.status, CONTRACT_STATUS_VARIANT[c.status] || 'gray') },
      ],
    },
    kosten: {
      id: 'pf-dt-kosten', emptyMsg: 'Keine Kostendaten erfasst.', rows: costs, unit: 'Kostenpositionen', caption: 'Kosten',
      searchKeys: ['costGroup', 'costType', 'period'], perPage: 10,
      sorts: [
        { value: 'group', label: 'Kostengruppe', cmp: (x, y) => String(x.costGroup).localeCompare(String(y.costGroup), 'de') },
        { value: 'amount', label: 'Betrag (grösste zuerst)', cmp: (x, y) => (Number(y.amount) || 0) - (Number(x.amount) || 0) },
      ],
      // `.filter`: bei leerem Bestand hat jede Facette null Optionen — ohne das
      // stünde über der leeren Tabelle ein Filterknopf mit leerem Panel.
      facets: FACETS([{ dim: 'costGroup', legend: 'Kostengruppe', options: uniqOpts(costs, 'costGroup'), match: (r, v) => v.includes(String(r.costGroup)) }]),
      columns: [
        { key: 'costGroup', label: 'Kostengruppe', render: (c) => C.escape(c.costGroup) },
        { key: 'costType', label: 'Kostenart', render: (c) => C.escape(c.costType) },
        { key: 'amount', label: 'Betrag', align: 'right', render: (c) => chf(c.amount, c.currency) },
        { key: 'period', label: 'Periode', render: (c) => C.escape(c.period || '—') },
        { key: 'referenceDate', label: 'Stichtag', render: (c) => datum(c.referenceDate) },
      ],
      // Summe der GEFILTERTEN Menge, nicht der Gesamtmenge — sonst widerspricht
      // der Fuss der sichtbaren Auswahl.
      foot: (visible, filtered) => {
        const cur = (filtered[0] || {}).currency || 'CHF';
        const sum = filtered.reduce((s, c) => s + (Number(c.amount) || 0), 0);
        // «Total (4)» statt einer zweiten Zelle «4 Positionen · jährlich»: die
        // Anzahl gehört zur Beschriftung, und die Periode steht bereits in jeder
        // Zeile der Spalte «Periode». Keine Klasse und kein <strong> (Review
        // tbl-4): CDs tfoot-Regeln in app.css tragen die 2px-Ränder selbst,
        // fett ist dort nur die th-Zelle — die td bleibt regular.
        return `<tr><th scope="row" class="text-left">Total (${filtered.length})</th><td></td><td class="text-right">${chf(sum, cur)}</td><td colspan="2"></td></tr>`;
      },
    },
    kontakte: {
      // «erfasst», nicht «hinterlegt» (Sprach-Kanon: hinterlegt nur für
      // Angehängtes); Dativ nach «von»: «3 von 6 Kontakten».
      id: 'pf-dt-kontakte', emptyMsg: 'Keine Kontakte erfasst.', rows: contacts.slice().sort((a, c) => (c.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || String(a.name).localeCompare(String(c.name), 'de')),
      unit: { nom: 'Kontakte', dat: 'Kontakten' }, caption: 'Kontakte',
      searchKeys: ['name', 'role', 'organisation', 'email'], perPage: 10,
      sorts: [
        { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (x, y) => String(x.name).localeCompare(String(y.name), 'de') },
        { value: 'role', label: 'Rolle', cmp: (x, y) => String(x.role || '').localeCompare(String(y.role || ''), 'de') },
      ],
      columns: [
        { key: 'name', label: 'Name', render: (c) => `<strong>${C.escape(c.name)}</strong>${c.isPrimary ? ' ' + C.badge('Primär', 'info') : ''}` },
        { key: 'role', label: 'Rolle', render: (c) => C.escape(c.role || '—') },
        { key: 'organisation', label: 'Organisation', render: (c) => C.escape(c.organisation || '—') },
        { key: 'phone', label: 'Telefon', render: (c) => c.phone ? `<a href="tel:${C.escape(String(c.phone).replace(/\s/g, ''))}">${C.escape(c.phone)}</a>` : '—' },
        { key: 'email', label: 'E-Mail', render: (c) => c.email ? `<a href="mailto:${C.escape(c.email)}">${C.escape(c.email)}</a>` : '—' },
      ],
    },
    // Dokumente war eine handgebaute Zeilenliste — jetzt dieselbe Tabelle wie die
    // übrigen Reiter (Wunsch: bei realen Gebäuden sehr lang).
    dokumente: {
      // Dativ nach «von» (unit { nom, dat }): «3 von 6 Dokumenten».
      id: 'pf-dt-dokumente', emptyMsg: 'Keine Dokumente erfasst.', rows: documents,
      unit: { nom: 'Dokumente', dat: 'Dokumenten' }, caption: 'Dokumente',
      searchKeys: ['title', 'type', 'format'], perPage: 10,
      sorts: [
        { value: 'title', label: 'Titel (A–Z)', cmp: (x, y) => String(x.title).localeCompare(String(y.title), 'de') },
        { value: 'year', label: 'Jahr (neueste zuerst)', cmp: (x, y) => (Number(y.year) || 0) - (Number(x.year) || 0) },
        { value: 'size', label: 'Grösse (grösste zuerst)', cmp: (x, y) => (Number(y.sizeKB) || 0) - (Number(x.sizeKB) || 0) },
      ],
      // `.filter`: bei leerem Bestand hat jede Facette null Optionen — ohne das
      // stünde über der leeren Tabelle ein Filterknopf mit leerem Panel.
      facets: FACETS([
        { dim: 'type', legend: 'Dokumenttyp', options: uniqOpts(documents, 'type'), match: (r, v) => v.includes(String(r.type)) },
        { dim: 'classification', legend: 'Klassifizierung', options: uniqOpts(documents, 'classification'), match: (r, v) => v.includes(String(r.classification)) },
      ]),
      columns: [
        { key: 'title', label: 'Titel', render: (d) => `${C.icon('File', 'icon--base')} <strong>${C.escape(d.title)}</strong>` },
        { key: 'type', label: 'Typ', render: (d) => C.escape(d.type) },
        { key: 'format', label: 'Format', render: (d) => C.escape(d.format) },
        { key: 'sizeKB', label: 'Grösse', align: 'right', render: (d) => C.escape(dateiGroesse(d.sizeKB)) },
        { key: 'year', label: 'Jahr', align: 'right', render: (d) => C.escape(String(d.year)) },
        { key: 'classification', label: 'Klassifizierung', render: (d) => classBadge(C, ref, d.classification) },
        { key: 'url', label: 'Aktion', render: (d) => `<a class="btn btn--outline btn--sm btn--icon-left" href="${C.escape(d.url || '#')}">${C.icon('Download', 'btn__icon icon--base')}<span class="btn__text">Herunterladen</span></a>` },
      ],
    },
  };

  // Panel-Inhalt: IMMER der Montagepunkt. Der Leerzustand steckt in der Tabelle
  // selbst (C.mountDataTable → emptyMsg): Kopfzeile und Spalten bleiben stehen,
  // darunter eine Zeile, die sagt, warum nichts da ist. Ein C.empty()-Kasten an
  // Stelle der Tabelle liess dagegen offen, WAS hier stünde — und die Reiter
  // sprangen beim Wechsel zwischen leer und gefüllt in der Höhe.
  const dtPanel = (key, after = '') => `<div id="${DT[key].id}"></div>${after}`;
  // Kanonische Knopf-Anatomie (Review btn-2): Label in .btn__text, Icon als
  // .btn__icon mit btn--icon-right — ohne den Wrapper fehlen dem Label die
  // py-2-Rhythmik und der Umbruchschutz (overflow-wrap:anywhere) des CD.
  const archiveLink = `<p class="mt-6"><a class="btn btn--link btn--icon-right" href="#/app/document-archive?building=${encodeURIComponent(b.bbl_id)}">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">In der Bauwerksdokumentation öffnen</span></a></p>`;

  const tabFlaechen = () => dtPanel('flaechen');
  const tabAusstattung = () => dtPanel('ausstattung');
  const tabVertraege = () => dtPanel('vertraege');
  const tabKosten = () => dtPanel('kosten');
  const tabKontakte = () => dtPanel('kontakte');
  const tabDokumente = () => dtPanel('dokumente', archiveLink);
  const panels = { uebersicht: tabUebersicht, flaechen: tabFlaechen, ausstattung: tabAusstattung, vertraege: tabVertraege, kosten: tabKosten, dokumente: tabDokumente, kontakte: tabKontakte };
  const panelHtml = (id) => (panels[id] || tabUebersicht)();

  mount.innerHTML = `
  <div class="container section">
    ${/* detailBar statt backLink (Review share-1): Zurück + Teilen-Leiste in
          einer Zeile — der CD-Detailseitenkopf, wie ihn die Mediathek trägt. */''}
    ${C.detailBar({ backHref: '#/app/portfolio', backLabel: 'Liegenschaften Inventar' })}
    <h1 tabindex="-1">${C.escape(b.name)}</h1>
    <p class="lead">${C.escape(b.street)}, ${C.escape(b.zip)} ${C.escape(b.city)} · ${C.escape(b.portfolioCategory)}</p>
    ${/* Detail-Hero (Bildmosaik + Standortkarte) aus js/hero-mosaic.js — das
          Mietendenportal zeigt dieselben Objekte aus Mietersicht und nutzt
          denselben Kopf. */''}
    ${heroMosaic(C, { id: 'pf-mosaic', items: galleryItems, mapId: 'pf-hero-map', lat: b.lat, lon: b.lng, mapLabel: `Standort von ${b.name} auf der Karte` })}
    ${/* Die Randspalte liegt IM Übersichtspanel, nicht neben der Reiterfläche.
          Zwischenzeitlich stand sie aussen, damit die klebende Spalte mehr Weg
          bekommt — das war der falsche Tausch: die Reiterleiste schrumpfte
          dadurch von 1329 auf 929px und fluchtete nicht mehr mit dem Hero
          darüber, und gebracht hat es nichts, weil das Übersichtspanel hier
          (589px) ohnehin niedriger ist als die Randspalte selbst (771px).
          Auf den übrigen Reitern will eine siebenspaltige Tabelle die volle
          Breite, nicht eine Randspalte daneben. */''}
    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active, idPrefix: 'pf-tab', ariaLabel: 'Gebäudedetails' })}
      ${C.tabPanels({ items: tabs, active, idPrefix: 'pf-tab', render: panelHtml, heading: true })}
    </div>
  </div>`;
  // Reiterwechsel in die URL spiegeln (?tab=), damit die Ansicht teilbar bleibt;
  // replaceState, weil ein reiner Zustandswechsel keinen Verlaufseintrag verdient.
  C.wireTabs(mount, { syncHash: (tab) => {
    const sp = new URLSearchParams({ id: b.bbl_id });
    if (tab !== 'uebersicht') sp.set('tab', tab);
    history.replaceState(history.state, '', `#/app/portfolio?${sp}`);
  } });
  // Jede Detail-Tabelle in ihren Montagepunkt hängen. Alle Panels liegen bereits
  // im DOM (Mehr-Panel-Muster), inaktive sind `hidden`; wireScrollRegions beobachtet
  // die Grösse, sodass der Scroll-Hinweis beim Sichtbarwerden nachgezogen wird.
  Object.values(DT).filter(Boolean).forEach((cfg) => {
    const host = mount.querySelector('#' + cfg.id);
    if (host) C.mountDataTable(host, cfg);
  });
  // Jede Mosaik-Kachel öffnet die Galerie bei ihrem eigenen Bild.
  wireHeroMosaic(mount, openGallery, galleryItems, C);
  // Standortkarte im Hero: ein Punkt, auf das Objekt zentriert. Bisher hatte die
  // Gebäude-Detailansicht überhaupt keine Karte — die Lage stand nur als Adresse.
  const bMapEl = mount.querySelector('#pf-hero-map');
  if (bMapEl && Number.isFinite(b.lat) && Number.isFinite(b.lng)) {
    pfMap.mount(bMapEl, (node) => initEstateMap(node, [{ lat: b.lat, lon: b.lng, label: b.name, bblId: b.bbl_id,
      sub: `${b.street}, ${b.zip} ${b.city}`.trim() }], null, b.bbl_id, { focusPopup: false }));
  } else if (bMapEl) {
    bMapEl.innerHTML = `<div class="empty empty--unavailable h-full">
      <span>Für dieses Objekt sind keine Koordinaten erfasst.</span></div>`;
  }
  // KEIN eigenes scrollTo/Fokussieren: Scroll und Fokus gehören dem Router —
  // siehe js/apps/tenancies.js (Nutzerbefund 2026-07-30).
}

// ---------------------------------------------------------------------------
// Parcel detail (Phase 1 — simple key-value; Phase 2 adds tabs + polygon mini-map).
// ---------------------------------------------------------------------------
function parcelDetail(ctx, p) {
  const { mount, core, C, setTitle, setCrumbs, query } = ctx;
  pfMap.free();
  const ref = core.ref();
  const we = p.bbl_we || weOf(p.bbl_id);
  const bld = core.buildings().find((b) => (b.bbl_we || weOf(b.bbl_id)) === we);
  const covers = core.landcoversForParcel(p.bbl_id);
  // Bildergalerie aus der kuratierten Bildauswahl des Grundstücks (bilder am Objekt).
  const galleryItems = bilderGalleryItems(p);
  setTitle(p.name);
  setCrumbs([...CRUMBS, { label: 'Liegenschaften Inventar', href: '#/app/portfolio' }, { label: p.name }]);

  const tabs = [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'bodenbedeckung', label: `Bodenbedeckungen (${covers.length})` },
  ];
  // ?tab=-Deeplink wie beim Gebäudedetail: Unbekanntes fällt auf die Übersicht zurück.
  let active = query.get('tab') || 'uebersicht';
  if (!tabs.some((t) => t.id === active)) active = 'uebersicht';
  function tabUebersicht() {
    return `<h2 class="detail-section__title">Eckdaten</h2>
    <dl class="kv">
      <dt>Parzellen-ID</dt><dd>${C.escape(p.bbl_id)}</dd>
      <dt>Wirtschaftseinheit (WE)</dt><dd>${C.escape(p.bbl_we)}</dd>
      <dt>Parzellen-Nr.</dt><dd>${C.escape(p.plotNumber || '—')}</dd>
      <dt>EGRID</dt><dd>${C.escape(p.egrid || '—')}</dd>
      <dt>Gemeinde</dt><dd>${C.escape(p.gemeinde || p.city)}</dd>
      <dt>Land / Region</dt><dd>${C.escape([p.land, p.canton].filter(Boolean).join(' · '))}</dd>
      <dt>Grundstücksfläche (GSF)</dt><dd>${m2(p.gsf)}</dd>
      <dt>Nutzungszone</dt><dd>${C.escape(p.zone || '—')}</dd>
      <dt>Eigentumsverhältnis</dt><dd>${C.escape(p.ownership)}</dd>
      <dt>Status</dt><dd>${statusBadge(C, ref, p.status)}</dd>
      ${bld ? `<dt>Gebäude auf der Parzelle</dt><dd><a href="#/app/portfolio?id=${encodeURIComponent(bld.bbl_id)}">${C.escape(bld.name)}</a></dd>` : ''}
    </dl>`;
  }
  function tabBoden() {
    // Auch ohne Daten die Tabelle mit Kopfzeile (wie die Register des
    // Gebäudedetails); nur die Summenzeile darüber entfällt, weil sie ohne
    // Bedeckungen nichts zu summieren hat.
    const total = covers.reduce((s, c) => s + (Number(c.area) || 0), 0);
    return `${covers.length ? `<p class="lead mt-0">Bedeckte Fläche total: <strong>${m2(total)}</strong> <span class="small muted">(${covers.length} Bedeckungen)</span></p>` : ''}
      ${C.table({ zebra: true, caption: 'Bodenbedeckung (amtliche Vermessung)',
        emptyText: 'Keine Bodenbedeckungsdaten (amtliche Vermessung) erfasst.', columns: [
        { key: 'type', label: 'Bodenbedeckungsart', render: (c) => C.escape(c.type) },
        { key: 'area', label: 'Fläche', render: (c) => `${m2(c.area)}` },
        { key: 'status', label: 'AV-Status', render: (c) => C.escape(c.status || '—') },
        { key: 'egrid', label: 'EGRID', render: (c) => `<span class="small">${C.escape(c.egrid || '—')}</span>` },
      ], rows: covers.slice().sort((a, c) => (c.area || 0) - (a.area || 0)) })}`;
  }
  const panelHtml = (id) => id === 'bodenbedeckung' ? tabBoden() : tabUebersicht();

  mount.innerHTML = `
  <div class="container section">
    ${/* detailBar statt backLink (Review share-1) — wie beim Gebäudedetail. */''}
    ${C.detailBar({ backHref: '#/app/portfolio', backLabel: 'Liegenschaften Inventar' })}
    <h1 tabindex="-1">${C.escape(p.name)}</h1>
    <p class="lead">${C.escape(p.street)}, ${C.escape(p.zip)} ${C.escape(p.city)} · ${C.escape(p.zone || 'Grundstück')}</p>
    ${heroMosaic(C, { id: 'pf-mosaic', items: galleryItems, mapId: 'pf-parcel-map', lat: p.lat, lon: p.lng, mapLabel: `Bodenbedeckung von ${p.name} auf der Karte` })}
    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active, idPrefix: 'pf-ptab', ariaLabel: 'Grundstücksdetails' })}
      ${C.tabPanels({ items: tabs, active, idPrefix: 'pf-ptab', render: panelHtml, heading: true })}
    </div>
  </div>`;
  // Reiterwechsel in die URL spiegeln (?tab=) — wie beim Gebäudedetail.
  C.wireTabs(mount, { syncHash: (tab) => {
    const sp = new URLSearchParams({ id: p.bbl_id });
    if (tab !== 'uebersicht') sp.set('tab', tab);
    history.replaceState(history.state, '', `#/app/portfolio?${sp}`);
  } });
  // Mini-Karte: die Bodenbedeckungs-Polygone (+ Parzelle) — Grundstücke haben kein
  // Foto, die Karte ist der räumliche «Hero». Fehler brechen die Seite nicht ab.
  const mapEl = mount.querySelector('#pf-parcel-map');
  if (mapEl) {
    const feats = covers.filter((c) => c.geom).map((c) => ({ type: 'Feature', geometry: c.geom, properties: { label: c.type, sub: `${m2(c.area)}`, id: p.bbl_id } }));
    if (p.geom) feats.push({ type: 'Feature', geometry: p.geom, properties: { label: p.name, sub: 'Parzelle', id: p.bbl_id } });
    pfMap.mount(mapEl, (node) => initEstateMap(node, [], { type: 'FeatureCollection', features: feats }, p.bbl_id, { focusPopup: false }));
  }
  // Gleiche Galerie-Verdrahtung wie beim Gebäude — sie fehlte hier ganz, weil das
  // Grundstück bisher gar keine Bilder zeigte.
  wireHeroMosaic(mount, openGallery, galleryItems, C);
  // KEIN eigenes scrollTo/Fokussieren: Scroll und Fokus gehören dem Router —
  // siehe js/apps/tenancies.js (Nutzerbefund 2026-07-30).
}

// ---------------------------------------------------------------------------
const BUILDING_STATUS_VARIANT = { Aktiv: 'success', Abgang: 'warning', 'Löschvermerk': 'gray' };
const CONTRACT_STATUS_VARIANT = { Aktiv: 'success', Ausgelaufen: 'gray', 'Gekündigt': 'warning' };
function statusBadge(C, ref, statusId) { const m = (ref.buildingStatuses || []).find((s) => s.id === statusId); return C.badge(m ? m.label : statusId, BUILDING_STATUS_VARIANT[statusId] || 'gray'); }
function classBadge(C, ref, clsId) { const m = (ref.classificationTiers || []).find((t) => t.id === clsId); return C.badge(m ? m.label : clsId, m ? m.variant : 'gray'); }

// Der Detail-Hero (Bildmosaik + Karte) wohnt in js/hero-mosaic.js, die
// Vollbild-Galerie in js/gallery.js — beides teilen sich Inventar, Mietenden-
// portal und Mediathek; die Entwurfsentscheide sind DORT dokumentiert.
