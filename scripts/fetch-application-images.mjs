// Downloads application-card images to assets/images/applications/, including
// the author and licence for every photograph.
//
//   node scripts/fetch-application-images.mjs
//
// A script keeps provenance reviewable: data/applications.json associates each
// image with its author, licence, and source page through raw field: `bild`,
// while this file records the source beside the generated asset.
//
// Existing photographs come from Pexels and these from Unsplash. Both licences
// permit commercial use without attribution. Each image was inspected; keyword
// search alone regularly returns the wrong subject.
//
// Target format: 1880x1253 (3:2), matching the existing assets. Cards render at
// up to about 640 px and the landing page at 800 px, leaving enough resolution
// for high-density screens without excessive files.

import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TARGET = ROOT + 'assets/images/applications/';
const W = 1880, H = 1253, Q = 72;

// Verified photographs by appId. `title` is the English Unsplash description
// used as landing-page alternative text.
const IMAGES = [
  { appId: 'i14y', photo: 'photo-1644088379091-d574269d422f',
    title: 'A blue background with lines and dots forming a connected network',
    photographer: 'Conny Schneider',
    source: 'https://unsplash.com/photos/a-blue-background-with-lines-and-dots-pREq0ns_p_E' },
  { appId: 'termdat', photo: 'photo-1451226428352-cf66bf8a0317',
    title: 'Close-up of a dictionary page in focus',
    photographer: 'Romain Vignes',
    source: 'https://unsplash.com/photos/focus-dictionary-index-page-ywqa9IZB-dU' },
  { appId: 'geoportal-bund', photo: 'photo-1730314737994-e50751608055',
    title: 'Detailed topographic map of a mountainous region',
    photographer: 'The New York Public Library',
    source: 'https://unsplash.com/photos/detailed-topographic-map-of-a-mountainous-region-UNu-lqX2FdQ' },
  { appId: 'geocat', photo: 'photo-1511721285502-9f81e79be874',
    title: 'Close-up photography of a wooden library card catalog',
    photographer: 'Erol Ahmed',
    source: 'https://unsplash.com/photos/close-up-photography-of-brown-wooden-card-catalog-Y3KEBQlB1Zk' },
  { appId: 'gwr', photo: 'photo-1508167290553-87a67eca5bf5',
    title: "Bird's eye view of assorted-colour roof tiles",
    photographer: 'Jack Price-Burns',
    source: 'https://unsplash.com/photos/birds-eye-view-of-assorted-color-roof-tiles-YVNlVJ8F_Ok' },
  { appId: 'bur', photo: 'photo-1540200049848-d9813ea0e120',
    title: 'View through the window of a business premises with customers inside',
    photographer: 'Andrew Leu',
    source: 'https://unsplash.com/photos/group-of-people-inside-cafe-_L3YMlqc9NA' },
  { appId: 'metadata-catalog', photo: 'photo-1762627105132-f6ed848a23bf',
    title: 'Rows of labelled white archive boxes on wooden shelves',
    photographer: 'Luke Caunt',
    source: 'https://unsplash.com/photos/rows-of-white-archive-boxes-on-wooden-shelves-5utYi64hnJ0' },
  { appId: 'simap', photo: 'photo-1562564055-71e051d33c19',
    title: 'Two people reviewing and signing documents at a table',
    photographer: 'Gabrielle Henderson',
    source: 'https://unsplash.com/photos/woman-signing-on-white-printer-paper-beside-woman-about-to-touch-the-documents-HJckKnwCXxQ' },
];

mkdirSync(TARGET, { recursive: true });

for (const image of IMAGES) {
  const file = TARGET + image.appId + '.jpg';
  try {
    statSync(file);
    console.log(`  skip ${image.appId}.jpg - already exists`);
    continue;
  } catch {
    // A missing target is expected and triggers the download.
  }
  const url = `https://images.unsplash.com/${image.photo}?auto=format&fit=crop&w=${W}&h=${H}&q=${Q}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'bbl-service-portal-prototype/1.0 (demo data, not public)' } });
  if (!response.ok) {
    console.error(`  failed ${image.appId} - HTTP ${response.status}`);
    continue;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(file, buffer);
  console.log(`  ok ${image.appId}.jpg - ${Math.round(buffer.length / 1024)} KB / ${image.photographer}`);
}
