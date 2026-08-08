// Browser-local document model for the standalone floor-plan editor.
//
// The generated furniture is deliberately illustrative. It is derived from the
// real shop catalogue so dimensions and article references are useful, but it is
// not an inventory import and must not be presented as an approved floor plan.

// Portal floor rectangles use 100 drawing units per metre. Shop dimensions are
// centimetres, so one centimetre maps directly to one drawing unit here.

import { placementFootprintInsideFloor } from './geometry.js';

export const DRAFT_SCHEMA = 'bbl.floorplan-editor.draft/v1';

const freezeOptions = (options) => Object.freeze(options.map((option) => Object.freeze(option)));

export const MODULE_OPTIONS = freezeOptions([
  { value: '1', label: '1 · Einzel Arbeitsplatz' },
  { value: '2', label: '2 · Team Arbeitsplatz' },
  { value: '3', label: '3 · Fokus Arbeitsplatz' },
  { value: '4', label: '4 · Formelle Sitzungen' },
  { value: '5', label: '5 · Telefon- / Videokonferenzbox' },
  { value: '6', label: '6 · Informelle Sitzungen' },
  { value: '7', label: '7 · Coffee Point' },
  { value: '8', label: '8 · Interaktive Sitzungen' },
  { value: '9', label: '9 · Team Ablage' },
  { value: '10', label: '10 · Locker, Garderoben' },
  { value: '11', label: '11 · Service Funktionen' },
]);

export const USE_OPTIONS = freezeOptions([
  { value: 'archiv', label: 'Archiv', group: 'sonder', groupLabel: 'Sonderräume', sia: 'NNF' },
  { value: 'buero', label: 'Büro', group: 'arbeit', groupLabel: 'Arbeitsplätze', sia: 'HNF' },
  { value: 'druckraum', label: 'Druckerraum', group: 'infra', groupLabel: 'Infrastruktur', sia: 'NNF' },
  { value: 'empfang', label: 'Empfang', group: 'arbeit', groupLabel: 'Arbeitsplätze', sia: 'HNF' },
  { value: 'fokusraum', label: 'Fokusraum', group: 'arbeit', groupLabel: 'Arbeitsplätze', sia: 'HNF' },
  { value: 'korridor', label: 'Korridor', group: 'infra', groupLabel: 'Infrastruktur', sia: 'VF' },
  { value: 'lager', label: 'Lager', group: 'sonder', groupLabel: 'Sonderräume', sia: 'NNF' },
  { value: 'lounge', label: 'Lounge', group: 'zusammen', groupLabel: 'Zusammenarbeit', sia: 'HNF' },
  { value: 'openspace', label: 'Open Space', group: 'arbeit', groupLabel: 'Arbeitsplätze', sia: 'HNF' },
  { value: 'sitzung', label: 'Sitzungszimmer', group: 'zusammen', groupLabel: 'Zusammenarbeit', sia: 'HNF' },
  { value: 'technik', label: 'Technikraum', group: 'infra', groupLabel: 'Infrastruktur', sia: 'TF' },
  { value: 'teekueche', label: 'Teeküche', group: 'infra', groupLabel: 'Infrastruktur', sia: 'NNF' },
  { value: 'treppenhaus', label: 'Treppenhaus', group: 'infra', groupLabel: 'Infrastruktur', sia: 'VF' },
  { value: 'wc', label: 'WC', group: 'infra', groupLabel: 'Infrastruktur', sia: 'NNF' },
]);

export const SIA_OPTIONS = freezeOptions([
  { value: 'HNF', label: 'HNF · Hauptnutzfläche', longLabel: 'Hauptnutzfläche' },
  { value: 'NNF', label: 'NNF · Nebennutzfläche', longLabel: 'Nebennutzfläche' },
  { value: 'TF', label: 'TF · Technikfläche', longLabel: 'Technikfläche' },
  { value: 'VF', label: 'VF · Verkehrsfläche', longLabel: 'Verkehrsfläche' },
]);

const MODULE_VALUES = new Set(['', ...MODULE_OPTIONS.map(({ value }) => value)]);
const USE_BY_VALUE = new Map(USE_OPTIONS.map((option) => [option.value, option]));
const SIA_BY_VALUE = new Map(SIA_OPTIONS.map((option) => [option.value, option]));
const PLACEMENT_STATUSES = new Set(['illustrative', 'existing', 'new', 'moved']);
const PLACEMENT_SOURCES = new Set(['illustrative-prototype', 'user']);
const SHAPES = new Set(['rect', 'circle', 'diamond']);
const MAX_HISTORY = 200;
const EPSILON = 0.001;

const DOCUMENT_KEYS = new Set([
  'schema', 'persistence', 'buildingId', 'floorId', 'building', 'floor',
  'planningFloor', 'rooms', 'products', 'placements', 'placementSource',
  'baseRevision', 'updatedAt', 'updatedBy',
]);

const BUILDING_KEYS = new Set(['buildingId', 'name', 'street', 'zip', 'city']);
const FLOOR_KEYS = new Set([
  'floorId', 'buildingId', 'key', 'label', 'level', 'areaGross', 'areaHnf',
  'rooms', 'extent',
]);
const PLANNING_KEYS = new Set(['floorId', 'equipmentCount', 'planStatus', 'lastSync']);
const ROOM_KEYS = new Set([
  'spaceId', 'floorId', 'buildingId', 'roomNumber', 'useType', 'useLabel',
  'sia', 'siaLabel', 'group', 'groupLabel', 'area', 'capacity', 'bookable',
  'occupierVe', 'rect', 'moduleId', 'roomName',
]);
const PRODUCT_KEYS = new Set([
  'id', 'name', 'description', 'price', 'currency', 'category', 'subcategory',
  'brand', 'isNew', 'photo', 'photos', 'model3d', 'dimensions', 'color3d',
  'shape2d',
]);
const DIMENSION_KEYS = new Set(['width', 'depth', 'height', 'unit']);
const PLACEMENT_KEYS = new Set([
  'placementId', 'buildingId', 'floorId', 'roomId', 'productId', 'articleId',
  'name', 'category', 'x', 'y', 'width', 'depth', 'height', 'rotation', 'shape',
  'status', 'source',
]);
const MAX_ROOM_CAPACITY = 10000;

const isPlainObject = (value) => value !== null
  && typeof value === 'object'
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isNonNegative = (value) => isFiniteNumber(value) && value >= 0;
const isPositive = (value) => isFiniteNumber(value) && value > 0;
const isSafeString = (value, max = 300) => typeof value === 'string'
  && value.length <= max
  && !/[\u0000-\u001f\u007f]/.test(value);
const isIdentifier = (value) => isSafeString(value, 220) && value.trim().length > 0;
const isProductId = (value) => (typeof value === 'string' && isIdentifier(value))
  || (Number.isSafeInteger(value) && value >= 0);
const productKey = (value) => `${typeof value}:${String(value)}`;

function hasExactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const own = Object.keys(value);
  return own.length === keys.size && own.every((key) => keys.has(key));
}

function isJsonValue(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const children = Array.isArray(value)
    ? value
    : isPlainObject(value) ? Object.values(value) : null;
  if (!children || !children.every((child) => isJsonValue(child, seen))) return false;
  seen.delete(value);
  return true;
}

function cloneValue(value, seen = new Map()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const copy = Array.isArray(value) ? [] : {};
  seen.set(value, copy);
  Object.keys(value).forEach((key) => { copy[key] = cloneValue(value[key], seen); });
  return copy;
}

/** Return a detached copy suitable for editing or placing in history. */
export function cloneDocument(document) {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(document); } catch { /* fall through for older browsers/unsupported values */ }
  }
  return cloneValue(document);
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function hashString(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableCompare(left, right) {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  const a = String(left);
  const b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function normaliseBuilding(building, buildingId) {
  return {
    buildingId,
    name: String(building?.name || building?.['bbl_bez'] || buildingId),
    street: String(building?.street || building?.['adr_str'] || ''),
    zip: String(building?.zip || building?.['adr_plz'] || ''),
    city: String(building?.city || building?.['adr_ort'] || ''),
  };
}

function normaliseFloor(floor, buildingId, floorId) {
  return {
    floorId,
    buildingId,
    key: String(floor?.key || ''),
    label: String(floor?.label || floorId),
    level: Number(floor?.level) || 0,
    areaGross: Number(floor?.areaGross) || 0,
    areaHnf: Number(floor?.areaHnf) || 0,
    rooms: Math.max(0, Number(floor?.rooms) || 0),
    extent: Array.isArray(floor?.extent) ? floor.extent.slice(0, 2).map(Number) : [],
  };
}

function normalisePlanningFloor(planningFloor, floorId) {
  if (!planningFloor) return null;
  return {
    floorId,
    equipmentCount: Math.max(0, Number(planningFloor.equipmentCount) || 0),
    planStatus: String(planningFloor.planStatus || 'inventory'),
    lastSync: String(planningFloor.lastSync || ''),
  };
}

function inferredModule(useType) {
  return ({
    'buero': '1', 'openspace': '2', 'fokusraum': '3', 'sitzung': '4', lounge: '6',
    'empfang': '6', 'teekueche': '7', 'archiv': '9', 'lager': '9', 'druckraum': '11',
  })[useType] || '';
}

function normaliseRoom(space, buildingId, floorId) {
  const moduleId = String(space?.moduleId ?? inferredModule(space?.useType));
  return {
    spaceId: String(space?.spaceId || ''),
    floorId,
    buildingId,
    roomNumber: String(space?.roomNumber || ''),
    roomName: String(space?.roomName || space?.useLabel || ''),
    useType: String(space?.useType || ''),
    useLabel: String(space?.useLabel || ''),
    sia: String(space?.sia || ''),
    siaLabel: String(space?.siaLabel || ''),
    group: String(space?.group || ''),
    groupLabel: String(space?.groupLabel || ''),
    area: Number(space?.area) || 0,
    capacity: Math.max(0, Number(space?.capacity) || 0),
    bookable: Boolean(space?.bookable),
    'occupierVe': space?.['occupierVe'] == null ? null : String(space['occupierVe']),
    rect: Array.isArray(space?.rect) ? space.rect.slice(0, 4).map(Number) : [],
    moduleId: MODULE_VALUES.has(moduleId) ? moduleId : '',
  };
}

function normaliseProduct(product) {
  const photo = String(product?.photo || '');
  return {
    id: product?.id,
    name: String(product?.name || ''),
    description: String(product?.description || ''),
    price: Number(product?.price) || 0,
    currency: String(product?.currency || 'CHF'),
    category: String(product?.category || ''),
    subcategory: String(product?.subcategory || ''),
    brand: String(product?.brand || ''),
    isNew: Boolean(product?.isNew),
    photo,
    photos: Array.isArray(product?.photos)
      ? product.photos.map(String)
      : photo ? [photo] : [],
    model3d: String(product?.model3d || ''),
    dimensions: {
      width: Number(product?.dimensions?.width) || 0,
      depth: Number(product?.dimensions?.depth) || 0,
      height: Number(product?.dimensions?.height) || 0,
      unit: String(product?.dimensions?.unit || ''),
    },
    color3d: String(product?.color3d || ''),
    shape2d: SHAPES.has(product?.shape2d) ? product.shape2d : 'rect',
  };
}

function userLabel(user) {
  if (typeof user === 'string' && user.trim()) return user.trim().slice(0, 200);
  if (isPlainObject(user)) {
    const label = user.name || user.email || user.username || user.id;
    if (label != null && String(label).trim()) return String(label).trim().slice(0, 200);
  }
  return 'Unbekannt';
}

function rectIsInside(rect, extent) {
  if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(isFiniteNumber)
    || !Array.isArray(extent) || extent.length !== 2 || !extent.every(isPositive)) return false;
  const [x, y, width, height] = rect;
  return x >= 0 && y >= 0 && width > 0 && height > 0
    && x + width <= extent[0] + EPSILON
    && y + height <= extent[1] + EPSILON;
}

/** True only when two room rectangles share a positive area; touching edges are valid. */
export function roomRectsOverlap(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)
    || left.length !== 4 || right.length !== 4
    || !left.every(isFiniteNumber) || !right.every(isFiniteNumber)) return false;
  const overlapWidth = Math.min(left[0] + left[2], right[0] + right[2])
    - Math.max(left[0], right[0]);
  const overlapHeight = Math.min(left[1] + left[3], right[1] + right[3])
    - Math.max(left[1], right[1]);
  return overlapWidth > 0 && overlapHeight > 0;
}

/** Validate the complete stored placement footprint against a floor extent. */
export function placementRectInsideFloor(placement, extent) {
  return placementFootprintInsideFloor(placement, { extent }, EPSILON);
}

function canonicalRoomArea(rect) {
  if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(isFiniteNumber)) return Number.NaN;
  return Number((rect[2] * rect[3] / 10000).toFixed(1));
}

function validRotation(value) {
  return Number.isInteger(value) && value >= 0 && value < 360 && value % 45 === 0;
}

function validBuilding(building, buildingId) {
  return hasExactKeys(building, BUILDING_KEYS)
    && building.buildingId === buildingId
    && isIdentifier(building.buildingId)
    && isSafeString(building.name)
    && isSafeString(building.street)
    && isSafeString(building.zip)
    && isSafeString(building.city);
}

function validFloor(floor, buildingId, floorId) {
  return hasExactKeys(floor, FLOOR_KEYS)
    && floor.floorId === floorId
    && floor.buildingId === buildingId
    && isIdentifier(floor.floorId)
    && isSafeString(floor.key)
    && isSafeString(floor.label)
    && isFiniteNumber(floor.level)
    && isNonNegative(floor.areaGross)
    && isNonNegative(floor.areaHnf)
    && isNonNegative(floor.rooms)
    && Array.isArray(floor.extent)
    && floor.extent.length === 2
    && floor.extent.every(isPositive);
}

function validPlanningFloor(planningFloor, floorId) {
  return planningFloor === null || (hasExactKeys(planningFloor, PLANNING_KEYS)
    && planningFloor.floorId === floorId
    && isNonNegative(planningFloor.equipmentCount)
    && isSafeString(planningFloor.planStatus)
    && isSafeString(planningFloor.lastSync));
}

function validRoom(room, buildingId, floorId, extent) {
  const use = USE_BY_VALUE.get(room?.useType);
  const sia = SIA_BY_VALUE.get(room?.sia);
  return hasExactKeys(room, ROOM_KEYS)
    && isIdentifier(room.spaceId)
    && room.buildingId === buildingId
    && room.floorId === floorId
    && isIdentifier(room.roomNumber)
    && isSafeString(room.roomName)
    && Boolean(use)
    && room.useLabel === use.label
    && Boolean(sia)
    && room.siaLabel === (sia.longLabel || sia.label)
    && room.group === use.group
    && room.groupLabel === use.groupLabel
    && isNonNegative(room.area)
    && Math.abs(room.area - canonicalRoomArea(room.rect)) <= EPSILON
    && Number.isSafeInteger(room.capacity)
    && room.capacity >= 0
    && room.capacity <= MAX_ROOM_CAPACITY
    && typeof room.bookable === 'boolean'
    && (room['occupierVe'] === null || isSafeString(room['occupierVe']))
    && rectIsInside(room.rect, extent)
    && MODULE_VALUES.has(room.moduleId);
}

function validProduct(product) {
  return hasExactKeys(product, PRODUCT_KEYS)
    && isProductId(product.id)
    && isIdentifier(product.name)
    && isSafeString(product.description, 2000)
    && isNonNegative(product.price)
    && isSafeString(product.currency, 10)
    && isIdentifier(product.category)
    && isIdentifier(product.subcategory)
    && isSafeString(product.brand)
    && typeof product.isNew === 'boolean'
    && isSafeString(product.photo, 1000)
    && Array.isArray(product.photos)
    && product.photos.length <= 20
    && product.photos.every((photo) => isSafeString(photo, 1000))
    && isSafeString(product.model3d, 1000)
    && hasExactKeys(product.dimensions, DIMENSION_KEYS)
    && isPositive(product.dimensions.width)
    && isPositive(product.dimensions.depth)
    && isPositive(product.dimensions.height)
    && product.dimensions.unit === 'cm'
    && isSafeString(product.color3d, 50)
    && SHAPES.has(product.shape2d);
}

function validPlacement(placement, document, roomsById, productsById) {
  if (!hasExactKeys(placement, PLACEMENT_KEYS)
    || !isIdentifier(placement.placementId)) return false;
  if (placement.buildingId !== document.buildingId || placement.floorId !== document.floorId) return false;
  const room = roomsById.get(placement.roomId);
  const product = productsById.get(productKey(placement.productId));
  if (!room || !product
    || placement.articleId !== String(product.id)
    || placement.name !== product.name
    || placement.category !== product.category
    || placement.shape !== product.shape2d) return false;
  if (![placement.x, placement.y, placement.width, placement.depth, placement.rotation]
    .every(isFiniteNumber)
    || !isFiniteNumber(placement.height)) return false;
  if (placement.x < 0 || placement.y < 0 || placement.width <= 0 || placement.depth <= 0
    || placement.height <= 0 || !validRotation(placement.rotation)
    || !placementRectInsideFloor(placement, document.floor.extent)) return false;
  const dimensionsMatch = (Math.abs(placement.width - product.dimensions.width) <= EPSILON
      && Math.abs(placement.depth - product.dimensions.depth) <= EPSILON)
    || (Math.abs(placement.width - product.dimensions.depth) <= EPSILON
      && Math.abs(placement.depth - product.dimensions.width) <= EPSILON);
  if (!dimensionsMatch
    || Math.abs(placement.height - product.dimensions.height) > EPSILON) return false;
  const centreX = placement.x + placement.width / 2;
  const centreY = placement.y + placement.depth / 2;
  const [roomX, roomY, roomWidth, roomHeight] = room.rect;
  if (centreX < roomX - EPSILON || centreX > roomX + roomWidth + EPSILON
    || centreY < roomY - EPSILON || centreY > roomY + roomHeight + EPSILON) return false;
  return PLACEMENT_STATUSES.has(placement.status)
    && PLACEMENT_SOURCES.has(placement.source)
    && (placement.status !== 'illustrative' || placement.source === 'illustrative-prototype')
    && (placement.status !== 'new' || placement.source === 'user');
}

function validDocument(document, baseline = null) {
  if (!hasExactKeys(document, DOCUMENT_KEYS) || !isJsonValue(document)) return false;
  if (document.schema !== DRAFT_SCHEMA || document.persistence !== 'browser-local') return false;
  if (!isIdentifier(document.buildingId) || !isIdentifier(document.floorId)) return false;
  if (!validBuilding(document.building, document.buildingId)
    || !validFloor(document.floor, document.buildingId, document.floorId)
    || !validPlanningFloor(document.planningFloor, document.floorId)) return false;
  if (!Array.isArray(document.rooms) || document.rooms.length > 5000
    || !Array.isArray(document.products) || document.products.length > 1000
    || !Array.isArray(document.placements) || document.placements.length > 10000) return false;

  const roomsById = new Map();
  for (const room of document.rooms) {
    if (!validRoom(room, document.buildingId, document.floorId, document.floor.extent)
      || roomsById.has(room.spaceId)) return false;
    roomsById.set(room.spaceId, room);
  }
  const roomsByX = [...roomsById.values()].sort((left, right) => left.rect[0] - right.rect[0]);
  for (let leftIndex = 0; leftIndex < roomsByX.length; leftIndex += 1) {
    const left = roomsByX[leftIndex];
    const leftEdge = left.rect[0] + left.rect[2];
    for (let rightIndex = leftIndex + 1;
      rightIndex < roomsByX.length && roomsByX[rightIndex].rect[0] < leftEdge;
      rightIndex += 1) {
      if (roomRectsOverlap(left.rect, roomsByX[rightIndex].rect)) return false;
    }
  }

  const productsById = new Map();
  for (const product of document.products) {
    const key = productKey(product?.id);
    if (!validProduct(product) || productsById.has(key)) return false;
    productsById.set(key, product);
  }

  const placementIds = new Set();
  for (const placement of document.placements) {
    if (!validPlacement(placement, document, roomsById, productsById)
      || placementIds.has(placement.placementId)) return false;
    placementIds.add(placement.placementId);
  }

  if (document.placementSource !== 'illustrative-prototype'
    || !/^base-[0-9a-f]{8}$/.test(document.baseRevision)
    || !isSafeString(document.updatedBy, 200)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(document.updatedAt)
    || !Number.isFinite(Date.parse(document.updatedAt))) return false;

  if (!baseline) return true;
  if (baseline === document || !validDocument(baseline)) return baseline === document;
  return document.buildingId === baseline.buildingId
    && document.floorId === baseline.floorId
    && document.baseRevision === baseline.baseRevision
    && stableStringify(document.building) === stableStringify(baseline.building)
    && stableStringify(document.floor) === stableStringify(baseline.floor)
    && stableStringify(document.planningFloor) === stableStringify(baseline.planningFloor)
    && stableStringify(document.products) === stableStringify(baseline.products)
    && document.placementSource === baseline.placementSource;
}

/**
 * Validate an editor workspace without coupling the domain model to a storage
 * implementation. The local prototype repository uses this today; a future
 * API adapter can apply the same client-side guard before sending commands.
 */
export function validateEditorDocument(document, baseline = null) {
  return validDocument(document, baseline);
}

function normaliseLegacyDraft(source) {
  const draft = cloneDocument(source);
  if (!isPlainObject(draft) || !Array.isArray(draft.products) || !Array.isArray(draft.placements)) {
    return { document: draft, droppedPlacementIds: [] };
  }
  const productsById = new Map(draft.products.map((product) => [productKey(product?.id), product]));
  draft.placements.forEach((placement) => {
    if (!isPlainObject(placement)) return;
    const product = productsById.get(productKey(placement.productId));
    if (!product) return;
    placement.articleId = String(product.id);
    placement.name = product.name;
    placement.category = product.category;
    if (!Object.hasOwn(placement, 'height')) placement.height = product.dimensions?.height;
    placement.shape = product.shape2d;
    if (!Object.hasOwn(placement, 'source')) {
      placement.source = placement.status === 'new' ? 'user' : 'illustrative-prototype';
    }
  });
  if (validDocument(draft)) return { document: draft, droppedPlacementIds: [] };

  // Earlier v1 drafts checked only the unrotated rectangle and allowed three
  // placement fields to be omitted. Preserve their room edits and quarantine
  // only placements that cannot satisfy today's stronger footprint/schema.
  const withoutPlacements = { ...draft, placements: [] };
  if (!validDocument(withoutPlacements)) return { document: draft, droppedPlacementIds: [] };
  const placementIds = new Set();
  const droppedPlacementIds = [];
  draft.placements = draft.placements.filter((placement) => {
    const id = placement?.placementId;
    const valid = !placementIds.has(id)
      && validDocument({ ...withoutPlacements, placements: [placement] });
    if (valid) placementIds.add(id);
    else droppedPlacementIds.push(typeof id === 'string' ? id : '(ungültige ID)');
    return valid;
  });
  return { document: draft, droppedPlacementIds };
}

/**
 * Rehydrate a compatible browser draft onto the current immutable baseline.
 * The catalogue is reference data rather than user-owned draft state: current
 * products replace the embedded snapshot, while placement coordinates and room
 * edits are retained whenever their updated product still forms a valid object.
 */
export function rebaseEditorDocument(draft, baseline) {
  const normalisedLegacy = normaliseLegacyDraft(draft);
  const compatibleDraft = normalisedLegacy.document;
  if (!validDocument(compatibleDraft) || !validDocument(baseline)
    || compatibleDraft.buildingId !== baseline.buildingId
    || compatibleDraft.floorId !== baseline.floorId
    || compatibleDraft.baseRevision !== baseline.baseRevision) return null;

  const oldProducts = new Map(compatibleDraft.products.map((product) => [productKey(product.id), product]));
  const currentProducts = new Map(baseline.products.map((product) => [productKey(product.id), product]));
  const roomsById = new Map(compatibleDraft.rooms.map((room) => [room.spaceId, room]));
  const droppedPlacementIds = [...normalisedLegacy.droppedPlacementIds];
  const placements = [];

  compatibleDraft.placements.forEach((source) => {
    const oldProduct = oldProducts.get(productKey(source.productId));
    const product = currentProducts.get(productKey(source.productId));
    if (!oldProduct || !product) {
      droppedPlacementIds.push(source.placementId);
      return;
    }

    const normalOrientation = Math.abs(source.width - oldProduct.dimensions.width) <= EPSILON
      && Math.abs(source.depth - oldProduct.dimensions.depth) <= EPSILON;
    const width = normalOrientation ? product.dimensions.width : product.dimensions.depth;
    const depth = normalOrientation ? product.dimensions.depth : product.dimensions.width;
    const centreX = source.x + source.width / 2;
    const centreY = source.y + source.depth / 2;
    const placement = {
      ...cloneDocument(source),
      articleId: String(product.id),
      name: product.name,
      category: product.category,
      x: Number((centreX - width / 2).toFixed(3)),
      y: Number((centreY - depth / 2).toFixed(3)),
      width,
      depth,
      height: product.dimensions.height,
      shape: product.shape2d,
    };
    const room = roomsById.get(placement.roomId);
    const centreInsideRoom = room && centreX >= room.rect[0] - EPSILON
      && centreX <= room.rect[0] + room.rect[2] + EPSILON
      && centreY >= room.rect[1] - EPSILON
      && centreY <= room.rect[1] + room.rect[3] + EPSILON;
    if (!centreInsideRoom || !placementRectInsideFloor(placement, baseline.floor.extent)) {
      droppedPlacementIds.push(source.placementId);
      return;
    }
    placements.push(placement);
  });

  const document = {
    ...cloneDocument(compatibleDraft),
    schema: baseline.schema,
    persistence: baseline.persistence,
    buildingId: baseline.buildingId,
    floorId: baseline.floorId,
    building: cloneDocument(baseline.building),
    floor: cloneDocument(baseline.floor),
    planningFloor: cloneDocument(baseline.planningFloor),
    products: cloneDocument(baseline.products),
    placements,
    placementSource: baseline.placementSource,
    baseRevision: baseline.baseRevision,
  };
  if (!validDocument(document, baseline)) return null;
  return { document: cloneDocument(document), droppedPlacementIds };
}

function productRoles(products) {
  const by = (predicate) => products.filter(predicate);
  const roles = {
    desk: by((item) => item.subcategory === 'schreibtische'),
    officeChair: by((item) => item.subcategory === 'buerostuehle'),
    meetingTable: by((item) => item.subcategory === 'konferenztische'),
    meetingChair: by((item) => ['konferenzstuehle', 'konferenzsessel', 'besucherstuhl'].includes(item.subcategory)),
    lounge: by((item) => item.category === 'clubsessel-sofa'),
    sideTable: by((item) => item.subcategory === 'beistelltische'),
    coffee: by((item) => item.subcategory === 'kaffeemaschinen'),
    printer: by((item) => item.subcategory === 'drucker'),
    storage: by((item) => ['regale', 'schraenke', 'usm', 'korpus'].includes(item.category)),
  };
  Object.keys(roles).forEach((role) => { if (!roles[role].length) roles[role] = products; });
  return roles;
}

function desiredRoles(room) {
  const seats = Math.max(1, Math.min(Number(room.capacity) || 1, room.useType === 'openspace' ? 4 : 2));
  if (['buero', 'openspace', 'fokusraum', 'empfang'].includes(room.useType)) {
    return Array.from({ length: seats }, () => ['desk', 'officeChair']).flat();
  }
  if (room.useType === 'sitzung') {
    return ['meetingTable', ...Array.from({ length: Math.min(4, seats + 1) }, () => 'meetingChair')];
  }
  if (room.useType === 'lounge') return ['lounge', 'sideTable'];
  if (room.useType === 'teekueche') return ['coffee', 'sideTable'];
  if (room.useType === 'druckraum') return ['printer'];
  if (['archiv', 'lager'].includes(room.useType)) return ['storage', 'storage'];
  return [];
}

function pickProduct(candidates, seed, room) {
  const [, , roomWidth, roomHeight] = room.rect;
  const margin = Math.min(30, roomWidth * 0.06, roomHeight * 0.06);
  const fitting = candidates.filter(({ dimensions }) => {
    const width = dimensions.width;
    const depth = dimensions.depth;
    return width <= roomWidth - margin * 2 && depth <= roomHeight - margin * 2;
  });
  if (!fitting.length) return null;
  const index = parseInt(hashString(seed), 16) % fitting.length;
  return fitting[index];
}

function safeIdPart(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function generatePlacements(buildingId, floorId, rooms, products) {
  if (!products.length) return [];
  const roles = productRoles(products);
  const placements = [];

  rooms.forEach((room) => {
    const wanted = desiredRoles(room);
    if (!wanted.length) return;
    const [roomX, roomY, roomWidth, roomHeight] = room.rect;
    const margin = Math.min(30, roomWidth * 0.06, roomHeight * 0.06);
    const right = roomX + roomWidth - margin;
    const bottom = roomY + roomHeight - margin;
    let cursorX = roomX + margin;
    let cursorY = roomY + margin;
    let rowDepth = 0;

    wanted.forEach((role, ordinal) => {
      const product = pickProduct(roles[role], `${floorId}:${room.spaceId}:${role}:${ordinal}`, room);
      if (!product) return;
      const width = product.dimensions.width;
      const depth = product.dimensions.depth;
      if (cursorX + width > right) {
        cursorX = roomX + margin;
        cursorY += rowDepth + 24;
        rowDepth = 0;
      }
      if (cursorX + width > right || cursorY + depth > bottom) return;

      const placementId = `${safeIdPart(floorId)}--${safeIdPart(room.spaceId)}--demo-${ordinal + 1}-${safeIdPart(product.id)}`;
      placements.push({
        placementId,
        buildingId,
        floorId,
        roomId: room.spaceId,
        productId: product.id,
        articleId: String(product.id),
        name: product.name,
        category: product.category,
        x: Number(cursorX.toFixed(3)),
        y: Number(cursorY.toFixed(3)),
        width,
        depth,
        height: product.dimensions.height,
        rotation: 0,
        shape: product.shape2d,
        status: 'illustrative',
        source: 'illustrative-prototype',
      });
      cursorX += width + 24;
      rowDepth = Math.max(rowDepth, depth);
    });
  });

  return placements;
}

/**
 * Build a detached editor document from canonical portal records.
 * Generated placements are stable prototype assumptions, not actual inventory.
 */
export function createBaseline({ building, floor, spaces, products, planningFloor = null, user = null } = {}) {
  const floorId = String(floor?.floorId || '');
  const buildingId = String(building?.buildingId || building?.bbl_id || floor?.buildingId || '');
  if (!isIdentifier(floorId) || !isIdentifier(buildingId)) {
    throw new TypeError('createBaseline requires a building and floor with stable identifiers');
  }
  if (floor?.buildingId && floor.buildingId !== buildingId) {
    throw new TypeError('Floor and building identifiers do not match');
  }
  if (!Array.isArray(spaces) || !Array.isArray(products)) {
    throw new TypeError('createBaseline requires spaces and products arrays');
  }
  if (planningFloor?.floorId && planningFloor.floorId !== floorId) {
    throw new TypeError('Planning-floor and floor identifiers do not match');
  }

  const normalisedFloor = normaliseFloor(floor, buildingId, floorId);
  const rooms = spaces
    .filter((space) => space?.floorId === floorId)
    .map((space) => {
      if (space.buildingId !== buildingId) throw new TypeError('A room belongs to a different building');
      return normaliseRoom(space, buildingId, floorId);
    })
    .sort((left, right) => stableCompare(left.spaceId, right.spaceId));
  const catalogue = products
    .map(normaliseProduct)
    // A single unrelated, incomplete shop record must not make every floor
    // unavailable. Invalid records are quarantined at this adapter boundary.
    .filter(validProduct)
    .sort((left, right) => stableCompare(left.id, right.id));
  const normalisedBuilding = normaliseBuilding(building, buildingId);
  const normalisedPlanning = normalisePlanningFloor(planningFloor, floorId);
  const placements = generatePlacements(buildingId, floorId, rooms, catalogue);
  // A working copy becomes stale only when its plan/room source changes. Shop
  // catalogue changes and illustrative placements must not invalidate room
  // edits; production will replace this token with a server ETag/row version.
  const revisionPayload = {
    building: normalisedBuilding,
    floor: normalisedFloor,
    planningFloor: normalisedPlanning,
    rooms,
  };
  const document = {
    schema: DRAFT_SCHEMA,
    persistence: 'browser-local',
    buildingId,
    floorId,
    building: normalisedBuilding,
    floor: normalisedFloor,
    planningFloor: normalisedPlanning,
    rooms,
    products: catalogue,
    placements,
    placementSource: 'illustrative-prototype',
    baseRevision: `base-${hashString(stableStringify(revisionPayload))}`,
    updatedAt: new Date().toISOString(),
    updatedBy: userLabel(user),
  };

  if (!validDocument(document)) {
    throw new TypeError('Canonical floor-plan data does not satisfy the editor schema');
  }
  return cloneDocument(document);
}

/**
 * Bounded, clone-on-read history for editor documents.
 * `push` starts a new branch and therefore clears the redo stack.
 */
export class EditorHistory {
  constructor(initialDocument = null, limit = 50) {
    if (typeof initialDocument === 'number' && arguments.length === 1) {
      limit = initialDocument;
      initialDocument = null;
    }
    const requestedLimit = Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : 50;
    this.limit = Math.max(1, Math.min(MAX_HISTORY, requestedLimit));
    this._past = [];
    this._present = initialDocument == null ? null : cloneDocument(initialDocument);
    this._future = [];
  }

  get current() { return this._present == null ? null : cloneDocument(this._present); }
  get canUndo() { return this._past.length > 0; }
  get canRedo() { return this._future.length > 0; }

  push(document) {
    if (document == null) throw new TypeError('EditorHistory.push requires a document');
    const next = cloneDocument(document);
    if (this._present === null) {
      this._present = next;
      this._future = [];
      return this.current;
    }
    if (stableStringify(this._present) === stableStringify(next)) return this.current;
    this._past.push(this._present);
    if (this._past.length > this.limit) this._past.splice(0, this._past.length - this.limit);
    this._present = next;
    this._future = [];
    return this.current;
  }

  undo() {
    if (!this.canUndo) return null;
    this._future.push(this._present);
    this._present = this._past.pop();
    return this.current;
  }

  redo() {
    if (!this.canRedo) return null;
    this._past.push(this._present);
    if (this._past.length > this.limit) this._past.splice(0, this._past.length - this.limit);
    this._present = this._future.pop();
    return this.current;
  }

  reset(document = null) {
    this._past = [];
    this._future = [];
    this._present = document == null ? null : cloneDocument(document);
    return this.current;
  }
}
