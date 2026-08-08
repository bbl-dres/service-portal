// Calendar dates must not shift with the machine time zone, and HTML helpers
// must escape a value exactly once at their final markup sink.
import { datum } from '../js/format.js';
import components from '../js/components.js';
import { heroMosaic } from '../js/hero-mosaic.js';
import { renderSvg } from '../js/charts.js';

let failures = 0;
const check = (condition, label, actual = '') => {
  console.log(`${condition ? '✓' : '✗'} ${label}${actual ? ` (${actual})` : ''}`);
  if (!condition) failures++;
};

check(datum('2034-03-31') === '31.3.2034',
  'date-only values preserve their calendar day', datum('2034-03-31'));
check(datum('2026-02-29') === '2026-02-29',
  'invalid calendar dates remain visibly invalid', datum('2026-02-29'));
check(datum('not-a-date') === 'not-a-date',
  'unparseable values remain visible', datum('not-a-date'));

const mosaic = heroMosaic(components, {
  items: [{ id: 'one', title: 'A & B', photoSrc: 'assets/images/social1.jpg' }],
  mapId: 'map', mapLabel: 'A & B',
});
check(mosaic.includes('alt="A &amp; B"') && !mosaic.includes('A &amp;amp; B'),
  'hero image alternative text is escaped exactly once');

const emptyPie = renderSvg(
  { id: 'empty-pie', form: 'pie', x: 'label', y: 'value' },
  { rows: [{ label: 'A', value: 0 }, { label: 'B', value: -2 }] },
  400,
);
check(emptyPie.includes('Keine Daten') && !emptyPie.includes('<svg'),
  'a pie chart without positive values renders an explicit empty state');

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
