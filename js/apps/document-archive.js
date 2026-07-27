// Bauwerksdokumentation — durchsuchbares, filterbares Archiv (Liste). Verwendet die
// gemeinsame `catbar` (Suche + Sortierung + Filter, ohne Ansichtswechsel, da nur Liste)
// + die Aktive-Filter-Zeile, wie die übrigen Katalogansichten. Titel/Vorschau öffnen
// den Dokument-Viewer mit der aktuellen Trefferliste als Blätter-Kontext.
import { openDocumentViewer } from '../doc-viewer.js';

const nameCmp = (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'de');
const SORT_OPTS = [
  { value: 'title', label: 'Titel (A–Z)' },
  { value: 'type', label: 'Dokumenttyp' },
  { value: 'year', label: 'Jahr (neuste zuerst)' },
  { value: 'size', label: 'Grösse (grösste zuerst)' },
];
const SORTS = {
  title: nameCmp,
  type: (a, b) => String(a.type || '').localeCompare(String(b.type || ''), 'de') || nameCmp(a, b),
  year: (a, b) => (b.year || 0) - (a.year || 0) || nameCmp(a, b),
  size: (a, b) => (b.sizeKB || 0) - (a.sizeKB || 0) || nameCmp(a, b),
};
const PER_PAGE = 10;

export default async function render(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  setTitle('Bauwerksdokumentation');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Bauwerksdokumentation' },
  ]);

  const all = core.documents();
  const buildings = core.buildings();
  const tiers = core.ref().classificationTiers || [];
  const types = [...new Set(all.map(d => d.type))].sort((a, b) => a.localeCompare(b, 'de'));
  const years = [...new Set(all.map(d => d.year))].sort((a, b) => b - a);
  const tierVariant = (id) => { const t = tiers.find(x => x.id === id); return t ? t.variant : 'gray'; };
  const fmtSize = (kb) => { const n = Number(kb) || 0; return n >= 1024
    ? (n / 1024).toLocaleString('de-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' MB'
    : n.toLocaleString('de-CH') + ' KB'; };
  const esc = (s) => C.escape(String(s == null ? '' : s));

  const parseArr = (k) => (query.get(k) || '').split(',').map(s => s.trim()).filter(Boolean);
  const state = {
    filters: { building: parseArr('building'), type: parseArr('type'), year: parseArr('year'), class: parseArr('class') },
    q: query.get('q') || '', sort: 'title', page: 1,
  };

  const inFilters = (d) => (!state.filters.building.length || (d.linkedTo || []).some(b => state.filters.building.includes(b)))
    && (!state.filters.type.length || state.filters.type.includes(d.type))
    && (!state.filters.year.length || state.filters.year.includes(String(d.year)))
    && (!state.filters.class.length || state.filters.class.includes(d.classification));
  const inSearch = (d) => { const q = state.q.trim().toLowerCase(); return !q || `${d.title} ${d.type} ${d.category}`.toLowerCase().includes(q); };
  const filtered = () => all.filter(d => inFilters(d) && inSearch(d)).sort(SORTS[state.sort] || SORTS.title);

  function resultTable(rows) {
    return C.table({ zebra: true, caption: 'Bauwerksdokumentation', columns: [
      { key: 'title', label: 'Dokument', render: r => `<button type="button" class="doc-open" data-doc="${esc(r.docId)}">${C.icon('File', 'icon--base')} <span>${esc(r.title)}</span></button>` },
      { key: 'type', label: 'Typ', render: r => C.badge(r.type, 'gray') },
      { key: 'building', label: 'Gebäude', render: r => { const bid = (r.linkedTo || [])[0]; const b = bid ? core.building(bid) : null; return b ? `<a href="#/app/portfolio?id=${encodeURIComponent(b.bbl_id)}">${esc(b.name)}</a>` : '<span class="muted">—</span>'; } },
      { key: 'year', label: 'Jahr', align: 'right', render: r => esc(r.year) },
      { key: 'size', label: 'Grösse', align: 'right', render: r => fmtSize(r.sizeKB) },
      { key: 'classification', label: 'Klassifizierung', render: r => C.badge(r.classification, tierVariant(r.classification)) },
      { key: 'preview', label: 'Vorschau', render: r => `<button type="button" class="btn btn--link doc-open" data-doc="${esc(r.docId)}" aria-label="Vorschau ${esc(r.title)}">${C.icon('File', 'icon--base')} Öffnen</button>` },
    ], rows });
  }

  function renderActiveFilters() {
    const box = mount.querySelector('#doc-activefilters'); if (!box) return;
    const pills = [];
    if (state.q.trim()) pills.push({ label: `Suche: „${state.q.trim()}“`, remove: 'q' });
    state.filters.building.forEach(v => { const b = core.building(v); pills.push({ label: b ? b.name : v, remove: `building:${v}` }); });
    state.filters.type.forEach(v => pills.push({ label: v, remove: `type:${v}` }));
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
    const qs = qp.toString();
    try { history.replaceState(null, '', '#/app/document-archive' + (qs ? '?' + qs : '')); } catch { /* nicht kritisch */ }
  }

  function renderMain() {
    const rows = filtered();
    const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
    if (state.page > totalPages) state.page = totalPages;
    const visible = rows.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);
    const cnt = mount.querySelector('#doc-count');
    if (cnt) cnt.innerHTML = `<strong>${rows.length}</strong> von ${all.length} Dokumente${totalPages > 1 ? ` · Seite ${state.page} von ${totalPages}` : ''}`;
    const main = mount.querySelector('#doc-main');
    main.innerHTML = rows.length
      // Ohne `href`-Builder: C.pagination rendert <button data-page> statt
      // <a href="#">. Die Seite hält ihren Zustand in JS, `#` war ein toter
      // Link — kopierbar, in neuem Tab öffenbar, und führte nirgendwohin.
      ? resultTable(visible) + C.pagination({ page: state.page, totalPages, inputId: 'doc-page', label: 'Seitennavigation Bauwerksdokumentation' })
      : C.empty('Keine Dokumente für die gewählten Filter gefunden.', {
          hint: 'Setzen Sie die Filter zurück oder ändern Sie den Suchbegriff.',
          action: { label: 'Filter und Suche zurücksetzen', id: 'doc-empty-reset' },
        });
    if (totalPages > 1) C.wirePagination(mount, 'doc-page', state.page, totalPages, (t) => { state.page = t; renderMain(); });
    renderActiveFilters();
    syncHash();
  }

  // --- chrome (once) ------------------------------------------------------
  const filterPanel = `
      ${C.filterGroup({ dim: 'building', legend: 'Gebäude', selected: state.filters.building, options: buildings.map(b => ({ value: b.bbl_id, label: b.name })) })}
      ${C.filterGroup({ dim: 'type', legend: 'Dokumenttyp', selected: state.filters.type, options: types.map(t => ({ value: t, label: t })) })}
      ${C.filterGroup({ dim: 'year', legend: 'Jahr', selected: state.filters.year, options: years.map(y => ({ value: String(y), label: String(y) })) })}
      ${C.filterGroup({ dim: 'class', legend: 'Klassifizierung', selected: state.filters.class, options: tiers.map(t => ({ value: t.id, label: t.label })) })}
      <div class="catbar__panel__actions"><button type="button" class="btn btn--bare btn--sm" id="doc-freset">${C.icon('Refresh', 'icon--base')}<span class="btn__text">Zurücksetzen</span></button></div>`;

  const filterCount = state.filters.building.length + state.filters.type.length + state.filters.year.length + state.filters.class.length;

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Bauwerksdokumentation',
      lead: 'Bauwerksdokumentation neu gedacht: statt statischer PDF-Listen ein pro Gebäude abfragbares, filterbares Archiv — nach Gebäude, Dokumenttyp, Jahr und Titel durchsuchbar.',
    })}
    ${C.catalogueBar({
      formId: 'doc-search', inputId: 'doc-q', searchLabel: 'Dokument suchen', placeholder: 'Titel, Typ oder Kategorie suchen…', q: state.q, countId: 'doc-count',
      sort: { id: 'doc-sort', label: 'Sortierung', value: state.sort, options: SORT_OPTS },
      filterId: 'doc-filter-btn', filterLabel: 'Filter', filterCount, panelId: 'doc-filters', panel: filterPanel,
    })}
    <div id="doc-activefilters"></div>
    <h2 class="sr-only">Dokumente</h2>
    <div id="doc-main" class="mt-4"></div>
  </div>`;

  // --- wiring -------------------------------------------------------------
  let searchT = null;
  const q = mount.querySelector('#doc-q');
  const runSearch = () => { state.q = q.value || ''; state.page = 1; renderMain(); };
  mount.querySelector('#doc-search').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(searchT); runSearch(); });
  q.addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(runSearch, 250); });

  const sortSel = mount.querySelector('#doc-sort');
  if (sortSel) sortSel.addEventListener('change', () => { state.sort = sortSel.value; state.page = 1; renderMain(); });

  const fbtn = mount.querySelector('#doc-filter-btn');
  const fpanel = mount.querySelector('#doc-filters');
  const fbadge = mount.querySelector('#doc-filter-btn .catbar__fcount');
  const updateFilterBadge = () => {
    const total = state.filters.building.length + state.filters.type.length + state.filters.year.length + state.filters.class.length;
    fbadge.textContent = total ? `(${total})` : ''; fbadge.hidden = !total;
  };
  const syncFilterChecks = () => fpanel.querySelectorAll('input[data-fdim]').forEach((cb) => { cb.checked = (state.filters[cb.dataset.fdim] || []).includes(cb.value); });
  const clearFilters = () => { state.filters = { building: [], type: [], year: [], class: [] }; syncFilterChecks(); updateFilterBadge(); };
  fbtn.addEventListener('click', () => { const open = !fpanel.hidden; fpanel.hidden = open; fbtn.setAttribute('aria-expanded', String(!open)); });
  fpanel.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-fdim]'); if (!cb) return;
    const dim = cb.dataset.fdim, arr = state.filters[dim];
    if (cb.checked) { if (!arr.includes(cb.value)) arr.push(cb.value); } else state.filters[dim] = arr.filter((x) => x !== cb.value);
    updateFilterBadge(); state.page = 1; renderMain();
  });
  mount.querySelector('#doc-freset').addEventListener('click', () => { clearFilters(); state.page = 1; renderMain(); });

  mount.querySelector('#doc-activefilters').addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) { state.q = ''; q.value = ''; clearFilters(); state.page = 1; renderMain(); return; }
    const pill = e.target.closest('[data-remove]'); if (!pill) return;
    const tok = pill.dataset.remove;
    if (tok === 'q') { state.q = ''; q.value = ''; }
    else { const i = tok.indexOf(':'), dim = tok.slice(0, i); state.filters[dim] = (state.filters[dim] || []).filter((x) => x !== tok.slice(i + 1)); syncFilterChecks(); updateFilterBadge(); }
    state.page = 1; renderMain();
  });

  // Delegated: pagination prev/next + Dokument-Vorschau (Blätter-Kontext = aktuelle Treffer).
  mount.querySelector('#doc-main').addEventListener('click', (e) => {
    const pg = e.target.closest('.pagination_items [data-page]');
    if (pg) { state.page = Number(pg.dataset.page) || state.page; renderMain(); return; }
    // Nullzustand: Suche + Filter in einem Klick zurücksetzen (Item 5.13).
    if (e.target.closest('#doc-empty-reset')) {
      state.q = ''; q.value = ''; clearFilters(); state.page = 1; renderMain();
      const el = mount.querySelector('#doc-q'); if (el) el.focus();
      return;
    }
    const open = e.target.closest('.doc-open');
    if (open) { const rows = filtered(); const d = rows.find((x) => x.docId === open.getAttribute('data-doc')); if (d) openDocumentViewer(d, rows); }
  });

  renderMain();
}
