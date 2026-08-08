// Minimal SVG chart renderers for the Datenportal.
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

import C, { menu, wireMenu, toast } from './components.js';
import { download, tableToCsv, tableToXls, svgToPng, copyText, fileSlug } from './export.js';

// Kategoriale Palette und Diagramm-Tinte kommen aus dem Token-Layer
// (css/tokens.css --chart-series-* / --chart-ink*). Die Werte werden zur
// Renderzeit AUFGELÖST, nicht als `var(...)` in die SVG-Attribute geschrieben:
// der PNG-Export serialisiert das SVG und zeichnet es auf ein Canvas, wo
// Custom Properties nicht mehr auflösen würden. Fallbacks entsprechen den Tokens.
const cssVar = (name, fallback) => {
  if (typeof document === 'undefined') return fallback;
  // Skin overrides are body-scoped. The body's computed style includes both
  // inherited root tokens and `.body--intranet` overrides.
  const scope = document.body || document.documentElement;
  const v = getComputedStyle(scope).getPropertyValue(name).trim();
  return v || fallback;
};
const paletteCache = { key: '' };
function palette() {
  // Der Skin kann die Tokens theoretisch überschreiben — Cache pro body-Klasse.
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
// Der frühere SERIES-Export ist weg: er war eine Literal-Kopie von
// --chart-series-1..7 (tokens.css) MIT null Importern — die Legende liest in
// Wahrheit palette().series, das die CSS-Variablen auflöst (Design-Review C20).

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
// --- Breitenabhängige Geometrie (Item 6.1) ----------------------------------
// Vorher: fester viewBox 720x300 plus `.chart__svg{width:100%}` — SVG skaliert
// Text mit der Geometrie, also schrumpfte JEDE Beschriftung mit der Karte.
// Gemessen: 4.10px bei 320, 5.27px bei 390, 10.65px bei 768 und 7.7px bei 1440
// (zweispaltiges Grid) — die Desktop-Darstellung war unlesbarer als die Tablet-
// Darstellung. Jetzt wird in CSS-Pixeln gezeichnet: 1 User-Unit = 1 px, damit
// font-size="12" wirklich 12px ergibt (CDs kleinste Stufe ist 0.75rem).
function geom(width, { r = 20, t = 20, b = 40 } = {}) {
  const W = Math.max(240, Math.round(width || 720));
  const H = Math.round(Math.max(200, Math.min(320, W * 0.5)));
  return { W, H, P: { t, r, b, l: W < 420 ? 36 : 52 } };
}
// Nur so viele x-Beschriftungen zeichnen, wie nebeneinander Platz haben — sonst
// überlappen sie auf schmalen Karten statt zu verschwinden.
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

// Zähl-Achsen dürfen keine Bruchteile anzeigen («2,5 Gebäude», Item 6.7): wenn
// das Maximum ganzzahlig und klein ist, die Tick-Zahl so wählen, dass alle
// Schritte ganzzahlig bleiben.
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

// Textalternative zum Diagramm (Item 6.2) — OHNE sichtbare Affordanz.
//
// Ausgangslage: die Tabelle lag `hidden` im DOM und diente nur als Quelle für den
// CSV/Excel-Export. `hidden` nimmt sie aber auch aus dem Accessibility-Baum, und
// das äussere <svg> ist `role="img"`, was alle Nachfahren daraus entfernt — KEIN
// Diagramm hatte also eine erreichbare Textalternative (WCAG 1.1.1).
//
// Entscheid: keine «Daten als Tabelle»-Aufklappzeile (visuelle Ruhe; Sehende
// nutzen CSV/Excel im Diagrammmenü). Stattdessen bleibt die Tabelle für
// Hilfsmittel erreichbar — `.sr-only` statt `hidden` — mit <caption>, damit
// Screenreader wissen, zu welchem Diagramm sie gehört. Bewusst KEIN
// `.table-wrapper`/`data-scroll-region`: das würde einen Tabulator-Stopp in
// visuell verborgenen Inhalt setzen. Der Export liest weiter `.chart__table table`.
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
  // rechts Platz für das Endpunkt-Label; auf schmalen Karten weniger
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

  // Ausdünnen statt kollidieren; erste und letzte Marke bleiben immer stehen.
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
    // direct label on the endpoint only — 14px (--fs-sm-Äquivalent): 13 liegt
    // zwischen den CD-Stufen (Item chart-fs-1)
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
  // max(1, …): auf schmalen Karten mit vielen Kategorien wurde `per` negativ
  // und die Balken verschwanden (code-review A11).
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
  // Breite aus dem Container; die Beschriftungsspalte war fix 210 von 720 (29%)
  // und blieb auf einer 300px-Karte 29% breit, obwohl dort nur ~8 Zeichen passen
  // (Item 6.10). Jetzt anteilig mit Ober- und Untergrenze.
  const W = Math.max(240, Math.round(width || 720));
  const rowH = W < 480 ? 30 : 34;
  const labelW = Math.round(Math.max(72, Math.min(210, W * 0.32)));
  const valueW = W < 480 ? 56 : 90;
  const P = { t: 8, r: valueW, b: 8, l: labelW };
  const H = P.t + P.b + rows.length * rowH;
  const max = niceMax(Math.max(...rows.map(r => Number(r[y]) || 0)));
  const bw = Math.max(8, W - P.l - P.r);
  const thick = Math.min(24, rowH - 12);
  // Beschriftung an der verfügbaren Spaltenbreite kürzen, nicht an einer festen
  // Zeichenzahl — der volle Text steht im <title> und in der Datentabelle.
  const maxChars = Math.max(8, Math.floor((labelW - 14) / 6.2));

  const bars = rows.map((r, i) => {
    const v = Number(r[y]) || 0;
    const w = (v / max) * bw;
    const by = P.t + i * rowH + (rowH - thick) / 2;
    const label = String(r[x]);
    const short = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;
    // 12/14 statt 13: die CD-Skala kennt keine 13px-Stufe — 12 für die
    // Kategorie-Beschriftung, 14 für den betonten Wert (Item chart-fs-1).
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
// Parts-of-whole for a small set of categories (e.g. Eigentumsverhältnis). Slices
// use the categorical palette in order so they match the legend the wrapper draws;
// a 2px surface ring separates them; the share (%) is labelled on slices >= 6%.
function pieChart({ id, rows, x, y, unit, width }) {
  const pal = palette();
  const INK = pal.ink, INK_MUTED = pal.inkMuted, GRID = pal.grid, AXIS = pal.axis, SURFACE = pal.surface;
  const SER = pal.series;
  // Vorher 720x300 mit R=118: der Kreis füllte ein Drittel der Karte, zwei Drittel
  // blieben leer (Item 6.9). Jetzt ein annähernd quadratisches Feld aus der
  // Containerbreite, Radius aus der kleineren Kante.
  const W = Math.max(240, Math.round(width || 720));
  const H = Math.round(Math.max(200, Math.min(340, W * 0.62)));
  const cx = W / 2, cy = H / 2 + 2;
  const R = Math.round(Math.min(W, H) / 2 - 12);
  // Ring statt Vollkreis: ruhigere Form, und die Mitte trägt die Gesamtsumme.
  // Als echte Kreisring-Pfade (äusserer Bogen + innerer Bogen zurück), NICHT als
  // Vollkreis mit aufgelegtem Deckel — ein Deckel müsste die Hintergrundfarbe
  // treffen und würde im Vollbild-Overlay oder auf getönten Karten auffallen.
  const Ri = Math.round(R * 0.58);
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row[y]) || 0), 0);
  const at = (a, rad) => `${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`;
  const ring = (a0, a1, frac) => {
    const big = frac > 0.5 ? 1 : 0;
    if (frac >= 0.999) {
      // geschlossener Ring: zwei Halbbögen aussen, zwei zurück innen
      return `M${at(-Math.PI / 2, R)} A${R} ${R} 0 1 1 ${at(Math.PI / 2, R)} A${R} ${R} 0 1 1 ${at(-Math.PI / 2, R)} Z`
        + `M${at(-Math.PI / 2, Ri)} A${Ri} ${Ri} 0 1 0 ${at(Math.PI / 2, Ri)} A${Ri} ${Ri} 0 1 0 ${at(-Math.PI / 2, Ri)} Z`;
    }
    return `M${at(a0, R)} A${R} ${R} 0 ${big} 1 ${at(a1, R)} L${at(a1, Ri)} A${Ri} ${Ri} 0 ${big} 0 ${at(a0, Ri)} Z`;
  };
  let a0 = -Math.PI / 2;
  const mid = (R + Ri) / 2;   // Beschriftung mittig im Ringband
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
  // Prozentwert nur, wenn das Segment breit genug ist — im Ringband ist weniger
  // Platz als in einem Vollkreis-Keil. Oberflächenfarbe (Token --chart-surface,
  // Standard Weiss) statt Literal #fff, wie bei allen anderen Mark-Konturen;
  // auf den 700er-Tönen: >= 5.02:1. 14 statt 13: keine 13px-Stufe im CD.
  const labels = slices.filter((s) => s.frac >= 0.08).map((s) =>
    `<text x="${s.lx.toFixed(1)}" y="${s.ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="${SURFACE}" font-size="14" font-weight="700">${Math.round(s.frac * 100)}%</text>`).join('');
  // Gesamtsumme in der Mitte — nur wenn der Innenkreis sie trägt.
  const totalText = fmt(total, unit);
  const centre = Ri >= 44 && totalText.length <= 12
    ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" dominant-baseline="middle" fill="${INK}" font-size="${Ri >= 60 ? 20 : 16}" font-weight="700">${esc(totalText)}</text>`
      + `<text x="${cx}" y="${cy + (Ri >= 60 ? 18 : 14)}" text-anchor="middle" dominant-baseline="middle" fill="${INK_MUTED}" font-size="12">Total</text>`
    : '';
  return { svg: `<svg viewBox="0 0 ${W} ${H}" class="chart__svg" role="img" aria-labelledby="${id}-t">${paths}${labels}${centre}</svg>`,
    names: rows.map((r) => String(r[x])) };
}

/* ------------------------------------------------------ stacked area ------- */
// Zusammensetzung über die Zeit (Muster: Energiedashboard Bund) — Serien werden
// kumulativ gestapelt; jede Fläche ist ein geschlossener Pfad (obere Kante hin,
// untere Kante zurück). Reihenfolge der Serien = erste Vorkommnis in den Daten;
// die Legende kommt vom Wrapper. Hover trägt jede Fläche als data-tip.
function areaChart({ id, rows, x, y, series, unit, width }) {
  const pal = palette();
  const INK_MUTED = pal.inkMuted, GRID = pal.grid, AXIS = pal.axis, SURFACE = pal.surface;
  const SER = pal.series;
  const { W, H, P } = geom(width);
  const names = series ? [...new Set(rows.map((r) => r[series]))] : ['__single'];
  const xs = [...new Set(rows.map((r) => r[x]))].sort((a, b) => a - b);
  // Kumulative Summen je x — das Maximum der Achse ist die Gesamthöhe.
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

/* -------------------------------------------------- Kennzahlen-Tabelle ----- */
// Sichtbare Mehrjahres-Tabelle (Muster: Geschäftsbericht Stadt Zürich, «State of
// the Estate» UK): Zeilen = Kennzahlen, Spalten = Jahre, optional Fussnoten.
// Bewusst KEIN SVG — die Tabelle IST die Darstellung und zugleich ihre eigene
// Textalternative; im Menü entfällt deshalb «Als Bild (PNG)». Eine Zeile, deren
// Jahreswerte alle leer sind, ist ein Gruppentitel (Zürich-Anatomie); eine
// `einheit`-Spalte im Dataset beschriftet die Zeile statt jeder Zelle.
const TABLE_MENU = CHART_MENU.filter((m) => m.action !== 'png');
function kennzahlenTable(spec, result) {
  const cols = result.columns;
  const x = spec.x || cols[0];
  const hasEinheit = cols.includes('einheit');
  const yearCols = cols.filter((c) => c !== x && c !== 'einheit');
  const head = `<tr><th scope="col">${esc(spec.xLabel || 'Kennzahl')}</th>${
    yearCols.map((c) => `<th scope="col" class="num">${esc(c)}</th>`).join('')}</tr>`;
  const body = result.rows.map((r) => {
    const isGroup = yearCols.every((c) => r[c] == null || r[c] === '');
    if (isGroup) {
      return `<tr class="chart__trow-group"><th scope="colgroup" colspan="${yearCols.length + 1}">${esc(r[x])}</th></tr>`;
    }
    const unit = hasEinheit ? r.einheit : spec.unit;
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
  // Kennzahlen-Tabelle: kein Plot-Feld, kein zweiter Durchgang — die Tabelle
  // steht direkt in der Karte (und ersetzt die sr-only-Zwillingstabelle).
  if (spec.form === 'table') {
    return `<figure class="chart card card--universal chart--table" id="${id}">
      <figcaption class="chart__head">
        <h3 class="chart__title" id="${id}-t">${esc(title)}</h3>
        <div class="chart__actions">${menu({ menuId: id, label: 'Tabellen-Aktionen', items: TABLE_MENU })}</div>
      </figcaption>
      ${kennzahlenTable(spec, result)}
      ${note ? `<p class="chart__note">${esc(note)}</p>` : ''}
    </figure>`;
  }
  // Namen für die Legende ohne Geometrie ermitteln (die Legende steht über dem
  // Feld, das erst im zweiten Durchgang gefüllt wird).
  const names = spec.series ? [...new Set(rows.map((r) => r[spec.series]))]
    : spec.form === 'pie' ? rows.map((r) => String(r[spec.x])) : [];
  // `.chart__plot` bleibt LEER: die Breite ist erst bekannt, wenn die Karte im
  // Layout steht. Der Aufrufer füllt sie synchron per renderSvg() (Item 6.1).
  // Keine `.chart__unit`-Pille mehr im Kopf: die Einheit steht ohnehin an jedem
  // Wert (Achsenticks, Direktlabels, Tooltip, Datentabelle) — im Kopf war sie
  // eine Dopplung, die dem Kebab Platz wegnahm.
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
 * Zeichnet das SVG für eine bereits im Layout stehende Karte. `width` ist die
 * gemessene Innenbreite von `.chart__plot`; 1 User-Unit = 1 CSS-Pixel, damit
 * font-size="12" auch 12px ergibt. Muss SYNCHRON nach dem innerHTML-Schreiben
 * laufen, damit Tests, die auf ein gerendertes SVG pollen, es vorfinden.
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

/** Füllt jedes leere `.chart__plot[data-chart]` unter `root`. `lookup(id)`
 *  liefert `{ spec, result }`. Gibt eine Aufräumfunktion für den ResizeObserver
 *  zurück — der Aufrufer MUSS sie beim Neuzeichnen der Route aufrufen. */
// Das Vollbild (Item 6.12) zeichnet mit spec/result in Modalbreite NEU statt das
// skalierte SVG zu klonen — paintCharts merkt sich beide je Diagramm-ID, damit
// wireChartMenus keinen lookup-Parameter durch alle Seiten schleifen muss.
const chartRegistry = new Map();
export function paintCharts(root, lookup) {
  const paint = () => {
    root.querySelectorAll('.chart__plot[data-chart]').forEach((p) => {
      const found = lookup(p.dataset.chart);
      if (!found || !found.spec) return;
      chartRegistry.set(p.dataset.chart, found);
      const w = p.clientWidth || p.getBoundingClientRect().width;
      if (!w) return;                       // unsichtbar (z. B. inaktiver Tab)
      p.innerHTML = renderSvg(found.spec, found.result, w);
    });
  };
  paint();
  if (typeof ResizeObserver !== 'function') return () => {};
  let raf = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(paint);     // ein Neuzeichnen pro Frame
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
  // WCAG 1.4.13: der eingeblendete Tooltip muss mit Escape schliessbar sein,
  // ohne den Fokus zu verlieren.
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
}

/* -------------------------------------------------------- fullscreen ------- */
// «Vollbild» (Item 6.12): läuft über das kanonische Modal (C.openModal, Grösse
// xl) statt über das frühere chart-spezifische Overlay — EINE Dialog-Anatomie für
// alle Dialoge; Fokusfalle, Escape, Backdrop-Klick und Fokus-Rückgabe verdrahtet
// openModal. Der Titel wandert in den Modal-Kopf (weiss auf dem Scrim, CD-
// Anatomie), darum verliert der Klon seinen eigenen Kopf samt Kebab-Menü.
// Wichtig: das SVG wird mit der GEMESSENEN Modalbreite neu gezeichnet, nicht als
// skalierter Klon übernommen — der Klon trüge den viewBox der Karte, und auf dem
// Telefon wäre «Vollbild» damit KLEINER als die Inline-Darstellung (Item 6.1:
// 1 User-Unit = 1 CSS-Pixel, Beschriftungen bleiben 12/14px).
function openChartFullscreen(figure) {
  const title = ((figure.querySelector('.chart__title') || {}).textContent || 'Diagramm').trim();
  const found = chartRegistry.get(figure.id);

  const clone = figure.cloneNode(true);
  clone.removeAttribute('id');   // querySelectorAll('[id]') fasst die Wurzel nicht — sonst doppelte ID
  clone.querySelectorAll('.chart__head').forEach((h) => h.remove());   // Titel + Menü stehen nicht doppelt
  clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  clone.querySelectorAll('[aria-labelledby]').forEach((el) => el.removeAttribute('aria-labelledby'));
  clone.querySelectorAll('details').forEach((d) => d.removeAttribute('open'));

  C.openModal({ title, size: 'xl', body: clone.outerHTML });
  const dialogs = document.querySelectorAll('.modal');
  const dlg = dialogs[dialogs.length - 1];   // openModal hängt das Modal zuletzt an
  if (!dlg) return;
  const plot = dlg.querySelector('.chart__plot[data-chart]');
  if (found && found.spec && plot) {
    const w = plot.clientWidth || plot.getBoundingClientRect().width;
    if (w) plot.innerHTML = renderSvg(found.spec, found.result, w);
  }
  // Tooltip NACH dem Neuzeichnen verdrahten (sonst hingen die Listener am
  // ersetzten SVG) und am positionierten Vorfahren verankern.
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
    const name = fileSlug(title, 'diagramm');
    // Fehl- und «nicht verfügbar»-Pfade melden sich als error-/warning-Toast
    // (CD-Notification-Anatomie), nicht mit dem Erfolgs-Grün des Standardfalls.
    if (action === 'link') { copyText(location.href).then((ok) => (ok ? toast('Link kopiert.') : toast('Kopieren nicht möglich.', 'error', 'WarningCircle'))); return; }

    // The map is a WebGL canvas (no SVG/table): Vollbild uses the Fullscreen API,
    // "Als Bild" reads the canvas (needs preserveDrawingBuffer on the map).
    if (figure.classList.contains('chart--map')) {
      if (action === 'fullscreen') { const el = figure.querySelector('.dash-map') || figure; if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); return; }
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

export default { chart, wireCharts, wireChartMenus, renderSvg, paintCharts };
