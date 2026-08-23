// Map-first property inventory with catalogue, building and parcel detail views.

import { openGallery, restoreGalleryFromQuery } from '../ui/gallery.js';
import { heroMosaic, galleryItemsFrom, wireHeroMosaic } from '../ui/hero-mosaic.js';
import { initEstateMap } from '../map/buildings-map.js';
import { createMapSlot } from '../map/map-slot.js';
import { objectsToNodes } from '../ui/spatial-tree.js';
import { formatNumber, formatArea, formatCurrency, formatDate, formatFileSize } from '../format.js';
import { countryName, businessEntityIdFromBblId } from '../domain.js';
import { APPLICATIONS } from '../crumbs.js';
import { preparePage, uniqueOptions } from '../collections.js';
import { safeMailto, safeResourceUrl, safeTel } from '../security/urls.js';

const imageGalleryItems = (o) => galleryItemsFrom(o.images, {
  idPrefix: o.bbl_id, title: o.name, location: o.city,
});

const pfMap = createMapSlot();

const nameCmp = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'de');
const SORTS = {
  name: nameCmp,
  area: (a, b) => (b.area || 0) - (a.area || 0) || nameCmp(a, b),
  status: (a, b) => String(a.status || '').localeCompare(String(b.status || ''), 'de') || nameCmp(a, b),
  'land': (a, b) => countryName(a.country).localeCompare(countryName(b.country), 'de') || nameCmp(a, b),
};
const SORT_OPTIONS = [
  { value: 'name', label: 'Bezeichnung (A–Z)' },
  { value: 'area', label: 'Fläche (grösste zuerst)' },
  { value: 'status', label: 'Status' },
  { value: 'land', label: 'Land' },
];

const CRUMBS = APPLICATIONS;

export const needs = ['areas', 'assets', 'buildingContacts', 'buildings', 'contracts', 'costs', 'documents', 'landcovers', 'parcels'];

export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs } = ctx;

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

  const objects = [
    ...core.buildings().map((b) => ({ kind: 'building', id: b.bbl_id, businessEntity: b.businessEntityId || businessEntityIdFromBblId(b.bbl_id), country: b.country, region: b.canton, city: b.city, name: b.name, category: b.portfolioCategory, ownership: b.ownership, status: b.status, area: b.gf, lat: b.lat, lon: b.lng, photo: b.photo, photoSrc: b.photoSrc, street: b.street, zip: b.zip })),
    ...core.parcels().map((p) => ({ kind: 'parcel', id: p.bbl_id, businessEntity: p.businessEntityId || businessEntityIdFromBblId(p.bbl_id), country: p.country, region: p.canton, city: p.city, name: p.name, category: p.zone || 'Grundstück', ownership: p.ownership, status: p.status, area: p.gsf, lat: p.lat, lon: p.lng, geom: p.geom, street: p.street, zip: p.zip })),
  ];

  const csv = (k) => (query.get(k) || '').split(',').filter(Boolean);
  const kindParam = query.get('kind');
  const urlSel = {};
  const selectionQueryKeys = { 'land': 'country', 'region': 'region', 'city': 'city', 'we': 'businessEntity' };
  for (const [legacyKey, stateKey] of Object.entries(selectionQueryKeys)) {
    if (query.get(legacyKey)) urlSel[stateKey] = query.get(legacyKey);
  }
  if (query.get('obj')) urlSel.id = query.get('obj');
  const state = {
    view: ['map', 'gallery', 'list'].includes(query.get('view')) ? query.get('view') : 'gallery',

    sel: urlSel, focus: urlSel.id || null, q: query.get('q') || '',
    sort: SORT_OPTIONS.some((o) => o.value === query.get('sort')) ? query.get('sort') : 'name',
    filters: {
      status: csv('status'), ownership: csv('ownership'),
      kind: kindParam == null ? ['building'] : (kindParam === 'alle' ? [] : csv('kind')),
    },
    page: Math.max(1, Number(query.get('page')) || 1),
    perPage: { gallery: 9, list: 25 },
  };

  const inSel = (o) => (!state.sel.id || o.id === state.sel.id)
    && (!state.sel.country || o.country === state.sel.country) && (!state.sel.region || o.region === state.sel.region)
    && (!state.sel.city || o.city === state.sel.city) && (!state.sel.businessEntity || o.businessEntity === state.sel.businessEntity);
  const inFilters = (o) => (!state.filters.status.length || state.filters.status.includes(o.status))
    && (!state.filters.ownership.length || state.filters.ownership.includes(o.ownership))
    && (!state.filters.kind.length || state.filters.kind.includes(o.kind));
  const inSearch = (o) => { const q = state.q.trim().toLowerCase(); return !q || `${o.name} ${o.id} ${o.street} ${o.zip} ${o.city}`.toLowerCase().includes(q); };
  const filtered = () => objects.filter((o) => inSel(o) && inSearch(o) && (state.sel.id ? true : inFilters(o)));

  const esc = C.escape;

  const objId = (o) => String(o.id).split('/')[2] || o.id;

  const TREE = {
    levels: [
      { key: 'country', icon: 'lucide/globe', label: (v) => countryName(v) },
      { key: 'region', icon: 'lucide/map' },
      { key: 'city', icon: 'lucide/map-pin' },

      // A business entity uses its stable unit number, not a child building's name.
      { key: 'businessEntity', attr: 'business-entity', icon: 'lucide/folder',
        word: 'Wirtschaftseinheit',
        label: (v) => `WE ${v}`,
        sort: (a, b) => (a < b ? -1 : a > b ? 1 : 0) },
    ],

    leaf: {
      icon: (o) => (o.kind === 'building' ? 'lucide/building' : 'lucide/land-plot'),
      idText: objId, label: (o) => o.name, objId: (o) => o.id,
      sort: (a, b) => a.kind.localeCompare(b.kind) || nameCmp(a, b),
    },
  };

  function pfCard(o) {
    const vis = o.kind === 'building'
      ? C.photo({ src: o.photoSrc, id: o.photo, color: 'var(--color-secondary-600)', alt: `${o.name}, ${o.city}`, w: 480, cls: 'pf-card__img' })
      : `<div class="pf-card__parcel">${C.icon('Crop', 'icon--2xl')}</div>`;

    // The shared badge, not a card-local chip shape: these say the same kind of
    // thing as every other badge in the portal (a country, a status), and a
    // second pill vocabulary for one gallery was the only thing making them
    // different (user decision, 2026-08-12).
    const chips = [countryName(o.country), o.status]
      .filter(Boolean).map((c) => C.badge(c, 'info')).join('');

    return C.card({
      cls: 'pf-card',
      media: `<div class="pf-card__vis">${vis}<div class="pf-card__chips">${chips}</div></div>`,
      title: o.name, href: `#/app/portfolio?id=${encodeURIComponent(o.id)}`,
      idLine: o.id,
      desc: `${o.street}${o.city ? `, ${o.zip} ${o.city}` : ''}`,
      footer: `<span>${esc(o.category)}</span><span>${formatArea(o.area)} <span class="muted">${o.kind === 'building' ? 'GF' : 'GSF'}</span></span>`,
    });
  }
  const galleryHTML = (slice) => `<div class="pf-gallery">${slice.map(pfCard).join('')}</div>`;

  const listHTML = (slice) => C.table({ zebra: true, rowsClickable: true, caption: 'Liegenschaften', columns: [
    { key: 'kind', label: 'Typ', render: (o) => `<span class="pf-type" title="${o.kind === 'building' ? 'Gebäude' : 'Grundstück'}" aria-label="${o.kind === 'building' ? 'Gebäude' : 'Grundstück'}">${C.icon(o.kind === 'building' ? 'Building' : 'Crop', 'table__icon')}</span>` },
    { key: 'name', label: 'Bezeichnung', render: (o) => `<a href="#/app/portfolio?id=${encodeURIComponent(o.id)}">${esc(o.name)}</a><br><span class="small muted">${esc(o.id)}</span>` },
    { key: 'location', label: 'Ort', render: (o) => `${esc(o.city)}<br><span class="small muted">${esc(countryName(o.country))}</span>` },
    { key: 'category', label: 'Kategorie', render: (o) => esc(o.category) },
    { key: 'area', label: 'Fläche', align: 'right', render: (o) => `${formatArea(o.area)}<br><span class="small muted">${o.kind === 'building' ? 'GF' : 'GSF'}</span>` },
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

  // Tree facets honor search and filters but ignore their own selection.
  const inTree = () => objects.filter((o) => inSearch(o) && inFilters(o));

  const syncHash = () => {
    const p = new URLSearchParams();
    if (state.q.trim()) p.set('q', state.q.trim());
    for (const [legacyKey, stateKey] of Object.entries(selectionQueryKeys)) {
      if (state.sel[stateKey]) p.set(legacyKey, state.sel[stateKey]);
    }
    if (state.sel.id) p.set('obj', state.sel.id);
    if (state.filters.status.length) p.set('status', state.filters.status.join(','));
    if (state.filters.ownership.length) p.set('ownership', state.filters.ownership.join(','));

    if (state.filters.kind.length !== 1 || state.filters.kind[0] !== 'building') {
      p.set('kind', state.filters.kind.length ? state.filters.kind.join(',') : 'alle');
    }
    if (state.sort !== 'name') p.set('sort', state.sort);
    if (state.page > 1) p.set('page', String(state.page));
    if (state.view !== 'gallery') p.set('view', state.view);
    const s = p.toString();
    try { history.replaceState(history.state, '', `#/app/portfolio${s ? `?${s}` : ''}`); } catch {  }
  };

  function renderMain() {
    paintTree();
    const filteredRows = filtered();
    const pageSize = state.perPage[state.view] || Math.max(1, filteredRows.length);
    const { sorted: list, visible, page, totalPages } = preparePage(filteredRows, {
      compare: SORTS[state.sort] || SORTS.name,
      page: state.page,
      perPage: pageSize,
    });
    const cnt = mount.querySelector('#pf-count');
    const main = mount.querySelector('#pf-main');
    const pages = state.view === 'map' ? 1 : totalPages;
    if (state.view !== 'map') state.page = page;
    pfMap.free();
    if (state.view === 'map') {

      if (cnt) cnt.innerHTML = `<strong>${list.length}</strong> ${list.length === 1 ? 'Objekt' : 'Objekte'}`;
      main.innerHTML = `<div class="pf-map dash-map" id="pf-map-el" role="group" aria-label="Karte der Liegenschaften">${C.loading({ label: 'Karte wird geladen…' })}</div>`;
      mountMap(list, state.focus);
    } else if (!list.length) {

      if (cnt) cnt.innerHTML = `<strong>0</strong> von ${objects.length} Objekten`;

      main.innerHTML = C.empty('Keine Objekte gefunden.', {
        hint: 'Passen Sie Suche, Filter oder die Auswahl im Baum an.',
        action: { id: 'pf-empty-reset', label: 'Suche und Filter zurücksetzen' },
      });
      const rst = mount.querySelector('#pf-empty-reset');
      if (rst) rst.addEventListener('click', fullReset);
    } else {
      if (cnt) cnt.innerHTML = C.countText({ nom: 'Objekte', dat: 'Objekten' }, objects.length, list.length);

      main.innerHTML = (state.view === 'gallery' ? galleryHTML(visible) : listHTML(visible))
        + C.pagination({ page: state.page, totalPages: pages, inputId: 'pf-page' });
      if (pages > 1) C.wirePagination(mount, 'pf-page', state.page, pages, (t) => { state.page = t; renderMain(); });
    }
    mount.querySelectorAll('.view-switch__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    renderActiveFilters();

    C.announceCatalogue({ count: list.length, total: objects.length, unit: 'Objekten',
      page: state.page, totalPages: pages, view: state.view });
    syncHash();
  }

  const kindLabel = (k) => (k === 'building' ? 'Gebäude' : 'Grundstück');
  function selPill() {
    const s = state.sel;
    if (!Object.keys(s).length) return null;
    const label = s.id ? ((objects.find((o) => o.id === s.id) || {}).name || s.id)
      : s.businessEntity ? `WE ${s.businessEntity}` : s.city || s.region || countryName(s.country);
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

  const statuses = [...new Set(objects.map((o) => o.status))].filter(Boolean);
  const owns = [...new Set(objects.map((o) => o.ownership))].filter(Boolean);

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
        <!-- No «Auswahl zurücksetzen» here: the tree selection appears as a
             removable chip in the active-filter row above the layout, which is
             where every other filter is cleared. A second control for the same
             job, in a different place, only split the mental model. -->
        <div class="pf-sidebar__head"><h2 class="pf-sidebar__title">Standorte</h2></div>
        <div id="pf-tree"></div>
      </aside>
      <div class="pf-main" id="pf-main"></div>
    </div>
  </div>`;

  // Rebuild from filtered nodes so counts and empty branches stay synchronized.
  const treeHost = mount.querySelector('#pf-tree');
  let dropTree = null;
  const paintTree = () => {
    if (dropTree) dropTree();
    dropTree = C.sidebarTree(treeHost, {
      id: 'pf-tree',
      mode: 'select',
      ariaLabel: 'Standorte',
      // Icons distinguish geographic levels; later levels rely on indentation.
      levels: [{ icons: true }, { icons: true }, { icons: true }, { icons: false }],
      // Translate the view's `id` key to the tree adapter's `obj` key here.
      sections: [objectsToNodes(inTree(), TREE, { ...state.sel, obj: state.sel.id })],
      onSelect: (node) => {
        const { obj, ...rest } = node.sel || {};
        setSelection(obj ? { ...rest, id: obj } : rest, obj || null);
      },
    });
  };

  const setSelection = (sel, focus) => {
    state.sel = sel; state.focus = focus || null;
    state.page = 1; renderMain();
  };

  const clearSelection = () => setSelection({}, null);

  function fullReset() {
    state.q = '';
    const qEl = mount.querySelector('#pf-q'); if (qEl) qEl.value = '';
    cat.clearFilters();
    clearSelection();
  }

  const cat = C.wireCatalogueState(mount, {
    formId: 'pf-search', inputId: 'pf-q', sortId: 'pf-sort',
    filterToggleId: 'pf-filter-btn', panelId: 'pf-filters', resetId: 'pf-freset',
    activeFiltersId: 'pf-activefilters',
    state, onChange: renderMain,
    onRemove: (tok) => { if (tok === 'sel') clearSelection(); },

    onReset: clearSelection,
  });
  ctx.onUnmount(cat.destroy);

  ctx.onUnmount(C.wireTableRows(mount.querySelector('#pf-main')));

  renderMain();
}

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
  const regionLabel = [b.country, b.canton].filter(Boolean).join(' · ');

  const galleryItems = imageGalleryItems(b);

  // German tab values remain accepted as public-link compatibility literals.
  const buildingTabByLegacyValue = {
    'uebersicht': 'overview', 'flaechen': 'areas', 'ausstattung': 'equipment',
    'vertraege': 'contracts', 'kosten': 'costs', 'dokumente': 'documents', 'kontakte': 'contacts',
  };
  const buildingLegacyValueByTab = Object.fromEntries(Object.entries(buildingTabByLegacyValue).map(([legacy, tab]) => [tab, legacy]));
  const tabs = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'areas', label: `Flächen (${areas.length})` },

    { id: 'equipment', label: `Ausstattungen (${assets.length})` },
    { id: 'contracts', label: `Verträge (${contracts.length})` },
    { id: 'costs', label: `Kosten (${costs.length})` },
    { id: 'documents', label: `Dokumente (${documents.length})` },
    { id: 'contacts', label: `Kontakte (${contacts.length})` },
  ];

  let active = buildingTabByLegacyValue[query.get('tab')] || 'overview';
  if (!tabs.some((t) => t.id === active)) active = 'overview';

  const asideHtml = () => {
    const serviceLink = (id, iconName, href) => {
      const s = core.service(id);
      return s ? { icon: iconName, label: s.title, href, newWindow: href.startsWith('#/app/') } : null;
    };
    const bq = `building=${encodeURIComponent(b.bbl_id)}`;
    const actions = [

      serviceLink('stammdaten-mutieren', 'FileCheckmark', `#/services/stammdaten-mutieren?${bq}`),
      serviceLink('stoerung-melden', 'Wrench', `#/app/fault-report?${bq}`),
      serviceLink('bautendokumentation-abrufen', 'File', `#/app/document-archive?${bq}`),
      { icon: 'Image', label: 'Aufnahmen in der Mediathek', href: `#/app/media-library?objekt=${encodeURIComponent(b.bbl_id)}`, newWindow: true },
    ].filter(Boolean);
    return `<aside class="detail-layout__aside" aria-label="Aktionen und Ansprechpersonen">
      ${C.actionCard({ links: actions })}
      ${C.contactCard({ contacts: contacts.slice()
        .sort((x, y) => (y.isPrimary ? 1 : 0) - (x.isPrimary ? 1 : 0))
        .slice(0, 4)
        .map((c) => ({ label: c.role || c.organisation, name: c.name, email: c.email, phone: c.phone })) })}
    </aside>`;
  };

  function overviewPanel() {
    return `<div class="detail-layout"><div>
      <h2 class="detail-section__title">Eckdaten</h2>
      <dl class="kv">
        <dt>BBL-ID</dt><dd>${C.escape(b.bbl_id)}</dd>
        <dt>Wirtschaftseinheit (WE)</dt><dd>${C.escape(b.businessEntityId)}</dd>
        <dt>EGID</dt><dd>${C.escape(b.egid || '—')}</dd>
        <dt>Adresse</dt><dd>${C.escape(b.street)}, ${C.escape(b.zip)} ${C.escape(b.city)}</dd>
        <dt>Land / Region</dt><dd>${C.escape(regionLabel)}</dd>
        <dt>Teilportfolio</dt><dd>${C.escape(b.portfolioCategory)}</dd>
        <dt>Gebäudetyp</dt><dd>${C.escape(b.buildingType || '—')}</dd>
        <dt>Eigentumsverhältnis</dt><dd>${C.escape(b.ownership)}</dd>
        <dt>Baujahr</dt><dd>${C.escape(String(b.buildYear || '—'))}${
          b.renovationYear ? ` <span class="muted">· saniert ${C.escape(String(b.renovationYear))}</span>` : ''}</dd>
        ${b.architect ? `<dt>Architektur</dt><dd>${C.escape(b.architect)}</dd>` : ''}
        ${b.occupants ? `<dt>Nutzer</dt><dd>${C.escape(b.occupants)}</dd>` : ''}
        <dt>Geschossfläche (GF)</dt><dd>${formatArea(b.gf)}</dd>
        <dt>Hauptnutzfläche (HNF)</dt><dd>${formatArea(b.hnf)}</dd>
        ${b.preservationStrategy ? `<dt>Erhaltungsstrategie</dt><dd>${C.escape(b.preservationStrategy)}</dd>` : ''}
        ${b.heritage || b.kgsCategory ? `<dt>Baudenkmal</dt><dd>${b.kgsCategory
          ? `Ja — KGS-Kategorie ${C.escape(b.kgsCategory)}${b.kgsNumber ? `, Nr. ${C.escape(String(b.kgsNumber))}` : ''}`
          : 'Ja'}</dd>` : ''}
        ${parcels.length ? `<dt>Grundstück${parcels.length > 1 ? 'e' : ''}</dt><dd>${parcels.map(pc => `<a href="#/app/portfolio?id=${encodeURIComponent(pc.bbl_id)}">${C.escape(pc.name)}</a>`).join(', ')}</dd>` : ''}
        <dt>Status</dt><dd>${statusBadge(C, ref, b.status)}</dd>
      </dl>
    </div>${asideHtml()}</div>`;

  }

  const FACETS = (list) => list.filter((f) => (f.options || []).length);

  const DT = {
    areas: {
      id: 'pf-dt-areas', emptyMsg: 'Keine Flächen- oder Bemessungsdaten erfasst.', rows: areas, unit: 'Bemessungen', caption: 'Flächen und Bemessungen',
      searchKeys: ['type', 'accuracy', 'standard'], perPage: 10,
      sorts: [
        { value: 'type', label: 'Bemessungsart', cmp: (x, y) => String(x.type).localeCompare(String(y.type), 'de') },
        { value: 'value', label: 'Wert (grösste zuerst)', cmp: (x, y) => (Number(y.value) || 0) - (Number(x.value) || 0) },
      ],

      facets: FACETS([{ dim: 'standard', legend: 'Standard', options: uniqueOptions(areas, 'standard', { locale: 'de' }),
        match: (r, v) => v.includes(String(r.standard)) }]),
      columns: [
        { key: 'type', label: 'Bemessungsart', render: (a) => C.escape(a.type) },
        { key: 'value', label: 'Wert', align: 'right', render: (a) => `${formatNumber(a.value)} <span class="muted">${C.escape(a.unit || '')}</span>` },
        { key: 'accuracy', label: 'Genauigkeit', render: (a) => C.escape(a.accuracy || '—') },
        { key: 'standard', label: 'Standard', render: (a) => C.escape(a.standard || '—') },
        { key: 'validFrom', label: 'Gültig ab', render: (a) => formatDate(a.validFrom) },
      ],
    },
    equipment: {

      id: 'pf-dt-equipment', emptyMsg: 'Keine Ausstattung erfasst.', rows: assets,
      unit: { nom: 'Ausstattungsobjekte', dat: 'Ausstattungsobjekten' }, caption: 'Ausstattung',
      searchKeys: ['name', 'manufacturer', 'location', 'category'], perPage: 10,
      sorts: [
        { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (x, y) => String(x.name).localeCompare(String(y.name), 'de') },
        { value: 'year', label: 'Baujahr (neueste zuerst)', cmp: (x, y) => (Number(y.installationYear) || 0) - (Number(x.installationYear) || 0) },
      ],

      facets: FACETS([
        { dim: 'category', legend: 'Kategorie', options: uniqueOptions(assets, 'category', { locale: 'de' }), match: (r, v) => v.includes(String(r.category)) },
        { dim: 'status', legend: 'Status', options: uniqueOptions(assets, 'status', { locale: 'de' }), match: (r, v) => v.includes(String(r.status)) },
      ]),
      columns: [
        { key: 'name', label: 'Bezeichnung', render: (a) => C.escape(a.name) },
        { key: 'category', label: 'Kategorie', render: (a) => C.badge(a.category, 'blue') },
        { key: 'manufacturer', label: 'Hersteller', render: (a) => C.escape(a.manufacturer || '—') },
        { key: 'installationYear', label: 'Baujahr', align: 'right', render: (a) => C.escape(String(a.installationYear || '—')) },
        { key: 'location', label: 'Standort', render: (a) => C.escape(a.location || '—') },
        { key: 'status', label: 'Status', render: (a) => C.badge(a.status, a.status === 'In Betrieb' ? 'success' : 'gray') },
      ],
    },
    contracts: {

      id: 'pf-dt-contracts', emptyMsg: 'Keine Verträge erfasst.', rows: contracts,
      unit: { nom: 'Verträge', dat: 'Verträgen' }, caption: 'Verträge',
      searchKeys: ['type', 'contractPartner'], perPage: 10,
      sorts: [
        { value: 'type', label: 'Vertragsart', cmp: (x, y) => String(x.type).localeCompare(String(y.type), 'de') },
        { value: 'amount', label: 'Betrag (grösste zuerst)', cmp: (x, y) => (Number(y.amount) || 0) - (Number(x.amount) || 0) },
        { value: 'from', label: 'Beginn (neueste zuerst)', cmp: (x, y) => String(y.validFrom || '').localeCompare(String(x.validFrom || '')) },
      ],

      facets: FACETS([{ dim: 'status', legend: 'Status', options: uniqueOptions(contracts, 'status', { locale: 'de' }), match: (r, v) => v.includes(String(r.status)) }]),
      columns: [
        { key: 'type', label: 'Vertragsart', render: (c) => C.escape(c.type) },
        { key: 'contractPartner', label: 'Vertragspartner', render: (c) => C.escape(c.contractPartner || '—') },
        { key: 'term', label: 'Laufzeit', render: (c) => `${formatDate(c.validFrom)} – ${c.validUntil ? formatDate(c.validUntil) : 'unbefristet'}` },
        { key: 'amount', label: 'Betrag/Jahr', align: 'right', render: (c) => formatCurrency(c.amount, c.currency) },
        { key: 'status', label: 'Status', render: (c) => C.badge(c.status, CONTRACT_STATUS_VARIANT[c.status] || 'gray') },
      ],
    },
    costs: {
      id: 'pf-dt-costs', emptyMsg: 'Keine Kostendaten erfasst.', rows: costs, unit: 'Kostenpositionen', caption: 'Kosten',
      searchKeys: ['costGroup', 'costType', 'period'], perPage: 10,
      sorts: [
        { value: 'group', label: 'Kostengruppe', cmp: (x, y) => String(x.costGroup).localeCompare(String(y.costGroup), 'de') },
        { value: 'amount', label: 'Betrag (grösste zuerst)', cmp: (x, y) => (Number(y.amount) || 0) - (Number(x.amount) || 0) },
      ],

      facets: FACETS([{ dim: 'costGroup', legend: 'Kostengruppe', options: uniqueOptions(costs, 'costGroup', { locale: 'de' }), match: (r, v) => v.includes(String(r.costGroup)) }]),
      columns: [
        { key: 'costGroup', label: 'Kostengruppe', render: (c) => C.escape(c.costGroup) },
        { key: 'costType', label: 'Kostenart', render: (c) => C.escape(c.costType) },
        { key: 'amount', label: 'Betrag', align: 'right', render: (c) => formatCurrency(c.amount, c.currency) },
        { key: 'period', label: 'Periode', render: (c) => C.escape(c.period || '—') },
        { key: 'referenceDate', label: 'Stichtag', render: (c) => formatDate(c.referenceDate) },
      ],

      foot: (visible, filtered) => {
        const cur = (filtered[0] || {}).currency || 'CHF';
        const sum = filtered.reduce((s, c) => s + (Number(c.amount) || 0), 0);

        return `<tr><th scope="row" class="text-left">Total (${filtered.length})</th><td></td><td class="text-right">${formatCurrency(sum, cur)}</td><td colspan="2"></td></tr>`;
      },
    },
    contacts: {

      id: 'pf-dt-contacts', emptyMsg: 'Keine Kontakte erfasst.', rows: contacts.slice().sort((a, c) => (c.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || String(a.name).localeCompare(String(c.name), 'de')),
      unit: { nom: 'Kontakte', dat: 'Kontakten' }, caption: 'Kontakte',
      searchKeys: ['name', 'role', 'organisation', 'email'], perPage: 10,
      sorts: [
        { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (x, y) => String(x.name).localeCompare(String(y.name), 'de') },
        { value: 'role', label: 'Rolle', cmp: (x, y) => String(x.role || '').localeCompare(String(y.role || ''), 'de') },
      ],
      columns: [
        { key: 'name', label: 'Name', render: (c) => `${C.escape(c.name)}${c.isPrimary ? ' ' + C.badge('Primär', 'info') : ''}` },
        { key: 'role', label: 'Rolle', render: (c) => C.escape(c.role || '—') },
        { key: 'organisation', label: 'Organisation', render: (c) => C.escape(c.organisation || '—') },
        { key: 'phone', label: 'Telefon', render: (c) => {
          const href = safeTel(c.phone);
          return href ? `<a href="${C.escape(href)}">${C.escape(c.phone)}</a>` : '—';
        } },
        { key: 'email', label: 'E-Mail', render: (c) => {
          const href = safeMailto(c.email);
          return href ? `<a href="${C.escape(href)}">${C.escape(c.email)}</a>` : '—';
        } },
      ],
    },

    documents: {

      id: 'pf-dt-documents', emptyMsg: 'Keine Dokumente erfasst.', rows: documents,
      unit: { nom: 'Dokumente', dat: 'Dokumenten' }, caption: 'Dokumente',
      searchKeys: ['title', 'type', 'format'], perPage: 10,
      sorts: [
        { value: 'title', label: 'Titel (A–Z)', cmp: (x, y) => String(x.title).localeCompare(String(y.title), 'de') },
        { value: 'year', label: 'Jahr (neueste zuerst)', cmp: (x, y) => (Number(y.year) || 0) - (Number(x.year) || 0) },
        { value: 'size', label: 'Grösse (grösste zuerst)', cmp: (x, y) => (Number(y.sizeKB) || 0) - (Number(x.sizeKB) || 0) },
      ],

      facets: FACETS([
        { dim: 'type', legend: 'Dokumenttyp', options: uniqueOptions(documents, 'type', { locale: 'de' }), match: (r, v) => v.includes(String(r.type)) },
        { dim: 'classification', legend: 'Klassifizierung', options: uniqueOptions(documents, 'classification', { locale: 'de' }), match: (r, v) => v.includes(String(r.classification)) },
      ]),
      columns: [
        { key: 'title', label: 'Titel', render: (d) => `${C.icon('File', 'table__icon')}<span>${C.escape(d.title)}</span>` },
        { key: 'type', label: 'Typ', render: (d) => C.escape(d.type) },
        { key: 'format', label: 'Format', render: (d) => C.escape(d.format) },
        { key: 'sizeKB', label: 'Grösse', align: 'right', render: (d) => C.escape(formatFileSize(d.sizeKB)) },
        { key: 'year', label: 'Jahr', align: 'right', render: (d) => C.escape(String(d.year)) },
        { key: 'classification', label: 'Klassifizierung', render: (d) => classBadge(C, ref, d.classification) },
        { key: 'url', label: 'Aktion', render: (d) => {
          const href = safeResourceUrl(d.url);
          const content = `${C.icon('Download', 'btn__icon icon--base')}<span class="btn__text">Herunterladen</span>`;
          return href
            ? `<a class="btn btn--outline btn--sm btn--icon-left" href="${C.escape(href)}">${content}</a>`
            : `<span class="btn btn--outline btn--sm btn--icon-left" aria-disabled="true">${content}</span>`;
        } },
      ],
    },
  };

  const dtPanel = (key, after = '') => `<div id="${DT[key].id}"></div>${after}`;

  const archiveLink = `<p class="mt-6"><a class="btn btn--link btn--icon-right" href="#/app/document-archive?building=${encodeURIComponent(b.bbl_id)}">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">In der Bauwerksdokumentation öffnen</span></a></p>`;

  const areasPanel = () => dtPanel('areas');
  const equipmentPanel = () => dtPanel('equipment');
  const contractsPanel = () => dtPanel('contracts');
  const costsPanel = () => dtPanel('costs');
  const contactsPanel = () => dtPanel('contacts');
  const documentsPanel = () => dtPanel('documents', archiveLink);
  const panels = { overview: overviewPanel, areas: areasPanel, equipment: equipmentPanel, contracts: contractsPanel, costs: costsPanel, documents: documentsPanel, contacts: contactsPanel };
  const panelHtml = (id) => (panels[id] || overviewPanel)();

  mount.innerHTML = `
  <div class="container section">
    ${
''}
    ${C.detailBar({ backHref: '#/app/portfolio', backLabel: 'Liegenschaften Inventar' })}
    <h1 tabindex="-1">${C.escape(b.name)}</h1>
    <p class="lead">${C.escape(b.street)}, ${C.escape(b.zip)} ${C.escape(b.city)} · ${C.escape(b.portfolioCategory)}</p>
    ${

''}
    ${heroMosaic(C, { id: 'pf-mosaic', items: galleryItems, mapId: 'pf-hero-map', lat: b.lat, lon: b.lng, mapLabel: `Standort von ${b.name} auf der Karte` })}
    ${

''}
    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active, idPrefix: 'pf-tab', ariaLabel: 'Gebäudedetails' })}
      ${C.tabPanels({ items: tabs, active, idPrefix: 'pf-tab', render: panelHtml, heading: true })}
    </div>
  </div>`;

  C.wireTabs(mount, { syncHash: (tab) => {
    const sp = new URLSearchParams({ id: b.bbl_id });
    if (tab !== 'overview') sp.set('tab', buildingLegacyValueByTab[tab]);
    history.replaceState(history.state, '', `#/app/portfolio?${sp}`);
  } });

  const unmountTables = [];
  Object.values(DT).filter(Boolean).forEach((cfg) => {
    const host = mount.querySelector('#' + cfg.id);
    if (host) unmountTables.push(C.mountDataTable(host, cfg));
  });
  ctx.onUnmount(() => unmountTables.forEach((unmount) => unmount?.()));

  wireHeroMosaic(mount, openGallery, galleryItems, C);

  restoreGalleryFromQuery(query, galleryItems, C);

  const bMapEl = mount.querySelector('#pf-hero-map');
  if (bMapEl && Number.isFinite(b.lat) && Number.isFinite(b.lng)) {
    pfMap.mount(bMapEl, (node) => initEstateMap(node, [{ lat: b.lat, lon: b.lng, label: b.name, bblId: b.bbl_id,
      sub: `${b.street}, ${b.zip} ${b.city}`.trim() }], null, b.bbl_id, { focusPopup: false }));
  } else if (bMapEl) {
    bMapEl.innerHTML = `<div class="empty empty--unavailable h-full">
      <span>Für dieses Objekt sind keine Koordinaten erfasst.</span></div>`;
  }

}

function parcelDetail(ctx, p) {
  const { mount, core, C, setTitle, setCrumbs, query } = ctx;
  pfMap.free();
  const ref = core.ref();
  const businessEntityId = p.businessEntityId || businessEntityIdFromBblId(p.bbl_id);
  const building = core.buildings().find((candidate) => (candidate.businessEntityId || businessEntityIdFromBblId(candidate.bbl_id)) === businessEntityId);
  const covers = core.landcoversForParcel(p.bbl_id);

  const galleryItems = imageGalleryItems(p);
  setTitle(p.name);
  setCrumbs([...CRUMBS, { label: 'Liegenschaften Inventar', href: '#/app/portfolio' }, { label: p.name }]);

  const parcelTabByLegacyValue = { 'uebersicht': 'overview', 'bodenbedeckung': 'landcover' };
  const parcelLegacyValueByTab = Object.fromEntries(Object.entries(parcelTabByLegacyValue).map(([legacy, tab]) => [tab, legacy]));
  const tabs = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'landcover', label: `Bodenbedeckungen (${covers.length})` },
  ];

  let active = parcelTabByLegacyValue[query.get('tab')] || 'overview';
  if (!tabs.some((t) => t.id === active)) active = 'overview';
  function overviewPanel() {
    return `<h2 class="detail-section__title">Eckdaten</h2>
    <dl class="kv">
      <dt>Parzellen-ID</dt><dd>${C.escape(p.bbl_id)}</dd>
      <dt>Wirtschaftseinheit (WE)</dt><dd>${C.escape(p.businessEntityId)}</dd>
      <dt>Parzellen-Nr.</dt><dd>${C.escape(p.plotNumber || '—')}</dd>
      <dt>EGRID</dt><dd>${C.escape(p.egrid || '—')}</dd>
      <dt>Gemeinde</dt><dd>${C.escape(p.municipality || p.city)}</dd>
      <dt>Land / Region</dt><dd>${C.escape([p.country, p.canton].filter(Boolean).join(' · '))}</dd>
      <dt>Grundstücksfläche (GSF)</dt><dd>${formatArea(p.gsf)}</dd>
      <dt>Nutzungszone</dt><dd>${C.escape(p.zone || '—')}</dd>
      <dt>Eigentumsverhältnis</dt><dd>${C.escape(p.ownership)}</dd>
      <dt>Status</dt><dd>${statusBadge(C, ref, p.status)}</dd>
      ${building ? `<dt>Gebäude auf der Parzelle</dt><dd><a href="#/app/portfolio?id=${encodeURIComponent(building.bbl_id)}">${C.escape(building.name)}</a></dd>` : ''}
    </dl>`;
  }
  function landcoverPanel() {

    const total = covers.reduce((s, c) => s + (Number(c.area) || 0), 0);
    return `${covers.length ? `<p class="lead mt-0">Bedeckte Fläche total: <strong>${formatArea(total)}</strong> <span class="small muted">(${covers.length} Bedeckungen)</span></p>` : ''}
      ${C.table({ zebra: true, caption: 'Bodenbedeckung (amtliche Vermessung)',
        emptyText: 'Keine Bodenbedeckungsdaten (amtliche Vermessung) erfasst.', columns: [
        { key: 'type', label: 'Bodenbedeckungsart', render: (c) => C.escape(c.type) },
        { key: 'area', label: 'Fläche', render: (c) => `${formatArea(c.area)}` },
        { key: 'status', label: 'AV-Status', render: (c) => C.escape(c.status || '—') },
        { key: 'egrid', label: 'EGRID', render: (c) => `<span class="small">${C.escape(c.egrid || '—')}</span>` },
      ], rows: covers.slice().sort((a, c) => (c.area || 0) - (a.area || 0)) })}`;
  }
  const panelHtml = (id) => id === 'landcover' ? landcoverPanel() : overviewPanel();

  mount.innerHTML = `
  <div class="container section">
    ${''}
    ${C.detailBar({ backHref: '#/app/portfolio', backLabel: 'Liegenschaften Inventar' })}
    <h1 tabindex="-1">${C.escape(p.name)}</h1>
    <p class="lead">${C.escape(p.street)}, ${C.escape(p.zip)} ${C.escape(p.city)} · ${C.escape(p.zone || 'Grundstück')}</p>
    ${heroMosaic(C, { id: 'pf-mosaic', items: galleryItems, mapId: 'pf-parcel-map', lat: p.lat, lon: p.lng, mapLabel: `Bodenbedeckung von ${p.name} auf der Karte` })}
    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active, idPrefix: 'pf-ptab', ariaLabel: 'Grundstücksdetails' })}
      ${C.tabPanels({ items: tabs, active, idPrefix: 'pf-ptab', render: panelHtml, heading: true })}
    </div>
  </div>`;

  C.wireTabs(mount, { syncHash: (tab) => {
    const sp = new URLSearchParams({ id: p.bbl_id });
    if (tab !== 'overview') sp.set('tab', parcelLegacyValueByTab[tab]);
    history.replaceState(history.state, '', `#/app/portfolio?${sp}`);
  } });

  const mapEl = mount.querySelector('#pf-parcel-map');
  if (mapEl) {
    const feats = covers.filter((c) => c.geom).map((c) => ({ type: 'Feature', geometry: c.geom, properties: { label: c.type, sub: `${formatArea(c.area)}`, id: p.bbl_id } }));
    if (p.geom) feats.push({ type: 'Feature', geometry: p.geom, properties: { label: p.name, sub: 'Parzelle', id: p.bbl_id } });
    pfMap.mount(mapEl, (node) => initEstateMap(node, [], { type: 'FeatureCollection', features: feats }, p.bbl_id, { focusPopup: false }));
  }

  wireHeroMosaic(mount, openGallery, galleryItems, C);
  restoreGalleryFromQuery(query, galleryItems, C);

}

const BUILDING_STATUS_VARIANT = { Aktiv: 'success', Abgang: 'warning', 'Löschvermerk': 'gray' };
const CONTRACT_STATUS_VARIANT = { Aktiv: 'success', Ausgelaufen: 'gray', 'Gekündigt': 'warning' };
function statusBadge(C, ref, statusId) { const m = (ref.buildingStatuses || []).find((s) => s.id === statusId); return C.badge(m ? m.label : statusId, BUILDING_STATUS_VARIANT[statusId] || 'gray'); }
function classBadge(C, ref, clsId) { const m = (ref.classificationTiers || []).find((t) => t.id === clsId); return C.badge(m ? m.label : clsId, m ? m.variant : 'gray'); }
