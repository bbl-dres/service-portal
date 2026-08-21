// The answer above the results — SIMULATED, NOT GENERATED.
//
// There is no model call and no key. This assembles the answer deterministically
// from the description texts of the records that were actually found: every
// sentence comes from exactly one record and carries its citation.
//
// That is not a stopgap, it is the proof of the point. This exact property — no
// sentence without a citation — is what a renderer has to ENFORCE later instead
// of trusting a prompt to honour it. What is impossible here must be made
// impossible there. What is demonstrated is the FORM, not the answer quality;
// the badge on the block says so.
//
// The trigger lives in js/search/query-resolve.js: only a question gets here, so
// only a question would cost a model call later.

import { search } from './search-engine.js';
import { resolve } from './query-resolve.js';
import { filterRows } from './search-sources.js';

const MAX_CITED = 3;
const MAX_RESULTS = 20;

/**
 * Run every planned query, union the results, de-duplicate by href.
 *
 * `tier` records which planning step a result came from: 0 is the full keyword
 * query, anything above it a fallback. The RESULT LIST counts all of them; the
 * CITATIONS of an answer count only the best tier — otherwise a single-word
 * fallback drags in anything related and the answer talks about something other
 * than the question.
 */
export function retrieve(raw, rows) {
  const plan = resolve(raw);
  // Filtered BEFORE searching, with the same call every other path uses. An
  // answer citing a kind somebody explicitly switched off would be the most
  // unpleasant way to reveal the setting: neatly sourced and unasked for.
  const pool = filterRows(rows);
  const seen = new Set();
  const hits = [];
  plan.queries.forEach((query, tier) => {
    if (hits.length >= MAX_RESULTS) return;
    const wordCount = query.split(' ').length;
    for (const row of search(pool, query)) {
      if (seen.has(row.href)) continue;
      seen.add(row.href);
      hits.push({ ...row, _tier: tier, _queryWords: wordCount });
      if (hits.length >= MAX_RESULTS) break;
    }
  });

  // THE RELEVANCE GATE. A single-word fallback ALWAYS finds something: with one
  // term the AND no longer bites. «Wie viele Ferientage stehen mir zu?» produced
  // a neatly sourced answer about rental properties through it — the most
  // dangerous mistake this component can make, because it reads as correct. Only
  // what came from a MULTI-WORD query may count; otherwise the retriever did not
  // understand the question and the answer is withheld.
  const minWords = plan.keywords.length >= 2 ? 2 : 1;
  const strong = hits.filter((hit) => hit._queryWords >= minWords);
  return { plan, hits, strong };
}

/**
 * Do two texts say the same thing? A portal workflow often copies the
 * description of its service verbatim; two sentences with the same content and
 * two different citations read as two statements but are one.
 */
function saysTheSame(a, b) {
  const terms = (value) => new Set(String(value || '').toLowerCase()
    .split(/[^a-zäöüß0-9]+/i).filter((word) => word.length > 3));
  const first = terms(a);
  const second = terms(b);
  if (!first.size || !second.size) return false;
  let common = 0;
  for (const word of first) if (second.has(word)) common++;
  return common / Math.min(first.size, second.size) >= 0.6;
}

/** One sentence ends with exactly one full stop. */
const sentence = (value) => {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
};

/**
 * Build the answer.
 *
 *   { state: 'answer', parts: [{ text, cite }], sources: [{ n, title, type, meta, href }], plan, hits, strong }
 *   { state: 'none', plan, hits, strong }
 *
 * `cite` is always a number — a part without one is never produced here, and the
 * renderer checks again anyway. Two independent guards, because this is the one
 * property the whole component exists to demonstrate.
 */
export function build(raw, rows) {
  const { plan, hits, strong } = retrieve(raw, rows);
  if (!plan.keywords.length || !strong.length) return { state: 'none', plan, hits, strong };

  // Cite only from the best planning tier that found anything. Then: the best
  // result, up to two more from OTHER kinds, and none that says what an already
  // chosen one says.
  const bestTier = Math.min(...strong.map((hit) => hit._tier ?? 0));
  const candidates = strong
    .filter((hit) => (hit._tier ?? 0) === bestTier)
    // A record without prose cannot carry a sentence; as a source it would sit
    // in the list with no citation pointing at it.
    .filter((hit) => hit.answerText);
  const sources = [];
  const kinds = new Set();
  for (const hit of candidates) {
    if (sources.length >= MAX_CITED) break;
    if (sources.length && kinds.has(hit.kind)) continue;
    if (sources.some((source) => saysTheSame(source.answerText, hit.answerText))) continue;
    kinds.add(hit.kind);
    sources.push(hit);
  }
  if (!sources.length) return { state: 'none', plan, hits, strong };

  const parts = [];
  const cite = (row) => sources.indexOf(row) + 1;
  const first = sources[0];
  parts.push({ text: sentence(first.answerText), cite: cite(first) });
  // Prerequisites are what somebody has to know BEFORE starting — the most
  // useful second line a service can offer.
  if (Array.isArray(first.requires) && first.requires.length) {
    parts.push({ text: sentence(`Bereit halten müssen Sie ${first.requires.join(', ')}`), cite: cite(first) });
  }
  for (const source of sources.slice(1)) {
    parts.push({ text: sentence(source.answerText), cite: cite(source) });
  }

  return {
    state: 'answer',
    plan,
    hits,
    strong,
    parts,
    sources: sources.map((row, index) => ({
      n: index + 1, title: row.title, type: row.type, meta: row.meta || '', href: row.href,
    })),
  };
}
