// Übernimmt Fotos aus den BBL-Datenblättern in den Bildbestand.
//
//   node scripts/adopt-pdf-images.mjs --pruefen
//   node scripts/adopt-pdf-images.mjs
//
// Auswahl: je Objekt das grösste Foto im QUERFORMAT. Querformat, weil die
// Datenblätter Grundrisse, Schnitte und Pläne fast immer hochkant setzen und
// Aussenaufnahmen quer — ohne diese Vorauswahl landete leicht ein Grundriss auf
// der Objektkarte.
//
// ACHTUNG, ehrlich gesagt: die Bilder wurden maschinell ausgewählt, nicht
// gesichtet. Die Heuristik trifft meistens, aber nicht immer. Vor einer
// Vorführung sollten die übernommenen Aufnahmen einmal durchgesehen werden;
// research/pdf-bilder/ hält je Objekt alle Kandidaten bereit.
//
// RECHTE: Die Datenblätter sind vom BBL veröffentlicht; die Fotos darin sind
// einzelnen Fotografinnen und Fotografen zugeschrieben und NICHT frei
// lizenziert. Für einen internen BBL-Prototyp über BBL-eigene Bauten ist das
// vertretbar, der Nachweis läuft je Bild mit. Für eine Veröffentlichung wäre
// die Zustimmung der Urheber einzuholen.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pruefen = process.argv.includes('--pruefen');
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const QUELLE = ROOT + 'research/pdf-bilder/';
const ZIEL = 'assets/images/buildings/';
const uebersicht = JSON.parse(readFileSync(QUELLE + 'UEBERSICHT.json', 'utf8'));

// bbl_id → Ordner in research/pdf-bilder/ (= Datenblatt des Objekts)
const ZUORDNUNG = {
  '1080/4100/AC': '2015_liestal_zollschule',
  '1080/6100/AA': 'p045_Landesmuseum_Erweiterung',
  '1080/6210/AA': 'p124_BrigGlis_Zollanlage',
  '1080/6320/AA': 'p112_Arbon_Bootshaus',
  '1080/6430/AA': 'p099_NB_Tiefmagazin',
  '1080/6540/AA': 'p023_Zollikofen_Eichenweg5',
  '1080/6650/AA': 'p025_Liebefeld_Schwarzenburg157',
  '1080/6760/AA': 'p108_Magglingen_Laerchenplatz',
  '1080/6870/AA': 'p132_Wabern_swisstopo',
  '1080/6980/AA': 'p019_Bundesverwaltungsgericht',
  // Objekte, für die schon eine geprüfte Commons-Aufnahme vorliegt, bleiben
  // unangetastet — Commons ist frei lizenziert, das Datenblatt nicht.
};

const medien = JSON.parse(readFileSync(ROOT + 'data/media.json', 'utf8'));
const bericht = [];
let uebernommen = 0;

for (const [bblId, ordner] of Object.entries(ZUORDNUNG)) {
  const u = uebersicht[ordner];
  if (!u || !u.bilder.length) { bericht.push(`  – ${bblId}  ${ordner}: keine Fotos`); continue; }

  // Querformat bevorzugen, danach Fläche. Absurd grosse Panoramen (Seitenverhältnis
  // über 3:1) sind Schnitte oder Bildstreifen über die ganze Seitenbreite.
  const kandidaten = u.bilder
    // Obergrenze: ein Foto mit 21691×13353 Bildpunkten (so eines steckt in der
    // Magglingen-Dokumentation) belegt entpackt über 1 GB im Browser, egal wie
    // klein die Datei ist. Alles über 6000 Punkten Kantenlänge fliegt raus.
    .filter((b) => b.w > b.h && b.w / b.h < 3 && b.w >= 700 && b.w <= 6000 && b.h <= 6000)
    .sort((a, b) => (b.w * b.h) - (a.w * a.h));
  const wahl = kandidaten[0];
  if (!wahl) { bericht.push(`  – ${bblId}  ${ordner}: nichts im Querformat`); continue; }

  // Das Hauptmedium des Objekts ist der erste Favorit — dessen slug gibt den
  // Dateinamen vor, damit die Benennung dem übrigen Bestand entspricht.
  const haupt = medien.find((m) => m.buildingId === bblId);
  if (!haupt) { bericht.push(`  ! ${bblId}: kein Medieneintrag gefunden`); continue; }

  const zielname = `${haupt.slug}.jpg`;
  if (!pruefen) copyFileSync(QUELLE + ordner + '/' + wahl.datei, ROOT + ZIEL + zielname);

  haupt.file = ZIEL + zielname;
  haupt.photographer = u.fotograf || 'BBL-Bautendokumentation';
  haupt.copyright = `${u.fotograf || 'Fotograf nicht genannt'} — aus der Bautendokumentation des BBL`;
  haupt.license = 'BBL-Bautendokumentation, nicht frei lizenziert';
  haupt.sourceUrl = (haupt.sourceUrl || null);
  haupt.isPlaceholder = false;
  haupt.photo = '';
  haupt.reviewNeeded = true;   // maschinell gewählt, noch nicht gesichtet
  uebernommen++;
  bericht.push(`  ✓ ${bblId}  ${String(wahl.w + '×' + wahl.h).padEnd(11)} ${wahl.kb} KB  ← ${ordner}/${wahl.datei}`
    + `\n      ${zielname}`);
}

console.log(bericht.join('\n'));
const echt = medien.filter((m) => m.file).length;
console.log(`\n${uebernommen} Fotos übernommen · ${echt} von ${medien.length} Medien haben jetzt eine echte Aufnahme`);

if (pruefen) console.log('\n(--pruefen: nichts geschrieben)');
else {
  writeFileSync(ROOT + 'data/media.json', JSON.stringify(medien, null, 1));
  console.log('→ data/media.json aktualisiert');
}
