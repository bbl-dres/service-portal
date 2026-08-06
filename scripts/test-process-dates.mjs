// W-21: process dates and reference years must use one local calendar date.
// The frozen instant is already 1 January in Zurich but still 31 December UTC.
import { readFile } from 'node:fs/promises';

process.env.TZ = 'Europe/Zurich';

const definitions = JSON.parse(await readFile(new URL('../data/process-definitions.json', import.meta.url), 'utf8'));
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
let activeFetches = 0;
let maxActiveFetches = 0;
const initialRequests = [];
globalThis.fetch = async (url) => {
  initialRequests.push(String(url));
  activeFetches++;
  maxActiveFetches = Math.max(maxActiveFetches, activeFetches);
  await new Promise((resolve) => setTimeout(resolve, 15));
  activeFetches--;
  return {
    ok: true,
    status: 200,
    json: async () => String(url).includes('process-definitions') ? definitions : [],
  };
};

const NativeDate = globalThis.Date;
const instant = '2026-12-31T23:30:00.000Z';
class FrozenDate extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [instant])); }
  static now() { return NativeDate.parse(instant); }
}
globalThis.Date = FrozenDate;

let failures = 0;
const check = (condition, label, actual = '') => {
  console.log(`${condition ? '✓' : '✗'} ${label}${actual ? ` (${actual})` : ''}`);
  if (!condition) failures++;
};

try {
  const { engine } = await import('../js/process-engine.js');
  await engine.load();
  check(initialRequests.length === 2 && maxActiveFetches === 2,
    'independent process files load concurrently', `${initialRequests.length} requests, max ${maxActiveFetches}`);

  const created = engine.start('raumbedarf');
  check(!!created, 'process starts from the fixture definition');
  if (created) {
    check(created.createdAt === '2027-01-01', 'creation uses the Zurich calendar date', created.createdAt);
    check(created.updatedAt === created.createdAt, 'created and updated dates share one stamp', created.updatedAt);
    check(created.history[0].when === created.createdAt, 'initial history shares the creation stamp', created.history[0].when);
    check(/^BBL-2027-/.test(created.reference), 'reference year matches the local calendar year', created.reference);

    const advanced = engine.advance(created.instanceId);
    check(advanced?.updatedAt === '2027-01-01', 'advance uses the local calendar date', advanced?.updatedAt);
    check(advanced?.history.at(-1)?.when === advanced?.updatedAt, 'advance history shares its update stamp', advanced?.history.at(-1)?.when);

    const cancelled = engine.cancel(created.instanceId);
    check(cancelled?.updatedAt === '2027-01-01', 'cancellation uses the local calendar date', cancelled?.updatedAt);
    check(cancelled?.history.at(-1)?.when === cancelled?.updatedAt, 'cancellation history shares its update stamp', cancelled?.history.at(-1)?.when);
  }

  engine.reset();
  const defFixture = [{ defId: 'test-def', name: 'Test', steps: [{ status: 'neu', label: 'Neu' }] }];
  const instanceFixture = [{ instanceId: 'seed-test', defId: 'test-def', data: {} }];
  const useFetchScenario = ({ defs = defFixture, seeded = instanceFixture, failDefs = false, failSeeded = false }) => {
    globalThis.fetch = async (url) => {
      const isDefinitions = String(url).includes('process-definitions');
      const failed = isDefinitions ? failDefs : failSeeded;
      return {
        ok: !failed,
        status: failed ? 503 : 200,
        json: async () => isDefinitions ? defs : seeded,
      };
    };
  };

  useFetchScenario({ failSeeded: true });
  await engine.load();
  check(engine.definitions()[0]?.defId === 'test-def' && engine.instances().length === 0,
    'an instances failure retains definitions and clears seeded instances');
  check(engine.available('definitions') && !engine.available('instances')
      && engine.failedAreas().join(',') === 'Vorgänge',
    'an instances failure reports only the instances area', engine.failedAreas().join(', '));

  useFetchScenario({ failDefs: true });
  await engine.load();
  check(engine.definitions().length === 0 && engine.instances()[0]?.instanceId === 'seed-test',
    'a definitions failure clears definitions and retains seeded instances');
  check(!engine.available('definitions') && engine.available('instances')
      && engine.failedAreas().join(',') === 'Prozessdefinitionen',
    'a definitions failure reports only the definitions area', engine.failedAreas().join(', '));

  useFetchScenario({ failDefs: true, failSeeded: true });
  await engine.load();
  check(engine.definitions().length === 0 && engine.instances().length === 0,
    'two failures clear both stale process arrays');
  check(engine.failedAreas().length === 2, 'two failures report both process areas', engine.failedAreas().join(', '));

  const retryDefs = [{ ...defFixture[0], defId: 'retry-def' }];
  const retryInstances = [{ ...instanceFixture[0], instanceId: 'retry-instance' }];
  useFetchScenario({ defs: retryDefs, seeded: retryInstances });
  await engine.load();
  check(engine.definitions()[0]?.defId === 'retry-def' && engine.instances()[0]?.instanceId === 'retry-instance',
    'a successful retry replaces both process arrays');
  check(engine.failedAreas().length === 0 && engine.available('definitions') && engine.available('instances'),
    'a successful retry clears all failure flags');
} finally {
  globalThis.Date = NativeDate;
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
