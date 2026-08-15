import { APPLICATIONS, trail } from '../crumbs.js';
import { loadExternalAssets } from '../core/external-assets.js';
import { formatDate } from '../format.js';
import { safeAssetUrl, safeMailto } from '../security/urls.js';
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
import { runTableExport, slug } from '../ui/export-table.js';
import { landscapeState } from '../ui/landscape-state.js';

// Die Achse, an der die Landschaft ihre Kaesten teilt. Prozessgruppe ist die
// Achse dieser Anwendung — sie steht im Baum, im Filter und in der Tabelle —,
// aber «Status» beantwortet eine andere, ebenso gueltige Frage: wie weit ist
// die Dokumentation. «keine» ist eine echte Wahl und kein Fehlen einer: sie
// legt alle Prozesse in ein Feld.
const AXES = [
  { value: 'bereich', label: 'Prozessbereich', of: (p) => p.areaLabel || p.branchLabel },
  { value: 'gruppe', label: 'Prozessgruppe', of: (p) => p.groupLabel },
  { value: 'status', label: 'Status', of: (p, core) => statusOf(core, p.status).label },
  { value: 'keine', label: '(keine)', of: null },
];
// Aufgeklappte Kaesten, ueber das Neuzeichnen hinweg — dasselbe Gedaechtnis wie
// im Katalog, nur unter eigener Kennung.
const BOXES = landscapeState('process-docs');

// EINE Quelle fuer die Prozessdokumentation: processes.json traegt beide Aeste
// mit allem, was eine Zeile braucht. Dazu die Diagramme unter assets/bpmn/ und
// die Kontakte fuer die Fachstelle in der Übersicht.
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
// Eine Stufe hinauf heisst hier: zurueck in die Liste, eingeschraenkt auf die
// Gruppe des Prozesses — der Ort, an dem man ihn gefunden hat.
const hashFor = (p) => `${BASE}?group=${encodeURIComponent(p.group)}`;
const truncateText = (s, n = 130) => {
  const t = String(s || '');
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
};

// Den aufgeklappten Zustand merkt sich jetzt das Seitenbaum-Bauteil, unter der
// Kennung «pd-tree» — dieselbe Mechanik fuer alle Baeume statt einer Map je App.

export default async function render(ctx) {
  const id = ctx.query.get('id');
  if (id) return detail(ctx, id);
  // Ein Portal-Ablauf ist derselbe Fall wie ein fachlicher Prozess: eine Stufe
  // des Baums mit drei Sichten. Nur die Metadaten sind andere, und die Datei
  // liegt unter einem anderen Namen.
  const def = ctx.query.get('def');
  if (def) return detail(ctx, def, { portal: true });
  return list(ctx);
}

// Der Baum, geteilt von Liste und Prozessansicht: dieselbe Spalte, dieselben
// drei Stufen, nur die Markierung unterscheidet sich.
function buildTree({ all, areas, groups, hash, selGroups, activeId, activeDef = null,
  scopeOf = () => '', pathOf = () => false, href = () => BASE, leafTab = '' }) {
  // EINE Quelle: jeder Datensatz sagt selbst, in welchem Ast er haengt
  // (branch/branchLabel), unter welcher Organisation (org) und in welcher
  // Gruppe MIT Bezeichnung (group/groupLabel). Der Baum fuegt nichts mehr
  // zusammen — er gruppiert nur noch, was auf den Zeilen steht.
  const ICON = { fachlich: 'tree/workflow', portal: 'tree/app-window' };
  const UNIT = { fachlich: 'Prozesse', portal: 'Abläufe' };

  // Die Organisation liegt UNTER dem Ast und kommt vom Datensatz — damit ein
  // zweiter Prozessbereich unter einer anderen Einheit haengen kann.
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
        // Angeklickt heisst gewaehlt UND aufgeklappt: wer eine Stufe waehlt,
        // will hineinsehen. Aber `defaultOpen`, nicht `open` — sonst liesse
        // sich die gewaehlte Zeile nicht mehr zuklappen, und genau das soll das
        // Chevron koennen: waehlen und aufklappen sind zwei Absichten.
        state: mine ? 'active' : onWay ? 'path' : '',
        defaultOpen: mine || undefined,
        split: true,
        hasChildren: true,
        children: () => kids,
      }];
    }, inner);
  };

  // Die gewaehlte Sicht reist mit, wenn man von einem Prozess zum naechsten
  // geht: wer ein Diagramm liest und den Nachbarn aufschlaegt, will das
  // Diagramm des Nachbarn — nicht wieder dessen Übersicht. Aus der LISTE
  // heraus reist sie nicht mit; dort heisst «Diagramm» die Landschaft und
  // meint etwas anderes als das BPMN eines einzelnen Ablaufs.
  const withTab = (base) => (leafTab ? `${base}&tab=${encodeURIComponent(leafTab)}` : base);
  const leafNode = (r) => ({
    id: `proc:${r.processId}`,
    label: r.name,
    href: withTab(r.branch === 'portal'
      ? `${BASE}?def=${encodeURIComponent(r.processId)}`
      : processHref(r.processId)),
    state: (activeId === r.processId || activeDef === r.processId) ? 'active' : '',
  });

  const groupNodes = (rows, holdsActive) => {
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

  // Der fachliche Ast traegt zusaetzlich seinen Prozessbereich; der Portal-Ast
  // nicht — ein Ablauf haengt am Anliegen, nicht an einer Verwaltungseinheit.
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
        children: () => groupNodes(mine, holdsActive),
      };
    });

  const branchNode = (id, rows) => {
    // Auf dem Weg liegt der Ast auch dann, wenn eine seiner GRUPPEN gewaehlt
    // ist — nicht nur, wenn ein einzelner Datensatz offen steht. Sonst bleibt
    // er zu, und die gewaehlte Gruppe waere unsichtbar.
    const holds = pathOf('branch', id) || rows.some((r) => r.processId === activeId
      || r.processId === activeDef || (selGroups.length === 1 && r.group === selGroups[0]));
    const inner = id === 'fachlich'
      ? nest(rows, areaNodes(rows, holds), holds)
      : groupNodes(rows, holds);
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
    // Symbole nur auf Stufe 1 — wie im Katalog. Damit steht Stufe 2 buendig
    // unter Stufe 1: die Symbolspalte IST ihre Einrueckung.
    levels: [{ icons: true }, { icons: false }, { icons: false }, { icons: false },
      { icons: false }, { icons: false }],
    sections: [
      // Eigener Abschnitt fuer die Wurzel — wie im Katalog. Sie ist etwas
      // anderes als die Bereiche darunter (der Weg zurueck zur ganzen Karte,
      // kein Umfang darin), und weil das Bauteil nur ZWISCHEN Abschnitten eine
      // Linie zieht, ist sie zugleich die einzige Linie der Spalte.
      [{
        id: 'root',
        // Nicht noch einmal «Prozesshierarchie»: so heisst die Spalte schon.
        label: 'Übersicht',
        // Stufe 1 fuehrt Symbole, seit es zwei Aeste gibt — ohne eines stuende
        // hier eine leere Spalte neben zwei gefuellten.
        icon: 'tree/library',
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

// Process map: list and tree.
function list(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  setTitle(TITLE);
  setCrumbs(trail(APPLICATIONS, { label: TITLE }));

  // Der ganze Bestand — beide Aeste — fuer den Baum und die Einstiegsseite.
  const everything = core.processes();
  // Die LISTE zeigt die fachlichen Prozesse. Prozessbereich, Prozessgruppe,
  // Status und Nummer sind ihre Begriffe; ein Portal-Ablauf hat keinen
  // Prozessbereich und keine TQ-Nummer, und in derselben Tabelle
  // nebeneinandergestellt behaupten die Spalten etwas Falsches ueber ihn. Er
  // hat seine eigene Stufe im Baum und seine eigenen drei Sichten.
  // JEDE Stufe ist ein Umfang, nicht nur die Gruppe: Ast, Organisation,
  // Prozessbereich, Prozessgruppe. Wer «Fachliche Prozesse» anklickt, will
  // sehen, wie sich das teilt — und von dort weiter hinein. Das Diagramm und
  // die Tabelle sind das Werkzeug dafuer, der Baum zeigt nur, wo man ist.
  //
  // Der engste gewaehlte Umfang gewinnt.
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

  // Was in der Flaeche liegt. Ohne Umfang: die fachlichen Prozesse — der
  // Portal-Ast hat weder Prozessbereich noch TQ-Nummer, und in derselben
  // Tabelle behaupteten die Spalten etwas Falsches ueber ihn.
  const all = scope ? scope.rows : everything.filter((p) => p.branch !== 'portal');
  // Der Nenner der Zaehlung: der ganze Bestand DERSELBEN Art. «3 von 3» sagt
  // nichts — «3 von 18» sagt, wie eng man steht.
  const universe = everything.filter((p) => p.branch === (scope ? (scope.rows[0] || {}).branch : 'fachlich'));
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
    // Der Zustand muss die erlaubten Sichten KENNEN, sonst faellt jede
    // unbekannte auf die Voreinstellung zurueck und der Wechsel tut nichts.
    views: ['uebersicht', 'diagramm', 'tabelle'],
    // Dieselben drei Sichten wie in der Geschaeftsarchitektur, und dieselbe
    // Voreinstellung: das Diagramm. Wer eine Prozesslandkarte oeffnet, will
    // zuerst SEHEN, wie sie sich teilt — das ist eine Frage ans Auge, keine an
    // die Leseordnung. Die Liste steht einen Klick daneben.
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

  // Die Marken zeigen, was WIRKLICH einschraenkt — also auch den Umfang aus der
  // Adresse. Ast, Organisation und Prozessbereich standen nirgends: man sah am
  // Baum, wo man war, aber die Zeile darueber behauptete «nichts gefiltert».
  // Die Gruppe kommt weiterhin ueber selGroups; sie ist Umfang UND Filter.
  const scopeChip = scope && scope.key !== 'group' ? [{ label: scope.label, href: BASE }] : [];
  const active = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hash({ q: '', page: 1 }) }] : []),
    ...scopeChip,
    ...selGroups.map((x) => ({ label: (groups.find((g) => g.key === x) || {}).label || x, href: hash({ group: selGroups.filter((y) => y !== x), page: 1 }) })),
    ...selStatus.map((x) => ({ label: statusOf(core, x).label, href: hash({ status: selStatus.filter((y) => y !== x), page: 1 }) })),
  ];

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

  // --- Die drei Flaechen -----------------------------------------------------
  // Dieselben drei wie in der Geschaeftsarchitektur, damit ein Leser, der eine
  // der beiden Anwendungen kennt, die andere nicht neu lernen muss.

  // Kaesten der Landschaft: Prozessgruppen, Kacheln sind die Prozesse. Die
  // Gruppe ist die Achse, die diese Anwendung ohnehin fuehrt — sie steht im
  // Baum, im Filter und in der Tabellenspalte.
  // Die Achse haengt an der Stufe: ein Umfang wird nach der NAECHSTEN darunter
  // geteilt. Sonst zeigte das Diagramm auf «Fachliche Prozesse» einen einzigen
  // Kasten mit achtzehn Kacheln — richtig, aber ohne Aussage. So teilt sich der
  // Ast in Prozessbereiche, der Bereich in Gruppen, und die Gruppe zeigt ihre
  // Prozesse.
  const DEFAULT_AXIS = { group: 'keine', area: 'gruppe', org: 'bereich', branch: 'bereich' };
  const defaultAxis = scope
    // Der Portal-Ast hat keinen Prozessbereich; seine naechste Stufe ist die
    // Gruppe (die Domaene der Dienstleistung).
    ? (scope.key === 'branch' && scope.value === 'portal' ? 'gruppe' : DEFAULT_AXIS[scope.key])
    : 'bereich';
  const axis = AXES.find((x) => x.value === query.get('axis'))
    || AXES.find((x) => x.value === defaultAxis)
    || AXES[0];
  // Die Achse reist mit. Ohne das verloere sie jeder Verweis, den der Baum
  // baut: man waehlt «Status», klickt eine Gruppe an, und ist wieder bei
  // «Prozessgruppe» — ohne dass man es angefasst haette.
  // Jede Adresse traegt den UMFANG und die ACHSE mit. `catalogueHash` kennt nur
  // q, page, view, sort und die angemeldeten Filter — von branch/org/area/axis
  // weiss es nichts, und was es nicht kennt, laesst es weg. Genau daran fiel der
  // Ansichtswechsel auf «Fachliche Prozesse» zurueck auf die Wurzel: der
  // Umfang verschwand aus der Adresse (Nutzerfund).
  const hashA = (patch = {}) => {
    const base = hash({
      axis: axis.value === defaultAxis ? '' : axis.value, ...patch });
    // Der Umfang steht in einem eigenen Parameter; er wird nur ersetzt, wenn
    // der Aufrufer selbst einen setzt.
    if (!scope || SCOPES.some((x) => x.param in patch)) return base;
    const [route, qs] = base.replace(/^#/, '').split('?');
    const q2 = new URLSearchParams(qs || '');
    q2.set(scope.param, scope.value);
    return `#${route}?${q2}`;
  };
  const boxes = () => {
    const tile = (p) => ({ label: p.name, href: processHref(p.processId) });
    if (!axis.of) return [{ key: 'alle', label: 'Alle Prozesse', count: sorted.length, tiles: sorted.map(tile) }];
    const by = new Map();
    for (const p of sorted) {
      const k = axis.of(p, core) || '—';
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(p);
    }
    // Groesstes Feld zuerst: die Karte liest sich vom groessten Gebiet abwaerts.
    return [...by].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'de'))
      .map(([label, mine]) => ({ key: label, label, count: mine.length, tiles: mine.map(tile) }));
  };

  // Reihenfolge wie im Katalog: erst zuklappen, dann was die Flaeche ORDNET,
  // dann was auf sie WIRKT.
  const toolsHtml = () => {
    const anyOpen = !atRoot && view === 'diagramm' && BOXES.anyOpen(boxes().map((b) => b.key));
    // Die Beschriftung sagt, was der Druck TUN wird, nicht wie der Zustand heisst.
    const fold = atRoot || view !== 'diagramm' ? '' : `
      <button type="button" class="btn btn--outline btn--sm btn--icon-left" data-lscape-all="${anyOpen ? 'shut' : 'open'}">
        ${C.icon(anyOpen ? 'Minus' : 'Plus', 'btn__icon')}
        <span class="btn__text">Alle ${anyOpen ? 'zuklappen' : 'aufklappen'}</span></button>`;
    // Gruppieren ordnet viele Prozesse; in der Übersicht steht keiner zur Wahl.
    const group = atRoot || view === 'uebersicht' ? '' : C.menu({
      menuId: 'pd-group', label: 'Gruppieren', triggerLabel: `Gruppieren: ${axis.label}`,
      items: AXES.map((x) => ({ action: `axis:${x.value}`, label: x.label })),
    });
    const actions = C.menu({
      menuId: 'pd-actions', label: 'Aktionen', triggerLabel: 'Aktionen',
      items: [
        { action: 'csv', label: 'CSV herunterladen' },
        { action: 'excel', label: 'Excel herunterladen' },
        { action: 'pdf', label: 'Drucken' },
      ],
    });
    return `<span class="mc-tools">${fold}${group}${actions}</span>`;
  };

  // Was mitgenommen wird, ist was auf dem Schirm steht — nicht der ganze
  // Bestand. Wer gefiltert hat, hat damit gesagt, was ihn angeht.
  const exportTable = () => ({
    name: selGroups.length === 1
      ? (groups.find((g) => g.key === selGroups[0]) || {}).label || TITLE : TITLE,
    head: ['Nr.', 'Prozess', 'Prozessgruppe', 'Status', 'Beschreibung'],
    rows: sorted.map((p) => [p.processId, p.name, p.groupLabel, statusOf(core, p.status).label, p.description || '']),
  });

  // Was der gewaehlte Umfang IST — nicht was darin liegt. Auf der Wurzel der
  // Bereich, sonst die Gruppe.
  // Dieselbe Form wie im Katalog: Definition, Verantwortlich, Metadaten. Vorher
  // standen hier drei Kennzahlkacheln — «18 Prozesse, 5 Prozessgruppen, 18
  // freigegeben». Die Zahlen stehen aber schon im Baum an jeder Zeile und in der
  // Zaehlung der Leiste; als Kacheln sagten sie es ein drittes Mal und liessen
  // die Fragen unbeantwortet, die eine Übersicht beantworten soll: was IST
  // dieser Umfang, wer verantwortet ihn, woher kommt er.
  const section = (title, body) =>
    `<section class="detail-section"><h2 class="detail-section__title">${esc(title)}</h2>${body}</section>`;
  const kv = (rows) => `<dl class="kv kv--ruled">${rows.filter(Boolean)
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;

  // «Wurzel» heisst: nichts eingeschraenkt. Sobald eine Gruppe, ein Status oder
  // eine Suche im Spiel ist, sieht der Leser einen Umfang an und will ihn
  // ansehen koennen — dann treten die drei Sichten an.
  const atRoot = !scope && !selGroups.length && !selStatus.length && !rawQ;

  // Die Wurzel ist kein Umfang, sondern der Weg hinein — genau wie im Katalog.
  // Darum keine Ansichtswahl und keine Metadatenliste, sondern drei Fragen, mit
  // denen ein Leser tatsaechlich ankommt: wie gross ist das hier, was hat sich
  // zuletzt bewegt, und wie teilt es sich.
  const homeHtml = () => {
    // Eine Karte je AST, nicht je Prozessgruppe. Die Gruppen gehoeren zu
    // «Immobilienmanagement (K0)», und das ist nur EINER von mehreren
    // Prozessbereichen — in der Produktion kommen weitere dazu, und dann zaehlte
    // die Einstiegsseite die Gruppen eines beliebigen davon auf. Die Aeste sind
    // die stabile Teilung: was fachlich dokumentiert ist, und was das Portal
    // selbst tut.
    // Eine Karte je Ast, gebildet aus den Datensaetzen selbst: ihr Ast und
    // dessen Bezeichnung stehen auf jeder Zeile.
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
      return `<a class="card card--default card--clickable" href="${esc(isPortal
        ? `${BASE}?branch=portal` : hashA({ q: '', sort: '', group: [], status: [], page: 1 }))}">
        <div class="card__body">
          <p class="stat__num">${rows.length}</p>
          <h2 class="stat__label">${esc((rows[0] || {}).branchLabel || bid)}</h2>
          <p class="card__text">${esc(detail)}</p>
        </div></a>`;
    }).join('');

    const recent = all.filter((x) => x.updated)
      .slice()
      .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
      .slice(0, 8);

    // Wie sich die Karte teilt — und woran jede Gruppe haengt.
    const byGroup = groups.map((g) => {
      const mine = all.filter((x) => x.group === g.key);
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
        render: (r) => `<a href="${esc(processHref(r.processId))}">${esc(r.name)}</a>` },
      { key: 'group', label: 'Prozessgruppe', width: '13rem', render: (r) => esc(r.groupLabel) },
      { key: 'status', label: 'Status', width: '9rem',
        render: (r) => esc(statusOf(core, r.status).label) },
      { key: 'updated', label: 'Geändert', width: '8rem', nowrap: true,
        render: (r) => esc(formatDate(r.updated)) },
    ] })}
      </section>

      <section class="detail-section">
        <h2 class="detail-section__title">Prozessgruppen</h2>
        ${C.table({ zebra: true, compact: true, caption: 'Prozessgruppen des Immobilienmanagements', rows: byGroup,
    columns: [
      { key: 'name', label: 'Prozessgruppe',
        render: (r) => `<a href="${esc(r.href)}">${esc(r.name)}</a>` },
      { key: 'n', label: 'Umfang', width: '11rem', render: (r) => `${r.n} Prozesse` },
      { key: 'systems', label: 'Systeme', width: '9rem', render: (r) => String(r.systems) },
    ] })}
      </section>`;
  };

  // Ein gewaehlter Umfang bekommt seine Metadaten — was er IST, wer ihn
  // verantwortet, woher er kommt.
  const scopeOverviewHtml = () => {
    const one = selGroups.length === 1 ? groups.find((g) => g.key === selGroups[0]) : null;
    const area = areas[0] || {};
    const mine = one ? all.filter((x) => x.group === one.key) : all;
    const contact = core.contacts().find((c) => c.contactId === CONTACT_ID);
    // Stand ist das juengste Datum im Umfang, nicht ein erfundenes Gesamtdatum.
    const newest = mine.map((x) => x.updated).filter(Boolean).sort().pop();
    // Die Quelle ist fuer alle Prozesse dieselbe Ablage; ein Beispiel genuegt,
    // um sie zu benennen und zu verlinken.
    const src = (mine.find((x) => x.source && x.source.url) || {}).source;
    // Systeme und Normen sind Eigenschaften der Prozesse; im Umfang
    // zusammengefasst sagen sie, woran dieser Teil der Karte haengt.
    const uniq = (key) => [...new Set(mine.flatMap((x) => x[key] || []))].sort((a, b) => a.localeCompare(b, 'de'));
    const systems = uniq('systems');
    const standards = uniq('standards');
    const byStatus = [...new Set(mine.map((x) => statusOf(core, x.status).label))];

    return section('Definition', `<p class="m-0">${one
      ? `Prozessgruppe im Bereich «${esc(area.label || '')}». Sie fasst ${mine.length} Prozesse `
        + 'zusammen, die derselben Phase des Immobilienlebenszyklus angehoeren.'
      : 'Die Prozesse des Immobilienmanagements des BBL, gegliedert in Prozessgruppen. '
        + 'Jeder Prozess ist mit BPMN-Diagramm, Prozessschritten und Verantwortlichkeiten erfasst.'}</p>`)
      + section('Verantwortlich', kv([
        ['Prozessbereich', esc(area.label || '—')],
        contact ? ['Fachstelle', esc(contact.name || contact.title || CONTACT_ID)] : null,
        contact && contact.email
          ? ['Kontakt', `<a href="${esc(safeMailto(contact.email))}">${esc(contact.email)}</a>`] : null,
      ]))
      + section('Metadaten', kv([
        one ? ['Prozessgruppe', esc(one.label)] : ['Prozessgruppen', String(groups.length)],
        ['Prozesse', String(mine.length)],
        ['Status', byStatus.length === 1 ? esc(byStatus[0]) : esc(byStatus.join(', '))],
        systems.length ? ['Systeme', esc(systems.join(' · '))] : null,
        standards.length ? ['Normen', esc(standards.join(' · '))] : null,
        newest ? ['Stand', esc(formatDate(newest))] : null,
        src && src.url
          ? ['Quelle', `<a href="${esc(src.url)}" rel="noopener">${esc(new URL(src.url).hostname)}</a>`]
          : null,
      ]));
  };

  const paneHtml = () => {
    if (!core.available('processes')) {
      return C.empty('Prozesse konnten nicht geladen werden (Ladefehler).', { available: false });
    }
    // Die Wurzel: kein Umfang gewaehlt, keine Anfrage — der Weg hinein.
    if (atRoot) return homeHtml();
    if (view === 'uebersicht') return scopeOverviewHtml();
    if (view === 'diagramm') {
      // EINE Kachel je Reihe: Prozessnamen sind Saetze, keine Begriffe.
      // Zweispaltig blieb von «Objektuebergabe an LB, Mieter» ein
      // «Objektuebergabe an L» uebrig.
      return C.landscape({ boxes: boxes(), isOpen: BOXES.isOpen, cols: 1,
        emptyText: 'In diesem Umfang ist kein Prozess erfasst.' });
    }
    // Tabelle: nach Prozessgruppe geteilt, wie im Katalog — die Achse, an der
    // auch der Baum und das Diagramm sie teilen.
    return sorted.length
      ? listView(sorted)
      : C.empty('Kein Prozess gefunden.', { hint: 'Passen Sie Ihre Suche oder die Filter an.',
        action: { label: 'Suche und Filter zurücksetzen', href: BASE } });
  };

  // Der Baum fuehrt Bereiche (L1) und Prozessgruppen (L2); die gefilterten
  // Prozesse (L3) stehen in der Liste daneben. Beide Stufen ohne Symbol — die
  // Einrueckung sagt bereits, was wozu gehoert, und ein Symbol, das auf jeder
  // Zeile dasselbe zeigt, unterscheidet nichts.
  // Eine Adresse je Stufe. Der Umfang steht in EINEM Parameter — der engste
  // gewinnt —, damit ein Verweis genau einen Umfang meint und nicht eine
  // Kombination, die niemand gewaehlt hat.
  const scopeHref = (kind, value) => {
    const qs = new URLSearchParams();
    qs.set(kind, value);
    // Die Achse reist nur mit, wenn sie von der Voreinstellung der ZIELstufe
    // abweicht — sonst schleppte jeder Verweis eine Wahl mit, die dort ohnehin
    // gilt.
    const tgt = kind === 'branch' && value === 'portal' ? 'gruppe' : (DEFAULT_AXIS[kind] || 'bereich');
    if (axis.value !== tgt && query.get('axis')) qs.set('axis', axis.value);
    if (view && view !== 'diagramm') qs.set('view', view);
    return `${BASE}?${qs}`;
  };
  // Der Weg hinauf, Stufe fuer Stufe. SCOPES laeuft von eng nach weit, also ist
  // die naechste Stufe der naechste Eintrag, dessen Wert es im Umfang gibt.
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
    all: everything, areas, groups, hash: hashA, selGroups, activeId: null,
    activeDef: query.get('def') || null,
    scopeOf: (kind) => (scope && scope.key === kind ? scope.value : ''),
    // Auf dem WEG liegt eine Stufe, wenn der gewaehlte Umfang TIEFER liegt und
    // ganz in ihr steckt. Ohne das blieben die Aeste zu, und die gewaehlte
    // Zeile waere gar nicht gezeichnet.
    pathOf: (kind, value) => {
      if (!scope || scope.key === kind) return false;
      const here = SCOPES.findIndex((x) => x.key === kind);
      const there = SCOPES.findIndex((x) => x.key === scope.key);
      // NUR nach oben. SCOPES laeuft von eng nach weit, also liegt eine Stufe
      // ueber der Auswahl, wenn ihr Index groesser ist. Ohne diese Schranke galt
      // auch jede Stufe DARUNTER als «auf dem Weg» — ein gewaehlter
      // Prozessbereich riss damit alle fuenf Gruppen und ihre achtzehn Prozesse
      // auf, obwohl niemand danach gefragt hatte.
      if (here <= there) return false;
      const dim = SCOPES[here];
      return scope.rows.some((r) => String(dim.of(r)) === String(value));
    },
    href: scopeHref,
  });

  mount.innerHTML = `
  <div class="container section">
    ${/* Zurueck, Teilen, Drucken — dieselbe Zeile wie auf jeder Detailseite des
          Portals. «Zurueck» heisst eine Stufe hinauf: von einem Umfang zur
          Wurzel, von der Wurzel aus der Anwendung heraus. */''}
    ${/* Eine Stufe hinauf, nicht gleich zur Wurzel — wie im Katalog. Von einer
          Gruppe fuehrt «Zurueck» in ihren Prozessbereich, von dort in die
          Organisation, dann in den Ast, dann zur Wurzel. Vorher sprang jede
          Stufe direkt auf die Wurzel und liess die Zwischenstufen aus, die man
          gerade durchschritten hatte. */''}
    ${C.detailBar(upFrom())}
    ${C.pageHeader({
      title: TITLE,
      lead: 'Die Prozesse des Immobilienmanagements als navigierbare Landkarte — je Prozess mit BPMN-Diagramm, Prozessschritten und Verantwortlichkeiten.',
    })}
    ${C.catalogueBar({
      formId: 'pd-search', inputId: 'pd-q', searchLabel: 'Prozess suchen', placeholder: 'Prozess suchen…', q: rawQ,
      // Zaehler, Sortierung und Filter sind vorerst draussen: sie drueckten die
      // Zeile auseinander, sobald die drei Bedienelemente und der
      // Ansichtswechsel danebenstanden. Der Umfang steht im Baum an jeder Zeile,
      // und die Ordnung uebernimmt «Gruppieren». Wenn sie zurueckkommen, dann
      // mit einer Zeile, die fuer sie gebaut ist.
      // Der Zaehler bleibt im Dokument, nur unsichtbar: die Vorlesesoftware und
      // die Live-Meldung brauchen ihn weiterhin. Weg ist er von der ZEILE.
      countId: 'pd-count', showCount: false,
      count: `<strong>${sorted.length}</strong> von ${universe.length} ${esc(unit.dat)}`,
      view,
      extra: `<span id="pd-tools">${toolsHtml()}</span>`,
      // Auf der Wurzel gibt es nichts zu wechseln: sie ist der Weg hinein, kein
      // Umfang — dieselbe Regel wie im Katalog auf Stufe 0.
      views: atRoot ? null
        : [['uebersicht', 'Übersicht', 'InfoCircle'], ['diagramm', 'Diagramm', 'Apps'],
          ['tabelle', 'Tabelle', 'List']],
    })}
    ${C.activeFilters({ filters: active, resetHref: BASE })}
    <div class="pf-layout">
      <aside class="pf-sidebar" id="pd-tree" aria-label="Prozesshierarchie"></aside>
      <div class="pf-main">
        <div id="pd-panel" class="mc-pane">${paneHtml()}</div>
      </div>
    </div>
  </div>`;

  C.announceCatalogue({ count: sorted.length, total: universe.length, unit, view });
  // hashA, nicht hash: der Ansichtswechsel und die Suche laufen hierueber, und
  // beide muessen den Umfang behalten.
  C.wireCatalogue(mount, { formId: 'pd-search', inputId: 'pd-q', hash: hashA });
  ctx.onUnmount(C.wireTableRows(mount));

  // Waehlen und Aufklappen sind jetzt zwei Bedienelemente statt eines
  // ueberladenen: das Chevron klappt, die Beschriftung navigiert. Vorher tat
  // derselbe Knopf beides, je nachdem, wo man gerade stand — «navigiert, ausser
  // wenn schon dort, dann klappt es» ist eine Regel, die man nicht sieht.
  ctx.onUnmount(C.sidebarTree(mount.querySelector('#pd-tree'), treeConfig()));

  // Die Flaeche allein neu zeichnen, wenn sich nur an ihr etwas aendert. Ein
  // Faltzustand ist keine Adresse — er soll den Verlauf nicht fuellen.
  const paneEl = mount.querySelector('#pd-panel');
  const tools = mount.querySelector('#pd-tools');
  const redraw = () => {
    if (paneEl) paneEl.innerHTML = paneHtml();
    if (tools) { tools.innerHTML = toolsHtml(); C.wireMenu(tools, onMenuAction); }
  };

  function onMenuAction(action) {
    // Die Achse NAVIGIERT: sie legt beide Sichten neu aus und ist eine seltene,
    // bewusste Wahl — anders als ein Faltzustand.
    if (action.startsWith('axis:')) {
      const v = action.slice(5);
      location.hash = hash({ axis: v === AXES[0].value ? '' : v }).slice(1);
      return;
    }
    runTableExport(action, exportTable(), `prozessdokumentation_${slug(exportTable().name, 'prozesse')}`);
  }

  if (tools) {
    C.wireMenu(tools, onMenuAction);
    tools.addEventListener('click', (e) => {
      const all = e.target.closest('[data-lscape-all]');
      if (!all) return;
      const open = all.dataset.lscapeAll === 'open';
      BOXES.setAll(boxes().map((b) => b.key), open);
      redraw();
    });
  }
  // Ein einzelner Kasten: derselbe Zustand, nur eine Zeile davon.
  if (paneEl) {
    paneEl.addEventListener('click', (e) => {
      const t = e.target.closest('.lscape__toggle');
      if (!t) return;
      BOXES.toggle(t.dataset.box);
      redraw();
    });
  }
}

// Process detail: overview, diagram, and steps.
async function detail(ctx, rawId, { portal = false } = {}) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  // URLSearchParams already decodes once; decoding again would corrupt literal percent escapes.
  // Ein Portal-Ablauf wird in die Form eines Prozesses gebracht, damit Ansicht,
  // Betrachter und Schritt-Tabelle dieselben bleiben. Was er NICHT hat —
  // Prozessbereich, Version, verantwortliche Personen — bekommt er auch nicht
  // angedichtet; seine Übersicht ist eine eigene (siehe portalOverviewHTML).
  // Kein Zusammenfuegen mehr: der Datensatz traegt alles, was die Ansicht
  // braucht — Ast, Gruppe mit Bezeichnung, Schritte, Zielgruppe, Diagrammpfad.
  // Vorher wurde ein Portal-Ablauf aus drei Dateien gebaut (Definition, Dienst,
  // Domaenenliste), und jede Zeile der Ansicht haette an einer davon scheitern
  // koennen.
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
    // Ein Portal-Ablauf haengt an `def`, ein fachlicher Prozess an `id`. Beide
    // hier zu schreiben waere falsch: mit `id` sucht der Router einen Prozess,
    // und der Ablauf «raumbedarf» ist keiner — die Sichtwahl landete auf
    // «Prozess nicht gefunden».
    const qs = new URLSearchParams(portal ? { def: p.processId } : { id: p.processId });
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

  // Was ein Portal-Ablauf IST: welches Anliegen ihn ausloest, wer ihn sieht,
  // wie viele Schritte er hat und welche Rollen daran beteiligt sind. Keine
  // Prozessbereiche und keine Versionen — die gibt es hier nicht.
  const portalOverviewHTML = () => {
    const roles = [...new Set((p.steps || []).map((x) => x.role).filter(Boolean))];
    const kinds = new Map();
    (p.steps || []).forEach((x) => kinds.set(x.kind, (kinds.get(x.kind) || 0) + 1));
    const KIND_WORD = { user: 'durch Menschen', auto: 'automatisch', system: 'durch ein System' };
    return `<section class="detail-section">
        <h2 class="detail-section__title">Definition</h2>
        <p class="m-0">${p.description ? esc(p.description)
    : 'Ein Ablauf des Portals. Die Schritte unten zeigen, welche Stationen ein Antrag durchläuft.'}</p>
      </section>
      <section class="detail-section">
        <h2 class="detail-section__title">Beteiligte</h2>
        <dl class="kv kv--ruled">
          <dt>Rollen</dt><dd>${roles.length ? roles.map((r) => esc(r)).join('<br>') : '—'}</dd>
          <dt>Zielgruppe</dt><dd>${esc(p.audience === 'external' ? 'Kundinnen und Kunden'
    : p.audience === 'internal' ? 'BBL-intern' : p.audience || '—')}</dd>
        </dl>
      </section>
      <section class="detail-section">
        <h2 class="detail-section__title">Metadaten</h2>
        <dl class="kv kv--ruled">
          <dt>Gruppe</dt><dd>${esc(p.groupLabel)}</dd>
          <dt>Schritte</dt><dd>${(p.steps || []).length}</dd>
          <dt>Art der Schritte</dt><dd>${[...kinds].map(([k, n]) => `${n} ${KIND_WORD[k] || k}`).join(' · ') || '—'}</dd>
          ${p.serviceId ? `<dt>Dienstleistung</dt><dd><a href="${esc(links.service(p.serviceId))}">${esc(p.serviceId)}</a></dd>` : ''}
          <dt>ID</dt><dd><code>${esc(p.processId)}</code></dd>
        </dl>
      </section>`;
  };

  const overviewHTML = () => (portal ? portalOverviewHTML() : `<div class="detail-layout"><div>${personsSection(p.responsiblePersons)}
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
    </aside></div>`);

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

  // Der Prozess ist eine STUFE des Baums, keine eigene Seite. Also dieselbe
  // Flaeche wie die Liste daneben: Leiste oben, Baum links, eine Flaeche rechts
  // — und die drei Schalter, die im ganzen Portal die Darstellung wechseln,
  // zeigen hier Übersicht, Diagramm und Schritte. Vorher war das ein eigenes
  // Reiterband auf einer eigenen Seite, und der Baum verschwand beim Anklicken
  // eines Prozesses: man verlor genau in dem Moment die Übersicht, in dem man
  // sich fuer einen Punkt darin entschieden hatte.
  const VIEW_OF_TAB = { overview: 'uebersicht', diagram: 'diagramm', steps: 'tabelle' };
  const TAB_OF_VIEW = { uebersicht: 'overview', diagramm: 'diagram', tabelle: 'steps' };
  const view = VIEW_OF_TAB[active];
  const core2 = core;
  const allProcs = core2.processes();
  const areas = [...new Map(allProcs.map((x) => [x.area, { key: x.area, code: x.areaCode, label: x.areaLabel }])).values()];
  const groups = [...new Map(allProcs.map((x) => [x.group, { key: x.group, label: x.groupLabel }])).values()];

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: hashFor(p), backLabel: p.groupLabel })}
    ${C.pageHeader({ title: p.name, lead: p.description || '' })}
    ${C.catalogueBar({
    formId: 'pd-search', inputId: 'pd-q', searchLabel: 'Prozess suchen',
    placeholder: 'Prozess suchen…', q: '', showCount: false,
    view,
    // «Aktionen» auch hier: dieselbe Stelle, dieselbe Moeglichkeit. Im Katalog
    // traegt jede Stufe ab 1 ihre Werkzeugzeile; die Prozessansicht hatte als
    // einzige gar keine. «Alle zuklappen» und «Gruppieren» fehlen bewusst — sie
    // betreffen die Landschaft, und ein einzelner Ablauf hat keine.
    extra: `<span id="pd-tools">${C.menu({
    menuId: 'pd-actions', label: 'Aktionen', triggerLabel: 'Aktionen',
    items: [
      { action: 'csv', label: 'CSV herunterladen' },
      { action: 'excel', label: 'Excel herunterladen' },
      { action: 'pdf', label: 'Drucken' },
    ],
  })}</span>`,
    views: [['uebersicht', 'Übersicht', 'InfoCircle'], ['diagramm', 'Diagramm', 'Apps'],
      ['tabelle', `Prozessschritte (${steps.length})`, 'List']],
  })}
    ${/* Die Marke nennt, was gewaehlt IST — den Prozess. Vorher stand hier seine
          Gruppe, und die Zeile behauptete damit einen Umfang, in dem man gar
          nicht mehr stand. Abwaehlen fuehrt eine Stufe hinauf, in eben diese
          Gruppe. */''}
    <div id="pd-activefilters">${C.activeFilters({
    filters: [{ label: p.name, href: hashFor(p) }], resetHref: BASE })}</div>
    <div class="pf-layout">
      <aside class="pf-sidebar" id="pd-tree" aria-label="Prozesshierarchie"></aside>
      <div class="pf-main">
        <div id="pd-panel" class="mc-pane">${
  active === 'overview' ? overviewHTML()
    : active === 'diagram' ? diagramHTML()
      : '<div id="pd-steps"></div>'}</div>
      </div>
    </div>
  </div>`;

  // Accessible process-step tab.
  // Nur die GEWAEHLTE Sicht steht in der Flaeche — anders als beim Reiterband,
  // das alle drei anlegte und zwei davon versteckte. Die Tabelle wird also nur
  // aufgebaut, wenn sie auch da ist.
  const stepsHost = mount.querySelector('#pd-steps');
  if (!stepsHost) { /* andere Sicht */ } else if (!xml) {
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
  mount.querySelector('#pd-panel').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-bpmn]');
    if (!btn || !viewer) return;
    const canvas = viewer.get('canvas');
    if (btn.dataset.bpmn === 'reset') fitDiagram();
    else canvas.zoom(canvas.zoom() * (btn.dataset.bpmn === 'in' ? 1.2 : 1 / 1.2));
  });

  // Der Ansichtswechsel faehrt ueber die Adresse: der Router zeichnet neu, und
  // die gewaehlte Sicht steht damit im Verlauf und im Link. Die BPMN-Datei ist
  // eine oertliche Ressource, das Neuzeichnen kostet also nichts, was den
  // Gewinn — eine Sicht, die man verschicken kann — nicht aufwiegt.
  const bar = mount.querySelector('.catbar');
  if (bar) {
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('.view-switch__btn');
      if (!b) return;
      const next = TAB_OF_VIEW[b.dataset.view];
      if (!next || next === active) return;
      syncHash(next);
      ctx.rerender ? ctx.rerender() : window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  }

  ctx.onUnmount(C.sidebarTree(mount.querySelector('#pd-tree'), buildTree({
    all: allProcs, areas, groups, selGroups: [], activeId: p.processId,
    hash: () => hashFor(p),
    activeDef: portal ? p.processId : null,
    scopeOf: () => '',
    href: (kind, value) => `${BASE}?${new URLSearchParams({ [kind]: value })}`,
    // Nur wenn es nicht ohnehin die Voreinstellung ist — sonst stuende in jeder
    // Adresse ein Parameter, der nichts aendert.
    leafTab: active === tabs[0].id ? '' : legacyValueByTab[active],
  })));

  const detailTools = mount.querySelector('#pd-tools');
  if (detailTools) {
    C.wireMenu(detailTools, (action) => {
      // Was mitgenommen wird, ist was hier steht: die Schritte dieses Prozesses.
      runTableExport(action, {
        name: p.name,
        head: ['Nr.', 'Schritt', 'Typ', 'Rolle'],
        rows: steps.map((x) => [x.number, x.name, x.typeLabel, x.lane || '']),
      }, `prozess_${slug(p.processId, 'prozess')}`);
    });
  }

  if (active === 'diagram') startViewer();
}
