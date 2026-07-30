// Die Abschlussseite eines eingereichten Vorgangs: Erfolgsmeldung mit
// Referenz, Überschrift, Erklärsatz, Knopfreihe — und zwar in allen vier
// Formular-Apps mit demselben Aufbau (C.processDone).
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const cdp = await launch();
// Angemeldet: die Formulare sind hinter dem Login-Gate.
const page = await openPage(cdp, `${APP_BASE}/`);
await sleep(700);
await page.evaluate(`(async () => {
  const b = document.querySelector('[data-login], .meta-navigation__auth');
  if (b) b.click();
  await new Promise(r => setTimeout(r, 600));
})()`);

// Störungsmeldung ausfüllen und absenden (kürzestes Formular).
const r = await page.evaluate(`(async () => {
  location.hash = '#/app/fault-report';
  await new Promise(r => setTimeout(r, 900));
  const setz = (sel, wert) => { const el = document.querySelector(sel); if (!el) return false;
    el.value = wert; el.dispatchEvent(new Event('change', { bubbles: true })); return true; };
  const felder = [...document.querySelectorAll('#main-content select, #main-content textarea, #main-content input')];
  for (const f of felder) {
    if (f.tagName === 'SELECT' && f.options.length > 1) { f.selectedIndex = 1; f.dispatchEvent(new Event('change', { bubbles: true })); }
    else if (f.tagName === 'TEXTAREA') { f.value = 'Testmeldung'; f.dispatchEvent(new Event('input', { bubbles: true })); }
    else if (f.type === 'text') { f.value = 'Test'; f.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  const form = document.querySelector('#main-content form');
  if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
  await new Promise(r => setTimeout(r, 900));
  const mc = document.querySelector('#main-content');
  const meldung = mc.querySelector('.notification--success');
  const h1 = mc.querySelector('h1');
  return {
    erfolg: !!meldung,
    inhalt: meldung ? !!meldung.querySelector('.notification__content') : false,
    referenz: meldung ? /BBL-\\d{4}-\\d+/.test(meldung.textContent) : false,
    h1: h1 ? h1.textContent.trim() : '',
    knoepfe: [...mc.querySelectorAll('.row .btn')].map(b => b.className.match(/btn--\\w+/)?.[0]),
    setz: typeof setz,
  };
})()`);
console.log(JSON.stringify(r, null, 2));
await cdp.close();
const ok = r.erfolg && r.inhalt && r.referenz && r.h1 === 'Vielen Dank' && r.knoepfe[0] === 'btn--filled';
console.log(ok ? '\nok — Abschlussseite über C.processDone.' : '\nFEHLER');
process.exit(ok ? 0 : 1);
