// Building and floor navigation for the standalone editor.
// This is intentionally separate from the plan workbench: the two views have
// independent state, markup and event lifecycles.

import { floorplanEditor } from '../links.js';
import {
  BASE, PLAN_STATUS, address, area, clean, editorHeaderHTML, number, prototypeFooterHTML,
} from './shared.js';

export function planningObjects(core) {
  return (core.data.workspacePlanning || []).map((planning) => {
    const building = core.building(planning.buildingId);
    const floors = core.floorsForBuilding(planning.buildingId).sort((a, b) => a.level - b.level);
    return building && floors.length ? { building, floors, planning } : null;
  }).filter(Boolean).sort((left, right) => {
    const planned = Number(right.planning.planAvailability === 'planned') - Number(left.planning.planAvailability === 'planned');
    return planned || left.building.name.localeCompare(right.building.name, 'de');
  });
}

export function planningFloor(planning, floorId) {
  return (planning?.floors || []).find((entry) => entry.floorId === floorId) || {
    floorId, planStatus: 'inventory', equipmentCount: null, lastSync: '',
  };
}

function floorNavigationFacts(core, object, floor) {
  const spaces = core.spacesForFloor(floor.floorId);
  const plan = planningFloor(object.planning, floor.floorId);
  return {
    spaces,
    plan,
    workplaces: spaces.reduce((sum, room) => sum + (Number(room.capacity) || 0), 0),
    traffic: spaces.filter((room) => room.sia === 'VF').reduce((sum, room) => sum + (Number(room.area) || 0), 0),
  };
}

function planBadgeHTML(C, plan) {
  const status = PLAN_STATUS[plan.planStatus] || PLAN_STATUS.inventory;
  return C.badge(status.label, status.variant, 'sm');
}

function floorPreviewHTML(C, floor, spaces) {
  const rects = spaces.map((room) => room.rect).filter((rect) => Array.isArray(rect) && rect.length === 4);
  if (!rects.length) return '<div class="fpe-nav-preview fpe-nav-preview--empty">Keine Geometrie</div>';
  const minX = Math.min(...rects.map(([x]) => Number(x)));
  const minY = Math.min(...rects.map(([, y]) => Number(y)));
  const maxX = Math.max(...rects.map(([x, , width]) => Number(x) + Number(width)));
  const maxY = Math.max(...rects.map(([, y, , height]) => Number(y) + Number(height)));
  const pad = Math.max(30, Math.round(Math.max(maxX - minX, maxY - minY) * .025));
  return `<div class="fpe-nav-preview"><svg viewBox="${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}" role="img" aria-label="Vorschau ${C.escape(floor.label)}">
    ${rects.map(([x, y, width, height]) => `<rect x="${Number(x)}" y="${Number(y)}" width="${Number(width)}" height="${Number(height)}"></rect>`).join('')}
  </svg></div>`;
}

export function renderNavigation(ctx, objects, object = null, message = '') {
  const { mount, query, core, session, C, onUnmount, setTitle } = ctx;
  const floorView = !!object;
  const defaultObject = objects.find((entry) => entry.planning.planAvailability === 'planned') || objects[0];
  const inspectedObject = object || defaultObject;
  const requestedPick = query.get('pick') || '';
  const pickedFloor = floorView
    ? object.floors.find((entry) => entry.floorId === requestedPick)
      || object.floors.find((entry) => entry.key === '2og') || object.floors[0]
    : null;
  const pickedFacts = pickedFloor ? floorNavigationFacts(core, object, pickedFloor) : null;
  const allFloorCount = objects.reduce((sum, entry) => sum + entry.floors.length, 0);
  const routeForPick = (floorId) => `${floorplanEditor(object.building.bbl_id)}&pick=${encodeURIComponent(floorId)}`;
  const targetDate = object?.planning.targetDate
    ? object.planning.targetDate.split('-').reverse().join('.') : '';

  const railLink = ({ label, count, href, active = false }) => {
    const content = `<span>${C.escape(label)}</span><span class="fpe-nav-rail__count">${number(count)}</span>`;
    return `<a class="fpe-nav-rail__item${active ? ' is-active' : ''}" href="${href}"${active ? ' aria-current="page"' : ''}>${content}</a>`;
  };

  const rail = `<nav class="fpe-nav-rail" aria-label="Bereiche">
    ${railLink({ label: 'Aktive Geschosse', count: floorView ? object.floors.length : allFloorCount,
      href: floorplanEditor(inspectedObject.building.bbl_id), active: floorView })}
    ${railLink({ label: 'Gebäude', count: objects.length, href: BASE, active: !floorView })}
    ${floorView ? `<div class="fpe-nav-order"><p class="fpe-overline">Auftrag</p>
      <p class="mono">${C.escape(object.planning.inventoryOrder || 'Nicht zugeordnet')}</p>
      ${object.planning.planAvailability === 'planned' ? C.badge('CAD-Planung in Arbeit', 'warning', 'sm') : C.badge('Bestandsgrundriss', 'gray', 'sm')}
    </div>` : ''}
  </nav>`;

  let rows = '';
  let inspector = '';
  if (floorView) {
    rows = object.floors.map((floor) => {
      const facts = floorNavigationFacts(core, object, floor);
      const selected = floor.floorId === pickedFloor.floorId;
      const status = PLAN_STATUS[facts.plan.planStatus] || PLAN_STATUS.inventory;
      return `<tr role="row" class="fpe-nav-row${selected ? ' is-selected' : ''}" data-nav-row data-nav-href="${routeForPick(floor.floorId)}"
        data-search="${C.escape(clean(`${floor.label} ${floor.floorId} ${status.label} ${facts.plan.lastSync}`))}"
        data-sort-name="${C.escape(String(floor.level).padStart(4, '0'))}" data-sort-status="${C.escape(status.label)}" aria-selected="${selected}">
        <th scope="row" role="rowheader"><a href="${routeForPick(floor.floorId)}"><span class="mono">${C.escape(floor.floorId)}</span><strong>${C.escape(floor.label)}</strong></a></th>
        <td role="cell">${C.escape(facts.plan.lastSync || '—')}</td><td role="cell" class="text-right"><span class="fpe-nav-mobile-label" aria-hidden="true">HNF: </span>${area(floor.areaHnf)}</td>
        <td role="cell" class="text-right">${number(facts.workplaces)}</td><td role="cell" class="text-right">${facts.plan.equipmentCount == null ? '—' : number(facts.plan.equipmentCount)}</td>
        <td role="cell">${planBadgeHTML(C, facts.plan)}</td>
      </tr>`;
    }).join('');
    inspector = `<aside class="fpe-nav-inspector" aria-label="Inspektor">
      <div class="fpe-nav-inspector__title"><p>${C.escape(pickedFloor.label)} · ${C.escape(pickedFloor.floorId)}</p><small>${C.escape(object.building.name)}</small></div>
      ${floorPreviewHTML(C, pickedFloor, pickedFacts.spaces)}
      <section class="fpe-inspector-section"><h2>Kennzahlen des Geschosses</h2><div class="fpe-kpis">
        <div><small>Geschossfläche</small><strong>${area(pickedFloor.areaGross)}</strong></div><div><small>Hauptnutzfläche</small><strong>${area(pickedFloor.areaHnf)}</strong></div>
        <div><small>Arbeitsplätze</small><strong>${number(pickedFacts.workplaces)}</strong></div><div><small>Ausstattung</small><strong>${pickedFacts.plan.equipmentCount == null ? '—' : number(pickedFacts.plan.equipmentCount)}</strong></div>
        <div><small>Räume</small><strong>${number(pickedFacts.spaces.length)}</strong></div><div><small>Verkehrsfläche</small><strong>${area(pickedFacts.traffic)}</strong></div>
      </div></section>
      <section class="fpe-inspector-section"><h2>Attribute</h2><dl class="fpe-kv">
        <dt>Geschoss-ID</dt><dd class="mono">${C.escape(pickedFloor.floorId)}</dd><dt>Gebäude</dt><dd class="mono">${C.escape(object.building.bbl_id)}</dd>
        <dt>Adresse</dt><dd>${C.escape(address(object.building))}</dd>${targetDate ? `<dt>Stichtag</dt><dd>${C.escape(targetDate)}</dd>` : ''}
        <dt>Synchronisation</dt><dd>${C.escape(pickedFacts.plan.lastSync || 'nicht erfasst')}</dd><dt>Status</dt><dd>${planBadgeHTML(C, pickedFacts.plan)}</dd>
      </dl><a class="btn btn--filled btn--sm btn--icon-right" id="fpe-open-floor" href="${floorplanEditor(object.building.bbl_id, pickedFloor.floorId)}">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Im Editor öffnen</span></a></section>
    </aside>`;
  } else {
    rows = objects.map((entry) => {
      const floorSpaces = entry.floors.flatMap((floor) => core.spacesForFloor(floor.floorId));
      const hnf = entry.floors.reduce((sum, floor) => sum + Number(floor.areaHnf || 0), 0);
      const workplaces = floorSpaces.reduce((sum, room) => sum + (Number(room.capacity) || 0), 0);
      const href = floorplanEditor(entry.building.bbl_id);
      const selected = entry === inspectedObject;
      return `<tr role="row" class="fpe-nav-row${selected ? ' is-selected' : ''}" data-nav-row data-nav-href="${href}"
        data-search="${C.escape(clean(`${entry.building.name} ${entry.building.bbl_id} ${address(entry.building)} ${entry.building.occupants || ''}`))}"
        data-sort-name="${C.escape(clean(entry.building.name))}" data-sort-status="${C.escape(entry.planning.planAvailability)}" aria-selected="${selected}">
        <th scope="row" role="rowheader"><a href="${href}"><strong>${C.escape(entry.building.name)}</strong><span class="mono">${C.escape(entry.building.bbl_id)}</span></a></th>
        <td role="cell">${C.escape(entry.building.city || '—')}</td><td role="cell" class="text-right"><span class="fpe-nav-mobile-label" aria-hidden="true">Geschosse: </span>${number(entry.floors.length)}</td><td role="cell" class="text-right">${area(hnf)}</td>
        <td role="cell" class="text-right">${number(workplaces)}</td><td role="cell">${entry.planning.planAvailability === 'planned' ? C.badge('Multispace geplant', 'success', 'sm') : C.badge('Bestand', 'gray', 'sm')}</td>
      </tr>`;
    }).join('');
    const inspectedFloors = inspectedObject.floors;
    const inspectedHnf = inspectedFloors.reduce((sum, floor) => sum + Number(floor.areaHnf || 0), 0);
    inspector = `<aside class="fpe-nav-inspector" aria-label="Inspektor">
      <div class="fpe-nav-inspector__title"><p>${C.escape(inspectedObject.building.name)}</p><small class="mono">${C.escape(inspectedObject.building.bbl_id)}</small></div>
      <section class="fpe-inspector-section"><h2>Gebäudekennzahlen</h2><div class="fpe-kpis">
        <div><small>Aktive Geschosse</small><strong>${number(inspectedFloors.length)}</strong></div><div><small>Hauptnutzfläche</small><strong>${area(inspectedHnf)}</strong></div>
      </div></section>
      <section class="fpe-inspector-section"><h2>Attribute</h2><dl class="fpe-kv"><dt>Gebäude-ID</dt><dd class="mono">${C.escape(inspectedObject.building.bbl_id)}</dd>
        <dt>Adresse</dt><dd>${C.escape(address(inspectedObject.building))}</dd><dt>Nutzende</dt><dd>${C.escape(inspectedObject.building.occupants || 'nicht erfasst')}</dd>
      </dl><a class="btn btn--filled btn--sm btn--icon-right" id="fpe-open-building" href="${floorplanEditor(inspectedObject.building.bbl_id)}">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Geschosse öffnen</span></a></section>
    </aside>`;
  }

  const title = floorView ? `Geschosse — ${object.building.name}` : 'Alle Objekte';
  const count = floorView ? object.floors.length : objects.length;
  const columns = floorView
    ? '<th scope="col" role="columnheader">Geschoss</th><th scope="col" role="columnheader">Letzte Änderung</th><th scope="col" role="columnheader" class="text-right">HNF</th><th scope="col" role="columnheader" class="text-right">Arbeitsplätze</th><th scope="col" role="columnheader" class="text-right">Ausstattung</th><th scope="col" role="columnheader">Planstand</th>'
    : '<th scope="col" role="columnheader">Gebäude</th><th scope="col" role="columnheader">Ort</th><th scope="col" role="columnheader" class="text-right">Geschosse</th><th scope="col" role="columnheader" class="text-right">HNF</th><th scope="col" role="columnheader" class="text-right">Arbeitsplätze</th><th scope="col" role="columnheader">Planung</th>';

  setTitle(floorView ? `Plan-Editor — Geschosse ${object.building.name}` : 'Plan-Editor — Gebäude');
  mount.innerHTML = `<div class="fpe-app fpe-nav-app" id="fpe-navigation" data-view="${floorView ? 'floors' : 'buildings'}">
    <h1 class="sr-only" tabindex="-1">Plan-Editor — ${C.escape(title)}</h1>
    ${editorHeaderHTML(C, session)}
    <div class="fpe-context fpe-nav-context">
      <span class="fpe-nav-context__title">${C.escape(title)} <span id="fpe-nav-count">${number(count)}</span></span>
      <span class="fpe-context__spacer"></span>
      <label class="fpe-nav-search"><span class="sr-only">${floorView ? 'Geschosse' : 'Gebäude'} durchsuchen</span>${C.icon('Search', 'icon--base')}<input id="fpe-nav-search" type="search" placeholder="Suchen…"></label>
      <label class="fpe-nav-sort"><span class="sr-only">Sortieren</span><select id="fpe-nav-sort" class="input--outline input--sm"><option value="name">Sortieren: Name</option><option value="status">Sortieren: Status</option></select></label>
    </div>
    ${message ? `<div class="fpe-nav-message">${C.notificationHtml(`<p class="m-0">${C.escape(message)}</p>`, 'warning', 'WarningCircle')}</div>` : ''}
    <div class="fpe-nav-layout">${rail}<main class="fpe-nav-main" data-scroll-region aria-label="${floorView ? 'Aktive Geschosse' : 'Gebäude'}">
      <div class="fpe-nav-table"><table class="table" role="table"><caption class="sr-only">${floorView ? `Aktive Geschosse von ${C.escape(object.building.name)}` : 'Gebäude im Plan-Editor'}</caption><thead role="rowgroup"><tr role="row">${columns}</tr></thead><tbody id="fpe-nav-rows" role="rowgroup">${rows}</tbody></table></div>
      <p class="fpe-panel-empty" id="fpe-nav-empty" hidden>Keine passenden ${floorView ? 'Geschosse' : 'Gebäude'} gefunden.</p>
    </main>${inspector}</div>
    ${prototypeFooterHTML()}
  </div>`;

  const filterRows = () => {
    const term = clean(mount.querySelector('#fpe-nav-search')?.value);
    const rows = [...mount.querySelectorAll('[data-nav-row]')];
    let visible = 0;
    rows.forEach((row) => { row.hidden = !!term && !row.dataset.search.includes(term); if (!row.hidden) visible++; });
    const countNode = mount.querySelector('#fpe-nav-count');
    if (countNode) countNode.textContent = number(visible);
    const empty = mount.querySelector('#fpe-nav-empty');
    if (empty) empty.hidden = visible > 0;
  };
  const sortRows = () => {
    const key = mount.querySelector('#fpe-nav-sort')?.value === 'status' ? 'sortStatus' : 'sortName';
    const body = mount.querySelector('#fpe-nav-rows');
    if (!body) return;
    [...body.querySelectorAll('[data-nav-row]')]
      .sort((left, right) => left.dataset[key].localeCompare(right.dataset[key], 'de', { numeric: true }))
      .forEach((row) => body.append(row));
  };
  const abort = new AbortController();
  const { signal } = abort;
  mount.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="focus-search"]')) mount.querySelector('#fpe-nav-search')?.focus();
    const row = event.target.closest('[data-nav-href]');
    if (row && !event.target.closest('a,button,input,select')) location.hash = row.dataset.navHref;
  }, { signal });
  mount.addEventListener('input', (event) => { if (event.target.id === 'fpe-nav-search') filterRows(); }, { signal });
  mount.addEventListener('change', (event) => { if (event.target.id === 'fpe-nav-sort') sortRows(); }, { signal });
  onUnmount(() => abort.abort());
}
