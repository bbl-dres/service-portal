// Datenportal — Analyse-Dashboards über den Kennzahlen des BBL.
//
// Modelled on data.finance.admin.ch (Apache Superset): a landing page of topic
// cards, each opening a dashboard. Every dashboard follows the same pattern — a
// left filter panel (global year range), tabbed views, an optional KPI row and a
// grid of chart cards. The query layer is mocked in js/sql.js; every chart
// declares a query spec, so the «Abfrage anzeigen» panel shows the SQL a real
// Superset dataset would have run. Analysis only: no write-back.

import { sql } from '../sql.js';
import { chart, wireCharts } from '../charts.js';
import { initBuildingsMap } from '../buildings-map.js';

const CRUMB_BASE = [
  { label: 'Startseite', href: '#/' },
  { label: 'Daten und Digitalisierung', href: '#/data' },
];

export default async function render(ctx) {
  const { params } = ctx;
  await sql.load();
  if (params[0]) return dashboardView(ctx, params[0]);
  return overview(ctx);
}

/* ------------------------------------------------------------- overview ---- */
function overview(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  setTitle('Datenportal');
  setCrumbs([...CRUMB_BASE, { label: 'Datenportal' }]);

  const topics = sql.topics();
  const boards = sql.dashboards();

  const topicCard = (t) => {
    const board = boards.find(b => b.topicId === t.id);
    const n = board ? board.charts.length : 0;
    return `<a class="card card--universal card--clickable" href="#/app/dataportal/${encodeURIComponent(t.id)}">
      <div class="card__content"><div class="card__body">
        <span class="domain-tile__icon">${C.icon(t.icon, 'icon--2xl')}</span>
        <div class="card__title">${C.escape(t.title)}</div>
        <p class="card__description">${C.escape(t.desc)}</p>
      </div>
      <div class="card__footer">
        <span>${n} ${n === 1 ? 'Auswertung' : 'Auswertungen'}</span>
        <span class="btn btn--link">Dashboard öffnen ${C.icon('ArrowRight', 'icon--base')}</span>
      </div></div>
    </a>`;
  };

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Datenportal',
      lead: 'Auswertungen zu den Kennzahlen des BBL — Energie und Klima, Immobilienportfolio, Beschaffung, Personal, Logistik und Mobilität.',
    })}
    <div class="grid grid--3 mt-8">${topics.map(topicCard).join('')}</div>
  </div>`;
}

/* --------------------------------------------------------- filter helpers -- */
// Collect the sorted distinct years across every time-series dataset the board
// touches — the domain for the global «Start Zeitreihe / bis Jahr» range filter.
function boardYears(board) {
  const years = new Set();
  for (const c of board.charts) {
    const ds = c.query && sql.dataset(c.query.dataset);
    if (!ds || !(ds.columns || []).some(col => col.name === 'jahr')) continue;
    const idx = ds.columns.findIndex(col => col.name === 'jahr');
    for (const row of ds.rows || []) { const y = Number(row[idx]); if (Number.isFinite(y)) years.add(y); }
  }
  return [...years].sort((a, b) => a - b);
}

// Inject the active year range into a chart's query when its dataset is a time
// series (has a `jahr` column); snapshot/breakdown charts are left untouched.
function withYearRange(spec, from, to) {
  const ds = spec.query && sql.dataset(spec.query.dataset);
  const isTimeSeries = ds && (ds.columns || []).some(col => col.name === 'jahr');
  if (!isTimeSeries || from == null || to == null) return spec;
  return { ...spec, query: { ...spec.query, where: { ...spec.query.where, jahr: { gte: from, lte: to } } } };
}

/* ------------------------------------------------------------ dashboard ---- */
function dashboardView(ctx, id) {
  const { mount, core, C, setTitle, setCrumbs, query } = ctx;
  const board = sql.dashboard(id);
  if (!board) {
    setTitle('Dashboard nicht gefunden');
    setCrumbs([...CRUMB_BASE, { label: 'Datenportal', href: '#/app/dataportal' }]);
    mount.innerHTML = C.notFound({ backHref: '#/app/dataportal', backLabel: 'Datenportal',
      title: 'Dashboard nicht gefunden',
      body: 'Dieses Dashboard existiert nicht. <a href="#/app/dataportal">Zur Übersicht «Datenportal»</a>' });
    return;
  }
  setTitle(board.title);
  setCrumbs([...CRUMB_BASE, { label: 'Datenportal', href: '#/app/dataportal' }, { label: board.title }]);

  const years = boardYears(board);
  const hasYears = years.length > 1;
  const yMin = years[0], yMax = years[years.length - 1];
  const chartById = Object.fromEntries(board.charts.map(c => [c.id, c]));
  const tabs = (board.tabs && board.tabs.length)
    ? board.tabs
    : [{ id: 'ueberblick', label: 'Überblick', charts: board.charts.map(c => c.id) }];
  const buildings = core.buildings();

  // --- filter/tab state (mirrored in the hash query so it is shareable) ---
  const clampY = (v) => { const n = Number(v); return Number.isFinite(n) && years.includes(n) ? n : null; };
  const state = {
    from: clampY(query.get('from')) ?? yMin,
    to: clampY(query.get('to')) ?? yMax,
    tab: tabs.some(t => t.id === query.get('tab')) ? query.get('tab') : tabs[0].id,
  };
  if (state.from > state.to) state.from = state.to;

  const yearOpts = (selected) => years.map(y => `<option value="${y}"${y === selected ? ' selected' : ''}>${y}</option>`).join('');

  const kpiTiles = (board.kpis && board.kpis.length ? board.kpis : (board.hero ? [board.hero] : []))
    .map(k => {
      const value = String(k.value).replace('{buildingCount}', String(buildings.filter(b => Number.isFinite(b.lat)).length));
      return `<div class="kpi">
        <div class="kpi__label">${C.escape(k.label)}</div>
        <div class="kpi__value">${C.escape(value)}${k.unit ? `<span class="kpi__unit">${C.escape(k.unit)}</span>` : ''}</div>
        ${k.deltaLabel ? `<div class="kpi__delta${k.deltaGood ? ' is-good' : ''}">${C.escape(k.deltaLabel)}</div>` : ''}
      </div>`;
    }).join('');

  const filterPanel = `
    <aside class="filter-panel" id="dash-filters" aria-label="Filter">
      <div class="filter-panel__head">
        <h2 class="filter-panel__title">Filter</h2>
        <button type="button" class="filter-panel__toggle btn--bare" id="filter-toggle" aria-label="Filter einklappen" aria-expanded="true">${C.icon('ChevronLeft', 'icon--base')}</button>
      </div>
      <div class="filter-panel__body">
        ${hasYears ? `
          <div class="field" style="margin:0">
            <label for="f-from">Start Zeitreihe</label>
            ${C.selectBox(`<select id="f-from" class="input--outline input--base">${yearOpts(state.from)}</select>`)}
          </div>
          <div class="field" style="margin:.9rem 0 0">
            <label for="f-to">bis Jahr</label>
            ${C.selectBox(`<select id="f-to" class="input--outline input--base">${yearOpts(state.to)}</select>`)}
          </div>
          <button type="button" class="btn btn--bare btn--sm mt-4" id="f-reset">${C.icon('Refresh', 'icon--base')} Zurücksetzen</button>
        ` : '<p class="small muted" style="margin:0">Für dieses Dashboard sind keine Zeitreihen-Filter verfügbar.</p>'}
      </div>
    </aside>`;

  const tabBar = C.tabBar({ items: tabs, active: state.tab, idPrefix: 'dash-tab', panelId: 'dpanel', ariaLabel: 'Dashboard-Ansichten' });

  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/app/dataportal', 'Datenportal')}
    ${C.pageHeader({ title: board.title, lead: board.lead })}
    <p class="meta-info">
      <span class="meta-info__item">Quelle: ${C.escape(board.source)}</span>
      <span class="meta-info__item">Stand: ${C.escape(board.updated)}</span>
      <span class="meta-info__item">Demo-Daten</span>
    </p>
    <div class="dashboard-layout" id="dashboard">
      ${filterPanel}
      <div class="dashboard-main">
        ${tabBar}
        <div class="tab__container" role="tabpanel" id="dpanel" aria-labelledby="dash-tab-${state.tab}" tabindex="0">
          ${kpiTiles ? `<div class="kpi-row">${kpiTiles}</div>` : ''}
          <div class="dash-grid" id="dash-grid"></div>
        </div>
      </div>
    </div>
  </div>`;

  // --- render the chart grid for the active tab + filters ---
  const grid = mount.querySelector('#dash-grid');
  let activeMaps = [];
  function renderGrid() {
    // free WebGL contexts from any map rendered in the previous grid
    activeMaps.forEach(p => p && p.then && p.then(m => m && m.remove()));
    activeMaps = [];
    const tab = tabs.find(t => t.id === state.tab) || tabs[0];
    const specs = tab.charts.map(cid => chartById[cid]).filter(Boolean);
    grid.innerHTML = specs.map(spec => {
      if (spec.form === 'map') {
        return `<figure class="chart card card--universal chart--map" id="${spec.id}">
          <figcaption class="chart__head"><h3 class="chart__title">${C.escape(spec.title)}</h3></figcaption>
          <div class="dash-map" id="map-${spec.id}" role="application" aria-label="Karte der Gebäudestandorte"></div>
          ${spec.note ? `<p class="chart__note">${C.escape(spec.note)}</p>` : ''}
        </figure>`;
      }
      return chart(withYearRange(spec, state.from, state.to), sql.query(withYearRange(spec, state.from, state.to).query));
    }).join('');
    wireCharts(grid);
    // initialise any map in the freshly rendered grid
    specs.filter(s => s.form === 'map').forEach(s => {
      const el = grid.querySelector(`#map-${s.id}`);
      if (el) activeMaps.push(initBuildingsMap(el, buildings));
    });
  }
  renderGrid();

  // --- wiring: filters, tabs, panel collapse ---
  const syncHash = () => {
    const qs = new URLSearchParams();
    if (state.tab !== tabs[0].id) qs.set('tab', state.tab);
    if (hasYears && state.from !== yMin) qs.set('from', state.from);
    if (hasYears && state.to !== yMax) qs.set('to', state.to);
    const s = qs.toString();
    history.replaceState(null, '', `#/app/dataportal/${encodeURIComponent(id)}${s ? '?' + s : ''}`);
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

  const layout = mount.querySelector('#dashboard');
  const toggle = mount.querySelector('#filter-toggle');
  if (toggle) toggle.addEventListener('click', () => {
    const collapsed = layout.classList.toggle('dashboard-layout--collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Filter ausklappen' : 'Filter einklappen');
  });
}
