// Covers catalogue scope, details, lazy BPMN rendering, deep links and integration.
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
    head('Process map');
    let p = await openPage(cdp, `${APP_BASE}/app/process-docs`);
    await sleep(1600);
    let o = JSON.parse(await p.evaluate(`JSON.stringify({
      h1: document.querySelector('h1').textContent.trim(),
      count: document.getElementById('pd-count').textContent.replace(/[\\s\\u00a0]+/g, ' ').trim(),
      branches: document.querySelectorAll('.pf-tree__section:last-child > li').length,
      orgChain: [...document.querySelectorAll('.pf-tree__section:last-child .pf-tree__label')]
        .slice(0, 3).map(x => x.textContent.trim()),
      leaves: [...document.querySelectorAll('.pf-tree__children .pf-tree__children .pf-tree__children .pf-tree__label')].map(x => x.textContent),
      leafCounts: [...document.querySelectorAll('.pf-tree__children .pf-tree__children .pf-tree__children .pf-tree__n')].map(x => Number(x.textContent)),
      rows: document.querySelectorAll('.pf-main tbody tr:not(.table__group):not(.table__subhead)').length,
      boxes: document.querySelectorAll('.lscape__group').length,
      tiles: document.querySelectorAll('.lscape__tile').length,
      cards: document.querySelectorAll('#pd-panel .stats .card').length,
      cardHrefs: [...document.querySelectorAll('#pd-panel .stats .card__link')].map(a => a.getAttribute('href')),
      cardLinkNames: [...document.querySelectorAll('#pd-panel .stats .card__link')].map(a => a.textContent.trim()),
      cardText: [...document.querySelectorAll('#pd-panel .stats .card')].map(card => card.textContent.replace(/\\s+/g, ' ').trim()),
      cardCounts: [...document.querySelectorAll('#pd-panel .stats .card__footer__info strong')]
        .map((count) => Number(count.textContent)),
      branchLabels: [...document.querySelectorAll('.pf-tree__section:last-child > li > .pf-tree__row .pf-tree__label, .pf-tree__section:last-child > li > .pf-tree__split .pf-tree__label')]
        .map(x => x.textContent.trim()).join('|'),
      sections: [...document.querySelectorAll('#pd-panel .detail-section__title')].map(t => t.textContent),
      groupRows: [...document.querySelectorAll('#pd-panel section:last-child tbody tr')]
        .map(row => [...row.cells].map(cell => cell.textContent.replace(/\\s+/g, ' ').trim()).join('|')),
      views: [...document.querySelectorAll('.view-switch__btn')].map(b => b.getAttribute('aria-label')).join('|'),
      cols: [...document.querySelectorAll('.pf-main thead th')].map(t => t.textContent.trim()),
      actionLabels: [...document.querySelectorAll('#pd-tools [data-action]')].map(item => item.textContent.trim()),
    })`));
    check(o.h1 === 'Prozessdokumentation Bauten', 'page title', o.h1);
    check(/27 von 27 Prozessen/.test(o.count), 'the unified root count includes both branches', o.count);
    const rejectsNonBpmn = await p.evaluate(`(async () => {
      const moduleUrl = new URL('js/apps/process-docs.js', document.baseURI).href;
      const { parseBpmnSteps } = await import(moduleUrl);
      try { parseBpmnSteps('<root><process/></root>'); return false; } catch { return true; }
    })()`);
    check(rejectsNonBpmn, 'well-formed non-BPMN XML is rejected before caching');
    const tree = JSON.parse(await p.evaluate(`(async () => {
      location.hash = '/app/process-docs?group=bewirtschaftung';
      await new Promise(r => setTimeout(r, 900));
      const chain = [...document.querySelectorAll('.pf-tree__section:last-child .pf-tree__label')]
        .slice(0, 3).map(x => x.textContent.trim());
      const deep = '.pf-tree__children .pf-tree__children .pf-tree__children ';
      return JSON.stringify({
        chain,
        leaves: [...document.querySelectorAll(deep + '.pf-tree__label')].map(x => x.textContent),
        leafCounts: [...document.querySelectorAll(deep + '.pf-tree__n')].map(x => Number(x.textContent)),
      });
    })()`));
    check(tree.chain.join(' > ') === 'Fachliche Prozesse > BBL Bauten > Immobilienmanagement (K0)',
      'the business branch hangs off the organisation, then the process area',
      tree.chain.join(' > '));
    check(tree.leaves.length === 5, 'five process groups (L2)', tree.leaves.join(', '));
    check(tree.leafCounts.reduce((a, b) => a + b, 0) === 18, 'group counts sum to 18', tree.leafCounts.join('+'));
    check(o.views === '', 'the root offers no view switch: it is the way in, not a scope', o.views || '(keine)');
    check(o.cards === 2 && /Letzte Änderungen/.test(o.sections.join('|')),
      'the root is an overview: one card per branch, plus what changed',
      `${o.cards} Karten · ${o.sections.join(' | ')}`);
    check(o.cardHrefs.some((href) => /branch=fachlich/.test(href))
      && o.cardHrefs.some((href) => /branch=portal/.test(href)),
    'each root card enters its branch scope', o.cardHrefs.join(' | '));
    check(o.cardLinkNames.length === 2
      && o.cardLinkNames.some((name) => /^Fachliche/.test(name))
      && o.cardLinkNames.includes('Kundenportal')
      && o.cardLinkNames.every((name) => !/\d/.test(name))
      && o.cardCounts.join('|') === '18|9'
      && o.cardText.some((text) => /18 Prozesse/.test(text))
      && o.cardText.some((text) => /9 Abläufe/.test(text)),
    'shared cards keep concise branch link names and visible branch facts', o.cardText.join(' | '));
    check(o.actionLabels.includes('Prozessliste als CSV herunterladen')
      && o.actionLabels.includes('Prozessliste als Excel herunterladen'),
    'aggregate exports name the process-list dataset', o.actionLabels.join(' | '));
    check(o.branchLabels === 'Fachliche Prozesse|Kundenportal',
      'and the tree carries both branches', o.branchLabels);
    check(o.groupRows.includes('Bauprojekte und Projektportfolio|1 Prozesse|0')
      && o.groupRows.every((row) => !/\|0 Prozesse\|/.test(row)),
    'root group summaries count records from both branches', o.groupRows.join(' | '));
    const rootSearch = JSON.parse(await p.evaluate(`(async () => {
      location.hash = '/app/process-docs?q=Raumbedarf&view=tabelle';
      await new Promise((resolve) => setTimeout(resolve, 900));
      return JSON.stringify({
        count: document.getElementById('pd-count').textContent.replace(/[\\s\\u00a0]+/g, ' ').trim(),
        rows: document.querySelectorAll('.pf-main tbody tr:not(.table__group):not(.table__subhead)').length,
        cols: [...document.querySelectorAll('.pf-main thead th')].map((cell) => cell.textContent.trim()).join('|'),
        branch: document.querySelector('.pf-main tbody th[scope="row"]')?.textContent.trim() || '',
      });
    })()`));
    check(/1 von 27 Prozessen/.test(rootSearch.count) && rootSearch.rows === 1
      && rootSearch.branch === 'Kundenportal',
    'root search includes portal processes in the shared 27-record universe', JSON.stringify(rootSearch));
    check(rootSearch.cols === 'Zweig|Nr.|Prozess|Prozessgruppe|Status',
      'a mixed-branch list identifies each record branch', rootSearch.cols);
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
    const axisState = JSON.parse(await p.evaluate(`(async () => {
      location.hash = '/app/process-docs?group=bewirtschaftung';
      await new Promise((resolve) => setTimeout(resolve, 700));
      const menu = document.querySelector('[data-menu="pd-group"]');
      menu.querySelector('.action-menu__trigger').click();
      menu.querySelector('[data-action="axis:bereich"]').click();
      await new Promise((resolve) => setTimeout(resolve, 700));
      const fold = document.querySelector('[data-lscape-all]');
      fold.focus();
      fold.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return JSON.stringify({
        hash: location.hash,
        focus: document.activeElement?.dataset?.lscapeAll || '',
      });
    })()`));
    check(/group=bewirtschaftung/.test(axisState.hash) && /axis=bereich/.test(axisState.hash),
      'grouping changes preserve hierarchy scope and explicit axis', axisState.hash);
    check(axisState.focus === 'open',
      'fold-all redraw restores focus to the replacement control', axisState.focus);
    await clean(p, 'process map');

    head('Hierarchy scope (tree → hash without a redundant filter chip)');
    o = JSON.parse(await p.evaluate(`(async () => {
      const a = [...document.querySelectorAll('.pf-tree__children .pf-tree__row')]
        .find(x => /Bewirtschaftung/.test(x.textContent));
      a.click();
      await new Promise(r => setTimeout(r, 800));
      return JSON.stringify({
        hash: location.hash,
        count: document.getElementById('pd-count').textContent.replace(/[\\s\\u00a0]+/g, ' ').trim(),
        chip: (document.querySelector('.active-filter') || {}).textContent,
        active: (document.querySelector('.pf-tree__children :is(.pf-tree__row, .pf-tree__split).is-active .pf-tree__label') || {}).textContent,
      });
    })()`));
    check(/group=bewirtschaftung/.test(o.hash), 'group appears in the hash', o.hash);
    check(/3 von 18/.test(o.count), 'filtered result count', o.count);
    check(!o.chip, 'hierarchy scope is not repeated as an active-filter chip', o.chip || '(none)');
    check(o.active === 'Bewirtschaftung', 'active tree entry', o.active);

    const filteredOverview = JSON.parse(await p.evaluate(`(async () => {
      location.hash = '/app/process-docs?branch=fachlich&view=uebersicht&q=Machbarkeit';
      await new Promise((resolve) => setTimeout(resolve, 900));
      const processTerm = [...document.querySelectorAll('#pd-panel dt')]
        .find((term) => term.textContent.trim() === 'Prozesse');
      return JSON.stringify({
        count: document.getElementById('pd-count').textContent.replace(/[\\s\\u00a0]+/g, ' ').trim(),
        processCount: processTerm?.nextElementSibling?.textContent.trim() || '',
        chips: [...document.querySelectorAll('.active-filter')].map((chip) => ({
          text: chip.textContent.trim(), href: chip.getAttribute('href') || '',
        })),
      });
    })()`));
    check(/1 von 18 Prozessen/.test(filteredOverview.count) && filteredOverview.processCount === '1',
      'aggregate Overview facts describe the same filtered records as the count', JSON.stringify(filteredOverview));
    check(filteredOverview.chips.length === 1
      && /Machbarkeit/.test(filteredOverview.chips[0].text)
      && /branch=fachlich/.test(filteredOverview.chips[0].href),
    'the genuine search chip removes only itself and preserves hierarchy scope', JSON.stringify(filteredOverview.chips));
    const emptyViews = JSON.parse(await p.evaluate(`(async () => {
      const inspect = () => ({
        message: document.querySelector('#pd-panel .empty__title')?.textContent.trim() || '',
        reset: document.querySelector('#pd-panel .empty__action')?.getAttribute('href') || '',
      });
      location.hash = '/app/process-docs?branch=fachlich&view=uebersicht&q=kein-treffer-xyz';
      await new Promise((resolve) => setTimeout(resolve, 700));
      const overview = inspect();
      location.hash = '/app/process-docs?branch=fachlich&q=kein-treffer-xyz';
      await new Promise((resolve) => setTimeout(resolve, 700));
      return JSON.stringify({ overview, diagram: inspect() });
    })()`));
    check(/Kein Prozess gefunden/.test(emptyViews.overview.message)
      && /branch=fachlich/.test(emptyViews.overview.reset) && !/q=/.test(emptyViews.overview.reset),
    'an empty aggregate Overview offers a scope-preserving filter reset', JSON.stringify(emptyViews.overview));
    check(/Kein Prozess gefunden/.test(emptyViews.diagram.message)
      && /branch=fachlich/.test(emptyViews.diagram.reset) && !/q=/.test(emptyViews.diagram.reset),
    'an empty aggregate Diagram uses the same actionable state', JSON.stringify(emptyViews.diagram));
    await clean(p, 'Filter');
    await p.closeTarget();

    head('Detail overview (metadata without BPMN diagram)');
    p = await openPage(cdp, `${APP_BASE}/app/process-docs?id=TQ.21.00.00.02`);
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, p.sessionId);
    o = JSON.parse(await p.evaluate(`(async () => {
      const s = ms => new Promise(r => setTimeout(r, ms));
      await s(600);
      const firstTab = document.querySelector('.tab__control');
      const overview = document.querySelector('#pd-tab-panel-overview');
      const overviewLayout = overview.querySelector(':scope > .detail-layout');
      const overviewMain = overviewLayout.querySelector(':scope > .vertical-spacing');
      const overviewAside = overviewLayout.querySelector(':scope > .detail-layout__aside');
      const overviewKvs = [...overviewMain.querySelectorAll('dl.kv')];
      const initial = {
        h1: document.querySelector('h1').textContent.trim(),
        lead: document.querySelector('.page-header .lead')?.textContent.trim() || '',
        tabs: [...document.querySelectorAll('.tab__control')].map(b => b.textContent.trim()),
        active: document.querySelector('.tab__control[aria-selected="true"]')?.dataset.tab || '',
        visiblePanel: document.querySelector('[role="tabpanel"]:not([hidden])')?.dataset.panel || '',
        panelCount: document.querySelectorAll('[role="tabpanel"]').length,
        tabStops: [...document.querySelectorAll('.tab__control')].filter((tab) => tab.tabIndex === 0).length,
        bpmnHost: !!document.querySelector('#pd-tab-panel-overview #pd-bpmn'),
        toolbar: document.querySelectorAll('#pd-tab-panel-overview [data-bpmn]').length,
        dts: [...overviewMain.querySelectorAll('dl.kv > dt')].map(d => d.textContent),
        sections: [...overviewMain.querySelectorAll(':scope > .detail-section > .detail-section__title')]
          .map(h => h.textContent.trim()),
        directKv: overviewKvs.length > 0 && overviewKvs.every((list) =>
          [...list.children].every((child, index) => child.tagName === (index % 2 ? 'DD' : 'DT'))),
        nestedSubheadings: document.querySelectorAll('#pd-tab-panel-overview .detail-section h3').length,
        admindir: document.querySelectorAll('a[href*="admindir"]').length,
        statusPill: overviewMain.querySelector('dl.kv .badge')?.textContent || '',
        oldStatusText: overviewMain.textContent.includes('Freigegeben und aktiv bewirtschaftet'),
        contactHref: overviewAside.querySelector('a[href^="mailto:"]')?.getAttribute('href') || '',
        contactHeading: overviewAside.querySelector('h2')?.textContent.trim() || '',
        contactUnit: overviewAside.textContent.includes('Direktionsbereich Bauten'),
        mainContactLinks: overviewMain.querySelectorAll('a[href^="mailto:"]').length,
        visibleAsides: document.querySelectorAll('[role="tabpanel"]:not([hidden]) .detail-layout__aside').length,
        redundantChip: !!document.querySelector('.active-filter'),
        detailLayout: !!overviewLayout,
        outerDetailLayout: document.querySelector('.pf-layout')?.classList.contains('pf-layout--detail') || false,
        detailTracks: getComputedStyle(overviewLayout).gridTemplateColumns.trim().split(/\\s+/).length,
        asidePosition: getComputedStyle(overviewAside).position,
        asideWidth: overviewAside.getBoundingClientRect().width,
        actionLabels: [...document.querySelectorAll('#pd-tools [data-action]')].map(item => item.textContent.trim()),
        bpmnRequests: performance.getEntriesByType('resource')
          .filter((entry) => entry.name.includes('TQ.21.00.00.02.bpmn')).length,
      };
      firstTab.focus();
      firstTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
      await s(100);
      const endState = {
        active: document.querySelector('.tab__control[aria-selected="true"]')?.dataset.tab || '',
        panel: document.querySelector('[role="tabpanel"]:not([hidden])')?.dataset.panel || '',
        hash: location.hash,
        focused: document.activeElement?.dataset.tab || '',
      };
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
      await s(100);
      return JSON.stringify({ ...initial, endState,
        restored: document.querySelector('.tab__control[aria-selected="true"]')?.dataset.tab || '',
        restoredHash: location.hash });
    })()`));
    check(o.h1 === 'Machbarkeit Projektdefinition', 'process name is the h1', o.h1);
    check(o.lead === 'Fachliche Prozesse · Akquisition & Planung', 'the header lead gives catalogue context without repeating the description', o.lead);
    check(o.tabs.length === 3 && o.tabs[0] === 'Übersicht' && o.tabs[1] === 'Prozessdiagramm'
      && o.tabs[2] === 'Prozessschritte', 'three contextual tabs', o.tabs.join(' | '));
    check(o.active === 'overview' && o.visiblePanel === 'overview' && o.panelCount === 3 && o.tabStops === 1,
      'overview is the default APG tab and the only visible panel', `${o.active}/${o.visiblePanel}/${o.tabStops}`);
    check(!o.bpmnHost && o.toolbar === 0, 'overview has no diagram');
    check(o.bpmnRequests === 0, 'overview does not fetch or parse BPMN merely to show a count', String(o.bpmnRequests));
    check(o.sections[0] === 'Beschreibung' && o.sections.includes('Einordnung')
      && o.sections.includes('Verantwortung') && !o.sections.includes('Ablauf und Systeme')
      && o.sections.includes('Schlagwörter') && !o.sections.includes('Grundlagen')
      && !o.sections.includes('Führende Quelle') && o.nestedSubheadings === 0,
    'the overview starts with Beschreibung and keeps a stable section hierarchy', o.sections.join(', '));
    check(o.directKv && o.dts.includes('Prozessbereich') && o.dts.includes('Prozessgruppe')
      && o.dts.includes('Status') && o.dts.includes('ID'),
    'classification facts use the shared direct-child kv anatomy', o.dts.join(', '));
    check(o.admindir >= 2, 'responsible people link to AdminDir', String(o.admindir));
    check(/Gültig/.test(o.statusPill), 'status uses a pill tag', o.statusPill);
    check(!o.oldStatusText, 'status has no duplicate description');
    check(o.contactHref === 'mailto:immobilienmanagement@bbl.admin.ch'
      && o.contactHeading === 'Ansprechpersonen' && o.contactUnit && o.mainContactLinks === 0
      && o.visibleAsides === 1,
    'contact is isolated in the Overview aside',
    `${o.contactHeading}/${o.contactHref}/${o.visibleAsides}`);
    check(!o.redundantChip && o.detailLayout && o.outerDetailLayout && o.detailTracks === 2
      && o.asidePosition === 'sticky' && Math.abs(o.asideWidth - 352) <= 1,
    'desktop uses the shared content-plus-22rem contact layout without a repeated record chip',
    `${o.detailTracks}/${o.asidePosition}/${Math.round(o.asideWidth)}px`);
    check(o.actionLabels.includes('Prozessschritte als CSV herunterladen')
      && o.actionLabels.includes('Prozessschritte als Excel herunterladen'),
    'record exports name the deferred process-step dataset', o.actionLabels.join(' | '));
    check(o.endState.active === 'steps' && o.endState.panel === 'steps'
      && o.endState.hash.includes('tab=schritte') && o.endState.focused === 'steps'
      && o.restored === 'overview' && !/[?&]tab=/.test(o.restoredHash),
    'End/Home provide roving keyboard tab navigation and synchronise the URL', JSON.stringify(o.endState));

    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: 320, height: 900, deviceScaleFactor: 1, mobile: false }, p.sessionId);
    await sleep(200);
    const mobile = JSON.parse(await p.evaluate(`(() => {
      const layout = document.querySelector('#pd-tab-panel-overview > .detail-layout');
      const main = layout.querySelector(':scope > .vertical-spacing');
      const aside = layout.querySelector(':scope > .detail-layout__aside');
      return JSON.stringify({
        overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        detailTracks: getComputedStyle(layout).gridTemplateColumns.trim().split(/\\s+/).length,
        kvTracks: getComputedStyle(main.querySelector('dl.kv')).gridTemplateColumns.trim().split(/\\s+/).length,
        contentBeforeAside: main.getBoundingClientRect().bottom <= aside.getBoundingClientRect().top,
        asidePosition: getComputedStyle(aside).position,
        tabsClient: document.querySelector('.tab__controls').clientWidth,
        tabsScroll: document.querySelector('.tab__controls').scrollWidth,
        tabsOverflowMode: getComputedStyle(document.querySelector('.tab__controls')).overflowX,
        mainTop: document.querySelector('.pf-main').getBoundingClientRect().top,
        treeTop: document.querySelector('.pf-sidebar').getBoundingClientRect().top,
      });
    })()`));
    check(mobile.overflow <= 1 && mobile.detailTracks === 1 && mobile.kvTracks === 1
      && mobile.contentBeforeAside && mobile.asidePosition === 'static',
    'the overview stacks its facts before the contact card without overflow at 320px',
    `${mobile.overflow}px / ${mobile.detailTracks}/${mobile.kvTracks}/${mobile.asidePosition}`);
    check(mobile.tabsClient > 0 && mobile.tabsScroll >= mobile.tabsClient
      && mobile.tabsOverflowMode === 'auto',
    'the tab strip remains an internally scrolling keyboard region', JSON.stringify(mobile));
    check(mobile.mainTop <= mobile.treeTop,
      'mobile detail presents record content before the secondary hierarchy rail', `${mobile.mainTop}/${mobile.treeTop}`);
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false }, p.sessionId);
    await sleep(200);
    const transition = JSON.parse(await p.evaluate(`(() => {
      const layout = document.querySelector('#pd-tab-panel-overview > .detail-layout');
      const aside = layout.querySelector(':scope > .detail-layout__aside');
      return JSON.stringify({
        overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        detailTracks: getComputedStyle(layout).gridTemplateColumns.trim().split(/\\s+/).length,
        asidePosition: getComputedStyle(aside).position,
      });
    })()`));
    check(transition.overflow <= 1 && transition.detailTracks === 1 && transition.asidePosition === 'static',
      'the contact rail stays stacked through the 1024px hierarchy transition', JSON.stringify(transition));
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, p.sessionId);

    const search = JSON.parse(await p.evaluate(`(async () => {
      const input = document.querySelector('#pd-q');
      input.value = 'Machbarkeit';
      input.closest('form').requestSubmit();
      for (let i = 0; i < 100 && !location.hash.includes('q=Machbarkeit'); i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      for (let i = 0; i < 100 && document.querySelector('h1')?.textContent.trim() !== 'Prozessdokumentation Bauten'; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return JSON.stringify({ hash: location.hash, h1: document.querySelector('h1')?.textContent.trim() || '' });
    })()`));
    check(/q=Machbarkeit/.test(search.hash) && !/[?&](?:id|def)=/.test(search.hash)
      && search.h1 === 'Prozessdokumentation Bauten',
    'detail search submits to the global process catalogue instead of leaving the hash route', search.hash);
    await clean(p, 'Detail');
    await p.closeTarget();

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
        active: document.querySelector('.tab__control[aria-selected="true"]')?.dataset.tab || '',
        visiblePanel: document.querySelector('[role="tabpanel"]:not([hidden])')?.dataset.panel || '',
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
        visibleAside: !!document.querySelector('[role="tabpanel"]:not([hidden]) .detail-layout__aside'),
        stepLabel: document.querySelector('[data-tab="steps"]')?.textContent.trim() || '',
      });
    })()`));
    check(o.active === 'diagram' && o.visiblePanel === 'diagram', 'diagram tab is active through the deep link', `${o.active}/${o.visiblePanel}`);
    check(o.djs >= 20, 'diagram renders with bpmn-js', `${o.djs} elements`);
    check(!o.loadingLeft, 'loading state is removed');
    check(/Prozessschritte \(\d+\)/.test(o.stepLabel), 'the deferred BPMN load adds the step count to its tab', o.stepLabel);
    check(o.toolbar === 3, 'zoom toolbar has three buttons', String(o.toolbar));
    check(o.tools === 'in|out|reset', 'zoom toolbar includes reset', o.tools);
    check(o.toolbarPosition === 'absolute' && o.toolbarDirection === 'column', 'zoom toolbar is a vertical overlay', `${o.toolbarPosition}/${o.toolbarDirection}`);
    check(o.sharedToolbar, 'viewer uses the shared toolbar anatomy');
    check(o.focusOutline !== 'none' && o.focusOutline !== '', 'viewer tool has a visible focus state', o.focusOutline);
    check(Number(o.disabledOpacity) < 1 && o.disabledCursor === 'not-allowed', 'disabled viewer state is visible', `${o.disabledOpacity}/${o.disabledCursor}`);
    check(!o.visibleAside, 'diagram uses the full panel width without the Overview contact rail');
    await clean(p, 'diagram');

    const nextRecord = JSON.parse(await p.evaluate(`(async () => {
      const current = document.querySelector('h1')?.textContent.trim() || '';
      const link = [...document.querySelectorAll('#pd-tree a[data-node^="proc:"]')]
        .find((candidate) => !candidate.classList.contains('is-active'));
      const href = link?.getAttribute('href') || '';
      link?.click();
      for (let i = 0; i < 120 && document.querySelector('h1')?.textContent.trim() === current; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return JSON.stringify({
        found: !!link,
        href,
        hash: location.hash,
        h1: document.querySelector('h1')?.textContent.trim() || '',
        active: document.querySelector('.tab__control[aria-selected="true"]')?.dataset.tab || '',
        firstSection: document.querySelector('#pd-tab-panel-overview .vertical-spacing > .detail-section h2')
          ?.textContent.trim() || '',
        contactHeading: document.querySelector('#pd-tab-panel-overview .detail-layout__aside h2')
          ?.textContent.trim() || '',
      });
    })()`));
    check(nextRecord.found && nextRecord.h1 !== 'Machbarkeit Projektdefinition'
      && nextRecord.active === 'overview' && !/[?&]tab=/.test(nextRecord.href)
      && !/[?&]tab=/.test(nextRecord.hash) && nextRecord.firstSection === 'Beschreibung'
      && nextRecord.contactHeading === 'Ansprechpersonen',
    'choosing another process starts its information-first Overview instead of carrying the prior tab',
    JSON.stringify(nextRecord));
    await clean(p, 'next process overview');
    await p.closeTarget();

    head('Process-steps tab (?tab=schritte)');
    const want = expectedSteps(new URL('../assets/bpmn/TQ.21.00.00.02.bpmn', import.meta.url));
    p = await openPage(cdp, `${APP_BASE}/app/process-docs?id=TQ.21.00.00.02&tab=schritte`);
    await sleep(1800);
    o = JSON.parse(await p.evaluate(`JSON.stringify({
      active: document.querySelector('.tab__control[aria-selected="true"]')?.textContent.trim() || '',
      cols: [...document.querySelectorAll('#pd-steps thead th')].map(t => t.textContent.trim()),
      count: (document.getElementById('pd-st-count') || {}).textContent.replace(/[\\s\\u00a0]+/g, ' ').trim(),
      rows: document.querySelectorAll('#pd-steps tbody tr').length,
      facets: [...document.querySelectorAll('#pd-steps legend')].map(l => l.textContent.trim()),
      hasLanes: [...document.querySelectorAll('#pd-steps tbody tr')].some(tr => /TQ /.test(tr.textContent)),
      visibleAside: !!document.querySelector('[role="tabpanel"]:not([hidden]) .detail-layout__aside'),
    })`));
    check(/Prozessschritte/.test(o.active || ''), 'tab is active through the deep link', o.active);
    check(o.cols.join('|') === 'Nr.|Schritt|Typ|Rolle', 'step-list columns', o.cols.join('|'));
    check(new RegExp(`${want} von ${want} Schritten`).test(o.count), `step count matches BPMN content (${want})`, o.count);
    check(o.rows === Math.min(want, 15), 'rows on the first page', String(o.rows));
    check(o.facets.includes('Art') && o.facets.includes('Rolle'), 'type and role facets', o.facets.join(', '));
    check(o.hasLanes, 'lanes appear as roles in the rows');
    check(!o.visibleAside, 'the steps tab uses the full panel width without the Overview contact rail');
    await clean(p, 'steps');
    await p.closeTarget();

    head('Portal process through a legacy selector');
    p = await openPage(cdp, `${APP_BASE}/app/process-docs?id=raumbedarf`);
    await sleep(1200);
    await cdp.send('Network.enable', {}, p.sessionId);
    await cdp.send('Network.setBlockedURLs', { urls: ['https://unpkg.com/*'] }, p.sessionId);
    const portal = JSON.parse(await p.evaluate(`(async () => {
      const before = performance.getEntriesByType('resource')
        .filter((entry) => entry.name.includes('portal-raumbedarf.bpmn')).length;
      const overviewLayout = document.querySelector('#pd-tab-panel-overview > .detail-layout');
      const overviewMain = overviewLayout.querySelector(':scope > .vertical-spacing');
      const overviewAside = overviewLayout.querySelector(':scope > .detail-layout__aside');
      const overview = {
        lead: document.querySelector('.page-header .lead')?.textContent.trim() || '',
        sections: [...overviewMain.querySelectorAll(':scope > .detail-section > .detail-section__title')]
          .map((heading) => heading.textContent.trim()),
        factGroups: overviewMain.querySelectorAll(':scope > .detail-section:not(:first-child)').length,
        contactHref: overviewAside.querySelector('a[href^="mailto:"]')?.getAttribute('href') || '',
        contactHeading: overviewAside.querySelector('h2')?.textContent.trim() || '',
        mainContactLinks: overviewMain.querySelectorAll('a[href^="mailto:"]').length,
        visibleAside: !!document.querySelector('[role="tabpanel"]:not([hidden]) .detail-layout__aside'),
        bpmnHost: !!document.querySelector('#pd-tab-panel-overview #pd-bpmn'),
      };
      document.querySelector('[data-tab="diagram"]').click();
      for (let i = 0; i < 120 && !document.querySelector('[data-show-steps]'); i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const after = performance.getEntriesByType('resource')
        .filter((entry) => entry.name.includes('portal-raumbedarf.bpmn')).length;
      const recovery = document.querySelector('[data-show-steps]');
      return JSON.stringify({
        before, after, overview, hash: location.hash,
        h1: document.querySelector('h1').textContent.trim(),
        active: document.querySelector('.tab__control[aria-selected="true"]')?.dataset.tab || '',
        diagramVisibleAside: !!document.querySelector('[role="tabpanel"]:not([hidden]) .detail-layout__aside'),
        recoveryHref: recovery?.getAttribute('href') || '',
      });
    })()`));
    check(portal.h1 === 'Raumbedarf-Antrag', 'record branch comes from data, not selector spelling', portal.h1);
    check(/Kundenportal/.test(portal.overview.lead)
      && portal.overview.sections.includes('Beschreibung')
      && portal.overview.sections.includes('Einordnung')
      && portal.overview.sections.includes('Verantwortung')
      && !portal.overview.sections.includes('Ablauf und Systeme')
      && portal.overview.factGroups >= 2
      && portal.overview.contactHref === 'mailto:immobilienmanagement@bbl.admin.ch'
      && portal.overview.contactHeading === 'Ansprechpersonen'
      && portal.overview.mainContactLinks === 0 && portal.overview.visibleAside
      && !portal.overview.bpmnHost && !portal.diagramVisibleAside,
    'portal and domain records share the same Overview-only contact layout', JSON.stringify(portal.overview));
    check(/def=raumbedarf/.test(portal.hash) && portal.active === 'diagram',
      'tab navigation canonicalises a portal record to its definition selector', portal.hash);
    check(portal.before === 0 && portal.after === 1,
      'the portal overview defers BPMN until Diagram is selected', `${portal.before}/${portal.after}`);
    check(/def=raumbedarf/.test(portal.recoveryHref) && portal.recoveryHref.includes('tab=schritte'),
      'a deterministic viewer failure offers the parsed process steps as recovery', portal.recoveryHref);
    const recovered = JSON.parse(await p.evaluate(`(async () => {
      document.querySelector('[data-show-steps]').click();
      for (let i = 0; i < 120 && !document.querySelector('#pd-steps tbody tr'); i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return JSON.stringify({
        hash: location.hash,
        active: document.querySelector('.tab__control[aria-selected="true"]')?.dataset.tab || '',
        rows: document.querySelectorAll('#pd-steps tbody tr').length,
      });
    })()`));
    check(recovered.active === 'steps' && recovered.rows > 0 && recovered.hash.includes('tab=schritte'),
      'the recovery link opens the accessible step table', JSON.stringify(recovered));
    await clean(p, 'portal recovery');
    await p.closeTarget();

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
