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
// German query values are the app's public link contract (object-view.js), so
// they are compatibility literals here too.
const PLANS_TAB_QUERY = 'tab=grundrisse';
const MODULE_TAB_QUERY = 'tab=module';
const EQUIPMENT_TAB_QUERY = 'tab=ausstattung';
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
      // The plan-upload action sits in the persistent header so it is reachable
      // from every landing view, not only from the work queue.
      upload: (() => {
        const node = document.querySelector('#fpe-plan-upload');
        return {
          inHeader: !!node && !!node.closest('.fpe-header'),
          label: text(node),
          href: node?.getAttribute('href') || '',
          count: document.querySelectorAll('#fpe-plan-upload').length,
        };
      })(),
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
  check(browse.upload.inHeader && browse.upload.count === 1
    && /Plan hochladen und prüfen/.test(browse.upload.label) && browse.upload.href === '#/app/plan-check',
  'offers the plan upload from the header of the portfolio view', browse.upload.label);
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
      // The popup carries master data and one way onward, not a second detail view.
      popupName: text(popup?.querySelector('.fpe-popup__name')),
      popupFacts: popup ? [...popup.querySelectorAll('.fpe-popup__facts dt')].map(text) : [],
      popupFloorList: popup ? popup.querySelectorAll('.fpe-popup__floor').length : -1,
      popupActions: popup ? [...popup.querySelectorAll('.fpe-popup__actions a')].map(text) : [],
      popupOpen: popup?.querySelector('.fpe-popup__actions .btn--filled')?.getAttribute('href') || '',
      popupNotes: popup ? [...popup.querySelectorAll('.fpe-popup__notes li')].map(text) : [],
      // The statistics follow the selection instead of being replaced by it.
      statsScope: text(document.querySelector('#fpe-browse-stats .fpe-overline')),
      statsObjects: text(document.querySelector('#fpe-browse-stats .kpi-strip__value')),
      pills: [...document.querySelectorAll('#fpe-browse-activefilters .active-filter')].map(text),
      reset: !!document.querySelector('#fpe-browse-activefilters [data-reset]'),
    };
  })()`);
  check(/Liebefeld/.test(treePick.popupName)
    && treePick.popupFacts.join(',') === 'Geschosse,Räume,Hauptnutzfläche,Arbeitsplätze'
    && treePick.popupNotes.length > 0,
  'keeps the marker popup to the object master data',
  `${treePick.popupName} · ${treePick.popupFacts.join('/')} · ${treePick.popupNotes.join(' | ')}`);
  // The predecessor of this button promised the editor and opened the detail
  // view instead — the label has to name where it actually lands.
  check(treePick.popupActions.length === 1 && /Objektdetails/.test(treePick.popupActions[0] || '')
    && treePick.popupOpen === '#/app/floorplan-editor?building=1080%2F6650%2FAA'
    && treePick.popupFloorList === 0,
  'offers exactly one way onward from the popup, into the object detail it names',
  `${treePick.popupActions.join(' | ')} → ${treePick.popupOpen}`);
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

  console.log('\n■ Plan-Editor building detail');
  await cdp.send('Page.navigate', {
    url: `${APP_BASE}/app/floorplan-editor?building=${encodeURIComponent(BUILDING_ID)}`,
  }, page.sessionId);
  await sleep(600);
  check(await waitFor(page, '#fpe-object[data-tab="overview"]'),
    'resolves a building deep link into its own detail view');
  const detail = await page.evaluate(`(() => {
    const text = node => (node?.textContent || '').split(/\\s+/).join(' ').trim();
    return {
      hash: location.hash,
      crumbs: [...document.querySelectorAll('.fpe-object .fpe-breadcrumb > *')].map(text).filter(Boolean),
      crumbHrefs: [...document.querySelectorAll('.fpe-object .fpe-breadcrumb a')].map(a => a.getAttribute('href')),
      h1: text(document.querySelector('#fpe-object h1')),
      // A top-floor shortcut used to sit here; opening a plan is an action of
      // the register that lists the plans, not of the page title.
      headButtons: document.querySelectorAll('.fpe-object__head .btn').length,
      planView: document.querySelector('#fpe-object')?.dataset.planView || '',
      tabs: [...document.querySelectorAll('#fpe-object [role="tab"]')].map(text),
      kpis: [...document.querySelectorAll('#fpe-object .kpi-strip__label')].map(text),
      // The overview register carries the quick jump; the gallery carries the
      // full-size previews, so the same thumbnails never appear twice.
      stripFloors: document.querySelectorAll('[data-panel="overview"]:not([hidden]) .fpe-object__strip-item').length,
      galleryVisible: document.querySelectorAll('.tab__container:not([hidden]) .fpe-floor-card').length,
      facts: text(document.querySelector('#fpe-object .kv')),
      // Shared portal components, not local rebuilds.
      actionCard: document.querySelectorAll('.detail-layout__aside .fp-svc').length,
      actionCardStyled: (() => {
        const row = document.querySelector('.detail-layout__aside .fp-svc');
        return row ? getComputedStyle(row).display : 'missing';
      })(),
      contacts: document.querySelectorAll('.detail-layout__aside .kv--stack dt').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      duplicateIds: [...document.querySelectorAll('[id]')].map(node => node.id).filter((id, index, ids) => ids.indexOf(id) !== index),
    };
  })()`);
  check(/Liebefeld/.test(detail.h1)
    && detail.crumbs.slice(0, 5).join(' › ') === 'Kundenportal › Alle Objekte › Schweiz › BE › Liebefeld'
    && /Liebefeld/.test(detail.crumbs.at(-1)),
  'walks the portal and the full location down to the object in the breadcrumb', detail.crumbs.join(' › '));
  // Every level returns to the portfolio scoped to exactly that level, so going
  // up a step means seeing the siblings rather than starting over.
  // The first crumb leaves the application altogether: a standalone layout hides
  // the portal shell, so without it the only ways back were Back and the address bar.
  check(detail.crumbHrefs.join(' | ') === ['#/',
    '#/app/floorplan-editor',
    '#/app/floorplan-editor?country=CH',
    '#/app/floorplan-editor?country=CH&region=BE',
    '#/app/floorplan-editor?country=CH&region=BE&city=Liebefeld'].join(' | '),
  'returns to the portal and scopes each place level to its own filter', detail.crumbHrefs.join(' | '));
  check(detail.tabs.join(',') === 'Übersicht,Grundrisse (3),Module (10),Ausstattung (187)',
    'separates plans, module standard and furniture into their own registers', detail.tabs.join(' | '));
  check(detail.kpis.join(',') === 'Geschosse,Räume,Hauptnutzfläche,Arbeitsplätze'
    && /Hauptnutzfläche \(HNF\)/.test(detail.facts) && /Planverfügbarkeit/.test(detail.facts),
  'leads with the space-management key figures and facts', detail.kpis.join(' · '));
  check(detail.stripFloors === 0 && detail.galleryVisible === 0,
    'keeps floor thumbnails out of the overview, where the plan register carries them',
    `${detail.stripFloors} strip · ${detail.galleryVisible} cards`);
  check(detail.actionCard === 2 && detail.actionCardStyled === 'grid' && detail.contacts === 2,
    'keeps the action card to uploading a plan and the not-yet-built mutation',
    `${detail.actionCard} actions (${detail.actionCardStyled}) · ${detail.contacts} contacts`);
  // The overview carried a floor thumbnail strip and a plan-handover block. The
  // first repeated the plan register one tab away; the second is order
  // bookkeeping. An «open in the editor» action went too: a session is always on
  // one floor, so opening «the building» silently picked its top floor.
  const overviewTrim = await page.evaluate(`(() => {
    const panel = document.querySelector('[data-panel="overview"]');
    const t = (el) => (el?.textContent || '').replace(/\\s+/g, ' ').trim();
    return {
      headings: [...panel.querySelectorAll('.detail-section__title')].map(t),
      strips: panel.querySelectorAll('.fpe-object__strip-item').length,
      links: [...panel.querySelectorAll('.fp-svc-list a')].map(t),
      disabled: [...panel.querySelectorAll('.fp-svc-list .fp-svc--disabled, .fp-svc-list [aria-disabled="true"]')].map(t),
      lead: panel.querySelector('.box > p.small.muted') ? 'present' : 'none',
    };
  })()`);
  check(overviewTrim.headings.join(',') === 'Eckdaten' && overviewTrim.strips === 0
    && overviewTrim.links.join(',') === 'Neuen Plan hochladen',
  'reduces the overview to the key facts and one live action',
  `${overviewTrim.headings.join('/')} · ${overviewTrim.links.join('/')}`);
  check(overviewTrim.lead === 'none',
    'drops the stock action-card lead that only restated the card title');
  check(detail.headButtons === 0 && detail.planView === 'list',
    'drops the top-floor shortcut and defaults the plan register to the list',
    `${detail.headButtons} head buttons · ${detail.planView}`);
  check(detail.overflow <= 1 && detail.duplicateIds.length === 0,
    'renders the detail without overflow or duplicate ids', `${detail.overflow}px`);

  // A fixed-viewport standalone app scrolls inside itself. The reset reserves a
  // root scrollbar to stop portal pages jumping, and overlay.css keeps that
  // gutter stable — beside the app's own scrollbar that drew a second, dead one.
  // Plan Check is the deliberate exception and pins `overflow-y:auto` in its own
  // suite, so both directions stay covered.
  const scrollbars = await page.evaluate(`(() => {
    const bars = [...document.querySelectorAll('html, body, .site-main, .fpe-app, .fpe-landing')]
      .filter(node => node.offsetWidth - node.clientWidth > 0)
      .map(node => (node.className || node.tagName).toString().split(' ')[0]);
    return {
      bars,
      rootBarPx: window.innerWidth - document.documentElement.clientWidth,
      rootOverflowY: getComputedStyle(document.documentElement).overflowY,
      appScrolls: (() => {
        const app = document.querySelector('.fpe-app');
        return app ? app.scrollHeight - app.clientHeight : -1;
      })(),
    };
  })()`);
  check(scrollbars.bars.length <= 1 && scrollbars.rootBarPx === 0
    && scrollbars.rootOverflowY === 'hidden'
    && (scrollbars.appScrolls > 0 ? scrollbars.bars.length === 1 : true),
  'never draws a second scrollbar beside the standalone app',
  `${scrollbars.bars.join('+') || 'none'} · root ${scrollbars.rootBarPx}px · scrolls ${scrollbars.appScrolls}`);

  const plansTab = await page.evaluate(`(async () => {
    const text = node => (node?.textContent || '').split(/\\s+/).join(' ').trim();
    [...document.querySelectorAll('#fpe-object [role="tab"]')].find(t => /Grundrisse/.test(t.textContent))?.click();
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      hash: location.hash,
      cards: document.querySelectorAll('.tab__container:not([hidden]) .fpe-floor-card').length,
      // A row is a line of facts: no thumbnail may appear in the table.
      rowPreviews: document.querySelectorAll('.fpe-plans table .fpe-recent__preview').length,
      headers: [...document.querySelectorAll('.fpe-plans table thead th')].map(text),
      rows: document.querySelectorAll('.fpe-plans table tbody tr').length,
      search: !!document.querySelector('#fpe-floors-q'),
      firstFloorHref: document.querySelector('.fpe-plans table tbody a')?.getAttribute('href') || '',
      views: [...document.querySelectorAll('.fpe-plans .view-switch__btn')].map(b => b.dataset.view),
    };
  })()`);
  check(plansTab.cards === 0 && plansTab.rowPreviews === 0 && plansTab.rows === 3
    && plansTab.headers.join(',') === 'Geschoss,Räume,HNF,Arbeitsplätze,Letzter Abgleich,Planstand'
    && plansTab.search && /floor=1080-6650-AA-2og/.test(plansTab.firstFloorHref),
  'opens the plan register as a fact-only table with its own search', plansTab.headers.join(','));
  check(plansTab.hash.includes(PLANS_TAB_QUERY) && !/plans=/.test(plansTab.hash)
    && plansTab.views.join(',') === 'list,cards',
  'keeps the open register in the URL and leaves the default surface out of it', plansTab.hash);

  const plansCards = await page.evaluate(`(async () => {
    const text = node => (node?.textContent || '').split(/\\s+/).join(' ').trim();
    document.querySelector('.fpe-plans .view-switch__btn[data-view="cards"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      hash: location.hash,
      cards: document.querySelectorAll('.tab__container:not([hidden]) .fpe-floor-card').length,
      previews: document.querySelectorAll('.tab__container:not([hidden]) .fpe-floor-card__media .fpe-recent__preview svg').length,
      firstCard: text(document.querySelector('.fpe-floor-card__body')),
      cardOpen: document.querySelector('.fpe-floor-card__link')?.getAttribute('href') || '',
      cardCheck: document.querySelector('.fpe-floor-card__check')?.getAttribute('href') || '',
      table: document.querySelectorAll('.fpe-plans table tbody tr').length,
    };
  })()`);
  check(plansCards.cards === 3 && plansCards.previews === 3 && plansCards.table === 0
    && /640 m² HNF · 28 Räume · 79 AP/.test(plansCards.firstCard)
    && /floor=1080-6650-AA-2og/.test(plansCards.cardOpen) && /plan-check/.test(plansCards.cardCheck),
  'offers the gallery as the second surface, with previews and both handoffs', plansCards.firstCard);
  check(/plans=cards/.test(plansCards.hash), 'keeps the chosen floor surface in the URL', plansCards.hash);

  const moduleTab = await page.evaluate(`(async () => {
    const text = node => (node?.textContent || '').split(/\\s+/).join(' ').trim();
    [...document.querySelectorAll('#fpe-object [role="tab"]')].find(t => /^Module/.test(t.textContent))?.click();
    await new Promise(resolve => setTimeout(resolve, 250));
    const panel = document.querySelector('.tab__container:not([hidden])');
    const table = panel?.querySelector('table');
    return {
      hash: location.hash,
      caption: text(panel?.querySelector('caption')),
      captionVisible: (() => { const caption = panel?.querySelector('caption');
        return caption ? getComputedStyle(caption).position === 'static' : false; })(),
      headers: table ? [...table.querySelectorAll('thead th')].map(text) : [],
      rows: table ? table.querySelectorAll('tbody tr').length : 0,
      first: table ? [...table.querySelectorAll('tbody tr')[0].children].map(text) : [],
      total: table ? [...table.querySelectorAll('tfoot th, tfoot td')].map(text).join(',') : '',
    };
  })()`);
  // Compared field by field: the thousands separator of the area cell is a
  // locale detail, not something this assertion should be pinned to.
  check(moduleTab.rows === 10 && moduleTab.first[0] === '1 Einzel Arbeitsplatz'
    && moduleTab.first[1] === '41' && moduleTab.first[3] === '93' && moduleTab.first[4] === '93'
    && moduleTab.headers.join(',') === 'Modul,Räume,Fläche,Arbeitsplätze,Positionen geplant',
  'reports the multispace modules of an accepted planning', moduleTab.first.join(' · '));
  // Where the figures come from decides whether they may be quoted as an approved
  // planning, so it is the table's VISIBLE caption rather than a muted aside.
  check(moduleTab.hash.includes(MODULE_TAB_QUERY) && moduleTab.captionVisible
    && /abgenommene Planung/.test(moduleTab.caption),
  'states in the caption that the module figures come from an accepted planning', moduleTab.caption);

  const equipmentTab = await page.evaluate(`(async () => {
    const text = node => (node?.textContent || '').split(/\\s+/).join(' ').trim();
    [...document.querySelectorAll('#fpe-object [role="tab"]')].find(t => /^Ausstattung/.test(t.textContent))?.click();
    await new Promise(resolve => setTimeout(resolve, 250));
    const panel = document.querySelector('.tab__container:not([hidden])');
    const table = panel?.querySelector('table');
    return {
      hash: location.hash,
      caption: text(panel?.querySelector('caption')),
      headers: table ? [...table.querySelectorAll('thead th')].map(text) : [],
      perFloor: table ? table.querySelectorAll('tbody tr').length : 0,
      total: table ? [...table.querySelectorAll('tfoot th, tfoot td')].map(text).join(',') : '',
    };
  })()`);
  check(equipmentTab.perFloor === 3 && equipmentTab.total === 'Total,187,80,262'
    && equipmentTab.headers.join(',') === 'Geschoss,Möblierung,Räume,Arbeitsplätze'
    && equipmentTab.hash.includes(EQUIPMENT_TAB_QUERY),
  'breaks the furniture down per floor in its own register', equipmentTab.total);
  check(/ohne gebäudetechnische Ausstattung/.test(equipmentTab.caption),
    'says in the caption which equipment this register does not yet carry', equipmentTab.caption);

  // A legacy object carries no planning record at all: its module register is
  // derived from the room use types, and its furniture register is genuinely
  // empty and has to say so through the portal's own empty state.
  await cdp.send('Page.navigate', {
    url: `${APP_BASE}/app/floorplan-editor?building=${encodeURIComponent('1080/6100/AA')}&tab=module`,
  }, page.sessionId);
  await sleep(500);
  const legacyModules = await page.evaluate(`(() => {
    const text = node => (node?.textContent || '').split(/\\s+/).join(' ').trim();
    const panel = document.querySelector('.tab__container:not([hidden])');
    return {
      tabs: [...document.querySelectorAll('#fpe-object [role="tab"]')].map(text),
      caption: text(panel?.querySelector('caption')),
      headers: [...(panel?.querySelectorAll('thead th') || [])].map(text),
      rows: panel ? panel.querySelectorAll('tbody tr').length : 0,
    };
  })()`);
  check(legacyModules.rows > 0 && /aus der Raumnutzung abgeleitet/.test(legacyModules.caption)
    && !legacyModules.headers.includes('Positionen geplant'),
  'derives the modules of a legacy object from its rooms and says so in the caption',
  `${legacyModules.rows} modules · ${legacyModules.caption.slice(-52)}`);

  await cdp.send('Page.navigate', {
    url: `${APP_BASE}/app/floorplan-editor?building=${encodeURIComponent('1080/6100/AA')}&tab=ausstattung`,
  }, page.sessionId);
  await sleep(500);
  const legacy = await page.evaluate(`(() => {
    const text = node => (node?.textContent || '').split(/\\s+/).join(' ').trim();
    const panel = document.querySelector('.tab__container:not([hidden])');
    return {
      tabs: [...document.querySelectorAll('#fpe-object [role="tab"]')].map(text),
      empty: text(panel?.querySelector('.empty')),
      action: panel?.querySelector('.empty__action')?.getAttribute('href') || '',
      tables: panel ? panel.querySelectorAll('table').length : -1,
    };
  })()`);
  check(/Ausstattung \(0\)/.test(legacy.tabs.join(' ')) && legacy.tables === 0
    && /kein Möblierungsbestand/.test(legacy.empty),
  'explains a legacy object that carries no furniture data instead of showing an empty table',
  legacy.empty.slice(0, 80));
  check(/plan-check\?building=1080%2F6100%2FAA/.test(legacy.action),
    'gives that empty state the portal empty-state action rather than advice alone', legacy.action);

  // A floor chosen in the structure tree is a request to LOCATE a plan, not to
  // open it. It used to drop straight into the workbench, taking the second
  // decision uninvited.
  await cdp.send('Page.navigate', { url: `${APP_BASE}/app/floorplan-editor` }, page.sessionId);
  await sleep(600);
  await waitFor(page, '.fpe-browse__tree .pf-tree__leaf', 10000);
  await page.evaluate(`(() => {
    document.querySelectorAll('.fpe-browse__tree .pf-tree__node').forEach(node => node.click());
    const leaf = [...document.querySelectorAll('.fpe-browse__tree .pf-tree__leaf--parent')]
      .find(node => node.dataset.obj === ${JSON.stringify(BUILDING_ID)});
    leaf?.click();
    leaf?.closest('.pf-tree__item')?.querySelector('.pf-tree__sub')?.click();
  })()`);
  check(await waitFor(page, '.fpe-plans table tbody tr', 10000),
    'follows a floor from the tree into the building detail rather than the canvas');
  const treeFloor = await page.evaluate(`(() => {
    const text = node => (node?.textContent || '').split(/\\s+/).join(' ').trim();
    const rows = [...document.querySelectorAll('.fpe-plans table tbody tr')];
    return {
      hash: location.hash,
      tab: document.querySelector('#fpe-object')?.dataset.tab || '',
      canvas: !!document.querySelector('#fpe-canvas'),
      marked: rows.filter(row => row.classList.contains('is-marked')).map(row => text(row.querySelector('th'))),
      current: text(document.querySelector('.fpe-plans table [aria-current="location"]')),
      rows: rows.length,
    };
  })()`);
  check(!treeFloor.canvas && treeFloor.tab === 'plans' && treeFloor.rows === 3
    && treeFloor.marked.join(',') === '2. OG' && treeFloor.current === '2. OG',
  'marks exactly the chosen floor in the plan register instead of opening it',
  `${treeFloor.marked.join('/')} of ${treeFloor.rows} · canvas ${treeFloor.canvas}`);
  check(treeFloor.hash.includes(PLANS_TAB_QUERY) && /mark=1080-6650-AA-2og/.test(treeFloor.hash)
    && !/[?&]floor=/.test(treeFloor.hash),
  'addresses the marked floor without the key that opens the workbench', treeFloor.hash);

  // Cards and rows are links into the detail view, with no second handler
  // rewriting the URL in the same tick.
  await cdp.send('Page.navigate', { url: `${APP_BASE}/app/floorplan-editor?mode=cards` }, page.sessionId);
  await sleep(600);
  await waitFor(page, '[data-browse-row]', 10000);
  const cardJump = await page.evaluate(`(async () => {
    const href = document.querySelector('[data-browse-row] a')?.getAttribute('href') || '';
    document.querySelector('[data-browse-row] a')?.click();
    await new Promise(resolve => setTimeout(resolve, 600));
    return {
      href, hash: location.hash,
      h1: (document.querySelector('#fpe-object h1')?.textContent || '').trim(),
      detail: !!document.querySelector('#fpe-object'),
    };
  })()`);
  check(cardJump.detail && /^#\/app\/floorplan-editor\?building=/.test(cardJump.href)
    && cardJump.hash === cardJump.href && cardJump.h1.length > 0,
  'sends a gallery card straight to the object detail it points at',
  `${cardJump.href} → ${cardJump.h1}`);
  await checkProblems(page, 'building detail has no runtime problems');

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
      uploadInHeader: !!document.querySelector('.fpe-header #fpe-plan-upload'),
      uploadCount: document.querySelectorAll('#fpe-plan-upload').length,
      uploadInPageHead: document.querySelectorAll('.fpe-work__head .btn').length,
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
  check(work.uploadInHeader && work.uploadCount === 1 && work.uploadInPageHead === 0,
    'keeps the plan upload in the header rather than repeating it in the queue',
    `${work.uploadCount} in header · ${work.uploadInPageHead} in page head`);
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
        .map(node => node.textContent.split(' ').filter(Boolean).join(' ').trim()),
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
        colorGlyph: document.querySelectorAll('#fpe-color-trigger .fpe-element-icon').length,
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
        actionOrder: [...document.querySelectorAll('.fpe-view-nav__actions [data-action]')]
          .map(button => button.dataset.action),
      },
      toolIcons: Object.fromEntries(['tool-select', 'tool-pan', 'tool-measure'].map(action => [action,
        document.querySelector('[data-action="' + action + '"] .icon')?.style.maskImage || ''])),
      designPolish: (() => {
        const inspector = document.querySelector('#fpe-right');
        const toolbar = document.querySelector('.fpe-toolbar');
        const viewModes = document.querySelector('.fpe-view-nav');
        const toolbarStyle = toolbar ? getComputedStyle(toolbar) : null;
        const viewStyle = viewModes ? getComputedStyle(viewModes) : null;
        return {
          inspectorIcons: inspector?.querySelectorAll('.fpe-inspector-title .icon').length || 0,
          inspectorCloseIcon: inspector?.querySelector('.fpe-inspector-title [data-action="toggle-right"] .icon')
            ?.getAttribute('style') || '',
          sectionRules: (() => {
            const sections = [...(inspector?.querySelectorAll('.fpe-inspector-section') || [])];
            const width = (node, side) => parseFloat(getComputedStyle(node)['border' + side + 'Width']) || 0;
            return {
              count: sections.length,
              bottoms: sections.filter(node => width(node, 'Bottom') > 0).length,
              firstTop: sections[0] ? width(sections[0], 'Top') : -1,
              laterTops: sections.slice(1).filter(node => width(node, 'Top') > 0).length,
            };
          })(),
          redundantHints: /Wählen Sie einen Raum|Klick: auswählen|Links: verschieben|Rechts: drehen/.test(document.querySelector('#fpe-app')?.textContent || ''),
          toolbarBorderContrast: toolbarStyle ? contrast(toolbarStyle.borderTopColor, toolbarStyle.backgroundColor) : 0,
          viewBorderContrast: viewStyle ? contrast(viewStyle.borderTopColor, viewStyle.backgroundColor) : 0,
        };
      })(),
      prototypeFooter: {
        label: document.querySelector('.fpe-local-note__label')?.textContent.trim() || '',
        icons: document.querySelectorAll('.fpe-local-note .icon').length,
        links: [...document.querySelectorAll('.fpe-local-note a')].map(link => ({
          label: link.textContent.trim(), href: link.href, target: link.target, rel: link.rel,
        })),
        plainLabel: (() => {
          const label = document.querySelector('.fpe-local-note__label');
          if (!label) return false;
          const weight = getComputedStyle(label).fontWeight;
          return Number(weight) < 600 && weight !== 'bold';
        })(),
        underlined: [...document.querySelectorAll('.fpe-local-note a')]
          .filter((link) => getComputedStyle(link).textDecorationLine.includes('underline')).length,
        labelLeftOfLinks: (() => {
          const label = document.querySelector('.fpe-local-note__label')?.getBoundingClientRect();
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
  check(initial.breadcrumb.length === 4 && initial.breadcrumb[0] === 'Kundenportal'
    && initial.breadcrumb[1] === 'Alle Objekte'
    && /Liebefeld/.test(initial.breadcrumb[2]) && initial.breadcrumb[3] === '2. OG'
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
    // Four pane pictograms, not five: the inspector's own close control is a plain
    // cross now, the same glyph every modal, notification and viewer closes with.
    // The colour control draws three swatches of one attribute, not stacked layers:
    // `Stack` read as z-order, and the set's only colour icon is a paintbrush, which
    // this is not — the plan is shaded by a category, not painted. Inline SVG, so the
    // assertion is on the glyph element rather than on a mask URL.
    && initial.resourceTree.colorGlyph === 1 && !initial.resourceTree.colorIcon
    && initial.resourceTree.panelGlyphs === 4,
  'defaults to no coloring and renders a flat room tree without synthetic aggregation',
  `${initial.resourceTree.groups} groups · ${initial.resourceTree.roomRows} rooms · ${initial.resourceTree.roomNameInset}px name inset`);
  check(initial.planActions.more === 'menu' && initial.planActions.items === 7
    && !initial.planActions.historyInToolbar,
  'separates plan-level actions from canvas tools', `${initial.planActions.items} actions`);
  check(initial.prototypeFooter.label === 'Feedback-Prototyp' && initial.prototypeFooter.icons === 0
    && initial.prototypeFooter.labelLeftOfLinks
    // Quiet by design: the footer is a standing note, so no bold label and no underline
    // at rest. The underline returns on hover and focus, which is asserted separately.
    && initial.prototypeFooter.plainLabel && initial.prototypeFooter.underlined === 0
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
    && initial.viewNavigation.minimumTarget >= 44 && initial.viewNavigation.navigationInTopToolbar === 0
    // Zoom in sits ABOVE zoom out, as everywhere else in the portal: the stack reads
    // as a scale with «more» at the top.
    && initial.viewNavigation.actionOrder.join(',') === 'zoom-in,zoom-out,fit,fit-selection',
  'separates the mode switcher from right-side camera controls with consistent text-only modes',
  `${initial.viewNavigation.modes} modes · ${initial.viewNavigation.actions} view actions · ${Math.round(initial.viewNavigation.minimumTarget)}px targets`);
  check(/Pointer\.svg/.test(initial.toolIcons['tool-select'])
    && /Move\.svg/.test(initial.toolIcons['tool-pan'])
    && /Ruler\.svg/.test(initial.toolIcons['tool-measure']),
  'uses purpose-specific select, pan, and measuring icons from the local icon set');
  // The inspector title carries exactly ONE icon: the cross that closes the panel.
  // It used to carry a pane pictogram, which reads as «change the layout» rather
  // than «close this», and the panel had no cross at all.
  check(initial.designPolish.inspectorIcons === 1 && !initial.designPolish.redundantHints
    && /Cancel\.svg/.test(initial.designPolish.inspectorCloseIcon)
    // Sections are separated by a line ABOVE. A border-bottom on each of them drew a
    // rule under the last one that closed nothing off and read as a cut-off panel;
    // the title already carries its own bottom border, so the first section skips.
    && initial.designPolish.sectionRules.count >= 2
    && initial.designPolish.sectionRules.bottoms === 0
    && initial.designPolish.sectionRules.firstTop === 0
    && initial.designPolish.sectionRules.laterTops === initial.designPolish.sectionRules.count - 1
    && initial.designPolish.toolbarBorderContrast >= 3 && initial.designPolish.viewBorderContrast >= 3,
  'closes the inspector with the portal cross and keeps the rest of its chrome text-only',
  `${initial.designPolish.toolbarBorderContrast.toFixed(2)}:1 / ${initial.designPolish.viewBorderContrast.toFixed(2)}:1`);

  // Two controls that the rail rework left lying about their state. The colour trigger
  // carries aria-haspopup and aria-controls; in edit mode the menu it names was not
  // rendered at all, so it was a dead control that also left colorMenuOpen stuck true
  // and swallowed the next Escape.
  const colourInEdit = await page.evaluate(`(async () => {
    const pause = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));
    const trigger = () => document.querySelector('#fpe-color-trigger');
    const controls = trigger()?.getAttribute('aria-controls') || '';
    const target = controls ? !!document.getElementById(controls) : false;
    trigger()?.click(); await pause(360);
    const opened = {
      expanded: trigger()?.getAttribute('aria-expanded') || '',
      menuVisible: !!document.querySelector('#fpe-color-menu:not([hidden])'),
      options: document.querySelectorAll('#fpe-color-menu [data-color-mode]').length,
    };
    document.querySelector('#fpe-stage')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await pause(360);
    const afterEscape = {
      expanded: trigger()?.getAttribute('aria-expanded') || '',
      menuVisible: !!document.querySelector('#fpe-color-menu:not([hidden])'),
    };
    return { controls, target, opened, afterEscape };
  })()`);
  check(colourInEdit.controls === 'fpe-color-menu' && colourInEdit.target
    && colourInEdit.opened.expanded === 'true' && colourInEdit.opened.menuVisible
    && colourInEdit.opened.options === 5
    && colourInEdit.afterEscape.expanded === 'false' && !colourInEdit.afterEscape.menuVisible,
  'renders the colour menu in edit mode, so its trigger is not a control pointing at nothing',
  `controls ${colourInEdit.controls} present ${colourInEdit.target} · ${colourInEdit.opened.options} options`);

  // The resource tree in the portal's tree language. Same contract as
  // test-spatial-tree asserts for .pf-tree: indentation as row padding so every
  // divider reaches both edges, one divider weight, a guide only along the selected
  // branch, two-tone selection, and counts that stay machine-readable.
  const resourceTree = await page.evaluate(`(async () => {
    const pause = (ms = 220) => new Promise(resolve => setTimeout(resolve, ms));
    const inset = node => node ? parseFloat(getComputedStyle(node).paddingLeft) : -1;
    const divider = node => node ? getComputedStyle(node).borderBottomColor : '';
    const guide = node => {
      if (!node) return { drawn: false, width: 0, left: 0 };
      const style = getComputedStyle(node, '::before');
      return { drawn: style.content !== 'none', width: parseFloat(style.width) || 0, left: parseFloat(style.left) || 0 };
    };
    // Grouped view: three levels, so indentation has something to express.
    document.querySelector('#fpe-color-trigger')?.click(); await pause();
    document.querySelector('[data-color-mode="sia"]')?.click(); await pause(320);
    // Query fresh after every redraw: opening a group replaces the whole list, and a
    // detached node reports no computed style at all.
    const head = () => document.querySelector('.fpe-resource-group__head');
    head()?.click(); await pause(320);
    document.querySelector('.fpe-resource-rooms .fpe-resource-room-toggle:not([disabled])')?.click();
    await pause(320);
    const roomLine = () => document.querySelector('.fpe-resource-rooms .fpe-resource-room-line');
    const assetRow = () => document.querySelector('.fpe-resource-row--asset');
    const count = head()?.querySelector('.fpe-resource-n');
    const insets = { head: inset(head()), room: inset(roomLine()), asset: inset(assetRow()) };
    const dividers = { head: divider(head()), room: divider(roomLine()), asset: divider(assetRow()) };
    // Select the object, which makes its room an ancestor of the selection.
    assetRow()?.click(); await pause(360);
    const selectedAsset = document.querySelector('.fpe-resource-row--asset.is-selected');
    const pathRoom = document.querySelector('.fpe-resource-room-line.is-path');
    const style = selectedAsset ? getComputedStyle(selectedAsset) : null;
    const pathStyle = pathRoom ? getComputedStyle(pathRoom) : null;
    const holding = document.querySelector('.fpe-resource-assets:has(.is-selected)');
    const quiet = [...document.querySelectorAll('.fpe-resource-assets')]
      .filter(list => !list.querySelector('.is-selected'));
    return {
      insets, dividers,
      countText: count?.textContent.trim() || '',
      countNumeric: Number.isFinite(Number(count?.textContent.trim())),
      selectedBar: style?.boxShadow || '',
      selectedBackground: style?.backgroundColor || '',
      pathBackground: pathStyle?.backgroundColor || '',
      guideOnHolder: guide(holding),
      guidesElsewhere: quiet.filter(list => guide(list).drawn).length,
      rooms: document.querySelectorAll('.fpe-resource-room-line').length,
    };
  })()`);
  await page.evaluate(`(async () => {
    const pause = (ms = 260) => new Promise(resolve => setTimeout(resolve, ms));
    document.querySelector('#fpe-color-trigger')?.click(); await pause();
    document.querySelector('[data-color-mode="none"]')?.click(); await pause(320);
    document.querySelector('[data-action="clear-selection"]')?.click(); await pause(260);
  })()`);
  const indentStep = resourceTree.insets.room - resourceTree.insets.head;
  check(indentStep === 16
    // The object row clears its room's disclosure column as well as one level.
    && resourceTree.insets.asset > resourceTree.insets.room
    // One divider weight and colour across all three levels.
    && new Set(Object.values(resourceTree.dividers)).size === 1
    // The count renders as (n) through pseudo-elements, so the text stays a number.
    && resourceTree.countNumeric && !/[()]/.test(resourceTree.countText)
    // Two tones: the selection dark with a primary bar, its room light.
    && /rgb/.test(resourceTree.selectedBar)
    && resourceTree.selectedBackground !== resourceTree.pathBackground
    && resourceTree.pathBackground !== 'rgba(0, 0, 0, 0)'
    // The guide is drawn on the list that holds the selection and nowhere else.
    && resourceTree.guideOnHolder.drawn && resourceTree.guideOnHolder.width >= 2
    && resourceTree.guidesElsewhere === 0,
  'draws the resource tree in the portal tree language: one indent step, one divider, guide only in the selected branch',
  `insets ${JSON.stringify(resourceTree.insets)} · count ${resourceTree.countText} · guide ${resourceTree.guideOnHolder.width}px · strays ${resourceTree.guidesElsewhere}`);

  // Every menu must cover the chrome that launched it. Asserted by HIT-TESTING the
  // menu's own box rather than by comparing numbers: the numbers were «correct» against
  // the documented rungs while «Mehr» opened behind its own toolbar, because the scale
  // stopped at `toolbar` and a toolbar-anchored menu had nowhere above it to sit.
  const menuOrder = await page.evaluate(`(async () => {
    const pause = (ms = 340) => new Promise(resolve => setTimeout(resolve, ms));
    const escape = () => document.querySelector('#fpe-stage')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const reaches = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return '(missing)';
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height) return '(zero box)';
      const hit = document.elementFromPoint(box.left + box.width / 2,
        box.top + Math.min(24, box.height / 2));
      if (!hit) return '(nothing)';
      if (node.contains(hit)) return 'menu';
      return hit.closest('.fpe-toolbar') ? 'toolbar' : 'other';
    };
    const toolbarZ = Number(getComputedStyle(document.querySelector('.fpe-toolbar-host')).zIndex);
    const open = async (trigger, selector) => {
      document.querySelector(trigger)?.click();
      await pause(420);
      const node = document.querySelector(selector);
      const result = { z: node ? Number(getComputedStyle(node).zIndex) : null, reaches: reaches(selector) };
      escape(); await pause(320);
      return result;
    };
    return {
      toolbarZ,
      more: await open('[data-action="toggle-more-menu"]', '.fpe-more-menu'),
      structure: await open('[data-action="toggle-structure-menu"]', '.fpe-structure-menu'),
      colour: await open('#fpe-color-trigger', '#fpe-color-menu'),
    };
  })()`);
  check(menuOrder.toolbarZ > 0
    && menuOrder.more.reaches === 'menu' && menuOrder.more.z > menuOrder.toolbarZ
    // The structure menu exists only in edit mode, so on this page it is absent. It
    // draws from the same `--fpe-z-menu` rung as «Mehr», which is asserted strictly
    // above, so the token is covered either way.
    && ['menu', '(missing)'].includes(menuOrder.structure.reaches)
    && menuOrder.colour.reaches === 'menu',
  'opens every plan-editor menu above the chrome that launched it',
  `toolbar ${menuOrder.toolbarZ} · more ${menuOrder.more.z}/${menuOrder.more.reaches} · structure ${menuOrder.structure.z}/${menuOrder.structure.reaches} · colour ${menuOrder.colour.reaches}`);

  // One measuring tool, Google-Maps style: points make a length, closing the ring
  // makes an area with its perimeter, a click on a set point removes it, and the
  // reading can be dismissed without leaving the tool.
  const measure = await page.evaluate(`(async () => {
    const pause = (ms = 140) => new Promise(resolve => setTimeout(resolve, ms));
    const stage = () => document.querySelector('#fpe-stage');
    const key = (name, times = 1) => {
      for (let i = 0; i < times; i++) {
        stage()?.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
      }
    };
    const reading = () => {
      const box = document.querySelector('.fpe-measure-result');
      return { text: box?.querySelector('.fpe-measure-result__value')?.textContent.trim() || '',
        hidden: box?.hidden ?? null, dismissible: !!box?.querySelector('[data-action="clear-measure"]') };
    };
    const dots = () => document.querySelectorAll('.fpe-measure circle').length;
    document.querySelector('[data-action="tool-measure"]')?.click(); await pause(200);
    const tools = document.querySelectorAll('[data-action="tool-distance"],[data-action="tool-area"]').length;
    stage()?.focus();
    key(' '); await pause();
    const onePoint = { ...reading(), dots: dots() };
    key('ArrowRight', 12); key(' '); await pause();
    const twoPoints = { ...reading(), dots: dots() };
    key('ArrowDown', 12); key(' '); await pause();
    key('ArrowLeft', 6); key(' '); await pause();
    const fourPoints = { ...reading(), dots: dots() };
    key('Enter'); await pause(200);
    const closed = { ...reading(), dots: dots(), polygon: !!document.querySelector('.fpe-measure__area'),
      closeTarget: !!document.querySelector('.fpe-measure__close-target') };
    // A click on a set point removes it. Take the second, so the rule for the first
    // (which closes the ring) is not the one under test.
    const second = document.querySelectorAll('.fpe-measure circle')[1];
    const rect = second?.getBoundingClientRect();
    if (rect) {
      const target = document.querySelector('#fpe-canvas') || stage();
      for (const type of ['pointerdown', 'pointerup']) {
        target?.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 44,
          pointerType: 'mouse', button: 0, buttons: type === 'pointerdown' ? 1 : 0,
          clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
      }
      await pause(220);
    }
    const removed = { ...reading(), dots: dots() };
    document.querySelector('[data-action="clear-measure"]')?.click(); await pause(200);
    const cleared = { ...reading(), dots: dots() };
    document.querySelector('[data-action="tool-select"]')?.click(); await pause();
    return { tools, onePoint, twoPoints, fourPoints, closed, removed, cleared };
  })()`);
  check(measure.tools === 0
    // One point has no length yet, so the card counts instead of staying blank —
    // an open measurement should never look like no measurement.
    && measure.onePoint.text === '1 Punkt' && measure.onePoint.dots === 1
    // A length, not an area. The number is locale-formatted and may carry a
    // non-breaking space, so match the unit rather than a word boundary.
    && measure.twoPoints.text.endsWith('m') && !/m²/.test(measure.twoPoints.text)
    && measure.twoPoints.dots === 2
    && measure.fourPoints.dots === 4
    && /m²/.test(measure.closed.text) && /Umfang/.test(measure.closed.text)
    && measure.closed.polygon && measure.closed.dots === 4
    // Nothing left to close once it is closed.
    && measure.closed.closeTarget === false
    && measure.removed.dots === 3
    && measure.cleared.dots === 0 && measure.cleared.hidden === true
    && measure.closed.dismissible,
  'measures with one tool: length from points, area and perimeter when closed, click to drop a point',
  `${measure.twoPoints.text} → ${measure.closed.text} → ${measure.removed.dots} dots → cleared`);

  // Closing the inspector is a choice, so a later selection must not reopen it — and
  // must not vanish either. The inspector is the only place a selection is described, so
  // a silent close swallowed the answer: the room lit up on the plan and nothing said
  // why. The toggle carries the marker, and its accessible name says it in words.
  const hiddenSelection = await page.evaluate(`(async () => {
    const pause = (ms = 420) => new Promise(resolve => setTimeout(resolve, ms));
    const toggle = () => document.querySelector('#fpe-toggle-right');
    const snap = () => ({
      open: document.querySelector('#fpe-app')?.classList.contains('has-right') || false,
      pending: toggle()?.classList.contains('has-pending') || false,
      dot: !!document.querySelector('#fpe-toggle-right .fpe-panel-toggle__dot'),
      label: toggle()?.getAttribute('aria-label') || '',
    });
    // The inspector's own X, which used to be display:none outside compact viewports.
    const closer = document.querySelector('.fpe-inspector-title .fpe-drawer-close');
    const closerVisible = closer ? getComputedStyle(closer).display !== 'none' : false;
    const before = snap();
    closer?.click(); await pause();
    const closed = snap();
    const room = document.querySelector('.fpe-room[data-id]');
    for (const type of ['pointerdown', 'pointerup']) {
      room?.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 33,
        pointerType: 'mouse', button: 0, buttons: type === 'pointerdown' ? 1 : 0 }));
    }
    await pause(520);
    const selected = snap();
    toggle()?.click(); await pause();
    const reopened = snap();
    // Put the floor inspector back. Selecting a room swaps the whole panel, and the
    // section-collapse probe below addresses the floor inspector's own sections by id.
    document.querySelector('#fpe-stage')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await pause();
    return { closerVisible, before, closed, selected, reopened,
      restored: !!document.querySelector('#fpe-section-floor-attributes') };
  })()`);
  check(hiddenSelection.closerVisible
    && hiddenSelection.before.open && !hiddenSelection.before.pending
    && !hiddenSelection.closed.open
    // Selecting behind a closed inspector neither reopens it nor goes unreported.
    && !hiddenSelection.selected.open && hiddenSelection.selected.pending
    && hiddenSelection.selected.dot && /ausgewählt/.test(hiddenSelection.selected.label)
    // Reopening clears the marker, because the answer is on screen again.
    && hiddenSelection.reopened.open && !hiddenSelection.reopened.pending
    && hiddenSelection.restored,
  'respects a closed inspector and marks the toggle when a selection waits behind it',
  `closer ${hiddenSelection.closerVisible} · selected-while-closed pending ${hiddenSelection.selected.pending} · ${hiddenSelection.selected.label}`);

  // Inspector sections fold away. The heading is a real button with `aria-expanded`
  // and `aria-controls`, built like the resource tree's own group disclosure rather
  // than as a second kind of toggle.
  const collapsible = await page.evaluate(`(async () => {
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const head = () => document.querySelector('[data-inspector-section="floor-attributes"]');
    const body = () => document.querySelector('#fpe-section-floor-attributes');
    const first = { expanded: head()?.getAttribute('aria-expanded'), hidden: body()?.hidden,
      controls: head()?.getAttribute('aria-controls') || '', chevron: head()?.querySelector('.icon')?.getAttribute('style') || '' };
    head()?.click(); await pause(120);
    const shut = { expanded: head()?.getAttribute('aria-expanded'), hidden: body()?.hidden,
      chevron: head()?.querySelector('.icon')?.getAttribute('style') || '',
      focused: document.activeElement === head() };
    head()?.click(); await pause(120);
    return { first, shut, reopened: { expanded: head()?.getAttribute('aria-expanded'), hidden: body()?.hidden },
      heads: document.querySelectorAll('.fpe-inspector-section__head').length,
      bareHeadings: [...document.querySelectorAll('.fpe-inspector-section > h3')]
        .filter(node => !node.querySelector('.fpe-inspector-section__head')).length };
  })()`);
  check(collapsible.first.expanded === 'true' && collapsible.first.hidden === false
    && collapsible.first.controls === 'fpe-section-floor-attributes'
    && /ChevronDown\.svg/.test(collapsible.first.chevron)
    && collapsible.shut.expanded === 'false' && collapsible.shut.hidden === true
    && /ChevronRight\.svg/.test(collapsible.shut.chevron) && collapsible.shut.focused
    && collapsible.reopened.expanded === 'true' && collapsible.reopened.hidden === false
    && collapsible.heads >= 3 && collapsible.bareHeadings === 0,
  'collapses inspector sections from their heading and keeps focus on the control',
  `${collapsible.heads} disclosures · ${collapsible.bareHeadings} bare headings`);
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

  // Both views express zoom as a ratio of «everything fits», which is unit-free,
  // so a switch has to land on the same place at the same zoom instead of resetting.
  const cameraBridge = await page.evaluate(`(async () => {
    const pause = (ms = 200) => new Promise(r => setTimeout(r, ms));
    document.querySelector('[data-action="view-2d"]')?.click();
    await pause(400);
    const read = () => (document.querySelector('#fpe-canvas')?.getAttribute('viewBox') || '').split(/\\s+/).map(Number);
    const fit = read();
    document.querySelector('#fpe-action-zoom-in')?.click(); await pause();
    document.querySelector('#fpe-action-zoom-in')?.click(); await pause(300);
    const zoomed = read();
    const planRatio = zoomed[2] / fit[2];
    document.querySelector('#fpe-view-3d')?.click();
    await pause(2400);
    const host = document.querySelector('#fpe-three-host');
    return { planRatio: planRatio.toFixed(2), threeRatio: Number(host?.dataset.orbitFitRatio || 0).toFixed(2) };
  })()`);
  check(Math.abs(Number(cameraBridge.planRatio) - Number(cameraBridge.threeRatio)) <= 0.12
    && Number(cameraBridge.threeRatio) < 0.95,
  'carries the plan zoom into the 3D view instead of resetting it',
  `plan ${cameraBridge.planRatio} · 3D ${cameraBridge.threeRatio}`);

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
      treeVisible: (() => {
        const rail = document.querySelector('#fpe-left');
        return Boolean(rail && getComputedStyle(rail).visibility === 'visible'
          && rail.getAttribute('aria-label') === 'Ressourcen'
          && rail.querySelector('#fpe-left-list')?.children.length);
      })(),
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
      treeVisible: (() => {
        const rail = document.querySelector('#fpe-left');
        return Boolean(rail && getComputedStyle(rail).visibility === 'visible'
          && rail.getAttribute('aria-label') === 'Ressourcen'
          && rail.querySelector('#fpe-left-list')?.children.length);
      })(),
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
    // The structure tree stays in the rail in the 3D model too. It used to vanish
    // there — not because of the renderer, but because edit mode handed the rail to
    // the library and closed it.
    && views.threeD.treeVisible
    && views.threeD.toolbarVisible && views.threeD.toolbarHints === 0 && !views.threeD.toolbarPrint
    && views.threeD.zoomButtons === 2 && views.threeD.zoomButtonsWork
    && views.threeD.leftPans && views.threeD.leftPanDirection && views.threeD.clickJitterStable
    && views.threeD.cameraAspectMatches && views.threeD.normalizedPanScale && views.threeD.rightRotates
    && views.threeD.retainedViewer && views.threeD.contextLost && views.threeD.contextRestored
    && views.threeD.hintCards === 0 && views.keyboardThreeD === '3d',
  'builds the live Three.js model with visible controls, button zoom, left-pan/right-rotate, and preserved camera state',
  `${views.threeD.renderer} · ${views.threeD.rooms} rooms · ${views.threeD.placements} objects`);
  check(views.walk.active === 'true' && views.walk.classed && /^Three\.js r\d+/.test(views.walk.renderer)
    && /keyboard-walk/.test(views.walk.controls) && views.walk.moved && views.walk.directionsCorrect
    && views.walk.toolbarVisible && views.walk.toolbarHints === 0 && !views.walk.toolbarPrint
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
      libraryOpen: !!document.querySelector('#fpe-library'),
      treeOpen: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
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
      libraryOpen: !!document.querySelector('#fpe-library'),
      treeOpen: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
      libraryQuery: new URLSearchParams(location.hash.split('?')[1] || '').get('library') || '',
      addPressed: document.querySelector('[data-action="toggle-library"]')?.getAttribute('aria-pressed') || '',
      libraryName: document.querySelector('#fpe-library .modal__title')?.textContent.trim() || '',
      libraryRole: document.querySelector('#fpe-library .modal__content')?.getAttribute('role') || '',
      libraryModal: document.querySelector('#fpe-library')?.getAttribute('aria-modal') || '',
    };
    const productsTab = document.querySelector('[data-library="products"]');
    productsTab?.focus();
    productsTab?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await pause();
    const modulesViaKeyboard = document.querySelector('[data-library="modules"]')?.getAttribute('aria-selected') === 'true'
      && document.activeElement?.dataset.library === 'modules';
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); await pause();
    const productsViaKeyboard = document.querySelector('[data-library="products"]')?.getAttribute('aria-selected') === 'true'
      && document.activeElement?.dataset.library === 'products';
    // Select an existing OBJECT rather than deselecting. What this step needs is «no room
    // selected», so the product click arms instead of placing into the room centre — and
    // Escape is not a substitute here: it also closes the library, because leaving the add
    // tool closes it by design.
    fire(document.querySelector('.fpe-placement[data-id]')); await pause();
    const stagedProduct = document.querySelector('.fpe-product[data-product]');
    if (!stagedProduct) return { error: 'product library is empty before placement staging' };
    fire(stagedProduct); await pause();
    const staged = {
      libraryOpen: !!document.querySelector('#fpe-library'),
      treeOpen: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
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
      rail: document.querySelector('#fpe-left')?.getAttribute('aria-label') || '',
      libraryOpenAfterPlacement: !!document.querySelector('#fpe-library'),
      treeOpenAfterPlacement: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
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
  // The resource tree stays in the rail in edit mode, and the library is a dialog:
  // one slot cannot be both a navigation tree and a furniture picker, and making it
  // both is why the tree vanished the moment anyone started editing.
  check(!added.error && added.editing && added.rail === 'Ressourcen'
    && added.entry.treeOpen && added.opened.treeOpen && added.staged.treeOpen
    && added.opened.libraryName === 'Bibliothek' && added.opened.libraryRole === 'dialog'
    && added.opened.libraryModal === 'true'
    && added.editStateInHeader && !added.editStateInContext && added.editStateCenterDelta <= 1
    && /rgb/.test(added.twoDEditBorder.shadow) && added.twoDEditBorder.shadow === added.threeDEditBorder.shadow
    // Above the scene, below the menus, and never intercepting a click. Asserted as an
    // ORDER rather than as the literal 30 it used to be: that number was a private
    // z-index scale the CSS gate forbids in source, so the test was pinning the one
    // thing the codebase was trying to remove.
    && added.threeDEditBorder.zIndex > 0 && added.threeDEditBorder.zIndex < 5
    && added.threeDEditBorder.pointerEvents === 'none'
    && !added.entry.libraryOpen && !added.entry.libraryQuery && added.entry.addPressed === 'false'
    && added.entry.toolbarActions.join(',') === 'toggle-library,tool-select,tool-measure,toggle-structure-menu,undo,redo'
    && added.opened.libraryOpen && added.opened.libraryQuery === 'products' && added.opened.addPressed === 'true'
    && !added.staged.libraryOpen && !added.staged.libraryQuery && added.staged.addPressed === 'true' && added.staged.stageFocused
    && added.libraryKeyboard && !added.libraryOpenAfterPlacement && !added.libraryQueryAfterPlacement
    // The picker shuts once a product is chosen; the tree it used to displace stays.
    && added.treeOpenAfterPlacement
    // The product stays ARMED after a placement so a run of the same chair is one
    // click each instead of a trip back to the library, and the pressed Add button
    // is what makes that state visible. The library itself stays shut: it has done
    // its job the moment a product is chosen.
    && added.addPressedAfterPlacement === 'true',
  'starts edit mode with the wireframe toolbar and opens the library only through Add',
  added.error || `rail ${added.rail} · dialog ${added.opened.libraryName} · tree kept ${added.treeOpenAfterPlacement}`);
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

  // The placement preview in the plan. Neither view had any coverage for this, and
  // the 3D one was missing altogether.
  const ghost2d = await page.evaluate(`(async () => {
    const pause = (ms = 200) => new Promise(resolve => setTimeout(resolve, ms));
    // Re-query on every use. Each redraw replaces the scene's markup, so a handle held
    // across one is detached: its screen matrix degenerates to identity and events
    // dispatched on it reach no listener, which makes every later assertion read a
    // stale ghost and pass or fail for the wrong reason.
    const surface = () => document.querySelector('#fpe-canvas');
    if (!surface()) return { error: 'no 2D canvas' };
    const viewBox = surface().viewBox.baseVal;
    // The element's own screen matrix, not a linear viewBox scale: preserveAspectRatio
    // letterboxes the drawing inside the element.
    const toClient = (planX, planY) => {
      const svg = surface();
      const matrix = svg?.getScreenCTM();
      if (!matrix) return null;
      const point = svg.createSVGPoint();
      point.x = planX;
      point.y = planY;
      const screen = point.matrixTransform(matrix);
      return { x: screen.x, y: screen.y };
    };
    // Room footprints straight from the drawn shapes, so the probe agrees with what
    // is on screen rather than with a copy of the fixture.
    const rooms = [...document.querySelectorAll('.fpe-room')].map(group => {
      const shape = group.querySelector('rect, path, polygon');
      if (!shape || shape.tagName.toLowerCase() !== 'rect') return null;
      return {
        x: Number(shape.getAttribute('x')), y: Number(shape.getAttribute('y')),
        w: Number(shape.getAttribute('width')), h: Number(shape.getAttribute('height')),
      };
    }).filter(Boolean);
    const first = rooms[0];
    const centre = first ? { x: first.x + first.w / 2, y: first.y + first.h / 2 } : null;
    // A point inside the drawing but in no room. Ask the browser what is under the
    // point rather than re-deriving containment: rooms drawn as a path or a polygon
    // are not rects, and treating them as gaps produced a false negative.
    let gap = null;
    for (let py = viewBox.y + 30; py < viewBox.y + viewBox.height - 30 && !gap; py += 11) {
      for (let px = viewBox.x + 30; px < viewBox.x + viewBox.width - 30; px += 11) {
        const client = toClient(px, py);
        const node = document.elementFromPoint(client.x, client.y);
        if (node && !node.closest('.fpe-room') && node.closest('#fpe-canvas')) { gap = { x: px, y: py }; break; }
      }
    }
    const move = point => {
      const client = toClient(point.x, point.y);
      if (!client) return;
      surface()?.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true,
        pointerId: 12, pointerType: 'mouse', buttons: 0, clientX: client.x, clientY: client.y }));
    };
    const read = () => {
      const node = document.querySelector('.fpe-ghost');
      return node ? (node.classList.contains('is-valid') ? 'valid' : 'invalid') : 'none';
    };
    const before = read();
    if (centre) { move(centre); await pause(260); }
    const onRoom = read();
    if (gap) { move(gap); await pause(260); }
    const onGap = read();
    // The fitted camera pads the viewBox beyond the floor, so a point in that margin
    // is on the canvas but off the plan. No preview belongs there.
    move({ x: -60, y: -60 }); await pause(320);
    const offPlan = read();
    // Restore the pointer to a valid spot. The keyboard cursor follows the pointer, so
    // leaving it in a gap makes the next probe's Enter land outside every room and be
    // refused — which is correct behaviour, and a trap for a probe that does not know it.
    if (centre) { move(centre); await pause(260); }
    if (centre) { move(centre); await pause(260); }
    return { error: '', rooms: rooms.length, before, onRoom, onGap, offPlan, hasGap: Boolean(gap),
      restored: read() };
  })()`);
  check(!ghost2d.error && ghost2d.rooms > 0 && ghost2d.onRoom === 'valid'
    // Off the plan there is no preview at all. The floor ray in 3D meets an infinite
    // plane, so without this guard a preview could sit tens of metres past the
    // building; the plan's padded viewBox makes the same case reachable here.
    && ghost2d.offPlan === 'none'
    && ghost2d.restored === 'valid',
  'previews the armed product under the pointer in the plan and tints it by validity',
  ghost2d.error || `room ${ghost2d.onRoom} · gap ${ghost2d.onGap} · off-plan ${ghost2d.offPlan}`);

  // The dialog declares aria-modal, so it has to enforce it. A container that claims
  // modality without trapping anything is worse than one that claims nothing: a screen
  // reader stops describing the page while Tab still walks behind it, and the editor's
  // own shortcuts stayed live — Backspace deleted the selected object out of view.
  const modality = await page.evaluate(`(async () => {
    const pause = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));
    const fire = node => node?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const count = () => document.querySelectorAll('.fpe-placement').length;
    const inert = selector => document.querySelector(selector)?.inert ?? null;
    const closed = { workbench: inert('.fpe-workbench'), header: inert('.fpe-header') };
    fire(document.querySelector('[data-action="toggle-library"]')); await pause(420);
    const open = {
      dialog: !!document.querySelector('#fpe-library'),
      workbench: inert('.fpe-workbench'), header: inert('.fpe-header'),
      surface: (() => {
        const card = document.querySelector('#fpe-library .card');
        return card ? getComputedStyle(card).backgroundColor : '';
      })(),
      contained: (() => {
        const content = document.querySelector('#fpe-library .modal__content');
        const tabs = document.querySelector('#fpe-library .fpe-library-tabs');
        if (!content || !tabs) return null;
        const a = content.getBoundingClientRect();
        const b = tabs.getBoundingClientRect();
        return b.left >= a.left - 1 && b.right <= a.right + 1;
      })(),
    };
    // Destructive keys must not reach the document behind the dialog — from OUTSIDE it,
    // and just as importantly from INSIDE. Product tiles are buttons, so focus normally
    // sits on one, and guarding only on outside events left every editor shortcut live.
    const before = count();
    document.querySelector('#fpe-stage')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    await pause(360);
    const afterOutside = count();
    const tile = document.querySelector('#fpe-library .fpe-product[data-product]');
    tile?.focus();
    const focusedTile = document.activeElement === tile;
    for (const key of ['Backspace', 'Delete', 'r', 'v', 'h']) {
      tile?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await pause(90);
    }
    await pause(320);
    const afterInside = count();
    const survived = !!document.querySelector('#fpe-library');
    const afterBackspace = afterInside;
    // Escape belongs to the dialog and closes it.
    document.querySelector('#fpe-stage')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await pause(420);
    const after = {
      dialog: !!document.querySelector('#fpe-library'),
      workbench: inert('.fpe-workbench'), header: inert('.fpe-header'),
    };
    // Put the armed product back. Escape closed the dialog AND disarmed, and the probes
    // below expect the run-of-the-same-object state the flow above established. Clicking
    // a product while a placement is selected arms without placing, so this restores the
    // tool without touching the document or the history.
    fire(document.querySelector('[data-action="toggle-library"]')); await pause(420);
    fire(document.querySelector('#fpe-library .fpe-product[data-product]')); await pause(420);
    const restored = {
      armed: document.querySelector('[data-action="toggle-library"]')?.getAttribute('aria-pressed') || '',
      count: count(),
    };
    return { closed, open, before, afterOutside, afterInside, focusedTile, survived, afterBackspace, after, restored };
  })()`);
  check(modality.closed.workbench === false && modality.closed.header === false
    && modality.open.dialog && modality.open.workbench === true && modality.open.header === true
    && modality.open.surface === 'rgb(255, 255, 255)' && modality.open.contained === true
    && modality.afterOutside === modality.before
    // Focus on a tile, five destructive or tool-switching keys, nothing changed and the
    // dialog is still standing.
    && modality.focusedTile && modality.afterInside === modality.before && modality.survived
    && !modality.after.dialog && modality.after.workbench === false && modality.after.header === false
    && modality.restored.armed === 'true' && modality.restored.count === modality.before,
  'enforces the library dialog modality: inert workbench, own surface, no destructive keys behind it',
  `inert ${modality.open.workbench} · surface ${modality.open.surface} · outside ${modality.before}→${modality.afterOutside} · on-tile ${modality.before}→${modality.afterInside} · dialog ${modality.survived}`);

  // A run of the same product: with the tool still armed, Enter on the stage stamps
  // another copy. This is the behaviour the pressed Add button above promises, and
  // the reason placing no longer ends after one object.
  const serialPlacement = await page.evaluate(`(async () => {
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const stage = document.querySelector('#fpe-stage');
    const armed = document.querySelector('[data-action="toggle-library"]')?.getAttribute('aria-pressed') || '';
    const before = document.querySelectorAll('.fpe-placement').length;
    stage?.focus?.();
    stage?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await pause(120);
    const after = document.querySelectorAll('.fpe-placement').length;
    const stillArmed = document.querySelector('[data-action="toggle-library"]')?.getAttribute('aria-pressed') || '';
    // Put the floor back the way the drag probe below expects to find it.
    document.querySelector('[data-action="undo"]')?.click();
    await pause(120);
    return { armed, before, after, stillArmed, restored: document.querySelectorAll('.fpe-placement').length };
  })()`);
  check(serialPlacement.armed === 'true' && serialPlacement.after === serialPlacement.before + 1
    && serialPlacement.stillArmed === 'true' && serialPlacement.restored === serialPlacement.before,
  'keeps the product armed so a run of the same object is one keystroke each',
  `${serialPlacement.before} → ${serialPlacement.after} → ${serialPlacement.restored}`);

  // Escape first: the placement tool stays armed on purpose, and while it is a
  // click on the stage stamps another copy rather than grabbing what is there.
  // This is the same order of operations a person uses — finish the run, then adjust.
  await page.evaluate(`(() => {
    const stage = document.querySelector('#fpe-stage');
    stage?.focus?.();
    stage?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  })()`);
  await new Promise(resolve => setTimeout(resolve, 120));
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
    // Unlocked, the menu shows the element catalogue behind the lock: every one of
    // them disabled, none of them a working tool.
    const unavailableTools = document.querySelectorAll('#fpe-structure-menu [role="menuitem"][disabled]:not([data-structure-element])').length;
    const elements = document.querySelectorAll('#fpe-structure-menu [data-structure-element]').length;
    const liveElements = document.querySelectorAll('#fpe-structure-menu [data-structure-element]:not([disabled])').length;
    const elementGlyphs = document.querySelectorAll('#fpe-structure-menu [data-structure-element] .fpe-element-icon').length;
    const elementHints = /Vorbereitung/.test(document.querySelector('#fpe-structure-menu')?.textContent || '');
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
    if (!corridorWidth || corridorBefore < 800) {
      return { error: 'corridor geometry is unavailable for the structural fixture', before };
    }
    corridorWidth.value = String(corridorBefore - 400);
    corridorWidth.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
    const corridor = document.querySelector('.fpe-room[data-id="' + corridorId + '"] > rect');
    const corridorX = Number(corridor?.getAttribute('x'));
    const corridorY = Number(corridor?.getAttribute('y'));
    const corridorAfter = Number(corridor?.getAttribute('width'));
    const corridorHeight = Number(corridor?.getAttribute('height'));
    if (![corridorX, corridorY, corridorAfter, corridorHeight].every(Number.isFinite)
      || corridorAfter !== corridorBefore - 400) {
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
    // Draw the 200x140 area well INSIDE the freed 400-unit strip, never flush
    // against the shortened corridor. One CSS pixel is roughly six plan units at
    // this zoom, so an edge placed exactly on the corridor's edge tips into a
    // sub-unit overlap as soon as the stage width changes — and the editor
    // rejects overlapping rooms, correctly. The clearance makes this fixture
    // exercise the area tool rather than the coordinate rounding.
    const start = client(corridorX + corridorAfter + 100, corridorY + 30);
    const end = client(corridorX + corridorAfter + 300,
      corridorY + Math.min(170, corridorHeight - 30));
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
      elements, liveElements, elementGlyphs, elementHints,
      middlePanDuringAuthoring, middleMoved, middleRoomStable, middleToolActive,
      middleBefore, middleAfter,
      libraryOpen: !!document.querySelector('#fpe-library'),
      treeOpen: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
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
    && structure.unavailableTools === 0 && structure.locked
    // The full range of structural elements is visible but inert: showing only the
    // room rectangle made structural editing look like a finished, very small
    // feature. Glyphs are inline SVG because the icon set has no architectural
    // symbols, and the caveat sits in the heading rather than on twelve rows.
    && structure.elements === 12 && structure.liveElements === 0
    && structure.elementGlyphs === 12 && structure.elementHints,
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
      // The variant now lives in the inspector's own attribute list, not as a chip in
      // the sub header: the version and draft workflow is being redesigned, and a chip
      // repeating one line of the inspector was the least useful place for it.
      version: (() => {
        const terms = [...document.querySelectorAll('#fpe-right .fpe-kv dt')];
        const term = terms.find((node) => /Variante/.test(node.textContent || ''));
        return term?.nextElementSibling?.textContent.trim() || '';
      })(),
      hash: location.hash,
    };
  })()`);
  check(saved.hasDraft && saved.schema === 'bbl.floorplan-editor.draft/v1'
    && saved.persistence === 'browser-local' && saved.floorId === FLOOR_ID,
  'writes a schema-marked draft only to the editor local-storage namespace',
  `${saved.schema} · ${saved.floorId}`);
  check(saved.roomValue === EDITED_OCCUPIER && saved.placements === added.after
    && saved.containsLocal && saved.containsRoom && saved.roomModule === '1' && saved.roomWidth === 200
    && saved.saveDisabled,
  'saves room, geometry, module, and placement changes, then clears the dirty state',
  `${saved.placements} placements · save disabled ${saved.saveDisabled}`);

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
      // The variant now lives in the inspector's own attribute list, not as a chip in
      // the sub header: the version and draft workflow is being redesigned, and a chip
      // repeating one line of the inspector was the least useful place for it.
      version: (() => {
        const terms = [...document.querySelectorAll('#fpe-right .fpe-kv dt')];
        const term = terms.find((node) => /Variante/.test(node.textContent || ''));
        return term?.nextElementSibling?.textContent.trim() || '';
      })(),
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
  check(published.publishDisabled
    && /V2.*lokal publiziert/i.test(published.historyText)
    && /V1.*Ausgangsstand/i.test(published.historyText)
    && /nur auf diesem Gerät/i.test(published.historyText),
  'shows honest prototype labelling and a V2/V1 local version history',
  `publish disabled ${published.publishDisabled}`);

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
      // The variant now lives in the inspector's own attribute list, not as a chip in
      // the sub header: the version and draft workflow is being redesigned, and a chip
      // repeating one line of the inspector was the least useful place for it.
      version: (() => {
        const terms = [...document.querySelectorAll('#fpe-right .fpe-kv dt')];
        const term = terms.find((node) => /Variante/.test(node.textContent || ''));
        return term?.nextElementSibling?.textContent.trim() || '';
      })(),
      hash: location.hash,
    };
  })()`);
  check(reloaded.standalone && reloaded.editMode && reloaded.selected === structure.localId
    && reloaded.storedRoom === EDITED_OCCUPIER && reloaded.containsRoom
    && reloaded.storedLocalModule === '1',
  'restores the saved room edits, new area, and shareable editor state after reload', reloaded.hash);
  check(reloaded.placements === added.after && reloaded.containsLocal
    ,
  'restores the saved user placement and local publication state after reload', `${reloaded.placements} placements`);
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
    document.querySelector('[data-action="toggle-left"]')?.click(); await pause();
    const shown = state();
    // Visible controls only: the resource tree keeps collapsed groups in the DOM
    // behind the hidden attribute, and a box with no client rects has no target.
    const minimumCustomTarget = Math.min(...[...document.querySelectorAll('.fpe-library-tabs button,.fpe-resource-row,.fpe-resource-room-toggle')]
      .filter(control => control.getClientRects().length > 0)
      .map(control => Math.min(control.getBoundingClientRect().width, control.getBoundingClientRect().height))
      .filter(Number.isFinite));

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
    rail: document.querySelector('#fpe-left')?.getAttribute('aria-label') || '',
  }))()`);
  check(desktopPanels.left && desktopPanels.right && desktopPanels.leftWidth > 0 && desktopPanels.rightWidth > 0
    && desktopPanels.rail === 'Ressourcen',
    'restores both rails after leaving compact mode, the left one still the resource tree',
    `${Math.round(desktopPanels.leftWidth)}/${Math.round(desktopPanels.rightWidth)}px · ${desktopPanels.rail}`);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 320, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await sleep(160);
  const compactReset = await page.evaluate(`(() => ({
    left: document.querySelector('#fpe-app')?.classList.contains('has-left') || false,
    right: document.querySelector('#fpe-app')?.classList.contains('has-right') || false,
  }))()`);
  check(!compactReset.left && !compactReset.right,
    'returns to compact mode with both drawers closed');

  await page.evaluate(`document.querySelector('.fpe-breadcrumb a:nth-of-type(3)')?.click()`);
  check(await waitFor(page, '#fpe-object'),
    'returns from the canvas to the building detail through the breadcrumb');
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
      crumb: (document.querySelector('.fpe-object .fpe-breadcrumb a')?.textContent || '').trim(),
      floors: (document.querySelector('#fpe-object .kpi-strip__value')?.textContent || '').trim(),
      homeHref: document.querySelector('#fpe-home')?.getAttribute('href') || '',
    };
  })()`);
  check(returnedNavigation.standalone && returnedNavigation.navigation && !returnedNavigation.canvas
    && !returnedNavigation.portalHeader && !returnedNavigation.portalFooter,
  'keeps the user inside the standalone Plan-Editor application', returnedNavigation.hash);
  check(/Liebefeld/.test(returnedNavigation.h1) && returnedNavigation.crumb === 'Kundenportal'
    && returnedNavigation.floors === '3'
    && /building=1080%2F6650%2FAA/i.test(returnedNavigation.hash) && !returnedNavigation.hash.includes('floor=')
    && returnedNavigation.homeHref === '#/app/floorplan-editor',
  'lands on the building detail of the plan that was open', `${returnedNavigation.h1} · ${returnedNavigation.hash}`);
  const compactDetail = await page.evaluate(`(() => {
    const aside = document.querySelector('.detail-layout__aside');
    const kpis = document.querySelector('#fpe-object .kpi-strip');
    return {
      asideWidth: aside ? Math.round(aside.getBoundingClientRect().width) : 0,
      kpiColumns: kpis ? getComputedStyle(kpis).gridTemplateColumns.split(' ').length : 0,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  check(compactDetail.asideWidth > 200 && compactDetail.kpiColumns === 2 && compactDetail.overflow <= 1,
    'stacks the building detail on a phone with a two-column key-figure strip',
    `aside=${compactDetail.asideWidth}px · ${compactDetail.kpiColumns} kpi columns · ${compactDetail.overflow}px overflow`);

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



  // A page of its own: every earlier flow leaves the editor in a different state,
  // and the assertions below need edit mode, the 3D view and a selected placement
  // together. It runs before the logout section, which clears the session for the
  // whole origin.
  const threePage = await openPage(cdp,
    `${ROUTE}&edit=1&view=3d&selected=${encodeURIComponent(`placement:${FLOOR_ID}--${ROOM_ID}--demo-1-24`)}`,
    { login: true });
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, threePage.sessionId);
  await sleep(3400);
  console.log(`
■ Authoring in the 3D view`);
  // Self-contained on purpose: edit mode, the 3D view and a selected placement
  // are requested through the URL instead of inherited, because every earlier
  // flow leaves the editor in a different state.
  await cdp.send('Page.navigate', { url: `${ROUTE}&edit=1&view=3d`
    + `&selected=${encodeURIComponent(`placement:${FLOOR_ID}--${ROOM_ID}--demo-1-24`)}` }, page.sessionId);
  await sleep(3200);

  // The toolbar used to disappear entirely outside the 2D plan, which read as a
  // broken view rather than a restricted one. It is shown everywhere now, with the
  // tools a renderer cannot carry out disabled AND named.
  const toolbar3d = await threePage.evaluate(`(() => {
    const bar = document.querySelector('#fpe-toolbar-host .fpe-toolbar');
    const btn = (id) => document.querySelector('#fpe-action-' + id);
    return {
      present: !!bar,
      selectEnabled: !btn('tool-select')?.disabled,
      libraryEnabled: !btn('toggle-library')?.disabled,
      // Same place as in the plan. The model used to pin the bar to the top-right
      // corner, so the one piece of chrome common to both views moved on every switch.
      centreDelta: (() => {
        const host = document.querySelector('#fpe-toolbar-host');
        const stage = document.querySelector('#fpe-stage');
        if (!host || !stage) return null;
        const a = host.getBoundingClientRect();
        const b = stage.getBoundingClientRect();
        return Math.round((a.left + a.right) / 2 - (b.left + b.right) / 2);
      })(),
      measureDisabled: !!btn('tool-measure')?.disabled,
      structureDisabled: !!document.querySelector('#fpe-structure-trigger')?.disabled,
      reason: btn('tool-measure')?.getAttribute('title') || '',
      // The one tool that genuinely needs the flat, scaled drawing. It lives inside the
      // structure menu and states the restriction on itself.
      roomItem: (document.querySelector('#fpe-structure-menu [data-action="tool-room"]')?.textContent || '')
        .replace(/\s+/g, ' ').trim(),
      roomItemDisabled: !!document.querySelector('#fpe-structure-menu [data-action="tool-room"]')?.disabled,
    };
  })()`);
  check(toolbar3d.present && toolbar3d.selectEnabled && toolbar3d.libraryEnabled
    && Math.abs(toolbar3d.centreDelta) <= 1
    // Measuring is LIVE in the model: it works on the floor plane, from the same
    // plan-unit state the plan uses. The structure trigger is live too — the lock state
    // and the element catalogue behind it are the same in both views, and only the
    // room-rectangle item needs the flat drawing, which it says for itself.
    && !toolbar3d.measureDisabled && toolbar3d.reason === 'Messen'
    && !toolbar3d.structureDisabled
    && toolbar3d.roomItemDisabled && /nur im 2D-Plan/.test(toolbar3d.roomItem),
  'carries the same toolbar in 3D, with only the plan-bound room tool restricted',
  `${toolbar3d.reason} · room item: ${toolbar3d.roomItem}`);

  // The transform widget: the same ring as the plan, laid on the floor. Its grips
  // are small targets on a large floor, so the viewer reports their screen
  // positions the way it already reports its camera.
  const widget3d = await threePage.evaluate(`(() => {
    const host = document.querySelector('#fpe-three-host');
    return { widget: host?.dataset.widget || '', grips: host?.dataset.widgetGrips || '' };
  })()`);
  const gripRoles = widget3d.grips.split('|').map((entry) => entry.split(':')[0]).filter(Boolean).sort();
  check(widget3d.widget === 'placement' && gripRoles.join(',') === 'move,rotate',
    'lays the transform widget on the floor plane for the selected object', widget3d.grips);

  const dragThree = await threePage.evaluate(`(async () => {
    const host = document.querySelector('#fpe-three-host');
    const canvas = host.querySelector('canvas');
    const box = canvas.getBoundingClientRect();
    const at = (role) => {
      const found = (host.dataset.widgetGrips || '').split('|')
        .map(entry => entry.split(':'))
        .find(([name]) => name === role);
      if (!found) return null;
      const [x, y] = found[1].split(',').map(Number);
      return { x: box.left + x, y: box.top + y };
    };
    const ev = (type, point, pointerId) => canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId, pointerType: 'mouse', button: 0, buttons: 1,
      clientX: point.x, clientY: point.y,
    }));
    const rotationValue = () => document.querySelector('#fpe-placement-rotation')?.value || '';
    const xValue = () => document.querySelector('#fpe-placement-x')?.value || '';
    const rotate = at('rotate');
    const centre = at('move');
    if (!rotate || !centre) return { error: 'grips not reported' };
    const rotationBefore = rotationValue();
    // Dragging the grip to the far side of the ring is a half turn.
    const opposite = { x: centre.x + (centre.x - rotate.x), y: centre.y + (centre.y - rotate.y) };
    ev('pointerdown', rotate, 61);
    await new Promise(r => setTimeout(r, 40));
    ev('pointermove', opposite, 61);
    await new Promise(r => setTimeout(r, 120));
    ev('pointerup', opposite, 61);
    await new Promise(r => setTimeout(r, 420));
    const rotationAfter = rotationValue();

    const moveGrip = at('move');
    const xBefore = xValue();
    ev('pointerdown', moveGrip, 62);
    await new Promise(r => setTimeout(r, 40));
    ev('pointermove', { x: moveGrip.x + 26, y: moveGrip.y + 10 }, 62);
    await new Promise(r => setTimeout(r, 140));
    ev('pointerup', { x: moveGrip.x + 26, y: moveGrip.y + 10 }, 62);
    await new Promise(r => setTimeout(r, 420));
    return {
      rotationBefore, rotationAfter, xBefore, xAfter: xValue(),
      dirty: !!document.querySelector('#fpe-save:not([disabled])'),
      announce: (document.querySelector('[aria-live]')?.textContent || '').trim(),
    };
  })()`);
  check(dragThree.rotationBefore !== dragThree.rotationAfter
    && Number(dragThree.rotationAfter) % 45 === 0,
  'turns the selected object by dragging the ring grip in 3D',
  `${dragThree.rotationBefore}° → ${dragThree.rotationAfter}°`);
  check(dragThree.xBefore !== dragThree.xAfter && dragThree.dirty
    && /3D-Modell/.test(dragThree.announce || ''),
  'moves the selected object by dragging the centre grip in 3D',
  `x ${dragThree.xBefore} → ${dragThree.xAfter}`);
  // Measuring in the model, from the same plan-unit state the plan uses. The tool used to
  // be disabled outside the 2D view; the viewer also refused to route floor clicks unless
  // it was editable, so measuring in a read-only model would have done nothing.
  const measure3d = await threePage.evaluate(`(async () => {
    const pause = (ms = 420) => new Promise(resolve => setTimeout(resolve, ms));
    const fire = node => node?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const host = () => document.querySelector('#fpe-three-host');
    const read = () => ({
      points: host()?.dataset.measurePoints ?? 'none',
      reading: document.querySelector('.fpe-measure-result__value')?.textContent.trim() || '',
    });
    const tap = async (fx, fy) => {
      const canvas = host()?.querySelector('canvas');
      const box = canvas?.getBoundingClientRect();
      if (!canvas || !box?.width) return;
      const x = box.left + box.width * fx;
      const y = box.top + box.height * fy;
      for (const type of ['pointerdown', 'pointerup']) {
        canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 81,
          pointerType: 'mouse', button: 0, buttons: type === 'pointerdown' ? 1 : 0, clientX: x, clientY: y }));
      }
      await pause(460);
    };
    fire(document.querySelector('[data-action="tool-measure"]')); await pause(460);
    await tap(0.46, 0.52);
    const one = read();
    await tap(0.54, 0.52);
    const two = read();
    await tap(0.54, 0.60);
    const three = read();
    document.querySelector('#fpe-stage')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await pause(520);
    const closed = read();
    document.querySelector('[data-action="clear-measure"]')?.click(); await pause(520);
    const cleared = read();
    // Back to selection so the checks below find the widget they expect.
    fire(document.querySelector('[data-action="tool-select"]')); await pause(420);
    return { one, two, three, closed, cleared };
  })()`);
  check(measure3d.one.points === '1' && measure3d.two.points === '2'
    && measure3d.two.reading.endsWith('m') && !/m²/.test(measure3d.two.reading)
    && measure3d.three.points === '3'
    // A closed ring reports area AND perimeter, and the scene draws it as closed.
    && measure3d.closed.points === '3:closed'
    && /m²/.test(measure3d.closed.reading) && /Umfang/.test(measure3d.closed.reading)
    && measure3d.cleared.points === 'none' && !measure3d.cleared.reading,
  'measures on the floor plane in the 3D model and clears it again',
  `${measure3d.two.reading} → ${measure3d.closed.reading}`);

  // One WebGL context for the whole serial-placement flow. Every step here used to run
  // through the full `draw()`, which disposes the viewer and builds a new renderer:
  // entering 3D, opening the library, arming a product and each placement. Chromium
  // keeps only about sixteen live contexts and kills the oldest, so a run of placements
  // could pull the context out from under the viewer being used.
  const contextReuse = await threePage.evaluate(`(async () => {
    const pause = (ms = 420) => new Promise(resolve => setTimeout(resolve, ms));
    const fire = node => node?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const host = () => document.querySelector('#fpe-three-host');
    const canvas = () => host()?.querySelector('canvas');
    const mark = () => { const c = canvas(); if (c && !c.dataset.probeId) c.dataset.probeId = 'ctx'; };
    const id = () => canvas()?.dataset.probeId || '(rebuilt)';
    mark();
    const start = id();
    fire(document.querySelector('[data-action="toggle-library"]')); await pause();
    const onOpen = id();
    fire(document.querySelector('#fpe-library .fpe-product[data-product]')); await pause();
    const onArm = id();
    const place = async (fy) => {
      const c = canvas();
      const box = c?.getBoundingClientRect();
      if (!c || !box?.width) return;
      const x = box.left + box.width * 0.5;
      const y = box.top + box.height * fy;
      for (const type of ['pointerdown', 'pointerup']) {
        c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 71,
          pointerType: 'mouse', button: 0, buttons: type === 'pointerdown' ? 1 : 0, clientX: x, clientY: y }));
      }
      await pause(560);
    };
    const before = Number(host()?.dataset.placements || 0);
    await place(0.55);
    const afterOne = { id: id(), count: Number(host()?.dataset.placements || 0) };
    await place(0.58);
    const afterTwo = { id: id(), count: Number(host()?.dataset.placements || 0) };
    document.querySelector('#fpe-stage')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await pause();
    return { start, onOpen, onArm, before, afterOne, afterTwo, context: host()?.dataset.context || '' };
  })()`);
  check(contextReuse.start === 'ctx' && contextReuse.onOpen === 'ctx' && contextReuse.onArm === 'ctx'
    && contextReuse.afterOne.id === 'ctx' && contextReuse.afterTwo.id === 'ctx'
    && contextReuse.afterOne.count === contextReuse.before + 1
    && contextReuse.afterTwo.count === contextReuse.before + 2
    && contextReuse.context === 'ready',
  'keeps one WebGL context through opening the library, arming and a run of placements',
  `${contextReuse.before} → ${contextReuse.afterTwo.count} objects on canvas ${contextReuse.afterTwo.id}`);

  // Placing furniture in the model, end to end. `openAssetLibrary` used to refuse
  // outside the 2D plan, so the Add button in 3D looked live, changed nothing, and
  // explained itself only to a screen reader.
  const placeIn3d = await threePage.evaluate(`(async () => {
    const pause = (ms = 320) => new Promise(resolve => setTimeout(resolve, ms));
    const fire = node => node?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const host = () => document.querySelector('#fpe-three-host');
    const before = Number(host()?.dataset.placements || 0);
    fire(document.querySelector('[data-action="toggle-library"]')); await pause(500);
    const opened = { dialog: !!document.querySelector('#fpe-library'),
      products: document.querySelectorAll('#fpe-library .fpe-product[data-product]').length,
      pressed: document.querySelector('[data-action="toggle-library"]')?.getAttribute('aria-pressed') || '' };
    fire(document.querySelector('#fpe-library .fpe-product[data-product]')); await pause(500);
    const armed = { dialog: !!document.querySelector('#fpe-library'),
      pressed: document.querySelector('[data-action="toggle-library"]')?.getAttribute('aria-pressed') || '' };
    const canvas = host()?.querySelector('canvas');
    const box = canvas?.getBoundingClientRect();
    if (canvas && box) {
      const x = box.left + box.width / 2, y = box.top + box.height * 0.55;
      for (const type of ['pointerdown', 'pointerup']) {
        canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 61,
          pointerType: 'mouse', button: 0, buttons: type === 'pointerdown' ? 1 : 0, clientX: x, clientY: y }));
      }
      await pause(520);
    }
    const after = Number(host()?.dataset.placements || 0);
    // Escape disarms, as it does in the plan.
    document.querySelector('#fpe-stage')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await pause(320);
    return { before, opened, armed, after,
      disarmed: document.querySelector('[data-action="toggle-library"]')?.getAttribute('aria-pressed') || '' };
  })()`);
  check(placeIn3d.opened.dialog && placeIn3d.opened.products > 0 && placeIn3d.opened.pressed === 'true'
    && !placeIn3d.armed.dialog && placeIn3d.armed.pressed === 'true'
    && placeIn3d.after === placeIn3d.before + 1 && placeIn3d.disarmed === 'false',
  'opens the library and places furniture in the 3D model, then disarms on Escape',
  `${placeIn3d.opened.products} products · ${placeIn3d.before} → ${placeIn3d.after} objects`);

  // The same preview in the model. It was missing entirely: placing in 3D was a blind
  // click. The viewer publishes `dataset.ghost` the way it publishes the widget grips,
  // so this can be asserted without reading pixels.
  const ghost3d = await threePage.evaluate(`(async () => {
    const pause = (ms = 340) => new Promise(resolve => setTimeout(resolve, ms));
    const fire = node => node?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const host = () => document.querySelector('#fpe-three-host');
    const read = () => host()?.dataset.ghost ?? 'none';
    // Re-query every time: arming a product runs a full redraw that replaces the host
    // and its canvas, and events on the detached one reach nothing.
    const surface = () => host()?.querySelector('canvas');
    if (!surface()) return { error: 'no 3D canvas' };
    const move = (fx, fy) => {
      const canvas = surface();
      const box = canvas?.getBoundingClientRect();
      if (!canvas || !box?.width) return;
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, cancelable: true, pointerId: 13, pointerType: 'mouse', buttons: 0,
        clientX: box.left + box.width * fx, clientY: box.top + box.height * fy }));
    };
    // Release any pointer the earlier drag probes left captured: the viewer will not
    // trace a hover while it believes a drag is in progress.
    for (const id of [61, 90, 91, 7]) {
      const canvas = surface();
      const box = canvas?.getBoundingClientRect();
      canvas?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true,
        pointerId: id, pointerType: 'mouse', button: 0, buttons: 0,
        clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
    }
    await pause(240);
    const idle = read();
    fire(document.querySelector('[data-action="toggle-library"]')); await pause(460);
    fire(document.querySelector('#fpe-library .fpe-product[data-product]')); await pause(460);
    // Sweep for a point on the floor: a perspective view puts the plan in part of the
    // canvas, and a fixed sample can miss it.
    const dialogOpened = !!document.querySelector('#fpe-library');
    const armedPressed = document.querySelector('[data-action="toggle-library"]')?.getAttribute('aria-pressed') || '';
    let armedGhost = 'none';
    for (let fy = 0.24; fy <= 0.88 && armedGhost === 'none'; fy += 0.02) {
      for (let fx = 0.28; fx <= 0.72 && armedGhost === 'none'; fx += 0.06) {
        move(fx, fy); await pause(45);
        armedGhost = read();
      }
    }
    // Aimed at the horizon the floor ray still meets the infinite y = 0 plane far past
    // the building; the preview must not follow it out there.
    move(0.5, 0.02); await pause(360);
    const horizon = read();
    document.querySelector('#fpe-stage')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await pause(460);
    const disarmed = read();
    return { error: '', idle, armedGhost, horizon, disarmed, dialogOpened, armedPressed };
  })()`);
  check(!ghost3d.error && ghost3d.idle === 'none'
    && /^valid:-?\d+,-?\d+$/.test(ghost3d.armedGhost)
    && ghost3d.horizon === 'none' && ghost3d.disarmed === 'none',
  'previews the armed product on the floor in 3D, and drops it off the floor and on disarm',
  ghost3d.error || `dialog ${ghost3d.dialogOpened}/${ghost3d.armedPressed} · ${ghost3d.idle} → ${ghost3d.armedGhost} → horizon ${ghost3d.horizon} → ${ghost3d.disarmed}`);

  await checkProblems(threePage, '3D authoring has no runtime problems');
  try { await threePage.closeTarget(); } catch { /* browser may already be closing */ }

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



  // Hand the plan back to the tests that follow, which all assume 2D.
  await page.evaluate(`document.querySelector('#fpe-view-2d')?.click()`);
  await sleep(600);
  await checkProblems(page, 'complete editor flow has no runtime problems');
} finally {
  if (page) {
    try { await page.closeTarget(); } catch { /* browser may already be closing */ }
  }
  cdp.close();
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
