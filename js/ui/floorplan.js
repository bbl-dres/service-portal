// SVG floor plan: colour and select spaces, with a Σ m² legend.
//
// WHY SVG RATHER THAN MAPLIBRE: the reference prototype (tenant-portal) draws
// spaces as GeoJSON polygons in MapLibre. That adds WebGL, a CDN dependency and
// world coordinates for something that is not geography, while the map service
// may be blocked on the federal network (docs/code-review.md). A floor plan is a
// local drawing. Inline SVG is dependency-free, sharp at every zoom level and
// printable, and every space is an individually focusable element with its own
// accessible name.
//
// The module is pure: it receives spaces and a colour mode and returns HTML.
// The caller wires events (js/apps/tenancies.js).

import { escape as esc } from '../components.js';
import { formatArea } from '../format.js';

// Colour modes. `none` shows the plain drawing and is the default because a
// floor plan is first a plan and becomes an analysis only when requested.
export const COLOR_MODES = [
  { value: 'none', label: 'Keine' },
  { value: 'use', label: 'Nutzung' },
  { value: 'sia', label: 'SIA 416' },
  { value: 've', label: 'Verwaltungseinheit' },
  { value: 'capacity', label: 'Arbeitsplatzdichte' },
];

// Colours live as CSS variables in the stylesheet (--fp-*), giving the legend
// and drawing one source and keeping palette changes in one file. Only keys
// live here; `fill` sets `var(--fp-…)`.
const GROUP_KEY = { arbeit: 'work', zusammen: 'collab', infra: 'infra', sonder: 'special' };
const SIA_KEY = { HNF: 'hnf', NNF: 'nnf', VF: 'vf', FF: 'ff', TF: 'tf' };
// Six distinguishable shades; more administrative units per floor are rare.
const ADMINISTRATIVE_UNIT_SLOTS = ['a', 'b', 'c', 'd', 'e', 'f'];
// Workplace density: empty / normal / dense. This deliberately uses traffic-
// light semantics because «too densely occupied» is an assessment, not merely
// a category.
const CAPACITY_KEY = (space) => {
  if (!space.capacity) return 'none';
  const areaPerWorkstation = space.area / space.capacity;
  return areaPerWorkstation >= 12 ? 'low' : areaPerWorkstation >= 8 ? 'ok' : 'high';
};
const CAPACITY_LABEL = { none: 'Ohne Arbeitsplätze', low: 'Grosszügig (ab 12 m²/AP)', ok: 'Standard (8–12 m²/AP)', high: 'Dicht (unter 8 m²/AP)' };

// Administrative-unit colours are assigned alphabetically so the same unit
// gets the same colour on every floor while the set remains the same.
function administrativeUnitColorSlots(spaces) {
  const administrativeUnits = [...new Set(spaces.map((space) => space.occupierVe).filter(Boolean))].sort();
  const map = new Map();
  administrativeUnits.forEach((unit, index) => map.set(unit, ADMINISTRATIVE_UNIT_SLOTS[index % ADMINISTRATIVE_UNIT_SLOTS.length]));
  return map;
}

// Fill key for a space in the selected mode; `null` means a neutral surface.
function fillKey(space, mode, slots) {
  if (mode === 'use') return `use-${GROUP_KEY[space.group] || 'infra'}`;
  if (mode === 'sia') return `sia-${SIA_KEY[space.sia] || 'nnf'}`;
  if (mode === 've') return space.occupierVe ? `administrative-unit-${slots.get(space.occupierVe)}` : 'unassigned';
  if (mode === 'capacity') return `cap-${CAPACITY_KEY(space)}`;
  return null;
}

// Space category in the selected mode: [key, label].
function bucket(space, mode, slots) {
  if (mode === 'use') return [space.group, space.groupLabel];
  if (mode === 'sia') return [space.sia, `${space.siaLabel} (${space.sia})`];
  if (mode === 've') return [space.occupierVe || '—', space.occupierVe || 'Nicht zugeteilt'];
  if (mode === 'capacity') { const key = CAPACITY_KEY(space); return [key, CAPACITY_LABEL[key]]; }
  return [null, null];
}

/* --------------------------------------------------------------- Drawing ---- */
// `extent` is the floor's drawing size ([width, height] in 1 cm units). The SVG
// scales through its viewBox; the markup has no pixel dimensions, so the plan
// works at every width and in print. Label thresholds use DRAWING UNITS
// (100 = 1 m). A standard office is 360–540 units wide, corresponding to about
// 70–110 pixels at the usual display width. Three levels work better than all
// or nothing: the room number always fits, the use appears from ~100 px, and the
// area in between. Without levels, either no labels appeared (threshold too
// high) or they overlapped in narrow auxiliary spaces.
const ROOM_NUMBER_MIN = 200, AREA_LABEL_MIN = 330, USE_LABEL_MIN = 500;
const SPACE_GROUPS = new Set(Object.keys(GROUP_KEY));
const BOOKING_STATUSES = new Set(['available', 'unavailable', 'unsuitable']);
const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function floorplanSvg({ floor, spaces, mode = 'none', selectedId = '', statuses = {}, selectableIds = null }) {
  const extent = Array.isArray(floor?.extent) ? floor.extent : [];
  const w = Math.max(1, finiteNumber(extent[0], 4000));
  const h = Math.max(1, finiteNumber(extent[1], 1440));
  const slots = administrativeUnitColorSlots(spaces);
  const selectable = selectableIds ? new Set(selectableIds) : null;
  const pad = 40;

  const renderSpace = (space) => {
    const rect = Array.isArray(space?.rect) ? space.rect : [];
    const x = finiteNumber(rect[0]);
    const y = finiteNumber(rect[1]);
    const width = Math.max(0, finiteNumber(rect[2]));
    const height = Math.max(0, finiteNumber(rect[3]));
    const key = fillKey(space, mode, slots);
    const rawStatus = Object.hasOwn(statuses, space.spaceId) ? statuses[space.spaceId] : '';
    const status = BOOKING_STATUSES.has(rawStatus) ? rawStatus : '';
    const group = SPACE_GROUPS.has(space.group) ? space.group : 'infra';
    const canSelect = !selectable || selectable.has(space.spaceId);
    const classes = ['fp__room', `fp__room--${group}`, key ? `fp__room--fill` : '',
      status ? `fp__room--booking-${status}` : '', selectedId === space.spaceId ? 'is-selected' : ''].filter(Boolean).join(' ');
    const centerX = x + width / 2, centerY = y + height / 2;
    const roomNumber = String(space.roomNumber || '').replace(/^.*\s/, '');
    // The corridor is shallow (240 units) yet can still carry a label, so the
    // height threshold for its number is lower than for the stacked lines below.
    const showNumber = width >= ROOM_NUMBER_MIN && height >= 200;
    const showArea = width >= AREA_LABEL_MIN && height >= 400;
    const showUse = width >= USE_LABEL_MIN && height >= 400;
    // Centre the stack: its block shifts with the number of visible lines so it
    // does not fall outside the space.
    const lines = [showNumber && ['fp__nr', roomNumber], showUse && ['fp__use', space.useLabel], showArea && ['fp__area', formatArea(space.area)]].filter(Boolean);
    const dy = 78;
    const firstLineY = centerY - ((lines.length - 1) * dy) / 2 + 22;
    const statusLabel = status === 'available' ? ', verfügbar' : status === 'unavailable' ? ', belegt' : status === 'unsuitable' ? ', nicht passend' : '';
    return `<g class="${classes}"${canSelect ? ` data-space="${esc(space.spaceId)}"` : ''} role="listitem">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6"
        ${key ? `style="fill:var(--fp-${key})"` : ''}
        ${canSelect ? 'tabindex="0" role="button"' : 'aria-disabled="true"'}
        aria-label="${esc(`${space.roomNumber}, ${space.useLabel}, ${space.area} Quadratmeter${space.occupierVe ? ', ' + space.occupierVe : ''}${statusLabel}`)}"
        ${canSelect ? `aria-pressed="${selectedId === space.spaceId ? 'true' : 'false'}"` : ''}></rect>
      ${lines.map(([className, text], index) => `<text class="${className}" x="${centerX}" y="${firstLineY + index * dy}">${esc(text)}</text>`).join('')}
    </g>`;
  };

  return `<svg class="fp" viewBox="${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}"
      role="list" aria-label="Grundriss ${esc(floor.label)} — ${spaces.length} Räume"
      preserveAspectRatio="xMidYMid meet">
    <rect class="fp__shell" x="-8" y="-8" width="${w + 16}" height="${h + 16}" rx="10"></rect>
    ${spaces.map(renderSpace).join('')}
  </svg>`;
}

/* ---------------------------------------------------------------- Legend ---- */
// Σ m² by category: the legend also analyses the floor. Without totals it would
// only be a colour table; with them it answers «how much area is circulation?»
// without a second view.
export function floorplanLegend(spaces, mode) {
  if (mode === 'none') return '';
  const slots = administrativeUnitColorSlots(spaces);
  const totalsByCategory = new Map();
  for (const space of spaces) {
    const [key, label] = bucket(space, mode, slots);
    const current = totalsByCategory.get(key) || { label, area: 0, count: 0, fill: fillKey(space, mode, slots) };
    current.area += space.area; current.count++;
    totalsByCategory.set(key, current);
  }
  const total = [...totalsByCategory.values()].reduce((sum, entry) => sum + entry.area, 0) || 1;
  const rows = [...totalsByCategory.values()].sort((a, b) => b.area - a.area);
  return `<ul class="fp-legend" aria-label="Legende mit Flächenanteilen">
    ${rows.map((r) => `<li class="fp-legend__item">
      <span class="fp-legend__swatch" style="background:var(--fp-${r.fill})" aria-hidden="true"></span>
      <span class="fp-legend__label">${esc(r.label)}</span>
      <span class="fp-legend__val">${formatArea(Math.round(r.area))}<span class="fp-legend__pct">${Math.round(r.area / total * 100)} %</span></span>
    </li>`).join('')}
  </ul>`;
}

/* ---------------------------------------------------------------- Wiring ---- */
// Click and keyboard interaction on spaces. Returns a cleanup function which
// the caller attaches to ctx.onUnmount.
export function wireFloorplan(root, onSelect) {
  const ctrl = new AbortController();
  const { signal } = ctrl;
  const pick = (el) => { const g = el.closest('[data-space]'); if (g) onSelect(g.dataset.space); };
  root.addEventListener('click', (e) => pick(e.target), { signal });
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!e.target.closest('[data-space]')) return;
    e.preventDefault();
    pick(e.target);
  }, { signal });
  return () => ctrl.abort();
}
