// Links downloaded photographs to building records.
//
//   node scripts/link-building-images.mjs           # Dry run (default)
//   node scripts/link-building-images.mjs --write   # Update the GeoJSON
//
// Sets per building:
//   img_local   path to the real photograph, or null
//   img_credit  required CC BY/CC BY-SA author and licence attribution, or an
//               honest explanation of why a placeholder is shown
//
// The script also restores img_url to an Unsplash identifier. The historical
// apply-research-data.mjs script put a Commons URL there, but core.js extracts
// an Unsplash `photo-<id>` token from img_url. Commons metadata belongs in
// img_local/img_credit instead.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const flags = process.argv.slice(2);
const unknownFlags = flags.filter((flag) => flag !== '--write');
if (unknownFlags.length) throw new Error(`Unknown option: ${unknownFlags.join(', ')}`);
const write = flags.includes('--write');

const ROOT = fileURLToPath(new URL('../', import.meta.url));
if (!write) {
  console.log('Dry run: data/buildings.geojson was not read or written.');
  console.log('Use --write to reapply the historical mapping from IMAGE-CREDITS.json.');
  process.exit(0);
}

const credits = JSON.parse(readFileSync(ROOT + 'assets/images/buildings/IMAGE-CREDITS.json', 'utf8'));

// Placeholder by raw German usage category. Previously every new object shared
// one image, which made the gallery look like a repeated photograph.
const PLACEHOLDER_BY_USAGE = {
  Verwaltung: '1486406146926-c627a92ad1ab',
  Zoll: '1449157291145-7efd050a4d0e',
  // Every identifier was checked against images.unsplash.com. One fabricated
  // identifier returned 404 and would have silently fallen back to flat colour.
  Ausbildung: '1564501049412-61c2a3083791',
  Sport: '1461896836934-ffe607ba8211',
  Kultur: '1503152394-c571994fd383',
  Bildung: '1568667256549-094345857637',
  Lager: '1553413077-190dd305871c',
  Justiz: '1589829545856-d10d557cf95f',
  Infrastruktur: '1558494949-ef010cbdcc31',
  Produktion: '1581092160562-40aa08e78837',
  Wohnen: '1502005229762-cf1b2da7c5d6',
};

const bg = JSON.parse(readFileSync(ROOT + 'data/buildings.geojson', 'utf8'));
let verifiedCount = 0;
let placeholderCount = 0;

for (const feature of bg.features) {
  const properties = feature.properties;
  const image = credits.images[properties.bbl_id];

  if (image && existsSync(ROOT + image.file)) {
    properties.img_local = image.file;
    properties.img_credit = `${image.author} · ${image.license} · Wikimedia Commons`;
    properties.img_quelle = image.commons;
    verifiedCount++;
  } else {
    properties.img_local = null;
    properties.img_quelle = null;
    const reason = credits.missingImages[properties.bbl_id];
    properties.img_credit = 'Platzhalterbild (Unsplash) — keine frei nutzbare Aufnahme dieses Objekts'
      + (reason ? `: ${String(reason).replace(/^[^—]*—\s*/, '')}` : '.');
    placeholderCount++;
  }

  // img_url remains the Unsplash fallback. Select by the raw usage category so
  // every card does not show the same photograph.
  const id = PLACEHOLDER_BY_USAGE[properties.bbl_gbda1] || PLACEHOLDER_BY_USAGE.Verwaltung;
  properties.img_url = [`https://images.unsplash.com/photo-${id}?w=800&h=600&fit=crop`];
}

writeFileSync(ROOT + 'data/buildings.geojson', JSON.stringify(bg, null, 1));
console.log('Wrote data/buildings.geojson.');
console.log(`${verifiedCount} objects with a verified photograph; ${placeholderCount} with a placeholder`);
for (const feature of bg.features) {
  const properties = feature.properties;
  console.log(`  ${properties.img_local ? 'photo' : '     '} ${properties.bbl_id.padEnd(14)} ${properties.bbl_bez.slice(0, 44).padEnd(46)} ${properties.img_local ? properties.img_credit : '(' + properties.bbl_gbda1 + ')'}`);
}
