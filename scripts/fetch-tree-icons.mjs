// Holt genau die Lucide-Symbole, die der Baum benutzt — nicht den Satz.
// Sie werden mitgeliefert (nicht von einem CDN geladen): das Portal muss ohne
// Netz laufen, und ein Symbol, das nachgeladen wird, fehlt genau dann, wenn es
// gebraucht wird.
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'c:/Users/david/Documents/GitHub/service-portal/assets/icons/tree/';
const VERSION = '1.31.0';
const BASE = `https://cdn.jsdelivr.net/npm/lucide-static@${VERSION}/icons/`;

// Was der Katalog heute fuehrt. Weitere Oberflaechen bringen ihre eigenen mit,
// wenn sie umziehen — deshalb steht hier eine Liste und kein Paket.
const WANTED = {
  'chevron-right': 'Aufklapp-Zeichen jeder Zeile mit Kindern',
  library: 'Katalog — die Wurzel',
  boxes: 'Geschaeftsobjekte',
  database: 'Systeme',
  list: 'Referenzdaten',
};

mkdirSync(OUT, { recursive: true });

for (const [name, why] of Object.entries(WANTED)) {
  const res = await fetch(BASE + name + '.svg');
  if (!res.ok) { console.log('FEHLT ' + name + ': ' + res.status); continue; }
  let svg = await res.text();
  // Aufraeumen: der Lizenzkommentar steht gesammelt in der README daneben, und
  // die Klassennamen von Lucide braucht eine Maske nicht.
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
  + 'Hier stehen die Symbole des Seitenbauteils. Alles Uebrige im Portal benutzt\n'
  + 'weiterhin die Symbole des Bundes-CD in `assets/icons/`; die beiden Saetze\n'
  + 'sind verschiedener Herkunft und verschiedener Strichstaerke und sollen sich\n'
  + 'nicht vermischen.\n\n'
  + '| Datei | wofuer |\n|---|---|\n'
  + Object.entries(WANTED).map(([n, w]) => '| `' + n + '.svg` | ' + w + ' |').join('\n')
  + '\n\nNachziehen: scripts/fetch-tree-icons.mjs\n', 'utf8');
console.log('\nREADME + ' + Object.keys(WANTED).length + ' Symbole in assets/icons/tree/');
