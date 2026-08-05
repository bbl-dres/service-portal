// Routen-Rundlauf: jede Route der Spezifikation (docs/sitemap.md §3) rendern und
// auf Fehlerfreiheit prüfen, plus jede Altlast-Weiterleitung (§7) auf ihr Ziel.
//
// Warum eigene Suite: die übrigen Tests prüfen je ein Bauteil. Nach der
// Umbenennung der Routen und Parameter braucht es einen Test, der die
// VOLLSTÄNDIGE Adressierbarkeit abdeckt — sonst fällt eine vergessene Route erst
// im Betrieb auf.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

// [Hash, erwarteter h1-Anfang]
const ROUTES = [
  ['/',                             'Willkommen'],
  ['/services',                     'Dienstleistungen'],
  ['/services/stoerung-melden',     'Störungs'],
  ['/applications',                 'Anwendungen'],
  ['/applications?area=buildings',  'Anwendungen'],
  ['/data',                         'Daten und Digitalisierung'],
  ['/data/catalog',                 'Datenbezug'],
  ['/data/digitalisation',          'Digitalisierung'],
  ['/data/digitalisation/strategy', 'Digitalisierungsstrategie'],
  ['/data/digitalisation/principles', 'Prinzipien'],
  ['/data/ict-projects',            'IKT-Vorhaben'],
  ['/knowledge',                    'Wissen und Hilfsmittel'],
  ['/knowledge/it',                 'Informatik'],
  ['/knowledge/procurement',        'Beschaffung'],
  ['/knowledge/accommodation',      'Unterbringung'],
  ['/knowledge/publishing',         'Publikationen'],
  ['/knowledge/guides',             'Anleitungen und Schulungen'],
  ['/knowledge/processes',          'Prozessdokumentation'],
  ['/news',                         'News'],
  ['/my-cases',                     'Meine Vorgänge'],
  ['/search?q=bau',                 'Suche'],
  ['/app/portfolio',                ''],
  ['/app/media-library',            ''],
  ['/app/dataportal',               ''],
  ['/app/projects',                 'Bauprojekte'],
  ['/app/tenancies',                'Mietende'],
  ['/app/metadata-catalog',         'Metadaten Katalog'],
  ['/app/process-docs',             'Prozessdokumentation'],
  ['/app/shop',                     'BBL Intranetshop'],
  ['/app/document-archive',         'Bauwerksdokumentation'],
  ['/app/space-request',            'Raumbedarf'],
  ['/app/fault-report',             'Störungs'],
  ['/app/building-create',          'Gebäude erfassen'],
  ['/app/workspace',                'Workspace Management'],
  ['/app/transaction',              'Veräusserung'],
  ['/app/api-docs',                 'BBL Kundenportal'],
];

// [Altlast, erwartetes Ziel]
const REDIRECTS = [
  ['/knowledge/news',                 '#/news'],
  ['/knowledge/grundlagen',           '#/knowledge'],
  ['/knowledge/grundlagen/W001',      '#/knowledge'],
  ['/knowledge/anleitungen',          '#/knowledge/guides'],
  ['/knowledge/prozesse',             '#/knowledge/processes'],
  ['/data/katalog',                   '#/data/catalog'],
  ['/data/digitalisierung',           '#/data/digitalisation'],
  ['/data/digitalisierung/strategie', '#/data/digitalisation/strategy'],
  ['/data/ikt-vorhaben',              '#/data/ict-projects'],
  ['/app/mediathek',                  '#/app/media-library'],
];

const fails = [];

const cdp = await launch();
try {
  const page = await openPage(cdp, `${APP_BASE}/`);
  await sleep(1200);

  for (const [route, wantH1] of ROUTES) {
    const got = await page.evaluate(`(async () => {
      location.hash = '#${route}';
      await new Promise(r => setTimeout(r, 700));
      const h1 = document.querySelector('#main-content h1');
      const err = document.querySelector('#main-content .notification--error');
      return { h1: h1 ? h1.textContent.trim() : '', err: err ? err.textContent.trim().slice(0, 120) : '' };
    })()`);
    if (got.err) { fails.push(`${route} → Fehlerband: ${got.err}`); continue; }
    if (!got.h1) { fails.push(`${route} → keine h1`); continue; }
    if (wantH1 && !got.h1.startsWith(wantH1)) fails.push(`${route} → h1 «${got.h1}», erwartet «${wantH1}…»`);
    else console.log(`  ok  ${route.padEnd(34)} h1=«${got.h1.slice(0, 44)}»`);
  }

  for (const [from, want] of REDIRECTS) {
    const got = await page.evaluate(`(async () => {
      location.hash = '#${from}';
      await new Promise(r => setTimeout(r, 700));
      return location.hash;
    })()`);
    if (got !== want) fails.push(`Weiterleitung ${from} → «${got}», erwartet «${want}»`);
    else console.log(`  ok  ${from.padEnd(34)} → ${got}`);
  }

  const probs = await page.problems();
  if (probs.length) fails.push(...probs.map(p => `Seitenproblem: ${p}`));
  await page.closeTarget();
} finally { cdp.close(); }

if (fails.length) { console.error('\nFEHLER:\n' + fails.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
console.log('\nAlle Routen und Weiterleitungen ok.');
