// Holt echte, frei nutzbare Gebäudefotos und legt sie unter
// assets/images/buildings/ ab — mit Urheber und Lizenz je Bild.
//
//   node scripts/fetch-building-images.mjs           # Dry-Run (Standard)
//   node scripts/fetch-building-images.mjs --write   # Download und Schreiben
//
// Die Dateien werden NICHT über die Commons-API gesucht. Zwei Gründe:
// die API drosselt hart (HTTP 429 schon nach wenigen Abfragen), und eine
// Stichwortsuche liefert zuverlässig das Falsche — «Liestal Kasinostrasse»
// ergab eine Brücke über die Ergolz, «Guisanplatz» die Bibliothek statt des
// Verwaltungszentrums. Verwendet werden darum ausschliesslich Aufnahmen, die
// in der Recherche einzeln geprüft wurden; die URL zeigt direkt auf
// upload.wikimedia.org.
//
// Wo keine geprüfte Aufnahme existiert, wird KEINE genommen. Das Objekt behält
// sein Platzhalterbild, und der Bildnachweis sagt, warum.

import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const flags = process.argv.slice(2);
const unbekannt = flags.filter((flag) => flag !== '--write');
if (unbekannt.length) throw new Error(`Unbekannte Option: ${unbekannt.join(', ')}`);
const schreiben = flags.includes('--write');

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ZIEL = ROOT + 'assets/images/buildings/';
const UA = 'bbl-kundenportal-prototyp/1.0 (Demodaten, nicht oeffentlich)';

// Geprüfte Aufnahmen: jede zeigt nachweislich das genannte Objekt.
const BILDER = [
  { id: '1000/4840/AF', objekt: 'Bundeshaus West',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/76/Bundeshaus_West_%282019-06-23%29.jpg',
    seite: 'https://commons.wikimedia.org/wiki/File:Bundeshaus_West_(2019-06-23).jpg',
    autor: 'Arkhein Drakenov', lizenz: 'CC BY-SA 4.0' },
  { id: '1000/3120/AB', objekt: 'Sammlungszentrum Schweizerisches Nationalmuseum',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Sammlungszentrum_Affoltern_am_Albis._Drohnenaufnahme.jpg',
    seite: 'https://commons.wikimedia.org/wiki/File:Sammlungszentrum_Affoltern_am_Albis._Drohnenaufnahme.jpg',
    autor: 'Schweizerisches Nationalmuseum', lizenz: 'CC BY-SA 4.0' },
  { id: '1000/5210/AA', objekt: 'Schweizerische Botschaft Berlin',
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Schweizerische_Botschaft_in_Berlin.jpg',
    seite: 'https://commons.wikimedia.org/wiki/File:Schweizerische_Botschaft_in_Berlin.jpg',
    autor: 'Lukas Beck', lizenz: 'CC BY-SA 4.0' },
  { id: '1000/5410/AA', objekt: 'Schweizerische Botschaft Tokio',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Embassy_of_Switzerland%2C_Tokyo.jpg',
    seite: 'https://commons.wikimedia.org/wiki/File:Embassy_of_Switzerland,_Tokyo.jpg',
    autor: 'Syced', lizenz: 'CC0 1.0 (gemeinfrei)' },
  { id: '1000/5620/AA', objekt: 'Schweizerische Botschaft Canberra',
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Embassy_of_Switzerland_in_Canberra.jpg',
    seite: 'https://commons.wikimedia.org/wiki/File:Embassy_of_Switzerland_in_Canberra.jpg',
    autor: 'Nomisztif', lizenz: 'CC BY-SA 4.0' },
  // Washington ist im Bestand kein eigenes Objekt (der US-Platz ist das
  // Generalkonsulat New York). Die Aufnahme liegt geprüft vor und wird für die
  // Mediathek mitgenommen.
  { id: 'washington', objekt: 'Schweizerische Botschaft Washington',
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Embassy_of_Switzerland%2C_Washington%2C_D.C..jpg',
    seite: 'https://commons.wikimedia.org/wiki/File:Embassy_of_Switzerland,_Washington,_D.C..jpg',
    autor: 'Aaron Siirila', lizenz: 'CC BY-SA 2.5' },
];

// Objekte OHNE geprüfte Aufnahme — mit Begründung. Ohne diese Liste sähe es aus,
// als wären sie schlicht vergessen worden.
const OHNE_BILD = {
  '1000/4100/AC': 'Campus BAZG Liestal — keine Aufnahme auf Commons; die Suche liefert die Kasinostrasse-Brücke, nicht das Gebäude.',
  '1000/2800/AD': 'Dienstwohnungen Effingerstrasse 29 — die einzige Commons-Datei an der Adresse ist eine Strassenszene, das Gebäude ist nicht sicher das Motiv.',
  '1000/1950/AE': 'RZ CAMPUS Frauenfeld — keine Aufnahme; das Rechenzentrum liegt auf einem Waffenplatz.',
  '1000/4850/AG': 'Verwaltungszentrum Guisanplatz — auf Commons existiert nur das ehemalige Kriegsmaterialmagazin von 1893 auf derselben Parzelle, nicht der Neubau.',
  '1000/5320/AA': 'Generalkonsulat New York — Mietfläche im Hochhaus 633 Third Avenue, kein eigenes Gebäude des Bundes.',
  '1000/5510/AA': 'Botschaft Brasília — keine Aufnahme auf Commons; Wikidata verweist irrtümlich auf ein Bild aus Nova Friburgo.',
  '1000/6100/AA': 'Landesmuseum Zürich — Aufnahmen vorhanden, aber noch nicht einzeln geprüft (Commons-API zurzeit gedrosselt).',
  '1000/6210/AA': 'Zollanlage Brig-Glis — keine geprüfte Aufnahme.',
  '1000/6320/AA': 'Bootshaus Arbon — keine geprüfte Aufnahme.',
  '1000/6430/AA': 'Nationalbibliothek, Tiefmagazin West — der Bau liegt unterirdisch; oberirdisch ist nur der gläserne Verbindungsbau sichtbar.',
  '1000/6540/AA': 'Eichenweg 5 Zollikofen — Neubau 2023, keine Aufnahme auf Commons.',
  '1000/6650/AA': 'Verwaltungsgebäude Liebefeld — keine geprüfte Aufnahme.',
  '1000/6760/AA': 'EHSM Magglingen Lärchenplatz — Neubau 2023, keine Aufnahme auf Commons.',
  '1000/6870/AA': 'swisstopo Wabern — keine geprüfte Aufnahme.',
  '1000/6980/AA': 'Bundesverwaltungsgericht Schwarztorstrasse — keine geprüfte Aufnahme.',
  '1000/7090/AA': 'Bundeshaus Nord — keine geprüfte Aufnahme; die meisten Bilder zeigen das Bundeshaus Mitte.',
};

if (!schreiben) {
  console.log('Dry-Run: keine Downloads und keine Dateien geschrieben.');
  console.log(`Mit --write würden ${BILDER.length} geprüfte Aufnahmen nach ${ZIEL} geladen`);
  console.log('und BILDNACHWEIS.json dort neu geschrieben.');
  process.exit(0);
}

const dateiname = (id) => id.replace(/\//g, '-') + '.jpg';
const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

// Originaldatei → Thumbnail fester Breite. Das Original des Bundeshauses West
// wiegt 6,6 MB; als Kartenbild ist das absurd. Wikimedia liefert unter
// /thumb/… eine kleinere Fassung — aber NUR in bestimmten Breiten. 320, 640,
// 800 und 1024 antworten mit HTTP 400 «Use thumbnail sizes listed on …»;
// 1280 wird ausgeliefert.
// /thumb/<a>/<ab>/<Name>/<breite>px-<Name> eine passende Fassung.
function thumbUrl(url, breite = 1280) {
  const m = url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/(.+)$/);
  if (!m) return url;
  return `${m[1]}/thumb/${m[2]}/${m[3]}/${m[4]}/${breite}px-${m[4]}`;
}

// Wikimedia drosselt nach wenigen Abrufen (HTTP 429). Geduldig statt aufgeben.
async function laden(url, versuch = 0) {
  if (versuch) await schlaf(8000 * versuch);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (res.status === 429 && versuch < 4) return laden(url, versuch + 1);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

mkdirSync(ZIEL, { recursive: true });
const manifest = {
  _hinweis: 'Bildnachweis. CC-BY und CC-BY-SA verlangen die Nennung von Urheber und Lizenz — sie steht hier und im Portal an jedem Objekt.',
  bilder: {}, ohne_bild: OHNE_BILD,
};

for (const b of BILDER) {
  const ziel = ZIEL + dateiname(b.id);
  try {
    await schlaf(2500);
    writeFileSync(ziel, await laden(thumbUrl(b.url, 1280)));
    const kb = Math.round(statSync(ziel).size / 1024);
    manifest.bilder[b.id] = {
      datei: `assets/images/buildings/${dateiname(b.id)}`, objekt: b.objekt,
      autor: b.autor, lizenz: b.lizenz, commons: b.seite, kb,
    };
    console.log(`  ✓ ${dateiname(b.id).padEnd(22)} ${String(kb).padStart(6)} KB  ${b.autor} · ${b.lizenz}`);
  } catch (e) {
    console.log(`  ✗ ${b.objekt}: ${e.message}`);
  }
}

writeFileSync(ZIEL + 'BILDNACHWEIS.json', JSON.stringify(manifest, null, 1));
console.log(`\n${Object.keys(manifest.bilder).length} echte Aufnahmen · ${Object.keys(OHNE_BILD).length} Objekte ohne`);
console.log('Nachweis: assets/images/buildings/BILDNACHWEIS.json');
