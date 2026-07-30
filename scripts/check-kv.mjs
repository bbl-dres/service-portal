// Merkmalliste: Doppelpunkt an jeder Beschriftung, spürbarer Abstand zwischen
// Beschriftungs- und Wertespalte — und zwar in JEDER App, die .kv verwendet.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const SEITEN = [
  ['Portfolio (Gebäude)', `${APP_BASE}/app/portfolio?id=${encodeURIComponent('1080/4840/AF')}`],
  ['Bauprojekt',          `${APP_BASE}/app/projects/PRJ-01`],
  ['Mietende',            `${APP_BASE}/app/tenancies/MV-2019-0001`],
  ['Anwendung',           `${APP_BASE}/applications/portfolio`],
  ['Mediathek',           `${APP_BASE}/app/media-library`],
];

const cdp = await launch();
let fehler = 0;
for (const [name, url] of SEITEN) {
  const page = await openPage(cdp, url);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await sleep(1200);
  const r = await page.evaluate(`(() => {
    const dt = document.querySelector('.kv dt');
    if (!dt) return { keine: true };
    const cs = getComputedStyle(dt.parentElement);
    // ::after ist im textContent nicht enthalten — über die CSSOM lesen.
    const after = getComputedStyle(dt, '::after').content;
    return { label: dt.textContent.trim(), after, spalten: cs.gridTemplateColumns, luecke: cs.columnGap };
  })()`);
  if (r.keine) { console.log(`  –   ${name.padEnd(20)} keine .kv auf der Seite`); await page.closeTarget(); continue; }
  const ok = r.after === '":"' && parseFloat(r.luecke) >= 24 && r.spalten.split(' ').length === 2;
  if (!ok) fehler++;
  console.log(`${ok ? '  ok ' : ' FEHL'} ${name.padEnd(20)} «${r.label}${r.after === '":"' ? ':' : ''}» · Lücke ${r.luecke} · Spuren ${r.spalten}`);
  await page.closeTarget();
}
await cdp.close();
console.log(fehler ? `\n${fehler} Abweichungen` : '\nDoppelpunkt und Spaltenabstand sind überall gleich.');
process.exit(fehler ? 1 : 0);
