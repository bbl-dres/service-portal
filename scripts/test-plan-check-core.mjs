import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  CAD_COLOR_INDEX,
  LIBREDWG_VERSION,
  LIMITS,
  MAX_FILE_SIZE,
  PARSER_TIMEOUT_MS,
  PLAN_CHECK_INTAKE_ENABLED,
  PlanCheckParserError,
  aciToHex,
  assertResultBudget,
  inspectDwgHeader,
} from '../js/plan-check/config.js';
import {
  computePolygonArea,
  hashVertices,
  hasSelfIntersection,
  pointInPolygon,
  segmentsIntersect,
  visualCenter,
} from '../js/plan-check/geometry.js';
import { normalizeDrawing } from '../js/plan-check/normalize.js';
import { ALL_RULES, validateDrawing } from '../js/plan-check/rules.js';
import { createPlanCheckParser } from '../js/plan-check/parser-client.js';
import {
  PLAN_CHECK_FINDING_SELECTION_LIMIT,
  planCheckAccessibleCadColor,
  planCheckCanvasOverlayColors,
  planCheckContrastRatio,
  planCheckFindingRenderItems,
  planCheckFindingSpatialTarget,
  planCheckItemBounds,
  planCheckItemDistance,
  planCheckSelectionDetails,
} from '../js/plan-check/viewer.js';
import {
  planCheckNetArea,
  planCheckSelectionSummary,
  renderPlanCheckInspector,
  renderPlanCheckLegend,
  renderPlanCheckPage,
  renderPlanCheckPanel,
} from '../js/plan-check/view.js';
import {
  buildPlanCheckCsv,
  buildPlanCheckJson,
  planCheckReportFilename,
} from '../js/plan-check/report.js';
import { planCheckReportModel } from '../js/plan-check/report-model.js';
import { planCheckExcelSheets, planCheckExcelFilename } from '../js/plan-check/report-excel.js';
import { planCheckPdfFilename } from '../js/plan-check/report-pdf.js';

const expectedHashes = new Map([
  ['../js/vendor/libredwg/LICENSE', '8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903'],
  ['../js/vendor/libredwg/dist/libredwg-web.js', '438b77262a85e8815e3928f3ff97a51ec84df06d3f3fd184c8459e798d568b81'],
  ['../js/vendor/libredwg/wasm/libredwg-web.js', '62deaef11c2d6cf8fd0a0ee83d29120ca40bdabc2cdd9baa1f7911410bf9d73f'],
  ['../js/vendor/libredwg/wasm/libredwg-web.wasm', 'd8b78f6d5e63e6e178cf7343cfd08ebe798d75b6754c593e15d8f948b823e038'],
  ['../assets/plan-check/CAD.V01-CAFM-Plan-DE.dwg', 'e69f34d37ed6a7c7223457a7478a534ecbfd4cac556ef693cb8060129299e0a9'],
]);
for (const [relativePath, expected] of expectedHashes) {
  const content = await readFile(new URL(relativePath, import.meta.url));
  assert.equal(createHash('sha256').update(content).digest('hex'), expected, relativePath);
}
const runtimeManifest = JSON.parse(await readFile(
  new URL('../js/vendor/libredwg/RUNTIME-MANIFEST.json', import.meta.url), 'utf8'));
assert.equal(runtimeManifest.schema, 'bbl-plan-check-runtime/1');
assert.deepEqual(runtimeManifest.package, {
  name: '@mlightcad/libredwg-web',
  version: '0.7.9',
  license: 'GPL-3.0',
  releaseTag: 'https://github.com/mlightcad/libredwg-web/releases/tag/v0.7.9',
  taggedCommit: 'b70b5573a6bf2345e5fb10f2adff7fb74a8123c5',
  correspondingSourceUrl: 'https://github.com/mlightcad/libredwg-web/tree/b70b5573a6bf2345e5fb10f2adff7fb74a8123c5',
  npmTarball: 'https://registry.npmjs.org/@mlightcad/libredwg-web/-/libredwg-web-0.7.9.tgz',
  npmIntegrity: 'sha512-tqjx0eCiR0CNI3TyO3LVYzl4ptuzSFm7asGn/C1YiJaEk7Vneto+lRrVUco85qw+PZDihaFLwWqdYIEse1swbA==',
  npmTarballSha256: 'ab965aec46d03d5c8cb646a8d220a806cd1a04a9c46be1ad1993e1da35d33364',
});
for (const [relativePath, expected] of Object.entries(runtimeManifest.files)) {
  const content = await readFile(new URL(`../js/vendor/libredwg/${relativePath}`, import.meta.url));
  assert.equal(createHash('sha256').update(content).digest('hex'), expected,
    `runtime manifest: ${relativePath}`);
}
const vendorLicense = await readFile(new URL('../js/vendor/libredwg/LICENSE', import.meta.url), 'utf8');
assert.match(vendorLicense, /GNU GENERAL PUBLIC LICENSE\s+Version 3, 29 June 2007/);
const fixtureRecord = await readFile(new URL('../assets/plan-check/README.md', import.meta.url), 'utf8');
assert.match(fixtureRecord, /Source repository license: MIT/);
assert.match(fixtureRecord, /2011-DM-0-A04-6A1\.dwg[\s\S]*intentionally excluded/);
const referenceLicense = await readFile(new URL('../js/plan-check/PLAN_CHECK_REFERENCE_LICENSE', import.meta.url), 'utf8');
assert.match(referenceLicense, /MIT License[\s\S]*Copyright \(c\) 2026 David Rasner/);
const parserWorkerSource = await readFile(new URL('../js/plan-check/parser-worker.js', import.meta.url), 'utf8');
assert.match(parserWorkerSource,
  /const unknownEntityCount[\s\S]*normalizeDrawing\(database, \{ unknownEntityCount \}\)[\s\S]*validateDrawing\(drawing/,
  'converter unknown-entity diagnostics must reach normalization before validation');

const square = [
  { x: 0, y: 0 },
  { x: 5_000, y: 0 },
  { x: 5_000, y: 4_000 },
  { x: 0, y: 4_000 },
];
assert.equal(CAD_COLOR_INDEX.length, 257);
assert.equal(Object.isFrozen(CAD_COLOR_INDEX), true);
assert.equal(createHash('sha256').update(CAD_COLOR_INDEX.join(',')).digest('hex'),
  '58b4c3bcda446dcf15ebcd0da4d2eb8a2c71bf0eb2cea00a7451146eb4caadc1');
assert.equal(aciToHex(22), '#CC3300');
assert.equal(aciToHex(141), '#7FDFFF');
assert.equal(aciToHex(250), '#333333');
assert.equal(aciToHex('not-an-index'), '#FFFFFF');
assert.ok(planCheckContrastRatio('#00FF00', '#FFFFFF') < 3);
assert.ok(planCheckContrastRatio('#00FFFF', '#FFFFFF') < 3);
assert.ok(planCheckContrastRatio('#10B981', '#FFFFFF') < 3);
assert.ok(planCheckContrastRatio('#F97316', '#FFFFFF') < 3);
for (const surface of ['#FFFFFF', '#131B22']) {
  const overlay = planCheckCanvasOverlayColors({ surface });
  for (const status of ['selectedColor', 'errorColor', 'warningColor', 'successColor']) {
    assert.ok(planCheckContrastRatio(overlay[status], surface) >= 3,
      `${status} must retain 3:1 Canvas contrast on ${surface}`);
  }
  assert.ok(overlay.successFill.startsWith('rgba('));
  assert.ok(overlay.warningFill.startsWith('rgba('));
}
const rotatedEllipseBounds = planCheckItemBounds({
  t: 'ellipse', cx: 100, cy: 200, rx: 10, ry: 2, rot: Math.PI / 4,
});
const ellipseExtent = Math.hypot(10 / Math.sqrt(2), 2 / Math.sqrt(2));
assert.ok(Math.abs(rotatedEllipseBounds.minX - (100 - ellipseExtent)) < 1e-9);
assert.ok(Math.abs(rotatedEllipseBounds.maxY - (200 + ellipseExtent)) < 1e-9);
assert.ok(planCheckItemDistance(100 + (10 / Math.sqrt(2)), 200 + (10 / Math.sqrt(2)), {
  t: 'ellipse', cx: 100, cy: 200, rx: 10, ry: 2, rot: Math.PI / 4,
}) < 1e-9);
assert.ok(planCheckItemDistance(100 + ellipseExtent, 200 - ellipseExtent, {
  t: 'ellipse', cx: 100, cy: 200, rx: 10, ry: 2, rot: Math.PI / 4,
}) > 1);
assert.ok(planCheckItemDistance(0, 10, {
  t: 'arc', cx: 0, cy: 0, r: 10, sa: 0, ea: Math.PI / 2,
}) < 1e-9);
assert.ok(planCheckItemDistance(-10, 0, {
  t: 'arc', cx: 0, cy: 0, r: 10, sa: 0, ea: Math.PI / 2,
}) > 10);
const hatchWithIsland = {
  t: 'hatchfill',
  paths: [
    [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }],
    [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }, { x: 5, y: 15 }],
  ],
};
assert.equal(planCheckItemDistance(2, 2, hatchWithIsland), 0);
assert.ok(planCheckItemDistance(10, 10, hatchWithIsland) >= 5,
  'a HATCH island must not be selectable as filled geometry');
assert.ok(planCheckItemDistance(25, 10, hatchWithIsland) >= 5);
const cadContrastMatrix = [
  ['light', '#FFFFFF'],
  ['dark', '#131B22'],
].flatMap(([mode, background]) => (
  ['#00FF00', '#00FFFF', '#FFFFFF', '#000000'].map((color) => ({
    mode, background, color,
    adjusted: planCheckAccessibleCadColor(color, background),
  }))
));
for (const entry of cadContrastMatrix) {
  assert.ok(planCheckContrastRatio(entry.adjusted, entry.background) >= 3,
    `${entry.mode} ${entry.color} must retain 3:1 Canvas contrast; got ${entry.adjusted}`);
}
for (let colorIndex = 0; colorIndex <= 256; colorIndex += 1) {
  const color = aciToHex(colorIndex);
  for (const background of ['#FFFFFF', '#131B22']) {
    const adjusted = planCheckAccessibleCadColor(color, background);
    assert.ok(planCheckContrastRatio(adjusted, background) >= 3,
      `ACI ${colorIndex} must retain 3:1 Canvas contrast on ${background}`);
  }
}
assert.equal(planCheckAccessibleCadColor('#000000', '#FFFFFF'), '#000000');
assert.equal(planCheckAccessibleCadColor('#FFFFFF', '#131B22'), '#FFFFFF');
assert.equal(planCheckAccessibleCadColor('#00FF00', '#131B22'), '#00FF00');
assert.equal(planCheckAccessibleCadColor('#00FFFF', '#131B22'), '#00FFFF');
const adjustedGreen = planCheckAccessibleCadColor('#00FF00', '#FFFFFF').match(/\d+/g).map(Number);
const adjustedCyan = planCheckAccessibleCadColor('#00FFFF', '#FFFFFF').match(/\d+/g).map(Number);
assert.ok(adjustedGreen[1] > adjustedGreen[0] && adjustedGreen[1] > adjustedGreen[2]);
assert.ok(adjustedCyan[1] === adjustedCyan[2] && adjustedCyan[1] > adjustedCyan[0]);
for (const background of ['#FFFFFF', '#131B22']) {
  const adjusted = planCheckAccessibleCadColor('#123456', background);
  assert.ok(planCheckContrastRatio(adjusted, background) >= 3,
    `TrueColor #123456 must retain 3:1 Canvas contrast on ${background}`);
}
assert.equal(computePolygonArea(square), 20_000_000);
assert.equal(pointInPolygon(2_500, 2_000, square), true);
assert.equal(pointInPolygon(8_000, 2_000, square), false);
assert.equal(hasSelfIntersection(square), false);
assert.equal(hasSelfIntersection([
  { x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 },
]), true);
assert.equal(segmentsIntersect(
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 },
), true, 'collinear overlap is an intersection');
assert.equal(segmentsIntersect(
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 },
), true, 'shared endpoint is an intersection');
assert.equal(hasSelfIntersection([
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
]), true, 'non-adjacent collinear overlap is a self-intersection');
const rotatedSquare = [square[2], square[3], square[0], square[1]];
assert.equal(hashVertices(rotatedSquare), hashVertices(square));
assert.equal(hashVertices([...square].reverse()), hashVertices(square));
const center = visualCenter(square);
assert.ok(Math.abs(center.x - 2_500) < 1);
assert.ok(Math.abs(center.y - 2_000) < 1);

const layerNames = [
  'R_RAUMPOLYGON', 'R_AOID', 'R_GESCHOSSPOLYGON', 'A_ARCHITEKTUR',
  'A_SCHRAFFUR', 'V_BEMASSUNG', 'V_PLANLAYOUT',
];
const database = {
  header: { $INSUNITS: 4, version: 'AC1032' },
  entities: [
    { type: 'LWPOLYLINE', layer: 'R_RAUMPOLYGON', handle: '10', flag: 1, vertices: square },
    { type: 'TEXT', layer: 'R_AOID', handle: '11', text: '1234.AA.01.001', startPoint: { x: 2_500, y: 2_000 },
      textHeight: 250, styleName: 'STANDARD' },
    { type: 'LWPOLYLINE', layer: 'R_GESCHOSSPOLYGON', handle: '12', flag: 1,
      vertices: [{ x: -500, y: -500 }, { x: 5_500, y: -500 }, { x: 5_500, y: 4_500 }, { x: -500, y: 4_500 }] },
    { type: 'LWPOLYLINE', layer: 'V_PLANLAYOUT', handle: '13', flag: 1,
      vertices: [{ x: -1_000, y: -1_000 }, { x: 6_000, y: -1_000 }, { x: 6_000, y: 5_000 }, { x: -1_000, y: 5_000 }] },
    { type: 'LINE', layer: 'A_ARCHITEKTUR', handle: '14', startPoint: { x: 0, y: 0 }, endPoint: { x: 5_000, y: 0 } },
    { type: 'DIMENSION', layer: 'V_BEMASSUNG', handle: '15', flag: 1,
      definitionPoint: { x: 0, y: 0 }, subDefinitionPoint1: { x: 5_000, y: 0 } },
  ],
  tables: {
    LAYER: { entries: layerNames.map((name) => ({ name, colorIndex: 7 })) },
    STYLE: { entries: [{ name: 'STANDARD', fontName: 'Arial.ttf' }] },
    LAYOUT: { entries: [{ name: 'Model' }] },
    BLOCK_RECORD: { entries: [] },
  },
};

const drawing = normalizeDrawing(database);
assert.ok(drawing.renderList.length >= 6);
assert.deepEqual(drawing.bounds, { minX: -1_000, minY: -1_000, maxX: 6_000, maxY: 5_000, width: 7_000, height: 6_000 });
assert.equal(drawing.layerInfo.length, 7);
assert.equal(drawing.insunits, 4);
assert.ok(drawing.renderList.every((item) => JSON.stringify(item).includes('null') === false));
assert.equal(drawing.renderList.find((item) => item.handle === '11').fontName, 'Arial.ttf');

const visibilityDrawing = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [
    { type: 'LINE', layer: '0', handle: 'boolean-visible', isVisible: true,
      startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 0 } },
    { type: 'LINE', layer: '0', handle: 'boolean-hidden', isVisible: false,
      startPoint: { x: 0, y: 1 }, endPoint: { x: 1, y: 1 } },
    { type: 'LINE', layer: '0', handle: 'numeric-hidden', isVisible: 1,
      startPoint: { x: 0, y: 2 }, endPoint: { x: 1, y: 2 } },
    { type: 'LINE', layer: '0', handle: 'unspecified',
      startPoint: { x: 0, y: 3 }, endPoint: { x: 1, y: 3 } },
  ],
  tables: { LAYER: { entries: [{ name: '0', colorIndex: 7 }] } },
});
assert.deepEqual(visibilityDrawing.renderList.map((item) => item.handle), ['boolean-visible', 'unspecified']);
assert.equal(visibilityDrawing.diagnostics.skippedInvisibleEntities, 2);
assert.equal(visibilityDrawing.completeness.status, 'incomplete');

const inheritedBlockLayers = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [{
    type: 'INSERT', layer: 'PARENT', handle: 'insert', name: 'OUTER', insertionPoint: { x: 0, y: 0 },
  }],
  tables: {
    LAYER: { entries: [
      { name: '0', colorIndex: 7 },
      { name: 'PARENT', colorIndex: 1 },
      { name: 'CHILD', colorIndex: 3 },
    ] },
    BLOCK_RECORD: { entries: [
      { name: 'OUTER', entities: [
        { type: 'LINE', layer: '0', handle: 'child-zero',
          startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 0 } },
        { type: 'LINE', layer: 'CHILD', handle: 'child-explicit',
          startPoint: { x: 0, y: 1 }, endPoint: { x: 1, y: 1 } },
        { type: 'INSERT', layer: '0', handle: 'nested-insert', name: 'INNER', insertionPoint: { x: 0, y: 0 } },
      ] },
      { name: 'INNER', entities: [
        { type: 'LINE', layer: '0', handle: 'nested-zero',
          startPoint: { x: 0, y: 2 }, endPoint: { x: 1, y: 2 } },
      ] },
    ] },
  },
});
const inheritedByHandle = Object.fromEntries(inheritedBlockLayers.renderList.map((item) => [item.handle, item]));
assert.equal(inheritedByHandle['child-zero'].l, 'PARENT');
assert.equal(inheritedByHandle['child-zero'].c, '#FF0000');
assert.equal(inheritedByHandle['child-explicit'].l, 'CHILD');
assert.equal(inheritedByHandle['child-explicit'].c, '#00FF00');
assert.equal(inheritedByHandle['nested-zero'].l, 'PARENT');
assert.equal(inheritedBlockLayers.layerInfo.find((layer) => layer.name === 'PARENT').count, 2);
assert.equal(inheritedBlockLayers.layerInfo.find((layer) => layer.name === 'CHILD').count, 1);

const byBlockDrawing = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [
    { type: 'INSERT', layer: 'A_ARCHITEKTUR', colorIndex: 5, name: 'COLOR_OUTER',
      insertionPoint: { x: 0, y: 0 } },
    { type: 'LINE', layer: 'A_ARCHITEKTUR', colorIndex: 0, handle: 'top-by-block',
      startPoint: { x: 0, y: 4 }, endPoint: { x: 1, y: 4 } },
  ],
  tables: {
    LAYER: { entries: [
      { name: '0', colorIndex: 7 },
      { name: 'A_ARCHITEKTUR', colorIndex: 1 },
    ] },
    BLOCK_RECORD: { entries: [
      { name: 'COLOR_OUTER', entities: [
        { type: 'LINE', layer: '0', colorIndex: 0, handle: 'child-by-block',
          startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 0 } },
        { type: 'LINE', layer: '0', colorIndex: 256, handle: 'child-by-layer',
          startPoint: { x: 0, y: 1 }, endPoint: { x: 1, y: 1 } },
        { type: 'INSERT', layer: '0', colorIndex: 0, name: 'COLOR_INNER',
          insertionPoint: { x: 0, y: 0 } },
      ] },
      { name: 'COLOR_INNER', entities: [
        { type: 'LINE', layer: '0', colorIndex: 0, handle: 'nested-by-block',
          startPoint: { x: 0, y: 2 }, endPoint: { x: 1, y: 2 } },
        { type: 'LINE', layer: '0', colorIndex: 256, handle: 'nested-by-layer',
          startPoint: { x: 0, y: 3 }, endPoint: { x: 1, y: 3 } },
      ] },
    ] },
  },
});
const byBlockItem = (handle) => byBlockDrawing.renderList.find((item) => item.handle === handle);
for (const handle of ['child-by-block', 'nested-by-block']) {
  assert.deepEqual({ layer: byBlockItem(handle).l, color: byBlockItem(handle).c, byLayer: byBlockItem(handle).byLayer },
    { layer: 'A_ARCHITEKTUR', color: '#0000FF', byLayer: false });
}
for (const handle of ['child-by-layer', 'nested-by-layer']) {
  assert.deepEqual({ layer: byBlockItem(handle).l, color: byBlockItem(handle).c, byLayer: byBlockItem(handle).byLayer },
    { layer: 'A_ARCHITEKTUR', color: '#FF0000', byLayer: true });
}
assert.deepEqual({ color: byBlockItem('top-by-block').c, byLayer: byBlockItem('top-by-block').byLayer },
  { color: '#FF0000', byLayer: false });
const byBlockStyleFinding = validateDrawing(byBlockDrawing).errors.find((error) => error.ruleCode === 'STYLE_002');
assert.ok(byBlockStyleFinding);
for (const handle of ['child-by-block', 'nested-by-block', 'top-by-block']) {
  assert.ok(byBlockStyleFinding.handles.includes(handle));
}

const nonUniformCurves = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [{ type: 'INSERT', layer: 'A_ARCHITEKTUR', name: 'CURVES',
    insertionPoint: { x: 100, y: 50 }, xScale: 2, yScale: 1 }],
  tables: {
    LAYER: { entries: [{ name: 'A_ARCHITEKTUR', colorIndex: 7 }] },
    BLOCK_RECORD: { entries: [{ name: 'CURVES', entities: [
      { type: 'CIRCLE', layer: '0', handle: 'scaled-circle', center: { x: 0, y: 0 }, radius: 10 },
      { type: 'ARC', layer: '0', handle: 'scaled-arc', center: { x: 0, y: 0 }, radius: 10,
        startAngle: 0, endAngle: Math.PI / 2 },
      { type: 'LWPOLYLINE', layer: '0', handle: 'scaled-bulge', vertices: [
        { x: 0, y: 0, bulge: 1 }, { x: 5, y: 0, bulge: 0 },
      ] },
      { type: 'TEXT', layer: '0', handle: 'scaled-text', text: 'A', textHeight: 2,
        startPoint: { x: 0, y: 0 }, rotation: 0 },
    ] }] },
  },
});
const scaledCircle = nonUniformCurves.renderList.find((item) => item.handle === 'scaled-circle');
assert.deepEqual({ t: scaledCircle.t, cx: scaledCircle.cx, cy: scaledCircle.cy,
  rx: scaledCircle.rx, ry: scaledCircle.ry, rot: scaledCircle.rot },
{ t: 'ellipse', cx: 100, cy: 50, rx: 20, ry: 10, rot: 0 });
assert.deepEqual(nonUniformCurves.bounds, { minX: 80, minY: 40, maxX: 120, maxY: 60, width: 40, height: 20 });
const scaledArc = nonUniformCurves.renderList.find((item) => item.handle === 'scaled-arc');
assert.equal(scaledArc.t, 'poly');
assert.deepEqual(scaledArc.verts[0], { x: 120, y: 50, bulge: 0 });
assert.ok(Math.abs(scaledArc.verts.at(-1).x - 100) < 1e-9);
assert.ok(Math.abs(scaledArc.verts.at(-1).y - 60) < 1e-9);
assert.equal(nonUniformCurves.diagnostics.approximatedNonUniformArcs, 1);
assert.equal(nonUniformCurves.diagnostics.approximatedNonUniformPolylines, 1);
const scaledBulge = nonUniformCurves.renderList.find((item) => item.handle === 'scaled-bulge');
assert.ok(scaledBulge.verts.every((point) => point.bulge === 0));
assert.equal(scaledBulge.sourceHasBulges, true);
assert.equal(nonUniformCurves.diagnostics.approximatedNonUniformText, 1);

const reservedNonUniformBulges = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [
    { type: 'INSERT', layer: 'R_RAUMPOLYGON', name: 'BULGED_RESERVED',
      insertionPoint: { x: 0, y: 0 }, xScale: 2, yScale: 1 },
    { type: 'INSERT', layer: 'R_GESCHOSSPOLYGON', name: 'BULGED_RESERVED',
      insertionPoint: { x: 20, y: 0 }, xScale: 2, yScale: 1 },
  ],
  tables: {
    LAYER: { entries: [
      { name: 'R_RAUMPOLYGON', colorIndex: 7 },
      { name: 'R_GESCHOSSPOLYGON', colorIndex: 7 },
    ] },
    BLOCK_RECORD: { entries: [{ name: 'BULGED_RESERVED', entities: [{
      type: 'LWPOLYLINE', layer: '0', handle: 'reserved-source-bulge', flag: 1,
      vertices: [
        { x: 0, y: 0, bulge: 0.5 }, { x: 5, y: 0 }, { x: 0, y: 5 },
      ],
    }] }] },
  },
});
assert.ok(reservedNonUniformBulges.renderList.every((item) => (
  item.sourceHasBulges && item.verts.every((vertex) => vertex.bulge === 0)
)));
const reservedBulgeValidation = validateDrawing(reservedNonUniformBulges);
assert.ok(reservedBulgeValidation.errors.some((error) => error.ruleCode === 'POLY_002'));
assert.ok(reservedBulgeValidation.errors.some((error) => error.ruleCode === 'GPOLY_002'));

const outerTransform = (point) => {
  const scaled = { x: point.x * 2, y: point.y };
  return {
    x: 10 + scaled.x * Math.cos(Math.PI / 4) - scaled.y * Math.sin(Math.PI / 4),
    y: 20 + scaled.x * Math.sin(Math.PI / 4) + scaled.y * Math.cos(Math.PI / 4),
  };
};
const nestedTransform = (point) => {
  const scaled = { x: point.x, y: point.y * 3 };
  const rotated = {
    x: 3 + scaled.x * Math.cos(Math.PI / 6) - scaled.y * Math.sin(Math.PI / 6),
    y: 4 + scaled.x * Math.sin(Math.PI / 6) + scaled.y * Math.cos(Math.PI / 6),
  };
  return outerTransform(rotated);
};
const nestedAffine = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [{ type: 'INSERT', layer: 'PARENT', name: 'AFFINE_OUTER', insertionPoint: { x: 10, y: 20 },
    xScale: 2, yScale: 1, rotation: Math.PI / 4 }],
  tables: {
    LAYER: { entries: [{ name: 'PARENT', colorIndex: 7 }] },
    BLOCK_RECORD: { entries: [
      { name: 'AFFINE_OUTER', entities: [{ type: 'INSERT', layer: '0', name: 'AFFINE_INNER',
        insertionPoint: { x: 3, y: 4 }, xScale: 1, yScale: 3, rotation: Math.PI / 6 }] },
      { name: 'AFFINE_INNER', entities: [
        { type: 'LINE', layer: '0', handle: 'affine-line',
          startPoint: { x: 0, y: 0 }, endPoint: { x: 2, y: 1 } },
        { type: 'LWPOLYLINE', layer: '0', handle: 'affine-poly', vertices: [
          { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 },
        ] },
      ] },
    ] },
  },
});
const assertPointNear = (actual, expected) => {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-9, `${actual.x} != ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) < 1e-9, `${actual.y} != ${expected.y}`);
};
const affineLine = nestedAffine.renderList.find((item) => item.handle === 'affine-line');
assertPointNear({ x: affineLine.x1, y: affineLine.y1 }, nestedTransform({ x: 0, y: 0 }));
assertPointNear({ x: affineLine.x2, y: affineLine.y2 }, nestedTransform({ x: 2, y: 1 }));
const affinePoly = nestedAffine.renderList.find((item) => item.handle === 'affine-poly');
affinePoly.verts.forEach((point, index) => assertPointNear(point, nestedTransform([
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 },
][index])));
assert.ok(affinePoly.verts.every((point) => point.bulge === 0));

const colorDrawing = normalizeDrawing({
  ...database,
  entities: [
    ...database.entities,
    { type: 'LINE', layer: 'A_ARCHITEKTUR', handle: 'TRUE-COLOR', color: 0x123456, colorIndex: 256,
      startPoint: { x: 0, y: 100 }, endPoint: { x: 5_000, y: 100 } },
    { type: 'LINE', layer: 'A_ARCHITEKTUR', handle: 'TRUE-BLACK', color: 0x000000, colorIndex: 0,
      startPoint: { x: 0, y: 200 }, endPoint: { x: 5_000, y: 200 } },
    { type: 'LINE', layer: 'A_ARCHITEKTUR', handle: 'BY-LAYER', colorIndex: 256,
      startPoint: { x: 0, y: 300 }, endPoint: { x: 5_000, y: 300 } },
    { type: 'LINE', layer: 'A_ARCHITEKTUR', handle: 'ACI-7', colorIndex: 7,
      startPoint: { x: 0, y: 400 }, endPoint: { x: 5_000, y: 400 } },
    { type: 'LINE', layer: 'A_ARCHITEKTUR', handle: 'INVALID-TRUE-COLOR', color: 0x1000000, colorIndex: 256,
      startPoint: { x: 0, y: 500 }, endPoint: { x: 5_000, y: 500 } },
  ],
  tables: {
    ...database.tables,
    LAYER: { entries: layerNames.map((name) => ({
      name,
      colorIndex: name === 'A_ARCHITEKTUR' ? 22 : name === 'A_SCHRAFFUR' ? 256 : 7,
      color: name === 'A_SCHRAFFUR' ? 0x654321 : 0xFFFFFF,
    })) },
  },
});
const colorItem = (handle) => colorDrawing.renderList.find((item) => item.handle === handle);
assert.deepEqual({ c: colorItem('TRUE-COLOR').c, byLayer: colorItem('TRUE-COLOR').byLayer },
  { c: '#123456', byLayer: false });
assert.deepEqual({ c: colorItem('TRUE-BLACK').c, byLayer: colorItem('TRUE-BLACK').byLayer },
  { c: '#000000', byLayer: false });
assert.deepEqual({ c: colorItem('BY-LAYER').c, byLayer: colorItem('BY-LAYER').byLayer },
  { c: '#CC3300', byLayer: true });
assert.deepEqual({ c: colorItem('ACI-7').c, byLayer: colorItem('ACI-7').byLayer },
  { c: '#FFFFFF', byLayer: false });
assert.deepEqual({ c: colorItem('INVALID-TRUE-COLOR').c, byLayer: colorItem('INVALID-TRUE-COLOR').byLayer },
  { c: '#CC3300', byLayer: true });
assert.equal(colorDrawing.layerInfo.find((layer) => layer.name === 'A_ARCHITEKTUR').colorHex, '#CC3300');
assert.equal(colorDrawing.layerInfo.find((layer) => layer.name === 'A_SCHRAFFUR').colorHex, '#654321');
const trueColorStyleFinding = validateDrawing(colorDrawing).errors.find((error) => error.ruleCode === 'STYLE_002');
assert.ok(trueColorStyleFinding?.handles.includes('TRUE-COLOR'));
assert.ok(trueColorStyleFinding?.handles.includes('TRUE-BLACK'));
assert.ok(!trueColorStyleFinding?.handles.includes('INVALID-TRUE-COLOR'));

const findingRenderList = [
  { t: 'line', handle: 'A', l: 'A_ARCHITEKTUR', x1: 0, y1: 0, x2: 1, y2: 1 },
  { t: 'hatchfill', handle: 'A', l: 'A_ARCHITEKTUR', paths: [[
    { x: 10, y: 10 }, { x: 12, y: 10 }, { x: 12, y: 12 },
  ]] },
  { t: 'text', handle: 'B', l: 'V_TEXT', x: 2, y: 2, text: 'B' },
  { t: 'line', handle: 'C', l: 'V_TEXT', x1: 3, y1: 3, x2: 4, y2: 4 },
];
const singularFinding = planCheckFindingRenderItems({ handle: 'A' }, findingRenderList);
assert.deepEqual(singularFinding.items, [findingRenderList[0], findingRenderList[1]]);
assert.equal(singularFinding.source, 'handles');
assert.equal(singularFinding.truncated, false);
const aggregateFinding = planCheckFindingRenderItems({ handles: ['C', 'B', 'C', '', null] }, findingRenderList);
assert.deepEqual(aggregateFinding.items, [findingRenderList[3], findingRenderList[2]]);
assert.equal(aggregateFinding.source, 'handles');
const aggregateMultiPrimitiveFinding = planCheckFindingRenderItems({ handles: ['A', 'B'] }, findingRenderList);
assert.deepEqual(aggregateMultiPrimitiveFinding.items,
  [findingRenderList[0], findingRenderList[1], findingRenderList[2]]);
const layerFinding = planCheckFindingRenderItems({ handles: ['missing'], layer: 'V_TEXT' }, findingRenderList);
assert.deepEqual(layerFinding.items, [findingRenderList[2], findingRenderList[3]]);
assert.equal(layerFinding.source, 'layer');
const relatedFinding = planCheckFindingRenderItems(
  { handles: ['DIMENSION-PARENT'] }, findingRenderList,
  [{ handle: 'DIMENSION-PARENT', layer: 'A_ARCHITEKTUR' }],
);
assert.deepEqual(relatedFinding.items, [findingRenderList[0], findingRenderList[1]]);
assert.equal(relatedFinding.source, 'related-layer');
const largeFindingRenderList = Array.from({ length: PLAN_CHECK_FINDING_SELECTION_LIMIT + 5 }, (_, index) => ({
  t: 'point', handle: `P${index}`, l: 'MANY', x: index, y: index,
}));
const boundedFinding = planCheckFindingRenderItems({ layer: 'MANY' }, largeFindingRenderList);
assert.equal(boundedFinding.items.length, PLAN_CHECK_FINDING_SELECTION_LIMIT);
assert.equal(boundedFinding.truncated, true);
const repeatedHandleRenderList = Array.from({ length: PLAN_CHECK_FINDING_SELECTION_LIMIT + 5 }, (_, index) => ({
  t: 'point', handle: 'SHARED', l: 'MANY', x: index, y: index,
}));
const boundedHandleFinding = planCheckFindingRenderItems({ handle: 'SHARED' }, repeatedHandleRenderList);
assert.deepEqual(boundedHandleFinding.items, repeatedHandleRenderList.slice(0, PLAN_CHECK_FINDING_SELECTION_LIMIT));
assert.equal(boundedHandleFinding.truncated, true);

const spatialRoom = { id: 'room-1', handle: 'ROOM-HANDLE', vertices: square };
const spatialArea = { id: 'area-1', handle: 'AREA-HANDLE', vertices: square };
const spatialValidation = {
  rooms: [spatialRoom, { id: 'room-2', handle: 'SHARED-HANDLE' }],
  areas: [spatialArea, { id: 'area-2', handle: 'SHARED-HANDLE' }],
};
assert.deepEqual(planCheckFindingSpatialTarget({ roomId: 'room-1' }, spatialValidation), {
  item: spatialRoom, type: 'room',
});
assert.deepEqual(planCheckFindingSpatialTarget({ areaId: 'area-1' }, spatialValidation), {
  item: spatialArea, type: 'area',
});
assert.deepEqual(planCheckFindingSpatialTarget({ handle: 'AREA-HANDLE' }, spatialValidation), {
  item: spatialArea, type: 'area',
});
assert.equal(planCheckFindingSpatialTarget({}, spatialValidation), null);
assert.equal(planCheckFindingSpatialTarget({ roomId: 'missing', handle: 'missing' }, spatialValidation), null);
assert.equal(planCheckFindingSpatialTarget({ handle: 'SHARED-HANDLE' }, spatialValidation)?.type, 'room');

assert.equal(ALL_RULES.length, 40);
assert.equal(new Set(ALL_RULES.map((rule) => rule.code)).size, 40);
const validation = validateDrawing(drawing);
assert.equal(validation.rules.length, 40);
assert.equal(validation.rooms.length, 1);
assert.equal(validation.rooms[0].aoid, '1234.AA.01.001');
assert.equal(validation.rooms[0].area, 20);
// Unclassified rooms follow the stated HNF convention so the area balance is
// populated; `siaCategorySource` keeps the origin of the number visible.
assert.equal(validation.rooms[0].siaCategory, 'HNF');
assert.equal(validation.rooms[0].siaCategorySource, 'convention');
assert.equal(validation.areas.length, 1);
assert.equal(validation.metrics.roomPolygonArea, 20);
assert.equal(validation.metrics.hnf, 20);
assert.equal(validation.metrics.ngf, 20);
assert.equal(validation.metrics.nnf, 0);
assert.equal(validation.metrics.categorySource, 'convention');
assert.deepEqual(validation.metrics.categoryTotals, { HNF: 20, NNF: 0, VF: 0, FF: 0 });
assert.ok(Number.isInteger(validation.score));
assert.ok(validation.passedRules <= 40);
assert.ok(validation.rules.every((rule) => ['passed', 'failed', 'not-evaluated'].includes(rule.status)));
assert.equal(validation.rules.filter((rule) => rule.status === 'passed').length, validation.passedRules);
assert.equal(validation.rules.find((rule) => rule.code === 'DIM_002')?.status, 'not-evaluated');
assert.equal(validation.errors.some((error) => error.ruleCode === 'DIM_002'), false);
assert.equal(validation.rules.find((rule) => rule.code === 'AOID_006')?.status, 'not-evaluated');
assert.equal(validation.completeness.status, 'complete');
assert.equal(validation.completeness.complete, true);

const duplicateAoid = validateDrawing(normalizeDrawing({
  ...database,
  entities: [...database.entities, {
    type: 'TEXT', layer: 'R_AOID', handle: 'AOID-DUPLICATE', text: '1234.AA.01.001',
    startPoint: { x: 3_000, y: 2_000 }, textHeight: 250, styleName: 'STANDARD',
  }],
}));
const duplicateAoidFindings = duplicateAoid.errors.filter((error) => error.ruleCode === 'AOID_002');
assert.equal(duplicateAoidFindings.length, 0,
  'same-room raw duplicates belong to AOID_004, not multi-polygon AOID_002');
assert.ok(duplicateAoid.errors.some((error) => error.ruleCode === 'AOID_004'));
assert.equal(duplicateAoid.rules.find((rule) => rule.code === 'AOID_004')?.errorCount, 1);

const blankAoid = validateDrawing(normalizeDrawing({
  ...database,
  entities: database.entities.map((entity) => entity.handle === '11'
    ? { ...entity, text: '   \t' } : entity),
}));
assert.ok(blankAoid.errors.some((error) => error.ruleCode === 'AOID_001'),
  'a whitespace-only R_AOID text must not satisfy the required identifier');

const crossRoomAoid = validateDrawing(normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [
    { type: 'LWPOLYLINE', layer: 'R_RAUMPOLYGON', handle: 'ROOM-A', flag: 1,
      vertices: [{ x: 0, y: 0 }, { x: 1_000, y: 0 }, { x: 1_000, y: 1_000 }, { x: 0, y: 1_000 }] },
    { type: 'LWPOLYLINE', layer: 'R_RAUMPOLYGON', handle: 'ROOM-B', flag: 1,
      vertices: [{ x: 2_000, y: 0 }, { x: 3_000, y: 0 }, { x: 3_000, y: 1_000 }, { x: 2_000, y: 1_000 }] },
    { type: 'TEXT', layer: 'R_AOID', handle: 'AOID-A', text: '1234.AA.01.001',
      startPoint: { x: 500, y: 500 } },
    { type: 'TEXT', layer: 'R_AOID', handle: 'AOID-B', text: '1234.AA.01.001',
      startPoint: { x: 2_500, y: 500 } },
  ],
  tables: { LAYER: { entries: [
    { name: 'R_RAUMPOLYGON', colorIndex: 7 },
    { name: 'R_AOID', colorIndex: 7 },
  ] } },
}));
const crossRoomAoidFindings = crossRoomAoid.errors.filter((error) => error.ruleCode === 'AOID_002');
assert.equal(crossRoomAoidFindings.length, 2);
assert.ok(crossRoomAoidFindings.every((error) => /2 Raumpolygone/.test(error.message)));
assert.equal(crossRoomAoid.errors.some((error) => error.ruleCode === 'AOID_004'), false);

const alignedAoidDrawing = normalizeDrawing({
  ...database,
  entities: database.entities.map((entity) => entity.handle === '11' ? {
    ...entity,
    halign: 1,
    startPoint: { x: 7_000, y: 2_000 },
    endPoint: { x: 2_500, y: 2_000 },
  } : entity),
});
const alignedAoidText = alignedAoidDrawing.renderList.find((item) => item.handle === '11');
assert.deepEqual({
  x: alignedAoidText.x,
  y: alignedAoidText.y,
  usesAlignmentPoint: alignedAoidText.usesAlignmentPoint,
  sourceBaseX: alignedAoidText.sourceBaseX,
  sourceBaseY: alignedAoidText.sourceBaseY,
}, { x: 2_500, y: 2_000, usesAlignmentPoint: true, sourceBaseX: 7_000, sourceBaseY: 2_000 });
const alignedAoid = validateDrawing(alignedAoidDrawing);
assert.ok(alignedAoid.errors.some((error) => error.ruleCode === 'AOID_006' && error.handle === '11'));
assert.equal(alignedAoid.rules.find((rule) => rule.code === 'AOID_006')?.status, 'failed');

const unresolvedFontDrawing = normalizeDrawing({
  ...database,
  tables: { ...database.tables, STYLE: { entries: [] } },
});
const unresolvedFontFinding = validateDrawing(unresolvedFontDrawing).errors.find(
  (error) => error.ruleCode === 'TEXT_002',
);
assert.ok(unresolvedFontFinding);
assert.match(unresolvedFontFinding.message, /nicht aufgel\u00f6st/);
assert.ok(unresolvedFontFinding.handles.includes('11'));
const nonArialFont = validateDrawing(normalizeDrawing({
  ...database,
  tables: { ...database.tables, STYLE: {
    entries: [{ name: 'standard', fontName: 'Helvetica.ttf' }],
  } },
})).errors.find((error) => error.ruleCode === 'TEXT_002');
assert.ok(nonArialFont);
assert.match(nonArialFont.message, /Helvetica\.ttf/);
const planLayoutFontExempt = validateDrawing(normalizeDrawing({
  ...database,
  entities: [...database.entities, {
    type: 'TEXT', layer: 'V_PLANLAYOUT', handle: 'layout-text', text: 'Titel',
    startPoint: { x: 0, y: 0 }, styleName: 'MISSING',
  }],
})).errors.filter((error) => error.ruleCode === 'TEXT_002');
assert.equal(planLayoutFontExempt.length, 0);

const variableWidthDrawing = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [{
    type: 'LWPOLYLINE', layer: 'A_ARCHITEKTUR', handle: 'variable-width',
    vertices: [
      { x: 0, y: 0, startWidth: 0, endWidth: 2.5 },
      { x: 10, y: 0, startWidth: 1.25, endWidth: 0 },
    ],
  }],
  tables: { LAYER: { entries: [{ name: 'A_ARCHITEKTUR', colorIndex: 7 }] } },
});
assert.equal(variableWidthDrawing.renderList[0].width, 2.5);
const variableWidthFinding = validateDrawing(variableWidthDrawing).errors.find(
  (error) => error.ruleCode === 'STYLE_001',
);
assert.ok(variableWidthFinding);
assert.deepEqual(variableWidthFinding.handles, ['variable-width']);

const duplicateGeometry = validateDrawing(normalizeDrawing({
  ...database,
  entities: [
    ...database.entities,
    { type: 'LWPOLYLINE', layer: 'R_RAUMPOLYGON', handle: 'ROOM-ROTATED', flag: 1,
      vertices: [square[2], square[3], square[0], square[1]] },
    { type: 'LWPOLYLINE', layer: 'R_GESCHOSSPOLYGON', handle: 'FLOOR-REVERSED', flag: 1,
      vertices: [...database.entities[2].vertices].reverse() },
  ],
}));
assert.ok(duplicateGeometry.errors.some((error) => error.ruleCode === 'POLY_005'
  && error.handle === 'ROOM-ROTATED'));
assert.ok(duplicateGeometry.errors.some((error) => error.ruleCode === 'GPOLY_005'
  && error.handle === 'FLOOR-REVERSED'));

const frameContainment = validateDrawing(normalizeDrawing({
  header: { $INSUNITS: 4, version: 'AC1032' },
  entities: [
    { type: 'LWPOLYLINE', layer: 'V_PLANLAYOUT', handle: 'DIAMOND', flag: 1, vertices: [
      { x: 0, y: 5_000 }, { x: 5_000, y: 10_000 }, { x: 10_000, y: 5_000 }, { x: 5_000, y: 0 },
    ] },
    { type: 'LINE', layer: 'A_ARCHITEKTUR', handle: 'CROSSES-FRAME',
      startPoint: { x: 5_000, y: 5_000 }, endPoint: { x: 9_000, y: 9_000 } },
  ],
  tables: {
    LAYER: { entries: [
      { name: 'V_PLANLAYOUT', colorIndex: 7 }, { name: 'A_ARCHITEKTUR', colorIndex: 7 },
    ] },
    STYLE: { entries: [] }, LAYOUT: { entries: [{ name: 'Model' }] }, BLOCK_RECORD: { entries: [] },
  },
}));
assert.ok(frameContainment.errors.some((error) => error.ruleCode === 'GEOM_005'),
  'an entity that exits a rotated frame must fail GEOM_005');

const reservedLayerLines = validateDrawing(normalizeDrawing({
  header: { $INSUNITS: 4, version: 'AC1032' },
  entities: [
    { type: 'LINE', layer: 'R_RAUMPOLYGON', handle: 'room-line',
      startPoint: { x: 0, y: 0 }, endPoint: { x: 100, y: 100 } },
    { type: 'LINE', layer: 'R_GESCHOSSPOLYGON', handle: 'floor-line',
      startPoint: { x: 0, y: 0 }, endPoint: { x: 100, y: 100 } },
  ],
  tables: {
    LAYER: { entries: [
      { name: 'R_RAUMPOLYGON', colorIndex: 7 },
      { name: 'R_GESCHOSSPOLYGON', colorIndex: 7 },
    ] },
    BLOCK_RECORD: { entries: [] },
  },
}));
assert.ok(reservedLayerLines.errors.some((error) => (
  error.ruleCode === 'POLY_006' && error.handle === 'room-line'
)));
assert.ok(reservedLayerLines.errors.some((error) => (
  error.ruleCode === 'GPOLY_003' && error.handle === 'floor-line'
)));

const unsupportedReservedDrawing = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [
    { type: 'REGION', layer: 'R_RAUMPOLYGON', handle: 'room-region' },
    { type: 'REGION', layer: 'R_GESCHOSSPOLYGON', handle: 'floor-region' },
    { type: 'OLE2FRAME', layer: 'A_ARCHITEKTUR', handle: 'embedded-ole' },
  ],
  tables: { LAYER: { entries: [
    { name: 'R_RAUMPOLYGON', colorIndex: 7 },
    { name: 'R_GESCHOSSPOLYGON', colorIndex: 7 },
    { name: 'A_ARCHITEKTUR', colorIndex: 7 },
  ] } },
});
assert.deepEqual(unsupportedReservedDrawing.validationMetadata, [
  { t: 'unsupported', l: 'R_RAUMPOLYGON', et: 'REGION', handle: 'room-region' },
  { t: 'unsupported', l: 'R_GESCHOSSPOLYGON', et: 'REGION', handle: 'floor-region' },
  { t: 'unsupported', l: 'A_ARCHITEKTUR', et: 'OLE2FRAME', handle: 'embedded-ole' },
]);
const unsupportedReservedValidation = validateDrawing(unsupportedReservedDrawing);
assert.ok(unsupportedReservedValidation.errors.some((error) => (
  error.ruleCode === 'POLY_006' && error.handle === 'room-region'
)));
assert.ok(unsupportedReservedValidation.errors.some((error) => (
  error.ruleCode === 'GPOLY_003' && error.handle === 'floor-region'
)));
assert.ok(unsupportedReservedValidation.errors.some((error) => error.ruleCode === 'GEOM_003'
  && /OLE2FRAME/.test(error.message)));
assert.equal(unsupportedReservedDrawing.completeness.status, 'incomplete');
assert.equal(unsupportedReservedDrawing.completeness.reasons.find(
  (reason) => reason.code === 'UNSUPPORTED_ENTITY',
)?.count, 3);
assert.ok(Number.isInteger(unsupportedReservedValidation.score), 'partial normalization still yields a score');
assert.equal(unsupportedReservedValidation.completeness.complete, false);
// The rules that could be evaluated are evaluated; the gap is a finding of its
// own rather than a blanket «nothing was checked».
assert.ok(unsupportedReservedValidation.passedRules > 0);
assert.ok(unsupportedReservedValidation.rules.some((rule) => rule.status === 'passed'));
assert.ok(unsupportedReservedValidation.errors.some((error) => (
  error.ruleCode === 'INCOMPLETE_001' && error.severity === 'warning'
)));

const converterUnknownDrawing = normalizeDrawing(database, { unknownEntityCount: 3 });
const converterUnknownValidation = validateDrawing(converterUnknownDrawing);
assert.equal(converterUnknownDrawing.diagnostics.converterUnknownEntityCount, 3);
assert.equal(converterUnknownDrawing.completeness.reasons.find(
  (reason) => reason.code === 'CONVERTER_UNKNOWN_ENTITY',
)?.count, 3);
assert.ok(Number.isInteger(converterUnknownValidation.score), 'partial normalization still yields a score');
assert.equal(converterUnknownValidation.completeness.status, 'incomplete');
assert.ok(converterUnknownValidation.rules.some((rule) => rule.status === 'passed'));

const malformedReservedDrawing = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [
    { type: 'LWPOLYLINE', layer: 'R_RAUMPOLYGON', handle: 'room-one-vertex', flag: 1,
      vertices: [{ x: 0, y: 0 }] },
    { type: 'LWPOLYLINE', layer: 'R_GESCHOSSPOLYGON', handle: 'floor-one-vertex', flag: 1,
      vertices: [{ x: 0, y: 0 }] },
  ],
  tables: { LAYER: { entries: [
    { name: 'R_RAUMPOLYGON', colorIndex: 7 },
    { name: 'R_GESCHOSSPOLYGON', colorIndex: 7 },
  ] } },
});
assert.ok(malformedReservedDrawing.validationMetadata.every((item) => item.validationOnly));
const malformedReservedValidation = validateDrawing(malformedReservedDrawing);
assert.ok(malformedReservedValidation.errors.some((error) => (
  error.ruleCode === 'POLY_003' && error.handle === 'room-one-vertex'
)));
assert.ok(malformedReservedValidation.errors.some((error) => error.ruleCode === 'GPOLY_004'));

const recognizedNonrenderableDrawing = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [
    { type: 'POLYLINE2D', layer: 'R_RAUMPOLYGON', handle: 'empty-polyline2d', vertices: [] },
    { type: 'ELLIPSE', layer: 'A_ARCHITEKTUR', handle: 'malformed-ellipse' },
  ],
  tables: { LAYER: { entries: [
    { name: 'R_RAUMPOLYGON', colorIndex: 7 },
    { name: 'A_ARCHITEKTUR', colorIndex: 7 },
  ] } },
});
assert.deepEqual(recognizedNonrenderableDrawing.validationMetadata, [
  { t: 'unsupported', l: 'R_RAUMPOLYGON', et: 'POLYLINE2D', handle: 'empty-polyline2d' },
  { t: 'unsupported', l: 'A_ARCHITEKTUR', et: 'ELLIPSE', handle: 'malformed-ellipse' },
]);
const recognizedNonrenderableValidation = validateDrawing(recognizedNonrenderableDrawing);
assert.ok(recognizedNonrenderableValidation.errors.some((error) => (
  error.ruleCode === 'POLY_006' && error.handle === 'empty-polyline2d'
)));
assert.ok(recognizedNonrenderableValidation.errors.some((error) => (
  error.ruleCode === 'GEOM_003' && /ELLIPSE/.test(error.message)
)));
assert.equal(recognizedNonrenderableDrawing.completeness.status, 'incomplete');

const malformedOrdinaryDrawing = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [{
    type: 'LINE', layer: 'A_ARCHITEKTUR', handle: 'malformed-line',
    startPoint: { x: 0, y: 0 },
  }],
  tables: { LAYER: { entries: [{ name: 'A_ARCHITEKTUR', colorIndex: 7 }] } },
});
assert.equal(malformedOrdinaryDrawing.renderList.length, 0);
assert.equal(malformedOrdinaryDrawing.diagnostics.skippedNonRenderableEntities, 1);
assert.equal(malformedOrdinaryDrawing.completeness.reasons.find(
  (reason) => reason.code === 'NON_RENDERABLE_ENTITY',
)?.count, 1);
const malformedOrdinaryValidation = validateDrawing(malformedOrdinaryDrawing);
assert.ok(Number.isInteger(malformedOrdinaryValidation.score), 'partial normalization still yields a score');
assert.ok(malformedOrdinaryValidation.rules.some((rule) => rule.status === 'passed'));

const invalidGeometryDrawing = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [
    { type: 'LINE', layer: 'A_ARCHITEKTUR', handle: 'nan-coordinate',
      startPoint: { x: Number.NaN, y: 0 }, endPoint: { x: 10, y: 10 } },
    { type: 'LINE', layer: 'A_ARCHITEKTUR', handle: 'out-of-range-coordinate',
      startPoint: { x: LIMITS.coordinateMagnitude + 1, y: 0 }, endPoint: { x: 10, y: 10 } },
    { type: 'CIRCLE', layer: 'A_ARCHITEKTUR', handle: 'infinite-radius',
      center: { x: 50, y: 50 }, radius: Number.POSITIVE_INFINITY },
  ],
  tables: { LAYER: { entries: [{ name: 'A_ARCHITEKTUR', colorIndex: 7 }] } },
});
assert.equal(invalidGeometryDrawing.renderList.length, 0,
  'invalid geometry must not be coerced into visible primitives at coordinate 0');
assert.equal(invalidGeometryDrawing.diagnostics.invalidCoordinateEntities, 3);
assert.equal(invalidGeometryDrawing.completeness.reasons.find(
  (reason) => reason.code === 'INVALID_GEOMETRY_VALUE',
)?.count, 3);
const invalidGeometryValidation = validateDrawing(invalidGeometryDrawing);
assert.ok(Number.isInteger(invalidGeometryValidation.score), 'partial normalization still yields a score');
assert.ok(invalidGeometryValidation.rules.some((rule) => rule.status === 'passed'));

const invisibleReservedDrawing = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [{
    type: 'LWPOLYLINE', layer: 'R_RAUMPOLYGON', handle: 'invisible-room',
    isVisible: false, flag: 1, vertices: square,
  }],
  tables: { LAYER: { entries: [{ name: 'R_RAUMPOLYGON', colorIndex: 7 }] } },
});
assert.equal(invisibleReservedDrawing.renderList.length, 0);
assert.equal(invisibleReservedDrawing.diagnostics.skippedInvisibleEntities, 1);
assert.equal(invisibleReservedDrawing.completeness.reasons.find(
  (reason) => reason.code === 'INVISIBLE_ENTITY_NOT_VALIDATED',
)?.count, 1);
assert.ok(validateDrawing(invisibleReservedDrawing).rules.some((rule) => rule.status === 'passed'));

const laterVertexZ = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [{ type: 'LWPOLYLINE', layer: 'A_ARCHITEKTUR', handle: 'later-z', vertices: [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 7 },
    { x: 1, y: 1, z: 9 },
  ] }],
  tables: { LAYER: { entries: [{ name: 'A_ARCHITEKTUR', colorIndex: 7 }] } },
});
assert.equal(laterVertexZ.diagnostics.nonZeroZEntityCount, 1);
assert.deepEqual(laterVertexZ.nonZeroZEntities, [
  { handle: 'later-z', layer: 'A_ARCHITEKTUR', type: 'LWPOLYLINE', z: 7 },
]);

const polygonTypeMismatch = validateDrawing({
  ...drawing,
  renderList: drawing.renderList.map((item) => (
    item.handle === '10' ? { ...item, et: 'POLYLINE' } : item
  )),
});
assert.ok(polygonTypeMismatch.errors.some((error) => (
  error.ruleCode === 'POLY_006' && error.handle === '10'
)));
assert.equal(polygonTypeMismatch.rooms[0].status, 'error');

const reportResult = {
  file: { name: '=unsafe plan.dwg', size: 6 },
  elapsedMs: 125,
  database: { version: 'AC1032', layerCount: 7, entityCount: 6, unknownEntityCount: 0 },
  layers: drawing.layerInfo,
  validation: {
    ...validation,
    errors: [...validation.errors, {
      id: 'formula-probe', severity: 'warning', ruleCode: 'TEXT_001', category: 'TEXT',
      message: '+SUM(1,1)', layer: 'V_TEXT', handles: ['B', 'C'],
    }],
  },
  checkContext: {
    building: { id: '1080/6650/AA', name: 'Verwaltungsgebäude' },
    floor: { id: '1080-6650-AA-2og', label: '2. OG' },
    change: { type: 'mutation', reason: '=CMD()', effectiveDate: '2026-08-08', reference: '@ref' },
  },
};
const reportCsv = buildPlanCheckCsv(reportResult);
assert.match(reportCsv, /'=CMD\(\)/);
assert.match(reportCsv, /'\+SUM\(1,1\)/);
assert.match(reportCsv, /'@ref/);
const reportJson = JSON.parse(buildPlanCheckJson(reportResult));
assert.equal(reportJson.schema, 'bbl-plan-check/1');
assert.equal(reportJson.context.change.reason, '=CMD()');
assert.equal(reportJson.validation.rules.length, 40);
assert.equal(reportJson.validation.rules[0].description, 'Pflicht-Layer fehlt: R_RAUMPOLYGON');
assert.deepEqual(reportJson.validation.errors.at(-1).handles, ['B', 'C']);
assert.equal(reportJson.validation.errors.at(-1).layer, 'V_TEXT');
const oversizedReason = 'R'.repeat(LIMITS.changeReasonLength + 25);
const boundedReasonResult = {
  ...reportResult,
  checkContext: {
    ...reportResult.checkContext,
    change: { ...reportResult.checkContext.change, reason: oversizedReason },
  },
};
const boundedReasonJson = JSON.parse(buildPlanCheckJson(boundedReasonResult));
assert.equal(boundedReasonJson.context.change.reason.length, LIMITS.changeReasonLength);
const boundedReasonCsv = buildPlanCheckCsv(boundedReasonResult);
assert.ok(boundedReasonCsv.includes('R'.repeat(LIMITS.changeReasonLength)));
assert.equal(boundedReasonCsv.includes(oversizedReason), false);
assert.equal(planCheckReportFilename(reportResult, 'csv'), 'unsafe-plan-pruefergebnis.csv');
assert.throws(() => planCheckReportFilename(reportResult, 'pdf'), /Unsupported plan-check report format/);
assert.throws(() => planCheckReportFilename(reportResult, 'geojson'), /Unsupported plan-check report format/);

const patternedHatch = normalizeDrawing({
  ...database,
  entities: [...database.entities, {
    type: 'HATCH', layer: 'A_SCHRAFFUR', handle: '16', patternName: 'ANSI31',
    style: 1, boundaryPaths: [],
  }],
});
assert.equal(patternedHatch.hatchInfo[0].patternName, 'ANSI31');
assert.equal(patternedHatch.hatchInfo[0].solid, false,
  'HATCH island style 1 must not be interpreted as a solid fill');
assert.ok(validateDrawing(patternedHatch).errors.some((error) => error.ruleCode === 'HATCH_001'));
const missingPatternHatch = normalizeDrawing({
  ...database,
  entities: [...database.entities, {
    type: 'HATCH', layer: 'A_SCHRAFFUR', handle: 'missing-pattern',
    isSolidFill: true, boundaryPaths: [],
  }],
});
const missingPatternFinding = validateDrawing(missingPatternHatch).errors.find(
  (error) => error.ruleCode === 'HATCH_001',
);
assert.ok(missingPatternFinding);
assert.match(missingPatternFinding.message, /nicht angegeben/);
const solidHatch = normalizeDrawing({
  ...database,
  entities: [...database.entities, {
    type: 'HATCH', layer: 'A_SCHRAFFUR', handle: 'solid-pattern',
    patternName: 'solid', boundaryPaths: [],
  }],
});
assert.equal(solidHatch.hatchInfo[0].solid, true);
assert.equal(validateDrawing(solidHatch).errors.some((error) => error.ruleCode === 'HATCH_001'), false);

const metadataLimitedDrawing = normalizeDrawing({
  ...database,
  entities: [
    ...database.entities,
    ...Array.from({ length: LIMITS.reportedItems + 1 }, (_, index) => ({
      type: 'HATCH', layer: 'A_SCHRAFFUR', handle: 'many-hatch-' + index,
      patternName: 'SOLID', boundaryPaths: [],
    })),
    ...Array.from({ length: LIMITS.reportedItems }, (_, index) => ({
      type: 'DIMENSION', layer: 'V_BEMASSUNG', handle: 'many-dimension-' + index,
    })),
  ],
  tables: {
    ...database.tables,
    STYLE: { entries: [
      { name: 'STANDARD', fontName: 'Arial.ttf' },
      ...Array.from({ length: LIMITS.metadataEntries }, (_, index) => ({
        name: 'STYLE-' + index, fontName: 'Arial.ttf',
      })),
    ] },
    LAYOUT: { entries: Array.from({ length: LIMITS.metadataEntries + 1 }, () => ({ name: 'Model' })) },
  },
});
assert.equal(metadataLimitedDrawing.diagnostics.truncatedStyleMetadata, 1);
assert.equal(metadataLimitedDrawing.diagnostics.truncatedLayoutMetadata, 1);
assert.equal(metadataLimitedDrawing.diagnostics.truncatedHatchDiagnostics, 1);
assert.equal(metadataLimitedDrawing.diagnostics.truncatedDimensionDiagnostics, 1);
for (const code of [
  'STYLE_METADATA_OUTPUT_LIMIT',
  'LAYOUT_METADATA_OUTPUT_LIMIT',
  'HATCH_DIAGNOSTIC_OUTPUT_LIMIT',
  'DIMENSION_DIAGNOSTIC_OUTPUT_LIMIT',
]) {
  assert.ok(metadataLimitedDrawing.completeness.reasons.some((reason) => reason.code === code), code);
}
const metadataLimitedValidation = validateDrawing(metadataLimitedDrawing);
assert.ok(Number.isInteger(metadataLimitedValidation.score), 'partial normalization still yields a score');
assert.ok(metadataLimitedValidation.rules.some((rule) => rule.status === 'passed'));

const manyXrefs = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [],
  tables: {
    LAYER: { entries: [{ name: '0', colorIndex: 7 }] },
    BLOCK_RECORD: { entries: Array.from({ length: LIMITS.reportedItems + 1 }, (_, index) => ({
      name: 'XREF-' + index, entities: [], flags: 4, xrefPath: 'xref-' + index + '.dwg',
    })) },
  },
});
assert.equal(manyXrefs.diagnostics.xrefReferenceCount, LIMITS.reportedItems + 1);
assert.equal(manyXrefs.xrefBlocks.length, LIMITS.reportedItems);
assert.equal(manyXrefs.completeness.status, 'complete',
  'the sticky aggregate preserves the XREF rule fact beyond the sample limit');
const manyXrefFindings = validateDrawing(manyXrefs).errors.filter(
  (error) => error.ruleCode === 'GEOM_004',
);
assert.equal(manyXrefFindings.length, 1);
assert.match(manyXrefFindings[0].message, new RegExp(String(LIMITS.reportedItems + 1)));

const invalidUnits = normalizeDrawing({ ...database, header: { $INSUNITS: 6 } });
const aborted = validateDrawing(invalidUnits);
assert.equal(aborted.aborted, true);
assert.equal(aborted.errors[0].ruleCode, 'ABORT_002');
// A drawing in the wrong unit is a genuine abort: no rule can be evaluated
// against measurements that would be wrong by a factor of a thousand.
assert.equal(aborted.score, 0);
assert.ok(aborted.rules.every((rule) => rule.status === 'not-evaluated' && rule.passed === null));

const unknownUnits = validateDrawing(normalizeDrawing({ ...database, header: {} }));
assert.equal(unknownUnits.aborted, false);
assert.ok(unknownUnits.errors.some((error) => error.ruleCode === 'GEOM_001'));
assert.equal(unknownUnits.metrics.unitStatus, 'unknown');
assert.equal(unknownUnits.metrics.evaluatedRules, 37);
assert.equal(unknownUnits.rooms.length, 1);
assert.equal(unknownUnits.rooms[0].area, null);
assert.equal(unknownUnits.areas[0].area, null);
assert.equal(unknownUnits.metrics.ngf, null);
assert.equal(unknownUnits.rules.find((rule) => rule.code === 'POLY_004').status, 'not-evaluated');
assert.equal(unknownUnits.rules.find((rule) => rule.code === 'LAYER_001').status, 'passed');
const unknownUnitsCsv = buildPlanCheckCsv({
  file: { name: 'unknown-units.dwg', size: 6 },
  database: { version: 'AC1032' },
  layers: drawing.layerInfo,
  validation: unknownUnits,
});
assert.equal(unknownUnitsCsv.split(/\r?\n/).find((row) => row.startsWith('Raum;')).split(';').at(-1), '');
assert.equal(unknownUnitsCsv.split(/\r?\n/).find((row) => row.startsWith('Fläche;')).split(';').at(-1), '');

const unknownUnitsJson = JSON.parse(buildPlanCheckJson({
  file: { name: 'unknown-units.dwg', size: 6 },
  database: { version: 'AC1032' },
  layers: drawing.layerInfo,
  validation: unknownUnits,
}));
assert.equal(unknownUnitsJson.validation.rooms[0].area, null);
assert.equal(unknownUnitsJson.validation.areas[0].area, null);
for (const key of ['hnf', 'nnf', 'vf', 'ff', 'nf', 'ngf', 'gf', 'kf']) {
  assert.equal(unknownUnitsJson.validation.metrics[key], null, `${key} must remain explicitly unavailable`);
}

const fakeComponents = {
  badge: (label, variant) => `<span data-badge="${variant}">${label}</span>`,
  empty: (label) => `<p>${label}</p>`,
  escape: (value) => String(value ?? ''),
  icon: () => '',
  notification: (message, variant) => `<div data-notification="${variant}">${message}</div>`,
  tabBar: () => '',
  wizardHead: () => '',
};
const uploadMarkup = renderPlanCheckPage(fakeComponents, {
  buildingId: '',
  changeReason: '',
  changeType: 'mutation',
  dragActive: false,
  effectiveDate: '',
  file: null,
  fileError: '',
  floorId: '',
  intakeAvailable: true,
  phase: 'idle',
  reference: '',
  step: 1,
});
assert.match(uploadMarkup, new RegExp('maxlength=\"' + LIMITS.changeReasonLength
  + '\" data-plan-check-change-reason'));
const abortedState = {
  filter: 'all',
  result: { validation: aborted },
  search: '',
  selection: null,
  hiddenLayers: new Set(),
  collapsedGroups: new Set(),
  tab: 'rules',
};
const abortedRulesMarkup = renderPlanCheckPanel(fakeComponents, abortedState, 'rules');
// Dense rows carry the outcome as a shaped status symbol plus a spelled-out
// accessible name, never as colour alone.
assert.match(abortedRulesMarkup, /plan-check-row__status--muted/);
assert.doesNotMatch(abortedRulesMarkup, /plan-check-row__status--success/);
assert.match(abortedRulesMarkup, /Pflicht-Layer fehlt: R_RAUMPOLYGON/);
assert.match(abortedRulesMarkup, /LAYER_001 \u00b7 Layerstruktur/);
assert.match(abortedRulesMarkup, /aria-label="LAYER_001 \u00b7 Layerstruktur \u00b7 Pflicht-Layer fehlt: R_RAUMPOLYGON \u00b7 Nicht gepr\u00fcft"/);
// Rules are grouped by outcome; an aborted run has no passed group at all.
assert.match(abortedRulesMarkup, /data-plan-check-group="not-evaluated"/);
assert.doesNotMatch(abortedRulesMarkup, /data-plan-check-group="passed"/);
const collapsedRulesMarkup = renderPlanCheckPanel(fakeComponents, {
  ...abortedState, collapsedGroups: new Set(['not-evaluated']),
}, 'rules');
assert.match(collapsedRulesMarkup, /data-plan-check-group="not-evaluated">/);
assert.doesNotMatch(collapsedRulesMarkup, /data-plan-check-group="not-evaluated" open/);
const descriptionSearchMarkup = renderPlanCheckPanel(fakeComponents, {
  ...abortedState,
  result: { validation: unknownUnits },
  search: 'Raumfl\u00e4che sehr klein',
}, 'rules');
assert.match(descriptionSearchMarkup, /1 Pr\u00fcfregeln angezeigt/);
assert.match(descriptionSearchMarkup, /Raumfl\u00e4che sehr klein/);
const abortedErrorsMarkup = renderPlanCheckPanel(fakeComponents, {
  ...abortedState,
  tab: 'errors',
}, 'errors');
assert.match(abortedErrorsMarkup, /plan-check-row__status--error/);
assert.match(abortedErrorsMarkup, /Abgebrochen"/);
const unavailableMetricsMarkup = renderPlanCheckPanel(fakeComponents, {
  ...abortedState,
  result: { validation: { metrics: { ngf: null, gf: null, kf: '' } }, drawing: { entitySummary: [] } },
  tab: 'metrics',
}, 'metrics');
// An unavailable area stays an em dash in both the value and the share column;
// a missing SIA classification must never read as a measured zero.
assert.match(unavailableMetricsMarkup, /Geschossfl\u00e4che<\/td>\s*<td class="plan-check-metric__value">\u2013<\/td>/);
assert.match(unavailableMetricsMarkup, /Konstruktionsfl\u00e4che<\/td>\s*<td class="plan-check-metric__value">\u2013<\/td>/);
assert.match(unavailableMetricsMarkup, /Ohne Raumpolygone lässt sich keine Flächenbilanz bilden/);
// With rooms present the register states the convention behind HNF and NGF.
assert.match(renderPlanCheckPanel(fakeComponents, {
  ...abortedState,
  result: {
    validation: { metrics: { gf: 100, ngf: 90, hnf: 90, categorySource: 'convention' }, rooms: [{ area: 90 }] },
    drawing: { entitySummary: [] },
  },
  tab: 'metrics',
}, 'metrics'), /konventionsgemäss als Hauptnutzfläche gezählt/);
assert.doesNotMatch(unavailableMetricsMarkup, /0\.0 m\u00b2/);
// The share column reports a real proportion only when a measured base exists.
const sharedMetricsMarkup = renderPlanCheckPanel(fakeComponents, {
  ...abortedState,
  result: {
    validation: { metrics: { gf: 1000, kf: 100, ngf: 900, roomPolygonArea: 850 }, rooms: [] },
    drawing: { entitySummary: [{ type: 'LWPOLYLINE', count: 12, layers: ['A_ARCHITEKTUR', 'R_AOID'] }] },
  },
  tab: 'metrics',
}, 'metrics');
assert.match(sharedMetricsMarkup, /Konstruktionsfl\u00e4che<\/td>\s*<td class="plan-check-metric__value">100 m\u00b2<\/td>\s*<td class="plan-check-metric__share">10 %<\/td>/);
assert.match(sharedMetricsMarkup, /NGF \/ GF<\/th>[\s\S]*?0\.9<\/td>/);
assert.match(sharedMetricsMarkup, /A_ARCHITEKTUR, R_AOID/);
// --- Attribute inspection ---------------------------------------------------
// The card next to the plan reports what the DWG carries for one element. Every
// value is read from the normalized primitive; nothing is derived beyond plain
// geometry, so an absent attribute stays absent.
const inspectionResult = {
  layers: [{ name: 'R_RAUMPOLYGON', colorHex: '#FF00FF', colorIndex: 6, count: 30 }],
  drawing: {
    insunits: 4,
    renderList: [
      { t: 'poly', l: 'R_RAUMPOLYGON', et: 'LWPOLYLINE', handle: 'A1', c: '#FF00FF', byLayer: true,
        closed: true, verts: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 6000 }, { x: 0, y: 6000 }] },
      { t: 'text', l: 'R_AOID', et: 'TEXT', handle: 'B2', c: '#00FF00', byLayer: false,
        x: 2500, y: 3000, text: '8082.MO.02.005', h: 250, rot: 0, fontName: 'ARIAL' },
      { t: 'line', l: 'A_ARCHITEKTUR', et: 'LINE', handle: 'C3', c: '#FFFFFF', byLayer: true,
        x1: 0, y1: 0, x2: 3000, y2: 4000 },
    ],
    dimensionInfo: [],
  },
  validation: {
    rules: [{ code: 'AOID_002', cat: 'AOID', sev: 'error', description: 'AOID ist nicht eindeutig',
      status: 'failed', passed: false, errorCount: 1 }],
    errors: [{ id: 1, severity: 'error', ruleCode: 'AOID_002', category: 'AOID',
      message: 'AOID 8082.MO.02.005 ist nicht eindeutig.', handle: 'A1', roomId: 1, layer: 'R_AOID' }],
    rooms: [{ id: 1, aoid: '8082.MO.02.005', area: 30, layer: 'R_RAUMPOLYGON', handle: 'A1', et: 'LWPOLYLINE',
      status: 'error', centroid: { x: 2500, y: 3000 },
      vertices: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 6000 }, { x: 0, y: 6000 }] }],
    areas: [],
    metrics: {},
  },
};
// ICU emits either apostrophe for the de-CH group separator depending on the
// runtime, so figures are compared without it.
const plainDigits = (value) => String(value ?? '').replace(/[’']/g, '');
const factValue = (details, label) => plainDigits(details.rows.find((row) => row.label === label)?.value);

const polygonDetails = planCheckSelectionDetails({ type: 'entity', id: 'A1' }, inspectionResult);
assert.equal(polygonDetails.kind, 'entity');
assert.equal(polygonDetails.subtitle, 'LWPOLYLINE');
assert.equal(factValue(polygonDetails, 'Layer'), 'R_RAUMPOLYGON');
assert.equal(factValue(polygonDetails, 'Farbe'), '#FF00FF · VONLAYER');
assert.equal(factValue(polygonDetails, 'Stützpunkte'), '4');
assert.equal(factValue(polygonDetails, 'Verlauf'), 'Geschlossen');
assert.equal(factValue(polygonDetails, 'Fläche'), '30 m²');
assert.equal(factValue(polygonDetails, 'Länge'), '22000 mm · 22 m');
assert.deepEqual(polygonDetails.findings.map((finding) => finding.ruleCode), ['AOID_002']);

const textDetails = planCheckSelectionDetails({ type: 'entity', id: 'B2' }, inspectionResult);
assert.equal(factValue(textDetails, 'Text'), '8082.MO.02.005');
assert.equal(factValue(textDetails, 'Schrifthöhe'), '250 mm');
assert.equal(factValue(textDetails, 'Schriftart'), 'ARIAL');
// An entity that overrides its layer colour must say so; that is exactly what
// rule STYLE_002 is about.
assert.equal(factValue(textDetails, 'Farbe'), '#00FF00 · direkt');
assert.deepEqual(textDetails.findings, []);

const lineDetails = planCheckSelectionDetails({ type: 'entity', id: 'C3' }, inspectionResult);
assert.equal(factValue(lineDetails, 'Länge'), '5000 mm · 5 m');
assert.equal(factValue(lineDetails, 'Von'), 'X 0 · Y 0');

const roomDetails = planCheckSelectionDetails({ type: 'room', id: '1' }, inspectionResult);
assert.equal(roomDetails.status, 'error');
assert.equal(factValue(roomDetails, 'AOID'), '8082.MO.02.005');
assert.equal(factValue(roomDetails, 'Fläche'), '30 m²');
assert.equal(factValue(roomDetails, 'Umfang'), '22000 mm · 22 m');
assert.equal(factValue(roomDetails, 'Rolle'), 'Raumpolygon (R_RAUMPOLYGON)');
assert.equal(roomDetails.findings.length, 1);

const layerDetails = planCheckSelectionDetails({ type: 'layer', id: 'R_RAUMPOLYGON' }, inspectionResult);
assert.equal(factValue(layerDetails, 'Darstellungselemente'), '30');
assert.equal(factValue(layerDetails, 'ACI-Index'), '6');

const ruleDetails = planCheckSelectionDetails({ type: 'rule', id: 'AOID_002' }, inspectionResult);
assert.equal(ruleDetails.status, 'error');
assert.equal(factValue(ruleDetails, 'Schweregrad'), 'Fehler');
assert.equal(factValue(ruleDetails, 'Feststellungen'), '1');

// A selection the drawing does not contain yields no card at all rather than an
// empty frame that suggests an attribute-free object.
assert.equal(planCheckSelectionDetails({ type: 'entity', id: 'UNKNOWN' }, inspectionResult), null);
assert.equal(planCheckSelectionDetails(null, inspectionResult), null);
assert.equal(renderPlanCheckInspector(fakeComponents, null), '');

const inspectorMarkup = renderPlanCheckInspector(fakeComponents, { ...roomDetails, truncated: false });
assert.match(inspectorMarkup, /8082\.MO\.02\.005/);
assert.match(inspectorMarkup, /data-plan-check-action="clear-selection"/);
assert.match(inspectorMarkup, /1 Feststellung</);
// Empty facts are dropped instead of rendered as a blank definition row.
assert.doesNotMatch(inspectorMarkup, /<dd[^>]*><\/dd>/);

assert.deepEqual(planCheckSelectionSummary({ type: 'room', id: '1' }, inspectionResult), {
  title: '8082.MO.02.005', subtitle: 'Raumpolygon · 30 m²', status: 'error',
});
assert.match(renderPlanCheckLegend(fakeComponents, {
  tab: 'rooms', selection: null, hiddenLayers: new Set(),
}), /ohne Befund[\s\S]*mit Warnung[\s\S]*mit Fehler/);
assert.match(renderPlanCheckLegend(fakeComponents, {
  tab: 'layers', selection: null, hiddenLayers: new Set(['V_BEMASSUNG']),
}), /1 Layer ausgeblendet/);

assert.equal(planCheckNetArea({ ngf: null }, [{ area: 12.5 }]), null);
assert.equal(planCheckNetArea({ roomPolygonArea: 20, ngf: null }, [{ area: 12.5 }]), 20);
assert.equal(planCheckNetArea({}, [{ area: null }, { area: 12.5 }]), 12.5);
assert.equal(planCheckNetArea({}, [{ area: null }, { area: '' }]), null);

const abortedReportResult = {
  file: { name: 'unknown-units.dwg', size: 6 },
  database: { version: 'AC1032', layerCount: 7, entityCount: 6, unknownEntityCount: 0 },
  layers: invalidUnits.layerInfo,
  validation: aborted,
};
const abortedReportCsv = buildPlanCheckCsv(abortedReportResult);
assert.match(abortedReportCsv, /Pr\u00fcfregel;LAYER_001;nicht gepr\u00fcft/);
const abortedReportJson = JSON.parse(buildPlanCheckJson(abortedReportResult));
assert.equal(abortedReportJson.validation.aborted, true);
assert.equal(abortedReportJson.validation.rules[0].status, 'not-evaluated');
assert.equal('passed' in abortedReportJson.validation.rules[0], false);
assert.equal(abortedReportJson.validation.metrics.ngf, null);

const cyclic = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [{ type: 'INSERT', layer: '0', name: 'LOOP', insertionPoint: { x: 0, y: 0 } }],
  tables: {
    LAYER: { entries: [{ name: '0', colorIndex: 7 }] },
    BLOCK_RECORD: { entries: [{ name: 'LOOP', entities: [
      { type: 'INSERT', layer: '0', name: 'LOOP', insertionPoint: { x: 0, y: 0 } },
    ] }] },
  },
});
assert.equal(cyclic.diagnostics.skippedCyclicInserts, 1);
assert.ok(cyclic.diagnostics.expandedEntityCount <= LIMITS.blockExpansionDepth + 1);
const cyclicValidation = validateDrawing(cyclic);
assert.equal(cyclic.completeness.status, 'incomplete');
assert.equal(cyclic.completeness.reasons[0].code, 'CYCLIC_BLOCK_REFERENCE');
assert.ok(Number.isInteger(cyclicValidation.score), 'partial normalization still yields a score');
assert.equal(cyclicValidation.completeness.complete, false);
assert.ok(cyclicValidation.passedRules > 0);
assert.ok(cyclicValidation.rules.some((rule) => rule.status === 'passed'));

const depthBlocks = Array.from({ length: LIMITS.blockExpansionDepth + 2 }, (_, index) => ({
  name: 'DEPTH-' + index,
  entities: index === LIMITS.blockExpansionDepth + 1
    ? [{ type: 'LINE', layer: '0', handle: 'depth-leaf',
      startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } }]
    : [{ type: 'INSERT', layer: '0', name: 'DEPTH-' + (index + 1), insertionPoint: { x: 0, y: 0 } }],
}));
const depthLimited = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [{ type: 'INSERT', layer: '0', name: 'DEPTH-0', insertionPoint: { x: 0, y: 0 } }],
  tables: {
    LAYER: { entries: [{ name: '0', colorIndex: 7 }] },
    BLOCK_RECORD: { entries: depthBlocks },
  },
});
assert.equal(depthLimited.diagnostics.skippedDepthLimitedInserts, 1);
assert.equal(depthLimited.diagnostics.skippedCyclicInserts, 0);
assert.equal(depthLimited.completeness.reasons[0].code, 'BLOCK_EXPANSION_DEPTH_LIMIT');
assert.ok(Number.isInteger(validateDrawing(depthLimited).score));

const incompleteResult = {
  file: { name: 'incomplete.dwg', size: 6 },
  elapsedMs: 1,
  database: { version: 'AC1032', layerCount: 1, entityCount: 1, unknownEntityCount: 0 },
  drawing: cyclic,
  layers: cyclic.layerInfo,
  validation: cyclicValidation,
};
const incompleteJson = JSON.parse(buildPlanCheckJson(incompleteResult));
assert.ok(Number.isInteger(incompleteJson.validation.score));
assert.equal(incompleteJson.validation.completeness.status, 'incomplete');
assert.equal(incompleteJson.validation.completeness.reasons[0].code, 'CYCLIC_BLOCK_REFERENCE');
assert.match(buildPlanCheckCsv(incompleteResult), /Pr\u00fcfung;Vollst\u00e4ndigkeit;unvollst\u00e4ndig/);
// The CSV reports the score of a partially normalised run, with completeness
// stated on its own row rather than replacing the result.
assert.match(buildPlanCheckCsv(incompleteResult), /Pr\u00fcfung;Erf\u00fcllungsgrad;[0-9]+ %/);
const incompleteMarkup = renderPlanCheckPage(fakeComponents, {
  background: 'light',
  changeType: 'new',
  filter: 'all',
  hiddenLayers: new Set(),
  intakeAvailable: true,
  result: incompleteResult,
  search: '',
  selection: null,
  step: 2,
  tab: 'rules',
});
// An incomplete run still shows its score; the gap is named beside it.
assert.match(incompleteMarkup, /Teile der Zeichnung konnten nicht normalisiert werden/);
assert.match(incompleteMarkup, /INCOMPLETE_001/);
assert.doesNotMatch(incompleteMarkup, /Nicht ausgewertet \u00b7 Pr\u00fcfung unvollst\u00e4ndig/);
assert.match(incompleteMarkup, /plan-check-figure__value--score/);

const complexVertices = Array.from({ length: 5_000 }, (_, index) => {
  const angle = (index / 5_000) * Math.PI * 2;
  return { x: Math.cos(angle) * 10_000, y: Math.sin(angle) * 10_000 };
});
// The visual-centre search degrades to a cheap interior point above this many
// vertices; that fallback is a performance choice, not a refusal.
const HIGH_VERTEX_COUNT = 25_000;
const maximumVertexPolygon = Array.from({ length: HIGH_VERTEX_COUNT }, (_, index) => {
  const angle = (index / HIGH_VERTEX_COUNT) * Math.PI * 2;
  return { x: Math.cos(angle) * 10_000, y: Math.sin(angle) * 10_000 };
});
let visualCenterOperations = 0;
const visualCenterStartedAt = performance.now();
const maximumVertexCenter = visualCenter(maximumVertexPolygon, {
  consume: (amount) => { visualCenterOperations += amount; },
});
assert.ok(Math.abs(maximumVertexCenter.x) < 1 && Math.abs(maximumVertexCenter.y) < 1);
assert.ok(visualCenterOperations <= HIGH_VERTEX_COUNT * 2);
assert.ok(performance.now() - visualCenterStartedAt < 2_000, 'high-vertex visual center must use the bounded fallback');

// --- No size ceiling ------------------------------------------------------
// A large drawing is slower, never refused. These fixtures used to trip the
// former RESOURCE_LIMIT guards; every one of them must now normalise and
// validate to a real result.
const HEAVY_PRIMITIVES = 40_000;
const heavyDatabase = {
  header: { $INSUNITS: 4 },
  entities: Array.from({ length: HEAVY_PRIMITIVES }, (_, index) => ({
    type: 'LINE', layer: 'A_ARCHITEKTUR', handle: `heavy-${index}`,
    startPoint: { x: index, y: 0 }, endPoint: { x: index, y: 1 },
  })),
  tables: { LAYER: { entries: [{ name: 'A_ARCHITEKTUR', colorIndex: 7 }] } },
};
const heavyStartedAt = performance.now();
const heavyDrawing = normalizeDrawing(heavyDatabase);
assert.equal(heavyDrawing.renderList.length, HEAVY_PRIMITIVES);
assert.ok(performance.now() - heavyStartedAt < 20_000, 'large normalization must still complete');
assert.ok(Number.isInteger(validateDrawing(heavyDrawing).score));

// The same volume delivered through a block reference must also expand.
const heavyBlockDrawing = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [{ type: 'INSERT', layer: 'A_ARCHITEKTUR', name: 'HEAVY', insertionPoint: { x: 0, y: 0 } }],
  tables: {
    LAYER: { entries: [{ name: 'A_ARCHITEKTUR', colorIndex: 7 }] },
    BLOCK_RECORD: { entries: [{ name: 'HEAVY', entities: heavyDatabase.entities }] },
  },
});
assert.equal(heavyBlockDrawing.renderList.length, HEAVY_PRIMITIVES);

// A single polygon with 5'000 vertices exercises the quadratic self-intersection
// test, which formerly threw once it passed a comparison budget.
const complexDrawing = normalizeDrawing({
  header: { $INSUNITS: 4 },
  entities: [{ type: 'LWPOLYLINE', layer: 'R_RAUMPOLYGON', handle: 'heavy', flag: 1, vertices: complexVertices }],
  tables: { LAYER: { entries: [{ name: 'R_RAUMPOLYGON', colorIndex: 7 }] } },
});
const complexValidation = validateDrawing(complexDrawing);
assert.ok(Number.isInteger(complexValidation.score));
assert.equal(complexValidation.rooms.length, 1);
// Every former ceiling now reads as unlimited, so no code path can refuse a size.
for (const key of ['entities', 'layers', 'blockRecords', 'expandedEntities', 'renderPrimitives',
  'verticesPerPrimitive', 'totalVertices', 'validationErrors', 'validationOperations',
  'selfIntersectionComparisons', 'resultTransferBytes', 'resultNodes']) {
  assert.equal(LIMITS[key], Infinity, `${key} must no longer cap a drawing`);
}

// --- Report model -----------------------------------------------------------
// PDF and Excel render the same model, so every figure is asserted once here and
// both formats inherit it.
const pruefberichtResult = {
  file: { name: 'Grundriss 5.OG.dwg', size: 381_509 },
  elapsedMs: 318,
  database: { version: 'AC1032', layerCount: 17, entityCount: 3_504 },
  drawing: { entitySummary: [{ type: 'LWPOLYLINE', count: 3_230, layers: ['A_ARCHITEKTUR', 'R_AOID', 'V_TEXT', 'A_ELEKTRO'] }] },
  layers: [{ name: 'R_RAUMPOLYGON', count: 30, colorHex: '#FF00FF' }],
  checkContext: {
    building: { id: '1080/6650/AA', name: 'Verwaltungsgebäude' },
    floor: { id: '1080-6650-AA-2og', label: '2. Obergeschoss' },
    change: { type: 'mutation', reason: 'Umbau Ostflügel' },
  },
  validation: {
    score: 90, passedRules: 35, aborted: false,
    completeness: { status: 'incomplete', complete: false,
      reasons: [{ code: 'UNSUPPORTED_ENTITY', count: 2, message: 'Nicht unterstützte CAD-Objekte.' }] },
    rules: [
      { cat: 'TEXT', code: 'TEXT_001', sev: 'warning', description: 'Textelement auf unzulässigem Layer', status: 'failed', passed: false, errorCount: 3 },
      { cat: 'POLY', code: 'POLY_001', sev: 'error', description: 'Raumpolygon ist nicht geschlossen', status: 'failed', passed: false, errorCount: 1 },
      { cat: 'LAYER', code: 'LAYER_001', sev: 'error', description: 'Pflicht-Layer fehlt: R_RAUMPOLYGON', status: 'passed', passed: true, errorCount: 0 },
      { cat: 'AOID', code: 'AOID_006', sev: 'warning', description: 'Basispunkt ausserhalb', status: 'not-evaluated', passed: null, errorCount: 0 },
    ],
    errors: [
      { id: 1, severity: 'error', ruleCode: 'POLY_001', category: 'POLY', message: 'Raumpolygon ist nicht geschlossen.' },
      { id: 2, severity: 'warning', ruleCode: 'TEXT_001', category: 'TEXT', message: '3 Textelemente auf unzulässigem Layer.' },
    ],
    rooms: [{ id: 1, aoid: '8082.MO.02.005', area: 30, layer: 'R_RAUMPOLYGON', handle: 'A68', status: 'error', vertices: [{}, {}, {}, {}] }],
    areas: [{ id: 1000, aoid: 'R_GESCHOSSPOLYGON', area: 572.32, layer: 'R_GESCHOSSPOLYGON', handle: 'B12', status: 'ok' }],
    metrics: { gf: 572.32, kf: 55.2, ngf: 517.12, nf: 517.12, hnf: 517.12, nnf: 0, vf: 0, ff: 0,
      categorySource: 'convention', evaluatedRules: 3 },
  },
};
const pruefberichtModel = planCheckReportModel(pruefberichtResult, { generatedAt: new Date('2026-08-10T09:30:00Z') });
assert.equal(pruefberichtModel.summary.scoreLabel, '90 %');
assert.equal(pruefberichtModel.summary.passedRules, 1);
assert.equal(pruefberichtModel.summary.evaluatedRules, 3);
assert.equal(pruefberichtModel.summary.errorCount, 1);
assert.equal(pruefberichtModel.summary.warningCount, 1);
assert.equal(pruefberichtModel.summary.complete, false);
// Failed rules come first, errors before warnings, so the reader meets the
// worst finding on the first line of the chapter.
assert.deepEqual(pruefberichtModel.rules.failed.map((row) => row[1]), ['POLY_001', 'TEXT_001']);
assert.deepEqual(pruefberichtModel.rules.notEvaluated.map((row) => row[1]), ['AOID_006']);
assert.deepEqual(pruefberichtModel.rules.passed.map((row) => row[1]), ['LAYER_001']);
assert.deepEqual(pruefberichtModel.rules.failed[0].slice(0, 1), ['Fehler']);
// Area balance: measured GF, share against GF, and the derived ratios.
assert.deepEqual(pruefberichtModel.kpi.areas[0], ['GF', 'Geschossfläche', '572.3 m²', '100 %']);
assert.deepEqual(pruefberichtModel.kpi.areas.find((row) => row[0] === 'NNF').slice(2), ['0 m²', '0 %']);
assert.deepEqual(pruefberichtModel.kpi.economy[0], ['NGF / GF', 'Nettogeschossfläche / Geschossfläche', '0.9']);
// DIN 277 has no source in the DWG contract; every row stays an em dash.
assert.ok(pruefberichtModel.kpi.din277.every((row) => row[2] === '–' && row[3] === '–'));
assert.equal(pruefberichtModel.kpi.entities[0][0], 'LWPOLYLINE');
assert.match(pruefberichtModel.kpi.entities[0][1], /^3.230$/);
assert.equal(pruefberichtModel.kpi.entities[0][2], 'A_ARCHITEKTUR, R_AOID, V_TEXT …');
// Both the incompleteness and the classification convention are stated.
assert.ok(pruefberichtModel.notes.some((note) => /nicht normalisiert/.test(note)));
assert.ok(pruefberichtModel.notes.some((note) => /Hauptnutzfläche/.test(note)));
assert.ok(pruefberichtModel.notes.some((note) => /nicht an einen Server/.test(note)));
assert.deepEqual(pruefberichtModel.chapters.map((chapter) => chapter.key),
  ['rules', 'errors', 'layers', 'rooms', 'areas', 'kpi']);
assert.ok(pruefberichtModel.info.some(([label, value]) => label === 'Änderungsgrund' && value === 'Umbau Ostflügel'));
assert.ok(pruefberichtModel.info.some(([label, value]) => label === 'Geschoss' && value === '2. Obergeschoss'));

const excelSheets = planCheckExcelSheets(pruefberichtResult, { generatedAt: new Date('2026-08-10T09:30:00Z') });
assert.deepEqual(excelSheets.map((sheet) => sheet.name),
  ['Info', 'Prüfregeln', 'Fehlermeldungen', 'Layer', 'Räume', 'Flächen', 'Kennzahlen']);
assert.ok(excelSheets.every((sheet) => sheet.name.length <= 31));
assert.ok(excelSheets.every((sheet) => sheet.widths.length === sheet.rows[0].length));
// Sheet and PDF chapters carry the same rows.
const excelRules = excelSheets.find((sheet) => sheet.name === 'Prüfregeln');
assert.deepEqual(excelRules.rows.slice(1).map((row) => row[1]),
  ['POLY_001', 'TEXT_001', 'AOID_006', 'LAYER_001']);
assert.equal(planCheckPdfFilename(pruefberichtResult), 'Grundriss-5-OG-pruefbericht.pdf');
assert.equal(planCheckExcelFilename(pruefberichtResult), 'Grundriss-5-OG-pruefbericht.xlsx');

// An empty result still produces a complete, dash-filled model rather than
// throwing on the way to a report.
const emptyModel = planCheckReportModel({}, { generatedAt: new Date('2026-08-10T09:30:00Z') });
assert.equal(emptyModel.summary.rooms, 0);
assert.equal(emptyModel.rules.failed.length, 0);
assert.ok(emptyModel.kpi.areas.every((row) => row[2] === '–'));
assert.equal(planCheckExcelSheets({}).length, 7);

const header = new TextEncoder().encode('AC1032').buffer;
assert.equal(inspectDwgHeader(header), 'AC1032');
assert.throws(() => inspectDwgHeader(new TextEncoder().encode('NOTDWG').buffer),
  (error) => error instanceof PlanCheckParserError && error.code === 'INVALID_DWG_HEADER');
assert.equal(MAX_FILE_SIZE, 50 * 1024 * 1024);
assert.equal(LIBREDWG_VERSION, '0.7.9');
assert.equal(PARSER_TIMEOUT_MS, 120_000);
assert.equal(PLAN_CHECK_INTAKE_ENABLED, true);
const sharedBudgetNode = { value: 'shared' };
const sharedBudget = assertResultBudget({ first: sharedBudgetNode, second: sharedBudgetNode });
assert.ok(sharedBudget.nodes > 0 && sharedBudget.estimatedBytes > 0);
// Measurement only: a huge result is reported, not rejected.
assert.doesNotThrow(() => assertResultBudget(Array.from({ length: 200_000 }, (_, index) => ({ index }))));

class FakeWorker {
  static instances = [];
  constructor(url, options) {
    this.url = String(url);
    this.options = options;
    this.messages = [];
    this.terminated = false;
    FakeWorker.instances.push(this);
  }
  postMessage(message, transfer) { this.messages.push({ ...message, transfer }); }
  terminate() { this.terminated = true; }
  emit(data) { this.onmessage?.({ data }); }
}

const originalWorker = globalThis.Worker;
globalThis.Worker = FakeWorker;

async function waitForPostedWorker(previousCount) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate = FakeWorker.instances.at(-1);
    if (FakeWorker.instances.length > previousCount && candidate?.messages.length) return candidate;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.fail('DWG parser did not post to a Worker');
}

try {
  const makeBytes = (version = 'AC1032', suffix = '') =>
    new TextEncoder().encode(`${version}${suffix}`).buffer;
  const makeFile = (name = 'sample.dwg', version = 'AC1032', suffix = '') => {
    const buffer = makeBytes(version, suffix);
    return {
      name,
      size: buffer.byteLength,
      arrayBuffer: async () => buffer.slice(0),
    };
  };
  const makeResult = (name = 'sample.dwg', size = 6, version = 'AC1032') => ({
    file: { name, size }, elapsedMs: 0,
    database: { version, layerCount: 0, entityCount: 0, unknownEntityCount: 0 },
    drawing: { renderList: [], bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 } },
    layers: [], validation: { rules: [], errors: [], rooms: [], areas: [], metrics: {}, score: 100, passedRules: 40 },
  });

  const parser = createPlanCheckParser();
  assert.equal(typeof parser.parse, 'function');
  const progress = [];
  let previousWorkerCount = FakeWorker.instances.length;
  const firstFile = makeFile('first.dwg', 'AC1032', '-first');
  const first = parser.parse(firstFile, { onProgress: (entry) => progress.push(entry) });
  const firstWorker = await waitForPostedWorker(previousWorkerCount);
  assert.equal(firstWorker.options.type, 'module');
  assert.equal(firstWorker.options.name, 'plan-check-parser');
  assert.equal(firstWorker.messages[0].type, 'parse');
  assert.equal(firstWorker.messages[0].dwgVersion, 'AC1032');
  assert.equal(firstWorker.messages[0].file.name, 'first.dwg');
  assert.equal(firstWorker.messages[0].buffer.byteLength, firstFile.size);
  assert.deepEqual(firstWorker.messages[0].transfer, [firstWorker.messages[0].buffer]);
  previousWorkerCount = FakeWorker.instances.length;
  const secondFile = makeFile('newer.dwg', 'AC1027', '-second');
  const second = parser.parse(secondFile);
  await assert.rejects(first, (error) => error.name === 'AbortError');
  assert.equal(firstWorker.terminated, true);
  const secondWorker = await waitForPostedWorker(previousWorkerCount);
  assert.equal(secondWorker.messages[0].dwgVersion, 'AC1027');
  assert.equal(secondWorker.messages[0].file.name, 'newer.dwg');
  const requestId = secondWorker.messages[0].requestId;
  secondWorker.emit({ type: 'progress', requestId, progress: { stage: 'parsing', value: 0.4 } });
  secondWorker.emit({
    type: 'result', requestId,
    result: makeResult('newer.dwg', secondFile.size, 'AC1027'),
  });
  assert.equal((await second).file.name, 'newer.dwg');
  assert.equal(secondWorker.terminated, true);
  assert.equal(progress[0].stage, 'reading');

  const workersBeforeInvalidFiles = FakeWorker.instances.length;
  await assert.rejects(parser.parse(makeFile('sample.dxf')),
    (error) => error.code === 'INVALID_FILE_TYPE');
  await assert.rejects(parser.parse({ ...makeFile('empty.dwg'), size: 0 }),
    (error) => error.code === 'INVALID_FILE');
  await assert.rejects(parser.parse({ ...makeFile('huge.dwg'), size: MAX_FILE_SIZE + 1 }),
    (error) => error.code === 'FILE_TOO_LARGE');
  await assert.rejects(parser.parse(makeFile('renamed.dwg', 'NOTDW')),
    (error) => error.code === 'INVALID_DWG_HEADER');
  await assert.rejects(parser.parse({
    ...makeFile('short-read.dwg'),
    size: 20,
  }), (error) => error.code === 'INVALID_FILE');
  assert.equal(FakeWorker.instances.length, workersBeforeInvalidFiles,
    'invalid local files must fail before Worker creation');

  const controller = new AbortController();
  previousWorkerCount = FakeWorker.instances.length;
  const pendingFile = makeFile('cancelled.dwg');
  const pending = parser.parse(pendingFile, { signal: controller.signal });
  const abortedWorker = await waitForPostedWorker(previousWorkerCount);
  controller.abort();
  await assert.rejects(pending, (error) => error.name === 'AbortError');
  assert.equal(abortedWorker.terminated, true);
  parser.dispose();
  await assert.rejects(parser.parse(makeFile()), (error) => error.code === 'DISPOSED');

  const timeoutParser = createPlanCheckParser({ timeoutMs: 200 });
  previousWorkerCount = FakeWorker.instances.length;
  const timedOutFile = makeFile('slow.dwg');
  const timedOut = timeoutParser.parse(timedOutFile);
  const timedOutWorker = await waitForPostedWorker(previousWorkerCount);
  await assert.rejects(timedOut, (error) => error.code === 'PARSE_TIMEOUT');
  assert.equal(timedOutWorker.terminated, true);

  previousWorkerCount = FakeWorker.instances.length;
  const afterTimeoutFile = makeFile('after-timeout.dwg', 'AC1024');
  const afterTimeout = timeoutParser.parse(afterTimeoutFile);
  const afterTimeoutWorker = await waitForPostedWorker(previousWorkerCount);
  assert.notEqual(afterTimeoutWorker, timedOutWorker);
  afterTimeoutWorker.emit({
    type: 'result', requestId: afterTimeoutWorker.messages[0].requestId,
    result: makeResult('after-timeout.dwg', afterTimeoutFile.size, 'AC1024'),
  });
  assert.equal((await afterTimeout).file.name, 'after-timeout.dwg');
  assert.equal(afterTimeoutWorker.terminated, true);
  timeoutParser.dispose();

  const retryParser = createPlanCheckParser();
  previousWorkerCount = FakeWorker.instances.length;
  const corruptFile = makeFile('corrupt.dwg');
  const corrupt = retryParser.parse(corruptFile);
  const corruptWorker = await waitForPostedWorker(previousWorkerCount);
  corruptWorker.emit({
    type: 'error', requestId: corruptWorker.messages[0].requestId,
    error: { code: 'DWG_READ_FAILED', message: 'corrupt' },
  });
  await assert.rejects(corrupt, (error) => error.code === 'DWG_READ_FAILED');
  assert.equal(corruptWorker.terminated, true);

  previousWorkerCount = FakeWorker.instances.length;
  const afterFailureFile = makeFile('after-failure.dwg');
  const afterFailure = retryParser.parse(afterFailureFile);
  const afterFailureWorker = await waitForPostedWorker(previousWorkerCount);
  assert.notEqual(afterFailureWorker, corruptWorker);
  afterFailureWorker.emit({
    type: 'result', requestId: afterFailureWorker.messages[0].requestId,
    result: makeResult('after-failure.dwg', afterFailureFile.size),
  });
  assert.equal((await afterFailure).file.name, 'after-failure.dwg');
  assert.equal(afterFailureWorker.terminated, true);

  previousWorkerCount = FakeWorker.instances.length;
  const mismatchedFile = makeFile('identity-check.dwg');
  const mismatchedResult = retryParser.parse(mismatchedFile);
  const mismatchWorker = await waitForPostedWorker(previousWorkerCount);
  mismatchWorker.emit({
    type: 'result', requestId: mismatchWorker.messages[0].requestId,
    result: makeResult('different-file.dwg', mismatchedFile.size),
  });
  await assert.rejects(mismatchedResult, (error) => error.code === 'INVALID_RESULT');
  assert.equal(mismatchWorker.terminated, true);

  // A very large result is accepted: the client checks shape, not size.
  previousWorkerCount = FakeWorker.instances.length;
  const oversizedFile = makeFile('oversized-result.dwg');
  const oversizedResult = retryParser.parse(oversizedFile);
  const resultWorker = await waitForPostedWorker(previousWorkerCount);
  const result = makeResult('oversized-result.dwg', oversizedFile.size);
  result.validation.errors = Array.from({ length: 5_000 }, (_, index) => ({ id: index }));
  resultWorker.emit({ type: 'result', requestId: resultWorker.messages.at(-1).requestId, result });
  assert.equal((await oversizedResult).validation.errors.length, 5_000);
  assert.equal(resultWorker.terminated, true);
  retryParser.dispose();
} finally {
  globalThis.Worker = originalWorker;
}

console.log('Plan-check core tests passed.');
