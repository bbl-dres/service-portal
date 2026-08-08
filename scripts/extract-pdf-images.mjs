// Extracts photographs from BBL building documentation PDFs.
//
//   node scripts/extract-pdf-images.mjs                 all PDFs in research/
//   node scripts/extract-pdf-images.mjs <file.pdf>      one PDF
//
// This is implemented directly instead of using pdfimages because only
// pdftotext is available from Poppler here. The photographs in these PDFs are
// JPEG streams (DCTDecode), so they can be cut directly from the bytes: a JPEG
// starts with FF D8 FF and ends with FF D9. Other encodings such as Flate and
// JPX are skipped; in this corpus they are logos and flat-colour graphics.
//
// Output: research/pdf-images/<pdf-name>/NNN_<width>x<height>.jpg, plus one
// index per run with the photographer from the imprint and the image list.
//
// RIGHTS: BBL publishes the building documentation, but credits individual
// photographers for the photographs in each imprint. The images are NOT
// freely licensed. Using them in an internal BBL prototype about BBL buildings
// is defensible when the credit remains attached. Publication would require
// permission from the respective copyright holders.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUT_DIR = ROOT + 'research/pdf-images/';
const MIN_BYTES = 40 * 1024; // Smaller files are logos, marks, or flat-colour graphics.
const MIN_EDGE = 500; // Edge length in image pixels.

// Read dimensions from the JPEG header (SOF0/1/2/etc.) so tiles and gradients
// can be rejected without decoding the file.
function readDimensions(buffer) {
  let offset = 2;
  while (offset < buffer.length - 9) {
    if (buffer[offset] !== 0xFF) { offset++; continue; }
    const marker = buffer[offset + 1];
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) break;
    offset += 2 + length;
  }
  return null;
}

// Cut every JPEG stream from the raw PDF bytes.
function extractJpegs(buffer) {
  const images = [];
  for (let offset = 0; offset < buffer.length - 3; offset++) {
    if (buffer[offset] !== 0xFF || buffer[offset + 1] !== 0xD8 || buffer[offset + 2] !== 0xFF) continue;
    // Find FF D9. Embedded EXIF thumbnails may contain an earlier marker, so
    // this locates the first plausible end of the current stream.
    let end = -1;
    for (let cursor = offset + 3; cursor < buffer.length - 1; cursor++) {
      if (buffer[cursor] === 0xFF && buffer[cursor + 1] === 0xD9) { end = cursor + 2; break; }
    }
    if (end < 0) break;
    const bytes = buffer.subarray(offset, end);
    if (bytes.length >= MIN_BYTES) {
      const dimensions = readDimensions(bytes);
      if (dimensions && dimensions.width >= MIN_EDGE && dimensions.height >= MIN_EDGE) {
        images.push({ bytes, ...dimensions });
      }
    }
    offset = end - 1;
  }
  return images;
}

// Read the photographer credit from the German data-sheet imprint.
function findPhotographer(pdf) {
  try {
    const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 32e6 });
    const match = text.match(/Fotografie[^\n]*\n?([^\n]*)/i) || text.match(/Fotos?\s*[:\s]([^\n]*)/i);
    return match ? match[0].replace(/\s+/g, ' ').replace(/^Fotografien?\s*/i, '').trim().slice(0, 90) : '';
  } catch {
    return '';
  }
}

const arguments_ = process.argv.slice(2);
const sources = [];
for (const directory of ['research/pdfs', 'research/pdfs-agent']) {
  if (!existsSync(ROOT + directory)) continue;
  for (const filename of readdirSync(ROOT + directory).filter((entry) => entry.toLowerCase().endsWith('.pdf'))) {
    sources.push(join(ROOT + directory, filename));
  }
}
const pdfs = arguments_.length ? arguments_ : sources;

mkdirSync(OUTPUT_DIR, { recursive: true });
const index = {};
let total = 0;

for (const pdf of pdfs) {
  const name = basename(pdf, '.pdf');
  let images = [];
  try {
    images = extractJpegs(readFileSync(pdf));
  } catch (error) {
    console.log(`  ! ${name}: ${error.message}`);
    continue;
  }
  if (!images.length) {
    console.log(`  - ${name.slice(0, 52).padEnd(54)} no usable photographs`);
    continue;
  }

  const directory = OUTPUT_DIR + name + '/';
  mkdirSync(directory, { recursive: true });
  // The title image is almost always the largest, so write it first.
  images.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  const files = [];
  images.slice(0, 12).forEach((image, imageIndex) => {
    const filename = `${String(imageIndex + 1).padStart(2, '0')}_${image.width}x${image.height}.jpg`;
    writeFileSync(directory + filename, image.bytes);
    files.push({ file: filename, width: image.width, height: image.height, kb: Math.round(image.bytes.length / 1024) });
  });
  index[name] = { pdf: basename(pdf), photographer: findPhotographer(pdf), images: files };
  total += files.length;
  console.log(`  ok ${name.slice(0, 52).padEnd(54)} ${String(files.length).padStart(2)} photos  (largest ${images[0].width}x${images[0].height})`);
}

writeFileSync(OUTPUT_DIR + 'INDEX.json', JSON.stringify(index, null, 1));
console.log(`\n${total} photos from ${Object.keys(index).length} data sheets -> research/pdf-images/`);
console.log('Index: research/pdf-images/INDEX.json');
