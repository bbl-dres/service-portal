import { preparePage, uniqueOptions } from '../js/collections.js';

let failures = 0;
const check = (condition, label, actual = '') => {
  console.log(`${condition ? '✓' : '✗'} ${label}${actual ? ` (${actual})` : ''}`);
  if (!condition) failures++;
};

const rows = [{ name: 'C' }, { name: 'A' }, { name: 'B' }];
const originalOrder = rows.map((row) => row.name).join(',');
const prepared = preparePage(rows, {
  compare: (left, right) => left.name.localeCompare(right.name),
  page: 2,
  perPage: 2,
});

check(prepared.sorted.map((row) => row.name).join(',') === 'A,B,C',
  'preparePage sorts a copy of the full collection');
check(prepared.visible.map((row) => row.name).join(',') === 'C'
  && prepared.page === 2 && prepared.totalPages === 2,
  'preparePage returns the requested slice and page metadata');
check(rows.map((row) => row.name).join(',') === originalOrder,
  'preparePage preserves the input array');

const overflow = preparePage(rows, { page: 99, perPage: 2 });
const invalid = preparePage(rows, { page: Number.NaN, perPage: 2 });
const negative = preparePage(rows, { page: -4, perPage: 2 });
const fractional = preparePage(rows, { page: 2.9, perPage: 1 });
const empty = preparePage([], { page: 8, perPage: 10 });
check(overflow.page === 2 && overflow.visible.length === 1,
  'preparePage clamps an overflow page');
check(invalid.page === 1 && invalid.sorted !== rows
  && invalid.visible.map((row) => row.name).join(',') === 'C,A',
  'preparePage clamps an invalid page without sorting when no comparator is supplied');
check(negative.page === 1 && negative.visible.length === 2,
  'preparePage clamps a page below the valid range');
check(fractional.page === 2 && fractional.visible[0] === rows[1],
  'preparePage normalizes a fractional page to an integer');
check(empty.page === 1 && empty.totalPages === 1 && empty.visible.length === 0,
  'preparePage keeps an empty collection on page one');

const optionRows = [
  { group: 'Zürich' }, { group: 'Bern' }, { group: 'Zürich' },
  { group: '' }, { group: null }, { group: 0 },
];
const optionSnapshot = JSON.stringify(optionRows);
const options = uniqueOptions(optionRows, 'group', { locale: 'de-CH' });
check(options.map((option) => option.value).join(',') === 'Bern,Zürich',
  'uniqueOptions removes empty and duplicate values and sorts with the requested locale');
check(options.every((option) => option.label === option.value),
  'uniqueOptions returns catalogue option objects');
check(JSON.stringify(optionRows) === optionSnapshot,
  'uniqueOptions preserves the input array and rows');

console.log(failures ? `\n✗ ${failures} check(s) FAILED` : '\n✓ all collection checks passed');
process.exit(failures ? 1 : 0);
