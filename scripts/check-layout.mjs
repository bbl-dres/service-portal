// Misst, ob die Hauptspalte links bündig mit dem übrigen Seiteninhalt steht,
// und ob noch irgendwo eine pill-row über einem Titel hängt.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const b = await launch({ port: 9370 });
const probe = `(() => {
  const l = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().left) : null; };
  const main = document.querySelector('.container__main');
  const aside = document.querySelector('.container__aside');
  return JSON.stringify({
    h1: l('h1'),
    container: l('.container'),
    main: main ? Math.round(main.getBoundingClientRect().left) : null,
    mainBreite: main ? Math.round(main.getBoundingClientRect().width) : null,
    aside: aside ? Math.round(aside.getBoundingClientRect().left) : null,
    ueberlappung: (main && aside) ? Math.round(main.getBoundingClientRect().right) > Math.round(aside.getBoundingClientRect().left) : null,
    pillRows: document.querySelectorAll('.pill-row').length,
    pillVorTitel: !!document.querySelector('.pill-row ~ h1, .container > .pill-row'),
  });
})()`;

for (const [route, label] of [
  ['/services/stoerung-melden', 'Dienstleistung (main+aside)'],
  ['/app/tenancies/MV-2026-001', 'Mietverhältnis'],
  ['/app/projects/PRJ-04', 'Bauprojekt'],
  ['/app/portfolio?id=1080%2F4840%2FAF', 'Liegenschaft (Referenz)'],
  ['/applications/liegenschaften-inventar', 'Anwendung'],
]) {
  const p = await openPage(b, APP_BASE + route);
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, p.sessionId);
  await sleep(1500);
  const o = JSON.parse(await p.evaluate(probe));
  const buendig = o.main == null || o.main === o.h1;
  console.log(`${label.padEnd(30)} h1:${String(o.h1).padStart(4)}  main:${String(o.main).padStart(5)}  breite:${String(o.mainBreite).padStart(5)}  aside:${String(o.aside).padStart(5)}  ${buendig ? '✓ bündig' : '✗ eingerückt'}  pill-rows:${o.pillRows}${o.ueberlappung ? '  ⚠ Überlappung' : ''}`);
  const errs = await p.problems();
  if (errs.length) console.log('   ⚠', errs.join(' | '));
  await p.closeTarget();
}
await b.close();
