// Construction-project catalogue and detail views backed by the project registry.

import { initEstateMap } from '../map/buildings-map.js';
import { createMapSlot } from '../map/map-slot.js';
import { objectsToNodes } from '../ui/spatial-tree.js';
import { openGallery, restoreGalleryFromQuery } from '../ui/gallery.js';
import { heroMosaic, galleryItemsFrom, wireHeroMosaic } from '../ui/hero-mosaic.js';
import { formatCurrency, formatNumber, formatArea } from '../format.js';
import { countryName, businessEntityIdFromBblId, projectStatusLabel } from '../domain.js';
import { APPLICATIONS } from '../crumbs.js';
import * as links from '../links.js';

export const needs = ['projects'];
const pjMap = createMapSlot();

const CRUMBS = APPLICATIONS;

const PROJECT_STATUS_VARIANT = { 'geplant': 'info', 'aktiv': 'warning', 'sistiert': 'gray', 'abgeschlossen': 'success', 'abgebrochen': 'error' };

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

function projectStatusBadge(C, core, status) { return C.badge(projectStatusLabel(core, status), PROJECT_STATUS_VARIANT[status] || 'gray'); }

function overview(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  pjMap.free();
  setTitle('Bauprojekte / EPPM');
  setCrumbs([...CRUMBS, { label: 'Bauprojekte / EPPM' }]);

  const projectStatuses = core.ref().projectStatuses || [];

  const objects = core.projects().map((p) => ({
    ...p, id: p.projectId, country: p['land'],
    region: p.canton || '', businessEntity: p.buildingId ? businessEntityIdFromBblId(p.buildingId) : '',
    lon: p.lon, buildingName: p.siteName || p.buildingId,
  }));
  const subPortfolios = [...new Set(objects.map((o) => o.subPortfolio))].filter(Boolean);
  const phases = [...new Set(objects.map((o) => o.siaPhaseLabel))].filter(Boolean);

  const csv = (k) => (query.get(k) || '').split(',').filter(Boolean);
  const state = {

    view: ['map', 'gallery', 'list'].includes(query.get('view')) ? query.get('view') : 'gallery',
    sel: {}, focus: null,
    q: query.get('q') || '',
    sort: SORT_OPTS.some((o) => o.value === query.get('sort')) ? query.get('sort') : 'name',
    filters: { status: csv('status'), sia: csv('sia'), sub: csv('sub') },
    page: Math.max(1, parseInt(query.get('page'), 10) || 1),
    perPage: { gallery: 9, list: 25 },
  };

  const selectionQueryKeys = { 'land': 'country', 'region': 'region', 'city': 'city', 'we': 'businessEntity', 'id': 'id' };
  for (const [legacyKey, stateKey] of Object.entries(selectionQueryKeys)) {
    if (query.get(legacyKey)) state.sel[stateKey] = query.get(legacyKey);
  }
  if (state.sel.id) state.focus = state.sel.id;

  const inSel = (o) => (!state.sel.id || o.id === state.sel.id)
    && (!state.sel.country || o.country === state.sel.country) && (!state.sel.region || o.region === state.sel.region)
    && (!state.sel.city || o.city === state.sel.city) && (!state.sel.businessEntity || o.businessEntity === state.sel.businessEntity);
  const inFilters = (o) => (!state.filters.status.length || state.filters.status.includes(o.status))
    && (!state.filters.sia.length || state.filters.sia.includes(o.siaPhaseLabel))
    && (!state.filters.sub.length || state.filters.sub.includes(o.subPortfolio));
  const inSearch = (o) => { const q = state.q.trim().toLowerCase(); return !q || `${o.name} ${o.projectNumber} ${o.pm} ${o.buildingName} ${o.city}`.toLowerCase().includes(q); };
  const filtered = () => objects.filter((o) => inSel(o) && inFilters(o) && inSearch(o));

  const esc = C.escape;
  const TREE = {
    levels: [
      { key: 'country', icon: 'lucide/globe', label: (k) => countryName(k) },
      { key: 'region', icon: 'lucide/map' },
      { key: 'city', icon: 'lucide/map-pin' },
      // Bare number plus the level's own icon; «WE» stays for assistive
      // technology through `word` (as in portfolio.js).
      { key: 'businessEntity', attr: 'business-entity', icon: 'lucide/building',
        idText: (k) => String(k), word: 'Wirtschaftseinheit',
        label: (k, es) => (es[0] || {}).buildingName || '',
        sort: (a, b) => String(a).localeCompare(String(b)) },
    ],
    leaf: {
      icon: () => 'lucide/briefcase', idText: (o) => o.projectNumber,
      label: (o) => o.name, objId: (o) => o.id,
      sort: (a, b) => String(a.name).localeCompare(String(b.name), 'de'),
    },
  };

  function pjCard(o) {
    return C.card({
      title: o.name, desc: o.teaser, href: links.constructionProject(o.id),

      idLine: o.projectNumber,
      photo: { src: o.photoSrc, color: 'var(--color-secondary-600)', alt: `${o.name} — ${o.buildingName}` },
      chips: [countryName(o.country), projectStatusLabel(core, o.status)],
      footerInfo: `SIA ${esc(o.siaPhase)} · ${esc(o.siaPhaseLabel)}`,
      footerAction: C.cardAction(),
    });
  }
  const galleryHTML = (slice) => `<div class="pf-gallery">${slice.map(pjCard).join('')}</div>`;

  const listHTML = (slice) => C.table({ zebra: true, caption: 'Bauprojekte', rowsClickable: true, columns: [
    { key: 'projectNumber', label: 'Projektnr.', render: (o) => `<a href="${links.constructionProject(o.id)}">${esc(o.projectNumber)}</a>` },
    { key: 'name', label: 'Bezeichnung', render: (o) => `${esc(o.name)}<br><span class="small muted">${esc(o.buildingName)}</span>` },
    { key: 'location', label: 'Ort', render: (o) => `${esc(o.city)}<br><span class="small muted">${esc(countryName(o.country))}</span>` },
    { key: 'status', label: 'Status', render: (o) => projectStatusBadge(C, core, o.status) },
    { key: 'sia', label: 'SIA-Phase', render: (o) => `${esc(o.siaPhase)} · ${esc(o.siaPhaseLabel)}` },
    { key: 'plannedTotalCost', label: 'Investition', align: 'right', render: (o) => esc(formatCurrency(o.plannedTotalCost)) },
  ], rows: slice });
  async function mountMap(list, focus) {
    const el = mount.querySelector('#pj-map-el'); if (!el) return;
    const points = list.filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lon))
      .map((o) => ({ lat: o.lat, lon: o.lon, label: o.name, bblId: o.id, sub: `${o.projectNumber} · ${o.buildingName}`.trim(), href: links.constructionProject(o.id) }));
    await pjMap.mount(el, (node) => initEstateMap(node, points, { type: 'FeatureCollection', features: [] }, focus));
  }

  // Tree facets honor search and filters but ignore their own selection.
  const inTree = () => objects.filter((o) => inSearch(o) && inFilters(o));

  function renderMain() {
    paintTree();
    const list = filtered().sort(SORTS[state.sort] || SORTS.name);
    const cnt = mount.querySelector('#pj-count');
    const main = mount.querySelector('#pj-main');

    const pages = state.view === 'map' ? 1 : Math.max(1, Math.ceil(list.length / state.perPage[state.view]));
    if (state.page > pages) state.page = pages;
    pjMap.free();
    if (state.view === 'map') {
      if (cnt) cnt.innerHTML = `<strong>${list.length}</strong> ${list.length === 1 ? 'Projekt' : 'Projekte'}`;
      main.innerHTML = `<div class="pf-map dash-map" id="pj-map-el" role="group" aria-label="Karte der Bauprojekte"></div>`;
      mountMap(list, state.focus);
    } else if (!list.length) {
      if (cnt) cnt.innerHTML = `<strong>0</strong> von ${objects.length} Projekten`;

      main.innerHTML = C.empty('Keine Projekte gefunden.', {
        hint: 'Passen Sie Ihre Suche oder die Filter an.',
        action: { id: 'pj-empty-reset', label: 'Suche und Filter zurücksetzen' },
      });
    } else {
      const per = state.perPage[state.view];
      const slice = list.slice((state.page - 1) * per, state.page * per);
      if (cnt) cnt.innerHTML = `<strong>${list.length}</strong> von ${objects.length} Projekten${pages > 1 ? ` · Seite ${state.page} von ${pages}` : ''}`;

      main.innerHTML = (state.view === 'gallery' ? galleryHTML(slice) : listHTML(slice))
        + C.pagination({ page: state.page, totalPages: pages, inputId: 'pj-page' });
      if (pages > 1) C.wirePagination(mount, 'pj-page', state.page, pages, (t) => { state.page = t; renderMain(); });
    }
    mount.querySelectorAll('.view-switch__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    renderActiveFilters();

    C.announceCatalogue({ count: list.length, total: objects.length, unit: 'Projekten',
      page: state.page, totalPages: pages, view: state.view });

    try {
      history.replaceState(history.state, '', C.catalogueHash('#/app/projects', {
        q: state.q.trim(), page: state.page, view: state.view,
        sort: state.sort === 'name' ? '' : state.sort,
        status: state.filters.status, sia: state.filters.sia, sub: state.filters.sub,
        ...Object.fromEntries(Object.entries(selectionQueryKeys)
          .filter(([, stateKey]) => state.sel[stateKey])
          .map(([legacyKey, stateKey]) => [legacyKey, state.sel[stateKey]])),
      }));
    } catch {  }
  }

  const selPill = () => {
    const s = state.sel;
    if (!Object.keys(s).length) return null;
    const label = s.id ? ((objects.find((o) => o.id === s.id) || {}).name || s.id) : s.businessEntity ? `WE ${s.businessEntity}` : s.city || s.region || countryName(s.country);
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

      q: state.q,
      filterCount: state.filters.status.length + state.filters.sia.length + state.filters.sub.length,
      sort: { id: 'pj-sort', value: state.sort, options: SORT_OPTS },
      filterId: 'pj-filter-btn', filterLabel: 'Filter', panelId: 'pj-filters', panel: filterPanel,
      view: state.view, views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List'], ['map', 'Kartenansicht', 'Map']],
    })}
    <div id="pj-activefilters"></div>
    <div class="pf-layout">
      <aside class="pf-sidebar" aria-label="Projektstruktur">
        <!-- The tree selection is cleared through its chip in the active-filter
             row above, not through a second control in the head (as in
             portfolio.js). -->
        <div class="pf-sidebar__head"><h2 class="pf-sidebar__title">Projekte</h2></div>
        <div id="pj-tree"></div>
      </aside>
      <div class="pf-main" id="pj-main"></div>
    </div>
  </div>`;

  const onTreeSelect = (sel) => { state.sel = sel; state.focus = sel.id || null; state.page = 1; renderMain(); };

  const treeHost = mount.querySelector('#pj-tree');
  let dropTree = null;
  const paintTree = () => {
    if (dropTree) dropTree();
    dropTree = C.sidebarTree(treeHost, {
      id: 'pj-tree',
      mode: 'select',
      ariaLabel: 'Projektstruktur',
      // Only the top level uses icons; indentation communicates deeper levels.
      levels: [{ icons: true }, { icons: false }, { icons: false }, { icons: false }],
      // Translate the view's `id` key to the tree adapter's `obj` key here.
      sections: [objectsToNodes(inTree(), TREE, { ...state.sel, obj: state.sel.id })],
      onSelect: (node) => {
        const { obj, ...rest } = node.sel || {};
        onTreeSelect(obj ? { ...rest, id: obj } : rest);
      },
    });
  };
  ctx.onUnmount(() => { if (dropTree) dropTree(); });

  const resetSelection = () => onTreeSelect({});

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

  mount.querySelector('#pj-main').addEventListener('click', (e) => {
    if (!e.target.closest('#pj-empty-reset')) return;
    state.q = ''; qEl.value = '';
    cat.clearFilters();
    resetSelection();
  });

  C.wireTableRows(mount.querySelector('#pj-main'));

  renderMain();
}

function detail(ctx, id) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  pjMap.free();
  const p = core.project(id);
  if (!p) {

    C.renderNotFound(ctx, { thing: 'Dieses Bauprojekt', title: 'Projekt nicht gefunden',
      backHref: '#/app/projects', backLabel: 'Bauprojekte / EPPM',
      crumbs: [...CRUMBS, { label: 'Bauprojekte / EPPM', href: '#/app/projects' }] });
    return;
  }
  setTitle(p.name);
  setCrumbs([...CRUMBS, { label: 'Bauprojekte / EPPM', href: '#/app/projects' }, { label: p.name }]);

  const location = [p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const galleryItems = galleryItemsFrom(p.media, { idPrefix: p.projectId, title: p.name, location: p.city });
  // German tab values remain accepted as public-link compatibility literals.
  const tabByLegacyValue = { 'uebersicht': 'overview', 'kennzahlen': 'metrics', 'risiken': 'risks' };
  const legacyValueByTab = Object.fromEntries(Object.entries(tabByLegacyValue).map(([legacy, tab]) => [tab, legacy]));
  const tabs = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'metrics', label: 'Kennzahlen' },
    { id: 'risks', label: 'Risiken & Ziele' },
  ];
  let active = tabByLegacyValue[query.get('tab')] || 'overview';
  if (!tabs.some(t => t.id === active)) active = 'overview';

  function overviewPanel() {
    return `${p.teaser ? `<p class="lead mt-0">${C.escape(p.teaser)}</p>` : ''}
    <h2 class="detail-section__title">Projektdaten</h2>
    <dl class="kv">
      <dt>Projektnummer</dt><dd>${C.escape(p.projectNumber)}</dd>
      <dt>Standort</dt><dd>${C.escape(p.siteName || '—')}${location ? `<br><span class="small muted">${C.escape(location)}</span>` : ''}</dd>
      <dt>Objekt im Inventar</dt><dd>${p.buildingId
        ? `<a href="${links.portfolioItem(p.buildingId)}">${C.escape(p.buildingId)}</a>` : '—'}</dd>
      <dt>Projektleitung</dt><dd>${C.escape(p.pm || '—')}</dd>
      <dt>Teilportfolio</dt><dd>${C.escape(p.subPortfolio || '—')}</dd>
      <dt>SIA-Phase</dt><dd>${C.escape(p.siaPhase)} · ${C.escape(p.siaPhaseLabel)}</dd>
      <dt>BIM-Level</dt><dd>${C.escape(p.bimLevel || '—')}</dd>
      <dt>Laufzeit</dt><dd>${C.escape(p.start || '—')} – ${C.escape(p.end || '—')}</dd>
    </dl>`;
  }
  function metricsPanel() {
    // Planned cost by BKP Hauptgruppe (labels from the shared reference list);
    // the groups sum to plannedTotalCost by construction (build-project-report-data).
    const bkpGroups = core.ref().bkpGroups || [];
    const rows = bkpGroups
      .map((g) => ({ id: g.id, label: g.label, cost: Number((p.bkp || {})[g.id]) || 0 }))
      .filter((r) => r.cost > 0);
    const total = rows.reduce((sum, r) => sum + r.cost, 0) || Number(p.plannedTotalCost) || 0;
    const share = (cost) => `${formatNumber((cost / total) * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
    const kennwert = p.gf ? Math.round((Number(p.bkp2) || 0) / p.gf) : 0;
    const stat = (num, label) => `<div class="stat"><div class="stat__num">${C.escape(num)}</div><div class="stat__label">${C.escape(label)}</div></div>`;
    return `<div class="stats">
      ${stat(formatCurrency(p.plannedTotalCost), 'Geplante Gesamtkosten')}
      ${stat(formatCurrency(p.bkp2), 'BKP 2 — Gebäude')}
      ${p.gf ? stat(formatArea(p.gf), 'Geschossfläche GF (SIA 416)') : ''}
      ${kennwert ? stat(formatCurrency(kennwert), 'Kennwert BKP 2 je m² GF') : ''}
    </div>
    ${rows.length ? `<h2 class="detail-section__title mt-6">Kosten nach BKP-Hauptgruppen</h2>
    ${C.table({ zebra: true, caption: 'Kosten nach BKP-Hauptgruppen', columns: [
      { key: 'id', label: 'BKP', render: (r) => `<strong>${C.escape(r.id)}</strong>` },
      { key: 'label', label: 'Hauptgruppe' },
      { key: 'cost', label: 'Kosten', align: 'right', render: (r) => C.escape(formatCurrency(r.cost)) },
      { key: 'share', label: 'Anteil', align: 'right', render: (r) => C.escape(share(r.cost)) },
    ], rows, foot: `<tr><th scope="row" colspan="2">Total geplante Gesamtkosten</th>
      <td class="text-right"><strong>${C.escape(formatCurrency(total))}</strong></td>
      <td class="text-right"><strong>100.0 %</strong></td></tr>` })}` : ''}`;
  }
  function risksPanel() {
    const RISK_VARIANT = { 'tief': 'success', 'mittel': 'warning', 'hoch': 'error' };
    const RISK_LABEL = { 'tief': 'Tief', 'mittel': 'Mittel', 'hoch': 'Hoch' };
    return `<h2 class="detail-section__title">Meilensteine</h2>
    ${C.table({ zebra: true, caption: 'Meilensteine', emptyText: 'Keine Meilensteine erfasst.', columns: [
      { key: 'label', label: 'Meilenstein' },
      { key: 'geplant', label: 'Termin geplant' },
      { key: 'effektiv', label: 'Termin effektiv', render: (m) => C.escape(m.effektiv || '—') },
      { key: 'status', label: 'Status', render: (m) => m.effektiv ? C.badge('Erledigt', 'success') : C.badge('Offen', 'gray') },
    ], rows: p.meilensteine || [] })}
    <h2 class="detail-section__title mt-6">Risikoübersicht</h2>
    ${C.table({ zebra: true, caption: 'Risikoübersicht', emptyText: 'Keine Risiken erfasst.', columns: [
      { key: 'id', label: 'Nr.' },
      { key: 'thema', label: 'Risiko' },
      { key: 'einstufung', label: 'Einstufung', render: (r) => C.badge(RISK_LABEL[r.einstufung] || r.einstufung, RISK_VARIANT[r.einstufung] || 'gray') },
      { key: 'massnahme', label: 'Massnahme' },
    ], rows: p.risiken || [] })}`;
  }
  const panels = { overview: overviewPanel, metrics: metricsPanel, risks: risksPanel };

  function draw() {
    mount.innerHTML = `
    <div class="container section">
      ${

''}
      ${C.detailBar({ backHref: '#/app/projects', backLabel: 'Bauprojekte / EPPM' })}
      <h1 tabindex="-1">${C.escape(p.name)}</h1>
      <p class="lead">${C.escape(p.projectNumber)}${p.siteName ? ' · ' + C.escape(p.siteName) : ''}${
        p.city ? ', ' + C.escape(p.city) : ''} · ${C.escape(projectStatusLabel(core, p.status))}</p>
      ${heroMosaic(C, { id: 'pj-mosaic', items: galleryItems, mapId: 'pj-hero-map', lat: p.lat, lon: p.lon,
        mapLabel: `Standort von ${p.name} auf der Karte` })}
      ${

''}
      <div class="tabs mt-6">
        ${C.tabBar({ items: tabs, active, idPrefix: 'pj-tab', ariaLabel: 'Projektdetails' })}
        ${C.tabPanels({ items: tabs, active, idPrefix: 'pj-tab', heading: true, render: (t) => panels[t]() })}
      </div>
    </div>`;
    C.wireTabs(mount, {
      syncHash: (tab) => history.replaceState(history.state, '', `#/app/projects/${p.projectId}${tab === 'overview' ? '' : '?tab=' + legacyValueByTab[tab]}`),
    });

    wireHeroMosaic(mount, openGallery, galleryItems, C);
    restoreGalleryFromQuery(query, galleryItems, C);

    const mapEl = mount.querySelector('#pj-hero-map');
    if (mapEl && Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
      pjMap.mount(mapEl, (node) => initEstateMap(node, [{ lat: p.lat, lon: p.lon, label: p.name, bblId: p.projectId,
        sub: [p.projectNumber, location || p.siteName].filter(Boolean).join(' · ') }], null, p.projectId, { focusPopup: false }));
    } else if (mapEl) {
      mapEl.innerHTML = `<div class="empty empty--unavailable h-full">
        <span>Für dieses Projekt sind keine Koordinaten erfasst.</span></div>`;
    }
  }
  draw();
}
