// Pure contracts of the Plan-Editor landing page: which work items each layer
// derives from the shipped fixtures, how they are ordered, and what the
// «Zuletzt bearbeitet» strip offers. No DOM, no browser — the whole landing
// model is assertable here before any markup exists.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_LAYER,
  PLAN_EDITOR_LAYERS,
  formatPlanDate,
  parsePlanDate,
  planEditorLayer,
  planEditorRecentFloors,
  planEditorTaskCounts,
  planEditorTasks,
} from '../js/floorplan-editor/tasks.js';

const json = (path) => JSON.parse(readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8'));

const floors = json('data/floors.json');
const planning = json('data/workspace-planning.json');
const tenancies = json('data/tenancies.json');
const buildings = json('data/buildings.geojson').features.map((feature) => ({
  bbl_id: feature.properties.bbl_id,
  name: feature.properties.bbl_bez || feature.properties.bbl_id,
}));

// The route builds the same shape from `core`; rebuilding it here keeps the test
// independent of the browser data core.
const objects = planning.map((entry) => {
  const building = buildings.find((item) => item.bbl_id === entry.buildingId);
  const own = floors.filter((floor) => floor.buildingId === entry.buildingId)
    .sort((left, right) => left.level - right.level);
  return building && own.length ? { building, floors: own, planning: entry } : null;
}).filter(Boolean);

// One planning entry (1080/6540/AA) carries no floors and is filtered out by the
// route as well, so seven objects reach the landing page.
assert.equal(objects.length, 7);
assert.ok(objects.every((entry) => entry.floors.length > 0));

// --- Dates ------------------------------------------------------------------
// Fixtures mix Swiss timestamps with ISO dates; both must compare and format.
assert.equal(parsePlanDate('30.09.2025, 09:40'), Date.UTC(2025, 8, 30, 9, 40));
assert.equal(parsePlanDate('2026-03-31'), Date.UTC(2026, 2, 31));
assert.equal(parsePlanDate('31.02.2026'), null);
assert.equal(parsePlanDate('2026-02-29'), null);
assert.equal(parsePlanDate('29.02.2028'), Date.UTC(2028, 1, 29));
assert.equal(parsePlanDate('01.01.2026, 24:00'), null);
assert.equal(parsePlanDate('01.01.2026, 23:60'), null);
assert.equal(parsePlanDate(''), null);
assert.equal(parsePlanDate('kein Datum'), null);
assert.equal(formatPlanDate('2026-03-31'), '31.03.2026');
assert.equal(formatPlanDate('28.03.2026, 14:12'), '28.03.2026');
assert.equal(formatPlanDate(null), '');

// --- Layers -----------------------------------------------------------------
assert.deepEqual(PLAN_EDITOR_LAYERS.map((layer) => layer.id),
  ['usage', 'workspace', 'tenancy', 'operations']);
assert.equal(DEFAULT_LAYER, 'usage');
assert.equal(planEditorLayer('tenancy').label, 'Mietverhältnisse');
// An unknown layer falls back rather than rendering an empty page.
assert.equal(planEditorLayer('does-not-exist').id, 'usage');
// The operations layer is declared but has no data; it must say so instead of
// looking finished.
const operations = planEditorLayer('operations');
assert.equal(operations.available, false);
assert.match(operations.emptyReason, /noch keine Attribute/);
assert.ok(PLAN_EDITOR_LAYERS.filter((layer) => layer.available).length === 3);

// --- Usage layer ------------------------------------------------------------
const NOW = Date.UTC(2026, 7, 10);   // 10.08.2026, the prototype's "today"
const usage = planEditorTasks(objects, { layer: 'usage', now: NOW });
const kinds = usage.map((task) => task.kind);
assert.ok(kinds.includes('sync'), `usage derives sync work: ${kinds}`);
assert.ok(kinds.includes('order'), `usage derives order work: ${kinds}`);

const sync = usage.find((task) => task.kind === 'sync');
assert.equal(sync.floorId, '1080-6650-AA-1og');
assert.equal(sync.severity, 'warning');
assert.equal(sync.state, 'nicht synchronisiert');
assert.match(sync.detail, /zuletzt 30\.09\.2025/);

// The CAD order's target date is in the past relative to NOW, so it escalates
// rather than sitting quietly as an info row.
const order = usage.find((task) => task.kind === 'order');
assert.equal(order.severity, 'error');
assert.equal(order.buildingId, '1080/6650/AA');
assert.match(order.title, /ZTU0 \/ 4000 218 774/);
assert.match(order.state, /überfällig seit 31\.03\.2026/);
// Before the deadline the same order is merely open.
const beforeDeadline = planEditorTasks(objects, { layer: 'usage', now: Date.UTC(2026, 0, 15) });
const earlyOrder = beforeDeadline.find((task) => task.kind === 'order');
assert.equal(earlyOrder.severity, 'info');
assert.match(earlyOrder.state, /Stichtag 31\.03\.2026/);

// Errors first, then warnings, then info.
const severities = usage.map((task) => task.severity);
const rank = { error: 0, warning: 1, info: 2 };
assert.deepEqual(severities, [...severities].sort((left, right) => rank[left] - rank[right]),
  `work list is ordered by severity: ${severities}`);

// Local drafts join the same list and name the floor they belong to.
const withDraft = planEditorTasks(objects, {
  layer: 'usage', now: NOW,
  drafts: [{ floorId: '1080-6650-AA-2og', changeCount: 12, savedAt: NOW }],
});
const draft = withDraft.find((task) => task.kind === 'draft');
assert.equal(draft.floorId, '1080-6650-AA-2og');
assert.equal(draft.state, 'nicht publiziert');
assert.match(draft.detail, /12 lokale Änderungen/);
assert.match(draft.title, /2\. OG/);
// A draft for a floor the fixtures do not know still appears — losing a local
// working copy silently would be worse than an unnamed row.
const orphan = planEditorTasks(objects, {
  layer: 'usage', now: NOW, drafts: [{ floorId: 'unknown-floor', changeCount: 0 }],
}).find((task) => task.kind === 'draft');
assert.equal(orphan.title, 'Entwurf · unknown-floor');
assert.equal(orphan.detail, 'lokal gespeichert');

// --- Workspace layer --------------------------------------------------------
const workspace = planEditorTasks(objects, { layer: 'workspace', now: NOW });
assert.ok(workspace.every((task) => task.kind === 'equipment'));
// Exactly the floors without an equipment count, i.e. everything except the
// three floors the planning fixture covers.
const coveredFloors = planning.flatMap((entry) => (entry.floors || [])
  .filter((floor) => floor.equipmentCount != null).map((floor) => floor.floorId));
const plannedFloorCount = objects.reduce((sum, entry) => sum + entry.floors.length, 0);
assert.equal(workspace.length, plannedFloorCount - coveredFloors.length);
assert.ok(workspace.every((task) => !coveredFloors.includes(task.floorId)));
assert.equal(workspace[0].state, 'Ausstattung nicht erfasst');

// --- Tenancy layer ----------------------------------------------------------
const tenancy = planEditorTasks(objects, { layer: 'tenancy', now: NOW, tenancies });
assert.ok(tenancy.length >= 1, `leases inside the notice window: ${tenancy.length}`);
assert.ok(tenancy.every((task) => task.kind === 'lease'));
// Only leases ending within a year of NOW, and only for buildings this editor
// can actually open.
const editable = new Set(objects.map((entry) => entry.building.bbl_id));
for (const task of tenancy) {
  assert.ok(editable.has(task.buildingId), `lease belongs to an editable building: ${task.buildingId}`);
}
const horizon = NOW + 365 * 24 * 60 * 60 * 1000;
const expected = tenancies.filter((item) => editable.has(item.buildingId)
  && parsePlanDate(item.leaseEnd) !== null && parsePlanDate(item.leaseEnd) <= horizon);
assert.equal(tenancy.length, expected.length);
// A lease that already ended escalates to an error.
const expired = planEditorTasks(objects, { layer: 'tenancy', now: Date.UTC(2027, 5, 1), tenancies })
  .filter((task) => task.severity === 'error');
assert.ok(expired.length >= 1);
assert.match(expired[0].state, /abgelaufen am/);

// --- Empty layer ------------------------------------------------------------
assert.deepEqual(planEditorTasks(objects, { layer: 'operations', now: NOW }), []);
assert.deepEqual(planEditorTasks([], { layer: 'usage', now: NOW }), []);

// --- Counts -----------------------------------------------------------------
const counts = planEditorTaskCounts(objects, { now: NOW, tenancies });
assert.equal(counts.usage, usage.length);
assert.equal(counts.workspace, workspace.length);
assert.equal(counts.tenancy, tenancy.length);
assert.equal(counts.operations, 0);

// --- Recent floors ----------------------------------------------------------
// A visited floor outranks a synchronised one, and each entry carries the facts
// the card shows.
const recents = planEditorRecentFloors(objects, {
  visits: [{ floorId: '1080-4850-AG-2og', at: NOW }],
  drafts: [{ floorId: '1080-6650-AA-2og' }],
});
assert.equal(recents[0].floorId, '1080-4850-AG-2og');
assert.equal(recents[0].source, 'visit');
assert.ok(recents.length > 1 && recents.length <= 4);
assert.ok(recents.slice(1).every((entry) => entry.source === 'sync'));
assert.ok(recents.every((entry) => entry.buildingId && entry.label && entry.floorId));
assert.equal(recents.find((entry) => entry.floorId === '1080-6650-AA-2og')?.hasDraft, true);
// Synchronised floors come newest first.
const synced = recents.filter((entry) => entry.source === 'sync').map((entry) => entry.at);
assert.deepEqual(synced, [...synced].sort((left, right) => right - left));
// Unknown or duplicate visits never create phantom cards.
const guarded = planEditorRecentFloors(objects, {
  visits: [{ floorId: 'nope', at: NOW }, { floorId: '1080-4850-AG-2og', at: NOW },
    { floorId: '1080-4850-AG-2og', at: NOW - 10 }],
  limit: 3,
});
assert.equal(guarded.filter((entry) => entry.floorId === '1080-4850-AG-2og').length, 1);
assert.ok(guarded.every((entry) => entry.floorId !== 'nope'));
assert.equal(guarded.length, 3);
assert.deepEqual(planEditorRecentFloors(objects, { limit: 0 }), []);

console.log('Plan-Editor landing model passed:', JSON.stringify({
  layers: PLAN_EDITOR_LAYERS.length, usage: usage.length, workspace: workspace.length,
  tenancy: tenancy.length, recents: recents.length,
}));
