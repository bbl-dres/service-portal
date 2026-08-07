// Pure geometry shared by validation, commands and renderers. Placement x/y
// describe the unrotated top-left corner; rotation happens around its centre.

const toFinite = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function placementFootprintCorners(placement = {}) {
  const x = toFinite(placement.x);
  const y = toFinite(placement.y);
  const rawWidth = toFinite(placement.width);
  const rawDepth = toFinite(placement.depth);
  const rotation = toFinite(placement.rotation ?? 0);
  if ([x, y, rawWidth, rawDepth, rotation].some((value) => value === null)
    || rawWidth <= 0 || rawDepth <= 0) return null;

  // This matches the minimum dimensions used by both SVG and Three.js.
  const width = Math.max(18, rawWidth);
  const depth = Math.max(18, rawDepth);
  const centreX = x + width / 2;
  const centreY = y + depth / 2;
  const radians = rotation * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ].map(([dx, dy]) => ({
    x: centreX + dx * cosine - dy * sine,
    y: centreY + dx * sine + dy * cosine,
  }));
}

export function placementFootprintBounds(placement = {}) {
  const corners = placementFootprintCorners(placement);
  if (!corners) return null;
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centreX: (minX + maxX) / 2,
    centreY: (minY + maxY) / 2,
  };
}

export function placementFootprintInsideFloor(placement, floor, epsilon = 1e-6) {
  const bounds = placementFootprintBounds(placement);
  const floorWidth = toFinite(floor?.extent?.[0]);
  const floorHeight = toFinite(floor?.extent?.[1]);
  if (!bounds || floorWidth === null || floorHeight === null || floorWidth <= 0 || floorHeight <= 0) return false;
  const tolerance = Math.max(0, Number(epsilon) || 0);
  return bounds.minX >= -tolerance
    && bounds.minY >= -tolerance
    && bounds.maxX <= floorWidth + tolerance
    && bounds.maxY <= floorHeight + tolerance;
}

export default {
  placementFootprintCorners,
  placementFootprintBounds,
  placementFootprintInsideFloor,
};
