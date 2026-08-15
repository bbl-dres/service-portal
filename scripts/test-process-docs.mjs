// Process-documentation checks cover the L1/L2 map, catalogue list, overview,
// lazy BPMN diagram, parsed steps, deep links, and catalogue integration. The
// bpmn-js CDN requires network access.
import { readFileSync } from 'node:fs';
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let fail = 0;
const check = (cond, label, detail = '') => {
  console.log(`   ${cond ? '✓' : '✗'} ${label}${detail ? `  (${detail})` : ''}`);
  if (!cond) fail++;
};
const head = (s) => console.log(`■ ${s}`);
const clean = async (p, label) => {
  const errs = await p.problems();
  check(!errs.length, `${label}: no errors`, errs.join(' | '));
};

// Derive expected step count from the same typed BPMN flow elements as the app.
const STEP_TAGS = ['startEvent', 'endEvent', 'intermediateCatchEvent', 'intermediateThrowEvent',
  'boundaryEvent', 'task', 'userTask', 'serviceTask', 'manualTask', 'scriptTask', 'sendTask',
  'receiveTask', 'businessRuleTask', 'callActivity', 'subProcess', 'exclusiveGateway',
  'parallelGateway', 'inclusiveGateway', 'eventBasedGateway', 'complexGateway'];
const expectedSteps = (file) => {
  const xml = readFileSync(file, 'utf8');
  return STEP_TAGS.reduce((n, t) => n + (xml.match(new RegExp(`<bpmn:${t}[ >]`, 'g')) || []).length, 0);
};

(async () => {
  const cdp = await launch();
  try {
    // 1. Process map.
    head('Process map');
    let p = await openPage(cdp, `${APP_BASE}/app/process-docs`);
    await sleep(1600);
    let o = JSON.parse(await p.evaluate(`JSON.stringify({
      h1: document.querySelector('h1').textContent.trim(),
      count: document.getElementById('pd-count').textContent.replace(/[\\s\\u00a0]+/g, ' ').trim(),
      // Seit dem Umzug auf das Seitenbaum-Bauteil (2026-08-14): Aeste sind die
      // Eintraege des Abschnitts, Blaetter stehen in .pf-tree__children.
      // Zwei Abschnitte seit 2026-08-15: die Wurzel «Übersicht» und die
      // Bereiche. Gezaehlt werden die Bereiche.
      branches: document.querySelectorAll('.pf-tree__section:last-child > li').length,
      // Die Karte haengt seit 2026-08-15 an der Organisation: BBL ▸ BBL Bauten ▸
      // Immobilienmanagement (K0) ▸ Prozessgruppen. Die Gruppen liegen damit
      // drei Kinderlisten tief, nicht mehr einer.
      orgChain: [...document.querySelectorAll('.pf-tree__section:last-child .pf-tree__label')]
        .slice(0, 3).map(x => x.textContent.trim()),
      leaves: [...document.querySelectorAll('.pf-tree__children .pf-tree__children .pf-tree__children .pf-tree__label')].map(x => x.textContent),
      leafCounts: [...document.querySelectorAll('.pf-tree__children .pf-tree__children .pf-tree__children .pf-tree__n')].map(x => Number(x.textContent)),
      rows: document.querySelectorAll('.pf-main tbody tr:not(.table__group):not(.table__subhead)').length,
      // Seit 2026-08-14 hat die Prozessdoku dieselben drei Sichten wie die
      // Geschaeftsarchitektur, und das Diagramm ist die Voreinstellung.
      boxes: document.querySelectorAll('.lscape__group').length,
      tiles: document.querySelectorAll('.lscape__tile').length,
      cards: document.querySelectorAll('#pd-panel .stats .card').length,
      sections: [...document.querySelectorAll('#pd-panel .detail-section__title')].map(t => t.textContent),
      views: [...document.querySelectorAll('.view-switch__btn')].map(b => b.getAttribute('aria-label')).join('|'),
      cols: [...document.querySelectorAll('.pf-main thead th')].map(t => t.textContent.trim()),
    })`));
    check(o.h1 === 'Prozessdokumentation Bauten', 'page title', o.h1);
    check(/18 von 18 Prozessen/.test(o.count), 'result count is 18', o.count);
    check(o.orgChain.join(' > ') === 'BBL > BBL Bauten > Immobilienmanagement (K0)',
      'the map hangs off the organisation: BBL, BBL Bauten, then the process area',
      o.orgChain.join(' > '));
    check(o.leaves.length === 5, 'five process groups (L2)', o.leaves.join(', '));
    check(o.leafCounts.reduce((a, b) => a + b, 0) === 18, 'group counts sum to 18', o.leafCounts.join('+'));
    // Die Wurzel ist kein Umfang, sondern der Weg hinein — wie im Katalog auf
    // Stufe 0: keine Ansichtswahl, sondern eine Einstiegsseite.
    check(o.views === '', 'the root offers no view switch: it is the way in, not a scope', o.views || '(keine)');
    check(o.cards === 5 && /Letzte Änderungen/.test(o.sections.join('|')),
      'the root is an overview: one card per process group, plus what changed',
      `${o.cards} Karten · ${o.sections.join(' | ')}`);
    // Die Tabelle liegt einen Klick daneben und teilt sich nach derselben Achse.
    // Ein Umfang, dann die Sichten: erst dort gibt es etwas zu wechseln.
    const tbl = JSON.parse(await p.evaluate(`(async () => {
      location.hash = '/app/process-docs?group=bewirtschaftung';
      await new Promise(r => setTimeout(r, 900));
      const views = [...document.querySelectorAll('.view-switch__btn')].map(b => b.getAttribute('aria-label')).join('|');
      const boxes = document.querySelectorAll('.lscape__group').length;
      document.querySelector('#view-tabelle').click();
      await new Promise(r => setTimeout(r, 700));
      return JSON.stringify({
        views, boxes,
        rows: document.querySelectorAll('.pf-main tbody tr:not(.table__group):not(.table__subhead)').length,
        cols: [...document.querySelectorAll('.pf-main thead th')].map(t => t.textContent.trim()).join('|'),
      });
    })()`));
    check(tbl.views === 'Übersicht|Diagramm|Tabelle',
      'a scope offers the same three views as the architecture catalogue', tbl.views);
    check(tbl.boxes >= 1, 'and opens on the diagram', `${tbl.boxes} Kaesten`);
    check(tbl.rows === 3, 'the table lists every process in scope', String(tbl.rows));
    check(tbl.cols === 'Nr.|Prozess|Prozessgruppe|Status', 'list-view columns', tbl.cols);
    await clean(p, 'process map');

    // 2. Group filter through the tree.
    head('Group filter (tree → hash → chip)');
    o = JSON.parse(await p.evaluate(`(async () => {
      const a = [...document.querySelectorAll('.pf-tree__children .pf-tree__row')]
        .find(x => /Bewirtschaftung/.test(x.textContent));
      a.click();
      await new Promise(r => setTimeout(r, 800));
      return JSON.stringify({
        hash: location.hash,
        count: document.getElementById('pd-count').textContent.replace(/[\\s\\u00a0]+/g, ' ').trim(),
        chip: (document.querySelector('.active-filter') || {}).textContent,
        // Die Gruppe ist seit der dritten Stufe eine GETEILTE Zeile: die Markierung
        // sitzt dann auf der Huelle, nicht auf der Zeile darin.
        active: (document.querySelector('.pf-tree__children :is(.pf-tree__row, .pf-tree__split).is-active .pf-tree__label') || {}).textContent,
      });
    })()`));
    check(/group=bewirtschaftung/.test(o.hash), 'group appears in the hash', o.hash);
    check(/3 von 18/.test(o.count), 'filtered result count', o.count);
    check(/Bewirtschaftung/.test(o.chip || ''), 'filter chip', o.chip);
    check(o.active === 'Bewirtschaftung', 'active tree entry', o.active);
    await clean(p, 'Filter');
    await p.closeTarget();

    // 3. Process overview without the diagram.
    head('Detail overview (metadata without BPMN diagram)');
    p = await openPage(cdp, `${APP_BASE}/app/process-docs?id=TQ.21.00.00.02`);
    o = JSON.parse(await p.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      await s(600);
      return JSON.stringify({
        h1: document.querySelector('h1').textContent.trim(),
        // Seit 2026-08-15 liegt die Prozessansicht auf derselben Flaeche wie die
        // Liste: Ansichtswechsel (.view-switch) statt Reiterband.
        tabs: [...document.querySelectorAll('.view-switch__btn')].map(b => b.getAttribute('aria-label')),
        active: (document.querySelector('.view-switch__btn[aria-pressed="true"]') || {}).dataset?.view || '',
        bpmnHost: !!document.querySelector('#pd-tab-panel-overview #pd-bpmn'),
        toolbar: document.querySelectorAll('#pd-tab-panel-overview [data-bpmn]').length,
        dts: [...document.querySelectorAll('.detail-layout dl.kv--ruled dt')].map(d => d.textContent),
        admindir: document.querySelectorAll('a[href*="admindir"]').length,
        statusPill: (document.querySelector('.detail-layout dl.kv--ruled .badge') || {}).textContent || '',
        oldStatusText: document.querySelector('.detail-layout dl.kv--ruled')?.textContent.includes('Freigegeben und aktiv bewirtschaftet') || false,
        contactCard: !!document.querySelector('.detail-layout__aside .box'),
      });
    })()`));
    check(o.h1 === 'Machbarkeit Projektdefinition', 'process name is the h1', o.h1);
    check(o.tabs.length === 3 && o.tabs[0] === 'Übersicht' && o.tabs[1] === 'Diagramm', 'three views', o.tabs.join(' | '));
    check(/Prozessschritte \(\d+\)/.test(o.tabs[2] || ''), 'step count appears in the tab label', o.tabs[2]);
    check(o.active === 'uebersicht', 'overview is the default view', o.active);
    check(!o.bpmnHost && o.toolbar === 0, 'overview has no diagram');
    check(o.dts.includes('Prozessbereich') && o.dts.includes('Prozessgruppe') && o.dts.includes('Status') && o.dts.includes('ID'),
      'Metadaten-Zeilen', o.dts.join(', '));
    check(o.admindir >= 2, 'responsible people link to AdminDir', String(o.admindir));
    check(/Gültig/.test(o.statusPill), 'status uses a pill tag', o.statusPill);
    check(!o.oldStatusText, 'status has no duplicate description');
    check(o.contactCard, 'contact card appears in the aside');
    await clean(p, 'Detail');
    await p.closeTarget();

    // 4. Diagram tab through a deep link.
    head('Process-diagram tab (?tab=diagramm)');
    p = await openPage(cdp, `${APP_BASE}/app/process-docs?id=TQ.21.00.00.02&tab=diagramm`);
    o = JSON.parse(await p.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      let n = 0; while (!document.querySelector('#pd-bpmn svg .djs-element') && n++ < 200) await s(100);
      await s(300);
      const firstTool = document.querySelector('#pd-panel [data-bpmn]');
      firstTool?.focus();
      const focusOutline = firstTool ? getComputedStyle(firstTool).outlineStyle : '';
      if (firstTool) firstTool.disabled = true;
      const disabledOpacity = firstTool ? getComputedStyle(firstTool).opacity : '';
      const disabledCursor = firstTool ? getComputedStyle(firstTool).cursor : '';
      if (firstTool) firstTool.disabled = false;
      return JSON.stringify({
        active: (document.querySelector('.view-switch__btn[aria-pressed="true"]') || {}).dataset?.view || '',
        djs: document.querySelectorAll('#pd-bpmn .djs-element').length,
        loadingLeft: !!document.querySelector('#pd-bpmn .loading'),
        toolbar: document.querySelectorAll('#pd-panel [data-bpmn]').length,
        tools: [...document.querySelectorAll('#pd-panel [data-bpmn]')].map(b => b.dataset.bpmn).join('|'),
        toolbarPosition: getComputedStyle(document.querySelector('#pd-panel .bpmn-toolbar')).position,
        toolbarDirection: getComputedStyle(document.querySelector('#pd-panel .bpmn-toolbar')).flexDirection,
        sharedToolbar: !!document.querySelector('#pd-panel .viewer-toolbar--vertical .viewer-toolbar__button'),
        focusOutline,
        disabledOpacity,
        disabledCursor,
        asideInPanel: !!document.querySelector('#pd-panel .detail-layout__aside'),
      });
    })()`));
    check(o.active === 'diagramm', 'diagram view is active through the deep link', o.active);
    check(o.djs >= 20, 'diagram renders with bpmn-js', `${o.djs} elements`);
    check(!o.loadingLeft, 'loading state is removed');
    check(o.toolbar === 3, 'zoom toolbar has three buttons', String(o.toolbar));
    check(o.tools === 'in|out|reset', 'zoom toolbar includes reset', o.tools);
    check(o.toolbarPosition === 'absolute' && o.toolbarDirection === 'column', 'zoom toolbar is a vertical overlay', `${o.toolbarPosition}/${o.toolbarDirection}`);
    check(o.sharedToolbar, 'viewer uses the shared toolbar anatomy');
    check(o.focusOutline !== 'none' && o.focusOutline !== '', 'viewer tool has a visible focus state', o.focusOutline);
    check(Number(o.disabledOpacity) < 1 && o.disabledCursor === 'not-allowed', 'disabled viewer state is visible', `${o.disabledOpacity}/${o.disabledCursor}`);
    check(!o.asideInPanel, 'diagram uses the full panel width');
    await clean(p, 'diagram');
    await p.closeTarget();

    // 5. Process-steps tab through a deep link.
    head('Process-steps tab (?tab=schritte)');
    const want = expectedSteps(new URL('../assets/bpmn/TQ.21.00.00.02.bpmn', import.meta.url));
    p = await openPage(cdp, `${APP_BASE}/app/process-docs?id=TQ.21.00.00.02&tab=schritte`);
    await sleep(1800);
    o = JSON.parse(await p.evaluate(`JSON.stringify({
      active: (document.querySelector('.view-switch__btn[aria-pressed="true"]') || {}).getAttribute('aria-label'),
      cols: [...document.querySelectorAll('#pd-steps thead th')].map(t => t.textContent.trim()),
      count: (document.getElementById('pd-st-count') || {}).textContent.replace(/[\\s\\u00a0]+/g, ' ').trim(),
      rows: document.querySelectorAll('#pd-steps tbody tr').length,
      facets: [...document.querySelectorAll('#pd-steps legend')].map(l => l.textContent.trim()),
      hasLanes: [...document.querySelectorAll('#pd-steps tbody tr')].some(tr => /TQ /.test(tr.textContent)),
    })`));
    check(/Prozessschritte/.test(o.active || ''), 'tab is active through the deep link', o.active);
    check(o.cols.join('|') === 'Nr.|Schritt|Typ|Rolle', 'step-list columns', o.cols.join('|'));
    check(new RegExp(`${want} von ${want} Schritten`).test(o.count), `step count matches BPMN content (${want})`, o.count);
    check(o.rows === Math.min(want, 15), 'rows on the first page', String(o.rows));
    check(o.facets.includes('Art') && o.facets.includes('Rolle'), 'type and role facets', o.facets.join(', '));
    check(o.hasLanes, 'lanes appear as roles in the rows');
    await clean(p, 'steps');
    await p.closeTarget();

    // 6. Unknown identifier.
    head('Unknown identifier');
    p = await openPage(cdp, `${APP_BASE}/app/process-docs?id=GIBTS-NICHT`);
    await sleep(1200);
    o = JSON.parse(await p.evaluate(`JSON.stringify({
      h1: document.querySelector('h1').textContent.trim(),
      backLink: !!document.querySelector('a[href="#/app/process-docs"]'),
    })`));
    check(/nicht gefunden/.test(o.h1), 'renderNotFound', o.h1);
    check(o.backLink, 'back link returns to the process map');
    await clean(p, 'NotFound');
    await p.closeTarget();

    // 7. Application-catalogue and data-overview integration.
    head('Integration (landing page and data overview)');
    p = await openPage(cdp, `${APP_BASE}/applications/prozessdokumentation`);
    await sleep(1400);
    o = JSON.parse(await p.evaluate(`JSON.stringify({
      h1: document.querySelector('h1').textContent.trim(),
      entryLink: !!document.querySelector('a[href="#/app/process-docs"]'),
    })`));
    check(o.h1 === 'Prozessdokumentation Bauten (Portal)', 'application landing page', o.h1);
    check(o.entryLink, 'entry link opens the app');
    await clean(p, 'landing page');
    await p.evaluate(`location.hash = '#/data'`);
    await sleep(1200);
    o = JSON.parse(await p.evaluate(`JSON.stringify({
      tile: [...document.querySelectorAll('a')].some(a => /Prozessdokumentation Bauten/.test(a.textContent)),
    })`));
    check(o.tile, 'tile appears on the data overview');
    await clean(p, 'data overview');
    await p.closeTarget();
  } finally {
    cdp.close();
  }
  console.log(`\n${fail ? `✗ ${fail} check(s) FAILED` : '✓ all checks passed'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
