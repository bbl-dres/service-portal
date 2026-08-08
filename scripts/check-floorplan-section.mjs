// Check the floor-plan tab in both states: floor table at rest and the viewer
// in its place after a row click. The page header, mosaic and tabs must persist.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const URL = `${APP_BASE}/app/tenancies/MV-2026-001`;
const cdp = await launch();
const page = await openPage(cdp, URL);
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false }, page.sessionId);
await sleep(1600);

const readState = () => page.evaluate(`(() => {
  const query = (selector) => document.querySelector(selector);
  const isVisible = (selector) => { const element = query(selector); return !!element && element.offsetParent !== null; };
  return {
    tabs: [...document.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent.trim()),
    tabBar: isVisible('.tab__controls'),
    floorplanTab: [...document.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent.trim()).find((label) => /Grundriss/.test(label)),
    table: !!query('#tenancy-floor-table table'),
    viewer: !!query('#fp-wrap'),
    activeFloor: query('.fp-floors .tag-item--active')?.textContent.trim(),
    sideFacts: query('.fp-side .fp-facts')?.textContent.replace(/\\s+/g, ' ').trim(),
    fullscreen: !!query('#floorplan-fullscreen'),
    print: !!query('#floorplan-print'),
    back: !!query('#floorplan-back'),
    color: query('#fp-color')?.value,
    legend: document.querySelectorAll('.fp-legend__item').length,
    roomPanel: !!query('#fp-room'),
    metrics: !!query('.kpi-strip'),
    requests: !!query('#tenancy-case-table table'),
    mosaic: !!query('#mt-mosaic'),
    sectionOrder: [...document.querySelectorAll('.tab__container:not([hidden]) section, .detail-layout__aside .box')]
      .map((element) => (element.querySelector(':scope > h2')?.textContent.trim() || '').split(' ')[0]),
    headerPosition: query('.fp-head') ? getComputedStyle(query('.fp-head')).position : null,
    hash: location.hash,
  };
})()`);

const before = await readState();
await page.evaluate(`document.querySelector('#tenancy-floor-table tbody a')?.click()`);
await sleep(800);
const after = await readState();

await page.evaluate(`document.querySelector('#floorplan-back')?.click()`);
await sleep(700);
const back = await readState();

// The legacy tab query value remains a supported compatibility adapter.
const legacyLink = await page.evaluate(`(async () => {
  location.hash = '#/app/tenancies/MV-2026-001?tab=grundriss&floor=1080-4850-AG-2og&color=use';
  await new Promise((resolve) => setTimeout(resolve, 800));
  return JSON.stringify({ viewer: !!document.querySelector('#fp-wrap'),
    color: document.querySelector('#fp-color')?.value,
    activeTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent.trim() });
})()`).then(JSON.parse);

await page.evaluate(`document.body.classList.add('print--plan')`);
await cdp.send('Emulation.setEmulatedMedia', { media: 'print' }, page.sessionId);
await sleep(200);
const printState = await page.evaluate(`(() => {
  const visibility = (selector) => { const element = document.querySelector(selector); return element ? getComputedStyle(element).visibility : null; };
  const display = (selector) => { const element = document.querySelector(selector); return element ? getComputedStyle(element).display : null; };
  return JSON.stringify({
    content: visibility('#main-content'), section: visibility('#tenancy-floorplan__body'), plan: visibility('svg.fp'),
    legend: display('.fp-legend'), roomDetails: display('#fp-room'), buttons: display('.fp-head__actions'),
    floorSelection: display('.fp-color'), footer: display('.fp-print-foot'),
  });
})()`).then(JSON.parse);
await cdp.send('Emulation.setEmulatedMedia', { media: '' }, page.sessionId);
await page.evaluate(`document.body.classList.remove('print--plan')`);

await cdp.close();
console.log(JSON.stringify({ before, after, back, legacyLink, printState }, null, 1));

const checks = [
  ['Three tabs include a dedicated floor-plan tab', before.tabs.length === 3 && before.tabs.some((label) => /^Grundrisse/.test(label))],
  ['The floor-plan tab includes its count', /^Grundrisse \(\d+\)$/.test(before.floorplanTab || '')],
  ['The overview keeps the expected section order', before.sectionOrder.join('>') === 'Vertrag>Anträge>Aktionen>Ansprechpersonen'],
  ['The resting state shows the floor table', before.table && !before.viewer],
  ['A row click replaces the table with the viewer', after.viewer && !after.table],
  ['The tab bar remains visible', after.tabBar],
  ['Metrics, requests and mosaic remain in place', after.metrics && after.requests && after.mosaic],
  ['The active floor is shown as a chip', !!after.activeFloor],
  ['Floor metrics appear in the analysis column', /Räume/.test(after.sideFacts || '')],
  ['The header includes back, fullscreen and print controls', after.back && after.fullscreen && after.print],
  ['The floor-plan header is sticky', after.headerPosition === 'sticky'],
  ['The default administrative-unit colour mode has a legend', after.color === 've' && after.legend > 0],
  ['The room-details panel exists', after.roomPanel],
  ['The back link returns to the table', back.table && !back.viewer],
  ['The legacy floor-plan tab link still opens the plan', legacyLink.viewer && legacyLink.color === 'use'],
  ['The legacy link selects the floor-plan tab', /^Grundrisse/.test(legacyLink.activeTab || '')],
  ['Print shows only the floor plan', printState.content === 'hidden' && printState.section === 'visible' && printState.plan === 'visible'],
  ['Print includes the colour legend', printState.legend !== 'none'],
  ['Print hides controls and room details', ['roomDetails', 'buttons', 'floorSelection'].every((key) => printState[key] === 'none')],
  ['Print includes the contextual footer', printState.footer === 'block'],
];
let failures = 0;
for (const [label, ok] of checks) { if (!ok) failures++; console.log(`${ok ? '  ok ' : ' FAIL'} ${label}`); }
console.log(failures ? `\n${failures} deviations` : '\nThe floor-plan tab, header and print view behave as designed.');
process.exit(failures ? 1 : 0);
