// SVG scene for the standalone floor-plan editor.
//
// The shared js/floorplan.js deliberately stays a small, read-only renderer for
// Tenancies and Workspace. Authoring needs a camera, furniture positions and
// measurement overlays, so it gets a separate scene without changing those
// stable consumers. Coordinates use the portal floor convention: 100 units = 1 m.

import { escape as esc } from './components.js';

export const EDITOR_COLOR_MODES = [
  { value: 'none', label: 'Keine' },
  { value: 'use', label: 'Nutzung' },
  { value: 'sia', label: 'SIA 416' },
  { value: 've', label: 'Verwaltungseinheit' },
  { value: 'module', label: 'Multispace-Modul' },
];

const GROUP_KEY = { arbeit: 'work', zusammen: 'collab', infra: 'infra', sonder: 'special' };
const SIA_KEY = { HNF: 'hnf', NNF: 'nnf', VF: 'vf', FF: 'ff', TF: 'tf' };
const VE_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];

function veMap(rooms) {
  const out = new Map();
  [...new Set(rooms.map((room) => room.occupierVe).filter(Boolean))].sort()
    .forEach((name, index) => out.set(name, VE_KEYS[index % VE_KEYS.length]));
  return out;
}

function roomFill(room, mode, ves) {
  if (mode === 'use') return `var(--fp-use-${GROUP_KEY[room.group] || 'infra'})`;
  if (mode === 'sia') return `var(--fp-sia-${SIA_KEY[room.sia] || 'nnf'})`;
  if (mode === 've') return room.occupierVe
    ? `var(--fp-ve-${ves.get(room.occupierVe) || 'a'})`
    : 'var(--fp-unassigned)';
  if (mode === 'module') return room.moduleId
    ? `var(--fpe-module-${Math.max(1, Math.min(11, Number(room.moduleId) || 1))})`
    : 'var(--fp-unassigned)';
  return room.group === 'infra' ? 'var(--color-secondary-50)' : 'var(--color-bg)';
}

const compactRoomNumber = (value) => String(value || '').replace(/^.*\s/, '');

function roomMarkup(room, selected, mode, ves, editable = false) {
  const [x, y, width, height] = room.rect;
  const showNumber = width >= 200 && height >= 200;
  const showUse = width >= 500 && height >= 390;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const lines = [showNumber && compactRoomNumber(room.roomNumber), showUse && room.useLabel].filter(Boolean);
  const firstY = cy - ((lines.length - 1) * 56) / 2 + 18;
  const label = `${room.roomNumber}, ${room.useLabel}, ${room.area} Quadratmeter`;
  const handles = selected && editable ? [
    ['nw', x, y], ['n', cx, y], ['ne', x + width, y],
    ['e', x + width, cy], ['se', x + width, y + height], ['s', cx, y + height],
    ['sw', x, y + height], ['w', x, cy],
  ].map(([handle, hx, hy]) => `<circle class="fpe-room__handle" data-room-handle="${handle}" cx="${hx}" cy="${hy}" r="18"></circle>`).join('') : '';
  return `<g class="fpe-room${selected ? ' is-selected' : ''}" data-entity="room" data-id="${esc(room.spaceId)}"
      tabindex="0" role="button" aria-pressed="${selected}" aria-label="${esc(label)}">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" style="fill:${roomFill(room, mode, ves)}"></rect>
    ${lines.map((line, index) => `<text x="${cx}" y="${firstY + index * 56}">${esc(line)}</text>`).join('')}
    ${handles}
  </g>`;
}

function placementShape(placement) {
  const width = Math.max(18, Number(placement.width) || 60);
  const depth = Math.max(18, Number(placement.depth) || 60);
  const x = Number(placement.x) || 0;
  const y = Number(placement.y) || 0;
  if (placement.shape === 'circle') {
    return `<ellipse cx="${x + width / 2}" cy="${y + depth / 2}" rx="${width / 2}" ry="${depth / 2}"></ellipse>`;
  }
  if (placement.shape === 'diamond') {
    const cx = x + width / 2, cy = y + depth / 2;
    return `<path d="M ${cx} ${y} L ${x + width} ${cy} L ${cx} ${y + depth} L ${x} ${cy} Z"></path>`;
  }
  return `<rect x="${x}" y="${y}" width="${width}" height="${depth}" rx="8"></rect>`;
}

function placementMarkup(placement, selected) {
  const width = Math.max(18, Number(placement.width) || 60);
  const depth = Math.max(18, Number(placement.depth) || 60);
  const cx = (Number(placement.x) || 0) + width / 2;
  const cy = (Number(placement.y) || 0) + depth / 2;
  const rotation = Number(placement.rotation) || 0;
  const label = `${placement.name || 'Ausstattungsobjekt'}, ${placement.articleId || placement.placementId}`;
  return `<g class="fpe-placement${selected ? ' is-selected' : ''}${placement.status === 'new' ? ' is-new' : ''}"
      data-entity="placement" data-id="${esc(placement.placementId)}" tabindex="0" role="button"
      aria-pressed="${selected}" aria-label="${esc(label)}" transform="rotate(${rotation} ${cx} ${cy})">
    ${placementShape(placement)}
    ${selected ? `<rect class="fpe-placement__selection" x="${(Number(placement.x) || 0) - 12}" y="${(Number(placement.y) || 0) - 12}"
      width="${width + 24}" height="${depth + 24}" rx="4"></rect>` : ''}
  </g>`;
}

function placementGhostMarkup(ghost) {
  if (!ghost) return '';
  const width = Math.max(18, Number(ghost.width) || 60);
  const depth = Math.max(18, Number(ghost.depth) || 60);
  const cx = (Number(ghost.x) || 0) + width / 2;
  const cy = (Number(ghost.y) || 0) + depth / 2;
  return `<g class="fpe-placement fpe-placement--ghost ${ghost.valid ? 'is-valid' : 'is-invalid'}"
      aria-hidden="true" transform="rotate(${Number(ghost.rotation) || 0} ${cx} ${cy})">
    ${placementShape(ghost)}
  </g>`;
}

function roomDraftMarkup(roomDraft) {
  const rect = roomDraft?.rect;
  if (!Array.isArray(rect) || rect.length !== 4) return '';
  const [x, y, width, height] = rect;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return '';
  const area = width * height / 10000;
  return `<g class="fpe-room-draft ${roomDraft.valid ? 'is-valid' : 'is-invalid'}" aria-hidden="true">
    <rect x="${x}" y="${y}" width="${width}" height="${height}"></rect>
    <text x="${x + width / 2}" y="${y + height / 2}">${esc(`${area.toLocaleString('de-CH', { maximumFractionDigits: 1 })} m²`)}</text>
  </g>`;
}

function measurementMarkup(measurement = {}) {
  const points = Array.isArray(measurement?.points) ? measurement.points : [];
  if (!points.length) return '';
  const coords = points.map((point) => `${point.x},${point.y}`).join(' ');
  const closed = measurement?.kind === 'area' && measurement.complete && points.length >= 3;
  const shape = closed
    ? `<polygon points="${coords}" class="fpe-measure__area"></polygon>`
    : `<polyline points="${coords}" class="fpe-measure__line"></polyline>`;
  const dots = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="16"></circle>`).join('');
  const last = points[points.length - 1];
  const value = measurementLabel(measurement);
  return `<g class="fpe-measure" aria-hidden="true">${shape}${dots}${value
    ? `<text x="${last.x + 30}" y="${last.y - 30}">${esc(value)}</text>` : ''}</g>`;
}

export function distanceMetres(points = []) {
  let units = 0;
  for (let index = 1; index < points.length; index++) {
    units += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return units / 100;
}

export function areaSquareMetres(points = []) {
  if (points.length < 3) return 0;
  let twiceArea = 0;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    twiceArea += point.x * next.y - next.x * point.y;
  });
  return Math.abs(twiceArea) / 2 / 10000;
}

export function measurementLabel(measurement = {}) {
  const points = measurement?.points || [];
  if (measurement?.kind === 'area' && measurement.complete) {
    return `${areaSquareMetres(points).toLocaleString('de-CH', { maximumFractionDigits: 1 })} m²`;
  }
  if (points.length >= 2) {
    return `${distanceMetres(points).toLocaleString('de-CH', { maximumFractionDigits: 2 })} m`;
  }
  return '';
}

export function fitCamera(floor, padding = 120) {
  const [width, height] = floor.extent || [4000, 1440];
  return { x: -padding, y: -padding, width: width + padding * 2, height: height + padding * 2 };
}

export function fitCameraToRect(rect, paddingRatio = .22) {
  if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite)) return null;
  const [x, y, width, height] = rect;
  if (width <= 0 || height <= 0) return null;
  const padding = Math.max(60, Math.max(width, height) * Math.max(.05, Number(paddingRatio) || 0));
  return {
    x: x - padding,
    y: y - padding,
    width: Math.max(300, width + padding * 2),
    height: Math.max(180, height + padding * 2),
  };
}

/** Return a rounded, camera-aware scale bar for a measured viewport width. */
export function scaleBar(camera, viewportWidth, targetPixels = 120) {
  const width = Number(viewportWidth) || 0;
  if (!camera || !Number.isFinite(camera.width) || camera.width <= 0 || width <= 0) {
    return { metres: 0, pixels: 0, label: '' };
  }
  const rawMetres = (camera.width / width) * Math.max(50, Number(targetPixels) || 120) / 100;
  const power = 10 ** Math.floor(Math.log10(Math.max(rawMetres, .01)));
  const normal = rawMetres / power;
  const step = normal < 2 ? 1 : normal < 5 ? 2 : 5;
  const metres = step * power;
  const pixels = metres * 100 * width / camera.width;
  return {
    metres,
    pixels,
    label: `${metres.toLocaleString('de-CH', { maximumFractionDigits: 2 })} m`,
  };
}

export function zoomCamera(camera, factor, anchor = null) {
  const safe = Math.max(.2, Math.min(5, Number(factor) || 1));
  const nextWidth = Math.max(300, Math.min(camera.width * safe, 24000));
  const nextHeight = Math.max(180, Math.min(camera.height * safe, 12000));
  const ax = anchor?.x ?? camera.x + camera.width / 2;
  const ay = anchor?.y ?? camera.y + camera.height / 2;
  const rx = (ax - camera.x) / camera.width;
  const ry = (ay - camera.y) / camera.height;
  return { x: ax - nextWidth * rx, y: ay - nextHeight * ry, width: nextWidth, height: nextHeight };
}

export function panCamera(camera, dx, dy) {
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}

export function clientToPlan(svg, clientX, clientY) {
  if (!svg || !svg.getScreenCTM) return null;
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  try {
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  } catch { return null; }
}

export function containingRoom(rooms, point) {
  if (!point) return null;
  return rooms.find((room) => {
    const [x, y, width, height] = room.rect;
    return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
  }) || null;
}

export function clampPlacement(placement, floor) {
  const [floorWidth, floorHeight] = floor.extent || [4000, 1440];
  const width = Math.max(18, Number(placement.width) || 60);
  const depth = Math.max(18, Number(placement.depth) || 60);
  return {
    ...placement,
    x: Math.max(0, Math.min(floorWidth - width, Number(placement.x) || 0)),
    y: Math.max(0, Math.min(floorHeight - depth, Number(placement.y) || 0)),
  };
}

export function renderEditorSvg({ floor, rooms = [], placements = [], selected = null,
  colorMode = 'use', camera = fitCamera(floor), measurement = null,
  editableRooms = false, roomDraft = null, placementGhost = null }) {
  const ves = veMap(rooms);
  const selectedType = selected?.type || '';
  const selectedId = selected?.id || '';
  return `<svg class="fpe-canvas" id="fpe-canvas" viewBox="${camera.x} ${camera.y} ${camera.width} ${camera.height}"
      preserveAspectRatio="xMidYMid meet" role="group"
      aria-label="Grundriss ${esc(floor.label)} mit ${rooms.length} Räumen und ${placements.length} Ausstattungsobjekten">
    <rect class="fpe-canvas__sheet" x="0" y="0" width="${floor.extent?.[0] || 4000}" height="${floor.extent?.[1] || 1440}"></rect>
    <g class="fpe-canvas__rooms">${rooms.map((room) => roomMarkup(room,
      selectedType === 'room' && selectedId === room.spaceId, colorMode, ves, editableRooms)).join('')}</g>
    <g class="fpe-canvas__placements">${placements.map((placement) => placementMarkup(placement,
      selectedType === 'placement' && selectedId === placement.placementId)).join('')}</g>
    ${placementGhostMarkup(placementGhost)}
    ${roomDraftMarkup(roomDraft)}
    ${measurementMarkup(measurement)}
  </svg>`;
}

export default {
  EDITOR_COLOR_MODES, renderEditorSvg, fitCamera, zoomCamera, panCamera,
  fitCameraToRect, scaleBar, clientToPlan, containingRoom, clampPlacement,
  distanceMetres, areaSquareMetres,
};
