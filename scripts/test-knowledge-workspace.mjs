// Pure contracts of the workspace-design subject area.
//
// This area states an official BBL standard, so the risk it carries is not a
// broken layout but a WRONG FACT: a superseded module number, an invented area
// figure, or a price the handbook marks confidential. The assertions below pin
// exactly those things, plus the structural contract the knowledge page and the
// search index rely on.
import assert from 'node:assert/strict';

import {
  AREAS, MULTISPACE_EDITION, MULTISPACE_GUIDELINES, MULTISPACE_MODULES,
  WORKSPACE_STEPS, WORKSPACE_TERMS, knowledgeIndex, sectionDomId,
} from '../js/knowledge-content.js';

const area = AREAS.workspace;
assert.ok(area, 'the workspace subject area exists');
assert.equal(area.title, 'Arbeitsplätze gestalten');

// --- The standard itself ------------------------------------------------------
// The prototype publishes the «Stand 6.1.2025» handbook: ELEVEN modules with Coffee
// Point as module 7. This reverses an earlier decision here, and the reason is worth
// keeping. That edition is the catalogue being turned into a web version, and it is also
// exactly what the Plan-Editor's room attribute has always written — so one list now
// serves both and no saved plan changes meaning. The «Stand 31.10.2025» edition retires
// the Coffee Point and renumbers 8–11 to 7–10; data/multispace-modules.json records that
// as a delta, so adopting it is one field plus a draft migration rather than a rewrite.
//
// The list itself is no longer authored here. data/multispace-modules.json is the source
// and `scripts/check-multispace-modules.mjs` proves this copy and MODULE_OPTIONS agree
// with it — the two used to be hand-maintained and had drifted.
assert.equal(MULTISPACE_EDITION, '6.1.2025');
assert.equal(MULTISPACE_MODULES.length, 11);
assert.deepEqual(MULTISPACE_MODULES.map((m) => m.nr), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
assert.equal(MULTISPACE_MODULES[0].name, 'Einzel Arbeitsplatz');
assert.equal(MULTISPACE_MODULES[6].name, 'Coffee Point');
assert.equal(MULTISPACE_MODULES[10].name, 'Service Funktionen');

// Figures come from the fixture's sub-modules, which hold them as NUMBERS; the page's
// summary string is derived from those rather than transcribed, so the handbook figures
// live in one place and are readable by the catalogue view as well as by this list.
// Swiss decimal comma for fractional values.
assert.equal(MULTISPACE_MODULES.find((m) => m.nr === 1).area, '3 m²');
assert.equal(MULTISPACE_MODULES.find((m) => m.nr === 2).area, '25 / 35 m²');
assert.equal(MULTISPACE_MODULES.find((m) => m.nr === 5).area, '4,5 / 2 m²');
assert.equal(MULTISPACE_MODULES.find((m) => m.nr === 8).area, '65 / 30 m²');
// Storage and service modules carry no area figure in the source; an invented
// number would be worse than the dash.
for (const nr of [9, 10, 11]) {
  assert.equal(MULTISPACE_MODULES.find((m) => m.nr === nr).area, '—');
}
for (const m of MULTISPACE_MODULES) {
  assert.ok(m.desc.length > 40, `module ${m.nr} carries a characteristic`);
}

assert.equal(MULTISPACE_GUIDELINES.length, 9);
assert.ok(MULTISPACE_GUIDELINES.some((r) => /Fluchtwegen/.test(r)),
  'box placement carries its fire-safety constraint');
assert.ok(MULTISPACE_GUIDELINES.some((r) => /SECO/.test(r)));
assert.equal(MULTISPACE_GUIDELINES.some((r) => /Coffee Point/.test(r)), false,
  'no guideline may reference a module the current edition removed');

// The three planning levels are defined terms and are not interchangeable.
assert.deepEqual(WORKSPACE_TERMS.map((t) => t.term),
  ['Raumplanung', 'Unterbringungsplanung', 'Belegungsplanung']);
assert.equal(WORKSPACE_STEPS.length, 4);
assert.equal(WORKSPACE_STEPS[0].title, 'Arbeitsstilanalyse');

// --- Nothing confidential -----------------------------------------------------
// The handbook marks its prices confidential, and the print-requirements
// document is internal with a supplier named in it.
const allText = JSON.stringify([area, MULTISPACE_MODULES, MULTISPACE_GUIDELINES]);
for (const forbidden of ['CHF', 'Preis pro', 'Kostenkennwert', 'Korasoft', 'BBL-D-A']) {
  assert.equal(allText.includes(forbidden), false, `no "${forbidden}" in published content`);
}

// --- Structural contract of a subject area ------------------------------------
const ids = area.sections.map((s) => s.id);
assert.equal(new Set(ids).size, ids.length, 'section ids are unique');
for (const id of ids) {
  assert.match(id, /^[a-z][a-z-]*$/, `section id "${id}" is a safe slug`);
}
// Banned internal hook values (scripts/check-english-code.mjs) must not appear.
for (const banned of ['uebersicht', 'grundriss', 'grundrisse', 'flaechen', 'ausstattung']) {
  assert.equal(ids.includes(banned), false, `section id must not be "${banned}"`);
}
// Every section renders something: a document list, free-form content, or both.
for (const s of area.sections) {
  assert.ok(s.items || s.html, `section "${s.id}" has content`);
}
// The area cross-references rather than duplicating the legal basis, which lives
// under the accommodation area.
assert.match(area.intro, /#\/knowledge\/accommodation/);
const accommodationTitles = AREAS.accommodation.sections
  .flatMap((s) => (s.items || []).map((it) => it.title));
for (const s of area.sections) {
  for (const it of s.items || []) {
    assert.equal(accommodationTitles.includes(it.title), false,
      `"${it.title}" already exists in the accommodation area`);
  }
}

// --- Search --------------------------------------------------------------------
const index = knowledgeIndex().filter((row) => row.area === area.title);
assert.ok(index.length >= area.sections.length, 'every section is indexed');
assert.ok(index.some((row) => /Multispace/.test(row.title) || /Multispace/.test(row.desc)),
  'the standard is findable by its name');
const sectionRow = index.find((row) => row.title === 'Die Multispace-Module');
assert.equal(sectionRow.href, `#/knowledge/workspace?section=${sectionDomId('standard')}`);
// In-portal targets keep their own href so a result opens the application.
const appRow = index.find((row) => row.title === 'Plan-Editor');
assert.equal(appRow.href, '#/app/floorplan-editor');

console.log(`Knowledge area "${area.title}" passed: ${MULTISPACE_MODULES.length} modules `
  + `(edition ${MULTISPACE_EDITION}), ${area.sections.length} sections, ${index.length} index rows.`);
