// The landing hero must not move when the source selection opens beneath it.
//
// The hero puts the copy and the photo in two grid columns, and the source
// panel makes the copy column grow by several hundred pixels. Two separate
// rules used to centre things against that growth: `align-items:center` on the
// grid centred the two COLUMNS against each other, and `justify-content:center`
// on the content centred the copy INSIDE its column. Opening the panel
// therefore floated the image down beside the text, and — once the first rule
// was fixed — still pulled the title up by 39px while the image stayed put.
//
// Nothing on a page should move because a panel below it opened, so this suite
// asserts the two positions across the toggle rather than the CSS that produces
// them. It also checks the desktop-only title margin: two columns exist only
// from 768px up, and below that the extra space would sit between the header
// and the first line of the page for no reason.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const cdp = await launch();
let failures = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`   ${ok ? '✓' : '✗'} ${label}${detail ? `  — ${detail}` : ''}`);
};

// Page offsets, so a check reads the same whether or not the page scrolled.
//
// `column` reads .hero__content and not .hero--main-image, because the hero
// element carries the section's own top padding: its box starts above the grid
// tracks, so an image sitting perfectly at the top of its track would measure
// 56px adrift of it. The two columns are the things that have to line up.
const READ = `(() => {
  const top = (selector) => {
    const element = document.querySelector(selector);
    return element ? Math.round(element.getBoundingClientRect().top + scrollY) : null;
  };
  return {
    column: top('.hero__content'),
    title: top('.hero__title'),
    image: top('.hero__image'),
    titleMargin: getComputedStyle(document.querySelector('.hero__title')).marginTop,
    columns: getComputedStyle(document.querySelector('.hero--main-image')).gridTemplateColumns,
  };
})()`;

async function measure(width, height, mobile) {
  const page = await openPage(cdp, `${APP_BASE}/`);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: 1, mobile }, page.sessionId);
  await sleep(1500);
  const closed = await page.evaluate(READ);
  await page.evaluate(`document.querySelector('#search-sources-toggle').click()`);
  await sleep(400);
  const open = await page.evaluate(READ);
  const problems = await page.problems();
  await page.closeTarget();
  return { closed, open, problems };
}

try {
  console.log('■ Desktop: opening the source selection moves nothing above it');
  const desktop = await measure(1440, 1000, false);
  check(desktop.closed.image === desktop.open.image,
    'the image keeps its position', `${desktop.closed.image} → ${desktop.open.image}`);
  check(desktop.closed.title === desktop.open.title,
    'and so does the title', `${desktop.closed.title} → ${desktop.open.title}`);
  check(desktop.open.image === desktop.open.column,
    'the image sits at the top of its track, not centred against a grown column',
    `image ${desktop.open.image}, column ${desktop.open.column}`);

  console.log('\n■ Desktop: the title clears the image edge instead of butting against it');
  check(parseFloat(desktop.closed.titleMargin) > 0,
    'the title carries its own top margin', desktop.closed.titleMargin);
  check(desktop.closed.title > desktop.closed.image,
    'so it starts below the top of the photo',
    `title ${desktop.closed.title}, image ${desktop.closed.image}`);

  // The margin belongs to the two-column layout and to nothing else, so what is
  // asserted is the column count, not a pixel width that could drift apart from
  // the breakpoint the layout actually uses.
  const twoColumns = (state) => state.columns.trim().split(/\s+/).length === 2;
  check(twoColumns(desktop.closed), 'and it belongs to the two-column layout', desktop.closed.columns);

  console.log('\n■ Mobile: one column, so no margin to add');
  const mobile = await measure(390, 900, true);
  check(!twoColumns(mobile.closed), 'the hero has collapsed to one column', mobile.closed.columns);
  check(parseFloat(mobile.closed.titleMargin) === 0,
    'the title sits directly under the header', mobile.closed.titleMargin);
  check(mobile.closed.title === mobile.open.title,
    'and stays there when the selection opens',
    `${mobile.closed.title} → ${mobile.open.title}`);

  console.log('\n■ Columns switch at 768; the margin belongs to the widest tier only (D45)');
  const narrow = await measure(760, 900, false);
  check(!twoColumns(narrow.closed) && parseFloat(narrow.closed.titleMargin) === 0,
    'just below the breakpoint: one column, no margin',
    `${narrow.closed.columns} / ${narrow.closed.titleMargin}`);
  // Since the 2026-08 alignment (docs/design-alignment.md D45, user decision)
  // the offset applies ONLY from 1280: the compact two-column tier keeps the
  // title flush — so just above 768 there are two columns and STILL no margin.
  const wide = await measure(780, 900, false);
  check(twoColumns(wide.closed) && parseFloat(wide.closed.titleMargin) === 0,
    'just above it: two columns, still no margin (compact tier)',
    `${wide.closed.columns} / ${wide.closed.titleMargin}`);

  const problems = [...desktop.problems, ...mobile.problems, ...narrow.problems, ...wide.problems];
  check(problems.length === 0, 'no browser or console errors', problems.slice(0, 2).join(' | '));
} finally {
  cdp.close();
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
