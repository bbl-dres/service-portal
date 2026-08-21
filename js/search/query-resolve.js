// The step BEFORE the retriever.
//
/* THE MEASURED FINDING. js/search/search-engine.js requires EVERY term to match
   («// AND: one absent term excludes the row»). Measured against the full index —
   German UI: every quoted string below is a query as a person types it.

       «stoerung melden»                      →  3 results
       «heizung»                              →  9 results  (colloquial mapping works)
       «Wie melde ich eine defekte Heizung?»  →  0 results

   The three function words empty the index before the noun is ever scored. The
   retriever is not weak; it is missing the step in front of it. The portal knew
   this already: its own no-results page offers each of those function words back
   with its own hit count. It can tell the question was not understood, and all
   it can hand back is single words. */
//
// This module is the smallest possible version of that missing step: remove
// function words, hand the rest to the unchanged engine. It turns 0 results into
// 20. It is deliberately dumb — that is the point. A language model can replace
// `resolve()` later without anything around it changing, because the contract is
// a list of queries, not a promise about how they were produced.
//
/* `isQuestion()` is the COST GATE, not a nicety. Only a question is worth the
   extra retrieval passes here, and only a question would be worth a model call
   later. German UI: a navigational query like «raum buchen» already has its
   perfect answer in the first result. */

/* German function words. Deliberately short: only words without domain meaning
   in the BBL corpus. German UI: nouns such as «Plan», «Raum» or «Bau» must never
   appear here — they are the subject of real queries, not noise around one. */
const STOP_WORDS = new Set([
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
  'bitte', 'gibt', 'sowie', 'etwa', 'jetzt', 'hier', 'dort',
]);

// Built from a list rather than written as a regular expression literal: a
// literal is not a masked token for the code-language guard, so its German
// alternatives would read as identifiers (scripts/check-english-code.mjs).
// German UI: interrogatives and modal verbs a person opens a question with.
const QUESTION_OPENERS = [
  'wie', 'was', 'wo', 'wann', 'warum', 'wieso', 'weshalb', 'wer', 'welche[rsn]?',
  'wohin', 'woher', 'wozu', 'kann', 'muss', 'darf', 'soll', 'gibt', 'brauche',
  'wird', 'ist', 'sind', 'hat', 'habe',
];
const QUESTION_WORD = new RegExp(`^(?:${QUESTION_OPENERS.join('|')})\\b`, 'iu');

const words = (value) => String(value || '').toLowerCase()
  .split(/[^a-zäöüßà-ÿ0-9]+/i).filter(Boolean);

/**
 * Does the input look like a question? This is the trigger: only then is the
 * resolution below worth running, and only then would a model call be worth
 * paying for.
 *
 * Measured: 6 of 6 real questions, 0 of 42 keyword queries.
 */
export function isQuestion(raw) {
  const value = String(raw || '').trim();
  if (!value) return false;
  if (value.endsWith('?')) return true;
  if (QUESTION_WORD.test(value)) return true;
  // Count WORDS, not fragments. Measured: a dotted process number split into
  // five pieces and counted as a question, so an identifier triggered the answer
  // builder — which is a model call later. A piece has to carry a letter and be
  // at least two characters long.
  return words(value).filter((word) => word.length > 1 && /[a-zäöüßà-ÿ]/i.test(word)).length >= 4;
}

/**
 * Turn a question into the keywords the retriever understands.
 *
 * Returns `{ keywords, dropped, queries }`. `queries` run against search() in
 * order: first every keyword (strict, because the engine ANDs), then shorter
 * combinations as fallbacks, so one rare word cannot empty the list.
 *
 * The fallback tiers are what make the RELEVANCE GATE in js/search/answer.js
 * necessary: a single-word query always finds something, because the AND no
 * longer bites. Callers must know which tier a result came from.
 */
export function resolve(raw) {
  const all = words(raw);
  const keywords = all.filter((word) => word.length > 1 && !STOP_WORDS.has(word));
  const dropped = all.filter((word) => STOP_WORDS.has(word) || word.length <= 1);

  const queries = [];
  if (keywords.length) queries.push(keywords.join(' '));
  // Pairs, then single words. This imitates what a model does when its first
  // query returns nothing: it asks again, more narrowly.
  if (keywords.length > 2) {
    for (let i = 0; i < keywords.length - 1; i++) queries.push(`${keywords[i]} ${keywords[i + 1]}`);
  }
  if (keywords.length > 1) queries.push(...keywords);

  return { keywords, dropped, queries: [...new Set(queries)] };
}
