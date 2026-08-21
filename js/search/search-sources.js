// Which content kinds the search looks at, and whether it may answer.
//
// NOT THE SAME THING AS THE FACETS, although they look related. They differ in
// the property that is hardest to change afterwards — their lifetime:
//
//                   Facets (results page)        Sources (this module)
//   Reach           narrow ONE result list       decide what is searched AT ALL
//   Lifetime        this query                   permanent, per device
//   Numbers         result counts                none (see below)
//   In the address  YES, shareable               NO
//
// The last row is a decision, not an omission. Passing on a result link passes
// on the narrowing with it — right for a facet, wrong for a personal setting.
// Otherwise the recipient silently inherits that somebody else did not want to
// see properties.
//
// NO CORPUS COUNTS in the selection panel. German UI: a row reading «Wissen und
// Hilfsmittel (148)» is true of the demo data and would be either wrong or an aggregate query on a
// real database — one that would run every time the panel opens. Where a number
// genuinely says something it is still there: above the result list, measured at
// query time, where it cannot go stale.
//
// WHAT IS STORED IS WHAT IS OFF, not what is on. A kind added to the index later
// is therefore on by default. The other way round, every new kind would be
// silently invisible to every existing device — and precisely for the people who
// ever touched this setting.
//
// AN EMPTY SELECTION MEANS NO RESTRICTION. Locking the last remaining kind made
// the commonest wish expensive: «show me only services» cost ten clicks, because
// everything else had to be cleared one at a time. Now everything can be cleared
// and one kind ticked, and the intermediate state is not broken — nothing
// selected means everything is searched. That is the same convention the facet
// panel already uses (`!selected.length || selected.includes(...)`), and the line
// beside the field says so out loud rather than leaving people to infer it.

import { readJSON, writeJSON } from '../core/storage.js';
import { KINDS } from './search-kinds.js';

const LS_KEY = 'bbl_search_sources_v1';

// The generated answer is a result too. It belongs in the same selection as the
// content kinds — not because it is one (it is produced, not searched) but
// because the question is the same: what may appear in my results? Two lists for
// one question would be two places to look. In the panel it sits below them,
// set apart.
export const ANSWERS = 'answers';

const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
const KEYS = new Set([...KINDS, ANSWERS]);

let off = new Set((readJSON(LS_KEY, [], isStringArray) || []).filter((key) => KEYS.has(key)));

const listeners = new Set();
const persist = () => writeJSON(LS_KEY, [...off]);
const notify = () => listeners.forEach((fn) => fn());

export const isOn = (key) => !off.has(key);
export const offKinds = () => KINDS.filter((kind) => off.has(kind));
export const onKinds = () => KINDS.filter((kind) => !off.has(kind));
export const noneSelected = () => onKinds().length === 0;
export const allSelected = () => KINDS.every((kind) => !off.has(kind));

/** May the answer block appear? A separate question from the content kinds. */
export const answersAllowed = () => isOn(ANSWERS);

export function toggle(key) {
  if (!KEYS.has(key)) return;
  if (off.has(key)) off.delete(key);
  else off.add(key);
  persist();
  notify();
}

/**
 * The two jumps to the ends. They sit SIDE BY SIDE rather than as one switching
 * button: with a partial selection a switch would have to guess which end was
 * meant, and the other direction would only be reachable by a detour.
 *
 * Both touch the content kinds ONLY, never the answer. Isolating one kind does
 * not mean also wanting to lose the answers — which is why the answer sits below
 * the rule these two buttons stand on.
 */
export function selectAllKinds() {
  const before = off.size;
  KINDS.forEach((kind) => off.delete(kind));
  if (off.size === before) return;
  persist();
  notify();
}

export function clearAllKinds() {
  if (KINDS.every((kind) => off.has(kind))) return;
  KINDS.forEach((kind) => off.add(kind));
  persist();
  notify();
}

/**
 * The active selection as a Set — or `null` when NOTHING is filtered. `null`
 * rather than «every kind» is deliberate: a caller should not have to tell the
 * unfiltered case apart from a filter that happens to let everything through.
 *
 * Two paths lead to `null`: everything ticked, or nothing ticked. The second is
 * the intermediate step of «clear all, then pick one» and must not produce an
 * empty result list.
 */
export function activeKinds() {
  const on = onKinds();
  if (!on.length || on.length === KINDS.length) return null;
  return new Set(on);
}

/**
 * The ONE call every search path shares — suggestions, results, answer. Applied
 * in a single place, an answer can never cite a kind somebody switched off.
 *
 * It filters BEFORE the search, not after: on a real database this becomes a
 * WHERE clause. Searching first and discarding afterwards would mean fetching
 * the full set in order to shrink it.
 */
export function filterRows(rows) {
  const active = activeKinds();
  return active ? rows.filter((row) => active.has(row.kind)) : rows;
}

/** Short form for the diagnostic log: «8/11», or '' when unfiltered. */
export function ratio() {
  const active = activeKinds();
  return active ? `${active.size}/${KINDS.length}` : '';
}

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Test seam: drop the in-memory selection so a suite can start from a known state. */
export function reset() {
  off = new Set();
  persist();
  notify();
}
