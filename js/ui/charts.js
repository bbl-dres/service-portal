// Minimal SVG chart renderers for the data portal.
//
// No chart library (the portal is no-build), so the marks follow the house specs
// explicitly: bars <= 24px with a 4px rounded data-end and a square baseline,
// 2px lines with round caps, >= 8px markers carrying a 2px surface ring,
// hairline gridlines, a legend whenever there are two or more series, and
// selective direct labels (endpoint only — never a number on every point).
//
// Categorical palette: the CD accent hues at their **700** step, taken from the
// token layer (css/tokens.css --chart-series-*). The 700 steps were chosen so a
// white label on a filled mark clears 4.5:1 — measured worst case 5.02:1
// (yellow-700); the previous 600-step palette failed on orange (3.56:1) and
// green (3.77:1), which is what put white pie-slice percentages below AA.
//
// Trade-off, stated plainly: the 700 steps sit close together in LUMINANCE
// (adjacent pairs 1.1-1.5:1), so slices and bars are NOT separated by lightness.
// Separation is carried structurally instead — a 2px surface-coloured stroke
// between marks, a legend whenever there are two or more series, and (since
// item 6.2) the data table underneath every chart. Assign slots in order, never cycle.

import C, { menu, wireMenu, toast } from '../components.js';
import { download, tableToCsv, tableToXls, svgToPng, copyText, fileSlug } from '../export.js';
import { requestFullscreen } from './fullscreen.js';

// The categorical palette and chart ink come from the token layer
// (css/tokens.css --chart-series-* / --chart-ink*). Values are RESOLVED at
// render time rather than written as `var(...)` into SVG attributes: PNG export
// serialises the SVG and draws it onto canvas, where custom properties would no
// longer resolve. Fallbacks match the tokens.
const DEFAULT_CHART_FILE_SLUG = 'diagramm';

const cssVar = (name, fallback) => {
  if (typeof document === 'undefined') return fallback;
  // Skin overrides are body-scoped. The body's computed style includes both
  // inherited root tokens and `.body--intranet` overrides.
  const scope = document.body || document.documentElement;
  const value = getComputedStyle(scope).getPropertyValue(name).trim();
  return value || fallback;
};
const paletteCache = { key: '' };
function palette() {
  // The skin can override tokens in principle, so cache per body class.
  const key = typeof document === 'undefined' ? 'ssr' : document.body.className;
  if (paletteCache.key === key) return paletteCache.val;
  const val = {
    series: [
      cssVar('--chart-series-1', '#0f6b75'), cssVar('--chart-series-2', '#c2410c'),
      cssVar('--chart-series-3', '#6d28d9'), cssVar('--chart-series-4', '#047857'),
      cssVar('--chart-series-5', '#be185d'), cssVar('--chart-series-6', '#4b5563'),
      cssVar('--chart-series-7', '#b45309'),
    ],
    ink: cssVar('--chart-ink', '#1f2937'),
    inkMuted: cssVar('--chart-ink-muted', '#4b5563'),
    grid: cssVar('--chart-grid', '#e5e7eb'),
    axis: cssVar('--chart-axis', '#d1d5db'),
    surface: cssVar('--chart-surface', '#ffffff'),
  };
  paletteCache.key = key; paletteCache.val = val;
  return val;
}
// The former SERIES export is gone. It was a literal copy of
// --chart-series-1..7 (tokens.css) WITH zero importers; the legend actually reads
// palette().series, which resolves the CSS variables (design review C20).

// Per-chart action menu (Superset-style). Actions are handled in wireChartMenus.
const CHART_MENU = [
  { action: 'fullscreen', label: 'Vollbild' },
  { separator: true },
  { heading: 'Herunterladen' },
  { action: 'csv', label: 'Als CSV' },
  { action: 'xls', label: 'Als Excel' },
  { action: 'png', label: 'Als Bild (PNG)' },
  { separator: true },
  { action: 'link', label: 'Link kopieren' },
];
// --- Width-dependent geometry (item 6.1) ------------------------------------
// Previously: fixed viewBox 720x300 plus `.chart__svg{width:100%}`. SVG scaled
// text with geometry, so EVERY label shrank with the card. Measurements were
// 4.10px at 320, 5.27px at 390, 10.65px at 768 and 7.7px at 1440 (two-column
// grid), making desktop less legible than tablet. Drawing in CSS pixels now
// makes 1 user unit = 1 px, so font-size="12" is truly 12px (the smallest CD
// step is 0.75rem).
function geom(width, { r = 20, t = 20, b = 40 } = {}) {
  const W = Math.max(240, Math.round(width || 720));
  const H = Math.round(Math.max(200, Math.min(320, W * 0.5)));
  return { W, H, P: { t, r, b, l: W < 420 ? 36 : 52 } };
}
// Draw only as many x labels as fit side by side; on narrow cards they should
// thin out rather than overlap.
const labelStride = (count, inner) => Math.max(1, Math.ceil((count * 34) / Math.max(1, inner)));

const esc = (s) => String(s == null ? '' : s)
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmt = (n, unit) => {
  if (!Number.isFinite(n)) return '—';
  const s = Math.abs(n) >= 1000 ? n.toLocaleString('de-CH')
    : Number.isInteger(n) ? String(n) : n.toLocaleString('de-CH', { maximumFractionDigits: 1 });
  return unit ? `${s} ${unit}` : s;
};

// "nice" axis maximum so ticks land on round numbers
function niceMax(v) {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

// Count axes must not show fractional buildings (item 6.7). For a small
// integer maximum, choose the tick count so every step remains an integer.
const ticks = (max, count = 4) => {
  let n = count;
  if (Number.isInteger(max) && max <= 20) {
    const cand = [count, 5, 4, 3, 2, 1].find((c) => Number.isInteger(max / c));
    n = cand || 1;
  }
  return Array.from({ length: n + 1 }, (_, i) => (max / n) * i);
};

// rounded data-end: square at the baseline, 4px radius at the value end
function barPath(x, y, w, h, r, dir) {
  const rr = Math.min(r, w / 2, h);
  if (h <= 0.5) return '';
  if (dir === 'up') {
    return `M${x} ${y + h} L${x} ${y + rr} Q${x} ${y} ${x + rr} ${y} L${x + w - rr} ${y} Q${x + w} ${y} ${x + w} ${y + rr} L${x + w} ${y + h} Z`;
  }
  // dir === 'right'
  return `M${x} ${y} L${x + w - rr} ${y} Q${x + w} ${y} ${x + w} ${y + rr} L${x + w} ${y + h - rr} Q${x + w} ${y + h} ${x + w - rr} ${y + h} L${x} ${y + h} Z`;
}

function legend(names) {
  if (names.length < 2) return '';   // one series: the title already names it
  const SER = palette().series;
  return `<div class="chart__legend">${names.map((n, i) =>
    `<span class="chart__legend-item"><span class="chart__swatch" style="background:${SER[i % SER.length]}"></span>${esc(n)}</span>`
  ).join('')}</div>`;
}

// Text alternative for the chart (item 6.2), WITHOUT a visible affordance.
//
// Previously, the table was `hidden` in the DOM and served only as the CSV/Excel
// source. `hidden` also removes it from the accessibility tree, while the outer
// <svg> has `role="img"`, removing all descendants. NO chart therefore had an
// accessible text alternative (WCAG 1.1.1).
//
// Decision: no expandable data-as-table row (visual calm; sighted users
// use CSV/Excel in the chart menu). Instead, the table remains available to
// assistive technology through `.sr-only` rather than `hidden`, with a <caption>
// that associates it with the chart. Deliberately NO `.table-wrapper` /
// `data-scroll-region`, which would add a tab stop inside visually hidden
// content. Export continues to read `.chart__table table`.
function tableView(id, columns, rows, unit, title = '') {
  const head = columns.map(c => `<th scope="col">${esc(c)}</th>`).join('');
  const body = rows.map(r => `<tr>${columns.map((c, i) =>
    i === 0 ? `<th scope="row">${esc(r[c])}</th>` : `<td>${esc(typeof r[c] === 'number' ? fmt(r[c], unit) : r[c])}</td>`
  ).join('')}</tr>`).join('');
  return `<div class="chart__table sr-only" id="${id}-table"><table class="table table--compact">
    <caption>${esc(title ? `Datentabelle: ${title}` : 'Datentabelle')}</caption>
    <thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/* ---------------------------------------------------------------- line ---- */
function lineChart({ id, rows, x, y, series, unit, width }) {
  const pal = palette();
  const { INK, INK_MUTED, GRID, AXIS, SURFACE } = { INK: pal.ink, INK_MUTED: pal.inkMuted, GRID: pal.grid, AXIS: pal.axis, SURFACE: pal.surface };
  const SER = pal.series;
  // Leave room on the right for the endpoint label, less on narrow cards.
  const { W, H, P } = geom(width, { r: (width || 720) < 420 ? 44 : 76 });
  const names = series ? [...new Set(rows.map(r => r[series]))] : ['__single'];
  const xs = [...new Set(rows.map(r => r[x]))];
  const numericX = xs.every(v => Number.isFinite(Number(v)));
  xs.sort(numericX
    ? (a, b) => Number(a) - Number(b)
    : (a, b) => String(a).localeCompare(String(b), 'de-CH', { numeric: true }));
  const xIndex = new Map(xs.map((v, i) => [v, i]));
  const max = niceMax(Math.max(...rows.map(r => Number(r[y]) || 0)));
  const firstX = numericX ? Number(xs[0]) : 0;
  const lastX = numericX ? Number(xs[xs.length - 1]) : xs.length - 1;
  const px = (v) => {
    const position = numericX ? Number(v) : xIndex.get(v);
    return P.l + ((position - firstX) / ((lastX - firstX) || 1)) * (W - P.l - P.r);
  };
  const py = (v) => H - P.b - (v / max) * (H - P.t - P.b);

  const grid = ticks(max).map(t =>
    `<line x1="${P.l}" y1="${py(t)}" x2="${W - P.r}" y2="${py(t)}" stroke="${GRID}" stroke-width="1"/>
     <text x="${P.l - 10}" y="${py(t) + 4}" text-anchor="end" fill="${INK_MUTED}" font-size="12">${fmt(t)}</text>`
  ).join('');

  // Thin labels rather than collide; always keep the first and last marks.
  const stride = labelStride(xs.length, W - P.l - P.r);
  const xLabels = xs.map((v, i) =>
    (i % stride === 0 || i === xs.length - 1)
      ? `<text x="${px(v)}" y="${H - P.b + 20}" text-anchor="middle" fill="${INK_MUTED}" font-size="12">${esc(v)}</text>`
      : ''
  ).join('');

  const paths = names.map((name, i) => {
    const pts = rows.filter(r => !series || r[series] === name).sort((a, b) => a[x] - b[x]);
    if (!pts.length) return '';
    const colour = SER[i % SER.length];
    const d = pts.map((p, j) => `${j ? 'L' : 'M'}${px(p[x])} ${py(p[y])}`).join(' ');
    const dots = pts.map(p =>
      `<circle cx="${px(p[x])}" cy="${py(p[y])}" r="4.5" fill="${colour}" stroke="${SURFACE}" stroke-width="2"
         class="chart__dot"
         data-tip="${esc(name === '__single' ? '' : name + ' · ')}${esc(p[x])}: ${esc(fmt(p[y], unit))}"
       ><title>${esc(p[x])}: ${esc(fmt(p[y], unit))}</title></circle>`).join('');
    const last = pts[pts.length - 1];
    // Direct label on the endpoint only — 14px (--fs-sm equivalent). 13 falls
    // between CD scale steps (item chart-fs-1).
    const label = `<text x="${px(last[x]) + 12}" y="${py(last[y]) + 4}" fill="${INK}" font-size="14" font-weight="700">${esc(fmt(last[y], unit))}</text>`;
    const dash = name === 'Ziel' ? ' stroke-dasharray="6 5"' : '';
    return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${dash}/>${dots}${label}`;
  }).join('');

  return { svg: `<svg viewBox="0 0 ${W} ${H}" class="chart__svg" role="img" aria-labelledby="${id}-t">
      ${grid}<line x1="${P.l}" y1="${H - P.b}" x2="${W - P.r}" y2="${H - P.b}" stroke="${AXIS}" stroke-width="1"/>
      ${xLabels}${paths}
    </svg>`, names: names.filter(n => n !== '__single') };
}

/* -------------------------------------------------------------- column ---- */
function columnChart({ id, rows, x, y, series, unit, width }) {
  const pal = palette();
  const INK = pal.ink, INK_MUTED = pal.inkMuted, GRID = pal.grid, AXIS = pal.axis, SURFACE = pal.surface;
  const SER = pal.series;
  const { W, H, P } = geom(width, { t: 24 });
  const names = series ? [...new Set(rows.map(r => r[series]))] : ['__single'];
  const cats = [...new Set(rows.map(r => r[x]))];
  const max = niceMax(Math.max(...rows.map(r => Number(r[y]) || 0)));
  const band = (W - P.l - P.r) / cats.length;
  // max(1, …): `per` became negative on narrow cards with many categories and
  // bars disappeared (code-review A11).
  const per = Math.max(1, Math.min(24, (band - 8) / names.length));
  const py = (v) => H - P.b - (v / max) * (H - P.t - P.b);

  const grid = ticks(max).map(t =>
    `<line x1="${P.l}" y1="${py(t)}" x2="${W - P.r}" y2="${py(t)}" stroke="${GRID}" stroke-width="1"/>
     <text x="${P.l - 10}" y="${py(t) + 4}" text-anchor="end" fill="${INK_MUTED}" font-size="12">${fmt(t)}</text>`
  ).join('');

  const bars = cats.map((c, ci) => names.map((name, si) => {
    const row = rows.find(r => r[x] === c && (!series || r[series] === name));
    if (!row) return '';
    const v = Number(row[y]) || 0;
    // 2px surface gap between adjacent bars
    const groupW = per * names.length + 2 * (names.length - 1);
    const bx = P.l + band * ci + (band - groupW) / 2 + si * (per + 2);
    const byy = py(v), h = (H - P.b) - byy;
    return `<path d="${barPath(bx, byy, per, h, 4, 'up')}" fill="${SER[si % SER.length]}"
      class="chart__bar"
      data-tip="${esc(name === '__single' ? '' : name + ' · ')}${esc(c)}: ${esc(fmt(v, unit))}"
    ><title>${esc(c)}: ${esc(fmt(v, unit))}</title></path>`;
  }).join('')).join('');

  const cStride = labelStride(cats.length, W - P.l - P.r);
  const xLabels = cats.map((c, ci) =>
    (ci % cStride === 0 || ci === cats.length - 1)
      ? `<text x="${P.l + band * ci + band / 2}" y="${H - P.b + 20}" text-anchor="middle" fill="${INK_MUTED}" font-size="12">${esc(c)}</text>`
      : ''
  ).join('');

  return { svg: `<svg viewBox="0 0 ${W} ${H}" class="chart__svg" role="img" aria-labelledby="${id}-t">
      ${grid}<line x1="${P.l}" y1="${H - P.b}" x2="${W - P.r}" y2="${H - P.b}" stroke="${AXIS}" stroke-width="1"/>
      ${bars}${xLabels}
    </svg>`, names: names.filter(n => n !== '__single') };
}

/* ------------------------------------------------------- horizontal bar ---- */
function barChart({ id, rows, x, y, unit, width }) {
  const pal = palette();
  const INK = pal.ink, INK_MUTED = pal.inkMuted, GRID = pal.grid, AXIS = pal.axis, SURFACE = pal.surface;
  const SER = pal.series;
  // Width comes from the container. The label column was fixed at 210 of 720
  // (29%) and stayed 29% wide on a 300px card even though only ~8 characters fit
  // (item 6.10). It is now proportional with upper and lower bounds.
  const W = Math.max(240, Math.round(width || 720));
  const rowH = W < 480 ? 30 : 34;
  const labelW = Math.round(Math.max(72, Math.min(210, W * 0.32)));
  const valueW = W < 480 ? 56 : 90;
  const P = { t: 8, r: valueW, b: 8, l: labelW };
  const H = P.t + P.b + rows.length * rowH;
  const max = niceMax(Math.max(...rows.map(r => Number(r[y]) || 0)));
  const bw = Math.max(8, W - P.l - P.r);
  const thick = Math.min(24, rowH - 12);
  // Truncate labels to available column width rather than a fixed character
  // count. Full text remains in <title> and the data table.
  const maxChars = Math.max(8, Math.floor((labelW - 14) / 6.2));

  const bars = rows.map((r, i) => {
    const v = Number(r[y]) || 0;
    const w = (v / max) * bw;
    const by = P.t + i * rowH + (rowH - thick) / 2;
    const label = String(r[x]);
    const short = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;
    // 12/14 instead of 13: the CD scale has no 13px step. Use 12 for category
    // labels and 14 for the emphasised value (item chart-fs-1).
    return `<text x="${P.l - 12}" y="${by + thick / 2 + 4}" text-anchor="end" fill="${INK}" font-size="12">${esc(short)}<title>${esc(label)}</title></text>
      <path d="${barPath(P.l, by, Math.max(w, 2), thick, 4, 'right')}" fill="${SER[0]}"
        class="chart__bar" data-tip="${esc(label)}: ${esc(fmt(v, unit))}"
      ><title>${esc(label)}: ${esc(fmt(v, unit))}</title></path>
      <text x="${P.l + Math.max(w, 2) + 10}" y="${by + thick / 2 + 4}" fill="${INK}" font-size="14" font-weight="700">${esc(fmt(v, unit))}</text>`;
  }).join('');

  return { svg: `<svg viewBox="0 0 ${W} ${H}" class="chart__svg" role="img" aria-labelledby="${id}-t">
      <line x1="${P.l}" y1="${P.t}" x2="${P.l}" y2="${H - P.b}" stroke="${AXIS}" stroke-width="1"/>${bars}
    </svg>`, names: [] };
}

/* ----------------------------------------------------------------- pie ---- */
// Parts-of-whole for a small set of categories (for example ownership type). Slices
// use the categorical palette in order so they match the legend the wrapper draws;
// a 2px surface ring separates them; the share (%) is labelled on slices >= 6%.
function pieChart({ id, rows, x, y, unit, width }) {
  const pal = palette();
  const INK = pal.ink, INK_MUTED = pal.inkMuted, GRID = pal.grid, AXIS = pal.axis, SURFACE = pal.surface;
  const SER = pal.series;
  // Previously 720x300 with R=118: the circle filled one third of the card and
  // left two thirds blank (item 6.9). The plot is now approximately square from
  // container width, with radius based on the shorter side.
  const W = Math.max(240, Math.round(width || 720));
  const H = Math.round(Math.max(200, Math.min(340, W * 0.62)));
  const cx = W / 2, cy = H / 2 + 2;
  const R = Math.round(Math.min(W, H) / 2 - 12);
  // A ring is calmer than a full circle and its centre carries the total. Draw
  // true annulus paths (outer arc + returning inner arc), NOT a full circle with
  // a cover on top. A cover would need to match the background and stand out in
  // a fullscreen overlay or on tinted cards.
  const Ri = Math.round(R * 0.58);
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row[y]) || 0), 0);
  const at = (a, rad) => `${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`;
  const ring = (a0, a1, frac) => {
    const big = frac > 0.5 ? 1 : 0;
    if (frac >= 0.999) {
      // Closed ring: two outer semicircles and two returning inner semicircles.
      return `M${at(-Math.PI / 2, R)} A${R} ${R} 0 1 1 ${at(Math.PI / 2, R)} A${R} ${R} 0 1 1 ${at(-Math.PI / 2, R)} Z`
        + `M${at(-Math.PI / 2, Ri)} A${Ri} ${Ri} 0 1 0 ${at(Math.PI / 2, Ri)} A${Ri} ${Ri} 0 1 0 ${at(-Math.PI / 2, Ri)} Z`;
    }
    return `M${at(a0, R)} A${R} ${R} 0 ${big} 1 ${at(a1, R)} L${at(a1, Ri)} A${Ri} ${Ri} 0 ${big} 0 ${at(a0, Ri)} Z`;
  };
  let a0 = -Math.PI / 2;
  const mid = (R + Ri) / 2;   // Centre labels in the ring band.
  const slices = rows.map((r, i) => {
    const v = Math.max(0, Number(r[y]) || 0), frac = v / total, a1 = a0 + frac * 2 * Math.PI, am = (a0 + a1) / 2;
    const s = { path: ring(a0, a1, frac), color: SER[i % SER.length], v, frac, label: String(r[x]),
      lx: cx + mid * Math.cos(am), ly: cy + mid * Math.sin(am) };
    a0 = a1; return s;
  });
  const paths = slices.map((s) => {
    const tip = `${esc(s.label)}: ${esc(fmt(s.v, unit))} (${Math.round(s.frac * 100)}%)`;
    return `<path d="${s.path}" fill="${s.color}" stroke="${SURFACE}" stroke-width="2" class="chart__bar" data-tip="${tip}" fill-rule="evenodd"><title>${tip}</title></path>`;
  }).join('');
  // Show percentage only when the segment is wide enough. A ring band has less
  // room than a full-circle wedge. Use surface colour (token --chart-surface,
  // white by default), not literal #fff, as for every other mark outline; on the
  // 700 shades contrast is >= 5.02:1. Use 14 rather than off-scale 13px.
  const labels = slices.filter((s) => s.frac >= 0.08).map((s) =>
    `<text x="${s.lx.toFixed(1)}" y="${s.ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="${SURFACE}" font-size="14" font-weight="700">${Math.round(s.frac * 100)}%</text>`).join('');
  // Show the total in the centre only when the inner circle can carry it.
  const totalText = fmt(total, unit);
  const centre = Ri >= 44 && totalText.length <= 12
    ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" dominant-baseline="middle" fill="${INK}" font-size="${Ri >= 60 ? 20 : 16}" font-weight="700">${esc(totalText)}</text>`
      + `<text x="${cx}" y="${cy + (Ri >= 60 ? 18 : 14)}" text-anchor="middle" dominant-baseline="middle" fill="${INK_MUTED}" font-size="12">Total</text>`
    : '';
  return { svg: `<svg viewBox="0 0 ${W} ${H}" class="chart__svg" role="img" aria-labelledby="${id}-t">${paths}${labels}${centre}</svg>`,
    names: rows.map((r) => String(r[x])) };
}

/* ------------------------------------------------------ stacked area ------- */
// Composition over time (federal energy-dashboard pattern). Series are stacked
// cumulatively and each area is a closed path (upper edge forward, lower edge
// back). Series order follows first occurrence in the data; the wrapper supplies
// the legend. Each area carries data-tip for hover.
function areaChart({ id, rows, x, y, series, unit, width }) {
  const pal = palette();
  const INK_MUTED = pal.inkMuted, GRID = pal.grid, AXIS = pal.axis, SURFACE = pal.surface;
  const SER = pal.series;
  const { W, H, P } = geom(width);
  const names = series ? [...new Set(rows.map((r) => r[series]))] : ['__single'];
  const xs = [...new Set(rows.map((r) => r[x]))].sort((a, b) => a - b);
  // Cumulative sums per x; the axis maximum is the total height.
  const val = (name, xv) => { const r = rows.find((q) => q[x] === xv && (!series || q[series] === name)); return Number(r && r[y]) || 0; };
  const totals = xs.map((xv) => names.reduce((s, n) => s + val(n, xv), 0));
  const max = niceMax(Math.max(...totals));
  const px = (v) => P.l + ((v - xs[0]) / ((xs[xs.length - 1] - xs[0]) || 1)) * (W - P.l - P.r);
  const py = (v) => H - P.b - (v / max) * (H - P.t - P.b);

  const grid = ticks(max).map((t) =>
    `<line x1="${P.l}" y1="${py(t)}" x2="${W - P.r}" y2="${py(t)}" stroke="${GRID}" stroke-width="1"/>
     <text x="${P.l - 10}" y="${py(t) + 4}" text-anchor="end" fill="${INK_MUTED}" font-size="12">${fmt(t)}</text>`
  ).join('');
  const stride = labelStride(xs.length, W - P.l - P.r);
  const xLabels = xs.map((v, i) =>
    (i % stride === 0 || i === xs.length - 1)
      ? `<text x="${px(v)}" y="${H - P.b + 20}" text-anchor="middle" fill="${INK_MUTED}" font-size="12">${esc(v)}</text>`
      : ''
  ).join('');

  const cum = xs.map(() => 0);
  const bands = names.map((name, si) => {
    const lower = [...cum];
    xs.forEach((xv, i) => { cum[i] += val(name, xv); });
    const upper = [...cum];
    const top = xs.map((xv, i) => `${i ? 'L' : 'M'}${px(xv).toFixed(1)} ${py(upper[i]).toFixed(1)}`).join(' ');
    const back = [...xs].reverse().map((xv, i) => `L${px(xv).toFixed(1)} ${py(lower[xs.length - 1 - i]).toFixed(1)}`).join(' ');
    const totalOf = (n) => xs.reduce((s, xv) => s + val(n, xv), 0);
    const tip = `${esc(name)}: ${esc(fmt(totalOf(name), unit))} gesamt`;
    return `<path d="${top} ${back} Z" fill="${SER[si % SER.length]}" fill-opacity="0.85" stroke="${SURFACE}" stroke-width="1"
      class="chart__bar" data-tip="${tip}"><title>${tip}</title></path>`;
  }).join('');

  return { svg: `<svg viewBox="0 0 ${W} ${H}" class="chart__svg" role="img" aria-labelledby="${id}-t">
      ${grid}<line x1="${P.l}" y1="${H - P.b}" x2="${W - P.r}" y2="${H - P.b}" stroke="${AXIS}" stroke-width="1"/>
      ${bands}${xLabels}
    </svg>`, names: names.filter((n) => n !== '__single') };
}

/* ------------------------------------------------------- Metrics table ----- */
// Visible multi-year table (Zurich annual-report / UK «State of the Estate»
// pattern): rows = metrics, columns = years, with optional footnotes.
// Deliberately NO SVG: the table IS the visualisation and its own text
// alternative, so the PNG export is absent from the menu. A row with all year
// values empty is a group heading (Zurich anatomy); raw field: `einheit` labels
// the row instead of every cell.
const TABLE_MENU = CHART_MENU.filter((m) => m.action !== 'png');
function metricsTable(spec, result) {
  const cols = result.columns;
  const x = spec.x || cols[0];
  const hasUnitColumn = cols.includes('einheit');
  const yearCols = cols.filter((c) => c !== x && c !== 'einheit');
  const head = `<tr><th scope="col">${esc(spec.xLabel || 'Kennzahl')}</th>${
    yearCols.map((c) => `<th scope="col" class="num">${esc(c)}</th>`).join('')}</tr>`;
  const body = result.rows.map((r) => {
    const isGroup = yearCols.every((c) => r[c] == null || r[c] === '');
    if (isGroup) {
      return `<tr class="chart__trow-group"><th scope="colgroup" colspan="${yearCols.length + 1}">${esc(r[x])}</th></tr>`;
    }
    const unit = hasUnitColumn ? r['einheit'] : spec.unit;
    return `<tr><th scope="row">${esc(r[x])}${unit ? ` <span class="muted">(${esc(unit)})</span>` : ''}</th>${
      yearCols.map((c) => `<td class="num">${r[c] == null || r[c] === '' ? '—' : esc(typeof r[c] === 'number' ? fmt(r[c]) : r[c])}</td>`).join('')}</tr>`;
  }).join('');
  return `<div class="chart__table chart__table--visible" id="${spec.id}-table">
    <div class="table-wrapper" data-scroll-region tabindex="-1"><table class="table table--compact">
      <caption class="sr-only">${esc(spec.title)}</caption>
      <thead>${head}</thead><tbody>${body}</tbody></table></div>
    ${(spec.footnotes || []).length ? `<ol class="chart__footnotes">${spec.footnotes.map((f) => `<li>${esc(f)}</li>`).join('')}</ol>` : ''}
  </div>`;
}

/**
 * Render one chart card. `result` is a dashData.query() result ({ columns, rows, label }).
 */
export function chart(spec, result) {
  const { id, title, unit, note } = spec;
  const rows = result.rows;
  if (result.error || !rows.length) {
    return `<figure class="chart card card--universal"><figcaption class="chart__head"><h3 class="chart__title" id="${id}-t">${esc(title)}</h3></figcaption>
      <div class="empty">${esc(result.error || 'Keine Daten für diese Auswahl.')}</div></figure>`;
  }
  // Metrics table: no plot field and no second pass. The table sits directly in
  // the card and replaces the sr-only twin table.
  if (spec.form === 'table') {
    return `<figure class="chart card card--universal chart--table" id="${id}">
      <figcaption class="chart__head">
        <h3 class="chart__title" id="${id}-t">${esc(title)}</h3>
        <div class="chart__actions">${menu({ menuId: id, label: 'Tabellen-Aktionen', items: TABLE_MENU })}</div>
      </figcaption>
      ${metricsTable(spec, result)}
      ${note ? `<p class="chart__note">${esc(note)}</p>` : ''}
    </figure>`;
  }
  // Determine legend names without geometry; the legend sits above a plot that
  // is filled only in the second pass.
  const names = spec.series ? [...new Set(rows.map((r) => r[spec.series]))]
    : spec.form === 'pie' ? rows.map((r) => String(r[spec.x])) : [];
  // `.chart__plot` remains EMPTY because width is known only once the card is in
  // layout. The caller fills it synchronously via renderSvg() (item 6.1). There
  // is no `.chart__unit` pill in the header: the unit already appears at every
  // value (axis ticks, direct labels, tooltip, data table), so the header copy
  // was duplication that reduced room for the kebab menu.
  return `<figure class="chart card card--universal" id="${id}">
    <figcaption class="chart__head">
      <h3 class="chart__title" id="${id}-t">${esc(title)}</h3>
      <div class="chart__actions">
        ${menu({ menuId: id, label: 'Diagramm-Aktionen', items: CHART_MENU })}
      </div>
    </figcaption>
    ${legend(names)}
    <div class="chart__plot" data-chart="${esc(id)}"></div>
    ${note ? `<p class="chart__note">${esc(note)}</p>` : ''}
    ${tableView(id, result.columns, rows, unit, title)}
  </figure>`;
}

/**
 * Draw the SVG for a card already in layout. `width` is the measured inner
 * width of `.chart__plot`; 1 user unit = 1 CSS pixel, making font-size="12"
 * truly 12px. Must run SYNCHRONOUSLY after writing innerHTML so tests polling
 * for a rendered SVG can find it.
 */
export function renderSvg(spec, result, width) {
  const rows = (result && result.rows) || [];
  if (!rows.length) return '';
  if (spec.form === 'pie' && rows.every((row) => !(Number(row[spec.y]) > 0))) {
    return '<div class="empty empty--compact" role="status"><p class="empty__title">Keine Daten für diese Auswahl.</p></div>';
  }
  const render = spec.form === 'line' ? lineChart : spec.form === 'column' ? columnChart
    : spec.form === 'pie' ? pieChart : spec.form === 'area' ? areaChart : barChart;
  const { svg } = render({ id: spec.id, rows, x: spec.x, y: spec.y, series: spec.series, unit: spec.unit, width });
  return svg;
}

/** Fill every empty `.chart__plot[data-chart]` under `root`. `lookup(id)` returns
 *  `{ spec, result }`. Returns a ResizeObserver cleanup function that the caller
 *  MUST invoke when redrawing the route. */
// Fullscreen (item 6.12) redraws with spec/result at modal width instead of
// cloning a scaled SVG. paintCharts remembers both per chart ID so
// wireChartMenus need not carry a lookup parameter through every page.
const chartRegistry = new Map();
export function paintCharts(root, lookup) {
  const paint = () => {
    root.querySelectorAll('.chart__plot[data-chart]').forEach((p) => {
      const found = lookup(p.dataset.chart);
      if (!found || !found.spec) return;
      chartRegistry.set(p.dataset.chart, found);
      const w = p.clientWidth || p.getBoundingClientRect().width;
      if (!w) return;                       // Invisible, for example in an inactive tab.
      p.innerHTML = renderSvg(found.spec, found.result, w);
    });
  };
  paint();
  if (typeof ResizeObserver !== 'function') return () => {};
  let raf = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(paint);     // One redraw per frame.
  });
  ro.observe(root);
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}

/** Hover/focus tooltip for every mark carrying data-tip. */
export function wireCharts(root) {
  let tip = root.querySelector('.chart__tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart__tooltip';
    tip.hidden = true;
    root.appendChild(tip);
  }
  const show = (el) => {
    tip.textContent = el.getAttribute('data-tip') || '';
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const rootR = root.getBoundingClientRect();
    tip.style.left = `${r.left - rootR.left + r.width / 2}px`;
    tip.style.top = `${r.top - rootR.top - 8}px`;
  };
  const hide = () => { tip.hidden = true; };
  root.querySelectorAll('[data-tip]').forEach(el => {
    el.addEventListener('mouseenter', () => show(el));
    el.addEventListener('focus', () => show(el));
    el.addEventListener('mouseleave', hide);
    el.addEventListener('blur', hide);
  });
  root.addEventListener('scroll', hide, { passive: true });
  // WCAG 1.4.13: an open tooltip must close with Escape without losing focus.
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
}

/* -------------------------------------------------------- fullscreen ------- */
// «Vollbild» (item 6.12) uses the canonical modal (C.openModal, size xl) rather
// than the former chart-specific overlay: ONE dialog anatomy for every dialog,
// with focus trap, Escape, backdrop click and focus return wired by openModal.
// The title moves into the modal header (white on the scrim, CD anatomy), so the
// clone loses its own header and kebab menu. Crucially, the SVG is redrawn at the
// MEASURED modal width, not copied as a scaled clone. The clone would retain the
// card viewBox, making phone «Vollbild» SMALLER than inline (item 6.1: 1 user
// unit = 1 CSS pixel, labels remain 12/14px).
function openChartFullscreen(figure) {
  const title = ((figure.querySelector('.chart__title') || {}).textContent || 'Diagramm').trim();
  const found = chartRegistry.get(figure.id);

  const clone = figure.cloneNode(true);
  clone.removeAttribute('id');   // querySelectorAll('[id]') excludes the root; avoid a duplicate ID.
  clone.querySelectorAll('.chart__head').forEach((h) => h.remove()); // Do not duplicate title and menu.
  clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  clone.querySelectorAll('[aria-labelledby]').forEach((el) => el.removeAttribute('aria-labelledby'));
  clone.querySelectorAll('details').forEach((d) => d.removeAttribute('open'));

  C.openModal({ title, size: 'xl', body: clone.outerHTML });
  const dialogs = document.querySelectorAll('.modal');
  const dlg = dialogs[dialogs.length - 1];   // openModal appends the modal last.
  if (!dlg) return;
  const plot = dlg.querySelector('.chart__plot[data-chart]');
  if (found && found.spec && plot) {
    const w = plot.clientWidth || plot.getBoundingClientRect().width;
    if (w) plot.innerHTML = renderSvg(found.spec, found.result, w);
  }
  // Wire the tooltip AFTER redrawing (otherwise listeners remain on the replaced
  // SVG) and anchor it to the positioned ancestor.
  wireCharts(dlg.querySelector('.modal__content') || dlg);
}

/* ------------------------------------------------- chart action menus ------ */
// Wire every chart's kebab menu in `root` (call after each grid render). Charts
// with an SVG get CSV/Excel/PNG/fullscreen; the map figure carries only "Link".
export function wireChartMenus(root) {
  wireMenu(root, (action, menuId, trigger) => {
    const figure = trigger.closest('.chart');
    if (!figure) return;
    const title = ((figure.querySelector('.chart__title') || {}).textContent || 'Diagramm').trim();
    const name = fileSlug(title, DEFAULT_CHART_FILE_SLUG);
    // Failure and unavailable paths use error/warning toasts (CD notification
    // anatomy), not the default success green.
    if (action === 'link') { copyText(location.href).then((ok) => (ok ? toast('Link kopiert.') : toast('Kopieren nicht möglich.', 'error', 'WarningCircle'))); return; }

    // The map is a WebGL canvas (no SVG/table): Vollbild uses the Fullscreen API,
    // Image export reads the canvas (needs preserveDrawingBuffer on the map).
    if (figure.classList.contains('chart--map')) {
      if (action === 'fullscreen') {
        const el = figure.querySelector('.dash-map') || figure;
        requestFullscreen(el, {
          source: 'charts',
          onUnavailable: () => figure.isConnected && toast('Vollbild ist in diesem Browser nicht verfügbar.', 'warning', 'WarningCircle'),
          onRejected: () => figure.isConnected && toast('Vollbild konnte nicht geöffnet werden.', 'error', 'WarningCircle'),
        });
        return;
      }
      if (action === 'png') {
        const canvas = figure.querySelector('canvas');
        if (!canvas || !canvas.toBlob) { toast('Bild-Export fehlgeschlagen.', 'error', 'WarningCircle'); return; }
        canvas.toBlob((blob) => {
          if (!blob) { toast('Bild-Export fehlgeschlagen.', 'error', 'WarningCircle'); return; }
          const url = URL.createObjectURL(blob), a = document.createElement('a');
          a.href = url; a.download = name + '.png'; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Bild heruntergeladen.');
        }, 'image/png');
        return;
      }
      toast('Für die Karte nicht verfügbar.', 'warning', 'WarningCircle'); return;
    }

    const table = figure.querySelector('.chart__table table');
    const svg = figure.querySelector('.chart__svg');
    if (action === 'fullscreen') { openChartFullscreen(figure); return; }
    if (action === 'csv' && table) { download(tableToCsv(table), name + '.csv', 'text/csv;charset=utf-8'); toast('CSV heruntergeladen.'); return; }
    if (action === 'xls' && table) { download(tableToXls(table, title), name + '.xls', 'application/vnd.ms-excel'); toast('Excel-Datei heruntergeladen.'); return; }
    if (action === 'png' && svg) { svgToPng(svg, name + '.png').then(() => toast('Bild heruntergeladen.')).catch(() => toast('Bild-Export fehlgeschlagen.', 'error', 'WarningCircle')); return; }
    toast('Für dieses Diagramm nicht verfügbar.', 'warning', 'WarningCircle');
  });
}
