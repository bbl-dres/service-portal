// Scene construction helpers for the retained Three.js viewer.

import * as THREE from '../vendor/three.module.min.js';
import { CM_TO_M, WALK_EYE_HEIGHT, WALL_THICKNESS, clamp } from './three-controls.js';

const clean = (value) => String(value || '').trim().toLocaleLowerCase('de');
export const floorSize = (floor) => ({
  width: Math.max(1, Number(floor?.extent?.[0] || 1000) * CM_TO_M),
  depth: Math.max(1, Number(floor?.extent?.[1] || 1000) * CM_TO_M),
});

export function entityData(object, type, id) {
  object.traverse((child) => { child.userData.entity = { type, id }; });
  return object;
}

export function box(width, height, depth, material, y, geometry) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(width, height, depth);
  mesh.position.y = y ?? height / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function furnitureObject(placement, isSelected, resources) {
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

export function roomLabel(room, width, depth, resources) {
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

export function addWall(group, x, z, width, depth, height, material, unitBox) {
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

export function startPoint(rooms, placements, width, depth, selectedRoomId = '') {
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

export function fallbackViewer() {
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
