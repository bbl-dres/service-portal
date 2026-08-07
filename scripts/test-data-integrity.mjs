// Referenzprüfung ohne Browser — data/ gegen sich selbst UND gegen die Literale
// im Code.
//
// Anlass (H11): die Kante Dienstleistung → Prozess war doppelt deklariert
// (services.processDefId, process-definitions.serviceId) und wurde von keinem
// Modul gelesen. Jedes Modul nannte seine defId stattdessen als Zeichenkette.
// Damit konnte eine Umbenennung in JSON in sich stimmig bleiben, während die
// Anwendungen weiter die alte Kennung starteten — und engine.start() erfand
// sich früher stillschweigend eine Ersatzdefinition dazu.
//
// Diese Prüfung läuft in Millisekunden und braucht keinen Server:
//   node scripts/test-data-integrity.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

let failures = 0;
const check = (ok, label) => { console.log(`   ${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };

const services = json('data/services.json');
const defs = json('data/process-definitions.json');
const defIds = new Set(defs.map(d => d.defId));
const serviceIds = new Set(services.map(s => s.serviceId));

console.log('■ Dienstleistung → Prozessdefinition');
const declared = services.filter(s => s.processDefId);
const danglingFwd = declared.filter(s => !defIds.has(s.processDefId));
check(danglingFwd.length === 0,
  `${declared.length} von ${services.length} Dienstleistungen deklarieren processDefId, alle auflösbar${
    danglingFwd.length ? ` — offen: ${danglingFwd.map(s => `${s.serviceId}→${s.processDefId}`).join(', ')}` : ''}`);

const danglingBack = defs.filter(d => d.serviceId && !serviceIds.has(d.serviceId));
check(danglingBack.length === 0,
  `${defs.length} Definitionen verweisen auf bestehende Dienstleistungen${
    danglingBack.length ? ` — offen: ${danglingBack.map(d => `${d.defId}→${d.serviceId}`).join(', ')}` : ''}`);

console.log('■ Schritte je Definition');
const noSteps = defs.filter(d => !Array.isArray(d.steps) || !d.steps.length);
check(noSteps.length === 0,
  `jede Definition hat Schritte${noSteps.length ? ` — leer: ${noSteps.map(d => d.defId).join(', ')}` : ''}`);
const noLabel = defs.flatMap(d => (d.steps || []).filter(st => !st.label || !st.status).map(st => d.defId));
check(noLabel.length === 0, `jeder Schritt hat label + status${noLabel.length ? ` — offen: ${noLabel.join(', ')}` : ''}`);
check(defs.every(d => d.name), 'jede Definition hat einen Namen (start() übernimmt ihn als defName)');

console.log('■ Code-Literale gegen die Definitionen');
// engine.start('…') und defId: '…' — beides sind Kennungen, die es geben MUSS.
const appDir = join(ROOT, 'js', 'apps');
const used = new Map();   // defId → Dateien
for (const f of readdirSync(appDir).filter(n => n.endsWith('.js'))) {
  const src = readFileSync(join(appDir, f), 'utf8');
  for (const m of src.matchAll(/engine\.start\(\s*'([^']+)'/g)) used.set(m[1], [...(used.get(m[1]) || []), f]);
  for (const m of src.matchAll(/\bdefId:\s*'([^']+)'/g)) used.set(m[1], [...(used.get(m[1]) || []), f]);
}
const unknown = [...used.keys()].filter(id => !defIds.has(id));
check(used.size > 0, `Literale gefunden (${used.size}: ${[...used.keys()].sort().join(', ')})`);
check(unknown.length === 0,
  `alle im Code genannten defIds existieren${unknown.length ? ` — unbekannt: ${unknown.map(id => `${id} (${used.get(id).join(', ')})`).join('; ')}` : ''}`);

// Umgekehrt: eine Definition, die niemand startet, ist totes Gewicht — kein
// Fehler, aber meldenswert.
const unstarted = [...defIds].filter(id => !used.has(id));
if (unstarted.length) console.log(`   – Hinweis: von keiner Anwendung gestartet: ${unstarted.join(', ')}`);

console.log('■ Route → Prozess, wo die Zuordnung eindeutig ist');
// Nennt eine Dienstleistung «#/app/x» und startet js/apps/x.js genau eine
// Definition, müssen beide dieselbe sein.
for (const s of declared) {
  const href = (s.target && s.target.href) || '';
  const m = href.match(/^#\/app\/([a-z-]+)$/);          // ohne Query = eindeutig
  if (!m) continue;
  const file = `${m[1]}.js`;
  const literals = [...used.entries()].filter(([, files]) => files.includes(file)).map(([id]) => id);
  if (literals.length !== 1) continue;
  check(literals[0] === s.processDefId,
    `${s.serviceId} → ${file}: Daten «${s.processDefId}» = Code «${literals[0]}»`);
}

console.log('■ Datenportal: genau ein Renderer und geschlossene Referenzen');
const portal = json('data/dashboards.json');
const topicIds = portal.topics.map((topic) => topic.id);
const boardIds = portal.dashboards.map((board) => board.id);
const boardTopicIds = portal.dashboards.map((board) => board.topicId);
const genericTopicIds = topicIds.filter((id) => id !== 'immobilien');
check(new Set(topicIds).size === topicIds.length, 'Themen-IDs sind eindeutig');
check(new Set(boardIds).size === boardIds.length, 'Dashboard-IDs sind eindeutig');
check(new Set(boardTopicIds).size === boardTopicIds.length, 'Dashboard-Themenverweise sind eindeutig');
check(JSON.stringify([...boardIds].sort()) === JSON.stringify([...genericTopicIds].sort()),
  'sechs Themen haben genau ein generisches Dashboard; Immobilien bleibt spezialisiert');
check(JSON.stringify([...boardTopicIds].sort()) === JSON.stringify([...genericTopicIds].sort())
  && portal.dashboards.every((board) => board.id === board.topicId),
  'Übersicht und Dashboard-Routen verwenden dieselbe Themenkennung');
check(!portal.dashboards.some((board) => Object.hasOwn(board, 'hero')),
  'generische Dashboards verwenden ausschliesslich die kpis-Datenform');

const usedDatasets = new Set();
const brokenChartRefs = [];
const brokenDatasetRefs = [];
const duplicateChartIds = [];
for (const board of portal.dashboards) {
  const chartIds = board.charts.map((chart) => chart.id);
  if (new Set(chartIds).size !== chartIds.length) duplicateChartIds.push(board.id);
  const knownCharts = new Set(chartIds);
  for (const tab of board.tabs || []) {
    for (const chartId of tab.charts || []) {
      if (!knownCharts.has(chartId)) brokenChartRefs.push(`${board.id}/${tab.id}→${chartId}`);
    }
  }
  for (const chart of board.charts) {
    const datasetId = chart.query?.dataset;
    if (!datasetId || !Object.hasOwn(portal.datasets, datasetId)) {
      brokenDatasetRefs.push(`${board.id}/${chart.id}→${datasetId || 'keiner'}`);
    } else {
      usedDatasets.add(datasetId);
    }
  }
}
check(duplicateChartIds.length === 0,
  `Chart-IDs sind je Dashboard eindeutig${duplicateChartIds.length ? ` — offen: ${duplicateChartIds.join(', ')}` : ''}`);
check(brokenChartRefs.length === 0,
  `alle Register verweisen auf vorhandene Charts${brokenChartRefs.length ? ` — offen: ${brokenChartRefs.join(', ')}` : ''}`);
check(brokenDatasetRefs.length === 0,
  `alle generischen Charts verweisen auf vorhandene Datensätze${brokenDatasetRefs.length ? ` — offen: ${brokenDatasetRefs.join(', ')}` : ''}`);

// Diese beiden Zeitreihen liest der spezialisierte Immobilien-Renderer direkt;
// alle übrigen Datensätze müssen über einen generischen Chart erreichbar sein.
const specializedDatasets = new Set(['portfolio_jahr', 'portfolio_monat']);
const orphanDatasets = Object.keys(portal.datasets)
  .filter((id) => !usedDatasets.has(id) && !specializedDatasets.has(id));
check(orphanDatasets.length === 0,
  `jeder Datensatz hat einen Renderer${orphanDatasets.length ? ` — verwaist: ${orphanDatasets.join(', ')}` : ''}`);
check([...specializedDatasets].every((id) => Object.hasOwn(portal.datasets, id)),
  'die spezialisierten Immobilien-Zeitreihen bleiben vorhanden');

console.log('■ Workspace-Overlay bleibt frei von Golden-Record-Duplikaten');
const buildingCollection = json('data/buildings.geojson');
const buildingsById = new Map((buildingCollection.features || [])
  .map((feature) => [feature.properties?.bbl_id, feature.properties]));
const floors = json('data/floors.json');
const floorById = new Map(floors.map((floor) => [floor.floorId, floor]));
const spaces = json('data/spaces.json');
const workspacePlanning = json('data/workspace-planning.json');
const planningIds = workspacePlanning.map((planning) => planning.buildingId);

check(new Set(planningIds).size === planningIds.length,
  'jedes Workspace-Objekt hat höchstens einen Planungs-Overlay');
const missingPlanningBuildings = planningIds.filter((id) => !buildingsById.has(id));
check(missingPlanningBuildings.length === 0,
  `alle Workspace-Overlays verweisen auf ein kanonisches Gebäude${missingPlanningBuildings.length
    ? ` — offen: ${missingPlanningBuildings.join(', ')}` : ''}`);

const derivedWorkspaceKeys = ['catalogue', 'totalFloors', 'plannedHnf', 'workArea', 'equipmentCount', 'planState'];
const duplicatedWorkspaceValues = workspacePlanning.flatMap((planning) => derivedWorkspaceKeys
  .filter((key) => Object.hasOwn(planning, key)).map((key) => `${planning.buildingId}.${key}`));
check(duplicatedWorkspaceValues.length === 0,
  `Overlay speichert keine aus Gebäude-, Geschoss-, Raum- oder Ausstattungsdaten ableitbaren Summen${
    duplicatedWorkspaceValues.length ? ` — offen: ${duplicatedWorkspaceValues.join(', ')}` : ''}`);

const availabilityValues = new Set(['legacy', 'planned']);
const orderValues = new Set(['open', 'completed']);
const invalidAvailability = workspacePlanning.filter((planning) => !availabilityValues.has(planning.planAvailability));
check(invalidAvailability.length === 0,
  `Planverfügbarkeit verwendet ausschliesslich legacy/planned${invalidAvailability.length
    ? ` — offen: ${invalidAvailability.map((planning) => planning.buildingId).join(', ')}` : ''}`);
const invalidOrders = workspacePlanning.filter((planning) => planning.orderStatus
  && (!orderValues.has(planning.orderStatus) || planning.planAvailability !== 'planned'));
check(invalidOrders.length === 0,
  `Auftragsstatus verwendet ausschliesslich open/completed und gehört zu einer Planung${invalidOrders.length
    ? ` — offen: ${invalidOrders.map((planning) => planning.buildingId).join(', ')}` : ''}`);
const invalidTargets = workspacePlanning.filter((planning) => planning.targetDate
  && (!/^\d{4}-\d{2}-\d{2}$/.test(planning.targetDate) || !planning.orderStatus));
check(invalidTargets.length === 0,
  `jeder Stichtag ist ein ISO-Datum eines Auftrags${invalidTargets.length
    ? ` — offen: ${invalidTargets.map((planning) => planning.buildingId).join(', ')}` : ''}`);

const workspaceFloorRefs = workspacePlanning.flatMap((planning) => (planning.floors || [])
  .map((entry) => ({ ...entry, buildingId: planning.buildingId })));
const duplicateFloorRefs = workspaceFloorRefs
  .filter((entry, index, all) => all.findIndex((candidate) => candidate.floorId === entry.floorId) !== index)
  .map((entry) => entry.floorId);
check(duplicateFloorRefs.length === 0,
  `jeder geplante Grundriss kommt höchstens einmal vor${duplicateFloorRefs.length
    ? ` — doppelt: ${duplicateFloorRefs.join(', ')}` : ''}`);
const brokenFloorRefs = workspaceFloorRefs.filter((entry) => {
  const floor = floorById.get(entry.floorId);
  return !floor || floor.buildingId !== entry.buildingId;
});
check(brokenFloorRefs.length === 0,
  `alle geplanten Grundrisse gehören zum angegebenen Gebäude${brokenFloorRefs.length
    ? ` — offen: ${brokenFloorRefs.map((entry) => entry.floorId).join(', ')}` : ''}`);

const roomCountMismatches = floors.filter((floor) =>
  spaces.filter((space) => space.floorId === floor.floorId).length !== floor.rooms);
check(roomCountMismatches.length === 0,
  `Geschoss-Raumzahlen sind aus dem Raumregister ableitbar${roomCountMismatches.length
    ? ` — offen: ${roomCountMismatches.map((floor) => floor.floorId).join(', ')}` : ''}`);
const brokenSpaceRefs = spaces.filter((space) => {
  const floor = floorById.get(space.floorId);
  return !floor || floor.buildingId !== space.buildingId;
});
check(brokenSpaceRefs.length === 0,
  `alle Räume gehören zu ihrem kanonischen Geschoss und Gebäude${brokenSpaceRefs.length
    ? ` — offen: ${brokenSpaceRefs.map((space) => space.spaceId).join(', ')}` : ''}`);

const nonDerivablePlans = workspacePlanning.filter((planning) => planning.planAvailability === 'planned').filter((planning) => {
  const plannedFloorIds = new Set((planning.floors || []).map((entry) => entry.floorId));
  const plannedFloors = [...plannedFloorIds].map((id) => floorById.get(id)).filter(Boolean);
  const plannedSpaces = spaces.filter((space) => plannedFloorIds.has(space.floorId));
  const plannedHnf = plannedFloors.reduce((sum, floor) => sum + (Number(floor.areaHnf) || 0), 0);
  const workArea = plannedSpaces.filter((space) => space.group === 'arbeit')
    .reduce((sum, space) => sum + (Number(space.area) || 0), 0);
  return !plannedFloors.length || plannedHnf <= 0 || workArea <= 0;
});
check(nonDerivablePlans.length === 0,
  `geplante HNF und Arbeitsfläche sind aus Geschossen und Räumen ableitbar${nonDerivablePlans.length
    ? ` — offen: ${nonDerivablePlans.map((planning) => planning.buildingId).join(', ')}` : ''}`);

const equipmentMismatches = workspacePlanning.filter((planning) => {
  const floorTotal = (planning.floors || []).reduce((sum, floor) => sum + (Number(floor.equipmentCount) || 0), 0);
  const groupTotal = (planning.equipmentGroups || []).reduce((sum, group) => sum + (Number(group.count) || 0), 0);
  return floorTotal !== groupTotal;
});
check(equipmentMismatches.length === 0,
  `Ausstattungstotal ist aus Geschossen oder Modulgruppen identisch ableitbar${equipmentMismatches.length
    ? ` — offen: ${equipmentMismatches.map((planning) => planning.buildingId).join(', ')}` : ''}`);

const missingBuildingMeasures = workspacePlanning.filter((planning) => {
  const building = buildingsById.get(planning.buildingId);
  return building && (!Number.isFinite(building.garea_ngf) || !Number.isFinite(building.gastw));
});
check(missingBuildingMeasures.length === 0,
  `NGF und Gesamtgeschosszahl stehen für jedes Workspace-Gebäude im Golden Record${missingBuildingMeasures.length
    ? ` — offen: ${missingBuildingMeasures.map((planning) => planning.buildingId).join(', ')}` : ''}`);
const coreSource = readFileSync(join(ROOT, 'js/core.js'), 'utf8');
check(/\bngf:\s*p\.garea_ngf\s*\|\|\s*0/.test(coreSource)
  && /\btotalFloors:\s*p\.gastw\s*\|\|\s*0/.test(coreSource),
  'Core-Normalisierung stellt NGF und Gesamtgeschosszahl unter stabilen Feldnamen bereit');

console.log(failures ? `\n✗ ${failures} Prüfung(en) FEHLGESCHLAGEN` : '\n✓ alle Prüfungen bestanden');
process.exit(failures ? 1 : 0);
