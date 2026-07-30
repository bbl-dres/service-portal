// Liegenschaften Inventar — map-first redesign (js/apps/portfolio.js, Phase 1).
// Verifies the spatial tree (Land›Region›Stadt›WE›Objekte), the Karte/Galerie/Liste
// toggle with pagination, tree-node filtering, search, and the building/parcel
// deep-link detail views. See docs/portfolio-redesign.md.
//
//   node scripts/test-portfolio.mjs      (dev server must be running; see README)
import { writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };

// Erwartungswerte aus den Daten ableiten statt festzuschreiben: das Inventar
// wächst (echte Bauten aus den BBL-Bautendokumentationen kamen dazu), und ein
// eingetippter Zählwert prüft dann nur noch, dass niemand die Daten angefasst
// hat — nicht, dass die Ansicht sie vollständig zeigt.
const geo = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8')).features;
const BAUTEN = geo('buildings.geojson');
const PARZELLEN = geo('parcels.geojson');
const TOTAL = BAUTEN.length + PARZELLEN.length;
const CH = [...BAUTEN, ...PARZELLEN].filter((f) => f.properties.adr_land === 'CH').length;
const CH_GEB = BAUTEN.filter((f) => f.properties.adr_land === 'CH').length;   // Baum zählt in der Standardansicht nur Gebäude
const LAENDER = new Set(BAUTEN.map((f) => f.properties.adr_land)).size;
const GEBAEUDE = BAUTEN.length;            // Standardansicht: nur Gebäude (Objekttyp-Facette)
const GAL_SEITEN = Math.ceil(GEBAEUDE / 9);   // Galerie zeigt 9 je Seite
console.log(`   (aus data/: ${BAUTEN.length} Gebäude + ${PARZELLEN.length} Grundstücke = ${TOTAL}, davon CH ${CH}, ${LAENDER} Länder)`);

(async () => {
  const cdp = await launch({ webgl: true });
  try {
    // 1) shell: tree + default Karte view --------------------------------------
    const p = await openPage(cdp, `${APP_BASE}/app/portfolio`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false }, p.sessionId);
    const R = await p.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      window.__mapErrs = []; const oe = console.error;
      console.error = (...a) => { try { window.__mapErrs.push(a.map(x => typeof x === 'string' ? x : ((x && x.message) || '')).join(' ')); } catch (e) {} oe.apply(console, a); };
      let n = 0; while (!document.querySelector('.pf-tree') && n++ < 150) await s(100);
      const count = () => (document.querySelector('#pf-count') || {}).textContent || '';
      const lands = document.querySelectorAll('.pf-tree > .pf-tree__item > .pf-tree__node').length;
      let m = 0; while (!document.querySelector('.pf-map canvas') && m++ < 100) await s(100);
      const r = { h1: (document.querySelector('h1') || {}).textContent, lands, count0: count(), mapCanvas: !!document.querySelector('.pf-map canvas') };

      // Compact catbar: search + sort + filter + view-switch in one bar
      r.hasCatbar = !!document.querySelector('.catbar .catbar__search #pf-q')
        && !!document.querySelector('.catbar .catbar__controls #pf-sort')
        && !!document.querySelector('.catbar .catbar__controls #pf-filter-btn')
        && !!document.querySelector('.catbar .catbar__controls .view-switch');

      // Galerie → cards + pagination
      document.querySelector('[data-view="gallery"]').click(); await s(300);
      r.galCards = document.querySelectorAll('.pf-gallery .pf-card').length;
      r.galPag = (document.querySelector('#pf-count') || {}).textContent || '';   // CD header: «N von M Objekte · Seite X von Y»
      r.hasCdPag = !!document.querySelector('.pagination-wrap .pagination_items');
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
      // Liste → rows
      document.querySelector('[data-view="list"]').click(); await s(250);
      r.listRows = document.querySelectorAll('.pf-main table tbody tr').length;
      // Search
      const q = document.querySelector('#pf-q'); q.value = 'Botschaft'; q.dispatchEvent(new Event('input', { bubbles: true })); await s(450);
      r.countSearch = count();
      q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); await s(450);
      // Karte back + tree filter: click the CH land node
      document.querySelector('[data-view="map"]').click(); await s(200);
      const ch = [...document.querySelectorAll('.pf-tree__node[data-land="CH"]')].find(n => !n.dataset.region);
      r.chTreeCount = ch.querySelector('.pf-tree__n').textContent;
      ch.click(); await s(400);
      r.countCH = count();
      r.mapCanvas2 = !!document.querySelector('.pf-map canvas');
      r.clearShown = !document.querySelector('#pf-clear').hidden;
      r.mapErrs = (window.__mapErrs || []).filter(e => /Unimplemented|glyph|type: 4/i.test(e));
      return r;
    })()`);
    console.log('■ Shell');
    console.log('   h1:', JSON.stringify(R.h1), '| lands:', R.lands, '| count:', JSON.stringify(R.count0), '| map:', R.mapCanvas);
    console.log('   Galerie cards:', R.galCards, `(${R.galPag}) | Liste rows:`, R.listRows, '| Suche "Botschaft":', R.countSearch);
    console.log('   CH tree count:', R.chTreeCount, '| nach CH-Klick:', R.countCH, '| Auswahl-Reset sichtbar:', R.clearShown);
    check(/Liegenschaften Inventar/.test(R.h1 || ''), 'page header');
    check(R.lands === LAENDER, `${LAENDER} Länder in the tree (${R.lands})`);
    check(new RegExp(`^${GEBAEUDE} von ${TOTAL} `).test(R.count0), `${GEBAEUDE} von ${TOTAL} Objekten — Standard nur Gebäude (${R.count0})`);
    // Galerie ist die Standardansicht (seit je); die Karte wird im Probelauf
    // explizit zugeschaltet — mapCanvas2 misst NACH dem Umschalten + CH-Klick.
    check(R.mapCanvas2, 'Kartenansicht renders the clustered map');
    check(R.hasCatbar, 'compact catbar: search + sort + filter + view-switch in one bar');
    check(R.galCards === 9 && new RegExp(`Seite 1 von ${GAL_SEITEN}`).test(R.galPag) && R.hasCdPag, `Galerie: 9/page, CD pagination (${R.galCards}, ${JSON.stringify(R.galPag)})`);
    check(R.sortOpts === 4 && !!R.sortNameFirst && R.sortNameFirst !== R.sortAreaFirst, `sort reorders gallery (${R.sortOpts} opts; name:"${R.sortNameFirst}" ≠ area:"${R.sortAreaFirst}")`);
    console.log('   active-filters: pills', R.afPills, '| badge', JSON.stringify(R.afBadge), '| count filtered', R.afCountFiltered, '→ restored', R.afCountRestored);
    check(R.afPills === 2 && R.afBadge === '(2)' && R.afCountFiltered < GEBAEUDE, `active-filter pill applies neben der Gebäude-Pille (${R.afPills} pills, badge ${R.afBadge}, ${R.afCountFiltered}/${GEBAEUDE})`);
    check(R.afPillsAfter === 1 && R.afCountRestored === GEBAEUDE, `removing the status pill restores the building default (${R.afPillsAfter} pill, ${R.afCountRestored}/${GEBAEUDE})`);
    // Die Liste blättert zu 25 — die frühere Zusicherung «zeigt alle» stimmte nur,
    // solange der Bestand unter 25 lag. Geprüft wird darum die erste Seite.
    check(R.listRows === Math.min(GEBAEUDE, 25), `Liste zeigt die erste Seite: ${Math.min(GEBAEUDE, 25)} von ${GEBAEUDE} (${R.listRows})`);
    check(parseInt(R.countSearch, 10) < TOTAL && parseInt(R.countSearch, 10) > 0, `search filters (${R.countSearch})`);
    check(R.chTreeCount === String(CH_GEB) && new RegExp(`^${CH_GEB} `).test(R.countCH), `tree node CH filters to its ${CH_GEB} Gebäude (${R.chTreeCount} → ${R.countCH})`);
    check(R.mapCanvas2, 'map re-renders after tree filter');
    check(R.clearShown, 'selection shows the reset control');
    check(R.mapErrs.length === 0, `no glyph/tile parse errors${R.mapErrs[0] ? ' — ' + R.mapErrs[0] : ''}`);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, p.sessionId);
    writeFileSync(process.env.SHOT || join(tmpdir(), 'bbl-portfolio.png'), Buffer.from(shot.data, 'base64'));
    await p.closeTarget();

    // 2) building detail deep-link — Phase-2 tabs (Flächen/Ausstattung/Verträge/Kosten/Kontakte)
    const d = await openPage(cdp, `${APP_BASE}/app/portfolio?id=${encodeURIComponent('1080/4840/AF')}`);
    // Viewport auch hier setzen: dieses Target erbt die Override der Shell-Seite
    // NICHT und lief sonst in der Headless-Standardgrösse — die Detailansicht
    // wurde also im gestapelten Mobil-Layout geprüft, obwohl der Test 1440 meint.
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false }, d.sessionId);
    await new Promise(r => setTimeout(r, 600));
    const D = await d.evaluate(`(async () => { const s = ms => new Promise(r => setTimeout(r, ms)); let n = 0; while (!document.querySelector('.tab__control') && n++ < 100) await s(100);
      const r = { h1: (document.querySelector('h1') || {}).textContent, tabs: [...document.querySelectorAll('.tab__control')].map(t => t.textContent.trim()) };
      // Verträge tab → contracts table rows
      const vt = [...document.querySelectorAll('.tab__control')].find(t => /Verträge/.test(t.textContent)); if (vt) { vt.click(); await s(200); }
      const vp = document.querySelector('#pf-tab-panel-vertraege'); r.vertraegeRows = vp ? vp.querySelectorAll('table tbody tr').length : 0;
      // Kosten tab → body rows + a tfoot total row
      const kt = [...document.querySelectorAll('.tab__control')].find(t => /Kosten/.test(t.textContent)); if (kt) { kt.click(); await s(200); }
      // Seit dem CD-Review trägt die Summenzeile keine Klasse mehr — das
      // generische tfoot IST das CD-Rezept (table.postcss:45-67).
      const kp = document.querySelector('#pf-tab-panel-kosten'); r.kostenTotalRow = kp ? !!kp.querySelector('tfoot tr') : false; r.kostenRows = kp ? kp.querySelectorAll('table tbody tr').length : 0;
      // Bildmosaik: Hauptbild links auf voller Höhe + 2x2-Raster rechts. Jede Kachel
      // muss ihr Bild exakt bedecken — sonst entsteht neben dem Bild eine tote
      // Klickzone, die trotzdem die Galerie öffnet (früherer Fehler: 508px rechts).
      const cells = document.querySelectorAll('#pf-mosaic [data-gallery]');
      r.mosaicCells = cells.length;
      const mc = document.querySelector('.pf-mosaic__cell--main');
      const mi = mc ? mc.querySelector('img') : null;
      r.heroGutter = (mc && mi) ? Math.round(mc.getBoundingClientRect().width - mi.getBoundingClientRect().width) : -1;
      // Das Mosaik füllt seine Höhe mit dem Hauptbild (Desktop-Layout).
      const mos = document.querySelector('#pf-mosaic');
      r.dbgMosH = mos ? Math.round(mos.getBoundingClientRect().height) : -1;
      r.dbgMainH = mc ? Math.round(mc.getBoundingClientRect().height) : -1;
      r.mainFillsHeight = (mos && mc)
        ? Math.abs(mc.getBoundingClientRect().height - mos.getBoundingClientRect().height) <= 2 : false;
      // Die letzte Nebenkachel trägt die Auflage «Alle Bilder anzeigen».
      r.moreOverlay = !!document.querySelector('.pf-mosaic__more');
      // Hero = Hauptbild · Kachelraster · Standortkarte (drei Spalten ab 1024px).
      r.heroCols = mos ? getComputedStyle(mos).gridTemplateColumns.split(' ').length : 0;
      r.heroMap = !!document.querySelector('#pf-mosaic .pf-hero__map');
      // Das Kachelraster steht immer auf vier — fehlende Bilder werden mit
      // Platzhaltern aufgefüllt, damit der Hero nicht je nach Datenlage springt.
      r.sideTiles = document.querySelectorAll('.pf-mosaic__cell--side').length;
      // Platzhalter dürfen nicht anklickbar sein: dahinter liegt kein Bild.
      r.emptyClickable = document.querySelectorAll(
        '.pf-mosaic__cell--empty[data-gallery], button.pf-mosaic__cell--empty').length;
      // Eine Kachel öffnet den Vollbild-Betrachter bei GENAU ihrem Bild; Esc schliesst.
      const third = cells[2] || cells[0]; if (third) third.click(); await s(300);
      const lb = document.querySelector('.pf-lightbox');
      r.lightbox = !!lb;
      r.lightboxImg = !!document.querySelector('.pf-lightbox__img');
      // Die Miniaturenleiste wurde bewusst entfernt; navigiert wird über die
      // Blätterpfeile und den Zähler in der Kopfzeile.
      r.zoomBar = !!document.querySelector('.pf-lightbox__zoom');
      // Vollbild statt zentrierter Karte, mit Kopfzeile und Herunterladen-Aktion.
      r.lightboxFullscreen = lb
        ? Math.round(lb.getBoundingClientRect().height) === document.documentElement.clientHeight : false;
      r.lightboxBar = !!document.querySelector('.pf-lightbox__bar');
      r.lightboxDownload = !!document.querySelector('.pf-lightbox a[download]');
      r.lightboxStartsAtClicked = /Bild 3 von/.test((document.querySelector('.pf-lightbox__sub') || {}).textContent || '');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await s(200);
      r.lightboxClosed = !document.querySelector('.pf-lightbox');
      return r; })()`);
    console.log('■ Gebäude-Detail:', JSON.stringify(D.h1), '| tabs:', JSON.stringify(D.tabs));
    console.log('   Verträge rows:', D.vertraegeRows, '| Kosten rows+total:', D.kostenRows, D.kostenTotalRow, '| lightbox:', D.lightbox, 'zoom', D.zoomBar, 'closed', D.lightboxClosed);
    check(/Bundeshaus West/.test(D.h1 || ''), `building deep-link (${D.h1})`);
    check(D.tabs.length === 7, `building detail has 7 tabs (${D.tabs.length})`);
    check(['Flächen', 'Ausstattung', 'Verträge', 'Kosten', 'Dokumente', 'Kontakte'].every(t => D.tabs.some(x => x.includes(t))), 'entity + core tabs present');
    check(!D.tabs.some(t => /Medien|Bauprojekte/.test(t)), 'Medien + Bauprojekte tabs removed');
    check(D.vertraegeRows >= 1, `Verträge tab shows contracts (${D.vertraegeRows} rows)`);
    check(D.kostenTotalRow && D.kostenRows >= 1, `Kosten tab shows table + total row (${D.kostenRows} rows)`);
    check(D.mosaicCells >= 2, `image mosaic renders its tiles (${D.mosaicCells})`);
    check(D.heroGutter === 0, `main tile exactly covers its image, no dead zone (Δwidth = ${D.heroGutter}px)`);
    check(D.mainFillsHeight, `main tile fills the mosaic height (${D.dbgMosH}px)`);
    check(D.heroCols === 3, `hero is three columns at 1440px — image · tiles · map (${D.heroCols})`);
    check(D.heroMap, 'hero carries the location map');
    check(D.sideTiles === 4, `side grid is always 4 tiles, padded with placeholders (${D.sideTiles})`);
    check(D.emptyClickable === 0, `placeholder tiles are not clickable (${D.emptyClickable})`);
    check(D.moreOverlay, '«Alle Bilder anzeigen» overlay on the last side tile');
    check(D.lightbox && D.lightboxImg && D.zoomBar, `mosaic tile opens the gallery (Zoomleiste: ${D.zoomBar})`);
    check(D.lightboxFullscreen, 'gallery viewer is full-screen');
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
      const bp = document.querySelector('#pf-ptab-panel-bodenbedeckung'); r.bodenRows = bp ? bp.querySelectorAll('table tbody tr').length : 0;
      return r; })()`);
    console.log('■ Grundstück-Detail:', JSON.stringify(P.h1), '| tabs:', JSON.stringify(P.tabs), '| Bodenbedeckung rows:', P.bodenRows);
    check(!!P.h1 && /Grundstück/.test(P.text), `parcel deep-link renders (${P.h1})`);
    check(/Gebäude auf der Parzelle/.test(P.text), 'parcel links to its building');
    check(P.tabs.some(t => /Bodenbedeckung/.test(t)) && P.hasMap, 'parcel has Bodenbedeckung tab + mini-map');
    check(P.bodenRows >= 1, `Bodenbedeckung tab shows landcovers (${P.bodenRows} rows)`);
    check([...(await p.problems()), ...(await d.problems()), ...(await pc.problems())].length === 0,
      `no exceptions / console errors / error banner${[...(await p.problems()), ...(await d.problems()), ...(await pc.problems())][0] ? ': ' + [...(await p.problems()), ...(await d.problems()), ...(await pc.problems())][0] : ''}`);
    await pc.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
