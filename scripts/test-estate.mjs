// Immobilienportfolio — record-based Stammdaten dashboard (js/apps/estate.js).
// Verifies the three tabs (Gebäude/Grundstücke/Bodenbedeckung), KPIs, runtime-
// aggregated charts, the worldwide CARTO map with markers, and live filtering
// (Land=CH shrinks the building count). Saves a screenshot to $SHOT.
//
//   node scripts/test-estate.mjs      (dev server must be running; see README)
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

const PROBE = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  // MapLibre reports tile/glyph failures via its 'error' event → console.error,
  // not as an uncaught exception, so page.exceptions never sees them. Capture them
  // here (a broken glyph host once killed clustering with «Unimplemented type: 4»).
  window.__mapErrs = []; const __oe = console.error;
  console.error = (...a) => { try { window.__mapErrs.push(a.map(x => typeof x === 'string' ? x : ((x && x.message) || '')).join(' ')); } catch (e) {} __oe.apply(console, a); };
  let n = 0; while (!document.querySelector('.dash-grid .chart') && n++ < 150) await s(100);
  const tabLabels = [...document.querySelectorAll('.tab__control')].map(t => t.textContent.trim());
  const kpiVals = () => [...document.querySelectorAll('.kpi__value')].map(v => v.textContent.replace(/\\s+/g, ' ').trim());
  const R = {
    tabs: tabLabels,
    filters: [...document.querySelectorAll('.filter-group__legend')].map(x => x.textContent.trim()),
    kpiLabels: [...document.querySelectorAll('.kpi__label')].map(x => x.textContent.trim()),
    kpisAll: kpiVals(),
    chartsGeb: document.querySelectorAll('.dash-grid .chart').length,
    hasMapEl: !!document.getElementById('estate-map-el'),
    hasLeadHint: !!document.querySelector('.lead-hint a[href*="app/portfolio"]'),
  };
  // wait for the CARTO map canvas (MapLibre loads from CDN; markers are clustered GeoJSON layers)
  let m = 0; while (!document.querySelector('.dash-map canvas') && m++ < 100) await s(100);
  R.mapCanvas = !!document.querySelector('.dash-map canvas');
  await s(2500);   // let the basemap tiles + glyph PBFs load so any parse error fires
  R.mapErrs = (window.__mapErrs || []).filter(e => /Unimplemented|glyph|type: 4/i.test(e));

  // multi-select filter Land = CH → building count should drop (worldwide → Swiss)
  const cb = document.querySelector('input[type=checkbox][data-dim="land"][value="CH"]');
  cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
  await s(250);
  R.kpisCH = kpiVals();
  R.hashAfterFilter = location.hash;

  // switch to Grundstücke tab
  document.querySelector('.tab__control[data-tab="grundstuecke"]').click();
  await s(250);
  R.tab2Active = (document.querySelector('.tab__control--active') || {}).dataset?.tab;
  R.tab2Charts = [...document.querySelectorAll('.dash-grid .chart .chart__title')].map(t => t.textContent.trim());
  R.tab2Kpi0 = (document.querySelector('.kpi__label') || {}).textContent;
  return R;
})()`;

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };

(async () => {
  const cdp = await launch({ port: 9348, webgl: true });
  try {
    const page = await openPage(cdp, `${APP_BASE}/app/dataportal/immobilien`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1500, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    await new Promise(r => setTimeout(r, 900));
    const r = await page.evaluate(PROBE);
    console.log('■ Immobilienportfolio dashboard');
    console.log('   tabs:', JSON.stringify(r.tabs), '| filter groups:', JSON.stringify(r.filters));
    console.log('   KPIs (all):', JSON.stringify(r.kpisAll), '| map canvas:', r.mapCanvas);
    console.log('   KPIs (Land=CH):', JSON.stringify(r.kpisCH));

    check(JSON.stringify(r.tabs) === JSON.stringify(['Gebäude', 'Grundstücke', 'Bodenbedeckung']), 'three tabs Gebäude/Grundstücke/Bodenbedeckung');
    check(r.filters.length === 5 && r.filters[0] === 'Land', `five filter groups (${JSON.stringify(r.filters)})`);
    check(r.kpisAll.length === 4 && !r.kpiLabels.includes('Länder'), `4 KPI tiles, no Länder count (${JSON.stringify(r.kpiLabels)})`);
    check(r.hasLeadHint, 'lead hint links to Liegenschaften Inventar');
    check(r.chartsGeb >= 5, `Gebäude tab has map + charts (${r.chartsGeb} figures)`);
    check(r.hasMapEl, 'map container present on Gebäude tab');
    check(r.mapCanvas, 'CARTO map canvas renders (clustered layers)');
    check((r.mapErrs || []).length === 0, `map renders without glyph/tile parse errors${r.mapErrs && r.mapErrs.length ? ' — ' + r.mapErrs[0] : ''}`);
    check(Number(r.kpisCH[0].replace(/\\D/g, '')) < Number(r.kpisAll[0].replace(/\\D/g, '')), `Land=CH reduces building count (${r.kpisAll[0]} → ${r.kpisCH[0]})`);
    check(/land=CH/.test(r.hashAfterFilter), `filter mirrored to hash (${r.hashAfterFilter})`);
    check(r.tab2Active === 'grundstuecke', 'switch to Grundstücke tab');
    check(r.tab2Charts.some(t => /Grundstücksfläche/.test(t)), `Grundstücke charts (${JSON.stringify(r.tab2Charts)})`);
    check((await page.problems()).length === 0, `no exceptions / console errors / error banner${(await page.problems())[0] ? ': ' + (await page.problems())[0] : ''}`);

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, page.sessionId);
    writeFileSync(process.env.SHOT || join(tmpdir(), 'bbl-estate.png'), Buffer.from(shot.data, 'base64'));
    await page.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
