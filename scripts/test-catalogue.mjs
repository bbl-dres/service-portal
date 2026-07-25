// D2 catalogue triplet (C.catalogueHash / C.catalogueControls / C.wireCatalogue) —
// behaviour test for services · applications · katalog. Verifies deep-link
// round-trips (q, view, filter) and interactions (search submit, view switch,
// filter change, active-filter pill removal), plus the services multi-value
// `topic` filter. Exits non-zero on any failure.
//
//   node scripts/test-catalogue.mjs      (dev server must be running; see README)
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

const CATS = [
  { name: 'services',     base: `${APP_BASE}/services`,     detail: `${APP_BASE}/services/raumbedarf-melden` },
  { name: 'applications', base: `${APP_BASE}/applications`, detail: `${APP_BASE}/applications/liegenschaften-inventar` },
  { name: 'katalog',      base: `${APP_BASE}/data/katalog`, detail: `${APP_BASE}/data/katalog/1` },
];

const PROBE_DETAIL = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let n = 0;
  while (!document.querySelector('h1') && n++ < 120) await sleep(100);
  const h1 = document.querySelector('h1');
  const notFound = /nicht gefunden/i.test(h1 ? h1.textContent : '');
  return { h1: h1 ? h1.textContent.trim() : null, notFound };
})()`;

const wait = `const sleep = ms => new Promise(r => setTimeout(r, ms)); let n = 0; while (!document.querySelector('.service-controls, .empty') && n++ < 120) await sleep(100);`;

const PROBE_RENDER = `(async () => {
  ${wait}
  const form = document.querySelector('.service-controls');
  const input = form && form.querySelector('input[type=search]');
  const selects = form ? [...form.querySelectorAll('select')] : [];
  return {
    ok: !!form, hasSearch: !!input, inputValue: input ? input.value : null,
    selectCount: selects.length,
    viewBtns: [...document.querySelectorAll('.view-switch__btn')].map(b => ({ view: b.dataset.view, pressed: b.getAttribute('aria-pressed') })),
    cards: document.querySelectorAll('.card').length,
    tableRows: document.querySelectorAll('table tbody tr').length,
    pills: [...document.querySelectorAll('.active-filter')].map(a => ({ label: a.textContent.trim(), href: a.getAttribute('href') })),
    hasEmpty: !!document.querySelector('.empty'),
    hash: location.hash,
  };
})()`;

const probeSubmit = (term) => `(async () => {
  ${wait}
  const input = document.querySelector('.service-controls input[type=search]');
  input.value = ${JSON.stringify(term)};
  document.querySelector('.service-controls').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  return location.hash;
})()`;

const probeView = (view) => `(async () => {
  ${wait}
  document.querySelector('.view-switch__btn[data-view="${view}"]').click();
  return location.hash;
})()`;

const PROBE_FILTER = `(async () => {
  ${wait}
  const sel = document.querySelector('.service-controls select');
  if (!sel) return { ok: false, err: 'no filter select' };
  const opt = [...sel.options].find(o => o.value);
  if (!opt) return { ok: false, err: 'no non-empty option' };
  sel.value = opt.value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, value: opt.value, hash: location.hash };
})()`;

// services only: read the two topic-filter options so the caller can drive the
// multi-value case (?topic=a then select b → ?topic=a,b).
const PROBE_TOPIC_OPTS = `(async () => {
  ${wait}
  const sel = document.querySelector('#topic-filter');
  if (!sel) return { ok: false };
  const vals = [...sel.options].map(o => o.value).filter(Boolean);
  return { ok: vals.length >= 2, vals };
})()`;
const probeAddTopic = (second) => `(async () => {
  ${wait}
  const sel = document.querySelector('#topic-filter');
  sel.value = ${JSON.stringify(second)};
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return location.hash;
})()`;

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };
const dec = (h) => decodeURIComponent(h);

(async () => {
  const cdp = await launch({ port: 9335 });
  try {
    for (const cat of CATS) {
      console.log(`\n■ ${cat.name}`);

      // 1. base render
      let p = await openPage(cdp, cat.base);
      const base = await p.evaluate(PROBE_RENDER);
      check(base.ok && base.hasSearch, 'renders search form');
      check(base.selectCount >= 1, `has ${base.selectCount} filter select(s)`);
      check(base.viewBtns.length === 2, 'has galerie/liste view switch');
      check(base.cards > 0, `renders ${base.cards} result cards`);
      check(p.exceptions.length === 0, `no exceptions${p.exceptions.length ? ' — ' + p.exceptions[0].split('\\n')[0] : ''}`);
      await p.closeTarget();

      // 2. search deep-link: ?q=zzz → input round-trips, 0 results, empty state
      p = await openPage(cdp, `${cat.base}?q=zzzznomatch`);
      const q = await p.evaluate(PROBE_RENDER);
      check(q.inputValue === 'zzzznomatch', 'q deep-link fills the search box');
      check(q.cards === 0 && q.hasEmpty, 'q with no match → 0 cards + empty state');
      await p.closeTarget();

      // 3. view deep-link: ?view=liste → table, liste pressed, no grid cards
      p = await openPage(cdp, `${cat.base}?view=liste`);
      const lv = await p.evaluate(PROBE_RENDER);
      check(lv.tableRows > 0, `view=liste renders a table (${lv.tableRows} rows)`);
      check(lv.viewBtns.find(b => b.view === 'liste')?.pressed === 'true', 'liste button aria-pressed=true');
      await p.closeTarget();

      // 4. submit interaction → hash gets ?q=
      p = await openPage(cdp, cat.base);
      const hSubmit = await p.evaluate(probeSubmit('buch'));
      check(/[?&]q=buch/.test(hSubmit), `search submit → ${hSubmit.replace(APP_BASE, '#')}`);
      await p.closeTarget();

      // 5. view-switch interaction → hash gets view=liste
      p = await openPage(cdp, cat.base);
      const hView = await p.evaluate(probeView('liste'));
      check(/[?&]view=liste/.test(hView), `view switch → ${hView.replace(APP_BASE, '#')}`);
      await p.closeTarget();

      // 6. filter change → hash carries the chosen value
      p = await openPage(cdp, cat.base);
      const f = await p.evaluate(PROBE_FILTER);
      check(f.ok && dec(f.hash).includes(f.value), `filter change → hash carries "${f.value}"`);
      await p.closeTarget();

      // 7. active-filter pill removal: load the filtered hash, pill href drops the value
      if (f.ok) {
        p = await openPage(cdp, f.hash.startsWith('#') ? `${APP_BASE.replace(/#$/, '')}${f.hash}` : f.hash);
        const filtered = await p.evaluate(PROBE_RENDER);
        check(filtered.pills.length >= 1, `filtered view shows ${filtered.pills.length} active-filter pill(s)`);
        check(filtered.pills.some(pill => !dec(pill.href).includes(f.value)), 'a pill href removes the active value');
        await p.closeTarget();
      }

      // 8. services only: multi-value topic (?topic=a then add b → a,b)
      if (cat.name === 'services') {
        p = await openPage(cdp, cat.base);
        const opts = await p.evaluate(PROBE_TOPIC_OPTS);
        await p.closeTarget();
        if (opts.ok) {
          const [a, b] = opts.vals;
          p = await openPage(cdp, `${cat.base}?topic=${encodeURIComponent(a)}`);
          const hMulti = await p.evaluate(probeAddTopic(b));
          check(dec(hMulti).includes(`topic=${a},${b}`), `multi-topic → ${dec(hMulti).replace(APP_BASE, '#')}`);
          await p.closeTarget();
        } else {
          check(false, 'topic filter has ≥2 options');
        }
      }

      // 9. detail view renders (katalog's tagPills use C.catalogueHash)
      p = await openPage(cdp, cat.detail);
      const det = await p.evaluate(PROBE_DETAIL);
      check(det.h1 && !det.notFound, `detail renders ("${det.h1}")`);
      check(p.exceptions.length === 0, `detail: no exceptions${p.exceptions.length ? ' — ' + p.exceptions[0].split('\\n')[0] : ''}`);
      await p.closeTarget();
    }
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
