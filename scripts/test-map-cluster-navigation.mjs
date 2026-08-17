import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createLatestNavigationGuard, navigateCluster } from '../js/map/cluster-navigation.js';
import { shouldSuppressMapError } from '../js/map/error-policy.js';
import { createBaseMapStyle, mapGlyphTemplate } from '../js/map/map-style.js';

let failures = 0;
const check = (ok, label) => {
  console.log(`   ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures++;
};
class Bounds {
  points = [];
  extend(point) { this.points.push(point); return this; }
}
const feature = { geometry: { coordinates: [7.4, 46.9] } };
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

console.log('\nMap style and pinned glyphs');
const glyphTemplate = mapGlyphTemplate('https://portal.example/sub/js/map/map-style.js');
const style = createBaseMapStyle('https://portal.example/sub/js/map/map-style.js');
check(glyphTemplate === 'https://portal.example/sub/assets/map-glyphs/{fontstack}/{range}.pbf',
  'resolves a same-origin glyph template below a deployment subpath without encoding its tokens');
check(style.glyphs === glyphTemplate && !JSON.stringify(style).includes('demotiles.maplibre.org'),
  'the runtime style has no demo-glyph network dependency');
check(style.layers[0].id === 'map-background' && style.layers[0].type === 'background',
  'a neutral local background remains when raster tiles fail');

const expectedGlyphs = [
  ['Noto Sans Bold/0-255.pbf', 'f60ce4cb899455c2203bd8293b550394ade53ffce8032bf9cc7f59255e49259c'],
  ['Noto Sans Regular/0-255.pbf', 'ef1f38a3f1978591e846e9eaddf8a54f7047f546fc6aaed7872cc53151a5de78'],
];
for (const [relativePath, expectedHash] of expectedGlyphs) {
  const bytes = readFileSync(new URL(`../assets/map-glyphs/${relativePath}`, import.meta.url));
  check(bytes.length > 70_000 && createHash('sha256').update(bytes).digest('hex') === expectedHash,
    `${relativePath} matches its pinned provenance hash`);
}

console.log('■ Map cluster fallback');
let fit;
let result = await navigateCluster({
  source: { getClusterLeaves: async () => [
    { geometry: { coordinates: [7, 46] } },
    { geometry: { coordinates: [8, 47] } },
  ] },
  clusterId: 1, feature, LngLatBounds: Bounds,
  map: { fitBounds: (bounds, options) => { fit = { bounds, options }; } },
});
check(result === 'leaves' && fit.bounds.points.length === 2 && fit.options.maxZoom === 15,
  'fits the exact cluster leaves');

let requestedLimit = 0;
let largeClusterFit = false;
let largeClusterEase;
result = await navigateCluster({
  source: {
    getClusterLeaves: async (_id, limit) => {
      requestedLimit = limit;
      return Array.from({ length: limit }, () => ({ geometry: { coordinates: [7, 46] } }));
    },
    getClusterExpansionZoom: async () => 10,
  },
  clusterId: 8, feature, LngLatBounds: Bounds,
  map: {
    fitBounds: () => { largeClusterFit = true; },
    easeTo: (camera) => { largeClusterEase = camera; },
  },
});
check(result === 'expansion' && requestedLimit === 501 && !largeClusterFit
  && largeClusterEase.zoom === 10,
'bounds leaf loading and expands oversized clusters without fitting a partial result');

let eased;
result = await navigateCluster({
  source: {
    getClusterLeaves: () => { throw new Error('leaves failed'); },
    getClusterExpansionZoom: async () => 9,
  },
  clusterId: 2, feature, LngLatBounds: Bounds,
  map: { easeTo: (camera) => { eased = camera; } },
});
check(result === 'expansion' && eased.zoom === 9 && eased.center === feature.geometry.coordinates,
  'falls back after a synchronous leaves failure');

let failure;
result = await navigateCluster({
  source: {
    getClusterLeaves: async () => { throw new Error('leaves failed'); },
    getClusterExpansionZoom: async () => { throw new Error('zoom failed'); },
  },
  clusterId: 3, feature, LngLatBounds: Bounds, map: {},
  onFailure: (details) => { failure = details; },
});
check(result === '' && failure.clusterId === 3
  && failure.leavesError.message === 'leaves failed'
  && failure.expansionError.message === 'zoom failed',
'reports both contextual errors when both strategies reject');

let staleFailure = false;
await navigateCluster({
  source: {
    getClusterLeaves: async () => [],
    getClusterExpansionZoom: async () => { throw new Error('removed'); },
  },
  clusterId: 4, feature, LngLatBounds: Bounds, map: {},
  isCurrent: () => false, onFailure: () => { staleFailure = true; },
});
check(staleFailure === false, 'suppresses user-visible failure after the map route is gone');

let staleFit = false;
result = await navigateCluster({
  source: { getClusterLeaves: async () => [{ geometry: { coordinates: [7, 46] } }] },
  clusterId: 5, feature, LngLatBounds: Bounds,
  map: { fitBounds: () => { staleFit = true; } },
  isCurrent: () => false,
});
check(result === '' && staleFit === false,
  'does not move a superseded map after cluster leaves resolve');

let fallbackCurrent = true;
let staleEase = false;
result = await navigateCluster({
  source: {
    getClusterLeaves: async () => { throw new Error('leaves failed'); },
    getClusterExpansionZoom: async () => { fallbackCurrent = false; return 8; },
  },
  clusterId: 6, feature, LngLatBounds: Bounds,
  map: { easeTo: () => { staleEase = true; } },
  isCurrent: () => fallbackCurrent,
});
check(result === '' && staleEase === false,
  'does not apply fallback camera work after ownership changes');

let expansionCalls = 0;
let currentAfterLeavesFailure = true;
result = await navigateCluster({
  source: {
    getClusterLeaves: async () => {
      currentAfterLeavesFailure = false;
      throw new Error('removed while loading leaves');
    },
    getClusterExpansionZoom: async () => { expansionCalls++; return 8; },
  },
  clusterId: 7, feature, LngLatBounds: Bounds, map: {},
  isCurrent: () => currentAfterLeavesFailure,
});
check(result === '' && expansionCalls === 0,
  'does not query expansion after a rejected leaves request loses ownership');

console.log('\nRapid cluster-click ownership');
const leavesGuard = createLatestNavigationGuard();
const oldLeaves = deferred();
const newLeaves = deferred();
const fitted = [];
const startLeavesClick = (clusterId, pendingLeaves) => {
  const isLatest = leavesGuard.begin();
  return navigateCluster({
    source: { getClusterLeaves: () => pendingLeaves.promise },
    clusterId, feature, LngLatBounds: Bounds,
    map: { fitBounds: () => fitted.push(clusterId) },
    isCurrent: isLatest,
  });
};
const oldLeavesRun = startLeavesClick(10, oldLeaves);
const newLeavesRun = startLeavesClick(11, newLeaves);
newLeaves.resolve([{ geometry: { coordinates: [8.2, 47.1] } }]);
await newLeavesRun;
oldLeaves.resolve([{ geometry: { coordinates: [7.2, 46.1] } }]);
await oldLeavesRun;
check(JSON.stringify(fitted) === '[11]',
  'an older leaves completion cannot move the camera after a newer real cluster click');

const expansionGuard = createLatestNavigationGuard();
const oldExpansion = deferred();
const newExpansion = deferred();
const oldExpansionStarted = deferred();
const newExpansionStarted = deferred();
const easedClicks = [];
const failedClicks = [];
const expansionStarted = [];
const startExpansionClick = (clusterId, pendingExpansion) => {
  const isLatest = expansionGuard.begin();
  return navigateCluster({
    source: {
      getClusterLeaves: async () => { throw new Error(`leaves ${clusterId}`); },
      getClusterExpansionZoom: () => {
        expansionStarted.push(clusterId);
        (clusterId === 20 ? oldExpansionStarted : newExpansionStarted).resolve();
        return pendingExpansion.promise;
      },
    },
    clusterId, feature, LngLatBounds: Bounds,
    map: { easeTo: () => easedClicks.push(clusterId) },
    isCurrent: isLatest,
    onFailure: () => failedClicks.push(clusterId),
  });
};
const oldExpansionRun = startExpansionClick(20, oldExpansion);
await oldExpansionStarted.promise;
check(expansionStarted.includes(20), 'the first click reaches its asynchronous expansion lookup');
const newExpansionRun = startExpansionClick(21, newExpansion);
await newExpansionStarted.promise;
newExpansion.resolve(9);
await newExpansionRun;
oldExpansion.resolve(7);
await oldExpansionRun;
check(JSON.stringify(easedClicks) === '[21]' && failedClicks.length === 0,
  'an older expansion completion cannot move the camera after a newer real cluster click');

const failureGuard = createLatestNavigationGuard();
const staleExpansion = deferred();
const staleExpansionStarted = deferred();
let staleExpansionToast = false;
const isLatestFailure = failureGuard.begin();
const staleExpansionRun = navigateCluster({
  source: {
    getClusterLeaves: async () => { throw new Error('old leaves failed'); },
    getClusterExpansionZoom: () => {
      staleExpansionStarted.resolve();
      return staleExpansion.promise;
    },
  },
  clusterId: 22, feature, LngLatBounds: Bounds, map: {},
  isCurrent: isLatestFailure,
  onFailure: () => { staleExpansionToast = true; },
});
await staleExpansionStarted.promise;
failureGuard.begin();
staleExpansion.reject(new Error('old expansion failed'));
await staleExpansionRun;
check(!staleExpansionToast,
  'a superseded expansion failure cannot raise a stale toast');

console.log('\n■ Map error ownership');
const fetchFailure = new Error('Failed to fetch');
check(!shouldSuppressMapError(fetchFailure), 'keeps an active map network failure observable');
check(shouldSuppressMapError(fetchFailure, { removed: true }), 'suppresses a removed map request cancellation');
check(shouldSuppressMapError(fetchFailure, { connected: false }), 'suppresses a disconnected map request cancellation');
check(shouldSuppressMapError(fetchFailure, { current: false }), 'suppresses a superseded map request cancellation');
check(!shouldSuppressMapError(new Error('style parse failed'), { removed: true }),
  'does not suppress unrelated errors even after removal');

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
