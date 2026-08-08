// Data portal dashboard redesign — Superset-style framing + reusable action
// menus. Verifies: the grey-canvas/white-card chrome, a full-height filter panel,
// the footer, the dashboard toolbar menu (refresh/share) and the per-chart menu
// (fullscreen overlay, CSV/PNG downloads, copy-link). Also saves a screenshot.
//
//   node scripts/test-dashboard.mjs      (dev server must be running; see README)
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

const PROBE = `(async () => {
  const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  let attempts = 0; while (!document.querySelector('.dash-grid .chart') && attempts++ < 120) await sleep(100);
  // Since the CD review, the toast uses a CD toast message (a host notification).
  const lastToast = () => { const toast = [...document.querySelectorAll('.toast__message .notification__content')].pop(); return toast ? toast.textContent : null; };
  const result = {
    dashPage: !!document.querySelector('.dash-page'),
    headerMenu: !!document.querySelector('.dash-header .action-menu'),
    footer: !!document.querySelector('.dash-footer'),
    charts: document.querySelectorAll('.dash-grid .chart').length,
    chartMenus: document.querySelectorAll('.dash-grid .chart .action-menu').length,
  };
  const filterPanel = document.querySelector('.filter-panel'), dashboardMain = document.querySelector('.dashboard-main');
  result.filterH = Math.round(filterPanel.getBoundingClientRect().height);
  result.mainH = Math.round(dashboardMain.getBoundingClientRect().height);
  result.filterFullHeight = Math.abs(result.filterH - result.mainH) <= 2;

  // Open the dashboard toolbar menu and activate the "Link kopieren" UI fixture.
  document.querySelector('.dash-header .action-menu__trigger').click(); await sleep(60);
  result.dashPopupOpen = !document.querySelector('.dash-header .action-menu__popup').hidden;
  [...document.querySelectorAll('.dash-header .action-menu__item')].find(item => item.dataset.action === 'copy').click(); await sleep(150);
  result.toastCopy = lastToast();

  // Open the chart menu and activate the "Vollbild" UI fixture.
  const chartMenuTrigger = () => document.querySelector('.dash-grid .chart .action-menu__trigger');
  chartMenuTrigger().click(); await sleep(60);
  result.chartPopupOpen = !document.querySelector('.dash-grid .chart .action-menu__popup').hidden;
  [...document.querySelectorAll('.dash-grid .action-menu__item')].find(item => item.dataset.action === 'fullscreen').click(); await sleep(180);
  // Since the review, chart fullscreen uses the canonical xl modal (C.openModal).
  result.overlay = !!document.querySelector('.modal--xl');
  result.overlaySvg = document.querySelectorAll('.modal--xl .chart__svg').length;
  result.overlayHasMenu = !!document.querySelector('.modal--xl .action-menu'); // Must be false because the menu is stripped.
  document.querySelector('.modal--xl .modal__close').click(); await sleep(120);
  result.overlayClosed = !document.querySelector('.modal--xl');

  // Export CSV and then PNG from the chart menu.
  chartMenuTrigger().click(); await sleep(60);
  [...document.querySelectorAll('.dash-grid .action-menu__item')].find(item => item.dataset.action === 'csv').click(); await sleep(150);
  result.toastCsv = lastToast();
  chartMenuTrigger().click(); await sleep(60);
  // PNG export renders the SVG to a canvas asynchronously — give it room (was 400ms, too tight).
  [...document.querySelectorAll('.dash-grid .action-menu__item')].find(item => item.dataset.action === 'png').click();
  { let attempts = 0; while (!/Bild heruntergeladen|fehlgeschlagen/.test(lastToast() || '') && attempts++ < 40) await sleep(50); }
  result.toastPng = lastToast();
  return result;
})()`;

let failures = 0;
const check = (cond, label) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); if (!cond) failures++; };

(async () => {
  const cdp = await launch({ webgl: true });
  try {
    // a generic query-spec dashboard (immobilien is now the record-based estate one)
    const page = await openPage(cdp, `${APP_BASE}/app/dataportal/energie-klima`);
    // desktop viewport so the 2-column layout + full-height panel apply
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    await new Promise(r => setTimeout(r, 900));

    // screenshot of the clean framing (before opening menus) → scratchpad
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, page.sessionId);
    const out = process.env.SHOT || join(tmpdir(), 'bbl-dashboard.png');
    writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log('■ Data portal dashboard');
    console.log(`   screenshot → ${out}`);

    const result = await page.evaluate(PROBE);
    check(result.dashPage, 'grey-canvas dash-page present');
    check(result.headerMenu, 'dashboard toolbar menu present');
    check(result.footer, 'meta-information footer present');
    check(result.charts >= 2 && result.chartMenus >= 2, `charts (${result.charts}) each have a menu (${result.chartMenus})`);
    check(result.filterFullHeight, `filter panel full height (${result.filterH}px vs main ${result.mainH}px)`);
    check(result.dashPopupOpen, 'dashboard menu opens');
    check(/kopiert|nicht möglich/i.test(result.toastCopy || ''), `toolbar copy action shows a toast ("${result.toastCopy}")`);
    check(result.chartPopupOpen, 'chart menu opens');
    check(result.overlay && result.overlaySvg > 0, 'fullscreen overlay shows the chart');
    check(!result.overlayHasMenu, 'overlay has no nested menu');
    check(result.overlayClosed, 'overlay closes');
    check(result.toastCsv === 'CSV heruntergeladen.', `CSV export shows a toast ("${result.toastCsv}")`);
    check(/Bild heruntergeladen|fehlgeschlagen/.test(result.toastPng || ''), `PNG export shows a completion toast ("${result.toastPng}")`);
    check((await page.problems()).length === 0, `no exceptions / console errors / error banner${(await page.problems())[0] ? ': ' + (await page.problems())[0] : ''}`);
    await page.closeTarget();

    // Data portal expansion (August 2026): seven topics, new chart forms, and a timeline.
    console.log('■ Data portal expansion (topics · metrics table · area chart · timeline)');
    const portalPage = await openPage(cdp, `${APP_BASE}/app/dataportal`);
    await new Promise(resolve => setTimeout(resolve, 1200));
    const overview = JSON.parse(await portalPage.evaluate(`JSON.stringify({
      cards: document.querySelectorAll('.grid h3').length,
      constructionProjects: [...document.querySelectorAll('.grid h3')].some(heading => /Bauprojekte & Investitionen/.test(heading.textContent)),
      links: [...document.querySelectorAll('.grid .card__link')].map(link => [link.textContent.trim(), link.getAttribute('href')]),
    })`));
    check(overview.cards === 7, `seven topic cards (${overview.cards})`);
    check(overview.constructionProjects, '"Bauprojekte & Investitionen" topic is present');
    const expectedCards = [
      ['Energie & Klima', '#/app/dataportal/energie-klima'],
      ['Immobilienportfolio', '#/app/dataportal/immobilien'],
      ['Bauprojekte & Investitionen', '#/app/dataportal/bauprojekte'],
      ['Beschaffung', '#/app/dataportal/beschaffung'],
      ['Logistik & Publikationen', '#/app/dataportal/logistik'],
      ['Mobilität', '#/app/dataportal/mobilitaet'],
      ['Personal', '#/app/dataportal/personal'],
    ];
    const sortedCards = (cards) => [...cards].sort(([left], [right]) => left.localeCompare(right, 'de'));
    check(JSON.stringify(sortedCards(overview.links)) === JSON.stringify(sortedCards(expectedCards)),
      'every topic card points to its single renderer');

    const genericBoards = [
      ['energie-klima', 'Energie & Klima'],
      ['bauprojekte', 'Bauprojekte & Investitionen'],
      ['beschaffung', 'Beschaffung'],
      ['logistik', 'Logistik & Publikationen'],
      ['mobilitaet', 'Mobilität'],
      ['personal', 'Personal'],
    ];
    for (const [id, title] of genericBoards) {
      await portalPage.evaluate(`location.hash = ${JSON.stringify(`#/app/dataportal/${id}`)}`);
      const smoke = JSON.parse(await portalPage.evaluate(`(async () => {
        const expected = ${JSON.stringify(title)};
        const deadline = performance.now() + 5000;
        while ((document.querySelector('h1')?.textContent.trim() !== expected
          || !document.querySelector('.dash-grid .chart')) && performance.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return JSON.stringify({
          title: document.querySelector('h1')?.textContent.trim() || '',
          dashPage: !!document.querySelector('.dash-page'),
          kpis: document.querySelectorAll('.kpi-row .kpi').length,
          charts: document.querySelectorAll('.dash-grid .chart').length,
        });
      })()`));
      check(smoke.title === title && smoke.dashPage && smoke.kpis === 4 && smoke.charts >= 1,
        `"${title}": generic dashboard with four metrics and charts`);
    }

    await portalPage.evaluate(`location.hash = '#/app/dataportal/beschaffung?tab=vergleich'`);
    await new Promise(resolve => setTimeout(resolve, 800));
    const comparison = JSON.parse(await portalPage.evaluate(`JSON.stringify({
      active: document.querySelector('.tab__control--active')?.dataset.tab || '',
      procurementOffices: !!document.querySelector('#stellen'),
      sustainability: !!document.querySelector('#nachhaltig'),
    })`));
    check(comparison.active === 'comparison' && comparison.procurementOffices && comparison.sustainability,
      'procurement deep link opens the "Vergleich & Nachhaltigkeit" tab');

    await portalPage.evaluate(`location.hash = '#/app/dataportal/energie-klima?tab=kennzahlen'`);
    await new Promise(resolve => setTimeout(resolve, 1200));
    const metricsTable = JSON.parse(await portalPage.evaluate(`JSON.stringify({
      table: !!document.querySelector('#energie-kz .chart__table--visible table'),
      rows: document.querySelectorAll('#energie-kz tbody tr').length,
      footnotes: document.querySelectorAll('#energie-kz .chart__footnotes li').length,
    })`));
    check(metricsTable.table && metricsTable.rows >= 5, `metrics table is visible (${metricsTable.rows} rows)`);
    check(metricsTable.footnotes >= 1, `footnotes (${metricsTable.footnotes})`);
    await portalPage.evaluate(`location.hash = '#/app/dataportal/energie-klima?tab=energiepfad'`);
    await new Promise(resolve => setTimeout(resolve, 1200));
    const areaChart = JSON.parse(await portalPage.evaluate(`JSON.stringify({
      bands: document.querySelectorAll('#traeger svg path[fill-opacity]').length,
      legendItems: document.querySelectorAll('#traeger .chart__legend-item').length,
    })`));
    check(areaChart.bands === 4 && areaChart.legendItems === 4,
      `stacked area chart (${areaChart.bands} bands, ${areaChart.legendItems} legend items)`);
    check((await portalPage.problems()).length === 0, 'expanded data portal has no errors');
    await portalPage.closeTarget();

    // Estate portfolio: the "Entwicklung" timeline tab requested on 2026-08-05.
    console.log('■ Estate portfolio — "Entwicklung" tab');
    const developmentPage = await openPage(cdp, `${APP_BASE}/app/dataportal/immobilien?tab=entwicklung`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false }, developmentPage.sessionId);
    await new Promise(resolve => setTimeout(resolve, 1800));
    const development = JSON.parse(await developmentPage.evaluate(`(async () => {
      const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
      let attempts = 0; while (!document.querySelector('#dash-grid svg') && attempts++ < 80) await sleep(100);
      return JSON.stringify({
        titles: [...document.querySelectorAll('#dash-grid .chart__title')].map(element => element.textContent),
        sparks: document.querySelectorAll('.kpi__spark').length,
        deltas: [...document.querySelectorAll('.kpi__delta')].map(element => element.textContent.trim()),
        hint: ([...document.querySelectorAll('.kpi__hint')][0] || {}).textContent || '',
        metricRows: document.querySelectorAll('#estate-development-metrics tbody tr').length,
        granularityRadios: document.querySelectorAll('#filter-body input[name="estate-granularity"]').length,
        tabs: [...document.querySelectorAll('.tab__control')].map(element => element.dataset.tab),
        oldGeneric: ['snbs', 'zert', 'portfolio-map'].some(id => !!document.getElementById(id)),
      });
    })()`));
    check(development.titles.includes('Gebäudebestand') && development.titles.includes('Indexierte Entwicklung (Basis 2019 = 100)')
      && development.titles.includes('Auslaufende Verträge je Jahr'), `timeline analyses (${development.titles.length})`);
    check(development.sparks >= 3, `sparklines in metric cards (${development.sparks})`);
    check(development.deltas.some(delta => /ggü\. Vorjahr/.test(delta)), `year-over-year deltas (${development.deltas[0]})`);
    check(/^Stand: /.test(development.hint), `reference-date line ("${development.hint}")`);
    check(development.metricRows === 8, `metrics table has eight rows (${development.metricRows})`);
    check(development.granularityRadios === 2, 'yearly and monthly granularity can be selected');
    check(JSON.stringify(development.tabs) === JSON.stringify(['buildings', 'parcels', 'landcover', 'development'])
      && !development.oldGeneric, 'estate view exclusively uses the specialised four-tab renderer');
    const granularity = JSON.parse(await developmentPage.evaluate(`(async () => {
      const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
      document.querySelector('input[name="estate-granularity"][value="monat"]').click();
      await sleep(800);
      return JSON.stringify({ hash: location.hash, dots: document.querySelectorAll('#estate-development-buildings svg circle').length });
    })()`));
    check(/gran=monat/.test(granularity.hash), 'selected granularity is stored in the hash');
    check(granularity.dots >= 24, `monthly values are drawn (${granularity.dots} points)`);
    check((await developmentPage.problems()).length === 0, 'development tab has no errors');
    await developmentPage.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
