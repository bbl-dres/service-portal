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
import { heroMosaic, galleryItemsFrom } from '../hero-mosaic.js';
import { openGallery } from '../gallery.js';

// Ländercode → Name. Alle erfassten Mietverhältnisse liegen in der Schweiz;
// die Tabelle steht trotzdem hier, weil der Baum die Stufe «Land» führt und
// Auslandvertretungen im Portfolio des Bundes vorkommen.
const LAND = { CH: 'Schweiz', DE: 'Deutschland', US: 'USA', JP: 'Japan', BR: 'Brasilien', AU: 'Australien' };
const landName = (l) => LAND[l] || l || '—';

export const needs = ['tenancies', 'floors', 'spaces', 'contracts'];

const CRUMBS = [
  { label: 'Startseite', href: '#/' },
  { label: 'Daten und Digitalisierung', href: '#/data' },
  { label: 'Anwendungen', href: '#/applications' },
];

const chf = (x) => 'CHF ' + Number(x || 0).toLocaleString('de-CH');
const m2 = (x) => Number(x || 0).toLocaleString('de-CH') + ' m²';
const datum = (iso) => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? String(iso) : d.toLocaleDateString('de-CH'); };
// Restlaufzeit in Monaten — die Zahl, auf die Mietende zuerst schauen.
const monateBis = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return Math.max(0, Math.round((d - new Date()) / (30.44 * 86400000)));
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
let mtMap = null;
function freeMtMap() { if (mtMap) { try { mtMap.remove(); } catch { /* schon weg */ } mtMap = null; } }

function overview(ctx) {
  const { mount, core, C, setTitle, setCrumbs, onUnmount } = ctx;
  freeMtMap();
  onUnmount(freeMtMap);
  setTitle('Mietende');
  setCrumbs([...CRUMBS, { label: 'Mietende' }]);

  const all = core.tenancies();
  const esc = (s) => C.escape(String(s == null ? '' : s));

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

  const state = {
    view: 'gallery', q: '', sort: 'end', page: 1, perPage: { gallery: 9, list: 25 },
    filters: { ve: [] }, sel: {},
  };

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
  // Land › Kanton › Ort › Mietverhältnis. Alle vier Stufen stehen als Attribute
  // im Mietverhältnis (data/tenancies.json) — der Baum entsteht ohne einen
  // einzigen Zugriff auf den Gebäudebestand.
  function buildTree() {
    const tree = {};
    for (const t of all) {
      const L = (tree[t.land] = tree[t.land] || { n: 0, r: {} });
      const R = (L.r[t.canton] = L.r[t.canton] || { n: 0, c: {} });
      const C2 = (R.c[t.city] = R.c[t.city] || { n: 0, o: [] });
      C2.o.push(t); L.n++; R.n++; C2.n++;
    }
    return tree;
  }
  const rowContent = (ic, idText, label) => `${C.icon(ic, 'pf-tree__ico')}${
    idText ? `<span class="pf-tree__id">${esc(idText)}</span>` : ''}<span class="pf-tree__label">${esc(label)}</span>`;
  const node = (content, count, attrs, children) => `<li class="pf-tree__item">
      <button type="button" class="pf-tree__node" ${attrs} aria-expanded="false">
        ${C.icon('ChevronRight', 'pf-tree__chev')}${content}<span class="pf-tree__n">${count}</span>
      </button>
      <ul class="pf-tree__children" hidden>${children}</ul></li>`;
  const leaf = (t) => `<li class="pf-tree__item"><button type="button" class="pf-tree__leaf"
      data-obj="${esc(t.tenancyId)}" data-land="${esc(t.land)}" data-region="${esc(t.canton)}" data-city="${esc(t.city)}"
      >${rowContent('Home', t.ve, t.buildingName)}</button></li>`;

  function treeHTML() {
    const tree = buildTree();
    const byDe = (a, b) => a.localeCompare(b, 'de');
    // Nach dem ANGEZEIGTEN Namen sortieren, nicht nach dem Ländercode: sonst
    // steht «Schweiz» (CH) zwischen Brasilien und Deutschland.
    return `<ul class="pf-tree">${Object.keys(tree).sort((a, b) => byDe(landName(a), landName(b))).map((L) => {
      const land = tree[L];
      const regions = Object.keys(land.r).sort(byDe).map((R) => {
        const reg = land.r[R];
        const cities = Object.keys(reg.c).sort(byDe).map((Cy) => {
          const city = reg.c[Cy];
          const objs = city.o.slice().sort((a, b) => byDe(a.buildingName, b.buildingName)).map(leaf).join('');
          return node(rowContent('MapMarker', '', Cy), city.n,
            `data-land="${esc(L)}" data-region="${esc(R)}" data-city="${esc(Cy)}"`, objs);
        }).join('');
        return node(rowContent('Map', '', R), reg.n, `data-land="${esc(L)}" data-region="${esc(R)}"`, cities);
      }).join('');
      return node(rowContent('Globe', '', landName(L)), land.n, `data-land="${esc(L)}"`, regions);
    }).join('')}</ul>`;
  }

  /* ----------------------------------------------------------- Ansichten -- */
  const restBadge = (t) => {
    const m = monateBis(t.leaseEnd);
    if (m == null) return '';
    return C.badge(m < 24 ? `noch ${m} Monate` : `noch ${Math.floor(m / 12)} Jahre`,
      m <= 12 ? 'warning' : m <= 36 ? 'info' : 'success');
  };

  const card = (t) => C.card({
    title: t.buildingName,
    desc: `${t.veName} · ${t.department}`,
    href: `#/app/tenancies/${encodeURIComponent(t.tenancyId)}`,
    photo: { src: t.photoSrc, color: '#2f4356', alt: `${t.buildingName}, ${t.city}` },
    chips: [t.ve, t.floorLabels.join(' + ')],
    footerInfo: `${m2(t.areaHnf)} · ${t.workstations} AP`,
    footerAction: C.cardAction(),
  });
  const galleryHTML = (slice) => `<div class="pf-gallery">${slice.map(card).join('')}</div>`;

  const listHTML = (slice) => C.table({
    caption: 'Mietverhältnisse', zebra: true,
    columns: [
      { key: 'buildingName', label: 'Objekt', render: (t) => `<a href="#/app/tenancies/${encodeURIComponent(t.tenancyId)}">${esc(t.buildingName)}</a><br><span class="small muted">${esc(t.street)}, ${esc(t.zip)} ${esc(t.city)}</span>` },
      { key: 've', label: 'Verwaltungseinheit', render: (t) => `${esc(t.ve)}<br><span class="small muted">${esc(t.department)}</span>` },
      { key: 'floors', label: 'Geschosse', render: (t) => esc(t.floorLabels.join(', ')) },
      { key: 'areaHnf', label: 'Fläche', align: 'right', render: (t) => m2(t.areaHnf) },
      { key: 'workstations', label: 'AP', align: 'right', render: (t) => String(t.workstations) },
      { key: 'leaseEnd', label: 'Vertragsende', render: (t) => `${datum(t.leaseEnd)}<br>${restBadge(t)}` },
    ],
    rows: slice,
  });

  // Kartenpunkte kommen aus `lat`/`lon` DES MIETVERHÄLTNISSES — kein Zugriff
  // auf buildings.geojson. Zwei Mietverhältnisse im selben Haus liegen damit
  // exakt übereinander; das ist fachlich richtig (es ist dasselbe Objekt) und
  // die Bündelung der Karte fasst sie zusammen.
  let mapTicket = 0;
  async function mountMap(list) {
    const ticket = ++mapTicket;
    freeMtMap();
    const el = mount.querySelector('#mt-map-el');
    if (!el) return;
    const points = list.filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lon))
      .map((t) => ({ lat: t.lat, lon: t.lon, label: t.buildingName, bblId: t.tenancyId,
        sub: `${t.ve} · ${t.floorLabels.join(' + ')} · ${m2(t.areaHnf)}`,
        href: `#/app/tenancies/${encodeURIComponent(t.tenancyId)}` }));
    const created = await initEstateMap(el, points, { type: 'FeatureCollection', features: [] }, state.sel.id || null);
    // Überholt oder Container weg? Sofort abbauen statt zuweisen (Wettlauf-Schutz
    // wie in js/apps/projects.js — initEstateMap lädt MapLibre erst vom CDN).
    if (ticket !== mapTicket || !el.isConnected) { if (created) { try { created.remove(); } catch { /* egal */ } } return; }
    mtMap = created;
  }

  /* ------------------------------------------------- Teil-Neuzeichnung ---- */
  function renderMain() {
    const list = filtered().slice().sort(SORTS[state.sort] || SORTS.end);
    const cnt = mount.querySelector('#mt-count');
    const main = mount.querySelector('#mt-main');
    freeMtMap();

    // NUR die Trefferzahl — keine Summen. Fläche und Jahresmiete über die
    // gefilterte Menge zu addieren wäre eine Auswertung, und Auswertungen
    // gehören ins Datenportal (#/app/dataportal), nicht in eine Katalogleiste.
    // Die Zahlen des einzelnen Mietverhältnisses stehen auf dessen Detailseite.
    if (cnt) cnt.innerHTML = `<strong>${list.length}</strong> von ${all.length} Mietverhältnissen`;

    mount.querySelector('#mt-activefilters').innerHTML = C.activeFilters({
      filters: [
        ...(state.q ? [{ label: `Suche: „${state.q}“`, remove: 'q' }] : []),
        ...state.filters.ve.map((v) => ({ label: v, remove: 've:' + v })),
        ...(state.sel.city ? [{ label: state.sel.city, remove: 'sel' }]
          : state.sel.region ? [{ label: state.sel.region, remove: 'sel' }]
          : state.sel.land ? [{ label: landName(state.sel.land), remove: 'sel' }] : []),
      ],
    });

    if (state.view === 'map') {
      main.innerHTML = `<div class="pf-map dash-map" id="mt-map-el" role="group" aria-label="Karte der Mietverhältnisse"></div>`;
      mountMap(list);
      return;
    }
    if (!list.length) {
      main.innerHTML = C.empty('Keine Mietverhältnisse für diese Auswahl.', {
        hint: 'Passen Sie Suche, Filter oder die Auswahl im Baum an.',
      });
      return;
    }
    const per = state.perPage[state.view];
    const pages = Math.max(1, Math.ceil(list.length / per));
    if (state.page > pages) state.page = pages;
    const slice = list.slice((state.page - 1) * per, state.page * per);
    main.innerHTML = (state.view === 'gallery' ? galleryHTML(slice) : listHTML(slice))
      + (pages > 1 ? C.pagination({ page: state.page, totalPages: pages, href: () => '#', inputId: 'mt-page' }) : '');
    C.announceCatalogue({ count: list.length, total: all.length, unit: 'Mietverhältnisse', page: state.page, totalPages: pages, view: state.view });
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
      placeholder: 'Objekt, Ort oder Verwaltungseinheit…', q: '',
      countId: 'mt-count', count: '',
      sort: { id: 'mt-sort', value: state.sort, options: SORT_OPTS },
      filterId: 'mt-filter', filterLabel: 'Filter', panelId: 'mt-filters',
      panel: C.filterGroup({ dim: 've', legend: 'Verwaltungseinheit', selected: [], options: veOptions })
        + `<div class="catbar__panel__actions"><button type="button" class="btn btn--bare btn--sm" id="mt-reset">${C.icon('Refresh', 'icon--base')}<span class="btn__text">Zurücksetzen</span></button></div>`,
      view: state.view,
      views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List'], ['map', 'Kartenansicht', 'Map']],
    })}
    <div id="mt-activefilters"></div>
    <div class="pf-layout">
      <aside class="pf-sidebar" aria-label="Struktur der Mietverhältnisse">
        <div class="pf-sidebar__head">
          <h2 class="pf-sidebar__title">Standorte</h2>
          <button type="button" class="btn btn--bare btn--sm" id="mt-clear" hidden>${C.icon('Cancel', 'icon--base')}<span class="btn__text">Auswahl</span></button>
        </div>
        ${treeHTML()}
      </aside>
      <div class="pf-main" id="mt-main"></div>
    </div>
  </div>`;

  /* ---------------------------------------------------------- Verdrahten ---- */
  const clearBtn = mount.querySelector('#mt-clear');
  let searchT = null;
  const qEl = mount.querySelector('#mt-q');
  const runSearch = () => { state.q = qEl.value || ''; state.page = 1; renderMain(); };
  mount.querySelector('#mt-search').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(searchT); runSearch(); });
  qEl.addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(runSearch, 250); });

  mount.querySelector('.view-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('.view-switch__btn');
    if (!btn) return;
    state.view = btn.dataset.view;
    state.page = 1;
    mount.querySelectorAll('.view-switch__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    renderMain();
  });

  mount.querySelector('#mt-sort').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; renderMain(); });
  mount.querySelector('#mt-filters').addEventListener('change', (e) => {
    const cb = e.target.closest('[data-fdim="ve"]');
    if (!cb) return;
    state.filters.ve = [...mount.querySelectorAll('[data-fdim="ve"]:checked')].map((x) => x.value);
    state.page = 1; renderMain();
  });
  mount.querySelector('#mt-reset').addEventListener('click', () => {
    mount.querySelectorAll('[data-fdim="ve"]').forEach((x) => { x.checked = false; });
    state.filters.ve = []; state.page = 1; renderMain();
  });

  function setSelection(sel) {
    state.sel = sel;
    clearBtn.hidden = !Object.keys(sel).length;
    mount.querySelectorAll('.pf-tree__node, .pf-tree__leaf').forEach((n) => n.classList.remove('is-selected'));
    state.page = 1;
    renderMain();
  }
  mount.querySelector('.pf-sidebar').addEventListener('click', (e) => {
    const leafBtn = e.target.closest('.pf-tree__leaf');
    if (leafBtn) {
      const sel = {};
      for (const k of ['land', 'region', 'city']) if (leafBtn.dataset[k]) sel[k] = leafBtn.dataset[k];
      sel.id = leafBtn.dataset.obj;
      setSelection(sel);
      leafBtn.classList.add('is-selected');
      return;
    }
    const nd = e.target.closest('.pf-tree__node');
    if (!nd) return;
    const item = nd.closest('.pf-tree__item');
    const kids = item.querySelector(':scope > .pf-tree__children');
    const expanded = nd.getAttribute('aria-expanded') === 'true';
    nd.setAttribute('aria-expanded', String(!expanded));
    if (kids) kids.hidden = expanded;
    const sel = {};
    for (const k of ['land', 'region', 'city']) if (nd.dataset[k] != null) sel[k] = nd.dataset[k];
    setSelection(sel);
    nd.classList.add('is-selected');
  });
  clearBtn.addEventListener('click', () => setSelection({}));

  // Aktive Filterpillen entfernen (Delegation, weil sie bei jedem Zeichnen neu entstehen).
  mount.querySelector('#mt-activefilters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    const what = btn.dataset.remove;
    if (what === 'q') { state.q = ''; qEl.value = ''; }
    else if (what === 'sel') { setSelection({}); return; }
    else if (what.startsWith('ve:')) {
      const v = what.slice(3);
      state.filters.ve = state.filters.ve.filter((x) => x !== v);
      mount.querySelectorAll('[data-fdim="ve"]').forEach((x) => { if (x.value === v) x.checked = false; });
    }
    state.page = 1; renderMain();
  });

  // Blätterleiste (CD-Pagination rendert Links; hier steuert sie den Zustand).
  mount.querySelector('#mt-main').addEventListener('click', (e) => {
    const a = e.target.closest('.pagination_items a');
    if (!a) return;
    e.preventDefault();
    state.page += /Nächste/.test(a.getAttribute('aria-label') || '') ? 1 : -1;
    renderMain();
  });

  renderMain();
}

/* ================================== DETAIL ================================ */
function detail(ctx, id) {
  const { mount, query, core, engine, session, C, setTitle, setCrumbs, onUnmount } = ctx;
  const t = core.tenancy(id);
  if (!t) {
    setTitle('Mietverhältnis nicht gefunden');
    setCrumbs([...CRUMBS, { label: 'Mietende', href: '#/app/tenancies' }, { label: 'Nicht gefunden' }]);
    mount.innerHTML = C.notFound({ backHref: '#/app/tenancies', backLabel: 'Mietende',
      title: 'Mietverhältnis nicht gefunden',
      body: 'Dieses Mietverhältnis existiert nicht. <a href="#/app/tenancies">Zur Übersicht «Mietende»</a>' });
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
    { id: 'grundriss', label: `Grundriss (${floors.length})` },
    { id: 'vertrag', label: `Vertrag (${contracts.length})` },
    { id: 'vorgaenge', label: `Vorgänge (${cases.length})` },
  ];
  let active = query.get('tab') || 'uebersicht';
  if (!tabs.some((x) => x.id === active)) active = 'uebersicht';

  // Zustand des Grundrisses lebt im Hash: Geschoss, Einfärbung, gewählter Raum.
  // Damit ist eine bestimmte Ansicht teilbar — «schau dir 2. OG, nach Belegung
  // eingefärbt, Raum 14 an» ist ein Link.
  // OHNE `?floor=` steht die GESCHOSSTABELLE, nicht gleich ein Plan: ein
  // Mietobjekt umfasst mehrere Geschosse, und welches man ansehen will, ist
  // eine Entscheidung — sie vorwegzunehmen (erstes Geschoss automatisch) hätte
  // die übrigen versteckt und die Kennzahlen je Geschoss gar nicht gezeigt.
  let floorId = query.get('floor') || '';
  if (floorId && !floors.some((f) => f.floorId === floorId)) floorId = '';
  let colorMode = COLOR_MODES.some((m) => m.value === query.get('color')) ? query.get('color') : 'none';
  let spaceId = query.get('space') || '';

  const syncHash = () => {
    const p = new URLSearchParams();
    if (active !== 'uebersicht') p.set('tab', active);
    if (active === 'grundriss') {
      if (floorId) p.set('floor', floorId);
      if (colorMode !== 'none') p.set('color', colorMode);
      if (spaceId) p.set('space', spaceId);
    }
    const qs = p.toString();
    history.replaceState(null, '', `#/app/tenancies/${encodeURIComponent(t.tenancyId)}${qs ? '?' + qs : ''}`);
  };

  const restMonate = monateBis(t.leaseEnd);
  const galleryItems = galleryItemsFrom(t.bilder, {
    idPrefix: t.tenancyId, title: t.buildingName, ort: t.city,
  });

  /* ------------------------------------------------------------ Übersicht -- */
  function panelUebersicht() {
    const kv = `<dl class="kv">
      <dt>Verwaltungseinheit</dt><dd>${C.escape(t.veName)}<br><span class="small muted">${C.escape(t.department)}</span></dd>
      <dt>Objekt</dt><dd>${C.escape(t.buildingName)}<br><span class="small muted">${C.escape(t.street)}, ${C.escape(t.zip)} ${C.escape(t.city)}</span></dd>
      <dt>Geschosse</dt><dd>${C.escape(t.floorLabels.join(', '))}</dd>
      <dt>Fläche (HNF)</dt><dd>${m2(t.areaHnf)}</dd>
      <dt>Arbeitsplätze</dt><dd>${t.workstations} <span class="small muted">(${(t.areaHnf / t.workstations).toFixed(1)} m² je Arbeitsplatz)</span></dd>
      <dt>Mietbeginn</dt><dd>${datum(t.leaseStart)}</dd>
      <dt>Mietende</dt><dd>${datum(t.leaseEnd)} ${restMonate != null ? C.badge(restMonate <= 12 ? `noch ${restMonate} Monate` : `noch ${Math.floor(restMonate / 12)} Jahre`, restMonate <= 12 ? 'warning' : 'info') : ''}</dd>
      <dt>Jahresmiete</dt><dd>${chf(t.yearlyCost)}</dd>
      <dt>Kostenstelle</dt><dd>${C.escape(t.costCentre)}</dd>
      <dt>Objekt im Inventar</dt><dd><a href="#/app/portfolio?id=${encodeURIComponent(t.buildingId)}">${C.escape(t.buildingId)}</a></dd>
    </dl>`;
    const kontakte = (t.contacts || []).map((c) => `<div class="box">
      <h3>${C.escape(c.rolle)}</h3>
      <p class="small">${C.escape(c.name)}</p>
      <p class="small"><a href="mailto:${C.escape(c.email)}">${C.escape(c.email)}</a><br>${C.escape(c.phone)}</p>
    </div>`).join('');
    return `<div class="container--grid gap--responsive">
      <div class="container__main">${kv}</div>
      <aside class="container__aside stack-lg" aria-label="Ansprechstellen und Kurzwege">
        ${serviceShortcuts()}
        ${kontakte}
      </aside>
    </div>`;
  }

  /* ------------------------------------------------------------- Grundriss -- */
  // Zwei Zustände: die Geschossübersicht als Tabelle, und der Plan eines
  // Geschosses. Ein Mietobjekt umfasst mehrere Geschosse — die Tabelle ist die
  // Einstiegsebene und beantwortet die Mengenfragen (wie viele Räume, wie viel
  // Fläche, wie viele Arbeitsplätze je Geschoss), bevor man in die Zeichnung geht.
  function panelGrundriss() {
    if (!floors.length) return C.empty('Für dieses Mietverhältnis ist kein Grundriss hinterlegt.');
    return floorId ? floorplanView() : floorTable();
  }

  // Geschosszeilen — angereichert um die Summen aus den Räumen. Wird von der
  // Datentabelle unten gelesen.
  const floorRows = () => floors.map((f) => {
    const sp = core.spacesForFloor(f.floorId);
    return {
      ...f,
      arbeitsplaetze: sp.reduce((n, s) => n + (s.capacity || 0), 0),
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

    // Die Geschoss-Chips bleiben: sie wechseln OHNE den Umweg über die Tabelle.
    // Der Rücksprung darüber verlässt den Betrachter — zwei Wege mit zwei
    // verschiedenen Aufgaben, nicht zwei Wege zum selben Ziel.
    const geschossWahl = floors.map((f) => `<a class="fp-floors__chip${f.floorId === floor.floorId ? ' is-active' : ''}"
        href="#" data-floor="${C.escape(f.floorId)}"${f.floorId === floor.floorId ? ' aria-current="true"' : ''}>${C.escape(f.label)}</a>`).join('');

    return `
      <p class="fp-back"><a href="#" id="fp-zurueck">${C.icon('ArrowLeft', 'icon--base')} Alle Geschosse</a></p>
      <div class="fp-toolbar">
        <div class="fp-toolbar__group">
          <span class="fp-toolbar__label" id="fp-floors-label">Geschoss</span>
          <div class="fp-floors" role="group" aria-labelledby="fp-floors-label">${geschossWahl}</div>
        </div>
        <div class="fp-toolbar__group fp-toolbar__group--right">
          <label class="fp-toolbar__label" for="fp-color">Einfärben nach</label>
          <div class="select"><select id="fp-color" class="select__field">
            ${COLOR_MODES.map((m) => `<option value="${m.value}"${m.value === colorMode ? ' selected' : ''}>${m.label}</option>`).join('')}
          </select>${C.icon('ChevronDown', 'select__icon')}</div>
        </div>
      </div>
      <p class="small muted fp-facts">${floor.rooms} Räume · ${m2(floor.areaHnf)} HNF · ${m2(floor.areaGross)} brutto</p>
      <div class="fp-viewer">
        <div class="fp-stage" id="fp-stage">${floorplanSvg({ floor, spaces, mode: colorMode, selectedId: spaceId })}</div>
        <div class="fp-side">
          ${floorplanLegend(spaces, colorMode)}
          <div id="fp-room">${roomPanel(sel)}</div>
        </div>
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
      ${s.bookable ? `<a class="btn btn--outline btn--sm" href="#/app/workspace">${C.icon('Calendar', 'btn__icon icon--base')}<span class="btn__text">Raum buchen</span></a>` : ''}
      <h4 class="fp-room__sub">Dienstleistung starten</h4>
      ${serviceLinks(s)}
    </div>`;
  }

  /* ------------------------------------------------- Dienstleistungs-Wege -- */
  // Kurzwege in bestehende Dienstleistungen aus data/services.json — mit
  // vorbelegtem Gebäude, damit der Vorgang nicht bei null beginnt. Die Auswahl
  // ist bewusst kurz: was Mietende an einer Fläche tatsächlich auslösen.
  function svc(serviceId) { return core.service(serviceId); }
  function serviceLink(serviceId, iconName, href) {
    const s = svc(serviceId);
    if (!s) return '';
    return `<a class="fp-svc" href="${href}">
      ${C.icon(iconName, 'icon--base')}<span>${C.escape(s.title)}</span>${C.icon('ArrowRight', 'icon--sm fp-svc__go')}</a>`;
  }
  const objektQ = `building=${encodeURIComponent(t.buildingId)}`;
  function serviceLinks(s) {
    const raumQ = s ? `&room=${encodeURIComponent(s.roomNumber)}` : '';
    return `<div class="fp-svc-list">
      ${serviceLink('stoerung-melden', 'Wrench', `#/app/fault-report?${objektQ}${raumQ}`)}
      ${serviceLink('kleinauftrag-gebaeude', 'Building', `#/app/fault-report?type=kleinauftrag&${objektQ}${raumQ}`)}
      ${serviceLink('umzug-anmelden', 'ArrowRight', `#/app/fault-report?type=umzug&${objektQ}${raumQ}`)}
    </div>`;
  }
  function serviceShortcuts() {
    return `<div class="box">
      <h3>Dienstleistung starten</h3>
      <p class="small muted">Für dieses Objekt vorbelegt.</p>
      <div class="fp-svc-list">
        ${serviceLink('stoerung-melden', 'Wrench', `#/app/fault-report?${objektQ}`)}
        ${serviceLink('kleinauftrag-gebaeude', 'Building', `#/app/fault-report?type=kleinauftrag&${objektQ}`)}
        ${serviceLink('umzug-anmelden', 'ArrowRight', `#/app/fault-report?type=umzug&${objektQ}`)}
        ${serviceLink('raumbedarf-melden', 'Home', '#/app/space-request')}
        ${serviceLink('reklamation', 'WarningCircle', `#/app/fault-report?type=reklamation&${objektQ}`)}
      </div>
    </div>`;
  }

  /* ------------------------------------------------- Vertrag und Vorgänge -- */
  // Beide Reiter tragen NUR ihre Tabelle. Die Vertragseckdaten standen zuvor
  // als Merkmalliste darüber — sie stehen ohnehin im Reiter «Übersicht», und
  // zwei Darstellungen derselben Zahlen auf einer Seite lassen offen, welche
  // gilt. Die Dienstleistungs-Kurzwege liegen aus demselben Grund nur noch in
  // der Seitenspalte der Übersicht und im Raumdetail des Grundrisses.
  const panelVertrag = () => '<div id="mt-dt-vertraege"></div>';
  const panelVorgaenge = () => '<div id="mt-dt-vorgaenge"></div>';

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
        id: 'mt-dt-geschosse', rows: floorRows(), unit: 'Geschosse',
        caption: 'Geschosse dieses Mietverhältnisses', perPage: 10, rowsClickable: true,
        searchKeys: ['label', 'belegung'],
        sorts: [
          { value: 'level', label: 'Niveau (unten zuerst)', cmp: (a, b) => a.level - b.level },
          { value: 'area', label: 'Fläche (grösste zuerst)', cmp: (a, b) => b.areaHnf - a.areaHnf },
          { value: 'rooms', label: 'Räume (meiste zuerst)', cmp: (a, b) => b.rooms - a.rooms },
        ],
        columns: [
          { key: 'label', label: 'Geschoss', render: (f) => `<a href="#/app/tenancies/${encodeURIComponent(t.tenancyId)}?tab=grundriss&floor=${encodeURIComponent(f.floorId)}">${C.escape(f.label)}</a>` },
          { key: 'level', label: 'Niveau', align: 'right', render: (f) => String(f.level) },
          { key: 'rooms', label: 'Räume', align: 'right', render: (f) => String(f.rooms) },
          { key: 'areaHnf', label: 'HNF', align: 'right', render: (f) => m2(f.areaHnf) },
          { key: 'areaGross', label: 'Bruttofläche', align: 'right', render: (f) => m2(f.areaGross) },
          { key: 'arbeitsplaetze', label: 'Arbeitsplätze', align: 'right', render: (f) => String(f.arbeitsplaetze) },
          { key: 'belegung', label: 'Belegung', render: (f) => C.escape(f.belegung) },
        ],
        // Summenzeile über die GEFILTERTE Menge, nicht über die Seite: sonst
        // stünde bei zwei Seiten eine Teilsumme unter der Tabelle.
        foot: (_sichtbar, alle) => `<tr><th scope="row">Total</th><td class="text-right">—</td>
          <td class="text-right">${alle.reduce((n, f) => n + f.rooms, 0)}</td>
          <td class="text-right">${m2(alle.reduce((n, f) => n + f.areaHnf, 0))}</td>
          <td class="text-right">${m2(alle.reduce((n, f) => n + f.areaGross, 0))}</td>
          <td class="text-right">${alle.reduce((n, f) => n + f.arbeitsplaetze, 0)}</td>
          <td></td></tr>`,
      },
      'mt-dt-vertraege': {
        id: 'mt-dt-vertrag', rows: contracts, unit: 'Verträge', caption: 'Verträge zum Objekt',
        emptyMsg: 'Zu diesem Objekt sind keine Verträge im Inventar erfasst.',
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
        id: 'mt-dt-vorgang', rows: cases, unit: 'Vorgänge', caption: 'Laufende Vorgänge',
        emptyMsg: 'Für dieses Objekt sind derzeit keine Vorgänge offen.',
        perPage: 10, searchKeys: ['reference', 'title', 'defName'],
        sorts: [{ value: 'updated', label: 'Aktualisiert (neuste zuerst)', cmp: (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) }],
        columns: [
          { key: 'reference', label: 'Referenz', render: (i) => `<a href="#/my-cases/${encodeURIComponent(i.instanceId)}">${C.escape(i.reference || i.instanceId)}</a>` },
          { key: 'title', label: 'Anliegen', render: (i) => C.escape(i.title || '—') },
          { key: 'defName', label: 'Ablauf', render: (i) => C.escape(i.defName || '—') },
          { key: 'status', label: 'Status', render: (i) => C.badge(statusLabel(core, i.status), 'info') },
          { key: 'updatedAt', label: 'Aktualisiert', render: (i) => datum(i.updatedAt || i.createdAt) },
        ],
      },
    };
  }

  const panels = { uebersicht: panelUebersicht, grundriss: panelGrundriss, vertrag: panelVertrag, vorgaenge: panelVorgaenge };

  /* ---------------------------------------------------------------- Zeichnen */
  function draw() {
    mount.innerHTML = `
    <div class="container section">
      ${/* Kopf wie im Liegenschaften Inventar: Rücksprung, Titel, Fakten als
            Lead-Zeile — ohne Abzeichenreihe. Die Restlaufzeit steht mit ihrem
            Datum im Reiter «Übersicht»; als Warnabzeichen über dem Titel hätte
            sie jedes Mietverhältnis alarmiert, auch die mit 14 Jahren Restzeit. */''}
      ${C.backLink('#/app/tenancies', 'Mietende')}
      <h1 tabindex="-1">${C.escape(t.buildingName)}</h1>
      <p class="lead">${C.escape(t.street)}, ${C.escape(t.zip)} ${C.escape(t.city)} · ${
        C.escape(t.ve)} · ${C.escape(t.floorLabels.join(' + '))} · ${m2(t.areaHnf)}</p>
      ${/* Derselbe Kopf wie im Liegenschafteninventar (js/hero-mosaic.js):
            Bildmosaik links, Standortkarte rechts, jede Kachel öffnet die
            Vollbildgalerie. Ein einzelnes Bild wie zuvor liess offen, dass es
            zum Objekt weitere Aufnahmen gibt, und zeigte die Lage gar nicht. */''}
      ${heroMosaic(C, { items: galleryItems, id: 'mt-mosaic', mapId: 'mt-hero-map',
        mapLabel: `Standort von ${t.buildingName} auf der Karte` })}
      ${C.tabBar({ items: tabs, active, idPrefix: 'mt-tab', ariaLabel: 'Mietverhältnis', controlsClass: 'mt-6' })}
      ${C.tabPanels({ items: tabs, active, idPrefix: 'mt-tab', render: (id2) => panels[id2]() })}
    </div>`;

    C.wireTabs(mount, { syncHash: (tab) => { active = tab; syncHash(); } });
    mountTables();
    wireGrundriss();
    wireHero();
    window.scrollTo(0, 0);
    mount.querySelector('h1')?.focus({ preventScroll: true });
  }

  // Nur den Grundriss-Bereich neu zeichnen statt der ganzen Seite: ein voller
  // draw() würde den Fokus auf die h1 zurückwerfen und nach oben scrollen —
  // beim Durchklicken von Räumen wäre das unbenutzbar.
  function redrawGrundriss() {
    const host = mount.querySelector('#mt-tab-panel-grundriss') || mount.querySelector('[id$="-grundriss"]');
    if (!host) return draw();
    host.innerHTML = panelGrundriss();
    wireGrundriss();
  }

  // Kopf verdrahten: jede Mosaikkachel öffnet die Vollbildgalerie bei ihrem
  // eigenen Bild, und die Standortkarte bekommt einen Punkt auf das Objekt.
  // Koordinaten stehen im Mietverhältnis — kein Zugriff auf den Gebäudebestand.
  let heroMap = null;
  function freeHeroMap() { if (heroMap) { try { heroMap.remove(); } catch { /* schon weg */ } heroMap = null; } }
  async function wireHero() {
    mount.querySelectorAll('#mt-mosaic [data-gallery]').forEach((el) => {
      el.addEventListener('click', () => openGallery(galleryItems, Number(el.dataset.gallery) || 0, C, { param: 'bild' }));
    });
    freeHeroMap();
    const el = mount.querySelector('#mt-hero-map');
    if (!el || !Number.isFinite(t.lat) || !Number.isFinite(t.lon)) return;
    const created = await initEstateMap(el,
      [{ lat: t.lat, lon: t.lon, label: t.buildingName, sub: `${t.street}, ${t.zip} ${t.city}`, bblId: t.tenancyId }],
      { type: 'FeatureCollection', features: [] }, t.tenancyId, { focusPopup: false });
    if (!el.isConnected) { if (created) { try { created.remove(); } catch { /* egal */ } } return; }
    heroMap = created;
  }

  // Datentabellen in ihre Montagepunkte hängen. Alle Reiterpanels liegen im
  // DOM (inaktive sind `hidden`), deshalb werden alle drei gemountet — sonst
  // stünde beim Reiterwechsel ein leerer Kasten da.
  let detachTables = [];
  function mountTables() {
    detachTables.forEach((f) => { try { f(); } catch { /* egal */ } });
    detachTables = [];
    const cfgs = dataTables();
    for (const [hostId, cfg] of Object.entries(cfgs)) {
      if (!cfg) continue;
      const host = mount.querySelector('#' + hostId);
      if (host) detachTables.push(C.mountDataTable(host, cfg) || (() => {}));
    }
  }

  let detach = null;
  function wireGrundriss() {
    if (detach) { detach(); detach = null; }
    mountTables();
    // Rücksprung aus dem Betrachter in die Geschossübersicht.
    mount.querySelector('#fp-zurueck')?.addEventListener('click', (e) => {
      e.preventDefault();
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
      // Fokus zurück auf den gewählten Raum, sonst landet er nach dem
      // Neuzeichnen am Seitenanfang.
      mount.querySelector(`[data-space="${CSS.escape(spaceId)}"] rect`)?.focus({ preventScroll: true });
    });
    mount.querySelector('#fp-color')?.addEventListener('change', (e) => {
      colorMode = e.target.value; syncHash(); redrawGrundriss();
      mount.querySelector('#fp-color')?.focus();
    });
    mount.querySelectorAll('[data-floor]').forEach((el) => el.addEventListener('click', (e) => {
      e.preventDefault();
      floorId = el.dataset.floor; spaceId = '';
      syncHash(); redrawGrundriss();
    }));
  }

  onUnmount(() => {
    if (detach) detach();
    freeHeroMap();
    detachTables.forEach((f) => { try { f(); } catch { /* egal */ } });
  });
  draw();
}

function statusLabel(core, id) {
  const m = (core.ref().statusModel || []).find((s) => s.id === id);
  return m ? m.label : id;
}
