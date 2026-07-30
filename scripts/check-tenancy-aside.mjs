// Mietende, Detailansicht: klebende Randspalte, Abschnitte in der
// Hauptspalte und die vier neuen Bausteine (Augenbrauenzeile,
// Restlaufzeit-Abzeichen, Kennzahlenzeile, Klick-Winkel). Der Grund bleibt
// WEISS wie in allen anderen Micro-Apps — das getönte Band aus dem
// Mieterportal-Prototyp ist bewusst nicht übernommen.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const cdp = await launch();
const page = await openPage(cdp, `${APP_BASE}/app/tenancies/MV-2026-001`);
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
await sleep(1600);

const r = await page.evaluate(`(() => {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const aside = q('.detail-layout__aside');
  const panels = qa('.detail-layout__aside > .box');
  const farbe = (e) => e ? getComputedStyle(e).backgroundColor : null;
  return {
    // --- Aufbau ---
    hauptPanels: qa('.tab__container:not([hidden]) section').map(p => p.querySelector(':scope > h2')?.textContent.trim()),
    randPanels: panels.map(p => p.querySelector(':scope > h2')?.textContent.trim()),
    ebenen: qa('.tab__container:not([hidden]) section > h2, .detail-layout__aside .box > h2').map(h => h.tagName),
    seitenFarbe: farbe(q('#main-content')),
    // --- Kopf ---
    eyebrow: q('.eyebrow')?.textContent.trim(),
    chip: q('.pill-row .badge')?.textContent.trim(),
    // --- Kennzahlenzeile ---
    kpiLabels: qa('.kpi-strip__label').map(e => e.textContent.trim()),
    kpiSpalten: q('.kpi-strip') ? getComputedStyle(q('.kpi-strip')).gridTemplateColumns.split(' ').length : 0,
    // --- Randspalte ---
    klebt: aside ? getComputedStyle(aside).position : null,
    asideBreite: aside ? Math.round(aside.getBoundingClientRect().width) : null,
    hauptBreite: q('.detail-layout > div') ? Math.round(q('.detail-layout > div').getBoundingClientRect().width) : null,
    // --- Rolle nicht doppelt, Merkmalliste gestapelt ---
    rollen: qa('.detail-layout__aside .kv dt').map(d => d.textContent.trim()),
    doppelt: (() => { const dt = qa('.detail-layout__aside .kv dt').map(d => d.textContent.trim());
      const dd = qa('.detail-layout__aside .kv dd').map(d => d.textContent.trim());
      return dt.some((rolle, i) => (dd[i] || '').startsWith(rolle)); })(),
    // --- Weg in die Bauwerksdokumentation statt eines Dokumentenabschnitts ---
    dokLink: q('.detail-layout__aside a[href*="document-archive"]')?.getAttribute('href'),
    dokAbschnitt: qa('.tab__container:not([hidden]) section > h2, .detail-layout__aside .box > h2').some(h => /Dokument/.test(h.textContent)),
    // --- Klick-Winkel an anklickbaren Zeilen ---
    winkel: (() => { const z = q('.table--rows-clickable tbody tr > :last-child');
      return z ? getComputedStyle(z, '::after').maskImage || getComputedStyle(z, '::after').webkitMaskImage : null; })(),
    // --- «Davon <VE>» in der Geschosstabelle ---
    geschossSpalten: qa('#mt-dt-floors thead th').map(e => e.textContent.trim()),
    ihrStandort: qa('#mt-dt-floors tbody .badge').map(e => e.textContent.trim()),
  };
})()`);

// Klebeprobe: nach unten scrollen und sehen, ob die Randspalte im Bild bleibt.
const kleben = await page.evaluate(`(async () => {
  const aside = document.querySelector('.detail-layout__aside');
  const vorher = Math.round(aside.getBoundingClientRect().top);
  window.scrollTo(0, 1200);
  await new Promise(r => setTimeout(r, 250));
  const nachher = Math.round(aside.getBoundingClientRect().top);
  const sichtbar = nachher >= 0 && nachher < window.innerHeight;
  window.scrollTo(0, 0);
  return JSON.stringify({ vorher, nachher, sichtbar });
})()`).then(JSON.parse);

await cdp.close();
console.log(JSON.stringify({ ...r, kleben }, null, 1));

const p = [
  ['zwei Abschnitte in der Übersicht (Grundrisse ist ein eigener Reiter)', r.hauptPanels.join(' · ') === 'Vertrag und Mengengerüst · Anträge zu diesem Mietobjekt'],
  ['zwei Karten in der Randspalte (Aktionen · Ansprechpersonen)', r.randPanels.join(' · ') === 'Aktionen · Ansprechpersonen'],
  ['alle Kartentitel auf h2', r.ebenen.every((e) => e === 'H2')],
  ['Seite bleibt weiss (kein getöntes Band)', /255, 255, 255/.test(r.seitenFarbe || '') || r.seitenFarbe === 'rgba(0, 0, 0, 0)'],
  ['Augenbrauenzeile mit Kennungen', /MV-2026-001/.test(r.eyebrow || '') && /Objekt/.test(r.eyebrow || '')],
  ['Restlaufzeit als Abzeichen im Kopf', /noch /.test(r.chip || '')],
  ['Kennzahlenzeile mit vier Zahlen', r.kpiLabels.length === 4 && r.kpiSpalten === 4],
  ['Randspalte klebt', r.klebt === 'sticky'],
  ['Randspalte bleibt beim Scrollen im Bild', kleben.sichtbar && kleben.nachher !== kleben.vorher - 1200],
  ['Hauptspalte breiter als vorher (~944px)', r.hauptBreite > 900],
  ['Rolle nicht im Wert wiederholt', r.doppelt === false],
  ['Weg in die Bauwerksdokumentation, gefiltert', /building=/.test(r.dokLink || '')],
  ['kein eigener Dokumentenabschnitt', r.dokAbschnitt === false],
  ['Klick-Winkel an anklickbaren Zeilen', /ChevronRight/.test(r.winkel || '')],
  ['Geschosstabelle mit «Davon <VE>»', r.geschossSpalten.some((s) => /^Davon /.test(s))],
  ['«Ihr Standort» markiert', r.ihrStandort.some((s) => s === 'Ihr Standort')],
];
let fehler = 0;
for (const [was, ok] of p) { if (!ok) fehler++; console.log(`${ok ? '  ok ' : ' FEHL'} ${was}`); }
console.log(fehler ? `\n${fehler} Abweichungen` : '\nDetailansicht steht: weisser Grund, klebende Randspalte, Kennzahlen, Winkel.');
process.exit(fehler ? 1 : 0);
