// Compare construction-project and portfolio image chips.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const browser = await launch({ port: 9350 });

const probe = `(() => {
  const card = document.querySelector('.grid .card, .pf-gallery .card');
  if (!card) return JSON.stringify({ error: 'no card' });
  const chips = card.querySelector('.card__chips');
  const chipBox = chips && chips.getBoundingClientRect();
  const image = card.querySelector('.card__image, .pf-card__vis');
  const imageBox = image && image.getBoundingClientRect();
  const style = chips && getComputedStyle(chips);
  return JSON.stringify({
    pillRows: document.querySelectorAll('.grid .pill-row, .pf-gallery .pill-row').length,
    chipGroups: document.querySelectorAll('.card__chips').length,
    labels: chips ? [...chips.querySelectorAll('.card__chip')].map((chip) => chip.textContent) : [],
    insideImage: !!(chipBox && imageBox && chipBox.top >= imageBox.top - 1 && chipBox.left >= imageBox.left - 1),
    position: style && style.position,
    inset: style && [style.top, style.left, style.right].join(' '),
  });
})()`;

for (const [route, label] of [['/app/projects', 'Construction projects'], ['/app/portfolio', 'Portfolio']]) {
  const page = await openPage(browser, APP_BASE + route);
  await sleep(1800);
  console.log(label.padEnd(22), await page.evaluate(probe));
  const errors = page.problems ? await page.problems() : [...page.exceptions, ...page.consoleErrors];
  if (errors.length) console.log('   warning:', errors.join(' | '));
  await page.closeTarget();
}
await browser.close();
