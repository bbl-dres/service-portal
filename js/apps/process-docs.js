import { APPLICATIONS, trail } from '../crumbs.js';
import { loadExternalAssets } from '../core/external-assets.js';
import { formatDate } from '../format.js';
import { safeAssetUrl } from '../security/urls.js';
// Real-estate management process catalogue.
// Route: #/app/process-docs, with ?id=<processId> details and stable ?tab values.
// It mirrors the metadata catalogue: a process-area/group tree, catalogue bar,
// list/gallery, and overview, BPMN, and accessible process-step tabs. Processes
// come from data/processes.json and diagrams from assets/bpmn/<processId>.bpmn.
// NavigatedViewer loads lazily from a CDN; DOMParser independently derives the
// ordered accessible step list and degrades failures to messages.
import * as links from '../links.js';
// Reuse escape and badge directly from components.js, as metadata-catalog does.
import { escape as esc, badge } from '../components.js';

export const needs = ['processes', 'contacts'];

const BASE = '#/app/process-docs';
const TITLE = 'Prozessdokumentation Bauten';   // Single source for title, breadcrumb, heading, and back links.
const PER_PAGE = 12;
// Generic process contact comes from contacts; responsiblePersons are individual AdminDir entries.
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

function parseBpmnSteps(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
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
    for (const d of n.getElementsByTagNameNS(BPMN_NS, 'documentation')) {
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

// Module-level lookups.
const refList = (core, key) => core.ref()[key] || [];
// Processes use the catalogue object's DRAFT/VALID/SUPERSEDED/ARCHIVED lifecycle.
const statusOf = (core, id) => refList(core, 'objectStatuses').find((s) => s.id === id) || { label: id, variant: 'gray' };
const processHref = (id) => `${BASE}?id=${encodeURIComponent(id)}`;
const truncateText = (s, n = 130) => {
  const t = String(s || '');
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
};

// Persist only explicit tree expand/collapse choices across this module's redraws.
const OPEN = new Map();
const isOpen = (key, fallback) => (OPEN.has(key) ? OPEN.get(key) : fallback);

export default async function render(ctx) {
  const id = ctx.query.get('id');
  if (id) return detail(ctx, id);
  return list(ctx);
}

// Process map: list and tree.
function list(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  setTitle(TITLE);
  setCrumbs(trail(APPLICATIONS, { label: TITLE }));

  const all = core.processes();
  // Derive L1/L2 ordering from first appearance in the process inventory.
  const areas = [...new Map(all.map((p) => [p.area, { key: p.area, code: p.areaCode, label: p.areaLabel }])).values()];
  const groups = [...new Map(all.map((p) => [p.group, { key: p.group, label: p.groupLabel }])).values()];

  const SORTS = [
    { value: 'nr', label: 'Nummer', cmp: (a, b) => a.processId.localeCompare(b.processId, undefined, { numeric: true }) },
    { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
    { value: 'group', label: 'Prozessgruppe', cmp: (a, b) => a.groupLabel.localeCompare(b.groupLabel, 'de') || a.processId.localeCompare(b.processId, undefined, { numeric: true }) },
  ];
  const state = C.catalogueState(query, {
    base: BASE, perPage: PER_PAGE,
    sortOpts: SORTS.map((s) => s.value),
    defaultView: 'list', trimQuery: false,
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

  const active = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hash({ q: '', page: 1 }) }] : []),
    ...selGroups.map((x) => ({ label: (groups.find((g) => g.key === x) || {}).label || x, href: hash({ group: selGroups.filter((y) => y !== x), page: 1 }) })),
    ...selStatus.map((x) => ({ label: statusOf(core, x).label, href: hash({ status: selStatus.filter((y) => y !== x), page: 1 }) })),
  ];

  const card = (p) => C.card({
    title: p.name,
    idLine: p.processId,
    desc: truncateText(p.description),
    href: processHref(p.processId),
    badges: [badge(p.groupLabel, 'blue')],
    footerInfo: esc(p.areaLabel), footerAction: C.cardAction(),
  });

  const listView = (rows) => C.table({
    caption: 'Prozesse', zebra: true, rowsClickable: true,
    columns: [
      { key: 'number', label: 'Nr.', width: '10rem', render: (p) => `<code>${esc(p.processId)}</code>` },
      { key: 'name', label: 'Prozess', render: (p) => `<a href="${processHref(p.processId)}">${esc(p.name)}</a><br><span class="small muted">${esc(truncateText(p.description, 90))}</span>` },
      { key: 'group', label: 'Prozessgruppe', width: '13rem', render: (p) => esc(p.groupLabel) },
      { key: 'status', label: 'Status', width: '8rem', render: (p) => { const st = statusOf(core, p.status); return badge(st.label, st.variant); } },
    ],
    rows,
  });

  // The tree contains L1 areas and L2 groups; filtered L3 processes appear in the list.
  const row = (label, count) => `<span class="pf-tree__label">${esc(label)}</span><span class="pf-tree__n">${count}</span>`;
  const leaf = (label, count, href, on) =>
    `<li class="pf-tree__item"><a class="pf-tree__leaf plain-link interactive-control${on ? ' is-active' : ''}" href="${href}"${on ? ' aria-current="true"' : ''}>${row(label, count)}</a></li>`;
  const branch = (key, domId, label, count, href, on, open, children) => `
    <li class="pf-tree__item">
      <button type="button" class="pf-tree__node interactive-control${on ? ' is-active' : ''}" data-branch="${esc(key)}"
        data-href="${esc(href)}" aria-expanded="${open}" aria-controls="${domId}">
        ${C.icon('ChevronRight', 'pf-tree__chev')}${row(label, count)}</button>
      <ul class="pf-tree__children" id="${domId}"${open ? '' : ' hidden'}>${children}</ul>
    </li>`;
  const treeHTML = () => `<ul class="pf-tree pf-tree--plain">
    ${areas.map((a, areaIndex) => {
      const inArea = all.filter((p) => p.area === a.key);
      const items = groups
        .filter((g) => inArea.some((p) => p.group === g.key))
        .map((g) => leaf(g.label, inArea.filter((p) => p.group === g.key).length,
          hash({ q: '', sort: '', group: [g.key], status: [], page: 1 }),
          selGroups.length === 1 && selGroups[0] === g.key))
        .join('');
      return branch(a.key, `pd-branch-${areaIndex}`, `${a.label}`, inArea.length,
        // Preserve query and view when building branch links so an active branch
        // can toggle without discarding search state.
        hash({ sort: '', group: [], status: [], page: 1 }),
        !selGroups.length && !selStatus.length && !rawQ,
        selGroups.length ? true : isOpen(a.key, true), items);
    }).join('')}
  </ul>`;

  const filterCount = selGroups.length + selStatus.length;
  const panel = `
    ${C.filterGroup({ dim: 'group', legend: 'Prozessgruppe', selected: selGroups, idPrefix: 'pd', options: groups.map((g) => ({ value: g.key, label: g.label })) })}
    ${C.filterGroup({ dim: 'status', legend: 'Status', selected: selStatus, idPrefix: 'pd', options: refList(core, 'objectStatuses').map((s) => ({ value: s.id, label: s.label })) })}
    ${C.panelReset({ href: hash({ group: [], status: [], page: 1 }) })}`;

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: TITLE,
      lead: 'Die Prozesse des Immobilienmanagements als navigierbare Landkarte — je Prozess mit BPMN-Diagramm, Prozessschritten und Verantwortlichkeiten.',
    })}
    ${C.catalogueBar({
      formId: 'pd-search', inputId: 'pd-q', searchLabel: 'Prozess suchen', placeholder: 'Prozess suchen…', q: rawQ,
      countId: 'pd-count',
      count: `<strong>${sorted.length}</strong> von ${all.length} ${esc(unit.dat)}${totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : ''}`,
      sort: { id: 'pd-sort', value: sortKey, options: SORTS.map((s) => ({ value: s.value, label: s.label })) },
      filterId: 'pd-filter', filterLabel: 'Filter', filterCount,
      panelId: 'pd-filters', panel,
      view, views: [['list', 'Listenansicht', 'List'], ['gallery', 'Galerieansicht', 'Apps']],
    })}
    ${C.activeFilters({ filters: active, resetHref: BASE })}
    <div class="pf-layout">
      <aside class="pf-sidebar" aria-label="Prozesshierarchie">
        <div class="pf-sidebar__head"><h2 class="pf-sidebar__title">Prozesshierarchie</h2></div>
        ${treeHTML()}
      </aside>
      <div class="pf-main">
        ${C.catalogueResults({
          resetHref: BASE, visible, count: sorted.length,
          view, page, totalPages,
          card, listView, unit, gridCls: 'grid grid--responsive-cols-2',
          regionLabel: 'Prozesse',
          paginationInputId: 'pd-page', paginationLabel: 'Seitennavigation Prozesse',
          paginationHref: (p) => hash({ page: p }),
          available: core.available('processes'),
        })}
      </div>
    </div>
  </div>`;

  C.announceCatalogue({ count: sorted.length, total: all.length, unit, page, totalPages, view });
  C.wireCatalogue(mount, {
    formId: 'pd-search', inputId: 'pd-q', pageInputId: 'pd-page', page, totalPages, hash,
    sortId: 'pd-sort', filterToggleId: 'pd-filter', panelId: 'pd-filters',
  });
  ctx.onUnmount(C.wireTableRows(mount));

  // A branch control navigates when changing branch and toggles when already active.
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
    const kids = mount.querySelector(`#${btn.getAttribute('aria-controls')}`);
    if (kids) kids.hidden = open;
    OPEN.set(btn.dataset.branch, !open);
  });
}

// Process detail: overview, diagram, and steps.
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
  setTitle(p.name);
  setCrumbs(trail(APPLICATIONS, { label: TITLE, href: BASE }, { label: p.name }));

  const st = statusOf(core, p.status);
  const contact = core.contacts().find((c) => c.contactId === CONTACT_ID);

  // Fetch BPMN XML before rendering because step count and diagram share it.
  // On failure, each tab degrades independently to a message.
  let xml = '', xmlError = '';
  try {
    const bpmnUrl = safeAssetUrl(p.bpmn, 'assets/bpmn/');
    if (!bpmnUrl || !bpmnUrl.toLowerCase().endsWith('.bpmn')) throw new Error('Ungültiger BPMN-Dateipfad');
    const res = await fetch(encodeURI(bpmnUrl), { signal: ctx.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (e) { xmlError = e.message; }
  if (ctx.stale()) return;
  const steps = xml ? parseBpmnSteps(xml) : [];

  const tabByLegacyValue = { 'uebersicht': 'overview', 'diagramm': 'diagram', 'schritte': 'steps' };
  const legacyValueByTab = Object.fromEntries(Object.entries(tabByLegacyValue).map(([legacy, tab]) => [tab, legacy]));
  const tabs = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'diagram', label: 'Prozessdiagramm' },
    { id: 'steps', label: `Prozessschritte (${steps.length})` },
  ];
  let active = tabByLegacyValue[query.get('tab')] || tabs[0].id;
  if (!tabs.some((x) => x.id === active)) active = tabs[0].id;
  const syncHash = (tab) => {
    const qs = new URLSearchParams({ id: p.processId });
    if (tab !== tabs[0].id) qs.set('tab', legacyValueByTab[tab]);
    history.replaceState(history.state, '', `${BASE}?${qs}`);
  };

  // Responsible people are AdminDir entries; the generic contact remains a side card.
  const personsSection = (persons) => `
    <h2 class="detail-section__title">Verantwortliche Personen</h2>
    <div class="box">${persons && persons.length ? `<dl class="kv kv--ruled">${persons.map((x) => `
      <dt>${esc(x.role)}</dt>
      <dd><a href="https://admindir.verzeichnisse.admin.ch/person/${encodeURIComponent(x.admindirId)}"
           target="_blank" rel="noopener noreferrer external">AdminDir ${esc(x.admindirId)}</a></dd>`).join('')}
    </dl>` : '<p class="muted m-0">Für diesen Prozess ist keine verantwortliche Person hinterlegt.</p>'}</div>`;

  const overviewHTML = () => `<div class="detail-layout"><div>${personsSection(p.responsiblePersons)}
    <section class="detail-section">
      <h2 class="detail-section__title">Metadaten</h2>
      <dl class="kv kv--ruled">
        <dt>Prozessbereich</dt><dd>${esc(p.areaLabel)} <span class="muted">(${esc(p.areaCode)})</span></dd>
        <dt>Prozessgruppe</dt><dd><a href="${C.catalogueHash(BASE, { group: [p.group] })}">${esc(p.groupLabel)}</a></dd>
        <dt>Status</dt><dd>${badge(st.label, st.variant)}</dd>
        <dt>Version</dt><dd>${esc(p.version || '—')}</dd>
        ${p.systems && p.systems.length ? `<dt>Unterstützende Systeme</dt><dd>${p.systems.map((s) => badge(s, 'gray', 'sm')).join(' ')}</dd>` : ''}
        ${p.standards && p.standards.length ? `<dt>Grundlagen</dt><dd>${p.standards.map((s) => esc(s)).join('<br>')}</dd>` : ''}
        ${p.updated ? `<dt>Stand</dt><dd>${esc(formatDate(p.updated))}</dd>` : ''}
        <dt>ID</dt><dd><code>${esc(p.processId)}</code></dd>
      </dl>
    </section></div>
    <aside class="detail-layout__aside" aria-label="Verwandte Prozesse und Kontakt">
      ${p.related && p.related.length ? `<div class="box">
        <h2>Verwandte Prozesse</h2>
        <ul class="list--default small m-0">${p.related.map((r) => {
          const rp = core.processDoc(r);
          return `<li><a href="${esc(links.processDocumentation(r))}">${esc(rp ? rp.name : r)}</a></li>`;
        }).join('')}</ul>
      </div>` : ''}
      ${/* Above the contact: «where is the original» is the question a reader of a
            directory entry has next, and it is about the record rather than about
            whom to ask. */''}
      ${C.sourceBox(p.source, (core.ref().sourceRoles || []).find((r) => r.key === (p.source || {}).role))}
      ${C.contactBox(contact, { title: 'Kontakt', heading: 'h2' })}
    </aside></div>`;

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

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: BASE, backLabel: TITLE })}
    <h1 tabindex="-1">${esc(p.name)}</h1>
    ${p.description ? `<p class="lead">${esc(p.description)}</p>` : ''}
    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active, idPrefix: 'pd-tab', ariaLabel: 'Prozess' })}
      ${C.tabPanels({ items: tabs, active, idPrefix: 'pd-tab', heading: true, render: (tid) => (
        tid === 'overview' ? overviewHTML()
          : tid === 'diagram' ? diagramHTML()
            : '<div id="pd-steps"></div>'
      ) })}
    </div>
  </div>`;

  // Accessible process-step tab.
  const stepsHost = mount.querySelector('#pd-steps');
  if (!xml) {
    stepsHost.innerHTML = C.notificationHtml(
      `<strong>Die Prozessschritte können nicht gelesen werden.</strong> Das BPMN-Diagramm (${esc(p.bpmn)}) ist nicht erreichbar${xmlError ? ` — ${esc(xmlError)}` : ''}.`,
      'error', 'WarningCircle');
  } else {
    const lanes = [...new Set(steps.map((s) => s.lane).filter(Boolean))];
    ctx.onUnmount(C.mountDataTable(stepsHost, {
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
    }));
  }

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
    if (!xml) {
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
        + '<button type="button" class="link" data-reload-page>Seite neu laden</button>',
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
      // Enable zoom controls only after a viewer exists.
      mount.querySelectorAll('[data-bpmn]').forEach((b) => { b.disabled = false; });
    } catch (e) {
      if (viewer) { try { viewer.destroy(); } catch { /* Partially initialised. */ } viewer = null; }
      if (ctx.stale()) return;
      host.innerHTML = C.notificationHtml(
        `<strong>Das Diagramm konnte nicht gezeichnet werden.</strong> ${esc(e.message)}`,
        'error', 'WarningCircle');
    }
  };
  ctx.onUnmount(() => { if (viewer) { try { viewer.destroy(); } catch { /* Already removed. */ } viewer = null; } });

  // Delegate zoom controls from the tab subtree, which is replaced on redraw,
  // to avoid accumulating listeners on the router-reused mount.
  mount.querySelector('.tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-bpmn]');
    if (!btn || !viewer) return;
    const canvas = viewer.get('canvas');
    if (btn.dataset.bpmn === 'reset') fitDiagram();
    else canvas.zoom(canvas.zoom() * (btn.dataset.bpmn === 'in' ? 1.2 : 1 / 1.2));
  });

  C.wireTabs(mount, { syncHash, onSelect: (tab) => {
    if (tab !== 'diagram') return;
    startViewer();
    // Complete deferred fitting once the panel is visible and measurable again.
    if (needsFit) requestAnimationFrame(fitDiagram);
  } });
  if (active === 'diagram') startViewer();
}
