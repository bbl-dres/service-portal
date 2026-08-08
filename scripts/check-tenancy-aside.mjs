// Check the tenancy detail layout, sticky aside, summary metrics and row affordances.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const cdp = await launch();
const page = await openPage(cdp, `${APP_BASE}/app/tenancies/MV-2026-001`);
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
await sleep(1600);

const result = await page.evaluate(`(() => {
  const query = (selector) => document.querySelector(selector);
  const queryAll = (selector) => [...document.querySelectorAll(selector)];
  const aside = query('.detail-layout__aside');
  const panels = queryAll('.detail-layout__aside > .box');
  const background = (element) => element ? getComputedStyle(element).backgroundColor : null;
  return {
    mainPanels: queryAll('.tab__container:not([hidden]) section').map((panel) => panel.querySelector(':scope > h2')?.textContent.trim()),
    asidePanels: panels.map((panel) => panel.querySelector(':scope > h2')?.textContent.trim()),
    headingLevels: queryAll('.tab__container:not([hidden]) section > h2, .detail-layout__aside .box > h2').map((heading) => heading.tagName),
    pageBackground: background(query('#main-content')),
    eyebrow: query('.eyebrow')?.textContent.trim(),
    chip: query('.pill-row .badge')?.textContent.trim(),
    metricLabels: queryAll('.kpi-strip__label').map((element) => element.textContent.trim()),
    metricColumns: query('.kpi-strip') ? getComputedStyle(query('.kpi-strip')).gridTemplateColumns.split(' ').length : 0,
    asidePosition: aside ? getComputedStyle(aside).position : null,
    asideWidth: aside ? Math.round(aside.getBoundingClientRect().width) : null,
    mainWidth: query('.detail-layout > div') ? Math.round(query('.detail-layout > div').getBoundingClientRect().width) : null,
    roles: queryAll('.detail-layout__aside .kv dt').map((term) => term.textContent.trim()),
    duplicatedRole: (() => { const terms = queryAll('.detail-layout__aside .kv dt').map((term) => term.textContent.trim());
      const values = queryAll('.detail-layout__aside .kv dd').map((value) => value.textContent.trim());
      return terms.some((role, index) => (values[index] || '').startsWith(role)); })(),
    documentLink: query('.detail-layout__aside a[href*="document-archive"]')?.getAttribute('href'),
    documentSection: queryAll('.tab__container:not([hidden]) section > h2, .detail-layout__aside .box > h2').some((heading) => /Dokument/.test(heading.textContent)),
    rowAffordance: (() => { const cell = query('.table--rows-clickable tbody tr > :last-child');
      return cell ? getComputedStyle(cell, '::after').maskImage || getComputedStyle(cell, '::after').webkitMaskImage : null; })(),
    floorColumns: queryAll('#tenancy-floor-table thead th').map((element) => element.textContent.trim()),
    locationBadges: queryAll('#tenancy-floor-table tbody .badge').map((element) => element.textContent.trim()),
  };
})()`);

const sticky = await page.evaluate(`(async () => {
  const aside = document.querySelector('.detail-layout__aside');
  const before = Math.round(aside.getBoundingClientRect().top);
  window.scrollTo(0, 1200);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const after = Math.round(aside.getBoundingClientRect().top);
  const visible = after >= 0 && after < window.innerHeight;
  window.scrollTo(0, 0);
  return JSON.stringify({ before, after, visible });
})()`).then(JSON.parse);

await cdp.close();
console.log(JSON.stringify({ ...result, sticky }, null, 1));

const checks = [
  ['The overview has its two expected sections', result.mainPanels.join(' · ') === 'Vertrag und Mengengerüst · Anträge zu diesem Mietobjekt'],
  ['The aside has action and contact cards', result.asidePanels.join(' · ') === 'Aktionen · Ansprechpersonen'],
  ['All card titles use h2', result.headingLevels.every((level) => level === 'H2')],
  ['The page keeps a white background', /255, 255, 255/.test(result.pageBackground || '') || result.pageBackground === 'rgba(0, 0, 0, 0)'],
  ['The eyebrow includes the tenancy and property identifiers', /MV-2026-001/.test(result.eyebrow || '') && /Objekt/.test(result.eyebrow || '')],
  ['The remaining term appears as a header badge', /noch /.test(result.chip || '')],
  ['The summary strip has four metrics', result.metricLabels.length === 4 && result.metricColumns === 4],
  ['The aside uses sticky positioning', result.asidePosition === 'sticky'],
  ['The aside remains visible while scrolling', sticky.visible && sticky.after !== sticky.before - 1200],
  ['The main column is wider than 900 px', result.mainWidth > 900],
  ['A contact role is not repeated in its value', result.duplicatedRole === false],
  ['The document-archive link carries a building filter', /building=/.test(result.documentLink || '')],
  ['There is no duplicate document section', result.documentSection === false],
  ['Clickable rows expose the chevron affordance', /ChevronRight/.test(result.rowAffordance || '')],
  ['The floor table includes the tenant-specific column', result.floorColumns.some((label) => /^Davon /.test(label))],
  ['The tenant location is marked', result.locationBadges.some((label) => label === 'Ihr Standort')],
];
let failures = 0;
for (const [label, ok] of checks) { if (!ok) failures++; console.log(`${ok ? '  ok ' : ' FAIL'} ${label}`); }
console.log(failures ? `\n${failures} deviations` : '\nThe tenancy detail layout behaves as designed.');
process.exit(failures ? 1 : 0);
