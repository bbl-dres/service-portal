// Holt die Symbolbilder der Anwendungskarten und legt sie unter
// assets/images/applications/ ab — mit Urheber und Lizenz je Bild.
//
//   node scripts/fetch-application-images.mjs
//
// Warum ein Skript und keine Handablage: der Bestand in data/applications.json
// führt zu jedem Bild Urheber, Lizenz und Quellseite (`bild`). Damit die Angabe
// nachprüfbar bleibt, steht die Herkunft hier neben der Datei, die sie erzeugt.
//
// Die bisherigen Aufnahmen stammen von Pexels; diese hier von Unsplash. Beide
// Lizenzen erlauben die kommerzielle Nutzung ohne Namensnennungspflicht — der
// Nachweis in `bild` ist deshalb keine Bedingung, sondern Sorgfalt beim Pflegen.
// Jede Aufnahme wurde einzeln angesehen und auf das Thema geprüft; eine
// Stichwortsuche allein liefert zuverlässig das Falsche.
//
// Zielformat: 1880×1253 (3:2) wie der übrige Bestand im Ordner. Die Karten
// zeigen das Bild mit höchstens ~640 px Breite, die Landingpage mit 800 px —
// 1880 px lässt Luft für hohe Pixeldichten, ohne die Datei aufzublähen.

import { writeFileSync, mkdirSync, statSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ZIEL = ROOT + 'assets/images/applications/';
const W = 1880, H = 1253, Q = 72;

// Geprüfte Aufnahmen: appId → Bild. `titel` ist die englische Bildbeschreibung
// von Unsplash (sie landet als alt-Text auf der Landingpage).
const BILDER = [
  { appId: 'i14y', photo: 'photo-1644088379091-d574269d422f',
    titel: 'A blue background with lines and dots forming a connected network',
    fotograf: 'Conny Schneider',
    quelle: 'https://unsplash.com/photos/a-blue-background-with-lines-and-dots-pREq0ns_p_E' },
  { appId: 'termdat', photo: 'photo-1451226428352-cf66bf8a0317',
    titel: 'Close-up of a dictionary page in focus',
    fotograf: 'Romain Vignes',
    quelle: 'https://unsplash.com/photos/focus-dictionary-index-page-ywqa9IZB-dU' },
  { appId: 'geoportal-bund', photo: 'photo-1730314737994-e50751608055',
    titel: 'Detailed topographic map of a mountainous region',
    fotograf: 'The New York Public Library',
    quelle: 'https://unsplash.com/photos/detailed-topographic-map-of-a-mountainous-region-UNu-lqX2FdQ' },
  { appId: 'geocat', photo: 'photo-1511721285502-9f81e79be874',
    titel: 'Close-up photography of a wooden library card catalog',
    fotograf: 'Erol Ahmed',
    quelle: 'https://unsplash.com/photos/close-up-photography-of-brown-wooden-card-catalog-Y3KEBQlB1Zk' },
  { appId: 'metadata-catalog', photo: 'photo-1762627105132-f6ed848a23bf',
    titel: 'Rows of labelled white archive boxes on wooden shelves',
    fotograf: 'Luke Caunt',
    quelle: 'https://unsplash.com/photos/rows-of-white-archive-boxes-on-wooden-shelves-5utYi64hnJ0' },
  { appId: 'simap', photo: 'photo-1562564055-71e051d33c19',
    titel: 'Two people reviewing and signing documents at a table',
    fotograf: 'Gabrielle Henderson',
    quelle: 'https://unsplash.com/photos/woman-signing-on-white-printer-paper-beside-woman-about-to-touch-the-documents-HJckKnwCXxQ' },
];

mkdirSync(ZIEL, { recursive: true });

for (const b of BILDER) {
  const datei = ZIEL + b.appId + '.jpg';
  try { statSync(datei); console.log(`  · ${b.appId}.jpg — liegt bereits, übersprungen`); continue; } catch { /* neu */ }
  const url = `https://images.unsplash.com/${b.photo}?auto=format&fit=crop&w=${W}&h=${H}&q=${Q}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'bbl-kundenportal-prototyp/1.0 (Demodaten, nicht oeffentlich)' } });
  if (!r.ok) { console.error(`  ✗ ${b.appId} — HTTP ${r.status}`); continue; }
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(datei, buf);
  console.log(`  ✓ ${b.appId}.jpg — ${Math.round(buf.length / 1024)} KB · ${b.fotograf}`);
}
