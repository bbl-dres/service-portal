// Login-gate complement: after using the AGOV/FedLogin stub, the standalone
// Room Booking route must render its form instead of the gate.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const LOGIN = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let tries = 0;
  while (typeof window.__login !== 'function' && tries++ < 120) await wait(50);
  if (typeof window.__login !== 'function') return 'no __login';
  window.__login();
  return 'login-called';
})()`;

const CHECK = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let tries = 0;
  while (!document.querySelector('#booking-location-search, .login-gate__btn') && tries++ < 120) await wait(100);
  return {
    h1: document.querySelector('h1')?.textContent.trim() || '',
    hasForm: !!document.querySelector('#booking-location-search'),
    hasGate: !!document.querySelector('.login-gate__btn'),
    steps: document.querySelectorAll('.step__indicator-step').length,
  };
})()`;

let failures = 0;
const check = (condition, label) => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures++;
};

const cdp = await launch();
try {
  console.log('■ Room Booking [logged in]');
  const page = await openPage(cdp, `${APP_BASE}/app/room-booking`);
  const login = await page.evaluate(LOGIN).catch((error) => 'login-eval-destroyed: ' + error.message);
  check(login === 'login-called', `login fired (${login})`);
  await sleep(1200);
  const result = await page.evaluate(CHECK);
  check(result.h1 === 'Raumbuchung', `route renders (h1: "${result.h1}")`);
  check(result.hasForm && !result.hasGate, 'first booking step is present and login gate is gone');
  check(result.steps === 3, 'three booking steps are announced');
  const problems = await page.problems();
  check(problems.length === 0, `no exceptions / console errors / error banner${problems[0] ? ': ' + problems[0] : ''}`);
  await page.closeTarget();
} finally {
  cdp.close();
}

console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
