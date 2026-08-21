// Pure-Node contracts for the three steps in front of and above the result
// list: question detection, keyword resolution, the source selection, and the
// relevance gate that decides whether an answer may be shown at all.
//
// No browser and no server: every module under test is a pure function or a
// small store over js/core/storage.js, so the seams that decide what a person
// finds can be asserted directly rather than inferred from a rendered page.
const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};

const { isQuestion, resolve } = await import('../js/search/query-resolve.js');
const sources = await import('../js/search/search-sources.js');
const { KINDS, byKind } = await import('../js/search/search-kinds.js');
const { prepare, search } = await import('../js/search/search-engine.js');
const { build, retrieve } = await import('../js/search/answer.js');

let failures = 0;
const check = (condition, label, detail = '') => {
  if (!condition) failures++;
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? `  — ${detail}` : ''}`);
};
const section = (title) => console.log(`\n■ ${title}`);

/* A slice of the real index shape, including the `answerText` a citation stands
   behind and the `kind` the source selection filters on. */
const INDEX = [
  { kind: 'Dienstleistungen', type: 'Dienstleistung · Vorgang', title: 'Störungs-, Reinigungs- & Reparaturmeldung',
    desc: 'Defekte in einem Gebäude melden.', answerText: 'Melden Sie Störungen an Gebäude und Technik.',
    requires: ['Gebäude / Standort', 'Beschreibung'], href: '#/services/stoerung', extra: 'Objektbetrieb', boost: 30 },
  { kind: 'Prozesse', type: 'Portal-Ablauf', title: 'Störungsmeldung', desc: 'Defekte melden.',
    answerText: 'Defekte, Reinigungs- oder Reparaturbedarf in einem Gebäude melden.',
    href: '#/app/process-docs?def=stoerung', extra: 'Prozess Objektbetrieb' },
  { kind: 'Wissen und Hilfsmittel', type: 'Unterlage', title: 'Mustervorlagen für IKT-Beschaffungen',
    desc: 'Vorlagen-Sets.', answerText: 'Komplette Vorlagen-Sets für IT-Ausschreibungen.',
    href: '#/knowledge/it?section=vorlagen', extra: 'Informatik Werkzeugkasten' },
  { kind: 'Liegenschaften', type: 'Liegenschaft', title: 'Bundeshaus West', desc: 'Bundesgasse 3, 3003 Bern',
    answerText: '', href: '#/app/portfolio?id=1080', extra: '1080 4840 Bern Mietobjekt' },
].map(prepare);

/* ------------------------------------------------------------------------ */
section('Question detection is the cost gate');
check(isQuestion('Wie melde ich eine defekte Heizung?'), 'a full question is one');
check(isQuestion('Kann ich einen Sitzungsraum reservieren'), 'a modal opener counts without a question mark');
check(!isQuestion('bedarf'), 'a single keyword is not');
check(!isQuestion('raum buchen'), 'a two-word navigational query is not');
check(!isQuestion('TQ.21.00.00.01'),
  'a dotted identifier is not — its fragments are not words', 'would otherwise cost a model call');
check(!isQuestion(''), 'an empty query is not');

section('Resolution removes function words and keeps the subject');
const plan = resolve('Wie melde ich eine defekte Heizung?');
check(plan.keywords.join(' ') === 'melde defekte heizung', 'keeps the three carrying words', plan.keywords.join(' '));
check(plan.dropped.includes('wie') && plan.dropped.includes('ich') && plan.dropped.includes('eine'),
  'reports what it dropped, so the page can show it');
check(plan.queries[0] === 'melde defekte heizung', 'the strict query runs first');
check(plan.queries.length > 1 && plan.queries.includes('heizung'),
  'single words remain as a fallback tier', `${plan.queries.length} queries`);
check(resolve('bedarf').queries.length === 1, 'one keyword needs no fallback tiers');

section('Resolution is what turns 0 results into results');
check(search(INDEX, 'Wie melde ich eine defekte Heizung?').length === 0,
  'the unchanged engine finds nothing literally');
check(retrieve('Wie melde ich eine defekte Heizung?', INDEX).hits.length > 0,
  'the same question resolved finds rows',
  `${retrieve('Wie melde ich eine defekte Heizung?', INDEX).hits.length} rows`);

section('The relevance gate withholds the dangerous answer');
const good = build('Wie melde ich eine defekte Heizung?', INDEX);
check(good.state === 'answer', 'an understood question is answered');
check(good.parts.every((part) => Number.isInteger(part.cite) && part.cite > 0 && good.sources[part.cite - 1]),
  'every part carries a citation that resolves to a source');
check(good.sources.length <= 3, 'at most three sources are cited', `${good.sources.length}`);
check(new Set(good.sources.map((s) => s.type)).size === good.sources.length,
  'sources come from different kinds rather than repeating one');
check(good.parts.some((part) => part.text.includes('Bereit halten')),
  'prerequisites become the useful second line');

// The failure this gate exists for: single-word fallbacks always find something,
// so an unrelated question could otherwise be answered from a stray match.
const holidays = build('Wie viele Ferientage stehen mir zu?', INDEX);
check(holidays.state === 'none',
  'an unrelated question is NOT answered from a single-word fallback',
  `state=${holidays.state}`);
check(build('bedarf', INDEX).state === 'none' || !isQuestion('bedarf'),
  'a keyword query never reaches the answer builder');

section('A record without prose can be a result but never a source');
const buildingHit = INDEX.find((row) => row.kind === 'Liegenschaften');
check(buildingHit.answerText === '', 'the fixture property has no prose');
const bern = build('Bundeshaus West Bern melden', INDEX);
check(bern.state === 'none' || bern.sources.every((source) => source.title !== 'Bundeshaus West'),
  'it is never cited');

section('Source selection: stored as what is OFF');
sources.reset();
check(sources.activeKinds() === null, 'everything on means no filtering at all');
check(sources.filterRows(INDEX).length === INDEX.length, 'and no rows are dropped');
sources.toggle('Wissen und Hilfsmittel');
check(!sources.isOn('Wissen und Hilfsmittel'), 'a kind can be switched off');
check(sources.filterRows(INDEX).every((row) => row.kind !== 'Wissen und Hilfsmittel'),
  'and disappears from every search path');
check(sources.ratio() === `${KINDS.length - 1}/${KINDS.length}`, 'the ratio reports the state', sources.ratio());
check(JSON.parse(values.get('bbl_search_sources_v1')).includes('Wissen und Hilfsmittel'),
  'what is stored is the switched-off kind, so a NEW kind defaults to on');

section('An empty selection means no restriction, not an empty result list');
sources.clearAllKinds();
check(sources.noneSelected(), 'every kind can be cleared');
check(sources.activeKinds() === null, 'nothing selected filters nothing');
check(sources.filterRows(INDEX).length === INDEX.length,
  'so the intermediate step of «clear all, then pick one» is not a broken state');
sources.toggle('Dienstleistungen');
check(sources.filterRows(INDEX).length === 1, 'ticking one kind isolates it',
  `${sources.filterRows(INDEX).length} of ${INDEX.length}`);

section('The two jumps never touch the answer preference');
sources.reset();
sources.toggle(sources.ANSWERS);
check(!sources.answersAllowed(), 'answers can be switched off on their own');
sources.clearAllKinds();
check(!sources.answersAllowed(), 'clearing all kinds leaves that decision alone');
sources.selectAllKinds();
check(!sources.answersAllowed(), 'restoring all kinds leaves it alone too');
sources.toggle(sources.ANSWERS);
check(sources.answersAllowed(), 'and it can be switched back on');

section('An answer never cites a switched-off kind');
sources.reset();
sources.toggle('Prozesse');
const filtered = build('Wie melde ich eine defekte Heizung?', INDEX);
check(filtered.state !== 'answer' || filtered.sources.every((source) => !source.type.includes('Portal-Ablauf')),
  'the excluded kind is absent from the citations');
sources.reset();

section('One kind order for facets, suggestions and the source panel');
check(KINDS[0] === 'Dienstleistungen' && KINDS.includes('Wissen und Hilfsmittel'),
  'the list starts with what people come to do');
check(byKind('Dienstleistungen', 'News') < 0, 'the comparator follows that order');
check(byKind('Unbekannt', 'News') > 0, 'an unknown kind sorts last, not first');

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
