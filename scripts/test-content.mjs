// D4 download-item + contact-box unification — verifies the pages that render
// C.downloadItem (foundations, guides, digitalisation docs, application
// entries, my-cases attachments) and C.contactBox (application, services detail)
// still render, with the expected download-items / mailto links and no exceptions.
//
//   node scripts/test-content.mjs      (dev server must be running; see README)
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const ROUTES = [
  { name: 'knowledge/it (subject area)',        url: `${APP_BASE}/knowledge/it`,                items: 1 },
  { name: 'knowledge/guides',                   url: `${APP_BASE}/knowledge/guides`,            items: 1 },
  { name: 'digitalisation/strategy',            url: `${APP_BASE}/data/digitalisation/strategy`, items: 2 },
  { name: 'applications/property inventory',   url: `${APP_BASE}/applications/liegenschaften-inventar`, items: 1, mailto: true, hero: true },
  { name: 'applications/superb (SAP ERP)',     url: `${APP_BASE}/applications/superb`, items: 2, mailto: true, hero: true, expectedTitle: 'ERP SAP (Supportprozesse)' },
  { name: 'app/workspace (planning)',           url: `${APP_BASE}/app/workspace` },
  { name: 'app/room-booking (form)',            url: `${APP_BASE}/app/room-booking` },
  { name: 'services/report space requirement', url: `${APP_BASE}/services/raumbedarf-melden`,       mailto: true, hero: true },
  { name: 'my-cases/seed-1 (attachments)',     url: `${APP_BASE}/my-cases/seed-1`,                  items: 1, login: true },
];

const PROBE = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.querySelector('h1') && n++ < 120) await s(100);
  const h1 = (document.querySelector('h1') || {}).textContent || null;
  const heroMedia = document.querySelector('.hero__image .photo, .hero__image > img, .hero__image figure > img');
  const headings = [...document.querySelectorAll('#main-content h1,#main-content h2,#main-content h3,#main-content h4,#main-content h5,#main-content h6')]
    .filter(el => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; });
  const jumps = []; let prior = 0;
  headings.forEach(el => { const level = Number(el.tagName[1]); if (prior && level > prior + 1) jumps.push(prior + '>' + level); prior = level; });
  return {
    h1,
    notFound: /nicht gefunden/i.test(h1 || ''),
    downloadItems: document.querySelectorAll('.download-item').length,
    downloadHeadings: [...document.querySelectorAll('.download-item__title')].map(el => el.tagName),
    headingJumps: jumps,
    heroRatio: heroMedia ? getComputedStyle(heroMedia).aspectRatio : '',
    mailto: !!document.querySelector('a[href^="mailto:"]'),
  };
})()`;

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };

(async () => {
  const cdp = await launch();
  try {
    // openPage sets the session independently for each page (scripts/lib/cdp.mjs):
    // app routes start logged in and all other routes start logged out. Routes
    // outside `#/app/…` that require a session declare `login: true` above.
    // Logging in once on an intermediate page is no longer sufficient.
    for (const route of ROUTES) {
      console.log(`\n■ ${route.name}`);
      const page = await openPage(cdp, route.url, route.login ? { login: true } : {});
      const result = await page.evaluate(PROBE);
      check(result.h1 && !result.notFound, `renders ("${result.h1}")`);
      if (route.expectedTitle) check(result.h1 === route.expectedTitle, `uses the expected title ("${route.expectedTitle}")`);
      if (route.items) check(result.downloadItems >= route.items, `≥${route.items} download-item(s) (got ${result.downloadItems})`);
      if (route.items) check(result.downloadHeadings.every(tag => tag === 'H3'), 'download-item titles use the contextual h3 level');
      check(result.headingJumps.length === 0, `unbroken heading hierarchy (${result.headingJumps.join(', ') || 'ok'})`);
      if (route.mailto) check(result.mailto === true, 'renders a contact mailto link');
      if (route.hero) check(result.heroRatio === '16 / 9', `consumer declares its hero ratio (${result.heroRatio})`);
      check((await page.problems()).length === 0, `no exceptions / console errors / error banner${(await page.problems())[0] ? ": " + (await page.problems())[0] : ""}`);
      await page.closeTarget();
    }
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
