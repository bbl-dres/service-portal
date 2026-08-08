// Persönliche Merkliste — «meine Standorte», «meine Räume».
//
// Die Raumbuchung ist eine Wiederholungstat: dieselbe Person bucht Woche für
// Woche am selben Standort, oft denselben Raum. Ohne Merkliste beginnt jede
// Buchung wieder bei der Vorauswahl des Prototyps, und der häufigste Fall kostet
// so viele Klicks wie der seltenste. Gemerkt wird deshalb nur, was die nächste
// Suche vorbelegen kann — Kennungen, keine Kopien der Objekte selbst.
//
// Bewusst gerätelokal (localStorage) und ohne Personenbezug: der Prototyp hat
// keine Nutzerablage, und eine Merkliste ist kein Vorgang. Schlägt das Schreiben
// fehl (Quota, gesperrter Speicher), bleibt die Wahl für diese Sitzung wirksam
// und geht beim Neuladen verloren — anders als bei einem Vorgang ist das ein
// hinnehmbarer Verlust, weshalb hier kein Fehlerband nötig ist (vgl. code-review C1).

import { readJSON, writeJSON } from './storage.js';

const LS_KEY = 'bbl_favorites_v1';

// Form prüfen wie überall sonst (M20): ein beschädigter Eintrag darf nicht als
// halb brauchbare Liste durchgehen. Erwartet wird { <art>: [<kennung>, …] }.
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

/** Alle gemerkten Kennungen einer Art, in der Reihenfolge des Merkens. */
function list(kind) {
  const data = read();
  return [...(hasOwn(data, kind) ? data[kind] : [])];
}

function has(kind, id) {
  return !!id && list(kind).includes(String(id));
}

/** Merkt bzw. vergisst und liefert den NEUEN Zustand (true = gemerkt). */
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

function count(kind) {
  return list(kind).length;
}

export const favorites = { list, has, toggle, count };
export default favorites;
