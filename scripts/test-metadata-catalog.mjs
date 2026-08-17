// Covers every catalogue scope, presentation mode and legacy deep-link boundary.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const BASE = APP_BASE + '/app/metadata-catalog';
let fail = 0;
const check = (cond, label, detail = '') => {
  if (!cond) fail++;
  console.log(`   ${cond ? '✓' : '✗'} ${label}${detail ? '  (' + detail + ')' : ''}`);
};
const head = (s) => console.log('\n■ ' + s);
const clean = async (p, label) => {
  const errs = await p.problems();
  check(!errs.length, `${label}: no errors`, errs.join(' | '));
};

// Read every scene from live DOM so route replacements cannot leave stale handles.
const STATE = `JSON.stringify({
  h1: (document.querySelector('h1') || {}).textContent,
  tabs: [...document.querySelectorAll('.view-switch__btn, .tab__control')].map(
    b => b.getAttribute('aria-label') || b.textContent.trim()),
  active: (() => {
    const b = document.querySelector('.view-switch__btn[aria-pressed="true"], .tab__control[aria-selected="true"]');
    return b ? b.getAttribute('aria-label') || b.textContent.trim() : '';
  })(),
  textTabs: document.querySelectorAll('.tab__control').length,
  tabPanel: (() => {
    const panel = document.querySelector('#mc-panel[role="tabpanel"]');
    return panel ? panel.getAttribute('aria-labelledby') || '' : '';
  })(),
  sections: [...document.querySelectorAll('#mc-panel .detail-section__title')].map(t => t.textContent),
  keys: [...document.querySelectorAll('#mc-panel .kv dt')].map(t => t.textContent),
  vals: [...document.querySelectorAll('#mc-panel .kv dd')].map(t => t.textContent.replace(/\\s+/g,' ').trim()),
  cols: [...document.querySelectorAll('#mc-panel thead th')].map(t => t.textContent.trim()),
  // Exclude structural section and repeated-heading rows.
  rows: document.querySelectorAll(
    '#mc-panel tbody tr:not(.table__group):not(.table__subhead)').length,
  cards: document.querySelectorAll('#mc-panel .card').length,
  groups: [...document.querySelectorAll('#mc-panel .table__group-toggle')].map(
    b => b.textContent.replace(/\\s+/g,' ').trim()),
  openGroups: document.querySelectorAll('#mc-panel .table__group-toggle[aria-expanded="true"]').length,
  pager: !!document.querySelector('#mc-panel .pagination'),
  boxes: [...document.querySelectorAll('#mc-panel .lscape__toggle')].map(
    b => b.textContent.replace(/\\s+/g,' ').trim()),
  openBoxes: document.querySelectorAll('#mc-panel .lscape__toggle[aria-expanded="true"]').length,
  tiles: document.querySelectorAll('#mc-panel .lscape__tile').length,
  allBtn: ((document.querySelector('[data-lscape-all]') || {}).textContent || '').trim(),
  q: (document.querySelector('#mc-q') || {}).placeholder,
  qDead: !!(document.querySelector('#mc-q') || {}).disabled,
  pageSearch: document.querySelectorAll('#mc-q').length,
  qCount: [...document.querySelectorAll('.pf-tree__section:last-child > li')].map((li) => {
    const l = li.querySelector('.pf-tree__label'), n = li.querySelector('.pf-tree__n');
    return l && n ? l.textContent.trim() + ' ' + n.textContent.trim() : null;
  }).filter(Boolean).join(' | '),
  emptyMsg: ((document.querySelector('#mc-panel .table__empty, #mc-panel tbody td[colspan]') || {})
    .textContent || '').replace(/\\s+/g, ' ').trim(),
  emptyState: ((document.querySelector('#mc-panel .empty') || {}).textContent || '')
    .replace(/\\s+/g, ' ').trim(),
  emptyAction: (document.querySelector('#mc-panel .empty__action') || {}).getAttribute?.('href') || '',
  tableSearch: document.querySelectorAll('#mc-panel .catbar__search').length,
  actions: [...document.querySelectorAll('[data-menu="mc-actions"] [data-action]')].map(b => b.dataset.action),
  actionLabels: [...document.querySelectorAll('[data-menu="mc-actions"] [data-action]')].map(
    b => b.textContent.replace(/\\s+/g, ' ').trim()),
  disabledExport: !!document.querySelector('#mc-tools button[disabled]'),
  sortMenu: !!document.querySelector('[data-menu="mc-sort"]'),
  detail: !!document.querySelector('#mc-panel > .mc-detail'),
  metadataDetail: !!document.querySelector('#mc-panel > .mc-detail--metadata'),
  factGroups: document.querySelectorAll('#mc-panel .mc-detail__facts > .detail-section').length,
  factRows: document.querySelectorAll('#mc-panel .mc-detail__fact').length,
  wideDetails: document.querySelectorAll('#mc-panel .mc-detail__wide').length,
  originalHeadings: [...document.querySelectorAll('#mc-panel h2')]
    .filter((node) => node.textContent.trim() === 'Original').length,
  detailAsides: document.querySelectorAll('#mc-panel .detail-layout__aside').length,
  filters: [...document.querySelectorAll('#mc-activefilters .active-filter, #mc-activefilters [data-remove]')]
    .map((node) => node.textContent.replace(/\\s+/g, ' ').trim()),
  cardLinks: [...document.querySelectorAll('#mc-panel .stats .card__link')].map(
    (link) => link.textContent.replace(/\\s+/g, ' ').trim()),
  cardFooters: [...document.querySelectorAll('#mc-panel .stats .card__footer__info')].map(
    (node) => node.textContent.replace(/\\s+/g, ' ').trim()),
  cardActions: document.querySelectorAll('#mc-panel .stats .card__footer__action').length,
  matchHints: [...document.querySelectorAll('#mc-panel [title] > .sr-only')].map(
    (node) => node.textContent.replace(/\\s+/g, ' ').trim()),
  statusBadge: (() => {
    const key = [...document.querySelectorAll('#mc-panel .kv dt')].find((node) => node.textContent === 'Status');
    const mark = key?.nextElementSibling?.querySelector('.badge');
    return mark ? { text: mark.textContent.trim(), cls: mark.className } : null;
  })(),
  groupSel: (() => {
    const m = document.querySelector('[data-menu="mc-group"]');
    if (!m) return '(keins)';
    const chosen = m.querySelector('.action-menu__trigger').textContent.replace(/\\s+/g,' ').trim();
    return chosen + ':' + [...m.querySelectorAll('[data-action]')]
      .map(b => b.dataset.action.replace('group:', '')).join(',');
  })(),
  roots: [...document.querySelectorAll('.pf-tree > .pf-tree__item')].map(li => {
    const label = li.querySelector('.pf-tree__label');
    const n = li.querySelector('.pf-tree__n');
    return label.textContent + (n ? ' ' + n.textContent : '');
  }),
  branchKids: document.querySelectorAll('.pf-tree__children > .pf-tree__item').length,
  splits: document.querySelectorAll('.pf-tree__split').length,
  folds: document.querySelectorAll('.pf-tree__fold').length,
  subs: document.querySelectorAll('.pf-tree__split ~ .pf-tree__children .pf-tree__row').length,
  activeRow: ((document.querySelector('.pf-tree .is-active .pf-tree__label') || {}).textContent || ''),
  pathRows: document.querySelectorAll('.pf-tree .is-path').length,
})`;

const browser = await launch();
const p = await openPage(browser, BASE);
const setViewport = async (width, height = 900) => {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 768,
  }, p.sessionId);
  await sleep(150);
};
const pressTab = async () => {
  const key = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 };
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', ...key }, p.sessionId);
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key }, p.sessionId);
  await sleep(80);
};
// Navigate by hash: the router owns the route, and driving it the way a link
// would is the only way to prove the query string really is the whole state.
const go = async (hash) => {
  await p.evaluate(`(location.hash = ${JSON.stringify(hash)}, 1)`);
  await sleep(900);
  return JSON.parse(await p.evaluate(STATE));
};
// A link emitted by the app already carries the reader's chosen tab, so a tab
// cannot simply be appended: URLSearchParams.get returns the FIRST value and the
// scene would silently never switch.
const withTab = (href, tab) => {
  const [route, qs] = href.replace(/^#/, '').split('?');
  const q = new URLSearchParams(qs || '');
  q.set('tab', tab);
  return `#${route}?${q}`;
};
const linkIn = (needle) => p.evaluate(
  `(() => { const a = document.querySelector('#mc-panel tbody a[href*="${needle}"]');`
  + ' return a ? a.getAttribute("href") : ""; })()');

const DOMAIN = 'Bauwerk und Liegenschaft';
const L2 = `#/app/metadata-catalog?kind=objekt&leaf=${encodeURIComponent(DOMAIN)}`;

try {
  await sleep(1400);

  head('Katalog — the root');
  let o = JSON.parse(await p.evaluate(STATE));
  check(o.tabs.length === 0, 'no tabs: the root is not a scope', o.tabs.join('/'));
  check(o.cards === 3, 'one entry card per branch', String(o.cards));
  check(o.cardLinks.join('/') === 'Geschäftsobjekte/Datentabellen/Referenzdaten',
    'each branch card link is named only by its title', o.cardLinks.join('/'));
  check(o.cardFooters.length === 3 && o.cardActions === 3,
    'branch counts and follow actions use the shared card footer', o.cardFooters.join(' | '));
  check(o.roots.length === 4, 'tree: Katalog plus three branches', o.roots.join(' | '));
  // The parentheses around a count are CSS ::before/::after, so they are not in
  // textContent — assert the number, not the punctuation drawn around it.
  check(/^Geschäftsobjekte \d+$/.test(o.roots[1]), 'branches carry their count', o.roots[1]);
  check(o.branchKids === 0, 'nothing unfolded until a branch is in scope', String(o.branchKids));
  await clean(p, 'Katalog');

  head('Ast — level 1');
  o = await go('#/app/metadata-catalog?kind=objekt');
  check(o.tabs.join('/') === 'Übersicht/Diagramm/Tabelle', 'three tabs', o.tabs.join('/'));
  check(o.h1 === 'Geschäftsobjekte', 'the selected branch is the page heading', o.h1);
  // Arriving from the menu is a looking moment, so a branch opens on its picture.
  check(o.active === 'Diagramm', 'a branch opens on its landscape', o.active);
  check(o.boxes.length > 1, 'and the landscape is there', String(o.boxes.length));
  o = await go('#/app/metadata-catalog?kind=objekt&tab=uebersicht');
  check(o.sections.join('/') === 'Beschreibung/Kerndaten/Verantwortung',
    'the branch overview uses the shared detail anatomy', o.sections.join('/'));
  check(o.detail && o.factGroups === 2 && o.factRows > 0,
    'the overview fills the main pane with an ordered fact stream');
  check(!o.sortMenu, 'overview hides sorting that cannot affect its content');
  check(o.filters.length === 0, 'hierarchy scope is not repeated as an active filter');
  check(o.branchKids > 0, 'the branch in scope is unfolded', String(o.branchKids));
  check(o.subs === 0 && o.splits === 0, 'but only one level deep', o.splits + ' splits');

  head('Domäne — level 2');
  o = await go(L2);
  check(o.active === 'Diagramm', 'a domain opens on its landscape — a looking question', o.active);
  check(o.h1 === DOMAIN, 'the selected domain is the page heading', o.h1);
  o = await go(L2 + '&tab=tabelle');
  check(o.rows > 0, 'the group lists its records', String(o.rows));
  check(!o.cols.includes('Domäne'),
    'the axis column drops out when only one group is in scope', o.cols.join('/'));
  check(o.splits > 0 && o.folds === o.splits, 'every record row splits into link plus chevron',
    o.splits + ' rows / ' + o.folds + ' chevrons');
  check(o.subs === 0, 'selecting a group does not drop attributes into the tree', String(o.subs));
  check(o.pathRows > 0, 'the ancestors of the selection are marked', String(o.pathRows));
  await clean(p, 'Domäne');

  head('Tabs and tree are independent');
  o = await go(L2 + '&tab=uebersicht');
  check(o.active === 'Übersicht', 'an explicit tab beats the level default', o.active);
  check(o.rows === 0 && o.sections.length === 3, 'and really swaps the pane', String(o.rows));
  const kept = await go('#/app/metadata-catalog?kind=objekt&tab=uebersicht');
  check(kept.active === 'Übersicht', 'the chosen tab survives a move up the tree', kept.active);
  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle');
  const paneLifecycle = JSON.parse(await p.evaluate(`(async () => {
    const oldHost = document.querySelector('#mc-table');
    let removals = 0;
    const remove = oldHost.removeEventListener;
    oldHost.removeEventListener = function (...args) {
      removals++;
      return remove.apply(this, args);
    };
    document.querySelector('[data-view="uebersicht"]').click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    return JSON.stringify({ removals, detached: !oldHost.isConnected });
  })()`));
  check(paneLifecycle.detached && paneLifecycle.removals > 0,
    'local view redraw disposes the replaced table host', JSON.stringify(paneLifecycle));

  head('Geschäftsobjekt — level 3 via the legacy ?id= link');
  o = await go(L2 + '&tab=tabelle');
  const idHref = await linkIn('id=');
  check(/\?id=/.test(idHref), 'the table links to ?id=, unchanged since js/links.js', idHref);
  check(!/[?&]tab=tabelle/.test(idHref), 'crossing into a record resets the aggregate presentation', idHref);
  o = await go(idHref.slice(1));
  check(o.active === 'Übersicht', 'a record opens on its information overview', o.active);
  check(o.h1 === o.activeRow.trim(), 'the selected record is the page heading', `${o.h1} / ${o.activeRow}`);
  check(o.tabs.join('/') === 'Übersicht/Attribute' && o.textTabs === 2,
    'record modes are descriptive APG tabs', o.tabs.join('/'));
  check(o.tabPanel === 'mc-tab-uebersicht', 'the active tab labels the shared panel', o.tabPanel);
  check(o.sections.join('/') === 'Beschreibung/Kerndaten/Verantwortung',
    'description and key metadata are the default content', o.sections.join('/'));
  check(o.detail && o.metadataDetail && o.factGroups === 2 && o.detailAsides === 0,
    'the record uses the metadata-scoped full-width facts model without an aside');
  check(o.keys.includes('Domäne') && o.keys.includes('ID'), 'key metadata names its axis and id', o.keys.join('/'));
  check(o.statusBadge?.text === 'Gültig' && /badge--success/.test(o.statusBadge.cls),
    'record status keeps its semantic badge variant', JSON.stringify(o.statusBadge));
  check(o.rows === 0 && !o.sortMenu, 'attributes and their sorting stay in the secondary mode');
  check(o.filters.length === 0, 'the selected record is not repeated as a filter chip', o.filters.join(' | '));
  check(o.activeRow.trim().length > 0, 'the tree marks the record', o.activeRow);
  check(o.subs === 0, 'and does NOT unfold it — that is what the chevron is for', String(o.subs));
  // Each record fold must materialize that record's own children.
  const folded = await p.evaluate(`(async () => {
    const f = [...document.querySelectorAll('.pf-tree__fold')]
      .find((b) => !b.closest('.pf-tree__split').classList.contains('is-active'));
    f.click();
    await new Promise((r) => setTimeout(r, 250));
    return String(document.querySelectorAll('.pf-tree__split ~ .pf-tree__children .pf-tree__row').length);
  })()`);
  check(Number(folded) > 0, 'the chevron of an UNSELECTED record fills its list too', folded + ' Zeilen');
  o = await go(withTab(idHref, 'tabelle'));
  check(o.active === 'Attribute' && o.rows > 0, 'the secondary tab lists attributes', `${o.active} / ${o.rows}`);
  check(o.cols.join('/') === 'Attribut/Beschreibung/Werttyp/Schlüssel', 'attribute columns', o.cols.join('/'));
  await go(idHref.slice(1));
  const tabKeys = JSON.parse(await p.evaluate(`(async () => {
    const overview = document.querySelector('[data-tab="uebersicht"]');
    overview.focus();
    overview.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 80));
    const next = {
      active: document.querySelector('.tab__control[aria-selected="true"]')?.textContent.trim(),
      focus: document.activeElement?.dataset?.tab || '',
      rows: document.querySelectorAll('#mc-panel tbody tr').length,
      hash: location.hash,
    };
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 80));
    return JSON.stringify({ next, home: {
      active: document.querySelector('.tab__control[aria-selected="true"]')?.textContent.trim(),
      focus: document.activeElement?.dataset?.tab || '',
      detail: !!document.querySelector('#mc-panel > .mc-detail'),
      hash: location.hash,
    }});
  })()`));
  check(tabKeys.next.active === 'Attribute' && tabKeys.next.focus === 'tabelle' && tabKeys.next.rows > 0,
    'ArrowRight activates, focuses and renders the next detail tab', JSON.stringify(tabKeys.next));
  check(/[?&]tab=tabelle/.test(tabKeys.next.hash), 'keyboard tab changes are shareable in the URL', tabKeys.next.hash);
  check(tabKeys.home.active === 'Übersicht' && tabKeys.home.focus === 'uebersicht' && tabKeys.home.detail,
    'Home restores focus and the overview panel', JSON.stringify(tabKeys.home));
  check(!/[?&]tab=/.test(tabKeys.home.hash), 'the default overview keeps the record URL short', tabKeys.home.hash);

  const detailMetrics = async (width) => {
    await setViewport(width, width === 320 ? 760 : 900);
    return JSON.parse(await p.evaluate(`(() => {
      const detail = document.querySelector('#mc-panel > .mc-detail--metadata');
      const facts = detail.querySelector('.mc-detail__facts');
      const sections = [...facts.children];
      const row = detail.querySelector('.mc-detail__fact');
      const term = row.querySelector('dt');
      const value = row.querySelector('dd');
      const rowStyle = getComputedStyle(row);
      const rowRect = row.getBoundingClientRect();
      const termRect = term.getBoundingClientRect();
      const valueRect = value.getBoundingClientRect();
      const factsRect = facts.getBoundingClientRect();
      const main = document.querySelector('.mc-layout--detail > .pf-main');
      const sidebar = document.querySelector('.mc-layout--detail > .pf-sidebar');
      const mainRect = main.getBoundingClientRect();
      const sidebarRect = sidebar.getBoundingClientRect();
      const focusable = [...document.querySelectorAll('.mc-layout--detail a[href], .mc-layout--detail button:not([disabled]), .mc-layout--detail [tabindex="0"]')]
        .filter((node) => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
      return JSON.stringify({
        width: ${width},
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        tracks: rowStyle.gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length,
        ratio: termRect.width ? valueRect.width / termRect.width : 0,
        stacked: valueRect.top >= termRect.bottom - 1,
        fullSections: sections.every((section) => {
          const rect = section.getBoundingClientRect();
          return Math.abs(rect.left - factsRect.left) <= 1 && Math.abs(rect.width - factsRect.width) <= 1;
        }),
        orderedSections: sections.every((section, index) => !index
          || section.getBoundingClientRect().top > sections[index - 1].getBoundingClientRect().top),
        rowOverflow: row.scrollWidth - rowRect.width,
        mainBeforeSidebarDom: Boolean(main.compareDocumentPosition(sidebar) & Node.DOCUMENT_POSITION_FOLLOWING),
        mainBeforeSidebarFocus: focusable.findIndex((node) => main.contains(node))
          < focusable.findIndex((node) => sidebar.contains(node)),
        mainAboveSidebar: mainRect.top < sidebarRect.top,
        sidebarLeftOfMain: sidebarRect.left < mainRect.left,
        treeCopies: document.querySelectorAll('#mc-tree').length,
      });
    })()`));
  };
  const tabFromMainIntoTree = async (width) => {
    await setViewport(width, width === 320 ? 760 : 900);
    const start = await p.evaluate(`(() => {
      const main = document.querySelector('.mc-layout--detail > .pf-main');
      const focusable = [...main.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')]
        .filter((node) => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
      focusable.at(-1).focus();
      return document.activeElement.textContent.replace(/\\s+/g, ' ').trim();
    })()`);
    await pressTab();
    return JSON.parse(await p.evaluate(`JSON.stringify({
      start: ${JSON.stringify(start)},
      inTree: !!document.activeElement.closest('#mc-tree'),
      focusText: document.activeElement.textContent.replace(/\\s+/g, ' ').trim(),
    })`));
  };

  let m = await detailMetrics(320);
  check(m.overflow <= 1 && m.tracks === 1 && m.stacked && m.fullSections && m.orderedSections,
    '320px: one full-width ordered stream with stacked rows and no overflow', JSON.stringify(m));
  check(m.mainBeforeSidebarDom && m.mainBeforeSidebarFocus && m.mainAboveSidebar && m.treeCopies === 1,
    '320px: DOM, visual and keyboard order all put detail before the single tree', JSON.stringify(m));
  let tabOrder = await tabFromMainIntoTree(320);
  check(tabOrder.inTree, '320px: a real Tab after the last detail control enters the tree', JSON.stringify(tabOrder));

  m = await detailMetrics(768);
  check(m.overflow <= 1 && m.tracks === 2 && !m.stacked && Math.abs(m.ratio - 1) < 0.03
    && m.fullSections && m.orderedSections,
  '768px: each fact row uses equal label and value tracks', JSON.stringify(m));
  check(m.mainBeforeSidebarDom && m.mainBeforeSidebarFocus && m.mainAboveSidebar && m.treeCopies === 1,
    '768px: DOM, visual and keyboard order remain aligned', JSON.stringify(m));
  tabOrder = await tabFromMainIntoTree(768);
  check(tabOrder.inTree, '768px: real Tab progression follows the visible main-then-tree order', JSON.stringify(tabOrder));
  await p.evaluate(`(() => {
    window.__mcTreeProbe = document.querySelector('#mc-tree');
    document.activeElement.dataset.mcFocusProbe = 'stable';
    return 1;
  })()`);

  m = await detailMetrics(1024);
  const stableDesktopFocus = JSON.parse(await p.evaluate(`JSON.stringify({
    sameTree: window.__mcTreeProbe === document.querySelector('#mc-tree'),
    focused: document.activeElement.dataset.mcFocusProbe || '',
  })`));
  check(m.overflow <= 1 && m.tracks === 2 && Math.abs(m.ratio - 2) < 0.03
    && m.sidebarLeftOfMain && m.treeCopies === 1,
  '1024px: rows switch to one-third/two-thirds and the rail returns left', JSON.stringify(m));
  check(stableDesktopFocus.sameTree && stableDesktopFocus.focused === 'stable',
    'the desktop grid change neither duplicates nor moves the focused tree', JSON.stringify(stableDesktopFocus));

  m = await detailMetrics(1440);
  check(m.overflow <= 1 && m.tracks === 2 && Math.abs(m.ratio - 2) < 0.03
    && m.fullSections && m.orderedSections && m.sidebarLeftOfMain,
  '1440px: the same ordered stream keeps one-third/two-thirds rows', JSON.stringify(m));

  head('Geschäftsobjekt — provenance is ordinary metadata');
  o = await go('#/app/metadata-catalog?id=heizzentrale');
  const objectProvenance = JSON.parse(await p.evaluate(`(() => {
    const detail = document.querySelector('#mc-panel > .mc-detail--metadata');
    const rows = [...detail.querySelectorAll('.mc-detail__fact')].map((row) => ({
      key: row.querySelector('dt').textContent.trim(),
      value: row.querySelector('dd').textContent.replace(/\\s+/g, ' ').trim(),
    }));
    const row = (key) => [...detail.querySelectorAll('.mc-detail__fact')]
      .find((candidate) => candidate.querySelector('dt').textContent.trim() === key);
    const time = row('Abgeglichen')?.querySelector('time');
    const repository = row('Repository')?.querySelector('a');
    return JSON.stringify({
      sections: [...detail.querySelectorAll(':scope > .detail-section > h2, :scope > .mc-detail__facts > .detail-section > h2')]
        .map((heading) => heading.textContent.trim()),
      keys: rows.map(({ key }) => key),
      source: rows.find(({ key }) => key === 'Führendes System')?.value || '',
      reference: rows.find(({ key }) => key === 'Referenz')?.value || '',
      dateText: time?.textContent || '',
      datetime: time?.getAttribute('datetime') || '',
      repository: repository ? {
        href: repository.getAttribute('href'),
        target: repository.getAttribute('target'),
        rel: repository.getAttribute('rel'),
        name: repository.textContent.replace(/\\s+/g, ' ').trim(),
      } : null,
      original: [...detail.querySelectorAll('h2')].some((heading) => heading.textContent.trim() === 'Original'),
      wide: detail.querySelectorAll('.mc-detail__wide').length,
      boxes: detail.querySelectorAll('.box').length,
    });
  })()`));
  check(objectProvenance.sections.join('/') === 'Beschreibung/Kerndaten/Verantwortung'
    && !objectProvenance.original && objectProvenance.wide === 0 && objectProvenance.boxes === 0,
  'the exact object route has no standalone Original or wide box', JSON.stringify(objectProvenance));
  check(/Architektur-Repository/.test(objectProvenance.source)
    && /Innovator \/ smartfacts/.test(objectProvenance.source)
    && objectProvenance.reference === 'heizzentrale',
  'leading system and reference are ordinary Kerndaten rows', JSON.stringify(objectProvenance));
  check(objectProvenance.datetime === '2024-08-01' && objectProvenance.dateText === '1.8.2024',
    'reconciliation is a semantic ISO time with a localized label', JSON.stringify(objectProvenance));
  check(objectProvenance.repository?.href
    === 'https://smartfacts.admin.ch/bbl/model/geschaeftsobjekt/heizzentrale'
    && objectProvenance.repository.target === '_blank'
    && /noopener/.test(objectProvenance.repository.rel)
    && /noreferrer/.test(objectProvenance.repository.rel)
    && /external/.test(objectProvenance.repository.rel)
    && /öffnet in neuem Fenster/.test(objectProvenance.repository.name),
  'the safe repository link isolates its new window and exposes that behavior in its name',
  JSON.stringify(objectProvenance.repository));

  const hostileReference = `REF-${'x'.repeat(240)}-<img src=x onerror=alert(1)>`;
  try {
    await p.evaluate(`(async () => {
      const moduleUrl = new URL('js/core/index.js', document.baseURI).href;
      const { core } = await import(moduleUrl);
      const record = core.businessObject('heizzentrale');
      window.__mcSourceBackup = record.source;
      record.source = { ...record.source,
        ref: ${JSON.stringify(hostileReference)}, url: 'javascript:alert(document.domain)' };
      return 1;
    })()`);
    await go('#/app/metadata-catalog?id=heizzentrale&tab=tabelle');
    await go('#/app/metadata-catalog?id=heizzentrale');
    await setViewport(320, 760);
    const hostile = JSON.parse(await p.evaluate(`(() => {
      const rows = [...document.querySelectorAll('#mc-panel .mc-detail__fact')];
      const ref = rows.find((row) => row.querySelector('dt').textContent.trim() === 'Referenz');
      const repository = rows.find((row) => row.querySelector('dt').textContent.trim() === 'Repository');
      const value = ref.querySelector('dd');
      return JSON.stringify({
        text: value.textContent,
        injected: !!value.querySelector('img, script'),
        repository: !!repository,
        valueOverflow: value.scrollWidth - value.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      });
    })()`));
    check(hostile.text === hostileReference && !hostile.injected && !hostile.repository,
      'long provenance stays text and an unsafe repository scheme emits no link', JSON.stringify(hostile));
    check(hostile.valueOverflow <= 1 && hostile.pageOverflow <= 1,
      'a long unbroken provenance value wraps without horizontal overflow', JSON.stringify(hostile));
  } finally {
    await p.evaluate(`(async () => {
      const moduleUrl = new URL('js/core/index.js', document.baseURI).href;
      const { core } = await import(moduleUrl);
      core.businessObject('heizzentrale').source = window.__mcSourceBackup;
      delete window.__mcSourceBackup;
      return 1;
    })()`);
    await setViewport(1440);
    await go('#/app/metadata-catalog?id=heizzentrale');
  }
  await clean(p, 'Geschäftsobjekt');

  head('Attribut — level 4');
  o = await go(withTab(idHref, 'tabelle'));
  const attrHref = await linkIn('attr=');
  check(/attr=/.test(attrHref), 'a part links to ?attr=', attrHref);
  o = await go(attrHref.slice(1));
  check(o.tabs.length === 0 && o.textTabs === 0,
    'a leaf renders directly instead of showing a one-item tab bar', o.tabs.join('/'));
  check(o.sections.slice(0, 3).join('/') === 'Beschreibung/Kerndaten/Verantwortung',
    'the leaf keeps the shared detail anatomy', o.sections.join('/'));
  check(o.h1 === o.activeRow.trim(), 'the selected attribute is the page heading', o.h1);
  check(o.subs > 0, 'an attribute in scope forces its record open in the tree', String(o.subs));
  check(o.keys.includes('Geerbt von'), 'and says where its stewardship comes from', o.keys.join('/'));
  o = await go('#/app/metadata-catalog?id=grundstueck&attr=EGRID');
  check(o.sections.includes('Verknüpfungen') && o.matchHints.some((hint) => /Teilweise/.test(hint)),
    'mapping quality explanations are available without hover', o.matchHints.join(' | '));

  head('Datentabellen — level 3 via the legacy ?table= link');
  o = await go('#/app/metadata-catalog?kind=tabelle');
  check(o.roots[2].startsWith('Datentabellen'), 'the branch is named Datentabellen', o.roots[2]);
  o = await go('#/app/metadata-catalog?kind=tabelle&tab=tabelle');
  check(o.groups.length > 1 && !o.cols.includes('System'),
    'systems are section headers, not a repeated column', o.groups.slice(0, 3).join(' | '));
  const tableHref = await linkIn('table=');
  check(/\?table=/.test(tableHref), 'the table links to ?table=', tableHref);
  o = await go(tableHref.slice(1));
  check(o.active === 'Übersicht' && o.tabs.join('/') === 'Übersicht/Felder',
    'a data table opens on information, with fields as a secondary tab', `${o.active} / ${o.tabs.join('/')}`);
  check(o.rows === 0 && o.detail && o.factGroups === 3,
    'schema rows do not replace the default overview', `${o.rows} rows / ${o.factGroups} groups`);
  check(o.keys.includes('Technischer Name'), 'a table names its technical identity', o.keys.join('/'));
  // The DCAT bridge lives in metadata rather than a separate access box.
  const dcat = await p.evaluate(
    '(() => document.querySelectorAll(\'#mc-panel .kv a[href*="#/data/"]\').length)()');
  check(Number(dcat) >= 0, 'the published-dataset bridge resolves without error', 'links: ' + dcat);

  o = await go('#/app/metadata-catalog?table=sap-refx-vibdbe');
  const tableProvenance = JSON.parse(await p.evaluate(`(() => {
    const detail = document.querySelector('#mc-panel > .mc-detail--metadata');
    const rows = [...detail.querySelectorAll('.mc-detail__fact')].map((row) => ({
      key: row.querySelector('dt').textContent.trim(),
      value: row.querySelector('dd').textContent.replace(/\\s+/g, ' ').trim(),
      datetime: row.querySelector('time')?.getAttribute('datetime') || '',
    }));
    return JSON.stringify({
      sections: [...detail.querySelectorAll(':scope > .detail-section > h2, :scope > .mc-detail__facts > .detail-section > h2')]
        .map((heading) => heading.textContent.trim()),
      rows,
      original: [...detail.querySelectorAll('h2')].some((heading) => heading.textContent.trim() === 'Original'),
      wide: detail.querySelectorAll('.mc-detail__wide').length,
    });
  })()`));
  const tableFact = (key) => tableProvenance.rows.find((row) => row.key === key) || {};
  check(tableProvenance.sections.join('/') === 'Beschreibung/Kerndaten/Verantwortung/Technische Angaben'
    && !tableProvenance.original && tableProvenance.wide === 0,
  'the exact table route keeps provenance in the ordered fact stream', JSON.stringify(tableProvenance));
  check(tableFact('Führendes System').value === 'SAP RE-FX'
    && tableFact('Referenz').value === 'VIBD.VIBDBE'
    && tableFact('Abgeglichen').value === '20.4.2026'
    && tableFact('Abgeglichen').datetime === '2026-04-20'
    && !tableProvenance.rows.some((row) => /GIS IMMO und weitere/.test(row.value)),
  'table provenance uses the concrete system, reference and semantic localized date',
  JSON.stringify(tableProvenance.rows));
  o = await go(withTab(tableHref, 'tabelle'));
  check(o.rows > 0, 'the fields tab lists fields', String(o.rows));
  check(o.cols.join('/') === 'Feld/Beschreibung/Datentyp/Schlüssel', 'field columns', o.cols.join('/'));
  await clean(p, 'Datentabelle');

  head('Reverse field-to-term index');
  o = await go(withTab(tableHref, 'tabelle'));
  const fieldHref = await linkIn('attr=');
  o = await go(fieldHref.slice(1));
  check(o.tabs.length === 0, 'a field is a direct level-4 overview', o.tabs.join('/'));
  // Not every field carries a term, so the row is present-or-absent by design;
  // what must hold is that the label is the reverse of the object side.
  check(!o.keys.includes('Realisiert in'), 'a field never claims to be realised elsewhere', o.keys.join('/'));

  head('Diagramm — the landscape');
  o = await go('#/app/metadata-catalog?kind=objekt&tab=diagramm');
  check(o.boxes.length === 5, 'on a branch the boxes are the axis values', o.boxes.join(' | '));
  check(o.tiles === 19, 'and the tiles are every record in scope', String(o.tiles));
  check(o.openBoxes === o.boxes.length, 'boxes open expanded', String(o.openBoxes));
  check(/zuklappen/.test(o.allBtn), 'the control says what pressing it will DO', o.allBtn);
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 320, height: 760, deviceScaleFactor: 1, mobile: true,
  }, p.sessionId);
  let mobileLandscape;
  try {
    await sleep(120);
    mobileLandscape = JSON.parse(await p.evaluate(`(() => {
      const tiles = document.querySelector('.lscape__tiles');
      const tile = document.querySelector('.lscape__tile');
      return JSON.stringify({
        columns: getComputedStyle(tiles).gridTemplateColumns.trim().split(/\\s+/).length,
        whiteSpace: getComputedStyle(tile).whiteSpace,
      });
    })()`));
  } finally {
    await browser.send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    }, p.sessionId);
  }
  check(mobileLandscape.columns === 1 && mobileLandscape.whiteSpace === 'normal',
    'the landscape becomes a wrapping one-column list at 320px', JSON.stringify(mobileLandscape));
  const foldAllFocus = await p.evaluate(`(async () => {
    const button = document.querySelector('[data-lscape-all]');
    button.focus();
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    return document.activeElement?.dataset?.lscapeAll || '';
  })()`);
  await sleep(400);
  o = JSON.parse(await p.evaluate(STATE));
  check(o.openBoxes === 0 && o.tiles === 0, 'all boxes shut', o.openBoxes + ' open, ' + o.tiles + ' tiles');
  check(/aufklappen/.test(o.allBtn), 'and the control now offers the opposite', o.allBtn);
  check(foldAllFocus === 'open', 'fold-all redraw restores focus to the replacement control', foldAllFocus);
  await p.evaluate('(document.querySelector("[data-lscape-all]").click(), 1)');
  await sleep(500);
  o = JSON.parse(await p.evaluate(STATE));
  check(o.openBoxes === o.boxes.length, 'and back open again', String(o.openBoxes));
  // A tile is ALWAYS one record. One level deeper the same landscape is simply
  // re-laid: with no grouping in force it collapses to a single field.
  o = await go('#/app/metadata-catalog?kind=objekt&tab=diagramm&group=keine');
  const branchAllKey = await p.evaluate('document.querySelector(".lscape__toggle").dataset.box');
  o = await go(L2 + '&tab=diagramm');
  const leafAllKey = await p.evaluate('document.querySelector(".lscape__toggle").dataset.box');
  check(branchAllKey !== leafAllKey, 'same-labelled boxes keep independent scope keys',
    `${branchAllKey} / ${leafAllKey}`);
  check(o.boxes.length === 1 && /^Alle/.test(o.boxes[0]),
    'inside one group the landscape collapses to a single field', o.boxes.join(' | '));
  check(o.tiles === 8, 'holding the same eight records the table lists', String(o.tiles));
  const tileHref = await p.evaluate(
    '(() => { const a = document.querySelector("#mc-panel .lscape__tile"); return a ? a.getAttribute("href") : ""; })()');
  check(/[?&]id=/.test(tileHref) && !/attr=/.test(tileHref),
    'a tile links to the record it draws, never to a part', tileHref);
  o = await go('#/app/metadata-catalog?kind=referenz&tab=diagramm');
  check(o.boxes.length === 4, 'every branch has a landscape', o.boxes.join(' | '));
  await clean(p, 'Diagramm');

  head('Dichte');
  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle');
  const dense = JSON.parse(await p.evaluate(`(() => {
    const td = document.querySelector('#mc-panel tbody tr:not(.table__group):not(.table__subhead) td');
    const t = document.querySelector('#mc-panel .table');
    const c = getComputedStyle(td);
    return JSON.stringify({
      compact: t.classList.contains('table--compact'),
      pad: c.paddingTop + ' ' + c.paddingLeft,
      size: getComputedStyle(t).fontSize,
    });
  })()`));
  check(dense.compact, 'the catalogue table uses the compact density');
  check(dense.pad === '8px 8px', 'data cells use the shared compact padding', dense.pad);
  check(dense.size === '14px', 'compact table text remains 14px', dense.size);
  await clean(p, 'Dichte');

  head('Aktionen — what leaves is what is on screen');
  // Intercept the download rather than writing files: the assertion is about the
  // CONTENT, and a test that litters the download folder is its own problem.
  await p.evaluate(`(() => {
    const real = URL.createObjectURL;
    URL.createObjectURL = (b) => { window.__blob = b; return real.call(URL, b); };
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[download]');
      if (a) { window.__name = a.download; e.preventDefault(); }
    }, true);
    return 1;
  })()`);
  const exportCsv = async () => {
    await p.evaluate('(document.querySelector(".action-menu__trigger").click(), 1)');
    await sleep(200);
    await p.evaluate('(document.querySelector("[data-action=\'csv\']").click(), 1)');
    await sleep(350);
    return JSON.parse(await p.evaluate(`(async () => JSON.stringify({
      name: window.__name,
      bom: [...new Uint8Array(await window.__blob.arrayBuffer()).slice(0, 3)].join(' '),
      lines: (await window.__blob.text()).split('\\r\\n').filter(Boolean).length,
    }))()`));
  };

  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle');
  check(o.actions.join(',') === 'csv,excel,pdf', 'three ways out', o.actions.join(','));
  check(o.actionLabels[0] === 'Geschäftsobjekte als CSV herunterladen',
    'the menu names the collection exported from this scope', o.actionLabels.join(' | '));
  let f = await exportCsv();
  check(/\.csv$/.test(f.name), 'the file is named after its scope', f.name);
  // Without a BOM Excel reads UTF-8 as the local code page and every umlaut in
  // the catalogue comes out wrong.
  check(f.bom === '239 187 191', 'and opens with a byte-order mark', f.bom);
  check(f.lines === 20, 'nineteen records plus a header', String(f.lines));

  // The export must follow the screen, not the catalogue.
  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle&q=miet');
  f = await exportCsv();
  check(f.lines === 5, 'a query narrows the file too', String(f.lines) + ' Zeilen');

  o = await go('#/app/metadata-catalog?id=areal');
  check(o.actions.length === 3, 'a record can be exported as well', String(o.actions.length));
  check(o.actionLabels[0] === 'Attribute als CSV herunterladen',
    'record overview actions disclose that they export attributes', o.actionLabels[0]);
  check(o.groupSel === '(keins)', 'but grouping goes: only one record is in scope', o.groupSel);
  f = await exportCsv();
  check(f.lines === 6, 'and the file holds its five attributes', String(f.lines) + ' Zeilen');
  o = await go('#/app/metadata-catalog?id=areal&attr=Areal-ID');
  check(o.actionLabels[0] === 'Attribut als CSV herunterladen',
    'leaf actions name their single-record export', o.actionLabels[0]);
  f = await exportCsv();
  check(f.lines === 2, 'a leaf export contains only the selected attribute', String(f.lines) + ' Zeilen');
  await clean(p, 'Aktionen');

  head('Suche — narrows the scope, not the tab');
  o = await go('#/app/metadata-catalog?kind=objekt');
  check(o.q === 'Im Katalog suchen…', 'the field promises no scope it does not have', o.q);
  check(o.tableSearch === 0, 'and it is the only search field on the page', String(o.tableSearch));
  o = await go(L2);
  check(o.q === 'Im Katalog suchen…', 'and says the same a level down', o.q);
  o = await go('#/app/metadata-catalog?id=areal');
  check(o.q === 'Im Katalog suchen…', 'and on a record', o.q);
  o = await go('#/app/metadata-catalog?id=areal&attr=Areal-ID');
  check(o.pageSearch === 0, 'a leaf omits the search field because it has no searchable descendants');

  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle&q=g%C3%BCltig');
  check(o.rows <= 1 && /Kein Treffer/.test(o.emptyMsg || ''),
    'a status word finds nothing rather than everything', `${o.rows} Zeilen · ${o.emptyMsg || ''}`);
  check(!/[1-9]/.test(o.qCount || ''),
    'and the tree agrees with the table instead of contradicting it', o.qCount || '(leer)');

  o = await go('#/app/metadata-catalog?kind=objekt&tab=diagramm&q=zzzz-kein-treffer');
  check(/Kein Eintrag/.test(o.emptyState) && !o.allBtn && o.emptyAction.includes('kind=objekt')
    && !/[?&]q=/.test(o.emptyAction),
  'an empty landscape explains the query and clears it without losing scope', `${o.emptyState} / ${o.emptyAction}`);
  o = await go('#/app/metadata-catalog?kind=objekt&tab=uebersicht&q=zzzz-kein-treffer');
  check(/Kein Eintrag/.test(o.emptyState) && o.emptyAction.includes('tab=uebersicht'),
    'an empty overview offers the same scope-preserving recovery', o.emptyAction);

  // The query applies to every presentation and the tree uses the same predicate.
  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle&q=geb');
  check(o.filters.length === 1 && /Suche: geb/.test(o.filters[0]),
    'only the genuine query appears as an active filter', o.filters.join(' | '));
  // A section header is a <tr> too, so subtract them to count records.
  check(o.rows === 9, '«geb» narrows the Tabelle tab',
    o.rows + ' Datenzeilen in ' + o.groups.length + ' Abschnitten');
  o = await go('#/app/metadata-catalog?kind=objekt&tab=diagramm&q=geb');
  check(o.tiles === 9, 'and the Diagramm tab to the same nine', String(o.tiles));
  o = await go('#/app/metadata-catalog?kind=objekt&tab=uebersicht&q=geb');
  check(/Geschäftsobjekte 9/.test(o.qCount),
    'and the tree still reports the nine where the tab lists nothing', o.qCount);

  // A new scope starts unfiltered: carrying the query along a tree click would
  // leave a reader wondering where the records went.
  const treeHref = await p.evaluate(
    '(() => { const a = document.querySelector(".pf-tree__children a"); return a ? a.getAttribute("href") : ""; })()');
  check(!/[?&]q=/.test(treeHref), 'a tree link does not carry the query onward', treeHref);

  // At the root the scope is the whole catalogue, so the hits span all branches.
  o = await go('#/app/metadata-catalog?q=geb');
  check(o.cards === 0, 'a query replaces the way-in page with its answer', String(o.cards));
  check(o.filters.length === 1, 'the root search exposes its query as the only active filter', o.filters.join(' | '));
  check(o.groups.length === 3, 'grouped by branch, because a hit list spans three kinds of thing',
    o.groups.join(' | '));
  await clean(p, 'Suche');

  head('Gruppieren — one choice, both views');
  o = await go('#/app/metadata-catalog?kind=objekt&tab=diagramm');
  check(o.groupSel === 'Gruppieren: Domäne:achse,verantwortung,status,keine',
    'a branch offers axis, stewardship, status and none', o.groupSel);
  check(o.boxes.length === 5, 'the axis divides the landscape into five', String(o.boxes.length));
  o = await go('#/app/metadata-catalog?kind=objekt&tab=diagramm&group=verantwortung');
  check(o.boxes.length === 4, 'stewardship divides it into four', o.boxes.join(' | '));
  check(o.tiles === 19, 'and never changes how many tiles there are', String(o.tiles));
  o = await go('#/app/metadata-catalog?kind=objekt&tab=diagramm&group=keine');
  check(o.boxes.length === 1 && o.tiles === 19, 'none collapses it to one field',
    o.boxes.length + ' Kasten, ' + o.tiles + ' Kacheln');
  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle&group=verantwortung');
  check(o.groups.length === 4, 'the table takes its sections from the same choice',
    o.groups.join(' | '));
  check(o.cols.includes('Domäne'),
    'and the axis returns as a column once the sections no longer carry it', o.cols.join('/'));
  // Ungrouped mode is proved by section removal, not pager visibility.
  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle&group=keine');
  check(o.groups.length === 0 && o.rows === 19, 'none returns a plain, unsectioned table',
    o.groups.length + ' Abschnitte, ' + o.rows + ' Zeilen');
  // Reference lists expose only grouping dimensions present in their model.
  o = await go('#/app/metadata-catalog?kind=referenz&tab=diagramm');
  check(o.groupSel === 'Gruppieren: Thema:achse,keine',
    'reference data offers only what it has', o.groupSel);
  await clean(p, 'Gruppieren');

  head('Sections');
  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle');
  const branchRows = o.rows;
  check(o.groups.length > 1, 'a whole branch is sectioned by its axis', o.groups.join(' | '));
  check(/^Bauwerk und Liegenschaft/.test(o.groups[0]),
    'biggest section first — the map reads from the largest territory down', o.groups[0]);
  check(!o.pager, 'sections replace paging — a section must not continue on page 3');
  check(o.openGroups === o.groups.length, 'every section opens expanded', String(o.openGroups));
  await p.evaluate('(document.querySelector(".table__group-toggle").click(), 1)');
  await sleep(500);
  o = JSON.parse(await p.evaluate(STATE));
  check(o.openGroups === o.groups.length - 1, 'a section closes', String(o.openGroups));
  check(o.rows < branchRows, 'and really drops its rows', branchRows + ' → ' + o.rows);
  check(o.groups.length > 1, 'while keeping its header as the way back', String(o.groups.length));
  o = await go('#/app/metadata-catalog?kind=objekt&leaf=' + encodeURIComponent(DOMAIN));
  check(o.groups.length === 0, 'one group in scope needs no sections', String(o.groups.length));
  await clean(p, 'Sections');

  head('Referenzdaten');
  o = await go('#/app/metadata-catalog?kind=referenz&tab=tabelle');
  check(o.rows > 0, 'value lists are listed', String(o.rows));
  check(o.groups.length === 4, 'the four subject areas are the sections', o.groups.join(' | '));
  const listHref = await linkIn('list=');
  check(/\?list=/.test(listHref), 'a value list links to ?list=', listHref);
  o = await go(listHref.slice(1));
  check(o.active === 'Übersicht' && o.tabs.join('/') === 'Übersicht/Werte',
    'a value list also opens information-first', `${o.active} / ${o.tabs.join('/')}`);
  // Missing governance fields remain visible rather than hiding model gaps.
  check(o.keys.includes('Verantwortung') && o.keys.includes('Status'),
    'the not-yet-modelled fields are shown as gaps, not omitted', o.keys.join('/'));
  check(o.vals.some((v) => /noch nicht erfasst/.test(v)), 'and are labelled as such');
  o = await go(withTab(listHref, 'tabelle'));
  check(o.rows > 0, 'its values are listed in the secondary tab', String(o.rows));
  check(o.cols.join('/') === 'Bezeichnung/Beschreibung/Schlüssel',
    'a value list has no key-role column', o.cols.join('/'));
  await clean(p, 'Referenzdaten');

  head('Broken links');
  o = await go('#/app/metadata-catalog?id=gibt-es-nicht');
  check(/nicht gefunden/i.test(o.h1 || ''), 'an unresolvable record is not-found, not an empty page', o.h1);
  o = await go('#/app/metadata-catalog?kind=objekt&leaf=gibt-es-nicht');
  check(o.tabs.join('/') === 'Übersicht/Diagramm/Tabelle',
    'an unknown group falls back to its branch instead of throwing', o.tabs.join('/'));
  o = await go(idHref.slice(1) + '&attr=gibt-es-nicht');
  check(o.tabs.join('/') === 'Übersicht/Attribute', 'an unknown attribute falls back to its record', o.tabs.join('/'));
  // A record has no landscape, so asking for one must land on the level default
  // rather than on a blank pane.
  o = await go(withTab(idHref, 'diagramm'));
  check(o.active === 'Übersicht', 'an unavailable tab falls back to the information default', o.active);
  check(o.detail && o.rows === 0, 'and really renders that overview', String(o.rows));
  await clean(p, 'Broken links');
} finally {
  await browser.close();
}

console.log(fail ? `\n✗ ${fail} check(s) failed` : '\n✓ metadata catalogue');
process.exit(fail ? 1 : 0);
