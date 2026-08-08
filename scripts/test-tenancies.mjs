



import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let fail = 0;
const check = (cond, label, detail = '') => {
  if (!cond) fail++;
  console.log(`   ${cond ? '✓' : '✗'} ${label}${detail ? '  (' + detail + ')' : ''}`);
};
const head = (s) => console.log('\n■ ' + s);
const clean = async (p, label) => {
  const errs = await p.problems();
  check(!errs.length, `${label}: no errors`, errs.join(' | '));
};

const browser = await launch({ webgl: true });
try {


head('Overview');
let p = await openPage(browser, APP_BASE + '/app/tenancies');
await sleep(1400);
let o = JSON.parse(await p.evaluate(`JSON.stringify({
  h1: document.querySelector('h1')?.textContent.trim(),
  cards: document.querySelectorAll('.pf-gallery .card').length,
  count: document.querySelector('#mt-count')?.textContent.replace(/\\s+/g,' ').trim(),
  tileGrid: document.querySelectorAll('.grid--3').length,
  chips: [...document.querySelectorAll('.card__chips .card__chip')].slice(0,2).map(x => x.textContent),
  administrativeUnitFilter: [...document.querySelectorAll('[data-fdim=administrativeUnits]')].map(x => x.value),
  views: [...document.querySelectorAll('.view-switch__btn')].map(x => x.dataset.view),
})`));
check(o.h1 === 'Mietende', 'The page has its title', o.h1);
check(o.cards === 9, 'The gallery shows nine cards per page', String(o.cards));
check(/18 von 18/.test(o.count || ''), 'The result count is complete', o.count);
check(!/m²/.test(o.count || '') && !/CHF/.test(o.count || ''), 'The count line contains no dashboard metrics');
check(o.tileGrid === 0, 'The retired three-column tile grid is absent');
check(o.chips.length === 2, 'Each image has administrative-unit and floor chips', o.chips.join(' | '));
check(o.administrativeUnitFilter.length === 9, 'The filter lists nine administrative units', o.administrativeUnitFilter.join(','));
check(o.views.join(',') === 'gallery,list,map', 'Gallery, list and map views are available', o.views.join(','));
await clean(p, 'Overview');

head('Filters and spatial tree');
o = JSON.parse(await p.evaluate(`(async () => {
  const cb = [...document.querySelectorAll('[data-fdim=administrativeUnits]')].find(x => x.value === 'BAFU');
  cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 350));
  return JSON.stringify({ count: document.querySelector('#mt-count')?.textContent.replace(/\\s+/g,' ').trim(),
    chip: document.querySelector('.active-filter')?.textContent.trim() });
})()`));
check(/3 von 18/.test(o.count || ''), 'The BAFU filter applies', o.count);
check(o.chip === 'BAFU', 'The filter chip is visible', o.chip);

o = JSON.parse(await p.evaluate(`(async () => {
  document.querySelector('.active-filter')?.click();
  await new Promise(r => setTimeout(r, 300));
  const sidebar = document.querySelector('.pf-sidebar');
  const roots = [...sidebar.querySelectorAll('.pf-tree > .pf-tree__item > .pf-tree__node')];
  const countries = roots.map(n => n.querySelector('.pf-tree__label').textContent + ' ' + n.querySelector('.pf-tree__n').textContent);
  const ch = roots.find(n => n.dataset.country === 'CH');
  ch.click();
  await new Promise(r => setTimeout(r, 300));
  const cantons = [...ch.closest('.pf-tree__item').querySelectorAll(':scope > .pf-tree__children > .pf-tree__item > .pf-tree__node .pf-tree__label')].map(x => x.textContent);
  return JSON.stringify({
    sidebar: !!sidebar,
    title: sidebar.querySelector('.pf-sidebar__title')?.textContent.trim(),
    countries,
    chCount: ch.querySelector('.pf-tree__n')?.textContent,
    cantons,
    count: document.querySelector('#mt-count')?.textContent.replace(/\\s+/g,' ').trim(),
  });
})()`));
check(o.sidebar, 'The spatial sidebar exists', o.title);
check(o.countries.length === 6, 'The tree contains six countries', o.countries.join(' · '));
check(o.chCount === '11', 'Switzerland has the expected count of 11', o.chCount);
check(o.cantons.length >= 3, 'Cantons form the second level below Switzerland', o.cantons.join(', '));

o = JSON.parse(await p.evaluate(`(async () => {
  const bern = [...document.querySelectorAll('.pf-sidebar .pf-tree__node')].find(n => n.dataset.region === 'BE' && !n.dataset.city);
  bern.click();
  await new Promise(r => setTimeout(r, 350));
  return JSON.stringify({ count: document.querySelector('#mt-count')?.textContent.replace(/\\s+/g,' ').trim(),
    chip: document.querySelector('.active-filter')?.textContent.trim(),
    clearVisible: !document.querySelector('#mt-clear')?.hidden });
})()`));
check(/ von 18 /.test(o.count || '') && !/18 von 18/.test(o.count || ''), 'Canton BE narrows the result set', o.count);
check(o.chip === 'BE', 'The tree selection appears as a chip', o.chip);
check(o.clearVisible, 'The clear-selection control becomes visible');
await clean(p, 'Tree');

head('Map view');
o = JSON.parse(await p.evaluate(`(async () => {
  document.querySelector('#mt-clear').click();
  await new Promise(r => setTimeout(r, 250));
  document.querySelector('.view-switch__btn[data-view=map]').click();
  const deadline = performance.now() + 10000;
  while (!document.querySelector('#mt-map-el canvas') && performance.now() < deadline) {
    await new Promise(r => setTimeout(r, 100));
  }
  const el = document.querySelector('#mt-map-el');
  return JSON.stringify({ container: !!el, canvas: !!el?.querySelector('canvas'),
    label: el?.getAttribute('aria-label') });
})()`));
check(o.container, 'The map container renders');
check(o.canvas, 'MapLibre renders a canvas', o.label);
await clean(p, 'Map');
await p.closeTarget();

/* ----------------------------------------------------------------- Detail -- */
head('Detail — overview and contracts');
p = await openPage(browser, APP_BASE + '/app/tenancies/MV-2026-001');
await sleep(1400);
o = JSON.parse(await p.evaluate(`JSON.stringify({
  h1: document.querySelector('h1')?.textContent.trim(),
  tabs: [...document.querySelectorAll('.tab__control')].map(x => x.textContent.trim()),
  kv: [...document.querySelectorAll('.kv dt')].map(x => x.textContent.trim()).slice(0,4),
  shortcuts: [...document.querySelectorAll('.fp-svc span')].map(x => x.textContent.trim()),
  spaceRequestLink: document.querySelector('a[href*="app/space-request"]')?.getAttribute('href'),
  inventoryLink: document.querySelector('a[href*="app/portfolio?id="]')?.getAttribute('href'),
  launchLinks: [...document.querySelectorAll('.detail-layout__aside a.fp-svc[href^="#/app/"]')]
    .map(a => ({ target: a.getAttribute('target') || '', rel: a.getAttribute('rel') || '' })),
  requestTitle: [...document.querySelectorAll('.detail-layout h2')].map(h => h.textContent.trim())
    .find(x => /Anträge/.test(x)),
  requestTable: !!document.querySelector('#tenancy-case-table table'),
})`));
check(o.h1 === 'Verwaltungszentrum Guisanplatz', 'The property name is the h1', o.h1);





check(o.tabs.length === 3 && /^Grundrisse/.test(o.tabs[1]), 'There are three tabs including floor plans', o.tabs.join(' | '));
check(o.requestTitle === 'Anträge zu diesem Mietobjekt' && o.requestTable,
  'Requests appear in the overview section', `${o.requestTitle} · table ${o.requestTable}`);
check(o.kv.includes('Verwaltungseinheit') && o.kv.includes('Geschosse'), 'The overview contains its core facts', o.kv.join(', '));
check(o.shortcuts.length >= 4, 'Service shortcuts are sourced from the service registry', String(o.shortcuts.length));
check(/building=1080%2F4850%2FAG/.test(o.spaceRequestLink || ''),
  'The space-request shortcut carries the building', o.spaceRequestLink);
check(o.launchLinks.length >= 6 && o.launchLinks.every(a =>
  a.target === '_blank' && a.rel.split(/\s+/).includes('noopener')),
  'Action-card application and case launches open new tabs', String(o.launchLinks.length));
check(/1080%2F4850%2FAG/.test(o.inventoryLink || ''), 'The detail links back to the inventory', o.inventoryLink);
await clean(p, 'Detail');

head('Header image mosaic and location map');
o = JSON.parse(await p.evaluate(`(async () => {
  for (let i = 0; i < 60 && !document.querySelector('#mt-hero-map canvas'); i++) await new Promise(r => setTimeout(r, 100));
  const m = document.querySelector('#mt-mosaic');
  return JSON.stringify({
    mosaic: !!m, classes: m?.className,
    tiles: m?.querySelectorAll('[data-gallery]').length,
    map: !!document.querySelector('#mt-hero-map canvas'),
    singleImage: !!document.querySelector('.container.section > .photo'),
  });
})()`));
check(o.mosaic && /pf-mosaic--map/.test(o.classes || ''), 'The header contains a mosaic and map', o.classes);
check(o.tiles >= 3, 'Mosaic tiles open the gallery', String(o.tiles));
check(o.map, 'The location map renders');
check(!o.singleImage, 'There is no redundant standalone hero image');

o = JSON.parse(await p.evaluate(`(async () => {
  document.querySelector('#mt-mosaic [data-gallery]').click();
  await new Promise(r => setTimeout(r, 600));
  const ov = document.querySelector('.pf-lightbox');
  const res = { overlay: !!ov, hash: location.hash };
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return JSON.stringify(res);
})()`));
check(o.overlay, 'A tile click opens the fullscreen gallery');
check(o.hash.includes('bild='), 'The legacy image query value is shareable', o.hash.split('?')[1]);
await clean(p, 'Header');

o = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/app/tenancies/MV-2026-001?tab=vertrag';
  await new Promise(r => setTimeout(r, 400));
  return JSON.stringify({ rows: document.querySelectorAll('#mt-tab-panel-contracts tbody tr').length,

    kv: document.querySelectorAll('#mt-tab-panel-contracts .kv').length,
    boxes: document.querySelectorAll('#mt-tab-panel-contracts .box').length,
    catbar: !!document.querySelector('#mt-tab-panel-contracts .catbar'),
    amount: [...document.querySelectorAll('#mt-tab-panel-contracts tbody td')].map(x => x.textContent.trim()).find(x => /CHF/.test(x)) });
})()`));
check(o.rows > 0, 'Contracts for the property are listed', String(o.rows) + ' rows');
check(o.kv === 0 && o.boxes === 0, 'The tab contains only the table (no key-value list or box)');
check(o.catbar, 'The table has catalogue controls');
check(/CHF/.test(o.amount || ''), 'The table contains currency amounts', o.amount);

/* ---------------------------------------------------------- Floor table -- */
head('Floor plans — floors as a data table');
o = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/app/tenancies/MV-2026-001?tab=grundriss';



  for (let i = 0; i < 40 && !document.querySelector('#tenancy-floor-table table'); i++) await new Promise(r => setTimeout(r, 50));
  await new Promise(r => setTimeout(r, 250));
  const host = document.querySelector('#tenancy-floor-table');
  const headers = [...host.querySelectorAll('thead th')].map(x => x.textContent.trim());
  return JSON.stringify({
    noPlan: !document.querySelector('svg.fp'),
    catbar: !!host.querySelector('.catbar'),
    rows: host.querySelectorAll('tbody tr').length,
    clickable: !!host.querySelector('table.table--rows-clickable'),
    headers,
    total: [...host.querySelectorAll('tfoot td, tfoot th')].map(x => x.textContent.trim()),
    count: host.querySelector('.catbar__count')?.textContent.replace(/\\s+/g,' ').trim(),
  });
})()`));
check(o.noPlan, 'The table appears before a floor is selected');
check(o.catbar, 'The table has shared catalogue controls');
check(o.rows === 2, 'Two rented floors appear as rows', String(o.rows));
check(o.clickable, 'Rows expose the shared clickable-row treatment');
check(o.headers.includes('Räume') && o.headers.includes('HNF') && o.headers.includes('Arbeitsplätze'), 'The expected quantity columns are present', o.headers.join(' | '));


check(/^Total \(\d+\)$/.test((o.total[0] || '').replace(/\s+/g, ' ').trim()),
  'The footer follows the inventory “Total (n)” pattern', o.total.join(' '));
check(/2 von 2 Geschosse/.test(o.count || ''), 'The table reports its result count', o.count);
await clean(p, 'Floor table');

head('Row click opens a floor plan');
o = JSON.parse(await p.evaluate(`(async () => {
  const tr = document.querySelector('#tenancy-floor-table tbody tr');
  tr.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 600));
  return JSON.stringify({ svg: !!document.querySelector('svg.fp'), hash: location.hash,
    backLink: !!document.querySelector('#floorplan-back') });
})()`));
check(o.svg, 'A row click shows the floor plan');
check(o.hash.includes('floor='), 'The floor is represented in the hash', o.hash.split('?')[1]);
check(o.backLink, 'A back link to the floor overview is available');

o = JSON.parse(await p.evaluate(`(async () => {
  document.querySelector('#floorplan-back').click();
  await new Promise(r => setTimeout(r, 500));
  return JSON.stringify({ table: !!document.querySelector('#tenancy-floor-table table'),
    svg: !!document.querySelector('svg.fp'), hash: location.hash });
})()`));
check(o.table && !o.svg, 'The back link returns to the table');
check(!o.hash.includes('floor='), 'The floor is removed from the hash', o.hash);
await clean(p, 'Back link');

/* ----------------------------------------------------------- Floor plan -- */
head('Floor plan');
await browser.send('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, p.sessionId);
o = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/app/tenancies/MV-2026-001?tab=grundriss&floor=1080-4850-AG-2og';
  await new Promise(r => setTimeout(r, 600));
  const svg = document.querySelector('svg.fp');
  const header = document.querySelector('.fp-head__top');
  const headerChildren = [...(header?.children || [])]
    .filter((node) => getComputedStyle(node).display !== 'none');
  return JSON.stringify({
    svg: !!svg,
    viewBox: svg?.getAttribute('viewBox'),
    rooms: document.querySelectorAll('.fp__room').length,
    floors: document.querySelectorAll('.fp-floors .tag-item').length,
    activeFloor: document.querySelector('.fp-floors .tag-item--active')?.textContent.trim(),
    modes: [...document.querySelectorAll('#fp-color option')].map(x => x.value),
    legend: document.querySelectorAll('.fp-legend__item').length,
    selectedMode: document.querySelector('#fp-color')?.value,
    headerFloor: document.querySelector('.fp-floors .tag-item--active')?.textContent.trim(),
    facts: document.querySelector('.fp-side .fp-facts')?.textContent.replace(/s+/g,' ').trim(),
    buttons: [document.querySelector('#floorplan-fullscreen'), document.querySelector('#floorplan-print')].map(Boolean),
    headerBackFirst: header?.firstElementChild?.classList.contains('fp-back') || false,
    headerRows: [...new Set(headerChildren.map((node) => {
      const rect = node.getBoundingClientRect();
      return Math.round(rect.top + rect.height / 2);
    }))].length,
    headerOverflow: header ? Math.round(header.scrollWidth - header.clientWidth) : -1,
    firstAriaLabel: document.querySelector('.fp__room rect')?.getAttribute('aria-label'),
  });
})()`));
check(o.svg, 'The floor plan renders as SVG without WebGL');
check(/^-40 -40 /.test(o.viewBox || ''), 'The drawing dimensions define the viewBox', o.viewBox);
check(o.rooms === 22, 'The second floor contains 22 rooms', String(o.rooms));
check(o.floors === 2, 'Two rented floors are available', o.activeFloor);
check(o.modes.join(',') === 'none,use,sia,ve,capacity', 'All five colour modes remain available', o.modes.join(','));



check(o.selectedMode === 've', 'The default compatibility mode colours by administrative unit', o.selectedMode);
check(o.legend > 0, 'The default mode shows a legend', String(o.legend));
check(o.headerFloor === '2. OG', 'The active floor appears as a header chip', o.headerFloor);
check(/Räume/.test(o.facts || '') && /HNF/.test(o.facts || ''), 'Metrics appear in the analysis column', o.facts);
check(o.buttons.every(Boolean), 'Fullscreen and print buttons are available', o.buttons.join(','));
check(o.headerBackFirst && o.headerRows === 1 && o.headerOverflow <= 1,
  'Back and viewer controls share one desktop row', `${o.headerRows} row(s) · ${o.headerOverflow}px overflow`);


const noColour = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/app/tenancies/MV-2026-001?floor=1080-4850-AG-2og&color=none';
  await new Promise(r => setTimeout(r, 600));
  return JSON.stringify({ legend: document.querySelectorAll('.fp-legend__item').length,
    selectedMode: document.querySelector('#fp-color')?.value });
})()`));
check(noColour.selectedMode === 'none' && noColour.legend === 0, 'The no-colour mode has no legend', `${noColour.selectedMode} / ${noColour.legend}`);
check(/Quadratmeter/.test(o.firstAriaLabel || ''), 'Every room has an accessible label', (o.firstAriaLabel || '').slice(0, 60));
await clean(p, 'Floor plan');

head('Colour modes');
for (const [mode, label] of [['use', 'Nutzung'], ['sia', 'SIA 416'], ['ve', 'Verwaltungseinheit'], ['capacity', 'Arbeitsplatzdichte']]) {
  const r = JSON.parse(await p.evaluate(`(async () => {
    location.hash = '#/app/tenancies/MV-2026-001?tab=grundriss&floor=1080-4850-AG-2og&color=${mode}';
    await new Promise(r => setTimeout(r, 420));
    const fills = [...document.querySelectorAll('.fp__room rect')].map(el => getComputedStyle(el).fill);
    const totals = [...document.querySelectorAll('.fp-legend__val')].map(x => x.textContent.trim());
    return JSON.stringify({ legend: document.querySelectorAll('.fp-legend__item').length,
      colors: new Set(fills).size, totals: totals.slice(0,2) });
  })()`));
  check(r.legend >= 2 && r.colors >= 2, `${label}: ${r.legend} legend entries and ${r.colors} colours`, r.totals.join(' / '));
}

head('Room selection');
o = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/app/tenancies/MV-2026-001?tab=grundriss&floor=1080-4850-AG-2og&color=use';
  await new Promise(r => setTimeout(r, 500));
  const targetRoom = [...document.querySelectorAll('.fp__room')].find(g => /buero|arbeit/.test(g.className.baseVal));
  const id = targetRoom?.dataset.space;
  targetRoom?.querySelector('rect').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 420));
  return JSON.stringify({
    id,
    panelTitle: document.querySelector('.fp-room h3')?.textContent.trim(),
    shortcuts: document.querySelectorAll('.fp-room .fp-svc').length,
    selectedCount: document.querySelectorAll('.fp__room.is-selected').length,
    hash: location.hash,
    targetHref: document.querySelector('.fp-room .fp-svc')?.getAttribute('href'),
    launchLinks: [...document.querySelectorAll('.fp-room a[href^="#/app/"]')]
      .map(a => ({ target: a.getAttribute('target') || '', rel: a.getAttribute('rel') || '' })),
  });
})()`));
check(!!o.panelTitle, 'Room details appear', o.panelTitle);
check(o.selectedCount === 1, 'The selected room is highlighted once');
check(o.shortcuts >= 3, 'Room details contain service shortcuts', String(o.shortcuts));
check(o.hash.includes('space='), 'The selection is represented in the shareable hash', o.hash.split('?')[1]);
check(/building=1080%2F4850%2FAG/.test(o.targetHref || ''), 'The service link carries the building', o.targetHref);
check(o.launchLinks.length >= 3 && o.launchLinks.every(a =>
  a.target === '_blank' && a.rel.split(/\s+/).includes('noopener')),
  'Room actions open their target applications in new tabs', String(o.launchLinks.length));
await clean(p, 'Room selection');

head('Floor change');
o = JSON.parse(await p.evaluate(`(async () => {
  const chip = [...document.querySelectorAll('.fp-floors .tag-item')].find(c => !c.classList.contains('tag-item--active'));
  const label = chip.textContent.trim();
  chip.click();
  await new Promise(r => setTimeout(r, 420));
  return JSON.stringify({ label, activeFloor: document.querySelector('.fp-floors .tag-item--active')?.textContent.trim(),
    rooms: document.querySelectorAll('.fp__room').length, hash: location.hash });
})()`));
check(o.activeFloor === o.label, 'The active floor changes', `${o.label} · ${o.rooms} rooms`);
check(o.hash.includes('floor='), 'The new floor is represented in the hash');
check(!o.hash.includes('space='), 'Changing floors clears the room selection');
await clean(p, 'Floor change');

await p.closeTarget();

head('Shortcut prefills the report');
p = await openPage(browser, APP_BASE + '/app/fault-report?building=1080%2F4850%2FAG&room=2.%20OG%2005');
await sleep(1200);
o = JSON.parse(await p.evaluate(`(async () => {

  const btn = [...document.querySelectorAll('button, a')].find(el => /anmelden/i.test(el.textContent));
  if (btn) { btn.click(); await new Promise(r => setTimeout(r, 900)); }
  const sel = document.querySelector('#bld');
  return JSON.stringify({ building: sel ? sel.value : null, location: document.querySelector('#location-detail')?.value });
})()`));
check(o.building === '1080/4850/AG', 'The building is carried over from the floor plan', o.building);
check(o.location === '2. OG 05', 'The room number is carried over as the location', o.location);
await p.closeTarget();

head('Not found');
p = await openPage(browser, APP_BASE + '/app/tenancies/GIBTESNICHT');
await sleep(900);
check(/nicht gefunden/i.test(await p.evaluate('document.querySelector("h1")?.textContent || ""')), 'An unknown ID shows a notice instead of crashing');
await clean(p, 'Not found');
await p.closeTarget();

} finally {
  browser.close();
}
console.log(fail ? `\n✗ ${fail} check(s) failed` : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
