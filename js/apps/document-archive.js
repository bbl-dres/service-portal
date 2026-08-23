// Searchable construction-document archive with the shared document viewer.

import { documentFileName, documentThumb, openDocumentViewer } from '../ui/doc-viewer.js';
import { formatFileSize } from '../format.js';
import { APPLICATIONS, trail } from '../crumbs.js';
import { preparePage } from '../collections.js';

export const needs = ['buildings', 'documents'];
const typeKey = (d) => d.typeCode || d.type || '';
const typeLabel = (d) => [d.typeCode, d.type].filter(Boolean).join(' · ') || '—';
const nameCmp = (a, b) => documentFileName(a).localeCompare(documentFileName(b), 'de');
const SORT_OPTS = [
  { value: 'title', label: 'Dateiname (A–Z)' },
  { value: 'type', label: 'KBOB-Typ' },
  { value: 'year', label: 'Jahr (neuste zuerst)' },
  { value: 'size', label: 'Grösse (grösste zuerst)' },
];
const SORTS = {
  title: nameCmp,
  type: (a, b) => typeKey(a).localeCompare(typeKey(b), 'de') || nameCmp(a, b),
  year: (a, b) => (b.year || 0) - (a.year || 0) || nameCmp(a, b),
  size: (a, b) => (b.sizeKB || 0) - (a.sizeKB || 0) || nameCmp(a, b),
};
// A row is one line, a tile is a block: the list fits ten comfortably, the
// gallery wants a number that divides by both grid widths (2 and 3 columns).
const PER_PAGE = { list: 10, gallery: 12 };
const VIEWS = [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List']];
// LIST is the default here, unlike the catalogues. This archive is searched by
// filename, KBOB type and year — text a row shows and a tile cannot — and the
// preview is a schematic of a mock document, useful for recognising a plan from
// a report but not for reading one.
const DEFAULT_VIEW = 'list';

export default async function render(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  setTitle('Bauwerksdokumentation');

  setCrumbs(trail(APPLICATIONS, { label: 'Bauwerksdokumentation' }));

  const all = core.documents();
  const buildings = core.buildings();
  const tiers = core.ref().classificationTiers || [];
  const types = [...new Map(all.map(d => [typeKey(d), { value: typeKey(d), label: typeLabel(d) }])).values()]
    .sort((a, b) => a.value.localeCompare(b.value, 'de'));
  const years = [...new Set(all.map(d => d.year))].sort((a, b) => b - a);
  const tierVariant = (id) => { const t = tiers.find(x => x.id === id); return t ? t.variant : 'gray'; };

  const esc = C.escape;

  const parseArr = (k) => (query.get(k) || '').split(',').map(s => s.trim()).filter(Boolean);

  const state = {
    filters: { building: parseArr('building'), type: parseArr('type'), year: parseArr('year'), class: parseArr('class') },
    q: query.get('q') || '',
    sort: SORT_OPTS.some(o => o.value === query.get('sort')) ? query.get('sort') : 'title',
    // `view` is read and written by C.wireCatalogueState, like q/sort/page.
    view: VIEWS.some(([v]) => v === query.get('view')) ? query.get('view') : DEFAULT_VIEW,
    page: Math.max(1, Number(query.get('page')) || 1),
  };

  const inFilters = (d) => (!state.filters.building.length || (d.linkedTo || []).some(b => state.filters.building.includes(b)))
    && (!state.filters.type.length || state.filters.type.some(value => value === typeKey(d) || value === d.type))
    && (!state.filters.year.length || state.filters.year.includes(String(d.year)))
    && (!state.filters.class.length || state.filters.class.includes(d.classification));
  const inSearch = (d) => { const q = state.q.trim().toLowerCase(); return !q || `${documentFileName(d)} ${d.typeCode || ''} ${d.type} ${d.category}`.toLowerCase().includes(q); };
  const filtered = () => all.filter(d => inFilters(d) && inSearch(d));

  function resultTable(rows) {
    return C.table({ zebra: true, caption: 'Bauwerksdokumentation', columns: [
      { key: 'title', label: 'Dokument', render: r => `<button type="button" class="doc-open interactive-control" data-doc="${esc(r.docId)}" aria-label="${esc(documentFileName(r))} öffnen"><span>${esc(documentFileName(r))}</span></button>` },
      { key: 'type', label: 'KBOB-Typ', render: r => esc(typeLabel(r)) },
      { key: 'building', label: 'Gebäude', render: r => { const bid = (r.linkedTo || [])[0]; const b = bid ? core.building(bid) : null; return b ? esc(b.name) : '<span class="muted">—</span>'; } },
      { key: 'year', label: 'Jahr', align: 'right', render: r => esc(r.year) },
      { key: 'size', label: 'Grösse', align: 'right', render: r => formatFileSize(r.sizeKB) },
      { key: 'classification', label: 'Klassifizierung', render: r => C.badge(r.classification, tierVariant(r.classification)) },
    ], rows });
  }

  // A tile is the same control as a row: a button that opens the viewer, not a
  // link — the archive has no per-document route. The card shell is the shared
  // one so the archive looks like every other gallery in the portal.
  function resultGallery(rows) {
    const tile = (r) => {
      const bid = (r.linkedTo || [])[0];
      const b = bid ? core.building(bid) : null;
      return `<div class="card card--default doc-card">
        <div class="card__image doc-card__preview">${documentThumb(r)}</div>
        <div class="card__content">
          <div class="card__body">
            <h3 class="card__title">
              <button type="button" class="doc-open doc-card__open interactive-control" data-doc="${esc(r.docId)}"
                aria-label="${esc(documentFileName(r))} öffnen">${esc(documentFileName(r))}</button>
            </h3>
            <p class="card__description">${esc(typeLabel(r))}${b ? ` · ${esc(b.name)}` : ''}</p>
            <div class="pill-row">${C.badge(r.classification, tierVariant(r.classification))}</div>
          </div>
          <div class="card__footer">
            <div class="card__footer__info">${esc(String(r.year || '—'))} · ${formatFileSize(r.sizeKB)}</div>
          </div>
        </div>
      </div>`;
    };
    return `<div class="grid grid--responsive-cols-3 gap--top">${rows.map(tile).join('')}</div>`;
  }

  function renderActiveFilters() {
    const box = mount.querySelector('#doc-activefilters'); if (!box) return;
    const pills = [];
    if (state.q.trim()) pills.push({ label: `Suche: «${state.q.trim()}»`, remove: 'q' });
    state.filters.building.forEach(v => { const b = core.building(v); pills.push({ label: b ? b.name : v, remove: `building:${v}` }); });
    state.filters.type.forEach(v => { const t = types.find(x => x.value === v || x.label.endsWith(` · ${v}`)); pills.push({ label: t ? t.label : v, remove: `type:${v}` }); });
    state.filters.year.forEach(v => pills.push({ label: `Jahr ${v}`, remove: `year:${v}` }));
    state.filters.class.forEach(v => pills.push({ label: v, remove: `class:${v}` }));
    box.innerHTML = C.activeFilters({ filters: pills });
  }

  function syncHash() {
    const qp = new URLSearchParams();
    if (state.q.trim()) qp.set('q', state.q.trim());
    for (const [k, dim] of [['building', 'building'], ['type', 'type'], ['year', 'year'], ['class', 'class']]) {
      if (state.filters[dim].length) qp.set(k, state.filters[dim].join(','));
    }

    if (state.sort !== 'title') qp.set('sort', state.sort);
    if (state.view !== DEFAULT_VIEW) qp.set('view', state.view);
    if (state.page > 1) qp.set('page', String(state.page));
    const qs = qp.toString();
    try { history.replaceState(history.state, '', '#/app/document-archive' + (qs ? '?' + qs : '')); } catch {  }
  }

  function renderMain() {
    const { sorted: rows, visible, page, totalPages } = preparePage(filtered(), {
      compare: SORTS[state.sort] || SORTS.title,
      page: state.page,
      perPage: PER_PAGE[state.view] || PER_PAGE.list,
    });
    state.page = page;
    const cnt = mount.querySelector('#doc-count');

    if (cnt) cnt.innerHTML = C.countText({ nom: 'Dokumente', dat: 'Dokumenten' }, all.length, rows.length);
    const main = mount.querySelector('#doc-main');
    main.innerHTML = rows.length

      ? (state.view === 'gallery' ? resultGallery(visible) : resultTable(visible))
        + C.pagination({ page: state.page, totalPages, inputId: 'doc-page', label: 'Seitennavigation Bauwerksdokumentation' })
      : C.empty('Keine Dokumente gefunden.', {
          hint: 'Passen Sie Ihre Suche oder die Filter an.',
          action: { label: 'Suche und Filter zurücksetzen', id: 'doc-empty-reset' },
        });
    if (totalPages > 1) C.wirePagination(mount, 'doc-page', state.page, totalPages, (t) => { state.page = t; renderMain(); });
    // The switch is rendered once with the page; keep its pressed state in step
    // with a view change that came from the hash or from the other button.
    mount.querySelectorAll('.view-switch__btn').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.view === state.view));
    });
    renderActiveFilters();
    syncHash();

    C.announceCatalogue({ count: rows.length, total: all.length, unit: 'Dokumenten', page: state.page, totalPages, view: state.view });
  }

  const filterPanel = `
      ${/* Capped: 22 buildings made this facet ~900px tall, which set the height
            of the whole panel and left the columns beside it empty. The rest sit
            behind the show-all disclosure, wired by C.wireCatalogueState. */''}
      ${C.filterGroup({ dim: 'building', legend: 'Gebäude', max: 8, selected: state.filters.building, options: buildings.map(b => ({ value: b.bbl_id, label: b.name })) })}
      ${C.filterGroup({ dim: 'type', legend: 'KBOB-Dokumenttyp', selected: state.filters.type, options: types })}
      ${C.filterGroup({ dim: 'year', legend: 'Jahr', selected: state.filters.year, options: years.map(y => ({ value: String(y), label: String(y) })) })}
      ${C.filterGroup({ dim: 'class', legend: 'Klassifizierung', selected: state.filters.class, options: tiers.map(t => ({ value: t.id, label: t.label })) })}
      ${C.panelReset({ id: 'doc-freset' })}`;

  const filterCount = state.filters.building.length + state.filters.type.length + state.filters.year.length + state.filters.class.length;

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Bauwerksdokumentation',
      lead: 'Pläne, Berichte und weitere Bauwerksdokumente nach Gebäude, KBOB-Dokumenttyp, Jahr und Dateiname durchsuchen.',
    })}
    ${C.catalogueBar({
      formId: 'doc-search', inputId: 'doc-q', searchLabel: 'Dokument suchen', placeholder: 'Dateiname, KBOB-Typ oder Kategorie suchen…', q: state.q, countId: 'doc-count',
      sort: { id: 'doc-sort', value: state.sort, options: SORT_OPTS },
      filterId: 'doc-filter-btn', filterLabel: 'Filter', filterCount, panelId: 'doc-filters', panel: filterPanel,
      view: state.view, views: VIEWS,
    })}
    <div id="doc-activefilters"></div>
    <h2 class="sr-only">Dokumente</h2>
    <div id="doc-main" class="mt-4"></div>
  </div>`;

  const catalogue = C.wireCatalogueState(mount, {
    formId: 'doc-search', inputId: 'doc-q', sortId: 'doc-sort',
    filterToggleId: 'doc-filter-btn', panelId: 'doc-filters', resetId: 'doc-freset',
    activeFiltersId: 'doc-activefilters', state, onChange: renderMain,
  });
  const { clearFilters } = catalogue;
  ctx.onUnmount(catalogue.destroy);

  mount.querySelector('#doc-main').addEventListener('click', (e) => {

    if (e.target.closest('#doc-empty-reset')) {
      const q = mount.querySelector('#doc-q');
      state.q = ''; if (q) q.value = '';
      clearFilters(); state.page = 1; renderMain();
      if (q) q.focus();
      return;
    }
    const open = e.target.closest('.doc-open');
    if (open) {
      const rows = filtered();
      const d = rows.find((x) => x.docId === open.getAttribute('data-doc'));
      if (d) openDocumentViewer(d, rows, { buildingNameFor: id => core.building(id)?.name || id });
    }
  });

  renderMain();
}
