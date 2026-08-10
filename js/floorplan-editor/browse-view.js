// View 1 of the Plan-Editor landing page: find the plan to work on.
//
// Map-first on purpose. The question this view answers is «is this the right
// building» — a question a list cannot answer and a map can.
//
// The three surfaces divide the work rather than repeating it:
//   · the map answers «which object», and carries that object's facts and
//     actions in its own popup, anchored where the visitor is already looking;
//   · the tree answers «where», down to the floor;
//   · the right panel answers «how much and in what state», for whatever the
//     filters currently show — it is a statistics panel, not a second detail
//     view, so it never empties out or jumps when the selection changes.
//
// The bar is the portal's shared `catalogueBar` with `activeFilters` beneath it,
// exactly as the Liegenschaften inventory uses them. That replaces the bespoke
// search field, hit count and view switch this view used to carry.

import { treeHTML } from '../ui/spatial-tree.js';
import { floorplanEditor } from '../links.js';
import { countryName } from '../domain.js';
import { address, area, clean, number } from './shared.js';

const list = (value) => Array.isArray(value) ? value : [];

export const BROWSE_MODES = Object.freeze(['map', 'cards', 'list']);
export const DEFAULT_BROWSE_MODE = 'map';

export const BROWSE_SORTS = Object.freeze([
  { value: 'name', label: 'Objekt (A–Z)' },
  { value: 'state', label: 'Planstand (offen zuerst)' },
  { value: 'floors', label: 'Geschosse (absteigend)' },
  { value: 'area', label: 'HNF (absteigend)' },
]);

export function browseMode(value) {
  return BROWSE_MODES.includes(String(value || '')) ? String(value) : DEFAULT_BROWSE_MODE;
}

export function browseSort(value) {
  return BROWSE_SORTS.some((sort) => sort.value === value) ? String(value) : 'name';
}

const STATE_ORDER = Object.freeze({ not_synced: 0, planned: 1, accepted: 2 });

/**
 * One row per editable object, carrying everything the three modes, the tree and
 * the statistics panel need. `planState` is the worst state across the object's
 * floors, because a single stale floor is what the visitor must notice.
 */
export function browseEntries(objects, core) {
  return list(objects).map((entry) => {
    const building = entry.building;
    const records = new Map(list(entry.planning?.floors).map((record) => [record.floorId, record]));
    const floors = list(entry.floors).map((floor) => {
      const record = records.get(floor.floorId);
      const spaces = typeof core?.spacesForFloor === 'function' ? list(core.spacesForFloor(floor.floorId)) : [];
      return {
        floorId: floor.floorId,
        label: floor.label,
        level: Number(floor.level) || 0,
        areaHnf: Number(floor.areaHnf) || 0,
        rooms: spaces.length || Number(floor.rooms) || 0,
        workplaces: spaces.reduce((sum, room) => sum + (Number(room.capacity) || 0), 0),
        // Null rather than zero: a legacy floor has no equipment record at all,
        // which is not the same statement as «no equipment».
        equipmentCount: record?.equipmentCount == null ? null : Number(record.equipmentCount),
        planStatus: record?.planStatus || 'inventory',
        lastSync: record?.lastSync || '',
      };
    }).sort((left, right) => right.level - left.level);
    const stale = floors.filter((floor) => floor.planStatus === 'not_synced').length;
    const orderOpen = entry.planning?.orderStatus === 'open';
    return {
      id: building.bbl_id,
      name: building.name,
      country: building.country || 'CH',
      region: building.canton || '',
      city: building.city || '',
      address: address(building),
      lat: Number(building.lat),
      lon: Number(building.lng),
      photoSrc: building.photoSrc || '',
      occupants: building.occupants || '',
      floors,
      rooms: floors.reduce((sum, floor) => sum + floor.rooms, 0),
      areaHnf: floors.reduce((sum, floor) => sum + floor.areaHnf, 0),
      workplaces: floors.reduce((sum, floor) => sum + floor.workplaces, 0),
      stale,
      orderOpen,
      targetDate: entry.planning?.targetDate || '',
      // The object's headline state, worst-first.
      planState: stale ? 'not_synced' : orderOpen ? 'planned' : 'accepted',
      search: clean(`${building.name} ${building.bbl_id} ${address(building)} ${building.occupants || ''}`),
    };
  }).sort((left, right) => left.name.localeCompare(right.name, 'de'));
}

export function sortBrowseEntries(entries, sort) {
  const rows = list(entries).slice();
  const byName = (left, right) => left.name.localeCompare(right.name, 'de');
  if (sort === 'state') {
    return rows.sort((left, right) => (
      STATE_ORDER[left.planState] - STATE_ORDER[right.planState] || byName(left, right)));
  }
  if (sort === 'floors') return rows.sort((left, right) => right.floors.length - left.floors.length || byName(left, right));
  if (sort === 'area') return rows.sort((left, right) => right.areaHnf - left.areaHnf || byName(left, right));
  return rows.sort(byName);
}

export const OBJECT_STATE = Object.freeze({
  not_synced: { label: 'nicht synchronisiert', variant: 'warning' },
  planned: { label: 'in Planung', variant: 'info' },
  accepted: { label: 'aktuell', variant: 'success' },
});

export function browseSummary(entries) {
  const counts = { accepted: 0, not_synced: 0, planned: 0 };
  for (const entry of entries) counts[entry.planState] += 1;
  return counts;
}

/** Everything the statistics panel reports for the currently shown objects. */
export function browseStatistics(entries) {
  const rows = list(entries);
  const floors = rows.flatMap((entry) => entry.floors);
  return {
    objects: rows.length,
    floors: floors.length,
    rooms: rows.reduce((sum, entry) => sum + entry.rooms, 0),
    workplaces: rows.reduce((sum, entry) => sum + entry.workplaces, 0),
    areaHnf: rows.reduce((sum, entry) => sum + entry.areaHnf, 0),
    staleFloors: floors.filter((floor) => floor.planStatus === 'not_synced').length,
    openOrders: rows.filter((entry) => entry.orderOpen).length,
    states: browseSummary(rows),
  };
}

function cardHTML(C, entry) {
  const state = OBJECT_STATE[entry.planState];
  return `<li class="fpe-browse-card" data-browse-row data-obj="${C.escape(entry.id)}">
    <a class="fpe-browse-card__link" href="${floorplanEditor(entry.id)}">
      <span class="fpe-browse-card__media">${entry.photoSrc
        ? `<img src="${C.escape(entry.photoSrc)}" alt="" loading="lazy">`
        : '<span class="fpe-browse-card__placeholder" aria-hidden="true"></span>'}</span>
      <span class="fpe-browse-card__body">
        <span class="fpe-browse-card__name">${C.escape(entry.name)}</span>
        <span class="mono fpe-browse-card__id">${C.escape(entry.id)}</span>
        <span class="fpe-browse-card__facts">${number(entry.floors.length)} Geschosse · ${area(entry.areaHnf)} HNF</span>
        <span class="fpe-browse-card__state">${C.badge(state.label, state.variant, 'sm')}</span>
      </span>
    </a>
  </li>`;
}

function listHTML(C, entries) {
  return `<div class="fpe-browse__table"><table class="table table--zebra">
    <caption class="sr-only">Objekte mit bearbeitbaren Grundrissen</caption>
    <thead><tr>
      <th scope="col">Gebäude</th><th scope="col">Ort</th>
      <th scope="col" class="text-right">Geschosse</th><th scope="col" class="text-right">HNF</th>
      <th scope="col" class="text-right">Arbeitsplätze</th><th scope="col">Planstand</th>
    </tr></thead>
    <tbody>${entries.map((entry) => {
      const state = OBJECT_STATE[entry.planState];
      return `<tr data-browse-row data-obj="${C.escape(entry.id)}">
        <th scope="row"><a href="${floorplanEditor(entry.id)}"><strong>${C.escape(entry.name)}</strong><span class="mono">${C.escape(entry.id)}</span></a></th>
        <td>${C.escape(entry.city || '—')}</td>
        <td class="text-right">${number(entry.floors.length)}</td>
        <td class="text-right">${area(entry.areaHnf)}</td>
        <td class="text-right">${number(entry.workplaces)}</td>
        <td>${C.badge(state.label, state.variant, 'sm')}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

/**
 * Body of the map popup: the object's master data, anchored on the marker the
 * visitor clicked, and one way onward. It is a label on the map, not a second
 * detail view — the floors, the module standard, the furniture and the actions
 * all live in the object's own detail, and repeating a slice of them here made
 * the popup the place where work started and then dead-ended.
 *
 * The button says where it leads. Its predecessor promised the editor and opened
 * the detail view instead, which is most of why this surface felt broken.
 */
export function browsePopupHTML(C, entry) {
  if (!entry) return '';
  const state = OBJECT_STATE[entry.planState];
  const notes = [
    entry.stale ? `${number(entry.stale)} ${entry.stale === 1 ? 'Geschoss' : 'Geschosse'} nicht synchronisiert` : '',
    entry.orderOpen ? `Auftrag offen${entry.targetDate ? ` · Stichtag ${entry.targetDate.split('-').reverse().join('.')}` : ''}` : '',
  ].filter(Boolean);
  return `<div class="fpe-popup">
    <p class="fpe-popup__name">${C.escape(entry.name)}</p>
    <p class="mono fpe-popup__id">${C.escape(entry.id)}</p>
    <p class="fpe-popup__address">${C.escape(entry.address)}</p>
    <p class="fpe-popup__badge">${C.badge(state.label, state.variant, 'sm')}</p>
    <dl class="fpe-popup__facts">
      <dt>Geschosse</dt><dd>${number(entry.floors.length)}</dd>
      <dt>Räume</dt><dd>${number(entry.rooms)}</dd>
      <dt>Hauptnutzfläche</dt><dd>${area(entry.areaHnf)}</dd>
      <dt>Arbeitsplätze</dt><dd>${number(entry.workplaces)}</dd>
    </dl>
    ${notes.length ? `<ul class="fpe-popup__notes">${notes.map((note) => (
      `<li>${C.escape(note)}</li>`)).join('')}</ul>` : ''}
    <div class="fpe-popup__actions">
      <a class="btn btn--filled btn--sm" href="${floorplanEditor(entry.id)}"><span class="btn__text">Objektdetails öffnen</span></a>
    </div>
  </div>`;
}

/**
 * The right-hand panel: a compact dashboard of what the current filters show.
 * Deliberately not tied to the selection — the map popup owns the single object,
 * and a panel that empties on deselect wastes a third of the layout.
 */
export function browseStatsHTML(C, entries, { scope = 'Alle Objekte' } = {}) {
  const stats = browseStatistics(entries);
  const figure = (label, value, note = '') => `<div class="kpi-strip__item">
    <span class="kpi-strip__label">${C.escape(label)}</span>
    <span class="kpi-strip__value">${value}${note ? `<small> ${C.escape(note)}</small>` : ''}</span>
  </div>`;
  const stateRow = (key) => {
    const state = OBJECT_STATE[key];
    const count = stats.states[key];
    const share = stats.objects ? Math.round((count / stats.objects) * 100) : 0;
    return `<div class="fpe-stats__state">
      <span class="fpe-stats__state-label">${C.badge(state.label, state.variant, 'sm')}</span>
      <span class="fpe-stats__bar" aria-hidden="true"><span class="fpe-stats__bar-fill fpe-stats__bar-fill--${key}" style="inline-size:${share}%"></span></span>
      <span class="fpe-stats__state-count">${number(count)}</span>
    </div>`;
  };
  return `<p class="fpe-overline">${C.escape(scope)}</p>
    <div class="kpi-strip fpe-stats__figures">
      ${figure('Objekte', number(stats.objects))}
      ${figure('Geschosse', number(stats.floors))}
      ${figure('Räume', number(stats.rooms))}
      ${figure('Arbeitsplätze', number(stats.workplaces))}
    </div>
    <section class="fpe-stats__section" aria-labelledby="fpe-stats-state">
      <h3 id="fpe-stats-state">Planstand</h3>
      ${stateRow('accepted')}${stateRow('not_synced')}${stateRow('planned')}
    </section>
    <section class="fpe-stats__section" aria-labelledby="fpe-stats-facts">
      <h3 id="fpe-stats-facts">Bestand</h3>
      <dl class="kv kv--ruled fpe-stats__kv">
        <dt>Hauptnutzfläche</dt><dd>${area(stats.areaHnf)}</dd>
        <dt>Geschosse nicht synchronisiert</dt><dd>${number(stats.staleFloors)}</dd>
        <dt>Objekte mit offenem Auftrag</dt><dd>${number(stats.openOrders)}</dd>
      </dl>
    </section>`;
}

/**
 * The exchangeable middle region — map, cards or table. Rebuilt on a view switch
 * exactly as the inventory rebuilds `#pf-main`, while bar, tree and statistics
 * stay put.
 */
export function browseSurfaceHTML(C, entries, mode) {
  if (mode === 'cards') {
    return entries.length
      ? `<ul class="fpe-browse__cards">${entries.map((entry) => cardHTML(C, entry)).join('')}</ul>`
      : `<div class="fpe-browse__none">${C.empty('Keine Objekte für diese Suche oder Filterung.')}</div>`;
  }
  if (mode === 'list') {
    return entries.length
      ? listHTML(C, entries)
      : `<div class="fpe-browse__none">${C.empty('Keine Objekte für diese Suche oder Filterung.')}</div>`;
  }
  return `<div class="fpe-browse__map" id="fpe-browse-map" data-map-slot>
    <div class="fpe-browse__map-loading">${C.loading({ label: 'Karte wird geladen…' })}</div>
  </div>`;
}

export function renderBrowseView(C, {
  entries, allEntries, mode, sort, query, filters, scopeLabel,
}) {
  const tree = treeHTML(C, allEntries, {
    levels: [
      { key: 'country', icon: 'Globe', label: (value) => countryName(value) },
      { key: 'region', icon: 'Map', label: (value) => value || 'Ohne Kanton' },
      { key: 'city', icon: 'MapMarker', label: (value) => value || 'Ohne Ort' },
    ],
    leaf: {
      icon: () => 'Building',
      label: (entry) => entry.name,
      objId: (entry) => entry.id,
      sort: (left, right) => left.name.localeCompare(right.name, 'de'),
      // The new level: the floors of a building, which is what the visitor is
      // actually looking for once the right object is on screen.
      children: (entry) => entry.floors.map((floor) => ({
        id: floor.floorId, label: floor.label, icon: 'Stack',
      })),
    },
  });

  const stateOptions = ['not_synced', 'planned', 'accepted']
    .map((value) => ({ value, label: OBJECT_STATE[value].label }));

  return `<div class="fpe-browse" id="fpe-browse" data-mode="${C.escape(mode)}">
    <h1 class="sr-only" tabindex="-1">Plan-Editor — Portfolio</h1>
    <div class="fpe-browse__bar">
      ${C.catalogueBar({
        formId: 'fpe-browse-search', inputId: 'fpe-browse-q',
        searchLabel: 'Adresse, Objekt oder ID suchen',
        placeholder: 'Adresse, Objekt oder ID suchen…', q: query,
        countId: 'fpe-browse-count',
        count: `<strong>${number(entries.length)}</strong> von ${number(allEntries.length)} Objekten`,
        sort: { id: 'fpe-browse-sort', value: sort, options: BROWSE_SORTS },
        filterId: 'fpe-browse-filter-btn', filterLabel: 'Filter',
        filterCount: list(filters?.state).length,
        panelId: 'fpe-browse-filters',
        panel: `${C.filterGroup({
          dim: 'state', legend: 'Planstand', options: stateOptions,
          selected: list(filters?.state), idPrefix: 'fpe-browse',
        })}${C.panelReset({ id: 'fpe-browse-freset' })}`,
        view: mode,
        views: [['map', 'Kartenansicht', 'Map'], ['cards', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List']],
      })}
      <div id="fpe-browse-activefilters"></div>
    </div>
    <div class="fpe-browse__layout">
      <aside class="fpe-browse__tree" aria-label="Standorte">
        ${/* No clear-selection button beside the title: the pill row above already
              removes the selection, and a second affordance does not fit a 15 rem
              column without wrapping into three lines. */''}
        <p class="fpe-overline" id="fpe-browse-tree-head">Standorte</p>
        ${tree}
      </aside>
      <div class="fpe-browse__surface" id="fpe-browse-surface" data-scroll-region>${browseSurfaceHTML(C, entries, mode)}</div>
      <aside class="fpe-browse__stats" id="fpe-browse-stats" aria-label="Kennzahlen der Auswahl" aria-live="polite">
        ${browseStatsHTML(C, entries, { scope: scopeLabel })}
      </aside>
    </div>
  </div>`;
}
