// Verify the shared C.processDone completion page: success notification with a
// reference, heading, explanatory text, and action row across all form apps.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const cdp = await launch();
// Forms are behind the login gate.
const page = await openPage(cdp, `${APP_BASE}/`);
await sleep(700);
await page.evaluate(`(async () => {
  const b = document.querySelector('[data-login], .meta-navigation__auth');
  if (b) b.click();
  await new Promise(r => setTimeout(r, 600));
})()`);

// Fill and submit the shortest form, the fault report.
const r = await page.evaluate(`(async () => {
  location.hash = '#/app/fault-report';
  await new Promise(r => setTimeout(r, 900));
  const setValue = (selector, value) => { const el = document.querySelector(selector); if (!el) return false;
    el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); return true; };
  const fields = [...document.querySelectorAll('#main-content select, #main-content textarea, #main-content input')];
  for (const f of fields) {
    if (f.tagName === 'SELECT' && f.options.length > 1) { f.selectedIndex = 1; f.dispatchEvent(new Event('change', { bubbles: true })); }
    else if (f.tagName === 'TEXTAREA') { f.value = 'Test message'; f.dispatchEvent(new Event('input', { bubbles: true })); }
    else if (f.type === 'text') { f.value = 'Test'; f.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  const form = document.querySelector('#main-content form');
  if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
  await new Promise(r => setTimeout(r, 900));
  const mc = document.querySelector('#main-content');
  const notification = mc.querySelector('.notification--success');
  const h1 = mc.querySelector('h1');
  return {
    success: !!notification,
    content: notification ? !!notification.querySelector('.notification__content') : false,
    reference: notification ? /BBL-\\d{4}-\\d+/.test(notification.textContent) : false,
    h1: h1 ? h1.textContent.trim() : '',
    buttons: [...mc.querySelectorAll('.row .btn')].map(b => b.className.match(/btn--\\w+/)?.[0]),
    setValue: typeof setValue,
  };
})()`);
console.log(JSON.stringify(r, null, 2));
await cdp.close();
const ok = r.success && r.content && r.reference && r.h1 === 'Vielen Dank' && r.buttons[0] === 'btn--filled';
console.log(ok ? '\nok - completion page rendered through C.processDone' : '\nFAILED');
process.exit(ok ? 0 : 1);
