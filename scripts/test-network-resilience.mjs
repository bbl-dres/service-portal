// Network recovery gate: deferred route data may fail after the shell has
// booted, but the current view must remain understandable and keyboard-ready.
// Restoring the network and revisiting the route must retry the failed data.
//
// The superseded slow route-owned request is covered separately by
// test-router-lifecycle.mjs; keeping it there avoids two probes for one contract.
//
//   node scripts/test-network-resilience.mjs   (dev server must be running)
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

const browser = await launch();
try {
  const page = await openPage(browser, `${APP_BASE}/services`, { login: true });
  await browser.send('Network.enable', {}, page.sessionId);

  console.log('■ Deferred data fails honestly while offline');
  const prepared = await page.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const until = async (test) => {
      for (let i = 0; i < 120; i++) {
        if (test()) return true;
        await wait(50);
      }
      return false;
    };
    const ready = await until(() =>
      document.querySelector('#main-content h1')?.textContent.includes('Dienstleistungen')
      && !document.querySelector('#main-content [aria-busy="true"]'));

    // Warm only the JavaScript modules. The datasets and catalogue labels stay
    // uncached so the following route proves the deferred-data failure path,
    // rather than merely proving that an offline dynamic import can fail.
    await Promise.all([
      import('./js/pages/data.js'),
      import('./js/pages/catalog.js'),
    ]);

    window.__networkProbeErrors = [];
    window.addEventListener('error', (event) => {
      window.__networkProbeErrors.push('error: ' + (event.message || 'unknown'));
    });
    window.addEventListener('unhandledrejection', (event) => {
      window.__networkProbeErrors.push('rejection: ' + String(event.reason || 'unknown'));
    });
    return ready;
  })()`);
  check(prepared, 'the shell is settled before the network is disabled');

  await browser.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
    connectionType: 'none',
  }, page.sessionId);

  const offline = await page.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const until = async (test) => {
      for (let i = 0; i < 160; i++) {
        if (test()) return true;
        await wait(50);
      }
      return false;
    };
    location.hash = '#/data/catalog?network-probe=offline';
    const settled = await until(() => {
      const heading = document.querySelector('#main-content h1');
      return heading?.textContent.includes('Datenbezug und API Verzeichnis')
        && document.querySelector('#main-content .empty--unavailable')
        && document.querySelector('#data-status .notification--error')
        && !document.querySelector('#main-content [aria-busy="true"]')
        && document.activeElement === heading;
    });
    await wait(100);
    const heading = document.querySelector('#main-content h1');
    const unavailable = document.querySelector('#main-content .empty--unavailable');
    const status = document.querySelector('#data-status .notification--error');
    return {
      settled,
      hash: location.hash,
      heading: heading?.textContent.trim() || '',
      focused: document.activeElement === heading,
      unavailable: unavailable?.textContent.replace(/\\s+/g, ' ').trim() || '',
      status: status?.textContent.replace(/\\s+/g, ' ').trim() || '',
      errors: window.__networkProbeErrors.slice(),
    };
  })()`);

  check(offline.settled, 'the offline deferred-data route reaches a stable terminal view', JSON.stringify(offline));
  check(offline.hash === '#/data/catalog?network-probe=offline'
      && offline.heading === 'Datenbezug und API Verzeichnis',
    'the requested route and German heading remain visible', JSON.stringify(offline));
  check(offline.focused, 'the offline view focuses its H1');
  check(/Datensätze konnten nicht geladen werden \(Ladefehler\)/.test(offline.unavailable),
    'the result area distinguishes unavailable data from an empty catalogue', offline.unavailable);
  check(/Einige Daten konnten nicht geladen werden/.test(offline.status)
      && /Datenkatalog/.test(offline.status),
    'the persistent German status identifies the failed data area', offline.status);
  check(offline.errors.length === 0, 'offline fetch failures cause no uncaught or unhandled errors', offline.errors.join(' | '));
  check(page.exceptions.length === 0, 'CDP observes no uncaught exception while offline', page.exceptions[0] || '');
  check(page.consoleErrors.length === 0, 'the offline fallback emits no console errors', page.consoleErrors[0] || '');

  console.log('■ Restored network retries and recovers through history');
  await browser.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: 'wifi',
  }, page.sessionId);

  const recovery = await page.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const until = async (test) => {
      for (let i = 0; i < 200; i++) {
        if (test()) return true;
        await wait(50);
      }
      return false;
    };
    const headingText = () => document.querySelector('#main-content h1')?.textContent.trim() || '';

    location.hash = '#/services?network-probe=recovery';
    const navigatedAway = await until(() =>
      location.hash === '#/services?network-probe=recovery'
      && headingText() === 'Dienstleistungen');

    history.back();
    const recovered = await until(() =>
      location.hash === '#/data/catalog?network-probe=offline'
      && headingText() === 'Datenbezug und API Verzeichnis'
      && !!document.querySelector('#main-content .card')
      && !document.querySelector('#main-content .empty--unavailable')
      && !document.querySelector('#data-status .notification--error')
      && !document.querySelector('#main-content [aria-busy="true"]'));
    await wait(100);
    const heading = document.querySelector('#main-content h1');
    return {
      navigatedAway,
      recovered,
      hash: location.hash,
      heading: headingText(),
      focused: document.activeElement === heading,
      cards: document.querySelectorAll('#main-content .card').length,
      unavailable: !!document.querySelector('#main-content .empty--unavailable'),
      dataError: !!document.querySelector('#data-status .notification--error'),
      errors: window.__networkProbeErrors.slice(),
    };
  })()`);

  check(recovery.navigatedAway, 'navigation remains usable after the offline failure', JSON.stringify(recovery));
  check(recovery.recovered && recovery.cards > 0,
    'Back retries the failed deferred data and restores catalogue content', JSON.stringify(recovery));
  check(recovery.hash === '#/data/catalog?network-probe=offline'
      && recovery.heading === 'Datenbezug und API Verzeichnis',
    'recovery returns to the originally requested route', JSON.stringify(recovery));
  check(recovery.focused, 'the recovered history view focuses its H1');
  check(!recovery.unavailable && !recovery.dataError,
    'successful retry clears both unavailable states', JSON.stringify(recovery));
  check(recovery.errors.length === 0, 'recovery causes no uncaught or unhandled errors', recovery.errors.join(' | '));
  check(page.exceptions.length === 0, 'CDP observes no uncaught exception after recovery', page.exceptions[0] || '');
  check(page.consoleErrors.length === 0, 'recovery emits no console errors', page.consoleErrors[0] || '');

  await page.closeTarget();
} finally {
  browser.close();
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
