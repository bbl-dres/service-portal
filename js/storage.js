// Kleiner localStorage-Wrapper — zentralisiert die zwei Fehlerfälle, die sonst in
// session.js und process-engine.js doppelt (und leicht unterschiedlich) behandelt
// wurden: Korruption/Verfügbarkeit beim Lesen (Fallback) und Quota/Verfügbarkeit
// beim Schreiben. `writeJSON`/`remove` melden Erfolg als bool, damit Aufrufer einen
// stillen Datenverlust nicht als Erfolg verbuchen (code-review C1).

// `valid` prüft die gelesene Form, so wie fetchJSON das für Dateien tut (M20).
// Ohne diese Prüfung galt JEDER nicht-leere Wert als brauchbar: ein beschädigter
// bbl_session_v1 (etwa die blosse Zahl 1) machte isLoggedIn() wahr, user().name
// blieb undefined — und die Assistenten schrieben `requester: undefined` in einen
// dauerhaft gespeicherten Vorgang.
export function readJSON(key, fallback = null, valid = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const val = JSON.parse(raw);
    if (val == null) return fallback;
    if (typeof valid === 'function' && !valid(val)) {
      console.warn('[storage] unerwartete Form, verworfen:', key);
      return fallback;
    }
    return val;
  } catch (e) {
    console.warn('[storage] read failed', key, e && e.message);
    return fallback;
  }
}

export function writeJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch (e) {
    console.warn('[storage] write failed', key, e && e.message);
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn('[storage] remove failed', key, e && e.message);
    return false;
  }
}

export default { readJSON, writeJSON, remove };
