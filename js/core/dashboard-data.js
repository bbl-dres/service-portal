// Dashboard data layer: the data portal's analytics provider.
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

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const safeDictionary = (value = {}) => Object.assign(Object.create(null), value);
const DATA = { datasets: Object.create(null), topics: [], dashboards: [] };
// If the file fails, the data portal looks like a portal without dashboards
// rather than one with a loading error (M18). `ok()` distinguishes the cases,
// as core.available() does for other datasets.
let loaded = false;
let pending = null;

function validateRecords(records, path) {
  if (!Array.isArray(records) || records.some((record) => !isRecord(record))) {
    throw new Error(`expected a record list: ${path}`);
  }
  return records;
}

function validatePayload(json) {
  if (!isRecord(json.datasets)) throw new Error('expected an object: dashboards.datasets');
  const topics = validateRecords(json.topics, 'dashboards.topics');
  const dashboards = validateRecords(json.dashboards, 'dashboards.dashboards');
  const topicIds = new Set();

  for (const [id, dataset] of Object.entries(json.datasets)) {
    if (!isRecord(dataset)) throw new Error(`expected a dataset object: dashboards.datasets.${id}`);
    const columns = validateRecords(dataset.columns, `dashboards.datasets.${id}.columns`);
    if (columns.some((column) => typeof column.name !== 'string' || !column.name.trim())) {
      throw new Error(`invalid column: dashboards.datasets.${id}.columns`);
    }
    if (!Array.isArray(dataset.rows) || dataset.rows.some((row) => !Array.isArray(row))) {
      throw new Error(`expected row arrays: dashboards.datasets.${id}.rows`);
    }
  }

  for (const topic of topics) {
    if (typeof topic.id !== 'string' || !topic.id.trim()) throw new Error('invalid topic ID');
    topicIds.add(topic.id);
  }
  for (const dashboard of dashboards) {
    if (typeof dashboard.id !== 'string' || !dashboard.id.trim()) throw new Error('invalid dashboard ID');
    if (typeof dashboard.topicId !== 'string' || !topicIds.has(dashboard.topicId)) {
      throw new Error(`invalid dashboard topic: dashboard.${dashboard.id}.topicId`);
    }
    if (dashboard.kpis != null) validateRecords(dashboard.kpis, `dashboard.${dashboard.id}.kpis`);
    const charts = validateRecords(dashboard.charts, `dashboard.${dashboard.id}.charts`);
    if (dashboard.tabs != null) validateRecords(dashboard.tabs, `dashboard.${dashboard.id}.tabs`);
    const chartIds = new Set();
    for (const chart of charts) {
      if (typeof chart.id !== 'string' || !chart.id.trim() || chartIds.has(chart.id)) {
        throw new Error(`invalid chart ID: dashboard.${dashboard.id}.charts`);
      }
      chartIds.add(chart.id);
      if (!isRecord(chart.query) || typeof chart.query.dataset !== 'string'
        || !hasOwn(json.datasets, chart.query.dataset)) {
        throw new Error(`invalid query: dashboard.${dashboard.id}.charts.${chart.id}`);
      }
      if (chart.query.orderBy != null && typeof chart.query.orderBy !== 'string') {
        throw new Error(`invalid sort: dashboard.${dashboard.id}.charts.${chart.id}`);
      }
      if (chart.query.select != null && (!Array.isArray(chart.query.select)
        || chart.query.select.some((column) => typeof column !== 'string'))) {
        throw new Error(`invalid column selection: dashboard.${dashboard.id}.charts.${chart.id}`);
      }
      if (chart.query.where != null && !isRecord(chart.query.where)) {
        throw new Error(`invalid filter: dashboard.${dashboard.id}.charts.${chart.id}`);
      }
    }
    for (const tab of dashboard.tabs || []) {
      if (typeof tab.id !== 'string' || !tab.id.trim()
        || !Array.isArray(tab.charts)
        || tab.charts.some((chartId) => typeof chartId !== 'string' || !chartIds.has(chartId))) {
        throw new Error(`invalid chart list: dashboard.${dashboard.id}.tabs`);
      }
    }
  }

  return { datasets: safeDictionary(json.datasets), topics, dashboards };
}

function clearData() {
  DATA.datasets = Object.create(null);
  DATA.topics = [];
  DATA.dashboards = [];
}

function load() {
  if (loaded) return Promise.resolve(DATA);
  if (pending) return pending;
  pending = (async () => {
    try {
      const next = validatePayload(await fetchJSON('data/dashboards.json', { shape: 'object' }));
      DATA.datasets = next.datasets;
      DATA.topics = next.topics;
      DATA.dashboards = next.dashboards;
      loaded = true;
    } catch (e) {
      console.warn('[dashboard-data] could not load data/dashboards.json', e.message);
      clearData();
      loaded = false;
    } finally {
      pending = null;
    }
    return DATA;
  })();
  return pending;
}

const datasets = () => DATA.datasets;
const dataset = (id) => hasOwn(DATA.datasets, id) ? DATA.datasets[id] : undefined;
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
// dashboard's start/end year filter to trim time series.
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
  if (!isRecord(spec) || typeof spec.dataset !== 'string') {
    return { columns: [], rows: [], label: '', error: 'Ungültige Dataset-Abfrage' };
  }
  if ((spec.orderBy != null && typeof spec.orderBy !== 'string')
    || (spec.select != null && (!Array.isArray(spec.select)
      || spec.select.some((column) => typeof column !== 'string')))
    || (spec.where != null && !isRecord(spec.where))) {
    return { columns: [], rows: [], label: spec.dataset, error: 'Ungültige Dataset-Abfrage' };
  }
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
