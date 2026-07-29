// Ersetzt die erfundenen Angaben der Demo-Liegenschaften durch RECHERCHIERTE,
// belegte Angaben zu echten Bauten des Bundes.
//
// Warum als Skript und nicht von Hand: jede Zahl hier hat eine Quelle, und die
// Zuordnung «welcher Demo-Datensatz wird zu welchem echten Bau» muss nachlesbar
// bleiben. Das Skript ist wiederholbar — es schreibt immer dasselbe Ergebnis.
//
//   node scripts/apply-research-data.mjs --pruefen   (nur anzeigen)
//   node scripts/apply-research-data.mjs             (schreiben)
//
// HERKUNFT DER ANGABEN
//   Gebäudedaten, Flächen, Volumen, Kosten, Architekten, Bauzeiten:
//     BBL-Bautendokumentationen (bbl.admin.ch/de/bautendokumentationen), je
//     Objekt in `quellen` verzeichnet.
//   EGID, EGRID, Parzellennummer, amtliche Fläche, Parzellengeometrie:
//     © Data: swisstopo (api3.geo.admin.ch) und amtliche Vermessung der Kantone
//     (geodienste.ch). Abgerufen am 2026-07-29 mit scripts/fetch-swisstopo.mjs.
//     Siehe docs/swisstopo-api.md.
//   Adressen der Auslandvertretungen: EDA (eda.admin.ch).
//   Koordinaten im Ausland: OpenStreetMap (ODbL).
//   Bilder: Wikimedia Commons, Urheber und Lizenz je Bild vermerkt.
//
// KEINE ANGABE WURDE GERATEN. Wo nichts publiziert ist, bleibt der bisherige
// Demo-Wert stehen (Werte, Mieten, Verantwortliche) — das sind ausdrücklich
// Demo-Daten und als solche im Portal gekennzeichnet.

import { readFileSync, writeFileSync } from 'node:fs';

const pruefen = process.argv.includes('--pruefen');
const D = 'c:/Users/david/Documents/GitHub/service-portal/data/';
const J = (f) => JSON.parse(readFileSync(D + f, 'utf8'));

// ---------------------------------------------------------------------------
// Die Zuordnung: bbl_id (bleibt!) → echter Bau. Die Schlüssel bleiben stehen,
// damit die 233 Kindsätze (Ausstattung, Verträge, Kosten, Flächen, Kontakte)
// gültig bleiben — sie hängen alle an der bbl_id.
// ---------------------------------------------------------------------------
const BAUTEN = {
  '1000/4840/AF': {
    bez: 'Bundeshaus West',
    str: 'Bundesgasse', nr: '1', plz: '3011', ort: 'Bern', land: 'CH', reg: 'BE',
    lat: 46.946346, lon: 7.442977, lv95_e: 2599669.6, lv95_n: 1199471.6,
    egid: '1230654', egrid: 'CH127620463518', gem: 'Bern', gemnr: 351,
    bjahr: 1857, vjahr: 2010,
    port: 'Verwaltungsgebäude', port2: 'Bundesverwaltung',
    gbda1: 'Verwaltung', gbda2: 'Departementsgebäude',
    hist: 'Ja', arch: 'Ja', kgs_kat: 'A', kgs_nr: 615,
    gf: 15860, gv: 69025, astw: 6,
    architekt: 'Friedrich Studer (1852–1857); Itten + Brechbühl AG, Bern (Sanierung 2008–2010)',
    nutzer: 'EDA, Bundeskanzlei, EJPD, Parlamentsdienste',
    bild: { url: 'https://upload.wikimedia.org/wikipedia/commons/7/76/Bundeshaus_West_%282019-06-23%29.jpg',
      autor: 'Arkhein Drakenov', lizenz: 'CC BY-SA 4.0',
      seite: 'https://commons.wikimedia.org/wiki/File:Bundeshaus_West_(2019-06-23).jpg' },
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/xpRh20JjlO-A/20100101_Bern%2C%20Bundesgasse%201%2C%20Sanierung_DE.pdf'],
    parzelle: { nr: '1058', flaeche: 9893, bez: 'Bundesgasse 1' },
  },
  '1000/3120/AB': {
    bez: 'Sammlungszentrum Schweizerisches Nationalmuseum',
    str: 'Lindenmoosstrasse', nr: '1', plz: '8910', ort: 'Affoltern am Albis', land: 'CH', reg: 'ZH',
    lat: 47.268894, lon: 8.445229, lv95_e: 2676876.0, lv95_n: 1237056.0,
    egid: '201028111', egrid: 'CH827785288941', gem: 'Affoltern am Albis', gemnr: 2,
    bjahr: 1985, vjahr: 2007,
    port: 'Lager / Logistik', port2: 'Kultur',
    gbda1: 'Lager', gbda2: 'Sammlungsdepot',
    hist: 'Ja', arch: 'Nein', kgs_kat: 'A', kgs_nr: 11777,
    gf: 20093, gv: 92810, astw: 3,
    architekt: 'Stücheli Architekten AG, Zürich (Umnutzung 2005–2007)',
    nutzer: 'Schweizerisches Nationalmuseum',
    bild: { url: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Sammlungszentrum_Affoltern_am_Albis._Drohnenaufnahme.jpg',
      autor: 'Schweizerisches Nationalmuseum', lizenz: 'CC BY-SA 4.0',
      seite: 'https://commons.wikimedia.org/wiki/File:Sammlungszentrum_Affoltern_am_Albis._Drohnenaufnahme.jpg' },
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/B66TZzOayoZP/20070901_Affoltern%20am%20Albis%20Umnutzung%20vom%20Zeughaus%20zum%20Sammlungszentrum_DE.pdf'],
    parzelle: { nr: '4723', flaeche: 43930, bez: 'Lindenmoos' },
  },
  '1000/4100/AC': {
    bez: 'Campus BAZG (Ausbildungszentrum Liestal)',
    str: 'Kasinostrasse', nr: '4', plz: '4410', ort: 'Liestal', land: 'CH', reg: 'BL',
    lat: 47.479862, lon: 7.744051, lv95_e: 2622310.0, lv95_n: 1259520.0,
    egid: '9004666', egrid: 'CH207059761779', gem: 'Liestal', gemnr: 2829,
    bjahr: 1981, vjahr: 2015,
    port: 'Ausbildung', port2: 'Bundesverwaltung',
    gbda1: 'Ausbildung', gbda2: 'Schulungs- und Unterkunftsgebäude',
    hist: 'Nein', arch: 'Nein', kgs_kat: null, kgs_nr: null,
    gf: 2480, gv: 8510, astw: 3,
    architekt: 'Zwimpfer + Meyer, Basel (1981); Aschwanden Schürer Architekten AG, Zürich (Erweiterung 2015)',
    nutzer: 'Bundesamt für Zoll und Grenzsicherheit BAZG',
    bild: null,
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/YMr47zVY9cLN/20150501_Liestal%20Kasinostrasse%204%20Zollschule%20Erweiterung%20Modulbau_DE.pdf'],
    parzelle: { nr: '1787', flaeche: 10326, bez: 'Kasinostrasse' },
  },
  '1000/2800/AD': {
    bez: 'Dienstwohnungen EDA Effingerstrasse',
    str: 'Effingerstrasse', nr: '29', plz: '3008', ort: 'Bern', land: 'CH', reg: 'BE',
    lat: 46.945808, lon: 7.432851, lv95_e: 2598897.0, lv95_n: 1199420.0,
    egid: '1234494', egrid: 'CH650246873582', gem: 'Bern', gemnr: 351,
    bjahr: 1934, vjahr: 2018,
    port: 'Wohnliegenschaft', port2: 'Bundesverwaltung',
    gbda1: 'Wohnen', gbda2: 'Dienstwohnungen',
    hist: 'Ja', arch: 'Nein', kgs_kat: null, kgs_nr: null,
    gf: 1138, gv: 3806, astw: 7,
    architekt: 'Hans Weiss, Bern (1933/34); Ehrenbold Schudel Architektur, Bern (Umbau 2017/18)',
    nutzer: 'EDA — Dienstwohnungen, DEZA Humanitäre Hilfe',
    bild: null,
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/J-9Pctw1raik/20180701_Bern%20Effingerstrasse%2029%20Sanierung%20und%20Umbau%20zu%20Dienstwohnungen_DE.pdf'],
    parzelle: { nr: '2746', flaeche: 615, bez: 'Effingerstrasse 29' },
  },
  '1000/1950/AE': {
    bez: 'Rechenzentrum CAMPUS Frauenfeld',
    str: 'Auenfeld', nr: '', plz: '8500', ort: 'Frauenfeld', land: 'CH', reg: 'TG',
    lat: 47.570346, lon: 8.884102, lv95_e: 2708430.0, lv95_n: 1269660.0,
    egid: null, egrid: 'CH652680772937', gem: 'Frauenfeld', gemnr: 4566,
    bjahr: 2019, vjahr: null,
    port: 'Infrastruktur IT', port2: 'Bundesverwaltung',
    gbda1: 'Infrastruktur', gbda2: 'Rechenzentrum',
    hist: 'Nein', arch: 'Nein', kgs_kat: null, kgs_nr: null,
    gf: 2000, gv: null, astw: 2,
    architekt: null,
    nutzer: 'BIT, Führungsunterstützungsbasis der Armee FUB, ISC-EJPD',
    bild: null,
    // Bauherrschaft ist armasuisse Immobilien, nicht das BBL — im Portal als
    // Sonderfall geführt. Keine Strassenadresse publiziert (Waffenplatz).
    quellen: ['https://www.bit.admin.ch/de/rz-campus-78', 'https://www.vtg.admin.ch/de/rechenzentrum-campus-in-frauenfeld-feiert-aufrichte'],
    parzelle: { nr: '61736', flaeche: 5001, bez: 'Auenfeld' },
  },
  '1000/4850/AG': {
    bez: 'Verwaltungszentrum Guisanplatz',
    str: 'Guisanplatz', nr: '1', plz: '3014', ort: 'Bern', land: 'CH', reg: 'BE',
    lat: 46.959785, lon: 7.463306, lv95_e: 2601210.0, lv95_n: 1200980.0,
    egid: '191682279', egrid: 'CH208835944617', gem: 'Bern', gemnr: 351,
    bjahr: 2019, vjahr: null,
    port: 'Verwaltungsgebäude', port2: 'Bundesverwaltung',
    gbda1: 'Verwaltung', gbda2: 'Verwaltungszentrum',
    hist: 'Nein', arch: 'Nein', kgs_kat: null, kgs_nr: null,
    gf: 30000, gv: null, astw: 6,
    architekt: 'Aebi & Vincent Architekten SIA AG, Bern (Wettbewerb 2009)',
    nutzer: 'armasuisse, Bundesanwaltschaft, fedpol, BABS',
    bild: null,
    quellen: ['https://www.verwaltungszentrum-guisanplatz.ch/bauprojekt', 'https://aebi-vincent.ch/projekte/neubau-umbau-und-sanierung-verwaltungszentrum-guisanplatz-bern/'],
    parzelle: { nr: '586', flaeche: 41438, bez: 'Guisanplatz' },
  },

  // --- Auslandvertretungen (Koordinaten aus OpenStreetMap, Adressen vom EDA) ---
  '1000/5210/AA': {
    bez: 'Schweizerische Botschaft Berlin',
    str: 'Otto-von-Bismarck-Allee', nr: '4A', plz: '10557', ort: 'Berlin', land: 'DE', reg: 'Berlin',
    lat: 52.521102, lon: 13.371281, lv95_e: null, lv95_n: null,
    egid: null, egrid: null, gem: 'Berlin', gemnr: null,
    bjahr: 1870, vjahr: 2000,
    port: 'Diplomatische Vertretung', port2: 'Aussennetz EDA',
    gbda1: 'Verwaltung', gbda2: 'Botschaft (Kanzlei)',
    hist: 'Ja', arch: 'Ja', kgs_kat: null, kgs_nr: null,
    gf: 5701, gv: null, astw: 4,
    architekt: 'Friedrich Hitzig (1870/71); Diener & Diener Architekten, Basel (Erweiterung 1995–2000)',
    nutzer: 'EDA — Schweizerische Botschaft in Deutschland',
    bild: { url: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Schweizerische_Botschaft_in_Berlin.jpg',
      autor: 'Lukas Beck', lizenz: 'CC BY-SA 4.0',
      seite: 'https://commons.wikimedia.org/wiki/File:Schweizerische_Botschaft_in_Berlin.jpg' },
    quellen: ['https://www.bbl.admin.ch/dam/de/sd-web/6KztH5h4iF7L/20001201_Berlin%2C%20Deutschland%2C%20Schweizerische%20Botschaft_DE.pdf'],
    parzelle: { nr: '41', flaeche: 2100, bez: 'Otto-von-Bismarck-Allee' },
  },
  '1000/5320/AA': {
    bez: 'Schweizerisches Generalkonsulat New York',
    str: 'Third Avenue', nr: '633', plz: '10017', ort: 'New York', land: 'US', reg: 'NY',
    lat: 40.753889, lon: -73.972500, lv95_e: null, lv95_n: null,
    egid: null, egrid: null, gem: 'New York', gemnr: null,
    bjahr: 1963, vjahr: null,
    port: 'Diplomatische Vertretung', port2: 'Aussennetz EDA',
    gbda1: 'Verwaltung', gbda2: 'Generalkonsulat',
    hist: 'Nein', arch: 'Nein', kgs_kat: null, kgs_nr: null,
    gf: null, gv: null, astw: null,
    architekt: null,
    nutzer: 'EDA — Generalkonsulat, Swissnex, Schweiz Tourismus',
    bild: null,
    // Mietfläche in einem Hochhaus — kein eigenes Gebäude des Bundes.
    quellen: ['https://www.eda.admin.ch/countries/usa/en/home/representations/generalkonsulat-new-york.html'],
    parzelle: null,
  },
  '1000/5410/AA': {
    bez: 'Schweizerische Botschaft Tokio',
    str: 'Minami-Azabu, Minato-ku', nr: '5-9-12', plz: '106-8589', ort: 'Tokio', land: 'JP', reg: 'Präfektur Tokio',
    lat: 35.653365, lon: 139.723812, lv95_e: null, lv95_n: null,
    egid: null, egrid: null, gem: 'Minato-ku', gemnr: null,
    bjahr: 1983, vjahr: null,
    port: 'Diplomatische Vertretung', port2: 'Aussennetz EDA',
    gbda1: 'Verwaltung', gbda2: 'Botschaft mit Residenz',
    hist: 'Nein', arch: 'Ja', kgs_kat: null, kgs_nr: null,
    gf: null, gv: null, astw: null,
    architekt: 'Rolf Kaiser',
    nutzer: 'EDA — Schweizerische Botschaft in Japan',
    bild: { url: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Embassy_of_Switzerland%2C_Tokyo.jpg',
      autor: 'Syced', lizenz: 'CC0 1.0 (gemeinfrei)',
      seite: 'https://commons.wikimedia.org/wiki/File:Embassy_of_Switzerland,_Tokyo.jpg' },
    quellen: ['https://www.eda.admin.ch/countries/japan/en/home/representations/embassy-tokyo.html'],
    parzelle: { nr: '9-12', flaeche: null, bez: 'Minami-Azabu' },
  },
  '1000/5510/AA': {
    bez: 'Schweizerische Botschaft Brasília',
    str: 'SES Avenida das Nações, Qd. 811', nr: 'Lote 41', plz: '70448-900', ort: 'Brasília', land: 'BR', reg: 'Distrito Federal',
    lat: -15.831611, lon: -47.897273, lv95_e: null, lv95_n: null,
    egid: null, egrid: null, gem: 'Brasília', gemnr: null,
    bjahr: 1977, vjahr: null,
    port: 'Diplomatische Vertretung', port2: 'Aussennetz EDA',
    gbda1: 'Verwaltung', gbda2: 'Botschaft (Kanzlei)',
    hist: 'Nein', arch: 'Ja', kgs_kat: null, kgs_nr: null,
    gf: null, gv: null, astw: null,
    architekt: 'Hans und Annemarie Hubacher',
    nutzer: 'EDA — Schweizerische Botschaft in Brasilien',
    bild: null,
    quellen: ['https://pt.wikipedia.org/wiki/Embaixada_da_Su%C3%AD%C3%A7a_em_Bras%C3%ADlia'],
    parzelle: { nr: 'Lote 41', flaeche: null, bez: 'Setor de Embaixadas Sul' },
  },
  '1000/5620/AA': {
    bez: 'Schweizerische Botschaft Canberra',
    str: 'Melbourne Avenue', nr: '7', plz: '2603', ort: 'Canberra', land: 'AU', reg: 'ACT',
    lat: -35.313476, lon: 149.121046, lv95_e: null, lv95_n: null,
    egid: null, egrid: null, gem: 'Forrest', gemnr: null,
    bjahr: 1975, vjahr: null,
    port: 'Diplomatische Vertretung', port2: 'Aussennetz EDA',
    gbda1: 'Verwaltung', gbda2: 'Botschaft mit Residenz',
    hist: 'Nein', arch: 'Ja', kgs_kat: null, kgs_nr: null,
    gf: null, gv: null, astw: 2,
    architekt: 'Hermann Baur und Hans Peter Baur',
    nutzer: 'EDA — Schweizerische Botschaft in Australien',
    bild: { url: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Embassy_of_Switzerland_in_Canberra.jpg',
      autor: 'Nomisztif', lizenz: 'CC BY-SA 4.0',
      seite: 'https://commons.wikimedia.org/wiki/File:Embassy_of_Switzerland_in_Canberra.jpg' },
    quellen: ['https://www.eda.admin.ch/countries/australia/en/home/representations/embassy-in-canberra.html'],
    parzelle: { nr: '7', flaeche: null, bez: 'Melbourne Avenue' },
  },
};

// ---------------------------------------------------------------------------
const bg = J('buildings.geojson');
const pc = J('parcels.geojson');
const bericht = [];

for (const f of bg.features) {
  const p = f.properties;
  const b = BAUTEN[p.bbl_id];
  if (!b) { bericht.push(`  – ${p.bbl_id} unverändert (${p.bbl_bez})`); continue; }
  const vorher = p.bbl_bez;

  p.bbl_bez = b.bez;
  p.adr_str = b.str; p.adr_hsnr = b.nr; p.adr_plz = b.plz; p.adr_ort = b.ort;
  p.adr_land = b.land; p.adr_reg = b.reg;
  p.adr_conct = [b.str, b.nr].filter(Boolean).join(' ') + `, ${b.plz} ${b.ort}`;
  p.wgs84_lat = b.lat; p.wgs84_lon = b.lon;
  p.lv95_e = b.lv95_e; p.lv95_n = b.lv95_n;
  if (b.egid) p.av_egid = b.egid; else p.av_egid = null;
  p.av_egrid = b.egrid;
  p.bfs_gem = b.gem; p.bfs_gemnr = b.gemnr;
  p.bbl_bjahr = b.bjahr; p.bbl_vjahr = b.vjahr;
  p.bbl_port = b.port; p.bbl_port2 = b.port2;
  p.bbl_gbda1 = b.gbda1; p.bbl_gbda2 = b.gbda2;
  p.bbl_hist = b.hist; p.bbl_arch = b.arch;
  p.kgs_kat = b.kgs_kat; p.kgs_nr = b.kgs_nr;
  if (b.gf) { p.garea_gf = b.gf; }
  if (b.gv) { p.gvol_gv = b.gv; }
  if (b.astw) { p.gastw = b.astw; }

  // Neue, belegte Felder — Architekt, Nutzer und die Quellen der Angaben.
  p.bbl_architekt = b.architekt;
  p.bbl_nutzer = b.nutzer;
  p.quellen = b.quellen;
  p.datenherkunft = b.egrid
    ? 'BBL-Bautendokumentation; Kataster © Data: swisstopo / amtliche Vermessung'
    : 'BBL / EDA, Koordinaten OpenStreetMap';

  if (b.bild) {
    p.img_url = [b.bild.url, ...p.img_url.slice(1)];
    p.img_credit = `${b.bild.autor}, ${b.bild.lizenz} — ${b.bild.seite}`;
  } else {
    p.img_credit = 'Platzhalterbild (Unsplash) — für dieses Objekt existiert keine frei nutzbare Aufnahme';
  }

  // Geometrie des Gebäudepunkts mitziehen
  if (f.geometry && f.geometry.type === 'Point') f.geometry.coordinates = [b.lon, b.lat];
  bericht.push(`  ✓ ${p.bbl_id}  ${vorher}  →  ${b.bez}`);
}

// --- Grundstücke ------------------------------------------------------------
// Amtliche Parzellengeometrien, einmal abgeholt und in research/ abgelegt —
// siehe research/README.md. Der Ordner ist nicht im Git, das Skript meldet
// darum verständlich, wenn die Datei fehlt.
const GEOM_PFAD = 'c:/Users/david/Documents/GitHub/service-portal/research/daten/parzellen-geometrie.json';
let GEOM = {};
try { GEOM = JSON.parse(readFileSync(GEOM_PFAD, 'utf8')); }
catch { console.warn(`! ${GEOM_PFAD} fehlt — Parzellen behalten ihre Demo-Geometrie.\n`
  + '  Neu holen mit: node scripts/fetch-swisstopo.mjs --datei research/daten/adressen.json --aus …\n'); }

for (const f of pc.features) {
  const p = f.properties;
  const we = String(p.bbl_id).split('/')[1];
  const treffer = Object.entries(BAUTEN).find(([id]) => id.split('/')[1] === we);
  if (!treffer) continue;
  const [, b] = treffer;
  if (!b.parzelle) continue;

  p.bbl_bez = b.parzelle.bez;
  p.av_nr = b.parzelle.nr;
  p.av_egrid = b.egrid;
  if (b.parzelle.flaeche) p.larea_gsf = b.parzelle.flaeche;
  p.adr_str = b.str; p.adr_hsnr = b.nr; p.adr_plz = b.plz; p.adr_ort = b.ort;
  p.adr_land = b.land; p.adr_reg = b.reg;
  p.bfs_gem = b.gem; p.bfs_gemnr = b.gemnr;
  p.wgs84_lat = b.lat; p.wgs84_lon = b.lon;
  p.datenherkunft = b.egrid && GEOM[b.egrid]
    ? 'Amtliche Vermessung — © Data: swisstopo / geodienste.ch'
    : 'Demo-Geometrie (im Ausland keine amtliche Quelle verfügbar)';

  // ECHTE Parzellengeometrie, wo vorhanden
  if (b.egrid && GEOM[b.egrid]) f.geometry = GEOM[b.egrid];
}

console.log('Gebäude:');
bericht.forEach((z) => console.log(z));
const mitGeom = pc.features.filter((f) => /swisstopo/.test(f.properties.datenherkunft || '')).length;
console.log(`\nGrundstücke: ${mitGeom} von ${pc.features.length} mit amtlicher Geometrie`);

if (pruefen) { console.log('\n(--pruefen: nichts geschrieben)'); }
else {
  writeFileSync(D + 'buildings.geojson', JSON.stringify(bg, null, 1));
  writeFileSync(D + 'parcels.geojson', JSON.stringify(pc, null, 1));
  console.log('\n→ data/buildings.geojson, data/parcels.geojson geschrieben');
}
