// Interactive Three.js renderer for the Plan-Editor feedback prototype.
// Geometry is generated from the same browser-local room and placement model
// as the 2D editor; no separate or pre-rendered 3D source is involved.

import * as THREE from '../vendor/three.module.min.js';

const CM_TO_M = 0.01;
const WALK_EYE_HEIGHT = 1.65;
const WALL_THICKNESS = 0.08;
const USE_COLORS = {
  arbeit: 0xdbe7f6,
  zusammen: 0xfbeccd,
  infra: 0xe9edf1,
  sonder: 0xe4dcf2,
};
const SIA_COLORS = {
  HNF: 0xdbe7f6,
  NNF: 0xe4dcf2,
  VF: 0xd9e6dd,
  FF: 0xf7e2d6,
  TF: 0xe9edf1,
};
const VE_COLORS = [0xfbeccd, 0xdbe7f6, 0xe9edf1, 0xd9e6dd, 0xe4dcf2, 0xf7e2d6];
const MODULE_COLORS = [
  0xdbe7f6, 0xcfe4f1, 0xd9ecdb, 0xfbeccd, 0xd5eaf0, 0xe4dcf2,
  0xf7e2d6, 0xf8dcdf, 0xe9edf1, 0xdfe4e9, 0xdcecdd,
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clean = (value) => String(value || '').trim().toLocaleLowerCase('de');
const stableIndex = (value, length) => {
  let hash = 0;
  for (const character of String(value || '')) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % length;
};

function roomColor(room, colorMode) {
  if (colorMode === 'none') return 0xf7f8fa;
  if (colorMode === 'sia') return SIA_COLORS[room.sia] || 0xe9edf1;
  if (colorMode === 've') return room.occupierVe
    ? VE_COLORS[stableIndex(room.occupierVe, VE_COLORS.length)] : 0xf2f4f7;
  if (colorMode === 'module') {
    const index = Number(room.moduleId) - 1;
    return MODULE_COLORS[index] || 0xf2f4f7;
  }
  return USE_COLORS[room.group] || 0xe9edf1;
}

function entityData(object, type, id) {
  object.traverse((child) => { child.userData.entity = { type, id }; });
  return object;
}

function box(width, height, depth, material, y = height / 2) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function furnitureObject(placement, isSelected) {
  const group = new THREE.Group();
  const width = Math.max(0.18, Number(placement.width || 60) * CM_TO_M);
  const depth = Math.max(0.18, Number(placement.depth || 60) * CM_TO_M);
  const suppliedHeight = Number(placement.height || 0) * CM_TO_M;
  const name = clean(`${placement.name} ${placement.category}`);
  const accent = isSelected ? 0x2864dc : 0x68798a;
  const material = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.72, metalness: 0.04 });
  const dark = new THREE.MeshStandardMaterial({ color: isSelected ? 0x173b83 : 0x33475b, roughness: 0.62, metalness: 0.08 });

  if (/stuhl|chair|sessel/.test(name)) {
    const seatHeight = clamp(suppliedHeight * 0.5 || 0.45, 0.38, 0.52);
    group.add(box(width * 0.78, 0.09, depth * 0.72, material, seatHeight));
    const back = box(width * 0.78, 0.55, 0.08, dark, seatHeight + 0.28);
    back.position.z = -depth * 0.32;
    group.add(back);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
      const leg = box(0.045, seatHeight, 0.045, dark, seatHeight / 2);
      leg.position.x = x * width * 0.3; leg.position.z = z * depth * 0.25; group.add(leg);
    });
  } else if (/tisch|table|desk|konferenz/.test(name)) {
    const height = clamp(suppliedHeight || 0.74, 0.65, 1.1);
    group.add(box(width, 0.08, depth, material, height));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
      const leg = box(0.055, height, 0.055, dark, height / 2);
      leg.position.x = x * Math.max(0, width / 2 - 0.12);
      leg.position.z = z * Math.max(0, depth / 2 - 0.12);
      group.add(leg);
    });
  } else if (/bildschirm|screen|monitor|display/.test(name)) {
    const height = clamp(suppliedHeight || 0.7, 0.45, 1.8);
    group.add(box(width, height, Math.min(depth, 0.12), dark, height / 2 + 0.65));
    group.add(box(0.08, 0.65, 0.08, material, 0.325));
  } else {
    const height = clamp(suppliedHeight || (/schrank|regal|archiv/.test(name) ? 1.8 : 0.75), 0.25, 2.4);
    const shape = placement.shape || placement.shape2d;
    if (shape === 'circle') {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(width / 2, width / 2, height, 24), material);
      mesh.position.y = height / 2; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    } else group.add(box(width, height, depth, material));
  }

  group.position.set(
    Number(placement.x || 0) * CM_TO_M + width / 2,
    0,
    Number(placement.y || 0) * CM_TO_M + depth / 2,
  );
  group.rotation.y = -THREE.MathUtils.degToRad(Number(placement.rotation || 0));
  return group;
}

function roomLabel(room, width, depth) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
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
  const labelWidth = Math.max(0.7, Math.min(width * 0.78, depth * 2.5, 3.4));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(labelWidth, labelWidth / 4), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.075;
  mesh.userData.labelTexture = texture;
  return mesh;
}

function addWall(group, x, z, width, depth, height, material) {
  const wall = box(Math.max(width, WALL_THICKNESS), height, Math.max(depth, WALL_THICKNESS), material);
  wall.position.x = x; wall.position.z = z; group.add(wall);
}

function startPoint(rooms, placements, floorWidth, floorDepth, selectedRoomId = '') {
  const selectedRoom = rooms.find((room) => room.spaceId === selectedRoomId && room.rect);
  const usableRooms = rooms.filter((room) => room.rect && room.sia !== 'VF'
    && !/korridor|verkehr|treppenhaus|wc|technik|archiv/.test(clean(`${room.useType} ${room.useLabel}`)));
  const room = selectedRoom || [...(usableRooms.length ? usableRooms : rooms)]
    .sort((a, b) => Number(b.area || 0) - Number(a.area || 0))[0];
  if (!room?.rect) return { position: new THREE.Vector3(0, WALK_EYE_HEIGHT, 0), yaw: Math.PI / 2 };
  const [x, z, width, depth] = room.rect.map((value) => Number(value) * CM_TO_M);
  const margin = Math.min(0.8, Math.max(0.35, Math.min(width, depth) * 0.16));
  const candidates = [
    [x + margin, z + depth - margin],
    [x + width - margin, z + depth - margin],
    [x + width - margin, z + margin],
    [x + margin, z + margin],
    [x + width / 2, z + depth / 2],
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
  const centreX = x + width / 2, centreZ = z + depth / 2;
  return {
    position: new THREE.Vector3(
      startX - floorWidth / 2,
      WALK_EYE_HEIGHT,
      startZ - floorDepth / 2,
    ),
    // Three.js cameras look down their local -Z axis at yaw 0.
    yaw: Math.atan2(startX - centreX, startZ - centreZ),
  };
}

export function createFloorplanThreeViewer({
  host, mode, floor, rooms, placements, selected, colorMode, initialViewState = null,
  onSelect, onAnnounce,
}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    host.innerHTML = `<div class="fpe-three-fallback" role="alert"><strong>3D-Darstellung nicht verfügbar</strong><span>${String(error?.message || error)}</span></div>`;
    return { reset() {}, zoom() {}, getViewState() { return null; }, dispose() {} };
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eef3);
  scene.fog = new THREE.Fog(0xe9eef3, 55, 145);
  const floorWidth = Math.max(1, Number(floor.extent?.[0] || 1000) * CM_TO_M);
  const floorDepth = Math.max(1, Number(floor.extent?.[1] || 1000) * CM_TO_M);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 300);
  const world = new THREE.Group();
  world.position.set(-floorWidth / 2, 0, -floorDepth / 2);
  scene.add(world);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'fpe-three-canvas';
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('role', 'application');
  renderer.domElement.setAttribute('aria-label', mode === 'walk'
    ? 'Interaktive Begehung. Mit W A S D oder den Pfeiltasten bewegen, mit der Maus umsehen.'
    : 'Interaktives 3D-Modell. Linke Maustaste verschiebt, rechte Maustaste dreht, das Mausrad zoomt.');
  host.replaceChildren(renderer.domElement);
  host.dataset.renderer = `Three.js r${THREE.REVISION}`;
  host.dataset.rooms = String(rooms.length);
  host.dataset.placements = String(placements.length);
  host.dataset.mode = mode;
  host.dataset.controls = mode === 'walk' ? 'pointer-look keyboard-walk' : 'orbit left-pan right-rotate wheel-zoom select';

  scene.add(new THREE.HemisphereLight(0xf8fbff, 0x768493, 2.25));
  const sun = new THREE.DirectionalLight(0xffffff, 2.7);
  sun.position.set(-18, 32, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -28;
  scene.add(sun);

  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.92 });
  const base = box(floorWidth + 0.4, 0.16, floorDepth + 0.4, baseMaterial, -0.08);
  base.position.x = floorWidth / 2; base.position.z = floorDepth / 2; world.add(base);
  const grid = new THREE.GridHelper(Math.max(floorWidth, floorDepth) + 20, 32, 0xaab5c1, 0xcfd6de);
  grid.position.y = -0.17; scene.add(grid);

  const selectedRoomId = selected?.type === 'room' ? selected.id : '';
  const selectedPlacementId = selected?.type === 'placement' ? selected.id : '';
  const selectables = [];
  const wallHeight = mode === 'walk' ? 2.75 : 1.35;
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xfafcff, roughness: 0.8 });
  rooms.forEach((room) => {
    if (!Array.isArray(room.rect) || room.rect.length !== 4) return;
    const [x, z, width, depth] = room.rect.map((value) => Number(value) * CM_TO_M);
    const selectedRoom = room.spaceId === selectedRoomId;
    const roomMaterial = new THREE.MeshStandardMaterial({
      color: selectedRoom ? 0xbfd2ff : roomColor(room, colorMode),
      roughness: 0.94,
      emissive: selectedRoom ? 0x142f70 : 0x000000,
      emissiveIntensity: selectedRoom ? 0.08 : 0,
    });
    const surface = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.04, width - WALL_THICKNESS), 0.055, Math.max(0.04, depth - WALL_THICKNESS)), roomMaterial);
    surface.position.set(x + width / 2, 0.027, z + depth / 2);
    surface.receiveShadow = true;
    entityData(surface, 'room', room.spaceId);
    world.add(surface); selectables.push(surface);

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(surface.geometry),
      new THREE.LineBasicMaterial({ color: selectedRoom ? 0x1748c6 : 0x53677b }),
    );
    outline.position.copy(surface.position); world.add(outline);
    addWall(world, x + width / 2, z, width + WALL_THICKNESS, WALL_THICKNESS, wallHeight, wallMaterial);
    addWall(world, x + width / 2, z + depth, width + WALL_THICKNESS, WALL_THICKNESS, wallHeight, wallMaterial);
    addWall(world, x, z + depth / 2, WALL_THICKNESS, depth, wallHeight, wallMaterial);
    addWall(world, x + width, z + depth / 2, WALL_THICKNESS, depth, wallHeight, wallMaterial);

    if (mode === '3d') {
      const label = roomLabel(room, width, depth);
      if (label) { label.position.x = x + width / 2; label.position.z = z + depth / 2; world.add(label); }
    }
  });

  placements.forEach((placement) => {
    const object = furnitureObject(placement, placement.placementId === selectedPlacementId);
    entityData(object, 'placement', placement.placementId);
    world.add(object);
    object.traverse((child) => { if (child.isMesh) selectables.push(child); });
  });

  const orbit = {
    target: new THREE.Vector3(0, 0.2, 0),
    yaw: -0.88,
    pitch: 0.72,
    distance: clamp(Math.hypot(floorWidth, floorDepth) * 0.78, 18, 78),
  };
  const walkStart = startPoint(rooms, placements, floorWidth, floorDepth, selectedRoomId);
  const walk = { yaw: walkStart.yaw, pitch: -0.04, keys: new Set(), position: walkStart.position };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const interaction = { active: false, moved: false, x: 0, y: 0, button: 0 };
  const abort = new AbortController();
  const { signal } = abort;

  function getViewState() {
    return mode === 'walk'
      ? { mode, position: walk.position.toArray(), yaw: walk.yaw, pitch: walk.pitch }
      : { mode, target: orbit.target.toArray(), yaw: orbit.yaw, pitch: orbit.pitch, distance: orbit.distance };
  }

  function restoreInitialView() {
    if (!initialViewState || initialViewState.mode !== mode) return false;
    if (mode === 'walk') {
      const position = initialViewState.position;
      if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)
        || !Number.isFinite(initialViewState.yaw) || !Number.isFinite(initialViewState.pitch)) return false;
      walk.position.fromArray(position);
      walk.position.x = clamp(walk.position.x, -floorWidth / 2 + 0.18, floorWidth / 2 - 0.18);
      walk.position.y = WALK_EYE_HEIGHT;
      walk.position.z = clamp(walk.position.z, -floorDepth / 2 + 0.18, floorDepth / 2 - 0.18);
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
    orbit.pitch = clamp(initialViewState.pitch, 0.12, 1.46);
    orbit.distance = clamp(initialViewState.distance, 3.5, 130);
    updateOrbitCamera();
    return true;
  }

  function updateOrbitCamera() {
    const horizontal = orbit.distance * Math.cos(orbit.pitch);
    camera.position.set(
      orbit.target.x + Math.sin(orbit.yaw) * horizontal,
      orbit.target.y + Math.sin(orbit.pitch) * orbit.distance,
      orbit.target.z + Math.cos(orbit.yaw) * horizontal,
    );
    camera.lookAt(orbit.target);
    host.dataset.camera = camera.position.toArray().map((value) => value.toFixed(3)).join(',');
    host.dataset.orbitTarget = orbit.target.toArray().map((value) => value.toFixed(3)).join(',');
    host.dataset.orbitYaw = orbit.yaw.toFixed(6);
    host.dataset.orbitDistance = orbit.distance.toFixed(3);
  }

  function updateWalkCamera() {
    camera.position.copy(walk.position);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = walk.yaw;
    camera.rotation.x = walk.pitch;
    host.dataset.camera = camera.position.toArray().map((value) => value.toFixed(3)).join(',');
    host.dataset.walkYaw = walk.yaw.toFixed(6);
  }

  function reset() {
    if (mode === 'walk') {
      const nextStart = startPoint(rooms, placements, floorWidth, floorDepth, selectedRoomId);
      walk.position.copy(nextStart.position);
      walk.yaw = nextStart.yaw; walk.pitch = -0.04; walk.keys.clear(); updateWalkCamera();
    } else {
      orbit.target.set(0, 0.2, 0); orbit.yaw = -0.88; orbit.pitch = 0.72;
      orbit.distance = clamp(Math.hypot(floorWidth, floorDepth) * 0.78, 18, 78); updateOrbitCamera();
    }
  }

  function zoom(factor) {
    if (mode !== '3d' || !Number.isFinite(factor) || factor <= 0) return;
    orbit.distance = clamp(orbit.distance * factor, 3.5, 130);
    updateOrbitCamera();
  }

  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function chooseEntity(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(selectables, false).find((entry) => entry.object.userData.entity);
    if (hit?.object.userData.entity) onSelect?.(hit.object.userData.entity.type, hit.object.userData.entity.id);
  }

  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });
  renderer.domElement.addEventListener('pointerdown', (event) => {
    renderer.domElement.focus({ preventScroll: true });
    interaction.active = true; interaction.moved = false; interaction.x = event.clientX; interaction.y = event.clientY; interaction.button = event.button;
    if (mode === 'walk' && event.button === 0 && document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock?.();
    } else {
      try { renderer.domElement.setPointerCapture?.(event.pointerId); } catch { /* synthetic or already released pointer */ }
    }
  }, { signal });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!interaction.active || document.pointerLockElement === renderer.domElement) return;
    const dx = event.clientX - interaction.x, dy = event.clientY - interaction.y;
    interaction.x = event.clientX; interaction.y = event.clientY;
    interaction.moved ||= Math.hypot(dx, dy) > 2;
    if (mode === 'walk') {
      walk.yaw -= dx * 0.006; walk.pitch = clamp(walk.pitch - dy * 0.004, -1.35, 1.35); updateWalkCamera();
    } else if (interaction.button === 0) {
      const factor = orbit.distance * 0.0016;
      orbit.target.x -= dx * factor; orbit.target.z += dy * factor; updateOrbitCamera();
    } else {
      orbit.yaw -= dx * 0.006; orbit.pitch = clamp(orbit.pitch + dy * 0.005, 0.12, 1.46); updateOrbitCamera();
    }
  }, { signal });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (mode === '3d' && interaction.active && !interaction.moved && event.button === 0) chooseEntity(event);
    interaction.active = false;
  }, { signal });
  renderer.domElement.addEventListener('wheel', (event) => {
    if (mode !== '3d') return;
    event.preventDefault();
    orbit.distance = clamp(orbit.distance * Math.exp(event.deltaY * 0.001), 3.5, 130);
    updateOrbitCamera();
  }, { signal, passive: false });

  document.addEventListener('mousemove', (event) => {
    if (mode !== 'walk' || document.pointerLockElement !== renderer.domElement) return;
    walk.yaw -= event.movementX * 0.0024;
    walk.pitch = clamp(walk.pitch - event.movementY * 0.002, -1.35, 1.35);
    updateWalkCamera();
  }, { signal });
  window.addEventListener('keydown', (event) => {
    if (mode !== 'walk' || (document.activeElement !== renderer.domElement && document.pointerLockElement !== renderer.domElement)) return;
    const key = event.key.toLocaleLowerCase();
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) return;
    event.preventDefault(); walk.keys.add(key);
  }, { signal });
  window.addEventListener('keyup', (event) => walk.keys.delete(event.key.toLocaleLowerCase()), { signal });
  window.addEventListener('blur', () => walk.keys.clear(), { signal });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  let previousTime = performance.now();
  renderer.setAnimationLoop((time) => {
    const delta = Math.min(0.05, Math.max(0, (time - previousTime) / 1000));
    previousTime = time;
    if (mode === 'walk' && walk.keys.size) {
      const forward = new THREE.Vector3(-Math.sin(walk.yaw), 0, -Math.cos(walk.yaw));
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      const direction = new THREE.Vector3();
      if (walk.keys.has('w') || walk.keys.has('arrowup')) direction.add(forward);
      if (walk.keys.has('s') || walk.keys.has('arrowdown')) direction.sub(forward);
      if (walk.keys.has('d') || walk.keys.has('arrowright')) direction.add(right);
      if (walk.keys.has('a') || walk.keys.has('arrowleft')) direction.sub(right);
      if (direction.lengthSq()) direction.normalize().multiplyScalar(delta * 3.2);
      walk.position.add(direction);
      walk.position.x = clamp(walk.position.x, -floorWidth / 2 + 0.18, floorWidth / 2 - 0.18);
      walk.position.z = clamp(walk.position.z, -floorDepth / 2 + 0.18, floorDepth / 2 - 0.18);
      updateWalkCamera();
    }
    renderer.render(scene, camera);
  });

  if (!restoreInitialView()) reset();
  resize();
  onAnnounce?.(`${mode === 'walk' ? 'Begehung' : '3D-Modell'} mit Three.js r${THREE.REVISION} geladen.`);

  return {
    reset,
    zoom,
    getViewState,
    dispose() {
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock?.();
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      abort.abort();
      const geometries = new Set(), materials = new Set(), textures = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        objectMaterials.forEach((material) => {
          materials.add(material);
          if (material.map) textures.add(material.map);
        });
        if (object.userData.labelTexture) textures.add(object.userData.labelTexture);
      });
      textures.forEach((texture) => texture.dispose());
      materials.forEach((material) => material.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      renderer.dispose();
    },
  };
}
