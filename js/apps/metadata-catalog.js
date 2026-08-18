import { APPLICATIONS, trail } from '../crumbs.js';
import { formatDate } from '../format.js';
// Scope (tree) and presentation (tabs) are independent URL state. Levels 0–4
// represent root, branch, group, record, and record part. The legacy `id` and
// `table` selectors remain stable search-index links for level 3.
import * as links from '../links.js';
import { escape as esc, badge } from '../components.js';
import { runTableExport, slug } from '../ui/export-table.js';
import {
  landscapeKey, landscapeState, wireLandscape,
} from '../ui/landscape-state.js';
import {
  classifyUrl, newWindowAttrs, safeLinkUrl, safeMailto,
} from '../security/urls.js';

export const needs = ['businessObjects', 'dataTables', 'contacts'];

const BASE = '#/app/metadata-catalog';
const TITLE = 'Dokumentation der Geschäftsarchitektur';

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

const truncateText = (s, n = 110) => {
  const t = String(s || '').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 20)).trimEnd() + '…';
};

// Return escaped HTML with the matching excerpt marked; a leading excerpt can
// hide the reason a row matched when the hit occurs late in a definition.
const snippet = (text, q, n) => {
  const t = String(text || '').trim();
  const i = q ? t.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return esc(truncateText(t, n));
  const want = Math.max(0, i - Math.floor((n - q.length) / 2));
  const space = want === 0 ? -1 : t.indexOf(' ', want);
  const start = want === 0 ? 0 : (space >= 0 && space < i ? space + 1 : want);
  const cut = t.slice(start, start + n);
  const j = cut.toLowerCase().indexOf(q.toLowerCase());
  if (j < 0) return esc(truncateText(t, n));
  return (start > 0 ? '…' : '')
    + esc(cut.slice(0, j))
    + `<mark>${esc(cut.slice(j, j + q.length))}</mark>`
    + esc(cut.slice(j + q.length))
    + (start + n < t.length ? '…' : '');
};

const refList = (core, key) => core.ref()[key] || [];
const domainOf = (core, key) => core.dataDomains().find((d) => d.key === key) || {};
const domainLabel = (core, key) => domainOf(core, key).label || key;
const statusOf = (core, id) => refList(core, 'objectStatuses').find((s) => s.id === id) || { label: id, variant: 'gray' };
const stewardName = (core, id) =>
  (core.contacts().find((c) => c.contactId === id) || {}).name || '';
const matchOf = (core, id) => refList(core, 'mappingMatches').find((m) => m.id === id) || { label: id, variant: 'gray' };
const hostOf = (url) => { try { return new URL(url).host; } catch { return String(url || ''); } };
const newWindowLink = (href, label) => `<a href="${esc(href)}"${newWindowAttrs(href, {
  external: classifyUrl(href) === 'external',
})}>${esc(label)}<span class="sr-only"> (öffnet in neuem Fenster)</span></a>`;
const semanticDate = (value) => {
  const raw = String(value || '');
  const formatted = formatDate(raw);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && formatted !== raw
    ? `<time datetime="${esc(raw)}">${esc(formatted)}</time>`
    : esc(formatted);
};
const provenanceRows = (core, record, { includeSystem = true } = {}) => {
  const source = record.source;
  if (!source) return [];
  const role = refList(core, 'sourceRoles').find((r) => r.key === source.role) || {};
  const href = safeLinkUrl(source.url);
  const product = includeSystem && role.product
    ? `<br><span class="small muted">${esc(role.product)}</span>` : '';
  return [
    includeSystem ? ['Führendes System', `${esc(role.label || source.role || '—')}${product}`] : null,
    source.ref ? ['Referenz', `<code>${esc(source.ref)}</code>`] : null,
    source.reconciled ? ['Abgeglichen', semanticDate(source.reconciled)] : null,
    href ? ['Repository', newWindowLink(href, 'Im Repository öffnen')] : null,
  ].filter(Boolean);
};
const BOXES = landscapeState('metadata-catalog');
export const catalogueNodeId = (type, kind, ...parts) => landscapeKey(type, kind, ...parts);

const MATCH_HINT = {
  exact: 'Exakt — Feldinhalt und Begriff sind deckungsgleich.',
  close: 'Nahe — inhaltlich dasselbe, aber mit abweichender Kodierung oder Einheit.',
  partial: 'Teilweise — das Feld deckt nur einen Teil des Begriffs ab.',
};
const matchBadge = (core, id) => {
  const m = matchOf(core, id);
  const hint = MATCH_HINT[id] || m.label;
  return `<span title="${esc(hint)}">${badge(m.label, m.variant, 'sm')}<span class="sr-only">: ${esc(hint)}</span></span>`;
};

const TAB_LABEL = { 'uebersicht': 'Übersicht', 'diagramm': 'Diagramm', 'tabelle': 'Tabelle' };
const VIEW_ICON = { 'uebersicht': 'InfoCircle', 'diagramm': 'Apps', 'tabelle': 'List' };
// Not every level offers every tab. A record has no landscape of its own — its
// parts are a list, not a territory — and an attribute has nothing below it at all.
const TABS_AT = (lvl) => (lvl === 0 ? [] : lvl >= 4 ? ['uebersicht']
  : lvl === 3 ? ['uebersicht', 'tabelle'] : ['uebersicht', 'diagramm', 'tabelle']);
// Aggregate scopes open as landscapes; a selected entity opens with its facts.
const DEFAULT_TAB = { 1: 'diagramm', 2: 'diagramm', 3: 'uebersicht', 4: 'uebersicht' };

const BRANCHES = ['objekt', 'tabelle', 'referenz'];
const BRANCH_LABEL = { 'objekt': 'Geschäftsobjekte', 'tabelle': 'Datentabellen', 'referenz': 'Referenzdaten' };
const BRANCH_SOURCE = { 'objekt': 'businessObjects', 'tabelle': 'dataTables' };
const BRANCH_UNIT = {
  'objekt': { one: 'Geschäftsobjekt', nom: 'Geschäftsobjekte', dat: 'Geschäftsobjekten',
    kid: 'Attribute', kidOne: 'Attribut', axis: 'Domäne', axisPl: 'Domänen' },
  'tabelle': { one: 'Datentabelle', nom: 'Datentabellen', dat: 'Datentabellen',
    kid: 'Felder', kidOne: 'Feld', axis: 'System', axisPl: 'Systemen' },
  'referenz': { one: 'Werteliste', nom: 'Wertelisten', dat: 'Wertelisten',
    kid: 'Werte', kidOne: 'Wert', axis: 'Thema', axisPl: 'Themen' },
};
const DEFAULT_UNIT = BRANCH_UNIT[BRANCHES[0]];
const branchAvailable = (core, kind) => !BRANCH_SOURCE[kind]
  || typeof core.available !== 'function' || core.available(BRANCH_SOURCE[kind]);

// Search applies to every presentation but intentionally clears on a tree scope
// change, so a newly selected branch never appears inexplicably empty.
const matches = (q, ...fields) => {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => String(f == null ? '' : f).toLowerCase().includes(needle));
};
// One predicate keeps tree counts and panes consistent. Status remains a filter,
// not a free-text field that would make common statuses match almost everything.
const recordMatches = (q, r) => matches(q, r.name, r.def, r.group, r.steward);
const scopeRows = (s) => s.rows.filter((r) => (!s.leaf || r.group === s.leaf)
  && recordMatches(s.q, r));
const scopeKids = (s) => (s.rec ? s.rec.kids : [])
  .filter((k) => matches(s.q, k.name, k.def, k.type));

const SEARCH_LABEL = 'Im Katalog suchen';

// Grouping is shared URL state for landscape boxes and table sections. The
// compatibility query value: `keine` explicitly requests no grouping.
const SORTS = (lvl, unit) => (lvl >= 3
  ? [
    { value: 'ord', label: 'Reihenfolge', cmp: () => 0 },
    { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
  ]
  : [
    { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
    { value: 'n', label: `${unit.kid} (meiste zuerst)`, cmp: (a, b) => b.n - a.n },
  ]);
const DEFAULT_SORT = (lvl) => (lvl >= 3 ? 'ord' : 'name');
const sortRows = (rows, s) => {
  const def = SORTS(s.lvl, BRANCH_UNIT[s.kind] || DEFAULT_UNIT)
    .find((x) => x.value === s.sort);
  return def && def.cmp ? rows.slice().sort(def.cmp) : rows;
};

const GROUP_DIMS = (kind) => {
  const dims = [{ value: 'achse', label: BRANCH_UNIT[kind].axis, of: (r) => r.group }];
  // Reference lists do not yet carry stewardship or status.
  if (kind !== 'referenz') {
    dims.push({ value: 'verantwortung', label: 'Verantwortung', of: (r) => r.steward || 'noch nicht erfasst' });
    dims.push({ value: 'status', label: 'Status', of: (r) => r.status || 'noch nicht erfasst' });
  }
  dims.push({ value: 'keine', label: 'keine', of: null });
  return dims;
};
// A branch opens grouped by its axis; inside one axis value that grouping would
// produce one redundant box.
const DEFAULT_GROUP = (lvl) => (lvl === 1 ? 'achse' : 'keine');

const REF_THEMES = [
  ['Katalog und Metadaten', ['objectStatuses', 'classificationTiers', 'mappingMatches', 'dataDomains', 'sourceRoles']],
  ['Bauwerk und Liegenschaft', ['gebaeudearten', 'buildingStatuses', 'teilportfolios', 'nawClasses']],
  ['Projekte und Bau', ['siaPhases', 'bkpGroups', 'projectStatuses']],
  ['Services und Portal', ['domains', 'audiences', 'statusModel']],
];
const REF_LABEL = {
  objectStatuses: 'Objekt-Status', classificationTiers: 'Klassifizierung',
  mappingMatches: 'Abbildungsgüte', dataDomains: 'Datendomänen', sourceRoles: 'Quellen-Rollen',
  gebaeudearten: 'Gebäudearten', buildingStatuses: 'Gebäude-Status',
  teilportfolios: 'Teilportfolios', nawClasses: 'NAW-Klassen',
  siaPhases: 'SIA-Phasen', bkpGroups: 'BKP-Gruppen', projectStatuses: 'Projekt-Status',
  domains: 'Service-Domänen', audiences: 'Zielgruppen', statusModel: 'Status-Modell',
};

// Normalize all three branches once for the shared tree and pane renderers.
function records(core, kind) {
  let result;
  if (kind === 'objekt') {
    result = core.businessObjects().map((o) => {
      const status = statusOf(core, o.status);
      return {
        kind: 'objekt', id: o.objectId, name: o.name, group: domainLabel(core, o.domain),
        def: o.definition || '', status: status.label, statusVariant: status.variant,
        steward: stewardName(core, o.steward), persons: o.responsiblePersons || [],
        n: (o.attributes || []).length, updated: o.updated || '',
        raw: o, href: links.businessObject(o.objectId),
        kids: (o.attributes || []).map((a) => ({
          name: a.name, def: a.definition || '', type: VALUE_TYPE[a.type] || a.type,
          key: a.keyRole || '', required: !!a.required, std: a.standardRef || '', raw: a,
        })),
      };
    });
  } else if (kind === 'tabelle') {
    result = core.dataTables().map((t) => ({
      kind: 'tabelle', id: t.tableId, name: t.displayName || t.name, group: t.systemName || '—',
      def: t.description || '', status: t.certified ? 'Zertifiziert' : 'Nicht zertifiziert',
      statusVariant: t.certified ? 'success' : 'gray',
      steward: stewardName(core, t.steward), persons: t.responsiblePersons || [],
      n: (t.fields || []).length, updated: t.updated || '',
      raw: t, href: links.dataTable(t.tableId),
      kids: (t.fields || []).map((f) => ({
        name: f.name, def: f.description || '', type: f.dataType || f.type || '',
        key: f.primaryKey ? 'PK' : f.foreignKey ? 'FK' : '', required: !f.nullable, std: '', raw: f,
      })),
    }));
  } else {
    result = REF_THEMES.flatMap(([theme, keys]) => keys.map((k) => {
      const vals = refList(core, k);
      return {
        kind: 'referenz', id: k, name: REF_LABEL[k] || k, group: theme,
        // Keep unsupported governance fields visibly empty rather than inventing
        // searchable metadata that the reference-list model does not contain.
        def: '',
        status: '', statusVariant: '', steward: '', persons: [],
        n: vals.length, updated: '',
        raw: { key: k, values: vals }, href: `${BASE}?list=${encodeURIComponent(k)}`,
        kids: vals.map((v) => ({
          name: String(v.label || v.name || v.id || v.key || v),
          def: v.definition || v.description || v.consequence || '',
          type: String(v.id || v.key || ''), key: '', required: false, std: '', raw: v,
        })),
      };
    }));
  }
  return result;
}

// Core accessors remain the existence boundary for record deep links.
const RESOLVE = {
  'objekt': (core, id) => core.businessObject(id),
  'tabelle': (core, id) => core.dataTable(id),
  'referenz': (core, id) => (REF_LABEL[id] && refList(core, id) ? { key: id } : null),
};

// Validate every URL-selected path segment before it reaches a renderer.
export function readState(ctx) {
  const { query: qs, core } = ctx;
  const kindParam = qs.get('kind');
  // Legacy record selectors imply their branch.
  const picked = qs.get('id') ? ['objekt', qs.get('id')]
    : qs.get('table') ? ['tabelle', qs.get('table')]
      : qs.get('list') ? ['referenz', qs.get('list')] : null;
  const kind = picked ? picked[0] : (BRANCHES.includes(kindParam) ? kindParam : '');
  const rowsByKind = new Map();
  const availableFor = (branch) => branchAvailable(core, branch);
  const rowsFor = (branch) => {
    if (!rowsByKind.has(branch)) rowsByKind.set(branch, availableFor(branch) ? records(core, branch) : []);
    return rowsByKind.get(branch);
  };
  const rows = kind ? rowsFor(kind) : [];
  // URLSearchParams has already decoded the identifier exactly once.
  const available = kind ? availableFor(kind) : true;
  const raw = picked && available ? RESOLVE[kind](core, picked[1]) : null;
  const rec = raw ? rows.find((r) => r.id === picked[1]) || null : null;
  const leafParam = qs.get('leaf') || '';
  const leaf = rec ? rec.group : (rows.some((r) => r.group === leafParam) ? leafParam : '');
  const attrParam = qs.get('attr') || '';
  const attr = rec && rec.kids.some((k) => k.name === attrParam) ? attrParam : '';
  const lvl = attr ? 4 : rec ? 3 : leaf ? 2 : kind ? 1 : 0;
  const avail = TABS_AT(lvl);
  const pick = TAB_LABEL[qs.get('tab')] ? qs.get('tab') : '';
  const tab = avail.includes(pick) ? pick
    : (avail.includes(DEFAULT_TAB[lvl]) ? DEFAULT_TAB[lvl] : avail[0] || '');
  const q = (qs.get('q') || '').trim();
  const sortPick = qs.get('sort') || '';
  const dims = kind ? GROUP_DIMS(kind) : [];
  const groupPick = dims.some((d) => d.value === qs.get('group')) ? qs.get('group') : '';
  const group = groupPick || DEFAULT_GROUP(lvl);
  const unitOf = BRANCH_UNIT[kind] || DEFAULT_UNIT;
  const sorts = SORTS(lvl, unitOf);
  const sort = sorts.some((x) => x.value === sortPick) ? sortPick : DEFAULT_SORT(lvl);
  return { kind, rows, rowsFor, available, availableFor, leaf, rec, attr, lvl, tab, pick, avail, group, groupPick, q,
    sort, sortPick: sort === DEFAULT_SORT(lvl) ? '' : sort,
    missing: !!picked && available && !rec };
}

// Back moves up exactly one catalogue level; other view state remains stable.
function backTo(s) {
  if (s.attr && s.rec) return { backHref: hrefFor(s, { attr: '' }), backLabel: s.rec.name };
  if (s.rec) {
    const group = s.rec.group;
    return group
      ? { backHref: hrefFor(s, { rec: null, attr: '', kind: s.rec.kind, leaf: group }), backLabel: group }
      : { backHref: hrefFor(s, { rec: null, attr: '', kind: s.rec.kind, leaf: '' }), backLabel: BRANCH_LABEL[s.rec.kind] };
  }
  if (s.leaf) return { backHref: hrefFor(s, { leaf: '' }), backLabel: BRANCH_LABEL[s.kind] };
  if (s.kind) return { backHref: BASE, backLabel: TITLE };
  return { backHref: '#/applications', backLabel: 'Anwendungen' };
}

function hrefFor(s, patch) {
  const n = { kind: s.kind, leaf: s.leaf, rec: s.rec, attr: s.attr, pick: s.pick,
    groupPick: s.groupPick, sortPick: s.sortPick, ...patch };
  const changesRecord = n.rec && (!s.rec || n.rec.kind !== s.rec.kind || n.rec.id !== s.rec.id);
  const changesPart = Object.prototype.hasOwnProperty.call(patch, 'attr') && n.attr !== s.attr;
  if (changesRecord || changesPart) n.pick = '';
  const p = new URLSearchParams();
  if (n.rec) {
    p.set(n.rec.kind === 'objekt' ? 'id' : n.rec.kind === 'tabelle' ? 'table' : 'list', n.rec.id);
    if (n.attr) p.set('attr', n.attr);
  } else {
    if (n.kind) p.set('kind', n.kind);
    if (n.leaf) p.set('leaf', n.leaf);
  }
  if (n.pick) p.set('tab', n.pick);
  if (n.groupPick) p.set('group', n.groupPick);
  if (n.sortPick) p.set('sort', n.sortPick);
  const s2 = p.toString();
  return s2 ? `${BASE}?${s2}` : BASE;
}

const tabLabel = (s, unit, tab) => (tab === 'tabelle' && s.lvl === 3 ? unit.kid : TAB_LABEL[tab]);
const tabItems = (s, unit) => s.avail.map((id) => ({ id, label: tabLabel(s, unit, id) }));

function pageHeading(s, unit) {
  if (s.attr) return { title: s.attr, lead: `${unit.kidOne} von «${s.rec.name}»` };
  if (s.rec) return { title: s.rec.name, lead: `${unit.one} · ${unit.axis}: ${s.rec.group}` };
  if (s.leaf) return { title: s.leaf, lead: `${unit.axis} · ${scopeRows(s).length} ${unit.nom}` };
  if (s.kind) return { title: BRANCH_LABEL[s.kind], lead: `${unit.nom}, gegliedert nach ${unit.axisPl}` };
  return {
    title: TITLE,
    lead: 'Fachbegriffe des BBL, ihre Realisierung in den Führungssystemen, und die Wertelisten, auf die beide verweisen.',
  };
}

function breadcrumbTrail(s) {
  const items = [{ label: TITLE, href: BASE }];
  if (s.kind) items.push({
    label: BRANCH_LABEL[s.kind],
    href: hrefFor(s, { kind: s.kind, leaf: '', rec: null, attr: '', pick: '' }),
  });
  if (s.leaf) items.push({
    label: s.leaf,
    href: hrefFor(s, { kind: s.kind, leaf: s.leaf, rec: null, attr: '', pick: '' }),
  });
  if (s.rec) items.push({
    label: s.rec.name,
    href: hrefFor(s, { kind: s.kind, leaf: s.rec.group, rec: s.rec, attr: '', pick: '' }),
  });
  if (s.attr) items.push({ label: s.attr });
  delete items[items.length - 1].href;
  return trail(APPLICATIONS, ...items);
}

export default function render(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  const s = readState(ctx);

  // A named record that does not resolve is a broken link, not an empty page.
  if (s.missing) {
    return C.renderNotFound(ctx, {
      thing: 'Dieser Eintrag', title: 'Eintrag nicht gefunden',
      backHref: BASE, backLabel: TITLE,
      crumbs: trail(APPLICATIONS, { label: TITLE, href: BASE }),
    });
  }

  const unit = BRANCH_UNIT[s.kind] || DEFAULT_UNIT;
  const here = s.attr || (s.rec && s.rec.name) || s.leaf || (s.kind && BRANCH_LABEL[s.kind]) || '';
  setTitle(here ? `${here} — ${TITLE}` : TITLE);
  setCrumbs(breadcrumbTrail(s));
  const heading = pageHeading(s, unit);
  const detailTabs = s.lvl === 3
    ? C.tabBar({ items: tabItems(s, unit), active: s.tab, idPrefix: 'mc-tab',
      panelId: 'mc-panel', ariaLabel: `Details zu ${s.rec.name}` })
    : '';
  const panelAttrs = s.lvl === 3
    ? ` role="tabpanel" tabindex="0" aria-labelledby="mc-tab-${s.tab}"`
    : '';
  const treePane = '<aside class="pf-sidebar" id="mc-tree" aria-label="Katalog"></aside>';
  const mainPane = `<div class="pf-main">
        ${detailTabs}
        <div id="mc-panel" class="mc-pane${detailTabs ? ' tab__container' : ''}"${panelAttrs}>${paneHtml(ctx, s, unit)}</div>
      </div>`;
  const detailLayout = s.lvl >= 3;

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar(backTo(s))}
    ${C.pageHeader(heading)}
    ${C.catalogueBar({
    formId: 'mc-search', inputId: 'mc-q',
    searchLabel: SEARCH_LABEL,
    placeholder: `${SEARCH_LABEL}…`,
    q: s.q,
    showSearch: s.lvl < 4 && s.available,
    showCount: false,
    extra: `<span id="mc-tools">${toolsHtml(ctx, s)}</span>`,
    view: s.tab,
    // Detail modes are text tabs in the main pane; aggregate modes remain view controls.
    views: s.available && s.lvl > 0 && s.lvl < 3
      ? s.avail.map((k) => [k, tabLabel(s, unit, k), VIEW_ICON[k]]) : null,
  })}
    <div id="mc-activefilters">${activeFiltersHtml(ctx, s)}</div>
    <div class="pf-layout${detailLayout ? ' pf-layout--detail mc-layout--detail' : ''}">
      ${detailLayout ? `${mainPane}${treePane}` : `${treePane}${mainPane}`}
    </div>
  </div>`;

  let disposePane = mountPane(ctx, s, unit);
  ctx.onUnmount(() => disposePane());
  // Tree folds survive query redraws because the host and tree id remain stable.
  const treeHost = mount.querySelector('#mc-tree');
  let dropTree = C.sidebarTree(treeHost, treeConfig(ctx, s));
  ctx.onUnmount(() => dropTree());
  const paintTree = () => { dropTree(); dropTree = C.sidebarTree(treeHost, treeConfig(ctx, cur)); };

  // The pane is redrawn in place for anything that changes only the pane. `cur`
  // is what it is currently showing, so a landscape click after a tab switch
  // acts on the tab the reader is actually looking at.
  let cur = s;
  const panel = mount.querySelector('#mc-panel');
  const tools = mount.querySelector('#mc-tools');
  const paintTools = () => {
    if (!tools) return;
    tools.innerHTML = toolsHtml(ctx, cur);
    C.wireMenu(tools, (a) => onMenuAction(a, cur, unit));
  };
  const pills = mount.querySelector('#mc-activefilters');
  const redraw = () => {
    disposePane();
    panel.innerHTML = paneHtml(ctx, cur, unit);
    disposePane = mountPane(ctx, cur, unit);
    paintTools();
    paintTree();
    if (pills) pills.innerHTML = activeFiltersHtml(ctx, cur);
  };

  const selectPresentation = (tab) => {
    if (tab === cur.tab || !cur.avail.includes(tab)) return;
    const p = new URLSearchParams(location.hash.split('?')[1] || '');
    if (tab === DEFAULT_TAB[cur.lvl]) p.delete('tab'); else p.set('tab', tab);
    const str = p.toString();
    history.replaceState(history.state, '', str ? `${BASE}?${str}` : BASE);
    cur = { ...cur, tab, pick: tab === DEFAULT_TAB[cur.lvl] ? '' : tab };
    redraw();
  };

  // Live search replaces the current history entry and cancels its pending tick
  // when the route unmounts.
  const input = mount.querySelector('#mc-q');
  if (input) {
    let timer = null;
    const apply = () => {
      const p = new URLSearchParams(location.hash.split('?')[1] || '');
      if (input.value.trim()) p.set('q', input.value.trim()); else p.delete('q');
      const str = p.toString();
      history.replaceState(history.state, '', str ? `${BASE}?${str}` : BASE);
      cur = { ...cur, q: input.value.trim() };
      redraw();
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(apply, 250); });
    input.closest('form').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); apply(); });
    ctx.onUnmount(() => clearTimeout(timer));
  }

  if (tools) C.wireMenu(tools, (a) => onMenuAction(a, cur, unit));

  ctx.onUnmount(wireLandscape({
    panel, tools, state: BOXES,
    keys: () => landscapeBoxes(cur).map((box) => box.key),
    redraw,
  }));

  // Local view switching preserves the tree's scroll position and focus.
  const bar = mount.querySelector('.catbar');
  if (bar) {
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('.view-switch__btn');
      if (!b) return;
      const tab = b.dataset.view;
      if (tab === cur.tab) return;
      bar.querySelectorAll('.view-switch__btn').forEach((x) => {
        x.setAttribute('aria-pressed', String(x.dataset.view === tab));
      });
      selectPresentation(tab);
    });
    if (pills) {
      pills.addEventListener('click', (e) => {
        const rm = e.target.closest('[data-remove]');
        if (!rm || rm.dataset.remove !== 'q') return;
        e.preventDefault();
        const p = new URLSearchParams(location.hash.split('?')[1] || '');
        p.delete('q');
        const str = p.toString();
        history.replaceState(history.state, '', str ? `${BASE}?${str}` : BASE);
        const box = mount.querySelector('#mc-q');
        if (box) box.value = '';
        cur = { ...cur, q: '' };
        redraw();
      });
    }
  }

  if (s.lvl === 3) C.wireTabs(mount, { onSelect: selectPresentation });
}

// Hierarchy is navigation; only the free-text constraint belongs in this row.
function activeFiltersHtml(ctx, s) {
  const { C } = ctx;
  return s.q ? C.activeFilters({
    filters: [{ label: `Suche: ${s.q}`, remove: 'q' }], resetHref: BASE,
  }) : '';
}

// Export the complete filtered scope, not merely the current table page.
function exportTable(s, unit) {
  if (s.lvl >= 3) {
    const isRef = s.rec.kind === 'referenz';
    const kids = s.lvl === 4 ? scopeKids(s).filter((k) => k.name === s.attr) : scopeKids(s);
    return {
      name: s.lvl === 4 ? `${s.rec.name} — ${s.attr}` : `${s.rec.name} — ${unit.kid}`,
      head: [isRef ? 'Bezeichnung' : s.rec.kind === 'objekt' ? 'Attribut' : 'Feld',
        'Beschreibung', isRef ? 'Schlüssel' : 'Typ', 'Schlüsselrolle', 'Pflichtangabe'],
      rows: kids.map((k) => [k.name, k.def, k.type, k.key,
        isRef ? '' : k.required ? 'Pflicht' : 'optional']),
    };
  }
  if (s.lvl === 0) {
    const hits = BRANCHES.flatMap((k) => s.rowsFor(k).map((r) => ({ ...r, kind: k })))
      .filter((r) => recordMatches(s.q, r));
    return { name: s.q ? `Treffer für ${s.q}` : 'Katalog',
      head: ['Bereich', 'Name', 'Gruppe', 'Beschreibung', 'Verantwortung', 'Bestandteile', 'Status'],
      rows: hits.map((r) => [BRANCH_LABEL[r.kind], r.name, r.group, r.def, r.steward, r.n, r.status]) };
  }
  return {
    name: s.leaf || BRANCH_LABEL[s.kind],
    head: ['Name', unit.axis, 'Verantwortung', 'Beschreibung', unit.kid, 'Status'],
    rows: scopeRows(s).map((r) => [r.name, r.group, r.steward, r.def, r.n, r.status]),
  };
}

function onMenuAction(action, s, unit) {
  if (action.startsWith('group:')) {
    const value = action.slice('group:'.length);
    location.hash = hrefFor(s, {
      groupPick: value === DEFAULT_GROUP(s.lvl) ? '' : value,
    }).slice(1);
    return;
  }
  if (action.startsWith('sort:')) {
    const value = action.slice('sort:'.length);
    location.hash = hrefFor(s, {
      sortPick: value === DEFAULT_SORT(s.lvl) ? '' : value,
    }).slice(1);
    return;
  }
  runExport(action, s, unit);
}

function runExport(action, s, unit) {
  const t = exportTable(s, unit);
  runTableExport(action, t, `geschaeftsarchitektur_${slug(t.name, 'katalog')}`);
}

function toolsHtml(ctx, s) {
  const { C } = ctx;
  if (s.lvl < 1) return '';
  if (!s.available) return `<span class="mc-tools">
    <button type="button" class="btn btn--outline btn--sm" disabled>Export nicht verfügbar</button>
  </span>`;
  const boxes = s.tab === 'diagramm' ? landscapeBoxes(s) : [];
  const anyOpen = boxes.length > 0 && BOXES.anyOpen(boxes.map((b) => b.key));
  const fold = s.tab !== 'diagramm' || !boxes.length ? '' : `
    <button type="button" class="btn btn--outline btn--sm btn--icon-left" data-lscape-all="${anyOpen ? 'shut' : 'open'}">
      ${C.icon(anyOpen ? 'Minus' : 'Plus', 'btn__icon')}
      <span class="btn__text">Alle ${anyOpen ? 'zuklappen' : 'aufklappen'}</span></button>`;
  const sorts = SORTS(s.lvl, BRANCH_UNIT[s.kind] || DEFAULT_UNIT);
  const chosenSort = sorts.find((x) => x.value === s.sort) || sorts[0];
  const sortMenu = s.tab !== 'tabelle' ? '' : C.menu({
    menuId: 'mc-sort', label: 'Sortieren', triggerLabel: `Sortieren: ${chosenSort.label}`,
    items: sorts.map((x) => ({ action: `sort:${x.value}`, label: x.label })),
  });

  const dims = GROUP_DIMS(s.kind);
  const chosen = dims.find((d) => d.value === s.group) || dims[0];
  const group = s.lvl > 2 || s.tab === 'uebersicht' ? '' : C.menu({
    menuId: 'mc-group', label: 'Gruppieren', triggerLabel: `Gruppieren: ${chosen.label}`,
    items: dims.map((d) => ({ action: `group:${d.value}`, label: d.label })),
  });
  const exportSubject = s.lvl === 4 ? (BRANCH_UNIT[s.kind] || DEFAULT_UNIT).kidOne
    : s.lvl === 3 ? (BRANCH_UNIT[s.kind] || DEFAULT_UNIT).kid
      : (BRANCH_UNIT[s.kind] || DEFAULT_UNIT).nom;
  const actions = C.menu({
    menuId: 'mc-actions', label: 'Aktionen', triggerLabel: 'Aktionen',
    items: [
      { action: 'csv', label: `${exportSubject} als CSV herunterladen` },
      { action: 'excel', label: `${exportSubject} als Excel herunterladen` },
      { action: 'pdf', label: `${exportSubject} als PDF drucken` },
    ],
  });
  return `<span class="mc-tools">${fold}${sortMenu}${group}${actions}</span>`;
}

const BRANCH_ICON_OF = {
  'objekt': 'lucide/boxes', 'tabelle': 'lucide/database', 'referenz': 'lucide/list',
};

function treeConfig(ctx, s) {
  const { core } = ctx;

  const levels = [{ icons: true }, { icons: false }, { icons: false }, { icons: false }];

  const attrNodes = (r, kind, group) => r.kids.map((k) => ({
    id: catalogueNodeId('attr', kind, r.id, k.name),
    label: k.name,
    href: hrefFor(s, { rec: r, attr: k.name, kind, leaf: group }),
    state: s.rec && s.rec.id === r.id && s.attr === k.name ? 'active' : '',
  }));

  const recNode = (r, kind, group) => {
    const on = s.rec && s.rec.id === r.id;
    return {
      id: catalogueNodeId('record', kind, r.id),
      label: r.name,
      count: r.n,
      countUnit: BRANCH_UNIT[kind].kid,
      href: hrefFor(s, { rec: r, attr: '', kind, leaf: group }),
      state: on && !s.attr ? 'active' : on ? 'path' : '',
      // Selection and folding remain separate for records with many parts.
      split: true,
      open: !!(on && s.attr),
      hasChildren: r.kids.length > 0,
      // Build potentially large part lists only when expanded.
      children: () => attrNodes(r, kind, group),
    };
  };

  // The tree and pane share the same search predicate and counts.
  const rowsOf = (kind) => {
    const all = s.rowsFor(kind);
    return s.q ? all.filter((r) => recordMatches(s.q, r)) : all;
  };

  const branchNode = (kind) => {
    const available = s.availableFor(kind);
    const rows = rowsOf(kind);
    if (s.q && available && !rows.length) return null;
    const open = s.q ? true : s.kind === kind;
    const groups = [...new Set(rows.map((r) => r.group))].sort((a, b) => a.localeCompare(b, 'de'));
    return {
      id: `kind:${kind}`,
      label: available ? BRANCH_LABEL[kind] : `${BRANCH_LABEL[kind]} — nicht verfügbar`,
      count: available ? rows.length : null,
      countUnit: BRANCH_UNIT[kind].nom,
      icon: BRANCH_ICON_OF[kind],
      href: hrefFor(s, { kind, leaf: '', rec: null, attr: '' }),
      state: open && !s.leaf ? 'active' : open ? 'path' : '',
      open,
      hasChildren: available && groups.length > 0,
      children: () => groups.map((g) => {
        const mine = rows.filter((r) => r.group === g);
        const here = s.leaf === g;
        return {
          id: `leaf:${kind}:${g}`,
          label: g,
          count: mine.length,
          countUnit: BRANCH_UNIT[kind].nom,
          href: hrefFor(s, { kind, leaf: g, rec: null, attr: '' }),
          state: here && !s.rec ? 'active' : here ? 'path' : '',
          open: s.q ? true : here,
          hasChildren: mine.length > 0,
          children: () => mine.map((r) => recNode(r, kind, g)),
        };
      }),
    };
  };

  return {
    id: 'mc-tree',
    title: 'Katalog',
    mode: 'nav',
    levels,
    sections: [
      [{
        id: 'root',
        label: 'Übersicht',
        count: BRANCHES.reduce((a, k) => a + rowsOf(k).length, 0),
        countUnit: 'Einträge',
        icon: 'lucide/library',
        href: BASE,
        state: s.lvl === 0 ? 'active' : '',
      }],
      BRANCHES.map(branchNode).filter(Boolean),
    ],
  };
}

const TODO = badge('noch nicht erfasst', 'warning', 'sm');
const CATALOG_CONTACT_ID = 'dres';
const section = (title, body) =>
  `<section class="detail-section"><h2 class="detail-section__title">${esc(title)}</h2>${body}</section>`;
const kv = (rows) => `<dl class="kv kv--ruled mc-detail__list">${rows.filter(Boolean)
  .map(([k, v]) => `<div class="mc-detail__fact"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
const overviewKv = (rows) => `<dl class="kv">${rows.filter(Boolean)
  .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
const contactCard = (rows) => `<div class="box">
  <h2 id="mc-contacts-title">Ansprechpersonen</h2>
  <dl class="kv kv--stack">${rows.filter(Boolean)
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
</div>`;
const personRows = (persons) => (persons || []).map((p) => [p.role,
  newWindowLink(`https://admindir.verzeichnisse.admin.ch/person/${encodeURIComponent(p.admindirId)}`,
    `AdminDir ${p.admindirId}`)]);
const detailOverview = ({ description, facts }) => `<div class="mc-detail mc-detail--metadata">
  <section class="detail-section mc-detail__description">
    <h2 class="detail-section__title">Beschreibung</h2>
    <p class="m-0">${description ? esc(description) : TODO}</p>
  </section>
  <div class="mc-detail__facts">
    ${facts.map(([title, rows]) => section(title, kv(rows))).join('')}
  </div>
</div>`;

// Record overviews use the same operational anatomy as property details: a
// readable stream of facts plus one stable aside. One compact card combines the
// actionable team with governance roles and AdminDir links.
const recordContactAside = (core, record, additionalCard = '') => {
  const stewardId = record.raw?.steward || '';
  const stewardContact = core.contacts().find((candidate) => candidate.contactId === stewardId);
  const contact = stewardContact
    || core.contacts().find((candidate) => candidate.contactId === CATALOG_CONTACT_ID);
  const label = stewardContact ? 'Datenverantwortung' : 'Metadaten und Katalog';
  const mailto = safeMailto(contact?.email || '');
  const contactValue = [
    esc(contact?.name || record.steward || 'Kontaktdaten nicht verfügbar'),
    mailto ? `<a href="${esc(mailto)}">${esc(contact.email)}</a>` : '',
    contact?.phone ? esc(contact.phone) : '',
  ].filter(Boolean).join('<br>');
  const rows = [
    [label, contactValue],
    ...personRows(record.persons),
    !record.steward ? ['Verantwortung', TODO] : null,
  ];
  const labelAttribute = additionalCard
    ? 'aria-label="Systemzugang und Ansprechpersonen"'
    : 'aria-labelledby="mc-contacts-title"';
  return `<aside class="detail-layout__aside" ${labelAttribute}>
    ${additionalCard}
    ${contactCard(rows)}
  </aside>`;
};

const recordDetailOverview = ({ description, facts, aside }) => `<div class="detail-layout">
  <div class="vertical-spacing">
    ${section('Beschreibung', `<p class="m-0">${description ? esc(description) : TODO}</p>`)}
    ${facts.map(([title, rows]) => section(title, overviewKv(rows))).join('')}
  </div>
  ${aside}
</div>`;

function paneHtml(ctx, s, unit) {
  const { core, C } = ctx;
  if (s.lvl === 0) return homeHtml(ctx, s);
  if (!s.available) return C.empty(`${unit.nom} konnten nicht geladen werden (Ladefehler).`, { available: false });
  if (s.lvl <= 2 && s.q && scopeRows(s).length === 0 && s.tab !== 'tabelle') {
    return C.empty(`Kein Eintrag für «${s.q}» gefunden.`, {
      hint: 'Passen Sie Ihre Suche an.',
      action: { label: 'Suche zurücksetzen', href: hrefFor(s, {}) },
    });
  }
  if (s.tab === 'tabelle') return '<div id="mc-table"></div>';
  if (s.tab === 'diagramm') return landscapeHtml(ctx, s);
  if (s.lvl === 4) return attrOverview(core, s, unit);
  if (s.lvl === 3) return recordOverview(core, C, s, unit);
  return scopeOverview(s, unit);
}

function attrOverview(core, s, unit) {
  const r = s.rec;
  const k = r.kids.find((x) => x.name === s.attr);
  const isRef = r.kind === 'referenz';
  // Show both directions of the attribute-to-field mapping edge.
  const edges = r.kind === 'objekt'
    ? (k.raw.mappings || []).map((m) => {
      const t = core.dataTable(m.tableId) || {};
      return `${esc(t.systemName || '')} · <a href="${esc(links.dataTable(m.tableId))}">${esc(t.displayName || m.tableId)}</a>`
        + ` · <code>${esc(m.field)}</code> ${matchBadge(core, m.match)}`;
    })
    : r.kind === 'tabelle'
      ? core.realisationsForTable(r.id).filter((x) => x.field === k.name)
        .map((x) => `${esc(x.objectName || x.objectId || '')} · <code>${esc(x.attribute)}</code> ${matchBadge(core, x.match)}`)
      : [];
  const linksRows = edges.length
    ? [[r.kind === 'objekt' ? 'Realisiert in' : 'Trägt Attribut', edges.join('<br>')]]
    : [];
  return detailOverview({
    description: k.def,
    facts: [
      ['Kerndaten', [
        [isRef ? 'Schlüssel' : 'Typ', k.type ? `<code>${esc(k.type)}</code>` : '—'],
        isRef ? null : ['Schlüsselrolle', k.key ? badge(k.key, k.key === 'PK' ? 'info' : 'gray', 'sm') : '—'],
        isRef ? null : ['Pflichtangabe', k.required ? 'Pflicht' : 'optional'],
        k.std ? ['Norm-Referenz', esc(k.std)] : null,
        [unit.axis, esc(r.group)],
      ]],
      ['Verantwortung', [
        ['Verantwortung', r.steward ? esc(r.steward) : TODO],
        ...personRows(r.persons),
        ['Geerbt von', `<a href="${esc(hrefFor(s, { attr: '' }))}">${esc(r.name)}</a>`],
      ]],
      ...(linksRows.length ? [['Verknüpfungen', linksRows]] : []),
    ],
  });
}

function recordOverview(core, C, s, unit) {
  const r = s.rec;
  const t = r.raw;
  const dataset = r.kind === 'tabelle' && t.datasetId ? core.dataset(t.datasetId) : null;
  const sourceHref = r.kind === 'tabelle' ? safeLinkUrl(t.sourceUrl) : '';
  const technical = r.kind === 'tabelle' ? [
    ['Führendes System', esc(t.systemName || r.group || '—')],
    t.schemaLabel ? ['Schema',
      `${esc(t.schemaLabel)}<br><span class="small muted"><code>${esc(t.schema)}</code> · ${esc(SCHEMA_TYPE[t.schemaType] || t.schemaType)}</span>`] : null,
    ['Technischer Name', `<code>${esc(t.name)}</code>`],
    ['Art', esc(TABLE_TYPE[t.type] || t.type)],
    dataset ? ['Publiziert als', `<a href="${esc(links.dataset(dataset.id))}">${esc(core.t(dataset.title))}</a>`] : null,
    ...provenanceRows(core, t, { includeSystem: false }),
  ] : [];
  const systemAccessCard = sourceHref ? C.actionCard({
    title: 'Systemzugang',
    items: [{
      type: 'link',
      label: `${t.systemName || hostOf(sourceHref)} öffnen`,
      description: 'Öffnet in einem neuen Fenster.',
      href: sourceHref,
      newWindow: true,
    }],
  }) : '';
  return recordDetailOverview({
    description: r.def,
    facts: [
      ['Kerndaten', [
        r.kind === 'tabelle' ? null : [unit.axis, esc(r.group)],
        ['Status', r.status ? badge(r.status, r.statusVariant || 'gray', 'sm') : TODO],
        [unit.kid, String(r.n)],
        r.kind === 'objekt' && t.standardRef ? ['Norm-Referenz', esc(t.standardRef)] : null,
        t.updated ? ['Stand', esc(formatDate(t.updated))] : null,
        ['ID', `<code>${esc(r.id)}</code>`],
        ...(r.kind === 'objekt' ? provenanceRows(core, t) : []),
      ]],
      ...(technical.length ? [['Technische Angaben', technical]] : []),
    ],
    aside: recordContactAside(core, r, systemAccessCard),
  });
}

function scopeOverview(s, unit) {
  const rows = scopeRows(s);
  const groups = new Set(rows.map((r) => r.group));
  return detailOverview({
    description: s.leaf
      ? `Alle ${unit.nom}, die dem ${unit.axis} «${s.leaf}» zugeordnet sind.`
      : `Alle ${unit.nom} des Katalogs, gegliedert nach ${unit.axisPl}.`,
    facts: [
      ['Kerndaten', [
        s.leaf ? [unit.axis, esc(s.leaf)] : null,
        ['Inhalt', `${rows.length} ${esc(unit.nom)}${s.leaf ? '' : ` in ${groups.size} ${esc(unit.axisPl)}`}`],
        ['Bestandteile', `${rows.reduce((a, r) => a + r.n, 0)} ${esc(unit.kid)}`],
      ]],
      ['Verantwortung', [['Verantwortung', TODO]]],
    ],
  });
}

// Tiles always represent records; only the box grouping changes by scope/axis.
function landscapeBoxes(s) {
  const rows = scopeRows(s);
  const dim = (GROUP_DIMS(s.kind).find((d) => d.value === s.group) || {}).of;
  const scope = s.rec ? `record:${s.rec.id}` : s.leaf ? `leaf:${s.leaf}` : `branch:${s.kind}`;
  const key = (value) => landscapeKey(scope, s.group, value);
  const tile = (r) => ({ label: r.name, href: hrefFor(s, { rec: r, attr: '', leaf: r.group }),
    on: !!(s.rec && s.rec.id === r.id) });
  if (!dim) return [{ key: key('all'), label: 'Alle', count: rows.length, tiles: rows.map(tile) }];
  const by = new Map();
  rows.forEach((r) => {
    const k = String(dim(r) == null ? '' : dim(r)) || '—';
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  });
  return [...by].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'de'))
    .map(([k, mine]) => ({ key: key(k), label: k, count: mine.length, tiles: mine.map(tile) }));
}

function landscapeHtml(ctx, s) {
  return ctx.C.landscape({
    boxes: landscapeBoxes(s),
    isOpen: BOXES.isOpen,
    emptyText: 'In diesem Umfang ist nichts erfasst.',
  });
}

function homeHtml(ctx, s) {
  const { core, C } = ctx;
  // Root search spans all branches instead of searching entry-point cards.
  if (s.q) return '<div id="mc-table"></div>';

  const cards = BRANCHES.map((kind) => {
    const rows = s.rowsFor(kind);
    const u = BRANCH_UNIT[kind];
    if (!s.availableFor(kind)) return C.card({
      title: BRANCH_LABEL[kind], titleTag: 'h2',
      badges: [badge('nicht verfügbar', 'warning', 'sm')],
      desc: `${u.nom} konnten nicht geladen werden (Ladefehler).`,
    });
    const tally = new Map();
    rows.forEach((r) => { const k = r.status || 'noch nicht erfasst';
      tally.set(k, (tally.get(k) || 0) + 1); });
    const detail = [`${rows.reduce((a, r) => a + r.n, 0)} ${u.kid}`,
      ...[...tally].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k}`)].join(' · ');
    return C.card({
      title: BRANCH_LABEL[kind], titleTag: 'h2', href: `${BASE}?kind=${kind}`,
      desc: detail,
      footerInfo: `<strong>${rows.length}</strong> ${esc(u.nom)}`,
      footerAction: C.cardAction(),
    });
  }).join('');

  const recent = BRANCHES.flatMap((kind) => s.rowsFor(kind).map((r) => ({ ...r, kind })))
    .filter((r) => r.updated)
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
    .slice(0, 8);

  const domains = (() => {
    const rows = s.rowsFor('objekt');
    return [...new Set(rows.map((r) => r.group))].sort((a, b) => a.localeCompare(b, 'de'))
      .map((g) => {
        const mine = rows.filter((r) => r.group === g);
        return { name: g, n: mine.length, kids: mine.reduce((a, r) => a + r.n, 0),
          href: `${BASE}?kind=objekt&leaf=${encodeURIComponent(g)}` };
      });
  })();
  const domainsAvailable = s.availableFor('objekt');

  return `<div class="stats">${cards}</div>

    <section class="detail-section">
      <h2 class="detail-section__title">Letzte Änderungen</h2>
      ${C.table({ zebra: true, compact: true, caption: 'Letzte Änderungen im Katalog', rows: recent,
    emptyText: 'Für keinen Eintrag ist ein Änderungsdatum erfasst.',
    columns: [
      { key: 'name', label: 'Name', width: '14rem',
        render: (r) => `<a href="${esc(r.href)}">${esc(r.name)}</a>` },
      { key: 'kind', label: 'Bereich', width: '11rem', render: (r) => esc(BRANCH_LABEL[r.kind]) },
      { key: 'group', label: 'Gruppe', width: '12rem', render: (r) => esc(r.group) },
      { key: 'status', label: 'Status', width: '9rem', render: (r) => (r.status ? esc(r.status) : TODO) },
      { key: 'updated', label: 'Geändert', width: '8rem', nowrap: true,
        render: (r) => esc(formatDate(r.updated)) },
    ] })}
    </section>

    <section class="detail-section">
      <h2 class="detail-section__title">Domänen</h2>
      ${domainsAvailable ? C.table({ zebra: true, compact: true, caption: 'Domänen der Geschäftsobjekte', rows: domains,
    columns: [
      { key: 'name', label: 'Domäne',
        render: (d) => `<a href="${esc(d.href)}">${esc(d.name)}</a>` },
      { key: 'n', label: 'Umfang', width: '14rem',
        render: (d) => `${d.n} Geschäftsobjekte` },
      { key: 'kids', label: 'Bestandteile', width: '14rem',
        render: (d) => `${d.kids} Attribute` },
    ] }) : C.empty('Geschäftsobjekte konnten nicht geladen werden (Ladefehler).', { available: false })}
    </section>`;
}

function mountPane(ctx, s, unit) {
  const { mount, core, C } = ctx;
  const host = mount.querySelector('#mc-table');
  if (!host) return () => {};

  if (s.lvl === 0) {
    const hits = BRANCHES.flatMap((k) => s.rowsFor(k).map((r) => ({ ...r, kind: k })))
      .filter((r) => recordMatches(s.q, r));
    return C.mountDataTable(host, {
      id: 'mc-all', unit: { nom: 'Einträge', dat: 'Einträgen' }, perPage: 25, compact: true, flush: true,
      showSearch: false, showCount: false,
      caption: `Treffer für «${s.q}» im ganzen Katalog`, rows: hits,
      emptyMsg: `Kein Treffer für «${s.q}».`,
      groupBy: (r) => BRANCH_LABEL[r.kind],
      columns: [
        { key: 'name', label: 'Name', width: '14rem',
          render: (r) => `<a href="${esc(r.href)}">${esc(r.name)}</a>` },
        { key: 'group', label: 'Gruppe', width: '12rem', render: (r) => esc(r.group) },
        { key: 'def', label: 'Beschreibung',
          render: (r) => (r.def ? snippet(r.def, s.q, 58) : '<span class="muted">—</span>') },
        { key: 'n', label: 'Bestandteile', width: '9rem', render: (r) => String(r.n) },
      ],
    });
  }

  if (s.lvl >= 3) {
    const r = s.rec;
    const isRef = r.kind === 'referenz';
    return C.mountDataTable(host, {
      id: 'mc-kids', unit: { nom: unit.kid, dat: unit.kid }, perPage: 25, compact: true, flush: true,
      caption: `${unit.kid} von ${r.name}`,
      rows: sortRows(scopeKids(s), s),
      bar: false,
      emptyMsg: s.q ? `Kein Treffer für «${s.q}».` : `Für «${r.name}» ist noch nichts erfasst.`,
      sorts: [
        { value: 'ord', label: 'Reihenfolge', cmp: () => 0 },
        { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
      ],
      columns: [
        { key: 'name', label: isRef ? 'Bezeichnung' : r.kind === 'objekt' ? 'Attribut' : 'Feld', width: '14rem',
          render: (k) => `<a href="${esc(hrefFor(s, { attr: k.name }))}">${esc(k.name)}</a>` },
        { key: 'def', label: 'Beschreibung',
          render: (k) => (k.def ? esc(truncateText(k.def)) : '<span class="muted">—</span>') },
        { key: 'type', label: isRef ? 'Schlüssel' : r.kind === 'objekt' ? 'Werttyp' : 'Datentyp', width: '9rem',
          render: (k) => (k.type ? `<code>${esc(k.type)}</code>` : '<span class="muted">—</span>') },
        ...(isRef ? [] : [{ key: 'key', label: 'Schlüssel', width: '7rem',
          render: (k) => (k.key ? badge(k.key, k.key === 'PK' ? 'info' : 'gray', 'sm')
            : k.required ? '<span class="muted">—</span>' : '<span class="small muted">optional</span>') }]),
      ],
    });
  }

  const rows = scopeRows(s);
  return C.mountDataTable(host, {
    id: 'mc-rows', unit: { nom: unit.nom, dat: unit.dat }, perPage: 25, compact: true,
    bar: false,
    caption: s.leaf ? `${unit.nom} · ${s.leaf}` : `${unit.nom} · alle ${unit.axisPl}`,
    // Use the same grouping as the landscape; inside one group, paginate rows.
    groupBy: (GROUP_DIMS(s.kind).find((d) => d.value === s.group) || {}).of || null,
    rows: sortRows(rows, s),
    emptyMsg: s.q ? `Kein Treffer für «${s.q}».` : 'In diesem Umfang ist kein Eintrag erfasst.',
    columns: [
      { key: 'name', label: 'Name', width: '11rem',
        render: (r) => `<a href="${esc(hrefFor(s, { rec: r, attr: '', leaf: r.group }))}">${esc(r.name)}</a>` },
      ...(s.group === 'achse' || s.leaf ? []
        : [{ key: 'group', label: unit.axis, width: '10rem', render: (r) => esc(r.group) }]),
      { key: 'steward', label: 'Verantwortung', width: '11rem',
        render: (r) => (r.steward ? esc(truncateText(r.steward, 34)) : TODO) },
      { key: 'def', label: 'Beschreibung',
        render: (r) => (r.def ? snippet(r.def, s.q, 95) : '<span class="muted">—</span>') },
      ...(s.kind === 'tabelle' && s.leaf ? []
        : [{ key: 'n', label: unit.kid, width: '6rem', render: (r) => String(r.n) }]),
      { key: 'status', label: 'Status', width: '8rem',
        render: (r) => (r.status ? esc(r.status) : TODO) },
    ],
  });
}
