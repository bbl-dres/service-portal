// D4 download-item + contact-box unification — verifies the pages that render
// C.downloadItem (grundlagen, anleitungen, digitalisierung docs, application
// entries, my-cases attachments) and C.contactBox (application, services detail)
// still render, with the expected download-items / mailto links and no exceptions.
//
//   node scripts/test-content.mjs      (dev server must be running; see README)
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const ROUTES = [
  { name: 'knowledge/it (Fachgebiet)',         url: `${APP_BASE}/knowledge/it`,                items: 1 },
  { name: 'knowledge/anleitungen',             url: `${APP_BASE}/knowledge/guides`,           items: 1 },
  { name: 'digitalisierung/strategie',         url: `${APP_BASE}/data/digitalisation/strategy`,  items: 2 },
  { name: 'applications/liegenschaften',       url: `${APP_BASE}/applications/liegenschaften-inventar`, items: 1, mailto: true },
  { name: 'services/raumbedarf-melden',        url: `${APP_BASE}/services/raumbedarf-melden`,       mailto: true },
  { name: 'my-cases/seed-1 (attachments)',     url: `${APP_BASE}/my-cases/seed-1`,                  items: 1, login: true },
];

const PROBE = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.querySelector('h1') && n++ < 120) await s(100);
  const h1 = (document.querySelector('h1') || {}).textContent || null;
  return {
    h1,
    notFound: /nicht gefunden/i.test(h1 || ''),
    downloadItems: document.querySelectorAll('.download-item').length,
    mailto: !!document.querySelector('a[href^="mailto:"]'),
  };
})()`;

const LOGIN = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  // __login is exposed at the end of app.js boot() (after core.load()); poll for it
  // instead of racing boot, or the gated my-cases route stays behind the login wall.
  let n = 0; while (typeof window.__login !== 'function' && n++ < 120) await s(50);
  if (typeof window.__login === 'function') { window.__login(); return 'ok'; }
  return 'no __login';
})()`;

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };

(async () => {
  const cdp = await launch({ port: 9337 });
  try {
    // log in once for the gated my-cases route
    let lp = await openPage(cdp, `${APP_BASE}/`);
    await lp.evaluate(LOGIN);
    await sleep(700);
    await lp.closeTarget();

    for (const r of ROUTES) {
      console.log(`\n■ ${r.name}`);
      const p = await openPage(cdp, r.url);
      const res = await p.evaluate(PROBE);
      check(res.h1 && !res.notFound, `renders ("${res.h1}")`);
      if (r.items) check(res.downloadItems >= r.items, `≥${r.items} download-item(s) (got ${res.downloadItems})`);
      if (r.mailto) check(res.mailto === true, 'renders a contact mailto link');
      check((await p.problems()).length === 0, `no exceptions / console errors / error banner${(await p.problems())[0] ? ": " + (await p.problems())[0] : ""}`);
      await p.closeTarget();
    }
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
