// Building detail of the Plan-Editor landing page.
//
// The same anatomy as the property-inventory detail — breadcrumb, title, hero,
// CD tabs, shared data tables, action and contact cards in an aside — but asked
// from the space-management side. The inventory answers «what is this object»;
// this view answers «what state are its plans in and what do I open next», so
// the key facts are the ones that bear on plan work and every table ends in a
// floor.
//
// Floor-plan thumbnails appear on cards only, never in a table row: a preview is
// a picture of the thing, and a row is a line of facts. The floor-plan register
// therefore carries the portal's own view switch between the two.

import { floorplanEditor, planCheck } from '../links.js';
import { formatArea, formatNumber } from '../format.js';
import { PLAN_STATUS, address } from './shared.js';
import { OBJECT_STATE } from './browse-view.js';

const list = (value) => Array.isArray(value) ? value : [];
const number = (value) => formatNumber(value);
const area = (value) => formatArea(value, { maximumFractionDigits: 1 });

export const OBJECT_TABS = Object.freeze(['overview', 'plans', 'equipment']);
export const PLAN_VIEWS = Object.freeze(['cards', 'list']);

// German query values are the public link contract, as in the inventory, so they
// are quoted compatibility literals rather than identifiers.
const TAB_BY_QUERY = Object.freeze({ 'uebersicht': 'overview', 'grundrisse': 'plans', 'ausstattungen': 'equipment' });
const QUERY_BY_TAB = Object.freeze(Object.fromEntries(
  Object.entries(TAB_BY_QUERY).map(([value, tab]) => [tab, value])));

export function objectTab(value) {
  return TAB_BY_QUERY[String(value || '')] || 'overview';
}

export function objectTabQuery(tab) {
  return QUERY_BY_TAB[tab] || 'uebersicht';
}

export function planView(value) {
  return PLAN_VIEWS.includes(String(value || '')) ? String(value) : 'cards';
}

/** Multispace module standard with each group's share of the total. */
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

function planStateBadge(C, entry) {
  const state = OBJECT_STATE[entry.planState];
  return C.badge(state.label, state.variant, 'sm');
}

// --- Overview register -------------------------------------------------------

function overviewPanel(C, { entry, planning, building, previewFor }) {
  const equipment = equipmentGroups(planning);
  const availability = {
    planned: 'CAD-Planung in Arbeit',
    legacy: 'Bestandsgrundriss',
  }[planning?.planAvailability] || 'Bestandsgrundriss';
  const contacts = list(planning?.contacts)
    .map((contact) => ({ label: contact.label, email: contact.email }));

  const actions = [
    { label: 'Planprüfung für dieses Objekt öffnen', href: planCheck(entry.id), newWindow: true },
    { label: 'Objekt im Workspace-Portal ansehen', href: `#/app/workspace?id=${encodeURIComponent(entry.id)}`, newWindow: true },
    { label: 'Objekt im Liegenschaften-Inventar ansehen', href: `#/app/portfolio?id=${encodeURIComponent(entry.id)}`, newWindow: true },
    { label: 'Aufnahmen in der Mediathek', href: `#/app/media-library?objekt=${encodeURIComponent(entry.id)}`, newWindow: true },
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
      <dt>Ausstattungsobjekte</dt><dd>${equipment.total ? number(equipment.total) : 'nicht erfasst'}</dd>
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

// --- Floor-plan register -----------------------------------------------------

function floorCardHTML(C, entry, floor, previewHTML) {
  const status = PLAN_STATUS[floor.planStatus] || PLAN_STATUS.inventory;
  return `<li class="fpe-floor-card">
    <a class="fpe-floor-card__link" href="${floorplanEditor(entry.id, floor.floorId)}">
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
export function floorColumns(C, entry) {
  return [
    {
      key: 'label',
      label: 'Geschoss',
      render: (floor) => `<a href="${floorplanEditor(entry.id, floor.floorId)}"><strong>${C.escape(floor.label)}</strong></a>`,
    },
    { key: 'rooms', label: 'Räume', render: (floor) => number(floor.rooms) },
    { key: 'areaHnf', label: 'HNF', render: (floor) => area(floor.areaHnf) },
    { key: 'workplaces', label: 'Arbeitsplätze', render: (floor) => number(floor.workplaces) },
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

/**
 * Body of the Grundrisse register. Exported because the view switch exchanges
 * exactly this panel without rebuilding the page around it.
 */
export function plansPanelHTML(C, { entry, view, previewFor }) {
  const surface = view === 'list'
    ? '<div id="fpe-floors-table"></div>'
    : `<ul class="fpe-floor-cards">${entry.floors
      .map((floor) => floorCardHTML(C, entry, floor, previewFor(floor))).join('')}</ul>`;
  // The catalogue bar without its search field: count left, view switch right —
  // the same anatomy CD uses for a results header, and the same control the
  // inventory switches its gallery with.
  return `<div class="fpe-plans">
    ${C.catalogueBar({
      showSearch: false,
      countId: 'fpe-floors-count',
      count: `<strong>${number(entry.floors.length)}</strong> ${entry.floors.length === 1 ? 'Geschoss' : 'Geschosse'} · ${area(entry.areaHnf)} HNF`,
      view,
      views: [['cards', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List']],
    })}
    ${surface}
  </div>`;
}

// --- Equipment register ------------------------------------------------------

function equipmentPanel(C, { entry, planning }) {
  const equipment = equipmentGroups(planning);
  if (!equipment.total) {
    return C.empty('Für dieses Objekt ist kein Ausstattungsbestand erfasst.', {
      hint: 'Ausstattungsdaten entstehen mit der CAD-Planübernahme. Bestandsgrundrisse führen sie noch nicht.',
    });
  }
  const perFloor = entry.floors.filter((floor) => floor.equipmentCount != null);
  return `<h3 class="detail-section__title">Multispace-Ausstattungsstandard</h3>
    <p class="small muted">${number(equipment.total)} Ausstattungsobjekte in ${number(equipment.rows.length)} Modulgruppen.</p>
    <div class="table-scroll" data-scroll-region tabindex="0" role="group" aria-label="Modulgruppen">
      <table class="table table--zebra">
        <caption class="sr-only">Ausstattungsobjekte je Modulgruppe</caption>
        <thead><tr>
          <th scope="col">Nr.</th><th scope="col">Modulgruppe</th>
          <th scope="col" class="text-right">Anzahl</th><th scope="col" class="text-right">Anteil</th>
        </tr></thead>
        <tbody>${equipment.rows.map((group) => `<tr>
          <td class="mono">${number(group.number)}</td>
          <th scope="row">${C.escape(group.name)}</th>
          <td class="text-right">${number(group.count)}</td>
          <td class="text-right">${number(group.share)} %</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr>
          <td></td><th scope="row">Total</th>
          <td class="text-right">${number(equipment.total)}</td><td class="text-right">100 %</td>
        </tr></tfoot>
      </table>
    </div>
    ${perFloor.length ? `<h3 class="detail-section__title mt-6">Je Geschoss</h3>
      <table class="table table--zebra">
        <caption class="sr-only">Ausstattung und Räume je Geschoss</caption>
        <thead><tr>
          <th scope="col">Geschoss</th><th scope="col" class="text-right">Ausstattung</th>
          <th scope="col" class="text-right">Räume</th><th scope="col" class="text-right">Arbeitsplätze</th>
        </tr></thead>
        <tbody>${perFloor.map((floor) => `<tr>
          <th scope="row"><a href="${floorplanEditor(entry.id, floor.floorId)}">${C.escape(floor.label)}</a></th>
          <td class="text-right">${number(floor.equipmentCount)}</td>
          <td class="text-right">${number(floor.rooms)}</td>
          <td class="text-right">${number(floor.workplaces)}</td>
        </tr>`).join('')}</tbody>
      </table>` : ''}`;
}

// --- Shell -------------------------------------------------------------------

export function renderObjectView(C, {
  entry, planning, building, tab, view, previewFor,
}) {
  const equipment = equipmentGroups(planning);
  const tabs = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'plans', label: `Grundrisse (${number(entry.floors.length)})` },
    { id: 'equipment', label: `Ausstattungen (${number(equipment.rows.length)})` },
  ];
  const panels = {
    overview: () => overviewPanel(C, { entry, planning, building, previewFor }),
    plans: () => plansPanelHTML(C, { entry, view, previewFor }),
    equipment: () => equipmentPanel(C, { entry, planning }),
  };

  return `<div class="fpe-object" id="fpe-object" data-tab="${C.escape(tab)}" data-plan-view="${C.escape(view)}">
    ${/* The editor's own breadcrumb bar, as in the workbench: the standalone
          layout hides the portal shell, so `setCrumbs` has nothing to draw. */''}
    <div class="fpe-context">
      <nav class="fpe-breadcrumb" aria-label="Sie sind hier">
        <a href="#/app/floorplan-editor" data-leave>Portfolio</a>${C.icon('ChevronRight', 'icon--sm')}
        <span aria-current="page">${C.escape(entry.name)}</span>
      </nav>
    </div>
    <div class="fpe-object__body">
      <div class="fpe-object__head">
        <div class="fpe-object__title">
          <h1 tabindex="-1">${C.escape(entry.name)}</h1>
          <p class="lead">${C.escape(entry.address)}${entry.occupants ? ` · ${C.escape(entry.occupants)}` : ''}</p>
          <p class="fpe-object__badge">${planStateBadge(C, entry)}</p>
        </div>
        <a class="btn btn--filled" href="${floorplanEditor(entry.id, entry.floors[0]?.floorId || '')}">
          <span class="btn__text">Oberstes Geschoss öffnen</span></a>
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
        ${C.tabPanels({ items: tabs, active: tab, idPrefix: 'fpe-obj-tab', render: (id) => (panels[id] || panels.overview)(), heading: true })}
      </div>
    </div>
  </div>`;
}
