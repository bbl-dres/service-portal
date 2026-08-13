// Data access — dataset catalogue (DCAT-AP-CH).
// Uses the same pattern as #/services: search on the left, filter dropdowns and
// the view switcher on the right, active filters as pills, gallery/list views,
// and a detail view at #/data/catalog/<id>. The data model and preview images
// come from the data catalogue prototype (data/datasets.json).

import { classifyUrl, newWindowAttrs, safeLinkUrl, safeResourceUrl } from '../security/urls.js';
import { bookmarkButton, bookmarkMark, savedFilterDimension, savedFilterGroup, savedFilterPill, savedOnly } from '../ui/bookmark.js';
import { bookmarks } from '../core/bookmarks.js';

// 12, matching the sibling catalogues (B16).
const PER_PAGE = 12;

// The parent data route contract in data.js declares the collection because the
// router only reaches this module through its delegate. This delegated module
// therefore has no `needs` export of its own.

export function catalog(ctx) {
  const { params } = ctx;
  return params[1] ? detail(ctx, params[1]) : list(ctx);
}

// ============================== LIST ===============================

function list(ctx) {
  const { mount, core, C, query, setTitle, setCrumbs } = ctx;
  setTitle('Datenbezug und API Verzeichnis');
  setCrumbs(crumbs());

  const all = core.datasets();
  const t = core.t;

  // Read the catalogue pattern's state from ONE source (C.catalogueState, B16).
  const state = C.catalogueState(query, {
    base: '#/data/catalog', perPage: PER_PAGE,
    sortOpts: ['title', 'thema', 'date'],
    filters: { topic: null, classification: null, tag: null, ...savedFilterDimension() },
  });
  const { q: rawQ, view, hash } = state;
  const q = rawQ.toLowerCase();
  const topics = state.selected.topic, classifications = state.selected.classification, tags = state.selected.tag;
  const savedOnlyOn = savedOnly(state.selected.bookmark);

  const topicOptions = uniq(all.map(d => t(d.meta['thema']))).sort((a, b) => a.localeCompare(b, 'de'));
  const classificationOptions = uniq(all.map(d => d.meta['klassifizierung']));

  // Sorting (catbar): empty means data order (the «Sortieren» placeholder). The
  // publication date is German text («10. Mai 2025»), so parse its month for sorting.
  const GERMAN_MONTH_NUMBER = { 'Januar': 1, 'Februar': 2, 'März': 3, 'April': 4, 'Mai': 5, 'Juni': 6, 'Juli': 7, 'August': 8, 'September': 9, 'Oktober': 10, 'November': 11, 'Dezember': 12 };
  const dateKey = (s) => { const m = String(s || '').match(/(\d+)\.\s*([A-Za-zäöü]+)\s*(\d{4})/); return m ? Number(m[3]) * 10000 + (GERMAN_MONTH_NUMBER[m[2]] || 0) * 100 + Number(m[1]) : 0; };
  const SORT_OPTIONS = [{ value: 'title', label: 'Titel (A–Z)' }, { value: 'thema', label: 'Thema' }, { value: 'date', label: 'Ausgabedatum (neuste zuerst)' }];
  const SORTS = {
    title: (a, b) => t(a.title).localeCompare(t(b.title), 'de'),
    thema: (a, b) => t(a.meta['thema']).localeCompare(t(b.meta['thema']), 'de') || t(a.title).localeCompare(t(b.title), 'de'),
    date: (a, b) => dateKey(b.meta['ausgabedatum']) - dateKey(a.meta['ausgabedatum']) || t(a.title).localeCompare(t(b.title), 'de'),
  };
  const sortKey = state.sort;

  const matches = (d) =>
    (!q || (t(d.title) + ' ' + t(d.description) + ' ' + t(d.fullDescription)).toLowerCase().includes(q)) &&
    (!topics.length || topics.includes(t(d.meta['thema']))) &&
    (!classifications.length || classifications.includes(d.meta['klassifizierung'])) &&
    (!tags.length || tags.every(x => (d.tags || []).includes(x))) &&
    (!savedOnlyOn || bookmarks.has('dataset', d.id));

  const filtered = all.filter(matches);
  const datasets = sortKey ? filtered.slice().sort(SORTS[sortKey]) : filtered;
  const { visible, totalPages, page } = state.clamp(datasets);

  // Each pill links to the same view without that value, so removing a filter
  // needs no JavaScript and remains deep-linkable.
  const active = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hash({ q: '' }) }] : []),
    ...savedFilterPill(state.selected.bookmark, hash),
    ...topics.map(x => ({ label: x, href: hash({ topic: topics.filter(y => y !== x) }) })),
    ...classifications.map(x => ({ label: classificationLabel(core, x), href: hash({ classification: classifications.filter(y => y !== x) }) })),
    ...tags.map(x => ({ label: tagLabel(core, x), href: hash({ tag: tags.filter(y => y !== x) }) })),
  ];

  const card = (d) => C.card({
    title: t(d.title),
    desc: t(d.description),
    href: `#/data/catalog/${encodeURIComponent(d.id)}`,
    image: preview(C, d),
    imageAlt: '',
    // Placed by C.card — see applications.js.
    mark: bookmarkMark({ kind: 'dataset', id: d.id }),
    badges: [
      C.badge(t(d.meta['thema']), 'blue'),
      C.badge(classificationLabel(core, d.meta['klassifizierung']), classificationVariant(d.meta['klassifizierung'])),
      ...(d.meta['personenbezogen'] && d.meta['personenbezogen'] !== 'none'
        ? [C.badge(core.label(`enum.personaldata.${d.meta['personenbezogen']}`, 'Personenbezogen'), 'warning')] : []),
    ],
    footerInfo: C.escape(formats(d).join(' · ') || '—'), footerAction: C.cardAction(),
  });

  const listView = (rows) => C.table({
    caption: 'Datensätze',
    zebra: true,
    // The first column is the row link; as in all catalogue list views, clicking
    // anywhere on the row follows it (consistent affordance, tbl-8).
    rowsClickable: true,
    columns: [
      { key: 'title', label: 'Datensatz', render: d =>
        `<a href="#/data/catalog/${encodeURIComponent(d.id)}">${C.escape(t(d.title))}</a>
         <br><span class="small muted">${C.escape(t(d.description))}</span>` },
      // One column of marks straight after the name — see applications.js.
      { key: 'bookmark', label: 'Favorit', labelHidden: true, align: 'center',
        render: d => bookmarkMark({ kind: 'dataset', id: d.id }) },
      { key: 'thema', label: 'Thema', render: d => C.escape(t(d.meta['thema'])) },
      { key: 'klass', label: 'Klassifizierung', render: d =>
        C.badge(classificationLabel(core, d.meta['klassifizierung']), classificationVariant(d.meta['klassifizierung'])) },
      { key: 'formate', label: 'Formate', render: d => C.escape(formats(d).join(', ') || '—') },
    ],
    rows,
  });

  // Anatomy, ids and wiring from C.catalogueView — see applications.js.
  const catalogue = C.catalogueView({
    prefix: 'ds', hash, noun: 'Datensatz',
    // unit carries both grammatical cases; the old emptyMsg/unavailableMsg
    // overrides existed only as a grammatical workaround (A14).
    unit: { nom: 'Datensätze', dat: 'Datensätzen' },
    title: 'Datenbezug und API Verzeichnis',
    lead: 'Die Datensätze des BBL — beschrieben nach DCAT-AP-CH, mit Bezugswegen, Klassifizierung und Datenverantwortung.',
    q: rawQ, view, views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List']],
    page, totalPages, sort: { value: sortKey, options: SORT_OPTIONS },
    count: datasets.length, total: all.length,
    filterCount: topics.length + classifications.length + tags.length + (savedOnlyOn ? 1 : 0),
    panel: `
      ${/* Favourites first — see applications.js. */''}
      ${savedFilterGroup(state.selected.bookmark)}
      ${C.filterGroup({ dim: 'topic', legend: 'Thema', selected: topics, options: topicOptions.map(x => ({ value: x, label: x })) })}
      ${C.filterGroup({ dim: 'classification', legend: 'Klassifizierung', selected: classifications, options: classificationOptions.map(x => ({ value: x, label: classificationLabel(core, x) })) })}
      ${/* The parameter is named `classification`, not `klass`; with the
            wrong key, the filter survived its own reset. */''}
      ${C.panelReset({ href: hash({ topic: [], classification: [], tag: [], bookmark: [] }) })}`,
    activeFilters: active, resetHref: '#/data/catalog',
    visible, card, listView, available: core.available('datasets'),
  });

  mount.innerHTML = catalogue.html;
  catalogue.wire(mount, ctx);
}

// ============================== DETAIL =============================

function detail(ctx, id) {
  const { mount, core, C, query, setTitle, setCrumbs } = ctx;
  const d = core.dataset(C.safeDecode(id));
  const t = core.t;
  const activeTab = TABS.some((x) => x.id === query.get('tab')) ? query.get('tab') : TABS[0].id;

  if (!d) {
    C.renderNotFound(ctx, { thing: 'Dieser Datensatz', title: 'Datensatz nicht gefunden',
      backHref: '#/data/catalog', backLabel: 'Datenbezug und API Verzeichnis', crumbs: crumbs() });
    return;
  }
  setTitle(t(d.title));
  setCrumbs([...crumbs(), { label: t(d.title) }]);

  const tabs = tabsFor(core, d);

  const img = preview(C, d);

  // Tags lead back to the catalogue with that filter selected.
  const tagPills = (d.tags || []).map(x =>
    `<a class="badge badge--gray" href="${C.catalogueHash('#/data/catalog', { tag: [x] })}">${C.escape(tagLabel(core, x))}</a>`).join('');

  // Metadata in data-catalogue order (config.metaFields.dataset).
  //
  // «Kontaktstelle» left this list (user decision, 2026-08-12): the aside now
  // carries a contact card, and the address appeared in both places. The ID takes
  // its slot — it is what someone quotes in a request or a support ticket, and
  // the page had no visible identifier at all.
  const metaRows = [
    ['ID', C.escape(String(d.id))],
    ['Ausgabedatum', C.escape(d.meta['ausgabedatum'])],
    ['Aktualisierungsintervall', C.escape(core.label(`enum.frequency.${d.meta['aktualisierungsintervall']}`, d.meta['aktualisierungsintervall']))],
    ['Status', C.escape(core.label(`enum.status.${d.meta.status}`, d.meta.status))],
    ['Klassifizierung', C.badge(classificationLabel(core, d.meta['klassifizierung']), classificationVariant(d.meta['klassifizierung']))],
    ['Personenbezogene Daten', C.badge(core.label(`enum.personaldata.${d.meta['personenbezogen']}`, '—'), 'gray')],
    ['Archivwürdig', C.escape(core.label(`enum.archival.${d.meta['archivwuerdig']}`, d.meta['archivwuerdig']))],
    ['Thema', C.escape(t(d.meta['thema']))],
    ['Rechtsgrundlage', C.escape(t(d.meta['rechtsgrundlage']))],
    ['Bemerkung', C.escape(t(d.meta['kommentar']))],
  ];

  // Distributions: one CD accordion item per distribution, with all DCAT fields
  // in the panel (data catalogue config.distributionFields).
  const DIST_FIELDS = [
    { key: 'identifikator', label: 'Identifikator' },
    { key: 'titel', label: 'Titel', fallback: 'name' },
    { key: 'zugriffsUrl', label: 'Zugriffs-URL', link: true },
    { key: 'downloadUrl', label: 'Download-URL', link: true },
    { key: 'status', label: 'Status', enumPrefix: 'enum.status' },
    { key: 'dateiformat', label: 'Dateiformat', fallback: 'format' },
    { key: 'lizenz', label: 'Lizenz' },
    { key: 'bemerkungen', label: 'Bemerkungen' },
  ];
  const distributionValue = (dist, f) => {
    const raw = dist[f.key] || (f.fallback ? dist[f.fallback] : '');
    const val = t(raw);
    if (!val) return '<span class="muted">—</span>';
    if (f.link) {
      const href = safeLinkUrl(val);
      return href
        ? `<a href="${C.escape(href)}"${newWindowAttrs(href, { external: classifyUrl(href) === 'external' })} class="break-all">${C.escape(val)}</a>`
        : `<span class="break-all" aria-disabled="true">${C.escape(val)}</span>`;
    }
    if (f.enumPrefix) return C.escape(core.label(`${f.enumPrefix}.${val}`, val));
    if (f.key === 'lizenz') return C.escape(licenceLabel(val));
    return C.escape(val);
  };
  const distributions = (d.distributions || []).map((dist) => {
    const format = dist['dateiformat'] || dist.format || '';
    const download = dist.downloadUrl || dist['zugriffsUrl'] || '';
    return {
      title: t(dist.name) || dist['titel'],
      meta: format ? C.badge(format, 'gray', 'sm') : '',
      body: `<dl class="kv kv--ruled">
          ${DIST_FIELDS.map(f => `<dt>${f.label}</dt><dd>${distributionValue(dist, f)}</dd>`).join('')}
        </dl>
        <div class="row mt-4">${C.downloadLink(download, 'Datensatz beziehen')}</div>`,
    };
  });

  // A publication IS an entry in another catalogue, so link it rather than
  // forcing people to search for its name there. `url` is optional: when an
  // announced publication has not been entered yet, keep the name as text
  // instead of creating a dead link. It leaves the portal, hence target/rel as
  // on the access URLs above.
  const publications = (d.publications || []).map(p => {
    const name = C.escape(t(p.value));
    const href = safeLinkUrl(p.url);
    return `
      <dt>${C.escape(t(p.catalog))}</dt>
      <dd>${href
        ? `<a href="${C.escape(href)}"${newWindowAttrs(href, { external: classifyUrl(href) === 'external' })} class="break-all">${name}</a>`
        : name}</dd>`;
  }).join('');

  const section = (title, body) => C.detailSection({ title, body });

  mount.innerHTML = `
  <div class="container section">
    ${C.detailHead({
      backHref: '#/data/catalog', backLabel: 'Datenbezug und API Verzeichnis',
      title: t(d.title), lead: t(d.description),
      tags: tagPills,
      image: img ? `<img class="hero-media hero-media--16x9" src="${img}" alt="" loading="lazy">` : '',
      // The dataset catalogue was the first surface to carry «merken» (user
      // decision) and is now one of three with the same star in the same corner.
      // It is the only one whose picture is optional — one dataset in twenty has
      // no preview — so it is also the only one that exercises detailHead's
      // fallback into the title row.
      bookmark: bookmarkButton({ kind: 'dataset', id: d.id, name: t(d.title) }),
    })}

    ${/* Labels carry the field count; ids stay TABS' own, so the hash, the
          panels and wireTabs are untouched by the counting. */''}
    ${C.tabBar({ items: tabs, active: activeTab, idPrefix: 'ds', ariaLabel: 'Ansichten des Datensatzes' })}
    ${C.tabPanels({ items: tabs, active: activeTab, idPrefix: 'ds', heading: true, render: (id) => id === 'fields'
      ? fieldsPanel(C, core, d)
      : `${/* Main column plus aside, the anatomy of the service and application
             detail pages. This page used to be a single 60rem column with the
             responsible people as a section in the flow — a data-governance
             answer on a page whose readers are looking for the data and for
             someone to ask (user decision, 2026-08-12). */''}
    <div class="container--grid gap--responsive">
      <div class="container__main">
    ${section('Beschreibung', `<p>${C.escape(t(d.fullDescription) || t(d.description))}</p>`)}

    ${section('Metadaten', `<dl class="kv kv--ruled">${metaRows.map(([k, v]) => `
      <dt>${C.escape(k)}</dt>
      <dd>${v || '<span class="muted">—</span>'}</dd>`).join('')}</dl>`)}

    ${C.detailSection({ title: 'Bereitstellungsformen', id: DIST_SECTION_ID, body: distributions.length
      ? C.accordion(distributions, { id: 'dist' })
      : '<p class="muted">Für diesen Datensatz ist keine Bereitstellungsform erfasst.</p>' })}

    ${section('Publikationen in externen Katalogen', publications
      ? `<dl class="kv kv--ruled">${publications}</dl>`
      : '<p class="muted">Dieser Datensatz ist in keinem externen Katalog publiziert.</p>')}
      </div>

      ${/* No .stack-lg: .container__aside > * already carries CD sidebar spacing. */''}
      <aside class="container__aside" aria-labelledby="ds-aside-head">
        <h2 class="sr-only" id="ds-aside-head">Zugriff und Kontakt</h2>
        ${C.accessCard({
    // Unlike a service or an application, the target is not another system but
    // a section of this page: the ways to obtain the data differ per dataset
    // (API, WFS, file), so the card sends the reader to the list rather than
    // picking one for them. Wired below — a bare «#id» would otherwise be read
    // by the hash router as a route.
    href: `#${DIST_SECTION_ID}`, label: 'Daten beziehen', newWindow: false,
    note: distributionNote(distributions.length, formats(d)),
    missing: 'Für diesen Datensatz ist keine Bereitstellungsform erfasst.',
    bookmark: bookmarkButton({ kind: 'dataset', id: d.id, name: t(d.title), variant: 'link' }),
  })}
        ${C.contactBox(datasetContact(d), { title: 'Kontakt' })}
      </aside>
    </div>` })}
  </div>`;

  // CD accordion: expand and collapse through the shared wiring.
  C.wireAccordion(mount);
  // Both panels are in the DOM (tabPanels pattern A), so switching is a class
  // change and the active tab rides in the hash for sharing, like every other
  // tabbed detail page in the portal.
  C.wireTabs(mount, {
    syncHash: (tab) => history.replaceState(history.state, '',
      `#/data/catalog/${encodeURIComponent(d.id)}${tab === TABS[0].id ? '' : `?tab=${tab}`}`),
  });
  // Both panels exist in the DOM from the start, so the field tables mount once
  // here rather than on first tab activation. They keep their own local state
  // (search, sort, page), which therefore survives switching tabs back and forth.
  ctx.onUnmount(wireFieldsPanel(C, core, d, mount));
  wireDistributionJump(mount);
}

// «Daten beziehen» scrolls to the distributions instead of leaving the page.
// preventDefault is not optional: the app is hash-routed, so letting the browser
// follow «#ds-distributions» would replace the route and land on a 404 (the same
// reason js/pages/anchor-nav.js intercepts its table of contents).
function wireDistributionJump(mount) {
  const link = mount.querySelector(`.access-card a[href="#${DIST_SECTION_ID}"]`);
  const target = mount.querySelector(`#${DIST_SECTION_ID}`);
  if (!link || !target) return;
  link.addEventListener('click', (e) => {
    e.preventDefault();
    // The target lives in the first tab. Arriving from «Datenfelder», scrolling
    // alone would move to a hidden element, so switch tabs first.
    const overview = mount.querySelector(`.tab__control[aria-selected="false"][id$="-${TABS[0].id}"]`);
    if (overview) overview.click();
    // Land on an OPEN first distribution (user request, 2026-08-12). Arriving at
    // a column of collapsed headers is one more click between «I want the data»
    // and the URL that serves it. Clicking the button rather than setting the
    // attributes reuses wireAccordion's drawer animation and [hidden] handling —
    // duplicating that here is how the two would drift apart.
    const first = target.querySelector('.accordion__button');
    if (first && first.getAttribute('aria-expanded') !== 'true') first.click();
    target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    (target.querySelector('.detail-section__title') || target).focus({ preventScroll: true });
  });
}

// ============================== Helpers ==============================

// Two tabs, and deliberately only two. Analysts asked for technical metadata at
// field level; the conceptual layer they also named (business objects, process
// and compliance relations) already exists in the metadata catalogue and stays
// there — putting it here as well was the thing that made the page overwhelming.
const TABS = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'fields', label: 'Datenfelder' },
];

// Jump target for the access card. A section of this page, not a route.
const DIST_SECTION_ID = 'ds-distributions';

// The access card's footnote: what the reader will find at the target. Naming
// the formats here is what makes the button worth pressing.
function distributionNote(count, formatList) {
  if (!count) return '';
  const forms = formatList.length ? ` — ${formatList.join(', ')}` : '';
  return `${count === 1 ? 'Eine Bereitstellungsform' : `${count} Bereitstellungsformen`}${forms}.`;
}

// The generic contact point for this dataset. `responsiblePersons` (Dateneigner,
// Datenverwalter with their AdminDir entries) stays in the data but no longer
// appears here: this is a data and API directory, and a reader wanting the data
// needs ONE address to write to, not a governance chart (user decision,
// 2026-08-12). It remains in data/datasets.json for whoever needs it later.
function datasetContact(dataset) {
  const email = dataset.meta['kontaktstelle'];
  if (!email) return null;
  return { role: 'Kontaktstelle', email, unit: 'Bundesamt für Bauten und Logistik' };
}

// The physical field list behind a dataset.
//
// It is a JOIN, not a second model: the definitions live in data/data-tables.json,
// which already carries `datasetId`, and js/pages/data.js loads that file only for
// a dataset's own page. Nothing about fields is duplicated into datasets.json —
// that file is 128 KB and loads on the catalogue LIST, where nobody needs columns.
//
// Modelled 1:n although the data is 1:1 today. One dataset genuinely can span
// several tables — a single SAP business object is scattered across many — so the
// lookup collects all matches rather than taking the first.
function tablesForDataset(core, dataset) {
  return core.dataTables().filter((table) => String(table.datasetId) === String(dataset.id));
}

// «Datenfelder (75)» — the tab states its own size, so nobody opens it to find
// out whether anything is there (user request, 2026-08-12). Zero is worth
// showing too: it is the answer for 13 of 20 datasets.
function fieldCount(core, dataset) {
  return tablesForDataset(core, dataset).reduce((n, table) => n + (table.fields || []).length, 0);
}

function tabsFor(core, dataset) {
  const total = fieldCount(core, dataset);
  return TABS.map((tab) => (tab.id === 'fields' ? { ...tab, label: `${tab.label} (${total})` } : tab));
}

// `nullable`, `primaryKey` and `foreignKey` are booleans on the record, so the
// constraint column states what they mean instead of printing three flags.
// `values` is optional and carries a value list where the source defines one.
//
// Plain text, because this string has two destinations now: the rendered cell
// and the CSV export. Building the export from the DOM would have taken the
// visible page only, and «—» would have travelled into the spreadsheet as data.
//
// `composite` says the table's key spans SEVERAL columns, so each of them is a
// part rather than a key of its own. A table has exactly one primary key; the
// flags used to claim three or four per table, which is what the domain review
// corrected in the data (user, 2026-08-12). Only VIBDBE Bemessungen genuinely
// has one — object, measurement type and validity date together identify a row.
//
// `unique` is the other half of that correction: a column can be unique without
// being the key. bbl_id is what analysts join GIS layers on, while the layer's
// own key is the Esri-managed objectid.
function fieldConstraintText(field, composite = false) {
  const parts = [];
  if (field.primaryKey) parts.push(composite ? 'Teil des Primärschlüssels' : 'Primärschlüssel');
  if (field.foreignKey) parts.push('Fremdschlüssel');
  if (field.unique && !field.primaryKey) parts.push('Eindeutig');
  if (!field.nullable && !field.primaryKey) parts.push('Pflichtfeld');
  if (Array.isArray(field.values) && field.values.length) {
    parts.push(`Werteliste: ${field.values.join(', ')}`);
  }
  return parts.join(' · ');
}

// True when the table's primary key spans more than one column.
const hasCompositeKey = (table) => (table.fields || []).filter((f) => f.primaryKey).length > 1;

const EM_DASH = '<span class="muted">—</span>';
function fieldConstraint(C, field, composite) {
  return C.escape(fieldConstraintText(field, composite)) || EM_DASH;
}

const NO_FIELDS_MESSAGE = 'Für diesen Datensatz sind noch keine Felddefinitionen erfasst. '
  + 'Sobald die Struktur im Metadatenkatalog beschrieben ist, erscheint sie hier.';

const FIELD_COLUMNS = [
  { key: 'name', label: 'Feld' }, { key: 'description', label: 'Beschreibung' },
  { key: 'dataType', label: 'Format' }, { key: 'constraint', label: 'Constraint' },
  { key: 'comment', label: 'Kommentar' },
];

const fieldsHostId = (index) => `ds-fields-${index}`;

// The panel renders only its mount points; C.mountDataTable fills them after
// insertion (see wireFieldsPanel). A dataset's field list runs to 66 rows, which
// is why this is a data table rather than C.table: search, sorting and paging in
// the same bar every other long table in the portal uses.
//
// No heading and no subtitle above it (user decision, 2026-08-12): the tab is
// already called «Datenfelder», tabPanels adds an sr-only <h2> with that name,
// and the system and schema behind it are stated in the first tab. German UI term: Übersicht
// The search field carries the table's name instead, where it is useful.
function fieldsPanel(C, core, dataset) {
  const tables = tablesForDataset(core, dataset);
  // The empty case is the COMMON one — 13 of 20 datasets have no table today, and
  // that will stay true in production. It shows the same table with its head, so
  // the reader sees which columns would be there, plus a hint naming the gap
  // rather than a bare «no data» (user decision, 2026-08-12). No bar here: there
  // is nothing to search, sort or page through.
  if (!tables.length) {
    return C.table({ caption: 'Datenfelder', zebra: true, columns: FIELD_COLUMNS, rows: [], emptyText: NO_FIELDS_MESSAGE });
  }
  return `<div class="stack">${tables.map((table, i) =>
    `<div id="${fieldsHostId(i)}"></div>`).join('')}</div>`;
}

// Mount one data table per linked table. Returns a disposer for ctx.onUnmount.
function wireFieldsPanel(C, core, dataset, mount) {
  const disposers = tablesForDataset(core, dataset).map((table, i) => {
    const host = mount.querySelector(`#${fieldsHostId(i)}`);
    if (!host) return null;
    const label = table.displayName || table.name;
    const composite = hasCompositeKey(table);
    return C.mountDataTable(host, {
      id: fieldsHostId(i),
      caption: `Datenfelder ${label}`,
      rows: table.fields || [],
      unit: { nom: 'Datenfelder', dat: 'Datenfeldern' },
      searchLabel: `Datenfelder ${label} durchsuchen`,
      // Kept short: the bar's input is ~340px and a longer hint is cut off mid-word.
      placeholder: 'Feld oder Beschreibung suchen…',
      // Constraint text is derived, not stored, so a plain key list would miss
      // «Pflichtfeld» and the value lists.
      search: (f, q) => [f.name, f.description, f.dataType, f.comment, fieldConstraintText(f, composite)]
        .some((v) => String(v || '').toLowerCase().includes(q)),
      sorts: [
        // Same first option, wording and cmp as the field list in the metadata
        // catalogue (metadata-catalog.js): it is the same data seen from the
        // other side, so sorting it should not feel like a different table.
        { value: 'ord', label: 'Reihenfolge im System', cmp: () => 0 },
        { value: 'name', label: 'Feld (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
        { value: 'type', label: 'Format', cmp: (a, b) => String(a.dataType).localeCompare(String(b.dataType), 'de') || a.name.localeCompare(b.name, 'de') },
        // Keys first: the question «what identifies a row» is the one people
        // arrive with, and in source order the keys are merely wherever they fell.
        { value: 'key', label: 'Schlüsselfelder zuerst', cmp: (a, b) =>
          (b.primaryKey ? 1 : 0) - (a.primaryKey ? 1 : 0)
          || (b.foreignKey ? 1 : 0) - (a.foreignKey ? 1 : 0)
          || a.name.localeCompare(b.name, 'de') },
      ],
      // No sort selected by default, so the table opens in SOURCE order — the
      // column order of the real table, which is itself information.
      perPage: 20,
      columns: [
        { key: 'name', label: 'Feld', nowrap: true, render: (f) => `<code>${C.escape(f.name)}</code>` },
        { key: 'description', label: 'Beschreibung', render: (f) => C.escape(f.description) || EM_DASH },
        { key: 'dataType', label: 'Format', nowrap: true, render: (f) => C.escape(f.dataType) },
        { key: 'constraint', label: 'Constraint', render: (f) => fieldConstraint(C, f, composite) },
        { key: 'comment', label: 'Kommentar', render: (f) => C.escape(f.comment || '') || EM_DASH },
      ],
      // The bar opens the tab panel, so it drops its top margin.
      flush: true,
      extra: C.menu({
        menuId: fieldsHostId(i), label: 'Weitere Aktionen', triggerLabel: 'Mehr', align: 'end',
        items: [
          // The heading already says «export», so the items name only the format
          // and stay on one line inside the popup.
          // No icons: the same download arrow on every row of a menu whose
          // heading already says «Exportieren» distinguishes nothing, and the
          // portal's other export menu (ui/charts.js) lists its formats plain.
          { heading: 'Exportieren' },
          { action: 'csv', label: 'Als CSV' },
          { action: 'xls', label: 'Für Excel' },
        ],
      }),
      onAction: (action, { filtered }) => exportFields(action, filtered, table, composite),
    });
  }).filter(Boolean);
  return () => disposers.forEach((dispose) => dispose());
}

// Export the CURRENT result set, built from the data rather than the rendered
// page. js/export.js already owns delimiter, BOM and formula neutralisation.
async function exportFields(action, fields, table, composite) {
  if (action !== 'csv' && action !== 'xls') return;
  const { download, fileSlug, rowsToCsv } = await import('../export.js');
  const rows = [
    FIELD_COLUMNS.map((c) => c.label),
    ...fields.map((f) => [f.name, f.description || '', f.dataType || '', fieldConstraintText(f, composite), f.comment || '']),
  ];
  const name = `${fileSlug(`datenfelder-${table.name}`)}`;
  if (action === 'csv') return download(rowsToCsv(rows), `${name}.csv`, 'text/csv;charset=utf-8');
  // The Excel path in export.js takes a rendered table, so build the same
  // minimal one from the exported rows instead of the paginated DOM.
  const html = `<table>${rows.map((r, i) => `<tr>${r.map((cell) =>
    `<${i ? 'td' : 'th'}>${String(cell).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table>`;
  const host = document.createElement('div');
  host.innerHTML = html;
  const { tableToXls } = await import('../export.js');
  download(tableToXls(host.firstChild, `Datenfelder ${table.name}`), `${name}.xls`, 'application/vnd.ms-excel');
}

function crumbs() {
  return [
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Datenbezug und API Verzeichnis', href: '#/data/catalog' },
  ];
}

function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }

// Preview image: the supplied local file (`image`). The former Unsplash-photo
// fallback was removed after the image review (2026-08-04); all 19 illustrated
// datasets carry `image`.
function preview(C, d) {
  return safeResourceUrl(d.image);
}

function formats(d) { return uniq((d.distributions || []).map(x => x['dateiformat'] || x.format)); }

function classificationLabel(core, key) { return core.label(`enum.classification.${key}`, key); }

// Higher protection level means more prominent emphasis.
function classificationVariant(key) {
  return { public: 'success', internal: 'info', confidential: 'warning', secret: 'error' }[key] || 'gray';
}

function tagLabel(core, key) { return core.label(`tag.${key}`, key); }

// The row is already labelled «Lizenz»; the value states only its condition.
function licenceLabel(key) {
  return { terms_by: 'Namensnennung', terms_by_ask: 'Namensnennung / Bewilligung',
    terms_open: 'Frei verwendbar', terms_ask: 'Bewilligung erforderlich' }[key] || key || '';
}

export default catalog;
