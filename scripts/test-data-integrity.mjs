// Browser-free reference check across data/ and code literals.
//
// A duplicated service-to-process relationship can drift when no module checks
// services.processDefId, portal workflow serviceId, and app literals together.
// drift independently. engine.start() also used to invent a fallback definition,
// hiding that mismatch.
//
// This check completes in milliseconds and needs no server:
//   node scripts/test-data-integrity.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

function jpegDimensions(path) {
  const data = readFileSync(path);
  if (data.length < 4 || data.readUInt16BE(0) !== 0xffd8) return null;
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 3 < data.length) {
    if (data[offset] !== 0xff) { offset++; continue; }
    while (offset < data.length && data[offset] === 0xff) offset++;
    const marker = data[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= data.length) break;
    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length) break;
    if (frameMarkers.has(marker) && length >= 7) {
      return { height: data.readUInt16BE(offset + 3), width: data.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  return null;
}

function jpegEmbeddedMetadata(path) {
  const data = readFileSync(path);
  if (data.length < 4 || data.readUInt16BE(0) !== 0xffd8) return ['invalid JPEG'];
  const findings = [];
  let offset = 2;
  while (offset + 1 < data.length) {
    if (data[offset] !== 0xff) {
      findings.push('malformed marker stream');
      break;
    }
    while (offset < data.length && data[offset] === 0xff) offset++;
    const marker = data[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= data.length) {
      findings.push('truncated marker');
      break;
    }
    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length) {
      findings.push('invalid marker length');
      break;
    }
    const payload = data.subarray(offset + 2, offset + length);
    if (marker === 0xfe) findings.push('COM');
    if (marker >= 0xe1 && marker <= 0xef) findings.push(`APP${marker - 0xe0}`);
    if (marker === 0xe0) {
      const isJfif = payload.length >= 14 && payload.subarray(0, 5).equals(Buffer.from('JFIF\0'));
      if (!isJfif) findings.push('non-JFIF APP0');
      else if (payload[12] !== 0 || payload[13] !== 0) findings.push('JFIF thumbnail');
    }
    offset += length;
  }
  return findings;
}

let failures = 0;
const check = (ok, label) => { console.log(`   ${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };

const services = json('data/services.json');
const processes = json('data/processes.json');
const defs = processes.filter((record) => record.branch === 'portal')
  .map((record) => ({ ...record, defId: record.processId }));
const defIds = new Set(defs.map(d => d.defId));
const serviceIds = new Set(services.map(s => s.serviceId));

console.log('Service to process definition');
const declared = services.filter(s => s.processDefId);
const danglingFwd = declared.filter(s => !defIds.has(s.processDefId));
check(danglingFwd.length === 0,
  `${declared.length} of ${services.length} services declare a resolvable processDefId${
    danglingFwd.length ? `; unresolved: ${danglingFwd.map(s => `${s.serviceId}->${s.processDefId}`).join(', ')}` : ''}`);

const danglingBack = defs.filter(d => d.serviceId && !serviceIds.has(d.serviceId));
check(danglingBack.length === 0,
  `${defs.length} definitions reference existing services${
    danglingBack.length ? `; unresolved: ${danglingBack.map(d => `${d.defId}->${d.serviceId}`).join(', ')}` : ''}`);

console.log('Steps per definition');
check(processes.every((record) => ['fachlich', 'portal'].includes(record.branch)),
  'every process belongs to the business or portal branch');
const noSteps = defs.filter(d => !Array.isArray(d.steps) || !d.steps.length);
check(noSteps.length === 0,
  `every definition has steps${noSteps.length ? `; empty: ${noSteps.map(d => d.defId).join(', ')}` : ''}`);
const noLabel = defs.flatMap(d => (d.steps || []).filter(st => !st.label || !st.status).map(st => d.defId));
check(noLabel.length === 0, `every step has label and status${noLabel.length ? `; unresolved: ${noLabel.join(', ')}` : ''}`);
check(defs.every(d => d.name), 'every definition has a name for start() to use as defName');

console.log('Code literals against definitions');
// Values passed to engine.start() and defId literals must exist.
const appDir = join(ROOT, 'js', 'apps');
const used = new Map();   // defId → files
for (const f of readdirSync(appDir).filter(n => n.endsWith('.js'))) {
  const src = readFileSync(join(appDir, f), 'utf8');
  for (const m of src.matchAll(/engine\.start\(\s*'([^']+)'/g)) used.set(m[1], [...(used.get(m[1]) || []), f]);
  for (const m of src.matchAll(/\bdefId:\s*'([^']+)'/g)) used.set(m[1], [...(used.get(m[1]) || []), f]);
}
const unknown = [...used.keys()].filter(id => !defIds.has(id));
check(used.size > 0, `definition literals found (${used.size}: ${[...used.keys()].sort().join(', ')})`);
check(unknown.length === 0,
  `every defId named in code exists${unknown.length ? `; unknown: ${unknown.map(id => `${id} (${used.get(id).join(', ')})`).join('; ')}` : ''}`);

// Conversely, an unstarted definition is noteworthy dead weight, not a failure.
const unstarted = [...defIds].filter(id => !used.has(id));
if (unstarted.length) console.log(`   note: no application starts ${unstarted.join(', ')}`);

console.log('Route to process where the relationship is unambiguous');
// A service targeting #/app/x and an app module starting exactly one definition
// must reference the same definition.
for (const s of declared) {
  const href = (s.target && s.target.href) || '';
  const m = href.match(/^#\/app\/([a-z-]+)$/); // A route without a query is unambiguous.
  if (!m) continue;
  const file = `${m[1]}.js`;
  const literals = [...used.entries()].filter(([, files]) => files.includes(file)).map(([id]) => id);
  if (literals.length !== 1) continue;
  check(literals[0] === s.processDefId,
    `${s.serviceId} -> ${file}: data ${s.processDefId} equals code ${literals[0]}`);
}

console.log('Data portal: one renderer and closed references');
const portal = json('data/dashboards.json');
const topicIds = portal.topics.map((topic) => topic.id);
const boardIds = portal.dashboards.map((board) => board.id);
const boardTopicIds = portal.dashboards.map((board) => board.topicId);
const genericTopicIds = topicIds.filter((id) => id !== 'immobilien');
check(new Set(topicIds).size === topicIds.length, 'topic IDs are unique');
check(new Set(boardIds).size === boardIds.length, 'dashboard IDs are unique');
check(new Set(boardTopicIds).size === boardTopicIds.length, 'dashboard topic references are unique');
check(JSON.stringify([...boardIds].sort()) === JSON.stringify([...genericTopicIds].sort()),
  'six topics have one generic dashboard; real estate remains specialised');
check(JSON.stringify([...boardTopicIds].sort()) === JSON.stringify([...genericTopicIds].sort())
  && portal.dashboards.every((board) => board.id === board.topicId),
  'overview and dashboard routes use the same topic identifier');
check(!portal.dashboards.some((board) => Object.hasOwn(board, 'hero')),
  'generic dashboards use only the kpis data shape');

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
  `chart IDs are unique within each dashboard${duplicateChartIds.length ? `; unresolved: ${duplicateChartIds.join(', ')}` : ''}`);
check(brokenChartRefs.length === 0,
  `every tab references existing charts${brokenChartRefs.length ? `; unresolved: ${brokenChartRefs.join(', ')}` : ''}`);
check(brokenDatasetRefs.length === 0,
  `every generic chart references an existing dataset${brokenDatasetRefs.length ? `; unresolved: ${brokenDatasetRefs.join(', ')}` : ''}`);

// The specialised real-estate renderer reads these series directly; every
// other dataset must be reachable through a generic chart.
const specializedDatasets = new Set(['portfolio_jahr', 'portfolio_monat']);
const orphanDatasets = Object.keys(portal.datasets)
  .filter((id) => !usedDatasets.has(id) && !specializedDatasets.has(id));
check(orphanDatasets.length === 0,
  `every dataset has a renderer${orphanDatasets.length ? `; orphaned: ${orphanDatasets.join(', ')}` : ''}`);
check([...specializedDatasets].every((id) => Object.hasOwn(portal.datasets, id)),
  'the specialised real-estate series remain available');

console.log('Workspace overlay remains free of golden-record duplication');
const buildingCollection = json('data/buildings.geojson');
const buildingsById = new Map((buildingCollection.features || [])
  .map((feature) => [feature.properties?.bbl_id, feature.properties]));
const projectsById = new Map(json('data/projects.json').map((project) => [project.projectId, project]));
const processInstances = json('data/process-instances.json');
const brokenCaseBuildings = processInstances.filter((instance) => instance.linkedEntities?.buildingId
  && !buildingsById.has(instance.linkedEntities.buildingId));
const brokenCaseProjects = processInstances.filter((instance) => instance.linkedEntities?.projectId
  && !projectsById.has(instance.linkedEntities.projectId));
const mismatchedCaseLinks = processInstances.filter((instance) => {
  const linked = instance.linkedEntities || {};
  const project = linked.projectId ? projectsById.get(linked.projectId) : null;
  return project && linked.buildingId && project.buildingId !== linked.buildingId;
});
check(brokenCaseBuildings.length === 0,
  `seeded cases reference canonical buildings${brokenCaseBuildings.length
    ? `; unresolved: ${brokenCaseBuildings.map((instance) => instance.instanceId).join(', ')}` : ''}`);
check(brokenCaseProjects.length === 0,
  `seeded cases reference canonical projects${brokenCaseProjects.length
    ? `; unresolved: ${brokenCaseProjects.map((instance) => instance.instanceId).join(', ')}` : ''}`);
check(mismatchedCaseLinks.length === 0,
  `case building and project links agree${mismatchedCaseLinks.length
    ? `; mismatched: ${mismatchedCaseLinks.map((instance) => instance.instanceId).join(', ')}` : ''}`);
const floors = json('data/floors.json');
const floorById = new Map(floors.map((floor) => [floor.floorId, floor]));
const spaces = json('data/spaces.json');
const workspacePlanning = json('data/workspace-planning.json');
const planningIds = workspacePlanning.map((planning) => planning.buildingId);

check(new Set(planningIds).size === planningIds.length,
  'each workspace object has at most one planning overlay');
const missingPlanningBuildings = planningIds.filter((id) => !buildingsById.has(id));
check(missingPlanningBuildings.length === 0,
  `all workspace overlays reference a canonical building${missingPlanningBuildings.length
    ? `; unresolved: ${missingPlanningBuildings.join(', ')}` : ''}`);

const derivedWorkspaceKeys = ['catalogue', 'totalFloors', 'plannedHnf', 'workArea', 'equipmentCount', 'planState'];
const duplicatedWorkspaceValues = workspacePlanning.flatMap((planning) => derivedWorkspaceKeys
  .filter((key) => Object.hasOwn(planning, key)).map((key) => `${planning.buildingId}.${key}`));
check(duplicatedWorkspaceValues.length === 0,
  `the overlay stores no totals derivable from building, floor, space, or equipment data${
    duplicatedWorkspaceValues.length ? `; unresolved: ${duplicatedWorkspaceValues.join(', ')}` : ''}`);

const availabilityValues = new Set(['legacy', 'planned']);
const orderValues = new Set(['open', 'completed']);
const invalidAvailability = workspacePlanning.filter((planning) => !availabilityValues.has(planning.planAvailability));
check(invalidAvailability.length === 0,
  `plan availability uses only legacy/planned${invalidAvailability.length
    ? `; unresolved: ${invalidAvailability.map((planning) => planning.buildingId).join(', ')}` : ''}`);
const invalidOrders = workspacePlanning.filter((planning) => planning.orderStatus
  && (!orderValues.has(planning.orderStatus) || planning.planAvailability !== 'planned'));
check(invalidOrders.length === 0,
  `order status uses only open/completed and belongs to a planned record${invalidOrders.length
    ? `; unresolved: ${invalidOrders.map((planning) => planning.buildingId).join(', ')}` : ''}`);
const invalidTargets = workspacePlanning.filter((planning) => planning.targetDate
  && (!/^\d{4}-\d{2}-\d{2}$/.test(planning.targetDate) || !planning.orderStatus));
check(invalidTargets.length === 0,
  `every target date is an ISO date attached to an order${invalidTargets.length
    ? `; unresolved: ${invalidTargets.map((planning) => planning.buildingId).join(', ')}` : ''}`);

const workspaceFloorRefs = workspacePlanning.flatMap((planning) => (planning.floors || [])
  .map((entry) => ({ ...entry, buildingId: planning.buildingId })));
const duplicateFloorRefs = workspaceFloorRefs
  .filter((entry, index, all) => all.findIndex((candidate) => candidate.floorId === entry.floorId) !== index)
  .map((entry) => entry.floorId);
check(duplicateFloorRefs.length === 0,
  `each planned floor plan appears at most once${duplicateFloorRefs.length
    ? `; duplicates: ${duplicateFloorRefs.join(', ')}` : ''}`);
const brokenFloorRefs = workspaceFloorRefs.filter((entry) => {
  const floor = floorById.get(entry.floorId);
  return !floor || floor.buildingId !== entry.buildingId;
});
check(brokenFloorRefs.length === 0,
  `all planned floor plans belong to the stated building${brokenFloorRefs.length
    ? `; unresolved: ${brokenFloorRefs.map((entry) => entry.floorId).join(', ')}` : ''}`);

const roomCountMismatches = floors.filter((floor) =>
  spaces.filter((space) => space.floorId === floor.floorId).length !== floor.rooms);
check(roomCountMismatches.length === 0,
  `floor room counts are derivable from the space registry${roomCountMismatches.length
    ? `; unresolved: ${roomCountMismatches.map((floor) => floor.floorId).join(', ')}` : ''}`);
const brokenSpaceRefs = spaces.filter((space) => {
  const floor = floorById.get(space.floorId);
  return !floor || floor.buildingId !== space.buildingId;
});
check(brokenSpaceRefs.length === 0,
  `all spaces belong to their canonical floor and building${brokenSpaceRefs.length
    ? `; unresolved: ${brokenSpaceRefs.map((space) => space.spaceId).join(', ')}` : ''}`);

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
  `planned primary usable area and work area are derivable from floors and spaces${nonDerivablePlans.length
    ? `; unresolved: ${nonDerivablePlans.map((planning) => planning.buildingId).join(', ')}` : ''}`);

const equipmentMismatches = workspacePlanning.filter((planning) => {
  const floorTotal = (planning.floors || []).reduce((sum, floor) => sum + (Number(floor.equipmentCount) || 0), 0);
  const groupTotal = (planning.equipmentGroups || []).reduce((sum, group) => sum + (Number(group.count) || 0), 0);
  return floorTotal !== groupTotal;
});
check(equipmentMismatches.length === 0,
  `equipment totals are identical when derived from floors or module groups${equipmentMismatches.length
    ? `; unresolved: ${equipmentMismatches.map((planning) => planning.buildingId).join(', ')}` : ''}`);

const missingBuildingMeasures = workspacePlanning.filter((planning) => {
  const building = buildingsById.get(planning.buildingId);
  return building && (!Number.isFinite(building.garea_ngf) || !Number.isFinite(building.gastw));
});
check(missingBuildingMeasures.length === 0,
  `net floor area and total floor count exist in the golden record for every workspace building${missingBuildingMeasures.length
    ? `; unresolved: ${missingBuildingMeasures.map((planning) => planning.buildingId).join(', ')}` : ''}`);
const coreSource = readFileSync(join(ROOT, 'js/core/index.js'), 'utf8');
check(/\bngf:\s*raw\[['"]garea_ngf['"]\]\s*\|\|\s*0/.test(coreSource)
  && /\btotalFloors:\s*raw\[['"]gastw['"]\]\s*\|\|\s*0/.test(coreSource),
  'core normalisation exposes net floor area and total floor count under stable field names');

console.log('Workspace module imagery and planning-example references');
const moduleFixture = json('data/multispace-modules.json');
const modules = moduleFixture.modules || [];
const moduleNumbers = new Set(modules.map((module) => Number(module.nr)));
const moduleByNumber = new Map(modules.map((module) => [Number(module.nr), module]));
const moduleImagePrefix = 'assets/images/multispace-modules/';
const moduleImageDirectory = join(ROOT, moduleImagePrefix);
const moduleImageFiles = new Set(readdirSync(moduleImageDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(?:avif|jpe?g|png|webp)$/i.test(entry.name))
  .map((entry) => entry.name));
const moduleImages = modules.flatMap((module) => (module.images || [])
  .map((image, index) => ({ ...image, index, module })));

check(modules.every((module) => Array.isArray(module.images) && !Object.hasOwn(module, 'image')),
  'every module uses the ordered images array and no legacy scalar image');
check(modules.every((module) => module.images.length === 1
  && module.images[0].src === `${moduleImagePrefix}${module.slug}-01.jpg`),
  'every current module has its stable slug hero at images[0]');
check(new Set(moduleImages.map((image) => image.src.toLowerCase())).size === moduleImages.length,
  'module image paths are unique across case-insensitive deployments');

const missingModuleImages = moduleImages.filter((image) => !existsSync(join(ROOT, image.src)));
const wrongCaseModuleImages = moduleImages.filter((image) =>
  !moduleImageFiles.has(image.src.slice(moduleImagePrefix.length)));
check(missingModuleImages.length === 0,
  `every module image file exists${missingModuleImages.length
    ? `; missing: ${missingModuleImages.map((image) => image.src).join(', ')}` : ''}`);
check(wrongCaseModuleImages.length === 0,
  `module image paths use the exact on-disk filename case${wrongCaseModuleImages.length
    ? `; mismatched: ${wrongCaseModuleImages.map((image) => image.src).join(', ')}` : ''}`);

const referencedModuleFiles = new Set(moduleImages.map((image) => image.src.slice(moduleImagePrefix.length)));
const orphanModuleImages = [...moduleImageFiles].filter((file) => !referencedModuleFiles.has(file));
check(orphanModuleImages.length === 0,
  `the module image directory has no unreferenced assets${orphanModuleImages.length
    ? `; orphaned: ${orphanModuleImages.join(', ')}` : ''}`);

const invalidDimensions = moduleImages.filter((image) => {
  if (!existsSync(join(ROOT, image.src))) return false;
  const dimensions = jpegDimensions(join(ROOT, image.src));
  return !dimensions || dimensions.width !== 1440 || dimensions.height !== 810;
});
check(invalidDimensions.length === 0,
  `every module hero is a 1440 × 810 JPEG${invalidDimensions.length
    ? `; invalid: ${invalidDimensions.map((image) => image.src).join(', ')}` : ''}`);

const oversizedModuleImages = moduleImages.filter((image) => existsSync(join(ROOT, image.src))
  && statSync(join(ROOT, image.src)).size > 220 * 1024);
const moduleImageBytes = moduleImages.reduce((total, image) => total
  + (existsSync(join(ROOT, image.src)) ? statSync(join(ROOT, image.src)).size : 0), 0);
check(oversizedModuleImages.length === 0 && moduleImageBytes <= 2 * 1024 * 1024,
  `module imagery stays within the 220 KiB each / 2 MiB total budget${oversizedModuleImages.length
    ? `; oversized: ${oversizedModuleImages.map((image) => image.src).join(', ')}`
    : `; total: ${Math.round(moduleImageBytes / 1024)} KiB`}`);

const incompleteProvenance = moduleImages.filter((image) =>
  !image.alt || !/illustrativ/i.test(image.caption || '') || !/nicht verbindlich/i.test(image.caption || '')
  || !/OpenAI/i.test(image.credit || '') || !/2026/.test(image.credit || '')
  || !image.license || !/OpenAI/i.test(image.provenance || '') || !/keine Fotografie/i.test(image.provenance || ''));
check(incompleteProvenance.length === 0,
  `every module image states useful text, non-binding status, credit, licence, and provenance${
    incompleteProvenance.length ? `; incomplete: ${incompleteProvenance.map((image) => image.src).join(', ')}` : ''}`);

const planningModuleProblems = workspacePlanning.flatMap((planning) => (planning.equipmentGroups || [])
  .filter((group) => !moduleByNumber.has(Number(group.number))
    || moduleByNumber.get(Number(group.number)).name !== group.name)
  .map((group) => `${planning.buildingId}:M${group.number}`));
check(planningModuleProblems.length === 0,
  `workspace planning groups reference the current module name and number${planningModuleProblems.length
    ? `; unresolved: ${planningModuleProblems.join(', ')}` : ''}`);

const workspaceExampleFixture = json('data/workspace-examples.json');
const workspaceExamples = workspaceExampleFixture.examples || [];
const media = json('data/media.json');
const mediaById = new Map(media.map((item) => [item.mediaId, item]));
const workspaceExampleImagePrefix = 'assets/images/workspace-examples/';
const workspaceExampleImageDirectory = join(ROOT, workspaceExampleImagePrefix);
const workspaceExampleImageFields = new Set([
  'imageId', 'kind', 'src', 'title', 'alt', 'caption', 'credit', 'license', 'provenance',
]);
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string'
  && value.trim() === value && value.length > 0;

check(/Planungsszenarien/.test(workspaceExampleFixture.note || '')
  && /Szenariodaten/.test(workspaceExampleFixture.note || '')
  && /keine Fotografien/.test(workspaceExampleFixture.note || '')
  && /keine verifizierten Rekonstruktionen/.test(workspaceExampleFixture.note || '')
  && /keine freigegebenen Planungen/.test(workspaceExampleFixture.note || ''),
  'workspace-example fixture identifies its facts and images as non-binding scenario material');
check(/contextMediaId.*Titelbild.*ersten Galerieeintrag/.test(workspaceExampleFixture.assets || '')
  && /images enthält danach drei/.test(workspaceExampleFixture.assets || '')
  && /referenceMediaIds.*Kompatibilitätsreferenzen/.test(workspaceExampleFixture.assets || ''),
  'workspace-example fixture documents context first, then generated interiors, then legacy aliases');

const invalidExampleCollections = workspaceExamples.filter((example) => !isRecord(example)
  || Object.hasOwn(example, 'mediaIds') || Object.hasOwn(example, 'coverMediaId')
  || !Array.isArray(example.images) || example.images.length !== 3
  || !Array.isArray(example.referenceMediaIds) || !example.referenceMediaIds.length
  || example.referenceMediaIds.some((mediaId) => !/^MED-\d{3}$/.test(mediaId))
  || new Set(example.referenceMediaIds.map((mediaId) => mediaId.toLowerCase())).size
    !== example.referenceMediaIds.length
  || !/^MED-\d{3}$/.test(example.contextMediaId)
  || !example.referenceMediaIds.includes(example.contextMediaId));
check(invalidExampleCollections.length === 0,
  `every workspace example has one canonical context, three generated images, and duplicate-free legacy references${
    invalidExampleCollections.length
      ? `; invalid: ${invalidExampleCollections.map((example) => example?.exampleId || '(invalid record)').join(', ')}`
      : ''}`);

// These are the four building references that backed each gallery before the
// generated concepts were added. Pinning them protects old MED-* shared links.
const expectedReferenceMediaIds = new Map([
  ['WSE-001', ['MED-001', 'MED-003', 'MED-004', 'MED-005']],
  ['WSE-002', ['MED-008', 'MED-009', 'MED-010', 'MED-011']],
  ['WSE-003', ['MED-077', 'MED-078', 'MED-079', 'MED-080']],
  ['WSE-004', ['MED-058', 'MED-059', 'MED-060', 'MED-061']],
]);
const expectedContextMediaIds = new Map([
  ['WSE-001', 'MED-001'],
  ['WSE-002', 'MED-008'],
  ['WSE-003', 'MED-077'],
  ['WSE-004', 'MED-058'],
]);
const changedReferenceMediaIds = [...expectedReferenceMediaIds].filter(([exampleId, expected]) => {
  const actual = workspaceExamples.find((example) => example?.exampleId === exampleId)?.referenceMediaIds;
  return !Array.isArray(actual) || actual.join('|') !== expected.join('|');
});
check(changedReferenceMediaIds.length === 0,
  `workspace examples retain every former media reference in its original order${
    changedReferenceMediaIds.length
      ? `; changed: ${changedReferenceMediaIds.map(([exampleId]) => exampleId).join(', ')}` : ''}`);

const changedContextMediaIds = [...expectedContextMediaIds].filter(([exampleId, expected]) =>
  workspaceExamples.find((example) => example?.exampleId === exampleId)?.contextMediaId !== expected);
check(changedContextMediaIds.length === 0,
  `each workspace example retains its former cover as the sole active context photo${
    changedContextMediaIds.length
      ? `; changed: ${changedContextMediaIds.map(([exampleId]) => exampleId).join(', ')}` : ''}`);

const brokenExampleMedia = workspaceExamples.flatMap((example) => {
  const referenceMediaIds = Array.isArray(example?.referenceMediaIds) ? example.referenceMediaIds : [];
  return referenceMediaIds.filter((mediaId) => {
    const item = mediaById.get(mediaId);
    return !item || item.buildingId !== example.buildingId
      || typeof item.file !== 'string' || !item.file.startsWith('assets/images/')
      || !existsSync(join(ROOT, item.file));
  }).map((mediaId) => `${example.exampleId}:${mediaId}`);
});
check(brokenExampleMedia.length === 0,
  `workspace-example references resolve to existing media for the same building${brokenExampleMedia.length
    ? `; unresolved: ${brokenExampleMedia.join(', ')}` : ''}`);

const invalidContextMedia = workspaceExamples.filter((example) => {
  const item = mediaById.get(example?.contextMediaId);
  return !item || item.mediaType !== 'photo' || item.buildingId !== example.buildingId
    || typeof item.file !== 'string' || !item.file.startsWith('assets/images/')
    || !existsSync(join(ROOT, item.file))
    || !isNonEmptyString(item.photographer) || !isNonEmptyString(item.copyright)
    || !isNonEmptyString(item.license) || !/^https?:\/\//.test(item.sourceUrl || '');
});
check(invalidContextMedia.length === 0,
  `every context photo resolves for the same building with creator, rights, licence, and source metadata${
    invalidContextMedia.length
      ? `; invalid: ${invalidContextMedia.map((example) => example?.exampleId || '(invalid record)').join(', ')}`
      : ''}`);

const workspaceExampleImages = workspaceExamples.flatMap((example) =>
  (Array.isArray(example?.images) ? example.images : [])
    .map((image, index) => ({ example, image, index })));
const invalidExampleImageRecords = workspaceExampleImages.filter(({ image }) => {
  if (!isRecord(image)) return true;
  const fields = Object.keys(image);
  return fields.length !== workspaceExampleImageFields.size
    || fields.some((field) => !workspaceExampleImageFields.has(field))
    || [...workspaceExampleImageFields].some((field) => !isNonEmptyString(image[field]))
    || image.kind !== 'generated-visualisation';
});
check(invalidExampleImageRecords.length === 0,
  `every workspace-example image matches the exact generated-visualisation record contract${
    invalidExampleImageRecords.length
      ? `; invalid: ${invalidExampleImageRecords.map(({ example, index }) => `${example.exampleId}:${index + 1}`).join(', ')}`
      : ''}`);

const misorderedExampleImages = workspaceExampleImages.filter(({ example, image, index }) => {
  const sequence = String(index + 1).padStart(2, '0');
  return image?.imageId !== `${example.exampleId}-${sequence}`
    || image?.src !== `${workspaceExampleImagePrefix}${example.slug}-${sequence}.jpg`;
});
check(misorderedExampleImages.length === 0,
  `generated images follow their example ID and slug order, with -01 as the first interior view${
    misorderedExampleImages.length
      ? `; invalid: ${misorderedExampleImages.map(({ example, index }) => `${example.exampleId}:${index + 1}`).join(', ')}`
      : ''}`);

const workspaceExampleImageIds = workspaceExampleImages
  .map(({ image }) => String(image?.imageId || '').toLowerCase());
const workspaceExampleImageSources = workspaceExampleImages
  .map(({ image }) => String(image?.src || '').toLowerCase());
check(new Set(workspaceExampleImageIds).size === workspaceExampleImageIds.length,
  'workspace-example image IDs are globally unique regardless of case');
check(new Set(workspaceExampleImageSources).size === workspaceExampleImageSources.length,
  'workspace-example image paths are globally unique regardless of case');

const workspaceExampleDirectoryEntries = readdirSync(workspaceExampleImageDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile());
const workspaceExampleImageFiles = new Set(workspaceExampleDirectoryEntries
  .filter((entry) => /\.jpg$/i.test(entry.name))
  .map((entry) => entry.name));
const unexpectedWorkspaceExampleFiles = workspaceExampleDirectoryEntries
  .filter((entry) => entry.name !== 'README.md' && !/^[a-z0-9-]+-\d{2}\.jpg$/.test(entry.name))
  .map((entry) => entry.name);
check(unexpectedWorkspaceExampleFiles.length === 0,
  `the workspace-example image directory contains only conventionally named JPG assets${
    unexpectedWorkspaceExampleFiles.length
      ? `; invalid: ${unexpectedWorkspaceExampleFiles.join(', ')}` : ''}`);

const safeWorkspaceExampleImages = workspaceExampleImages.filter(({ image }) =>
  typeof image?.src === 'string'
  && /^assets\/images\/workspace-examples\/[a-z0-9-]+-\d{2}\.jpg$/.test(image.src));
const missingWorkspaceExampleImages = safeWorkspaceExampleImages
  .filter(({ image }) => !existsSync(join(ROOT, image.src)));
const wrongCaseWorkspaceExampleImages = safeWorkspaceExampleImages
  .filter(({ image }) => !workspaceExampleImageFiles.has(image.src.slice(workspaceExampleImagePrefix.length)));
check(missingWorkspaceExampleImages.length === 0,
  `every workspace-example image asset exists${missingWorkspaceExampleImages.length
    ? `; missing: ${missingWorkspaceExampleImages.map(({ image }) => image.src).join(', ')}` : ''}`);
check(wrongCaseWorkspaceExampleImages.length === 0,
  `workspace-example image paths use the exact on-disk filename case${wrongCaseWorkspaceExampleImages.length
    ? `; mismatched: ${wrongCaseWorkspaceExampleImages.map(({ image }) => image.src).join(', ')}` : ''}`);

const referencedWorkspaceExampleFiles = new Set(safeWorkspaceExampleImages
  .map(({ image }) => image.src.slice(workspaceExampleImagePrefix.length)));
const orphanWorkspaceExampleImages = [...workspaceExampleImageFiles]
  .filter((file) => !referencedWorkspaceExampleFiles.has(file));
check(orphanWorkspaceExampleImages.length === 0,
  `the workspace-example image directory has no unreferenced JPG assets${orphanWorkspaceExampleImages.length
    ? `; orphaned: ${orphanWorkspaceExampleImages.join(', ')}` : ''}`);

const invalidWorkspaceExampleDimensions = safeWorkspaceExampleImages.filter(({ image }) => {
  if (!existsSync(join(ROOT, image.src))) return false;
  const dimensions = jpegDimensions(join(ROOT, image.src));
  return !dimensions || dimensions.width !== 1440 || dimensions.height !== 810;
});
check(invalidWorkspaceExampleDimensions.length === 0,
  `every workspace-example image is a 1440 × 810 JPEG${invalidWorkspaceExampleDimensions.length
    ? `; invalid: ${invalidWorkspaceExampleDimensions.map(({ image }) => image.src).join(', ')}` : ''}`);

const oversizedWorkspaceExampleImages = safeWorkspaceExampleImages.filter(({ image }) =>
  existsSync(join(ROOT, image.src)) && statSync(join(ROOT, image.src)).size > 225280);
const workspaceExampleImageBytes = safeWorkspaceExampleImages.reduce((total, { image }) => total
  + (existsSync(join(ROOT, image.src)) ? statSync(join(ROOT, image.src)).size : 0), 0);
check(oversizedWorkspaceExampleImages.length === 0 && workspaceExampleImageBytes <= 2.5 * 1024 * 1024,
  `workspace-example imagery stays within 225,280 bytes each / 2.5 MiB total; total ${
    workspaceExampleImageBytes.toLocaleString('en-CH')} bytes${oversizedWorkspaceExampleImages.length
    ? `; oversized: ${oversizedWorkspaceExampleImages.map(({ image }) => image.src).join(', ')}` : ''}`);

const workspaceExampleMetadata = safeWorkspaceExampleImages.flatMap(({ image }) => {
  if (!existsSync(join(ROOT, image.src))) return [];
  return jpegEmbeddedMetadata(join(ROOT, image.src))
    .map((marker) => `${image.src}:${marker}`);
});
check(workspaceExampleMetadata.length === 0,
  `workspace-example JPEGs contain no EXIF, XMP, ICC, IPTC, comments, or thumbnails${
    workspaceExampleMetadata.length ? `; found: ${workspaceExampleMetadata.join(', ')}` : ''}`);

const incompleteExampleProvenance = workspaceExampleImages.filter(({ image }) =>
  !image?.title || !image.alt
  || !/illustrativ/i.test(image.caption || '') || !/nicht verbindlich/i.test(image.caption || '')
  || !/OpenAI/i.test(image.credit || '') || !/2026/.test(image.credit || '')
  || !image.license || !/OpenAI/i.test(image.provenance || '') || !/2026/.test(image.provenance || '')
  || !/keine Fotografie/i.test(image.provenance || '')
  || !/keine verifizierte Rekonstruktion/i.test(image.provenance || '')
  || !/keine freigegebene Planung/i.test(image.provenance || ''));
check(incompleteExampleProvenance.length === 0,
  `every workspace-example image states useful text, non-binding status, credit, licence, and full provenance${
    incompleteExampleProvenance.length
      ? `; incomplete: ${incompleteExampleProvenance.map(({ image }) => image?.src || '(invalid record)').join(', ')}`
      : ''}`);

const brokenExampleModules = workspaceExamples.flatMap((example) => (example?.modules || [])
  .filter((number) => !moduleNumbers.has(Number(number)))
  .map((number) => `${example?.exampleId || '(invalid record)'}:M${number}`));
check(brokenExampleModules.length === 0,
  `workspace examples reference current Multispace modules${brokenExampleModules.length
    ? `; unresolved: ${brokenExampleModules.join(', ')}` : ''}`);

// --- data tables: one primary key per table ---------------------------------
// From the domain review (user, 2026-08-12). The flags claimed two to four
// primary keys per table where the columns were foreign keys into other
// tables (COMP_CODE, BUSINESS_ENTITY) or plainly not unique (BUILDING, the
// building's number within its entity). A table has ONE key; where that key
// genuinely spans columns, it is one composite key and the field list says so.
const dataTables = json('data/data-tables.json');
// Only entries here may carry a multi-column key, and each states why.
const COMPOSITE_KEYS = {
  // A measurement is identified by its object, its type and the date it applies
  // from — the same row exists again for the next validity period.
  'sap-refx-vibdme': ['OBJECT_TYPE', 'OBJECT_ID', 'MEASUREMENT', 'VALID_FROM'],
};
const keysOf = (t) => (t.fields || []).filter((f) => f.primaryKey).map((f) => f.name);

const keyless = dataTables.filter((t) => !keysOf(t).length);
check(keyless.length === 0,
  `every data table declares a primary key${keyless.length ? `; unresolved: ${keyless.map((t) => t.tableId).join(', ')}` : ''}`);

const unexpectedComposite = dataTables.filter((t) => keysOf(t).length > 1 && !COMPOSITE_KEYS[t.tableId]);
check(unexpectedComposite.length === 0,
  `no table claims several independent primary keys${unexpectedComposite.length
    ? `; unresolved: ${unexpectedComposite.map((t) => `${t.tableId} (${keysOf(t).join(' + ')})`).join(', ')}` : ''}`);

const wrongComposite = Object.entries(COMPOSITE_KEYS).filter(([id, expected]) => {
  const table = dataTables.find((t) => t.tableId === id);
  return !table || keysOf(table).join('|') !== expected.join('|');
});
check(wrongComposite.length === 0,
  `each documented composite key still matches the data${wrongComposite.length
    ? `; unresolved: ${wrongComposite.map(([id]) => id).join(', ')}` : ''}`);

// A key column is by definition present, and a column cannot be the table's own
// key and a reference into another table at the same time.
const nullableKeys = dataTables.flatMap((t) => (t.fields || [])
  .filter((f) => f.primaryKey && f.nullable !== false).map((f) => `${t.tableId}.${f.name}`));
check(nullableKeys.length === 0,
  `no primary key is nullable${nullableKeys.length ? `; unresolved: ${nullableKeys.join(', ')}` : ''}`);

const keyAndForeign = dataTables.flatMap((t) => (t.fields || [])
  .filter((f) => f.primaryKey && f.foreignKey).map((f) => `${t.tableId}.${f.name}`));
check(keyAndForeign.length === 0,
  `no column is both primary and foreign key${keyAndForeign.length ? `; unresolved: ${keyAndForeign.join(', ')}` : ''}`);

// `unique` marks a business key that is NOT the table's key (bbl_id on the GIS
// layers, where the Esri objectid is). Both flags at once says nothing.
const uniqueAndKey = dataTables.flatMap((t) => (t.fields || [])
  .filter((f) => f.unique && f.primaryKey).map((f) => `${t.tableId}.${f.name}`));
check(uniqueAndKey.length === 0,
  `no column is flagged both unique and primary key${uniqueAndKey.length ? `; unresolved: ${uniqueAndKey.join(', ')}` : ''}`);

console.log(failures ? `\nfailed: ${failures} check(s)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
