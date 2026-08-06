// Suchvorschläge auf der Startseite: Tastaturbedienung und ARIA.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const b = await launch({ port: 9349 });
const p = await openPage(b, APP_BASE + '/');
await sleep(1200);

const type = async (text) => p.evaluate(`(async () => {
  const i = document.querySelector('#home-q');
  i.focus(); i.value = ${JSON.stringify(text)};
  i.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 200));
  const l = document.querySelector('#home-q-suggest');
  return JSON.stringify({
    offen: i.getAttribute('aria-expanded'),
    rolle: i.getAttribute('role'),
    controls: i.getAttribute('aria-controls'),
    sichtbar: l ? !l.hidden : null,
    n: l ? l.querySelectorAll('.suggest__item').length : 0,
    erste: l?.querySelector('.suggest__title')?.textContent,
    listRolle: l?.getAttribute('role'),
  });
})()`);

const key = async (k) => p.evaluate(`(async () => {
  const i = document.querySelector('#home-q');
  i.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 120));
  const l = document.querySelector('#home-q-suggest');
  return JSON.stringify({
    aktiv: i.getAttribute('aria-activedescendant'),
    markiert: l?.querySelector('.suggest__item.is-active .suggest__title')?.textContent || null,
    offen: i.getAttribute('aria-expanded'),
    hash: location.hash,
  });
})()`);

console.log('tippen «vorlage»   →', await type('vorlage'));
console.log('ArrowDown          →', await key('ArrowDown'));
console.log('ArrowDown          →', await key('ArrowDown'));
console.log('ArrowUp            →', await key('ArrowUp'));
console.log('Enter              →', await key('Enter'));
await sleep(400);
console.log('Route nach Enter   →', await p.evaluate(`location.hash`));

// Kurze Eingabe darf nicht öffnen
await p.evaluate(`location.hash = '#/'`);
await sleep(500);
console.log('tippen «v»         →', await type('v'));
console.log('Escape             →', await key('Escape'));

// Aufräumen beim Routenwechsel
await p.evaluate(`location.hash = '#/services'`);
await sleep(500);
console.log('nach Routenwechsel: Liste im DOM?', await p.evaluate(`!!document.querySelector('#home-q-suggest')`));

const errs = p.problems ? await p.problems() : [...p.exceptions, ...p.consoleErrors];
console.log('Fehler:', errs.length ? errs.join(' | ') : 'keine');
await b.close();
