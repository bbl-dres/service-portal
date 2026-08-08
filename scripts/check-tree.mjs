// Structure-tree counts must follow active filters. The sum of visible root
// nodes must equal the toolbar result count before and after toggling a filter.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const APPS = [
  ['Portfolio',   `${APP_BASE}/app/portfolio`,  '#pf-count'],
  ['Projects',    `${APP_BASE}/app/projects`,   '#pj-count'],
  ['Tenancies',   `${APP_BASE}/app/tenancies`,  '#mt-count'],
];

const READ_COUNTS = (counterSelector) => `(() => {
  const roots = [...document.querySelectorAll('.pf-tree > .pf-tree__item')].filter(li => !li.hidden);
  const sum = roots.reduce((total, li) => total + Number(li.querySelector('.pf-tree__n').textContent || 0), 0);
  const counter = document.querySelector('${counterSelector}');
  // The first number in the German toolbar string is the result count.
  const matches = counter ? Number((counter.textContent.match(/[0-9'’]+/) || ['0'])[0].replace(/['’]/g, '')) : null;
  return { sum, matches, roots: roots.length,
           leaves: [...document.querySelectorAll('.pf-tree__leaf')].filter(b => !b.closest('.pf-tree__item').hidden).length };
})()`;

const cdp = await launch();
let failures = 0;
for (const [name, url, counterSelector] of APPS) {
  const page = await openPage(cdp, url);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await sleep(1300);

  const before = await page.evaluate(READ_COUNTS(counterSelector));
  // Toggle the first facet filter and measure again.
  const toggled = await page.evaluate(`(async () => {
    const button = document.querySelector('[id$="-ftoggle"], .catbar__filter');
    if (button) button.click();
    await new Promise(r => setTimeout(r, 150));
    const box = document.querySelector('.filter-check input[type=checkbox]');
    if (!box) return false;
    box.click();
    await new Promise(r => setTimeout(r, 400));
    return true;
  })()`);
  const after = toggled ? await page.evaluate(READ_COUNTS(counterSelector)) : null;

  const ok = before.sum === before.matches
    && (!after || (after.sum === after.matches && after.sum !== before.sum));
  if (!ok) failures++;
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name.padEnd(12)} before tree ${before.sum} / results ${before.matches}` +
    (after ? ` / after filter tree ${after.sum} / results ${after.matches}` : ' / no filter found'));
  await page.closeTarget();
}
await cdp.close();
console.log(failures ? `\n${failures} discrepancies` : '\nTree counts follow filter state.');
process.exit(failures ? 1 : 0);
