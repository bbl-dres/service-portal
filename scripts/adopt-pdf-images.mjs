// Adopt photos from BBL building sheets into the portal image collection.
//
//   node scripts/adopt-pdf-images.mjs --check
//   node scripts/adopt-pdf-images.mjs
//
// Select the largest landscape photo per building. Sheets normally place floor
// plans and sections in portrait while exterior photos are landscape; this
// avoids choosing a plan as the building-card image.
//
// The images are selected mechanically, not reviewed by a person. Inspect them
// before a demonstration; research/pdf-images contains all candidates.
//
// RIGHTS: BBL publishes the sheets, but their attributed photos are not freely
// licensed. Attribution travels with each image; public reuse requires the
// copyright holder's permission.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Keep the former German flag as a quoted compatibility value.
const checkOnly = process.argv.includes('--check') || process.argv.includes('--pruefen');
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SOURCE_DIR = ROOT + 'research/pdf-images/';
const TARGET_DIR = 'assets/images/buildings/';
const manifest = JSON.parse(readFileSync(SOURCE_DIR + 'INDEX.json', 'utf8'));

// Map each bbl_id to the source directory named after its building sheet.
const SOURCE_MAPPING = {
  '1080/4100/AC': '2015_liestal_zollschule',
  '1080/6100/AA': 'p045_Landesmuseum_Erweiterung',
  '1080/6210/AA': 'p124_BrigGlis_Zollanlage',
  '1080/6320/AA': 'p112_Arbon_Bootshaus',
  '1080/6430/AA': 'p099_NB_Tiefmagazin',
  '1080/6540/AA': 'p023_Zollikofen_Eichenweg5',
  '1080/6650/AA': 'p025_Liebefeld_Schwarzenburg157',
  '1080/6760/AA': 'p108_Magglingen_Laerchenplatz',
  '1080/6870/AA': 'p132_Wabern_swisstopo',
  '1080/6980/AA': 'p019_Bundesverwaltungsgericht',
  // Buildings with a reviewed Commons image remain untouched because Commons
  // is freely licensed while the building-sheet photography is not.
};

const media = JSON.parse(readFileSync(ROOT + 'data/media.json', 'utf8'));
const report = [];
let adoptedCount = 0;

for (const [bblId, folder] of Object.entries(SOURCE_MAPPING)) {
  const entry = manifest[folder];
  const images = entry?.images || entry?.['bilder'];
  if (!Array.isArray(images) || !images.length) {
    report.push(`  – ${bblId}  ${folder}: no photos`);
    continue;
  }

  // Prefer landscape images by area. Panoramas wider than 3:1 are normally
  // sections or full-page strips. Cap dimensions at 6000px because one source
  // image expands beyond 1 GB in browser memory despite its compressed size.
  const dimensions = (image) => ({
    width: image.width ?? image.w,
    height: image.height ?? image.h,
    file: image.file ?? image['datei'],
  });
  const candidates = images
    .map((image) => ({ ...image, ...dimensions(image) }))
    .filter((image) => image.width > image.height && image.width / image.height < 3
      && image.width >= 700 && image.width <= 6000 && image.height <= 6000)
    .sort((a, b) => (b.width * b.height) - (a.width * a.height));
  const choice = candidates[0];
  if (!choice) { report.push(`  – ${bblId}  ${folder}: no landscape image`); continue; }

  // The first media favourite is the primary image; its slug keeps naming
  // consistent with the existing collection.
  const primary = media.find((item) => item.buildingId === bblId);
  if (!primary) { report.push(`  ! ${bblId}: media record not found`); continue; }

  const targetName = `${primary.slug}.jpg`;
  if (!checkOnly) copyFileSync(SOURCE_DIR + folder + '/' + choice.file, ROOT + TARGET_DIR + targetName);

  primary.file = TARGET_DIR + targetName;
  const photographer = entry.photographer || entry['fotograf'];
  primary.photographer = photographer || 'BBL-Bautendokumentation';
  primary.copyright = `${photographer || 'Fotograf nicht genannt'} — aus der Bautendokumentation des BBL`;
  primary.license = 'BBL-Bautendokumentation, nicht frei lizenziert';
  primary.sourceUrl = primary.sourceUrl || null;
  primary.isPlaceholder = false;
  primary.photo = '';
  primary.reviewNeeded = true;
  adoptedCount++;
  report.push(`  ✓ ${bblId}  ${String(choice.width + '×' + choice.height).padEnd(11)} ${choice.kb} KB  ← ${folder}/${choice.file}`
    + `\n      ${targetName}`);
}

console.log(report.join('\n'));
const realImageCount = media.filter((item) => item.file).length;
console.log(`\n${adoptedCount} photos adopted · ${realImageCount} of ${media.length} media records now have a real image`);

if (checkOnly) console.log('\n(--check: no files written)');
else {
  writeFileSync(ROOT + 'data/media.json', JSON.stringify(media, null, 1));
  console.log('→ updated data/media.json');
}
