// Metadata-catalogue checks cover inventory, tree, both detail views, the two
// kind inventories, reverse field-to-term mappings, and the DCAT bridge.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

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

const browser = await launch();

/* Inventory. */

head('Inventory — business objects');
let p = await openPage(browser, APP_BASE + '/app/metadata-catalog');
await sleep(1300);
let o = JSON.parse(await p.evaluate(`JSON.stringify({
  h1: document.querySelector('h1')?.textContent.trim(),
  countText: document.querySelector('#mc-count')?.textContent.replace(/\\s+/g,' ').trim(),
  rows: document.querySelectorAll('tbody tr').length,
  columns: [...document.querySelectorAll('thead th')].map(x => x.textContent.trim()),
  roots: [...document.querySelectorAll('.pf-tree > .pf-tree__item > .pf-tree__node')].map(n =>
    n.querySelector('.pf-tree__label').textContent + ' ' + n.querySelector('.pf-tree__n').textContent),
  icons: document.querySelectorAll('.pf-sidebar .pf-tree__ico').length,
  underlined: [...document.querySelectorAll('.pf-tree__node, .pf-tree__leaf')]
    .filter(x => getComputedStyle(x).textDecorationLine !== 'none').length,
  chevronsInsideNodes: document.querySelectorAll('.pf-tree__node > .pf-tree__chev').length,
  branchStates: [...document.querySelectorAll('.pf-tree__node[data-branch]')].map(x => x.dataset.branch + '=' + x.getAttribute('aria-expanded')),
  domains: [...document.querySelectorAll('.pf-tree > .pf-tree__item:first-child .pf-tree__leaf .pf-tree__label')].map(x => x.textContent),
  views: [...document.querySelectorAll('.view-switch__btn')].map(x => x.dataset.view),
  active: document.querySelector('.pf-tree__node.is-active .pf-tree__label')?.textContent,
})`));
check(o.h1 === 'Metadaten Katalog Bauten', 'page title', o.h1);
check(/19 von 19 Geschäftsobjekten/.test(o.countText || ''), 'result count is 19', o.countText);
check(o.rows === 12, '12 rows per page', String(o.rows));
check(o.columns.join(',') === 'Geschäftsobjekt,Domäne,Beschreibung,Attribute,Status', 'concept-list columns', o.columns.join(','));
check(o.roots.join(' | ') === 'Geschäftsobjekte 19 | Systeme 10', 'two roots with counts', o.roots.join(' | '));
check(o.domains.length === 5, 'five data domains in the tree', o.domains.join(', '));
check(o.chevronsInsideNodes === 2, 'chevron sits inside the branch button', String(o.chevronsInsideNodes));
check(o.views.join(',') === 'list,gallery', 'list is primary and gallery is secondary', o.views.join(','));
check(o.active === 'Geschäftsobjekte', 'business-objects branch is selected by default', o.active);
check(o.icons === 0, 'page tree has no icons', String(o.icons));
check(o.underlined === 0, 'navigation has no underline', String(o.underlined));
check(o.branchStates.join(',') === 'objects=true,systems=false', 'only the current-view branch is open', o.branchStates.join(','));
await clean(p, 'inventory');

head('Branch toggling and state persistence across filtering');
// On its active branch, the branch control toggles; elsewhere it navigates.
o = JSON.parse(await p.evaluate(`(async () => {
  document.querySelector('[data-branch=objects]').click();
  await new Promise(r => setTimeout(r, 200));
  const before = [...document.querySelectorAll('.pf-tree__children')].map(x => x.id + (x.hidden ? ':closed' : ':open'));
  const hashUnchanged = location.hash === '#/app/metadata-catalog';
  location.hash = '#/app/metadata-catalog?mapped=ja';
  await new Promise(r => setTimeout(r, 800));
  return JSON.stringify({ before, hashUnchanged,
    after: [...document.querySelectorAll('.pf-tree__children')].map(x => x.id + (x.hidden ? ':closed' : ':open')) });
})()`));
check(o.hashUnchanged, 'clicking the current branch does not navigate');
check(o.before.join(' | ') === 'mc-branch-objects:closed | mc-branch-systems:closed', 'the same click collapses the branch', o.before.join(' | '));
check(o.after.join(' | ') === o.before.join(' | '), 'state survives redraw', o.after.join(' | '));

head('Domain filter through the page tree');
o = JSON.parse(await p.evaluate(`(async () => {
  const a = [...document.querySelectorAll('.pf-tree__leaf')].find(x => /Bauwerk/.test(x.textContent));
  a.click();
  await new Promise(r => setTimeout(r, 700));
  return JSON.stringify({
    hash: location.hash,
    countText: document.querySelector('#mc-count')?.textContent.replace(/\\s+/g,' ').trim(),
    chip: document.querySelector('.active-filter')?.textContent.trim(),
    active: document.querySelector('.pf-tree__leaf.is-active .pf-tree__label')?.textContent,
  });
})()`));
check(/domain=bauwerk/.test(o.hash), 'domain appears in the hash', o.hash);
check(/8 von 19/.test(o.countText || ''), 'eight concepts in the selected domain', o.countText);
check(o.chip === 'Bauwerk und Liegenschaft', 'filter chip', o.chip);
check(o.active === 'Bauwerk und Liegenschaft', 'tree node is marked active', o.active);

head('Switch to system tables');
o = JSON.parse(await p.evaluate(`(async () => {
  const a = [...document.querySelectorAll('.pf-tree__node')].find(x => /Systeme/.test(x.textContent));
  a.click();
  await new Promise(r => setTimeout(r, 700));
  return JSON.stringify({
    hash: location.hash,
    countText: document.querySelector('#mc-count')?.textContent.replace(/\\s+/g,' ').trim(),
    columns: [...document.querySelectorAll('thead th')].map(x => x.textContent.trim()),
    ${/* Both branches have root and filter-value levels. */''}
  systems: [...document.querySelectorAll('.pf-tree > .pf-tree__item:last-child .pf-tree__leaf .pf-tree__label')].map(x => x.textContent),
    chips: document.querySelectorAll('.active-filter').length,
  });
})()`));
check(/kind=tabellen/.test(o.hash), 'kind appears in the hash', o.hash);
check(/10 von 10 Datentabellen/.test(o.countText || ''), 'result count is ten after excluding two invalid RE-FX tables', o.countText);
check(o.columns.join(',') === 'Tabelle,System,Beschreibung,Felder,Status', 'table-list columns', o.columns.join(','));
check(o.systems.join(' | ') === 'SAP RE-FX | GIS IMMO', 'both systems appear in the tree', o.systems.join(' | '));
check(o.chips === 0, 'domain filter does not carry across view changes', String(o.chips));
await clean(p, 'system tables');

head('No-realisation filter');
o = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/app/metadata-catalog?mapped=nein';
  await new Promise(r => setTimeout(r, 700));
  return JSON.stringify({
    countText: document.querySelector('#mc-count')?.textContent.replace(/\\s+/g,' ').trim(),
    chip: document.querySelector('.active-filter')?.textContent.trim(),
  });
})()`));
check(/12 von 19/.test(o.countText || ''), '12 concepts have no realisation', o.countText);
check(o.chip === 'Ohne Realisierung', 'chip names the state', o.chip);

/* Business-object detail. */

head('Building business object');
p = await openPage(browser, APP_BASE + '/app/metadata-catalog?id=gebaeude');
await sleep(1300);
o = JSON.parse(await p.evaluate(`JSON.stringify({
  h1: document.querySelector('h1')?.textContent.trim(),
  h1n: document.querySelectorAll('h1').length,
  tags: [...document.querySelectorAll('.detail-head .badge, .badge')].slice(0,2).map(x => x.textContent.trim()),
  attributeCountText: document.querySelector('#mc-at-count')?.textContent.replace(/\\s+/g,' ').trim(),
  ${/* C.table renders the first cell as a row-header th, not a td. */''}
  attributeNames: [...document.querySelectorAll('#mc-attrs tbody tr th strong')].map(x => x.textContent),
  mappingCountText: document.querySelector('#mc-mp-count')?.textContent.replace(/\\s+/g,' ').trim(),
  ${/* Metadata and responsible people live in the overview tab as ruled lists. */''}
  metadataTerms: [...document.querySelectorAll('[data-panel=overview] dt')].map(x => x.textContent),
  sections: [...document.querySelectorAll('[data-panel=overview] .detail-section__title')].map(x => x.textContent.trim()),
  adminLinks: document.querySelectorAll('[data-panel=overview] a[href*="admindir"]').length,
  ruledLists: document.querySelectorAll('[data-panel=overview] dl.kv--ruled').length,
  asideCards: [...document.querySelectorAll('[data-panel=overview] .detail-layout__aside .box h2')].map(x => x.textContent.trim()),
  definitionLead: document.querySelectorAll('h1 + .lead, .lead').length,
  asideOutside: document.querySelectorAll('.container__aside').length,
  pillRow: document.querySelectorAll('.pill-row').length,
  lead: document.querySelectorAll('.hero__description').length,
  ${/* Attribute rows no longer duplicate mapping links owned by the mapping table. */''}
  attributeColumns: [...document.querySelectorAll('#mc-attrs thead th')].map(x => x.textContent.trim()),
  tableLinks: [...document.querySelectorAll('#mc-maps a[href*="table="]')].length,
  crumbs: [...document.querySelectorAll('#breadcrumb-list li')].map(x => x.textContent.trim()),
  tabs: [...document.querySelectorAll('.tab__controls .tab__control')].map(x => x.textContent.trim() + ':' + x.getAttribute('aria-selected')),
  panels: [...document.querySelectorAll('[data-panel]')].map(x => x.dataset.panel + (x.hidden ? ':closed' : ':open')),
})`));
check(o.h1 === 'Gebäude', 'title', o.h1);
check(o.h1n === 1, 'exactly one h1', String(o.h1n));
check(o.attributeNames[0] === 'Gebäude-ID (BBL)', 'first attribute is the primary key', o.attributeNames[0]);
check(o.attributeNames.includes('EGID'), 'EGID appears among the attributes', o.attributeNames.join(', '));
check(/7 von 7 Attribute/.test(o.attributeCountText || ''), 'seven attributes', o.attributeCountText);
// Six of seven attributes map twice; the unmapped energy-source attribute yields twelve mappings.
check(/12 von 12 Realisierungen/.test(o.mappingCountText || ''), '12 realisations', o.mappingCountText);
check(o.attributeColumns.join(',') === 'Attribut,Beschreibung,Werttyp,Schlüssel', 'four columns with no stacked content', o.attributeColumns.join(','));
check(o.metadataTerms.includes('Bemerkung'), 'scope, aliases, and EGID appear in one note', o.metadataTerms.join(', '));
check(o.tableLinks >= 8, 'mapping table links to source tables', String(o.tableLinks));
check(!o.metadataTerms.includes('Beschreibung') && o.metadataTerms.includes('Datendomäne'), 'metadata list keeps domain while description becomes the lead', o.metadataTerms.join(', '));
check(o.sections.join(' | ') === 'Verantwortliche Personen | Metadaten', 'sections follow the dataset-detail pattern', o.sections.join(' | '));
check(o.ruledLists === 2, 'both key-value lists use the ruled variant', String(o.ruledLists));
check(!o.metadataTerms.includes('Attribute') && !o.metadataTerms.includes('Realisierungen'), 'counts are not duplicated outside the tabs', o.metadataTerms.join(', '));
check(o.lead === 0, 'application header has no hero description', String(o.lead));
check(o.definitionLead >= 1, 'definition appears as the lead under h1', String(o.definitionLead));
check(o.asideCards.join(' | ') === 'Kontakt', 'aside contains the shared contact card', o.asideCards.join(' | '));
check(o.adminLinks >= 2, 'responsible people link to AdminDir', String(o.adminLinks));
check(o.asideOutside === 0, 'no aside exists outside the tabs', String(o.asideOutside));
check(o.pillRow === 0, 'header has no pill row', String(o.pillRow));
check(o.crumbs.length === 5, 'breadcrumb reaches the concept', o.crumbs.join(' › '));
check(o.tabs.join(' | ') === 'Übersicht:true | Attribute (7):false | Realisierung (12):false', 'three tabs with overview active', o.tabs.join(' | '));
check(o.panels.join(' | ') === 'overview:open | attributes:closed | realisations:closed', 'only one panel is visible', o.panels.join(' | '));
await clean(p, 'business object');

head('Tab change');
o = JSON.parse(await p.evaluate(`(async () => {
  [...document.querySelectorAll('.tab__control')].find(x => /Attribute/.test(x.textContent)).click();
  await new Promise(r => setTimeout(r, 250));
  return JSON.stringify({
    panels: [...document.querySelectorAll('[data-panel]')].map(x => x.dataset.panel + (x.hidden ? ':closed' : ':open')),
    rows: document.querySelectorAll('#mc-attrs tbody tr').length,
  });
})()`));
check(o.panels.join(' | ') === 'overview:closed | attributes:open | realisations:closed', 'attributes panel opens', o.panels.join(' | '));
check(o.rows === 7, 'attribute table was already mounted', String(o.rows));

head('Concept without a realisation: empty table with headers');
o = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/app/metadata-catalog?id=raum';
  await new Promise(r => setTimeout(r, 800));
  return JSON.stringify({
    h1: document.querySelector('h1')?.textContent.trim(),
    headers: [...document.querySelectorAll('#mc-maps thead th')].map(x => x.textContent.trim()),
    emptyRow: document.querySelector('#mc-maps .table__empty')?.textContent.trim(),
    emptyState: document.querySelectorAll('#mc-maps .empty').length,
  });
})()`));
check(o.h1 === 'Raum', 'title', o.h1);
check(o.headers.join(',') === 'Attribut,System,Tabelle,Feld,Güte', 'table retains headers and columns', o.headers.join(','));
check(/keine Realisierung erfasst/.test(o.emptyRow || ''), 'row explains why the table is empty', o.emptyRow);
check(o.emptyState === 0, 'empty state does not replace the table', String(o.emptyState));

/* System-table detail. */

head('BUILDING system table (GIS IMMO)');
p = await openPage(browser, APP_BASE + '/app/metadata-catalog?table=gis-immo-building');
await sleep(1400);
o = JSON.parse(await p.evaluate(`JSON.stringify({
  h1: document.querySelector('h1')?.textContent.trim(),
  fieldCountText: document.querySelector('#mc-fl-count')?.textContent.replace(/\\s+/g,' ').trim(),
  conceptCountText: document.querySelector('#mc-rl-count')?.textContent.replace(/\\s+/g,' ').trim(),
  firstFields: [...document.querySelectorAll('#mc-fields tbody tr th code')].slice(0,3).map(x => x.textContent),
  fieldColumns: [...document.querySelectorAll('#mc-fields thead th')].map(x => x.textContent.trim()),
  description: [...document.querySelectorAll('[data-panel=overview] dd')][0]?.textContent.trim(),
  datasetLink: document.querySelector('[data-panel=overview] a[href*="/data/catalog/"]')?.getAttribute('href'),
  ${/* Select the source link specifically because people links now precede it. */''}
  sourceLink: [...document.querySelectorAll('[data-panel=overview] a[target=_blank]')].map(a => a.getAttribute('href')).find(h => !/admindir/.test(h)),
  tableTabs: [...document.querySelectorAll('.tab__controls .tab__control')].map(x => x.textContent.trim()),
  tablePanels: [...document.querySelectorAll('.tab__container')].length,
  conceptLinks: [...document.querySelectorAll('#mc-fields a[href*="id="]')].map(x => x.textContent.trim()).slice(0,3),
})`));
check(o.h1 === 'Gebäude', 'table title', o.h1);
check(/75 von 75 Felder/.test(o.fieldCountText || ''), '75 fields', o.fieldCountText);
// Expected business-object coverage includes buildings plus the five named master-data concepts.
check(/9 von 9 Begriffe/.test(o.conceptCountText || ''), 'nine realised concepts', o.conceptCountText);
check(o.firstFields[0] === 'bbl_id', 'field order matches the source system', o.firstFields.join(', '));
check(o.fieldColumns.join(',') === 'Feld,Beschreibung,Datentyp,Schlüssel,Realisiert', 'fields table has a dedicated description column', o.fieldColumns.join(','));
check(!/LIVE Felder|DEV Felder/.test(o.description || ''), 'description has no field statistics', o.description);
check(o.datasetLink === '#/data/catalog/11', 'link reaches the DCAT catalogue', o.datasetLink);
check(/gis\.bbl\.admin\.ch/.test(o.sourceLink || ''), 'source-system link uses the application-catalogue host', o.sourceLink);
check(o.conceptLinks.some((x) => /Gebäude/.test(x)), 'reverse index links the field to its concept', o.conceptLinks.join(' | '));
check(o.tableTabs.join(' | ') === 'Übersicht | Felder (75) | Realisierung (9)', 'table uses the same tab structure as a business object', o.tableTabs.join(' | '));
check(o.tablePanels === 3, 'three tab containers', String(o.tablePanels));
await clean(p, 'system table');

head('Fields-without-concepts facet');
o = JSON.parse(await p.evaluate(`(async () => {
  document.querySelector('#mc-fl-filter').click();
  await new Promise(r => setTimeout(r, 250));
  const cb = [...document.querySelectorAll('#mc-fl-panel input[data-fdim=katalog]')].find(x => x.value === 'nein');
  cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 350));
  return JSON.stringify({ countText: document.querySelector('#mc-fl-count')?.textContent.replace(/\\s+/g,' ').trim() });
})()`));
// Nine of 75 fields carry catalogue terms; the remainder exposes the governance gap.
check(/66 von 75 Felder/.test(o.countText || ''), '66 fields have no catalogued concept', o.countText);

head('Unknown identifiers');
for (const [hash, label] of [['?id=gibtsnicht', 'business object'], ['?table=gibtsnicht', 'table']]) {
  o = JSON.parse(await p.evaluate(`(async () => {
    location.hash = '#/app/metadata-catalog${hash}';
    await new Promise(r => setTimeout(r, 700));
    return JSON.stringify({ h1: document.querySelector('h1')?.textContent.trim(),
      errorBand: !!document.querySelector('.notification--error') });
  })()`));
  check(/nicht gefunden/.test(o.h1 || ''), `${label}: not-found view renders instead of crashing`, o.h1);
  check(!o.errorBand, `${label}: no error banner`);
}
await clean(p, 'not found');

/* Integration. */

head('Catalogue and navigation integration');
p = await openPage(browser, APP_BASE + '/applications/metadaten-katalog');
await sleep(1200);
o = JSON.parse(await p.evaluate(`JSON.stringify({
  h1: document.querySelector('h1')?.textContent.trim(),
  // The signed-out entry stays a real new-tab link; the launched app owns its login gate.
  entryLink: (() => {
    const a = document.querySelector('.container__aside a[href*="metadata-catalog"]');
    return a ? { href: a.getAttribute('href'), target: a.getAttribute('target'),
      rel: a.getAttribute('rel') || '', label: a.querySelector('.btn__text')?.textContent.trim() } : null;
  })(),
  // Domain filtering now belongs to the catalogue after removal of the former facts card.
  cards: [...document.querySelectorAll('.container__aside .box h3')].map(x => x.textContent.trim()),
})`));
check(o.h1 === 'Metadaten Katalog Bauten (Portal)', 'application landing page', o.h1);
check(o.entryLink?.href === '#/app/metadata-catalog'
  && o.entryLink.label === 'Anwendung starten'
  && o.entryLink.target === '_blank' && o.entryLink.rel.split(/\s+/).includes('noopener'),
  'neutral entry opens the app safely in a new tab', JSON.stringify(o.entryLink));
check(o.cards.join('|') === 'Zugriff|Kontakt', 'aside contains only access and contact', o.cards.join(' | '));

const inCatalogue = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/applications?area=buildings';
  await new Promise(r => setTimeout(r, 900));
  return JSON.stringify({ found: !!document.querySelector('a[href*="metadaten-katalog"]') });
})()`));
check(inCatalogue.found, 'buildings area filter still finds the application');
// Return to the landing page before clean validates it.
await p.evaluate(`location.hash = '#/applications/metadaten-katalog'; true`);
await sleep(900);
await clean(p, 'landing page');

o = JSON.parse(await p.evaluate(`(async () => {
  location.hash = '#/data';
  await new Promise(r => setTimeout(r, 800));
  return JSON.stringify({
    tile: !!document.querySelector('a[href="#/app/metadata-catalog"]'),
    federalTile: !!document.querySelector('a[href="#/applications?area=federal"]'),
  });
})()`));
check(o.tile, 'tile appears on the data overview');
check(o.federalTile, 'federal-applications tile also appears');

/* Discoverability through global search — the reason data tables were renamed
   from «system tables» (2026-08-12). Before this the physical layer was reachable
   only by already knowing this app existed: no search row pointed at a table. */

head('Global search finds data tables');
const searchFor = async (query) => {
  await p.evaluate(`location.hash = '#/search?q=${encodeURIComponent(query)}'; true`);
  await sleep(1200);
  return JSON.parse(await p.evaluate(`JSON.stringify(
    [...document.querySelectorAll('li.search-result')].map((r, i) => ({
      rank: i + 1,
      type: (r.querySelector('.meta-info__item')?.textContent || '').trim(),
      title: (r.querySelector('.search-result__title')?.textContent || '').trim(),
      href: r.querySelector('a')?.getAttribute('href') || '',
    })))`));
};
const firstTable = (rows) => rows.find((r) => /^Datentabelle/.test(r.type));

// A field's German description, then its technical column name. This is what a
// data analyst actually types, and it is the query the old model answered worst.
for (const [query, expected] of [['Buchungskreis', 'Wirtschaftseinheit'], ['COMP_CODE', 'Wirtschaftseinheit']]) {
  const hit = firstTable(await searchFor(query));
  check(hit?.title === expected, `«${query}» finds ${expected}`, hit ? `#${hit.rank} ${hit.title}` : 'no table hit');
  check(/metadata-catalog\?table=/.test(hit?.href || ''), `«${query}» links to the table detail`, hit?.href || '—');
}

// The category noun. `kind` is a facet, not indexed text, so the rows carry it
// in `extra`; without that, «Datentabelle» returned no table at all.
const category = await searchFor('Datentabelle');
check(category.length === 10, 'the category noun returns all ten tables', String(category.length));
check(/^Datentabelle/.test(category[0]?.type || ''), 'a table ranks first for the category noun', category[0]?.type);

// A table name, and the published dataset outranking its physical table — a
// dataset is the consumable thing, the table its implementation.
const named = await searchFor('Wirtschaftseinheit');
check(named[0]?.type === 'Datensatz', 'the dataset outranks its table', `#1 ${named[0]?.type} ${named[0]?.title}`);
check(firstTable(named)?.rank === 2, 'the table follows immediately', `#${firstTable(named)?.rank}`);

await clean(p, 'search results');

await browser.close();
console.log(fail ? `\n✗ ${fail} check(s) failed` : '\n✓ all checks passed');
process.exit(fail ? 1 : 0);
