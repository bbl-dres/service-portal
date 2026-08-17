// Personal bookmarks use one typed-reference store behind every save control.
//
// A bookmark is a TYPED REFERENCE, `{ kind, id, addedAt }`, never a copy of the
// thing referred to. Titles and links are resolved at render time from the
// catalogues (js/ui/bookmark-kinds.js), so renaming a dataset renames it in the
// list too. Storing a snapshot would have rendered without a lookup and gone
// stale the first time a record changed.
//
// TWO SOURCES, ONE LIST. data/users.json seeds each demo person, because a
// prototype that opens with an empty favourites band demonstrates nothing. That
// file is served statically and cannot be written to, so the seed is copied into
// localStorage the first time a person is seen and localStorage is authoritative
// from then on — otherwise removing a seeded bookmark would undo itself on the
// next load.
//
// Favourites used to be device-local and anonymous (`bbl_favorites_v1`, kind →
// ids). Entries are now filed under `userId` so they belong to a person rather
// than a browser.

import { readJSON, writeJSON, remove, withStorageLock } from './storage.js';
import { session } from './session.js';
import { core } from './index.js';

const LS_KEY = 'bbl_bookmarks_v1';
// The anonymous predecessor. Read once per person and folded in, so a tester who
// starred rooms before this existed keeps them (js/apps/room-booking.js).
const LEGACY_KEY = 'bbl_favorites_v1';

// Bookmarkable kinds: those with BOTH a stable record id and an address in
// js/links.js. Documents and knowledge resources are deliberately absent — they
// are addressed by title search and by section anchor, so there is nothing
// stable to file (user decision). An unknown kind is dropped rather than stored,
// so a typo cannot accumulate junk under somebody's name.
export const KINDS = ['service', 'application', 'dataset', 'news', 'building',
  'project', 'tenancy', 'shop-product', 'process', 'room'];

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

// Shape check as everywhere else (M20): one damaged entry must not make a whole
// list unusable, and must not pass as half a bookmark either.
const isEntry = (value) => isRecord(value)
  && KINDS.includes(value.kind)
  && typeof value.id === 'string' && value.id.trim() !== '';

function clean(list) {
  const cleaned = [];
  const seen = new Set();
  for (const entry of Array.isArray(list) ? list : []) {
    if (!isEntry(entry)) continue;
    const key = JSON.stringify([entry.kind, entry.id]);
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({
      kind: entry.kind,
      id: entry.id,
      addedAt: isDate(entry.addedAt) ? entry.addedAt : '',
    });
  }
  return cleaned;
}

// `store[userId] = { seeded, items }`. `seeded` is remembered separately from
// "has items": somebody who removes every seeded bookmark must not have them
// handed back on the next visit.
let store = null;

function reload() {
  const raw = readJSON(LS_KEY, {}, isRecord) || {};
  store = Object.create(null);
  for (const [userId, entry] of Object.entries(raw)) {
    if (!isRecord(entry)) continue;
    store[userId] = { seeded: entry.seeded === true, items: clean(entry.items) };
  }
  return store;
}

function read() {
  return store || reload();
}

function bucket(userId) {
  const data = read();
  if (!hasOwn(data, userId)) data[userId] = { seeded: false, items: [] };
  return data[userId];
}

// Fold the anonymous predecessor in once, on the first read for whoever is
// signed in when it is found. Removed afterwards so it cannot be folded twice
// into a second person's list.
function absorbLegacy(target) {
  const legacy = readJSON(LEGACY_KEY, null, isRecord);
  if (!legacy) return { found: false, changed: false };
  let changed = false;
  for (const [kind, ids] of Object.entries(legacy)) {
    if (!KINDS.includes(kind) || !Array.isArray(ids)) continue;
    for (const id of ids) {
      if (typeof id !== 'string' || !id.trim()) continue;
      if (target.items.some((entry) => entry.kind === kind && entry.id === id)) continue;
      target.items.push({ kind, id, addedAt: '' });
      changed = true;
    }
  }
  return { found: true, changed };
}

// Local date, as the workspace app formats it (js/apps/workspace.js): the data
// files carry plain ISO days, not timestamps.
function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// The seed applies only once the directory is actually loaded. Room booking
// reads bookmarks without needing data/users.json, so an unseeded bucket here is
// normal rather than an error — the seed lands on the first personal surface
// that does load the file.
function seedOnce(userId, target) {
  if (target.seeded) return false;
  const record = core.user(userId);
  if (!record) return false;
  const seed = clean(record.bookmarks);
  for (const entry of seed) {
    if (target.items.some((item) => item.kind === entry.kind && item.id === entry.id)) continue;
    target.items.push(entry);
  }
  target.seeded = true;
  return true;
}

function persist() {
  return writeJSON(LS_KEY, store);
}

function currentId() {
  const user = session.user();
  return user && user.userId ? user.userId : '';
}

function prepare(userId) {
  const target = bucket(userId);
  const legacy = absorbLegacy(target);
  return { target, legacy, changed: legacy.changed || seedOnce(userId, target) };
}

// Every read runs the seed and the legacy fold first, so no caller has to know
// they exist or care in which order pages happen to be visited.
function entries() {
  const userId = currentId();
  if (!userId) return null;
  let prepared = prepare(userId);
  if (!prepared.changed && !prepared.legacy.found) return prepared.target;

  const locked = withStorageLock(LS_KEY, (owns) => {
    reload();
    prepared = prepare(userId);
    if (!prepared.changed && !prepared.legacy.found) return prepared.target;
    // The legacy key is the only durable copy until the consolidated write
    // succeeds. Keep it for a later retry when storage is temporarily blocked.
    if (owns() && persist() && prepared.legacy.found) remove(LEGACY_KEY);
    return prepared.target;
  });
  return locked.ok ? locked.value : prepared.target;
}

/** Bookmarks of the signed-in person, oldest first. Empty when signed out. */
function list() {
  const target = entries();
  return target ? target.items.map((entry) => ({ ...entry })) : [];
}

// Return one bookmark kind as bare identifiers for compact membership indexes.
function listKind(kind) {
  return list().filter((entry) => entry.kind === kind).map((entry) => entry.id);
}

function has(kind, id) {
  const key = String(id ?? '');
  if (!key) return false;
  return list().some((entry) => entry.kind === kind && entry.id === key);
}

/**
 * Save or remove, returning the new state (true = saved), or null when the
 * durable write fails. Signed out there is nobody to save for, so this is a
 * no-op rather than a write into a shared bucket; controls are hidden then.
 */
function toggle(kind, id) {
  const key = String(id ?? '');
  if (!key || !KINDS.includes(kind)) return false;
  const userId = currentId();
  if (!userId) return false;
  const locked = withStorageLock(LS_KEY, (owns) => {
    // Another tab may have written since this module populated its cache.
    // Reload under the lease so this mutation cannot erase that work.
    reload();
    const { target, legacy } = prepare(userId);
    const at = target.items.findIndex((entry) => entry.kind === kind && entry.id === key);
    if (at >= 0) target.items.splice(at, 1);
    else target.items.push({ kind, id: key, addedAt: today() });
    if (!owns() || !persist()) {
      reload();
      return null;
    }
    if (legacy.found) remove(LEGACY_KEY);
    return at < 0;
  });
  if (!locked.ok) {
    store = null;
    return null;
  }
  return locked.value;
}

/** Test seam: drop the cached read so a changed session or storage is re-read. */
function reset() {
  store = null;
}

// Browser tabs receive storage events for writes made by their peers. Clear the
// read cache so passive views also observe the next durable snapshot.
if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('storage', (event) => {
    if (event.key === LS_KEY || event.key === LEGACY_KEY) store = null;
  });
}

export const bookmarks = { list, listKind, has, toggle, reset, KINDS };
