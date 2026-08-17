// Focused MapLibre regression for same-origin glyphs, complete clustered
// representation, real pointer navigation, and the label-failure fallback.
import { readFileSync } from 'node:fs';
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const BUILDING_COUNT = JSON.parse(
  readFileSync(new URL('../data/buildings.geojson', import.meta.url), 'utf8'),
).features.length;

let failures = 0;
const check = (condition, label) => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures++;
};

const mapProbe = `(async () => {
  const map = document.querySelector('#estate-map-el')?._map;
  if (!map) return { error: 'map handle unavailable' };
  const rendered = map.queryRenderedFeatures({ layers: ['clusters', 'points'] });
  const represented = new Map();
  for (const feature of rendered) {
    const clustered = feature.layer?.id === 'clusters';
    const key = clustered
      ? 'cluster:' + feature.properties.cluster_id
      : 'point:' + (feature.properties.bbl_id || feature.geometry.coordinates.join(','));
    represented.set(key, clustered ? Number(feature.properties.point_count) : 1);
  }
  const glyphTemplate = map.getStyle().glyphs || '';
  const glyphChecks = await Promise.all([
    ['Noto Sans Bold', '0-255'], ['Noto Sans Regular', '0-255'],
  ].map(async ([font, range]) => {
    const url = glyphTemplate.replace('{fontstack}', encodeURIComponent(font)).replace('{range}', range);
    const response = await fetch(url);
    const bytes = await response.arrayBuffer();
    return { url: response.url, status: response.status,
      type: response.headers.get('content-type') || '', bytes: bytes.byteLength };
  }));
  const cluster = map.queryRenderedFeatures({ layers: ['clusters'] })[0];
  const projected = cluster ? map.project(cluster.geometry.coordinates) : null;
  const rect = map.getContainer().getBoundingClientRect();
  window.__mapBeforeClusterClick = { zoom: map.getZoom(), center: map.getCenter().toArray() };
  window.__mapClusterClickEvents = 0;
  window.__mapCanvasClickTrusted = false;
  map.on('click', 'clusters', () => { window.__mapClusterClickEvents += 1; });
  map.getCanvas().addEventListener('click', (event) => {
    window.__mapCanvasClickTrusted = event.isTrusted;
  }, { once: true });
  return {
    represented: [...represented.values()].reduce((sum, value) => sum + value, 0),
    renderedClusters: map.queryRenderedFeatures({ layers: ['clusters'] }).length,
    renderedCounts: map.queryRenderedFeatures({ layers: ['cluster-count'] }).length,
    renderedPoints: map.queryRenderedFeatures({ layers: ['points'] }).length,
    geometrySource: map.getLayer('clusters')?.source,
    labelSource: map.getLayer('cluster-count')?.source,
    glyphTemplate,
    glyphChecks,
    mapState: map.getContainer().dataset.mapState || '',
    click: projected ? { x: rect.left + projected.x, y: rect.top + projected.y,
      localX: projected.x, localY: projected.y, width: rect.width, height: rect.height } : null,
  };
})()`;

async function clickCluster(cdp, page, point) {
  if (!point) return { moved: false, events: 0, reason: 'no rendered cluster' };
  await cdp.send('Page.bringToFront', {}, page.sessionId);
  point = await page.evaluate(`(async () => {
    const map = document.querySelector('#estate-map-el')?._map;
    if (!map) return null;
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';
    map.getContainer().scrollIntoView({ behavior: 'auto', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 150));
    map.resize();
    const cluster = map.queryRenderedFeatures({ layers: ['clusters'] })[0];
    if (!cluster) return null;
    const projected = map.project(cluster.geometry.coordinates);
    const rect = map.getContainer().getBoundingClientRect();
    window.__mapBeforeClusterClick = { zoom: map.getZoom(), center: map.getCenter().toArray() };
    const x = rect.left + projected.x;
    const y = rect.top + projected.y;
    return { x, y, hit: document.elementFromPoint(x, y) === map.getCanvas() };
  })()`);
  if (!point) return { moved: false, events: 0, reason: 'cluster disappeared after scroll' };
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: point.x, y: point.y, button: 'none', buttons: 0,
  }, page.sessionId);
  await sleep(100);
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1,
  }, page.sessionId);
  await sleep(50);
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1,
  }, page.sessionId);
  const moved = await page.waitFor(`(() => {
    const map = document.querySelector('#estate-map-el')?._map;
    const before = window.__mapBeforeClusterClick;
    if (!map || !before) return false;
    const center = map.getCenter();
    return Math.abs(map.getZoom() - before.zoom) > 0.05
      || Math.abs(center.lng - before.center[0]) > 0.0001
      || Math.abs(center.lat - before.center[1]) > 0.0001;
  })()`, { timeout: 3500 });
  return page.evaluate(`({ moved: ${Boolean(moved)}, hit: ${Boolean(point.hit)},
    events: window.__mapClusterClickEvents || 0,
    trusted: window.__mapCanvasClickTrusted === true })`);
}

const cdp = await launch({ webgl: true });
try {
  console.log('■ Same-origin clustered map');
  const page = await openPage(cdp, 'about:blank', { login: true });
  const glyphResponses = [];
  cdp.on((message) => {
    if (message.sessionId !== page.sessionId || message.method !== 'Network.responseReceived') return;
    const response = message.params.response;
    if (/\/assets\/map-glyphs\//.test(response.url)) {
      glyphResponses.push({ url: response.url, status: response.status, type: response.mimeType });
    }
  });
  await cdp.send('Network.enable', {}, page.sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await cdp.send('Page.navigate', { url: `${APP_BASE}/app/dataportal/immobilien` }, page.sessionId);
  const ready = await page.waitFor(`(() => {
    const map = document.querySelector('#estate-map-el')?._map;
    return !!map && map.getContainer().dataset.mapState === 'ready'
      && !!map.getSource('estate') && map.isSourceLoaded('estate')
      && map.queryRenderedFeatures({ layers: ['clusters'] }).length > 0
      && map.queryRenderedFeatures({ layers: ['cluster-count'] }).length > 0;
  })()`, { timeout: 15000 });
  check(ready, 'the geometry source loads and renders at least one cluster');
  const result = await page.evaluate(mapProbe);
  check(!result.error, result.error || 'map probe completed');
  check(result.represented === BUILDING_COUNT,
    `rendered clusters and points represent all ${BUILDING_COUNT} building records (${result.represented})`);
  check(result.renderedClusters > 0 && result.renderedCounts > 0,
    `cluster geometry and its count label both render (${result.renderedClusters}/${result.renderedCounts})`);
  check(result.geometrySource === 'estate' && result.labelSource === 'estate-labels',
    'labels use a source isolated from interactive cluster geometry');
  check(result.glyphTemplate.startsWith(new URL(APP_BASE.replace(/#.*$/, '')).origin)
    && result.glyphTemplate.includes('/assets/map-glyphs/{fontstack}/{range}.pbf')
    && !result.glyphTemplate.includes('demotiles.maplibre.org'),
  'the live style uses the same-origin glyph template');
  check(result.glyphChecks.every((entry) => entry.status === 200
      && entry.type.startsWith('application/x-protobuf') && entry.bytes > 70_000),
  'both pinned glyph ranges return protobuf responses with complete bodies');
  check(glyphResponses.some((entry) => entry.status === 200
      && entry.type === 'application/x-protobuf'),
  'MapLibre requests the glyphs from the portal origin');
  const clickResult = await clickCluster(cdp, page, result.click);
  check(clickResult.hit && clickResult.trusted && clickResult.events > 0 && clickResult.moved,
    `a real pointer click on a rendered cluster changes the camera (${JSON.stringify(clickResult)})`);
  const normalProblems = await page.problems();
  check(normalProblems.length === 0,
    `the normal map has no active errors${normalProblems[0] ? ': ' + normalProblems[0] : ''}`);
  await page.closeTarget();

  console.log('■ Label-network failure fallback');
  const blocked = await openPage(cdp, 'about:blank', { login: true });
  await cdp.send('Network.enable', {}, blocked.sessionId);
  await cdp.send('Network.setBlockedURLs', { urls: ['*assets/map-glyphs/*'] }, blocked.sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false }, blocked.sessionId);
  await cdp.send('Page.navigate', { url: `${APP_BASE}/app/dataportal/immobilien?glyphs=blocked` }, blocked.sessionId);
  const degraded = await blocked.waitFor(`(() => {
    const holder = document.querySelector('#estate-map-el');
    const map = holder?._map;
    return holder?.dataset.mapState === 'degraded' && !!map?.getSource('estate')
      && map.isSourceLoaded('estate')
      && map.queryRenderedFeatures({ layers: ['clusters'] }).length > 0;
  })()`, { timeout: 15000 });
  check(degraded, 'a label failure becomes an observable degraded map state');
  const blockedResult = await blocked.evaluate(`(async () => {
    const map = document.querySelector('#estate-map-el')?._map;
    const rendered = map.queryRenderedFeatures({ layers: ['clusters', 'points'] });
    const represented = new Map();
    for (const feature of rendered) {
      const clustered = feature.layer?.id === 'clusters';
      const key = clustered ? 'cluster:' + feature.properties.cluster_id
        : 'point:' + (feature.properties.bbl_id || feature.geometry.coordinates.join(','));
      represented.set(key, clustered ? Number(feature.properties.point_count) : 1);
    }
    const cluster = map.queryRenderedFeatures({ layers: ['clusters'] })[0];
    const point = cluster ? map.project(cluster.geometry.coordinates) : null;
    const rect = map.getContainer().getBoundingClientRect();
    window.__mapBeforeClusterClick = { zoom: map.getZoom(), center: map.getCenter().toArray() };
    window.__mapClusterClickEvents = 0;
    window.__mapCanvasClickTrusted = false;
    map.on('click', 'clusters', () => { window.__mapClusterClickEvents += 1; });
    map.getCanvas().addEventListener('click', (event) => {
      window.__mapCanvasClickTrusted = event.isTrusted;
    }, { once: true });
    const notice = map.getContainer().querySelector('.map-degraded');
    return {
      represented: [...represented.values()].reduce((sum, value) => sum + value, 0),
      clusters: map.queryRenderedFeatures({ layers: ['clusters'] }).length,
      labels: map.queryRenderedFeatures({ layers: ['cluster-count'] }).length,
      notice: notice?.textContent.trim() || '',
      noticeVisible: !!notice && getComputedStyle(notice).display !== 'none',
      click: point ? { x: rect.left + point.x, y: rect.top + point.y,
        localX: point.x, localY: point.y, width: rect.width, height: rect.height } : null,
    };
  })()`);
  check(blockedResult.represented === BUILDING_COUNT && blockedResult.clusters > 0,
    `all ${BUILDING_COUNT} records remain represented by interactive geometry when labels fail`);
  check(blockedResult.labels === 0,
    'the failure probe actually prevents symbol labels from rendering');
  check(blockedResult.noticeVisible && blockedResult.notice.length > 0,
    'the degraded state includes a visible user-facing explanation');
  const blockedClick = await clickCluster(cdp, blocked, blockedResult.click);
  check(blockedClick.hit && blockedClick.trusted && blockedClick.events > 0 && blockedClick.moved,
    `cluster navigation remains interactive without labels (${JSON.stringify(blockedClick)})`);
  await sleep(100);
  const blockedProblems = await blocked.problems();
  check(blockedProblems.some((entry) => /Console error: \[map\]/.test(entry)),
    'the active glyph failure remains visible to diagnostics');
  check(!blockedProblems.some((entry) => /^Exception:|^Error banner:/.test(entry)),
    'the expected label failure does not become an exception or route error');
  await blocked.closeTarget();
} finally {
  cdp.close();
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
