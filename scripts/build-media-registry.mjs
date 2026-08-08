// Rebuilds data/media.json as the single image registry. The building, parcel,
// and project records retain only a curated list of mediaId references.
//
//   node scripts/build-media-registry.mjs           # Dry run (default)
//   node scripts/build-media-registry.mjs --write   # Rename and write files
//
// This was introduced after demo records were mapped to real buildings and old
// media titles no longer matched their owners. Generating the registry from the
// objects keeps those relationships aligned.
//
// Filenames are descriptive: <bbl-id>_<object-slug>_<content>.jpg.
//
// VERIFIED vs PLACEHOLDER: `file` names a reviewed local photograph with author
// and licence. Otherwise it is null and `photo` contains an Unsplash identifier
// that the portal explicitly labels as a placeholder.

import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const flags = process.argv.slice(2);
const unknownFlags = flags.filter((flag) => !['--check', '--pruefen', '--write'].includes(flag));
if (unknownFlags.length) throw new Error(`Unknown option: ${unknownFlags.join(', ')}`);
if ((flags.includes('--check') || flags.includes('--pruefen')) && flags.includes('--write')) {
  throw new Error('--check and --write cannot be combined.');
}
const write = flags.includes('--write');
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const IMAGE_DIR = 'assets/images/buildings/';
const readJson = (file) => JSON.parse(readFileSync(ROOT + file, 'utf8'));

const slug = (s) => String(s).toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 46);
const idSlug = (id) => String(id).replace(/\//g, '-');

// Verified photographs: legacy filename, proven content, and rights. `content`
// describes only what the Commons title establishes; no details are invented.
const VERIFIED = {
  '1000/4840/AF': { previousFile: '1000-4840-AF.jpg', content: 'exterior', year: '2019',
    author: 'Arkhein Drakenov', license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Bundeshaus_West_(2019-06-23).jpg' },
  '1000/3120/AB': { previousFile: '1000-3120-AB.jpg', content: 'aerial-view', year: '2022',
    author: 'Schweizerisches Nationalmuseum', license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Sammlungszentrum_Affoltern_am_Albis._Drohnenaufnahme.jpg' },
  '1000/5210/AA': { previousFile: '1000-5210-AA.jpg', content: 'exterior', year: '2022',
    author: 'Lukas Beck', license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Schweizerische_Botschaft_in_Berlin.jpg' },
  '1000/5410/AA': { previousFile: '1000-5410-AA.jpg', content: 'exterior', year: '2020',
    author: 'Syced', license: 'CC0 1.0 (gemeinfrei)',
    source: 'https://commons.wikimedia.org/wiki/File:Embassy_of_Switzerland,_Tokyo.jpg' },
  '1000/5620/AA': { previousFile: '1000-5620-AA.jpg', content: 'exterior', year: '2015',
    author: 'Nomisztif', license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Embassy_of_Switzerland_in_Canberra.jpg' },
};

// Placeholder by raw German usage-category value. Each Unsplash identifier was
// checked; one fabricated value returned 404 and would have failed silently.
const PLACEHOLDER_BY_USAGE = {
  'Verwaltung': '1486406146926-c627a92ad1ab', 'Zoll': '1449157291145-7efd050a4d0e',
  'Ausbildung': '1564501049412-61c2a3083791', 'Sport': '1461896836934-ffe607ba8211',
  'Kultur': '1503152394-c571994fd383', 'Bildung': '1568667256549-094345857637',
  'Lager': '1553413077-190dd305871c', 'Justiz': '1589829545856-d10d557cf95f',
  'Infrastruktur': '1558494949-ef010cbdcc31', 'Produktion': '1581092160562-40aa08e78837',
  'Wohnen': '1502005229762-cf1b2da7c5d6', 'Grundstueck': '1500382017468-9049fed747ef',
};

const buildings = readJson('data/buildings.geojson');
const parcels = readJson('data/parcels.geojson');
const projects = readJson('data/projects.json');

const media = [];
const renames = [];
let sequence = 0;
const nextMediaId = () => 'MED-' + String(++sequence).padStart(3, '0');

const CONTENT_LABELS = {
  exterior: 'aussenansicht',
  'aerial-view': 'drohnenaufnahme',
  surroundings: 'umgebung',
  interior: 'innenansicht',
  'facade-detail': 'fassadendetail',
  entrance: 'eingangsbereich',
  'site-plan': 'lageplan',
  'historic-view': 'historische aufnahme',
  'parcel-aerial': 'luftbild',
  'construction-site': 'baustelle',
};

function createEntry({ objectId, objectName, kind, content, verified, lat, lon, type = 'photo', period = 'aktuell', date, category }) {
  const name = `${idSlug(objectId)}_${slug(objectName)}_${content}`;
  const id = nextMediaId();
  const file = verified ? `${IMAGE_DIR}${name}.jpg` : null;
  if (verified) renames.push([IMAGE_DIR + verified.previousFile, `${IMAGE_DIR}${name}.jpg`]);
  return {
    mediaId: id,
    mediaType: type,
    title: `${objectName} — ${CONTENT_LABELS[content] || content.replace(/-/g, ' ')}`,
    slug: name,
    buildingId: kind === 'building' ? objectId : null,
    parcelId: kind === 'parcel' ? objectId : null,
    projectId: kind === 'project' ? objectId : null,
    date: date || (verified ? verified.year : '2025'),
    historicPeriod: period,
    photographer: verified ? verified.author : 'Platzhalter (Unsplash)',
    copyright: verified ? `${verified.author} · ${verified.license}` : 'Unsplash-Lizenz — Platzhalterbild, zeigt nicht das reale Objekt',
    license: verified ? verified.license : 'Unsplash',
    sourceUrl: verified ? verified.source : null,
    isPlaceholder: !verified,
    accessLevel: 'öffentlich',
    color: '#2f4356',
    url: '#',
    file,
    photo: verified ? '' : (PLACEHOLDER_BY_USAGE[category] || PLACEHOLDER_BY_USAGE['Verwaltung']),
    lat: lat ?? null, lon: lon ?? null,
  };
}

// Buildings.
for (const feature of buildings.features) {
  const properties = feature.properties;
  const verified = VERIFIED[properties.bbl_id];
  const favourites = [];
  const base = {
    objectId: properties.bbl_id,
    objectName: properties.bbl_bez,
    kind: 'building',
    lat: properties.wgs84_lat,
    lon: properties.wgs84_lon,
    category: properties.bbl_gbda1,
  };

  const primary = createEntry({ ...base, content: verified ? verified.content : 'exterior', verified });
  media.push(primary);
  favourites.push(primary.mediaId);

  // The detail mosaic needs a primary tile and at least five secondary entries
  // to expose the German UI's show-all action. Production objects have dozens.
  for (const content of ['surroundings', 'interior', 'facade-detail', 'entrance', 'site-plan']) {
    const entry = createEntry({ ...base, content, verified: null });
    media.push(entry);
    favourites.push(entry.mediaId);
  }

  // Add a historical photograph placeholder only for sufficiently old objects.
  if (properties.bbl_bjahr && properties.bbl_bjahr < 1960) {
    const historical = createEntry({
      ...base,
      content: 'historic-view',
      verified: null,
      period: 'historisch',
      date: String(properties.bbl_bjahr + 10),
    });
    media.push(historical);
    favourites.push(historical.mediaId);
  }

  properties.media = favourites; // The complete registry lives in media.json.
  delete properties.img_url;
  delete properties.img_local;
  delete properties.img_credit;
  delete properties.img_quelle;
}

// Parcels.
for (const feature of parcels.features) {
  const properties = feature.properties;
  const base = {
    objectId: properties.bbl_id,
    objectName: properties.bbl_bez,
    kind: 'parcel',
    lat: properties.wgs84_lat,
    lon: properties.wgs84_lon,
    category: 'Grundstueck',
  };
  const aerial = createEntry({ ...base, content: 'parcel-aerial', verified: null });
  media.push(aerial);
  properties.media = [aerial.mediaId];
}

// Construction projects.
for (const project of projects) {
  const name = project.name || project.projectId;
  const building = buildings.features.find((feature) => feature.properties.bbl_id === project.buildingId);
  const buildingProperties = building ? building.properties : {};
  const base = {
    objectId: project.projectId,
    objectName: name,
    kind: 'project',
    lat: buildingProperties.wgs84_lat ?? null,
    lon: buildingProperties.wgs84_lon ?? null,
    category: 'Verwaltung',
  };
  const construction = createEntry({ ...base, content: 'construction-site', verified: null });
  media.push(construction);
  project.media = [construction.mediaId];
}

console.log(`Registry: ${media.length} media entries`);
console.log(`  verified:    ${media.filter((entry) => entry.file).length}`);
console.log(`  placeholder: ${media.filter((entry) => entry.isPlaceholder).length}`);
console.log(`Favourites: ${buildings.features.length} buildings / ${parcels.features.length} parcels / ${projects.length} projects`);
console.log('\nExamples:');
for (const entry of media.filter((item) => item.file)) console.log(`  ${entry.mediaId}  ${entry.slug}.jpg`);
for (const entry of media.filter((item) => !item.file).slice(0, 3)) console.log(`  ${entry.mediaId}  ${entry.slug}  (placeholder)`);

if (!write) {
  console.log('\nDry run: nothing written; use --write explicitly to apply changes.');
  process.exit(0);
}

for (const [source, target] of renames) {
  if (existsSync(ROOT + source) && source !== target) renameSync(ROOT + source, ROOT + target);
}
writeFileSync(ROOT + 'data/media.json', JSON.stringify(media, null, 1));
writeFileSync(ROOT + 'data/buildings.geojson', JSON.stringify(buildings, null, 1));
writeFileSync(ROOT + 'data/parcels.geojson', JSON.stringify(parcels, null, 1));
writeFileSync(ROOT + 'data/projects.json', JSON.stringify(projects, null, 1));
console.log('\nWrote media.json, buildings.geojson, parcels.geojson, and projects.json.');
