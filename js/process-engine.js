// Mock process engine ("Camunda, but mocked").
// Process definitions + seeded instances come from data/. User-created instances
// (Vorgänge) live in localStorage so the service->process->Meine-Vorgänge loop works.
// NOTE: this is the *demo* engine — see docs/expert-review.md for the real-vs-mocked register.

const LS_KEY = 'bbl_vorgaenge_v1';
let DEFS = [];
let SEEDED = [];

function loadLS() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
function saveLS(arr) { try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch (e) { console.warn('[engine] localStorage unavailable', e); } }

async function load() {
  try { DEFS = await (await fetch('data/process-definitions.json')).json(); } catch (e) { DEFS = []; }
  try { SEEDED = await (await fetch('data/process-instances.json')).json(); } catch (e) { SEEDED = []; }
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
    instanceId: 'inst-' + Date.now(),
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
  saveLS(arr);
  return inst;
}

// Demo affordance: advance a locally-created instance to its next step.
function advance(id) {
  const arr = loadLS();
  const inst = arr.find(i => i.instanceId === id);
  if (!inst) return null;
  const def = definition(inst.defId);
  if (!def || inst.stepIndex >= def.steps.length - 1) return inst;
  inst.stepIndex += 1;
  const step = def.steps[inst.stepIndex];
  inst.status = step.status;
  inst.updatedAt = today();
  inst.history.push({ when: today(), status: step.label, note: step.role ? `Schritt durch ${step.role} (Demo)` : 'Status aktualisiert (Demo)' });
  saveLS(arr);
  return inst;
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
