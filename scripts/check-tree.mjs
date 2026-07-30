// Die Zahlen im Strukturbaum müssen der aktiven Filterlage folgen: die Summe
// über die sichtbaren Wurzelknoten muss der Trefferzahl in der Werkzeugleiste
// entsprechen — vor und nach dem Umschalten eines Filters.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const APPS = [
  ['Portfolio',   `${APP_BASE}/app/portfolio`,  '#pf-count'],
  ['Bauprojekte', `${APP_BASE}/app/projects`,   '#pj-count'],
  ['Mietende',    `${APP_BASE}/app/tenancies`,  '#mt-count'],
];

const LIES = (zaehler) => `(() => {
  const wurzeln = [...document.querySelectorAll('.pf-tree > .pf-tree__item')].filter(li => !li.hidden);
  const summe = wurzeln.reduce((s, li) => s + Number(li.querySelector('.pf-tree__n').textContent || 0), 0);
  const c = document.querySelector('${zaehler}');
  // «21 von 41 Objekte · Seite 1 von 3» → die erste Zahl ist die Trefferzahl.
  const treffer = c ? Number((c.textContent.match(/[0-9'’]+/) || ['0'])[0].replace(/['’]/g, '')) : null;
  return { summe, treffer, wurzeln: wurzeln.length,
           blaetter: [...document.querySelectorAll('.pf-tree__leaf')].filter(b => !b.closest('.pf-tree__item').hidden).length };
})()`;

const cdp = await launch();
let fehler = 0;
for (const [name, url, zaehler] of APPS) {
  const page = await openPage(cdp, url);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await sleep(1300);

  const vorher = await page.evaluate(LIES(zaehler));
  // Ersten Facettenfilter umschalten und erneut messen.
  const umgeschaltet = await page.evaluate(`(async () => {
    const knopf = document.querySelector('[id$="-ftoggle"], .catbar__filter');
    if (knopf) knopf.click();
    await new Promise(r => setTimeout(r, 150));
    const box = document.querySelector('.filter-check input[type=checkbox]');
    if (!box) return false;
    box.click();
    await new Promise(r => setTimeout(r, 400));
    return true;
  })()`);
  const nachher = umgeschaltet ? await page.evaluate(LIES(zaehler)) : null;

  const ok = vorher.summe === vorher.treffer
    && (!nachher || (nachher.summe === nachher.treffer && nachher.summe !== vorher.summe));
  if (!ok) fehler++;
  console.log(`${ok ? '  ok ' : ' FEHL'} ${name.padEnd(12)} vorher Baum ${vorher.summe} / Treffer ${vorher.treffer}` +
    (nachher ? ` · nach Filterwechsel Baum ${nachher.summe} / Treffer ${nachher.treffer}` : ' · kein Filter gefunden'));
  await page.closeTarget();
}
await cdp.close();
console.log(fehler ? `\n${fehler} Abweichungen` : '\nDie Baumzahlen folgen der Filterlage.');
process.exit(fehler ? 1 : 0);
