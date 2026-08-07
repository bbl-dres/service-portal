// Metadaten Katalog (#/app/metadata-catalog) — Bestand, Seitenbaum, beide
// Detailansichten und die Abbildung, die den Katalog trägt.
//
// Geprüft wird vor allem das, was diese App von den übrigen Katalogen
// unterscheidet: die zwei Bestände in EINER Ansicht (`kind`), der Rückwärtsindex
// der Abbildung (Feld → Begriff) und die Brücke in den DCAT-Katalog.
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

const browser = await launch();

/* --------------------------------------------------------------- Bestand -- */
head('Bestand — Geschäftsobjekte');
let p = await openPage(browser, APP_BASE + '/app/metadata-catalog');
await sleep(1300);
let o = JSON.parse(await p.evaluate(`JSON.stringify({
  h1: document.querySelector('h1')?.textContent.trim(),
  zahl: document.querySelector('#mc-count')?.textContent.replace(/\\s+/g,' ').trim(),
  zeilen: document.querySelectorAll('tbody tr').length,
  spalten: [...document.querySelectorAll('thead th')].map(x => x.textContent.trim()),
  wurzeln: [...document.querySelectorAll('.pf-tree > .pf-tree__item > .pf-tree__node')].map(n =>
    n.querySelector('.pf-tree__label').textContent + ' ' + n.querySelector('.pf-tree__n').textContent),
  ikonen: document.querySelectorAll('.pf-sidebar .pf-tree__ico').length,
  unterstrichen: [...document.querySelectorAll('.pf-tree__node, .pf-tree__leaf')]
    .filter(x => getComputedStyle(x).textDecorationLine !== 'none').length,
  chevronImKnoten: document.querySelectorAll('.pf-tree__node > .pf-tree__chev').length,
  klappzustand: [...document.querySelectorAll('.pf-tree__node[data-branch]')].map(x => x.dataset.branch + '=' + x.getAttribute('aria-expanded')),
  domaenen: [...document.querySelectorAll('.pf-tree > .pf-tree__item:first-child .pf-tree__leaf .pf-tree__label')].map(x => x.textContent),
  ansichten: [...document.querySelectorAll('.view-switch__btn')].map(x => x.dataset.view),
  aktiv: document.querySelector('.pf-tree__node.is-active .pf-tree__label')?.textContent,
})`));
check(o.h1 === 'Metadaten Katalog Bauten', 'Seitentitel', o.h1);
check(/19 von 19 Geschäftsobjekten/.test(o.zahl || ''), 'Trefferzahl 19', o.zahl);
check(o.zeilen === 12, '12 Zeilen je Seite', String(o.zeilen));
check(o.spalten.join(',') === 'Geschäftsobjekt,Domäne,Beschreibung,Attribute,Status', 'Spalten der Begriffsliste', o.spalten.join(','));
check(o.wurzeln.join(' | ') === 'Geschäftsobjekte 19 | Systeme 10', 'zwei Wurzeln mit Zählern', o.wurzeln.join(' | '));
check(o.domaenen.length === 5, '5 Datendomänen im Baum', o.domaenen.join(', '));
check(o.chevronImKnoten === 2, 'Chevron sitzt IM Zweigknopf (wie im Inventar)', String(o.chevronImKnoten));
check(o.ansichten.join(',') === 'list,gallery', 'Liste zuerst, Galerie zweitrangig', o.ansichten.join(','));
check(o.aktiv === 'Geschäftsobjekte', 'Zweig «Geschäftsobjekte» ist standardmässig gewählt', o.aktiv);
check(o.ikonen === 0, 'keine Symbole im Seitenbaum', String(o.ikonen));
check(o.unterstrichen === 0, 'Navigation ohne Unterstrich (plain-link)', String(o.unterstrichen));
check(o.klappzustand.join(',') === 'objekte=true,systeme=false', 'nur der Zweig der aktuellen Sicht ist offen', o.klappzustand.join(','));
await clean(p, 'Bestand');

head('Zweig klappen und der Zustand überdauert das Filtern');
// Der Zweigknopf tut zweierlei: steht man schon in diesem Zweig, klappt er auf
// und zu (hier) — steht man woanders, führt er hin (Block «Wechsel» unten).
o = JSON.parse(await p.evaluate(`(async () => {
  document.querySelector('[data-branch=objekte]').click();
  await new Promise(r => setTimeout(r, 200));
  const vorher = [...document.querySelectorAll('.pf-tree__children')].map(x => x.id + (x.hidden ? ':zu' : ':offen'));
  const hashUnveraendert = location.hash === '#/app/metadata-catalog';
  location.hash = '#/app/metadata-catalog?mapped=ja';
  await new Promise(r => setTimeout(r, 800));
  return JSON.stringify({ vorher, hashUnveraendert,
    nachher: [...document.querySelectorAll('.pf-tree__children')].map(x => x.id + (x.hidden ? ':zu' : ':offen')) });
})()`));
check(o.hashUnveraendert, 'Klick im eigenen Zweig navigiert nicht');
check(o.vorher.join(' | ') === 'mc-branch-objekte:zu | mc-branch-systeme:zu', 'derselbe Klick klappt zu', o.vorher.join(' | '));
check(o.nachher.join(' | ') === o.vorher.join(' | '), 'Zustand überlebt das Neuzeichnen', o.nachher.join(' | '));

head('Domänenfilter über den Seitenbaum');
o = JSON.parse(await p.evaluate(`(async () => {
  const a = [...document.querySelectorAll('.pf-tree__leaf')].find(x => /Bauwerk/.test(x.textContent));
  a.click();
  await new Promise(r => setTimeout(r, 700));
  return JSON.stringify({
    hash: location.hash,
    zahl: document.querySelector('#mc-count')?.textContent.replace(/\\s+/g,' ').trim(),
    pille: document.querySelector('.active-filter')?.textContent.trim(),
    aktiv: document.querySelector('.pf-tree__leaf.is-active .pf-tree__label')?.textContent,
  });
})()`));
check(/domain=bauwerk/.test(o.hash), 'Domäne steht im Hash', o.hash);
check(/8 von 19/.test(o.zahl || ''), '8 Begriffe in «Bauwerk und Liegenschaft»', o.zahl);
check(o.pille === 'Bauwerk und Liegenschaft', 'Filterpille', o.pille);
check(o.aktiv === 'Bauwerk und Liegenschaft', 'Baumknoten markiert', o.aktiv);

head('Wechsel auf die Systemtabellen');
o = JSON.parse(await p.evaluate(`(async () => {
  const a = [...document.querySelectorAll('.pf-tree__node')].find(x => /Systeme/.test(x.textContent));
  a.click();
  await new Promise(r => setTimeout(r, 700));
  return JSON.stringify({
    hash: location.hash,
    zahl: document.querySelector('#mc-count')?.textContent.replace(/\\s+/g,' ').trim(),
    spalten: [...document.querySelectorAll('thead th')].map(x => x.textContent.trim()),
    ${/* Beide Äste sind zweistufig: Wurzel (.pf-tree__node) → Filterwert (.pf-tree__leaf). */''}
  systeme: [...document.querySelectorAll('.pf-tree > .pf-tree__item:last-child .pf-tree__leaf .pf-tree__label')].map(x => x.textContent),
    pillen: document.querySelectorAll('.active-filter').length,
  });
})()`));
check(/kind=tabellen/.test(o.hash), 'kind im Hash', o.hash);
check(/10 von 10 Systemtabellen/.test(o.zahl || ''), 'Trefferzahl 10 (ohne die beiden fachlich falschen RE-FX-Tabellen)', o.zahl);
check(o.spalten.join(',') === 'Tabelle,System,Beschreibung,Felder,Status', 'Spalten der Tabellenliste', o.spalten.join(','));
check(o.systeme.join(' | ') === 'SAP RE-FX | GIS IMMO', 'beide Systeme im Baum', o.systeme.join(' | '));
check(o.pillen === 0, 'Domänenfilter wird beim Sichtwechsel NICHT mitgeschleppt', String(o.pillen));
await clean(p, 'Systemtabellen');

head('Filter «ohne Realisierung»');
o = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/app/metadata-catalog?mapped=nein';
  await new Promise(r => setTimeout(r, 700));
  return JSON.stringify({
    zahl: document.querySelector('#mc-count')?.textContent.replace(/\\s+/g,' ').trim(),
    pille: document.querySelector('.active-filter')?.textContent.trim(),
  });
})()`));
check(/12 von 19/.test(o.zahl || ''), '12 Begriffe ohne Realisierung', o.zahl);
check(o.pille === 'Ohne Realisierung', 'Pille benennt den Zustand', o.pille);

/* ------------------------------------------------- Geschäftsobjekt-Detail -- */
head('Geschäftsobjekt «Gebäude»');
p = await openPage(browser, APP_BASE + '/app/metadata-catalog?id=gebaeude');
await sleep(1300);
o = JSON.parse(await p.evaluate(`JSON.stringify({
  h1: document.querySelector('h1')?.textContent.trim(),
  h1n: document.querySelectorAll('h1').length,
  tags: [...document.querySelectorAll('.detail-head .badge, .badge')].slice(0,2).map(x => x.textContent.trim()),
  attrZahl: document.querySelector('#mc-at-count')?.textContent.replace(/\\s+/g,' ').trim(),
  ${/* Erste Zelle ist ein <th scope="row"> (C.table), kein <td>. */''}
  attrNamen: [...document.querySelectorAll('#mc-attrs tbody tr th strong')].map(x => x.textContent),
  mapZahl: document.querySelector('#mc-mp-count')?.textContent.replace(/\\s+/g,' ').trim(),
  ${/* Metadaten + Verantwortliche Personen stehen im Reiter «Übersicht» als
        linierte kv-Listen (Datensatzblatt-Muster, Nutzerentscheid 2026-08-04);
        die frühere Randspalte ist weg. */''}
  eckdaten: [...document.querySelectorAll('[data-panel=uebersicht] dt')].map(x => x.textContent),
  abschnitte: [...document.querySelectorAll('[data-panel=uebersicht] .detail-section__title')].map(x => x.textContent.trim()),
  adminLinks: document.querySelectorAll('[data-panel=uebersicht] a[href*="admindir"]').length,
  liniert: document.querySelectorAll('[data-panel=uebersicht] dl.kv--ruled').length,
  asideKaesten: [...document.querySelectorAll('[data-panel=uebersicht] .detail-layout__aside .box h2')].map(x => x.textContent.trim()),
  leadNeu: document.querySelectorAll('h1 + .lead, .lead').length,
  asideAusserhalb: document.querySelectorAll('.container__aside').length,
  pillenzeile: document.querySelectorAll('.pill-row').length,
  lead: document.querySelectorAll('.hero__description').length,
  ${/* Die Attributtabelle führt keine Abbildungen mehr — die Tabellenlinks
        stehen im eigenen Abschnitt «Realisierung in den Systemen». */''}
  attrSpalten: [...document.querySelectorAll('#mc-attrs thead th')].map(x => x.textContent.trim()),
  tabellenLinks: [...document.querySelectorAll('#mc-maps a[href*="table="]')].length,
  crumbs: [...document.querySelectorAll('#breadcrumb-list li')].map(x => x.textContent.trim()),
  reiter: [...document.querySelectorAll('.tab__controls .tab__control')].map(x => x.textContent.trim() + ':' + x.getAttribute('aria-selected')),
  panels: [...document.querySelectorAll('[data-panel]')].map(x => x.dataset.panel + (x.hidden ? ':zu' : ':offen')),
})`));
check(o.h1 === 'Gebäude', 'Titel', o.h1);
check(o.h1n === 1, 'genau eine h1', String(o.h1n));
check(o.attrNamen[0] === 'Gebäude-ID (BBL)', 'erstes Attribut ist der Primärschlüssel', o.attrNamen[0]);
check(o.attrNamen.includes('EGID'), 'EGID unter den Attributen', o.attrNamen.join(', '));
check(/7 von 7 Attribute/.test(o.attrZahl || ''), '7 Attribute', o.attrZahl);
// 6 der 7 Attribute sind je zweifach abgebildet (SAP RE-FX und GIS IMMO),
// «Energieträger» in keinem System — macht 12.
check(/12 von 12 Realisierungen/.test(o.mapZahl || ''), '12 Realisierungen', o.mapZahl);
check(o.attrSpalten.join(',') === 'Attribut,Beschreibung,Werttyp,Schlüssel', 'vier Spalten, nichts gestapelt', o.attrSpalten.join(','));
check(o.eckdaten.includes('Bemerkung'), 'Abgrenzung/Zweitnamen/EGID als eine Bemerkung', o.eckdaten.join(', '));
check(o.tabellenLinks >= 8, 'Abbildungstabelle verlinkt die tragenden Tabellen', String(o.tabellenLinks));
check(!o.eckdaten.includes('Beschreibung') && o.eckdaten.includes('Datendomäne'), 'Metadaten-Liste: Beschreibung steht als Lead, Domäne bleibt', o.eckdaten.join(', '));
check(o.abschnitte.join(' | ') === 'Verantwortliche Personen | Metadaten', 'Abschnitte im Datensatzblatt-Muster', o.abschnitte.join(' | '));
check(o.liniert === 2, 'beide kv-Listen liniert (kv--ruled)', String(o.liniert));
check(!o.eckdaten.includes('Attribute') && !o.eckdaten.includes('Realisierungen'), 'keine Zahlen doppelt (die stehen in den Reitern)', o.eckdaten.join(', '));
check(o.lead === 0, 'kein hero__description (App-Kopf, kein Hero)', String(o.lead));
check(o.leadNeu >= 1, 'Definition als Lead unter der H1', String(o.leadNeu));
check(o.asideKaesten.join(' | ') === 'Kontakt', 'Randspalte trägt die Kontakt-Karte (Sammeladresse)', o.asideKaesten.join(' | '));
check(o.adminLinks >= 2, 'Verantwortliche Personen verlinken ins AdminDir', String(o.adminLinks));
check(o.asideAusserhalb === 0, 'keine Randspalte ausserhalb der Reiter', String(o.asideAusserhalb));
check(o.pillenzeile === 0, 'keine Pillenzeile im Kopf', String(o.pillenzeile));
check(o.crumbs.length === 5, 'Brotkrume bis zum Begriff', o.crumbs.join(' › '));
check(o.reiter.join(' | ') === 'Übersicht:true | Attribute (7):false | Realisierung (12):false', 'drei Reiter, Übersicht offen', o.reiter.join(' | '));
check(o.panels.join(' | ') === 'uebersicht:offen | attribute:zu | realisierung:zu', 'nur ein Panel sichtbar', o.panels.join(' | '));
await clean(p, 'Geschäftsobjekt');

head('Reiterwechsel');
o = JSON.parse(await p.evaluate(`(async () => {
  [...document.querySelectorAll('.tab__control')].find(x => /Attribute/.test(x.textContent)).click();
  await new Promise(r => setTimeout(r, 250));
  return JSON.stringify({
    panels: [...document.querySelectorAll('[data-panel]')].map(x => x.dataset.panel + (x.hidden ? ':zu' : ':offen')),
    zeilen: document.querySelectorAll('#mc-attrs tbody tr').length,
  });
})()`));
check(o.panels.join(' | ') === 'uebersicht:zu | attribute:offen | realisierung:zu', 'Attribute-Panel öffnet', o.panels.join(' | '));
check(o.zeilen === 7, 'Attributtabelle war schon montiert', String(o.zeilen));

head('Begriff ohne Realisierung: leere Tabelle mit Kopfzeile');
o = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/app/metadata-catalog?id=raum';
  await new Promise(r => setTimeout(r, 800));
  return JSON.stringify({
    h1: document.querySelector('h1')?.textContent.trim(),
    kopfzeilen: [...document.querySelectorAll('#mc-maps thead th')].map(x => x.textContent.trim()),
    leerzeile: document.querySelector('#mc-maps .table__empty')?.textContent.trim(),
    leerzustand: document.querySelectorAll('#mc-maps .empty').length,
  });
})()`));
check(o.h1 === 'Raum', 'Titel', o.h1);
check(o.kopfzeilen.join(',') === 'Attribut,System,Tabelle,Feld,Güte', 'Tabelle behält Kopfzeile und Spalten', o.kopfzeilen.join(','));
check(/keine Realisierung erfasst/.test(o.leerzeile || ''), 'Zeile sagt, warum sie leer ist', o.leerzeile);
check(o.leerzustand === 0, 'kein Leerzustand an Stelle der Tabelle', String(o.leerzustand));

/* --------------------------------------------------------- Tabellen-Detail -- */
head('Systemtabelle «BUILDING» (GIS IMMO)');
p = await openPage(browser, APP_BASE + '/app/metadata-catalog?table=gis-immo-building');
await sleep(1400);
o = JSON.parse(await p.evaluate(`JSON.stringify({
  h1: document.querySelector('h1')?.textContent.trim(),
  felderZahl: document.querySelector('#mc-fl-count')?.textContent.replace(/\\s+/g,' ').trim(),
  begriffeZahl: document.querySelector('#mc-rl-count')?.textContent.replace(/\\s+/g,' ').trim(),
  ersteFelder: [...document.querySelectorAll('#mc-fields tbody tr th code')].slice(0,3).map(x => x.textContent),
  feldSpalten: [...document.querySelectorAll('#mc-fields thead th')].map(x => x.textContent.trim()),
  beschreibung: [...document.querySelectorAll('[data-panel=uebersicht] dd')][0]?.textContent.trim(),
  datensatzLink: document.querySelector('[data-panel=uebersicht] a[href*="/data/catalog/"]')?.getAttribute('href'),
  ${/* Nicht der ERSTE externe Link — seit die Verantwortlichen Personen ins
        AdminDir verlinken, ist gezielt der Quellsystem-Link gemeint. */''}
  quelle: [...document.querySelectorAll('[data-panel=uebersicht] a[target=_blank]')].map(a => a.getAttribute('href')).find(h => !/admindir/.test(h)),
  treiter: [...document.querySelectorAll('.tab__controls .tab__control')].map(x => x.textContent.trim()),
  tpanels: [...document.querySelectorAll('.tab__container')].length,
  begriffLinks: [...document.querySelectorAll('#mc-fields a[href*="id="]')].map(x => x.textContent.trim()).slice(0,3),
})`));
check(o.h1 === 'Gebäude', 'Titel der Tabelle', o.h1);
check(/75 von 75 Felder/.test(o.felderZahl || ''), '75 Felder', o.felderZahl);
// Gebäude (6) + Grundstück · EGRID + Wirtschaftseinheit · WE-Nummer + Buchungskreis.
check(/9 von 9 Begriffe/.test(o.begriffeZahl || ''), '9 realisierte Begriffe', o.begriffeZahl);
check(o.ersteFelder[0] === 'bbl_id', 'Feldreihenfolge wie im System', o.ersteFelder.join(', '));
check(o.feldSpalten.join(',') === 'Feld,Beschreibung,Datentyp,Schlüssel,Realisiert', 'Felder-Tabelle mit eigener Beschreibungsspalte', o.feldSpalten.join(','));
check(!/LIVE Felder|DEV Felder/.test(o.beschreibung || ''), 'keine Feldstatistik in der Beschreibung', o.beschreibung);
check(o.datensatzLink === '#/data/catalog/11', 'Brücke in den DCAT-Katalog', o.datensatzLink);
check(/gis\.bbl\.admin\.ch/.test(o.quelle || ''), 'Quellsystem-Link auf den Host aus dem Anwendungskatalog', o.quelle);
check(o.begriffLinks.some((x) => /Gebäude/.test(x)), 'Rückwärtsindex: Feld nennt den Begriff', o.begriffLinks.join(' | '));
check(o.treiter.join(' | ') === 'Übersicht | Felder (75) | Realisierung (9)', 'dieselbe Reiterstruktur wie beim Geschäftsobjekt', o.treiter.join(' | '));
check(o.tpanels === 3, 'drei tab__container', String(o.tpanels));
await clean(p, 'Systemtabelle');

head('Feldfacette «Ohne Begriff»');
o = JSON.parse(await p.evaluate(`(async () => {
  document.querySelector('#mc-fl-filter').click();
  await new Promise(r => setTimeout(r, 250));
  const cb = [...document.querySelectorAll('#mc-fl-panel input[data-fdim=katalog]')].find(x => x.value === 'nein');
  cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 350));
  return JSON.stringify({ zahl: document.querySelector('#mc-fl-count')?.textContent.replace(/\\s+/g,' ').trim() });
})()`));
// 9 der 75 Felder tragen einen katalogisierten Begriff — der Rest ist die
// Lücke, die der Katalog sichtbar machen soll.
check(/66 von 75 Felder/.test(o.zahl || ''), '66 Felder ohne katalogisierten Begriff', o.zahl);

head('Unbekannte Kennungen');
for (const [hash, label] of [['?id=gibtsnicht', 'Geschäftsobjekt'], ['?table=gibtsnicht', 'Tabelle']]) {
  o = JSON.parse(await p.evaluate(`(async () => {
    location.hash = '#/app/metadata-catalog${hash}';
    await new Promise(r => setTimeout(r, 700));
    return JSON.stringify({ h1: document.querySelector('h1')?.textContent.trim(),
      band: !!document.querySelector('.notification--error') });
  })()`));
  check(/nicht gefunden/.test(o.h1 || ''), `${label}: «nicht gefunden» statt Absturz`, o.h1);
  check(!o.band, `${label}: kein Fehlerband`);
}
await clean(p, 'Nicht-gefunden');

/* ------------------------------------------------------------- Anschluss -- */
head('Anschluss an Katalog und Navigation');
p = await openPage(browser, APP_BASE + '/applications/metadaten-katalog');
await sleep(1200);
o = JSON.parse(await p.evaluate(`JSON.stringify({
  h1: document.querySelector('h1')?.textContent.trim(),
  // Der Einstieg bleibt auch abgemeldet ein echter Neues-Tab-Link. Der zentrale
  // Router-Login-Gate erscheint in der gestarteten Fachanwendung.
  einstieg: (() => {
    const a = document.querySelector('.container__aside a[href*="metadata-catalog"]');
    return a ? { href: a.getAttribute('href'), target: a.getAttribute('target'),
      rel: a.getAttribute('rel') || '', label: a.querySelector('.btn__text')?.textContent.trim() } : null;
  })(),
  // «Bereich» stand in der Eckdaten-Karte; die ist entfallen (Nutzerentscheid
  // 2026-08-06). Der Bereich ist jetzt eine Sache des Katalogs — geprüft wird
  // deshalb dort, dass der Filter die Anwendung noch findet.
  karten: [...document.querySelectorAll('.container__aside .box h3')].map(x => x.textContent.trim()),
})`));
check(o.h1 === 'Metadaten Katalog Bauten (Portal)', 'Landingpage der Anwendung', o.h1);
check(o.einstieg?.href === '#/app/metadata-catalog'
  && o.einstieg.label === 'Anwendung starten'
  && o.einstieg.target === '_blank' && o.einstieg.rel.split(/\s+/).includes('noopener'),
  'neutraler Einstieg öffnet die App sicher in einem neuen Tab', JSON.stringify(o.einstieg));
check(o.karten.join('|') === 'Zugriff|Kontakt', 'Randspalte trägt nur noch Zugriff und Kontakt', o.karten.join(' | '));

const imKatalog = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/applications?area=buildings';
  await new Promise(r => setTimeout(r, 900));
  return JSON.stringify({ treffer: !!document.querySelector('a[href*="metadaten-katalog"]') });
})()`));
check(imKatalog.treffer, 'Bereichsfilter «buildings» findet die Anwendung weiterhin');
// Zurück auf die Landingpage — clean() prüft gleich sie, nicht den Katalog.
await p.evaluate(`location.hash = '#/applications/metadaten-katalog'; true`);
await sleep(900);
await clean(p, 'Landingpage');

o = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/data';
  await new Promise(r => setTimeout(r, 800));
  return JSON.stringify({
    kachel: !!document.querySelector('a[href="#/app/metadata-catalog"]'),
    bundKachel: !!document.querySelector('a[href="#/applications?area=federal"]'),
  });
})()`));
check(o.kachel, 'Kachel auf der Daten-Übersicht');
check(o.bundKachel, 'Kachel «Fachanwendungen Bundesverwaltung» steht ebenfalls');

await browser.close();
console.log(fail ? `\n✗ ${fail} Prüfung(en) fehlgeschlagen` : '\n✓ alle Prüfungen bestanden');
process.exit(fail ? 1 : 0);
