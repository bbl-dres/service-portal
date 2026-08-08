// Prozessdokumentation Bauten — Prozesslandkarte des Immobilienmanagements.
//
// Route: #/app/process-docs (Detail per ?id=<processId>, Register per ?tab=).
// Geschwister des Metadatenkatalogs und bewusst dieselbe Anatomie: pf-Baum
// (Prozessbereich → Prozessgruppe) links, Katalogleiste mit Suche/Sortierung/
// Filtern, Liste/Galerie rechts; das Detail trägt die Register «Übersicht»
// (Verantwortliche, Metadaten), «Prozessdiagramm» (BPMN-Viewer) und
// «Prozessschritte» (aus dem BPMN gelesene Schrittliste). Datenbestand:
// data/processes.json (L1–L3
// denormalisiert am Datensatz), Diagramme: assets/bpmn/<processId>.bpmn.
//
// Der BPMN-Viewer ist bpmn-js (NavigatedViewer) — wie MapLibre und Swagger UI
// lazy vom CDN, mit Zeitüberschreitung und Degradation zur Fehlermeldung.
// Die Schrittliste entsteht ohne den Viewer: ein DOMParser liest die typisierten
// Flusselemente in Dokumentreihenfolge (übernommen aus dem process-hub-
// Prototyp) — sie ist zugleich die zugängliche Alternative zum Diagramm.

import { ANWENDUNGEN, trail } from '../crumbs.js';
import { datum } from '../format.js';
import * as links from '../links.js';
// escape/badge direkt aus components.js (Muster metadata-catalog.js).
import { escape as esc, badge } from '../components.js';

export const needs = ['processes', 'contacts'];

const BASE = '#/app/process-docs';
const TITEL = 'Prozessdokumentation Bauten';   // steht EINMAL hier — Seitentitel, Krume, Überschrift, Rück-Links
const PER_PAGE = 12;
// Generische Ansprechstelle der Prozesse (data/contacts.json); die PERSONEN
// je Prozess sind AdminDir-Einträge (responsiblePersons, wie im Metadatenkatalog).
const CONTACT_ID = 'immobilienmanagement';

// --- bpmn-js lazy vom CDN (Muster: loadMapLibre / loadSwaggerUI) -------------
// NavigatedViewer-Prebundle (Ansehen + Pan/Zoom, kein Modellieren); die drei
// Stylesheets (diagram-js, bpmn-js, BPMN-Font) gehören zum Viewer.
const BPMNJS_VER = '17.11.1';
let bjsPromise = null;
function loadBpmnJS() {
  if (window.BpmnJS) return Promise.resolve(window.BpmnJS);
  if (bjsPromise) return bjsPromise;
  bjsPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Zeitüberschreitung beim Laden des BPMN-Viewers')), 12000);
    for (const href of [
      `https://unpkg.com/bpmn-js@${BPMNJS_VER}/dist/assets/diagram-js.css`,
      `https://unpkg.com/bpmn-js@${BPMNJS_VER}/dist/assets/bpmn-js.css`,
      `https://unpkg.com/bpmn-js@${BPMNJS_VER}/dist/assets/bpmn-font/css/bpmn.css`,
    ]) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = href;
      document.head.appendChild(css);
    }
    const s = document.createElement('script');
    s.src = `https://unpkg.com/bpmn-js@${BPMNJS_VER}/dist/bpmn-navigated-viewer.production.min.js`;
    s.onload = () => { clearTimeout(timer); window.BpmnJS ? resolve(window.BpmnJS) : reject(new Error('BpmnJS fehlt')); };
    s.onerror = () => { clearTimeout(timer); reject(new Error('Der BPMN-Viewer konnte nicht geladen werden')); };
    document.head.appendChild(s);
  }).catch((e) => { bjsPromise = null; throw e; });   // Fehler nicht cachen → späterer Aufruf lädt neu
  return bjsPromise;
}

// --- Schrittliste aus dem BPMN-XML (DOMParser, viewer-unabhängig) ------------
// Übernommen aus dem process-hub-Prototyp (js/bpmn.js): alle typisierten
// Flusselemente in Dokumentreihenfolge; Sequenzflüsse liefern nur die
// Ein-/Ausgangszahlen. Namespace-präfix-agnostisch über getElementsByTagNameNS.
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
      nr: i + 1, id,
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

// --- Modulweite Nachschläge --------------------------------------------------
const refList = (core, key) => core.ref()[key] || [];
// Prozesse tragen denselben Lebenszyklus wie die Katalogobjekte
// (reference-data.json → objectStatuses: DRAFT/VALID/SUPERSEDED/ARCHIVED).
const statusOf = (core, id) => refList(core, 'objectStatuses').find((s) => s.id === id) || { label: id, variant: 'gray' };
const prozHref = (id) => `${BASE}?id=${encodeURIComponent(id)}`;
const kurz = (s, n = 130) => {
  const t = String(s || '');
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
};

// Nur echte Nutzerentscheide landen hier (Baum offen/zu); ohne Eintrag gilt
// der Standard. Das Modul lebt über Neu-Renders hinweg, die Seite nicht.
const OPEN = new Map();
const isOpen = (key, fallback) => (OPEN.has(key) ? OPEN.get(key) : fallback);

export default async function render(ctx) {
  const id = ctx.query.get('id');
  if (id) return detail(ctx, id);
  return list(ctx);
}

// ============================================================================
// Landkarte (Liste + Baum)
// ============================================================================
function list(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  setTitle(TITEL);
  setCrumbs(trail(ANWENDUNGEN, { label: TITEL }));

  const all = core.processes();
  // L1/L2 aus den Daten (Reihenfolge des ersten Auftretens = Prozesslebenslauf).
  const areas = [...new Map(all.map((p) => [p.area, { key: p.area, code: p.areaCode, label: p.areaLabel }])).values()];
  const groups = [...new Map(all.map((p) => [p.group, { key: p.group, label: p.groupLabel }])).values()];

  const rawQ = query.get('q') || '';
  const q = rawQ.toLowerCase();
  const multi = (param, valid) => (query.get(param) || '').split(',').map((s) => s.trim()).filter((x) => valid.includes(x));
  const selGroups = multi('group', groups.map((g) => g.key));
  const selStatus = multi('status', refList(core, 'objectStatuses').map((s) => s.id));
  const view = query.get('view') === 'gallery' ? 'gallery' : 'list';
  const wantedPage = Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1);

  const SORTS = [
    { value: 'nr', label: 'Nummer', cmp: (a, b) => a.processId.localeCompare(b.processId, undefined, { numeric: true }) },
    { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
    { value: 'group', label: 'Prozessgruppe', cmp: (a, b) => a.groupLabel.localeCompare(b.groupLabel, 'de') || a.processId.localeCompare(b.processId, undefined, { numeric: true }) },
  ];
  const sortKey = SORTS.some((s) => s.value === query.get('sort')) ? query.get('sort') : '';

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
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const page = Math.min(wantedPage, totalPages);
  const visible = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const unit = { nom: 'Prozesse', dat: 'Prozessen' };

  const base = { q: rawQ, sort: sortKey, view, group: selGroups, status: selStatus };
  const hash = (patch = {}) => C.catalogueHash(BASE, { ...base, ...patch, defaultView: 'list' });

  const active = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hash({ q: '' }) }] : []),
    ...selGroups.map((x) => ({ label: (groups.find((g) => g.key === x) || {}).label || x, href: hash({ group: selGroups.filter((y) => y !== x) }) })),
    ...selStatus.map((x) => ({ label: statusOf(core, x).label, href: hash({ status: selStatus.filter((y) => y !== x) }) })),
  ];

  const card = (p) => C.card({
    title: p.name,
    idLine: p.processId,
    desc: kurz(p.description),
    href: prozHref(p.processId),
    badges: [badge(p.groupLabel, 'blue')],
    footerInfo: esc(p.areaLabel), footerAction: C.cardAction(),
  });

  const listView = (rows) => C.table({
    caption: 'Prozesse', zebra: true, rowsClickable: true,
    columns: [
      { key: 'nr', label: 'Nr.', width: '10rem', render: (p) => `<code>${esc(p.processId)}</code>` },
      { key: 'name', label: 'Prozess', render: (p) => `<a href="${prozHref(p.processId)}">${esc(p.name)}</a><br><span class="small muted">${esc(kurz(p.description, 90))}</span>` },
      { key: 'group', label: 'Prozessgruppe', width: '13rem', render: (p) => esc(p.groupLabel) },
      { key: 'status', label: 'Status', width: '8rem', render: (p) => { const st = statusOf(core, p.status); return badge(st.label, st.variant); } },
    ],
    rows,
  });

  // Baum: Prozessbereich (L1) → Prozessgruppen (L2); die Prozesse (L3) stehen
  // als gefilterte Liste rechts — ein Gruppenklick IST der Filter.
  const row = (label, count) => `<span class="pf-tree__label">${esc(label)}</span><span class="pf-tree__n">${count}</span>`;
  const leaf = (label, count, href, on) =>
    `<li class="pf-tree__item"><a class="pf-tree__leaf plain-link interactive-control${on ? ' is-active' : ''}" href="${href}"${on ? ' aria-current="true"' : ''}>${row(label, count)}</a></li>`;
  const branch = (key, label, count, href, on, open, children) => `
    <li class="pf-tree__item">
      <button type="button" class="pf-tree__node interactive-control${on ? ' is-active' : ''}" data-branch="${key}"
        data-href="${esc(href)}" aria-expanded="${open}" aria-controls="pd-branch-${key}">
        ${C.icon('ChevronRight', 'pf-tree__chev')}${row(label, count)}</button>
      <ul class="pf-tree__children" id="pd-branch-${key}"${open ? '' : ' hidden'}>${children}</ul>
    </li>`;
  const treeHTML = () => `<ul class="pf-tree pf-tree--plain">
    ${areas.map((a) => {
      const inArea = all.filter((p) => p.area === a.key);
      const items = groups
        .filter((g) => inArea.some((p) => p.group === g.key))
        .map((g) => leaf(g.label, inArea.filter((p) => p.group === g.key).length,
          C.catalogueHash(BASE, { group: [g.key], view, defaultView: 'list' }),
          selGroups.length === 1 && selGroups[0] === g.key))
        .join('');
      return branch(a.key, `${a.label}`, inArea.length,
        // Wie kindHref des Geschwisters: Suche und Ansicht wandern mit, sonst
        // könnte der Zweigknopf bei gesetztem ?q/?view nie klappen (er
        // navigierte immer) und würfe beim Navigieren die Suche weg.
        C.catalogueHash(BASE, { q: rawQ, view, defaultView: 'list' }),
        !selGroups.length && !selStatus.length && !rawQ,
        selGroups.length ? true : isOpen(a.key, true), items);
    }).join('')}
  </ul>`;

  const filterCount = selGroups.length + selStatus.length;
  const panel = `
    ${C.filterGroup({ dim: 'group', legend: 'Prozessgruppe', selected: selGroups, idPrefix: 'pd', options: groups.map((g) => ({ value: g.key, label: g.label })) })}
    ${C.filterGroup({ dim: 'status', legend: 'Status', selected: selStatus, idPrefix: 'pd', options: refList(core, 'objectStatuses').map((s) => ({ value: s.id, label: s.label })) })}
    ${C.panelReset({ href: hash({ group: [], status: [] }) })}`;

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: TITEL,
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

  // Baumklicks: Zweigknopf navigiert, wenn er woandershin führt, sonst klappt er.
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

// ============================================================================
// Prozess-Detail (Übersicht · Prozessdiagramm · Prozessschritte)
// ============================================================================
async function detail(ctx, rawId) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  // URLSearchParams already decodes query values once. Decoding again corrupts
  // valid identifiers containing a literal percent escape such as "%2F".
  const p = core.processDoc(rawId);
  if (!p) {
    return C.renderNotFound(ctx, {
      thing: 'Dieser Prozess', title: 'Prozess nicht gefunden',
      backHref: BASE, backLabel: TITEL,
      crumbs: trail(ANWENDUNGEN, { label: TITEL, href: BASE }),
    });
  }
  setTitle(p.name);
  setCrumbs(trail(ANWENDUNGEN, { label: TITEL, href: BASE }, { label: p.name }));

  const st = statusOf(core, p.status);
  const contact = core.contacts().find((c) => c.contactId === CONTACT_ID);

  // BPMN-XML VOR dem Zeichnen holen: die Schrittliste (und ihre Registerzahl)
  // kommt aus demselben Dokument wie das Diagramm — ein Abruf für beides.
  // Scheitert er, degradieren beide Register einzeln (Meldung statt Inhalt).
  let xml = '', xmlError = '';
  try {
    const res = await fetch(encodeURI(p.bpmn), { signal: ctx.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (e) { xmlError = e.message; }
  if (ctx.stale()) return;
  const steps = xml ? parseBpmnSteps(xml) : [];

  const tabs = [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'diagramm', label: 'Prozessdiagramm' },
    { id: 'schritte', label: `Prozessschritte (${steps.length})` },
  ];
  let active = query.get('tab') || tabs[0].id;
  if (!tabs.some((x) => x.id === active)) active = tabs[0].id;
  const syncHash = (tab) => {
    const qs = new URLSearchParams({ id: p.processId });
    if (tab !== tabs[0].id) qs.set('tab', tab);
    history.replaceState(history.state, '', `${BASE}?${qs}`);
  };

  // Verantwortliche wie im Metadatenkatalog: eine PERSON ist ein AdminDir-
  // Eintrag; die generische Ansprechstelle steht als Kontakt-Karte daneben.
  const personsSection = (persons) => `
    <h2 class="detail-section__title">Verantwortliche Personen</h2>
    <div class="box">${persons && persons.length ? `<dl class="kv kv--ruled">${persons.map((x) => `
      <dt>${esc(x.role)}</dt>
      <dd><a href="https://admindir.verzeichnisse.admin.ch/person/${encodeURIComponent(x.admindirId)}"
           target="_blank" rel="noopener external">AdminDir ${esc(x.admindirId)}</a></dd>`).join('')}
    </dl>` : '<p class="muted m-0">Für diesen Prozess ist keine verantwortliche Person hinterlegt.</p>'}</div>`;

  const uebersichtHTML = () => `<div class="detail-layout"><div>${personsSection(p.responsiblePersons)}
    <section class="detail-section">
      <h2 class="detail-section__title">Metadaten</h2>
      <dl class="kv kv--ruled">
        <dt>Prozessbereich</dt><dd>${esc(p.areaLabel)} <span class="muted">(${esc(p.areaCode)})</span></dd>
        <dt>Prozessgruppe</dt><dd><a href="${C.catalogueHash(BASE, { group: [p.group] })}">${esc(p.groupLabel)}</a></dd>
        <dt>Status</dt><dd>${badge(st.label, st.variant)}</dd>
        <dt>Version</dt><dd>${esc(p.version || '—')}</dd>
        ${p.systems && p.systems.length ? `<dt>Unterstützende Systeme</dt><dd>${p.systems.map((s) => badge(s, 'gray', 'sm')).join(' ')}</dd>` : ''}
        ${p.standards && p.standards.length ? `<dt>Grundlagen</dt><dd>${p.standards.map((s) => esc(s)).join('<br>')}</dd>` : ''}
        ${p.updated ? `<dt>Stand</dt><dd>${esc(datum(p.updated))}</dd>` : ''}
        <dt>ID</dt><dd><code>${esc(p.processId)}</code></dd>
      </dl>
    </section></div>
    <aside class="detail-layout__aside" aria-label="Verwandte Prozesse und Kontakt">
      ${p.related && p.related.length ? `<div class="box">
        <h2>Verwandte Prozesse</h2>
        <ul class="list--default small m-0">${p.related.map((r) => {
          const rp = core.processDoc(r);
          return `<li><a href="${esc(links.prozess(r))}">${esc(rp ? rp.name : r)}</a></li>`;
        }).join('')}</ul>
      </div>` : ''}
      ${C.contactBox(contact, { title: 'Kontakt', heading: 'h2' })}
    </aside></div>`;

  const diagrammHTML = () => `
    <section class="detail-section">
      ${''/* KEIN role=img am Host: der Viewer injiziert interaktive Inhalte
            (bpmn.io-Link) und im Fehlerfall Meldungen mit Knopf — unter img
            wären sie für Screenreader weg. Das Tabpanel hat bereits eine
            sr-only-h2; die zugängliche Alternative steht im Register
            «Prozessschritte». */}
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
    ${C.detailBar({ backHref: BASE, backLabel: TITEL })}
    <h1 tabindex="-1">${esc(p.name)}</h1>
    ${p.description ? `<p class="lead">${esc(p.description)}</p>` : ''}
    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active, idPrefix: 'pd-tab', ariaLabel: 'Prozess' })}
      ${C.tabPanels({ items: tabs, active, idPrefix: 'pd-tab', heading: true, render: (tid) => (
        tid === 'uebersicht' ? uebersichtHTML()
          : tid === 'diagramm' ? diagrammHTML()
            : '<div id="pd-steps"></div>'
      ) })}
    </div>
  </div>`;

  // --- Schrittliste (Register «Prozessschritte») ----------------------------
  const stepsHost = mount.querySelector('#pd-steps');
  if (!xml) {
    stepsHost.innerHTML = C.notification(
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
        { value: 'ord', label: 'Reihenfolge', cmp: (a, b) => a.nr - b.nr },
        { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
      ],
      facets: [
        { dim: 'kind', legend: 'Art', options: Object.entries(KIND_LABEL).filter(([k]) => steps.some((s) => s.kind === k)).map(([value, label]) => ({ value, label })), match: (r, vals) => vals.includes(r.kind) },
        ...(lanes.length ? [{ dim: 'lane', legend: 'Rolle', options: lanes.map((l) => ({ value: l, label: l })), match: (r, vals) => vals.includes(r.lane) }] : []),
      ],
      columns: [
        { key: 'nr', label: 'Nr.', width: '4rem', align: 'right', render: (s) => String(s.nr) },
        { key: 'name', label: 'Schritt', render: (s) => s.name ? esc(s.name) : `<span class="muted">ohne Bezeichnung</span> <code class="small">${esc(s.id)}</code>` },
        { key: 'typeLabel', label: 'Typ', width: '11rem', render: (s) => esc(s.typeLabel) },
        { key: 'lane', label: 'Rolle', width: '14rem', render: (s) => s.lane ? esc(s.lane) : '<span class="muted">—</span>' },
      ],
    }));
  }

  // --- BPMN-Viewer (Register «Prozessdiagramm») ------------------------------
  // Erst beim ersten sichtbaren Aufruf des Registers: bpmn-js misst seinen
  // Behälter, und ein verstecktes Panel misst 0×0 (Einpassen liefe ins Leere).
  let viewer = null, viewerStarted = false, needsFit = false;
  // Einpassen nur bei messbarem Behälter: wechselt jemand WÄHREND des Ladens
  // (CDN, bis 12 s) aufs Schritte-Register, ist das Diagramm-Panel hidden —
  // diagram-js rechnete aus 0×0 eine nicht-endliche Matrix, der Fang unten
  // ersetzte das ganze Diagramm durch die Fehlermeldung (Review-Repro
  // 2026-08-04). Stattdessen merken und beim Rückwechsel nachholen.
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
      host.innerHTML = C.notification(
        `<strong>Das Prozessdiagramm kann nicht angezeigt werden.</strong> ${esc(xmlError || 'Die BPMN-Datei fehlt.')}`,
        'error', 'WarningCircle');
      return;
    }
    let BpmnJS;
    try {
      BpmnJS = await loadBpmnJS();
    } catch (e) {
      if (ctx.stale()) return;
      host.innerHTML = C.notification(
        `<strong>Der BPMN-Viewer konnte nicht geladen werden.</strong> ${esc(e.message)} — er kommt von unpkg.com und braucht Netzzugang. `
        + '<button type="button" class="link" onclick="location.reload()">Seite neu laden</button>',
        'error', 'WarningCircle', { live: true });
      return;
    }
    if (ctx.stale()) return;
    host.innerHTML = '';
    viewer = new BpmnJS({ container: host });
    try {
      await viewer.importXML(xml);
      if (ctx.stale()) return;
      fitDiagram();
      // Zoomleiste erst jetzt bedienbar — vorher wären die Knöpfe stumme Nieten.
      mount.querySelectorAll('[data-bpmn]').forEach((b) => { b.disabled = false; });
    } catch (e) {
      host.innerHTML = C.notification(
        `<strong>Das Diagramm konnte nicht gezeichnet werden.</strong> ${esc(e.message)}`,
        'error', 'WarningCircle');
    }
  };
  ctx.onUnmount(() => { if (viewer) { try { viewer.destroy(); } catch { /* schon weg */ } viewer = null; } });

  // Zoomleiste (delegiert). Am .tabs-KIND statt am mount: der Router verwendet
  // den mount wieder, ein Horcher dort sammelte sich je Besuch an — der
  // Teilbaum hier stirbt mit dem nächsten innerHTML (Muster pf-sidebar).
  mount.querySelector('.tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-bpmn]');
    if (!btn || !viewer) return;
    const canvas = viewer.get('canvas');
    if (btn.dataset.bpmn === 'reset') fitDiagram();
    else canvas.zoom(canvas.zoom() * (btn.dataset.bpmn === 'in' ? 1.2 : 1 / 1.2));
  });

  C.wireTabs(mount, { syncHash, onSelect: (tab) => {
    if (tab !== 'diagramm') return;
    startViewer();
    // Aufgeschobenes Einpassen nachholen, sobald das Panel wieder Masse hat.
    if (needsFit) requestAnimationFrame(fitDiagram);
  } });
  if (active === 'diagramm') startViewer();
}
