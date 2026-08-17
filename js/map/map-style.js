const GLYPH_DIRECTORY = '../../assets/map-glyphs/';

// Resolve from this module instead of the document root. The resulting absolute
// URL keeps a deployment prefix such as /service-portal/ while leaving the two
// MapLibre placeholders intact for runtime substitution.
export function mapGlyphTemplate(moduleUrl = import.meta.url) {
  return `${new URL(GLYPH_DIRECTORY, moduleUrl).href}{fontstack}/{range}.pbf`;
}

// Return a fresh style because MapLibre owns and mutates the object it receives.
export function createBaseMapStyle(moduleUrl = import.meta.url) {
  return {
    version: 8,
    glyphs: mapGlyphTemplate(moduleUrl),
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
    layers: [
      { id: 'map-background', type: 'background', paint: { 'background-color': '#f0f4f7' } },
      { id: 'carto', type: 'raster', source: 'carto' },
    ],
  };
}
