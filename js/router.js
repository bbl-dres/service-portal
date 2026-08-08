// Hash router. Each section page lives in pages/<name>.js; each micro-app in
// apps/<name>/index.js. Modules default-export: async function render(ctx).
// ctx = { mount, params, query, core, engine, session, C, navigate, setTitle, setCrumbs }

import { core } from './core.js';
import { engine } from './process-engine.js';
import { session } from './session.js';
import C from './components.js';
import { loadAppStyles } from './css-loader.js';

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
export function registerNavigationBlocker(blocker) {
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
export function replaceRoute(href) {
  history.replaceState(history.state, '', href);
  rememberCurrentRoute();
}

/** Navigate through the same blocker path used by route links. */
export function navigateRoute(href, source = 'programmatic') {
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

// Overview is deliberately no longer an L1 item; the logo reaches the home
// page. The five intranet task areas (office equipment, etc.) are not separate
// L1 items but sub-branches in the service drawer (CD navy drill-down; shell.js).
export const NAV = [
  {
    path: '#/services',
    base: 'services',
    label: 'Dienstleistungen',
    icon: 'Briefcase',
    // CD drawer: overview (the gallery by area), then one row per domain; each
    // sets the catalogue's topic filter. Domains resolve from the data core at
    // render time (shell.js), preventing menu drift.
    children: [{ href: '#/services', label: 'Übersicht' }],
    childrenFrom: 'topics',
  },
  {
    path: '#/data',
    base: 'data',
    label: 'Daten und Digitalisierung',
    icon: 'FileDatabase',
    // CD pattern: an overview section first, then the areas it contains.
    // The data portal and full application catalogue are available through the
    // overview rather than the menu. Building documentation and the media
    // library appear in the application catalogue (#/applications?area=buildings)
    // and overview, keeping the menu short.
    children: [
      { href: '#/data', label: 'Übersicht' },
      // «Digitalisierung» is a drill-down branch (CD navy) with its own L2 pages.
      { label: 'Digitalisierung', branchKey: 'digitalisation', branches: [
        { href: '#/data/digitalisation', label: 'Übersicht' },
        { href: '#/data/digitalisation/strategy', label: 'Digitalisierungsstrategie' },
        { href: '#/data/digitalisation/vision', label: 'Vision' },
        { href: '#/data/digitalisation/principles', label: 'Prinzipien' },
      ] },
      { href: '#/app/dataportal', label: 'Datenportal' },
      { href: '#/data/catalog', label: 'Datenbezug und API Verzeichnis' },
      // The metadata catalogue is deliberately NOT in the menu. It is a data-
      // management tool rather than an everyday destination, available through
      // the application catalogue and data overview.
      { href: '#/applications?area=buildings', label: 'Fachanwendungen Bauten' },
      { href: '#/applications?area=logistics', label: 'Fachanwendungen Logistik' },
      // Shared federal-administration applications: eGate, InfoPers, SAP ERP,
      // Admin Directory and federal platforms I14Y, TERMDAT, Geoportal,
      // geocat.ch and simap.ch. They are not owned by the BBL but are used here
      // daily; without this entry, only people who proactively filter the
      // application catalogue would find them.
      { href: '#/applications?area=federal', label: 'Fachanwendungen Bundesverwaltung' },
    ],
  },
  // Knowledge and resources carries the reference layer: standards, templates,
  // guidance and processes. News is separate (docs/sitemap.md §2.1): a news item
  // is read once, while a tool is reused.
  {
    path: '#/knowledge',
    base: 'knowledge',
    label: 'Wissen und Hilfsmittel',
    icon: 'Book',
    // Grouped by SUBJECT AREA, not material type: tools are needed where work
    // happens. Legacy content placed toolkits and templates under «Informatik»
    // and BKB documents under «Beschaffen» (docs/legacy-analysis.md). Material
    // types are sections WITHIN the subject page; its table of contents provides
    // the third level.
    children: [
      { href: '#/knowledge', label: 'Übersicht' },
      { href: '#/knowledge/it', label: 'Informatik und IKT-Beschaffung' },
      { href: '#/knowledge/procurement', label: 'Beschaffung' },
      { href: '#/knowledge/accommodation', label: 'Unterbringung und Objektbetrieb' },
      { href: '#/knowledge/publishing', label: 'Publikationen, Druck und Versand' },
      { href: '#/knowledge/guides', label: 'Anleitungen und Schulungen' },
      { href: '#/knowledge/processes', label: 'Prozessdokumentation' },
    ],
  },
  // News is flat: no drawer.
  { path: '#/news',         base: 'news',         label: 'News',               icon: 'Bell' },
  // Personal cases always comes last.
  { path: '#/my-cases',     base: 'my-cases',     label: 'Meine Vorgänge',     icon: 'List' },
];

// module paths are relative to THIS file (js/)
const PAGES = {
  '':            './pages/home.js',
  'home':        './pages/home.js',
  'services':    './pages/services.js',
  'applications':'./pages/applications.js',
  'data':        './pages/data.js',
  'knowledge':   './pages/knowledge.js',
  'news':        './pages/news.js',
  'my-cases':    './pages/my-cases.js',
  'search':      './pages/search.js',
};
const APPS = {
  'space-request':   './apps/space-request.js',
  'fault-report':    './apps/fault-report.js',
  'portfolio':       './apps/portfolio.js',
  'projects':        './apps/projects.js',
  'document-archive':'./apps/document-archive.js',
  'workspace':       './apps/workspace.js',
  'floorplan-editor':'./apps/floorplan-editor.js',
  'room-booking':    './apps/room-booking.js',
  'transaction':     './apps/transaction.js',
  'dataportal':      './apps/dataportal.js',
  'api-docs':        './apps/api-docs.js',
  'building-create': './apps/building-create.js',
  'media-library':   './apps/media-library.js',
  'tenancies':       './apps/tenancies.js',
  'metadata-catalog':'./apps/metadata-catalog.js',
  'process-docs':    './apps/process-docs.js',
  'shop':            './apps/shop.js',
};
// Not every direct domain route has an application-catalogue landing page. Form-
// and data-driven tools still need a comprehensible name and appropriate return
// path for the central login gate.
const APP_GATE_META = {
  'space-request': { title: 'Raumbedarf melden', back: '#/services/raumbedarf-melden', backLabel: 'Beschreibung der Dienstleistung' },
  'fault-report': { title: 'Meldung erfassen', back: '#/services', backLabel: 'Dienstleistungen' },
  'transaction': { title: 'Veräusserung von Bundesliegenschaften', back: '#/services', backLabel: 'Dienstleistungen' },
  'api-docs': { title: 'API-Dokumentation', back: '#/data/catalog', backLabel: 'Datenkatalog' },
  'building-create': { title: 'Gebäude erfassen', back: '#/services/stammdaten-mutieren', backLabel: 'Beschreibung der Dienstleistung' },
};
// Top-navigation item to highlight for pages and apps that are not themselves a
// top-level entry. Applications is no longer L1; it lives under data and
// digitalisation, so it and every micro-app highlight that section.
const SECTION_OF = {
  'applications': 'data',
  'space-request': 'services', 'fault-report': 'services', 'building-create': 'services',
  'portfolio': 'data', 'projects': 'data',
  'workspace': 'data', 'room-booking': 'data', 'transaction': 'data', 'dataportal': 'data',
  'floorplan-editor': 'data',
  'document-archive': 'data', 'media-library': 'data', 'api-docs': 'data',
  'tenancies': 'data', 'metadata-catalog': 'data', 'process-docs': 'data',
  'shop': 'data',
};

function parseHash() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segs = pathPart.split('/').filter(Boolean);
  return { segs, query: new URLSearchParams(queryPart || '') };
}

// --- Legacy redirects (docs/sitemap.md §7) ----------------------------------
// Routes now use English segments throughout. Shared links to former German
// paths must not break; those are precisely the links somebody distributed.
// Order matters: longer paths first, otherwise the `#/knowledge/news` rule does
// not preserve `#/knowledge/news/<id>` correctly.
const REDIRECTS = [
  [/^#\/knowledge\/news(\/.*)?$/,        (m) => `#/news${m[1] || ''}`],
  // Knowledge is grouped by subject. Former material-type sections no longer
  // have one-to-one targets because content is distributed across subjects, so
  // they lead to the overview rather than the wrong corner. Guidance and process
  // documentation remain distinct pages.
  [new RegExp('^#/knowledge/(grundlagen|regulations|general)(/.*)?$'), () => '#/knowledge'],
  [new RegExp('^#/knowledge/anleitungen$'),            () => '#/knowledge/guides'],
  [new RegExp('^#/knowledge/prozesse$'),               () => '#/knowledge/processes'],
  [/^#\/knowledge\/templates$/,                       () => '#/knowledge'],
  [new RegExp('^#/data/katalog(/.*)?$'),  (m) => `#/data/catalog${m[1] || ''}`],
  [new RegExp('^#/data/digitalisierung(/.*)?$'), (m) => `#/data/digitalisation${SUBS[(m[1] || '').slice(1)] || m[1] || ''}`],
  [new RegExp('^#/data/ikt-vorhaben$'),            () => '#/data/ict-projects'],
  [new RegExp('^#/app/mediathek(/.*)?$'), (m) => `#/app/media-library${m[1] || ''}`],
];
const SUBS = { 'strategie': '/strategy', 'prinzipien': '/principles', vision: '/vision', superb: '/superb', bim: '/bim' };

// Return a target when the current hash is legacy, otherwise ''. Preserve the
// query; obsolete parameters disappear naturally because the target does not
// read them.
export function legacyTarget(hash) {
  const [path, qs] = String(hash || '').split('?');
  if (path === '#/app/workspace' && qs) {
    const params = new URLSearchParams(qs);
    const tab = params.get('tab');
    const target = tab === 'buchung' ? '#/app/room-booking'
      : tab === 'moeblierung' ? '#/app/shop'
      : tab === 'belegung' ? '#/app/workspace' : '';
    if (target) {
      params.delete('tab');
      const rest = params.toString();
      return target + (rest ? `?${rest}` : '');
    }
  }
  for (const [re, to] of REDIRECTS) {
    const m = path.match(re);
    if (m) return to(m) + (qs ? `?${qs}` : '');
  }
  return '';
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
export function matchesSubNav(childHref, currentHash) {
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
function renderCrumbs(crumbs) {
  const ul = document.getElementById('breadcrumb-list');
  const wrap = document.getElementById('breadcrumb');
  if (!ul || !wrap) return;
  if (!crumbs || !crumbs.length) { wrap.hidden = true; ul.innerHTML = ''; return; }
  wrap.hidden = false;
  ul.innerHTML = crumbs.map((c, i) => {
    const last = i === crumbs.length - 1;
    const sep = i > 0 ? C.icon('ChevronRight', 'breadcrumb__include-icon') : '';
    return last
      ? `<li><span aria-current="page">${sep}${C.escape(c.label)}</span></li>`
      : `<li><a href="${c.href}">${sep}<span>${C.escape(c.label)}</span></a></li>`;
  }).join('');
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
    const render = mod.default || mod.render;
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
      ${C.notification(
      `<span class="small">${C.escape(e.message)}</span>`,
      'error', 'WarningCircle', { live: true })}</div>`;
    finalizeRoute({ mount, stale, pathKey, isStateChange, activeId, previousHeading: prevH1, restoreY });
  }
}

export function initRouter() {
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

export default {
  initRouter, NAV, redraw, navigateRoute, requestNavigationPermission,
  registerNavigationBlocker, replaceRoute,
};
