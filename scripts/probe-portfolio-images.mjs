// Verifies the portfolio image + default-filter fixes (fresh browser, no cache):
//  - building detail hero (pf-mosaic) loads a REAL local file, not a placeholder
//  - the portfolio list defaults to buildings only
//  - a placeholder-only building falls back to «Kein Bild» (no broken img)
//   node scripts/probe-portfolio-images.mjs      (dev server must be running)
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let failures = 0;
const check = (ok, label) => { console.log(`   ${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };

(async () => {
  const cdp = await launch();
  try {
    const p = await openPage(cdp, `${APP_BASE}/`);
    await sleep(1400);
    await p.evaluate('window.__login && window.__login()');
    await sleep(600);
    const go = async (hash, ms = 2200) => { await p.evaluate(`location.hash='${hash}'`); await sleep(ms); };

    console.log('■ Building detail hero (pf-mosaic) shows the real image');
    await go('#/app/portfolio?id=' + encodeURIComponent('1000/5510/AA'), 2600); // Brasília (was placeholder)
    let r = JSON.parse(await p.evaluate(`(function(){
      var cell=document.querySelector('#pf-mosaic .pf-mosaic__cell:not(.pf-mosaic__cell--empty)');
      var img=document.querySelector('#pf-mosaic img');
      return JSON.stringify({
        hasMosaic:!!document.querySelector('#pf-mosaic'),
        src:img?(img.getAttribute('src')||''):'',
        loaded:img?(img.complete&&img.naturalWidth>0):false,
        tiles:document.querySelectorAll('#pf-mosaic .pf-mosaic__cell').length
      });})()`));
    check(r.hasMosaic, 'pf-mosaic present');
    check(/assets\/images\/buildings/.test(r.src), `hero src is a real local file (${r.src.split('/').pop()||'—'})`);
    check(r.loaded, 'hero image actually loaded (naturalWidth>0)');

    console.log('■ Portfolio list defaults to BUILDINGS only');
    await go('#/app/portfolio?view=liste', 2200);
    r = JSON.parse(await p.evaluate(`(function(){
      var rows=[].slice.call(document.querySelectorAll('#pf-main table tbody tr'));
      var txt=(document.querySelector('#pf-activefilters')||{}).innerText||'';
      // count parcel rows by the Crop/Grundstück marker in the Typ cell
      var parcel=rows.filter(function(tr){return /Grundst/.test(tr.getAttribute('title')||'')||/Grundst/.test(tr.innerHTML);}).length;
      return JSON.stringify({rows:rows.length, activeFilters:txt.trim(), count:(document.querySelector('.catbar__count')||{}).innerText||''});})()`));
    check(r.rows > 0, `list renders rows (${r.rows})`);
    check(/Gebäude/.test(r.activeFilters), `active filter shows «Gebäude» (${r.activeFilters||'—'})`);

    console.log('■ Placeholder-only building falls back cleanly (no broken image)');
    await go('#/app/portfolio?id=' + encodeURIComponent('1000/1950/AE'), 2400); // Frauenfeld (no image)
    r = JSON.parse(await p.evaluate(`(function(){
      var imgs=[].slice.call(document.querySelectorAll('#pf-mosaic img'));
      var broken=imgs.filter(function(i){return i.complete&&i.naturalWidth===0&&(i.getAttribute('src')||'');}).length;
      return JSON.stringify({noImg:!!document.querySelector('#pf-mosaic .image__not-available'), broken:broken});})()`));
    check(r.broken === 0, `no broken <img> (${r.broken})`);

    check((await p.problems()).length === 0, 'no exceptions / console errors / error banner');
  } finally {
    console.log(failures ? `\n✗ ${failures} check(s) FAILED` : '\n✓ all checks passed');
    process.exit(failures ? 1 : 0);
  }
})();
