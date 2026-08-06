// Galerie der Bauprojekte: keine Pillenzeile mehr, stattdessen Chips auf dem
// Bild — und zwar geometrisch gleich wie im Liegenschaften-Inventar.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const b = await launch({ port: 9350 });

const probe = `(() => {
  const card = document.querySelector('.grid .card, .pf-gallery .card');
  if (!card) return JSON.stringify({ fehler: 'keine Karte' });
  const chips = card.querySelector('.pf-card__chips');
  const box = chips && chips.getBoundingClientRect();
  const img = card.querySelector('.card__image, .pf-card__vis');
  const ibox = img && img.getBoundingClientRect();
  const cs = chips && getComputedStyle(chips);
  return JSON.stringify({
    pillRows: document.querySelectorAll('.grid .pill-row, .pf-gallery .pill-row').length,
    chipsGesamt: document.querySelectorAll('.pf-card__chips').length,
    texte: chips ? [...chips.querySelectorAll('.pf-card__land')].map(x => x.textContent) : [],
    imBild: !!(box && ibox && box.top >= ibox.top - 1 && box.left >= ibox.left - 1),
    position: cs && cs.position,
    inset: cs && [cs.top, cs.left, cs.right].join(' '),
  });
})()`;

for (const [route, label] of [['/app/projects', 'Bauprojekte'], ['/app/portfolio', 'Liegenschaften']]) {
  const p = await openPage(b, APP_BASE + route);
  await sleep(1800);
  console.log(label.padEnd(16), await p.evaluate(probe));
  const errs = p.problems ? await p.problems() : [...p.exceptions, ...p.consoleErrors];
  if (errs.length) console.log('   ⚠', errs.join(' | '));
  await p.closeTarget();
}
await b.close();
