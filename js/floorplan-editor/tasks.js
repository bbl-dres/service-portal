// What is waiting for the visitor, derived from the same fixtures the editor
// already reads. Pure and DOM-free so the whole landing page is assertable in
// Node before any markup exists.
//
// The Plan-Editor serves several groups that edit the SAME room geometry but own
// DIFFERENT attribute layers: plan authors own geometry and use type, workspace
// planners own capacity and equipment, tenancy managers own the contract link,
// operations owns cleaning and maintenance. A layer is therefore the unit that
// scopes the work list, and each layer states which signals it can read today —
// an empty layer says so rather than pretending to be finished.

const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => value == null ? '' : String(value);

export const PLAN_EDITOR_LAYERS = Object.freeze([
  { id: 'usage', label: 'Grundriss & Nutzung', available: true },
  { id: 'workspace', label: 'Arbeitsplätze & Ausstattung', available: true },
  { id: 'tenancy', label: 'Mietverhältnisse', available: true },
  {
    id: 'operations',
    label: 'Betrieb & Reinigung',
    available: false,
    emptyReason: 'Für diese Ebene sind im Datenbestand noch keine Attribute erfasst. '
      + 'Sobald Reinigungs- und Unterhaltsangaben je Raum vorliegen, erscheinen sie hier.',
  },
]);

export const DEFAULT_LAYER = PLAN_EDITOR_LAYERS[0].id;

export function planEditorLayer(id) {
  return PLAN_EDITOR_LAYERS.find((layer) => layer.id === id) || PLAN_EDITOR_LAYERS[0];
}

// Fixture dates are Swiss-formatted («28.03.2026, 14:12»); ISO dates appear on
// planning and tenancy records. Both are compared as time values so sorting and
// deadline maths do not depend on which shape a record happens to use.
export function parsePlanDate(value) {
  const raw = text(value).trim();
  if (!raw) return null;
  const swiss = /^(\d{2})\.(\d{2})\.(\d{4})(?:,\s*(\d{2}):(\d{2}))?$/.exec(raw);
  if (swiss) {
    const [, day, month, year, hour = '00', minute = '00'] = swiss;
    const time = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    return Number.isFinite(time) ? time : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const time = Date.parse(`${raw}T00:00:00Z`);
    return Number.isFinite(time) ? time : null;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatPlanDate(value) {
  const time = parsePlanDate(value);
  if (time === null) return '';
  const date = new Date(time);
  return `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${date.getUTCFullYear()}`;
}

const SEVERITY_RANK = Object.freeze({ error: 0, warning: 1, info: 2 });

function planningFloorRecord(planning, floorId) {
  return list(planning?.floors).find((entry) => entry.floorId === floorId) || null;
}

/**
 * Work items for one layer.
 *
 * `objects` are the editor's planning objects ({ building, floors, planning }).
 * `drafts` are locally stored working copies; `now` is injected so a deadline
 * test is reproducible.
 */
export function planEditorTasks(objects, {
  layer = DEFAULT_LAYER, tenancies = [], drafts = [], now = Date.now(),
} = {}) {
  const entries = list(objects);
  const tasks = [];
  const push = (task) => tasks.push(task);

  if (layer === 'usage') {
    for (const entry of entries) {
      for (const floor of list(entry.floors)) {
        const record = planningFloorRecord(entry.planning, floor.floorId);
        if (record?.planStatus !== 'not_synced') continue;
        push({
          kind: 'sync',
          severity: 'warning',
          buildingId: entry.building.bbl_id,
          floorId: floor.floorId,
          title: `${floor.label} · ${entry.building.name}`,
          state: 'nicht synchronisiert',
          detail: record.lastSync
            ? `CAD-Stand weicht vom Portal ab · zuletzt ${record.lastSync}`
            : 'CAD-Stand weicht vom Portal ab',
          sortAt: parsePlanDate(record.lastSync) ?? 0,
        });
      }
      const planning = entry.planning || {};
      if (planning.orderStatus !== 'open') continue;
      const due = parsePlanDate(planning.targetDate);
      push({
        kind: 'order',
        severity: due !== null && due < now ? 'error' : 'info',
        buildingId: entry.building.bbl_id,
        floorId: '',
        title: `Auftrag ${planning.inventoryOrder || planning.projectId || 'ohne Nummer'} · ${entry.building.name}`,
        state: due === null ? 'offen'
          : `${due < now ? 'überfällig seit' : 'Stichtag'} ${formatPlanDate(planning.targetDate)}`,
        detail: `CAD-Planung in Arbeit · ${list(entry.floors).length} Geschosse betroffen`,
        sortAt: due ?? 0,
      });
    }
    for (const draft of list(drafts)) {
      const entry = entries.find((item) => list(item.floors)
        .some((floor) => floor.floorId === draft.floorId));
      const floor = list(entry?.floors).find((item) => item.floorId === draft.floorId);
      push({
        kind: 'draft',
        severity: 'info',
        buildingId: entry?.building.bbl_id || '',
        floorId: draft.floorId,
        title: floor && entry
          ? `Entwurf · ${floor.label} ${entry.building.name}`
          : `Entwurf · ${draft.floorId}`,
        state: 'nicht publiziert',
        detail: draft.changeCount
          ? `${draft.changeCount} lokale Änderungen`
          : 'lokal gespeichert',
        sortAt: draft.savedAt ?? 0,
      });
    }
  }

  if (layer === 'workspace') {
    for (const entry of entries) {
      for (const floor of list(entry.floors)) {
        const record = planningFloorRecord(entry.planning, floor.floorId);
        if (record && record.equipmentCount != null) continue;
        push({
          kind: 'equipment',
          severity: 'info',
          buildingId: entry.building.bbl_id,
          floorId: floor.floorId,
          title: `${floor.label} · ${entry.building.name}`,
          state: 'Ausstattung nicht erfasst',
          detail: 'Für dieses Geschoss ist kein Ausstattungsbestand hinterlegt.',
          sortAt: 0,
        });
      }
    }
  }

  if (layer === 'tenancy') {
    // A lease inside the notice window is the one thing a tenancy manager must
    // not miss; everything else in this layer is ordinary browsing.
    const horizon = now + 365 * 24 * 60 * 60 * 1000;
    const buildings = new Set(entries.map((entry) => entry.building.bbl_id));
    for (const tenancy of list(tenancies)) {
      if (!buildings.has(tenancy.buildingId)) continue;
      const end = parsePlanDate(tenancy.leaseEnd);
      if (end === null || end > horizon) continue;
      push({
        kind: 'lease',
        severity: end < now ? 'error' : 'warning',
        buildingId: tenancy.buildingId,
        floorId: list(tenancy.floors)[0] || '',
        title: `${tenancy.veName || tenancy.ve} · ${tenancy.buildingName || tenancy.buildingId}`,
        state: `${end < now ? 'abgelaufen am' : 'Vertragsende'} ${formatPlanDate(tenancy.leaseEnd)}`,
        detail: `${tenancy.tenancyId} · ${list(tenancy.floorLabels).join(', ') || 'ohne Geschossangabe'}`,
        sortAt: end,
      });
    }
  }

  return tasks.sort((left, right) => (
    (SEVERITY_RANK[left.severity] ?? 3) - (SEVERITY_RANK[right.severity] ?? 3)
    || left.sortAt - right.sortAt
    || left.title.localeCompare(right.title, 'de')
  ));
}

/** Task counts per layer, for the tab badges. */
export function planEditorTaskCounts(objects, options = {}) {
  const counts = {};
  for (const layer of PLAN_EDITOR_LAYERS) {
    counts[layer.id] = layer.available
      ? planEditorTasks(objects, { ...options, layer: layer.id }).length
      : 0;
  }
  return counts;
}

/**
 * Floors to offer as «Zuletzt bearbeitet»: locally visited first (the visitor's
 * own trail), then anything the portal itself synchronised recently. Both carry
 * a real timestamp, so the strip never invents an order.
 */
export function planEditorRecentFloors(objects, { visits = [], drafts = [], limit = 4 } = {}) {
  const entries = list(objects);
  const byFloor = new Map();
  for (const entry of entries) {
    for (const floor of list(entry.floors)) {
      byFloor.set(floor.floorId, { entry, floor });
    }
  }
  const draftIds = new Set(list(drafts).map((draft) => draft.floorId));
  const seen = new Set();
  const recents = [];
  const add = (floorId, at, source) => {
    if (!floorId || seen.has(floorId) || !byFloor.has(floorId)) return;
    seen.add(floorId);
    const { entry, floor } = byFloor.get(floorId);
    const record = planningFloorRecord(entry.planning, floorId);
    recents.push({
      buildingId: entry.building.bbl_id,
      buildingName: entry.building.name,
      floorId,
      label: floor.label,
      areaHnf: Number(floor.areaHnf) || 0,
      planStatus: record?.planStatus || 'inventory',
      hasDraft: draftIds.has(floorId),
      at,
      source,
    });
  };
  for (const visit of list(visits)) add(visit.floorId, visit.at ?? 0, 'visit');
  const synced = entries.flatMap((entry) => list(entry.planning?.floors)
    .map((record) => ({ floorId: record.floorId, at: parsePlanDate(record.lastSync) ?? 0 })))
    .sort((left, right) => right.at - left.at);
  for (const record of synced) add(record.floorId, record.at, 'sync');
  return recents.slice(0, Math.max(0, limit));
}
