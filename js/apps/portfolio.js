// Liegenschaften Inventar — map-first real-estate portfolio explorer.
//
// Datenquelle: SAP-RE-FX-Golden-Record (core.buildings() + core.parcels()), dieselben
// bbl_id wie das Immobilienportfolio-Dashboard. Ein Objekt wird über ?id=<bbl_id>
// angesprochen (Query-Param, weil SAP-ids «/» enthalten). Aufbau: links ein räumlicher
// Baum (Land › Region › Stadt › Wirtschaftseinheit › Gebäude/Grundstück), rechts die
// Ansicht Karte (Default, geclustert) · Galerie · Liste. Siehe docs/portfolio-redesign.md.

import { initEstateMap } from '../buildings-map.js';

let pfMap = null;
function freePfMap() { if (pfMap) { try { pfMap.remove(); } catch { /* schon weg */ } pfMap = null; } }
const weOf = (id) => String(id || '').split('/')[1] || '';
const LAND = { CH: 'Schweiz', DE: 'Deutschland', US: 'USA', JP: 'Japan', BR: 'Brasilien', AU: 'Australien' };
const landName = (l) => LAND[l] || l || '—';

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

const CRUMBS = [
  { label: 'Startseite', href: '#/' },
  { label: 'Daten und Digitalisierung', href: '#/data' }, { label: 'Anwendungen', href: '#/applications' },
];

export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs } = ctx;
  const detailId = (query && query.get('id')) || params[0];
  if (detailId) {
    const b = core.building(detailId);
    if (b) return buildingDetail(ctx, b);
    const p = core.parcel(detailId);
    if (p) return parcelDetail(ctx, p);
    freePfMap();
    mount.innerHTML = `<div class="container section">${C.backLink('#/app/portfolio', 'Liegenschaften Inventar')}${C.empty('Objekt nicht gefunden.')}</div>`;
    return;
  }
  freePfMap();
  setTitle('Liegenschaften Inventar');
  setCrumbs([...CRUMBS, { label: 'Liegenschaften Inventar' }]);

  const ref = core.ref();
  // Gebäude + Grundstücke als einheitliche Objektliste
  const objects = [
    ...core.buildings().map((b) => ({ kind: 'building', id: b.bbl_id, we: b.bbl_we || weOf(b.bbl_id), land: b.land, region: b.canton, city: b.city, name: b.name, cat: b.portfolioCategory, ownership: b.ownership, status: b.status, area: b.gf, lat: b.lat, lon: b.lng, photo: b.photo, street: b.street, zip: b.zip })),
    ...core.parcels().map((p) => ({ kind: 'parcel', id: p.bbl_id, we: p.bbl_we || weOf(p.bbl_id), land: p.land, region: p.canton, city: p.city, name: p.name, cat: p.zone || 'Grundstück', ownership: p.ownership, status: p.status, area: p.gsf, lat: p.lat, lon: p.lng, geom: p.geom, street: p.street, zip: p.zip })),
  ];

  const state = {
    view: ['karte', 'galerie', 'liste'].includes(query.get('view')) ? query.get('view') : 'karte',
    sel: {}, focus: null, q: '', sort: 'name', filters: { status: [], ownership: [], kind: [] }, page: 1,
    perPage: { galerie: 9, liste: 25 },
  };

  // --- filtering --------------------------------------------------------------
  const inSel = (o) => (!state.sel.id || o.id === state.sel.id)
    && (!state.sel.land || o.land === state.sel.land) && (!state.sel.region || o.region === state.sel.region)
    && (!state.sel.city || o.city === state.sel.city) && (!state.sel.we || o.we === state.sel.we);
  const inFilters = (o) => (!state.filters.status.length || state.filters.status.includes(o.status))
    && (!state.filters.ownership.length || state.filters.ownership.includes(o.ownership))
    && (!state.filters.kind.length || state.filters.kind.includes(o.kind));
  const inSearch = (o) => { const q = state.q.trim().toLowerCase(); return !q || `${o.name} ${o.id} ${o.street} ${o.zip} ${o.city}`.toLowerCase().includes(q); };
  const filtered = () => objects.filter((o) => inSel(o) && inFilters(o) && inSearch(o));

  // --- spatial tree -----------------------------------------------------------
  function buildTree() {
    const t = {};
    for (const o of objects) {
      const L = (t[o.land] = t[o.land] || { n: 0, r: {} });
      const R = (L.r[o.region] = L.r[o.region] || { n: 0, c: {} });
      const Ci = (R.c[o.city] = R.c[o.city] || { n: 0, w: {} });
      const W = (Ci.w[o.we] = Ci.w[o.we] || { n: 0, o: [] });
      W.o.push(o); L.n++; R.n++; Ci.n++; W.n++;
    }
    return t;
  }
  const esc = (s) => C.escape(String(s == null ? '' : s));
  // SAP-Objekt-ID = drittes Segment der bbl_id (Gebäude: AA/AF …, Grundstück: 01/02 …).
  const objId = (o) => String(o.id).split('/')[2] || o.id;
  // Zeileninhalt: Level-Icon + optionale ID (mono) + Name — von Knoten und Blättern geteilt.
  const rowContent = (iconName, idText, label) => `${C.icon(iconName, 'pf-tree__ico')}${idText ? `<span class="pf-tree__id">${esc(idText)}</span>` : ''}<span class="pf-tree__label">${esc(label)}</span>`;
  const node = (content, count, attrs, children) => `<li class="pf-tree__item">
      <button type="button" class="pf-tree__node" ${attrs} aria-expanded="false">
        ${C.icon('ChevronRight', 'pf-tree__chev')}${content}<span class="pf-tree__n">${count}</span>
      </button>
      <ul class="pf-tree__children" hidden>${children}</ul></li>`;
  // Blatt = Auswahl-Button (kein Detail-Link): filtert auf das Objekt und öffnet auf
  // der Karte sein Info-Popup. Das Detail öffnet man über Galerie/Liste oder das Popup.
  const leaf = (o) => `<li class="pf-tree__item"><button type="button" class="pf-tree__leaf" data-obj="${esc(o.id)}" data-land="${esc(o.land)}" data-region="${esc(o.region)}" data-city="${esc(o.city)}" data-we="${esc(o.we)}">${rowContent(o.kind === 'building' ? 'Building' : 'Crop', objId(o), o.name)}</button></li>`;
  function treeHTML() {
    const tree = buildTree();
    const byDe = (a, b) => a.localeCompare(b, 'de');
    return `<ul class="pf-tree">${Object.keys(tree).sort((a, b) => landName(a).localeCompare(landName(b), 'de')).map((L) => {
      const land = tree[L];
      const regions = Object.keys(land.r).sort(byDe).map((R) => {
        const reg = land.r[R];
        const cities = Object.keys(reg.c).sort(byDe).map((Cy) => {
          const city = reg.c[Cy];
          const wes = Object.keys(city.w).sort().map((W) => {
            const we = city.w[W];
            const objs = we.o.slice().sort((a, b) => a.kind.localeCompare(b.kind) || byDe(a.name, b.name)).map(leaf).join('');
            const weName = (we.o.find((x) => x.kind === 'building') || we.o[0] || {}).name || '';
            return node(rowContent('Folder', `WE ${W}`, weName), we.n, `data-land="${esc(L)}" data-region="${esc(R)}" data-city="${esc(Cy)}" data-we="${esc(W)}"`, objs);
          }).join('');
          return node(rowContent('MapMarker', '', Cy), city.n, `data-land="${esc(L)}" data-region="${esc(R)}" data-city="${esc(Cy)}"`, wes);
        }).join('');
        return node(rowContent('Map', '', R), reg.n, `data-land="${esc(L)}" data-region="${esc(R)}"`, cities);
      }).join('');
      return node(rowContent('Globe', '', landName(L)), land.n, `data-land="${esc(L)}"`, regions);
    }).join('')}</ul>`;
  }

  // --- views (renderMain slices the list + appends the CD pagination) ---------
  function pfCard(o) {
    const vis = o.kind === 'building'
      ? C.photo({ id: o.photo, color: '#2f4356', alt: `${o.name}, ${o.city}`, w: 480, cls: 'pf-card__img' })
      : `<div class="pf-card__parcel">${C.icon('Crop', 'icon--2xl')}</div>`;
    const chips = [landName(o.land), o.kind === 'building' ? 'Gebäude' : 'Grundstück', o.status]
      .filter(Boolean).map((c) => `<span class="pf-card__land">${esc(c)}</span>`).join('');
    return `<a class="card card--universal card--clickable pf-card" href="#/app/portfolio?id=${encodeURIComponent(o.id)}">
      <div class="pf-card__vis">${vis}<div class="pf-card__chips">${chips}</div></div>
      <div class="card__content"><div class="card__body">
        <div class="card__title">${esc(o.name)}</div>
        <p class="card__description">${esc(o.street)}${o.city ? `, ${esc(o.zip)} ${esc(o.city)}` : ''}</p>
      </div>
      <div class="card__footer"><span>${esc(o.cat)}</span><span>${Number(o.area || 0).toLocaleString('de-CH')} m² <span class="muted">${o.kind === 'building' ? 'GF' : 'GSF'}</span></span></div></div></a>`;
  }
  const galleryHTML = (slice) => `<div class="pf-gallery">${slice.map(pfCard).join('')}</div>`;
  // Compact table: Typ as an icon (no label/emoji), Ort merged with Land, GF/GSF unit — fits without a horizontal scrollbar.
  const listHTML = (slice) => C.table({ zebra: true, columns: [
    { key: 'kind', label: 'Typ', render: (o) => `<span class="pf-typ" title="${o.kind === 'building' ? 'Gebäude' : 'Grundstück'}" aria-label="${o.kind === 'building' ? 'Gebäude' : 'Grundstück'}">${C.icon(o.kind === 'building' ? 'Building' : 'Crop', 'icon--base')}</span>` },
    { key: 'name', label: 'Bezeichnung', render: (o) => `<a href="#/app/portfolio?id=${encodeURIComponent(o.id)}">${esc(o.name)}</a><br><span class="small muted">${esc(o.id)}</span>` },
    { key: 'ort', label: 'Ort', render: (o) => `${esc(o.city)}<br><span class="small muted">${esc(landName(o.land))}</span>` },
    { key: 'cat', label: 'Kategorie', render: (o) => esc(o.cat) },
    { key: 'area', label: 'Fläche', render: (o) => `${Number(o.area || 0).toLocaleString('de-CH')} m²<br><span class="small muted">${o.kind === 'building' ? 'GF' : 'GSF'}</span>` },
    { key: 'status', label: 'Status', render: (o) => statusBadge(C, ref, o.status) },
  ], rows: slice });
  async function mountMap(list, focus) {
    freePfMap();
    const el = mount.querySelector('#pf-map-el');
    if (!el) return;
    const points = list.filter((o) => o.kind === 'building' && Number.isFinite(o.lat) && Number.isFinite(o.lon))
      .map((o) => ({ lat: o.lat, lon: o.lon, label: o.name, bblId: o.id, sub: `${o.street}, ${o.zip} ${o.city}`.trim(), href: `#/app/portfolio?id=${encodeURIComponent(o.id)}` }));
    const parcels = { type: 'FeatureCollection', features: list.filter((o) => o.kind === 'parcel' && o.geom).map((o) => ({
      type: 'Feature', geometry: o.geom, properties: { label: o.name, sub: `${o.street}, ${o.zip} ${o.city}`.trim(), id: o.id, area: o.area, href: `#/app/portfolio?id=${encodeURIComponent(o.id)}` } })) };
    pfMap = await initEstateMap(el, points, parcels, focus);
  }

  // --- partial render of the main pane ---------------------------------------
  function renderMain() {
    const list = filtered().sort(SORTS[state.sort] || SORTS.name);
    const cnt = mount.querySelector('#pf-count');
    const main = mount.querySelector('#pf-main');
    freePfMap();
    if (state.view === 'karte') {
      // Karte: nur die Anzahl (kein «von … · Seite …» — das ist nur für Galerie/Liste).
      if (cnt) cnt.innerHTML = `<strong>${list.length}</strong> ${list.length === 1 ? 'Objekt' : 'Objekte'}`;
      main.innerHTML = `<div class="pf-map dash-map" id="pf-map-el" role="group" aria-label="Karte der Liegenschaften"></div>`;
      mountMap(list, state.focus);
    } else if (!list.length) {
      if (cnt) cnt.innerHTML = `<strong>0</strong> von ${objects.length} Objekte`;
      main.innerHTML = C.empty('Keine Objekte für diese Auswahl.');
    } else {
      const per = state.perPage[state.view];
      const pages = Math.max(1, Math.ceil(list.length / per));
      if (state.page > pages) state.page = pages;
      const slice = list.slice((state.page - 1) * per, state.page * per);
      // CD-Ergebniskopf: «N von M Objekte · Seite X von Y» (wie #/services).
      if (cnt) cnt.innerHTML = `<strong>${list.length}</strong> von ${objects.length} Objekte${pages > 1 ? ` · Seite ${state.page} von ${pages}` : ''}`;
      main.innerHTML = (state.view === 'galerie' ? galleryHTML(slice) : listHTML(slice))
        + C.pagination({ page: state.page, totalPages: pages, href: () => '#', inputId: 'pf-page' });
      if (pages > 1) C.wirePagination(mount, 'pf-page', state.page, pages, (t) => { state.page = t; renderMain(); });
    }
    mount.querySelectorAll('.view-switch__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    renderActiveFilters();
    try { history.replaceState(null, '', `#/app/portfolio?view=${state.view}`); } catch { /* nicht kritisch */ }
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
    if (state.q.trim()) pills.push({ label: `Suche: „${state.q.trim()}“`, remove: 'q' });
    const sp = selPill(); if (sp) pills.push(sp);
    state.filters.status.forEach((v) => pills.push({ label: v, remove: `status:${v}` }));
    state.filters.ownership.forEach((v) => pills.push({ label: v, remove: `ownership:${v}` }));
    state.filters.kind.forEach((v) => pills.push({ label: kindLabel(v), remove: `kind:${v}` }));
    box.innerHTML = C.activeFilters({ filters: pills });
  }

  // --- chrome (once) ----------------------------------------------------------
  const statuses = [...new Set(objects.map((o) => o.status))].filter(Boolean);
  const owns = [...new Set(objects.map((o) => o.ownership))].filter(Boolean);
  const fgroup = (key, label, opts) => `<fieldset class="filter-group"><legend class="filter-group__legend">${label}</legend>${opts.map((o) => `<label class="filter-check"><input type="checkbox" data-fdim="${key}" value="${esc(o.v)}"><span>${esc(o.l)}</span></label>`).join('')}</fieldset>`;

  const filterPanel = `
      ${fgroup('status', 'Status', statuses.map((s) => ({ v: s, l: s })))}
      ${fgroup('ownership', 'Eigentumsverhältnis', owns.map((o) => ({ v: o, l: o })))}
      ${fgroup('kind', 'Objekttyp', [{ v: 'building', l: 'Gebäude' }, { v: 'parcel', l: 'Grundstück' }])}
      <button type="button" class="btn btn--bare btn--sm" id="pf-freset">${C.icon('Refresh', 'icon--base')} Zurücksetzen</button>`;

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({ title: 'Liegenschaften Inventar', lead: 'Weltweites Immobilienportfolio des BBL — Gebäude und Grundstücke aus dem SAP-RE-FX-Stammdatenbestand.' })}
    ${C.catalogueBar({
      formId: 'pf-search', inputId: 'pf-q', searchLabel: 'Adresse, Objekt oder ID suchen',
      placeholder: 'Adresse, Objekt oder ID suchen…', countId: 'pf-count',
      sort: { id: 'pf-sort', label: 'Sortieren', value: state.sort, options: SORT_OPTIONS },
      filterId: 'pf-filter-btn', filterLabel: 'Filter', panelId: 'pf-filters', panel: filterPanel,
      view: state.view, views: [['karte', 'Kartenansicht', 'Map'], ['galerie', 'Galerieansicht', 'Apps'], ['liste', 'Listenansicht', 'List']],
    })}
    <div id="pf-activefilters"></div>
    <div class="pf-layout">
      <aside class="pf-sidebar" aria-label="Portfolio-Struktur">
        <div class="pf-sidebar__head"><h2 class="pf-sidebar__title">Portfolio</h2>
          <button type="button" class="btn btn--bare btn--sm" id="pf-clear" hidden>${C.icon('Cancel', 'icon--base')} Auswahl</button></div>
        ${treeHTML()}
      </aside>
      <div class="pf-main" id="pf-main"></div>
    </div>
  </div>`;

  // --- wiring -----------------------------------------------------------------
  let searchT = null;
  const q = mount.querySelector('#pf-q');
  const runSearch = () => { state.q = q.value || ''; state.page = 1; renderMain(); };
  mount.querySelector('#pf-search').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(searchT); runSearch(); });
  q.addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(runSearch, 250); });

  mount.querySelector('.view-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('.view-switch__btn'); if (!btn) return;
    state.view = btn.dataset.view; state.page = 1; renderMain();
  });

  const sortSel = mount.querySelector('#pf-sort');
  if (sortSel) sortSel.addEventListener('change', () => { state.sort = sortSel.value; state.page = 1; renderMain(); });

  const fbtn = mount.querySelector('#pf-filter-btn');
  const fpanel = mount.querySelector('#pf-filters');
  const fbadge = mount.querySelector('#pf-filter-btn .catbar__fcount');
  const updateFilterBadge = () => {
    const total = state.filters.status.length + state.filters.ownership.length + state.filters.kind.length;
    fbadge.textContent = total ? `(${total})` : ''; fbadge.hidden = !total;
  };
  const syncFilterChecks = () => fpanel.querySelectorAll('input[data-fdim]').forEach((cb) => { cb.checked = (state.filters[cb.dataset.fdim] || []).includes(cb.value); });
  const clearFilters = () => { state.filters = { status: [], ownership: [], kind: [] }; syncFilterChecks(); updateFilterBadge(); };
  fbtn.addEventListener('click', () => { const open = !fpanel.hidden; fpanel.hidden = open; fbtn.setAttribute('aria-expanded', String(!open)); });
  fpanel.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-fdim]'); if (!cb) return;
    const dim = cb.dataset.fdim, arr = state.filters[dim];
    if (cb.checked) { if (!arr.includes(cb.value)) arr.push(cb.value); } else state.filters[dim] = arr.filter((x) => x !== cb.value);
    updateFilterBadge();
    state.page = 1; renderMain();
  });
  mount.querySelector('#pf-freset').addEventListener('click', () => { clearFilters(); state.page = 1; renderMain(); });

  // Aktive-Filter-Pillen (entfernbar): Suche · Baum-Auswahl · Panel-Filter → Reset je Pille.
  mount.querySelector('#pf-activefilters').addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) { state.q = ''; q.value = ''; clearFilters(); setSelection({}, null, null); return; }
    const pill = e.target.closest('[data-remove]'); if (!pill) return;
    const tok = pill.dataset.remove;
    if (tok === 'q') { state.q = ''; q.value = ''; state.page = 1; renderMain(); }
    else if (tok === 'sel') { setSelection({}, null, null); }
    else { const i = tok.indexOf(':'), dim = tok.slice(0, i); state.filters[dim] = (state.filters[dim] || []).filter((x) => x !== tok.slice(i + 1)); syncFilterChecks(); updateFilterBadge(); state.page = 1; renderMain(); }
  });

  const clearBtn = mount.querySelector('#pf-clear');
  // Two-tone highlight carries the hierarchy (so the indent can be flat): the
  // selected node is «active» (blue), its ancestor path (Land › Region › Stadt › WE)
  // is «path» (light grey) — the drill-down chain is obvious at a glance.
  function markTree(activeNode) {
    mount.querySelectorAll('.pf-tree__node, .pf-tree__leaf').forEach((n) => n.classList.remove('is-active', 'is-path'));
    if (!activeNode) return;
    activeNode.classList.add('is-active');
    let li = activeNode.closest('.pf-tree__item');
    while (li) {
      const ul = li.parentElement;
      if (!ul || !ul.classList.contains('pf-tree__children')) break;   // reached the top list
      const parentNode = ul.parentElement.querySelector(':scope > .pf-tree__node');
      if (parentNode) parentNode.classList.add('is-path');
      li = ul.parentElement;
    }
  }
  function setSelection(sel, activeNode, focus) {
    state.sel = sel;
    state.focus = focus || null;
    markTree(activeNode);
    clearBtn.hidden = !Object.keys(sel).length;
    state.page = 1; renderMain();
  }
  mount.querySelector('.pf-sidebar').addEventListener('click', (e) => {
    const leafBtn = e.target.closest('.pf-tree__leaf');
    if (leafBtn) {   // Blatt: auf das Objekt filtern + Karten-Popup öffnen (kein Detail-Sprung)
      const sel = {};
      for (const k of ['land', 'region', 'city', 'we']) if (leafBtn.dataset[k]) sel[k] = leafBtn.dataset[k];
      sel.id = leafBtn.dataset.obj;
      setSelection(sel, leafBtn, leafBtn.dataset.obj);
      return;
    }
    const nd = e.target.closest('.pf-tree__node'); if (!nd) return;
    const item = nd.closest('.pf-tree__item');
    const kids = item.querySelector(':scope > .pf-tree__children');
    const expanded = nd.getAttribute('aria-expanded') === 'true';
    nd.setAttribute('aria-expanded', String(!expanded));
    if (kids) kids.hidden = expanded;
    const sel = {};
    for (const k of ['land', 'region', 'city', 'we']) if (nd.dataset[k] != null) sel[k] = nd.dataset[k];
    setSelection(sel, nd, null);
  });
  clearBtn.addEventListener('click', () => setSelection({}, null, null));

  mount.querySelector('#pf-main').addEventListener('click', (e) => {
    const a = e.target.closest('.pagination_items a'); if (!a) return;   // CD-Pagination (Vor/Zurück)
    e.preventDefault();
    state.page += /Nächste/.test(a.getAttribute('aria-label') || '') ? 1 : -1;
    renderMain();
  });

  renderMain();
}

// ---------------------------------------------------------------------------
// Building detail (Phase 1 — tabs Übersicht / Bauprojekte / Dokumente / Medien).
// Phase 2 erweitert dies um Flächen, Ausstattung, Verträge, Kosten, Kontakte …
// ---------------------------------------------------------------------------
function buildingDetail(ctx, b) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  freePfMap();
  const ref = core.ref();
  setTitle(b.name);
  setCrumbs([...CRUMBS, { label: 'Liegenschaften Inventar', href: '#/app/portfolio' }, { label: b.name }]);

  const areas = core.areasForBuilding(b.bbl_id);
  const assets = core.assetsForBuilding(b.bbl_id);
  const contracts = core.contractsForBuilding(b.bbl_id);
  const costs = core.costsForBuilding(b.bbl_id);
  const contacts = core.buildingContactsFor(b.bbl_id);
  const documents = core.documentsForBuilding(b.bbl_id);
  const media = core.mediaForBuilding(b.bbl_id);
  const parcels = core.parcelsForBuilding(b.bbl_id);
  const regionLabel = [b.land, b.canton].filter(Boolean).join(' · ');
  // Bildergalerie (Modal auf dem Hero-Bild) statt eines Medien-Registers: Hauptbild + verknüpfte Medien.
  const galleryItems = [
    { photo: b.photo, title: b.name, meta: `${b.city} · Hauptansicht`, type: 'foto' },
    ...media.map((m) => ({ photo: m.photo, title: m.title, meta: `${m.date} · ${m.historicPeriod}`, type: m.mediaType, gray: m.historicPeriod === 'historisch' })),
  ].filter((g) => g.photo);

  const tabs = [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'flaechen', label: `Flächen (${areas.length})` },
    { id: 'ausstattung', label: `Ausstattung (${assets.length})` },
    { id: 'vertraege', label: `Verträge (${contracts.length})` },
    { id: 'kosten', label: `Kosten (${costs.length})` },
    { id: 'dokumente', label: `Dokumente (${documents.length})` },
    { id: 'kontakte', label: `Kontakte (${contacts.length})` },
  ];

  const fmtDate = (iso) => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('de-CH'); };
  const fmtMoney = (amount, currency) => `${currency || 'CHF'} ${Number(amount || 0).toLocaleString('de-CH')}`;

  function tabUebersicht() {
    return `
      <dl class="kv">
        <dt>BBL-ID</dt><dd>${C.escape(b.bbl_id)}</dd>
        <dt>Wirtschaftseinheit (WE)</dt><dd>${C.escape(b.bbl_we)}</dd>
        <dt>EGID</dt><dd>${C.escape(b.egid || '—')}</dd>
        <dt>Adresse</dt><dd>${C.escape(b.street)}, ${C.escape(b.zip)} ${C.escape(b.city)}</dd>
        <dt>Land / Region</dt><dd>${C.escape(regionLabel)}</dd>
        <dt>Portfolio-Kategorie</dt><dd>${C.escape(b.portfolioCategory)}</dd>
        <dt>Gebäudetyp</dt><dd>${C.escape(b.typ || '—')}</dd>
        <dt>Eigentumsverhältnis</dt><dd>${C.escape(b.ownership)}</dd>
        <dt>Baujahr</dt><dd>${C.escape(String(b.buildYear || '—'))}</dd>
        <dt>Geschossfläche (GF)</dt><dd>${Number(b.gf || 0).toLocaleString('de-CH')} m²</dd>
        <dt>Hauptnutzfläche (HNF)</dt><dd>${Number(b.hnf || 0).toLocaleString('de-CH')} m²</dd>
        ${b.erhaltung ? `<dt>Erhaltungsstrategie</dt><dd>${C.escape(b.erhaltung)}</dd>` : ''}
        ${b.heritage ? '<dt>Baudenkmal</dt><dd>Ja</dd>' : ''}
        ${parcels.length ? `<dt>Grundstück${parcels.length > 1 ? 'e' : ''}</dt><dd>${parcels.map(pc => `<a href="#/app/portfolio?id=${encodeURIComponent(pc.bbl_id)}">${C.escape(pc.name)}</a>`).join(', ')}</dd>` : ''}
        <dt>Status</dt><dd>${statusBadge(C, ref, b.status)}</dd>
        <dt>Klassifizierung</dt><dd>${classBadge(C, ref, b.classification)}</dd>
      </dl>`;
  }
  function tabFlaechen() {
    if (!areas.length) return C.empty('Keine Flächen- oder Bemessungsdaten erfasst.');
    return C.table({ zebra: true, columns: [
      { key: 'type', label: 'Bemessungsart', render: (a) => C.escape(a.type) },
      { key: 'value', label: 'Wert', render: (a) => `${Number(a.value || 0).toLocaleString('de-CH')} <span class="muted">${C.escape(a.unit || '')}</span>` },
      { key: 'accuracy', label: 'Genauigkeit', render: (a) => C.escape(a.accuracy || '—') },
      { key: 'standard', label: 'Standard', render: (a) => C.escape(a.standard || '—') },
      { key: 'validFrom', label: 'Gültig ab', render: (a) => fmtDate(a.validFrom) },
    ], rows: areas.slice().sort((x, y) => String(x.type).localeCompare(String(y.type), 'de')) });
  }
  function tabAusstattung() {
    if (!assets.length) return C.empty('Keine Ausstattung erfasst.');
    return C.table({ zebra: true, columns: [
      { key: 'name', label: 'Bezeichnung', render: (a) => `<strong>${C.escape(a.name)}</strong>` },
      { key: 'category', label: 'Kategorie', render: (a) => C.badge(a.category, 'blue') },
      { key: 'manufacturer', label: 'Hersteller', render: (a) => C.escape(a.manufacturer || '—') },
      { key: 'installationYear', label: 'Baujahr', render: (a) => C.escape(String(a.installationYear || '—')) },
      { key: 'location', label: 'Standort', render: (a) => C.escape(a.location || '—') },
      { key: 'status', label: 'Status', render: (a) => C.badge(a.status, a.status === 'In Betrieb' ? 'success' : 'gray') },
    ], rows: assets.slice().sort((x, y) => String(x.name).localeCompare(String(y.name), 'de')) });
  }
  function tabVertraege() {
    if (!contracts.length) return C.empty('Keine Verträge erfasst.');
    return C.table({ zebra: true, columns: [
      { key: 'type', label: 'Vertragsart', render: (c) => C.escape(c.type) },
      { key: 'contractPartner', label: 'Vertragspartner', render: (c) => C.escape(c.contractPartner || '—') },
      { key: 'laufzeit', label: 'Laufzeit', render: (c) => `${fmtDate(c.validFrom)} – ${c.validUntil ? fmtDate(c.validUntil) : 'unbefristet'}` },
      { key: 'amount', label: 'Betrag/Jahr', render: (c) => fmtMoney(c.amount, c.currency) },
      { key: 'status', label: 'Status', render: (c) => C.badge(c.status, CONTRACT_STATUS_VARIANT[c.status] || 'gray') },
    ], rows: contracts });
  }
  function tabKosten() {
    if (!costs.length) return C.empty('Keine Kostendaten erfasst.');
    const cur = costs[0].currency || 'CHF';
    const sum = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return C.table({ zebra: true, columns: [
      { key: 'costGroup', label: 'Kostengruppe', render: (c) => C.escape(c.costGroup) },
      { key: 'costType', label: 'Kostenart', render: (c) => C.escape(c.costType) },
      { key: 'amount', label: 'Betrag', render: (c) => fmtMoney(c.amount, c.currency) },
      { key: 'period', label: 'Periode', render: (c) => C.escape(c.period || '—') },
      { key: 'referenceDate', label: 'Stichtag', render: (c) => fmtDate(c.referenceDate) },
    ], rows: costs.slice().sort((x, y) => String(x.costGroup).localeCompare(String(y.costGroup))),
      foot: `<tr class="table__total"><th scope="row">Total</th><td></td><td><strong>${fmtMoney(sum, cur)}</strong></td><td colspan="2" class="small muted">${costs.length} Positionen · jährlich</td></tr>` });
  }
  function tabKontakte() {
    if (!contacts.length) return C.empty('Keine Objektkontakte hinterlegt.');
    const rows = contacts.slice().sort((a, c) => (c.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || String(a.name).localeCompare(String(c.name), 'de'));
    return C.table({ zebra: true, columns: [
      { key: 'name', label: 'Name', render: (c) => `<strong>${C.escape(c.name)}</strong>${c.isPrimary ? ' ' + C.badge('Primär', 'info') : ''}` },
      { key: 'role', label: 'Rolle', render: (c) => C.escape(c.role || '—') },
      { key: 'organisation', label: 'Organisation', render: (c) => C.escape(c.organisation || '—') },
      { key: 'phone', label: 'Telefon', render: (c) => c.phone ? `<a href="tel:${C.escape(String(c.phone).replace(/\s/g, ''))}">${C.escape(c.phone)}</a>` : '—' },
      { key: 'email', label: 'E-Mail', render: (c) => c.email ? `<a href="mailto:${C.escape(c.email)}">${C.escape(c.email)}</a>` : '—' },
    ], rows });
  }
  function tabDokumente() {
    if (!documents.length) return `${C.empty('Keine Dokumente verknüpft.')}<p class="mt-4"><a class="btn btn--link" href="#/app/document-archive">In der Bauwerksdokumentation öffnen ${C.icon('ArrowRight', 'icon--base')}</a></p>`;
    const items = documents.map((d) => `
      <div class="row row--between" style="padding:.75rem 0;border-bottom:1px solid var(--color-border)">
        <div class="row" style="gap:.75rem">${C.icon('File', 'icon--lg')}
          <div><div><strong>${C.escape(d.title)}</strong></div>
            <div class="small muted">${C.escape(d.type)} · ${C.escape(d.format)} · ${C.escape(formatSize(d.sizeKB))} · ${C.escape(String(d.year))} · ${classBadge(C, ref, d.classification)}</div></div></div>
        <a class="btn btn--outline btn--sm" href="${C.escape(d.url || '#')}">${C.icon('Download', 'icon--base')} Download</a></div>`).join('');
    return `<div class="stack">${items}</div><p class="mt-6"><a class="btn btn--link" href="#/app/document-archive">In der Bauwerksdokumentation öffnen ${C.icon('ArrowRight', 'icon--base')}</a></p>`;
  }
  const panels = { uebersicht: tabUebersicht, flaechen: tabFlaechen, ausstattung: tabAusstattung, vertraege: tabVertraege, kosten: tabKosten, dokumente: tabDokumente, kontakte: tabKontakte };
  const panelHtml = (id) => (panels[id] || tabUebersicht)();

  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/app/portfolio', 'Liegenschaften Inventar')}
    <div class="row mt-4" style="gap:.5rem">${classBadge(C, ref, b.classification)} ${statusBadge(C, ref, b.status)} <span class="small muted">${C.escape(b.bbl_id)}</span></div>
    <h1 tabindex="-1">${C.escape(b.name)}</h1>
    <p class="lead">${C.escape(b.street)}, ${C.escape(b.zip)} ${C.escape(b.city)} · ${C.escape(b.portfolioCategory)}</p>
    <button type="button" class="pf-hero-trigger" id="pf-hero-btn" aria-label="Bildergalerie öffnen (${galleryItems.length} Bild${galleryItems.length === 1 ? '' : 'er'})">
      ${C.photo({ id: b.photo, color: '#2f4356', alt: `${b.name}, ${b.city}`, w: 1600, cls: 'pf-hero', style: 'aspect-ratio:21/9;max-height:22rem', overlay: `<span class="pf-hero__badge">${C.icon('Image', 'icon--base')} ${galleryItems.length} Bild${galleryItems.length === 1 ? '' : 'er'}</span>` })}
    </button>
    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active: tabs[0].id, idPrefix: 'pf-tab', ariaLabel: 'Gebäudedetails' })}
      ${C.tabPanels({ items: tabs, active: tabs[0].id, idPrefix: 'pf-tab', render: panelHtml })}
    </div>
  </div>`;
  C.wireTabs(mount);
  const heroBtn = mount.querySelector('#pf-hero-btn');
  if (heroBtn) heroBtn.addEventListener('click', () => openGallery(galleryItems, 0, C));
  window.scrollTo(0, 0);
  const h = mount.querySelector('h1');
  if (h) h.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
// Parcel detail (Phase 1 — simple key-value; Phase 2 adds tabs + polygon mini-map).
// ---------------------------------------------------------------------------
function parcelDetail(ctx, p) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  freePfMap();
  const ref = core.ref();
  const we = p.bbl_we || weOf(p.bbl_id);
  const bld = core.buildings().find((b) => (b.bbl_we || weOf(b.bbl_id)) === we);
  const covers = core.landcoversForParcel(p.bbl_id);
  setTitle(p.name);
  setCrumbs([...CRUMBS, { label: 'Liegenschaften Inventar', href: '#/app/portfolio' }, { label: p.name }]);

  const tabs = [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'bodenbedeckung', label: `Bodenbedeckung (${covers.length})` },
  ];
  function tabUebersicht() {
    return `<dl class="kv">
      <dt>Parzellen-ID</dt><dd>${C.escape(p.bbl_id)}</dd>
      <dt>Wirtschaftseinheit (WE)</dt><dd>${C.escape(p.bbl_we)}</dd>
      <dt>Parzellen-Nr.</dt><dd>${C.escape(p.plotNumber || '—')}</dd>
      <dt>EGRID</dt><dd>${C.escape(p.egrid || '—')}</dd>
      <dt>Gemeinde</dt><dd>${C.escape(p.gemeinde || p.city)}</dd>
      <dt>Land / Region</dt><dd>${C.escape([p.land, p.canton].filter(Boolean).join(' · '))}</dd>
      <dt>Grundstücksfläche (GSF)</dt><dd>${Number(p.gsf || 0).toLocaleString('de-CH')} m²</dd>
      <dt>Nutzungszone</dt><dd>${C.escape(p.zone || '—')}</dd>
      <dt>Eigentumsverhältnis</dt><dd>${C.escape(p.ownership)}</dd>
      <dt>Status</dt><dd>${statusBadge(C, ref, p.status)}</dd>
      ${bld ? `<dt>Gebäude auf der Parzelle</dt><dd><a href="#/app/portfolio?id=${encodeURIComponent(bld.bbl_id)}">${C.escape(bld.name)}</a></dd>` : ''}
    </dl>`;
  }
  function tabBoden() {
    if (!covers.length) return C.empty('Keine Bodenbedeckungsdaten (amtliche Vermessung) erfasst.');
    const total = covers.reduce((s, c) => s + (Number(c.area) || 0), 0);
    return `<p class="lead" style="margin-top:0">Bedeckte Fläche total: <strong>${total.toLocaleString('de-CH')} m²</strong> <span class="small muted">(${covers.length} Bedeckungen)</span></p>
      ${C.table({ zebra: true, columns: [
        { key: 'type', label: 'Bodenbedeckungsart', render: (c) => C.escape(c.type) },
        { key: 'area', label: 'Fläche', render: (c) => `${Number(c.area || 0).toLocaleString('de-CH')} m²` },
        { key: 'status', label: 'AV-Status', render: (c) => C.escape(c.status || '—') },
        { key: 'egrid', label: 'EGRID', render: (c) => `<span class="small">${C.escape(c.egrid || '—')}</span>` },
      ], rows: covers.slice().sort((a, c) => (c.area || 0) - (a.area || 0)) })}`;
  }
  const panelHtml = (id) => id === 'bodenbedeckung' ? tabBoden() : tabUebersicht();

  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/app/portfolio', 'Liegenschaften Inventar')}
    <div class="row mt-4" style="gap:.5rem">${C.badge('Grundstück', 'gray')} ${statusBadge(C, ref, p.status)} <span class="small muted">${C.escape(p.bbl_id)}</span></div>
    <h1 tabindex="-1">${C.escape(p.name)}</h1>
    <p class="lead">${C.escape(p.street)}, ${C.escape(p.zip)} ${C.escape(p.city)} · ${C.escape(p.zone || 'Grundstück')}</p>
    <div class="pf-map dash-map" id="pf-parcel-map" role="group" aria-label="Bodenbedeckung des Grundstücks" style="height:340px;border-radius:var(--radius-lg)"></div>
    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active: tabs[0].id, idPrefix: 'pf-ptab', ariaLabel: 'Grundstücksdetails' })}
      ${C.tabPanels({ items: tabs, active: tabs[0].id, idPrefix: 'pf-ptab', render: panelHtml })}
    </div>
  </div>`;
  C.wireTabs(mount);
  // Mini-Karte: die Bodenbedeckungs-Polygone (+ Parzelle) — Grundstücke haben kein
  // Foto, die Karte ist der räumliche «Hero». Fehler brechen die Seite nicht ab.
  const mapEl = mount.querySelector('#pf-parcel-map');
  if (mapEl) {
    const feats = covers.filter((c) => c.geom).map((c) => ({ type: 'Feature', geometry: c.geom, properties: { label: c.type, sub: `${Number(c.area || 0).toLocaleString('de-CH')} m²`, id: p.bbl_id } }));
    if (p.geom) feats.push({ type: 'Feature', geometry: p.geom, properties: { label: p.name, sub: 'Parzelle', id: p.bbl_id } });
    initEstateMap(mapEl, [], { type: 'FeatureCollection', features: feats }, p.bbl_id).then((m) => { pfMap = m; }).catch(() => { /* Karte optional */ });
  }
  window.scrollTo(0, 0);
  const h = mount.querySelector('h1');
  if (h) h.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
const BUILDING_STATUS_VARIANT = { Aktiv: 'success', Abgang: 'warning', 'Löschvermerk': 'gray' };
const CONTRACT_STATUS_VARIANT = { Aktiv: 'success', Ausgelaufen: 'gray', 'Gekündigt': 'warning' };
function statusBadge(C, ref, statusId) { const m = (ref.buildingStatuses || []).find((s) => s.id === statusId); return C.badge(m ? m.label : statusId, BUILDING_STATUS_VARIANT[statusId] || 'gray'); }
function classBadge(C, ref, clsId) { const m = (ref.classificationTiers || []).find((t) => t.id === clsId); return C.badge(m ? m.label : clsId, m ? m.variant : 'gray'); }
function formatSize(kb) { if (kb == null) return ''; return kb >= 1024 ? (kb / 1024).toFixed(1).replace('.', ',') + ' MB' : kb + ' KB'; }

// ---------------------------------------------------------------------------
// Bildergalerie-Modal (Lightbox) — geöffnet über das Hero-Bild im Gebäudedetail.
// Folgt dem CD-Overlay-Muster (vgl. .chart-overlay): Scrim, Box, Schliessen oben
// rechts, Prev/Next, Zähler, Thumbnail-Leiste. Tastatur: Esc schliesst, ←/→ blättern,
// Tab bleibt in der Lightbox (Fokusfalle); Klick auf den Scrim schliesst. `items` =
// [{ photo, title, meta, type, gray }]. C wird durchgereicht (Modul ohne Import auf C).
function openGallery(items, start, C) {
  if (!items || !items.length) return;
  let idx = Math.max(0, Math.min(start || 0, items.length - 1));
  const multi = items.length > 1;
  const trigger = document.activeElement;
  const esc = (s) => C.escape(String(s == null ? '' : s));
  const overlay = document.createElement('div');
  overlay.className = 'pf-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Bildergalerie');

  const render = () => {
    const it = items[idx];
    overlay.innerHTML = `
      <div class="pf-lightbox__box">
        <button type="button" class="pf-lightbox__close" data-act="close" aria-label="Galerie schliessen">${C.icon('Cancel', 'icon--md')}</button>
        <div class="pf-lightbox__stage">
          ${multi ? `<button type="button" class="pf-lightbox__nav pf-lightbox__nav--prev" data-act="prev" aria-label="Vorheriges Bild">${C.icon('ChevronLeft', 'icon--lg')}</button>` : ''}
          <img class="pf-lightbox__img" src="${esc(C.photoUrl(it.photo, { w: 1600, gray: it.gray }))}" alt="${esc(it.title)}">
          ${it.type === 'video' ? `<span class="pf-lightbox__play" aria-hidden="true">${C.icon('Video', 'icon--lg')}</span>` : ''}
          ${multi ? `<button type="button" class="pf-lightbox__nav pf-lightbox__nav--next" data-act="next" aria-label="Nächstes Bild">${C.icon('ChevronRight', 'icon--lg')}</button>` : ''}
        </div>
        <div class="pf-lightbox__cap">
          <div><div class="pf-lightbox__title">${esc(it.title)}</div><div class="small muted">${esc(it.meta)}</div></div>
          ${multi ? `<div class="small muted pf-lightbox__count">${idx + 1} / ${items.length}</div>` : ''}
        </div>
        ${multi ? `<div class="pf-lightbox__thumbs">${items.map((m, i) => `<button type="button" class="pf-lightbox__thumb${i === idx ? ' is-active' : ''}" data-thumb="${i}" aria-label="${esc(m.title)}"${i === idx ? ' aria-current="true"' : ''}><img src="${esc(C.photoUrl(m.photo, { w: 200, gray: m.gray }))}" alt=""></button>`).join('')}</div>` : ''}
      </div>`;
    const cl = overlay.querySelector('.pf-lightbox__close'); if (cl) cl.focus();
  };
  const go = (d) => { idx = (idx + d + items.length) % items.length; render(); };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    document.body.classList.remove('chart-overlay-open');
    if (trigger && trigger.focus) trigger.focus();
  };
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (multi && e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (multi && e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'Tab') {
      const f = [...overlay.querySelectorAll('button')].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) return close();          // Klick auf den Scrim
    const btn = e.target.closest('[data-act], [data-thumb]'); if (!btn) return;
    if (btn.dataset.act === 'close') close();
    else if (btn.dataset.act === 'prev') go(-1);
    else if (btn.dataset.act === 'next') go(1);
    else if (btn.dataset.thumb != null) { idx = Number(btn.dataset.thumb); render(); }
  });
  document.addEventListener('keydown', onKey);
  document.body.classList.add('chart-overlay-open');
  document.body.appendChild(overlay);
  render();
}
