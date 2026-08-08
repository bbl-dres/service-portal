// Replace invented demo-property details with researched, sourced facts about
// real federal buildings.
//
// A repeatable script keeps every mapping from demo record to real building
// reviewable and produces the same result on every run.
//
//   node scripts/apply-research-data.mjs --check     (read-only validation)
//   node scripts/apply-research-data.mjs             (write files)
//
// SOURCES
//   Building data, area, volume, cost, architects and construction dates:
//     BBL building documentation, listed per record in the raw `quellen` field.
//   EGID, EGRID, parcel number, official area and parcel geometry:
//     © Data: swisstopo and cantonal cadastral surveying via geodienste.ch,
//     fetched on 2026-07-29 with scripts/fetch-swisstopo.mjs.
//   Diplomatic-property addresses: EDA. International coordinates: OpenStreetMap.
//   Images: Wikimedia Commons, with author and licence recorded per image.
//
// NO FACT WAS GUESSED. Where nothing is published, the explicitly labelled
// demo values for amounts, rents and responsible contacts remain unchanged.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Keep the former German flag as a quoted compatibility value.
const checkOnly = process.argv.includes('--check') || process.argv.includes('--pruefen');
const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
const readJson = (file) => JSON.parse(readFileSync(DATA_DIR + file, 'utf8'));

// ---------------------------------------------------------------------------
// Map the stable bbl_id to a real building. Keeping those identifiers preserves
// all 233 child records for assets, contracts, costs, areas and contacts.
// ---------------------------------------------------------------------------
const BUILDINGS = {
  '1080/4840/AF': {
    name: 'Bundeshaus West',
    street: 'Bundesgasse', number: '1', postalCode: '3011', city: 'Bern', countryCode: 'CH', region: 'BE',
    lat: 46.946346, lon: 7.442977, lv95_e: 2599669.6, lv95_n: 1199471.6,
    egid: '1230654', egrid: 'CH127620463518', municipality: 'Bern', municipalityNumber: 351,
    constructionYear: 1857, renovationYear: 2010,
    portfolioCategory: 'Verwaltungsgebäude', portfolioSubcategory: 'Bundesverwaltung',
    primaryUse: 'Verwaltung', secondaryUse: 'Departementsgebäude',
    historic: 'Ja', protected: 'Ja', kgs_kat: 'A', kgs_nr: 615,
    grossFloorArea: 15860, buildingVolume: 69025, floorsAboveGround: 6,
    architect: 'Friedrich Studer (1852–1857); Itten + Brechbühl AG, Bern (Sanierung 2008–2010)',
    occupants: 'EDA, Bundeskanzlei, EJPD, Parlamentsdienste',
    image: { url: 'https://upload.wikimedia.org/wikipedia/commons/7/76/Bundeshaus_West_%282019-06-23%29.jpg',
      author: 'Arkhein Drakenov', license: 'CC BY-SA 4.0',
      sourcePage: 'https://commons.wikimedia.org/wiki/File:Bundeshaus_West_(2019-06-23).jpg' },
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/xpRh20JjlO-A/20100101_Bern%2C%20Bundesgasse%201%2C%20Sanierung_DE.pdf'],
    parcel: { number: '1058', area: 9893, name: 'Bundesgasse 1' },
  },
  '1080/3120/AB': {
    name: 'Sammlungszentrum Schweizerisches Nationalmuseum',
    street: 'Lindenmoosstrasse', number: '1', postalCode: '8910', city: 'Affoltern am Albis', countryCode: 'CH', region: 'ZH',
    lat: 47.268894, lon: 8.445229, lv95_e: 2676876.0, lv95_n: 1237056.0,
    egid: '201028111', egrid: 'CH827785288941', municipality: 'Affoltern am Albis', municipalityNumber: 2,
    constructionYear: 1985, renovationYear: 2007,
    portfolioCategory: 'Lager / Logistik', portfolioSubcategory: 'Kultur',
    primaryUse: 'Lager', secondaryUse: 'Sammlungsdepot',
    historic: 'Ja', protected: 'Nein', kgs_kat: 'A', kgs_nr: 11777,
    grossFloorArea: 20093, buildingVolume: 92810, floorsAboveGround: 3,
    architect: 'Stücheli Architekten AG, Zürich (Umnutzung 2005–2007)',
    occupants: 'Schweizerisches Nationalmuseum',
    image: { url: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Sammlungszentrum_Affoltern_am_Albis._Drohnenaufnahme.jpg',
      author: 'Schweizerisches Nationalmuseum', license: 'CC BY-SA 4.0',
      sourcePage: 'https://commons.wikimedia.org/wiki/File:Sammlungszentrum_Affoltern_am_Albis._Drohnenaufnahme.jpg' },
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/B66TZzOayoZP/20070901_Affoltern%20am%20Albis%20Umnutzung%20vom%20Zeughaus%20zum%20Sammlungszentrum_DE.pdf'],
    parcel: { number: '4723', area: 43930, name: 'Lindenmoos' },
  },
  '1080/4100/AC': {
    name: 'Campus BAZG (Ausbildungszentrum Liestal)',
    street: 'Kasinostrasse', number: '4', postalCode: '4410', city: 'Liestal', countryCode: 'CH', region: 'BL',
    lat: 47.479862, lon: 7.744051, lv95_e: 2622310.0, lv95_n: 1259520.0,
    egid: '9004666', egrid: 'CH207059761779', municipality: 'Liestal', municipalityNumber: 2829,
    constructionYear: 1981, renovationYear: 2015,
    portfolioCategory: 'Ausbildung', portfolioSubcategory: 'Bundesverwaltung',
    primaryUse: 'Ausbildung', secondaryUse: 'Schulungs- und Unterkunftsgebäude',
    historic: 'Nein', protected: 'Nein', kgs_kat: null, kgs_nr: null,
    grossFloorArea: 2480, buildingVolume: 8510, floorsAboveGround: 3,
    architect: 'Zwimpfer + Meyer, Basel (1981); Aschwanden Schürer Architekten AG, Zürich (Erweiterung 2015)',
    occupants: 'Bundesamt für Zoll und Grenzsicherheit BAZG',
    image: null,
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/YMr47zVY9cLN/20150501_Liestal%20Kasinostrasse%204%20Zollschule%20Erweiterung%20Modulbau_DE.pdf'],
    parcel: { number: '1787', area: 10326, name: 'Kasinostrasse' },
  },
  '1080/2800/AD': {
    name: 'Dienstwohnungen EDA Effingerstrasse',
    street: 'Effingerstrasse', number: '29', postalCode: '3008', city: 'Bern', countryCode: 'CH', region: 'BE',
    lat: 46.945808, lon: 7.432851, lv95_e: 2598897.0, lv95_n: 1199420.0,
    egid: '1234494', egrid: 'CH650246873582', municipality: 'Bern', municipalityNumber: 351,
    constructionYear: 1934, renovationYear: 2018,
    portfolioCategory: 'Wohnliegenschaft', portfolioSubcategory: 'Bundesverwaltung',
    primaryUse: 'Wohnen', secondaryUse: 'Dienstwohnungen',
    historic: 'Ja', protected: 'Nein', kgs_kat: null, kgs_nr: null,
    grossFloorArea: 1138, buildingVolume: 3806, floorsAboveGround: 7,
    architect: 'Hans Weiss, Bern (1933/34); Ehrenbold Schudel Architektur, Bern (Umbau 2017/18)',
    occupants: 'EDA — Dienstwohnungen, DEZA Humanitäre Hilfe',
    image: null,
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/J-9Pctw1raik/20180701_Bern%20Effingerstrasse%2029%20Sanierung%20und%20Umbau%20zu%20Dienstwohnungen_DE.pdf'],
    parcel: { number: '2746', area: 615, name: 'Effingerstrasse 29' },
  },
  '1080/1950/AE': {
    name: 'Rechenzentrum CAMPUS Frauenfeld',
    street: 'Auenfeld', number: '', postalCode: '8500', city: 'Frauenfeld', countryCode: 'CH', region: 'TG',
    lat: 47.570346, lon: 8.884102, lv95_e: 2708430.0, lv95_n: 1269660.0,
    egid: null, egrid: 'CH652680772937', municipality: 'Frauenfeld', municipalityNumber: 4566,
    constructionYear: 2019, renovationYear: null,
    portfolioCategory: 'Infrastruktur IT', portfolioSubcategory: 'Bundesverwaltung',
    primaryUse: 'Infrastruktur', secondaryUse: 'Rechenzentrum',
    historic: 'Nein', protected: 'Nein', kgs_kat: null, kgs_nr: null,
    grossFloorArea: 2000, buildingVolume: null, floorsAboveGround: 2,
    architect: null,
    occupants: 'BIT, Führungsunterstützungsbasis der Armee FUB, ISC-EJPD',
    image: null,
    // armasuisse Real Estate, not BBL, is the client for this special case.
    // No street address is published for the military training ground.
    sources: ['https://www.bit.admin.ch/de/rz-campus-78', 'https://www.vtg.admin.ch/de/rechenzentrum-campus-in-frauenfeld-feiert-aufrichte'],
    parcel: { number: '61736', area: 5001, name: 'Auenfeld' },
  },
  '1080/4850/AG': {
    name: 'Verwaltungszentrum Guisanplatz',
    street: 'Guisanplatz', number: '1', postalCode: '3014', city: 'Bern', countryCode: 'CH', region: 'BE',
    lat: 46.959785, lon: 7.463306, lv95_e: 2601210.0, lv95_n: 1200980.0,
    egid: '191682279', egrid: 'CH208835944617', municipality: 'Bern', municipalityNumber: 351,
    constructionYear: 2019, renovationYear: null,
    portfolioCategory: 'Verwaltungsgebäude', portfolioSubcategory: 'Bundesverwaltung',
    primaryUse: 'Verwaltung', secondaryUse: 'Verwaltungszentrum',
    historic: 'Nein', protected: 'Nein', kgs_kat: null, kgs_nr: null,
    grossFloorArea: 30000, buildingVolume: null, floorsAboveGround: 6,
    architect: 'Aebi & Vincent Architekten SIA AG, Bern (Wettbewerb 2009)',
    occupants: 'armasuisse, Bundesanwaltschaft, fedpol, BABS',
    image: null,
    sources: ['https://www.verwaltungszentrum-guisanplatz.ch/bauprojekt', 'https://aebi-vincent.ch/projekte/neubau-umbau-und-sanierung-verwaltungszentrum-guisanplatz-bern/'],
    parcel: { number: '586', area: 41438, name: 'Guisanplatz' },
  },

  // --- Diplomatic properties (OpenStreetMap coordinates, EDA addresses) -------
  '1080/5210/AA': {
    name: 'Schweizerische Botschaft Berlin',
    street: 'Otto-von-Bismarck-Allee', number: '4A', postalCode: '10557', city: 'Berlin', countryCode: 'DE', region: 'Berlin',
    lat: 52.521102, lon: 13.371281, lv95_e: null, lv95_n: null,
    egid: null, egrid: null, municipality: 'Berlin', municipalityNumber: null,
    constructionYear: 1870, renovationYear: 2000,
    portfolioCategory: 'Diplomatische Vertretung', portfolioSubcategory: 'Aussennetz EDA',
    primaryUse: 'Verwaltung', secondaryUse: 'Botschaft (Kanzlei)',
    historic: 'Ja', protected: 'Ja', kgs_kat: null, kgs_nr: null,
    grossFloorArea: 5701, buildingVolume: null, floorsAboveGround: 4,
    architect: 'Friedrich Hitzig (1870/71); Diener & Diener Architekten, Basel (Erweiterung 1995–2000)',
    occupants: 'EDA — Schweizerische Botschaft in Deutschland',
    image: { url: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Schweizerische_Botschaft_in_Berlin.jpg',
      author: 'Lukas Beck', license: 'CC BY-SA 4.0',
      sourcePage: 'https://commons.wikimedia.org/wiki/File:Schweizerische_Botschaft_in_Berlin.jpg' },
    sources: ['https://www.bbl.admin.ch/dam/de/sd-web/6KztH5h4iF7L/20001201_Berlin%2C%20Deutschland%2C%20Schweizerische%20Botschaft_DE.pdf'],
    parcel: { number: '41', area: 2100, name: 'Otto-von-Bismarck-Allee' },
  },
  '1080/5320/AA': {
    name: 'Schweizerisches Generalkonsulat New York',
    street: 'Third Avenue', number: '633', postalCode: '10017', city: 'New York', countryCode: 'US', region: 'NY',
    lat: 40.753889, lon: -73.972500, lv95_e: null, lv95_n: null,
    egid: null, egrid: null, municipality: 'New York', municipalityNumber: null,
    constructionYear: 1963, renovationYear: null,
    portfolioCategory: 'Diplomatische Vertretung', portfolioSubcategory: 'Aussennetz EDA',
    primaryUse: 'Verwaltung', secondaryUse: 'Generalkonsulat',
    historic: 'Nein', protected: 'Nein', kgs_kat: null, kgs_nr: null,
    grossFloorArea: null, buildingVolume: null, floorsAboveGround: null,
    architect: null,
    occupants: 'EDA — Generalkonsulat, Swissnex, Schweiz Tourismus',
    image: null,
    // Rented space in a high-rise, not a federally owned building.
    sources: ['https://www.eda.admin.ch/countries/usa/en/home/representations/generalkonsulat-new-york.html'],
    parcel: null,
  },
  '1080/5410/AA': {
    name: 'Schweizerische Botschaft Tokio',
    street: 'Minami-Azabu, Minato-ku', number: '5-9-12', postalCode: '106-8589', city: 'Tokio', countryCode: 'JP', region: 'Präfektur Tokio',
    lat: 35.653365, lon: 139.723812, lv95_e: null, lv95_n: null,
    egid: null, egrid: null, municipality: 'Minato-ku', municipalityNumber: null,
    constructionYear: 1983, renovationYear: null,
    portfolioCategory: 'Diplomatische Vertretung', portfolioSubcategory: 'Aussennetz EDA',
    primaryUse: 'Verwaltung', secondaryUse: 'Botschaft mit Residenz',
    historic: 'Nein', protected: 'Ja', kgs_kat: null, kgs_nr: null,
    grossFloorArea: null, buildingVolume: null, floorsAboveGround: null,
    architect: 'Rolf Kaiser',
    occupants: 'EDA — Schweizerische Botschaft in Japan',
    image: { url: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Embassy_of_Switzerland%2C_Tokyo.jpg',
      author: 'Syced', license: 'CC0 1.0 (gemeinfrei)',
      sourcePage: 'https://commons.wikimedia.org/wiki/File:Embassy_of_Switzerland,_Tokyo.jpg' },
    sources: ['https://www.eda.admin.ch/countries/japan/en/home/representations/embassy-tokyo.html'],
    parcel: { number: '9-12', area: null, name: 'Minami-Azabu' },
  },
  '1080/5510/AA': {
    name: 'Schweizerische Botschaft Brasília',
    street: 'SES Avenida das Nações, Qd. 811', number: 'Lote 41', postalCode: '70448-900', city: 'Brasília', countryCode: 'BR', region: 'Distrito Federal',
    lat: -15.831611, lon: -47.897273, lv95_e: null, lv95_n: null,
    egid: null, egrid: null, municipality: 'Brasília', municipalityNumber: null,
    constructionYear: 1977, renovationYear: null,
    portfolioCategory: 'Diplomatische Vertretung', portfolioSubcategory: 'Aussennetz EDA',
    primaryUse: 'Verwaltung', secondaryUse: 'Botschaft (Kanzlei)',
    historic: 'Nein', protected: 'Ja', kgs_kat: null, kgs_nr: null,
    grossFloorArea: null, buildingVolume: null, floorsAboveGround: null,
    architect: 'Hans und Annemarie Hubacher',
    occupants: 'EDA — Schweizerische Botschaft in Brasilien',
    image: null,
    sources: ['https://pt.wikipedia.org/wiki/Embaixada_da_Su%C3%AD%C3%A7a_em_Bras%C3%ADlia'],
    parcel: { number: 'Lote 41', area: null, name: 'Setor de Embaixadas Sul' },
  },
  '1080/5620/AA': {
    name: 'Schweizerische Botschaft Canberra',
    street: 'Melbourne Avenue', number: '7', postalCode: '2603', city: 'Canberra', countryCode: 'AU', region: 'ACT',
    lat: -35.313476, lon: 149.121046, lv95_e: null, lv95_n: null,
    egid: null, egrid: null, municipality: 'Forrest', municipalityNumber: null,
    constructionYear: 1975, renovationYear: null,
    portfolioCategory: 'Diplomatische Vertretung', portfolioSubcategory: 'Aussennetz EDA',
    primaryUse: 'Verwaltung', secondaryUse: 'Botschaft mit Residenz',
    historic: 'Nein', protected: 'Ja', kgs_kat: null, kgs_nr: null,
    grossFloorArea: null, buildingVolume: null, floorsAboveGround: 2,
    architect: 'Hermann Baur und Hans Peter Baur',
    occupants: 'EDA — Schweizerische Botschaft in Australien',
    image: { url: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Embassy_of_Switzerland_in_Canberra.jpg',
      author: 'Nomisztif', license: 'CC BY-SA 4.0',
      sourcePage: 'https://commons.wikimedia.org/wiki/File:Embassy_of_Switzerland_in_Canberra.jpg' },
    sources: ['https://www.eda.admin.ch/countries/australia/en/home/representations/embassy-in-canberra.html'],
    parcel: { number: '7', area: null, name: 'Melbourne Avenue' },
  },
};

// ---------------------------------------------------------------------------
const buildingCollection = readJson('buildings.geojson');
const parcelCollection = readJson('parcels.geojson');
const report = [];

for (const feature of buildingCollection.features) {
  const properties = feature.properties;
  const building = BUILDINGS[properties.bbl_id];
  if (!building) { report.push(`  – ${properties.bbl_id} unchanged (${properties.bbl_bez})`); continue; }
  const previousName = properties.bbl_bez;

  properties.bbl_bez = building.name;
  properties.adr_str = building.street; properties.adr_hsnr = building.number; properties.adr_plz = building.postalCode; properties.adr_ort = building.city;
  properties.adr_land = building.countryCode; properties.adr_reg = building.region;
  properties.adr_conct = [building.street, building.number].filter(Boolean).join(' ') + `, ${building.postalCode} ${building.city}`;
  properties.wgs84_lat = building.lat; properties.wgs84_lon = building.lon;
  properties.lv95_e = building.lv95_e; properties.lv95_n = building.lv95_n;
  if (building.egid) properties.av_egid = building.egid; else properties.av_egid = null;
  properties.av_egrid = building.egrid;
  properties.bfs_gem = building.municipality; properties.bfs_gemnr = building.municipalityNumber;
  properties.bbl_bjahr = building.constructionYear; properties.bbl_vjahr = building.renovationYear;
  properties.bbl_port = building.portfolioCategory; properties.bbl_port2 = building.portfolioSubcategory;
  properties.bbl_gbda1 = building.primaryUse; properties.bbl_gbda2 = building.secondaryUse;
  properties.bbl_hist = building.historic; properties.bbl_arch = building.protected;
  properties.kgs_kat = building.kgs_kat; properties.kgs_nr = building.kgs_nr;
  if (building.grossFloorArea) { properties.garea_gf = building.grossFloorArea; }
  if (building.buildingVolume) { properties.gvol_gv = building.buildingVolume; }
  if (building.floorsAboveGround) { properties.gastw = building.floorsAboveGround; }

  // Add sourced architect, occupant and provenance fields.
  properties.bbl_architekt = building.architect;
  properties.bbl_nutzer = building.occupants;
  properties['quellen'] = building.sources;
  properties['datenherkunft'] = building.egrid
    ? 'BBL-Bautendokumentation; Kataster © Data: swisstopo / amtliche Vermessung'
    : 'BBL / EDA, Koordinaten OpenStreetMap';

  if (building.image) {
    const additionalImages = Array.isArray(properties.img_url) ? properties.img_url.slice(1) : [];
    properties.img_url = [building.image.url, ...additionalImages];
    properties.img_credit = `${building.image.author}, ${building.image.license} — ${building.image.sourcePage}`;
  } else {
    properties.img_credit = 'Platzhalterbild (Unsplash) — für dieses Objekt existiert keine frei nutzbare Aufnahme';
  }

  // Keep point geometry aligned with the updated coordinates.
  if (feature.geometry && feature.geometry.type === 'Point') feature.geometry.coordinates = [building.lon, building.lat];
  report.push(`  ✓ ${properties.bbl_id}  ${previousName}  →  ${building.name}`);
}

// --- Parcels -----------------------------------------------------------------
// Official parcel geometry is fetched once into the ignored research directory.
// Keep a readable warning because a clean checkout does not contain that file.
const GEOMETRY_PATH = fileURLToPath(new URL('../research/data/parcel-geometries.json', import.meta.url));
let GEOMETRIES = {};
try { GEOMETRIES = JSON.parse(readFileSync(GEOMETRY_PATH, 'utf8')); }
catch { console.warn(`! ${GEOMETRY_PATH} is missing; parcels keep their demo geometry.\n`
  + '  Refresh with: node scripts/fetch-swisstopo.mjs --file research/data/addresses.json --output ...\n'); }

for (const feature of parcelCollection.features) {
  const properties = feature.properties;
  const businessEntityId = String(properties.bbl_id).split('/')[1];
  const match = Object.entries(BUILDINGS).find(([id]) => id.split('/')[1] === businessEntityId);
  if (!match) continue;
  const [, building] = match;
  if (!building.parcel) continue;

  properties.bbl_bez = building.parcel.name;
  properties.av_nr = building.parcel.number;
  properties.av_egrid = building.egrid;
  if (building.parcel.area) properties.larea_gsf = building.parcel.area;
  properties.adr_str = building.street; properties.adr_hsnr = building.number; properties.adr_plz = building.postalCode; properties.adr_ort = building.city;
  properties.adr_land = building.countryCode; properties.adr_reg = building.region;
  properties.bfs_gem = building.municipality; properties.bfs_gemnr = building.municipalityNumber;
  properties.wgs84_lat = building.lat; properties.wgs84_lon = building.lon;
  properties['datenherkunft'] = building.egrid && GEOMETRIES[building.egrid]
    ? 'Amtliche Vermessung — © Data: swisstopo / geodienste.ch'
    : 'Demo-Geometrie (im Ausland keine amtliche Quelle verfügbar)';

  // Use official parcel geometry where available.
  if (building.egrid && GEOMETRIES[building.egrid]) feature.geometry = GEOMETRIES[building.egrid];
}

console.log('Buildings:');
report.forEach((line) => console.log(line));
const officialGeometryCount = parcelCollection.features.filter((f) => /swisstopo/.test(f.properties['datenherkunft'] || '')).length;
console.log(`\nParcels: ${officialGeometryCount} of ${parcelCollection.features.length} with official geometry`);

if (checkOnly) { console.log('\n(--check: no files written)'); }
else {
  writeFileSync(DATA_DIR + 'buildings.geojson', JSON.stringify(buildingCollection, null, 1));
  writeFileSync(DATA_DIR + 'parcels.geojson', JSON.stringify(parcelCollection, null, 1));
  console.log('\n→ wrote data/buildings.geojson and data/parcels.geojson');
}
