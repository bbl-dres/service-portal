// Dependency-free verifier/concatenator for the CSS layer split.
//
//   node scripts/css-bundle.mjs
//   node scripts/css-bundle.mjs --output=.tmp/app.concat.css
//   node scripts/css-bundle.mjs --verify-legacy
//
// `--split-legacy` is intentionally narrow: it only accepts the audited legacy
// app.css hash and writes the contiguous byte ranges below. It exists so the
// pure-move commit is reproducible. `--verify-legacy` is the Step-1 equivalence
// gate; the default command concatenates the current, intentionally refactored
// cascade and reports its digest.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

export const LEGACY_APP_CSS = Object.freeze({
  bytes: 348434,
  sha256: '3558fec8a0ef7d7db7321b772ca0beebb5c71ba0476d70c5226a1d8e3c2f6bbd',
});

// These ranges are contiguous and exhaustive. Their order is the old app.css
// cascade order, including temporary bridge files needed by relative url().
export const CSS_SOURCE_ORDER = Object.freeze([
  { file: 'css/font-face.css', lines: [1, 40] },
  { file: 'css/foundations/reset.css', lines: [41, 64] },
  { file: 'css/foundations/typography.css', lines: [65, 114] },
  { file: 'css/foundations/elements.css', lines: [115, 209] },
  { file: 'css/layouts/page.css', lines: [210, 475] },
  { file: 'css/layouts/grid.css', lines: [476, 535] },
  { file: 'css/navigations/header.css', lines: [536, 826] },
  { file: 'css/navigations/drawer.css', lines: [827, 1130] },
  { file: 'css/layouts/shell.css', lines: [1131, 1296] },
  { file: 'css/components/button.css', lines: [1297, 1399] },
  { file: 'css/components/card.css', lines: [1400, 1595] },
  { file: 'css/table-form.css', lines: [1596, 1897] },
  { file: 'css/components/feedback.css', lines: [1898, 2098] },
  { file: 'css/navigations/tabs.css', lines: [2099, 2141] },
  { file: 'css/components/content.css', lines: [2142, 2299] },
  { file: 'css/sections/search.css', lines: [2300, 2384] },
  { file: 'css/apps/dataportal.css', lines: [2385, 2645], lazy: true },
  { file: 'css/sections/catalogue.css', lines: [2646, 2941] },
  { file: 'css/components/overlay.css', lines: [2942, 3080] },
  { file: 'css/apps/portfolio.css', lines: [3081, 3382], lazy: true },
  { file: 'css/utilities.css', lines: [3383, 3690] },
  { file: 'css/apps/archive.css', lines: [3691, 3841], lazy: true },
  { file: 'css/apps/floorplan.css', lines: [3842, 4032], lazy: true },
  { file: 'css/apps/workplace.css', lines: [4033, 4060], lazy: true },
  { file: 'css/apps/floorplan-editor.css', lines: [4061, 4603], lazy: true },
  { file: 'css/apps/room-booking.css', lines: [4604, Infinity], lazy: true },
]);

const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');

function concatenate() {
  const missing = CSS_SOURCE_ORDER
    .map(({ file }) => file)
    .filter((file) => !existsSync(resolve(ROOT, file)));
  if (missing.length) throw new Error(`Missing CSS layer(s): ${missing.join(', ')}`);
  return Buffer.concat(CSS_SOURCE_ORDER.map(({ file }) => readFileSync(resolve(ROOT, file))));
}

function splitLegacy() {
  const sourcePath = resolve(ROOT, 'css/app.css');
  const source = readFileSync(sourcePath);
  if (source.length !== LEGACY_APP_CSS.bytes || digest(source) !== LEGACY_APP_CSS.sha256) {
    throw new Error('Refusing to split: css/app.css is not the audited legacy source.');
  }

  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === 10) lineStarts.push(i + 1);
  const offset = (line) => Number.isFinite(line) ? (lineStarts[line - 1] ?? source.length) : source.length;

  for (const { file, lines: [first, last] } of CSS_SOURCE_ORDER) {
    const target = resolve(ROOT, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source.subarray(offset(first), offset(last + 1)));
  }

  const rebuilt = concatenate();
  if (!rebuilt.equals(source)) throw new Error('Split output does not reconstruct app.css byte-for-byte.');
  console.log(`Split ${source.length} bytes into ${CSS_SOURCE_ORDER.length} ordered stylesheets.`);
}

const split = process.argv.includes('--split-legacy');
const verifyLegacy = process.argv.includes('--verify-legacy');
const outputArg = process.argv.find((arg) => arg.startsWith('--output='));

if (split) splitLegacy();

const result = concatenate();
const resultHash = digest(result);
const isLegacyExact = result.length === LEGACY_APP_CSS.bytes && resultHash === LEGACY_APP_CSS.sha256;
if (verifyLegacy && !isLegacyExact) {
  throw new Error(`CSS concatenation differs: ${result.length} bytes, sha256 ${resultHash}`);
}

if (outputArg) {
  const output = resolve(ROOT, outputArg.slice('--output='.length));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, result);
  console.log(`Wrote current ordered cascade to ${output}`);
} else {
  console.log(`CSS cascade: ${result.length} bytes, sha256 ${resultHash}${isLegacyExact ? ' (legacy exact)' : ''}`);
}
