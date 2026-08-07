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
const buildings = new Map(features.map(feature => [feature.properties.bbl_id, feature.properties]));
const planningByBuilding = new Map(planning.map(entry => [entry.buildingId, entry]));
const planningFloor = floor => planningByBuilding.get(floor.buildingId)?.floors
  ?.find(entry => entry.floorId === floor.floorId) || null;
const baselineFor = floor => model.createBaseline({
  building: buildings.get(floor.buildingId), floor,
  spaces: spaces.filter(space => space.floorId === floor.floorId),
  products, planningFloor: planningFloor(floor), user: { name: 'Modelltest' },
});

console.log('■ Kanonische Baselines');
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
check(relationshipErrors === 0, 'alle Geschosse behalten geschlossene Raum-/Produkt-/Geometriebezüge',
  `${floors.length} Geschosse · ${spaces.length} Räume · ${placementCount} illustrative Positionen`);

const floor = floors.find(entry => entry.floorId === '1080-6650-AA-2og');
const sourceRoom = spaces.find(entry => entry.floorId === floor.floorId);
const sourceSnapshot = JSON.stringify(sourceRoom);
const baseline = baselineFor(floor);
const repeated = baselineFor(floor);
check(baseline.baseRevision === repeated.baseRevision
  && JSON.stringify(baseline.rooms) === JSON.stringify(repeated.rooms)
  && JSON.stringify(baseline.products) === JSON.stringify(repeated.products)
  && JSON.stringify(baseline.placements) === JSON.stringify(repeated.placements),
'gleiche Kerndaten erzeugen dieselbe Revision und dieselben Startpositionen', baseline.baseRevision);
const changedCatalogue = products.map((product, index) => index ? product : { ...product, price: Number(product.price || 0) + 1 });
const catalogueOnlyChange = model.createBaseline({
  building: buildings.get(floor.buildingId), floor,
  spaces: spaces.filter(space => space.floorId === floor.floorId),
  products: changedCatalogue, planningFloor: planningFloor(floor), user: { name: 'Modelltest' },
});
check(catalogueOnlyChange.baseRevision === repeated.baseRevision,
  'Katalogänderungen machen eine Raum-Arbeitskopie nicht unnötig ungültig');
baseline.rooms[0].occupierVe = 'Nur im Entwurf';
check(JSON.stringify(sourceRoom) === sourceSnapshot,
  'das abgelöste Editor-Dokument mutiert den eingelesenen Raum nicht');

console.log('■ Dokumentbefehle');
const commandDocument = model.cloneDocument(repeated);
const commandRoom = commandDocument.rooms.find(room => commandDocument.placements.some(item => item.roomId === room.spaceId));
const roomPlacements = commandDocument.placements.filter(item => item.roomId === commandRoom.spaceId);
const oldRect = commandRoom.rect.slice();
const dx = oldRect[0] >= 10 ? -10 : 10;
const oldPlacementX = roomPlacements[0].x;
check(commands.updateRoomAttribute(commandDocument, commandRoom.spaceId, 'occupierVe', 'Befehlstest VE')
  && commandRoom.occupierVe === 'Befehlstest VE',
  'Raumattribute werden über die fachliche Befehlsschnittstelle geändert');
check(commands.updateRoomGeometry(commandDocument, commandRoom.spaceId, 'x', oldRect[0] + dx, floor.extent)
  && commandRoom.rect[0] === oldRect[0] + dx && roomPlacements[0].x === oldPlacementX + dx,
  'Raumverschiebungen halten zugeordnete Objekte relativ zur Fläche');
const validSnapshot = JSON.stringify(commandDocument);
check(!commands.updateRoomGeometry(commandDocument, commandRoom.spaceId, 'width', floor.extent[0] + 100, floor.extent)
  && JSON.stringify(commandDocument) === validSnapshot,
  'ungültige Raumgeometrie wird ohne Teildokument-Änderung abgelehnt');
const commandPlacement = commandDocument.placements[0];
check(commands.updatePlacement(commandDocument, commandPlacement.placementId, 'rotation', 45, floor)
  && commandPlacement.rotation === 45 && model.validateEditorDocument(commandDocument, repeated),
  'Objektbefehle bewahren Raum-, Produkt- und Geschossinvarianten');

console.log('■ Browser-lokaler Entwurf');
const saved = repository.saveWorkingCopy(baseline);
const loaded = repository.loadWorkingCopy(floor.floorId, repeated);
check(saved.ok && loaded.ok && loaded.source === 'browser-local'
  && loaded.document.rooms[0].occupierVe === 'Nur im Entwurf',
'ein valider Entwurf wird gestempelt und getrennt wieder geladen');

const draftKey = `${repository.DRAFT_PREFIX}${encodeURIComponent(floor.floorId)}`;
const stale = model.cloneDocument(repeated);
stale.baseRevision = 'base-deadbeef';
localStorage.setItem(draftKey, JSON.stringify(stale));
const staleResult = repository.loadWorkingCopy(floor.floorId, repeated);
check(staleResult.ok && staleResult.source === 'baseline'
  && staleResult.document.baseRevision === repeated.baseRevision,
'eine fremde Basisrevision fällt sicher auf den Ausgangsstand zurück');

localStorage.setItem(draftKey, '{kaputt');
const corruptResult = repository.loadWorkingCopy(floor.floorId, repeated);
check(corruptResult.ok && corruptResult.source === 'baseline',
  'beschädigtes JSON wird nicht als Entwurf übernommen');

const invalid = model.cloneDocument(repeated);
const placement = invalid.placements[0];
placement.roomId = invalid.rooms.find(room => room.spaceId !== placement.roomId).spaceId;
check(!repository.saveWorkingCopy(invalid).ok,
  'ein Objekt ausserhalb seines referenzierten Raums wird nicht gespeichert');
check(repository.removeWorkingCopy(floor.floorId) && !localStorage.getItem(draftKey),
  'Entfernen löscht nur den geschossbezogenen Editor-Schlüssel');

console.log('■ Simulierte lokale Publikationen');
const firstPublish = repository.publishLocalRevision(saved.document, repeated, 'Modelltest');
const changed = model.cloneDocument(saved.document);
changed.rooms[0].roomName = 'Zweite lokale Version';
const secondPublish = repository.publishLocalRevision(changed, repeated, 'Modelltest');
const revisions = repository.loadRevisionHistory(floor.floorId, repeated);
changed.rooms[0].roomName = 'Nachträglich verändert';
check(firstPublish.ok && secondPublish.ok && revisions.length === 2
  && revisions[0].number === 1 && revisions[1].number === 2,
  'Publizieren hängt nummerierte lokale Revisionen an');
check(revisions[0].document.rooms[0].roomName !== 'Nachträglich verändert'
  && revisions[1].document.rooms[0].roomName === 'Zweite lokale Version',
  'lokale Publikationen bleiben von späteren Änderungen abgelöst');
const historyKey = `${repository.HISTORY_PREFIX}${encodeURIComponent(floor.floorId)}`;
check(repository.removeRevisionHistory(floor.floorId) && !localStorage.getItem(historyKey),
  'der lokale Versionsverlauf ist separat und gezielt entfernbar');

console.log('■ Verlauf');
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
'Rückgängig/Wiederholen bleibt geklont, verzweigt korrekt und hält das Limit ein');

console.log(failures ? `\n✗ ${failures} Prüfung(en) FEHLGESCHLAGEN` : '\n✓ alle Modellprüfungen bestanden');
process.exit(failures ? 1 : 0);
