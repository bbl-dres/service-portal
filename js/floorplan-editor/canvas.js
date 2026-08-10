// SVG scene for the standalone floor-plan editor.
//
// The shared js/ui/floorplan.js deliberately stays a small, read-only renderer for
// Tenancies and Workspace. Authoring needs a camera, furniture positions and
// measurement overlays, so it gets a separate scene without changing those
// stable consumers. Coordinates use the portal floor convention: 100 units = 1 m.

import { escape as esc } from '../components.js';
import { formatArea, formatNumber } from '../format.js';
import { EDITOR_COLOR_MODES, createColorContext, roomColor } from './colors.js';
import { placementFootprintBounds } from './geometry.js';
import { widgetGeometry } from './transform-widget.js';

export { EDITOR_COLOR_MODES } from './colors.js';

const compactRoomNumber = (value) => String(value || '').replace(/^.*\s/, '');

function roomMarkup(room, selected, mode, colorContext, editable = false) {
  const [x, y, width, height] = room.rect;
  const showNumber = width >= 200 && height >= 200;
  const showUse = width >= 500 && height >= 390;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const lines = [showNumber && compactRoomNumber(room.roomNumber), showUse && room.useLabel].filter(Boolean);
  const firstY = cy - ((lines.length - 1) * 56) / 2 + 18;
  const label = `${room.roomNumber}, ${room.useLabel}, ${room.area} Quadratmeter`;
  const handles = selected && editable ? [
    ['nw', x, y], ['n', cx, y], ['ne', x + width, y],
    ['e', x + width, cy], ['se', x + width, y + height], ['s', cx, y + height],
    ['sw', x, y + height], ['w', x, cy],
  ].map(([handle, hx, hy]) => `<g class="fpe-room__handle" data-room-handle="${handle}" transform="translate(${hx} ${hy})">
      <circle class="fpe-room__handle-hit" r="40"></circle>
      <circle class="fpe-room__handle-visual" r="18"></circle>
    </g>`).join('') : '';
  return `<g class="fpe-room${selected ? ' is-selected' : ''}" data-entity="room" data-id="${esc(room.spaceId)}"
      tabindex="0" role="button" aria-pressed="${selected}" aria-label="${esc(label)}">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" style="fill:${roomColor(room, mode, colorContext).css}"></rect>
    ${lines.map((line, index) => `<text x="${cx}" y="${firstY + index * 56}">${esc(line)}</text>`).join('')}
    ${handles}
  </g>`;
}

function placementShape(placement) {
  const width = Math.max(18, Number(placement.width) || 60);
  const depth = Math.max(18, Number(placement.depth) || 60);
  const x = Number(placement.x) || 0;
  const y = Number(placement.y) || 0;
  if (placement.shape === 'circle') {
    return `<ellipse cx="${x + width / 2}" cy="${y + depth / 2}" rx="${width / 2}" ry="${depth / 2}"></ellipse>`;
  }
  if (placement.shape === 'diamond') {
    const cx = x + width / 2, cy = y + depth / 2;
    return `<path d="M ${cx} ${y} L ${x + width} ${cy} L ${cx} ${y + depth} L ${x} ${cy} Z"></path>`;
  }
  return `<rect x="${x}" y="${y}" width="${width}" height="${depth}" rx="8"></rect>`;
}

function placementMarkup(placement, selected) {
  const width = Math.max(18, Number(placement.width) || 60);
  const depth = Math.max(18, Number(placement.depth) || 60);
  const cx = (Number(placement.x) || 0) + width / 2;
  const cy = (Number(placement.y) || 0) + depth / 2;
  const rotation = Number(placement.rotation) || 0;
  const label = `${placement.name || 'Ausstattungsobjekt'}, ${placement.articleId || placement.placementId}`;
  return `<g class="fpe-placement${selected ? ' is-selected' : ''}${placement.status === 'new' ? ' is-new' : ''}"
      data-entity="placement" data-id="${esc(placement.placementId)}" tabindex="0" role="button"
      aria-pressed="${selected}" aria-label="${esc(label)}" transform="rotate(${rotation} ${cx} ${cy})">
    ${placementShape(placement)}
    ${selected ? `<rect class="fpe-placement__selection" x="${(Number(placement.x) || 0) - 12}" y="${(Number(placement.y) || 0) - 12}"
      width="${width + 24}" height="${depth + 24}" rx="4"></rect>` : ''}
  </g>`;
}

/**
 * The transform widget over the selected placement: ring, rotate handle on the
 * ring at the object's front, move handle in the middle. Drawn outside the
 * rotated placement group so the handles keep their own geometry, and only in
 * edit mode — outside it there is nothing to drag.
 *
 * Stroke widths use `vector-effect:non-scaling-stroke` through CSS, so the
 * widget stays the same visual weight at every zoom.
 */
function transformWidgetMarkup(placement) {
  const widget = widgetGeometry(placement);
  if (!widget) return '';
  const { cx, cy, radius, handle, rotation } = widget;
  return `<g class="fpe-widget" data-widget-for="${esc(placement.placementId)}" aria-hidden="true">
    <circle class="fpe-widget__ring" cx="${cx}" cy="${cy}" r="${radius}"></circle>
    <line class="fpe-widget__arm" x1="${cx}" y1="${cy}" x2="${handle.x}" y2="${handle.y}"></line>
    <circle class="fpe-widget__grip fpe-widget__grip--rotate" data-widget="rotate"
      cx="${handle.x}" cy="${handle.y}" r="${Math.max(14, radius * .12)}"></circle>
    <circle class="fpe-widget__grip fpe-widget__grip--move" data-widget="move"
      cx="${cx}" cy="${cy}" r="${Math.max(14, radius * .12)}"></circle>
    <title>Ausrichtung ${rotation}°</title>
  </g>`;
}

function placementGhostMarkup(ghost) {
  if (!ghost) return '';
  const width = Math.max(18, Number(ghost.width) || 60);
  const depth = Math.max(18, Number(ghost.depth) || 60);
  const cx = (Number(ghost.x) || 0) + width / 2;
  const cy = (Number(ghost.y) || 0) + depth / 2;
  return `<g class="fpe-placement fpe-placement--ghost ${ghost.valid ? 'is-valid' : 'is-invalid'}"
      aria-hidden="true" transform="rotate(${Number(ghost.rotation) || 0} ${cx} ${cy})">
    ${placementShape(ghost)}
  </g>`;
}

function roomDraftMarkup(roomDraft) {
  const rect = roomDraft?.rect;
  if (!Array.isArray(rect) || rect.length !== 4) return '';
  const [x, y, width, height] = rect;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return '';
  const area = width * height / 10000;
  return `<g class="fpe-room-draft ${roomDraft.valid ? 'is-valid' : 'is-invalid'}" aria-hidden="true">
    <rect x="${x}" y="${y}" width="${width}" height="${height}"></rect>
    <text x="${x + width / 2}" y="${y + height / 2}">${esc(formatArea(area, { maximumFractionDigits: 1 }))}</text>
  </g>`;
}

function keyboardCursorMarkup(cursor) {
  const x = Number(cursor?.x);
  const y = Number(cursor?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return '';
  return `<g class="fpe-keyboard-cursor" aria-hidden="true" pointer-events="none"
      transform="translate(${x} ${y})" fill="var(--color-bg, #fff)" stroke="var(--color-primary-600, #1f57c3)"
      stroke-width="6" vector-effect="non-scaling-stroke">
    <circle r="24"></circle><path d="M -42 0 H -16 M 16 0 H 42 M 0 -42 V -16 M 0 16 V 42"></path>
  </g>`;
}

function measurementMarkup(measurement = {}) {
  const points = Array.isArray(measurement?.points) ? measurement.points : [];
  if (!points.length) return '';
  const coords = points.map((point) => `${point.x},${point.y}`).join(' ');
  const closed = measurement?.kind === 'area' && measurement.complete && points.length >= 3;
  const shape = closed
    ? `<polygon points="${coords}" class="fpe-measure__area"></polygon>`
    : `<polyline points="${coords}" class="fpe-measure__line"></polyline>`;
  const dots = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="16"></circle>`).join('');
  const last = points[points.length - 1];
  const value = measurementLabel(measurement);
  return `<g class="fpe-measure" aria-hidden="true">${shape}${dots}${value
    ? `<text x="${last.x + 30}" y="${last.y - 30}">${esc(value)}</text>` : ''}</g>`;
}

function distanceMetres(points = []) {
  let units = 0;
  for (let index = 1; index < points.length; index++) {
    units += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return units / 100;
}

function areaSquareMetres(points = []) {
  if (points.length < 3) return 0;
  let twiceArea = 0;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    twiceArea += point.x * next.y - next.x * point.y;
  });
  return Math.abs(twiceArea) / 2 / 10000;
}

export function measurementLabel(measurement = {}) {
  const points = measurement?.points || [];
  if (measurement?.kind === 'area' && measurement.complete) {
    return formatArea(areaSquareMetres(points), { maximumFractionDigits: 1 });
  }
  if (points.length >= 2) {
    return `${formatNumber(distanceMetres(points), { maximumFractionDigits: 2 })} m`;
  }
  return '';
}

export function fitCamera(floor, padding = 120) {
  const [width, height] = floor.extent || [4000, 1440];
  return { x: -padding, y: -padding, width: width + padding * 2, height: height + padding * 2 };
}

export function fitCameraToRect(rect, paddingRatio = .22) {
  if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite)) return null;
  const [x, y, width, height] = rect;
  if (width <= 0 || height <= 0) return null;
  const padding = Math.max(60, Math.max(width, height) * Math.max(.05, Number(paddingRatio) || 0));
  return {
    x: x - padding,
    y: y - padding,
    width: Math.max(300, width + padding * 2),
    height: Math.max(180, height + padding * 2),
  };
}

/**
 * Expand a camera to the CSS viewport aspect ratio without cropping content or
 * changing its effective SVG scale. This removes preserveAspectRatio
 * letterboxing, whose unpainted bands otherwise map to points outside the
 * viewBox when they receive a wheel or pointer event.
 */
export function cameraWithViewportAspect(camera, viewportWidth, viewportHeight) {
  const x = Number(camera?.x);
  const y = Number(camera?.y);
  const width = Number(camera?.width);
  const height = Number(camera?.height);
  const cssWidth = Number(viewportWidth);
  const cssHeight = Number(viewportHeight);
  if (![x, y, width, height, cssWidth, cssHeight].every(Number.isFinite)
    || width <= 0 || height <= 0 || cssWidth <= 0 || cssHeight <= 0) return { ...camera };
  const unitsPerPixel = Math.max(width / cssWidth, height / cssHeight);
  const nextWidth = cssWidth * unitsPerPixel;
  const nextHeight = cssHeight * unitsPerPixel;
  return {
    x: x + (width - nextWidth) / 2,
    y: y + (height - nextHeight) / 2,
    width: nextWidth,
    height: nextHeight,
  };
}

/**
 * Resize an already aspect-normalised camera while preserving plan units per
 * CSS pixel. Unlike repeatedly expanding with `cameraWithViewportAspect`, this
 * is reversible when panels open and close or the viewport changes orientation.
 */
export function resizeCameraToViewport(camera, previousViewport, nextViewport) {
  const x = Number(camera?.x);
  const y = Number(camera?.y);
  const width = Number(camera?.width);
  const height = Number(camera?.height);
  const previousWidth = Number(previousViewport?.width);
  const previousHeight = Number(previousViewport?.height);
  const nextWidth = Number(nextViewport?.width);
  const nextHeight = Number(nextViewport?.height);
  if (![x, y, width, height, previousWidth, previousHeight, nextWidth, nextHeight]
    .every(Number.isFinite)
    || width <= 0 || height <= 0 || previousWidth <= 0 || previousHeight <= 0
    || nextWidth <= 0 || nextHeight <= 0) {
    return cameraWithViewportAspect(camera, nextWidth, nextHeight);
  }
  // For a normalised camera these two values are equal. `max` is a safe
  // fallback for a legacy/mismatched camera because it cannot crop content.
  const unitsPerPixel = Math.max(width / previousWidth, height / previousHeight);
  const cameraWidth = nextWidth * unitsPerPixel;
  const cameraHeight = nextHeight * unitsPerPixel;
  return {
    x: x + (width - cameraWidth) / 2,
    y: y + (height - cameraHeight) / 2,
    width: cameraWidth,
    height: cameraHeight,
  };
}

/** Return a rounded, camera-aware scale bar for a measured viewport width. */
export function scaleBar(camera, viewportWidth, targetPixels = 120) {
  const width = Number(viewportWidth) || 0;
  if (!camera || !Number.isFinite(camera.width) || camera.width <= 0 || width <= 0) {
    return { metres: 0, pixels: 0, label: '' };
  }
  const rawMetres = (camera.width / width) * Math.max(50, Number(targetPixels) || 120) / 100;
  const power = 10 ** Math.floor(Math.log10(Math.max(rawMetres, .01)));
  const normal = rawMetres / power;
  const step = normal < 2 ? 1 : normal < 5 ? 2 : 5;
  const metres = step * power;
  const pixels = metres * 100 * width / camera.width;
  return {
    metres,
    pixels,
    label: `${formatNumber(metres, { maximumFractionDigits: 2 })} m`,
  };
}

export function zoomCamera(camera, factor, anchor = null) {
  const requestedFactor = Number(factor);
  const safe = Number.isFinite(requestedFactor) && requestedFactor > 0
    ? Math.max(.2, Math.min(5, requestedFactor))
    : 1;
  const x = Number(camera?.x);
  const y = Number(camera?.y);
  const width = Number(camera?.width);
  const height = Number(camera?.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return { ...camera };
  const minimumScale = Math.max(300 / width, 180 / height);
  const maximumScale = Math.min(24000 / width, 12000 / height);
  // A single scale keeps the viewBox aspect ratio stable. Valid editor cameras
  // always have a feasible interval; retaining scale 1 is the safest fallback
  // for an externally supplied camera with an impossible aspect ratio.
  const scale = minimumScale <= maximumScale
    ? Math.max(minimumScale, Math.min(safe, maximumScale))
    : 1;
  const nextWidth = width * scale;
  const nextHeight = height * scale;
  // A pointer in an SVG letterbox band transforms outside the viewBox. Clamp
  // it to the nearest visible edge so one wheel tick cannot throw the camera.
  const requestedX = Number(anchor?.x);
  const requestedY = Number(anchor?.y);
  const ax = Number.isFinite(requestedX) ? Math.max(x, Math.min(x + width, requestedX)) : x + width / 2;
  const ay = Number.isFinite(requestedY) ? Math.max(y, Math.min(y + height, requestedY)) : y + height / 2;
  const rx = (ax - x) / width;
  const ry = (ay - y) / height;
  return { x: ax - nextWidth * rx, y: ay - nextHeight * ry, width: nextWidth, height: nextHeight };
}

export function panCamera(camera, dx, dy) {
  const x = Number(camera?.x);
  const y = Number(camera?.y);
  const nextX = Number(dx);
  const nextY = Number(dy);
  if (![x, y, nextX, nextY].every(Number.isFinite)) return { ...camera };
  return { ...camera, x: x + nextX, y: y + nextY };
}

/** Transform a CSS-pixel point through an inverse SVG screen matrix. */
export function screenPointToPlan(inverseMatrix, clientX, clientY) {
  if (!inverseMatrix || ![clientX, clientY].every(Number.isFinite)) return null;
  const { a, b, c, d, e, f } = inverseMatrix;
  if (![a, b, c, d, e, f].every(Number.isFinite)) return null;
  return {
    x: a * clientX + c * clientY + e,
    y: b * clientX + d * clientY + f,
  };
}

/** Snapshot the inverse transform once at gesture start to avoid resize drift. */
export function inverseScreenMatrix(svg) {
  if (!svg?.getScreenCTM) return null;
  try {
    return svg.getScreenCTM()?.inverse?.() || null;
  } catch { return null; }
}

export function clientToPlan(svg, clientX, clientY) {
  return screenPointToPlan(inverseScreenMatrix(svg), clientX, clientY);
}

/** Transform a CSS-pixel delta through an inverse SVG screen matrix. */
export function screenDeltaToPlan(inverseMatrix, clientDx, clientDy) {
  if (!inverseMatrix || ![clientDx, clientDy].every(Number.isFinite)) return null;
  const { a, b, c, d } = inverseMatrix;
  if (![a, b, c, d].every(Number.isFinite)) return null;
  return {
    x: a * clientDx + c * clientDy,
    y: b * clientDx + d * clientDy,
  };
}

/**
 * Apply screen-space grab panning to a gesture's starting camera. Keeping the
 * inverse matrix fixed for the gesture makes direction and speed independent
 * of redraw timing or a ResizeObserver firing during the drag.
 */
export function panCameraFromScreenDelta(camera, inverseMatrix, clientDx, clientDy) {
  const delta = screenDeltaToPlan(inverseMatrix, clientDx, clientDy);
  return delta ? panCamera(camera, -delta.x, -delta.y) : { ...camera };
}

export function containingRoom(rooms, point) {
  if (!point) return null;
  return rooms.find((room) => {
    const [x, y, width, height] = room.rect;
    return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
  }) || null;
}

export function clampPlacement(placement, floor) {
  const [floorWidth, floorHeight] = floor.extent || [4000, 1440];
  const sourceWidth = Number(placement.width);
  const sourceDepth = Number(placement.depth);
  // Preserve catalogue dimensions in the document. The footprint helper uses
  // the renderer's 18-unit visual minimum internally when calculating bounds.
  const width = Number.isFinite(sourceWidth) && sourceWidth > 0 ? sourceWidth : 60;
  const depth = Number.isFinite(sourceDepth) && sourceDepth > 0 ? sourceDepth : 60;
  const prepared = {
    ...placement,
    x: Number(placement.x) || 0,
    y: Number(placement.y) || 0,
    width,
    depth,
    rotation: Number(placement.rotation) || 0,
  };
  const bounds = placementFootprintBounds(prepared);
  if (!bounds) return prepared;
  const clampCentre = (value, footprintSize, limit) => footprintSize > limit
    ? limit / 2
    : Math.max(footprintSize / 2, Math.min(limit - footprintSize / 2, value));
  const centreX = clampCentre(bounds.centreX, bounds.width, floorWidth);
  const centreY = clampCentre(bounds.centreY, bounds.height, floorHeight);
  return {
    ...prepared,
    x: prepared.x + centreX - bounds.centreX,
    y: prepared.y + centreY - bounds.centreY,
  };
}

export function renderEditorSvg({ floor, rooms = [], placements = [], selected = null,
  colorMode = 'use', camera = fitCamera(floor), measurement = null,
  editableRooms = false, roomDraft = null, placementGhost = null, keyboardCursor = null,
  transformWidget = false }) {
  const colorContext = createColorContext(rooms);
  const selectedType = selected?.type || '';
  const selectedId = selected?.id || '';
  const widgetFor = transformWidget && selectedType === 'placement'
    ? placements.find((placement) => placement.placementId === selectedId)
    : null;
  return `<svg class="fpe-canvas" id="fpe-canvas" viewBox="${camera.x} ${camera.y} ${camera.width} ${camera.height}"
      preserveAspectRatio="xMidYMid meet" role="group"
      aria-label="Grundriss ${esc(floor.label)} mit ${rooms.length} Räumen und ${placements.length} Ausstattungsobjekten">
    <rect class="fpe-canvas__sheet" x="0" y="0" width="${floor.extent?.[0] || 4000}" height="${floor.extent?.[1] || 1440}"></rect>
    <g class="fpe-canvas__rooms">${rooms.map((room) => roomMarkup(room,
      selectedType === 'room' && selectedId === room.spaceId, colorMode, colorContext, editableRooms)).join('')}</g>
    <g class="fpe-canvas__placements">${placements.map((placement) => placementMarkup(placement,
      selectedType === 'placement' && selectedId === placement.placementId)).join('')}</g>
    ${transformWidgetMarkup(widgetFor)}
    ${placementGhostMarkup(placementGhost)}
    ${roomDraftMarkup(roomDraft)}
    ${measurementMarkup(measurement)}
    ${keyboardCursorMarkup(keyboardCursor)}
  </svg>`;
}
