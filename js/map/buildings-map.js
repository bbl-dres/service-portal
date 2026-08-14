// MapLibre GL point map for data-portal dashboards.
//
// The portal is otherwise dependency-free; MapLibre is loaded lazily from a CDN
// only when a map is opened, and degrades to a message if unavailable (offline /
// blocked network). CARTO Positron is the calm worldwide basemap used by the
// portfolio, project, room and location-picker views.

import { escape as esc, loading, toast } from '../components.js';
import { loadExternalAssets } from '../core/external-assets.js';
import { formatArea } from '../format.js';
import { safeLinkUrl } from '../security/urls.js';
import { navigateCluster } from './cluster-navigation.js';

const MAPLIBRE_VERSION = '4.7.1';
const MAPLIBRE_ASSETS = {
  key: `maplibre-gl@${MAPLIBRE_VERSION}`,
  globalName: 'maplibregl',
  styles: [{
    url: `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`,
    integrity: 'sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V',
  }],
  script: {
    url: `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`,
    integrity: 'sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj',
  },
  messages: {
    timeout: 'Zeitüberschreitung beim Laden der Karte',
    style: 'MapLibre-Styles konnten nicht geladen werden',
    script: 'MapLibre konnte nicht geladen werden',
    global: 'maplibregl fehlt',
  },
};

function loadMapLibre() {
  return loadExternalAssets(MAPLIBRE_ASSETS);
}

function popupLink(href) {
  const safeHref = safeLinkUrl(href);
  return safeHref ? `<br><a class="link" href="${esc(safeHref)}">Objekt ansehen →</a>` : '';
}

// Body of a building popup. `popup_html` is the caller's own composition and is
// used verbatim; without it the map builds the same three-line summary as before.
function pointPopupHTML(p) {
  if (p && typeof p.popup_html === 'string' && p.popup_html) return p.popup_html;
  return `<strong>${esc(p.label)}</strong>${p.sub ? `<br><span class="small muted">${esc(p.sub)}</span>` : ''}`
    + `${p.bbl_id ? `<br><span class="small muted">${esc(p.bbl_id)}</span>` : ''}`
    + popupLink(p.href);
}

// `esc` / `formatArea` come from shared modules (imports above), replacing the
// former local escape reimplementation and handwritten de-CH formatter (design
// review B23). components.js and format.js have no imports themselves, so the
// lazy map module does not pull in a dependency chain.

// CARTO Positron grey (worldwide) — calm ground for a global portfolio.
// `glyphs` (Noto Sans font PBFs) are needed for the cluster counts + id labels.
// Served from MapLibre's demotiles host: fonts.openmaptiles.org started returning
// an HTML landing page (HTTP 200) instead of PBF, which MapLibre parses as protobuf
// and throws «Unimplemented type: 4» — aborting the whole estate tile (clusters
// included). demotiles.maplibre.org returns real PBFs for Noto Sans Regular/Bold.
const CARTO_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap-Mitwirkende © CARTO',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
};

// Centred loading notice until the map is genuinely ready. The markup placeholder
// covers only the period UNTIL MapLibre loads; network and cluster calculation
// continue afterwards, previously leaving a blank grey surface. `idle` fires
// once tiles AND cluster layers have rendered.
function showMapSpinner(container, map) {
  if (!container) return;
  const spinner = document.createElement('div');
  spinner.className = 'map-spinner';
  // C.loading already supplies role="status"; this element only adds the overlay.
  spinner.innerHTML = loading({ label: 'Karte wird geladen…', hideLabel: true, size: '2xl' });
  container.appendChild(spinner);
  let done = false;
  let fallbackTimer = null;
  const clear = () => {
    if (done) return;
    done = true;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    spinner.remove();
  };
  map.once('idle', clear);
  map.once('remove', clear);
  // Safety net: if `idle` never fires because a tile source is blocked, the
  // notice must not remain forever.
  fallbackTimer = setTimeout(clear, 12000);
}

// Worldwide estate buildings on CARTO grey — CLUSTERED so dense areas don't
// overlap. Clusters show a count; single points are uniform circles and, from a
// closer zoom, show the bbl_id as a label. The nav control's compass resets the
// rotation to north. `points` = [{ lat, lon, label, sub?, bblId?, href? }].
//
// Colours come from the token layer (as in js/ui/charts.js). MapLibre paint specs
// cannot carry `var(...)`, so tokens are RESOLVED at render time through
// getComputedStyle. Markers and labels therefore follow the active skin
// (red/intranet) instead of being fixed to intranet blue. Fallbacks match the
// defaults in css/tokens.css.
const cssVar = (name, fallback) => {
  if (typeof document === 'undefined') return fallback;
  // Skins live on <body>, so read the inherited computed value there. Reading
  // <html> bypassed `.body--intranet` and silently returned the federal ramp.
  const scope = document.body || document.documentElement;
  const value = getComputedStyle(scope).getPropertyValue(name).trim();
  return value || fallback;
};
// `options.focusPopup: false` zooms to the object without opening an info popup.
// This is required for the detail page's hero map: MapLibre focuses the popup's
// close button as soon as it is attached, which moved focus from <h1> into the
// map during page setup (WCAG 2.4.3) and intermittently failed tab keyboard
// tests. The overview map keeps its popup because it responds to an intentional
// tree selection.
export async function initEstateMap(container, points, parcels, focus, options = {}) {
  const focusPopup = options.focusPopup !== false;
  const c = (points || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  let maplibregl;
  try {
    maplibregl = await loadMapLibre();
  } catch (e) {
    container.innerHTML = `<div class="empty empty--unavailable h-full">
      <span>Die Karte konnte nicht geladen werden (${esc(e.message)}). Im Bundesnetz ist der Kartendienst ggf. gesperrt.</span></div>`;
    return null;
  }
  if (!container.isConnected) return null;
  // Remove the loading placeholder BEFORE MapLibre attaches (item 6.14).
  container.textContent = '';
  let map = null;
  try {

  // Resolve skin-dependent colours here at render time, not during module load.
  const MARKER = cssVar('--color-primary-600', '#d8232a');   // Building marker = skin primary colour.
  const PARCEL = cssVar('--chart-series-1', '#0f6b75');      // Teal parcels, distinct from building markers.
  const LABEL_INK = cssVar('--chart-ink', '#1f2937');
  const LABEL_HALO = cssVar('--chart-surface', '#ffffff');

  const fc = {
    type: 'FeatureCollection',
    features: c.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { label: p.label || '', sub: p.sub || '', bbl_id: p.bblId || '', href: p.href || '',
        // Optional ready-made popup body. A caller that has richer facts and
        // actions for an object (the Plan-Editor lists its floors here) passes
        // sanitised HTML instead of leaving the map to guess a summary from
        // three strings. Callers that omit it keep the default composition.
        popup_html: typeof p.popupHtml === 'string' ? p.popupHtml : '' },
    })),
  };

  let camera = { center: [10, 30], zoom: 1.3 };
  if (c.length > 1) {
    const lons = c.map((p) => p.lon), lats = c.map((p) => p.lat);
    camera = { bounds: [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], fitBoundsOptions: { padding: 56, maxZoom: 6 } };
  } else if (c.length === 1) {
    camera = { center: [c[0].lon, c[0].lat], zoom: 9 };
  }

  map = new maplibregl.Map({ container, style: CARTO_STYLE, attributionControl: { compact: true }, preserveDrawingBuffer: true,
    // See above (item 6.5).
    cooperativeGestures: true,
    locale: {
      'CooperativeGesturesHandler.WindowsHelpText': 'Strg + Scrollen zum Zoomen',
      'CooperativeGesturesHandler.MacHelpText': '⌘ + Scrollen zum Zoomen',
      'CooperativeGesturesHandler.MobileHelpText': 'Mit zwei Fingern verschieben',
    },
    ...camera });
  // Abgebrochene Anfragen sind kein Fehler. Wird die Karte waehrend des Ladens
  // abgebaut — jeder Routenwechsel tut das —, brechen ihre laufenden Kachel- und
  // Stilanfragen ab, maplibre feuert ein `error`-Ereignis mit «Failed to fetch»,
  // und weil niemand zuhoert, schreibt es maplibre selbst in die Konsole. Das
  // sah in den Pruefungen wie ein Fehler aus, kam und ging aber mit dem Zufall
  // des Zeitpunkts (nachgestellt: Kartenansicht oeffnen, sofort wegnavigieren).
  //
  // Nur DIESEN Fall schlucken. Alles andere geht weiter an die Konsole — eine
  // Karte, die ihren Stil nicht laden kann, muss das weiterhin sagen duerfen.
  const ABGEBROCHEN = /failed to fetch|aborted|abgebrochen|networkerror|load failed/i;
  map.on('error', (e) => {
    const err = e && e.error;
    if (err && ABGEBROCHEN.test(String(err.message || ''))) return;
    console.error('[Karte]', err || e);
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'top-right');
  map.addControl(new maplibregl.FullscreenControl({ container }), 'top-right');
  showMapSpinner(container, map);

  map.on('load', () => {
    if (!map.getSource('estate')) {
      map.addSource('estate', { type: 'geojson', data: fc, cluster: true, clusterMaxZoom: 10, clusterRadius: 46 });
      map.addLayer({ id: 'clusters', type: 'circle', source: 'estate', filter: ['has', 'point_count'],
        paint: { 'circle-color': MARKER, 'circle-opacity': 0.85, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2,
          'circle-radius': ['step', ['get', 'point_count'], 16, 3, 20, 6, 26, 10, 32] } });
      // text-size 12 = --fs-xs, the smallest CD type-scale step (11/13 were off-scale).
      map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'estate', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 12 },
        paint: { 'text-color': '#fff' } });
      map.addLayer({ id: 'points', type: 'circle', source: 'estate', filter: ['!', ['has', 'point_count']],
        paint: { 'circle-color': MARKER, 'circle-opacity': 0.85, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2, 'circle-radius': 7 } });
      // bbl_id above the marker, only from a closer zoom so the overview stays calm
      map.addLayer({ id: 'point-labels', type: 'symbol', source: 'estate', filter: ['!', ['has', 'point_count']], minzoom: 8.5,
        layout: { 'text-field': ['get', 'bbl_id'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, -1.2], 'text-anchor': 'bottom' },
        paint: { 'text-color': LABEL_INK, 'text-halo-color': LABEL_HALO, 'text-halo-width': 1.4 } });
      // Parcel polygons — only from a close zoom (plot-sized), like the id labels.
      // Drawn below the building markers (beforeId 'clusters') so points stay on top.
      if (parcels && parcels.features && parcels.features.length) {
        map.addSource('parcels', { type: 'geojson', data: parcels });
        map.addLayer({ id: 'parcels-fill', type: 'fill', source: 'parcels', minzoom: 13,
          paint: { 'fill-color': PARCEL, 'fill-opacity': 0.18 } }, 'clusters');
        map.addLayer({ id: 'parcels-line', type: 'line', source: 'parcels', minzoom: 13,
          paint: { 'line-color': PARCEL, 'line-width': 1.5, 'line-opacity': 0.85 } }, 'clusters');
      }
    }
    // Focus from tree selection: zoom to the object and open its info popup.
    if (focus) {
      const bp = c.find((p) => p.bblId === focus);
      if (bp) {
        map.easeTo({ center: [bp.lon, bp.lat], zoom: 15 });
        if (focusPopup) popup.setLngLat([bp.lon, bp.lat]).setHTML(pointPopupHTML({
          label: bp.label, sub: bp.sub, bbl_id: bp.bblId, href: bp.href, popup_html: bp.popupHtml,
        })).addTo(map);
      } else {
        const pf = ((parcels && parcels.features) || []).find((f) => f.properties && f.properties.id === focus);
        const ring = pf && pf.geometry && pf.geometry.coordinates && pf.geometry.coordinates[0];
        if (ring && ring.length) {
          const ct = [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
          const pr = pf.properties;
          map.easeTo({ center: ct, zoom: 16 });
          if (focusPopup) popup.setLngLat(ct).setHTML(
            `<strong>${esc(pr.label)}</strong>${pr.sub ? `<br><span class="small muted">${esc(pr.sub)}</span>` : ''}`
            + `<br><span class="small muted">Grundstück ${esc(pr.id)}${pr.area ? ' · ' + formatArea(pr.area) : ''}</span>`
            + popupLink(pr.href),
          ).addTo(map);
        }
      }
    }
  });

  const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '260px' });
  map.on('click', 'clusters', (e) => {
    const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
    if (!f) return;
    const src = map.getSource('estate');
    const id = f.properties.cluster_id;
    // Zoom to the actual extent of contained objects instead of the «expansion
    // zoom». The latter only indicates when THIS cluster splits; for seven
    // properties across Switzerland in the world view, that is zoom 2. Measured
    // behaviour was 1.52 → 2.0, visually no change and therefore a dead-looking
    // click. fitBounds over the leaves always shows exactly the clustered objects.
    void navigateCluster({
      source: src, clusterId: id, feature: f, map, LngLatBounds: maplibregl.LngLatBounds,
      isCurrent: () => container.isConnected && container._map === map,
      onFailure: (details) => {
        console.warn('MapLibre cluster navigation failed', details);
        toast('Die Kartengruppe konnte nicht geöffnet werden.', 'warning', 'WarningCircle');
      },
    });
  });
  map.on('click', 'points', (e) => {
    const p = e.features[0].properties;
    popup.setLngLat(e.features[0].geometry.coordinates).setHTML(pointPopupHTML(p)).addTo(map);
  });
  // Parcel polygon → same basic popup as a building, with the inventory deep-link.
  map.on('click', 'parcels-fill', (e) => {
    const p = e.features[0].properties;
    popup.setLngLat(e.lngLat).setHTML(
      `<strong>${esc(p.label)}</strong>${p.sub ? `<br><span class="small muted">${esc(p.sub)}</span>` : ''}`
      + `<br><span class="small muted">Grundstück ${esc(p.id)}${p.area ? ' · ' + formatArea(p.area) : ''}</span>`
      + popupLink(p.href),
    ).addTo(map);
  });
  for (const lyr of ['clusters', 'points', 'parcels-fill']) {
    map.on('mouseenter', lyr, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', lyr, () => { map.getCanvas().style.cursor = ''; });
  }
  container._map = map;   // handle for debugging / headless tests (drive camera, query layers)
  return map;
  } catch (error) {
    if (map) { try { map.remove(); } catch { /* partially constructed */ } }
    container._map = null;
    if (container.isConnected) {
      container.innerHTML = `<div class="empty empty--unavailable h-full">
        <span>Die Karte konnte nicht initialisiert werden (${esc(error.message)}).</span></div>`;
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Location picker: a map with ONE draggable pin for creating a new property
// (js/apps/building-create.js). `onPick(lat, lng)` reports every move, whether
// caused by dragging the pin OR clicking the map.
//
// CARTO grey base (as in portfolio maps): a calm surface without restricting
// the viewport to Switzerland.
export async function initPickerMap(container, { lat, lng, zoom = 17, onPick } = {}) {
  let maplibregl;
  try {
    maplibregl = await loadMapLibre();
  } catch (e) {
    container.innerHTML = `<div class="empty empty--unavailable h-full">
      <span>Die Karte konnte nicht geladen werden (${esc(e.message)}). Im Bundesnetz ist der Kartendienst ggf. gesperrt.</span></div>`;
    return null;
  }
  if (!container.isConnected) return null;
  // Remove the loading placeholder BEFORE MapLibre attaches, but remove ONLY the
  // map; the search overlay is its sibling in the wrapper.
  const holder = container.querySelector('.map-picker__canvas') || container;
  holder.textContent = '';
  let map = null;
  try {

  const hasStart = Number.isFinite(lat) && Number.isFinite(lng);
  map = new maplibregl.Map({
    // Do NOT add attribution automatically: at bottom right it collided with the
    // centred search overlay. Add it at bottom left instead (see below).
    container: holder, style: CARTO_STYLE, attributionControl: false,
    cooperativeGestures: true,
    locale: {
      'CooperativeGesturesHandler.WindowsHelpText': 'Strg + Scrollen zum Zoomen',
      'CooperativeGesturesHandler.MacHelpText': '⌘ + Scrollen zum Zoomen',
      'CooperativeGesturesHandler.MobileHelpText': 'Mit zwei Fingern verschieben',
    },
    center: hasStart ? [lng, lat] : [8.2275, 46.8182],   // Country centre until an address is selected.
    zoom: hasStart ? zoom : 7,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new maplibregl.FullscreenControl({ container }), 'top-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
  showMapSpinner(holder, map);

  const el = document.createElement('div');
  el.className = 'map-pin';
  el.setAttribute('aria-hidden', 'true');
  const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'bottom' })
    .setLngLat(hasStart ? [lng, lat] : [8.2275, 46.8182])
    .addTo(map);
  if (!hasStart) el.style.display = 'none';   // Show only after a location is set.

  const report = () => { const p = marker.getLngLat(); if (onPick) onPick(p.lat, p.lng); };
  marker.on('dragend', report);
  map.on('click', (e) => {
    el.style.display = '';
    marker.setLngLat(e.lngLat);
    report();
  });

  // Control API for the caller: selected address → place pin and approach.
  // Use `flyTo`, not `easeTo`: moving from overview (zoom 5) to a house number
  // (zoom 17) spans twelve levels. easeTo slides tiles through linearly, while
  // flyTo zooms out and back in and remains legible.
  map.__setPin = (la, ln, z) => {
    el.style.display = '';
    marker.setLngLat([ln, la]);
    map.flyTo({ center: [ln, la], zoom: z || zoom, duration: 1200, essential: true });
  };
  container._map = map;   // Handle for headless tests.
  return map;
  } catch (error) {
    if (map) { try { map.remove(); } catch { /* partially constructed */ } }
    container._map = null;
    if (holder.isConnected) {
      holder.innerHTML = `<div class="empty empty--unavailable h-full">
        <span>Die Karte konnte nicht initialisiert werden (${esc(error.message)}).</span></div>`;
    }
    return null;
  }
}
