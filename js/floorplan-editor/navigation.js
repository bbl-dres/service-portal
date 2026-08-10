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
  floorColumns, objectTab, objectTabQuery, planView, plansPanelHTML, renderObjectView,
} from './object-view.js';
import { BASE, PLAN_STATUS, clean, editorHeaderHTML, number, prototypeFooterHTML } from './shared.js';

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
    const state = { tab: objectTab(query.get('tab')), plans: planView(query.get('plans')) };
    const previewFor = (floor) => floorPreviewHTML(C, core, floor);
    mount.innerHTML = `${header}
      ${renderObjectView(C, {
        entry, planning: object.planning, building: object.building,
        tab: state.tab, view: state.plans, previewFor,
      })}
      ${prototypeFooterHTML()}
    </div>`;
    wireObject(ctx, { entry, state, previewFor, signal });
    return;
  }

  if (view === 'work') {
    const drafts = listWorkingCopies();
    const options = { layer: layer.id, tenancies: core.tenancies?.() || [], drafts };
    mount.innerHTML = `${header}
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
  // `view` here is the surface inside the portfolio (map · cards · list); the
  // shared catalogue wiring writes the view switch into exactly this field.
  const state = {
    q: '',
    sort: browseSort(query.get('sort')),
    filters: { state: [] },
    sel: selectedId ? { id: selectedId } : {},
    view: browseMode(query.get('mode')),
    page: 1,
  };

  mount.innerHTML = `${header}
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

  wireBrowse(ctx, { allEntries, state, signal });
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

function wireObject(ctx, { entry, state, previewFor, signal }) {
  const { mount, C, replaceRoute } = ctx;
  const routeFor = () => {
    const params = new URLSearchParams({ building: entry.id });
    if (state.tab !== 'overview') params.set('tab', objectTabQuery(state.tab));
    if (state.plans !== 'cards') params.set('plans', state.plans);
    return `${BASE}?${params}`;
  };

  // The floor table exists only while the list surface is on screen, so it is
  // mounted and disposed with that surface rather than once for the page.
  let unmountTable = null;
  const disposeTable = () => { if (unmountTable) { unmountTable(); unmountTable = null; } };
  const mountFloorTable = () => {
    disposeTable();
    const host = mount.querySelector('#fpe-floors-table');
    if (!host) return;
    unmountTable = C.mountDataTable(host, {
      id: 'fpe-floors', rows: entry.floors, rowsClickable: true, perPage: 12,
      unit: { nom: 'Geschosse', dat: 'Geschossen' }, caption: `Geschosse von ${entry.name}`,
      searchKeys: ['label'], searchLabel: 'Geschoss suchen', placeholder: 'Geschoss suchen…',
      sorts: [
        { value: 'level', label: 'Geschoss (oben zuerst)', cmp: (a, b) => b.level - a.level },
        { value: 'area', label: 'HNF (grösste zuerst)', cmp: (a, b) => b.areaHnf - a.areaHnf },
      ],
      columns: floorColumns(C, entry),
    });
  };
  const syncPlansSurface = () => {
    if (state.tab === 'plans' && state.plans === 'list') mountFloorTable();
    else disposeTable();
  };
  syncPlansSurface();
  ctx.onUnmount(disposeTable);

  C.wireTabs(mount, {
    onSelect: (id) => {
      state.tab = id;
      syncPlansSurface();
      replaceRoute(routeFor());
    },
  });

  // The view switch exchanges only the Grundrisse panel, as the inventory
  // exchanges only its results area.
  mount.addEventListener('click', (event) => {
    const button = event.target.closest?.('.fpe-plans .view-switch__btn');
    if (!button || !button.dataset.view || button.dataset.view === state.plans) return;
    const panel = mount.querySelector('[data-panel="plans"]');
    if (!panel) return;
    state.plans = button.dataset.view;
    const heading = panel.querySelector(':scope > .sr-only');
    panel.innerHTML = (heading ? heading.outerHTML : '')
      + plansPanelHTML(C, { entry, view: state.plans, previewFor });
    syncPlansSurface();
    replaceRoute(routeFor());
  }, { signal });
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

function wireBrowse(ctx, { allEntries, state, signal }) {
  const { mount, C, replaceRoute, navigate } = ctx;
  const tree = mount.querySelector('.fpe-browse__tree');
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
    renderPills();
    C.announceCatalogue(shown.length, allEntries.length, 'Objekte');
  };

  const clearSelection = () => {
    state.sel = {};
    markTree(tree, null);
    replaceRoute(routeFor(state));
    render();
  };

  const selectObject = (id) => {
    state.sel = { id };
    if (tree) {
      const restored = restoreTreeSelection(tree, { id }, { attrs: TREE_ATTRS });
      if (restored) markTree(tree, restored);
    }
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
        // A floor picked in the tree is a direct handoff into the workbench; the
        // building itself only scopes the view.
        if (selection.sub && selection.id) {
          navigate(floorplanEditor(selection.id, selection.sub));
          return;
        }
        state.sel = selection.id
          ? { id: selection.id }
          : { country: selection.country, region: selection.region, city: selection.city };
        replaceRoute(routeFor(state));
        render();
      },
    });
    const restored = state.sel.id
      ? restoreTreeSelection(tree, { id: state.sel.id }, { attrs: TREE_ATTRS })
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

  // A click on a card or a table row selects that object, so the statistics and
  // the tree follow whichever surface the visitor is using.
  mount.addEventListener('click', (event) => {
    const holder = event.target.closest?.('[data-browse-row]');
    if (!holder || !holder.dataset.obj || holder.dataset.obj === state.sel.id) return;
    selectObject(holder.dataset.obj);
  }, { signal });

  render();
}

// The shareable state of the portfolio view. Search text and facet selections
// stay client-side, as they do in the inventory; surface, sorting and the chosen
// object are what another person needs to see the same screen.
function routeFor(state) {
  const params = new URLSearchParams();
  if (state.view !== 'map') params.set('mode', state.view);
  if (state.sort !== 'name') params.set('sort', state.sort);
  if (state.sel.id) params.set('obj', state.sel.id);
  const search = params.toString();
  return search ? `${BASE}?${search}` : BASE;
}

export { PLAN_STATUS };
