// Dashboard data layer — the Datenportal's analytics provider.
//
// All data comes from data/dashboards.json (plain JSON): each dataset is a small
// row table, and every chart declares a *query spec* rather than reaching into the
// rows directly. The spec is evaluated here in memory with plain array operations
// — the same declarative feel as a BI tool (Superset), but without any query
// engine: no database, no wasm, only JSON from the data folder.
//
// Supported spec: { dataset, select, where, groupBy, agg, orderBy, limit }
//   where:   { column: value } | { column: [v1, v2] }  (equality / IN)
//            | { column: { gte, lte, gt, lt } }         (range, used by the year filter)
//   orderBy: "column" ascending, "-column" descending
//   groupBy + agg: { sum|avg|count: "column" }

import { fetchJSON } from './fetch-json.js';

const DATA = { datasets: {}, topics: [], dashboards: [] };
// Fällt die Datei aus, sieht das Datenportal aus wie ein Portal ohne Auswertungen
// — nicht wie ein Ladefehler (M18). `ok()` unterscheidet beides, so wie
// core.available() es für die übrigen Bestände tut.
let loaded = false;

async function load() {
  try {
    const json = await fetchJSON('data/dashboards.json', { shape: 'object' });
    DATA.datasets = json.datasets || {};
    DATA.topics = json.topics || [];
    DATA.dashboards = json.dashboards || [];
    loaded = true;
  } catch (e) {
    console.warn('[dashboard-data] could not load data/dashboards.json', e.message);
    loaded = false;
  }
  return DATA;
}

const datasets = () => DATA.datasets;
const dataset = (id) => DATA.datasets[id];
const topics = () => DATA.topics;
const dashboards = () => DATA.dashboards;
const dashboard = (id) => DATA.dashboards.find(d => d.id === id);
const topic = (id) => DATA.topics.find(t => t.id === id);

// Turn a dataset's row arrays into objects, so the rest is plain JS.
function toObjects(ds) {
  const names = (ds.columns || []).map(c => c.name);
  return (ds.rows || []).map(r => Object.fromEntries(names.map((n, i) => [n, r[i]])));
}

// A range predicate is a plain object like { gte, lte, gt, lt } — used by the
// dashboard year filter (Start Zeitreihe / bis Jahr) to trim time series.
function isRange(want) {
  return want && typeof want === 'object' && !Array.isArray(want)
    && ['gte', 'lte', 'gt', 'lt'].some(k => k in want);
}

function applyWhere(rows, where) {
  if (!where) return rows;
  return rows.filter(row => Object.entries(where).every(([col, want]) => {
    const v = row[col];
    if (isRange(want)) {
      return (want.gte == null || v >= want.gte) && (want.lte == null || v <= want.lte)
        && (want.gt == null || v > want.gt) && (want.lt == null || v < want.lt);
    }
    return Array.isArray(want) ? want.includes(v) : v === want;
  }));
}

function applyGroup(rows, groupBy, agg) {
  if (!groupBy) return rows;
  const [fn, col] = Object.entries(agg || { count: '*' })[0];
  const buckets = new Map();
  for (const row of rows) {
    const key = row[groupBy];
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return [...buckets].map(([key, group]) => {
    const vals = group.map(r => Number(r[col])).filter(Number.isFinite);
    const value = fn === 'sum' ? vals.reduce((a, b) => a + b, 0)
      : fn === 'avg' ? (vals.reduce((a, b) => a + b, 0) / (vals.length || 1))
        : group.length;
    return { [groupBy]: key, [col === '*' ? 'count' : col]: value };
  });
}

function applyOrder(rows, orderBy) {
  if (!orderBy) return rows;
  const desc = orderBy.startsWith('-');
  const col = desc ? orderBy.slice(1) : orderBy;
  return [...rows].sort((a, b) => {
    const x = a[col], y = b[col];
    const cmp = (typeof x === 'number' && typeof y === 'number')
      ? x - y : String(x).localeCompare(String(y), 'de');
    return desc ? -cmp : cmp;
  });
}

/**
 * Evaluate a chart's query spec against its dataset. Returns { columns, rows,
 * label } where rows are objects keyed by column name.
 */
function query(spec) {
  const ds = dataset(spec.dataset);
  if (!ds) return { columns: [], rows: [], label: spec.dataset, error: `Unbekanntes Dataset «${spec.dataset}»` };

  let rows = toObjects(ds);
  rows = applyWhere(rows, spec.where);
  rows = applyGroup(rows, spec.groupBy, spec.agg);
  rows = applyOrder(rows, spec.orderBy);
  if (spec.limit) rows = rows.slice(0, spec.limit);
  if (spec.select && !spec.groupBy) {
    rows = rows.map(r => Object.fromEntries(spec.select.map(c => [c, r[c]])));
  }
  const columns = rows.length ? Object.keys(rows[0]) : (spec.select || []);
  return { columns, rows, label: ds.label || spec.dataset };
}

export const dashData = {
  load, ok: () => loaded, datasets, dataset, topics, dashboards, dashboard, topic, query,
};
export default dashData;
