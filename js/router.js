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
      { label: 'Digitalisierung', branchKey: 'digitalisation', branches: [
        { href: '#/data/digitalisation', label: 'Übersicht' },
        { href: '#/data/digitalisation/strategy', label: 'Digitalisierungsstrategie' },
        { href: '#/data/digitalisation/vision', label: 'Vision' },
        { href: '#/data/digitalisation/principles', label: 'Prinzipien' },
      ] },
      { href: '#/app/dataportal', label: 'Datenportal' },
      { href: '#/data/catalog', label: 'Datenbezug und API Verzeichnis' },
      { href: '#/applications?area=buildings', label: 'Fachanwendungen Bauten' },
      { href: '#/applications?area=logistics', label: 'Fachanwendungen Logistik' },
    ],
  },
  // «Wissen und Hilfsmittel» trägt die Referenzschicht: Vorgaben, Vorlagen,
  // Anleitungen, Prozesse. News ist daraus herausgelöst (docs/sitemap.md §2.1) —
  // eine Nachricht wird einmal gelesen, ein Hilfsmittel immer wieder benutzt.
  {
    path: '#/knowledge',
    base: 'knowledge',
    label: 'Wissen und Hilfsmittel',
    icon: 'Book',
    // Gegliedert nach FACHGEBIET, nicht nach Materialart: Hilfsmittel werden
    // dort gebraucht, wo man arbeitet — im Altbestand lagen Werkzeugkasten und
    // Mustervorlagen unter «Informatik», die BKB-Dokumente unter «Beschaffen»
    // (docs/legacy-analysis.md). Die Materialarten sind Abschnitte INNERHALB
    // der Fachgebietsseite; ihr Inhaltsverzeichnis trägt die dritte Ebene.
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
  // News ist flach — kein Drawer.
  { path: '#/news',         base: 'news',         label: 'News',               icon: 'Bell' },
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
  'transaction':     './apps/transaction.js',
  'dataportal':      './apps/dataportal.js',
  'api-docs':        './apps/api-docs.js',
  'building-create': './apps/building-create.js',
  'media-library':   './apps/media-library.js',
  'tenancies':       './apps/tenancies.js',
};
// Which top-nav item to highlight for pages and apps that are not themselves a
// top-level entry. Anwendungen is no longer an L1 item — it lives under Daten
// und Digitalisierung, so it and every micro-app highlight that section.
const SECTION_OF = {
  'applications': 'data',
  'space-request': 'services', 'fault-report': 'services', 'building-create': 'services',
  'portfolio': 'data', 'projects': 'data',
  'workspace': 'data', 'transaction': 'data', 'dataportal': 'data',
  'document-archive': 'data', 'media-library': 'data', 'api-docs': 'data',
  'tenancies': 'data',
};

function parseHash() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segs = pathPart.split('/').filter(Boolean);
  return { segs, query: new URLSearchParams(queryPart || '') };
}

// --- Altlasten-Weiterleitungen (docs/sitemap.md §7) -------------------------
// Die Routen tragen jetzt durchgehend englische Segmente. Geteilte Links auf die
// alten deutschen Pfade dürfen deswegen nicht ins Leere laufen — sie sind genau
// die, die jemand weitergegeben hat. Reihenfolge zählt: längere Pfade zuerst,
// sonst schluckt `#/knowledge/news` die Regel für `#/knowledge/news/<id>` nicht.
const REDIRECTS = [
  [/^#\/knowledge\/news(\/.*)?$/,        (m) => `#/news${m[1] || ''}`],
  // «Wissen» ist nach Fachgebiet gegliedert. Die alten materialart-basierten
  // Abschnitte haben kein 1:1-Ziel mehr — ihre Inhalte liegen verteilt in den
  // Fachgebieten —, also führt der Weg auf die Übersicht statt in eine falsche
  // Ecke. Anleitungen und Prozessdokumentation bleiben eigene Seiten.
  [/^#\/knowledge\/(grundlagen|regulations|general)(\/.*)?$/, () => '#/knowledge'],
  [/^#\/knowledge\/anleitungen$/,                     () => '#/knowledge/guides'],
  [/^#\/knowledge\/prozesse$/,                        () => '#/knowledge/processes'],
  [/^#\/knowledge\/templates$/,                       () => '#/knowledge'],
  [/^#\/data\/katalog(\/.*)?$/,          (m) => `#/data/catalog${m[1] || ''}`],
  [/^#\/data\/digitalisierung(\/.*)?$/,  (m) => `#/data/digitalisation${SUBS[(m[1] || '').slice(1)] || m[1] || ''}`],
  [/^#\/data\/ikt-vorhaben$/,            () => '#/data/ict-projects'],
  [/^#\/app\/mediathek(\/.*)?$/,         (m) => `#/app/media-library${m[1] || ''}`],
];
const SUBS = { strategie: '/strategy', prinzipien: '/principles', vision: '/vision', superb: '/superb', bim: '/bim' };

// Gibt das Ziel zurück, wenn der aktuelle Hash eine Altlast ist — sonst ''.
// Der Query-Teil bleibt erhalten; veraltete Parameter fallen still weg (sie
// werden von der Zielseite schlicht nicht gelesen).
export function legacyTarget(hash) {
  const [path, qs] = String(hash || '').split('?');
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
  // "Übersicht" (#/knowledge) must not light up on #/knowledge/news …
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

function makeCtx(mount, params, query, stale, cleanups) {
  return {
    mount, params, query, core, engine, session, C,
    // Aufräumen beim Verlassen der Route. Der Router tauschte bisher nur
    // `mount.innerHTML` — Karten, Observer, Media-Query-Listener und Overlays
    // überlebten damit die Route, die sie erzeugt hat. Wer etwas anlegt, das den
    // DOM-Tausch überdauert, meldet hier seine Abbaufunktion an.
    onUnmount: (fn) => { if (typeof fn === 'function') cleanups.push(fn); },
    // Async-Seiten (die vor dem Schreiben `await`en, z. B. dynamische Import-
    // Delegatoren) prüfen `ctx.stale()` unmittelbar vor `mount.innerHTML =`, damit
    // eine überholte Navigation die inzwischen neuere Seite nicht überschreibt (A2).
    stale: stale || (() => false),
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
// order. Every dispatch takes a ticket; the router drops a stale render's own
// post-write steps (module load, focus, scroll). A page that itself `await`s
// before writing (the dynamic-import delegators applications.js / data.js) must
// additionally check `ctx.stale()` right before `mount.innerHTML =`, or its late
// write overwrites the newer page (code-review A2).
let dispatchId = 0;
let prevPath = null;
// ResizeObserver der Scrollbereiche der aktuellen Ansicht — beim Ansichtswechsel
// abmelden, sonst beobachtet er entfernte Knoten weiter.
let unwireScroll = null;
// Abbaufunktionen der AKTUELLEN Route (ctx.onUnmount). Werden zu Beginn des
// nächsten Dispatch abgearbeitet — also bevor die neue Ansicht etwas anlegt.
let routeCleanups = [];

async function dispatch() {
  // Erst aufräumen, dann neu bauen. Fehler einer einzelnen Abbaufunktion dürfen
  // die Navigation nicht anhalten.
  for (const fn of routeCleanups) { try { fn(); } catch (e) { console.warn('[router] cleanup failed', e); } }
  routeCleanups = [];
  // Altlast-Pfad? Adresse ERSETZEN, nicht anhängen — sonst führt «Zurück» auf
  // den alten Pfad und von dort sofort wieder hierher (Endlosfalle). replaceState
  // feuert kein `hashchange`, also läuft dieser Aufruf danach einfach weiter und
  // rendert das Ziel; parseHash() liest die bereits ersetzte Adresse.
  const redirect = legacyTarget(location.hash);
  if (redirect) { try { history.replaceState(null, '', redirect); } catch { location.hash = redirect; } }

  const ticket = ++dispatchId;
  const stale = () => ticket !== dispatchId;
  const { segs, query } = parseHash();
  const mount = document.getElementById('main-content');

  // Zustandswechsel (nur die Query änderte sich, gleiche Seite) von echter
  // Navigation trennen: bei einem Zustandswechsel darf der Fokus NICHT auf die
  // H1 springen (WCAG 3.2.2) und die Seite nicht nach oben scrollen — stattdessen
  // den auslösenden Bedienpfad (per id) wiederherstellen.
  const pathKey = segs.join('/');
  const isStateChange = prevPath !== null && prevPath === pathKey;
  const activeId = isStateChange && document.activeElement && mount.contains(document.activeElement)
    ? document.activeElement.id : '';
  prevPath = pathKey;

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

  // Kein «Lädt…»-Aufblitzen bei einem reinen Zustandswechsel (Modul ist im Cache).
  // Ladezustand: statt eines nackten «Lädt…»-Absatzes eine echte Statusregion mit
  // aria-busy und einer Ladeanzeige (Item 3.17). Der sichtbare Text ist sr-only —
  // das Spinner-Symbol trägt die Information optisch.
  if (!isStateChange) mount.innerHTML = `<div class="container section" role="status" aria-busy="true">`
    + `${C.icon('Spinner', 'icon--2xl icon--spin')}<span class="sr-only">Inhalt wird geladen…</span></div>`;
  try {
    const mod = await import(modPath);
    if (stale()) return;
    const render = mod.default || mod.render;
    if (typeof render !== 'function') throw new Error('Modul exportiert kein render()');
    // Aufschiebbare Bestände (H4): das Modul nennt in `needs`, was es lesen will,
    // und bekommt es VOR dem ersten Zugriff. Ohne diese Sperre läse ein Accessor
    // die noch leere Liste und die Seite zeigte «keine Einträge» statt Daten.
    // Beim zweiten Besuch ist das Versprechen erfüllt und die Sperre kostet nichts.
    if (Array.isArray(mod.needs) && mod.needs.length) {
      await core.ensure(mod.needs);
      if (stale()) return;
    }
    const ctx = makeCtx(mount, params, query, stale, routeCleanups);
    await render(ctx);
    if (stale()) return;
    // Überlaufende Bereiche (Tabellen, Code-/SQL-Kästen) bekommen erst hier ihren
    // Tastaturzugang: `C.wireScrollRegions` gab es seit Stufe 3, war aber nirgends
    // aufgerufen — waagrecht scrollende Flächen waren also nur mit der Maus
    // erreichbar (WCAG 2.1.1). Zentral im Router, damit es für jede Ansicht gilt,
    // auch für die, die ihre Tabellen später nachrendern (siehe unten: erneuter
    // Lauf nach Zustandswechseln in mountDataTable/renderMain über den Aufrufer).
    if (unwireScroll) { unwireScroll(); unwireScroll = null; }
    unwireScroll = C.wireScrollRegions(mount);
    if (isStateChange) {
      const el = activeId ? document.getElementById(activeId) : null;
      if (el) el.focus({ preventScroll: true });   // Fokus zurück auf den Filter/Schalter
      else focusHeading(mount);                    // A10: nie an <body> verlieren
    } else {
      window.scrollTo(0, 0);
      focusHeading(mount);
    }
  } catch (e) {
    if (stale()) return;
    console.error('[router] render failed for', modPath, e);
    mount.innerHTML = `<div class="container section">${C.notification(
      `<strong>Diese Ansicht konnte nicht geladen werden.</strong><br><span class="small">${C.escape(e.message)}</span>`,
      'error', 'WarningCircle', { live: true })}</div>`;
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
  // Setzt `location.hash` neu, feuert das `hashchange` den dispatch (else-Zweig);
  // ein zusätzliches explizites dispatch() würde die Startseite doppelt rendern.
  if (!location.hash || !location.hash.startsWith('#/')) location.hash = '#/';
  else dispatch();
}

// Aktuelle Route neu zeichnen, ohne zu navigieren — z. B. nach An-/Abmeldung,
// damit der Login-Hinweis auf der Seite verschwindet bzw. erscheint.
// Gibt das dispatch-Promise zurück: `dispatch()` ist async (dynamischer Import),
// und wer nach einem Neuzeichnen selbst den Fokus setzen will, muss abwarten —
// sonst überschreibt der Fokus-Schritt des Routers ihn kurz danach wieder.
export function redraw() { return dispatch(); }

export default { initRouter, NAV, redraw };
