// Fetch only the pinned Lucide assets used by the portal. Runtime rendering is
// fully same-origin; this maintenance script is the sole network boundary.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const VERSION = '1.31.0';
const OUT = new URL('../assets/icons/lucide/', import.meta.url);
const SOURCE = `https://cdn.jsdelivr.net/npm/lucide-static@${VERSION}/icons/`;
const RELEASE = `https://github.com/lucide-icons/lucide/tree/${VERSION}`;
const LICENSE_SOURCE = `https://raw.githubusercontent.com/lucide-icons/lucide/${VERSION}/LICENSE`;
const LICENSE_SHA256 = 'b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57';

const ICONS = [
  ['chevron-right', 'Tree disclosure control'],
  ['library', 'Catalogue and process-documentation roots'],
  ['boxes', 'Business objects'],
  ['database', 'Data tables and systems'],
  ['list', 'Reference data'],
  ['globe', 'Country level'],
  ['map', 'Canton or region level'],
  ['map-pin', 'City level'],
  ['folder', 'Business entity'],
  ['building', 'Building'],
  ['land-plot', 'Land parcel'],
  ['briefcase', 'Construction project'],
  ['house', 'Tenancy'],
  ['layers', 'Floor'],
  ['workflow', 'Domain processes'],
  ['app-window', 'Customer-portal processes'],
  ['circle-check-big', 'Completed pipeline step'],
  ['clock-3', 'Current pipeline step'],
  // Detail-rail action rows. The ROW TYPE picks the glyph and there are only
  // three: a link leads somewhere, an action does something here, a locked row
  // cannot be used yet. Lucide rather than the CD set because these render at
  // 16px, where a stroked outline stays legible and a filled silhouette closes
  // up (js/ui/components/content.js, actionCardRow).
  ['arrow-right', 'Action row — does something on this page'],
  ['link', 'Action row — leads to another page in the portal'],
  ['external-link', 'Action row — leads to another system'],
  ['lock', 'Action row — not available in the prototype'],
];

const ROOT_ATTRIBUTES = new Map([
  ['xmlns', 'http://www.w3.org/2000/svg'],
  ['width', '24'],
  ['height', '24'],
  ['viewBox', '0 0 24 24'],
  ['fill', 'none'],
  ['stroke', 'currentColor'],
  ['stroke-width', '2'],
  ['stroke-linecap', 'round'],
  ['stroke-linejoin', 'round'],
]);
const SAFE_TAGS = new Set(['svg', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect']);

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

function normalizeSvg(source) {
  return source.replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->\s*/g, '')
    .replace(/\s*class="[^"]*"/g, '')
    .replace(/\n\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim() + '\n';
}

function validateSvg(name, svg) {
  const unsafe = /<\?|<!DOCTYPE|<!ENTITY|<\/?(?:script|style|foreignObject|image|use|a)\b|\b(?:href|src|style)\s*=|\bon[a-z]+\s*=|javascript:|data:|url\s*\(/i;
  if (unsafe.test(svg)) throw new Error(`${name}: active or external SVG content is not allowed`);
  if (!svg.endsWith('</svg>\n')) throw new Error(`${name}: incomplete SVG document`);

  const root = svg.match(/^<svg\b([^>]*)>/s);
  if (!root) throw new Error(`${name}: missing SVG root`);
  const attributes = [...root[1].matchAll(/([\w:-]+)="([^"]*)"/g)];
  const unparsed = root[1].replace(/\s+[\w:-]+="[^"]*"/g, '').trim();
  if (unparsed) throw new Error(`${name}: malformed or unsupported SVG root syntax`);
  if (attributes.length !== ROOT_ATTRIBUTES.size) {
    throw new Error(`${name}: the SVG root must have exactly ${ROOT_ATTRIBUTES.size} attributes`);
  }
  const seen = new Set();
  for (const [, key, value] of attributes) {
    if (seen.has(key) || ROOT_ATTRIBUTES.get(key) !== value) {
      throw new Error(`${name}: invalid SVG root attribute ${key}`);
    }
    seen.add(key);
  }
  for (const key of ROOT_ATTRIBUTES.keys()) {
    if (!seen.has(key)) throw new Error(`${name}: missing SVG root attribute ${key}`);
  }

  const tags = [...svg.matchAll(/<\/?([A-Za-z][\w:-]*)\b/g)].map((match) => match[1]);
  const badTag = tags.find((tag) => !SAFE_TAGS.has(tag));
  if (badTag) throw new Error(`${name}: unsupported SVG element ${badTag}`);
  if (svg.replace(/<[^>]+>/g, '').trim()) throw new Error(`${name}: SVG text content is not allowed`);
}

async function fetchText(url, label) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`${label}: network request failed`, { cause: error });
  }
  if (!response.ok) throw new Error(`${label}: upstream returned HTTP ${response.status}`);
  return response.text();
}

function readme() {
  return `# Lucide icon subset

This directory contains the ${ICONS.length} Lucide icons used by the portal. They are
bundled locally so navigation, status indicators, and offline use never depend
on a runtime icon CDN. The larger PascalCase set in \`assets/icons/\` comes from
the Swiss Confederation Design System; keep the two visual families separate
within a component.

- Upstream package: \`lucide-static\` ${VERSION}
- Source: <${SOURCE}>
- Upstream release: <${RELEASE}>
- License: ISC, with an MIT notice for Feather-derived icons; see
  [\`LICENSE.txt\`](LICENSE.txt)
- Machine-readable inventory and SHA-256 hashes: [\`manifest.json\`](manifest.json)
- Rebuild script: \`scripts/fetch-lucide-icons.mjs\`

Only add an icon through the rebuild script and give it a concrete portal
consumer. \`scripts/test-icon-assets.mjs\` rejects undeclared, missing, unsafe,
or unreferenced SVGs.

| File | Portal use |
| --- | --- |
${ICONS.map(([name, purpose]) => `| \`${name}.svg\` | ${purpose} |`).join('\n')}
`;
}

async function main() {
  // Nothing is written until every upstream response has arrived and passed
  // validation, so an outage cannot leave a half-updated icon collection.
  const [downloaded, license] = await Promise.all([
    Promise.all(ICONS.map(async ([name, purpose]) => {
      const svg = normalizeSvg(await fetchText(`${SOURCE}${name}.svg`, name));
      validateSvg(name, svg);
      return { name, purpose, svg, sha256: sha256(svg) };
    })),
    fetchText(LICENSE_SOURCE, 'Lucide license'),
  ]);
  const normalizedLicense = license.replace(/\r\n?/g, '\n').trimEnd() + '\n';
  if (sha256(normalizedLicense) !== LICENSE_SHA256) {
    throw new Error('Lucide license checksum differs from the pinned 1.31.0 text');
  }

  const manifest = {
    name: 'service-portal Lucide subset',
    version: VERSION,
    source: SOURCE,
    release: RELEASE,
    license: { file: 'LICENSE.txt', source: LICENSE_SOURCE, sha256: LICENSE_SHA256 },
    generatedBy: 'scripts/fetch-lucide-icons.mjs',
    icons: downloaded.map(({ name, purpose, sha256: digest }) => ({
      name, purpose, sha256: digest,
    })),
  };

  const outputs = [
    ...downloaded.map(({ name, svg }) => [`${name}.svg`, svg]),
    ['LICENSE.txt', normalizedLicense],
    ['README.md', readme()],
    ['manifest.json', JSON.stringify(manifest, null, 2) + '\n'],
  ];
  if (process.argv.includes('--check')) {
    const current = await Promise.all(outputs.map(async ([name, expected]) => {
      let actual;
      try {
        actual = await readFile(new URL(name, OUT), 'utf8');
      } catch (error) {
        throw new Error(`${name}: cannot read the checked-in asset`, { cause: error });
      }
      return actual === expected ? '' : name;
    }));
    const changed = current.filter(Boolean);
    if (changed.length) throw new Error(`checked-in output differs: ${changed.join(', ')}`);
    console.log(`Verified ${downloaded.length} checked-in Lucide ${VERSION} icons against upstream.`);
    return;
  }

  await mkdir(OUT, { recursive: true });
  await Promise.all(outputs.map(([name, contents]) => writeFile(new URL(name, OUT), contents, 'utf8')));
  console.log(`Wrote ${downloaded.length} validated Lucide ${VERSION} icons and provenance metadata.`);
}

main().catch((error) => {
  console.error(`Lucide asset refresh failed: ${error.message}`);
  process.exitCode = 1;
});
