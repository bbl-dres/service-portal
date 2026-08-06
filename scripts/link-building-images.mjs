// Verknüpft die heruntergeladenen Aufnahmen mit den Gebäudedatensätzen.
//
//   node scripts/link-building-images.mjs           # Dry-Run (Standard)
//   node scripts/link-building-images.mjs --write   # GeoJSON wirklich ändern
//
// Setzt je Gebäude:
//   img_local   Pfad zur echten Aufnahme (oder null)
//   img_credit  Urheber + Lizenz — bei CC-BY/CC-BY-SA Pflicht — oder der
//               ehrliche Hinweis, dass ein Platzhalter steht und warum.
//
// Ausserdem wird img_url wieder auf eine Unsplash-Kennung zurückgesetzt.
// apply-research-data.mjs hatte dort eine Commons-URL eingetragen; core.js
// schneidet aus img_url aber die Unsplash-id (`photo-<id>`), fand nichts mehr
// und liess die Karte auf die leere Farbfläche fallen. Die Commons-Angaben
// gehören nach img_local/img_credit, nicht in img_url.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const flags = process.argv.slice(2);
const unbekannt = flags.filter((flag) => flag !== '--write');
if (unbekannt.length) throw new Error(`Unbekannte Option: ${unbekannt.join(', ')}`);
const schreiben = flags.includes('--write');

const ROOT = fileURLToPath(new URL('../', import.meta.url));
if (!schreiben) {
  console.log('Dry-Run: data/buildings.geojson nicht gelesen oder geschrieben.');
  console.log('Mit --write würde die historische Zuordnung aus BILDNACHWEIS.json neu angewendet.');
  process.exit(0);
}

const nachweis = JSON.parse(readFileSync(ROOT + 'assets/images/buildings/BILDNACHWEIS.json', 'utf8'));

// Platzhalter je Nutzungsart — vorher trugen alle neuen Objekte dasselbe Bild,
// wodurch die Galerie wie ein einziges wiederholtes Foto aussah.
const PLATZHALTER = {
  Verwaltung: '1486406146926-c627a92ad1ab',
  Zoll: '1449157291145-7efd050a4d0e',
  // Alle Kennungen einzeln gegen images.unsplash.com geprüft — eine erfundene
  // (1523050854058-…) lieferte 404, die Karte wäre stumm auf die Farbfläche
  // zurückgefallen.
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
let echt = 0; let platz = 0;

for (const f of bg.features) {
  const p = f.properties;
  const n = nachweis.bilder[p.bbl_id];

  if (n && existsSync(ROOT + n.datei)) {
    p.img_local = n.datei;
    p.img_credit = `${n.autor} · ${n.lizenz} · Wikimedia Commons`;
    p.img_quelle = n.commons;
    echt++;
  } else {
    p.img_local = null;
    p.img_quelle = null;
    const grund = nachweis.ohne_bild[p.bbl_id];
    p.img_credit = 'Platzhalterbild (Unsplash) — keine frei nutzbare Aufnahme dieses Objekts'
      + (grund ? `: ${String(grund).replace(/^[^—]*—\s*/, '')}` : '.');
    platz++;
  }

  // img_url bleibt die Unsplash-Rückfallebene; nach Nutzungsart gewählt, damit
  // nicht jede Karte dasselbe Bild zeigt.
  const id = PLATZHALTER[p.bbl_gbda1] || PLATZHALTER.Verwaltung;
  p.img_url = [`https://images.unsplash.com/photo-${id}?w=800&h=600&fit=crop`];
}

writeFileSync(ROOT + 'data/buildings.geojson', JSON.stringify(bg, null, 1));
console.log('data/buildings.geojson geschrieben.');
console.log(`${echt} Objekte mit echter Aufnahme · ${platz} mit Platzhalter`);
for (const f of bg.features) {
  const p = f.properties;
  console.log(`  ${p.img_local ? '📷' : '  '} ${p.bbl_id.padEnd(14)} ${p.bbl_bez.slice(0, 44).padEnd(46)} ${p.img_local ? p.img_credit : '(' + p.bbl_gbda1 + ')'}`);
}
