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
import { openGallery } from '../gallery.js';


// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
// `buildings` wird NICHT mehr gebraucht: mit dem Wegfall des Joins spart die
// Route 66 KB und einen Request.
export const needs = ['projects'];
let pjMap = null;
function freePjMap() { if (pjMap) { try { pjMap.remove(); } catch { /* schon weg */ } pjMap = null; } }
const weOf = (id) => String(id || '').split('/')[1] || '';
const LAND = { CH: 'Schweiz', DE: 'Deutschland', US: 'USA', JP: 'Japan', BR: 'Brasilien', AU: 'Australien' };
const landName = (l) => LAND[l] || l || '—';

const CRUMBS = [
  { label: 'Startseite', href: '#/' },
  { label: 'Daten und Digitalisierung', href: '#/data' }, { label: 'Anwendungen', href: '#/applications' },
];

const PROJECT_STATUS_VARIANT = { geplant: 'info', aktiv: 'warning', sistiert: 'gray', abgeschlossen: 'success', abgebrochen: 'error' };
const AMPEL_VARIANT = { gruen: 'success', gelb: 'warning', rot: 'error' };
const AMPEL_LABEL = { gruen: 'Grün', gelb: 'Gelb', rot: 'Rot' };
const chf = (x) => 'CHF ' + Number(x || 0).toLocaleString('de-CH');

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
  ctx.onUnmount(freePjMap);
  const { params } = ctx;
  if (params[0]) return detail(ctx, params[0]);
  return overview(ctx);
}

// ---- shared badges ------------------------------------------------------
function statusLabel(core, id) { const m = (core.ref().projectStatuses || []).find(s => s.id === id); return m ? m.label : id; }
function projectStatusBadge(C, core, status) { return C.badge(statusLabel(core, status), PROJECT_STATUS_VARIANT[status] || 'gray'); }
function ampelBadge(C, prefix, value) { return C.badge(`${prefix}: ${AMPEL_LABEL[value] || value}`, AMPEL_VARIANT[value] || 'gray'); }

// ---- overview (map-first explorer) --------------------------------------
function overview(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  freePjMap();
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

  const state = {
    // Galerie als Standard — wie im Liegenschaften-Inventar. Die Karte zeigt
    // Punkte ohne Namen und Kennzahlen; für den Einstieg in eine Projektliste
    // sind die Kacheln die informativere Ansicht (und die schnellere: kein
    // WebGL-Kontext beim ersten Aufruf).
    view: ['map', 'gallery', 'list'].includes(query.get('view')) ? query.get('view') : 'gallery',
    sel: {}, focus: null, q: '', sort: 'name', filters: { status: [], sia: [], sub: [] }, page: 1,
    perPage: { gallery: 9, list: 25 },
  };

  const inSel = (o) => (!state.sel.id || o.id === state.sel.id)
    && (!state.sel.land || o.land === state.sel.land) && (!state.sel.region || o.region === state.sel.region)
    && (!state.sel.city || o.city === state.sel.city) && (!state.sel.we || o.we === state.sel.we);
  const inFilters = (o) => (!state.filters.status.length || state.filters.status.includes(o.status))
    && (!state.filters.sia.length || state.filters.sia.includes(o.siaPhaseLabel))
    && (!state.filters.sub.length || state.filters.sub.includes(o.subPortfolio));
  const inSearch = (o) => { const q = state.q.trim().toLowerCase(); return !q || `${o.name} ${o.projectNumber} ${o.pm} ${o.buildingName} ${o.city}`.toLowerCase().includes(q); };
  const filtered = () => objects.filter((o) => inSel(o) && inFilters(o) && inSearch(o));

  // --- spatial tree: Land › Region › Stadt › WE › Projekte -----------------
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
  const rowContent = (iconName, idText, label) => `${C.icon(iconName, 'pf-tree__ico')}${idText ? `<span class="pf-tree__id">${esc(idText)}</span>` : ''}<span class="pf-tree__label">${esc(label)}</span>`;
  const node = (content, count, attrs, children) => `<li class="pf-tree__item">
      <button type="button" class="pf-tree__node" ${attrs} aria-expanded="false">
        ${C.icon('ChevronRight', 'pf-tree__chev')}${content}<span class="pf-tree__n">${count}</span>
      </button>
      <ul class="pf-tree__children" hidden>${children}</ul></li>`;
  // Blatt = Auswahl-Button (kein Detail-Sprung): filtert auf das Projekt + öffnet das Karten-Popup.
  const leaf = (o) => `<li class="pf-tree__item"><button type="button" class="pf-tree__leaf" data-obj="${esc(o.id)}" data-land="${esc(o.land)}" data-region="${esc(o.region)}" data-city="${esc(o.city)}" data-we="${esc(o.we)}">${rowContent('Briefcase', o.projectNumber, o.name)}</button></li>`;
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
            const projs = we.o.slice().sort((a, b) => byDe(a.name, b.name)).map(leaf).join('');
            const bName = (we.o[0] || {}).buildingName || '';
            return node(rowContent('Building', `WE ${W}`, bName), we.n, `data-land="${esc(L)}" data-region="${esc(R)}" data-city="${esc(Cy)}" data-we="${esc(W)}"`, projs);
          }).join('');
          return node(rowContent('MapMarker', '', Cy), city.n, `data-land="${esc(L)}" data-region="${esc(R)}" data-city="${esc(Cy)}"`, wes);
        }).join('');
        return node(rowContent('Map', '', R), reg.n, `data-land="${esc(L)}" data-region="${esc(R)}"`, cities);
      }).join('');
      return node(rowContent('Globe', '', landName(L)), land.n, `data-land="${esc(L)}"`, regions);
    }).join('')}</ul>`;
  }

  // --- views (renderMain slices + appends CD pagination) -------------------
  // Land und Status liegen als Auflage AUF dem Bild — wie in der Galerie des
  // Liegenschaften-Inventars (`.pf-card__chips`). Vorher standen sie als
  // Pillenzeile zwischen Titel und Beschreibung: drei farbige Abzeichen (Status,
  // Ziele, Risiko) drängten sich vor den Text, und beim Überfliegen des Rasters
  // las man zuerst Ampelfarben statt Projektnamen. Die Ampeln bleiben in der
  // Listenansicht und auf der Detailseite, wo sie mit ihrer Erklärung stehen.
  function pjCard(o) {
    return C.card({
      title: o.name, desc: o.teaser, href: `#/app/projects/${encodeURIComponent(o.id)}`,
      photo: { src: o.photoSrc, color: '#2f4356', alt: `${o.name} — ${o.buildingName}` },
      chips: [landName(o.land), statusLabel(core, o.status)],
      footer: `<span>${esc(o.projectNumber)}</span><span>SIA ${esc(o.siaPhase)} · ${esc(o.siaPhaseLabel)}</span>`,
    });
  }
  const galleryHTML = (slice) => `<div class="grid grid--3">${slice.map(pjCard).join('')}</div>`;
  const listHTML = (slice) => C.table({ zebra: true, caption: 'Bauprojekte', columns: [
    { key: 'projectNumber', label: 'Projektnr.', render: (o) => `<a href="#/app/projects/${encodeURIComponent(o.id)}">${esc(o.projectNumber)}</a>` },
    { key: 'name', label: 'Bezeichnung', render: (o) => `${esc(o.name)}<br><span class="small muted">${esc(o.buildingName)}</span>` },
    { key: 'ort', label: 'Ort', render: (o) => `${esc(o.city)}<br><span class="small muted">${esc(landName(o.land))}</span>` },
    { key: 'status', label: 'Status', render: (o) => projectStatusBadge(C, core, o.status) },
    { key: 'sia', label: 'SIA-Phase', render: (o) => `${esc(o.siaPhase)} · ${esc(o.siaPhaseLabel)}` },
    { key: 'plannedTotalCost', label: 'Investition', align: 'right', render: (o) => esc(chf(o.plannedTotalCost)) },
  ], rows: slice });
  // Wettlauf-Schutz: initEstateMap lädt MapLibre erst vom CDN. Ohne Marke
  // konnte ein zweiter Aufruf (Suche, zweiter Baumknoten) starten, während der
  // erste noch offen war — free…Map() lief dann gegen null und die zuerst
  // aufgelöste Karte blieb als WebGL-Kontext auf einem entfernten Knoten liegen.
  let mapTicket = 0;
  async function mountMap(list, focus) {
    const ticket = ++mapTicket;
    freePjMap();
    const el = mount.querySelector('#pj-map-el'); if (!el) return;
    const points = list.filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lon))
      .map((o) => ({ lat: o.lat, lon: o.lon, label: o.name, bblId: o.id, sub: `${o.projectNumber} · ${o.buildingName}`.trim(), href: `#/app/projects/${encodeURIComponent(o.id)}` }));
    const created = await initEstateMap(el, points, { type: 'FeatureCollection', features: [] }, focus);
    // Überholt oder Container weg? Sofort abbauen statt zuweisen.
    if (ticket !== mapTicket || !el.isConnected) { if (created) { try { created.remove(); } catch { /* egal */ } } return; }
    pjMap = created;
  }

  // --- partial render of the main pane ------------------------------------
  function renderMain() {
    const list = filtered().sort(SORTS[state.sort] || SORTS.name);
    const cnt = mount.querySelector('#pj-count');
    const main = mount.querySelector('#pj-main');
    freePjMap();
    if (state.view === 'map') {
      if (cnt) cnt.innerHTML = `<strong>${list.length}</strong> ${list.length === 1 ? 'Projekt' : 'Projekte'}`;
      main.innerHTML = `<div class="pf-map dash-map" id="pj-map-el" role="group" aria-label="Karte der Bauprojekte"></div>`;
      mountMap(list, state.focus);
    } else if (!list.length) {
      if (cnt) cnt.innerHTML = `<strong>0</strong> von ${objects.length} Projekte`;
      main.innerHTML = C.empty('Keine Projekte für diese Auswahl.');
    } else {
      const per = state.perPage[state.view];
      const pages = Math.max(1, Math.ceil(list.length / per));
      if (state.page > pages) state.page = pages;
      const slice = list.slice((state.page - 1) * per, state.page * per);
      if (cnt) cnt.innerHTML = `<strong>${list.length}</strong> von ${objects.length} Projekte${pages > 1 ? ` · Seite ${state.page} von ${pages}` : ''}`;
      main.innerHTML = (state.view === 'gallery' ? galleryHTML(slice) : listHTML(slice))
        + C.pagination({ page: state.page, totalPages: pages, href: () => '#', inputId: 'pj-page' });
      if (pages > 1) C.wirePagination(mount, 'pj-page', state.page, pages, (t) => { state.page = t; renderMain(); });
    }
    mount.querySelectorAll('.view-switch__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    renderActiveFilters();
    try { history.replaceState(null, '', `#/app/projects?view=${state.view}`); } catch { /* nicht kritisch */ }
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
    if (state.q.trim()) pills.push({ label: `Suche: „${state.q.trim()}“`, remove: 'q' });
    const sp = selPill(); if (sp) pills.push(sp);
    state.filters.status.forEach((v) => pills.push({ label: statusLabel(core, v), remove: `status:${v}` }));
    state.filters.sia.forEach((v) => pills.push({ label: v, remove: `sia:${v}` }));
    state.filters.sub.forEach((v) => pills.push({ label: v, remove: `sub:${v}` }));
    box.innerHTML = C.activeFilters({ filters: pills });
  }

  // --- chrome (once) ------------------------------------------------------
  const filterPanel = `
      ${C.filterGroup({ dim: 'status', legend: 'Status', selected: state.filters.status, options: projectStatuses.map((s) => ({ value: s.id, label: s.label })) })}
      ${C.filterGroup({ dim: 'sia', legend: 'SIA-Phase', selected: state.filters.sia, options: phases.map((p) => ({ value: p, label: p })) })}
      ${C.filterGroup({ dim: 'sub', legend: 'Teilportfolio', selected: state.filters.sub, options: subPortfolios.map((s) => ({ value: s, label: s })) })}
      <div class="catbar__panel__actions"><button type="button" class="btn btn--bare btn--sm" id="pj-freset">${C.icon('Refresh', 'icon--base')}<span class="btn__text">Zurücksetzen</span></button></div>`;

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({ title: 'Bauprojekte / EPPM', lead: 'Laufende und abgeschlossene Bauprojekte des BBL — Enterprise Portfolio and Project Management. Führungssystem ist SAP ePPM; diese Ansicht ist eine Leseansicht.' })}
    ${C.catalogueBar({
      formId: 'pj-search', inputId: 'pj-q', searchLabel: 'Projekt, Nummer, Projektleitung oder Gebäude suchen',
      placeholder: 'Projekt, Nummer, PL oder Gebäude suchen…', countId: 'pj-count',
      sort: { id: 'pj-sort', label: 'Sortierung', value: state.sort, options: SORT_OPTS },
      filterId: 'pj-filter-btn', filterLabel: 'Filter', panelId: 'pj-filters', panel: filterPanel,
      view: state.view, views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List'], ['map', 'Kartenansicht', 'Map']],
    })}
    <div id="pj-activefilters"></div>
    <div class="pf-layout">
      <aside class="pf-sidebar" aria-label="Projektstruktur">
        <div class="pf-sidebar__head"><h2 class="pf-sidebar__title">Projekte</h2>
          <button type="button" class="btn btn--bare btn--sm" id="pj-clear" hidden>${C.icon('Cancel', 'icon--base')}<span class="btn__text">Auswahl</span></button></div>
        ${treeHTML()}
      </aside>
      <div class="pf-main" id="pj-main"></div>
    </div>
  </div>`;

  // --- wiring -------------------------------------------------------------
  let searchT = null;
  const q = mount.querySelector('#pj-q');
  const runSearch = () => { state.q = q.value || ''; state.page = 1; renderMain(); };
  mount.querySelector('#pj-search').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(searchT); runSearch(); });
  q.addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(runSearch, 250); });

  mount.querySelector('.view-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('.view-switch__btn'); if (!btn) return;
    state.view = btn.dataset.view; state.page = 1; renderMain();
  });

  const sortSel = mount.querySelector('#pj-sort');
  if (sortSel) sortSel.addEventListener('change', () => { state.sort = sortSel.value; state.page = 1; renderMain(); });

  const fbtn = mount.querySelector('#pj-filter-btn');
  const fpanel = mount.querySelector('#pj-filters');
  const fbadge = mount.querySelector('#pj-filter-btn .catbar__fcount');
  const updateFilterBadge = () => {
    const total = state.filters.status.length + state.filters.sia.length + state.filters.sub.length;
    fbadge.textContent = total ? `(${total})` : ''; fbadge.hidden = !total;
  };
  const syncFilterChecks = () => fpanel.querySelectorAll('input[data-fdim]').forEach((cb) => { cb.checked = (state.filters[cb.dataset.fdim] || []).includes(cb.value); });
  const clearFilters = () => { state.filters = { status: [], sia: [], sub: [] }; syncFilterChecks(); updateFilterBadge(); };
  fbtn.addEventListener('click', () => { const open = !fpanel.hidden; fpanel.hidden = open; fbtn.setAttribute('aria-expanded', String(!open)); });
  fpanel.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-fdim]'); if (!cb) return;
    const dim = cb.dataset.fdim, arr = state.filters[dim];
    if (cb.checked) { if (!arr.includes(cb.value)) arr.push(cb.value); } else state.filters[dim] = arr.filter((x) => x !== cb.value);
    updateFilterBadge(); state.page = 1; renderMain();
  });
  mount.querySelector('#pj-freset').addEventListener('click', () => { clearFilters(); state.page = 1; renderMain(); });

  mount.querySelector('#pj-activefilters').addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) { state.q = ''; q.value = ''; clearFilters(); setSelection({}, null, null); return; }
    const pill = e.target.closest('[data-remove]'); if (!pill) return;
    const tok = pill.dataset.remove;
    if (tok === 'q') { state.q = ''; q.value = ''; state.page = 1; renderMain(); }
    else if (tok === 'sel') { setSelection({}, null, null); }
    else { const i = tok.indexOf(':'), dim = tok.slice(0, i); state.filters[dim] = (state.filters[dim] || []).filter((x) => x !== tok.slice(i + 1)); syncFilterChecks(); updateFilterBadge(); state.page = 1; renderMain(); }
  });

  const clearBtn = mount.querySelector('#pj-clear');
  function markTree(activeNode) {
    mount.querySelectorAll('.pf-tree__node, .pf-tree__leaf').forEach((n) => n.classList.remove('is-active', 'is-path'));
    if (!activeNode) return;
    activeNode.classList.add('is-active');
    let li = activeNode.closest('.pf-tree__item');
    while (li) {
      const ul = li.parentElement;
      if (!ul || !ul.classList.contains('pf-tree__children')) break;
      const parentNode = ul.parentElement.querySelector(':scope > .pf-tree__node');
      if (parentNode) parentNode.classList.add('is-path');
      li = ul.parentElement;
    }
  }
  function setSelection(sel, activeNode, focus) {
    state.sel = sel; state.focus = focus || null; markTree(activeNode);
    clearBtn.hidden = !Object.keys(sel).length; state.page = 1; renderMain();
  }
  mount.querySelector('.pf-sidebar').addEventListener('click', (e) => {
    const leafBtn = e.target.closest('.pf-tree__leaf');
    if (leafBtn) {
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

  mount.querySelector('#pj-main').addEventListener('click', (e) => {
    const a = e.target.closest('.pagination_items a'); if (!a) return;
    e.preventDefault();
    state.page += /Nächste/.test(a.getAttribute('aria-label') || '') ? 1 : -1;
    renderMain();
  });

  renderMain();
}

// ---- detail -------------------------------------------------------------
function detail(ctx, id) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  freePjMap();
  const p = core.project(id);
  if (!p) {
    mount.innerHTML = C.notFound({ backHref: '#/app/projects', backLabel: 'Bauprojekte',
      title: 'Projekt nicht gefunden',
      body: 'Dieses Bauprojekt existiert nicht. <a href="#/app/projects">Zur Übersicht «Bauprojekte»</a>' });
    return;
  }
  setTitle(p.name);
  setCrumbs([...CRUMBS, { label: 'Bauprojekte / EPPM', href: '#/app/projects' }, { label: p.name }]);

  // Standort und Bild kommen aus dem Projektdatensatz selbst (siehe overview()).
  // `buildingId` bleibt nur als Querverweis ins Liegenschaftsinventar — der Link
  // wird gesetzt, ohne den Gebäudebestand zu lesen.
  const ort = [p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  // Bilder samt Nachweis stehen im Projektdatensatz (`media`) — dieselbe Form
  // wie `bilder` am Gebäude, damit die gemeinsame Galerie sie ohne Umbau
  // anzeigt. Ein Bestand, den niemand liest, verfällt; deshalb hängt am Hero
  // die Vollbildgalerie statt eines toten Feldes.
  const galleryItems = (p.media || []).map((x, i) => ({
    id: `${p.projectId}-bild-${i}`,
    photo: '', photoSrc: x.src, title: x.titel || p.name,
    meta: [x.fotograf && `© ${x.fotograf}`, p.city].filter(Boolean).join(' · '),
    type: 'foto',
    details: [
      ['Titel', x.titel || p.name],
      x.fotograf && ['Fotograf:in', x.fotograf],
      x.credit && ['Copyright', x.credit],
      x.lizenz && ['Lizenz', x.lizenz],
      x.quelle && ['Quelle', x.quelle],
    ].filter(Boolean),
  }));
  const tabs = [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'kennzahlen', label: 'Kennzahlen' },
    { id: 'risiken', label: 'Risiken & Ziele' },
  ];
  let active = query.get('tab') || 'uebersicht';
  if (!tabs.some(t => t.id === active)) active = 'uebersicht';

  function panelUebersicht() {
    return `<dl class="kv">
      <dt>Projektnummer</dt><dd>${C.escape(p.projectNumber)}</dd>
      <dt>Standort</dt><dd>${C.escape(p.siteName || '—')}${ort ? `<br><span class="small muted">${C.escape(ort)}</span>` : ''}</dd>
      <dt>Objekt im Inventar</dt><dd>${p.buildingId
        ? `<a href="#/app/portfolio?id=${encodeURIComponent(p.buildingId)}">${C.escape(p.buildingId)}</a>` : '—'}</dd>
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
        <p class="small muted mt-2" style="margin-top:.5rem">${C.escape(desc)}</p>
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
    return `<div class="grid grid--2">
      ${row('CheckmarkCircle', 'Projektziele', p.zielAmpel, zielDesc)}
      ${row('WarningCircle', 'Risiken', p.risikoAmpel, risikoDesc)}
    </div>
    ${C.notification('Ampelbewertung gemäss BBL-Projektreporting (Demo-Daten): <strong>Grün</strong> = im Plan, <strong>Gelb</strong> = unter Beobachtung, <strong>Rot</strong> = kritisch.', 'info')}`;
  }
  const panels = { uebersicht: panelUebersicht, kennzahlen: panelKennzahlen, risiken: panelRisiken };

  // Titelbild: ohne Bilder eine Farbfläche wie bisher, mit Bildern ein Knopf,
  // der die Vollbildgalerie öffnet. Der Nachweis steht als Bildlegende darunter —
  // die Aufnahmen der BBL-Mediendatenbank sind nicht frei lizenziert, ein Bild
  // ohne Urheberangabe wäre hier schlicht falsch.
  function heroFigure() {
    const bild = C.photo({
      src: p.photoSrc, color: '#2f4356', alt: `${p.name}${p.siteName ? ' — ' + p.siteName : ''}`, w: 1600,
      style: 'aspect-ratio:21/9;max-height:22rem;border-radius:var(--radius-lg)',
    });
    if (!galleryItems.length) return `<div style="margin-top:1rem">${bild}</div>`;
    const m = p.media[0];
    return `<figure class="pj-hero">
      <button type="button" class="pj-hero__btn" data-gallery="0"
        aria-label="Bildergalerie öffnen — ${galleryItems.length} Aufnahme${galleryItems.length === 1 ? '' : 'n'}">${bild}</button>
      <figcaption class="legend">${C.escape(m.titel || p.name)}${
        m.credit ? ` — ${C.escape(m.credit)}` : ''}${
        galleryItems.length > 1 ? ` · ${galleryItems.length} Aufnahmen` : ''}</figcaption>
    </figure>`;
  }

  function draw() {
    mount.innerHTML = `
    <div class="container section">
      ${/* Kopf wie im Liegenschaften Inventar: Rücksprung, Titel, Fakten als
            Lead-Zeile. Die frühere Abzeichenreihe (`pill-row` mit Status und
            zwei Ampeln) ist entfallen — das Inventar kennt sie nicht, und drei
            farbige Abzeichen ÜBER dem Titel lasen sich vor dem Projektnamen.
            Der Status steht jetzt als Wort in der Lead-Zeile, die beiden Ampeln
            im Reiter «Risiken & Ziele», wo ihre Erklärung danebensteht. */''}
      ${C.backLink('#/app/projects', 'Bauprojekte')}
      <h1 tabindex="-1">${C.escape(p.name)}</h1>
      <p class="lead">${C.escape(p.projectNumber)}${p.siteName ? ' · ' + C.escape(p.siteName) : ''}${
        p.city ? ', ' + C.escape(p.city) : ''} · ${C.escape(statusLabel(core, p.status))}</p>
      ${heroFigure()}
      ${C.tabBar({ items: tabs, active, idPrefix: 'pj-tab', ariaLabel: 'Projektdetails', controlsClass: 'mt-6' })}
      ${C.tabPanels({ items: tabs, active, idPrefix: 'pj-tab', render: (t) => panels[t]() })}
    </div>`;
    C.wireTabs(mount, {
      syncHash: (tab) => history.replaceState(null, '', `#/app/projects/${p.projectId}${tab === 'uebersicht' ? '' : '?tab=' + tab}`),
    });
    // Innerhalb von draw(), weil jeder Reiterwechsel neu zeichnet.
    mount.querySelector('.pj-hero__btn')?.addEventListener('click', () =>
      openGallery(galleryItems, 0, C, { param: 'bild' }));
    window.scrollTo(0, 0);
    const h = mount.querySelector('h1'); if (h) h.focus({ preventScroll: true });
  }
  draw();
}
