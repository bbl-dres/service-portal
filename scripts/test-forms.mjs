// D3 form-helper consolidation + C5 fix — verifies the three wizards (space-request,
// fault-report, Room Booking) after routing through C.field / C.select /
// C.val / C.readForm. The C5 check: a custom validation error must attach the
// `input--error` class to previously class-less fields (#org, #cc, #beschreibung,
// #booking-date) — the old regex only did so when a class already existed.
//
// Dispatching a synthetic 'submit' bypasses native required-validation, isolating
// the custom validate() path where C5 lives. Forms are login-gated, so we log in
// once (localStorage persists across tabs in the one browser profile).
//
//   node scripts/test-forms.mjs      (dev server must be running; see README)
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const LOGIN = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  // __login is exposed at the end of app.js boot() (after core.load()); poll for it
  // instead of racing boot, or the login silently no-ops and the forms stay gated.
  let n = 0; while (typeof window.__login !== 'function' && n++ < 120) await s(50);
  if (typeof window.__login !== 'function') return 'no __login';
  window.__login(); return 'ok';
})()`;

// clear the given fields, fire the custom submit handler, report each field's state.
// Scope to the WIZARD form via a field's closest('form') — the shell's header
// search is also a <form> and comes first in the DOM.
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

// count rendered fields (form groups) as a render sanity check
const PROBE_RENDER = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.querySelector('#wiz, #report-form, #booking-form') && n++ < 120) await s(100);
  const form = document.querySelector('#wiz, #report-form, #booking-form');
  return {
    ok: !!form,
    groups: form ? form.querySelectorAll('.form__group__input, .form__group__select').length : 0,
    selects: form ? form.querySelectorAll('select').length : 0,
    pageSelects: document.querySelectorAll('#main-content select').length,
  };
})()`;

// Gebäude wählen, beschreibung füllen, absenden → Erfolgsbildschirm (Vorgang).
// Seit dem Review (forms/errsum-1-Umfeld) startet das Pflichtfeld «Gebäude»
// LEER («Bitte wählen …») statt still mit dem ersten Gebäude vorbelegt — der
// Test muss wie ein Mensch zuerst wählen.
const PROBE_SUCCESS = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.getElementById('beschreibung') && n++ < 120) await s(100);
  const bld = document.getElementById('bld');
  if (bld && bld.tagName === 'SELECT') {
    const opt = [...bld.options].find(o => o.value);
    if (opt) { bld.value = opt.value; bld.dispatchEvent(new Event('change', { bubbles: true })); }
  }
  const bes = document.getElementById('beschreibung');
  bes.value = 'Testmeldung aus dem Formulartest';
  bes.closest('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  await s(300);
  return { success: !!document.querySelector('.notification--success'), noError: !document.querySelector('.input--error') };
})()`;

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };
const errOk = (f) => f && f !== 'MISSING' && f.err === true && f.ariaInvalid === 'true' && f.badge === true;

(async () => {
  const cdp = await launch();
  try {
    // log in once (persists across tabs via localStorage)
    let p = await openPage(cdp, `${APP_BASE}/app/room-booking`);
    await p.evaluate(LOGIN);
    await sleep(800);
    await p.closeTarget();

    // --- space-request: render + C5 on #org/#cc ---
    console.log('\n■ space-request (step 1)');
    p = await openPage(cdp, `${APP_BASE}/app/space-request`);
    const sr = await p.evaluate(PROBE_RENDER);
    check(sr.ok && sr.groups >= 4, `renders form (${sr.groups} field groups)`);
    const srE = await p.evaluate(probeErrors(['org', 'cc'], ['org', 'cc']));
    check(errOk(srE.fields?.org), 'C5: cleared #org → input--error + aria-invalid + badge');
    check(errOk(srE.fields?.cc), 'C5: cleared #cc → input--error + aria-invalid + badge');
    check((await p.problems()).length === 0, `no exceptions / console errors / error banner${(await p.problems())[0] ? ": " + (await p.problems())[0] : ""}`);
    await p.closeTarget();

    // --- fault-report: render + C5 on #beschreibung + success submit ---
    console.log('\n■ fault-report');
    p = await openPage(cdp, `${APP_BASE}/app/fault-report`);
    const fr = await p.evaluate(PROBE_RENDER);
    check(fr.ok && fr.groups >= 5, `renders form (${fr.groups} field groups, ${fr.selects} selects)`);
    const frE = await p.evaluate(probeErrors(['beschreibung'], ['beschreibung']));
    check(errOk(frE.fields?.beschreibung), 'C5: cleared #beschreibung → input--error + aria-invalid + badge');
    check((await p.problems()).length === 0, `no exceptions / console errors / error banner${(await p.problems())[0] ? ": " + (await p.problems())[0] : ""}`);
    await p.closeTarget();

    console.log('\n■ fault-report (successful submit)');
    p = await openPage(cdp, `${APP_BASE}/app/fault-report`);
    const ok = await p.evaluate(PROBE_SUCCESS);
    check(ok.success && ok.noError, 'valid submit → success screen (Vorgang created)');
    check((await p.problems()).length === 0, `no exceptions / console errors / error banner${(await p.problems())[0] ? ": " + (await p.problems())[0] : ""}`);
    await p.closeTarget();

    // --- Room Booking: render + C5 on #booking-date ---
    console.log('\n■ Room Booking');
    p = await openPage(cdp, `${APP_BASE}/app/room-booking`);
    const ws = await p.evaluate(PROBE_RENDER);
    check(ws.ok && ws.pageSelects >= 2, `renders booking search and confirmation forms (${ws.pageSelects} selects)`);
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
