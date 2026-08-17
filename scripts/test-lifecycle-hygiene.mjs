// Two properties that are invisible until they have gone wrong for a while.
//
// Both are about the difference between a node this render built and a node the
// router reuses. `#main-content` survives every navigation — only its innerHTML
// is replaced — so anything wired to IT and not disposed accumulates for the
// life of the page, while the identical call on a child node is harmless. That
// distinction is not readable at the call site, which is why it is enforced in
// the components and checked here.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};
const head = (title) => console.log(`\n■ ${title}`);

// Count listeners the honest way: through the debugger, not by guessing from
// behaviour. A stacked row handler fires the row's link once per copy.
async function eventListenerCount(cdp, page, expression, type) {
  const { result } = await cdp.send('Runtime.evaluate',
    { expression, objectGroup: 'probe' }, page.sessionId);
  if (!result.objectId) return -1;
  const { listeners = [] } = await cdp.send('DOMDebugger.getEventListeners',
    { objectId: result.objectId, depth: 0 }, page.sessionId);
  return listeners.filter((listener) => listener.type === type).length;
}
const clickListenerCount = (cdp, page, selector) => eventListenerCount(
  cdp, page, `document.querySelector(${JSON.stringify(selector)})`, 'click');

const cdp = await launch();
let page;
try {
  head('Row wiring does not stack on the reused mount');
  // The shop catalogue in list view wires #main-content itself. Every search,
  // sort, filter and page change is a fresh dispatch through the same element.
  page = await openPage(cdp, `${APP_BASE}/app/shop?view=list`, { login: true });
  await sleep(2500);
  const first = await clickListenerCount(cdp, page, '#main-content');
  check(first >= 0, 'the shop list view renders', `${first} click listener(s)`);

  for (const hash of ['#/app/shop?view=list&sort=name', '#/app/shop?view=list&sort=price',
    '#/app/shop?view=list&page=2', '#/app/shop?view=list']) {
    await page.evaluate(`(() => { location.hash = ${JSON.stringify(hash)}; })()`);
    await sleep(900);
  }
  const after = await clickListenerCount(cdp, page, '#main-content');
  check(after <= first, 'four more dispatches add no further handlers',
    `${first} → ${after}`);

  // The property above holds as long as every call site disposes. This one holds
  // even when a call site does NOT — it is the guard inside wireTableRows, and it
  // is checked directly because no call site can prove it: a forgotten disposal
  // on a node that dies with its markup looks identical to a correct one.
  const guarded = await page.evaluate(`(async () => {
    const { default: C } = await import(new URL('js/components.js', location.href.split('#')[0]).href);
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.innerHTML = '<table class="table table--rows-clickable"><tbody><tr><td>x</td>'
      + '<td><a href="#/probe-target">go</a></td></tr></tbody></table>';
    let hits = 0;
    const link = host.querySelector('a');
    link.addEventListener('click', (e) => { e.preventDefault(); hits++; });
    // Wire the same root three times, discarding every disposer.
    C.wireTableRows(host); C.wireTableRows(host); C.wireTableRows(host);
    host.querySelector('td').click();
    await new Promise(r => setTimeout(r, 100));
    const result = hits;
    host.remove();
    return result;
  })()`);
  check(guarded === 1, 'three wirings of one root still follow the link exactly once',
    `${guarded} navigation(s)`);

  // And a row still follows its link exactly once.
  const nav = await page.evaluate(`(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 100 && !document.querySelector('.table--rows-clickable tbody tr'); i++) await w(50);
    const before = location.hash;
    document.querySelector('.table--rows-clickable tbody tr td')?.click();
    await w(600);
    return { before, after: location.hash };
  })()`);
  check(nav.after !== nav.before && /\/product\//.test(nav.after),
    'a row click still opens the record', nav.after);
  await page.closeTarget();

  head('The landing route does not carry the knowledge index');
  // 50 KB of prose for a suggestion list that cannot appear before the second
  // typed character. It must arrive on the keystroke, not with the page.
  page = await openPage(cdp, `${APP_BASE}/`, { login: true });
  await sleep(2500);
  const scriptsFor = `(() => [...performance.getEntriesByType('resource')]
    .map(e => e.name).filter(n => /knowledge-content/.test(n)).length)()`;
  const atRest = await page.evaluate(scriptsFor);
  check(atRest === 0, 'not requested while the page is merely open', `${atRest} request(s)`);

  const typed = await page.evaluate(`(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const input = document.querySelector('#home-q');
    if (!input) return { error: 'no home search field' };
    input.value = 'raum';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    for (let i = 0; i < 60 && !document.querySelectorAll('.listbox--suggest .listbox__option').length; i++) await w(50);
    return {
      loaded: [...performance.getEntriesByType('resource')].filter(e => /knowledge-content/.test(e.name)).length,
      options: document.querySelectorAll('.listbox--suggest .listbox__option').length,
    };
  })()`);
  check(typed.loaded === 1, 'fetched once on the first keystroke', `${typed.loaded} request(s)`);
  check(typed.options > 0, 'and the suggestions still appear', `${typed.options} option(s)`);

  // Typing past a query must not let the slower one paint over the newer list.
  const raced = await page.evaluate(`(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const input = document.querySelector('#home-q');
    input.value = 'ra'; input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = 'stoerung'; input.dispatchEvent(new Event('input', { bubbles: true }));
    await w(500);
    return [...document.querySelectorAll('.listbox--suggest .listbox__option .listbox__title')]
      .map(el => el.textContent.trim());
  })()`);
  check(raced.length === 0 || raced.some(t => /St(ö|oe)rung/i.test(t)),
    'the list belongs to the last query typed, not the first', raced.slice(0, 2).join(' · '));

  // Emptying the field must leave it closed, including against an in-flight query.
  const cleared = await page.evaluate(`(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const input = document.querySelector('#home-q');
    input.value = 'raum'; input.dispatchEvent(new Event('input', { bubbles: true }));
    input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true }));
    await w(500);
    return document.querySelectorAll('.listbox--suggest .listbox__option').length;
  })()`);
  check(cleared === 0, 'clearing the field closes the list and keeps it closed', `${cleared} option(s)`);

  head('Header rerender releases transient search state');
  const headerState = await page.evaluate(`(async () => {
    const { shell } = await import(new URL('js/ui/shell/index.js', location.href.split('#')[0]).href);
    const oldInput = document.querySelector('#global-search');
    let staleFocusCalls = 0;
    oldInput.focus = () => { staleFocusCalls++; };
    document.querySelector('#search-toggle').click();
    const opened = document.body.classList.contains('body--search-is-open');
    shell.renderHeader(document.querySelector('#main-header'));
    await new Promise(resolve => setTimeout(resolve, 120));
    localStorage.setItem('bbl_shop_cart_v1', JSON.stringify([{ id: 1, qty: 7 }]));
    window.dispatchEvent(new StorageEvent('storage', { key: 'bbl_shop_cart_v1' }));
    await new Promise(resolve => setTimeout(resolve, 0));
    return {
      opened,
      bodyOpen: document.body.classList.contains('body--search-is-open'),
      replacementOpen: document.querySelector('#header-search')?.classList.contains('open'),
      staleFocusCalls,
      cartCounts: [...document.querySelectorAll('#main-header [data-cart-count]')]
        .map((node) => node.textContent.trim()),
    };
  })()`);
  check(headerState.opened && !headerState.bodyOpen && !headerState.replacementOpen,
    'rerender closes the global search state');
  check(headerState.staleFocusCalls === 0,
    'rerender cancels focus work owned by the replaced input', `${headerState.staleFocusCalls} call(s)`);
  check(headerState.cartCounts.length > 0 && headerState.cartCounts.every((count) => count === '7'),
    'a cross-tab cart storage event refreshes the replacement header', headerState.cartCounts.join('|'));
  await page.closeTarget();

  head('Building wizard redraw replaces its document listener');
  page = await openPage(cdp, `${APP_BASE}/app/building-create`, { login: true });
  await sleep(1800);
  const documentClicksBefore = await eventListenerCount(cdp, page, 'document', 'click');
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate(`document.querySelector('#bc-form')?.requestSubmit()`);
    await sleep(150);
  }
  const documentClicksAfter = await eventListenerCount(cdp, page, 'document', 'click');
  check(documentClicksAfter <= documentClicksBefore,
    'three validation redraws add no document click handlers',
    `${documentClicksBefore} → ${documentClicksAfter}`);
  await page.closeTarget();
} finally {
  await cdp.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\n✓ all checks passed');
process.exit(failures ? 1 : 0);
