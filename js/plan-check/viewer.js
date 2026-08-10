// Instance-owned Canvas renderer for normalized Plan Check data. Every global
// listener, observer, pointer and animation frame is released by dispose().

const MIN_ZOOM = 0.000001;
const MAX_ZOOM = 1000000;
const ZOOM_STEP = 1.35;
const WHEEL_STEP = 1.14;
const TAP_TOLERANCE = 8;
// Registers that answer a question about validation polygons rather than about
// the drawing. In these the Canvas shows the polygons alone: painting the full
// CAD content behind them buries the answer under walls, furniture and the
// title block.
const SPATIAL_MODES = new Set(['rooms', 'areas']);
export const PLAN_CHECK_FINDING_SELECTION_LIMIT = 128;
const SCALE_STEPS = Object.freeze([
  1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000,
  10000, 20000, 50000, 100000, 200000, 500000,
]);

const list = (value) => Array.isArray(value) ? value : [];
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalizedSeverity(value) {
  const severity = String(value || '').toLowerCase();
  if (severity === 'error' || severity === 'fehler') return 'error';
  if (severity === 'warning' || severity === 'warn' || severity === 'warnung') return 'warning';
  return 'success';
}

function parsedColor(value) {
  const color = String(value || '').trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(color);
  if (hex && [3, 4, 6, 8].includes(hex[1].length)) {
    const expanded = hex[1].length <= 4
      ? [...hex[1]].map((channel) => channel.repeat(2)).join('') : hex[1];
    return {
      channels: [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16)),
      alpha: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
      value: color,
    };
  }
  const rgb = /^rgba?\((.*)\)$/i.exec(color);
  if (!rgb) return null;
  const sections = rgb[1].split('/');
  if (sections.length > 2) return null;
  const components = sections[0].trim().split(/[,\s]+/).filter(Boolean);
  let alphaValue = sections[1]?.trim();
  if (components.length === 4 && alphaValue == null) alphaValue = components.pop();
  if (components.length !== 3) return null;
  const channel = (component) => {
    const percent = component.endsWith('%');
    const numeric = Number(percent ? component.slice(0, -1) : component);
    if (!Number.isFinite(numeric)) return null;
    return clamp(percent ? numeric * 2.55 : numeric, 0, 255);
  };
  const channels = components.map(channel);
  if (channels.some((component) => component == null)) return null;
  const alphaNumeric = alphaValue == null ? 1 : Number(alphaValue.endsWith('%')
    ? alphaValue.slice(0, -1) : alphaValue);
  if (!Number.isFinite(alphaNumeric)) return null;
  return {
    channels,
    alpha: clamp(alphaValue?.endsWith('%') ? alphaNumeric / 100 : alphaNumeric, 0, 1),
    value: color,
  };
}

function colorChannels(value) {
  return parsedColor(value)?.channels || null;
}

function compositeChannels(foreground, background, alpha = 1) {
  return foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha));
}

function relativeLuminance(channels) {
  const linear = channels.map((channel) => {
    const normalized = clamp(channel, 0, 255) / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function channelContrast(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

export function planCheckContrastRatio(foreground, background) {
  const backgroundColor = parsedColor(background) || parsedColor('#FFFFFF');
  const foregroundColor = parsedColor(foreground);
  if (!foregroundColor) return 1;
  const rendered = compositeChannels(
    foregroundColor.channels, backgroundColor.channels, foregroundColor.alpha,
  );
  return channelContrast(rendered, backgroundColor.channels);
}

export function planCheckAccessibleCadColor(value, background, fallback = '#000000') {
  const backgroundColor = parsedColor(background) || parsedColor('#FFFFFF');
  const supplied = parsedColor(value);
  const source = supplied || parsedColor(fallback) || parsedColor('#000000');
  const rendered = compositeChannels(source.channels, backgroundColor.channels, source.alpha);
  if (channelContrast(rendered, backgroundColor.channels) >= 3) return source.value;

  const black = [0, 0, 0];
  const white = [255, 255, 255];
  const target = channelContrast(black, backgroundColor.channels)
    >= channelContrast(white, backgroundColor.channels) ? black : white;
  let low = 0;
  let high = 255;
  while (low < high) {
    const amount = Math.floor((low + high) / 2);
    const mixed = rendered.map((channel, index) => Math.round(
      channel + (target[index] - channel) * (amount / 255),
    ));
    if (channelContrast(mixed, backgroundColor.channels) >= 3) high = amount;
    else low = amount + 1;
  }
  const adjusted = rendered.map((channel, index) => Math.round(
    channel + (target[index] - channel) * (high / 255),
  ));
  return `rgb(${adjusted.join(', ')})`;
}

function withAlpha(value, alpha) {
  const channels = colorChannels(value);
  return channels ? `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})` : value;
}

export function planCheckCanvasOverlayColors({
  surface = '#FFFFFF',
  selectedColor = '#3B82F6',
  errorColor = '#E53940',
  warningColor = '#F97316',
  successColor = '#10B981',
} = {}) {
  const selected = planCheckAccessibleCadColor(selectedColor, surface);
  const error = planCheckAccessibleCadColor(errorColor, surface);
  const warning = planCheckAccessibleCadColor(warningColor, surface);
  const success = planCheckAccessibleCadColor(successColor, surface);
  return {
    selectedColor: selected,
    errorColor: error,
    warningColor: warning,
    successColor: success,
    selectedFill: withAlpha(selected, 0.28),
    errorFill: withAlpha(error, 0.24),
    warningFill: withAlpha(warning, 0.24),
    successFill: withAlpha(success, 0.18),
  };
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(px - x1, py - y1);
  const position = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - (x1 + position * dx), py - (y1 + position * dy));
}

export function pointInPlanPolygon(x, y, vertices) {
  const points = list(vertices);
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const currentPoint = points[index] || {};
    const previousPoint = points[previous] || {};
    const currentX = finite(currentPoint.x);
    const currentY = finite(currentPoint.y);
    const previousX = finite(previousPoint.x);
    const previousY = finite(previousPoint.y);
    const crosses = ((currentY > y) !== (previousY > y))
      && (x < ((previousX - currentX) * (y - currentY)) / ((previousY - currentY) || Number.EPSILON) + currentX);
    if (crosses) inside = !inside;
  }
  return inside;
}

function verticesBounds(vertices) {
  const points = list(vertices).filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)));
  if (!points.length) return null;
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, Number(point.x)),
    minY: Math.min(bounds.minY, Number(point.y)),
    maxX: Math.max(bounds.maxX, Number(point.x)),
    maxY: Math.max(bounds.maxY, Number(point.y)),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

export function planCheckItemBounds(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.t === 'line') return {
    minX: Math.min(finite(item.x1), finite(item.x2)), minY: Math.min(finite(item.y1), finite(item.y2)),
    maxX: Math.max(finite(item.x1), finite(item.x2)), maxY: Math.max(finite(item.y1), finite(item.y2)),
  };
  if (item.t === 'poly') return verticesBounds(item.verts);
  if (item.t === 'solid') return verticesBounds(item.pts);
  if (item.t === 'hatchfill') {
    const paths = list(item.paths).flatMap((path) => list(path?.vertices || path));
    return verticesBounds(paths);
  }
  if (item.t === 'circle' || item.t === 'arc') {
    const radius = Math.abs(finite(item.r));
    return { minX: finite(item.cx) - radius, minY: finite(item.cy) - radius, maxX: finite(item.cx) + radius, maxY: finite(item.cy) + radius };
  }
  if (item.t === 'ellipse') {
    const rx = Math.abs(finite(item.rx));
    const ry = Math.abs(finite(item.ry));
    const rotation = finite(item.rot);
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const extentX = Math.hypot(rx * cosine, ry * sine);
    const extentY = Math.hypot(rx * sine, ry * cosine);
    return {
      minX: finite(item.cx) - extentX, minY: finite(item.cy) - extentY,
      maxX: finite(item.cx) + extentX, maxY: finite(item.cy) + extentY,
    };
  }
  if (item.t === 'text') {
    const height = Math.max(Math.abs(finite(item.h, 1)), 1);
    const width = Math.max(String(item.text || '').length * height * 0.6, height);
    return { minX: finite(item.x), minY: finite(item.y) - height, maxX: finite(item.x) + width, maxY: finite(item.y) + height };
  }
  if (item.t === 'point') {
    const x = finite(item.x);
    const y = finite(item.y);
    return { minX: x, minY: y, maxX: x, maxY: y };
  }
  return null;
}

function mergeBounds(boundsList) {
  const values = list(boundsList).filter((bounds) => bounds
    && [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite));
  if (!values.length) return null;
  return values.reduce((merged, bounds) => ({
    minX: Math.min(merged.minX, bounds.minX), minY: Math.min(merged.minY, bounds.minY),
    maxX: Math.max(merged.maxX, bounds.maxX), maxY: Math.max(merged.maxY, bounds.maxY),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function drawingBounds(result) {
  const bounds = result?.drawing?.bounds;
  if (bounds && [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every((value) => Number.isFinite(Number(value)))) {
    return { minX: Number(bounds.minX), minY: Number(bounds.minY), maxX: Number(bounds.maxX), maxY: Number(bounds.maxY) };
  }
  return mergeBounds(list(result?.drawing?.renderList).map(planCheckItemBounds)) || { minX: 0, minY: 0, maxX: 1, maxY: 1 };
}

function drawBulgeArc(context, start, end, bulge) {
  const x1 = finite(start?.x);
  const y1 = finite(start?.y);
  const x2 = finite(end?.x);
  const y2 = finite(end?.y);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  const amount = finite(bulge);
  if (!distance || !amount) { context.lineTo(x2, y2); return; }
  const sagitta = Math.abs(amount) * distance / 2;
  if (!sagitta) { context.lineTo(x2, y2); return; }
  const radius = ((distance / 2) ** 2 + sagitta ** 2) / (2 * sagitta);
  const middleX = (x1 + x2) / 2;
  const middleY = (y1 + y2) / 2;
  const sign = amount > 0 ? 1 : -1;
  const centerX = middleX + (-dy / distance) * sign * (radius - sagitta);
  const centerY = middleY + (dx / distance) * sign * (radius - sagitta);
  context.arc(centerX, centerY, Math.abs(radius), Math.atan2(y1 - centerY, x1 - centerX), Math.atan2(y2 - centerY, x2 - centerX), amount < 0);
}

function traceVertices(context, vertices, close = true, begin = true) {
  const points = list(vertices);
  if (!points.length) return false;
  if (begin) context.beginPath();
  context.moveTo(finite(points[0]?.x), finite(points[0]?.y));
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (finite(previous?.bulge)) drawBulgeArc(context, previous, current, previous.bulge);
    else context.lineTo(finite(current?.x), finite(current?.y));
  }
  if (close && points.length > 1) {
    const last = points[points.length - 1];
    if (finite(last?.bulge)) drawBulgeArc(context, last, points[0], last.bulge);
    else context.lineTo(finite(points[0]?.x), finite(points[0]?.y));
    context.closePath();
  }
  return true;
}

function drawItem(context, item, zoom) {
  if (!item || !item.t) return;
  if (item.t === 'line') {
    context.beginPath(); context.moveTo(finite(item.x1), finite(item.y1)); context.lineTo(finite(item.x2), finite(item.y2)); context.stroke();
  } else if (item.t === 'poly') {
    if (traceVertices(context, item.verts, Boolean(item.closed))) context.stroke();
  } else if (item.t === 'circle') {
    context.beginPath(); context.arc(finite(item.cx), finite(item.cy), Math.abs(finite(item.r)), 0, Math.PI * 2); context.stroke();
  } else if (item.t === 'arc') {
    context.beginPath(); context.arc(finite(item.cx), finite(item.cy), Math.abs(finite(item.r)), finite(item.sa), finite(item.ea)); context.stroke();
  } else if (item.t === 'ellipse') {
    context.beginPath(); context.ellipse(finite(item.cx), finite(item.cy), Math.abs(finite(item.rx)), Math.abs(finite(item.ry)), finite(item.rot), 0, Math.PI * 2); context.stroke();
  } else if (item.t === 'text') {
    context.save();
    context.translate(finite(item.x), finite(item.y));
    context.rotate(-finite(item.rot));
    context.scale(1, -1);
    context.font = `${Math.max(Math.abs(finite(item.h, 1)), 1)}px sans-serif`;
    context.fillText(String(item.text || ''), 0, 0);
    context.restore();
  } else if (item.t === 'point') {
    const radius = Math.max(3 / zoom, Number.EPSILON);
    context.beginPath(); context.arc(finite(item.x), finite(item.y), radius, 0, Math.PI * 2); context.fill();
  } else if (item.t === 'solid') {
    if (traceVertices(context, item.pts, true)) context.fill();
  } else if (item.t === 'hatchfill') {
    context.beginPath();
    for (const path of list(item.paths)) {
      traceVertices(context, path?.vertices || path, true, false);
    }
    context.fill('evenodd');
  }
}

function normalizedAngle(value) {
  const fullTurn = Math.PI * 2;
  return ((finite(value) % fullTurn) + fullTurn) % fullTurn;
}

function angleWithinArc(angle, start, end) {
  const fullTurn = Math.PI * 2;
  const rawSweep = finite(end) - finite(start);
  if (Math.abs(rawSweep) >= fullTurn - 1e-9) return true;
  const sweep = (normalizedAngle(end) - normalizedAngle(start) + fullTurn) % fullTurn;
  const offset = (normalizedAngle(angle) - normalizedAngle(start) + fullTurn) % fullTurn;
  return offset <= sweep + 1e-9;
}

export function planCheckItemDistance(x, y, item) {
  if (item?.t === 'line') return distanceToSegment(x, y, finite(item.x1), finite(item.y1), finite(item.x2), finite(item.y2));
  if (item?.t === 'poly') {
    const points = list(item.verts);
    if (item.closed && pointInPlanPolygon(x, y, points)) return 0;
    let distance = Infinity;
    for (let index = 1; index < points.length; index += 1) {
      distance = Math.min(distance, distanceToSegment(x, y, finite(points[index - 1]?.x), finite(points[index - 1]?.y), finite(points[index]?.x), finite(points[index]?.y)));
    }
    if (item.closed && points.length > 1) distance = Math.min(distance, distanceToSegment(
      x, y, finite(points[points.length - 1]?.x), finite(points[points.length - 1]?.y), finite(points[0]?.x), finite(points[0]?.y),
    ));
    return distance;
  }
  if (item?.t === 'circle') return Math.abs(Math.hypot(x - finite(item.cx), y - finite(item.cy)) - Math.abs(finite(item.r)));
  if (item?.t === 'arc') {
    const centerX = finite(item.cx);
    const centerY = finite(item.cy);
    const radius = Math.abs(finite(item.r));
    const angle = Math.atan2(y - centerY, x - centerX);
    if (angleWithinArc(angle, item.sa, item.ea)) {
      return Math.abs(Math.hypot(x - centerX, y - centerY) - radius);
    }
    const endpoints = [finite(item.sa), finite(item.ea)].map((endpoint) => ({
      x: centerX + radius * Math.cos(endpoint),
      y: centerY + radius * Math.sin(endpoint),
    }));
    return Math.min(...endpoints.map((endpoint) => Math.hypot(x - endpoint.x, y - endpoint.y)));
  }
  if (item?.t === 'ellipse') {
    const radiusX = Math.abs(finite(item.rx));
    const radiusY = Math.abs(finite(item.ry));
    const rotation = finite(item.rot);
    const deltaX = x - finite(item.cx);
    const deltaY = y - finite(item.cy);
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const localX = deltaX * cosine + deltaY * sine;
    const localY = -deltaX * sine + deltaY * cosine;
    if (!radiusX || !radiusY) {
      const halfX = radiusX * cosine;
      const halfY = radiusX * sine;
      const sideX = -radiusY * sine;
      const sideY = radiusY * cosine;
      return distanceToSegment(
        x, y,
        finite(item.cx) - halfX - sideX, finite(item.cy) - halfY - sideY,
        finite(item.cx) + halfX + sideX, finite(item.cy) + halfY + sideY,
      );
    }
    const normalizedRadius = Math.hypot(localX / radiusX, localY / radiusY);
    return Math.abs(normalizedRadius - 1) * Math.min(radiusX, radiusY);
  }
  if (item?.t === 'hatchfill') {
    let inside = false;
    let distance = Infinity;
    for (const path of list(item.paths)) {
      const points = list(path?.vertices || path);
      if (points.length < 3) continue;
      if (pointInPlanPolygon(x, y, points)) inside = !inside;
      for (let index = 0; index < points.length; index += 1) {
        const start = points[index];
        const end = points[(index + 1) % points.length];
        distance = Math.min(distance, distanceToSegment(
          x, y, finite(start?.x), finite(start?.y), finite(end?.x), finite(end?.y),
        ));
      }
    }
    return inside ? 0 : distance;
  }
  if (item?.t === 'solid') return pointInPlanPolygon(x, y, item.pts) ? 0 : Infinity;
  const bounds = planCheckItemBounds(item);
  if (!bounds) return Infinity;
  if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) return 0;
  return Math.hypot(Math.max(bounds.minX - x, 0, x - bounds.maxX), Math.max(bounds.minY - y, 0, y - bounds.maxY));
}

function spatialIdentity(item, index, type) {
  return String(item?.id || item?.handle || `${type}-${index + 1}`);
}

function errorIdentity(error, index) {
  return String(error?.id || `${error?.ruleCode || 'Feststellung'}-${index + 1}`);
}

function selectionKey(value) {
  if (value == null || (typeof value === 'object' && typeof value !== 'bigint')) return '';
  return String(value).trim();
}

function indexSpatialItems(items, type) {
  const source = list(items);
  const byId = new Map();
  const byHandle = new Map();
  const bySelection = new Map();
  source.forEach((item, index) => {
    const id = selectionKey(item?.id);
    const handle = selectionKey(item?.handle);
    const identity = spatialIdentity(item, index, type);
    if (id && !byId.has(id)) byId.set(id, item);
    if (handle && !byHandle.has(handle)) byHandle.set(handle, item);
    if (!bySelection.has(identity)) bySelection.set(identity, item);
  });
  return { source, byId, byHandle, bySelection };
}

function createSpatialLookup(validation = {}) {
  return {
    room: indexSpatialItems(validation?.rooms, 'room'),
    area: indexSpatialItems(validation?.areas, 'area'),
  };
}

function resolveFindingSpatialTarget(finding, lookup) {
  const roomId = selectionKey(finding?.roomId);
  const areaId = selectionKey(finding?.areaId);
  const handle = selectionKey(finding?.handle);
  const room = (roomId && lookup.room.byId.get(roomId)) || (handle && lookup.room.byHandle.get(handle));
  if (room) return { item: room, type: 'room' };
  const area = (areaId && lookup.area.byId.get(areaId)) || (handle && lookup.area.byHandle.get(handle));
  return area ? { item: area, type: 'area' } : null;
}

export function planCheckFindingSpatialTarget(finding, validation = {}) {
  return resolveFindingSpatialTarget(finding, createSpatialLookup(validation));
}

function findingReferences(finding, limit = PLAN_CHECK_FINDING_SELECTION_LIMIT) {
  const handles = [];
  const seen = new Set();
  let truncated = false;
  for (const value of [finding?.handle, ...list(finding?.handles)]) {
    const handle = selectionKey(value);
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    if (handles.length < limit + 1) handles.push(handle);
    else truncated = true;
  }
  return { handles, layer: selectionKey(finding?.layer), truncated };
}

function createFindingLookup(renderList, relatedItems = []) {
  const byHandle = new Map();
  const byLayer = new Map();
  for (const item of list(renderList)) {
    const handle = selectionKey(item?.handle);
    if (handle) {
      if (!byHandle.has(handle)) byHandle.set(handle, []);
      const handleItems = byHandle.get(handle);
      if (handleItems.length <= PLAN_CHECK_FINDING_SELECTION_LIMIT) handleItems.push(item);
    }
    const layer = selectionKey(item?.l);
    if (!layer) continue;
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    const layerItems = byLayer.get(layer);
    if (layerItems.length <= PLAN_CHECK_FINDING_SELECTION_LIMIT) layerItems.push(item);
  }
  const layerByRelatedHandle = new Map();
  for (const item of list(relatedItems)) {
    const handle = selectionKey(item?.handle);
    const layer = selectionKey(item?.layer || item?.l);
    if (handle && layer && !layerByRelatedHandle.has(handle)) layerByRelatedHandle.set(handle, layer);
  }
  return { byHandle, byLayer, layerByRelatedHandle };
}

function resolveFindingItems(finding, lookup) {
  const references = findingReferences(finding);
  const resolvedHandles = [];
  const seen = new Set();
  let resolvedHandle = false;
  let handlesTruncated = references.truncated;
  for (const handle of references.handles) {
    const handleItems = list(lookup.byHandle.get(handle));
    if (!handleItems.length) continue;
    resolvedHandle = true;
    handlesTruncated ||= handleItems.length > PLAN_CHECK_FINDING_SELECTION_LIMIT;
    for (const item of handleItems) {
      if (seen.has(item)) continue;
      seen.add(item);
      if (resolvedHandles.length < PLAN_CHECK_FINDING_SELECTION_LIMIT) resolvedHandles.push(item);
      else handlesTruncated = true;
    }
  }
  if (resolvedHandle) {
    return {
      items: resolvedHandles,
      source: 'handles',
      truncated: handlesTruncated,
    };
  }
  const layerItems = references.layer ? list(lookup.byLayer.get(references.layer)) : [];
  if (layerItems.length) {
    return {
      items: layerItems.slice(0, PLAN_CHECK_FINDING_SELECTION_LIMIT),
      source: 'layer',
      truncated: layerItems.length > PLAN_CHECK_FINDING_SELECTION_LIMIT,
    };
  }
  const relatedLayers = [...new Set(references.handles
    .map((handle) => lookup.layerByRelatedHandle.get(handle))
    .filter(Boolean))];
  if (relatedLayers.length) {
    const items = [];
    const seen = new Set();
    let truncated = references.truncated;
    for (const layer of relatedLayers) {
      for (const item of list(lookup.byLayer.get(layer))) {
        if (seen.has(item)) continue;
        seen.add(item);
        if (items.length < PLAN_CHECK_FINDING_SELECTION_LIMIT) items.push(item);
        else truncated = true;
      }
    }
    if (items.length) return { items, source: 'related-layer', truncated };
  }
  return { items: [], source: 'none', truncated: false };
}

// Exported for the parser golden test: this is the exact bounded resolver used
// by Canvas highlighting, focusing and hit testing.
export function planCheckFindingRenderItems(finding, renderList, relatedItems = []) {
  return resolveFindingItems(finding, createFindingLookup(renderList, relatedItems));
}

// --- Attribute inspection ---------------------------------------------------
// The attribute card reports what the DWG actually carries for one element.
// Everything here reads normalized primitive fields; nothing is derived beyond
// plain geometry, so a value that is absent stays absent instead of guessed.

const NUMBER_FORMATS = new Map();
function decimal(value, digits = 2) {
  if (!NUMBER_FORMATS.has(digits)) {
    NUMBER_FORMATS.set(digits, new Intl.NumberFormat('de-CH', { maximumFractionDigits: digits }));
  }
  return NUMBER_FORMATS.get(digits).format(value);
}

const MILLIMETRES = 4;
const METRES = 6;

function formatLength(value, insunits) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  if (Number(insunits) === MILLIMETRES) {
    return Math.abs(number) >= 1000 ? `${decimal(number, 0)} mm · ${decimal(number / 1000, 2)} m` : `${decimal(number, 1)} mm`;
  }
  if (Number(insunits) === METRES) return `${decimal(number, 3)} m`;
  return `${decimal(number, 2)} ZE`;
}

function formatSurface(value, insunits) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  if (Number(insunits) === MILLIMETRES) return `${decimal(number / 1e6, 2)} m²`;
  if (Number(insunits) === METRES) return `${decimal(number, 2)} m²`;
  return `${decimal(number, 2)} ZE²`;
}

function formatPoint(x, y, insunits) {
  if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return '';
  const digits = Number(insunits) === MILLIMETRES ? 0 : 2;
  return `X ${decimal(Number(x), digits)} · Y ${decimal(Number(y), digits)}`;
}

function polygonArea(vertices) {
  const points = list(vertices);
  if (points.length < 3) return 0;
  let twice = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    twice += finite(points[index]?.x) * finite(next?.y) - finite(next?.x) * finite(points[index]?.y);
  }
  return Math.abs(twice) / 2;
}

function polylineLength(vertices, closed = false) {
  const points = list(vertices);
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(finite(points[index]?.x) - finite(points[index - 1]?.x),
      finite(points[index]?.y) - finite(points[index - 1]?.y));
  }
  if (closed && points.length > 2) {
    total += Math.hypot(finite(points[0]?.x) - finite(points.at(-1)?.x),
      finite(points[0]?.y) - finite(points.at(-1)?.y));
  }
  return total;
}

function fact(label, value, options = {}) {
  return value == null || value === '' ? null : { label, value: String(value), ...options };
}

// Type-specific geometry facts for one normalized render primitive.
function geometryFacts(item, insunits) {
  if (item?.t === 'line') return [
    fact('Länge', formatLength(Math.hypot(finite(item.x2) - finite(item.x1), finite(item.y2) - finite(item.y1)), insunits)),
    fact('Von', formatPoint(item.x1, item.y1, insunits), { mono: true }),
    fact('Bis', formatPoint(item.x2, item.y2, insunits), { mono: true }),
  ];
  if (item?.t === 'poly') {
    const points = list(item.verts);
    return [
      fact('Stützpunkte', decimal(points.length, 0)),
      fact('Verlauf', item.closed ? 'Geschlossen' : 'Offen'),
      item.closed ? fact('Fläche', formatSurface(polygonArea(points), insunits)) : null,
      fact('Länge', formatLength(polylineLength(points, Boolean(item.closed)), insunits)),
      item.sourceHasBulges ? fact('Bogensegmente', 'Vorhanden') : null,
      item.width != null ? fact('Breite', formatLength(item.width, insunits)) : null,
    ];
  }
  if (item?.t === 'circle') return [
    fact('Radius', formatLength(item.r, insunits)),
    fact('Mittelpunkt', formatPoint(item.cx, item.cy, insunits), { mono: true }),
  ];
  if (item?.t === 'arc') return [
    fact('Radius', formatLength(item.r, insunits)),
    fact('Mittelpunkt', formatPoint(item.cx, item.cy, insunits), { mono: true }),
    fact('Winkel', `${decimal((finite(item.sa) * 180) / Math.PI, 1)}° bis ${decimal((finite(item.ea) * 180) / Math.PI, 1)}°`),
  ];
  if (item?.t === 'ellipse') return [
    fact('Halbachsen', `${formatLength(item.rx, insunits)} / ${formatLength(item.ry, insunits)}`),
    fact('Mittelpunkt', formatPoint(item.cx, item.cy, insunits), { mono: true }),
  ];
  if (item?.t === 'text') return [
    fact('Text', String(item.text || '')),
    fact('Schrifthöhe', formatLength(item.h, insunits)),
    finite(item.rot) ? fact('Drehung', `${decimal((finite(item.rot) * 180) / Math.PI, 1)}°`) : null,
    fact('Schriftart', item.fontName),
    fact('Einfügepunkt', formatPoint(item.x, item.y, insunits), { mono: true }),
  ];
  if (item?.t === 'point') return [fact('Position', formatPoint(item.x, item.y, insunits), { mono: true })];
  if (item?.t === 'solid') return [
    fact('Stützpunkte', decimal(list(item.pts).length, 0)),
    fact('Fläche', formatSurface(polygonArea(item.pts), insunits)),
  ];
  if (item?.t === 'hatchfill') return [
    fact('Schraffurpfade', decimal(list(item.paths).length, 0)),
    fact('Muster', item.patternName),
  ];
  return [];
}

function colorFact(item) {
  const color = selectionKey(item?.c);
  if (!color) return null;
  return {
    label: 'Farbe',
    value: item?.byLayer === false ? `${color} · direkt` : `${color} · VONLAYER`,
    mono: true,
    swatch: color,
  };
}

function findingsFor(errors, predicate) {
  const matches = [];
  for (const error of list(errors)) {
    if (!predicate(error)) continue;
    matches.push({
      severity: selectionKey(error?.severity) || 'warning',
      ruleCode: selectionKey(error?.ruleCode),
      message: selectionKey(error?.message),
    });
    if (matches.length >= PLAN_CHECK_FINDING_SELECTION_LIMIT) break;
  }
  return matches;
}

function errorTouchesHandle(error, handle) {
  if (!handle) return false;
  return selectionKey(error?.handle) === handle
    || list(error?.handles).some((value) => selectionKey(value) === handle);
}

function spatialFacts(item, type, insunits) {
  const points = list(item?.vertices);
  return [
    fact('AOID', item?.aoid, { mono: true }),
    fact('Bezeichnung', selectionKey(item?.label) === selectionKey(item?.aoid) ? '' : item?.label),
    fact('Fläche', item?.area == null ? '' : `${decimal(Number(item.area), 2)} m²`),
    fact('Layer', item?.layer, { mono: true }),
    fact('CAD-Typ', item?.et, { mono: true }),
    fact('Handle', item?.handle, { mono: true }),
    fact('Stützpunkte', points.length ? decimal(points.length, 0) : ''),
    fact('Umfang', points.length ? formatLength(polylineLength(points, true), insunits) : ''),
    fact('Schwerpunkt', item?.centroid ? formatPoint(item.centroid.x, item.centroid.y, insunits) : '', { mono: true }),
    fact('Rolle', type === 'room' ? 'Raumpolygon (R_RAUMPOLYGON)' : 'Geschosspolygon (R_GESCHOSSPOLYGON)'),
  ];
}

function buildSelectionDetails(selection, result, lookups) {
  if (!selection) return null;
  const validation = result?.validation || {};
  const insunits = result?.drawing?.insunits;
  const id = selectionKey(selection.id);
  const errors = list(validation.errors);

  if (selection.type === 'room' || selection.type === 'area') {
    const item = lookups.spatial[selection.type]?.bySelection.get(String(selection.id));
    if (!item) return null;
    const handle = selectionKey(item.handle);
    const key = selection.type === 'room' ? 'roomId' : 'areaId';
    return {
      kind: selection.type,
      title: selectionKey(item.aoid) || id,
      subtitle: selection.type === 'room' ? 'Raumpolygon' : 'Geschosspolygon',
      status: normalizedSeverity(item.status),
      rows: spatialFacts(item, selection.type, insunits).filter(Boolean),
      findings: findingsFor(errors, (error) => (
        selectionKey(error?.[key]) === selectionKey(item.id) || errorTouchesHandle(error, handle)
      )),
    };
  }

  if (selection.type === 'layer') {
    const layer = list(result?.layers).find((entry) => selectionKey(entry?.name) === id);
    return {
      kind: 'layer',
      title: id,
      subtitle: 'Layer',
      status: 'success',
      rows: [
        fact('Layername', id, { mono: true }),
        layer?.colorHex ? { label: 'Layerfarbe', value: String(layer.colorHex), mono: true, swatch: layer.colorHex } : null,
        fact('ACI-Index', layer?.colorIndex == null ? '' : decimal(Number(layer.colorIndex), 0), { mono: true }),
        fact('Darstellungselemente', layer?.count == null ? '' : decimal(Number(layer.count), 0)),
      ].filter(Boolean),
      findings: findingsFor(errors, (error) => selectionKey(error?.layer) === id),
    };
  }

  if (selection.type === 'rule') {
    const rule = list(validation.rules).find((entry) => selectionKey(entry?.code) === id);
    const status = rule?.status === 'not-evaluated' || rule?.passed === null ? 'not-evaluated'
      : rule?.status === 'passed' || rule?.passed ? 'success' : normalizedSeverity(rule?.sev);
    return {
      kind: 'rule',
      title: id,
      subtitle: selectionKey(rule?.description) || 'Prüfregel',
      status,
      rows: [
        fact('Regelcode', id, { mono: true }),
        fact('Kategorie', rule?.cat, { mono: true }),
        fact('Schweregrad', rule?.sev === 'error' ? 'Fehler' : rule?.sev === 'warning' ? 'Warnung' : rule?.sev),
        fact('Feststellungen', rule?.errorCount == null ? '' : decimal(Number(rule.errorCount), 0)),
      ].filter(Boolean),
      findings: findingsFor(errors, (error) => selectionKey(error?.ruleCode) === id),
    };
  }

  if (selection.type === 'error') {
    const index = errors.findIndex((entry, position) => errorIdentity(entry, position) === id);
    const error = index >= 0 ? errors[index] : null;
    if (!error) return null;
    const handles = [...new Set([error.handle, ...list(error.handles)].map(selectionKey).filter(Boolean))];
    return {
      kind: 'error',
      title: selectionKey(error.ruleCode) || id,
      subtitle: selectionKey(error.message),
      status: normalizedSeverity(error.severity),
      rows: [
        fact('Regelcode', error.ruleCode, { mono: true }),
        fact('Kategorie', error.category, { mono: true }),
        fact('Layer', error.layer, { mono: true }),
        fact('Betroffene Objekte', handles.length ? decimal(handles.length, 0) : ''),
        fact('Handles', handles.slice(0, 4).join(', ') + (handles.length > 4 ? ' …' : ''), { mono: true }),
      ].filter(Boolean),
      findings: [],
    };
  }

  const items = resolveFindingItems({ handle: id }, lookups.finding).items;
  const primary = items[0];
  if (!primary) return null;
  return {
    kind: 'entity',
    title: id || 'CAD-Objekt',
    subtitle: selectionKey(primary.et) || 'CAD-Objekt',
    status: 'success',
    rows: [
      fact('Handle', id, { mono: true }),
      fact('Objekttyp', primary.et, { mono: true }),
      fact('Layer', primary.l, { mono: true }),
      colorFact(primary),
      ...geometryFacts(primary, insunits),
      items.length > 1 ? fact('Darstellungselemente', `${decimal(items.length, 0)} unter demselben Handle`) : null,
    ].filter(Boolean),
    findings: findingsFor(errors, (error) => errorTouchesHandle(error, id)),
  };
}

/**
 * Attributes of one selected element, exactly as the DWG carries them. Pure and
 * exported so tests and future consumers can assert the contract without a
 * Canvas.
 */
export function planCheckSelectionDetails(selection, result) {
  return buildSelectionDetails(selection, result, {
    spatial: createSpatialLookup(result?.validation || {}),
    finding: createFindingLookup(result?.drawing?.renderList, result?.drawing?.dimensionInfo),
  });
}

export function createPlanCheckViewer({
  root, result, mode = 'rules', hiddenLayers = new Set(), hiddenRooms = new Set(),
  hiddenAreas = new Set(), selection = null,
  filter = 'all', background = 'light', onSelect = () => {}, onAnnounce = () => {},
  onBackgroundChange = () => {}, onAnchor = () => {},
} = {}) {
  if (!root) throw new TypeError('Plan Check viewer root is required');
  const canvas = root.querySelector('[data-plan-check-canvas]');
  const canvasWrap = root.querySelector('[data-plan-check-canvas-wrap]');
  const context = canvas?.getContext?.('2d');
  if (!canvas || !canvasWrap || !context) throw new Error('Canvas 2D is unavailable');

  const abort = new AbortController();
  const { signal } = abort;
  const pointers = new Map();
  let activeResult = result || {};
  let activeMode = mode;
  let activeFilter = filter;
  let activeSelection = selection;
  let hidden = hiddenLayers instanceof Set ? hiddenLayers : new Set(hiddenLayers || []);
  let hiddenRoomIds = hiddenRooms instanceof Set ? hiddenRooms : new Set(hiddenRooms || []);
  let hiddenAreaIds = hiddenAreas instanceof Set ? hiddenAreas : new Set(hiddenAreas || []);
  let backgroundMode = background === 'dark' ? 'dark' : 'light';
  let bounds = drawingBounds(activeResult);
  let camera = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, zoom: 1 };
  let cssWidth = 1;
  let cssHeight = 1;
  let frame = 0;
  let startupFrame = 0;
  let disposed = false;
  let resizeObserver = null;
  let moved = false;
  let pointerStart = null;
  let fullscreenTrigger = null;
  // Last reported attribute-card anchor. The card follows its element through
  // pans and zooms, so the anchor is recomputed per frame but only published
  // when it actually moved on screen.
  let lastAnchor = null;

  const validation = () => activeResult?.validation || {};
  const renderItems = () => list(activeResult?.drawing?.renderList);
  let findingLookup = createFindingLookup(renderItems(), activeResult?.drawing?.dimensionInfo);
  let spatialLookup = createSpatialLookup(validation());
  const displayColorCache = new Map();

  function token(name, fallback) {
    return getComputedStyle(root).getPropertyValue(name).trim() || fallback;
  }

  function palette() {
    const textColor = token('--color-text', 'rgb(31, 41, 55)');
    const negativeText = token('--color-text-negative', 'rgb(255, 255, 255)');
    const surface = token('--color-bg', 'rgb(255, 255, 255)');
    const darkSurface = token('--color-secondary-900', 'rgb(19, 27, 34)');
    const overlay = planCheckCanvasOverlayColors({
      surface: backgroundMode === 'dark' ? darkSurface : surface,
      selectedColor: token('--color-info', 'rgb(59, 130, 246)'),
      errorColor: token('--color-error', 'rgb(229, 57, 64)'),
      warningColor: token('--color-warning', 'rgb(249, 115, 22)'),
      successColor: token('--color-success', 'rgb(16, 185, 129)'),
    });
    return {
      textColor, negativeText, surface, darkSurface, ...overlay,
      // Label pills read against both the drawing and either background.
      labelSurface: backgroundMode === 'dark' ? withAlpha(darkSurface, 0.82) : withAlpha(surface, 0.86),
      labelText: backgroundMode === 'dark' ? negativeText : textColor,
      labelMuted: backgroundMode === 'dark' ? withAlpha(negativeText, 0.72) : withAlpha(textColor, 0.7),
    };
  }

  function viewportPoint(clientX, clientY) {
    const rect = canvasWrap.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function screenToWorld(screenX, screenY, view = camera) {
    return {
      x: (screenX - cssWidth / 2) / view.zoom + view.x,
      y: -(screenY - cssHeight / 2) / view.zoom + view.y,
    };
  }

  function worldToScreen(worldX, worldY, view = camera) {
    return {
      x: (worldX - view.x) * view.zoom + cssWidth / 2,
      y: -(worldY - view.y) * view.zoom + cssHeight / 2,
    };
  }

  function displayColor(value, colors) {
    const fallback = backgroundMode === 'dark' ? colors.negativeText : colors.textColor;
    const surface = backgroundMode === 'dark' ? colors.darkSurface : colors.surface;
    const key = `${String(value || '')}\u0000${surface}\u0000${fallback}`;
    if (displayColorCache.has(key)) return displayColorCache.get(key);
    const resolved = planCheckAccessibleCadColor(value, surface, fallback);
    // ACI drawings normally use at most 256 colors. Bound the cache so a file
    // with per-entity true colors cannot turn contrast handling into a leak.
    if (displayColorCache.size < 1_024) displayColorCache.set(key, resolved);
    return resolved;
  }

  function visibleByFilter(item) {
    return activeFilter === 'all' || normalizedSeverity(item?.status || item?.severity) === activeFilter;
  }

  function spatialSource(type) {
    return spatialLookup[type]?.source || [];
  }

  function spatialForError(error) {
    return resolveFindingSpatialTarget(error, spatialLookup);
  }

  function geometryForError(error) {
    const spatial = spatialForError(error);
    if (spatial) return { entries: [spatial], truncated: false };
    const resolved = resolveFindingItems(error, findingLookup);
    return {
      entries: resolved.items.map((item) => ({ item, type: 'entity' })),
      truncated: resolved.truncated,
    };
  }

  function selectedGeometryDetails() {
    if (!activeSelection) return { entries: [], truncated: false };
    if (activeSelection.type === 'room' || activeSelection.type === 'area') {
      const type = activeSelection.type;
      const match = spatialLookup[type]?.bySelection.get(String(activeSelection.id));
      return { entries: match ? [{ item: match, type }] : [], truncated: false };
    }
    if (activeSelection.type === 'error') {
      const error = list(validation().errors).find((item, index) => errorIdentity(item, index) === String(activeSelection.id));
      return error ? geometryForError(error) : { entries: [], truncated: false };
    }
    if (activeSelection.type === 'rule') {
      const entries = [];
      const seen = new Set();
      let truncated = false;
      for (const error of list(validation().errors)) {
        if (String(error?.ruleCode) !== String(activeSelection.id)) continue;
        const resolved = geometryForError(error);
        truncated ||= resolved.truncated;
        for (const entry of resolved.entries) {
          if (seen.has(entry.item)) continue;
          seen.add(entry.item);
          if (entries.length < PLAN_CHECK_FINDING_SELECTION_LIMIT) entries.push(entry);
          else truncated = true;
        }
      }
      return { entries, truncated };
    }
    if (activeSelection.type === 'layer') {
      if (hidden.has(String(activeSelection.id))) return { entries: [], truncated: false };
      const resolved = resolveFindingItems({ layer: activeSelection.id }, findingLookup);
      return {
        entries: resolved.items.map((item) => ({ item, type: 'entity' })),
        truncated: resolved.truncated,
      };
    }
    const resolved = resolveFindingItems({ handle: activeSelection.id }, findingLookup);
    return {
      entries: resolved.items.map((item) => ({ item, type: 'entity' })),
      truncated: resolved.truncated,
    };
  }

  function selectedGeometry() {
    return selectedGeometryDetails().entries;
  }

  function drawSpatial(item, colors, selectedItem = false) {
    if (!traceVertices(context, item?.vertices, true)) return;
    const status = normalizedSeverity(item?.status);
    const stroke = selectedItem ? colors.selectedColor
      : status === 'error' ? colors.errorColor : status === 'warning' ? colors.warningColor : colors.successColor;
    const fill = selectedItem ? colors.selectedFill
      : status === 'error' ? colors.errorFill : status === 'warning' ? colors.warningFill : colors.successFill;
    context.fillStyle = fill;
    context.strokeStyle = stroke;
    context.lineWidth = (selectedItem ? 4 : 2) / camera.zoom;
    context.fill();
    context.stroke();
  }

  function drawError(error, colors, selectedItem = false) {
    const spatial = spatialForError(error);
    if (spatial) { drawSpatial(spatial.item, colors, selectedItem); return; }
    context.strokeStyle = selectedItem ? colors.selectedColor
      : normalizedSeverity(error?.severity) === 'error' ? colors.errorColor : colors.warningColor;
    context.fillStyle = context.strokeStyle;
    context.lineWidth = (selectedItem ? 5 : 3) / camera.zoom;
    for (const item of resolveFindingItems(error, findingLookup).items) drawItem(context, item, camera.zoom);
  }

  // Rooms and areas the visitor switched off in the register list. Hiding a
  // room hides its overlay AND its label, so the plan matches the list exactly.
  function spatialVisible(type) {
    const hiddenSet = type === 'room' ? hiddenRoomIds : hiddenAreaIds;
    return (item, index) => !hiddenSet.has(spatialIdentity(item, index, type));
  }

  // Identity labels inside the polygons: AOID above, measured area below. Drawn
  // at a fixed screen size after the fills, largest polygon first, and skipped
  // where a label would collide with one already placed — an unreadable stack of
  // overlapping pills is worse than a few missing labels.
  function drawSpatialLabels(items, colors) {
    const placed = [];
    const ordered = [...items].sort((left, right) => (
      (Number(right?.area) || 0) - (Number(left?.area) || 0)
    ));
    const fontSize = 11;
    const worldFont = fontSize / camera.zoom;
    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const item of ordered) {
      const centroid = item?.centroid;
      if (!centroid || !Number.isFinite(Number(centroid.x)) || !Number.isFinite(Number(centroid.y))) continue;
      const identifier = String(item?.aoid || '').trim();
      if (!identifier) continue;
      const areaValue = finite(item?.area, NaN);
      const areaLabel = Number.isFinite(areaValue) ? `${new Intl.NumberFormat('de-CH', { maximumFractionDigits: 1 }).format(areaValue)} m²` : '';
      const screen = worldToScreen(finite(centroid.x), finite(centroid.y));
      const boxWidth = identifier.length * fontSize * 0.62 + 12;
      const boxHeight = fontSize * (areaLabel ? 2.5 : 1.7);
      const box = { x: screen.x - boxWidth / 2, y: screen.y - boxHeight / 2, w: boxWidth, h: boxHeight };
      if (box.x + box.w < 0 || box.y + box.h < 0 || box.x > cssWidth || box.y > cssHeight) continue;
      const collides = placed.some((other) => box.x < other.x + other.w && box.x + box.w > other.x
        && box.y < other.y + other.h && box.y + box.h > other.y);
      if (collides) continue;
      placed.push(box);

      context.save();
      context.translate(finite(centroid.x), finite(centroid.y));
      context.scale(1, -1);
      context.fillStyle = colors.labelSurface;
      context.beginPath();
      context.rect(-boxWidth / 2 / camera.zoom, -boxHeight / 2 / camera.zoom,
        boxWidth / camera.zoom, boxHeight / camera.zoom);
      context.fill();
      context.fillStyle = colors.labelText;
      context.font = `600 ${worldFont}px system-ui, sans-serif`;
      context.fillText(identifier, 0, areaLabel ? -worldFont * 0.25 : 0);
      if (areaLabel) {
        context.font = `${worldFont * 0.72}px system-ui, sans-serif`;
        context.fillStyle = colors.labelMuted;
        context.fillText(areaLabel, 0, worldFont * 0.62);
      }
      context.restore();
    }
    context.restore();
  }

  function updateScale() {
    const line = root.querySelector('[data-plan-check-scale-line]');
    const label = root.querySelector('[data-plan-check-scale-label]');
    if (!line || !label) return;
    let step = SCALE_STEPS[0];
    for (const candidate of SCALE_STEPS) {
      if (candidate * camera.zoom <= 140) step = candidate;
    }
    line.style.width = `${Math.max(1, Math.round(step * camera.zoom))}px`;
    const units = activeResult?.drawing?.insunits;
    const suffix = Number(units) === 4 || /mill/i.test(String(units || '')) ? 'mm'
      : Number(units) === 6 || /met/i.test(String(units || '')) ? 'm' : 'ZE';
    label.textContent = `${new Intl.NumberFormat('de-CH').format(step)} ${suffix}`;
  }

  function render() {
    frame = 0;
    if (disposed) return;
    const colors = palette();
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = backgroundMode === 'dark' ? colors.darkSurface : colors.surface;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();

    context.save();
    const ratio = canvas.width / Math.max(cssWidth, 1);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.translate(cssWidth / 2, cssHeight / 2);
    context.scale(camera.zoom, -camera.zoom);
    context.translate(-camera.x, -camera.y);
    context.lineCap = 'round';
    context.lineJoin = 'round';

    // The room and area registers answer a question about polygons, not about
    // the drawing they sit in. Painting the full CAD content behind them buries
    // the answer under walls, furniture and the title block, so those two
    // registers show validation geometry alone — the same rule the reference
    // checker applies (bbl-dres/plan-check renderer.js: `drawBase`).
    if (!SPATIAL_MODES.has(activeMode)) {
      for (const item of renderItems()) {
        if (hidden.has(String(item?.l || ''))) continue;
        const layerSelected = activeSelection?.type === 'layer';
        const onSelectedLayer = layerSelected && String(item?.l) === String(activeSelection.id);
        context.globalAlpha = layerSelected && !onSelectedLayer ? 0.16 : 1;
        const color = displayColor(item?.c, colors);
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = (onSelectedLayer ? 3 : 1) / camera.zoom;
        drawItem(context, item, camera.zoom);
      }
      context.globalAlpha = 1;
    }

    if (activeMode === 'rooms' || activeMode === 'areas') {
      const type = activeMode === 'rooms' ? 'room' : 'area';
      // Identity is resolved against the SOURCE index so it matches the register
      // list; filtering first would renumber the fallback identities.
      const visible = spatialSource(type)
        .filter((item, index) => visibleByFilter(item) && spatialVisible(type)(item, index));
      visible.forEach((item) => drawSpatial(item, colors));
      drawSpatialLabels(visible, colors);
    } else if (activeMode === 'errors') {
      list(validation().errors).filter(visibleByFilter).forEach((error) => drawError(error, colors));
    } else if (activeMode === 'rules' && activeSelection?.type === 'rule') {
      list(validation().errors).filter((error) => String(error?.ruleCode) === String(activeSelection.id)).forEach((error) => drawError(error, colors));
    }

    for (const entry of selectedGeometry()) {
      if (entry.type === 'room' || entry.type === 'area') drawSpatial(entry.item, colors, true);
      else {
        context.strokeStyle = colors.selectedColor;
        context.fillStyle = colors.selectedColor;
        context.lineWidth = 5 / camera.zoom;
        drawItem(context, entry.item, camera.zoom);
      }
    }
    context.restore();
    updateScale();
    publishAnchor();
  }

  function scheduleRender() {
    if (!frame && !disposed) frame = requestAnimationFrame(render);
  }

  function resize() {
    if (disposed) return;
    const rect = canvasWrap.getBoundingClientRect();
    cssWidth = Math.max(1, rect.width);
    cssHeight = Math.max(1, rect.height);
    const ratio = clamp(window.devicePixelRatio || 1, 1, 2);
    const width = Math.max(1, Math.round(cssWidth * ratio));
    const height = Math.max(1, Math.round(cssHeight * ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    scheduleRender();
  }

  function fit(announce = true, targetBounds = bounds) {
    if (!targetBounds) return;
    const width = Math.max(targetBounds.maxX - targetBounds.minX, Number.EPSILON);
    const height = Math.max(targetBounds.maxY - targetBounds.minY, Number.EPSILON);
    camera.x = (targetBounds.minX + targetBounds.maxX) / 2;
    camera.y = (targetBounds.minY + targetBounds.maxY) / 2;
    camera.zoom = clamp(Math.min((cssWidth * 0.84) / width, (cssHeight * 0.84) / height), MIN_ZOOM, MAX_ZOOM);
    scheduleRender();
    if (announce) onAnnounce('Plan eingepasst.');
  }

  function zoomAt(factor, screenX = cssWidth / 2, screenY = cssHeight / 2, announce = false) {
    const anchor = screenToWorld(screenX, screenY);
    camera.zoom = clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    camera.x = anchor.x - (screenX - cssWidth / 2) / camera.zoom;
    camera.y = anchor.y + (screenY - cssHeight / 2) / camera.zoom;
    scheduleRender();
    if (announce) onAnnounce(factor > 1 ? 'Plan vergr\u00f6ssert.' : 'Plan verkleinert.');
  }

  function selectionBounds() {
    return mergeBounds(selectedGeometry().map((entry) => (
      entry.type === 'room' || entry.type === 'area' ? verticesBounds(entry.item.vertices) : planCheckItemBounds(entry.item)
    )));
  }

  // World anchor of the attribute card. Resolving the selection geometry is the
  // expensive part, so it happens when the selection changes rather than in
  // every animation frame; panning only reprojects this cached point.
  let selectionAnchorWorld = null;
  function refreshSelectionAnchor() {
    const target = activeSelection ? selectionBounds() : null;
    selectionAnchorWorld = target
      ? { x: (target.minX + target.maxX) / 2, y: (target.minY + target.maxY) / 2 } : null;
    lastAnchor = null;
  }

  function publishAnchor() {
    if (!selectionAnchorWorld) {
      if (lastAnchor !== null) { lastAnchor = null; onAnchor(null); }
      return;
    }
    const point = worldToScreen(selectionAnchorWorld.x, selectionAnchorWorld.y);
    const next = {
      x: point.x,
      y: point.y,
      visible: point.x >= 0 && point.y >= 0 && point.x <= cssWidth && point.y <= cssHeight,
    };
    if (lastAnchor && Math.abs(lastAnchor.x - next.x) < 0.5 && Math.abs(lastAnchor.y - next.y) < 0.5
      && lastAnchor.visible === next.visible) return;
    lastAnchor = next;
    onAnchor(next);
  }

  function findAt(worldX, worldY) {
    if (activeMode === 'rooms' || activeMode === 'areas') {
      const type = activeMode === 'rooms' ? 'room' : 'area';
      const source = spatialSource(type);
      for (let index = source.length - 1; index >= 0; index -= 1) {
        const item = source[index];
        if (visibleByFilter(item) && pointInPlanPolygon(worldX, worldY, item?.vertices)) {
          return { type, id: spatialIdentity(item, index, type) };
        }
      }
    }
    if (activeMode === 'errors' || activeMode === 'rules') {
      const errors = list(validation().errors);
      for (let index = errors.length - 1; index >= 0; index -= 1) {
        const error = errors[index];
        if (!visibleByFilter(error)) continue;
        const spatial = spatialForError(error);
        const items = spatial ? [spatial.item] : resolveFindingItems(error, findingLookup).items;
        const hit = spatial ? pointInPlanPolygon(worldX, worldY, spatial.item?.vertices)
          : items.some((item) => planCheckItemDistance(worldX, worldY, item) <= TAP_TOLERANCE / camera.zoom);
        if (hit) return activeMode === 'rules'
          ? { type: 'rule', id: String(error?.ruleCode || '') }
          : { type: 'error', id: errorIdentity(error, index) };
      }
    }
    // Nothing else is painted in the polygon registers, so nothing else can be
    // picked there either — a click must never select an invisible entity.
    if (SPATIAL_MODES.has(activeMode)) return null;
    const items = renderItems();
    const tolerance = TAP_TOLERANCE / camera.zoom;
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (hidden.has(String(item?.l || ''))) continue;
      if (planCheckItemDistance(worldX, worldY, item) <= tolerance) {
        return activeMode === 'layers'
          ? { type: 'layer', id: String(item?.l || '') }
          : { type: 'entity', id: String(item?.handle || '') };
      }
    }
    return null;
  }

  function selectAt(screenX, screenY) {
    const point = screenToWorld(screenX, screenY);
    const next = findAt(point.x, point.y);
    activeSelection = next;
    refreshSelectionAnchor();
    onSelect(next);
    scheduleRender();
    onAnnounce(next ? 'Objekt im Plan ausgew\u00e4hlt.' : 'Auswahl aufgehoben.');
  }

  function updateCoordinates(event) {
    const output = root.querySelector('[data-plan-check-coordinates]');
    if (!output) return;
    const point = viewportPoint(event.clientX, event.clientY);
    const world = screenToWorld(point.x, point.y);
    output.value = `x ${new Intl.NumberFormat('de-CH', { maximumFractionDigits: 2 }).format(world.x)} \u00b7 y ${new Intl.NumberFormat('de-CH', { maximumFractionDigits: 2 }).format(world.y)}`;
  }

  function pointerDown(event) {
    if (event.button !== 0 && event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    // Pointer users should get the same explicit viewer-zoom mode as keyboard
    // users after interacting with the Canvas. Preventing the pointer event's
    // default action can suppress the browser's normal click-to-focus step.
    canvas.focus({ preventScroll: true });
    const point = viewportPoint(event.clientX, event.clientY);
    pointers.set(event.pointerId, point);
    try { canvas.setPointerCapture?.(event.pointerId); } catch { /* Synthetic or detached pointers cannot be captured. */ }
    if (pointers.size === 1) { pointerStart = point; moved = false; }
    event.preventDefault();
  }

  function pointerMove(event) {
    updateCoordinates(event);
    if (!pointers.has(event.pointerId)) return;
    const previousPoints = [...pointers.values()];
    const nextPoint = viewportPoint(event.clientX, event.clientY);
    const previous = pointers.get(event.pointerId);
    pointers.set(event.pointerId, nextPoint);
    const nextPoints = [...pointers.values()];
    if (pointerStart && Math.hypot(nextPoint.x - pointerStart.x, nextPoint.y - pointerStart.y) > TAP_TOLERANCE) moved = true;

    if (nextPoints.length === 1) {
      camera.x -= (nextPoint.x - previous.x) / camera.zoom;
      camera.y += (nextPoint.y - previous.y) / camera.zoom;
    } else if (nextPoints.length >= 2 && previousPoints.length >= 2) {
      moved = true;
      const oldMiddle = { x: (previousPoints[0].x + previousPoints[1].x) / 2, y: (previousPoints[0].y + previousPoints[1].y) / 2 };
      const newMiddle = { x: (nextPoints[0].x + nextPoints[1].x) / 2, y: (nextPoints[0].y + nextPoints[1].y) / 2 };
      const oldDistance = Math.hypot(previousPoints[0].x - previousPoints[1].x, previousPoints[0].y - previousPoints[1].y);
      const newDistance = Math.hypot(nextPoints[0].x - nextPoints[1].x, nextPoints[0].y - nextPoints[1].y);
      const anchor = screenToWorld(oldMiddle.x, oldMiddle.y);
      if (oldDistance && newDistance) camera.zoom = clamp(camera.zoom * (newDistance / oldDistance), MIN_ZOOM, MAX_ZOOM);
      camera.x = anchor.x - (newMiddle.x - cssWidth / 2) / camera.zoom;
      camera.y = anchor.y + (newMiddle.y - cssHeight / 2) / camera.zoom;
    }
    scheduleRender();
    event.preventDefault();
  }

  function pointerEnd(event) {
    if (!pointers.has(event.pointerId)) return;
    const point = pointers.get(event.pointerId);
    const wasSingle = pointers.size === 1;
    pointers.delete(event.pointerId);
    try { canvas.releasePointerCapture?.(event.pointerId); } catch { /* Capture may already be gone. */ }
    if (wasSingle && !moved && event.type === 'pointerup') selectAt(point.x, point.y);
    if (!pointers.size) { pointerStart = null; moved = false; }
    event.preventDefault();
  }

  function wheel(event) {
    // Preserve browser zoom and ordinary page scrolling. Wheel-to-zoom becomes
    // an explicit viewer gesture once the keyboard-focusable Canvas is active.
    if (event.ctrlKey || event.metaKey || document.activeElement !== canvas) return;
    event.preventDefault();
    const point = viewportPoint(event.clientX, event.clientY);
    zoomAt(event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP, point.x, point.y);
  }

  function keyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const pan = (event.shiftKey ? 160 : 48) / camera.zoom;
    if (event.key === 'ArrowLeft') camera.x -= pan;
    else if (event.key === 'ArrowRight') camera.x += pan;
    else if (event.key === 'ArrowUp') camera.y += pan;
    else if (event.key === 'ArrowDown') camera.y -= pan;
    else if (event.key === '+' || event.key === '=') zoomAt(ZOOM_STEP, undefined, undefined, true);
    else if (event.key === '-' || event.key === '_') zoomAt(1 / ZOOM_STEP, undefined, undefined, true);
    else if (event.key === 'Home' || event.key.toLowerCase() === 'f') fit(true);
    else if (event.key === 'Enter' || event.key === ' ') selectAt(cssWidth / 2, cssHeight / 2);
    // Escape dismisses the attribute card without leaving the Canvas, matching
    // the way every other dismissible surface in the portal behaves.
    else if (event.key === 'Escape') {
      if (!activeSelection) return;
      activeSelection = null;
      refreshSelectionAnchor();
      onSelect(null);
      onAnnounce('Auswahl aufgehoben.');
    } else return;
    event.preventDefault();
    scheduleRender();
  }

  function setBackground(next, announce = true, immediate = false) {
    backgroundMode = next === 'dark' ? 'dark' : 'light';
    displayColorCache.clear();
    root.classList.toggle('plan-check-viewer--dark', backgroundMode === 'dark');
    const button = root.querySelector('[data-viewer-action="background"]');
    button?.setAttribute('aria-pressed', String(backgroundMode === 'dark'));
    onBackgroundChange(backgroundMode);
    if (immediate) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      render();
    } else scheduleRender();
    if (announce) onAnnounce(backgroundMode === 'dark' ? 'Dunkler Planhintergrund.' : 'Heller Planhintergrund.');
  }

  async function toggleFullscreen(trigger) {
    if (!document.fullscreenEnabled || !root.requestFullscreen) {
      onAnnounce('Vollbild wird von diesem Browser nicht unterst\u00fctzt.');
      return false;
    }
    try {
      if (document.fullscreenElement === root) await document.exitFullscreen();
      else {
        fullscreenTrigger = trigger || document.activeElement;
        await root.requestFullscreen();
      }
      return true;
    } catch {
      onAnnounce('Vollbild konnte nicht ge\u00f6ffnet werden.');
      return false;
    }
  }

  function fullscreenChanged() {
    const active = document.fullscreenElement === root;
    root.classList.toggle('plan-check-viewer--fullscreen', active);
    const button = root.querySelector('[data-viewer-action="fullscreen"]');
    button?.setAttribute('aria-pressed', String(active));
    button?.setAttribute('aria-label', active ? 'Vollbild beenden' : 'Plan im Vollbild anzeigen');
    resize();
    onAnnounce(active ? 'Plan im Vollbild.' : 'Vollbild beendet.');
    if (!active && fullscreenTrigger?.isConnected) {
      fullscreenTrigger.focus({ preventScroll: true });
      fullscreenTrigger = null;
    }
  }

  function toolbarClick(event) {
    const button = event.target.closest?.('[data-viewer-action]');
    if (!button || !root.contains(button)) return;
    const action = button.dataset.viewerAction;
    if (action === 'fit') fit();
    else if (action === 'zoom-in') zoomAt(ZOOM_STEP, undefined, undefined, true);
    else if (action === 'zoom-out') zoomAt(1 / ZOOM_STEP, undefined, undefined, true);
    else if (action === 'focus-selection') {
      const target = selectionBounds();
      if (target) { fit(false, target); onAnnounce('Auf die Auswahl gezoomt.'); }
      else onAnnounce('Es ist kein Objekt ausgewählt, auf das gezoomt werden kann.');
    } else if (action === 'background') setBackground(backgroundMode === 'dark' ? 'light' : 'dark');
    else if (action === 'fullscreen') toggleFullscreen(button);
  }

  canvas.addEventListener('pointerdown', pointerDown, { signal });
  canvas.addEventListener('pointermove', pointerMove, { signal });
  canvas.addEventListener('pointerup', pointerEnd, { signal });
  canvas.addEventListener('pointercancel', pointerEnd, { signal });
  canvas.addEventListener('lostpointercapture', pointerEnd, { signal });
  canvas.addEventListener('wheel', wheel, { passive: false, signal });
  canvas.addEventListener('keydown', keyDown, { signal });
  root.addEventListener('click', toolbarClick, { signal });
  document.addEventListener('fullscreenchange', fullscreenChanged, { signal });
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvasWrap);
  } else window.addEventListener('resize', resize, { signal });

  setBackground(backgroundMode, false);
  refreshSelectionAnchor();
  resize();
  startupFrame = requestAnimationFrame(() => {
    startupFrame = 0;
    if (!disposed) { resize(); fit(false); }
  });

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      resizeObserver?.disconnect();
      pointers.clear();
      if (frame) cancelAnimationFrame(frame);
      if (startupFrame) cancelAnimationFrame(startupFrame);
      frame = 0;
      startupFrame = 0;
      if (document.fullscreenElement === root) document.exitFullscreen?.().catch(() => {});
    },
    fit,
    focusSelection() {
      const target = selectionBounds();
      if (target) fit(false, target);
    },
    getView() { return { ...camera, background: backgroundMode }; },
    /** Last published screen anchor of the selection, or null when there is none. */
    getAnchor() { return lastAnchor ? { ...lastAnchor } : null; },
    /** Attributes of the current selection, plus whether highlighting was capped. */
    inspection() {
      const details = buildSelectionDetails(activeSelection, activeResult, {
        spatial: spatialLookup, finding: findingLookup,
      });
      return details ? { ...details, truncated: selectedGeometryDetails().truncated } : null;
    },
    setBackground,
    setData(nextResult, { preserveView = false } = {}) {
      activeResult = nextResult || {};
      bounds = drawingBounds(activeResult);
      findingLookup = createFindingLookup(renderItems(), activeResult?.drawing?.dimensionInfo);
      spatialLookup = createSpatialLookup(validation());
      displayColorCache.clear();
      refreshSelectionAnchor();
      if (!preserveView) fit(false);
      else scheduleRender();
    },
    setFilter(nextFilter) { activeFilter = nextFilter || 'all'; scheduleRender(); },
    setHiddenLayers(nextHidden) {
      hidden = nextHidden instanceof Set ? nextHidden : new Set(nextHidden || []);
      refreshSelectionAnchor();
      scheduleRender();
    },
    setHiddenSpatial(type, nextHidden) {
      const next = nextHidden instanceof Set ? nextHidden : new Set(nextHidden || []);
      if (type === 'area') hiddenAreaIds = next; else hiddenRoomIds = next;
      scheduleRender();
    },
    /**
     * PNG of the plan in one register, fitted to the drawing and rendered
     * synchronously so the caller gets pixels back immediately. The live view
     * (mode, camera, selection) is restored before returning, so exporting a
     * report never disturbs what the visitor is looking at.
     */
    snapshot(nextMode = activeMode, { maxWidth = 1600 } = {}) {
      if (disposed || !cssWidth || !cssHeight) return '';
      const previous = {
        mode: activeMode,
        selection: activeSelection,
        camera: { ...camera },
      };
      try {
        activeMode = nextMode;
        activeSelection = null;
        fit(false);
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        render();
        // Flatten onto an opaque surface and cap the width. A transparent,
        // retina-sized canvas embeds as a raw RGBA bitmap and turns a report
        // into megabytes; an opaque, page-sized PNG of the same plan is a few
        // hundred kilobytes at a resolution print cannot tell apart.
        if (typeof document === 'undefined') return canvas.toDataURL('image/png');
        const width = Math.min(canvas.width, maxWidth);
        const flat = document.createElement('canvas');
        flat.width = Math.max(1, Math.round(width));
        flat.height = Math.max(1, Math.round((canvas.height / canvas.width) * width));
        const flatContext = flat.getContext('2d');
        if (!flatContext) return canvas.toDataURL('image/png');
        const colors = palette();
        flatContext.fillStyle = backgroundMode === 'dark' ? colors.darkSurface : colors.surface;
        flatContext.fillRect(0, 0, flat.width, flat.height);
        flatContext.imageSmoothingQuality = 'high';
        flatContext.drawImage(canvas, 0, 0, flat.width, flat.height);
        return flat.toDataURL('image/png');
      } catch {
        return '';
      } finally {
        activeMode = previous.mode;
        activeSelection = previous.selection;
        camera.x = previous.camera.x;
        camera.y = previous.camera.y;
        camera.zoom = previous.camera.zoom;
        refreshSelectionAnchor();
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        render();
      }
    },
    setMode(nextMode) { activeMode = nextMode || 'rules'; scheduleRender(); },
    setSelection(nextSelection, { focus = false } = {}) {
      activeSelection = nextSelection || null;
      const details = selectedGeometryDetails();
      refreshSelectionAnchor();
      if (focus) {
        const target = mergeBounds(details.entries.map((entry) => (
          entry.type === 'room' || entry.type === 'area' ? verticesBounds(entry.item.vertices) : planCheckItemBounds(entry.item)
        )));
        if (target) fit(false, target); else scheduleRender();
      } else scheduleRender();
      return { count: details.entries.length, truncated: details.truncated };
    },
    toggleFullscreen,
    zoomBy(factor) { zoomAt(factor, undefined, undefined, true); },
  };
}

export default createPlanCheckViewer;
