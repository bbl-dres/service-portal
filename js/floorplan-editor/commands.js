// Pure document mutations and spatial invariants for editor commands.
// UI controllers decide when to run a command; this module decides whether the
// resulting document remains valid.

import { clampPlacement, containingRoom } from './canvas.js';
import {
  MODULE_OPTIONS, SIA_OPTIONS, USE_OPTIONS, placementRectInsideFloor, roomRectsOverlap,
} from './model.js';

const MODULE_VALUES = new Set(['', ...MODULE_OPTIONS.map(({ value }) => value)]);
const ROOM_TEXT_FIELDS = new Set(['occupierVe', 'roomNumber', 'roomName']);
const PLACEMENT_FIELDS = new Set(['x', 'y', 'rotation']);
const safeText = (value, { empty = true, nullable = false, max = 300 } = {}) => {
  if (nullable && value === null) return true;
  return typeof value === 'string' && value.length <= max
    && (empty || value.trim().length > 0)
    && !/[\u0000-\u001f\u007f]/.test(value);
};
const validRotation = (value) => Number.isInteger(value)
  && value >= 0 && value < 360 && value % 45 === 0;

/** Update only inspector-owned room fields, rejecting unknown or malformed values. */
export function updateRoomAttribute(document, roomId, field, value) {
  const room = document?.rooms?.find((entry) => entry.spaceId === roomId);
  if (!room) return false;
  if (field === 'useType') {
    const option = USE_OPTIONS.find((entry) => entry.value === String(value));
    if (!option) return false;
    room.useType = option.value;
    room.useLabel = option.label;
    room.group = option.group;
    room.groupLabel = option.groupLabel;
    return true;
  }
  if (field === 'sia') {
    const option = SIA_OPTIONS.find((entry) => entry.value === String(value));
    if (!option) return false;
    room.sia = option.value;
    room.siaLabel = option.longLabel || option.label;
    return true;
  }
  if (field === 'moduleId') {
    const moduleId = value == null ? '' : String(value);
    if (!MODULE_VALUES.has(moduleId)) return false;
    room.moduleId = moduleId;
    return true;
  }
  if (field === 'capacity') {
    if (!Number.isSafeInteger(value) || value < 0 || value > 10000) return false;
    room.capacity = value;
    return true;
  }
  if (field === 'bookable') {
    if (typeof value !== 'boolean') return false;
    room.bookable = value;
    return true;
  }
  if (!ROOM_TEXT_FIELDS.has(field)) return false;
  if (field === 'occupierVe') {
    if (!safeText(value, { nullable: true })) return false;
  } else if (!safeText(value, { empty: field === 'roomName', max: field === 'roomNumber' ? 220 : 300 })) return false;
  room[field] = value;
  return true;
}

/** Check minimum size, floor containment and optional positive-area room collisions. */
export function roomRectInsideFloor(rect, extent, rooms = [], excludedRoomId = null) {
  if (!Array.isArray(rect) || rect.length !== 4
    || !Array.isArray(extent) || extent.length !== 2
    || !Array.isArray(rooms)) return false;
  const [x, y, width, height] = rect;
  const [floorWidth, floorHeight] = extent;
  const inside = [x, y, width, height, floorWidth, floorHeight].every(Number.isFinite)
    && x >= 0 && y >= 0 && width >= 100 && height >= 100
    && x + width <= floorWidth && y + height <= floorHeight;
  return inside && !rooms.some((room) => room?.spaceId !== excludedRoomId
    && roomRectsOverlap(rect, room?.rect));
}

export function placementsInsideRoom(document, room) {
  if (!document || !room || !Array.isArray(document.placements)) return false;
  const extent = document.floor?.extent;
  const [x, y, width, height] = room.rect;
  return document.placements.filter((item) => item.roomId === room.spaceId).every((item) => {
    const cx = item.x + item.width / 2;
    const cy = item.y + item.depth / 2;
    return placementRectInsideFloor(item, extent)
      && cx >= x && cx <= x + width && cy >= y && cy <= y + height;
  });
}

export function stampRoomGeometry(room, rect) {
  room.rect = rect.map((value) => Number(Number(value).toFixed(3)));
  room.area = Number((rect[2] * rect[3] / 10000).toFixed(1));
  return room;
}

/** Apply room geometry and translated placements as one all-or-nothing command. */
export function updateRoomGeometry(document, roomId, field, value, extent) {
  const room = document?.rooms?.find((entry) => entry.spaceId === roomId);
  if (!room || !Number.isFinite(value)) return false;
  const oldRect = room.rect.slice();
  const rect = oldRect.slice();
  const index = ({ x: 0, y: 1, width: 2, height: 3 })[field];
  if (index == null) return false;
  rect[index] = value;
  if (!roomRectInsideFloor(rect, extent, document.rooms, roomId)) return false;

  const dx = field === 'x' ? rect[0] - oldRect[0] : 0;
  const dy = field === 'y' ? rect[1] - oldRect[1] : 0;
  const proposals = document.placements
    .filter((item) => item.roomId === room.spaceId)
    .map((item) => ({
      original: item,
      candidate: {
        ...item,
        x: Number((item.x + dx).toFixed(3)),
        y: Number((item.y + dy).toFixed(3)),
      },
    }));
  const proposalsById = new Map(proposals.map(({ candidate }) => [candidate.placementId, candidate]));
  const candidateRoom = stampRoomGeometry({ ...room }, rect);
  const candidateDocument = {
    ...document,
    placements: document.placements.map((item) => proposalsById.get(item.placementId) || item),
  };
  if (!placementsInsideRoom(candidateDocument, candidateRoom)) return false;

  stampRoomGeometry(room, rect);
  proposals.forEach(({ original, candidate }) => {
    original.x = candidate.x;
    original.y = candidate.y;
  });
  return true;
}

export function createLocalRoom({ floor, buildingId, rect, ordinal, id, rooms = [] }) {
  if (!floor || !safeText(String(floor.floorId || ''), { empty: false, max: 220 })
    || !safeText(buildingId, { empty: false, max: 220 })
    || !safeText(id, { empty: false, max: 220 })
    || !Number.isSafeInteger(ordinal) || ordinal < 1
    || rooms.some((room) => room?.spaceId === id)
    || !roomRectInsideFloor(rect, floor.extent, rooms)) return null;
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
  if (!document?.rooms?.some((item) => item.spaceId === roomId)) return false;
  document.rooms = document.rooms.filter((item) => item.spaceId !== roomId);
  document.placements = document.placements.filter((item) => item.roomId !== roomId);
  return true;
}

export function finalisePlacementMove(document, placement, previous, floor) {
  if (!document || !placement || !previous || !floor
    || ![placement.x, placement.y, placement.width, placement.depth].every(Number.isFinite)
    || placement.width <= 0 || placement.depth <= 0
    || !validRotation(placement.rotation)) {
    if (placement && previous) Object.assign(placement, previous);
    return false;
  }
  const clamped = clampPlacement(placement, floor);
  placement.x = clamped.x;
  placement.y = clamped.y;
  const containing = containingRoom(document.rooms, {
    x: placement.x + placement.width / 2,
    y: placement.y + placement.depth / 2,
  });
  if (!containing || !placementRectInsideFloor(placement, floor.extent)) {
    Object.assign(placement, previous);
    return false;
  }
  placement.roomId = containing.spaceId;
  if (placement.status !== 'new') placement.status = 'moved';
  return true;
}

export function updatePlacement(document, placementId, field, value, floor) {
  const placement = document?.placements?.find((entry) => entry.placementId === placementId);
  const numericValue = Number(value);
  if (!placement || !PLACEMENT_FIELDS.has(field)
    || (typeof value === 'string' && !value.trim()) || !Number.isFinite(numericValue)
    || (field === 'rotation' && !validRotation(numericValue))) return false;
  const previous = { ...placement };
  placement[field] = numericValue;
  if (field === 'rotation') {
    if (!placementRectInsideFloor(placement, floor?.extent)) {
      Object.assign(placement, previous);
      return false;
    }
    if (placement.status !== 'new') placement.status = 'moved';
    return true;
  }
  return finalisePlacementMove(document, placement, previous, floor);
}

export function removePlacement(document, placementId) {
  if (!document?.placements?.some((item) => item.placementId === placementId)) return false;
  document.placements = document.placements.filter((entry) => entry.placementId !== placementId);
  return true;
}
