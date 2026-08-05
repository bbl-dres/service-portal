// Workspace Management: workplace capacity, allocation, and planning scenarios.

import { ANWENDUNGEN, trail } from '../crumbs.js';
import { floorplanSvg, floorplanLegend, wireFloorplan } from '../floorplan.js';
import { m2, num } from '../format.js';

export const needs = ['buildings', 'floors', 'spaces'];

const PREFERRED_BUILDING = '1080/6650/AA';
const FACTORS = [
  { value: '0.60', label: '0.60 Arbeitsplätze pro Person' },
  { value: '0.70', label: '0.70 Arbeitsplätze pro Person' },
  { value: '0.80', label: '0.80 Arbeitsplätze pro Person' },
  { value: '0.90', label: '0.90 Arbeitsplätze pro Person' },
  { value: '1.00', label: '1.00 Arbeitsplätze pro Person' },
];
const COLOR_MODES = [
  { value: 've', label: 'Verwaltungseinheit' },
  { value: 'use', label: 'Nutzung' },
  { value: 'capacity', label: 'Belegungsdichte' },
];

const sum = (rows, value) => rows.reduce((total, row) => total + (value(row) || 0), 0);

export default async function render(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs, onUnmount } = ctx;
  setTitle('Workspace Management');
  setCrumbs(trail(ANWENDUNGEN, { label: 'Workspace Management' }));

  const floorsByBuilding = new Map();
  for (const floor of core.floors()) {
    const rows = floorsByBuilding.get(floor.buildingId) || [];
    rows.push(floor);
    floorsByBuilding.set(floor.buildingId, rows);
  }
  for (const rows of floorsByBuilding.values()) rows.sort((a, b) => a.level - b.level);

  const buildings = core.buildings()
    .filter((building) => {
      const floors = floorsByBuilding.get(building.bbl_id) || [];
      return floors.some((floor) => sum(core.spacesForFloor(floor.floorId), (space) => space.capacity) > 0);
    })
    .sort((a, b) => `${a.land} ${a.city} ${a.name}`.localeCompare(`${b.land} ${b.city} ${b.name}`, 'de'));

  if (!buildings.length) {
    mount.innerHTML = `<div class="container section">
      ${C.pageHeader({ title: 'Workspace Management', lead: 'Arbeitsplätze und Büroflächen planen.' })}
      ${C.empty('Für die Arbeitsplatzplanung sind keine Geschossdaten verfügbar.', { available: core.available('floors') && core.available('spaces') })}
    </div>`;
    return;
  }

  const requestedBuilding = query.get('building');
  const defaultBuilding = buildings.find((building) => building.bbl_id === PREFERRED_BUILDING) || buildings[0];
  const initialBuilding = buildings.find((building) => building.bbl_id === requestedBuilding) || defaultBuilding;
  const initialFloors = floorsByBuilding.get(initialBuilding.bbl_id) || [];
  const requestedFloor = query.get('floor');
  const requestedColor = query.get('color');

  const state = {
    buildingId: initialBuilding.bbl_id,
    floorId: initialFloors.some((floor) => floor.floorId === requestedFloor) ? requestedFloor : initialFloors[0].floorId,
    colorMode: COLOR_MODES.some((mode) => mode.value === requestedColor) ? requestedColor : 've',
    people: 0,
    factor: 0.8,
    selectedSpaceId: '',
  };

  const building = () => buildings.find((item) => item.bbl_id === state.buildingId) || buildings[0];
  const floors = () => floorsByBuilding.get(state.buildingId) || [];
  const spacesFor = (floorId) => core.spacesForFloor(floorId);
  const allSpaces = () => floors().flatMap((floor) => spacesFor(floor.floorId));
  const workplaceCount = () => sum(allSpaces(), (space) => space.capacity);
  state.people = Math.max(1, Math.floor(workplaceCount() / state.factor));

  function workspaceUrl(buildingId, floorId, colorMode = state.colorMode) {
    const params = new URLSearchParams({ building: buildingId, floor: floorId });
    if (colorMode !== 've') params.set('color', colorMode);
    return `#/app/workspace?${params.toString()}`;
  }

  function floorFacts(floor) {
    const spaces = spacesFor(floor.floorId);
    const workspaces = sum(spaces, (space) => space.capacity);
    const workArea = sum(spaces.filter((space) => space.group === 'arbeit'), (space) => space.area);
    const allocatedArea = sum(spaces.filter((space) => space.occupierVe), (space) => space.area);
    const totalArea = sum(spaces, (space) => space.area);
    const organizations = [...new Set(spaces.map((space) => space.occupierVe).filter(Boolean))].sort();
    return {
      ...floor,
      spaces,
      workspaces,
      workArea,
      allocatedPercent: totalArea ? Math.round(allocatedArea / totalArea * 100) : 0,
      organizations,
    };
  }

  function allocationBadge(percent) {
    if (percent >= 95) return C.badge(`${percent} % zugeteilt`, 'success', 'sm');
    if (percent >= 75) return C.badge(`${percent} % zugeteilt`, 'info', 'sm');
    return C.badge(`${percent} % zugeteilt`, 'warning', 'sm');
  }

  function planResult() {
    const available = workplaceCount();
    const required = Math.ceil(state.people * state.factor);
    const delta = available - required;
    const use = available ? Math.round(required / available * 100) : 0;
    const balanced = Math.max(2, Math.ceil(available * 0.03));
    const status = delta < 0
      ? { label: `${num(Math.abs(delta))} Arbeitsplätze fehlen`, variant: 'error' }
      : delta <= balanced
        ? { label: 'Planung ausgeglichen', variant: 'info' }
        : { label: `${num(delta)} Arbeitsplätze Reserve`, variant: 'success' };
    return { available, required, delta, use, status };
  }

  function resultMarkup(result) {
    const difference = result.delta === 0 ? '0'
      : result.delta > 0 ? `+${num(result.delta)}` : `−${num(Math.abs(result.delta))}`;
    return `
      <div class="workspace-plan__status">${C.badge(result.status.label, result.status.variant)}</div>
      <dl class="kv workspace-plan__facts">
        <dt>Erforderliche Arbeitsplätze</dt><dd>${num(result.required)}</dd>
        <dt>Verfügbare Arbeitsplätze</dt><dd>${num(result.available)}</dd>
        <dt>Differenz</dt><dd>${difference}</dd>
        <dt>Kapazitätsbedarf</dt><dd>${result.use} %</dd>
      </dl>
      <div class="workspace-capacity" role="progressbar" aria-label="Kapazitätsbedarf" aria-valuemin="0"
        aria-valuemax="100" aria-valuenow="${Math.min(result.use, 100)}">
        <span class="workspace-capacity__bar${result.delta < 0 ? ' workspace-capacity__bar--over' : ''}"
          style="width:${Math.min(result.use, 100)}%"></span>
      </div>
      <p class="small muted m-0">Der Zielwert berechnet die benötigten Arbeitsplätze aus Mitarbeitenden und Desk-Sharing-Faktor.</p>`;
  }

  function roomPanel(space) {
    if (!space) {
      return `<div class="box fp-room fp-room--empty"><p class="small muted m-0">Wählen Sie einen Raum im Grundriss, um seine Planungsdaten zu sehen.</p></div>`;
    }
    return `<div class="box fp-room">
      <h3>${C.escape(space.roomNumber)}</h3>
      <dl class="kv kv--tight">
        <dt>Nutzung</dt><dd>${C.escape(space.useLabel)}</dd>
        <dt>Fläche</dt><dd>${m2(space.area)}</dd>
        <dt>Arbeitsplätze</dt><dd>${num(space.capacity || 0)}</dd>
        <dt>Verwaltungseinheit</dt><dd>${C.escape(space.occupierVe || 'Nicht zugeteilt')}</dd>
      </dl>
    </div>`;
  }

  function floorplanView(activeFloor) {
    const spaces = activeFloor.spaces;
    const selected = spaces.find((space) => space.spaceId === state.selectedSpaceId) || null;
    const modeLabel = (COLOR_MODES.find((mode) => mode.value === state.colorMode) || {}).label || '';
    return `<div id="fp-wrap">
      <div class="fp-head workspace-floorplan__head">
        <div class="fp-head__top">
          <div class="fp-floors" role="group" aria-label="Geschoss wechseln">
            ${floors().map((floor) => {
              const active = floor.floorId === activeFloor.floorId;
              return `<a class="tag-item${active ? ' tag-item--active' : ''}"
                href="${workspaceUrl(state.buildingId, floor.floorId)}"${active ? ' aria-current="true"' : ''}>
                <span class="tag-item__inner"><span class="tag-item__text">${C.escape(floor.label)}</span></span></a>`;
            }).join('')}
          </div>
          ${C.select({ id: 'workspace-color', label: 'Einfärben nach', value: state.colorMode,
            size: 'sm', wrapClass: 'fp-color', options: COLOR_MODES })}
        </div>
      </div>
      <div class="fp-viewer">
        <div class="fp-stage" id="workspace-floorplan" data-scroll-region
          aria-label="Grundriss ${C.escape(activeFloor.label)}">${floorplanSvg({
            floor: activeFloor, spaces, mode: state.colorMode, selectedId: state.selectedSpaceId,
          })}</div>
        <div class="fp-side">
          <dl class="kv kv--tight fp-facts">
            <dt>Räume</dt><dd>${num(activeFloor.rooms)}</dd>
            <dt>Hauptnutzfläche</dt><dd>${m2(activeFloor.areaHnf)}</dd>
            <dt>Arbeitsplätze</dt><dd>${num(activeFloor.workspaces)}</dd>
            <dt>Zuteilung</dt><dd>${activeFloor.allocatedPercent} %</dd>
          </dl>
          <div>
            <h3 class="fp-side__title">Einfärbung: ${C.escape(modeLabel)}</h3>
            ${floorplanLegend(spaces, state.colorMode)}
          </div>
          <div id="workspace-room">${roomPanel(selected)}</div>
        </div>
      </div>
    </div>`;
  }

  function draw() {
    const currentBuilding = building();
    const floorRows = floors().map(floorFacts);
    const activeFloor = floorRows.find((floor) => floor.floorId === state.floorId) || floorRows[0];
    const spaces = allSpaces();
    const workArea = sum(spaces.filter((space) => space.group === 'arbeit'), (space) => space.area);
    const organizations = [...new Set(spaces.map((space) => space.occupierVe).filter(Boolean))];
    const initialResult = planResult();

    const floorTable = C.table({
      caption: `Geschosse ${currentBuilding.name}`,
      columns: [
        { key: 'label', label: 'Geschoss', render: (floor) => `<a href="${workspaceUrl(state.buildingId, floor.floorId)}">${C.escape(floor.label)}</a>${floor.floorId === activeFloor.floorId ? ` ${C.badge('Ausgewählt', 'info', 'sm')}` : ''}` },
        { key: 'rooms', label: 'Räume', align: 'right', render: (floor) => num(floor.rooms) },
        { key: 'workArea', label: 'Arbeitsfläche', align: 'right', render: (floor) => m2(Math.round(floor.workArea)) },
        { key: 'workspaces', label: 'Arbeitsplätze', align: 'right', render: (floor) => num(floor.workspaces) },
        { key: 'organizations', label: 'Verwaltungseinheiten', render: (floor) => C.escape(floor.organizations.join(', ') || 'Nicht zugeteilt') },
        { key: 'allocatedPercent', label: 'Zuteilung', render: (floor) => allocationBadge(floor.allocatedPercent) },
      ],
      rows: floorRows,
      zebra: true,
      foot: `<tr><th scope="row">Total</th><td class="text-right">${num(sum(floorRows, (floor) => floor.rooms))}</td>
        <td class="text-right">${m2(Math.round(workArea))}</td><td class="text-right">${num(workplaceCount())}</td>
        <td>${num(organizations.length)} Verwaltungseinheiten</td><td></td></tr>`,
    });

    mount.innerHTML = `<div class="container section">
      ${C.pageHeader({ title: 'Workspace Management', lead: 'Arbeitsplätze, Zonen und Flächen für die angeschlossenen Bürogebäude planen.' })}

      <section class="workspace-context" aria-labelledby="workspace-context-title">
        <div>
          <h2 class="sr-only" id="workspace-context-title">Planungsobjekt</h2>
          ${C.select({ id: 'workspace-building', label: 'Gebäude', value: state.buildingId,
            options: buildings.map((item) => ({ value: item.bbl_id, label: `${item.name} — ${item.city}` })) })}
          <p class="small muted workspace-context__address">${C.escape(currentBuilding.street)}, ${C.escape(currentBuilding.zip)} ${C.escape(currentBuilding.city)}</p>
        </div>
        <div class="workspace-context__meta">
          ${C.badge(`${num(floors().length)} Geschosse`, 'gray')}
          ${C.badge(`${num(organizations.length)} Verwaltungseinheiten`, 'gray')}
          <a class="btn btn--outline btn--sm btn--icon-right" href="#/app/portfolio?id=${encodeURIComponent(currentBuilding.bbl_id)}">
            <span class="btn__text">Gebäude im Portfolio</span>${C.icon('ArrowRight', 'btn__icon')}</a>
        </div>
      </section>

      <div class="stats workspace-stats" aria-label="Kennzahlen des Planungsobjekts">
        <div class="stat"><div class="stat__num">${num(workplaceCount())}</div><div class="stat__label">Arbeitsplätze</div></div>
        <div class="stat"><div class="stat__num" id="workspace-people-stat">${num(state.people)}</div><div class="stat__label">Mitarbeitende im Szenario</div></div>
        <div class="stat"><div class="stat__num">${m2(Math.round(workArea))}</div><div class="stat__label">Arbeitsfläche</div></div>
        <div class="stat"><div class="stat__num">${num(organizations.length)}</div><div class="stat__label">Verwaltungseinheiten</div></div>
      </div>

      <section class="workspace-section" aria-labelledby="workspace-scenario-title">
        <div class="container--grid gap--responsive">
          <div class="container__main vertical-spacing">
            <h2 id="workspace-scenario-title">Planungsszenario</h2>
            <p>Prüfen Sie, ob die vorhandene Arbeitsplatzkapazität für den geplanten Personalbestand und den Zielwert des Desk-Sharing-Faktors ausreicht.</p>
            <div class="grid grid--responsive-cols-2 workspace-plan__fields">
              ${C.field({ id: 'workspace-people', label: 'Zu planende Mitarbeitende', hint: 'Personalbestand am gewählten Standort.',
                control: (cls, attrs) => `<input id="workspace-people" type="number" min="1" max="9999" step="1" value="${state.people}" class="${cls}"${attrs}>` })}
              ${C.select({ id: 'workspace-factor', label: 'Ziel Desk-Sharing-Faktor', value: state.factor.toFixed(2),
                hint: 'Anzahl Arbeitsplätze pro Person.', options: FACTORS })}
            </div>
          </div>
          <aside class="container__aside" aria-labelledby="workspace-result-title">
            <div class="box workspace-plan__result" aria-live="polite">
              <h3 id="workspace-result-title">Planungsresultat</h3>
              <div id="workspace-result">${resultMarkup(initialResult)}</div>
            </div>
          </aside>
        </div>
      </section>

      <section class="workspace-section vertical-spacing" aria-labelledby="workspace-floors-title">
        <h2 id="workspace-floors-title">Geschosse und Zuteilung</h2>
        <p>Die Übersicht zeigt Kapazität und räumliche Zuteilung je Geschoss. Wählen Sie ein Geschoss für den Grundriss.</p>
        ${floorTable}
      </section>

      <section class="workspace-section vertical-spacing" aria-labelledby="workspace-plan-title">
        <h2 id="workspace-plan-title">Zonen im Grundriss</h2>
        ${floorplanView(activeFloor)}
      </section>
    </div>`;

    const buildingSelect = mount.querySelector('#workspace-building');
    if (buildingSelect) buildingSelect.addEventListener('change', () => {
      const nextFloors = floorsByBuilding.get(buildingSelect.value) || [];
      location.hash = workspaceUrl(buildingSelect.value, nextFloors[0].floorId);
    });

    const colorSelect = mount.querySelector('#workspace-color');
    if (colorSelect) colorSelect.addEventListener('change', () => {
      location.hash = workspaceUrl(state.buildingId, state.floorId, colorSelect.value);
    });

    const peopleInput = mount.querySelector('#workspace-people');
    const factorSelect = mount.querySelector('#workspace-factor');
    const updateScenario = () => {
      state.people = Math.max(1, Number(peopleInput?.value) || 1);
      state.factor = Number(factorSelect?.value) || 0.8;
      const result = planResult();
      const host = mount.querySelector('#workspace-result');
      const peopleStat = mount.querySelector('#workspace-people-stat');
      if (host) host.innerHTML = resultMarkup(result);
      if (peopleStat) peopleStat.textContent = num(state.people);
    };
    if (peopleInput) peopleInput.addEventListener('input', updateScenario);
    if (factorSelect) factorSelect.addEventListener('change', updateScenario);

    const stage = mount.querySelector('#workspace-floorplan');
    if (stage) {
      const unwire = wireFloorplan(stage, (spaceId) => {
        state.selectedSpaceId = spaceId;
        stage.querySelectorAll('[data-space]').forEach((group) => {
          const selected = group.dataset.space === spaceId;
          group.classList.toggle('is-selected', selected);
          group.querySelector('rect')?.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        const room = spacesFor(state.floorId).find((space) => space.spaceId === spaceId) || null;
        const roomHost = mount.querySelector('#workspace-room');
        if (roomHost) roomHost.innerHTML = roomPanel(room);
      });
      onUnmount(unwire);
    }
  }

  draw();
}
