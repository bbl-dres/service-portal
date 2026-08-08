// Route sweep: render every route in docs/sitemap.md section 3 and verify every
// legacy redirect in section 7.
//
// Component suites cover one area at a time. This sweep protects complete
// addressability after route and parameter changes.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

// [hash, expected German UI h1 prefix]
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
  ['/app/floorplan-editor?building=1080%2F6650%2FAA&floor=1080-6650-AA-2og', 'Plan-Editor'],
  ['/app/plan-check',               'Planprüfung'],
  ['/app/room-booking',             'Raumbuchung'],
  ['/app/transaction',              'Veräusserung'],
  ['/app/api-docs',                 'BBL Kundenportal'],
];

// [legacy route, expected target]
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
  ['/app/workspace?tab=buchung',      '#/app/room-booking'],
  ['/app/workspace?tab=moeblierung',  '#/app/shop'],
  ['/app/workspace?tab=belegung',     '#/app/workspace'],
];

const fails = [];

const cdp = await launch();
try {
  // Run authenticated so application routes render their contents. The login
  // gate has dedicated coverage in scripts/test-tabs.mjs.
  const page = await openPage(cdp, `${APP_BASE}/`, { login: true });
  await sleep(1200);

  for (const [index, [route, wantH1]] of ROUTES.entries()) {
    const marker = `route-probe-${index}`;
    await page.evaluate(`(() => {
      const previous = document.querySelector('#main-content h1');
      if (previous) previous.dataset.routeProbe = ${JSON.stringify(marker)};
      location.hash = '#${route}';
    })()`);
    await page.waitFor(`(() => {
      const h1 = document.querySelector('#main-content h1');
      const err = document.querySelector('#main-content .notification--error');
      return Boolean(err || (h1 && h1.dataset.routeProbe !== ${JSON.stringify(marker)}));
    })()`);
    const got = await page.evaluate(`(() => {
      const h1 = document.querySelector('#main-content h1');
      const err = document.querySelector('#main-content .notification--error');
      return { h1: h1 ? h1.textContent.trim() : '', err: err ? err.textContent.trim().slice(0, 120) : '' };
    })()`);
    if (got.err) { fails.push(`${route} -> error banner: ${got.err}`); continue; }
    if (!got.h1) { fails.push(`${route} -> missing h1`); continue; }
    if (wantH1 && !got.h1.startsWith(wantH1)) fails.push(`${route} -> h1 "${got.h1}", expected "${wantH1}..."`);
    else console.log(`  ok  ${route.padEnd(34)} h1="${got.h1.slice(0, 44)}"`);
  }

  for (const [index, [from, want]] of REDIRECTS.entries()) {
    const marker = `redirect-probe-${index}`;
    await page.evaluate(`(() => {
      const previous = document.querySelector('#main-content h1');
      if (previous) previous.dataset.routeProbe = ${JSON.stringify(marker)};
      location.hash = '#${from}';
    })()`);
    // When the target declares no query, compare only the path. Views that
    // mirror search state into the URL may append criteria after rendering.
    const norm = (h) => (want.includes('?') ? h : String(h).split('?')[0]);
    await page.waitFor(`(() => {
      const h1 = document.querySelector('#main-content h1');
      const err = document.querySelector('#main-content .notification--error');
      const hash = ${JSON.stringify(want.includes('?'))} ? location.hash : location.hash.split('?')[0];
      return hash === ${JSON.stringify(want)} && Boolean(err || (h1 && h1.dataset.routeProbe !== ${JSON.stringify(marker)}));
    })()`);
    const got = await page.evaluate('location.hash');
    if (norm(got) !== want) fails.push(`redirect ${from} -> "${got}", expected "${want}"`);
    else console.log(`  ok  ${from.padEnd(34)} -> ${got}`);
  }

  const probs = await page.problems();
  if (probs.length) fails.push(...probs.map(p => `page problem: ${p}`));
  await page.closeTarget();
} finally { cdp.close(); }

if (fails.length) { console.error('\nFAILURES:\n' + fails.map(f => '  failed ' + f).join('\n')); process.exit(1); }
console.log('\nAll routes and redirects passed.');
