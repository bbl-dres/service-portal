// Tenant catalogue and detail views, including the shared read-only floor plan.

import { floorplanSvg, floorplanLegend, wireFloorplan, COLOR_MODES } from '../ui/floorplan.js';
import { initEstateMap } from '../map/buildings-map.js';
import { createMapSlot } from '../map/map-slot.js';
import { treeHTML, wireTree, restoreTreeSelection, syncTreeCounts, markTree } from '../ui/spatial-tree.js';
import { heroMosaic, galleryItemsFrom, wireHeroMosaic } from '../ui/hero-mosaic.js';
import { openGallery, restoreGalleryFromQuery } from '../ui/gallery.js';
import { formatNumber, formatCurrency, formatArea, formatDate } from '../format.js';
import { countryName, statusLabel } from '../domain.js';
import { APPLICATIONS } from '../crumbs.js';
import * as links from '../links.js';
import { preparePage, uniqueOptions } from '../collections.js';

export const needs = ['tenancies', 'floors', 'spaces', 'contracts'];

const CRUMBS = APPLICATIONS;
// Adapt the persisted German registry schema at the app boundary.
const tenancyView = (tenancyRecord) => ({
  ...tenancyRecord,
  country: tenancyRecord['land'],
  administrativeUnit: tenancyRecord['ve'],
  administrativeUnitName: tenancyRecord['veName'],
  images: tenancyRecord['bilder'],
});

const monthsUntil = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return Math.max(0, Math.round((d - new Date()) / (30.44 * 86400000)));
};

const remainingTermBadge = (C, iso) => {
  const m = monthsUntil(iso);
  if (m == null) return '';
  return C.badge(m < 24 ? `noch ${m} Monate` : `noch ${Math.floor(m / 12)} Jahre`,
    m <= 12 ? 'warning' : m <= 36 ? 'info' : 'success');
};

export default async function render(ctx) {
  const { params } = ctx;
  if (params[0]) return detail(ctx, params[0]);
  return overview(ctx);
}

const mtMap = createMapSlot();

function overview(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs, onUnmount } = ctx;
  mtMap.free();
  onUnmount(mtMap.free);
  setTitle('Mietende');
  setCrumbs([...CRUMBS, { label: 'Mietende' }]);

  const all = core.tenancies().map(tenancyView);
  const esc = C.escape;

  const SORTS = {
    name: (a, b) => a.buildingName.localeCompare(b.buildingName, 'de'),
    area: (a, b) => b.areaHnf - a.areaHnf,

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
    view: ['gallery', 'list', 'map'].includes(query.get('view')) ? query.get('view') : 'gallery',
    q: (query.get('q') || '').trim(),
    sort: SORT_OPTS.some((o) => o.value === query.get('sort')) ? query.get('sort') : 'end',
    page: Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1),
    perPage: { gallery: 9, list: 25 },

    filters: { administrativeUnits: (query.get('ve') || '').split(',').filter((v) => all.some((t) => t.administrativeUnit === v)) },
    sel: {},
  };

  for (const [key, param] of [['country', 'land'], ['region', 'region'], ['city', 'city'], ['id', 'obj']]) {
    const v = query.get(param);
    if (v) state.sel[key] = v;
  }

  const inSel = (t) => (!state.sel.id || t.tenancyId === state.sel.id)
    && (!state.sel.country || t.country === state.sel.country)
    && (!state.sel.region || t.canton === state.sel.region)
    && (!state.sel.city || t.city === state.sel.city);
  const inFilters = (t) => !state.filters.administrativeUnits.length || state.filters.administrativeUnits.includes(t.administrativeUnit);
  const inSearch = (t) => {
    const q = state.q.trim().toLowerCase();
    return !q || `${t.buildingName} ${t.city} ${t.administrativeUnitName} ${t.department} ${t.tenancyId} ${t.street}`.toLowerCase().includes(q);
  };
  const filtered = () => all.filter((t) => inSel(t) && inFilters(t) && inSearch(t));

  const treeMarkup = treeHTML(C, all, {
    levels: [
      { key: 'country', icon: 'Globe', label: (k) => countryName(k) },
      { key: 'canton', attr: 'region', icon: 'Map' },
      { key: 'city', icon: 'MapMarker' },
    ],
    leaf: { icon: () => 'Home', idText: (t) => t.administrativeUnit, label: (t) => t.buildingName,
      objId: (t) => t.tenancyId, sort: (a, b) => a.buildingName.localeCompare(b.buildingName, 'de') },
  });

  const card = (t) => C.card({
    title: t.buildingName,
    desc: `${t.administrativeUnitName} · ${t.department}`,
    href: links.tenancy(t.tenancyId),
    photo: { src: t.photoSrc, color: 'var(--color-secondary-600)', alt: `${t.buildingName}, ${t.city}` },
    chips: [t.administrativeUnit, t.floorLabels.join(' + ')],
    footerInfo: `${formatArea(t.areaHnf)} · ${t.workstations} AP`,
    footerAction: C.cardAction(),
  });
  const galleryHTML = (slice) => `<div class="pf-gallery">${slice.map(card).join('')}</div>`;

  const listHTML = (slice) => C.table({
    caption: 'Mietverhältnisse', zebra: true, rowsClickable: true,
    columns: [
      { key: 'buildingName', label: 'Objekt', render: (t) => `<a href="${links.tenancy(t.tenancyId)}">${esc(t.buildingName)}</a><br><span class="small muted">${esc(t.street)}, ${esc(t.zip)} ${esc(t.city)}</span>` },
      { key: 'administrativeUnit', label: 'Verwaltungseinheit', render: (t) => `${esc(t.administrativeUnit)}<br><span class="small muted">${esc(t.department)}</span>` },
      { key: 'floors', label: 'Geschosse', render: (t) => esc(t.floorLabels.join(', ')) },
      { key: 'areaHnf', label: 'Fläche', align: 'right', render: (t) => formatArea(t.areaHnf) },
      { key: 'workstations', label: 'AP', align: 'right', render: (t) => String(t.workstations) },
      { key: 'leaseEnd', label: 'Vertragsende', render: (t) => `${formatDate(t.leaseEnd)}<br>${remainingTermBadge(C, t.leaseEnd)}` },
    ],
    rows: slice,
  });

  async function mountMap(list) {
    const el = mount.querySelector('#mt-map-el');
    if (!el) return;
    const points = list.filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lon))
      .map((t) => ({ lat: t.lat, lon: t.lon, label: t.buildingName, bblId: t.tenancyId,
        sub: `${t.administrativeUnit} · ${t.floorLabels.join(' + ')} · ${formatArea(t.areaHnf)}`,
        href: links.tenancy(t.tenancyId) }));
    await mtMap.mount(el, (node) => initEstateMap(node, points, { type: 'FeatureCollection', features: [] }, state.sel.id || null));
  }

  const syncTree = () => syncTreeCounts(mount.querySelector(".pf-tree"),
    all.filter((t) => inSearch(t) && inFilters(t)),
    (t) => [t.country, t.canton, t.city], (t) => t.tenancyId);

  function renderMain() {
    syncTree();

    history.replaceState(history.state, '', C.catalogueHash('#/app/tenancies', {
      q: state.q, page: state.page, view: state.view,
      sort: state.sort === 'end' ? '' : state.sort,
      've': state.filters.administrativeUnits,
      'land': state.sel.country, 'region': state.sel.region, 'city': state.sel.city, 'obj': state.sel.id,
    }));

    mount.querySelectorAll('.view-switch__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    const filteredRows = filtered();
    const pageSize = state.perPage[state.view] || Math.max(1, filteredRows.length);
    const { sorted: list, visible, page, totalPages } = preparePage(filteredRows, {
      compare: SORTS[state.sort] || SORTS.end,
      page: state.page,
      perPage: pageSize,
    });
    const pages = state.view === 'map' ? 1 : totalPages;
    if (state.view !== 'map') state.page = page;
    const cnt = mount.querySelector('#mt-count');
    const main = mount.querySelector('#mt-main');
    mtMap.free();

    const updateCount = (n, suffix = '') => {
      if (cnt) cnt.innerHTML = `<strong>${n}</strong> von ${all.length} Mietverhältnissen${suffix}`;
    };

    mount.querySelector('#mt-activefilters').innerHTML = C.activeFilters({
      filters: [
        ...(state.q ? [{ label: `Suche: «${state.q}»`, remove: 'q' }] : []),
        ...state.filters.administrativeUnits.map((v) => ({ label: v, remove: 'administrativeUnits:' + v })),
        ...(state.sel.city ? [{ label: state.sel.city, remove: 'sel' }]
          : state.sel.region ? [{ label: state.sel.region, remove: 'sel' }]
          : state.sel.country ? [{ label: countryName(state.sel.country), remove: 'sel' }] : []),
      ],
    });

    if (state.view === 'map') {

      updateCount(list.length);
      main.innerHTML = `<div class="pf-map dash-map" id="mt-map-el" role="group" aria-label="Karte der Mietverhältnisse"></div>`;
      mountMap(list);
      C.announceCatalogue({ count: list.length, total: all.length,
        unit: { nom: 'Mietverhältnisse', dat: 'Mietverhältnissen' },
        page: 1, totalPages: 1, view: state.view });
      return;
    }
    if (!list.length) {
      updateCount(0);

      main.innerHTML = C.empty('Keine Mietverhältnisse gefunden.', {
        hint: 'Passen Sie Ihre Suche, die Filter oder die Auswahl im Baum an.',
        action: { id: 'mt-empty-reset', label: 'Suche und Filter zurücksetzen' },
      });
      C.announceCatalogue({ count: 0, total: all.length,
        unit: { nom: 'Mietverhältnisse', dat: 'Mietverhältnissen' },
        page: 1, totalPages: 1, view: state.view });
      return;
    }
    updateCount(list.length, pages > 1 ? ` · Seite ${state.page} von ${pages}` : '');

    main.innerHTML = (state.view === 'gallery' ? galleryHTML(visible) : listHTML(visible))
      + C.pagination({ page: state.page, totalPages: pages, inputId: 'mt-page' });
    C.wirePagination(main, 'mt-page', state.page, pages, (p) => { state.page = p; renderMain(); });
    C.announceCatalogue({ count: list.length, total: all.length,
      unit: { nom: 'Mietverhältnisse', dat: 'Mietverhältnissen' },
      page: state.page, totalPages: pages, view: state.view });
  }

  const administrativeUnitOptions = [...new Set(all.map((t) => t.administrativeUnit))].sort()
    .map((v) => ({ value: v, label: `${v} (${all.filter((t) => t.administrativeUnit === v).length})` }));

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
      filterId: 'mt-filter', filterLabel: 'Filter', filterCount: state.filters.administrativeUnits.length, panelId: 'mt-filters',
      panel: C.filterGroup({ dim: 'administrativeUnits', legend: 'Verwaltungseinheit', selected: state.filters.administrativeUnits, options: administrativeUnitOptions })
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

  const clearBtn = mount.querySelector('#mt-clear');
  const sidebar = mount.querySelector('.pf-sidebar');
  const qEl = mount.querySelector('#mt-q');

  const clearSelection = () => {
    markTree(sidebar, null);
    clearBtn.hidden = true;
    state.sel = {};
    state.page = 1;
    renderMain();
  };

  const cat = C.wireCatalogueState(mount, {
    formId: 'mt-search', inputId: 'mt-q', sortId: 'mt-sort',
    filterToggleId: 'mt-filter', panelId: 'mt-filters', resetId: 'mt-reset',
    activeFiltersId: 'mt-activefilters', state,
    onChange: renderMain,
    onRemove: (tok) => { if (tok === 'sel') clearSelection(); },
    onReset: clearSelection,
  });
  onUnmount(cat.destroy);

  wireTree(sidebar, {
    attrs: ['country', 'region', 'city'], clearBtn,
    onSelect: (sel) => { state.sel = sel; state.page = 1; renderMain(); },
  });

  restoreTreeSelection(sidebar, state.sel, { attrs: ['country', 'region', 'city'], clearBtn });

  C.wireTableRows(mount.querySelector('#mt-main'));

  mount.querySelector('#mt-main').addEventListener('click', (e) => {
    if (!e.target.closest('#mt-empty-reset')) return;
    state.q = ''; qEl.value = '';
    cat.clearFilters();
    clearSelection();
  });

  renderMain();
}

function detail(ctx, id) {
  const { mount, query, core, engine, session, C, setTitle, setCrumbs, onUnmount } = ctx;
  const tenancyRecord = core.tenancy(id);
  if (!tenancyRecord) {
    C.renderNotFound(ctx, { thing: 'Dieses Mietverhältnis', title: 'Mietverhältnis nicht gefunden',
      backHref: '#/app/tenancies', backLabel: 'Mietende',
      crumbs: [...CRUMBS, { label: 'Mietende', href: '#/app/tenancies' }] });
    return;
  }
  const t = tenancyView(tenancyRecord);
  setTitle(t.buildingName);
  setCrumbs([...CRUMBS, { label: 'Mietende', href: '#/app/tenancies' }, { label: t.buildingName }]);

  const floors = core.floorsForTenancy(t);
  const contracts = core.contractsForBuilding(t.buildingId);

  const cases = (engine.instances() || []).filter((i) => i.linkedEntities && i.linkedEntities.buildingId === t.buildingId);

  // German tab and floor-plan mode values remain stable public-link adapters.
  const tabByLegacyValue = { 'uebersicht': 'overview', 'grundriss': 'floorplans', 'vertrag': 'contracts' };
  const legacyValueByTab = Object.fromEntries(Object.entries(tabByLegacyValue).map(([legacy, tab]) => [tab, legacy]));
  const tabs = [
    { id: 'overview', label: 'Übersicht' },

    { id: 'floorplans', label: `Grundrisse (${floors.length})` },
    { id: 'contracts', label: `Verträge (${contracts.length})` },

  ];
  let active = tabByLegacyValue[query.get('tab')] || 'overview';
  if (!tabs.some((x) => x.id === active)) active = 'overview';

  let floorId = query.get('floor') || '';
  if (floorId && !floors.some((f) => f.floorId === floorId)) floorId = '';

  if (floorId && !query.get('tab')) active = 'floorplans';

  const COLOR_DEFAULT = 've';
  let colorMode = COLOR_MODES.some((m) => m.value === query.get('color')) ? query.get('color') : COLOR_DEFAULT;
  let spaceId = query.get('space') || '';

  const syncHash = () => {
    const p = new URLSearchParams();
    if (active !== 'overview') p.set('tab', legacyValueByTab[active]);

    if (floorId) p.set('floor', floorId);
    if (colorMode !== COLOR_DEFAULT) p.set('color', colorMode);
    if (spaceId) p.set('space', spaceId);
    const qs = p.toString();
    history.replaceState(history.state, '', `${links.tenancy(t.tenancyId)}${qs ? '?' + qs : ''}`);
  };

  const galleryItems = galleryItemsFrom(t.images, {
    idPrefix: t.tenancyId, title: t.buildingName, location: t.city,
  });

  function overviewPanel() {

    const kpis = `<div class="kpi-strip">
      <div class="kpi-strip__item"><span class="kpi-strip__label">Fläche (HNF)</span>
        <span class="kpi-strip__value">${formatNumber(t.areaHnf)}<small> m²</small></span></div>
      <div class="kpi-strip__item"><span class="kpi-strip__label">Arbeitsplätze</span>
        <span class="kpi-strip__value">${t.workstations}</span></div>
      <div class="kpi-strip__item"><span class="kpi-strip__label">Fläche je Arbeitsplatz</span>
        <span class="kpi-strip__value">${(t.areaHnf / t.workstations).toFixed(1)}<small> m²</small></span></div>
      <div class="kpi-strip__item"><span class="kpi-strip__label">Jahresmiete</span>
        <span class="kpi-strip__value">${formatCurrency(t.yearlyCost)}</span></div>
    </div>`;

    const kv = `<dl class="kv">
      <dt>Verwaltungseinheit</dt><dd>${C.escape(t.administrativeUnitName)}<br><span class="small muted">${C.escape(t.department)}</span></dd>
      <dt>Objekt</dt><dd>${C.escape(t.buildingName)}<br><span class="small muted">${C.escape(t.street)}, ${C.escape(t.zip)} ${C.escape(t.city)}</span></dd>
      <dt>Geschosse</dt><dd>${C.escape(t.floorLabels.join(', '))}</dd>
      <dt>Mietbeginn</dt><dd>${formatDate(t.leaseStart)}</dd>
      ${

''}
      <dt>Vertragsende</dt><dd>${formatDate(t.leaseEnd)}</dd>
      <dt>Kostenstelle</dt><dd>${C.escape(t.costCentre)}</dd>
      <dt>Objekt im Inventar</dt><dd><a href="${links.portfolioItem(t.buildingId)}">${C.escape(t.buildingId)}</a></dd>
    </dl>`;

    return `<div class="detail-layout"><div>
        <section>
          <h2 class="detail-section__title">Vertrag und Mengengerüst</h2>
          ${kpis}
          ${kv}
        </section>
        ${
''}
        <section class="detail-section">
          <h2 class="detail-section__title">Anträge zu diesem Mietobjekt</h2>
          <div id="tenancy-case-table"></div>
        </section>
      </div>${asideHtml()}</div>`;
  }

  const asideHtml = () => `<aside class="detail-layout__aside" aria-label="Aktionen und Ansprechpersonen">
    ${C.actionCard({ lead: 'Für dieses Objekt vorbelegt.', links: actionLinks() })}
    ${C.contactCard({ contacts: (t.contacts || []).map((c) => ({
      label: c['rolle'], name: c.name, email: c.email, phone: c.phone })) })}
  </aside>`;

  function floorplansPanel() {
    return `<div id="tenancy-floorplan__body" class="floorplan-body">${
      floorplanBodyHtml()}</div>`;
  }

  const floorplanBodyHtml = () => !floors.length
    ? C.empty('Für dieses Mietverhältnis ist kein Grundriss hinterlegt.')
    : floorId ? floorplanView() : floorTable();

  const floorRows = () => floors.map((f) => {
    const sp = core.spacesForFloor(f.floorId);

    const assignedToTenant = sp.filter((s) => s['occupierVe'] === t.administrativeUnit);
    return {
      ...f,
      workplaces: sp.reduce((n, s) => n + (s.capacity || 0), 0),
      tenantRooms: assignedToTenant.length,
      tenantArea: assignedToTenant.reduce((n, s) => n + (s.area || 0), 0),
      occupancy: [...new Set(sp.map((s) => s['occupierVe']).filter(Boolean))].sort().join(', ') || '—',
    };
  });

  function floorTable() {
    return '<div id="tenancy-floor-table"></div>';
  }

  function floorplanView() {
    const floor = floors.find((f) => f.floorId === floorId) || floors[0];
    const spaces = core.spacesForFloor(floor.floorId);
    const sel = spaces.find((s) => s.spaceId === spaceId) || null;

    const floorSelector = `
        <div class="fp-floors" role="group" aria-label="Geschoss wechseln">${floors.map((f) => {
          const isActive = f.floorId === floor.floorId;

          return `<a class="tag-item${isActive ? ' tag-item--active' : ''}" href="${
            links.tenancy(t.tenancyId)}?floor=${encodeURIComponent(f.floorId)}" data-floor="${C.escape(f.floorId)}"${
            isActive ? ' aria-current="true"' : ''}><span class="tag-item__inner"><span class="tag-item__text">${
            C.escape(f.label)}</span></span></a>`;
        }).join('')}</div>`;

    const colorLabel = (COLOR_MODES.find((m) => m.value === colorMode) || {}).label || '';
    return `
      <div class="fp-wrap" id="fp-wrap">
        <div class="fp-head">
          <div class="fp-head__top">
            ${

''}
            <p class="fp-back"><a href="${links.tenancy(t.tenancyId)}?tab=grundriss" id="floorplan-back">${C.icon('ArrowLeft', 'icon--base')} Alle Geschosse</a></p>
            ${

''}
            ${floorSelector}
            ${

''}
            ${C.select({ id: 'fp-color', label: 'Einfärben nach', value: colorMode,
              size: 'sm', wrapClass: 'fp-color', options: COLOR_MODES })}
            <div class="fp-head__actions">
              <button class="btn btn--outline btn--sm" type="button" id="floorplan-fullscreen">
                ${C.icon('Expand', 'btn__icon icon--base')}<span class="btn__text">Vollbild</span></button>
              <button class="btn btn--outline btn--sm" type="button" id="floorplan-print">
                ${C.icon('Printer', 'btn__icon icon--base')}<span class="btn__text">Drucken</span></button>
            </div>
          </div>
        </div>
        <div class="fp-viewer">
          ${

''}
          <div class="fp-stage" id="fp-stage" data-scroll-region aria-label="Grundriss ${C.escape(floor.label)}">${floorplanSvg({ floor, spaces, mode: colorMode, selectedId: spaceId })}</div>
          <div class="fp-side">
            ${

''}
            <dl class="kv kv--tight fp-facts">
              <dt>Räume</dt><dd>${floor.rooms}</dd>
              <dt>Fläche (HNF)</dt><dd>${formatArea(floor.areaHnf)}</dd>
              <dt>Bruttofläche</dt><dd>${formatArea(floor.areaGross)}</dd>
            </dl>
            ${colorMode === 'none' ? '' : `<div>
              <h4 class="fp-side__title">Einfärbung: ${C.escape(colorLabel)}</h4>
              ${floorplanLegend(spaces, colorMode)}
            </div>`}
            <div class="fp-room-host" id="fp-room">${roomPanel(sel)}</div>
          </div>
        </div>
        ${

''}
        <p class="fp-print-foot">${C.escape(t.buildingName)} — ${C.escape(floor.label)} ·
          ${C.escape(t.street)}, ${C.escape(t.zip)} ${C.escape(t.city)} ·
          Einfärbung: ${C.escape(colorLabel)}</p>
      </div>`;
  }

  function roomPanel(s) {
    if (!s) return `<div class="box fp-room fp-room--empty"><p class="small muted">Wählen Sie einen Raum im Grundriss, um Details und passende Dienstleistungen zu sehen.</p></div>`;
    const kv = [
      ['Nutzung', s.useLabel],
      ['Fläche', `${s.area} m²`],
      ['SIA 416', `${s.siaLabel} (${s.sia})`],
      s.capacity ? ['Arbeitsplätze', String(s.capacity)] : null,
      ['Verwaltungseinheit', s['occupierVe'] || 'nicht zugeteilt'],
      s.bookable ? ['Buchbar', 'ja'] : null,
    ].filter(Boolean);
    return `<div class="box fp-room">
      <h3>${C.escape(s.roomNumber)}</h3>
      <dl class="kv kv--tight">${kv.map(([k, v]) => `<dt>${C.escape(k)}</dt><dd>${C.escape(v)}</dd>`).join('')}</dl>
      ${s.bookable ? `<a class="btn btn--outline btn--sm" href="#/app/room-booking?building=${encodeURIComponent(t.buildingId)}&room=${encodeURIComponent(s.spaceId)}" target="_blank" rel="noopener">${C.icon('External', 'btn__icon icon--base')}<span class="btn__text">Raum buchen</span></a>` : ''}
      ${
''}
      <h4 class="fp-room__sub">Vorgang starten</h4>
      ${serviceLinks(s)}
    </div>`;
  }

  function svc(serviceId) { return core.service(serviceId); }

  function serviceLink(serviceId, href) {
    const s = svc(serviceId);
    if (!s) return '';
    return `<a class="fp-svc" href="${href}" target="_blank" rel="noopener">
      <span>${C.escape(s.title)}</span>${C.icon('External', 'icon--sm fp-svc__go')}</a>`;
  }
  const buildingQuery = `building=${encodeURIComponent(t.buildingId)}`;
  function serviceLinks(s) {
    const roomQuery = s ? `&room=${encodeURIComponent(s.roomNumber)}` : '';
    return `<div class="fp-svc-list">
      ${serviceLink('stoerung-melden', `#/app/fault-report?${buildingQuery}${roomQuery}`)}
      ${serviceLink('kleinauftrag-gebaeude', `#/app/fault-report?type=kleinauftrag&${buildingQuery}${roomQuery}`)}
      ${serviceLink('umzug-anmelden', `#/app/fault-report?type=umzug&${buildingQuery}${roomQuery}`)}
    </div>`;
  }

  const actionLinks = () => [
    ['stoerung-melden', `#/app/fault-report?${buildingQuery}`],
    ['kleinauftrag-gebaeude', `#/app/fault-report?type=kleinauftrag&${buildingQuery}`],
    ['umzug-anmelden', `#/app/fault-report?type=umzug&${buildingQuery}`],
    ['raumbedarf-melden', `#/app/space-request?${buildingQuery}`],
    ['reklamation', `#/app/fault-report?type=reklamation&${buildingQuery}`],
  ].map(([sid, href]) => ({ label: (svc(sid) || {}).title, href, newWindow: true })).filter((l) => l.label)

    .concat({ label: 'Dokumente zum Gebäude', href: `#/app/document-archive?building=${encodeURIComponent(t.buildingId)}`, newWindow: true });

  const contractsPanel = () => '<div id="tenancy-contract-table"></div>';

  function dataTables() {
    return {
      'tenancy-floor-table': {
        id: 'tenancy-floor-data-table', rows: floorRows(), unit: { nom: 'Geschosse', dat: 'Geschossen' },
        caption: 'Geschosse dieses Mietverhältnisses', perPage: 10, rowsClickable: true,
        searchKeys: ['label', 'occupancy'],
        sorts: [
          { value: 'level', label: 'Niveau (unten zuerst)', cmp: (a, b) => a.level - b.level },
          { value: 'area', label: 'Fläche (grösste zuerst)', cmp: (a, b) => b.areaHnf - a.areaHnf },
          { value: 'rooms', label: 'Räume (meiste zuerst)', cmp: (a, b) => b.rooms - a.rooms },
        ],
        columns: [
          { key: 'label',
            label: 'Geschoss',
            render: (f) => `<a href="${links.tenancy(t.tenancyId)}?floor=${encodeURIComponent(f.floorId)}">${C.escape(f.label)}</a>${
              f.tenantRooms ? ` ${C.badge('Ihr Standort', 'success')}` : ''}` },
          { key: 'rooms', label: 'Räume', align: 'right', render: (f) => String(f.rooms) },
          { key: 'areaHnf', label: 'HNF', align: 'right', render: (f) => formatArea(f.areaHnf) },
          { key: 'workplaces', label: 'Arbeitsplätze', align: 'right', render: (f) => String(f.workplaces) },
          { key: 'tenantRooms', label: `Davon ${t.administrativeUnit}`, align: 'right',
            render: (f) => f.tenantRooms ? `${f.tenantRooms} <span class="small muted">(${formatArea(f.tenantArea)})</span>` : '<span class="muted">—</span>' },
        ],

        foot: (_visible, filteredRows) => `<tr>
          <th scope="row" class="text-left">Total (${filteredRows.length})</th>
          <td class="text-right">${filteredRows.reduce((n, f) => n + f.rooms, 0)}</td>
          <td class="text-right">${formatArea(filteredRows.reduce((n, f) => n + f.areaHnf, 0))}</td>
          <td class="text-right">${filteredRows.reduce((n, f) => n + f.workplaces, 0)}</td>
          <td class="text-right">${filteredRows.reduce((n, f) => n + f.tenantRooms, 0)}</td></tr>`,
      },
      'tenancy-contract-table': {
        id: 'tenancy-contract-data-table', rows: contracts, unit: { nom: 'Verträge', dat: 'Verträgen' },
        caption: 'Verträge zum Objekt',

        emptyMsg: 'Keine Verträge erfasst.',
        perPage: 10, searchKeys: ['contractId', 'type', 'contractPartner'],
        sorts: [
          { value: 'until', label: 'Gültig bis (nächstes zuerst)', cmp: (a, b) => String(a.validUntil).localeCompare(String(b.validUntil)) },
          { value: 'amount', label: 'Betrag (höchster zuerst)', cmp: (a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0) },
        ],
        facets: [{ dim: 'type', legend: 'Vertragsart', options: uniqueOptions(contracts, 'type', { locale: 'de' }), match: (r, v) => v.includes(String(r.type)) }],
        columns: [
          { key: 'contractId', label: 'Vertrag', render: (c) => C.escape(c.contractId) },
          { key: 'type', label: 'Art', render: (c) => C.escape(c.type) },
          { key: 'contractPartner', label: 'Partnerin', render: (c) => C.escape(c.contractPartner || '—') },
          { key: 'validFrom', label: 'Gültig ab', render: (c) => formatDate(c.validFrom) },
          { key: 'validUntil', label: 'Gültig bis', render: (c) => formatDate(c.validUntil) },
          { key: 'amount', label: 'Betrag', align: 'right', render: (c) => c.amount ? formatCurrency(c.amount) : '—' },
          { key: 'status', label: 'Status', render: (c) => C.badge(c.status || '—', c.status === 'aktiv' ? 'success' : 'gray') },
        ],
      },
      'tenancy-case-table': {

        id: 'tenancy-case-data-table', rows: cases, unit: { nom: 'Anträge', dat: 'Anträgen' },
        caption: 'Anträge zu diesem Mietobjekt',
        emptyMsg: 'Zu diesem Mietobjekt ist derzeit kein Antrag offen.',
        perPage: 10, searchKeys: ['reference', 'title', 'defName'],
        sorts: [{ value: 'updated', label: 'Aktualisiert (neuste zuerst)', cmp: (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) }],
        columns: [
          { key: 'reference', label: 'Referenz', render: (i) => `<a href="${links.caseDetails(i.instanceId)}">${C.escape(i.reference || i.instanceId)}</a>` },
          { key: 'title', label: 'Anliegen', render: (i) => C.escape(i.title || '—') },
          { key: 'defName', label: 'Ablauf', render: (i) => C.escape(i.defName || '—') },
          { key: 'status', label: 'Status', render: (i) => C.badge(statusLabel(core, i.status), 'info') },
          { key: 'updatedAt', label: 'Aktualisiert', render: (i) => formatDate(i.updatedAt || i.createdAt) },
        ],
      },
    };
  }

  const panels = { overview: overviewPanel, floorplans: floorplansPanel, contracts: contractsPanel };

  function draw() {

    const remainingTermChip = remainingTermBadge(C, t.leaseEnd);

    mount.innerHTML = `
    <div class="container section">
      ${

''}
      ${C.detailBar({ backHref: '#/app/tenancies', backLabel: 'Mietende' })}
      ${

''}
      <p class="eyebrow">${C.escape(t.tenancyId)} · Objekt ${C.escape(t.buildingId)}</p>
      <h1 tabindex="-1">${C.escape(t.buildingName)}</h1>
      <p class="lead">${C.escape(t.street)}, ${C.escape(t.zip)} ${C.escape(t.city)} · ${
        C.escape(t.administrativeUnit)} · ${C.escape(t.floorLabels.join(' + '))}</p>
      ${remainingTermChip ? `<p class="pill-row mt-2">${remainingTermChip}</p>` : ''}
      ${

''}
      ${heroMosaic(C, { items: galleryItems, id: 'mt-mosaic', mapId: 'mt-hero-map', lat: t.lat, lon: t.lon,
        mapLabel: `Standort von ${t.buildingName} auf der Karte` })}
      ${

''}
      <div class="tabs mt-6">
        ${C.tabBar({ items: tabs, active, idPrefix: 'mt-tab', ariaLabel: 'Mietverhältnis' })}
        ${C.tabPanels({ items: tabs, active, idPrefix: 'mt-tab', heading: true, render: (id2) => panels[id2]() })}
      </div>
    </div>`;

    C.wireTabs(mount, { syncHash: (tab) => { active = tab; syncHash(); } });

    wireFloorplanArea({ mountAllTables: true });
    wireHero();

  }

  function redrawFloorplan() {
    const host = mount.querySelector('#tenancy-floorplan__body');
    if (!host) return draw();
    if (detach) { detach(); detach = null; }
    unmountTable('tenancy-floor-table');

    const currentWrap = host.querySelector('#fp-wrap');
    if (currentWrap && floorId) {

      const template = document.createElement('template');
      template.innerHTML = floorplanView();
      const nextWrap = template.content.querySelector('#fp-wrap');
      currentWrap.replaceChildren(...nextWrap.childNodes);
    } else {

      host.innerHTML = floorplanBodyHtml();
    }
    wireFloorplanArea();
  }

  const heroMap = createMapSlot();
  async function wireHero() {

    wireHeroMosaic(mount, openGallery, galleryItems, C);
    restoreGalleryFromQuery(query, galleryItems, C);
    const el = mount.querySelector('#mt-hero-map');
    if (!el || !Number.isFinite(t.lat) || !Number.isFinite(t.lon)) { heroMap.free(); return; }
    await heroMap.mount(el, (node) => initEstateMap(node,
      [{ lat: t.lat, lon: t.lon, label: t.buildingName, sub: `${t.street}, ${t.zip} ${t.city}`, bblId: t.tenancyId }],
      { type: 'FeatureCollection', features: [] }, t.tenancyId, { focusPopup: false }));
  }

  const detachTables = new Map();
  function unmountTable(hostId) {
    const off = detachTables.get(hostId);
    if (off) { try { off(); } catch {  } }
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
  function wireFloorplanArea({ mountAllTables: allTables = false } = {}) {
    if (detach) { detach(); detach = null; }

    if (allTables) mountTables();
    else mountTable('tenancy-floor-table', dataTables()['tenancy-floor-table']);

    mount.querySelector('#floorplan-back')?.addEventListener('click', (e) => {
      e.preventDefault();

      if (document.fullscreenElement) document.exitFullscreen?.();
      floorId = ''; spaceId = '';
      syncHash(); redrawFloorplan();
      mount.querySelector('#tenancy-floor-table a')?.focus({ preventScroll: true });
    });
    const stage = mount.querySelector('#fp-stage');
    if (!stage) return;
    detach = wireFloorplan(stage, (sid) => {
      spaceId = spaceId === sid ? '' : sid;
      syncHash();
      redrawFloorplan();

      mount.querySelector(`[data-space="${CSS.escape(sid)}"] rect`)?.focus({ preventScroll: true });
    });
    mount.querySelector('#fp-color')?.addEventListener('change', (e) => {
      colorMode = e.target.value; syncHash(); redrawFloorplan();
      mount.querySelector('#fp-color')?.focus();
    });
    mount.querySelectorAll('[data-floor]').forEach((el) => el.addEventListener('click', (e) => {
      e.preventDefault();

      if (el.dataset.floor === floorId) return;
      floorId = el.dataset.floor; spaceId = '';
      syncHash(); redrawFloorplan();

      mount.querySelector(`[data-floor="${CSS.escape(floorId)}"]`)?.focus({ preventScroll: true });
    }));

    const wrap = mount.querySelector('#fp-wrap');
    const fullscreenButton = mount.querySelector('#floorplan-fullscreen');
    fullscreenButton?.addEventListener('click', () => {
      if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
      wrap?.requestFullscreen?.().catch(() => {  });
    });

    mount.querySelector('#floorplan-print')?.addEventListener('click', () => {
      document.body.classList.add('print--plan');
      const cleanupPrintMode = () => { document.body.classList.remove('print--plan'); window.removeEventListener('afterprint', cleanupPrintMode); };
      window.addEventListener('afterprint', cleanupPrintMode);
      window.print();

      setTimeout(cleanupPrintMode, 1000);
    });
  }

  onUnmount(() => {
    if (detach) detach();
    heroMap.free();
    detachTables.forEach((f) => { try { f(); } catch {  } });
    detachTables.clear();
  });
  draw();
}
