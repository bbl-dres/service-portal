// Shared combobox controller through the deterministic home-page suggestions.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const cdp = await launch();
let failures = 0;
const check = (ok, label) => {
  console.log(`   ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures++;
};

try {
  const page = await openPage(cdp, `${APP_BASE}/`);
  await sleep(1400);

  console.log('■ Gemeinsame ARIA-Combobox');
  let result = await page.evaluate(`(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const input = document.querySelector('#home-q');
    input.focus();
    input.value = 'störung';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(250);
    const list = document.querySelector('#home-q-suggest');
    const options = [...list.querySelectorAll('[role="option"]')];
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const active = input.getAttribute('aria-activedescendant');
    return {
      role: input.getAttribute('role'),
      controls: input.getAttribute('aria-controls'),
      expanded: input.getAttribute('aria-expanded'),
      options: options.length,
      active,
      selected: active ? document.getElementById(active)?.getAttribute('aria-selected') : null,
    };
  })()`);
  check(result.role === 'combobox' && result.controls === 'home-q-suggest', 'Rolle und Listenbezug gesetzt');
  check(result.expanded === 'true' && result.options > 0, `Liste geöffnet (${result.options} Optionen)`);
  check(!!result.active && result.selected === 'true', 'Pfeiltaste synchronisiert aria-activedescendant');

  result = await page.evaluate(`(() => {
    const input = document.querySelector('#home-q');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const list = document.querySelector('#home-q-suggest');
    return {
      hidden: list.hidden,
      expanded: input.getAttribute('aria-expanded'),
      active: input.hasAttribute('aria-activedescendant'),
    };
  })()`);
  check(result.hidden && result.expanded === 'false' && !result.active, 'Escape räumt offenen Zustand vollständig auf');
  check((await page.problems()).length === 0, 'Keine Browser- oder Konsolenfehler');
  await page.closeTarget();
} finally {
  cdp.close();
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
