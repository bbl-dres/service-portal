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

queue('data/applications.json',
  [{ appId: 'duplicate' }, { appId: 'duplicate' }],
  [{ appId: 'application-1' }]);
await core.ensure('applications');
check(!core.available('applications'), 'duplicate record identifiers are rejected');
await core.ensure('applications');
check(core.available('applications') && core.application('application-1'),
  'a duplicate-identifier failure remains retryable');

queue('data/users.json',
  [{ userId: 'duplicate' }, { userId: 'duplicate' }],
  [{ userId: 'user-1', name: 'User' }]);
await core.ensure('users');
check(!core.available('users'), 'duplicate user identifiers are rejected');
await core.ensure('users');
check(core.available('users') && core.user('user-1'), 'a corrected user registry succeeds on retry');

const workspaceExampleImage = {
  imageId: 'WSE-TEST-01',
  kind: 'generated-visualisation',
  src: 'assets/images/workspace-examples/example-one-01.jpg',
  title: 'Example visualisation',
  alt: 'Illustrative workspace example',
  caption: 'Illustrative, non-binding visualisation.',
  credit: 'OpenAI, 2026',
  license: 'Prototype use',
  provenance: 'Generated with OpenAI for the prototype; not a photograph.',
};
const workspaceExampleRecord = {
  exampleId: 'example-1',
  slug: 'example-one',
  contextMediaId: 'MED-001',
  images: [workspaceExampleImage],
  referenceMediaIds: ['MED-001'],
};
queue('data/workspace-examples.json', {
  examples: [
    workspaceExampleRecord,
    {
      ...workspaceExampleRecord,
      slug: 'example-two',
      images: [{
        ...workspaceExampleImage,
        imageId: 'WSE-TEST-02',
        src: 'assets/images/workspace-examples/example-two-01.jpg',
      }],
    },
  ],
}, {
  examples: [null],
}, {
  examples: [{ ...workspaceExampleRecord, images: [] }],
}, {
  examples: [{ ...workspaceExampleRecord, contextMediaId: undefined }],
}, {
  examples: [{ ...workspaceExampleRecord, contextMediaId: 'med-001' }],
}, {
  examples: [{ ...workspaceExampleRecord, contextMediaId: 'MED-002' }],
}, {
  examples: [{
    ...workspaceExampleRecord,
    mediaIds: ['MED-001'],
    coverMediaId: 'MED-001',
  }],
}, {
  examples: [{
    ...workspaceExampleRecord,
    images: [{ ...workspaceExampleImage, provenance: undefined }],
  }],
}, {
  examples: [{
    ...workspaceExampleRecord,
    images: [{ ...workspaceExampleImage, extra: 'not part of the contract' }],
  }],
}, {
  examples: [{
    ...workspaceExampleRecord,
    images: [{
      ...workspaceExampleImage,
      src: 'assets/images/workspace-examples/../secret.jpg',
    }],
  }],
}, {
  examples: [{
    ...workspaceExampleRecord,
    images: [{ ...workspaceExampleImage, kind: 'photo' }],
  }],
}, {
  examples: [{
    ...workspaceExampleRecord,
    images: [{ ...workspaceExampleImage, src: 'assets/images/workspace-examples/example-one.jpeg' }],
  }],
}, {
  examples: [{
    ...workspaceExampleRecord,
    images: [
      workspaceExampleImage,
      {
        ...workspaceExampleImage,
        src: 'assets/images/workspace-examples/example-one-02.jpg',
      },
    ],
  }],
}, {
  examples: [{
    ...workspaceExampleRecord,
    images: [
      workspaceExampleImage,
      {
        ...workspaceExampleImage,
        imageId: 'WSE-TEST-02',
        src: 'assets/images/workspace-examples/EXAMPLE-ONE-01.JPG',
      },
    ],
  }],
}, {
  examples: [{ ...workspaceExampleRecord, referenceMediaIds: ['MED-001', 'MED-001'] }],
}, {
  examples: [{ ...workspaceExampleRecord, referenceMediaIds: ['med-001'] }],
}, {
  examples: [{
    ...workspaceExampleRecord,
    images: [
      workspaceExampleImage,
      {
        ...workspaceExampleImage,
        imageId: 'WSE-TEST-02',
        src: 'assets/images/workspace-examples/example-one-02.jpg',
        title: 'Second example visualisation',
      },
    ],
  }],
});
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'duplicate nested workspace-example IDs are rejected');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'primitive workspace-example records fail closed without throwing');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'workspace examples require a non-empty image collection');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'workspace examples require a context media identifier');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'workspace-example context media uses a canonical MED identifier');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'workspace-example context media belongs to its legacy references');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'retired workspace-example media cover fields are rejected');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'incomplete workspace-example image metadata is rejected');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'workspace-example images reject fields outside the exact contract');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'workspace-example images cannot escape their local asset directory');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'workspace-example images declare their generated visualisation kind');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'workspace-example images use the canonical .jpg extension');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'workspace-example image IDs are unique');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'workspace-example image paths are unique regardless of case');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'workspace-example media references are duplicate-free');
await core.ensure('workspaceExamples');
check(!core.available('workspaceExamples'), 'workspace-example media references use canonical MED identifiers');
await core.ensure('workspaceExamples');
check(core.available('workspaceExamples')
  && core.workspaceExamples().find((example) => example.slug === 'example-one')?.contextMediaId === 'MED-001'
  && core.workspaceExamples().find((example) => example.slug === 'example-one')?.images
    .map((image) => image.imageId).join('|') === 'WSE-TEST-01|WSE-TEST-02',
  'a corrected registry preserves its context and ordered generated-image collection');

const moduleRecord = {
  nr: 1,
  slug: 'module-one',
  name: 'Module One',
  summary: 'A module used by the data-contract test.',
  description: 'A complete module used by the data-contract test.',
  subModules: [{ nr: '1.1', name: 'Module One variant', area: 3, persons: 1 }],
  equipment: [],
  guidelines: [],
  images: [],
};
const moduleImage = {
  src: 'assets/images/multispace-modules/module-one-01.jpg',
  alt: 'Illustrative module',
  caption: 'Illustrative, non-binding module image.',
  credit: 'OpenAI, 2026',
  license: 'Prototype use',
  provenance: 'Generated with OpenAI for the prototype.',
};
queue('data/multispace-modules.json',
  { modules: [moduleRecord, moduleRecord] },
  { modules: [{ ...moduleRecord, subModules: [{ nr: '1.1', name: 'Broken', area: Infinity, persons: 1 }] }] },
  { modules: [{ ...moduleRecord, subModules: [{ nr: '../1', name: 'Broken', area: 3, persons: 1 }] }] },
  { modules: [{ ...moduleRecord, image: moduleImage.src }] },
  { modules: [{ ...moduleRecord, images: [{ src: moduleImage.src }] }] },
  { modules: [{ ...moduleRecord, images: [{ ...moduleImage, src: 'assets/images/multispace-modules/../secret.jpg' }] }] },
  { modules: [
    { ...moduleRecord, images: [moduleImage] },
    { ...moduleRecord, nr: 2, slug: 'module-two', subModules: [{ ...moduleRecord.subModules[0], nr: '2.1' }], images: [
      { ...moduleImage, src: 'assets/images/multispace-modules/module-one-01.JPG' },
    ] },
  ] },
  { modules: [
    moduleRecord,
    { ...moduleRecord, nr: 2, slug: 'module-two', subModules: [{ ...moduleRecord.subModules[0], nr: '2.1' }], images: [
      { ...moduleImage, src: 'assets/images/multispace-modules/module-two-hero.jpg' },
      { ...moduleImage, src: 'assets/images/multispace-modules/module-two-detail.jpg' },
    ] },
  ] });
await core.ensure('multispaceModules');
check(!core.available('multispaceModules'), 'duplicate nested module numbers are rejected');
await core.ensure('multispaceModules');
check(!core.available('multispaceModules'), 'malformed submodule figures are rejected');
await core.ensure('multispaceModules');
check(!core.available('multispaceModules'), 'unsafe submodule identifiers are rejected');
await core.ensure('multispaceModules');
check(!core.available('multispaceModules'), 'the retired scalar module-image field is rejected');
await core.ensure('multispaceModules');
check(!core.available('multispaceModules'), 'incomplete module-image metadata is rejected');
await core.ensure('multispaceModules');
check(!core.available('multispaceModules'), 'module images cannot escape their local asset directory');
await core.ensure('multispaceModules');
check(!core.available('multispaceModules'), 'duplicate module-image paths are rejected across modules');
await core.ensure('multispaceModules');
check(core.available('multispaceModules') && core.multispaceModule(1)?.images.length === 0
  && core.multispaceModule(2)?.images.map((image) => image.src).join('|')
    === 'assets/images/multispace-modules/module-two-hero.jpg|assets/images/multispace-modules/module-two-detail.jpg',
  'a corrected registry preserves an empty fallback and ordered image heroes');

queue('data/shop-categories.json', [{
  id: 'duplicate', children: [{ id: 'duplicate', children: [] }],
}], [{ id: 'root', children: [{ id: 'child', children: [] }] }]);
await core.ensure('shopCategories');
check(!core.available('shopCategories'), 'duplicate recursive shop-category IDs are rejected');
await core.ensure('shopCategories');
check(core.available('shopCategories') && core.shopCategories().length === 1,
  'a corrected category tree succeeds on retry');

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
  { type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { bbl_id: 'A/1/AA' }, geometry: null },
    { type: 'Feature', properties: { bbl_id: 'A/1/AA' }, geometry: null },
  ] },
  { type: 'FeatureCollection', features: [{
    type: 'Feature', properties: { bbl_id: 'A/1/AA', bbl_bez: 'Test' }, geometry: null,
  }] });
await core.ensure('buildings');
check(!core.available('buildings'), 'a malformed GeoJSON feature is rejected');
await core.ensure('buildings');
check(!core.available('buildings'), 'a GeoJSON feature without its required identifier is rejected');
await core.ensure('buildings');
check(!core.available('buildings'), 'duplicate GeoJSON identifiers are rejected');
await core.ensure('buildings');
check(core.available('buildings') && core.buildings()[0]?.bbl_id === 'A/1/AA',
  'a valid FeatureCollection succeeds on retry');

queue('data/landcovers.geojson', { type: 'FeatureCollection', features: [
  { type: 'Feature', properties: { bbl_id: 'PARCEL/1', av_type: 'Building' }, geometry: null },
  { type: 'Feature', properties: { bbl_id: 'PARCEL/1', av_type: 'Garden' }, geometry: null },
] });
await core.ensure('landcovers');
check(core.available('landcovers') && core.data.landcovers.length === 2,
  'multiple land-cover polygons may legitimately share one parcel identifier');

queue('data/processes.json', [{
  processId: 7, branch: 'portal', name: 'Numeric ID',
  steps: [{ status: 'new', label: 'New' }],
}], [{
  processId: 'broken', branch: 'portal', name: 'Broken', steps: [{}],
}], [{
  processId: 'business', branch: 'fachlich', name: 'Business process',
}, {
  processId: 'workflow', branch: 'portal', name: 'Portal workflow',
  steps: [{ status: 'new', label: 'New' }],
}]);
await core.ensure('processes');
check(!core.available('processes'), 'non-canonical process identifiers fail at the shared core boundary');
await core.ensure('processes');
check(!core.available('processes'), 'malformed portal workflow steps fail at the shared core boundary');
await core.ensure('processes');
check(core.available('processes') && core.processes().length === 2
  && core.processDefinitions()[0]?.processId === 'workflow'
  && !Object.hasOwn(core.processDefinitions()[0], 'defId'),
  'the shared process source exposes validated raw portal records');
const { layers } = await import('../js/pages/architecture.js');
check(layers(core)[0]?.count === '1 Prozesse',
  'business-architecture counts exclude executable portal workflows');
const { resolveBookmarks } = await import('../js/ui/bookmark-kinds.js');
const processBookmarks = resolveBookmarks(core, [
  { kind: 'process', id: 'business' }, { kind: 'process', id: 'workflow' },
]).rows;
check(processBookmarks[0]?.href === '#/app/process-docs?id=business'
  && processBookmarks[1]?.href === '#/app/process-docs?def=workflow',
  'process bookmarks preserve the business or portal detail branch');

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
  topics: [], dashboards: [],
  datasets: { broken: { columns: [{ name: 'value' }, { name: 'value' }], rows: [[1, 2]] } },
}, {
  topics: [], dashboards: [],
  datasets: { broken: { columns: [{ name: 'name' }, { name: 'value' }], rows: [['missing']] } },
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
  dashboards: [{
    id: 'dashboard-1', topicId: 'topic-1', tabs: [], kpis: [],
    charts: [{ id: 'x\"><img src=x onerror=alert(1)>', query: { dataset: 'sample' } }],
  }],
  datasets: { sample: { label: 'Sample', columns: [{ name: 'value' }], rows: [[1]] } },
}, {
  topics: [{ id: 'topic-1' }],
  dashboards: [{
    id: 'dashboard-1', topicId: 'topic-1', kpis: [],
    charts: [{ id: 'chart-1', query: { dataset: 'sample' } }],
    tabs: [{ id: 'x\" autofocus onfocus=alert(1)', charts: ['chart-1'] }],
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
check(!dashData.ok(), 'duplicate dashboard column names are rejected');
await dashData.load();
check(!dashData.ok(), 'dashboard rows must match their declared column count');
await dashData.load();
check(!dashData.ok(), 'a dashboard without its required charts list is rejected');
await dashData.load();
check(!dashData.ok(), 'malformed chart query fields are rejected at the load boundary');
await dashData.load();
check(!dashData.ok(), 'chart IDs that cannot form safe DOM tokens are rejected');
await dashData.load();
check(!dashData.ok(), 'tab IDs that cannot form safe DOM tokens are rejected');
await dashData.load();
check(dashData.ok() && dashData.dataset('sample')?.rows.length === 1
  && requests.get('data/dashboards.json') === 8,
  'dashboard data retries after a failed shape check');
check(dashData.dataset('toString') === undefined,
  'dashboard dataset lookup ignores inherited properties');
check(!!dashData.query({ dataset: 'sample', orderBy: {} }).error,
  'the public query boundary rejects malformed sort fields without throwing');

console.log('■ Session persistence');
const SESSION_KEY = 'bbl_session_v1';
// Import with an untouched profile: that is the application's first visit, and
// it must produce the complete demo user rather than a logged-out shell.
values.delete(SESSION_KEY);
const { session } = await import('../js/core/session.js');
check(session.isLoggedIn() && session.user()?.name === 'Andrea Muster',
  'an untouched profile starts logged in as the demo user');
// Logging out must leave a trace, otherwise the default above signs the user
// back in on the next load and the logged-out state is unreachable.
check(session.logout() === true && !session.isLoggedIn()
  && values.get(SESSION_KEY) === JSON.stringify('signed-out'),
  'logout records the signed-out marker instead of removing the key');
failSet.add(SESSION_KEY);
check(session.login() === false && !session.isLoggedIn(),
  'failed login persistence does not mutate the in-memory session');
failSet.delete(SESSION_KEY);
check(!!session.login() && session.isLoggedIn(), 'a persisted login succeeds');
failSet.add(SESSION_KEY);
check(session.logout() === false && session.isLoggedIn(),
  'failed logout persistence retains the in-memory user');
failSet.delete(SESSION_KEY);
check(session.logout() === true && !session.isLoggedIn(), 'a persisted logout succeeds');

console.log('■ Own-property favorite maps');
// The legacy anonymous store is migrated on first read (js/core/bookmarks.js).
// Its keys were free-form, so a hostile one could name a prototype member; the
// bookmark store admits only its own vocabulary, which drops those outright
// rather than carrying them as data. Anything the person actually saved still
// survives the migration.
values.set('bbl_favorites_v1', '{"__proto__":["proto-id"],"toString":["string-id"],"building":["1080/4840/AF"]}');
values.delete('bbl_bookmarks_v1');
const { session: bmSession } = await import('../js/core/session.js');
bmSession.login();
const { bookmarks } = await import('../js/core/bookmarks.js');
const migrated = bookmarks.listKind('building');
check(!bookmarks.has('__proto__', 'proto-id') && !bookmarks.has('toString', 'string-id')
  && bookmarks.listKind('constructor').length === 0
  && migrated.length === 1 && migrated[0] === '1080/4840/AF',
  'unknown legacy kinds are dropped, never carried as data or prototypes', migrated.join(','));
check(values.get('bbl_favorites_v1') === undefined,
  'the migrated legacy key is removed so it cannot be folded in twice');
check(Object.getPrototypeOf(JSON.parse(values.get('bbl_bookmarks_v1'))) === Object.prototype
  && !('proto-id' in {}),
  'the written store carries no inherited members');

console.log('■ Process storage and malformed records');
const BOOKMARK_KEY = 'bbl_bookmarks_v1';
values.set('bbl_favorites_v1', '{"room":["retry-room"]}');
values.delete(BOOKMARK_KEY);
bookmarks.reset();
failSet.add(BOOKMARK_KEY);
const transientMigration = bookmarks.listKind('room');
check(transientMigration.includes('retry-room')
  && values.has('bbl_favorites_v1') && !values.has(BOOKMARK_KEY),
  'a failed migration write retains the legacy source for a later retry');
failSet.delete(BOOKMARK_KEY);
bookmarks.reset();
check(bookmarks.listKind('room').includes('retry-room')
  && !values.has('bbl_favorites_v1') && values.has(BOOKMARK_KEY),
  'a later successful read completes the retained migration');

const storedBookmarks = values.get(BOOKMARK_KEY);
const externalStore = JSON.parse(storedBookmarks);
externalStore[bmSession.user().userId].items.push({ kind: 'dataset', id: 'other-tab', addedAt: '2026-08-16' });
values.set(BOOKMARK_KEY, JSON.stringify(externalStore));
check(bookmarks.toggle('room', 'same-tab') === true
  && bookmarks.has('dataset', 'other-tab') && bookmarks.has('room', 'same-tab'),
  'a mutation reloads under the storage lease and preserves another tab\'s write');

const duplicatedBookmarks = JSON.parse(values.get(BOOKMARK_KEY));
const bookmarkUserId = bmSession.user().userId;
const duplicatedBookmark = duplicatedBookmarks[bookmarkUserId].items
  .find((entry) => entry.kind === 'room' && entry.id === 'same-tab');
duplicatedBookmarks[bookmarkUserId].items.push({ ...duplicatedBookmark });
values.set(BOOKMARK_KEY, JSON.stringify(duplicatedBookmarks));
bookmarks.reset();
check(bookmarks.toggle('room', 'same-tab') === false
  && !bookmarks.has('room', 'same-tab')
  && JSON.parse(values.get(BOOKMARK_KEY))[bookmarkUserId].items
    .filter((entry) => entry.kind === 'room' && entry.id === 'same-tab').length === 0,
  'duplicate persisted bookmarks collapse before a removal');

const storedAfterInterleave = values.get(BOOKMARK_KEY);
failSet.add(BOOKMARK_KEY);
check(bookmarks.toggle('dataset', 'not-persisted') === null
  && !bookmarks.has('dataset', 'not-persisted')
  && values.get(BOOKMARK_KEY) === storedAfterInterleave,
  'a failed bookmark addition rolls memory back and reports failure');
check(bookmarks.toggle('room', 'retry-room') === null
  && bookmarks.has('room', 'retry-room')
  && values.get(BOOKMARK_KEY) === storedAfterInterleave,
  'a failed bookmark removal restores the prior entry');
failSet.delete(BOOKMARK_KEY);

const PROCESS_KEY = 'bbl_vorgaenge_v1';
const PROCESS_LOCK = `${PROCESS_KEY}.__lock__`;
values.delete(PROCESS_KEY);
queue('data/processes.json', [{
  processId: 'broken', branch: 'portal', name: 'Broken', steps: [{}],
}], [{
  processId: 'duplicate', branch: 'portal', name: 'Duplicate',
  steps: [{ status: 'new', label: 'New' }],
}, {
  processId: 'duplicate', branch: 'portal', name: 'Duplicate again',
  steps: [{ status: 'new', label: 'New' }],
}], [{
  processId: 'business', branch: 'fachlich', name: 'Business process',
}, {
  processId: 'demo', branch: 'portal', name: 'Demo', steps: [
    { status: 'new', label: 'New' }, { status: 'done', label: 'Done' },
  ],
}], [{
  processId: 'business', branch: 'fachlich', name: 'Business process',
}, {
  processId: 'demo', branch: 'portal', name: 'Demo', steps: [
    { status: 'new', label: 'New' }, { status: 'done', label: 'Done' },
  ],
}]);
queue('data/process-instances.json', [{
  instanceId: 'seed-broken', defId: 'broken', history: {}, attachments: 'wrong',
}], [{ instanceId: 'seed-ok', defId: 'demo', history: [], attachments: [] }],
[
  { instanceId: 'seed-duplicate', defId: 'demo', history: [], attachments: [] },
  { instanceId: 'seed-duplicate', defId: 'demo', history: [], attachments: [] },
],
[{ instanceId: 'seed-ok', defId: 'demo', history: [], attachments: [] }]);
const { engine } = await import('../js/process-engine.js');
await engine.load();
check(!engine.available('definitions') && !engine.available('instances')
  && engine.definitions().length === 0 && engine.instances().length === 0,
  'malformed definitions and truthy wrong-type instance collections fail visibly');
await engine.load();
check(!engine.available('definitions') && engine.available('instances')
  && engine.definitions().length === 0 && engine.instances().length === 1,
  'duplicate portal definition IDs fail without hiding independent instances');
await engine.load();
check(engine.available('definitions') && !engine.available('instances')
  && engine.definitions()[0]?.defId === 'demo' && engine.instances().length === 0,
  'duplicate seeded instance IDs fail without hiding independent definitions');
await engine.load();
check(engine.available('definitions') && engine.available('instances')
  && engine.definitions().length === 1 && engine.instances().length === 1,
  'corrected process files recover on retry');

values.set(PROCESS_KEY, JSON.stringify([null, {
  instanceId: 'local-ok', defId: 'demo', stepIndex: 0,
  history: [null], attachments: [null],
}, {
  instanceId: 'local-ok', defId: 'demo', data: { source: 'later duplicate' },
}, {
  instanceId: 'seed-ok', defId: 'demo', data: { source: 'local shadow' },
}]));
const visibleInstances = engine.instances();
check(visibleInstances.filter((record) => record.instanceId === 'local-ok').length === 1
  && visibleInstances.filter((record) => record.instanceId === 'seed-ok').length === 1
  && visibleInstances.find((record) => record.instanceId === 'seed-ok')?.data?.source !== 'local shadow',
  'local duplicates and records shadowing seeded cases are dropped deterministically');
check(engine.advance('seed-ok') === null && engine.cancel('seed-ok') === null,
  'a local shadow cannot make a seeded case mutable');
const advanced = engine.advance('local-ok');
check(advanced?.stepIndex === 1 && advanced.history.length === 1 && advanced.attachments.length === 0,
  'malformed local history and attachment entries are repaired before use');
const persistedAfterAdvance = JSON.parse(values.get(PROCESS_KEY));
check(persistedAfterAdvance.length === 1 && persistedAfterAdvance[0]?.instanceId === 'local-ok',
  'the next successful mutation removes duplicate and seeded-shadow records from storage');
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
