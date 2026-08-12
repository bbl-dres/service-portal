// Personal bookmarks: the star, the store and the favourites band.
//
// Three contracts are checked here rather than in the suites of the pages that
// happen to carry them, because they are properties of the FEATURE and each is
// the kind that breaks silently:
//   · one store — room booking's star and the dataset star write to the same
//     place, so a person's favourites cannot split in two;
//   · seed then deltas — data/users.json fills an empty profile, and a removal
//     survives the next load instead of being handed back by the seed;
//   · nothing without a person — the catalogue pages carrying the star stay
//     public, so the signed-out state is real rather than theoretical.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const KEY = 'bbl_bookmarks_v1';
const DEMO = 'U.123.456';

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};
const head = (title) => console.log(`\n■ ${title}`);

// The star lives in the detail head; wait for the page, then read its state.
const STAR = `(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 100 && !document.querySelector('.hero__title'); i++) await w(50);
  await w(250);
  const s = document.querySelector('.bookmark-star');
  return {
    heading: document.querySelector('.hero__title')?.textContent.trim() || '',
    present: !!s,
    inTitleRow: !!document.querySelector('.hero__titlebar > .bookmark-star'),
    pressed: s?.getAttribute('aria-pressed') || '',
    named: (s?.querySelector('.sr-only')?.textContent || '').includes(
      document.querySelector('.hero__title')?.textContent.trim() || '\\u0000'),
    filled: /StarFilled/.test(s?.querySelector('.icon')?.getAttribute('style') || ''),
  };
})()`;

const CLICK_STAR = `(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  const s = document.querySelector('.bookmark-star');
  s.focus();
  s.click();
  await w(250);
  const now = document.querySelector('.bookmark-star');
  return {
    pressed: now.getAttribute('aria-pressed'),
    filled: /StarFilled/.test(now.querySelector('.icon')?.getAttribute('style') || ''),
    keptFocus: document.activeElement === now,
    announced: document.getElementById('live')?.textContent.trim() || '',
    stored: localStorage.getItem('${KEY}') || '',
  };
})()`;

const BAND = `(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 150 && !document.querySelector('#cases-bookmarks section'); i++) await w(100);
  await w(250);
  const band = document.querySelector('#cases-bookmarks section');
  const table = document.querySelector('#cases-table');
  const width = band?.getBoundingClientRect().width;
  return {
    present: !!band,
    cls: band?.className || '',
    innerContainer: !!band?.querySelector(':scope > .container'),
    // A CD band tints the SECTION and keeps .container inside it; nested in the
    // page's own container the tint would stop at the reading column.
    notNested: !band?.closest('.container.section'),
    edgeToEdge: width ? Math.round(width) === Math.round(document.documentElement.clientWidth) : false,
    belowTable: !!(table && band && (table.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING)),
    title: band?.querySelector('.section__title')?.textContent.trim() || '',
    tiles: [...document.querySelectorAll('#cases-bookmarks .quick-tile')].map(t => ({
      label: t.querySelector('.quick-tile__label')?.textContent.trim(),
      kind: t.querySelector('.quick-tile__meta')?.textContent.trim(),
      href: t.getAttribute('href'),
    })),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;

const cdp = await launch();
let page;
try {
  head('Dataset star');
  page = await openPage(cdp, `${APP_BASE}/data/catalog/3`, { login: true });
  const initial = await page.evaluate(STAR);
  check(initial.present && initial.inTitleRow,
    'the star renders in the detail head title row', initial.heading);
  check(initial.pressed === 'false' && !initial.filled,
    'an unsaved record shows the outline star with aria-pressed=false');
  check(initial.named, 'the accessible name carries the record title, not just «merken»');

  const clicked = await page.evaluate(CLICK_STAR);
  check(clicked.pressed === 'true' && clicked.filled,
    'clicking fills the star and flips aria-pressed');
  check(clicked.keptFocus, 'the star keeps focus through the toggle');
  check(/Favoriten/.test(clicked.announced), 'the change is announced', clicked.announced);
  const stored = JSON.parse(clicked.stored || '{}');
  const items = stored[DEMO]?.items || [];
  check(items.some((i) => i.kind === 'dataset' && i.id === '3'),
    'the bookmark is filed under the signed-in person as a typed reference',
    JSON.stringify(items.find((i) => i.kind === 'dataset') || {}));
  check(items.length > 1 && stored[DEMO]?.seeded === true,
    'the profile was seeded from data/users.json before the toggle', `${items.length} entries`);
  await page.closeTarget();

  head('Seed, deltas and the signed-out state');
  // A REMOVAL must survive the next load. Without a persisted «seeded» flag the
  // seed would hand the entry straight back, and the star would appear to have
  // no effect at all.
  page = await openPage(cdp, `${APP_BASE}/data/catalog/1`, { login: true });
  await page.evaluate(`(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 100 && !document.querySelector('.bookmark-star'); i++) await w(50);
    const s = document.querySelector('.bookmark-star');
    if (s.getAttribute('aria-pressed') === 'false') { s.click(); await w(200); }
    s.click(); await w(200);   // saved, then removed again
    return true;
  })()`);
  await page.closeTarget();
  page = await openPage(cdp, `${APP_BASE}/data/catalog/1`, { login: true });
  const afterReload = await page.evaluate(STAR);
  check(afterReload.pressed === 'false',
    'a removed bookmark stays removed across a reload (the seed does not restore it)');
  await page.closeTarget();

  page = await openPage(cdp, `${APP_BASE}/data/catalog/3`, { login: false });
  const signedOut = await page.evaluate(STAR);
  check(signedOut.heading !== '' && !signedOut.present,
    'the public dataset page renders, but signed out it carries no star');
  await page.closeTarget();

  head('Favourites band');
  page = await openPage(cdp, `${APP_BASE}/my-cases`, { login: true });
  const band = await page.evaluate(BAND);
  check(band.present && band.title === 'Meine Favoriten', 'the band renders', band.title);
  check(band.belowTable, 'it sits below the cases table');
  check(/\bsection--default\b/.test(band.cls) && /\bbg--secondary-50\b/.test(band.cls)
    && band.innerContainer && band.notNested && band.edgeToEdge,
    'it is a CD section band: tint on the section, container inside, edge to edge', band.cls);
  check(band.overflowX <= 1, `the band causes no horizontal overflow (${band.overflowX}px)`);
  const kinds = [...new Set(band.tiles.map((t) => t.kind))];
  check(band.tiles.length > 0 && kinds.length > 1,
    'the seed spans more than one inventory', kinds.join(', '));
  check(band.tiles.every((t) => t.href && t.href !== '#'),
    'every tile resolves to a real target', band.tiles[0]?.href || '');

  // A reference whose record no longer exists must vanish, not render a tile
  // with an empty title: prototype fixtures get regenerated.
  const dangling = await page.evaluate(`(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const store = JSON.parse(localStorage.getItem('${KEY}') || '{}');
    store['${DEMO}'] = { seeded: true, items: [
      { kind: 'dataset', id: '1', addedAt: '2026-08-01' },
      { kind: 'dataset', id: 'gone', addedAt: '2026-08-02' },
      { kind: 'building', id: 'nope/nope/XX', addedAt: '2026-08-03' },
    ] };
    localStorage.setItem('${KEY}', JSON.stringify(store));
    location.reload();
    await w(50);
    return true;
  })()`).catch(() => true);
  await sleep(2500);
  const dropped = await page.evaluate(BAND);
  check(dropped.tiles.length === 1 && !!dropped.tiles[0].label,
    'references to vanished records are dropped rather than rendered empty',
    dropped.tiles.map((t) => t.label).join(', '));

  const problems = await page.problems();
  check(problems.length === 0, `no exceptions / console errors${problems[0] ? ': ' + problems[0] : ''}`);
  await page.closeTarget();
  page = null;

  head('One store, not two');
  // Room booking kept its own anonymous favourites map. Its star must now write
  // where every other star writes, or a person's favourite room and their
  // bookmarked room would live in different places.
  page = await openPage(cdp, `${APP_BASE}/app/room-booking`, { login: true });
  const shared = await page.evaluate(`(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 150 && !document.querySelector('[data-fav-kind="building"]'); i++) await w(100);
    const b = document.querySelector('[data-fav-kind="building"]');
    const id = b.dataset.favId;
    const before = b.getAttribute('aria-pressed');
    b.click();
    await w(400);
    const store = JSON.parse(localStorage.getItem('${KEY}') || '{}');
    return {
      id, before,
      after: document.querySelector('[data-fav-kind="building"]')?.getAttribute('aria-pressed'),
      items: (store['${DEMO}']?.items || []).filter(i => i.kind === 'building').map(i => i.id),
      legacyGone: localStorage.getItem('bbl_favorites_v1') === null,
    };
  })()`);
  check(shared.after !== shared.before, 'the room-booking star still toggles', `${shared.before} → ${shared.after}`);
  check(shared.items.includes(shared.id),
    'it writes into the shared bookmark store under the same person', shared.items.join(', '));
  check(shared.legacyGone, 'the legacy anonymous favourites key is migrated away');
  const bookingProblems = await page.problems();
  check(bookingProblems.length === 0,
    `room booking has no runtime problems${bookingProblems[0] ? ': ' + bookingProblems[0] : ''}`);
} finally {
  if (page) await page.closeTarget().catch(() => {});
  cdp.close();
}

console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
