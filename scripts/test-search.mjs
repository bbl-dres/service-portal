// Test the search engine without a browser because js/search/search-engine.js exports
// pure functions. These cases cover the exact failures from docs/search-review.md:
// diacritics (B2), multi-word queries (B3), ranking (B4), word boundaries (B5),
// inflection (B7), and colloquial terms (B8).
import { fold, tokenize, prepare, search } from '../js/search/search-engine.js';

let failures = 0;
const check = (condition, label, detail = '') => {
  if (!condition) failures++;
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? '  — ' + detail : ''}`);
};
const section = (title) => console.log('\n■ ' + title);

/* A small but representative slice of the search index. */
const SEARCH_INDEX = [
  { title: 'Störungs-, Reinigungs- & Reparaturmeldung', desc: 'Defekte in einem Gebäude melden.', extra: 'Objektbetrieb', boost: 30 },
  { title: 'Raum buchen', desc: 'Sitzungs- oder Besprechungsraum reservieren.', extra: 'Arbeitsplatz und Logistik', boost: 26 },
  { title: 'Mobiliarschlüssel bestellen', desc: 'Ersatzschlüssel für Büromobiliar.', extra: 'Büroausrüstung Schlossnummer', boost: 12 },
  { title: 'Umzug, Transport & Entsorgung', desc: 'Umzüge, Transporte und Entsorgungen anmelden. Mobiliar wird mitgenommen.', extra: 'Objektbetrieb', boost: 22 },
  { title: 'Layout- oder Output-Design-Auftrag erteilen', desc: 'Die Arbeitsvorbereitung übernimmt Layout und Output-Design.', extra: 'Produktion', boost: 12 },
  { title: 'Mustervorlagen für IKT-Beschaffungen', desc: 'Komplette Vorlagen-Sets für IT-Ausschreibungen.', extra: 'Informatik und IKT-Beschaffung' },
  { title: 'Wegleitung Open Source in der Beschaffung', desc: 'Entscheidungshilfe für Einkäufer.', extra: 'Informatik Werkzeugkasten PDF' },
  { title: 'Allgemeine Geschäftsbedingungen des Bundes', desc: 'AGB für Dienstleistungs- und Lieferaufträge.', extra: 'Beschaffung Dokumente der BKB' },
  { title: 'Bundeshaus West', desc: 'Bundesgasse 3, 3003 Bern', extra: '1080 4840 AF Bern BE Parlament und Regierung' },
  { title: 'BBL-2026-1042 — Zusätzliche 12 Arbeitsplätze', desc: 'Bundesamt für Umwelt BAFU', extra: 'BBL-2026-1042 Raumbedarf-Antrag' },
].map(prepare);

const find = (query) => search(SEARCH_INDEX, query);
const titles = (query) => find(query).map((result) => result.title);
const first = (query) => titles(query)[0];

section('Folding (B2) — umlauts and their transliterations are equivalent');
check(fold('Störung') === 'stoerung', 'folds "ö" to "oe"');
check(fold('Grüsse Übermorgen') === 'gruesse uebermorgen', 'folds multiple umlauts');
check(find('stoerung').length === find('störung').length && find('stoerung').length > 0,
  '"stoerung" and "störung" return the same results', `${find('stoerung').length} result(s)`);
check(first('gebaeude') === 'Störungs-, Reinigungs- & Reparaturmeldung', '"gebaeude" finds "Gebäude"');

section('Multi-word queries (B3) — every term must match');
check(find('raum buchen').length > 0, '"raum buchen" returns a result', first('raum buchen') || 'no result');
check(first('raum buchen') === 'Raum buchen', 'returns the booking result first');
check(find('mustervorlage ikt').length === 1, '"mustervorlage ikt" narrows the results');
check(find('mustervorlage xyzzy').length === 0, 'an unknown term excludes the result (AND)');

section('Ranking (B4) — a title match outranks a description match');
check(first('mobiliar') === 'Mobiliarschlüssel bestellen',
  '"mobiliar" ranks "Mobiliarschlüssel bestellen" first', titles('mobiliar').join(' | '));
check(first('umzug anmelden') === 'Umzug, Transport & Entsorgung', 'the title phrase wins');
const scoredResults = find('mobiliar');
check(scoredResults[0]._score > scoredResults[1]._score, 'the scores differ', `${scoredResults[0]._score} > ${scoredResults[1]._score}`);

section('Word boundaries (B5) — short terms do not match inside words');
check(!titles('bern').includes('Layout- oder Output-Design-Auftrag erteilen'),
  '"bern" no longer matches inside "übernimmt"');
check(titles('bern').includes('Bundeshaus West'), '"bern" still finds Bern');
check(find('is').length === 0, 'a two-letter query without a word-prefix match returns nothing');
check(find('it').length > 0, '"it" matches at a word prefix (IKT/IT)', String(find('it').length));

section('Inflection (B7) — prefixes cover plurals and compound words');
check(find('vorlage').length >= 1 && find('vorlagen').length >= 1, 'singular and plural both return results');
check(find('störung').length === find('störungen').length, '"störung" and "störungen" return the same results');
check(titles('mustervorlage').includes('Mustervorlagen für IKT-Beschaffungen'), '"mustervorlage" finds "Mustervorlagen"');

section('Colloquial terms (B8) — common wording finds the canonical content');
for (const [query, expectedTitle] of [
  ['heizung', 'Störungs-, Reinigungs- & Reparaturmeldung'],
  ['kaputt', 'Störungs-, Reinigungs- & Reparaturmeldung'],
  ['sitzungszimmer', 'Raum buchen'],
  ['möbel', 'Mobiliarschlüssel bestellen'],
  ['agb', 'Allgemeine Geschäftsbedingungen des Bundes'],
  ['ausschreibung', 'Mustervorlagen für IKT-Beschaffungen'],
]) check(titles(query).includes(expectedTitle), `"${query}" finds "${expectedTitle}"`, titles(query)[0] || 'no result');

section('Reference numbers and object IDs');
check(first('BBL-2026-1042') === 'BBL-2026-1042 — Zusätzliche 12 Arbeitsplätze', 'matches the exact case number');
check(titles('1080 4840').includes('Bundeshaus West'), 'matches bbl_id without slashes');

section('Edge cases');
check(find('').length === 0, 'an empty query returns nothing');
check(find('   ').length === 0, 'a whitespace-only query returns nothing');
check(find('!!!').length === 0, 'a punctuation-only query returns nothing');
check(tokenize('Störung, Raum').length === 2, 'punctuation separates terms');
check(prepare({ title: 'x' })._d.text === '', 'a missing description does not throw');

console.log(failures ? `\n✗ ${failures} check(s) FAILED` : '\n✓ all checks passed');
process.exit(failures ? 1 : 0);
