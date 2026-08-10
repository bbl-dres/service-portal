// Building detail of the Plan-Editor landing page.
//
// The same anatomy as the property-inventory detail — breadcrumb, title, KPI
// strip, CD tabs, shared data tables, an action card in an aside — but asked
// from the space-management side. The inventory answers «what is this object»;
// this view answers «what state are its plans in and what do I open next», so
// every register ends in a floor.
//
// Four registers, because three things are easy to confuse and each answers a
// different question:
//   · Grundrisse  — the plans themselves, one row per floor;
//   · Module      — the Multispace modules, i.e. the predefined furniture setups
//                   a room is planned as;
//   · Ausstattung — the furniture actually standing in those rooms.
// Building services — access control, climate, network — sit inside rooms as
// well and are the next register to gain data; so are zones. The tab bar is
// built from a list for that reason.
//
// Floor-plan thumbnails appear on cards only, never in a table row: a preview is
// a picture of the thing, and a row is a line of facts. The floor-plan register
// therefore carries the portal's own view switch between the two.

import { floorplanEditor, planCheck } from '../links.js';
import { formatArea, formatNumber } from '../format.js';
import { countryName } from '../domain.js';
import { MODULE_OPTIONS, inferredModule } from './model.js';
import { BASE, PLAN_STATUS, breadcrumbBarHTML, clean, portfolioRoute } from './shared.js';
import { OBJECT_STATE } from './browse-view.js';

const list = (value) => Array.isArray(value) ? value : [];
const number = (value) => formatNumber(value);
const area = (value) => formatArea(value, { maximumFractionDigits: 1 });

export const OBJECT_TABS = Object.freeze(['overview', 'plans', 'modules', 'equipment']);
export const PLAN_VIEWS = Object.freeze(['list', 'cards']);
// The list is the default: a floor is chosen by its facts — area, rooms, plan
// state — and a wall of thumbnails answers none of those.
export const DEFAULT_PLAN_VIEW = 'list';

// German query values are the public link contract, as in the inventory, so they
// are quoted compatibility literals rather than identifiers. `ausstattungen` is
// the former name of the combined register and resolves to the module standard,
// which is what it mostly showed.
const TAB_BY_QUERY = Object.freeze({
  'uebersicht': 'overview',
  'grundrisse': 'plans',
  'module': 'modules',
  'ausstattung': 'equipment',
  'ausstattungen': 'modules',
});
const QUERY_BY_TAB = Object.freeze({
  overview: 'uebersicht', plans: 'grundrisse', modules: 'module', equipment: 'ausstattung',
});

export function objectTab(value) {
  return TAB_BY_QUERY[String(value || '')] || 'overview';
}

export function objectTabQuery(tab) {
  return QUERY_BY_TAB[tab] || 'uebersicht';
}

export function planView(value) {
  return PLAN_VIEWS.includes(String(value || '')) ? String(value) : DEFAULT_PLAN_VIEW;
}

/**
 * The building detail addressed by register. `mark` points at one floor without
 * opening it — the structure tree hands over that way, and `floor` cannot serve
 * for it because that key opens the workbench.
 */
export function objectRoute(id, { tab = 'overview', plans = '', mark = '' } = {}) {
  const params = new URLSearchParams({ building: String(id) });
  if (tab && tab !== 'overview') params.set('tab', objectTabQuery(tab));
  if (plans && plans !== DEFAULT_PLAN_VIEW) params.set('plans', plans);
  if (mark) params.set('mark', String(mark));
  return `${BASE}?${params}`;
}

// --- Registers derived from the object ---------------------------------------

/** Multispace module counts as planned, with each group's share of the total. */
export function equipmentGroups(planning) {
  const groups = list(planning?.equipmentGroups)
    .map((group) => ({
      number: Number(group?.number) || 0,
      name: String(group?.name || ''),
      count: Number(group?.count) || 0,
    }));
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  return {
    total,
    rows: groups.map((group) => ({
      ...group,
      share: total ? Math.round((group.count / total) * 100) : 0,
    })),
  };
}

/**
 * Which modules this object's rooms represent. The golden record carries no
 * approved assignment, so this reports the editor's own derivation from the room
 * use type — the same mapping the workbench preselects with — rather than a
 * second, competing one. `planned` is the count from an accepted Multispace
 * planning where one exists.
 */
export function moduleRows(rooms, planning) {
  const plannedByNumber = new Map(equipmentGroups(planning).rows
    .map((group) => [String(group.number), group.count]));
  const byModule = new Map();
  for (const room of list(rooms)) {
    const id = String(room?.moduleId || inferredModule(room?.useType) || '');
    if (!id) continue;
    const bucket = byModule.get(id) || { rooms: 0, area: 0, workplaces: 0 };
    bucket.rooms += 1;
    bucket.area += Number(room?.area) || 0;
    bucket.workplaces += Number(room?.capacity) || 0;
    byModule.set(id, bucket);
  }
  return MODULE_OPTIONS
    .map((option) => ({
      number: Number(option.value),
      name: option.name,
      planned: plannedByNumber.get(option.value) ?? null,
      ...(byModule.get(option.value) || { rooms: 0, area: 0, workplaces: 0 }),
    }))
    .filter((row) => row.rooms || row.planned);
}

/** Furniture actually recorded per floor; `null` where a floor has no record. */
export function furnitureRows(entry) {
  return list(entry?.floors).filter((floor) => floor.equipmentCount != null);
}

function planStateBadge(C, entry) {
  const state = OBJECT_STATE[entry.planState];
  return C.badge(state.label, state.variant, 'sm');
}

// --- Overview register -------------------------------------------------------

function overviewPanel(C, { entry, planning, building, previewFor }) {
  const availability = {
    planned: 'CAD-Planung in Arbeit',
    legacy: 'Bestandsgrundriss',
  }[planning?.planAvailability] || 'Bestandsgrundriss';
  const contacts = list(planning?.contacts)
    .map((contact) => ({ label: contact.label, email: contact.email }));

  // Two actions only. Everything else this object can be looked at through — the
  // inventory, the workspace portal, the media library — is a different app's
  // answer to a different question, and a list of six links reads as a menu
  // rather than as the two things there are to do here.
  const topFloor = entry.floors[0]?.floorId || '';
  const actions = [
    { label: 'Im Editor öffnen', href: floorplanEditor(entry.id, topFloor) },
    { label: 'Neuen Plan hochladen', href: planCheck(entry.id), newWindow: true },
  ];

  return `<div class="detail-layout"><div>
    ${/* Quick jump into any floor. It lives in this register rather than above
          the tabs, so it never stands beside the floor-plan gallery showing the
          same thumbnails twice. */''}
    <h3 class="detail-section__title">Geschosse</h3>
    <nav class="fpe-object__strip" aria-label="Geschosse dieses Objekts">
      ${entry.floors.map((floor) => `<a class="fpe-object__strip-item" href="${floorplanEditor(entry.id, floor.floorId)}">
        ${previewFor(floor)}<span class="fpe-object__strip-label">${C.escape(floor.label)}</span>
      </a>`).join('')}
    </nav>

    <h3 class="detail-section__title mt-6">Eckdaten</h3>
    <dl class="kv">
      <dt>BBL-ID</dt><dd class="mono">${C.escape(entry.id)}</dd>
      <dt>Wirtschaftseinheit (WE)</dt><dd>${C.escape(building?.businessEntityId || '—')}</dd>
      <dt>Adresse</dt><dd>${C.escape(entry.address)}</dd>
      <dt>Nutzer</dt><dd>${C.escape(entry.occupants || 'nicht erfasst')}</dd>
      <dt>Geschosse</dt><dd>${number(entry.floors.length)}</dd>
      <dt>Räume</dt><dd>${number(entry.rooms)}</dd>
      <dt>Hauptnutzfläche (HNF)</dt><dd>${area(entry.areaHnf)}</dd>
      <dt>Arbeitsplätze</dt><dd>${number(entry.workplaces)}</dd>
      <dt>Planverfügbarkeit</dt><dd>${C.escape(availability)}</dd>
      <dt>Planstand</dt><dd>${planStateBadge(C, entry)}</dd>
    </dl>

    <h3 class="detail-section__title mt-6">Planübernahme</h3>
    <dl class="kv">
      <dt>Auftrag</dt><dd>${planning?.inventoryOrder
        ? `<span class="mono">${C.escape(planning.inventoryOrder)}</span>` : 'kein offener Auftrag'}</dd>
      ${planning?.projectId ? `<dt>Projekt</dt><dd class="mono">${C.escape(planning.projectId)}</dd>` : ''}
      <dt>Stichtag</dt><dd>${entry.targetDate
        ? C.escape(entry.targetDate.split('-').reverse().join('.')) : '—'}</dd>
      <dt>Nicht synchronisiert</dt><dd>${entry.stale
        ? `${number(entry.stale)} von ${number(entry.floors.length)} Geschossen`
        : 'keine Abweichung'}</dd>
    </dl>
  </div>
  <aside class="detail-layout__aside" aria-label="Aktionen und Ansprechpersonen">
    ${C.actionCard({ lead: 'Für dieses Objekt vorbelegt.', links: actions })}
    ${C.contactCard({ contacts })}
  </aside></div>`;
}

// --- The bar every register carries ------------------------------------------

/**
 * One catalogue bar per register — search, sort, and the view switch where a
 * register has two surfaces. Every collection in this view is searched and
 * sorted through the same control, so nothing has to be explained in prose
 * underneath it. The ids follow `C.wireCatalogueState`, which the portfolio
 * already uses, so the wiring is the portal's and not a local rebuild.
 */
function registerBar(C, {
  id, label, placeholder, q, sort, sorts, count, view = '', views = null,
}) {
  return C.catalogueBar({
    formId: `${id}-search`, inputId: `${id}-q`, searchLabel: label, placeholder, q,
    countId: `${id}-count`, count,
    sort: { id: `${id}-sort`, value: sort, options: sorts },
    ...(views ? { view, views } : {}),
  });
}

// --- Grundrisse --------------------------------------------------------------

function floorCardHTML(C, entry, floor, previewHTML, marked) {
  const status = PLAN_STATUS[floor.planStatus] || PLAN_STATUS.inventory;
  return `<li class="fpe-floor-card${marked ? ' is-marked' : ''}">
    <a class="fpe-floor-card__link" href="${floorplanEditor(entry.id, floor.floorId)}"${
      marked ? ' aria-current="location"' : ''}>
      <span class="fpe-floor-card__media">${previewHTML}</span>
      <span class="fpe-floor-card__body">
        <span class="fpe-floor-card__label">${C.escape(floor.label)}</span>
        <span class="fpe-floor-card__facts">${area(floor.areaHnf)} HNF · ${number(floor.rooms)} Räume · ${number(floor.workplaces)} AP</span>
        <span class="fpe-floor-card__sync">${floor.lastSync
          ? `Stand ${C.escape(floor.lastSync)}` : 'kein Synchronisierungsdatum'}</span>
        <span class="fpe-floor-card__state">${C.badge(status.label, status.variant, 'sm')}</span>
      </span>
    </a>
    <a class="btn btn--outline btn--sm fpe-floor-card__check" href="${C.escape(planCheck(entry.id, floor.floorId))}"
      target="_blank" rel="noopener noreferrer"><span class="btn__text">Planprüfung</span></a>
  </li>`;
}

/** Rows for the Grundrisse table — facts only, no thumbnail. */
export function floorColumns(C, entry, mark = '') {
  return [
    {
      key: 'label',
      label: 'Geschoss',
      render: (floor) => `<a href="${floorplanEditor(entry.id, floor.floorId)}"${
        floor.floorId === mark ? ' aria-current="location"' : ''}><strong>${C.escape(floor.label)}</strong></a>`,
    },
    { key: 'rooms', label: 'Räume', align: 'right', render: (floor) => number(floor.rooms) },
    { key: 'areaHnf', label: 'HNF', align: 'right', render: (floor) => area(floor.areaHnf) },
    { key: 'workplaces', label: 'Arbeitsplätze', align: 'right', render: (floor) => number(floor.workplaces) },
    {
      key: 'lastSync',
      label: 'Letzter Abgleich',
      render: (floor) => C.escape(floor.lastSync || '—'),
    },
    {
      key: 'planStatus',
      label: 'Planstand',
      render: (floor) => {
        const status = PLAN_STATUS[floor.planStatus] || PLAN_STATUS.inventory;
        return C.badge(status.label, status.variant, 'sm');
      },
    },
  ];
}

export const FLOOR_SORTS = Object.freeze([
  { value: 'level', label: 'Geschoss (oben zuerst)' },
  { value: 'area', label: 'HNF (grösste zuerst)' },
  { value: 'rooms', label: 'Räume (meiste zuerst)' },
  { value: 'state', label: 'Planstand (offen zuerst)' },
]);

const FLOOR_STATE_ORDER = Object.freeze({ not_synced: 0, inventory: 1, accepted: 2 });

/** Search and sort for the floor register, shared by both its surfaces. */
export function visibleFloors(floors, { q = '', sort = 'level' } = {}) {
  const term = clean(q);
  const rows = list(floors).filter((floor) => !term
    || clean(`${floor.label} ${floor.planStatus} ${floor.lastSync}`).includes(term));
  const byLevel = (left, right) => right.level - left.level;
  if (sort === 'area') return rows.sort((left, right) => right.areaHnf - left.areaHnf || byLevel(left, right));
  if (sort === 'rooms') return rows.sort((left, right) => right.rooms - left.rooms || byLevel(left, right));
  if (sort === 'state') {
    return rows.sort((left, right) => (FLOOR_STATE_ORDER[left.planStatus] ?? 3)
      - (FLOOR_STATE_ORDER[right.planStatus] ?? 3) || byLevel(left, right));
  }
  return rows.sort(byLevel);
}

/**
 * Body of the Grundrisse register: one catalogue bar over two surfaces, the same
 * anatomy the portfolio uses. It used to render a bar of its own AND mount a
 * data table that rendered a second one, so the list surface carried two stacked
 * bars whose controls did different things.
 */
export function plansPanelHTML(C, { entry, view, previewFor, mark = '', q = '', sort = 'level' }) {
  const rows = visibleFloors(entry.floors, { q, sort });
  const surface = view === 'cards'
    ? (rows.length
      ? `<ul class="fpe-floor-cards">${rows
        .map((floor) => floorCardHTML(C, entry, floor, previewFor(floor), floor.floorId === mark)).join('')}</ul>`
      : C.empty('Keine Geschosse für diese Suche.'))
    : C.table({
      columns: floorColumns(C, entry, mark), rows, zebra: true, rowsClickable: true,
      rowClass: (floor) => floor.floorId === mark ? 'is-marked' : '',
      caption: `Geschosse von ${entry.name}`,
      emptyText: 'Keine Geschosse für diese Suche.',
    });
  return `<div class="fpe-plans" id="fpe-plans">
    ${registerBar(C, {
      id: 'fpe-floors', label: 'Geschoss suchen', placeholder: 'Geschoss, Planstand oder Datum suchen…',
      q, sort, sorts: FLOOR_SORTS,
      count: `<strong>${number(rows.length)}</strong> von ${number(entry.floors.length)} ${
        entry.floors.length === 1 ? 'Geschoss' : 'Geschossen'} · ${area(entry.areaHnf)} HNF`,
      view, views: [['list', 'Listenansicht', 'List'], ['cards', 'Galerieansicht', 'Apps']],
    })}
    ${surface}
  </div>`;
}

// --- Module ------------------------------------------------------------------

export const MODULE_SORTS = Object.freeze([
  { value: 'number', label: 'Modulnummer' },
  { value: 'rooms', label: 'Räume (meiste zuerst)' },
  { value: 'area', label: 'Fläche (grösste zuerst)' },
  { value: 'workplaces', label: 'Arbeitsplätze (meiste zuerst)' },
]);

export function visibleModules(rows, { q = '', sort = 'number' } = {}) {
  const term = clean(q);
  const shown = list(rows).filter((row) => !term || clean(`${row.number} ${row.name}`).includes(term));
  const byNumber = (left, right) => left.number - right.number;
  if (sort === 'rooms') return shown.sort((left, right) => right.rooms - left.rooms || byNumber(left, right));
  if (sort === 'area') return shown.sort((left, right) => right.area - left.area || byNumber(left, right));
  if (sort === 'workplaces') return shown.sort((left, right) => right.workplaces - left.workplaces || byNumber(left, right));
  return shown.sort(byNumber);
}

function modulePanel(C, { entry, rooms, planning, q = '', sort = 'number' }) {
  const all = moduleRows(rooms, planning);
  if (!all.length) {
    return C.empty('Für dieses Objekt sind keine Multispace-Module erfasst.', {
      hint: 'Module entstehen mit der CAD-Planübernahme oder werden im Editor am Raum gesetzt.',
      action: { label: 'Im Editor öffnen', href: floorplanEditor(entry.id, entry.floors[0]?.floorId || '') },
    });
  }
  const derived = !planning?.equipmentGroups;
  const shown = visibleModules(all, { q, sort });
  const totals = shown.reduce((sum, row) => ({
    rooms: sum.rooms + row.rooms,
    area: sum.area + row.area,
    workplaces: sum.workplaces + row.workplaces,
    planned: sum.planned + (row.planned || 0),
  }), { rooms: 0, area: 0, workplaces: 0, planned: 0 });

  const columns = [
    { key: 'name', label: 'Modul', render: (row) => `<span class="fpe-module-no mono">${number(row.number)}</span> ${C.escape(row.name)}` },
    { key: 'rooms', label: 'Räume', align: 'right', render: (row) => number(row.rooms) },
    { key: 'area', label: 'Fläche', align: 'right', render: (row) => area(row.area) },
    { key: 'workplaces', label: 'Arbeitsplätze', align: 'right', render: (row) => number(row.workplaces) },
  ];
  if (!derived) {
    columns.push({
      key: 'planned', label: 'Positionen geplant', align: 'right',
      render: (row) => row.planned == null ? '—' : number(row.planned),
    });
  }

  // Where the figures come from is not an aside — it decides whether they may be
  // quoted as an approved planning. It is therefore the table's visible caption
  // rather than a muted sentence beside it.
  const caption = derived
    ? `Multispace-Module in ${entry.name} — aus der Raumnutzung abgeleitet, solange keine Planung abgenommen ist`
    : `Multispace-Module in ${entry.name} — abgenommene Planung`;

  return `<div class="fpe-register" id="fpe-modules">
    ${registerBar(C, {
      id: 'fpe-modules', label: 'Modul suchen', placeholder: 'Modul oder Nummer suchen…',
      q, sort, sorts: MODULE_SORTS,
      count: `<strong>${number(shown.length)}</strong> von ${number(all.length)} Modulen`,
    })}
    ${C.table({
      columns, rows: shown, zebra: true, caption, showCaption: true,
      emptyText: 'Keine Module für diese Suche.',
      foot: shown.length ? `<tr><th scope="row">Total</th>
        <td class="text-right">${number(totals.rooms)}</td>
        <td class="text-right">${area(totals.area)}</td>
        <td class="text-right">${number(totals.workplaces)}</td>
        ${derived ? '' : `<td class="text-right">${number(totals.planned)}</td>`}</tr>` : undefined,
    })}
  </div>`;
}

// --- Ausstattung -------------------------------------------------------------

export const FURNITURE_SORTS = Object.freeze([
  { value: 'level', label: 'Geschoss (oben zuerst)' },
  { value: 'count', label: 'Möblierung (meiste zuerst)' },
  { value: 'workplaces', label: 'Arbeitsplätze (meiste zuerst)' },
]);

export function visibleFurniture(rows, { q = '', sort = 'level' } = {}) {
  const term = clean(q);
  const shown = list(rows).filter((floor) => !term || clean(floor.label).includes(term));
  const byLevel = (left, right) => right.level - left.level;
  if (sort === 'count') return shown.sort((left, right) => right.equipmentCount - left.equipmentCount || byLevel(left, right));
  if (sort === 'workplaces') return shown.sort((left, right) => right.workplaces - left.workplaces || byLevel(left, right));
  return shown.sort(byLevel);
}

function equipmentPanel(C, { entry, q = '', sort = 'level' }) {
  const all = furnitureRows(entry);
  if (!all.length) {
    return C.empty('Für dieses Objekt ist kein Möblierungsbestand erfasst.', {
      hint: 'Ausstattungsdaten entstehen mit der CAD-Planübernahme. Bestandsgrundrisse führen sie noch nicht.',
      action: { label: 'Neuen Plan hochladen', href: planCheck(entry.id) },
    });
  }
  const shown = visibleFurniture(all, { q, sort });
  const total = shown.reduce((sum, floor) => sum + floor.equipmentCount, 0);
  return `<div class="fpe-register" id="fpe-furniture">
    ${registerBar(C, {
      id: 'fpe-furniture', label: 'Geschoss suchen', placeholder: 'Geschoss suchen…',
      q, sort, sorts: FURNITURE_SORTS,
      count: `<strong>${number(shown.length)}</strong> von ${number(all.length)} ${
        all.length === 1 ? 'Geschoss' : 'Geschossen'} · ${number(total)} Möblierungsobjekte`,
    })}
    ${C.table({
      zebra: true, rowsClickable: true, showCaption: true,
      caption: `Möblierung je Geschoss in ${entry.name} — ohne gebäudetechnische Ausstattung`,
      emptyText: 'Keine Geschosse für diese Suche.',
      columns: [
        {
          key: 'label',
          label: 'Geschoss',
          render: (floor) => `<a href="${floorplanEditor(entry.id, floor.floorId)}">${C.escape(floor.label)}</a>`,
        },
        { key: 'equipmentCount', label: 'Möblierung', align: 'right', render: (floor) => number(floor.equipmentCount) },
        { key: 'rooms', label: 'Räume', align: 'right', render: (floor) => number(floor.rooms) },
        { key: 'workplaces', label: 'Arbeitsplätze', align: 'right', render: (floor) => number(floor.workplaces) },
      ],
      rows: shown,
      foot: shown.length ? `<tr><th scope="row">Total</th>
        <td class="text-right">${number(total)}</td>
        <td class="text-right">${number(shown.reduce((sum, floor) => sum + floor.rooms, 0))}</td>
        <td class="text-right">${number(shown.reduce((sum, floor) => sum + floor.workplaces, 0))}</td></tr>` : undefined,
    })}
  </div>`;
}

// --- Shell -------------------------------------------------------------------

/**
 * The full path down to the object. Each level links back to the portfolio
 * scoped to exactly that level, so going up a step means seeing the siblings
 * rather than starting over. Exported because the portfolio builds the same
 * trail for whatever it is currently scoped to.
 */
export function placeSteps({ country, region, city } = {}) {
  return [
    { label: 'Alle Objekte', href: BASE },
    country ? { label: countryName(country) || country, href: portfolioRoute({ country }) } : null,
    region ? { label: region, href: portfolioRoute({ country, region }) } : null,
    city ? { label: city, href: portfolioRoute({ country, region, city }) } : null,
  ].filter(Boolean);
}

/**
 * Which register carries which bar. The caller keeps one search/sort pair per
 * register, so switching tabs never silently applies another register's filter,
 * and re-renders exactly one panel body when a bar changes.
 */
export const REGISTER_BARS = Object.freeze({
  plans: { id: 'fpe-floors', sort: 'level' },
  modules: { id: 'fpe-modules', sort: 'number' },
  equipment: { id: 'fpe-furniture', sort: 'level' },
});

/** One register's body, so a bar change rebuilds the panel and nothing else. */
export function objectPanelHTML(C, id, context) {
  const panels = {
    overview: () => overviewPanel(C, context),
    plans: () => plansPanelHTML(C, context),
    modules: () => modulePanel(C, context),
    equipment: () => equipmentPanel(C, context),
  };
  return (panels[id] || panels.overview)();
}

export function renderObjectView(C, {
  entry, planning, building, rooms, tab, view, previewFor, mark = '', registers = {},
}) {
  const modules = moduleRows(rooms, planning);
  const furniture = furnitureRows(entry);
  const tabs = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'plans', label: `Grundrisse (${number(entry.floors.length)})` },
    { id: 'modules', label: `Module (${number(modules.length)})` },
    { id: 'equipment', label: `Ausstattung (${number(furniture.reduce((sum, floor) => sum + floor.equipmentCount, 0))})` },
  ];
  const context = (id) => ({
    entry, planning, building, rooms, previewFor, view, mark,
    q: registers[id]?.q || '',
    sort: registers[id]?.sort || REGISTER_BARS[id]?.sort || '',
  });

  return `<div class="fpe-object" id="fpe-object" data-tab="${C.escape(tab)}" data-plan-view="${C.escape(view)}">
    ${breadcrumbBarHTML(C, [...placeSteps(entry), { label: entry.name }])}
    <div class="fpe-object__body">
      <div class="fpe-object__head">
        <div class="fpe-object__title">
          <h1 tabindex="-1">${C.escape(entry.name)}</h1>
          <p class="lead">${C.escape(entry.address)}${entry.occupants ? ` · ${C.escape(entry.occupants)}` : ''}</p>
          <p class="fpe-object__badge">${planStateBadge(C, entry)}</p>
        </div>
      </div>

      <div class="kpi-strip fpe-object__kpis">
        <div class="kpi-strip__item"><span class="kpi-strip__label">Geschosse</span>
          <span class="kpi-strip__value">${number(entry.floors.length)}</span></div>
        <div class="kpi-strip__item"><span class="kpi-strip__label">Räume</span>
          <span class="kpi-strip__value">${number(entry.rooms)}</span></div>
        <div class="kpi-strip__item"><span class="kpi-strip__label">Hauptnutzfläche</span>
          <span class="kpi-strip__value">${area(entry.areaHnf)}</span></div>
        <div class="kpi-strip__item"><span class="kpi-strip__label">Arbeitsplätze</span>
          <span class="kpi-strip__value">${number(entry.workplaces)}</span></div>
      </div>

      <div class="tabs mt-6">
        ${C.tabBar({ items: tabs, active: tab, idPrefix: 'fpe-obj-tab', ariaLabel: 'Objektdetails' })}
        ${C.tabPanels({ items: tabs, active: tab, idPrefix: 'fpe-obj-tab', render: (id) => objectPanelHTML(C, id, context(id)), heading: true })}
      </div>
    </div>
  </div>`;
}
