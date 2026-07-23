// Hash router. Each section page lives in pages/<name>.js; each micro-app in
// apps/<name>/index.js. Modules default-export: async function render(ctx).
// ctx = { mount, params, query, core, engine, session, C, navigate, setTitle, setCrumbs }

import { core } from './core.js';
import { engine } from './process-engine.js';
import { session } from './session.js';
import C from './components.js';

export const NAV = [
  { path: '#/',             base: '',             label: 'Übersicht',          icon: 'Home' },
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
  { path: '#/documents',    base: 'documents',    label: 'Dokumente & Medien', icon: 'Folder' },
  {
    path: '#/data',
    base: 'data',
    label: 'Daten und Digitalisierung',
    icon: 'FileDatabase',
    // CD pattern: a section "Übersicht" first, then the areas it contains.
    // Datenportal and der vollständige Anwendungskatalog werden über die
    // Übersichtsseite erschlossen, nicht über das Menü.
    children: [
      { href: '#/data', label: 'Übersicht' },
      { href: '#/data/katalog', label: 'Datenbezug' },
      { href: '#/applications?bereich=bauten', label: 'Fachanwendungen Bauten' },
      { href: '#/applications?bereich=logistik', label: 'Fachanwendungen Logistik' },
      { href: '#/data/digitalisierung', label: 'Digitalisierung' },
    ],
  },
  {
    path: '#/knowledge',
    base: 'knowledge',
    label: 'News und Wissen',
    icon: 'Book',
    children: [
      { href: '#/knowledge', label: 'Übersicht' },
      { href: 'https://www.bk.admin.ch/de/vorgaben', label: 'Vorgaben der Bundeskanzlei', external: true },
      { href: '#/knowledge?tab=news', label: 'News' },
      { href: '#/knowledge?tab=prozesse', label: 'Prozesse' },
      { href: '#/knowledge?tab=weisungen', label: 'Weisungen' },
    ],
  },
  { path: '#/my-cases',     base: 'my-cases',     label: 'Meine Vorgänge',     icon: 'List' },
];

// module paths are relative to THIS file (js/)
const PAGES = {
  '':            './pages/home.js',
  'home':        './pages/home.js',
  'services':    './pages/services.js',
  'applications':'./pages/applications.js',
  'documents':   './pages/documents-media.js',
  'data':        './pages/data.js',
  'knowledge':   './pages/knowledge.js',
  'my-cases':    './pages/my-cases.js',
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
// which top-nav item to highlight when inside an app
// Anwendungen is no longer a top-level item — it lives under Daten und
// Digitalisierung, so the apps highlight that section instead.
const APP_SECTION = {
  'space-request': 'services', 'fault-report': 'services',
  'portfolio': 'data', 'projects': 'data',
  'workspace': 'data', 'transaction': 'data', 'dataportal': 'data',
  'document-archive': 'documents', 'mediathek': 'documents',
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

async function dispatch() {
  const { segs, query } = parseHash();
  const mount = document.getElementById('main-content');
  let modPath, params, navBase;

  if (segs[0] === 'app') {
    const name = segs[1];
    modPath = APPS[name];
    params = segs.slice(2);
    navBase = APP_SECTION[name] || '';
  } else {
    const base = segs[0] || '';
    modPath = PAGES[base];
    params = segs.slice(1);
    navBase = base;
  }

  setActiveNav(navBase);
  document.getElementById('breadcrumb').hidden = true;

  if (!modPath) {
    mount.innerHTML = `<div class="container section"><div class="page-header"><h1 tabindex="-1">Seite nicht gefunden</h1></div>
      <p class="muted">Diese Seite existiert nicht. <a href="#/">Zur Übersicht</a></p></div>`;
    return;
  }

  mount.innerHTML = `<div class="container section"><p class="muted">Lädt…</p></div>`;
  try {
    const mod = await import(modPath);
    const render = mod.default || mod.render;
    if (typeof render !== 'function') throw new Error('Modul exportiert kein render()');
    const ctx = makeCtx(mount, params, query);
    await render(ctx);
    window.scrollTo(0, 0);
    focusHeading(mount);
  } catch (e) {
    console.error('[router] render failed for', modPath, e);
    mount.innerHTML = `<div class="container section">
      <div class="notification notification--error">${C.icon('WarningCircle', 'icon--lg')}
      <div><strong>Diese Ansicht konnte nicht geladen werden.</strong><br><span class="small">${C.escape(e.message)}</span></div></div></div>`;
  }
}

export function initRouter() {
  // Only `#/…` is a route. Bare `#` and in-page fragments (e.g. the skip link's
  // `#main-content`) must not dispatch — that used to render a 404 over the page.
  window.addEventListener('hashchange', () => {
    if (location.hash && !location.hash.startsWith('#/')) return;
    dispatch();
  });
  if (!location.hash || !location.hash.startsWith('#/')) location.hash = '#/';
  dispatch();
}

export default { initRouter, NAV };
