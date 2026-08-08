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
export function readJSONResult(key, fallback = null, valid = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return { ok: true, value: fallback, found: false };
    const val = JSON.parse(raw);
    if (val == null) return { ok: true, value: fallback, found: true };
    if (typeof valid === 'function' && !valid(val)) {
      console.warn('[storage] unerwartete Form, verworfen:', key);
      return { ok: false, value: fallback, found: true, reason: 'invalid' };
    }
    return { ok: true, value: val, found: true };
  } catch (e) {
    console.warn('[storage] read failed', key, e && e.message);
    return { ok: false, value: fallback, found: false, reason: 'read', error: e };
  }
}

export function readJSON(key, fallback = null, valid = null) {
  return readJSONResult(key, fallback, valid).value;
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

// localStorage has no atomic compare-and-swap operation. This short lease is a
// best-effort guard for the prototype's synchronous read-modify-write paths. A
// caller must still verify ownership immediately before its write via `owns`.
export function withStorageLock(key, callback, { ttl = 2000 } = {}) {
  const lockKey = `${key}.__lock__`;
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let acquired = false;

  const readLock = () => {
    const raw = localStorage.getItem(lockKey);
    if (!raw) return null;
    try {
      const lock = JSON.parse(raw);
      return lock && typeof lock === 'object' ? lock : null;
    } catch {
      return null;
    }
  };
  const owns = () => readLock()?.token === token;

  try {
    const current = readLock();
    if (current && Number(current.expires) > Date.now()) {
      return { ok: false, reason: 'busy' };
    }
    localStorage.setItem(lockKey, JSON.stringify({ token, expires: Date.now() + ttl }));
    acquired = owns();
    if (!acquired) return { ok: false, reason: 'busy' };
    return { ok: true, value: callback(owns) };
  } catch (e) {
    console.warn('[storage] lock failed', key, e && e.message);
    return { ok: false, reason: 'storage', error: e };
  } finally {
    if (acquired) {
      try {
        if (owns()) localStorage.removeItem(lockKey);
      } catch (e) {
        console.warn('[storage] unlock failed', key, e && e.message);
      }
    }
  }
}

export default { readJSON, readJSONResult, writeJSON, remove, withStorageLock };
