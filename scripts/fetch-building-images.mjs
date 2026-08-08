// Downloads verified, freely usable building photographs to
// assets/images/buildings/, including author and licence metadata.
//
//   node scripts/fetch-building-images.mjs           # Dry run (default)
//   node scripts/fetch-building-images.mjs --write   # Download and write
//
// The script does not discover files through the Commons API. That API applies
// aggressive rate limiting, and keyword searches returned the wrong subjects.
// Every entry below was reviewed individually during research and points
// directly to upload.wikimedia.org.
//
// When no verified photograph exists, the object keeps its placeholder and the
// image-credit manifest records why.

import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const flags = process.argv.slice(2);
const unknownFlags = flags.filter((flag) => flag !== '--write');
if (unknownFlags.length) throw new Error(`Unknown option: ${unknownFlags.join(', ')}`);
const write = flags.includes('--write');

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TARGET = ROOT + 'assets/images/buildings/';
const UA = 'bbl-service-portal-prototype/1.0 (demo data, not public)';

// Verified photographs: each one demonstrably shows the named object.
const IMAGES = [
  { id: '1000/4840/AF', object: 'Bundeshaus West',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/76/Bundeshaus_West_%282019-06-23%29.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Bundeshaus_West_(2019-06-23).jpg',
    author: 'Arkhein Drakenov', license: 'CC BY-SA 4.0' },
  { id: '1000/3120/AB', object: 'Sammlungszentrum Schweizerisches Nationalmuseum',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Sammlungszentrum_Affoltern_am_Albis._Drohnenaufnahme.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Sammlungszentrum_Affoltern_am_Albis._Drohnenaufnahme.jpg',
    author: 'Schweizerisches Nationalmuseum', license: 'CC BY-SA 4.0' },
  { id: '1000/5210/AA', object: 'Schweizerische Botschaft Berlin',
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Schweizerische_Botschaft_in_Berlin.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Schweizerische_Botschaft_in_Berlin.jpg',
    author: 'Lukas Beck', license: 'CC BY-SA 4.0' },
  { id: '1000/5410/AA', object: 'Schweizerische Botschaft Tokio',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Embassy_of_Switzerland%2C_Tokyo.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Embassy_of_Switzerland,_Tokyo.jpg',
    author: 'Syced', license: 'CC0 1.0 (gemeinfrei)' },
  { id: '1000/5620/AA', object: 'Schweizerische Botschaft Canberra',
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Embassy_of_Switzerland_in_Canberra.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Embassy_of_Switzerland_in_Canberra.jpg',
    author: 'Nomisztif', license: 'CC BY-SA 4.0' },
  // Washington is not a separate inventory object (the US entry is the New
  // York consulate). The verified photograph is retained for the media library.
  { id: 'washington', object: 'Schweizerische Botschaft Washington',
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Embassy_of_Switzerland%2C_Washington%2C_D.C..jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Embassy_of_Switzerland,_Washington,_D.C..jpg',
    author: 'Aaron Siirila', license: 'CC BY-SA 2.5' },
];

// Objects without a verified photograph, including the reason. These strings
// become German UI credit text and therefore remain German.
const MISSING_IMAGE = {
  '1000/4100/AC': 'Campus BAZG Liestal — keine Aufnahme auf Commons; die Suche liefert die Kasinostrasse-Brücke, nicht das Gebäude.',
  '1000/2800/AD': 'Dienstwohnungen Effingerstrasse 29 — die einzige Commons-Datei an der Adresse ist eine Strassenszene, das Gebäude ist nicht sicher das Motiv.',
  '1000/1950/AE': 'RZ CAMPUS Frauenfeld — keine Aufnahme; das Rechenzentrum liegt auf einem Waffenplatz.',
  '1000/4850/AG': 'Verwaltungszentrum Guisanplatz — auf Commons existiert nur das ehemalige Kriegsmaterialmagazin von 1893 auf derselben Parzelle, nicht der Neubau.',
  '1000/5320/AA': 'Generalkonsulat New York — Mietfläche im Hochhaus 633 Third Avenue, kein eigenes Gebäude des Bundes.',
  '1000/5510/AA': 'Botschaft Brasília — keine Aufnahme auf Commons; Wikidata verweist irrtümlich auf ein Bild aus Nova Friburgo.',
  '1000/6100/AA': 'Landesmuseum Zürich — Aufnahmen vorhanden, aber noch nicht einzeln geprüft (Commons-API zurzeit gedrosselt).',
  '1000/6210/AA': 'Zollanlage Brig-Glis — keine geprüfte Aufnahme.',
  '1000/6320/AA': 'Bootshaus Arbon — keine geprüfte Aufnahme.',
  '1000/6430/AA': 'Nationalbibliothek, Tiefmagazin West — der Bau liegt unterirdisch; oberirdisch ist nur der gläserne Verbindungsbau sichtbar.',
  '1000/6540/AA': 'Eichenweg 5 Zollikofen — Neubau 2023, keine Aufnahme auf Commons.',
  '1000/6650/AA': 'Verwaltungsgebäude Liebefeld — keine geprüfte Aufnahme.',
  '1000/6760/AA': 'EHSM Magglingen Lärchenplatz — Neubau 2023, keine Aufnahme auf Commons.',
  '1000/6870/AA': 'swisstopo Wabern — keine geprüfte Aufnahme.',
  '1000/6980/AA': 'Bundesverwaltungsgericht Schwarztorstrasse — keine geprüfte Aufnahme.',
  '1000/7090/AA': 'Bundeshaus Nord — keine geprüfte Aufnahme; die meisten Bilder zeigen das Bundeshaus Mitte.',
};

if (!write) {
  console.log('Dry run: no downloads and no files written.');
  console.log(`With --write, ${IMAGES.length} verified photographs would be downloaded to ${TARGET}`);
  console.log('and IMAGE-CREDITS.json would be rewritten there.');
  process.exit(0);
}

const filenameFor = (id) => id.replace(/\//g, '-') + '.jpg';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Convert an original URL to a fixed-width thumbnail. Wikimedia supports only
// selected widths for these files; 1280 px works consistently.
function thumbnailUrl(url, width = 1280) {
  const m = url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/(.+)$/);
  if (!m) return url;
  return `${m[1]}/thumb/${m[2]}/${m[3]}/${m[4]}/${width}px-${m[4]}`;
}

// Wikimedia rate-limits after a few requests, so retry with backoff.
async function download(url, attempt = 0) {
  if (attempt) await sleep(8000 * attempt);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (res.status === 429 && attempt < 4) return download(url, attempt + 1);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

mkdirSync(TARGET, { recursive: true });
const manifest = {
  note: 'Image credits. CC BY and CC BY-SA require attribution; author and licence are recorded here and on each portal object.',
  images: {}, missingImages: MISSING_IMAGE,
};

for (const image of IMAGES) {
  const target = TARGET + filenameFor(image.id);
  try {
    await sleep(2500);
    writeFileSync(target, await download(thumbnailUrl(image.url, 1280)));
    const kb = Math.round(statSync(target).size / 1024);
    manifest.images[image.id] = {
      file: `assets/images/buildings/${filenameFor(image.id)}`, object: image.object,
      author: image.author, license: image.license, commons: image.page, kb,
    };
    console.log(`  ok ${filenameFor(image.id).padEnd(22)} ${String(kb).padStart(6)} KB  ${image.author} / ${image.license}`);
  } catch (error) {
    console.log(`  failed ${image.object}: ${error.message}`);
  }
}

writeFileSync(TARGET + 'IMAGE-CREDITS.json', JSON.stringify(manifest, null, 1));
console.log(`\n${Object.keys(manifest.images).length} verified photographs; ${Object.keys(MISSING_IMAGE).length} objects without one`);
console.log('Credits: assets/images/buildings/IMAGE-CREDITS.json');
