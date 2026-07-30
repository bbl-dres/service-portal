// D1 tab component (C.tabBar / C.tabPanels / C.wireTabs) — behaviour test.
// Drives every tab view in a headless browser and asserts: panel toggling,
// aria-selected, roving tabindex, focus-follows-active, keyboard nav
// (Arrow/Home/End), hash sync (?tab= only for non-default), and the workspace
// "Buchung" login gate. Also checks the logged-out gate on the two direct-URL
// wizards (regression guard for A16). Exits non-zero on any failure.
//
//   node scripts/test-tabs.mjs      (dev server must be running; see README)
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

// Each view: the tab ids in DOM order, whether it mirrors the active tab into the
// hash (?tab=), and — where relevant — a tab whose panel is a login gate.
const VIEWS = [
  { name: 'portfolio (Bundeshaus West)', url: `${APP_BASE}/app/portfolio?id=${encodeURIComponent('1080/4840/AF')}`, tabs: ['uebersicht', 'flaechen', 'ausstattung', 'vertraege', 'kosten', 'dokumente', 'kontakte'], hashSync: false },
  { name: 'projects (PRJ-01)',         url: `${APP_BASE}/app/projects/PRJ-01`,       tabs: ['uebersicht', 'kennzahlen', 'risiken'],             hashSync: true },
  { name: 'workspace [logged out]',    url: `${APP_BASE}/app/workspace`,             tabs: ['moeblierung', 'belegung', 'buchung'],              hashSync: false, gateTab: 'buchung' },
  { name: 'dataportal (energie-klima)', url: `${APP_BASE}/app/dataportal/energie-klima`, tabs: ['ueberblick', 'energiepfad'],                     hashSync: true },
];
const GATES = [
  { name: 'space-request [logged out]', url: `${APP_BASE}/app/space-request` },
  { name: 'fault-report [logged out]',  url: `${APP_BASE}/app/fault-report` },
];

// In-page probe: click every tab in order, then exercise the keyboard from tab 0.
const PROBE_TABS = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let n = 0;
  while (!document.querySelector('.tab__control') && n++ < 120) await sleep(100);
  const btns = [...document.querySelectorAll('.tab__control')];
  if (!btns.length) return { ok: false, err: 'no .tab__control rendered' };
  const activeTab = () => (document.querySelector('.tab__control--active') || {}).dataset?.tab ?? null;
  const R = { ok: true, ids: btns.map(b => b.dataset.tab), steps: [], kbd: [] };
  for (const b of btns) {
    b.click();
    await sleep(60);
    const cur = [...document.querySelectorAll('.tab__control')].find(x => x.dataset.tab === b.dataset.tab);
    R.steps.push({
      clicked: b.dataset.tab,
      active: activeTab(),
      selTrue: cur && cur.getAttribute('aria-selected'),
      tabindexActive: cur && cur.getAttribute('tabindex'),
      othersTabindex: [...document.querySelectorAll('.tab__control')].filter(x => x !== cur).map(x => x.getAttribute('tabindex')),
      visiblePanels: [...document.querySelectorAll('[role=tabpanel]')].filter(p => !p.hidden).map(p => p.id),
      focusTab: document.activeElement?.dataset?.tab ?? null,
      gateInPanel: !!document.querySelector('[role=tabpanel] .login-gate__btn'),
      hash: location.hash,
    });
  }
  const fresh = [...document.querySelectorAll('.tab__control')];
  fresh[0].focus();
  const press = key => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  for (const key of ['ArrowRight', 'End', 'Home']) {
    press(key); await sleep(50);
    R.kbd.push({ key, focus: document.activeElement?.dataset?.tab ?? null, active: activeTab() });
  }
  return R;
})()`;

const PROBE_GATE = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let n = 0;
  while (!document.querySelector('.login-gate__btn, .tab__control') && n++ < 120) await sleep(100);
  return { hasGate: !!document.querySelector('.login-gate__btn'), h1: (document.querySelector('h1') || {}).textContent || null };
})()`;

let failures = 0;
const check = (cond, label) => {
  console.log(`   ${cond ? '✓' : '✗'} ${label}`);
  if (!cond) failures++;
};

(async () => {
  const cdp = await launch({ webgl: true });
  try {
    for (const v of VIEWS) {
      console.log(`\n■ ${v.name}`);
      const page = await openPage(cdp, v.url);
      const r = await page.evaluate(PROBE_TABS);
      if (!r || !r.ok) { check(false, `renders tabs (${r && r.err || 'no result'})`); await page.closeTarget(); continue; }

      check(JSON.stringify(r.ids) === JSON.stringify(v.tabs), `tab ids = ${JSON.stringify(v.tabs)}`);
      r.steps.forEach((s, i) => {
        const tab = v.tabs[i];
        check(s.clicked === tab && s.active === tab, `click "${tab}" activates it`);
        check(s.selTrue === 'true', `  aria-selected=true on "${tab}"`);
        check(s.tabindexActive === '0' && s.othersTabindex.every(t => t === '-1'), `  roving tabindex (active 0, others -1)`);
        check(s.focusTab === tab, `  focus moves to "${tab}"`);
        check(s.visiblePanels.length === 1, `  exactly one panel visible`);
        if (v.hashSync) check(i === 0 ? !/\?tab=/.test(s.hash) : s.hash.includes(`?tab=${tab}`), `  hash ${i === 0 ? 'clean on default' : '= ?tab=' + tab}`);
        else check(!/\?tab=/.test(s.hash), `  hash unchanged (no ?tab=)`);
        if (v.gateTab === tab) check(s.gateInPanel === true, `  "${tab}" panel shows login gate`);
      });
      check(r.kbd[0].focus === v.tabs[1] && r.kbd[0].active === v.tabs[1], `ArrowRight → "${v.tabs[1]}"`);
      const last = v.tabs[v.tabs.length - 1];
      check(r.kbd[1].focus === last && r.kbd[1].active === last, `End → "${last}"`);
      check(r.kbd[2].focus === v.tabs[0] && r.kbd[2].active === v.tabs[0], `Home → "${v.tabs[0]}"`);
      check((await page.problems()).length === 0, `no exceptions / console errors / error banner${(await page.problems())[0] ? ': ' + (await page.problems())[0] : ''}`);
      check(page.consoleErrors.length === 0, `no console errors${page.consoleErrors.length ? ' — ' + page.consoleErrors[0] : ''}`);
      await page.closeTarget();
    }

    for (const g of GATES) {
      console.log(`\n■ ${g.name}`);
      const page = await openPage(cdp, g.url);
      const r = await page.evaluate(PROBE_GATE);
      check(r.hasGate === true, `shows login gate (h1: "${r.h1}")`);
      check((await page.problems()).length === 0, `no exceptions / console errors / error banner${(await page.problems())[0] ? ': ' + (await page.problems())[0] : ''}`);
      await page.closeTarget();
    }
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
