// Suchmaschine prüfen — ohne Browser, weil js/search-engine.js reine Funktionen
// enthält. Geprüft werden genau die Fehlerbilder aus docs/search-review.md:
// Diakritika (B2), Mehrwortanfragen (B3), Rangfolge (B4), Wortgrenzen (B5),
// Flexion (B7) und Umgangssprache (B8).
import { fold, tokenize, prepare, search } from '../js/search-engine.js';

let fail = 0;
const ok = (cond, label, detail = '') => {
  if (!cond) fail++;
  console.log(`   ${cond ? '✓' : '✗'} ${label}${detail ? '  — ' + detail : ''}`);
};
const head = (s) => console.log('\n■ ' + s);

/* Ein kleiner, aber echter Ausschnitt des Index. */
const ROWS = [
  { title: 'Störungs-, Reinigungs- & Reparaturmeldung', desc: 'Defekte in einem Gebäude melden.', extra: 'Objektbetrieb', boost: 30 },
  { title: 'Raum-, Arbeitsplatz- & Parkplatzbuchung', desc: 'Sitzungsraum oder Parkplatz reservieren.', extra: 'Büroausrüstung', boost: 26 },
  { title: 'Mobiliarschlüssel bestellen', desc: 'Ersatzschlüssel für Büromobiliar.', extra: 'Büroausrüstung Schlossnummer', boost: 12 },
  { title: 'Umzug, Transport & Entsorgung', desc: 'Umzüge, Transporte und Entsorgungen anmelden. Mobiliar wird mitgenommen.', extra: 'Objektbetrieb', boost: 22 },
  { title: 'Layout- oder Output-Design-Auftrag erteilen', desc: 'Die Arbeitsvorbereitung übernimmt Layout und Output-Design.', extra: 'Produktion', boost: 12 },
  { title: 'Mustervorlagen für IKT-Beschaffungen', desc: 'Komplette Vorlagen-Sets für IT-Ausschreibungen.', extra: 'Informatik und IKT-Beschaffung' },
  { title: 'Wegleitung Open Source in der Beschaffung', desc: 'Entscheidungshilfe für Einkäufer.', extra: 'Informatik Werkzeugkasten PDF' },
  { title: 'Allgemeine Geschäftsbedingungen des Bundes', desc: 'AGB für Dienstleistungs- und Lieferaufträge.', extra: 'Beschaffung Dokumente der BKB' },
  { title: 'Bundeshaus West', desc: 'Bundesgasse 3, 3003 Bern', extra: '1080 4840 AF Bern BE Parlament und Regierung' },
  { title: 'BBL-2026-1042 — Zusätzliche 12 Arbeitsplätze', desc: 'Bundesamt für Umwelt BAFU', extra: 'BBL-2026-1042 Raumbedarf-Antrag' },
].map(prepare);

const find = (q) => search(ROWS, q);
const titles = (q) => find(q).map((r) => r.title);
const first = (q) => titles(q)[0];

head('Falten (B2) — Umlaute und ihre Umschreibung sind dasselbe');
ok(fold('Störung') === 'stoerung', 'ö → oe');
ok(fold('Grüsse Übermorgen') === 'gruesse uebermorgen', 'mehrere Umlaute');
ok(find('stoerung').length === find('störung').length && find('stoerung').length > 0,
  'stoerung == störung', `${find('stoerung').length} Treffer`);
ok(first('gebaeude') === 'Störungs-, Reinigungs- & Reparaturmeldung', 'gebaeude findet «Gebäude»');

head('Mehrwortanfragen (B3) — alle Begriffe müssen treffen');
ok(find('raum buchen').length > 0, '«raum buchen» findet etwas', first('raum buchen') || '—');
ok(first('raum buchen') === 'Raum-, Arbeitsplatz- & Parkplatzbuchung', 'und zwar die Buchung');
ok(find('mustervorlage ikt').length === 1, '«mustervorlage ikt» grenzt ein');
ok(find('mustervorlage xyzzy').length === 0, 'ein unbekannter Begriff schliesst aus (UND)');

head('Rangfolge (B4) — Titeltreffer schlägt Beschreibungstreffer');
ok(first('mobiliar') === 'Mobiliarschlüssel bestellen',
  'mobiliar → Mobiliarschlüssel zuerst', titles('mobiliar').join(' | '));
ok(first('umzug anmelden') === 'Umzug, Transport & Entsorgung', 'Wortfolge im Titel gewinnt');
const sc = find('mobiliar');
ok(sc[0]._score > sc[1]._score, 'die Punktzahlen unterscheiden sich', `${sc[0]._score} > ${sc[1]._score}`);

head('Wortgrenzen (B5) — kein Treffer mitten im Wort bei kurzen Begriffen');
ok(!titles('bern').includes('Layout- oder Output-Design-Auftrag erteilen'),
  '«bern» trifft nicht mehr über «übernimmt»');
ok(titles('bern').includes('Bundeshaus West'), '«bern» findet weiterhin Bern');
ok(find('is').length === 0, 'zweistellige Anfrage ohne Wortanfang → keine Treffer');
ok(find('it').length > 0, '«it» trifft am Wortanfang (IKT/IT)', String(find('it').length));

head('Flexion (B7) — Präfixe decken Mehrzahl und Zusammensetzung');
ok(find('vorlage').length >= 1 && find('vorlagen').length >= 1, 'Einzahl und Mehrzahl finden beide');
ok(find('störung').length === find('störungen').length, 'störung == störungen');
ok(titles('mustervorlage').includes('Mustervorlagen für IKT-Beschaffungen'), 'mustervorlage → Mustervorlagen');

head('Umgangssprache (B8) — was getippt wird, führt zu dem, was dasteht');
for (const [q, want] of [
  ['heizung', 'Störungs-, Reinigungs- & Reparaturmeldung'],
  ['kaputt', 'Störungs-, Reinigungs- & Reparaturmeldung'],
  ['parkplatz', 'Raum-, Arbeitsplatz- & Parkplatzbuchung'],
  ['möbel', 'Mobiliarschlüssel bestellen'],
  ['agb', 'Allgemeine Geschäftsbedingungen des Bundes'],
  ['ausschreibung', 'Mustervorlagen für IKT-Beschaffungen'],
]) ok(titles(q).includes(want), `«${q}» → ${want}`, titles(q)[0] || 'nichts');

head('Referenznummern und Objekt-IDs');
ok(first('BBL-2026-1042') === 'BBL-2026-1042 — Zusätzliche 12 Arbeitsplätze', 'Vorgangsnummer exakt');
ok(titles('1080 4840').includes('Bundeshaus West'), 'bbl_id ohne Schrägstriche');

head('Randfälle');
ok(find('').length === 0, 'leere Anfrage → keine Treffer');
ok(find('   ').length === 0, 'nur Leerzeichen → keine Treffer');
ok(find('!!!').length === 0, 'nur Satzzeichen → keine Treffer');
ok(tokenize('Störung, Raum').length === 2, 'Satzzeichen trennen Begriffe');
ok(prepare({ title: 'x' })._d.text === '', 'fehlende Beschreibung wirft nicht');

console.log(fail ? `\n✗ ${fail} Prüfung(en) fehlgeschlagen` : '\n✓ alle Prüfungen bestanden');
process.exit(fail ? 1 : 0);
