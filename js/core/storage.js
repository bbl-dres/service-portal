// Small localStorage wrapper that centralises two failure modes previously
// handled twice (and slightly differently) in session.js and process-engine.js:
// corruption/availability while reading (fallback) and quota/availability while
// writing. `writeJSON` and `remove` report success as booleans so callers do not
// record silent data loss as success (code-review C1).

// `valid` checks the stored shape as fetchJSON does for files (M20). Without it,
// EVERY non-empty value counted as usable: a damaged bbl_session_v1 (for example
// the number 1) made isLoggedIn() true while user().name remained undefined, and
// wizards wrote `requester: undefined` into a persistent case.
export function readJSONResult(key, fallback = null, valid = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return { ok: true, value: fallback, found: false };
    const value = JSON.parse(raw);
    if (value == null) return { ok: true, value: fallback, found: true };
    if (typeof valid === 'function' && !valid(value)) {
      console.warn('[storage] unexpected shape, discarded:', key);
      return { ok: false, value: fallback, found: true, reason: 'invalid' };
    }
    return { ok: true, value, found: true };
  } catch (error) {
    console.warn('[storage] read failed', key, error && error.message);
    return { ok: false, value: fallback, found: false, reason: 'read', error };
  }
}

export function readJSON(key, fallback = null, valid = null) {
  return readJSONResult(key, fallback, valid).value;
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('[storage] write failed', key, error && error.message);
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn('[storage] remove failed', key, error && error.message);
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
  } catch (error) {
    console.warn('[storage] lock failed', key, error && error.message);
    return { ok: false, reason: 'storage', error };
  } finally {
    if (acquired) {
      try {
        if (owns()) localStorage.removeItem(lockKey);
      } catch (error) {
        console.warn('[storage] unlock failed', key, error && error.message);
      }
    }
  }
}
