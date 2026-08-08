// Search log: the only durable way to answer «what do people search for?».
// The search redesign had to use proxies (legacy-platform footer shortcuts,
// document volume in the export, `popular` ranks) because no telemetry exists
// (docs/search-review.md §2).
//
// DELIBERATELY SMALL: only the term and result count, only in this device's
// localStorage, with no backend, identifier or login association. This is a
// notebook rather than tracking, and it is enough for prioritisation: after two
// pilot weeks it reveals which terms lead nowhere.
//
// Available at #/search?log=1.

import { readJSON, writeJSON, remove } from '../core/storage.js';

const KEY = 'bbl.searchlog';
const MAX = 200;

// Read/write through js/core/storage.js, which exists specifically to handle
// localStorage failures (corruption, private mode, quota) ONCE. All three paths
// were previously repeated here by hand (design review B23).
const normaliseCount = (value) => Number.isFinite(value) && value >= 0
  ? Math.trunc(value)
  : null;

function normaliseEntry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.q !== 'string') return null;
  const q = value.q.trim();
  const n = normaliseCount(value.n);
  const at = normaliseCount(value.at);
  return q && n != null && at != null ? { q, n, at } : null;
}

// Corrupt or hand-edited localStorage records are an untrusted input boundary,
// just like fetched JSON. Quarantine individual bad rows so one damaged entry
// cannot turn numeric table cells into HTML or hide otherwise useful history.
const read = () => readJSON(KEY, [], Array.isArray)
  .map(normaliseEntry)
  .filter(Boolean)
  .slice(-MAX);

// Consecutive keystrokes for the same term must not create 20 rows. Repeating a
// term directly updates the last entry rather than adding another.
export function record(q, hits) {
  const term = String(q || '').trim();
  if (!term) return;
  const count = normaliseCount(hits);
  if (count == null) return;
  const log = read();
  const last = log[log.length - 1];
  if (last && last.q === term) { last.n = count; last.at = Date.now(); }
  else log.push({ q: term, n: count, at: Date.now() });
  writeJSON(KEY, log.slice(-MAX));   // Failure is acceptable for this notebook.
}

// Summary by term: frequency and latest measured result count, with zero-result
// terms first. This is the working list.
export function summary() {
  const log = read();
  const by = new Map();
  for (const e of log) {
    const k = e.q.toLowerCase();
    const cur = by.get(k) || { q: e.q, count: 0, hits: e.n, at: e.at };
    cur.count++; cur.hits = e.n; cur.at = e.at;
    by.set(k, cur);
  }
  const rows = [...by.values()].sort((a, b) =>
    (a.hits === 0 ? 0 : 1) - (b.hits === 0 ? 0 : 1) || b.count - a.count || b.at - a.at);
  return { rows, total: log.length, zero: rows.filter((r) => r.hits === 0).length };
}

export function clear() {
  remove(KEY);
}
