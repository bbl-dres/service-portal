// Pure document mutations and spatial invariants for editor commands.
// UI controllers decide when to run a command; this module decides whether the
// resulting document remains valid.

import { clampPlacement, containingRoom } from './canvas.js';
import { SIA_OPTIONS, USE_OPTIONS } from './model.js';

export function updateRoomAttribute(document, roomId, field, value) {
  const room = document.rooms.find((entry) => entry.spaceId === roomId);
  if (!room) return false;
  if (field === 'useType') {
    const option = USE_OPTIONS.find((entry) => String(entry.value) === String(value));
    room.useType = value;
    room.useLabel = option?.label || value;
    room.group = option?.group || room.group;
    room.groupLabel = option?.groupLabel || room.groupLabel;
  } else if (field === 'sia') {
    const option = SIA_OPTIONS.find((entry) => String(entry.value) === String(value));
    room.sia = value;
    room.siaLabel = option?.longLabel || option?.label || value;
  } else if (field === 'moduleId') room.moduleId = value || '';
  else room[field] = value;
  return true;
}

export function roomRectInsideFloor(rect, extent) {
  if (!Array.isArray(rect) || !Array.isArray(extent)) return false;
  const [x, y, width, height] = rect;
  const [floorWidth, floorHeight] = extent;
  return [x, y, width, height, floorWidth, floorHeight].every(Number.isFinite)
    && x >= 0 && y >= 0 && width >= 100 && height >= 100
    && x + width <= floorWidth && y + height <= floorHeight;
}

export function placementsInsideRoom(document, room) {
  const [x, y, width, height] = room.rect;
  return document.placements.filter((item) => item.roomId === room.spaceId).every((item) => {
    const cx = item.x + item.width / 2;
    const cy = item.y + item.depth / 2;
    return cx >= x && cx <= x + width && cy >= y && cy <= y + height;
  });
}

export function stampRoomGeometry(room, rect) {
  room.rect = rect.map((value) => Number(Number(value).toFixed(3)));
  room.area = Number((rect[2] * rect[3] / 10000).toFixed(1));
  return room;
}

export function updateRoomGeometry(document, roomId, field, value, extent) {
  const room = document.rooms.find((entry) => entry.spaceId === roomId);
  if (!room || !Number.isFinite(value)) return false;
  const old = room.rect.slice();
  const rect = old.slice();
  const index = ({ x: 0, y: 1, width: 2, height: 3 })[field];
  if (index == null) return false;
  rect[index] = value;
  if (!roomRectInsideFloor(rect, extent)) return false;
  if (field === 'x' || field === 'y') {
    const dx = rect[0] - old[0];
    const dy = rect[1] - old[1];
    document.placements.filter((item) => item.roomId === room.spaceId).forEach((item) => {
      item.x += dx;
      item.y += dy;
    });
  }
  stampRoomGeometry(room, rect);
  if (placementsInsideRoom(document, room)) return true;
  stampRoomGeometry(room, old);
  return false;
}

export function createLocalRoom({ floor, buildingId, rect, ordinal, id }) {
  if (!roomRectInsideFloor(rect, floor.extent)) return null;
  const option = USE_OPTIONS.find((item) => item.value === 'buero') || USE_OPTIONS[0];
  const sia = SIA_OPTIONS.find((item) => item.value === (option.sia || 'HNF')) || SIA_OPTIONS[0];
  return stampRoomGeometry({
    spaceId: id,
    floorId: floor.floorId,
    buildingId,
    roomNumber: `Neue Fläche ${ordinal}`,
    roomName: 'Neue Fläche',
    useType: option.value,
    useLabel: option.label,
    sia: sia.value,
    siaLabel: sia.longLabel || sia.label,
    group: option.group,
    groupLabel: option.groupLabel,
    area: 0,
    capacity: 0,
    bookable: false,
    occupierVe: null,
    rect: rect.slice(),
    moduleId: '',
  }, rect);
}

export function removeRoom(document, roomId) {
  document.rooms = document.rooms.filter((item) => item.spaceId !== roomId);
  document.placements = document.placements.filter((item) => item.roomId !== roomId);
}

export function finalisePlacementMove(document, placement, previous, floor) {
  Object.assign(placement, clampPlacement(placement, floor));
  const containing = containingRoom(document.rooms, {
    x: placement.x + placement.width / 2,
    y: placement.y + placement.depth / 2,
  });
  if (!containing) {
    Object.assign(placement, previous);
    return false;
  }
  placement.roomId = containing.spaceId;
  if (placement.status !== 'new') placement.status = 'moved';
  return true;
}

export function updatePlacement(document, placementId, field, value, floor) {
  const placement = document.placements.find((entry) => entry.placementId === placementId);
  if (!placement) return false;
  const previous = { ...placement };
  placement[field] = Number(value) || 0;
  return finalisePlacementMove(document, placement, previous, floor);
}

export function removePlacement(document, placementId) {
  document.placements = document.placements.filter((entry) => entry.placementId !== placementId);
}
