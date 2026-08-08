// Home-page search suggestions: keyboard behaviour and ARIA.
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
    open: i.getAttribute('aria-expanded'),
    role: i.getAttribute('role'),
    controls: i.getAttribute('aria-controls'),
    visible: l ? !l.hidden : null,
    count: l ? l.querySelectorAll('.listbox__option').length : 0,
    first: l?.querySelector('.listbox__title')?.textContent,
    listRole: l?.getAttribute('role'),
  });
})()`);

const key = async (k) => p.evaluate(`(async () => {
  const i = document.querySelector('#home-q');
  i.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 120));
  const l = document.querySelector('#home-q-suggest');
  return JSON.stringify({
    active: i.getAttribute('aria-activedescendant'),
    selected: l?.querySelector('.listbox__option.is-active .listbox__title')?.textContent || null,
    open: i.getAttribute('aria-expanded'),
    hash: location.hash,
  });
})()`);

console.log('type German query   ->', await type('vorlage'));
console.log('ArrowDown           ->', await key('ArrowDown'));
console.log('ArrowDown           ->', await key('ArrowDown'));
console.log('ArrowUp             ->', await key('ArrowUp'));
console.log('Enter               ->', await key('Enter'));
await sleep(400);
console.log('route after Enter   ->', await p.evaluate(`location.hash`));

// A one-character query must not open suggestions.
await p.evaluate(`location.hash = '#/'`);
await sleep(500);
console.log('type "v"           ->', await type('v'));
console.log('Escape             ->', await key('Escape'));

// Route changes must clean up the list.
await p.evaluate(`location.hash = '#/services'`);
await sleep(500);
console.log('list remains after route change?', await p.evaluate(`!!document.querySelector('#home-q-suggest')`));

const errs = p.problems ? await p.problems() : [...p.exceptions, ...p.consoleErrors];
console.log('errors:', errs.length ? errs.join(' | ') : 'none');
await b.close();
