// Cross-flow form-helper checks cover space request, fault report, and room
// booking through C.field, C.select, C.val, and C.readForm. Custom validation
// must add input--error to controls that started without a class. Synthetic
// submit bypasses native validation so the shared path is isolated.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const LOGIN = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  // Poll __login after app boot and core loading instead of racing the gate.
  let n = 0; while (typeof window.__login !== 'function' && n++ < 120) await s(50);
  if (typeof window.__login !== 'function') return 'no __login';
  window.__login(); return 'ok';
})()`;

// Clear fields, submit through the custom handler, and report state. Scope to
// the field's closest form because the shell search form appears first.
const probeErrors = (clearIds, checkIds) => `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.getElementById(${JSON.stringify(clearIds[0])}) && n++ < 120) await s(100);
  const anchor = document.getElementById(${JSON.stringify(clearIds[0])});
  const form = anchor && anchor.closest('form');
  if (!form) return { ok: false, err: 'no wizard form' };
  for (const id of ${JSON.stringify(clearIds)}) { const el = document.getElementById(id); if (el) el.value = ''; }
  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  await s(250);
  const fields = {};
  for (const id of ${JSON.stringify(checkIds)}) {
    const el = document.getElementById(id);
    fields[id] = el ? { err: el.classList.contains('input--error'), ariaInvalid: el.getAttribute('aria-invalid'), badge: !!document.getElementById(id + '-msg') } : 'MISSING';
  }
  return { ok: true, fields };
})()`;

// Count rendered form groups as a basic render check.
const PROBE_RENDER = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.querySelector('#wiz, #report-form, #booking-search') && n++ < 120) await s(100);
  const form = document.querySelector('#wiz, #report-form, #booking-search');
  return {
    ok: !!form,
    title: document.querySelector('#main-content h1')?.textContent || '',
    groups: form ? form.querySelectorAll('.form__group__input, .form__group__select').length : 0,
    selects: form ? form.querySelectorAll('select').length : 0,
    pageSelects: document.querySelectorAll('#main-content select').length,
  };
})()`;

const PROBE_BUILDING_SELECTION = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.getElementById('bld') && n++ < 120) await s(100);
  const select = document.getElementById('bld');
  return {
    value: select?.value || '',
    first: select?.options?.[0]?.value || '',
  };
})()`;

// Select a building, fill the description, and submit. The required building
// starts empty, so the test follows the same explicit choice as a user.
const PROBE_SUCCESS = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.getElementById('description') && n++ < 120) await s(100);
  const bld = document.getElementById('bld');
  if (bld && bld.tagName === 'SELECT') {
    const opt = [...bld.options].find(o => o.value);
    if (opt) { bld.value = opt.value; bld.dispatchEvent(new Event('change', { bubbles: true })); }
  }
  const description = document.getElementById('description');
  description.value = 'Testmeldung aus dem Formulartest';
  description.closest('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  await s(300);
  return { success: !!document.querySelector('.notification--success'), noError: !document.querySelector('.input--error') };
})()`;

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };
const errOk = (f) => f && f !== 'MISSING' && f.err === true && f.ariaInvalid === 'true' && f.badge === true;

(async () => {
  const cdp = await launch();
  try {
    // Log in once; localStorage shares the session across tabs.
    let p = await openPage(cdp, `${APP_BASE}/app/room-booking`);
    await p.evaluate(LOGIN);
    await sleep(800);
    await p.closeTarget();

    // Space request: rendering and validation on #org and #cc.
    console.log('\n■ space-request (step 1)');
    p = await openPage(cdp, `${APP_BASE}/app/space-request`);
    const sr = await p.evaluate(PROBE_RENDER);
    check(sr.ok && sr.groups >= 4, `renders form (${sr.groups} field groups)`);
    const srE = await p.evaluate(probeErrors(['org', 'cc'], ['org', 'cc']));
    check(errOk(srE.fields?.org), 'C5: cleared #org → input--error + aria-invalid + badge');
    check(errOk(srE.fields?.cc), 'C5: cleared #cc → input--error + aria-invalid + badge');
    check((await p.problems()).length === 0, `no exceptions / console errors / error banner${(await p.problems())[0] ? ": " + (await p.problems())[0] : ""}`);
    await p.closeTarget();

    console.log('\n■ space-request (building prefill)');
    const requestedBuildingId = '1080/6650/AA';
    p = await openPage(cdp, `${APP_BASE}/app/space-request?building=${encodeURIComponent(requestedBuildingId)}`);
    const validPrefill = await p.evaluate(PROBE_BUILDING_SELECTION);
    check(validPrefill.value === requestedBuildingId,
      `valid ?building selects the requested object (${validPrefill.value})`);
    check((await p.problems()).length === 0, 'valid building prefill has no runtime problems');
    await p.closeTarget();

    p = await openPage(cdp, `${APP_BASE}/app/space-request?building=not-a-building`);
    const invalidPrefill = await p.evaluate(PROBE_BUILDING_SELECTION);
    check(invalidPrefill.value === invalidPrefill.first && invalidPrefill.value !== 'not-a-building',
      `invalid ?building keeps the normal first-building default (${invalidPrefill.value})`);
    check((await p.problems()).length === 0, 'invalid building prefill has no runtime problems');
    await p.closeTarget();

    // Fault report: validation on #description and successful submission.
    console.log('\n■ fault-report');
    p = await openPage(cdp, `${APP_BASE}/app/fault-report`);
    const fr = await p.evaluate(PROBE_RENDER);
    check(fr.ok && fr.groups >= 5, `renders form (${fr.groups} field groups, ${fr.selects} selects)`);
    const frE = await p.evaluate(probeErrors(['description'], ['description']));
    check(errOk(frE.fields?.description), 'C5: cleared #description → input--error + aria-invalid + badge');
    check((await p.problems()).length === 0, `no exceptions / console errors / error banner${(await p.problems())[0] ? ": " + (await p.problems())[0] : ""}`);
    await p.closeTarget();

    console.log('\n■ fault-report (successful submit)');
    p = await openPage(cdp, `${APP_BASE}/app/fault-report`);
    const ok = await p.evaluate(PROBE_SUCCESS);
    check(ok.success && ok.noError, 'valid submit → success screen (case created)');
    check((await p.problems()).length === 0, `no exceptions / console errors / error banner${(await p.problems())[0] ? ": " + (await p.problems())[0] : ""}`);
    await p.closeTarget();

    console.log('\n■ fault-report (inherited query key)');
    p = await openPage(cdp, `${APP_BASE}/app/fault-report?type=toString`);
    const inheritedType = await p.evaluate(PROBE_RENDER);
    check(inheritedType.ok && inheritedType.title.includes('Störungs-'),
      'an inherited Object key falls back to the default report type');
    check((await p.problems()).length === 0, 'inherited query key has no runtime problems');
    await p.closeTarget();

    // Room booking: validation on #booking-date; the former wizard is absent.
    console.log('\n■ Room Booking');
    p = await openPage(cdp, `${APP_BASE}/app/room-booking`);
    await p.evaluate(`(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      let tries = 0;
      while (!document.querySelector('#booking-search') && tries++ < 120) await wait(100);
    })()`);
    const ws = await p.evaluate(PROBE_RENDER);
    check(ws.ok && ws.pageSelects >= 1, `renders the search bar (${ws.pageSelects} select)`);
    const wsE = await p.evaluate(probeErrors(['booking-date'], ['booking-date']));
    check(errOk(wsE.fields?.['booking-date']), 'C5: cleared #booking-date -> input--error + aria-invalid + badge');
    check((await p.problems()).length === 0, `no exceptions / console errors / error banner${(await p.problems())[0] ? ": " + (await p.problems())[0] : ""}`);
    await p.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
