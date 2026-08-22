// Mock process engine ("Camunda, but mocked").
// Process definitions + seeded instances come from data/. User-created instances
// (cases) live in localStorage so the service → process → My cases loop works.
// NOTE: this is the *demo* engine — see docs/expert-review.md for the real-vs-mocked register.

import { readJSON, readJSONResult, writeJSON, withStorageLock } from './core/storage.js';
import { fetchJSON } from './core/fetch-json.js';

const LS_KEY = 'bbl_vorgaenge_v1';
let DEFS = [];
let SEEDED = [];
let LOADING = null;

// Failure register: the same principle as core/index.js. Without it, a 404 for
// the definition source remained invisible: DEFS = [], no message, and
// start() invented a replacement definition (H10).
const FAILED = new Set();
const DATA_AREA_LABELS = { definitions: 'Prozessdefinitionen', instances: 'Vorgänge' };

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const isInstance = (value) => isRecord(value)
  && typeof value.instanceId === 'string' && value.instanceId.trim() !== '';
const recordsOrMissing = (value) => value == null
  || (Array.isArray(value) && value.every(isRecord));
const recordOrMissing = (value) => value == null || isRecord(value);
const hasSafeInstanceShape = (value) => isInstance(value)
  && recordsOrMissing(value.history)
  && recordsOrMissing(value.attachments)
  && recordOrMissing(value.data)
  && recordOrMissing(value.linkedEntities);

function normalizeInstance(value) {
  return {
    ...value,
    instanceId: value.instanceId.trim(),
    history: Array.isArray(value.history) ? value.history.filter(isRecord) : [],
    attachments: Array.isArray(value.attachments) ? value.attachments.filter(isRecord) : [],
    data: isRecord(value.data) ? value.data : {},
    linkedEntities: isRecord(value.linkedEntities) ? value.linkedEntities : {},
  };
}

function cleanInstances(value, source, { strict = false } = {}) {
  if (!Array.isArray(value)) {
    if (strict) throw new Error(`expected ${source} instance list`);
    return [];
  }
  const malformed = value.filter((record) => !hasSafeInstanceShape(record));
  if (strict && malformed.length) {
    throw new Error(`malformed ${source} instance(s): ${malformed.length}`);
  }
  const records = [];
  const ids = new Set();
  let duplicates = 0;
  for (const candidate of value.filter(isInstance)) {
    const record = normalizeInstance(candidate);
    if (ids.has(record.instanceId)) { duplicates++; continue; }
    ids.add(record.instanceId);
    records.push(record);
  }
  if (strict && duplicates) throw new Error(`duplicate ${source} instance ID(s): ${duplicates}`);
  if (malformed.length) {
    console.warn(`[engine] repaired or ignored ${malformed.length} malformed ${source} instance(s)`);
  }
  if (duplicates) console.warn(`[engine] ignored ${duplicates} duplicate ${source} instance ID(s)`);
  return records;
}

function cleanDefinitions(value) {
  if (!Array.isArray(value) || !value.length) throw new Error('expected non-empty definition list');
  const malformed = value.filter((record) => !isRecord(record)
    || typeof record.defId !== 'string' || !record.defId.trim()
    || typeof record.name !== 'string' || !record.name.trim()
    || !Array.isArray(record.steps) || !record.steps.length
    || record.steps.some((step) => !isRecord(step)
      || typeof step.status !== 'string' || !step.status.trim()
      || typeof step.label !== 'string' || !step.label.trim()));
  if (malformed.length) {
    throw new Error(`malformed process definition(s): ${malformed.length}`);
  }
  const ids = value.map((record) => record.defId.trim());
  if (new Set(ids).size !== ids.length) throw new Error('duplicate process definition ID(s)');
  return value;
}

function withoutSeededShadows(records) {
  const seededIds = new Set(SEEDED.map((record) => record.instanceId));
  return records.filter((record) => !seededIds.has(record.instanceId));
}

// Memoised: parsing + normalising + two Set builds ran on EVERY instances()
// call — several per render on some routes (code review 2026-08, F-S27).
// Any write path and the cross-tab `storage` event drop the memo; a stale
// read from another tab's write between events is impossible because the
// event fires for every localStorage change from other tabs, and same-tab
// writes go through saveLS below.
let _lsCache = null;
window.addEventListener('storage', (e) => { if (e.key === LS_KEY) _lsCache = null; });
function loadLS() {
  if (_lsCache) return _lsCache;
  const a = readJSON(LS_KEY, []);
  _lsCache = withoutSeededShadows(cleanInstances(a, 'local'));
  return _lsCache;
}
function saveLS(records) { _lsCache = null; return writeJSON(LS_KEY, records); } // → bool so callers detect silent loss (C1)

// Mutations are synchronous because localStorage is synchronous. A short lease
// narrows the cross-tab read-modify-write race; ownership is checked again just
// before saving. `false` means storage/lock failure, while `null` remains a
// legitimate no-op such as an unknown instance.
function mutateLS(change) {
  const locked = withStorageLock(LS_KEY, (owns) => {
    const stored = readJSONResult(LS_KEY, [], Array.isArray);
    if (!stored.ok) return { ok: false, value: false };
    // Seed data is canonical and immutable in this demo. A corrupt local
    // record must never make a seeded case mutable through advance/cancel.
    const records = withoutSeededShadows(cleanInstances(stored.value, 'local'));
    const result = change(records);
    if (!result || result.changed === false) {
      return { ok: true, value: result ? result.value : null };
    }
    if (!owns() || !saveLS(records)) return { ok: false, value: false };
    return { ok: true, value: result.value };
  });
  if (!locked.ok || !locked.value?.ok) return { ok: false, value: false };
  return locked.value;
}

async function processRecords(source) {
  if (!source) return fetchJSON('data/processes.json', { shape: 'array' });
  if (typeof source.ensure !== 'function' || typeof source.processes !== 'function'
    || typeof source.available !== 'function') {
    throw new TypeError('invalid process data source');
  }
  await source.ensure(['processes']);
  if (!source.available('processes')) throw new Error('process dataset unavailable');
  return source.processes();
}

async function loadData(source) {
  FAILED.clear();
  const [definitions, instances] = await Promise.allSettled([
    // Portal workflows and business processes share one dataset. In the app,
    // core owns and caches that request; the optional direct path keeps the
    // engine usable as a standalone module in browser-free tests.
    processRecords(source),
    fetchJSON('data/process-instances.json', { shape: 'array' }),
  ]);
  try {
    if (definitions.status !== 'fulfilled') throw definitions.reason;
    DEFS = cleanDefinitions((definitions.value || [])
      .filter((record) => isRecord(record) && record.branch === 'portal')
      .map((r) => ({ ...r, defId: r.processId })));
  } catch (error) {
    console.warn('[engine] definitions', error?.message);
    DEFS = [];
    FAILED.add('definitions');
  }
  try {
    if (instances.status !== 'fulfilled') throw instances.reason;
    SEEDED = cleanInstances(instances.value, 'seeded', { strict: true });
  } catch (error) {
    console.warn('[engine] instances', error?.message);
    SEEDED = [];
    FAILED.add('instances');
  }
}

function load(source = null) {
  if (LOADING) return LOADING;
  const pending = loadData(source).finally(() => {
    if (LOADING === pending) LOADING = null;
  });
  LOADING = pending;
  return pending;
}

const definition = (id) => DEFS.find(d => d && d.defId === id);
const localDateStamp = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

function generateReference(date = new Date()) {
  const year = date.getFullYear();
  const sequence = Math.floor(1000 + Math.random() * 9000);
  return `BBL-${year}-${sequence}`;
}

// All instances visible to the current (mock) user = seeded + locally created.
function instances() { return [...loadLS(), ...SEEDED]; }
const instance = (id) => instances().find(i => i && i.instanceId === id);

// Returns the new instance. null means an unknown definition (no-op), while
// false means a storage/lock failure. Callers can distinguish the two failure
// modes without changing the existing object contract.
function start(defId, payload = {}) {
  const def = definition(defId);
  // No definition means NO case. The previous version invented and persisted a
  // replacement definition, producing a record that belonged to no process and
  // could not be repaired on the next load.
  if (!def || !Array.isArray(def.steps) || !def.steps.length) {
    console.error(`[engine] unknown process definition «${defId}»; no case created`);
    return null;
  }
  const input = isRecord(payload) ? payload : {};
  const steps = def.steps;
  const first = steps[0];
  const now = new Date();
  const stamp = localDateStamp(now);
  const inst = {
    instanceId: 'inst-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    defId,
    defName: def.name,
    reference: generateReference(now),
    title: input.title || def.name,
    requester: input.requester || 'Andrea Muster',
    organization: input.organization || 'Bundesamt (Demo)',
    audience: def.audience,
    status: first.status,
    stepIndex: 0,
    createdAt: stamp,
    updatedAt: stamp,
    data: isRecord(input.data) ? input.data : {},
    linkedEntities: isRecord(input.linkedEntities) ? input.linkedEntities : {},
    createdLocally: true,
    history: [{ when: stamp, status: first.label, note: 'Vorgang erstellt' }],
  };
  const result = mutateLS((arr) => {
    arr.unshift(inst);
    return { changed: true, value: inst };
  });
  return result.ok ? result.value : false;
}

// Demo affordance: advance a locally-created instance to its next step.
function advance(id) {
  const result = mutateLS((arr) => {
    const inst = arr.find(i => i && i.instanceId === id);
    if (!inst) return { changed: false, value: null };
    const def = definition(inst.defId);
    const stepIndex = Number.isInteger(inst.stepIndex) && inst.stepIndex >= 0 ? inst.stepIndex : 0;
    if (!def || !Array.isArray(def.steps) || stepIndex >= def.steps.length - 1) {
      return { changed: false, value: inst };
    }
    const nextIndex = stepIndex + 1;
    const step = def.steps[nextIndex];
    if (!isRecord(step)) return { changed: false, value: inst };
    inst.stepIndex = nextIndex;
    inst.status = step.status;
    const stamp = localDateStamp();
    inst.updatedAt = stamp;
    inst.history = Array.isArray(inst.history) ? inst.history : [];
    inst.history.push({ when: stamp, status: step.label, note: step.role ? `Schritt durch ${step.role} (Demo)` : 'Status aktualisiert (Demo)' });
    return { changed: true, value: inst };
  });
  return result.ok ? result.value : false;
}

// Locally created reservations and requests can be withdrawn by their owner.
// The process definition remains unchanged; the instance status records the
// exceptional end state and releases resources such as booked rooms.
function cancel(id) {
  const result = mutateLS((arr) => {
    const inst = arr.find(i => i && i.instanceId === id);
    if (!inst || inst.status === 'zurueckgezogen') {
      return { changed: false, value: inst || null };
    }
    inst.status = 'zurueckgezogen';
    const stamp = localDateStamp();
    inst.updatedAt = stamp;
    inst.history = Array.isArray(inst.history) ? inst.history : [];
    inst.history.push({ when: stamp, status: 'Storniert', note: 'Durch die buchende Person storniert' });
    return { changed: true, value: inst };
  });
  return result.ok ? result.value : false;
}

function reset() {
  const result = mutateLS((arr) => {
    arr.splice(0, arr.length);
    return { changed: true, value: true };
  });
  return result.ok && result.value === true;
}

export const engine = {
  load,
  available: (key) => !FAILED.has(key),
  failedAreas: () => Array.from(FAILED).map(k => DATA_AREA_LABELS[k] || k),
  definitions: () => DEFS,
  definition,
  instances,
  instance,
  start,
  advance,
  cancel,
  reset,
};
