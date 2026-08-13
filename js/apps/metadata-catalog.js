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
// A domain opens on its landscape: the question there is «what is in this area
// and how big is each piece», which is a looking question. A record opens on its
// parts, which is a reading question.
const DEFAULT_TAB = { 1: 'uebersicht', 2: 'diagramm', 3: 'tabelle', 4: 'uebersicht' };

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
      n: (o.attributes || []).length, raw: o, href: links.businessObject(o.objectId),
      kids: (o.attributes || []).map((a) => ({
        name: a.name, def: a.definition || '', type: VALUE_TYPE[a.type] || a.type,
        key: a.keyRole || '', required: !!a.required, std: a.standardRef || '', raw: a,
      })),
    }));
  }
  if (kind === 'tabelle') {
    return core.dataTables().map((t) => ({
      kind: 'tabelle', id: t.tableId, name: t.displayName || t.name, group: t.systemName || '—',
      def: t.description || '', status: TABLE_TYPE[t.type] || t.type || '',
      steward: stewardName(core, t.steward), persons: t.responsiblePersons || [],
      n: (t.fields || []).length, raw: t, href: links.dataTable(t.tableId),
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
      def: `Kontrollierte Werteliste; jeder Wert unten ist genau einmal vergeben.`,
      // Verantwortung, Status und Freigabe gehören hierher. Das Datenmodell führt
      // sie noch nicht (docs/data-model.md), deshalb bleiben die Felder sichtbar leer
      // statt weggelassen — die Lücke soll auffallen, nicht verschwinden.
      status: '', steward: '', persons: [],
      n: vals.length, raw: { key: k, values: vals }, href: `${BASE}?list=${encodeURIComponent(k)}`,
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
  return { kind, rows, leaf, rec, attr, lvl, tab, pick, avail, missing: !!picked && !rec };
}

// A link that changes one part of the scope and leaves the rest — in particular
// the chosen tab — exactly where it was.
function hrefFor(s, patch) {
  const n = { kind: s.kind, leaf: s.leaf, rec: s.rec, attr: s.attr, pick: s.pick, ...patch };
  const p = new URLSearchParams();
  if (n.rec) {
    p.set(n.rec.kind === 'objekt' ? 'id' : n.rec.kind === 'tabelle' ? 'table' : 'list', n.rec.id);
    if (n.attr) p.set('attr', n.attr);
  } else {
    if (n.kind) p.set('kind', n.kind);
    if (n.leaf) p.set('leaf', n.leaf);
  }
  if (n.pick) p.set('tab', n.pick);
  const s2 = p.toString();
  return s2 ? `${BASE}?${s2}` : BASE;
}

// --- Route -------------------------------------------------------------------

export default async function render(ctx) {
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

  const unit = BRANCH_UNIT[s.kind] || BRANCH_UNIT.objekt;
  const here = s.attr || (s.rec && s.rec.name) || s.leaf || (s.kind && BRANCH_LABEL[s.kind]) || '';
  setTitle(here ? `${here} — ${TITLE}` : TITLE);
  // Only the current scope goes into the trail; the tree carries the path.
  setCrumbs(trail(APPLICATIONS, { label: TITLE, href: BASE }, ...(here ? [{ label: here }] : [])));

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({ title: TITLE,
    lead: 'Fachbegriffe des BBL, ihre Realisierung in den Führungssystemen, und die Wertelisten, auf die beide verweisen.' })}
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
        <div id="mc-panel"${s.lvl === 0 ? '' : ' class="tab__container" role="tabpanel" tabindex="0"'}
          >${paneHtml(ctx, s, unit)}</div>
      </div>
    </div>
  </div>`;

  mountPane(ctx, s, unit);
  wireTree(mount);

  // The pane is redrawn in place for anything that changes only the pane. `cur`
  // is what it is currently showing, so a landscape click after a tab switch
  // acts on the tab the reader is actually looking at.
  let cur = s;
  const panel = mount.querySelector('#mc-panel');
  const redraw = () => {
    panel.innerHTML = paneHtml(ctx, cur, unit);
    mountPane(ctx, cur, unit);
  };

  // Folding a box is a view preference, not a scope change, so it stays out of
  // the URL — the same reasoning as the tree's chevrons.
  panel.addEventListener('click', (e) => {
    const all = e.target.closest('[data-lscape-all]');
    if (all) {
      const shut = all.dataset.lscapeAll === 'shut';
      panel.querySelectorAll('[data-box]').forEach((b) => OPEN.set(`box:${b.dataset.box}`, !shut));
      redraw();
      // Keep the reader on the control they pressed; redraw() replaced it.
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

// --- Tree --------------------------------------------------------------------

// Three branches, four levels. Depth comes from the nesting of .pf-tree__children
// (css/sections/explorer.css), so no level needs a class of its own.
//
// A record row splits into two controls because selecting and unfolding are two
// different intentions: a data table can carry 75 fields, and dropping them into
// the sidebar on every click buries the tree. The link picks the record, the
// chevron opens it. Every other row navigates and unfolds in one move, because
// there the branch below IS what was asked for.
function treeHtml(ctx, s) {
  const { core, C } = ctx;
  const CHEV = C.icon('ChevronRight', 'pf-tree__chev');
  const GAP = '<span class="pf-tree__chev--empty" aria-hidden="true"></span>';
  const label = (text, n) => `<span class="pf-tree__label">${esc(text)}</span>`
    + (n == null ? '' : `<span class="pf-tree__n">${n}</span>`);

  const attrRows = (r, kind, group) => r.kids.map((k) => `
    <li class="pf-tree__item"><a class="pf-tree__sub" href="${esc(hrefFor(s, { rec: r, attr: k.name, kind, leaf: group }))}"
      ${s.attr === k.name ? ' aria-current="true"' : ''}>${GAP}${label(k.name, null)}</a></li>`).join('');

  const recRows = (mine, kind, group) => mine.map((r) => {
    const on = s.rec && s.rec.id === r.id;
    // An attribute in scope forces its parent open — the selection has to be visible.
    const open = on && (!!s.attr || isOpen(`rec:${r.id}`, false));
    return `<li class="pf-tree__item">
      <span class="pf-tree__split${on && !s.attr ? ' is-active' : on ? ' is-path' : ''}">
        <button type="button" class="pf-tree__fold" data-fold="rec:${esc(r.id)}" aria-expanded="${open}"
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
function wireTree(mount) {
  const side = mount.querySelector('.pf-sidebar');
  if (!side) return;
  side.addEventListener('click', (e) => {
    const fold = e.target.closest('.pf-tree__fold');
    if (!fold) return;
    e.preventDefault();
    const list = fold.closest('.pf-tree__item').querySelector('.pf-tree__children');
    const open = fold.getAttribute('aria-expanded') !== 'true';
    fold.setAttribute('aria-expanded', String(open));
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
  if (s.lvl === 0) return homeHtml(ctx);
  if (s.tab === 'tabelle') return '<div id="mc-table"></div>';
  if (s.tab === 'diagramm') return landscapeHtml(ctx, s, unit);
  if (s.lvl === 4) return attrOverview(core, s, unit);
  if (s.lvl === 3) return recordOverview(core, C, s, unit);
  return scopeOverview(s, unit);
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
  const rows = s.rows.filter((r) => !s.leaf || r.group === s.leaf);
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
function landscapeHtml(ctx, s, unit) {
  const { C } = ctx;
  const CHEV = C.icon('ChevronRight', 'lscape__chev');
  const rows = s.rows.filter((r) => !s.leaf || r.group === s.leaf);

  const boxes = s.leaf
    // Inside a domain: each record is a box, its parts are the tiles.
    ? rows.map((r) => ({
      key: `rec:${r.id}`, label: r.name, count: r.n, href: hrefFor(s, { rec: r, attr: '' }),
      note: r.status,
      tiles: r.kids.map((k) => ({
        label: k.name, meta: k.type || '', href: hrefFor(s, { rec: r, attr: k.name }),
        on: s.rec && s.rec.id === r.id && s.attr === k.name,
      })),
    }))
    // On a branch: each axis value is a box, the records are the tiles.
    : [...new Set(rows.map((r) => r.group))].sort((a, b) => a.localeCompare(b, 'de')).map((g) => {
      const mine = rows.filter((r) => r.group === g);
      return {
        key: `grp:${g}`, label: g, count: mine.length, href: hrefFor(s, { leaf: g, rec: null, attr: '' }),
        note: `${mine.reduce((a, r) => a + r.n, 0)} ${unit.kid}`,
        tiles: mine.map((r) => ({
          label: r.name, meta: `${r.n} ${unit.kid}`, href: hrefFor(s, { rec: r, attr: '', leaf: g }),
          on: s.rec && s.rec.id === r.id,
        })),
      };
    });

  // The toolbar offers exactly one thing, and its label states what pressing it
  // WILL do — «Alle aufklappen» when things are shut, not a mode name.
  const anyOpen = boxes.some((b) => isOpen(`box:${b.key}`, true));
  const bar = `<div class="lscape-bar">
    <button type="button" class="btn btn--outline btn--sm btn--icon-left" data-lscape-all="${anyOpen ? 'shut' : 'open'}">
      ${C.icon(anyOpen ? 'Minus' : 'Plus', 'btn__icon')}
      <span class="btn__text">Alle ${anyOpen ? 'zuklappen' : 'aufklappen'}</span></button></div>`;

  if (!boxes.length) return `${bar}<p class="lscape__empty">In diesem Umfang ist nichts erfasst.</p>`;

  return bar + `<div class="lscape">${boxes.map((b) => {
    const open = isOpen(`box:${b.key}`, true);
    return `<section class="lscape__group">
      <h3 class="lscape__head"><button type="button" class="lscape__toggle" data-box="${esc(b.key)}"
        aria-expanded="${open}">${CHEV}<span>${esc(b.label)}</span>
        <span class="lscape__n">${b.count}</span>
        <span class="lscape__note">${esc(b.note)}</span></button></h3>
      ${!open ? '' : b.tiles.length
    ? `<ul class="lscape__tiles">${b.tiles.map((t) => `<li><a class="lscape__tile${t.on ? ' is-active' : ''}"
          href="${esc(t.href)}"${t.on ? ' aria-current="true"' : ''}>
          <span class="lscape__tile-name">${esc(t.label)}</span>
          <span class="lscape__tile-meta">${esc(t.meta)}</span></a></li>`).join('')}</ul>`
    : `<p class="lscape__empty">Für «${esc(b.label)}» ist nichts erfasst.</p>`}
    </section>`;
  }).join('')}</div>`;
}

// The catalogue root has no tabs, because it is not a scope: it is the way in.
function homeHtml(ctx) {
  const { core } = ctx;
  return `<div class="grid grid--responsive-cols-3">${BRANCHES.map((kind) => {
    const rows = records(core, kind);
    const u = BRANCH_UNIT[kind];
    const groups = new Set(rows.map((r) => r.group)).size;
    return `<a class="card card--default card--clickable" href="${BASE}?kind=${kind}">
      <div class="card__body">
        <h2 class="card__title">${esc(BRANCH_LABEL[kind])}</h2>
        <p class="card__text">${rows.length} ${esc(u.nom)} in ${groups} ${esc(u.axisPl)}<br>
        ${rows.reduce((a, r) => a + r.n, 0)} ${esc(u.kid)}</p>
      </div></a>`;
  }).join('')}</div>`;
}

// --- Tabelle tab -------------------------------------------------------------

// mountDataTable brings the portal's own search, sorting, facets and pagination,
// so none of that is rebuilt here. Levels 1 and 2 list records; level 3 lists the
// record's own parts, where paging matters most — a table can carry 75 fields.
function mountPane(ctx, s, unit) {
  const { mount, core, C } = ctx;
  const host = mount.querySelector('#mc-table');
  if (!host) return;

  if (s.lvl >= 3) {
    const r = s.rec;
    const isRef = r.kind === 'referenz';
    ctx.onUnmount(C.mountDataTable(host, {
      id: 'mc-kids', unit: { nom: unit.kid, dat: unit.kid }, perPage: 25,
      caption: `${unit.kid} von ${r.name}`, rows: r.kids,
      searchKeys: ['name', 'def', 'type'],
      emptyMsg: `Für «${r.name}» ist noch nichts erfasst.`,
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

  const rows = s.rows.filter((r) => !s.leaf || r.group === s.leaf);
  ctx.onUnmount(C.mountDataTable(host, {
    id: 'mc-rows', unit: { nom: unit.nom, dat: unit.dat }, perPage: 25,
    caption: s.leaf ? `${unit.nom} · ${s.leaf}` : `${unit.nom} · alle ${unit.axisPl}`,
    // A whole branch listed flat is a wall — nineteen business objects across
    // five domains read as nineteen unrelated rows. Sectioning by the axis is
    // the same grouping the tree draws, so the two views agree. Inside ONE group
    // there is nothing left to section by, so level 2 goes back to plain pages.
    groupBy: s.leaf ? null : { key: 'group' },
    rows, searchKeys: ['name', 'def', 'group', 'steward'],
    emptyMsg: 'In diesem Umfang ist kein Eintrag erfasst.',
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
      // No axis column: at level 1 the section headers already carry it, and at
      // level 2 every row shares the one value the tree is already showing.
      { key: 'steward', label: 'Verantwortung', width: '11rem',
        render: (r) => (r.steward ? esc(truncateText(r.steward, 34)) : TODO) },
      { key: 'def', label: 'Beschreibung',
        render: (r) => (r.def ? esc(truncateText(r.def, 58)) : '<span class="muted">—</span>') },
      { key: 'n', label: unit.kid, width: '6rem', render: (r) => String(r.n) },
      { key: 'status', label: 'Status', width: '8rem',
        render: (r) => (r.status ? esc(r.status) : TODO) },
    ],
  }));
}
