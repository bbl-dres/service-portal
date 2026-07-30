// Portfolio-Galerie: die Fusszeilen einer Rasterreihe müssen auf derselben
// Höhe enden, und der Objektart-Chip darf nicht mehr auftauchen.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const cdp = await launch();
const page = await openPage(cdp, `${APP_BASE}/app/portfolio`);
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
await sleep(1400);

const r = await page.evaluate(`(() => {
  const karten = [...document.querySelectorAll('.pf-gallery .pf-card')];
  if (!karten.length) return { fehler: 'keine Karten' };
  // Erste Rasterreihe = alle Karten mit derselben Oberkante wie die erste.
  const oben = Math.round(karten[0].getBoundingClientRect().top);
  const reihe = karten.filter(k => Math.round(k.getBoundingClientRect().top) === oben);
  const fussUnten = reihe.map(k => Math.round(k.querySelector('.card__footer').getBoundingClientRect().bottom));
  const chips = [...document.querySelectorAll('.pf-card__chips .pf-card__land')].map(c => c.textContent.trim());
  return {
    karten: karten.length,
    inReihe: reihe.length,
    fussUnten: [...new Set(fussUnten)],
    chipsProKarte: [...new Set([...document.querySelectorAll('.pf-card__chips')].map(c => c.children.length))],
    art: chips.filter(c => c === 'Gebäude' || c === 'Grundstück').length,
    beispielChips: [...(document.querySelector('.pf-card__chips')?.children || [])].map(c => c.textContent.trim()),
  };
})()`);
console.log(JSON.stringify(r, null, 2));
await cdp.close();

const ok = r.inReihe > 1 && r.fussUnten.length === 1 && r.art === 0;
console.log(ok
  ? `\nok — ${r.inReihe} Karten in der ersten Reihe, alle Fusszeilen enden bei ${r.fussUnten[0]}px; kein Objektart-Chip mehr.`
  : '\nFEHLER');
process.exit(ok ? 0 : 1);
