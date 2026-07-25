// MapLibre GL building map for the Immobilienportfolio dashboard.
//
// The portal is otherwise dependency-free; MapLibre is loaded lazily from a CDN
// only when the «Karte» tab is opened, and degrades to a message if unavailable
// (e.g. offline / blocked network). Basemap: swisstopo WMTS (official Swiss map).
// Building coordinates are WGS84 lat/lng from data/buildings.json. Marks are HTML
// markers (a handful of points) — simple, accessible and reliably rendered.

const MAPLIBRE_VER = '4.7.1';
let mlPromise = null;

function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (mlPromise) return mlPromise;
  mlPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VER}/dist/maplibre-gl.css`;
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VER}/dist/maplibre-gl.js`;
    s.onload = () => window.maplibregl ? resolve(window.maplibregl) : reject(new Error('maplibregl fehlt'));
    s.onerror = () => reject(new Error('MapLibre konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
  return mlPromise;
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// swisstopo grey basemap in Web Mercator (3857) — a calm ground for the data marks.
const STYLE = {
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

/**
 * Initialise the map inside `container`. `buildings` = core.buildings().
 * Returns the map instance (or null if MapLibre could not load).
 */
export async function initBuildingsMap(container, buildings) {
  const pts = (buildings || []).filter(b => Number.isFinite(b.lat) && Number.isFinite(b.lng));
  let maplibregl;
  try {
    maplibregl = await loadMapLibre();
  } catch (e) {
    container.innerHTML = `<div class="empty empty--unavailable" style="height:100%">
      <span>Die Karte konnte nicht geladen werden (${esc(e.message)}). Im Bundesnetz ist der Kartendienst ggf. gesperrt.</span></div>`;
    return null;
  }
  // container may have been detached during the async gap (tab switched away)
  if (!container.isConnected) return null;

  // Marker diameter ∝ √(Geschossfläche): area-proportional, 12–44 px.
  const maxGf = Math.max(...pts.map(b => Number(b.gf) || 0), 1);
  const diam = (gf) => Math.round(12 + 32 * Math.sqrt((Number(gf) || 0) / maxGf));

  // Initial view: centre on the marks (centroid) at a fixed zoom, computed up
  // front — no dependency on an async 'load' event or fitBounds animation.
  let center = [8.23, 46.82], zoom = 6.6;
  if (pts.length) {
    center = [pts.reduce((a, b) => a + b.lng, 0) / pts.length, pts.reduce((a, b) => a + b.lat, 0) / pts.length];
    zoom = 8.4;
  }

  const map = new maplibregl.Map({ container, style: STYLE, center, zoom, attributionControl: { compact: true } });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.scrollZoom.disable(); // don't hijack page scroll; +/- controls and drag still work

  const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '260px' });
  for (const b of pts) {
    const d = diam(b.gf);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'map-marker';
    el.style.width = el.style.height = `${d}px`;
    el.setAttribute('aria-label', b.name);
    el.title = b.name;
    const sub = `${b.street || ''}, ${b.zip || ''} ${b.city || ''}`.trim();
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      popup.setLngLat([b.lng, b.lat]).setHTML(
        `<strong>${esc(b.name)}</strong><br><span class="small muted">${esc(sub)}</span>`
        + `<br><a class="link" href="#/app/portfolio/${encodeURIComponent(b.bbl_id)}">Objekt ansehen →</a>`,
      ).addTo(map);
    });
    new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([b.lng, b.lat]).addTo(map);
  }

  return map;
}

export default { initBuildingsMap };
