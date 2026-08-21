// Beweist, dass die Studie dasselbe findet wie das Portal.
//
//   node "docs/wireframes/260820 - Suche/verify-parity.mjs"
//
// WARUM ES DAS GIBT. Die Studie ist eigenständig: sie fasst das Portal nicht an
// und spiegelt dessen Suchindex in js/data.js, statt ihn zu importieren. Der
// Preis dafür ist Abdriften — ändert jemand buildIndex() in js/pages/search.js,
// merkt es hier niemand. Dieses Skript ist der Gegenzug: es baut BEIDE Indizes
// und vergleicht sie Feld für Feld. Solange es grün ist, gilt jede Messung in
// der Studie auch für das Portal; sobald es rot wird, weiss man genau, welche
// Zeile nachzuziehen ist.
//
// Es läuft in Node, ohne Browser und ohne Abhängigkeiten — wie
// scripts/test-search.mjs, an dem es sich orientiert. Zwei Kunstgriffe sind
// nötig und beide sind hier bewusst:
//
//   · `fetch` wird auf das Dateisystem umgebogen, damit js/data.js der Studie
//     UNVERÄNDERT geladen werden kann. Ein Nachbau davon würde genau den Fehler
//     verstecken, den dieses Skript finden soll.
//   · `buildIndex()` ist in js/pages/search.js nicht exportiert, also wird die
//     Funktion aus dem Quelltext geschnitten und mit ihren vier freien Namen
//     aufgerufen. Das ist spröde gegenüber Umbenennungen — und das ist in
//     Ordnung: bricht der Schnitt, bricht der Test laut, nicht still.

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

// fileURLToPath, NICHT `new URL(...).pathname`: der Ordnername enthält
// Leerzeichen, die dort prozentkodiert ankommen («260820%20-%20Suche») und den
// Modulimport ins Leere laufen lassen.
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const readJSON = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const load = (p) => import(pathToFileURL(join(ROOT, p)).href);

const { search, prepare } = await load('js/search/search-engine.js');

/* ---- 1 · Der Index der STUDIE, aus ihrem echten Modul --------------------- */
globalThis.fetch = async (url) => {
  const name = String(url).replace(/^.*\/data\//, 'data/');
  try { return { ok: true, json: async () => JSON.parse(readFileSync(join(ROOT, name), 'utf8')) }; }
  catch { return { ok: false, status: 404 }; }
};
const study = await import(pathToFileURL(join(HERE, 'js', 'data.js')).href);
await study.load();
const A = study.index();
const AS = study.suggestIndex();

/* ---- 2 · Der Index des PORTALS ------------------------------------------- */
const src = readFileSync(join(ROOT, 'js', 'pages', 'search.js'), 'utf8');
const from = src.indexOf('function buildIndex(core) {');
const to = src.indexOf('\n/* ============================== EMPTY RESULTS');
if (from < 0 || to < 0) {
  console.error('✗ buildIndex() nicht gefunden — js/pages/search.js hat sich umbenannt oder umsortiert.');
  process.exit(1);
}

const { knowledgeIndex } = await load('js/knowledge-content.js');
const links = await load('js/links.js');
const { domainLabel: domainLabelShared } = await load('js/domain.js');

// Nur die Felder, die buildIndex() liest (js/core/index.js normalizeBuilding).
const buildings = readJSON('data/buildings.geojson').features.map((f) => {
  const raw = f.properties || {};
  return {
    bbl_id: raw['bbl_id'], name: raw['bbl_bez'] || raw['bbl_id'],
    portfolioCategory: raw['bbl_port'] || raw['bbl_gbda1'] || '—',
    buildingType: raw['bbl_gbda1'] || '',
    street: [raw['adr_str'], raw['adr_hsnr']].filter(Boolean).join(' ').trim(),
    zip: raw['adr_plz'] || '', city: raw['adr_ort'] || '', canton: raw['adr_reg'] || '',
    architect: raw['bbl_architekt'] || '', occupants: raw['bbl_nutzer'] || '',
    ownership: raw['bbl_eigen'] || '',
  };
}).filter((b) => b.bbl_id);

const reference = readJSON('data/reference-data.json');
const core = {
  t: (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? (v.de || Object.values(v)[0] || '') : (v || ''),
  ref: () => reference,
  dataDomains: () => reference.dataDomains || [],
  services: () => readJSON('data/services.json'),
  applications: () => readJSON('data/applications.json'),
  datasets: () => readJSON('data/datasets.json'),
  dataTables: () => readJSON('data/data-tables.json'),
  processes: () => readJSON('data/processes.json'),
  businessObjects: () => readJSON('data/business-objects.json'),
  documents: () => readJSON('data/documents.json'),
  news: () => readJSON('data/news.json'),
  projects: () => readJSON('data/projects.json'),
  contacts: () => readJSON('data/contacts.json'),
  buildings: () => buildings,
  building: (id) => buildings.find((b) => b.bbl_id === id),
};

const B = new Function('knowledgeIndex', 'links', 'domainLabelShared', 'prepareRow',
  src.slice(from, to) + '\nreturn buildIndex;')(knowledgeIndex, links, domainLabelShared, prepare)(core);

/* ---- 3 · Der Vorschlagsindex des PORTALS (js/search/search-suggest.js) ---- */
const domainLabel = (k) => (reference.domains || []).find((d) => d.key === k)?.label || k;
const TYPE_BOOST = { service: 24, application: 16, dataset: 6, knowledge: -12 };
const suggestRows = [];
for (const s of core.services()) {
  if (s.type !== 'action') continue;      // Vorschläge führen zu etwas Startbarem.
  suggestRows.push({ title: s.title, desc: domainLabel(s.domain), resultType: 'Dienstleistung',
    href: links.service(s.serviceId),
    extra: [domainLabel(s.domain), s.short, (s['voraussetzungen'] || []).join(' ')].join(' '),
    boost: TYPE_BOOST.service + (s.popular ? Math.max(0, 20 - s.popular * 2) : 0) });
}
for (const a of core.applications()) {
  suggestRows.push({ title: a.name, desc: a.group, resultType: 'Anwendung', href: links.application(a.appId),
    extra: [a.group, a.area, a.description, a.appId.replace(/-/g, ' ')].join(' '), boost: TYPE_BOOST.application });
}
for (const d of core.datasets()) {
  suggestRows.push({ title: core.t(d.title), desc: core.t(d.meta && d.meta['thema']), resultType: 'Datensatz',
    href: links.dataset(d.id), extra: [core.t(d.description), (d.tags || []).join(' ')].join(' '), boost: TYPE_BOOST.dataset });
}
for (const k of knowledgeIndex()) {
  suggestRows.push({ title: k.title, desc: k.area, resultType: 'Unterlage', href: k.href,
    external: k.external, extra: k.extra, boost: TYPE_BOOST.knowledge });
}
const BS = suggestRows.map(prepare);

/* ---- 4 · Vergleichen ------------------------------------------------------ */
let failures = 0;
const ok = (cond, label, detail = '') => {
  if (!cond) failures++;
  console.log(`   ${cond ? '✓' : '✗'} ${label}${detail ? '  — ' + detail : ''}`);
};
const section = (t) => console.log('\n■ ' + t);

section('Indexgrösse');
ok(A.length === B.length, 'gleich viele Zeilen', `Studie ${A.length} · Portal ${B.length}`);

section('Zeilen je Inhaltsart');
const byKind = (rows) => rows.reduce((m, r) => m.set(r.kind, (m.get(r.kind) || 0) + 1), new Map());
const ka = byKind(A); const kb = byKind(B);
for (const k of [...new Set([...ka.keys(), ...kb.keys()])].sort()) {
  ok((ka.get(k) || 0) === (kb.get(k) || 0), k, `${ka.get(k) || 0} / ${kb.get(k) || 0}`);
}

section('Feldweiser Vergleich');
// Schlüssel mit `kind`: eine Unterlage darf dieselbe Route UND denselben Titel
// tragen wie eine Dienstleistung (Sicherheits-/Datenschutzvorfall melden), und
// ohne die Inhaltsart überschriebe die eine die andere.
const key = (r) => `${r.kind}|${r.href}|${r.title}`;
const idx = new Map(B.map((r) => [key(r), r]));
const FIELDS = ['kind', 'type', 'desc', 'meta'];
const problems = [];
for (const a of A) {
  const b = idx.get(key(a));
  if (!b) { problems.push(`fehlt im Portal: ${a.kind} · ${a.title}`); continue; }
  for (const f of FIELDS) {
    if (String(a[f] || '') !== String(b[f] || '')) {
      problems.push(`${f}: ${a.title} — Studie ${JSON.stringify(a[f])} vs Portal ${JSON.stringify(b[f])}`);
    }
  }
  // `_x` ist der gefaltete extra-Text: das unsichtbare Feld, das die Suche
  // eigentlich trägt. Weicht es ab, findet die Studie anderes als das Portal,
  // ohne dass man es der Trefferliste ansieht.
  if (a._x.text !== b._x.text) problems.push(`extra: ${a.kind} · ${a.title}`);
  if ((a.boost || 0) !== (b.boost || 0)) problems.push(`boost: ${a.title} ${a.boost} vs ${b.boost}`);
}
ok(!problems.length, `${A.length - new Set(problems).size} von ${A.length} Zeilen identisch in ${FIELDS.join('/')}/extra/boost`);
problems.slice(0, 12).forEach((p) => console.log('       · ' + p));
if (problems.length > 12) console.log(`       · … und ${problems.length - 12} weitere`);

section('Vorschlagsindex (vier Inhaltsarten, TYPE_BOOST)');
ok(AS.length === BS.length, 'gleich viele Zeilen', `Studie ${AS.length} · Portal ${BS.length}`);
// Die REIHENFOLGE zählt: search() sortiert `b.score - a.score || a.i - b.i`,
// bei Gleichstand entscheidet also die Eingabereihenfolge.
let orderBad = 0;
for (let i = 0; i < Math.min(AS.length, BS.length); i++) {
  const a = AS[i]; const b = BS[i];
  if (a.title !== b.title || a.href !== b.href || String(a.desc || '') !== String(b.desc || '')
    || (a.boost || 0) !== (b.boost || 0) || a._x.text !== b._x.text) orderBad++;
}
ok(!orderBad, 'gleiche Zeilen in gleicher Reihenfolge', orderBad ? `${orderBad} Abweichungen` : '');

section('Gleiche Abfrage, gleiche Treffer');
const QUERIES = [
  'stoerung melden', 'heizung', 'raum buchen', 'bedarf', 'guisanplatz', 'mustervorlage',
  'portfolio', 'daten', 'vorlage', 'COMP_CODE', 'TQ.21.00.00.01', 'bundeshaus west',
  'Wie melde ich eine defekte Heizung?', 'Wie viele Ferientage stehen mir zu?',
];
for (const q of QUERIES) {
  const ra = search(A, q); const rb = search(B, q);
  const same = ra.length === rb.length && ra.every((r, i) => r.title === rb[i].title && r._score === rb[i]._score);
  ok(same, `«${q}»`, `${ra.length} Treffer${same ? '' : ` vs ${rb.length} — erster: ${ra[0]?.title} / ${rb[0]?.title}`}`);
}

section('Gleiche Eingabe, gleiche sieben Vorschläge');
for (const q of ['bed', 'bedarf', 'heizung', 'raum', 'portfolio', 'vorlage']) {
  const ra = search(AS, q).slice(0, 7); const rb = search(BS, q).slice(0, 7);
  ok(ra.length === rb.length && ra.every((r, i) => r.title === rb[i].title), `«${q}»`, `${ra.length} Vorschläge`);
}

console.log(failures
  ? `\n✗ ${failures} Abweichung(en). Die Studie misst NICHT mehr dasselbe wie das Portal.`
  : '\n✓ Die Studie findet, was das Portal findet.');
process.exit(failures ? 1 : 0);
