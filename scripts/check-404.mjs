// Verify all thirteen not-found paths: heading, back link, final breadcrumb,
// and a sentence linking to the relevant overview.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const CASES = [
  ['Dashboard',    '/app/dataportal/gibtsnicht',      'Dashboard nicht gefunden'],
  ['Media item',   '/app/media-library/MED-9999',     'Medium nicht gefunden'],
  ['Object',       '/app/portfolio?id=XX%2F9999',     'Objekt nicht gefunden'],
  ['Project',      '/app/projects/PRJ-9999',          'Projekt nicht gefunden'],
  ['Tenancy',      '/app/tenancies/MV-9999',         'Mietverhältnis nicht gefunden'],
  ['Application',  '/applications/gibtsnicht',        'Anwendung nicht gefunden'],
  ['Dataset',      '/data/catalog/gibtsnicht',        'Datensatz nicht gefunden'],
  ['Data page',    '/data/gibtsnicht',                'Seite nicht gefunden'],
  ['Digital page', '/data/digitalisation/gibtsnicht', 'Seite nicht gefunden'],
  ['Subject area', '/knowledge/gibtsnicht',           'Seite nicht gefunden'],
  ['Service',      '/services/gibtsnicht',            'Dienstleistung nicht gefunden'],
  ['API',          '/app/api-docs/gibtsnicht',        'API nicht gefunden'],
  ['News item',    '/news/gibtsnicht',                'Mitteilung nicht gefunden'],
];

const cdp = await launch();
// All routes run in one page, so establish the session on the public entry URL.
// Later hash changes do not rerun openPage()'s automatic /app/ detection.
const page = await openPage(cdp, `${APP_BASE}/`, { login: true });
await sleep(700);
let failures = 0;
for (const [name, route, expected] of CASES) {
  const r = await page.evaluate(`(async () => {
    location.hash = '#${route}';
    await new Promise(r => setTimeout(r, 800));
    const h1 = document.querySelector('#main-content h1');
    const backLink = document.querySelector('#main-content .back-link, #main-content .back-link-row a, #main-content a[class*=back]');
    const breadcrumbs = [...document.querySelectorAll('.breadcrumb-navigation li, .breadcrumb li')].map(li => li.textContent.trim()).filter(Boolean);
    const message = document.querySelector('#main-content p.muted');
    return {
      h1: h1 ? h1.textContent.trim() : '',
      backLink: !!backLink,
      finalBreadcrumb: breadcrumbs[breadcrumbs.length - 1] || '',
      link: message ? !!message.querySelector('a') : false,
    };
  })()`);
  const ok = r.h1 === expected && r.backLink && r.link && r.finalBreadcrumb === 'Nicht gefunden';
  if (!ok) failures++;
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name.padEnd(16)} h1="${r.h1}" / back ${r.backLink ? 'yes' : 'NO'} / breadcrumb "${r.finalBreadcrumb}" / link ${r.link ? 'yes' : 'NO'}`);
}
await cdp.close();
console.log(failures ? `\n${failures} discrepancies` : `\nAll ${CASES.length} paths use the same structure.`);
process.exit(failures ? 1 : 0);
