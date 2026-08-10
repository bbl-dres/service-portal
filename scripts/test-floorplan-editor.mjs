// Standalone floor-plan editor regression: the two landing views (work queue
// and map-first portfolio), direct deep links, portal-shell isolation,
// selection/inspector state, browser-local editing, and responsive panel
// lifecycle. The editor remains a separate micro-app from the read-only
// Workspace portal and the plan checker.
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
const HISTORY_KEY_PREFIX = `bbl_floorplan_editor_history_v1:${encodeURIComponent(FLOOR_ID)}:`;
const HISTORY_INDEX_KEY = `bbl_floorplan_editor_history_v1:index:${encodeURIComponent(FLOOR_ID)}`;
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

  console.log('\n■ Plan-Editor landing: map-first Portfolio');
  page = await openPage(cdp, `${APP_BASE}/`, { login: true });
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await cdp.send('Page.navigate', { url: `${APP_BASE}/app/floorplan-editor` }, page.sessionId);
  await sleep(700);
  check(await waitFor(page, '#fpe-navigation[data-view="portfolio"]'),
    'opens the map-first portfolio as the landing route');
  const browse = await page.evaluate(`(async () => {
    const text = node => (node?.textContent || '').split(/\\s+/).join(' ').trim();
    const deadline = performance.now() + 6000;
    while (!document.querySelector('#fpe-browse-map canvas') && performance.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const map = document.querySelector('#fpe-browse-map');
    const rect = map?.getBoundingClientRect() || { width: 0, height: 0 };
    return {
      hash: location.hash,
      standalone: document.body.classList.contains('body--standalone-app'),
      views: [...document.querySelectorAll('.fpe-viewnav__item')].map(text),
      activeView: text(document.querySelector('.fpe-viewnav__item.is-active')),
      // The bar is the portal's shared catalogue bar, not a local reimplementation.
      catbar: {
        present: !!document.querySelector('.fpe-browse__bar .catbar'),
        search: !!document.querySelector('#fpe-browse-q'),
        sort: [...document.querySelectorAll('#fpe-browse-sort option')].length,
        filter: !!document.querySelector('#fpe-browse-filter-btn'),
        views: [...document.querySelectorAll('.fpe-browse__bar .view-switch__btn')].map(b => b.dataset.view),
        count: text(document.querySelector('#fpe-browse-count')),
        localSearchField: document.querySelectorAll('.fpe-browse__search').length,
      },
      mapCanvas: !!map?.querySelector('canvas'),
      mapWidth: Math.round(rect.width), mapHeight: Math.round(rect.height),
      // No overlay legend floating on the drawing any more.
      overlaySummary: document.querySelectorAll('.fpe-browse__summary, .fpe-browse__legend').length,
      // The right column is a statistics dashboard, not an object inspector.
      stats: {
        figures: [...document.querySelectorAll('#fpe-browse-stats .kpi-strip__label')].map(text),
        scope: text(document.querySelector('#fpe-browse-stats .fpe-overline')),
        states: [...document.querySelectorAll('#fpe-browse-stats .fpe-stats__state-count')].map(text),
        detailPanel: document.querySelectorAll('.fpe-browse__detail').length,
      },
      tree: {
        objects: document.querySelectorAll('.fpe-browse__tree .pf-tree__leaf').length,
        floors: document.querySelectorAll('.fpe-browse__tree .pf-tree__sub').length,
        expandable: document.querySelectorAll('.fpe-browse__tree .pf-tree__leaf--parent').length,
      },
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      duplicateIds: [...document.querySelectorAll('[id]')].map(node => node.id).filter((id, index, ids) => ids.indexOf(id) !== index),
      unlabeledControls: [...document.querySelectorAll('input,select,button')].filter(node => !node.disabled
        && !node.getAttribute('aria-label') && !node.getAttribute('title') && !node.labels?.length && !node.textContent.trim()).length,
    };
  })()`);
  check(browse.hash === '#/app/floorplan-editor' && browse.standalone
    && browse.activeView === 'Portfolio' && browse.views[0] === 'Portfolio' && browse.views[1] === 'Meine Arbeit',
  'makes the portfolio the default view and offers the work queue as its peer', browse.views.join(' | '));
  check(browse.catbar.present && browse.catbar.search && browse.catbar.filter
    && browse.catbar.sort >= 4 && browse.catbar.localSearchField === 0
    && browse.catbar.views.join(',') === 'map,cards,list' && /7 von 7 Objekten/.test(browse.catbar.count),
  'reuses the portal catalogue bar instead of a local search and mode switch',
  `${browse.catbar.views.join(',')} · ${browse.catbar.count}`);
  check(browse.mapCanvas && browse.mapWidth > 400 && browse.mapHeight > 300 && browse.overlaySummary === 0,
    'defaults to the map and keeps no summary overlay on the drawing',
    `${browse.mapWidth}×${browse.mapHeight}px · ${browse.overlaySummary} overlays`);
  check(browse.stats.figures.join(',') === 'Objekte,Geschosse,Räume,Arbeitsplätze'
    && browse.stats.scope === 'Alle Objekte' && browse.stats.states.join(',') === '6,1,0'
    && browse.stats.detailPanel === 0,
  'uses the right column as a statistics dashboard rather than an object inspector',
  `${browse.stats.scope} · ${browse.stats.states.join('/')}`);
  check(browse.tree.objects === 7 && browse.tree.expandable === 7 && browse.tree.floors === 13,
    'adds the floors of a building as their own level in the location tree',
    `${browse.tree.objects} objects · ${browse.tree.floors} floors`);
  check(browse.overflow <= 1 && browse.duplicateIds.length === 0 && browse.unlabeledControls === 0,
    'renders the landing without overflow or unlabelled controls',
    `${browse.overflow}px · ${browse.duplicateIds.length} duplicate IDs · ${browse.unlabeledControls} unnamed controls`);

  const treePick = await page.evaluate(`(async () => {
    const text = node => (node?.textContent || '').split(/\\s+/).join(' ').trim();
    document.querySelector('.fpe-browse__tree [data-obj="1080/6650/AA"]')?.click();
    const deadline = performance.now() + 5000;
    while (!document.querySelector('.maplibregl-popup-content .fpe-popup') && performance.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const popup = document.querySelector('.maplibregl-popup-content .fpe-popup');
    return {
      hash: location.hash,
      // Object details and actions live in the marker popup.
      popupName: text(popup?.querySelector('.fpe-popup__name')),
      popupFloors: popup ? popup.querySelectorAll('.fpe-popup__floor').length : 0,
      popupOpen: popup?.querySelector('.fpe-popup__actions .btn--filled')?.getAttribute('href') || '',
      popupCheck: popup?.querySelector('.fpe-popup__actions .btn--outline')?.getAttribute('href') || '',
      popupNotes: popup ? [...popup.querySelectorAll('.fpe-popup__notes li')].map(text) : [],
      // The statistics follow the selection instead of being replaced by it.
      statsScope: text(document.querySelector('#fpe-browse-stats .fpe-overline')),
      statsObjects: text(document.querySelector('#fpe-browse-stats .kpi-strip__value')),
      pills: [...document.querySelectorAll('#fpe-browse-activefilters .active-filter')].map(text),
      reset: !!document.querySelector('#fpe-browse-activefilters [data-reset]'),
    };
  })()`);
  check(/Liebefeld/.test(treePick.popupName) && treePick.popupFloors === 3
    && /building=1080%2F6650%2FAA/i.test(treePick.popupOpen)
    && /plan-check\?building=1080%2F6650%2FAA/i.test(treePick.popupCheck)
    && treePick.popupNotes.length > 0,
  'puts the object detail, its floors and both handoffs into the marker popup',
  `${treePick.popupName} · ${treePick.popupFloors} floors · ${treePick.popupNotes.join(' | ')}`);
  check(/obj=1080%2F6650%2FAA/i.test(treePick.hash) && /Liebefeld/.test(treePick.statsScope)
    && treePick.statsObjects === '1' && treePick.pills.length === 1 && treePick.reset,
  'scopes the statistics to the selection and reports it as a removable filter pill',
  `${treePick.statsScope} · ${treePick.pills.join(' | ')}`);

  const floorPick = await page.evaluate(`(() => {
    const item = document.querySelector('.fpe-browse__tree [data-obj="1080/6650/AA"]')?.closest('.pf-tree__item');
    const subs = [...(item?.querySelectorAll('.pf-tree__sub') || [])];
    return {
      labels: subs.map(node => node.textContent.trim()),
      floors: subs.map(node => node.dataset.sub),
      visible: subs.filter(node => node.closest('.pf-tree__children')?.hidden === false).length,
    };
  })()`);
  check(floorPick.labels.join(',') === '2. OG,1. OG,EG' && floorPick.visible === 3
    && floorPick.floors.every(id => id.startsWith('1080-6650-AA')),
  'offers the floors of the selected building directly in the tree, top floor first',
  `${floorPick.labels.join(' · ')}`);

  await cdp.send('Page.navigate', { url: `${APP_BASE}/app/floorplan-editor?mode=list` }, page.sessionId);
  await sleep(500);
  const listMode = await page.evaluate(`(async () => {
    const text = node => (node?.textContent || '').split(/\\s+/).join(' ').trim();
    const search = document.querySelector('#fpe-browse-q');
    search.value = 'Liebefeld';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 400));
    const filtered = document.querySelectorAll('[data-browse-row]').length;
    const count = text(document.querySelector('#fpe-browse-count'));
    const pills = [...document.querySelectorAll('#fpe-browse-activefilters .active-filter')].map(text);
    document.querySelector('#fpe-browse-activefilters [data-reset]')?.click();
    await new Promise(resolve => setTimeout(resolve, 400));
    return {
      filtered, count, pills,
      restored: document.querySelectorAll('[data-browse-row]').length,
      caption: text(document.querySelector('.fpe-browse__table caption')),
      mapMounted: !!document.querySelector('#fpe-browse-map'),
    };
  })()`);
  check(listMode.filtered === 1 && listMode.restored === 7 && /1 von 7 Objekten/.test(listMode.count)
    && listMode.pills.length === 1 && !listMode.mapMounted,
  'filters the list through the shared search and clears it through the pill row',
  `${listMode.filtered}/7 · ${listMode.count} · ${listMode.pills.join(' | ')}`);
  check(/Objekte/.test(listMode.caption), 'labels the object table for assistive technology', listMode.caption);

  await cdp.send('Page.navigate', {
    url: `${APP_BASE}/app/floorplan-editor?building=${encodeURIComponent(BUILDING_ID)}`,
  }, page.sessionId);
  await sleep(700);
  check(await waitFor(page, '#fpe-navigation[data-view="portfolio"]'),
    'resolves a building deep link into the portfolio view');
  const deepLink = await page.evaluate(`(() => ({
    scope: (document.querySelector('#fpe-browse-stats .fpe-overline')?.textContent || '').trim(),
    treeActive: (document.querySelector('.fpe-browse__tree .is-active')?.textContent || '').trim(),
  }))()`);
  check(/Liebefeld/.test(deepLink.scope) && /Verwaltungsge/.test(deepLink.treeActive),
    'preselects the deep-linked object in tree and statistics', `${deepLink.scope}`);

  console.log('\n■ Plan-Editor landing: Meine Arbeit');
  await cdp.send('Page.navigate', { url: `${APP_BASE}/app/floorplan-editor?view=work` }, page.sessionId);
  await sleep(600);
  check(await waitFor(page, '#fpe-navigation[data-view="work"]'), 'opens the work queue through the view switch');
  const work = await page.evaluate(`(() => {
    const text = node => (node?.textContent || '').split(/\\s+/).join(' ').trim();
    const row = document.querySelector('#fpe-work-table tbody tr');
    return {
      h1: text(document.querySelector('#fpe-work h1')),
      tabs: [...document.querySelectorAll('.fpe-layer-tabs .tab__control')].map(text),
      activeTab: text(document.querySelector('.fpe-layer-tabs .tab__control--active')),
      // The queue is the shared data table, not a bespoke card list.
      table: {
        catbar: !!document.querySelector('#fpe-work-table .catbar'),
        search: !!document.querySelector('#fpe-tasks-q'),
        filter: !!document.querySelector('#fpe-tasks-filter'),
        headers: [...document.querySelectorAll('#fpe-work-table thead th')].map(text),
        rows: document.querySelectorAll('#fpe-work-table tbody tr').length,
        cardList: document.querySelectorAll('.fpe-work__list').length,
      },
      rowHeight: row ? Math.round(row.getBoundingClientRect().height) : 0,
      markPainted: (() => {
        const svg = document.querySelector('.fpe-work__mark svg');
        return svg ? Math.round(svg.getBoundingClientRect().width) : 0;
      })(),
      recents: document.querySelectorAll('.fpe-recent-strip .fpe-recent').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      duplicateIds: [...document.querySelectorAll('[id]')].map(node => node.id).filter((id, index, ids) => ids.indexOf(id) !== index),
    };
  })()`);
  check(/Meine Arbeit/.test(work.h1) && work.tabs.length === 4 && /Nutzung/.test(work.activeTab)
    && work.tabs.some(label => /noch keine Daten/.test(label)),
  'shows the four attribute layers as tabs and marks the empty ones', work.tabs.join(' | '));
  check(work.table.catbar && work.table.search && work.table.filter && work.table.cardList === 0
    && work.table.headers.join(',') === 'Aufgabe,Befund,Status,Aktion' && work.table.rows > 0,
  'renders the queue as the shared compact table with its own catalogue bar',
  `${work.table.headers.join(',')} · ${work.table.rows} rows`);
  check(work.rowHeight > 0 && work.rowHeight <= 110 && work.markPainted >= 12,
    'keeps a work item to one compact row with a legible severity mark',
    `${work.rowHeight}px · mark ${work.markPainted}px`);
  check(work.recents > 0 && work.overflow <= 1 && work.duplicateIds.length === 0,
    'keeps the recent-plan strip and renders without overflow or duplicate ids',
    `${work.recents} recents · ${work.overflow}px`);

  await cdp.send('Page.navigate', { url: `${APP_BASE}/app/floorplan-editor?view=work&layer=operations` }, page.sessionId);
  await sleep(450);
  const emptyLayer = await page.evaluate(`(() => {
    const text = node => (node?.textContent || '').split(/\\s+/).join(' ').trim();
    return {
      activeTab: text(document.querySelector('.fpe-layer-tabs .tab__control--active')),
      empty: text(document.querySelector('.fpe-work__empty')),
      table: document.querySelectorAll('#fpe-work-table').length,
    };
  })()`);
  check(/Betrieb/.test(emptyLayer.activeTab) && /noch nicht mit Daten/.test(emptyLayer.empty) && emptyLayer.table === 0,
    'explains an attribute layer that carries no data yet instead of showing an empty table', emptyLayer.empty.slice(0, 90));
  await checkProblems(page, 'editor landing has no runtime problems');

  console.log('\n■ Floor-plan editor deep link and standalone shell');
  // Each run starts from the canonical baseline. The same test later proves
  // persistence with a reload, then leaves that one narrowly-scoped draft in
  // place so a developer can inspect it manually.
  await page.evaluate(`(() => {
    localStorage.removeItem(${JSON.stringify(DRAFT_KEY)});
    Object.keys(localStorage)
      .filter(key => key.startsWith(${JSON.stringify(HISTORY_KEY_PREFIX)}))
      .forEach(key => localStorage.removeItem(key));
    localStorage.removeItem(${JSON.stringify(HISTORY_INDEX_KEY)});
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
      import('./js/core/index.js'), import('./js/floorplan-editor/model.js'),
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
    const contrast = (foreground, background) => {
      const channels = value => (value.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
      const luminance = value => channels(value).reduce((sum, channel, index) => {
        const normalized = channel / 255;
        const linear = normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
        return sum + linear * [.2126, .7152, .0722][index];
      }, 0);
      const left = luminance(foreground), right = luminance(background);
      return (Math.max(left, right) + .05) / (Math.min(left, right) + .05);
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
      contextBack: !!document.querySelector('.fpe-context > [data-leave][aria-label="Zurück zu allen Geschossen"]'),
      left: dimensions('#fpe-left'), stage: dimensions('#fpe-stage'), right: dimensions('#fpe-right'),
      roomCount: roomIds.length, expectedRooms: rooms.length, declaredRooms: floor?.rooms || 0,
      uniqueRooms: new Set(roomIds).size,
      placementCount: placementIds.length, expectedPlacements: baseline.placements.length,
      uniquePlacements: new Set(placementIds).size,
      canvasLabel: document.querySelector('#fpe-canvas')?.getAttribute('aria-label') || '',
      canonicalRoom: canonicalRoom ? JSON.stringify(canonicalRoom) : '',
      canonicalOccupier: canonicalRoom?.['occupierVe'] ?? null,
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
        colorIcon: document.querySelector('#fpe-color-trigger .icon')?.style.maskImage || '',
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
        actionsSeparate: !document.querySelector('.fpe-view-nav__actions')?.closest('.fpe-view-nav'),
        actionsOnRight: (() => {
          const actions = document.querySelector('#fpe-view-actions-host')?.getBoundingClientRect();
          const stage = document.querySelector('#fpe-stage')?.getBoundingClientRect();
          return Boolean(actions && stage && actions.left > stage.left + stage.width / 2);
        })(),
        modeIcons: document.querySelectorAll('.fpe-view-nav [data-view-mode] .icon').length,
        planarModeIcons: document.querySelectorAll('.fpe-view-nav :is([data-view-mode="2d"],[data-view-mode="3d"]) .icon').length,
        minimumTarget: Math.min(...[...document.querySelectorAll('.fpe-view-nav button,.fpe-view-nav__actions button')]
          .map(button => button.getBoundingClientRect().height)),
        navigationInTopToolbar: document.querySelectorAll('#fpe-toolbar-host [data-action="zoom-in"],#fpe-toolbar-host [data-action="zoom-out"],#fpe-toolbar-host [data-action="fit"],#fpe-toolbar-host [data-action="fit-selection"],#fpe-toolbar-host [data-action="three-reset"]').length,
      },
      toolIcons: Object.fromEntries(['tool-select', 'tool-pan', 'tool-distance', 'tool-area'].map(action => [action,
        document.querySelector('[data-action="' + action + '"] .icon')?.style.maskImage || ''])),
      designPolish: (() => {
        const inspector = document.querySelector('#fpe-right');
        const toolbar = document.querySelector('.fpe-toolbar');
        const viewModes = document.querySelector('.fpe-view-nav');
        const toolbarStyle = toolbar ? getComputedStyle(toolbar) : null;
        const viewStyle = viewModes ? getComputedStyle(viewModes) : null;
        return {
          inspectorIcons: inspector?.querySelectorAll('.fpe-inspector-title .icon').length || 0,
          redundantHints: /Wählen Sie einen Raum|Klick: auswählen|Links: verschieben|Rechts: drehen/.test(document.querySelector('#fpe-app')?.textContent || ''),
          toolbarBorderContrast: toolbarStyle ? contrast(toolbarStyle.borderTopColor, toolbarStyle.backgroundColor) : 0,
          viewBorderContrast: viewStyle ? contrast(viewStyle.borderTopColor, viewStyle.backgroundColor) : 0,
        };
      })(),
      prototypeFooter: {
        label: document.querySelector('.fpe-local-note > strong')?.textContent.trim() || '',
        icons: document.querySelectorAll('.fpe-local-note .icon').length,
        links: [...document.querySelectorAll('.fpe-local-note a')].map(link => ({
          label: link.textContent.trim(), href: link.href, target: link.target, rel: link.rel,
        })),
        labelLeftOfLinks: (() => {
          const label = document.querySelector('.fpe-local-note > strong')?.getBoundingClientRect();
          const links = document.querySelector('.fpe-local-note nav')?.getBoundingClientRect();
          return Boolean(label && links && label.right <= links.left);
        })(),
      },
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
  check(initial.breadcrumb.length === 3 && initial.breadcrumb[0] === 'Portfolio'
    && /Liebefeld/.test(initial.breadcrumb[1]) && initial.breadcrumb[2] === '2. OG'
    && /building=1080%2F6650%2FAA/i.test(initial.hash) && initial.hash.includes(`floor=${FLOOR_ID}`)
    && !initial.contextBack,
  'preserves the deep link and exposes deterministic editor breadcrumbs without a redundant back button', initial.breadcrumb.join(' · '));
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
    && /Stack\.svg/.test(initial.resourceTree.colorIcon) && initial.resourceTree.panelGlyphs === 5,
  'defaults to no coloring and renders a flat room tree without synthetic aggregation',
  `${initial.resourceTree.groups} groups · ${initial.resourceTree.roomRows} rooms · ${initial.resourceTree.roomNameInset}px name inset`);
  check(initial.planActions.more === 'menu' && initial.planActions.items === 5
    && !initial.planActions.historyInToolbar,
  'separates plan-level actions from canvas tools', `${initial.planActions.items} actions`);
  check(initial.prototypeFooter.label === 'Feedback-Prototyp' && initial.prototypeFooter.icons === 0
    && initial.prototypeFooter.labelLeftOfLinks
    && initial.prototypeFooter.links.map(link => link.label).join(',') === 'Quellcode,Rechtliches,Kontakt'
    && initial.prototypeFooter.links.map(link => link.href).join(',') === [
      'https://github.com/bbl-dres/service-portal',
      'https://www.admin.ch/de/rechtliches',
      'https://www.bbl.admin.ch/de/kontakt',
    ].join(',')
    && initial.prototypeFooter.links.every(link => link.target === '_blank' && /noopener/.test(link.rel)),
  'renders the text-only prototype footer with its label left and project links right');
  check(initial.viewNavigation.label === 'Darstellung wechseln'
    && initial.viewNavigation.modes === 3 && initial.viewNavigation.active === '2d'
    && initial.viewNavigation.tabbable === 1 && initial.viewNavigation.actions === 4
    && initial.viewNavigation.actionsSeparate && initial.viewNavigation.actionsOnRight
    && initial.viewNavigation.modeIcons === 0 && initial.viewNavigation.planarModeIcons === 0
    && initial.viewNavigation.minimumTarget >= 44 && initial.viewNavigation.navigationInTopToolbar === 0,
  'separates the mode switcher from right-side camera controls with consistent text-only modes',
  `${initial.viewNavigation.modes} modes · ${initial.viewNavigation.actions} view actions · ${Math.round(initial.viewNavigation.minimumTarget)}px targets`);
  check(/Pointer\.svg/.test(initial.toolIcons['tool-select'])
    && /Move\.svg/.test(initial.toolIcons['tool-pan'])
    && /Ruler\.svg/.test(initial.toolIcons['tool-distance'])
    && /Crop\.svg/.test(initial.toolIcons['tool-area']),
  'uses purpose-specific select, pan, distance, and area icons from the local icon set');
  check(initial.designPolish.inspectorIcons === 0 && !initial.designPolish.redundantHints
    && initial.designPolish.toolbarBorderContrast >= 3 && initial.designPolish.viewBorderContrast >= 3,
  'keeps inspector chrome icon-free and gives meaningful viewer boundaries non-text contrast',
  `${initial.designPolish.toolbarBorderContrast.toFixed(2)}:1 / ${initial.designPolish.viewBorderContrast.toFixed(2)}:1`);
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
    const collapsedByDefault = group?.getAttribute('aria-expanded') === 'false'
      && document.getElementById(controlledId)?.hidden === true;
    group?.click(); await pause();
    const groupOpened = document.querySelector('.fpe-resource-group__head')?.getAttribute('aria-expanded') === 'true'
      && document.getElementById(controlledId)?.hidden === false;
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
    const siaCollapsed = [...document.querySelectorAll('.fpe-resource-group__head')].every(head =>
      head.getAttribute('aria-expanded') === 'false' && document.getElementById(head.getAttribute('aria-controls'))?.hidden === true);
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
    return { groupedQuery, collapsedByDefault, groupOpened, roomOpened, roomClosed, menuOpen, menuAboveCanvas, menuPosition, siaQuery, siaCollapsed, finalQuery, finalFlat, finalGroups,
      colorFocus, colorNextFocus, colorFocusReturned, moreOpen, firstAction, secondAction, moreFocusReturned,
      expanded: document.querySelector('.fpe-resource-group__head')?.getAttribute('aria-expanded') || '' };
  })()`);
  check(treeControls.groupedQuery === 'use' && treeControls.collapsedByDefault && treeControls.groupOpened
    && treeControls.roomOpened && treeControls.roomClosed
    && treeControls.menuOpen && treeControls.siaQuery === 'sia' && treeControls.siaCollapsed
    && !treeControls.finalQuery && treeControls.finalFlat && treeControls.finalGroups === 0,
  'collapses first-level color groups by default, lets users reveal rooms, and returns to the flat default list',
  `groups collapsed · room opened/closed · color=${treeControls.siaQuery} → default`);
  check(treeControls.menuAboveCanvas && treeControls.menuPosition === 'fixed'
    && treeControls.colorFocus === 'none' && treeControls.colorNextFocus === 'use'
    && treeControls.colorFocusReturned && treeControls.moreOpen
    && treeControls.firstAction === 'version-history' && treeControls.secondAction === 'print'
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
      stageTouchAction: getComputedStyle(document.querySelector('#fpe-stage')).touchAction,
      canvasTouchAction: getComputedStyle(document.querySelector('#fpe-canvas')).touchAction,
      toolbarTouchAction: getComputedStyle(document.querySelector('.fpe-toolbar')).touchAction,
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
    && directPan.canvasTouchAction === 'none' && directPan.stageTouchAction !== 'none'
    && directPan.toolbarTouchAction !== 'none' && directPan.cursor === 'grab',
  'pans directly with primary-button drag and one-finger Pointer Events without turning the drag into selection',
  `mouse ${directPan.before.slice(0, 2).map(Math.round).join('/')} → ${directPan.afterMouse.slice(0, 2).map(Math.round).join('/')} · touch → ${directPan.afterTouch.slice(0, 2).map(Math.round).join('/')}`);

  console.log('\n■ Camera scale and interactive Three.js modes');
  const twoDCameraInput = await page.evaluate(`(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const viewBox = () => (document.querySelector('#fpe-canvas')?.getAttribute('viewBox') || '')
      .split(/\\s+/).map(Number);
    const moved = (left, right, epsilon = .01) => left.length === right.length
      && left.some((value, index) => Math.abs(value - right[index]) > epsilon);
    const same = (left, right, epsilon = .5) => left.length === right.length
      && left.every((value, index) => Math.abs(value - right[index]) <= epsilon);
    const svg = document.querySelector('#fpe-canvas');
    const scene = document.querySelector('#fpe-scene');
    const toolbar = document.querySelector('.fpe-toolbar');
    const bounds = svg?.getBoundingClientRect();
    if (!svg || !scene || !toolbar || !bounds) return { error: '2D gesture surface unavailable' };
    const canvasIdentity = svg;
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;

    const beforeZero = viewBox();
    const zeroAllowed = svg.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, deltaY: 0, clientX: x, clientY: y,
    }));
    await wait(40);
    const afterZero = viewBox();
    const wheelPrevented = !svg.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, deltaY: -12, clientX: x, clientY: y,
    }));
    await wait(60);
    const afterWheel = viewBox();
    const beforeToolbar = viewBox();
    const toolbarAllowed = toolbar.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, deltaY: 120,
    }));
    await wait(40);
    const afterToolbar = viewBox();

    const touch = (type, pointerId, clientX, clientY, buttons) => svg.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId, pointerType: 'touch', button: 0,
      buttons, clientX, clientY,
    }));
    const beforePinch = viewBox();
    touch('pointerdown', 73, x - 40, y, 1);
    touch('pointerdown', 74, x + 40, y, 1);
    touch('pointermove', 73, x - 65, y - 8, 1);
    touch('pointermove', 74, x + 70, y + 8, 1);
    await wait(60);
    const afterPinch = viewBox();
    touch('pointerup', 73, x - 65, y - 8, 0);
    const beforeSingleTouchPan = viewBox();
    touch('pointermove', 74, x + 88, y + 25, 1);
    await wait(50);
    const afterSingleTouchPan = viewBox();
    touch('pointercancel', 74, x + 88, y + 25, 0);
    await wait(40);

    const beforePostGesturePan = viewBox();
    svg.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 75, pointerType: 'mouse', button: 0,
      buttons: 1, clientX: x, clientY: y,
    }));
    svg.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, cancelable: true, pointerId: 75, pointerType: 'mouse', button: 0,
      buttons: 1, clientX: x + 30, clientY: y + 12,
    }));
    svg.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, pointerId: 75, pointerType: 'mouse', button: 0,
      buttons: 0, clientX: x + 30, clientY: y + 12,
    }));
    await wait(60);
    const afterPostGesturePan = viewBox();

    const beforeResize = viewBox();
    const sceneWidth = scene.getBoundingClientRect().width;
    scene.style.width = Math.max(240, sceneWidth * .65) + 'px';
    await wait(160);
    const narrow = viewBox();
    scene.style.width = '';
    await wait(160);
    const restored = viewBox();
    return {
      identityRetained: document.querySelector('#fpe-canvas') === canvasIdentity,
      zeroAllowed, zeroStable: same(beforeZero, afterZero, .001),
      wheelPrevented, wheelContinuous: afterWheel[2] < afterZero[2] && afterWheel[2] > afterZero[2] * .9,
      toolbarAllowed, toolbarStable: same(beforeToolbar, afterToolbar, .001),
      pinchZoomed: afterPinch[2] < beforePinch[2],
      singleTouchContinued: moved(beforeSingleTouchPan, afterSingleTouchPan),
      postGesturePan: moved(beforePostGesturePan, afterPostGesturePan),
      resized: moved(beforeResize, narrow),
      resizeReversible: same(beforeResize, restored),
    };
  })()`);
  check(!twoDCameraInput.error && twoDCameraInput.identityRetained
    && twoDCameraInput.zeroAllowed && twoDCameraInput.zeroStable
    && twoDCameraInput.wheelPrevented && twoDCameraInput.wheelContinuous
    && twoDCameraInput.toolbarAllowed && twoDCameraInput.toolbarStable,
  'updates the 2D camera in place with continuous wheel input scoped to the canvas',
  twoDCameraInput.error || JSON.stringify(twoDCameraInput));
  check(!twoDCameraInput.error && twoDCameraInput.pinchZoomed && twoDCameraInput.singleTouchContinued
    && twoDCameraInput.postGesturePan
    && twoDCameraInput.resized && twoDCameraInput.resizeReversible,
  'supports pinch zoom without wedging later input and preserves scale across reversible viewport resizes',
  twoDCameraInput.error || JSON.stringify(twoDCameraInput));

  const threeClickPoint = await page.evaluate(`(() => {
    const button = document.querySelector('[data-action="view-3d"]');
    const rect = button?.getBoundingClientRect();
    if (!button || !rect) return null;
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    return { x, y, hit: document.elementFromPoint(x, y)?.closest('[data-action]')?.dataset.action || '' };
  })()`);
  if (threeClickPoint) {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: threeClickPoint.x, y: threeClickPoint.y,
      button: 'left', buttons: 1, clickCount: 1,
    }, page.sessionId);
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: threeClickPoint.x, y: threeClickPoint.y,
      button: 'left', buttons: 0, clickCount: 1,
    }, page.sessionId);
  }
  await sleep(400);
  const pointerThreeD = await page.evaluate(`(() => ({
    active: document.querySelector('[data-action="view-3d"]')?.getAttribute('aria-pressed') || '',
    view: new URLSearchParams(location.hash.split('?')[1] || '').get('view') || '',
    host: !!document.querySelector('#fpe-three-host'),
    twoD: !!document.querySelector('#fpe-canvas'),
  }))()`);
  check(threeClickPoint?.hit === 'view-3d' && pointerThreeD.active === 'true'
    && pointerThreeD.view === '3d' && pointerThreeD.host && !pointerThreeD.twoD,
  'opens the 3D view through a real hit-tested pointer click', threeClickPoint?.hit || 'missing hit target');
  await page.evaluate(`document.querySelector('[data-action="view-2d"]')?.click()`);
  await sleep(120);
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
    const vector = value => String(value || '').split(',').map(Number);
    const changed = (left, right, epsilon = .0001) => left.length === right.length
      && left.some((value, index) => Math.abs(value - right[index]) > epsilon);
    const same = (left, right, epsilon = .0001) => left.length === right.length
      && left.every((value, index) => Math.abs(value - right[index]) <= epsilon);
    const orbitState = () => ({
      camera: threeHost?.dataset.camera || '',
      target: vector(threeHost?.dataset.orbitTarget),
      yaw: Number(threeHost?.dataset.orbitYaw),
      pitch: Number(threeHost?.dataset.orbitPitch),
      distance: Number(threeHost?.dataset.orbitDistance),
      aspect: Number(threeHost?.dataset.cameraAspect),
      panScale: Number(threeHost?.dataset.orbitPanScale),
      verticalPanScale: Number(threeHost?.dataset.orbitVerticalPanScale),
    });
    const dragOrbit = async (button, dx, dy, pointerId) => {
      const rect = threeCanvas?.getBoundingClientRect();
      if (!threeCanvas || !rect) return;
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      const buttons = button === 2 ? 2 : 1;
      threeCanvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId, pointerType: 'mouse', button, buttons, clientX: x, clientY: y }));
      threeCanvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId, pointerType: 'mouse', button, buttons, clientX: x + dx, clientY: y + dy }));
      threeCanvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId, pointerType: 'mouse', button, buttons: 0, clientX: x + dx, clientY: y + dy }));
      await pause();
    };
    click('[data-action="three-reset"]'); await pause();
    const mouseStart = orbitState();
    await dragOrbit(0, 44, 18, 81);
    const afterLeft = orbitState();
    const panDelta = [
      afterLeft.target[0] - mouseStart.target[0],
      afterLeft.target[2] - mouseStart.target[2],
    ];
    const backward = [Math.sin(mouseStart.yaw), Math.cos(mouseStart.yaw)];
    const screenRight = [Math.cos(mouseStart.yaw), -Math.sin(mouseStart.yaw)];
    const panDot = (left, right) => left[0] * right[0] + left[1] * right[1];
    const leftPanDirection = panDot(panDelta, backward) < 0 && panDot(panDelta, screenRight) < 0;
    click('[data-action="three-reset"]'); await pause();
    const jitterStart = orbitState();
    await dragOrbit(0, 2, 1, 83);
    const jitterEnd = orbitState();
    click('[data-action="three-reset"]'); await pause();
    const rotateStart = orbitState();
    await dragOrbit(2, 44, 18, 82);
    const afterRight = orbitState();
    const zoomStart = afterRight.distance;
    click('[data-action="zoom-in"]'); await pause();
    const zoomedIn = orbitState().distance;
    click('[data-action="zoom-out"]'); await pause();
    const zoomedOut = orbitState().distance;
    const orbitBefore = threeHost?.dataset.camera || '';
    threeCanvas?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -180 }));
    await pause();
    const orbitAfter = threeHost?.dataset.camera || '';
    document.querySelector('.fpe-resource-row:not(.fpe-resource-row--asset)')?.click();
    await pause(350);
    const rebuiltThreeHost = document.querySelector('#fpe-three-host');
    const rebuiltThreeCanvas = document.querySelector('.fpe-three-canvas');
    const retainedViewer = rebuiltThreeHost === threeHost && rebuiltThreeCanvas === threeCanvas;
    rebuiltThreeCanvas?.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    await pause();
    const contextLost = rebuiltThreeHost?.dataset.context === 'lost'
      && !!rebuiltThreeHost.querySelector('[role="alert"]')
      && /unterbrochen/i.test(document.querySelector('#live')?.textContent || '');
    rebuiltThreeCanvas?.dispatchEvent(new Event('webglcontextrestored'));
    await pause();
    const contextRestored = rebuiltThreeHost?.dataset.context === 'ready'
      && !rebuiltThreeHost.querySelector('[role="alert"]')
      && /wiederhergestellt/i.test(document.querySelector('#live')?.textContent || '');
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
      toolbarVisible: Boolean(document.querySelector('#fpe-toolbar-host .fpe-toolbar')?.getBoundingClientRect().height),
      toolbarHints: document.querySelectorAll('#fpe-toolbar-host .fpe-toolbar__hint').length,
      toolbarPrint: !!document.querySelector('#fpe-toolbar-host [data-action="print"]'),
      zoomButtons: document.querySelectorAll('#fpe-view-actions-host :is([data-action="zoom-in"],[data-action="zoom-out"])').length,
      zoomButtonsWork: zoomedIn < zoomStart && Math.abs(zoomedOut - zoomStart) < .01,
      leftPans: changed(mouseStart.target, afterLeft.target) && Math.abs(mouseStart.yaw - afterLeft.yaw) < .0001,
      leftPanDirection,
      clickJitterStable: same(jitterStart.target, jitterEnd.target),
      cameraAspectMatches: Math.abs(mouseStart.aspect - threeCanvas.clientWidth / threeCanvas.clientHeight) < .01,
      normalizedPanScale: mouseStart.panScale > 0
        && mouseStart.verticalPanScale >= mouseStart.panScale
        && mouseStart.pitch > 0,
      rightRotates: same(rotateStart.target, afterRight.target) && Math.abs(rotateStart.yaw - afterRight.yaw) > .0001,
      retainedViewer, contextLost, contextRestored,
      reset: !!document.querySelector('[data-action="three-reset"]'),
      resetInViewActions: !!document.querySelector('#fpe-view-actions-host [data-action="three-reset"]'),
    };
    click('[data-action="view-walk"]'); await pause(350);
    const walkHost = document.querySelector('#fpe-three-host');
    const walkCanvas = document.querySelector('.fpe-three-canvas');
    walkCanvas?.focus();
    const walkPosition = () => vector(walkHost?.dataset.camera);
    const moveWalk = async (key) => {
      click('[data-action="three-reset"]'); await pause(30);
      const start = walkPosition();
      const yaw = Number(walkHost?.dataset.walkYaw);
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await pause(180);
      window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      await pause(40);
      return { start, end: walkPosition(), yaw };
    };
    const walkW = await moveWalk('w');
    const walkS = await moveWalk('s');
    const walkA = await moveWalk('a');
    const walkD = await moveWalk('d');
    const displacement = motion => [motion.end[0] - motion.start[0], motion.end[2] - motion.start[2]];
    const dot = (left, right) => left[0] * right[0] + left[1] * right[1];
    const forward = [-Math.sin(walkW.yaw), -Math.cos(walkW.yaw)];
    const right = [Math.cos(walkW.yaw), -Math.sin(walkW.yaw)];
    const walk = {
      active: document.querySelector('[data-action="view-walk"]')?.getAttribute('aria-pressed') || '',
      classed: document.querySelector('.fpe-three-view')?.classList.contains('is-walk') || false,
      renderer: walkHost?.dataset.renderer || '',
      controls: walkHost?.dataset.controls || '',
      moved: changed(walkW.start, walkW.end),
      directionsCorrect: dot(displacement(walkW), forward) > 0
        && dot(displacement(walkS), forward) < 0
        && dot(displacement(walkD), right) > 0
        && dot(displacement(walkA), right) < 0,
      toolbarVisible: Boolean(document.querySelector('#fpe-toolbar-host .fpe-toolbar')?.getBoundingClientRect().height),
      toolbarHints: document.querySelectorAll('#fpe-toolbar-host .fpe-toolbar__hint').length,
      toolbarPrint: !!document.querySelector('#fpe-toolbar-host [data-action="print"]'),
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
    && !views.threeD.twoDCanvas && views.threeD.reset && views.threeD.resetInViewActions
    && !views.threeD.toolbarVisible && views.threeD.toolbarHints === 0 && !views.threeD.toolbarPrint
    && views.threeD.zoomButtons === 2 && views.threeD.zoomButtonsWork
    && views.threeD.leftPans && views.threeD.leftPanDirection && views.threeD.clickJitterStable
    && views.threeD.cameraAspectMatches && views.threeD.normalizedPanScale && views.threeD.rightRotates
    && views.threeD.retainedViewer && views.threeD.contextLost && views.threeD.contextRestored
    && views.threeD.hintCards === 0 && views.keyboardThreeD === '3d',
  'builds the live Three.js model with visible controls, button zoom, left-pan/right-rotate, and preserved camera state',
  `${views.threeD.renderer} · ${views.threeD.rooms} rooms · ${views.threeD.placements} objects`);
  check(views.walk.active === 'true' && views.walk.classed && /^Three\.js r\d+/.test(views.walk.renderer)
    && /keyboard-walk/.test(views.walk.controls) && views.walk.moved && views.walk.directionsCorrect
    && !views.walk.toolbarVisible && views.walk.toolbarHints === 0 && !views.walk.toolbarPrint
    && views.walk.reticle && views.walk.view === 'walk'
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
    const editBorder = () => {
      const style = getComputedStyle(document.querySelector('#fpe-stage'), '::after');
      return { shadow: style.boxShadow, zIndex: Number(style.zIndex), pointerEvents: style.pointerEvents };
    };
    const twoDEditBorder = editBorder();
    fire(document.querySelector('[data-action="view-3d"]')); await pause(350);
    const threeDEditBorder = editBorder();
    fire(document.querySelector('[data-action="view-2d"]')); await pause();
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
      entry, opened, staged, twoDEditBorder, threeDEditBorder,
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
    && /rgb/.test(added.twoDEditBorder.shadow) && added.twoDEditBorder.shadow === added.threeDEditBorder.shadow
    && added.threeDEditBorder.zIndex === 30 && added.threeDEditBorder.pointerEvents === 'none'
    && !added.entry.libraryOpen && !added.entry.libraryQuery && added.entry.addPressed === 'false'
    && added.entry.toolbarActions.join(',') === 'toggle-library,tool-select,tool-distance,tool-area,toggle-structure-menu,undo,redo'
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

  const cancelledPlacementDrag = await page.evaluate(`(async () => {
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const placementId = ${JSON.stringify(added.localId || '')};
    const geometry = () => {
      const group = document.querySelector('.fpe-placement[data-id="' + placementId + '"]');
      const shape = [...(group?.children || [])].find(node => !node.classList.contains('fpe-placement__selection'));
      return group && shape ? (group.getAttribute('transform') || '') + '|' + shape.outerHTML : '';
    };
    let group = document.querySelector('.fpe-placement[data-id="' + placementId + '"]');
    const bounds = group?.getBoundingClientRect();
    if (!group || !bounds) return { error: 'placement unavailable for pointer-cancel probe' };
    const before = geometry();
    const start = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    group.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 90, pointerType: 'mouse',
      button: 0, buttons: 1, clientX: start.x, clientY: start.y,
    }));
    document.querySelector('#fpe-canvas')?.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, cancelable: true, pointerId: 90, pointerType: 'mouse',
      button: 0, buttons: 1, clientX: start.x + 2, clientY: start.y + 1,
    }));
    document.querySelector('#fpe-canvas')?.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, pointerId: 90, pointerType: 'mouse',
      button: 0, buttons: 0, clientX: start.x + 2, clientY: start.y + 1,
    }));
    await pause(50);
    const afterJitter = geometry();
    group = document.querySelector('.fpe-placement[data-id="' + placementId + '"]');
    const cancelBounds = group?.getBoundingClientRect();
    if (!group || !cancelBounds) return { error: 'placement unavailable after pointer jitter' };
    const cancelStart = {
      x: cancelBounds.left + cancelBounds.width / 2,
      y: cancelBounds.top + cancelBounds.height / 2,
    };
    group.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: 91, pointerType: 'mouse',
      button: 0, buttons: 1, clientX: cancelStart.x, clientY: cancelStart.y,
    }));
    document.querySelector('#fpe-canvas')?.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, cancelable: true, pointerId: 91, pointerType: 'mouse',
      button: 0, buttons: 1, clientX: cancelStart.x + 30, clientY: cancelStart.y + 20,
    }));
    await pause(50);
    const during = geometry();
    document.querySelector('#fpe-canvas')?.dispatchEvent(new PointerEvent('pointercancel', {
      bubbles: true, cancelable: true, pointerId: 91, pointerType: 'mouse',
      button: 0, buttons: 0, clientX: cancelStart.x + 30, clientY: cancelStart.y + 20,
    }));
    await pause(80);
    return {
      before, afterJitter, during, after: geometry(),
      selected: document.querySelector('.fpe-placement.is-selected')?.dataset.id || '',
    };
  })()`);
  check(!cancelledPlacementDrag.error
    && cancelledPlacementDrag.before
    && cancelledPlacementDrag.afterJitter === cancelledPlacementDrag.before
    && cancelledPlacementDrag.during !== cancelledPlacementDrag.before
    && cancelledPlacementDrag.after === cancelledPlacementDrag.before
    && cancelledPlacementDrag.selected === added.localId,
  'ignores sub-threshold placement jitter and rolls a live drag back on pointercancel',
  cancelledPlacementDrag.error || cancelledPlacementDrag.selected);

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
    const { core } = await import('./js/core/index.js');
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

  const guardedNavigation = await page.evaluate(`(async () => {
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const originalConfirm = window.confirm;
    let prompts = 0;
    window.confirm = () => { prompts += 1; return false; };
    const before = location.hash;
    const link = document.createElement('a');
    link.href = '#/services';
    link.textContent = 'Guard probe';
    document.body.appendChild(link);
    link.click();
    await pause(80);
    const afterLink = location.hash;
    link.remove();
    location.hash = '#/services';
    await pause(180);
    const afterDirectHash = location.hash;
    const editorPresent = !!document.querySelector('#fpe-app');
    window.confirm = originalConfirm;
    return { before, afterLink, afterDirectHash, prompts, editorPresent };
  })()`);
  check(guardedNavigation.prompts === 2
    && guardedNavigation.afterLink === guardedNavigation.before
    && guardedNavigation.afterDirectHash === guardedNavigation.before
    && guardedNavigation.editorPresent,
  'guards dirty work across routed links and direct browser-history hash changes',
  `${guardedNavigation.prompts} prompts · ${guardedNavigation.afterDirectHash}`);

  const discardDialog = await page.evaluate(`(async () => {
    const pause = () => new Promise(resolve => setTimeout(resolve, 80));
    const trigger = document.querySelector('#fpe-end-edit');
    trigger?.focus();
    trigger?.click();
    await pause();
    const modal = document.querySelector('#fpe-end-edit-modal-desc')?.closest('.modal');
    const title = modal?.querySelector('.modal__title')?.textContent.trim() || '';
    const impact = modal?.querySelector('.modal__body')?.textContent.replace(/\\s+/g, ' ').trim() || '';
    modal?.querySelector('[data-modal-close]')?.click();
    await pause();
    return {
      title, impact,
      editing: document.querySelector('#fpe-app')?.classList.contains('is-editing') || false,
      dirty: !document.querySelector('[data-action="save"]')?.disabled,
      focusReturned: document.activeElement?.id === 'fpe-end-edit',
    };
  })()`);
  check(/Bearbeitung beenden/.test(discardDialog.title)
    && /nicht gespeicherten Änderungen/.test(discardDialog.impact)
    && discardDialog.editing && discardDialog.dirty && discardDialog.focusReturned,
  'uses a focus-safe CD confirmation dialog without discarding work on cancel',
  JSON.stringify(discardDialog));

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
    // This floor is completely partitioned into canonical rooms. Shrink the
    // placement-free corridor first so the new-room workflow can exercise a
    // genuinely free area under the editor's no-overlap invariant.
    const corridorId = ${JSON.stringify(`${FLOOR_ID}-01`)};
    const initialCorridor = document.querySelector('.fpe-room[data-id="' + corridorId + '"] > rect');
    const initialCanvas = document.querySelector('#fpe-canvas');
    if (!initialCorridor || !initialCanvas?.getScreenCTM()) {
      return { error: 'corridor is unavailable for the structural fixture', before };
    }
    const corridorCentre = new DOMPoint(
      Number(initialCorridor.getAttribute('x')) + Number(initialCorridor.getAttribute('width')) / 2,
      Number(initialCorridor.getAttribute('y')) + Number(initialCorridor.getAttribute('height')) / 2,
    ).matrixTransform(initialCanvas.getScreenCTM());
    const selectPointer = type => new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 43, button: 0,
      clientX: corridorCentre.x, clientY: corridorCentre.y,
    });
    initialCorridor.parentElement.dispatchEvent(selectPointer('pointerdown'));
    document.querySelector('#fpe-canvas')?.dispatchEvent(selectPointer('pointerup'));
    await pause();
    const corridorWidth = document.querySelector('[data-room-geometry="width"]');
    const corridorBefore = Number(corridorWidth?.value || 0);
    if (!corridorWidth || corridorBefore < 400) {
      return { error: 'corridor geometry is unavailable for the structural fixture', before };
    }
    corridorWidth.value = String(corridorBefore - 200);
    corridorWidth.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
    const corridor = document.querySelector('.fpe-room[data-id="' + corridorId + '"] > rect');
    const corridorX = Number(corridor?.getAttribute('x'));
    const corridorY = Number(corridor?.getAttribute('y'));
    const corridorAfter = Number(corridor?.getAttribute('width'));
    const corridorHeight = Number(corridor?.getAttribute('height'));
    if (![corridorX, corridorY, corridorAfter, corridorHeight].every(Number.isFinite)
      || corridorAfter !== corridorBefore - 200) {
      return { error: 'corridor could not be shortened for the structural fixture', before };
    }
    click('#fpe-structure-trigger'); await pause();
    click('[data-action="tool-room"]'); await pause();
    let svg = document.querySelector('#fpe-canvas');
    if (!svg?.getScreenCTM()) return { error: '2D canvas unavailable for area creation' };
    const middleBefore = (svg.getAttribute('viewBox') || '').split(/\\s+/).map(Number);
    const middleRoomCount = document.querySelectorAll('.fpe-room[data-id]').length;
    const middleBounds = svg.getBoundingClientRect();
    const middleStart = { x: middleBounds.left + middleBounds.width / 2, y: middleBounds.top + middleBounds.height / 2 };
    const middleEvent = (type, x, y, buttons) => new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 45, pointerType: 'mouse', button: 1,
      buttons, clientX: x, clientY: y,
    });
    svg.dispatchEvent(middleEvent('pointerdown', middleStart.x, middleStart.y, 4));
    svg.dispatchEvent(middleEvent('pointermove', middleStart.x + 32, middleStart.y + 18, 4));
    svg.dispatchEvent(middleEvent('pointerup', middleStart.x + 32, middleStart.y + 18, 0));
    await pause();
    svg = document.querySelector('#fpe-canvas');
    const middleAfter = (svg?.getAttribute('viewBox') || '').split(/\\s+/).map(Number);
    const middleMoved = middleBefore.some((value, index) => Math.abs(value - middleAfter[index]) > .1);
    const middleRoomStable = document.querySelectorAll('.fpe-room[data-id]').length === middleRoomCount;
    const middleToolActive = document.querySelector('#fpe-structure-trigger')?.classList.contains('is-active');
    const middlePanDuringAuthoring = middleMoved && middleRoomStable && middleToolActive;
    const client = (x, y) => new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
    const start = client(corridorX + corridorAfter, corridorY);
    const end = client(corridorX + corridorAfter + 180, corridorY + Math.min(170, corridorHeight));
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
    const handleHitWidth = local.querySelector('.fpe-room__handle-hit')?.getBoundingClientRect().width || 0;
    const handleVisualWidth = local.querySelector('.fpe-room__handle-visual')?.getBoundingClientRect().width || 0;
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
      initialHandles, handleHitWidth, handleVisualWidth,
      inspector: document.querySelector('#fpe-right')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      roomModule: document.querySelector('[data-room-field="moduleId"]')?.value || '',
      menuKeyboard, lockViaKeyboard, structureFocusReturned, unavailableTools, locked,
      middlePanDuringAuthoring, middleMoved, middleRoomStable, middleToolActive,
      middleBefore, middleAfter,
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
    && structure.handleHitWidth >= 32 && structure.handleVisualWidth >= 12
    && structure.middlePanDuringAuthoring
    && structure.menuKeyboard && structure.lockViaKeyboard && structure.structureFocusReturned
    && structure.unavailableTools === 0 && structure.locked,
  'exposes the structural-edit menu, lock state, and rectangular area tool accessibly',
  structure.error || JSON.stringify({
    before: structure.before, after: structure.after, localId: structure.localId,
    initialHandles: structure.initialHandles, handles: structure.handles,
    handleHitWidth: structure.handleHitWidth, handleVisualWidth: structure.handleVisualWidth,
    middlePanDuringAuthoring: structure.middlePanDuringAuthoring,
    middleMoved: structure.middleMoved, middleRoomStable: structure.middleRoomStable,
    middleToolActive: structure.middleToolActive,
    middleBefore: structure.middleBefore, middleAfter: structure.middleAfter,
    menuKeyboard: structure.menuKeyboard, lockViaKeyboard: structure.lockViaKeyboard,
    structureFocusReturned: structure.structureFocusReturned,
    unavailableTools: structure.unavailableTools, locked: structure.locked,
  }));
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
      floorId: draft?.floorId || '', roomValue: room?.['occupierVe'] || '',
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
    const historyKey = Object.keys(localStorage)
      .find(key => key.startsWith(${JSON.stringify(HISTORY_KEY_PREFIX)}));
    const raw = historyKey ? localStorage.getItem(historyKey) : null;
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
    const { core } = await import('./js/core/index.js');
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
      storedRoom: draft?.rooms?.find(room => room.spaceId === ${JSON.stringify(ROOM_ID)})?.['occupierVe'] || '',
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
    && reloadedCanonical?.['occupierVe'] === initial.canonicalOccupier
    && reloadedCanonical?.['occupierVe'] !== EDITED_OCCUPIER,
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
      drawerFocused: document.activeElement?.classList.contains('fpe-drawer-close') || false,
      stageInert: document.querySelector('#fpe-stage')?.inert || false,
    });
    const before = state();
    const more = document.querySelector('#fpe-more-trigger');
    const moreRect = more?.getBoundingClientRect();
    more?.click(); await pause();
    const compactActions = ['save', 'publish', 'end-edit'].every(action => {
      const button = document.querySelector('#fpe-more-menu [data-action="' + action + '"]');
      return button && getComputedStyle(button).display !== 'none';
    });
    const criticalActionsInViewport = Boolean(moreRect && moreRect.left >= 0 && moreRect.right <= innerWidth);
    more?.click(); await pause();
    const modeLabels = [...document.querySelectorAll('[data-view-mode]')].map(button => button.textContent.trim()).join(',');
    const minimumCustomTarget = Math.min(...[...document.querySelectorAll('.fpe-library-tabs button,.fpe-resource-row,.fpe-resource-room-toggle')]
      .map(control => Math.min(control.getBoundingClientRect().width, control.getBoundingClientRect().height))
      .filter(Number.isFinite));
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
    return { before, hidden, shown, restored, right, dismissed, viewport: document.documentElement.clientWidth,
      compactActions, criticalActionsInViewport, modeLabels, minimumCustomTarget };
  })()`);
  check([mobile.before, mobile.hidden, mobile.shown, mobile.restored].every(state => state.overflow <= 1)
    && mobile.viewport >= 300 && mobile.viewport <= 320,
  'keeps the 320px editor inside the document viewport through panel redraws',
  `${mobile.viewport}px viewport · ${Math.max(mobile.before.overflow, mobile.hidden.overflow, mobile.shown.overflow)}px overflow`);
  check(!mobile.before.hasLeft && mobile.before.pressed === 'false'
    && mobile.shown.hasLeft && mobile.shown.pressed === 'true' && mobile.shown.visibility === 'visible'
    && mobile.shown.drawerFocused && mobile.shown.stageInert
    && !mobile.hidden.hasLeft && mobile.hidden.pressed === 'false' && mobile.hidden.visibility === 'hidden'
    && mobile.restored.hasLeft && mobile.restored.pressed === 'true',
  'enters compact mode closed, then opens and restores the contextual library drawer with matching aria state',
  `${mobile.before.pressed} → ${mobile.shown.pressed} → ${mobile.hidden.pressed} → ${mobile.restored.pressed}`);
  check(mobile.restored.backdrop && mobile.right.hasRight && !mobile.right.hasLeft
    && mobile.right.rightVisibility === 'visible' && mobile.right.visibility === 'hidden'
    && !mobile.dismissed.hasLeft && !mobile.dismissed.hasRight && !mobile.dismissed.backdrop,
  'keeps compact drawers mutually exclusive and dismisses them with Escape',
  `left=${mobile.right.hasLeft} · right=${mobile.right.hasRight} → closed`);
  check(mobile.compactActions && mobile.criticalActionsInViewport
    && mobile.modeLabels === '2D,3D,Begehung' && mobile.minimumCustomTarget >= 44,
  'keeps critical edit actions explicit and custom controls touch-sized at 320px',
  `${mobile.modeLabels} · ${Math.round(mobile.minimumCustomTarget)}px`);

  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 568, height: 320, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await sleep(160);
  const landscape = await page.evaluate(`(async () => {
    const pause = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const contrast = (foreground, background) => {
      const channels = value => (value.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
      const luminance = value => channels(value).reduce((sum, channel, index) => {
        const normalized = channel / 255;
        const linear = normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
        return sum + linear * [.2126, .7152, .0722][index];
      }, 0);
      const left = luminance(foreground), right = luminance(background);
      return (Math.max(left, right) + .05) / (Math.min(left, right) + .05);
    };
    const trigger = document.querySelector('#fpe-more-trigger');
    trigger?.click(); await pause();
    const menu = document.querySelector('#fpe-more-menu');
    const menuRect = menu?.getBoundingClientRect();
    const menuScrollable = !!menu && menu.scrollHeight > menu.clientHeight && getComputedStyle(menu).overflowY === 'auto';
    if (menu) menu.scrollTop = menu.scrollHeight;
    await pause();
    const visibleItems = [...(menu?.querySelectorAll('[role="menuitem"]') || [])]
      .filter(item => getComputedStyle(item).display !== 'none');
    const lastRect = visibleItems.at(-1)?.getBoundingClientRect();
    const menuLastReachable = !!(menuRect && lastRect && lastRect.bottom <= menuRect.bottom + 1);
    trigger?.click(); await pause();
    const stageRect = document.querySelector('#fpe-stage')?.getBoundingClientRect();
    const actions = document.querySelector('.fpe-view-nav__actions');
    const actionRect = actions?.getBoundingClientRect();
    const actionButtons = [...(actions?.querySelectorAll('button') || [])].map(button => button.getBoundingClientRect());
    const actionsContained = !!(stageRect && actionRect
      && actionRect.top >= stageRect.top - 1 && actionRect.bottom <= stageRect.bottom + 1
      && actionButtons.every(rect => rect.width >= 44 && rect.height >= 44));
    const activeMode = document.querySelector('.fpe-view-nav__mode.is-active');
    activeMode?.focus({ preventScroll:true });
    const activeStyle = activeMode ? getComputedStyle(activeMode) : null;
    return {
      menuTop: menuRect?.top ?? -1, menuBottom: menuRect?.bottom ?? innerHeight + 1,
      menuScrollable, menuLastReachable,
      actionDirection: actions ? getComputedStyle(actions).flexDirection : '', actionsContained,
      activeFocusContrast: activeStyle ? contrast(activeStyle.outlineColor, activeStyle.backgroundColor) : 0,
    };
  })()`);
  check(landscape.menuTop >= 7 && landscape.menuBottom <= 313
    && landscape.menuScrollable && landscape.menuLastReachable,
  'keeps every compact plan action reachable in a short landscape viewport',
  `${Math.round(landscape.menuTop)}–${Math.round(landscape.menuBottom)}px · scroll=${landscape.menuScrollable}`);
  check(landscape.actionDirection === 'row' && landscape.actionsContained,
    'keeps landscape camera actions inside the short workbench with full touch targets', landscape.actionDirection);
  check(landscape.activeFocusContrast >= 3,
    'keeps the active view mode focus indicator distinct from its selected fill', `${landscape.activeFocusContrast.toFixed(2)}:1`);

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

  await page.evaluate(`document.querySelector('.fpe-breadcrumb a:nth-of-type(2)')?.click()`);
  check(await waitFor(page, '#fpe-navigation[data-view="portfolio"]'),
    'returns from the canvas to the portfolio view through the building breadcrumb');
  const returnedNavigation = await page.evaluate(`(() => {
    const visible = selector => {
      const node = document.querySelector(selector);
      return !!node && getComputedStyle(node).display !== 'none';
    };
    return {
      standalone: document.body.classList.contains('body--standalone-app'),
      canvas: !!document.querySelector('#fpe-canvas'), navigation: !!document.querySelector('#fpe-navigation'),
      portalHeader: visible('#main-header'), portalFooter: visible('#main-footer'),
      h1: document.querySelector('#fpe-navigation h1')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      hash: location.hash,
      scope: (document.querySelector('#fpe-browse-stats .fpe-overline')?.textContent || '').trim(),
      statsObjects: (document.querySelector('#fpe-browse-stats .kpi-strip__value')?.textContent || '').trim(),
      homeHref: document.querySelector('#fpe-home')?.getAttribute('href') || '',
    };
  })()`);
  check(returnedNavigation.standalone && returnedNavigation.navigation && !returnedNavigation.canvas
    && !returnedNavigation.portalHeader && !returnedNavigation.portalFooter,
  'keeps the user inside the standalone Plan-Editor application', returnedNavigation.hash);
  check(/Portfolio/.test(returnedNavigation.h1) && /Liebefeld/.test(returnedNavigation.scope)
    && returnedNavigation.statsObjects === '1'
    && /building=1080%2F6650%2FAA/i.test(returnedNavigation.hash) && !returnedNavigation.hash.includes('floor=')
    && returnedNavigation.homeHref === '#/app/floorplan-editor',
  'preselects the matching object and scopes the statistics to it', `${returnedNavigation.scope} · ${returnedNavigation.hash}`);
  const compactBrowse = await page.evaluate(`(() => {
    const tree = document.querySelector('.fpe-browse__tree');
    const stats = document.querySelector('#fpe-browse-stats');
    return {
      treeDisplay: tree ? getComputedStyle(tree).display : 'missing',
      statsWidth: stats ? Math.round(stats.getBoundingClientRect().width) : 0,
      barWraps: !!document.querySelector('.fpe-browse__bar .catbar'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  check(compactBrowse.treeDisplay === 'none' && compactBrowse.statsWidth > 280
    && compactBrowse.barWraps && compactBrowse.overflow <= 1,
  'stacks the portfolio browser on a phone instead of squeezing three columns',
  `tree=${compactBrowse.treeDisplay} · stats=${compactBrowse.statsWidth}px · ${compactBrowse.overflow}px overflow`);

  await page.evaluate(`document.querySelector('#fpe-home')?.click()`);
  check(await waitFor(page, '#fpe-navigation[data-view="portfolio"]'), 'brand link opens the portfolio root');
  const home = await page.evaluate(`(() => ({
    hash: location.hash,
    objects: document.querySelectorAll('.fpe-browse__tree .pf-tree__leaf').length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    barOverflows: (() => {
      const bar = document.querySelector('.fpe-browse__bar');
      return !!bar && bar.scrollWidth > bar.clientWidth + 1;
    })(),
  }))()`);
  check(home.hash === '#/app/floorplan-editor' && home.objects === 7 && home.overflow <= 1 && !home.barOverflows,
    'keeps the Plan-Editor root deterministic on mobile', `${home.hash} · ${home.objects} objects · ${home.overflow}px overflow`);

  await cdp.send('Page.navigate', { url: `${APP_BASE}/app/floorplan-editor?view=work` }, page.sessionId);
  await sleep(500);
  const compactWork = await page.evaluate(`(() => {
    const row = document.querySelector('#fpe-work-table tbody tr');
    const table = document.querySelector('#fpe-work-table [data-scroll-region], #fpe-work-table .table-scroll');
    return {
      rows: document.querySelectorAll('#fpe-work-table tbody tr').length,
      tabs: document.querySelectorAll('.fpe-layer-tabs .tab__control').length,
      actionHeight: row ? Math.round(row.querySelector('.fpe-work__actions .btn')?.getBoundingClientRect().height || 0) : 0,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      tableScrolls: !!table,
    };
  })()`);
  check(compactWork.rows > 0 && compactWork.tabs === 4 && compactWork.actionHeight >= 32
    && compactWork.documentOverflow <= 1,
  'keeps the work queue usable at 320 px without opening the document',
  `${compactWork.rows} rows · action ${compactWork.actionHeight}px · ${compactWork.documentOverflow}px overflow`);

  console.log('\n■ Dirty history jumps and logout');
  const guardedHistory = await page.evaluate(`(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const visit = async (hash, expectedHeading = '', selector = '') => {
      const previousIdx = history.state?.bblIdx;
      location.hash = hash;
      let tries = 0;
      while (tries++ < 100) {
        const heading = document.querySelector('#main-content h1')?.textContent.trim() || '';
        const ready = (!expectedHeading || heading.startsWith(expectedHeading))
          && (!selector || document.querySelector(selector));
        if (location.hash === hash && history.state?.bblIdx !== previousIdx && ready) break;
        await wait(30);
      }
      await wait(80);
      return { hash: location.hash, idx: history.state?.bblIdx };
    };
    const services = await visit('#/services', 'Dienstleistungen');
    const knowledge = await visit('#/knowledge', 'Wissen und Hilfsmittel');
    const editorHash = ${JSON.stringify(`${new URL(ROUTE).hash}&selected=${encodeURIComponent(`room:${ROOM_ID}`)}&edit=1`)};
    const editor = await visit(editorHash, '', '#fpe-room-roomName');
    const field = document.querySelector('#fpe-room-roomName');
    if (field) {
      field.value += ' Guard-Test';
      field.dispatchEvent(new Event('change', { bubbles: true }));
      await wait(80);
    }
    const dirtyBefore = !document.querySelector('[data-action="save"]')?.disabled;
    const originalConfirm = window.confirm;
    let prompts = 0;
    window.confirm = () => { prompts += 1; return false; };
    history.go(-2);
    let tries = 0;
    while (prompts === 0 && tries++ < 100) await wait(30);
    tries = 0;
    while ((location.hash !== editor.hash || history.state?.bblIdx !== editor.idx)
      && tries++ < 100) await wait(30);
    await wait(100);
    window.confirm = originalConfirm;
    return {
      services, knowledge, editor, prompts, dirtyBefore,
      afterHash: location.hash,
      afterIdx: history.state?.bblIdx,
      editorPresent: !!document.querySelector('#fpe-app'),
      dirtyAfter: !document.querySelector('[data-action="save"]')?.disabled,
    };
  })()`);
  check(guardedHistory.dirtyBefore && guardedHistory.prompts === 1
    && guardedHistory.afterHash === guardedHistory.editor.hash
    && guardedHistory.afterIdx === guardedHistory.editor.idx
    && guardedHistory.editorPresent && guardedHistory.dirtyAfter
    && guardedHistory.editor.idx - guardedHistory.services.idx === 2
    && guardedHistory.knowledge.idx - guardedHistory.services.idx === 1,
  'restores a rejected two-entry history jump directly without dispatching or prompting twice',
  `${guardedHistory.services.idx} → ${guardedHistory.editor.idx} · ${guardedHistory.prompts} prompt`);

  const guardedLogout = await page.evaluate(`(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const originalConfirm = window.confirm;
    let rejectedPrompts = 0;
    window.confirm = () => { rejectedPrompts += 1; return false; };
    const rejectedResult = await window.__logout();
    await wait(100);
    const rejected = {
      result: rejectedResult,
      prompts: rejectedPrompts,
      session: Boolean(localStorage.getItem('bbl_session_v1')),
      editor: Boolean(document.querySelector('#fpe-app')),
      dirty: !document.querySelector('[data-action="save"]')?.disabled,
    };
    let acceptedPrompts = 0;
    window.confirm = () => { acceptedPrompts += 1; return true; };
    await window.__logout();
    let tries = 0;
    while (!document.querySelector('.login-gate__btn') && tries++ < 100) await wait(30);
    window.confirm = originalConfirm;
    return {
      rejected,
      accepted: {
        prompts: acceptedPrompts,
        session: Boolean(localStorage.getItem('bbl_session_v1')),
        gate: Boolean(document.querySelector('.login-gate__btn')),
        editor: Boolean(document.querySelector('#fpe-app')),
      },
    };
  })()`);
  check(guardedLogout.rejected.result === false && guardedLogout.rejected.prompts === 1
    && guardedLogout.rejected.session && guardedLogout.rejected.editor && guardedLogout.rejected.dirty,
  'rejecting logout preserves the authenticated session and dirty editor',
  `${guardedLogout.rejected.prompts} prompt · session=${guardedLogout.rejected.session}`);
  check(guardedLogout.accepted.prompts === 1 && !guardedLogout.accepted.session
    && guardedLogout.accepted.gate && !guardedLogout.accepted.editor,
  'accepting logout clears the session and redraws the protected route as a login gate',
  `${guardedLogout.accepted.prompts} prompt · gate=${guardedLogout.accepted.gate}`);

  await checkProblems(page, 'complete editor flow has no runtime problems');
} finally {
  if (page) {
    try { await page.closeTarget(); } catch { /* browser may already be closing */ }
  }
  cdp.close();
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
