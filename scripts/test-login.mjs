// Login-gate complement: after using the AGOV/FedLogin stub, the standalone
// Room Booking route must render its form instead of the gate.
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

const LOGIN = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let tries = 0;
  while (typeof window.__login !== 'function' && tries++ < 120) await wait(50);
  if (typeof window.__login !== 'function') return 'no __login';
  window.__login();
  return 'login-called';
})()`;

const LOGOUT = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let tries = 0;
  while (typeof window.__logout !== 'function' && tries++ < 120) await wait(50);
  if (typeof window.__logout !== 'function') return 'no __logout';
  await window.__logout();
  return 'logout-called';
})()`;

const CHECK_LOGGED_OUT = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let tries = 0;
  while (!document.querySelector('.login-gate__btn') && tries++ < 120) await wait(50);
  return {
    hasGate: !!document.querySelector('.login-gate__btn'),
    hasForm: !!document.querySelector('#booking-search'),
    hasSession: !!localStorage.getItem('bbl_session_v1'),
    authLabel: document.querySelector('.meta-navigation--desktop .meta-navigation__auth')?.textContent.trim() || '',
  };
})()`;

const CHECK_LOGGED_IN = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let tries = 0;
  while (!document.querySelector('#booking-search') && tries++ < 120) await wait(100);
  return {
    h1: document.querySelector('h1')?.textContent.trim() || '',
    hasForm: !!document.querySelector('#booking-search'),
    hasGate: !!document.querySelector('.login-gate__btn'),
    rooms: document.querySelectorAll('.booking-room').length,
    bookable: document.querySelectorAll('[data-book]').length,
  };
})()`;

let failures = 0;
const check = (condition, label) => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures++;
};

const cdp = await launch();
let page;
let otherPage;
try {
  console.log('■ Room Booking [logged out → logged in]');
  page = await openPage(cdp, `${APP_BASE}/app/room-booking`, { login: false });
  const loggedOut = await page.evaluate(CHECK_LOGGED_OUT);
  check(loggedOut.hasGate && !loggedOut.hasForm && !loggedOut.hasSession,
    'route genuinely starts logged out and shows the login gate');

  const login = await page.evaluate(LOGIN).catch((error) => 'login-eval-destroyed: ' + error.message);
  check(login === 'login-called', `login fired (${login})`);
  const result = await page.evaluate(CHECK_LOGGED_IN);
  check(result.h1 === 'Raumbuchung', `route renders (h1: "${result.h1}")`);
  check(result.hasForm && !result.hasGate, 'the search bar is present and the login gate is gone');
  check(result.rooms > 0 && result.bookable === result.rooms, `results are bookable straight away (${result.rooms} rooms)`);

  const logout = await page.evaluate(LOGOUT).catch((error) => 'logout-eval-destroyed: ' + error.message);
  check(logout === 'logout-called', `logout fired (${logout})`);
  const loggedOutAgain = await page.evaluate(CHECK_LOGGED_OUT);
  check(loggedOutAgain.hasGate && !loggedOutAgain.hasForm && !loggedOutAgain.hasSession,
    'logout clears storage and restores the route gate without a listener API');
  check(loggedOutAgain.authLabel === 'Anmelden', 'the header returns to the logged-out action');

  console.log('■ Cross-tab session synchronization');
  otherPage = await openPage(cdp, `${APP_BASE}/services`, { login: true });
  const crossTabLogin = await page.evaluate(CHECK_LOGGED_IN);
  check(crossTabLogin.hasForm && !crossTabLogin.hasGate,
    'a login persisted by another tab redraws the protected route');
  const otherLogout = await otherPage.evaluate(LOGOUT)
    .catch((error) => 'logout-eval-destroyed: ' + error.message);
  check(otherLogout === 'logout-called', `the second tab logs out (${otherLogout})`);
  const crossTabLogout = await page.evaluate(CHECK_LOGGED_OUT);
  check(crossTabLogout.hasGate && !crossTabLogout.hasForm && !crossTabLogout.hasSession,
    'a logout in another tab restores the route gate');
  check(crossTabLogout.authLabel === 'Anmelden',
    'the first tab header follows the cross-tab logout');

  const problems = await page.problems();
  check(problems.length === 0, `no exceptions / console errors / error banner${problems[0] ? ': ' + problems[0] : ''}`);
  const otherProblems = await otherPage.problems();
  check(otherProblems.length === 0, `the second tab has no runtime problems${otherProblems[0] ? ': ' + otherProblems[0] : ''}`);
} finally {
  if (otherPage) await otherPage.closeTarget().catch(() => {});
  if (page) await page.closeTarget().catch(() => {});
  cdp.close();
}

console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
