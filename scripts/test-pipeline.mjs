// Focused browser contract for the shared status pipeline on a real case.
// In particular, CSS-mask failures do not reliably reach the console, so this
// suite resolves and fetches every rendered glyph URL explicitly.
import { APP_BASE, launch, openPage, sleep } from './lib/cdp.mjs';

const EXPECTED_LABELS = ['Gemeldet', 'Triage', 'In Arbeit', 'Erledigt'];
const EXPECTED_STATES = ['done', 'done', 'active', 'todo'];
const VIEWPORTS = [
  { width: 320, iconSize: 20, rows: 2 },
  { width: 768, iconSize: 24, rows: 1 },
  { width: 1440, iconSize: 24, rows: 1 },
];

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

const setViewport = async (cdp, page, width) => {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height: 1000, deviceScaleFactor: 1, mobile: width < 768,
  }, page.sessionId);
  await sleep(120);
};

const cdp = await launch();
let page;
try {
  page = await openPage(cdp, `${APP_BASE}/my-cases/seed-2`, { login: true });
  // The reference lives in the CD meta strip ABOVE the h1, not inside it: the
  // case header follows Hero.vue's anatomy, where MetaInfo carries process,
  // reference, object and date and the h1 is only the title
  // (docs/case-view-alignment.md V1).
  const ready = await page.waitFor(`document.querySelectorAll('.pipeline__step').length === 4
    && document.querySelector('.case-header__meta')?.textContent.includes('BBL-2026-0931')`, { timeout: 7000 });
  check(ready, 'authenticated seed-2 renders its four-step pipeline');

  for (const expected of VIEWPORTS) {
    await setViewport(cdp, page, expected.width);
    const result = JSON.parse(await page.evaluate(`(async () => {
      const steps = [...document.querySelectorAll('.pipeline__step')];
      const wrapper = document.querySelector('.pipeline-wrap');
      const list = wrapper?.querySelector('.pipeline');
      const maskSource = (element) => {
        const mask = getComputedStyle(element).maskImage
          || getComputedStyle(element).webkitMaskImage || element.style.maskImage
          || element.style.webkitMaskImage || '';
        const match = /^url\\(["']?(.*?)["']?\\)$/.exec(mask);
        return match ? match[1] : '';
      };
      const rows = new Set(steps.map((step) => Math.round(step.getBoundingClientRect().top)));
      const records = steps.map((step) => {
        const text = [...step.children].find((child) => !child.classList.contains('pipeline__glyph'));
        const visible = text?.cloneNode(true);
        visible?.querySelectorAll('.sr-only').forEach((node) => node.remove());
        const glyph = step.querySelector('.pipeline__glyph');
        const rect = glyph?.getBoundingClientRect();
        const state = [...step.classList].find((name) => name.startsWith('pipeline__step--'))
          ?.replace('pipeline__step--', '') || '';
        return {
          label: visible?.textContent.trim() || '',
          state,
          prefix: text?.querySelector('.sr-only')?.textContent.trim() || '',
          current: step.getAttribute('aria-current') || '',
          glyph: glyph ? {
            hidden: glyph.getAttribute('aria-hidden'),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            source: maskSource(glyph),
          } : null,
        };
      });
      const sources = [...new Set(records.map((record) => record.glyph?.source).filter(Boolean))];
      const assets = await Promise.all(sources.map(async (source) => {
        let url;
        try { url = new URL(source, location.href); } catch { return { source, valid: false }; }
        try {
          const response = await fetch(url.href, { cache: 'no-store' });
          return {
            source, valid: true, origin: url.origin, appOrigin: location.origin,
            pathname: url.pathname, status: response.status,
          };
        } catch (error) {
          return { source, valid: true, origin: url.origin, appOrigin: location.origin,
            pathname: url.pathname, status: 0, error: String(error) };
        }
      }));
      return JSON.stringify({
        width: innerWidth,
        labels: records.map((record) => record.label),
        states: records.map((record) => record.state),
        prefixes: records.map((record) => record.prefix),
        currents: records.map((record) => record.current),
        glyphs: records.map((record) => record.glyph),
        rows: rows.size,
        groupLabel: wrapper?.getAttribute('aria-label') || '',
        listTag: list?.tagName || '',
        wrapperOverflow: wrapper ? wrapper.scrollWidth > wrapper.clientWidth : true,
        documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        assets,
      });
    })()`));

    const context = `${expected.width}px`;
    check(JSON.stringify(result.labels) === JSON.stringify(EXPECTED_LABELS),
      `${context}: labels retain process order`, result.labels.join(' | '));
    check(JSON.stringify(result.states) === JSON.stringify(EXPECTED_STATES),
      `${context}: states are done/done/active/todo`, result.states.join('/'));
    check(JSON.stringify(result.prefixes) === JSON.stringify(['Erledigt:', 'Erledigt:', 'Aktueller Schritt:', '']),
      `${context}: screen-reader state prefixes remain exact`, result.prefixes.join(' | '));
    check(result.currents.filter((value) => value === 'step').length === 1
      && result.currents[2] === 'step', `${context}: only the active segment is current`);
    check(result.groupLabel === 'Statusverlauf' && result.listTag === 'OL',
      `${context}: labelled ordered-list semantics remain intact`);

    const glyphs = result.glyphs.filter(Boolean);
    const paths = glyphs.map((glyph) => {
      try { return new URL(glyph.source, 'http://example.invalid/').pathname; } catch { return ''; }
    });
    check(glyphs.length === 3 && !result.glyphs[3],
      `${context}: two completed and one active glyph render; todo remains unadorned`);
    check(paths.filter((path) => path.endsWith('/assets/icons/lucide/circle-check-big.svg')).length === 2
      && paths.filter((path) => path.endsWith('/assets/icons/lucide/clock-3.svg')).length === 1,
    `${context}: glyphs use the approved Lucide assets`, paths.join(' | '));
    check(glyphs.every((glyph) => glyph.hidden === 'true'),
      `${context}: decorative glyphs stay out of the accessibility tree`);
    check(glyphs.every((glyph) => glyph.width === expected.iconSize && glyph.height === expected.iconSize),
      `${context}: glyphs are ${expected.iconSize}×${expected.iconSize}px`,
      glyphs.map((glyph) => `${glyph.width}×${glyph.height}`).join(', '));
    check(result.assets.length === 2 && result.assets.every((asset) => asset.valid
      && asset.origin === asset.appOrigin
      && /\/assets\/icons\/lucide\/(?:circle-check-big|clock-3)\.svg$/.test(asset.pathname)
      && asset.status === 200),
    `${context}: each same-origin glyph request returns HTTP 200`, JSON.stringify(result.assets));
    check(result.rows === expected.rows, `${context}: pipeline uses ${expected.rows} visual row(s)`, String(result.rows));
    check(!result.wrapperOverflow && !result.documentOverflow,
      `${context}: enlarged glyphs do not create horizontal overflow`, JSON.stringify({
        wrapper: result.wrapperOverflow, document: result.documentOverflow,
      }));
  }

  const problems = await page.problems();
  check(problems.length === 0, 'pipeline route has no runtime or console errors', problems.join(' | '));
} finally {
  await page?.closeTarget();
  cdp.close();
}

console.log(failures ? `\n✗ ${failures} check(s) failed` : '\n✓ pipeline contract passed');
process.exit(failures ? 1 : 0);
