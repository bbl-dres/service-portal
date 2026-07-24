// Minimal SVG chart renderers for the Datenportal.
//
// No chart library (the portal is no-build), so the marks follow the house specs
// explicitly: bars <= 24px with a 4px rounded data-end and a square baseline,
// 2px lines with round caps, >= 8px markers carrying a 2px surface ring,
// hairline gridlines, a legend whenever there are two or more series, and
// selective direct labels (endpoint only — never a number on every point).
//
// Categorical palette: CD Bund ramp steps, validated for colour-vision
// deficiency against a white chart surface (worst adjacent CVD dE 10.1,
// normal-vision 26.4, all >= 3:1 contrast). Assign slots in order, never cycle.

export const SERIES = ['#2563eb', '#ea580c', '#059669', '#7c3aed', '#db2777'];
const INK = '#1f2937';        // primary text
const INK_MUTED = '#4b5563';  // axis / secondary text
const GRID = '#e5e7eb';       // hairline gridline
const AXIS = '#d1d5db';       // baseline
const SURFACE = '#ffffff';    // chart surface (cards are white)

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

const ticks = (max, count = 4) =>
  Array.from({ length: count + 1 }, (_, i) => (max / count) * i);

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
  return `<div class="chart__legend">${names.map((n, i) =>
    `<span class="chart__legend-item"><span class="chart__swatch" style="background:${SERIES[i % SERIES.length]}"></span>${esc(n)}</span>`
  ).join('')}</div>`;
}

function tableView(id, columns, rows, unit) {
  const head = columns.map(c => `<th scope="col">${esc(c)}</th>`).join('');
  const body = rows.map(r => `<tr>${columns.map((c, i) =>
    i === 0 ? `<th scope="row">${esc(r[c])}</th>` : `<td>${esc(typeof r[c] === 'number' ? fmt(r[c], unit) : r[c])}</td>`
  ).join('')}</tr>`).join('');
  return `<details class="chart__table" id="${id}-table">
    <summary>Datentabelle anzeigen</summary>
    <div class="table-wrapper"><table class="table table--compact">
      <thead><tr>${head}</tr></thead><tbody>${body}</tbody>
    </table></div>
  </details>`;
}

/* ---------------------------------------------------------------- line ---- */
function lineChart({ id, rows, x, y, series, unit }) {
  const W = 720, H = 300, P = { t: 20, r: 76, b: 40, l: 60 };
  const names = series ? [...new Set(rows.map(r => r[series]))] : ['__single'];
  const xs = [...new Set(rows.map(r => r[x]))].sort((a, b) => a - b);
  const max = niceMax(Math.max(...rows.map(r => Number(r[y]) || 0)));
  const px = (v) => P.l + ((v - xs[0]) / ((xs[xs.length - 1] - xs[0]) || 1)) * (W - P.l - P.r);
  const py = (v) => H - P.b - (v / max) * (H - P.t - P.b);

  const grid = ticks(max).map(t =>
    `<line x1="${P.l}" y1="${py(t)}" x2="${W - P.r}" y2="${py(t)}" stroke="${GRID}" stroke-width="1"/>
     <text x="${P.l - 10}" y="${py(t) + 4}" text-anchor="end" fill="${INK_MUTED}" font-size="12">${fmt(t)}</text>`
  ).join('');

  const xLabels = xs.map(v =>
    `<text x="${px(v)}" y="${H - P.b + 20}" text-anchor="middle" fill="${INK_MUTED}" font-size="12">${esc(v)}</text>`
  ).join('');

  const paths = names.map((name, i) => {
    const pts = rows.filter(r => !series || r[series] === name).sort((a, b) => a[x] - b[x]);
    if (!pts.length) return '';
    const colour = SERIES[i % SERIES.length];
    const d = pts.map((p, j) => `${j ? 'L' : 'M'}${px(p[x])} ${py(p[y])}`).join(' ');
    const dots = pts.map(p =>
      `<circle cx="${px(p[x])}" cy="${py(p[y])}" r="4.5" fill="${colour}" stroke="${SURFACE}" stroke-width="2"
         class="chart__dot" tabindex="0" role="img"
         data-tip="${esc(name === '__single' ? '' : name + ' · ')}${esc(p[x])}: ${esc(fmt(p[y], unit))}"
       ><title>${esc(p[x])}: ${esc(fmt(p[y], unit))}</title></circle>`).join('');
    const last = pts[pts.length - 1];
    // direct label on the endpoint only
    const label = `<text x="${px(last[x]) + 12}" y="${py(last[y]) + 4}" fill="${INK}" font-size="13" font-weight="700">${esc(fmt(last[y], unit))}</text>`;
    const dash = name === 'Ziel' ? ' stroke-dasharray="6 5"' : '';
    return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${dash}/>${dots}${label}`;
  }).join('');

  return { svg: `<svg viewBox="0 0 ${W} ${H}" class="chart__svg" role="img" aria-labelledby="${id}-t">
      ${grid}<line x1="${P.l}" y1="${H - P.b}" x2="${W - P.r}" y2="${H - P.b}" stroke="${AXIS}" stroke-width="1"/>
      ${xLabels}${paths}
    </svg>`, names: names.filter(n => n !== '__single') };
}

/* -------------------------------------------------------------- column ---- */
function columnChart({ id, rows, x, y, series, unit }) {
  const W = 720, H = 300, P = { t: 24, r: 20, b: 40, l: 60 };
  const names = series ? [...new Set(rows.map(r => r[series]))] : ['__single'];
  const cats = [...new Set(rows.map(r => r[x]))];
  const max = niceMax(Math.max(...rows.map(r => Number(r[y]) || 0)));
  const band = (W - P.l - P.r) / cats.length;
  const per = Math.min(24, (band - 8) / names.length);
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
    return `<path d="${barPath(bx, byy, per, h, 4, 'up')}" fill="${SERIES[si % SERIES.length]}"
      class="chart__bar" tabindex="0" role="img"
      data-tip="${esc(name === '__single' ? '' : name + ' · ')}${esc(c)}: ${esc(fmt(v, unit))}"
    ><title>${esc(c)}: ${esc(fmt(v, unit))}</title></path>`;
  }).join('')).join('');

  const xLabels = cats.map((c, ci) =>
    `<text x="${P.l + band * ci + band / 2}" y="${H - P.b + 20}" text-anchor="middle" fill="${INK_MUTED}" font-size="12">${esc(c)}</text>`
  ).join('');

  return { svg: `<svg viewBox="0 0 ${W} ${H}" class="chart__svg" role="img" aria-labelledby="${id}-t">
      ${grid}<line x1="${P.l}" y1="${H - P.b}" x2="${W - P.r}" y2="${H - P.b}" stroke="${AXIS}" stroke-width="1"/>
      ${bars}${xLabels}
    </svg>`, names: names.filter(n => n !== '__single') };
}

/* ------------------------------------------------------- horizontal bar ---- */
function barChart({ id, rows, x, y, unit }) {
  const rowH = 34, P = { t: 8, r: 90, b: 8, l: 210 };
  const W = 720, H = P.t + P.b + rows.length * rowH;
  const max = niceMax(Math.max(...rows.map(r => Number(r[y]) || 0)));
  const bw = W - P.l - P.r;
  const thick = Math.min(24, rowH - 12);

  const bars = rows.map((r, i) => {
    const v = Number(r[y]) || 0;
    const w = (v / max) * bw;
    const by = P.t + i * rowH + (rowH - thick) / 2;
    const label = String(r[x]);
    const short = label.length > 30 ? label.slice(0, 29) + '…' : label;
    return `<text x="${P.l - 12}" y="${by + thick / 2 + 4}" text-anchor="end" fill="${INK}" font-size="13">${esc(short)}<title>${esc(label)}</title></text>
      <path d="${barPath(P.l, by, Math.max(w, 2), thick, 4, 'right')}" fill="${SERIES[0]}"
        class="chart__bar" tabindex="0" role="img" data-tip="${esc(label)}: ${esc(fmt(v, unit))}"
      ><title>${esc(label)}: ${esc(fmt(v, unit))}</title></path>
      <text x="${P.l + Math.max(w, 2) + 10}" y="${by + thick / 2 + 4}" fill="${INK}" font-size="13" font-weight="700">${esc(fmt(v, unit))}</text>`;
  }).join('');

  return { svg: `<svg viewBox="0 0 ${W} ${H}" class="chart__svg" role="img" aria-labelledby="${id}-t">
      <line x1="${P.l}" y1="${P.t}" x2="${P.l}" y2="${H - P.b}" stroke="${AXIS}" stroke-width="1"/>${bars}
    </svg>`, names: [] };
}

/**
 * Render one chart card. `result` is a sql.query() result.
 */
export function chart(spec, result) {
  const { id, title, unit, note } = spec;
  const rows = result.rows;
  if (result.error || !rows.length) {
    return `<figure class="chart card card--universal"><figcaption class="chart__head"><h3 class="chart__title" id="${id}-t">${esc(title)}</h3></figcaption>
      <div class="empty">${esc(result.error || 'Keine Daten für diese Auswahl.')}</div></figure>`;
  }
  const render = spec.form === 'line' ? lineChart : spec.form === 'column' ? columnChart : barChart;
  const { svg, names } = render({ id, rows, x: spec.x, y: spec.y, series: spec.series, unit });

  return `<figure class="chart card card--universal" id="${id}">
    <figcaption class="chart__head">
      <h3 class="chart__title" id="${id}-t">${esc(title)}</h3>
      ${unit ? `<span class="chart__unit">${esc(unit)}</span>` : ''}
    </figcaption>
    ${legend(names)}
    <div class="chart__plot">${svg}</div>
    ${note ? `<p class="chart__note">${esc(note)}</p>` : ''}
    ${tableView(id, result.columns, rows, unit)}
    <details class="chart__sql"><summary>Abfrage anzeigen</summary><pre><code>${esc(result.sql)}</code></pre></details>
  </figure>`;
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
  // WCAG 1.4.13: der eingeblendete Tooltip muss mit Escape schliessbar sein,
  // ohne den Fokus zu verlieren.
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
}

export default { chart, wireCharts, SERIES };
