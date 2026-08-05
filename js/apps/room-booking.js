// Room Booking: availability search, floor-plan selection, invitations, and booking management.

import { ANWENDUNGEN, trail } from '../crumbs.js';
import { initEstateMap } from '../buildings-map.js';
import { createMapSlot } from '../map-slot.js';
import { floorplanSvg, wireFloorplan } from '../floorplan.js';
import { download, fileSlug } from '../export.js';
import { datum, m2, num } from '../format.js';

export const needs = ['buildings', 'floors', 'spaces'];

const PREFERRED_BUILDING = '1080/6650/AA';
const ROOM_NAMES = ['Aare', 'Aletsch', 'Emme', 'Jura', 'Limmat', 'Reuss', 'Rhone', 'Saane', 'Sense', 'Säntis', 'Thur', 'Zürichsee'];
const EQUIPMENT_OPTIONS = ['Bildschirm', 'Teams', 'Whiteboard', 'Videokonferenz'];
const DIRECTORY = [
  { name: 'Anna Keller', email: 'anna.keller@bafu.admin.ch' },
  { name: 'Marco Rossi', email: 'marco.rossi@bafu.admin.ch' },
  { name: 'Sophie Dubois', email: 'sophie.dubois@bag.admin.ch' },
  { name: 'Luca Bernasconi', email: 'luca.bernasconi@blv.admin.ch' },
  { name: 'Nina Meier', email: 'nina.meier@bbl.admin.ch' },
];
const VIEWS = [['list', 'Listenansicht', 'List'], ['floorplan', 'Grundrissansicht', 'Map']];
const CANCELLED = new Set(['zurueckgezogen', 'storniert']);
const FIELD_LABELS = {
  'booking-date': 'Datum',
  'booking-start': 'Von',
  'booking-end': 'Bis',
  'booking-participants': 'Teilnehmende',
  'booking-room-group': 'Raum',
  'booking-title': 'Sitzungstitel',
};

const localDate = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const nextWorkday = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  return localDate(date);
};

const minuteOfDay = (value) => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
};

const rangesOverlap = (startA, endA, startB, endB) => startA < endB && startB < endA;
const roomHash = (value) => [...String(value || '')].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
const safeDate = (value, fallback) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : fallback;
const safeTime = (value, fallback) => /^\d{2}:\d{2}$/.test(String(value || '')) ? String(value) : fallback;

export default async function render(ctx) {
  const { mount, query, core, engine, session, C, setTitle, setCrumbs, onUnmount } = ctx;
  setTitle('Raumbuchung');
  setCrumbs(trail(ANWENDUNGEN, { label: 'Raumbuchung' }));

  const meetingRooms = core.spaces().filter((space) => space.bookable && space.useType === 'sitzung');
  const buildingIds = new Set(meetingRooms.map((space) => space.buildingId));
  const buildings = core.buildings()
    .filter((building) => buildingIds.has(building.bbl_id))
    .sort((a, b) => `${a.land} ${a.city} ${a.name}`.localeCompare(`${b.land} ${b.city} ${b.name}`, 'de'));

  if (!buildings.length) {
    mount.innerHTML = `<div class="container section">
      ${C.pageHeader({ title: 'Raumbuchung', lead: 'Sitzungs- und Besprechungsräume reservieren.' })}
      ${C.empty('Zurzeit sind keine buchbaren Räume verfügbar.', { available: core.available('spaces') })}
    </div>`;
    return;
  }

  const requestedRoom = meetingRooms.find((room) => room.spaceId === query.get('room')) || null;
  const requestedBuilding = requestedRoom?.buildingId || query.get('building');
  const initialBuilding = buildings.find((item) => item.bbl_id === requestedBuilding)
    || buildings.find((item) => item.bbl_id === PREFERRED_BUILDING)
    || buildings[0];
  const today = localDate(new Date());
  const requestedParticipants = Number.parseInt(query.get('participants'), 10);
  const requestedView = query.get('view');
  const requestedTab = query.get('tab');
  const requestedEquipment = String(query.get('equipment') || '').split(',').filter((value) => EQUIPMENT_OPTIONS.includes(value));

  const state = {
    tab: requestedTab === 'bookings' ? 'bookings' : 'find',
    view: requestedView === 'floorplan' ? 'floorplan' : 'list',
    buildingId: initialBuilding.bbl_id,
    date: safeDate(query.get('date'), nextWorkday()),
    start: safeTime(query.get('start'), '09:00'),
    end: safeTime(query.get('end'), '10:00'),
    participants: Number.isFinite(requestedParticipants) ? Math.max(1, Math.min(100, requestedParticipants)) : 4,
    roomId: requestedRoom?.spaceId || '',
    floorId: requestedRoom?.floorId || query.get('floor') || '',
    meetingTitle: '',
    invitees: [],
    inviteError: '',
    errors: {},
    created: null,
    sort: ['best', 'capacity', 'room'].includes(query.get('sort')) ? query.get('sort') : 'best',
    filters: {
      equipment: requestedEquipment,
      accessible: query.get('accessible') === '1' ? ['yes'] : [],
    },
    filterOpen: false,
    showAll: false,
    planScale: 1,
  };

  const locationMap = createMapSlot();
  let unwirePlan = null;
  onUnmount(locationMap.free);
  onUnmount(() => { if (unwirePlan) unwirePlan(); });

  const building = () => buildings.find((item) => item.bbl_id === state.buildingId) || buildings[0];
  const buildingRooms = () => meetingRooms
    .filter((room) => room.buildingId === state.buildingId)
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, 'de', { numeric: true }));
  const floors = () => core.floors()
    .filter((floor) => floor.buildingId === state.buildingId && buildingRooms().some((room) => room.floorId === floor.floorId))
    .sort((a, b) => a.level - b.level);
  const floorLabel = (room) => core.floor(room.floorId)?.label || room.roomNumber.split(' ')[0] || '—';

  function roomProfile(room) {
    const rows = buildingRooms();
    const index = Math.max(0, rows.findIndex((item) => item.spaceId === room.spaceId));
    const seed = roomHash(room.spaceId);
    const equipment = ['Bildschirm'];
    if (seed % 2 === 0) equipment.push('Teams');
    if (seed % 3 !== 0) equipment.push('Whiteboard');
    if (room.capacity >= 14) equipment.push('Videokonferenz');
    const currentBuilding = core.building(room.buildingId) || building();
    const interior = (currentBuilding.bilder || []).find((image) => /innenansicht/i.test(`${image.titel || ''} ${image.src || ''}`));
    const demoPhoto = room.buildingId === PREFERRED_BUILDING && /-(eg-06|eg-07|1og-16)$/.test(room.spaceId);
    return {
      name: ROOM_NAMES[index % ROOM_NAMES.length],
      equipment: [...new Set(equipment)],
      accessible: floorLabel(room) === 'EG' || seed % 3 !== 0,
      photoSrc: interior?.src || (demoPhoto ? 'assets/images/applications/raumbuchung.jpg' : ''),
      photoAlt: interior ? `Innenansicht von ${currentBuilding.name}` : demoPhoto ? 'Beispiel eines ausgestatteten Sitzungszimmers' : '',
      photoNote: interior ? 'Innenansicht des Gebäudes' : demoPhoto ? 'Symbolbild des Raumtyps' : '',
    };
  }

  function instanceRange(instance) {
    const data = instance.data || {};
    const stored = String(data.zeit || '').split(/\s*[–-]\s*/);
    const start = minuteOfDay(data.start || stored[0]);
    const end = minuteOfDay(data.ende || stored[1]);
    return { start, end };
  }

  function roomMatchesInstance(room, instance) {
    const data = instance.data || {};
    if (data.raumId) return data.raumId === room.spaceId;
    return instance.linkedEntities?.buildingId === room.buildingId && data.raum === room.roomNumber;
  }

  function isAvailable(room) {
    const start = minuteOfDay(state.start), end = minuteOfDay(state.end);
    if (!state.date || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
    return !engine.instances().some((instance) => {
      if (instance.defId !== 'buchung' || CANCELLED.has(instance.status) || instance.data?.datum !== state.date) return false;
      if (!roomMatchesInstance(room, instance)) return false;
      const occupied = instanceRange(instance);
      return Number.isFinite(occupied.start) && Number.isFinite(occupied.end)
        && rangesOverlap(start, end, occupied.start, occupied.end);
    });
  }

  function matchesCriteria(room) {
    const profile = roomProfile(room);
    if (room.capacity < state.participants) return false;
    if (state.filters.accessible.length && !profile.accessible) return false;
    return state.filters.equipment.every((item) => profile.equipment.includes(item));
  }

  function sortedAvailableRooms() {
    const rooms = buildingRooms().filter((room) => matchesCriteria(room) && isAvailable(room));
    if (state.sort === 'room') return rooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, 'de', { numeric: true }));
    if (state.sort === 'capacity') return rooms.sort((a, b) => a.capacity - b.capacity || a.roomNumber.localeCompare(b.roomNumber, 'de', { numeric: true }));
    return rooms.sort((a, b) => {
      const scoreA = (a.capacity - state.participants) * 10 - roomProfile(a).equipment.length;
      const scoreB = (b.capacity - state.participants) * 10 - roomProfile(b).equipment.length;
      return scoreA - scoreB || a.roomNumber.localeCompare(b.roomNumber, 'de', { numeric: true });
    });
  }

  function normalizeSelection({ keepFloor = false } = {}) {
    const available = sortedAvailableRooms();
    if (!available.some((room) => room.spaceId === state.roomId)) state.roomId = available[0]?.spaceId || '';
    const selected = available.find((room) => room.spaceId === state.roomId) || null;
    const floorRows = floors();
    if (!keepFloor && selected) state.floorId = selected.floorId;
    if (!floorRows.some((floor) => floor.floorId === state.floorId)) state.floorId = selected?.floorId || floorRows[0]?.floorId || '';
  }

  normalizeSelection();
  const selectedRoom = () => sortedAvailableRooms().find((room) => room.spaceId === state.roomId) || null;

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.tab !== 'find') params.set('tab', state.tab);
    if (state.view !== 'list') params.set('view', state.view);
    params.set('building', state.buildingId);
    params.set('date', state.date);
    params.set('start', state.start);
    params.set('end', state.end);
    params.set('participants', String(state.participants));
    if (state.roomId) params.set('room', state.roomId);
    if (state.view === 'floorplan' && state.floorId) params.set('floor', state.floorId);
    if (state.sort !== 'best') params.set('sort', state.sort);
    if (state.filters.equipment.length) params.set('equipment', state.filters.equipment.join(','));
    if (state.filters.accessible.length) params.set('accessible', '1');
    history.replaceState(history.state, '', `#/app/room-booking?${params}`);
  }

  function readCriteria() {
    const nextBuilding = C.val(mount, 'booking-building') || state.buildingId;
    if (nextBuilding !== state.buildingId) {
      state.buildingId = nextBuilding;
      state.roomId = '';
      state.floorId = '';
    }
    state.date = C.val(mount, 'booking-date') || '';
    state.start = C.val(mount, 'booking-start') || '';
    state.end = C.val(mount, 'booking-end') || '';
    state.participants = Math.max(1, Number.parseInt(C.val(mount, 'booking-participants'), 10) || 1);
    const title = mount.querySelector('#booking-title');
    if (title) state.meetingTitle = title.value;
  }

  function validate({ requireRoom = false } = {}) {
    const errors = {};
    const start = minuteOfDay(state.start), end = minuteOfDay(state.end);
    if (!state.date) errors['booking-date'] = 'Bitte ein Datum wählen';
    else if (state.date < today) errors['booking-date'] = 'Bitte ein heutiges oder zukünftiges Datum wählen';
    if (!Number.isFinite(start)) errors['booking-start'] = 'Bitte eine Startzeit angeben';
    if (!Number.isFinite(end)) errors['booking-end'] = 'Bitte eine Endzeit angeben';
    else if (Number.isFinite(start) && end <= start) errors['booking-end'] = 'Die Endzeit muss nach der Startzeit liegen';
    if (!state.participants || state.participants < 1 || state.participants > 100) {
      errors['booking-participants'] = 'Bitte 1 bis 100 Teilnehmende angeben';
    }
    if (requireRoom) {
      const room = selectedRoom();
      if (!room) errors['booking-room-group'] = 'Bitte einen verfügbaren Raum wählen';
      else if (!isAvailable(room)) errors['booking-room-group'] = 'Dieser Raum ist im gewählten Zeitraum nicht mehr verfügbar';
      if (!state.meetingTitle.trim()) errors['booking-title'] = 'Bitte einen Sitzungstitel angeben';
    }
    state.errors = errors;
    return Object.keys(errors).length === 0;
  }

  function roomImage(profile, { thumb = false } = {}) {
    if (!profile.photoSrc) {
      return `<div class="booking-room-image booking-room-image--empty${thumb ? ' booking-room-image--thumb' : ''}">
        ${C.icon('Image', thumb ? 'icon--base' : 'icon--2xl')}<span${thumb ? ' class="sr-only"' : ''}>Kein Raumfoto verfügbar</span></div>`;
    }
    return C.photo({
      src: profile.photoSrc,
      alt: profile.photoAlt,
      color: 'var(--color-secondary-100)',
      cls: `booking-room-image${thumb ? ' booking-room-image--thumb' : ''}`,
      w: thumb ? 240 : 720,
    });
  }

  function roomList(rooms) {
    if (!rooms.length) {
      return C.empty('Keine verfügbaren Räume gefunden.', {
        hint: 'Ändern Sie Zeitraum, Gruppengrösse oder Filter.',
      });
    }
    let visible = state.showAll ? rooms : rooms.slice(0, 6);
    const selected = rooms.find((room) => room.spaceId === state.roomId);
    if (!state.showAll && selected && !visible.includes(selected)) visible = [selected, ...rooms.filter((room) => room !== selected)].slice(0, 6);
    return `<fieldset class="booking-room-list" id="booking-room-group" tabindex="-1"${state.errors['booking-room-group'] ? ' aria-invalid="true" aria-describedby="booking-room-group-msg"' : ''}>
      <legend class="sr-only">Verfügbaren Raum wählen</legend>
      ${visible.map((room) => {
        const profile = roomProfile(room);
        const id = `booking-room-${room.spaceId.replace(/[^a-z0-9_-]/gi, '-')}`;
        const features = [...profile.equipment, ...(profile.accessible ? ['Barrierefrei'] : [])];
        return `<label class="booking-room-row${room.spaceId === state.roomId ? ' is-selected' : ''}" for="${C.escape(id)}">
          <input id="${C.escape(id)}" type="radio" name="booking-room" value="${C.escape(room.spaceId)}"${room.spaceId === state.roomId ? ' checked' : ''}>
          ${roomImage(profile, { thumb: true })}
          <span class="booking-room-row__body">
            <strong>${C.escape(profile.name)} · ${C.escape(room.roomNumber)}</strong>
            <span class="booking-room-row__meta">${C.escape(floorLabel(room))} · ${num(room.capacity)} Plätze · ${m2(room.area)}</span>
            <span class="booking-room-row__features">${C.escape(features.join(' · '))}</span>
          </span>
          ${C.badge('Verfügbar', 'success', 'sm')}
        </label>`;
      }).join('')}
      ${!state.showAll && rooms.length > visible.length ? `<button type="button" class="btn btn--link booking-show-all" id="booking-show-all">
        <span class="btn__text">Alle ${num(rooms.length)} Räume anzeigen</span>${C.icon('ArrowDown', 'btn__icon')}</button>` : ''}
      ${state.errors['booking-room-group'] ? `<div class="badge badge--sm badge--error" id="booking-room-group-msg">${C.escape(state.errors['booking-room-group'])}</div>` : ''}
    </fieldset>`;
  }

  function floorplanView() {
    const floorRows = floors();
    const activeFloor = floorRows.find((floor) => floor.floorId === state.floorId) || floorRows[0];
    if (!activeFloor) return C.empty('Für dieses Gebäude ist kein Grundriss verfügbar.');
    const spaces = core.spacesForFloor(activeFloor.floorId);
    const statuses = {};
    const selectableIds = [];
    spaces.forEach((space) => {
      if (!space.bookable || space.useType !== 'sitzung') return;
      if (!matchesCriteria(space)) statuses[space.spaceId] = 'unsuitable';
      else if (isAvailable(space)) { statuses[space.spaceId] = 'available'; selectableIds.push(space.spaceId); }
      else statuses[space.spaceId] = 'unavailable';
    });
    return `<div class="booking-floorplan" id="booking-room-group" tabindex="-1"${state.errors['booking-room-group'] ? ' aria-invalid="true" aria-describedby="booking-room-group-msg"' : ''}>
      <div class="booking-floorbar" role="group" aria-label="Geschoss wechseln">
        ${floorRows.map((floor) => `<button type="button" class="tag-item${floor.floorId === activeFloor.floorId ? ' tag-item--active' : ''}"
          data-booking-floor="${C.escape(floor.floorId)}"${floor.floorId === activeFloor.floorId ? ' aria-current="true" disabled' : ''}>
          <span class="tag-item__inner"><span class="tag-item__text">${C.escape(floor.label)}</span></span></button>`).join('')}
      </div>
      <div class="booking-plan-shell">
        <div class="booking-plan-tools" role="group" aria-label="Grundriss vergrössern">
          <button type="button" class="btn btn--outline btn--icon-only" data-plan-zoom="in" aria-label="Vergrössern" title="Vergrössern">${C.icon('Plus', 'btn__icon')}</button>
          <button type="button" class="btn btn--outline btn--icon-only" data-plan-zoom="out" aria-label="Verkleinern" title="Verkleinern">${C.icon('Minus', 'btn__icon')}</button>
          <button type="button" class="btn btn--outline btn--icon-only" data-plan-zoom="fit" aria-label="Grundriss einpassen" title="Einpassen">${C.icon('Refresh', 'btn__icon')}</button>
        </div>
        <div class="fp-stage booking-plan-stage" id="booking-floorplan-stage" data-scroll-region aria-label="Grundriss ${C.escape(activeFloor.label)}">
          <div class="booking-plan-canvas" style="width:${state.planScale * 100}%">${floorplanSvg({
            floor: activeFloor,
            spaces,
            mode: 'none',
            selectedId: state.roomId,
            statuses,
            selectableIds,
          })}</div>
        </div>
      </div>
      <ul class="booking-plan-legend" aria-label="Verfügbarkeit im Grundriss">
        <li><span class="booking-plan-legend__swatch booking-plan-legend__swatch--available"></span>Verfügbar</li>
        <li><span class="booking-plan-legend__swatch booking-plan-legend__swatch--unavailable"></span>Belegt</li>
        <li><span class="booking-plan-legend__swatch booking-plan-legend__swatch--unsuitable"></span>Nicht passend</li>
        <li><span class="booking-plan-legend__swatch booking-plan-legend__swatch--selected"></span>Ausgewählt</li>
      </ul>
      ${state.errors['booking-room-group'] ? `<div class="badge badge--sm badge--error" id="booking-room-group-msg">${C.escape(state.errors['booking-room-group'])}</div>` : ''}
    </div>`;
  }

  function filterPanel() {
    return `<div class="catbar__panel__grid">
      ${C.filterGroup({ dim: 'equipment', legend: 'Ausstattung', selected: state.filters.equipment,
        options: EQUIPMENT_OPTIONS.map((value) => ({ value, label: value })), idPrefix: 'booking' })}
      ${C.filterGroup({ dim: 'accessible', legend: 'Barrierefreiheit', selected: state.filters.accessible,
        options: [{ value: 'yes', label: 'Rollstuhlgängig' }], idPrefix: 'booking' })}
    </div>${C.panelReset({ id: 'booking-filter-reset' })}`;
  }

  function bookingSummary(room) {
    const currentBuilding = building();
    const profile = roomProfile(room);
    return `<dl class="kv booking-summary__facts">
      <dt>Gebäude</dt><dd>${C.escape(currentBuilding.name)}</dd>
      <dt>Raum</dt><dd>${C.escape(profile.name)} · ${C.escape(room.roomNumber)}</dd>
      <dt>Datum</dt><dd>${C.escape(datum(state.date))}</dd>
      <dt>Zeit</dt><dd>${C.escape(`${state.start}–${state.end}`)}</dd>
      <dt>Teilnehmende</dt><dd>${num(state.participants)}</dd>
    </dl>`;
  }

  function inviteeMarkup() {
    if (!state.invitees.length) return '';
    return `<div class="booking-invitees" aria-label="Eingeladene Personen">${state.invitees.map((person, index) => `
      <button type="button" class="tag-item tag-item--sm" data-remove-invite="${index}" aria-label="${C.escape(person.name)} entfernen">
        <span class="tag-item__inner"><span class="tag-item__text">${C.escape(person.name)}</span>${C.icon('Cancel', 'icon--sm')}</span>
      </button>`).join('')}</div>`;
  }

  function locationSection() {
    const currentBuilding = building();
    const hasCoordinates = Number.isFinite(currentBuilding.lat) && Number.isFinite(currentBuilding.lng);
    return `<section class="booking-side__section booking-location" aria-labelledby="booking-location-title">
      <h3 id="booking-location-title">Standort</h3>
      ${hasCoordinates
        ? `<div class="booking-location__map pf-map" id="booking-location-map" role="group" aria-label="Standort von ${C.escape(currentBuilding.name)} auf der Karte">${C.loading({ label: 'Karte wird geladen…' })}</div>`
        : '<div class="booking-location__map booking-location__map--empty">Keine Kartenposition verfügbar</div>'}
      <p class="booking-location__name"><strong>${C.escape(currentBuilding.name)}</strong></p>
      <p class="small muted">${C.escape(currentBuilding.street)}, ${C.escape(currentBuilding.zip)} ${C.escape(currentBuilding.city)}</p>
      <a class="btn btn--link btn--sm btn--icon-right" href="#/app/portfolio?id=${encodeURIComponent(currentBuilding.bbl_id)}">
        <span class="btn__text">Gebäude ansehen</span>${C.icon('ArrowRight', 'btn__icon')}</a>
    </section>`;
  }

  function selectedRoomSection() {
    const room = selectedRoom();
    if (!room) {
      return `<section class="booking-side__section"><h3>Raum auswählen</h3>
        <p class="small muted">Wählen Sie einen verfügbaren Raum in der Liste oder im Grundriss.</p></section>`;
    }
    const profile = roomProfile(room);
    return `<section class="booking-side__section booking-selected" aria-labelledby="booking-selected-title">
      <figure class="booking-selected__figure">
        ${roomImage(profile)}
        <figcaption>${C.escape(profile.photoNote || 'Für diesen Raum ist noch kein Foto hinterlegt.')}</figcaption>
      </figure>
      <h3 id="booking-selected-title">${C.escape(profile.name)} · ${C.escape(room.roomNumber)}</h3>
      <dl class="kv kv--tight booking-selected__facts">
        <dt>Geschoss</dt><dd>${C.escape(floorLabel(room))}</dd>
        <dt>Kapazität</dt><dd>${num(room.capacity)} Plätze</dd>
        <dt>Fläche</dt><dd>${m2(room.area)}</dd>
      </dl>
      <ul class="booking-feature-list" aria-label="Raumausstattung">
        ${profile.equipment.map((feature) => `<li>${C.icon(feature === 'Teams' || feature === 'Videokonferenz' ? 'Video' : 'Desktop', 'icon--base')}<span>${C.escape(feature)}</span></li>`).join('')}
        ${profile.accessible ? `<li>${C.icon('Wheelchair', 'icon--base')}<span>Rollstuhlgängig</span></li>` : ''}
      </ul>

      <form id="booking-form" class="form booking-confirm" novalidate>
        ${C.field({ id: 'booking-title', label: 'Sitzungstitel', required: true, message: state.errors['booking-title'],
          control: (cls, attrs) => `<input id="booking-title" type="text" maxlength="120" value="${C.escape(state.meetingTitle)}" class="${cls}"${attrs}>` })}
        <div class="form__group booking-invite">
          <label for="booking-invite">Personen einladen <span class="muted">(optional)</span></label>
          <div class="booking-invite__control">
            <input id="booking-invite" type="text" class="input--outline input--base" list="booking-directory" autocomplete="off" placeholder="Name oder E-Mail">
            <button type="button" class="btn btn--outline btn--icon-left" id="booking-invite-add">${C.icon('Plus', 'btn__icon')}<span class="btn__text">Hinzufügen</span></button>
          </div>
          <datalist id="booking-directory">${DIRECTORY.map((person) => `<option value="${C.escape(person.name)}">${C.escape(person.email)}</option>`).join('')}</datalist>
          ${state.inviteError ? `<div class="badge badge--sm badge--error" id="booking-invite-error">${C.escape(state.inviteError)}</div>` : ''}
          ${inviteeMarkup()}
        </div>
        <div class="booking-confirm__summary">
          <h4>Ihre Buchung</h4>
          ${bookingSummary(room)}
        </div>
        <button class="btn btn--filled btn--lg btn--icon-right booking-confirm__submit" type="submit">
          <span class="btn__text">Raum verbindlich buchen</span>${C.icon('ArrowRight', 'btn__icon')}
        </button>
      </form>
    </section>`;
  }

  function searchForm() {
    return `<form id="booking-search-form" class="form booking-search" novalidate>
      <fieldset class="form__group">
        <legend class="form__group__legend">Buchungsangaben</legend>
        <div class="booking-search__grid">
          ${C.select({ id: 'booking-building', label: 'Standort', required: true, value: state.buildingId,
            options: buildings.map((item) => ({ value: item.bbl_id, label: `${item.name} — ${item.city}` })) })}
          ${C.field({ id: 'booking-date', label: 'Datum', required: true, message: state.errors['booking-date'],
            control: (cls, attrs) => `<input id="booking-date" type="date" min="${today}" value="${C.escape(state.date)}" class="${cls}"${attrs}>` })}
          ${C.field({ id: 'booking-start', label: 'Von', required: true, message: state.errors['booking-start'],
            control: (cls, attrs) => `<input id="booking-start" type="time" step="900" value="${C.escape(state.start)}" class="${cls}"${attrs}>` })}
          ${C.field({ id: 'booking-end', label: 'Bis', required: true, message: state.errors['booking-end'],
            control: (cls, attrs) => `<input id="booking-end" type="time" step="900" value="${C.escape(state.end)}" class="${cls}"${attrs}>` })}
          ${C.field({ id: 'booking-participants', label: 'Teilnehmende', required: true, message: state.errors['booking-participants'],
            control: (cls, attrs) => `<input id="booking-participants" type="number" min="1" max="100" step="1" value="${state.participants}" class="${cls}"${attrs}>` })}
          <div class="booking-search__action"><button class="btn btn--filled btn--icon-right" type="submit">
            <span class="btn__text">Räume anzeigen</span>${C.icon('ArrowRight', 'btn__icon')}</button></div>
        </div>
      </fieldset>
    </form>`;
  }

  function findView() {
    if (state.created) return doneView();
    const rooms = sortedAvailableRooms();
    const filterCount = state.filters.equipment.length + state.filters.accessible.length;
    return `<div class="vertical-spacing booking-find">
      ${C.errorSummary({ errors: state.errors, labels: FIELD_LABELS, id: 'booking-errors' })}
      ${searchForm()}
      <section class="booking-results" aria-labelledby="booking-results-title">
        <h2 class="sr-only" id="booking-results-title">Verfügbare Räume</h2>
        ${C.catalogueBar({
          showSearch: false,
          countId: 'booking-count',
          count: `<strong>${num(rooms.length)}</strong> ${rooms.length === 1 ? 'verfügbarer Raum' : 'verfügbare Räume'}`,
          sort: { id: 'booking-sort', label: 'Sortierung', value: state.sort, options: [
            { value: 'best', label: 'Beste Übereinstimmung' },
            { value: 'capacity', label: 'Kapazität' },
            { value: 'room', label: 'Raumnummer' },
          ] },
          filterId: 'booking-filter-toggle', filterLabel: 'Ausstattung und Barrierefreiheit', filterCount,
          panelId: 'booking-filter-panel', panel: filterPanel(), panelHidden: !state.filterOpen,
          view: state.view, views: VIEWS,
        })}
        <div class="booking-layout">
          <div class="booking-results__main">${state.view === 'floorplan' ? floorplanView() : roomList(rooms)}</div>
          <aside class="booking-side" aria-label="Standort und ausgewählter Raum">
            ${locationSection()}
            <div id="booking-room-detail">${selectedRoomSection()}</div>
          </aside>
        </div>
      </section>
    </div>`;
  }

  function bookingData(instance) {
    const data = instance.data || {};
    const room = meetingRooms.find((item) => item.spaceId === data.raumId)
      || meetingRooms.find((item) => item.buildingId === instance.linkedEntities?.buildingId && item.roomNumber === data.raum);
    const currentBuilding = core.building(instance.linkedEntities?.buildingId);
    return { data, room, currentBuilding, profile: room ? roomProfile(room) : null };
  }

  function isUpcoming(instance) {
    if (CANCELLED.has(instance.status)) return false;
    const data = instance.data || {};
    const end = data.ende || String(data.zeit || '').split(/\s*[–-]\s*/)[1] || '23:59';
    const stamp = new Date(`${data.datum || '1900-01-01'}T${end}:00`).getTime();
    return Number.isFinite(stamp) && stamp >= Date.now();
  }

  function bookingItem(instance) {
    const { data, room, currentBuilding, profile } = bookingData(instance);
    const cancelled = CANCELLED.has(instance.status);
    const title = data.zweck || instance.title;
    const roomLabel = profile && room ? `${profile.name} · ${room.roomNumber}` : data.raum || 'Raum';
    const invitees = Array.isArray(data.eingeladene) ? data.eingeladene : [];
    return `<article class="booking-entry">
      <div class="booking-entry__date"><strong>${C.escape(datum(data.datum))}</strong><span>${C.escape(data.zeit || `${data.start || ''}–${data.ende || ''}`)}</span></div>
      <div class="booking-entry__body">
        <h4>${C.escape(title)}</h4>
        <p>${C.escape(roomLabel)} · ${C.escape(currentBuilding?.name || data.gebaeude || '')}</p>
        <p class="small muted">${num(data.teilnehmende || 0)} Teilnehmende${invitees.length ? ` · ${num(invitees.length)} eingeladen` : ''}</p>
      </div>
      <div class="booking-entry__status">${cancelled ? C.badge('Storniert', 'gray', 'sm') : C.badge('Bestätigt', 'success', 'sm')}</div>
      <div class="booking-entry__actions">
        ${cancelled ? '' : `<button type="button" class="btn btn--outline btn--sm" data-booking-calendar="${C.escape(instance.instanceId)}">${C.icon('Calendar', 'btn__icon')}<span class="btn__text">Kalender</span></button>`}
        ${instance.createdLocally && isUpcoming(instance) ? `<button type="button" class="btn btn--outline btn--sm" data-booking-cancel="${C.escape(instance.instanceId)}">${C.icon('Cancel', 'btn__icon')}<span class="btn__text">Stornieren</span></button>` : ''}
        ${!isUpcoming(instance) ? `<button type="button" class="btn btn--bare btn--sm btn--icon-right" data-booking-repeat="${C.escape(instance.instanceId)}"><span class="btn__text">Erneut buchen</span>${C.icon('ArrowRight', 'btn__icon')}</button>` : ''}
      </div>
    </article>`;
  }

  function bookingsView() {
    const rows = engine.instances()
      .filter((instance) => instance.defId === 'buchung' && instance.requester === session.user().name)
      .sort((a, b) => `${b.data?.datum || ''}${b.data?.start || ''}`.localeCompare(`${a.data?.datum || ''}${a.data?.start || ''}`));
    const upcoming = rows.filter(isUpcoming).sort((a, b) => `${a.data?.datum}${a.data?.start || ''}`.localeCompare(`${b.data?.datum}${b.data?.start || ''}`));
    const past = rows.filter((row) => !isUpcoming(row));
    return `<div class="booking-manage vertical-spacing">
      <section aria-labelledby="booking-upcoming-title">
        <h3 id="booking-upcoming-title">Bevorstehende Buchungen</h3>
        ${upcoming.length ? `<div class="booking-entry-list">${upcoming.map(bookingItem).join('')}</div>`
          : C.empty('Keine bevorstehenden Buchungen.', { action: { href: '#/app/room-booking', label: 'Raum finden' } })}
      </section>
      ${past.length ? `<section aria-labelledby="booking-past-title"><h3 id="booking-past-title">Vergangene und stornierte Buchungen</h3>
        <div class="booking-entry-list">${past.map(bookingItem).join('')}</div></section>` : ''}
    </div>`;
  }

  function doneView() {
    const instance = state.created;
    const room = meetingRooms.find((item) => item.spaceId === instance.data?.raumId) || selectedRoom();
    return `<div class="vertical-spacing container__center--sm booking-done">
      ${C.processDone({
        instance,
        lead: instance.status === 'abgeschlossen' ? 'Raum gebucht.' : 'Buchung erfasst.',
        title: 'Buchung abgeschlossen',
        heading: 'h2',
        text: `Ihre Buchung «${C.escape(instance.data?.zweck || instance.title)}» wurde bestätigt.`,
        extra: room ? `<div class="booking-done__summary">${bookingSummary(room)}${state.invitees.length
          ? `<p class="small"><strong>Eingeladen:</strong> ${C.escape(state.invitees.map((person) => person.name).join(', '))}</p>` : ''}</div>` : '',
        actions: [
          { id: 'booking-calendar-download', label: 'Kalendereintrag herunterladen', icon: 'Download' },
          { href: '#/app/room-booking?tab=bookings', label: 'Meine Buchungen', icon: 'ArrowRight' },
        ],
      })}
    </div>`;
  }

  function bookingInstances() {
    return engine.instances().filter((instance) => instance.defId === 'buchung' && instance.requester === session.user().name);
  }

  function calendarFile(instance) {
    const data = instance.data || {};
    const compact = (date, time) => `${String(date || '').replaceAll('-', '')}T${String(time || '').replace(':', '')}00`;
    const escIcs = (value) => String(value || '').replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;');
    const invitees = (Array.isArray(data.eingeladene) ? data.eingeladene : []).map((value) => {
      const match = /^(.*?)\s*<([^>]+)>$/.exec(String(value));
      return match ? `ATTENDEE;CN=${escIcs(match[1])}:mailto:${match[2]}` : '';
    }).filter(Boolean);
    const location = `${data.gebaeude || ''}, ${data.raum || ''}`;
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const content = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BBL//Raumbuchung Prototype//DE', 'BEGIN:VEVENT',
      `UID:${escIcs(instance.reference)}@bbl.demo`, `DTSTAMP:${now}`, `DTSTART;TZID=Europe/Zurich:${compact(data.datum, data.start)}`,
      `DTEND;TZID=Europe/Zurich:${compact(data.datum, data.ende)}`, `SUMMARY:${escIcs(data.zweck || instance.title)}`,
      `LOCATION:${escIcs(location)}`, `DESCRIPTION:${escIcs(`${data.teilnehmende || ''} Teilnehmende`)}`, ...invitees,
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    download(content, `${fileSlug(data.zweck || 'raumbuchung')}.ics`, 'text/calendar;charset=utf-8');
  }

  function parseInvitee(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const found = DIRECTORY.find((person) => person.name.toLocaleLowerCase('de-CH') === raw.toLocaleLowerCase('de-CH')
      || person.email.toLocaleLowerCase('de-CH') === raw.toLocaleLowerCase('de-CH'));
    if (found) return found;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return { name: raw.split('@')[0], email: raw };
    if (raw.length >= 3) return { name: raw, email: '' };
    return null;
  }

  function mountLocationMap() {
    if (state.tab !== 'find' || state.created) return;
    const currentBuilding = building();
    const el = mount.querySelector('#booking-location-map');
    if (!el || !Number.isFinite(currentBuilding.lat) || !Number.isFinite(currentBuilding.lng)) return;
    locationMap.mount(el, (node) => initEstateMap(node, [{
      lat: currentBuilding.lat,
      lon: currentBuilding.lng,
      label: currentBuilding.name,
      sub: `${currentBuilding.street}, ${currentBuilding.zip} ${currentBuilding.city}`,
      bblId: currentBuilding.bbl_id,
    }], null, currentBuilding.bbl_id, { focusPopup: false }));
  }

  function confirmCancellation(instance) {
    const close = C.openModal({
      id: 'booking-cancel-modal', size: 'sm', title: 'Buchung stornieren?',
      body: `<p>Die Buchung <strong>${C.escape(instance.data?.zweck || instance.title)}</strong> wird aufgehoben und der Raum wieder freigegeben.</p>`,
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

  function wireFind() {
    C.wireFieldErrors(mount, state.errors);

    mount.querySelector('#booking-search-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      readCriteria();
      if (!validate()) { draw(); C.wireErrorSummary(mount); return; }
      state.showAll = false;
      normalizeSelection();
      syncUrl();
      draw();
      C.announce(`${sortedAvailableRooms().length} verfügbare Räume gefunden.`);
    });

    mount.querySelector('#booking-sort')?.addEventListener('change', (event) => {
      state.sort = event.target.value;
      normalizeSelection(); syncUrl(); draw();
    });
    mount.querySelector('.view-switch')?.addEventListener('click', (event) => {
      const button = event.target.closest('.view-switch__btn');
      if (!button || button.dataset.view === state.view) return;
      state.view = button.dataset.view;
      state.planScale = 1;
      normalizeSelection(); syncUrl(); draw();
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
      const values = [...filterPanelEl.querySelectorAll(`input[data-fdim="${dimension}"]:checked`)].map((item) => item.value);
      state.filters[dimension] = values;
      normalizeSelection(); syncUrl(); draw();
    });
    mount.querySelector('#booking-filter-reset')?.addEventListener('click', () => {
      state.filters = { equipment: [], accessible: [] };
      normalizeSelection(); syncUrl(); draw();
    });
    mount.querySelector('#booking-show-all')?.addEventListener('click', () => { state.showAll = true; draw(); });

    mount.querySelectorAll('input[name="booking-room"]').forEach((radio) => radio.addEventListener('change', () => {
      state.roomId = radio.value;
      state.floorId = meetingRooms.find((room) => room.spaceId === radio.value)?.floorId || state.floorId;
      syncUrl(); draw();
    }));
    mount.querySelectorAll('[data-booking-floor]').forEach((button) => button.addEventListener('click', () => {
      state.floorId = button.dataset.bookingFloor;
      const first = sortedAvailableRooms().find((room) => room.floorId === state.floorId);
      state.roomId = first?.spaceId || '';
      state.planScale = 1;
      syncUrl(); draw();
    }));

    const stage = mount.querySelector('#booking-floorplan-stage');
    if (stage) {
      unwirePlan = wireFloorplan(stage, (spaceId) => {
        state.roomId = spaceId;
        state.floorId = meetingRooms.find((room) => room.spaceId === spaceId)?.floorId || state.floorId;
        syncUrl(); draw();
      });
    }
    mount.querySelectorAll('[data-plan-zoom]').forEach((button) => button.addEventListener('click', () => {
      const action = button.dataset.planZoom;
      state.planScale = action === 'fit' ? 1 : Math.max(1, Math.min(2.5, state.planScale + (action === 'in' ? 0.25 : -0.25)));
      const canvas = mount.querySelector('.booking-plan-canvas');
      if (canvas) canvas.style.width = `${state.planScale * 100}%`;
    }));

    const title = mount.querySelector('#booking-title');
    if (title) title.addEventListener('input', () => { state.meetingTitle = title.value; });
    const addInvitee = () => {
      if (title) state.meetingTitle = title.value;
      const input = mount.querySelector('#booking-invite');
      const person = parseInvitee(input?.value);
      if (!person) { state.inviteError = 'Bitte einen Namen oder eine gültige E-Mail-Adresse eingeben'; draw(); return; }
      if (state.invitees.some((item) => (item.email && item.email === person.email) || item.name === person.name)) {
        state.inviteError = 'Diese Person ist bereits eingeladen'; draw(); return;
      }
      state.invitees.push(person);
      state.inviteError = '';
      draw();
      C.announce(`${person.name} hinzugefügt.`);
    };
    mount.querySelector('#booking-invite-add')?.addEventListener('click', addInvitee);
    mount.querySelector('#booking-invite')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); addInvitee(); }
    });
    mount.querySelectorAll('[data-remove-invite]').forEach((button) => button.addEventListener('click', () => {
      if (title) state.meetingTitle = title.value;
      state.invitees.splice(Number(button.dataset.removeInvite), 1);
      draw();
    }));

    mount.querySelector('#booking-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      readCriteria();
      if (!validate({ requireRoom: true })) { draw(); C.wireErrorSummary(mount); return; }
      const room = selectedRoom();
      const currentBuilding = building();
      const profile = roomProfile(room);
      const created = engine.start('buchung', {
        title: `${state.meetingTitle.trim()} · ${profile.name}`,
        organization: session.user().org,
        requester: session.user().name,
        data: {
          gebaeude: currentBuilding.name,
          raum: room.roomNumber,
          raumId: room.spaceId,
          raumname: profile.name,
          geschoss: floorLabel(room),
          datum: state.date,
          start: state.start,
          ende: state.end,
          zeit: `${state.start}–${state.end}`,
          teilnehmende: state.participants,
          zweck: state.meetingTitle.trim(),
          eingeladene: state.invitees.map((person) => person.email ? `${person.name} <${person.email}>` : person.name),
        },
        linkedEntities: { buildingId: state.buildingId },
      });
      state.created = created ? (engine.advance(created.instanceId) || created) : null;
      draw();
      if (state.created) C.focusProcessDone(mount, state.created);
      else C.flashError(mount, 'Die Buchung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.');
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
      state.roomId = data.raumId || '';
      state.participants = Number(data.teilnehmende) || state.participants;
      state.meetingTitle = data.zweck ? `${data.zweck} (Kopie)` : '';
      state.date = nextWorkday();
      state.created = null;
      normalizeSelection(); syncUrl(); draw();
    }));
  }

  function wire() {
    C.wireTabs(mount, {
      onSelect: (tab) => {
        state.tab = tab;
        syncUrl();
        if (tab === 'find') requestAnimationFrame(() => {
          const map = locationMap.get();
          if (map?.resize) map.resize(); else mountLocationMap();
        });
      },
    });
    wireFind();
    wireBookings();
    mount.querySelector('#booking-calendar-download')?.addEventListener('click', () => calendarFile(state.created));
    mountLocationMap();
  }

  function draw() {
    const restore = C.preserveFocus(mount);
    locationMap.free();
    if (unwirePlan) { unwirePlan(); unwirePlan = null; }
    const bookings = session.isLoggedIn() ? bookingInstances() : [];
    const upcomingCount = bookings.filter(isUpcoming).length;
    const tabs = [
      { id: 'find', label: 'Raum finden' },
      { id: 'bookings', label: `Meine Buchungen (${num(upcomingCount)})` },
    ];
    mount.innerHTML = `<div class="container section">
      ${C.pageHeader({ title: 'Raumbuchung', lead: 'Sitzungs- und Besprechungsräume an den Standorten des Bundes finden und reservieren.' })}
      ${session.isLoggedIn() ? `<div class="tabs booking-tabs">
        ${C.tabBar({ items: tabs, active: state.tab, idPrefix: 'booking-tab', ariaLabel: 'Raumbuchung' })}
        ${C.tabPanels({ items: tabs, active: state.tab, idPrefix: 'booking-tab', heading: true,
          render: (tab) => tab === 'find' ? findView() : bookingsView() })}
      </div>` : C.loginGate('Raumbuchungen sind persönliche Vorgänge. Melden Sie sich mit AGOV / FedLogin an, um einen Raum zu reservieren.')}
    </div>`;
    wire();
    restore();
  }

  draw();
}
