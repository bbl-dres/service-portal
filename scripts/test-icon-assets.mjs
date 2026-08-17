import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { icon } from '../js/ui/components/primitives.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ICON_DIR = join(ROOT, 'assets', 'icons', 'lucide');
const LEGACY_DIR = join(ROOT, 'assets', 'icons', 'tree');
const VENDOR_DIR = join(ROOT, 'js', 'vendor') + sep;
const MANIFEST_FILE = join(ICON_DIR, 'manifest.json');
const LICENSE_FILE = join(ICON_DIR, 'LICENSE.txt');

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};
const same = (actual, expected) => actual.length === expected.length
  && actual.every((value, index) => value === expected[index]);
const hash = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

function filesBelow(directory, keep) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...filesBelow(path, keep));
    else if (keep(path)) found.push(path);
  }
  return found;
}

function svgProblems(svg) {
  const problems = [];
  if (svg.charCodeAt(0) === 0xfeff) problems.push('BOM');
  if (!svg.endsWith('</svg>\n')) problems.push('non-canonical ending');
  if (/<\?|<!DOCTYPE|<!ENTITY/i.test(svg)) problems.push('processing instruction/DTD/entity');
  if (/<\/?(?:script|style|foreignObject|image|use|a)\b/i.test(svg)) problems.push('active element');
  if (/\b(?:href|src|style)\s*=|\bon[a-z]+\s*=/i.test(svg)) problems.push('active attribute');
  const withoutNamespace = svg.replace('xmlns="http://www.w3.org/2000/svg"', '');
  if (/\b(?:https?:|javascript:|data:)|url\s*\(/i.test(withoutNamespace)) problems.push('external reference');

  const expected = new Map([
    ['xmlns', 'http://www.w3.org/2000/svg'], ['width', '24'], ['height', '24'],
    ['viewBox', '0 0 24 24'], ['fill', 'none'], ['stroke', 'currentColor'],
    ['stroke-width', '2'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'],
  ]);
  const root = svg.match(/^<svg\b([^>]*)>/s);
  if (!root) return [...problems, 'missing root'];
  const attributes = [...root[1].matchAll(/([\w:-]+)="([^"]*)"/g)];
  if (root[1].replace(/\s+[\w:-]+="[^"]*"/g, '').trim()) problems.push('root syntax');
  if (attributes.length !== expected.size) problems.push('root attribute count');
  const seen = new Set();
  for (const [, name, value] of attributes) {
    if (seen.has(name) || expected.get(name) !== value) problems.push(`root attribute ${name}`);
    seen.add(name);
  }
  for (const name of expected.keys()) if (!seen.has(name)) problems.push(`missing ${name}`);

  const safeTags = new Set(['svg', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect']);
  const tags = [...svg.matchAll(/<\/?([A-Za-z][\w:-]*)\b/g)].map((match) => match[1]);
  const unsupported = tags.filter((tag) => !safeTags.has(tag));
  if (unsupported.length) problems.push(`element ${unsupported.join(',')}`);
  if (svg.replace(/<[^>]+>/g, '').trim()) problems.push('text content');
  return [...new Set(problems)];
}

console.log('■ Manifest and provenance');
const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
const declared = manifest.icons.map((entry) => entry.name);
check(manifest.version === '1.31.0'
  && manifest.source === 'https://cdn.jsdelivr.net/npm/lucide-static@1.31.0/icons/'
  && manifest.release === 'https://github.com/lucide-icons/lucide/tree/1.31.0',
'Lucide source and release are pinned to 1.31.0');
check(manifest.generatedBy === 'scripts/fetch-lucide-icons.mjs'
  && existsSync(join(ROOT, manifest.generatedBy)),
'manifest names the portable rebuild script');
check(new Set(declared).size === declared.length
  && declared.every((name) => /^[a-z][a-z0-9-]*$/.test(name)),
'declared icon names are unique safe path segments', declared.length + ' icons');
const license = readFileSync(LICENSE_FILE, 'utf8');
check(manifest.license.file === 'LICENSE.txt'
  && manifest.license.source === 'https://raw.githubusercontent.com/lucide-icons/lucide/1.31.0/LICENSE'
  && hash(license) === manifest.license.sha256
  && license.includes('ISC License') && license.includes('The MIT License (MIT)'),
'exact Lucide and Feather license notices match the recorded checksum');

console.log('\n■ Declared, referenced, and shipped assets');
const shipped = readdirSync(ICON_DIR)
  .filter((name) => extname(name) === '.svg')
  .map((name) => name.slice(0, -4)).sort();
const declaredSorted = [...declared].sort();
check(same(shipped, declaredSorted), 'shipped SVGs exactly match the manifest',
  `declared ${declaredSorted.length}, shipped ${shipped.length}`);

const sourceFiles = [
  ...filesBelow(join(ROOT, 'js'), (path) => extname(path) === '.js' && !path.startsWith(VENDOR_DIR)),
  ...filesBelow(join(ROOT, 'scripts'), (path) => extname(path) === '.mjs'),
];
const referenced = new Set();
for (const file of sourceFiles) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/["'`]lucide\/([a-z][a-z0-9-]*)["'`]/g)) referenced.add(match[1]);
}
const referencedSorted = [...referenced].sort();
check(same(referencedSorted, declaredSorted), 'source references exactly match declared assets',
  `declared ${declaredSorted.length}, referenced ${referencedSorted.length}`);

for (const entry of manifest.icons) {
  const file = join(ICON_DIR, `${entry.name}.svg`);
  const svg = readFileSync(file, 'utf8');
  const problems = svgProblems(svg);
  check(hash(svg) === entry.sha256, `${entry.name}.svg matches its SHA-256`);
  check(problems.length === 0, `${entry.name}.svg is a passive 24 px stroke icon`, problems.join(', '));
}

console.log('\n■ Namespace and traversal guard');
check(!existsSync(LEGACY_DIR) && !existsSync(join(ROOT, 'scripts', 'fetch-tree-icons.mjs')),
'legacy directory and rebuild script are absent');
const legacyPrefix = 'tree' + '/';
const legacyFiles = sourceFiles.filter((file) => {
  const source = readFileSync(file, 'utf8');
  return source.includes(`'${legacyPrefix}`) || source.includes(`"${legacyPrefix}`)
    || source.includes('`' + legacyPrefix);
});
check(legacyFiles.length === 0, 'no source file uses the legacy icon namespace',
  legacyFiles.map((file) => relative(ROOT, file)).join(', '));

const namespaced = icon('lucide/building', 'icon--md pipeline__glyph');
check(namespaced.includes("assets/icons/lucide/building.svg")
  && namespaced.includes('icon--md pipeline__glyph'),
'C.icon accepts one safe lowercase asset namespace');
check(icon('Building').includes("assets/icons/Building.svg"),
'C.icon retains unnamespaced Design System icons');
const rejected = [
  '../Building', 'lucide/../building', 'lucide/sub/building', 'Lucide/building',
  'lucide/building.svg', 'lucide/%2e%2e', "lucide/building' onclick='bad",
];
check(rejected.every((name) => {
  const html = icon(name);
  return html.includes("assets/icons/InfoCircle.svg") && !html.includes(name);
}), 'C.icon rejects traversal, nested paths, extensions, and injected characters');

console.log(failures ? `\n✗ ${failures} icon-asset check(s) failed` : '\n✓ all icon-asset checks passed');
process.exit(failures ? 1 : 0);
