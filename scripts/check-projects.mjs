// Probe construction-project overview, tree, map and detail views.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const browser = await launch({ port: 9351, webgl: true });
const page = await openPage(browser, APP_BASE + '/app/projects');
await sleep(2200);
console.log('Overview:', await page.evaluate(`(() => {
  const chips = document.querySelector('.card__chips');
  return JSON.stringify({
    cards: document.querySelectorAll('.grid .card').length,
    pillRows: document.querySelectorAll('.grid .pill-row').length,
    chips: [...(chips?.querySelectorAll('.card__chip') || [])].map((chip) => chip.textContent),
    firstImage: !!document.querySelector('.card__image img'),
    treeCountries: [...document.querySelectorAll('.pf-tree > .pf-tree__item > .pf-tree__node .pf-tree__label')].map((label) => label.textContent),
    count: document.querySelector('#pj-count, .catbar__count')?.textContent.replace(/\\s+/g, ' ').trim(),
  });
})()`));
let errors = page.problems ? await page.problems() : [...page.exceptions, ...page.consoleErrors];
console.log('   Errors:', errors.length ? errors.join(' | ') : 'none');
console.log('   Loaded data files:', await page.evaluate(`JSON.stringify(performance.getEntriesByType('resource').filter((entry) => /\\.(json|geojson)/.test(entry.name)).map((entry) => entry.name.split('/').pop()))`));
await page.closeTarget();

const detail = await openPage(browser, APP_BASE + '/app/projects/PRJ-04');
await sleep(1500);
console.log('\nDetail PRJ-04:', await detail.evaluate(`(() => {
  const terms = [...document.querySelectorAll('.kv dt')].map((term, index) => term.textContent + ': ' + (document.querySelectorAll('.kv dd')[index]?.textContent.replace(/\\s+/g, ' ').trim() || ''));
  return JSON.stringify({ h1: document.querySelector('h1')?.textContent,
    summary: document.querySelector('h1 + p, .mt-4 p.muted')?.textContent.replace(/\\s+/g, ' ').trim(),
    image: !!document.querySelector('.photo img'), terms: terms.slice(0, 3) });
})()`));
errors = detail.problems ? await detail.problems() : [...detail.exceptions, ...detail.consoleErrors];
console.log('   Errors:', errors.length ? errors.join(' | ') : 'none');

await detail.evaluate(`location.hash = '#/app/projects?view=map'`);
await sleep(2500);
console.log('\nMap:', await detail.evaluate(`JSON.stringify({ canvas: !!document.querySelector('canvas'), markers: document.querySelectorAll('.maplibregl-marker').length })`));

await browser.close();
