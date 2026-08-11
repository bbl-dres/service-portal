// Landing page of the standalone Plan-Editor: two peer views behind one header.
//
//   #/app/floorplan-editor                      → «Portfolio» (default)
//   #/app/floorplan-editor?mode=list&obj=…      → a different portfolio surface
//   #/app/floorplan-editor?building=…&tab=…     → one object's detail registers
//   #/app/floorplan-editor?view=work            → «Meine Arbeit»
//   #/app/floorplan-editor?view=work&layer=…    → a different attribute layer
//
// Portfolio is first because the visitor arrives knowing a building, not a task:
// the map answers «is this the right object» before anything else can be asked.
//
// Deliberately separate from the plan workbench: the two have independent state,
// markup and event lifecycles. Rendering stays in work-view.js / browse-view.js;
// this module owns routing, data assembly and event wiring.

import { createMapSlot } from '../map/map-slot.js';
import { initEstateMap } from '../map/buildings-map.js';
import { markTree, restoreTreeSelection, syncTreeCounts, wireTree } from '../ui/spatial-tree.js';
import { floorplanEditor } from '../links.js';
import { listVisits, listWorkingCopies, removeWorkingCopy } from './repository.js';
import {
  DEFAULT_LAYER, planEditorLayer, planEditorRecentFloors, planEditorTaskCounts, planEditorTasks,
} from './tasks.js';
import { planEditorCases, renderWorkView, workColumns } from './work-view.js';
import {
  OBJECT_STATE, browseEntries, browseMode, browsePopupHTML, browseSort, browseStatsHTML,
  browseSurfaceHTML, renderBrowseView, sortBrowseEntries,
} from './browse-view.js';
import {
  REGISTER_BARS, objectPanelHTML, objectRoute, objectTab, placeSteps, planView, renderObjectView,
} from './object-view.js';
import {
  BASE, PLAN_STATUS, breadcrumbBarHTML, breadcrumbStepsHTML, clean, editorHeaderHTML, number,
  portfolioRoute, prototypeFooterHTML,
} from './shared.js';

const fpeMap = createMapSlot();
const TREE_ATTRS = Object.freeze(['country', 'region', 'city']);

export function planningObjects(core) {
  return (core.data.workspacePlanning || []).map((planning) => {
    const building = core.building(planning.buildingId);
    const floors = core.floorsForBuilding(planning.buildingId).sort((a, b) => a.level - b.level);
    return building && floors.length ? { building, floors, planning } : null;
  }).filter(Boolean).sort((left, right) => {
    const planned = Number(right.planning.planAvailability === 'planned') - Number(left.planning.planAvailability === 'planned');
    return planned || left.building.name.localeCompare(right.building.name, 'de');
  });
}

export function planningFloor(planning, floorId) {
  return (planning?.floors || []).find((entry) => entry.floorId === floorId) || {
    floorId, planStatus: 'inventory', equipmentCount: null, lastSync: '',
  };
}

// The mini floor plan reused from the former inspector: rooms as plain rects,
// scaled to their own extent. Cheap enough to render for every recent card.
function floorPreviewHTML(C, core, entry) {
  const rects = (core.spacesForFloor(entry.floorId) || [])
    .map((room) => room.rect).filter((rect) => Array.isArray(rect) && rect.length === 4);
  if (!rects.length) return '<span class="fpe-recent__preview fpe-recent__preview--empty" aria-hidden="true"></span>';
  const minX = Math.min(...rects.map(([x]) => Number(x)));
  const minY = Math.min(...rects.map(([, y]) => Number(y)));
  const maxX = Math.max(...rects.map(([x, , width]) => Number(x) + Number(width)));
  const maxY = Math.max(...rects.map(([, y, , height]) => Number(y) + Number(height)));
  const pad = Math.max(30, Math.round(Math.max(maxX - minX, maxY - minY) * 0.025));
  return `<span class="fpe-recent__preview"><svg viewBox="${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}"
    role="img" aria-label="Vorschau ${C.escape(entry.label)}">
    ${rects.map(([x, y, width, height]) => `<rect x="${Number(x)}" y="${Number(y)}" width="${Number(width)}" height="${Number(height)}"></rect>`).join('')}
  </svg></span>`;
}

function mapPoints(C, entries) {
  return entries
    .filter((entry) => Number.isFinite(entry.lat) && Number.isFinite(entry.lon))
    .map((entry) => ({
      lat: entry.lat,
      lon: entry.lon,
      label: entry.name,
      sub: `${entry.floors.length} Geschosse · ${OBJECT_STATE[entry.planState].label}`,
      bblId: entry.id,
      href: floorplanEditor(entry.id),
      // The marker carries the object's own detail surface: facts, floors and
      // both handoffs, anchored where the visitor clicked.
      popupHtml: browsePopupHTML(C, entry),
    }));
}

export function renderNavigation(ctx, objects, object = null, message = '') {
  const { mount, query, core, session, engine, C, onUnmount, setTitle } = ctx;

  // An explicit building opens its own detail; without one the landing shows
  // either the portfolio map or the work queue.
  const view = object ? 'object' : query.get('view') === 'work' ? 'work' : 'portfolio';
  const layer = planEditorLayer(query.get('layer') || DEFAULT_LAYER);

  ctx.onUnmount(fpeMap.free);

  setTitle(view === 'object' ? `Plan-Editor — ${object.building.name}`
    : view === 'work' ? 'Plan-Editor — Meine Arbeit' : 'Plan-Editor — Portfolio');

  const abort = new AbortController();
  const { signal } = abort;
  onUnmount(() => abort.abort());

  const header = `<div class="fpe-app fpe-landing" id="fpe-navigation" data-view="${view}">
    ${editorHeaderHTML(C, session, false, '', view)}
    ${message ? `<div class="fpe-nav-message">${C.notificationHtml(`<p class="m-0">${C.escape(message)}</p>`, 'warning', 'WarningCircle')}</div>` : ''}`;

  if (view === 'object') {
    const entry = browseEntries([object], core)[0];
    // `mark` names a floor the visitor arrived at from the structure tree. It
    // points at the row rather than opening the plan, so locating a floor and
    // opening it stay two separate decisions.
    const requestedMark = query.get('mark') || '';
    const mark = entry.floors.some((floor) => floor.floorId === requestedMark) ? requestedMark : '';
    // One search/sort pair per register: switching tabs must not carry another
    // register's filter across, and each bar redraws only its own panel.
    const registers = Object.fromEntries(Object.entries(REGISTER_BARS)
      .map(([id, bar]) => [id, { q: '', sort: bar.sort }]));
    const state = {
      tab: objectTab(query.get('tab')), plans: planView(query.get('plans')), mark, registers,
    };
    const rooms = entry.floors.flatMap((floor) => core.spacesForFloor(floor.floorId) || []);
    const previewFor = (floor) => floorPreviewHTML(C, core, floor);
    mount.innerHTML = `${header}
      ${renderObjectView(C, {
        entry, planning: object.planning, building: object.building, rooms,
        tab: state.tab, view: state.plans, previewFor, mark, registers,
      })}
      ${prototypeFooterHTML()}
    </div>`;
    wireObject(ctx, {
      entry, planning: object.planning, building: object.building, rooms,
      state, previewFor,
    });
    return;
  }

  if (view === 'work') {
    const drafts = listWorkingCopies();
    const options = { layer: layer.id, tenancies: core.tenancies?.() || [], drafts };
    // A single, honest crumb: the work queue is a peer of the portfolio, chosen
    // through the header switch, not a place inside it. The bar is still drawn
    // so the page does not jump by its height when the view changes.
    mount.innerHTML = `${header}
      ${breadcrumbBarHTML(C, [{ label: 'Meine Arbeit' }])}
      ${renderWorkView(C, {
        objects,
        layerId: layer.id,
        counts: planEditorTaskCounts(objects, { tenancies: options.tenancies, drafts }),
        recents: planEditorRecentFloors(objects, { visits: listVisits(), drafts }),
        cases: planEditorCases(engine),
        previewFor: (entry) => floorPreviewHTML(C, core, entry),
      })}
      ${prototypeFooterHTML()}
    </div>`;
    wireWork(ctx, {
      signal,
      tasks: layer.available ? planEditorTasks(objects, options) : [],
      rerender: () => renderNavigation(ctx, objects, object, message),
    });
    return;
  }

  const allEntries = browseEntries(objects, core);
  const selectedId = object?.building.bbl_id || query.get('obj') || '';
  // A place arrives as its full path, because that is what the tree matches its
  // nodes on. This is how a breadcrumb of the building detail returns: «Bern»
  // reopens the portfolio showing Bern, not the whole portfolio.
  const place = {};
  for (const key of TREE_ATTRS) if (query.get(key)) place[key] = query.get(key);
  // `view` here is the surface inside the portfolio (map · cards · list); the
  // shared catalogue wiring writes the view switch into exactly this field.
  const state = {
    q: '',
    sort: browseSort(query.get('sort')),
    filters: { state: [] },
    sel: selectedId ? { id: selectedId } : place,
    view: browseMode(query.get('mode')),
    page: 1,
  };

  mount.innerHTML = `${header}
    ${breadcrumbBarHTML(C, portfolioCrumbs(allEntries, state), { id: 'fpe-landing-crumbs' })}
    ${renderBrowseView(C, {
      entries: visibleEntries(allEntries, state),
      allEntries,
      mode: state.view,
      sort: state.sort,
      query: state.q,
      filters: state.filters,
      scopeLabel: scopeLabel(allEntries, state),
    })}
    ${prototypeFooterHTML()}
  </div>`;

  wireBrowse(ctx, { allEntries, state });
}

// --- Shared filtering --------------------------------------------------------

function matchesSelection(entry, sel) {
  if (!sel || !Object.keys(sel).length) return true;
  if (sel.id) return entry.id === sel.id;
  if (sel.city) return entry.city === sel.city;
  if (sel.region) return entry.region === sel.region;
  if (sel.country) return entry.country === sel.country;
  return true;
}

function visibleEntries(allEntries, state) {
  const term = clean(state.q);
  const states = state.filters.state || [];
  return sortBrowseEntries(allEntries.filter((entry) => (
    (!term || entry.search.includes(term))
      && (!states.length || states.includes(entry.planState))
      && matchesSelection(entry, state.sel)
  )), state.sort);
}

/**
 * The portfolio's own trail. It reports what the view is currently scoped to, so
 * a scope picked in the structure tree gains the «one level up» affordance a
 * removable filter pill cannot express. An unscoped portfolio carries one crumb
 * for the whole estate, which keeps the bar — and the page height — stable.
 */
function portfolioCrumbs(allEntries, state) {
  const sel = state.sel || {};
  const entry = sel.id ? allEntries.find((item) => item.id === sel.id) : null;
  if (entry) return [...placeSteps(entry), { label: entry.name }];
  // The deepest place is the current surface; the renderer drops its link.
  return placeSteps(sel);
}

function scopeLabel(allEntries, state) {
  const sel = state.sel || {};
  if (sel.id) {
    const entry = allEntries.find((item) => item.id === sel.id);
    return entry ? entry.name : 'Gewähltes Objekt';
  }
  if (sel.city) return sel.city;
  if (sel.region) return `Kanton ${sel.region}`;
  if (sel.country) return 'Schweiz';
  return 'Alle Objekte';
}

// --- Building detail ---------------------------------------------------------

function wireObject(ctx, { entry, planning, building, rooms, state, previewFor }) {
  const { mount, C, replaceRoute } = ctx;
  const routeFor = () => objectRoute(entry.id, {
    tab: state.tab, plans: state.plans, mark: state.mark,
  });

  // The marked floor may sit below the fold on a tall object. Scrolling is a
  // courtesy, never a jump: focus stays where the visitor put it.
  const revealMark = () => {
    if (!state.mark) return;
    const row = mount.querySelector('.fpe-plans .is-marked');
    if (row?.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
  };

  // Each register redraws only its own panel body, so the bar of one register
  // never resets another. `wireCatalogueState` is re-attached afterwards because
  // the bar it listened to has just been replaced.
  let detachBar = null;
  let detachTable = null;
  // Rendering `C.table` directly rather than through `mountDataTable` means this
  // view owns the two wirings the data table would otherwise attach itself.
  const wireTable = () => {
    if (detachTable) { detachTable(); detachTable = null; }
    const rows = C.wireTableRows(mount);
    const scroll = C.wireScrollRegions(mount);
    detachTable = () => { rows(); scroll?.(); };
  };
  const drawPanel = (id) => {
    const panel = mount.querySelector(`[data-panel="${id}"]`);
    if (!panel) return;
    const register = state.registers[id];
    const heading = panel.querySelector(':scope > .sr-only');
    // The same guard `mountDataTable` applies before it replaces its host. Rendering
    // `C.table` directly meant this view had to bring it along, and it did not: the
    // register's search field is inside the replaced markup, so every keystroke
    // destroyed the input and dropped focus to the document.
    const restore = C.preserveFocus(panel);
    panel.innerHTML = (heading ? heading.outerHTML : '') + objectPanelHTML(C, id, {
      entry, planning, building, rooms, previewFor,
      view: state.plans, mark: state.mark,
      q: register?.q || '', sort: register?.sort || '',
    });
    wireBar(id);
    wireTable();
    restore();
    if (id === 'plans') revealMark();
  };

  function wireBar(id) {
    if (detachBar) { detachBar(); detachBar = null; }
    const bar = REGISTER_BARS[id];
    if (!bar || !state.registers[id]) return;
    // The register's own search/sort pair is the state this wiring owns; the
    // view switch writes `state.view`, which only the floor register offers.
    const local = state.registers[id];
    const proxy = {
      get q() { return local.q; }, set q(value) { local.q = value; },
      get sort() { return local.sort; }, set sort(value) { local.sort = value; },
      get view() { return state.plans; },
      set view(value) { state.plans = value; replaceRoute(routeFor()); },
      filters: {}, page: 1,
    };
    const wiring = C.wireCatalogueState(mount, {
      formId: `${bar.id}-search`, inputId: `${bar.id}-q`, sortId: `${bar.id}-sort`,
      state: proxy,
      onChange: () => drawPanel(id),
    });
    detachBar = wiring.destroy;
  }

  wireBar(state.tab);
  wireTable();
  revealMark();
  ctx.onUnmount(() => {
    if (detachBar) detachBar();
    if (detachTable) detachTable();
  });

  C.wireTabs(mount, {
    onSelect: (id) => {
      state.tab = id;
      wireBar(id);
      if (id === 'plans') revealMark();
      replaceRoute(routeFor());
    },
  });

}

// --- View 2: Meine Arbeit ----------------------------------------------------

function wireWork(ctx, { signal, tasks, rerender }) {
  const { mount, C } = ctx;
  const host = mount.querySelector('#fpe-work-table');
  if (host) {
    // Same building block as the personal case list: catbar, search, status
    // filter, zebra table and pagination, the row following its first link.
    const unmount = C.mountDataTable(host, {
      id: 'fpe-tasks', rows: tasks, rowsClickable: true, perPage: 8,
      unit: { nom: 'Einträge', dat: 'Einträgen' }, caption: 'Offene Arbeiten dieser Ebene',
      searchKeys: ['title', 'detail', 'state'],
      searchLabel: 'Aufgabe suchen', placeholder: 'Objekt, Geschoss oder Befund suchen…',
      emptyMsg: 'Für diese Ebene ist nichts offen.',
      sorts: [
        { value: 'severity', label: 'Dringlichkeit', cmp: (a, b) => severityRank(a) - severityRank(b) || a.title.localeCompare(b.title, 'de') },
        { value: 'title', label: 'Objekt (A–Z)', cmp: (a, b) => a.title.localeCompare(b.title, 'de') },
      ],
      facets: [{
        dim: 'severity', legend: 'Dringlichkeit',
        options: [{ value: 'error', label: 'Dringend' }, { value: 'warning', label: 'Offen' }, { value: 'info', label: 'Hinweis' }],
        match: (row, values) => values.includes(row.severity),
      }],
      columns: workColumns(C),
    });
    ctx.onUnmount(unmount);
  }
  // Discarding a draft changes derived counts everywhere on the page, so the
  // view is rebuilt rather than patched. The hash does not change, so this
  // cannot go through the router.
  mount.addEventListener('click', (event) => {
    const discard = event.target.closest?.('[data-action="discard-draft"]');
    if (!discard) return;
    const floorId = discard.dataset.floor || '';
    if (!floorId) return;
    if (removeWorkingCopy(floorId)) {
      C.announce('Entwurf verworfen.');
      rerender();
    } else {
      C.toast('Der Entwurf konnte auf diesem Gerät nicht entfernt werden.', 'error', 'WarningCircle');
    }
  }, { signal });
}

const severityRank = (task) => ({ error: 0, warning: 1, info: 2 }[task.severity] ?? 3);

// --- View 1: Portfolio -------------------------------------------------------

function wireBrowse(ctx, { allEntries, state }) {
  const { mount, C, replaceRoute, navigate } = ctx;
  const tree = mount.querySelector('.fpe-browse__tree');
  const crumbs = mount.querySelector('#fpe-landing-crumbs');
  const stats = mount.querySelector('#fpe-browse-stats');
  const surface = mount.querySelector('#fpe-browse-surface');
  const countNode = mount.querySelector('#fpe-browse-count');
  const pillBox = mount.querySelector('#fpe-browse-activefilters');
  const levelsOf = (entry) => [entry.country, entry.region, entry.city];
  let renderedView = state.view;

  let mapSignature = '';
  const updateMap = (shown, focusId) => {
    const host = mount.querySelector('[data-map-slot]');
    if (!host) return;
    const points = mapPoints(C, shown);
    const signature = `${points.map((point) => point.bblId).join('|')}#${focusId || ''}`;
    if (signature === mapSignature) return;
    mapSignature = signature;
    // `focus` is the object id: the shared map zooms to it and opens its popup,
    // which is where this view keeps the object's facts and actions.
    const focus = shown.some((entry) => entry.id === focusId) ? focusId : null;
    fpeMap.mount(host, (element) => initEstateMap(element, points, [], focus, { focusPopup: Boolean(focus) }));
  };

  const renderPills = () => {
    if (!pillBox) return;
    const pills = [];
    if (state.q.trim()) pills.push({ label: `Suche: «${state.q.trim()}»`, remove: 'q' });
    if (Object.keys(state.sel).length) {
      pills.push({ label: `Auswahl: ${scopeLabel(allEntries, state)}`, remove: 'sel' });
    }
    for (const value of state.filters.state || []) {
      pills.push({ label: OBJECT_STATE[value]?.label || value, remove: `state:${value}` });
    }
    pillBox.innerHTML = C.activeFilters({ filters: pills });
  };

  const render = () => {
    const shown = visibleEntries(allEntries, state);
    // A view switch exchanges only the middle region, exactly as the inventory
    // rebuilds its results area; bar, tree and statistics keep their state.
    if (surface && state.view !== renderedView) {
      renderedView = state.view;
      mapSignature = '';
      fpeMap.free();
      surface.innerHTML = browseSurfaceHTML(C, shown, state.view);
      replaceRoute(routeFor(state));
    }
    if (countNode) {
      countNode.innerHTML = `<strong>${number(shown.length)}</strong> von ${number(allEntries.length)} Objekten`;
    }
    if (stats) stats.innerHTML = browseStatsHTML(C, shown, { scope: scopeLabel(allEntries, state) });
    if (state.view === 'map') updateMap(shown, state.sel.id || '');
    else if (surface) surface.innerHTML = browseSurfaceHTML(C, shown, state.view);
    // Counts ignore the tree selection itself, or one click would leave a single
    // branch showing «1» and turn navigation into a dead end.
    if (tree) {
      const term = clean(state.q);
      const states = state.filters.state || [];
      syncTreeCounts(tree, allEntries.filter((entry) => (
        (!term || entry.search.includes(term))
          && (!states.length || states.includes(entry.planState))
      )), levelsOf, (entry) => entry.id);
    }
    // The view switch lives in the bar, which a surface swap does not rebuild, so
    // its pressed state has to be synchronised here. Without this the buttons
    // kept whatever the first render set and the switch looked stuck on «Karte»
    // while the surface below it had already changed.
    mount.querySelectorAll('.fpe-browse__bar .view-switch__btn').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
    });
    // The trail follows the scope, so «wo bin ich» is answered in one place
    // whether the scope came from the tree, a pill or a shared link.
    if (crumbs) crumbs.innerHTML = breadcrumbStepsHTML(C, portfolioCrumbs(allEntries, state));
    renderPills();
    // One options object, not three positional arguments. Called positionally every
    // parameter was undefined, so each filter change announced «undefined von
    // undefined undefined» to a screen reader.
    C.announceCatalogue({
      count: shown.length, total: allEntries.length, unit: 'Objekte', view: state.view,
    });
  };

  const clearSelection = () => {
    state.sel = {};
    markTree(tree, null);
    replaceRoute(routeFor(state));
    render();
  };

  // The shared catalogue wiring: debounced search, sort select, filter panel,
  // view switch, panel reset and the active-filter pills — the same contract the
  // Liegenschaften inventory uses.
  const cat = C.wireCatalogueState(mount, {
    formId: 'fpe-browse-search', inputId: 'fpe-browse-q', sortId: 'fpe-browse-sort',
    filterToggleId: 'fpe-browse-filter-btn', panelId: 'fpe-browse-filters', resetId: 'fpe-browse-freset',
    activeFiltersId: 'fpe-browse-activefilters',
    state,
    onChange: render,
    onRemove: (token) => { if (token === 'sel') clearSelection(); },
    onReset: clearSelection,
  });
  ctx.onUnmount(cat.destroy);

  if (tree) {
    wireTree(tree, {
      attrs: TREE_ATTRS,
      onSelect: (selection) => {
        // A floor picked in the tree opens its building's floor register with
        // that row marked. Locating a plan and opening it are two decisions, and
        // dropping straight into the workbench took the second one uninvited.
        if (selection.sub && selection.id) {
          navigate(objectRoute(selection.id, { tab: 'plans', mark: selection.sub }));
          return;
        }
        state.sel = selection.id ? { id: selection.id } : place(selection);
        replaceRoute(routeFor(state));
        render();
      },
    });
    // A place restores as well as an object: arriving through a breadcrumb of
    // the building detail, the tree has to show which branch is being looked at,
    // or the pill above claims a scope nothing on screen confirms.
    const restored = Object.keys(state.sel).length
      ? restoreTreeSelection(tree, state.sel, { attrs: TREE_ATTRS })
      : null;
    if (restored) markTree(tree, restored);
    else {
      // Without a restored path the tree arrives as a single closed «Schweiz»
      // node, which hides the whole portfolio. Only the outermost level opens.
      tree.querySelectorAll(':scope > .pf-tree > .pf-tree__item > .pf-tree__node').forEach((node) => {
        node.setAttribute('aria-expanded', 'true');
        const children = node.nextElementSibling;
        if (children) children.hidden = false;
      });
    }
  }

  // Cards and rows are plain links into the object's detail view. They used to
  // also select the object on the way out, so one click rewrote the URL and
  // navigated away from it in the same tick. The map is the surface for looking
  // at an object without leaving the portfolio.
  render();
}

// A selection reduced to the place keys it actually carries: `wireTree` reports
// only the levels of the node that was clicked, and writing the missing ones as
// `undefined` made an empty selection look like three active filters.
function place(selection) {
  const scope = {};
  for (const key of TREE_ATTRS) if (selection[key]) scope[key] = selection[key];
  return scope;
}

// The shareable state of the portfolio view. Search text and facet selections
// stay client-side, as they do in the inventory; surface, sorting and the chosen
// scope are what another person needs to see the same screen.
function routeFor(state) {
  return portfolioRoute({
    mode: state.view, sort: state.sort, obj: state.sel.id || '',
    country: state.sel.country || '', region: state.sel.region || '', city: state.sel.city || '',
  });
}

export { PLAN_STATUS };
