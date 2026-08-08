// Generate the three datasets for the tenant portal (#/app/tenancies):
//   data/tenancies.json  tenancies — one administrative unit rents building space
//   data/floors.json     floors per building
//   data/spaces.json     rooms per floor, with local drawing-grid rectangles
//
// NO RUNTIME JOIN: copy building names and addresses from the golden record
// (data/buildings.geojson). The tenant portal owns its contract data, matching
// the separation between EPPM and SAP RE-FX for construction projects.
//
// THIS GEOMETRY IS NOT GEOGRAPHY. A floor plan is a local drawing with 100
// units per metre and an origin at the top left. This keeps the plan printable
// and SVG-based, with every room individually focusable and no WebGL/map service.
//
//   node scripts/build-tenancy-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, normalize } from 'node:path';

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..')) + '/';
// Write one record per line. Hundreds of pretty-printed room records make diffs
// unreadable; this matches the compact data/contacts.json format.
const writeLines = (f, v) =>
  writeFileSync(ROOT + f, '[\n' + v.map((x) => '  ' + JSON.stringify(x)).join(',\n') + '\n]\n');

const fc = JSON.parse(readFileSync(ROOT + 'data/buildings.geojson', 'utf8'));
const contacts = JSON.parse(readFileSync(ROOT + 'data/contacts.json', 'utf8'));
const buildingsById = new Map();
for (const feature of fc.features || []) {
  if (feature.properties?.bbl_id) buildingsById.set(feature.properties.bbl_id, feature.properties);
}

/* ------------------------------------------------------------- Tenancies ---- */
// An administrative unit is called a Verwaltungseinheit (VE) in the German UI.
// Multiple units can occupy one building, so tenancy rather than building is
// the record identity.
const TENANCY_SEEDS = [
  { id: 'MV-2026-001', administrativeUnitId: 'BAFU', administrativeUnitName: 'Bundesamt für Umwelt BAFU', department: 'Abt. Ressourcen', buildingId: '1080/4850/AG', floors: ['2og', '3og'], mainUsableArea: 1180, workstations: 96, leaseStart: '2019-04-01', leaseEnd: '2034-03-31', yearlyCost: 1920000, costCentre: 'A-810.2140' },
  { id: 'MV-2026-002', administrativeUnitId: 'BAFU', administrativeUnitName: 'Bundesamt für Umwelt BAFU', department: 'Abt. Wasser', buildingId: '1080/6650/AA', floors: ['1og'], mainUsableArea: 640, workstations: 48, leaseStart: '2021-01-01', leaseEnd: '2031-12-31', yearlyCost: 980000, costCentre: 'A-810.2141' },
  { id: 'MV-2026-003', administrativeUnitId: 'BLV', administrativeUnitName: 'Bundesamt für Lebensmittelsicherheit und Veterinärwesen BLV', department: 'Direktionsbereich', buildingId: '1080/6650/AA', floors: ['eg', '2og'], mainUsableArea: 1420, workstations: 112, leaseStart: '2018-07-01', leaseEnd: '2028-06-30', yearlyCost: 2180000, costCentre: 'A-341.1020' },
  { id: 'MV-2026-004', administrativeUnitId: 'swisstopo', administrativeUnitName: 'Bundesamt für Landestopografie swisstopo', department: 'Direktion', buildingId: '1080/6870/AA', floors: ['eg', '1og'], mainUsableArea: 890, workstations: 64, leaseStart: '2020-09-01', leaseEnd: '2035-08-31', yearlyCost: 1340000, costCentre: 'A-506.3300' },
  { id: 'MV-2026-005', administrativeUnitId: 'BVGer', administrativeUnitName: 'Bundesverwaltungsgericht', department: 'Generalsekretariat', buildingId: '1080/6980/AA', floors: ['eg'], mainUsableArea: 316, workstations: 22, leaseStart: '2017-01-01', leaseEnd: '2027-12-31', yearlyCost: 512000, costCentre: 'A-104.0010' },
  { id: 'MV-2026-006', administrativeUnitId: 'BAZG', administrativeUnitName: 'Bundesamt für Zoll und Grenzsicherheit BAZG', department: 'Ausbildung', buildingId: '1080/4100/AC', floors: ['eg', '1og'], mainUsableArea: 1560, workstations: 84, leaseStart: '2022-03-01', leaseEnd: '2032-02-29', yearlyCost: 1760000, costCentre: 'A-606.4400' },
  { id: 'MV-2026-007', administrativeUnitId: 'BAZG', administrativeUnitName: 'Bundesamt für Zoll und Grenzsicherheit BAZG', department: 'Region Wallis', buildingId: '1080/6210/AA', floors: ['eg'], mainUsableArea: 420, workstations: 18, leaseStart: '2016-05-01', leaseEnd: '2026-12-31', yearlyCost: 288000, costCentre: 'A-606.4412' },
  { id: 'MV-2026-008', administrativeUnitId: 'BAK', administrativeUnitName: 'Bundesamt für Kultur BAK', department: 'Sammlungen', buildingId: '1080/6100/AA', floors: ['eg', '1og'], mainUsableArea: 2100, workstations: 54, leaseStart: '2015-01-01', leaseEnd: '2040-12-31', yearlyCost: 3050000, costCentre: 'A-306.2200' },
  { id: 'MV-2026-009', administrativeUnitId: 'BAK', administrativeUnitName: 'Bundesamt für Kultur BAK', department: 'Nationalbibliothek', buildingId: '1080/6430/AA', floors: ['ug', 'eg'], mainUsableArea: 1880, workstations: 41, leaseStart: '2019-11-01', leaseEnd: '2039-10-31', yearlyCost: 2240000, costCentre: 'A-306.2210' },
  { id: 'MV-2026-010', administrativeUnitId: 'BAFU', administrativeUnitName: 'Bundesamt für Umwelt BAFU', department: 'Abt. Klima', buildingId: '1080/7090/AA', floors: ['3og'], mainUsableArea: 520, workstations: 38, leaseStart: '2023-02-01', leaseEnd: '2028-01-31', yearlyCost: 910000, costCentre: 'A-810.2145' },
  { id: 'MV-2026-011', administrativeUnitId: 'swisstopo', administrativeUnitName: 'Bundesamt für Landestopografie swisstopo', department: 'Geodaten', buildingId: '1080/4840/AF', floors: ['2og'], mainUsableArea: 340, workstations: 26, leaseStart: '2024-06-01', leaseEnd: '2029-05-31', yearlyCost: 720000, costCentre: 'A-506.3312' },

  // --- International network -------------------------------------------------
  // The BBL also manages diplomatic properties abroad. EDA is normally the
  // tenant, sometimes sharing with SECO or Presence Switzerland. Federal
  // internal charging is in CHF, with local rent already converted.
  { id: 'MV-2026-012', administrativeUnitId: 'EDA', administrativeUnitName: 'Eidgenössisches Departement für auswärtige Angelegenheiten EDA', department: 'Botschaft Berlin', buildingId: '1080/5210/AA', floors: ['eg', '1og', '2og'], mainUsableArea: 2100, workstations: 74, leaseStart: '2014-01-01', leaseEnd: '2044-12-31', yearlyCost: 2640000, costCentre: 'A-201.7010' },
  { id: 'MV-2026-013', administrativeUnitId: 'SECO', administrativeUnitName: 'Staatssekretariat für Wirtschaft SECO', department: 'Swiss Business Hub Deutschland', buildingId: '1080/5210/AA', floors: ['3og'], mainUsableArea: 420, workstations: 14, leaseStart: '2020-04-01', leaseEnd: '2030-03-31', yearlyCost: 560000, costCentre: 'A-704.1180' },
  { id: 'MV-2026-014', administrativeUnitId: 'EDA', administrativeUnitName: 'Eidgenössisches Departement für auswärtige Angelegenheiten EDA', department: 'Botschaft Tokio', buildingId: '1080/5410/AA', floors: ['eg', '1og'], mainUsableArea: 1640, workstations: 52, leaseStart: '2016-09-01', leaseEnd: '2041-08-31', yearlyCost: 3180000, costCentre: 'A-201.7042' },
  { id: 'MV-2026-015', administrativeUnitId: 'EDA', administrativeUnitName: 'Eidgenössisches Departement für auswärtige Angelegenheiten EDA', department: 'Botschaft Brasília', buildingId: '1080/5510/AA', floors: ['eg', '1og'], mainUsableArea: 1060, workstations: 34, leaseStart: '2012-05-01', leaseEnd: '2032-04-30', yearlyCost: 940000, costCentre: 'A-201.7055' },
  { id: 'MV-2026-016', administrativeUnitId: 'EDA', administrativeUnitName: 'Eidgenössisches Departement für auswärtige Angelegenheiten EDA', department: 'Botschaft Canberra', buildingId: '1080/5620/AA', floors: ['eg'], mainUsableArea: 720, workstations: 24, leaseStart: '2019-02-01', leaseEnd: '2029-01-31', yearlyCost: 810000, costCentre: 'A-201.7062' },
  { id: 'MV-2026-017', administrativeUnitId: 'EDA', administrativeUnitName: 'Eidgenössisches Departement für auswärtige Angelegenheiten EDA', department: 'Generalkonsulat New York', buildingId: '1080/5320/AA', floors: ['eg', '1og'], mainUsableArea: 1180, workstations: 38, leaseStart: '2018-11-01', leaseEnd: '2028-10-31', yearlyCost: 2870000, costCentre: 'A-201.7031' },
  { id: 'MV-2026-018', administrativeUnitId: 'PRS', administrativeUnitName: 'Präsenz Schweiz (EDA)', department: 'Landeskommunikation Nordamerika', buildingId: '1080/5320/AA', floors: ['2og'], mainUsableArea: 260, workstations: 9, leaseStart: '2023-07-01', leaseEnd: '2028-06-30', yearlyCost: 680000, costCentre: 'A-201.7038' },
];

const FLOOR_DEFINITIONS = {
  ug: { label: 'UG', level: -1 },
  eg: { label: 'EG', level: 0 },
  '1og': { label: '1. OG', level: 1 },
  '2og': { label: '2. OG', level: 2 },
  '3og': { label: '3. OG', level: 3 },
};

// Store the label, SIA 416 category and legend group on every room rather than
// joining them at runtime. Each spaces.json record remains self-explanatory.
//
// `sia` uses the German SIA 416 abbreviations stored in the public data
// contract. Room-use and legend-group codes are also persisted compatibility
// values, so they intentionally remain quoted German strings.
const ROOM_TYPES = {
  'buero':       { label: 'Büro',           sia: 'HNF', group: 'arbeit',   capacity: (area) => Math.max(1, Math.round(area / 12)) },
  'openspace':   { label: 'Open Space',     sia: 'HNF', group: 'arbeit',   capacity: (area) => Math.max(1, Math.round(area / 10)) },
  'fokusraum':   { label: 'Fokusraum',      sia: 'HNF', group: 'arbeit',   capacity: () => 1 },
  'empfang':     { label: 'Empfang',        sia: 'HNF', group: 'arbeit',   capacity: () => 2 },
  'sitzung':     { label: 'Sitzungszimmer', sia: 'HNF', group: 'zusammen', capacity: (area) => Math.max(2, Math.round(area / 3)) },
  'schulung':    { label: 'Schulungsraum',  sia: 'HNF', group: 'zusammen', capacity: (area) => Math.max(4, Math.round(area / 2.5)) },
  'lounge':      { label: 'Lounge',         sia: 'HNF', group: 'zusammen', capacity: (area) => Math.round(area / 4) },
  'archiv':      { label: 'Archiv',         sia: 'NNF', group: 'sonder',   capacity: () => 0 },
  'lager':       { label: 'Lager',          sia: 'NNF', group: 'sonder',   capacity: () => 0 },
  'teekueche':   { label: 'Teeküche',       sia: 'NNF', group: 'infra',    capacity: () => 0 },
  'druckraum':   { label: 'Druckerraum',    sia: 'NNF', group: 'infra',    capacity: () => 0 },
  'wc':          { label: 'WC',             sia: 'NNF', group: 'infra',    capacity: () => 0 },
  'korridor':    { label: 'Korridor',       sia: 'VF',  group: 'infra',    capacity: () => 0 },
  'treppenhaus': { label: 'Treppenhaus',    sia: 'VF',  group: 'infra',    capacity: () => 0 },
  'technik':     { label: 'Technikraum',    sia: 'TF',  group: 'infra',    capacity: () => 0 },
};
const SIA_LABEL = { HNF: 'Hauptnutzfläche', NNF: 'Nebennutzfläche', VF: 'Verkehrsfläche', FF: 'Funktionsfläche', TF: 'Technikfläche' };
const GROUP_LABEL = { 'arbeit': 'Arbeitsplätze', 'zusammen': 'Zusammenarbeit', 'infra': 'Infrastruktur', 'sonder': 'Sonderräume' };

/* ---------------------------------------------------------------- Drawing ---- */
const UNITS_PER_METRE = 100;
const CORRIDOR_WIDTH = 2.4 * UNITS_PER_METRE;
const ROOM_DEPTH = 6 * UNITS_PER_METRE;

// Deterministic randomness keeps generated output and diffs stable.
function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Double-loaded layout: a central corridor, rooms on both sides and a service
// core at the east end. This gives every colouring mode useful plan content.
function buildFloor(buildingId, key, targetMainUsableArea, chooseAdministrativeUnit) {
  const floorDefinition = FLOOR_DEFINITIONS[key];
  const floorId = `${buildingId.replace(/\//g, '-')}-${key}`;
  const random = rng(floorId);
  const length = Math.max(24 * UNITS_PER_METRE,
    Math.round((targetMainUsableArea * UNITS_PER_METRE ** 2) / (2 * ROOM_DEPTH) / (UNITS_PER_METRE / 2)) * (UNITS_PER_METRE / 2));
  const northY = 0;
  const corridorY = ROOM_DEPTH;
  const southY = ROOM_DEPTH + CORRIDOR_WIDTH;
  const height = ROOM_DEPTH * 2 + CORRIDOR_WIDTH;

  const spaces = [];
  let sequence = 1;
  const push = (useType, x, y, width, spaceHeight, administrativeUnit) => {
    const area = Math.round((width / UNITS_PER_METRE) * (spaceHeight / UNITS_PER_METRE) * 10) / 10;
    const roomType = ROOM_TYPES[useType];
    spaces.push({
      spaceId: `${floorId}-${String(sequence).padStart(2, '0')}`,
      floorId, buildingId,
      roomNumber: `${floorDefinition.label} ${String(sequence).padStart(2, '0')}`,
      useType, useLabel: roomType.label,
      sia: roomType.sia, siaLabel: SIA_LABEL[roomType.sia],
      group: roomType.group, groupLabel: GROUP_LABEL[roomType.group],
      area,
      capacity: roomType.capacity(area),
      bookable: useType === 'sitzung' || useType === 'fokusraum' || useType === 'schulung',
      occupierVe: administrativeUnit === null ? null : (administrativeUnit || chooseAdministrativeUnit(random)),
      rect: [x, y, width, spaceHeight],
    });
    sequence++;
  };

  push('korridor', 0, corridorY, length, CORRIDOR_WIDTH, null);
  const serviceCoreWidth = 4.2 * UNITS_PER_METRE;
  push('treppenhaus', length - serviceCoreWidth, northY, serviceCoreWidth, ROOM_DEPTH, null);
  push('wc', length - serviceCoreWidth, southY, serviceCoreWidth / 2, ROOM_DEPTH, null);
  push('technik', length - serviceCoreWidth / 2, southY, serviceCoreWidth / 2, ROOM_DEPTH, null);

  for (const [y, wing] of [[northY, 'north'], [southY, 'south']]) {
    let x = 0, i = 0;
    const initialSpaceCount = spaces.length;
    while (x < length - serviceCoreWidth - UNITS_PER_METRE) {
      const r = random();
      let useType;
      if (i === 0 && wing === 'north' && key === 'eg') useType = 'empfang';
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
      const widthRange = ['sitzung', 'schulung', 'openspace', 'lounge'].includes(useType) ? [6, 8.5]
        : ['lager', 'teekueche', 'druckraum', 'archiv', 'fokusraum'].includes(useType) ? [2.4, 3.6]
        : [3.6, 5.4];
      let width = Math.round((widthRange[0] + random() * (widthRange[1] - widthRange[0])) * 2)
        / 2 * UNITS_PER_METRE;
      if (x + width > length - serviceCoreWidth) width = length - serviceCoreWidth - x;
      if (width < 2 * UNITS_PER_METRE) break;
      push(useType, x, y, width, ROOM_DEPTH);
      x += width;
    }
    // Add any strip narrower than two metres to the last room. Leaving it as a
    // gap would create an artificial white hole between the rooms and core.
    const remainder = (length - serviceCoreWidth) - x;
    if (remainder > 0 && spaces.length > initialSpaceCount) {
      const lastSpace = spaces[spaces.length - 1];
      lastSpace.rect[2] += remainder;
      lastSpace.area = Math.round((lastSpace.rect[2] / UNITS_PER_METRE)
        * (lastSpace.rect[3] / UNITS_PER_METRE) * 10) / 10;
      lastSpace.capacity = ROOM_TYPES[lastSpace.useType].capacity(lastSpace.area);
    }
  }

  const mainUsableSpaces = spaces.filter((space) => space.sia === 'HNF');
  return {
    floor: {
      floorId, buildingId, key, label: floorDefinition.label, level: floorDefinition.level,
      areaGross: Math.round((length / UNITS_PER_METRE) * (height / UNITS_PER_METRE)),
      areaHnf: Math.round(mainUsableSpaces.reduce((sum, space) => sum + space.area, 0)),
      rooms: spaces.length,
      extent: [length, height],
    },
    spaces,
  };
}

/* --------------------------------------------------------------- Generate ---- */
const administrativeUnitsByBuilding = new Map();
for (const tenancy of TENANCY_SEEDS) {
  const units = administrativeUnitsByBuilding.get(tenancy.buildingId) || [];
  if (!units.includes(tenancy.administrativeUnitId)) units.push(tenancy.administrativeUnitId);
  administrativeUnitsByBuilding.set(tenancy.buildingId, units);
}

const floors = [], spaces = [], tenancies = [];
const builtFloorKeys = new Set();
const missingBuildings = [];

for (const tenancy of TENANCY_SEEDS) {
  const building = buildingsById.get(tenancy.buildingId);
  if (!building) { missingBuildings.push(tenancy.buildingId); continue; }
  const administrativeUnits = administrativeUnitsByBuilding.get(tenancy.buildingId);
  const chooseAdministrativeUnit = (random) => administrativeUnits[Math.floor(random() * administrativeUnits.length)];

  for (const key of tenancy.floors) {
    const floorKey = `${tenancy.buildingId}|${key}`;
    if (builtFloorKeys.has(floorKey)) continue;
    builtFloorKeys.add(floorKey);
    const { floor, spaces: floorSpaces } = buildFloor(tenancy.buildingId, key,
      Math.round(tenancy.mainUsableArea / tenancy.floors.length), chooseAdministrativeUnit);
    floors.push(floor);
    spaces.push(...floorSpaces);
  }

  const images = Array.isArray(building['bilder']) ? building['bilder'] : [];
  tenancies.push({
    tenancyId: tenancy.id,
    've': tenancy.administrativeUnitId,
    'veName': tenancy.administrativeUnitName,
    department: tenancy.department,
    buildingId: tenancy.buildingId,
    buildingName: building.bbl_bez || tenancy.buildingId,
    street: [building.adr_str, building.adr_hsnr].filter(Boolean).join(' ').trim(),
    zip: building.adr_plz || '', city: building.adr_ort || '', canton: building.adr_reg || '', 'land': building.adr_land || '',
    lat: building.wgs84_lat, lon: building.wgs84_lon,
    portfolioCategory: building.bbl_port || '—',
    photoSrc: (images[0] && images[0].src) || '',
    // Copy the complete, attributed image sequence so the tenant portal can
    // render the inventory-style mosaic, map and gallery without a runtime join.
    'bilder': images.map((image) => ({
      src: image.src, 'titel': image['titel'] || '', 'fotograf': image['fotograf'] || '',
      credit: image.credit || '', 'lizenz': image['lizenz'] || '',
      'quelle': 'https://www.bbl.admin.ch/de/mediendatenbank',
    })),
    floors: tenancy.floors.map((key) => `${tenancy.buildingId.replace(/\//g, '-')}-${key}`),
    floorLabels: tenancy.floors.map((key) => FLOOR_DEFINITIONS[key].label),
    areaHnf: tenancy.mainUsableArea,
    workstations: tenancy.workstations,
    leaseStart: tenancy.leaseStart, leaseEnd: tenancy.leaseEnd,
    yearlyCost: tenancy.yearlyCost, currency: 'CHF',
    costCentre: tenancy.costCentre,
    // Copy complete contact details so the generated dataset remains readable;
    // contactId is retained as the reverse reference.
    contacts: contacts.filter((contact) => ['pfm', 'campus'].includes(contact.contactId))
      .map((contact) => ({ contactId: contact.contactId,
        'rolle': contact.contactId === 'pfm' ? 'Portfoliomanagement' : 'Objektbetrieb',
        name: contact.name, email: contact.email, phone: contact.phone })),
  });
}

writeLines('data/tenancies.json', tenancies);
writeLines('data/floors.json', floors);
writeLines('data/spaces.json', spaces);

const countByUseType = {}, countBySia = {};
for (const space of spaces) {
  countByUseType[space.useType] = (countByUseType[space.useType] || 0) + 1;
  countBySia[space.sia] = (countBySia[space.sia] || 0) + 1;
}
console.log('Tenancies:', tenancies.length, '· Floors:', floors.length, '· Rooms:', spaces.length);
console.log('Buildings:', new Set(tenancies.map((tenancy) => tenancy.buildingId)).size,
  '· Administrative units:', new Set(tenancies.map((tenancy) => tenancy['ve'])).size);
console.log('SIA 416:', Object.entries(countBySia).map(([key, value]) => `${key} ${value}`).join(' · '));
console.log('Room types:', Object.entries(countByUseType).sort((a, b) => b[1] - a[1])
  .map(([key, value]) => `${key} ${value}`).join(' · '));
if (missingBuildings.length) console.log('MISSING buildings:', missingBuildings.join(', '));
