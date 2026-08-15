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

// Die Achse, an der die Landschaft ihre Kaesten teilt. Prozessgruppe ist die
// Achse dieser Anwendung — sie steht im Baum, im Filter und in der Tabelle —,
// aber «Status» beantwortet eine andere, ebenso gueltige Frage: wie weit ist
// die Dokumentation. «keine» ist eine echte Wahl und kein Fehlen einer: sie
// legt alle Prozesse in ein Feld.
const AXES = [
  { value: 'gruppe', label: 'Prozessgruppe', of: (p) => p.groupLabel },
  { value: 'status', label: 'Status', of: (p, core) => statusOf(core, p.status).label },
  { value: 'keine', label: '(keine)', of: null },
];
// Aufgeklappte Kaesten, ueber das Neuzeichnen hinweg — wie im Katalog.
const BOXES = new Map();
const boxOpen = (key) => (BOXES.has(key) ? BOXES.get(key) : true);

export const needs = ['processes', 'processDefinitions', 'services', 'contacts'];

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
  return list(ctx);
}

// Der Baum, geteilt von Liste und Prozessansicht: dieselbe Spalte, dieselben
// drei Stufen, nur die Markierung unterscheidet sich.
function buildTree({ all, areas, groups, hash, selGroups, activeId, org = [], branches = [], defs = [], activeDef = null, services = [], domains = [] }) {
  // Zwei Aeste, wie der Katalog drei hat.
  //
  // «Fachliche Prozesse» sind die Prozesse des Immobilienmanagements, wie das
  // Architektur-Repository sie fuehrt. Darunter haengt die Organisation
  // (BBL Bauten) und darunter der Prozessbereich — «Immobilienmanagement (K0)»
  // ist nur EINER davon, in der Produktion kommen weitere dazu.
  //
  // «Kundenportal» sind die Ablaeufe des Portals selbst: welche Schritte ein
  // Antrag durchlaeuft und wer ihn bearbeitet. Sie standen bisher nirgends,
  // obwohl sie dokumentiert sind — und wer sie nicht sieht, kann auch nicht
  // sagen, dass ein Schritt fehlt oder einer zu viel ist.
  const ICON = { fachlich: 'tree/workflow', portal: 'tree/app-window' };

  // Die Organisation liegt UNTER dem fachlichen Ast: sie sagt, wo dessen
  // Prozesse haengen. Sie traegt keinen Verweis — es gibt nichts, was sie
  // einschraenken wuerde.
  // Offen ist, was auf dem WEG zur Auswahl liegt — sonst nichts. Vorher stand
  // der ganze Baum aufgeschlagen da: neun Portal-Ablaeufe und fuenf
  // Prozessgruppen auf einmal, obwohl der Leser noch nichts gewaehlt hatte.
  // Der Katalog macht es umgekehrt und richtig: die Wurzel zeigt die Aeste,
  // aufgeklappt wird, was man ansieht.
  const nest = (inner, onPath) => org.reduceRight((kids, o) => [{
    id: `org:${o.id}`,
    label: o.label,
    count: all.length,
    countUnit: 'Prozesse',
    state: onPath ? 'path' : '',
    hasChildren: true,
    children: () => kids,
  }], inner);

  // Die Portal-Ablaeufe haengen an denselben Gruppen wie die Dienstleistungen
  // im Menue «Dienstleistungen» — Unterbringung, Objektbetrieb, Beschaffung und
  // so fort. Sie ueber den Dienst zu gruppieren statt sie flach aufzureihen ist
  // nicht Kosmetik: ein Ablauf gehoert zu dem Anliegen, das ihn ausloest, und
  // genau darueber sucht ihn jemand.
  const defNode = (d) => ({
    id: `def:${d.defId}`,
    label: d.name,
    count: (d.steps || []).length,
    countUnit: 'Schritte',
    href: `${BASE}?def=${encodeURIComponent(d.defId)}`,
    state: activeDef === d.defId ? 'active' : '',
  });
  const portalNodes = () => {
    const byDomain = new Map();
    for (const d of defs) {
      const svc = services.find((x) => x.processDefId === d.defId || x.serviceId === d.serviceId);
      const key = svc ? svc.domain : '';
      if (!byDomain.has(key)) byDomain.set(key, []);
      byDomain.get(key).push(d);
    }
    return [...byDomain]
      .map(([key, mine]) => {
        const dom = domains.find((x) => x.key === key);
        return {
          id: `dom:${key || 'ohne'}`,
          label: dom ? dom.label : 'Ohne Zuordnung',
          count: mine.length,
          countUnit: 'Abläufe',
          state: mine.some((d) => d.defId === activeDef) ? 'path' : '',
          hasChildren: true,
          children: () => mine.map(defNode),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'de'));
  };

  const branchNode = (b, kids, holdsActive) => ({
    id: `branch:${b.id}`,
    label: b.label,
    count: b.id === 'portal' ? defs.length : all.length,
    countUnit: b.id === 'portal' ? 'Abläufe' : 'Prozesse',
    icon: ICON[b.id],
    state: holdsActive ? 'path' : '',
    hasChildren: kids.length > 0,
    children: () => kids,
  });

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
        count: all.length,
        countUnit: 'Prozesse',
        href: hash({ q: '', sort: '', group: [], status: [], page: 1 }),
        state: !activeId && !selGroups.length ? 'active' : '',
      }],
      [
        branchNode(branches.find((b) => b.id === 'fachlich') || { id: 'fachlich', label: 'Fachliche Prozesse' },
          nest(areas.map((a) => {
      const inArea = all.filter((p) => p.area === a.key);
      const mine = groups.filter((g) => inArea.some((p) => p.group === g.key));
      // Ein Bereich liegt auf dem WEG zur Auswahl, wenn eine seiner Gruppen
      // gewaehlt ist — er ist nie selbst die Auswahl. Vorher trug er
      // «is-active», sobald ueberhaupt nicht gefiltert war: dann leuchteten
      // alle sechs Bereiche gleichzeitig, was nichts aussagt.
      const holdsSel = selGroups.length === 1 && mine.some((g) => g.key === selGroups[0]);
      return {
        id: `area:${a.key}`,
        label: a.label,
        count: inArea.length,
        countUnit: 'Prozesse',
        // Der Bereich ist keine Filterachse — sein Verweis raeumt den
        // Gruppenfilter ab. Suche und Ansicht bleiben stehen, damit ein Wechsel
        // nicht nebenbei den Suchtext wegwirft.
        href: hash({ sort: '', group: [], status: [], page: 1 }),
        state: holdsSel || (activeId && inArea.some((x) => x.processId === activeId)) ? 'path' : '',
        // Geteilte Zeile: das Chevron klappt, die Beschriftung navigiert. Ohne
        // das waere die Zeile ein blosser Verweis mit einem Chevron, das nur
        // aussieht wie ein Bedienelement — anfassen liesse es sich nicht.
        split: true,

        hasChildren: mine.length > 0,
        children: () => mine.map((g) => {
          const procs = inArea.filter((p) => p.group === g.key);
          return {
            id: `group:${g.key}`,
            label: g.label,
            count: procs.length,
            countUnit: 'Prozesse',
            href: hash({ q: '', sort: '', group: [g.key], status: [], page: 1 }),
            state: activeId && procs.some((x) => x.processId === activeId) ? 'path'
              : selGroups.length === 1 && selGroups[0] === g.key ? 'active' : '',
            // Wie der Datensatz im Katalog: die Beschriftung waehlt den Umfang,
            // das Chevron zeigt, was drin liegt. Zwei Absichten, zwei
            // Bedienelemente.
            split: true,
            // Eine Gruppe zu waehlen heisst NICHT, ihre Prozesse aufzuklappen —
            // dieselbe Entscheidung wie bei den Attributen im Katalog. Wer den
            // Umfang einschraenkt, will die Liste daneben sehen, nicht eine
            // zweite Liste derselben Namen in der Spalte.
            hasChildren: procs.length > 0,
            children: () => procs
              .slice()
              .sort((x, y) => x.processId.localeCompare(y.processId, undefined, { numeric: true }))
              .map((pr) => ({
                id: `proc:${pr.processId}`,
                // Kein Zaehler: unter einem Prozess liegt nichts mehr, und eine
                // Zahl, die nichts zaehlt, ist eine Frage ohne Gegenstand.
                //
                // Und keine Nummer vor dem Namen. Im Liegenschaften-Baum steht
                // sie dort («AF Bundeshaus West»), weil sie zwei Zeichen lang
                // ist. «TQ.21.00.00.30» ist vierzehn und frisst in einer 288px
                // breiten Spalte genau den Teil des Namens, der die
                // Geschwister unterscheidet: gemessen standen alle drei
                // Prozesse der Bewirtschaftung als «Bewirtschaf…» da, und die
                // Unterschiede — «Anmiet-, Pachtvertraege», «Eigentum,
                // Stiftungen», «von Vermietungen» — waren abgeschnitten. Die
                // Nummer steht in der Spalte «Nr.» der Tabelle und auf der
                // Detailseite; der Baum dient dem Finden nach Namen.
                label: pr.name,
                href: processHref(pr.processId),
                // Der gewaehlte Prozess ist die Auswahl; seine Gruppe und sein
                // Bereich liegen auf dem Weg dorthin. Das Bauteil klappt einen
                // Weg von selbst auf, also findet man die Zeile auch dann, wenn
                // man ueber einen Verweis von aussen hereinkommt.
                state: activeId === pr.processId ? 'active' : '',
              })),
          };
        }),
      };
          }), !activeDef && (!!activeId || !!selGroups.length)),
        !activeDef && (!!activeId || !!selGroups.length)),
        branchNode(branches.find((b) => b.id === 'portal') || { id: 'portal', label: 'Kundenportal' },
          portalNodes(), !!activeDef),
      ],
    ],
  });
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

  // --- Die drei Flaechen -----------------------------------------------------
  // Dieselben drei wie in der Geschaeftsarchitektur, damit ein Leser, der eine
  // der beiden Anwendungen kennt, die andere nicht neu lernen muss.

  // Kaesten der Landschaft: Prozessgruppen, Kacheln sind die Prozesse. Die
  // Gruppe ist die Achse, die diese Anwendung ohnehin fuehrt — sie steht im
  // Baum, im Filter und in der Tabellenspalte.
  const axis = AXES.find((x) => x.value === query.get('axis')) || AXES[0];
  // Die Achse reist mit. Ohne das verloere sie jeder Verweis, den der Baum
  // baut: man waehlt «Status», klickt eine Gruppe an, und ist wieder bei
  // «Prozessgruppe» — ohne dass man es angefasst haette.
  const hashA = (patch = {}) => hash({
    axis: axis.value === AXES[0].value ? '' : axis.value, ...patch });
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
    const anyOpen = !atRoot && view === 'diagramm' && boxes().some((b) => boxOpen(`box:${b.key}`));
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
  const atRoot = !selGroups.length && !selStatus.length && !rawQ;

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
    const branches = refList(core, 'processBranches');
    const cards = branches.map((b) => {
      const isPortal = b.id === 'portal';
      const n = isPortal ? defs.length : all.length;
      const detail = isPortal
        ? `${defs.reduce((a, d) => a + (d.steps || []).length, 0)} Schritte · `
          + `${new Set(defs.map((d) => d.audience)).size} Zielgruppen`
        : `${groups.length} Prozessgruppen · ${new Set(all.map((x) => x.area)).size} Prozessbereich`;
      return `<a class="card card--default card--clickable" href="${esc(isPortal
        ? `${BASE}?branch=portal` : hashA({ q: '', sort: '', group: [], status: [], page: 1 }))}">
        <div class="card__body">
          <p class="stat__num">${n}</p>
          <h2 class="stat__label">${esc(b.label)}</h2>
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
      return C.landscape({ boxes: boxes(), isOpen: (key) => boxOpen(`box:${key}`), cols: 1,
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
  const defs = core.processDefinitions ? core.processDefinitions() : [];
  const treeConfig = () => buildTree({
    all, areas, groups, hash: hashA, selGroups, activeId: null,
    org: refList(core, 'processOrgLevels'),
    branches: refList(core, 'processBranches'),
    defs, activeDef: query.get('def') || null,
    services: core.services ? core.services() : [], domains: refList(core, 'domains'),
  });

  const filterCount = selGroups.length + selStatus.length;
  const panel = `
    ${C.filterGroup({ dim: 'group', legend: 'Prozessgruppe', selected: selGroups, idPrefix: 'pd', options: groups.map((g) => ({ value: g.key, label: g.label })) })}
    ${C.filterGroup({ dim: 'status', legend: 'Status', selected: selStatus, idPrefix: 'pd', options: refList(core, 'objectStatuses').map((s) => ({ value: s.id, label: s.label })) })}
    ${C.panelReset({ href: hash({ group: [], status: [], page: 1 }) })}`;

  mount.innerHTML = `
  <div class="container section">
    ${/* Zurueck, Teilen, Drucken — dieselbe Zeile wie auf jeder Detailseite des
          Portals. «Zurueck» heisst eine Stufe hinauf: von einem Umfang zur
          Wurzel, von der Wurzel aus der Anwendung heraus. */''}
    ${C.detailBar(atRoot
    ? { backHref: '#/applications', backLabel: 'Anwendungen' }
    : { backHref: BASE, backLabel: TITLE })}
    ${C.pageHeader({
      title: TITLE,
      lead: 'Die Prozesse des Immobilienmanagements als navigierbare Landkarte — je Prozess mit BPMN-Diagramm, Prozessschritten und Verantwortlichkeiten.',
    })}
    ${C.catalogueBar({
      formId: 'pd-search', inputId: 'pd-q', searchLabel: 'Prozess suchen', placeholder: 'Prozess suchen…', q: rawQ,
      countId: 'pd-count',
      // Keine Seitenangabe mehr: seit die Flaeche Diagramm, Tabelle und Übersicht
      // zeigt statt einer geblaetterten Kartenliste, gibt es keine Seiten. «Seite
      // 1 von 2» versprach eine zweite, die es nicht gibt.
      count: `<strong>${sorted.length}</strong> von ${all.length} ${esc(unit.dat)}`,
      sort: { id: 'pd-sort', value: sortKey, options: SORTS.map((s) => ({ value: s.value, label: s.label })) },
      filterId: 'pd-filter', filterLabel: 'Filter', filterCount,
      panelId: 'pd-filters', panel,
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

  C.announceCatalogue({ count: sorted.length, total: all.length, unit, view });
  C.wireCatalogue(mount, {
    formId: 'pd-search', inputId: 'pd-q', hash,
    sortId: 'pd-sort', filterToggleId: 'pd-filter', panelId: 'pd-filters',
  });
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
      boxes().forEach((b) => BOXES.set(`box:${b.key}`, open));
      redraw();
    });
  }
  // Ein einzelner Kasten: derselbe Zustand, nur eine Zeile davon.
  if (paneEl) {
    paneEl.addEventListener('click', (e) => {
      const t = e.target.closest('.lscape__toggle');
      if (!t) return;
      const key = `box:${t.dataset.box}`;
      BOXES.set(key, !boxOpen(key));
      redraw();
    });
  }
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
    views: [['uebersicht', 'Übersicht', 'InfoCircle'], ['diagramm', 'Diagramm', 'Apps'],
      ['tabelle', `Prozessschritte (${steps.length})`, 'List']],
  })}
    <div id="pd-activefilters">${C.activeFilters({
    filters: [{ label: p.groupLabel, remove: 'scope' }], resetHref: BASE })}</div>
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
    hash: () => hashFor(p), org: refList(core, 'processOrgLevels'),
    branches: refList(core, 'processBranches'),
    defs: core.processDefinitions ? core.processDefinitions() : [],
    services: core.services ? core.services() : [], domains: refList(core, 'domains'),
  })));

  if (active === 'diagram') startViewer();
}
