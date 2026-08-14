// Property-inventory integration suite for the spatial catalogue and details.
import { writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };



const geo = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8')).features;
const BUILDINGS = geo('buildings.geojson');
const PARCELS = geo('parcels.geojson');
const TOTAL = BUILDINGS.length + PARCELS.length;
const CH = [...BUILDINGS, ...PARCELS].filter((f) => f.properties['adr_land'] === 'CH').length;
const CH_BUILDINGS = BUILDINGS.filter((f) => f.properties['adr_land'] === 'CH').length;
const COUNTRY_COUNT = new Set(BUILDINGS.map((f) => f.properties['adr_land'])).size;
const BUILDING_COUNT = BUILDINGS.length;
const GALLERY_PAGES = Math.ceil(BUILDING_COUNT / 9);
console.log(`   (from data/: ${BUILDINGS.length} buildings + ${PARCELS.length} parcels = ${TOTAL}; CH ${CH}; ${COUNTRY_COUNT} countries)`);

(async () => {
  const cdp = await launch({ webgl: true });
  try {
    // Catalogue shell and default map view.
    const p = await openPage(cdp, `${APP_BASE}/app/portfolio`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false }, p.sessionId);
    const R = await p.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      window.__mapErrs = []; const oe = console.error;
      console.error = (...a) => { try { window.__mapErrs.push(a.map(x => typeof x === 'string' ? x : ((x && x.message) || '')).join(' ')); } catch (e) {} oe.apply(console, a); };
      let n = 0; while (!document.querySelector('.pf-tree') && n++ < 150) await s(100);
      const count = () => (document.querySelector('#pf-count') || {}).textContent || '';
      // Seit dem Umzug auf das Seitenbaum-Bauteil (2026-08-14): ein Abschnitt, die
      // Laender sind seine direkten Eintraege.
      const countries = document.querySelectorAll('.pf-tree__section > li').length;
      let m = 0; while (!document.querySelector('.pf-map canvas') && m++ < 100) await s(100);
      const r = { h1: (document.querySelector('h1') || {}).textContent, countries, count0: count(), mapCanvas: !!document.querySelector('.pf-map canvas') };

      // Compact catbar: search + sort + filter + view-switch in one bar
      r.hasCatbar = !!document.querySelector('.catbar .catbar__search #pf-q')
        && !!document.querySelector('.catbar .catbar__controls #pf-sort')
        && !!document.querySelector('.catbar .catbar__controls #pf-filter-btn')
        && !!document.querySelector('.catbar .catbar__controls .view-switch');

      // Gallery cards and pagination.
      document.querySelector('[data-view="gallery"]').click(); await s(300);
      r.galCards = document.querySelectorAll('.pf-gallery .pf-card').length;
      r.galPag = (document.querySelector('#pf-count') || {}).textContent || '';
      r.hasCdPag = !!document.querySelector('.pagination-wrap .pagination__items');
      // Sort dropdown reorders the gallery (bare CD select: 4 selectable opts + 1 disabled «Sortieren» hint)
      const firstCard = () => { const t = document.querySelector('.pf-gallery .pf-card .card__title'); return t ? t.textContent.trim() : ''; };
      r.sortOpts = document.querySelectorAll('#pf-sort option:not([disabled])').length;
      r.sortNameFirst = firstCard();
      const ss = document.querySelector('#pf-sort'); ss.value = 'area'; ss.dispatchEvent(new Event('change', { bubbles: true })); await s(300);
      r.sortAreaFirst = firstCard();
      ss.value = 'name'; ss.dispatchEvent(new Event('change', { bubbles: true })); await s(200);

      // Active-filters row (C.activeFilters, JS-state): apply a Status filter → pill + badge appear
      // and the count drops; removing the pill restores everything.
      document.querySelector('#pf-filter-btn').click(); await s(150);
      const st = document.querySelector('#pf-filters input[data-fdim="status"]');
      st.checked = true; st.dispatchEvent(new Event('change', { bubbles: true })); await s(250);
      r.afPills = document.querySelectorAll('#pf-activefilters .active-filter').length;
      r.afBadge = (document.querySelector('#pf-filter-btn .catbar__fcount') || {}).textContent || '';
      r.afCountFiltered = parseInt((document.querySelector('#pf-count') || {}).textContent || '', 10);
      document.querySelector('#pf-activefilters .active-filter').click(); await s(250);   // remove via pill
      r.afPillsAfter = document.querySelectorAll('#pf-activefilters .active-filter').length;
      r.afCountRestored = parseInt((document.querySelector('#pf-count') || {}).textContent || '', 10);
      // List rows.
      document.querySelector('[data-view="list"]').click(); await s(250);
      r.listRows = document.querySelectorAll('.pf-main table tbody tr').length;
      // Search
      const q = document.querySelector('#pf-q'); q.value = 'Botschaft'; q.dispatchEvent(new Event('input', { bubbles: true })); await s(450);
      r.countSearch = count();
      q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); await s(450);
      // Return to the map and select the CH country node.
      document.querySelector('[data-view="map"]').click();
      let mc = 0; while (!document.querySelector('.pf-map canvas') && mc++ < 100) await s(100);
      const ch = document.querySelector('.pf-tree__row[data-node="country:CH"]');
      r.chTreeCount = ch.querySelector('.pf-tree__n').textContent;
      ch.click();
      let mc2 = 0; while (!document.querySelector('.pf-map canvas') && mc2++ < 100) await s(100);
      r.countCH = count();
      r.mapCanvas2 = !!document.querySelector('.pf-map canvas');
      // The sidebar head carries no clear-selection control any more; the tree
      // selection is cleared through its chip in the active-filter row.
      r.headButtons = document.querySelectorAll('.pf-sidebar__head button').length;
      r.selPill = [...document.querySelectorAll('#pf-activefilters .active-filter')]
        .some(p => /^Auswahl:/.test(p.textContent.trim()));
      r.mapErrs = (window.__mapErrs || []).filter(e => /Unimplemented|glyph|type: 4/i.test(e));
      return r;
    })()`);
    console.log('■ Shell');
    console.log('   h1:', JSON.stringify(R.h1), '| countries:', R.countries, '| count:', JSON.stringify(R.count0), '| map:', R.mapCanvas);
    console.log('   Gallery cards:', R.galCards, `(${R.galPag}) | list rows:`, R.listRows, '| search "Botschaft":', R.countSearch);
    console.log('   CH tree count:', R.chTreeCount, '| after CH click:', R.countCH,
      '| head buttons:', R.headButtons, '| selection chip:', R.selPill);
    check(/Liegenschaften Inventar/.test(R.h1 || ''), 'page header');
    check(R.countries === COUNTRY_COUNT, `${COUNTRY_COUNT} countries appear in the tree (${R.countries})`);
    check(new RegExp(`^${BUILDING_COUNT} von ${TOTAL} `).test(R.count0), `The default count contains ${BUILDING_COUNT} of ${TOTAL} records (${R.count0})`);


    check(R.mapCanvas2, 'The map view renders its clustered map');
    check(R.hasCatbar, 'compact catbar: search + sort + filter + view-switch in one bar');
    check(R.galCards === 9 && new RegExp(`Seite 1 von ${GALLERY_PAGES}`).test(R.galPag) && R.hasCdPag, `Gallery pagination shows nine cards per page (${R.galCards}, ${JSON.stringify(R.galPag)})`);
    check(R.sortOpts === 4 && !!R.sortNameFirst && R.sortNameFirst !== R.sortAreaFirst, `sort reorders gallery (${R.sortOpts} opts; name:"${R.sortNameFirst}" ≠ area:"${R.sortAreaFirst}")`);
    console.log('   active-filters: pills', R.afPills, '| badge', JSON.stringify(R.afBadge), '| count filtered', R.afCountFiltered, '→ restored', R.afCountRestored);
    check(R.afPills === 2 && R.afBadge === '(2)' && R.afCountFiltered < BUILDING_COUNT, `The active-filter chip applies beside the building chip (${R.afPills} pills, badge ${R.afBadge}, ${R.afCountFiltered}/${BUILDING_COUNT})`);
    check(R.afPillsAfter === 1 && R.afCountRestored === BUILDING_COUNT, `removing the status pill restores the building default (${R.afPillsAfter} pill, ${R.afCountRestored}/${BUILDING_COUNT})`);


    check(R.listRows === Math.min(BUILDING_COUNT, 25), `The list shows its first page: ${Math.min(BUILDING_COUNT, 25)} of ${BUILDING_COUNT} (${R.listRows})`);
    check(parseInt(R.countSearch, 10) < TOTAL && parseInt(R.countSearch, 10) > 0, `search filters (${R.countSearch})`);
    check(R.chTreeCount === String(CH_BUILDINGS) && new RegExp(`^${CH_BUILDINGS} `).test(R.countCH), `The CH node filters to ${CH_BUILDINGS} buildings (${R.chTreeCount} → ${R.countCH})`);
    check(R.mapCanvas2, 'map re-renders after tree filter');
    check(R.headButtons === 0 && R.selPill,
      'the selection is cleared through its active-filter chip, not a second control in the sidebar head');
    check(R.mapErrs.length === 0, `no glyph/tile parse errors${R.mapErrs[0] ? ' — ' + R.mapErrs[0] : ''}`);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, p.sessionId);
    writeFileSync(process.env.SHOT || join(tmpdir(), 'bbl-portfolio.png'), Buffer.from(shot.data, 'base64'));
    await p.closeTarget();


    const d = await openPage(cdp, `${APP_BASE}/app/portfolio?id=${encodeURIComponent('1080/4840/AF')}`);



    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false }, d.sessionId);
    await new Promise(r => setTimeout(r, 600));
    const D = await d.evaluate(`(async () => { const s = ms => new Promise(r => setTimeout(r, ms)); let n = 0; while (!document.querySelector('.tab__control') && n++ < 100) await s(100);
      const r = { h1: (document.querySelector('h1') || {}).textContent, tabs: [...document.querySelectorAll('.tab__control')].map(t => t.textContent.trim()) };
      r.launchLinks = [...document.querySelectorAll('.detail-layout__aside a.fp-svc[href^="#/app/"]')]
        .map(a => ({ target: a.getAttribute('target') || '', rel: a.getAttribute('rel') || '' }));
      r.serviceDetailTarget = document.querySelector('.detail-layout__aside a.fp-svc[href^="#/services/"]')?.getAttribute('target') || '';

      const vt = [...document.querySelectorAll('.tab__control')].find(t => /Verträge/.test(t.textContent)); if (vt) { vt.click(); await s(200); }
      const contractsPanel = document.querySelector('#pf-tab-panel-contracts'); r.contractRows = contractsPanel ? contractsPanel.querySelectorAll('table tbody tr').length : 0;
      // The costs tab has body rows and a footer total.
      const kt = [...document.querySelectorAll('.tab__control')].find(t => /Kosten/.test(t.textContent)); if (kt) { kt.click(); await s(200); }


      const costsPanel = document.querySelector('#pf-tab-panel-costs'); r.costTotalRow = costsPanel ? !!costsPanel.querySelector('tfoot tr') : false; r.costRows = costsPanel ? costsPanel.querySelectorAll('table tbody tr').length : 0;



      const cells = document.querySelectorAll('#pf-mosaic [data-gallery]');
      r.mosaicCells = cells.length;
      const mc = document.querySelector('.pf-mosaic__cell--main');
      const mi = mc ? mc.querySelector('img') : null;
      r.heroGutter = (mc && mi) ? Math.round(mc.getBoundingClientRect().width - mi.getBoundingClientRect().width) : -1;

      const mos = document.querySelector('#pf-mosaic');
      r.dbgMosH = mos ? Math.round(mos.getBoundingClientRect().height) : -1;
      r.dbgMainH = mc ? Math.round(mc.getBoundingClientRect().height) : -1;
      r.mainFillsHeight = (mos && mc)
        ? Math.abs(mc.getBoundingClientRect().height - mos.getBoundingClientRect().height) <= 2 : false;

      r.moreOverlay = !!document.querySelector('.pf-mosaic__more');
      // The desktop hero has main image, side tiles and location map.
      r.heroCols = mos ? getComputedStyle(mos).gridTemplateColumns.split(' ').length : 0;
      r.heroMap = !!document.querySelector('#pf-mosaic .pf-hero__map');


      r.sideTiles = document.querySelectorAll('.pf-mosaic__cell--side').length;

      r.emptyClickable = document.querySelectorAll(
        '.pf-mosaic__cell--empty[data-gallery], button.pf-mosaic__cell--empty').length;

      const third = cells[2] || cells[0]; if (third) third.click(); await s(300);
      const lb = document.querySelector('.pf-lightbox');
      r.lightbox = !!lb;
      r.lightboxImg = !!document.querySelector('.pf-lightbox__img');


      r.zoomBar = !!document.querySelector('.pf-lightbox__zoom');
      r.sharedZoomBar = !!document.querySelector('.pf-lightbox__zoom.viewer-toolbar--negative .viewer-toolbar__button');

      const lbRect = lb ? lb.getBoundingClientRect() : null;
      r.lightboxViewportGap = lbRect ? Math.round(innerWidth - lbRect.right) : -1;
      r.lightboxFullscreen = lbRect
        ? Math.round(lbRect.height) === innerHeight && Math.abs(r.lightboxViewportGap) <= 1 : false;
      r.lightboxBar = !!document.querySelector('.pf-lightbox__bar');
      r.lightboxDownload = !!document.querySelector('.pf-lightbox a[download]');
      r.lightboxStartsAtClicked = /Bild 3 von/.test((document.querySelector('.pf-lightbox__sub') || {}).textContent || '');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await s(200);
      r.lightboxClosed = !document.querySelector('.pf-lightbox');
      return r; })()`);
    console.log('■ Building detail:', JSON.stringify(D.h1), '| tabs:', JSON.stringify(D.tabs));
    console.log('   Contract rows:', D.contractRows, '| cost rows + total:', D.costRows, D.costTotalRow, '| lightbox:', D.lightbox, 'zoom', D.zoomBar, 'closed', D.lightboxClosed);
    check(/Bundeshaus West/.test(D.h1 || ''), `building deep-link (${D.h1})`);
    check(D.tabs.length === 7, `building detail has 7 tabs (${D.tabs.length})`);
    check(['Flächen', 'Ausstattung', 'Verträge', 'Kosten', 'Dokumente', 'Kontakte'].every(t => D.tabs.some(x => x.includes(t))), 'entity + core tabs present');
    check(!D.tabs.some(t => /Medien|Bauprojekte/.test(t)), 'The retired media and project tabs are absent');
    check(D.launchLinks.length === 3 && D.launchLinks.every(a =>
      a.target === '_blank' && a.rel.split(/\s+/).includes('noopener')),
      `specialist-application launches open new tabs (${D.launchLinks.length})`);
    check(!D.serviceDetailTarget, 'service-description navigation stays in the current tab');
    check(D.contractRows >= 1, `Contracts tab shows contracts (${D.contractRows} rows)`);
    check(D.costTotalRow && D.costRows >= 1, `Costs tab shows table + total row (${D.costRows} rows)`);
    check(D.mosaicCells >= 2, `image mosaic renders its tiles (${D.mosaicCells})`);
    check(D.heroGutter === 0, `main tile exactly covers its image, no dead zone (Δwidth = ${D.heroGutter}px)`);
    check(D.mainFillsHeight, `main tile fills the mosaic height (${D.dbgMosH}px)`);
    check(D.heroCols === 3, `hero is three columns at 1440px — image · tiles · map (${D.heroCols})`);
    check(D.heroMap, 'hero carries the location map');
    check(D.sideTiles === 4, `side grid is always 4 tiles, padded with placeholders (${D.sideTiles})`);
    check(D.emptyClickable === 0, `placeholder tiles are not clickable (${D.emptyClickable})`);
    check(D.moreOverlay, 'The final side tile has the all-images overlay');
    check(D.lightbox && D.lightboxImg && D.zoomBar && D.sharedZoomBar,
      `mosaic tile opens the gallery (gemeinsame Zoomleiste: ${D.sharedZoomBar})`);
    check(D.lightboxFullscreen,
      `gallery viewer reaches every viewport edge (${D.lightboxViewportGap}px right gap)`);
    check(D.lightboxBar && D.lightboxDownload, 'viewer has a header bar with a download action');
    check(D.lightboxStartsAtClicked, 'viewer opens at the clicked image, not the first');
    check(D.lightboxClosed, 'Esc closes the viewer');
    await d.closeTarget();

    // 3) parcel detail deep-link -----------------------------------------------
    const pc = await openPage(cdp, `${APP_BASE}/app/portfolio?id=${encodeURIComponent('1080/4840/01')}`);
    await new Promise(r => setTimeout(r, 600));
    const P = await pc.evaluate(`(async () => { const s = ms => new Promise(r => setTimeout(r, ms)); let n = 0; while (!document.querySelector('.kv') && n++ < 100) await s(100);
      const r = { h1: (document.querySelector('h1') || {}).textContent, text: document.body.textContent.replace(/\\s+/g, ' '),
        tabs: [...document.querySelectorAll('.tab__control')].map(t => t.textContent.trim()), hasMap: !!document.querySelector('#pf-parcel-map') };
      const bt = [...document.querySelectorAll('.tab__control')].find(t => /Bodenbedeckung/.test(t.textContent)); if (bt) { bt.click(); await s(200); }
      const landcoverPanel = document.querySelector('#pf-ptab-panel-landcover'); r.landcoverRows = landcoverPanel ? landcoverPanel.querySelectorAll('table tbody tr').length : 0;
      return r; })()`);
    console.log('■ Parcel detail:', JSON.stringify(P.h1), '| tabs:', JSON.stringify(P.tabs), '| land-cover rows:', P.landcoverRows);
    check(!!P.h1 && /Grundstück/.test(P.text), `parcel deep-link renders (${P.h1})`);
    check(/Gebäude auf der Parzelle/.test(P.text), 'parcel links to its building');
    check(P.tabs.some(t => /Bodenbedeckung/.test(t)) && P.hasMap, 'The parcel has a land-cover tab and mini-map');
    check(P.landcoverRows >= 1, `Land-cover tab shows records (${P.landcoverRows} rows)`);
    check([...(await p.problems()), ...(await d.problems()), ...(await pc.problems())].length === 0,
      `no exceptions / console errors / error banner${[...(await p.problems()), ...(await d.problems()), ...(await pc.problems())][0] ? ': ' + [...(await p.problems()), ...(await d.problems()), ...(await pc.problems())][0] : ''}`);
    await pc.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
