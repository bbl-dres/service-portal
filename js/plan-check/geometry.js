import { LIMITS, finiteNumber, resourceLimit } from './config.js';

const point = (value) => ({
  x: finiteNumber(value?.x),
  y: finiteNumber(value?.y),
  ...(value?.bulge == null ? {} : { bulge: finiteNumber(value.bulge) }),
});

export function normalizeVertices(vertices, limit = LIMITS.verticesPerPrimitive) {
  if (!Array.isArray(vertices)) return [];
  if (vertices.length > limit) {
    throw resourceLimit(`Eine Geometrie überschreitet ${limit} Stützpunkte.`, {
      actual: vertices.length,
      limit,
    });
  }
  return vertices.map(point);
}

export function computePolygonArea(vertices) {
  const verts = Array.isArray(vertices) ? vertices : [];
  if (verts.length < 3) return 0;
  let twiceArea = 0;
  for (let index = 0; index < verts.length; index += 1) {
    const next = (index + 1) % verts.length;
    twiceArea += finiteNumber(verts[index]?.x) * finiteNumber(verts[next]?.y);
    twiceArea -= finiteNumber(verts[next]?.x) * finiteNumber(verts[index]?.y);
  }
  return finiteNumber(Math.abs(twiceArea) / 2);
}

export function pointInPolygon(x, y, vertices) {
  const px = finiteNumber(x);
  const py = finiteNumber(y);
  const verts = Array.isArray(vertices) ? vertices : [];
  let inside = false;
  for (let index = 0, previous = verts.length - 1; index < verts.length; previous = index, index += 1) {
    const xi = finiteNumber(verts[index]?.x);
    const yi = finiteNumber(verts[index]?.y);
    const xj = finiteNumber(verts[previous]?.x);
    const yj = finiteNumber(verts[previous]?.y);
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const startX = finiteNumber(x1);
  const startY = finiteNumber(y1);
  const dx = finiteNumber(x2) - startX;
  const dy = finiteNumber(y2) - startY;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-12) return Math.hypot(finiteNumber(px) - startX, finiteNumber(py) - startY);
  const ratio = Math.max(0, Math.min(1,
    ((finiteNumber(px) - startX) * dx + (finiteNumber(py) - startY) * dy) / lengthSquared));
  return Math.hypot(finiteNumber(px) - (startX + ratio * dx), finiteNumber(py) - (startY + ratio * dy));
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

export function segmentsIntersect(aValue, bValue, cValue, dValue) {
  const a = point(aValue);
  const b = point(bValue);
  const c = point(cValue);
  const d = point(dValue);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  const firstLength = Math.hypot(b.x - a.x, b.y - a.y);
  const secondLength = Math.hypot(d.x - c.x, d.y - c.y);
  const crossTolerance = Math.max(1, firstLength * secondLength) * 1e-10;
  const coordinateTolerance = Math.max(1, firstLength, secondLength) * 1e-10;
  const sign = (value) => value > crossTolerance ? 1 : value < -crossTolerance ? -1 : 0;
  const onSegment = (start, end, candidate) => (
    candidate.x >= Math.min(start.x, end.x) - coordinateTolerance
    && candidate.x <= Math.max(start.x, end.x) + coordinateTolerance
    && candidate.y >= Math.min(start.y, end.y) - coordinateTolerance
    && candidate.y <= Math.max(start.y, end.y) + coordinateTolerance
  );
  const s1 = sign(d1);
  const s2 = sign(d2);
  const s3 = sign(d3);
  const s4 = sign(d4);
  if (s1 !== s2 && s1 && s2 && s3 !== s4 && s3 && s4) return true;
  return (!s1 && onSegment(c, d, a))
    || (!s2 && onSegment(c, d, b))
    || (!s3 && onSegment(a, b, c))
    || (!s4 && onSegment(a, b, d));
}

export function hasSelfIntersection(vertices, options = {}) {
  const verts = Array.isArray(vertices) ? vertices : [];
  if (verts.length < 4) return false;
  const maximum = options.maxComparisons ?? LIMITS.selfIntersectionComparisons;
  let comparisons = 0;
  for (let first = 0; first < verts.length; first += 1) {
    const firstNext = (first + 1) % verts.length;
    for (let second = first + 2; second < verts.length; second += 1) {
      if (first === 0 && second === verts.length - 1) continue;
      comparisons += 1;
      if (comparisons > maximum) {
        throw resourceLimit('Die Prüfung auf Selbstüberschneidungen überschreitet das Rechenlimit.', {
          maximum,
        });
      }
      const secondNext = (second + 1) % verts.length;
      if (segmentsIntersect(verts[first], verts[firstNext], verts[second], verts[secondNext])) return true;
    }
  }
  return false;
}

export function hashVertices(vertices) {
  const points = (Array.isArray(vertices) ? vertices : [])
    .map((vertex) => `${Math.round(finiteNumber(vertex?.x) * 10)},${Math.round(finiteNumber(vertex?.y) * 10)}`);
  if (points.length > 1 && points[0] === points.at(-1)) points.pop();
  if (points.length < 2) return points.join('|');

  const minimalRotation = (values) => {
    const length = values.length;
    let left = 0;
    let right = 1;
    let offset = 0;
    while (left < length && right < length && offset < length) {
      const a = values[(left + offset) % length];
      const b = values[(right + offset) % length];
      if (a === b) { offset += 1; continue; }
      if (a > b) {
        left += offset + 1;
        if (left <= right) left = right + 1;
      } else {
        right += offset + 1;
        if (right <= left) right = left + 1;
      }
      offset = 0;
    }
    const start = Math.min(left, right) % length;
    return Array.from({ length }, (_, index) => values[(start + index) % length]).join('|');
  };

  const forward = minimalRotation(points);
  const reverse = minimalRotation([...points].reverse());
  return forward < reverse ? forward : reverse;
}

export function visualCenter(vertices, { consume } = {}) {
  const verts = normalizeVertices(vertices);
  const charge = typeof consume === 'function' ? consume : () => {};
  if (verts.length < 3) {
    const total = verts.reduce((sum, vertex) => ({ x: sum.x + vertex.x, y: sum.y + vertex.y }), { x: 0, y: 0 });
    return { x: total.x / (verts.length || 1), y: total.y / (verts.length || 1) };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const vertex of verts) {
    minX = Math.min(minX, vertex.x);
    minY = Math.min(minY, vertex.y);
    maxX = Math.max(maxX, vertex.x);
    maxY = Math.max(maxY, vertex.y);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  if (width < 1e-10 && height < 1e-10) return { x: minX, y: minY };

  const contains = (x, y) => {
    charge(verts.length);
    return pointInPolygon(x, y, verts);
  };
  const cheapInteriorPoint = () => {
    const centroid = verts.reduce((sum, vertex) => ({ x: sum.x + vertex.x, y: sum.y + vertex.y }), { x: 0, y: 0 });
    const candidate = { x: centroid.x / verts.length, y: centroid.y / verts.length };
    if (contains(candidate.x, candidate.y)) return candidate;
    const midpoint = { x: minX + width / 2, y: minY + height / 2 };
    return contains(midpoint.x, midpoint.y) ? midpoint : { x: verts[0].x, y: verts[0].y };
  };

  // Polylabel-style refinement is O(vertices * iterations). Large CAD
  // polygons use a deterministic interior fallback; smaller ones share a hard
  // segment-check budget so a single shape cannot monopolise the worker.
  if (verts.length > LIMITS.visualCenterRefinementVertices) return cheapInteriorPoint();

  const signedDistance = (x, y) => {
    charge(verts.length);
    let distance = Infinity;
    for (let index = 0, previous = verts.length - 1; index < verts.length; previous = index, index += 1) {
      distance = Math.min(distance, distancePointToSegment(x, y,
        verts[index].x, verts[index].y, verts[previous].x, verts[previous].y));
    }
    return contains(x, y) ? distance : -distance;
  };

  const cellSize = Math.min(width, height);
  const initialCellCount = Math.ceil(width / cellSize) * Math.ceil(height / cellSize);
  if (!Number.isFinite(initialCellCount) || initialCellCount > 1_024) {
    return cheapInteriorPoint();
  }
  const checksPerDistance = verts.length * 2;
  const initialChecks = (initialCellCount + 1) * checksPerDistance;
  if (initialChecks > LIMITS.visualCenterSegmentChecks) return cheapInteriorPoint();
  const refinementLimit = Math.min(LIMITS.visualCenterRefinementIterations, Math.max(0, Math.floor(
    (LIMITS.visualCenterSegmentChecks - initialChecks) / (checksPerDistance * 4)
  )));
  let half = cellSize / 2;
  const precision = Math.max(cellSize * 0.01, 1e-9);
  const queue = [];
  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      const centerX = x + half;
      const centerY = y + half;
      const distance = signedDistance(centerX, centerY);
      queue.push({ x: centerX, y: centerY, half, distance, maximum: distance + half * Math.SQRT2 });
    }
  }

  const centroid = verts.reduce((sum, vertex) => ({ x: sum.x + vertex.x, y: sum.y + vertex.y }), { x: 0, y: 0 });
  let bestX = centroid.x / verts.length;
  let bestY = centroid.y / verts.length;
  let bestDistance = signedDistance(bestX, bestY);
  queue.sort((a, b) => a.maximum - b.maximum);

  let iterations = 0;
  while (queue.length && iterations < refinementLimit) {
    iterations += 1;
    const cell = queue.pop();
    if (cell.distance > bestDistance) {
      bestDistance = cell.distance;
      bestX = cell.x;
      bestY = cell.y;
    }
    if (cell.maximum - bestDistance <= precision) continue;
    half = cell.half / 2;
    for (const [offsetX, offsetY] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const x = cell.x + offsetX * half;
      const y = cell.y + offsetY * half;
      const distance = signedDistance(x, y);
      const child = { x, y, half, distance, maximum: distance + half * Math.SQRT2 };
      let low = 0;
      let high = queue.length;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (queue[middle].maximum < child.maximum) low = middle + 1;
        else high = middle;
      }
      queue.splice(low, 0, child);
    }
  }
  return { x: finiteNumber(bestX), y: finiteNumber(bestY) };
}

export function computeKpis(rooms, areas) {
  const roomList = Array.isArray(rooms) ? rooms : [];
  const areaList = Array.isArray(areas) ? areas : [];
  const areaValue = (value) => value == null || value === '' || typeof value === 'boolean'
    ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  const measuredRoomAreas = roomList.map((room) => areaValue(room?.area)).filter((value) => value !== null);
  const roomPolygonArea = measuredRoomAreas.length
    ? finiteNumber(measuredRoomAreas.reduce((sum, value) => sum + value, 0)) : null;
  const categoryTotals = { HNF: 0, NNF: 0, VF: 0, FF: 0 };
  const categoriesComplete = roomList.length > 0 && roomList.every((room) => (
    Object.hasOwn(categoryTotals, room?.siaCategory) && areaValue(room?.area) !== null
  ));
  if (categoriesComplete) {
    for (const room of roomList) categoryTotals[room.siaCategory] += areaValue(room.area);
  }
  const hnf = categoriesComplete ? finiteNumber(categoryTotals.HNF) : null;
  const nnf = categoriesComplete ? finiteNumber(categoryTotals.NNF) : null;
  const vf = categoriesComplete ? finiteNumber(categoryTotals.VF) : null;
  const ff = categoriesComplete ? finiteNumber(categoryTotals.FF) : null;
  const nf = categoriesComplete ? finiteNumber(hnf + nnf) : null;
  const ngf = categoriesComplete ? finiteNumber(nf + vf + ff) : null;
  const measuredFloorAreas = areaList.map((area) => areaValue(area?.area)).filter((value) => value !== null);
  const gf = measuredFloorAreas.length
    ? finiteNumber(measuredFloorAreas.reduce((sum, value) => sum + value, 0)) : null;
  const kf = gf !== null && ngf !== null ? finiteNumber(gf - ngf) : null;
  return {
    hnf, nnf, vf, ff, nf, ngf, gf, kf, roomPolygonArea,
    categoryTotals: categoriesComplete ? categoryTotals : {},
  };
}
