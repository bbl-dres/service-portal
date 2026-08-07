// Standalone floor-plan editor regression: internal building/floor navigation,
// direct deep links, portal-shell isolation, selection/inspector state,
// browser-local editing, and responsive panel lifecycle. The editor remains a
// separate micro-app from the read-only Workspace portal and future checker.
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

  console.log('\n■ Editor building and floor navigation');
  page = await openPage(cdp, `${APP_BASE}/`, { login: true });
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await cdp.send('Page.navigate', { url: `${APP_BASE}/app/floorplan-editor` }, page.sessionId);
  await sleep(450);
  check(await waitFor(page, '#fpe-navigation[data-view="buildings"]'), 'opens the editor building navigation without route parameters');
  const buildingNav = await page.evaluate(`(() => ({
    hash: location.hash,
    standalone: document.body.classList.contains('body--standalone-app'),
    rows: document.querySelectorAll('[data-nav-row]').length,
    activeRail: document.querySelector('.fpe-nav-rail__item[aria-current="page"]')?.textContent.replace(/\\s+/g, ' ').trim() || '',
    selected: document.querySelector('.fpe-nav-row.is-selected a')?.textContent.replace(/\\s+/g, ' ').trim() || '',
    openHref: document.querySelector('#fpe-open-building')?.getAttribute('href') || '',
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    duplicateIds: [...document.querySelectorAll('[id]')].map(node => node.id).filter((id, index, ids) => ids.indexOf(id) !== index),
    unlabeledControls: [...document.querySelectorAll('input,select,button')].filter(node => !node.disabled
      && !node.getAttribute('aria-label') && !node.getAttribute('title') && !node.labels?.length && !node.textContent.trim()).length,
    caption: document.querySelector('.fpe-nav-table caption')?.textContent.trim() || '',
  }))()`);
  check(buildingNav.hash === '#/app/floorplan-editor' && buildingNav.standalone && buildingNav.rows === 7,
    'keeps the building navigator as a stable standalone root route', `${buildingNav.hash} · ${buildingNav.rows} buildings`);
  check(/Gebäude/.test(buildingNav.activeRail) && /Liebefeld/.test(buildingNav.selected)
    && /building=1080%2F6650%2FAA/i.test(buildingNav.openHref),
  'selects the planned building and offers its floor navigation', `${buildingNav.activeRail} · ${buildingNav.selected}`);
  check(buildingNav.overflow <= 1, 'building navigation has no document overflow', `${buildingNav.overflow}px`);
  check(buildingNav.duplicateIds.length === 0 && buildingNav.unlabeledControls === 0 && /Gebäude/.test(buildingNav.caption),
    'building navigation is structurally accessible', `${buildingNav.duplicateIds.length} duplicate IDs · ${buildingNav.unlabeledControls} unnamed controls`);

  await cdp.send('Page.navigate', {
    url: `${APP_BASE}/app/floorplan-editor?building=${encodeURIComponent(BUILDING_ID)}`,
  }, page.sessionId);
  await sleep(450);
  check(await waitFor(page, '#fpe-navigation[data-view="floors"]'), 'opens the selected building floor navigation');
  const floorNav = await page.evaluate(`(async () => {
    const search = document.querySelector('#fpe-nav-search');
    search.value = '1. OG';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 60));
    const filtered = [...document.querySelectorAll('[data-nav-row]')].filter(row => !row.hidden).length;
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      hash: location.hash,
      rows: document.querySelectorAll('[data-nav-row]').length,
      filtered,
      selected: document.querySelector('.fpe-nav-row.is-selected a')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      inspector: document.querySelector('.fpe-nav-inspector')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      openHref: document.querySelector('#fpe-open-floor')?.getAttribute('href') || '',
      backHref: document.querySelector('.fpe-nav-context a[aria-label="Zurück zu allen Objekten"]')?.getAttribute('href') || '',
      caption: document.querySelector('.fpe-nav-table caption')?.textContent.trim() || '',
      scrollRegion: document.querySelector('.fpe-nav-main')?.getAttribute('aria-label') || '',
    };
  })()`);
  check(floorNav.rows === 3 && floorNav.filtered === 1 && /2\. OG/.test(floorNav.selected),
    'lists all active floors, selects the preferred floor, and filters locally', `${floorNav.rows} · ${floorNav.filtered} filtered · ${floorNav.selected}`);
  check(/Kennzahlen des Geschosses/.test(floorNav.inspector)
    && /building=1080%2F6650%2FAA/i.test(floorNav.openHref) && floorNav.openHref.includes(`floor=${FLOOR_ID}`)
    && floorNav.backHref === '#/app/floorplan-editor' && /Aktive Geschosse/.test(floorNav.caption)
    && floorNav.scrollRegion === 'Aktive Geschosse',
  'provides the wireframe inspector, exact editor handoff, and building-list breadcrumb', floorNav.openHref);
  await checkProblems(page, 'editor navigation has no runtime problems');

  console.log('\n■ Floor-plan editor deep link and standalone shell');
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
      breadcrumb: [...document.querySelectorAll('.fpe-breadcrumb :is(a,span[aria-current="page"])')]
        .map(node => node.textContent.replace(/\s+/g, ' ').trim()),
      backHref: document.querySelector('[data-leave][aria-label="Zurück zu allen Geschossen"]')?.getAttribute('href') || '',
      left: dimensions('#fpe-left'), stage: dimensions('#fpe-stage'), right: dimensions('#fpe-right'),
      roomCount: roomIds.length, expectedRooms: rooms.length, declaredRooms: floor?.rooms || 0,
      uniqueRooms: new Set(roomIds).size,
      placementCount: placementIds.length, expectedPlacements: baseline.placements.length,
      uniquePlacements: new Set(placementIds).size,
      canvasLabel: document.querySelector('#fpe-canvas')?.getAttribute('aria-label') || '',
      canonicalRoom: canonicalRoom ? JSON.stringify(canonicalRoom) : '',
      canonicalOccupier: canonicalRoom?.occupierVe ?? null,
      resourceTree: {
        roomNameInset: (() => {
          const line = document.querySelector('.fpe-resource-room-line');
          const name = line?.querySelector('.fpe-resource-row > span');
          const lineRect = line?.getBoundingClientRect();
          const nameRect = name?.getBoundingClientRect();
          return lineRect && nameRect ? Math.round(nameRect.left - lineRect.left) : 0;
        })(),
        groups: document.querySelectorAll('.fpe-resource-group__head').length,
        groupChevrons: document.querySelectorAll('.fpe-resource-group__head .icon').length,
        flat: !!document.querySelector('.fpe-resource-tree--flat'),
        roomRows: document.querySelectorAll('.fpe-resource-row:not(.fpe-resource-row--asset)').length,
        roomDisclosures: document.querySelectorAll('.fpe-resource-room-toggle').length,
        listMarkers: [...document.querySelectorAll('.fpe-resource-tree li')]
          .filter(node => getComputedStyle(node).listStyleType !== 'none').length,
        colorTrigger: document.querySelector('#fpe-color-trigger')?.getAttribute('aria-haspopup') || '',
        colorLabel: document.querySelector('#fpe-color-trigger')?.getAttribute('aria-label') || '',
        panelGlyphs: document.querySelectorAll('.fpe-panel-toggle-icon').length,
      },
      planActions: {
        more: document.querySelector('#fpe-more-trigger')?.getAttribute('aria-haspopup') || '',
        items: document.querySelectorAll('#fpe-more-menu [role="menuitem"]').length,
        historyInToolbar: !!document.querySelector('#fpe-toolbar-host [data-action="version-history"]'),
      },
      viewNavigation: {
        label: document.querySelector('.fpe-view-nav')?.getAttribute('aria-label') || '',
        modes: document.querySelectorAll('.fpe-view-nav [data-view-mode]').length,
        active: document.querySelector('.fpe-view-nav [data-view-mode][aria-pressed="true"]')?.dataset.viewMode || '',
        tabbable: document.querySelectorAll('.fpe-view-nav [data-view-mode][tabindex="0"]').length,
        actions: document.querySelectorAll('.fpe-view-nav__actions [data-action]').length,
        minimumTarget: Math.min(...[...document.querySelectorAll('.fpe-view-nav button')]
          .map(button => button.getBoundingClientRect().height)),
        navigationInTopToolbar: document.querySelectorAll('#fpe-toolbar-host [data-action="zoom-in"],#fpe-toolbar-host [data-action="zoom-out"],#fpe-toolbar-host [data-action="fit"],#fpe-toolbar-host [data-action="fit-selection"],#fpe-toolbar-host [data-action="three-reset"]').length,
      },
      prototypeLabel: document.querySelector('.fpe-local-note')?.getAttribute('aria-label') || '',
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
  check(initial.breadcrumb.length === 3 && initial.breadcrumb[0] === 'Alle Objekte'
    && /Liebefeld/.test(initial.breadcrumb[1]) && initial.breadcrumb[2] === '2. OG'
    && /building=1080%2F6650%2FAA/i.test(initial.hash) && initial.hash.includes(`floor=${FLOOR_ID}`)
    && /building=1080%2F6650%2FAA/i.test(initial.backHref) && !initial.backHref.includes('floor='),
  'preserves the deep link and exposes deterministic editor breadcrumbs', `${initial.breadcrumb.join(' · ')} · ${initial.backHref}`);
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
  check(initial.resourceTree.groups === 0 && initial.resourceTree.groupChevrons === 0 && initial.resourceTree.flat
    && initial.resourceTree.roomRows === initial.roomCount && initial.resourceTree.roomDisclosures === initial.roomCount
    && initial.resourceTree.roomNameInset >= 52 && initial.resourceTree.roomNameInset <= 54
    && initial.resourceTree.listMarkers === 0 && initial.resourceTree.colorTrigger === 'menu'
    && /Keine/.test(initial.resourceTree.colorLabel) && !new URLSearchParams(initial.hash.split('?')[1] || '').has('color')
    && initial.resourceTree.panelGlyphs === 4,
  'defaults to no coloring and renders a flat room tree without synthetic aggregation',
  `${initial.resourceTree.groups} groups · ${initial.resourceTree.roomRows} rooms · ${initial.resourceTree.roomNameInset}px name inset`);
  check(initial.planActions.more === 'menu' && initial.planActions.items === 3
    && !initial.planActions.historyInToolbar && /nur in diesem Browser/i.test(initial.prototypeLabel),
  'separates plan-level actions from canvas tools and keeps the prototype boundary concise',
  `${initial.planActions.items} actions · ${initial.prototypeLabel}`);
  check(initial.viewNavigation.label === 'Ansicht und Navigation'
    && initial.viewNavigation.modes === 3 && initial.viewNavigation.active === '2d'
    && initial.viewNavigation.tabbable === 1 && initial.viewNavigation.actions === 4
    && initial.viewNavigation.minimumTarget >= 44 && initial.viewNavigation.navigationInTopToolbar === 0,
  'separates persistent view navigation from the canvas tool bar with touch-sized controls',
  `${initial.viewNavigation.modes} modes · ${initial.viewNavigation.actions} view actions · ${Math.round(initial.viewNavigation.minimumTarget)}px targets`);
  check(initial.overflow <= 1 && initial.duplicateIds.length === 0
    && initial.unlabeledControls === 0 && initial.unnamedButtons === 0
    && initial.headingJumps.length === 0,
  'keeps the standalone workbench contained and structurally accessible',
  `${initial.overflow}px overflow · ${initial.duplicateIds.length} duplicate IDs · ${initial.headingJumps.join(', ') || 'heading order ok'}`);

  const treeControls = await page.evaluate(`(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 60));
    document.querySelector('#fpe-color-trigger')?.click(); await pause();
    document.querySelector('[data-color-mode="use"]')?.click(); await pause();
    const groupedQuery = new URLSearchParams(location.hash.split('?')[1] || '').get('color') || '';
    const group = document.querySelector('.fpe-resource-group__head');
    const controlledId = group?.getAttribute('aria-controls') || '';
    group?.click(); await pause();
    const collapsed = document.querySelector('.fpe-resource-group__head')?.getAttribute('aria-expanded') === 'false'
      && document.getElementById(controlledId)?.hidden === true;
    document.querySelector('.fpe-resource-group__head')?.click(); await pause();
    const roomToggle = document.querySelector('.fpe-resource-room-toggle');
    const assetsId = roomToggle?.getAttribute('aria-controls') || '';
    roomToggle?.click(); await pause();
    const roomOpened = document.querySelector('.fpe-resource-room-toggle')?.getAttribute('aria-expanded') === 'true'
      && document.getElementById(assetsId)?.hidden === false;
    document.querySelector('.fpe-resource-room-toggle')?.click(); await pause();
    const roomClosed = document.querySelector('.fpe-resource-room-toggle')?.getAttribute('aria-expanded') === 'false'
      && document.getElementById(assetsId)?.hidden === true;
    document.querySelector('#fpe-color-trigger')?.click(); await pause();
    const menuOpen = document.querySelector('#fpe-color-trigger')?.getAttribute('aria-expanded') === 'true'
      && !document.querySelector('.fpe-color-menu')?.hidden;
    const menu = document.querySelector('.fpe-color-menu');
    const stageRect = document.querySelector('#fpe-stage')?.getBoundingClientRect();
    const menuRect = menu?.getBoundingClientRect();
    const overlapPoint = stageRect && menuRect
      ? { x: Math.max(stageRect.left + 4, menuRect.left + 4), y: menuRect.top + 20 }
      : null;
    const menuAboveCanvas = overlapPoint && overlapPoint.x < menuRect.right
      && document.elementFromPoint(overlapPoint.x, overlapPoint.y)?.closest('.fpe-color-menu') === menu;
    const menuPosition = menu ? getComputedStyle(menu).position : '';
    document.querySelector('[data-color-mode="sia"]')?.click(); await pause();
    const siaQuery = new URLSearchParams(location.hash.split('?')[1] || '').get('color') || '';
    document.querySelector('#fpe-color-trigger')?.click(); await pause();
    document.querySelector('[data-color-mode="none"]')?.click(); await pause();
    const finalQuery = new URLSearchParams(location.hash.split('?')[1] || '').get('color') || '';
    const finalFlat = !!document.querySelector('.fpe-resource-tree--flat');
    const finalGroups = document.querySelectorAll('.fpe-resource-group__head').length;
    const colorTrigger = document.querySelector('#fpe-color-trigger');
    colorTrigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); await pause();
    const colorFocus = document.activeElement?.dataset.colorMode || '';
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); await pause();
    const colorNextFocus = document.activeElement?.dataset.colorMode || '';
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await pause();
    const colorFocusReturned = document.activeElement?.id === 'fpe-color-trigger';
    const more = document.querySelector('#fpe-more-trigger');
    more?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); await pause();
    const moreOpen = more?.getAttribute('aria-expanded') === 'true'
      && document.activeElement?.matches('#fpe-more-menu [role="menuitem"]');
    const firstAction = document.activeElement?.dataset.action || '';
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); await pause();
    const secondAction = document.activeElement?.dataset.action || '';
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await pause();
    const moreFocusReturned = document.activeElement?.id === 'fpe-more-trigger';
    return { groupedQuery, collapsed, roomOpened, roomClosed, menuOpen, menuAboveCanvas, menuPosition, siaQuery, finalQuery, finalFlat, finalGroups,
      colorFocus, colorNextFocus, colorFocusReturned, moreOpen, firstAction, secondAction, moreFocusReturned,
      expanded: document.querySelector('.fpe-resource-group__head')?.getAttribute('aria-expanded') || '' };
  })()`);
  check(treeControls.groupedQuery === 'use' && treeControls.collapsed && treeControls.roomOpened && treeControls.roomClosed
    && treeControls.menuOpen && treeControls.siaQuery === 'sia'
    && !treeControls.finalQuery && treeControls.finalFlat && treeControls.finalGroups === 0,
  'aggregates only for an explicit color mode and returns to the flat default list',
  `group collapsed/reopened · room opened/closed · color=${treeControls.siaQuery} → default`);
  check(treeControls.menuAboveCanvas && treeControls.menuPosition === 'fixed'
    && treeControls.colorFocus === 'none' && treeControls.colorNextFocus === 'use'
    && treeControls.colorFocusReturned && treeControls.moreOpen
    && treeControls.firstAction === 'version-history' && treeControls.secondAction === 'copy-link'
    && treeControls.moreFocusReturned,
  'keeps the color menu above the canvas and provides keyboard navigation with focus return',
  `${treeControls.colorFocus} → ${treeControls.colorNextFocus} · ${treeControls.firstAction} → ${treeControls.secondAction}`);

  console.log('\n■ Direct mouse and touch navigation');
  const directPan = await page.evaluate(`(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 80));
    const camera = () => (document.querySelector('#fpe-canvas')?.getAttribute('viewBox') || '')
      .split(/\\s+/).map(Number);
    const selectedQuery = () => new URLSearchParams(location.hash.split('?')[1] || '').get('selected') || '';
    const gesture = async (pointerType, pointerId, dx, dy) => {
      const node = document.querySelector('.fpe-room[data-id=${JSON.stringify(ROOM_ID)}]');
      const rect = node?.getBoundingClientRect();
      if (!node || !rect) return { prevented: false };
      const start = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const common = { bubbles: true, cancelable: true, pointerId, pointerType, button: 0 };
      const prevented = !node.dispatchEvent(new PointerEvent('pointerdown', {
        ...common, buttons: 1, clientX: start.x, clientY: start.y,
      }));
      document.querySelector('#fpe-stage')?.dispatchEvent(new PointerEvent('pointermove', {
        ...common, buttons: 1, clientX: start.x + dx, clientY: start.y + dy,
      }));
      await pause();
      document.querySelector('#fpe-canvas')?.dispatchEvent(new PointerEvent('pointerup', {
        ...common, buttons: 0, clientX: start.x + dx, clientY: start.y + dy,
      }));
      await pause();
      return { prevented };
    };
    const before = camera();
    const selectionBefore = selectedQuery();
    const mouse = await gesture('mouse', 71, 72, 32);
    const afterMouse = camera();
    const selectionAfterMouse = selectedQuery();
    const touch = await gesture('touch', 72, -48, -26);
    const afterTouch = camera();
    return {
      before, afterMouse, afterTouch, mouse, touch, selectionBefore, selectionAfterMouse,
      selectionAfterTouch: selectedQuery(),
      touchAction: getComputedStyle(document.querySelector('#fpe-stage')).touchAction,
      cursor: getComputedStyle(document.querySelector('#fpe-stage')).cursor,
    };
  })()`);
  const cameraMoved = (from, to) => Array.isArray(from) && Array.isArray(to)
    && from.length === 4 && to.length === 4
    && (Math.abs(from[0] - to[0]) > .1 || Math.abs(from[1] - to[1]) > .1);
  check(directPan.mouse.prevented && directPan.touch.prevented
    && cameraMoved(directPan.before, directPan.afterMouse)
    && cameraMoved(directPan.afterMouse, directPan.afterTouch)
    && directPan.selectionBefore === directPan.selectionAfterMouse
    && directPan.selectionBefore === directPan.selectionAfterTouch
    && directPan.touchAction === 'none' && directPan.cursor === 'grab',
  'pans directly with primary-button drag and one-finger Pointer Events without turning the drag into selection',
  `mouse ${directPan.before.slice(0, 2).map(Math.round).join('/')} → ${directPan.afterMouse.slice(0, 2).map(Math.round).join('/')} · touch → ${directPan.afterTouch.slice(0, 2).map(Math.round).join('/')}`);

  console.log('\n■ Camera scale and interactive Three.js modes');
  const views = await page.evaluate(`(async () => {
    const pause = (duration = 100) => new Promise(resolve => setTimeout(resolve, duration));
    const click = selector => document.querySelector(selector)?.click();
    const scale = () => ({
      label: document.querySelector('#fpe-scale span')?.textContent.trim() || '',
      width: parseFloat(document.querySelector('#fpe-scale i')?.style.width || '0'),
      metres: parseFloat(document.querySelector('#fpe-scale span')?.textContent || '0'),
    });
    const before = scale();
    click('[data-action="zoom-in"]'); await pause();
    const zoomed = scale();
    const twoDMode = document.querySelector('[data-view-mode="2d"]');
    twoDMode?.focus();
    twoDMode?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await pause(350);
    const keyboardThreeD = document.activeElement?.dataset.viewMode || '';
    const threeHost = document.querySelector('#fpe-three-host');
    const threeCanvas = document.querySelector('.fpe-three-canvas');
    const orbitBefore = threeHost?.dataset.camera || '';
    threeCanvas?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -180 }));
    await pause();
    const orbitAfter = threeHost?.dataset.camera || '';
    document.querySelector('.fpe-resource-row:not(.fpe-resource-row--asset)')?.click();
    await pause(350);
    const rebuiltThreeHost = document.querySelector('#fpe-three-host');
    const rebuiltThreeCanvas = document.querySelector('.fpe-three-canvas');
    const threeD = {
      active: document.querySelector('[data-action="view-3d"]')?.getAttribute('aria-pressed') || '',
      renderer: rebuiltThreeHost?.dataset.renderer || '',
      controls: rebuiltThreeHost?.dataset.controls || '',
      rooms: Number(rebuiltThreeHost?.dataset.rooms || 0),
      placements: Number(rebuiltThreeHost?.dataset.placements || 0),
      canvas: { width: rebuiltThreeCanvas?.width || 0, height: rebuiltThreeCanvas?.height || 0 },
      orbitMoved: Boolean(orbitBefore && orbitBefore !== orbitAfter),
      cameraPreserved: Boolean(orbitAfter && orbitAfter === (rebuiltThreeHost?.dataset.camera || '')),
      hintCards: document.querySelectorAll('.fpe-three-status,.fpe-three-help').length,
      view: new URLSearchParams(location.hash.split('?')[1] || '').get('view') || '',
      twoDCanvas: !!document.querySelector('#fpe-canvas'),
      reset: !!document.querySelector('[data-action="three-reset"]'),
      resetInViewNavigation: !!document.querySelector('.fpe-view-nav__actions [data-action="three-reset"]'),
      topToolbarEmpty: !document.querySelector('#fpe-toolbar-host button'),
    };
    click('[data-action="view-walk"]'); await pause(350);
    const walkHost = document.querySelector('#fpe-three-host');
    const walkCanvas = document.querySelector('.fpe-three-canvas');
    walkCanvas?.focus();
    const walkBefore = walkHost?.dataset.camera || '';
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
    await pause(180);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));
    await pause(50);
    const walk = {
      active: document.querySelector('[data-action="view-walk"]')?.getAttribute('aria-pressed') || '',
      classed: document.querySelector('.fpe-three-view')?.classList.contains('is-walk') || false,
      renderer: walkHost?.dataset.renderer || '',
      controls: walkHost?.dataset.controls || '',
      moved: Boolean(walkBefore && walkBefore !== (walkHost?.dataset.camera || '')),
      reticle: !!document.querySelector('.fpe-walk-reticle'),
      view: new URLSearchParams(location.hash.split('?')[1] || '').get('view') || '',
    };
    const activeWalkMode = document.querySelector('[data-view-mode="walk"]');
    activeWalkMode?.focus();
    activeWalkMode?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await pause();
    const keyboardTwoD = document.activeElement?.dataset.viewMode || '';
    return { before, zoomed, threeD, walk,
      twoD: !!document.querySelector('#fpe-canvas'),
      finalView: new URLSearchParams(location.hash.split('?')[1] || '').get('view') || '',
      keyboardThreeD, keyboardTwoD };
  })()`);
  check(views.before.label && views.before.width > 0 && views.before.metres > 0
    && views.zoomed.label && views.zoomed.width > 0 && views.zoomed.metres > 0
    && views.zoomed.width / views.zoomed.metres > views.before.width / views.before.metres,
  'recalculates the scale bar when the camera zoom changes',
  `${views.before.label}/${Math.round(views.before.width)}px → ${views.zoomed.label}/${Math.round(views.zoomed.width)}px`);
  check(views.threeD.active === 'true' && /^Three\.js r\d+/.test(views.threeD.renderer)
    && /orbit/.test(views.threeD.controls) && views.threeD.rooms === initial.roomCount
    && views.threeD.placements === initial.placementCount && views.threeD.canvas.width > 0
    && views.threeD.canvas.height > 0 && views.threeD.orbitMoved && views.threeD.cameraPreserved && views.threeD.view === '3d'
    && !views.threeD.twoDCanvas && views.threeD.reset && views.threeD.resetInViewNavigation
    && views.threeD.topToolbarEmpty && views.threeD.hintCards === 0 && views.keyboardThreeD === '3d',
  'builds the live Three.js model and preserves its camera across selection redraws',
  `${views.threeD.renderer} · ${views.threeD.rooms} rooms · ${views.threeD.placements} objects`);
  check(views.walk.active === 'true' && views.walk.classed && /^Three\.js r\d+/.test(views.walk.renderer)
    && /keyboard-walk/.test(views.walk.controls) && views.walk.moved && views.walk.reticle && views.walk.view === 'walk'
    && views.twoD && !views.finalView && views.keyboardTwoD === '2d',
  'walks through the generated floor and returns through keyboard-operable view navigation');

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
    const editState = document.querySelector('.fpe-edit-state');
    const editHeader = editState?.closest('.fpe-header');
    const stateRect = editState?.getBoundingClientRect();
    const headerRect = editHeader?.getBoundingClientRect();
    const entry = {
      libraryOpen: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
      libraryQuery: new URLSearchParams(location.hash.split('?')[1] || '').get('library') || '',
      toolbarActions: [...document.querySelectorAll('#fpe-toolbar-host [data-action]')].map(node => node.dataset.action),
      addPressed: document.querySelector('[data-action="toggle-library"]')?.getAttribute('aria-pressed') || '',
    };
    fire(document.querySelector('[data-action="toggle-library"]')); await pause();
    const opened = {
      libraryOpen: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
      libraryQuery: new URLSearchParams(location.hash.split('?')[1] || '').get('library') || '',
      addPressed: document.querySelector('[data-action="toggle-library"]')?.getAttribute('aria-pressed') || '',
    };
    const productsTab = document.querySelector('[data-library="products"]');
    productsTab?.focus();
    productsTab?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await pause();
    const modulesViaKeyboard = document.querySelector('[data-library="modules"]')?.getAttribute('aria-selected') === 'true'
      && document.activeElement?.dataset.library === 'modules';
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); await pause();
    const productsViaKeyboard = document.querySelector('[data-library="products"]')?.getAttribute('aria-selected') === 'true'
      && document.activeElement?.dataset.library === 'products';
    fire(document.querySelector('[data-action="clear-selection"]')); await pause();
    const stagedProduct = document.querySelector('.fpe-product[data-product]');
    if (!stagedProduct) return { error: 'product library is empty before placement staging' };
    fire(stagedProduct); await pause();
    const staged = {
      libraryOpen: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
      libraryQuery: new URLSearchParams(location.hash.split('?')[1] || '').get('library') || '',
      addPressed: document.querySelector('[data-action="toggle-library"]')?.getAttribute('aria-pressed') || '',
      stageFocused: document.activeElement?.id === 'fpe-stage',
    };
    fire(document.querySelector('[data-action="tool-select"]')); await pause();
    fire(document.querySelector('[data-action="toggle-library"]')); await pause();
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
      editStateInHeader: !!editHeader,
      editStateInContext: !!editState?.closest('.fpe-context'),
      editStateCenterDelta: stateRect && headerRect
        ? Math.abs((stateRect.left + stateRect.right) / 2 - (headerRect.left + headerRect.right) / 2)
        : Number.POSITIVE_INFINITY,
      entry, opened, staged,
      libraryKeyboard: modulesViaKeyboard && productsViaKeyboard,
      library: document.querySelector('#fpe-left')?.getAttribute('aria-label') || '',
      libraryOpenAfterPlacement: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
      libraryQueryAfterPlacement: new URLSearchParams(location.hash.split('?')[1] || '').get('library') || '',
      addPressedAfterPlacement: document.querySelector('[data-action="toggle-library"]')?.getAttribute('aria-pressed') || '',
      before, after: document.querySelectorAll('.fpe-placement').length,
      productId, localId: local?.dataset.id || '',
      selected: document.querySelector('.fpe-placement.is-selected')?.dataset.id || '',
      inspector: document.querySelector('#fpe-right')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      undoEnabled: !document.querySelector('[data-action="undo"]')?.disabled,
      saveEnabled: !document.querySelector('[data-action="save"]')?.disabled,
    };
  })()`);
  check(!added.error && added.editing && added.library === 'Produktbibliothek'
    && added.editStateInHeader && !added.editStateInContext && added.editStateCenterDelta <= 1
    && !added.entry.libraryOpen && !added.entry.libraryQuery && added.entry.addPressed === 'false'
    && added.entry.toolbarActions.join(',') === 'toggle-library,tool-select,tool-distance,tool-area,toggle-structure-menu,undo,redo,version-history'
    && added.opened.libraryOpen && added.opened.libraryQuery === 'products' && added.opened.addPressed === 'true'
    && !added.staged.libraryOpen && !added.staged.libraryQuery && added.staged.addPressed === 'true' && added.staged.stageFocused
    && added.libraryKeyboard && !added.libraryOpenAfterPlacement && !added.libraryQueryAfterPlacement
    && added.addPressedAfterPlacement === 'false',
  'starts edit mode with the wireframe toolbar and opens the library only through Add',
  added.error || `${added.library} · center delta ${added.editStateCenterDelta}px`);
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
    const inspector = document.querySelector('#fpe-right');
    if (inspector) inspector.scrollTop = Math.min(260, inspector.scrollHeight - inspector.clientHeight);
    const scrollBefore = inspector?.scrollTop || 0;
    input.value = ${JSON.stringify(EDITED_OCCUPIER)};
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
    return {
      value: document.querySelector('[data-room-field="occupierVe"]')?.value || '',
      selected: document.querySelector('.fpe-room.is-selected')?.dataset.id || '',
      placements: document.querySelectorAll('.fpe-placement').length,
      scrollBefore, scrollAfter: document.querySelector('#fpe-right')?.scrollTop || 0,
      canonicalBefore, canonicalAfter: JSON.stringify(canonical()),
      saveEnabled: !document.querySelector('[data-action="save"]')?.disabled,
    };
  })()`);
  check(!roomEdit.error && roomEdit.value === EDITED_OCCUPIER && roomEdit.selected === ROOM_ID
    && roomEdit.placements === added.after && roomEdit.saveEnabled
    && roomEdit.scrollBefore > 0 && Math.abs(roomEdit.scrollAfter - roomEdit.scrollBefore) <= 1,
  'changes a room attribute without losing the redone placement or inspector position',
  roomEdit.error || `${roomEdit.selected} · ${roomEdit.value}`);
  check(roomEdit.canonicalBefore === initial.canonicalRoom
    && roomEdit.canonicalAfter === initial.canonicalRoom,
  'keeps the in-memory canonical core space unchanged while editing');

  console.log('\n■ Constrained structural-editing and module feedback flow');
  const structure = await page.evaluate(`(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 80));
    const click = selector => document.querySelector(selector)?.click();
    const before = document.querySelectorAll('.fpe-room[data-id]').length;
    const trigger = document.querySelector('#fpe-structure-trigger');
    trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); await pause();
    const menuKeyboard = trigger?.getAttribute('aria-expanded') === 'true'
      && document.activeElement?.matches('#fpe-structure-menu [role="menuitem"]:not([disabled])');
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); await pause();
    const lockViaKeyboard = document.activeElement?.dataset.action === 'toggle-structure-lock';
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await pause();
    const structureFocusReturned = document.activeElement?.id === 'fpe-structure-trigger';
    click('#fpe-structure-trigger'); await pause();
    const unavailableTools = document.querySelectorAll('#fpe-structure-menu [role="menuitem"][disabled]').length;
    click('[data-action="toggle-structure-lock"]'); await pause();
    const locked = document.querySelector('#fpe-app')?.classList.contains('is-structure-locked')
      && !!document.querySelector('[data-room-geometry][disabled]')
      && document.querySelectorAll('.fpe-room [data-room-handle]').length === 0;
    click('#fpe-structure-trigger'); await pause();
    click('[data-action="toggle-structure-lock"]'); await pause();
    click('#fpe-structure-trigger'); await pause();
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
    click('[data-action="focus-search"]'); await pause();
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
      roomModule: document.querySelector('[data-room-field="moduleId"]')?.value || '',
      menuKeyboard, lockViaKeyboard, structureFocusReturned, unavailableTools, locked,
      libraryOpen: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
      library: new URLSearchParams(location.hash.split('?')[1] || '').get('library') || '',
      selectedQuery: new URLSearchParams(location.hash.split('?')[1] || '').get('selected') || '',
      width: document.querySelector('[data-room-geometry="width"]')?.value || '',
      saveEnabled: !document.querySelector('[data-action="save"]')?.disabled,
      prematurelyStored: stored?.rooms?.some(room => room.spaceId === localId) || false,
    };
  })()`);
  check(!structure.error && structure.after === structure.before + 1
    && /^local-room-/.test(structure.localId) && structure.selected === structure.localId
    && structure.initialHandles === 8 && structure.handles === 8
    && structure.menuKeyboard && structure.lockViaKeyboard && structure.structureFocusReturned
    && structure.unavailableTools === 10 && structure.locked,
  'exposes the structural-edit menu, lock state, and rectangular area tool accessibly',
  structure.error || `${structure.before} → ${structure.after} · ${structure.localId}`);
  check(structure.roomModule === '1' && !structure.libraryOpen && !structure.library
    && structure.selectedQuery === `room:${structure.localId}` && structure.width === '200'
    && structure.saveEnabled && !structure.prematurelyStored,
  'opens the contextual library from the inspector, assigns a module, and closes it after completion',
  `module ${structure.roomModule} · ${structure.width} cm`);

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

  console.log('\n■ Narrow editor panels and return to editor navigation');
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 320, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await sleep(200);
  const mobile = await page.evaluate(`(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 60));
    const overflow = () => Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      document.body.scrollWidth - document.body.clientWidth,
    );
    const panelVisibility = side => getComputedStyle(document.querySelector('#fpe-' + side)).visibility;
    const state = () => ({
      hasLeft: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
      hasRight: document.querySelector('#fpe-app')?.classList.contains('has-right') || false,
      pressed: document.querySelector('[data-action="toggle-left"]')?.getAttribute('aria-pressed') || '',
      visibility: panelVisibility('left'), rightVisibility: panelVisibility('right'), overflow: overflow(),
      backdrop: getComputedStyle(document.querySelector('.fpe-panel-backdrop')).display !== 'none',
    });
    const before = state();
    document.querySelector('[data-action="toggle-left"]')?.click(); await pause();
    const shown = state();
    document.querySelector('[data-action="toggle-left"]')?.click(); await pause();
    const hidden = state();
    document.querySelector('[data-action="toggle-left"]')?.click(); await pause();
    const restored = state();
    document.querySelector('[data-action="toggle-right"]')?.click(); await pause();
    const right = state();
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await pause();
    const dismissed = state();
    return { before, hidden, shown, restored, right, dismissed, viewport: document.documentElement.clientWidth };
  })()`);
  check([mobile.before, mobile.hidden, mobile.shown, mobile.restored].every(state => state.overflow <= 1)
    && mobile.viewport >= 300 && mobile.viewport <= 320,
  'keeps the 320px editor inside the document viewport through panel redraws',
  `${mobile.viewport}px viewport · ${Math.max(mobile.before.overflow, mobile.hidden.overflow, mobile.shown.overflow)}px overflow`);
  check(!mobile.before.hasLeft && mobile.before.pressed === 'false'
    && mobile.shown.hasLeft && mobile.shown.pressed === 'true' && mobile.shown.visibility === 'visible'
    && !mobile.hidden.hasLeft && mobile.hidden.pressed === 'false' && mobile.hidden.visibility === 'hidden'
    && mobile.restored.hasLeft && mobile.restored.pressed === 'true',
  'enters compact mode closed, then opens and restores the contextual library drawer with matching aria state',
  `${mobile.before.pressed} → ${mobile.shown.pressed} → ${mobile.hidden.pressed} → ${mobile.restored.pressed}`);
  check(mobile.restored.backdrop && mobile.right.hasRight && !mobile.right.hasLeft
    && mobile.right.rightVisibility === 'visible' && mobile.right.visibility === 'hidden'
    && !mobile.dismissed.hasLeft && !mobile.dismissed.hasRight && !mobile.dismissed.backdrop,
  'keeps compact drawers mutually exclusive and dismisses them with Escape',
  `left=${mobile.right.hasLeft} · right=${mobile.right.hasRight} → closed`);

  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await sleep(160);
  const desktopPanels = await page.evaluate(`(() => ({
    left: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
    right: document.querySelector('#fpe-app')?.classList.contains('has-right') || false,
    leftWidth: document.querySelector('#fpe-left')?.getBoundingClientRect().width || 0,
    rightWidth: document.querySelector('#fpe-right')?.getBoundingClientRect().width || 0,
  }))()`);
  check(!desktopPanels.left && desktopPanels.right && desktopPanels.leftWidth <= 1 && desktopPanels.rightWidth > 0,
    'returns to the canvas-focused edit layout after leaving compact mode',
    `${Math.round(desktopPanels.leftWidth)}/${Math.round(desktopPanels.rightWidth)}px`);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 320, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await sleep(160);
  const compactReset = await page.evaluate(`(() => ({
    left: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
    right: document.querySelector('#fpe-app')?.classList.contains('has-right') || false,
  }))()`);
  check(!compactReset.left && !compactReset.right,
    'returns to compact mode with both drawers closed');

  await page.evaluate(`document.querySelector('[data-leave][aria-label="Zurück zu allen Geschossen"]')?.click()`);
  check(await waitFor(page, '#fpe-navigation[data-view="floors"]'), 'returns from the canvas to the editor floor navigation');
  const returnedNavigation = await page.evaluate(`(() => {
    const visible = selector => {
      const node = document.querySelector(selector);
      return !!node && getComputedStyle(node).display !== 'none';
    };
    return {
      standalone: document.body.classList.contains('body--standalone-app'),
      canvas: !!document.querySelector('#fpe-canvas'), navigation: !!document.querySelector('#fpe-navigation'),
      portalHeader: visible('#main-header'), portalFooter: visible('#main-footer'),
      h1: document.querySelector('#main-content h1')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      hash: location.hash,
      rows: document.querySelectorAll('[data-nav-row]').length,
      homeHref: document.querySelector('#fpe-home')?.getAttribute('href') || '',
    };
  })()`);
  check(returnedNavigation.standalone && returnedNavigation.navigation && !returnedNavigation.canvas
    && !returnedNavigation.portalHeader && !returnedNavigation.portalFooter,
  'keeps the user inside the standalone Plan-Editor application', returnedNavigation.hash);
  check(/Geschosse/.test(returnedNavigation.h1) && returnedNavigation.rows === 3
    && /building=1080%2F6650%2FAA/i.test(returnedNavigation.hash) && !returnedNavigation.hash.includes('floor=')
    && returnedNavigation.homeHref === '#/app/floorplan-editor',
  'returns to the matching building floor list with a stable app-home breadcrumb', `${returnedNavigation.h1} · ${returnedNavigation.hash}`);

  await page.evaluate(`document.querySelector('#fpe-home')?.click()`);
  check(await waitFor(page, '#fpe-navigation[data-view="buildings"]'), 'brand link opens the editor building navigation');
  const home = await page.evaluate(`(() => {
    const main = document.querySelector('.fpe-nav-main');
    return {
      hash: location.hash, rows: document.querySelectorAll('[data-nav-row]').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      tableScrolls: !!main && main.scrollWidth > main.clientWidth,
      tabindex: main?.getAttribute('tabindex') || '', role: main?.getAttribute('role') || '',
    };
  })()`);
  check(home.hash === '#/app/floorplan-editor' && home.rows === 7 && home.overflow <= 1,
    'keeps the Plan-Editor root deterministic on mobile', `${home.hash} · ${home.rows} buildings · ${home.overflow}px overflow`);
  check(home.tableScrolls && home.tabindex === '0' && home.role === 'group',
    'makes the narrow building table a named keyboard-scroll region', `${home.tabindex} · ${home.role}`);

  await checkProblems(page, 'complete editor flow has no runtime problems');
} finally {
  if (page) {
    try { await page.closeTarget(); } catch { /* browser may already be closing */ }
  }
  cdp.close();
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
