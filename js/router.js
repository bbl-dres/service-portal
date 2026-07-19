// Hash router. Each section page lives in pages/<name>.js; each micro-app in
// apps/<name>/index.js. Modules default-export: async function render(ctx).
// ctx = { mount, params, query, core, engine, session, C, navigate, setTitle, setCrumbs }

import { core } from './core.js';
import { engine } from './process-engine.js';
import { session } from './session.js';
import C from './components.js';

export const NAV = [
  { path: '#/',             base: '',             label: 'Übersicht',          icon: 'Home' },
  { path: '#/services',     base: 'services',     label: 'Dienstleistungen',   icon: 'Briefcase' },
  { path: '#/applications', base: 'applications', label: 'Anwendungen',        icon: 'Apps' },
  { path: '#/documents',    base: 'documents',    label: 'Dokumente & Medien', icon: 'Folder' },
  {
    path: '#/data',
    base: 'data',
    label: 'Daten und Digitalisierung',
    icon: 'FileDatabase',
    children: [
      { href: '#/data', label: 'Übersicht', desc: 'Datenkatalog, Datenquellen und Zugänge' },
      { href: '#/applications', label: 'Anwendungen', desc: 'Fachanwendungen und digitale Werkzeuge' },
      { href: '#/data', label: 'Datenbezug', desc: 'Datensätze, Schnittstellen und Publikationen' },
      { href: '#/knowledge?tab=anleitungen', label: 'Digitalisierung', desc: 'Anleitungen und Grundlagen zur digitalen Zusammenarbeit' },
    ],
  },
  { path: '#/knowledge',    base: 'knowledge',    label: 'Wissen',             icon: 'Book' },
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
};
// which top-nav item to highlight when inside an app
const APP_SECTION = {
  'space-request': 'services', 'fault-report': 'services',
  'portfolio': 'applications', 'projects': 'applications',
  'workspace': 'applications', 'transaction': 'applications',
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
    a.classList.toggle('active', a.getAttribute('data-nav') === base);
  });
}

function renderCrumbs(crumbs) {
  const ol = document.getElementById('breadcrumb');
  const wrap = document.getElementById('breadcrumb-wrap');
  if (!ol || !wrap) return;
  if (!crumbs || !crumbs.length) { wrap.hidden = true; ol.innerHTML = ''; return; }
  wrap.hidden = false;
  ol.innerHTML = crumbs.map((c, i) => {
    const last = i === crumbs.length - 1;
    const sep = i > 0 ? C.icon('ChevronRight') : '';
    const inner = (!last && c.href) ? `<a href="${c.href}">${C.escape(c.label)}</a>` : C.escape(c.label);
    return `<li${last ? ' aria-current="page"' : ''}>${sep}${inner}</li>`;
  }).join('');
}

function makeCtx(mount, params, query) {
  return {
    mount, params, query, core, engine, session, C,
    navigate: (h) => { location.hash = h; },
    setTitle: (t) => { document.title = t ? `${t} · BBL Plattform` : 'BBL Plattform'; },
    setCrumbs: renderCrumbs,
  };
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
  document.getElementById('breadcrumb-wrap').hidden = true;

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
  } catch (e) {
    console.error('[router] render failed for', modPath, e);
    mount.innerHTML = `<div class="container section">
      <div class="notification notification--error">${C.icon('WarningCircle', 'icon--lg')}
      <div><strong>Diese Ansicht konnte nicht geladen werden.</strong><br><span class="small">${C.escape(e.message)}</span></div></div></div>`;
  }
}

export function initRouter() {
  window.addEventListener('hashchange', dispatch);
  if (!location.hash) location.hash = '#/';
  dispatch();
}

export default { initRouter, NAV };
