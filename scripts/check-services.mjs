// Prüft den erweiterten Dienstleistungskatalog Ende zu Ende: Anzahl, Themenfilter,
// je eine neue Detailseite, den neuen Kleinauftrag-Zweig der Meldungs-App und
// den Drawer-Zweig «Beschaffung» (Domäne E hatte vorher keinen Vorgang).
const { launch, openPage, APP_BASE, sleep } = await import('file:///C:/Users/david/Documents/GitHub/service-portal/scripts/lib/cdp.mjs');

const CASES = [
  ['/services', `(() => {
     const n = document.querySelector('#svc-count')?.textContent.replace(/\\s+/g,' ').trim();
     const themes = [...document.querySelectorAll('#svc-filters input[name=topic]')].map(i => i.value).join(',');
     return n + ' | Themen: ' + themes;
   })()`],
  ['/services?topic=E', `(() => {
     const n = document.querySelector('#svc-count')?.textContent.replace(/\\s+/g,' ').trim();
     const pill = document.querySelector('.active-filter')?.textContent.trim();
     return n + ' | Pille: ' + pill;
   })()`],
  ['/services/mobiliarschluessel-bestellen', `document.querySelector('h1')?.textContent.trim() + ' | Kontakt: ' + (document.querySelector('.container__aside')?.textContent.match(/[\\w._-]+@bbl\\.admin\\.ch/)||['—'])[0]`],
  ['/services/delegation-beantragen', `document.querySelector('h1')?.textContent.trim() + ' | Schritte: ' + document.querySelectorAll('.pipeline__step').length`],
  ['/services/publikationsauftrag', `document.querySelector('h1')?.textContent.trim() + ' | Ablaufblock: ' + !!document.querySelector('.pipeline')`],
  ['/services/unbefangenheitserklaerung', `document.querySelector('h1')?.textContent.trim()`],
  ['/app/fault-report?type=kleinauftrag', `document.querySelector('h1')?.textContent.trim()`],
];

const b = await launch({ port: 9342 });
let bad = 0;
for (const [route, probe] of CASES) {
  const p = await openPage(b, APP_BASE + route);
  await sleep(700);
  const v = await p.evaluate(probe);
  const errs = p.problems ? p.problems() : [...p.exceptions, ...p.consoleErrors];
  const ok = v && !String(v).includes('undefined') && !String(v).includes('nicht gefunden') && !errs.length;
  if (!ok) bad++;
  console.log((ok ? 'OK   ' : 'FEHL ') + route.padEnd(42) + ' → ' + v + (errs.length ? '  ⚠ ' + errs.join(' | ') : ''));
  await p.closeTarget();
}
await b.close();
console.log(bad ? `\n${bad} Fehler` : '\nAlle Fälle grün.');
process.exit(bad ? 1 : 0);
