// Datenportal dashboard redesign — Superset-style framing + reusable action
// menus. Verifies: the grey-canvas/white-card chrome, a full-height filter panel,
// the footer, the dashboard toolbar menu (refresh/share) and the per-chart menu
// (fullscreen overlay, CSV/PNG downloads, copy-link). Also saves a screenshot.
//
//   node scripts/test-dashboard.mjs      (dev server must be running; see README)
import { writeFileSync } from 'node:fs';
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

const PROBE = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.querySelector('.dash-grid .chart') && n++ < 120) await s(100);
  const lastToast = () => { const t = [...document.querySelectorAll('.toast')].pop(); return t ? t.textContent : null; };
  const R = {
    dashPage: !!document.querySelector('.dash-page'),
    headerMenu: !!document.querySelector('.dash-header .menu'),
    footer: !!document.querySelector('.dash-footer'),
    charts: document.querySelectorAll('.dash-grid .chart').length,
    chartMenus: document.querySelectorAll('.dash-grid .chart .menu').length,
  };
  const fp = document.querySelector('.filter-panel'), dm = document.querySelector('.dashboard-main');
  R.filterH = Math.round(fp.getBoundingClientRect().height);
  R.mainH = Math.round(dm.getBoundingClientRect().height);
  R.filterFullHeight = Math.abs(R.filterH - R.mainH) <= 2;

  // dashboard toolbar menu → open + "Link kopieren"
  document.querySelector('.dash-header .menu__trigger').click(); await s(60);
  R.dashPopupOpen = !document.querySelector('.dash-header .menu__popup').hidden;
  [...document.querySelectorAll('.dash-header .menu__item')].find(i => i.dataset.action === 'copy').click(); await s(150);
  R.toastCopy = lastToast();

  // chart menu → Vollbild
  const chartMenuTrigger = () => document.querySelector('.dash-grid .chart .menu__trigger');
  chartMenuTrigger().click(); await s(60);
  R.chartPopupOpen = !document.querySelector('.dash-grid .chart .menu__popup').hidden;
  [...document.querySelectorAll('.dash-grid .menu__item')].find(i => i.dataset.action === 'fullscreen').click(); await s(180);
  R.overlay = !!document.querySelector('.chart-overlay');
  R.overlaySvg = document.querySelectorAll('.chart-overlay .chart__svg').length;
  R.overlayHasMenu = !!document.querySelector('.chart-overlay .menu');   // should be false (stripped)
  document.querySelector('.chart-overlay__close').click(); await s(120);
  R.overlayClosed = !document.querySelector('.chart-overlay');

  // chart menu → CSV then PNG
  chartMenuTrigger().click(); await s(60);
  [...document.querySelectorAll('.dash-grid .menu__item')].find(i => i.dataset.action === 'csv').click(); await s(150);
  R.toastCsv = lastToast();
  chartMenuTrigger().click(); await s(60);
  [...document.querySelectorAll('.dash-grid .menu__item')].find(i => i.dataset.action === 'png').click(); await s(400);
  R.toastPng = lastToast();
  return R;
})()`;

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };

(async () => {
  const cdp = await launch({ port: 9342, webgl: true });
  try {
    const page = await openPage(cdp, `${APP_BASE}/app/dataportal/immobilien`);
    // desktop viewport so the 2-column layout + full-height panel apply
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    await new Promise(r => setTimeout(r, 900));

    // screenshot of the clean framing (before opening menus) → scratchpad
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, page.sessionId);
    const out = process.env.SHOT || 'dashboard.png';
    writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log('■ Datenportal dashboard');
    console.log(`   screenshot → ${out}`);

    const r = await page.evaluate(PROBE);
    check(r.dashPage, 'grey-canvas dash-page present');
    check(r.headerMenu, 'dashboard toolbar menu present');
    check(r.footer, 'meta-info footer present');
    check(r.charts >= 2 && r.chartMenus >= 2, `charts (${r.charts}) each have a menu (${r.chartMenus})`);
    check(r.filterFullHeight, `filter panel full height (${r.filterH}px vs main ${r.mainH}px)`);
    check(r.dashPopupOpen, 'dashboard menu opens');
    check(/kopiert|nicht möglich/i.test(r.toastCopy || ''), `toolbar "Link kopieren" → toast ("${r.toastCopy}")`);
    check(r.chartPopupOpen, 'chart menu opens');
    check(r.overlay && r.overlaySvg > 0, 'Vollbild overlay shows the chart');
    check(!r.overlayHasMenu, 'overlay has no nested menu');
    check(r.overlayClosed, 'overlay closes');
    check(r.toastCsv === 'CSV heruntergeladen.', `CSV → toast ("${r.toastCsv}")`);
    check(/Bild heruntergeladen|fehlgeschlagen/.test(r.toastPng || ''), `PNG → toast ("${r.toastPng}")`);
    check(page.exceptions.length === 0, `no exceptions${page.exceptions.length ? ' — ' + page.exceptions[0].split('\\n')[0] : ''}`);
    await page.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
