// Checks the individual defects formerly listed in docs/code-review.md section 1.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let fail = 0;
const ok = (c, label, detail = '') => { if (!c) fail++; console.log(`${c ? '✓' : '✗'} ${label}${detail ? '  (' + detail + ')' : ''}`); };

const b = await launch({ webgl: true });

// Section 1.1: reset in the data catalogue.
let p = await openPage(b, APP_BASE + '/data/catalog?classification=internal&topic=Bauwerke');
await sleep(1600);
let r = JSON.parse(await p.evaluate(`(() => {
  const a = [...document.querySelectorAll('#ds-filters a')].find(x => /zurücksetzen/i.test(x.textContent));
  return JSON.stringify({ href: a?.getAttribute('href') });
})()`));
ok(!/classification/.test(r.href || ''), 'section 1.1 reset clears classification', r.href);
await p.closeTarget();

// Section 1.2: empty state during data failure.
p = await openPage(b, APP_BASE + '/news');
await sleep(1200);
r = await p.evaluate(`(() => {
  // Failure simulation is covered directly against the component below.
  return 'ok';
})()`);
// A live portal cannot force this failure, so inspect the component directly.
const emptyHtml = await p.evaluate(`(async () => {
  const m = await import('./js/components.js');
  return m.empty('Test', { available: false });
})()`);
ok(/empty--unavailable/.test(emptyHtml || ''), 'section 1.2 empty({available:false}) uses unavailable state', String(emptyHtml).slice(0, 60));
const emptyAlt = await p.evaluate(`(async () => {
  const m = await import('./js/components.js');
  return m.empty('Test', { unavailable: true });
})()`);
ok(/empty--unavailable/.test(emptyAlt || ''), 'section 1.2 unavailable compatibility option still works');
await p.closeTarget();

// Section 1.3: inventory filter panel.
p = await openPage(b, APP_BASE + '/app/portfolio');
await sleep(2200);
r = JSON.parse(await p.evaluate(`(async () => {
  document.querySelector('#pf-filter-btn')?.click();
  await new Promise(x => setTimeout(x, 300));
  const cb = [...document.querySelectorAll('[data-fdim=kind]')];
  return JSON.stringify({
    n: cb.length,
    buildingChecked: cb.find(x => x.value === 'building')?.checked,
    hasIds: cb.every(x => !!x.id),
  });
})()`));
ok(r.buildingChecked === true, 'section 1.3 German building option matches state', `n=${r.n}`);
ok(r.hasIds === true, 'section 1.3 checkboxes have IDs for preserveFocus');
await p.closeTarget();

// Section 1.5: floor-plan hero focus ring.
p = await openPage(b, APP_BASE + '/app/tenancies/MV-2026-001?tab=grundriss&floor=1080-4850-AG-2og');
await sleep(1800);
r = await p.evaluate(`(() => {
  const s = [...document.styleSheets].flatMap(ss => { try { return [...ss.cssRules]; } catch { return []; } })
    .find(x => x.selectorText === '.pj-hero__btn:focus-visible');
  return s ? s.style.outline : 'no rule';
})()`);
ok(/--color-focus-ring/.test(r || ''), 'section 1.5 focus ring uses --color-focus-ring', r);
await p.closeTarget();

await b.close();
console.log(fail ? `\n${fail} unresolved` : '\nall checked items passed');
process.exit(fail ? 1 : 0);
