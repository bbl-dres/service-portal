// Erzeugt die drei Bestände des Mietendenportals (#/app/tenancies):
//   data/tenancies.json  Mietverhältnisse — eine VE mietet Fläche in einem Gebäude
//   data/floors.json     Geschosse je Gebäude
//   data/spaces.json     Räume je Geschoss, mit Rechteck im lokalen Zeichnungsraster
//
// KEIN JOIN ZUR LAUFZEIT: Gebäudebezeichnung und Adresse werden hier aus dem
// Golden Record (data/buildings.geojson) ABGESCHRIEBEN. Das Mietendenportal
// führt seine Vertragsdaten selbst — dieselbe Trennung wie zwischen EPPM und
// SAP RE-FX bei den Bauprojekten (js/apps/projects.js).
//
// DIE GEOMETRIE IST KEINE GEOGRAFIE. Ein Grundriss ist eine lokale Zeichnung;
// Raster ist 100 Einheiten = 1 m, Ursprung oben links. Damit ist der Plan als
// SVG darstellbar — ohne WebGL, ohne Kartendienst (der im Bundesnetz gesperrt
// sein kann, docs/code-review.md), druckbar, und jeder Raum ist ein einzeln
// fokussierbares Element.
//
//   node scripts/build-tenancy-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, normalize } from 'node:path';

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..')) + '/';
// Ein Datensatz je Zeile: 433 Räume im Blockformat wären 220 KB und im Diff
// unlesbar. So bleibt die Datei kompakt und Änderungen zeigen sich zeilenweise
// (dasselbe Format wie data/contacts.json).
const writeLines = (f, v) =>
  writeFileSync(ROOT + f, '[\n' + v.map((x) => '  ' + JSON.stringify(x)).join(',\n') + '\n]\n');

const fc = JSON.parse(readFileSync(ROOT + 'data/buildings.geojson', 'utf8'));
const kontakte = JSON.parse(readFileSync(ROOT + 'data/contacts.json', 'utf8'));
const bld = new Map();
for (const f of fc.features || []) if (f.properties?.bbl_id) bld.set(f.properties.bbl_id, f.properties);

/* ------------------------------------------------------ Mietverhältnisse ---- */
// Sechs Verwaltungseinheiten, elf Mietverhältnisse in zehn Gebäuden. Zwei
// Gebäude sind von mehreren VE belegt (Liebefeld: BAFU + BLV) — das ist der
// Normalfall und der Grund, warum die Einheit das Mietverhältnis ist und nicht
// das Objekt.
const MIETEN = [
  { id: 'MV-2026-001', ve: 'BAFU', veName: 'Bundesamt für Umwelt BAFU', dep: 'Abt. Ressourcen', b: '1080/4850/AG', floors: ['2og', '3og'], hnf: 1180, ws: 96, from: '2019-04-01', to: '2034-03-31', cost: 1920000, kst: 'A-810.2140' },
  { id: 'MV-2026-002', ve: 'BAFU', veName: 'Bundesamt für Umwelt BAFU', dep: 'Abt. Wasser', b: '1080/6650/AA', floors: ['1og'], hnf: 640, ws: 48, from: '2021-01-01', to: '2031-12-31', cost: 980000, kst: 'A-810.2141' },
  { id: 'MV-2026-003', ve: 'BLV', veName: 'Bundesamt für Lebensmittelsicherheit und Veterinärwesen BLV', dep: 'Direktionsbereich', b: '1080/6650/AA', floors: ['eg', '2og'], hnf: 1420, ws: 112, from: '2018-07-01', to: '2028-06-30', cost: 2180000, kst: 'A-341.1020' },
  { id: 'MV-2026-004', ve: 'swisstopo', veName: 'Bundesamt für Landestopografie swisstopo', dep: 'Direktion', b: '1080/6870/AA', floors: ['eg', '1og'], hnf: 890, ws: 64, from: '2020-09-01', to: '2035-08-31', cost: 1340000, kst: 'A-506.3300' },
  { id: 'MV-2026-005', ve: 'BVGer', veName: 'Bundesverwaltungsgericht', dep: 'Generalsekretariat', b: '1080/6980/AA', floors: ['eg'], hnf: 316, ws: 22, from: '2017-01-01', to: '2027-12-31', cost: 512000, kst: 'A-104.0010' },
  { id: 'MV-2026-006', ve: 'BAZG', veName: 'Bundesamt für Zoll und Grenzsicherheit BAZG', dep: 'Ausbildung', b: '1080/4100/AC', floors: ['eg', '1og'], hnf: 1560, ws: 84, from: '2022-03-01', to: '2032-02-29', cost: 1760000, kst: 'A-606.4400' },
  { id: 'MV-2026-007', ve: 'BAZG', veName: 'Bundesamt für Zoll und Grenzsicherheit BAZG', dep: 'Region Wallis', b: '1080/6210/AA', floors: ['eg'], hnf: 420, ws: 18, from: '2016-05-01', to: '2026-12-31', cost: 288000, kst: 'A-606.4412' },
  { id: 'MV-2026-008', ve: 'BAK', veName: 'Bundesamt für Kultur BAK', dep: 'Sammlungen', b: '1080/6100/AA', floors: ['eg', '1og'], hnf: 2100, ws: 54, from: '2015-01-01', to: '2040-12-31', cost: 3050000, kst: 'A-306.2200' },
  { id: 'MV-2026-009', ve: 'BAK', veName: 'Bundesamt für Kultur BAK', dep: 'Nationalbibliothek', b: '1080/6430/AA', floors: ['ug', 'eg'], hnf: 1880, ws: 41, from: '2019-11-01', to: '2039-10-31', cost: 2240000, kst: 'A-306.2210' },
  { id: 'MV-2026-010', ve: 'BAFU', veName: 'Bundesamt für Umwelt BAFU', dep: 'Abt. Klima', b: '1080/7090/AA', floors: ['3og'], hnf: 520, ws: 38, from: '2023-02-01', to: '2028-01-31', cost: 910000, kst: 'A-810.2145' },
  { id: 'MV-2026-011', ve: 'swisstopo', veName: 'Bundesamt für Landestopografie swisstopo', dep: 'Geodaten', b: '1080/4840/AF', floors: ['2og'], hnf: 340, ws: 26, from: '2024-06-01', to: '2029-05-31', cost: 720000, kst: 'A-506.3312' },

  // --- Aussennetz -------------------------------------------------------------
  // Das BBL bewirtschaftet auch die Bauten der Vertretungen im Ausland; Mieterin
  // ist dort in aller Regel das EDA, teils mit Mitnutzung durch SECO
  // (Swiss Business Hub) oder Präsenz Schweiz. Verrechnet wird in CHF, weil die
  // Leistungsverrechnung des Bundes in Franken geführt wird — die ortsüblichen
  // Mieten sind darin bereits umgerechnet.
  { id: 'MV-2026-012', ve: 'EDA', veName: 'Eidgenössisches Departement für auswärtige Angelegenheiten EDA', dep: 'Botschaft Berlin', b: '1080/5210/AA', floors: ['eg', '1og', '2og'], hnf: 2100, ws: 74, from: '2014-01-01', to: '2044-12-31', cost: 2640000, kst: 'A-201.7010' },
  { id: 'MV-2026-013', ve: 'SECO', veName: 'Staatssekretariat für Wirtschaft SECO', dep: 'Swiss Business Hub Deutschland', b: '1080/5210/AA', floors: ['3og'], hnf: 420, ws: 14, from: '2020-04-01', to: '2030-03-31', cost: 560000, kst: 'A-704.1180' },
  { id: 'MV-2026-014', ve: 'EDA', veName: 'Eidgenössisches Departement für auswärtige Angelegenheiten EDA', dep: 'Botschaft Tokio', b: '1080/5410/AA', floors: ['eg', '1og'], hnf: 1640, ws: 52, from: '2016-09-01', to: '2041-08-31', cost: 3180000, kst: 'A-201.7042' },
  { id: 'MV-2026-015', ve: 'EDA', veName: 'Eidgenössisches Departement für auswärtige Angelegenheiten EDA', dep: 'Botschaft Brasília', b: '1080/5510/AA', floors: ['eg', '1og'], hnf: 1060, ws: 34, from: '2012-05-01', to: '2032-04-30', cost: 940000, kst: 'A-201.7055' },
  { id: 'MV-2026-016', ve: 'EDA', veName: 'Eidgenössisches Departement für auswärtige Angelegenheiten EDA', dep: 'Botschaft Canberra', b: '1080/5620/AA', floors: ['eg'], hnf: 720, ws: 24, from: '2019-02-01', to: '2029-01-31', cost: 810000, kst: 'A-201.7062' },
  { id: 'MV-2026-017', ve: 'EDA', veName: 'Eidgenössisches Departement für auswärtige Angelegenheiten EDA', dep: 'Generalkonsulat New York', b: '1080/5320/AA', floors: ['eg', '1og'], hnf: 1180, ws: 38, from: '2018-11-01', to: '2028-10-31', cost: 2870000, kst: 'A-201.7031' },
  { id: 'MV-2026-018', ve: 'PRS', veName: 'Präsenz Schweiz (EDA)', dep: 'Landeskommunikation Nordamerika', b: '1080/5320/AA', floors: ['2og'], hnf: 260, ws: 9, from: '2023-07-01', to: '2028-06-30', cost: 680000, kst: 'A-201.7038' },
];

const GESCHOSS = {
  ug: { label: 'UG', level: -1 },
  eg: { label: 'EG', level: 0 },
  '1og': { label: '1. OG', level: 1 },
  '2og': { label: '2. OG', level: 2 },
  '3og': { label: '3. OG', level: 3 },
};

// Raumtypen. Label, SIA-416-Kategorie und Legendengruppe werden AN JEDEN RAUM
// GESCHRIEBEN, nicht zur Laufzeit nachgeschlagen. Sie wären zwar aus `useType`
// ableitbar — aber eine Nachschlagetabelle ist auch nur ein Join, und der
// Datensatz soll für sich lesbar sein: wer spaces.json öffnet, sieht «Büro,
// Hauptnutzfläche», nicht «buero» und einen Verweis.
//
// `sia` nach SIA 416: HNF Hauptnutz-, NNF Nebennutz-, VF Verkehrs-,
// FF Funktions-, TF Technikfläche. `group` fasst für die Legende gröber.
const USE = {
  buero:       { label: 'Büro',           sia: 'HNF', group: 'arbeit',   cap: (a) => Math.max(1, Math.round(a / 12)) },
  openspace:   { label: 'Open Space',     sia: 'HNF', group: 'arbeit',   cap: (a) => Math.max(1, Math.round(a / 10)) },
  fokusraum:   { label: 'Fokusraum',      sia: 'HNF', group: 'arbeit',   cap: () => 1 },
  empfang:     { label: 'Empfang',        sia: 'HNF', group: 'arbeit',   cap: () => 2 },
  sitzung:     { label: 'Sitzungszimmer', sia: 'HNF', group: 'zusammen', cap: (a) => Math.max(2, Math.round(a / 3)) },
  schulung:    { label: 'Schulungsraum',  sia: 'HNF', group: 'zusammen', cap: (a) => Math.max(4, Math.round(a / 2.5)) },
  lounge:      { label: 'Lounge',         sia: 'HNF', group: 'zusammen', cap: (a) => Math.round(a / 4) },
  archiv:      { label: 'Archiv',         sia: 'NNF', group: 'sonder',   cap: () => 0 },
  lager:       { label: 'Lager',          sia: 'NNF', group: 'sonder',   cap: () => 0 },
  teekueche:   { label: 'Teeküche',       sia: 'NNF', group: 'infra',    cap: () => 0 },
  druckraum:   { label: 'Druckerraum',    sia: 'NNF', group: 'infra',    cap: () => 0 },
  wc:          { label: 'WC',             sia: 'NNF', group: 'infra',    cap: () => 0 },
  korridor:    { label: 'Korridor',       sia: 'VF',  group: 'infra',    cap: () => 0 },
  treppenhaus: { label: 'Treppenhaus',    sia: 'VF',  group: 'infra',    cap: () => 0 },
  technik:     { label: 'Technikraum',    sia: 'TF',  group: 'infra',    cap: () => 0 },
};
const SIA_LABEL = { HNF: 'Hauptnutzfläche', NNF: 'Nebennutzfläche', VF: 'Verkehrsfläche', FF: 'Funktionsfläche', TF: 'Technikfläche' };
const GROUP_LABEL = { arbeit: 'Arbeitsplätze', zusammen: 'Zusammenarbeit', infra: 'Infrastruktur', sonder: 'Sonderräume' };

/* ------------------------------------------------------------ Zeichnung ---- */
const M = 100;              // Einheiten je Meter
const KORR = 2.4 * M;       // Korridorbreite
const BUND = 6.0 * M;       // Zimmertiefe je Bund

// Deterministischer Zufall: derselbe Lauf erzeugt dieselbe Datei. Mit
// Math.random() wäre jede Regenerierung ein vollständiger Diff.
function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Zweibündige Anlage: Korridor in der Mitte, Zimmer beidseits, Kern
// (Treppenhaus, WC, Technik) am östlichen Ende. Der Regelfall im
// Verwaltungsbau — und ein Grundriss, auf dem alle Einfärbemodi etwas zeigen.
function baueGeschoss(buildingId, key, hnfZiel, waehleVe) {
  const def = GESCHOSS[key];
  const floorId = `${buildingId.replace(/\//g, '-')}-${key}`;
  const rand = rng(floorId);
  const laenge = Math.max(24 * M, Math.round((hnfZiel * M * M) / (2 * BUND) / (M / 2)) * (M / 2));
  const yNord = 0, yKorr = BUND, ySued = BUND + KORR;
  const hoehe = BUND * 2 + KORR;

  const spaces = [];
  let nr = 1;
  const push = (useType, x, y, w, h, ve) => {
    const area = Math.round((w / M) * (h / M) * 10) / 10;
    const u = USE[useType];
    spaces.push({
      spaceId: `${floorId}-${String(nr).padStart(2, '0')}`,
      floorId, buildingId,
      roomNumber: `${def.label} ${String(nr).padStart(2, '0')}`,
      useType, useLabel: u.label,
      sia: u.sia, siaLabel: SIA_LABEL[u.sia],
      group: u.group, groupLabel: GROUP_LABEL[u.group],
      area,
      capacity: u.cap(area),
      bookable: useType === 'sitzung' || useType === 'fokusraum' || useType === 'schulung',
      occupierVe: ve === null ? null : (ve || waehleVe(rand)),
      rect: [x, y, w, h],
    });
    nr++;
  };

  push('korridor', 0, yKorr, laenge, KORR, null);
  const kern = 4.2 * M;
  push('treppenhaus', laenge - kern, yNord, kern, BUND, null);
  push('wc', laenge - kern, ySued, kern / 2, BUND, null);
  push('technik', laenge - kern / 2, ySued, kern / 2, BUND, null);

  for (const [y, bund] of [[yNord, 'nord'], [ySued, 'sued']]) {
    let x = 0, i = 0;
    const erster = spaces.length;
    while (x < laenge - kern - M) {
      const r = rand();
      let useType;
      if (i === 0 && bund === 'nord' && key === 'eg') useType = 'empfang';
      else if (r < 0.54) useType = 'buero';
      else if (r < 0.66) useType = 'sitzung';
      else if (r < 0.74) useType = 'openspace';
      else if (r < 0.80) useType = 'fokusraum';
      else if (r < 0.85) useType = 'lager';
      else if (r < 0.89) useType = 'teekueche';
      else if (r < 0.93) useType = 'archiv';
      else if (r < 0.97) useType = 'druckraum';
      else useType = 'lounge';
      i++;
      const spanne = ['sitzung', 'schulung', 'openspace', 'lounge'].includes(useType) ? [6, 8.5]
        : ['lager', 'teekueche', 'druckraum', 'archiv', 'fokusraum'].includes(useType) ? [2.4, 3.6]
        : [3.6, 5.4];
      let b = Math.round((spanne[0] + rand() * (spanne[1] - spanne[0])) * 2) / 2 * M;
      if (x + b > laenge - kern) b = laenge - kern - x;
      if (b < 2 * M) break;
      push(useType, x, y, b, BUND);
      x += b;
    }
    // Reststreifen dem letzten Zimmer zuschlagen. Ein Rest unter 2 m wäre als
    // eigener Raum unsinnig, als Lücke im Plan aber ein weisses Loch zwischen
    // Zimmerflucht und Kern — der Grundriss sähe unfertig aus.
    const rest = (laenge - kern) - x;
    if (rest > 0 && spaces.length > erster) {
      const letzter = spaces[spaces.length - 1];
      letzter.rect[2] += rest;
      letzter.area = Math.round((letzter.rect[2] / M) * (letzter.rect[3] / M) * 10) / 10;
      letzter.capacity = USE[letzter.useType].cap(letzter.area);
    }
  }

  const hnf = spaces.filter((s) => s.sia === 'HNF');
  return {
    floor: {
      floorId, buildingId, key, label: def.label, level: def.level,
      areaGross: Math.round((laenge / M) * (hoehe / M)),
      areaHnf: Math.round(hnf.reduce((n, s) => n + s.area, 0)),
      rooms: spaces.length,
      extent: [laenge, hoehe],   // viewBox der SVG-Zeichnung
    },
    spaces,
  };
}

/* ------------------------------------------------------------- Erzeugen ---- */
const veProGebaeude = new Map();
for (const t of MIETEN) {
  const l = veProGebaeude.get(t.b) || [];
  if (!l.includes(t.ve)) l.push(t.ve);
  veProGebaeude.set(t.b, l);
}

const floors = [], spaces = [], tenancies = [];
const gebaut = new Set();
const fehlend = [];

for (const t of MIETEN) {
  const b = bld.get(t.b);
  if (!b) { fehlend.push(t.b); continue; }
  const ves = veProGebaeude.get(t.b);
  const waehleVe = (rand) => ves[Math.floor(rand() * ves.length)];

  for (const key of t.floors) {
    const k = `${t.b}|${key}`;
    if (gebaut.has(k)) continue;
    gebaut.add(k);
    const { floor, spaces: sp } = baueGeschoss(t.b, key, Math.round(t.hnf / t.floors.length), waehleVe);
    floors.push(floor);
    spaces.push(...sp);
  }

  const bilder = Array.isArray(b.bilder) ? b.bilder : [];
  tenancies.push({
    tenancyId: t.id,
    ve: t.ve, veName: t.veName, department: t.dep,
    buildingId: t.b,
    buildingName: b.bbl_bez || t.b,
    street: [b.adr_str, b.adr_hsnr].filter(Boolean).join(' ').trim(),
    zip: b.adr_plz || '', city: b.adr_ort || '', canton: b.adr_reg || '', land: b.adr_land || '',
    lat: b.wgs84_lat, lon: b.wgs84_lon,
    portfolioCategory: b.bbl_port || '—',
    photoSrc: (bilder[0] && bilder[0].src) || '',
    // Ganze Bildreihe des Standorts, mit Nachweis — das Mietendenportal zeigt
    // denselben Kopf wie das Inventar (Mosaik + Karte + Vollbildgalerie) und
    // braucht die Angaben deshalb im eigenen Datensatz, ohne Join.
    bilder: bilder.map((x) => ({
      src: x.src, titel: x.titel || '', fotograf: x.fotograf || '',
      credit: x.credit || '', lizenz: x.lizenz || '',
      quelle: 'https://www.bbl.admin.ch/de/mediendatenbank',
    })),
    floors: t.floors.map((k) => `${t.b.replace(/\//g, '-')}-${k}`),
    floorLabels: t.floors.map((k) => GESCHOSS[k].label),
    areaHnf: t.hnf,
    workstations: t.ws,
    leaseStart: t.from, leaseEnd: t.to,
    yearlyCost: t.cost, currency: 'CHF',
    costCentre: t.kst,
    // Ansprechstellen stehen mit Namen und Adresse im Datensatz, nicht als
    // Verweis in ein Kontaktregister — wer die Datei liest, soll sehen, an wen
    // sich Mietende wenden. `contactId` bleibt als Rückverweis.
    contacts: kontakte.filter((c) => ['pfm', 'campus'].includes(c.contactId))
      .map((c) => ({ contactId: c.contactId, rolle: c.contactId === 'pfm' ? 'Portfoliomanagement' : 'Objektbetrieb',
        name: c.name, email: c.email, phone: c.phone })),
  });
}

writeLines('data/tenancies.json', tenancies);
writeLines('data/floors.json', floors);
writeLines('data/spaces.json', spaces);

const byUse = {}, bySia = {};
for (const s of spaces) { byUse[s.useType] = (byUse[s.useType] || 0) + 1; bySia[s.sia] = (bySia[s.sia] || 0) + 1; }
console.log('Mietverhältnisse:', tenancies.length, '· Geschosse:', floors.length, '· Räume:', spaces.length);
console.log('Gebäude:', new Set(tenancies.map((t) => t.buildingId)).size, '· Verwaltungseinheiten:', new Set(tenancies.map((t) => t.ve)).size);
console.log('SIA 416:', Object.entries(bySia).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('Raumtypen:', Object.entries(byUse).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
if (fehlend.length) console.log('FEHLENDE Gebäude:', fehlend.join(', '));
