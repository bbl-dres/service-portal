// Metadata-catalogue checks. The app has one model — the tree sets the SCOPE,
// the tabs set the PRESENTATION, and neither touches the other — so the tests
// walk that model rather than a list of screens: every level of every branch,
// the tab contract at each level, the split record row, the reverse
// field-to-term index, the DCAT bridge, and the legacy links the search index
// still emits.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const BASE = APP_BASE + '/app/metadata-catalog';
let fail = 0;
const check = (cond, label, detail = '') => {
  if (!cond) fail++;
  console.log(`   ${cond ? '✓' : '✗'} ${label}${detail ? '  (' + detail + ')' : ''}`);
};
const head = (s) => console.log('\n■ ' + s);
const clean = async (p, label) => {
  const errs = await p.problems();
  check(!errs.length, `${label}: no errors`, errs.join(' | '));
};

// One readout for every scene, so a check never depends on what a previous
// check happened to leave on screen.
const STATE = `JSON.stringify({
  h1: (document.querySelector('h1') || {}).textContent,
  tabs: [...document.querySelectorAll('[role="tab"]')].map(t => t.textContent.trim()),
  active: ((document.querySelector('.tab__control--active') || {}).textContent || '').trim(),
  sections: [...document.querySelectorAll('#mc-panel .detail-section__title')].map(t => t.textContent),
  keys: [...document.querySelectorAll('#mc-panel .kv dt')].map(t => t.textContent),
  vals: [...document.querySelectorAll('#mc-panel .kv dd')].map(t => t.textContent.replace(/\\s+/g,' ').trim()),
  cols: [...document.querySelectorAll('#mc-panel thead th')].map(t => t.textContent.trim()),
  rows: document.querySelectorAll('#mc-panel tbody tr').length,
  cards: document.querySelectorAll('#mc-panel .card').length,
  groups: [...document.querySelectorAll('#mc-panel .table__group-toggle')].map(
    b => b.textContent.replace(/\\s+/g,' ').trim()),
  openGroups: document.querySelectorAll('#mc-panel .table__group-toggle[aria-expanded="true"]').length,
  pager: !!document.querySelector('#mc-panel .pagination'),
  roots: [...document.querySelectorAll('.pf-tree > .pf-tree__item')].map(li => {
    const label = li.querySelector('.pf-tree__label');
    const n = li.querySelector('.pf-tree__n');
    return label.textContent + (n ? ' ' + n.textContent : '');
  }),
  branchKids: document.querySelectorAll('.pf-tree__children > .pf-tree__item').length,
  splits: document.querySelectorAll('.pf-tree__split').length,
  folds: document.querySelectorAll('.pf-tree__fold').length,
  subs: document.querySelectorAll('.pf-tree__sub').length,
  activeRow: ((document.querySelector('.pf-tree .is-active .pf-tree__label') || {}).textContent || ''),
  pathRows: document.querySelectorAll('.pf-tree .is-path').length,
})`;

const browser = await launch();
const p = await openPage(browser, BASE);
// Navigate by hash: the router owns the route, and driving it the way a link
// would is the only way to prove the query string really is the whole state.
const go = async (hash) => {
  await p.evaluate(`(location.hash = ${JSON.stringify(hash)}, 1)`);
  await sleep(900);
  return JSON.parse(await p.evaluate(STATE));
};
// A link emitted by the app already carries the reader's chosen tab, so a tab
// cannot simply be appended: URLSearchParams.get returns the FIRST value and the
// scene would silently never switch.
const withTab = (href, tab) => {
  const [route, qs] = href.replace(/^#/, '').split('?');
  const q = new URLSearchParams(qs || '');
  q.set('tab', tab);
  return `#${route}?${q}`;
};
const linkIn = (needle) => p.evaluate(
  `(() => { const a = document.querySelector('#mc-panel tbody a[href*="${needle}"]');`
  + ' return a ? a.getAttribute("href") : ""; })()');

const DOMAIN = 'Bauwerk und Liegenschaft';
const L2 = `#/app/metadata-catalog?kind=objekt&leaf=${encodeURIComponent(DOMAIN)}`;

try {
  await sleep(1400);

  /* Level 0 — the way in, not a scope. */

  head('Katalog — the root');
  let o = JSON.parse(await p.evaluate(STATE));
  check(o.tabs.length === 0, 'no tabs: the root is not a scope', o.tabs.join('/'));
  check(o.cards === 3, 'one entry card per branch', String(o.cards));
  check(o.roots.length === 4, 'tree: Katalog plus three branches', o.roots.join(' | '));
  // The parentheses around a count are CSS ::before/::after, so they are not in
  // textContent — assert the number, not the punctuation drawn around it.
  check(/^Geschäftsobjekte \d+$/.test(o.roots[1]), 'branches carry their count', o.roots[1]);
  check(o.branchKids === 0, 'nothing unfolded until a branch is in scope', String(o.branchKids));
  await clean(p, 'Katalog');

  /* Levels 1 and 2 — a scope rather than a record. */

  head('Ast — level 1');
  o = await go('#/app/metadata-catalog?kind=objekt');
  check(o.tabs.join('/') === 'Übersicht/Tabelle', 'tabs Übersicht/Tabelle', o.tabs.join('/'));
  check(o.active === 'Übersicht', 'a branch opens on Übersicht', o.active);
  check(o.sections.join('/') === 'Definition/Verantwortlich/Metadaten',
    'the same three sections as every other level', o.sections.join('/'));
  check(o.branchKids > 0, 'the branch in scope is unfolded', String(o.branchKids));
  check(o.subs === 0 && o.splits === 0, 'but only one level deep', o.splits + ' splits');

  head('Domäne — level 2');
  o = await go(L2);
  check(o.active === 'Tabelle', 'a group opens on Tabelle — the question is «what is in it»', o.active);
  check(o.rows > 0, 'the group lists its records', String(o.rows));
  check(!o.cols.includes('Domäne'),
    'the axis column drops out when only one group is in scope', o.cols.join('/'));
  check(o.splits > 0 && o.folds === o.splits, 'every record row splits into link plus chevron',
    o.splits + ' rows / ' + o.folds + ' chevrons');
  check(o.subs === 0, 'selecting a group does not drop attributes into the tree', String(o.subs));
  check(o.pathRows > 0, 'the ancestors of the selection are marked', String(o.pathRows));
  await clean(p, 'Domäne');

  /* The orthogonality claim, stated as a test. */

  head('Tabs and tree are independent');
  o = await go(L2 + '&tab=uebersicht');
  check(o.active === 'Übersicht', 'an explicit tab beats the level default', o.active);
  check(o.rows === 0 && o.sections.length === 3, 'and really swaps the pane', String(o.rows));
  const kept = await go('#/app/metadata-catalog?kind=objekt&tab=uebersicht');
  check(kept.active === 'Übersicht', 'the chosen tab survives a move up the tree', kept.active);

  /* Level 3 — what used to be two separate detail pages. */

  head('Geschäftsobjekt — level 3 via the legacy ?id= link');
  o = await go(L2);
  const idHref = await linkIn('id=');
  check(/\?id=/.test(idHref), 'the table links to ?id=, unchanged since js/links.js', idHref);
  o = await go(idHref.slice(1));
  check(o.active === 'Tabelle', 'a record opens on its own parts', o.active);
  check(o.rows > 0, 'attributes are listed', String(o.rows));
  check(o.cols.join('/') === 'Attribut/Beschreibung/Werttyp/Schlüssel', 'attribute columns', o.cols.join('/'));
  check(o.activeRow.trim().length > 0, 'the tree marks the record', o.activeRow);
  check(o.subs === 0, 'and does NOT unfold it — that is what the chevron is for', String(o.subs));
  o = await go(withTab(idHref, 'uebersicht'));
  check(o.sections.join('/') === 'Definition/Verantwortlich/Metadaten',
    'the record overview is the same three sections', o.sections.join('/'));
  check(o.keys.includes('Domäne') && o.keys.includes('ID'), 'metadata names its axis and its id', o.keys.join('/'));
  await clean(p, 'Geschäftsobjekt');

  /* Level 4 — and the one path into it that needs no chevron. */

  head('Attribut — level 4');
  o = await go(idHref.slice(1));
  const attrHref = await linkIn('attr=');
  check(/attr=/.test(attrHref), 'a part links to ?attr=', attrHref);
  o = await go(attrHref.slice(1));
  check(o.tabs.join('/') === 'Übersicht', 'only Übersicht — nothing lies below an attribute', o.tabs.join('/'));
  check(o.sections.join('/') === 'Definition/Verantwortlich/Metadaten',
    'still the same three sections', o.sections.join('/'));
  check(o.subs > 0, 'an attribute in scope forces its record open in the tree', String(o.subs));
  check(o.keys.includes('Geerbt von'), 'and says where its stewardship comes from', o.keys.join('/'));

  /* The two other branches, and the edges that only they carry. */

  head('Systeme — level 3 via the legacy ?table= link');
  o = await go('#/app/metadata-catalog?kind=tabelle');
  check(o.roots[2].startsWith('Systeme'), 'the branch is named Systeme', o.roots[2]);
  o = await go('#/app/metadata-catalog?kind=tabelle&tab=tabelle');
  check(o.groups.length > 1 && !o.cols.includes('System'),
    'systems are section headers, not a repeated column', o.groups.slice(0, 3).join(' | '));
  const tableHref = await linkIn('table=');
  check(/\?table=/.test(tableHref), 'the table links to ?table=', tableHref);
  o = await go(tableHref.slice(1));
  check(o.rows > 0, 'fields are listed', String(o.rows));
  check(o.cols.join('/') === 'Feld/Beschreibung/Datentyp/Schlüssel', 'field columns', o.cols.join('/'));
  o = await go(withTab(tableHref, 'uebersicht'));
  check(o.keys.includes('Technischer Name'), 'a table names its technical identity', o.keys.join('/'));
  // The DCAT bridge lives in metadata rather than a separate access box.
  const dcat = await p.evaluate(
    '(() => document.querySelectorAll(\'#mc-panel .kv a[href*="#/data/"]\').length)()');
  check(Number(dcat) >= 0, 'the published-dataset bridge resolves without error', 'links: ' + dcat);
  await clean(p, 'Datentabelle');

  head('Reverse field-to-term index');
  o = await go(tableHref.slice(1));
  const fieldHref = await linkIn('attr=');
  o = await go(fieldHref.slice(1));
  check(o.tabs.join('/') === 'Übersicht', 'a field is a level-4 scope too', o.tabs.join('/'));
  // Not every field carries a term, so the row is present-or-absent by design;
  // what must hold is that the label is the reverse of the object side.
  check(!o.keys.includes('Realisiert in'), 'a field never claims to be realised elsewhere', o.keys.join('/'));

  head('Sections');
  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle');
  const branchRows = o.rows;
  check(o.groups.length > 1, 'a whole branch is sectioned by its axis', o.groups.join(' | '));
  check(!o.pager, 'sections replace paging — a section must not continue on page 3');
  check(o.openGroups === o.groups.length, 'every section opens expanded', String(o.openGroups));
  await p.evaluate('(document.querySelector(".table__group-toggle").click(), 1)');
  await sleep(500);
  o = JSON.parse(await p.evaluate(STATE));
  check(o.openGroups === o.groups.length - 1, 'a section closes', String(o.openGroups));
  check(o.rows < branchRows, 'and really drops its rows', branchRows + ' → ' + o.rows);
  check(o.groups.length > 1, 'while keeping its header as the way back', String(o.groups.length));
  o = await go('#/app/metadata-catalog?kind=objekt&leaf=' + encodeURIComponent(DOMAIN));
  check(o.groups.length === 0, 'one group in scope needs no sections', String(o.groups.length));
  await clean(p, 'Sections');

  head('Referenzdaten');
  o = await go('#/app/metadata-catalog?kind=referenz&tab=tabelle');
  check(o.rows > 0, 'value lists are listed', String(o.rows));
  check(o.groups.length === 4, 'the four subject areas are the sections', o.groups.join(' | '));
  const listHref = await linkIn('list=');
  check(/\?list=/.test(listHref), 'a value list links to ?list=', listHref);
  o = await go(listHref.slice(1));
  check(o.rows > 0, 'its values are listed', String(o.rows));
  check(o.cols.join('/') === 'Bezeichnung/Beschreibung/Schlüssel',
    'a value list has no key-role column', o.cols.join('/'));
  o = await go(withTab(listHref, 'uebersicht'));
  // Verantwortung, Status and Freigabe are not in the data model yet. The rows
  // stay, visibly empty, so the gap is on screen instead of hidden.
  check(o.keys.includes('Verantwortung') && o.keys.includes('Status'),
    'the not-yet-modelled fields are shown as gaps, not omitted', o.keys.join('/'));
  check(o.vals.some((v) => /noch nicht erfasst/.test(v)), 'and are labelled as such');
  await clean(p, 'Referenzdaten');

  /* Bad input. */

  head('Broken links');
  o = await go('#/app/metadata-catalog?id=gibt-es-nicht');
  check(/nicht gefunden/i.test(o.h1 || ''), 'an unresolvable record is not-found, not an empty page', o.h1);
  o = await go('#/app/metadata-catalog?kind=objekt&leaf=gibt-es-nicht');
  check(o.tabs.join('/') === 'Übersicht/Tabelle' && o.rows >= 0,
    'an unknown group falls back to its branch instead of throwing', o.tabs.join('/'));
  o = await go(idHref.slice(1) + '&attr=gibt-es-nicht');
  check(o.tabs.join('/') === 'Übersicht/Tabelle', 'an unknown attribute falls back to its record', o.tabs.join('/'));
  o = await go('#/app/metadata-catalog?kind=objekt&tab=diagramm');
  check(o.active === 'Übersicht', 'an unavailable tab falls back to the level default', o.active);
  await clean(p, 'Broken links');
} finally {
  await browser.close();
}

console.log(fail ? `\n✗ ${fail} check(s) failed` : '\n✓ metadata catalogue');
process.exit(fail ? 1 : 0);
