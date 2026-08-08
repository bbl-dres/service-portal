// BBL Plan-Editor — standalone feedback workbench for rooms and furniture.
//
// This is deliberately a separate micro-app from Workspace (portal/read-only)

// clearly labelled local workspaces/revision simulations; canonical core data is
// cloned and never mutated. Upload and plan checking remain a separate micro-app.

import { floorplanEditor } from '../links.js';
import {
  EDITOR_COLOR_MODES, fitCamera, zoomCamera, panCamera,
  fitCameraToRect, cameraWithViewportAspect, resizeCameraToViewport,
  scaleBar, clientToPlan, inverseScreenMatrix, panCameraFromScreenDelta,
  containingRoom, clampPlacement,
  measurementLabel,
} from './canvas.js';
import {
  createLocalRoom, finalisePlacementMove, placementsInsideRoom,
  removePlacement, removeRoom, roomRectInsideFloor, stampRoomGeometry,
  updatePlacement, updateRoomAttribute, updateRoomGeometry,
} from './commands.js';
import {
  MODULE_OPTIONS, createBaseline, cloneDocument, EditorHistory, validateEditorDocument,
} from './model.js';
import { placementFootprintBounds } from './geometry.js';
import {
  loadWorkingCopy, saveWorkingCopy, removeWorkingCopy,
  loadRevisionHistory, publishLocalRevision,
} from './repository.js';
import { createFloorplanThreeViewer } from './three.js';
import { createWorkbenchViews } from './views.js';
import {
  openConfirmationDialog, openPublishConfirmation, openVersionHistoryDialog,
} from './dialogs.js';
import {
  arrowDirection, keyboardPanDelta, movementExceeded, pointerButtons,
  pointerDragTolerance, roomRectFromDrag, rovingIndex, transformRoomRect, wheelZoomFactor,
} from './interactions.js';
import { copyText } from '../export.js';
import { BASE, COLOR_DEFAULT, VIEW_MODES, PLAN_STATUS } from './shared.js';

function selectedFromQuery(query, document) {
  const raw = query.get('selected') || '';
  const split = raw.indexOf(':');
  if (split < 1) return null;
  const kind = raw.slice(0, split);
  const id = raw.slice(split + 1);
  if (kind === 'room' && document.rooms.some((room) => room.spaceId === id)) return { type: 'room', id };
  if (kind === 'placement' && document.placements.some((placement) => placement.placementId === id)) return { type: 'placement', id };
  return null;
}

export default async function renderWorkbench(ctx, { object, floor, plan, canonicalRooms }) {
  const {
    mount, query, core, session, C, onUnmount, setTitle,
    replaceRoute: replaceCurrentRoute, blockNavigation,
  } = ctx;
  const building = object.building;

  const baseline = createBaseline({
    building, floor, spaces: canonicalRooms, products: core.shopProducts(),
    planningFloor: plan, user: session.user(),
  });
  const loaded = loadWorkingCopy(floor.floorId, baseline);
  let editorDocument = loaded.ok ? loaded.document : baseline;
  let lastSaved = cloneDocument(editorDocument);
  let hasLocalDraft = loaded.ok && loaded.source === 'browser-local';
  let revisions = loadRevisionHistory(floor.floorId, baseline);
  let lastPublished = revisions.length ? cloneDocument(revisions[revisions.length - 1].document) : null;
  let editHistory = new EditorHistory(editorDocument);

  const validColors = new Set(EDITOR_COLOR_MODES.map((item) => item.value));
  let colorMode = validColors.has(query.get('color')) ? query.get('color') : COLOR_DEFAULT;
  let viewMode = VIEW_MODES.has(query.get('view')) ? query.get('view') : '2d';
  let selected = selectedFromQuery(query, editorDocument);
  let editMode = query.get('edit') === '1';
  let reconciliationPending = Boolean(loaded.reconciled && !loaded.persistedReconciliation);
  let dirty = reconciliationPending;
  const requestedLibrary = query.get('library');
  // Library placement is a 2D-only workflow. Normalise malformed/deprecated
  // deep links before deriving tools and panel state from them.
  let assetLibraryOpen = editMode && viewMode === '2d' && ['products', 'modules'].includes(requestedLibrary);
  let tool = assetLibraryOpen ? 'add' : 'select';
  let placementProduct = null;
  let libraryMode = requestedLibrary === 'modules' ? 'modules' : 'products';
  let productCategory = '';
  let measurement = null;
  let roomDraft = null;
  let placementGhost = null;
  let keyboardCursor = null;
  let keyboardRoomAnchor = null;
  let camera = fitCamera(floor);
  let resourceQuery = '';
  let productQuery = '';
  let colorMenuOpen = false;
  let moreMenuOpen = false;
  let structureMenuOpen = false;
  let structureUnlocked = true;
  const expandedGroups = new Set();
  const expandedRooms = new Set();
  if (selected?.type === 'room') expandedRooms.add(selected.id);
  if (selected?.type === 'placement') {
    const selectedPlacement = editorDocument.placements.find((item) => item.placementId === selected.id);
    if (selectedPlacement) expandedRooms.add(selectedPlacement.roomId);
  }
  let compactLayout = window.matchMedia('(max-width: 1023.98px)').matches;
  let leftOpen = assetLibraryOpen || (!compactLayout && !editMode);
  let rightOpen = !compactLayout;
  const desktopPanels = { left: leftOpen, right: rightOpen };
  let drag = null;
  const twoDTouches = new Map();
  let threeViewer = null;
  const threeViewStates = { '3d': null, walk: null };
  let mounted = true;
  const queuedFrames = new Set();
  let sceneFrame = 0;
  let cameraChromeFrame = 0;
  let cameraViewport = null;

  function queueFrame(callback) {
    const id = requestAnimationFrame(() => {
      queuedFrames.delete(id);
      if (mounted) callback();
    });
    queuedFrames.add(id);
    return id;
  }

  function cancelQueuedFrames() {
    mounted = false;
    queuedFrames.forEach((id) => cancelAnimationFrame(id));
    queuedFrames.clear();
    sceneFrame = 0;
    cameraChromeFrame = 0;
  }

  function cancelScheduledSceneDraw() {
    if (!sceneFrame) return;
    cancelAnimationFrame(sceneFrame);
    queuedFrames.delete(sceneFrame);
    sceneFrame = 0;
  }

  function scheduleSceneDraw() {
    if (sceneFrame) return;
    sceneFrame = queueFrame(() => {
      sceneFrame = 0;
      drawScene();
    });
  }

  function current2dViewport() {
    const svg = viewMode === '2d' ? mount.querySelector('#fpe-canvas') : null;
    const width = Number(svg?.clientWidth);
    const height = Number(svg?.clientHeight);
    return svg && width > 0 && height > 0 ? { svg, width, height } : null;
  }

  function write2dCamera() {
    const viewport = current2dViewport();
    if (!viewport) return false;
    viewport.svg.setAttribute('viewBox', `${camera.x} ${camera.y} ${camera.width} ${camera.height}`);
    syncRoomHandleTargets(viewport.svg, viewport.width);
    return true;
  }

  function syncRoomHandleTargets(svg, viewportWidth) {
    const width = Number(viewportWidth);
    if (!svg || !Number.isFinite(width) || width <= 0 || !Number.isFinite(camera.width)) return;
    const unitsPerPixel = camera.width / width;
    const visualRadius = Math.max(.5, unitsPerPixel * 7);
    const hitRadius = Math.max(visualRadius, unitsPerPixel * 18);
    svg.querySelectorAll('.fpe-room__handle').forEach((handle) => {
      handle.querySelector('.fpe-room__handle-visual')?.setAttribute('r', visualRadius.toFixed(3));
      handle.querySelector('.fpe-room__handle-hit')?.setAttribute('r', hitRadius.toFixed(3));
    });
  }

  function scheduleCameraChrome() {
    if (cameraChromeFrame) return;
    cameraChromeFrame = queueFrame(() => {
      cameraChromeFrame = 0;
      syncScale();
    });
  }

  function set2dCamera(nextCamera) {
    camera = nextCamera;
    if (write2dCamera()) scheduleCameraChrome();
    else drawScene();
  }

  function fit2dCamera(nextCamera) {
    const viewport = current2dViewport();
    if (!viewport) {
      cameraViewport = null;
      return nextCamera;
    }
    cameraViewport = { width: viewport.width, height: viewport.height };
    return cameraWithViewportAspect(nextCamera, viewport.width, viewport.height);
  }

  function sync2dViewport() {
    const viewport = current2dViewport();
    if (!viewport) return;
    const nextViewport = { width: viewport.width, height: viewport.height };
    if (cameraViewport
      && Math.abs(cameraViewport.width - nextViewport.width) < .5
      && Math.abs(cameraViewport.height - nextViewport.height) < .5) {
      syncRoomHandleTargets(viewport.svg, viewport.width);
      return;
    }
    camera = cameraViewport
      ? resizeCameraToViewport(camera, cameraViewport, nextViewport)
      : cameraWithViewportAspect(camera, nextViewport.width, nextViewport.height);
    cameraViewport = nextViewport;
    write2dCamera();
    scheduleCameraChrome();
  }

  const sceneResizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => sync2dViewport())
    : null;

  function observeSceneViewport() {
    sceneResizeObserver?.disconnect();
    const scene = mount.querySelector('#fpe-scene');
    if (scene) sceneResizeObserver?.observe(scene);
    sync2dViewport();
  }

  function touchCameraMetrics() {
    if (twoDTouches.size !== 2) return null;
    const [first, second] = [...twoDTouches.values()];
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    return {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
      distance: Math.hypot(dx, dy),
    };
  }

  // The baseline has already normalised and quarantined catalogue records.
  // Keep UI choices aligned with the exact catalogue embedded in valid drafts.
  const products = baseline.products;
  const productsById = new Map(products.map((product) => [String(product.id), product]));
  const roomById = () => new Map(editorDocument.rooms.map((room) => [room.spaceId, room]));
  const placementById = () => new Map(editorDocument.placements.map((placement) => [placement.placementId, placement]));
  const documentsEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const unblockNavigation = typeof blockNavigation === 'function'
    ? blockNavigation(() => !dirty || window.confirm('Nicht gespeicherte Änderungen verwerfen und Plan-Editor verlassen?'))
    : () => {};
  const keepValidSelection = () => {
    if (selected?.type === 'room' && editorDocument.rooms.some((room) => room.spaceId === selected.id)) return;
    if (selected?.type === 'placement' && editorDocument.placements.some((placement) => placement.placementId === selected.id)) return;
    selected = null;
  };

  const returnHref = () => floorplanEditor(building.bbl_id);

  function syncQuery() {
    const params = new URLSearchParams();
    params.set('building', building.bbl_id);
    params.set('floor', floor.floorId);
    if (colorMode !== COLOR_DEFAULT) params.set('color', colorMode);
    if (viewMode !== '2d') params.set('view', viewMode);
    if (selected) params.set('selected', `${selected.type}:${selected.id}`);
    if (editMode) params.set('edit', '1');
    if (editMode && viewMode === '2d' && assetLibraryOpen) params.set('library', libraryMode);
    const next = `${BASE}?${params}`;
    if (location.hash !== next) {
      if (typeof replaceCurrentRoute === 'function') replaceCurrentRoute(next);
      else window.history.replaceState(window.history.state, '', next);
    }
  }

  function announce(message) {
    C.announce(message);
  }

  function commit(label, change) {
    const next = cloneDocument(editorDocument);
    change(next);
    if (documentsEqual(next, editorDocument)) return false;
    if (!validateEditorDocument(next, baseline)) {
      console.warn('[floorplan-editor] rejected invalid command result', label);
      announce('Änderung verworfen: Die Arbeitskopie würde dadurch ungültig.');
      return false;
    }
    editHistory.push(next);
    editorDocument = cloneDocument(editHistory.current);
    dirty = reconciliationPending || !documentsEqual(editorDocument, lastSaved);
    syncDraftChrome();
    announce(label);
    return true;
  }

  function restoreHistory(direction) {
    const result = direction === 'undo' ? editHistory.undo() : editHistory.redo();
    if (!result) return;
    editorDocument = cloneDocument(result);
    dirty = reconciliationPending || !documentsEqual(editorDocument, lastSaved);
    syncDraftChrome();
    keepValidSelection();
    syncQuery();
    drawWorkArea({ focusSelected: true });
    announce(direction === 'undo' ? 'Änderung rückgängig gemacht.' : 'Änderung wiederholt.');
  }

  function planBadge() {
    const meta = PLAN_STATUS[plan.planStatus] || PLAN_STATUS.inventory;
    return C.badge(meta.label, meta.variant, 'sm');
  }

  function editorVersionLabel() {
    if (dirty) return 'Arbeitskopie — ungespeichert';
    if (lastPublished && documentsEqual(editorDocument, lastPublished)) {
      return `Lokal publiziert — V${(revisions.at(-1)?.number || 1) + 1}`;
    }
    if (hasLocalDraft) return 'Arbeitskopie — nur auf diesem Gerät';
    return editMode ? 'Neue Arbeitskopie' : 'Ausgangsstand';
  }

  const canPublish = () => (dirty || hasLocalDraft)
    && (!lastPublished || !documentsEqual(editorDocument, lastPublished));

  const currentViews = () => createWorkbenchViews({
    C, session, object, building, floor, plan, products, productsById,
    roomById, placementById, editorDocument, editHistory, selected, colorMode,
    viewMode, editMode, dirty, assetLibraryOpen, tool, placementProduct,
    libraryMode, productCategory, measurement, roomDraft, placementGhost, keyboardCursor,
    camera, resourceQuery, productQuery, colorMenuOpen, moreMenuOpen,
    structureMenuOpen, structureUnlocked, expandedGroups, expandedRooms,
    leftOpen, rightOpen, returnHref: returnHref(),
    versionLabel: editorVersionLabel(), publishable: canPublish(),
    planBadgeHtml: planBadge(),
  });

  function syncDraftChrome() {
    const version = mount.querySelector('.fpe-version');
    if (version) version.textContent = editorVersionLabel();
    mount.querySelectorAll('[data-action="save"]').forEach((button) => { button.disabled = !dirty; });
    mount.querySelectorAll('[data-action="publish"]').forEach((button) => { button.disabled = !canPublish(); });
    mount.querySelectorAll('#fpe-more-menu [data-action="undo"]').forEach((button) => { button.disabled = !editHistory.canUndo; });
    mount.querySelectorAll('#fpe-more-menu [data-action="redo"]').forEach((button) => { button.disabled = !editHistory.canRedo; });
  }

  const visibleMenuItems = (menu) => [...(menu?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])]
    .filter((item) => item.getClientRects().length > 0);

  function positionMoreMenu() {
    if (!moreMenuOpen) return;
    const trigger = mount.querySelector('#fpe-more-trigger');
    const menu = mount.querySelector('#fpe-more-menu');
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const width = menu.offsetWidth || 240;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width))}px`;
    menu.style.top = `${Math.max(8, Math.min(window.innerHeight - menu.offsetHeight - 8, rect.bottom + 8))}px`;
  }

  function positionColorMenu() {
    if (!colorMenuOpen) return;
    const trigger = mount.querySelector('#fpe-color-trigger');
    const menu = mount.querySelector('#fpe-color-menu');
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const width = menu.offsetWidth || 300;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.left))}px`;
    menu.style.top = `${Math.max(8, Math.min(window.innerHeight - menu.offsetHeight - 8, rect.bottom + 8))}px`;
  }

  function closeColorMenu({ restoreFocus = false } = {}) {
    colorMenuOpen = false;
    const trigger = mount.querySelector('#fpe-color-trigger');
    const menu = mount.querySelector('#fpe-color-menu');
    trigger?.setAttribute('aria-expanded', 'false');
    if (menu) menu.hidden = true;
    if (restoreFocus) trigger?.focus({ preventScroll: true });
  }

  function setMoreMenuOpen(open, { focusFirst = false, restoreFocus = false } = {}) {
    moreMenuOpen = Boolean(open);
    const trigger = mount.querySelector('#fpe-more-trigger');
    const menu = mount.querySelector('#fpe-more-menu');
    trigger?.setAttribute('aria-expanded', String(moreMenuOpen));
    if (menu) menu.hidden = !moreMenuOpen;
    if (moreMenuOpen) queueFrame(() => {
      positionMoreMenu();
      if (focusFirst) visibleMenuItems(menu)[0]?.focus({ preventScroll: true });
    });
    else if (restoreFocus) trigger?.focus({ preventScroll: true });
  }

  function positionStructureMenu() {
    if (!structureMenuOpen) return;
    const trigger = mount.querySelector('#fpe-structure-trigger');
    const menu = mount.querySelector('#fpe-structure-menu');
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const width = menu.offsetWidth || 280;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.left))}px`;
    menu.style.top = `${Math.min(window.innerHeight - menu.offsetHeight - 8, rect.bottom + 8)}px`;
  }

  function setStructureMenuOpen(open, { focusFirst = false, restoreFocus = false } = {}) {
    structureMenuOpen = editMode && viewMode === '2d' && Boolean(open);
    const trigger = mount.querySelector('#fpe-structure-trigger');
    const menu = mount.querySelector('#fpe-structure-menu');
    trigger?.setAttribute('aria-expanded', String(structureMenuOpen));
    if (menu) menu.hidden = !structureMenuOpen;
    if (structureMenuOpen) queueFrame(() => {
      positionStructureMenu();
      if (focusFirst) menu?.querySelector('[role="menuitem"]:not([disabled])')?.focus({ preventScroll: true });
    });
    else if (restoreFocus) trigger?.focus({ preventScroll: true });
  }

  const compactWorkbench = () => window.matchMedia('(max-width: 1023.98px)').matches;

  function syncCompactDrawerState() {
    const compact = compactWorkbench();
    const drawerOpen = compact && (leftOpen || rightOpen);
    const stage = mount.querySelector('#fpe-stage');
    if (stage) stage.inert = drawerOpen;
  }

  function setPanelOpen(side, open, { focusToggle = true } = {}) {
    const next = Boolean(open);
    if (side === 'left') {
      if (editMode && viewMode !== '2d' && next) {
        announce('Die Produktbibliothek ist nur im 2D-Plan verfügbar.');
        return;
      }
      if (editMode) {
        assetLibraryOpen = next;
        if (next && !['add', 'place'].includes(tool)) tool = 'add';
        if (!next && ['add', 'place'].includes(tool)) {
          tool = 'select'; placementProduct = null; placementGhost = null; keyboardCursor = null;
        }
      }
      leftOpen = next;
      if (next && compactWorkbench()) rightOpen = false;
      else if (!compactWorkbench()) desktopPanels.left = next;
    } else {
      rightOpen = next;
      if (next && compactWorkbench()) {
        leftOpen = false;
        if (editMode) {
          assetLibraryOpen = false;
          if (['add', 'place'].includes(tool)) { tool = 'select'; placementProduct = null; placementGhost = null; keyboardCursor = null; }
        }
      }
      else if (!compactWorkbench()) desktopPanels.right = next;
    }
    colorMenuOpen = false;
    moreMenuOpen = false;
    structureMenuOpen = false;
    syncQuery();
    draw();
    if (focusToggle) queueFrame(() => {
      if (next && compactWorkbench()) {
        mount.querySelector(`.fpe-${side} .fpe-drawer-close`)?.focus({ preventScroll: true });
        return;
      }
      const suffix = compactWorkbench() ? '-mobile' : '';
      mount.querySelector(`#fpe-toggle-${side}${suffix}`)?.focus({ preventScroll: true });
    });
  }

  function closeCompactPanels({ focusToggle = true } = {}) {
    if (!compactWorkbench() || (!leftOpen && !rightOpen)) return false;
    const side = rightOpen ? 'right' : 'left';
    leftOpen = false; rightOpen = false; colorMenuOpen = false; structureMenuOpen = false;
    if (editMode) {
      assetLibraryOpen = false;
      if (['add', 'place'].includes(tool)) { tool = 'select'; placementProduct = null; placementGhost = null; keyboardCursor = null; }
    }
    syncQuery();
    draw();
    if (focusToggle) queueFrame(() => mount.querySelector(`#fpe-toggle-${side}-mobile`)?.focus({ preventScroll: true }));
    return true;
  }




  function disposeThreeViewer() {
    const state = threeViewer?.getViewState?.();
    if (state?.mode && Object.hasOwn(threeViewStates, state.mode)) threeViewStates[state.mode] = state;
    threeViewer?.dispose();
    threeViewer = null;
  }

  function initThreeViewer() {
    if (viewMode === '2d') return;
    const host = mount.querySelector('#fpe-three-host');
    if (!host || host.dataset.viewerReady === 'true') return;
    host.dataset.viewerReady = 'true';
    threeViewer = createFloorplanThreeViewer({
      host,
      mode: viewMode,
      floor,
      rooms: editorDocument.rooms,
      placements: editorDocument.placements,
      selected,
      colorMode,
      initialViewState: threeViewStates[viewMode],
      onSelect: (type, id) => selectEntity(type, id, false),
      onAnnounce: announce,
    });
  }

  function syncScale() {
    if (viewMode !== '2d') return;
    const host = mount.querySelector('#fpe-scale');
    const scene = mount.querySelector('#fpe-scene');
    if (!host || !scene) return;
    const svg = mount.querySelector('#fpe-canvas');
    const viewportWidth = svg?.clientWidth || scene.clientWidth;
    const matrix = svg?.getScreenCTM?.();
    const pixelsPerUnit = matrix ? Math.hypot(matrix.a, matrix.b) : 0;
    const effectiveCamera = pixelsPerUnit > 0
      ? { width: viewportWidth / pixelsPerUnit }
      : camera;
    const scale = scaleBar(effectiveCamera, viewportWidth);
    const label = host.querySelector('span');
    const line = host.querySelector('i');
    if (label) label.textContent = scale.label;
    if (line && scale.pixels) line.style.width = `${Math.max(40, Math.min(180, scale.pixels))}px`;
  }

  function draw() {
    disposeThreeViewer();
    mount.innerHTML = currentViews().shellHTML();
    syncCompactDrawerState();
    syncQuery();
    if (viewMode !== '2d') queueFrame(initThreeViewer);
    queueFrame(observeSceneViewport);
    queueFrame(syncScale);
    queueFrame(positionColorMenu);
    queueFrame(positionStructureMenu);
  }

  function redrawPreservingFocus(fallbackId = '') {
    const restore = C.preserveFocus(mount);
    draw();
    if (!restore() && fallbackId) queueFrame(() => mount.querySelector(`#${CSS.escape(fallbackId)}`)?.focus({ preventScroll: true }));
  }

  function focusSelectedEntity() {
    const current = selected ? { ...selected } : null;
    if (!current) return;
    queueFrame(() => mount.querySelector(`[data-entity="${current.type}"][data-id="${CSS.escape(current.id)}"]`)?.focus({ preventScroll: true }));
  }

  function drawScene(focus = false, viewerUpdate = 'document', views = currentViews()) {
    cancelScheduledSceneDraw();
    const restore = C.preserveFocus(mount);
    const scene = mount.querySelector('#fpe-scene');
    const retainedThree = viewMode !== '2d' && threeViewer && mount.querySelector('#fpe-three-host');
    if (retainedThree) {
      if (viewerUpdate === 'selection') threeViewer.updateSelection(selected);
      else if (viewerUpdate === 'colors') threeViewer.updateColors(colorMode, editorDocument.rooms);
      else threeViewer.updateDocument({
        floor, rooms: editorDocument.rooms, placements: editorDocument.placements, selected, colorMode,
      });
    } else {
      disposeThreeViewer();
      if (scene) {
        scene.classList.toggle('fpe-scene--three', viewMode !== '2d');
        scene.innerHTML = views.sceneContentHTML();
      }
    }
    const toolbar = mount.querySelector('#fpe-toolbar-host');
    if (toolbar) {
      toolbar.classList.toggle('fpe-toolbar-host--three', viewMode !== '2d');
      toolbar.innerHTML = views.toolbarHTML();
    }
    const structureMenu = mount.querySelector('#fpe-structure-menu-host');
    if (structureMenu) structureMenu.innerHTML = views.structureMenuHTML();
    const viewNavigation = mount.querySelector('#fpe-view-nav-host');
    if (viewNavigation) viewNavigation.innerHTML = views.viewNavigationHTML();
    const viewActions = mount.querySelector('#fpe-view-actions-host');
    if (viewActions) viewActions.innerHTML = views.viewActionsHTML();
    const scale = mount.querySelector('#fpe-scale');
    if (scale) scale.hidden = viewMode !== '2d';
    const result = mount.querySelector('.fpe-measure-result');
    const label = measurementLabel(measurement || {});
    if (result) { result.textContent = label; result.hidden = !label; }
    const restored = restore();
    if (focus && selected && !restored) focusSelectedEntity();
    if (viewMode !== '2d' && !retainedThree) queueFrame(initThreeViewer);
    if (viewMode === '2d') queueFrame(sync2dViewport);
    queueFrame(syncScale);
    queueFrame(positionStructureMenu);
  }

  function drawLeft(views = currentViews()) {
    const host = mount.querySelector('#fpe-left-list');
    if (host) host.innerHTML = editMode
      ? (libraryMode === 'products' ? views.productListHTML() : views.moduleListHTML())
      : views.resourceListHTML();
  }

  function drawLeftPanel(focusId = '') {
    const host = mount.querySelector('#fpe-left');
    if (!host) return;
    const views = currentViews();
    const template = document.createElement('template');
    template.innerHTML = views.leftPanelHTML();
    host.replaceWith(template.content.firstElementChild);
    const colorHost = mount.querySelector('#fpe-color-menu-host');
    if (colorHost) colorHost.innerHTML = views.colorMenuHTML();
    queueFrame(positionColorMenu);
    if (focusId) queueFrame(() => mount.querySelector(`#${CSS.escape(focusId)}`)?.focus({ preventScroll: true }));
  }

  function drawInspector(preserveScroll = false, views = currentViews()) {
    const host = mount.querySelector('#fpe-right');
    if (host) {
      const scrollTop = preserveScroll ? host.scrollTop : 0;
      const template = document.createElement('template');
      template.innerHTML = views.inspectorHTML();
      const next = template.content.firstElementChild;
      host.replaceWith(next);
      if (preserveScroll) next.scrollTop = scrollTop;
    }
  }

  function drawWorkArea({ preserveFocus = false, focusSelected = false, viewerUpdate = 'document' } = {}) {
    const restore = preserveFocus ? C.preserveFocus(mount) : () => false;
    const views = currentViews();
    drawScene(false, viewerUpdate, views); drawLeft(views); drawInspector(preserveFocus, views);
    const restored = restore();
    if (focusSelected && selected && !restored) focusSelectedEntity();
  }

  function selectEntity(type, id, focus = false) {
    selected = type && id ? { type, id } : null;
    if (selected?.type === 'room') expandedRooms.add(selected.id);
    if (selected?.type === 'placement') {
      const placement = placementById().get(selected.id);
      if (placement) expandedRooms.add(placement.roomId);
    }
    syncQuery();
    drawWorkArea({ viewerUpdate: 'selection' });
    if (selected) announce(`${type === 'room' ? 'Raum' : 'Objekt'} ausgewählt.`);
    if (focus && selected) focusSelectedEntity();
  }

  function openAssetLibrary({ mode = libraryMode, focusSearch = true } = {}) {
    if (!editMode) return;
    if (viewMode !== '2d') {
      announce('Die Produktbibliothek ist nur im 2D-Plan verfügbar.');
      return;
    }
    libraryMode = mode === 'modules' ? 'modules' : 'products';
    assetLibraryOpen = true;
    leftOpen = true;
    tool = 'add'; placementProduct = null; placementGhost = null;
    roomDraft = null; measurement = null; keyboardCursor = null; keyboardRoomAnchor = null; structureMenuOpen = false;
    if (compactWorkbench()) rightOpen = false;
    else desktopPanels.left = true;
    syncQuery(); draw();
    if (focusSearch) queueFrame(() => mount.querySelector('#fpe-left-search')?.focus({ preventScroll: true }));
    announce('Bibliothek geöffnet. Produkt oder Modul auswählen.');
  }

  function closeAssetLibrary({ focusToolbar = true, announceClose = false } = {}) {
    if (!editMode || (!assetLibraryOpen && !leftOpen)) return false;
    assetLibraryOpen = false; leftOpen = false;
    if (!compactWorkbench()) desktopPanels.left = false;
    if (['add', 'place'].includes(tool)) tool = 'select';
    placementProduct = null; placementGhost = null; keyboardCursor = null; keyboardRoomAnchor = null;
    syncQuery(); draw();
    if (focusToolbar) queueFrame(() => mount.querySelector('#fpe-action-toggle-library')?.focus({ preventScroll: true }));
    if (announceClose) announce('Bibliothek geschlossen.');
    return true;
  }

  function ensureKeyboardCursor() {
    if (keyboardCursor) return keyboardCursor;
    const [floorWidth, floorHeight] = floor.extent;
    keyboardCursor = {
      x: Math.max(0, Math.min(floorWidth, camera.x + camera.width / 2)),
      y: Math.max(0, Math.min(floorHeight, camera.y + camera.height / 2)),
    };
    return keyboardCursor;
  }

  function updateKeyboardDrafts() {
    const cursor = ensureKeyboardCursor();
    if (tool === 'room' && keyboardRoomAnchor) {
      const rect = roomRectFromDrag(keyboardRoomAnchor, cursor, floor.extent);
      if (!rect) return;
      roomDraft = {
        rect,
        valid: roomRectInsideFloor(rect, floor.extent, editorDocument.rooms),
      };
    } else if (tool === 'place' && placementProduct) {
      const width = Number(placementProduct.dimensions?.width) || 60;
      const depth = Number(placementProduct.dimensions?.depth) || 60;
      placementGhost = {
        x: cursor.x - width / 2, y: cursor.y - depth / 2, width, depth,
        shape: placementProduct.shape2d || 'rect', rotation: 0,
        valid: Boolean(containingRoom(editorDocument.rooms, cursor)),
      };
    }
  }

  function moveKeyboardCursor(dx, dy) {
    const cursor = ensureKeyboardCursor();
    const [floorWidth, floorHeight] = floor.extent;
    keyboardCursor = {
      x: Math.max(0, Math.min(floorWidth, cursor.x + dx)),
      y: Math.max(0, Math.min(floorHeight, cursor.y + dy)),
    };
    updateKeyboardDrafts();
    drawScene();
  }

  function addKeyboardMeasurementPoint() {
    const point = { ...ensureKeyboardCursor() };
    if (!measurement || measurement.complete) measurement = { kind: tool, points: [], complete: false };
    measurement.points.push(point);
    if (tool === 'distance' && measurement.points.length >= 2) measurement.complete = true;
    drawScene();
    announce(measurement.complete
      ? `Messung ${measurementLabel(measurement)}.`
      : `Messpunkt ${measurement.points.length} gesetzt.`);
  }

  function chooseTool(next) {
    if (next === 'room' && !structureUnlocked) {
      announce('Strukturbearbeitung ist gesperrt. Entsperren Sie sie zuerst im Strukturmenü.');
      return;
    }
    const closesLibrary = editMode && (assetLibraryOpen || leftOpen) && !['add', 'place'].includes(next);
    tool = next;
    placementProduct = next === 'place' ? placementProduct : null;
    placementGhost = null;
    roomDraft = null;
    keyboardRoomAnchor = null;
    keyboardCursor = ['room', 'distance', 'area'].includes(next) ? ensureKeyboardCursor() : null;
    measurement = ['distance', 'area'].includes(next) ? { kind: next, points: [], complete: false } : null;
    structureMenuOpen = false;
    if (closesLibrary) {
      assetLibraryOpen = false; leftOpen = false;
      if (!compactWorkbench()) desktopPanels.left = false;
      syncQuery(); draw();
    } else {
      drawScene(); drawLeft();
    }
    if (['room', 'distance', 'area', 'pan'].includes(next)) {
      queueFrame(() => mount.querySelector('#fpe-stage')?.focus({ preventScroll: true }));
    }
    announce(next === 'distance' ? 'Streckenmessung aktiv. Klicken Sie zwei Punkte oder setzen Sie sie mit Pfeiltasten und Leertaste.'
      : next === 'area' ? 'Flächenmessung aktiv. Setzen Sie mindestens drei Punkte und drücken Sie Enter.'
        : next === 'room' ? 'Fläche anlegen aktiv. Ziehen Sie ein Rechteck oder setzen Sie Anfang und Ende mit Pfeiltasten und Eingabetaste.'
          : next === 'pan' ? 'Verschieben aktiv. Ziehen Sie den Plan oder verwenden Sie die Pfeiltasten.' : 'Auswahl aktiv.');
  }

  function addProduct(product, point = null) {
    const selectedRoom = selected?.type === 'room' ? roomById().get(selected.id) : null;
    if (!point && selectedRoom) {
      const [x, y, width, height] = selectedRoom.rect;
      point = { x: x + width / 2, y: y + height / 2 };
    }
    if (!point) {
      placementProduct = product;
      tool = 'place';
      placementGhost = null;
      keyboardCursor = null;
      keyboardRoomAnchor = null;
      updateKeyboardDrafts();
      assetLibraryOpen = false; leftOpen = false;
      if (!compactWorkbench()) desktopPanels.left = false;
      syncQuery(); draw();
      queueFrame(() => mount.querySelector('#fpe-stage')?.focus?.({ preventScroll: true }));
      announce(`${product.name} gewählt. Position im Plan auswählen.`);
      return;
    }
    const width = Number(product.dimensions?.width) || 60;
    const depth = Number(product.dimensions?.depth) || 60;
    const room = containingRoom(editorDocument.rooms, point);
    if (!room) { announce('Das Produkt muss innerhalb eines Raums platziert werden.'); return; }
    const id = `local-${floor.floorId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const placement = clampPlacement({
      placementId: id, productId: product.id, articleId: String(product.id), category: product.category || '',
      buildingId: building.bbl_id, floorId: floor.floorId, roomId: room.spaceId,
      name: product.name, x: point.x - width / 2, y: point.y - depth / 2,
      width, depth, height: Number(product.dimensions?.height) || 75, rotation: 0,
      shape: product.shape2d || 'rect', status: 'new', source: 'user',
    }, floor);
    const finalRoom = containingRoom(editorDocument.rooms, {
      x: placement.x + placement.width / 2, y: placement.y + placement.depth / 2,
    });
    if (!finalRoom) { announce('Das Produkt kann an dieser Position keinem Raum zugeordnet werden.'); return; }
    placement.roomId = finalRoom.spaceId;
    if (!commit(`${product.name} platziert.`, (next) => { next.placements.push(placement); })) return;
    selected = { type: 'placement', id };
    placementProduct = null; placementGhost = null; keyboardCursor = null; keyboardRoomAnchor = null; tool = 'select';
    assetLibraryOpen = false; leftOpen = false;
    if (!compactWorkbench()) desktopPanels.left = false;
    syncQuery(); draw(); focusSelectedEntity();
  }

  function changeRoom(field, control) {
    if (!editMode || selected?.type !== 'room') return;
    const value = field === 'bookable' ? control.checked
      : field === 'capacity' ? Math.max(0, Math.round(Number(control.value) || 0))
        : control.value;
    if (field === 'roomNumber' && !String(value).trim()) { control.setCustomValidity('Raumnummer ist erforderlich.'); control.reportValidity(); return; }
    control.setCustomValidity?.('');
    commit('Raumattribut geändert.', (next) => updateRoomAttribute(next, selected.id, field, value));
    drawWorkArea({ preserveFocus: true });
  }

  function changeRoomGeometry(field, control) {
    if (!editMode || !structureUnlocked || selected?.type !== 'room') return;
    const value = Number(control.value);
    if (!Number.isFinite(value)) return;
    let accepted = true;
    commit('Raumgeometrie geändert.', (next) => {
      accepted = updateRoomGeometry(next, selected.id, field, value, floor.extent);
    });
    if (!accepted) announce('Geometrie nicht geändert: Mindestgrösse, Geschossgrenze, andere Räume oder verortete Objekte verhindern die Änderung.');
    drawWorkArea({ preserveFocus: true });
  }

  function addRoom(rect) {
    if (!roomRectInsideFloor(rect, floor.extent, editorDocument.rooms)) {
      announce('Neue Fläche ist zu klein, überschneidet einen Raum oder liegt ausserhalb des Geschosses.');
      return;
    }
    const id = `local-room-${floor.floorId}-${Date.now().toString(36)}`;
    const ordinal = editorDocument.rooms.filter((room) => room.spaceId.startsWith('local-room-')).length + 1;
    const room = createLocalRoom({ floor, buildingId: building.bbl_id, rect, ordinal, id, rooms: editorDocument.rooms });
    if (!room) return;
    if (!commit('Neue Fläche angelegt.', (next) => { next.rooms.push(room); })) return;
    selected = { type: 'room', id }; tool = 'select'; roomDraft = null;
    keyboardCursor = null; keyboardRoomAnchor = null;
    syncQuery(); drawWorkArea({ focusSelected: true });
  }

  function removeSelectedRoom() {
    if (!editMode || selected?.type !== 'room' || !selected.id.startsWith('local-room-')) return;
    const room = roomById().get(selected.id);
    if (!room) return;
    const count = editorDocument.placements.filter((item) => item.roomId === room.spaceId).length;
    const removeSelected = (close = () => {}) => {
      close();
      commit('Neue Fläche entfernt.', (next) => removeRoom(next, room.spaceId));
      selected = null; syncQuery(); drawWorkArea();
    };
    if (!count) { removeSelected(); return; }
    openConfirmationDialog({
      C, queueFrame,
      id: 'fpe-remove-room-modal',
      title: 'Neue Fläche entfernen?',
      body: `<p><strong>${C.escape(room.roomNumber || room.roomName)}</strong> und ${count} ${count === 1 ? 'zugeordnetes Ausstattungsobjekt werden' : 'zugeordnete Ausstattungsobjekte werden'} aus der Arbeitskopie entfernt.</p><p>Die Änderung kann anschliessend mit «Rückgängig» wiederhergestellt werden.</p>`,
      confirmLabel: 'Fläche entfernen',
      onConfirm: removeSelected,
    });
  }

  function changePlacement(field, value) {
    if (!editMode || selected?.type !== 'placement') return;
    let accepted = true;
    commit('Objektposition geändert.', (next) => {
      accepted = updatePlacement(next, selected.id, field, value, floor);
    });
    if (!accepted) announce('Position nicht geändert: Das Objekt muss innerhalb des Geschosses liegen und sein Mittelpunkt einem Raum zugeordnet sein.');
    drawWorkArea({ preserveFocus: true });
  }

  function removeSelectedPlacement() {
    if (!editMode || selected?.type !== 'placement') return;
    const name = placementById().get(selected.id)?.name || 'Objekt';
    commit(`${name} entfernt.`, (next) => removePlacement(next, selected.id));
    selected = null; syncQuery(); drawWorkArea();
  }

  function saveLocalDraft(redraw = true, announceResult = true) {
    const result = saveWorkingCopy(editorDocument, baseline);
    if (!result.ok) {
      announce(`Entwurf konnte nicht gespeichert werden: ${result.reason || 'Browserspeicher nicht verfügbar'}.`);
      return null;
    }
    editorDocument = cloneDocument(result.document);
    lastSaved = cloneDocument(editorDocument);
    hasLocalDraft = true; reconciliationPending = false; dirty = false;
    editHistory.reset(editorDocument);
    if (redraw) draw(); else syncDraftChrome();
    if (announceResult) announce('Arbeitskopie nur in diesem Browser gespeichert.');
    return result.document;
  }

  function publishCurrentVersion(closeModal = () => {}) {
    const saved = saveLocalDraft(false, false);
    if (!saved) return;
    const result = publishLocalRevision(saved, baseline, session.user()?.name || 'Unbekannt');
    if (!result.ok) {
      announce(`Veröffentlichung konnte nicht simuliert werden: ${result.reason || 'Browserspeicher nicht verfügbar'}.`);
      return;
    }
    revisions = result.revisions;
    lastPublished = cloneDocument(result.revision.document);
    closeModal();
    draw();
    C.toast(`V${result.revision.number + 1} wurde lokal als veröffentlicht markiert.`, 'success', 'CheckmarkCircle');
    announce('Veröffentlichung im Feedback-Prototyp simuliert. Andere Personen sehen diese Version nicht.');
  }

  function openPublishDialog() {
    if (!canPublish()) return;
    openPublishConfirmation({
      C, queueFrame,
      rooms: editorDocument.rooms.length,
      placements: editorDocument.placements.length,
      onConfirm: (close) => publishCurrentVersion(close),
    });
  }

  function resetWorkingCopy(closeParent = () => {}) {
    const reset = (closeConfirm = () => {}, closeAfterSuccess = () => {}) => {
      if (!removeWorkingCopy(floor.floorId)) {
        announce('Lokale Arbeitskopie konnte nicht verworfen werden: Browserspeicher nicht verfügbar.');
        return false;
      }
      closeConfirm();
      closeAfterSuccess();
      editorDocument = cloneDocument(baseline);
      lastSaved = cloneDocument(baseline);
      hasLocalDraft = false; reconciliationPending = false; dirty = false; selected = null;
      editHistory.reset(editorDocument);
      draw();
      queueFrame(() => mount.querySelector('#fpe-action-version-history, #fpe-more-trigger')?.focus({ preventScroll: true }));
      C.toast('Lokale Arbeitskopie verworfen.', 'success', 'CheckmarkCircle');
      return true;
    };
    if (dirty) {
      // Do not stack a confirmation dialog on top of version history. Closing
      // first restores its trigger, which the confirmation can then capture as
      // the correct focus-return target.
      closeParent();
      queueFrame(() => {
        openConfirmationDialog({
          C, queueFrame,
          id: 'fpe-reset-copy-modal',
          title: 'Arbeitskopie verwerfen?',
          body: '<p>Alle nicht gespeicherten Änderungen und die lokale Arbeitskopie dieses Geschosses werden verworfen. Danach wird der aktuelle Ausgangsstand geladen.</p><p>Der separat geführte lokale Versionsverlauf bleibt erhalten.</p>',
          confirmLabel: 'Arbeitskopie verwerfen',
          onConfirm: (closeConfirm) => reset(closeConfirm),
        });
      });
      return;
    }
    reset(() => {}, closeParent);
  }

  function openVersionHistory() {
    openVersionHistoryDialog({
      C, queueFrame, revisions, baseline,
      planLastSync: plan.lastSync,
      showReset: hasLocalDraft || dirty,
      onReset: (close) => resetWorkingCopy(close),
    });
  }

  function finishEditing(close = () => {}) {
    close();
    if (dirty) {
      editorDocument = cloneDocument(lastSaved);
      // A reconciled draft whose storage write failed is not a saved snapshot.
      // Discard only this edit session while keeping that reconciliation
      // protected until an explicit Save succeeds.
      dirty = reconciliationPending;
      keepValidSelection();
    }
    editHistory.reset(editorDocument);
    editMode = false; tool = 'select'; placementProduct = null; placementGhost = null;
    assetLibraryOpen = false; structureMenuOpen = false;
    leftOpen = !compactWorkbench();
    if (!compactWorkbench()) desktopPanels.left = true;
    roomDraft = null; measurement = null; keyboardCursor = null; keyboardRoomAnchor = null;
    draw();
    announce(reconciliationPending
      ? 'Bearbeitungsmodus beendet. Die Katalogaktualisierung ist weiterhin ungespeichert.'
      : 'Bearbeitungsmodus beendet.');
  }

  function endEditing() {
    if (!dirty) { finishEditing(); return; }
    openConfirmationDialog({
      C, queueFrame,
      id: 'fpe-end-edit-modal',
      title: 'Bearbeitung beenden?',
      body: reconciliationPending
        ? '<p>Die Änderungen dieser Bearbeitungssitzung werden verworfen. Die noch nicht gespeicherte Katalogaktualisierung bleibt geschützt und wird weiterhin als ungespeichert markiert.</p>'
        : '<p>Die nicht gespeicherten Änderungen dieser Sitzung werden verworfen. Eine zuvor gespeicherte lokale Arbeitskopie bleibt erhalten.</p>',
      confirmLabel: 'Änderungen verwerfen',
      onConfirm: finishEditing,
    });
  }

  function fitSelected() {
    if (!selected) return;
    const rect = selected.type === 'room'
      ? roomById().get(selected.id)?.rect
      : (() => {
          const item = placementById().get(selected.id);
          const bounds = item ? placementFootprintBounds(item) : null;
          return bounds ? [bounds.minX, bounds.minY, bounds.width, bounds.height] : null;
        })();
    const next = fitCameraToRect(rect);
    if (!next) return;
    viewMode = '2d';
    camera = fit2dCamera(next);
    syncQuery(); drawScene(true);
    announce('Auswahl eingepasst.');
  }

  function setView(next) {
    if (!VIEW_MODES.has(next) || viewMode === next) return;
    viewMode = next;
    tool = 'select'; measurement = null; roomDraft = null; placementGhost = null;
    keyboardCursor = null; keyboardRoomAnchor = null;
    structureMenuOpen = false;
    if (editMode && next !== '2d') {
      assetLibraryOpen = false; leftOpen = false; placementProduct = null;
      if (!compactWorkbench()) desktopPanels.left = false;
    }
    syncQuery(); draw();
    queueFrame(() => mount.querySelector(`[data-action="view-${next}"]`)?.focus({ preventScroll: true }));
    announce(next === '2d' ? '2D-Plan geöffnet.'
      : next === '3d' ? 'Interaktives 3D-Modell aus dem aktuellen Grundriss geöffnet.'
        : 'Interaktive Begehung geöffnet. Klicken Sie in die Ansicht und bewegen Sie sich mit W A S D oder den Pfeiltasten.');
  }

  function assignModule(moduleId) {
    if (!editMode) return;
    if (selected?.type !== 'room') {
      rightOpen = true;
      announce('Wählen Sie zuerst einen Raum, um ein Modul zuzuweisen.');
      return;
    }
    const option = MODULE_OPTIONS.find((item) => String(item.value) === String(moduleId));
    if (!option) return;
    commit(`${option.label} zugewiesen.`, (next) => {
      const room = next.rooms.find((item) => item.spaceId === selected.id);
      if (room) room.moduleId = String(option.value);
    });
    assetLibraryOpen = false; leftOpen = false; tool = 'select';
    if (!compactWorkbench()) desktopPanels.left = false;
    syncQuery(); draw(); focusSelectedEntity();
  }

  function onClick(event) {
    if (moreMenuOpen && !event.target.closest('.fpe-more')) setMoreMenuOpen(false);
    if (structureMenuOpen && !event.target.closest('#fpe-structure-menu') && !event.target.closest('#fpe-structure-trigger')) setStructureMenuOpen(false);
    if (colorMenuOpen && !event.target.closest('.fpe-color-picker') && !event.target.closest('.fpe-color-menu')) {
      closeColorMenu();
    }
    const groupToggle = event.target.closest('[data-resource-group]');
    if (groupToggle) {
      const key = groupToggle.dataset.resourceGroup;
      if (expandedGroups.has(key)) expandedGroups.delete(key); else expandedGroups.add(key);
      drawLeft();
      queueFrame(() => mount.querySelector(`[data-resource-group="${CSS.escape(key)}"]`)?.focus({ preventScroll: true }));
      return;
    }
    const roomToggle = event.target.closest('[data-resource-room]');
    if (roomToggle) {
      const id = roomToggle.dataset.resourceRoom;
      if (expandedRooms.has(id)) expandedRooms.delete(id); else expandedRooms.add(id);
      drawLeft();
      queueFrame(() => mount.querySelector(`[data-resource-room="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }));
      return;
    }
    const select = event.target.closest('[data-select-type]');
    if (select) { selectEntity(select.dataset.selectType, select.dataset.selectId, true); return; }
    const productButton = event.target.closest('[data-product]');
    if (productButton && editMode) { const product = productsById.get(productButton.dataset.product); if (product) addProduct(product); return; }
    const moduleButton = event.target.closest('[data-module]');
    if (moduleButton && editMode) { assignModule(moduleButton.dataset.module); return; }
    const colorButton = event.target.closest('[data-color-mode]');
    if (colorButton && validColors.has(colorButton.dataset.colorMode)) {
      colorMode = colorButton.dataset.colorMode;
      expandedGroups.clear();
      colorMenuOpen = false;
      syncQuery(); drawScene(false, 'colors'); drawLeftPanel('fpe-color-trigger');
      announce(`Einfärbung ${EDITOR_COLOR_MODES.find((item) => item.value === colorMode)?.label}.`);
      return;
    }
    const libraryTab = event.target.closest('[data-library]');
    if (libraryTab && editMode) {
      libraryMode = libraryTab.dataset.library === 'modules' ? 'modules' : 'products';
      productQuery = ''; placementProduct = null; tool = 'add';
      syncQuery(); redrawPreservingFocus();
      queueFrame(() => mount.querySelector(`[data-library="${libraryMode}"]`)?.focus());
      return;
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'focus-search') {
      if (editMode) {
        openAssetLibrary();
        return;
      }
      if (!leftOpen || (compactWorkbench() && rightOpen)) {
        leftOpen = true;
        if (compactWorkbench()) rightOpen = false;
        draw();
      }
      queueFrame(() => mount.querySelector('#fpe-left-search')?.focus());
    }
    else if (action === 'toggle-library') {
      if (assetLibraryOpen) closeAssetLibrary({ announceClose: true });
      else openAssetLibrary();
    }
    else if (action === 'close-library') closeAssetLibrary({ announceClose: true });
    else if (action === 'toggle-left') setPanelOpen('left', !leftOpen);
    else if (action === 'toggle-right') setPanelOpen('right', !rightOpen);
    else if (action === 'close-panels') closeCompactPanels({ focusToggle: false });
    else if (action === 'toggle-more-menu') {
      if (colorMenuOpen) { colorMenuOpen = false; drawLeftPanel(); }
      setStructureMenuOpen(false);
      setMoreMenuOpen(!moreMenuOpen);
    }
    else if (action === 'toggle-structure-menu') {
      setMoreMenuOpen(false);
      setStructureMenuOpen(!structureMenuOpen);
    }
    else if (action === 'toggle-structure-lock') {
      structureUnlocked = !structureUnlocked;
      if (!structureUnlocked && tool === 'room') tool = 'select';
      setStructureMenuOpen(false);
      draw();
      announce(`Strukturbearbeitung ${structureUnlocked ? 'entsperrt' : 'gesperrt'}.`);
    }
    else if (action === 'toggle-color-menu') {
      setMoreMenuOpen(false);
      colorMenuOpen = !colorMenuOpen;
      drawLeftPanel('fpe-color-trigger');
    }
    else if (action === 'start-edit') {
      setMoreMenuOpen(false);
      editMode = true; tool = 'select'; assetLibraryOpen = false; leftOpen = false;
      if (!compactWorkbench()) desktopPanels.left = false;
      draw();
      queueFrame(() => mount.querySelector('#fpe-action-tool-select')?.focus({ preventScroll: true }));
      announce('Bearbeitungsmodus gestartet. Änderungen bleiben lokal, bis sie gespeichert werden.');
    }
    else if (action === 'end-edit') { setMoreMenuOpen(false); endEditing(); }
    else if (action === 'save') { setMoreMenuOpen(false); saveLocalDraft(); }
    else if (action === 'publish') { setMoreMenuOpen(false); openPublishDialog(); }
    else if (action === 'clear-selection') selectEntity(null, null);
    else if (action === 'tool-select') chooseTool('select');
    else if (action === 'tool-pan') chooseTool('pan');
    else if (action === 'tool-room') chooseTool('room');
    else if (action === 'tool-distance') chooseTool('distance');
    else if (action === 'tool-area') chooseTool('area');
    else if (action === 'cancel-place') chooseTool('select');
    else if (action === 'zoom-in') {
      if (viewMode === '2d') set2dCamera(zoomCamera(camera, .8));
      else if (viewMode === '3d') { threeViewer?.zoom(.8); announce('3D-Ansicht vergrössert.'); }
    }
    else if (action === 'zoom-out') {
      if (viewMode === '2d') set2dCamera(zoomCamera(camera, 1.25));
      else if (viewMode === '3d') { threeViewer?.zoom(1.25); announce('3D-Ansicht verkleinert.'); }
    }
    else if (action === 'fit') { set2dCamera(fit2dCamera(fitCamera(floor))); announce('Plan eingepasst.'); }
    else if (action === 'fit-selection') fitSelected();
    else if (action === 'undo') { setMoreMenuOpen(false); restoreHistory('undo'); }
    else if (action === 'redo') { setMoreMenuOpen(false); restoreHistory('redo'); }
    else if (action === 'version-history') { setMoreMenuOpen(false); setStructureMenuOpen(false); openVersionHistory(); }
    else if (action === 'copy-link') {
      setMoreMenuOpen(false);
      copyText(location.href).then((ok) => {
        C.toast(ok ? 'Link kopiert.' : 'Link konnte nicht kopiert werden.', ok ? 'success' : 'error', ok ? 'CheckmarkCircle' : 'WarningCircle');
        announce(ok ? 'Link kopiert.' : 'Link konnte nicht kopiert werden.');
      });
    }
    else if (action === 'copy-plan-id') {
      setMoreMenuOpen(false);
      copyText(floor.floorId).then((ok) => {
        C.toast(ok ? 'Plan-ID kopiert.' : 'Plan-ID konnte nicht kopiert werden.', ok ? 'success' : 'error', ok ? 'CheckmarkCircle' : 'WarningCircle');
        announce(ok ? 'Plan-ID kopiert.' : 'Plan-ID konnte nicht kopiert werden.');
      });
    }
    else if (action === 'three-reset') { threeViewer?.reset(); mount.querySelector('.fpe-three-canvas')?.focus({ preventScroll: true }); announce('3D-Ansicht zurückgesetzt.'); }
    else if (action === 'print') { setMoreMenuOpen(false); window.print(); }
    else if (action === 'view-2d') setView('2d');
    else if (action === 'view-3d') setView('3d');
    else if (action === 'view-walk') setView('walk');
    else if (action === 'rotate-left' && selected?.type === 'placement') {
      const placement = placementById().get(selected.id); if (placement) changePlacement('rotation', ((placement.rotation || 0) - 45 + 360) % 360);
    } else if (action === 'delete-placement') removeSelectedPlacement();
    else if (action === 'delete-room') removeSelectedRoom();
  }

  function onInput(event) {
    if (event.target.id !== 'fpe-left-search') return;
    if (editMode) productQuery = event.target.value; else resourceQuery = event.target.value;
    drawLeft();
  }

  function onChange(event) {
    if (event.target.id === 'fpe-color') {
      colorMode = validColors.has(event.target.value) ? event.target.value : COLOR_DEFAULT;
      expandedGroups.clear();
      syncQuery(); drawScene(false, 'colors'); drawLeft();
      announce(`Einfärbung ${EDITOR_COLOR_MODES.find((item) => item.value === colorMode)?.label}.`); return;
    }
    if (event.target.id === 'fpe-product-category') { productCategory = event.target.value; drawLeft(); return; }
    if (event.target.dataset.roomField) changeRoom(event.target.dataset.roomField, event.target);
    if (event.target.dataset.roomGeometry) changeRoomGeometry(event.target.dataset.roomGeometry, event.target);
    if (event.target.dataset.placementField) changePlacement(event.target.dataset.placementField, event.target.value);
  }

  function onPointerDown(event) {
    const stage = event.target.closest('#fpe-stage');
    const svg = mount.querySelector('#fpe-canvas');
    if (!stage || !svg) return;
    if (event.target.closest('button,a,input,select,textarea')) return;
    if (drag) {
      if (event.pointerType === 'touch' && drag.type === 'pan'
        && drag.pointerType === 'touch' && event.pointerId !== drag.pointerId) {
        event.preventDefault();
        twoDTouches.set(drag.pointerId, { x: drag.currentX, y: drag.currentY });
        twoDTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
        try { mount.setPointerCapture?.(event.pointerId); } catch { /* synthetic/ended pointer */ }
        drag = {
          type: 'touch-camera',
          metrics: touchCameraMetrics(),
          moved: true,
        };
      } else if (event.pointerType === 'touch') {
        event.preventDefault();
      }
      return;
    }
    const buttons = pointerButtons(event, tool);
    if (!buttons) return;
    const { primary: primaryButton, middle: middleButton } = buttons;
    const point = clientToPlan(svg, event.clientX, event.clientY);
    if (!point) return;
    keyboardCursor = null;
    keyboardRoomAnchor = null;
    const entity = event.target.closest('[data-entity]');
    const roomHandle = event.target.closest('[data-room-handle]');
    const directPrimaryPan = tool === 'select' && event.button === 0 && (!editMode || !entity);
    // Middle-button pan is a temporary navigation override in every tool. It
    // must run before authoring actions so users can reposition the viewport
    // without cancelling an in-progress room, placement or measurement tool.
    if ((tool === 'pan' && (primaryButton || middleButton)) || middleButton || directPrimaryPan) {
      event.preventDefault();
      try { mount.setPointerCapture?.(event.pointerId); } catch { /* synthetic/ended pointer */ }
      stage.classList.add('is-panning');
      drag = {
        type: 'pan', pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
        currentX: event.clientX, currentY: event.clientY,
        pointerType: event.pointerType, tolerance: pointerDragTolerance(event.pointerType),
        camera: { ...camera }, inverseMatrix: inverseScreenMatrix(svg), moved: false,
        tapSelection: directPrimaryPan
          ? (entity ? { type: entity.dataset.entity, id: entity.dataset.id } : { type: null, id: null })
          : null,
      };
      if (event.pointerType === 'touch') {
        twoDTouches.clear();
        twoDTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      return;
    }
    if (tool === 'place' && placementProduct) { event.preventDefault(); addProduct(placementProduct, point); return; }
    if (tool === 'room' && editMode) {
      event.preventDefault();
      try { mount.setPointerCapture?.(event.pointerId); } catch { /* synthetic/ended pointer */ }
      drag = { type: 'room-create', pointerId: event.pointerId, start: point };
      roomDraft = { rect: [point.x, point.y, 0, 0], valid: false };
      drawScene(); return;
    }
    if (tool === 'distance' || tool === 'area') {
      event.preventDefault();
      if (!measurement || measurement.complete) measurement = { kind: tool, points: [], complete: false };
      measurement.points.push(point);
      if (tool === 'distance' && measurement.points.length >= 2) measurement.complete = true;
      drawScene();
      if (measurement.complete) announce(`Messung ${measurementLabel(measurement)}.`);
      return;
    }
    if (entity?.dataset.entity === 'placement' && editMode && tool === 'select') {
      event.preventDefault();
      const placement = placementById().get(entity.dataset.id);
      if (!placement) return;
      selected = { type: 'placement', id: placement.placementId }; syncQuery();
      try { mount.setPointerCapture?.(event.pointerId); } catch { /* synthetic/ended pointer */ }
      drag = { type: 'placement', pointerId: event.pointerId, start: point, x: placement.x, y: placement.y,
        clientStart: { x: event.clientX, y: event.clientY },
        pointerType: event.pointerType, tolerance: pointerDragTolerance(event.pointerType),
        roomId: placement.roomId, before: cloneDocument(editorDocument), moved: false };
      drawWorkArea({ focusSelected: true });
      return;
    }
    if (entity?.dataset.entity === 'room' && editMode && tool === 'select') {
      event.preventDefault();
      const room = roomById().get(entity.dataset.id);
      if (!room) return;
      selected = { type: 'room', id: room.spaceId }; syncQuery();
      if (!structureUnlocked) {
        drawWorkArea({ focusSelected: true });
        return;
      }
      try { mount.setPointerCapture?.(event.pointerId); } catch { /* synthetic/ended pointer */ }
      drag = {
        type: roomHandle ? 'room-resize' : 'room-move', pointerId: event.pointerId,
        handle: roomHandle?.dataset.roomHandle || '', start: point,
        clientStart: { x: event.clientX, y: event.clientY },
        pointerType: event.pointerType, tolerance: pointerDragTolerance(event.pointerType),
        rect: room.rect.slice(), before: cloneDocument(editorDocument), moved: false,
      };
      drawWorkArea({ focusSelected: true });
      return;
    }
    if (entity) selectEntity(entity.dataset.entity, entity.dataset.id, true);
    else if (tool === 'select') selectEntity(null, null);
  }

  function onPointerMove(event) {
    const svg = mount.querySelector('#fpe-canvas');
    if (!drag) {
      if (tool === 'place' && placementProduct && svg) {
        const point = clientToPlan(svg, event.clientX, event.clientY);
        if (!point) return;
        const width = Number(placementProduct.dimensions?.width) || 60;
        const depth = Number(placementProduct.dimensions?.depth) || 60;
        const room = containingRoom(editorDocument.rooms, point);
        placementGhost = {
          x: point.x - width / 2, y: point.y - depth / 2, width, depth,
          shape: placementProduct.shape2d || 'rect', rotation: 0, valid: Boolean(room),
        };
        scheduleSceneDraw();
      }
      return;
    }
    if (drag.type === 'touch-camera') {
      if (!twoDTouches.has(event.pointerId) || !svg) return;
      event.preventDefault();
      twoDTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const nextMetrics = touchCameraMetrics();
      const previous = drag.metrics;
      if (!nextMetrics || !previous) { drag.metrics = nextMetrics; return; }
      set2dCamera(panCameraFromScreenDelta(
        camera,
        inverseScreenMatrix(svg),
        nextMetrics.x - previous.x,
        nextMetrics.y - previous.y,
      ));
      if (previous.distance > 4 && nextMetrics.distance > 4) {
        const anchor = clientToPlan(svg, nextMetrics.x, nextMetrics.y);
        set2dCamera(zoomCamera(camera, previous.distance / nextMetrics.distance, anchor));
      }
      drag.metrics = nextMetrics;
      return;
    }
    if (drag.pointerId !== event.pointerId) return;
    if (drag.type === 'pan') {
      const pixelDx = event.clientX - drag.clientX;
      const pixelDy = event.clientY - drag.clientY;
      drag.moved ||= movementExceeded(
        { x: drag.clientX, y: drag.clientY },
        { x: event.clientX, y: event.clientY },
        drag.tolerance,
      );
      drag.currentX = event.clientX;
      drag.currentY = event.clientY;
      if (drag.pointerType === 'touch') {
        twoDTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      if (!drag.moved) return;
      set2dCamera(panCameraFromScreenDelta(
        drag.camera, drag.inverseMatrix, pixelDx, pixelDy,
      ));
      return;
    }
    const point = clientToPlan(svg, event.clientX, event.clientY);
    if (!point) return;
    if (drag.type === 'room-create') {
      const rect = roomRectFromDrag(drag.start, point, floor.extent);
      if (!rect) return;
      roomDraft = { rect, valid: roomRectInsideFloor(rect, floor.extent, editorDocument.rooms) };
      scheduleSceneDraw(); return;
    }
    if (drag.type === 'room-move' || drag.type === 'room-resize') {
      const room = selected?.type === 'room' ? roomById().get(selected.id) : null;
      if (!room) return;
      drag.moved ||= movementExceeded(
        drag.clientStart,
        { x: event.clientX, y: event.clientY },
        drag.tolerance,
      );
      if (!drag.moved) return;
      const transformed = transformRoomRect({
        type: drag.type, rect: drag.rect, handle: drag.handle,
        start: drag.start, point, extent: floor.extent,
      });
      if (!transformed) return;
      const [x, y, width, height] = transformed.rect;
      if (drag.type === 'room-move') {
        const beforeById = new Map(drag.before.placements.map((item) => [item.placementId, item]));
        editorDocument.placements.filter((item) => item.roomId === room.spaceId).forEach((item) => {
          const previous = beforeById.get(item.placementId);
          if (previous) { item.x = previous.x + transformed.dx; item.y = previous.y + transformed.dy; }
        });
      }
      stampRoomGeometry(room, [x, y, width, height]);
      scheduleSceneDraw(); return;
    }
    const placement = selected?.type === 'placement' ? placementById().get(selected.id) : null;
    if (!placement) return;
    drag.moved ||= movementExceeded(
      drag.clientStart,
      { x: event.clientX, y: event.clientY },
      drag.tolerance,
    );
    if (!drag.moved) return;
    placement.x = drag.x + point.x - drag.start.x;
    placement.y = drag.y + point.y - drag.start.y;
    Object.assign(placement, clampPlacement(placement, floor));
    scheduleSceneDraw();
  }

  function onPointerUp(event) {
    if (!drag) return;
    if (drag.type === 'touch-camera') {
      if (!twoDTouches.has(event.pointerId)) return;
      twoDTouches.delete(event.pointerId);
      try { mount.releasePointerCapture?.(event.pointerId); } catch { /* capture already gone */ }
      if (twoDTouches.size === 1) {
        const [pointerId, point] = twoDTouches.entries().next().value;
        drag = {
          type: 'pan', pointerId, pointerType: 'touch', tolerance: pointerDragTolerance('touch'),
          clientX: point.x, clientY: point.y, currentX: point.x, currentY: point.y,
          camera: { ...camera }, inverseMatrix: inverseScreenMatrix(mount.querySelector('#fpe-canvas')),
          moved: true, tapSelection: null,
        };
      } else {
        twoDTouches.clear();
        drag = null;
        mount.querySelector('#fpe-stage')?.classList.remove('is-panning');
      }
      return;
    }
    if (drag.pointerId !== event.pointerId) return;
    const cancelled = event.type !== 'pointerup';
    let tapSelection = null;
    if (drag.type === 'room-create') {
      const draft = roomDraft;
      roomDraft = null;
      if (!cancelled && draft?.valid) addRoom(draft.rect);
      else { chooseTool('select'); announce('Neue Fläche verworfen.'); }
    } else if (drag.type === 'room-move' || drag.type === 'room-resize') {
      const room = selected?.type === 'room' ? roomById().get(selected.id) : null;
      const accepted = drag.moved && !cancelled && room
        && roomRectInsideFloor(room.rect, floor.extent, editorDocument.rooms, room.spaceId)
        && placementsInsideRoom(editorDocument, room)
        && validateEditorDocument(editorDocument, baseline);
      if (!drag.moved) {
        editorDocument = cloneDocument(drag.before);
      } else if (!accepted) {
        editorDocument = cloneDocument(drag.before);
        announce('Raumgeometrie bleibt unverändert: Geschossgrenze, andere Räume oder verortete Objekte verhindern die Änderung.');
      } else {
        editHistory.push(editorDocument);
        editorDocument = cloneDocument(editHistory.current);
        dirty = reconciliationPending || !documentsEqual(editorDocument, lastSaved);
        syncDraftChrome();
        announce(drag.type === 'room-move' ? 'Raum und Ausstattung verschoben.' : 'Raumkante verschoben.');
      }
      drawWorkArea({ focusSelected: true });
    } else if (drag.type === 'placement') {
      if (!drag.moved) {
        // A click or sub-threshold jitter is not an edit. Restore the exact
        // gesture-start document so cancellation can never bypass history.
        editorDocument = cloneDocument(drag.before);
      } else {
        const placement = selected?.type === 'placement' ? placementById().get(selected.id) : null;
        if (placement) {
          const cx = placement.x + placement.width / 2, cy = placement.y + placement.depth / 2;
          const containing = containingRoom(editorDocument.rooms, { x: cx, y: cy });
          if (cancelled || !containing) {
            editorDocument = cloneDocument(drag.before);
            if (!cancelled) announce('Objekt bleibt am bisherigen Ort: Der Mittelpunkt muss in einem Raum liegen.');
          } else {
            placement.roomId = containing.spaceId;
            if (placement.status !== 'new') placement.status = 'moved';
            if (!validateEditorDocument(editorDocument, baseline)) {
              editorDocument = cloneDocument(drag.before);
              announce('Objekt bleibt am bisherigen Ort: Die neue Position wäre ungültig.');
            } else {
              editHistory.push(editorDocument);
              editorDocument = cloneDocument(editHistory.current);
              dirty = reconciliationPending || !documentsEqual(editorDocument, lastSaved);
              syncDraftChrome();
              announce('Objekt verschoben.');
            }
          }
          drawWorkArea({ focusSelected: true });
        }
      }
    } else if (drag.type === 'pan') {
      if (cancelled) set2dCamera({ ...drag.camera });
      else if (!drag.moved) tapSelection = drag.tapSelection;
    }
    mount.querySelector('#fpe-stage')?.classList.remove('is-panning');
    twoDTouches.delete(event.pointerId);
    drag = null;
    try { mount.releasePointerCapture?.(event.pointerId); } catch { /* capture already gone */ }
    if (tapSelection) selectEntity(tapSelection.type, tapSelection.id, Boolean(tapSelection.type));
  }

  function onWheel(event) {
    const svg = event.target.closest?.('#fpe-canvas');
    if (viewMode !== '2d' || !svg) return;
    const factor = wheelZoomFactor(event, { pagePixels: svg.clientHeight });
    if (factor === 1) return;
    event.preventDefault();
    const point = clientToPlan(svg, event.clientX, event.clientY);
    set2dCamera(zoomCamera(camera, factor, point));
  }

  function onDoubleClick(event) {
    if (tool === 'area' && event.target.closest('#fpe-stage') && measurement?.points.length >= 3) {
      event.preventDefault(); measurement.complete = true; drawScene(); announce(`Fläche ${measurementLabel(measurement)}.`); return;
    }
    const entity = event.target.closest?.('[data-entity]');
    if (tool === 'select' && entity) {
      event.preventDefault();
      selected = { type: entity.dataset.entity, id: entity.dataset.id };
      syncQuery(); fitSelected();
    }
  }

  function onPointerLeave() {
    if (!drag && placementGhost) { placementGhost = null; drawScene(); }
  }

  function onFocusOut(event) {
    if (!colorMenuOpen || !event.target.closest?.('#fpe-color-menu')) return;
    const next = event.relatedTarget;
    if (next && (next === mount.querySelector('#fpe-color-trigger') || mount.querySelector('#fpe-color-menu')?.contains(next))) return;
    queueFrame(() => {
      const menu = mount.querySelector('#fpe-color-menu');
      const trigger = mount.querySelector('#fpe-color-trigger');
      if (colorMenuOpen && !menu?.contains(document.activeElement) && document.activeElement !== trigger) closeColorMenu();
    });
  }

  function onKeyDown(event) {
    const textControl = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
    if (event.target.id === 'fpe-more-trigger' && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setMoreMenuOpen(true, { focusFirst: true });
      return;
    }
    const menuItem = event.target.closest?.('#fpe-more-menu [role="menuitem"]');
    if (menuItem) {
      const items = visibleMenuItems(mount.querySelector('#fpe-more-menu'));
      const index = items.indexOf(menuItem);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = rovingIndex(event.key, index, items.length);
        items[next]?.focus({ preventScroll: true });
        return;
      }
      if (event.key === 'Tab') setMoreMenuOpen(false);
    }
    if (event.target.id === 'fpe-structure-trigger' && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setStructureMenuOpen(true, { focusFirst: true });
      return;
    }
    const structureItem = event.target.closest?.('#fpe-structure-menu [role="menuitem"]');
    if (structureItem) {
      const items = [...mount.querySelectorAll('#fpe-structure-menu [role="menuitem"]:not([disabled])')];
      const index = items.indexOf(structureItem);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = rovingIndex(event.key, index, items.length);
        items[next]?.focus({ preventScroll: true });
        return;
      }
      if (event.key === 'Tab') setStructureMenuOpen(false);
    }
    if (event.target.id === 'fpe-color-trigger' && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      colorMenuOpen = true;
      setMoreMenuOpen(false);
      drawLeftPanel();
      queueFrame(() => mount.querySelector('.fpe-color-menu [aria-checked="true"]')?.focus({ preventScroll: true }));
      return;
    }
    const colorItem = event.target.closest?.('.fpe-color-menu [role="menuitemradio"]');
    if (colorItem && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const items = [...mount.querySelectorAll('.fpe-color-menu [role="menuitemradio"]')];
      const index = items.indexOf(colorItem);
      const next = rovingIndex(event.key, index, items.length);
      items.forEach((item, itemIndex) => { item.tabIndex = itemIndex === next ? 0 : -1; });
      items[next]?.focus({ preventScroll: true });
      return;
    }
    if (colorItem && event.key === 'Tab') {
      // Let the browser move focus first, then hide the now-abandoned popup.
      queueFrame(() => closeColorMenu());
    }
    const libraryTab = event.target.closest?.('[data-library][role="tab"]');
    if (libraryTab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const tabs = [...mount.querySelectorAll('[data-library][role="tab"]')];
      const index = tabs.indexOf(libraryTab);
      const next = rovingIndex(event.key, index, tabs.length);
      tabs[next]?.click();
      return;
    }
    const viewButton = event.target.closest?.('[data-view-mode]');
    if (viewButton && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const buttons = [...mount.querySelectorAll('[data-view-mode]')];
      const index = buttons.indexOf(viewButton);
      const next = rovingIndex(event.key, index, buttons.length);
      const nextMode = buttons[next]?.dataset.viewMode;
      if (nextMode && nextMode !== viewMode) setView(nextMode);
      else buttons[next]?.focus({ preventScroll: true });
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !textControl) {
      if (event.key.toLocaleLowerCase() === 'z') { event.preventDefault(); restoreHistory(event.shiftKey ? 'redo' : 'undo'); return; }
      if (event.key.toLocaleLowerCase() === 'y') { event.preventDefault(); restoreHistory('redo'); return; }
    }
    const stageFocused = event.target.id === 'fpe-stage';
    if (stageFocused && viewMode === '2d' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const direction = arrowDirection(event.key);
      if (direction) {
        event.preventDefault();
        const [directionX, directionY] = direction;
        if (['room', 'distance', 'area', 'place'].includes(tool)) {
          const step = event.shiftKey ? 1 : 10;
          moveKeyboardCursor(directionX * step, directionY * step);
        } else {
          const delta = keyboardPanDelta(camera, event.key, event.shiftKey);
          set2dCamera(panCamera(camera, delta.x, delta.y));
        }
        return;
      }
      if (tool === 'place' && placementProduct && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        addProduct(placementProduct, { ...ensureKeyboardCursor() });
        return;
      }
      if (tool === 'room' && editMode && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        if (!keyboardRoomAnchor) {
          keyboardRoomAnchor = { ...ensureKeyboardCursor() };
          roomDraft = { rect: [keyboardRoomAnchor.x, keyboardRoomAnchor.y, 0, 0], valid: false };
          drawScene();
          announce('Startpunkt gesetzt. Bewegen Sie den Planzeiger zum gegenüberliegenden Eckpunkt.');
        } else if (roomDraft?.valid) {
          addRoom(roomDraft.rect);
        } else {
          announce('Die neue Fläche muss mindestens einen Meter breit und tief sein, innerhalb des Geschosses liegen und darf keinen Raum überdecken.');
        }
        return;
      }
      if ((tool === 'distance' || tool === 'area') && event.key === ' ') {
        event.preventDefault();
        addKeyboardMeasurementPoint();
        return;
      }
    }
    if (!textControl && !event.ctrlKey && !event.metaKey && !event.altKey && viewMode === '2d') {
      const key = event.key.toLocaleLowerCase();
      if (key === 'v') { event.preventDefault(); chooseTool('select'); return; }
      if (key === 'h') { event.preventDefault(); chooseTool('pan'); return; }
      if (key === 'f') { event.preventDefault(); set2dCamera(fit2dCamera(fitCamera(floor))); announce('Plan eingepasst.'); return; }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); set2dCamera(zoomCamera(camera, .8)); return; }
      if (event.key === '-') { event.preventDefault(); set2dCamera(zoomCamera(camera, 1.25)); return; }
    }
    if (event.key === 'Escape') {
      if (moreMenuOpen) { event.preventDefault(); setMoreMenuOpen(false, { restoreFocus: true }); }
      else if (structureMenuOpen) { event.preventDefault(); setStructureMenuOpen(false, { restoreFocus: true }); }
      else if (colorMenuOpen) { event.preventDefault(); closeColorMenu({ restoreFocus: true }); }
      else if (closeCompactPanels()) event.preventDefault();
      else if (tool !== 'select') { event.preventDefault(); chooseTool('select'); }
      else if (selected) { event.preventDefault(); selectEntity(null, null); }
      return;
    }
    if (stageFocused && tool === 'area' && event.key === 'Enter' && measurement?.points.length >= 3 && !measurement.complete) {
      event.preventDefault(); measurement.complete = true; drawScene(); announce(`Fläche ${measurementLabel(measurement)}.`); return;
    }
    if (stageFocused && (tool === 'area' || tool === 'distance') && event.key === 'Backspace' && measurement?.points.length) {
      event.preventDefault(); measurement.points.pop(); measurement.complete = false; drawScene(); announce('Letzten Messpunkt entfernt.'); return;
    }
    const entity = event.target.closest?.('[data-entity]');
    if (entity && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); selectEntity(entity.dataset.entity, entity.dataset.id, true); return;
    }
    if (!editMode || textControl) return;
    if (selected?.type === 'room' && selected.id.startsWith('local-room-') && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault(); removeSelectedRoom(); return;
    }
    if (selected?.type !== 'placement') return;
    const moves = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      let accepted = true;
      commit('Objekt mit Tastatur verschoben.', (next) => {
        const placement = next.placements.find((entry) => entry.placementId === selected.id);
        if (!placement) return;
        const previous = { ...placement };
        placement.x += dx * (event.shiftKey ? .1 : 1); placement.y += dy * (event.shiftKey ? .1 : 1);
        accepted = finalisePlacementMove(next, placement, previous, floor);
      });
      if (!accepted) announce('Objekt nicht verschoben: Es muss innerhalb des Geschosses liegen und sein Mittelpunkt einem Raum zugeordnet sein.');
      drawWorkArea({ focusSelected: true });
    } else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelectedPlacement(); }
    else if (event.key.toLocaleLowerCase() === 'r') { event.preventDefault(); const placement = placementById().get(selected.id); if (placement) changePlacement('rotation', ((placement.rotation || 0) + 45) % 360); }
  }

  function beforeUnload(event) {
    if (!dirty) return;
    event.preventDefault(); event.returnValue = '';
  }

  function onWindowResize() {
    const nextCompact = compactWorkbench();
    if (nextCompact !== compactLayout) {
      compactLayout = nextCompact;
      if (compactLayout) {
        desktopPanels.left = leftOpen;
        desktopPanels.right = rightOpen;
        leftOpen = editMode && assetLibraryOpen;
        rightOpen = false;
      } else {
        leftOpen = editMode ? assetLibraryOpen : desktopPanels.left;
        rightOpen = desktopPanels.right;
      }
      structureMenuOpen = false;
      draw();
      return;
    }
    sync2dViewport();
    positionMoreMenu();
    positionColorMenu();
    positionStructureMenu();
  }

  const abort = new AbortController();
  const { signal } = abort;
  mount.addEventListener('click', onClick, { signal });
  mount.addEventListener('input', onInput, { signal });
  mount.addEventListener('change', onChange, { signal });
  mount.addEventListener('pointerdown', onPointerDown, { signal });
  mount.addEventListener('pointermove', onPointerMove, { signal });
  mount.addEventListener('pointerup', onPointerUp, { signal });
  mount.addEventListener('pointercancel', onPointerUp, { signal });
  mount.addEventListener('lostpointercapture', onPointerUp, { signal });
  mount.addEventListener('pointerleave', onPointerLeave, { signal });
  mount.addEventListener('wheel', onWheel, { signal, passive: false });
  mount.addEventListener('dblclick', onDoubleClick, { signal });
  mount.addEventListener('keydown', onKeyDown, { signal });
  mount.addEventListener('focusout', onFocusOut, { signal });
  window.addEventListener('beforeunload', beforeUnload, { signal });
  window.addEventListener('resize', onWindowResize, { signal });
  onUnmount(() => {
    cancelQueuedFrames();
    sceneResizeObserver?.disconnect();
    disposeThreeViewer();
    abort.abort();
    unblockNavigation();
  });

  setTitle(`Plan-Editor — ${floor.label}`);
  draw();
  if (loaded.discardedDraft) {
    const message = loaded.archivedDraft
      ? 'Die lokale Arbeitskopie war nicht mit dem aktuellen Plan kompatibel, wurde archiviert und der aktuelle Ausgangsstand wurde geladen.'
      : 'Die lokale Arbeitskopie war nicht mit dem aktuellen Plan kompatibel und der aktuelle Ausgangsstand wurde geladen.';
    queueFrame(() => C.toast(
      message,
      'warning', 'WarningCircle',
    ));
  } else if (loaded.reconciled) {
    const dropped = loaded.droppedPlacementIds?.length || 0;
    const persistence = loaded.persistedReconciliation ? ''
      : loaded.archivedOriginalDraft
        ? ' Der vorherige Entwurf wurde zur Wiederherstellung archiviert. Prüfen und speichern Sie die bereinigte Arbeitskopie, um sie zu übernehmen.'
        : loaded.reconciliationPersistenceReason === 'storage-conflict'
          ? ' Der Entwurf wurde zwischenzeitlich in einem anderen Tab geändert; diese Aktualisierung ist nicht gespeichert.'
          : ' Die Aktualisierung konnte noch nicht gespeichert werden; speichern Sie den Entwurf erneut.';
    const message = dropped
      ? `Die lokale Arbeitskopie wurde mit dem aktuellen Produktkatalog abgeglichen. ${dropped} nicht mehr verfügbare ${dropped === 1 ? 'Platzierung wurde' : 'Platzierungen wurden'} entfernt.${persistence}`
      : `Die lokale Arbeitskopie wurde mit dem aktuellen Produktkatalog abgeglichen.${persistence}`;
    queueFrame(() => C.toast(message,
      dropped || !loaded.persistedReconciliation ? 'warning' : 'info',
      dropped || !loaded.persistedReconciliation ? 'WarningCircle' : 'InfoCircle'));
  }
}
