// Resolve a MapLibre cluster through its exact leaves first and expansion zoom
// second. Keeping the fallbacks in a pure async helper makes the terminal
// rejection deterministic to test without loading WebGL or the CDN bundle.
export async function navigateCluster({
  source, clusterId, feature, map, LngLatBounds, isCurrent = () => true, onFailure = () => {},
}) {
  let leavesError;
  try {
    const leaves = await Promise.resolve().then(() => source.getClusterLeaves(clusterId, Infinity, 0));
    if (!leaves || !leaves.length) throw new Error('cluster has no leaves');
    const bounds = new LngLatBounds();
    leaves.forEach((leaf) => bounds.extend(leaf.geometry.coordinates));
    map.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 600 });
    return 'leaves';
  } catch (error) {
    leavesError = error;
  }

  try {
    const zoom = await Promise.resolve().then(() => source.getClusterExpansionZoom(clusterId));
    map.easeTo({ center: feature.geometry.coordinates, zoom });
    return 'expansion';
  } catch (expansionError) {
    if (isCurrent()) onFailure({ clusterId, leavesError, expansionError });
    return '';
  }
}
