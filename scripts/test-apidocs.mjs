// API-documentation integration checks cover portal chrome, standard Swagger
// resources and operations, live examples, disabled Try it out, ?tag scrolling,
// and the customer-portal catalogue link. CDN rendering requires network access.
// Run with a development server as described in README.
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };

(async () => {
  const cdp = await launch({ webgl: false });
  try {
    // 1. Documentation page: portal chrome and standard Swagger.
    const p = await openPage(cdp, `${APP_BASE}/app/api-docs/kundenportal`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1500, deviceScaleFactor: 1, mobile: false }, p.sessionId);
    await new Promise(r => setTimeout(r, 700));
    const D = await p.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      // Poll CDN loading and rendering for up to roughly 20 seconds.
      let n = 0; while (!document.querySelector('.swagger-ui .opblock') && n++ < 200) await s(100);
      const tagEls = [...document.querySelectorAll('.swagger-ui .opblock-tag')];
      // Expand the first property operation and inspect its core-backed example.
      let example = '';
      const summary = [...document.querySelectorAll('.opblock-summary')]
        .find(el => /\\/buildings$/.test((el.querySelector('.opblock-summary-path') || {}).textContent || ''));
      if (summary) {
        summary.querySelector('button, .opblock-summary-control')?.click() || summary.click();
        let m = 0; while (!summary.closest('.opblock')?.querySelector('.opblock-body') && m++ < 50) await s(100);
        await s(300);
        example = summary.closest('.opblock')?.querySelector('.opblock-body')?.innerText || '';
      }
      const controls = [...document.querySelectorAll('.swagger-ui button,.swagger-ui input:not([type="hidden"]),.swagger-ui select,.swagger-ui textarea')]
        .filter(el => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; });
      const smallControls = controls.filter(el => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length;
      const focusTarget = controls.find(el => !el.disabled);
      focusTarget?.focus();
      const focusStyle = focusTarget ? getComputedStyle(focusTarget) : null;
      return {
        h1: (document.querySelector('#main-content h1') || {}).textContent,
        resourcesH2: (document.querySelector('#api-resources-title') || {}).tagName || '',
        resourcesLabelled: document.querySelector('#api-swagger')?.getAttribute('aria-labelledby') || '',
        tagHeadingLevels: [...document.querySelectorAll('.swagger-ui .opblock-tag')].map(el => el.tagName),
        badges: [...document.querySelectorAll('.pill-row .badge')].map(b => b.textContent.trim()),
        duplicateInfo: !!document.querySelector('.swagger-host .information-container') &&
          getComputedStyle(document.querySelector('.swagger-host .information-container')).display !== 'none',
        server: (document.querySelector('.swagger-ui .servers, .swagger-ui .scheme-container') || {}).textContent || '',
        tags: tagEls.map(t => t.getAttribute('data-tag')),
        ops: document.querySelectorAll('.swagger-ui .opblock').length,
        get: document.querySelectorAll('.swagger-ui .opblock-get').length,
        post: document.querySelectorAll('.swagger-ui .opblock-post').length,
        tryOut: document.querySelectorAll('.swagger-ui .try-out').length,
        authorize: !!document.querySelector('.swagger-ui .auth-wrapper, .swagger-ui .authorization__btn'),
        loadingLeft: !!document.querySelector('.swagger-host .loading'),
        smallControls,
        focusOutline: focusStyle?.outlineStyle || '',
        authName: document.querySelector('.authorization__btn')?.getAttribute('aria-label') || '',
        example,
      };
    })()`);
    console.log('■ API documentation (Swagger UI)');
    console.log('   h1:', JSON.stringify(D.h1), '| badges:', JSON.stringify(D.badges));
    console.log('   tags:', D.tags.length, '| ops:', D.ops, `(get ${D.get} / post ${D.post})`, '| try-out:', D.tryOut);
    check(/Kundenportal API/.test(D.h1 || ''), `portal h1 remains (${D.h1})`);
    check(D.resourcesH2 === 'H2' && D.resourcesLabelled === 'api-resources-title', 'Swagger resources sit under a labelled h2 group');
    check(D.tagHeadingLevels.every(level => level === 'H3'), 'resource titles follow as h3 headings');
    check(D.badges.some(b => /^v/.test(b)), `header includes a version badge (${JSON.stringify(D.badges)})`);
    check(!D.duplicateInfo, 'Swagger info block does not duplicate the portal header');
    // The complete inventory currently contains 17 resources and 47 endpoints.
    check(D.tags.length === 17, `17 resource sections render (${D.tags.length})`);
    check(D.ops >= 40, `operations render (${D.ops})`);
    check(D.get > 0 && D.post > 0, `GET and POST blocks render (${D.get}/${D.post})`);
    check(/api\.bbl\.admin\.ch\/kundenportal/.test(D.server), 'server row shows the base URL');
    check(D.tryOut === 0, '“Try it out” is absent because there is no backend');
    check(!D.loadingLeft, 'loading state is removed after rendering');
    check(D.smallControls === 0, `Swagger controls are at least 44 × 44 px (${D.smallControls} smaller)`);
    check(D.focusOutline !== 'none' && D.focusOutline !== '', `focus state is visible (${D.focusOutline})`);
    check(D.authName === 'Authorize API access', 'authorization button has a stable accessible name');
    // Validate the bbl_id shape, not a fixed prefix.
    check(/\b\d{4}\/\d{4}\//.test(D.example), 'live example contains real building data (bbl_id)');
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, p.sessionId);
    writeFileSync(process.env.SHOT || join(tmpdir(), 'bbl-apidocs.png'), Buffer.from(shot.data, 'base64'));
    await p.closeTarget();

    // 2. A ?tag deep link scrolls to its resource.
    const p2 = await openPage(cdp, `${APP_BASE}/app/api-docs/kundenportal?tag=projects`);
    await new Promise(r => setTimeout(r, 800));
    const T = await p2.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      let n = 0; while (!document.querySelector('.swagger-ui .opblock-tag') && n++ < 200) await s(100);
      await s(600);   // Wait for onComplete and router scrolling.
      const el = [...document.querySelectorAll('.opblock-tag')].find(h => (h.getAttribute('data-tag') || '') === 'projects');
      const top = el ? el.getBoundingClientRect().top : 9999;
      return { exists: !!el, top: Math.round(top), scrollY: Math.round(scrollY) };
    })()`);
    check(T.exists, 'projects resource exists');
    check(T.scrollY > 0 && T.top > -120 && T.top < 300, `?tag scrolls to the resource (top ${T.top}, scrollY ${T.scrollY})`);
    await p2.closeTarget();

    // 3. The customer-portal catalogue entry links to these docs.
    const p3 = await openPage(cdp, `${APP_BASE}/data/catalog/20`);
    await new Promise(r => setTimeout(r, 700));
    const K = await p3.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      let n = 0; while (!document.querySelector('dl.kv--ruled') && n++ < 100) await s(100);
      return { h1: (document.querySelector('h1') || {}).textContent,
        docsLinks: document.querySelectorAll('a[href*="app/api-docs"]').length };
    })()`);
    console.log('■ Catalogue entry:', JSON.stringify(K.h1), '| documentation links:', K.docsLinks);
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
