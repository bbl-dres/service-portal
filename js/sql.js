// Mock analytical query layer — "Superset, but mocked".
//
// Real BI portals (e.g. data.finance.admin.ch, which runs Apache Superset) put a
// SQL engine between the dashboard and a warehouse. This module stands in for
// that: datasets are row arrays loaded from data/dashboards.json, and charts
// declare a *query spec* instead of reaching into the data directly. It also
// renders the equivalent SQL text so the "Abfrage anzeigen" affordance can show
// what a chart would have run — the same feel as Superset's "View query".
//
// Supported spec: { dataset, select, where, groupBy, agg, orderBy, limit }
//   where:   { column: value } | { column: [v1, v2] }  (equality / IN)
//   orderBy: "column" ascending, "-column" descending
//   groupBy + agg: { sum|avg|count: "column" }

const DATA = { datasets: {}, topics: [], dashboards: [] };

async function load() {
  try {
    const r = await fetch('data/dashboards.json');
    if (!r.ok) throw new Error(r.status + ' data/dashboards.json');
    const json = await r.json();
    DATA.datasets = json.datasets || {};
    DATA.topics = json.topics || [];
    DATA.dashboards = json.dashboards || [];
  } catch (e) {
    console.warn('[sql] could not load data/dashboards.json', e.message);
  }
  return DATA;
}

const datasets = () => DATA.datasets;
const dataset = (id) => DATA.datasets[id];
const topics = () => DATA.topics;
const dashboards = () => DATA.dashboards;
const dashboard = (id) => DATA.dashboards.find(d => d.id === id);
const topic = (id) => DATA.topics.find(t => t.id === id);

function colIndex(ds, name) {
  return (ds.columns || []).findIndex(c => c.name === name);
}

// Turn a dataset's row arrays into objects, so the rest is plain JS.
function toObjects(ds) {
  const names = (ds.columns || []).map(c => c.name);
  return (ds.rows || []).map(r => Object.fromEntries(names.map((n, i) => [n, r[i]])));
}

function applyWhere(rows, where) {
  if (!where) return rows;
  return rows.filter(row => Object.entries(where).every(([col, want]) =>
    Array.isArray(want) ? want.includes(row[col]) : row[col] === want));
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

// The SQL text is for display only — it documents what the spec means.
function toSQL(spec) {
  const ds = dataset(spec.dataset);
  const cols = spec.groupBy
    ? [spec.groupBy, ...Object.entries(spec.agg || {}).map(([fn, c]) => `${fn.toUpperCase()}(${c}) AS ${c}`)]
    : (spec.select || (ds ? ds.columns.map(c => c.name) : ['*']));
  const lines = [`SELECT ${cols.join(', ')}`, `FROM ${spec.dataset}`];
  if (spec.where) {
    lines.push('WHERE ' + Object.entries(spec.where).map(([c, v]) =>
      Array.isArray(v) ? `${c} IN (${v.map(x => typeof x === 'number' ? x : `'${x}'`).join(', ')})`
        : `${c} = ${typeof v === 'number' ? v : `'${v}'`}`).join(' AND '));
  }
  if (spec.groupBy) lines.push(`GROUP BY ${spec.groupBy}`);
  if (spec.orderBy) lines.push(`ORDER BY ${spec.orderBy.replace(/^-/, '')}${spec.orderBy.startsWith('-') ? ' DESC' : ''}`);
  if (spec.limit) lines.push(`LIMIT ${spec.limit}`);
  return lines.join('\n') + ';';
}

/**
 * Run a query spec. Returns { columns, rows, sql, label } where rows are
 * objects keyed by column name.
 */
function query(spec) {
  const ds = dataset(spec.dataset);
  if (!ds) return { columns: [], rows: [], sql: toSQL(spec), label: spec.dataset, error: `Unbekanntes Dataset «${spec.dataset}»` };

  let rows = toObjects(ds);
  rows = applyWhere(rows, spec.where);
  rows = applyGroup(rows, spec.groupBy, spec.agg);
  rows = applyOrder(rows, spec.orderBy);
  if (spec.limit) rows = rows.slice(0, spec.limit);
  if (spec.select && !spec.groupBy) {
    rows = rows.map(r => Object.fromEntries(spec.select.map(c => [c, r[c]])));
  }
  const columns = rows.length ? Object.keys(rows[0]) : (spec.select || []);
  return { columns, rows, sql: toSQL(spec), label: ds.label || spec.dataset };
}

export const sql = {
  load, datasets, dataset, topics, dashboards, dashboard, topic, query, toSQL, colIndex,
};
export default sql;
