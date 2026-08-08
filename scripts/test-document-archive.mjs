// Construction-document archive integration suite.
import { readFileSync } from 'node:fs';
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let failures = 0;
const check = (ok, label) => { console.log(`   ${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };

const documents = JSON.parse(readFileSync(new URL('../data/documents.json', import.meta.url), 'utf8'));
const kbobTypes = new Map([
  ['O08001', 'Dokumentenverzeichnis'],
  ['V07102', 'Grundrissplan'],
  ['B11305', 'Wartungs- und Instandhaltungskonzept'],
  ['B11124', 'Energiekonzept'],
  ['B05050', 'Machbarkeitsstudie'],
  ['B17018', 'Sicherheitsbericht'],
  ['B06006', 'Denkmalpflegerisches Gutachten'],
]);
check(documents.every(doc => kbobTypes.get(doc.typeCode) === doc.type),
  `all ${documents.length} records use an approved KBOB code/name pair`);

const TABLE_PROBE = `(() => {
  const table = document.querySelector('table');
  const rows = [...document.querySelectorAll('tbody tr')];
  return {
    h1: document.querySelector('h1')?.textContent.trim() || '',
    headers: [...(table?.querySelectorAll('thead th') || [])].map(el => el.textContent.trim()),
    rowCount: rows.length,
    rowIcons: table?.querySelectorAll('tbody .icon').length || 0,
    previewHeader: [...(table?.querySelectorAll('thead th') || [])].some(el => /Vorschau/i.test(el.textContent)),
    filenames: rows.map(row => row.querySelector('.doc-open')?.textContent.trim() || ''),
    types: rows.map(row => row.cells[1]?.textContent.trim() || ''),
    buildingLinks: table?.querySelectorAll('tbody td:nth-child(3) a').length || 0,
    overflow: document.documentElement.scrollWidth - innerWidth,
  };
})()`;

const OPEN_VIEWER = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  document.querySelector('.doc-open')?.click();
  await wait(120);
  const button = document.querySelector('.docviewer [data-act="meta"]');
  const before = button?.getAttribute('aria-expanded');
  button?.click();
  await wait(80);
  const panel = document.querySelector('#docviewer-meta');
  const bar = document.querySelector('.docviewer__bar');
  const viewer = document.querySelector('.docviewer');
  return {
    shown: !!viewer,
    title: document.querySelector('.docviewer__title')?.textContent.trim() || '',
    hasMetaButton: !!button,
    before,
    expanded: button?.getAttribute('aria-expanded'),
    panelVisible: !!panel && !panel.hidden,
    panelText: panel?.textContent.replace(/\\s+/g, ' ').trim() || '',
    buildingHref: panel?.querySelector('[data-act="building"]')?.getAttribute('href') || '',
    bodyOverflow: document.querySelector('.docviewer__body')?.scrollWidth - document.querySelector('.docviewer__body')?.clientWidth || 0,
    barOverflow: bar ? bar.scrollWidth - bar.clientWidth : 0,
    viewportGap: viewer ? Math.round(innerWidth - viewer.getBoundingClientRect().right) : -1,
  };
})()`;

const cdp = await launch();
try {
  for (const width of [1440, 390]) {
    console.log(`\n■ Bauwerksdokumentation (${width}px)`);
    const page = await openPage(cdp, `${APP_BASE}/app/document-archive`);
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    await sleep(1100);

    const table = await page.evaluate(TABLE_PROBE);
    check(table.h1 === 'Bauwerksdokumentation', `renders the archive (h1: "${table.h1}")`);
    check(JSON.stringify(table.headers) === JSON.stringify(['Dokument', 'KBOB-Typ', 'Gebäude', 'Jahr', 'Grösse', 'Klassifizierung']),
      `uses the six intended columns (${table.headers.join(', ')})`);
    check(table.rowCount > 0 && table.rowIcons === 0, `table rows contain no icons (${table.rowCount} rows)`);
    check(!table.previewHeader, 'removes the redundant Vorschau column');
    check(table.filenames.every(name => /\.pdf$/i.test(name)), 'all visible document names include .pdf');
    check(table.types.every(type => /^[A-Z]\d{5} · .+/.test(type)), 'all visible types use KBOB code and label');
    check(table.buildingLinks === 0, 'building cells are plain text');
    check(table.overflow <= 1, `page has no horizontal overflow (${table.overflow}px)`);

    const viewer = await page.evaluate(OPEN_VIEWER);
    check(viewer.shown && /\.pdf$/i.test(viewer.title), `opens the document viewer with a filename ("${viewer.title}")`);
    check(viewer.hasMetaButton && viewer.before === 'false' && viewer.expanded === 'true', 'metadata button exposes its state');
    check(viewer.panelVisible && /KBOB-Typ/.test(viewer.panelText) && /Gebäude/.test(viewer.panelText), 'metadata panel shows document and building context');
    check(/^#\/app\/portfolio\?id=/.test(viewer.buildingHref), `metadata panel links to the building (${viewer.buildingHref})`);
    check(viewer.bodyOverflow <= 1, `viewer body is contained (${viewer.bodyOverflow}px)`);
    check(viewer.barOverflow <= 1, `viewer header is contained (${viewer.barOverflow}px)`);
    check(Math.abs(viewer.viewportGap) <= 1, `viewer reaches the viewport edge (${viewer.viewportGap}px gap)`);

    if (width === 1440) {
      await page.evaluate(`document.querySelector('#docviewer-meta [data-act="building"]')?.click()`);
      await sleep(350);
      const destination = await page.evaluate('location.hash');
      check(/^#\/app\/portfolio\?id=/.test(destination), `building action navigates to the object (${destination})`);
    }

    const problems = await page.problems();
    check(problems.length === 0, `no exceptions / console errors / error banner${problems[0] ? ': ' + problems[0] : ''}`);
    await page.closeTarget();
  }
} finally {
  cdp.close();
}

console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
