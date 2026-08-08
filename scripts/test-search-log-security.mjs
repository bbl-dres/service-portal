// Stored search telemetry is untrusted input. Prove malformed records are
// quarantined before their numeric fields reach the diagnostic table.
const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};

let failures = 0;
const check = (condition, label) => {
  console.log(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures++;
};

values.set('bbl.searchlog', JSON.stringify([
  { q: 'valid', n: 3, at: 10 },
  { q: 'zero', n: 0, at: 11 },
  { q: 'attack', n: '<img src=x onerror=alert(1)>', at: 12 },
  { q: 'bad-date', n: 2, at: 'today' },
  null,
]));

const log = await import('../js/search/search-log.js');
const first = log.summary();
check(first.total === 2 && first.rows.length === 2,
  'malformed stored rows are quarantined individually');
check(first.zero === 1 && first.rows[0].q === 'zero' && first.rows[0].hits === 0,
  'valid zero-result statistics retain their ordering and numeric type');
check(first.rows.every((row) => Number.isInteger(row.hits) && Number.isInteger(row.count)),
  'summary table counts can never contain markup');

log.record('ignored', '<svg onload=alert(1)>');
check(log.summary().total === 2, 'record rejects a non-numeric result count');
log.record('valid', 7.9);
const updated = log.summary();
check(updated.total === 3 && updated.rows.find((row) => row.q === 'valid')?.hits === 7,
  'record stores a finite non-negative integer count');

log.clear();
check(log.summary().total === 0, 'clear removes the local notebook');

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
