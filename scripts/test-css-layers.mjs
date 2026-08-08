// CSS architecture regression: ordered static/lazy sheets, no route FOUC,
// same-origin CSS availability, both brand skins, reduced motion and 320px reflow.
import { APP_BASE, launch, openPage, sleep } from './lib/cdp.mjs';

const STATIC_SHEETS = [
  'css/tokens.css', 'css/skins/intranet.css',
  'css/foundations/reset.css', 'css/foundations/typography.css', 'css/foundations/elements.css',
  'css/layouts/page.css', 'css/layouts/grid.css',
  'css/navigations/header.css', 'css/navigations/drawer.css', 'css/layouts/shell.css',
  'css/components/button.css', 'css/components/card.css', 'css/components/table.css',
  'css/components/form.css', 'css/components/listbox.css', 'css/components/feedback.css',
  'css/navigations/tabs.css', 'css/components/content.css',
  'css/sections/search.css', 'css/sections/filter-panel.css',
  'css/sections/catbar.css', 'css/sections/explorer.css',
  'css/components/overlay.css', 'css/utilities.css',
];

const checks = [];
let failures = 0;
const check = (ok, label, detail = '') => {
  checks.push({ ok: !!ok, label, detail });
  if (!ok) failures++;
};

const browser = await launch({ webgl: true });
let page;
try {
  page = await openPage(browser, `${APP_BASE}/`, { login: true, skin: 'intranet' });

  const staticState = JSON.parse(await page.evaluate(`(async () => {
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
    const responses = await Promise.all(links.map(async link => {
      try { const response = await fetch(link.href); return [link.getAttribute('href'), response.status]; }
      catch { return [link.getAttribute('href'), 0]; }
    }));
    return JSON.stringify({
      count: links.length,
      hrefs: links.map(link => new URL(link.href).pathname.replace(/^\\//, '')),
      appLinks: links.filter(link => link.dataset.appStyle).length,
      unloaded: links.filter(link => !link.sheet).map(link => link.getAttribute('href')),
      failed: responses.filter(([, status]) => status >= 400 || status === 0),
    });
  })()`));
  check(staticState.count === STATIC_SHEETS.length,
    `${STATIC_SHEETS.length} static stylesheets load`, String(staticState.count));
  check(staticState.hrefs.join(',') === STATIC_SHEETS.join(','),
    'static stylesheets retain the documented cascade order', staticState.hrefs.join(','));
  check(staticState.appLinks === 0, 'ordinary pages do not fetch app CSS', String(staticState.appLinks));
  check(!staticState.unloaded.length, 'every static stylesheet is parsed', staticState.unloaded.join(', '));
  check(!staticState.failed.length, 'no static CSS request returns an error', JSON.stringify(staticState.failed));

  // Observe a fresh lazy route. App markup must not appear until every required
  // link has fired load and received data-loaded="true" from css-loader.js.
  await page.evaluate(`(() => {
    window.__cssFouc = [];
    const required = ['dataportal','floorplan','workplace','room-booking'];
    const inspect = () => {
      if (!document.querySelector('.booking-tabs')) return;
      const missing = required.filter(key =>
        !document.querySelector('link[data-app-style="' + key + '"][data-loaded="true"]'));
      if (missing.length) window.__cssFouc.push(missing.join(','));
    };
    new MutationObserver(inspect).observe(document.getElementById('main-content'), { childList:true, subtree:true });
    location.hash = '#/app/room-booking';
  })()`);
  for (let i = 0; i < 80; i++) {
    if (await page.evaluate(`!!document.querySelector('.booking-tabs')`)) break;
    await sleep(100);
  }
  const booking = JSON.parse(await page.evaluate(`JSON.stringify({
    rendered: !!document.querySelector('.booking-tabs'),
    fouc: window.__cssFouc || [],
    loaded: [...document.querySelectorAll('link[data-app-style]')].map(link => link.dataset.appStyle),
  })`));
  check(booking.rendered, 'lazy route renders');
  check(!booking.fouc.length, 'app markup waits for required CSS (no FOUC)', booking.fouc.join(' | '));
  check(booking.loaded.join(',') === 'dataportal,floorplan,workplace,room-booking',
    'room-booking loads only its declared sheets in source order', booking.loaded.join(','));

  // Visit routes in deliberately non-canonical order. DOM order must still be
  // the old monolith order, independent of navigation history.
  for (const route of [
    '/app/floorplan-editor?building=1080%2F6650%2FAA&floor=1080-6650-AA-2og',
    '/app/document-archive',
    '/app/portfolio',
  ]) {
    await page.evaluate(`location.hash = '#${route}'; true`);
    for (let i = 0; i < 100; i++) {
      const busy = await page.evaluate(`!!document.querySelector('#main-content [aria-busy="true"]')`);
      if (!busy) break;
      await sleep(100);
    }
  }
  const lazyState = JSON.parse(await page.evaluate(`(async () => {
    const links = [...document.querySelectorAll('link[data-app-style]')];
    const responses = await Promise.all(links.map(async link => {
      try { const response = await fetch(link.href); return [link.dataset.appStyle, response.status]; }
      catch { return [link.dataset.appStyle, 0]; }
    }));
    return JSON.stringify({
      keys: links.map(link => link.dataset.appStyle),
      indices: links.map(link => Number(link.dataset.appStyleIndex)),
      loaded: links.every(link => link.dataset.loaded === 'true' && !!link.sheet),
      failed: responses.filter(([, status]) => status >= 400 || status === 0),
    });
  })()`));
  check(lazyState.indices.every((value, i, all) => i === 0 || all[i - 1] < value),
    'lazy sheets retain canonical cascade order', lazyState.keys.join(','));
  check(lazyState.loaded, 'every injected stylesheet is parsed before use');
  check(!lazyState.failed.length, 'no lazy CSS request returns an error', JSON.stringify(lazyState.failed));

  const skins = JSON.parse(await page.evaluate(`(() => {
    const values = () => {
      const style = getComputedStyle(document.body);
      return [style.getPropertyValue('--color-primary-600').trim(),
        style.getPropertyValue('--color-secondary-600').trim(),
        getComputedStyle(document.documentElement).getPropertyValue('--color-focus-ring').trim()];
    };
    document.body.classList.remove('body--intranet'); const federal = values();
    document.body.classList.add('body--intranet'); const intranet = values();
    return JSON.stringify({ federal, intranet });
  })()`));
  check(skins.federal.join(',') === '#d8232a,#2f4356,#8655F6',
    'federal skin keeps the authoritative red/secondary ramps and purple focus', skins.federal.join(','));
  check(skins.intranet.join(',') === '#2563eb,#1e40af,#8655F6',
    'intranet skin retints both ramps but not focus purple', skins.intranet.join(','));

  await browser.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  }, page.sessionId);
  const reduced = await page.evaluate(`getComputedStyle(document.documentElement).getPropertyValue('--duration').trim()`);
  check(reduced === '.01ms' || reduced === '0.01ms', 'reduced-motion collapses shared duration tokens', reduced);

  await browser.send('Emulation.setDeviceMetricsOverride',
    { width: 320, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await page.evaluate(`location.hash = '#/app/room-booking'; true`);
  await sleep(900);
  const overflow = await page.evaluate(`Math.max(document.body.scrollWidth, document.documentElement.scrollWidth)
    - document.documentElement.clientWidth`);
  check(overflow <= 1, 'room-booking reflows at 320px', `${overflow}px`);

  const problems = await page.problems();
  check(!problems.length, 'no exceptions, console errors or application error banner', problems.join(' | '));
} finally {
  try { await page?.closeTarget(); } catch { /* browser already closed */ }
  browser.close();
}

for (const item of checks) console.log(`  ${item.ok ? '✓' : '✗'} ${item.label}${item.detail ? ` (${item.detail})` : ''}`);
if (failures) {
  console.error(`\n✗ ${failures} CSS architecture check(s) failed`);
  process.exit(1);
}
console.log('\n✓ CSS layers, lazy loading, skins, reduced motion and 320px reflow passed');
