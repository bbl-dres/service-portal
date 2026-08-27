// The basemap every MapLibre view in the portal starts from.
//
// CARTO POSITRON, AS A VECTOR STYLE. The portal used to build its own style
// object around CARTO's raster endpoint (`basemaps.cartocdn.com/light_all/
// {z}/{x}/{y}.png`) with a same-origin glyph directory beside it. That endpoint
// is now part of CARTO's keyless-raster deprecation: it still answers 200, but
// the PNG it returns has «API KEY REQUIRED / carto.com/basemaps/apikey» stamped
// diagonally across it. The watermark is in the image bytes, so no styling,
// layer order or attribution setting can remove it.
//
// Vector tiles carry no such stamp, because they carry no pixels: they are
// geometry, and MapLibre draws the labels client-side from this style. The
// sibling prototypes (green-inventory, property-inventory, the tenant portal)
// already load exactly this style, so the four now agree.
//
// WHAT THIS COST. The raster style shipped its own `glyphs`, pinned by SHA-256
// and served from the portal's own origin, so no label could depend on a third
// party. A style has ONE glyph endpoint for all of its text, and Positron's 93
// layers need Open Sans, Montserrat, Noto Sans, HanWangHei and NanumBarunGothic
// across the full Unicode range — which cannot be served from a directory
// holding two Latin-1 ranges. The glyphs therefore come from CARTO with the
// tiles. The guarantee that mattered survives elsewhere and by a different
// mechanism: js/map/buildings-map.js keeps interactive cluster geometry on the
// `estate` source and its labels on `estate-labels`, so a glyph failure can
// still only cost the text, never the clusters or their navigation.
//
// The style, its tiles, its glyphs and its sprite are all fetched from CARTO at
// runtime and cannot be covered by the repository's SRI hashes, like the tiles
// before them. A production deployment should self-host the whole style.
const POSITRON_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

// The fontstack the portal's OWN symbol layers must ask for. Positron's glyph
// endpoint has no «Noto Sans Bold» — it answers 404 — which is what the two
// layers in buildings-map.js used to request from the local directory. Naming
// the stack here keeps that dependency in the same file as the style that
// decides it, rather than as a literal in a layer definition far away.
export const MAP_FONT = { regular: 'Open Sans Regular', bold: 'Open Sans Bold' };

// A string rather than an object: MapLibre resolves the URL itself, and there is
// no longer a local style to assemble. Kept as a function so every map in the
// portal still reaches the basemap through one named call.
export function createBaseMapStyle() {
  return POSITRON_STYLE_URL;
}
