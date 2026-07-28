// Mock process engine ("Camunda, but mocked").
// Process definitions + seeded instances come from data/. User-created instances
// (Vorgänge) live in localStorage so the service->process->Meine-Vorgänge loop works.
// NOTE: this is the *demo* engine — see docs/expert-review.md for the real-vs-mocked register.

import { readJSON, writeJSON } from './storage.js';
import { fetchJSON } from './fetch-json.js';

const LS_KEY = 'bbl_vorgaenge_v1';
let DEFS = [];
let SEEDED = [];

// Ausfallregister — dasselbe Prinzip wie in core.js. Ohne das blieb ein 404 auf
// process-definitions.json unsichtbar: DEFS = [], keine Meldung, und start()
// erfand sich eine Ersatzdefinition (H10).
const FAILED = new Set();
const AREA = { definitions: 'Prozessdefinitionen', instances: 'Vorgänge' };

function loadLS() { const a = readJSON(LS_KEY, []); return Array.isArray(a) ? a : []; }
function saveLS(arr) { return writeJSON(LS_KEY, arr); }   // → bool, damit Aufrufer stillen Verlust erkennen (C1)

async function load() {
  FAILED.clear();
  try { DEFS = await fetchJSON('data/process-definitions.json', { shape: 'array' }); } catch (e) { console.warn('[engine] definitions', e && e.message); DEFS = []; FAILED.add('definitions'); }
  try { SEEDED = await fetchJSON('data/process-instances.json', { shape: 'array' }); } catch (e) { console.warn('[engine] instances', e && e.message); SEEDED = []; FAILED.add('instances'); }
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

// Gibt die neue Instanz zurück — oder null, wenn sie NICHT angelegt werden konnte.
// null heisst hier zweierlei: unbekannte Definition oder Speicherfehler. Beides
// muss der Aufrufer als Fehlschlag zeigen, nie als Erfolg.
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
  const inst = {
    instanceId: 'inst-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    defId,
    defName: def.name,
    reference: genRef(),
    title: payload.title || def.name,
    requester: payload.requester || 'Andrea Muster',
    organization: payload.organization || 'Bundesamt (Demo)',
    audience: def.audience,
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
  available: (key) => !FAILED.has(key),
  failedAreas: () => Array.from(FAILED).map(k => AREA[k] || k),
  definitions: () => DEFS,
  definition,
  instances,
  instance,
  start,
  advance,
  reset,
};

export default engine;
