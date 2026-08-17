import { APPLICATIONS, trail } from '../crumbs.js';
import { loadExternalAssets } from '../core/external-assets.js';
import { formatDate } from '../format.js';
import {
  classifyUrl, newWindowAttrs, safeAssetUrl, safeLinkUrl, safeMailto,
} from '../security/urls.js';
// Process catalogue with URL-addressable scope and views. BPMN diagrams come
// from local assets; the authenticated viewer bundle loads only on demand.
import * as links from '../links.js';
import { escape as esc, badge } from '../components.js';
import { runTableExport, slug } from '../ui/export-table.js';
import {
  landscapeKey, landscapeState, wireLandscape,
} from '../ui/landscape-state.js';

// The compatibility query value: `keine` explicitly requests no grouping.
const AXES = [
  { value: 'bereich', label: 'Prozessbereich', of: (p) => p.areaLabel || p.branchLabel },
  { value: 'gruppe', label: 'Prozessgruppe', of: (p) => p.groupLabel },
  { value: 'status', label: 'Status', of: (p, core) => statusOf(core, p.status).label },
  { value: 'keine', label: '(keine)', of: null },
];
const BOXES = landscapeState('process-docs');

export const needs = ['processes', 'contacts'];

const BASE = '#/app/process-docs';
const TITLE = 'Prozessdokumentation Bauten';   // Single source for title, breadcrumb, heading, and back links.
const PER_PAGE = 12;
const CONTACT_ID = 'immobilienmanagement';

// Lazily load the bpmn-js NavigatedViewer bundle and its three stylesheets.
const BPMNJS_VER = '17.11.1';
const BPMNJS_ASSETS = {
  key: `bpmn-js@${BPMNJS_VER}`,
  globalName: 'BpmnJS',
  styles: [
    {
      url: `https://unpkg.com/bpmn-js@${BPMNJS_VER}/dist/assets/diagram-js.css`,
      integrity: 'sha384-2WPRuHNLlqer/8fKQLOMZSWVINTz4vDTnIB1SXm75ubMI3oBGJyfvuOcPPc0Pfjh',
    },
    {
      url: `https://unpkg.com/bpmn-js@${BPMNJS_VER}/dist/assets/bpmn-js.css`,
      integrity: 'sha384-d5fPuJ8qoomhVwsLNT3CIO4Wr1Ur5kNIP6IkZ1c1m5deqBd43hlGyuXPeFUiuA0N',
    },
    {
      url: `https://unpkg.com/bpmn-js@${BPMNJS_VER}/dist/assets/bpmn-font/css/bpmn.css`,
      integrity: 'sha384-8tty/x85ufSya/WwOVNWRKW8kN5cRZBN72EY7ldimsrm+XdO5m9J3JGDkzv6YFWN',
    },
  ],
  script: {
    url: `https://unpkg.com/bpmn-js@${BPMNJS_VER}/dist/bpmn-navigated-viewer.production.min.js`,
    integrity: 'sha384-izUzsqBpTLenW0ylFgbiLMoW5T0/fTAi+oOM/yuwnzOZAc8OFynG1LHJGsCWEP4G',
  },
  messages: {
    timeout: 'Zeitüberschreitung beim Laden des BPMN-Viewers',
    style: 'Der BPMN-Viewer konnte nicht geladen werden',
    script: 'Der BPMN-Viewer konnte nicht geladen werden',
    global: 'BpmnJS fehlt',
  },
};

function loadBpmnJS() {
  return loadExternalAssets(BPMNJS_ASSETS);
}

// Parse typed BPMN flow elements in document order, independent of namespace
// prefixes. Sequence flows contribute only incoming and outgoing counts.
const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const STEP_TYPES = [
  { tag: 'startEvent', label: 'Start', kind: 'event' },
  { tag: 'endEvent', label: 'Ende', kind: 'event' },
  { tag: 'intermediateCatchEvent', label: 'Zwischenereignis', kind: 'event' },
  { tag: 'intermediateThrowEvent', label: 'Zwischenereignis', kind: 'event' },
  { tag: 'boundaryEvent', label: 'Randereignis', kind: 'event' },
  { tag: 'task', label: 'Aufgabe', kind: 'task' },
  { tag: 'userTask', label: 'Benutzer-Aufgabe', kind: 'task' },
  { tag: 'serviceTask', label: 'Service-Aufgabe', kind: 'task' },
  { tag: 'manualTask', label: 'Manuelle Aufgabe', kind: 'task' },
  { tag: 'scriptTask', label: 'Skript-Aufgabe', kind: 'task' },
  { tag: 'sendTask', label: 'Sende-Aufgabe', kind: 'task' },
  { tag: 'receiveTask', label: 'Empfangs-Aufgabe', kind: 'task' },
  { tag: 'businessRuleTask', label: 'Regel-Aufgabe', kind: 'task' },
  { tag: 'callActivity', label: 'Call Activity', kind: 'task' },
  { tag: 'subProcess', label: 'Teilprozess', kind: 'subprocess' },
  { tag: 'exclusiveGateway', label: 'XOR-Gateway', kind: 'gateway' },
  { tag: 'parallelGateway', label: 'AND-Gateway', kind: 'gateway' },
  { tag: 'inclusiveGateway', label: 'OR-Gateway', kind: 'gateway' },
  { tag: 'eventBasedGateway', label: 'Ereignis-Gateway', kind: 'gateway' },
  { tag: 'complexGateway', label: 'Komplex-Gateway', kind: 'gateway' },
];
const KIND_LABEL = { task: 'Aufgabe', event: 'Ereignis', gateway: 'Gateway', subprocess: 'Teilprozess' };

export function parseBpmnSteps(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Die BPMN-Datei enthält ungültiges XML.');
  const root = doc.documentElement;
  if (root?.namespaceURI !== BPMN_NS || root.localName !== 'definitions'
    || doc.getElementsByTagNameNS(BPMN_NS, 'process').length === 0) {
    throw new Error('Die Datei enthält kein BPMN-Prozessmodell.');
  }
  const laneMap = new Map();
  for (const lane of doc.getElementsByTagNameNS(BPMN_NS, 'lane')) {
    const laneName = lane.getAttribute('name') || '';
    for (const ref of lane.getElementsByTagNameNS(BPMN_NS, 'flowNodeRef')) {
      laneMap.set(ref.textContent.trim(), laneName);
    }
  }
  const inCount = new Map(), outCount = new Map();
  for (const flow of doc.getElementsByTagNameNS(BPMN_NS, 'sequenceFlow')) {
    const src = flow.getAttribute('sourceRef'), tgt = flow.getAttribute('targetRef');
    if (src) outCount.set(src, (outCount.get(src) || 0) + 1);
    if (tgt) inCount.set(tgt, (inCount.get(tgt) || 0) + 1);
  }
  const typeByTag = new Map(STEP_TYPES.map((t) => [t.tag, t]));
  const collected = [];
  for (const t of STEP_TYPES) {
    for (const n of doc.getElementsByTagNameNS(BPMN_NS, t.tag)) collected.push(n);
  }
  collected.sort((a, b) => {
    const rel = a.compareDocumentPosition(b);
    if (rel & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (rel & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
  return collected.map((n, i) => {
    const meta = typeByTag.get(n.localName);
    const id = n.getAttribute('id') || '';
    let documentation = '';
    for (const d of n.children) {
      if (d.namespaceURI !== BPMN_NS || d.localName !== 'documentation') continue;
      const t = (d.textContent || '').trim();
      if (t) documentation = documentation ? `${documentation}\n${t}` : t;
    }
    return {
      number: i + 1, id,
      name: n.getAttribute('name') || '',
      typeLabel: meta ? meta.label : n.localName,
      kind: meta ? meta.kind : 'other',
      lane: laneMap.get(id) || '',
      incoming: inCount.get(id) || 0,
      outgoing: outCount.get(id) || 0,
      documentation,
    };
  });
}

const BPMN_CACHE = new Map();

async function loadBpmnDocument(path, signal) {
  if (BPMN_CACHE.has(path)) return BPMN_CACHE.get(path);
  const response = await fetch(encodeURI(path), { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xml = await response.text();
  const value = { xml, steps: parseBpmnSteps(xml) };
  BPMN_CACHE.set(path, value);
  return value;
}

const refList = (core, key) => core.ref()[key] || [];
const statusOf = (core, id) => refList(core, 'objectStatuses').find((s) => s.id === id) || { label: id, variant: 'gray' };
const processHref = (id) => `${BASE}?id=${encodeURIComponent(id)}`;
const recordHref = (process) => process.branch === 'portal'
  ? `${BASE}?def=${encodeURIComponent(process.processId)}`
  : processHref(process.processId);
const hashFor = (p) => `${BASE}?group=${encodeURIComponent(p.group)}`;
const truncateText = (s, n = 130) => {
  const t = String(s || '');
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
};
const linkHost = (url) => {
  try { return new URL(url, location.href).hostname || url; } catch { return url; }
};

export default async function render(ctx) {
  const id = ctx.query.get('id');
  if (id) return detail(ctx, id);
  const def = ctx.query.get('def');
  if (def) return detail(ctx, def);
  return list(ctx);
}

// List and detail routes share the same data-driven hierarchy.
function buildTree({ all, areas, hash, selGroups, activeId, activeDef = null,
  scopeOf = () => '', pathOf = () => false, href = () => BASE }) {
  const ICON = { fachlich: 'lucide/workflow', portal: 'lucide/app-window' };
  const UNIT = { fachlich: 'Prozesse', portal: 'Abläufe' };

  const nest = (rows, inner, onPath) => {
    const chain = (rows[0] || {}).org || [];
    return chain.reduceRight((kids, label) => {
      const mine = scopeOf('org') === label;
      const onWay = onPath || pathOf('org', label);
      return [{
        id: `org:${label}`,
        label,
        count: rows.length,
        countUnit: 'Prozesse',
        href: href('org', label),
        // A selected scope opens initially but still yields to an explicit fold.
        state: mine ? 'active' : onWay ? 'path' : '',
        defaultOpen: mine || undefined,
        split: true,
        hasChildren: true,
        children: () => kids,
      }];
    }, inner);
  };

  const leafNode = (r) => ({
    id: `proc:${r.processId}`,
    label: r.name,
    href: r.branch === 'portal'
      ? `${BASE}?def=${encodeURIComponent(r.processId)}`
      : processHref(r.processId),
    state: (activeId === r.processId || activeDef === r.processId) ? 'active' : '',
  });

  const groupNodes = (rows) => {
    const by = new Map();
    for (const r of rows) {
      if (!by.has(r.group)) by.set(r.group, { label: r.groupLabel || r.group, rows: [] });
      by.get(r.group).rows.push(r);
    }
    return [...by].map(([key, g]) => ({
      id: `group:${key}`,
      label: g.label,
      count: g.rows.length,
      countUnit: 'Prozesse',
      href: href('group', key),
      state: scopeOf('group') === key || (selGroups.length === 1 && selGroups[0] === key) ? 'active'
        : g.rows.some((r) => r.processId === activeId || r.processId === activeDef)
          || pathOf('group', key) ? 'path' : '',
      split: true,
      hasChildren: g.rows.length > 0,
      children: () => g.rows
        .slice()
        .sort((a, b) => String(a.processId).localeCompare(String(b.processId), undefined, { numeric: true }))
        .map(leafNode),
    }));
  };

  // Domain processes have an area level; portal flows go straight to groups.
  const areaNodes = (rows, holdsActive) => areas
    .filter((a) => rows.some((r) => r.area === a.key))
    .map((a) => {
      const mine = rows.filter((r) => r.area === a.key);
      return {
        id: `area:${a.key}`,
        label: a.label,
        count: mine.length,
        countUnit: 'Prozesse',
        href: href('area', a.key),
        state: scopeOf('area') === a.key ? 'active'
          : pathOf('area', a.key) || (holdsActive && mine.some((r) => r.processId === activeId
            || (selGroups.length === 1 && r.group === selGroups[0]))) ? 'path' : '',
        defaultOpen: scopeOf('area') === a.key || undefined,
        split: true,
        hasChildren: true,
        children: () => groupNodes(mine),
      };
    });

  const branchNode = (id, rows) => {
    const holds = pathOf('branch', id) || rows.some((r) => r.processId === activeId
      || r.processId === activeDef || (selGroups.length === 1 && r.group === selGroups[0]));
    const inner = id === 'fachlich'
      ? nest(rows, areaNodes(rows, holds), holds)
      : groupNodes(rows);
    const mine = scopeOf('branch') === id;
    return {
      id: `branch:${id}`,
      label: (rows[0] || {}).branchLabel || id,
      count: rows.length,
      countUnit: UNIT[id] || 'Prozesse',
      icon: ICON[id],
      href: href('branch', id),
      state: mine ? 'active' : holds ? 'path' : '',
      defaultOpen: mine || undefined,
      split: true,
      hasChildren: rows.length > 0,
      children: () => inner,
    };
  };

  const byBranch = new Map();
  for (const r of all) {
    if (!byBranch.has(r.branch)) byBranch.set(r.branch, []);
    byBranch.get(r.branch).push(r);
  }

  return ({
    id: 'pd-tree',
    title: 'Prozesshierarchie',
    mode: 'nav',
    levels: [{ icons: true }, { icons: false }, { icons: false }, { icons: false },
      { icons: false }, { icons: false }],
    sections: [
      [{
        id: 'root',
        label: 'Übersicht',
        icon: 'lucide/library',
        count: all.length,
        countUnit: 'Prozesse',
        href: hash({ q: '', sort: '', group: [], status: [], page: 1 }),
        state: !activeId && !activeDef && !selGroups.length && !scopeOf('branch')
          && !scopeOf('org') && !scopeOf('area') && !scopeOf('group') ? 'active' : '',
      }],
      [
        branchNode('fachlich', byBranch.get('fachlich') || []),
        branchNode('portal', byBranch.get('portal') || []),
      ],
    ],
  });
}

function list(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  setTitle(TITLE);
  setCrumbs(trail(APPLICATIONS, { label: TITLE }));

  const everything = core.processes();
  // The narrowest valid scope wins. Portal flows remain a separate branch
  // because they do not have domain-process numbers or areas.
  const SCOPES = [
    { key: 'group', param: 'group', of: (r) => r.group, label: (r) => r.groupLabel },
    { key: 'area', param: 'area', of: (r) => r.area, label: (r) => r.areaLabel },
    { key: 'org', param: 'org', of: (r) => (r.org || [])[0], label: (r) => (r.org || [])[0] },
    { key: 'branch', param: 'branch', of: (r) => r.branch, label: (r) => r.branchLabel },
  ];
  const scope = (() => {
    for (const s0 of SCOPES) {
      const v = query.get(s0.param);
      if (!v) continue;
      const rows = everything.filter((r) => String(s0.of(r)) === v);
      if (rows.length) return { ...s0, value: v, rows, label: s0.label(rows[0]) || v };
    }
    return null;
  })();

  // The root is one catalogue: search, counts and exports cover both branches.
  // Scoped views retain their branch-sized denominator for useful "x of y" context.
  const all = scope ? scope.rows : everything;
  const universe = scope
    ? everything.filter((p) => p.branch === (scope.rows[0] || {}).branch)
    : everything;
  // Derive L1/L2 ordering from first appearance in the process inventory.
  const areas = [...new Map(everything.filter((p) => p.area)
    .map((p) => [p.area, { key: p.area, code: p.areaCode, label: p.areaLabel }])).values()];
  const groups = [...new Map(everything.map((p) => [p.group, { key: p.group, label: p.groupLabel }])).values()];

  const SORTS = [
    { value: 'nr', label: 'Nummer', cmp: (a, b) => a.processId.localeCompare(b.processId, undefined, { numeric: true }) },
    { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
    { value: 'group', label: 'Prozessgruppe', cmp: (a, b) => a.groupLabel.localeCompare(b.groupLabel, 'de') || a.processId.localeCompare(b.processId, undefined, { numeric: true }) },
  ];
  const state = C.catalogueState(query, {
    base: BASE, perPage: PER_PAGE,
    sortOpts: SORTS.map((s) => s.value),
    views: ['uebersicht', 'diagramm', 'tabelle'],
    defaultView: 'diagramm', trimQuery: false,
    filters: {
      group: groups.map((g) => g.key),
      status: refList(core, 'objectStatuses').map((s) => s.id),
    },
  });
  const { q: rawQ, view, sort: sortKey, hash } = state;
  const q = rawQ.toLowerCase();
  const selGroups = state.selected.group;
  const selStatus = state.selected.status;

  const matches = (p) => {
    if (q) {
      const hay = `${p.processId} ${p.name} ${p.description} ${p.groupLabel} ${(p.tags || []).join(' ')} ${(p.systems || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (selGroups.length && !selGroups.includes(p.group)) return false;
    if (selStatus.length && !selStatus.includes(p.status)) return false;
    return true;
  };
  const filtered = all.filter(matches);
  const sortDef = SORTS.find((s) => s.value === sortKey);
  const sorted = sortDef ? filtered.slice().sort(sortDef.cmp) : filtered.slice().sort(SORTS[0].cmp);
  const { visible, totalPages, page } = state.clamp(sorted);
  const unit = { nom: 'Prozesse', dat: 'Prozessen' };

  // The tree, breadcrumb and heading already communicate hierarchy scope.
  // Chips are reserved for constraints users can independently remove.
  let active = [];

  const mixedBranches = new Set(all.map((p) => p.branch)).size > 1;
  const listColumns = [
    ...(mixedBranches ? [{ key: 'branch', label: 'Zweig', width: '11rem', render: (p) => esc(p.branchLabel) }] : []),
    { key: 'number', label: 'Nr.', width: '10rem', render: (p) => `<code>${esc(p.processId)}</code>` },
    { key: 'name', label: 'Prozess', render: (p) => `<a href="${recordHref(p)}">${esc(p.name)}</a><br><span class="small muted">${esc(truncateText(p.description, 90))}</span>` },
    { key: 'group', label: 'Prozessgruppe', width: '13rem', render: (p) => esc(p.groupLabel) },
    { key: 'status', label: 'Status', width: '8rem', render: (p) => { const st = statusOf(core, p.status); return badge(st.label, st.variant); } },
  ];
  const listView = (rows) => C.table({
    caption: 'Prozesse', zebra: true, rowsClickable: true,
    columns: listColumns,
    rows,
  });

  // Each scope defaults to grouping by the next level below it.
  const DEFAULT_AXIS = { group: 'keine', area: 'gruppe', org: 'bereich', branch: 'bereich' };
  const defaultAxis = scope
    ? (scope.key === 'branch' && scope.value === 'portal' ? 'gruppe' : DEFAULT_AXIS[scope.key])
    : 'bereich';
  const axis = AXES.find((x) => x.value === query.get('axis'))
    || AXES.find((x) => x.value === defaultAxis)
    || AXES[0];
  // catalogueHash knows catalogue controls, while hashA also preserves the
  // independently selected hierarchy scope and grouping axis.
  const hashA = (patch = {}) => {
    const base = hash({
      axis: axis.value === defaultAxis ? '' : axis.value, ...patch });
    if (!scope || SCOPES.some((x) => x.param in patch)) return base;
    const [route, qs] = base.replace(/^#/, '').split('?');
    const q2 = new URLSearchParams(qs || '');
    q2.set(scope.param, scope.value);
    return `#${route}?${q2}`;
  };
  const emptyResultsHtml = () => C.empty('Kein Prozess gefunden.', {
    hint: 'Passen Sie Ihre Suche oder die Filter an.',
    action: {
      label: 'Suche und Filter zurücksetzen',
      href: hashA({ q: '', status: [], page: 1 }),
    },
  });
  active = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hashA({ q: '', page: 1 }) }] : []),
    ...selStatus.map((x) => ({
      label: statusOf(core, x).label,
      href: hashA({ status: selStatus.filter((y) => y !== x), page: 1 }),
    })),
  ];
  const boxes = () => {
    const scopeKey = scope ? `${scope.key}:${scope.value}` : 'root';
    const boxKey = (value) => landscapeKey(scopeKey, axis.value, value);
    const tile = (p) => ({ label: p.name, href: recordHref(p) });
    if (!axis.of) return [{ key: boxKey('all'), label: 'Alle Prozesse', count: sorted.length, tiles: sorted.map(tile) }];
    const by = new Map();
    for (const p of sorted) {
      const k = axis.of(p, core) || '—';
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(p);
    }
    return [...by].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'de'))
      .map(([label, mine]) => ({ key: boxKey(label), label, count: mine.length, tiles: mine.map(tile) }));
  };

  const toolsHtml = () => {
    const anyOpen = !atRoot && view === 'diagramm' && BOXES.anyOpen(boxes().map((b) => b.key));
    const fold = atRoot || view !== 'diagramm' ? '' : `
      <button type="button" class="btn btn--outline btn--sm btn--icon-left" data-lscape-all="${anyOpen ? 'shut' : 'open'}">
        ${C.icon(anyOpen ? 'Minus' : 'Plus', 'btn__icon')}
        <span class="btn__text">Alle ${anyOpen ? 'zuklappen' : 'aufklappen'}</span></button>`;
    const group = atRoot || view === 'uebersicht' ? '' : C.menu({
      menuId: 'pd-group', label: 'Gruppieren', triggerLabel: `Gruppieren: ${axis.label}`,
      items: AXES.map((x) => ({ action: `axis:${x.value}`, label: x.label })),
    });
    const actions = C.menu({
      menuId: 'pd-actions', label: 'Aktionen', triggerLabel: 'Aktionen',
      items: [
        { action: 'csv', label: 'Prozessliste als CSV herunterladen' },
        { action: 'excel', label: 'Prozessliste als Excel herunterladen' },
        { action: 'pdf', label: 'Prozessliste drucken' },
      ],
    });
    return `<span class="mc-tools">${fold}${group}${actions}</span>`;
  };

  // Export the complete filtered scope, not merely the current page.
  const exportTable = () => ({
    name: selGroups.length === 1
      ? (groups.find((g) => g.key === selGroups[0]) || {}).label || TITLE : TITLE,
    head: [...(mixedBranches ? ['Zweig'] : []), 'Nr.', 'Prozess', 'Prozessgruppe', 'Status', 'Beschreibung'],
    rows: sorted.map((p) => [
      ...(mixedBranches ? [p.branchLabel] : []),
      p.processId, p.name, p.groupLabel, statusOf(core, p.status).label, p.description || '',
    ]),
  });

  const section = (title, body) =>
    `<section class="detail-section"><h2 class="detail-section__title">${esc(title)}</h2>${body}</section>`;
  const kv = (rows) => `<dl class="kv kv--ruled">${rows.filter(Boolean)
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;

  const atRoot = !scope && !selGroups.length && !selStatus.length && !rawQ;

  const homeHtml = () => {
    const byBranch = new Map();
    for (const r of everything) {
      if (!byBranch.has(r.branch)) byBranch.set(r.branch, []);
      byBranch.get(r.branch).push(r);
    }
    const cards = [...byBranch].map(([bid, rows]) => {
      const isPortal = bid === 'portal';
      const detail = isPortal
        ? `${rows.reduce((a, r) => a + (r.steps || []).length, 0)} Schritte · `
          + `${new Set(rows.map((r) => r.audience)).size} Zielgruppen`
        : `${new Set(rows.map((r) => r.group)).size} Prozessgruppen · `
          + `${new Set(rows.map((r) => r.area)).size} Prozessbereich`;
      return C.card({
        title: (rows[0] || {}).branchLabel || bid,
        titleTag: 'h2',
        href: scopeHref('branch', bid),
        desc: detail,
        footerInfo: `<strong>${rows.length}</strong> ${isPortal ? 'Abläufe' : 'Prozesse'}`,
        footerAction: C.cardAction(),
      });
    }).join('');

    const recent = all.filter((x) => x.updated)
      .slice()
      .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
      .slice(0, 8);

    const byGroup = groups.map((g) => {
      const mine = everything.filter((x) => x.group === g.key);
      return {
        name: g.label, n: mine.length,
        systems: [...new Set(mine.flatMap((x) => x.systems || []))].length,
        href: hashA({ q: '', sort: '', group: [g.key], status: [], page: 1 }),
      };
    });

    return `<div class="stats">${cards}</div>

      <section class="detail-section">
        <h2 class="detail-section__title">Letzte Änderungen</h2>
        ${C.table({ zebra: true, compact: true, caption: 'Zuletzt geänderte Prozesse', rows: recent,
    emptyText: 'Für keinen Prozess ist ein Änderungsdatum erfasst.',
    columns: [
      { key: 'name', label: 'Prozess',
        render: (r) => `<a href="${esc(recordHref(r))}">${esc(r.name)}</a>` },
      { key: 'group', label: 'Prozessgruppe', width: '13rem', render: (r) => esc(r.groupLabel) },
      { key: 'status', label: 'Status', width: '9rem',
        render: (r) => esc(statusOf(core, r.status).label) },
      { key: 'updated', label: 'Geändert', width: '8rem', nowrap: true,
        render: (r) => esc(formatDate(r.updated)) },
    ] })}
      </section>

      <section class="detail-section">
        <h2 class="detail-section__title">Prozessgruppen</h2>
        ${C.table({ zebra: true, compact: true, caption: 'Prozessgruppen der Prozessdokumentation', rows: byGroup,
    columns: [
      { key: 'name', label: 'Prozessgruppe',
        render: (r) => `<a href="${esc(r.href)}">${esc(r.name)}</a>` },
      { key: 'n', label: 'Umfang', width: '11rem', render: (r) => `${r.n} Prozesse` },
      { key: 'systems', label: 'Systeme', width: '9rem', render: (r) => String(r.systems) },
    ] })}
      </section>`;
  };

  const scopeOverviewHtml = () => {
    const one = selGroups.length === 1 ? groups.find((g) => g.key === selGroups[0]) : null;
    // Every aggregate view describes the same filtered records as its diagram,
    // table, result count and export.
    const mine = sorted;
    if (!mine.length) return emptyResultsHtml();
    const portalScope = mine.every((process) => process.branch === 'portal');
    const area = areas.find((candidate) => mine.some((process) => process.area === candidate.key)) || {};
    const contact = core.contacts().find((c) => c.contactId === CONTACT_ID);
    // A scope's date is the newest recorded member date.
    const newest = mine.map((x) => x.updated).filter(Boolean).sort().pop();
    const src = (mine.find((x) => x.source && x.source.url) || {}).source;
    const sourceHref = safeLinkUrl(src?.url || '');
    const contactHref = safeMailto(contact?.email || '');
    const uniq = (key) => [...new Set(mine.flatMap((x) => x[key] || []))].sort((a, b) => a.localeCompare(b, 'de'));
    const systems = uniq('systems');
    const standards = uniq('standards');
    const byStatus = [...new Set(mine.map((x) => statusOf(core, x.status).label))];

    return section('Definition', `<p class="m-0">${portalScope
      ? (one
        ? `Gruppe von ${mine.length} Portal-Abläufen für dasselbe Anliegen.`
        : 'Die im Portal angebotenen Abläufe, gegliedert nach Anliegen.')
      : one
        ? `Prozessgruppe im Bereich «${esc(area.label || '')}». Sie fasst ${mine.length} Prozesse `
          + 'zusammen, die derselben Phase des Immobilienlebenszyklus angehoeren.'
        : 'Die Prozesse des Immobilienmanagements des BBL, gegliedert in Prozessgruppen. '
          + 'Jeder Prozess ist mit BPMN-Diagramm, Prozessschritten und Verantwortlichkeiten erfasst.'}</p>`)
      + section('Verantwortlich', kv([
        portalScope ? null : ['Prozessbereich', esc(area.label || '—')],
        contact ? ['Fachstelle', esc(contact.name || contact.title || CONTACT_ID)] : null,
        contact && contact.email
          ? ['Kontakt', contactHref ? `<a href="${esc(contactHref)}">${esc(contact.email)}</a>` : esc(contact.email)] : null,
      ]))
      + section('Metadaten', kv([
        one ? [portalScope ? 'Gruppe' : 'Prozessgruppe', esc(one.label)]
          : [portalScope ? 'Gruppen' : 'Prozessgruppen', String(new Set(mine.map((x) => x.group)).size)],
        [portalScope ? 'Abläufe' : 'Prozesse', String(mine.length)],
        byStatus.length ? ['Status', byStatus.length === 1 ? esc(byStatus[0]) : esc(byStatus.join(', '))] : null,
        systems.length ? ['Systeme', esc(systems.join(' · '))] : null,
        standards.length ? ['Normen', esc(standards.join(' · '))] : null,
        newest ? ['Stand', esc(formatDate(newest))] : null,
        sourceHref
          ? ['Quelle', `<a href="${esc(sourceHref)}"${newWindowAttrs(sourceHref, {
            external: classifyUrl(sourceHref) === 'external',
          })}>${esc(linkHost(sourceHref))}</a>`]
          : null,
      ]));
  };

  const paneHtml = () => {
    if (!core.available('processes')) {
      return C.empty('Prozesse konnten nicht geladen werden (Ladefehler).', { available: false });
    }
    if (atRoot) return homeHtml();
    if (view === 'uebersicht') return scopeOverviewHtml();
    if (view === 'diagramm') {
      if (!sorted.length) return emptyResultsHtml();
      // Long process names require one tile per row.
      return C.landscape({ boxes: boxes(), isOpen: BOXES.isOpen, cols: 1,
        emptyText: 'In diesem Umfang ist kein Prozess erfasst.' });
    }
    return sorted.length ? listView(sorted) : emptyResultsHtml();
  };

  // Each hierarchy link names exactly one scope dimension.
  const scopeHref = (kind, value) => {
    const qs = new URLSearchParams();
    qs.set(kind, value);
    // Carry only an explicitly non-default axis into the target scope.
    const tgt = kind === 'branch' && value === 'portal' ? 'gruppe' : (DEFAULT_AXIS[kind] || 'bereich');
    if (axis.value !== tgt && query.get('axis')) qs.set('axis', axis.value);
    if (view && view !== 'diagramm') qs.set('view', view);
    return `${BASE}?${qs}`;
  };
  // SCOPES is ordered narrow-to-wide, which also defines one-level Back links.
  const upFrom = () => {
    if (!scope) return { backHref: '#/applications', backLabel: 'Anwendungen' };
    const here = SCOPES.findIndex((x) => x.key === scope.key);
    const row = scope.rows[0] || {};
    for (let i = here + 1; i < SCOPES.length; i++) {
      const v = SCOPES[i].of(row);
      if (v) return { backHref: `${BASE}?${new URLSearchParams({ [SCOPES[i].param]: v })}`,
        backLabel: SCOPES[i].label(row) || String(v) };
    }
    return { backHref: BASE, backLabel: TITLE };
  };
  const treeConfig = () => buildTree({
    all: everything, areas, hash: hashA, selGroups, activeId: null,
    activeDef: query.get('def') || null,
    scopeOf: (kind) => (scope && scope.key === kind ? scope.value : ''),
    pathOf: (kind, value) => {
      if (!scope || scope.key === kind) return false;
      const here = SCOPES.findIndex((x) => x.key === kind);
      const there = SCOPES.findIndex((x) => x.key === scope.key);
      // Only ancestors are path nodes; descendants must remain folded.
      if (here <= there) return false;
      const dim = SCOPES[here];
      return scope.rows.some((r) => String(dim.of(r)) === String(value));
    },
    href: scopeHref,
  });

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar(upFrom())}
    ${C.pageHeader({
      title: TITLE,
      lead: 'Die Prozesse des Immobilienmanagements als navigierbare Landkarte — je Prozess mit BPMN-Diagramm, Prozessschritten und Verantwortlichkeiten.',
    })}
    ${C.catalogueBar({
      formId: 'pd-search', inputId: 'pd-q', searchLabel: 'Prozess suchen', placeholder: 'Prozess suchen…', q: rawQ,
      // Keep the count in the accessibility tree while tree rows show it visually.
      countId: 'pd-count', showCount: false,
      count: `<strong>${sorted.length}</strong> von ${universe.length} ${esc(unit.dat)}`,
      view,
      extra: `<span id="pd-tools">${toolsHtml()}</span>`,
      views: atRoot ? null
        : [['uebersicht', 'Übersicht', 'InfoCircle'], ['diagramm', 'Diagramm', 'Apps'],
          ['tabelle', 'Tabelle', 'List']],
    })}
    ${C.activeFilters({ filters: active, resetHref: hashA({ q: '', status: [], page: 1 }) })}
    <div class="pf-layout">
      <aside class="pf-sidebar" id="pd-tree" aria-label="Prozesshierarchie"></aside>
      <div class="pf-main">
        <div id="pd-panel" class="mc-pane">${paneHtml()}</div>
      </div>
    </div>
  </div>`;

  C.announceCatalogue({ count: sorted.length, total: universe.length, unit, view });
  C.wireCatalogue(mount, { formId: 'pd-search', inputId: 'pd-q', hash: hashA });
  ctx.onUnmount(C.wireTableRows(mount));

  ctx.onUnmount(C.sidebarTree(mount.querySelector('#pd-tree'), treeConfig()));

  // Folding redraws only the pane and stays out of browser history.
  const paneEl = mount.querySelector('#pd-panel');
  const tools = mount.querySelector('#pd-tools');
  const redraw = () => {
    if (paneEl) paneEl.innerHTML = paneHtml();
    if (tools) { tools.innerHTML = toolsHtml(); C.wireMenu(tools, onMenuAction); }
  };

  function onMenuAction(action) {
    if (action.startsWith('axis:')) {
      const v = action.slice(5);
      if (!AXES.some((candidate) => candidate.value === v)) return;
      location.hash = hashA({ axis: v === defaultAxis ? '' : v }).slice(1);
      return;
    }
    runTableExport(action, exportTable(), `prozessdokumentation_${slug(exportTable().name, 'prozesse')}`);
  }

  if (tools) C.wireMenu(tools, onMenuAction);
  ctx.onUnmount(wireLandscape({
    panel: paneEl, tools, state: BOXES,
    keys: () => boxes().map((box) => box.key),
    redraw,
  }));
}

async function detail(ctx, rawId) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  // URLSearchParams already decodes once; decoding again would corrupt literal percent escapes.
  const p = core.processDoc(rawId);
  if (!p) {
    return C.renderNotFound(ctx, {
      thing: 'Dieser Prozess', title: 'Prozess nicht gefunden',
      backHref: BASE, backLabel: TITLE,
      crumbs: trail(APPLICATIONS, { label: TITLE, href: BASE }),
    });
  }
  const isPortal = p.branch === 'portal';
  setTitle(p.name);
  setCrumbs(trail(APPLICATIONS, { label: TITLE, href: BASE }, { label: p.name }));

  const st = statusOf(core, p.status);
  const contact = core.contacts().find((c) => c.contactId === CONTACT_ID);

  // Overview renders without waiting for BPMN. Diagram, steps and exports share
  // the first deferred load; successful parsing also remains cached per page.
  let xml = '', xmlError = '', steps = [];
  let documentLoaded = false, documentPromise = null;

  const tabByLegacyValue = { 'uebersicht': 'overview', 'diagramm': 'diagram', 'schritte': 'steps' };
  const legacyValueByTab = Object.fromEntries(Object.entries(tabByLegacyValue).map(([legacy, tab]) => [tab, legacy]));
  const tabs = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'diagram', label: 'Prozessdiagramm' },
    { id: 'steps', label: 'Prozessschritte' },
  ];
  let active = tabByLegacyValue[query.get('tab')] || tabs[0].id;
  if (!tabs.some((x) => x.id === active)) active = tabs[0].id;
  const detailHref = (tab) => {
    const qs = new URLSearchParams(isPortal ? { def: p.processId } : { id: p.processId });
    if (tab !== tabs[0].id) qs.set('tab', legacyValueByTab[tab]);
    return `${BASE}?${qs}`;
  };
  const stepsRecoveryLink = () => steps.length
    ? ` <a class="link" data-show-steps href="${esc(detailHref('steps'))}">Prozessschritte anzeigen</a>`
    : '';

  const detailSection = (title, body, className = '') => `<section class="detail-section${className ? ` ${className}` : ''}">
    <h2 class="detail-section__title">${esc(title)}</h2>${body}</section>`;
  const detailFacts = (rows) => `<dl class="kv kv--ruled">${rows.filter(Boolean)
    .map(([label, value]) => `<dt>${esc(label)}</dt><dd>${value}</dd>`).join('')}</dl>`;
  const audienceLabel = p.audience === 'external' ? 'Kundinnen und Kunden'
    : p.audience === 'internal' ? 'BBL-intern' : p.audience || '';
  const portalRoles = [...new Set((p.steps || []).map((step) => step.role).filter(Boolean))];
  const portalKinds = new Map();
  (p.steps || []).forEach((step) => portalKinds.set(step.kind, (portalKinds.get(step.kind) || 0) + 1));
  const kindWord = { user: 'durch Menschen', auto: 'automatisch', system: 'durch ein System' };
  const contactHref = safeMailto(contact?.email || '');

  const overviewHTML = () => {
    const responsibility = [
      ...(p.responsiblePersons || []).map((person) => [person.role,
        `<a href="https://admindir.verzeichnisse.admin.ch/person/${encodeURIComponent(person.admindirId)}"
          target="_blank" rel="noopener noreferrer external">AdminDir ${esc(person.admindirId)}</a>`]),
      portalRoles.length ? ['Beteiligte Rollen', portalRoles.map(esc).join('<br>')] : null,
      contact ? ['Fachstelle', `<strong>${esc(contact.name || CONTACT_ID)}</strong>${contact.unit ? `<br>${esc(contact.unit)}` : ''}`] : null,
      contactHref ? ['Kontakt', `<a href="${esc(contactHref)}">${esc(contact.email)}</a>${contact.phone ? `<br>${esc(contact.phone)}` : ''}`] : null,
    ].filter(Boolean);
    const related = (p.related || []).map((id) => {
      const process = core.processDoc(id);
      return `<li><a href="${esc(links.processDocumentation(id, process?.branch))}">${esc(process?.name || id)}</a></li>`;
    });
    const contextRows = [
      ['Prozessmodell', p.bpmn ? 'BPMN-Diagramm' : '—'],
      p.steps?.length ? ['Portal-Stationen', String(p.steps.length)] : null,
      portalKinds.size ? ['Art der Stationen', [...portalKinds]
        .map(([kind, count]) => esc(`${count} ${kindWord[kind] || kind}`)).join(' · ')] : null,
      p.systems?.length ? ['Unterstützende Systeme', `<span class="pill-row">${p.systems
        .map((system) => badge(system, 'gray', 'sm')).join('')}</span>`] : null,
      p.serviceId ? ['Dienstleistung', `<a href="${esc(links.service(p.serviceId))}">${esc(p.serviceId)}</a>`] : null,
    ];
    const wide = [
      related.length ? detailSection('Verwandte Prozesse',
        `<ul class="list--default m-0">${related.join('')}</ul>`) : '',
      p.tags?.length ? detailSection('Schlagwörter',
        `<p class="pill-row m-0">${p.tags.map((tag) => badge(tag, 'gray', 'sm')).join('')}</p>`) : '',
      p.standards?.length ? detailSection('Grundlagen', `<ul class="list--default m-0">${p.standards
        .map((standard) => `<li>${esc(standard)}</li>`).join('')}</ul>`) : '',
      C.sourceBox(p.source,
        (core.ref().sourceRoles || []).find((role) => role.key === (p.source || {}).role),
        { title: 'Führende Quelle', heading: 'h2' }),
    ].filter(Boolean).join('');

    return `<div class="mc-detail">
      ${detailSection('Beschreibung', `<p class="m-0">${esc(p.description
    || 'Für diesen Prozess ist noch keine Beschreibung hinterlegt.')}</p>`, 'mc-detail__description')}
      <div class="mc-detail__facts">
        ${detailSection('Einordnung', detailFacts([
    ['Zweig', esc(p.branchLabel || (isPortal ? 'Kundenportal' : 'Fachliche Prozesse'))],
    p.areaLabel ? ['Prozessbereich', `${esc(p.areaLabel)}${p.areaCode ? ` <span class="muted">(${esc(p.areaCode)})</span>` : ''}`] : null,
    ['Prozessgruppe', `<a href="${esc(C.catalogueHash(BASE, { group: [p.group] }))}">${esc(p.groupLabel || p.group)}</a>`],
    ['Status', badge(st.label, st.variant)],
    p.version ? ['Version', esc(p.version)] : null,
    p.updated ? ['Stand', esc(formatDate(p.updated))] : null,
    audienceLabel ? ['Zielgruppe', esc(audienceLabel)] : null,
    ['ID', `<code>${esc(p.processId)}</code>`],
  ]))}
        ${detailSection('Verantwortung', responsibility.length
    ? detailFacts(responsibility)
        : '<p class="muted m-0">Für diesen Prozess ist keine Verantwortung hinterlegt.</p>')}
        ${detailSection('Ablauf und Systeme', detailFacts(contextRows))}
      </div>
      ${wide ? `<div class="mc-detail__wide vertical-spacing">${wide}</div>` : ''}
    </div>`;
  };

  const diagramHTML = () => `
    <section class="detail-section">
      ${''/* Do not give the host role=img: the viewer injects interactive content
            and error actions. The steps tab provides the accessible alternative. */}
      <div class="bpmn-host" id="pd-bpmn">
        <div class="viewer-toolbar viewer-toolbar--light viewer-toolbar--vertical bpmn-toolbar" role="group" aria-label="Diagrammansicht">
          <button type="button" class="viewer-toolbar__button btn btn--bare btn--icon-only" data-bpmn="in" title="Vergrössern" disabled>${C.icon('Plus', 'btn__icon')}<span class="btn__text">Vergrössern</span></button>
          <button type="button" class="viewer-toolbar__button btn btn--bare btn--icon-only" data-bpmn="out" title="Verkleinern" disabled>${C.icon('Minus', 'btn__icon')}<span class="btn__text">Verkleinern</span></button>
          <button type="button" class="viewer-toolbar__button btn btn--bare btn--icon-only" data-bpmn="reset" title="Ausschnitt zurücksetzen" disabled>${C.icon('Compass', 'btn__icon')}<span class="btn__text">Ausschnitt zurücksetzen</span></button>
        </div>
        <div class="bpmn-canvas" id="pd-bpmn-canvas">
          ${C.loading({ label: 'Diagramm wird geladen…' })}
        </div>
      </div>
    </section>`;

  const allProcs = core.processes();
  const areas = [...new Map(allProcs.map((x) => [x.area, { key: x.area, code: x.areaCode, label: x.areaLabel }])).values()];

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: hashFor(p), backLabel: p.groupLabel })}
    ${C.pageHeader({ title: p.name,
    lead: [p.branchLabel, p.groupLabel].filter(Boolean).join(' · ') })}
    ${C.catalogueBar({
    formId: 'pd-search', inputId: 'pd-q', searchLabel: 'Prozess suchen',
    placeholder: 'Prozess suchen…', q: '', showCount: false,
    extra: `<span id="pd-tools">${C.menu({
    menuId: 'pd-actions', label: 'Aktionen', triggerLabel: 'Aktionen',
    items: [
      { action: 'csv', label: 'Prozessschritte als CSV herunterladen' },
      { action: 'excel', label: 'Prozessschritte als Excel herunterladen' },
      { action: 'pdf', label: 'Prozessschritte drucken' },
    ],
    })}</span>`,
  })}
    <div class="pf-layout pf-layout--detail">
      <aside class="pf-sidebar" id="pd-tree" aria-label="Prozesshierarchie"></aside>
      <div class="pf-main">
        <div id="pd-panel" class="mc-pane">
          <div class="tabs pd-detail-tabs">
            ${C.tabBar({ items: tabs, active, idPrefix: 'pd-tab', ariaLabel: 'Prozessdetails' })}
            ${C.tabPanels({ items: tabs, active, idPrefix: 'pd-tab', heading: true,
    render: (tab) => tab === 'overview' ? overviewHTML()
      : tab === 'diagram' ? diagramHTML()
        : `<div id="pd-steps">${C.loading({ label: 'Prozessschritte werden geladen…' })}</div>` })}
          </div>
        </div>
      </div>
    </div>
  </div>`;

  let disposeSteps = () => {};
  ctx.onUnmount(() => disposeSteps());

  const updateStepLabel = () => {
    const label = `Prozessschritte (${steps.length})`;
    const tab = mount.querySelector('[data-tab="steps"]');
    if (tab) tab.textContent = label;
    const heading = mount.querySelector('#pd-tab-panel-steps > .sr-only');
    if (heading) heading.textContent = label;
  };

  const mountSteps = () => {
    const stepsHost = mount.querySelector('#pd-steps');
    if (!stepsHost) return;
    disposeSteps();
    disposeSteps = () => {};
    if (!documentLoaded) {
      stepsHost.innerHTML = C.loading({ label: 'Prozessschritte werden geladen…' });
      return;
    }
    if (!xml) {
      stepsHost.innerHTML = C.notificationHtml(
        `<strong>Die Prozessschritte können nicht gelesen werden.</strong> Das BPMN-Diagramm (${esc(p.bpmn)}) ist nicht erreichbar${xmlError ? ` — ${esc(xmlError)}` : ''}.`,
        'error', 'WarningCircle');
      return;
    }
    const lanes = [...new Set(steps.map((s) => s.lane).filter(Boolean))];
    stepsHost.innerHTML = '';
    disposeSteps = C.mountDataTable(stepsHost, {
      id: 'pd-st', unit: { nom: 'Schritte', dat: 'Schritten' },
      caption: `Prozessschritte von ${p.name}`, perPage: 15,
      rows: steps,
      searchKeys: ['name', 'typeLabel', 'lane'],
      sorts: [
        { value: 'ord', label: 'Reihenfolge', cmp: (a, b) => a.number - b.number },
        { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
      ],
      facets: [
        { dim: 'kind', legend: 'Art', options: Object.entries(KIND_LABEL).filter(([k]) => steps.some((s) => s.kind === k)).map(([value, label]) => ({ value, label })), match: (r, vals) => vals.includes(r.kind) },
        ...(lanes.length ? [{ dim: 'lane', legend: 'Rolle', options: lanes.map((l) => ({ value: l, label: l })), match: (r, vals) => vals.includes(r.lane) }] : []),
      ],
      columns: [
        { key: 'number', label: 'Nr.', width: '4rem', align: 'right', render: (s) => String(s.number) },
        { key: 'name', label: 'Schritt', render: (s) => s.name ? esc(s.name) : `<span class="muted">ohne Bezeichnung</span> <code class="small">${esc(s.id)}</code>` },
        { key: 'typeLabel', label: 'Typ', width: '11rem', render: (s) => esc(s.typeLabel) },
        { key: 'lane', label: 'Rolle', width: '14rem', render: (s) => s.lane ? esc(s.lane) : '<span class="muted">—</span>' },
      ],
    }) || (() => {});
  };

  const ensureDocument = async () => {
    if (documentLoaded) return !!xml;
    if (documentPromise) return documentPromise;
    documentPromise = (async () => {
      try {
        const bpmnUrl = safeAssetUrl(p.bpmn, 'assets/bpmn/');
        if (!bpmnUrl || !bpmnUrl.toLowerCase().endsWith('.bpmn')) {
          throw new Error('Ungültiger BPMN-Dateipfad');
        }
        ({ xml, steps } = await loadBpmnDocument(bpmnUrl, ctx.signal));
      } catch (error) {
        if (error?.name === 'AbortError' && ctx.stale()) return false;
        xmlError = error instanceof Error ? error.message : String(error);
      }
      if (ctx.stale()) return false;
      documentLoaded = true;
      updateStepLabel();
      return !!xml;
    })().finally(() => { documentPromise = null; });
    return documentPromise;
  };

  // Initialise the BPMN viewer only after its tab first becomes visible; bpmn-js
  // cannot measure or fit a hidden 0×0 container.
  let viewer = null, viewerStarted = false, needsFit = false;
  // Fit only a measurable container. If the user changes tabs during CDN load,
  // defer fitting instead of producing a non-finite diagram-js matrix.
  const fitDiagram = () => {
    const host = mount.querySelector('#pd-bpmn-canvas');
    if (!viewer || !host) return;
    if (!host.clientWidth) { needsFit = true; return; }
    try { viewer.get('canvas').zoom('fit-viewport', 'auto'); needsFit = false; } catch { needsFit = true; }
  };
  const startViewer = async () => {
    if (viewerStarted) return;
    viewerStarted = true;
    const host = mount.querySelector('#pd-bpmn-canvas');
    const hasDocument = await ensureDocument();
    if (ctx.stale()) return;
    if (!hasDocument) {
      host.innerHTML = C.notificationHtml(
        `<strong>Das Prozessdiagramm kann nicht angezeigt werden.</strong> ${esc(xmlError || 'Die BPMN-Datei fehlt.')}`,
        'error', 'WarningCircle');
      return;
    }
    let BpmnJS;
    try {
      BpmnJS = await loadBpmnJS();
    } catch (e) {
      if (ctx.stale()) return;
      host.innerHTML = C.notificationHtml(
        `<strong>Der BPMN-Viewer konnte nicht geladen werden.</strong> ${esc(e.message)} — er kommt von unpkg.com und braucht Netzzugang. `
        + '<button type="button" class="link" data-reload-page>Seite neu laden</button>'
        + stepsRecoveryLink(),
        'error', 'WarningCircle', { live: true });
      return;
    }
    if (ctx.stale()) return;
    host.innerHTML = '';
    try {
      viewer = new BpmnJS({ container: host });
      await viewer.importXML(xml);
      if (ctx.stale()) return;
      fitDiagram();
      mount.querySelectorAll('[data-bpmn]').forEach((b) => { b.disabled = false; });
    } catch (e) {
      if (viewer) { try { viewer.destroy(); } catch {} viewer = null; }
      if (ctx.stale()) return;
      host.innerHTML = C.notificationHtml(
        `<strong>Das Diagramm konnte nicht gezeichnet werden.</strong> ${esc(e.message)}${stepsRecoveryLink()}`,
        'error', 'WarningCircle');
    }
  };
  ctx.onUnmount(() => { if (viewer) { try { viewer.destroy(); } catch {} viewer = null; } });

  // Delegate zoom controls from the tab subtree, which is replaced on redraw,
  // to avoid accumulating listeners on the router-reused mount.
  mount.querySelector('#pd-panel').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-bpmn]');
    if (!btn || !viewer) return;
    const canvas = viewer.get('canvas');
    if (btn.dataset.bpmn === 'reset') fitDiagram();
    else canvas.zoom(canvas.zoom() * (btn.dataset.bpmn === 'in' ? 1.2 : 1 / 1.2));
  });

  C.wireCatalogue(mount, {
    formId: 'pd-search', inputId: 'pd-q',
    hash: ({ q = '' } = {}) => C.catalogueHash(BASE, { q }),
  });

  C.wireTabs(mount.querySelector('.pd-detail-tabs'), {
    onSelect: (tab) => {
      active = tab;
      if (tab === 'steps') {
        if (documentLoaded) mountSteps();
        else void ensureDocument().then(() => { if (active === 'steps') mountSteps(); });
      } else if (tab === 'diagram') {
        if (!viewerStarted) void startViewer();
        else if (needsFit) requestAnimationFrame(fitDiagram);
      }
    },
    syncHash: (tab) => history.replaceState(history.state, '', detailHref(tab)),
  });

  ctx.onUnmount(C.sidebarTree(mount.querySelector('#pd-tree'), buildTree({
    all: allProcs, areas, selGroups: [], activeId: p.processId,
    hash: () => hashFor(p),
    activeDef: isPortal ? p.processId : null,
    scopeOf: () => '',
    href: (kind, value) => `${BASE}?${new URLSearchParams({ [kind]: value })}`,
  })));

  const detailTools = mount.querySelector('#pd-tools');
  if (detailTools) {
    C.wireMenu(detailTools, (action) => {
      void ensureDocument().then((hasDocument) => {
        if (ctx.stale()) return;
        if (!hasDocument) {
          mount.querySelector('[data-tab="steps"]')?.click();
          return;
        }
        runTableExport(action, {
          name: p.name,
          head: ['Nr.', 'Schritt', 'Typ', 'Rolle'],
          rows: steps.map((x) => [x.number, x.name, x.typeLabel, x.lane || '']),
        }, `prozess_${slug(p.processId, 'prozess')}`);
      });
    });
  }

  if (active === 'diagram') void startViewer();
  else if (active === 'steps') {
    void ensureDocument().then(() => { if (active === 'steps') mountSteps(); });
  }
}
