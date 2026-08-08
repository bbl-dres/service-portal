// Workspace Management (Portal): object discovery, planning context, read-only
// floor-plan previews, and registers. Editing geometry/equipment and checking
// imported plans remain separate applications with their own write lifecycles.

import { initEstateMap } from '../map/buildings-map.js';
import { createMapSlot } from '../map/map-slot.js';
import { treeHTML, wireTree, restoreTreeSelection, syncTreeCounts, markTree } from '../ui/spatial-tree.js';
import { floorplanSvg, floorplanLegend, wireFloorplan, COLOR_MODES } from '../ui/floorplan.js';
import { heroMosaic, galleryItemsFrom, wireHeroMosaic } from '../ui/hero-mosaic.js';
import { openGallery, restoreGalleryFromQuery } from '../ui/gallery.js';
import { formatArea, formatNumber, formatDate } from '../format.js';
import { countryName } from '../domain.js';
import { APPLICATIONS, trail } from '../crumbs.js';
import { floorplanEditor } from '../links.js';

export const needs = ['buildings', 'floors', 'spaces', 'workspacePlanning'];

const BASE = '#/app/workspace';
const workspaceMap = createMapSlot();
const COLOR_DEFAULT = 've';

const PLAN_AVAILABILITY = {
  planned: { label: 'Multispace geplant', variant: 'success' },
  legacy: { label: 'Bestand vor Multispace', variant: 'gray' },
};
const FLOOR_STATES = {
  accepted: { label: 'abgenommen', variant: 'success' },
  not_synced: { label: 'nicht synchronisiert', variant: 'warning' },
  inventory: { label: 'Bestandsgrundriss', variant: 'gray' },
};
const SORT_OPTIONS = [
  { value: 'availability', label: 'Multispace-Planung zuerst' },
  { value: 'name', label: 'Bezeichnung (A–Z)' },
  { value: 'city', label: 'Ort (A–Z)' },
  { value: 'workplaces', label: 'Arbeitsplätze (meiste zuerst)' },
];
const SORTS = {
  availability: (a, b) => Number(b.planAvailability === 'planned') - Number(a.planAvailability === 'planned')
    || a.name.localeCompare(b.name, 'de'),
  name: (a, b) => a.name.localeCompare(b.name, 'de'),
  city: (a, b) => a.city.localeCompare(b.city, 'de') || a.name.localeCompare(b.name, 'de'),
  workplaces: (a, b) => b.workplaces - a.workplaces || a.name.localeCompare(b.name, 'de'),
};

const availabilityMeta = (key) => PLAN_AVAILABILITY[key] || PLAN_AVAILABILITY.legacy;
const floorMeta = (key) => FLOOR_STATES[key] || FLOOR_STATES.inventory;
const csv = (query, key) => (query.get(key) || '').split(',').map((value) => value.trim()).filter(Boolean);
const address = (building) => `${building.street}, ${building.zip} ${building.city}`.replace(/^,\s*/, '').trim();
const floorWord = (count) => `${formatNumber(count)} ${count === 1 ? 'Geschoss' : 'Geschosse'}`;
const syncValue = (value) => {
  const match = String(value || '').match(/^(\d{2})\.(\d{2})\.(\d{4}),\s*(\d{2}):(\d{2})$/);
  return match ? Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]), Number(match[5])) : 0;
};
const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

function orderMeta(planning) {
  if (!planning.orderStatus) return null;
  if (planning.orderStatus === 'completed') return { label: 'Auftrag abgeschlossen', variant: 'success' };
  if (planning.orderStatus === 'open' && planning.targetDate) {
    const overdue = planning.targetDate < todayKey();
    return {
      label: overdue
        ? `Auftrag offen · Stichtag überschritten – ${formatDate(planning.targetDate)}`
        : `Auftrag offen · Stichtag ${formatDate(planning.targetDate)}`,
      variant: overdue ? 'error' : 'warning',
    };
  }
  return { label: 'Auftrag offen', variant: 'warning' };
}

// The overlay contains only Workspace-specific facts. Everything countable
// from buildings/floors/spaces is derived here so catalogue and detail cannot
// drift from the Golden Record.
function joinedObjects(core) {
  return (core.data.workspacePlanning || []).map((planning) => {
    const building = core.building(planning.buildingId);
    if (!building) return null;
    const floorRows = core.floorsForBuilding(planning.buildingId);
    // The portal catalogue represents buildings for which a floor record can
    // actually be opened. Eichenweg stays out until its first floor is present.
    if (!floorRows.length) return null;
    const spaces = floorRows.flatMap((floor) => core.spacesForFloor(floor.floorId));
    const plannedFloorIds = new Set((planning.floors || []).map((floor) => floor.floorId));
    const plannedSpaces = spaces.filter((space) => plannedFloorIds.has(space.floorId));
    const equipment = (planning.equipmentGroups || [])
      .reduce((total, group) => total + (Number(group.count) || 0), 0);
    return {
      ...building,
      id: building.bbl_id,
      planning,
      planAvailability: planning.planAvailability || 'legacy',
      floors: floorRows.length,
      rooms: spaces.length,
      workplaces: spaces.reduce((total, space) => total + (Number(space.capacity) || 0), 0),
      equipment,
      plannedFloorCount: plannedFloorIds.size,
      plannedHnf: floorRows.filter((floor) => plannedFloorIds.has(floor.floorId))
        .reduce((total, floor) => total + (Number(floor.areaHnf) || 0), 0),
      workArea: plannedSpaces.filter((space) => space.group === 'arbeit')
        .reduce((total, space) => total + (Number(space.area) || 0), 0),
      region: building.canton,
      lon: building.lng,
    };
  }).filter(Boolean);
}

export default async function render(ctx) {
  const { params, query, core, C } = ctx;
  ctx.onUnmount(workspaceMap.free);

  // `building` keeps earlier cross-app links useful. Both forms are
  // canonicalised to ?id= the next time detail state is written.
  const rawId = query.get('id') || query.get('building') || params[0];
  const detailId = rawId ? C.safeDecode(rawId) : '';
  if (detailId) return detail(ctx, detailId);
  return catalogue(ctx, joinedObjects(core));
}

/* =============================== CATALOGUE =============================== */
function catalogue(ctx, objects) {
  const { mount, query, core, C, setTitle, setCrumbs, onUnmount } = ctx;
  workspaceMap.free();
  setTitle('Workspace Management');
  setCrumbs(trail(APPLICATIONS, { label: 'Workspace Management' }));

  if (!objects.length) {
    mount.innerHTML = `<div class="container section">
      ${C.pageHeader({ title: 'Workspace Management', lead: 'Arbeitsplätze und Ausstattung planen, verorten und bewirtschaften.' })}
      ${C.empty('Es sind keine Workspace-Objekte verfügbar.', { available: core.available('workspacePlanning') && core.available('buildings') })}
    </div>`;
    return;
  }

  const state = {
    q: (query.get('q') || '').trim(),
    view: ['gallery', 'list', 'map'].includes(query.get('view')) ? query.get('view') : 'gallery',
    sort: SORT_OPTIONS.some((option) => option.value === query.get('sort')) ? query.get('sort') : 'availability',
    page: Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1),
    perPage: { gallery: 9, list: 25 },
    filters: {
      plan: csv(query, 'plan').filter((value) => Object.hasOwn(PLAN_AVAILABILITY, value)),
    },
    sel: {},
  };

  const requestedObject = objects.find((item) => item.id === query.get('obj'));
  if (requestedObject) {
    state.sel = {
      country: requestedObject.country,
      region: requestedObject.region,
      city: requestedObject.city,
      id: requestedObject.id,
    };
  } else {
    let candidates = objects;
    for (const [key, legacyKey] of [['country', 'land'], ['region', 'region'], ['city', 'city']]) {
      const value = query.get(legacyKey);
      if (!value || !candidates.some((item) => item[key] === value)) break;
      state.sel[key] = value;
      candidates = candidates.filter((item) => item[key] === value);
    }
  }

  const inSelection = (item) => (!state.sel.id || item.id === state.sel.id)
    && (!state.sel.country || item.country === state.sel.country)
    && (!state.sel.region || item.region === state.sel.region)
    && (!state.sel.city || item.city === state.sel.city);
  const inSearch = (item) => {
    const value = state.q.trim().toLocaleLowerCase('de');
    return !value || `${item.name} ${item.id} ${item.street} ${item.zip} ${item.city} ${item.occupants}`
      .toLocaleLowerCase('de').includes(value);
  };
  const inFilters = (item) => !state.filters.plan.length || state.filters.plan.includes(item.planAvailability);
  const filtered = () => objects.filter((item) => inSelection(item) && inSearch(item) && inFilters(item));

  const treeMarkup = treeHTML(C, objects, {
    levels: [
      { key: 'country', icon: 'Globe', label: (value) => countryName(value) },
      { key: 'region', icon: 'Map' },
      { key: 'city', icon: 'MapMarker' },
    ],
    leaf: {
      icon: () => 'Building',
      idText: (item) => item.id.split('/')[2] || item.id,
      label: (item) => item.name,
      objId: (item) => item.id,
      sort: (a, b) => a.name.localeCompare(b.name, 'de'),
    },
  });

  const card = (item) => {
    const meta = availabilityMeta(item.planAvailability);
    return C.card({
      cls: 'workspace-card',
      photo: { src: item.photoSrc, id: item.photo, color: 'var(--color-secondary-600)', alt: `${item.name}, ${item.city}` },
      chips: [floorWord(item.floors), `${formatNumber(item.workplaces)} AP`],
      title: item.name,
      href: `${BASE}?id=${encodeURIComponent(item.id)}`,
      idLine: item.id,
      desc: `${address(item)}${item.occupants ? ` · ${item.occupants}` : ''}`,
      badges: [C.badge(meta.label, meta.variant, 'sm')],
      footerInfo: `${formatArea(item.hnf)} HNF · ${item.planAvailability === 'planned' ? `${formatNumber(item.equipment)} Ausstattung` : 'Planung offen'}`,
      footerAction: C.cardAction(),
    });
  };

  const galleryHtml = (rows) => `<div class="pf-gallery">${rows.map(card).join('')}</div>`;
  const listHtml = (rows) => C.table({
    caption: 'Workspace-Objekte', zebra: true, rowsClickable: true,
    columns: [
      { key: 'name', label: 'Objekt', render: (item) => `<a href="${BASE}?id=${encodeURIComponent(item.id)}">${C.escape(item.name)}</a><br><span class="small muted">${C.escape(item.id)}</span>` },
      { key: 'city', label: 'Ort', render: (item) => `${C.escape(item.city)}<br><span class="small muted">${C.escape(address(item))}</span>` },
      { key: 'floors', label: 'Geschosse', align: 'right', render: (item) => formatNumber(item.floors) },
      { key: 'workplaces', label: 'Arbeitsplätze', align: 'right', render: (item) => formatNumber(item.workplaces) },
      { key: 'equipment', label: 'Ausstattung', align: 'right', render: (item) => item.planAvailability === 'planned' ? formatNumber(item.equipment) : '<span class="muted">Planung offen</span>' },
      { key: 'planAvailability', label: 'Planungsverfügbarkeit', render: (item) => {
        const meta = availabilityMeta(item.planAvailability);
        return C.badge(meta.label, meta.variant, 'sm');
      } },
    ],
    rows,
  });

  async function mountMap(list) {
    const map = mount.querySelector('#workspace-map');
    if (!map) return;
    const points = list.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon)).map((item) => ({
      lat: item.lat,
      lon: item.lon,
      label: item.name,
      bblId: item.id,
      sub: `${address(item)} · ${item.workplaces} AP`,
      href: `${BASE}?id=${encodeURIComponent(item.id)}`,
    }));
    await workspaceMap.mount(map, (node) => initEstateMap(node, points,
      { type: 'FeatureCollection', features: [] }, state.sel.id || null));
  }

  const syncTree = () => syncTreeCounts(mount.querySelector('.pf-tree'),
    objects.filter((item) => inSearch(item) && inFilters(item)),
    (item) => [item.country, item.region, item.city], (item) => item.id);

  function renderMain() {
    syncTree();
    history.replaceState(history.state, '', C.catalogueHash(BASE, {
      q: state.q,
      page: state.page,
      view: state.view,
      sort: state.sort === 'availability' ? '' : state.sort,
      plan: state.filters.plan,
      'land': state.sel.country,
      region: state.sel.region,
      city: state.sel.city,
      obj: state.sel.id,
    }));
    mount.querySelectorAll('.view-switch__btn').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
    });

    const list = filtered().slice().sort(SORTS[state.sort] || SORTS.availability);
    const count = mount.querySelector('#workspace-count');
    const main = mount.querySelector('#workspace-main');
    const plannedCount = list.filter((item) => item.planAvailability === 'planned').length;
    workspaceMap.free();

    mount.querySelector('#workspace-activefilters').innerHTML = C.activeFilters({
      filters: [
        ...(state.q ? [{ label: `Suche: «${state.q}»`, remove: 'q' }] : []),
        ...state.filters.plan.map((value) => ({ label: availabilityMeta(value).label, remove: `plan:${value}` })),
        ...(state.sel.id ? [{ label: objects.find((item) => item.id === state.sel.id)?.name || state.sel.id, remove: 'sel' }]
          : state.sel.city ? [{ label: state.sel.city, remove: 'sel' }]
          : state.sel.region ? [{ label: state.sel.region, remove: 'sel' }]
          : state.sel.country ? [{ label: countryName(state.sel.country), remove: 'sel' }] : []),
      ],
    });

    const setCount = (suffix = '') => {
      if (count) count.innerHTML = `<strong>${list.length}</strong> von ${objects.length} Objekten · ${plannedCount} mit Multispace-Planung${suffix}`;
    };
    if (state.view === 'map') {
      setCount();
      main.innerHTML = '<div class="pf-map dash-map" id="workspace-map" role="group" aria-label="Karte der Workspace-Objekte"></div>';
      mountMap(list);
      C.announceCatalogue({ count: list.length, total: objects.length, unit: 'Objekten', view: 'map' });
      return;
    }
    if (!list.length) {
      setCount();
      main.innerHTML = C.empty('Keine Workspace-Objekte gefunden.', {
        hint: 'Passen Sie Ihre Suche, die Filter oder die Auswahl im Baum an.',
        action: { id: 'workspace-empty-reset', label: 'Suche und Filter zurücksetzen' },
      });
      C.announceCatalogue({ count: 0, total: objects.length, unit: 'Objekten', view: state.view });
      return;
    }

    const perPage = state.perPage[state.view];
    const totalPages = Math.max(1, Math.ceil(list.length / perPage));
    if (state.page > totalPages) state.page = totalPages;
    const visible = list.slice((state.page - 1) * perPage, state.page * perPage);
    setCount(totalPages > 1 ? ` · Seite ${state.page} von ${totalPages}` : '');
    main.innerHTML = (state.view === 'gallery' ? galleryHtml(visible) : listHtml(visible))
      + C.pagination({ page: state.page, totalPages, inputId: 'workspace-page', label: 'Seitennavigation Workspace-Objekte' });
    C.wirePagination(main, 'workspace-page', state.page, totalPages, (page) => {
      state.page = page;
      renderMain();
    });
    C.announceCatalogue({ count: list.length, total: objects.length, unit: 'Objekten', page: state.page, totalPages, view: state.view });
  }

  const planOptions = Object.entries(PLAN_AVAILABILITY).map(([value, meta]) => ({
    value,
    label: `${meta.label} (${objects.filter((item) => item.planAvailability === value).length})`,
  }));
  mount.innerHTML = `<div class="container section workspace-portal">
    ${C.pageHeader({
      title: 'Workspace Management',
      lead: 'Arbeitsplätze und Ausstattung planen, verorten und bewirtschaften. Wählen Sie ein Objekt – über die Galerie, die Liste oder die Karte.',
    })}
    ${C.catalogueBar({
      formId: 'workspace-search', inputId: 'workspace-q', searchLabel: 'Workspace-Objekt suchen',
      placeholder: 'Objekt, Ort oder Verwaltungseinheit suchen…', q: state.q,
      countId: 'workspace-count', count: '',
      sort: { id: 'workspace-sort', value: state.sort, options: SORT_OPTIONS },
      filterId: 'workspace-filter', filterLabel: 'Filter', filterCount: state.filters.plan.length,
      panelId: 'workspace-filters',
      panel: C.filterGroup({ dim: 'plan', legend: 'Planungsverfügbarkeit', selected: state.filters.plan, options: planOptions, idPrefix: 'workspace' })
        + C.panelReset({ id: 'workspace-reset' }),
      view: state.view,
      views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List'], ['map', 'Kartenansicht', 'Map']],
    })}
    <div id="workspace-activefilters"></div>
    <div class="pf-layout">
      <aside class="pf-sidebar workspace-sidebar" aria-label="Struktur der Workspace-Objekte">
        <div class="pf-sidebar__head"><h2 class="pf-sidebar__title">Standorte</h2>
          <button type="button" class="btn btn--bare btn--sm btn--icon-left" id="workspace-clear" hidden>${C.icon('Cancel', 'btn__icon icon--base')}<span class="btn__text">Auswahl zurücksetzen</span></button></div>
        ${treeMarkup}
      </aside>
      <div class="pf-main" id="workspace-main"></div>
    </div>
  </div>`;

  const sidebar = mount.querySelector('.workspace-sidebar');
  const clearButton = mount.querySelector('#workspace-clear');
  const searchInput = mount.querySelector('#workspace-q');
  const clearSelection = () => {
    markTree(sidebar, null);
    clearButton.hidden = true;
    state.sel = {};
    state.page = 1;
    renderMain();
  };
  const catalogueWire = C.wireCatalogueState(mount, {
    formId: 'workspace-search', inputId: 'workspace-q', sortId: 'workspace-sort',
    filterToggleId: 'workspace-filter', panelId: 'workspace-filters', resetId: 'workspace-reset',
    activeFiltersId: 'workspace-activefilters', state,
    onChange: renderMain,
    onRemove: (token) => { if (token === 'sel') clearSelection(); },
    onReset: clearSelection,
  });
  onUnmount(catalogueWire.destroy);

  wireTree(sidebar, {
    attrs: ['country', 'region', 'city'], clearBtn: clearButton,
    onSelect: (selection) => { state.sel = selection; state.page = 1; renderMain(); },
  });
  restoreTreeSelection(sidebar, state.sel, { attrs: ['country', 'region', 'city'], clearBtn: clearButton });
  onUnmount(C.wireTableRows(mount.querySelector('#workspace-main')));
  mount.querySelector('#workspace-main').addEventListener('click', (event) => {
    if (!event.target.closest('#workspace-empty-reset')) return;
    state.q = '';
    searchInput.value = '';
    catalogueWire.clearFilters();
    clearSelection();
  });
  renderMain();
}

/* ================================= DETAIL ================================ */
function detail(ctx, id) {
  const { mount, query, core, C, setTitle, setCrumbs, onUnmount } = ctx;
  workspaceMap.free();
  const item = joinedObjects(core).find((entry) => entry.id === id);
  if (!item) {
    C.renderNotFound(ctx, {
      title: 'Workspace-Objekt nicht gefunden', backHref: BASE, backLabel: 'Workspace Management',
      crumbs: trail(APPLICATIONS, { label: 'Workspace Management', href: BASE }),
      body: `Zu der ID «${C.escape(id)}» gibt es kein Workspace-Objekt mit hinterlegtem Geschoss. <a href="${BASE}">Zur Übersicht</a>`,
    });
    return;
  }

  const { planning } = item;
  const planFloors = new Map((planning.floors || []).map((floor) => [floor.floorId, floor]));
  const floors = core.floorsForBuilding(item.id).map((floor) => {
    const plan = planFloors.get(floor.floorId) || {};
    const spaces = core.spacesForFloor(floor.floorId);
    return {
      ...floor,
      ...plan,
      planned: planFloors.has(floor.floorId),
      planStatus: plan.planStatus || 'inventory',
      equipmentCount: Number.isFinite(Number(plan.equipmentCount)) ? Number(plan.equipmentCount) : null,
      rooms: spaces.length,
      workplaces: spaces.reduce((total, space) => total + (Number(space.capacity) || 0), 0),
    };
  }).sort((a, b) => a.level - b.level);
  const equipment = planning.equipmentGroups || [];
  const planned = item.planAvailability === 'planned';
  const tabByLegacyValue = { 'uebersicht': 'overview', 'grundrisse': 'floorplans', 'ausstattung': 'equipment' };
  const legacyValueByTab = Object.fromEntries(Object.entries(tabByLegacyValue).map(([legacy, tab]) => [tab, legacy]));
  const tabs = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'floorplans', label: `Grundrisse (${floors.length})` },
    { id: 'equipment', label: `Ausstattung (${equipment.length ? item.equipment : 0})` },
  ];

  let floorId = query.get('floor') || '';
  if (floorId && !floors.some((floor) => floor.floorId === floorId)) floorId = '';
  let active = tabByLegacyValue[query.get('tab')] || (floorId ? 'floorplans' : 'overview');
  if (!tabs.some((tab) => tab.id === active)) active = floorId ? 'floorplans' : 'overview';
  let colorMode = COLOR_MODES.some((mode) => mode.value === query.get('color')) ? query.get('color') : COLOR_DEFAULT;
  let spaceId = query.get('space') || '';
  if (!floorId || !core.spacesForFloor(floorId).some((space) => space.spaceId === spaceId)) spaceId = '';

  setTitle(item.name);
  setCrumbs(trail(APPLICATIONS, { label: 'Workspace Management', href: BASE }, { label: item.name }));

  const syncHash = () => {
    const params = new URLSearchParams({ id: item.id });
    // A floor already implies the Grundrisse register, so that common shared
    // link stays short. An overview with a remembered floor needs an explicit
    // tab; otherwise reloading it would unexpectedly reopen the preview.
    if ((active === 'overview' && floorId)
      || (active === 'floorplans' && !floorId)
      || !['overview', 'floorplans'].includes(active)) params.set('tab', legacyValueByTab[active]);
    if (floorId) params.set('floor', floorId);
    if (colorMode !== COLOR_DEFAULT) params.set('color', colorMode);
    if (spaceId) params.set('space', spaceId);

    // detail synchronises its independent tab/floor state.
    const liveQuery = new URLSearchParams((location.hash.split('?')[1] || ''));
    if (liveQuery.get('bild')) params.set('bild', liveQuery.get('bild'));
    history.replaceState(history.state, '', `${BASE}?${params}`);
  };

  const galleryItems = galleryItemsFrom(item.images, {
    idPrefix: item.id.replaceAll('/', '-'), title: item.name, location: item.city,
  });
  const availability = availabilityMeta(item.planAvailability);
  const order = orderMeta(planning);

  const metricArea = (value) => `${formatNumber(Math.round(Number(value) || 0))}<small> m²</small>`;
  const overviewPanel = () => `<div class="detail-layout workspace-overview">
    <div>
      <section>
        <h3 class="detail-section__title">${planned ? 'Ausstattung und Mengengerüst' : 'Workspace-Bestand'}</h3>
        <div class="kpi-strip" aria-label="Workspace-Kennzahlen">
          <div class="kpi-strip__item"><span class="kpi-strip__label">${planned ? 'HNF der geplanten Geschosse' : 'HNF der erfassten Geschosse'}</span><span class="kpi-strip__value">${metricArea(planned ? item.plannedHnf : floors.reduce((total, floor) => total + floor.areaHnf, 0))}</span></div>
          <div class="kpi-strip__item"><span class="kpi-strip__label">Arbeitsplätze</span><span class="kpi-strip__value">${formatNumber(item.workplaces)}</span></div>
          <div class="kpi-strip__item"><span class="kpi-strip__label">Ausstattung</span><span class="kpi-strip__value">${planned ? formatNumber(item.equipment) : '—'}</span></div>
          <div class="kpi-strip__item"><span class="kpi-strip__label">Arbeitsfläche je Arbeitsplatz</span><span class="kpi-strip__value">${planned && item.workArea && item.workplaces ? `${formatNumber(item.workArea / item.workplaces, { maximumFractionDigits: 1 })}<small> m²</small>` : '—'}</span></div>
        </div>
        <div class="mt-4">${planned
          ? C.notification('<p class="m-0"><strong>Prototypdaten:</strong> Ausstattungsgruppen und Planstände sind Annahmen für den Wireframe. Sie sind noch kein freigegebenes Mengengerüst oder Bestellnachweis.</p>', 'hint', 'InfoCircle')
          : C.notification('<p class="m-0">Für dieses Objekt ist noch keine Multispace-Planung erfasst. Die vorhandenen Bestandsgrundrisse können im Register «Grundrisse» schreibgeschützt angesehen werden.</p>', 'info', 'InfoCircle')}</div>
        <dl class="kv workspace-object-facts">
          <dt>Verwaltungseinheiten</dt><dd>${C.escape(item.occupants || 'Nicht erfasst')}</dd>
          <dt>Objekt</dt><dd>${C.escape(item.name)}<br><span class="small muted">${C.escape(address(item))}</span></dd>
          <dt>Geschosse gesamt</dt><dd>${formatNumber(item.totalFloors || floors.length)} · ${planned
            ? `davon ${formatNumber(item.plannedFloorCount)} mit Multispace-Planung`
            : `${floorWord(floors.length)} als Bestandsgrundriss im Portal`}</dd>
          <dt>Baujahr</dt><dd>${C.escape(String(item.buildYear || 'Nicht erfasst'))}</dd>
          <dt>Teilportfolio</dt><dd>${C.escape(item.portfolioCategory || 'Nicht erfasst')}</dd>
          <dt>Nettogeschossfläche (NGF)</dt><dd>${formatArea(item.ngf)}</dd>
          <dt>Hauptnutzfläche (HNF)</dt><dd>${formatArea(item.hnf)}</dd>
          ${planning.inventoryOrder ? `<dt>Inventarauftrag</dt><dd><span class="mono">${C.escape(planning.inventoryOrder)}</span></dd>` : ''}
          <dt>Liegenschaften-Inventar</dt><dd><a href="#/app/portfolio?id=${encodeURIComponent(item.id)}">Objekt im Inventar öffnen</a></dd>
        </dl>
      </section>
    </div>
    <aside class="detail-layout__aside" aria-label="Aktionen und Ansprechpersonen">
      ${actionPanel()}
      ${C.contactCard({ contacts: planning.contacts || [] })}
    </aside>
  </div>`;

  function actionPanel() {
    const buildingQuery = `building=${encodeURIComponent(item.id)}`;
    return C.actionCard({
      lead: 'Für dieses Objekt vorbelegt.',
      items: [
        { type: 'link', label: 'Grundriss im Plan-Editor bearbeiten', href: floorplanEditor(item.id),
          description: 'Eigenständige Anwendung · öffnet ein neues Fenster', newWindow: true },
        { type: 'disabled', label: 'Plan prüfen', description: 'Separate Anwendung folgt' },
        { type: 'button', id: 'workspace-export', label: 'Aggregierte Planannahmen exportieren', description: 'CSV aus den Prototypdaten', icon: 'Download', disabled: !equipment.length },
        { type: 'disabled', label: 'SIA-Flächennachweis erstellen', description: 'Fachreport folgt', icon: 'Printer' },
        { type: 'link', label: 'Ersatz- oder Reparaturauftrag', href: `#/app/fault-report?${buildingQuery}`, newWindow: true },
        { type: 'link', label: 'Raumbedarf melden', href: `#/app/space-request?${buildingQuery}`, newWindow: true },
      ],
    });
  }

  const floorPanel = () => `<div id="workspace-floor-body" class="floorplan-body">${floorBodyHtml()}</div>`;
  const floorBodyHtml = () => !floors.length
    ? C.empty('Für dieses Objekt ist kein Grundriss hinterlegt.')
    : floorId ? floorplanView() : '<div id="workspace-floor-table"></div>';
  const equipmentPanel = () => `<div class="mt-4">${planned
    ? C.notification('<p class="m-0">Die aggregierten Ausstattungsgruppen sind Prototypannahmen. Ein belastbares Mengengerüst benötigt Positionen je Gebäude, Geschoss, Raum, Modul und Artikel.</p>', 'hint', 'InfoCircle')
    : C.notification('<p class="m-0">Für den Bestand vor Multispace ist kein Ausstattungs-Mengengerüst hinterlegt.</p>', 'info', 'InfoCircle')}</div><div id="workspace-equipment-table" class="mt-4"></div>`;
  const panels = { overview: overviewPanel, floorplans: floorPanel, equipment: equipmentPanel };

  function roomPanel(space) {
    if (!space) return '<div class="box fp-room fp-room--empty"><p class="small muted">Wählen Sie einen Raum im Grundriss, um seine Bestandsdaten zu sehen.</p></div>';
    const facts = [
      ['Nutzung', space.useLabel],
      ['Fläche', `${space.area} m²`],
      ['SIA 416', `${space.siaLabel} (${space.sia})`],
      space.capacity ? ['Arbeitsplätze', String(space.capacity)] : null,
      ['Verwaltungseinheit', space['occupierVe'] || 'nicht zugeteilt'],
    ].filter(Boolean);
    const buildingQuery = `building=${encodeURIComponent(item.id)}&room=${encodeURIComponent(space.roomNumber)}`;
    return `<div class="box fp-room">
      <h3>${C.escape(space.roomNumber)}</h3>
      <dl class="kv kv--tight">${facts.map(([key, value]) => `<dt>${C.escape(key)}</dt><dd>${C.escape(value)}</dd>`).join('')}</dl>
      <h4 class="fp-room__sub">Vorgang starten</h4>
      <div class="fp-svc-list"><a class="fp-svc" href="#/app/fault-report?${buildingQuery}" target="_blank" rel="noopener"><span>Ersatz- oder Reparaturauftrag</span>${C.icon('External', 'icon--sm fp-svc__go')}</a></div>
    </div>`;
  }

  function floorplanView() {
    const floor = floors.find((entry) => entry.floorId === floorId) || floors[0];
    const spaces = core.spacesForFloor(floor.floorId);
    const selected = spaces.find((space) => space.spaceId === spaceId) || null;
    const colorLabel = COLOR_MODES.find((mode) => mode.value === colorMode)?.label || '';
    const status = floorMeta(floor.planStatus);
    const floorLinks = `<div class="fp-floors" role="group" aria-label="Geschoss wechseln">${floors.map((entry) => {
      const current = entry.floorId === floor.floorId;
      return `<a class="tag-item${current ? ' tag-item--active' : ''}" href="${BASE}?id=${encodeURIComponent(item.id)}&floor=${encodeURIComponent(entry.floorId)}" data-floor="${C.escape(entry.floorId)}"${current ? ' aria-current="true"' : ''}><span class="tag-item__inner"><span class="tag-item__text">${C.escape(entry.label)}</span></span></a>`;
    }).join('')}</div>`;

    return `<div class="fp-wrap" id="fp-wrap">
      <div class="fp-head">
        <div class="fp-head__top">
          <p class="fp-back"><a href="${BASE}?id=${encodeURIComponent(item.id)}&tab=grundrisse" id="workspace-floorplan-back">${C.icon('ArrowLeft', 'icon--base')} Alle Geschosse</a></p>
          ${floorLinks}
          ${C.select({ id: 'fp-color', label: 'Einfärben nach', value: colorMode, size: 'sm', wrapClass: 'fp-color', options: COLOR_MODES })}
          <div class="fp-head__actions">
            <button class="btn btn--outline btn--sm" type="button" id="workspace-floorplan-fullscreen">${C.icon('Expand', 'btn__icon icon--base')}<span class="btn__text">Vollbild</span></button>
            <button class="btn btn--outline btn--sm" type="button" id="workspace-floorplan-print">${C.icon('Printer', 'btn__icon icon--base')}<span class="btn__text">Drucken</span></button>
          </div>
        </div>
      </div>
      <div class="fp-viewer">
        <div class="fp-stage" id="fp-stage" data-scroll-region aria-label="Grundriss ${C.escape(floor.label)}">${floorplanSvg({ floor, spaces, mode: colorMode, selectedId: spaceId })}</div>
        <div class="fp-side">
          <div class="box fp-editor-action">
            <h2>Aktionen</h2>
            <p class="small muted">Bearbeitung und Speicherung erfolgen im eigenständigen Plan-Editor.</p>
            <a class="btn btn--filled btn--sm btn--full-width btn--icon-right" id="workspace-plan-editor" href="${floorplanEditor(item.id, floor.floorId)}" target="_blank" rel="noopener">
              <span class="btn__text">Im Plan-Editor bearbeiten</span>${C.icon('External', 'btn__icon icon--base')}
            </a>
          </div>
          <dl class="kv kv--tight fp-facts">
            <dt>Räume</dt><dd>${formatNumber(floor.rooms)}</dd>
            <dt>Fläche (HNF)</dt><dd>${formatArea(floor.areaHnf)}</dd>
            <dt>Bruttofläche</dt><dd>${formatArea(floor.areaGross)}</dd>
            <dt>Arbeitsplätze</dt><dd>${formatNumber(floor.workplaces)}</dd>
            <dt>Planstand</dt><dd>${C.badge(status.label, status.variant, 'sm')}</dd>
            ${floor.equipmentCount == null ? '' : `<dt>Ausstattung</dt><dd>${formatNumber(floor.equipmentCount)}</dd>`}
            ${floor.lastSync ? `<dt>Letzte Synchronisation</dt><dd>${C.escape(floor.lastSync)}</dd>` : ''}
          </dl>
          ${colorMode === 'none' ? '' : `<div><h4 class="fp-side__title">Einfärbung: ${C.escape(colorLabel)}</h4>${floorplanLegend(spaces, colorMode)}</div>`}
          <div class="fp-room-host" id="fp-room">${roomPanel(selected)}</div>
        </div>
      </div>
      <p class="fp-print-foot">${C.escape(item.name)} — ${C.escape(floor.label)} · ${C.escape(address(item))} · Einfärbung: ${C.escape(colorLabel)}</p>
    </div>`;
  }

  function floorTableConfig() {
    const hasEquipment = floors.some((floor) => floor.equipmentCount != null);
    return {
      id: 'workspace-floors', rows: floors, unit: { nom: 'Geschosse', dat: 'Geschossen' },
      caption: `Grundrisse ${item.name}`, emptyMsg: 'Keine Grundrisse erfasst.', rowsClickable: true,
      search: (floor, term) => `${floor.label} ${floorMeta(floor.planStatus).label} ${floor.lastSync || ''}`.toLocaleLowerCase('de').includes(term),
      perPage: 10,
      note: 'Wählen Sie ein Geschoss, um den Grundriss schreibgeschützt im Portal anzusehen. Bearbeitung und Planprüfung erfolgen in separaten Anwendungen.',
      sorts: [
        { value: 'level', label: 'Geschoss (aufsteigend)', cmp: (a, b) => a.level - b.level },
        { value: 'status', label: 'Planstand', cmp: (a, b) => a.planStatus.localeCompare(b.planStatus, 'de') || a.level - b.level },
        { value: 'sync', label: 'Letzte Synchronisation', cmp: (a, b) => syncValue(b.lastSync) - syncValue(a.lastSync) },
      ],
      columns: [
        { key: 'label', label: 'Geschoss', render: (floor) => `<a href="${BASE}?id=${encodeURIComponent(item.id)}&floor=${encodeURIComponent(floor.floorId)}">${C.escape(floor.label)}</a>` },
        { key: 'rooms', label: 'Räume', align: 'right', render: (floor) => formatNumber(floor.rooms) },
        { key: 'areaHnf', label: 'HNF', align: 'right', render: (floor) => formatArea(floor.areaHnf) },
        { key: 'workplaces', label: 'Arbeitsplätze', align: 'right', render: (floor) => formatNumber(floor.workplaces) },
        { key: 'equipmentCount', label: 'Ausstattung', align: 'right', render: (floor) => floor.equipmentCount == null ? '<span class="muted">—</span>' : formatNumber(floor.equipmentCount) },
        { key: 'planStatus', label: 'Planstand', render: (floor) => {
          const status = floorMeta(floor.planStatus);
          return C.badge(status.label, status.variant, 'sm');
        } },
        { key: 'lastSync', label: 'Letzte Synchronisation', render: (floor) => `<span class="small muted">${C.escape(floor.lastSync || '—')}</span>` },
      ],
      foot: (_visible, filteredRows) => `<tr><th scope="row">Total (${filteredRows.length})</th><td class="text-right">${formatNumber(filteredRows.reduce((sum, floor) => sum + floor.rooms, 0))}</td><td class="text-right">${formatArea(filteredRows.reduce((sum, floor) => sum + floor.areaHnf, 0))}</td><td class="text-right">${formatNumber(filteredRows.reduce((sum, floor) => sum + floor.workplaces, 0))}</td><td class="text-right">${hasEquipment ? formatNumber(filteredRows.reduce((sum, floor) => sum + (floor.equipmentCount || 0), 0)) : '<span class="muted">—</span>'}</td><td colspan="2"></td></tr>`,
    };
  }

  function equipmentTableConfig() {
    return {
      id: 'workspace-equipment', rows: equipment, unit: 'Ausstattungsgruppen',
      caption: `Ausstattung ${item.name}`, emptyMsg: 'Keine Ausstattung aus einer Multispace-Planung erfasst.',
      searchKeys: ['number', 'name'], perPage: 15,
      sorts: [
        { value: 'number', label: 'Modulnummer', cmp: (a, b) => a.number - b.number },
        { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
        { value: 'count', label: 'Anzahl (meiste zuerst)', cmp: (a, b) => b.count - a.count || a.number - b.number },
      ],
      columns: [
        { key: 'number', label: 'Modul', render: (group) => `<span class="mono">M${C.escape(group.number)}</span>` },
        { key: 'name', label: 'Ausstattungsstandard', render: (group) => `<strong>${C.escape(group.name)}</strong>` },
        { key: 'count', label: 'Positionen', align: 'right', render: (group) => formatNumber(group.count) },
      ],
      foot: (_visible, filteredRows) => `<tr><th scope="row" colspan="2">Total (${filteredRows.length})</th><td class="text-right">${formatNumber(filteredRows.reduce((sum, group) => sum + group.count, 0))}</td></tr>`,
    };
  }

  function draw() {
    mount.innerHTML = `<div class="container section workspace-detail">
      ${C.detailBar({ backHref: BASE, backLabel: 'Workspace Management' })}
      <p class="eyebrow">Objekt ${C.escape(item.id)}${planning.projectId ? ` · Projekt ${C.escape(planning.projectId)}` : ''}</p>
      <h1 tabindex="-1">${C.escape(item.name)}</h1>
      <p class="lead">${C.escape(address(item))}${item.occupants ? ` · ${C.escape(item.occupants)}` : ''}</p>
      <p class="pill-row mt-2">${C.badge(availability.label, availability.variant, 'sm')}${order ? C.badge(order.label, order.variant, 'sm') : ''}</p>
      ${heroMosaic(C, { items: galleryItems, id: 'workspace-mosaic', mapId: 'workspace-hero-map', lat: item.lat, lon: item.lon,
        mapLabel: `Standort von ${item.name} auf der Karte` })}
      <div class="tabs mt-6">
        ${C.tabBar({ items: tabs, active, idPrefix: 'workspace-tab', ariaLabel: 'Objektregister' })}
        ${C.tabPanels({ items: tabs, active, idPrefix: 'workspace-tab', heading: true, render: (tab) => panels[tab]() })}
      </div>
    </div>`;

    C.wireTabs(mount, { syncHash: (tab) => { active = tab; syncHash(); } });
    // Canonicalise aliases and remove invalid floor/room/color values before
    // scheduling gallery restoration; its stale-frame guard then compares
    // against the final route rather than the incoming alias/order.
    syncHash();
    wireHero();
    wireFloorArea({ mountAllTables: true });
    mount.querySelector('#workspace-export')?.addEventListener('click', () => exportPlanningSummary(item, equipment));
  }

  async function wireHero() {
    wireHeroMosaic(mount, openGallery, galleryItems, C);
    restoreGalleryFromQuery(query, galleryItems, C);
    const map = mount.querySelector('#workspace-hero-map');
    if (!map || !Number.isFinite(item.lat) || !Number.isFinite(item.lon)) {
      workspaceMap.free();
      if (map) map.innerHTML = C.empty('Für dieses Objekt sind keine Koordinaten erfasst.', { available: false });
      return;
    }
    await workspaceMap.mount(map, (node) => initEstateMap(node, [{
      lat: item.lat, lon: item.lon, label: item.name, bblId: item.id, sub: address(item), href: '',
    }], { type: 'FeatureCollection', features: [] }, item.id, { focusPopup: false }));
  }

  const detachTables = new Map();
  const unmountTable = (hostId) => {
    const detachTable = detachTables.get(hostId);
    if (detachTable) { try { detachTable(); } catch { /* already detached */ } }
    detachTables.delete(hostId);
  };
  const mountTable = (hostId, config) => {
    unmountTable(hostId);
    const host = mount.querySelector(`#${hostId}`);
    if (host) detachTables.set(hostId, C.mountDataTable(host, config) || (() => {}));
  };
  const mountTables = () => {
    mountTable('workspace-floor-table', floorTableConfig());
    mountTable('workspace-equipment-table', equipmentTableConfig());
  };

  let detachFloorplan = null;
  let printTimer = null;
  let printCleanup = null;
  function beginPlanPrint() {
    if (printCleanup) printCleanup();
    document.body.classList.add('print--plan');
    const cleanup = () => {
      document.body.classList.remove('print--plan');
      window.removeEventListener('afterprint', cleanup);
      if (printTimer) clearTimeout(printTimer);
      printTimer = null;
      if (printCleanup === cleanup) printCleanup = null;
    };
    printCleanup = cleanup;
    window.addEventListener('afterprint', cleanup);
    window.print();
    printTimer = setTimeout(cleanup, 1000);
  }

  function wireFloorArea({ mountAllTables = false } = {}) {
    if (detachFloorplan) { detachFloorplan(); detachFloorplan = null; }
    if (mountAllTables) mountTables();
    else mountTable('workspace-floor-table', floorTableConfig());

    mount.querySelector('#workspace-floorplan-back')?.addEventListener('click', (event) => {
      event.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen?.();
      floorId = '';
      spaceId = '';
      syncHash();
      redrawFloorArea();
      mount.querySelector('#workspace-floor-table a')?.focus({ preventScroll: true });
    });

    const stage = mount.querySelector('#fp-stage');
    if (!stage) return;
    detachFloorplan = wireFloorplan(stage, (selectedId) => {
      spaceId = spaceId === selectedId ? '' : selectedId;
      syncHash();
      redrawFloorArea();
      mount.querySelector(`[data-space="${CSS.escape(selectedId)}"] rect`)?.focus({ preventScroll: true });
    });
    mount.querySelector('#fp-color')?.addEventListener('change', (event) => {
      colorMode = event.target.value;
      syncHash();
      redrawFloorArea();
      mount.querySelector('#fp-color')?.focus({ preventScroll: true });
    });
    mount.querySelectorAll('[data-floor]').forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault();
      if (link.dataset.floor === floorId) return;
      floorId = link.dataset.floor;
      spaceId = '';
      syncHash();
      redrawFloorArea();
      mount.querySelector(`[data-floor="${CSS.escape(floorId)}"]`)?.focus({ preventScroll: true });
    }));
    const wrap = mount.querySelector('#fp-wrap');
    mount.querySelector('#workspace-floorplan-fullscreen')?.addEventListener('click', () => {
      if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
      const request = wrap?.requestFullscreen?.();
      request?.catch?.(() => { /* browser rejected fullscreen */ });
    });
    mount.querySelector('#workspace-floorplan-print')?.addEventListener('click', beginPlanPrint);
  }

  function redrawFloorArea() {
    const host = mount.querySelector('#workspace-floor-body');
    if (!host) return draw();
    if (detachFloorplan) { detachFloorplan(); detachFloorplan = null; }
    unmountTable('workspace-floor-table');
    const currentWrap = host.querySelector('#fp-wrap');
    if (currentWrap && floorId) {
      const template = document.createElement('template');
      template.innerHTML = floorplanView();
      const nextWrap = template.content.querySelector('#fp-wrap');
      currentWrap.replaceChildren(...nextWrap.childNodes);
    } else {
      host.innerHTML = floorBodyHtml();
    }
    wireFloorArea();
  }

  onUnmount(() => {
    if (detachFloorplan) detachFloorplan();
    if (printCleanup) printCleanup();
    workspaceMap.free();
    detachTables.forEach((detachTable) => { try { detachTable(); } catch { /* already detached */ } });
    detachTables.clear();
  });
  draw();
}

function exportPlanningSummary(item, groups) {
  if (!groups.length) return;
  const cell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const lines = [
    ['Hinweis', 'Aggregierte Prototypannahmen; kein freigegebenes Mengengerüst oder Bestellnachweis', '', '', ''],
    ['Objekt-ID', 'Projekt', 'Modul', 'Ausstattungsstandard', 'Positionen'],
    ...groups.map((group) => [item.id, item.planning.projectId || '', `M${group.number}`, group.name, group.count]),
  ];
  const blob = new Blob([`\uFEFF${lines.map((line) => line.map(cell).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `workspace-planannahmen-${item.id.replaceAll('/', '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
