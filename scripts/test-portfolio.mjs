// Liegenschaften Inventar — golden-record unification (js/apps/portfolio.js).
// Verifies the app now reads the worldwide SAP-RE-FX buildings (data/buildings.geojson,
// via core), that ?id=<bbl_id> deep-links resolve to a detail with the re-keyed
// project/document/media joins, and that the Karte view renders the CARTO map.
//
//   node scripts/test-portfolio.mjs      (dev server must be running; see README)
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

const LIST = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.querySelector('.stats') && n++ < 150) await s(100);
  const rows = [...document.querySelectorAll('table tbody tr')];
  const links = [...document.querySelectorAll('table tbody a[href*="app/portfolio"]')].map(a => a.getAttribute('href'));
  return {
    header: (document.querySelector('h1') || {}).textContent,
    liegenschaften: (document.querySelector('.stat__num') || {}).textContent,
    filterHeads: [...document.querySelectorAll('.stack .small.muted')].map(x => x.textContent.trim()),
    hasLandCol: [...document.querySelectorAll('table thead th')].some(th => th.textContent.trim() === 'Land'),
    rowCount: rows.length,
    firstLink: links[0] || '',
    allQueryLinks: links.length > 0 && links.every(h => h.includes('?id=')),
  };
})()`;

const DETAIL = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.querySelector('.kv') && n++ < 150) await s(100);
  const kv = {}; document.querySelectorAll('.kv dt').forEach((dt, i) => { kv[dt.textContent.trim()] = document.querySelectorAll('.kv dd')[i].textContent.trim(); });
  return {
    h1: (document.querySelector('h1') || {}).textContent,
    bblId: kv['BBL-ID'], eigentum: kv['Eigentumsverhältnis'], land: kv['Land / Region'],
    tabs: [...document.querySelectorAll('.tab__control')].map(t => t.textContent.trim()),
    statusBadge: (document.querySelector('.badge') || {}).textContent,
  };
})()`;

const MISSING = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.querySelector('.empty, .kv') && n++ < 100) await s(100);
  return (document.querySelector('.empty') || {}).textContent || '';
})()`;

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };

(async () => {
  const cdp = await launch({ port: 9352, webgl: true });
  try {
    // 1) list ---------------------------------------------------------------
    const p = await openPage(cdp, `${APP_BASE}/app/portfolio`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false }, p.sessionId);
    await new Promise(r => setTimeout(r, 700));
    const L = await p.evaluate(LIST);
    console.log('■ Liste');
    console.log('   header:', JSON.stringify(L.header), '| Liegenschaften:', L.liegenschaften, '| rows:', L.rowCount);
    console.log('   first link:', L.firstLink);
    check(/Liegenschaften Inventar/.test(L.header || ''), 'page header');
    check(L.liegenschaften === '11', `11 buildings from golden record (${L.liegenschaften})`);
    check(L.rowCount === 11, `list shows 11 rows (${L.rowCount})`);
    check(L.hasLandCol, 'list has a Land column (worldwide)');
    check(L.allQueryLinks && /\?id=/.test(L.firstLink), `all detail links use ?id= (${L.firstLink})`);
    await p.closeTarget();

    // 2) detail deep-link (Bundeshaus West = the one true crosswalk match) ---
    const d = await openPage(cdp, `${APP_BASE}/app/portfolio?id=${encodeURIComponent('1000/4840/AF')}`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false }, d.sessionId);
    await new Promise(r => setTimeout(r, 700));
    const D = await d.evaluate(DETAIL);
    console.log('■ Detail (?id=1000/4840/AF)');
    console.log('   h1:', JSON.stringify(D.h1), '| BBL-ID:', D.bblId, '| Eigentum:', D.eigentum, '| Land:', D.land);
    console.log('   tabs:', JSON.stringify(D.tabs));
    check(/Bundeshaus West/.test(D.h1 || ''), `deep-link resolves the object (${D.h1})`);
    check(D.bblId === '1000/4840/AF', `BBL-ID shown (${D.bblId})`);
    check(D.eigentum === 'Im Eigentum', `ownership mapped (${D.eigentum})`);
    check(/Bauprojekte \(\d+\)/.test(D.tabs.join(' ')) && !/Bauprojekte \(0\)/.test(D.tabs.join(' ')), `re-keyed joins populate tabs (${JSON.stringify(D.tabs)})`);
    await d.closeTarget();

    // 3) Karte view (real CARTO map) ---------------------------------------
    const m = await openPage(cdp, `${APP_BASE}/app/portfolio`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false }, m.sessionId);
    await m.evaluate(`(async()=>{const s=x=>new Promise(r=>setTimeout(r,x));let n=0;while(!document.querySelector('[data-view="karte"]')&&n++<100)await s(100);document.querySelector('[data-view="karte"]').click();let k=0;while(!document.querySelector('#pf-map-el canvas')&&k++<100)await s(100);return true;})()`);
    const hasMap = await m.evaluate(`!!document.querySelector('#pf-map-el canvas')`);
    console.log('■ Karte | map canvas:', hasMap);
    check(hasMap, 'Karte view renders the CARTO map');
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, m.sessionId);
    writeFileSync(process.env.SHOT || join(tmpdir(), 'bbl-portfolio.png'), Buffer.from(shot.data, 'base64'));
    await m.closeTarget();

    // 4) unknown id --------------------------------------------------------
    const x = await openPage(cdp, `${APP_BASE}/app/portfolio?id=${encodeURIComponent('9999/0000/ZZ')}`);
    await new Promise(r => setTimeout(r, 500));
    const X = await x.evaluate(MISSING);
    check(/nicht gefunden/.test(X), `unknown id → not found (${X.slice(0, 30)})`);
    check(p.exceptions.length + d.exceptions.length + m.exceptions.length + x.exceptions.length === 0,
      `no exceptions${(p.exceptions[0] || d.exceptions[0] || m.exceptions[0] || x.exceptions[0]) ? ' — ' + (p.exceptions[0] || d.exceptions[0] || m.exceptions[0] || x.exceptions[0]).split('\\n')[0] : ''}`);
    await x.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
