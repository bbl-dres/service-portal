// Shared dashboard chrome (Superset pattern), completing the extraction long
// announced by estate.js:152-154. dataportal.js and estate.js previously carried
// matching copies of the menu, KPI tile, filter-panel shell, collapse logic,
// menu handler and footer (~120 lines), including identical DOM IDs in both
// files. Each now exists ONCE; apps retain only data and chart logic.
//
// Class names remain unchanged (.dash-header/.dash-grid/.filter-panel …):
// scripts/test-dashboard.mjs checks them, and renaming would add churn without
// value (docs/design-review.md, C22).

import { copyText, shareMail } from '../export.js';
import { formatDate } from '../format.js';

// Dashboard toolbar menu. Whole-dashboard PDF/image export remains simulated
// because it would need a rasteriser; refresh and share are real.
export const DASHBOARD_MENU = [
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

// KPI tile with delta arrow and sr-only wording (WCAG 1.4.1: direction is not
// conveyed by colour alone). `deltaGood` undefined means neutral (for example a
// target), which must not look like success.
//
// Since the data-portal expansion (August 2026, federal energy dashboard / COVID
// dashboard pattern), it also supports `delta2Label/delta2Good` as a second chip
// (previous month AND previous year: property is seasonal, so the annual delta
// adds necessary context), `spark` as an axis-free 24-point miniature line in
// the tile footer, and `hint` as a reference-date note.
const deltaChip = (C, deltaLabel, deltaGood) => `<div class="kpi__delta${
  deltaGood === true ? ' is-good' : deltaGood === false ? ' is-bad' : ''}">${
  deltaGood === undefined ? ''
    : `<span class="kpi__arrow" aria-hidden="true">${deltaGood ? '▲' : '▼'}</span>`
      + `<span class="sr-only">${deltaGood ? 'positive Entwicklung' : 'negative Entwicklung'}: </span>`
}${C.escape(deltaLabel)}</div>`;

// Axis-free sparkline: only trend and endpoint, deliberately without values or
// ticks. The number sits prominently above; the line explains where it came
// from. It is decorative (aria-hidden); the authoritative series is in charts.
function sparkline(values) {
  const v = (values || []).map(Number).filter(Number.isFinite);
  if (v.length < 2) return '';
  const W = 96, H = 26, PAD = 3;
  const min = Math.min(...v), max = Math.max(...v);
  const px = (i) => PAD + (i / (v.length - 1)) * (W - 2 * PAD);
  const py = (x) => max === min ? H / 2 : H - PAD - ((x - min) / (max - min)) * (H - 2 * PAD);
  const d = v.map((x, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(x).toFixed(1)}`).join(' ');
  return `<svg class="kpi__spark" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
    <path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="${px(v.length - 1).toFixed(1)}" cy="${py(v[v.length - 1]).toFixed(1)}" r="2.5" fill="currentColor"/>
  </svg>`;
}

export function kpiTile(C, { label, value, unit = '', deltaLabel = '', deltaGood, delta2Label = '', delta2Good, spark, hint = '' } = {}) {
  return `<div class="kpi">
    <div class="kpi__label">${C.escape(label)}</div>
    <div class="kpi__value">${C.escape(value)}${unit ? `<span class="kpi__unit">${C.escape(unit)}</span>` : ''}</div>
    ${deltaLabel ? deltaChip(C, deltaLabel, deltaGood) : ''}
    ${delta2Label ? deltaChip(C, delta2Label, delta2Good) : ''}
    ${spark ? sparkline(spark) : ''}
    ${hint ? `<div class="kpi__hint">${C.escape(hint)}</div>` : ''}
  </div>`;
}

// Header: pageHeader on the left, action menu on the right. `extraHtml` is optional
// HTML below the lead (for example the property board's inventory notice).
export function dashHeader(C, { title, lead = '', leadHtml = '', extraHtml = '' } = {}) {
  return `<div class="dash-header">
      <div class="dash-header__text">${C.pageHeader(leadHtml ? { title, leadHtml } : { title, lead })}${extraHtml}</div>
      ${C.menu({ menuId: 'dashboard', label: 'Dashboard-Aktionen', items: DASHBOARD_MENU })}
    </div>`;
}

// Filter-panel shell (header + collapse button); `body` is caller-provided HTML.
export function filterPanelShell(C, body) {
  return `<aside class="filter-panel" id="dash-filters" aria-label="Filter">
      <div class="filter-panel__head">
        <h2 class="filter-panel__title">Filter</h2>
        <button type="button" class="filter-panel__toggle btn--bare interactive-control" id="filter-toggle" aria-label="Filter einklappen" aria-expanded="true">${C.icon('ChevronLeft', 'icon--base')}</button>
      </div>
      <div class="filter-panel__body" id="filter-body">${body}</div>
    </aside>`;
}

// Footer. `sourceId` renders the source as a JS-populated <span> (the property
// board changes it per tab). `updated` is ISO and formatted here ONCE for both
// boards through formatDate (both surfaces previously showed a raw date, design
// review A13).
export function dashFooter(C, { source = '', sourceId = '', updated = '' } = {}) {
  return `<footer class="dash-footer">
      <span class="meta-info__item">Quelle: ${sourceId ? `<span id="${C.escape(sourceId)}"></span>` : C.escape(source)}</span>
      ${updated ? `<span class="meta-info__item">Stand: ${C.escape(formatDate(updated))}</span>` : ''}
      <span class="meta-info__item">Demo-Daten</span>
    </footer>`;
}

// Item 6.13: below lg, `.filter-panel--collapsed` handles collapse. The desktop
// `.dashboard-layout--collapsed` mechanism remains intact so the
// filterFullHeight assertion in test-dashboard.mjs keeps passing. Otherwise a
// phone showed more than one screen of checkboxes BEFORE the first metric.
// Unregisters its matchMedia listener through ctx.onUnmount.
export function wireFilterCollapse(ctx, mount) {
  const layout = mount.querySelector('#dashboard');
  const panel = mount.querySelector('#dash-filters');
  const toggle = mount.querySelector('#filter-toggle');
  const isDesktop = () => window.matchMedia('(min-width:1024px)').matches;
  // Collapsed by default below lg, matching CD facet filters and the
  // .catbar__panel drawer on catalogue pages.
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
  // Unregister on route exit. The listener is attached to window and would
  // otherwise survive the DOM replacement, adding another on every visit
  // (code-review §4).
  const mqAc = new AbortController();
  ctx.onUnmount(() => mqAc.abort());
  window.matchMedia('(min-width:1024px)').addEventListener('change', syncToggle, { signal: mqAc.signal });
}

// Toolbar menu handler: refresh (real), download (demo), share (real: clipboard
// / email). Copy failure appears as an ERROR toast; both boards previously used
// the success default (green check, design review D5).
export function wireDashboardMenu(mount, C, { title, onRefresh } = {}) {
  C.wireMenu(mount.querySelector('.dash-header'), (action) => {
    if (action === 'refresh') { onRefresh(); C.toast('Dashboard aktualisiert.'); }
    else if (action === 'pdf') C.toast('Export als PDF — im Prototyp simuliert.');
    else if (action === 'img') C.toast('Export als Bild — im Prototyp simuliert.');
    else if (action === 'copy') copyText(location.href).then((ok) => (ok
      ? C.toast('Link kopiert.')
      : C.toast('Kopieren nicht möglich.', 'error', 'WarningCircle')));
    else if (action === 'mail') shareMail(`${title} — BBL Datenportal`, location.href);
  });
}
