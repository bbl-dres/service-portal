// Static route declarations and legacy URL parsing.

// Overview is deliberately no longer an L1 item; the logo reaches the home
// page. The five intranet task areas (office equipment, etc.) are not separate
// L1 items but sub-branches in the service drawer (CD navy drill-down;
// ui/shell/header.js).
export const NAV = [
  {
    path: '#/services',
    base: 'services',
    label: 'Dienstleistungen',
    icon: 'Briefcase',
    // CD drawer: overview (the gallery by area), then one row per domain; each
    // sets the catalogue's topic filter. Domains resolve from the data core at
    // render time (ui/shell/header.js), preventing menu drift.
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
      // Business architecture (2026-08-13). The metadata catalogue used to be
      // deliberately absent here — «a data-management tool rather than an
      // everyday destination». That reasoning held while it was one app among
      // many; it stopped holding once the incoming request asked where the
      // business architecture is documented. The branch names the CONTENT
      // rather than the two apps, which is how people ask for it.
      // German UI term: «Geschäftsarchitektur» (2026-08-14). The former name
      // «Prozesse und Geschäftsobjekte» listed two of the four layers the
      // signpost covers and missed the reference data entirely; every time the
      // catalogue gained a branch the label went further out of date. The name
      // of the thing itself does not have that problem.
      //
      // Each row lands on the branch of the SAME NAME in the catalogue, so the
      // row and the page it opens say the same word. That is why the fourth row
      // reads «Systeme» rather than «Datentabellen»: the catalogue groups tables
      // by the system that holds them, and that is what a reader sees on arrival.
      { label: 'Dokumentation der Geschäftsarchitektur', branchKey: 'architecture', branches: [
        { href: '#/data/architecture', label: 'Übersicht' },
        { href: '#/app/process-docs', label: 'Prozesse' },
        { href: '#/app/metadata-catalog?kind=objekt', label: 'Geschäftsobjekte' },
        { href: '#/app/metadata-catalog?kind=tabelle', label: 'Systeme' },
        { href: '#/app/metadata-catalog?kind=referenz', label: 'Referenzdaten' },
      ] },
      { href: '#/app/dataportal', label: 'Datenportal' },
      { href: '#/data/catalog', label: 'Datenbezug und API Verzeichnis' },
      // One branch instead of three sibling rows (2026-08-13). The three
      // «Fachanwendungen …» entries differed only by filter, and the `central`
      // area — the two portal applications — had NO menu path at all because no
      // row carried its filter. The first row is the unfiltered catalogue and
      // gives them one.
      //
      // Shared federal-administration applications (eGate, InfoPers, SAP ERP,
      // Admin Directory, I14Y, TERMDAT, Geoportal, geocat.ch, simap.ch) are not
      // owned by the BBL but used here daily; without a row, only people who
      // proactively filter the catalogue would find them.
      { label: 'Fachanwendungen', branchKey: 'applications', branches: [
        { href: '#/applications', label: 'Übersicht' },
        { href: '#/applications?area=buildings', label: 'Bauten' },
        { href: '#/applications?area=logistics', label: 'Logistik' },
        { href: '#/applications?area=federal', label: 'Bundesverwaltung' },
      ] },
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
      // The workspace area is a drill-down branch, like the digitalisation one under
      // data. It is the one knowledge area that earns its own second-level pages: it
      // carries an eleven-module equipment catalogue with a page per module, not the
      // three-documents-per-page the flat rule was written to avoid.
      { label: 'Arbeitsplätze gestalten', branchKey: 'workspace', branches: [
        { href: '#/knowledge/workspace', label: 'Übersicht' },
        { href: '#/knowledge/workspace/multispace', label: 'Multispace-Handbuch' },
        { href: '#/knowledge/workspace/inspiration', label: 'Planungsbeispiele' },
        { href: '#/knowledge/workspace/kreislauf', label: 'Kreislaufwirtschaft und Occasionsmobiliar' },
        { href: '#/knowledge/workspace/downloads', label: 'Downloads und Vorlagen' },
      ] },
      { href: '#/knowledge/publishing', label: 'Publikationen, Druck und Versand' },
      { href: '#/knowledge/guides', label: 'Anleitungen und Schulungen' },
      // The process-documentation row was removed here (2026-08-13): it now
      // lives under the data section, together with the metadata catalogue it
      // belongs with. Leaving a row would restore the duplicate.
    ],
  },
  // News is flat: no drawer.
  { path: '#/news',         base: 'news',         label: 'News',               icon: 'Bell' },
  // Personal cases always comes last.
  { path: '#/my-cases',     base: 'my-cases',     label: 'Meine Vorgänge',     icon: 'List' },
];

// Breadcrumb dropdowns (CD breadcrumb.postcss:93-113, BreadcrumbNavigation.vue).
// CD lets a breadcrumb segment open the pages that sit beside it, so a reader can
// step sideways without going up and back down.
//
// The rows come from NAV and nowhere else. A hand-kept second list would be a
// menu that drifts from the menu, and this file already had that problem once —
// see `childrenFrom: 'topics'`, which exists precisely so the service domains
// cannot go stale.
//
// A branch contributes ONE row under its own name, pointing at its overview —
// it is NOT flattened into its children. Flattening was tried first and made the
// list both long and ambiguous: «Fachanwendungen ▸ Bauten» became a bare
// «Bauten» sitting three rows from «Prozesse», and neither said what it was a
// part of. One row per branch also makes the dropdown read exactly like the
// drawer, which is the promise the control makes.
//
// Sections whose children are a single overview row get nothing — a dropdown
// listing only the page you are already on is a control that does nothing.
//
// EVERY level resolves, not just the top one (2026-08-14). CD gives a dropdown
// to every crumb after «Startseite», the current page included; here only the
// five NAV sections matched, so «Digitalisierung», «Geschäftsarchitektur» and
// «Anwendungen» never had one. A branch is matched by ANY of its hrefs, not just
// its overview, so a leaf page's own crumb opens the pages beside it.
export function crumbChildren(href) {
  if (!href) return [];
  const section = NAV.find((item) => item.path === href);
  if (section) {
    const rows = [];
    for (const child of section.children || []) {
      if (child.branchKey) {
        const first = (child.branches || []).find((b) => b.href);
        if (first) rows.push({ href: first.href, label: child.label });
      } else if (child.href) rows.push(child);
    }
    return rows.length > 1 ? rows : [];
  }
  // A page inside a branch: the branch's own rows. Tried with the query string
  // first, because the catalogue's branch rows ARE query strings
  // (`?kind=objekt`); the bare path is the fallback for everything else.
  const bare = href.split('?')[0];
  for (const item of NAV) {
    for (const child of item.children || []) {
      if (!child.branchKey) continue;
      const rows = (child.branches || []).filter((b) => b.href);
      if (rows.some((b) => b.href === href || b.href === bare)) {
        return rows.length > 1 ? rows : [];
      }
    }
  }
  return [];
}

// Module paths are relative to routing/router.js, where dynamic import() executes.
export const PAGES = {
  '':            '../pages/home.js',
  'home':        '../pages/home.js',
  'services':    '../pages/services.js',
  'applications':'../pages/applications.js',
  'data':        '../pages/data.js',
  'knowledge':   '../pages/knowledge.js',
  'news':        '../pages/news.js',
  'my-cases':    '../pages/my-cases.js',
  'search':      '../pages/search.js',
};
export const APPS = {
  'space-request':   '../apps/space-request.js',
  'fault-report':    '../apps/fault-report.js',
  'portfolio':       '../apps/portfolio.js',
  'projects':        '../apps/projects.js',
  'document-archive':'../apps/document-archive.js',
  'workspace':       '../apps/workspace.js',
  'floorplan-editor':'../apps/floorplan-editor.js',
  'plan-check':      '../apps/plan-check.js',
  'room-booking':    '../apps/room-booking.js',
  'transaction':     '../apps/transaction.js',
  'dataportal':      '../apps/dataportal.js',
  'api-docs':        '../apps/api-docs.js',
  'building-create': '../apps/building-create.js',
  'media-library':   '../apps/media-library.js',
  'tenancies':       '../apps/tenancies.js',
  'metadata-catalog':'../apps/metadata-catalog.js',
  'process-docs':    '../apps/process-docs.js',
  'shop':            '../apps/shop.js',
};
// Not every direct domain route has an application-catalogue landing page. Form-
// and data-driven tools still need a comprehensible name and appropriate return
// path for the central login gate.
export const APP_GATE_META = {
  'space-request': { title: 'Raumbedarf melden', back: '#/services/raumbedarf-melden', backLabel: 'Beschreibung der Dienstleistung' },
  'fault-report': { title: 'Meldung erfassen', back: '#/services', backLabel: 'Dienstleistungen' },
  'transaction': { title: 'Veräusserung von Bundesliegenschaften', back: '#/services', backLabel: 'Dienstleistungen' },
  'api-docs': { title: 'API-Dokumentation', back: '#/data/catalog', backLabel: 'Datenkatalog' },
  'building-create': { title: 'Gebäude erfassen', back: '#/services/stammdaten-mutieren', backLabel: 'Beschreibung der Dienstleistung' },
  // The plan checker has no entry in the application catalogue; it is reached
  // through its service, which is where its description and prerequisites live.
  'plan-check': { title: 'Planprüfung', back: '#/services/plan-pruefen', backLabel: 'Beschreibung der Dienstleistung' },
};
// Top-navigation item to highlight for pages and apps that are not themselves a
// top-level entry. Applications is no longer L1; it lives under data and
// digitalisation, so it and every micro-app highlight that section.
export const SECTION_OF = {
  'applications': 'data',
  'space-request': 'services', 'fault-report': 'services', 'building-create': 'services',
  'portfolio': 'data', 'projects': 'data',
  'workspace': 'data', 'room-booking': 'data', 'transaction': 'data', 'dataportal': 'data',
  'floorplan-editor': 'data', 'plan-check': 'data',
  'document-archive': 'data', 'media-library': 'data', 'api-docs': 'data',
  'tenancies': 'data', 'metadata-catalog': 'data', 'process-docs': 'data',
  'shop': 'data',
};

export function parseHash() {
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
  // Process documentation moved under the data section (2026-08-13). Two pages
  // carried the same name in the same header — a thin guide here and the app
  // over there — and a code comment in knowledge-content had been papering over
  // the collision. Both spellings of the old path land on the signpost.
  [new RegExp('^#/knowledge/(prozesse|processes)$'),   () => '#/data/architecture'],
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
