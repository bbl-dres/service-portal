// Pure model regression for the standalone Plan-Editor. This intentionally has
// no DOM/browser dependency: canonical inputs, strict local-draft validation,
// immutability and bounded history should fail fast before the UI is involved.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = async (path) => JSON.parse(await readFile(join(ROOT, path), 'utf8'));

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};

const [{ features }, floors, spaces, products, planning, model, repository, commands] = await Promise.all([
  json('data/buildings.geojson'), json('data/floors.json'), json('data/spaces.json'),
  json('data/shop-products.json'), json('data/workspace-planning.json'),
  import('../js/floorplan-editor/model.js'),
  import('../js/floorplan-editor/repository.js'),
  import('../js/floorplan-editor/commands.js'),
]);

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};
const buildings = new Map(features.map(feature => [feature.properties['bbl_id'], feature.properties]));
const planningByBuilding = new Map(planning.map(entry => [entry.buildingId, entry]));
const planningFloor = floor => planningByBuilding.get(floor.buildingId)?.floors
  ?.find(entry => entry.floorId === floor.floorId) || null;
const baselineFor = floor => model.createBaseline({
  building: buildings.get(floor.buildingId), floor,
  spaces: spaces.filter(space => space.floorId === floor.floorId),
  products, planningFloor: planningFloor(floor), user: { name: 'Modelltest' },
});

console.log('■ Canonical baselines');
let placementCount = 0;
let relationshipErrors = 0;
for (const floor of floors) {
  const document = baselineFor(floor);
  placementCount += document.placements.length;
  const rooms = new Map(document.rooms.map(room => [room.spaceId, room]));
  const productIds = new Set(document.products.map(product => `${typeof product.id}:${product.id}`));
  if (document.rooms.length !== spaces.filter(space => space.floorId === floor.floorId).length) relationshipErrors++;
  for (const placement of document.placements) {
    const room = rooms.get(placement.roomId);
    const [x, y, width, height] = room?.rect || [];
    const cx = placement.x + placement.width / 2;
    const cy = placement.y + placement.depth / 2;
    if (!room || !productIds.has(`${typeof placement.productId}:${placement.productId}`)
      || cx < x || cx > x + width || cy < y || cy > y + height) relationshipErrors++;
  }
}
check(relationshipErrors === 0, 'All floors retain complete room, product and geometry relationships',
  `${floors.length} floors · ${spaces.length} rooms · ${placementCount} illustrative placements`);

const floor = floors.find(entry => entry.floorId === '1080-6650-AA-2og');
const sourceRoom = spaces.find(entry => entry.floorId === floor.floorId);
const sourceSnapshot = JSON.stringify(sourceRoom);
const baseline = baselineFor(floor);
const repeated = baselineFor(floor);
check(baseline.baseRevision === repeated.baseRevision
  && JSON.stringify(baseline.rooms) === JSON.stringify(repeated.rooms)
  && JSON.stringify(baseline.products) === JSON.stringify(repeated.products)
  && JSON.stringify(baseline.placements) === JSON.stringify(repeated.placements),
'Identical core data produces the same revision and initial placements', baseline.baseRevision);
const changedCatalogue = products.map((product, index) => index ? product : { ...product, price: Number(product.price || 0) + 1 });
const catalogueOnlyChange = model.createBaseline({
  building: buildings.get(floor.buildingId), floor,
  spaces: spaces.filter(space => space.floorId === floor.floorId),
  products: changedCatalogue, planningFloor: planningFloor(floor), user: { name: 'Modelltest' },
});
check(catalogueOnlyChange.baseRevision === repeated.baseRevision,
  'Catalogue changes do not invalidate a room draft unnecessarily');
baseline.rooms[0]['occupierVe'] = 'Nur im Entwurf';
check(JSON.stringify(sourceRoom) === sourceSnapshot,
  'The detached editor document does not mutate the source room');

console.log('■ Document commands');
const commandDocument = model.cloneDocument(repeated);
const commandRoom = commandDocument.rooms.find(room => commandDocument.placements.some(item => item.roomId === room.spaceId));
commandDocument.rooms = [commandRoom];
commandDocument.placements = commandDocument.placements.filter(item => item.roomId === commandRoom.spaceId);
const roomPlacements = commandDocument.placements.filter(item => item.roomId === commandRoom.spaceId);
const oldRect = commandRoom.rect.slice();
const dx = oldRect[0] >= 10 ? -10 : 10;
const oldPlacementX = roomPlacements[0].x;
check(commands.updateRoomAttribute(commandDocument, commandRoom.spaceId, 'occupierVe', 'Befehlstest VE')
  && commandRoom['occupierVe'] === 'Befehlstest VE',
  'Room attributes change through the domain command interface');
check(commands.updateRoomGeometry(commandDocument, commandRoom.spaceId, 'x', oldRect[0] + dx, floor.extent)
  && commandRoom.rect[0] === oldRect[0] + dx && roomPlacements[0].x === oldPlacementX + dx,
  'Moving a room keeps its placements relative to the room');
const validSnapshot = JSON.stringify(commandDocument);
check(!commands.updateRoomGeometry(commandDocument, commandRoom.spaceId, 'width', floor.extent[0] + 100, floor.extent)
  && JSON.stringify(commandDocument) === validSnapshot,
  'Invalid room geometry is rejected without partially changing the document');
const commandPlacement = commandDocument.placements[0];
const commandPlacementX = commandPlacement.x;
check(commands.updatePlacement(commandDocument, commandPlacement.placementId, 'x', commandPlacementX, floor)
  && commandPlacement.x === commandPlacementX && model.validateEditorDocument(commandDocument, repeated),
  'Placement commands preserve room, product and floor invariants');

const commandGuardSnapshot = JSON.stringify(commandDocument);
check(!commands.updateRoomAttribute(commandDocument, commandRoom.spaceId, 'unbekannt', 'Wert')
  && !commands.updateRoomAttribute(commandDocument, commandRoom.spaceId, 'useType', 'ungueltig')
  && !commands.updateRoomAttribute(commandDocument, commandRoom.spaceId, 'capacity', 1.5)
  && !commands.updatePlacement(commandDocument, commandPlacement.placementId, 'width', 20, floor)
  && !commands.updatePlacement(commandDocument, commandPlacement.placementId, 'rotation', 22, floor)
  && JSON.stringify(commandDocument) === commandGuardSnapshot,
  'Commands reject unknown fields and invalid domain values without mutation');

const overlapDocument = model.cloneDocument(repeated);
overlapDocument.rooms = overlapDocument.rooms.slice(0, 2);
overlapDocument.placements = [];
commands.stampRoomGeometry(overlapDocument.rooms[0], [0, 0, 300, 300]);
commands.stampRoomGeometry(overlapDocument.rooms[1], [300, 0, 300, 300]);
const touchingSnapshot = JSON.stringify(overlapDocument);
check(model.validateEditorDocument(overlapDocument, repeated)
  && !model.roomRectsOverlap(overlapDocument.rooms[0].rect, overlapDocument.rooms[1].rect),
  'Room edges may touch without overlapping');
check(!commands.updateRoomGeometry(overlapDocument, overlapDocument.rooms[0].spaceId,
  'width', 301, floor.extent)
  && JSON.stringify(overlapDocument) === touchingSnapshot,
  'Room changes that create overlap are rejected atomically');
check(commands.createLocalRoom({
  floor, buildingId: repeated.buildingId, rect: [250, 50, 100, 100], ordinal: 1,
  id: 'local-room-overlap-test', rooms: overlapDocument.rooms,
}) === null,
'New rooms cannot overlap existing rooms');
const invalidOverlap = model.cloneDocument(overlapDocument);
commands.stampRoomGeometry(invalidOverlap.rooms[1], [299, 0, 300, 300]);
check(!model.validateEditorDocument(invalidOverlap),
  'Document validation rejects room overlap independently of the UI');

const atomicMove = model.cloneDocument(repeated);
const boundaryPlacement = atomicMove.placements[0];
const boundaryRoom = atomicMove.rooms.find(room => room.spaceId === boundaryPlacement.roomId);
atomicMove.rooms = [boundaryRoom];
atomicMove.placements = [boundaryPlacement];
const roomX = Math.ceil(boundaryPlacement.width / 2) + 20;
const roomWidth = Math.max(200, boundaryPlacement.width);
const roomHeight = Math.max(200, boundaryPlacement.depth + 20);
commands.stampRoomGeometry(boundaryRoom, [roomX, 100, roomWidth, roomHeight]);
boundaryPlacement.x = roomX - boundaryPlacement.width / 2 + 1;
boundaryPlacement.y = 110;
boundaryPlacement.rotation = 0;
const atomicSnapshot = JSON.stringify(atomicMove);
check(model.validateEditorDocument(atomicMove, repeated)
  && !commands.updateRoomGeometry(atomicMove, boundaryRoom.spaceId, 'x', 0, floor.extent)
  && JSON.stringify(atomicMove) === atomicSnapshot,
  'Room moves are rejected when a complete placement footprint leaves the floor');

const rotationBoundary = model.cloneDocument(atomicMove);
const rotatedPlacement = rotationBoundary.placements[0];
const rotatedRoom = rotationBoundary.rooms[0];
commands.stampRoomGeometry(rotatedRoom, [0, 0,
  Math.max(300, rotatedPlacement.width + 100), Math.max(300, rotatedPlacement.depth + 100)]);
rotatedPlacement.x = 0;
rotatedPlacement.y = 0;
rotatedPlacement.rotation = 0;
const rejectedRotation = rotatedPlacement.width === rotatedPlacement.depth ? 45 : 90;
const rotationSnapshot = JSON.stringify(rotationBoundary);
check(model.validateEditorDocument(rotationBoundary, repeated)
  && !commands.updatePlacement(rotationBoundary, rotatedPlacement.placementId, 'rotation', rejectedRotation, floor)
  && JSON.stringify(rotationBoundary) === rotationSnapshot,
  'Rotations outside the floor boundary are rejected without shifting position');

console.log('■ Strict domain validation');
const wrongArea = model.cloneDocument(repeated);
wrongArea.rooms[0].area += 1;
const wrongLabels = model.cloneDocument(repeated);
wrongLabels.rooms[0].useLabel = 'Widersprüchliche Nutzung';
const wrongSia = model.cloneDocument(repeated);
wrongSia.rooms[0].siaLabel = 'Widersprüchliche SIA-Bezeichnung';
const wrongCapacity = model.cloneDocument(repeated);
wrongCapacity.rooms[0].capacity = 1.5;
const wrongPlacementMetadata = model.cloneDocument(repeated);
wrongPlacementMetadata.placements[0].name = 'Anderer Artikel';
const wrongRotation = model.cloneDocument(repeated);
wrongRotation.placements[0].rotation = -45;
check([wrongArea, wrongLabels, wrongSia, wrongCapacity, wrongPlacementMetadata, wrongRotation]
  .every(document => !model.validateEditorDocument(document)),
'Derived room data, capacities, product metadata and rotations remain canonical');
const changedImmutable = model.cloneDocument(repeated);
changedImmutable.building.name = 'Manipulierter Referenzname';
const changedProductReference = model.cloneDocument(repeated);
changedProductReference.products[0].price += 1;
check(model.validateEditorDocument(changedImmutable)
  && !model.validateEditorDocument(changedImmutable, repeated)
  && model.validateEditorDocument(changedProductReference)
  && !model.validateEditorDocument(changedProductReference, repeated)
  && !repository.saveWorkingCopy(changedImmutable, repeated).ok
  && !repository.saveWorkingCopy(changedProductReference, repeated).ok,
  'Baseline validation protects building, floor and current catalogue references');
const catalogueWithInvalidRecord = model.createBaseline({
  building: buildings.get(floor.buildingId), floor,
  spaces: spaces.filter(space => space.floorId === floor.floorId),
  products: [...products, { id: 'kaputt', name: 'Unvollständig' }],
  planningFloor: planningFloor(floor), user: { name: 'Modelltest' },
});
check(model.validateEditorDocument(catalogueWithInvalidRecord)
  && !catalogueWithInvalidRecord.products.some(product => product.id === 'kaputt'),
  'Incomplete unrelated catalogue records do not block the editor');

console.log('■ Browser-local draft');
const saved = repository.saveWorkingCopy(baseline);
const loaded = repository.loadWorkingCopy(floor.floorId, repeated);
check(saved.ok && loaded.ok && loaded.source === 'browser-local'
  && loaded.document.rooms[0]['occupierVe'] === 'Nur im Entwurf',
'A valid draft is stamped and loaded independently');

const draftKey = `${repository.DRAFT_PREFIX}${encodeURIComponent(floor.floorId)}`;
const stale = model.cloneDocument(repeated);
stale.baseRevision = 'base-deadbeef';
localStorage.setItem(draftKey, JSON.stringify(stale));
const staleResult = repository.loadWorkingCopy(floor.floorId, repeated);
check(staleResult.ok && staleResult.source === 'baseline'
  && staleResult.document.baseRevision === repeated.baseRevision
  && staleResult.archivedDraft
  && Boolean(localStorage.getItem(staleResult.archiveKey)),
'A foreign baseline revision falls back safely and remains recoverable from the archive');

localStorage.setItem(draftKey, '{kaputt');
const corruptResult = repository.loadWorkingCopy(floor.floorId, repeated);
check(corruptResult.ok && corruptResult.source === 'baseline',
  'Corrupt JSON is not accepted as a draft');

const invalid = model.cloneDocument(repeated);
const placement = invalid.placements[0];
placement.roomId = invalid.rooms.find(room => room.spaceId !== placement.roomId).spaceId;
check(!repository.saveWorkingCopy(invalid).ok,
  'A placement outside its referenced room is not saved');
check(repository.removeWorkingCopy(floor.floorId) && !localStorage.getItem(draftKey),
  'Removing a draft deletes only its floor-specific editor key');

const draftLockKey = `bbl_floorplan_editor_lock_v1:draft:${encodeURIComponent(floor.floorId)}`;
localStorage.setItem(draftLockKey, JSON.stringify({ token: 'anderer-tab', expiresAt: Date.now() + 5000 }));
const conflictedSave = repository.saveWorkingCopy(repeated, repeated);
localStorage.removeItem(draftLockKey);
check(!conflictedSave.ok && conflictedSave.reason === 'storage-conflict'
  && !localStorage.getItem(draftKey),
  'An active write in another tab is not silently overwritten');

console.log('■ Catalogue rebase and draft migration');
const catalogueDraft = model.cloneDocument(repeated);
catalogueDraft.rooms[0].roomName = 'Bleibt beim Katalog-Rebase erhalten';
check(repository.saveWorkingCopy(catalogueDraft, repeated).ok,
  'The source draft for catalogue migration is saved');
const referencedPlacement = repeated.placements[0];
const referencedProduct = repeated.products.find(product => `${typeof product.id}:${product.id}`
  === `${typeof referencedPlacement.productId}:${referencedPlacement.productId}`);
const addedProduct = {
  ...model.cloneDocument(referencedProduct),
  id: 'catalogue-rebase-new-product',
  name: 'Neu im aktuellen Katalog',
};
const extendedBaseline = model.createBaseline({
  building: buildings.get(floor.buildingId), floor,
  spaces: spaces.filter(space => space.floorId === floor.floorId),
  products: [...products, addedProduct], planningFloor: planningFloor(floor), user: { name: 'Modelltest' },
});
const extendedLoad = repository.loadWorkingCopy(floor.floorId, extendedBaseline);
check(extendedLoad.ok && extendedLoad.source === 'browser-local' && extendedLoad.reconciled
  && extendedLoad.droppedPlacementIds.length === 0
  && extendedLoad.document.rooms[0].roomName === 'Bleibt beim Katalog-Rebase erhalten'
  && extendedLoad.document.products.some(product => product.id === addedProduct.id),
  'A compatible draft adopts the current catalogue without losing room changes');
const currentNewProduct = extendedLoad.document.products.find(product => product.id === addedProduct.id);
const newProductPlacement = {
  ...model.cloneDocument(referencedPlacement),
  placementId: 'placement-current-catalogue-product',
  productId: currentNewProduct.id,
  articleId: String(currentNewProduct.id),
  name: currentNewProduct.name,
  category: currentNewProduct.category,
  width: currentNewProduct.dimensions.width,
  depth: currentNewProduct.dimensions.depth,
  height: currentNewProduct.dimensions.height,
  shape: currentNewProduct.shape2d,
  status: 'new',
  source: 'user',
};
extendedLoad.document.placements.push(newProductPlacement);
check(model.validateEditorDocument(extendedLoad.document, extendedBaseline)
  && repository.saveWorkingCopy(extendedLoad.document, extendedBaseline).ok,
  'New catalogue products can be placed and saved in an existing draft');

const legacyDraft = model.cloneDocument(repeated);
legacyDraft.rooms[0].roomName = 'Migrierter v1-Entwurf';
delete legacyDraft.placements[0].category;
delete legacyDraft.placements[0].height;
delete legacyDraft.placements[0].source;
localStorage.setItem(draftKey, JSON.stringify(legacyDraft));
const legacyLoad = repository.loadWorkingCopy(floor.floorId, repeated);
check(legacyLoad.ok && legacyLoad.source === 'browser-local' && legacyLoad.reconciled
  && legacyLoad.document.rooms[0].roomName === 'Migrierter v1-Entwurf'
  && Object.hasOwn(legacyLoad.document.placements[0], 'category')
  && Object.hasOwn(legacyLoad.document.placements[0], 'height')
  && Object.hasOwn(legacyLoad.document.placements[0], 'source'),
  'Valid v1 drafts with formerly optional placement fields migrate canonically');
const legacyFootprintDraft = model.cloneDocument(rotationBoundary);
legacyFootprintDraft.placements[0].rotation = rejectedRotation;
const legacyFootprintRebase = model.rebaseEditorDocument(legacyFootprintDraft, repeated);
check(legacyFootprintRebase
  && legacyFootprintRebase.droppedPlacementIds.includes(rotatedPlacement.placementId)
  && legacyFootprintRebase.document.placements.length === 0,
  'Formerly valid boundary rotations preserve rooms and report the dropped placement');

const resizedProducts = products.map(product => `${typeof product.id}:${product.id}`
  === `${typeof referencedProduct.id}:${referencedProduct.id}`
  ? { ...product, dimensions: {
    ...product.dimensions,
    width: Number(product.dimensions.width) + 2,
    depth: Number(product.dimensions.depth) + 2,
  } }
  : product);
const resizedBaseline = model.createBaseline({
  building: buildings.get(floor.buildingId), floor,
  spaces: spaces.filter(space => space.floorId === floor.floorId),
  products: resizedProducts, planningFloor: planningFloor(floor), user: { name: 'Modelltest' },
});
const resizeDraft = model.cloneDocument(repeated);
const oldCentreX = referencedPlacement.x + referencedPlacement.width / 2;
const oldCentreY = referencedPlacement.y + referencedPlacement.depth / 2;
localStorage.setItem(draftKey, JSON.stringify(resizeDraft));
const resizeLoad = repository.loadWorkingCopy(floor.floorId, resizedBaseline);
const resizedPlacement = resizeLoad.document.placements
  .find(item => item.placementId === referencedPlacement.placementId);
check(resizeLoad.ok && resizeLoad.reconciled && resizedPlacement
  && resizedPlacement.width === referencedPlacement.width + 2
  && resizedPlacement.depth === referencedPlacement.depth + 2
  && Math.abs(resizedPlacement.x + resizedPlacement.width / 2 - oldCentreX) < 0.001
  && Math.abs(resizedPlacement.y + resizedPlacement.depth / 2 - oldCentreY) < 0.001,
  'Changed product dimensions retain the placement centre safely');

const catalogueWithoutReferenced = products.filter(product => `${typeof product.id}:${product.id}`
  !== `${typeof referencedProduct.id}:${referencedProduct.id}`);
const removedProductBaseline = model.createBaseline({
  building: buildings.get(floor.buildingId), floor,
  spaces: spaces.filter(space => space.floorId === floor.floorId),
  products: catalogueWithoutReferenced, planningFloor: planningFloor(floor), user: { name: 'Modelltest' },
});
localStorage.setItem(draftKey, JSON.stringify(repeated));
const removedProductLoad = repository.loadWorkingCopy(floor.floorId, removedProductBaseline);
const archivedRemovedProductDraft = JSON.parse(localStorage.getItem(removedProductLoad.archiveKey));
check(removedProductLoad.ok && removedProductLoad.reconciled
  && removedProductLoad.droppedPlacementIds.includes(referencedPlacement.placementId)
  && !removedProductLoad.document.placements.some(item => `${typeof item.productId}:${item.productId}`
    === `${typeof referencedProduct.id}:${referencedProduct.id}`)
  && model.validateEditorDocument(removedProductLoad.document, removedProductBaseline)
  && removedProductLoad.archivedOriginalDraft
  && !removedProductLoad.persistedReconciliation
  && removedProductLoad.reconciliationPersistenceReason === 'review-required'
  && archivedRemovedProductDraft.placements.some(item => item.placementId === referencedPlacement.placementId)
  && JSON.stringify(JSON.parse(localStorage.getItem(draftKey))) === JSON.stringify(repeated),
  'Placement loss is reported, archived exactly and applied only after explicit save');

const archivalFailureDraft = model.cloneDocument(repeated);
archivalFailureDraft.rooms[0].roomName = 'Darf bei Archivfehler nicht überschrieben werden';
localStorage.setItem(draftKey, JSON.stringify(archivalFailureDraft));
const originalSetItem = localStorage.setItem;
let archivalFailureLoad;
try {
  localStorage.setItem = (key, value) => {
    if (key.startsWith(repository.DRAFT_ARCHIVE_PREFIX)) throw new Error('Archive intentionally unavailable');
    return originalSetItem(key, value);
  };
  archivalFailureLoad = repository.loadWorkingCopy(floor.floorId, removedProductBaseline);
} finally {
  localStorage.setItem = originalSetItem;
}
check(archivalFailureLoad.ok && archivalFailureLoad.reconciled
  && !archivalFailureLoad.persistedReconciliation
  && !archivalFailureLoad.archivedOriginalDraft
  && archivalFailureLoad.reconciliationPersistenceReason === 'archive-unavailable'
  && JSON.stringify(JSON.parse(localStorage.getItem(draftKey))) === JSON.stringify(archivalFailureDraft),
  'A failed safety archive leaves the active working copy unchanged');
repository.removeWorkingCopy(floor.floorId);

console.log('■ Simulated local publications');
const firstPublish = repository.publishLocalRevision(saved.document, repeated, 'Modelltest');
const changed = model.cloneDocument(saved.document);
changed.rooms[0].roomName = 'Zweite lokale Version';
const secondPublish = repository.publishLocalRevision(changed, repeated, 'Modelltest');
const revisions = repository.loadRevisionHistory(floor.floorId, repeated);
changed.rooms[0].roomName = 'Nachträglich verändert';
check(firstPublish.ok && secondPublish.ok && revisions.length === 2
  && revisions[0].number === 1 && revisions[1].number === 2,
  'Publishing appends numbered local revisions');
check(revisions[0].document.rooms[0].roomName !== 'Nachträglich verändert'
  && revisions[1].document.rooms[0].roomName === 'Zweite lokale Version',
  'Local publications remain detached from later changes');
const historyAfterCatalogueChange = repository.loadRevisionHistory(floor.floorId, catalogueOnlyChange);
const changedCatalogueProduct = catalogueOnlyChange.products.find(product => `${typeof product.id}:${product.id}`
  === `${typeof repeated.products[0].id}:${repeated.products[0].id}`);
const historicalCatalogueProduct = historyAfterCatalogueChange[0]?.document.products
  .find(product => `${typeof product.id}:${product.id}`
    === `${typeof repeated.products[0].id}:${repeated.products[0].id}`);
check(historyAfterCatalogueChange.length === 2
  && historicalCatalogueProduct.price === repeated.products[0].price
  && historicalCatalogueProduct.price !== changedCatalogueProduct.price,
  'Published versions retain their original catalogue snapshot');
const historyKey = repository.revisionHistoryKey(floor.floorId, repeated.baseRevision);
const legacyHistoryKey = `${repository.HISTORY_PREFIX}${encodeURIComponent(floor.floorId)}`;
const legacyEnvelope = localStorage.getItem(historyKey);
repository.removeRevisionHistory(floor.floorId);
localStorage.setItem(legacyHistoryKey, legacyEnvelope);
check(repository.loadRevisionHistory(floor.floorId, repeated).length === 2
  && !localStorage.getItem(legacyHistoryKey) && Boolean(localStorage.getItem(historyKey)),
  'Earlier floor-specific history keys migrate once to the baseline revision');
const unexpectedHistoryKey = JSON.parse(localStorage.getItem(historyKey));
unexpectedHistoryKey.unexpected = true;
localStorage.setItem(historyKey, JSON.stringify(unexpectedHistoryKey));
check(repository.loadRevisionHistory(floor.floorId, repeated).length === 0
  && Boolean(localStorage.getItem(historyKey)),
  'History envelopes with unknown fields are rejected but kept recoverable');
repository.removeRevisionHistory(floor.floorId, repeated.baseRevision);
repository.publishLocalRevision(saved.document, repeated, 'Modelltest');
repository.publishLocalRevision(secondPublish.revision.document, repeated, 'Modelltest');
const unorderedHistory = JSON.parse(localStorage.getItem(historyKey));
unorderedHistory.revisions[1].number = unorderedHistory.revisions[0].number;
localStorage.setItem(historyKey, JSON.stringify(unorderedHistory));
check(repository.loadRevisionHistory(floor.floorId, repeated).length === 0
  && Boolean(localStorage.getItem(historyKey)),
  'Duplicate or unordered revision numbers are neither accepted nor overwritten');
repository.removeRevisionHistory(floor.floorId, repeated.baseRevision);
repository.publishLocalRevision(saved.document, repeated, 'Modelltest');
const changedSpaces = spaces.filter(space => space.floorId === floor.floorId)
  .map((space, index) => index ? space : { ...space, roomName: `${space.roomName || space.useLabel} aktualisiert` });
const rolledBaseline = model.createBaseline({
  building: buildings.get(floor.buildingId), floor, spaces: changedSpaces, products,
  planningFloor: planningFloor(floor), user: { name: 'Modelltest' },
});
check(rolledBaseline.baseRevision !== repeated.baseRevision
  && repository.loadRevisionHistory(floor.floorId, rolledBaseline).length === 0
  && Boolean(localStorage.getItem(historyKey)),
  'A new room baseline leaves earlier local publications recoverable');
check(repository.removeRevisionHistory(floor.floorId) && !localStorage.getItem(historyKey),
  'Local revision history can be removed independently');

console.log('■ History');
const history = new model.EditorHistory(repeated, 2);
for (const name of ['A', 'B', 'C']) {
  const next = history.current;
  next.rooms[0].roomName = name;
  history.push(next);
}
const undoOne = history.undo();
const undoTwo = history.undo();
const undoLimit = history.undo();
const redo = history.redo();
check(undoOne.rooms[0].roomName === 'B' && undoTwo.rooms[0].roomName === 'A'
  && undoLimit === null && redo.rooms[0].roomName === 'B',
'Undo and redo stay cloned, branch correctly and respect the history limit');

console.log(failures ? `\n✗ ${failures} check(s) failed` : '\n✓ all model checks passed');
process.exit(failures ? 1 : 0);
