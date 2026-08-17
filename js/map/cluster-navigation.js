const MAX_BOUND_LEAVES = 500;

// Each successful begin supersedes every older request from the same map.
// Callers create one guard per map and begin only after hit testing finds a
// real cluster, so clicks on empty map space do not invalidate useful work.
export function createLatestNavigationGuard() {
  let generation = 0;
  return {
    begin() {
      const current = ++generation;
      return () => current === generation;
    },
  };
}

// Fit small clusters exactly. Large clusters use MapLibre's expansion zoom so
// one click cannot materialise an unbounded result set on the main thread.
export async function navigateCluster({
  source, clusterId, feature, map, LngLatBounds, isCurrent = () => true, onFailure = () => {},
}) {
  let leavesError;
  try {
    const leaves = await Promise.resolve().then(
      () => source.getClusterLeaves(clusterId, MAX_BOUND_LEAVES + 1, 0),
    );
    if (!isCurrent()) return '';
    if (!leaves || !leaves.length) throw new Error('cluster has no leaves');
    if (leaves.length > MAX_BOUND_LEAVES) throw new Error('cluster exceeds exact-bounds limit');
    const bounds = new LngLatBounds();
    leaves.forEach((leaf) => bounds.extend(leaf.geometry.coordinates));
    map.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 600 });
    return 'leaves';
  } catch (error) {
    leavesError = error;
  }
  if (!isCurrent()) return '';

  try {
    const zoom = await Promise.resolve().then(() => source.getClusterExpansionZoom(clusterId));
    if (!isCurrent()) return '';
    map.easeTo({ center: feature.geometry.coordinates, zoom });
    return 'expansion';
  } catch (expansionError) {
    if (isCurrent()) onFailure({ clusterId, leavesError, expansionError });
    return '';
  }
}
