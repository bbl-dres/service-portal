// Standalone Room Booking regression: portfolio-style location discovery,
// schedule search, explicit room selection, list/floor-plan switching, review, invitees,
// process creation, personal bookings, deep links, and mobile containment.
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
  window.__login();
  return true;
})()`;

const STEP_ONE = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let tries = 0;
  while (!document.querySelector('#booking-location-search') && tries++ < 120) await wait(100);
  const headings = [...document.querySelectorAll('#main-content h1,#main-content h2,#main-content h3,#main-content h4')];
  const map = document.querySelector('#booking-location-map');
  const tabControls = document.querySelector('.booking-tabs .tab__controls');
  const jumps = [];
  headings.reduce((previous, heading) => {
    const level = Number(heading.tagName[1]);
    if (previous && level > previous + 1) jumps.push(previous + '>' + level);
    return level;
  }, 0);
  return {
    h1: document.querySelector('h1')?.textContent.trim() || '',
    tabs: document.querySelectorAll('.tab__control').length,
    steps: document.querySelectorAll('.step__indicator-step').length,
    stepLabels: [...document.querySelectorAll('.steps > .step__indicator')].map((item) => item.textContent.replace(/\s+/g, ' ').trim()),
    heading: document.querySelector('#booking-step-head')?.textContent.trim() || '',
    form: !!document.querySelector('#booking-location-search'),
    catbar: !!document.querySelector('.booking-step--location > .catbar'),
    pfLayout: !!document.querySelector('.booking-step--location > .pf-layout'),
    sidebar: !!document.querySelector('.booking-location-sidebar.pf-sidebar'),
    locations: document.querySelectorAll('input[name="booking-location"]').length,
    selectedLocation: document.querySelector('input[name="booking-location"]:checked')?.value || '',
    schedule: !!document.querySelector('#booking-search-form'),
    map: !!map,
    tabOverflow: tabControls ? tabControls.scrollWidth - tabControls.clientWidth : 0,
    views: document.querySelectorAll('.view-switch__btn').length,
    rooms: document.querySelectorAll('input[name="booking-room"]').length,
    review: !!document.querySelector('#booking-form'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    headingJumps: jumps,
    unlabeledControls: [...document.querySelectorAll('.booking-tabs input,.booking-tabs select')]
      .filter(control => !control.labels?.length && !control.getAttribute('aria-label')).length,
  };
})()`;

const SEARCH_LOCATION = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const input = document.querySelector('#booking-location-q');
  input.value = 'Liebefeld';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(450);
  return {
    locations: document.querySelectorAll('input[name="booking-location"]').length,
    selected: document.querySelector('input[name="booking-location"]:checked')?.value || '',
    url: location.hash,
  };
})()`;

const ADVANCE_TO_RESULTS = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  document.querySelector('#booking-location-next')?.click();
  let tries = 0;
  while ((!document.querySelector('.booking-results') || !document.querySelector('#booking-search-form')) && tries++ < 80) await wait(50);
  return {
    heading: document.querySelector('#booking-step-head')?.textContent.trim() || '',
    stepLabels: [...document.querySelectorAll('.steps > .step__indicator')].map((item) => item.textContent.replace(/\s+/g, ' ').trim()),
    views: document.querySelectorAll('.view-switch__btn').length,
    rooms: document.querySelectorAll('input[name="booking-room"]').length,
    checked: document.querySelector('input[name="booking-room"]:checked')?.value || '',
    map: !!document.querySelector('#booking-location-map'),
    repeatedAvailability: document.querySelectorAll('.booking-room-row .badge').length,
    next: !!document.querySelector('#booking-step-next'),
    schedule: !!document.querySelector('#booking-search-form'),
    scheduleFields: document.querySelectorAll('#booking-date,#booking-start,#booking-end,#booking-participants').length,
    criteria: document.querySelector('.booking-location-summary')?.textContent.replace(/\s+/g, ' ').trim() || '',
    url: location.hash,
    focused: document.activeElement?.id || '',
    headingOutline: getComputedStyle(document.querySelector('#booking-step-head')).outlineStyle,
  };
})()`;

const SEARCH_SCHEDULE = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const participants = document.querySelector('#booking-participants');
  participants.value = '5';
  participants.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#booking-search-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await wait(250);
  return {
    participants: document.querySelector('#booking-participants')?.value || '',
    rooms: document.querySelectorAll('input[name="booking-room"]').length,
    url: location.hash,
  };
})()`;

const SELECT_ROOM = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const radio = document.querySelector('input[name="booking-room"]');
  radio?.click();
  let tries = 0;
  while (!document.querySelector('#booking-room-detail .booking-room-image') && tries++ < 80) await wait(50);
  return {
    selected: document.querySelector('input[name="booking-room"]:checked')?.value || '',
    roomVisual: !!document.querySelector('#booking-room-detail .booking-room-image'),
    roomTitle: document.querySelector('#booking-selected-title')?.textContent.trim() || '',
  };
})()`;

const FLOORPLAN = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  document.querySelector('[data-view="floorplan"]')?.click();
  let tries = 0;
  while (!document.querySelector('.booking-floorplan .fp') && tries++ < 80) await wait(50);
  return {
    floorplan: !!document.querySelector('.booking-floorplan .fp'),
    tools: document.querySelectorAll('.booking-plan-tools [data-plan-zoom]').length,
    reset: !!document.querySelector('[data-plan-zoom="fit"]'),
    legend: document.querySelectorAll('.booking-plan-legend li').length,
    url: location.hash,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;

const ADVANCE_TO_REVIEW = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  document.querySelector('#booking-step-next')?.click();
  let tries = 0;
  while (!document.querySelector('#booking-form') && tries++ < 80) await wait(50);
  const summary = document.querySelector('.booking-confirm__summary');
  const submit = document.querySelector('.booking-confirm__submit');
  return {
    heading: document.querySelector('#booking-step-head')?.textContent.trim() || '',
    form: !!document.querySelector('#booking-form'),
    title: !!document.querySelector('#booking-title'),
    invitee: !!document.querySelector('#booking-invite'),
    review: !!summary,
    changeActions: document.querySelectorAll('[data-booking-edit-step]').length,
    summaryBeforeAction: !!(summary?.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING),
    map: !!document.querySelector('#booking-location-map'),
    views: document.querySelectorAll('.view-switch__btn').length,
    reviewGroups: [...document.querySelectorAll('.booking-review__head > strong')].map((item) => item.textContent.trim()),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;

const SUBMIT = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const title = document.querySelector('#booking-title');
  title.value = 'Projektbesprechung Test';
  title.dispatchEvent(new Event('input', { bubbles: true }));
  const invitee = document.querySelector('#booking-invite');
  invitee.value = 'Anna Keller';
  document.querySelector('#booking-invite-add').click();
  await wait(100);
  document.querySelector('#booking-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await wait(300);
  return {
    success: !!document.querySelector('.notification--success'),
    heading: document.querySelector('.booking-done h2')?.textContent.trim() || '',
    reference: document.querySelector('.notification--success')?.textContent.replace(/\s+/g, ' ').trim() || '',
    invitee: document.querySelector('.booking-done__summary')?.textContent.includes('Anna Keller') || false,
  };
})()`;

const MY_BOOKINGS = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  document.querySelector('[data-tab="bookings"]')?.click();
  await wait(100);
  return {
    visible: !document.querySelector('#booking-tab-panel-bookings')?.hidden,
    entries: document.querySelectorAll('#booking-tab-panel-bookings .booking-entry').length,
    titles: [...document.querySelectorAll('#booking-tab-panel-bookings .booking-entry h4')].map((heading) => heading.textContent.trim()),
    cancellable: document.querySelectorAll('#booking-tab-panel-bookings [data-booking-cancel]').length,
  };
})()`;

const DEEP_LINK = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let tries = 0;
  while (!document.querySelector('#booking-room-group') && tries++ < 120) await wait(100);
  return {
    heading: document.querySelector('#booking-step-head')?.textContent.trim() || '',
    checked: document.querySelector('input[name="booking-room"]:checked')?.value || '',
    schedule: !!document.querySelector('#booking-search-form'),
    locationAbsent: !document.querySelector('#booking-location-search'),
  };
})()`;

const buildingId = '1080/6650/AA';
const linkedRoomId = '1080-6650-AA-eg-06';
const futureDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

const cdp = await launch({ webgl: true });
try {
  const loginPage = await openPage(cdp, `${APP_BASE}/app/room-booking`);
  const login = await loginPage.evaluate(LOGIN).catch(() => true);
  check(login === true, 'login stub is available');
  await sleep(900);
  await loginPage.closeTarget();

  console.log('\n■ Room Booking deep link');
  const linkedPage = await openPage(cdp, `${APP_BASE}/app/room-booking?building=${encodeURIComponent(buildingId)}&room=${encodeURIComponent(linkedRoomId)}&date=${futureDate}`);
  const linked = await linkedPage.evaluate(DEEP_LINK);
  check(/Schritt 2 von 3/.test(linked.heading), `room deep link opens the selection step ("${linked.heading}")`);
  check(linked.checked === linkedRoomId && linked.schedule && linked.locationAbsent, `keeps the linked room selected with its schedule search ("${linked.checked}")`);
  check((await linkedPage.problems()).length === 0, 'deep link has no exceptions / console errors / error banner');
  await linkedPage.closeTarget();

  for (const width of [1440, 320]) {
    console.log(`\n■ Room Booking (${width}px)`);
    const page = await openPage(cdp, `${APP_BASE}/app/room-booking?building=${encodeURIComponent(buildingId)}&date=${futureDate}`);
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    await sleep(900);

    const first = await page.evaluate(STEP_ONE);
    check(first.h1 === 'Raumbuchung' && first.form, `renders the standalone app (h1: "${first.h1}")`);
    check(first.tabs === 2, 'keeps the two task-level CD tabs');
    check(first.steps === 3 && /Schritt 1 von 3/.test(first.heading), `starts the three-step wizard ("${first.heading}")`);
    check(first.stepLabels[0]?.includes('Standort'), `names step 1 Standort (${first.stepLabels.join(', ')})`);
    check(first.catbar && first.pfLayout && first.sidebar, 'reuses the portfolio catbar and pf-layout composition');
    check(first.locations > 0 && first.selectedLocation === buildingId, `renders selectable locations and keeps the URL selection (${first.locations})`);
    check(first.map, 'shows bookable locations on the shared map in step 1');
    check(first.views === 0 && first.rooms === 0 && !first.review && !first.schedule, 'keeps schedule and room controls out of step 1');
    check(first.tabOverflow <= 1, `task tabs fit their track (${first.tabOverflow}px overflow)`);
    check(first.overflow <= 1, `step 1 has no horizontal overflow (${first.overflow}px)`);
    check(first.headingJumps.length === 0, `heading hierarchy is unbroken (${first.headingJumps.join(', ') || 'ok'})`);
    check(first.unlabeledControls === 0, 'all form controls have accessible labels');

    const locationSearch = await page.evaluate(SEARCH_LOCATION);
    check(locationSearch.locations > 0 && locationSearch.selected === buildingId && /q=Liebefeld/.test(locationSearch.url), 'searches and preserves the selected location in step 1');

    const results = await page.evaluate(ADVANCE_TO_RESULTS);
    check(/Schritt 2 von 3/.test(results.heading) && results.stepLabels[1]?.includes('Termin & Raum'), `continues to Termin & Raum (${results.stepLabels.join(', ')})`);
    check(results.schedule && results.scheduleFields === 4, 'moves date, time, and participants into step 2');
    check(results.views === 2, 'offers list and floor-plan views only in step 2');
    check(results.rooms > 0, `renders matching room choices (${results.rooms})`);
    check(results.checked === '', 'does not select the first matching room automatically');
    check(!results.map && results.next, 'removes the building map and provides explicit step navigation');
    check(results.repeatedAvailability === 0, 'does not repeat an availability badge on every available result');
    check(results.criteria.includes('Liebefeld') && /step=2/.test(results.url), 'keeps the selected location visible and mirrors the step in the URL');
    check(results.focused === 'booking-step-head' && results.headingOutline === 'none', 'moves focus to the new step heading without painting an input-like ring');

    const searched = await page.evaluate(SEARCH_SCHEDULE);
    check(searched.participants === '5' && searched.rooms > 0 && /participants=5/.test(searched.url), 'searches room availability using the schedule in step 2');

    const selected = await page.evaluate(SELECT_ROOM);
    check(!!selected.selected, `requires and keeps an explicit room choice ("${selected.selected}")`);
    check(selected.roomVisual && selected.roomTitle, 'shows photography and facts for the selected room');

    const floorplan = await page.evaluate(FLOORPLAN);
    check(floorplan.floorplan && /view=floorplan/.test(floorplan.url), 'switches to the URL-backed floor-plan view');
    check(floorplan.tools === 3 && floorplan.reset, 'floor plan has vertical zoom in, zoom out, and reset controls');
    check(floorplan.legend === 4, 'floor plan explains availability, occupancy, suitability, and selection');
    check(floorplan.overflow <= 1, `floor-plan view has no document overflow (${floorplan.overflow}px)`);

    const review = await page.evaluate(ADVANCE_TO_REVIEW);
    check(review.form && /Schritt 3 von 3/.test(review.heading), `opens the focused review step ("${review.heading}")`);
    check(review.title && review.invitee && review.review, 'places title, optional invitees, and summary in step 3');
    check(review.changeActions === 2 && review.summaryBeforeAction, 'offers targeted changes before the binding action');
    check(review.reviewGroups.join('|') === 'Standort|Termin & Raum', `groups the review by the two preceding steps (${review.reviewGroups.join(', ')})`);
    check(!review.map && review.views === 0, 'keeps map and result controls out of the review step');
    check(review.overflow <= 1, `review step has no horizontal overflow (${review.overflow}px)`);

    if (width === 1440) {
      const submitted = await page.evaluate(SUBMIT);
      check(submitted.success && submitted.heading === 'Buchung abgeschlossen', `valid booking creates a process ("${submitted.heading}")`);
      check(/BBL-/.test(submitted.reference), `success message includes a reference ("${submitted.reference.slice(0, 80)}")`);
      check(submitted.invitee, 'keeps the optional invitee in the confirmation');
      const bookings = await page.evaluate(MY_BOOKINGS);
      check(bookings.visible && bookings.entries > 0, `shows the new booking under Meine Buchungen (${bookings.entries})`);
      check(bookings.titles.includes('Projektbesprechung Test'), `keeps the meeting title in the booking list (${bookings.titles.join(', ')})`);
      check(bookings.cancellable > 0, 'offers cancellation for a locally created future booking');
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
