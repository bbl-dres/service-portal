// Regression coverage for data-shape, retry and browser-storage failure paths.
// Pure Node: fetch and localStorage are deterministic in-memory adapters.

const values = new Map();
const failSet = new Set();
const failRemove = new Set();
const failGet = new Set();
globalThis.localStorage = {
  getItem(key) {
    if (failGet.has(key)) throw new Error('read blocked');
    return values.has(key) ? values.get(key) : null;
  },
  setItem(key, value) {
    if (failSet.has(key)) throw new Error('write blocked');
    values.set(key, String(value));
  },
  removeItem(key) {
    if (failRemove.has(key)) throw new Error('remove blocked');
    values.delete(key);
  },
};

const replies = new Map();
const requests = new Map();
const queue = (url, ...payloads) => replies.set(url, payloads);
globalThis.fetch = async (input) => {
  const url = String(input);
  requests.set(url, (requests.get(url) || 0) + 1);
  const pending = replies.get(url) || [];
  if (!pending.length) throw new Error(`unexpected fetch: ${url}`);
  const payload = pending.shift();
  if (payload instanceof Error) throw payload;
  const resolved = typeof payload === 'function' ? await payload() : payload;
  return { ok: true, status: 200, json: async () => structuredClone(resolved) };
};

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

console.log('■ Core data contracts');
queue('data/services.json', [{ serviceId: 'service-1' }]);
queue('data/reference-data.json', { domains: [] });
const { core } = await import('../js/core/index.js');
await core.load();
check(core.services().length === 1, 'valid eager records load');

const beforeUnknown = [...requests.values()].reduce((sum, count) => sum + count, 0);
let unknownRejected = false;
try { await core.ensure('toString'); } catch { unknownRejected = true; }
const afterUnknown = [...requests.values()].reduce((sum, count) => sum + count, 0);
check(unknownRejected && beforeUnknown === afterUnknown,
  'an inherited/unknown need rejects without fetching');

queue('data/projects.json', [null], [{ projectId: 'project-1' }]);
await core.ensure('projects');
check(!core.available('projects') && core.projects().length === 0,
  'a null list record is reported as unavailable');
await core.ensure('projects');
check(core.available('projects') && core.projects()[0]?.projectId === 'project-1'
  && requests.get('data/projects.json') === 2,
  'a failed deferred list retries and clears its failure flag');

queue('data/news.json', [{}], [{ id: 'news-1' }]);
await core.ensure('news');
check(!core.available('news'), 'a record without its required identifier is rejected');
await core.ensure('news');
check(core.available('news') && core.news()[0]?.id === 'news-1',
  'a corrected identified record succeeds on retry');

queue('data/business-objects.json', [{ objectId: 'broken', attributes: 'not-an-array' }], [{
  objectId: 'object-1', name: 'Object', attributes: [{ name: 'Field', mappings: [] }],
}]);
await core.ensure('businessObjects');
check(!core.available('businessObjects'), 'a malformed nested business-object shape is rejected');
await core.ensure('businessObjects');
check(core.available('businessObjects') && core.realisationsOf(core.businessObject('object-1')).length === 0,
  'safe nested business-object data succeeds on retry');

queue('data/buildings.geojson',
  { type: 'FeatureCollection', features: [null] },
  { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: null }] },
  { type: 'FeatureCollection', features: [{
    type: 'Feature', properties: { bbl_id: 'A/1/AA', bbl_bez: 'Test' }, geometry: null,
  }] });
await core.ensure('buildings');
check(!core.available('buildings'), 'a malformed GeoJSON feature is rejected');
await core.ensure('buildings');
check(!core.available('buildings'), 'a GeoJSON feature without its required identifier is rejected');
await core.ensure('buildings');
check(core.available('buildings') && core.buildings()[0]?.bbl_id === 'A/1/AA',
  'a valid FeatureCollection succeeds on retry');

queue('data/contacts.json', async () => {
  await new Promise((resolve) => setTimeout(resolve, 15));
  return [{ contactId: 'contact-1' }];
});
await Promise.all([core.ensure('contacts'), core.ensure('contacts')]);
check(requests.get('data/contacts.json') === 1, 'concurrent deferred needs share one request');

queue('data/catalog-labels.json', { safe: 'Sicher' });
await core.ensure('catalogLabels');
check(core.label('safe') === 'Sicher' && core.label('toString', 'Fallback') === 'Fallback',
  'catalog labels use own properties only');

console.log('■ Dashboard data contracts');
queue('data/dashboards.json', {
  topics: [], dashboards: [], datasets: { broken: { columns: [null], rows: [] } },
}, {
  topics: [{ id: 'topic-1' }],
  dashboards: [{ id: 'dashboard-1', topicId: 'topic-1' }],
  datasets: { sample: { label: 'Sample', columns: [{ name: 'value' }], rows: [[1]] } },
}, {
  topics: [{ id: 'topic-1' }],
  dashboards: [{
    id: 'dashboard-1', topicId: 'topic-1', tabs: [], kpis: [],
    charts: [{ id: 'chart-1', query: { dataset: 'sample', orderBy: {} } }],
  }],
  datasets: { sample: { label: 'Sample', columns: [{ name: 'value' }], rows: [[1]] } },
}, {
  topics: [{ id: 'topic-1' }],
  dashboards: [{ id: 'dashboard-1', topicId: 'topic-1', charts: [], tabs: [], kpis: [] }],
  datasets: { sample: { label: 'Sample', columns: [{ name: 'value' }], rows: [[1]] } },
});
const { dashData } = await import('../js/core/dashboard-data.js');
const firstDashboardLoad = dashData.load();
const duplicateDashboardLoad = dashData.load();
check(firstDashboardLoad === duplicateDashboardLoad, 'concurrent dashboard loads share one promise');
await Promise.all([firstDashboardLoad, duplicateDashboardLoad]);
check(!dashData.ok() && dashData.dashboards().length === 0,
  'a malformed nested dashboard payload is unavailable, not plausibly empty data');
await dashData.load();
check(!dashData.ok(), 'a dashboard without its required charts list is rejected');
await dashData.load();
check(!dashData.ok(), 'malformed chart query fields are rejected at the load boundary');
await dashData.load();
check(dashData.ok() && dashData.dataset('sample')?.rows.length === 1
  && requests.get('data/dashboards.json') === 4,
  'dashboard data retries after a failed shape check');
check(dashData.dataset('toString') === undefined,
  'dashboard dataset lookup ignores inherited properties');
check(!!dashData.query({ dataset: 'sample', orderBy: {} }).error,
  'the public query boundary rejects malformed sort fields without throwing');

console.log('■ Session persistence');
const SESSION_KEY = 'bbl_session_v1';
const { session } = await import('../js/core/session.js');
failSet.add(SESSION_KEY);
check(session.login() === false && !session.isLoggedIn(),
  'failed login persistence does not mutate the in-memory session');
failSet.delete(SESSION_KEY);
check(!!session.login() && session.isLoggedIn(), 'a persisted login succeeds');
failRemove.add(SESSION_KEY);
check(session.logout() === false && session.isLoggedIn(),
  'failed logout persistence retains the in-memory user');
failRemove.delete(SESSION_KEY);
check(session.logout() === true && !session.isLoggedIn(), 'a persisted logout succeeds');

console.log('■ Own-property favorite maps');
values.set('bbl_favorites_v1', '{"__proto__":["proto-id"],"toString":["string-id"]}');
const { favorites } = await import('../js/core/favorites.js');
check(favorites.has('__proto__', 'proto-id') && favorites.has('toString', 'string-id')
  && favorites.list('constructor').length === 0,
  'favorite kinds remain data, never object prototypes');

console.log('■ Process storage and malformed records');
const PROCESS_KEY = 'bbl_vorgaenge_v1';
const PROCESS_LOCK = `${PROCESS_KEY}.__lock__`;
values.delete(PROCESS_KEY);
queue('data/process-definitions.json', [{
  defId: 'broken', name: 'Broken', steps: [{}],
}], [{
  defId: 'demo', name: 'Demo', steps: [
    { status: 'new', label: 'New' }, { status: 'done', label: 'Done' },
  ],
}]);
queue('data/process-instances.json', [{
  instanceId: 'seed-broken', defId: 'broken', history: {}, attachments: 'wrong',
}], [{ instanceId: 'seed-ok', defId: 'demo', history: [], attachments: [] }]);
const { engine } = await import('../js/process-engine.js');
await engine.load();
check(!engine.available('definitions') && !engine.available('instances')
  && engine.definitions().length === 0 && engine.instances().length === 0,
  'malformed definitions and truthy wrong-type instance collections fail visibly');
await engine.load();
check(engine.available('definitions') && engine.available('instances')
  && engine.definitions().length === 1 && engine.instances().length === 1,
  'corrected process files recover on retry');

values.set(PROCESS_KEY, JSON.stringify([null, {
  instanceId: 'local-ok', defId: 'demo', stepIndex: 0,
  history: [null], attachments: [null],
}]));
const advanced = engine.advance('local-ok');
check(advanced?.stepIndex === 1 && advanced.history.length === 1 && advanced.attachments.length === 0,
  'malformed local history and attachment entries are repaired before use');
check(engine.advance('missing') === null, 'a missing instance is a distinguishable no-op');

failSet.add(PROCESS_KEY);
check(engine.start('demo') === false, 'a failed process write is a distinguishable failure');
check(engine.reset() === false, 'reset reports a storage write failure');
failSet.delete(PROCESS_KEY);
check(engine.start('missing-definition') === null,
  'an unknown process definition remains a distinguishable no-op');

values.set(PROCESS_LOCK, JSON.stringify({ token: 'other-tab', expires: Date.now() + 60_000 }));
check(engine.cancel('local-ok') === false, 'a live cross-tab lease prevents a lost update');
values.delete(PROCESS_LOCK);
check(engine.reset() === true && JSON.parse(values.get(PROCESS_KEY)).length === 0,
  'a successful reset persists and reports success');

values.set(PROCESS_KEY, '{not-json');
check(engine.start('demo') === false && values.get(PROCESS_KEY) === '{not-json',
  'a corrupt local process store is not silently overwritten');

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all resilience checks passed'}`);
process.exit(failures ? 1 : 0);
