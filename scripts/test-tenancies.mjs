// Mietendenportal (#/app/tenancies) — Übersicht, Detail, Grundriss.
// Geprüft wird vor allem das, was die App von den anderen unterscheidet: der
// SVG-Grundriss mit seinen vier Einfärbemodi, die Raumauswahl samt
// Dienstleistungs-Kurzwegen und der teilbare Zustand im Hash.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let fail = 0;
const check = (cond, label, detail = '') => {
  if (!cond) fail++;
  console.log(`   ${cond ? '✓' : '✗'} ${label}${detail ? '  (' + detail + ')' : ''}`);
};
const head = (s) => console.log('\n■ ' + s);
const clean = async (p, label) => {
  const errs = await p.problems();
  check(!errs.length, `${label}: keine Fehler`, errs.join(' | '));
};

const browser = await launch({ webgl: true });

/* ------------------------------------------------------------- Übersicht -- */
head('Übersicht');
let p = await openPage(browser, APP_BASE + '/app/tenancies');
await sleep(1400);
let o = JSON.parse(await p.evaluate(`JSON.stringify({
  h1: document.querySelector('h1')?.textContent.trim(),
  karten: document.querySelectorAll('.pf-gallery .card').length,
  zahl: document.querySelector('#mt-count')?.textContent.replace(/\\s+/g,' ').trim(),
  kachelraster: document.querySelectorAll('.grid--3').length,
  chips: [...document.querySelectorAll('.pf-card__chips .pf-card__land')].slice(0,2).map(x => x.textContent),
  veFilter: [...document.querySelectorAll('[data-fdim=ve]')].map(x => x.value),
  ansichten: [...document.querySelectorAll('.view-switch__btn')].map(x => x.dataset.view),
})`));
check(o.h1 === 'Mietende', 'Seitentitel', o.h1);
check(o.karten === 9, '9 Karten je Seite in der Galerie', String(o.karten));
check(/18 von 18/.test(o.zahl || ''), 'Trefferzahl', o.zahl);
check(!/m²/.test(o.zahl || '') && !/CHF/.test(o.zahl || ''), 'keine Kennzahlen in der Zählzeile — Auswertungen gehören ins Datenportal');
check(o.kachelraster === 0, 'kein grid--3-Kachelraster mehr');
check(o.chips.length === 2, 'Chips (VE + Geschosse) auf dem Bild', o.chips.join(' | '));
check(o.veFilter.length === 9, '9 Verwaltungseinheiten im Filter', o.veFilter.join(','));
check(o.ansichten.join(',') === 'gallery,list,map', 'drei Ansichten inkl. Karte', o.ansichten.join(','));
await clean(p, 'Übersicht');

head('Filter und räumlicher Baum');
o = JSON.parse(await p.evaluate(`(async () => {
  const cb = [...document.querySelectorAll('[data-fdim=ve]')].find(x => x.value === 'BAFU');
  cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 350));
  return JSON.stringify({ zahl: document.querySelector('#mt-count')?.textContent.replace(/\\s+/g,' ').trim(),
    pille: document.querySelector('.active-filter')?.textContent.trim() });
})()`));
check(/3 von 18/.test(o.zahl || ''), 'Filter BAFU greift', o.zahl);
check(o.pille === 'BAFU', 'Filterpille sichtbar', o.pille);

o = JSON.parse(await p.evaluate(`(async () => {
  document.querySelector('.active-filter')?.click();
  await new Promise(r => setTimeout(r, 300));
  const seite = document.querySelector('.pf-sidebar');
  const wurzeln = [...seite.querySelectorAll('.pf-tree > .pf-tree__item > .pf-tree__node')];
  const laender = wurzeln.map(n => n.querySelector('.pf-tree__label').textContent + ' ' + n.querySelector('.pf-tree__n').textContent);
  const ch = wurzeln.find(n => n.dataset.land === 'CH');
  ch.click();
  await new Promise(r => setTimeout(r, 300));
  const kantone = [...ch.closest('.pf-tree__item').querySelectorAll(':scope > .pf-tree__children > .pf-tree__item > .pf-tree__node .pf-tree__label')].map(x => x.textContent);
  return JSON.stringify({
    sidebar: !!seite,
    titel: seite.querySelector('.pf-sidebar__title')?.textContent.trim(),
    laender,
    chZahl: ch.querySelector('.pf-tree__n')?.textContent,
    kantone,
    zahl: document.querySelector('#mt-count')?.textContent.replace(/\\s+/g,' ').trim(),
  });
})()`));
check(o.sidebar, 'pf-sidebar vorhanden', o.titel);
check(o.laender.length === 6, 'sechs Länder im Baum', o.laender.join(' · '));
check(o.chZahl === '11', 'Schweiz mit Zähler 11', o.chZahl);
check(o.kantone.length >= 3, 'Kantone als zweite Stufe unter der Schweiz', o.kantone.join(', '));

o = JSON.parse(await p.evaluate(`(async () => {
  const bern = [...document.querySelectorAll('.pf-sidebar .pf-tree__node')].find(n => n.dataset.region === 'BE' && !n.dataset.city);
  bern.click();
  await new Promise(r => setTimeout(r, 350));
  return JSON.stringify({ zahl: document.querySelector('#mt-count')?.textContent.replace(/\\s+/g,' ').trim(),
    pille: document.querySelector('.active-filter')?.textContent.trim(),
    loeschen: !document.querySelector('#mt-clear')?.hidden });
})()`));
check(/ von 18 /.test(o.zahl || '') && !/18 von 18/.test(o.zahl || ''), 'Kanton BE grenzt ein', o.zahl);
check(o.pille === 'BE', 'Auswahl als Pille', o.pille);
check(o.loeschen, 'Auswahl-Zurücksetzen wird sichtbar');
await clean(p, 'Baum');

head('Kartenansicht');
o = JSON.parse(await p.evaluate(`(async () => {
  document.querySelector('#mt-clear').click();
  await new Promise(r => setTimeout(r, 250));
  document.querySelector('.view-switch__btn[data-view=map]').click();
  await new Promise(r => setTimeout(r, 2500));
  const el = document.querySelector('#mt-map-el');
  return JSON.stringify({ container: !!el, canvas: !!el?.querySelector('canvas'),
    label: el?.getAttribute('aria-label') });
})()`));
check(o.container, 'Kartencontainer wird gerendert');
check(o.canvas, 'Karte zeichnet (MapLibre-Canvas)', o.label);
await clean(p, 'Karte');
await p.closeTarget();

/* ----------------------------------------------------------------- Detail -- */
head('Detail — Übersicht und Vertrag');
p = await openPage(browser, APP_BASE + '/app/tenancies/MV-2026-001');
await sleep(1400);
o = JSON.parse(await p.evaluate(`JSON.stringify({
  h1: document.querySelector('h1')?.textContent.trim(),
  reiter: [...document.querySelectorAll('.tab__control')].map(x => x.textContent.trim()),
  kv: [...document.querySelectorAll('.kv dt')].map(x => x.textContent.trim()).slice(0,4),
  kurzwege: [...document.querySelectorAll('.fp-svc span')].map(x => x.textContent.trim()),
  inventarLink: document.querySelector('a[href*="app/portfolio?id="]')?.getAttribute('href'),
  antragTitel: [...document.querySelectorAll('.detail-layout h2')].map(h => h.textContent.trim())
    .find(x => /Anträge/.test(x)),
  antragTabelle: !!document.querySelector('#mt-dt-vorgaenge table'),
})`));
check(o.h1 === 'Verwaltungszentrum Guisanplatz', 'Objektname als h1', o.h1);
// Drei Reiter: «Vorgänge» ist kein eigener Reiter mehr, sondern der Abschnitt
// «Anträge zu diesem Mietobjekt» am Fuss der Übersicht — dort, wo die Frage
// gestellt wird, statt einen Klick daneben.
// Zwei Reiter: «Vorgänge» und «Grundrisse» sind Abschnitte der Übersicht
// geworden — als Reiter wurden sie nicht gefunden.
check(o.reiter.length === 2, 'zwei Reiter', o.reiter.join(' | '));
check(o.antragTitel === 'Anträge zu diesem Mietobjekt' && o.antragTabelle,
  'Anträge als Abschnitt der Übersicht', `${o.antragTitel} · Tabelle ${o.antragTabelle}`);
check(o.kv.includes('Verwaltungseinheit') && o.kv.includes('Geschosse'), 'Kerndaten im Übersichtsreiter', o.kv.join(', '));
check(o.kurzwege.length >= 4, 'Dienstleistungs-Kurzwege aus services.json', String(o.kurzwege.length));
check(/1080%2F4850%2FAG/.test(o.inventarLink || ''), 'Querverweis ins Inventar', o.inventarLink);
await clean(p, 'Detail');

head('Kopf: Bildmosaik mit Standortkarte');
o = JSON.parse(await p.evaluate(`(async () => {
  for (let i = 0; i < 60 && !document.querySelector('#mt-hero-map canvas'); i++) await new Promise(r => setTimeout(r, 100));
  const m = document.querySelector('#mt-mosaic');
  return JSON.stringify({
    mosaik: !!m, klassen: m?.className,
    kacheln: m?.querySelectorAll('[data-gallery]').length,
    karte: !!document.querySelector('#mt-hero-map canvas'),
    einzelbild: !!document.querySelector('.container.section > .photo'),
  });
})()`));
check(o.mosaik && /pf-mosaic--map/.test(o.klassen || ''), 'Mosaik mit Karte im Kopf', o.klassen);
check(o.kacheln >= 3, 'Kacheln öffnen die Galerie', String(o.kacheln));
check(o.karte, 'Standortkarte zeichnet');
check(!o.einzelbild, 'kein einzelnes Hero-Bild mehr');

o = JSON.parse(await p.evaluate(`(async () => {
  document.querySelector('#mt-mosaic [data-gallery]').click();
  await new Promise(r => setTimeout(r, 600));
  const ov = document.querySelector('.pf-lightbox');
  const res = { overlay: !!ov, hash: location.hash };
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return JSON.stringify(res);
})()`));
check(o.overlay, 'Kachelklick öffnet die Vollbildgalerie');
check(/bild=/.test(o.hash), 'Bild steht im Hash (teilbar)', o.hash.split('?')[1]);
await clean(p, 'Kopf');

o = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/app/tenancies/MV-2026-001?tab=vertrag';
  await new Promise(r => setTimeout(r, 400));
  return JSON.stringify({ zeilen: document.querySelectorAll('#mt-tab-panel-vertrag tbody tr').length,
    // Der Reiter trägt NUR die Tabelle — keine Merkmalliste, kein Kasten.
    kv: document.querySelectorAll('#mt-tab-panel-vertrag .kv').length,
    boxen: document.querySelectorAll('#mt-tab-panel-vertrag .box').length,
    catbar: !!document.querySelector('#mt-tab-panel-vertrag .catbar'),
    betrag: [...document.querySelectorAll('#mt-tab-panel-vertrag tbody td')].map(x => x.textContent.trim()).find(x => /CHF/.test(x)) });
})()`));
check(o.zeilen > 0, 'Verträge zum Objekt gelistet', String(o.zeilen) + ' Zeilen');
check(o.kv === 0 && o.boxen === 0, 'Reiter trägt nur die Tabelle (keine kv-Liste, keine box)');
check(o.catbar, 'Tabelle mit Katalogleiste');
check(/CHF/.test(o.betrag || ''), 'Beträge in der Tabelle', o.betrag);

/* --------------------------------------------------- Geschosstabelle ------ */
head('Grundriss — Geschosse als Datentabelle');
o = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/app/tenancies/MV-2026-001?tab=grundriss';
  // Auf die fertig montierte Tabelle warten statt auf eine feste Frist: die
  // Route zeichnet nach dem Hashwechsel neu und montiert die Datentabellen
  // danach — eine Pauschalpause misst mal den einen, mal den anderen Zustand.
  for (let i = 0; i < 40 && !document.querySelector('#mt-dt-floors table'); i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 250));
  const host = document.querySelector('#mt-dt-floors');
  const kopf = [...host.querySelectorAll('thead th')].map(x => x.textContent.trim());
  return JSON.stringify({
    keinPlan: !document.querySelector('svg.fp'),
    catbar: !!host.querySelector('.catbar'),
    zeilen: host.querySelectorAll('tbody tr').length,
    klickbar: !!host.querySelector('table.table--rows-clickable'),
    kopf,
    total: [...host.querySelectorAll('tfoot td, tfoot th')].map(x => x.textContent.trim()),
    zahl: host.querySelector('.catbar__count')?.textContent.replace(/\\s+/g,' ').trim(),
  });
})()`));
check(o.keinPlan, 'ohne Geschosswahl zuerst die Tabelle, nicht der Plan');
check(o.catbar, 'Tabelle trägt eine Katalogleiste (C.mountDataTable)');
check(o.zeilen === 2, 'zwei gemietete Geschosse als Zeilen', String(o.zeilen));
check(o.klickbar, 'Zeilen sind klickbar (table--rows-clickable)');
check(o.kopf.includes('Räume') && o.kopf.includes('HNF') && o.kopf.includes('Arbeitsplätze'), 'Mengenspalten', o.kopf.join(' | '));
check(o.total[0] === 'Total', 'Summenzeile', o.total.join(' '));
check(/2 von 2 Geschosse/.test(o.zahl || ''), 'Trefferzahl der Tabelle', o.zahl);
await clean(p, 'Geschosstabelle');

head('Zeilenklick öffnet den Grundriss');
o = JSON.parse(await p.evaluate(`(async () => {
  const tr = document.querySelector('#mt-dt-floors tbody tr');
  tr.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 600));
  return JSON.stringify({ svg: !!document.querySelector('svg.fp'), hash: location.hash,
    zurueck: !!document.querySelector('#fp-zurueck') });
})()`));
check(o.svg, 'Zeilenklick zeigt den Grundriss');
check(/floor=/.test(o.hash), 'Geschoss steht im Hash', o.hash.split('?')[1]);
check(o.zurueck, 'Rücksprung in die Geschossübersicht vorhanden');

o = JSON.parse(await p.evaluate(`(async () => {
  document.querySelector('#fp-zurueck').click();
  await new Promise(r => setTimeout(r, 500));
  return JSON.stringify({ tabelle: !!document.querySelector('#mt-dt-floors table'),
    svg: !!document.querySelector('svg.fp'), hash: location.hash });
})()`));
check(o.tabelle && !o.svg, 'Rücksprung führt zurück zur Tabelle');
check(!/floor=/.test(o.hash), 'Geschoss aus dem Hash entfernt', o.hash);
await clean(p, 'Rücksprung');

/* -------------------------------------------------------------- Grundriss -- */
head('Grundriss');
o = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/app/tenancies/MV-2026-001?tab=grundriss&floor=1080-4850-AG-2og';
  await new Promise(r => setTimeout(r, 600));
  const svg = document.querySelector('svg.fp');
  return JSON.stringify({
    svg: !!svg,
    viewBox: svg?.getAttribute('viewBox'),
    raeume: document.querySelectorAll('.fp__room').length,
    geschosse: document.querySelectorAll('.fp-floors__chip').length,
    aktiv: document.querySelector('.fp-floors__chip.is-active')?.textContent.trim(),
    modi: [...document.querySelectorAll('#fp-color option')].map(x => x.value),
    legende: document.querySelectorAll('.fp-legend__item').length,
    gewaehlt: document.querySelector('#fp-color')?.value,
    kopf: document.querySelector('.fp-head__name')?.textContent.trim(),
    fakten: document.querySelector('.fp-head__facts')?.textContent.trim(),
    knoepfe: [document.querySelector('#fp-vollbild'), document.querySelector('#fp-drucken')].map(Boolean),
    ariaErster: document.querySelector('.fp__room rect')?.getAttribute('aria-label'),
  });
})()`));
check(o.svg, 'Grundriss wird als SVG gezeichnet (kein WebGL)');
check(/^-40 -40 /.test(o.viewBox || ''), 'viewBox aus dem Zeichnungsmass', o.viewBox);
check(o.raeume === 22, '22 Räume im 2. OG', String(o.raeume));
check(o.geschosse === 2, 'zwei gemietete Geschosse zur Wahl', o.aktiv);
check(o.modi.join(',') === 'none,use,sia,ve,capacity', 'fünf Einfärbemodi', o.modi.join(','));
// VORGABE ist die Verwaltungseinheit, nicht «Keine»: ein einfarbiger Plan
// verriet nicht, dass er eingefärbt werden kann. Also OHNE `color=` im Hash
// muss der Plan bereits eingefärbt und die Legende gefüllt sein.
check(o.gewaehlt === 've', 'Vorgabe-Einfärbung: Verwaltungseinheit', o.gewaehlt);
check(o.legende > 0, 'Legende ohne Zutun sichtbar', String(o.legende));
check(o.kopf === '2. OG', 'Geschossname in der Kopfleiste', o.kopf);
check(/Räume/.test(o.fakten || '') && /HNF/.test(o.fakten || ''), 'Kennzahlen in der Kopfleiste', o.fakten);
check(o.knoepfe.every(Boolean), 'Vollbild- und Druckknopf vorhanden', o.knoepfe.join(','));

// Und «Keine» bleibt wählbar — dann darf keine Legende stehen.
const ohne = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/app/tenancies/MV-2026-001?floor=1080-4850-AG-2og&color=none';
  await new Promise(r => setTimeout(r, 600));
  return JSON.stringify({ legende: document.querySelectorAll('.fp-legend__item').length,
    gewaehlt: document.querySelector('#fp-color')?.value });
})()`));
check(ohne.gewaehlt === 'none' && ohne.legende === 0, 'mit «Keine» keine Legende', `${ohne.gewaehlt} / ${ohne.legende}`);
check(/Quadratmeter/.test(o.ariaErster || ''), 'jeder Raum hat ein aria-label', (o.ariaErster || '').slice(0, 60));
await clean(p, 'Grundriss');

head('Einfärbemodi');
for (const [mode, label] of [['use', 'Nutzung'], ['sia', 'SIA 416'], ['ve', 'Verwaltungseinheit'], ['capacity', 'Belegung']]) {
  const r = JSON.parse(await p.evaluate(`(async () => {
    location.hash = '#/app/tenancies/MV-2026-001?tab=grundriss&floor=1080-4850-AG-2og&color=${mode}';
    await new Promise(r => setTimeout(r, 420));
    const fills = [...document.querySelectorAll('.fp__room rect')].map(el => getComputedStyle(el).fill);
    const summen = [...document.querySelectorAll('.fp-legend__val')].map(x => x.textContent.trim());
    return JSON.stringify({ legende: document.querySelectorAll('.fp-legend__item').length,
      farben: new Set(fills).size, summen: summen.slice(0,2) });
  })()`));
  check(r.legende >= 2 && r.farben >= 2, `${label}: Legende (${r.legende}) und ${r.farben} Farben`, r.summen.join(' / '));
}

head('Raumauswahl');
o = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/app/tenancies/MV-2026-001?tab=grundriss&floor=1080-4850-AG-2og&color=use';
  await new Promise(r => setTimeout(r, 500));
  const ziel = [...document.querySelectorAll('.fp__room')].find(g => /buero|arbeit/.test(g.className.baseVal));
  const id = ziel?.dataset.space;
  ziel?.querySelector('rect').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 420));
  return JSON.stringify({
    id,
    panelTitel: document.querySelector('.fp-room h3')?.textContent.trim(),
    kurzwege: document.querySelectorAll('.fp-room .fp-svc').length,
    markiert: document.querySelectorAll('.fp__room.is-selected').length,
    hash: location.hash,
    zielHref: document.querySelector('.fp-room .fp-svc')?.getAttribute('href'),
  });
})()`));
check(!!o.panelTitel, 'Raumdetail erscheint', o.panelTitel);
check(o.markiert === 1, 'gewählter Raum ist markiert');
check(o.kurzwege >= 3, 'Kurzwege im Raumdetail', String(o.kurzwege));
check(/space=/.test(o.hash), 'Auswahl steht im Hash (teilbar)', o.hash.split('?')[1]);
check(/building=1080%2F4850%2FAG/.test(o.zielHref || ''), 'Dienstleistung mit vorbelegtem Objekt', o.zielHref);
await clean(p, 'Raumauswahl');

head('Geschosswechsel');
o = JSON.parse(await p.evaluate(`(async () => {
  const chip = [...document.querySelectorAll('.fp-floors__chip')].find(c => !c.classList.contains('is-active'));
  const label = chip.textContent.trim();
  chip.click();
  await new Promise(r => setTimeout(r, 420));
  return JSON.stringify({ label, aktiv: document.querySelector('.fp-floors__chip.is-active')?.textContent.trim(),
    raeume: document.querySelectorAll('.fp__room').length, hash: location.hash });
})()`));
check(o.aktiv === o.label, 'Geschoss gewechselt', `${o.label} · ${o.raeume} Räume`);
check(/floor=/.test(o.hash), 'Geschoss steht im Hash');
check(!/space=/.test(o.hash), 'Raumauswahl beim Geschosswechsel zurückgesetzt');
await clean(p, 'Geschosswechsel');

await p.closeTarget();

head('Kurzweg belegt die Meldung vor');
p = await openPage(browser, APP_BASE + '/app/fault-report?building=1080%2F4850%2FAG&room=2.%20OG%2005');
await sleep(1200);
o = JSON.parse(await p.evaluate(`(async () => {
  // Der Vorgang verlangt eine Anmeldung; angemeldet erscheint das Formular.
  const btn = [...document.querySelectorAll('button, a')].find(el => /anmelden/i.test(el.textContent));
  if (btn) { btn.click(); await new Promise(r => setTimeout(r, 900)); }
  const sel = document.querySelector('#bld');
  return JSON.stringify({ gebaeude: sel ? sel.value : null, ort: document.querySelector('#ort')?.value });
})()`));
check(o.gebaeude === '1080/4850/AG', 'Gebäude aus dem Grundriss übernommen', o.gebaeude);
check(o.ort === '2. OG 05', 'Raumnummer als Ort übernommen', o.ort);
await p.closeTarget();

head('Nicht gefunden');
p = await openPage(browser, APP_BASE + '/app/tenancies/GIBTESNICHT');
await sleep(900);
check(/nicht gefunden/i.test(await p.evaluate('document.querySelector("h1")?.textContent || ""')), 'unbekannte ID → Hinweis statt Absturz');
await clean(p, 'Nicht gefunden');
await p.closeTarget();

await browser.close();
console.log(fail ? `\n✗ ${fail} Prüfung(en) fehlgeschlagen` : '\n✓ alle Prüfungen bestanden');
process.exit(fail ? 1 : 0);
