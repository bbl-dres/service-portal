import assert from 'node:assert/strict';
import {
  createColorContext,
  roomColor,
  roomColorDescriptor,
} from '../js/floorplan-editor/colors.js';
import {
  cameraWithViewportAspect,
  clampPlacement,
  panCamera,
  panCameraFromScreenDelta,
  renderEditorSvg,
  resizeCameraToViewport,
  screenPointToPlan,
  screenDeltaToPlan,
  zoomCamera,
} from '../js/floorplan-editor/canvas.js';
import {
  placementFootprintBounds,
  placementFootprintInsideFloor,
} from '../js/floorplan-editor/geometry.js';
import {
  arrowDirection,
  keyboardPanDelta,
  movementExceeded,
  pointerDragTolerance,
  pointerButtons,
  roomRectFromDrag,
  rovingIndex,
  transformRoomRect,
  wheelZoomFactor,
} from '../js/floorplan-editor/interactions.js';
import {
  fitOrbitDistance,
  minimumOrbitDistanceForPitch,
  nearestPickEntity,
  normalizeRadians,
  normalizeWheelPixels,
  orbitDistanceLimits,
  orbitRotationDelta,
  perspectiveGroundPanDelta,
  touchGestureMetrics,
} from '../js/floorplan-editor/three-viewer.js';

const rooms = [
  { spaceId: '2', occupierVe: 'Zulu', group: 'zusammen', sia: 'VF', moduleId: 4, useLabel: 'Treffen' },
  { spaceId: '1', occupierVe: 'Alpha', group: 'arbeit', sia: 'HNF', moduleId: 1, useLabel: 'Arbeiten' },
];
const context = createColorContext(rooms);
assert.deepEqual(context.occupiers, ['Alpha', 'Zulu']);
assert.equal(roomColor(rooms[1], 've', context).token, 've-a');
assert.equal(roomColor(rooms[0], 've', context).token, 've-b');
assert.equal(roomColor(rooms[1], 'sia', context).hex, '#d6e6f5');
assert.equal(roomColor(rooms[0], 'use', context).css, 'var(--fp-use-collab)');
assert.equal(roomColor(rooms[0], 'module', context).rgb, 0xfbeccd);
assert.equal(roomColor({ occupierVe: '' }, 've', context).token, 'unassigned');
assert.equal(roomColorDescriptor(rooms[1], 've', context).swatch, 've-a');

const camera = { x: 10, y: 20, width: 1000, height: 500 };
const zoomed = zoomCamera(camera, 0.1, { x: 260, y: 145 });
assert.equal(zoomed.width / zoomed.height, camera.width / camera.height);
assert.equal(zoomed.width, 360);
assert.equal(zoomed.height, 180);
assert.equal((260 - zoomed.x) / zoomed.width, (260 - camera.x) / camera.width);
assert.equal((145 - zoomed.y) / zoomed.height, (145 - camera.y) / camera.height);
const maximum = zoomCamera({ x: 0, y: 0, width: 6000, height: 3000 }, 5);
assert.deepEqual({ width: maximum.width, height: maximum.height }, { width: 24000, height: 12000 });
const inverseMatrix = { a: 2, b: 0.5, c: -1, d: 3, e: 7, f: -4 };
assert.deepEqual(screenPointToPlan(inverseMatrix, 4, 2), { x: 13, y: 4 });
assert.deepEqual(screenDeltaToPlan(inverseMatrix, 4, 2), { x: 6, y: 8 });
assert.deepEqual(panCameraFromScreenDelta(camera, inverseMatrix, 4, 2),
  { x: 4, y: 12, width: 1000, height: 500 });
assert.deepEqual(panCamera(camera, Number.NaN, 1), camera);

const squareViewport = cameraWithViewportAspect(camera, 800, 800);
assert.deepEqual(squareViewport, { x: 10, y: -230, width: 1000, height: 1000 });
assert.deepEqual(cameraWithViewportAspect(squareViewport, 800, 800), squareViewport);
const wideViewport = resizeCameraToViewport(squareViewport,
  { width: 800, height: 800 }, { width: 1600, height: 800 });
assert.deepEqual(wideViewport, { x: -490, y: -230, width: 2000, height: 1000 });
assert.deepEqual(resizeCameraToViewport(wideViewport,
  { width: 1600, height: 800 }, { width: 800, height: 800 }), squareViewport);
const clampedAnchorZoom = zoomCamera(camera, .5, { x: -500, y: 900 });
assert.deepEqual(clampedAnchorZoom, { x: 10, y: 270, width: 500, height: 250 });
assert.deepEqual(zoomCamera(camera, -2), camera);

const rotated = { x: 30, y: 40, width: 100, depth: 50, rotation: 90 };
const rotatedBounds = placementFootprintBounds(rotated);
assert.ok(Math.abs(rotatedBounds.width - 50) < 1e-9);
assert.ok(Math.abs(rotatedBounds.height - 100) < 1e-9);
assert.equal(rotatedBounds.centreX, 80);
assert.equal(rotatedBounds.centreY, 65);

const floor = { label: 'Testgeschoss', extent: [200, 200] };
const outside = { x: -20, y: 0, width: 100, depth: 50, rotation: 45 };
assert.equal(placementFootprintInsideFloor(outside, floor), false);
const clamped = clampPlacement(outside, floor);
assert.equal(placementFootprintInsideFloor(clamped, floor), true);
const thinProduct = { x: -8, y: -6, width: 60, depth: 8, rotation: 45 };
const clampedThinProduct = clampPlacement(thinProduct, floor);
assert.equal(clampedThinProduct.width, 60);
assert.equal(clampedThinProduct.depth, 8);
assert.equal(placementFootprintInsideFloor(clampedThinProduct, floor), true);

assert.deepEqual(pointerButtons({ button: 0 }, 'room'), { primary: true, middle: false });
assert.deepEqual(pointerButtons({ button: 1 }, 'room'), { primary: false, middle: true });
assert.deepEqual(pointerButtons({ button: 1 }, 'pan'), { primary: false, middle: true });
assert.equal(pointerButtons({ button: 2 }, 'select'), null);
assert.equal(movementExceeded({ x: 0, y: 0 }, { x: 3, y: 4 }, 4), true);
assert.equal(pointerDragTolerance('mouse'), 4);
assert.equal(pointerDragTolerance('pen'), 6);
assert.equal(pointerDragTolerance('touch'), 10);
const visibleRoom = { type: 'room', id: 'visible' };
assert.equal(nearestPickEntity([
  { distance: 1, object: { userData: {} } },
  { distance: 2, object: { userData: { entity: visibleRoom } } },
]), null);
assert.equal(nearestPickEntity([
  { distance: 1, object: { userData: { entity: visibleRoom } } },
]), visibleRoom);
assert.equal(wheelZoomFactor({ deltaY: 0 }), 1);
assert.ok(Math.abs(wheelZoomFactor({ deltaY: 100, deltaMode: 0 }) - Math.exp(.15)) < 1e-12);
assert.ok(Math.abs(wheelZoomFactor({ deltaY: -3, deltaMode: 1 }) - Math.exp(-.072)) < 1e-12);
assert.equal(wheelZoomFactor({ deltaY: 1, deltaMode: 2 }, { pagePixels: 1000 }), 2);
assert.deepEqual(arrowDirection('ArrowUp'), [0, -1]);
assert.deepEqual(keyboardPanDelta(camera, 'ArrowLeft'), { x: -80, y: 0 });
assert.equal(rovingIndex('ArrowLeft', 0, 3), 2);
assert.equal(rovingIndex('End', 0, 3), 2);
assert.deepEqual(roomRectFromDrag({ x: 180, y: -20 }, { x: 40, y: 260 }, floor.extent),
  [40, 0, 140, 200]);
assert.deepEqual(transformRoomRect({
  type: 'room-move', rect: [20, 30, 100, 100], start: { x: 30, y: 40 },
  point: { x: -100, y: 300 }, extent: floor.extent,
}), { rect: [0, 100, 100, 100], dx: -20, dy: 70 });
assert.deepEqual(transformRoomRect({
  type: 'room-resize', rect: [20, 30, 120, 120], handle: 'nw', start: { x: 20, y: 30 },
  point: { x: 130, y: 140 }, extent: floor.extent,
})?.rect, [40, 50, 100, 100]);

const panAtDefaultYaw = perspectiveGroundPanDelta({
  deltaX: 30, deltaY: 20, distance: 40, fov: 52, viewportHeight: 500,
  yaw: 0, pitch: Math.PI / 4,
});
assert.ok(panAtDefaultYaw.x < 0, 'dragging right moves the orbit target left so the floor follows the pointer');
assert.ok(panAtDefaultYaw.z < 0, 'dragging down moves the orbit target toward screen-up on the floor');
const panInTallerViewport = perspectiveGroundPanDelta({
  deltaX: 30, deltaY: 20, distance: 40, fov: 52, viewportHeight: 1000,
  yaw: 0, pitch: Math.PI / 4,
});
assert.ok(Math.abs(panInTallerViewport.scale * 2 - panAtDefaultYaw.scale) < 1e-12);
const quarterTurnPan = perspectiveGroundPanDelta({
  deltaX: 30, deltaY: 20, distance: 40, fov: 52, viewportHeight: 500,
  yaw: Math.PI / 2, pitch: Math.PI / 4,
});
assert.ok(quarterTurnPan.x < 0 && quarterTurnPan.z > 0,
  'pan axes rotate with the camera while preserving screen direction');
const rotation = orbitRotationDelta({ deltaX: 25, deltaY: -10, viewportHeight: 500 });
assert.ok(rotation.yaw < 0 && rotation.pitch < 0);
assert.equal(normalizeWheelPixels({ deltaY: 3, deltaMode: 1 }, 500), 48);
assert.equal(normalizeWheelPixels({ deltaY: 1, deltaMode: 2 }, 500), 500);
assert.ok(Math.abs(normalizeRadians(Math.PI * 3) + Math.PI) < 1e-12);
assert.deepEqual(touchGestureMetrics([{ x: 10, y: 20 }, { x: 40, y: 60 }]), {
  x: 25, y: 40, distance: 50, angle: Math.atan2(40, 30),
});
assert.ok(minimumOrbitDistanceForPitch(0.12) > minimumOrbitDistanceForPitch(1.2),
  'near-horizon views keep the camera farther away from walls');
const distanceLimits = orbitDistanceLimits(87.5, 14.4);
const fittedLandscape = fitOrbitDistance({
  width: 87.5, depth: 14.4, aspect: 1.6, yaw: -0.88, pitch: 0.72,
});
const fittedPortrait = fitOrbitDistance({
  width: 87.5, depth: 14.4, aspect: 0.7, yaw: -0.88, pitch: 0.72,
});
assert.ok(fittedLandscape >= distanceLimits.min && fittedLandscape <= distanceLimits.max);
assert.ok(fittedPortrait > fittedLandscape, 'portrait viewports fit the same floor from farther away');

const svg = renderEditorSvg({
  floor,
  rooms: [{ ...rooms[1], roomNumber: '1.01', area: 10, rect: [0, 0, 100, 100] }],
  colorMode: 'sia',
  keyboardCursor: { x: 50, y: 60 },
});
assert.match(svg, /fill:var\(--fp-sia-hnf\)/);
assert.match(svg, /class="fpe-keyboard-cursor"/);
assert.match(svg, /translate\(50 60\)/);

console.log('Floorplan editor rendering tests passed.');
