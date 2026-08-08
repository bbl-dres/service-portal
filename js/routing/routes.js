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
