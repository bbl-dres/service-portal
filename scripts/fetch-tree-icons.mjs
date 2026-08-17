// Fetch only the Lucide icons used by sidebar trees. They are checked in so the
// portal remains usable offline and does not depend on a runtime icon CDN.
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'c:/Users/david/Documents/GitHub/service-portal/assets/icons/tree/';
const VERSION = '1.31.0';
const BASE = `https://cdn.jsdelivr.net/npm/lucide-static@${VERSION}/icons/`;

// One icon set keeps stroke weight consistent across every tree surface.
const WANTED = {
  'chevron-right': 'Aufklapp-Zeichen jeder Zeile mit Kindern',

  // Catalogue.
  library: 'Katalog — die Wurzel',
  boxes: 'Geschaeftsobjekte',
  database: 'Systeme',
  list: 'Referenzdaten',

  // Spatial trees share the country, region, and city axis.
  globe: 'Land',
  map: 'Kanton/Region',
  'map-pin': 'Ort',
  folder: 'Wirtschaftseinheit',
  building: 'Gebaeude',
  'land-plot': 'Grundstueck',
  briefcase: 'Bauprojekt',
  house: 'Mietobjekt',
  layers: 'Geschoss',

  // Process documentation branches.
  workflow: 'Fachliche Prozesse',
  'app-window': 'Kundenportal — die Ablaeufe des Portals selbst',
};

mkdirSync(OUT, { recursive: true });

let missing = 0;
for (const [name, why] of Object.entries(WANTED)) {
  const res = await fetch(BASE + name + '.svg');
  if (!res.ok) { console.log('MISSING ' + name + ': ' + res.status); missing++; continue; }
  let svg = await res.text();
  // The adjacent README owns licensing; masks do not need Lucide class names.
  svg = svg.replace(/<!--[\s\S]*?-->\s*/g, '')
    .replace(/\s*class="[^"]*"/g, '')
    .replace(/\n\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
  writeFileSync(OUT + name + '.svg', svg + '\n', 'utf8');
  console.log(name.padEnd(15) + (svg.length + ' B').padStart(7) + '   ' + why);
}

writeFileSync(OUT + 'README.md',
  '# Symbole des Seitenbaums\n\n'
  + 'Lucide ' + VERSION + ', ISC-Lizenz — https://lucide.dev\n\n'
  + 'Mitgeliefert, nicht nachgeladen: das Portal muss ohne Netz laufen. Und nur\n'
  + 'die tatsaechlich benutzten Dateien, nicht der ganze Satz.\n\n'
  + 'Hier stehen die Symbole ALLER Seitenbaeume — Katalog, Liegenschaften,\n'
  + 'Bauprojekte, Mietendenportal, Workspace und Plan-Editor. Sie kommen aus\n'
  + 'einer Quelle und haben eine Strichstaerke; das Bundes-CD in `assets/icons/`\n'
  + 'traegt den Rest des Portals. Die beiden Saetze sollen sich nicht mischen,\n'
  + 'am wenigsten in derselben Spalte.\n\n'
  + '| Datei | wofuer |\n|---|---|\n'
  + Object.entries(WANTED).map(([n, w]) => '| `' + n + '.svg` | ' + w + ' |').join('\n')
  + '\n\nNachziehen: scripts/fetch-tree-icons.mjs\n', 'utf8');
console.log('\nREADME + ' + (Object.keys(WANTED).length - missing) + ' icons in assets/icons/tree/');
