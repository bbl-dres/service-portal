// MapLibre GL point map for the Datenportal dashboards.
//
// The portal is otherwise dependency-free; MapLibre is loaded lazily from a CDN
// only when a map is opened, and degrades to a message if unavailable (offline /
// blocked network). Two grey basemaps: swisstopo (Swiss coverage) and CARTO
// Positron (worldwide). Marks are HTML markers (a handful of points) — simple,
// accessible and reliably rendered, incl. headless.

const MAPLIBRE_VER = '4.7.1';
let mlPromise = null;

function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (mlPromise) return mlPromise;
  mlPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Zeitüberschreitung beim Laden der Karte')), 12000);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VER}/dist/maplibre-gl.css`;
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VER}/dist/maplibre-gl.js`;
    s.onload = () => { clearTimeout(timer); window.maplibregl ? resolve(window.maplibregl) : reject(new Error('maplibregl fehlt')); };
    s.onerror = () => { clearTimeout(timer); reject(new Error('MapLibre konnte nicht geladen werden')); };
    document.head.appendChild(s);
  }).catch((e) => { mlPromise = null; throw e; });   // Fehler nicht cachen → späterer Aufruf lädt neu (C2)
  return mlPromise;
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// swisstopo grey (CH only) — official Swiss basemap.
const SWISSTOPO_STYLE = {
  version: 8,
  sources: {
    swisstopo: {
      type: 'raster',
      tiles: ['https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg'],
      tileSize: 256,
      attribution: '© swisstopo',
    },
  },
  layers: [{ id: 'swisstopo', type: 'raster', source: 'swisstopo' }],
};

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

// Shared core: render `points` = [{ lat, lon, label, sub?, size?, href? }] on
// `container` with the given `style` and camera (`{center,zoom}` or `{bounds}`).
async function pointMap(container, points, style, camera) {
  const pts = (points || []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  let maplibregl;
  try {
    maplibregl = await loadMapLibre();
  } catch (e) {
    container.innerHTML = `<div class="empty empty--unavailable" style="height:100%">
      <span>Die Karte konnte nicht geladen werden (${esc(e.message)}). Im Bundesnetz ist der Kartendienst ggf. gesperrt.</span></div>`;
    return null;
  }
  if (!container.isConnected) return null;   // tab switched away during the async gap
  // Ladeplatzhalter entfernen, BEVOR MapLibre anhängt (Item 6.14).
  container.textContent = '';

  // Marker diameter ∝ √size: area-proportional. Untergrenze 20px statt 12px
  // (Item 6.15): bei einem einzelnen kleinen Gebäude war die Marke ein 12px-Punkt
  // — unter der 24px-Grenze für Bedienelemente und kaum zu treffen. Die
  // Trefferfläche selbst wächst zusätzlich per .map-marker::before auf 44px.
  const maxSize = Math.max(...pts.map(p => Number(p.size) || 0), 1);
  const diam = (v) => Math.round(20 + 24 * Math.sqrt((Number(v) || 0) / maxSize));

  const map = new maplibregl.Map({ container, style, attributionControl: { compact: true },
    // Item 6.5: `scrollZoom.disable()` allein macht die Karte auf Touch zur
    // Scroll-Falle — ein Finger zieht die Karte, die Seite bewegt sich nicht mehr.
    // MapLibres cooperativeGestures verlangt zwei Finger bzw. Strg/⌘ + Scrollen
    // und zeigt dazu einen Hinweis (hier auf Deutsch).
    cooperativeGestures: true,
    locale: {
      'CooperativeGesturesHandler.WindowsHelpText': 'Strg + Scrollen zum Zoomen',
      'CooperativeGesturesHandler.MacHelpText': '⌘ + Scrollen zum Zoomen',
      'CooperativeGesturesHandler.MobileHelpText': 'Mit zwei Fingern verschieben',
    },
    ...camera });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  // Kein scrollZoom.disable() mehr — cooperativeGestures regelt es sauberer.

  const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '260px' });
  for (const p of pts) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'map-marker';
    el.style.width = el.style.height = `${diam(p.size)}px`;
    el.setAttribute('aria-label', p.label);
    el.title = p.label;
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      popup.setLngLat([p.lon, p.lat]).setHTML(
        `<strong>${esc(p.label)}</strong>${p.sub ? `<br><span class="small muted">${esc(p.sub)}</span>` : ''}`
        + (p.href ? `<br><a class="link" href="${esc(p.href)}">Objekt ansehen →</a>` : ''),
      ).addTo(map);
    });
    new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([p.lon, p.lat]).addTo(map);
  }
  return map;
}

// Swiss buildings (core.buildings()) on swisstopo grey.
export async function initBuildingsMap(container, buildings) {
  const points = (buildings || []).map(b => ({
    lat: b.lat, lon: b.lng, label: b.name, size: b.gf,
    sub: [b.street, `${b.zip || ''} ${b.city || ''}`.trim()].filter(Boolean).join(', '),
    href: `#/app/portfolio?id=${encodeURIComponent(b.bbl_id)}`,
  }));
  const c = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  const center = c.length
    ? [c.reduce((a, p) => a + p.lon, 0) / c.length, c.reduce((a, p) => a + p.lat, 0) / c.length]
    : [8.23, 46.82];
  return pointMap(container, points, SWISSTOPO_STYLE, { center, zoom: c.length ? 8.4 : 6.6 });
}

// Worldwide estate buildings on CARTO grey — CLUSTERED so dense areas don't
// overlap. Clusters show a count; single points are uniform circles and, from a
// closer zoom, show the bbl_id as a label. The nav control's compass resets the
// rotation to north. `points` = [{ lat, lon, label, sub?, bblId?, href? }].
const BLUE = '#2563eb';
const PARCEL = '#0f766e';   // teal — Grundstücke, distinct from the blue building markers
export async function initEstateMap(container, points, parcels, focus) {
  const c = (points || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  let maplibregl;
  try {
    maplibregl = await loadMapLibre();
  } catch (e) {
    container.innerHTML = `<div class="empty empty--unavailable" style="height:100%">
      <span>Die Karte konnte nicht geladen werden (${esc(e.message)}). Im Bundesnetz ist der Kartendienst ggf. gesperrt.</span></div>`;
    return null;
  }
  if (!container.isConnected) return null;
  // Ladeplatzhalter entfernen, BEVOR MapLibre anhängt (Item 6.14).
  container.textContent = '';


  const fc = {
    type: 'FeatureCollection',
    features: c.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { label: p.label || '', sub: p.sub || '', bbl_id: p.bblId || '', href: p.href || '' },
    })),
  };

  let camera = { center: [10, 30], zoom: 1.3 };
  if (c.length > 1) {
    const lons = c.map((p) => p.lon), lats = c.map((p) => p.lat);
    camera = { bounds: [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], fitBoundsOptions: { padding: 56, maxZoom: 6 } };
  } else if (c.length === 1) {
    camera = { center: [c[0].lon, c[0].lat], zoom: 9 };
  }

  const map = new maplibregl.Map({ container, style: CARTO_STYLE, attributionControl: { compact: true }, preserveDrawingBuffer: true,
    // siehe oben (Item 6.5)
    cooperativeGestures: true,
    locale: {
      'CooperativeGesturesHandler.WindowsHelpText': 'Strg + Scrollen zum Zoomen',
      'CooperativeGesturesHandler.MacHelpText': '⌘ + Scrollen zum Zoomen',
      'CooperativeGesturesHandler.MobileHelpText': 'Mit zwei Fingern verschieben',
    },
    ...camera });
  map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'top-right');

  map.on('load', () => {
    if (!map.getSource('estate')) {
      map.addSource('estate', { type: 'geojson', data: fc, cluster: true, clusterMaxZoom: 10, clusterRadius: 46 });
      map.addLayer({ id: 'clusters', type: 'circle', source: 'estate', filter: ['has', 'point_count'],
        paint: { 'circle-color': BLUE, 'circle-opacity': 0.85, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2,
          'circle-radius': ['step', ['get', 'point_count'], 16, 3, 20, 6, 26, 10, 32] } });
      map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'estate', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 13 },
        paint: { 'text-color': '#fff' } });
      map.addLayer({ id: 'points', type: 'circle', source: 'estate', filter: ['!', ['has', 'point_count']],
        paint: { 'circle-color': BLUE, 'circle-opacity': 0.85, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2, 'circle-radius': 7 } });
      // bbl_id above the marker, only from a closer zoom so the overview stays calm
      map.addLayer({ id: 'point-labels', type: 'symbol', source: 'estate', filter: ['!', ['has', 'point_count']], minzoom: 8.5,
        layout: { 'text-field': ['get', 'bbl_id'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, -1.2], 'text-anchor': 'bottom' },
        paint: { 'text-color': '#1f2937', 'text-halo-color': '#fff', 'text-halo-width': 1.4 } });
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
    // Fokus (Auswahl aus dem Baum): das Objekt heranzoomen und sein Info-Popup öffnen.
    if (focus) {
      const bp = c.find((p) => p.bblId === focus);
      if (bp) {
        map.easeTo({ center: [bp.lon, bp.lat], zoom: 15 });
        popup.setLngLat([bp.lon, bp.lat]).setHTML(
          `<strong>${esc(bp.label)}</strong>${bp.sub ? `<br><span class="small muted">${esc(bp.sub)}</span>` : ''}`
          + `${bp.bblId ? `<br><span class="small muted">${esc(bp.bblId)}</span>` : ''}`
          + `${bp.href ? `<br><a class="link" href="${esc(bp.href)}">Objekt ansehen →</a>` : ''}`,
        ).addTo(map);
      } else {
        const pf = ((parcels && parcels.features) || []).find((f) => f.properties && f.properties.id === focus);
        const ring = pf && pf.geometry && pf.geometry.coordinates && pf.geometry.coordinates[0];
        if (ring && ring.length) {
          const ct = [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
          const pr = pf.properties;
          map.easeTo({ center: ct, zoom: 16 });
          popup.setLngLat(ct).setHTML(
            `<strong>${esc(pr.label)}</strong>${pr.sub ? `<br><span class="small muted">${esc(pr.sub)}</span>` : ''}`
            + `<br><span class="small muted">Grundstück ${esc(pr.id)}${pr.area ? ' · ' + Number(pr.area).toLocaleString('de-CH') + ' m²' : ''}</span>`
            + `${pr.href ? `<br><a class="link" href="${esc(pr.href)}">Objekt ansehen →</a>` : ''}`,
          ).addTo(map);
        }
      }
    }
  });

  const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '260px' });
  map.on('click', 'clusters', (e) => {
    const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
    if (!f) return;
    Promise.resolve(map.getSource('estate').getClusterExpansionZoom(f.properties.cluster_id))
      .then((z) => map.easeTo({ center: f.geometry.coordinates, zoom: z })).catch(() => {});
  });
  map.on('click', 'points', (e) => {
    const p = e.features[0].properties;
    popup.setLngLat(e.features[0].geometry.coordinates).setHTML(
      `<strong>${esc(p.label)}</strong>${p.sub ? `<br><span class="small muted">${esc(p.sub)}</span>` : ''}`
      + `${p.bbl_id ? `<br><span class="small muted">${esc(p.bbl_id)}</span>` : ''}`
      + `${p.href ? `<br><a class="link" href="${esc(p.href)}">Objekt ansehen →</a>` : ''}`,
    ).addTo(map);
  });
  // Parcel polygon → same basic popup as a building, with the inventory deep-link.
  map.on('click', 'parcels-fill', (e) => {
    const p = e.features[0].properties;
    popup.setLngLat(e.lngLat).setHTML(
      `<strong>${esc(p.label)}</strong>${p.sub ? `<br><span class="small muted">${esc(p.sub)}</span>` : ''}`
      + `<br><span class="small muted">Grundstück ${esc(p.id)}${p.area ? ' · ' + Number(p.area).toLocaleString('de-CH') + ' m²' : ''}</span>`
      + `${p.href ? `<br><a class="link" href="${esc(p.href)}">Objekt ansehen →</a>` : ''}`,
    ).addTo(map);
  });
  for (const lyr of ['clusters', 'points', 'parcels-fill']) {
    map.on('mouseenter', lyr, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', lyr, () => { map.getCanvas().style.cursor = ''; });
  }
  container._map = map;   // handle for debugging / headless tests (drive camera, query layers)
  return map;
}

export default { initBuildingsMap, initEstateMap };
