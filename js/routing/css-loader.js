// Route CSS is loaded once per session and kept in canonical cascade order.
// The router awaits these promises before rendering a micro-app, preventing an
// unstyled app frame while retaining the static shell/loading presentation.

const SHEETS = Object.freeze([
  { key: 'dataportal', href: '../../css/apps/dataportal.css', slot: 'early' },
  { key: 'portfolio', href: '../../css/apps/portfolio.css', slot: 'portfolio' },
  { key: 'archive', href: '../../css/apps/archive.css', slot: 'late' },
  { key: 'floorplan', href: '../../css/apps/floorplan.css', slot: 'late' },
  { key: 'workplace', href: '../../css/apps/workplace.css', slot: 'late' },
  { key: 'floorplan-editor', href: '../../css/apps/floorplan-editor.css', slot: 'late' },
  { key: 'room-booking', href: '../../css/apps/room-booking.css', slot: 'late' },
].map((sheet, index) => Object.freeze({ ...sheet, index })));

const APP_SHEETS = Object.freeze({
  'space-request': [],
  'fault-report': [],
  portfolio: ['dataportal', 'portfolio'],
  projects: ['dataportal', 'portfolio'],
  'document-archive': ['dataportal', 'archive'],
  workspace: ['dataportal', 'portfolio', 'floorplan', 'workplace'],
  'floorplan-editor': ['floorplan-editor'],
  'room-booking': ['dataportal', 'floorplan', 'workplace', 'room-booking'],
  transaction: [],
  dataportal: ['dataportal'],
  'api-docs': ['dataportal'],
  'building-create': ['dataportal', 'portfolio'],
  'media-library': ['dataportal', 'portfolio'],
  tenancies: ['dataportal', 'portfolio', 'floorplan'],
  'metadata-catalog': [],
  'process-docs': ['dataportal'],
  shop: [],
});

const byKey = new Map(SHEETS.map((sheet) => [sheet.key, sheet]));
const pending = new Map();

function insertionPoint(sheet) {
  const later = [...document.head.querySelectorAll('link[data-app-style-index]')]
    .find((link) => link.dataset.appStyleSlot === sheet.slot
      && Number(link.dataset.appStyleIndex) > sheet.index);
  if (later) return later;
  const anchor = document.head.querySelector(`meta[name="css-app-anchor"][content="${sheet.slot}"]`);
  if (!anchor) throw new Error(`CSS cascade anchor fehlt: ${sheet.slot}`);
  return anchor;
}

function loadSheet(sheet) {
  if (pending.has(sheet.key)) return pending.get(sheet.key);

  const href = new URL(sheet.href, import.meta.url).href;
  const promise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.appStyle = sheet.key;
    link.dataset.appStyleIndex = String(sheet.index);
    link.dataset.appStyleSlot = sheet.slot;

    const fail = (reason) => {
      clearTimeout(timer);
      link.remove();
      pending.delete(sheet.key);
      reject(new Error(`Stylesheet konnte nicht geladen werden: ${sheet.key} (${reason})`));
    };
    const timer = setTimeout(() => fail('Zeitüberschreitung'), 12000);
    link.onload = () => {
      clearTimeout(timer);
      link.dataset.loaded = 'true';
      resolve(link);
    };
    link.onerror = () => fail('Netzwerkfehler');
    document.head.insertBefore(link, insertionPoint(sheet));
  });

  pending.set(sheet.key, promise);
  return promise;
}

/** Load and await every stylesheet required by one registered micro-app. */
export function loadAppStyles(appName) {
  const keys = APP_SHEETS[appName];
  if (!keys) return Promise.reject(new Error(`Keine CSS-Zuordnung für Anwendung: ${appName}`));
  return Promise.all(keys.map((key) => loadSheet(byKey.get(key))));
}

export const appStyleKeys = (appName) => [...(APP_SHEETS[appName] || [])];
