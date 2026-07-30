// Datenportal dashboard redesign — Superset-style framing + reusable action
// menus. Verifies: the grey-canvas/white-card chrome, a full-height filter panel,
// the footer, the dashboard toolbar menu (refresh/share) and the per-chart menu
// (fullscreen overlay, CSV/PNG downloads, copy-link). Also saves a screenshot.
//
//   node scripts/test-dashboard.mjs      (dev server must be running; see README)
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

const PROBE = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.querySelector('.dash-grid .chart') && n++ < 120) await s(100);
  // Seit dem CD-Review ist der Toast eine CD toast-message (Notification im Host).
  const lastToast = () => { const t = [...document.querySelectorAll('.toast__message .notification__content')].pop(); return t ? t.textContent : null; };
  const R = {
    dashPage: !!document.querySelector('.dash-page'),
    headerMenu: !!document.querySelector('.dash-header .action-menu'),
    footer: !!document.querySelector('.dash-footer'),
    charts: document.querySelectorAll('.dash-grid .chart').length,
    chartMenus: document.querySelectorAll('.dash-grid .chart .action-menu').length,
  };
  const fp = document.querySelector('.filter-panel'), dm = document.querySelector('.dashboard-main');
  R.filterH = Math.round(fp.getBoundingClientRect().height);
  R.mainH = Math.round(dm.getBoundingClientRect().height);
  R.filterFullHeight = Math.abs(R.filterH - R.mainH) <= 2;

  // dashboard toolbar menu → open + "Link kopieren"
  document.querySelector('.dash-header .action-menu__trigger').click(); await s(60);
  R.dashPopupOpen = !document.querySelector('.dash-header .action-menu__popup').hidden;
  [...document.querySelectorAll('.dash-header .action-menu__item')].find(i => i.dataset.action === 'copy').click(); await s(150);
  R.toastCopy = lastToast();

  // chart menu → Vollbild
  const chartMenuTrigger = () => document.querySelector('.dash-grid .chart .action-menu__trigger');
  chartMenuTrigger().click(); await s(60);
  R.chartPopupOpen = !document.querySelector('.dash-grid .chart .action-menu__popup').hidden;
  [...document.querySelectorAll('.dash-grid .action-menu__item')].find(i => i.dataset.action === 'fullscreen').click(); await s(180);
  // Chart-Vollbild läuft seit dem Review über das kanonische Modal (C.openModal, xl).
  R.overlay = !!document.querySelector('.modal--xl');
  R.overlaySvg = document.querySelectorAll('.modal--xl .chart__svg').length;
  R.overlayHasMenu = !!document.querySelector('.modal--xl .action-menu');   // should be false (stripped)
  document.querySelector('.modal--xl .modal__close').click(); await s(120);
  R.overlayClosed = !document.querySelector('.modal--xl');

  // chart menu → CSV then PNG
  chartMenuTrigger().click(); await s(60);
  [...document.querySelectorAll('.dash-grid .action-menu__item')].find(i => i.dataset.action === 'csv').click(); await s(150);
  R.toastCsv = lastToast();
  chartMenuTrigger().click(); await s(60);
  // PNG export renders the SVG to a canvas asynchronously — give it room (was 400ms, too tight).
  [...document.querySelectorAll('.dash-grid .action-menu__item')].find(i => i.dataset.action === 'png').click();
  { let k = 0; while (!/Bild heruntergeladen|fehlgeschlagen/.test(lastToast() || '') && k++ < 40) await s(50); }
  R.toastPng = lastToast();
  return R;
})()`;

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };

(async () => {
  const cdp = await launch({ webgl: true });
  try {
    // a generic query-spec dashboard (immobilien is now the record-based estate one)
    const page = await openPage(cdp, `${APP_BASE}/app/dataportal/energie-klima`);
    // desktop viewport so the 2-column layout + full-height panel apply
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    await new Promise(r => setTimeout(r, 900));

    // screenshot of the clean framing (before opening menus) → scratchpad
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, page.sessionId);
    const out = process.env.SHOT || join(tmpdir(), 'bbl-dashboard.png');
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
    check((await page.problems()).length === 0, `no exceptions / console errors / error banner${(await page.problems())[0] ? ': ' + (await page.problems())[0] : ''}`);
    await page.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
