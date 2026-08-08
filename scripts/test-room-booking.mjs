// Regression coverage for one-page direct booking: search, results, booking,
// map and floor-plan dialogs, favourites, personal bookings, and deep links.
// Assertions for the removed three-step wizard intentionally stay absent.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let failures = 0;
const check = (condition, label) => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures++;
};

const LOGIN = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let tries = 0;
  while (typeof window.__login !== 'function' && tries++ < 120) await wait(50);
  if (typeof window.__login !== 'function') return false;
  await window.__login();
  await wait(600);
  return true;
})()`;

const READY = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let tries = 0;
  while (!document.querySelector('#booking-search') && tries++ < 160) await wait(50);
  return !!document.querySelector('#booking-search');
})()`;

const SURFACE = `(() => {
  const headings = [...document.querySelectorAll('#main-content h1,#main-content h2,#main-content h3,#main-content h4')];
  const jumps = [];
  headings.reduce((previous, heading) => {
    const level = Number(heading.tagName[1]);
    if (previous && level > previous + 1) jumps.push(previous + '>' + level);
    return level;
  }, 0);
  const tabControls = document.querySelector('.booking-tabs .tab__controls');
  return {
    h1: document.querySelector('h1')?.textContent.trim() || '',
    tabs: document.querySelectorAll('.tab__control').length,
    // The former wizard has no step indicator or step navigation.
    steps: document.querySelectorAll('.step__indicator-step').length,
    stepNav: document.querySelectorAll('#booking-location-next,#booking-step-next,[data-booking-edit-step],[data-booking-back]').length,
    bar: !!document.querySelector('#booking-search'),
    barFields: document.querySelectorAll('#booking-location,#booking-date,#booking-start,#booking-end,#booking-participants').length,
    submit: !!document.querySelector('#booking-search-submit'),
    quick: document.querySelectorAll('[data-quick]').length,
    location: document.querySelector('#booking-location')?.value || '',
    rooms: document.querySelectorAll('.booking-room').length,
    bookButtons: document.querySelectorAll('[data-book]').length,
    detailButtons: document.querySelectorAll('[data-details]').length,
    // Room cards use floor identifiers instead of photos.
    photos: document.querySelectorAll('.booking-room img').length,
    codes: document.querySelectorAll('.booking-room__code').length,
    radios: document.querySelectorAll('input[name="booking-room"]').length,
    planOpen: !!document.querySelector('#booking-plan-open'),
    count: document.querySelector('#booking-results-title')?.textContent.replace(/\\s+/g, ' ').trim() || '',
    context: document.querySelector('.booking-resulthead__count p')?.textContent.replace(/\\s+/g, ' ').trim() || '',
    sort: !!document.querySelector('#booking-sort'),
    filter: !!document.querySelector('#booking-filter-toggle'),
    inlineMap: !!document.querySelector('#booking-location-map'),
    tabOverflow: tabControls ? tabControls.scrollWidth - tabControls.clientWidth : 0,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    headingJumps: jumps,
    unlabeledControls: [...document.querySelectorAll('#main-content input,#main-content select')]
      .filter(control => !control.labels?.length && !control.getAttribute('aria-label')).length,
    url: location.hash,
  };
})()`;

const QUICK_TOMORROW = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const before = document.querySelector('#booking-date').value;
  document.querySelector('[data-quick="tomorrow"]').click();
  await wait(200);
  const expected = new Date();
  expected.setDate(expected.getDate() + 1);
  const pad = n => String(n).padStart(2, '0');
  const iso = expected.getFullYear() + '-' + pad(expected.getMonth() + 1) + '-' + pad(expected.getDate());
  return { before, after: document.querySelector('#booking-date').value, iso, url: location.hash };
})()`;

const SEARCH = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const before = document.querySelectorAll('.booking-room').length;
  const participants = document.querySelector('#booking-participants');
  participants.value = '13';
  participants.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#booking-search').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await wait(250);
  return {
    before,
    after: document.querySelectorAll('.booking-room').length,
    participants: document.querySelector('#booking-participants').value,
    url: location.hash,
    // Every remaining card must fit its actual group size.
    tooSmall: [...document.querySelectorAll('.booking-room__meta')]
      .map(el => Number(/(\\d+)\\s+Plätze/.exec(el.textContent)?.[1] || 0))
      .filter(seats => seats < 13).length,
  };
})()`;

const INVALID_RANGE = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const end = document.querySelector('#booking-end');
  end.value = '08:00';
  end.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#booking-search').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await wait(250);
  const summary = document.querySelector('#booking-errors');
  return {
    summary: !!summary,
    text: summary?.textContent.replace(/\\s+/g, ' ').trim() || '',
    fieldFlagged: document.querySelector('#booking-end')?.getAttribute('aria-invalid') === 'true',
  };
})()`;

const INVALID_PARTICIPANTS = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const results = [];
  for (const value of ['', '0', '-2', '1.5']) {
    const input = document.querySelector('#booking-participants');
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#booking-search').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await wait(80);
    results.push({
      value,
      kept: document.querySelector('#booking-participants')?.value ?? null,
      flagged: document.querySelector('#booking-participants')?.getAttribute('aria-invalid') === 'true',
      message: document.querySelector('#booking-participants-msg')?.textContent.trim() || '',
    });
  }
  return results;
})()`;

const RESET_RANGE = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const end = document.querySelector('#booking-end');
  end.value = '10:00';
  end.dispatchEvent(new Event('input', { bubbles: true }));
  const participants = document.querySelector('#booking-participants');
  participants.value = '4';
  participants.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#booking-search').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await wait(250);
  return document.querySelectorAll('.booking-room').length;
})()`;

const FILTER = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const before = document.querySelectorAll('.booking-room').length;
  document.querySelector('#booking-filter-toggle').click();
  await wait(120);
  const panelOpen = !document.querySelector('#booking-filter-panel').hidden;
  const box = document.querySelector('#booking-filter-panel input[value="Videokonferenz"]');
  box.click();
  await wait(250);
  return {
    before, panelOpen,
    after: document.querySelectorAll('.booking-room').length,
    url: location.hash,
    chipsWithoutVc: [...document.querySelectorAll('.booking-chips')]
      .filter(list => !list.textContent.includes('Videokonferenz')).length,
  };
})()`;

const FILTER_RESET = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  document.querySelector('#booking-filter-reset')?.click();
  await wait(250);
  return { rooms: document.querySelectorAll('.booking-room').length, url: location.hash };
})()`;

const SORTS_AND_SNAPSHOT = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const nativeInstances = window.__engine.instances;
  let calls = 0;
  window.__engine.instances = (...args) => { calls++; return nativeInstances.apply(window.__engine, args); };

  const sort = document.querySelector('#booking-sort');
  sort.value = 'capacity';
  sort.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(200);
  const capacityCalls = calls;
  const capacities = [...document.querySelectorAll('.booking-room__meta')]
    .map((item) => Number(/(\\d+)\\s+Plätze/.exec(item.textContent)?.[1] || 0));

  calls = 0;
  const nextSort = document.querySelector('#booking-sort');
  nextSort.value = 'room';
  nextSort.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(200);
  const roomCalls = calls;
  const roomNumbers = [...document.querySelectorAll('.booking-room__meta')]
    .map((item) => item.textContent.split('·')[0].trim());
  calls = 0;
  const bestSort = document.querySelector('#booking-sort');
  bestSort.value = 'best';
  bestSort.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(200);
  const bestCalls = calls;
  window.__engine.instances = nativeInstances;

  return {
    capacityCalls,
    roomCalls,
    bestCalls,
    capacitySorted: capacities.every((value, index) => index === 0 || capacities[index - 1] <= value),
    roomSorted: roomNumbers.every((value, index) => index === 0
      || roomNumbers[index - 1].localeCompare(value, 'de', { numeric: true }) <= 0),
    capacities,
    roomNumbers,
  };
})()`;

const FAVOURITE = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const star = document.querySelector('.booking-room [data-fav-kind="room"]');
  const id = star.dataset.favId;
  const wasPressed = star.getAttribute('aria-pressed');
  star.click();
  await wait(250);
  const now = document.querySelector('[data-fav-id="' + CSS.escape(id).replace(/\\\\/g, '\\\\') + '"]');
  const after = document.querySelector('.booking-room [data-fav-kind="room"][data-fav-id]');
  const badge = document.querySelector('.booking-room__title .badge')?.textContent.trim() || '';
  const stored = localStorage.getItem('bbl_favorites_v1') || '';
  // Restore the favourite so later assertions keep their expected ordering.
  document.querySelector('[data-fav-kind="room"][aria-pressed="true"]')?.click();
  await wait(250);
  return {
    wasPressed, id,
    firstAfter: after?.dataset.favId || '',
    badge,
    stored: stored.includes(id),
    clearedAgain: !document.querySelector('[data-fav-kind="room"][aria-pressed="true"]'),
  };
})()`;

const PLAN_DIALOG = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const NativeMutationObserver = window.MutationObserver;
  const NativeResizeObserver = window.ResizeObserver;
  let activeObservers = 0;
  let peakObservers = 0;
  const tracked = Native => class {
    constructor(callback) {
      this.inner = new Native(callback);
      this.active = true;
      activeObservers++;
      peakObservers = Math.max(peakObservers, activeObservers);
    }
    observe(...args) { return this.inner.observe(...args); }
    unobserve(...args) { return this.inner.unobserve?.(...args); }
    takeRecords() { return this.inner.takeRecords(); }
    disconnect() {
      if (this.active) { this.active = false; activeObservers--; }
      return this.inner.disconnect();
    }
  };
  window.MutationObserver = tracked(NativeMutationObserver);
  window.ResizeObserver = tracked(NativeResizeObserver);
  document.querySelector('#booking-plan-open').click();
  let tries = 0;
  while (!document.querySelector('.modal .fp') && tries++ < 80) await wait(50);
  const modal = document.querySelector('.modal');
  const result = {
    open: !!modal,
    role: modal?.querySelector('[role="dialog"]') ? 'dialog' : '',
    plan: !!document.querySelector('#booking-plan .fp'),
    floors: document.querySelectorAll('[data-plan-floor]').length,
    legend: document.querySelectorAll('.booking-plan__legend li').length,
    inMain: !!document.querySelector('#main-content .fp'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
  const otherFloor = [...document.querySelectorAll('[data-plan-floor]')].find(button => !button.disabled);
  if (otherFloor) { otherFloor.click(); await wait(100); }
  result.floorChanged = !!otherFloor;
  document.querySelector('.modal .modal__close').click();
  await wait(200);
  result.closed = !document.querySelector('.modal');
  result.observersCreated = peakObservers;
  result.observersReleased = activeObservers === 0;
  window.MutationObserver = NativeMutationObserver;
  window.ResizeObserver = NativeResizeObserver;
  return result;
})()`;

const BOOK_DIALOG = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const trigger = document.querySelector('[data-book]');
  const roomName = trigger.closest('.booking-room').querySelector('.booking-room__title').childNodes[0].textContent.trim();
  trigger.click();
  let tries = 0;
  while (!document.querySelector('#booking-form') && tries++ < 80) await wait(50);
  const result = {
    roomName,
    title: document.querySelector('.modal__title')?.textContent.trim() || '',
    facts: document.querySelector('.booking-dialog__facts')?.textContent.replace(/\\s+/g, ' ').trim() || '',
    titleField: !!document.querySelector('#booking-title'),
    invite: !!document.querySelector('#booking-invite'),
    change: !!document.querySelector('#booking-dialog-change'),
    submit: !!document.querySelector('#booking-submit'),
    focused: document.activeElement?.id || '',
    card: !!document.querySelector('.modal__body > .card'),
  };
  // An empty title must never create a booking.
  document.querySelector('#booking-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await wait(200);
  result.blockedEmpty = !!document.querySelector('#booking-form');
  result.emptyMsg = document.querySelector('#booking-dialog-errors')?.textContent.replace(/\\s+/g, ' ').trim() || '';
  document.querySelector('.modal [data-modal-close]').click();
  await wait(200);
  result.cancelled = !document.querySelector('.modal');
  result.roomsIntact = document.querySelectorAll('.booking-room').length;
  return result;
})()`;

const STALE_DIALOG_CONFLICT = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const trigger = document.querySelector('[data-book]');
  const roomId = trigger.dataset.book;
  const roomNumber = trigger.closest('.booking-room').querySelector('.booking-room__meta').textContent.split('·')[0].trim();
  trigger.click();
  let tries = 0;
  while (!document.querySelector('#booking-title') && tries++ < 80) await wait(50);
  const title = document.querySelector('#booking-title');
  title.value = 'Race condition sentinel';
  title.dispatchEvent(new Event('input', { bubbles: true }));

  const marker = 'test-concurrent-room-conflict';
  const cancelledMarker = 'test-cancelled-room-conflict';
  const rows = JSON.parse(localStorage.getItem('bbl_vorgaenge_v1') || '[]');
  rows.unshift({
    instanceId: cancelledMarker,
    defId: 'buchung',
    requester: 'Andere Person',
    status: 'zurueckgezogen',
    data: {
      'datum': document.querySelector('#booking-date').value,
      start: document.querySelector('#booking-start').value,
      'ende': document.querySelector('#booking-end').value,
      'raumId': roomId,
    },
    linkedEntities: { buildingId: document.querySelector('#booking-location').value },
  });
  rows.unshift({
    instanceId: marker,
    defId: 'buchung',
    requester: 'Andere Person',
    status: 'bestaetigt',
    data: {
      'datum': document.querySelector('#booking-date').value,
      start: document.querySelector('#booking-start').value,
      'ende': document.querySelector('#booking-end').value,
      'raum': roomNumber,
    },
    linkedEntities: { buildingId: document.querySelector('#booking-location').value },
  });
  localStorage.setItem('bbl_vorgaenge_v1', JSON.stringify(rows));
  document.querySelector('#booking-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await wait(300);

  const storedAfter = JSON.parse(localStorage.getItem('bbl_vorgaenge_v1') || '[]');
  const result = {
    dialogClosed: !document.querySelector('#booking-form'),
    notCreated: !storedAfter.some((item) => item.data?.['zweck'] === 'Race condition sentinel'),
    absentWhileConflicted: ![...document.querySelectorAll('[data-book]')].some((button) => button.dataset.book === roomId),
  };
  const withoutActive = storedAfter.filter((item) => item.instanceId !== marker);
  localStorage.setItem('bbl_vorgaenge_v1', JSON.stringify(withoutActive));
  document.querySelector('#booking-search').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await wait(250);
  result.restoredAfterCleanup = [...document.querySelectorAll('[data-book]')].some((button) => button.dataset.book === roomId);
  localStorage.setItem('bbl_vorgaenge_v1', JSON.stringify(withoutActive.filter((item) => item.instanceId !== cancelledMarker)));
  return result;
})()`;

const SUBMIT = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  document.querySelector('[data-book]').click();
  let tries = 0;
  while (!document.querySelector('#booking-title') && tries++ < 80) await wait(50);
  const title = document.querySelector('#booking-title');
  title.value = 'Projektbesprechung Test';
  title.dispatchEvent(new Event('input', { bubbles: true }));
  const invitee = document.querySelector('#booking-invite');
  invitee.value = 'Anna Keller';
  document.querySelector('#booking-invite-add').click();
  await wait(150);
  const chips = document.querySelectorAll('#booking-invitees [data-remove-invite]').length;
  document.querySelector('#booking-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await wait(400);
  return {
    chips,
    dialogClosed: !document.querySelector('.modal'),
    success: !!document.querySelector('.notification--success'),
    heading: document.querySelector('.booking-done h2')?.textContent.trim() || '',
    reference: document.querySelector('.notification--success')?.textContent.replace(/\\s+/g, ' ').trim() || '',
    invitee: document.querySelector('.booking-done__summary')?.textContent.includes('Anna Keller') || false,
    again: !!document.querySelector('#booking-again'),
    ics: !!document.querySelector('#booking-calendar-download'),
    focused: document.activeElement?.tagName || '',
  };
})()`;

const BOOK_AGAIN = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  document.querySelector('#booking-again').click();
  await wait(250);
  const rows = JSON.parse(localStorage.getItem('bbl_vorgaenge_v1') || '[]');
  const bookedRoomId = rows.find((item) => item.data?.['zweck'] === 'Projektbesprechung Test')?.data?.['raumId'] || '';
  return {
    bar: !!document.querySelector('#booking-search'),
    done: !!document.querySelector('.booking-done'),
    bookedRoomId,
    bookedRoomStillListed: [...document.querySelectorAll('[data-book]')]
      .some((button) => button.dataset.book === bookedRoomId),
  };
})()`;

const MY_BOOKINGS = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  document.querySelector('[data-tab="bookings"]').click();
  await wait(200);
  return {
    visible: !document.querySelector('#booking-tab-panel-bookings')?.hidden,
    entries: document.querySelectorAll('#booking-tab-panel-bookings .booking-entry').length,
    titles: [...document.querySelectorAll('#booking-tab-panel-bookings .booking-entry h4')].map(h => h.textContent.trim()),
    cancellable: document.querySelectorAll('#booking-tab-panel-bookings [data-booking-cancel]').length,
    favs: !!document.querySelector('.booking-favs'),
    mapButton: !!document.querySelector('#booking-map-open'),
    url: location.hash,
  };
})()`;

const MAP_DIALOG = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  document.querySelector('#booking-map-open').click();
  let tries = 0;
  while (!document.querySelector('#booking-map .maplibregl-canvas') && tries++ < 120) await wait(100);
  const result = {
    open: !!document.querySelector('.modal'),
    canvas: !!document.querySelector('#booking-map .maplibregl-canvas'),
    inMain: !!document.querySelector('#main-content .maplibregl-canvas'),
  };
  const mapProto = window.maplibregl?.Map?.prototype;
  const nativeRemove = mapProto?.remove;
  let removals = 0;
  if (nativeRemove) mapProto.remove = function(...args) {
    removals++;
    return nativeRemove.apply(this, args);
  };
  document.querySelector('.modal .modal__close').click();
  await wait(300);
  result.closed = !document.querySelector('.modal');
  result.removed = removals;
  if (nativeRemove) mapProto.remove = nativeRemove;
  return result;
})()`;

const DEEP_LINK = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let tries = 0;
  while (!document.querySelector('#booking-form') && tries++ < 160) await wait(100);
  return {
    dialog: !!document.querySelector('#booking-form'),
    title: document.querySelector('.modal__title')?.textContent.trim() || '',
    facts: document.querySelector('.booking-dialog__facts')?.textContent.replace(/\\s+/g, ' ').trim() || '',
    behind: !!document.querySelector('#booking-search'),
  };
})()`;

const buildingId = '1080/6650/AA';
const linkedRoomId = '1080-6650-AA-1og-16';
// Use a free weekday two weeks ahead; the default is also a working day.
const futureDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
const q = `building=${encodeURIComponent(buildingId)}&date=${futureDate}`;

const cdp = await launch({ webgl: true });
try {
  const loginPage = await openPage(cdp, `${APP_BASE}/app/room-booking`);
  check(await loginPage.evaluate(LOGIN) === true, 'login stub is available');
  await loginPage.closeTarget();

  console.log('\n■ Room Booking invalid URL criteria');
  const invalidPage = await openPage(cdp,
    `${APP_BASE}/app/room-booking?building=${encodeURIComponent(buildingId)}&date=2020-01-01&start=99:00&end=99:30&participants=-2`);
  check(await invalidPage.evaluate(READY) === true, 'search bar renders for invalid URL criteria');
  const sanitised = await invalidPage.evaluate(`(() => ({
    date: document.querySelector('#booking-date')?.value || '',
    start: document.querySelector('#booking-start')?.value || '',
    end: document.querySelector('#booking-end')?.value || '',
    participants: document.querySelector('#booking-participants')?.value || '',
    url: location.hash,
  }))()`);
  check(sanitised.date >= new Date().toISOString().slice(0, 10)
      && sanitised.start === '09:00' && sanitised.end === '10:00' && sanitised.participants === '4',
    `invalid/past URL slot is replaced (${sanitised.date}, ${sanitised.start}–${sanitised.end}, ${sanitised.participants})`);
  check(!/2020-01-01|99%3A|99:|-2/.test(sanitised.url), `normalised criteria reach the URL (${sanitised.url.slice(0, 110)})`);
  await invalidPage.closeTarget();

  console.log('\n■ Room Booking deep link (?room=)');
  const linkedPage = await openPage(cdp, `${APP_BASE}/app/room-booking?${q}&room=${encodeURIComponent(linkedRoomId)}`);
  const linked = await linkedPage.evaluate(DEEP_LINK);
  check(linked.dialog, 'a linked room opens the booking dialog straight away');
  check(/buchen$/.test(linked.title), `the dialog names the room ("${linked.title}")`);
  check(linked.behind, 'the searchable page is rendered behind the dialog as a fallback');
  check((await linkedPage.problems()).length === 0, 'deep link has no exceptions / console errors / error banner');
  await linkedPage.closeTarget();

  for (const width of [1440, 320]) {
    console.log(`\n■ Room Booking (${width}px)`);
    const page = await openPage(cdp, `${APP_BASE}/app/room-booking?${q}`);
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    check(await page.evaluate(READY) === true, 'search bar renders');

    const s = await page.evaluate(SURFACE);
    check(s.h1 === 'Raumbuchung' && s.bar, `renders the standalone app (h1: "${s.h1}")`);
    check(s.tabs === 2, 'keeps the two task-level CD tabs');
    check(s.steps === 0 && s.stepNav === 0, `no wizard chrome remains (${s.steps} steps, ${s.stepNav} step controls)`);
    check(s.barFields === 5 && s.submit, `search bar carries location, date, from, to, people and a submit (${s.barFields})`);
    check(s.quick === 3, `offers the three quick choices (${s.quick})`);
    check(s.location === buildingId, `honours the linked location (${s.location})`);
    check(s.rooms > 0 && s.bookButtons === s.rooms && s.detailButtons === s.rooms,
      `every result row books directly (${s.rooms} rooms, ${s.bookButtons} book buttons)`);
    check(s.radios === 0, 'no separate room-selection step remains');
    check(s.photos === 0 && s.codes === s.rooms, `room cards carry a floor code, not a photograph (${s.codes})`);
    check(/von \d+ Räumen frei/.test(s.count), `results are headed by the free count ("${s.count}")`);
    check(s.context.includes('Plätze'), `criteria echo below the count ("${s.context}")`);
    check(s.sort && s.filter && s.planOpen, 'sort, filter, and the floor-plan dialog are reachable from the results bar');
    check(!s.inlineMap, 'the location map is no longer inline in the flow');
    check(s.tabOverflow <= 1, `task tabs fit their track (${s.tabOverflow}px overflow)`);
    check(s.overflow <= 1, `no horizontal overflow (${s.overflow}px)`);
    check(s.headingJumps.length === 0, `heading hierarchy is unbroken (${s.headingJumps.join(', ') || 'ok'})`);
    check(s.unlabeledControls === 0, 'all form controls have accessible labels');
    check(/date=/.test(s.url) && /participants=/.test(s.url), `criteria are mirrored into the URL (${s.url.slice(0, 90)})`);

    const quick = await page.evaluate(QUICK_TOMORROW);
check(quick.after === quick.iso, `tomorrow quick choice sets the expected date (${quick.before} → ${quick.after})`);
    check(quick.url.includes(quick.iso), 'the quick choice reaches the URL');

    const searched = await page.evaluate(SEARCH);
    check(searched.participants === '13' && /participants=13/.test(searched.url), 'the search bar applies the group size');
    check(searched.tooSmall === 0, `no result is smaller than the group (${searched.after} of ${searched.before} rooms remain)`);

    const invalid = await page.evaluate(INVALID_RANGE);
    check(invalid.summary && /Endzeit/.test(invalid.text), `an end before the start is refused ("${invalid.text.slice(0, 70)}")`);
    check(invalid.fieldFlagged, 'the offending field is marked aria-invalid');
    check(await page.evaluate(RESET_RANGE) > 0, 'a corrected range returns results');

    const invalidParticipants = await page.evaluate(INVALID_PARTICIPANTS);
    check(invalidParticipants.every((item) => item.flagged && /1 bis 100/.test(item.message)),
      'blank, zero, negative, and fractional participant counts are refused');
    check(invalidParticipants.every((item) => item.kept === item.value),
      'invalid participant input is not silently normalised to 1');
    check(await page.evaluate(RESET_RANGE) > 0, 'a valid integer participant count restores results');

    const filtered = await page.evaluate(FILTER);
    check(filtered.panelOpen, 'the filter panel opens from the results bar');
    check(filtered.after <= filtered.before && filtered.chipsWithoutVc === 0,
      `an equipment filter narrows the list (${filtered.before} → ${filtered.after})`);
    check(/equipment=Videokonferenz/.test(filtered.url), 'the filter reaches the URL');
    const cleared = await page.evaluate(FILTER_RESET);
    check(cleared.rooms >= filtered.after && !/equipment=/.test(cleared.url), `the filter reset restores the list (${cleared.rooms})`);

    const sorted = await page.evaluate(SORTS_AND_SNAPSHOT);
    check(sorted.capacitySorted, `capacity sort is numeric (${sorted.capacities.join(', ')})`);
    check(sorted.roomSorted, `room sort is natural (${sorted.roomNumbers.join(', ')})`);
    check(sorted.capacityCalls === 1 && sorted.roomCalls === 1 && sorted.bestCalls === 1,
      `each result redraw uses one process snapshot (${sorted.capacityCalls}/${sorted.roomCalls}/${sorted.bestCalls})`);

    const fav = await page.evaluate(FAVOURITE);
    check(fav.wasPressed === 'false' && fav.stored, 'the star remembers a room in localStorage');
    check(fav.firstAfter === fav.id && fav.badge.includes('Favorit'), `a remembered room sorts first and is badged ("${fav.badge}")`);
    check(fav.clearedAgain, 'the star toggles the room back off');

    const plan = await page.evaluate(PLAN_DIALOG);
    check(plan.open && plan.role === 'dialog' && plan.plan, 'the floor plan opens as a dialog');
    check(plan.floors > 0 && plan.legend === 3, `the plan offers floor switching and a legend (${plan.floors} floors, ${plan.legend} keys)`);
    check(!plan.inMain, 'the plan does not occupy the page itself');
    check(plan.overflow <= 1, `the plan dialog causes no document overflow (${plan.overflow}px)`);
    check(plan.floorChanged && plan.observersCreated >= 3, `a floor change rewires the plan (${plan.observersCreated} owned observers)`);
    check(plan.closed, 'the plan dialog closes again');
    check(plan.observersReleased, 'closing the plan disconnects all dialog-owned observers');

    const dialog = await page.evaluate(BOOK_DIALOG);
    check(dialog.title === `${dialog.roomName} buchen`, `the booking dialog names the room ("${dialog.title}")`);
    check(dialog.card, 'the dialog body sits on the CD card surface');
    check(/Wann/.test(dialog.facts) && /Wo/.test(dialog.facts), `it echoes when and where ("${dialog.facts.slice(0, 60)}")`);
check(dialog.titleField && dialog.invite && dialog.change && dialog.submit, 'it carries title, invitees, the change action, and the binding action');
    check(dialog.focused === 'booking-title', `focus lands on the first field ("${dialog.focused}")`);
    check(dialog.blockedEmpty && /Sitzungstitel/.test(dialog.emptyMsg), `an empty title is refused ("${dialog.emptyMsg}")`);
    check(dialog.cancelled && dialog.roomsIntact > 0, 'cancelling closes the dialog and leaves the list untouched');

    if (width === 1440) {
      const staleConflict = await page.evaluate(STALE_DIALOG_CONFLICT);
      check(staleConflict.dialogClosed && staleConflict.notCreated && staleConflict.absentWhileConflicted,
        'submission rechecks a legacy room booking created after the dialog opened');
      check(staleConflict.restoredAfterCleanup, 'a cancelled booking does not keep the room unavailable');

      const submitted = await page.evaluate(SUBMIT);
      check(submitted.chips === 1, `an invitee becomes a removable chip (${submitted.chips})`);
      check(submitted.dialogClosed && submitted.success && submitted.heading === 'Buchung abgeschlossen',
        `a valid booking closes the dialog and creates a process ("${submitted.heading}")`);
      check(/BBL-/.test(submitted.reference), `the success message includes a reference ("${submitted.reference.slice(0, 70)}")`);
      check(submitted.invitee, 'the confirmation keeps the invitee');
      check(submitted.again && submitted.ics, 'the confirmation offers a calendar file and a way back into the list');

      const again = await page.evaluate(BOOK_AGAIN);
check(again.bar && !again.done, 'the book-another-room action returns to the one-page surface');
      check(again.bookedRoomId && !again.bookedRoomStillListed,
        'the new overlapping booking is removed from the available-room list');

      const bookings = await page.evaluate(MY_BOOKINGS);
check(bookings.visible && bookings.entries > 0, `the new booking appears on the personal-bookings tab (${bookings.entries})`);
      check(bookings.titles.includes('Projektbesprechung Test'), `the meeting title survives (${bookings.titles.join(', ')})`);
      check(bookings.cancellable > 0, 'a locally created future booking can be cancelled');
      check(bookings.favs && bookings.mapButton, 'the tab carries the remembered locations and the map entry point');

      const map = await page.evaluate(MAP_DIALOG);
      check(map.open && map.canvas, 'the location map opens as a dialog and renders');
      check(!map.inMain, 'the map does not occupy the page itself');
      check(map.closed, 'the map dialog closes again');
      check(map.removed > 0, 'closing the map dialog releases its MapLibre instance');
    }

    const problems = await page.problems();
    check(problems.length === 0, `no exceptions / console errors / error banner${problems[0] ? ': ' + problems[0] : ''}`);
    await page.closeTarget();
  }
} finally {
  cdp.close();
}

console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
