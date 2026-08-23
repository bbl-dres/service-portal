// Frageauflösung — der Schritt VOR dem Retriever.
//
// Der gemessene Befund: js/search/search-engine.js verlangt, dass JEDER Term
// trifft («// AND: one absent term excludes the row»). «Wie melde ich eine
// defekte Heizung?» scheitert deshalb an «wie», «ich» und «eine», bevor
// «Heizung» überhaupt gewertet wird — 0 Treffer, obwohl «heizung» allein
// exakt einen liefert.
//
// Hier steht die deterministische Fassung dessen, was später ein Sprachmodell
// tut: Stoppwörter entfernen, den Rest an die unveränderte Suchmaschine geben.
// Sie ist absichtlich dumm. Genau das ist die Aussage — schon die dümmste
// Fassung dieses Schritts verwandelt 0 Treffer in brauchbare.

// Deutsche Funktionswörter. Bewusst knapp: nur Wörter ohne Fachbedeutung im
// BBL-Korpus. «Plan», «Raum» oder «Bau» dürfen hier nie auftauchen.
const STOPP = new Set([
  'wie', 'was', 'wo', 'wann', 'warum', 'wieso', 'weshalb', 'wer', 'wen', 'wem',
  'welche', 'welcher', 'welches', 'welchen', 'wohin', 'woher', 'wozu',
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'man', 'mir', 'mich', 'mein',
  'meine', 'meinen', 'meiner', 'uns', 'unser', 'unsere',
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem',
  'einer', 'eines', 'kein', 'keine',
  'und', 'oder', 'aber', 'denn', 'sondern', 'auch', 'noch', 'schon', 'nur',
  'in', 'im', 'an', 'am', 'auf', 'aus', 'bei', 'mit', 'nach', 'von', 'vom',
  'vor', 'zu', 'zum', 'zur', 'über', 'unter', 'für', 'um', 'durch', 'gegen',
  'ist', 'sind', 'war', 'waren', 'bin', 'bist', 'sein', 'hat', 'habe', 'haben',
  'hatte', 'wird', 'werden', 'wurde', 'worden',
  'kann', 'kannst', 'können', 'muss', 'müssen', 'darf', 'dürfen', 'soll',
  'sollen', 'will', 'wollen', 'möchte', 'brauche', 'brauchen',
  'nicht', 'als', 'wenn', 'dass', 'damit', 'ob', 'weil', 'sich', 'so', 'dann',
  'bitte', 'gibt', 'es', 'man', 'sowie', 'etwa', 'jetzt', 'hier', 'dort',
]);

const FRAGEWORT = /^(wie|was|wo|wann|warum|wieso|weshalb|wer|welche[rsn]?|wohin|woher|wozu|kann|muss|darf|soll|gibt|brauche|wird|ist|sind|hat|habe)\b/i;

const worte = (s) => String(s || '').toLowerCase()
  .split(/[^a-zäöüßà-ÿ0-9]+/i).filter(Boolean);

/**
 * Sieht die Eingabe nach einer Frage aus? Das ist der Auslöser: nur dann
 * entsteht später ein Modellaufruf. Eine Navigationsabfrage wie «raum buchen»
 * hat ihre perfekte Antwort schon im ersten Treffer und braucht keine.
 */
export function isQuestion(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  if (s.endsWith('?')) return true;
  if (FRAGEWORT.test(s)) return true;
  // Gezählt werden nur WÖRTER, nicht Bruchstücke. Gemessen: «TQ.21.00.00.01»
  // zerfiel in fünf Teile und galt damit als Frage — eine Prozessnummer löste
  // den Antwortbau aus, der später ein Modellaufruf ist. Ein Teil muss deshalb
  // einen Buchstaben enthalten und mindestens zwei Zeichen lang sein.
  return worte(s).filter((w) => w.length > 1 && /[a-zäöüßà-ÿ]/i.test(w)).length >= 4;
}

/**
 * Aus der Frage die Stichwörter machen, die der Retriever versteht.
 * Rückgabe: { keywords, dropped, queries } — `queries` sind die Abfragen, die
 * nacheinander an search() gehen: erst alle Stichwörter (streng, weil UND),
 * dann kürzere Kombinationen als Rückfallebene, damit ein einzelnes seltenes
 * Wort die Trefferliste nicht leert.
 */
export function plan(raw) {
  const all = worte(raw);
  const keywords = all.filter((w) => w.length > 1 && !STOPP.has(w));
  const dropped = all.filter((w) => STOPP.has(w) || w.length <= 1);

  const queries = [];
  if (keywords.length) queries.push(keywords.join(' '));
  // Rückfallebene: Paare und dann Einzelwörter. Das ahmt nach, was ein Modell
  // tut, wenn die erste Abfrage nichts bringt — es fragt enger noch einmal.
  if (keywords.length > 2) {
    for (let i = 0; i < keywords.length - 1; i++) queries.push(`${keywords[i]} ${keywords[i + 1]}`);
  }
  if (keywords.length > 1) queries.push(...keywords);

  return { keywords, dropped, queries: [...new Set(queries)] };
}
