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
  // The chips are ordinary badges since 2026-08-12; the gallery no longer owns a
  // pill shape of its own (.pf-card__country was excised with the change).
  const chipEls = [...document.querySelectorAll('.pf-card__chips .badge')];
  const chips = chipEls.map((chip) => chip.textContent.trim());
  const media = document.querySelector('.pf-card__vis');
  const row = document.querySelector('.pf-card__chips');
  return {
    cards: cards.length,
    firstRowCount: firstRow.length,
    footerBottoms: [...new Set(footerBottoms)],
    chipsPerCard: [...new Set([...document.querySelectorAll('.pf-card__chips')].map((container) => container.children.length))],
    typeChips: chips.filter((chip) => chip === 'Gebäude' || chip === 'Grundstück').length,
    // Every chip is the shared badge, not a local variant — counted per row, or
    // one row's children would be compared against the whole gallery's badges.
    nonBadgeChips: [...document.querySelectorAll('.pf-card__chips')]
      .reduce((n, r) => n + (r.children.length - r.querySelectorAll(':scope > .badge').length), 0),
    // One inset for every overlay on card media (css/components/card.css).
    inset: media && row
      ? { top: Math.round(row.getBoundingClientRect().top - media.getBoundingClientRect().top),
        left: Math.round(row.getBoundingClientRect().left - media.getBoundingClientRect().left) }
      : null,
    exampleChips: chips.slice(0, 2),
  };
})()`);
console.log(JSON.stringify(result, null, 2));
await cdp.close();

const ok = result.firstRowCount > 1 && result.footerBottoms.length === 1 && result.typeChips === 0
  && result.nonBadgeChips === 0 && result.inset?.top === 12 && result.inset?.left === 12;
console.log(ok
  ? `\nOK — ${result.firstRowCount} first-row cards share a ${result.footerBottoms[0]} px footer baseline, `
    + 'carry no type chip, and their badges sit at the shared 12px media inset.'
  : '\nFAIL');
process.exit(ok ? 0 : 1);
