// Router dispatch ownership: terminal views share focus/scroll finalisation,
// stale requests are aborted, cache-owned requests are not, and a requested
// route is not treated as mounted until its winning render completes.
//
//   node scripts/test-router-lifecycle.mjs   (dev server must be running)
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

const cdp = await launch();
try {
  console.log('■ Terminal route finalisation');
  const terminalPage = await openPage(cdp, `${APP_BASE}/services`, { login: false });
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  }, terminalPage.sessionId);
  const terminal = await terminalPage.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const until = async (test) => {
      for (let i = 0; i < 120; i++) {
        if (test()) return true;
        await wait(50);
      }
      return false;
    };
    await until(() => document.querySelector('#main-content h1')?.textContent.includes('Dienstleistungen'));

    let disconnects = 0;
    const originalDisconnect = ResizeObserver.prototype.disconnect;
    ResizeObserver.prototype.disconnect = function () {
      disconnects += 1;
      return originalDisconnect.call(this);
    };

    const fromBottom = async (hash, ready) => {
      const main = document.getElementById('main-content');
      main.insertAdjacentHTML('beforeend', '<div data-router-spacer style="height:4000px"></div>');
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo({ top: document.scrollingElement.scrollHeight, behavior: 'instant' });
      await wait(50);
      const before = window.scrollY;
      const disconnectedBefore = disconnects;
      location.hash = hash;
      await until(ready);
      await new Promise(requestAnimationFrame);
      const heading = main.querySelector('h1');
      const rect = heading?.getBoundingClientRect();
      return {
        before,
        after: window.scrollY,
        focused: document.activeElement === heading,
        visible: !!rect && rect.top >= 0 && rect.top < innerHeight,
        disconnected: disconnects > disconnectedBefore,
        heading: heading?.textContent.trim() || '',
      };
    };

    const gate = await fromBottom('#/app/portfolio',
      () => !!document.querySelector('#main-content .login-gate'));
    const notFound = await fromBottom('#/route-that-does-not-exist',
      () => document.querySelector('#main-content h1')?.textContent.includes('Seite nicht gefunden'));

    const { core } = await import('./js/core/index.js');
    const originalEnsure = core.ensure;
    core.ensure = async () => { throw new Error('router lifecycle probe'); };
    const error = await fromBottom('#/applications?router-error=1',
      () => document.querySelector('#main-content h1')?.textContent.includes('konnte nicht geladen'));
    core.ensure = originalEnsure;
    ResizeObserver.prototype.disconnect = originalDisconnect;
    return { gate, notFound, error };
  })()`);

  for (const [name, result] of Object.entries(terminal)) {
    check(result.before > 500, `${name} probe starts below the fold`, JSON.stringify(result));
    check(result.after <= 50 && result.visible, `${name} returns the viewport to its heading`, JSON.stringify(result));
    check(result.focused, `${name} focuses its heading`, result.heading);
    check(result.disconnected, `${name} disconnects the previous scroll observer`);
  }
  check(terminalPage.exceptions.length === 0, 'terminal outcomes do not throw uncaught exceptions', terminalPage.exceptions[0] || '');
  check(terminalPage.consoleErrors.filter((entry) => !entry.includes('router lifecycle probe')).length === 0,
    'terminal outcomes emit no unexpected console errors', terminalPage.consoleErrors.join(' | '));
  await terminalPage.closeTarget();

  console.log('■ Superseded query dispatch and route-owned abort');
  const abortPage = await openPage(cdp, `${APP_BASE}/services`, { login: true });
  const abortResult = await abortPage.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const until = async (test) => {
      for (let i = 0; i < 200; i++) {
        if (test()) return true;
        await wait(50);
      }
      return false;
    };
    await until(() => document.querySelector('#main-content h1')?.textContent.includes('Dienstleistungen'));

    const originalFetch = window.fetch.bind(window);
    const routeRequests = [];
    const cacheSignals = [];
    window.fetch = (input, init = {}) => {
      const url = String(input);
      if (/data\\/api-specs\\.json(?:$|[?#])/.test(url)) {
        return new Promise((resolve, reject) => {
          const record = { hasSignal: !!init.signal, aborted: !!init.signal?.aborted };
          routeRequests.push(record);
          const abort = () => {
            record.aborted = true;
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          };
          if (init.signal?.aborted) abort();
          else init.signal?.addEventListener('abort', abort, { once: true });
        });
      }
      if (/data\\/(?:applications|datasets|buildings|projects|contacts)\\.(?:json|geojson)(?:$|[?#])/.test(url)) {
        cacheSignals.push(!!init.signal);
      }
      return originalFetch(input, init);
    };

    location.hash = '#/app/api-docs?tag=first';
    await until(() => routeRequests.length === 1);
    document.getElementById('main-content').innerHTML = '<h1 tabindex="-1">Sentinel</h1>';
    location.hash = '#/app/api-docs?tag=second';
    await until(() => routeRequests.length === 2);
    const secondShowsLoading = !!document.querySelector('#main-content [aria-busy="true"]');
    location.hash = '#/services?after-abort=1';
    await until(() => document.querySelector('#main-content h1')?.textContent.includes('Dienstleistungen'));
    await wait(100);
    window.fetch = originalFetch;
    return {
      routeRequests,
      cacheSignals,
      secondShowsLoading,
      hash: location.hash,
      heading: document.querySelector('#main-content h1')?.textContent.trim() || '',
    };
  })()`);
  check(abortResult.routeRequests.length === 2 && abortResult.routeRequests.every((request) => request.hasSignal),
    'each route-owned API docs request receives a dispatch signal', JSON.stringify(abortResult.routeRequests));
  check(abortResult.routeRequests.every((request) => request.aborted),
    'superseding dispatches abort both delayed route requests', JSON.stringify(abortResult.routeRequests));
  check(abortResult.cacheSignals.length > 0 && abortResult.cacheSignals.every((signal) => !signal),
    'cache-owned core requests remain independent of dispatch aborts', JSON.stringify(abortResult.cacheSignals));
  check(abortResult.secondShowsLoading,
    'a second query for a route that never mounted remains a full navigation');
  check(abortResult.hash === '#/services?after-abort=1' && abortResult.heading === 'Dienstleistungen',
    'the winning navigation renders after both aborts', JSON.stringify(abortResult));
  const abortProblems = await abortPage.problems();
  check(abortProblems.length === 0, 'aborted stale work emits no browser errors', abortProblems.join(' | '));
  await abortPage.closeTarget();

  console.log('■ Superseded authentication redraw focus');
  const authPage = await openPage(cdp, `${APP_BASE}/services`, { login: false });
  const authResult = await authPage.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const until = async (test) => {
      for (let i = 0; i < 160; i++) {
        if (test()) return true;
        await wait(50);
      }
      return false;
    };
    await until(() => document.querySelector('#main-content h1')?.textContent.includes('Dienstleistungen'));

    const { core } = await import('./js/core/index.js');
    const originalEnsure = core.ensure;
    let releaseEnsure;
    let ensureCalls = 0;
    const delayedEnsure = new Promise((resolve) => { releaseEnsure = resolve; });
    core.ensure = async () => {
      ensureCalls += 1;
      await delayedEnsure;
      return true;
    };

    let loginPromise;
    try {
      loginPromise = window.__login();
      const redrawWaiting = await until(() => ensureCalls === 1);
      location.hash = '#/knowledge';
      const newerReady = await until(() => {
        const heading = document.querySelector('#main-content h1');
        return location.hash === '#/knowledge'
          && heading?.textContent.includes('Wissen und Hilfsmittel')
          && document.activeElement === heading;
      });
      const beforeRelease = {
        hash: location.hash,
        heading: document.querySelector('#main-content h1')?.textContent.trim() || '',
        focused: document.activeElement === document.querySelector('#main-content h1'),
      };
      releaseEnsure();
      const loginResult = await loginPromise;
      await wait(100);
      return {
        redrawWaiting,
        newerReady,
        ensureCalls,
        loginResult,
        beforeRelease,
        afterRelease: {
          hash: location.hash,
          heading: document.querySelector('#main-content h1')?.textContent.trim() || '',
          focused: document.activeElement === document.querySelector('#main-content h1'),
          headerFocused: !!document.activeElement?.closest?.('.meta-navigation__auth'),
        },
      };
    } finally {
      releaseEnsure?.();
      core.ensure = originalEnsure;
    }
  })()`);
  check(authResult.redrawWaiting && authResult.ensureCalls === 1,
    'the authentication redraw is held inside delayed core.ensure', JSON.stringify(authResult));
  check(authResult.newerReady && authResult.beforeRelease.focused,
    'a newer navigation owns heading focus while the auth redraw is pending', JSON.stringify(authResult.beforeRelease));
  check(authResult.loginResult === true
      && authResult.afterRelease.hash === '#/knowledge'
      && authResult.afterRelease.heading === 'Wissen und Hilfsmittel'
      && authResult.afterRelease.focused
      && !authResult.afterRelease.headerFocused,
    'the late auth completion does not steal focus from the newer heading', JSON.stringify(authResult.afterRelease));
  const authProblems = await authPage.problems();
  check(authProblems.length === 0, 'superseded authentication redraw emits no browser errors', authProblems.join(' | '));
  await authPage.closeTarget();

  console.log('■ Shared estate cache rejection stays stale');
  const estatePage = await openPage(cdp, `${APP_BASE}/services`, { login: true });
  const estateResult = await estatePage.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const until = async (test) => {
      for (let i = 0; i < 160; i++) {
        if (test()) return true;
        await wait(50);
      }
      return false;
    };
    await until(() => document.querySelector('#main-content h1')?.textContent.includes('Dienstleistungen'));

    const originalFetch = window.fetch.bind(window);
    let rejectBuildings;
    let buildingRequests = 0;
    window.fetch = (input, init = {}) => {
      const url = String(input);
      if (/data\\/buildings\\.geojson(?:$|[?#])/.test(url)) {
        buildingRequests += 1;
        return new Promise((resolve, reject) => { rejectBuildings = reject; });
      }
      return originalFetch(input, init);
    };

    try {
      location.hash = '#/app/dataportal/immobilien?cache-probe=first';
      const firstStarted = await until(() => buildingRequests === 1);
      location.hash = '#/services?cache-probe=between';
      const betweenReady = await until(() => document.querySelector('#main-content h1')?.textContent.includes('Dienstleistungen'));
      location.hash = '#/app/dataportal/immobilien?cache-probe=second';
      const reentered = await until(() => location.hash.includes('cache-probe=second')
        && !!document.querySelector('#main-content [aria-busy="true"]'));
      await wait(150);
      const sharedWhilePending = buildingRequests === 1;
      location.hash = '#/services?cache-probe=winner';
      const winnerReady = await until(() => location.hash.includes('cache-probe=winner')
        && document.querySelector('#main-content h1')?.textContent.includes('Dienstleistungen'));
      rejectBuildings?.(new Error('delayed estate buildings rejection'));
      await wait(250);
      const heading = document.querySelector('#main-content h1');
      return {
        firstStarted,
        betweenReady,
        reentered,
        sharedWhilePending,
        winnerReady,
        buildingRequests,
        hash: location.hash,
        heading: heading?.textContent.trim() || '',
        focused: document.activeElement === heading,
        staleErrorVisible: !!document.querySelector('#main-content .notification--error'),
      };
    } finally {
      rejectBuildings?.(new Error('estate cache probe cleanup'));
      window.fetch = originalFetch;
    }
  })()`);
  check(estateResult.firstStarted && estateResult.betweenReady && estateResult.reentered,
    'leave and re-enter both reach the same pending estate load', JSON.stringify(estateResult));
  check(estateResult.sharedWhilePending && estateResult.buildingRequests === 1,
    'concurrent estate renders share one buildings request', JSON.stringify(estateResult));
  check(estateResult.winnerReady
      && estateResult.hash === '#/services?cache-probe=winner'
      && estateResult.heading === 'Dienstleistungen'
      && estateResult.focused
      && !estateResult.staleErrorVisible,
    'the stale cache rejection cannot overwrite the final services route', JSON.stringify(estateResult));
  const estateProblems = await estatePage.problems();
  check(estateProblems.length === 0, 'stale estate rejection emits no browser errors', estateProblems.join(' | '));
  await estatePage.closeTarget();

  console.log('■ Malformed dashboard data keeps accessible terminal views');
  const dataFailurePage = await openPage(cdp, `${APP_BASE}/services`, { login: true });
  const dataFailureResult = await dataFailurePage.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const until = async (test) => {
      for (let i = 0; i < 160; i++) {
        if (test()) return true;
        await wait(50);
      }
      return false;
    };
    await until(() => document.querySelector('#main-content h1')?.textContent.includes('Dienstleistungen'));

    const originalFetch = window.fetch.bind(window);
    const requests = { buildings: 0, dashboards: 0 };
    const malformedResponse = () => Promise.resolve(new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    window.fetch = (input, init = {}) => {
      const url = String(input);
      if (/data\\/buildings\\.geojson(?:$|[?#])/.test(url)) {
        requests.buildings += 1;
        return malformedResponse();
      }
      if (/data\\/dashboards\\.json(?:$|[?#])/.test(url)) {
        requests.dashboards += 1;
        return malformedResponse();
      }
      return originalFetch(input, init);
    };

    const snapshot = () => {
      const heading = document.querySelector('#main-content h1');
      const notification = document.querySelector('#main-content .notification--error');
      return {
        hash: location.hash,
        heading: heading?.textContent.trim() || '',
        headingTabindex: heading?.getAttribute('tabindex') || '',
        focused: document.activeElement === heading,
        notification: notification?.textContent.replace(/[\\s\\u00a0]+/g, ' ').trim() || '',
        notificationRole: notification?.getAttribute('role') || '',
        hasNotificationContent: !!notification?.querySelector('.notification__content'),
      };
    };

    try {
      location.hash = '#/app/dataportal/immobilien?malformed-geojson=1';
      const estateReady = await until(() => {
        const state = snapshot();
        return state.heading === 'Immobilienportfolio'
          && state.notification.includes('Immobilien-Stammdaten konnten nicht geladen werden');
      });
      await wait(100);
      const estate = snapshot();

      location.hash = '#/app/dataportal/energie-klima?malformed-dashboard=1';
      const dashboardReady = await until(() => {
        const state = snapshot();
        return state.heading === 'Datenportal'
          && state.notification.includes('Die Auswertungen konnten nicht geladen werden');
      });
      await wait(150);
      return { requests, estateReady, dashboardReady, estate, dashboard: snapshot() };
    } finally {
      window.fetch = originalFetch;
    }
  })()`);
  check(dataFailureResult.estateReady
      && dataFailureResult.requests.buildings === 1
      && dataFailureResult.estate.heading === 'Immobilienportfolio'
      && dataFailureResult.estate.headingTabindex === '-1'
      && dataFailureResult.estate.focused,
    'malformed estate GeoJSON retains and focuses its Immobilienportfolio H1', JSON.stringify(dataFailureResult.estate));
  check(dataFailureResult.estate.hasNotificationContent
      && dataFailureResult.estate.notificationRole === 'alert'
      && dataFailureResult.estate.notification.includes('Ungültige GeoJSON FeatureCollection: buildings.geojson'),
    'malformed estate GeoJSON renders an explicit validation notification', JSON.stringify(dataFailureResult.estate));
  check(dataFailureResult.dashboardReady
      && dataFailureResult.requests.dashboards === 1
      && dataFailureResult.dashboard.heading === 'Datenportal'
      && dataFailureResult.dashboard.headingTabindex === '-1'
      && dataFailureResult.dashboard.focused,
    'malformed dashboards data retains and focuses its Datenportal H1', JSON.stringify(dataFailureResult.dashboard));
  check(dataFailureResult.dashboard.hasNotificationContent
      && dataFailureResult.dashboard.notificationRole === 'alert'
      && dataFailureResult.dashboard.notification.includes('Die Auswertungen konnten nicht geladen werden')
      && dataFailureResult.dashboard.notification.includes('Ladefehler'),
    'malformed dashboards data renders an explicit load-error notification', JSON.stringify(dataFailureResult.dashboard));
  check(dataFailurePage.exceptions.length === 0 && dataFailurePage.consoleErrors.length === 0,
    'malformed active data has no uncaught rejection or console error',
    [...dataFailurePage.exceptions, ...dataFailurePage.consoleErrors].join(' | '));
  await dataFailurePage.closeTarget();

  console.log('■ Map constructor failure degrades in place');
  // Seed the authenticated origin once, then perform a full navigation. The
  // new-document hook runs before any application module on the target page.
  const mapPage = await openPage(cdp, `${APP_BASE}/services`, { login: true });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    // The authenticated loader intentionally ignores a pre-existing global.
    // Wrap the global assigned by the SRI-verified bundle instead, replacing
    // only its constructor so this remains a post-load initialization probe.
    source: `(() => {
      let loaded;
      Object.defineProperty(window, 'maplibregl', {
        configurable: true,
        get: () => loaded,
        set: (value) => {
          loaded = new Proxy(value, { get(target, property, receiver) {
            if (property === 'Map') return class { constructor() { throw new Error('mock Map constructor failure'); } };
            return Reflect.get(target, property, receiver);
          } });
        },
      });
    })();`,
  }, mapPage.sessionId);
  const freshMapUrl = `${APP_BASE.replace(/#$/, '')}?map-constructor-probe=1#/app/portfolio?view=map`;
  await cdp.send('Page.navigate', { url: freshMapUrl }, mapPage.sessionId);
  let mapResult = null;
  for (let i = 0; i < 200; i++) {
    try {
      mapResult = await mapPage.evaluate(`({
        hash: location.hash,
        heading: document.querySelector('#main-content h1')?.textContent.trim() || '',
        unavailable: !!document.querySelector('#pf-map-el .empty--unavailable'),
        message: document.querySelector('#pf-map-el .empty--unavailable')?.textContent.trim() || '',
      })`);
      if (mapResult.hash === '#/app/portfolio?view=map' && mapResult.unavailable) break;
    } catch { /* full navigation may briefly replace the execution context */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  check(mapResult?.hash === '#/app/portfolio?view=map'
      && mapResult?.heading === 'Liegenschaften Inventar'
      && mapResult?.unavailable
      && mapResult?.message.includes('mock Map constructor failure'),
    'a throwing Map constructor renders the unavailable state on a fresh map route', JSON.stringify(mapResult));
  const mapProblems = await mapPage.problems();
  check(mapProblems.length === 0, 'Map constructor failure is caught without browser errors', mapProblems.join(' | '));
  await mapPage.closeTarget();

  console.log('■ Query identifiers are decoded exactly once');
  const decodePage = await openPage(cdp, `${APP_BASE}/services`, { login: true });
  const decoded = await decodePage.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const { core } = await import('./js/core/index.js');
    const originals = {
      processDoc: core.processDoc,
      businessObject: core.businessObject,
      systemTable: core.systemTable,
    };
    const captured = { processDoc: null, businessObject: null, systemTable: null };
    core.processDoc = (id) => { captured.processDoc = id; return null; };
    core.businessObject = (id) => { captured.businessObject = id; return null; };
    core.systemTable = (id) => { captured.systemTable = id; return null; };
    location.hash = '#/app/process-docs?id=A%252FB';
    for (let i = 0; i < 120 && captured.processDoc === null; i++) await wait(50);
    location.hash = '#/app/metadata-catalog?id=Object%252FOne';
    for (let i = 0; i < 120 && captured.businessObject === null; i++) await wait(50);
    location.hash = '#/app/metadata-catalog?table=Schema%252FTable';
    for (let i = 0; i < 120 && captured.systemTable === null; i++) await wait(50);
    Object.assign(core, originals);
    return captured;
  })()`);
  check(decoded.processDoc === 'A%2FB',
    'process document lookup receives the once-decoded query value', decoded.processDoc);
  check(decoded.businessObject === 'Object%2FOne',
    'business object lookup receives the once-decoded query value', decoded.businessObject);
  check(decoded.systemTable === 'Schema%2FTable',
    'system table lookup receives the once-decoded query value', decoded.systemTable);
  const decodeProblems = await decodePage.problems();
  check(decodeProblems.length === 0, 'decode regression emits no browser errors', decodeProblems.join(' | '));
  await decodePage.closeTarget();

  console.log('■ Deep-link history and repeated lifecycle cycles');
  const historyPage = await openPage(cdp, `${APP_BASE}/applications/liegenschaften-inventar`, { login: false });
  const historyResult = await historyPage.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const until = async (test) => {
      for (let i = 0; i < 120; i++) {
        if (test()) return true;
        await wait(50);
      }
      return false;
    };
    const heading = () => document.querySelector('#main-content h1')?.textContent.trim() || '';
    await until(() => heading() === 'Liegenschaften Inventar (Portal)');
    const initial = { hash: location.hash, heading: heading() };
    location.hash = '#/services';
    await until(() => location.hash === '#/services' && heading() === 'Dienstleistungen');
    history.back();
    await until(() => location.hash === '#/applications/liegenschaften-inventar'
      && heading() === 'Liegenschaften Inventar (Portal)');
    const afterBack = {
      hash: location.hash,
      heading: heading(),
      focused: document.activeElement === document.querySelector('#main-content h1'),
    };

    const NativeResizeObserver = window.ResizeObserver;
    let created = 0;
    let disconnected = 0;
    window.ResizeObserver = class extends NativeResizeObserver {
      constructor(callback) { super(callback); created += 1; }
      disconnect() { disconnected += 1; return super.disconnect(); }
    };
    const destinations = [
      ['#/knowledge', 'Wissen und Hilfsmittel'],
      ['#/services', 'Dienstleistungen'],
      ['#/knowledge', 'Wissen und Hilfsmittel'],
      ['#/services', 'Dienstleistungen'],
      ['#/knowledge', 'Wissen und Hilfsmittel'],
      ['#/services', 'Dienstleistungen'],
      ['#/knowledge', 'Wissen und Hilfsmittel'],
      ['#/services', 'Dienstleistungen'],
      ['#/knowledge', 'Wissen und Hilfsmittel'],
      ['#/services', 'Dienstleistungen'],
    ];
    for (const [hash, title] of destinations) {
      location.hash = hash;
      await until(() => location.hash === hash && heading() === title);
    }
    window.ResizeObserver = NativeResizeObserver;
    return {
      initial,
      afterBack,
      cycles: { created, disconnected, live: created - disconnected },
      final: { hash: location.hash, heading: heading() },
    };
  })()`);
  check(historyResult.initial.hash === '#/applications/liegenschaften-inventar'
      && historyResult.initial.heading === 'Liegenschaften Inventar (Portal)',
    'the application landing page opens as a deep link', JSON.stringify(historyResult.initial));
  check(historyResult.afterBack.hash === historyResult.initial.hash
      && historyResult.afterBack.heading === historyResult.initial.heading
      && historyResult.afterBack.focused,
    'browser Back restores the deep link and its heading focus', JSON.stringify(historyResult.afterBack));
  check(historyResult.cycles.created === 10 && historyResult.cycles.disconnected === 9
      && historyResult.cycles.live === 1,
    'ten route cycles retain exactly one current scroll observer', JSON.stringify(historyResult.cycles));
  check(historyResult.final.hash === '#/services' && historyResult.final.heading === 'Dienstleistungen',
    'repeated navigation ends on the requested route', JSON.stringify(historyResult.final));
  const historyProblems = await historyPage.problems();
  check(historyProblems.length === 0, 'history and lifecycle cycles emit no browser errors', historyProblems.join(' | '));
  await historyPage.closeTarget();
} finally {
  cdp.close();
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
