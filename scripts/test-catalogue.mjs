// D2 catalogue triplet (C.catalogueHash / C.catalogueControls / C.wireCatalogue) —
// behaviour test for services · applications · katalog. Verifies deep-link
// round-trips (q, view, filter) and interactions (search submit, view switch,
// filter change, active-filter pill removal), plus the services multi-value
// `topic` filter. Exits non-zero on any failure.
//
//   node scripts/test-catalogue.mjs      (dev server must be running; see README)
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';
import { catalogueState } from '../js/ui/components/catalogue.js';

const CATS = [
  { name: 'services',     base: `${APP_BASE}/services`,     detail: `${APP_BASE}/services/raumbedarf-melden`,
    launch: { href: '#/app/space-request', label: 'Vorgang starten' } },
  { name: 'applications', base: `${APP_BASE}/applications`, detail: `${APP_BASE}/applications/liegenschaften-inventar`,
    launch: { href: '#/app/portfolio', label: 'Anwendung starten' } },
  { name: 'katalog',      base: `${APP_BASE}/data/catalog`, detail: `${APP_BASE}/data/catalog/1` },
];

const PROBE_DETAIL = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let n = 0;
  while (!document.querySelector('h1') && n++ < 120) await sleep(100);
  const h1 = document.querySelector('h1');
  const notFound = /nicht gefunden/i.test(h1 ? h1.textContent : '');
  return { h1: h1 ? h1.textContent.trim() : null, notFound };
})()`;

const wait = `const sleep = ms => new Promise(r => setTimeout(r, ms)); let n = 0; while (!document.querySelector('.catbar, .empty') && n++ < 120) await sleep(100);`;

const PROBE_RENDER = `(async () => {
  ${wait}
  const bar = document.querySelector('.catbar');
  const input = bar && bar.querySelector('input[type=search]');
  const checks = [...document.querySelectorAll('.catbar__panel input[data-fdim]')];   // Mehrfachauswahl-Checkboxen im Panel
  return {
    ok: !!bar, hasSearch: !!input, inputValue: input ? input.value : null,
    selectCount: checks.length,
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
  const input = document.querySelector('.catbar input[type=search]');
  input.value = ${JSON.stringify(term)};
  document.querySelector('.catbar__search').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  return location.hash;
})()`;

const probeView = (view) => `(async () => {
  ${wait}
  document.querySelector('.view-switch__btn[data-view="${view}"]').click();
  return location.hash;
})()`;

const PROBE_FILTER = `(async () => {
  ${wait}
  const cb = document.querySelector('.catbar__panel input[data-fdim]');
  if (!cb) return { ok: false, err: 'no filter checkbox' };
  cb.checked = true;
  cb.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, value: cb.value, hash: location.hash };
})()`;

// catbar sort: pick the first real option, expect ?sort=<value> in the hash.
const PROBE_SORT = `(async () => {
  ${wait}
  const sel = document.querySelector('.catbar__sort select');
  if (!sel) return { ok: false };
  const opt = [...sel.options].find(o => o.value && !o.disabled);
  if (!opt) return { ok: false };
  sel.value = opt.value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, value: opt.value, hash: location.hash };
})()`;

// services only: read the two topic-filter options so the caller can drive the
// multi-value case (?topic=a then select b → ?topic=a,b).
const PROBE_TOPIC_OPTS = `(async () => {
  ${wait}
  const cbs = [...document.querySelectorAll('.catbar__panel input[data-fdim="topic"]')];
  const vals = cbs.map(c => c.value).filter(Boolean);
  return { ok: vals.length >= 2, vals };
})()`;
const probeAddTopic = (second) => `(async () => {
  ${wait}
  const cb = document.querySelector('.catbar__panel input[data-fdim="topic"][value=' + ${JSON.stringify(JSON.stringify(second))} + ']');
  if (!cb) return 'no-checkbox';
  cb.checked = true;
  cb.dispatchEvent(new Event('change', { bubbles: true }));
  return location.hash;
})()`;

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };
const dec = (h) => decodeURIComponent(h);

(async () => {
  console.log('\n■ catalogueState query whitespace');
  const query = new URLSearchParams('q=%20Raum%2520A%20');
  const preserved = catalogueState(query, { base: '#/services', trimQuery: false });
  const trimmed = catalogueState(query, { base: '#/search' });
  check(preserved.q === ' Raum%20A ', 'opt-out preserves surrounding query whitespace');
  check(trimmed.q === 'Raum%20A', 'default trims surrounding query whitespace');
  check(new URLSearchParams(preserved.hash().split('?')[1]).get('q') === ' Raum%20A ',
    'query is decoded and encoded exactly once');

  const cdp = await launch();
  try {
    for (const cat of CATS) {
      console.log(`\n■ ${cat.name}`);

      // 1. base render
      let p = await openPage(cdp, cat.base);
      const base = await p.evaluate(PROBE_RENDER);
      check(base.ok && base.hasSearch, 'renders search form');
      check(base.selectCount >= 1, `has ${base.selectCount} filter checkbox(es)`);
      check(base.viewBtns.length === 2, 'has galerie/liste view switch');
      check(base.cards > 0, `renders ${base.cards} result cards`);
      check((await p.problems()).length === 0, `no exceptions / console errors / error banner${(await p.problems())[0] ? ": " + (await p.problems())[0] : ""}`);
      await p.closeTarget();

      // 2. search deep-link: ?q=zzz → input round-trips, 0 results, empty state
      p = await openPage(cdp, `${cat.base}?q=zzzznomatch`);
      const q = await p.evaluate(PROBE_RENDER);
      check(q.inputValue === 'zzzznomatch', 'q deep-link fills the search box');
      check(q.cards === 0 && q.hasEmpty, 'q with no match → 0 cards + empty state');
      await p.closeTarget();

      // 3. view deep-link: ?view=list → table, liste pressed, no grid cards
      p = await openPage(cdp, `${cat.base}?view=list`);
      const lv = await p.evaluate(PROBE_RENDER);
      check(lv.tableRows > 0, `view=list renders a table (${lv.tableRows} rows)`);
      check(lv.viewBtns.find(b => b.view === 'list')?.pressed === 'true', 'liste button aria-pressed=true');
      await p.closeTarget();

      // 4. submit interaction → hash gets ?q=
      p = await openPage(cdp, cat.base);
      const hSubmit = await p.evaluate(probeSubmit('buch'));
      check(/[?&]q=buch/.test(hSubmit), `search submit → ${hSubmit.replace(APP_BASE, '#')}`);
      await p.closeTarget();

      // 5. view-switch interaction → hash gets view=list
      p = await openPage(cdp, cat.base);
      const hView = await p.evaluate(probeView('list'));
      check(/[?&]view=list/.test(hView), `view switch → ${hView.replace(APP_BASE, '#')}`);
      await p.closeTarget();

      // 5b. catbar sort interaction → hash gets ?sort=<value>
      p = await openPage(cdp, cat.base);
      const so = await p.evaluate(PROBE_SORT);
      check(so.ok && dec(so.hash).includes('sort=' + so.value), `sort change → hash carries "sort=${so.ok ? so.value : '?'}"`);
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
      if (cat.launch) {
        const launch = await p.evaluate(`(() => {
          const href = ${JSON.stringify(cat.launch.href)};
          return [...document.querySelectorAll('a')]
            .filter((a) => a.getAttribute('href') === href)
            .map((a) => ({
              label: (a.querySelector('.btn__text, .download-item__title') || a).textContent.trim(),
              target: a.getAttribute('target') || '',
              rel: a.getAttribute('rel') || '',
            }));
        })()`);
        check(launch.length >= 2
          && launch.every((item) => item.label === cat.launch.label
            && item.target === '_blank' && item.rel.split(/\s+/).includes('noopener')),
        `${cat.launch.label} opens every launch target in a new tab (${launch.length} links)`);
      }
      check((await p.problems()).length === 0, `no exceptions / console errors / error banner${(await p.problems())[0] ? ": " + (await p.problems())[0] : ""}`);
      await p.closeTarget();
    }

    /* Dataset «Datenfelder» tab. A field list runs to 75 rows, so it is a
       C.mountDataTable with search, sorting, paging and export — not a plain
       table. The empty case is the common one and keeps its column head. */
    console.log('\n■ Datenfelder tab');
    const fields = await openPage(cdp, `${APP_BASE}/data/catalog/11?tab=fields`, { login: true });
    await new Promise((r) => setTimeout(r, 2000));
    const ft = await fields.evaluate(`(async () => {
      const w = (ms) => new Promise((r) => setTimeout(r, ms));
      const panel = document.querySelector('[data-panel="fields"]');
      // Read the unfiltered state FIRST: a search down to two hits leaves one
      // page, and pagination correctly removes itself.
      const before = panel.querySelectorAll('tbody tr').length;
      const paginated = !!panel.querySelector('.pagination');
      const input = panel.querySelector('input[type=search]');
      input.value = 'Buchungskreis';
      panel.querySelector('form.catbar__search').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await w(350);
      return {
        perPage: before,
        paginated,
        sorts: [...panel.querySelectorAll('.catbar__sort option')].length,
        exports: [...panel.querySelectorAll('.action-menu__item')].map((b) => b.dataset.action),
        afterSearch: panel.querySelectorAll('tbody tr').length,
        // The bar drops pagination once the result fits on one page.
        paginationGoneAfterSearch: !panel.querySelector('.pagination'),
        count: panel.querySelector('.catbar__count')?.textContent.replace(/\\s+/g, ' ').trim(),
        // The tab owns no heading of its own (user decision, 2026-08-12).
        headings: panel.querySelectorAll('.detail-section__title, p.muted').length,
      };
    })()`);
    check(ft.perPage === 20, `field table pages at 20 rows (${ft.perPage})`);
    check(ft.paginated, 'field table is paginated at 75 fields');
    check(ft.paginationGoneAfterSearch, 'pagination disappears once one page is enough');
    check(ft.sorts === 5, `four sort options plus the placeholder (${ft.sorts})`);
    check(ft.exports.join(',') === 'csv,xls', `export menu offers CSV and Excel (${ft.exports.join(',')})`);
    check(ft.afterSearch === 2 && /^2 von 75/.test(ft.count), `search narrows the field list (${ft.count})`);
    check(ft.headings === 0, 'no section title or muted subtitle above the table');
    check((await fields.problems()).length === 0, 'Datenfelder: no console errors');
    await fields.closeTarget();

    const bare = await openPage(cdp, `${APP_BASE}/data/catalog/3?tab=fields`, { login: true });
    await new Promise((r) => setTimeout(r, 1500));
    const bt = await bare.evaluate(`(() => {
      const panel = document.querySelector('[data-panel="fields"]');
      return {
        bar: !!panel.querySelector('.catbar'),
        cols: [...panel.querySelectorAll('thead th')].map((x) => x.textContent.trim()).join(','),
        hint: (panel.querySelector('.table__empty')?.textContent || '').includes('keine Felddefinitionen'),
      };
    })()`);
    check(!bt.bar, 'a dataset without fields shows no search bar');
    check(bt.cols === 'Feld,Beschreibung,Format,Constraint,Kommentar', `empty state keeps its columns (${bt.cols})`);
    check(bt.hint, 'empty state names the gap');
    await bare.closeTarget();

    /* Dataset detail aside (user decision, 2026-08-12): the page took the
       service/application anatomy — main column plus «Zugriff» and «Kontakt» —
       instead of carrying data-governance roles in its flow. «Daten beziehen»
       scrolls to the distributions; in a hash-routed app that MUST NOT navigate. */
    console.log('\n■ Dataset detail aside');
    const ds = await openPage(cdp, `${APP_BASE}/data/catalog/7`, { login: true });
    await new Promise((r) => setTimeout(r, 1800));
    const aside = await ds.evaluate(`(async () => {
      const w = (ms) => new Promise((r) => setTimeout(r, ms));
      const side = document.querySelector('aside.container__aside');
      const labels = [...document.querySelectorAll('.container__main dl.kv dt')].map((x) => x.textContent.trim());
      const link = side?.querySelector('.access-card a[href="#ds-distributions"]');
      const hashBefore = location.hash;
      const yBefore = scrollY;
      link?.click();
      await w(800);
      return {
        grid: !!document.querySelector('.container--grid > .container__main'),
        card: !!side?.querySelector('.box.access-card'),
        label: link?.textContent.trim(),
        bookmark: !!side?.querySelector('.access-card .bookmark-link, .access-card [data-bookmark]'),
        contact: !!side?.querySelector('.box:not(.access-card)'),
        firstMeta: labels[0],
        hasKontaktstelle: labels.includes('Kontaktstelle'),
        governanceSection: [...document.querySelectorAll('.detail-section__title')].some((x) => /Verantwortliche/.test(x.textContent)),
        routeHeld: location.hash === hashBefore,
        scrolled: scrollY - yBefore > 100,
      };
    })()`);
    check(aside.grid && aside.card && aside.contact, 'main column plus access and contact cards');
    check(aside.label === 'Daten beziehen', `access button label (${aside.label})`);
    check(aside.bookmark, 'the favourite action sits in the access card');
    check(aside.firstMeta === 'ID' && !aside.hasKontaktstelle, `Metadaten leads with ID, without Kontaktstelle (${aside.firstMeta})`);
    check(!aside.governanceSection, 'no «Verantwortliche Personen» section');
    check(aside.routeHeld && aside.scrolled, 'the jump scrolls without changing the route');
    check((await ds.problems()).length === 0, 'dataset detail: no console errors');
    await ds.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
