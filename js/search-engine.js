// Suchlogik als reine Funktionen — bewusst getrennt von der Ergebnisseite,
// damit sie ohne Browser prüfbar ist (scripts/test-search.mjs) und andere
// Ansichten dieselbe Normalisierung übernehmen können.
//
// Kein Volltext-Index (Lunr/FlexSearch): bei ~380 Einträgen bringt er nichts,
// was die vier Regeln unten nicht auch liefern, und er widerspricht der
// Nulldependenz-Linie des Projekts.

/* ------------------------------------------------------------------ Falten */
// Auf Schweizer Tastaturen sind «oe/ae/ue» verbreitet, und wer aus einer Mail
// kopiert, bekommt oft die Umschreibung. Vorher fand «stoerung» NULL Treffer,
// «störung» zwei — dieselbe Absicht, zwei Ergebnisse (docs/search-review.md B2).
// Gefaltet wird auf BEIDEN Seiten: Anfrage und Heuhaufen.
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

/* ------------------------------------------------------------ Umgangssprache */
// Was Nutzende TIPPEN → was im Bestand STEHT. Nur echte Umgangssprache; das
// Fachvokabular kommt aus den Daten selbst (siehe `extra` in den Indexzeilen),
// weil eine handgepflegte Liste unweigerlich driftet.
// Schlüssel und Werte sind bereits gefaltet — sie werden nicht durch fold()
// geschickt, sondern direkt verglichen.
export const COLLOQUIAL = {
  // Haustechnik und Defekte → Störungsmeldung
  heizung: ['stoerung', 'reparatur'], lueftung: ['stoerung'], klima: ['stoerung'],
  kaputt: ['stoerung', 'reparatur'], defekt: ['stoerung', 'reparatur'],
  lampe: ['stoerung', 'reparatur'], licht: ['stoerung'], strom: ['stoerung'],
  wasserhahn: ['stoerung', 'reparatur'], wc: ['stoerung', 'reinigung'],
  toilette: ['stoerung', 'reinigung'], fenster: ['stoerung'], tuere: ['stoerung'],
  aufzug: ['stoerung'], lift: ['stoerung'], schimmel: ['stoerung'],
  dreckig: ['reinigung'], schmutz: ['reinigung'], putzen: ['reinigung'],
  // Arbeitsplatz und Buchung
  sitzungszimmer: ['buchung'], sitzungsraum: ['buchung'], besprechungsraum: ['buchung'],
  desk: ['arbeitsplatz'], homeoffice: ['arbeitsplatz'],
  // Beschaffung und Vergabe
  ausschreibung: ['beschaffung', 'verfahren'], submission: ['beschaffung'],
  vergabe: ['beschaffung', 'verfahren'], offerte: ['beschaffung'],
  schwellenwert: ['ueberschwellige'], wto: ['verfahren'],
  agb: ['geschaeftsbedingungen'], vertragsbedingungen: ['geschaeftsbedingungen'],
  // Eng halten: ein Rückfallwert, der im Bestand hundertfach vorkommt, macht aus
  // «keine Treffer» eine Trefferflut. `boeb`/`voeb` zeigen auf die Erlasse, nicht
  // auf alles mit «Beschaffung» darin.
  beschaffungsrecht: ['boeb', 'voeb'], vergaberecht: ['boeb', 'voeb'],
  einkauf: ['bestellen'],
  // Vorlagen und Unterlagen
  muster: ['mustervorlage', 'vorlage'], template: ['mustervorlage', 'vorlage'],
  formular: ['formulare', 'auftrag'], checkliste: ['werkzeugkasten'],
  weisung: ['weisungen', 'vorgaben'], richtlinie: ['weisungen', 'vorgaben'],
  // Informatik
  wlan: ['informatik', 'ikt'], netzwerk: ['informatik', 'ikt'],
  laptop: ['informatik', 'hardware'], notebook: ['informatik', 'hardware'],
  computer: ['informatik', 'hardware'], drucker: ['buerotechnik', 'informatik'],
  bildschirm: ['hardware', 'informatik'], software: ['informatik'],
  // Material und Mobiliar
  moebel: ['mobiliar'], stuhl: ['mobiliar'], buerostuhl: ['mobiliar'],
  tisch: ['mobiliar'], schrank: ['mobiliar'], material: ['bestellen', 'bueromaterial'],
  schluessel: ['mobiliarschluessel', 'zugang'],
  // Zugang
  badge: ['zugang', 'berechtigung'], zutritt: ['zugang', 'berechtigung'],
  passwort: ['zugang', 'berechtigung'], login: ['zugang', 'berechtigung'],
  // Pläne und Dokumente
  plan: ['grundriss', 'bautendokumentation'], plaene: ['grundriss', 'bautendokumentation'],
  grundriss: ['bautendokumentation'], bauplan: ['bautendokumentation'],
  // Preise
  preis: ['preisliste', 'leistungsverrechnung'], kosten: ['leistungsverrechnung', 'preisliste'],
  tarif: ['preisliste'], rechnung: ['leistungsverrechnung'],
};

/* --------------------------------------------------------------- Stammform */
// Leichtes Stemming für Deutsch: nur Flexionsendungen abschneiden, keine
// Wortbildung. Es ist die kleinste Massnahme, die «buchen» und «Buchung»,
// «melden» und «Meldung», «beschaffen» und «Beschaffung» zusammenführt (B7) —
// und weil BEIDE Seiten gestemmt werden, muss die Regel nicht korrekt sein,
// sondern nur konsistent.
//
// Die Längenschwelle (Rest ≥ 4 Zeichen) verhindert das Zerlegen kurzer Wörter:
// «bern» behält sein n, «haus» sein s.
const SUFFIXES = ['ungen', 'ung', 'eren', 'ern', 'end', 'en', 'er', 'es', 'em', 'n', 's', 'e'];
export function stem(w) {
  for (const s of SUFFIXES) {
    if (w.length - s.length >= 4 && w.endsWith(s)) return w.slice(0, -s.length);
  }
  return w;
}

/* ------------------------------------------------------------- Zerlegen */
// Die Anfrage wird in Begriffe zerlegt, die ALLE treffen müssen (UND). Vorher
// wurde die ganze Anfrage als eine Zeichenkette gesucht — «raum buchen» fand
// deshalb nichts, obwohl es die Dienstleistung «Raum buchen» gibt (B3).
export function tokenize(q) {
  const seen = new Set();
  const out = [];
  for (const raw of fold(q).split(/[^a-z0-9]+/)) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    // `variants` beginnt beim Begriff selbst; die Umgangssprache kommt erst in
    // search() dazu, und nur als Rückfallebene (siehe dort).
    out.push({ term: raw, syn: COLLOQUIAL[raw] || [], variants: [raw] });
  }
  return out;
}

/* -------------------------------------------------------------- Bewerten */
// Ein Begriff trifft ein WORT des Feldes auf drei Arten, unterschiedlich viel
// wert — nie mehr das ganze Feld als Zeichenkette:
//   1. das Wort IST der Begriff                  → stärkstes Signal
//   2. das Wort BEGINNT mit ihm                  → «stoerung» → «stoerungsmeldung»
//   3. das Wort ENDET mit ihm (Kompositum-Kopf)  → «parkplatzbuchung» → «buchung»
//
// Was hier bewusst FEHLT, ist die frühere Regel «Begriff steht irgendwo im
// Feld». Genau sie erzeugte die Falschtreffer: «bern» traf über «übernimmt»,
// «is» lieferte 61 % des Index (B5). Deutsche Komposita setzen den Kopf ans
// Ende — Regel 3 holt den nützlichen Teil zurück, ohne die Wortmitte zu öffnen.
// Regel 3 verlangt vier Zeichen, damit kurze Silben nicht jedes Kompositum treffen.
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
    if (best === exactW) break;   // besser wird es in diesem Feld nicht
  }
  return best;
}

const asField = (s) => {
  const text = fold(s);
  const words = text.split(/[^a-z0-9]+/).filter(Boolean);
  return { text, words, stems: words.map(stem) };
};

// Eine Indexzeile vorbereiten. `extra` ist durchsuchbar, aber nie sichtbar —
// dort landet das Fachvokabular aus den Daten (Domänenlabel, Voraussetzungen,
// Schlagwörter, Abschnittstitel, Dateiformate). Das ersetzt eine gepflegte
// Synonymtabelle: «Bestellformular für Dekorationen» macht `dekoration`
// findbar, ohne dass jemand ein Wortpaar nachträgt (B8).
export function prepare(entry) {
  return {
    ...entry,
    _t: asField(entry.title),
    _d: asField(entry.desc || ''),
    _x: asField(entry.extra || ''),
  };
}

// Bester Feldwert EINES Begriffs in einer Zeile — 0 heisst «kommt nicht vor».
function bestField(row, variants) {
  return Math.max(
    fieldScore(row._t, variants, W.titleExact, W.titlePrefix, W.titleTail),
    fieldScore(row._x, variants, W.extraExact, W.extraPrefix, W.extraTail),
    fieldScore(row._d, variants, W.descExact, W.descPrefix, W.descTail),
  );
}

// UMGANGSSPRACHE ZÄHLT WENIGER ALS DAS ECHTE WORT.
// Wer «wto» tippt, meint das WTO-Planungstool — nicht alles, was mit dem
// Verfahren zu tun hat. Beides erscheint, aber der wörtliche Treffer steht oben:
// die Alltagsentsprechung greift nur, wenn der Begriff selbst in DIESER Zeile
// fehlt, und dann mit knapp der halben Punktzahl. Ohne diese Abstufung lieferten
// «wto» und «beschaffungsrecht» je 87 Treffer — technisch richtig, praktisch
// unbrauchbar; mit einer harten Rückfallebene verlor umgekehrt «heizung» die
// Störungsmeldung, sobald irgendein Datensatz das Wort wörtlich führte.
const SYN_FAKTOR = 0.45;
export function tokenScore(row, tk) {
  const direkt = bestField(row, tk.variants);
  if (direkt) return direkt;
  if (!tk.syn || !tk.syn.length) return 0;
  return bestField(row, tk.syn) * SYN_FAKTOR;
}

// Punktzahl einer vorbereiteten Zeile für eine zerlegte Anfrage.
// Rückgabe 0 = kein Treffer (mindestens ein Begriff fehlt vollständig).
export function score(row, tokens, phrase) {
  if (!tokens.length) return 0;
  let sum = 0;
  for (const tk of tokens) {
    const s = tokenScore(row, tk);
    if (!s) return 0;              // UND: ein fehlender Begriff schliesst aus
    sum += s;
  }
  // Wortfolge im Titel ist ein starkes Signal: «umzug anmelden» soll den
  // gleichnamigen Dienst schlagen, nicht bloss mit ihm gleichziehen.
  if (phrase && phrase.length >= 3 && row._t.text.includes(phrase)) sum += 50;
  // Startbare Vorgänge vor Nachschlagewerken, und häufig Gebrauchtes zuerst —
  // beides kleine Ausschläge, die nur bei Gleichstand entscheiden.
  return sum + (row.boost || 0);
}

// Vollständige Suche über vorbereitete Zeilen. Stabil sortiert: gleiche
// Punktzahl behält die Eingangsreihenfolge (= Relevanzordnung der Bestände).
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
