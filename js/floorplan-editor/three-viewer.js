// Retained, interactive Three.js viewer for the floor-plan editor. Geometry is
// derived from the same browser-local document as the SVG editor.

import * as THREE from '../vendor/three.module.min.js';
import { createColorContext, normalizeColorMode, roomColor } from './colors.js';

const CM_TO_M = 0.01;
const WALK_EYE_HEIGHT = 1.65;
const WALL_THICKNESS = 0.08;
const POINTER_CLICK_TOLERANCE = 4;
const ORBIT_TARGET_HEIGHT = 0.2;
const ORBIT_SCENE_HEIGHT = 2.5;
const ORBIT_MIN_PITCH = 0.12;
const ORBIT_MAX_PITCH = 1.46;
const ORBIT_ROTATE_SPEED = 1;
const WALK_LOOK_YAW_PER_PIXEL = 0.0024;
const WALK_LOOK_PITCH_PER_PIXEL = 0.002;
const MAX_RENDER_PIXELS = 3840 * 2160;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clean = (value) => String(value || '').trim().toLocaleLowerCase('de');
const floorSize = (floor) => ({
  width: Math.max(1, Number(floor?.extent?.[0] || 1000) * CM_TO_M),
  depth: Math.max(1, Number(floor?.extent?.[1] || 1000) * CM_TO_M),
});

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

function entityData(object, type, id) {
  object.traverse((child) => { child.userData.entity = { type, id }; });
  return object;
}

function box(width, height, depth, material, y, geometry) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(width, height, depth);
  mesh.position.y = y ?? height / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function furnitureObject(placement, isSelected, resources) {
  const group = new THREE.Group();
  const width = Math.max(0.18, Number(placement.width || 60) * CM_TO_M);
  const depth = Math.max(0.18, Number(placement.depth || 60) * CM_TO_M);
  const suppliedHeight = Number(placement.height || 0) * CM_TO_M;
  const name = clean(`${placement.name} ${placement.category}`);
  const main = resources.furnitureMaterial('main', isSelected);
  const dark = resources.furnitureMaterial('dark', isSelected);
  const addPart = (part, role) => {
    part.userData.materialRole = role;
    group.add(part);
    return part;
  };

  if (/stuhl|chair|sessel/.test(name)) {
    const seatHeight = clamp(suppliedHeight * 0.5 || 0.45, 0.38, 0.52);
    addPart(box(width * 0.78, 0.09, depth * 0.72, main, seatHeight, resources.unitBox), 'main');
    const back = box(width * 0.78, 0.55, 0.08, dark, seatHeight + 0.28, resources.unitBox);
    back.position.z = -depth * 0.32;
    addPart(back, 'dark');
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
      const leg = box(0.045, seatHeight, 0.045, dark, seatHeight / 2, resources.unitBox);
      leg.position.x = x * width * 0.3;
      leg.position.z = z * depth * 0.25;
      addPart(leg, 'dark');
    });
  } else if (/tisch|table|desk|konferenz/.test(name)) {
    const height = clamp(suppliedHeight || 0.74, 0.65, 1.1);
    addPart(box(width, 0.08, depth, main, height, resources.unitBox), 'main');
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
      const leg = box(0.055, height, 0.055, dark, height / 2, resources.unitBox);
      leg.position.x = x * Math.max(0, width / 2 - 0.12);
      leg.position.z = z * Math.max(0, depth / 2 - 0.12);
      addPart(leg, 'dark');
    });
  } else if (/bildschirm|screen|monitor|display/.test(name)) {
    const height = clamp(suppliedHeight || 0.7, 0.45, 1.8);
    addPart(box(width, height, Math.min(depth, 0.12), dark, height / 2 + 0.65, resources.unitBox), 'dark');
    addPart(box(0.08, 0.65, 0.08, main, 0.325, resources.unitBox), 'main');
  } else {
    const height = clamp(suppliedHeight || (/schrank|regal|archiv/.test(name) ? 1.8 : 0.75), 0.25, 2.4);
    const shape = placement.shape || placement.shape2d;
    if (shape === 'circle') {
      const mesh = new THREE.Mesh(resources.unitCylinder, main);
      mesh.scale.set(width, height, width);
      mesh.position.y = height / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      addPart(mesh, 'main');
    } else {
      addPart(box(width, height, depth, main, height / 2, resources.unitBox), 'main');
    }
  }

  group.position.set(
    Number(placement.x || 0) * CM_TO_M + width / 2,
    0,
    Number(placement.y || 0) * CM_TO_M + depth / 2,
  );
  group.rotation.y = -THREE.MathUtils.degToRad(Number(placement.rotation || 0));
  return group;
}

function roomLabel(room, width, depth, resources) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#162438';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '600 42px Arial, sans-serif';
  context.fillText(String(room.roomNumber || '').replace(/^\S+\sOG\s/i, ''), 256, 42, 460);
  context.font = '28px Arial, sans-serif';
  context.fillText(String(room.useLabel || ''), 256, 91, 460);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  resources.temporaryTextures.add(texture);
  resources.temporaryMaterials.add(material);
  const labelWidth = Math.max(0.7, Math.min(width * 0.78, depth * 2.5, 3.4));
  const mesh = new THREE.Mesh(resources.unitPlane, material);
  mesh.scale.set(labelWidth, labelWidth / 4, 1);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.075;
  return mesh;
}

function addWall(group, x, z, width, depth, height, material, unitBox) {
  const wall = box(
    Math.max(width, WALL_THICKNESS),
    height,
    Math.max(depth, WALL_THICKNESS),
    material,
    height / 2,
    unitBox,
  );
  wall.position.x = x;
  wall.position.z = z;
  group.add(wall);
  return wall;
}

// Three.js returns ray intersections nearest-first. Only the foremost visible
// object may own a click: an unlabelled wall therefore blocks entities behind
// it instead of allowing selection through opaque geometry.
export function nearestPickEntity(intersections = []) {
  return intersections[0]?.object?.userData?.entity || null;
}

function startPoint(rooms, placements, width, depth, selectedRoomId = '') {
  const selectedRoom = rooms.find((room) => room.spaceId === selectedRoomId && room.rect);
  const usableRooms = rooms.filter((room) => room.rect && room.sia !== 'VF'
    && !/korridor|verkehr|treppenhaus|wc|technik|archiv/.test(clean(`${room.useType} ${room.useLabel}`)));
  const room = selectedRoom || [...(usableRooms.length ? usableRooms : rooms)]
    .sort((a, b) => Number(b.area || 0) - Number(a.area || 0))[0];
  if (!room?.rect) return { position: new THREE.Vector3(0, WALK_EYE_HEIGHT, 0), yaw: Math.PI / 2 };

  const [x, z, roomWidth, roomDepth] = room.rect.map((value) => Number(value) * CM_TO_M);
  const margin = Math.min(0.8, Math.max(0.35, Math.min(roomWidth, roomDepth) * 0.16));
  const candidates = [
    [x + margin, z + roomDepth - margin],
    [x + roomWidth - margin, z + roomDepth - margin],
    [x + roomWidth - margin, z + margin],
    [x + margin, z + margin],
    [x + roomWidth / 2, z + roomDepth / 2],
  ];
  const roomPlacements = placements.filter((placement) => placement.roomId === room.spaceId);
  const isFree = ([candidateX, candidateZ]) => !roomPlacements.some((placement) => {
    const placementX = Number(placement.x || 0) * CM_TO_M;
    const placementZ = Number(placement.y || 0) * CM_TO_M;
    const placementWidth = Math.max(0.1, Number(placement.width || 0) * CM_TO_M);
    const placementDepth = Math.max(0.1, Number(placement.depth || 0) * CM_TO_M);
    const clearance = 0.32;
    return candidateX >= placementX - clearance && candidateX <= placementX + placementWidth + clearance
      && candidateZ >= placementZ - clearance && candidateZ <= placementZ + placementDepth + clearance;
  });
  const [startX, startZ] = candidates.find(isFree) || candidates[candidates.length - 1];
  const centreX = x + roomWidth / 2;
  const centreZ = z + roomDepth / 2;
  return {
    position: new THREE.Vector3(startX - width / 2, WALK_EYE_HEIGHT, startZ - depth / 2),
    // Three.js cameras look down their local -Z axis at yaw 0.
    yaw: Math.atan2(startX - centreX, startZ - centreZ),
  };
}

function fallbackViewer() {
  return {
    reset() {},
    zoom() {},
    updateSelection() {},
    updateColors() {},
    updateDocument() {},
    getViewState() { return null; },
    dispose() {},
  };
}

export function createFloorplanThreeViewer({
  host,
  mode,
  floor,
  rooms = [],
  placements = [],
  selected = null,
  colorMode = 'use',
  initialViewState = null,
  onSelect,
  onAnnounce,
}) {
  const viewerMode = mode === 'walk' ? 'walk' : '3d';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    const fallback = document.createElement('div');
    fallback.className = 'fpe-three-fallback';
    fallback.setAttribute('role', 'alert');
    const title = document.createElement('strong');
    title.textContent = '3D-Darstellung nicht verfügbar';
    const detail = document.createElement('span');
    detail.textContent = String(error?.message || error);
    fallback.append(title, detail);
    host.replaceChildren(fallback);
    return fallbackViewer();
  }

  const state = {
    floor,
    rooms: Array.isArray(rooms) ? rooms : [],
    placements: Array.isArray(placements) ? placements : [],
    selected,
    colorMode: normalizeColorMode(colorMode),
  };
  let dimensions = floorSize(state.floor);
  let colorContext = createColorContext(state.rooms);
  let disposed = false;
  let contextLost = false;
  let frameRequest = 0;
  let previousTime = performance.now();
  let dynamicRoot = null;
  let pickTargets = [];
  const roomVisuals = new Map();
  const placementVisuals = new Map();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eef3);
  scene.fog = new THREE.Fog(0xe9eef3, 55, 145);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 300);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Model geometry and lighting are static between explicit document updates.
  // Reusing that shadow map removes the most expensive work from camera drags.
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.className = 'fpe-three-canvas';
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('role', 'group');
  renderer.domElement.setAttribute('aria-roledescription', viewerMode === 'walk' ? 'Begehungsvorschau' : '3D-Modell');
  renderer.domElement.setAttribute('aria-label', viewerMode === 'walk'
    ? 'Visuelle Begehungsvorschau ohne Tür-, Wand- oder Kollisionssimulation. Mit W A S D oder den Pfeiltasten bewegen und mit der Maus umsehen.'
    : 'Interaktives 3D-Modell. Linke Maustaste verschiebt, rechte Maustaste dreht, das Mausrad zoomt. Ein Finger verschiebt; zwei Finger verschieben, drehen und zoomen. Pfeiltasten verschieben; Umschalt plus Pfeiltasten drehen; Plus und Minus zoomen; Pos1 setzt die Ansicht zurück.');
  renderer.domElement.setAttribute('aria-keyshortcuts', viewerMode === 'walk'
    ? 'W A S D ArrowUp ArrowDown ArrowLeft ArrowRight'
    : 'ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight + - Home');
  host.replaceChildren(renderer.domElement);
  host.dataset.renderer = `Three.js r${THREE.REVISION}`;
  host.dataset.mode = viewerMode;
  host.dataset.context = 'ready';
  host.dataset.controls = viewerMode === 'walk'
    ? 'pointer-look keyboard-walk preview-no-collision'
    : 'orbit left-pan right-rotate wheel-zoom touch-pan-pinch-twist keyboard-pan-rotate-zoom select';

  scene.add(new THREE.HemisphereLight(0xf8fbff, 0x768493, 2.25));
  const sun = new THREE.DirectionalLight(0xffffff, 2.7);
  sun.position.set(-18, 32, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  scene.add(sun);

  const persistentMaterials = new Map();
  const temporaryMaterials = new Set();
  const temporaryTextures = new Set();
  const temporaryGeometries = new Set();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitBoxEdges = new THREE.EdgesGeometry(unitBox);
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  // Radius and height are both one, then scaled to requested dimensions.
  const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
  const reusableGeometries = new Set([unitBox, unitBoxEdges, unitPlane, unitCylinder]);
  const cachedMaterial = (key, create) => {
    if (!persistentMaterials.has(key)) persistentMaterials.set(key, create());
    return persistentMaterials.get(key);
  };
  const resources = {
    unitBox,
    unitBoxEdges,
    unitPlane,
    unitCylinder,
    temporaryMaterials,
    temporaryTextures,
    furnitureMaterial(role, isSelected) {
      const key = `furniture-${role}-${isSelected ? 'selected' : 'default'}`;
      return cachedMaterial(key, () => new THREE.MeshStandardMaterial({
        color: role === 'dark'
          ? (isSelected ? 0x173b83 : 0x33475b)
          : (isSelected ? 0x2864dc : 0x68798a),
        roughness: role === 'dark' ? 0.62 : 0.72,
        metalness: role === 'dark' ? 0.08 : 0.04,
      }));
    },
  };
  const baseMaterial = cachedMaterial('base', () => new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.92 }));
  const wallMaterial = cachedMaterial('wall', () => new THREE.MeshStandardMaterial({ color: 0xfafcff, roughness: 0.8 }));
  const roomMaterial = (room, isSelected) => {
    const rgb = isSelected ? 0xbfd2ff : roomColor(room, state.colorMode, colorContext).rgb;
    const key = `room-${rgb.toString(16)}-${isSelected ? 'selected' : 'default'}`;
    return cachedMaterial(key, () => new THREE.MeshStandardMaterial({
      color: rgb,
      roughness: 0.94,
      emissive: isSelected ? 0x142f70 : 0x000000,
      emissiveIntensity: isSelected ? 0.08 : 0,
    }));
  };
  const outlineMaterial = (isSelected) => cachedMaterial(
    `outline-${isSelected ? 'selected' : 'default'}`,
    () => new THREE.LineBasicMaterial({ color: isSelected ? 0x1748c6 : 0x53677b }),
  );

  const orbit = {
    target: new THREE.Vector3(0, ORBIT_TARGET_HEIGHT, 0),
    yaw: -0.88,
    pitch: 0.72,
    distance: 18,
  };
  const initialWalk = startPoint(
    state.rooms,
    state.placements,
    dimensions.width,
    dimensions.depth,
    state.selected?.type === 'room' ? state.selected.id : '',
  );
  const walk = { yaw: initialWalk.yaw, pitch: -0.04, keys: new Set(), position: initialWalk.position };
  const raycaster = new THREE.Raycaster();
  const rayPointer = new THREE.Vector2();
  const interaction = {
    active: false,
    pointerId: null,
    intent: '',
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    maxDistance: 0,
    panAnchor: null,
    panStarted: false,
    clickTolerance: POINTER_CLICK_TOLERANCE,
  };
  const touchPointers = new Map();
  let previousTouchGesture = null;
  const abort = new AbortController();
  const { signal } = abort;
  let contextStatus = null;
  let pointerLockFallbackAnnounced = false;
  const viewport = { width: 0, height: 0, pixelRatio: 0 };

  function currentOrbitLimits() {
    return orbitDistanceLimits(dimensions.width, dimensions.depth);
  }

  function currentFitDistance(aspect = camera.aspect) {
    return fitOrbitDistance({
      ...dimensions,
      height: ORBIT_SCENE_HEIGHT,
      targetX: orbit.target.x,
      targetY: ORBIT_TARGET_HEIGHT,
      targetZ: orbit.target.z,
      yaw: orbit.yaw,
      pitch: orbit.pitch,
      fov: camera.fov,
      aspect,
    });
  }

  function clampOrbitState() {
    const limits = currentOrbitLimits();
    orbit.target.x = clamp(orbit.target.x, -dimensions.width / 2, dimensions.width / 2);
    orbit.target.y = ORBIT_TARGET_HEIGHT;
    orbit.target.z = clamp(orbit.target.z, -dimensions.depth / 2, dimensions.depth / 2);
    orbit.yaw = normalizeRadians(orbit.yaw);
    orbit.pitch = clamp(orbit.pitch, ORBIT_MIN_PITCH, ORBIT_MAX_PITCH);
    const collisionSafeMinimum = minimumOrbitDistanceForPitch(orbit.pitch);
    orbit.distance = clamp(orbit.distance, Math.max(limits.min, collisionSafeMinimum), limits.max);
  }

  function updateCameraDiagnostics() {
    const pan = perspectiveGroundPanDelta({
      distance: orbit.distance,
      fov: camera.fov,
      viewportHeight: viewport.height,
      yaw: orbit.yaw,
      pitch: orbit.pitch,
    });
    host.dataset.cameraAspect = camera.aspect.toFixed(6);
    host.dataset.orbitPitch = orbit.pitch.toFixed(6);
    host.dataset.orbitPanScale = pan.scale.toFixed(6);
    host.dataset.orbitVerticalPanScale = pan.verticalScale.toFixed(6);
    host.dataset.orbitFitRatio = (orbit.distance / currentFitDistance()).toFixed(6);
  }

  function updateOrbitCamera(shouldInvalidate = true) {
    clampOrbitState();
    const horizontal = orbit.distance * Math.cos(orbit.pitch);
    camera.position.set(
      orbit.target.x + Math.sin(orbit.yaw) * horizontal,
      orbit.target.y + Math.sin(orbit.pitch) * orbit.distance,
      orbit.target.z + Math.cos(orbit.yaw) * horizontal,
    );
    camera.lookAt(orbit.target);
    camera.updateMatrixWorld();
    host.dataset.camera = camera.position.toArray().map((value) => value.toFixed(3)).join(',');
    host.dataset.orbitTarget = orbit.target.toArray().map((value) => value.toFixed(3)).join(',');
    host.dataset.orbitYaw = orbit.yaw.toFixed(6);
    host.dataset.orbitDistance = orbit.distance.toFixed(3);
    updateCameraDiagnostics();
    if (shouldInvalidate) invalidate();
  }

  function updateWalkCamera(shouldInvalidate = true) {
    camera.position.copy(walk.position);
    camera.rotation.order = 'YXZ';
    walk.yaw = normalizeRadians(walk.yaw);
    camera.rotation.y = walk.yaw;
    camera.rotation.x = walk.pitch;
    camera.updateMatrixWorld();
    host.dataset.camera = camera.position.toArray().map((value) => value.toFixed(3)).join(',');
    host.dataset.walkYaw = walk.yaw.toFixed(6);
    if (shouldInvalidate) invalidate();
  }

  function moveWalk(delta) {
    let x = 0;
    let z = 0;
    const forwardX = -Math.sin(walk.yaw);
    const forwardZ = -Math.cos(walk.yaw);
    const rightX = -forwardZ;
    const rightZ = forwardX;
    if (walk.keys.has('w') || walk.keys.has('arrowup')) { x += forwardX; z += forwardZ; }
    if (walk.keys.has('s') || walk.keys.has('arrowdown')) { x -= forwardX; z -= forwardZ; }
    if (walk.keys.has('d') || walk.keys.has('arrowright')) { x += rightX; z += rightZ; }
    if (walk.keys.has('a') || walk.keys.has('arrowleft')) { x -= rightX; z -= rightZ; }
    const length = Math.hypot(x, z);
    if (!length) return false;
    const distance = delta * 3.2 / length;
    walk.position.x = clamp(
      walk.position.x + x * distance,
      -dimensions.width / 2 + 0.18,
      dimensions.width / 2 - 0.18,
    );
    walk.position.z = clamp(
      walk.position.z + z * distance,
      -dimensions.depth / 2 + 0.18,
      dimensions.depth / 2 - 0.18,
    );
    updateWalkCamera(false);
    return true;
  }

  function renderFrame(time) {
    frameRequest = 0;
    if (disposed || contextLost) return;
    const delta = Math.min(0.05, Math.max(0, (time - previousTime) / 1000));
    previousTime = time;
    const keepAnimating = viewerMode === 'walk' && walk.keys.size > 0;
    if (keepAnimating) moveWalk(delta);
    renderer.render(scene, camera);
    if (keepAnimating) invalidate();
  }

  function invalidate() {
    if (disposed || contextLost || frameRequest) return;
    frameRequest = window.requestAnimationFrame(renderFrame);
  }

  function disposeDynamicResources() {
    temporaryTextures.forEach((texture) => texture.dispose());
    temporaryMaterials.forEach((material) => material.dispose());
    temporaryGeometries.forEach((geometry) => geometry.dispose());
    temporaryTextures.clear();
    temporaryMaterials.clear();
    temporaryGeometries.clear();
  }

  function clearDocumentGeometry() {
    if (dynamicRoot) {
      scene.remove(dynamicRoot);
      dynamicRoot.clear();
      dynamicRoot = null;
    }
    disposeDynamicResources();
    pickTargets = [];
    roomVisuals.clear();
    placementVisuals.clear();
  }

  function buildDocumentGeometry() {
    clearDocumentGeometry();
    dimensions = floorSize(state.floor);
    const sceneDiagonal = Math.hypot(dimensions.width, dimensions.depth);
    const distanceLimits = orbitDistanceLimits(dimensions.width, dimensions.depth);
    camera.far = Math.max(300, sceneDiagonal * 8);
    scene.fog.near = Math.max(45, distanceLimits.max * 0.7);
    scene.fog.far = Math.max(120, distanceLimits.max * 1.3);
    camera.updateProjectionMatrix();
    const shadowExtent = sceneDiagonal / 2 + 8;
    sun.shadow.camera.left = -shadowExtent;
    sun.shadow.camera.right = shadowExtent;
    sun.shadow.camera.top = shadowExtent;
    sun.shadow.camera.bottom = -shadowExtent;
    sun.shadow.camera.far = Math.max(100, sceneDiagonal * 2);
    sun.shadow.camera.updateProjectionMatrix();
    colorContext = createColorContext(state.rooms);
    dynamicRoot = new THREE.Group();
    const world = new THREE.Group();
    world.position.set(-dimensions.width / 2, 0, -dimensions.depth / 2);
    dynamicRoot.add(world);
    scene.add(dynamicRoot);

    const base = box(
      dimensions.width + 0.4,
      0.16,
      dimensions.depth + 0.4,
      baseMaterial,
      -0.08,
      unitBox,
    );
    base.position.x = dimensions.width / 2;
    base.position.z = dimensions.depth / 2;
    world.add(base);

    const grid = new THREE.GridHelper(
      Math.max(dimensions.width, dimensions.depth) + 20,
      32,
      0xaab5c1,
      0xcfd6de,
    );
    grid.position.y = -0.17;
    dynamicRoot.add(grid);
    if (grid.geometry) temporaryGeometries.add(grid.geometry);
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.filter(Boolean).forEach((material) => temporaryMaterials.add(material));

    const selectedRoomId = state.selected?.type === 'room' ? state.selected.id : '';
    const selectedPlacementId = state.selected?.type === 'placement' ? state.selected.id : '';
    const wallHeight = viewerMode === 'walk' ? 2.75 : 1.35;
    state.rooms.forEach((room) => {
      if (!Array.isArray(room.rect) || room.rect.length !== 4) return;
      const [x, z, width, depth] = room.rect.map((value) => Number(value) * CM_TO_M);
      if (![x, z, width, depth].every(Number.isFinite) || width <= 0 || depth <= 0) return;
      const isSelected = room.spaceId === selectedRoomId;
      const surface = box(
        Math.max(0.04, width - WALL_THICKNESS),
        0.055,
        Math.max(0.04, depth - WALL_THICKNESS),
        roomMaterial(room, isSelected),
        0.027,
        unitBox,
      );
      surface.position.x = x + width / 2;
      surface.position.z = z + depth / 2;
      surface.receiveShadow = true;
      entityData(surface, 'room', room.spaceId);
      world.add(surface);
      pickTargets.push(surface);

      const outline = new THREE.LineSegments(unitBoxEdges, outlineMaterial(isSelected));
      outline.position.copy(surface.position);
      outline.scale.copy(surface.scale);
      world.add(outline);
      roomVisuals.set(room.spaceId, { room, surface, outline });

      pickTargets.push(
        addWall(world, x + width / 2, z, width + WALL_THICKNESS, WALL_THICKNESS, wallHeight, wallMaterial, unitBox),
        addWall(world, x + width / 2, z + depth, width + WALL_THICKNESS, WALL_THICKNESS, wallHeight, wallMaterial, unitBox),
        addWall(world, x, z + depth / 2, WALL_THICKNESS, depth, wallHeight, wallMaterial, unitBox),
        addWall(world, x + width, z + depth / 2, WALL_THICKNESS, depth, wallHeight, wallMaterial, unitBox),
      );

      if (viewerMode === '3d') {
        const label = roomLabel(room, width, depth, resources);
        if (label) {
          label.position.x = x + width / 2;
          label.position.z = z + depth / 2;
          world.add(label);
        }
      }
    });

    state.placements.forEach((placement) => {
      const isSelected = placement.placementId === selectedPlacementId;
      const object = furnitureObject(placement, isSelected, resources);
      entityData(object, 'placement', placement.placementId);
      world.add(object);
      object.traverse((child) => { if (child.isMesh) pickTargets.push(child); });
      placementVisuals.set(placement.placementId, object);
    });

    host.dataset.rooms = String(state.rooms.length);
    host.dataset.placements = String(state.placements.length);
    renderer.shadowMap.needsUpdate = true;
    invalidate();
  }

  function getViewState() {
    return viewerMode === 'walk'
      ? { mode: viewerMode, position: walk.position.toArray(), yaw: walk.yaw, pitch: walk.pitch }
      : {
        mode: viewerMode,
        target: orbit.target.toArray(),
        yaw: orbit.yaw,
        pitch: orbit.pitch,
        distance: orbit.distance,
        aspect: camera.aspect,
        fitRatio: orbit.distance / currentFitDistance(),
      };
  }

  function restoreInitialView() {
    if (!initialViewState || initialViewState.mode !== viewerMode) return false;
    if (viewerMode === 'walk') {
      const position = initialViewState.position;
      if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)
        || !Number.isFinite(initialViewState.yaw) || !Number.isFinite(initialViewState.pitch)) return false;
      walk.position.fromArray(position);
      walk.position.x = clamp(walk.position.x, -dimensions.width / 2 + 0.18, dimensions.width / 2 - 0.18);
      walk.position.y = WALK_EYE_HEIGHT;
      walk.position.z = clamp(walk.position.z, -dimensions.depth / 2 + 0.18, dimensions.depth / 2 - 0.18);
      walk.yaw = initialViewState.yaw;
      walk.pitch = clamp(initialViewState.pitch, -1.35, 1.35);
      updateWalkCamera();
      return true;
    }
    const target = initialViewState.target;
    if (!Array.isArray(target) || target.length !== 3 || !target.every(Number.isFinite)
      || !Number.isFinite(initialViewState.yaw) || !Number.isFinite(initialViewState.pitch)
      || !Number.isFinite(initialViewState.distance)) return false;
    orbit.target.fromArray(target);
    orbit.yaw = initialViewState.yaw;
    orbit.pitch = initialViewState.pitch;
    const savedRatio = Number.isFinite(initialViewState.fitRatio) && initialViewState.fitRatio > 0
      ? initialViewState.fitRatio
      : Number.isFinite(initialViewState.aspect) && initialViewState.aspect > 0
        ? initialViewState.distance / currentFitDistance(initialViewState.aspect)
        : null;
    orbit.distance = savedRatio === null
      ? initialViewState.distance
      : currentFitDistance() * savedRatio;
    updateOrbitCamera();
    return true;
  }

  function reset() {
    if (viewerMode === 'walk') {
      const nextStart = startPoint(
        state.rooms,
        state.placements,
        dimensions.width,
        dimensions.depth,
        state.selected?.type === 'room' ? state.selected.id : '',
      );
      walk.position.copy(nextStart.position);
      walk.yaw = nextStart.yaw;
      walk.pitch = -0.04;
      walk.keys.clear();
      updateWalkCamera();
      return;
    }
    orbit.target.set(0, ORBIT_TARGET_HEIGHT, 0);
    orbit.yaw = -0.88;
    orbit.pitch = 0.72;
    orbit.distance = currentFitDistance();
    updateOrbitCamera();
  }

  function zoom(factor, pointer = null) {
    if (viewerMode !== '3d' || !Number.isFinite(factor) || factor <= 0) return;
    const bounds = pointer ? renderer.domElement.getBoundingClientRect() : null;
    const pointerInside = bounds && pointer.x >= bounds.left && pointer.x <= bounds.right
      && pointer.y >= bounds.top && pointer.y <= bounds.bottom;
    const anchor = pointerInside ? pointOnOrbitPlane(pointer.x, pointer.y) : null;
    orbit.distance *= factor;
    if (anchor) {
      updateOrbitCamera(false);
      const current = pointOnOrbitPlane(pointer.x, pointer.y);
      if (current) {
        orbit.target.x += anchor.x - current.x;
        orbit.target.z += anchor.z - current.z;
      }
    }
    updateOrbitCamera();
  }

  function resize() {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const requestedPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelRatio = Math.min(
      requestedPixelRatio,
      Math.sqrt(MAX_RENDER_PIXELS / Math.max(1, width * height)),
    );
    const previousAspect = camera.aspect;
    const preserveFitRatio = viewerMode === '3d' && viewport.width > 0 && viewport.height > 0;
    const fitRatio = preserveFitRatio
      ? orbit.distance / currentFitDistance(previousAspect)
      : null;
    const sizeChanged = width !== viewport.width || height !== viewport.height
      || Math.abs(pixelRatio - viewport.pixelRatio) > 0.001;
    viewport.width = width;
    viewport.height = height;
    viewport.pixelRatio = pixelRatio;
    if (sizeChanged) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (fitRatio !== null && Number.isFinite(fitRatio) && fitRatio > 0
        && Math.abs(camera.aspect - previousAspect) > 1e-6) {
        orbit.distance = currentFitDistance(camera.aspect) * fitRatio;
        updateOrbitCamera(false);
      }
    }
    host.dataset.cameraAspect = camera.aspect.toFixed(6);
    host.dataset.pixelRatio = pixelRatio.toFixed(3);
    if (viewerMode === '3d') updateCameraDiagnostics();
    invalidate();
  }

  function chooseEntity(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    rayPointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    rayPointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(rayPointer, camera);
    const entity = nearestPickEntity(raycaster.intersectObjects(pickTargets, false));
    if (entity) onSelect?.(entity.type, entity.id);
    else onSelect?.(null, null);
  }

  function panOrbitPixels(dx, dy) {
    const delta = perspectiveGroundPanDelta({
      deltaX: dx,
      deltaY: dy,
      distance: orbit.distance,
      fov: camera.fov,
      viewportHeight: viewport.height,
      yaw: orbit.yaw,
      pitch: orbit.pitch,
    });
    orbit.target.x += delta.x;
    orbit.target.z += delta.z;
    updateOrbitCamera();
  }

  function pointOnOrbitPlane(clientX, clientY, target = new THREE.Vector3()) {
    const bounds = renderer.domElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    rayPointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    rayPointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    camera.updateMatrixWorld();
    raycaster.setFromCamera(rayPointer, camera);
    const directionY = raycaster.ray.direction.y;
    if (directionY >= -0.01) return null;
    const distance = (ORBIT_TARGET_HEIGHT - raycaster.ray.origin.y) / directionY;
    if (!Number.isFinite(distance) || distance <= 0) return null;
    return target.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, distance);
  }

  function panOrbitToPointer(clientX, clientY, dx, dy) {
    const anchor = interaction.panAnchor;
    const current = anchor ? pointOnOrbitPlane(clientX, clientY) : null;
    if (!anchor || !current) {
      panOrbitPixels(dx, dy);
      return;
    }
    orbit.target.x += anchor.x - current.x;
    orbit.target.z += anchor.z - current.z;
    updateOrbitCamera();
  }

  function beginSingleTouch(pointerId, point, canSelect = true) {
    interaction.active = true;
    interaction.pointerId = pointerId;
    interaction.intent = canSelect ? 'touch-pan-select' : 'touch-pan';
    interaction.startX = point.x;
    interaction.startY = point.y;
    interaction.lastX = point.x;
    interaction.lastY = point.y;
    interaction.maxDistance = 0;
    interaction.panStarted = !canSelect;
    interaction.clickTolerance = 10;
    interaction.panAnchor = pointOnOrbitPlane(point.x, point.y);
    previousTouchGesture = null;
  }

  function beginTouch(event) {
    event.preventDefault();
    renderer.domElement.focus({ preventScroll: true });
    touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { renderer.domElement.setPointerCapture?.(event.pointerId); } catch { /* synthetic event */ }
    if (touchPointers.size === 1) {
      beginSingleTouch(event.pointerId, touchPointers.get(event.pointerId));
      return;
    }
    const gesture = touchGestureMetrics([...touchPointers.values()]);
    if (!gesture) return;
    interaction.active = true;
    interaction.pointerId = touchPointers.keys().next().value;
    interaction.intent = 'touch-transform';
    interaction.maxDistance = Number.POSITIVE_INFINITY;
    interaction.panStarted = true;
    interaction.panAnchor = pointOnOrbitPlane(gesture.x, gesture.y);
    previousTouchGesture = gesture;
  }

  function moveTouch(event) {
    if (!touchPointers.has(event.pointerId)) return;
    event.preventDefault();
    touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touchPointers.size === 1) {
      if (interaction.pointerId !== event.pointerId) return;
      const dx = event.clientX - interaction.lastX;
      const dy = event.clientY - interaction.lastY;
      interaction.lastX = event.clientX;
      interaction.lastY = event.clientY;
      interaction.maxDistance = Math.max(
        interaction.maxDistance,
        Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY),
      );
      if (interaction.maxDistance <= interaction.clickTolerance) return;
      const panDx = interaction.panStarted ? dx : event.clientX - interaction.startX;
      const panDy = interaction.panStarted ? dy : event.clientY - interaction.startY;
      interaction.panStarted = true;
      panOrbitToPointer(event.clientX, event.clientY, panDx, panDy);
      return;
    }

    const nextGesture = touchGestureMetrics([...touchPointers.values()]);
    if (!nextGesture || !previousTouchGesture) {
      previousTouchGesture = nextGesture;
      return;
    }
    const previous = previousTouchGesture;
    const anchor = interaction.panAnchor || pointOnOrbitPlane(previous.x, previous.y);
    if (previous.distance > 4 && nextGesture.distance > 4) {
      orbit.distance *= previous.distance / nextGesture.distance;
    }
    orbit.yaw -= normalizeRadians(nextGesture.angle - previous.angle);
    updateOrbitCamera(false);
    interaction.panAnchor = anchor;
    panOrbitToPointer(
      nextGesture.x,
      nextGesture.y,
      nextGesture.x - previous.x,
      nextGesture.y - previous.y,
    );
    interaction.panAnchor = pointOnOrbitPlane(nextGesture.x, nextGesture.y);
    previousTouchGesture = nextGesture;
  }

  function endTouch(event, allowSelection = false) {
    if (!touchPointers.has(event.pointerId)) return;
    const shouldSelect = allowSelection
      && touchPointers.size === 1
      && interaction.intent === 'touch-pan-select'
      && interaction.maxDistance <= interaction.clickTolerance;
    touchPointers.delete(event.pointerId);
    if (touchPointers.size >= 2) {
      previousTouchGesture = touchGestureMetrics([...touchPointers.values()]);
      interaction.panAnchor = previousTouchGesture
        ? pointOnOrbitPlane(previousTouchGesture.x, previousTouchGesture.y)
        : null;
      return;
    }
    if (touchPointers.size === 1) {
      const [pointerId, point] = touchPointers.entries().next().value;
      beginSingleTouch(pointerId, point, false);
      return;
    }
    endInteraction();
    if (shouldSelect) chooseEntity(event);
  }

  function endInteraction(pointerId = null) {
    if (!interaction.active || (pointerId !== null && pointerId !== interaction.pointerId)) return false;
    interaction.active = false;
    interaction.pointerId = null;
    interaction.intent = '';
    interaction.maxDistance = 0;
    interaction.panAnchor = null;
    interaction.panStarted = false;
    interaction.clickTolerance = POINTER_CLICK_TOLERANCE;
    touchPointers.clear();
    previousTouchGesture = null;
    return true;
  }

  function captureDragLook(pointerId) {
    if (!interaction.active || interaction.pointerId !== pointerId) return;
    try { renderer.domElement.setPointerCapture?.(pointerId); } catch { /* pointer already ended */ }
    if (!pointerLockFallbackAnnounced) {
      pointerLockFallbackAnnounced = true;
      onAnnounce?.('Zeigersperre nicht verfügbar. Halten und ziehen Sie die Maus, um sich umzusehen.');
    }
  }

  function updateSelection(nextSelected = null) {
    state.selected = nextSelected;
    const selectedRoomId = nextSelected?.type === 'room' ? nextSelected.id : '';
    const selectedPlacementId = nextSelected?.type === 'placement' ? nextSelected.id : '';
    roomVisuals.forEach((visual, id) => {
      const isSelected = id === selectedRoomId;
      visual.surface.material = roomMaterial(visual.room, isSelected);
      visual.outline.material = outlineMaterial(isSelected);
    });
    placementVisuals.forEach((object, id) => {
      const isSelected = id === selectedPlacementId;
      object.traverse((child) => {
        if (child.isMesh && child.userData.materialRole) {
          child.material = resources.furnitureMaterial(child.userData.materialRole, isSelected);
        }
      });
    });
    invalidate();
  }

  function updateColors(nextColorMode, nextRooms = state.rooms) {
    state.colorMode = normalizeColorMode(nextColorMode);
    if (Array.isArray(nextRooms)) state.rooms = nextRooms;
    colorContext = createColorContext(state.rooms);
    const roomById = new Map(state.rooms.map((room) => [room.spaceId, room]));
    const selectedRoomId = state.selected?.type === 'room' ? state.selected.id : '';
    roomVisuals.forEach((visual, id) => {
      visual.room = roomById.get(id) || visual.room;
      visual.surface.material = roomMaterial(visual.room, id === selectedRoomId);
    });
    invalidate();
  }

  function updateDocument(next = {}) {
    if (disposed || !next || typeof next !== 'object') return false;
    state.floor = next.floor || state.floor;
    state.rooms = Array.isArray(next.rooms) ? next.rooms : state.rooms;
    state.placements = Array.isArray(next.placements) ? next.placements : state.placements;
    state.selected = Object.hasOwn(next, 'selected') ? next.selected : state.selected;
    state.colorMode = Object.hasOwn(next, 'colorMode')
      ? normalizeColorMode(next.colorMode)
      : state.colorMode;
    buildDocumentGeometry();
    if (viewerMode === 'walk') {
      walk.position.x = clamp(walk.position.x, -dimensions.width / 2 + 0.18, dimensions.width / 2 - 0.18);
      walk.position.y = WALK_EYE_HEIGHT;
      walk.position.z = clamp(walk.position.z, -dimensions.depth / 2 + 0.18, dimensions.depth / 2 - 0.18);
      updateWalkCamera();
    } else {
      updateOrbitCamera();
    }
    return true;
  }

  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    walk.keys.clear();
    endInteraction();
    if (frameRequest) window.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    renderer.domElement.setAttribute('aria-busy', 'true');
    host.dataset.context = 'lost';
    contextStatus?.remove();
    contextStatus = document.createElement('div');
    contextStatus.className = 'fpe-three-fallback fpe-three-context-status';
    contextStatus.setAttribute('role', 'alert');
    contextStatus.style.background = 'var(--color-bg, #fff)';
    const title = document.createElement('strong');
    title.textContent = '3D-Darstellung unterbrochen';
    const detail = document.createElement('span');
    detail.textContent = 'Der Grafikkontext wurde verloren. Die Wiederherstellung läuft.';
    contextStatus.append(title, detail);
    host.append(contextStatus);
    onAnnounce?.('3D-Darstellung unterbrochen. Wiederherstellung läuft.');
  }, { signal });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    renderer.domElement.removeAttribute('aria-busy');
    host.dataset.context = 'ready';
    contextStatus?.remove();
    contextStatus = null;
    previousTime = performance.now();
    renderer.shadowMap.needsUpdate = true;
    invalidate();
    onAnnounce?.('3D-Darstellung wiederhergestellt.');
  }, { signal });
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (viewerMode === '3d' && event.pointerType === 'touch') {
      beginTouch(event);
      return;
    }
    // Explicit button intent keeps synthetic PointerEvents and assistive input
    // interoperable while touch uses its own multi-pointer gesture state.
    if (interaction.active) return;
    const intent = viewerMode === 'walk'
      ? (event.button === 0 ? 'look' : '')
      : (event.button === 0 ? 'pan-select' : event.button === 1 ? 'pan' : event.button === 2 ? 'rotate' : '');
    if (!intent) return;
    event.preventDefault();
    renderer.domElement.focus({ preventScroll: true });
    interaction.active = true;
    interaction.pointerId = event.pointerId;
    interaction.intent = intent;
    interaction.startX = event.clientX;
    interaction.startY = event.clientY;
    interaction.lastX = event.clientX;
    interaction.lastY = event.clientY;
    interaction.maxDistance = 0;
    interaction.panStarted = false;
    interaction.clickTolerance = event.pointerType === 'pen' ? 6 : POINTER_CLICK_TOLERANCE;
    interaction.panAnchor = intent === 'pan-select' || intent === 'pan'
      ? pointOnOrbitPlane(event.clientX, event.clientY)
      : null;
    if (viewerMode === 'walk' && document.pointerLockElement !== renderer.domElement) {
      if (typeof renderer.domElement.requestPointerLock !== 'function') {
        captureDragLook(event.pointerId);
      } else {
        try {
          const request = renderer.domElement.requestPointerLock();
          request?.catch?.(() => captureDragLook(event.pointerId));
        } catch {
          captureDragLook(event.pointerId);
        }
      }
    } else {
      try { renderer.domElement.setPointerCapture?.(event.pointerId); } catch { /* synthetic event */ }
    }
  }, { signal });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (viewerMode === '3d' && event.pointerType === 'touch') {
      moveTouch(event);
      return;
    }
    if (!interaction.active || interaction.pointerId !== event.pointerId
      || document.pointerLockElement === renderer.domElement) return;
    const dx = event.clientX - interaction.lastX;
    const dy = event.clientY - interaction.lastY;
    interaction.lastX = event.clientX;
    interaction.lastY = event.clientY;
    interaction.maxDistance = Math.max(
      interaction.maxDistance,
      Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY),
    );
    if (interaction.intent === 'look') {
      walk.yaw -= dx * WALK_LOOK_YAW_PER_PIXEL;
      walk.pitch = clamp(walk.pitch - dy * WALK_LOOK_PITCH_PER_PIXEL, -1.35, 1.35);
      updateWalkCamera();
    } else if (interaction.intent === 'pan-select' || interaction.intent === 'pan') {
      if (interaction.maxDistance <= interaction.clickTolerance) return;
      const panDx = interaction.panStarted ? dx : event.clientX - interaction.startX;
      const panDy = interaction.panStarted ? dy : event.clientY - interaction.startY;
      interaction.panStarted = true;
      panOrbitToPointer(event.clientX, event.clientY, panDx, panDy);
    } else if (interaction.intent === 'rotate') {
      const delta = orbitRotationDelta({
        deltaX: dx,
        deltaY: dy,
        viewportHeight: viewport.height,
      });
      orbit.yaw += delta.yaw;
      orbit.pitch += delta.pitch;
      updateOrbitCamera();
    }
  }, { signal });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (viewerMode === '3d' && event.pointerType === 'touch') {
      endTouch(event, true);
      return;
    }
    if (!interaction.active || interaction.pointerId !== event.pointerId) return;
    const shouldSelect = viewerMode === '3d'
      && interaction.intent === 'pan-select'
      && interaction.maxDistance <= interaction.clickTolerance;
    endInteraction(event.pointerId);
    if (shouldSelect) chooseEntity(event);
  }, { signal });
  renderer.domElement.addEventListener('pointercancel', (event) => {
    if (viewerMode === '3d' && event.pointerType === 'touch') endTouch(event, false);
    else endInteraction(event.pointerId);
  }, { signal });
  renderer.domElement.addEventListener('lostpointercapture', (event) => {
    if (viewerMode === '3d' && event.pointerType === 'touch') endTouch(event, false);
    else endInteraction(event.pointerId);
  }, { signal });
  renderer.domElement.addEventListener('wheel', (event) => {
    if (viewerMode !== '3d') return;
    event.preventDefault();
    const delta = clamp(normalizeWheelPixels(event, viewport.height), -240, 240);
    zoom(Math.exp(delta * 0.001), { x: event.clientX, y: event.clientY });
  }, { signal, passive: false });

  document.addEventListener('mousemove', (event) => {
    if (viewerMode !== 'walk' || document.pointerLockElement !== renderer.domElement) return;
    walk.yaw -= event.movementX * WALK_LOOK_YAW_PER_PIXEL;
    walk.pitch = clamp(walk.pitch - event.movementY * WALK_LOOK_PITCH_PER_PIXEL, -1.35, 1.35);
    updateWalkCamera();
  }, { signal });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== renderer.domElement) endInteraction();
  }, { signal });
  document.addEventListener('pointerlockerror', () => {
    if (viewerMode === 'walk' && interaction.active) captureDragLook(interaction.pointerId);
  }, { signal });
  window.addEventListener('keydown', (event) => {
    const focused = document.activeElement === renderer.domElement
      || document.pointerLockElement === renderer.domElement;
    if (!focused) return;
    const key = event.key.toLocaleLowerCase();
    if (viewerMode === 'walk') {
      if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) return;
      event.preventDefault();
      walk.keys.add(key);
      previousTime = performance.now();
      invalidate();
      return;
    }

    if (key === '+' || key === '=' || event.code === 'NumpadAdd') {
      event.preventDefault();
      zoom(0.84);
      return;
    }
    if (key === '-' || key === '_' || event.code === 'NumpadSubtract') {
      event.preventDefault();
      zoom(1.19);
      return;
    }
    if (key === 'home') {
      event.preventDefault();
      reset();
      return;
    }
    if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) return;
    event.preventDefault();
    if (event.shiftKey) {
      if (key === 'arrowleft') orbit.yaw += 0.09;
      if (key === 'arrowright') orbit.yaw -= 0.09;
      if (key === 'arrowup') orbit.pitch += 0.07;
      if (key === 'arrowdown') orbit.pitch -= 0.07;
      updateOrbitCamera();
      return;
    }
    const pixelStep = 36;
    if (key === 'arrowleft') panOrbitPixels(-pixelStep, 0);
    if (key === 'arrowright') panOrbitPixels(pixelStep, 0);
    if (key === 'arrowup') panOrbitPixels(0, -pixelStep);
    if (key === 'arrowdown') panOrbitPixels(0, pixelStep);
  }, { signal });
  window.addEventListener('keyup', (event) => {
    walk.keys.delete(event.key.toLocaleLowerCase());
  }, { signal });
  window.addEventListener('blur', () => {
    walk.keys.clear();
    endInteraction();
  }, { signal });
  window.addEventListener('resize', resize, { signal });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  buildDocumentGeometry();
  resize();
  if (!restoreInitialView()) reset();
  onAnnounce?.(`${viewerMode === 'walk' ? 'Begehungsvorschau' : '3D-Modell'} mit Three.js r${THREE.REVISION} geladen.`);

  return {
    reset,
    zoom,
    updateSelection,
    updateColors,
    updateDocument,
    getViewState,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      if (frameRequest) window.cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      resizeObserver.disconnect();
      abort.abort();
      contextStatus?.remove();
      contextStatus = null;
      clearDocumentGeometry();
      persistentMaterials.forEach((material) => material.dispose());
      persistentMaterials.clear();
      reusableGeometries.forEach((geometry) => geometry.dispose());
      reusableGeometries.clear();
      renderer.dispose();
    },
  };
}

export default { createFloorplanThreeViewer };
