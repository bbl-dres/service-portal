// Hash router. Each section page lives in js/pages/<name>.js; each micro-app in
// js/apps/<name>.js. Modules default-export: async function render(ctx).
// ctx = { mount, params, query, core, engine, session, C, navigate, setTitle, setCrumbs }

import { core } from '../core/index.js';
import { engine } from '../process-engine.js';
import { session } from '../core/session.js';
import C from '../components.js';
import { safeLinkUrl } from '../security/urls.js';
import { loadAppStyles } from './css-loader.js';
import {
  APPS, APP_GATE_META, NAV, PAGES, SECTION_OF, crumbChildren, legacyTarget, parseHash,
} from './routes.js';

export { NAV, legacyTarget };

// Route modules may protect transient work (for example an unsaved editor
// draft) without owning global click/history listeners. Blockers are
// deliberately synchronous: browsers only allow a synchronous decision while
// restoring same-document history after Back/Forward navigation.
const navigationBlockers = new Set();
let acceptedRoute = null;
let approvedHash = '';
let restoringHash = '';

const routeSnapshot = () => ({ hash: location.hash || '#/', state: history.state });

function rememberCurrentRoute() {
  acceptedRoute = routeSnapshot();
}

function mayNavigate(to, source = 'route') {
  const from = acceptedRoute?.hash || location.hash || '#/';
  for (const blocker of navigationBlockers) {
    try {
      if (blocker({ from, to, source }) === false) return false;
    } catch (error) {
      // A broken guard must not trap somebody permanently inside a route.
      console.warn('[router] navigation blocker failed', error);
    }
  }
  return true;
}

/**
 * Ask every active route blocker for synchronous permission before an external
 * state change would invalidate the mounted route. Session logout uses this
 * before mutating authentication state; normal route changes use the same
 * decision path through `navigateRoute`/`hashchange`.
 */
export function requestNavigationPermission(to = location.hash || '#/', source = 'programmatic') {
  return mayNavigate(String(to || location.hash || '#/'), source);
}

/** Register a synchronous route-leave guard. Returns an idempotent disposer. */
function registerNavigationBlocker(blocker) {
  if (typeof blocker !== 'function') throw new TypeError('Navigation blocker must be a function.');
  navigationBlockers.add(blocker);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    navigationBlockers.delete(blocker);
  };
}

/** Replace query/route state without dispatching and keep guard restoration current. */
function replaceRoute(href) {
  history.replaceState(history.state, '', href);
  rememberCurrentRoute();
}

/** Navigate through the same blocker path used by route links. */
function navigateRoute(href, source = 'programmatic') {
  const target = String(href || '');
  if (!target || target === location.hash) return true;
  if (!requestNavigationPermission(target, source)) return false;
  approvedHash = target;
  location.hash = target;
  return true;
}

function restoreAcceptedRoute() {
  if (!acceptedRoute) return;
  const currentIdx = history.state?.bblIdx;
  const acceptedIdx = acceptedRoute.state?.bblIdx;
  if (Number.isInteger(currentIdx) && Number.isInteger(acceptedIdx) && currentIdx !== acceptedIdx) {
    restoringHash = acceptedRoute.hash;
    // Router-owned entries are stamped consecutively. Restore the complete
    // distance so history-menu jumps and multi-entry history.go() calls return directly to the
    // still-mounted accepted route without intermediate prompts/dispatches.
    history.go(acceptedIdx - currentIdx);
    return;
  }
  // A direct `location.hash = ...` entry may not have its own router index yet.
  // Replacing that rejected entry preserves the mounted route and its state.
  history.replaceState(acceptedRoute.state, '', acceptedRoute.hash);
}


function setActiveNav(base) {
  document.querySelectorAll('[data-nav]').forEach(a => {
    const on = a.getAttribute('data-nav') === base;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  setActiveSubNav();
}

// Does a dropdown entry describe the route we are on? The header is rendered
// once, so this has to be recomputed on every dispatch — otherwise the drawer
// keeps highlighting whatever was open when the page first loaded.
function matchesSubNav(childHref, currentHash) {
  const split = (h) => {
    const [path, qs] = String(h || '').split('?');
    return { path, params: new URLSearchParams(qs || '') };
  };
  const child = split(childHref);
  const here = split(currentHash || '#/');
  if (child.path !== here.path) return false;

  const childKeys = [...child.params.keys()];
  // The knowledge overview must not light up on #/knowledge/news …
  if (!childKeys.length) return ![...here.params.keys()].length;
  // … while #/services?topic=bauten stays active once &view=liste is appended.
  return childKeys.every(k => {
    const want = (child.params.get(k) || '').split(',').filter(Boolean);
    const have = (here.params.get(k) || '').split(',').filter(Boolean);
    return want.every(v => have.includes(v));
  });
}

function setActiveSubNav() {
  const hash = location.hash || '#/';
  document.querySelectorAll('[data-navsub]').forEach(a => {
    const on = matchesSubNav(a.getAttribute('data-navsub'), hash);
    a.closest('.menu__item')?.classList.toggle('menu__item--active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

// CD breadcrumb: <ul> rows, the chevron inside the link (breadcrumb.postcss:5-70).
//
// A segment that names a section also opens that section's pages
// (breadcrumb.postcss:93-113). DELIBERATE DEVIATION from CD in two places, both
// about the control rather than the look:
//
//  · CD hangs the toggle on the crumb's own <a> and calls preventDefault
//    (BreadcrumbNav.js:22-23), so the link stops linking — the one thing a
//    breadcrumb is for. Here the link still navigates and the CHEVRON is a real
//    <button>, which is also what CD's own styling already implies: it draws a
//    bordered box around just the chevron (breadcrumb.postcss:46-51).
//  · CD's script sets no aria-expanded, has no Escape and no keyboard path at
//    all. This portal owes WCAG 2.1 AA, so the button carries the state and
//    wireCrumbDropdowns() below carries the rest.
function renderCrumbs(crumbs) {
  const ul = document.getElementById('breadcrumb-list');
  const wrap = document.getElementById('breadcrumb');
  if (!ul || !wrap) return;
  if (!crumbs || !crumbs.length) { wrap.hidden = true; ul.innerHTML = ''; return; }
  wrap.hidden = false;
  const here = location.hash || '#/';
  ul.innerHTML = crumbs.map((c, i) => {
    const last = i === crumbs.length - 1;
    const sep = i > 0 ? C.icon('ChevronRight', 'breadcrumb__include-icon') : '';
    const href = safeLinkUrl(c.href);
    // The trail's last item deliberately carries no href (crumbs.js) — it IS the
    // current page, so the address to resolve its siblings by is the one in the
    // bar. Without this the current crumb could never have a dropdown, which is
    // exactly where CD does put one.
    const children = crumbChildren(c.href || (last ? here : ''));
    // The head of the crumb: a link when it goes somewhere else, plain text when
    // it is where we already are. Both get the same disclosure beside them.
    const head = last
      ? `<span aria-current="page">${sep}<span>${C.escape(c.label)}</span></span>`
      : href
        ? `<a href="${C.escape(href)}">${sep}<span>${C.escape(c.label)}</span></a>`
        : `<span aria-disabled="true">${sep}<span>${C.escape(c.label)}</span></span>`;
    if (!children.length) return `<li>${head}</li>`;
    const panelId = `crumb-menu-${i}`;
    // The open page is marked in its own dropdown (CD `.active`, a 2px bar), so
    // the list doubles as «where am I among these».
    const rows = children.map((child) => {
      const childHref = safeLinkUrl(child.href) || '#/';
      const active = here === child.href;
      return `<li><a class="menu__item menu__item--mini menu__item--border${active ? ' active' : ''}"
        href="${C.escape(childHref)}"${active ? ' aria-current="page"' : ''}>${C.escape(child.label)}</a></li>`;
    }).join('');
    return `<li>${head}<button type="button" class="breadcrumb__dropdown" aria-expanded="false"
        aria-controls="${panelId}" aria-label="Bereich ${C.escape(c.label)} anzeigen"><span
        class="breadcrumb__dropdown-box">${
        C.icon('ChevronDown', 'breadcrumb__dropdown-icon')}</span></button>
      <ul id="${panelId}" hidden>${rows}</ul></li>`;
  }).join('');
}

// One delegated wiring for every dropdown the breadcrumb will ever render.
// renderCrumbs() replaces the list on each navigation, so per-button listeners
// would have to be re-attached every time; the container outlives all of them.
function wireCrumbDropdowns() {
  const wrap = document.getElementById('breadcrumb');
  if (!wrap) return;
  const close = (button) => {
    button.setAttribute('aria-expanded', 'false');
    button.nextElementSibling?.setAttribute('hidden', '');
  };
  const closeAll = () => wrap.querySelectorAll('.breadcrumb__dropdown[aria-expanded="true"]').forEach(close);
  wrap.addEventListener('click', (event) => {
    const button = event.target.closest('.breadcrumb__dropdown');
    if (!button) return;
    const open = button.getAttribute('aria-expanded') === 'true';
    closeAll();   // CD keeps at most one open (BreadcrumbNav.js:28-30).
    if (open) return;
    button.setAttribute('aria-expanded', 'true');
    button.nextElementSibling?.removeAttribute('hidden');
  });
  // Escape returns focus to the control that opened the panel; without that the
  // keyboard user is left on an element that just became hidden.
  //
  // Look the open button up from the CONTAINER, not from the event target. The
  // rows are `<li>` inside the panel's `<ul>`, itself inside the segment's
  // `<li>`, so `closest('li')` from a focused row returns the row — which has no
  // button, and Escape silently did nothing.
  wrap.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const button = wrap.querySelector('.breadcrumb__dropdown[aria-expanded="true"]');
    if (!button) return;
    close(button);
    button.focus();
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#breadcrumb')) closeAll();
  });
  // Following a row navigates, and the panel must not survive into the next page.
  window.addEventListener('hashchange', closeAll);
}

function makeCtx(mount, params, query, stale, lifecycle, signal) {
  return {
    mount, params, query, core, engine, session, C, signal,
    // Cleanup on route exit. The router previously replaced only
    // `mount.innerHTML`, allowing maps, observers, media-query listeners and
    // overlays to outlive their creating route. Anything that survives a DOM
    // replacement registers its disposer here.
    onUnmount: lifecycle.onUnmount,
    // Async pages that `await` before writing (for example dynamic-import
    // delegates) check `ctx.stale()` immediately before `mount.innerHTML =`, so
    // a superseded navigation cannot overwrite the newer page (A2).
    stale: stale || (() => false),
    navigate: (h) => navigateRoute(h),
    replaceRoute,
    blockNavigation: registerNavigationBlocker,
    setTitle: (t) => { document.title = t ? `${t} · BBL Kundenportal` : 'BBL Kundenportal'; },
    setCrumbs: renderCrumbs,
  };
}

// SPA route changes are a context change: move focus to the new page heading so
// screen-reader and keyboard users are not silently returned to the document top.
function focusHeading(mount) {
  const h = mount.querySelector('h1') || mount;
  if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
  h.focus({ preventScroll: true });
}

// Page modules load asynchronously, so two quick hash changes can render out of
// order. Every dispatch takes a ticket; the router drops a stale render's own
// post-write steps (module load, focus, scroll). A page that itself `await`s
// before writing (the dynamic-import delegators applications.js / data.js) must
// additionally check `ctx.stale()` right before `mount.innerHTML =`, or its late
// write overwrites the newer page (code-review A2).
let dispatchId = 0;
let mountedPath = null;

// --- Scroll strategy (review request 2026-07) -------------------------------
// CD itself defines no scroll behaviour. Its reference stack (Nuxt) follows the
// platform standard, now used here too:
//   · NEW navigation (new history entry)       → page top
//   · Back/Forward (known entry)               → remembered position
//   · state-only change (same path)            → position untouched
// Each history entry receives an index in history.state on first visit;
// positions are stored per index in sessionStorage and survive reload. Browsers
// restore NOTHING for same-document hash navigation themselves. Without this,
// «Back» from a detail view moved the list to its beginning.
const SCROLL_KEY = 'bbl_scroll_v1';
let lastEntryIdx = null;
const scrollMap = () => { try { return JSON.parse(sessionStorage.getItem(SCROLL_KEY)) || {}; } catch { return {}; } };
function saveLeavingScroll() {
  if (lastEntryIdx == null) return;
  try {
    const m = scrollMap(); m[lastEntryIdx] = window.scrollY;
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(m));
  } catch { /* Blocked storage: continue without restoration. */ }
}
// Index the CURRENT entry if new and return its restoration position, or null
// for «new entry, scroll to top».
function stampHistoryEntry() {
  const known = Number.isInteger(history.state?.bblIdx);
  let idx;
  if (known) { idx = history.state.bblIdx; }
  else {
    const highestIdx = Number(sessionStorage.getItem(SCROLL_KEY + '_n') || 0);
    // A new navigation after Back prunes the forward branch. Reuse the next
    // positional index instead of the global high-water mark so bblIdx remains
    // a real history offset and rejected multi-entry jumps can be restored in
    // one history.go(delta) call.
    idx = Number.isInteger(lastEntryIdx)
      ? lastEntryIdx + 1
      : (Number.isFinite(highestIdx) ? highestIdx : 0) + 1;
    try {
      // Reusing a positional index after pruning the forward branch must not
      // inherit that discarded entry's saved scroll position.
      const positions = scrollMap();
      for (const key of Object.keys(positions)) {
        if (Number(key) >= idx) delete positions[key];
      }
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify(positions));
      sessionStorage.setItem(SCROLL_KEY + '_n', String(Math.max(highestIdx || 0, idx)));
      history.replaceState({ bblIdx: idx }, '');
    } catch { /* Without a stamp, retain the scroll-to-top default. */ }
  }
  lastEntryIdx = idx;
  return known ? (scrollMap()[idx] ?? 0) : null;
}
// The current view's scroll-region observers are detached at dispatch start so
// they never retain nodes replaced by an early gate, not-found or error view.
let unwireScroll = null;
// Lifecycle for the visible or still-loading dispatch. A superseding dispatch
// closes it immediately. If stale route code registers a disposer afterwards,
// onUnmount executes it at once instead of leaking it in an orphaned array.
let activeDispatch = null;

function runRouteCleanup(fn) {
  try { fn(); } catch (error) { console.warn('[router] cleanup failed', error); }
}

function createRouteLifecycle(stale) {
  const cleanups = [];
  let active = true;
  return {
    onUnmount(fn) {
      if (typeof fn !== 'function') return;
      if (!active || stale()) { runRouteCleanup(fn); return; }
      cleanups.push(fn);
    },
    dispose() {
      if (!active) return;
      active = false;
      for (const fn of cleanups.splice(0)) runRouteCleanup(fn);
    },
  };
}

function finalizeRoute({ mount, stale, pathKey, isStateChange, activeId, previousHeading, restoreY }) {
  if (stale()) return false;

  // All terminal route outcomes own the same post-render contract. This also
  // wires gate, not-found and error views, which used to return before scroll
  // observers, focus and scroll position were finalised.
  unwireScroll = C.wireScrollRegions(mount);
  if (isStateChange) {
    const heading = mount.querySelector('h1')?.textContent || '';
    if (restoreY != null) {
      window.scrollTo({ top: restoreY, behavior: 'instant' });
      focusHeading(mount);
    } else if (heading && heading !== previousHeading) {
      window.scrollTo({ top: mount.getBoundingClientRect().top + window.scrollY, behavior: 'instant' });
      focusHeading(mount);
    } else {
      const active = activeId ? document.getElementById(activeId) : null;
      if (active) active.focus({ preventScroll: true });
      else focusHeading(mount);
    }
  } else {
    window.scrollTo({ top: restoreY != null ? restoreY : 0, behavior: 'instant' });
    focusHeading(mount);
  }
  mountedPath = pathKey;
  return true;
}

// Login gate for a domain app. Its name comes from the application catalogue,
// not the router, so load that catalogue on demand (only while logged out, thus
// rarely). Without it, retain a neutral heading; a missing label must never
// bypass the gate. Returns `true` when the gate was rendered.
async function renderAppLoginGate(mount, name, stale, text = '') {
  await core.ensure(['applications']);
  if (stale()) return true;
  const target = `#/app/${name}`;
  const app = core.applications().find((a) => String(a.link?.href || '').split('?')[0] === target);
  const fallback = APP_GATE_META[name];
  const title = app ? app.name : (fallback?.title || 'Anwendung');
  document.title = `${title} · BBL Kundenportal`;
  // Return to the landing page, where anyone can read what the app does, who may
  // use it and how to obtain an account.
  const back = app ? `#/applications/${encodeURIComponent(app.appId)}` : (fallback?.back || '#/applications');
  const backLabel = app ? 'Beschreibung der Anwendung' : (fallback?.backLabel || 'Anwendungen');
  mount.innerHTML = `<div class="container section">
    ${C.backLink(back, backLabel)}
    <div class="page-header"><h1 tabindex="-1">${C.escape(title)}</h1></div>
    ${C.loginGate(text || 'Diese Fachanwendung arbeitet mit Betriebsdaten des BBL. Melden Sie sich mit AGOV / FedLogin an, um sie zu öffnen. '
      + 'Was die Anwendung tut und wer sie nutzen darf, steht frei zugänglich auf ihrer Beschreibungsseite.')}
  </div>`;
  return true;
}

async function dispatch() {
  const ticket = ++dispatchId;
  const stale = () => ticket !== dispatchId;

  // Supersede in-flight work before touching the new route. Core-owned cache
  // loads deliberately have no dispatch signal and continue to populate the
  // shared cache; route-owned requests receive the controller below.
  if (activeDispatch) {
    activeDispatch.controller.abort();
    activeDispatch.lifecycle.dispose();
    activeDispatch = null;
  }
  if (unwireScroll) { unwireScroll(); unwireScroll = null; }

  const controller = new AbortController();
  const lifecycle = createRouteLifecycle(stale);
  activeDispatch = { ticket, controller, lifecycle };

  // Standalone domain tools (for example the floor-plan editor) must not carry
  // compact workspace chrome into the next portal route. Reactivate that layout
  // only AFTER the central login gate so a logged-out deep link still shows the
  // normal portal explanation.
  document.body.classList.remove('body--standalone-app');
  // Viewers and modals are appended to <body>, outside #main-content. Close
  // them before route cleanup/replacement so no stale overlay or global
  // listener survives navigation.
  C.closeOverlays();
  // Legacy path? REPLACE the address rather than appending it. Otherwise «Back»
  // reaches the old path and immediately returns here (an endless loop).
  // replaceState does not fire `hashchange`, so this dispatch continues and
  // renders the target; parseHash() reads the replaced address.
  const redirect = legacyTarget(location.hash);
  if (redirect) { try { history.replaceState(history.state, '', redirect); } catch { location.hash = redirect; } }

  // During hashchange, the DOM still contains the DEPARTED page. Save its
  // position now, then stamp or look up the new entry.
  saveLeavingScroll();
  const restoreY = stampHistoryEntry();
  // `stampHistoryEntry` may have replaced history.state. Store the final
  // accepted entry so a rejected Back/Forward navigation can return here.
  rememberCurrentRoute();
  const { segs, query } = parseHash();
  const mount = document.getElementById('main-content');

  // Distinguish a state change (query only, same page) from real navigation. A
  // state change must NOT move focus to h1 (WCAG 3.2.2) or scroll to the top;
  // instead restore the initiating control path by ID.
  const pathKey = segs.join('/');
  const isStateChange = mountedPath !== null && mountedPath === pathKey;
  const activeId = isStateChange && document.activeElement && mount.contains(document.activeElement)
    ? document.activeElement.id : '';
  // H1 from the DEPARTED view, used below to detect drill-in.
  const prevH1 = isStateChange ? (mount.querySelector('h1')?.textContent || '') : '';

  let modPath, params, navBase;

  if (segs[0] === 'app') {
    const name = segs[1];
    modPath = APPS[name];
    params = segs.slice(2);
    navBase = SECTION_OF[name] || '';
  } else {
    const base = segs[0] || '';
    modPath = PAGES[base];
    params = segs.slice(1);
    navBase = SECTION_OF[base] || base;
  }

  setActiveNav(navBase);
  document.getElementById('breadcrumb').hidden = true;

  // --- Domain-app login gate (user decision 2026-08-06) ---------------------
  // A domain app is a system with real operational data, not catalogue content;
  // access requires login. Anything that DESCRIBES remains OPEN: application
  // landing pages (#/applications/<id>), the service catalogue, knowledge, news
  // and data access.
  //
  // The gate lives here, not in apps. Five of seventeen implemented it while
  // twelve did not, and a forgotten gate is invisible from the outside. A
  // central gate also covers every future app. Each app still provides its own
  // WORDING (`loginText`), which is more informative than one generic sentence.
  // It is read below after importing the module.
  const gated = segs[0] === 'app' && modPath && !session.isLoggedIn();

  if (!modPath) {
    document.title = 'Seite nicht gefunden · BBL Kundenportal';
    mount.innerHTML = `<div class="container section"><div class="page-header"><h1 tabindex="-1">Seite nicht gefunden</h1></div>
      <p class="muted">Diese Seite existiert nicht. <a href="#/">Zur Startseite</a></p></div>`;
    finalizeRoute({ mount, stale, pathKey, isStateChange, activeId, previousHeading: prevH1, restoreY });
    return;
  }

  // No loading flash on state-only changes because the module is cached. For
  // loading, use a real status region with aria-busy and an indicator rather than
  // a bare paragraph (item 3.17). Visible text is sr-only; the spinner conveys it
  // visually. ANNOUNCEMENT uses the persistent live region: a role=status region
  // created WITH content does not fire (components.js, item 3.9). H1 focus after
  // render signals completion (review a11y-loading-1).
  if (!isStateChange) {
    C.announce('Inhalt wird geladen…');
    mount.innerHTML = `<div class="container section" aria-busy="true">`
      + C.loading({ label: 'Inhalt wird geladen…', hideLabel: true, size: '2xl' }) + `</div>`;
  }
  try {
    // Start module and route-CSS fetches together, but do not paint app markup
    // until both are ready. Logged-out gates use only the static component layer.
    const appName = segs[0] === 'app' ? segs[1] : '';
    const [mod] = await Promise.all([
      import(modPath),
      appName && !gated ? loadAppStyles(appName) : Promise.resolve(),
    ]);
    if (stale()) return;
    // Login gate BEFORE `needs`: an app nobody may open need not load its
    // datasets (the inventory alone is 66 KB).
    if (gated) {
      await renderAppLoginGate(mount, segs[1], stale, mod.loginText);
      if (!stale()) finalizeRoute({
        mount, stale, pathKey, isStateChange, activeId, previousHeading: prevH1, restoreY,
      });
      return;
    }
    if (mod.layout === 'standalone') document.body.classList.add('body--standalone-app');
    const render = mod.default;
    if (typeof render !== 'function') throw new Error('Modul exportiert kein render()');
    // Deferred datasets (H4): the module declares what it will read through
    // `needs` and receives it BEFORE first access. A resolver may derive the list
    // from route parameters when a module delegates several subviews. On the
    // second visit the promise is fulfilled and adds no delay.
    const routeNeeds = typeof mod.needs === 'function' ? mod.needs(params, query) : mod.needs;
    if (Array.isArray(routeNeeds) && routeNeeds.length) {
      await core.ensure(routeNeeds);
      if (stale()) return;
    }
    const ctx = makeCtx(mount, params, query, stale, lifecycle, controller.signal);
    await render(ctx);
    if (stale()) return;
    finalizeRoute({ mount, stale, pathKey, isStateChange, activeId, previousHeading: prevH1, restoreY });
  } catch (e) {
    if (stale()) return;
    controller.abort();
    lifecycle.dispose();
    document.body.classList.remove('body--standalone-app');
    console.error('[router] render failed for', modPath, e);
    mount.innerHTML = `<div class="container section">
      <div class="page-header"><h1 tabindex="-1">Diese Ansicht konnte nicht geladen werden.</h1></div>
      ${C.notificationHtml(
      `<span class="small">${C.escape(e.message)}</span>`,
      'error', 'WarningCircle', { live: true })}</div>`;
    finalizeRoute({ mount, stale, pathKey, isStateChange, activeId, previousHeading: prevH1, restoreY });
  }
}

export function initRouter() {
  // Delegated ONCE on the breadcrumb container, which outlives every list
  // renderCrumbs() puts inside it.
  wireCrumbDropdowns();
  // Only `#/…` is a route. Bare `#` and in-page fragments (e.g. the skip link's
  // `#main-content`) must not dispatch — that used to render a 404 over the page.
  // Bare `#` placeholder links and in-page anchors must not dispatch. An empty
  // hash otherwise silently returned to the home page (docs/design-review.md P0-1).
  // When a guarded route is mounted, route links go through the blocker before
  // the browser mutates history. Direct hash writes and Back/Forward are caught
  // by the hashchange path below.
  document.addEventListener('click', (event) => {
    if (!navigationBlockers.size || event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.('a[href]');
    if (!anchor || anchor.target && anchor.target !== '_self' || anchor.hasAttribute('download')) return;
    const target = anchor.getAttribute('href') || '';
    if (!target.startsWith('#/') || target === location.hash) return;
    event.preventDefault();
    navigateRoute(target, 'link');
  }, true);

  window.addEventListener('hashchange', () => {
    if (!location.hash.startsWith('#/')) return;
    if (restoringHash) {
      if (location.hash === restoringHash) {
        restoringHash = '';
        approvedHash = '';
        return;
      }
      restoringHash = '';
    }
    if (approvedHash === location.hash) {
      approvedHash = '';
      dispatch();
      return;
    }
    approvedHash = '';
    if (!mayNavigate(location.hash, 'history')) {
      restoreAcceptedRoute();
      return;
    }
    dispatch();
  });
  // When assigning `location.hash`, hashchange dispatches through the else path;
  // an additional explicit dispatch() would render the home page twice.
  if (!location.hash || !location.hash.startsWith('#/')) location.hash = '#/';
  else dispatch();
}

// Redraw the current route without navigating, for example after login/logout so
// its login notice disappears or appears. Returns the dispatch promise:
// `dispatch()` is async (dynamic import), and callers that set focus afterwards
// must wait or the router's focus step will overwrite theirs moments later.
export function redraw() { return dispatch(); }
