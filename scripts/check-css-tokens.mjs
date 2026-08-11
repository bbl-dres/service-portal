// Dependency-free guard for the portal's no-build CSS token contract.
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CSS_ROOT = resolve(ROOT, 'css');
const files = readdirSync(CSS_ROOT, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
  .map((entry) => resolve(entry.parentPath, entry.name));

const sources = files.map((file) => {
  const source = readFileSync(file, 'utf8');
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\r\n]/g, ' '));
  return { file, name: relative(ROOT, file).replaceAll('\\', '/'), source, clean };
});

const lineAt = (source, offset) => source.slice(0, offset).split('\n').length;
const issues = [];
const report = (entry, offset, message) => issues.push(`${entry.name}:${lineAt(entry.clean, offset)}: ${message}`);

const definitions = new Set();
for (const entry of sources) {
  for (const match of entry.clean.matchAll(/(--[\w-]+)\s*:/g)) definitions.add(match[1]);
}

for (const entry of sources) {
  for (const match of entry.clean.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
    const hasFallback = match[2] === ',';
    if (!definitions.has(match[1]) && !hasFallback) report(entry, match.index, `undefined token ${match[1]}`);
  }
}

const declarations = [];
for (const entry of sources) {
  const expression = /(^|[;{]\s*)([-\w]+)\s*:\s*([^;{}]+)(?=;|})/gm;
  for (const match of entry.clean.matchAll(expression)) {
    declarations.push({ entry, offset: match.index, property: match[2], value: match[3].trim() });
  }
}

const tokenFile = (entry) => entry.name === 'css/tokens.css';
/**
 * Sheets that are allowed to DEFINE colours in custom properties.
 *
 * `css/tokens.css` owns the design-system scale; the skins override the two CD ramps by
 * body class; and the floor-plan sheets own a domain palette (room-use groups, SIA area
 * types, module standards) that has no design-system equivalent and is mirrored value
 * for value in js/floorplan-editor/colors.js. Everywhere else, a colour hidden inside a
 * custom property is exactly what this gate exists to catch — it used to pass, because
 * `--*` declarations were skipped entirely.
 */
const paletteOwner = (entry) => tokenFile(entry)
  || entry.name.startsWith('css/skins/')
  || entry.name === 'css/apps/floorplan.css'
  || entry.name === 'css/apps/floorplan-editor.css';
const colorLiteral = /#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(/i;
const durationLiteral = /(?<![\w.-])(?:\d*\.\d+|\d+)(?:ms|s)\b/g;
const snappedLiteral = /(?<![\w.-])(?:\.2|\.35|\.45|\.5625|\.7|\.8|\.85|\.9|1\.05|1\.15)rem\b/;
const spacingProperty = /^(?:margin(?:-.+)?|padding(?:-.+)?|gap|row-gap|column-gap|inset(?:-.+)?|top|right|bottom|left|width|height|min-width|max-width|min-height|max-height|scroll-.+|text-underline-offset)$/;
const scaleLiteral = /(?<![\w.-])(?:\.125|\.25|\.375|\.5|\.625|\.75|\.875|1|1\.25|1\.5|1\.75|2|2\.25|2\.5|3|3\.5|4|5|6|7|8)rem\b/;

for (const item of declarations) {
  const { entry, offset, property, value } = item;
  if (tokenFile(entry)) continue;

  // Custom properties are checked too, outside css/tokens.css. Exempting them left the
  // gate blind to exactly what it exists to forbid: a raw palette declared as
  // `--fpe-something: #1c7d4d` passed, while the identical value on `color:` failed.
  const definesPalette = property.startsWith('--') && paletteOwner(entry);
  if (!definesPalette && !value.includes('data:image') && colorLiteral.test(value)) {
    report(entry, offset, property.startsWith('--')
      ? `${property} defines a hardcoded color; declare it in css/tokens.css`
      : `${property} contains a hardcoded color`);
  }
  colorLiteral.lastIndex = 0;

  const durations = [...value.matchAll(durationLiteral)].map((match) => match[0]);
  const invalidDurations = durations.filter((duration) => duration !== '0s' && !(duration === '.01ms' && entry.name === 'css/utilities.css'));
  if (invalidDurations.length) report(entry, offset, `${property} contains duration ${invalidDurations.join(', ')}`);

  // Same blind spot on layering: a private `--fpe-z-menu: 40` scale sat beside the
  // documented `--z-local-*` rungs and never had to justify itself.
  const layerProperty = property === 'z-index'
    || (property.startsWith('--') && /(?:^|-)z(?:-index)?(?:-|$)/.test(property.slice(2)));
  if (layerProperty
    && /^-?\d+$/.test(value)) report(entry, offset, `raw z-index ${value}`);
  if (property === 'border-radius' && /(?:px|rem)\b/.test(value)) report(entry, offset, `raw radius ${value}`);
  if (property === 'box-shadow' && value !== 'none' && /-?(?:\d*\.\d+|\d+)(?:px|rem)\b/.test(value)) {
    report(entry, offset, 'raw component-state shadow/elevation');
  }
  if (/^(?:border|border-.+|outline)$/.test(property) && /(?<![\d.])[1-4]px\b/.test(value)) {
    report(entry, offset, `${property} contains a raw stroke width`);
  }
  if (snappedLiteral.test(value)) report(entry, offset, `${property} reintroduces a snapped off-scale length`);
  snappedLiteral.lastIndex = 0;
  if (spacingProperty.test(property) && scaleLiteral.test(value)) {
    report(entry, offset, `${property} bypasses the CD spacing alias scale`);
  }
  scaleLiteral.lastIndex = 0;
}

const minWidths = new Set(['480', '640', '768', '1024', '1280', '1544', '1920']);
const maxWidths = new Set(['479.98', '639.98', '767.98', '1023.98', '1279.98', '1543.98', '1919.98']);
for (const entry of sources) {
  for (const media of entry.clean.matchAll(/@media\s*([^\{]+)/g)) {
    for (const width of media[1].matchAll(/(min|max)-width\s*:\s*([\d.]+)px/g)) {
      const allowed = (width[1] === 'min' ? minWidths : maxWidths).has(width[2]);
      const editorFitException = entry.name === 'css/apps/floorplan-editor.css' && width[1] === 'max' && width[2] === '1599.98';
      if (!allowed && !editorFitException) report(entry, media.index, `off-scale media breakpoint ${width[1]}-width:${width[2]}px`);
    }
  }
}

if (issues.length) {
  console.error(`CSS token check failed (${issues.length}):\n${issues.join('\n')}`);
  process.exit(1);
}

console.log(`CSS token check passed: ${files.length} files, ${definitions.size} defined custom properties.`);
