import { APPLICATIONS, trail } from '../crumbs.js';
import { formatDate } from '../format.js';
// Data-governance catalogue for the real-estate domain.
//
// The tree decides the SCOPE, the tabs decide the PRESENTATION, and the two are
// orthogonal: a click in the tree never changes the tab, and a tab never
// changes what is in scope. Both live in the query string, so every view is
// linkable. Levels are the model, not a layout:
//
//   0  Katalog        Startseite — keine Reiter, sie ist kein Umfang
//   1  Ast            Geschäftsobjekte · Systeme · Referenzdaten
//   2  Domäne/System  die Gruppe innerhalb des Astes
//   3  Datensatz      früher eine eigene Seite, jetzt «Übersicht auf Stufe 3»
//   4  Attribut/Feld  nur Übersicht — darunter liegt nichts mehr
//
// ?id= and ?table= keep their meaning as the level-3 selector, so every link
// already shared from the search index (js/links.js) still resolves.
import * as links from '../links.js';
// Reuse one module-level escape helper and badge factory across all views.
import { escape as esc, badge } from '../components.js';
import { classifyUrl, newWindowAttrs, safeLinkUrl } from '../security/urls.js';

// contacts supplies stewardship for both layers.
export const needs = ['businessObjects', 'dataTables', 'contacts'];

const BASE = '#/app/metadata-catalog';
// The catalogue covers the real-estate domain, not the complete office. Keep
// its single title source for document title, breadcrumb, heading, and back links.
const TITLE = 'Metadaten Katalog Bauten';

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

// Truncate sentence-length definitions in table cells; the overview keeps the full text.
const truncateText = (s, n = 110) => {
  const t = String(s || '').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 20)).trimEnd() + '…';
};

// Shared lookups.
const refList = (core, key) => core.ref()[key] || [];
const domainOf = (core, key) => core.dataDomains().find((d) => d.key === key) || {};
const domainLabel = (core, key) => domainOf(core, key).label || key;
const statusOf = (core, id) => refList(core, 'objectStatuses').find((s) => s.id === id) || { label: id, variant: 'gray' };
// Both halves of this app are directory entries over something else — a business
// object over the architecture repository, a table over its source system — so
// both get the same box, resolved through the same reference list.
const sourceBoxFor = (core, C, record) =>
  C.sourceBox(record.source, refList(core, 'sourceRoles').find((r) => r.key === (record.source || {}).role));
// Stewardship is stored as a contact id; every surface that shows it shows the
// name. One resolver, so the table, the overview and the landscape agree.
const stewardName = (core, id) =>
  (core.contacts().find((c) => c.contactId === id) || {}).name || '';
const matchOf = (core, id) => refList(core, 'mappingMatches').find((m) => m.id === id) || { label: id, variant: 'gray' };
// Return a source URL's hostname, or the original malformed value so bad raw data remains visible.
const hostOf = (url) => { try { return new URL(url).host; } catch { return String(url || ''); } };
// Store explicit tree expansion choices at module scope because hash changes
// rebuild the page but not the module. Without a choice, a record stays folded.
// exportTable needs the data at level 0, where it has no scope to read it from.
// Set on every render; the module outlives the page but never predates it.
let core0 = null;
const OPEN = new Map();
const isOpen = (key, fallback) => (OPEN.has(key) ? OPEN.get(key) : fallback);

// Put exact/near/partial explanations on each value instead of a distant shared legend.
const MATCH_HINT = {
  exact: 'Exakt — Feldinhalt und Begriff sind deckungsgleich.',
  close: 'Nahe — inhaltlich dasselbe, aber mit abweichender Kodierung oder Einheit.',
  partial: 'Teilweise — das Feld deckt nur einen Teil des Begriffs ab.',
};
const matchBadge = (core, id) => {
  const m = matchOf(core, id);
  return `<span title="${esc(MATCH_HINT[id] || m.label)}">${badge(m.label, m.variant, 'sm')}</span>`;
};

// --- The model ---------------------------------------------------------------

const TAB_LABEL = { uebersicht: 'Übersicht', diagramm: 'Diagramm', tabelle: 'Tabelle' };
// Not every level offers every tab. A record has no landscape of its own — its
// parts are a list, not a territory — and an attribute has nothing below it at all.
const TABS_AT = (lvl) => (lvl === 0 ? [] : lvl >= 4 ? ['uebersicht']
  : lvl === 3 ? ['uebersicht', 'tabelle'] : ['uebersicht', 'diagramm', 'tabelle']);
// Each level opens on the tab that answers its own question. A default only
// holds until the reader picks a tab; from then on their choice travels with
// them through the whole tree.
// A branch and a domain both open on their landscape: the question at both is
// «what is in here and how big is each piece», which is a looking question —
// and arriving from the menu is exactly that moment (Nutzerentscheid,
// 2026-08-14: «most people want to see the diagram when being forwarded from the
// nav dropdown»). A record opens on its parts, which is a reading question, and
// an attribute has only the one tab.
const DEFAULT_TAB = { 1: 'diagramm', 2: 'diagramm', 3: 'tabelle', 4: 'uebersicht' };

const BRANCHES = ['objekt', 'tabelle', 'referenz'];
const BRANCH_LABEL = { objekt: 'Geschäftsobjekte', tabelle: 'Systeme', referenz: 'Referenzdaten' };
// Symbols on the branch rows and nowhere else: at level 1 they distinguish three
// things that are read as one list, further down they would only add noise to
// rows that already sit under a labelled parent.
const BRANCH_ICON = { objekt: 'Apps', tabelle: 'Database', referenz: 'List' };
// nom/dat feed the data table's own counting wording; kid names the level below;
// axis names the grouping level, which is a different thing in each branch.
const BRANCH_UNIT = {
  objekt: { nom: 'Geschäftsobjekte', dat: 'Geschäftsobjekten', kid: 'Attribute', axis: 'Domäne', axisPl: 'Domänen' },
  tabelle: { nom: 'Datentabellen', dat: 'Datentabellen', kid: 'Felder', axis: 'System', axisPl: 'Systemen' },
  referenz: { nom: 'Wertelisten', dat: 'Wertelisten', kid: 'Werte', axis: 'Thema', axisPl: 'Themen' },
};

// A query narrows the scope the same way the tree does, so it belongs in the URL
// beside it — and it applies to every tab, because it is not a property of any
// one of them. It is deliberately NOT carried along a tree click: choosing a new
// scope starts unfiltered, or a reader would wonder where the records went.
const matches = (q, ...fields) => {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => String(f == null ? '' : f).toLowerCase().includes(needle));
};
const scopeRows = (s) => s.rows.filter((r) => (!s.leaf || r.group === s.leaf)
  && matches(s.q, r.name, r.def, r.group, r.steward, r.status));
const scopeKids = (s) => (s.rec ? s.rec.kids : [])
  .filter((k) => matches(s.q, k.name, k.def, k.type));

// What the field says depends on what it would narrow, because «Suchen…» over a
// tree of five thousand records tells a reader nothing about what they are about
// to search.
function searchScope(s) {
  const u = BRANCH_UNIT[s.kind];
  if (s.lvl === 0) return { label: 'Im ganzen Katalog suchen', dead: false };
  if (s.lvl >= 4) return { label: 'Auf dieser Stufe gibt es nichts zu durchsuchen', dead: true };
  if (s.lvl === 3) return { label: `${u.kid} in «${s.rec.name}» suchen`, dead: false };
  if (s.lvl === 2) return { label: `In ${s.leaf} suchen`, dead: false };
  return { label: `In ${BRANCH_LABEL[s.kind]} suchen`, dead: false };
}

// Grouping is a property of the PRESENTATION, and both presentations share it:
// it draws the boxes in the landscape and the sections in the table. One choice,
// two views, which is what makes the two comparable at a glance.
//
// «keine» is a real option, not the absence of one: on a branch it collapses the
// landscape into a single field of every record, and it hands the table back to
// paging.
const GROUP_DIMS = (kind) => {
  const dims = [{ value: 'achse', label: BRANCH_UNIT[kind].axis, of: (r) => r.group }];
  // Reference lists carry neither stewardship nor status yet (docs/data-model.md),
  // so offering to group by them would offer a single «noch nicht erfasst» box.
  if (kind !== 'referenz') {
    dims.push({ value: 'verantwortung', label: 'Verantwortung', of: (r) => r.steward || 'noch nicht erfasst' });
    dims.push({ value: 'status', label: 'Status', of: (r) => r.status || 'noch nicht erfasst' });
  }
  dims.push({ value: 'keine', label: 'keine', of: null });
  return dims;
};
// On a branch the axis is the only division there is, so it is the opening one.
// Inside one axis value it would produce a single box, so there it starts at none.
const DEFAULT_GROUP = (lvl) => (lvl === 1 ? 'achse' : 'keine');

// The value lists the portal actually keeps, grouped by subject so the third
// branch has the same three levels as the other two.
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

// One shape for every record, whatever branch it came from, so the tree, the
// tables and the overview do not each need three code paths.
function records(core, kind) {
  if (kind === 'objekt') {
    return core.businessObjects().map((o) => ({
      kind: 'objekt', id: o.objectId, name: o.name, group: domainLabel(core, o.domain),
      def: o.definition || '', status: statusOf(core, o.status).label,
      steward: stewardName(core, o.steward), persons: o.responsiblePersons || [],
      n: (o.attributes || []).length, updated: o.updated || '',
      raw: o, href: links.businessObject(o.objectId),
      kids: (o.attributes || []).map((a) => ({
        name: a.name, def: a.definition || '', type: VALUE_TYPE[a.type] || a.type,
        key: a.keyRole || '', required: !!a.required, std: a.standardRef || '', raw: a,
      })),
    }));
  }
  if (kind === 'tabelle') {
    return core.dataTables().map((t) => ({
      kind: 'tabelle', id: t.tableId, name: t.displayName || t.name, group: t.systemName || '—',
      def: t.description || '', status: t.certified ? 'Zertifiziert' : 'Nicht zertifiziert',
      steward: stewardName(core, t.steward), persons: t.responsiblePersons || [],
      n: (t.fields || []).length, updated: t.updated || '',
      raw: t, href: links.dataTable(t.tableId),
      kids: (t.fields || []).map((f) => ({
        name: f.name, def: f.description || '', type: f.dataType || f.type || '',
        key: f.primaryKey ? 'PK' : f.foreignKey ? 'FK' : '', required: !f.nullable, std: '', raw: f,
      })),
    }));
  }
  return REF_THEMES.flatMap(([theme, keys]) => keys.map((k) => {
    const vals = refList(core, k);
    return {
      kind: 'referenz', id: k, name: REF_LABEL[k] || k, group: theme,
      // Beschreibung, Verantwortung, Status und Freigabe gehören hierher. Das
      // Datenmodell führt sie noch nicht (docs/data-model.md), deshalb bleiben die
      // Felder sichtbar leer statt weggelassen — die Lücke soll auffallen, nicht
      // verschwinden, und erfundener Fülltext hätte die Suche belogen.
      def: '',
      status: '', steward: '', persons: [],
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

// Each branch resolves an id through core's own accessor. A value list has no
// accessor of its own — its key IS the reference-list key — so membership in the
// curated themes above is what makes it exist.
const RESOLVE = {
  objekt: (core, id) => core.businessObject(id),
  tabelle: (core, id) => core.dataTable(id),
  referenz: (core, id) => (REF_LABEL[id] && refList(core, id) ? { key: id } : null),
};

// Everything the views need, derived once from the query string. Every part of
// the path is checked against the data: a query naming a record or an attribute
// that does not exist must never reach the renderer.
function readState(ctx) {
  const { query: qs, core } = ctx;
  const kindParam = qs.get('kind');
  // The record selector doubles as the branch: an ?id= link from the search
  // index carries no kind, and inferring it beats asking every caller to add one.
  const picked = qs.get('id') ? ['objekt', qs.get('id')]
    : qs.get('table') ? ['tabelle', qs.get('table')]
      : qs.get('list') ? ['referenz', qs.get('list')] : null;
  const kind = picked ? picked[0] : (BRANCHES.includes(kindParam) ? kindParam : '');
  const rows = kind ? records(core, kind) : [];
  // Existence goes through core's own id accessors: they are the single
  // definition of «does this record exist», and routing them through the query
  // value keeps the once-decoded guarantee (test-router-lifecycle) enforced by a
  // real call rather than by inspection. records() above is only a view model.
  const raw = picked ? RESOLVE[kind](core, picked[1]) : null;
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
  // Same shape as the tab: an explicit choice wins and travels, a default only
  // holds until one is made.
  const q = (qs.get('q') || '').trim();
  const dims = kind ? GROUP_DIMS(kind) : [];
  const groupPick = dims.some((d) => d.value === qs.get('group')) ? qs.get('group') : '';
  const group = groupPick || DEFAULT_GROUP(lvl);
  return { kind, rows, leaf, rec, attr, lvl, tab, pick, avail, group, groupPick, q,
    missing: !!picked && !rec };
}

// A link that changes one part of the scope and leaves the rest — in particular
// the chosen tab — exactly where it was.
function hrefFor(s, patch) {
  const n = { kind: s.kind, leaf: s.leaf, rec: s.rec, attr: s.attr, pick: s.pick,
    groupPick: s.groupPick, ...patch };
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
  const s2 = p.toString();
  return s2 ? `${BASE}?${s2}` : BASE;
}

// --- Route -------------------------------------------------------------------

export default async function render(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  core0 = ctx.core;
  const s = readState(ctx);

  // A named record that does not resolve is a broken link, not an empty page.
  if (s.missing) {
    return C.renderNotFound(ctx, {
      thing: 'Dieser Eintrag', title: 'Eintrag nicht gefunden',
      backHref: BASE, backLabel: TITLE,
      crumbs: trail(APPLICATIONS, { label: TITLE, href: BASE }),
    });
  }

  const unit = BRANCH_UNIT[s.kind] || BRANCH_UNIT.objekt;
  const here = s.attr || (s.rec && s.rec.name) || s.leaf || (s.kind && BRANCH_LABEL[s.kind]) || '';
  setTitle(here ? `${here} — ${TITLE}` : TITLE);
  // Only the current scope goes into the trail; the tree carries the path.
  setCrumbs(trail(APPLICATIONS, { label: TITLE, href: BASE }, ...(here ? [{ label: here }] : [])));

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({ title: TITLE,
    lead: 'Fachbegriffe des BBL, ihre Realisierung in den Führungssystemen, und die Wertelisten, auf die beide verweisen.' })}
    ${searchBarHtml(ctx, s)}
    <div class="pf-layout">
      <aside class="pf-sidebar" aria-label="Katalog durchsuchen">
        <div class="pf-sidebar__head"><h2 class="pf-sidebar__title">Katalog</h2></div>
        ${treeHtml(ctx, s)}
      </aside>
      <div class="pf-main">
        ${s.lvl === 0 ? '' : `<div class="tabs">${C.tabBar({
    items: s.avail.map((k) => ({ id: k, label: TAB_LABEL[k] })),
    active: s.tab, idPrefix: 'mc-tab', ariaLabel: 'Darstellung', panelId: 'mc-panel',
  })}</div>`}
        ${/* .tab__container carries the ONE gap between strip and panel that the
              whole portal uses (tabs.css); the root has no strip, so no class. */''}
        ${/* .mc-pane carries the catalogue's density (css/sections/landscape.css);
              .tab__container carries the ONE gap between strip and panel that the
              whole portal uses (tabs.css). The root has no strip, so no container. */''}
        <div id="mc-panel" class="mc-pane${s.lvl === 0 ? '' : ' tab__container'}"${
  s.lvl === 0 ? '' : ' role="tabpanel" tabindex="0"'}>${paneHtml(ctx, s, unit)}</div>
      </div>
    </div>
  </div>`;

  mountPane(ctx, s, unit);
  wireTree(mount, ctx, s);

  // The pane is redrawn in place for anything that changes only the pane. `cur`
  // is what it is currently showing, so a landscape click after a tab switch
  // acts on the tab the reader is actually looking at.
  let cur = s;
  const panel = mount.querySelector('#mc-panel');
  const redraw = () => {
    panel.innerHTML = paneHtml(ctx, cur, unit);
    mountPane(ctx, cur, unit);
    wireActions();
  };

  // Typing rewrites the URL in place rather than pushing history: a query is a
  // refinement of where the reader already is, not a new destination.
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
      const count = mount.querySelector('#mc-q-count');
      if (count) count.innerHTML = searchCount(cur);
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(apply, 250); });
    input.closest('form').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); apply(); });
    ctx.onUnmount(() => clearTimeout(timer));
  }

  // On a tab WITHOUT a data table nothing re-wires the menus, so they are wired
  // here after every redraw. On the Tabelle tab the table owns them through
  // onAction; wiring them twice there would fire every choice twice.
  const wireActions = () => {
    if (!panel.querySelector('#mc-table')) C.wireMenu(panel, (a) => onMenuAction(a, cur, unit));
  };
  wireActions();

  // Every control now lives inside the pane, so one delegated listener covers
  // them all — through the data table's own redraws as well.
  //
  // Folding stays out of the URL — a view preference, not a scope change, the
  // same reasoning as the tree's chevrons.
  panel.addEventListener('click', (e) => {
    const all = e.target.closest('[data-lscape-all]');
    if (all) {
      const shut = all.dataset.lscapeAll === 'shut';
      landscapeBoxes(cur).forEach((b) => OPEN.set(`box:${b.key}`, !shut));
      redraw();
      const again = panel.querySelector('[data-lscape-all]');
      if (again) again.focus();
      return;
    }
    const box = e.target.closest('[data-box]');
    if (!box) return;
    const key = `box:${box.dataset.box}`;
    OPEN.set(key, !isOpen(key, true));
    redraw();
    const again = panel.querySelector(`[data-box="${CSS.escape(box.dataset.box)}"]`);
    if (again) again.focus();
  });

  // Tabs change the presentation only, so the panel is swapped in place rather
  // than the route re-run: the tree keeps its scroll position and its focus.
  if (s.lvl > 0) {
    C.wireTabs(mount, {
      onSelect: (tab) => {
        const p = new URLSearchParams(location.hash.split('?')[1] || '');
        if (tab === DEFAULT_TAB[s.lvl]) p.delete('tab'); else p.set('tab', tab);
        const str = p.toString();
        history.replaceState(history.state, '', str ? `${BASE}?${str}` : BASE);
        cur = { ...s, tab, pick: tab === DEFAULT_TAB[s.lvl] ? '' : tab };
        redraw();
      },
    });
  }
}

// The count is the field's feedback, and it has to be there on every tab —
// «Übersicht» lists nothing, so without it a reader typing there gets no sign
// that anything happened at all.
function searchCount(s) {
  if (s.lvl >= 4 || s.lvl === 0) return '';
  const u = s.lvl === 3 ? { nom: BRANCH_UNIT[s.kind].kid, dat: BRANCH_UNIT[s.kind].kid }
    : BRANCH_UNIT[s.kind];
  const all = s.lvl === 3 ? s.rec.kids : s.rows.filter((r) => !s.leaf || r.group === s.leaf);
  const hit = s.lvl === 3 ? scopeKids(s) : scopeRows(s);
  const n = s.lvl === 3 ? 0 : landscapeBoxes(s).length;
  // The number of sections was the one thing the table's own count added, so it
  // moves here rather than being lost.
  const groups = n > 1 ? ` · ${n} ${n === 1 ? 'Gruppe' : 'Gruppen'}` : '';
  if (!s.q) return `${all.length} ${esc(u.nom)}${groups}`;
  return `<strong>${hit.length}</strong> von ${all.length} ${esc(u.dat)}${groups}`;
}

function searchBarHtml(ctx, s) {
  const { C } = ctx;
  const scope = searchScope(s);
  return `<form class="mc-search" role="search" aria-label="${esc(scope.label)}">
    <label class="sr-only" for="mc-q">${esc(scope.label)}</label>
    <div class="mc-search__field">
      ${C.icon('Search', 'mc-search__icon')}
      <input id="mc-q" type="search" autocomplete="off" value="${esc(s.q)}"
        placeholder="${esc(scope.label)}${scope.dead ? '' : '…'}"${scope.dead ? ' disabled' : ''}>
    </div>
    <p class="mc-search__count" id="mc-q-count">${searchCount(s)}</p>
  </form>`;
}

// --- Export ------------------------------------------------------------------
// What leaves is exactly what the reader can see: the current scope AFTER the
// tree, the search and the grouping. Exporting the whole catalogue from a screen
// showing nine records would be a different thing than the one they asked for.
function exportTable(s, unit) {
  if (s.lvl >= 3) {
    const isRef = s.rec.kind === 'referenz';
    return {
      name: `${s.rec.name} — ${unit.kid}`,
      head: [isRef ? 'Bezeichnung' : s.rec.kind === 'objekt' ? 'Attribut' : 'Feld',
        'Beschreibung', isRef ? 'Schlüssel' : 'Typ', 'Schlüsselrolle', 'Pflichtangabe'],
      rows: scopeKids(s).map((k) => [k.name, k.def, k.type, k.key,
        isRef ? '' : k.required ? 'Pflicht' : 'optional']),
    };
  }
  if (s.lvl === 0) {
    const hits = BRANCHES.flatMap((k) => records(core0, k).map((r) => ({ ...r, kind: k })))
      .filter((r) => matches(s.q, r.name, r.def, r.group, r.steward));
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

// A field is quoted only when it has to be (RFC 4180), and the file opens with a
// BOM because without one Excel reads UTF-8 as the local code page and every
// umlaut in the catalogue comes out wrong.
const csvCell = (v) => {
  const t = String(v == null ? '' : v);
  return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};
const toCsv = (t) => '\uFEFF' + [t.head, ...t.rows]
  .map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';

// Excel gets an HTML table rather than a comma file. A .csv forces a guess about
// the separator — German Excel expects «;», the interchange format says «,» —
// and whichever is chosen is wrong somewhere. A table has no separator to guess.
const toXls = (t) => '<html xmlns:x="urn:schemas-microsoft-com:office:excel">'
  + '<head><meta charset="utf-8"></head><body><table border="1"><thead><tr>'
  + t.head.map((h) => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>'
  + t.rows.map((row) => '<tr>' + row.map((c) => `<td>${esc(c)}</td>`).join('') + '</tr>').join('')
  + '</tbody></table></body></html>';

const slug = (x) => String(x).toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'katalog';

function download(name, mime, text) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next turn: doing it synchronously can cancel the download in
  // some browsers before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Everything in the bar is a menu now, and both report here. A grouping choice
// NAVIGATES rather than redrawing in place: it re-lays both views and every link
// in the tree, and unlike a tab switch it is a rare, deliberate act.
function onMenuAction(action, s, unit) {
  if (!action.startsWith('group:')) { runExport(action, s, unit); return; }
  const value = action.slice('group:'.length);
  location.hash = hrefFor(s, {
    groupPick: value === DEFAULT_GROUP(s.lvl) ? '' : value,
  }).slice(1);
}

function runExport(action, s, unit) {
  // Printing is the browser's job, and its dialog is also where «Save as PDF»
  // lives — so there is no separate PDF path to build or to keep working.
  if (action === 'pdf') { window.print(); return; }
  const t = exportTable(s, unit);
  const base = `metadaten-katalog_${slug(t.name)}`;
  if (action === 'csv') download(`${base}.csv`, 'text/csv;charset=utf-8', toCsv(t));
  if (action === 'excel') download(`${base}.xls`, 'application/vnd.ms-excel;charset=utf-8', toXls(t));
}

// Grouping belongs to the table and the landscape, not to the tree — so it sits
// in the tab row rather than in the sidebar. On level 3 it disappears: ordering
// many records is what it does, and only one record is in scope there.
// ONE control row per pane, never two. The data table brings its own bar
// (Sortieren, Filter), so on that tab these controls are handed to it as `extra`
// and join the same row. Every other tab has no table, so it gets the same bar
// standing on its own — same class, same place, same order, whichever tab the
// reader is on.
function toolbarHtml(ctx, s) {
  const tools = toolsHtml(ctx, s);
  return tools
    ? `<div class="catbar catbar--no-search catbar--flush"><div class="catbar__controls">${tools}</div></div>`
    : '';
}

function toolsHtml(ctx, s) {
  const { C } = ctx;
  if (s.lvl < 1) return '';
  const anyOpen = s.tab === 'diagramm'
    && landscapeBoxes(s).some((b) => isOpen(`box:${b.key}`, true));
  // The label states what pressing it WILL do, not what the state is called.
  const fold = s.tab !== 'diagramm' ? '' : `
    <button type="button" class="btn btn--outline btn--sm btn--icon-left" data-lscape-all="${anyOpen ? 'shut' : 'open'}">
      ${C.icon(anyOpen ? 'Minus' : 'Plus', 'btn__icon')}
      <span class="btn__text">Alle ${anyOpen ? 'zuklappen' : 'aufklappen'}</span></button>`;
  // Grouping orders many records; on a record there is only one, so it goes.
  //
  // A button menu, not a <select> — the same control as «Aktionen» beside it, so
  // the row is one kind of thing rather than two. It also settles two problems
  // the <select> had here: it measured itself against its WIDEST option, so the
  // chosen value drifted away from its own chevron, and it needed a separate
  // word in front of it to say what it was for. The trigger states both at once,
  // which is also how the wireframe reads it.
  const dims = GROUP_DIMS(s.kind);
  const chosen = dims.find((d) => d.value === s.group) || dims[0];
  const group = s.lvl > 2 ? '' : C.menu({
    menuId: 'mc-group', label: 'Gruppieren', triggerLabel: `Gruppieren: ${chosen.label}`,
    items: dims.map((d) => ({ action: `group:${d.value}`, label: d.label })),
  });
  // Order as in the wireframe — fold, then what ARRANGES the pane, then what
  // ACTS on it. On the Tabelle tab the table's own Sortieren and Filter come
  // first in the same row, which puts all the arranging together.
  //
  // No icons on the action rows: three entries that all mean «take this away»
  // would carry two identical download symbols and one printer, which sorts them
  // by nothing. The words already say it.
  const actions = C.menu({
    menuId: 'mc-actions', label: 'Aktionen', triggerLabel: 'Aktionen',
    items: [
      { action: 'csv', label: 'CSV herunterladen' },
      { action: 'excel', label: 'Excel herunterladen' },
      { action: 'pdf', label: 'Als PDF drucken' },
    ],
  });
  // Wrapped as one group. The bar draws a divider before every bare
  // .action-menu that is a direct child of .catbar__controls; these are all
  // bordered buttons, so each already reads as its own control and the lines
  // were a third mark among three boxes. The wrapper keeps the SEPARATION that
  // rule exists for (catbar.css: an export dropdown four pixels from the sort
  // select reads as part of sorting) and drops only the stroke.
  return `<span class="mc-tools">${fold}${group}${actions}</span>`;
}

// --- Tree --------------------------------------------------------------------

// Three branches, four levels. Depth comes from the nesting of .pf-tree__children
// (css/sections/explorer.css), so no level needs a class of its own.
//
// A record row splits into two controls because selecting and unfolding are two
// different intentions: a data table can carry 75 fields, and dropping them into
// the sidebar on every click buries the tree. The link picks the record, the
// chevron opens it. Every other row navigates and unfolds in one move, because
// there the branch below IS what was asked for.
// The rows under a record. Module level, because the chevron builds them too:
// a table can carry seventy-five fields and five of them sit in one system, so
// rendering every list up front would put hundreds of hidden nodes in the
// sidebar for a reader who opens none of them. They are built when asked.
function attrRowsHtml(s, r, kind, group) {
  const GAP = '<span class="pf-tree__chev--empty" aria-hidden="true"></span>';
  return r.kids.map((k) => `
    <li class="pf-tree__item"><a class="pf-tree__sub" href="${esc(hrefFor(s, { rec: r, attr: k.name, kind, leaf: group }))}"
      ${s.attr === k.name ? ' aria-current="true"' : ''}>${GAP}<span class="pf-tree__label">${
  esc(k.name)}</span></a></li>`).join('');
}

function treeHtml(ctx, s) {
  const { core, C } = ctx;
  const CHEV = C.icon('ChevronRight', 'pf-tree__chev');
  const GAP = '<span class="pf-tree__chev--empty" aria-hidden="true"></span>';
  const label = (text, n) => `<span class="pf-tree__label">${esc(text)}</span>`
    + (n == null ? '' : `<span class="pf-tree__n">${n}</span>`);

  const attrRows = (r, kind, group) => attrRowsHtml(s, r, kind, group);

  const recRows = (mine, kind, group) => mine.map((r) => {
    const on = s.rec && s.rec.id === r.id;
    // Folding is the chevron's business and NOTHING else's. It used to require
    // the record to be selected as well, so the chevron of any other record
    // opened an empty list: the toggle flips `hidden` on a list the renderer had
    // filled only for the record in scope. A reader comparing two tables needs
    // both open at once, and neither of them has to be the one selected.
    //
    // The one thing that still forces it open is an attribute in scope — the
    // selection has to be visible.
    const open = (on && !!s.attr) || isOpen(`rec:${r.id}`, false);
    return `<li class="pf-tree__item">
      <span class="pf-tree__split${on && !s.attr ? ' is-active' : on ? ' is-path' : ''}">
        <button type="button" class="pf-tree__fold" data-fold="rec:${esc(r.id)}"
          data-kind="${esc(kind)}" data-leaf="${esc(group)}" aria-expanded="${open}"
          aria-label="${esc(r.name)} ${open ? 'zuklappen' : 'aufklappen'}">${CHEV}</button>
        <a class="pf-tree__go" href="${esc(hrefFor(s, { rec: r, attr: '', kind, leaf: group }))}"
          ${on && !s.attr ? ' aria-current="true"' : ''}>${label(r.name, r.n)}</a>
      </span>
      <ul class="pf-tree__children"${open ? '' : ' hidden'}>${open ? attrRows(r, kind, group) : ''}</ul>
    </li>`;
  }).join('');

  const branches = BRANCHES.map((kind) => {
    const rows = records(core, kind);
    const open = s.kind === kind;
    const groups = [...new Set(rows.map((r) => r.group))].sort((a, b) => a.localeCompare(b, 'de'));
    const kids = !open ? '' : groups.map((g) => {
      const mine = rows.filter((r) => r.group === g);
      const on = s.leaf === g;
      return `<li class="pf-tree__item">
        <a class="pf-tree__leaf${on && !s.rec ? ' is-active' : on ? ' is-path' : ''}" aria-expanded="${on}"
          href="${esc(hrefFor(s, { kind, leaf: g, rec: null, attr: '' }))}"${on && !s.rec ? ' aria-current="true"' : ''}
          >${CHEV}${label(g, mine.length)}</a>
        <ul class="pf-tree__children"${on ? '' : ' hidden'}>${on ? recRows(mine, kind, g) : ''}</ul></li>`;
    }).join('');
    return `<li class="pf-tree__item">
      <a class="pf-tree__node${open && !s.leaf ? ' is-active' : open ? ' is-path' : ''}" aria-expanded="${open}"
        href="${esc(hrefFor(s, { kind, leaf: '', rec: null, attr: '' }))}"${open && !s.leaf ? ' aria-current="true"' : ''}
        >${CHEV}${C.icon(BRANCH_ICON[kind], 'pf-tree__ico')}${label(BRANCH_LABEL[kind], rows.length)}</a>
      <ul class="pf-tree__children"${open ? '' : ' hidden'}>${open ? kids : ''}</ul></li>`;
  }).join('');

  return `<ul class="pf-tree">
    <li class="pf-tree__item"><a class="pf-tree__node${s.lvl === 0 ? ' is-active' : ''}" href="${BASE}"
      ${s.lvl === 0 ? ' aria-current="true"' : ''}>${GAP}${
  label('Katalog', BRANCHES.reduce((a, k) => a + records(core, k).length, 0))}</a></li>
    ${branches}</ul>`;
}

// One delegated listener for the whole sidebar; it dies with the sidebar.
function wireTree(mount, ctx, s) {
  const side = mount.querySelector('.pf-sidebar');
  if (!side) return;
  side.addEventListener('click', (e) => {
    const fold = e.target.closest('.pf-tree__fold');
    if (!fold) return;
    e.preventDefault();
    const list = fold.closest('.pf-tree__item').querySelector('.pf-tree__children');
    const open = fold.getAttribute('aria-expanded') !== 'true';
    fold.setAttribute('aria-expanded', String(open));
    fold.setAttribute('aria-label',
      fold.getAttribute('aria-label').replace(open ? 'aufklappen' : 'zuklappen',
        open ? 'zuklappen' : 'aufklappen'));
    // Build the rows the first time this record is opened. The renderer only
    // fills a list it already knows to be open, so without this the chevron of
    // any other record revealed an empty one.
    if (open && list && !list.children.length) {
      const { kind, leaf } = fold.dataset;
      const id = fold.dataset.fold.slice('rec:'.length);
      const rec = records(ctx.core, kind).find((r) => r.id === id);
      if (rec) list.innerHTML = attrRowsHtml(s, rec, kind, leaf);
    }
    if (list) list.hidden = !open;
    OPEN.set(fold.dataset.fold, open);
  });
}

// --- Panes -------------------------------------------------------------------

// Übersicht is the same three sections at every level — Definition,
// Verantwortlich, Metadaten — so a reader who has understood one has understood
// all of them. Nothing else joins that list (Produktentscheid).
const TODO = badge('noch nicht erfasst', 'warning', 'sm');
const section = (title, body) =>
  `<section class="detail-section"><h2 class="detail-section__title">${esc(title)}</h2>${body}</section>`;
const kv = (rows) => `<dl class="kv kv--ruled">${rows.filter(Boolean)
  .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
// Responsible people are individual AdminDir entries; the steward is a mailbox.
const personRows = (persons) => (persons || []).map((p) => [esc(p.role),
  `<a href="https://admindir.verzeichnisse.admin.ch/person/${encodeURIComponent(p.admindirId)}"
     target="_blank" rel="noopener noreferrer external">AdminDir ${esc(p.admindirId)}</a>`]);

function paneHtml(ctx, s, unit) {
  const { core, C } = ctx;
  if (s.lvl === 0) return homeHtml(ctx, s);
  // The table's own bar carries the controls on that tab (see mountPane), so the
  // pane must not put a second one above it.
  if (s.tab === 'tabelle') return '<div id="mc-table"></div>';
  const bar = toolbarHtml(ctx, s);
  if (s.tab === 'diagramm') return bar + landscapeHtml(ctx, s);
  if (s.lvl === 4) return bar + attrOverview(core, s, unit);
  if (s.lvl === 3) return bar + recordOverview(core, C, s, unit);
  return bar + scopeOverview(s, unit);
}

function attrOverview(core, s, unit) {
  const r = s.rec;
  const k = r.kids.find((x) => x.name === s.attr);
  const isRef = r.kind === 'referenz';
  // Both directions of the same edge: an attribute names where it is realised,
  // a field names the term it carries.
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
  return section('Definition', `<p class="m-0">${k.def ? esc(k.def) : TODO}</p>`)
    + section('Verantwortlich', kv([
      ['Verantwortung', r.steward ? esc(r.steward) : TODO],
      ...personRows(r.persons),
      ['Geerbt von', `<a href="${esc(hrefFor(s, { attr: '' }))}">${esc(r.name)}</a>`],
    ]))
    + section('Metadaten', kv([
      [isRef ? 'Schlüssel' : 'Typ', k.type ? `<code>${esc(k.type)}</code>` : '—'],
      isRef ? null : ['Schlüsselrolle', k.key ? badge(k.key, k.key === 'PK' ? 'info' : 'gray', 'sm') : '—'],
      isRef ? null : ['Pflichtangabe', k.required ? 'Pflicht' : 'optional'],
      k.std ? ['Norm-Referenz', esc(k.std)] : null,
      edges.length ? [r.kind === 'objekt' ? 'Realisiert in' : 'Trägt Attribut', edges.join('<br>')] : null,
      [unit.axis, esc(r.group)],
    ]));
}

function recordOverview(core, C, s, unit) {
  const r = s.rec;
  const t = r.raw;
  const dataset = r.kind === 'tabelle' && t.datasetId ? core.dataset(t.datasetId) : null;
  const sourceHref = r.kind === 'tabelle' ? safeLinkUrl(t.sourceUrl) : '';
  return section('Definition', `<p class="m-0">${r.def ? esc(r.def) : TODO}</p>`)
    + section('Verantwortlich', kv([
      ['Verantwortung', r.steward ? esc(r.steward) : TODO],
      ...personRows(r.persons),
    ]))
    + section('Metadaten', kv([
      [unit.axis, esc(r.group)],
      r.kind === 'tabelle' && t.schemaLabel ? ['Schema',
        `${esc(t.schemaLabel)}<br><span class="small muted"><code>${esc(t.schema)}</code> · ${esc(SCHEMA_TYPE[t.schemaType] || t.schemaType)}</span>`] : null,
      r.kind === 'tabelle' ? ['Technischer Name', `<code>${esc(t.name)}</code>`] : null,
      r.kind === 'tabelle' ? ['Art', esc(TABLE_TYPE[t.type] || t.type)] : null,
      ['Status', r.status ? esc(r.status) : TODO],
      r.kind === 'objekt' && t.standardRef ? ['Norm-Referenz', esc(t.standardRef)] : null,
      [unit.kid, String(r.n)],
      dataset ? ['Publiziert als', `<a href="${esc(links.dataset(dataset.id))}">${esc(core.t(dataset.title))}</a>`] : null,
      sourceHref ? ['Quellsystem',
        `<a href="${esc(sourceHref)}"${newWindowAttrs(sourceHref, { external: classifyUrl(sourceHref) === 'external' })}>${esc(hostOf(sourceHref))}</a>`] : null,
      t.updated ? ['Stand', esc(formatDate(t.updated))] : null,
      ['ID', `<code>${esc(r.id)}</code>`],
    ]))
    + (t.source ? `<div class="detail-section">${sourceBoxFor(core, C, t)}</div>` : '');
}

// Levels 1 and 2 describe a scope rather than a record, so «Definition» states
// what the scope contains and «Metadaten» counts it.
function scopeOverview(s, unit) {
  const rows = scopeRows(s);
  const groups = new Set(rows.map((r) => r.group));
  return section('Definition', `<p class="m-0">${esc(s.leaf
    ? `Alle ${unit.nom}, die dem ${unit.axis} «${s.leaf}» zugeordnet sind.`
    : `Alle ${unit.nom} des Katalogs, gegliedert nach ${unit.axisPl}.`)}</p>`)
    + section('Verantwortlich', kv([['Verantwortung', TODO]]))
    + section('Metadaten', kv([
      s.leaf ? [unit.axis, esc(s.leaf)] : null,
      ['Inhalt', `${rows.length} ${esc(unit.nom)}${s.leaf ? '' : ` in ${groups.size} ${esc(unit.axisPl)}`}`],
      ['Bestandteile', `${rows.reduce((a, r) => a + r.n, 0)} ${esc(unit.kid)}`],
    ]));
}

// --- Diagramm tab ------------------------------------------------------------

// The same scope the table lists, drawn as territory instead of as a sequence.
// Always one level below the scope as BOXES and two levels below as TILES — on a
// branch that is domains holding records, inside a domain it is records holding
// their parts. The picture therefore means the same thing wherever the reader
// is standing, which is what lets them compare two of them.
// A tile is ALWAYS one record — on every level, under every grouping. That is
// what lets a reader compare two landscapes: the unit of the picture never
// changes, only how the field is divided. The boxes come from the grouping, and
// «keine» is one box holding everything.
function landscapeBoxes(s) {
  const rows = scopeRows(s);
  const dim = (GROUP_DIMS(s.kind).find((d) => d.value === s.group) || {}).of;
  const tile = (r) => ({ label: r.name, href: hrefFor(s, { rec: r, attr: '', leaf: r.group }),
    on: !!(s.rec && s.rec.id === r.id) });
  if (!dim) return [{ key: 'alle', label: 'Alle', count: rows.length, tiles: rows.map(tile) }];
  const by = new Map();
  rows.forEach((r) => {
    const k = String(dim(r) == null ? '' : dim(r)) || '—';
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  });
  // Biggest field first: the map reads from the largest territory down.
  return [...by].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'de'))
    .map(([k, mine]) => ({ key: `grp:${k}`, label: k, count: mine.length, tiles: mine.map(tile) }));
}

function landscapeHtml(ctx, s) {
  const { C } = ctx;
  const CHEV = C.icon('ChevronRight', 'lscape__chev');
  const boxes = landscapeBoxes(s);
  if (!boxes.length) return '<p class="lscape__empty">In diesem Umfang ist nichts erfasst.</p>';

  return `<div class="lscape">${boxes.map((b) => {
    const open = isOpen(`box:${b.key}`, true);
    return `<section class="lscape__group">
      <h3 class="lscape__head"><button type="button" class="lscape__toggle" data-box="${esc(b.key)}"
        aria-expanded="${open}">${CHEV}<span>${esc(b.label)}</span>
        <span class="lscape__n">${b.count}</span></button></h3>
      ${!open ? '' : b.tiles.length
    ? `<ul class="lscape__tiles">${b.tiles.map((t) => `<li><a class="lscape__tile${t.on ? ' is-active' : ''}"
          href="${esc(t.href)}"${t.on ? ' aria-current="true"' : ''}>${esc(t.label)}</a></li>`).join('')}</ul>`
    : `<p class="lscape__empty">Für «${esc(b.label)}» ist nichts erfasst.</p>`}
    </section>`;
  }).join('')}</div>`;
}

// The catalogue root has no tabs, because it is not a scope: it is the way in.
// Three figures to say how big the thing is, then the two questions a reader
// actually arrives with: what changed lately, and how is the estate divided.
function homeHtml(ctx, s) {
  const { core, C } = ctx;
  // A query at the root has the whole catalogue as its scope, so it answers with
  // records from all three branches rather than with the way-in page.
  if (s.q) return '<div id="mc-table"></div>';

  const cards = BRANCHES.map((kind) => {
    const rows = records(core, kind);
    const u = BRANCH_UNIT[kind];
    // Tally the statuses rather than naming them: which ones exist is data, and
    // hard-coding «Gültig · Entwurf» here would go stale the first time the
    // reference list gains a value.
    const tally = new Map();
    rows.forEach((r) => { const k = r.status || 'noch nicht erfasst';
      tally.set(k, (tally.get(k) || 0) + 1); });
    const detail = [`${rows.reduce((a, r) => a + r.n, 0)} ${u.kid}`,
      ...[...tally].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k}`)].join(' · ');
    return `<a class="card card--default card--clickable" href="${BASE}?kind=${kind}">
      <div class="card__body">
        <p class="stat__num">${rows.length}</p>
        <h2 class="stat__label">${esc(BRANCH_LABEL[kind])}</h2>
        <p class="card__text">${esc(detail)}</p>
      </div></a>`;
  }).join('');

  // Newest first, across all three branches — «what moved» is a question about
  // the catalogue, not about one of its parts.
  const recent = BRANCHES.flatMap((kind) => records(core, kind).map((r) => ({ ...r, kind })))
    .filter((r) => r.updated)
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
    .slice(0, 8);

  const domains = (() => {
    const rows = records(core, 'objekt');
    return [...new Set(rows.map((r) => r.group))].sort((a, b) => a.localeCompare(b, 'de'))
      .map((g) => {
        const mine = rows.filter((r) => r.group === g);
        return { name: g, n: mine.length, kids: mine.reduce((a, r) => a + r.n, 0),
          href: `${BASE}?kind=objekt&leaf=${encodeURIComponent(g)}` };
      });
  })();

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
      ${C.table({ zebra: true, compact: true, caption: 'Domänen der Geschäftsobjekte', rows: domains,
    columns: [
      { key: 'name', label: 'Domäne',
        render: (d) => `<a href="${esc(d.href)}">${esc(d.name)}</a>` },
      { key: 'n', label: 'Umfang', width: '14rem',
        render: (d) => `${d.n} Geschäftsobjekte` },
      { key: 'kids', label: 'Bestandteile', width: '14rem',
        render: (d) => `${d.kids} Attribute` },
    ] })}
    </section>`;
}

// --- Tabelle tab -------------------------------------------------------------

// mountDataTable brings the portal's own search, sorting, facets and pagination,
// so none of that is rebuilt here. Levels 1 and 2 list records; level 3 lists the
// record's own parts, where paging matters most — a table can carry 75 fields.
function mountPane(ctx, s, unit) {
  const { mount, core, C } = ctx;
  const host = mount.querySelector('#mc-table');
  if (!host) return;

  if (s.lvl === 0) {
    const hits = BRANCHES.flatMap((k) => records(core, k).map((r) => ({ ...r, kind: k })))
      .filter((r) => matches(s.q, r.name, r.def, r.group, r.steward));
    ctx.onUnmount(C.mountDataTable(host, {
      id: 'mc-all', unit: { nom: 'Einträge', dat: 'Einträgen' }, perPage: 25, compact: true, flush: true,
      showSearch: false, showCount: false,
      caption: `Treffer für «${s.q}» im ganzen Katalog`, rows: hits,
      emptyMsg: `Kein Treffer für «${s.q}».`,
      // Grouped by branch: a hit list spanning three kinds of thing is unreadable
      // until it says which kind each row is.
      groupBy: (r) => BRANCH_LABEL[r.kind],
      columns: [
        { key: 'name', label: 'Name', width: '14rem',
          render: (r) => `<a href="${esc(r.href)}">${esc(r.name)}</a>` },
        { key: 'group', label: 'Gruppe', width: '12rem', render: (r) => esc(r.group) },
        { key: 'def', label: 'Beschreibung',
          render: (r) => (r.def ? esc(truncateText(r.def, 58)) : '<span class="muted">—</span>') },
        { key: 'n', label: 'Bestandteile', width: '9rem', render: (r) => String(r.n) },
      ],
    }));
    return;
  }

  if (s.lvl >= 3) {
    const r = s.rec;
    const isRef = r.kind === 'referenz';
    ctx.onUnmount(C.mountDataTable(host, {
      id: 'mc-kids', unit: { nom: unit.kid, dat: unit.kid }, perPage: 25, compact: true, flush: true,
      caption: `${unit.kid} von ${r.name}`, rows: scopeKids(s),
      // The controls join the table's own bar rather than opening a second one.
      // onAction is the table's, so the menu is re-wired after every redraw of
      // its bar — sorting or paging would otherwise leave a dead trigger.
      extra: toolsHtml(ctx, s), onAction: (action) => onMenuAction(action, s, unit),
      // One search field and one count per page: the scope bar above carries
      // both, and it carries them on every tab rather than only on this one.
      showSearch: false, showCount: false,
      emptyMsg: s.q ? `Kein Treffer für «${s.q}».` : `Für «${r.name}» ist noch nichts erfasst.`,
      sorts: [
        { value: 'ord', label: 'Reihenfolge', cmp: () => 0 },
        { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
      ],
      columns: [
        { key: 'name', label: isRef ? 'Bezeichnung' : r.kind === 'objekt' ? 'Attribut' : 'Feld', width: '14rem',
          // Clicking a part selects it, and because ?attr forces its parent open
          // (see treeHtml), the tree follows — which is how a reader reaches
          // level 4 without having to find the chevron first.
          render: (k) => `<a href="${esc(hrefFor(s, { attr: k.name }))}">${esc(k.name)}</a>` },
        { key: 'def', label: 'Beschreibung',
          render: (k) => (k.def ? esc(truncateText(k.def)) : '<span class="muted">—</span>') },
        { key: 'type', label: isRef ? 'Schlüssel' : r.kind === 'objekt' ? 'Werttyp' : 'Datentyp', width: '9rem',
          render: (k) => (k.type ? `<code>${esc(k.type)}</code>` : '<span class="muted">—</span>') },
        ...(isRef ? [] : [{ key: 'key', label: 'Schlüssel', width: '7rem',
          render: (k) => (k.key ? badge(k.key, k.key === 'PK' ? 'info' : 'gray', 'sm')
            : k.required ? '<span class="muted">—</span>' : '<span class="small muted">optional</span>') }]),
      ],
    }));
    return;
  }

  const rows = scopeRows(s);
  ctx.onUnmount(C.mountDataTable(host, {
    id: 'mc-rows', unit: { nom: unit.nom, dat: unit.dat }, perPage: 25, compact: true, flush: true,
    showSearch: false, showCount: false,
    caption: s.leaf ? `${unit.nom} · ${s.leaf}` : `${unit.nom} · alle ${unit.axisPl}`,
    extra: toolsHtml(ctx, s), onAction: (action) => onMenuAction(action, s, unit),
    // A whole branch listed flat is a wall — nineteen business objects across
    // five domains read as nineteen unrelated rows. Sectioning by the axis is
    // the same grouping the tree draws, so the two views agree. Inside ONE group
    // there is nothing left to section by, so level 2 goes back to plain pages.
    groupBy: (GROUP_DIMS(s.kind).find((d) => d.value === s.group) || {}).of || null,
    rows,
    emptyMsg: s.q ? `Kein Treffer für «${s.q}».` : 'In diesem Umfang ist kein Eintrag erfasst.',
    sorts: [
      { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
      { value: 'n', label: `${unit.kid} (meiste zuerst)`, cmp: (a, b) => b.n - a.n },
    ],
    // The axis facet only earns its place while more than one group is in view.
    facets: s.leaf ? [] : [{ dim: 'group', legend: unit.axis,
      options: [...new Set(rows.map((r) => r.group))].sort((a, b) => a.localeCompare(b, 'de'))
        .map((g) => ({ value: g, label: g })),
      match: (r, vals) => vals.includes(r.group) }],
    columns: [
      { key: 'name', label: 'Name', width: '11rem',
        render: (r) => `<a href="${esc(hrefFor(s, { rec: r, attr: '', leaf: r.group }))}">${esc(r.name)}</a>` },
      // The axis column earns its place only when the sections are not already
      // carrying it and more than one value is in scope.
      ...(s.group === 'achse' || s.leaf ? []
        : [{ key: 'group', label: unit.axis, width: '10rem', render: (r) => esc(r.group) }]),
      { key: 'steward', label: 'Verantwortung', width: '11rem',
        render: (r) => (r.steward ? esc(truncateText(r.steward, 34)) : TODO) },
      { key: 'def', label: 'Beschreibung',
        render: (r) => (r.def ? esc(truncateText(r.def, 95)) : '<span class="muted">—</span>') },
      { key: 'n', label: unit.kid, width: '6rem', render: (r) => String(r.n) },
      { key: 'status', label: 'Status', width: '8rem',
        render: (r) => (r.status ? esc(r.status) : TODO) },
    ],
  }));
}
