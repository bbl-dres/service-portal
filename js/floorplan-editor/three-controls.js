// Pure camera and gesture calculations for the retained Three.js viewer.

import * as THREE from '../vendor/three.module.min.js';

export const CM_TO_M = 0.01;
export const WALK_EYE_HEIGHT = 1.65;
export const WALL_THICKNESS = 0.08;
export const POINTER_CLICK_TOLERANCE = 4;
export const ORBIT_TARGET_HEIGHT = 0.2;
export const ORBIT_SCENE_HEIGHT = 2.5;
export const ORBIT_MIN_PITCH = 0.12;
export const ORBIT_MAX_PITCH = 1.46;
export const ORBIT_ROTATE_SPEED = 1;
export const WALK_LOOK_YAW_PER_PIXEL = 0.0024;
export const WALK_LOOK_PITCH_PER_PIXEL = 0.002;
export const MAX_RENDER_PIXELS = 3840 * 2160;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function normalizeRadians(value) {
  if (!Number.isFinite(value)) return 0;
  const turn = Math.PI * 2;
  return ((value + Math.PI) % turn + turn) % turn - Math.PI;
}

export function orbitDistanceLimits(width, depth) {
  const diagonal = Math.max(1, Math.hypot(Number(width) || 0, Number(depth) || 0));
  return {
    min: clamp(diagonal * 0.025, 1.2, 5),
    max: clamp(diagonal * 6, 40, 600),
  };
}

export function minimumOrbitDistanceForPitch(
  pitch,
  sceneHeight = ORBIT_SCENE_HEIGHT,
  targetHeight = ORBIT_TARGET_HEIGHT,
  clearance = 0.35,
) {
  return Math.max(
    0,
    (Number(sceneHeight) + Number(clearance) - Number(targetHeight))
      / Math.max(0.01, Math.sin(clamp(Number(pitch) || ORBIT_MIN_PITCH, ORBIT_MIN_PITCH, ORBIT_MAX_PITCH))),
  );
}

// Match the perspective pan scale used by Three.js MapControls/OrbitControls,
// then project screen-up onto the floor plane. Positive pixel deltas mean
// right/down; the returned target delta makes the grabbed model follow them.
export function perspectiveGroundPanDelta({
  deltaX = 0,
  deltaY = 0,
  distance = 1,
  fov = 52,
  viewportHeight = 1,
  yaw = 0,
  pitch = Math.PI / 4,
} = {}) {
  const height = Math.max(1, Number(viewportHeight) || 1);
  const targetDistance = Math.max(0, Number(distance) || 0)
    * Math.tan(THREE.MathUtils.degToRad(clamp(Number(fov) || 52, 1, 179)) / 2);
  const scale = 2 * targetDistance / height;
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const backwardX = Math.sin(yaw);
  const backwardZ = Math.cos(yaw);
  // Ground-plane motion approaches infinity at the horizon. Capping the
  // compensation keeps the fallback stable when the pointer ray misses it.
  const verticalScale = scale / Math.max(0.25, Math.sin(clamp(pitch, 0, Math.PI / 2)));
  return {
    x: -Number(deltaX || 0) * rightX * scale - Number(deltaY || 0) * backwardX * verticalScale,
    z: -Number(deltaX || 0) * rightZ * scale - Number(deltaY || 0) * backwardZ * verticalScale,
    scale,
    verticalScale,
  };
}

export function orbitRotationDelta({ deltaX = 0, deltaY = 0, viewportHeight = 1 } = {}) {
  const radiansPerPixel = ORBIT_ROTATE_SPEED * Math.PI * 2
    / Math.max(1, Number(viewportHeight) || 1);
  return {
    yaw: -Number(deltaX || 0) * radiansPerPixel,
    pitch: Number(deltaY || 0) * radiansPerPixel,
  };
}

export function normalizeWheelPixels({ deltaY = 0, deltaMode = 0 } = {}, viewportHeight = 1) {
  const multiplier = deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(100, viewportHeight) : 1;
  return Number.isFinite(deltaY) ? deltaY * multiplier : 0;
}

export function touchGestureMetrics(points = []) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const [first, second] = points;
  const dx = Number(second?.x) - Number(first?.x);
  const dy = Number(second?.y) - Number(first?.y);
  if (![dx, dy, first?.x, first?.y, second?.x, second?.y].every(Number.isFinite)) return null;
  return {
    x: (Number(first.x) + Number(second.x)) / 2,
    y: (Number(first.y) + Number(second.y)) / 2,
    distance: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx),
  };
}

// Fits the complete floor/wall box for the current orbit orientation. This is
// tighter than a bounding sphere while remaining valid for any aspect ratio.
export function fitOrbitDistance({
  width = 1,
  depth = 1,
  height = ORBIT_SCENE_HEIGHT,
  targetX = 0,
  targetY = ORBIT_TARGET_HEIGHT,
  targetZ = 0,
  yaw = -0.88,
  pitch = 0.72,
  fov = 52,
  aspect = 1,
  padding = 1.08,
} = {}) {
  const safeWidth = Math.max(0.01, Number(width) || 1);
  const safeDepth = Math.max(0.01, Number(depth) || 1);
  const safeHeight = Math.max(0.01, Number(height) || ORBIT_SCENE_HEIGHT);
  const verticalTangent = Math.tan(THREE.MathUtils.degToRad(clamp(Number(fov) || 52, 1, 179)) / 2);
  const horizontalTangent = verticalTangent * Math.max(0.01, Number(aspect) || 1);
  const cosineYaw = Math.cos(yaw);
  const sineYaw = Math.sin(yaw);
  const cosinePitch = Math.cos(pitch);
  const sinePitch = Math.sin(pitch);
  const right = [cosineYaw, 0, -sineYaw];
  const backward = [sineYaw * cosinePitch, sinePitch, cosineYaw * cosinePitch];
  const up = [-sineYaw * sinePitch, cosinePitch, -cosineYaw * sinePitch];
  let required = 0;
  [-safeWidth / 2 - targetX, safeWidth / 2 - targetX].forEach((x) => {
    [-0.16 - targetY, safeHeight - targetY].forEach((y) => {
      [-safeDepth / 2 - targetZ, safeDepth / 2 - targetZ].forEach((z) => {
        const behind = x * backward[0] + y * backward[1] + z * backward[2];
        const horizontal = Math.abs(x * right[0] + y * right[1] + z * right[2]);
        const vertical = Math.abs(x * up[0] + y * up[1] + z * up[2]);
        required = Math.max(
          required,
          behind + horizontal / horizontalTangent,
          behind + vertical / verticalTangent,
        );
      });
    });
  });
  const limits = orbitDistanceLimits(safeWidth, safeDepth);
  return clamp(required * Math.max(1, Number(padding) || 1), limits.min, limits.max);
}
