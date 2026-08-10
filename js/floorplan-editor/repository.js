// Browser-local repository adapter for the Floor Plan Editor feedback prototype.
//
// This is intentionally the only editor module that knows about localStorage.
// A production adapter will replace these functions with authenticated API
// calls; authorization belongs to the backend/RLS, never to this UI adapter.

import { readJSON, writeJSON, remove } from '../core/storage.js';
import {
  cloneDocument, rebaseEditorDocument, validateEditorDocument,
} from './model.js';

export const DRAFT_PREFIX = 'bbl_floorplan_editor_local_v1:';
export const DRAFT_ARCHIVE_PREFIX = 'bbl_floorplan_editor_archive_v1:';
export const HISTORY_PREFIX = 'bbl_floorplan_editor_history_v1:';
export const HISTORY_SCHEMA = 'bbl.floorplan-editor.history/v1';
const LOCK_PREFIX = 'bbl_floorplan_editor_lock_v1:';
const MAX_REVISIONS = 5;
const LOCK_TTL_MS = 5000;
const HISTORY_KEYS = new Set(['schema', 'floorId', 'baseRevision', 'revisions']);
const REVISION_KEYS = new Set(['revisionId', 'number', 'createdAt', 'createdBy', 'document']);

const plainObject = (value) => value !== null && typeof value === 'object'
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const exactKeys = (value, keys) => plainObject(value)
  && Object.keys(value).length === keys.size
  && Object.keys(value).every((key) => keys.has(key));
const identifier = (value) => typeof value === 'string'
  && value.trim().length > 0 && value.length <= 220
  && !/[\u0000-\u001f\u007f]/.test(value);
const isoTimestamp = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value));
const draftKey = (floorId) => `${DRAFT_PREFIX}${encodeURIComponent(floorId)}`;
const draftArchiveKey = (floorId, revision) => `${DRAFT_ARCHIVE_PREFIX}${encodeURIComponent(floorId)}:${encodeURIComponent(revision)}`;
const legacyHistoryKey = (floorId) => `${HISTORY_PREFIX}${encodeURIComponent(floorId)}`;
const historyIndexKey = (floorId) => `${HISTORY_PREFIX}index:${encodeURIComponent(floorId)}`;
export const revisionHistoryKey = (floorId, baseRevision) => `${HISTORY_PREFIX}${encodeURIComponent(floorId)}:${encodeURIComponent(baseRevision)}`;
const lockKey = (scope, floorId) => `${LOCK_PREFIX}${scope}:${encodeURIComponent(floorId)}`;

function uniqueToken() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function readLock(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

/** Best-effort cross-tab serialization; server-side storage will provide real CAS. */
function withStorageLock(scope, floorId, operation) {
  const key = lockKey(scope, floorId);
  const token = uniqueToken();
  try {
    const now = Date.now();
    const current = readLock(key);
    if (plainObject(current) && Number.isFinite(current.expiresAt) && current.expiresAt > now) {
      return { acquired: false, value: null, reason: 'storage-conflict' };
    }
    localStorage.setItem(key, JSON.stringify({ token, expiresAt: now + LOCK_TTL_MS }));
    const acquired = readLock(key);
    if (!plainObject(acquired) || acquired.token !== token) {
      return { acquired: false, value: null, reason: 'storage-conflict' };
    }
    try {
      return { acquired: true, value: operation() };
    } finally {
      const owned = readLock(key);
      if (plainObject(owned) && owned.token === token) {
        try { localStorage.removeItem(key); } catch { /* lock expires after the short TTL */ }
      }
    }
  } catch {
    return { acquired: false, value: null, reason: 'storage-unavailable' };
  }
}

function normaliseHistory(candidate, baseline) {
  if (!exactKeys(candidate, HISTORY_KEYS)
    || candidate.schema !== HISTORY_SCHEMA
    || candidate.floorId !== baseline.floorId
    || candidate.baseRevision !== baseline.baseRevision
    || !Array.isArray(candidate.revisions)
    || candidate.revisions.length > MAX_REVISIONS) return null;

  const ids = new Set();
  let previousNumber = null;
  let previousCreatedAt = null;
  const revisions = [];
  for (const revision of candidate.revisions) {
    if (!exactKeys(revision, REVISION_KEYS)
      || !identifier(revision.revisionId) || ids.has(revision.revisionId)
      || !Number.isInteger(revision.number) || revision.number < 1
      || (previousNumber !== null && revision.number !== previousNumber + 1)
      || !identifier(revision.createdBy) || !isoTimestamp(revision.createdAt)
      || (previousCreatedAt !== null && revision.createdAt < previousCreatedAt)) return null;
    const snapshot = revision.document;
    if (!validateEditorDocument(snapshot)
      || snapshot.buildingId !== baseline.buildingId
      || snapshot.floorId !== baseline.floorId
      || snapshot.baseRevision !== baseline.baseRevision
      || JSON.stringify(snapshot.building) !== JSON.stringify(baseline.building)
      || JSON.stringify(snapshot.floor) !== JSON.stringify(baseline.floor)
      || JSON.stringify(snapshot.planningFloor) !== JSON.stringify(baseline.planningFloor)) return null;
    ids.add(revision.revisionId);
    previousNumber = revision.number;
    previousCreatedAt = revision.createdAt;
    revisions.push(cloneDocument(revision));
  }
  return {
    envelope: {
      schema: HISTORY_SCHEMA,
      floorId: baseline.floorId,
      baseRevision: baseline.baseRevision,
      revisions,
    },
  };
}

function verifiedWrite(key, value, validator) {
  if (!writeJSON(key, value)) return false;
  const stored = readJSON(key, null, validator);
  return stored !== null && JSON.stringify(stored) === JSON.stringify(value);
}

function historyScopes(floorId) {
  return readJSON(historyIndexKey(floorId), [], (candidate) => Array.isArray(candidate)
    && candidate.length <= 100
    && candidate.every(identifier));
}

function rememberHistoryScope(floorId, baseRevision) {
  const scopes = historyScopes(floorId);
  if (scopes.includes(baseRevision)) return true;
  return writeJSON(historyIndexKey(floorId), [...scopes, baseRevision].slice(-100));
}

function archiveDraft(raw, floorId) {
  const revision = identifier(raw?.baseRevision)
    ? raw.baseRevision
    : `unreadable-${Date.now().toString(36)}-${uniqueToken()}`;
  const key = draftArchiveKey(floorId, revision);
  const existing = readJSON(key, null);
  if (existing !== null && JSON.stringify(existing) === JSON.stringify(raw)) return { ok: true, key };
  const archiveKey = existing === null ? key : `${key}-${Date.now().toString(36)}`;
  return { ok: verifiedWrite(archiveKey, raw, () => true), key: archiveKey };
}

function migrateLegacyHistory(floorId) {
  const key = legacyHistoryKey(floorId);
  const raw = readJSON(key, null);
  if (!raw) return null;
  const baseRevision = identifier(raw?.baseRevision) ? raw.baseRevision : null;
  if (!baseRevision || raw.floorId !== floorId) return null;
  const scopedKey = revisionHistoryKey(floorId, baseRevision);
  const existing = readJSON(scopedKey, null);
  const archived = existing !== null
    ? JSON.stringify(existing) === JSON.stringify(raw)
    : verifiedWrite(scopedKey, raw, () => true);
  if (!archived) return null;
  rememberHistoryScope(floorId, baseRevision);
  remove(key);
  return raw;
}

// --- Landing-page inventory --------------------------------------------------
// The landing page needs to know what the visitor left behind without opening
// every plan. Both readers below are tolerant: a corrupt or foreign entry is
// skipped, never thrown, because a broken recent entry must not cost the whole
// page.

export const VISITS_KEY = 'bbl_floorplan_editor_visits_v1';
const MAX_VISITS = 12;

/** Floor IDs with an unpublished local working copy, newest write first. */
export function listWorkingCopies() {
  const drafts = [];
  let storage = null;
  try { storage = globalThis.localStorage; } catch { return drafts; }
  if (!storage) return drafts;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(DRAFT_PREFIX)) continue;
    let floorId = '';
    try { floorId = decodeURIComponent(key.slice(DRAFT_PREFIX.length)); } catch { continue; }
    if (!identifier(floorId)) continue;
    const document = readJSON(key, null);
    if (!plainObject(document)) continue;
    drafts.push({
      floorId,
      // The document carries no change counter; the placement count is the
      // honest stand-in for «how much is in here».
      changeCount: Array.isArray(document.placements) ? document.placements.length : 0,
      savedAt: isoTimestamp(document.updatedAt) ? Date.parse(document.updatedAt) : 0,
    });
  }
  return drafts.sort((left, right) => right.savedAt - left.savedAt);
}

/** Remember that a floor was opened, so the landing page can offer it again. */
export function rememberVisit(floorId, at = Date.now()) {
  const requestedFloorId = String(floorId || '');
  if (!identifier(requestedFloorId)) return false;
  const visits = listVisits().filter((visit) => visit.floorId !== requestedFloorId);
  visits.unshift({ floorId: requestedFloorId, at: Number(at) || Date.now() });
  return writeJSON(VISITS_KEY, visits.slice(0, MAX_VISITS));
}

/** Recently opened floors, newest first. */
export function listVisits() {
  const stored = readJSON(VISITS_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((visit) => plainObject(visit) && identifier(visit.floorId) && Number.isFinite(Number(visit.at)))
    .map((visit) => ({ floorId: visit.floorId, at: Number(visit.at) }))
    .slice(0, MAX_VISITS);
}

/** Load and, when needed, rebase a compatible working copy onto current reference data. */
export function loadWorkingCopy(floorId, baseline) {
  const requestedFloorId = String(floorId || '');
  const safeBaseline = cloneDocument(baseline);
  if (!identifier(requestedFloorId) || !validateEditorDocument(safeBaseline)
    || safeBaseline.floorId !== requestedFloorId) {
    return { ok: false, source: 'none', document: null, reason: 'invalid-baseline' };
  }
  const key = draftKey(requestedFloorId);
  const local = readJSON(key, null);
  if (!local) {
    return {
      ok: true, source: 'baseline', document: safeBaseline,
      reconciled: false, droppedPlacementIds: [],
    };
  }
  if (validateEditorDocument(local, safeBaseline)) {
    return {
      ok: true, source: 'browser-local', document: cloneDocument(local),
      reconciled: false, droppedPlacementIds: [],
    };
  }
  const rebased = rebaseEditorDocument(local, safeBaseline);
  if (rebased) {
    const archiveRequired = rebased.droppedPlacementIds.length > 0;
    const write = withStorageLock('draft', requestedFloorId, () => {
      // Re-check under the lock: never archive/replace a newer write from a
      // second tab using the stale value read before lock acquisition.
      const current = readJSON(key, null);
      if (JSON.stringify(current) !== JSON.stringify(local)) {
        return { persisted: false, archived: false, archiveKey: null, reason: 'storage-conflict' };
      }
      let archive = { ok: false, key: null };
      if (archiveRequired) {
        archive = archiveDraft(local, requestedFloorId);
        if (!archive.ok) {
          return { persisted: false, archived: false, archiveKey: null, reason: 'archive-unavailable' };
        }
        // Dropping placements needs explicit user acceptance. Keep the active
        // source byte-for-byte intact until the user chooses Save; the UI gets
        // the reconciled document in memory and marks it dirty.
        return {
          persisted: false, archived: true, archiveKey: archive.key, reason: 'review-required',
        };
      }
      const persisted = verifiedWrite(key, rebased.document,
        (candidate) => validateEditorDocument(candidate, safeBaseline));
      return {
        persisted,
        archived: archiveRequired && archive.ok,
        archiveKey: archiveRequired ? archive.key : null,
        ...(persisted ? {} : { reason: 'storage-unavailable' }),
      };
    });
    const reconciliation = write.acquired ? write.value : {
      persisted: false, archived: false, archiveKey: null, reason: write.reason,
    };
    return {
      ok: true,
      source: 'browser-local',
      document: cloneDocument(rebased.document),
      reconciled: true,
      droppedPlacementIds: [...rebased.droppedPlacementIds],
      persistedReconciliation: reconciliation.persisted === true,
      archivedOriginalDraft: reconciliation.archived === true,
      archiveKey: reconciliation.archiveKey,
      reconciliationPersistenceReason: reconciliation.reason || null,
    };
  }

  // A different room/floor baseline cannot be merged safely. Move it aside so
  // the current floor can proceed without destroying the recoverable snapshot.
  const archived = archiveDraft(local, requestedFloorId);
  if (archived.ok) remove(key);
  return {
    ok: true, source: 'baseline', document: safeBaseline,
    reconciled: false, droppedPlacementIds: [], discardedDraft: true,
    archivedDraft: archived.ok, archiveKey: archived.ok ? archived.key : null,
  };
}

/** Save a stamped clone. Pass baseline to enforce immutable reference metadata. */
export function saveWorkingCopy(document, baseline = null) {
  const candidate = cloneDocument(document);
  if (!plainObject(candidate)) {
    return { ok: false, document: null, reason: 'invalid-document' };
  }
  candidate.updatedAt = new Date().toISOString();
  if (!validateEditorDocument(candidate, baseline)) {
    return { ok: false, document: null, reason: 'invalid-document' };
  }
  const key = draftKey(candidate.floorId);
  const write = withStorageLock('draft', candidate.floorId,
    () => verifiedWrite(key, candidate,
      (stored) => validateEditorDocument(stored, baseline)));
  if (!write.acquired) {
    return { ok: false, document: null, reason: write.reason };
  }
  const ok = write.value === true;
  return {
    ok,
    document: ok ? cloneDocument(candidate) : null,
    ...(ok ? {} : { reason: 'storage-unavailable' }),
  };
}

/** Remove only this editor's working copy for one floor. */
export function removeWorkingCopy(floorId) {
  const requestedFloorId = String(floorId || '');
  return identifier(requestedFloorId) && remove(draftKey(requestedFloorId));
}

/** Read immutable, locally simulated publication snapshots for one baseline. */
export function loadRevisionHistory(floorId, baseline) {
  const requestedFloorId = String(floorId || '');
  if (!identifier(requestedFloorId) || !validateEditorDocument(baseline)
    || baseline.floorId !== requestedFloorId) return [];
  migrateLegacyHistory(requestedFloorId);
  const key = revisionHistoryKey(requestedFloorId, baseline.baseRevision);
  const raw = readJSON(key, null);
  if (!raw) return [];
  const normalised = normaliseHistory(raw, baseline);
  if (!normalised) return [];
  if (JSON.stringify(raw) !== JSON.stringify(normalised.envelope)) {
    withStorageLock('history', requestedFloorId,
      () => verifiedWrite(key, normalised.envelope,
        (candidate) => normaliseHistory(candidate, baseline) !== null));
  }
  rememberHistoryScope(requestedFloorId, baseline.baseRevision);
  return cloneDocument(normalised.envelope.revisions);
}

/**
 * Simulate publication locally by appending an immutable snapshot. This is a
 * UX-test affordance, not a shared publication or authorization decision.
 */
export function publishLocalRevision(document, baseline, actor = 'Unbekannt') {
  const candidate = cloneDocument(document);
  if (!validateEditorDocument(candidate, baseline)) {
    return { ok: false, revision: null, revisions: [], reason: 'invalid-document' };
  }
  const safeActor = String(actor || 'Unbekannt')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200) || 'Unbekannt';
  const key = revisionHistoryKey(candidate.floorId, baseline.baseRevision);
  const operation = withStorageLock('history', candidate.floorId, () => {
    migrateLegacyHistory(candidate.floorId);
    const raw = readJSON(key, null);
    const normalised = raw ? normaliseHistory(raw, baseline) : null;
    if (raw && !normalised) {
      return { ok: false, revision: null, revisions: [], reason: 'invalid-history' };
    }
    const existing = normalised?.envelope.revisions || [];
    const number = existing.reduce((max, item) => Math.max(max, item.number), 0) + 1;
    const lastTimestamp = existing.length ? Date.parse(existing.at(-1).createdAt) : 0;
    const revision = {
      revisionId: `local-${uniqueToken()}-${number}`,
      number,
      createdAt: new Date(Math.max(Date.now(), lastTimestamp)).toISOString(),
      createdBy: safeActor,
      document: candidate,
    };
    const revisions = [...existing, revision].slice(-MAX_REVISIONS);
    const envelope = {
      schema: HISTORY_SCHEMA,
      floorId: candidate.floorId,
      baseRevision: candidate.baseRevision,
      revisions,
    };
    const ok = verifiedWrite(key, envelope,
      (stored) => normaliseHistory(stored, baseline) !== null);
    if (ok) rememberHistoryScope(candidate.floorId, baseline.baseRevision);
    return { ok, revision, revisions, ...(ok ? {} : { reason: 'storage-unavailable' }) };
  });
  if (!operation.acquired) {
    return { ok: false, revision: null, revisions: [], reason: operation.reason };
  }
  const { ok, revision, revisions, reason } = operation.value;
  return {
    ok,
    revision: ok ? cloneDocument(revision) : null,
    revisions: ok ? cloneDocument(revisions) : [],
    ...(ok ? {} : { reason: reason || 'storage-unavailable' }),
  };
}

export function removeRevisionHistory(floorId, baseRevision = null) {
  const requestedFloorId = String(floorId || '');
  if (!identifier(requestedFloorId)) return false;
  const scopedRemoval = identifier(baseRevision);
  if (scopedRemoval) migrateLegacyHistory(requestedFloorId);
  let ok = true;
  const scopes = historyScopes(requestedFloorId);
  const selectedScopes = scopedRemoval ? [baseRevision] : scopes;
  selectedScopes.forEach((revision) => {
    ok = remove(revisionHistoryKey(requestedFloorId, revision)) && ok;
  });
  if (!scopedRemoval) ok = remove(legacyHistoryKey(requestedFloorId)) && ok;
  const remaining = scopes.filter((revision) => !selectedScopes.includes(revision));
  ok = (remaining.length
    ? writeJSON(historyIndexKey(requestedFloorId), remaining)
    : remove(historyIndexKey(requestedFloorId))) && ok;
  return ok;
}
