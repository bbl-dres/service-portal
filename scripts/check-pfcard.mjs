// Check aligned portfolio-card footers and the absence of a redundant type chip.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const cdp = await launch();
const page = await openPage(cdp, `${APP_BASE}/app/portfolio`);
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
await sleep(1400);

const result = await page.evaluate(`(() => {
  const cards = [...document.querySelectorAll('.pf-gallery .pf-card')];
  if (!cards.length) return { error: 'no cards' };
  const top = Math.round(cards[0].getBoundingClientRect().top);
  const firstRow = cards.filter((card) => Math.round(card.getBoundingClientRect().top) === top);
  const footerBottoms = firstRow.map((card) => Math.round(card.querySelector('.card__footer').getBoundingClientRect().bottom));
  const chips = [...document.querySelectorAll('.pf-card__chips .pf-card__country')].map((chip) => chip.textContent.trim());
  return {
    cards: cards.length,
    firstRowCount: firstRow.length,
    footerBottoms: [...new Set(footerBottoms)],
    chipsPerCard: [...new Set([...document.querySelectorAll('.pf-card__chips')].map((container) => container.children.length))],
    typeChips: chips.filter((chip) => chip === 'Gebäude' || chip === 'Grundstück').length,
    exampleChips: [...(document.querySelector('.pf-card__chips')?.children || [])].map((chip) => chip.textContent.trim()),
  };
})()`);
console.log(JSON.stringify(result, null, 2));
await cdp.close();

const ok = result.firstRowCount > 1 && result.footerBottoms.length === 1 && result.typeChips === 0;
console.log(ok
  ? `\nOK — ${result.firstRowCount} first-row cards share a ${result.footerBottoms[0]} px footer baseline and have no type chip.`
  : '\nFAIL');
process.exit(ok ? 0 : 1);
