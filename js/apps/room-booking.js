import { APPLICATIONS, trail } from '../crumbs.js';
// Direct room booking on one page.
// The former three-step wizard made the common next-morning booking require
// three page changes. The current surface shows a prefilled search bar, results,
// and a card-level booking dialog. Map and floor plan remain supporting dialogs.
// Room cards use floor identifiers instead of repeated building placeholder photos.
import { initEstateMap } from '../map/buildings-map.js';
import { createMapSlot } from '../map/map-slot.js';
import { floorplanSvg, wireFloorplan } from '../ui/floorplan.js';
import { favorites } from '../core/favorites.js';
import { formatDate, formatArea, formatNumber } from '../format.js';
import {
  PREFERRED_BUILDING,
  ROOM_NAMES,
  EQUIPMENT_OPTIONS,
  CANCELLED,
  DAY_START,
  DAY_END,
  PAGE_SIZE,
  FIELD_LABELS,
  localDate,
  nextWorkday,
  minuteOfDay,
  hhmm,
  floorQuarter,
  rangesOverlap,
  roomHash,
  participantCount,
  slotValidation,
  safeDate,
  safeTime,
  domId,
  instanceRange,
  isUpcoming,
} from './room-booking/rules.js';
import { DIRECTORY, calendarFile, parseInvitee } from './room-booking/calendar.js';

export const needs = ['buildings', 'floors', 'spaces'];

// Application-specific copy shown by the router's authentication gate.
export const loginText = "Raumbuchungen sind persönliche Vorgänge. Melden Sie sich mit AGOV / FedLogin an, um einen Raum zu reservieren.";

export default async function render(ctx) {
  const { mount, query, core, engine, session, C, setTitle, setCrumbs, onUnmount } = ctx;
  setTitle('Raumbuchung');
  setCrumbs(trail(APPLICATIONS, { label: 'Raumbuchung' }));

  const meetingRooms = core.spaces().filter((space) => space.bookable && space.useType === 'sitzung');
  const buildingIds = new Set(meetingRooms.map((space) => space.buildingId));
  const buildings = core.buildings()
    .filter((building) => buildingIds.has(building.bbl_id))
    .sort((a, b) => `${a.country} ${a.city} ${a.name}`.localeCompare(`${b.country} ${b.city} ${b.name}`, 'de'));

  if (!buildings.length) {
    mount.innerHTML = `<div class="container section">
      ${C.pageHeader({ title: 'Raumbuchung', lead: 'Sitzungs- und Besprechungsräume reservieren.' })}
      ${C.empty('Zurzeit sind keine buchbaren Räume verfügbar.', { available: core.available('spaces') })}
    </div>`;
    return;
  }

  // The room catalogue is immutable during this route. Group and sort once;
  // search criteria and process instances remain mutable.
  const roomsByBuilding = new Map(buildings.map((item) => [item.bbl_id, []]));
  meetingRooms.forEach((room) => roomsByBuilding.get(room.buildingId)?.push(room));
  roomsByBuilding.forEach((rooms) => rooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, 'de', { numeric: true })));
  const roomByIdMap = new Map(meetingRooms.map((room) => [room.spaceId, room]));
  const roomIndexById = new Map();
  const legacyRoomByBuilding = new Map();
  roomsByBuilding.forEach((rooms, buildingId) => {
    const byNumber = new Map();
    rooms.forEach((room, index) => {
      roomIndexById.set(room.spaceId, index);
      byNumber.set(room.roomNumber, room);
    });
    legacyRoomByBuilding.set(buildingId, byNumber);
  });

  const requestedRoom = meetingRooms.find((room) => room.spaceId === query.get('room')) || null;
  // Location precedence: deep link, favourite, prototype default, then first available.
  const favouriteBuilding = favorites.list('building').find((id) => buildings.some((item) => item.bbl_id === id));
  const initialBuilding = buildings.find((item) => item.bbl_id === (requestedRoom?.buildingId || query.get('building')))
    || buildings.find((item) => item.bbl_id === favouriteBuilding)
    || buildings.find((item) => item.bbl_id === PREFERRED_BUILDING)
    || buildings[0];

  const today = localDate(new Date());
  const requestedParticipants = participantCount(query.get('participants'));
  const requestedEquipment = String(query.get('equipment') || '').split(',').filter((value) => EQUIPMENT_OPTIONS.includes(value));
  const initialDate = safeDate(query.get('date'), nextWorkday(), today);
  let initialStart = safeTime(query.get('start'), '09:00');
  let initialEnd = safeTime(query.get('end'), '10:00');
  if (minuteOfDay(initialEnd) <= minuteOfDay(initialStart)) {
    initialStart = '09:00';
    initialEnd = '10:00';
  }

  const state = {
    tab: query.get('tab') === 'bookings' ? 'bookings' : 'find',
    buildingId: initialBuilding.bbl_id,
    date: initialDate,
    start: initialStart,
    end: initialEnd,
    participants: requestedParticipants ?? 4,
    sort: ['best', 'capacity', 'room'].includes(query.get('sort')) ? query.get('sort') : 'best',
    filters: {
      equipment: requestedEquipment,
      accessible: query.get('accessible') === '1' ? ['yes'] : [],
    },
    filterOpen: false,
    showAll: false,
    errors: {},
    created: null,
    // Invitees belong to the booking dialog, but copy them for confirmation and
    // persist the compatibility string format `Name <mail>`.
    createdInvitees: null,
  };

  // A room deep link from the tenancy portal expresses booking intent, so open
  // its dialog after the first draw exactly once.
  let pendingDeepLink = requestedRoom?.spaceId || '';
  let lastSearchSummary = null;

  const dialogMap = createMapSlot();
  let closeDialog = null;         // Closes whichever booking, detail, floor-plan, or map dialog is open.
  let unwirePlan = null;
  let unwirePlanScroll = null;

  // Resources created inside a dialog share its lifetime. Tear down MapLibre's
  // WebGL context and scroll observers as soon as the dialog closes.
  const freeDialogResources = () => {
    dialogMap.free();
    if (unwirePlan) { unwirePlan(); unwirePlan = null; }
    if (unwirePlanScroll) { unwirePlanScroll(); unwirePlanScroll = null; }
  };
  // Dialogs attach to body while the router replaces only #main-content; route
  // cleanup must remove the dialog, scroll lock, and focus trap.
  onUnmount(() => {
    if (closeDialog) closeDialog();
    freeDialogResources();
  });

  const building = () => buildings.find((item) => item.bbl_id === state.buildingId) || buildings[0];
  const bookableRoomCount = (buildingId) => roomsByBuilding.get(buildingId)?.length || 0;
  const buildingRooms = () => roomsByBuilding.get(state.buildingId) || [];
  const floors = () => {
    const roomFloorIds = new Set(buildingRooms().map((room) => room.floorId));
    return core.floors()
      .filter((floor) => floor.buildingId === state.buildingId && roomFloorIds.has(floor.floorId))
      .sort((a, b) => a.level - b.level);
  };
  const floorLabel = (room) => core.floor(room.floorId)?.label || room.roomNumber.split(' ')[0] || '—';
  // Remove the already displayed floor from a label such as 1. OG 17.
  const roomCode = (room) => String(room.roomNumber).replace(/^.*\s/, '') || room.roomNumber;

  // The source inventory lacks equipment and accessibility fields, so derive
  // stable prototype values from the room ID until CAFM supplies real fields.
  function roomProfile(room, favoriteRoomIds) {
    const index = Math.max(0, roomIndexById.get(room.spaceId) ?? 0);
    const seed = roomHash(room.spaceId);
    const equipment = ['Bildschirm'];
    if (seed % 2 === 0) equipment.push('Teams');
    if (seed % 3 !== 0) equipment.push('Whiteboard');
    if (room.capacity >= 14) equipment.push('Videokonferenz');
    return {
      name: ROOM_NAMES[index % ROOM_NAMES.length],
      equipment: [...new Set(equipment)],
      accessible: floorLabel(room) === 'EG' || seed % 3 !== 0,
      favorite: favoriteRoomIds.has(room.spaceId),
    };
  }

  // One process snapshot and profile/range index serve a draw or availability
  // action. A later action gets fresh context to observe intervening reservations.
  function prepareBookingContext(instances = engine.instances()) {
    const rooms = buildingRooms();
    const favoriteRoomIds = new Set(favorites.list('room'));
    const profiles = new Map(rooms.map((room) => [room.spaceId, roomProfile(room, favoriteRoomIds)]));
    const rangesByRoom = new Map(rooms.map((room) => [room.spaceId, []]));

    instances.forEach((instance) => {
      const data = instance.data || {};
      if (instance.defId !== 'buchung' || CANCELLED.has(instance.status) || data['datum'] !== state.date) return;
      let room = null;
      if (data['raumId']) room = roomByIdMap.get(data['raumId']) || null;
      else if (instance.linkedEntities?.buildingId === state.buildingId) {
        room = legacyRoomByBuilding.get(state.buildingId)?.get(data['raum']) || null;
      }
      const ranges = room && rangesByRoom.get(room.spaceId);
      if (!ranges) return;
      const range = instanceRange(instance);
      if (Number.isFinite(range.start) && Number.isFinite(range.end)) ranges.push(range);
    });
    rangesByRoom.forEach((ranges) => ranges.sort((a, b) => a.start - b.start));
    return { rooms, profiles, rangesByRoom };
  }

  // Return a room's reservations for the selected day, ordered by start time.
  const bookedRanges = (room, context) => context.rangesByRoom.get(room.spaceId) || [];

  function isAvailable(room, context) {
    if (Object.keys(slotValidation(state, { today, capacity: room.capacity }).errors).length) return false;
    const start = minuteOfDay(state.start), end = minuteOfDay(state.end);
    return !bookedRanges(room, context).some((range) => rangesOverlap(start, end, range.start, range.end));
  }

  // Return the continuous free window around the requested range. null means
  // all-day availability, which cards omit because it does not distinguish rooms.
  function freeWindow(room, context) {
    const ranges = bookedRanges(room, context);
    if (!ranges.length) return null;
    const start = minuteOfDay(state.start), end = minuteOfDay(state.end);
    let from = DAY_START, to = DAY_END;
    for (const range of ranges) {
      if (range.end <= start) from = Math.max(from, range.end);
      if (range.start >= end) { to = Math.min(to, range.start); break; }
    }
    return { from, to };
  }

  function matchesCriteria(room, context) {
    const profile = context.profiles.get(room.spaceId);
    const count = participantCount(state.participants);
    if (count == null || room.capacity < count) return false;
    if (state.filters.accessible.length && !profile.accessible) return false;
    return state.filters.equipment.every((item) => profile.equipment.includes(item));
  }

  function sortedAvailableRooms(context) {
    const rooms = context.rooms.filter((room) => matchesCriteria(room, context) && isAvailable(room, context));
    if (state.sort === 'room') return rooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, 'de', { numeric: true }));
    if (state.sort === 'capacity') return rooms.sort((a, b) => a.capacity - b.capacity || a.roomNumber.localeCompare(b.roomNumber, 'de', { numeric: true }));
    // Best match favours minimal excess capacity, more equipment, then favourites.
    return rooms.sort((a, b) => {
      const pa = context.profiles.get(a.spaceId), pb = context.profiles.get(b.spaceId);
      if (pa.favorite !== pb.favorite) return pa.favorite ? -1 : 1;
      const scoreA = (a.capacity - state.participants) * 10 - pa.equipment.length;
      const scoreB = (b.capacity - state.participants) * 10 - pb.equipment.length;
      return scoreA - scoreB || a.roomNumber.localeCompare(b.roomNumber, 'de', { numeric: true });
    });
  }

  const roomById = (id) => roomByIdMap.get(id) || null;

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.tab !== 'find') params.set('tab', state.tab);
    params.set('building', state.buildingId);
    params.set('date', state.date);
    params.set('start', state.start);
    params.set('end', state.end);
    params.set('participants', String(state.participants));
    if (state.sort !== 'best') params.set('sort', state.sort);
    if (state.filters.equipment.length) params.set('equipment', state.filters.equipment.join(','));
    if (state.filters.accessible.length) params.set('accessible', '1');
    history.replaceState(history.state, '', `#/app/room-booking?${params}`);
  }

  function readSearchBar() {
    state.date = C.val(mount, 'booking-date') || '';
    state.start = C.val(mount, 'booking-start') || '';
    state.end = C.val(mount, 'booking-end') || '';
    // Keep raw capacity through validation; never coerce empty, negative, or
    // nonnumeric input into a valid value of one.
    state.participants = C.val(mount, 'booking-participants');
  }

  function validate(room = null) {
    const result = slotValidation(state, { today, capacity: room?.capacity ?? null });
    state.errors = result.errors;
    if (!Object.keys(result.errors).length) state.participants = result.participants;
    return Object.keys(result.errors).length === 0;
  }

  const slotLabel = () => `${state.start}–${state.end}`;

  // Search bar.
  function locationSelect() {
    const favIds = favorites.list('building');
    const fav = buildings.filter((item) => favIds.includes(item.bbl_id));
    const rest = buildings.filter((item) => !favIds.includes(item.bbl_id));
    const option = (item) => `<option value="${C.escape(item.bbl_id)}"${item.bbl_id === state.buildingId ? ' selected' : ''}>${
      C.escape(item.name)} · ${C.escape(item.city)} (${formatNumber(bookableRoomCount(item.bbl_id))})</option>`;
    const groups = fav.length
      ? `<optgroup label="★ Meine Standorte">${fav.map(option).join('')}</optgroup>`
        + `<optgroup label="Alle Standorte">${rest.map(option).join('')}</optgroup>`
      : buildings.map(option).join('');
    return `<div class="form__group__select booking-bar__location">
      <label for="booking-location">Standort</label>
      <div class="booking-bar__location-row">
        ${C.selectBox(`<select id="booking-location" name="booking-location" class="input--outline input--base">${groups}</select>`)}
        ${favoriteButton('building', state.buildingId, building().name)}
      </div>
    </div>`;
  }

  // One favourite toggle appears in two places. aria-pressed communicates its state.
  function favoriteButton(kind, id, name, { size = '' } = {}) {
    const on = favorites.has(kind, id);
    const what = kind === 'building' ? 'Standort' : 'Raum';
    return `<button type="button" class="btn btn--outline btn--icon-only booking-fav${size ? ` ${size}` : ''}"
      id="${domId(`booking-fav-${kind}`, id)}" data-fav-kind="${kind}" data-fav-id="${C.escape(id)}"
      aria-pressed="${on}" title="${on ? 'Aus meinen Favoriten entfernen' : 'Als Favorit merken'}">
      ${C.icon(on ? 'StarFilled' : 'Star', 'btn__icon')}
      <span class="sr-only">${C.escape(name)} als ${what} merken</span></button>`;
  }

  function searchBar() {
    const quick = [
      ['today', 'Heute'],
      ['tomorrow', 'Morgen'],
      ['now30', 'Jetzt für 30 Min.'],
    ];
    return `<form id="booking-search" class="booking-bar" novalidate>
      <div class="booking-bar__grid">
        ${locationSelect()}
        ${C.field({ id: 'booking-date', label: 'Datum', required: true, message: state.errors['booking-date'],
          control: (cls, attrs) => `<input id="booking-date" type="date" min="${today}" value="${C.escape(state.date)}" class="${cls}"${attrs}>` })}
        ${C.field({ id: 'booking-start', label: 'Von', required: true, message: state.errors['booking-start'],
          control: (cls, attrs) => `<input id="booking-start" type="time" step="900" value="${C.escape(state.start)}" class="${cls}"${attrs}>` })}
        ${C.field({ id: 'booking-end', label: 'Bis', required: true, message: state.errors['booking-end'],
          control: (cls, attrs) => `<input id="booking-end" type="time" step="900" value="${C.escape(state.end)}" class="${cls}"${attrs}>` })}
        ${C.field({ id: 'booking-participants', label: 'Personen', required: true, message: state.errors['booking-participants'],
          control: (cls, attrs) => `<input id="booking-participants" type="number" min="1" max="100" step="1" inputmode="numeric" value="${state.participants}" class="${cls}"${attrs}>` })}
        <div class="booking-bar__submit">
          <button class="btn btn--filled" id="booking-search-submit" type="submit"><span class="btn__text">Räume anzeigen</span></button>
        </div>
      </div>
      <div class="booking-quick">
        <span class="booking-quick__label" id="booking-quick-label">Schnellauswahl</span>
        <div class="booking-quick__list" role="group" aria-labelledby="booking-quick-label">
          ${quick.map(([key, label]) => `<button type="button" class="tag-item tag-item--sm" data-quick="${key}">
            <span class="tag-item__inner"><span class="tag-item__text">${C.escape(label)}</span></span></button>`).join('')}
        </div>
      </div>
    </form>`;
  }

  // Result list.
  function filterPanel() {
    return `<div class="catbar__panel-grid">
      ${C.filterGroup({ dim: 'equipment', legend: 'Ausstattung', selected: state.filters.equipment,
        options: EQUIPMENT_OPTIONS.map((value) => ({ value, label: value })), idPrefix: 'booking' })}
      ${C.filterGroup({ dim: 'accessible', legend: 'Barrierefreiheit', selected: state.filters.accessible,
        options: [{ value: 'yes', label: 'Rollstuhlgängig' }], idPrefix: 'booking' })}
    </div>${C.panelReset({ id: 'booking-filter-reset' })}`;
  }

  function chips(room, profile) {
    const items = profile.equipment.map((value) => `<li class="booking-chip">${C.escape(value)}</li>`);
    if (profile.accessible) items.push('<li class="booking-chip">Barrierefrei</li>');
    // Missing video service is the only commonly requested gap, so show it as
    // an explicit card warning instead of an absence users must infer.
    if (!profile.equipment.includes('Teams')) items.push('<li class="booking-chip booking-chip--warn">Kein Teams</li>');
    return `<ul class="booking-chips" aria-label="Ausstattung von ${C.escape(profile.name)}">${items.join('')}</ul>`;
  }

  function roomRow(room, context, { primary = false } = {}) {
    const profile = context.profiles.get(room.spaceId);
    const window = freeWindow(room, context);
    const titleId = domId('booking-room-title', room.spaceId);
    return `<article class="booking-room${primary ? ' booking-room--primary' : ''}" aria-labelledby="${titleId}">
      <p class="booking-room__code" aria-hidden="true"><strong>${C.escape(roomCode(room))}</strong><span>${C.escape(floorLabel(room))}</span></p>
      <div class="booking-room__body">
        <h4 class="booking-room__title" id="${titleId}">${C.escape(profile.name)}
          <span class="booking-room__meta">${C.escape(room.roomNumber)} · ${formatNumber(room.capacity)} Plätze · ${formatArea(room.area)}</span>
          ${window ? C.badge(`Frei ${hhmm(window.from)}–${hhmm(window.to)}`, 'success', 'sm') : ''}
          ${profile.favorite ? C.badge('★ Favorit', 'gray', 'sm') : ''}
        </h4>
        ${chips(room, profile)}
      </div>
      <div class="booking-room__actions">
        ${favoriteButton('room', room.spaceId, profile.name, { size: 'btn--sm' })}
        <button type="button" class="btn btn--bare btn--sm" id="${domId('booking-details', room.spaceId)}" data-details="${C.escape(room.spaceId)}">
          <span class="btn__text">Details</span><span class="sr-only">: ${C.escape(profile.name)}</span></button>
        <button type="button" class="btn ${primary ? 'btn--filled' : 'btn--outline'}" id="${domId('booking-book', room.spaceId)}" data-book="${C.escape(room.spaceId)}">
          <span class="btn__text">${C.escape(slotLabel())} buchen</span><span class="sr-only">: ${C.escape(profile.name)}</span></button>
      </div>
    </article>`;
  }

  function resultList(rooms, context) {
    if (!rooms.length) {
      return C.empty('Keine verfügbaren Räume gefunden.', {
        hint: 'Ändern Sie Zeitraum, Gruppengrösse oder Filter.',
        action: { id: 'booking-filter-clear', label: 'Filter zurücksetzen' },
      });
    }
    const visible = state.showAll ? rooms : rooms.slice(0, PAGE_SIZE);
    const rest = rooms.length - visible.length;
    return `<div class="booking-rooms">
      ${visible.map((room, index) => roomRow(room, context, { primary: index === 0 && state.sort === 'best' })).join('')}
      ${rest > 0 ? `<button type="button" class="btn btn--link booking-more" id="booking-show-all">
        <span class="btn__text">${formatNumber(rest)} weitere ${rest === 1 ? 'Raum' : 'Räume'} anzeigen</span>${C.icon('ArrowDown', 'btn__icon')}</button>` : ''}
    </div>`;
  }

  function findView(context) {
    if (state.created) return doneView();
    const rooms = sortedAvailableRooms(context);
    const total = context.rooms.length;
    lastSearchSummary = { available: rooms.length, total, date: state.date, slot: slotLabel() };
    const filterCount = state.filters.equipment.length + state.filters.accessible.length;
    return `<div class="vertical-spacing booking-find">
      ${C.errorSummary({ errors: state.errors, labels: FIELD_LABELS, id: 'booking-errors' })}
      ${searchBar()}
      <section class="booking-results" aria-labelledby="booking-results-title">
        <div class="booking-resulthead">
          <div class="booking-resulthead__count">
            <h3 id="booking-results-title"><strong>${formatNumber(rooms.length)}</strong> von ${formatNumber(total)} Räumen frei</h3>
            <p class="small muted">${C.escape(building().city)} · ${C.escape(formatDate(state.date))}, ${C.escape(slotLabel())} · ab ${formatNumber(state.participants)} Plätze</p>
          </div>
        </div>
        ${C.catalogueBar({
          showSearch: false,
          countId: 'booking-count',
          count: `<span class="sr-only">${formatNumber(rooms.length)} von ${formatNumber(total)} Räumen frei</span>`,
          sort: { id: 'booking-sort', label: 'Sortierung', value: state.sort, options: [
            { value: 'best', label: 'Beste Übereinstimmung' },
            { value: 'capacity', label: 'Kapazität' },
            { value: 'room', label: 'Raumnummer' },
          ] },
          filterId: 'booking-filter-toggle', filterLabel: 'Ausstattung filtern', filterCount,
          panelId: 'booking-filter-panel', panel: filterPanel(), panelHidden: !state.filterOpen,
          // The floor plan is a supporting location view, not an alternate list
          // view, so expose it as a secondary action rather than a view switch.
          extra: `<button type="button" class="btn btn--bare btn--sm btn--icon-left catbar__aside" id="booking-plan-open">
            ${C.icon('Map', 'btn__icon')}<span class="btn__text">Grundriss ansehen</span></button>`,
        })}
        ${resultList(rooms, context)}
      </section>
    </div>`;
  }

  // Dialogs.
  // CD modal body supplies the white surface over the scrim; content uses a card within it.
  const dialogBody = (html) => `<div class="card card--default"><div class="card__content"><div class="card__body">${html}</div></div></div>`;

  // Open only one dialog to avoid stacked focus traps. openModal closes through
  // Escape, backdrop, and its button without an onClose callback, so a short
  // observer also tears down dialog-owned map and floor-plan resources.
  function openDialog(opts) {
    if (closeDialog) closeDialog();
    freeDialogResources();
    const close = C.openModal(opts);
    const el = document.body.lastElementChild;
    let finished = false;
    let removalObserver = null;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (removalObserver) removalObserver.disconnect();
      freeDialogResources();
      if (closeDialog === wrapped) closeDialog = null;
    };
    const wrapped = () => {
      if (finished) return;
      finish();
      if (el?.isConnected) close();
    };
    if (typeof MutationObserver === 'function' && el) {
      removalObserver = new MutationObserver(() => { if (!el.isConnected) finish(); });
      removalObserver.observe(document.body, { childList: true });
    }
    closeDialog = wrapped;
    return wrapped;
  }

  function roomFacts(room, profile) {
    const currentBuilding = building();
    return `<dl class="kv kv--tight booking-dialog__facts">
      <dt>Wann</dt><dd>${C.escape(formatDate(state.date))}, ${C.escape(slotLabel())}</dd>
      <dt>Wo</dt><dd>${C.escape(room.roomNumber)} · ${C.escape(currentBuilding.name)}</dd>
      <dt>Raum</dt><dd>${formatNumber(room.capacity)} Plätze · ${C.escape(profile.equipment.join(', '))}</dd>
    </dl>`;
  }

  function openBookingDialog(spaceId) {
    const room = roomById(spaceId);
    if (!room) return;
    const actionContext = prepareBookingContext();
    if (!isAvailable(room, actionContext)) {
      C.flashError(mount, 'Dieser Raum ist im gewählten Zeitraum nicht mehr verfügbar.');
      draw();
      return;
    }
    const profile = actionContext.profiles.get(room.spaceId);
    // Keep dialog-local state isolated so Cancel has no effect on the page.
    const invitees = [];
    let inviteError = '';

    const close = openDialog({
      id: 'booking-dialog', size: 'md', title: `${profile.name} buchen`,
      body: dialogBody(`<form id="booking-form" class="form booking-dialog" novalidate>
        <div class="booking-dialog__head">
          ${roomFacts(room, profile)}
          <button type="button" class="btn btn--link btn--sm" id="booking-dialog-change"><span class="btn__text">Ändern</span><span class="sr-only">: Termin und Zeit</span></button>
        </div>
        <div id="booking-dialog-errors"></div>
        ${C.field({ id: 'booking-title', label: 'Sitzungstitel', required: true,
          control: (cls, attrs) => `<input id="booking-title" type="text" maxlength="120" placeholder="z. B. Bereichssitzung" class="${cls}"${attrs}>` })}
        <div class="form__group booking-invite">
          <label for="booking-invite">Personen einladen <span class="muted">(optional)</span></label>
          <div class="booking-invite__control">
            <input id="booking-invite" type="text" class="input--outline input--base" list="booking-directory" autocomplete="off" placeholder="Name oder E-Mail">
            <button type="button" class="btn btn--outline btn--icon-left" id="booking-invite-add">${C.icon('Plus', 'btn__icon')}<span class="btn__text">Hinzufügen</span></button>
          </div>
          <datalist id="booking-directory">${DIRECTORY.map((person) => `<option value="${C.escape(person.name)}">${C.escape(person.email)}</option>`).join('')}</datalist>
          <div id="booking-invite-msg"></div>
          <div class="booking-invitees" id="booking-invitees" aria-label="Eingeladene Personen"></div>
        </div>
      </form>`),
      footer: `<button type="button" class="btn btn--outline" data-modal-close>Abbrechen</button>
        <button type="submit" form="booking-form" class="btn btn--filled" id="booking-submit">Verbindlich buchen</button>`,
    });

    const dialog = document.querySelector('#booking-dialog-title')?.closest('.modal') || document;
    const q = (sel) => dialog.querySelector(sel);

    function paintInvitees() {
      const host = q('#booking-invitees');
      if (!host) return;
      host.innerHTML = invitees.map((person, index) => `
        <button type="button" class="tag-item tag-item--sm" data-remove-invite="${index}" aria-label="${C.escape(person.name)} entfernen">
          <span class="tag-item__inner"><span class="tag-item__text">${C.escape(person.name)}</span>${C.icon('Cancel', 'icon--sm')}</span>
        </button>`).join('');
      host.querySelectorAll('[data-remove-invite]').forEach((button) => button.addEventListener('click', () => {
        invitees.splice(Number(button.dataset.removeInvite), 1);
        paintInvitees();
        q('#booking-invite')?.focus();
      }));
    }

    function paintInviteError() {
      const host = q('#booking-invite-msg');
      if (host) host.innerHTML = inviteError ? `<div class="badge badge--sm badge--error">${C.escape(inviteError)}</div>` : '';
    }

    const addInvitee = () => {
      const input = q('#booking-invite');
      const person = parseInvitee(input?.value);
      if (!person) inviteError = 'Bitte einen Namen oder eine gültige E-Mail-Adresse eingeben';
      else if (invitees.some((item) => (item.email && item.email === person.email) || item.name === person.name)) {
        inviteError = 'Diese Person ist bereits eingeladen';
      } else {
        invitees.push(person);
        inviteError = '';
        if (input) input.value = '';
        C.announce(`${person.name} hinzugefügt.`);
      }
      paintInviteError();
      paintInvitees();
    };

    q('#booking-invite-add')?.addEventListener('click', addInvitee);
    q('#booking-invite')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); addInvitee(); }
    });
    // The German UI term: `Ändern` returns to the search bar because time
    // applies to the complete result list.
    q('#booking-dialog-change')?.addEventListener('click', () => {
      close();
      mount.querySelector('#booking-date')?.focus();
    });

    q('#booking-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const titleInput = q('#booking-title');
      const meetingTitle = String(titleInput?.value || '').trim();
      const errorHost = q('#booking-dialog-errors');
      if (!meetingTitle) {
        if (errorHost) errorHost.innerHTML = C.notification('Bitte einen Sitzungstitel angeben.', 'error', 'WarningCircle', { live: true });
        titleInput?.classList.add('input--error');
        titleInput?.setAttribute('aria-invalid', 'true');
        titleInput?.focus();
        return;
      }
      // URL, search bar, and dialog share validation so manipulated or stale
      // ranges cannot bypass checks and persist.
      if (!validate(room)) {
        close();
        draw();
        C.wireErrorSummary(mount);
        return;
      }
      // Recheck immediately before writing because the room may have been booked
      // since the dialog opened.
      if (!isAvailable(room, prepareBookingContext())) {
        close();
        C.flashError(mount, `${profile.name} ist im gewählten Zeitraum nicht mehr verfügbar.`);
        draw();
        return;
      }
      const created = engine.start('buchung', {
        title: `${meetingTitle} · ${profile.name}`,
        organization: session.user().org,
        requester: session.user().name,
        data: {
          'gebaeude': building().name,
          'raum': room.roomNumber,
          'raumId': room.spaceId,
          'raumname': profile.name,
          'geschoss': floorLabel(room),
          'datum': state.date,
          start: state.start,
          'ende': state.end,
          'zeit': slotLabel(),
          'teilnehmende': state.participants,
          'zweck': meetingTitle,
          'eingeladene': invitees.map((person) => person.email ? `${person.name} <${person.email}>` : person.name),
        },
        linkedEntities: { buildingId: state.buildingId },
      });
      close();
      state.created = created ? (engine.advance(created.instanceId) || created) : null;
      if (!state.created) { C.flashError(mount, 'Die Buchung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.'); return; }
      state.createdInvitees = invitees.map((person) => person.name);
      draw();
      C.focusProcessDone(mount, state.created);
    });

    paintInvitees();
    q('#booking-title')?.focus();
  }

  function openDetailsDialog(spaceId) {
    const room = roomById(spaceId);
    if (!room) return;
    const actionContext = prepareBookingContext();
    const profile = actionContext.profiles.get(room.spaceId);
    const currentBuilding = building();
    const available = isAvailable(room, actionContext);
    const close = openDialog({
      id: 'booking-details-dialog', size: 'sm', title: `${profile.name} · ${room.roomNumber}`,
      body: dialogBody(`<dl class="kv kv--tight">
          <dt>Standort</dt><dd>${C.escape(currentBuilding.name)}<br>${C.escape(currentBuilding.street)}, ${C.escape(currentBuilding.zip)} ${C.escape(currentBuilding.city)}</dd>
          <dt>Geschoss</dt><dd>${C.escape(floorLabel(room))}</dd>
          <dt>Kapazität</dt><dd>${formatNumber(room.capacity)} Plätze</dd>
          <dt>Fläche</dt><dd>${formatArea(room.area)}</dd>
        </dl>
        <ul class="booking-feature-list" aria-label="Raumausstattung">
          ${profile.equipment.map((feature) => `<li>${C.icon(feature === 'Teams' || feature === 'Videokonferenz' ? 'Video' : 'Desktop', 'icon--base')}<span>${C.escape(feature)}</span></li>`).join('')}
          ${profile.accessible ? `<li>${C.icon('Wheelchair', 'icon--base')}<span>Rollstuhlgängig</span></li>` : ''}
        </ul>
        <p class="small muted booking-details__note">Für Sitzungsräume sind keine Fotos hinterlegt. Die Lage zeigt der Grundriss.</p>`),
      footer: `<button type="button" class="btn btn--outline btn--icon-left" id="booking-details-plan">${C.icon('Map', 'btn__icon')}<span class="btn__text">Im Grundriss zeigen</span></button>
        ${available ? `<button type="button" class="btn btn--filled" id="booking-details-book">${C.escape(slotLabel())} buchen</button>` : ''}`,
    });
    document.querySelector('#booking-details-plan')?.addEventListener('click', () => { close(); openFloorplanDialog(room.spaceId); });
    document.querySelector('#booking-details-book')?.addEventListener('click', () => { close(); openBookingDialog(room.spaceId); });
  }

  // The floor plan answers location and remains a selection path: clicking an
  // available room opens its booking dialog.
  function openFloorplanDialog(spaceId = '') {
    const floorRows = floors();
    if (!floorRows.length) { C.flashError(mount, 'Für dieses Gebäude ist kein Grundriss verfügbar.'); return; }
    const room = spaceId ? roomById(spaceId) : null;
    let floorId = room?.floorId || floorRows[0].floorId;

    const close = openDialog({
      // Use modal--lg: modal--xl exposes overflow for chart endpoint labels and
      // would let a tall floor plan escape instead of scrolling.
      id: 'booking-plan-dialog', size: 'lg', title: `Grundriss · ${building().name}`,
      body: dialogBody(`<div class="booking-plan" id="booking-plan"></div>`),
    });

    function paint() {
      const host = document.querySelector('#booking-plan');
      if (!host) return;
      // Changing floors replaces the complete plan; dispose old wiring and
      // observers before replacing its subtree.
      if (unwirePlan) { unwirePlan(); unwirePlan = null; }
      if (unwirePlanScroll) { unwirePlanScroll(); unwirePlanScroll = null; }
      const activeFloor = floorRows.find((floor) => floor.floorId === floorId) || floorRows[0];
      const spaces = core.spacesForFloor(activeFloor.floorId);
      const actionContext = prepareBookingContext();
      const statuses = {};
      const selectableIds = [];
      spaces.forEach((space) => {
        if (!space.bookable || space.useType !== 'sitzung') return;
        if (!matchesCriteria(space, actionContext)) statuses[space.spaceId] = 'unsuitable';
        else if (isAvailable(space, actionContext)) { statuses[space.spaceId] = 'available'; selectableIds.push(space.spaceId); }
        else statuses[space.spaceId] = 'unavailable';
      });
      host.innerHTML = `<div class="booking-floorbar" role="group" aria-label="Geschoss wechseln">
          ${floorRows.map((floor) => `<button type="button" class="tag-item${floor.floorId === activeFloor.floorId ? ' tag-item--active' : ''}"
            data-plan-floor="${C.escape(floor.floorId)}"${floor.floorId === activeFloor.floorId ? ' aria-current="true" disabled' : ''}>
            <span class="tag-item__inner"><span class="tag-item__text">${C.escape(floor.label)}</span></span></button>`).join('')}
        </div>
        <div class="fp-stage booking-plan__stage" id="booking-plan-stage" data-scroll-region aria-label="Grundriss ${C.escape(activeFloor.label)}">
          ${floorplanSvg({ floor: activeFloor, spaces, mode: 'none', selectedId: spaceId, statuses, selectableIds })}
        </div>
        <ul class="booking-plan__legend" aria-label="Verfügbarkeit im Grundriss">
          <li><span class="booking-plan__swatch booking-plan__swatch--available"></span>Verfügbar</li>
          <li><span class="booking-plan__swatch booking-plan__swatch--unavailable"></span>Belegt</li>
          <li><span class="booking-plan__swatch booking-plan__swatch--unsuitable"></span>Nicht passend</li>
        </ul>
        <p class="small muted">Ein freier Raum im Plan führt direkt zur Buchung für ${C.escape(slotLabel())}.</p>`;
      host.querySelectorAll('[data-plan-floor]').forEach((button) => button.addEventListener('click', () => {
        floorId = button.dataset.planFloor;
        paint();
        document.querySelector('.booking-floorbar .tag-item--active')?.focus();
      }));
      const stage = document.querySelector('#booking-plan-stage');
      if (stage) unwirePlan = wireFloorplan(stage, (picked) => { close(); openBookingDialog(picked); });
      unwirePlanScroll = C.wireScrollRegions(host);
    }
    paint();
  }

  function openLocationMapDialog() {
    const mapped = buildings.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
    openDialog({
      id: 'booking-map-dialog', size: 'lg', title: 'Standorte mit buchbaren Räumen',
      body: dialogBody(mapped.length
        ? `<div class="dash-map booking-map" id="booking-map" role="group" aria-label="Buchbare Standorte auf der Karte">${C.loading({ label: 'Karte wird geladen…' })}</div>`
        : C.empty('Für diese Standorte sind keine Kartenpositionen verfügbar.')),
    });
    const el = document.querySelector('#booking-map');
    if (!el) return;
    dialogMap.mount(el, (node) => initEstateMap(node, mapped.map((item) => ({
      lat: item.lat, lon: item.lng, label: item.name,
      sub: `${item.street}, ${item.zip} ${item.city} · ${formatNumber(bookableRoomCount(item.bbl_id))} buchbare Räume`,
      bblId: item.bbl_id,
      href: `#/app/portfolio?id=${encodeURIComponent(item.bbl_id)}`,
      // With no focused building, the all-locations dialog must show all locations
      // rather than zooming to the selected one.
    })), null, null, { focusPopup: false }));
  }

  // Confirmation.
  function doneView() {
    const instance = state.created;
    const room = roomById(instance.data?.['raumId']);
    const invited = state.createdInvitees || [];
    return `<div class="vertical-spacing container__center--sm booking-done">
      ${C.processDone({
        instance,
        lead: instance.status === 'abgeschlossen' ? 'Raum gebucht.' : 'Buchung erfasst.',
        title: 'Buchung abgeschlossen',
        heading: 'h2',
        text: `Ihre Buchung «${C.escape(instance.data?.['zweck'] || instance.title)}» wurde bestätigt.`,
        extra: room ? `<div class="booking-done__summary">
          <dl class="kv">
            <dt>Gebäude</dt><dd>${C.escape(instance.data?.['gebaeude'] || '')}</dd>
            <dt>Raum</dt><dd>${C.escape(instance.data?.['raumname'] || '')} · ${C.escape(room.roomNumber)}</dd>
            <dt>Datum</dt><dd>${C.escape(formatDate(instance.data?.['datum']))}</dd>
            <dt>Zeit</dt><dd>${C.escape(instance.data?.['zeit'] || '')}</dd>
            <dt>Teilnehmende</dt><dd>${formatNumber(instance.data?.['teilnehmende'] || 0)}</dd>
          </dl>
          ${invited.length ? `<p class="small"><strong>Eingeladen:</strong> ${C.escape(invited.join(', '))}</p>` : ''}
        </div>` : '',
        actions: [
          { id: 'booking-calendar-download', label: 'Kalendereintrag herunterladen', icon: 'Download' },
          { id: 'booking-again', label: 'Weiteren Raum buchen', icon: 'Plus' },
          { href: '#/app/room-booking?tab=bookings', label: 'Meine Buchungen', icon: 'ArrowRight' },
        ],
      })}
    </div>`;
  }

  // Personal bookings.
  function bookingInstances(instances) {
    return instances.filter((instance) => instance.defId === 'buchung' && instance.requester === session.user().name);
  }

  function bookingItem(instance) {
    const data = instance.data || {};
    const room = roomById(data['raumId'])
      || meetingRooms.find((item) => item.buildingId === instance.linkedEntities?.buildingId && item.roomNumber === data['raum']);
    const currentBuilding = core.building(instance.linkedEntities?.buildingId);
    const cancelled = CANCELLED.has(instance.status);
    const roomLabel = data['raumname'] ? `${data['raumname']} · ${data['raum'] || ''}` : (room ? room.roomNumber : data['raum'] || 'Raum');
    const invitees = Array.isArray(data['eingeladene']) ? data['eingeladene'] : [];
    return `<article class="booking-entry">
      <div class="booking-entry__date"><strong>${C.escape(formatDate(data['datum']))}</strong><span>${C.escape(data['zeit'] || `${data.start || ''}–${data['ende'] || ''}`)}</span></div>
      <div class="booking-entry__body">
        <h4>${C.escape(data['zweck'] || instance.title)}</h4>
        <p>${C.escape(roomLabel)} · ${C.escape(currentBuilding?.name || data['gebaeude'] || '')}</p>
        <p class="small muted">${formatNumber(data['teilnehmende'] || 0)} Teilnehmende${invitees.length ? ` · ${formatNumber(invitees.length)} eingeladen` : ''}</p>
      </div>
      <div class="booking-entry__status">${cancelled ? C.badge('Storniert', 'gray', 'sm') : C.badge('Bestätigt', 'success', 'sm')}</div>
      <div class="booking-entry__actions">
        ${cancelled ? '' : `<button type="button" class="btn btn--outline btn--sm" data-booking-calendar="${C.escape(instance.instanceId)}">${C.icon('Calendar', 'btn__icon')}<span class="btn__text">Kalender</span></button>`}
        ${instance.createdLocally && isUpcoming(instance) ? `<button type="button" class="btn btn--outline btn--sm" data-booking-cancel="${C.escape(instance.instanceId)}">${C.icon('Cancel', 'btn__icon')}<span class="btn__text">Stornieren</span></button>` : ''}
        ${!isUpcoming(instance) ? `<button type="button" class="btn btn--bare btn--sm btn--icon-right" data-booking-repeat="${C.escape(instance.instanceId)}"><span class="btn__text">Erneut buchen</span>${C.icon('ArrowRight', 'btn__icon')}</button>` : ''}
      </div>
    </article>`;
  }

  // Favourite locations belong to the maintained list here, not the active search controls.
  function favouriteLocations() {
    const ids = favorites.list('building');
    const rows = ids.map((id) => buildings.find((item) => item.bbl_id === id)).filter(Boolean);
    return `<section class="booking-favs" aria-labelledby="booking-favs-title">
      <h3 id="booking-favs-title">Meine Standorte</h3>
      ${rows.length ? `<ul class="booking-favs__list">${rows.map((item) => `<li>
          <a href="#/app/room-booking?building=${encodeURIComponent(item.bbl_id)}">${C.icon('StarFilled', 'icon--base')}<span>${C.escape(item.name)}</span></a>
          <span class="small muted">${formatNumber(bookableRoomCount(item.bbl_id))} Räume</span>
        </li>`).join('')}</ul>`
        : `<p class="small muted">Noch keine Standorte gemerkt. Der Stern neben dem Standortfeld merkt einen Standort für die nächste Suche.</p>`}
      <button type="button" class="btn btn--link btn--icon-left" id="booking-map-open">${C.icon('Map', 'btn__icon')}<span class="btn__text">Alle ${formatNumber(buildings.length)} Standorte auf der Karte</span></button>
    </section>`;
  }

  function bookingsView(rows) {
    const upcoming = rows.filter(isUpcoming).sort((a, b) => `${a.data?.['datum']}${a.data?.start || ''}`.localeCompare(`${b.data?.['datum']}${b.data?.start || ''}`));
    const past = rows.filter((row) => !isUpcoming(row))
      .sort((a, b) => `${b.data?.['datum'] || ''}${b.data?.start || ''}`.localeCompare(`${a.data?.['datum'] || ''}${a.data?.start || ''}`));
    return `<div class="booking-manage vertical-spacing">
      <section aria-labelledby="booking-upcoming-title">
        <h3 id="booking-upcoming-title">Bevorstehende Buchungen</h3>
        ${upcoming.length ? `<div class="booking-entry-list">${upcoming.map(bookingItem).join('')}</div>`
          : C.empty('Keine bevorstehenden Buchungen.', { action: { href: '#/app/room-booking', label: 'Raum finden' } })}
      </section>
      ${past.length ? `<section aria-labelledby="booking-past-title"><h3 id="booking-past-title">Vergangene und stornierte Buchungen</h3>
        <div class="booking-entry-list">${past.map(bookingItem).join('')}</div></section>` : ''}
      ${favouriteLocations()}
    </div>`;
  }

  function confirmCancellation(instance) {
    const close = openDialog({
      id: 'booking-cancel-modal', size: 'sm', title: 'Buchung stornieren?',
      body: dialogBody(`<p class="m-0">Die Buchung <strong>${C.escape(instance.data?.['zweck'] || instance.title)}</strong> wird aufgehoben und der Raum wieder freigegeben.</p>`),
      footer: `<button type="button" class="btn btn--outline" data-modal-close>Abbrechen</button>
        <button type="button" class="btn btn--filled" id="booking-cancel-confirm">Buchung stornieren</button>`,
    });
    document.querySelector('#booking-cancel-confirm')?.addEventListener('click', () => {
      const cancelled = engine.cancel(instance.instanceId);
      close();
      if (cancelled) { C.announce('Buchung storniert.'); draw(); }
      else C.flashError(mount, 'Die Buchung konnte nicht storniert werden.');
    });
  }

  // Wiring.
  function announceResults() {
    if (!lastSearchSummary) return;
    C.announce(`${lastSearchSummary.available} von ${lastSearchSummary.total} Räumen frei am ${formatDate(lastSearchSummary.date)}, ${lastSearchSummary.slot}.`);
  }

  // A quick choice sets date and time and searches immediately; requiring another
  // show-rooms click would add confirmation work only.
  function applyQuick(kind) {
    const now = new Date();
    if (kind === 'today') state.date = localDate(now);
    if (kind === 'tomorrow') {
      const d = new Date(); d.setDate(d.getDate() + 1); state.date = localDate(d);
    }
    if (kind === 'now30') {
      state.date = localDate(now);
      const from = Math.min(floorQuarter(now.getHours() * 60 + now.getMinutes()), DAY_END - 30);
      state.start = hhmm(Math.max(DAY_START, from));
      state.end = hhmm(Math.max(DAY_START, from) + 30);
    }
    state.errors = {};
    state.showAll = false;
    syncUrl();
    draw();
    announceResults();
  }

  function wireFind() {
    C.wireFieldErrors(mount, state.errors);
    C.wireErrorSummary(mount, { focus: false });

    mount.querySelector('#booking-location')?.addEventListener('change', (event) => {
      state.buildingId = event.target.value;
      state.showAll = false;
      syncUrl();
      draw();
      C.announce(`${building().name} ausgewählt.`);
      announceResults();
    });

    const form = mount.querySelector('#booking-search');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      readSearchBar();
      state.showAll = false;
      if (!validate()) { draw(); C.wireErrorSummary(mount); return; }
      syncUrl();
      draw();
      announceResults();
    });

    mount.querySelectorAll('[data-quick]').forEach((button) => button.addEventListener('click', () => applyQuick(button.dataset.quick)));

    mount.querySelector('#booking-sort')?.addEventListener('change', (event) => {
      state.sort = event.target.value;
      state.showAll = false;
      syncUrl(); draw();
    });
    const filterButton = mount.querySelector('#booking-filter-toggle');
    const filterPanelEl = mount.querySelector('#booking-filter-panel');
    filterButton?.addEventListener('click', () => {
      state.filterOpen = filterPanelEl.hidden;
      filterPanelEl.hidden = !state.filterOpen;
      filterButton.setAttribute('aria-expanded', String(state.filterOpen));
    });
    filterPanelEl?.addEventListener('change', (event) => {
      const checkbox = event.target.closest('input[data-fdim]');
      if (!checkbox) return;
      const dimension = checkbox.dataset.fdim;
      state.filters[dimension] = [...filterPanelEl.querySelectorAll(`input[data-fdim="${dimension}"]:checked`)].map((item) => item.value);
      state.showAll = false;
      syncUrl(); draw();
      announceResults();
    });
    const resetFilters = () => {
      state.filters = { equipment: [], accessible: [] };
      state.showAll = false;
      syncUrl(); draw();
      announceResults();
    };
    mount.querySelector('#booking-filter-reset')?.addEventListener('click', resetFilters);
    mount.querySelector('#booking-filter-clear')?.addEventListener('click', resetFilters);
    mount.querySelector('#booking-show-all')?.addEventListener('click', () => { state.showAll = true; draw(); });

    mount.querySelectorAll('[data-book]').forEach((button) => button.addEventListener('click', () => openBookingDialog(button.dataset.book)));
    mount.querySelectorAll('[data-details]').forEach((button) => button.addEventListener('click', () => openDetailsDialog(button.dataset.details)));
    mount.querySelector('#booking-plan-open')?.addEventListener('click', () => openFloorplanDialog());

    mount.querySelector('#booking-calendar-download')?.addEventListener('click', () => calendarFile(state.created));
    mount.querySelector('#booking-again')?.addEventListener('click', () => {
      state.created = null;
      state.createdInvitees = null;
      draw();
      mount.querySelector('#booking-date')?.focus();
    });
  }

  function wireBookings() {
    mount.querySelectorAll('[data-booking-calendar]').forEach((button) => button.addEventListener('click', () => {
      const instance = engine.instance(button.dataset.bookingCalendar);
      if (instance) calendarFile(instance);
    }));
    mount.querySelectorAll('[data-booking-cancel]').forEach((button) => button.addEventListener('click', () => {
      const instance = engine.instance(button.dataset.bookingCancel);
      if (instance) confirmCancellation(instance);
    }));
    mount.querySelectorAll('[data-booking-repeat]').forEach((button) => button.addEventListener('click', () => {
      const instance = engine.instance(button.dataset.bookingRepeat);
      if (!instance) return;
      const data = instance.data || {};
      state.tab = 'find';
      state.buildingId = instance.linkedEntities?.buildingId || state.buildingId;
      state.participants = Number(data['teilnehmende']) || state.participants;
      state.date = nextWorkday();
      state.start = safeTime(data.start, state.start);
      state.end = safeTime(data['ende'], state.end);
      state.created = null;
      state.showAll = false;
      syncUrl(); draw();
      // Continue directly if the same room is free at the new time; otherwise show
      // its location list. Resolve roomById before isAvailable to avoid a false placeholder.
      const repeatRoom = roomById(data['raumId']);
      if (repeatRoom && isAvailable(repeatRoom, prepareBookingContext())) openBookingDialog(repeatRoom.spaceId);
      else announceResults();
    }));
    mount.querySelector('#booking-map-open')?.addEventListener('click', openLocationMapDialog);
  }

  function wire() {
    C.wireTabs(mount, { onSelect: (tab) => { state.tab = tab; syncUrl(); } });
    // Favourites affect defaults, ordering, and badges, so redraw fully while
    // preserveFocus keeps the toggle focused.
    mount.querySelectorAll('[data-fav-kind]').forEach((button) => button.addEventListener('click', () => {
      const on = favorites.toggle(button.dataset.favKind, button.dataset.favId);
      C.announce(on ? 'Als Favorit gemerkt.' : 'Favorit entfernt.');
      draw();
    }));
    wireFind();
    wireBookings();
  }

  function draw() {
    const restore = C.preserveFocus(mount);
    if (unwirePlan) { unwirePlan(); unwirePlan = null; }
    const instanceSnapshot = session.isLoggedIn() ? engine.instances() : [];
    const bookings = session.isLoggedIn() ? bookingInstances(instanceSnapshot) : [];
    const bookingContext = session.isLoggedIn() ? prepareBookingContext(instanceSnapshot) : null;
    const upcomingCount = bookings.filter(isUpcoming).length;
    lastSearchSummary = null;
    const tabs = [
      { id: 'find', label: 'Raum finden' },
      { id: 'bookings', label: `Meine Buchungen (${formatNumber(upcomingCount)})` },
    ];
    mount.innerHTML = `<div class="container section">
      ${C.pageHeader({ title: 'Raumbuchung', lead: 'Sitzungs- und Besprechungsräume an den Standorten des Bundes finden und reservieren.' })}
      ${session.isLoggedIn() ? `<div class="tabs booking-tabs">
        ${C.tabBar({ items: tabs, active: state.tab, idPrefix: 'booking-tab', ariaLabel: 'Raumbuchung' })}
        ${C.tabPanels({ items: tabs, active: state.tab, idPrefix: 'booking-tab', heading: true,
          render: (tab) => tab === 'find' ? findView(bookingContext) : bookingsView(bookings) })}
      </div>` : C.loginGate('Raumbuchungen sind persönliche Vorgänge. Melden Sie sich mit AGOV / FedLogin an, um einen Raum zu reservieren.')}
    </div>`;
    wire();
    restore();
  }

  draw();
  // Keep the full search state in the URL from first load so shared links render
  // identically. replaceState avoids history noise and preserves router scroll state.
  syncUrl();

  // Open a deep-linked room only after drawing its page fallback.
  if (pendingDeepLink && session.isLoggedIn() && state.tab === 'find') {
    const room = roomById(pendingDeepLink);
    pendingDeepLink = '';
    if (room && isAvailable(room, prepareBookingContext())) openBookingDialog(room.spaceId);
    else if (room) openDetailsDialog(room.spaceId);
  }
}
