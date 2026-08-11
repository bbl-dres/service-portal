// Retained, interactive Three.js viewer for the floor-plan editor. Geometry is
// derived from the same browser-local document as the SVG editor.

import * as THREE from '../vendor/three.module.min.js';
import { PLACEMENT_PREVIEW, createColorContext, normalizeColorMode, roomColor } from './colors.js';
// The widget's geometry is shared with the 2D plan, so the two views cannot
// drift: only the conversion from plan centimetres to world metres happens here.
import { originFromCentre, rotationFromPoint, widgetGeometry } from './transform-widget.js';
import {
  CM_TO_M,
  WALK_EYE_HEIGHT,
  WALL_THICKNESS,
  POINTER_CLICK_TOLERANCE,
  ORBIT_TARGET_HEIGHT,
  ORBIT_SCENE_HEIGHT,
  ORBIT_MIN_PITCH,
  ORBIT_MAX_PITCH,
  WALK_LOOK_YAW_PER_PIXEL,
  WALK_LOOK_PITCH_PER_PIXEL,
  MAX_RENDER_PIXELS,
  clamp,
  normalizeRadians,
  orbitDistanceLimits,
  minimumOrbitDistanceForPitch,
  perspectiveGroundPanDelta,
  orbitRotationDelta,
  normalizeWheelPixels,
  touchGestureMetrics,
  fitOrbitDistance,
} from './three-controls.js';
import {
  floorSize,
  entityData,
  box,
  furnitureObject,
  placeFurnitureObject,
  roomLabel,
  addWall,
  nearestPickEntity,
  startPoint,
  fallbackViewer,
} from './three-scene.js';

export {
  normalizeRadians,
  orbitDistanceLimits,
  minimumOrbitDistanceForPitch,
  perspectiveGroundPanDelta,
  orbitRotationDelta,
  normalizeWheelPixels,
  touchGestureMetrics,
  fitOrbitDistance,
  nearestPickEntity,
};

export function createFloorplanThreeViewer({
  // Authoring in 3D. `editable` arms the widget and floor clicks; the two
  // callbacks report plan-unit results so the controller never has to know about
  // metres, the world offset or Three.js at all.
  editable = false,
  onTransform,
  onFloorClick,
  // Reports the floor point under the pointer, in plan units, so the controller can
  // compute the placement preview with the same room test the 2D plan uses. Null
  // when the pointer is off the floor or off the canvas.
  onFloorHover,
  // The plan's camera, so the model opens on the same place at the same zoom.
  // `{ centre: {x, y} }` in plan units, `fitRatio` relative to «everything fits».
  initialCamera = null,
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
    // The placement preview, in plan units, exactly as the 2D canvas receives it.
    ghost: null,
  };
  let dimensions = floorSize(state.floor);
  let colorContext = createColorContext(state.rooms);
  let disposed = false;
  let contextLost = false;
  let frameRequest = 0;
  let previousTime = performance.now();
  let dynamicRoot = null;
  // The group that holds the plan's own coordinate frame: offset by half the
  // extent, so a child at `plan * CM_TO_M` lands where its room does. The widget
  // has to be a child of THIS, not of dynamicRoot, or it sits half a floor away.
  let worldRoot = null;
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
    publishGripPositions();
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
      worldRoot = null;
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
    worldRoot = world;
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
    buildWidget();
    buildGhost();
    invalidate();
  }

  // --- Transform widget -----------------------------------------------------
  // The same anatomy as the 2D plan, laid flat on the floor: a ring as the
  // rotation track, a grip on it at the object's front, a grip in the middle for
  // moving. Geometry comes from transform-widget.js in PLAN units, so the two
  // views cannot drift apart — only the conversion to metres happens here.
  let widgetGroup = null;
  let widgetTargets = [];

  // Plan centimetres to world metres, inside the `world` group's own frame.
  const planToLocal = (planX, planY) => ({ x: planX * CM_TO_M, z: planY * CM_TO_M });
  // And back, from a point in WORLD space.
  const worldToPlan = (point) => ({
    x: (point.x + dimensions.width / 2) / CM_TO_M,
    y: (point.z + dimensions.depth / 2) / CM_TO_M,
  });

  // --- Placement preview ----------------------------------------------------
  // The 2D plan shows a translucent footprint under the pointer while a product is
  // armed, tinted by whether it lands inside a room. The model showed nothing, so
  // placing there was a blind click. Same source of truth: the controller computes
  // the ghost in PLAN units with the same `containingRoom` test, and the viewer only
  // renders it — so the two views cannot disagree about what is valid.
  let ghostGroup = null;

  function clearGhost() {
    if (!ghostGroup) return;
    // Not `isMesh`: the outline is a LineSegments, and an isMesh-only traversal left
    // its geometry and material behind on every pointer move.
    ghostGroup.traverse((child) => {
      child.geometry?.dispose?.();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((entry) => entry?.dispose?.());
      else material?.dispose?.();
    });
    ghostGroup.parent?.remove(ghostGroup);
    ghostGroup = null;
  }

  function buildGhost() {
    clearGhost();
    const ghost = state.ghost;
    if (!editable || viewerMode !== '3d' || !worldRoot || !ghost) {
      delete host.dataset.ghost;
      return;
    }
    const width = Math.max(18, Number(ghost.width) || 60) * CM_TO_M;
    const depth = Math.max(18, Number(ghost.depth) || 60) * CM_TO_M;
    const height = Math.max(10, Number(ghost.height) || 75) * CM_TO_M;
    const centre = planToLocal(
      (Number(ghost.x) || 0) + (Number(ghost.width) || 60) / 2,
      (Number(ghost.y) || 0) + (Number(ghost.depth) || 60) / 2,
    );
    const group = new THREE.Group();
    group.position.set(centre.x, 0, centre.z);
    group.rotation.y = -THREE.MathUtils.degToRad(Number(ghost.rotation) || 0);

    // Two parts, as in the plan: a footprint on the floor and the volume above it.
    // The footprint is what tells someone whether the object fits; the volume tells
    // them how much of the view it will take.
    const tint = ghost.valid ? PLACEMENT_PREVIEW.valid.rgb : PLACEMENT_PREVIEW.invalid.rgb;
    const footprint = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshBasicMaterial({
        color: tint, transparent: true, opacity: 0.34,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    footprint.rotation.x = -Math.PI / 2;
    // Just clear of the floor, or the two planes fight over the same depth.
    footprint.position.y = 0.01;
    group.add(footprint);

    // One box, used for both the volume and its outline. Building a second one just to
    // feed EdgesGeometry orphaned it on the spot, every pointer move.
    const boxGeometry = new THREE.BoxGeometry(width, height, depth);
    const volume = new THREE.Mesh(
      boxGeometry,
      new THREE.MeshBasicMaterial({
        color: tint, transparent: true, opacity: 0.16, depthWrite: false,
      }),
    );
    volume.position.y = height / 2;
    group.add(volume);

    const outlineGeometry = new THREE.EdgesGeometry(boxGeometry);
    const edges = new THREE.LineSegments(
      outlineGeometry,
      new THREE.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.7 }),
    );
    edges.position.y = height / 2;
    group.add(edges);

    // The preview is not a pick target: a click through it has to reach the floor,
    // which is what actually places the object.
    group.traverse((child) => { child.raycast = () => {}; });

    worldRoot.add(group);
    ghostGroup = group;
    // Published like the widget grips, so a test can assert the preview without
    // reading pixels.
    host.dataset.ghost = `${ghost.valid ? 'valid' : 'invalid'}:${Math.round(Number(ghost.x) || 0)},${Math.round(Number(ghost.y) || 0)}`;
  }

  /**
   * Move existing furniture without rebuilding the floor.
   *
   * A drag changes placement transforms and nothing else, but the only update entry
   * point was `updateDocument`, which calls `buildDocumentGeometry` unconditionally.
   * That meant every pointer move re-created every room slab, outline and wall, a
   * fresh GridHelper, and — worst — one 512x128 canvas plus a CanvasTexture per room
   * label. On a 43-space floor that is ~43 canvases and textures and ~215 meshes per
   * move, with a full shadow pass behind it.
   *
   * Falls back to a full rebuild when the SET of placements changed, because moving
   * transforms cannot add or remove an object.
   */
  function updatePlacements(placements = state.placements, nextSelected = state.selected) {
    if (disposed) return false;
    const next = Array.isArray(placements) ? placements : state.placements;
    const sameSet = next.length === placementVisuals.size
      && next.every((placement) => placementVisuals.has(placement.placementId));
    state.placements = next;
    state.selected = nextSelected === undefined ? state.selected : nextSelected;
    if (!sameSet) {
      buildDocumentGeometry();
      return true;
    }
    next.forEach((placement) => {
      const object = placementVisuals.get(placement.placementId);
      if (object) placeFurnitureObject(object, placement);
    });
    buildWidget();
    invalidate();
    return true;
  }

  /** Replace the placement preview without rebuilding the document. */
  function updateGhost(nextGhost = null) {
    state.ghost = nextGhost || null;
    buildGhost();
    invalidate();
  }

  function clearWidget() {
    if (!widgetGroup) return;
    // Materials as well as geometry, and on every node rather than on meshes only: the
    // widget is rebuilt on every selection change and every transform, so a material
    // left behind here leaks once per interaction.
    widgetGroup.traverse((child) => {
      child.geometry?.dispose?.();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((entry) => entry?.dispose?.());
      else material?.dispose?.();
    });
    widgetGroup.parent?.remove(widgetGroup);
    widgetGroup = null;
    widgetTargets = [];
  }

  function buildWidget() {
    clearWidget();
    // Every early return has to retract the diagnostic too. It was written once, on
    // success, and never cleared — so `dataset.widget` still read 'placement' after
    // deselecting, and any check that trusted it was reading the last selection.
    const noWidget = () => { delete host.dataset.widget; };
    if (!editable || viewerMode !== '3d' || !worldRoot) return noWidget();
    if (state.selected?.type !== 'placement') return noWidget();
    const placement = state.placements.find((item) => item.placementId === state.selected.id);
    const widget = widgetGeometry(placement);
    if (!widget) return noWidget();

    const group = new THREE.Group();
    // Just above the slab so the ring is not swallowed by z-fighting with it.
    const lift = 0.012;
    const radius = widget.radius * CM_TO_M;
    const centre = planToLocal(widget.cx, widget.cy);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x828e9a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.012, radius + 0.012, 72), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(centre.x, lift, centre.z);
    ring.renderOrder = 10;
    group.add(ring);

    // The arm from the centre to the rotate grip states the object's facing.
    const handle = planToLocal(widget.handle.x, widget.handle.y);
    const armMaterial = new THREE.MeshBasicMaterial({ color: 0x92400e, depthTest: false });
    const arm = new THREE.Mesh(new THREE.PlaneGeometry(radius, 0.022), armMaterial);
    arm.rotation.x = -Math.PI / 2;
    arm.position.set((centre.x + handle.x) / 2, lift, (centre.z + handle.z) / 2);
    arm.rotation.z = -Math.atan2(handle.z - centre.z, handle.x - centre.x);
    arm.renderOrder = 11;
    group.add(arm);

    // Grips are spheres rather than discs: at a shallow camera pitch a flat disc
    // becomes a line and stops being aimable.
    const grip = (x, z, colour, role) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 20, 14),
        new THREE.MeshBasicMaterial({ color: colour, depthTest: false }),
      );
      mesh.position.set(x, lift + 0.06, z);
      mesh.renderOrder = 12;
      mesh.userData.widget = role;
      group.add(mesh);
      widgetTargets.push(mesh);
      return mesh;
    };
    grip(handle.x, handle.z, 0x92400e, 'rotate');
    grip(centre.x, centre.z, 0x1d4ed8, 'move');

    worldRoot.add(group);
    widgetGroup = group;
    host.dataset.widget = 'placement';
    publishGripPositions();
    invalidate();
  }

  /**
   * Where the two grips currently sit on screen, as `role:x,y` pairs relative to
   * the canvas. The viewer already reports its camera this way (`orbitTarget`,
   * `orbitFitRatio`, `pixelRatio`), and a grip is a small target on a large
   * floor: without this, aiming at one from a test means sweeping the canvas and
   * hoping. Recomputed whenever the camera moves.
   */
  function publishGripPositions() {
    if (!widgetTargets.length) {
      delete host.dataset.widgetGrips;
      return;
    }
    const bounds = renderer.domElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const point = new THREE.Vector3();
    host.dataset.widgetGrips = widgetTargets.map((mesh) => {
      mesh.getWorldPosition(point).project(camera);
      const x = Math.round((point.x + 1) / 2 * bounds.width);
      const y = Math.round((1 - point.y) / 2 * bounds.height);
      return `${mesh.userData.widget}:${x},${y}`;
    }).join('|');
  }

  /** The floor plane at y = 0, which is where furniture stands. */
  function pointOnFloor(clientX, clientY, target = new THREE.Vector3()) {
    const bounds = renderer.domElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    rayPointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    rayPointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    camera.updateMatrixWorld();
    raycaster.setFromCamera(rayPointer, camera);
    const directionY = raycaster.ray.direction.y;
    if (directionY >= -0.001) return null;
    const distance = -raycaster.ray.origin.y / directionY;
    if (!Number.isFinite(distance) || distance <= 0) return null;
    return target.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, distance);
  }

  /** Which widget grip, if any, is under the pointer. */
  function gripAt(clientX, clientY) {
    if (!widgetTargets.length) return '';
    const bounds = renderer.domElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return '';
    rayPointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    rayPointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(rayPointer, camera);
    const hit = raycaster.intersectObjects(widgetTargets, false)[0];
    return hit?.object?.userData?.widget || '';
  }

  function selectedPlacement() {
    return state.selected?.type === 'placement'
      ? state.placements.find((item) => item.placementId === state.selected.id)
      : null;
  }

  // A widget drag reports plan units on every move so the controller can redraw
  // its own document; the viewer keeps no authoritative copy.
  function dragWidget(clientX, clientY) {
    const placement = selectedPlacement();
    if (!placement || !interaction.grip) return;
    const point = pointOnFloor(clientX, clientY);
    if (!point) return;
    const plan = worldToPlan(point);
    if (interaction.grip === 'move') {
      const origin = originFromCentre(placement, plan.x, plan.y);
      onTransform?.(placement.placementId, { x: origin.x, y: origin.y });
      return;
    }
    const widget = widgetGeometry(placement);
    const rotation = rotationFromPoint(widget.cx, widget.cy, plan.x, plan.y);
    if (rotation !== placement.rotation) onTransform?.(placement.placementId, { rotation });
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
        // The same camera expressed in plan units, so the 2D view can adopt it on
        // the way back and the switch is symmetric.
        plan: {
          centre: {
            x: (orbit.target.x + dimensions.width / 2) / CM_TO_M,
            y: (orbit.target.z + dimensions.depth / 2) / CM_TO_M,
          },
          fitRatio: orbit.distance / currentFitDistance(),
        },
      };
  }

  /**
   * Adopt the plan's centre and zoom. Both views express zoom as a ratio of
   * «everything fits», which is unit-free, so the ratio transfers directly and
   * the centre only needs the centimetre-to-metre mapping the geometry uses.
   */
  function adoptPlanCamera() {
    const centre = initialCamera?.centre;
    if (viewerMode !== '3d' || !centre
      || ![centre.x, centre.y].every(Number.isFinite)
      || !Number.isFinite(initialCamera.fitRatio) || initialCamera.fitRatio <= 0) return false;
    orbit.target.x = clamp(centre.x * CM_TO_M - dimensions.width / 2,
      -dimensions.width / 2, dimensions.width / 2);
    orbit.target.z = clamp(centre.y * CM_TO_M - dimensions.depth / 2,
      -dimensions.depth / 2, dimensions.depth / 2);
    orbit.distance = currentFitDistance() * clamp(initialCamera.fitRatio, 0.2, 1.6);
    updateOrbitCamera();
    return true;
  }

  function restoreInitialView() {
    // A camera remembered for THIS mode wins; the plan's camera is the fallback,
    // which is what makes a first switch into 3D land where the plan was.
    if (!initialViewState || initialViewState.mode !== viewerMode) return adoptPlanCamera();
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
    buildWidget();
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
    // The preview travels with the document, so disarming the tool takes the ghost
    // with it. Without this the viewer would rebuild the LAST ghost it was given and
    // strand a footprint on the floor with nothing armed.
    if (Object.hasOwn(next, 'ghost')) state.ghost = next.ghost || null;
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
    // `forceContextLoss()` in dispose() synthesises this event on the canvas being torn
    // down. Reacting to it would paint a status banner into a viewer that no longer
    // exists and re-arm a frame loop that was just cancelled.
    if (disposed) return;
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
    // A grip is grabbed before anything else: it sits over the object and, for
    // the ring, over whatever floor lies beyond it, so an orbit-pan would
    // otherwise swallow every drag of it.
    const grip = viewerMode === '3d' && editable && event.button === 0
      ? gripAt(event.clientX, event.clientY) : '';
    const intent = grip ? 'widget'
      : viewerMode === 'walk'
        ? (event.button === 0 ? 'look' : '')
        : (event.button === 0 ? 'pan-select' : event.button === 1 ? 'pan' : event.button === 2 ? 'rotate' : '');
    if (!intent) return;
    interaction.grip = grip;
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
    // The placement preview follows the pointer even when nothing is being dragged,
    // which is the whole point of a preview. `onFloorHover` is only supplied while a
    // product is armed, so this costs nothing the rest of the time.
    if (!interaction.active && onFloorHover && editable && viewerMode === '3d') {
      const hover = pointOnFloor(event.clientX, event.clientY);
      onFloorHover(hover ? worldToPlan(hover) : null);
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
    if (interaction.intent === 'widget') {
      dragWidget(event.clientX, event.clientY);
    } else if (interaction.intent === 'look') {
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
    const wasWidget = interaction.intent === 'widget';
    const shouldSelect = viewerMode === '3d'
      && interaction.intent === 'pan-select'
      && interaction.maxDistance <= interaction.clickTolerance;
    endInteraction(event.pointerId);
    // A finished widget drag is committed by the controller, and it must not also
    // count as a selection click.
    if (wasWidget) { onTransform?.(null, null, { done: true }); return; }
    if (!shouldSelect) return;
    // With placing armed, a click on the floor asks for a product there; the
    // controller decides whether it is allowed. Otherwise the click selects.
    if (editable && onFloorClick) {
      const point = pointOnFloor(event.clientX, event.clientY);
      if (point && onFloorClick(worldToPlan(point))) return;
    }
    chooseEntity(event);
  }, { signal });
  renderer.domElement.addEventListener('pointerleave', () => {
    if (onFloorHover && editable && viewerMode === '3d') onFloorHover(null);
  }, { signal });
  // An interrupted widget drag has to report the interruption. Both of these routed
  // straight to `endInteraction`, which clears `interaction` without telling the
  // controller — so the mutation the drag had already applied stayed in the document
  // outside history and outside `dirty`, and `threeTransformBefore` survived to be
  // used as the rollback snapshot of the NEXT drag.
  const abandonInteraction = (event) => {
    const wasWidget = interaction.active && interaction.intent === 'widget';
    if (viewerMode === '3d' && event.pointerType === 'touch') endTouch(event, false);
    else endInteraction(event.pointerId);
    if (wasWidget) onTransform?.(null, null, { done: true, cancelled: true });
  };
  renderer.domElement.addEventListener('pointercancel', abandonInteraction, { signal });
  renderer.domElement.addEventListener('lostpointercapture', abandonInteraction, { signal });
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
    refreshWidget: buildWidget,
    updateGhost,
    updatePlacements,
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
      clearWidget();
      clearGhost();
      clearDocumentGeometry();
      persistentMaterials.forEach((material) => material.dispose());
      persistentMaterials.clear();
      reusableGeometries.forEach((geometry) => geometry.dispose());
      reusableGeometries.clear();
      // `dispose()` frees Three's own objects but NOT the WebGL context. Every rail
      // toggle and every view switch builds a new renderer, so the contexts piled up
      // until the browser started killing the oldest ones from under a live viewer.
      try { renderer.forceContextLoss(); } catch { /* context already gone */ }
      renderer.dispose();
    },
  };
}
