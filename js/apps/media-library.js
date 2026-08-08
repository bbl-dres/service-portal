// Media catalogue and detail views across buildings, parcels and projects.

import { initEstateMap } from '../map/buildings-map.js';
import { createMapSlot } from '../map/map-slot.js';
import { openGallery } from '../ui/gallery.js';
import { APPLICATIONS, trail } from '../crumbs.js';

export const needs = ['buildings', 'media', 'parcels', 'projects'];
const isHistoric = (m) => m.historicPeriod === 'historisch';

const relatedObjectId = (m) => m.buildingId || m.parcelId || m.projectId || '';
const relatedObjectName = (core, id) => {
  if (!id) return 'Ohne Objektbezug';
  const b = core.building(id); if (b) return b.name;
  const p = core.parcel(id); if (p) return p.name;
  const pr = core.project(id); if (pr) return pr.name || id;
  return String(id);
};

const galleryItem = (C, core, m) => ({
  id: m.mediaId,
  photo: m.photo, photoSrc: m.file || '', title: m.title, meta: `${m.date} · ${relatedObjectName(core, relatedObjectId(m))}`,
  type: m.mediaType, gray: isHistoric(m),
  href: `#/app/media-library/${encodeURIComponent(m.mediaId)}`,
  details: [
    ['Typ', m.mediaType === 'video' ? 'Video' : 'Foto'],
    ['Datum', m.date],
    ['Epoche', isHistoric(m) ? 'Historisch' : 'Aktuell'],
    ['Objekt', relatedObjectName(core, relatedObjectId(m))],
    [m.mediaType === 'video' ? 'Quelle' : 'Fotograf:in', m.photographer],
    ['Copyright', m.copyright],
    ['Zugriff', m.accessLevel],
    ['Koordinaten', Number.isFinite(m.lat) ? `${m.lat.toFixed(5)}, ${m.lon.toFixed(5)}` : '—'],
  ],
});

const PER_PAGE = 12;
const SORT_OPTS = [
  ['datum-desc', 'Datum (neuste zuerst)'],
  ['datum-asc', 'Datum (älteste zuerst)'],
  ['titel', 'Titel (A–Z)'],
  ['objekt', 'Objekt (A–Z)'],
];

export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs } = ctx;
  if (params[0]) return detail(ctx, params[0]);

  setTitle('Mediathek Bauten');

  setCrumbs(trail(APPLICATIONS, { label: 'Mediathek Bauten' }));

  const all = core.media();

  const resolveObjectName = (id) => relatedObjectName(core, id);

  const rawQ = (query.get('q') || '').trim();
  const mediaTypes = (query.get('typ') || '').split(',').filter(Boolean);
  const periods = (query.get('epoche') || '').split(',').filter(Boolean);
  const objectIds = (query.get('objekt') || '').split(',').filter(Boolean);
  const sortKey = SORT_OPTS.some(([v]) => v === query.get('sort')) ? query.get('sort') : 'datum-desc';
  const view = ['gallery', 'list', 'map'].includes(query.get('view')) ? query.get('view') : 'gallery';

  const base = { q: rawQ, mediaTypes, periods, objectIds, sort: sortKey, view };
  const hash = (patch = {}) => {
    const state = { ...base, ...patch };
    return C.catalogueHash('#/app/media-library', {
      q: state.q, 'typ': state.mediaTypes, 'epoche': state.periods, 'objekt': state.objectIds,
      sort: state.sort, view: state.view, page: state.page,
    });
  };

  const needle = rawQ.toLowerCase();
  const matches = (m) => !needle || [m.title, resolveObjectName(relatedObjectId(m)), m.photographer, m.date]
    .some(v => String(v || '').toLowerCase().includes(needle));

  const hits = all.filter(m => matches(m)
    && (!mediaTypes.length || mediaTypes.includes(m.mediaType))
    && (!periods.length || periods.includes(m.historicPeriod))
    && (!objectIds.length || objectIds.includes(relatedObjectId(m))));

  const SORTS = {
    'datum-desc': (a, b) => String(b.date).localeCompare(String(a.date)),
    'datum-asc': (a, b) => String(a.date).localeCompare(String(b.date)),
    'titel': (a, b) => a.title.localeCompare(b.title, 'de-CH'),
    'objekt': (a, b) => resolveObjectName(relatedObjectId(a)).localeCompare(resolveObjectName(relatedObjectId(b)), 'de-CH'),
  };
  const sorted = hits.slice().sort(SORTS[sortKey] || SORTS['datum-desc']);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const page = Math.min(Math.max(1, parseInt(query.get('page') || '1', 10) || 1), totalPages);
  const visible = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const periodBadge = (p) => p === 'historisch' ? C.badge('Historisch', 'warning') : C.badge('Aktuell', 'info');
  const mediaTypeLabel = (t) => t === 'video' ? 'Video' : 'Foto';

  const card = (m) => C.card({
    title: m.title,
    desc: `${resolveObjectName(relatedObjectId(m))} · ${m.photographer}`,
    href: `#/app/media-library/${encodeURIComponent(m.mediaId)}`,
    titleTag: 'h3',
    photo: { src: m.file || '', id: m.photo, color: m.color, alt: '', gray: isHistoric(m) },
    badges: [
      C.badge(mediaTypeLabel(m.mediaType), m.mediaType === 'video' ? 'purple' : 'blue'),
      periodBadge(m.historicPeriod),
      ...(m.accessLevel !== 'öffentlich' ? [C.badge('Intern', 'gray')] : []),
    ],
    footerInfo: C.escape(m.date), footerAction: C.cardAction(),
  });

  const listView = (rows) => C.table({
    caption: 'Aufnahmen',
    zebra: true,

    rowsClickable: true,
    columns: [
      { key: 'title', label: 'Titel', render: m =>
        `<a href="#/app/media-library/${encodeURIComponent(m.mediaId)}">${C.escape(m.title)}</a>` },
      { key: 'type', label: 'Typ', render: m => C.escape(mediaTypeLabel(m.mediaType)) },
      { key: 'object', label: 'Objekt', render: m => C.escape(resolveObjectName(relatedObjectId(m))) },
      { key: 'period', label: 'Epoche', render: m => periodBadge(m.historicPeriod) },
      { key: 'creator', label: 'Urheberschaft', render: m => C.escape(m.photographer) },
      { key: 'date', label: 'Datum', align: 'right', render: m => C.escape(m.date) },
    ],
    rows,
  });

  const mapPoints = () => sorted
    .filter(m => Number.isFinite(m.lat) && Number.isFinite(m.lon))
    .map(m => ({
      lat: m.lat, lon: m.lon, bblId: m.mediaId, label: m.title,
      sub: `${mediaTypeLabel(m.mediaType)} · ${m.date} · ${resolveObjectName(relatedObjectId(m))}`,
      href: `#/app/media-library/${encodeURIComponent(m.mediaId)}`,
    }));
  const mapView = () => {
    const n = mapPoints().length;
    return `<div class="pf-map dash-map mt-4" id="med-map" role="group"
        aria-label="Karte der Aufnahmeorte"></div>
      <p class="small muted mt-2">${n} von ${sorted.length} Aufnahmen sind georeferenziert.`
      + ` Demo-Daten: die Positionen liegen bis rund 30 m um das abgebildete Objekt.</p>`;
  };

  const active = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hash({ q: '' }) }] : []),
    ...mediaTypes.map(x => ({ label: mediaTypeLabel(x), href: hash({ mediaTypes: mediaTypes.filter(y => y !== x) }) })),
    ...periods.map(x => ({ label: x === 'historisch' ? 'Historisch' : 'Aktuell', href: hash({ periods: periods.filter(y => y !== x) }) })),
    ...objectIds.map(x => ({ label: resolveObjectName(x), href: hash({ objectIds: objectIds.filter(y => y !== x) }) })),
  ];

  const objectOptions = [...new Set(all.map(relatedObjectId).filter(Boolean))]
    .map(id => ({ value: id, label: resolveObjectName(id) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de-CH'));

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Mediathek Bauten',
      lead: 'Fotos und Videos der Bundesbauten — von historischen Aufnahmen bis zu aktuellen Dokumentationen.',
    })}
    ${C.catalogueBar({
      formId: 'med-search', inputId: 'medq', searchLabel: 'Aufnahme suchen',
      placeholder: 'Titel, Objekt oder Urheberschaft suchen…', q: rawQ,
      countId: 'med-count',

      count: view === 'map'
        ? `<strong>${sorted.length}</strong> ${sorted.length === 1 ? 'Aufnahme' : 'Aufnahmen'}`
        : `<strong>${sorted.length}</strong> von ${all.length} Aufnahmen${totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : ''}`,
      sort: { id: 'med-sort', value: sortKey, options: SORT_OPTS },
      filterId: 'med-filter', filterLabel: 'Filter', filterCount: mediaTypes.length + periods.length + objectIds.length,
      panelId: 'med-filters', panel: `
        ${C.filterGroup({ dim: 'mediaTypes', legend: 'Medientyp', selected: mediaTypes, options: [
          { value: 'photo', label: 'Foto' }, { value: 'video', label: 'Video' }] })}
        ${C.filterGroup({ dim: 'periods', legend: 'Epoche', selected: periods, options: [
          { value: 'historisch', label: 'Historisch' }, { value: 'aktuell', label: 'Aktuell' }] })}
        ${C.filterGroup({ dim: 'objectIds', legend: 'Objekt', selected: objectIds, options: objectOptions })}
        ${C.panelReset({ href: hash({ mediaTypes: [], periods: [], objectIds: [] }) })}`,
      view, views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List'], ['map', 'Kartenansicht', 'Map']],
    })}
    ${C.activeFilters({ filters: active, resetHref: '#/app/media-library' })}
    ${C.catalogueResults({
      resetHref: '#/app/media-library',
      visible, count: sorted.length, view, page, totalPages,
      card, listView, mapView, unit: 'Aufnahmen', regionLabel: 'Aufnahmen',
      paginationInputId: 'med-page', paginationLabel: 'Seitennavigation Mediathek',
      paginationHref: (p) => hash({ page: p }),
      available: core.available('media'),
      emptyMsg: 'Keine Aufnahmen gefunden.',
      unavailableMsg: 'Medien konnten nicht geladen werden (Ladefehler).',
    })}
  </div>`;

  C.announceCatalogue({ count: sorted.length, total: all.length, unit: 'Aufnahmen', page, totalPages, view });
  C.wireCatalogue(mount, {
    formId: 'med-search', inputId: 'medq', pageInputId: 'med-page', page, totalPages, hash,
    sortId: 'med-sort', filterToggleId: 'med-filter', panelId: 'med-filters',
  });

  if (view === 'list') {

    const root = mount.querySelector('.container.section');
    if (root) C.wireTableRows(root);
  }

  if (view === 'gallery') {

    const items = sorted.filter(m => m.file || m.photo).map((m) => galleryItem(C, core, m));

    const deep = query.get('bild');
    if (deep) {
      const di = items.findIndex(x => x.id === deep);
      if (di >= 0) openGallery(items, di, C, { param: 'bild' });
    }
    mount.querySelectorAll('.catalogue-grid .card__link, main .grid .card__link').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = decodeURIComponent((a.getAttribute('href') || '').split('/').pop());
        const i = items.findIndex(x => x.href.endsWith(encodeURIComponent(id)));
        if (i < 0) return;
        e.preventDefault();
        openGallery(items, i, C, { param: 'bild' });
      });
    });
  }

  if (view === 'map') {
    const el = mount.querySelector('#med-map');
    if (el) {

      const slot = createMapSlot();
      slot.mount(el, (node) => initEstateMap(node, mapPoints(), null, null, { focusPopup: false }));
      ctx.onUnmount(slot.free);
    }
  }
}

function detail(ctx, id) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  const all = core.media();
  const m = all.find(x => x.mediaId === id);
  if (!m) {

    C.renderNotFound(ctx, { title: 'Medium nicht gefunden',
      backHref: '#/app/media-library', backLabel: 'Mediathek Bauten',
      crumbs: trail(APPLICATIONS, { label: 'Mediathek Bauten', href: '#/app/media-library' }),
      body: 'Dieses Medium existiert nicht (oder wurde zurückgezogen). <a href="#/app/media-library">Zur Übersicht «Mediathek Bauten»</a>' });
    return;
  }

  setTitle(m.title);
  setCrumbs(trail(APPLICATIONS,
    { label: 'Mediathek Bauten', href: '#/app/media-library' },
    { label: m.title }));

  const objectId = relatedObjectId(m);
  const objectName = relatedObjectName(core, objectId);
  const isVideo = m.mediaType === 'video';
  const isPublic = m.accessLevel === 'öffentlich';
  const hist = isHistoric(m);
  const hasGeo = Number.isFinite(m.lat) && Number.isFinite(m.lon);

  const siblings = all.filter(x => relatedObjectId(x) === objectId);

  // German tab and filter values remain public-link compatibility literals.
  const tabByLegacyValue = { 'uebersicht': 'overview', 'metadaten': 'metadata' };
  const legacyValueByTab = Object.fromEntries(Object.entries(tabByLegacyValue).map(([legacy, tab]) => [tab, legacy]));
  const tabs = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'metadata', label: 'Metadaten' },
  ];

  let active = tabByLegacyValue[query.get('tab')] || 'overview';
  if (!tabs.some((t) => t.id === active)) active = 'overview';

  const overviewPanel = () => `
    <h2 class="detail-section__title">Aufnahme</h2>
    ${

''}
    <button type="button" class="med-shot" data-open-gallery
      aria-label="${C.escape(m.title)} — in der Galerie öffnen">
      ${C.photo({ src: m.file || '', id: m.photo, color: m.color, alt: '', w: 1600, gray: hist,
        cls: 'med-shot__photo',
        overlay: isVideo ? `<span class="med-shot__play" aria-hidden="true">${C.icon('Video', 'icon--xl')}</span>` : '' })}
    </button>
    ${
''}
    ${isPublic ? '<p class="small muted">Frei verwendbar gemäss angegebenem Copyright.</p>' : ''}
    ${''}
    <div class="row mt-4">
      <a class="btn btn--filled btn--icon-left" href="${C.escape(m.url || '#')}">${C.icon('Download', 'btn__icon icon--base')}<span class="btn__text">Herunterladen</span></a>
      <button type="button" class="btn btn--outline btn--icon-left" data-open-gallery>${C.icon('Image', 'btn__icon icon--base')}<span class="btn__text">In der Galerie öffnen</span></button>
    </div>`;

  const metadataPanel = () => `
    <dl class="kv">
      <dt>Medien-ID</dt><dd>${C.escape(m.mediaId)}</dd>
      <dt>Typ</dt><dd>${isVideo ? 'Video' : 'Foto'}</dd>
      <dt>Datum</dt><dd>${C.escape(m.date)}</dd>
      <dt>Epoche</dt><dd>${hist ? 'Historisch' : 'Aktuell'}</dd>
      <dt>Objekt</dt><dd><a href="#/app/portfolio?id=${encodeURIComponent(objectId)}">${C.escape(objectName)}</a>
        <span class="small muted">${C.escape(objectId)}</span></dd>
      <dt>${isVideo ? 'Quelle' : 'Fotograf:in'}</dt><dd>${C.escape(m.photographer)}</dd>
      <dt>Copyright</dt><dd>${C.escape(m.copyright)}</dd>
      <dt>Zugriff</dt><dd>${C.escape(m.accessLevel)}</dd>
      <dt>Aufnahmeort</dt><dd>${hasGeo
        ? `${m.lat.toFixed(5)}, ${m.lon.toFixed(5)} <span class="small muted">WGS 84</span>`
        : '—'}</dd>
    </dl>
    ${
''}
    ${hasGeo ? '<div class="pf-map dash-map mt-4" id="med-detail-map" role="group" aria-label="Aufnahmeort auf der Karte"></div>' : ''}`;

  const panels = { overview: overviewPanel, metadata: metadataPanel };
  const panelHtml = (panelId) => (panels[panelId] || overviewPanel)();

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: '#/app/media-library', backLabel: 'Mediathek Bauten' })}
    <h1 tabindex="-1">${C.escape(m.title)}</h1>
    <p class="lead">${C.escape(objectName)} · ${C.escape(m.date)}</p>

    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active, idPrefix: 'med-tab', ariaLabel: 'Details zur Aufnahme' })}
      ${C.tabPanels({ items: tabs, active, idPrefix: 'med-tab', render: panelHtml, heading: true })}
    </div>
  </div>`;

  C.wireTabs(mount, {
    syncHash: (tab) => history.replaceState(history.state, '',
      `#/app/media-library/${encodeURIComponent(m.mediaId)}${tab === 'overview' ? '' : '?tab=' + legacyValueByTab[tab]}`),
  });

  const items = siblings.filter(x => x.file || x.photo).map((x) => galleryItem(C, core, x));
  const startAt = Math.max(0, items.findIndex(x => x.href.endsWith(encodeURIComponent(m.mediaId))));

  const root = mount.querySelector('.container.section');
  if (root) root.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-gallery]')) { e.preventDefault(); openGallery(items, startAt, C, { param: 'bild' }); }
  });

  if (hasGeo) {
    const el = mount.querySelector('#med-detail-map');
    if (el) {
      const slot = createMapSlot();
      slot.mount(el, (node) => initEstateMap(node, [{ lat: m.lat, lon: m.lon, label: m.title, bblId: m.mediaId,
        sub: `Aufnahmeort · ${objectName}` }], null, m.mediaId, { focusPopup: false }));
      ctx.onUnmount(slot.free);
    }
  }

}
