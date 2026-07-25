// Mock process engine ("Camunda, but mocked").
// Process definitions + seeded instances come from data/. User-created instances
// (Vorgänge) live in localStorage so the service->process->Meine-Vorgänge loop works.
// NOTE: this is the *demo* engine — see docs/expert-review.md for the real-vs-mocked register.

import { readJSON, writeJSON } from './storage.js';

const LS_KEY = 'bbl_vorgaenge_v1';
let DEFS = [];
let SEEDED = [];

function loadLS() { const a = readJSON(LS_KEY, []); return Array.isArray(a) ? a : []; }
function saveLS(arr) { return writeJSON(LS_KEY, arr); }   // → bool, damit Aufrufer stillen Verlust erkennen (C1)

async function fetchArray(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const json = await r.json();
  return Array.isArray(json) ? json : [];
}

async function load() {
  try { DEFS = await fetchArray('data/process-definitions.json'); } catch (e) { console.warn('[engine] definitions', e && e.message); DEFS = []; }
  try { SEEDED = await fetchArray('data/process-instances.json'); } catch (e) { console.warn('[engine] instances', e && e.message); SEEDED = []; }
}

const definition = (id) => DEFS.find(d => d.defId === id);
const today = () => new Date().toISOString().slice(0, 10);

function genRef() {
  const y = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `BBL-${y}-${n}`;
}

// all instances visible to the current (mock) user = seeded + locally created
function instances() { return [...loadLS(), ...SEEDED]; }
const instance = (id) => instances().find(i => i.instanceId === id);

function start(defId, payload = {}) {
  const def = definition(defId);
  const steps = (def && def.steps) || [{ status: 'eingereicht', label: 'Eingereicht' }];
  const first = steps[0];
  const inst = {
    instanceId: 'inst-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    defId,
    defName: def ? def.name : defId,
    reference: genRef(),
    title: payload.title || (def ? def.name : 'Vorgang'),
    requester: payload.requester || 'Andrea Muster',
    organization: payload.organization || 'Bundesamt (Demo)',
    audience: def ? def.audience : 'internal',
    status: first.status,
    stepIndex: 0,
    createdAt: today(),
    updatedAt: today(),
    data: payload.data || {},
    linkedEntities: payload.linkedEntities || {},
    createdLocally: true,
    history: [{ when: today(), status: first.label, note: 'Vorgang erstellt' }],
  };
  const arr = loadLS();
  arr.unshift(inst);
  return saveLS(arr) ? inst : null;   // null = Speichern fehlgeschlagen (kein Schein-Erfolg)
}

// Demo affordance: advance a locally-created instance to its next step.
function advance(id) {
  const arr = loadLS();
  const inst = arr.find(i => i.instanceId === id);
  if (!inst) return null;
  const def = definition(inst.defId);
  if (!def || !Array.isArray(def.steps) || inst.stepIndex >= def.steps.length - 1) return inst;
  inst.stepIndex += 1;
  const step = def.steps[inst.stepIndex];
  inst.status = step.status;
  inst.updatedAt = today();
  inst.history.push({ when: today(), status: step.label, note: step.role ? `Schritt durch ${step.role} (Demo)` : 'Status aktualisiert (Demo)' });
  return saveLS(arr) ? inst : null;
}

function reset() { saveLS([]); }

export const engine = {
  load,
  definitions: () => DEFS,
  definition,
  instances,
  instance,
  start,
  advance,
  reset,
};

export default engine;
