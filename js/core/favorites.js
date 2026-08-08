// Personal favourite locations and rooms.
//
// Room booking is repetitive: the same person books the same location week
// after week, often the same room. Without favourites, every booking restarts
// from the prototype's initial choice, making the common case as expensive as
// the rare one. Store only what can prefill the next search — identifiers, not
// copies of the objects themselves.
//
// Deliberately device-local (localStorage) and not tied to a person: the
// prototype has no user storage, and a favourite is not a case. If writing
// fails (quota, blocked storage), the choice remains effective for this session
// and is lost on reload. Unlike losing a case, that is acceptable, so no error
// banner is needed here (see code-review C1).

import { readJSON, writeJSON } from './storage.js';

const LS_KEY = 'bbl_favorites_v1';

// Validate shape as everywhere else (M20): a damaged entry must not pass as a
// partly usable list. Expected shape: { <kind>: [<identifier>, …] }.
const isMap = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clean = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

let store = null;

function read() {
  if (store) return store;
  const raw = readJSON(LS_KEY, {}, isMap) || {};
  store = Object.create(null);
  for (const [kind, ids] of Object.entries(raw)) store[kind] = clean(ids);
  return store;
}

/** All saved identifiers of one kind, in insertion order. */
function list(kind) {
  const data = read();
  return [...(hasOwn(data, kind) ? data[kind] : [])];
}

function has(kind, id) {
  return !!id && list(kind).includes(String(id));
}

/** Saves or removes an item and returns the NEW state (true = saved). */
function toggle(kind, id) {
  const key = String(id || '');
  if (!key) return false;
  const data = read();
  const ids = hasOwn(data, kind) ? data[kind] : (data[kind] = []);
  const at = ids.indexOf(key);
  if (at >= 0) ids.splice(at, 1); else ids.push(key);
  writeJSON(LS_KEY, data);
  return at < 0;
}

export const favorites = { list, has, toggle };
