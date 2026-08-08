import { navigateCluster } from '../js/map/cluster-navigation.js';

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

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
