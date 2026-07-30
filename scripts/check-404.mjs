// Alle dreizehn «nicht gefunden»-Wege: Überschrift, Zurück-Leiste, Brotkrumen
// mit dem Abschluss «Nicht gefunden» und ein Satz, der auf die Übersicht führt.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const WEGE = [
  ['Dashboard',      '/app/dataportal/gibtsnicht',   'Dashboard nicht gefunden'],
  ['Medium',         '/app/media-library/MED-9999',  'Medium nicht gefunden'],
  ['Objekt',         '/app/portfolio?id=XX%2F9999',  'Objekt nicht gefunden'],
  ['Bauprojekt',     '/app/projects/PRJ-9999',       'Projekt nicht gefunden'],
  ['Mietverhältnis', '/app/tenancies/MV-9999',       'Mietverhältnis nicht gefunden'],
  ['Anwendung',      '/applications/gibtsnicht',     'Anwendung nicht gefunden'],
  ['Datensatz',      '/data/catalog/gibtsnicht',     'Datensatz nicht gefunden'],
  ['Daten-Seite',    '/data/gibtsnicht',             'Seite nicht gefunden'],
  ['Digi-Seite',     '/data/digitalisation/gibtsnicht', 'Seite nicht gefunden'],
  ['Fachgebiet',     '/knowledge/gibtsnicht',        'Seite nicht gefunden'],
  ['Meldung',        '/news/gibtsnicht',             'Meldung nicht gefunden'],
  ['Dienstleistung', '/services/gibtsnicht',         'Dienstleistung nicht gefunden'],
];

const cdp = await launch();
const page = await openPage(cdp, `${APP_BASE}/`);
await sleep(700);
let fehler = 0;
for (const [name, route, erwartet] of WEGE) {
  const r = await page.evaluate(`(async () => {
    location.hash = '#${route}';
    await new Promise(r => setTimeout(r, 800));
    const h1 = document.querySelector('#main-content h1');
    const zurueck = document.querySelector('#main-content .back-link, #main-content .back-link-row a, #main-content a[class*=back]');
    const krumen = [...document.querySelectorAll('.breadcrumb-navigation li, .breadcrumb li')].map(li => li.textContent.trim()).filter(Boolean);
    const satz = document.querySelector('#main-content p.muted');
    return {
      h1: h1 ? h1.textContent.trim() : '',
      zurueck: !!zurueck,
      letzteKrume: krumen[krumen.length - 1] || '',
      link: satz ? !!satz.querySelector('a') : false,
    };
  })()`);
  const ok = r.h1 === erwartet && r.zurueck && r.link && r.letzteKrume === 'Nicht gefunden';
  if (!ok) fehler++;
  console.log(`${ok ? '  ok ' : ' FEHL'} ${name.padEnd(16)} h1=«${r.h1}» · Zurück ${r.zurueck ? 'ja' : 'NEIN'} · Krume «${r.letzteKrume}» · Link ${r.link ? 'ja' : 'NEIN'}`);
}
await cdp.close();
console.log(fehler ? `\n${fehler} Abweichungen` : `\nAlle ${WEGE.length} Wege liefern denselben Aufbau.`);
process.exit(fehler ? 1 : 0);
