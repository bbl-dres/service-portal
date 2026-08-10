// The transform widget for a selected furniture placement.
//
// One anatomy, two renderers. The 2D plan draws it as SVG in plan coordinates
// and the 3D view lays the same circle flat on the floor, so moving and rotating
// look and behave the same in both and nobody has to relearn the interaction
// when switching views:
//
//   · the ring is the rotation track, drawn around the object;
//   · the handle on the ring sits at the object's own front and is dragged to
//     rotate — it therefore also reads as «which way does this face»;
//   · the dot in the middle is dragged to move.
//
// Everything here is pure and expressed in plan units (centimetres), because
// that is the only coordinate system both renderers share. The 3D view converts
// to metres on the way out; the 2D view uses the numbers unchanged.

/** Distance between the object's bounding circle and the ring, in plan units. */
export const WIDGET_GAP = 45;
/** Smallest ring that still separates its two handles at any zoom. */
export const WIDGET_MIN_RADIUS = 70;
/**
 * The only rotations the document model accepts (commands.js/validRotation), so
 * the widget can never produce a placement the editor would refuse to store.
 */
export const ROTATION_STEP = 45;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

/** Centre, ring radius and handle positions of the widget, all in plan units. */
export function widgetGeometry(placement) {
  if (!placement) return null;
  const width = Math.max(18, finite(placement.width, 60));
  const depth = Math.max(18, finite(placement.depth, 60));
  const cx = finite(placement.x) + width / 2;
  const cy = finite(placement.y) + depth / 2;
  const rotation = finite(placement.rotation);
  const radius = Math.max(WIDGET_MIN_RADIUS, Math.hypot(width, depth) / 2 + WIDGET_GAP);
  // Plan y grows downwards, so the object's front (its local −Y) is «up» on the
  // sheet at rotation 0 and the handle travels clockwise from there.
  const radians = (rotation - 90) * Math.PI / 180;
  return {
    cx, cy, radius, rotation, width, depth,
    handle: {
      x: cx + Math.cos(radians) * radius,
      y: cy + Math.sin(radians) * radius,
    },
  };
}

/**
 * The rotation a pointer at (x, y) implies, snapped to a step the model accepts.
 * Returns a whole number in [0, 360).
 */
export function rotationFromPoint(cx, cy, x, y, step = ROTATION_STEP) {
  const safeStep = Number.isFinite(step) && step > 0 ? step : ROTATION_STEP;
  const degrees = (Math.atan2(finite(y) - finite(cy), finite(x) - finite(cx)) * 180) / Math.PI + 90;
  const snapped = Math.round(degrees / safeStep) * safeStep;
  return ((Math.round(snapped) % 360) + 360) % 360;
}

/** Top-left of a placement whose centre is moved to (cx, cy). */
export function originFromCentre(placement, cx, cy) {
  const width = Math.max(18, finite(placement?.width, 60));
  const depth = Math.max(18, finite(placement?.depth, 60));
  return { x: finite(cx) - width / 2, y: finite(cy) - depth / 2 };
}
