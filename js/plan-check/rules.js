import {
  ALL_CAFM_LAYERS,
  AOID_TEXT_LAYERS,
  LIMITS,
  resourceLimit,
} from './config.js';
import {
  computeKpis,
  computePolygonArea,
  distancePointToSegment,
  hasSelfIntersection,
  hashVertices,
  pointInPolygon,
  visualCenter,
} from './geometry.js';

// User-facing descriptions are retained from the reference checker's German
// rule catalogue. Codes remain the stable machine contract; descriptions make
// passed rules understandable even when there is no finding message.
export const RULE_DESCRIPTIONS = Object.freeze({
  LAYER_001: 'Pflicht-Layer fehlt: R_RAUMPOLYGON',
  LAYER_002: 'Pflicht-Layer fehlt: R_AOID',
  LAYER_003: 'Pflicht-Layer fehlt: R_GESCHOSSPOLYGON',
  LAYER_004: 'Pflicht-Layer fehlt: A_ARCHITEKTUR',
  LAYER_005: 'Pflicht-Layer fehlt: V_PLANLAYOUT',
  LAYER_006: 'Pflicht-Layer fehlt: V_BEMASSUNG',
  LAYER_007: 'Pflicht-Layer fehlt: A_SCHRAFFUR',
  LAYER_008: 'Unbekannter Layer vorhanden',
  POLY_001: 'Raumpolygon ist nicht geschlossen',
  POLY_002: 'Raumpolygon enthält Bogensegmente',
  POLY_003: 'Polygon hat weniger als 3 Eckpunkte',
  POLY_004: 'Raumfläche sehr klein (< 0.25 m²)',
  POLY_005: 'Mögliches doppeltes Polygon',
  POLY_006: 'Element auf R_RAUMPOLYGON ist keine LWPOLYLINE',
  POLY_007: 'Raumpolygon hat Selbstüberschneidung',
  GPOLY_001: 'Geschosspolygon ist nicht geschlossen',
  GPOLY_002: 'Geschosspolygon enthält Bogensegmente',
  GPOLY_003: 'Element auf R_GESCHOSSPOLYGON ist keine LWPOLYLINE',
  GPOLY_004: 'Kein Geschosspolygon vorhanden',
  GPOLY_005: 'Mögliches doppeltes Geschosspolygon',
  AOID_001: 'Raumpolygon hat keine AOID',
  AOID_002: 'AOID ist nicht eindeutig',
  AOID_003: 'AOID-Format ist ungültig',
  AOID_004: 'Mehrere Texte auf R_AOID im Polygon',
  AOID_005: 'AOID-Text ausserhalb aller Raumpolygone',
  AOID_006: 'Basispunkt eines ausgerichteten AOID-Texts ausserhalb Polygon',
  GEOM_001: 'Zeichnungseinheit ist nicht Millimeter',
  GEOM_002: 'Element hat Z-Koordinate != 0',
  GEOM_003: 'Unzulässiger Entitätstyp vorhanden',
  GEOM_004: 'Externe Referenz (XREF) vorhanden',
  GEOM_005: 'Element ausserhalb des Schnittrahmens',
  TEXT_001: 'Textelement auf unzulässigem Layer',
  TEXT_002: 'Schriftart ist nicht ARIAL',
  STYLE_001: 'Polylinienbreite ist nicht 0 mm',
  STYLE_002: 'Farbe ist nicht VONLAYER',
  LAYOUT_001: 'Layout-Tab (Paper Space) vorhanden',
  LAYOUT_002: 'Kein Planrahmen auf V_PLANLAYOUT erkannt',
  DIM_001: 'Keine Masselemente auf V_BEMASSUNG',
  DIM_002: 'Masselement ist nicht assoziativ',
  HATCH_001: 'Schraffur auf A_SCHRAFFUR ist nicht SOLID',
});

export const ALL_RULES = Object.freeze([
  { cat: 'LAYER', code: 'LAYER_001', sev: 'error' },
  { cat: 'LAYER', code: 'LAYER_002', sev: 'error' },
  { cat: 'LAYER', code: 'LAYER_003', sev: 'error' },
  { cat: 'LAYER', code: 'LAYER_004', sev: 'warning' },
  { cat: 'LAYER', code: 'LAYER_005', sev: 'warning' },
  { cat: 'LAYER', code: 'LAYER_006', sev: 'warning' },
  { cat: 'LAYER', code: 'LAYER_007', sev: 'warning' },
  { cat: 'LAYER', code: 'LAYER_008', sev: 'warning' },
  { cat: 'POLY', code: 'POLY_001', sev: 'error' },
  { cat: 'POLY', code: 'POLY_002', sev: 'error' },
  { cat: 'POLY', code: 'POLY_003', sev: 'error' },
  { cat: 'POLY', code: 'POLY_004', sev: 'warning' },
  { cat: 'POLY', code: 'POLY_005', sev: 'warning' },
  { cat: 'POLY', code: 'POLY_006', sev: 'error' },
  { cat: 'POLY', code: 'POLY_007', sev: 'warning' },
  { cat: 'GPOLY', code: 'GPOLY_001', sev: 'error' },
  { cat: 'GPOLY', code: 'GPOLY_002', sev: 'error' },
  { cat: 'GPOLY', code: 'GPOLY_003', sev: 'error' },
  { cat: 'GPOLY', code: 'GPOLY_004', sev: 'warning' },
  { cat: 'GPOLY', code: 'GPOLY_005', sev: 'warning' },
  { cat: 'AOID', code: 'AOID_001', sev: 'error' },
  { cat: 'AOID', code: 'AOID_002', sev: 'error' },
  { cat: 'AOID', code: 'AOID_003', sev: 'warning' },
  { cat: 'AOID', code: 'AOID_004', sev: 'warning' },
  { cat: 'AOID', code: 'AOID_005', sev: 'warning' },
  { cat: 'AOID', code: 'AOID_006', sev: 'warning' },
  { cat: 'GEOM', code: 'GEOM_001', sev: 'error' },
  { cat: 'GEOM', code: 'GEOM_002', sev: 'warning' },
  { cat: 'GEOM', code: 'GEOM_003', sev: 'error' },
  { cat: 'GEOM', code: 'GEOM_004', sev: 'warning' },
  { cat: 'GEOM', code: 'GEOM_005', sev: 'warning' },
  { cat: 'TEXT', code: 'TEXT_001', sev: 'warning' },
  { cat: 'TEXT', code: 'TEXT_002', sev: 'warning' },
  { cat: 'STYLE', code: 'STYLE_001', sev: 'warning' },
  { cat: 'STYLE', code: 'STYLE_002', sev: 'warning' },
  { cat: 'LAYOUT', code: 'LAYOUT_001', sev: 'warning' },
  { cat: 'LAYOUT', code: 'LAYOUT_002', sev: 'warning' },
  { cat: 'DIM', code: 'DIM_001', sev: 'warning' },
  { cat: 'DIM', code: 'DIM_002', sev: 'warning' },
  { cat: 'HATCH', code: 'HATCH_001', sev: 'warning' },
].map((rule) => Object.freeze({ ...rule, description: RULE_DESCRIPTIONS[rule.code] })));

const UNIT_NAMES = Object.freeze({
  0: 'Ohne Einheit',
  1: 'Zoll',
  2: 'Fuss',
  3: 'Meilen',
  4: 'Millimeter',
  5: 'Zentimeter',
  6: 'Meter',
});

function createRunContext() {
  let nextId = 1;
  let operations = 0;
  const errors = [];
  const consume = (amount = 1) => {
    operations += Math.max(1, Number(amount) || 1);
    if (operations > LIMITS.validationOperations) {
      throw resourceLimit('Die Validierung überschreitet das Rechenlimit.', {
        limit: LIMITS.validationOperations,
      });
    }
  };
  const add = (severity, ruleCode, message, category, extra = {}) => {
    if (errors.length >= LIMITS.validationErrors) {
      throw resourceLimit(`Die Validierung erzeugt mehr als ${LIMITS.validationErrors} Meldungen.`, {
        limit: LIMITS.validationErrors,
      });
    }
    errors.push({ id: nextId, severity, ruleCode, message, category, ...extra });
    nextId += 1;
  };
  return { errors, add, consume, get operations() { return operations; } };
}

function ensureCollectionLimit(values, label) {
  if (values.length > LIMITS.reportedItems) {
    throw resourceLimit(`${label} überschreitet ${LIMITS.reportedItems} Elemente.`, {
      actual: values.length,
      limit: LIMITS.reportedItems,
    });
  }
}

function extractSpaces(drawing, context) {
  const renderList = drawing.renderList;
  const identifierTexts = renderList.filter((item) => item.t === 'text' && item.l === 'R_AOID');
  const textItems = renderList.filter((item) => item.t === 'text');
  const roomPolygons = renderList.filter((item) => item.t === 'poly' && item.closed && item.l === 'R_RAUMPOLYGON');
  const areaPolygons = renderList.filter((item) => item.t === 'poly' && item.closed && item.l === 'R_GESCHOSSPOLYGON');
  ensureCollectionLimit(identifierTexts, 'Die Anzahl der AOID-Texte');
  ensureCollectionLimit(roomPolygons, 'Die Anzahl der Raumpolygone');
  ensureCollectionLimit(areaPolygons, 'Die Anzahl der Geschosspolygone');

  const rooms = roomPolygons.map((polygon, index) => {
    const matches = [];
    const matchIndexes = [];
    let label = '';
    for (let textIndex = 0; textIndex < identifierTexts.length; textIndex += 1) {
      const textItem = identifierTexts[textIndex];
      context.consume(polygon.verts.length);
      if (!pointInPolygon(textItem.x, textItem.y, polygon.verts)) continue;
      const text = String(textItem.text || '').trim();
      if (!text) continue;
      matches.push(text);
      matchIndexes.push(textIndex);
      if (!label || text.length < label.length) label = text;
    }
    return {
      id: index + 1,
      aoid: label || `R${index + 1}`,
      area: drawing.insunits === 4
        ? Math.round((computePolygonArea(polygon.verts) / 1e6) * 100) / 100
        : null,
      centroid: visualCenter(polygon.verts, { consume: context.consume }),
      vertices: polygon.verts,
      layer: polygon.l,
      handle: polygon.handle,
      label,
      aoidMatches: matches,
      aoidTextIndexes: matchIndexes,
      et: polygon.et,
      status: 'ok',
      // The DWG contract has no authoritative SIA use-category mapping.
      // Preserve the measured polygon area without inventing HNF/NNF/VF/FF.
      siaCategory: null,
    };
  });

  const areas = areaPolygons.map((polygon, index) => {
    let label = '';
    for (const textItem of textItems) {
      context.consume(polygon.verts.length);
      if (!pointInPolygon(textItem.x, textItem.y, polygon.verts)) continue;
      const text = String(textItem.text || '').trim();
      if (!label || text.length < label.length) label = text;
    }
    return {
      id: 1000 + index,
      aoid: label || polygon.l,
      area: drawing.insunits === 4
        ? Math.round((computePolygonArea(polygon.verts) / 1e6) * 100) / 100
        : null,
      centroid: visualCenter(polygon.verts, { consume: context.consume }),
      vertices: polygon.verts,
      layer: polygon.l,
      handle: polygon.handle,
      et: polygon.et,
      status: 'ok',
    };
  });
  return { rooms, areas, identifierTexts, roomPolygons };
}

function runLayerRules(layers, context) {
  const names = new Set(layers.map((layer) => layer.name));
  const checks = [
    ['LAYER_001', 'R_RAUMPOLYGON', 'error'],
    ['LAYER_002', 'R_AOID', 'error'],
    ['LAYER_003', 'R_GESCHOSSPOLYGON', 'error'],
    ['LAYER_004', 'A_ARCHITEKTUR', 'warning'],
    ['LAYER_005', 'V_PLANLAYOUT', 'warning'],
    ['LAYER_006', 'V_BEMASSUNG', 'warning'],
    ['LAYER_007', 'A_SCHRAFFUR', 'warning'],
  ];
  for (const [code, name, severity] of checks) {
    if (!names.has(name)) context.add(severity, code, `Pflicht-Layer fehlt: ${name} ist nicht vorhanden.`, 'LAYER', { layer: name });
  }
  const allowed = new Set(ALL_CAFM_LAYERS);
  for (const layer of layers) {
    if (layer.name === '0' || layer.name === 'Defpoints' || allowed.has(layer.name)) continue;
    context.add('warning', 'LAYER_008', `Unbekannter Layer: ${layer.name} ist nicht in der zulässigen Layerliste.`,
      'LAYER', { layer: layer.name });
  }
}

function runPolygonRules(renderList, context, measureAreas = true) {
  const items = renderList.filter((item) => item.l === 'R_RAUMPOLYGON');
  const polygons = items.filter((item) => item.t === 'poly');
  for (const item of items) {
    if (item.t !== 'poly' || item.et !== 'LWPOLYLINE') {
      context.add('error', 'POLY_006', `Element auf R_RAUMPOLYGON ist keine LWPOLYLINE (Typ: ${item.et}).`,
        'POLY', { handle: item.handle });
    }
  }
  for (const polygon of polygons) {
    if (!polygon.closed) context.add('error', 'POLY_001', 'Raumpolygon ist nicht geschlossen.', 'POLY', { handle: polygon.handle });
    if (polygon.sourceHasBulges || polygon.verts.some((vertex) => Math.abs(vertex.bulge || 0) > 1e-6)) {
      context.add('error', 'POLY_002', 'Raumpolygon enthält Bogensegmente (bulge != 0).', 'POLY', { handle: polygon.handle });
    }
    if (polygon.verts.length < 3) {
      context.add('error', 'POLY_003', 'Polygon hat weniger als 3 Eckpunkte.', 'POLY', { handle: polygon.handle });
    }
    if (measureAreas && polygon.closed && polygon.verts.length >= 3) {
      const area = computePolygonArea(polygon.verts) / 1e6;
      if (area < 0.25) context.add('warning', 'POLY_004', `Raumfläche sehr klein (${area.toFixed(2)} m² < 0.25 m²).`,
        'POLY', { handle: polygon.handle });
    }
    if (polygon.closed && polygon.verts.length >= 4) {
      const count = polygon.verts.length;
      context.consume(Math.max(count, (count * (count - 3)) / 2));
      if (hasSelfIntersection(polygon.verts)) {
        context.add('warning', 'POLY_007', 'Raumpolygon hat eine Selbstüberschneidung.', 'POLY', { handle: polygon.handle });
      }
    }
  }
  const hashes = new Map();
  for (const polygon of polygons) {
    if (polygon.verts.length < 3) continue;
    const hash = hashVertices(polygon.verts);
    if (hashes.has(hash)) context.add('warning', 'POLY_005', 'Mögliches doppeltes Polygon (identische Geometrie).',
      'POLY', { handle: polygon.handle });
    else hashes.set(hash, polygon.handle);
  }
}

function runFloorPolygonRules(renderList, context) {
  const items = renderList.filter((item) => item.l === 'R_GESCHOSSPOLYGON');
  const polygons = items.filter((item) => item.t === 'poly');
  const usablePolygons = polygons.filter((item) => item.verts.length >= 3);
  for (const item of items) {
    if (item.t !== 'poly' || item.et !== 'LWPOLYLINE') {
      context.add('error', 'GPOLY_003', `Element auf R_GESCHOSSPOLYGON ist keine LWPOLYLINE (Typ: ${item.et}).`,
        'GPOLY', { handle: item.handle });
    }
  }
  if (!usablePolygons.length) {
    context.add('warning', 'GPOLY_004', 'Kein Geschosspolygon vorhanden.', 'GPOLY');
  }
  const hashes = new Map();
  for (const polygon of polygons) {
    if (!polygon.closed) context.add('error', 'GPOLY_001', 'Geschosspolygon ist nicht geschlossen.', 'GPOLY', { handle: polygon.handle });
    if (polygon.sourceHasBulges || polygon.verts.some((vertex) => Math.abs(vertex.bulge || 0) > 1e-6)) {
      context.add('error', 'GPOLY_002', 'Geschosspolygon enthält Bogensegmente (bulge != 0).',
        'GPOLY', { handle: polygon.handle });
    }
    if (polygon.verts.length < 3) continue;
    const hash = hashVertices(polygon.verts);
    if (hashes.has(hash)) context.add('warning', 'GPOLY_005', 'Mögliches doppeltes Geschosspolygon.',
      'GPOLY', { handle: polygon.handle });
    else hashes.set(hash, polygon.handle);
  }
}

function runIdentifierRules(spaces, context) {
  const { rooms, identifierTexts, roomPolygons } = spaces;
  for (const room of rooms) {
    if (!room.aoidMatches.length) context.add('error', 'AOID_001',
      `Raum ${room.aoid}: kein AOID-Text auf R_AOID innerhalb des Polygons.`, 'AOID',
      { roomId: room.id, handle: room.handle });
    if (room.aoidMatches.length > 1) context.add('warning', 'AOID_004',
      `Raum ${room.aoid}: ${room.aoidMatches.length} Texte auf R_AOID innerhalb desselben Polygons.`, 'AOID',
      { roomId: room.id, handle: room.handle });
  }
  // AOID_002 concerns association with multiple distinct polygons, while
  // AOID_004 covers multiple text instances in one polygon. Build associations
  // from every raw normalized R_AOID occurrence so a room's secondary label is
  // not discarded merely because another label was chosen for display.
  const associations = new Map();
  for (const room of rooms) {
    for (const textIndex of room.aoidTextIndexes) {
      const textItem = identifierTexts[textIndex];
      const identifier = String(textItem?.text || '').trim();
      if (!identifier) continue;
      if (!associations.has(identifier)) associations.set(identifier, {
        rooms: new Map(),
        textIndexes: new Set(),
      });
      const association = associations.get(identifier);
      association.rooms.set(room.id, room);
      association.textIndexes.add(textIndex);
    }
  }
  for (const [identifier, association] of associations) {
    if (association.rooms.size < 2) continue;
    const handles = [...association.textIndexes]
      .map((textIndex) => String(identifierTexts[textIndex]?.handle || '')).filter(Boolean);
    for (const room of association.rooms.values()) {
      context.add('error', 'AOID_002',
        `AOID "${identifier}" ist nicht eindeutig (${association.rooms.size} Raumpolygone zugeordnet).`,
        'AOID', { roomId: room.id, handle: room.handle, handles });
    }
  }
  const regularIdentifier = /^\d{4}\.[A-Za-z0-9]{1,4}\.\d{2}\.\d{3}$/;
  const parkingIdentifier = /^\d{4}\.\d+\.\d{3}$/;
  for (const room of rooms) {
    if (room.label && !regularIdentifier.test(room.label) && !parkingIdentifier.test(room.label)) {
      context.add('warning', 'AOID_003', `AOID-Format ungültig: "${room.label}" (erwartet: WWWW.GG.EE.RRR).`,
        'AOID', { roomId: room.id, handle: room.handle });
    }
  }
  for (const textItem of identifierTexts) {
    let inside = false;
    for (const polygon of roomPolygons) {
      context.consume(polygon.verts.length);
      if (pointInPolygon(textItem.x, textItem.y, polygon.verts)) { inside = true; break; }
    }
    if (!inside) context.add('warning', 'AOID_005',
      `AOID-Text "${String(textItem.text || '').trim()}" liegt ausserhalb aller Raumpolygone.`,
      'AOID', { handle: textItem.handle });
  }
  let basePointEvaluated = false;
  for (const room of rooms) {
    for (const textIndex of room.aoidTextIndexes) {
      const textItem = identifierTexts[textIndex];
      if (textItem?.usesAlignmentPoint !== true
        || !Number.isFinite(textItem.sourceBaseX) || !Number.isFinite(textItem.sourceBaseY)) continue;
      basePointEvaluated = true;
      context.consume(room.vertices.length);
      if (!pointInPolygon(textItem.sourceBaseX, textItem.sourceBaseY, room.vertices)) context.add('warning', 'AOID_006',
        `AOID-Basispunkt "${String(textItem.text || '').trim()}" liegt ausserhalb des Raumpolygons.`,
        'AOID', { roomId: room.id, handle: textItem.handle });
    }
  }
  return { basePointEvaluated };
}

function runGeometryRules(drawing, context) {
  const { renderList } = drawing;
  if (drawing.insunits === null) {
    context.add('error', 'GEOM_001',
      'Die Zeichnungseinheit fehlt oder konnte nicht gelesen werden. Flächenwerte werden nicht berechnet.', 'GEOM');
  } else if (drawing.insunits !== 4) {
    context.add('error', 'GEOM_001',
      `Zeichnungseinheit ist nicht Millimeter — aktuell: ${UNIT_NAMES[drawing.insunits] || drawing.insunits}.`, 'GEOM');
  }
  if (drawing.diagnostics.nonZeroZEntityCount > 0) {
    const sample = drawing.nonZeroZEntities.slice(0, 3).map((item) => `${item.type}@${item.layer}`).join(', ');
    context.add('warning', 'GEOM_002',
      `${drawing.diagnostics.nonZeroZEntityCount} Element(e) mit Z-Koordinate != 0 (z.B. ${sample}).`, 'GEOM');
  }
  const forbiddenCounts = new Map();
  const forbidden = new Set(['MLINE', 'ELLIPSE', 'SPLINE', 'OLE', 'OLE2FRAME', 'OLEFRAME']);
  const geometryValidationItems = drawing.validationMetadata?.length
    ? [...renderList, ...drawing.validationMetadata]
    : renderList;
  for (const item of geometryValidationItems) {
    if (forbidden.has(item.et)) forbiddenCounts.set(item.et, (forbiddenCounts.get(item.et) || 0) + 1);
  }
  for (const [type, count] of forbiddenCounts) context.add('error', 'GEOM_003',
    `Unzulässiger Entitätstyp: ${type} (${count}× vorhanden).`, 'GEOM');
  if (drawing.xrefBlocks.length) {
    const count = Math.max(drawing.xrefBlocks.length,
      Number(drawing.diagnostics?.xrefReferenceCount) || 0);
    const samples = drawing.xrefBlocks.slice(0, 3).map((reference) => {
      const path = reference.xrefPath ? ` → ${reference.xrefPath}` : '';
      return `"${reference.name}"${path}`;
    }).join(', ');
    context.add('warning', 'GEOM_004',
      `${count} externe Referenz(en) (XREF) vorhanden${samples ? `: ${samples}` : ''}.`, 'GEOM');
  }

  const frames = renderList.filter((item) => item.t === 'poly' && item.closed
    && item.l === 'V_PLANLAYOUT' && item.verts.length >= 4);
  if (!frames.length) return;
  let frame = frames[0];
  let frameArea = -1;
  for (const candidate of frames) {
    context.consume(candidate.verts.length);
    const area = computePolygonArea(candidate.verts);
    if (area > frameArea) { frame = candidate; frameArea = area; }
  }
  const frameContains = (point) => {
    context.consume(frame.verts.length * 2);
    if (pointInPolygon(point.x, point.y, frame.verts)) return true;
    for (let index = 0; index < frame.verts.length; index += 1) {
      const start = frame.verts[index];
      const end = frame.verts[(index + 1) % frame.verts.length];
      if (distancePointToSegment(point.x, point.y, start.x, start.y, end.x, end.y) <= 100) return true;
    }
    return false;
  };
  const entityPoints = (item) => {
    if (item.t === 'text' || item.t === 'point') return [{ x: item.x, y: item.y }];
    if (item.t === 'line') return [{ x: item.x1, y: item.y1 }, { x: item.x2, y: item.y2 }];
    if (item.t === 'poly') return item.verts;
    if (item.t === 'solid') return item.pts;
    if (item.t === 'hatchfill') return item.paths.flatMap((path) => Array.isArray(path?.vertices) ? path.vertices : path);
    if (item.t === 'circle') return [
      { x: item.cx + item.r, y: item.cy }, { x: item.cx - item.r, y: item.cy },
      { x: item.cx, y: item.cy + item.r }, { x: item.cx, y: item.cy - item.r },
    ];
    if (item.t === 'arc') {
      const angles = [item.sa, item.ea, item.sa + ((item.ea - item.sa) / 2)];
      return angles.map((angle) => ({ x: item.cx + Math.cos(angle) * item.r, y: item.cy + Math.sin(angle) * item.r }));
    }
    if (item.t === 'ellipse') {
      const cos = Math.cos(item.rot);
      const sin = Math.sin(item.rot);
      return [
        { x: item.cx + item.rx * cos, y: item.cy + item.rx * sin },
        { x: item.cx - item.rx * cos, y: item.cy - item.rx * sin },
        { x: item.cx - item.ry * sin, y: item.cy + item.ry * cos },
        { x: item.cx + item.ry * sin, y: item.cy - item.ry * cos },
      ];
    }
    return [];
  };
  const allowed = new Set(ALL_CAFM_LAYERS);
  let outsideCount = 0;
  for (const item of renderList) {
    if (!allowed.has(item.l) || item.l === 'V_PLANLAYOUT') continue;
    const points = entityPoints(item);
    if (points.length && points.some((point) => !frameContains(point))) outsideCount += 1;
  }
  if (outsideCount) context.add('warning', 'GEOM_005', `${outsideCount} Element(e) liegen ausserhalb des Planrahmens.`, 'GEOM');
}

function runTextRules(renderList, context) {
  const allowed = new Set(AOID_TEXT_LAYERS);
  const sourceTextTypes = new Set(['TEXT', 'MTEXT', 'ATTRIB']);
  const layerHandles = new Map();
  const fontHandles = new Map();
  for (const item of renderList) {
    if (item.t !== 'text' || !sourceTextTypes.has(item.et)) continue;
    if (!allowed.has(item.l)) {
      if (!layerHandles.has(item.l)) layerHandles.set(item.l, []);
      if (layerHandles.get(item.l).length < LIMITS.reportedItems) layerHandles.get(item.l).push(item.handle);
    }
    const fontName = String(item.fontName || '').trim();
    const fontBaseName = fontName.split(/[\\/]/).at(-1).replace(/\.[^.]+$/, '');
    if (item.l !== 'V_PLANLAYOUT' && !/^arial$/i.test(fontBaseName)) {
      const label = fontName || 'nicht aufgel\u00f6st';
      if (!fontHandles.has(label)) fontHandles.set(label, []);
      if (fontHandles.get(label).length < LIMITS.reportedItems) fontHandles.get(label).push(item.handle);
    }
  }
  for (const [layer, handles] of layerHandles) context.add('warning', 'TEXT_001',
    `${handles.length} Textelement(e) auf unzulässigem Layer "${layer}".`, 'TEXT', { layer, handles });
  for (const [font, handles] of fontHandles) context.add('warning', 'TEXT_002',
    `${handles.length} Text(e) verwenden Schriftart "${font}" statt ARIAL.`, 'TEXT', { handles });
}

function runStyleRules(renderList, context) {
  const widthPolygons = renderList.filter((item) => (
    item.t === 'poly' && Math.abs(Number(item.width) || 0) > 1e-9
  ));
  if (widthPolygons.length) {
    const layers = [...new Set(widthPolygons.map((item) => item.l))].slice(0, 3).join(', ');
    context.add('warning', 'STYLE_001',
      `${widthPolygons.length} Polylinie(n) mit Breite != 0 mm (Layer: ${layers}).`, 'STYLE',
      { handles: widthPolygons.slice(0, LIMITS.reportedItems).map((item) => item.handle) });
  }
  const allowed = new Set(ALL_CAFM_LAYERS);
  const explicitColors = renderList.filter((item) => allowed.has(item.l) && item.byLayer === false);
  if (explicitColors.length) {
    const layers = [...new Set(explicitColors.map((item) => item.l))].slice(0, 3).join(', ');
    context.add('warning', 'STYLE_002',
      `${explicitColors.length} Element(e) mit Farbe nicht VONLAYER (Layer: ${layers}).`, 'STYLE',
      { handles: explicitColors.slice(0, LIMITS.reportedItems).map((item) => item.handle) });
  }
}

function runLayoutRules(drawing, context) {
  if (drawing.paperSpaceLayouts.length) context.add('warning', 'LAYOUT_001',
    `${drawing.paperSpaceLayouts.length} Layout-Tab(s) (Paper Space) vorhanden: ${drawing.paperSpaceLayouts.join(', ')}.`, 'LAYOUT');
  const hasFrame = drawing.renderList.some((item) => item.t === 'poly' && item.closed
    && item.l === 'V_PLANLAYOUT' && item.verts.length >= 4);
  if (!hasFrame) context.add('warning', 'LAYOUT_002', 'Kein Planrahmen auf V_PLANLAYOUT erkannt.', 'LAYOUT');
}

function runDimensionRules(drawing, context) {
  if (!drawing.dimensionInfo.some((item) => item.layer === 'V_BEMASSUNG')) {
    context.add('warning', 'DIM_001', 'Keine Masselemente auf V_BEMASSUNG vorhanden.', 'DIM');
  }
  // DIM_002 remains in the authoritative inventory, but is not evaluated until
  // normalization can resolve DIMASSOC objects instead of misreading type flags.
}

function runHatchRules(drawing, context) {
  const hatchInfo = Array.isArray(drawing.hatchInfo) ? drawing.hatchInfo : [];
  const nonSolid = hatchInfo.filter((item) => item.layer === 'A_SCHRAFFUR'
    && String(item.patternName || '').trim().toUpperCase() !== 'SOLID');
  if (!nonSolid.length) return;
  const patterns = [...new Set(nonSolid.map((item) => (
    String(item.patternName || '').trim() || 'nicht angegeben'
  )))].join(', ');
  context.add('warning', 'HATCH_001',
    `${nonSolid.length} Schraffur(en) auf A_SCHRAFFUR nicht vom Typ SOLID (${patterns}).`, 'HATCH',
    { handles: nonSolid.slice(0, LIMITS.reportedItems).map((item) => item.handle) });
}

function updateStatuses(errors, rooms, areas) {
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const roomsByHandle = new Map(rooms
    .filter((room) => room.handle != null)
    .map((room) => [String(room.handle), room]));
  const areasByHandle = new Map(areas
    .filter((area) => area.handle != null)
    .map((area) => [String(area.handle), area]));
  for (const error of errors) {
    const room = roomsById.get(error.roomId)
      || (error.category === 'POLY' && error.handle != null
        ? roomsByHandle.get(String(error.handle))
        : null);
    if (room) {
      if (error.severity === 'error') room.status = 'error';
      else if (error.severity === 'warning' && room.status === 'ok') room.status = 'warning';
    }
    if (error.category === 'GPOLY' && error.handle) {
      const area = areasByHandle.get(String(error.handle));
      if (area) {
        if (error.severity === 'error') area.status = 'error';
        else if (error.severity === 'warning' && area.status === 'ok') area.status = 'warning';
      }
    }
  }
}

function ruleResults(errors, notEvaluated = new Set()) {
  const counts = new Map();
  for (const error of errors) counts.set(error.ruleCode, (counts.get(error.ruleCode) || 0) + 1);
  return ALL_RULES.map((rule) => {
    const failed = counts.has(rule.code);
    const evaluated = !notEvaluated.has(rule.code);
    return {
      ...rule,
      status: evaluated ? (failed ? 'failed' : 'passed') : 'not-evaluated',
      passed: evaluated ? !failed : null,
      errorCount: counts.get(rule.code) || 0,
    };
  });
}

export function validateDrawing(drawing, layers = drawing?.layerInfo || []) {
  if (!drawing || !Array.isArray(drawing.renderList)) throw new TypeError('validateDrawing requires normalized drawing data.');
  const context = createRunContext();
  const sourceCompleteness = drawing.completeness && typeof drawing.completeness === 'object'
    ? drawing.completeness : { status: 'complete', complete: true, reasons: [] };
  const completeness = {
    status: sourceCompleteness.status === 'incomplete' || sourceCompleteness.complete === false
      ? 'incomplete' : 'complete',
    complete: !(sourceCompleteness.status === 'incomplete' || sourceCompleteness.complete === false),
    reasons: Array.isArray(sourceCompleteness.reasons) ? sourceCompleteness.reasons.map((reason) => ({
      code: String(reason?.code || 'INCOMPLETE_NORMALIZATION'),
      count: Math.max(1, Math.trunc(Number(reason?.count) || 1)),
      message: String(reason?.message || 'Teile der Zeichnung konnten nicht ausgewertet werden.'),
    })) : [],
  };
  if (drawing.insunits !== null && drawing.insunits !== 4) {
    context.add('abort', 'ABORT_002',
      `Zeichnungseinheit ist nicht Millimeter (1:1) — aktuell: ${UNIT_NAMES[drawing.insunits] || drawing.insunits}.`, 'ABORT');
    return {
      rules: ruleResults(context.errors, new Set(ALL_RULES.map((rule) => rule.code))),
      errors: context.errors,
      rooms: [],
      areas: [],
      metrics: {
        rooms: 0,
        areas: 0,
        errors: 1,
        warnings: 0,
        hnf: null,
        nnf: null,
        vf: null,
        ff: null,
        nf: null,
        ngf: null,
        gf: null,
        kf: null,
        roomPolygonArea: null,
        categoryTotals: {},
        evaluatedRules: 0,
        unitStatus: 'invalid',
        validationOperations: context.operations,
      },
      score: 0,
      passedRules: 0,
      aborted: true,
      completeness,
    };
  }

  const spaces = extractSpaces(drawing, context);
  runLayerRules(layers, context);
  const hasMillimetreUnits = drawing.insunits === 4;
  const polygonValidationItems = drawing.validationMetadata?.length
    ? [...drawing.renderList, ...drawing.validationMetadata]
    : drawing.renderList;
  runPolygonRules(polygonValidationItems, context, hasMillimetreUnits);
  runFloorPolygonRules(polygonValidationItems, context);
  const identifierCoverage = runIdentifierRules(spaces, context);
  runGeometryRules(drawing, context);
  runTextRules(drawing.renderList, context);
  runStyleRules(drawing.renderList, context);
  runLayoutRules(drawing, context);
  runDimensionRules(drawing, context);
  runHatchRules(drawing, context);
  updateStatuses(context.errors, spaces.rooms, spaces.areas);

  if (!completeness.complete) {
    for (const reason of completeness.reasons) {
      context.add('abort', 'INCOMPLETE_001', `${reason.message} (${reason.count}×)`, 'SYSTEM', {
        incompletenessCode: reason.code,
        count: reason.count,
      });
    }
  }
  const notEvaluated = new Set(['DIM_002']);
  if (!identifierCoverage.basePointEvaluated) notEvaluated.add('AOID_006');
  if (!hasMillimetreUnits) notEvaluated.add('POLY_004');
  if (!completeness.complete) {
    for (const rule of ALL_RULES) notEvaluated.add(rule.code);
  }
  const rules = ruleResults(context.errors, notEvaluated);
  const passedRules = rules.filter((rule) => rule.passed).length;
  const evaluatedRules = rules.filter((rule) => rule.status !== 'not-evaluated').length;
  const score = completeness.complete
    ? (evaluatedRules ? Math.round((passedRules / evaluatedRules) * 100) : 0)
    : null;
  const errors = context.errors.filter((error) => error.severity === 'error').length;
  const warnings = context.errors.filter((error) => error.severity === 'warning').length;
  const kpis = hasMillimetreUnits
    ? computeKpis(spaces.rooms, spaces.areas)
    : { hnf: null, nnf: null, vf: null, ff: null, nf: null, ngf: null, gf: null, kf: null,
        roomPolygonArea: null, categoryTotals: {} };
  return {
    rules,
    errors: context.errors,
    rooms: spaces.rooms,
    areas: spaces.areas,
    metrics: {
      rooms: spaces.rooms.length,
      areas: spaces.areas.length,
      errors,
      warnings,
      ngf: kpis.ngf,
      evaluatedRules,
      unitStatus: hasMillimetreUnits ? 'millimetres' : 'unknown',
      validationOperations: context.operations,
      ...kpis,
    },
    score,
    passedRules,
    aborted: false,
    completeness,
  };
}
