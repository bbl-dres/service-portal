// Mock Swagger / API-Dokumentation (js/apps/api-docs.js + data/api-specs.json).
// Verifies the docs page renders the resource rail + endpoints with method badges,
// that data-backed «Ausprobieren» returns REAL portal data, that ?tag deep-links
// focus a resource, and that the Kundenportal catalog entry links into the docs.
//
//   node scripts/test-apidocs.mjs        (dev server must be running; see README)
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };

(async () => {
  const cdp = await launch({ webgl: false });
  try {
    // 1) docs page + data-backed «Ausprobieren» -----------------------------
    const p = await openPage(cdp, `${APP_BASE}/app/api-docs/kundenportal`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1500, deviceScaleFactor: 1, mobile: false }, p.sessionId);
    await new Promise(r => setTimeout(r, 700));
    const D = await p.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      let n = 0; while (!document.querySelector('.api-ep') && n++ < 150) await s(100);
      const eps = [...document.querySelectorAll('.api-ep')];
      const liege = eps.find(e => (e.querySelector('.api-ep__path') || {}).textContent === '/liegenschaften');
      let tryOut = '';
      if (liege) { liege.querySelector('.api-ep__head').click(); await s(150); liege.querySelector('[data-try]').click(); await s(300); tryOut = (liege.querySelector('.api-try__pre') || {}).textContent || ''; }
      return {
        h1: (document.querySelector('h1') || {}).textContent,
        badges: [...document.querySelectorAll('.api-head__badges .badge')].map(b => b.textContent.trim()),
        base: (document.querySelector('#api-base') || {}).textContent,
        rail: [...document.querySelectorAll('.api-rail__item')].length,
        methods: [...new Set([...document.querySelectorAll('.api-method')].map(m => m.textContent.trim()))],
        epCount: document.querySelectorAll('.api-ep').length,
        tryOut,
      };
    })()`);
    console.log('■ API-Dokumentation');
    console.log('   h1:', JSON.stringify(D.h1), '| badges:', JSON.stringify(D.badges), '| endpoints:', D.epCount, '| rail:', D.rail);
    console.log('   Ausprobieren /liegenschaften →', D.tryOut.replace(/\s+/g, ' ').slice(0, 110));
    check(/Kundenportal API/.test(D.h1 || ''), `page title (${D.h1})`);
    check(D.rail === 8, `8 resources in the rail (${D.rail})`);
    check(D.epCount >= 15, `endpoints render (${D.epCount})`);
    check(D.methods.includes('GET') && D.methods.includes('POST'), `method badges GET/POST (${JSON.stringify(D.methods)})`);
    check(/api\.bbl\.admin\.ch\/kundenportal/.test(D.base), `base URL shown (${D.base})`);
    // Auf die FORM der bbl_id prüfen (1080/4840/AF), nicht auf ein festes Präfix:
    // «1000/» kam im Bestand nie vor, der Test war damit immer rot.
    check(/\b\d{4}\/\d{4}\//.test(D.tryOut), 'data-backed «Ausprobieren» returns real building data (bbl_id)');
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, p.sessionId);
    writeFileSync(process.env.SHOT || join(tmpdir(), 'bbl-apidocs.png'), Buffer.from(shot.data, 'base64'));
    await p.closeTarget();

    // 2) deep-link ?tag=… focuses a resource --------------------------------
    const p2 = await openPage(cdp, `${APP_BASE}/app/api-docs/kundenportal?tag=bauprojekte`);
    await new Promise(r => setTimeout(r, 800));
    const T = await p2.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      let n = 0; while (!document.querySelector('#res-bauprojekte') && n++ < 100) await s(100); await s(300);
      const sec = document.getElementById('res-bauprojekte');
      return { firstOpen: !!(sec && sec.querySelector('.api-ep__head[aria-expanded="true"]')),
        active: (document.querySelector('.api-rail__item.is-active') || {}).textContent };
    })()`);
    check(T.firstOpen, 'deep-link ?tag=bauprojekte opens that resource focused');
    await p2.closeTarget();

    // 3) Kundenportal catalog entry links into the docs ---------------------
    const p3 = await openPage(cdp, `${APP_BASE}/data/catalog/20`);
    await new Promise(r => setTimeout(r, 700));
    const K = await p3.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      let n = 0; while (!document.querySelector('.data-rows') && n++ < 100) await s(100);
      return { h1: (document.querySelector('h1') || {}).textContent,
        docsLinks: document.querySelectorAll('a[href*="app/api-docs"]').length };
    })()`);
    console.log('■ Katalog-Eintrag:', JSON.stringify(K.h1), '| Links in die Docs:', K.docsLinks);
    check(/Kundenportal/.test(K.h1 || ''), `catalog dataset renders (${K.h1})`);
    check(K.docsLinks >= 8, `distributions deep-link into the docs (${K.docsLinks})`);
    check([...(await p.problems()), ...(await p2.problems()), ...(await p3.problems())].length === 0,
      `no exceptions / console errors / error banner${[...(await p.problems()), ...(await p2.problems()), ...(await p3.problems())][0] ? ': ' + [...(await p.problems()), ...(await p2.problems()), ...(await p3.problems())][0] : ''}`);
    await p3.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
