// Standalone Room Booking regression: authenticated search, list/floor-plan
// switching, spatial context, room preselection, invitees, process creation,
// personal bookings, and mobile containment.
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

const PROBE = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let tries = 0;
  while (!document.querySelector('#booking-form') && tries++ < 120) await wait(100);
  const headings = [...document.querySelectorAll('#main-content h1,#main-content h2,#main-content h3')];
  const jumps = [];
  headings.reduce((previous, heading) => {
    const level = Number(heading.tagName[1]);
    if (previous && level > previous + 1) jumps.push(previous + '>' + level);
    return level;
  }, 0);
  return {
    h1: document.querySelector('h1')?.textContent.trim() || '',
    form: !!document.querySelector('#booking-form') && !!document.querySelector('#booking-search-form'),
    tabs: document.querySelectorAll('.tab__control').length,
    views: document.querySelectorAll('.view-switch__btn').length,
    rooms: document.querySelectorAll('input[name="booking-room"]').length,
    checked: document.querySelector('input[name="booking-room"]:checked')?.value || '',
    map: !!document.querySelector('#booking-location-map'),
    roomVisual: !!document.querySelector('#booking-room-detail .booking-room-image'),
    staleHint: document.body.textContent.includes('Die Raumliste wird nach Kapazität gefiltert.'),
    summaryBeforeAction: !!(document.querySelector('.booking-confirm__summary')?.compareDocumentPosition(
      document.querySelector('.booking-confirm__submit')) & Node.DOCUMENT_POSITION_FOLLOWING),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    headingJumps: jumps,
    unlabeledControls: [...document.querySelectorAll('.booking-tabs input,.booking-tabs select')]
      .filter(control => !control.labels?.length && !control.getAttribute('aria-label')).length,
  };
})()`;

const FLOORPLAN = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  document.querySelector('[data-view="floorplan"]')?.click();
  let tries = 0;
  while (!document.querySelector('.booking-floorplan .fp') && tries++ < 40) await wait(50);
  return {
    floorplan: !!document.querySelector('.booking-floorplan .fp'),
    tools: document.querySelectorAll('.booking-plan-tools [data-plan-zoom]').length,
    reset: !!document.querySelector('[data-plan-zoom="fit"]'),
    legend: document.querySelectorAll('.booking-plan-legend li').length,
    url: location.hash,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;

const SUBMIT = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  document.querySelector('[data-view="list"]')?.click();
  await wait(100);
  const title = document.querySelector('#booking-title');
  title.value = 'Projektbesprechung Test';
  title.dispatchEvent(new Event('input', { bubbles: true }));
  const invitee = document.querySelector('#booking-invite');
  invitee.value = 'Anna Keller';
  document.querySelector('#booking-invite-add').click();
  await wait(100);
  const date = document.querySelector('#booking-date');
  const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  date.value = future;
  date.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#booking-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await wait(300);
  return {
    success: !!document.querySelector('.notification--success'),
    heading: document.querySelector('.booking-done h2')?.textContent.trim() || '',
    reference: document.querySelector('.notification--success')?.textContent.replace(/\\s+/g, ' ').trim() || '',
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

const cdp = await launch({ webgl: true });
try {
  const loginPage = await openPage(cdp, `${APP_BASE}/app/room-booking`);
  const login = await loginPage.evaluate(LOGIN).catch(() => true);
  check(login === true, 'login stub is available');
  await sleep(900);
  await loginPage.closeTarget();

  for (const width of [1440, 320]) {
    console.log(`\n■ Room Booking (${width}px)`);
    const page = await openPage(cdp, `${APP_BASE}/app/room-booking?building=${encodeURIComponent('1080/6650/AA')}&room=${encodeURIComponent('1080-6650-AA-eg-06')}`);
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    await sleep(900);
    const result = await page.evaluate(PROBE);
    check(result.h1 === 'Raumbuchung' && result.form, `renders the standalone app (h1: "${result.h1}")`);
    check(result.tabs === 2, 'uses the two task-level CD tabs');
    check(result.views === 2, 'offers list and floor-plan views in the catalogue bar');
    check(result.rooms > 0, `renders matching room choices (${result.rooms})`);
    check(result.checked === '1080-6650-AA-eg-06', `keeps the linked room selected ("${result.checked}")`);
    check(result.map, 'shows the selected building on a map');
    check(result.roomVisual, 'shows a room image or an honest image placeholder');
    check(!result.staleHint, 'omits the retired capacity-filter hint');
    check(result.summaryBeforeAction, 'places the booking summary before the confirmation action');
    check(result.overflow <= 1, `document has no horizontal overflow (${result.overflow}px)`);
    check(result.headingJumps.length === 0, `heading hierarchy is unbroken (${result.headingJumps.join(', ') || 'ok'})`);
    check(result.unlabeledControls === 0, 'all form controls have accessible labels');

    const floorplan = await page.evaluate(FLOORPLAN);
    check(floorplan.floorplan && /view=floorplan/.test(floorplan.url), 'switches to the URL-backed floor-plan view');
    check(floorplan.tools === 3 && floorplan.reset, 'floor plan has vertical zoom in, zoom out, and reset controls');
    check(floorplan.legend === 4, 'floor plan explains availability, occupancy, suitability, and selection');
    check(floorplan.overflow <= 1, `floor-plan view has no document overflow (${floorplan.overflow}px)`);

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
