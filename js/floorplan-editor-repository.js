// Browser-local repository adapter for the Floor Plan Editor feedback prototype.
//
// This is intentionally the only editor module that knows about localStorage.
// A production adapter will replace these functions with authenticated API
// calls; authorization belongs to the backend/RLS, never to this UI adapter.

import { readJSON, writeJSON, remove } from './storage.js';
import { cloneDocument, validateEditorDocument } from './floorplan-editor-model.js';

export const DRAFT_PREFIX = 'bbl_floorplan_editor_local_v1:';
export const HISTORY_PREFIX = 'bbl_floorplan_editor_history_v1:';
export const HISTORY_SCHEMA = 'bbl.floorplan-editor.history/v1';
const MAX_REVISIONS = 5;

const identifier = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 220;
const draftKey = (floorId) => `${DRAFT_PREFIX}${encodeURIComponent(floorId)}`;
const historyKey = (floorId) => `${HISTORY_PREFIX}${encodeURIComponent(floorId)}`;

function validHistory(candidate, baseline) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)
    || candidate.schema !== HISTORY_SCHEMA
    || candidate.floorId !== baseline.floorId
    || candidate.baseRevision !== baseline.baseRevision
    || !Array.isArray(candidate.revisions)
    || candidate.revisions.length > MAX_REVISIONS) return false;
  const ids = new Set();
  return candidate.revisions.every((revision) => {
    if (!revision || typeof revision !== 'object' || Array.isArray(revision)
      || !identifier(revision.revisionId) || ids.has(revision.revisionId)
      || !Number.isInteger(revision.number) || revision.number < 1
      || !identifier(revision.createdBy)
      || !Number.isFinite(Date.parse(revision.createdAt))
      || !validateEditorDocument(revision.document, baseline)) return false;
    ids.add(revision.revisionId);
    return true;
  });
}

/** Load a schema-compatible working copy, otherwise return the detached source. */
export function loadWorkingCopy(floorId, baseline) {
  const requestedFloorId = String(floorId || '');
  const safeBaseline = cloneDocument(baseline);
  if (!identifier(requestedFloorId) || !validateEditorDocument(safeBaseline)
    || safeBaseline.floorId !== requestedFloorId) {
    return { ok: false, source: 'none', document: null, reason: 'invalid-baseline' };
  }
  const local = readJSON(
    draftKey(requestedFloorId),
    null,
    (candidate) => validateEditorDocument(candidate, safeBaseline),
  );
  if (local) return { ok: true, source: 'browser-local', document: cloneDocument(local) };
  return { ok: true, source: 'baseline', document: safeBaseline };
}

/** Save a stamped working-copy clone. The caller's document is never mutated. */
export function saveWorkingCopy(document) {
  const candidate = cloneDocument(document);
  if (!validateEditorDocument(candidate)) {
    return { ok: false, document: null, reason: 'invalid-document' };
  }
  candidate.updatedAt = new Date().toISOString();
  const ok = writeJSON(draftKey(candidate.floorId), candidate);
  return { ok, document: cloneDocument(candidate), ...(ok ? {} : { reason: 'storage-unavailable' }) };
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
  const history = readJSON(historyKey(requestedFloorId), null,
    (candidate) => validHistory(candidate, baseline));
  return history ? cloneDocument(history.revisions) : [];
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
  const existing = loadRevisionHistory(candidate.floorId, baseline);
  const now = new Date().toISOString();
  const number = existing.reduce((max, item) => Math.max(max, item.number), 0) + 1;
  const safeActor = String(actor || 'Unbekannt').trim().slice(0, 200) || 'Unbekannt';
  const revision = {
    revisionId: `local-${Date.now().toString(36)}-${number}`,
    number,
    createdAt: now,
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
  const ok = writeJSON(historyKey(candidate.floorId), envelope);
  return { ok, revision: ok ? cloneDocument(revision) : null,
    revisions: ok ? cloneDocument(revisions) : existing,
    ...(ok ? {} : { reason: 'storage-unavailable' }) };
}

export function removeRevisionHistory(floorId) {
  const requestedFloorId = String(floorId || '');
  return identifier(requestedFloorId) && remove(historyKey(requestedFloorId));
}

