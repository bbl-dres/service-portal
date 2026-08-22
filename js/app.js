// Bootstrap: load the shared core + process engine, render the federal shell, start the router.
import { core } from './core/index.js';
import { engine } from './process-engine.js';
import { session } from './core/session.js';
import { shell } from './ui/shell/index.js';
import {
  initRouter, redraw, requestNavigationPermission, restoreRouteChrome,
} from './routing/router.js';
import { escape, announce, toast, wireShare, wireLogin, mountBanner } from './components.js';
import { wireBookmarks } from './ui/bookmark.js';
import { notificationHtml } from './ui/components/feedback.js';

// Data-failure banner (P0-4): if a data/*.json file is missing, the affected
// list would look empty rather than unavailable. A persistent banner above the
// content exposes the failure instead of showing a plausible zero.
function renderDataStatus() {
  const el = document.getElementById('data-status');
  if (!el) return;
  // The process engine reports here too. If definitions are missing, NO case can
  // be started; that must be visible before anyone fills in a form (H10).
  const areas = [...core.failedAreas(), ...engine.failedAreas()];
  if (!areas.length) { el.innerHTML = ''; return; }
  // With { live:true }, the container is a named region (index.html), no longer
  // a live region. The notification itself makes the one-time insertion
  // announcement through role="alert" (review a11y-datastatus-1).
  el.innerHTML = `<div class="container" style="padding-top:1rem">${notificationHtml(
    `<strong>Einige Daten konnten nicht geladen werden</strong> (${escape(areas.join(', '))}). `
    + 'Betroffene Listen sind unvollständig oder leer — das ist ein Ladefehler, keine leere Ablage. '
    + '<button type="button" class="link" data-reload-page>Seite neu laden</button>',
    'error', 'WarningCircle', { live: true })}</div>`;
}

async function boot() {
  // Startup now waits only for what the shell needs to render: services and
  // reference (17 KB, 2 requests). The router fetches everything else per route
  // through `needs`.
  //
  // Eleven datasets (275 KB, 13 requests) previously blocked the first pixel.
  // Under throttling, first content took 7.7 s even on knowledge pages that read
  // no data (docs/code-review.md §1).
  //
  // The process engine remains in startup because the personal-cases page must
  // not see a half-loaded case list. It derives definitions from the core's
  // cached processes dataset, so later process routes reuse the startup request.
  await Promise.all([core.load(), engine.load(core)]);
  // Deferred datasets (core.ensure) can fail after the banner was rendered.
  // Without this listener, such a failure would remain invisible.
  window.addEventListener('core:data-failed', renderDataStatus);
  window.addEventListener('core:data-loaded', (event) => {
    renderDataStatus();
    // A deferred retry can recover the shared process registry after startup.
    // Refresh the engine too; otherwise its failed definition snapshot would
    // remain stale until a full page reload even though process pages recovered.
    if (event.detail?.key === 'processes') {
      void engine.load(core).then(renderDataStatus)
        .catch((error) => console.error('[app] process recovery failed', error));
    }
  });
  const header = document.getElementById('main-header');
  shell.renderHeader(header);
  shell.renderFooter(document.getElementById('main-footer'));
  renderDataStatus();
  // Wire the share dialog ONCE through delegation. Every page with a share bar
  // gets it without local work, and it survives route changes because the
  // listener lives on document.
  wireShare(document);
  // Wire login buttons globally ONCE as well. They appear in the header, every
  // login notice and access cards, and each may carry a target
  // (data-login-next).
  wireLogin(document);
  // Same contract for the «merken» stars: delegated ONCE, so every page that
  // renders one is wired, and every control for the same record updates together
  // (a record can carry a star in its head and a button in its access card).
  wireBookmarks(document);
  // Prototype notice as a CD consent strip. Once dismissed, it stays dismissed.
  mountBanner(document.getElementById('banner-host'), {
    id: 'prototyp',
    // Word for word the footer's note (ui/shell/footer.js). The strip is
    // dismissible and the footer is not, so the same caveat has to survive in
    // both places — and a reader who meets it twice should not have to work out
    // whether the second version says something new.
    // Emphasis on the WHOLE lead sentence — the tenant portal's strip bolds
    // «Diese Anwendung ist ein Prototyp.» as the notice's title sentence, and
    // the two strips should read identically (alignment D42).
    html: '<strong>Diese Anwendung ist ein Prototyp.</strong> Darstellung, Funktionalität und Inhalte dienen ausschliesslich der Demonstration; die verwendeten Daten sind fiktiv oder öffentlich zugänglich.',
    actionLabel: 'Verstanden',
    variant: 'info',   // CD requirement for this component (NotificationBanner.vue:51)
    label: 'Hinweis zum Prototyp',
  });
  initRouter();

  // AGOV / FedLogin stub: login and logout redraw the header and current page so
  // login state and case notices stay correct everywhere. There is no role or
  // permissions model, only the start-case user flow. The redraw destroys
  // the triggering button, which used to drop focus onto <body> without an
  // announcement. It now sends a status message to the live region and restores
  // focus to the newly rendered authentication button (item 3.7).
  let refreshId = 0;
  const refresh = async (message, next = '') => {
    const ownRefresh = ++refreshId;
    const startHash = location.hash;
    shell.renderHeader(header);
    // Login WITH a target starts where the start-case action would otherwise appear,
    // so the button performs both actions. Navigation replaces the redraw:
    // `hashchange` invokes the router, which focuses the new heading. That is the
    // correct location announcement here («you are now in the form»), not the
    // header login button. Only portal-internal routes are accepted; after the
    // `await`, an external target could not open without a popup blocker anyway.
    if (next && next.startsWith('#/')) {
      announce(message);
      if (next === location.hash) await redraw();   // No hashchange: redraw explicitly.
      else location.hash = next;
      return;
    }
    await redraw();          // Wait first: the router sets focus when it finishes.
    if (ownRefresh !== refreshId) return false;
    announce(message);
    // A navigation that superseded this redraw owns focus. The session change
    // remains announced, but the late auth refresh must not steal focus from
    // the newly requested route.
    if (location.hash !== startHash) return true;
    const button = header.querySelector('.meta-navigation--desktop .meta-navigation__auth')
             || header.querySelector('.meta-navigation__auth');
    if (button) button.focus({ preventScroll: true });
    return true;
  };
  window.addEventListener('session:changed', () => {
    const ownRefresh = ++refreshId;
    shell.renderHeader(header);
    // Cross-tab authentication changes cannot be revoked locally, so the header
    // reflects them immediately. Replacing the route is separate: an editor may
    // still need to protect unsaved work before showing the new access state.
    if (!requestNavigationPermission(location.hash || '#/', 'session-storage')) {
      restoreRouteChrome();
      announce(session.isLoggedIn()
        ? 'Die Anmeldung aus einem anderen Tab wurde übernommen. Die aktuelle Bearbeitung bleibt geöffnet.'
        : 'Die Sitzung wurde in einem anderen Tab beendet. Die aktuelle Bearbeitung bleibt geöffnet.');
      return;
    }
    void redraw().then(() => {
      if (ownRefresh !== refreshId) return;
      announce(session.isLoggedIn()
        ? 'Die Anmeldung aus einem anderen Tab wurde übernommen.'
        : 'Die Sitzung wurde in einem anderen Tab beendet.');
    }).catch((error) => console.error('[app] cross-tab session refresh failed', error));
  });
  window.__login = (next = '') => {
    const user = session.login();
    if (!user) {
      toast('Die Anmeldung konnte auf diesem Gerät nicht gespeichert werden. Bitte prüfen Sie die Browser-Einstellungen.', 'error', 'WarningCircle');
      return Promise.resolve(false);
    }
    return refresh(`Angemeldet als ${user ? user.name : ''}.${next ? '' : ' Die Seite wurde aktualisiert.'}`, next);
  };
  window.__logout = () => {
    // A guarded application may own unsaved state. Ask before changing the
    // session or header: checking only inside redraw() would be too late because
    // the logout mutation itself changes what the current route is allowed to
    // render.
    if (!requestNavigationPermission(location.hash || '#/', 'session-logout')) {
      return Promise.resolve(false);
    }
    if (!session.logout()) {
      toast('Die Abmeldung konnte auf diesem Gerät nicht gespeichert werden. Bitte versuchen Sie es erneut.', 'error', 'WarningCircle');
      return Promise.resolve(false);
    }
    return refresh('Abgemeldet. Die Seite wurde aktualisiert.');
  };
  // Test-only access to the process engine without running a form. This is the
  // only way to prove that start() rejects an unknown definition instead of
  // inventing one (H10).
  window.__engine = engine;
}

// Deliberately NOT rendered through C.notification (unlike other error banners,
// §2.6): this is the last-resort handler. If startup fails inside a component,
// calling that component again in catch could throw again and leave the user
// with a blank page. `escape` alone is a dependency-free pure function.
boot().catch(error => {
  console.error('[app] boot failed', error);
  document.getElementById('main-content').innerHTML =
    `<div class="container section"><div class="notification notification--error">Die Anwendung konnte nicht gestartet werden: ${escape(error.message)}</div></div>`;
});
