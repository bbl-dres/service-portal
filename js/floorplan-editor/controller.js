// BBL Plan-Editor — standalone feedback workbench for rooms and furniture.
//
// This is deliberately a separate micro-app from Workspace (portal/read-only)
// and Planprüfung (DWG import/rules/approval). The browser prototype writes only
// clearly labelled local workspaces/revision simulations; canonical core data is
// cloned and never mutated. Upload and plan checking remain a separate micro-app.

import { floorplanEditor } from '../links.js';
import {
  EDITOR_COLOR_MODES, fitCamera, zoomCamera, panCamera,
  fitCameraToRect, scaleBar, clientToPlan, containingRoom, clampPlacement,
  measurementLabel,
} from './canvas.js';
import {
  createLocalRoom, finalisePlacementMove, placementsInsideRoom,
  removePlacement, removeRoom, roomRectInsideFloor, stampRoomGeometry,
  updatePlacement, updateRoomAttribute, updateRoomGeometry,
} from './commands.js';
import {
  MODULE_OPTIONS, createBaseline, cloneDocument, EditorHistory,
} from './model.js';
import {
  loadWorkingCopy, saveWorkingCopy, removeWorkingCopy,
  loadRevisionHistory, publishLocalRevision,
} from './repository.js';
import { createFloorplanThreeViewer } from './three.js';
import { createWorkbenchViews } from './views.js';
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
  const { mount, query, core, session, C, onUnmount, setTitle } = ctx;
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
  let dirty = false;
  const requestedLibrary = query.get('library');
  let assetLibraryOpen = editMode && ['products', 'modules'].includes(requestedLibrary);
  let tool = assetLibraryOpen ? 'add' : 'select';
  let placementProduct = null;
  let libraryMode = requestedLibrary === 'modules' ? 'modules' : 'products';
  let productCategory = '';
  let measurement = null;
  let roomDraft = null;
  let placementGhost = null;
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
  let threeViewer = null;
  const threeViewStates = { '3d': null, walk: null };
  let liveText = '';

  const products = core.shopProducts();
  const productsById = new Map(products.map((product) => [String(product.id), product]));
  const roomById = () => new Map(editorDocument.rooms.map((room) => [room.spaceId, room]));
  const placementById = () => new Map(editorDocument.placements.map((placement) => [placement.placementId, placement]));
  const documentsEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
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
    if (editMode && assetLibraryOpen) params.set('library', libraryMode);
    const next = `${BASE}?${params}`;
    if (location.hash !== next) window.history.replaceState(window.history.state, '', next);
  }

  function announce(message) {
    liveText = message;
    const live = mount.querySelector('#fpe-live');
    if (live) live.textContent = '';
    requestAnimationFrame(() => { const node = mount.querySelector('#fpe-live'); if (node) node.textContent = message; });
    C.announce(message);
  }

  function commit(label, change) {
    const next = cloneDocument(editorDocument);
    change(next);
    if (documentsEqual(next, editorDocument)) return false;
    editHistory.push(next);
    editorDocument = cloneDocument(editHistory.current);
    dirty = !documentsEqual(editorDocument, lastSaved);
    syncDraftChrome();
    announce(label);
    return true;
  }

  function restoreHistory(direction) {
    const result = direction === 'undo' ? editHistory.undo() : editHistory.redo();
    if (!result) return;
    editorDocument = cloneDocument(result);
    dirty = !documentsEqual(editorDocument, lastSaved);
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
    libraryMode, productCategory, measurement, roomDraft, placementGhost,
    camera, resourceQuery, productQuery, colorMenuOpen, moreMenuOpen,
    structureMenuOpen, structureUnlocked, expandedGroups, expandedRooms,
    leftOpen, rightOpen, liveText, returnHref: returnHref(),
    versionLabel: editorVersionLabel(), publishable: canPublish(),
    planBadgeHtml: planBadge(),
  });

  function syncDraftChrome() {
    const version = mount.querySelector('.fpe-version');
    if (version) version.textContent = editorVersionLabel();
    const save = mount.querySelector('#fpe-save');
    if (save) save.disabled = !dirty;
    const publish = mount.querySelector('#fpe-publish');
    if (publish) publish.disabled = !canPublish();
  }

  function positionMoreMenu() {
    if (!moreMenuOpen) return;
    const trigger = mount.querySelector('#fpe-more-trigger');
    const menu = mount.querySelector('#fpe-more-menu');
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const width = menu.offsetWidth || 240;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width))}px`;
    menu.style.top = `${Math.min(window.innerHeight - menu.offsetHeight - 8, rect.bottom + 8)}px`;
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

  function setMoreMenuOpen(open, { focusFirst = false, restoreFocus = false } = {}) {
    moreMenuOpen = Boolean(open);
    const trigger = mount.querySelector('#fpe-more-trigger');
    const menu = mount.querySelector('#fpe-more-menu');
    trigger?.setAttribute('aria-expanded', String(moreMenuOpen));
    if (menu) menu.hidden = !moreMenuOpen;
    if (moreMenuOpen) requestAnimationFrame(() => {
      positionMoreMenu();
      if (focusFirst) menu?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
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
    if (structureMenuOpen) requestAnimationFrame(() => {
      positionStructureMenu();
      if (focusFirst) menu?.querySelector('[role="menuitem"]:not([disabled])')?.focus({ preventScroll: true });
    });
    else if (restoreFocus) trigger?.focus({ preventScroll: true });
  }

  const compactWorkbench = () => window.matchMedia('(max-width: 1023.98px)').matches;

  function setPanelOpen(side, open, { focusToggle = true } = {}) {
    const next = Boolean(open);
    if (side === 'left') {
      if (editMode) {
        assetLibraryOpen = next;
        if (next && !['add', 'place'].includes(tool)) tool = 'add';
        if (!next && ['add', 'place'].includes(tool)) {
          tool = 'select'; placementProduct = null; placementGhost = null;
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
          if (['add', 'place'].includes(tool)) { tool = 'select'; placementProduct = null; placementGhost = null; }
        }
      }
      else if (!compactWorkbench()) desktopPanels.right = next;
    }
    colorMenuOpen = false;
    moreMenuOpen = false;
    structureMenuOpen = false;
    syncQuery();
    draw();
    if (focusToggle) requestAnimationFrame(() => {
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
      if (['add', 'place'].includes(tool)) { tool = 'select'; placementProduct = null; placementGhost = null; }
    }
    syncQuery();
    draw();
    if (focusToggle) requestAnimationFrame(() => mount.querySelector(`#fpe-toggle-${side}-mobile`)?.focus({ preventScroll: true }));
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
    });
  }

  function syncScale() {
    if (viewMode !== '2d') return;
    const host = mount.querySelector('#fpe-scale');
    const scene = mount.querySelector('#fpe-scene');
    if (!host || !scene) return;
    const matrix = mount.querySelector('#fpe-canvas')?.getScreenCTM?.();
    const pixelsPerUnit = matrix ? Math.hypot(matrix.a, matrix.b) : 0;
    const effectiveCamera = pixelsPerUnit > 0
      ? { width: scene.clientWidth / pixelsPerUnit }
      : camera;
    const scale = scaleBar(effectiveCamera, scene.clientWidth);
    const label = host.querySelector('span');
    const line = host.querySelector('i');
    if (label) label.textContent = scale.label;
    if (line && scale.pixels) line.style.width = `${Math.max(40, Math.min(180, scale.pixels))}px`;
  }

  function draw() {
    disposeThreeViewer();
    mount.innerHTML = currentViews().shellHTML();
    syncQuery();
    if (viewMode !== '2d') requestAnimationFrame(initThreeViewer);
    requestAnimationFrame(syncScale);
    requestAnimationFrame(positionColorMenu);
    requestAnimationFrame(positionStructureMenu);
  }

  function redrawPreservingFocus(fallbackId = '') {
    const restore = C.preserveFocus(mount);
    draw();
    if (!restore() && fallbackId) requestAnimationFrame(() => mount.querySelector(`#${CSS.escape(fallbackId)}`)?.focus({ preventScroll: true }));
  }

  function focusSelectedEntity() {
    const current = selected ? { ...selected } : null;
    if (!current) return;
    requestAnimationFrame(() => mount.querySelector(`[data-entity="${current.type}"][data-id="${CSS.escape(current.id)}"]`)?.focus({ preventScroll: true }));
  }

  function drawScene(focus = false) {
    const restore = C.preserveFocus(mount);
    const views = currentViews();
    disposeThreeViewer();
    const scene = mount.querySelector('#fpe-scene');
    if (scene) {
      scene.classList.toggle('fpe-scene--three', viewMode !== '2d');
      scene.innerHTML = views.sceneContentHTML();
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
    if (viewMode !== '2d') requestAnimationFrame(initThreeViewer);
    requestAnimationFrame(syncScale);
    requestAnimationFrame(positionStructureMenu);
  }

  function drawLeft() {
    const host = mount.querySelector('#fpe-left-list');
    const views = currentViews();
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
    requestAnimationFrame(positionColorMenu);
    if (focusId) requestAnimationFrame(() => mount.querySelector(`#${CSS.escape(focusId)}`)?.focus({ preventScroll: true }));
  }

  function drawInspector(preserveScroll = false) {
    const host = mount.querySelector('#fpe-right');
    if (host) {
      const scrollTop = preserveScroll ? host.scrollTop : 0;
      const template = document.createElement('template');
      template.innerHTML = currentViews().inspectorHTML();
      const next = template.content.firstElementChild;
      host.replaceWith(next);
      if (preserveScroll) next.scrollTop = scrollTop;
    }
  }

  function drawWorkArea({ preserveFocus = false, focusSelected = false } = {}) {
    const restore = preserveFocus ? C.preserveFocus(mount) : () => false;
    drawScene(); drawLeft(); drawInspector(preserveFocus);
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
    drawWorkArea();
    if (selected) announce(`${type === 'room' ? 'Raum' : 'Objekt'} ausgewählt.`);
    if (focus && selected) focusSelectedEntity();
  }

  function openAssetLibrary({ mode = libraryMode, focusSearch = true } = {}) {
    if (!editMode) return;
    libraryMode = mode === 'modules' ? 'modules' : 'products';
    assetLibraryOpen = true;
    leftOpen = true;
    tool = 'add'; placementProduct = null; placementGhost = null;
    roomDraft = null; measurement = null; structureMenuOpen = false;
    if (compactWorkbench()) rightOpen = false;
    else desktopPanels.left = true;
    syncQuery(); draw();
    if (focusSearch) requestAnimationFrame(() => mount.querySelector('#fpe-left-search')?.focus({ preventScroll: true }));
    announce('Bibliothek geöffnet. Produkt oder Modul auswählen.');
  }

  function closeAssetLibrary({ focusToolbar = true, announceClose = false } = {}) {
    if (!editMode || (!assetLibraryOpen && !leftOpen)) return false;
    assetLibraryOpen = false; leftOpen = false;
    if (!compactWorkbench()) desktopPanels.left = false;
    if (['add', 'place'].includes(tool)) tool = 'select';
    placementProduct = null; placementGhost = null;
    syncQuery(); draw();
    if (focusToolbar) requestAnimationFrame(() => mount.querySelector('#fpe-action-toggle-library')?.focus({ preventScroll: true }));
    if (announceClose) announce('Bibliothek geschlossen.');
    return true;
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
    measurement = ['distance', 'area'].includes(next) ? { kind: next, points: [], complete: false } : null;
    structureMenuOpen = false;
    if (closesLibrary) {
      assetLibraryOpen = false; leftOpen = false;
      if (!compactWorkbench()) desktopPanels.left = false;
      syncQuery(); draw();
    } else {
      drawScene(); drawLeft();
    }
    announce(next === 'distance' ? 'Streckenmessung aktiv. Wählen Sie zwei Punkte.'
      : next === 'area' ? 'Flächenmessung aktiv. Wählen Sie mindestens drei Punkte und drücken Sie Enter.'
        : next === 'room' ? 'Fläche anlegen aktiv. Ziehen Sie im Plan ein Rechteck von mindestens einem Meter Seitenlänge.'
          : next === 'pan' ? 'Verschieben aktiv.' : 'Auswahl aktiv.');
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
      assetLibraryOpen = false; leftOpen = false;
      if (!compactWorkbench()) desktopPanels.left = false;
      syncQuery(); draw();
      requestAnimationFrame(() => mount.querySelector('#fpe-stage')?.focus?.({ preventScroll: true }));
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
    commit(`${product.name} platziert.`, (next) => { next.placements.push(placement); });
    selected = { type: 'placement', id };
    placementProduct = null; placementGhost = null; tool = 'select';
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
    if (!accepted) announce('Geometrie nicht geändert: Mindestgrösse, Geschossgrenze oder verortete Objekte verhindern die Änderung.');
    drawWorkArea({ preserveFocus: true });
  }

  function addRoom(rect) {
    if (!roomRectInsideFloor(rect, floor.extent)) { announce('Neue Fläche ist zu klein oder liegt ausserhalb des Geschosses.'); return; }
    const id = `local-room-${floor.floorId}-${Date.now().toString(36)}`;
    const ordinal = editorDocument.rooms.filter((room) => room.spaceId.startsWith('local-room-')).length + 1;
    const room = createLocalRoom({ floor, buildingId: building.bbl_id, rect, ordinal, id });
    if (!room) return;
    commit('Neue Fläche angelegt.', (next) => { next.rooms.push(room); });
    selected = { type: 'room', id }; tool = 'select'; roomDraft = null;
    syncQuery(); drawWorkArea({ focusSelected: true });
  }

  function removeSelectedRoom() {
    if (!editMode || selected?.type !== 'room' || !selected.id.startsWith('local-room-')) return;
    const room = roomById().get(selected.id);
    if (!room) return;
    const count = editorDocument.placements.filter((item) => item.roomId === room.spaceId).length;
    if (count && !window.confirm(`Neue Fläche und ${count} zugeordnete Objekte entfernen?`)) return;
    commit('Neue Fläche entfernt.', (next) => removeRoom(next, room.spaceId));
    selected = null; syncQuery(); drawWorkArea();
  }

  function changePlacement(field, value) {
    if (!editMode || selected?.type !== 'placement') return;
    let accepted = true;
    commit('Objektposition geändert.', (next) => {
      accepted = updatePlacement(next, selected.id, field, value, floor);
    });
    if (!accepted) announce('Position nicht geändert: Der Mittelpunkt muss in einem Raum liegen.');
    drawWorkArea({ preserveFocus: true });
  }

  function removeSelectedPlacement() {
    if (!editMode || selected?.type !== 'placement') return;
    const name = placementById().get(selected.id)?.name || 'Objekt';
    commit(`${name} entfernt.`, (next) => removePlacement(next, selected.id));
    selected = null; syncQuery(); drawWorkArea();
  }

  function saveLocalDraft(redraw = true, announceResult = true) {
    const result = saveWorkingCopy(editorDocument);
    if (!result.ok) {
      announce(`Entwurf konnte nicht gespeichert werden: ${result.reason || 'Browserspeicher nicht verfügbar'}.`);
      return null;
    }
    editorDocument = cloneDocument(result.document);
    lastSaved = cloneDocument(editorDocument);
    hasLocalDraft = true; dirty = false;
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
    const id = `fpe-confirm-publish-${Date.now()}`;
    const close = C.openModal({
      id: 'fpe-publish-modal', size: 'sm', title: 'Veröffentlichung simulieren?',
      body: `${C.notification('<strong>Nur Feedback-Prototyp.</strong> Die Version wird ausschliesslich in diesem Browser gespeichert. Es findet keine Freigabe, Synchronisation oder Berechtigungsprüfung statt.', 'info', 'InfoCircle')}
        <p>Die aktuelle Arbeitskopie enthält <strong>${editorDocument.rooms.length} Räume</strong> und <strong>${editorDocument.placements.length} Ausstattungsobjekte</strong>.</p>`,
      footer: `<button type="button" class="btn btn--outline" data-modal-close>Abbrechen</button>
        <button type="button" class="btn btn--filled" id="${id}">Im Prototyp veröffentlichen</button>`,
    });
    requestAnimationFrame(() => document.getElementById(id)?.addEventListener('click', () => publishCurrentVersion(close), { once: true }));
  }

  function resetWorkingCopy(closeModal = () => {}) {
    if (dirty && !window.confirm('Nicht gespeicherte Änderungen verwerfen und den Ausgangsstand laden?')) return;
    removeWorkingCopy(floor.floorId);
    editorDocument = cloneDocument(baseline);
    lastSaved = cloneDocument(baseline);
    hasLocalDraft = false; dirty = false; selected = null;
    editHistory.reset(editorDocument);
    closeModal(); draw();
    C.toast('Lokale Arbeitskopie verworfen.', 'success', 'CheckmarkCircle');
  }

  function openVersionHistory() {
    const id = `fpe-reset-copy-${Date.now()}`;
    const rows = [...revisions].reverse().map((revision) => `<li>
      <strong>V${revision.number + 1} · lokal publiziert</strong>
      <span>${C.escape(new Date(revision.createdAt).toLocaleString('de-CH'))} · ${C.escape(revision.createdBy)}</span>
      <small>${revision.document.rooms.length} Räume · ${revision.document.placements.length} Objekte</small>
    </li>`).join('');
    const close = C.openModal({
      id: 'fpe-history-modal', size: 'md', title: 'Versionsverlauf im Prototyp',
      body: `${C.notification('Diese Einträge existieren nur auf diesem Gerät und sind keine freigegebenen Planrevisionen.', 'info', 'InfoCircle')}
        <ol class="fpe-version-list">${rows || '<li><strong>Noch keine lokale Veröffentlichung</strong><span>Eine Publikation kann im Bearbeitungsmodus simuliert werden.</span></li>'}
          <li><strong>V1 · Ausgangsstand</strong><span>${C.escape(plan.lastSync || 'Quellstand des Portals')}</span><small>${baseline.rooms.length} Räume · ${baseline.placements.length} illustrative Objekte</small></li>
        </ol>`,
      footer: `${hasLocalDraft || dirty ? `<button type="button" class="btn btn--outline" id="${id}">Arbeitskopie verwerfen</button>` : ''}
        <button type="button" class="btn btn--filled" data-modal-close>Schliessen</button>`,
    });
    if (hasLocalDraft || dirty) requestAnimationFrame(() => document.getElementById(id)?.addEventListener('click', () => resetWorkingCopy(close), { once: true }));
  }

  function endEditing() {
    if (dirty && !window.confirm('Nicht gespeicherte Änderungen verwerfen und Bearbeitung beenden?')) return;
    if (dirty) {
      editorDocument = cloneDocument(lastSaved); dirty = false;
      keepValidSelection();
    }
    editHistory.reset(editorDocument);
    editMode = false; tool = 'select'; placementProduct = null; placementGhost = null;
    assetLibraryOpen = false; structureMenuOpen = false;
    leftOpen = !compactWorkbench();
    if (!compactWorkbench()) desktopPanels.left = true;
    roomDraft = null; measurement = null;
    draw(); announce('Bearbeitungsmodus beendet.');
  }

  function fitSelected() {
    if (!selected) return;
    const rect = selected.type === 'room'
      ? roomById().get(selected.id)?.rect
      : (() => {
          const item = placementById().get(selected.id);
          return item ? [item.x, item.y, item.width, item.depth] : null;
        })();
    const next = fitCameraToRect(rect);
    if (!next) return;
    camera = next; viewMode = '2d'; syncQuery(); drawScene(true);
    announce('Auswahl eingepasst.');
  }

  function setView(next) {
    if (!VIEW_MODES.has(next) || viewMode === next) return;
    viewMode = next;
    tool = 'select'; measurement = null; roomDraft = null; placementGhost = null;
    structureMenuOpen = false;
    if (editMode && next !== '2d') {
      assetLibraryOpen = false; leftOpen = false; placementProduct = null;
      if (!compactWorkbench()) desktopPanels.left = false;
    }
    syncQuery(); draw();
    requestAnimationFrame(() => mount.querySelector(`[data-action="view-${next}"]`)?.focus({ preventScroll: true }));
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
      colorMenuOpen = false;
      drawLeftPanel();
    }
    const leave = event.target.closest('[data-leave]');
    if (leave && dirty && !window.confirm('Nicht gespeicherte Änderungen verwerfen und Plan-Editor verlassen?')) { event.preventDefault(); return; }
    const groupToggle = event.target.closest('[data-resource-group]');
    if (groupToggle) {
      const key = groupToggle.dataset.resourceGroup;
      if (expandedGroups.has(key)) expandedGroups.delete(key); else expandedGroups.add(key);
      drawLeft();
      requestAnimationFrame(() => mount.querySelector(`[data-resource-group="${CSS.escape(key)}"]`)?.focus({ preventScroll: true }));
      return;
    }
    const roomToggle = event.target.closest('[data-resource-room]');
    if (roomToggle) {
      const id = roomToggle.dataset.resourceRoom;
      if (expandedRooms.has(id)) expandedRooms.delete(id); else expandedRooms.add(id);
      drawLeft();
      requestAnimationFrame(() => mount.querySelector(`[data-resource-room="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }));
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
      syncQuery(); drawScene(); drawLeftPanel('fpe-color-trigger');
      announce(`Einfärbung ${EDITOR_COLOR_MODES.find((item) => item.value === colorMode)?.label}.`);
      return;
    }
    const libraryTab = event.target.closest('[data-library]');
    if (libraryTab && editMode) {
      libraryMode = libraryTab.dataset.library === 'modules' ? 'modules' : 'products';
      productQuery = ''; placementProduct = null; tool = 'add';
      syncQuery(); redrawPreservingFocus();
      requestAnimationFrame(() => mount.querySelector(`[data-library="${libraryMode}"]`)?.focus());
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
      requestAnimationFrame(() => mount.querySelector('#fpe-left-search')?.focus());
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
      editMode = true; tool = 'select'; assetLibraryOpen = false; leftOpen = false;
      if (!compactWorkbench()) desktopPanels.left = false;
      draw();
      requestAnimationFrame(() => mount.querySelector('#fpe-action-tool-select')?.focus({ preventScroll: true }));
      announce('Bearbeitungsmodus gestartet. Änderungen bleiben lokal, bis sie gespeichert werden.');
    }
    else if (action === 'end-edit') endEditing();
    else if (action === 'save') saveLocalDraft();
    else if (action === 'publish') openPublishDialog();
    else if (action === 'clear-selection') selectEntity(null, null);
    else if (action === 'tool-select') chooseTool('select');
    else if (action === 'tool-pan') chooseTool('pan');
    else if (action === 'tool-room') chooseTool('room');
    else if (action === 'tool-distance') chooseTool('distance');
    else if (action === 'tool-area') chooseTool('area');
    else if (action === 'cancel-place') chooseTool('select');
    else if (action === 'zoom-in') {
      if (viewMode === '2d') { camera = zoomCamera(camera, .8); drawScene(); }
      else if (viewMode === '3d') { threeViewer?.zoom(.8); announce('3D-Ansicht vergrössert.'); }
    }
    else if (action === 'zoom-out') {
      if (viewMode === '2d') { camera = zoomCamera(camera, 1.25); drawScene(); }
      else if (viewMode === '3d') { threeViewer?.zoom(1.25); announce('3D-Ansicht verkleinert.'); }
    }
    else if (action === 'fit') { camera = fitCamera(floor); drawScene(); announce('Plan eingepasst.'); }
    else if (action === 'fit-selection') fitSelected();
    else if (action === 'undo') restoreHistory('undo');
    else if (action === 'redo') restoreHistory('redo');
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
    else if (action === 'print') window.print();
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
      syncQuery(); drawScene(); drawLeft();
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
    const point = clientToPlan(svg, event.clientX, event.clientY);
    if (!point) return;
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
    const entity = event.target.closest('[data-entity]');
    const roomHandle = event.target.closest('[data-room-handle]');
    const directPrimaryPan = tool === 'select' && event.button === 0 && (!editMode || !entity);
    if (tool === 'pan' || event.button === 1 || directPrimaryPan) {
      event.preventDefault();
      try { mount.setPointerCapture?.(event.pointerId); } catch { /* synthetic/ended pointer */ }
      stage.classList.add('is-panning');
      drag = {
        type: 'pan', pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
        camera: { ...camera }, moved: false,
        tapSelection: directPrimaryPan
          ? (entity ? { type: entity.dataset.entity, id: entity.dataset.id } : { type: null, id: null })
          : null,
      };
      return;
    }
    if (entity?.dataset.entity === 'placement' && editMode && tool === 'select') {
      event.preventDefault();
      const placement = placementById().get(entity.dataset.id);
      if (!placement) return;
      selected = { type: 'placement', id: placement.placementId }; syncQuery();
      try { mount.setPointerCapture?.(event.pointerId); } catch { /* synthetic/ended pointer */ }
      drag = { type: 'placement', pointerId: event.pointerId, start: point, x: placement.x, y: placement.y,
        roomId: placement.roomId, moved: false };
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
        drawScene();
      }
      return;
    }
    if (drag.pointerId !== event.pointerId) return;
    if (drag.type === 'pan') {
      const rect = svg?.getBoundingClientRect();
      if (!rect?.width || !rect?.height) return;
      const pixelDx = event.clientX - drag.clientX;
      const pixelDy = event.clientY - drag.clientY;
      drag.moved ||= Math.hypot(pixelDx, pixelDy) > 4;
      if (!drag.moved) return;
      camera = panCamera(drag.camera,
        -pixelDx * drag.camera.width / rect.width,
        -pixelDy * drag.camera.height / rect.height);
      drawScene(); return;
    }
    const point = clientToPlan(svg, event.clientX, event.clientY);
    if (!point) return;
    if (drag.type === 'room-create') {
      const [floorWidth, floorHeight] = floor.extent;
      const x1 = Math.max(0, Math.min(floorWidth, drag.start.x));
      const y1 = Math.max(0, Math.min(floorHeight, drag.start.y));
      const x2 = Math.max(0, Math.min(floorWidth, point.x));
      const y2 = Math.max(0, Math.min(floorHeight, point.y));
      const rect = [Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)];
      roomDraft = { rect, valid: rect[2] >= 100 && rect[3] >= 100 };
      drawScene(); return;
    }
    if (drag.type === 'room-move' || drag.type === 'room-resize') {
      const room = selected?.type === 'room' ? roomById().get(selected.id) : null;
      if (!room) return;
      const [floorWidth, floorHeight] = floor.extent;
      let [x, y, width, height] = drag.rect;
      if (drag.type === 'room-move') {
        const dx = point.x - drag.start.x, dy = point.y - drag.start.y;
        x = Math.max(0, Math.min(floorWidth - width, drag.rect[0] + dx));
        y = Math.max(0, Math.min(floorHeight - height, drag.rect[1] + dy));
        const actualDx = x - drag.rect[0], actualDy = y - drag.rect[1];
        const beforeById = new Map(drag.before.placements.map((item) => [item.placementId, item]));
        editorDocument.placements.filter((item) => item.roomId === room.spaceId).forEach((item) => {
          const previous = beforeById.get(item.placementId);
          if (previous) { item.x = previous.x + actualDx; item.y = previous.y + actualDy; }
        });
      } else {
        let left = x, top = y, right = x + width, bottom = y + height;
        if (drag.handle.includes('w')) left = Math.max(0, Math.min(point.x, right - 100));
        if (drag.handle.includes('e')) right = Math.min(floorWidth, Math.max(point.x, left + 100));
        if (drag.handle.includes('n')) top = Math.max(0, Math.min(point.y, bottom - 100));
        if (drag.handle.includes('s')) bottom = Math.min(floorHeight, Math.max(point.y, top + 100));
        x = left; y = top; width = right - left; height = bottom - top;
      }
      drag.moved ||= Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 3;
      stampRoomGeometry(room, [x, y, width, height]);
      drawScene(); return;
    }
    const placement = selected?.type === 'placement' ? placementById().get(selected.id) : null;
    if (!placement) return;
    drag.moved ||= Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 3;
    placement.x = drag.x + point.x - drag.start.x;
    placement.y = drag.y + point.y - drag.start.y;
    Object.assign(placement, clampPlacement(placement, floor));
    drawScene();
  }

  function onPointerUp(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    let tapSelection = null;
    if (drag.type === 'room-create') {
      const draft = roomDraft;
      roomDraft = null;
      if (event.type !== 'pointercancel' && draft?.valid) addRoom(draft.rect);
      else { chooseTool('select'); announce('Neue Fläche verworfen.'); }
    } else if (drag.type === 'room-move' || drag.type === 'room-resize') {
      const room = selected?.type === 'room' ? roomById().get(selected.id) : null;
      const accepted = drag.moved && event.type !== 'pointercancel' && room
        && roomRectInsideFloor(room.rect, floor.extent) && placementsInsideRoom(editorDocument, room);
      if (!drag.moved) {
        editorDocument = cloneDocument(drag.before);
      } else if (!accepted) {
        editorDocument = cloneDocument(drag.before);
        announce('Raumgeometrie bleibt unverändert: Verortete Objekte müssen innerhalb der Fläche liegen.');
      } else {
        editHistory.push(editorDocument);
        editorDocument = cloneDocument(editHistory.current);
        dirty = !documentsEqual(editorDocument, lastSaved);
        syncDraftChrome();
        announce(drag.type === 'room-move' ? 'Raum und Ausstattung verschoben.' : 'Raumkante verschoben.');
      }
      drawWorkArea({ focusSelected: true });
    } else if (drag.type === 'placement' && drag.moved) {
      const placement = selected?.type === 'placement' ? placementById().get(selected.id) : null;
      if (placement) {
        const cx = placement.x + placement.width / 2, cy = placement.y + placement.depth / 2;
        const containing = containingRoom(editorDocument.rooms, { x: cx, y: cy });
        if (!containing) {
          placement.x = drag.x; placement.y = drag.y; placement.roomId = drag.roomId;
          announce('Objekt bleibt am bisherigen Ort: Der Mittelpunkt muss in einem Raum liegen.');
        } else {
          placement.roomId = containing.spaceId;
          if (placement.status !== 'new') placement.status = 'moved';
          editHistory.push(editorDocument);
          editorDocument = cloneDocument(editHistory.current);
          dirty = !documentsEqual(editorDocument, lastSaved);
          syncDraftChrome();
          announce('Objekt verschoben.');
        }
        drawWorkArea({ focusSelected: true });
      }
    } else if (drag.type === 'pan' && !drag.moved && event.type !== 'pointercancel') {
      tapSelection = drag.tapSelection;
    }
    mount.querySelector('#fpe-stage')?.classList.remove('is-panning');
    try { mount.releasePointerCapture?.(event.pointerId); } catch { /* capture already gone */ }
    drag = null;
    if (tapSelection) selectEntity(tapSelection.type, tapSelection.id, Boolean(tapSelection.type));
  }

  function onWheel(event) {
    if (viewMode !== '2d' || !event.target.closest('#fpe-stage')) return;
    event.preventDefault();
    const point = clientToPlan(mount.querySelector('#fpe-canvas'), event.clientX, event.clientY);
    camera = zoomCamera(camera, event.deltaY < 0 ? .88 : 1.14, point);
    drawScene();
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

  function onKeyDown(event) {
    const textControl = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
    if (event.target.id === 'fpe-more-trigger' && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setMoreMenuOpen(true, { focusFirst: true });
      return;
    }
    const menuItem = event.target.closest?.('#fpe-more-menu [role="menuitem"]');
    if (menuItem) {
      const items = [...mount.querySelectorAll('#fpe-more-menu [role="menuitem"]:not([disabled])')];
      const index = items.indexOf(menuItem);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
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
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
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
      requestAnimationFrame(() => mount.querySelector('.fpe-color-menu [aria-checked="true"]')?.focus({ preventScroll: true }));
      return;
    }
    const colorItem = event.target.closest?.('.fpe-color-menu [role="menuitemradio"]');
    if (colorItem && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const items = [...mount.querySelectorAll('.fpe-color-menu [role="menuitemradio"]')];
      const index = items.indexOf(colorItem);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus({ preventScroll: true });
      return;
    }
    const libraryTab = event.target.closest?.('[data-library][role="tab"]');
    if (libraryTab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const tabs = [...mount.querySelectorAll('[data-library][role="tab"]')];
      const index = tabs.indexOf(libraryTab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next]?.click();
      return;
    }
    const viewButton = event.target.closest?.('[data-view-mode]');
    if (viewButton && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const buttons = [...mount.querySelectorAll('[data-view-mode]')];
      const index = buttons.indexOf(viewButton);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      const nextMode = buttons[next]?.dataset.viewMode;
      if (nextMode && nextMode !== viewMode) setView(nextMode);
      else buttons[next]?.focus({ preventScroll: true });
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !textControl) {
      if (event.key.toLocaleLowerCase() === 'z') { event.preventDefault(); restoreHistory(event.shiftKey ? 'redo' : 'undo'); return; }
      if (event.key.toLocaleLowerCase() === 'y') { event.preventDefault(); restoreHistory('redo'); return; }
    }
    if (!textControl && !event.ctrlKey && !event.metaKey && !event.altKey && viewMode === '2d') {
      const key = event.key.toLocaleLowerCase();
      if (key === 'v') { event.preventDefault(); chooseTool('select'); return; }
      if (key === 'h') { event.preventDefault(); chooseTool('pan'); return; }
      if (key === 'f') { event.preventDefault(); camera = fitCamera(floor); drawScene(); announce('Plan eingepasst.'); return; }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); camera = zoomCamera(camera, .8); drawScene(); return; }
      if (event.key === '-') { event.preventDefault(); camera = zoomCamera(camera, 1.25); drawScene(); return; }
    }
    if (event.key === 'Escape') {
      if (moreMenuOpen) { event.preventDefault(); setMoreMenuOpen(false, { restoreFocus: true }); }
      else if (structureMenuOpen) { event.preventDefault(); setStructureMenuOpen(false, { restoreFocus: true }); }
      else if (colorMenuOpen) { event.preventDefault(); colorMenuOpen = false; drawLeftPanel('fpe-color-trigger'); }
      else if (closeCompactPanels()) event.preventDefault();
      else if (tool !== 'select') { event.preventDefault(); chooseTool('select'); }
      else if (selected) { event.preventDefault(); selectEntity(null, null); }
      return;
    }
    if (tool === 'area' && event.key === 'Enter' && measurement?.points.length >= 3 && !measurement.complete) {
      event.preventDefault(); measurement.complete = true; drawScene(); announce(`Fläche ${measurementLabel(measurement)}.`); return;
    }
    if ((tool === 'area' || tool === 'distance') && event.key === 'Backspace' && measurement?.points.length) {
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
      if (!accepted) announce('Objekt nicht verschoben: Der Mittelpunkt muss in einem Raum liegen.');
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
    syncScale();
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
  mount.addEventListener('pointerleave', onPointerLeave, { signal });
  mount.addEventListener('wheel', onWheel, { signal, passive: false });
  mount.addEventListener('dblclick', onDoubleClick, { signal });
  mount.addEventListener('keydown', onKeyDown, { signal });
  window.addEventListener('beforeunload', beforeUnload, { signal });
  window.addEventListener('resize', onWindowResize, { signal });
  onUnmount(() => { disposeThreeViewer(); abort.abort(); });

  setTitle(`Plan-Editor — ${floor.label}`);
  draw();
}
