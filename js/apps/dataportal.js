// Datenportal — Analyse-Dashboards über den Kennzahlen des BBL.
//
// Modelled on data.finance.admin.ch (Apache Superset): a landing page of topic
// cards, each opening a dashboard. Every dashboard follows the same pattern — a
// left filter panel (global year range), tabbed views, an optional KPI row and a
// grid of chart cards. Data comes only from data/dashboards.json (js/dashboard-
// data.js): every chart declares a query spec that is evaluated in memory over
// the JSON datasets. Analysis only: no write-back.
//
// Kopf, KPI-Kacheln, Filterpanel-Hülle, Einklapp-Logik, Toolbar-Menü und
// Fusszeile kommen aus js/dashboard-chrome.js (eine Quelle für beide Boards,
// Design-Review A4); hier bleibt nur die Daten- und Chart-Logik.

import { dashData } from '../dashboard-data.js';
import { chart, wireCharts, wireChartMenus, paintCharts } from '../charts.js';
import { kpiTile, dashHeader, filterPanelShell, dashFooter, wireFilterCollapse, wireDashboardMenu } from '../dashboard-chrome.js';
import { DATEN } from '../crumbs.js';

export default async function render(ctx) {
  const { params } = ctx;
  // Immobilienportfolio ist ein record-basiertes Stammdaten-Dashboard (eigene
  // GeoJSON-Quellen + Laufzeit-Aggregation) — an das dedizierte Modul delegieren.
  if (params[0] === 'immobilien') {
    const mod = await import('./estate.js');
    if (ctx.stale && ctx.stale()) return;   // A2: überholte Navigation nicht überschreiben
    return mod.default(ctx);
  }
  await dashData.load();
  if (ctx.stale && ctx.stale()) return;
  // Ohne die Datei bliebe ein leeres Portal stehen, das von einem ungefüllten
  // nicht zu unterscheiden wäre (M18) — hier stattdessen der Ladefehler.
  if (!dashData.ok()) {
    const { mount, C, setTitle, setCrumbs } = ctx;
    setTitle('Datenportal');
    setCrumbs([...DATEN, { label: 'Datenportal' }]);
    mount.innerHTML = `<div class="container section">${C.notification(
      '<strong>Die Auswertungen konnten nicht geladen werden.</strong> '
      + 'Das ist ein Ladefehler, kein leeres Portal. '
      + '<button type="button" class="link" onclick="location.reload()">Seite neu laden</button>',
      'error', 'WarningCircle')}</div>`;
    return;
  }
  if (params[0]) return dashboardView(ctx, params[0]);
  return overview(ctx);
}

/* ------------------------------------------------------------- overview ---- */
function overview(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  setTitle('Datenportal');
  setCrumbs([...DATEN, { label: 'Datenportal' }]);

  const topics = dashData.topics();
  const boards = dashData.dashboards();

  const topicCard = (t) => {
    const board = boards.find(b => b.topicId === t.id);
    const n = board ? board.charts.length : 0;
    // Dieselbe Icon-Kachel wie in Daten/Wissen/Digitalisierung (C.domainTile):
    // echte <h3> für die Gliederung, CD-Kartenfuss, und bildlose Karten sind
    // card--default (nicht --universal, das ist die Letterbox-Bildvariante).
    // `t.meta` überschreibt die Zählzeile — das Immobilien-Board rechnet seine
    // Auswertungen zur Laufzeit (estate.js), die JSON-Zahl wäre falsch.
    return C.domainTile({
      icon: t.icon, title: t.title, desc: t.desc,
      meta: t.meta || `${n} ${n === 1 ? 'Auswertung' : 'Auswertungen'}`,
      href: `#/app/dataportal/${encodeURIComponent(t.id)}`,
    });
  };

  mount.innerHTML = `
  <div class="container section">
    ${/* Der Hinweis auf das MIS stand als eigener Kleintext-Absatz unter dem
          Lead. Er beantwortet aber dieselbe Frage wie der Lead — «wofür ist das
          hier zuständig, und wofür nicht» — und gehört deshalb in denselben
          Absatz. */''}
    ${C.pageHeader({
      title: 'Datenportal',
      leadHtml: 'Auswertungen zu den Kennzahlen des BBL — Energie und Klima, Immobilienportfolio, Bauprojekte und Investitionen, Beschaffung, Logistik, Mobilität und Personal. '
        + 'Behördenübergreifende Kennzahlen und Auswertungen bietet das Management-Informationssystem (MIS) der Bundesverwaltung — aufgebaut im '
        + '<a href="https://www.bbl.admin.ch/de/programm-superb" target="_blank" rel="noopener external">Programm SUPERB</a> (SAP S/4HANA).',
    })}
    <h2 class="sr-only">Themen</h2>
    <div class="grid grid--responsive-cols-3 mt-8">${topics.map(topicCard).join('')}</div>
  </div>`;
}

/* --------------------------------------------------------- filter helpers -- */
// Collect the sorted distinct years across every time-series dataset the board
// touches — the domain for the global «Start Zeitreihe / bis Jahr» range filter.
function boardYears(board) {
  const years = new Set();
  for (const c of board.charts) {
    const ds = c.query && dashData.dataset(c.query.dataset);
    if (!ds || !(ds.columns || []).some(col => col.name === 'jahr')) continue;
    const idx = ds.columns.findIndex(col => col.name === 'jahr');
    for (const row of ds.rows || []) { const y = Number(row[idx]); if (Number.isFinite(y)) years.add(y); }
  }
  return [...years].sort((a, b) => a - b);
}

// Inject the active year range into a chart's query when its dataset is a time
// series (has a `jahr` column); snapshot/breakdown charts are left untouched.
function withYearRange(spec, from, to) {
  const ds = spec.query && dashData.dataset(spec.query.dataset);
  const isTimeSeries = ds && (ds.columns || []).some(col => col.name === 'jahr');
  if (!isTimeSeries || from == null || to == null) return spec;
  return { ...spec, query: { ...spec.query, where: { ...spec.query.where, jahr: { gte: from, lte: to } } } };
}

/* ------------------------------------------------------------ dashboard ---- */
function dashboardView(ctx, id) {
  const { mount, C, setTitle, setCrumbs, query } = ctx;
  const board = dashData.dashboard(id);
  if (!board) {
    C.renderNotFound(ctx, { thing: 'Dieses Dashboard', title: 'Dashboard nicht gefunden',
      backHref: '#/app/dataportal', backLabel: 'Datenportal',
      crumbs: [...DATEN, { label: 'Datenportal', href: '#/app/dataportal' }] });
    return;
  }
  setTitle(board.title);
  setCrumbs([...DATEN, { label: 'Datenportal', href: '#/app/dataportal' }, { label: board.title }]);

  const years = boardYears(board);
  const hasYears = years.length > 1;
  const yMin = years[0], yMax = years[years.length - 1];
  const chartById = Object.fromEntries(board.charts.map(c => [c.id, c]));
  const tabs = (board.tabs && board.tabs.length)
    ? board.tabs
    : [{ id: 'overview', label: 'Überblick', charts: board.charts.map(c => c.id) }];

  // --- filter/tab state (mirrored in the hash query so it is shareable) ---
  const clampY = (v) => { const n = Number(v); return Number.isFinite(n) && years.includes(n) ? n : null; };
  const state = {
    from: clampY(query.get('from')) ?? yMin,
    to: clampY(query.get('to')) ?? yMax,
    tab: tabs.some(t => t.id === query.get('tab')) ? query.get('tab') : tabs[0].id,
  };
  if (state.from > state.to) state.from = state.to;

  const yearOpts = (selected) => years.map(y => `<option value="${y}"${y === selected ? ' selected' : ''}>${y}</option>`).join('');

  // Kachel-Markup aus dashboard-chrome.kpiTile; jedes generische Dashboard
  // deklariert seine Kennzahlen in genau einer Datenform (`kpis`).
  const kpiTiles = (board.kpis || [])
    .map(k => kpiTile(C, {
      label: k.label,
      value: String(k.value),
      unit: k.unit, deltaLabel: k.deltaLabel, deltaGood: k.deltaGood,
    })).join('');

  // Hülle aus dashboard-chrome.filterPanelShell; der Body (Jahres-Selects +
  // Panel-Reset) bleibt board-eigen.
  const filterPanel = filterPanelShell(C, hasYears ? `
        <div class="field m-0">
          <label for="f-from">Start Zeitreihe</label>
          ${C.selectBox(`<select id="f-from" class="input--outline input--base">${yearOpts(state.from)}</select>`)}
        </div>
        <div class="field mt-4">
          <label for="f-to">bis Jahr</label>
          ${C.selectBox(`<select id="f-to" class="input--outline input--base">${yearOpts(state.to)}</select>`)}
        </div>
        ${C.panelReset({ id: 'f-reset', wrap: 'filter-panel__actions' })}
      ` : '<p class="small muted m-0">Für dieses Dashboard sind keine Zeitreihen-Filter verfügbar.</p>');

  const tabBar = C.tabBar({ items: tabs, active: state.tab, idPrefix: 'dash-tab', panelId: 'dpanel', ariaLabel: 'Dashboard-Ansichten' });

  mount.innerHTML = `
  <div class="container section dash-page">
    ${C.backLink('#/app/dataportal', 'Datenportal')}
    ${dashHeader(C, { title: board.title, lead: board.lead })}
    <div class="dashboard-layout" id="dashboard">
      ${filterPanel}
      <div class="dashboard-main">
        ${tabBar}
        <div class="tab__container" role="tabpanel" id="dpanel" aria-labelledby="dash-tab-${state.tab}" tabindex="0">
          ${kpiTiles ? `<h2 class="sr-only">Kennzahlen</h2><div class="kpi-row">${kpiTiles}</div>` : ''}
          <h2 class="sr-only">Auswertungen</h2><div class="dash-grid" id="dash-grid"></div>
        </div>
      </div>
    </div>
    ${dashFooter(C, { source: board.source, updated: board.updated })}
  </div>`;

  // --- render the chart grid for the active tab + filters ---
  let grid = mount.querySelector('#dash-grid');
  // Aufräumfunktion des ResizeObserver aus paintCharts — MUSS vor jedem
  // Neuzeichnen aufgerufen werden, sonst sammeln sich Observer an.
  let unpaint = null;
  const freeGridResources = () => {
    if (unpaint) { unpaint(); unpaint = null; }
  };
  ctx.onUnmount(freeGridResources);

  function renderGrid() {
    freeGridResources();
    // wireCharts/wireChartMenus verdrahten delegiert auf der Grid-Wurzel und
    // liefern keinen Destructor. Ein frischer Knoten je Durchgang gibt diese
    // Listener zusammen mit den alten Diagrammen frei, statt sie anzuhäufen.
    const nextGrid = grid.cloneNode(false);
    grid.replaceWith(nextGrid);
    grid = nextGrid;
    const tab = tabs.find(t => t.id === state.tab) || tabs[0];
    const specs = tab.charts.map(cid => chartById[cid]).filter(Boolean);
    grid.innerHTML = specs.map(spec => {
      // withYearRange EINMAL berechnen (vorher zweimal pro Chart, code-review G2)
      const ranged = withYearRange(spec, state.from, state.to);
      return chart(ranged, dashData.query(ranged.query));
    }).join('');
    // Zweiter, SYNCHRONER Durchgang: erst jetzt stehen die Karten im Layout und
    // haben eine messbare Breite (Item 6.1). Synchron, damit Tests, die auf ein
    // gerendertes SVG pollen, es unmittelbar vorfinden.
    unpaint = paintCharts(grid, (id) => {
      const spec = chartById[id];
      if (!spec) return null;
      const ranged = withYearRange(spec, state.from, state.to);
      return { spec: ranged, result: dashData.query(ranged.query) };
    });
    wireCharts(grid);
    wireChartMenus(grid);   // per-chart action menu (re-wired each render)
  }
  renderGrid();

  // --- wiring: filters, tabs, panel collapse ---
  const syncHash = () => {
    const qs = new URLSearchParams();
    if (state.tab !== tabs[0].id) qs.set('tab', state.tab);
    if (hasYears && state.from !== yMin) qs.set('from', state.from);
    if (hasYears && state.to !== yMax) qs.set('to', state.to);
    const s = qs.toString();
    history.replaceState(history.state, '', `#/app/dataportal/${encodeURIComponent(id)}${s ? '?' + s : ''}`);
  };

  const fromSel = mount.querySelector('#f-from');
  const toSel = mount.querySelector('#f-to');
  const clampRange = () => { if (state.from > state.to) { if (document.activeElement === fromSel) state.to = state.from; else state.from = state.to; fromSel.value = state.from; toSel.value = state.to; } };
  if (fromSel) fromSel.addEventListener('change', () => { state.from = Number(fromSel.value); clampRange(); syncHash(); renderGrid(); });
  if (toSel) toSel.addEventListener('change', () => { state.to = Number(toSel.value); clampRange(); syncHash(); renderGrid(); });
  const reset = mount.querySelector('#f-reset');
  if (reset) reset.addEventListener('click', () => { state.from = yMin; state.to = yMax; fromSel.value = yMin; toSel.value = yMax; syncHash(); renderGrid(); });

  // Tab-Wechsel via C.wireTabs; onSelect setzt den Zustand + rendert das Chart-
  // Grid neu, syncHash spiegelt Tab/Zeitraum in die Hash-Query (die aria-
  // labelledby-Pflege des Einzel-Panels übernimmt wireTabs).
  C.wireTabs(mount, {
    onSelect: (id) => { state.tab = id; renderGrid(); },
    syncHash,
  });

  // Einklapp-Logik (Item 6.13) + Toolbar-Menü: geteilt in dashboard-chrome.js.
  wireFilterCollapse(ctx, mount);
  wireDashboardMenu(mount, C, { title: board.title, onRefresh: renderGrid });
}
