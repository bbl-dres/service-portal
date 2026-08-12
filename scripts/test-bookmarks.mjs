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
//
// PLACEMENT is measured, not just queried. The star sits in the top right corner
// OF THE PICTURE, so the assertion has to be geometric: a rule that moves it out
// of the frame, or a hero whose image loses its positioning context, still
// matches `.hero__image > .bookmark-star` while landing anywhere on the page.
// `stars` carries the other half of the contract — one control per record, never
// the overlay AND the title-row fallback on the same screen.
const STAR = `(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 100 && !document.querySelector('.hero__title'); i++) await w(50);
  await w(250);
  const s = document.querySelector('.bookmark-star');
  const frame = document.querySelector('.hero__image')?.getBoundingClientRect();
  const box = s?.getBoundingClientRect();
  return {
    heading: document.querySelector('.hero__title')?.textContent.trim() || '',
    present: !!s,
    stars: document.querySelectorAll('.bookmark-star').length,
    hasImage: !!frame,
    overImage: !!document.querySelector('.hero__image > .bookmark-star'),
    inTitleRow: !!document.querySelector('.hero__titlebar > .bookmark-star'),
    // Inside the frame, in its upper half, and closer to the left edge than to
    // the right — «top left corner» without pinning an exact inset.
    topLeft: !!(box && frame && box.top >= frame.top - 1 && box.bottom <= frame.bottom + 1
      && box.top - frame.top < frame.height / 2
      && box.left - frame.left < frame.right - box.right),
    // The icon, not the button: the hit area was always ~44px, the SYMBOL is
    // what had to grow to hold its own against a photograph.
    iconSize: Math.round(s?.querySelector('.icon')?.getBoundingClientRect().width || 0),
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

// Two controls for one record, on the pages that have a «Zugriff» card. The
// point of the pair is that they never disagree: the card link is the same
// toggle spelled out, so clicking it has to fill the star in the head — and it
// is a redraw of the OTHER control, the one path a per-button handler would miss.
const CARD_LINK = `(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 100 && !document.querySelector('.bookmark-link'); i++) await w(50);
  const link = document.querySelector('.bookmark-link');
  const star = document.querySelector('.bookmark-star');
  const label = () => link.querySelector('.btn__text')?.textContent.trim() || '';
  const before = { pressed: link.getAttribute('aria-pressed'), label: label() };
  link.click();
  await w(250);
  return {
    inCard: !!document.querySelector('.access-card .bookmark-link'),
    // Below the target and its session hint: saving answers a later question.
    afterAction: !!(link.compareDocumentPosition(document.querySelector('.access-card__action'))
      & Node.DOCUMENT_POSITION_PRECEDING),
    labelled: /Favoriten/.test(before.label),
    // A visible label plus an identical tooltip is read out twice.
    noTooltip: !link.hasAttribute('title'),
    before,
    after: { pressed: link.getAttribute('aria-pressed'), label: label() },
    starPressed: star?.getAttribute('aria-pressed') || '',
    starFilled: /StarFilled/.test(star?.querySelector('.icon')?.getAttribute('style') || ''),
  };
})()`;

// The catalogue mark, read at BOTH widths from the same page. The desktop copy
// sits on the picture and the phone copy in the pill row; the contract is that
// exactly ONE of them is ever live, because two would be announced twice.
const MARKS_GALLERY = `(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 120 && !document.querySelector('.card'); i++) await w(50);
  await w(300);
  const shown = (el) => !!el && el.getClientRects().length > 0;
  const cards = [...document.querySelectorAll('.card')];
  const live = (card) => [...card.querySelectorAll('.bookmark-mark')].filter(m => shown(m));
  return {
    cards: cards.length,
    marked: cards.filter(c => live(c).length).length,
    // Never both copies at once, at any width.
    doubled: cards.filter(c => live(c).length > 1).length,
    onImage: cards.filter(c => live(c).some(m => m.closest('.card__mark'))).length,
    inBody: cards.filter(c => live(c).some(m => m.closest('.card__mark-inline'))).length,
    // Compare against the STORE rather than a hard-coded title: earlier checks in
    // this file toggle records, and a fixed expectation would encode their order.
    // Every card link ends in the record's id, which is what a bookmark holds.
    wrong: cards.filter((card) => {
      const href = card.querySelector('.card__link')?.getAttribute('href') || '';
      const id = decodeURIComponent(href.split('/').pop() || '');
      const saved = (JSON.parse(localStorage.getItem('bbl_bookmarks_v1') || '{}')['U.123.456']?.items || [])
        .some((i) => i.id === id);
      return saved !== (live(card).length > 0);
    }).length,
    interactive: cards.reduce((n, c) => n + c.querySelectorAll('.bookmark-mark button, .bookmark-mark [tabindex], button .bookmark-mark').length, 0),
  };
})()`;

const MARKS_LIST = `(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 120 && !document.querySelector('.table tbody tr'); i++) await w(50);
  await w(300);
  const heads = [...document.querySelectorAll('.table thead th')];
  const header = heads.find(h => h.querySelector('.sr-only'));
  return {
    column: heads.indexOf(header),
    headerText: header?.textContent.trim() || '',
    // The name is there for assistive technology but takes no layout room.
    headerHidden: !!header && header.getBoundingClientRect().width < 60,
    rows: document.querySelectorAll('.table tbody tr').length,
    marks: document.querySelectorAll('.table tbody .bookmark-mark').length,
    interactive: document.querySelectorAll('.table tbody .bookmark-mark button, .table tbody .bookmark-mark [tabindex]').length,
  };
})()`;

// The saved-only filter has to narrow the catalogue, say so in the pill bar, and
// stay deep-linkable. German UI term: `Nur meine Favoriten`.
const SAVED_FILTER = `(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 120 && !document.querySelector('.card, .table tbody tr'); i++) await w(50);
  await w(300);
  const box = document.querySelector('input[data-fdim="bookmark"]');
  const count = () => document.querySelectorAll('.card, .table tbody tr').length;
  const before = count();
  box?.click();
  await w(600);
  return {
    offered: !!box,
    label: box?.closest('label')?.textContent.trim() || '',
    before,
    after: count(),
    hash: location.hash,
    pill: [...document.querySelectorAll('.active-filters a, .pill-row a, .tag-item')]
      .map(el => el.textContent.trim()).find(t => /Favoriten/.test(t)) || '',
    allMarked: [...document.querySelectorAll('.card')].every(c => c.querySelector('.bookmark-mark'))
      && [...document.querySelectorAll('.table tbody tr')].every(r => r.querySelector('.bookmark-mark')),
  };
})()`;

const cdp = await launch();
// The card mark is the one contract here that DEPENDS on viewport width, so the
// suite has to be able to change it rather than trust the default.
const setWidth = (page, width) => cdp.send('Emulation.setDeviceMetricsOverride',
  { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 }, page.sessionId);
let page;
try {
  // One star, one place. Services, datasets and applications are the three heads
  // people arrive at from search, and the star has to mean the same gesture on
  // all of them; checking only the dataset let the other two drift.
  head('One star in one place across the three detail heads');
  for (const [label, route] of [
    ['Dienstleistung', '/services/raumbedarf-melden'],
    ['Datensatz', '/data/catalog/2'],
    ['Anwendung', '/applications/liegenschaften-inventar'],
  ]) {
    page = await openPage(cdp, `${APP_BASE}${route}`, { login: true });
    const star = await page.evaluate(STAR);
    check(star.present && star.stars === 1,
      `${label}: exactly one «merken» control in the head`, `${star.stars} found — ${star.heading}`);
    check(star.hasImage && star.overImage && star.topLeft,
      `${label}: the star sits in the top left corner of .hero__image`);
    check(star.iconSize >= 32,
      `${label}: the star reads at hero scale, not at row scale`, `${star.iconSize}px`);
    await page.closeTarget();
  }

  head('The «Zugriff» card carries the same control, spelled out');
  for (const [label, route] of [
    ['Dienstleistung', '/services/raumbedarf-melden'],
    ['Anwendung', '/applications/liegenschaften-inventar'],
  ]) {
    page = await openPage(cdp, `${APP_BASE}${route}`, { login: true });
    const card = await page.evaluate(CARD_LINK);
    check(card.inCard && card.afterAction && card.labelled,
      `${label}: a labelled «merken» link below the card's own action`, card.before.label);
    check(card.noTooltip, `${label}: no tooltip repeating the visible label`);
    check(card.after.pressed !== card.before.pressed && card.after.label !== card.before.label,
      `${label}: the link toggles state AND wording`, `${card.before.label} → ${card.after.label}`);
    check(card.starPressed === card.after.pressed && card.starFilled === (card.after.pressed === 'true'),
      `${label}: the star in the head follows the card link`, `star aria-pressed=${card.starPressed}`);
    await page.closeTarget();
  }

  // The catalogue marks. Three properties, each of which fails silently: they
  // must appear ONLY on saved records (a mark on everything says nothing), they
  // must not be controls (twelve toggles per page would sit between the reader
  // and the next link), and the list's column must keep an accessible name even
  // though its header is not drawn.
  // COLD START, before anything else has read the store. The seed only lands
  // once data/users.json is loaded (js/core/bookmarks.js seedOnce), and a route
  // that draws marks without declaring `users` in its `needs` shows a person
  // none of their own favourites — but looks correct the moment any earlier page
  // in the same session has loaded the directory. So this runs on a wiped store,
  // straight to the catalogue, or it proves nothing.
  head('A catalogue opened cold already knows what is saved');
  for (const [label, route] of [
    ['Anwendungen', '/applications?view=list'],
    ['Dienstleistungen', '/services?view=list'],
    ['Datensätze', '/data/catalog?view=list'],
  ]) {
    page = await openPage(cdp, `${APP_BASE}${route}`, { login: true, clearStorage: true });
    const cold = await page.evaluate(`(async () => {
      const w = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 150 && !document.querySelector('.table tbody tr'); i++) await w(50);
      await w(400);
      const store = JSON.parse(localStorage.getItem('bbl_bookmarks_v1') || '{}');
      return { seeded: store['U.123.456']?.seeded === true,
        items: (store['U.123.456']?.items || []).length,
        marks: document.querySelectorAll('.table tbody .bookmark-mark').length };
    })()`);
    check(cold.seeded && cold.items > 0,
      `${label}: the route loads the directory the seed needs`, `${cold.items} seeded entries`);
    check(cold.marks > 0, `${label}: and marks the saved rows on that first paint`, `${cold.marks} marks`);
    await page.closeTarget();
  }

  head('Catalogue rows and cards show what is already saved');
  for (const [label, gallery, list, hasPictures] of [
    ['Anwendungen', '/applications?view=gallery', '/applications?view=list', true],
    ['Dienstleistungen', '/services?view=gallery', '/services?view=list', false],
    ['Datensätze', '/data/catalog?view=gallery', '/data/catalog?view=list', true],
  ]) {
    page = await openPage(cdp, `${APP_BASE}${gallery}`, { login: true });
    await setWidth(page, 1440);
    const desktop = await page.evaluate(MARKS_GALLERY);
    check(desktop.cards > 1 && desktop.marked >= 1 && desktop.marked < desktop.cards,
      `${label} gallery: marks on some cards, not all`, `${desktop.marked} of ${desktop.cards} cards`);
    check(!desktop.wrong, `${label} gallery: marked cards are exactly the saved records`,
      `${desktop.wrong} card(s) disagree with the store`);
    check(!desktop.doubled, `${label} gallery: never both copies of the mark at once`);
    check(hasPictures ? desktop.onImage && !desktop.inBody : desktop.inBody && !desktop.onImage,
      `${label} gallery: the mark sits ${hasPictures ? 'on the picture' : 'in the pill row (these cards have none)'}`);
    check(desktop.interactive === 0, `${label} gallery: the marks are not controls`);

    // These grids keep their card images at every width (only .catalogue-grid,
    // the search page, drops them), so the placement must NOT change at 375px.
    await setWidth(page, 375);
    const phone = await page.evaluate(MARKS_GALLERY);
    check(phone.marked === desktop.marked && !phone.wrong,
      `${label} gallery: the same cards stay marked on a phone`, `${phone.marked} of ${phone.cards}`);
    check(!phone.doubled && phone.onImage === desktop.onImage && phone.inBody === desktop.inBody,
      `${label} gallery: and in the same place, because these grids keep their images`);
    await page.closeTarget();

    page = await openPage(cdp, `${APP_BASE}${list}`, { login: true });
    const rows = await page.evaluate(MARKS_LIST);
    check(rows.column === 1, `${label} list: the mark column follows the name column`, `index ${rows.column}`);
    check(rows.headerText === 'Favorit' && rows.headerHidden,
      `${label} list: the column keeps a name for screen readers without drawing one`, rows.headerText);
    check(rows.marks >= 1 && rows.marks < rows.rows && rows.interactive === 0,
      `${label} list: marks on the saved rows only, none of them a control`,
      `${rows.marks} of ${rows.rows} rows`);
    await page.closeTarget();
  }

  head('«Nur meine Favoriten» narrows the catalogue');
  for (const [label, route] of [
    ['Anwendungen', '/applications?view=list'],
    ['Dienstleistungen', '/services?view=list'],
    ['Datensätze', '/data/catalog?view=list'],
  ]) {
    page = await openPage(cdp, `${APP_BASE}${route}`, { login: true });
    const f = await page.evaluate(SAVED_FILTER);
    check(f.offered && /Favoriten/.test(f.label), `${label}: the panel offers the filter`, f.label);
    check(f.after > 0 && f.after < f.before, `${label}: it narrows the catalogue`, `${f.before} → ${f.after}`);
    check(f.allMarked, `${label}: everything left carries the mark`);
    check(/bookmark=saved/.test(f.hash), `${label}: the state is deep-linkable`, f.hash);
    check(/Favoriten/.test(f.pill), `${label}: and removable from the active-filter bar`, f.pill);
    await page.closeTarget();
  }

  head('Signed out, the favourites filter is not offered at all');
  page = await openPage(cdp, `${APP_BASE}/applications?view=list&bookmark=saved`);
  const anon = await page.evaluate(`(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 120 && !document.querySelector('.table tbody tr'); i++) await w(50);
    return { box: !!document.querySelector('input[data-fdim="bookmark"]'),
      rows: document.querySelectorAll('.table tbody tr').length,
      marks: document.querySelectorAll('.bookmark-mark').length };
  })()`);
  check(!anon.box, 'no filter without a person to have favourites');
  // A hand-typed ?bookmark=saved must not empty a catalogue nobody can un-filter.
  check(anon.rows > 1 && anon.marks === 0,
    'a hand-typed filter value is ignored rather than emptying the page', `${anon.rows} rows`);
  await page.closeTarget();

  // The fallback is not decoration: dataset 20 is the one record in twenty with
  // no preview image, and the star has to survive the missing frame rather than
  // disappear with it.
  head('A head without a picture keeps its star');
  page = await openPage(cdp, `${APP_BASE}/data/catalog/20`, { login: true });
  const bare = await page.evaluate(STAR);
  check(!bare.hasImage, 'this dataset renders without a hero image', bare.heading);
  check(bare.present && bare.inTitleRow && bare.stars === 1,
    'without a picture the star falls back to the title row');
  await page.closeTarget();

  head('Dataset star');
  page = await openPage(cdp, `${APP_BASE}/data/catalog/3`, { login: true });
  const initial = await page.evaluate(STAR);
  check(initial.present && initial.overImage,
    'the star renders over the detail head image', initial.heading);
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
