import { CHEVRON_SVG, escape, icon, preserveFocus, wireScrollRegions } from './primitives.js';
import { activeFilters as activeFiltersBar, empty, pageHeader, table } from './content.js';
import { announce } from './feedback.js';
import { pagination, wirePagination } from './navigation.js';
import { safeLinkUrl } from '../../security/urls.js';

// --- Results header (search.postcss:208-234) --------------------------------
// Bar above the results list: count on the left, controls on the right. The view
// switcher is an icon group on the right, separated by a rule.

// ONE `unit` string previously served both dative and nominative contexts.
// Depending on the supplied form, one half was grammatically incorrect German
// (design review A14). `unit` may therefore be an object `{ nom, dat }`;
// a plain string continues to serve both slots (most plurals are case-invariant:
// Objekte, Dokumente, Kosten).
const unitCase = (unit) => (unit && typeof unit === 'object')
  ? { nom: unit.nom || unit.dat || '', dat: unit.dat || unit.nom || '' }
  : { nom: unit || '', dat: unit || '' };

// Shared result block for catalogue pages (services/applications/datasets),
// previously copied three times (P1-7). Filtering/sorting/slicing stays in each
// page because it differs. This standardises gallery/list switching, pagination,
// and empty/unavailable state. catalogueBar already renders the visible results
// header for every caller. `visible` is the currently visible (already sliced)
// page; `count` is the total filtered hit count; `card(item)`/`listView(items)`
// render the view.
export function catalogueResults({
  visible, count, view = 'gallery', page = 1, totalPages = 1,
  card, listView, mapView, unit, gridCls = 'grid grid--responsive-cols-3',
  paginationHref, paginationInputId, paginationLabel,
  available = true, emptyMsg, unavailableMsg, note = '', noteHtml = '',
  regionLabel = '', resetHref = '',
}) {
  // Map view deliberately shows ALL hits rather than one page. A map with 10 of
  // 17 points would misrepresent the distribution, so it gets no pagination;
  // `mapView` receives the full filtered collection.
  const isMap = view === 'map' && typeof mapView === 'function';
  const body = count
    ? isMap
      ? mapView()
      : `${view === 'list'
        ? listView(visible)
        // Gallery uses CD's responsive `gap--top` scale above the grid
        // (search.postcss:196-201). Fixed mt-4/mt-6 remained at 1rem at 1024px,
        // where CD specifies 2.5rem. Only the LIST aligns flush with the rule.
        : `<div class="${gridCls} gap--top">${visible.map(card).join('')}</div>`}${
      paginationHref ? pagination({ page, totalPages, inputId: paginationInputId, label: paginationLabel, href: paginationHref }) : ''}`
    : available
      // Zero state with an exit. Advice that active filters could be reset above
      // required scrolling back and finding the bar (Item 5.13). `resetHref`
      // gives the state the same route as a control.
      ? empty(emptyMsg || `Keine ${escape(unitCase(unit).nom)} gefunden.`, {
          hint: 'Passen Sie Ihre Suche oder die Filter an.',
          action: resetHref ? { label: 'Suche und Filter zurücksetzen', href: resetHref } : null,
        })
      : empty(unavailableMsg || `${unitCase(unit).nom} konnten nicht geladen werden (Ladefehler).`, { available: false });
  // The results list needs its own heading. Cards inside are <h3>, and without
  // <h2> the outline jumped directly from the page <h1> to level 3 (WCAG 1.3.1 /
  // 2.4.10). Keep it sr-only because the visible count in catalogueBar carries
  // the same information.
  return `<section>
      <h2 class="sr-only">${escape(regionLabel || unitCase(unit).nom || 'Ergebnisse')}</h2>
      ${noteHtml || note ? `<p class="muted small mt-4">${noteHtml || escape(note)}</p>` : ''}
      ${body}
    </section>`;
}

// Standard catalogue-page live-region announcement (hit count · page · view).
export function announceCatalogue({ count, total, unit, page = 1, totalPages = 1, view = 'gallery' }) {
  announce(`${count} von ${total} ${unitCase(unit).dat}${totalPages > 1 ? `, Seite ${page} von ${totalPages}` : ''}, Ansicht ${view === 'list' ? 'Liste' : view === 'map' ? 'Karte' : 'Galerie'}`);
}

// Gallery/list icon switcher with no visible label; state is in aria-pressed and
// aria-label. CD view switcher (icon toggle group, aria-pressed). `items` permits
// other view pairs (for example, map/list for projects), rather than hard-coded
// btn--filled emphasis.
function viewSwitch(view = 'gallery', items = [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List']]) {
  const btn = ([key, label, iconName]) => {
    const on = view === key;
    // Stable id (from data in fixed order): after a state change, the router
    // restores focus through `document.getElementById(activeId)`. Without id,
    // activeId was '' and focus fell to <body> (WCAG 2.4.3).
    return `<button type="button" class="view-switch__btn interactive-control" id="view-${escape(key)}" data-view="${key}"
      aria-pressed="${on}" aria-label="${escape(label)}" title="${escape(label)}">${icon(iconName, 'icon--md')}</button>`;
  };
  return `<div class="view-switch" role="group" aria-label="Ansicht">
    ${items.map(btn).join('')}
  </div>`;
}

// --- Catalogue trio (services / applications / catalogue share this pattern) --
// One catalogue hash: consistent q/page/view, with all further filters from
// `filters` as query parameters (string is set when truthy; non-empty arrays are
// comma-joined). Default values (page 1, view 'gallery') stay out of the URL so
// it remains short and shareable. Key = parameter name (for example, `topic`,
// `tag`). `defaultView` remains 'gallery' (catalogue trio, unchanged). Search
// uses 'list' by default because CD presents search results as a list first, and
// needs the inverse: 'gallery' enters the URL there.
export function catalogueHash(base, { q = '', page = 1, view = '', defaultView = 'gallery', ...filters } = {}) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  for (const [k, v] of Object.entries(filters)) {
    if (Array.isArray(v)) { if (v.length) p.set(k, v.join(',')); }
    else if (v) p.set(k, String(v));
  }
  if (page > 1) p.set('page', String(page));
  if (view && view !== defaultView) p.set('view', view);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}


// Wire shared catalogue interactions: search form (submit → page 1), simple
// filter dropdowns (`filters: [{id, param}]` → set value, page 1), view switching
// (keeps page), and pagination. `hash(patch)` builds the target hash from base
// state + patch (caller closes over the base). The caller separately wires
// multi-value filters (for example, service topics).
export function wireCatalogue(mount, { formId, inputId, pageInputId, page = 1, totalPages = 1, hash, filters = [],
  sortId, sortParam = 'sort', filterToggleId, panelId }) {
  const form = mount.querySelector('#' + formId);
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = mount.querySelector('#' + inputId);
    location.hash = hash({ q: input ? input.value.trim() : '', page: 1 });
  });
  filters.forEach(({ id, param }) => {
    const el = mount.querySelector('#' + id);
    if (el) el.addEventListener('change', (e) => { location.hash = hash({ [param]: e.target.value, page: 1 }); });
  });
  // Sorting (catbar): value → hash, page 1.
  if (sortId) {
    const s = mount.querySelector('#' + sortId);
    if (s) s.addEventListener('change', (e) => { location.hash = hash({ [sortParam]: e.target.value, page: 1 }); });
  }
  // Filter toggle (catbar): show/hide panel (client-side only, no hash) plus
  // multi-select checkboxes. On change, comma-join every checked value in the
  // dimension (data-fdim = parameter name) into the hash, page 1.
  if (filterToggleId && panelId) {
    const btn = mount.querySelector('#' + filterToggleId), panel = mount.querySelector('#' + panelId);
    if (btn && panel) btn.addEventListener('click', () => {
      const open = !panel.hidden;
      panel.hidden = open;
      btn.setAttribute('aria-expanded', String(!open));
      // Preserve state across the rebuild (Item 3.4).
      if (open) PANEL_OPEN.delete(panelId); else PANEL_OPEN.add(panelId);
    });
    if (panel) panel.addEventListener('change', (e) => {
      const cb = e.target.closest('input[data-fdim]'); if (!cb) return;
      const dim = cb.dataset.fdim;
      const values = [...panel.querySelectorAll('input[data-fdim="' + dim + '"]:checked')].map((x) => x.value);
      location.hash = hash({ [dim]: values, page: 1 });
    });
  }
  mount.querySelectorAll('.view-switch__btn').forEach((btn) => {
    btn.addEventListener('click', () => { location.hash = hash({ page, view: btn.getAttribute('data-view') }); });
  });
  if (pageInputId) wirePagination(mount, pageInputId, page, totalPages, (target) => { location.hash = hash({ page: target }); });
}

// --- Compact catalogue bar (catbar) -----------------------------------------
// Single-row reusable toolbar for every catalogue view (portfolio, services,
// data access, applications): search + hit count on the left; after ONE rule on
// the right, sorting, filter toggle (with active count), and view switcher. The
// filter opens a collapsible panel below containing the formerly persistent
// filter dropdowns. Markup only; each page wires search/sort/filter/view itself
// (portfolio: JS state, catalogue pages: hash). `countId` names the JS-populated
// hit count; `sort` = optional dropdown {id,name,label,value,options:[{value,label}]};
// `views` = viewSwitch items; `panel` = ready filter HTML (RAW, caller escapes).
// Open filter panels survive rebuilding. On catalogue pages, a checkbox writes
// to the hash, the router redraws the page, and catalogueBar() used to return the
// panel with [hidden] again, so it closed after EVERY check. Selecting three
// topics meant opening the drawer three times. CD's `filtersAreOpen` is likewise
// state that survives filter changes (SearchResultsFilters.vue:42-104). It is
// module-wide because it belongs to the view, not the data.
const PANEL_OPEN = new Set();

export function catalogueBar({
  formId, inputId, searchLabel, placeholder = 'Suchen…', q = '', countId = 'cat-count', count = '',
  sort = null, filterId = '', filterLabel = 'Filter', filterCount = 0,
  panelId = '', panel = '', panelHidden = true,
  view = 'gallery', views, showSearch = true, extra = '',
}) {
  // Once opened, a panel stays open until the user closes it.
  if (panelId && PANEL_OPEN.has(panelId)) panelHidden = false;
  // Sorting: bare select with NO visible label (CD pattern; see indexPage.vue).
  // A disabled «Sortieren» option provides an in-control hint, with an sr-only
  // label for accessibility. If no option matches (missing/empty sort value),
  // show the «Sortieren» placeholder; otherwise select the current sort.
  const sortHtml = sort ? (() => {
    const cur = sort.value == null ? '' : String(sort.value);
    const hasSel = (sort.options || []).some((o) => String(o.value) === cur);
    return `
      <label class="sr-only" for="${escape(sort.id)}">${escape(sort.label || 'Sortierung')}</label>
      <div class="select select--bare catbar__sort">
        <select id="${escape(sort.id)}" name="${escape(sort.name || 'sort')}" class="input--outline input--sm">
          <option disabled${hasSel ? '' : ' selected'}>${escape(sort.placeholder || 'Sortieren')}</option>${
          (sort.options || []).map((o) => `<option value="${escape(o.value)}"${String(o.value) === cur ? ' selected' : ''}>${escape(o.label)}</option>`).join('')}</select>
        <div class="select__icon">${CHEVRON_SVG}</div>
      </div>`;
  })() : '';
  // Filter toggle: bare button with a chevron that rotates when open (CD .search__filters__actions).
  const filterHtml = filterId ? `
      <button type="button" class="btn btn--bare btn--sm catbar__filter" id="${escape(filterId)}" aria-expanded="${!panelHidden}"${panelId ? ` aria-controls="${escape(panelId)}"` : ''}>
        ${icon('Filter', 'btn__icon')}<span class="btn__text">${escape(filterLabel)}</span><span class="catbar__fcount"${filterCount ? '' : ' hidden'}>${filterCount ? `(${filterCount})` : ''}</span>${icon('ChevronDown', 'catbar__chev')}
      </button>` : '';
  // `showSearch:false`: search already supplies its field in the hero. CD's
  // `.search-results__header` carries only hit count left and sorting right there
  // (search.postcss:208-233), not a second field.
  const searchHtml = showSearch ? `
      ${/* role=search occurs multiple times per page (header search plus one for
            each catalogue/table bar), so every landmark needs its own name.
            `searchLabel` is already unique per bar. The
            submit button has ONE naming source: sr-only btn__text (CD pattern,
            btn.postcss:160-166), with no duplicate aria-label beside it. */''}
      <form class="catbar__search" id="${escape(formId)}" role="search" aria-label="${escape(searchLabel)}">
        <label class="sr-only" for="${escape(inputId)}">${escape(searchLabel)}</label>
        <input id="${escape(inputId)}" type="search" placeholder="${escape(placeholder)}" value="${escape(q)}" autocomplete="off">
        <button class="btn btn--bare btn--icon-only catbar__submit" type="submit" title="Suchen">${icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span></button>
      </form>` : '';
  return `
    <div class="catbar${showSearch ? '' : ' catbar--no-search'}">${searchHtml}
      <div class="catbar__count" id="${escape(countId)}">${count}</div>
      ${/* `extra`: RAW HTML at the end of the control group for a bar-level
            secondary action that is neither sorting, filtering, nor view
            switching. Room booking inserts «Grundriss ansehen» here. Without
            this slot it would sit in a second, otherwise empty right-aligned row
            above. Empty by default, so the four catalogue bars see nothing.
            Caller escapes and wires it. */''}
      <div class="catbar__controls">${sortHtml}${filterHtml}${views ? viewSwitch(view, views) : ''}${extra}</div>
    </div>${filterId ? `
    <div class="catbar__panel" id="${escape(panelId)}"${panelHidden ? ' hidden' : ''}>${panel}</div>` : ''}`;
}

// --- Data table with catalogue bar + pagination -----------------------------
// ONE building block for the recurring «long table in a detail view» pattern:
// search + hit count + sorting (+ optional facets) above the table, pagination
// below. Previously only the catalogue trio had a bar, while tables in «Meine
// personal cases and the property detail view (dimensions, equipment, contracts,
// costs, contacts, documents) were unfiltered and unlimited. They become very
// long for real buildings.
//
// Deliberately LOCAL state rather than the hash: these tables sit in tabs, and a
// hash change would redraw the entire page and reset the tab. Only their own
// subtree is rendered, preserving focus.
//
//   host      element into which content is rendered
//   id        unique prefix for every id in this block
//   rows      data rows
//   columns   as in C.table
//   unit      plural used in the hit count
//   searchKeys / search  fields or search predicate
//   sorts     [{ value, label, cmp }]
//   facets    [{ dim, legend, options:[{value,label}], match(row, values) }]
//   perPage   default 10
//   foot(visible, filtered)  optional <tfoot> row
export function mountDataTable(host, opts = {}) {
  let unwireScroll = null;
  let unwireRows = null;
  const {
    id = 'dt', rows: allRows = [], columns = [], unit = 'Einträge', caption,
    searchKeys = [], search, searchLabel, placeholder,
    sorts = [], facets = [], perPage = 10, foot, emptyMsg, note = '', rowsClickable = false,
    rowClass,
  } = opts;
  const state = { q: '', sort: '', page: 1, open: false, sel: {} };
  facets.forEach((f) => { state.sel[f.dim] = []; });

  const unwire = () => {
    if (unwireRows) { try { unwireRows(); } catch { /* Already gone. */ } unwireRows = null; }
    if (unwireScroll) { try { unwireScroll(); } catch { /* Already gone. */ } unwireScroll = null; }
  };

  const matchQ = (row) => {
    if (!state.q) return true;
    const q = state.q.toLowerCase();
    if (typeof search === 'function') return search(row, q);
    return searchKeys.some((k) => String(row[k] == null ? '' : row[k]).toLowerCase().includes(q));
  };
  const matchFacets = (row) => facets.every((f) => {
    const vals = state.sel[f.dim] || [];
    if (!vals.length) return true;
    return typeof f.match === 'function' ? f.match(row, vals) : vals.includes(String(row[f.dim]));
  });

  const draw = () => {
    // Wiring attaches to `host`, which persists across drawing. Before inserting
    // the new subtree, dispose delegated row clicks and observers; otherwise each
    // search/sort/page change would add another handler.
    unwire();
    const filtered = allRows.filter((r) => matchQ(r) && matchFacets(r));
    const sortDef = sorts.find((s) => s.value === state.sort);
    const sorted = sortDef && sortDef.cmp ? filtered.slice().sort(sortDef.cmp) : filtered;
    const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
    if (state.page > totalPages) state.page = totalPages;
    const visible = sorted.slice((state.page - 1) * perPage, state.page * perPage);
    const activeFacetCount = facets.reduce((n, f) => n + (state.sel[f.dim] || []).length, 0);

    const restore = preserveFocus(host);
    const u = unitCase(unit);
    host.innerHTML = `
      ${catalogueBar({
        formId: `${id}-form`, inputId: `${id}-q`,
        searchLabel: searchLabel || `${u.nom} durchsuchen`,
        placeholder: placeholder || `${u.nom} durchsuchen…`, q: state.q,
        countId: `${id}-count`,
        count: `<strong>${escape(String(sorted.length))}</strong> von ${escape(String(allRows.length))} ${escape(u.dat)}${
          totalPages > 1 ? ` · Seite ${state.page} von ${totalPages}` : ''}`,
        sort: sorts.length ? { id: `${id}-sort`, value: state.sort, options: sorts.map((s) => ({ value: s.value, label: s.label })) } : null,
        filterId: facets.length ? `${id}-filter` : '', filterCount: activeFacetCount,
        panelId: facets.length ? `${id}-panel` : '',
        panel: facets.map((f) => filterGroup({ dim: f.dim, legend: f.legend, options: f.options, selected: state.sel[f.dim], idPrefix: id })).join(''),
        panelHidden: !state.open,
      })}
      ${note ? `<p class="muted small mt-4">${escape(note)}</p>` : ''}
      ${/* Keep the table even with NO hits, with a row explaining why. Replacing
            it with an empty state removed header and columns: people could no
            longer see what the table represented, and filtering shifted the
            layout. Text distinguishes «no data at all» from «nothing for this
            selection». */''}
      ${table({ columns, rows: visible, zebra: true, caption, rowsClickable, rowClass,
        emptyText: allRows.length
          ? `Keine ${u.nom} für diese Suche oder Filterung.`
          : (emptyMsg || `Keine ${u.nom} erfasst.`),
        foot: sorted.length && foot ? foot(visible, sorted) : undefined })}
      ${pagination({ page: state.page, totalPages, inputId: `${id}-page`, label: `Seitennavigation ${u.nom}` })}`;

    // --- Wiring (within host only) ---
    const form = host.querySelector(`#${id}-form`);
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = host.querySelector(`#${id}-q`);
      state.q = input ? input.value.trim() : ''; state.page = 1; draw();
    });
    const sortEl = host.querySelector(`#${id}-sort`);
    if (sortEl) sortEl.addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; draw(); });
    const fBtn = host.querySelector(`#${id}-filter`);
    const fPanel = host.querySelector(`#${id}-panel`);
    if (fBtn && fPanel) {
      fBtn.addEventListener('click', () => { state.open = !state.open; draw(); });
      fPanel.addEventListener('change', (e) => {
        const cb = e.target.closest('input[data-fdim]'); if (!cb) return;
        const dim = cb.dataset.fdim;
        state.sel[dim] = [...fPanel.querySelectorAll(`input[data-fdim="${dim}"]:checked`)].map((x) => x.value);
        state.page = 1; draw();
      });
    }
    if (rowsClickable) unwireRows = wireTableRows(host);
    // wirePagination binds BOTH the input and [data-page] buttons (review A3).
    wirePagination(host, `${id}-page`, state.page, totalPages, (target) => { state.page = target; draw(); });
    unwireScroll = wireScrollRegions(host);
    restore();
    announce(`${sorted.length} von ${allRows.length} ${u.dat}${totalPages > 1 ? `, Seite ${state.page} von ${totalPages}` : ''}`);
  };
  draw();
  // Disposal function for the caller (ctx.onUnmount), ensuring observers and
  // delegated row clicks disappear when leaving the route.
  return unwire;
}

// Row click for `C.table({ rowsClickable: true })`. The row follows its FIRST
// link; keyboard and screen readers still use that link. Clicks on a control or
// selected text remain untouched, or nothing in the table could be copied.
// C.mountDataTable calls this itself. Callers rendering C.table directly invoke
// it once on `root` after insertion.
//
// ONE handler per root, enforced here rather than trusted to the caller. Whether
// a discarded disposer leaks is invisible at the call site: it depends on
// whether the root survives the next render. A node built by this render dies
// with its markup and takes the handler along; `mount` (#main-content) is
// reused for the life of the page and does not. Twelve call sites across the
// apps, three different patterns — so the safe property belongs in the function.
// A second call on the same root replaces the first instead of adding to it.
const TABLE_ROW_WIRING = new WeakMap();

export function wireTableRows(root) {
  if (!root) return () => {};
  TABLE_ROW_WIRING.get(root)?.abort();
  const ctrl = new AbortController();
  TABLE_ROW_WIRING.set(root, ctrl);
  root.addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, label, select')) return;
    const tr = e.target.closest('.table--rows-clickable tbody tr');
    if (!tr) return;
    if (String(window.getSelection?.() || '').length) return;
    tr.querySelector('a[href]')?.click();
  }, { signal: ctrl.signal });
  return () => {
    ctrl.abort();
    // Only drop the entry while it is still ours: a later wiring of the same
    // root owns the slot, and an old disposer must not clear its record.
    if (TABLE_ROW_WIRING.get(root) === ctrl) TABLE_ROW_WIRING.delete(root);
  };
}

// --- The whole catalogue page (services / applications / datasets) -----------
// The heavy parts were already shared (catalogueState, catalogueBar,
// catalogueResults, wireCatalogue). What each page still repeated was the
// SCAFFOLD around them: seven related element ids invented by hand, the same
// header-bar-pills-results order, and the same three wiring calls afterwards.
// Three copies of thirty lines whose only real differences are wording.
//
// Two things follow from collapsing it. Every id now derives from ONE prefix, so
// `formId` and `pageInputId` cannot drift apart (the input ids had already
// drifted into `aq`/`sq`/`dsq`, which no longer named anything). And there is a
// single wiring site: the row-click disposer is registered here, so no page can
// forget it — which is exactly how js/apps/shop.js had come to leak one handler
// per dispatch onto the reused mount.
//
// Deliberately NOT adopted by shop.js and media-library.js: both wrap this
// anatomy in their own layout (a category sidebar, gallery deep links). Forcing
// three pages plus two exceptions through one function would put the exceptions
// inside it as flags, which is the shape this replaces.
//
// `noun` is the singular subject and drives the search wording; `unit` is the
// plural for counts and announcements, as a string or the {nom,dat} pair a
// German sentence needs. German UI term: `Anwendung` / `Anwendungen`.
export function catalogueView({
  prefix, hash, title, lead = '', leadHtml = '', noun, unit,
  q = '', view = 'gallery', views, page = 1, totalPages = 1,
  sort, count = 0, total = 0, filterCount = 0, panel = '',
  activeFilters = [], resetHref, visible = [], card, listView,
  available = true, noteHtml = '', note = '', gridCls, regionLabel = '',
  emptyMsg, unavailableMsg,
} = {}) {
  const id = (part) => `${prefix}-${part}`;
  const plural = typeof unit === 'string' ? unit : (unit?.nom || '');
  const pageInfo = totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : '';
  const html = `
  <div class="container section">
    ${pageHeader({ title, lead, leadHtml })}
    ${catalogueBar({
    formId: id('search'), inputId: id('q'), q,
    searchLabel: `${noun} suchen`, placeholder: `${noun} suchen…`,
    countId: id('count'), count: `<strong>${count}</strong> von ${total} ${escape(plural)}${pageInfo}`,
    sort: sort ? { id: id('sort'), value: sort.value, options: sort.options } : undefined,
    filterId: id('filter'), filterLabel: 'Filter', filterCount,
    panelId: id('filters'), panel,
    view, views,
  })}
    ${activeFilters.length || resetHref ? activeFiltersBar({ filters: activeFilters, resetHref }) : ''}
    ${catalogueResults({
    resetHref, visible, count, view, page, totalPages, card, listView, unit,
    paginationInputId: id('page'), paginationLabel: `Seitennavigation ${plural}`,
    paginationHref: (target) => hash({ page: target }),
    available, noteHtml, note, gridCls, regionLabel, emptyMsg, unavailableMsg,
  })}
  </div>`;

  return {
    html,
    /** Announce the result count, wire the bar, and own the row-click disposer. */
    wire(mount, ctx) {
      announceCatalogue({ count, total, unit, page, totalPages, view });
      wireCatalogue(mount, {
        formId: id('search'), inputId: id('q'), pageInputId: id('page'),
        page, totalPages, hash,
        sortId: sort ? id('sort') : undefined,
        filterToggleId: id('filter'), panelId: id('filters'),
      });
      const unwire = wireTableRows(mount);
      if (ctx?.onUnmount) ctx.onUnmount(unwire);
      return unwire;
    },
  };
}

// Multi-select filter group (checkboxes), matching the portfolio panel
// (.filter-group / .filter-check). `dim` is the hash parameter name (placed on
// every checkbox as data-fdim); `selected` contains currently checked values.
// Wired through C.wireCatalogue: panel change → all checked values in the
// dimension → hash.
export function filterGroup({ dim, legend, options = [], selected = [], idPrefix = '', max = 0 }) {
  // `id="${idPrefix}f-${dim}-${i}"`: the index is stable because options come from
  // data in fixed order, which focus restoration requires (Item 3.3). `idPrefix`
  // keeps ids document-wide unique when two tables use the same facet dimension
  // (review a11y-dup-ids-1). `max` truncates long value lists: the remainder sits
  // in a hidden span revealed by the caller through [data-fmore] (estate).
  const p = idPrefix ? escape(idPrefix) + '-' : '';
  const cb = (o, i) => `<label class="filter-check"><input type="checkbox" id="${p}f-${escape(dim)}-${i}" data-fdim="${escape(dim)}" value="${escape(o.value)}"${
    selected.includes(o.value) ? ' checked' : ''}><span>${escape(o.label)}</span></label>`;
  const head = max && options.length > max ? options.slice(0, max) : options;
  const rest = max && options.length > max ? options.slice(max) : [];
  return `<fieldset class="filter-group"><legend class="filter-group__legend">${escape(legend)}</legend>${
    head.map(cb).join('')}${rest.length
      ? `<span class="filter-group__more" hidden>${rest.map((o, i) => cb(o, i + head.length)).join('')}</span>
         <button type="button" class="btn btn--link btn--sm" data-fmore="${escape(dim)}" aria-expanded="false"><span class="btn__text">Alle anzeigen (${options.length})</span></button>`
      : ''}</fieldset>`;
}

// --- Catalogue state from the hash query (catalogue quartet) ----------------
// Read side of the catalogue pattern. services/applications/catalog/search each
// hand-rolled ~35 identical lines of parsing/validation/clamping/slicing (design
// review B16); only the write side (catalogueHash/wireCatalogue) was shared.
// Both now come from one source.
//
//   query      route URLSearchParams
//   base       page base hash ('#/services')
//   perPage    gallery page size (default 12, divisible by BOTH 2 and 3 columns)
//   sortOpts   allowed sort values (array of option values); '' = data order
//   filters    { param: allowedValues[]|null } — multi-value, comma-joined
//   views      allowed views; defaultView stays out of the URL
//   trimQuery  trim surrounding q whitespace (default true); routes whose
//              historical deep links preserve it can opt out
//
// Returns { q, view, page, sort, selected, hash(patch), clamp(list) }.
// clamp() slices the sorted list to the page and returns
// { visible, totalPages, page }, clamping page to the valid range if necessary.
export function catalogueState(query, { base, perPage = 12, sortOpts = [], defaultSort = '',
  views = ['gallery', 'list'], defaultView = 'gallery', filters = {}, trimQuery = true } = {}) {
  const rawQ = query.get('q') || '';
  const q = trimQuery ? rawQ.trim() : rawQ;
  const rawView = query.get('view') || defaultView;
  const view = views.includes(rawView) ? rawView : defaultView;
  const rawSort = query.get('sort') || defaultSort;
  const sort = sortOpts.includes(rawSort) ? rawSort : defaultSort;
  const selected = {};
  for (const [param, allowed] of Object.entries(filters)) {
    const vals = (query.get(param) || '').split(',').map((s) => s.trim()).filter(Boolean);
    selected[param] = allowed ? vals.filter((v) => allowed.includes(v)) : vals;
  }
  const parsed = Number.parseInt(query.get('page') || '1', 10);
  let page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const hash = (patch = {}) => catalogueHash(base, { q, page, view, defaultView, sort, ...selected, ...patch });
  const clamp = (list) => {
    const totalPages = Math.max(1, Math.ceil(list.length / perPage));
    if (page > totalPages) page = totalPages;
    return { visible: list.slice((page - 1) * perPage, page * perPage), totalPages, page };
  };
  return { q, view, page, sort, selected, perPage, hash, clamp };
}

// --- JS-state catalogue wiring (explorer) -----------------------------------
// Local twin of wireCatalogue. Portfolio, construction projects, tenants, and
// building documentation keep state in a variable rather than the hash (tabs/
// tree, documented per app), and each carried a ~45-line copy of the same wiring:
// debounced search, sort, filter panel with count badge, and active pills (design
// review A2). Copies had already drifted (dead reset in tenants).
//
//   state     { q, sort, page, view, filters: { dim: value[] } } — mutated here
//   onChange  redraw results surface (renderMain)
//   onRemove  (token) for pill tokens outside 'q'/'dim:value' (for example, 'sel')
//   onReset   replaces default onChange after the full filter reset
//             (explorers additionally reset tree selection here)
//
// Returns { clearFilters, destroy } for callers that reset the panel externally.
// `destroy` belongs in ctx.onUnmount and notably discards the delayed search.
export function wireCatalogueState(mount, {
  formId, inputId, sortId = '', filterToggleId = '', panelId = '', resetId = '',
  activeFiltersId = '', state, onChange, onRemove, onReset, debounceMs = 250,
} = {}) {
  const input = inputId ? mount.querySelector('#' + inputId) : null;
  let timer = null;
  let destroyed = false;
  const runSearch = () => {
    timer = null;
    // A delayed callback belongs to the mount that scheduled it. Do not let it
    // mutate state or the hash after the router has replaced that mount.
    if (destroyed || !mount.isConnected) return;
    state.q = input ? (input.value || '') : ''; state.page = 1; onChange();
  };
  const form = formId ? mount.querySelector('#' + formId) : null;
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); timer = null; runSearch(); });
  if (input) input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runSearch, debounceMs); });

  const vs = mount.querySelector('.view-switch');
  if (vs) vs.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-switch__btn'); if (!btn) return;
    state.view = btn.dataset.view; state.page = 1; onChange();
  });

  const sortSel = sortId ? mount.querySelector('#' + sortId) : null;
  if (sortSel) sortSel.addEventListener('change', () => { state.sort = sortSel.value; state.page = 1; onChange(); });

  const fbtn = filterToggleId ? mount.querySelector('#' + filterToggleId) : null;
  const fpanel = panelId ? mount.querySelector('#' + panelId) : null;
  const fbadge = fbtn ? fbtn.querySelector('.catbar__fcount') : null;
  const dims = () => Object.keys(state.filters || {});
  const updateFilterBadge = () => {
    if (!fbadge) return;
    const total = dims().reduce((n, d) => n + (state.filters[d] || []).length, 0);
    fbadge.textContent = total ? `(${total})` : ''; fbadge.hidden = !total;
  };
  const syncFilterChecks = () => { if (fpanel) fpanel.querySelectorAll('input[data-fdim]').forEach((cb) => { cb.checked = (state.filters[cb.dataset.fdim] || []).includes(cb.value); }); };
  const clearFilters = () => { dims().forEach((d) => { state.filters[d] = []; }); syncFilterChecks(); updateFilterBadge(); };
  // Immediately show URL-restored filters on the button (url-state-1). Checkboxes
  // are already correct when filterGroup received `selected`.
  updateFilterBadge();
  // The show-all disclosure on a truncated facet (filterGroup `max`). Wired HERE
  // rather than per caller: the markup is the component's, so the behaviour that
  // goes with it should be too — otherwise every panel that caps a long list has to
  // re-implement the same eight lines, and the ones that forget render a button
  // that does nothing.
  if (fpanel) fpanel.addEventListener('click', (e) => {
    const more = e.target.closest('[data-fmore]');
    if (!more) return;
    const rest = more.closest('.filter-group')?.querySelector('.filter-group__more');
    if (!rest) return;
    const open = rest.hidden;
    rest.hidden = !open;
    more.setAttribute('aria-expanded', String(open));
  });
  if (fbtn && fpanel) fbtn.addEventListener('click', () => {
    const open = !fpanel.hidden; fpanel.hidden = open; fbtn.setAttribute('aria-expanded', String(!open));
  });
  if (fpanel) fpanel.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-fdim]'); if (!cb) return;
    const dim = cb.dataset.fdim, arr = state.filters[dim] || (state.filters[dim] = []);
    if (cb.checked) { if (!arr.includes(cb.value)) arr.push(cb.value); }
    else state.filters[dim] = arr.filter((x) => x !== cb.value);
    updateFilterBadge(); state.page = 1; onChange();
  });
  const resetBtn = resetId ? mount.querySelector('#' + resetId) : null;
  if (resetBtn) resetBtn.addEventListener('click', () => { clearFilters(); state.page = 1; onChange(); });

  const af = activeFiltersId ? mount.querySelector('#' + activeFiltersId) : null;
  if (af) af.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) {
      state.q = ''; if (input) input.value = '';
      clearFilters();
      if (onReset) onReset(); else { state.page = 1; onChange(); }
      return;
    }
    const pill = e.target.closest('[data-remove]'); if (!pill) return;
    const tok = pill.dataset.remove;
    if (tok === 'q') { state.q = ''; if (input) input.value = ''; state.page = 1; onChange(); return; }
    const i = tok.indexOf(':');
    if (i > 0 && state.filters[tok.slice(0, i)] !== undefined) {
      const dim = tok.slice(0, i);
      state.filters[dim] = (state.filters[dim] || []).filter((x) => x !== tok.slice(i + 1));
      syncFilterChecks(); updateFilterBadge(); state.page = 1; onChange(); return;
    }
    if (onRemove) onRemove(tok);   // For example, 'sel' — the caller's tree selection.
  });

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return { clearFilters, destroy };
}

// Canonical filter-panel reset — ONE anatomy for 13 panels that previously
// diverged into ~7 variants (icon class, modifier, wrapper; design review B17).
// The reset label follows CD wording (eventsList.vue). The pill row below retains
// its full-reset wording because it also clears search and tree
// selection. Use `wrap:''` for panels with their own action row (dashboards:
// .filter-panel__actions).
export function panelReset({ href = '', id = '', label = 'Filter zurücksetzen', wrap = 'catbar__panel-actions' } = {}) {
  const inner = `${icon('Refresh', 'btn__icon icon--base')}<span class="btn__text">${escape(label)}</span>`;
  const safeHref = safeLinkUrl(href);
  const ctl = safeHref
    ? `<a class="btn btn--bare btn--sm btn--icon-left" href="${escape(safeHref)}">${inner}</a>`
    : href
      ? `<span class="btn btn--bare btn--sm btn--icon-left" aria-disabled="true">${inner}</span>`
    : `<button type="button" class="btn btn--bare btn--sm btn--icon-left"${id ? ` id="${escape(id)}"` : ''}>${inner}</button>`;
  return wrap ? `<div class="${escape(wrap)}">${ctl}</div>` : ctl;
}
