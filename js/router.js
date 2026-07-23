// Hash router. Each section page lives in pages/<name>.js; each micro-app in
// apps/<name>/index.js. Modules default-export: async function render(ctx).
// ctx = { mount, params, query, core, engine, session, C, navigate, setTitle, setCrumbs }

import { core } from './core.js';
import { engine } from './process-engine.js';
import { session } from './session.js';
import C from './components.js';

// «Übersicht» ist bewusst kein L1-Eintrag mehr — die Startseite erreicht man
// über das Logo. Die fünf Intranet-Aufgabenbereiche (Büroausrüstung, …) sind
// keine eigenen L1-Einträge, sondern Unterzweige im Dienstleistungen-Drawer
// (CD navy drill-down, siehe shell.js).
export const NAV = [
  {
    path: '#/services',
    base: 'services',
    label: 'Dienstleistungen',
    icon: 'Briefcase',
    // CD drawer: "Übersicht" (the gallery by Bereich), then one row per Thema —
    // each sets the topic filter on the catalogue. The Themen are resolved from
    // the data core at render time (see shell.js) so the menu cannot drift.
    children: [{ href: '#/services', label: 'Übersicht' }],
    childrenFrom: 'themen',
  },
  {
    path: '#/data',
    base: 'data',
    label: 'Daten und Digitalisierung',
    icon: 'FileDatabase',
    // CD pattern: a section "Übersicht" first, then the areas it contains.
    // Datenportal and der vollständige Anwendungskatalog werden über die
    // Übersichtsseite erschlossen, nicht über das Menü.
    // Bauwerksdokumentation und Mediathek stehen im Anwendungskatalog
    // (#/applications?bereich=bauten) und auf der Übersicht — das Menü bleibt kurz.
    children: [
      { href: '#/data', label: 'Übersicht' },
      // «Digitalisierung» ist ein Drill-down-Zweig (CD navy) mit eigenen L2-Seiten.
      { label: 'Digitalisierung', branchKey: 'digitalisierung', branches: [
        { href: '#/data/digitalisierung', label: 'Übersicht' },
        { href: '#/data/digitalisierung/strategie', label: 'Digitalisierungsstrategie' },
        { href: '#/data/digitalisierung/vision', label: 'Vision' },
        { href: '#/data/digitalisierung/prinzipien', label: 'Prinzipien' },
      ] },
      { href: '#/app/dataportal', label: 'Datenportal' },
      { href: '#/data/katalog', label: 'Datenbezug' },
      { href: '#/applications?bereich=bauten', label: 'Fachanwendungen Bauten' },
      { href: '#/applications?bereich=logistik', label: 'Fachanwendungen Logistik' },
    ],
  },
  {
    path: '#/knowledge',
    base: 'knowledge',
    label: 'News und Wissen',
    icon: 'Book',
    children: [
      { href: '#/knowledge', label: 'Übersicht' },
      { href: '#/knowledge?tab=grundlagen', label: 'Gesetzliche Grundlagen und Vorgaben' },
      { href: '#/knowledge?tab=news', label: 'News' },
      { href: '#/knowledge?tab=prozesse', label: 'Prozessdokumentation' },
      { href: '#/knowledge?tab=anleitungen', label: 'Anleitungen und Schulungsunterlagen' },
    ],
  },
  // «Meine Vorgänge» steht immer zuletzt.
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
  'my-cases':    './pages/my-cases.js',
  'search':      './pages/search.js',
};
const APPS = {
  'space-request':   './apps/space-request.js',
  'fault-report':    './apps/fault-report.js',
  'portfolio':       './apps/portfolio.js',
  'projects':        './apps/projects.js',
  'document-archive':'./apps/document-archive.js',
  'mediathek':       './apps/mediathek.js',
  'workspace':       './apps/workspace.js',
  'transaction':     './apps/transaction.js',
  'dataportal':      './apps/dataportal.js',
};
// Which top-nav item to highlight for pages and apps that are not themselves a
// top-level entry. Anwendungen is no longer an L1 item — it lives under Daten
// und Digitalisierung, so it and every micro-app highlight that section.
const SECTION_OF = {
  'applications': 'data',
  'space-request': 'services', 'fault-report': 'services',
  'portfolio': 'data', 'projects': 'data',
  'workspace': 'data', 'transaction': 'data', 'dataportal': 'data',
  'document-archive': 'data', 'mediathek': 'data',
};

function parseHash() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segs = pathPart.split('/').filter(Boolean);
  return { segs, query: new URLSearchParams(queryPart || '') };
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
  // "Übersicht" (#/knowledge) must not light up on #/knowledge?tab=news …
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

function makeCtx(mount, params, query) {
  return {
    mount, params, query, core, engine, session, C,
    navigate: (h) => { location.hash = h; },
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
// order. Every dispatch takes a ticket; a stale one drops its result instead of
// overwriting the newer page.
let dispatchId = 0;

async function dispatch() {
  const ticket = ++dispatchId;
  const stale = () => ticket !== dispatchId;
  const { segs, query } = parseHash();
  const mount = document.getElementById('main-content');
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

  if (!modPath) {
    document.title = 'Seite nicht gefunden · BBL Kundenportal';
    mount.innerHTML = `<div class="container section"><div class="page-header"><h1 tabindex="-1">Seite nicht gefunden</h1></div>
      <p class="muted">Diese Seite existiert nicht. <a href="#/">Zur Übersicht</a></p></div>`;
    focusHeading(mount);
    return;
  }

  mount.innerHTML = `<div class="container section"><p class="muted">Lädt…</p></div>`;
  try {
    const mod = await import(modPath);
    if (stale()) return;
    const render = mod.default || mod.render;
    if (typeof render !== 'function') throw new Error('Modul exportiert kein render()');
    const ctx = makeCtx(mount, params, query);
    await render(ctx);
    if (stale()) return;
    window.scrollTo(0, 0);
    focusHeading(mount);
  } catch (e) {
    if (stale()) return;
    console.error('[router] render failed for', modPath, e);
    mount.innerHTML = `<div class="container section">
      <div class="notification notification--error">${C.icon('WarningCircle', 'icon--lg')}
      <div><strong>Diese Ansicht konnte nicht geladen werden.</strong><br><span class="small">${C.escape(e.message)}</span></div></div></div>`;
  }
}

export function initRouter() {
  // Only `#/…` is a route. Bare `#` and in-page fragments (e.g. the skip link's
  // `#main-content`) must not dispatch — that used to render a 404 over the page.
  // Nur `#/…` ist eine Route. Bare `#` (Platzhalter-Links) und Sprungmarken
  // dürfen nicht dispatchen — ein leerer Hash hat sonst wortlos auf die
  // Startseite geworfen (docs/design-review.md P0-1).
  window.addEventListener('hashchange', () => {
    if (!location.hash.startsWith('#/')) return;
    dispatch();
  });
  if (!location.hash || !location.hash.startsWith('#/')) location.hash = '#/';
  dispatch();
}

// Aktuelle Route neu zeichnen, ohne zu navigieren — z. B. nach An-/Abmeldung,
// damit der Login-Hinweis auf der Seite verschwindet bzw. erscheint.
export function redraw() { dispatch(); }

export default { initRouter, NAV, redraw };
