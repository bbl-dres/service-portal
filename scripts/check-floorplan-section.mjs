// Grundrisse als ABSCHNITT der Übersicht statt als Reiter: Tabelle im Ruhe-
// zustand, Betrachter an ihrer Stelle nach dem Klick — und alles darüber
// (Seitenkopf, Bildmosaik, Reiterleiste, Eckdaten, Anträge) bleibt stehen.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const URL = `${APP_BASE}/app/tenancies/MV-2026-001`;
const cdp = await launch();
const page = await openPage(cdp, URL);
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false }, page.sessionId);
await sleep(1600);

const lies = () => page.evaluate(`(() => {
  const q = (s) => document.querySelector(s);
  const sichtbar = (s) => { const e = q(s); return !!e && e.offsetParent !== null; };
  return {
    reiter: [...document.querySelectorAll('[role="tab"]')].map(t => t.textContent.trim()),
    reiterleiste: sichtbar('.tab__controls'),
    abschnitt: q('#mt-grundriss > h2')?.textContent.trim(),
    tabelle: !!q('#mt-dt-floors table'),
    betrachter: !!q('#fp-wrap'),
    kopfName: q('.fp-head__name')?.textContent.trim(),
    kopfFakten: q('.fp-head__facts')?.textContent.trim(),
    vollbild: !!q('#fp-vollbild'), drucken: !!q('#fp-drucken'), zurueck: !!q('#fp-zurueck'),
    farbe: q('#fp-color')?.value,
    legende: document.querySelectorAll('.fp-legend__item').length,
    raumPanel: !!q('#fp-room'),
    // Bleibt der Kontext über dem Abschnitt stehen?
    eckdaten: !!q('.kpi-strip'), antraege: !!q('#mt-dt-vorgaenge table'), mosaik: !!q('#mt-mosaic'),
    // Reihenfolge der drei Abschnitte in der Übersicht.
    reihenfolge: [...document.querySelectorAll('.detail-layout > div > section, .detail-layout .box')]
      .map(e => (e.querySelector(':scope > h2')?.textContent.trim() || '').split(' ')[0]),
    klebt: q('.fp-head') ? getComputedStyle(q('.fp-head')).position : null,
    hash: location.hash,
  };
})()`);

const vorher = await lies();
// Erste Geschosszeile anklicken.
await page.evaluate(`document.querySelector('#mt-dt-floors tbody a')?.click()`);
await sleep(800);
const nachher = await lies();

// Zurück zur Tabelle.
await page.evaluate(`document.querySelector('#fp-zurueck')?.click()`);
await sleep(700);
const zurueck = await lies();

// Alter Deep-Link mit ?tab=grundriss muss weiterhin den Plan öffnen.
const alt = await page.evaluate(`(async () => {
  location.hash = '#/app/tenancies/MV-2026-001?tab=grundriss&floor=1080-4850-AG-2og&color=use';
  await new Promise(r => setTimeout(r, 800));
  return JSON.stringify({ betrachter: !!document.querySelector('#fp-wrap'),
    farbe: document.querySelector('#fp-color')?.value,
    aktiverReiter: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent.trim() });
})()`).then(JSON.parse);

// Druckmarke: nur der Grundrissabschnitt bleibt sichtbar. Die Regeln stehen in
// `@media print` — ohne umgeschaltetes Medium misst man den Bildschirmzustand.
await page.evaluate(`document.body.classList.add('print--plan')`);
await cdp.send('Emulation.setEmulatedMedia', { media: 'print' }, page.sessionId);
await sleep(200);
const druck = await page.evaluate(`(() => {
  const sicht = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).visibility : null; };
  const zeigt = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).display : null; };
  return JSON.stringify({
    inhalt: sicht('#main-content'), abschnitt: sicht('#mt-grundriss'), plan: sicht('svg.fp'),
    legende: zeigt('.fp-legend'),            // der Schlüssel zur Einfärbung MUSS mitdrucken
    raumdetail: zeigt('#fp-room'),           // Bedienelemente nicht
    knoepfe: zeigt('.fp-head__actions'),
    geschosswahl: zeigt('.fp-toolbar'),
    fusszeile: zeigt('.fp-print-foot'),      // nur im Druck sichtbar
    abschnittTitel: zeigt('#mt-grundriss > h2'),
  });
})()`).then(JSON.parse);
await cdp.send('Emulation.setEmulatedMedia', { media: '' }, page.sessionId);
await page.evaluate(`document.body.classList.remove('print--plan')`);

await cdp.close();
console.log(JSON.stringify({ vorher, nachher, zurueck, alt, druck }, null, 1));

const p = [
  ['zwei Reiter, Grundrisse nicht darunter', vorher.reiter.length === 2 && !vorher.reiter.some((x) => /Grundriss/.test(x))],
  ['Abschnitt «Grundrisse» in der Übersicht', vorher.abschnitt === 'Grundrisse'],
  ['Reihenfolge Vertrag → Anträge → Grundrisse (+ Randspalte)',
    vorher.reihenfolge.join('>') === 'Vertrag>Grundrisse>Anträge>Aktionen>Ansprechpersonen'],
  ['Ruhezustand: Geschosstabelle', vorher.tabelle && !vorher.betrachter],
  ['Klick öffnet den Betrachter an ihrer Stelle', nachher.betrachter && !nachher.tabelle],
  ['Reiterleiste bleibt sichtbar', nachher.reiterleiste],
  ['Eckdaten, Anträge und Mosaik bleiben stehen', nachher.eckdaten && nachher.antraege && nachher.mosaik],
  ['Kopfleiste: Geschossname + Kennzahlen', !!nachher.kopfName && /Räume/.test(nachher.kopfFakten || '')],
  ['Kopfleiste: Zurück, Vollbild, Drucken', nachher.zurueck && nachher.vollbild && nachher.drucken],
  ['Kopfleiste klebt', nachher.klebt === 'sticky'],
  ['Vorgabe-Einfärbung Verwaltungseinheit, Legende gefüllt', nachher.farbe === 've' && nachher.legende > 0],
  ['Raumdetail vorhanden', nachher.raumPanel],
  ['Zurück führt in die Tabelle', zurueck.tabelle && !zurueck.betrachter],
  ['alter ?tab=grundriss-Link öffnet weiterhin den Plan', alt.betrachter && alt.farbe === 'use'],
  ['… und landet auf der Übersicht', alt.aktiverReiter === 'Übersicht'],
  ['Druck: nur der Grundrissabschnitt sichtbar', druck.inhalt === 'hidden' && druck.abschnitt === 'visible' && druck.plan === 'visible'],
  ['Druck: Legende ist dabei (Schlüssel zur Einfärbung)', druck.legende !== 'none'],
  ['Druck: Bedienelemente und Raumdetail nicht', ['raumdetail', 'knoepfe', 'geschosswahl', 'abschnittTitel'].every((k) => druck[k] === 'none')],
  ['Druck: Fusszeile mit Objekt/Geschoss/Einfärbung', druck.fusszeile === 'block'],
];
let fehler = 0;
for (const [was, ok] of p) { if (!ok) fehler++; console.log(`${ok ? '  ok ' : ' FEHL'} ${was}`); }
console.log(fehler ? `\n${fehler} Abweichungen` : '\nGrundriss-Abschnitt, Kopfleiste und Druck verhalten sich wie entworfen.');
process.exit(fehler ? 1 : 0);
