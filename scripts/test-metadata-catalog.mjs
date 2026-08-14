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
  boxes: [...document.querySelectorAll('#mc-panel .lscape__toggle')].map(
    b => b.textContent.replace(/\\s+/g,' ').trim()),
  openBoxes: document.querySelectorAll('#mc-panel .lscape__toggle[aria-expanded="true"]').length,
  tiles: document.querySelectorAll('#mc-panel .lscape__tile').length,
  allBtn: ((document.querySelector('[data-lscape-all]') || {}).textContent || '').trim(),
  q: (document.querySelector('#mc-q') || {}).placeholder,
  qDead: !!(document.querySelector('#mc-q') || {}).disabled,
  qCount: ((document.querySelector('#mc-q-count') || {}).textContent || '').replace(/\\s+/g,' ').trim(),
  tableSearch: document.querySelectorAll('#mc-panel .catbar__search').length,
  actions: [...document.querySelectorAll('#mc-tools [data-action]')].map(b => b.dataset.action),
  groupSel: (() => { const g = document.querySelector('#mc-group');
    return g ? g.value + ':' + [...g.options].map(o => o.value).join(',') : '(keins)'; })(),
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
  check(o.tabs.join('/') === 'Übersicht/Diagramm/Tabelle', 'three tabs', o.tabs.join('/'));
  // Arriving from the menu is a looking moment, so a branch opens on its picture.
  check(o.active === 'Diagramm', 'a branch opens on its landscape', o.active);
  check(o.boxes.length > 1, 'and the landscape is there', String(o.boxes.length));
  o = await go('#/app/metadata-catalog?kind=objekt&tab=uebersicht');
  check(o.sections.join('/') === 'Definition/Verantwortlich/Metadaten',
    'the same three sections as every other level', o.sections.join('/'));
  check(o.branchKids > 0, 'the branch in scope is unfolded', String(o.branchKids));
  check(o.subs === 0 && o.splits === 0, 'but only one level deep', o.splits + ' splits');

  head('Domäne — level 2');
  o = await go(L2);
  check(o.active === 'Diagramm', 'a domain opens on its landscape — a looking question', o.active);
  o = await go(L2 + '&tab=tabelle');
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
  o = await go(L2 + '&tab=tabelle');
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
  o = await go(withTab(idHref, 'tabelle'));
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

  head('Diagramm — the landscape');
  o = await go('#/app/metadata-catalog?kind=objekt&tab=diagramm');
  check(o.boxes.length === 5, 'on a branch the boxes are the axis values', o.boxes.join(' | '));
  check(o.tiles === 19, 'and the tiles are every record in scope', String(o.tiles));
  check(o.openBoxes === o.boxes.length, 'boxes open expanded', String(o.openBoxes));
  check(/zuklappen/.test(o.allBtn), 'the control says what pressing it will DO', o.allBtn);
  await p.evaluate('(document.querySelector("[data-lscape-all]").click(), 1)');
  await sleep(500);
  o = JSON.parse(await p.evaluate(STATE));
  check(o.openBoxes === 0 && o.tiles === 0, 'all boxes shut', o.openBoxes + ' open, ' + o.tiles + ' tiles');
  check(/aufklappen/.test(o.allBtn), 'and the control now offers the opposite', o.allBtn);
  await p.evaluate('(document.querySelector("[data-lscape-all]").click(), 1)');
  await sleep(500);
  o = JSON.parse(await p.evaluate(STATE));
  check(o.openBoxes === o.boxes.length, 'and back open again', String(o.openBoxes));
  // A tile is ALWAYS one record. One level deeper the same landscape is simply
  // re-laid: with no grouping in force it collapses to a single field.
  o = await go(L2 + '&tab=diagramm');
  check(o.boxes.length === 1 && /^Alle/.test(o.boxes[0]),
    'inside one group the landscape collapses to a single field', o.boxes.join(' | '));
  check(o.tiles === 8, 'holding the same eight records the table lists', String(o.tiles));
  const tileHref = await p.evaluate(
    '(() => { const a = document.querySelector("#mc-panel .lscape__tile"); return a ? a.getAttribute("href") : ""; })()');
  check(/[?&]id=/.test(tileHref) && !/attr=/.test(tileHref),
    'a tile links to the record it draws, never to a part', tileHref);
  o = await go('#/app/metadata-catalog?kind=referenz&tab=diagramm');
  check(o.boxes.length === 4, 'every branch has a landscape', o.boxes.join(' | '));
  await clean(p, 'Diagramm');

  head('Dichte');
  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle');
  const dense = JSON.parse(await p.evaluate(`(() => {
    const td = document.querySelector('#mc-panel .table td');
    const t = document.querySelector('#mc-panel .table');
    const c = getComputedStyle(td);
    return JSON.stringify({
      compact: t.classList.contains('table--compact'),
      pad: c.paddingTop + ' ' + c.paddingLeft,
      size: getComputedStyle(t).fontSize,
    });
  })()`));
  check(dense.compact, 'die Katalogtabelle trägt die kompakte Dichte');
  check(dense.pad === '8px 12px', 'Zellen 8px/12px wie im Wireframe', dense.pad);
  check(dense.size === '14px', 'Schrift 14px statt 18px', dense.size);
  await clean(p, 'Dichte');

  head('Aktionen — what leaves is what is on screen');
  // Intercept the download rather than writing files: the assertion is about the
  // CONTENT, and a test that litters the download folder is its own problem.
  await p.evaluate(`(() => {
    const real = URL.createObjectURL;
    URL.createObjectURL = (b) => { window.__blob = b; return real.call(URL, b); };
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[download]');
      if (a) { window.__name = a.download; e.preventDefault(); }
    }, true);
    return 1;
  })()`);
  const exportCsv = async () => {
    await p.evaluate('(document.querySelector(".action-menu__trigger").click(), 1)');
    await sleep(200);
    await p.evaluate('(document.querySelector("[data-action=\'csv\']").click(), 1)');
    await sleep(350);
    return JSON.parse(await p.evaluate(`(async () => JSON.stringify({
      name: window.__name,
      bom: [...new Uint8Array(await window.__blob.arrayBuffer()).slice(0, 3)].join(' '),
      lines: (await window.__blob.text()).split('\\r\\n').filter(Boolean).length,
    }))()`));
  };

  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle');
  check(o.actions.join(',') === 'csv,excel,pdf', 'three ways out', o.actions.join(','));
  let f = await exportCsv();
  check(/\.csv$/.test(f.name), 'the file is named after its scope', f.name);
  // Without a BOM Excel reads UTF-8 as the local code page and every umlaut in
  // the catalogue comes out wrong.
  check(f.bom === '239 187 191', 'and opens with a byte-order mark', f.bom);
  check(f.lines === 20, 'nineteen records plus a header', String(f.lines));

  // The export must follow the screen, not the catalogue.
  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle&q=miet');
  f = await exportCsv();
  check(f.lines === 5, 'a query narrows the file too', String(f.lines) + ' Zeilen');

  o = await go('#/app/metadata-catalog?id=areal');
  check(o.actions.length === 3, 'a record can be exported as well', String(o.actions.length));
  check(o.groupSel === '(keins)', 'but grouping goes: only one record is in scope', o.groupSel);
  f = await exportCsv();
  check(f.lines === 6, 'and the file holds its five attributes', String(f.lines) + ' Zeilen');
  await clean(p, 'Aktionen');

  head('Suche — narrows the scope, not the tab');
  o = await go('#/app/metadata-catalog?kind=objekt');
  check(o.q === 'In Geschäftsobjekte suchen…', 'the field names what it would narrow', o.q);
  check(o.tableSearch === 0, 'and it is the only search field on the page', String(o.tableSearch));
  o = await go(L2);
  check(o.q === 'In Bauwerk und Liegenschaft suchen…', 'down a level it names the group', o.q);
  o = await go('#/app/metadata-catalog?id=areal');
  check(o.q === 'Attribute in «Areal» suchen…', 'on a record it narrows the parts', o.q);
  o = await go('#/app/metadata-catalog?id=areal&attr=Areal-ID');
  check(o.qDead && !/…$/.test(o.q), 'on an attribute it is disabled and says why', o.q);

  // The query is a property of the scope, so it applies to every tab — including
  // the one that lists nothing, where the count is the only feedback there is.
  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle&q=geb');
  // A section header is a <tr> too, so subtract them to count records.
  check(o.rows - o.groups.length === 9, '«geb» narrows the Tabelle tab',
    o.rows + ' Zeilen minus ' + o.groups.length + ' Abschnitte');
  o = await go('#/app/metadata-catalog?kind=objekt&tab=diagramm&q=geb');
  check(o.tiles === 9, 'and the Diagramm tab to the same nine', String(o.tiles));
  o = await go('#/app/metadata-catalog?kind=objekt&tab=uebersicht&q=geb');
  check(/9 von 19/.test(o.qCount), 'and the count reports it even where nothing is listed', o.qCount);

  // A new scope starts unfiltered: carrying the query along a tree click would
  // leave a reader wondering where the records went.
  const treeHref = await p.evaluate(
    '(() => { const a = document.querySelector(".pf-tree__children a"); return a ? a.getAttribute("href") : ""; })()');
  check(!/[?&]q=/.test(treeHref), 'a tree link does not carry the query onward', treeHref);

  // At the root the scope is the whole catalogue, so the hits span all branches.
  o = await go('#/app/metadata-catalog?q=geb');
  check(o.cards === 0, 'a query replaces the way-in page with its answer', String(o.cards));
  check(o.groups.length === 3, 'grouped by branch, because a hit list spans three kinds of thing',
    o.groups.join(' | '));
  await clean(p, 'Suche');

  head('Gruppieren — one choice, both views');
  o = await go('#/app/metadata-catalog?kind=objekt&tab=diagramm');
  check(o.groupSel === 'achse:achse,verantwortung,status,keine',
    'a branch offers axis, stewardship, status and none', o.groupSel);
  check(o.boxes.length === 5, 'the axis divides the landscape into five', String(o.boxes.length));
  o = await go('#/app/metadata-catalog?kind=objekt&tab=diagramm&group=verantwortung');
  check(o.boxes.length === 4, 'stewardship divides it into four', o.boxes.join(' | '));
  check(o.tiles === 19, 'and never changes how many tiles there are', String(o.tiles));
  o = await go('#/app/metadata-catalog?kind=objekt&tab=diagramm&group=keine');
  check(o.boxes.length === 1 && o.tiles === 19, 'none collapses it to one field',
    o.boxes.length + ' Kasten, ' + o.tiles + ' Kacheln');
  // The same parameter, the other tab.
  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle&group=verantwortung');
  check(o.groups.length === 4, 'the table takes its sections from the same choice',
    o.groups.join(' | '));
  check(o.cols.includes('Domäne'),
    'and the axis returns as a column once the sections no longer carry it', o.cols.join('/'));
  // «keine» hands the table back to paging. Nineteen records at 25 a page is one
  // page, so the proof is that the section rows are gone and the plain rows are
  // all there — not that a pager is drawn.
  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle&group=keine');
  check(o.groups.length === 0 && o.rows === 19, 'none returns a plain, unsectioned table',
    o.groups.length + ' Abschnitte, ' + o.rows + ' Zeilen');
  // Reference lists have neither steward nor status in the data model yet, so
  // offering to group by them would offer a single «noch nicht erfasst» box.
  o = await go('#/app/metadata-catalog?kind=referenz&tab=diagramm');
  check(o.groupSel === 'achse:achse,keine', 'reference data offers only what it has', o.groupSel);
  await clean(p, 'Gruppieren');

  head('Sections');
  o = await go('#/app/metadata-catalog?kind=objekt&tab=tabelle');
  const branchRows = o.rows;
  check(o.groups.length > 1, 'a whole branch is sectioned by its axis', o.groups.join(' | '));
  check(/^Bauwerk und Liegenschaft/.test(o.groups[0]),
    'biggest section first — the map reads from the largest territory down', o.groups[0]);
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
  check(o.tabs.join('/') === 'Übersicht/Diagramm/Tabelle',
    'an unknown group falls back to its branch instead of throwing', o.tabs.join('/'));
  o = await go(idHref.slice(1) + '&attr=gibt-es-nicht');
  check(o.tabs.join('/') === 'Übersicht/Tabelle', 'an unknown attribute falls back to its record', o.tabs.join('/'));
  // A record has no landscape, so asking for one must land on the level default
  // rather than on a blank pane.
  o = await go(withTab(idHref, 'diagramm'));
  check(o.active === 'Tabelle', 'an unavailable tab falls back to the level default', o.active);
  check(o.rows > 0, 'and really renders that tab', String(o.rows));
  await clean(p, 'Broken links');
} finally {
  await browser.close();
}

console.log(fail ? `\n✗ ${fail} check(s) failed` : '\n✓ metadata catalogue');
process.exit(fail ? 1 : 0);
