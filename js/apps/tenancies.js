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
import { syncTreeCounts } from '../spatial-tree.js';
import { heroMosaic, galleryItemsFrom } from '../hero-mosaic.js';
import { openGallery } from '../gallery.js';
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
  const { mount, core, C, setTitle, setCrumbs, onUnmount } = ctx;
  mtMap.free();
  onUnmount(mtMap.free);
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
    href: links.mietverhaeltnis(t.tenancyId),
    photo: { src: t.photoSrc, color: 'var(--color-secondary-600)', alt: `${t.buildingName}, ${t.city}` },
    chips: [t.ve, t.floorLabels.join(' + ')],
    footerInfo: `${m2(t.areaHnf)} · ${t.workstations} AP`,
    footerAction: C.cardAction(),
  });
  const galleryHTML = (slice) => `<div class="pf-gallery">${slice.map(card).join('')}</div>`;

  const listHTML = (slice) => C.table({
    caption: 'Mietverhältnisse', zebra: true,
    columns: [
      { key: 'buildingName', label: 'Objekt', render: (t) => `<a href="${links.mietverhaeltnis(t.tenancyId)}">${esc(t.buildingName)}</a><br><span class="small muted">${esc(t.street)}, ${esc(t.zip)} ${esc(t.city)}</span>` },
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
    const list = filtered().slice().sort(SORTS[state.sort] || SORTS.end);
    const cnt = mount.querySelector('#mt-count');
    const main = mount.querySelector('#mt-main');
    mtMap.free();

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
    { id: 'vertrag', label: `Verträge (${contracts.length})` },
    // «Grundrisse» ist ebenfalls kein Reiter mehr, sondern der letzte Abschnitt
    // der Übersicht. Grund derselbe wie bei den Anträgen: hinter einem Reiter
    // wurde der Plan schlicht nicht gefunden. Er steht ZULETZT, weil er der
    // einzige Abschnitt ist, der aus einer zweizeiligen Tabelle in einen ~700px
    // hohen Betrachter aufgeht — über den Anträgen schöbe er sie jedes Mal weg.
    // «Vorgänge» war ein eigener Reiter und ist jetzt ein Abschnitt der
    // Übersicht: die laufenden Anträge sind der Grund, warum eine
    // Verwaltungseinheit diese Ansicht überhaupt öffnet — hinter einem Reiter
    // waren sie einen Klick von der Frage entfernt, die sie beantworten.
    // Ein alter Link mit `?tab=vorgaenge` fällt über die Prüfung unten
    // stillschweigend auf die Übersicht zurück, wo der Abschnitt jetzt steht.
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
  // VORGABE «Verwaltungseinheit», nicht «Keine»: ein einfarbiger Plan lässt
  // nicht erkennen, dass er überhaupt eingefärbt werden KANN — die Auswahl
  // daneben las sich wie eine Zierde. Mit der Belegung als Startbild ist der
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
    history.replaceState(null, '', `${links.mietverhaeltnis(t.tenancyId)}${qs ? '?' + qs : ''}`);
  };

  const restMonate = monateBis(t.leaseEnd);
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
      <dt>Mietende</dt><dd>${datum(t.leaseEnd)}</dd>
      <dt>Kostenstelle</dt><dd>${C.escape(t.costCentre)}</dd>
      <dt>Objekt im Inventar</dt><dd><a href="${links.objekt(t.buildingId)}">${C.escape(t.buildingId)}</a></dd>
    </dl>`;
    // EIN Kasten für alle Ansprechstellen, nicht einer je Stelle: zuvor stand
    // je Kontakt eine vollständige Kartenhülle um drei Textzeilen (191px hoch,
    // davon das meiste Polsterung). Die Rolle ist jetzt die Beschriftung der
    // Merkmalliste — und der Name entfällt, wo er die Rolle nur wiederholt
    // («Portfoliomanagement / Portfoliomanagement» in 18 von 18 Datensätzen
    // las sich wie ein Anzeigefehler).
    const kontakte = `<div class="box">
      <h2>Ansprechpersonen</h2>
      <dl class="kv kv--stack">${(t.contacts || []).map((c) => `
        <dt>${C.escape(c.rolle)}</dt>
        <dd>${c.name && c.name !== c.rolle ? `${C.escape(c.name)}<br>` : ''
          }<a href="mailto:${C.escape(c.email)}">${C.escape(c.email)}</a><br>${C.escape(c.phone)}</dd>`).join('')}
      </dl>
    </div>`;
    // `.detail-layout` statt des 12-Spalten-Rasters: nur so kann die Randspalte
    // über die GANZE Höhe kleben. Im Containerraster wäre sie ein Kind derselben
    // Zeile wie der erste Abschnitt und nach ihm verschwunden — genau das
    // Verhalten, das am Prototyp auffiel.
    return `<div class="detail-layout">
      <div>
        <section>
          <h2 class="detail-section__title">Vertrag und Mengengerüst</h2>
          ${kpis}
          ${kv}
        </section>
        ${/* Grundrisse VOR den Anträgen: sie beschreiben das Mietobjekt selbst
              und gehören damit neben die Vertragsdaten. Die Anträge sind
              Vorgangsgeschehen und schliessen die Seite ab. */''}
        ${/* Zwei Zustände in EINEM Abschnitt: die Geschosstabelle, und an ihrer
              Stelle der Betrachter. Der Wechsel tauscht nur
              `#mt-grundriss__body` aus — Seitenkopf, Bildmosaik, Reiterleiste
              und die Abschnitte darüber bleiben stehen. */''}
        <section class="detail-section" id="mt-grundriss">
          <h2 class="detail-section__title">Grundrisse</h2>
          <div id="mt-grundriss__body">${panelGrundriss()}</div>
        </section>
        ${/* Als eigener Reiter war das einen Klick weit weg von genau der
              Frage, mit der man in diese Ansicht kommt: «was läuft bei uns?» */''}
        <section class="detail-section">
          <h2 class="detail-section__title">Anträge zu diesem Mietobjekt</h2>
          <div id="mt-dt-vorgaenge"></div>
        </section>
      </div>
      <aside class="detail-layout__aside" aria-label="Aktionen und Ansprechstellen">
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

    // Die Geschoss-Chips bleiben: sie wechseln OHNE den Umweg über die Tabelle.
    // Der Rücksprung darüber verlässt den Betrachter — zwei Wege mit zwei
    // verschiedenen Aufgaben, nicht zwei Wege zum selben Ziel.
    const geschossWahl = floors.map((f) => `<a class="fp-floors__chip${f.floorId === floor.floorId ? ' is-active' : ''}"
        href="#" data-floor="${C.escape(f.floorId)}"${f.floorId === floor.floorId ? ' aria-current="true"' : ''}>${C.escape(f.label)}</a>`).join('');

    // Kopfleiste des Betrachters. Klebend, damit «Zurück», die Geschosse und
    // «Einfärben nach» auch beim Scrollen eines hohen Plans erreichbar bleiben
    // — dasselbe Idiom wie `.docviewer__bar`. `#fp-wrap` umschliesst Kopf UND
    // Betrachter, damit im Vollbild die Bedienung mitkommt und nicht nur die
    // Zeichnung dasteht.
    const farbLabel = (COLOR_MODES.find((m) => m.value === colorMode) || {}).label || '';
    return `
      <div id="fp-wrap">
        <div class="fp-head">
          <div class="fp-head__top">
            <div class="fp-head__title">
              <p class="fp-back"><a href="#" id="fp-zurueck">${C.icon('ArrowLeft', 'icon--base')} Alle Geschosse</a></p>
              <h3 class="fp-head__name">${C.escape(floor.label)}</h3>
              <p class="fp-head__facts">${floor.rooms} Räume · ${m2(floor.areaHnf)} HNF · ${m2(floor.areaGross)} brutto</p>
            </div>
            <div class="fp-head__actions">
              <button class="btn btn--outline btn--sm" type="button" id="fp-vollbild">
                ${C.icon('Expand', 'btn__icon icon--base')}<span class="btn__text">Vollbild</span></button>
              <button class="btn btn--outline btn--sm" type="button" id="fp-drucken">
                ${C.icon('Printer', 'btn__icon icon--base')}<span class="btn__text">Drucken</span></button>
            </div>
          </div>
          <div class="fp-toolbar">
            <div class="fp-toolbar__group">
              <span class="fp-toolbar__label" id="fp-floors-label">Geschoss</span>
              <div class="fp-floors" role="group" aria-labelledby="fp-floors-label">${geschossWahl}</div>
            </div>
            <div class="fp-toolbar__group fp-toolbar__group--right">
              <label class="fp-toolbar__label" for="fp-color">Einfärben nach</label>
              <div class="select select--bare"><select id="fp-color" class="select__field">
                ${COLOR_MODES.map((m) => `<option value="${m.value}"${m.value === colorMode ? ' selected' : ''}>${m.label}</option>`).join('')}
              </select>${C.icon('ChevronDown', 'select__icon')}</div>
            </div>
          </div>
        </div>
        <div class="fp-viewer">
          <div class="fp-stage" id="fp-stage">${floorplanSvg({ floor, spaces, mode: colorMode, selectedId: spaceId })}</div>
          <div class="fp-side">
            ${floorplanLegend(spaces, colorMode)}
            <div id="fp-room">${roomPanel(sel)}</div>
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
      ${serviceLink('umzug-anmelden', 'Truck', `#/app/fault-report?type=umzug&${objektQ}${raumQ}`)}
    </div>`;
  }
  function serviceShortcuts() {
    return `<div class="box">
      <h2>Aktionen</h2>
      <p class="small muted">Für dieses Objekt vorbelegt.</p>
      <div class="fp-svc-list">
        ${serviceLink('stoerung-melden', 'Wrench', `#/app/fault-report?${objektQ}`)}
        ${serviceLink('kleinauftrag-gebaeude', 'Building', `#/app/fault-report?type=kleinauftrag&${objektQ}`)}
        ${serviceLink('umzug-anmelden', 'Truck', `#/app/fault-report?type=umzug&${objektQ}`)}
        ${serviceLink('raumbedarf-melden', 'Home', '#/app/space-request')}
        ${serviceLink('reklamation', 'WarningCircle', `#/app/fault-report?type=reklamation&${objektQ}`)}
        ${/* Dokumente hängen am GEBÄUDE, nicht am Mietverhältnis — deshalb hier
              kein Dokumentenabschnitt, sondern der Weg in die
              Bauwerksdokumentation, auf dieses Gebäude vorgefiltert. */''}
        <a class="fp-svc" href="#/app/document-archive?building=${encodeURIComponent(t.buildingId)}">
          ${C.icon('File', 'icon--base')}<span>Dokumente zum Gebäude</span>${C.icon('ArrowRight', 'icon--sm fp-svc__go')}</a>
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
        // stünde bei zwei Seiten eine Teilsumme unter der Tabelle.
        foot: (_sichtbar, alle) => `<tr><th scope="row">Total</th>
          <td class="text-right">${alle.reduce((n, f) => n + f.rooms, 0)}</td>
          <td class="text-right">${m2(alle.reduce((n, f) => n + f.areaHnf, 0))}</td>
          <td class="text-right">${alle.reduce((n, f) => n + f.arbeitsplaetze, 0)}</td>
          <td class="text-right">${alle.reduce((n, f) => n + f.meineRaeume, 0)}</td></tr>`,
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
        // «Antrag» ist hier das richtige Wort, nicht «Vorgang»: das ist die
        // Sicht der mietenden Verwaltungseinheit auf das, was SIE eingereicht
        // hat. Die Referenzspalte führt weiterhin zum «Vorgang» unter «Meine
        // Vorgänge» — das ist derselbe Gegenstand aus Sicht der Bearbeitung.
        id: 'mt-dt-vorgang', rows: cases, unit: 'Anträge', caption: 'Anträge zu diesem Mietobjekt',
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

  const panels = { uebersicht: panelUebersicht, vertrag: panelVertrag };

  /* ---------------------------------------------------------------- Zeichnen */
  function draw() {
    // Restlaufzeit als Abzeichen im Kopf. Zuvor stand hier die Begründung, das
    // NICHT zu tun («alarmiert jedes Mietverhältnis») — die galt aber nur für
    // ein einfarbiges Warnabzeichen. Abgestuft (Warnung ≤ 12 Monate, Hinweis
    // ≤ 36, sonst Erfolg) trägt es Information statt Dringlichkeit, und es ist
    // die erste Frage an ein Mietverhältnis. Dasselbe Abzeichen wie in der
    // Übersichtsliste, damit Liste und Detail dieselbe Aussage machen.
    const restChip = restMonate == null ? '' : C.badge(
      restMonate < 24 ? `noch ${restMonate} Monate` : `noch ${Math.floor(restMonate / 12)} Jahre`,
      restMonate <= 12 ? 'warning' : restMonate <= 36 ? 'info' : 'success');

    mount.innerHTML = `
    <div class="container section">
      ${C.backLink('#/app/tenancies', 'Mietende')}
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
    const host = mount.querySelector('#mt-grundriss__body');
    if (!host) return draw();
    host.innerHTML = panelGrundriss();
    wireGrundriss();
  }

  // Kopf verdrahten: jede Mosaikkachel öffnet die Vollbildgalerie bei ihrem
  // eigenen Bild, und die Standortkarte bekommt einen Punkt auf das Objekt.
  // Koordinaten stehen im Mietverhältnis — kein Zugriff auf den Gebäudebestand.
  const heroMap = createMapSlot();
  async function wireHero() {
    mount.querySelectorAll('#mt-mosaic [data-gallery]').forEach((el) => {
      el.addEventListener('click', () => openGallery(galleryItems, Number(el.dataset.gallery) || 0, C, { param: 'bild' }));
    });
    const el = mount.querySelector('#mt-hero-map');
    if (!el || !Number.isFinite(t.lat) || !Number.isFinite(t.lon)) { heroMap.free(); return; }
    await heroMap.mount(el, (node) => initEstateMap(node,
      [{ lat: t.lat, lon: t.lon, label: t.buildingName, sub: `${t.street}, ${t.zip} ${t.city}`, bblId: t.tenancyId }],
      { type: 'FeatureCollection', features: [] }, t.tenancyId, { focusPopup: false }));
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
  });
  draw();
}
