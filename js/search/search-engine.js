// Search logic as pure functions, deliberately separated from the results page
// so it can be tested without a browser (scripts/test-search.mjs) and other
// views can use the same normalisation.
//
// No full-text index (Lunr/FlexSearch): at ~380 entries it adds nothing the four
// rules below cannot provide and conflicts with the project's zero-dependency
// direction.

/* ---------------------------------------------------------------- Folding */
// «oe/ae/ue» are common on Swiss keyboards and often appear in copied email
// text. Previously, the ASCII spelling found ZERO results while the accented spelling found two:
// the same intent produced two outcomes (docs/search-review.md B2). Both sides
// are folded: query and haystack.
const FOLD = [
  [/ä/g, 'ae'], [/ö/g, 'oe'], [/ü/g, 'ue'], [/ß/g, 'ss'],
  [/[àáâãå]/g, 'a'], [/[èéêë]/g, 'e'], [/[ìíîï]/g, 'i'],
  [/[òóôõ]/g, 'o'], [/[ùúû]/g, 'u'], [/ç/g, 'c'], [/ñ/g, 'n'],
];
export function fold(s) {
  let x = String(s == null ? '' : s).toLowerCase();
  for (const [re, to] of FOLD) x = x.replace(re, to);
  return x;
}

/* ------------------------------------------------------- Colloquial terms */
// What users TYPE → what the dataset CONTAINS. Only genuinely colloquial terms
// belong here. Domain vocabulary comes from the data itself (see `extra` on
// index rows), because a hand-maintained list inevitably drifts. Keys and values
// are already folded; they are compared directly rather than passed to fold().
const COLLOQUIAL = {
  // Building services and defects → fault report
  'heizung': ['stoerung', 'reparatur'], 'lueftung': ['stoerung'], 'klima': ['stoerung'],
  'kaputt': ['stoerung', 'reparatur'], 'defekt': ['stoerung', 'reparatur'],
  'lampe': ['stoerung', 'reparatur'], 'licht': ['stoerung'], 'strom': ['stoerung'],
  'wasserhahn': ['stoerung', 'reparatur'], 'wc': ['stoerung', 'reinigung'],
  'toilette': ['stoerung', 'reinigung'], 'fenster': ['stoerung'], 'tuere': ['stoerung'],
  'aufzug': ['stoerung'], 'lift': ['stoerung'], 'schimmel': ['stoerung'],
  'dreckig': ['reinigung'], 'schmutz': ['reinigung'], 'putzen': ['reinigung'],
  // Workplace and booking
  'sitzungszimmer': ['buchung'], 'sitzungsraum': ['buchung'], 'besprechungsraum': ['buchung'],
  'desk': ['arbeitsplatz'], 'homeoffice': ['arbeitsplatz'],
  // Procurement and awarding
  'ausschreibung': ['beschaffung', 'verfahren'], 'submission': ['beschaffung'],
  'vergabe': ['beschaffung', 'verfahren'], 'offerte': ['beschaffung'],
  'schwellenwert': ['ueberschwellige'], 'wto': ['verfahren'],
  'agb': ['geschaeftsbedingungen'], 'vertragsbedingungen': ['geschaeftsbedingungen'],
  // Keep this narrow: a fallback value occurring hundreds of times turns «no
  // results» into a flood. `boeb` / `voeb` point to the statutes, not everything
  // containing «Beschaffung».
  'beschaffungsrecht': ['boeb', 'voeb'], 'vergaberecht': ['boeb', 'voeb'],
  'einkauf': ['bestellen'],
  // Templates and documents
  'muster': ['mustervorlage', 'vorlage'], 'template': ['mustervorlage', 'vorlage'],
  'formular': ['formulare', 'auftrag'], 'checkliste': ['werkzeugkasten'],
  'weisung': ['weisungen', 'vorgaben'], 'richtlinie': ['weisungen', 'vorgaben'],
  // IT
  'wlan': ['informatik', 'ikt'], 'netzwerk': ['informatik', 'ikt'],
  'laptop': ['informatik', 'hardware'], 'notebook': ['informatik', 'hardware'],
  'computer': ['informatik', 'hardware'], 'drucker': ['buerotechnik', 'informatik'],
  'bildschirm': ['hardware', 'informatik'], 'software': ['informatik'],
  // Materials and furniture
  'moebel': ['mobiliar'], 'stuhl': ['mobiliar'], 'buerostuhl': ['mobiliar'],
  'tisch': ['mobiliar'], 'schrank': ['mobiliar'], 'material': ['bestellen', 'bueromaterial'],
  'schluessel': ['mobiliarschluessel', 'zugang'],
  // Access
  'badge': ['zugang', 'berechtigung'], 'zutritt': ['zugang', 'berechtigung'],
  'passwort': ['zugang', 'berechtigung'], 'login': ['zugang', 'berechtigung'],
  // Plans and documents
  'plan': ['grundriss', 'bautendokumentation'], 'plaene': ['grundriss', 'bautendokumentation'],
  'grundriss': ['bautendokumentation'], 'bauplan': ['bautendokumentation'],
  // Prices
  'preis': ['preisliste', 'leistungsverrechnung'], 'kosten': ['leistungsverrechnung', 'preisliste'],
  'tarif': ['preisliste'], 'rechnung': ['leistungsverrechnung'],
};

/* ---------------------------------------------------------------- Stemming */
// Lightweight German stemming: remove only inflectional endings, not word-
// formation suffixes. This is the smallest measure that connects «buchen» with
// «Buchung», «melden» with «Meldung», and «beschaffen» with «Beschaffung» (B7).
// Because BOTH sides are stemmed, the rule need only be consistent, not
// linguistically perfect.
//
// The length threshold (remainder ≥ 4 characters) prevents short words from
// being stripped: «bern» keeps its n and «haus» keeps its s.
const SUFFIXES = ['ungen', 'ung', 'eren', 'ern', 'end', 'en', 'er', 'es', 'em', 'n', 's', 'e'];
function stem(w) {
  for (const s of SUFFIXES) {
    if (w.length - s.length >= 4 && w.endsWith(s)) return w.slice(0, -s.length);
  }
  return w;
}

/* -------------------------------------------------------------- Tokenising */
// The query is split into terms that must ALL match (AND). Previously the whole
// query was searched as one string, so «raum buchen» found nothing even though
// the «Raum buchen» service exists (B3).
export function tokenize(q) {
  const seen = new Set();
  const out = [];
  for (const raw of fold(q).split(/[^a-z0-9]+/)) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    // `variants` begins with the term itself. Colloquial terms are considered
    // only as a fallback in search() (see there).
    out.push({ term: raw, syn: COLLOQUIAL[raw] || [], variants: [raw] });
  }
  return out;
}

/* ---------------------------------------------------------------- Scoring */
// A term matches a WORD in the field in three differently weighted ways; the
// whole field is never searched as one string:
//   1. the word IS the term                         → strongest signal
//   2. the word STARTS with the term                → «stoerung» → «stoerungsmeldung»
//   3. the word ENDS with it (compound head)        → «parkplatzbuchung» → «buchung»
//
// Deliberately absent is the former «term appears anywhere in the field» rule.
// It caused false positives: a city name matched inside an unrelated verb, while a short fragment
// returned 61% of the index (B5). German compounds put the head at the end, so
// rule 3 recovers the useful part without opening the middle of a word. It
// requires four characters to prevent short syllables matching every compound.
const W = {
  titleExact: 100, titlePrefix: 60, titleTail: 45,
  extraExact: 30, extraPrefix: 22, extraTail: 16,
  descExact: 20, descPrefix: 15, descTail: 10,
};

function fieldScore(field, variants, exactW, prefixW, tailW) {
  if (!field) return 0;
  let best = 0;
  for (const v of variants) {
    const vs = stem(v);
    for (let i = 0; i < field.words.length; i++) {
      const w = field.words[i], ws = field.stems[i];
      if (w === v || ws === vs) { best = Math.max(best, exactW); continue; }
      if (w.startsWith(v) || ws.startsWith(vs)) { best = Math.max(best, prefixW); continue; }
      if (vs.length >= 4 && ws.endsWith(vs)) best = Math.max(best, tailW);
    }
    if (best === exactW) break;   // This field cannot score any higher.
  }
  return best;
}

const asField = (s) => {
  const text = fold(s);
  const words = text.split(/[^a-z0-9]+/).filter(Boolean);
  return { text, words, stems: words.map(stem) };
};

// Prepare an index row. `extra` is searchable but never visible; it carries
// domain vocabulary from the data (domain labels, prerequisites, keywords,
// section headings and file formats). This replaces a maintained synonym table:
// A specific order-form title makes its subject findable without anyone
// adding a word pair (B8).
export function prepare(entry) {
  return {
    ...entry,
    _t: asField(entry.title),
    _d: asField(entry.desc || ''),
    _x: asField(entry.extra || ''),
  };
}

// Best field score for ONE term in a row; 0 means «not present».
function bestField(row, variants) {
  return Math.max(
    fieldScore(row._t, variants, W.titleExact, W.titlePrefix, W.titleTail),
    fieldScore(row._x, variants, W.extraExact, W.extraPrefix, W.extraTail),
    fieldScore(row._d, variants, W.descExact, W.descPrefix, W.descTail),
  );
}

// COLLOQUIAL LANGUAGE SCORES LOWER THAN THE ACTUAL WORD. Someone typing «wto»
// means the WTO planning tool, not everything related to the procedure. Both
// appear, but the literal match ranks first: a colloquial equivalent applies
// only when the term itself is absent from THIS row, and then for just under
// half the score. Without this weighting, «wto» and «beschaffungsrecht» each
// returned 87 results: technically correct, practically useless. A hard fallback
// did the opposite, making «heizung» lose the fault report as soon as any record
// contained the literal word.
const SYNONYM_FACTOR = 0.45;
function tokenScore(row, token) {
  const direct = bestField(row, token.variants);
  if (direct) return direct;
  if (!token.syn || !token.syn.length) return 0;
  return bestField(row, token.syn) * SYNONYM_FACTOR;
}

// Score a prepared row against a tokenised query. A return value of 0 means no
// match (at least one term is entirely absent).
function score(row, tokens, phrase) {
  if (!tokens.length) return 0;
  let sum = 0;
  for (const token of tokens) {
    const value = tokenScore(row, token);
    if (!value) return 0;           // AND: one absent term excludes the row.
    sum += value;
  }
  // A title phrase is a strong signal: «umzug anmelden» should beat the service
  // with the same words, not merely tie with it.
  if (phrase && phrase.length >= 3 && row._t.text.includes(phrase)) sum += 50;
  // Put startable cases before reference works and common items first. Both are
  // small adjustments that decide only ties.
  return sum + (row.boost || 0);
}

// Complete search over prepared rows. Stable ordering keeps input order for
// equal scores (= source-dataset relevance order).
export function search(rows, q) {
  const tokens = tokenize(q);
  if (!tokens.length) return [];
  const phrase = fold(q).trim();

  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const s = score(rows[i], tokens, phrase);
    if (s > 0) out.push({ row: rows[i], score: s, i });
  }
  out.sort((a, b) => b.score - a.score || a.i - b.i);
  return out.map((x) => ({ ...x.row, _score: x.score }));
}
