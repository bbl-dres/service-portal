// Shared detail-page pattern: a full-width tab bar aligned with the hero, then
// a content column and sticky aside within the overview tab. Verify identical
// measurable structure in every application that uses the pattern.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const PAGES = [
  ['Property inventory',      `${APP_BASE}/app/portfolio?id=${encodeURIComponent('1080/4840/AF')}`],
  ['Tenancies',               `${APP_BASE}/app/tenancies/MV-2026-001`],
  ['Workspace Management',    `${APP_BASE}/app/workspace?id=${encodeURIComponent('1080/6650/AA')}`],
];

const cdp = await launch({ webgl: true });
let failures = 0;

for (const [name, url] of PAGES) {
  const page = await openPage(cdp, url);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  await sleep(2200);

  const r = await page.evaluate(`(() => {
    const q = (s) => document.querySelector(s);
    const b = (s) => { const e = q(s); return e ? Math.round(e.getBoundingClientRect().width) : null; };
    const aside = q('.detail-layout__aside');
    return {
      hero: b('.pf-mosaic'),
      tabBar: b('.tab__controls-container'),
      // The aside must be inside the overview panel, not beside it.
      insidePanel: !!q('.tab__container .detail-layout__aside'),
      position: aside ? getComputedStyle(aside).position : null,
      cards: [...document.querySelectorAll('.detail-layout__aside .box > h2')].map(h => h.textContent.trim()),
      // Every action label must begin on the same edge.
      labelX: [...new Set([...document.querySelectorAll('.detail-layout__aside .fp-svc span:not(.icon)')]
        .map(s => Math.round(s.getBoundingClientRect().left)))],
      gap: (() => { const cards = [...document.querySelectorAll('.detail-layout__aside > .box')];
        return cards.length > 1 ? Math.round(cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().bottom) : null; })(),
      // Hero map: external link is flush with the map.
      mapLink: q('.pf-hero__maplink a')?.getAttribute('href') || '',
      mapGap: (() => { const l = q('.pf-hero__maplink'), m = q('.pf-hero__map');
        return l && m ? Math.round(m.getBoundingClientRect().top - l.getBoundingClientRect().bottom) : null; })(),
    };
  })()`);

  // Other tabs must omit the aside so their tables can use the full width.
  const otherTab = await page.evaluate(`(async () => {
    const t = [...document.querySelectorAll('[role="tab"]')][1];
    if (t) t.click();
    await new Promise(r => setTimeout(r, 500));
    return JSON.stringify({
      tab: t ? t.textContent.trim() : null,
      aside: !!document.querySelector('.tab__container:not([hidden]) .detail-layout__aside'),
      panelWidth: Math.round(document.querySelector('.tab__container:not([hidden])').getBoundingClientRect().width),
    });
  })()`).then(JSON.parse);

  const p = [
    ['tab bar matches hero width', r.tabBar === r.hero],
    ['aside is inside the overview panel', r.insidePanel],
    ['aside is sticky', r.position === 'sticky'],
    ['cards use the expected German UI headings', r.cards.join(' · ') === 'Aktionen · Ansprechpersonen'],
    ['cards have contextual spacing', r.gap >= 16],
    ['action labels share one edge', r.labelX.length === 1],
    ['map link targets Google Maps', /google\.com\/maps\/search/.test(r.mapLink)],
    ['link bar is flush with the map', r.mapGap === 0],
    [`${otherTab.tab} has no aside and uses full width`,
      !otherTab.aside && otherTab.panelWidth === r.hero],
  ];
  console.log(`\n${name}  (hero ${r.hero}px / tab bar ${r.tabBar}px)`);
  for (const [description, passed] of p) {
    if (!passed) failures++;
    console.log(`${passed ? '  ok ' : 'FAIL '} ${description}`);
  }
  await page.closeTarget();
}

await cdp.close();
console.log(failures ? `\n${failures} discrepancies` : '\nAll applications use the same detail-page pattern.');
process.exit(failures ? 1 : 0);
