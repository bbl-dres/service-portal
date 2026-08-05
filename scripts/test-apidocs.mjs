// API-Dokumentation (js/apps/api-docs.js + data/api-specs.json) — seit dem
// Umbau 2026-08-04 rendert unterhalb der detail-bar das ECHTE Swagger UI
// (swagger-ui-dist vom CDN). Geprüft wird: Portal-Kopf bleibt (h1/Badges),
// Swagger rendert alle Ressourcen-Abschnitte und Operationen, die Live-
// Beispiele tragen echte Portaldaten, «Try it out» ist aus, ?tag scrollt zur
// Ressource, und der Kundenportal-Katalogeintrag verlinkt weiter hierher.
// Braucht Netzzugang (unpkg.com) — wie die MapLibre-Suiten.
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
    // 1) Docs-Seite: Portal-Kopf + Standard-Swagger ------------------------
    const p = await openPage(cdp, `${APP_BASE}/app/api-docs/kundenportal`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1500, deviceScaleFactor: 1, mobile: false }, p.sessionId);
    await new Promise(r => setTimeout(r, 700));
    const D = await p.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      // CDN-Laden + Rendern — grosszügig pollen (bis ~20s).
      let n = 0; while (!document.querySelector('.swagger-ui .opblock') && n++ < 200) await s(100);
      const tagEls = [...document.querySelectorAll('.swagger-ui .opblock-tag')];
      // Beispielantwort: erste /liegenschaften-Operation aufklappen und den
      // gerenderten Beispieltext lesen (Live-Daten aus dem core).
      let example = '';
      const summary = [...document.querySelectorAll('.opblock-summary')]
        .find(el => /\\/buildings$/.test((el.querySelector('.opblock-summary-path') || {}).textContent || ''));
      if (summary) {
        summary.querySelector('button, .opblock-summary-control')?.click() || summary.click();
        let m = 0; while (!summary.closest('.opblock')?.querySelector('.opblock-body') && m++ < 50) await s(100);
        await s(300);
        example = summary.closest('.opblock')?.querySelector('.opblock-body')?.innerText || '';
      }
      return {
        h1: (document.querySelector('#main-content h1') || {}).textContent,
        resourcesH2: (document.querySelector('#api-resources-title') || {}).tagName || '',
        resourcesLabelled: document.querySelector('#api-swagger')?.getAttribute('aria-labelledby') || '',
        tagHeadingLevels: [...document.querySelectorAll('.swagger-ui .opblock-tag')].map(el => el.tagName),
        badges: [...document.querySelectorAll('.pill-row .badge')].map(b => b.textContent.trim()),
        infoDoppelt: !!document.querySelector('.swagger-host .information-container') &&
          getComputedStyle(document.querySelector('.swagger-host .information-container')).display !== 'none',
        server: (document.querySelector('.swagger-ui .servers, .swagger-ui .scheme-container') || {}).textContent || '',
        tags: tagEls.map(t => t.getAttribute('data-tag')),
        ops: document.querySelectorAll('.swagger-ui .opblock').length,
        get: document.querySelectorAll('.swagger-ui .opblock-get').length,
        post: document.querySelectorAll('.swagger-ui .opblock-post').length,
        tryOut: document.querySelectorAll('.swagger-ui .try-out').length,
        authorize: !!document.querySelector('.swagger-ui .auth-wrapper, .swagger-ui .authorization__btn'),
        loadingLeft: !!document.querySelector('.swagger-host .loading'),
        example,
      };
    })()`);
    console.log('■ API-Dokumentation (Swagger UI)');
    console.log('   h1:', JSON.stringify(D.h1), '| badges:', JSON.stringify(D.badges));
    console.log('   tags:', D.tags.length, '| ops:', D.ops, `(get ${D.get} / post ${D.post})`, '| try-out:', D.tryOut);
    check(/Kundenportal API/.test(D.h1 || ''), `Portal-h1 bleibt (${D.h1})`);
    check(D.resourcesH2 === 'H2' && D.resourcesLabelled === 'api-resources-title', 'Swagger-Ressourcen liegen unter einer benannten H2-Gruppe');
    check(D.tagHeadingLevels.every(level => level === 'H3'), 'Ressourcentitel folgen als H3');
    check(D.badges.some(b => /^v/.test(b)), `Versions-Badge im Kopf (${JSON.stringify(D.badges)})`);
    check(!D.infoDoppelt, 'Swaggers Info-Block doppelt den Kopf nicht');
    // Seit der Englisch-Umbenennung (2026-08-04) deckt die API den ganzen
    // Datenbestand: 17 Ressourcen, 47 Endpunkte (data/api-specs.json).
    check(D.tags.length === 17, `17 Ressourcen-Abschnitte (${D.tags.length})`);
    check(D.ops >= 40, `Operationen gerendert (${D.ops})`);
    check(D.get > 0 && D.post > 0, `GET- und POST-Blöcke (${D.get}/${D.post})`);
    check(/api\.bbl\.admin\.ch\/kundenportal/.test(D.server), 'Server-Zeile zeigt die Basis-URL');
    check(D.tryOut === 0, 'kein «Try it out» (kein Backend)');
    check(!D.loadingLeft, 'Ladezustand (C.loading) ist nach dem Rendern abgeräumt');
    // Auf die FORM der bbl_id prüfen (1080/4840/AF), nicht auf ein festes Präfix.
    check(/\b\d{4}\/\d{4}\//.test(D.example), 'Live-Beispiel trägt echte Gebäudedaten (bbl_id)');
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, p.sessionId);
    writeFileSync(process.env.SHOT || join(tmpdir(), 'bbl-apidocs.png'), Buffer.from(shot.data, 'base64'));
    await p.closeTarget();

    // 2) Deep-Link ?tag=… scrollt zur Ressource ----------------------------
    const p2 = await openPage(cdp, `${APP_BASE}/app/api-docs/kundenportal?tag=projects`);
    await new Promise(r => setTimeout(r, 800));
    const T = await p2.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      let n = 0; while (!document.querySelector('.swagger-ui .opblock-tag') && n++ < 200) await s(100);
      await s(600);   // onComplete + Router-Scroll abwarten
      const el = [...document.querySelectorAll('.opblock-tag')].find(h => (h.getAttribute('data-tag') || '') === 'projects');
      const top = el ? el.getBoundingClientRect().top : 9999;
      return { da: !!el, top: Math.round(top), scrollY: Math.round(scrollY) };
    })()`);
    check(T.da, 'Ressource «projects» vorhanden');
    check(T.scrollY > 0 && T.top > -120 && T.top < 300, `?tag scrollt zur Ressource (top ${T.top}, scrollY ${T.scrollY})`);
    await p2.closeTarget();

    // 3) Kundenportal-Katalogeintrag verlinkt in die Docs -------------------
    const p3 = await openPage(cdp, `${APP_BASE}/data/catalog/20`);
    await new Promise(r => setTimeout(r, 700));
    const K = await p3.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      let n = 0; while (!document.querySelector('dl.kv--ruled') && n++ < 100) await s(100);
      return { h1: (document.querySelector('h1') || {}).textContent,
        docsLinks: document.querySelectorAll('a[href*="app/api-docs"]').length };
    })()`);
    console.log('■ Katalog-Eintrag:', JSON.stringify(K.h1), '| Links in die Docs:', K.docsLinks);
    check(/Kundenportal/.test(K.h1 || ''), `catalog dataset renders (${K.h1})`);
    check(K.docsLinks >= 17, `distributions deep-link into the docs (${K.docsLinks})`);
    check([...(await p.problems()), ...(await p2.problems()), ...(await p3.problems())].length === 0,
      `no exceptions / console errors / error banner${[...(await p.problems()), ...(await p2.problems()), ...(await p3.problems())][0] ? ': ' + [...(await p.problems()), ...(await p2.problems()), ...(await p3.problems())][0] : ''}`);
    await p3.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
