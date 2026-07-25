// A16 complement — the login gate must NOT block the logged-in path. Logs in via
// the AGOV/FedLogin stub (window.__login), then asserts the workspace "Buchung"
// tab renders the real booking form (not the gate). Exits non-zero on failure.
//
//   node scripts/test-login.mjs      (dev server must be running; see README)
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

// window.__login() calls session.login() then re-renders the header + route. The
// re-render destroys the V8 execution context mid-evaluate, so fire login in one
// evaluate and interact in a second (session persists via localStorage).
const LOGIN = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let n = 0;
  while (!document.querySelector('.tab__control') && n++ < 120) await sleep(100);
  if (typeof window.__login !== 'function') return 'no __login';
  window.__login();
  return 'login-called';
})()`;

const CHECK = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let n = 0;
  while (!document.querySelector('.tab__control[data-tab=buchung]') && n++ < 80) await sleep(100);
  const bx = document.querySelector('.tab__control[data-tab=buchung]');
  if (!bx) return { ok: false, err: 'no Buchung tab after login' };
  bx.click();
  await sleep(200);
  const form = document.querySelector('#buchung-form');
  const gate = document.querySelector('#wpanel .login-gate__btn');
  const nameLine = ((document.querySelector('#wpanel .muted') || {}).textContent || '').replace(/\\s+/g, ' ').trim();
  return {
    ok: !!form && !gate,
    hasForm: !!form,
    hasGate: !!gate,
    active: (document.querySelector('.tab__control--active') || {}).dataset?.tab,
    nameLine: nameLine.slice(0, 80),
  };
})()`;

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };

(async () => {
  const cdp = await launch({ port: 9334 });
  try {
    console.log('■ workspace Buchung [logged in]');
    const page = await openPage(cdp, `${APP_BASE}/app/workspace`);
    const step1 = await page.evaluate(LOGIN).catch((e) => 'login-eval-destroyed: ' + e.message);
    check(step1 === 'login-called', `login fired (${step1})`);
    await sleep(1200); // let the re-render settle
    const r = await page.evaluate(CHECK);
    check(r.ok, `Buchung tab shows the booking form, not the gate`);
    check(r.hasForm && !r.hasGate, `  #buchung-form present, no login gate`);
    check(r.active === 'buchung', `  active tab = buchung`);
    check(/·/.test(r.nameLine), `  requester line renders ("${r.nameLine}")`);
    check(page.exceptions.length === 0, `no uncaught exceptions${page.exceptions.length ? ' — ' + page.exceptions[0].split('\\n')[0] : ''}`);
    await page.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
