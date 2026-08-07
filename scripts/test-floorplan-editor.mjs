// Standalone floor-plan editor regression: deep-link routing, portal-shell
// isolation, selection/inspector state, browser-local editing, and responsive
// panel lifecycle. The editor remains a separate micro-app from the read-only
// Workspace portal and from the future plan checker.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

const BUILDING_ID = '1080/6650/AA';
const FLOOR_ID = '1080-6650-AA-2og';
const ROOM_ID = `${FLOOR_ID}-05`;
const EDITED_OCCUPIER = 'Editor-Test VE';
const DRAFT_KEY = `bbl_floorplan_editor_local_v1:${encodeURIComponent(FLOOR_ID)}`;
const HISTORY_KEY = `bbl_floorplan_editor_history_v1:${encodeURIComponent(FLOOR_ID)}`;
const ROUTE = `${APP_BASE}/app/floorplan-editor?building=${encodeURIComponent(BUILDING_ID)}&floor=${encodeURIComponent(FLOOR_ID)}`;

async function waitFor(page, selector, timeout = 6000) {
  return page.evaluate(`(async () => {
    const deadline = performance.now() + ${Number(timeout)};
    while (!document.querySelector(${JSON.stringify(selector)}) && performance.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return !!document.querySelector(${JSON.stringify(selector)});
  })()`);
}

async function checkProblems(page, label) {
  const problems = await page.problems();
  check(problems.length === 0, label, problems[0] || '');
}

const cdp = await launch();
let page;
try {
  console.log('\n■ Floor-plan editor login gate');
  const gatePage = await openPage(cdp, ROUTE, { login: false });
  await sleep(350);
  const gate = await gatePage.evaluate(`(() => ({
    h1: document.querySelector('#main-content h1')?.textContent.replace(/\\s+/g, ' ').trim() || '',
    login: !!document.querySelector('[data-login]'),
    editor: !!document.querySelector('#fpe-app'),
    standalone: document.body.classList.contains('body--standalone-app'),
    files: performance.getEntriesByType('resource').map(entry => entry.name.split('/').pop().split('?')[0]),
  }))()`);
  check(/Plan-Editor/.test(gate.h1) && gate.login && !gate.editor && !gate.standalone,
    'uses the central portal login explanation before entering standalone mode', gate.h1);
  check(!gate.files.includes('floors.json') && !gate.files.includes('spaces.json')
    && !gate.files.includes('workspace-planning.json') && !gate.files.includes('shop-products.json'),
  'does not load protected editor data before authentication');
  await checkProblems(gatePage, 'login gate has no runtime problems');
  await gatePage.closeTarget();

  console.log('\n■ Floor-plan editor deep link and standalone shell');
  // Establish the desktop viewport before the editor module evaluates its
  // initial responsive panel state. A later resize intentionally does not
  // overwrite a user's explicit open/closed choice.
  page = await openPage(cdp, `${APP_BASE}/`, { login: true });
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  // Each run starts from the canonical baseline. The same test later proves
  // persistence with a reload, then leaves that one narrowly-scoped draft in
  // place so a developer can inspect it manually.
  await page.evaluate(`(() => {
    localStorage.removeItem(${JSON.stringify(DRAFT_KEY)});
    localStorage.removeItem(${JSON.stringify(HISTORY_KEY)});
  })()`);
  await cdp.send('Page.navigate', { url: ROUTE }, page.sessionId);
  await sleep(400);
  const workbenchLoaded = await waitFor(page, '#fpe-app');
  check(workbenchLoaded, 'loads the authenticated editor workbench');
  if (!workbenchLoaded) {
    const diagnostic = await page.evaluate(`JSON.stringify({
      title: document.title,
      text: document.querySelector('#main-content')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      html: document.querySelector('#main-content')?.innerHTML.slice(0, 1200) || '',
      bodyClass: document.body.className,
    })`).then(JSON.parse);
    const problems = await page.problems();
    console.error('Editor mount diagnostic:', diagnostic, problems);
    throw new Error('Floor-plan editor did not mount');
  }

  const initial = await page.evaluate(`(async () => {
    const [{ core }, { createBaseline }] = await Promise.all([
      import('./js/core.js'), import('./js/floorplan-editor-model.js'),
    ]);
    const building = core.building(${JSON.stringify(BUILDING_ID)});
    const floor = core.floor(${JSON.stringify(FLOOR_ID)});
    const rooms = core.spacesForFloor(${JSON.stringify(FLOOR_ID)});
    const planning = (core.data.workspacePlanning || [])
      .find(entry => entry.buildingId === ${JSON.stringify(BUILDING_ID)});
    const planningFloor = (planning?.floors || [])
      .find(entry => entry.floorId === ${JSON.stringify(FLOOR_ID)}) || null;
    const baseline = createBaseline({
      building, floor, spaces: rooms, products: core.shopProducts(), planningFloor,
      user: { name: 'Andrea Muster' },
    });
    const canonicalRoom = rooms.find(room => room.spaceId === ${JSON.stringify(ROOM_ID)});
    const dimensions = selector => {
      const node = document.querySelector(selector);
      const rect = node?.getBoundingClientRect();
      return { width: rect?.width || 0, height: rect?.height || 0 };
    };
    const display = selector => {
      const node = document.querySelector(selector);
      return node ? getComputedStyle(node).display : '';
    };
    const roomIds = [...document.querySelectorAll('.fpe-room[data-id]')].map(node => node.dataset.id);
    const placementIds = [...document.querySelectorAll('.fpe-placement[data-id]')].map(node => node.dataset.id);
    return {
      h1: document.querySelector('#main-content h1')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      hash: location.hash,
      standalone: document.body.classList.contains('body--standalone-app'),
      headerDisplay: display('#main-header'), footerDisplay: display('#main-footer'),
      bannerDisplay: display('#banner-host'),
      buildingValue: document.querySelector('#fpe-building')?.value || '',
      floorValue: document.querySelector('#fpe-floor')?.value || '',
      left: dimensions('#fpe-left'), stage: dimensions('#fpe-stage'), right: dimensions('#fpe-right'),
      roomCount: roomIds.length, expectedRooms: rooms.length, declaredRooms: floor?.rooms || 0,
      uniqueRooms: new Set(roomIds).size,
      placementCount: placementIds.length, expectedPlacements: baseline.placements.length,
      uniquePlacements: new Set(placementIds).size,
      canvasLabel: document.querySelector('#fpe-canvas')?.getAttribute('aria-label') || '',
      canonicalRoom: canonicalRoom ? JSON.stringify(canonicalRoom) : '',
      canonicalOccupier: canonicalRoom?.occupierVe ?? null,
      overflow: Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ),
      duplicateIds: [...document.querySelectorAll('[id]')]
        .map(node => node.id).filter((id, index, ids) => ids.indexOf(id) !== index),
      unlabeledControls: [...document.querySelectorAll('input,select')]
        .filter(control => !control.labels?.length && !control.getAttribute('aria-label')).length,
      unnamedButtons: [...document.querySelectorAll('button')]
        .filter(button => !button.getAttribute('aria-label') && !button.getAttribute('title')
          && !button.textContent.trim()).length,
      headingJumps: (() => {
        const jumps = [];
        [...document.querySelectorAll('#main-content h1,#main-content h2,#main-content h3')]
          .reduce((previous, heading) => {
            const level = Number(heading.tagName.slice(1));
            if (previous && level > previous + 1) jumps.push(previous + '→' + level);
            return level;
          }, 0);
        return jumps;
      })(),
    };
  })()`);

  check(initial.standalone && initial.headerDisplay === 'none'
    && initial.footerDisplay === 'none' && initial.bannerDisplay === 'none',
  'hides the portal header, footer, and banner in standalone mode',
  `${initial.headerDisplay}/${initial.footerDisplay}/${initial.bannerDisplay}`);
  check(/Plan-Editor/.test(initial.h1) && /2\. OG/.test(initial.h1) && /Liebefeld/.test(initial.h1),
    'identifies the requested building and floor in the editor H1', initial.h1);
  check(initial.buildingValue === BUILDING_ID && initial.floorValue === FLOOR_ID
    && /building=1080%2F6650%2FAA/i.test(initial.hash) && initial.hash.includes(`floor=${FLOOR_ID}`),
  'preserves the valid building/floor deep link', initial.hash);
  check(initial.left.width > 0 && initial.stage.width > 0 && initial.right.width > 0
    && [initial.left, initial.stage, initial.right].every(pane => pane.height > 0),
  'renders the resources, drawing, and inspector as three visible panes',
  `${Math.round(initial.left.width)}/${Math.round(initial.stage.width)}/${Math.round(initial.right.width)}px`);
  check(initial.roomCount === 28 && initial.roomCount === initial.expectedRooms
    && initial.roomCount === initial.declaredRooms && initial.uniqueRooms === initial.roomCount,
  'renders every canonical room exactly once',
  `${initial.roomCount} DOM / ${initial.expectedRooms} core / ${initial.declaredRooms} floor`);
  check(initial.placementCount > 0 && initial.placementCount === initial.expectedPlacements
    && initial.uniquePlacements === initial.placementCount
    && initial.canvasLabel.includes(`${initial.roomCount} Räumen`)
    && initial.canvasLabel.includes(`${initial.placementCount} Ausstattungsobjekten`),
  'renders the deterministic baseline placements exactly once',
  `${initial.placementCount} DOM / ${initial.expectedPlacements} baseline`);
  check(initial.overflow <= 1 && initial.duplicateIds.length === 0
    && initial.unlabeledControls === 0 && initial.unnamedButtons === 0
    && initial.headingJumps.length === 0,
  'keeps the standalone workbench contained and structurally accessible',
  `${initial.overflow}px overflow · ${initial.duplicateIds.length} duplicate IDs · ${initial.headingJumps.join(', ') || 'heading order ok'}`);

  console.log('\n■ Camera scale and visual feedback modes');
  const views = await page.evaluate(`(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 100));
    const click = selector => document.querySelector(selector)?.click();
    const scale = () => ({
      label: document.querySelector('#fpe-scale span')?.textContent.trim() || '',
      width: parseFloat(document.querySelector('#fpe-scale i')?.style.width || '0'),
      metres: parseFloat(document.querySelector('#fpe-scale span')?.textContent || '0'),
    });
    const before = scale();
    click('[data-action="zoom-in"]'); await pause();
    const zoomed = scale();
    click('[data-action="view-3d"]'); await pause();
    const image = document.querySelector('.fpe-reference-view img');
    if (image && !image.complete) await new Promise(resolve => image.addEventListener('load', resolve, { once: true }));
    const threeD = {
      active: document.querySelector('[data-action="view-3d"]')?.getAttribute('aria-pressed') || '',
      image: image?.naturalWidth || 0,
      text: document.querySelector('.fpe-reference-view p')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      view: new URLSearchParams(location.hash.split('?')[1] || '').get('view') || '',
      canvas: !!document.querySelector('#fpe-canvas'),
    };
    click('[data-action="view-walk"]'); await pause();
    const walk = {
      active: document.querySelector('[data-action="view-walk"]')?.getAttribute('aria-pressed') || '',
      classed: document.querySelector('.fpe-reference-view')?.classList.contains('is-walk') || false,
      view: new URLSearchParams(location.hash.split('?')[1] || '').get('view') || '',
    };
    click('[data-action="view-2d"]'); await pause();
    return { before, zoomed, threeD, walk,
      twoD: !!document.querySelector('#fpe-canvas'),
      finalView: new URLSearchParams(location.hash.split('?')[1] || '').get('view') || '' };
  })()`);
  check(views.before.label && views.before.width > 0 && views.before.metres > 0
    && views.zoomed.label && views.zoomed.width > 0 && views.zoomed.metres > 0
    && views.zoomed.width / views.zoomed.metres > views.before.width / views.before.metres,
  'recalculates the scale bar when the camera zoom changes',
  `${views.before.label}/${Math.round(views.before.width)}px → ${views.zoomed.label}/${Math.round(views.zoomed.width)}px`);
  check(views.threeD.active === 'true' && views.threeD.image > 0 && views.threeD.view === '3d'
    && !views.threeD.canvas && /nicht aus diesem Plan berechnet/i.test(views.threeD.text),
  'opens the supplied, explicitly labelled 3D reference state', `${views.threeD.image}px · ${views.threeD.view}`);
  check(views.walk.active === 'true' && views.walk.classed && views.walk.view === 'walk'
    && views.twoD && !views.finalView,
  'switches through the walkthrough feedback state and returns to the live 2D canvas');

  console.log('\n■ Room and placement selection');
  const selection = await page.evaluate(`(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 60));
    const selectOnCanvas = (node, pointerId) => {
      const rect = document.querySelector('#fpe-canvas')?.getBoundingClientRect();
      if (!node || !rect) return false;
      const init = {
        bubbles: true, cancelable: true, pointerId, button: 0,
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      };
      const result = node.dispatchEvent(new PointerEvent('pointerdown', init));
      document.querySelector('#fpe-canvas')?.dispatchEvent(new PointerEvent('pointerup', init));
      return result;
    };
    const selectedQuery = () => new URLSearchParams(location.hash.split('?')[1] || '').get('selected') || '';
    const room = document.querySelector('.fpe-room[data-id=${JSON.stringify(ROOM_ID)}]');
    if (!room) return { error: 'requested room is missing' };
    selectOnCanvas(room, 11); await pause();
    const roomState = {
      selected: document.querySelector('.fpe-room.is-selected')?.dataset.id || '',
      pressed: document.querySelector('.fpe-room.is-selected')?.getAttribute('aria-pressed') || '',
      focus: document.activeElement?.closest?.('[data-entity="room"]')?.dataset.id || '',
      query: selectedQuery(),
      inspector: document.querySelector('#fpe-right')?.textContent.replace(/\\s+/g, ' ').trim() || '',
    };
    const placement = document.querySelector('.fpe-placement[data-id]');
    if (!placement) return { error: 'baseline placement is missing', roomState };
    const placementId = placement.dataset.id;
    selectOnCanvas(placement, 12); await pause();
    const placementState = {
      id: placementId,
      selected: document.querySelector('.fpe-placement.is-selected')?.dataset.id || '',
      pressed: document.querySelector('.fpe-placement.is-selected')?.getAttribute('aria-pressed') || '',
      focus: document.activeElement?.closest?.('[data-entity="placement"]')?.dataset.id || '',
      query: selectedQuery(),
      inspector: document.querySelector('#fpe-right')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      productPreview: !!document.querySelector('#fpe-right .fpe-product-preview'),
    };
    return { roomState, placementState };
  })()`);
  check(!selection.error && selection.roomState.selected === ROOM_ID
    && selection.roomState.pressed === 'true'
    && selection.roomState.focus === ROOM_ID
    && selection.roomState.query === `room:${ROOM_ID}`
    && selection.roomState.inspector.includes(ROOM_ID),
  'selects a room and exposes its matching inspector and URL state',
  selection.error || selection.roomState?.query || '');
  check(!selection.error && selection.placementState.selected === selection.placementState.id
    && selection.placementState.pressed === 'true'
    && selection.placementState.focus === selection.placementState.id
    && selection.placementState.query === `placement:${selection.placementState.id}`
    && selection.placementState.inspector.includes(selection.placementState.id)
    && selection.placementState.productPreview,
  'selects a placement and exposes its matching object inspector and URL state',
  selection.error || selection.placementState?.query || '');

  console.log('\n■ Edit, add product, undo, and redo');
  const added = await page.evaluate(`(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 60));
    const fire = node => node?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const selectOnCanvas = (node, pointerId) => {
      const rect = document.querySelector('#fpe-canvas')?.getBoundingClientRect();
      if (!node || !rect) return false;
      const init = {
        bubbles: true, cancelable: true, pointerId, button: 0,
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      };
      const result = node.dispatchEvent(new PointerEvent('pointerdown', init));
      document.querySelector('#fpe-canvas')?.dispatchEvent(new PointerEvent('pointerup', init));
      return result;
    };
    const start = document.querySelector('[data-action="start-edit"]');
    if (!start) return { error: 'start-edit action is missing' };
    fire(start); await pause();
    const room = document.querySelector('.fpe-room[data-id=${JSON.stringify(ROOM_ID)}]');
    if (!room) return { error: 'room is missing after entering edit mode' };
    selectOnCanvas(room, 21); await pause();
    const before = document.querySelectorAll('.fpe-placement').length;
    const product = document.querySelector('.fpe-product[data-product]');
    if (!product) return { error: 'product library is empty', before };
    const productId = product.dataset.product;
    fire(product); await pause();
    const local = document.querySelector('.fpe-placement.is-new[data-id]');
    return {
      editing: document.querySelector('#fpe-app')?.classList.contains('is-editing') || false,
      library: document.querySelector('#fpe-left')?.getAttribute('aria-label') || '',
      before, after: document.querySelectorAll('.fpe-placement').length,
      productId, localId: local?.dataset.id || '',
      selected: document.querySelector('.fpe-placement.is-selected')?.dataset.id || '',
      inspector: document.querySelector('#fpe-right')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      undoEnabled: !document.querySelector('[data-action="undo"]')?.disabled,
      saveEnabled: !document.querySelector('[data-action="save"]')?.disabled,
    };
  })()`);
  check(!added.error && added.editing && added.library === 'Produktbibliothek',
    'starts edit mode and replaces resources with the product library', added.error || added.library);
  check(!added.error && added.after === added.before + 1 && /^local-/.test(added.localId)
    && added.selected === added.localId && added.inspector.includes(added.localId)
    && added.undoEnabled && added.saveEnabled,
  'adds the chosen library product to the selected room and selects it',
  added.error || `${added.before} → ${added.after} · ${added.localId}`);

  const history = await page.evaluate(`(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 60));
    const click = selector => document.querySelector(selector)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    click('[data-action="undo"]'); await pause();
    const afterUndo = document.querySelectorAll('.fpe-placement').length;
    const localAfterUndo = !!document.querySelector('.fpe-placement[data-id=${JSON.stringify(added.localId || '')}]');
    const redoEnabled = !document.querySelector('[data-action="redo"]')?.disabled;
    click('[data-action="redo"]'); await pause();
    return {
      afterUndo, localAfterUndo, redoEnabled,
      afterRedo: document.querySelectorAll('.fpe-placement').length,
      localAfterRedo: !!document.querySelector('.fpe-placement[data-id=${JSON.stringify(added.localId || '')}]'),
      undoEnabled: !document.querySelector('[data-action="undo"]')?.disabled,
    };
  })()`);
  check(history.afterUndo === added.before && !history.localAfterUndo && history.redoEnabled,
    'undo removes the newly placed product and enables redo', `${history.afterUndo} placements`);
  check(history.afterRedo === added.after && history.localAfterRedo && history.undoEnabled,
    'redo restores the same placement and enables undo', `${history.afterRedo} placements`);

  console.log('\n■ Detached room edit and browser-local save');
  const roomEdit = await page.evaluate(`(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 60));
    const room = document.querySelector('.fpe-room[data-id=${JSON.stringify(ROOM_ID)}]');
    const rect = document.querySelector('#fpe-canvas')?.getBoundingClientRect();
    if (room && rect) {
      const init = {
      bubbles: true, cancelable: true, pointerId: 31, button: 0,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      };
      room.dispatchEvent(new PointerEvent('pointerdown', init));
      document.querySelector('#fpe-canvas')?.dispatchEvent(new PointerEvent('pointerup', init));
    }
    await pause();
    const { core } = await import('./js/core.js');
    const canonical = () => core.spacesForFloor(${JSON.stringify(FLOOR_ID)})
      .find(room => room.spaceId === ${JSON.stringify(ROOM_ID)});
    const canonicalBefore = JSON.stringify(canonical());
    const input = document.querySelector('[data-room-field="occupierVe"]');
    if (!input) return { error: 'room occupier control is missing', canonicalBefore };
    input.value = ${JSON.stringify(EDITED_OCCUPIER)};
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
    return {
      value: document.querySelector('[data-room-field="occupierVe"]')?.value || '',
      selected: document.querySelector('.fpe-room.is-selected')?.dataset.id || '',
      placements: document.querySelectorAll('.fpe-placement').length,
      canonicalBefore, canonicalAfter: JSON.stringify(canonical()),
      saveEnabled: !document.querySelector('[data-action="save"]')?.disabled,
    };
  })()`);
  check(!roomEdit.error && roomEdit.value === EDITED_OCCUPIER && roomEdit.selected === ROOM_ID
    && roomEdit.placements === added.after && roomEdit.saveEnabled,
  'changes a room attribute without losing the redone placement',
  roomEdit.error || `${roomEdit.selected} · ${roomEdit.value}`);
  check(roomEdit.canonicalBefore === initial.canonicalRoom
    && roomEdit.canonicalAfter === initial.canonicalRoom,
  'keeps the in-memory canonical core space unchanged while editing');

  console.log('\n■ Constrained structural-editing and module feedback flow');
  const structure = await page.evaluate(`(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 80));
    const click = selector => document.querySelector(selector)?.click();
    const before = document.querySelectorAll('.fpe-room[data-id]').length;
    click('[data-action="tool-room"]'); await pause();
    let svg = document.querySelector('#fpe-canvas');
    if (!svg?.getScreenCTM()) return { error: '2D canvas unavailable for area creation' };
    const client = (x, y) => new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
    const start = client(40, 40), end = client(220, 210);
    const init = (type, point) => new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 44, button: 0,
      clientX: point.x, clientY: point.y,
    });
    svg.dispatchEvent(init('pointerdown', start));
    svg = document.querySelector('#fpe-canvas');
    svg.dispatchEvent(init('pointermove', end));
    svg = document.querySelector('#fpe-canvas');
    svg.dispatchEvent(init('pointerup', end));
    await pause();
    const local = document.querySelector('.fpe-room[data-id^="local-room-"]');
    if (!local) return { error: 'new local area was not created', before };
    const localId = local.dataset.id;
    const initialHandles = local.querySelectorAll('[data-room-handle]').length;
    click('[data-library="modules"]'); await pause();
    const module = document.querySelector('[data-module="1"]');
    module?.click(); await pause();
    const width = document.querySelector('[data-room-geometry="width"]');
    if (width) {
      width.value = '200';
      width.dispatchEvent(new Event('change', { bubbles: true }));
      await pause();
    }
    const stored = JSON.parse(localStorage.getItem(${JSON.stringify(DRAFT_KEY)}) || 'null');
    return {
      before, after: document.querySelectorAll('.fpe-room[data-id]').length,
      localId, selected: document.querySelector('.fpe-room.is-selected')?.dataset.id || '',
      handles: document.querySelector('.fpe-room.is-selected')?.querySelectorAll('[data-room-handle]').length || 0,
      initialHandles,
      inspector: document.querySelector('#fpe-right')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      moduleActive: document.querySelector('[data-module="1"]')?.getAttribute('aria-pressed') || '',
      library: new URLSearchParams(location.hash.split('?')[1] || '').get('library') || '',
      selectedQuery: new URLSearchParams(location.hash.split('?')[1] || '').get('selected') || '',
      width: document.querySelector('[data-room-geometry="width"]')?.value || '',
      saveEnabled: !document.querySelector('[data-action="save"]')?.disabled,
      prematurelyStored: stored?.rooms?.some(room => room.spaceId === localId) || false,
    };
  })()`);
  check(!structure.error && structure.after === structure.before + 1
    && /^local-room-/.test(structure.localId) && structure.selected === structure.localId
    && structure.initialHandles === 8 && structure.handles === 8,
  'creates and selects a rectangular local area with eight resize handles',
  structure.error || `${structure.before} → ${structure.after} · ${structure.localId}`);
  check(structure.moduleActive === 'true' && structure.library === 'modules'
    && structure.selectedQuery === `room:${structure.localId}` && structure.width === '200'
    && structure.saveEnabled && !structure.prematurelyStored,
  'assigns a module and edits room geometry without writing before explicit save',
  `${structure.library} · ${structure.width} cm`);

  const saved = await page.evaluate(`(async () => {
    document.querySelector('[data-action="save"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 80));
    const raw = localStorage.getItem(${JSON.stringify(DRAFT_KEY)});
    let draft = null;
    try { draft = raw ? JSON.parse(raw) : null; } catch { /* assertion below reports it */ }
    const room = draft?.rooms?.find(entry => entry.spaceId === ${JSON.stringify(ROOM_ID)});
    const localRoom = draft?.rooms?.find(entry => entry.spaceId === ${JSON.stringify(structure.localId || '')});
    return {
      hasDraft: !!draft,
      schema: draft?.schema || '', persistence: draft?.persistence || '',
      floorId: draft?.floorId || '', roomValue: room?.occupierVe || '',
      placements: draft?.placements?.length || 0,
      containsLocal: draft?.placements?.some(entry => entry.placementId === ${JSON.stringify(added.localId || '')}) || false,
      containsRoom: !!localRoom, roomModule: localRoom?.moduleId || '', roomWidth: localRoom?.rect?.[2] || 0,
      saveDisabled: document.querySelector('[data-action="save"]')?.disabled || false,
      version: document.querySelector('.fpe-version')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      hash: location.hash,
    };
  })()`);
  check(saved.hasDraft && saved.schema === 'bbl.floorplan-editor.draft/v1'
    && saved.persistence === 'browser-local' && saved.floorId === FLOOR_ID,
  'writes a schema-marked draft only to the editor local-storage namespace',
  `${saved.schema} · ${saved.floorId}`);
  check(saved.roomValue === EDITED_OCCUPIER && saved.placements === added.after
    && saved.containsLocal && saved.containsRoom && saved.roomModule === '1' && saved.roomWidth === 200
    && saved.saveDisabled && /Arbeitskopie.*Gerät/i.test(saved.version),
  'saves room, geometry, module, and placement changes, then clears the dirty state',
  `${saved.placements} placements · ${saved.version}`);

  console.log('\n■ Explicitly simulated publication and local history');
  const published = await page.evaluate(`(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 100));
    document.querySelector('[data-action="publish"]')?.click(); await pause();
    const dialogText = document.querySelector('#fpe-publish-modal-desc')?.textContent.replace(/\\s+/g, ' ').trim() || '';
    const confirm = document.querySelector('[id^="fpe-confirm-publish-"]');
    confirm?.click(); await pause();
    const raw = localStorage.getItem(${JSON.stringify(HISTORY_KEY)});
    let history = null;
    try { history = raw ? JSON.parse(raw) : null; } catch { /* assertion reports it */ }
    const afterPublish = {
      dialogText,
      schema: history?.schema || '',
      revisions: history?.revisions?.length || 0,
      number: history?.revisions?.[0]?.number || 0,
      localRoom: history?.revisions?.[0]?.document?.rooms?.some(room => room.spaceId === ${JSON.stringify(structure.localId || '')}) || false,
      version: document.querySelector('.fpe-version')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      publishDisabled: document.querySelector('[data-action="publish"]')?.disabled || false,
    };
    document.querySelector('[data-action="version-history"]')?.click(); await pause();
    const historyText = document.querySelector('#fpe-history-modal-desc')?.textContent.replace(/\\s+/g, ' ').trim() || '';
    document.querySelector('#fpe-history-modal-desc')?.closest('.modal')?.querySelector('[data-modal-close]')?.click();
    return { ...afterPublish, historyText };
  })()`);
  check(/Nur Feedback-Prototyp/i.test(published.dialogText)
    && published.schema === 'bbl.floorplan-editor.history/v1'
    && published.revisions === 1 && published.number === 1 && published.localRoom,
  'simulates publication as an immutable, browser-local V2 snapshot',
  `${published.schema} · ${published.revisions} revision`);
  check(/Lokal publiziert.*V2/i.test(published.version) && published.publishDisabled
    && /V2.*lokal publiziert/i.test(published.historyText)
    && /V1.*Ausgangsstand/i.test(published.historyText)
    && /nur auf diesem Gerät/i.test(published.historyText),
  'shows honest prototype labelling and a V2/V1 local version history', published.version);

  console.log('\n■ Reloaded draft and canonical isolation');
  await cdp.send('Page.reload', { ignoreCache: true }, page.sessionId);
  await sleep(500);
  check(await waitFor(page, '#fpe-app'), 'reloads the editor workbench');
  const reloaded = await page.evaluate(`(async () => {
    const { core } = await import('./js/core.js');
    const canonical = core.spacesForFloor(${JSON.stringify(FLOOR_ID)})
      .find(room => room.spaceId === ${JSON.stringify(ROOM_ID)});
    const raw = localStorage.getItem(${JSON.stringify(DRAFT_KEY)});
    let draft = null;
    try { draft = raw ? JSON.parse(raw) : null; } catch { /* assertion below reports it */ }
    return {
      standalone: document.body.classList.contains('body--standalone-app'),
      placements: document.querySelectorAll('.fpe-placement').length,
      containsLocal: !!document.querySelector('.fpe-placement[data-id=${JSON.stringify(added.localId || '')}]'),
      containsRoom: !!document.querySelector('.fpe-room[data-id=${JSON.stringify(structure.localId || '')}]'),
      selected: document.querySelector('.fpe-room.is-selected')?.dataset.id || '',
      editMode: document.querySelector('#fpe-app')?.classList.contains('is-editing') || false,
      canonical: canonical ? JSON.stringify(canonical) : '',
      storedRoom: draft?.rooms?.find(room => room.spaceId === ${JSON.stringify(ROOM_ID)})?.occupierVe || '',
      storedLocalModule: draft?.rooms?.find(room => room.spaceId === ${JSON.stringify(structure.localId || '')})?.moduleId || '',
      version: document.querySelector('.fpe-version')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      hash: location.hash,
    };
  })()`);
  check(reloaded.standalone && reloaded.editMode && reloaded.selected === structure.localId
    && reloaded.storedRoom === EDITED_OCCUPIER && reloaded.containsRoom
    && reloaded.storedLocalModule === '1',
  'restores the saved room edits, new area, and shareable editor state after reload', reloaded.hash);
  check(reloaded.placements === added.after && reloaded.containsLocal
    && /Lokal publiziert.*V2/i.test(reloaded.version),
  'restores the saved user placement and local publication state after reload', `${reloaded.placements} placements · ${reloaded.version}`);
  let reloadedCanonical = null;
  try { reloadedCanonical = reloaded.canonical ? JSON.parse(reloaded.canonical) : null; } catch { /* failed below */ }
  check(reloaded.canonical === initial.canonicalRoom
    && reloadedCanonical?.occupierVe === initial.canonicalOccupier
    && reloadedCanonical?.occupierVe !== EDITED_OCCUPIER,
  'leaves the canonical core room byte-for-byte unchanged after save and reload');

  console.log('\n■ Narrow editor panels and return to the portal');
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 320, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await sleep(200);
  const mobile = await page.evaluate(`(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 60));
    const overflow = () => Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      document.body.scrollWidth - document.body.clientWidth,
    );
    const panelVisibility = () => getComputedStyle(document.querySelector('#fpe-left')).visibility;
    const state = () => ({
      hasLeft: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
      pressed: document.querySelector('[data-action="toggle-left"]')?.getAttribute('aria-pressed') || '',
      visibility: panelVisibility(), overflow: overflow(),
    });
    const before = state();
    document.querySelector('[data-action="toggle-left"]')?.click(); await pause();
    const hidden = state();
    document.querySelector('[data-action="toggle-left"]')?.click(); await pause();
    const shown = state();
    return { before, hidden, shown, viewport: document.documentElement.clientWidth };
  })()`);
  check([mobile.before, mobile.hidden, mobile.shown].every(state => state.overflow <= 1)
    && mobile.viewport >= 300 && mobile.viewport <= 320,
  'keeps the 320px editor inside the document viewport through panel redraws',
  `${mobile.viewport}px viewport · ${Math.max(mobile.before.overflow, mobile.hidden.overflow, mobile.shown.overflow)}px overflow`);
  check(mobile.before.hasLeft && mobile.before.pressed === 'true'
    && !mobile.hidden.hasLeft && mobile.hidden.pressed === 'false' && mobile.hidden.visibility === 'hidden'
    && mobile.shown.hasLeft && mobile.shown.pressed === 'true' && mobile.shown.visibility === 'visible',
  'hides and restores the narrow resource/library panel with matching aria state',
  `${mobile.before.pressed} → ${mobile.hidden.pressed} → ${mobile.shown.pressed}`);

  await page.evaluate(`document.querySelector('[data-leave][aria-label="Zurück zu Workspace Management"]')?.click()`);
  check(await waitFor(page, '.workspace-detail'), 'returns from the editor to Workspace Management');
  const portal = await page.evaluate(`(() => {
    const visible = selector => {
      const node = document.querySelector(selector);
      return !!node && getComputedStyle(node).display !== 'none';
    };
    return {
      standalone: document.body.classList.contains('body--standalone-app'),
      editor: !!document.querySelector('#fpe-app'), workspace: !!document.querySelector('.workspace-detail'),
      headerVisible: visible('#main-header'), footerVisible: visible('#main-footer'),
      headerText: document.querySelector('#main-header')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      footerText: document.querySelector('#main-footer')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      h1: document.querySelector('#main-content h1')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      hash: location.hash,
    };
  })()`);
  check(!portal.standalone && !portal.editor && portal.workspace
    && portal.headerVisible && portal.footerVisible
    && portal.headerText.length > 0 && portal.footerText.length > 0,
  'restores the complete portal shell after leaving the standalone route', portal.hash);
  check(/Liebefeld/.test(portal.h1) && portal.hash.startsWith('#/app/workspace?')
    && /id=1080%2F6650%2FAA/i.test(portal.hash) && portal.hash.includes(`floor=${FLOOR_ID}`),
  'returns to the matching Workspace floor preview', `${portal.h1} · ${portal.hash}`);

  await checkProblems(page, 'complete editor flow has no runtime problems');
} finally {
  if (page) {
    try { await page.closeTarget(); } catch { /* browser may already be closing */ }
  }
  cdp.close();
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
