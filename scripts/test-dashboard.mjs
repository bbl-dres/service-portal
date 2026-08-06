// Datenportal dashboard redesign — Superset-style framing + reusable action
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
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (!document.querySelector('.dash-grid .chart') && n++ < 120) await s(100);
  // Seit dem CD-Review ist der Toast eine CD toast-message (Notification im Host).
  const lastToast = () => { const t = [...document.querySelectorAll('.toast__message .notification__content')].pop(); return t ? t.textContent : null; };
  const R = {
    dashPage: !!document.querySelector('.dash-page'),
    headerMenu: !!document.querySelector('.dash-header .action-menu'),
    footer: !!document.querySelector('.dash-footer'),
    charts: document.querySelectorAll('.dash-grid .chart').length,
    chartMenus: document.querySelectorAll('.dash-grid .chart .action-menu').length,
  };
  const fp = document.querySelector('.filter-panel'), dm = document.querySelector('.dashboard-main');
  R.filterH = Math.round(fp.getBoundingClientRect().height);
  R.mainH = Math.round(dm.getBoundingClientRect().height);
  R.filterFullHeight = Math.abs(R.filterH - R.mainH) <= 2;

  // dashboard toolbar menu → open + "Link kopieren"
  document.querySelector('.dash-header .action-menu__trigger').click(); await s(60);
  R.dashPopupOpen = !document.querySelector('.dash-header .action-menu__popup').hidden;
  [...document.querySelectorAll('.dash-header .action-menu__item')].find(i => i.dataset.action === 'copy').click(); await s(150);
  R.toastCopy = lastToast();

  // chart menu → Vollbild
  const chartMenuTrigger = () => document.querySelector('.dash-grid .chart .action-menu__trigger');
  chartMenuTrigger().click(); await s(60);
  R.chartPopupOpen = !document.querySelector('.dash-grid .chart .action-menu__popup').hidden;
  [...document.querySelectorAll('.dash-grid .action-menu__item')].find(i => i.dataset.action === 'fullscreen').click(); await s(180);
  // Chart-Vollbild läuft seit dem Review über das kanonische Modal (C.openModal, xl).
  R.overlay = !!document.querySelector('.modal--xl');
  R.overlaySvg = document.querySelectorAll('.modal--xl .chart__svg').length;
  R.overlayHasMenu = !!document.querySelector('.modal--xl .action-menu');   // should be false (stripped)
  document.querySelector('.modal--xl .modal__close').click(); await s(120);
  R.overlayClosed = !document.querySelector('.modal--xl');

  // chart menu → CSV then PNG
  chartMenuTrigger().click(); await s(60);
  [...document.querySelectorAll('.dash-grid .action-menu__item')].find(i => i.dataset.action === 'csv').click(); await s(150);
  R.toastCsv = lastToast();
  chartMenuTrigger().click(); await s(60);
  // PNG export renders the SVG to a canvas asynchronously — give it room (was 400ms, too tight).
  [...document.querySelectorAll('.dash-grid .action-menu__item')].find(i => i.dataset.action === 'png').click();
  { let k = 0; while (!/Bild heruntergeladen|fehlgeschlagen/.test(lastToast() || '') && k++ < 40) await s(50); }
  R.toastPng = lastToast();
  return R;
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
    console.log('■ Datenportal dashboard');
    console.log(`   screenshot → ${out}`);

    const r = await page.evaluate(PROBE);
    check(r.dashPage, 'grey-canvas dash-page present');
    check(r.headerMenu, 'dashboard toolbar menu present');
    check(r.footer, 'meta-info footer present');
    check(r.charts >= 2 && r.chartMenus >= 2, `charts (${r.charts}) each have a menu (${r.chartMenus})`);
    check(r.filterFullHeight, `filter panel full height (${r.filterH}px vs main ${r.mainH}px)`);
    check(r.dashPopupOpen, 'dashboard menu opens');
    check(/kopiert|nicht möglich/i.test(r.toastCopy || ''), `toolbar "Link kopieren" → toast ("${r.toastCopy}")`);
    check(r.chartPopupOpen, 'chart menu opens');
    check(r.overlay && r.overlaySvg > 0, 'Vollbild overlay shows the chart');
    check(!r.overlayHasMenu, 'overlay has no nested menu');
    check(r.overlayClosed, 'overlay closes');
    check(r.toastCsv === 'CSV heruntergeladen.', `CSV → toast ("${r.toastCsv}")`);
    check(/Bild heruntergeladen|fehlgeschlagen/.test(r.toastPng || ''), `PNG → toast ("${r.toastPng}")`);
    check((await page.problems()).length === 0, `no exceptions / console errors / error banner${(await page.problems())[0] ? ': ' + (await page.problems())[0] : ''}`);
    await page.closeTarget();

    // --- Datenportal-Ausbau (Aug. 2026): 7 Themen, neue Chart-Formen, Zeitachse ---
    console.log('■ Datenportal-Ausbau (Themen · Kennzahlen-Tabelle · Fläche · Zeitachse)');
    const p2 = await openPage(cdp, `${APP_BASE}/app/dataportal`);
    await new Promise(r => setTimeout(r, 1200));
    const o = JSON.parse(await p2.evaluate(`JSON.stringify({
      cards: document.querySelectorAll('.grid h3').length,
      bauprojekte: [...document.querySelectorAll('.grid h3')].some(h => /Bauprojekte & Investitionen/.test(h.textContent)),
      links: [...document.querySelectorAll('.grid .card__link')].map(a => [a.textContent.trim(), a.getAttribute('href')]),
    })`));
    check(o.cards === 7, `7 Themenkarten (${o.cards})`);
    check(o.bauprojekte, 'Thema «Bauprojekte & Investitionen» vorhanden');
    const expectedCards = [
      ['Energie & Klima', '#/app/dataportal/energie-klima'],
      ['Immobilienportfolio', '#/app/dataportal/immobilien'],
      ['Bauprojekte & Investitionen', '#/app/dataportal/bauprojekte'],
      ['Beschaffung', '#/app/dataportal/beschaffung'],
      ['Logistik & Publikationen', '#/app/dataportal/logistik'],
      ['Mobilität', '#/app/dataportal/mobilitaet'],
      ['Personal', '#/app/dataportal/personal'],
    ];
    check(JSON.stringify(o.links) === JSON.stringify(expectedCards), 'alle Themenkarten verweisen auf ihren einzigen Renderer');

    const genericBoards = [
      ['energie-klima', 'Energie & Klima'],
      ['bauprojekte', 'Bauprojekte & Investitionen'],
      ['beschaffung', 'Beschaffung'],
      ['logistik', 'Logistik & Publikationen'],
      ['mobilitaet', 'Mobilität'],
      ['personal', 'Personal'],
    ];
    for (const [id, title] of genericBoards) {
      await p2.evaluate(`location.hash = ${JSON.stringify(`#/app/dataportal/${id}`)}`);
      const smoke = JSON.parse(await p2.evaluate(`(async () => {
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
        `${title}: generisches Dashboard mit 4 Kennzahlen und Charts`);
    }

    await p2.evaluate(`location.hash = '#/app/dataportal/beschaffung?tab=vergleich'`);
    await new Promise(r => setTimeout(r, 800));
    const vergleich = JSON.parse(await p2.evaluate(`JSON.stringify({
      active: document.querySelector('.tab__control--active')?.dataset.tab || '',
      stellen: !!document.querySelector('#stellen'),
      nachhaltig: !!document.querySelector('#nachhaltig'),
    })`));
    check(vergleich.active === 'vergleich' && vergleich.stellen && vergleich.nachhaltig,
      'Beschaffung-Direktlink öffnet das Register Vergleich & Nachhaltigkeit');

    await p2.evaluate(`location.hash = '#/app/dataportal/energie-klima?tab=kennzahlen'`);
    await new Promise(r => setTimeout(r, 1200));
    const kz = JSON.parse(await p2.evaluate(`JSON.stringify({
      table: !!document.querySelector('#energie-kz .chart__table--visible table'),
      rows: document.querySelectorAll('#energie-kz tbody tr').length,
      fussnoten: document.querySelectorAll('#energie-kz .chart__footnotes li').length,
    })`));
    check(kz.table && kz.rows >= 5, `Kennzahlen-Tabelle sichtbar (${kz.rows} Zeilen)`);
    check(kz.fussnoten >= 1, `Fussnoten (${kz.fussnoten})`);
    await p2.evaluate(`location.hash = '#/app/dataportal/energie-klima?tab=energiepfad'`);
    await new Promise(r => setTimeout(r, 1200));
    const ar = JSON.parse(await p2.evaluate(`JSON.stringify({
      bands: document.querySelectorAll('#traeger svg path[fill-opacity]').length,
      legende: document.querySelectorAll('#traeger .chart__legend-item').length,
    })`));
    check(ar.bands === 4 && ar.legende === 4, `Flächendiagramm gestapelt (${ar.bands} Bänder, ${ar.legende} Legendeneinträge)`);
    check((await p2.problems()).length === 0, 'Ausbau: keine Fehler');
    await p2.closeTarget();

    // Immobilien: Register «Entwicklung» (Zeitachse, Nutzerwunsch 2026-08-05).
    console.log('■ Immobilienportfolio — Register «Entwicklung»');
    const p3 = await openPage(cdp, `${APP_BASE}/app/dataportal/immobilien?tab=entwicklung`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false }, p3.sessionId);
    await new Promise(r => setTimeout(r, 1800));
    const e = JSON.parse(await p3.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      let n = 0; while (!document.querySelector('#dash-grid svg') && n++ < 80) await s(100);
      return JSON.stringify({
        titel: [...document.querySelectorAll('#dash-grid .chart__title')].map(x => x.textContent),
        sparks: document.querySelectorAll('.kpi__spark').length,
        deltas: [...document.querySelectorAll('.kpi__delta')].map(x => x.textContent.trim()),
        hint: ([...document.querySelectorAll('.kpi__hint')][0] || {}).textContent || '',
        kz: document.querySelectorAll('#e-kz tbody tr').length,
        radios: document.querySelectorAll('#filter-body input[name="e-gran"]').length,
        tabs: [...document.querySelectorAll('.tab__control')].map(x => x.dataset.tab),
        oldGeneric: ['snbs', 'zert', 'portfolio-map'].some(id => !!document.getElementById(id)),
      });
    })()`));
    check(e.titel.includes('Gebäudebestand') && e.titel.includes('Indexierte Entwicklung (Basis 2019 = 100)')
      && e.titel.includes('Auslaufende Verträge je Jahr'), `Zeitachsen-Auswertungen (${e.titel.length})`);
    check(e.sparks >= 3, `Sparklines in den Kacheln (${e.sparks})`);
    check(e.deltas.some(d => /ggü\. Vorjahr/.test(d)), `Vorjahres-Deltas (${e.deltas[0]})`);
    check(/^Stand: /.test(e.hint), `Stichtagszeile («${e.hint}»)`);
    check(e.kz === 8, `Kennzahlen-Tabelle 8 Zeilen (${e.kz})`);
    check(e.radios === 2, 'Körnung Jahres-/Monatsstände wählbar');
    check(JSON.stringify(e.tabs) === JSON.stringify(['gebaeude', 'grundstuecke', 'bodenbedeckung', 'entwicklung'])
      && !e.oldGeneric, 'Immobilien verwendet ausschliesslich den spezialisierten Vier-Register-Renderer');
    const g = JSON.parse(await p3.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      document.querySelector('input[name="e-gran"][value="monat"]').click();
      await s(800);
      return JSON.stringify({ hash: location.hash, dots: document.querySelectorAll('#e-bestand svg circle').length });
    })()`));
    check(/gran=monat/.test(g.hash), 'Körnung steht im Hash');
    check(g.dots >= 24, `Monatsstände gezeichnet (${g.dots} Punkte)`);
    check((await p3.problems()).length === 0, 'Entwicklung: keine Fehler');
    await p3.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
