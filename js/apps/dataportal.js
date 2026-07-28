// Datenportal — Analyse-Dashboards über den Kennzahlen des BBL.
//
// Modelled on data.finance.admin.ch (Apache Superset): a landing page of topic
// cards, each opening a dashboard. Every dashboard follows the same pattern — a
// left filter panel (global year range), tabbed views, an optional KPI row and a
// grid of chart cards. Data comes only from data/dashboards.json (js/dashboard-
// data.js): every chart declares a query spec that is evaluated in memory over
// the JSON datasets. Analysis only: no write-back.

import { dashData } from '../dashboard-data.js';
import { chart, wireCharts, wireChartMenus, paintCharts } from '../charts.js';
import { initBuildingsMap } from '../buildings-map.js';
import { copyText, shareMail } from '../export.js';

const CRUMB_BASE = [
  { label: 'Startseite', href: '#/' },
  { label: 'Daten und Digitalisierung', href: '#/data' },
];

// Dashboard-Toolbar (Superset-Muster). Aktionen in wireMenu unten. Ganzes-
// Dashboard-Export (PDF/Bild) bleibt eine simulierte Affordanz (bräuchte einen
// Rasterisierer); Aktualisieren/Teilen sind echt.
const DASHBOARD_MENU = [
  { action: 'refresh', label: 'Dashboard aktualisieren' },
  { separator: true },
  { heading: 'Herunterladen' },
  { action: 'pdf', label: 'Als PDF' },
  { action: 'img', label: 'Als Bild' },
  { separator: true },
  { heading: 'Teilen' },
  { action: 'copy', label: 'Link kopieren' },
  { action: 'mail', label: 'Per E-Mail' },
];

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
    setCrumbs([...CRUMB_BASE, { label: 'Datenportal' }]);
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
  setCrumbs([...CRUMB_BASE, { label: 'Datenportal' }]);

  const topics = dashData.topics();
  const boards = dashData.dashboards();

  const topicCard = (t) => {
    const board = boards.find(b => b.topicId === t.id);
    const n = board ? board.charts.length : 0;
    // Dieselbe Icon-Kachel wie in Daten/Wissen/Digitalisierung (C.domainTile):
    // echte <h3> für die Gliederung, CD-Kartenfuss, und bildlose Karten sind
    // card--default (nicht --universal, das ist die Letterbox-Bildvariante).
    return C.domainTile({
      icon: t.icon, title: t.title, desc: t.desc,
      meta: `${n} ${n === 1 ? 'Auswertung' : 'Auswertungen'}`,
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
      leadHtml: 'Auswertungen zu den Kennzahlen des BBL — Energie und Klima, Immobilienportfolio, Beschaffung, Personal, Logistik und Mobilität. '
        + 'Behördenübergreifende Kennzahlen und Auswertungen bietet das Management-Informationssystem (MIS) der Bundesverwaltung — aufgebaut im '
        + '<a href="https://www.bbl.admin.ch/de/programm-superb" target="_blank" rel="noopener external">Programm SUPERB</a> (SAP S/4HANA).',
    })}
    <h2 class="sr-only">Themen</h2>
    <div class="grid grid--3 mt-8">${topics.map(topicCard).join('')}</div>
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
  const { mount, core, C, setTitle, setCrumbs, query } = ctx;
  const board = dashData.dashboard(id);
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
        ${k.deltaLabel ? `<div class="kpi__delta${k.deltaGood === true ? ' is-good' : k.deltaGood === false ? ' is-bad' : ''}">${
          // Richtung nicht nur über Farbe (WCAG 1.4.1, Item 6.11): Pfeilglyph für
          // Sehende, sr-only-Wort für Hilfsmittel. `deltaGood` undefined = neutral
          // (z. B. ein Zielwert), der dann auch nicht wie ein Erfolg aussieht.
          k.deltaGood === undefined ? ''
            : `<span class="kpi__arrow" aria-hidden="true">${k.deltaGood ? '▲' : '▼'}</span>`
              + `<span class="sr-only">${k.deltaGood ? 'positive Entwicklung' : 'negative Entwicklung'}: </span>`
        }${C.escape(k.deltaLabel)}</div>` : ''}
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
          <div class="filter-panel__actions"><button type="button" class="btn btn--bare btn--sm mt-4" id="f-reset">${C.icon('Refresh', 'icon--base')}<span class="btn__text">Zurücksetzen</span></button></div>
        ` : '<p class="small muted" style="margin:0">Für dieses Dashboard sind keine Zeitreihen-Filter verfügbar.</p>'}
      </div>
    </aside>`;

  const tabBar = C.tabBar({ items: tabs, active: state.tab, idPrefix: 'dash-tab', panelId: 'dpanel', ariaLabel: 'Dashboard-Ansichten' });

  mount.innerHTML = `
  <div class="container section dash-page">
    ${C.backLink('#/app/dataportal', 'Datenportal')}
    <div class="dash-header">
      <div class="dash-header__text">${C.pageHeader({ title: board.title, lead: board.lead })}</div>
      ${C.menu({ menuId: 'dashboard', label: 'Dashboard-Aktionen', items: DASHBOARD_MENU })}
    </div>
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
    <footer class="dash-footer">
      <span class="meta-info__item">Quelle: ${C.escape(board.source)}</span>
      <span class="meta-info__item">Stand: ${C.escape(board.updated)}</span>
      <span class="meta-info__item">Demo-Daten</span>
    </footer>
  </div>`;

  // --- render the chart grid for the active tab + filters ---
  const grid = mount.querySelector('#dash-grid');
  let activeMaps = [];
  // Aufräumfunktion des ResizeObserver aus paintCharts — MUSS vor jedem
  // Neuzeichnen aufgerufen werden, sonst sammeln sich Observer an.
  let unpaint = null;
  function renderGrid() {
    // free WebGL contexts from any map rendered in the previous grid
    activeMaps.forEach(p => p && p.then && p.then(m => m && m.remove()));
    activeMaps = [];
    const tab = tabs.find(t => t.id === state.tab) || tabs[0];
    const specs = tab.charts.map(cid => chartById[cid]).filter(Boolean);
    grid.innerHTML = specs.map(spec => {
      if (spec.form === 'map') {
        return `<figure class="chart card card--universal chart--map" id="${spec.id}">
          <figcaption class="chart__head">
            <h3 class="chart__title">${C.escape(spec.title)}</h3>
            <div class="chart__actions">${C.menu({ menuId: spec.id, label: 'Karten-Aktionen', items: [{ action: 'link', label: 'Link kopieren' }] })}</div>
          </figcaption>
          <div class="dash-map" id="map-${spec.id}" role="group" aria-label="Karte der Gebäudestandorte"><p class="dash-map__loading" role="status">Karte wird geladen …</p></div>
          ${spec.note ? `<p class="chart__note">${C.escape(spec.note)}</p>` : ''}
        </figure>`;
      }
      // withYearRange EINMAL berechnen (vorher zweimal pro Chart, code-review G2)
      const ranged = withYearRange(spec, state.from, state.to);
      return chart(ranged, dashData.query(ranged.query));
    }).join('');
    // Zweiter, SYNCHRONER Durchgang: erst jetzt stehen die Karten im Layout und
    // haben eine messbare Breite (Item 6.1). Synchron, damit Tests, die auf ein
    // gerendertes SVG pollen, es unmittelbar vorfinden.
    if (unpaint) unpaint();
    unpaint = paintCharts(grid, (id) => {
      const spec = chartById[id];
      if (!spec) return null;
      const ranged = withYearRange(spec, state.from, state.to);
      return { spec: ranged, result: dashData.query(ranged.query) };
    });
    wireCharts(grid);
    wireChartMenus(grid);   // per-chart action menu (re-wired each render)
    // initialise any map in the freshly rendered grid
    specs.filter(s => s.form === 'map').forEach(s => {
      const el = grid.querySelector(`#map-${s.id}`);
      if (el) { const pm = initBuildingsMap(el, buildings); activeMaps.push(pm);
        ctx.onUnmount(() => pm && pm.then && pm.then(m => m && m.remove()).catch(() => {})); }
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

  // Item 6.13: unter lg trägt `.filter-panel--collapsed` das Einklappen (die
  // Desktop-Mechanik `.dashboard-layout--collapsed` bleibt unangetastet, damit die
  // filterFullHeight-Zusicherung in test-dashboard.mjs grün bleibt). Auf dem Handy
  // stand vorher mehr als ein Bildschirm Checkboxen VOR der ersten Kennzahl, und
  // der Umschalter war dort `display:none`.
  const layout = mount.querySelector('#dashboard');
  const panel = mount.querySelector('#dash-filters');
  const toggle = mount.querySelector('#filter-toggle');
  const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;
  // Unter lg standardmässig zugeklappt — wie CDs Facettenfilter und wie die
  // .catbar__panel-Schublade auf den Katalogseiten.
  if (panel && !isDesktop()) panel.classList.add('filter-panel--collapsed');
  const syncToggle = () => {
    if (!toggle) return;
    const collapsed = isDesktop()
      ? layout.classList.contains('dashboard-layout--collapsed')
      : panel.classList.contains('filter-panel--collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Filter ausklappen' : 'Filter einklappen');
    if (panel) toggle.setAttribute('aria-controls', 'dash-filters');
  };
  syncToggle();
  if (toggle) toggle.addEventListener('click', () => {
    if (isDesktop()) layout.classList.toggle('dashboard-layout--collapsed');
    else panel.classList.toggle('filter-panel--collapsed');
    syncToggle();
  });
  window.matchMedia('(min-width:1024px)').addEventListener('change', syncToggle);

  // --- dashboard toolbar menu: Aktualisieren (echt) · Herunterladen (Demo) ·
  // Teilen (echt: Zwischenablage / E-Mail). Einmal verdrahtet (Toolbar bleibt). ---
  C.wireMenu(mount.querySelector('.dash-header'), (action) => {
    if (action === 'refresh') { renderGrid(); C.toast('Dashboard aktualisiert.'); }
    else if (action === 'pdf') C.toast('Export als PDF — im Prototyp simuliert.');
    else if (action === 'img') C.toast('Export als Bild — im Prototyp simuliert.');
    else if (action === 'copy') copyText(location.href).then((ok) => C.toast(ok ? 'Link kopiert.' : 'Kopieren nicht möglich.'));
    else if (action === 'mail') shareMail(`${board.title} — BBL Datenportal`, location.href);
  });
}
