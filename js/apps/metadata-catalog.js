import { APPLICATIONS, trail } from '../crumbs.js';
import { formatNumber, formatDate } from '../format.js';
// Data-governance catalogue for the real-estate domain.
// It connects technology-neutral business-object attributes to system-bound
// table fields, then to published datasets. Mappings live on attributes and
// core provides the reverse field-to-term index. State remains in the hash so
// every selection is shareable. List and detail anatomy matches the other portal
// catalogues and inventory explorer.
import * as links from '../links.js';
// Reuse one module-level escape helper and badge factory across all views.
import { escape as esc, badge } from '../components.js';

// contacts supplies stewardship for both layers. Load the large datasets
// inventory only for a system-table detail that needs its title.
export const needs = ['businessObjects', 'systemTables', 'contacts'];

const BASE = '#/app/metadata-catalog';
// The catalogue covers the real-estate domain, not the complete office. Keep
// its single title source for document title, breadcrumb, heading, and back links.
const TITLE = 'Metadaten Katalog Bauten';
const PER_PAGE = 12;

// Type labels describe storage forms, so keep them here rather than in the domain code lists.
const TABLE_TYPE = {
  table: 'Tabelle', view: 'Sicht', gis_layer: 'GIS-Layer',
  bim_model: 'BIM-Modell', file: 'Datei', api_resource: 'API-Ressource',
};
const SCHEMA_TYPE = {
  database_schema: 'Datenbankschema', gis_workspace: 'GIS-Workspace',
  file_folder: 'Ablagestruktur', bim_project: 'BIM-Projekt', api_namespace: 'API-Namensraum',
};
const VALUE_TYPE = {
  text: 'Text', integer: 'Ganzzahl', float: 'Dezimalzahl', boolean: 'Ja/Nein',
  date: 'Datum', uri: 'URI', code: 'Codeliste',
};
const KEY_ROLE = { PK: 'Primärschlüssel', FK: 'Fremdschlüssel', UK: 'Eindeutig' };

// Truncate sentence-length definitions in table cells; detail views retain the full text.
const truncateText = (s, n = 110) => {
  const t = String(s || '').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 20)).trimEnd() + '…';
};

export default async function render(ctx) {
  // Keep ?id and ?table detail links instead of route segments to preserve
  // already shared inventory-style URLs.
  const objectId = ctx.query.get('id');
  const tableId = ctx.query.get('table');
  if (objectId) return objectDetail(ctx, objectId);
  if (tableId) return tableDetail(ctx, tableId);
  return list(ctx);
}

// Shared lookups.
const refList = (core, key) => core.ref()[key] || [];
const domainOf = (core, key) => core.dataDomains().find((d) => d.key === key) || {};
const domainLabel = (core, key) => domainOf(core, key).label || key;
const statusOf = (core, id) => refList(core, 'objectStatuses').find((s) => s.id === id) || { label: id, variant: 'gray' };
const matchOf = (core, id) => refList(core, 'mappingMatches').find((m) => m.id === id) || { label: id, variant: 'gray' };
// Return a source URL's hostname, or the original malformed value so bad raw data remains visible.
const hostOf = (url) => { try { return new URL(url).host; } catch { return String(url || ''); } };
// Store explicit tree expansion choices at module scope because hash changes
// rebuild the page but not the module. Without a choice, open the active branch.
const OPEN = new Map();
const isOpen = (key, fallback) => (OPEN.has(key) ? OPEN.get(key) : fallback);

// Put exact/near/partial explanations on each value instead of a distant shared legend.
const MATCH_HINT = {
  exact: 'Exakt — Feldinhalt und Begriff sind deckungsgleich.',
  close: 'Nahe — inhaltlich dasselbe, aber mit abweichender Kodierung oder Einheit.',
  partial: 'Teilweise — das Feld deckt nur einen Teil des Begriffs ab.',
};

// Build the shared match-quality badge once for both detail views.
const matchBadge = (core, id) => {
  const m = matchOf(core, id);
  return `<span title="${esc(MATCH_HINT[id] || m.label)}">${badge(m.label, m.variant, 'sm')}</span>`;
};

// Responsible people are individual AdminDir entries. The generic stewardship
// mailbox remains a separate contact card shared by both detail views.
const personsSection = (persons) => `
    <h2 class="detail-section__title">Verantwortliche Personen</h2>
    <div class="box">${persons && persons.length ? `<dl class="kv kv--ruled">${persons.map((p) => `
      <dt>${esc(p.role)}</dt>
      <dd><a href="https://admindir.verzeichnisse.admin.ch/person/${encodeURIComponent(p.admindirId)}"
           target="_blank" rel="noopener external">AdminDir ${esc(p.admindirId)}</a></dd>`).join('')}
    </dl>` : '<p class="muted m-0">Für diesen Eintrag ist keine verantwortliche Person hinterlegt.</p>'}</div>`;

const objectHref = (id) => `${BASE}?id=${encodeURIComponent(id)}`;
const tableHref = (id) => `${BASE}?table=${encodeURIComponent(id)}`;

// Inventory view.
function list(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  setTitle(TITLE);
  setCrumbs(trail(APPLICATIONS, { label: TITLE }));

  const objects = core.businessObjects();
  const tables = core.systemTables();
  const domains = core.dataDomains();

  // State from the hash.
  const kind = query.get('kind') === 'tabellen' ? 'tabellen' : 'objekte';
  const rawQ = query.get('q') || '';
  const q = rawQ.toLowerCase();
  const multi = (param, valid) => (query.get(param) || '').split(',').map((s) => s.trim()).filter((x) => valid.includes(x));
  const selDomains = multi('domain', domains.map((d) => d.key));
  const selSystems = multi('system', [...new Set(tables.map((t) => t.system))]);
  const selSchemas = multi('schema', [...new Set(tables.map((t) => t.schema))]);
  const selStatus = multi('status', refList(core, 'objectStatuses').map((s) => s.id));
  const mapped = ['ja', 'nein'].includes(query.get('mapped')) ? query.get('mapped') : '';
  const view = query.get('view') === 'gallery' ? 'gallery' : 'list';
  const wantedPage = Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1);

  // Per-entry metrics.
  const mapCount = (o) => core.realisationsOf(o).length;
  const realCount = (t) => core.realisationsForTable(t.tableId).length;

  const SORTS = kind === 'objekte'
    ? [
      { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
      { value: 'domain', label: 'Domäne', cmp: (a, b) => domainLabel(core, a.domain).localeCompare(domainLabel(core, b.domain), 'de') || a.name.localeCompare(b.name, 'de') },
      { value: 'attrs', label: 'Attribute (meiste zuerst)', cmp: (a, b) => b.attributes.length - a.attributes.length },
      { value: 'maps', label: 'Realisierungen (meiste zuerst)', cmp: (a, b) => mapCount(b) - mapCount(a) },
    ]
    : [
      { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.displayName.localeCompare(b.displayName, 'de') },
      { value: 'system', label: 'System', cmp: (a, b) => a.systemName.localeCompare(b.systemName, 'de') || a.name.localeCompare(b.name, 'de') },
      { value: 'fields', label: 'Felder (meiste zuerst)', cmp: (a, b) => b.fields.length - a.fields.length },
      { value: 'real', label: 'Realisierte Geschäftsobjekte (meiste zuerst)', cmp: (a, b) => realCount(b) - realCount(a) },
    ];
  const sortKey = SORTS.some((s) => s.value === query.get('sort')) ? query.get('sort') : '';

  // Filtering.
  const objMatches = (o) => {
    const hay = `${o.name} ${o.definition} ${o.comment} ${o.attributes.map((a) => a.name).join(' ')}`.toLowerCase();
    return (!q || hay.includes(q))
      && (!selDomains.length || selDomains.includes(o.domain))
      && (!selStatus.length || selStatus.includes(o.status))
      && (!mapped || (mapped === 'ja' ? mapCount(o) > 0 : mapCount(o) === 0));
  };
  const tblMatches = (t) => {
    const hay = `${t.name} ${t.displayName} ${t.description} ${t.schema} ${t.systemName} ${t.fields.map((f) => f.name).join(' ')}`.toLowerCase();
    return (!q || hay.includes(q))
      && (!selSystems.length || selSystems.includes(t.system))
      && (!selSchemas.length || selSchemas.includes(t.schema))
      && (!mapped || (mapped === 'ja' ? realCount(t) > 0 : realCount(t) === 0));
  };

  const all = kind === 'objekte' ? objects : tables;
  const filtered = all.filter(kind === 'objekte' ? objMatches : tblMatches);
  const sortDef = SORTS.find((s) => s.value === sortKey);
  const sorted = sortDef ? filtered.slice().sort(sortDef.cmp) : filtered.slice().sort(SORTS[0].cmp);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const page = Math.min(wantedPage, totalPages);
  const visible = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Hash construction. Omit kind for the default business-object view.
  const base = {
    kind: kind === 'objekte' ? '' : kind, q: rawQ, sort: sortKey, view,
    domain: selDomains, system: selSystems, schema: selSchemas, status: selStatus, mapped,
  };
  const hash = (patch = {}) => C.catalogueHash(BASE, { ...base, ...patch, defaultView: 'list' });
  // Switching views drops filters owned exclusively by the other view.
  const kindHref = (k) => C.catalogueHash(BASE, {
    kind: k === 'objekte' ? '' : k, q: rawQ, view, defaultView: 'list',
  });

  // Active filter pills.
  const active = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hash({ q: '' }) }] : []),
    ...selDomains.map((x) => ({ label: domainLabel(core, x), href: hash({ domain: selDomains.filter((y) => y !== x) }) })),
    ...selSystems.map((x) => ({ label: (tables.find((t) => t.system === x) || {}).systemName || x, href: hash({ system: selSystems.filter((y) => y !== x) }) })),
    ...selSchemas.map((x) => ({ label: `Schema ${x}`, href: hash({ schema: selSchemas.filter((y) => y !== x) }) })),
    ...selStatus.map((x) => ({ label: statusOf(core, x).label, href: hash({ status: selStatus.filter((y) => y !== x) }) })),
    ...(mapped ? [{ label: mapped === 'ja' ? 'Mit Realisierung' : 'Ohne Realisierung', href: hash({ mapped: '' }) }] : []),
  ];

  // Cards and lists. Without imagery, list view leads; gallery uses the
  // ordinary image-free CD card instead of the inventory media card.
  const objCard = (o) => {
    const n = mapCount(o);
    return C.card({
      title: o.name,
      desc: o.definition,
      href: objectHref(o.objectId),
      badges: [
        C.badge(domainLabel(core, o.domain), 'blue'),
        C.badge(statusOf(core, o.status).label, statusOf(core, o.status).variant),
        ...(n ? [] : [C.badge('Ohne Realisierung', 'gray')]),
      ],
      footerInfo: `${o.attributes.length} Attribute · ${n} Realisierung${n === 1 ? '' : 'en'}`,
      footerAction: C.cardAction(),
    });
  };
  const tblCard = (t) => C.card({
    title: t.displayName,
    desc: t.description,
    href: tableHref(t.tableId),
    badges: [
      C.badge(t.systemName, 'blue'),
      C.badge(TABLE_TYPE[t.type] || t.type, 'gray'),
      ...(t.certified ? [C.badge('Zertifiziert', 'success')] : []),
    ],
    footerInfo: `${t.fields.length} Felder${t.rowCount ? ` · ${formatNumber(t.rowCount)} Zeilen` : ''}`,
    footerAction: C.cardAction(),
  });

  // Column widths preserve discoverability and comparison. Domain, system,
  // and status use badges because they repeat the same finite filter categories.
  const objList = (rows) => C.table({
    caption: 'Geschäftsobjekte', zebra: true, rowsClickable: true,
    columns: [
      { key: 'name', label: 'Geschäftsobjekt', width: '13rem', render: (o) =>
        `<a href="${objectHref(o.objectId)}">${esc(o.name)}</a>` },
      { key: 'domain', label: 'Domäne', width: '12rem', render: (o) => C.badge(domainLabel(core, o.domain), 'blue') },
      { key: 'definition', label: 'Beschreibung', render: (o) => esc(truncateText(o.definition, 130)) },
      { key: 'attrs', label: 'Attribute', align: 'right', render: (o) => String(o.attributes.length) },
      { key: 'status', label: 'Status', width: '9rem', render: (o) => C.badge(statusOf(core, o.status).label, statusOf(core, o.status).variant) },
    ],
    rows,
  });
  const tblList = (rows) => C.table({
    caption: 'Systemtabellen', zebra: true, rowsClickable: true,
    columns: [
      { key: 'name', label: 'Tabelle', width: '13rem', render: (t) =>
        `<a href="${tableHref(t.tableId)}">${esc(t.displayName)}</a><br><span class="small muted"><code>${esc(t.name)}</code></span>` },
      { key: 'system', label: 'System', width: '10rem', render: (t) => C.badge(t.systemName, 'blue') },
      { key: 'description', label: 'Beschreibung', render: (t) => esc(truncateText(t.description, 130)) },
      { key: 'fields', label: 'Felder', align: 'right', render: (t) => String(t.fields.length) },
      // System-table status means certification, its only lifecycle value;
      // type and dataset count remain in detail where they aid comparison less.
      { key: 'certified', label: 'Status', width: '9rem', render: (t) =>
        C.badge(t.certified ? 'Zertifiziert' : 'Nicht zertifiziert', t.certified ? 'success' : 'gray') },
    ],
    rows,
  });

  // Filter panel.
  const panel = kind === 'objekte' ? `
      ${C.filterGroup({ dim: 'domain', legend: 'Domäne', selected: selDomains, idPrefix: 'mc',
        options: domains.map((d) => ({ value: d.key, label: d.label })) })}
      ${C.filterGroup({ dim: 'status', legend: 'Status', selected: selStatus, idPrefix: 'mc',
        options: refList(core, 'objectStatuses').map((s) => ({ value: s.id, label: s.label })) })}
      ${C.filterGroup({ dim: 'mapped', legend: 'Realisierung', selected: mapped ? [mapped] : [], idPrefix: 'mc',
        options: [{ value: 'ja', label: 'In einem System realisiert' }, { value: 'nein', label: 'In keinem System realisiert' }] })}
      ${C.panelReset({ href: hash({ domain: [], status: [], mapped: '' }) })}`
    : `
      ${C.filterGroup({ dim: 'system', legend: 'System', selected: selSystems, idPrefix: 'mc',
        options: [...new Map(tables.map((t) => [t.system, t.systemName])).entries()].map(([v, l]) => ({ value: v, label: l })) })}
      ${C.filterGroup({ dim: 'schema', legend: 'Schema', selected: selSchemas, idPrefix: 'mc',
        options: [...new Map(tables.map((t) => [t.schema, t.schemaLabel])).entries()].map(([v, l]) => ({ value: v, label: l })) })}
      ${C.filterGroup({ dim: 'mapped', legend: 'Realisierung', selected: mapped ? [mapped] : [], idPrefix: 'mc',
        options: [{ value: 'ja', label: 'Realisiert Geschäftsobjekte' }, { value: 'nein', label: 'Realisiert keine Geschäftsobjekte' }] })}
      ${C.panelReset({ href: hash({ system: [], schema: [], mapped: '' }) })}`;

  const filterCount = kind === 'objekte'
    ? selDomains.length + selStatus.length + (mapped ? 1 : 0)
    : selSystems.length + selSchemas.length + (mapped ? 1 : 0);

  // Keep nominative and dative German UI count forms separately so result
  // summaries and empty states use the correct grammar.
  const unit = kind === 'objekte'
    ? { nom: 'Geschäftsobjekte', dat: 'Geschäftsobjekten' }
    : { nom: 'Systemtabellen', dat: 'Systemtabellen' };

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: TITLE,
      lead: 'Fachbegriffe des BBL und ihre Realisierung in den Führungssystemen — welches Geschäftsobjekt welche Attribute hat, und welches Feld welcher Tabelle sie trägt.',
    })}
    ${C.catalogueBar({
      formId: 'mc-search', inputId: 'mc-q',
      searchLabel: kind === 'objekte' ? 'Geschäftsobjekt oder Attribut suchen' : 'Tabelle oder Feld suchen',
      placeholder: kind === 'objekte' ? 'Geschäftsobjekt oder Attribut suchen…' : 'Tabelle oder Feld suchen…',
      q: rawQ, countId: 'mc-count',
      count: `<strong>${sorted.length}</strong> von ${all.length} ${esc(unit.dat)}${totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : ''}`,
      sort: { id: 'mc-sort', value: sortKey, options: SORTS.map((s) => ({ value: s.value, label: s.label })) },
      filterId: 'mc-filter', filterLabel: 'Filter', filterCount,
      panelId: 'mc-filters', panel,
      view, views: [['list', 'Listenansicht', 'List'], ['gallery', 'Galerieansicht', 'Apps']],
    })}
    ${C.activeFilters({ filters: active, resetHref: BASE })}
    <div class="pf-layout">
      <aside class="pf-sidebar" aria-label="Domänen und Systeme">
        <div class="pf-sidebar__head"><h2 class="pf-sidebar__title">Katalog</h2></div>
        ${treeHTML()}
      </aside>
      <div class="pf-main">
        ${C.catalogueResults({
          resetHref: BASE, visible, count: sorted.length,
          view, page, totalPages,
          card: kind === 'objekte' ? objCard : tblCard,
          listView: kind === 'objekte' ? objList : tblList,
          unit, gridCls: 'grid grid--responsive-cols-2',
          regionLabel: kind === 'objekte' ? 'Geschäftsobjekte' : 'Systemtabellen',
          paginationInputId: 'mc-page', paginationLabel: `Seitennavigation ${unit.nom}`,
          paginationHref: (p) => hash({ page: p }),
          available: core.available(kind === 'objekte' ? 'businessObjects' : 'systemTables'),
        })}
      </div>
    </div>
  </div>`;

  C.announceCatalogue({ count: sorted.length, total: all.length, unit, page, totalPages, view });
  C.wireCatalogue(mount, {
    formId: 'mc-search', inputId: 'mc-q', pageInputId: 'mc-page', page, totalPages, hash,
    sortId: 'mc-sort', filterToggleId: 'mc-filter', panelId: 'mc-filters',
  });
  ctx.onUnmount(C.wireTableRows(mount));

  // A tree branch navigates and opens from another branch, or toggles in place.
  // Its listener dies with the sidebar on the next render.
  mount.querySelector('.pf-sidebar').addEventListener('click', (e) => {
    const btn = e.target.closest('.pf-tree__node[data-branch]');
    if (!btn) return;
    if (location.hash !== btn.dataset.href) {
      OPEN.set(btn.dataset.branch, true);
      location.hash = btn.dataset.href;
      return;
    }
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    const list = mount.querySelector(`#${btn.getAttribute('aria-controls')}`);
    if (list) list.hidden = open;
    OPEN.set(btn.dataset.branch, !open);
  });

  // Page tree. Branches are filter links with toggles; leaves are links. Plain
  // indentation communicates the two levels without icons.
  function treeHTML() {
    const row = (label, count) =>
      `<span class="pf-tree__label">${esc(label)}</span><span class="pf-tree__n">${count}</span>`;
    // plain-link opts navigation out of the high-specificity content-link underline.
    const leaf = (label, count, href, on) =>
      `<li class="pf-tree__item"><a class="pf-tree__leaf plain-link interactive-control${on ? ' is-active' : ''}" href="${href}"${
        on ? ' aria-current="true"' : ''}>${row(label, count)}</a></li>`;
    // A branch itself represents all items in that branch. It navigates and opens
    // from elsewhere, then toggles when already active, avoiding a duplicate all row.
    const branch = (key, label, count, href, on, open, children) => `
      <li class="pf-tree__item">
        <button type="button" class="pf-tree__node interactive-control${on ? ' is-active' : ''}" data-branch="${key}"
          data-href="${esc(href)}" aria-expanded="${open}" aria-controls="mc-branch-${key}">
          ${C.icon('ChevronRight', 'pf-tree__chev')}${row(label, count)}</button>
        <ul class="pf-tree__children" id="mc-branch-${key}"${open ? '' : ' hidden'}>${children}</ul>
      </li>`;

    const domCount = {};
    for (const o of objects) domCount[o.domain] = (domCount[o.domain] || 0) + 1;

    const domainItems = domains.map((d) => leaf(
      d.label, domCount[d.key] || 0,
      C.catalogueHash(BASE, { domain: [d.key], view, defaultView: 'list' }),
      kind === 'objekte' && selDomains.length === 1 && selDomains[0] === d.key,
    )).join('');

    // Keep exactly root and filter-value levels. A third system/schema level
    // would exceed the tree's one-step leaf indentation; schemas stay in the panel.
    const bySystem = new Map();
    for (const t of tables) {
      if (!bySystem.has(t.system)) bySystem.set(t.system, { name: t.systemName, n: 0 });
      bySystem.get(t.system).n++;
    }
    const systemItems = [...bySystem.entries()].map(([key, s]) => leaf(
      s.name, s.n,
      C.catalogueHash(BASE, { kind: 'tabellen', system: [key], view, defaultView: 'list' }),
      kind === 'tabellen' && selSystems.length === 1 && selSystems[0] === key,
    )).join('');

    // Always open a branch containing the active filter. Otherwise respect the
    // explicit choice, defaulting to the active business-object branch.
    return `<ul class="pf-tree pf-tree--plain">
      ${branch('objects', 'Geschäftsobjekte', objects.length, kindHref('objekte'),
        kind === 'objekte' && !selDomains.length,
        selDomains.length ? true : isOpen('objects', kind === 'objekte'), domainItems)}
      ${branch('systems', 'Systeme', tables.length, kindHref('tabellen'),
        kind === 'tabellen' && !selSystems.length,
        selSystems.length ? true : isOpen('systems', kind === 'tabellen'), systemItems)}
    </ul>`;
  }
}

// Business-object detail.
function objectDetail(ctx, id) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  // URLSearchParams decodes query values exactly once.
  const o = core.businessObject(id);
  if (!o) {
    return C.renderNotFound(ctx, {
      thing: 'Dieses Geschäftsobjekt', title: 'Geschäftsobjekt nicht gefunden',
      backHref: BASE, backLabel: TITLE,
      crumbs: trail(APPLICATIONS, { label: TITLE, href: BASE }),
    });
  }
  setTitle(o.name);
  setCrumbs(trail(APPLICATIONS, { label: TITLE, href: BASE }, { label: o.name }));

  const st = statusOf(core, o.status);
  const maps = core.realisationsOf(o);
  const contact = core.contacts().find((c) => c.contactId === o.steward);

  // Match inventory-detail tabs. Overview locates the concept in systems while
  // the adjacent attribute tab contains the long searchable table.
  const tabByLegacyValue = { 'uebersicht': 'overview', 'attribute': 'attributes', 'realisierung': 'realisations' };
  const legacyValueByTab = Object.fromEntries(Object.entries(tabByLegacyValue).map(([legacy, tab]) => [tab, legacy]));
  const tabs = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'attributes', label: `Attribute (${o.attributes.length})` },
    { id: 'realisations', label: `Realisierung (${maps.length})` },
  ];
  // Persist ?tab in the URL. Unknown values fall back to overview; replaceState
  // avoids a router redraw or focus reset for an in-place tab change.
  let active = tabByLegacyValue[query.get('tab')] || tabs[0].id;
  if (!tabs.some((x) => x.id === active)) active = tabs[0].id;
  const syncHash = (tab) => {
    const p = new URLSearchParams({ id: o.objectId });
    if (tab !== tabs[0].id) p.set('tab', legacyValueByTab[tab]);
    history.replaceState(history.state, '', `${BASE}?${p}`);
  };
  // Overview leads with definition, scope, and common names before long tables.
  const panelHtml = (id) => {
    if (id === 'attributes') return '<div id="mc-attrs"></div>';
    // Mount an empty data table with headers when no mapping exists so users can
    // see what information would appear and why rows are absent.
    if (id === 'realisations') return '<div id="mc-maps"></div>';
    // Follow dataset-detail anatomy: lead definition, responsible people, and
    // metadata lists, with the generic contact card in the side column. Tab labels
    // already carry attribute and realisation counts.
    return `<div class="detail-layout"><div>${personsSection(o.responsiblePersons)}
      <section class="detail-section">
        <h2 class="detail-section__title">Metadaten</h2>
        <dl class="kv kv--ruled">
          <dt>Datendomäne</dt><dd><a href="${C.catalogueHash(BASE, { domain: [o.domain] })}">${esc(domainLabel(core, o.domain))}</a></dd>
          ${/* Show the shared object lifecycle consistently with other catalogues. */''}
          <dt>Status</dt><dd>${C.badge(st.label, st.variant)}${st.definition
            ? `<br><span class="small muted">${esc(st.definition)} — ${esc(st.consequence)}</span>` : ''}</dd>
          ${o.standardRef ? `<dt>Norm-Referenz</dt><dd>${esc(o.standardRef)}</dd>` : ''}
          ${/* Scope, alternate names, and identifier relevance belong in metadata. */''}
          ${o.comment ? `<dt>Bemerkung</dt><dd>${esc(o.comment)}</dd>` : ''}
          ${o.updated ? `<dt>Stand</dt><dd>${esc(formatDate(o.updated))}</dd>` : ''}
          <dt>ID</dt><dd><code>${esc(o.objectId)}</code></dd>
        </dl>
      </section></div>
      <aside class="detail-layout__aside" aria-label="Kontakt">
        ${C.contactBox(contact, { title: 'Kontakt', heading: 'h2' })}
      </aside></div>`;
  };

  mount.innerHTML = `
  <div class="container section">
    ${/* Use the application detail header instead of a landing-page hero. */''}
    ${C.detailBar({ backHref: BASE, backLabel: TITLE })}
    <h1 tabindex="-1">${esc(o.name)}</h1>
    ${/* The concept definition is the lead rather than a separate repeated section. */''}
    ${o.definition ? `<p class="lead">${esc(o.definition)}</p>` : ''}

    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active, idPrefix: 'mc-tab', ariaLabel: 'Geschäftsobjekt' })}
      ${C.tabPanels({ items: tabs, active, idPrefix: 'mc-tab', render: panelHtml, heading: true })}
    </div>
  </div>`;

  C.wireTabs(mount, { syncHash });

  // Use the searchable, sortable, paginated data table for potentially long attribute lists.
  ctx.onUnmount(C.mountDataTable(mount.querySelector('#mc-attrs'), {
    id: 'mc-at', unit: { nom: 'Attribute', dat: 'Attributen' }, caption: `Attribute von ${o.name}`, perPage: 15,
    rows: o.attributes,
    searchKeys: ['name', 'definition'],
    sorts: [
      { value: 'ord', label: 'Reihenfolge', cmp: () => 0 },
      { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
    ],
    facets: [
      { dim: 'keyRole', legend: 'Schlüsselrolle',
        options: Object.entries(KEY_ROLE).map(([v, l]) => ({ value: v, label: l })),
        match: (r, vals) => vals.includes(r.keyRole) },
      { dim: 'required', legend: 'Pflichtangabe',
        options: [{ value: 'ja', label: 'Pflicht' }, { value: 'nein', label: 'Optional' }],
        match: (r, vals) => vals.includes(r.required ? 'ja' : 'nein') },
    ],
    // Keep one value per column. The separate mapping section owns system,
    // table, field, and quality details, avoiding compressed duplication here.
    columns: [
      { key: 'name', label: 'Attribut', width: '14rem', render: (a) =>
        `<strong>${esc(a.name)}</strong>${a.required ? '' : ' <span class="small muted">optional</span>'}` },
      { key: 'definition', label: 'Beschreibung', render: (a) =>
        a.definition ? esc(a.definition) : '<span class="muted">—</span>' },
      { key: 'type', label: 'Werttyp', width: '8rem', render: (a) => esc(VALUE_TYPE[a.type] || a.type) },
      { key: 'keyRole', label: 'Schlüssel', width: '6rem', render: (a) =>
        a.keyRole ? C.badge(a.keyRole, a.keyRole === 'PK' ? 'info' : 'gray', 'sm') : '<span class="muted">—</span>' },
    ],
  }));

  ctx.onUnmount(C.mountDataTable(mount.querySelector('#mc-maps'), {
    id: 'mc-mp', unit: 'Realisierungen', caption: `Realisierungen von ${o.name}`, perPage: 15,
    emptyMsg: 'Für dieses Geschäftsobjekt ist keine Realisierung erfasst — entweder führt es kein angeschlossenes System, oder die Abbildung ist noch nicht dokumentiert.',
    rows: maps.map((m) => {
      const t = core.systemTable(m.tableId) || {};
      return { ...m, systemName: t.systemName || '', tableName: t.displayName || m.tableId, technical: t.name || '' };
    }),
    searchKeys: ['attribute', 'field', 'tableName', 'systemName'],
    sorts: [
      { value: 'attr', label: 'Attribut (A–Z)', cmp: (a, b) => a.attribute.localeCompare(b.attribute, 'de') },
      { value: 'sys', label: 'System', cmp: (a, b) => a.systemName.localeCompare(b.systemName, 'de') },
    ],
    columns: [
      { key: 'attribute', label: 'Attribut', render: (m) => esc(m.attribute) },
      { key: 'systemName', label: 'System', render: (m) => esc(m.systemName) },
      { key: 'tableName', label: 'Tabelle', render: (m) =>
        `<a href="${tableHref(m.tableId)}">${esc(m.tableName)}</a><br><span class="small muted"><code>${esc(m.technical)}</code></span>` },
      { key: 'field', label: 'Feld', render: (m) => `<code>${esc(m.field)}</code>` },
      { key: 'match', label: 'Güte', render: (m) => matchBadge(core, m.match) },
    ],
  }));
}

// System-table detail.
async function tableDetail(ctx, id) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  // URLSearchParams decodes query values exactly once.
  const t = core.systemTable(id);
  if (!t) {
    return C.renderNotFound(ctx, {
      thing: 'Diese Tabelle', title: 'Tabelle nicht gefunden',
      backHref: BASE, backLabel: TITLE,
      crumbs: trail(APPLICATIONS, { label: TITLE, href: BASE }),
    });
  }
  // Fetch the large published-dataset inventory only here. Check ctx.stale after
  // awaiting so intervening navigation is never overwritten.
  if (t.datasetId) {
    await core.ensure('datasets');
    if (ctx.stale()) return;
  }
  setTitle(t.displayName);
  setCrumbs(trail(APPLICATIONS, { label: TITLE, href: BASE }, { label: t.displayName }));

  const real = core.realisationsForTable(t.tableId);
  const contact = core.contacts().find((c) => c.contactId === t.steward);
  const dataset = t.datasetId ? core.dataset(t.datasetId) : null;
  // Mirror business-object detail with overview, people, metadata, and two data tabs.
  const tabByLegacyValue = { 'uebersicht': 'overview', 'felder': 'fields', 'realisierung': 'realisations' };
  const legacyValueByTab = Object.fromEntries(Object.entries(tabByLegacyValue).map(([legacy, tab]) => [tab, legacy]));
  const tabs = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'fields', label: `Felder (${t.fields.length})` },
    { id: 'realisations', label: `Realisierung (${real.length})` },
  ];
  // Persist ?tab as above; replaceState reflects an in-place tab change.
  let active = tabByLegacyValue[query.get('tab')] || tabs[0].id;
  if (!tabs.some((x) => x.id === active)) active = tabs[0].id;
  const syncHash = (tab) => {
    const p = new URLSearchParams({ table: t.tableId });
    if (tab !== tabs[0].id) p.set('tab', legacyValueByTab[tab]);
    history.replaceState(history.state, '', `${BASE}?${p}`);
  };
  const panelHtml = (id) => {
    if (id === 'fields') return '<div id="mc-fields"></div>';
    // As above, retain table headers when there are no rows.
    if (id === 'realisations') return '<div id="mc-real"></div>';
    // Mirror the business-object overview and avoid duplicating counts from tab labels.
    return `<div class="detail-layout"><div>${personsSection(t.responsiblePersons)}
      <section class="detail-section">
        <h2 class="detail-section__title">Metadaten</h2>
        <dl class="kv kv--ruled">
          <dt>System</dt><dd>${esc(t.systemName)}</dd>
          <dt>Schema</dt><dd>${esc(t.schemaLabel)}<br><span class="small muted"><code>${esc(t.schema)}</code> · ${esc(SCHEMA_TYPE[t.schemaType] || t.schemaType)}</span></dd>
          <dt>Technischer Name</dt><dd><code>${esc(t.name)}</code></dd>
          <dt>Art</dt><dd>${esc(TABLE_TYPE[t.type] || t.type)}</dd>
          ${/* Certification and row count stay in metadata by explicit product decision. */''}
          ${/* Keep the DCAT bridge in metadata rather than a separate access box. */''}
          ${dataset ? `<dt>Publiziert als</dt><dd><a href="${esc(links.dataset(dataset.id))}">${esc(core.t(dataset.title))}</a></dd>` : ''}
          ${/* External source links carry target and rel and display their hostname. */''}
          ${t.sourceUrl ? `<dt>Quellsystem</dt><dd><a href="${esc(t.sourceUrl)}" target="_blank" rel="noopener external">${esc(hostOf(t.sourceUrl))}</a></dd>` : ''}
          ${t.updated ? `<dt>Stand</dt><dd>${esc(formatDate(t.updated))}</dd>` : ''}
          <dt>ID</dt><dd><code>${esc(t.tableId)}</code></dd>
        </dl>
      </section></div>
      <aside class="detail-layout__aside" aria-label="Zugriff und Kontakt">
        ${/* Put access first in this table-only side column. */''}
        ${dataset ? `<div class="box">
          <h2>Zugriff</h2>
          <p class="small muted">Bezug und Bereitstellungsformen stehen beim publizierten Datensatz im Datenbezug und API Verzeichnis.</p>
          <a class="btn btn--outline btn--sm btn--icon-left" href="${esc(links.dataset(dataset.id))}">
            ${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Datensatz ansehen</span></a>
        </div>` : ''}
        ${C.contactBox(contact, { title: 'Kontakt', heading: 'h2' })}
      </aside></div>`;
  };

  mount.innerHTML = `
  <div class="container section">
    ${/* Use the application detail header instead of a landing-page hero. */''}
    ${C.detailBar({
      backHref: C.catalogueHash(BASE, { kind: 'tabellen', system: [t.system] }),
      backLabel: t.systemName,
    })}
    <h1 tabindex="-1">${esc(t.displayName)}</h1>
    ${t.description ? `<p class="lead">${esc(t.description)}</p>` : ''}

    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active, idPrefix: 'mc-ttab', ariaLabel: 'Systemtabelle' })}
      ${C.tabPanels({ items: tabs, active, idPrefix: 'mc-ttab', render: panelHtml, heading: true })}
    </div>
  </div>`;

  C.wireTabs(mount, { syncHash });

  ctx.onUnmount(C.mountDataTable(mount.querySelector('#mc-fields'), {
    id: 'mc-fl', unit: { nom: 'Felder', dat: 'Feldern' }, caption: `Felder von ${t.name}`, perPage: 15,
    rows: t.fields.map((f) => ({ ...f, real: core.realisedBy(t.tableId, f.name) })),
    searchKeys: ['name', 'description', 'dataType'],
    sorts: [
      { value: 'ord', label: 'Reihenfolge im System', cmp: () => 0 },
      { value: 'name', label: 'Feldname (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
      { value: 'real', label: 'Realisierte Geschäftsobjekte zuerst', cmp: (a, b) => b.real.length - a.real.length },
    ],
    facets: [
      { dim: 'key', legend: 'Schlüssel',
        options: [{ value: 'pk', label: 'Primärschlüssel' }, { value: 'fk', label: 'Fremdschlüssel' }],
        match: (r, vals) => (vals.includes('pk') && r.primaryKey) || (vals.includes('fk') && r.foreignKey) },
      { dim: 'katalog', legend: 'Katalog',
        options: [{ value: 'ja', label: 'Trägt einen Begriff' }, { value: 'nein', label: 'Ohne Begriff' }],
        match: (r, vals) => vals.includes(r.real.length ? 'ja' : 'nein') },
    ],
    columns: [
      // Keep one value per column, with description in its own column.
      { key: 'name', label: 'Feld', width: '13rem', render: (f) => `<code>${esc(f.name)}</code>` },
      { key: 'description', label: 'Beschreibung', render: (f) =>
        f.description ? esc(truncateText(f.description, 120)) : '<span class="muted">—</span>' },
      { key: 'dataType', label: 'Datentyp', width: '9rem', render: (f) => `<code class="small">${esc(f.dataType)}</code>` },
      { key: 'key', label: 'Schlüssel', width: '7rem', render: (f) =>
        [f.primaryKey ? C.badge('PK', 'info', 'sm') : '', f.foreignKey ? C.badge('FK', 'gray', 'sm') : ''].filter(Boolean).join(' ')
        || (f.nullable ? '<span class="muted">optional</span>' : '<span class="muted">—</span>') },
      // Show only the business object in this constrained column. The realised
      // attribute remains available in the mapping section and page title.
      { key: 'real', label: 'Realisiert', render: (f) => f.real.length
        ? f.real.map((r) => `<a class="badge badge--info" href="${objectHref(r.objectId)}" title="${esc(`${r.objectName} · ${r.attribute}`)}">${esc(r.objectName)}</a>`).join(' ')
        : '<span class="muted">—</span>' },
    ],
  }));

  ctx.onUnmount(C.mountDataTable(mount.querySelector('#mc-real'), {
    id: 'mc-rl', unit: { nom: 'Begriffe', dat: 'Begriffen' }, caption: `Von ${t.name} realisierte Geschäftsobjekte`, perPage: 15,
    emptyMsg: 'Diese Tabelle realisiert kein katalogisiertes Geschäftsobjekt — die Abbildung wird am Attribut des Geschäftsobjekts gepflegt und ist hier noch nicht erfasst.',
    rows: real,
    searchKeys: ['objectName', 'attribute', 'field'],
    sorts: [
      { value: 'obj', label: 'Geschäftsobjekt (A–Z)', cmp: (a, b) => a.objectName.localeCompare(b.objectName, 'de') },
      { value: 'field', label: 'Feld (A–Z)', cmp: (a, b) => a.field.localeCompare(b.field, 'de') },
    ],
    columns: [
      { key: 'objectName', label: 'Geschäftsobjekt', render: (r) => `<a href="${objectHref(r.objectId)}">${esc(r.objectName)}</a>` },
      { key: 'attribute', label: 'Attribut', render: (r) => esc(r.attribute) },
      { key: 'field', label: 'Feld', render: (r) => `<code>${esc(r.field)}</code>` },
      { key: 'match', label: 'Güte', render: (r) => matchBadge(core, r.match) },
    ],
  }));
}
