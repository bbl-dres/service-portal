// Canonical colour semantics shared by the SVG, resource tree and Three.js.
//
// Keep the RGB values in sync with the Federal Swiss design tokens in
// css/app.css. Consumers should use `css` for DOM/SVG output and `rgb` for
// canvas/WebGL output; `token`/`swatch` are stable semantic identifiers.

export const EDITOR_COLOR_MODES = Object.freeze([
  Object.freeze({ value: 'none', label: 'Keine' }),
  Object.freeze({ value: 'use', label: 'Nutzung' }),
  Object.freeze({ value: 'sia', label: 'SIA 416' }),
  Object.freeze({ value: 've', label: 'Verwaltungseinheit' }),
  Object.freeze({ value: 'module', label: 'Multispace-Modul' }),
]);

const color = (token, hex, cssVariable = '') => Object.freeze({
  token,
  swatch: token,
  hex,
  rgb: Number.parseInt(hex.slice(1), 16),
  css: cssVariable ? `var(${cssVariable})` : hex,
});

const FLOORPLAN_COLORS = Object.freeze({
  none: color('none', '#f7f8fa'),
  unassigned: color('unassigned', '#f1f3f5', '--fp-unassigned'),
  use: Object.freeze({
    'arbeit': color('use-work', '#dbe7f6', '--fp-use-work'),
    'zusammen': color('use-collab', '#fbeccd', '--fp-use-collab'),
    infra: color('use-infra', '#e9edf1', '--fp-use-infra'),
    'sonder': color('use-special', '#e4dcf2', '--fp-use-special'),
  }),
  sia: Object.freeze({
    HNF: color('sia-hnf', '#d6e6f5', '--fp-sia-hnf'),
    NNF: color('sia-nnf', '#e6ddf2', '--fp-sia-nnf'),
    VF: color('sia-vf', '#e9edf1', '--fp-sia-vf'),
    FF: color('sia-ff', '#dcecdd', '--fp-sia-ff'),
    TF: color('sia-tf', '#f7e2d6', '--fp-sia-tf'),
  }),
  administrativeUnit: Object.freeze([
    color('administrative-unit-a', '#d6e6f5', '--fp-administrative-unit-a'),
    color('administrative-unit-b', '#fbeccd', '--fp-administrative-unit-b'),
    color('administrative-unit-c', '#e4dcf2', '--fp-administrative-unit-c'),
    color('administrative-unit-d', '#f8dcdf', '--fp-administrative-unit-d'),
    color('administrative-unit-e', '#d9ecdb', '--fp-administrative-unit-e'),
    color('administrative-unit-f', '#d5eaf0', '--fp-administrative-unit-f'),
  ]),
  module: Object.freeze([
    color('module-1', '#dbe7f6', '--fpe-module-1'),
    color('module-2', '#cfe4f1', '--fpe-module-2'),
    color('module-3', '#d9ecdb', '--fpe-module-3'),
    color('module-4', '#fbeccd', '--fpe-module-4'),
    color('module-5', '#d5eaf0', '--fpe-module-5'),
    color('module-6', '#e4dcf2', '--fpe-module-6'),
    color('module-7', '#f7e2d6', '--fpe-module-7'),
    color('module-8', '#f8dcdf', '--fpe-module-8'),
    color('module-9', '#e9edf1', '--fpe-module-9'),
    color('module-10', '#dfe4e9', '--fpe-module-10'),
    color('module-11', '#dcecdd', '--fpe-module-11'),
  ]),
});

const USE_FALLBACK = FLOORPLAN_COLORS.use.infra;
const SIA_FALLBACK = FLOORPLAN_COLORS.sia.NNF;

export function normalizeColorMode(value) {
  return EDITOR_COLOR_MODES.some((mode) => mode.value === value) ? value : 'use';
}

/** Build a deterministic administrative-unit palette from all room occupiers. */
export function createColorContext(rooms = []) {
  const occupiers = [...new Set(rooms
    .map((room) => String(room?.['occupierVe'] || '').trim())
    .filter(Boolean))].sort();
  return Object.freeze({
    occupiers: Object.freeze(occupiers),
    administrativeUnitByOccupier: new Map(occupiers.map((name, index) => [
      name,
      FLOORPLAN_COLORS.administrativeUnit[index % FLOORPLAN_COLORS.administrativeUnit.length],
    ])),
  });
}

/** Resolve a room to one canonical semantic colour. */
export function roomColor(room = {}, mode = 'use', context = createColorContext([room])) {
  switch (normalizeColorMode(mode)) {
    case 'none':
      return FLOORPLAN_COLORS.none;
    case 'sia':
      return FLOORPLAN_COLORS.sia[room.sia] || SIA_FALLBACK;
    case 've': {
      const occupier = String(room['occupierVe'] || '').trim();
      return occupier
        ? context.administrativeUnitByOccupier.get(occupier) || FLOORPLAN_COLORS.administrativeUnit[0]
        : FLOORPLAN_COLORS.unassigned;
    }
    case 'module': {
      const index = Number(room.moduleId) - 1;
      return Number.isInteger(index) && FLOORPLAN_COLORS.module[index]
        ? FLOORPLAN_COLORS.module[index]
        : FLOORPLAN_COLORS.unassigned;
    }
    default:
      return FLOORPLAN_COLORS.use[room.group] || USE_FALLBACK;
  }
}

/**
 * Tree/legend-ready grouping metadata using exactly the same colour resolution
 * as the renderers. Optional labels let a view substitute its domain wording.
 */
export function roomColorDescriptor(room = {}, mode = 'use', context = createColorContext([room]), labels = {}) {
  const normalized = normalizeColorMode(mode);
  const resolved = roomColor(room, normalized, context);
  if (normalized === 'none') {
    return { key: 'all', label: labels.all || 'Alle Räume', swatch: resolved.swatch };
  }
  if (normalized === 'sia') {
    return {
      key: `sia-${room.sia || 'unassigned'}`,
      label: labels.sia || [room.sia, room.siaLabel].filter(Boolean).join(' · ') || 'Ohne SIA-Zuordnung',
      swatch: resolved.swatch,
    };
  }
  if (normalized === 've') {
    const occupier = String(room['occupierVe'] || '').trim();
    return {
      key: occupier ? `administrative-unit-${occupier}` : 'administrative-unit-unassigned',
      label: labels.administrativeUnit || occupier || 'Nicht zugeteilt',
      swatch: resolved.swatch,
    };
  }
  if (normalized === 'module') {
    const moduleId = Number(room.moduleId);
    const assigned = Number.isInteger(moduleId) && moduleId >= 1 && moduleId <= FLOORPLAN_COLORS.module.length;
    return {
      key: assigned ? `module-${moduleId}` : 'module-unassigned',
      label: labels.module || (assigned ? `Multispace-Modul ${moduleId}` : 'Ohne Ausstattungsstandard'),
      swatch: resolved.swatch,
    };
  }
  return {
    key: `use-${room.useLabel || room.group || 'unassigned'}`,
    label: labels.use || room.useLabel || 'Ohne Nutzung',
    swatch: resolved.swatch.replace(/^use-/, ''),
  };
}
