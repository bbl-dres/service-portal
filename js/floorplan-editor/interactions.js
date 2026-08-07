// Pure input-policy and room-drag helpers for the floor-plan workbench.
//
// Browser event ownership, document mutation and announcements stay in the
// controller. Keeping the calculations here makes pointer/keyboard behavior a
// narrow, testable seam as authoring tools grow.

const ARROWS = Object.freeze({
  ArrowLeft: Object.freeze([-1, 0]),
  ArrowRight: Object.freeze([1, 0]),
  ArrowUp: Object.freeze([0, -1]),
  ArrowDown: Object.freeze([0, 1]),
});

const finitePoint = (point) => point
  && Number.isFinite(point.x)
  && Number.isFinite(point.y);

/** Return accepted pointer-button intent, or null when this tool ignores it. */
export function pointerButtons(event, tool = 'select') {
  const button = Number(event?.button);
  if (button !== 0 && button !== 1) return null;
  const primary = button === 0;
  const middle = button === 1;
  return { primary, middle };
}

export function movementExceeded(start, current, threshold = 3) {
  return finitePoint(start) && finitePoint(current)
    && Number.isFinite(threshold) && threshold >= 0
    && Math.hypot(current.x - start.x, current.y - start.y) > threshold;
}

export function pointerDragTolerance(pointerType = 'mouse') {
  if (pointerType === 'touch') return 10;
  if (pointerType === 'pen') return 6;
  return 4;
}

/**
 * Convert WheelEvent units into a smooth, multiplicative zoom factor.
 * Sign-only zoom steps make high-resolution trackpads feel sluggish while
 * making conventional wheel notches abrupt; the exponential mapping gives
 * both devices the same continuous zoom curve.
 */
export function wheelZoomFactor(event, {
  linePixels = 16,
  pagePixels = 800,
  sensitivity = .0015,
  minimum = .5,
  maximum = 2,
} = {}) {
  const deltaY = Number(event?.deltaY);
  if (!Number.isFinite(deltaY) || deltaY === 0) return 1;
  const mode = Number(event?.deltaMode) || 0;
  const line = Number.isFinite(Number(linePixels)) && Number(linePixels) > 0 ? Number(linePixels) : 16;
  const page = Number.isFinite(Number(pagePixels)) && Number(pagePixels) > 0 ? Number(pagePixels) : 800;
  const scale = mode === 1 ? line : mode === 2 ? page : 1;
  const speed = Number.isFinite(Number(sensitivity)) && Number(sensitivity) > 0
    ? Number(sensitivity)
    : .0015;
  const lower = Number.isFinite(Number(minimum)) && Number(minimum) > 0 ? Number(minimum) : .5;
  const upper = Number.isFinite(Number(maximum)) && Number(maximum) >= lower
    ? Number(maximum)
    : Math.max(2, lower);
  const exponent = Math.max(Math.log(lower), Math.min(Math.log(upper), deltaY * scale * speed));
  return Math.exp(exponent);
}

export function arrowDirection(key) {
  const direction = ARROWS[key];
  return direction ? [...direction] : null;
}

/** Resolve the next item in an ARIA-style horizontal/vertical roving group. */
export function rovingIndex(key, index, length) {
  if (!Number.isInteger(index) || !Number.isInteger(length) || length < 1
    || index < 0 || index >= length) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % length;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + length) % length;
  return null;
}

export function keyboardPanDelta(camera, key, fine = false) {
  const direction = arrowDirection(key);
  if (!direction || !Number.isFinite(camera?.width) || !Number.isFinite(camera?.height)) return null;
  const factor = fine ? 0.02 : 0.08;
  return {
    x: direction[0] * camera.width * factor,
    y: direction[1] * camera.height * factor,
  };
}

export function roomRectFromDrag(start, point, extent) {
  if (!finitePoint(start) || !finitePoint(point)
    || !Array.isArray(extent) || extent.length !== 2
    || !extent.every(Number.isFinite)) return null;
  const [floorWidth, floorHeight] = extent;
  const x1 = Math.max(0, Math.min(floorWidth, start.x));
  const y1 = Math.max(0, Math.min(floorHeight, start.y));
  const x2 = Math.max(0, Math.min(floorWidth, point.x));
  const y2 = Math.max(0, Math.min(floorHeight, point.y));
  return [Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)];
}

/** Calculate a clamped room move/resize without touching the editor document. */
export function transformRoomRect({
  type, rect, handle = '', start, point, extent, minimum = 100,
}) {
  if (!['room-move', 'room-resize'].includes(type)
    || !Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite)
    || !finitePoint(start) || !finitePoint(point)
    || !Array.isArray(extent) || extent.length !== 2 || !extent.every(Number.isFinite)
    || !Number.isFinite(minimum) || minimum <= 0) return null;
  const [floorWidth, floorHeight] = extent;
  let [x, y, width, height] = rect;
  if (type === 'room-move') {
    x = Math.max(0, Math.min(floorWidth - width, rect[0] + point.x - start.x));
    y = Math.max(0, Math.min(floorHeight - height, rect[1] + point.y - start.y));
  } else {
    let left = x, top = y, right = x + width, bottom = y + height;
    if (handle.includes('w')) left = Math.max(0, Math.min(point.x, right - minimum));
    if (handle.includes('e')) right = Math.min(floorWidth, Math.max(point.x, left + minimum));
    if (handle.includes('n')) top = Math.max(0, Math.min(point.y, bottom - minimum));
    if (handle.includes('s')) bottom = Math.min(floorHeight, Math.max(point.y, top + minimum));
    x = left; y = top; width = right - left; height = bottom - top;
  }
  return {
    rect: [x, y, width, height],
    dx: x - rect[0],
    dy: y - rect[1],
  };
}
