// Mock process engine ("Camunda, but mocked").
// Process definitions + seeded instances come from data/. User-created instances
// (Vorgänge) live in localStorage so the service->process->Meine-Vorgänge loop works.
// NOTE: this is the *demo* engine — see docs/expert-review.md for the real-vs-mocked register.

import { readJSON, readJSONResult, writeJSON, withStorageLock } from './storage.js';
import { fetchJSON } from './fetch-json.js';

const LS_KEY = 'bbl_vorgaenge_v1';
let DEFS = [];
let SEEDED = [];

// Ausfallregister — dasselbe Prinzip wie in core.js. Ohne das blieb ein 404 auf
// process-definitions.json unsichtbar: DEFS = [], keine Meldung, und start()
// erfand sich eine Ersatzdefinition (H10).
const FAILED = new Set();
const AREA = { definitions: 'Prozessdefinitionen', instances: 'Vorgänge' };

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
  const records = value.filter(isInstance).map(normalizeInstance);
  if (malformed.length) {
    console.warn(`[engine] repaired or ignored ${malformed.length} malformed ${source} instance(s)`);
  }
  return records;
}

function cleanDefinitions(value) {
  if (!Array.isArray(value)) throw new Error('expected definition list');
  const malformed = value.filter((record) => !isRecord(record)
    || typeof record.defId !== 'string' || !record.defId.trim()
    || !Array.isArray(record.steps) || !record.steps.length
    || record.steps.some((step) => !isRecord(step)
      || typeof step.status !== 'string' || !step.status.trim()
      || typeof step.label !== 'string' || !step.label.trim()));
  if (malformed.length) {
    throw new Error(`malformed process definition(s): ${malformed.length}`);
  }
  return value;
}

function loadLS() {
  const a = readJSON(LS_KEY, []);
  return cleanInstances(a, 'local');
}
function saveLS(arr) { return writeJSON(LS_KEY, arr); }   // → bool, damit Aufrufer stillen Verlust erkennen (C1)

// Mutations are synchronous because localStorage is synchronous. A short lease
// narrows the cross-tab read-modify-write race; ownership is checked again just
// before saving. `false` means storage/lock failure, while `null` remains a
// legitimate no-op such as an unknown instance.
function mutateLS(change) {
  const locked = withStorageLock(LS_KEY, (owns) => {
    const stored = readJSONResult(LS_KEY, [], Array.isArray);
    if (!stored.ok) return { ok: false, value: false };
    const records = cleanInstances(stored.value, 'local');
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

async function load() {
  FAILED.clear();
  const [definitions, instances] = await Promise.allSettled([
    fetchJSON('data/process-definitions.json', { shape: 'array' }),
    fetchJSON('data/process-instances.json', { shape: 'array' }),
  ]);
  try {
    if (definitions.status !== 'fulfilled') throw definitions.reason;
    DEFS = cleanDefinitions(definitions.value);
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

const definition = (id) => DEFS.find(d => d && d.defId === id);
const localDateStamp = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

function genRef(date = new Date()) {
  const y = date.getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `BBL-${y}-${n}`;
}

// all instances visible to the current (mock) user = seeded + locally created
function instances() { return [...loadLS(), ...SEEDED]; }
const instance = (id) => instances().find(i => i && i.instanceId === id);

// Gibt die neue Instanz zurück. null bezeichnet eine unbekannte Definition
// (No-op), false einen Speicher-/Sperrfehler; so kann ein Aufrufer die beiden
// Fehlerarten unterscheiden, ohne den bisherigen Objektvertrag zu verlieren.
function start(defId, payload = {}) {
  const def = definition(defId);
  // Ohne Definition KEIN Vorgang. Vorher wurde eine Ersatzdefinition erfunden und
  // dauerhaft gespeichert — ein Datensatz, der zu keinem Prozess mehr gehört und
  // beim nächsten Laden auch nicht repariert wird.
  if (!def || !Array.isArray(def.steps) || !def.steps.length) {
    console.error(`[engine] unbekannte Prozessdefinition «${defId}» — kein Vorgang angelegt`);
    return null;
  }
  const steps = def.steps;
  const first = steps[0];
  const now = new Date();
  const stamp = localDateStamp(now);
  const inst = {
    instanceId: 'inst-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    defId,
    defName: def.name,
    reference: genRef(now),
    title: payload.title || def.name,
    requester: payload.requester || 'Andrea Muster',
    organization: payload.organization || 'Bundesamt (Demo)',
    audience: def.audience,
    status: first.status,
    stepIndex: 0,
    createdAt: stamp,
    updatedAt: stamp,
    data: payload.data || {},
    linkedEntities: payload.linkedEntities || {},
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
  failedAreas: () => Array.from(FAILED).map(k => AREA[k] || k),
  definitions: () => DEFS,
  definition,
  instances,
  instance,
  start,
  advance,
  cancel,
  reset,
};
