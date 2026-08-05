// Workspace Management regression: standalone planning surface, live scenario,
// floor-plan interaction, and mobile containment.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let failures = 0;
const check = (condition, label) => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures++;
};

const PROBE = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let tries = 0;
  while (!document.querySelector('#workspace-floorplan .fp__room') && tries++ < 120) await wait(100);
  const headings = [...document.querySelectorAll('#main-content h1,#main-content h2,#main-content h3')];
  const jumps = [];
  headings.reduce((previous, heading) => {
    const level = Number(heading.tagName[1]);
    if (previous && level > previous + 1) jumps.push(previous + '>' + level);
    return level;
  }, 0);
  return {
    h1: document.querySelector('h1')?.textContent.trim() || '',
    tabs: document.querySelectorAll('.tab__control').length,
    buildings: document.querySelector('#workspace-building')?.options.length || 0,
    floors: document.querySelectorAll('.fp-floors .tag-item').length,
    rooms: document.querySelectorAll('#workspace-floorplan .fp__room').length,
    stats: [...document.querySelectorAll('.workspace-stats .stat__num')].map(node => node.textContent.trim()),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    headingJumps: jumps,
    unlabeledControls: [...document.querySelectorAll('#main-content input,#main-content select')]
      .filter(control => !control.labels?.length && !control.getAttribute('aria-label')).length,
  };
})()`;

const INTERACT = `(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const people = document.querySelector('#workspace-people');
  people.value = '9999';
  people.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(80);
  const result = document.querySelector('#workspace-result')?.textContent.replace(/\\s+/g, ' ').trim() || '';
  document.querySelector('#workspace-floorplan .fp__room rect')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(80);
  const room = document.querySelector('#workspace-room')?.textContent.replace(/\\s+/g, ' ').trim() || '';
  return { result, room, selected: document.querySelectorAll('#workspace-floorplan .fp__room.is-selected').length };
})()`;

const cdp = await launch();
try {
  for (const width of [1440, 320]) {
    console.log(`\n■ Workspace Management (${width}px)`);
    const page = await openPage(cdp, `${APP_BASE}/app/workspace?building=${encodeURIComponent('1080/6650/AA')}`);
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    await sleep(900);
    const result = await page.evaluate(PROBE);
    check(result.h1 === 'Workspace Management', `renders the standalone app (h1: "${result.h1}")`);
    check(result.tabs === 0, 'contains no legacy tabs');
    check(result.buildings > 1 && result.floors > 1, `offers building and floor selection (${result.buildings}/${result.floors})`);
    check(result.rooms > 0, `renders an interactive floor plan (${result.rooms} rooms)`);
    check(result.stats.every(Boolean), `renders planning KPIs (${result.stats.join(', ')})`);
    check(result.overflow <= 1, `document has no horizontal overflow (${result.overflow}px)`);
    check(result.headingJumps.length === 0, `heading hierarchy is unbroken (${result.headingJumps.join(', ') || 'ok'})`);
    check(result.unlabeledControls === 0, 'all form controls have accessible labels');

    if (width === 1440) {
      const interaction = await page.evaluate(INTERACT);
      check(/fehlen/.test(interaction.result), `live scenario reports a capacity shortfall ("${interaction.result.slice(0, 100)}")`);
      check(interaction.selected === 1 && !/Wählen Sie/.test(interaction.room), `room selection opens its planning details (selected ${interaction.selected}, "${interaction.room.slice(0, 80)}")`);
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
