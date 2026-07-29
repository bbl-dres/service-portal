// Zieht die Fotos aus den BBL-Bautendokumentationen heraus.
//
//   node scripts/extract-pdf-images.mjs                 alle PDFs in research/
//   node scripts/extract-pdf-images.mjs <datei.pdf>     eine einzelne
//
// Warum von Hand statt mit pdfimages: poppler ist hier nur mit pdftotext
// installiert. Die Fotos in diesen PDFs sind aber durchweg JPEG-Ströme
// (DCTDecode) — die lassen sich direkt aus den Bytes schneiden: ein JPEG
// beginnt mit FF D8 FF und endet mit FF D9. Bilder in anderer Kodierung
// (Flate, JPX) werden dabei übergangen; das sind hier Logos und Flächen.
//
// Ausgabe nach research/pdf-bilder/<pdf-name>/NNN_<breite>x<hoehe>.jpg
// samt einer Übersicht je PDF (Fotograf aus dem Impressum, Bildliste).
//
// RECHTE: Die Bautendokumentationen sind vom BBL veröffentlicht, die Fotos darin
// aber einzeln Fotografinnen und Fotografen zugeschrieben (im Impressum unter
// «Fotografie»). Sie sind NICHT frei lizenziert. Für einen internen Prototyp
// des BBL über BBL-eigene Bauten ist die Verwendung vertretbar; der Nachweis
// wird je Bild mitgeführt. Für eine Veröffentlichung wäre die Zustimmung der
// Urheber einzuholen.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, join } from 'node:path';

const ROOT = 'c:/Users/david/Documents/GitHub/service-portal/';
const AUS = ROOT + 'research/pdf-bilder/';
const MIN_BYTES = 40 * 1024;    // kleiner ist Logo, Signet oder Farbfläche
const MIN_KANTE = 500;          // Kantenlänge in Bildpunkten

// Bildmasse aus dem JPEG-Kopf lesen (SOF0/1/2/…): so lassen sich Kacheln und
// Farbverläufe aussortieren, ohne die Datei zu dekodieren.
function masse(buf) {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break;
    i += 2 + len;
  }
  return null;
}

// Alle JPEG-Ströme aus den Rohbytes schneiden.
function jpegs(buf) {
  const out = [];
  for (let i = 0; i < buf.length - 3; i++) {
    if (buf[i] !== 0xFF || buf[i + 1] !== 0xD8 || buf[i + 2] !== 0xFF) continue;
    // Ende suchen: FF D9. Verschachtelte Thumbnails im EXIF können ein frühes
    // FFD9 haben — darum bis zum LETZTEN plausiblen Ende innerhalb des Stroms.
    let ende = -1;
    for (let j = i + 3; j < buf.length - 1; j++) {
      if (buf[j] === 0xFF && buf[j + 1] === 0xD9) { ende = j + 2; break; }
    }
    if (ende < 0) break;
    const teil = buf.subarray(i, ende);
    if (teil.length >= MIN_BYTES) {
      const m = masse(teil);
      if (m && m.w >= MIN_KANTE && m.h >= MIN_KANTE) out.push({ buf: teil, ...m });
    }
    i = ende - 1;
  }
  return out;
}

// Fotograf aus dem Impressum des Datenblatts.
function fotograf(pdf) {
  try {
    const t = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 32e6 });
    const m = t.match(/Fotografie[^\n]*\n?([^\n]*)/i) || t.match(/Fotos?\s*[:\s]([^\n]*)/i);
    return m ? m[0].replace(/\s+/g, ' ').replace(/^Fotografien?\s*/i, '').trim().slice(0, 90) : '';
  } catch { return ''; }
}

const argv = process.argv.slice(2);
const quellen = [];
for (const dir of ['research/pdfs', 'research/pdfs-agent']) {
  if (!existsSync(ROOT + dir)) continue;
  for (const f of readdirSync(ROOT + dir).filter((x) => x.toLowerCase().endsWith('.pdf'))) {
    quellen.push(join(ROOT + dir, f));
  }
}
const liste = argv.length ? argv : quellen;

mkdirSync(AUS, { recursive: true });
const uebersicht = {};
let gesamt = 0;

for (const pdf of liste) {
  const name = basename(pdf, '.pdf');
  let bilder = [];
  try { bilder = jpegs(readFileSync(pdf)); } catch (e) { console.log(`  ! ${name}: ${e.message}`); continue; }
  if (!bilder.length) { console.log(`  – ${name.slice(0, 52).padEnd(54)} keine verwertbaren Fotos`); continue; }

  const ordner = AUS + name + '/';
  mkdirSync(ordner, { recursive: true });
  // Grösste zuerst — das Titelbild ist fast immer das grösste.
  bilder.sort((a, b) => (b.w * b.h) - (a.w * a.h));
  const dateien = [];
  bilder.slice(0, 12).forEach((b, i) => {
    const dn = `${String(i + 1).padStart(2, '0')}_${b.w}x${b.h}.jpg`;
    writeFileSync(ordner + dn, b.buf);
    dateien.push({ datei: dn, w: b.w, h: b.h, kb: Math.round(b.buf.length / 1024) });
  });
  uebersicht[name] = { pdf: basename(pdf), fotograf: fotograf(pdf), bilder: dateien };
  gesamt += dateien.length;
  console.log(`  ✓ ${name.slice(0, 52).padEnd(54)} ${String(dateien.length).padStart(2)} Fotos  (grösstes ${bilder[0].w}×${bilder[0].h})`);
}

writeFileSync(AUS + 'UEBERSICHT.json', JSON.stringify(uebersicht, null, 1));
console.log(`\n${gesamt} Fotos aus ${Object.keys(uebersicht).length} Datenblättern → research/pdf-bilder/`);
console.log('Übersicht: research/pdf-bilder/UEBERSICHT.json');
