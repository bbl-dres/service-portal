// A2 router render-race — a page that awaits (dynamic-import delegator) must not
// overwrite a newer navigation. With the ctx.stale() guard the LAST navigation
// always wins: navigating quickly from an awaiting page to another (and back)
// must always land on the last-requested page. The app-detail import is uncached
// on the first race, which is where the window is widest.
//
//   node scripts/test-race.mjs      (dev server must be running; see README)
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

const APP = `${APP_BASE}/applications/liegenschaften-inventar`; // awaits import(application.js)
const SVC = `${APP_BASE}/services`;                              // "Dienstleistungen"

const race = (first, second, gap) => `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  location.hash = ${JSON.stringify('#' + first.split('#')[1])};
  await s(${gap});
  location.hash = ${JSON.stringify('#' + second.split('#')[1])};
  await s(800);
  return { hash: location.hash, h1: (document.querySelector('h1') || {}).textContent || null,
           err: !!document.querySelector('.notification--error') };
})()`;

// direction → the h1 the winning (second) page must show
const CASES = [
  { first: APP, second: SVC, gap: 3,  want: 'Dienstleistungen' },   // uncached app import races away → SVC wins
  { first: SVC, second: APP, gap: 3,  want: 'Liegenschaften Inventar' }, // winner awaits import → must still render
  { first: APP, second: SVC, gap: 0,  want: 'Dienstleistungen' },
  { first: SVC, second: APP, gap: 8,  want: 'Liegenschaften Inventar' },
  { first: APP, second: SVC, gap: 12, want: 'Dienstleistungen' },
];

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };

(async () => {
  const cdp = await launch();
  try {
    const page = await openPage(cdp, `${APP_BASE}/`);
    for (const c of CASES) {
      const r = await page.evaluate(race(c.first, c.second, c.gap));
      const dir = `${c.first.split('/').pop()} → ${c.second.split('/').pop()} (gap ${c.gap}ms)`;
      check((r.h1 || '').includes(c.want) && !r.err, `${dir} lands on "${c.want}" (got "${r.h1}")`);
    }
    check((await page.problems()).length === 0, `no exceptions / console errors / error banner${(await page.problems())[0] ? ': ' + (await page.problems())[0] : ''}`);
    await page.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
