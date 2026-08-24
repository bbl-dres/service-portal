// Rendering and wiring for the skill results of js/search/insights.js.
//
// SPLIT FROM THE COMPUTATION ON PURPOSE, the same way search-engine.js is split
// from search.js: insights.js is pure and testable without a browser, and this
// file is the only place that touches the DOM, the chart painter and MapLibre.
// A skill that gains a new figure changes one function there and nothing here.
//
// NOTHING IS DRAWN THAT WAS NOT COMPUTED. Every tile, bar and marker below reads
// from the insight object; there is no placeholder branch that invents a value
// when a field is missing — a missing field renders nothing at all. That is the
// aggregate form of the citation rule in js/search/answer.js.
//
// THE CHART SHEET IS LOADED ON DEMAND. `.kpi`, `.chart` and `.dash-map` live in
// css/apps/dataportal.css, which the router loads for MICRO-APPS only; the
// search page is a page. Loading it from index.html would put the dashboard
// chrome in the critical path of every route in the portal for a block that
// appears when somebody asks a floor-area question. So the caller awaits
// `ensureInsightStyles()` before writing the markup — the same trade the router
// makes for an app, at the moment the skill actually ran.

import C from '../components.js';
import { chart, paintCharts, wireCharts, wireChartMenus } from '../ui/charts.js';
import { kpiTile } from '../ui/dashboard-chrome.js';
import { loadSheets } from '../routing/css-loader.js';
import { createMapSlot } from '../map/map-slot.js';
import { safeLinkUrl } from '../security/urls.js';

const esc = C.escape;

/** The dashboard chrome the block borrows. Resolves once per session. */
export const ensureInsightStyles = () => loadSheets('dataportal');

/* ================================================================ MARKUP == */

// The icon per skill. It is the fastest read of «what did it do» — before the
// word, before the numbers.
const SKILL_ICON = { dashboard: 'Chart', map: 'MapMarker', link: 'ArrowRight' };

/**
 * THE TOOL TRACE. The line that says a skill ran, which one, and over what.
 *
 * This is the point of the whole addition and not decoration. A model that
 * answers everything in prose and a model that picks a tool are different
 * products, and the difference is invisible unless the choice is shown. Whoever
 * reads this line can say «wrong tool» — which is feedback nobody can give about
 * a paragraph.
 */
const skillLine = (insight) => `<p class="answer__skill">
    ${C.icon(SKILL_ICON[insight.skill] || 'Cog', 'answer__skill-icon')}
    <span><span class="answer__skill-name">${esc(insight.skillLabel)}</span>
      <span class="answer__skill-detail">${esc(insight.title)}</span></span>
  </p>`;

const kpiRow = (kpis) => (kpis && kpis.length
  ? `<div class="kpi-row answer__kpis">${kpis.map((tile) => kpiTile(C, tile)).join('')}</div>`
  : '');

// The chart cards are the data-portal's own cards, unchanged. `chart()` leaves
// `.chart__plot` EMPTY by design — width is known only once the card is in
// layout — so `wireInsight` has to run before anything is visible.
const chartGrid = (charts) => (charts && charts.length
  ? `<div class="dash-grid answer__charts">${charts.map(({ spec, result }) => chart(spec, result)).join('')}</div>`
  : '');

// The map is a chart card too, so the kebab menu, fullscreen and PNG export of
// js/ui/charts.js apply to it without a second implementation
// (`chart--map` + `.dash-map`, exactly as js/apps/estate.js builds it).
const mapFigure = (insight) => `<figure class="chart card card--universal chart--map" id="answer-map">
    <figcaption class="chart__head"><h3 class="chart__title">${esc(insight.mapTitle || insight.title)}</h3>
      <div class="chart__actions">${C.menu({ menuId: 'answer-map', label: 'Karten-Aktionen', items: [
    { action: 'fullscreen', label: 'Vollbild' },
    { separator: true }, { heading: 'Herunterladen' },
    { action: 'png', label: 'Als Bild (PNG)' },
    { separator: true }, { action: 'link', label: 'Link kopieren' },
  ] })}</div>
    </figcaption>
    <div class="dash-map" id="answer-map-el" role="group"
      aria-label="Karte der gefundenen Liegenschaften">${C.loading({ label: 'Karte wird geladen…' })}</div>
  </figure>`;

// COLLAPSED, and that is a decision rather than tidiness: the table repeats what
// the chart already shows, so it is the second reading of the same fact, not the
// first. It stays reachable because a number one intends to use has to be
// readable as a number — and because the chart's own sr-only twin table serves
// screen readers whether this is open or not.
const dataTable = (table) => (table && table.rows && table.rows.length
  ? `<details class="answer__data">
      <summary class="answer__data-summary">${esc(table.caption)} — Werte anzeigen</summary>
      ${C.table({ columns: table.columns, rows: table.rows, zebra: true, compact: true,
    caption: table.caption })}
    </details>`
  : '');

const actionRow = (actions) => (actions && actions.length
  ? `<p class="answer__actions">${actions.map((action) => {
    const href = safeLinkUrl(action.href);
    if (!href) return '';
    // `btn--filled` is this design system's emphasised variant — there is no
    // `btn--primary`, and naming one would have rendered as an unstyled button.
    return `<a class="btn ${action.primary ? 'btn--filled' : 'btn--outline'} btn--sm" href="${esc(href)}">
        <span class="btn__text">${esc(action.label)}</span>${C.icon('ArrowRight', 'btn__icon')}</a>`;
  }).join('')}</p>`
  : '');

/**
 * WHERE THE NUMBERS CAME FROM. A cited sentence points at the record it came
 * from; an aggregate cannot, because it came from hundreds. So it names them —
 * how many records, of which kind, under which definition — and links the ones a
 * reader is most likely to want to open.
 *
 * Without this line the block is exactly the thing this whole portal argues
 * against: a confident figure with no way to check it.
 */
const basisLine = (insight) => (insight.basis
  ? `<p class="answer__basis">${esc(insight.basis)}</p>`
  : '');

/**
 * The body of the answer block for one insight. The head, the source list and
 * the foot stay with js/search/search-ui.js, which both answer paths share.
 *
 * ONE CONTAINER WITH ONE GAP, and every child's own margin switched off in the
 * stylesheet. The parts come from four different places — the tiles from
 * dashboard-chrome.js, the cards from charts.js, the rest from here — and each
 * carried the spacing of the page it was written for. Stacked, that produced
 * four different distances in one block (measured: 16, 24, 16, 12 px), which
 * reads as carelessness rather than as rhythm. A flex column is the only way to
 * own the rhythm HERE, where the parts actually meet.
 */
export function insightBody(insight) {
  return `<div class="answer__insight">
    ${/* The trace and the sentence are ONE thing — «Dashboard — Kostenauswertung»
          is the headline of the paragraph under it, so they sit closer to each
          other than to anything else. */''}
    <div class="answer__intro">
      ${skillLine(insight)}
      ${insight.lead ? `<p class="answer__lead">${esc(insight.lead)}</p>` : ''}
    </div>
    ${kpiRow(insight.kpis)}
    ${insight.points ? mapFigure(insight) : ''}
    ${chartGrid(insight.charts)}
    ${dataTable(insight.table)}
    ${basisLine(insight)}
    ${actionRow(insight.actions)}
  </div>`;
}

/** The compact form: a skill trace and an action, rendered INSIDE a cited
 *  answer rather than instead of it (js/search/insights.js `directLink`).
 *  Its own wrapper, so it carries the same rhythm as the full body instead of
 *  inheriting the sentence spacing of the paragraph it follows. */
export function insightInline(insight) {
  return `<div class="answer__inline">${skillLine(insight)}${actionRow(insight.actions)}</div>`;
}

/* ================================================================ WIRING == */

/**
 * Draw what could not be written as markup: chart SVGs need a measured width,
 * the map needs MapLibre.
 *
 * Returns a disposer. The caller MUST pass it to ctx.onUnmount — a ResizeObserver
 * on a removed node and a WebGL context on an orphaned element are exactly the
 * two leaks js/map/map-slot.js was written to prevent.
 */
export function wireInsight(root, insight) {
  if (!insight || insight.inline) return () => {};
  const disposers = [];

  if (insight.charts && insight.charts.length) {
    const registry = new Map(insight.charts.map(({ spec, result }) => [spec.id, { spec, result }]));
    disposers.push(paintCharts(root, (id) => registry.get(id)));
    wireCharts(root);
    wireChartMenus(root);
  }

  if (insight.points && insight.points.length) {
    const slot = createMapSlot();
    disposers.push(() => slot.free());
    const element = root.querySelector('#answer-map-el');
    if (element) {
      // Imported here rather than at module load: the map module pulls the
      // MapLibre loader and the base style, and a keyword search must not pay
      // for either. `focusPopup: false` keeps focus in the page — the block sits
      // above the result list, and a popup close button stealing focus would
      // move the caret out of the results (WCAG 2.4.3), the same reason the
      // property detail page passes it.
      void import('../map/buildings-map.js').then(({ initEstateMap }) => {
        if (!element.isConnected) return;
        return slot.mount(element, (node) => initEstateMap(
          node, insight.points, { type: 'FeatureCollection', features: [] }, '', { focusPopup: false }));
      }).catch(() => { /* The map is optional; its error appears in the container. */ });
    }
  }

  return () => disposers.forEach((dispose) => dispose());
}
