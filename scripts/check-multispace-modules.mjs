// The Multispace module list must exist ONCE.
//
// It is the shared vocabulary of the whole Workspace suite: the Plan-Editor writes a
// module number into every room it tags, and the handbook pages describe what that
// number means. Those two lived as separate hand-maintained copies and drifted — the
// editor offered eleven modules with Coffee Point as 7 while the handbook page described
// ten without it, so «Modul 7» meant different things on different screens and nothing
// noticed.
//
// data/multispace-modules.json is the source. The code copies exist because the
// validation layer is synchronous and the repository has no build step, so this gate
// stands in for the compiler: it proves the copies still agree with the source.
import { readFile } from 'node:fs/promises';
import { MODULE_OPTIONS } from '../js/floorplan-editor/model.js';
import { MULTISPACE_MODULES, MULTISPACE_EDITION } from '../js/knowledge-content.js';

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

const fixture = JSON.parse(await readFile(new URL('../data/multispace-modules.json', import.meta.url), 'utf8'));
const source = fixture.modules.map((module) => ({ nr: String(module.nr), name: module.name }));

check(source.length > 0 && fixture.currentEdition,
  'the fixture declares an edition and its modules',
  `${source.length} modules, edition ${fixture.currentEdition}`);

check(MULTISPACE_EDITION === fixture.currentEdition,
  'the knowledge page states the fixture edition',
  `${MULTISPACE_EDITION} vs ${fixture.currentEdition}`);

const editor = MODULE_OPTIONS.map((option) => ({ nr: String(option.value), name: option.name }));
const sameAsEditor = editor.length === source.length
  && editor.every((option, index) => option.nr === source[index].nr && option.name === source[index].name);
check(sameAsEditor,
  'the Plan-Editor room attribute offers exactly the fixture modules',
  sameAsEditor ? `${editor.length} modules` : `${editor.map((o) => o.nr + ' ' + o.name).join(' | ')}`);

const page = MULTISPACE_MODULES.map((module) => ({ nr: String(module.nr), name: module.name }));
const sameAsPage = page.length === source.length
  && page.every((module, index) => module.nr === source[index].nr && module.name === source[index].name);
check(sameAsPage,
  'the handbook page describes exactly the fixture modules',
  sameAsPage ? `${page.length} modules` : `${page.map((m) => m.nr + ' ' + m.name).join(' | ')}`);

// The newer edition is carried as a delta, so switching to it is one field plus a draft
// migration rather than a second list that can drift in its own right.
const next = fixture.nextEdition;
check(Boolean(next?.edition && Array.isArray(next.changes) && next.renumbering),
  'the superseded/next edition is recorded as a delta, not a second list',
  next ? `${next.edition}, ${next.changes.length} changes` : 'missing');

const mapped = Object.keys(next?.renumbering || {});
check(mapped.length === source.length,
  'the renumbering map covers every current module',
  `${mapped.length} of ${source.length}`);

// Prices and cost figures are confidential; the fixture must never carry them.
const blob = JSON.stringify(fixture);
const forbidden = ['CHF', 'Preis pro', 'Kostenkennwert'].filter((term) => blob.includes(term));
check(forbidden.length === 0,
  'the fixture carries no confidential price or cost figures',
  forbidden.join(', ') || 'none');

console.log(failures ? `\n✗ ${failures} check(s) FAILED` : '\n✓ all checks passed');
process.exit(failures ? 1 : 0);
