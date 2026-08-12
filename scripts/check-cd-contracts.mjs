// Measured CD conformance. Every expectation below is transcribed from the CD
// source in C:/…/designsystem/css, with the file and rule named, and compared
// against what the portal actually computes in a browser at three widths.
//
// Reading CSS is not enough for this: a declaration can be correct and still be
// beaten by specificity, and a responsive ramp can be right at one width and
// missing at the next. So the check renders real pages and reads
// getComputedStyle, which is the same thing a designer measures in devtools.
//
// Widths are the CD breakpoints that actually change something: below xl, at xl
// (1280) where the type ramp steps, and at 3xl (1920) where it steps again.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const px = (rem) => `${rem * 16}px`;

// CD type ramps, resolved per width (typography.postcss:18-57).
const TEXT_SM = { 1024: px(0.875), 1280: px(1), 1920: px(1.125) };
const TEXT_BASE = { 1024: px(1), 1280: px(1.125), 1920: px(1.25) };
const TEXT_LG = { 1024: px(1.125), 1280: px(1.25), 1920: px(1.375) };
const TEXT_2XL = { 1024: px(1.625), 1280: px(2), 1920: px(2.5) };

const CHECKS = [
  {
    route: '/applications?view=gallery', selector: '.card__title',
    source: 'card.postcss:215-220  .card__title { text-lg xl:text-xl 3xl:text-2xl; font-bold; leading-snug }',
    // leading-snug is 1.375 × the step the ramp is on at this width.
    expect: { fontSize: TEXT_LG, lineHeight: { 1024: px(1.125 * 1.375), 1280: px(1.25 * 1.375), 1920: px(1.375 * 1.375) } },
  },
  {
    route: '/applications?view=gallery', selector: '.card__body',
    source: 'card.postcss:210-213  .card__body { px-6 py-10; space-y-4 }',
    expect: { paddingTop: () => px(2.5), paddingLeft: () => px(1.5) },
  },
  {
    route: '/applications?view=gallery', selector: '.card__footer__info',
    source: 'card.postcss:254-257  .card__footer__info { text-secondary-500 text--sm; pr-6 }',
    expect: { fontSize: TEXT_SM, paddingRight: () => px(1.5) },
  },
  {
    route: '/applications?view=list', selector: '.table thead th',
    source: 'table.postcss:34-43  thead th { px-6 py-4; text-text-700 uppercase text--sm; align-top }',
    expect: { fontSize: TEXT_SM, paddingTop: () => px(1), paddingLeft: () => px(1.5), textTransform: () => 'uppercase' },
  },
  {
    route: '/applications?view=list', selector: '.table tbody td',
    source: 'table.postcss:45-57  tbody td { px-6 py-4; text--base; text-gray-600 }',
    expect: { fontSize: TEXT_BASE, paddingTop: () => px(1), paddingLeft: () => px(1.5) },
  },
  {
    route: '/', selector: '.section__title',
    source: 'section.postcss:53-56  .section__title { text--bold text--2xl; pb-10 }',
    expect: { fontSize: TEXT_2XL, paddingBottom: () => px(2.5) },
  },
  {
    route: '/applications/liegenschaften-inventar', selector: '.hero__content',
    source: 'hero.postcss:14-16  .hero__content { space-y-6 lg:space-y-8 3xl:space-y-10 }',
    expect: { rowGap: (w) => (w >= 1920 ? px(2.5) : px(2)) },
  },
  {
    route: '/applications/liegenschaften-inventar', selector: '.hero__description',
    source: 'hero.postcss:30-34  .hero__description { text--lg; leading-snug }',
    expect: { fontSize: TEXT_LG },
  },
  {
    route: '/applications', selector: '.container',
    source: 'container.postcss:5-17  .container { px-4 xs:px-7 sm:px-9 lg:px-10 xl:px-12 3xl:px-16 }',
    expect: { paddingLeft: (w) => (w >= 1920 ? px(4) : w >= 1280 ? px(3) : px(2.5)) },
  },
  {
    route: '/applications', selector: '.badge',
    source: 'badge.postcss:5-9,73-77  .badge { py-[0.219em] px-[1em]; rounded-full; text-xs md:text-sm lg:text-base }',
    expect: { borderTopLeftRadius: () => '9999px', fontSize: (w) => px(1) },
  },
  {
    route: '/services', selector: '.btn--outline',
    source: 'btn.postcss:112-117  .btn { min-h-[44px] xl:min-h-[48px] 3xl:min-h-[52px] }',
    expect: { minHeight: (w) => (w >= 1920 ? '52px' : w >= 1280 ? '48px' : '44px') },
  },
];

const WIDTHS = [1024, 1280, 1920];
let failures = 0;
const cdp = await launch();
try {
  for (const check of CHECKS) {
    const page = await openPage(cdp, `${APP_BASE}${check.route}`, { login: true });
    console.log(`\n■ ${check.selector}   ${check.route}`);
    console.log(`  CD: ${check.source}`);
    for (const width of WIDTHS) {
      await cdp.send('Emulation.setDeviceMetricsOverride',
        { width, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
      await sleep(width === WIDTHS[0] ? 2200 : 500);
      const props = Object.keys(check.expect);
      const got = await page.evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(check.selector)});
        if (!el) return null;
        const cs = getComputedStyle(el);
        return JSON.stringify(Object.fromEntries(${JSON.stringify(props)}.map(p => [p, cs[p]])));
      })()`);
      if (!got) { console.log(`  ${width}px  — element not found`); failures++; continue; }
      const actual = JSON.parse(got);
      for (const prop of props) {
        // An expectation is either a function of the width or a ramp keyed by it.
        const rule = check.expect[prop];
        const want = typeof rule === 'function' ? rule(width) : rule[width];
        const ok = String(actual[prop]) === String(want);
        if (!ok) failures++;
        console.log(`  ${ok ? '✓' : '✗'} ${String(width).padStart(4)}px  ${prop.padEnd(18)} want ${String(want).padStart(9)}  got ${actual[prop]}`);
      }
    }
    await page.closeTarget();
  }
} finally {
  await cdp.close();
}
console.log(failures ? `\n${failures} deviation(s) from CD` : '\n✓ every measured property matches CD');
process.exit(failures ? 1 : 0);
