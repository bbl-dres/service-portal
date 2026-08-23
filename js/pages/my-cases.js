// My cases — running cases driven by the mock process engine.
import { statusLabel } from '../domain.js';
import { formatDate } from '../format.js';
import * as links from '../links.js';
import { bookmarks } from '../core/bookmarks.js';
import { bookmarkNeeds, resolveBookmarks } from '../ui/bookmark-kinds.js';
import {
  caseHeader, caseOverview, caseAside, caseSection, caseRow, sectionsFromData,
  historyTimeline, commentsList, caseEmpty, attachmentColumns, caseActions, caseCommentForm,
  mergeSections,
} from '../ui/case-view.js';

// Deferred collections for this route. The router calls core.ensure(needs)
// BEFORE render(); without this declaration, an accessor would read the still
// empty list and the view would show «no entries» instead of data
// (docs/code-review.md §3).
// `users` carries the bookmark seed for the favourites band below the table.
// The band loads whatever ITS OWN entries reference on top of this, after first
// paint (renderBookmarks).
// `projects` is read ONLY by the detail view (case → linked project), so the
// LIST does not block on it — needs is a function of the route params (the
// data.js pattern; code review 2026-08, F-S17).
//
// `buildings` (66 KB) MOVED BACK into the list branch when the list gained its
// «Objekt» column (docs/case-view-alignment.md L4). F-S17's reasoning was that
// the list blocked on data only the detail used; that stops being true the
// moment a row names its building. The favourites band below the table already
// pulls the same file for most people, so in practice this is one request
// earlier rather than one request more.
export const needs = (params) => (params && params[0]
  ? ['buildings', 'projects', 'users']
  : ['buildings', 'users']);
export default async function render(ctx) {
  const { mount, params, session, core, engine, C, setTitle, setCrumbs, onUnmount } = ctx;

  // Personal cases is the only personal area. When signed out, prompt for
  // authentication rather than showing its content (catalogue content stays public).
  if (!session.isLoggedIn()) {
    setTitle('Meine Vorgänge');
    setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Meine Vorgänge' }]);
    mount.innerHTML = `
    <div class="container section">
      ${C.pageHeader({ title: 'Meine Vorgänge', lead: 'Ihre persönlichen Anfragen und Bestellungen.' })}
      ${C.loginGate('«Meine Vorgänge» zeigt die von Ihnen ausgelösten Anfragen und Bestellungen. Bitte melden Sie sich mit AGOV / FedLogin an, um Ihre Vorgänge zu sehen.')}
    </div>`;
    return;
  }

  if (params[0]) return detail(ctx, params[0]);

  setTitle('Meine Vorgänge');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Meine Vorgänge' }]);

  const all = engine.instances();
  const openCount = all.filter(i => !['abgeschlossen', 'erledigt', 'geliefert'].includes(i.status)).length;

  mount.innerHTML = `
  <div class="container section">
    ${/* The list gains its primary action (alignment L1). A list of cases with
          no way to start one is a dead end, and the button opens the SERVICE
          CATALOGUE rather than one form: this list holds every process, so
          «new» is a choice of process. */''}
    <div class="page-head-row">
      ${C.pageHeader({ title: 'Meine Vorgänge', lead: 'Status aller von Ihnen ausgelösten Anfragen und Bestellungen.' })}
      <div class="page-head-row__actions">
        <a class="btn btn--filled btn--icon-left" href="#/services">${C.icon('Plus', 'btn__icon')}<span class="btn__text">Neuer Vorgang</span></a>
      </div>
    </div>
    <h2 class="sr-only">Kennzahlen</h2>
    <div class="stats measure-sm mt-4">
      <div class="stat"><div class="stat__num">${all.length}</div><div class="stat__label">Vorgänge total</div></div>
      <div class="stat"><div class="stat__num">${openCount}</div><div class="stat__label">offen / in Arbeit</div></div>
    </div>
    <h2 class="sr-only">Vorgänge</h2>
    ${/* Use id 'cases', not 'mc': the mc prefix belongs to the metadata catalogue,
          creating a collision in searches (design review, naming). */''}
    <div class="mt-6" id="cases-table"></div>
  </div>
  ${/* OUTSIDE the container, because the favourites band is a CD section band:
        <section> is the outer element and carries the tint, .container sits
        inside it (js/ui/components/content.js). Inside the container the
        background would stop at the reading column instead of running edge to
        edge. It also fills in AFTER first paint — favourites can span any
        inventory, so rendering inline would make the cases table wait for
        whichever files this person's own bookmarks happen to need. */''}
  ${/* Not empty while its data loads: the band used to drop in below the
        table with no warning (layout shift). The shared grey spinner holds
        the slot; renderBookmarks replaces it — or clears it when this person
        has no favourites (code review 2026-08, F-S19). */''}
  <div id="cases-bookmarks">${C.loading({ label: 'Favoriten werden geladen…' })}</div>`;

  void renderBookmarks(ctx, mount.querySelector('#cases-bookmarks'));

  // Personal cases was the only list surface without a toolbar: no search,
  // sorting, or pagination, making it unusable as the case count grew. This is
  // the same building block used in the property detail view (C.mountDataTable).
  const STATUS_OPTIONS = [...new Set(all.map(i => i.status))]
    .map(s => ({ value: s, label: statusLabel(core, s) }));
  // `object` is resolved ONCE per row rather than per render: the column, the
  // search and the sort all read it, and core.building() is a lookup per call.
  const rows = all.map(r => ({ ...r, object: caseObject(core, r) }));
  // `rowsClickable`, as in the equivalent home-page cases table: the first
  // column is the row link, and clicking the row follows it (tbl-8).
  const unmountTable = C.mountDataTable(mount.querySelector('#cases-table'), {
    id: 'cases', rows: rows, unit: { one: 'Vorgang', nom: 'Vorgänge', dat: 'Vorgängen' }, caption: 'Meine Vorgänge', rowsClickable: true,
    searchKeys: ['reference', 'title', 'defName', 'object'],
    searchLabel: 'Vorgang suchen', placeholder: 'Referenz oder Titel suchen…',
    perPage: 10,
    sorts: CASE_SORTS, sort: 'submitted',
    facets: [{ dim: 'status', legend: 'Status', options: STATUS_OPTIONS,
      match: (r, vals) => vals.includes(r.status) }],
    columns: CASE_COLUMNS({ C, core, links }),
    hint: 'Klicken Sie eine Zeile, um Details zu öffnen.',
  });
  onUnmount(unmountTable);
}

// The personal counterpart to the home page's frequently-used band. That one
// ranks by `popular` on the SERVICE — what the portal as a whole uses most;
// this one lists what THIS person marked, across every inventory.
//
// Newest first: a favourites list is a shortcut bar, and the thing just saved is
// the one most likely to be wanted again. Insertion order would bury it.
//
// ALL of them, not a first six with «n weitere gemerkt.» underneath. This band is
// the one place the whole list exists (user decision, 2026-08-12): a count of
// what is being withheld is not a shortcut, and there was nowhere to follow it
// to. The grid wraps, so length costs rows rather than a truncation rule.

async function renderBookmarks(ctx, host) {
  if (!host) return;
  const { core, C } = ctx;
  const saved = bookmarks.list();
  // Clear the placeholder spinner on every early exit — otherwise a person
  // without favourites would watch it spin forever (F-S19).
  if (!saved.length) { host.innerHTML = ''; return; }

  // Load only what this person's own bookmarks need, then resolve. A failed
  // collection simply yields no rows for its kind — core.ensure records the
  // failure and the shell's data banner reports it, as everywhere else.
  try { await core.ensure(bookmarkNeeds(saved)); } catch { /* reported by core */ }
  // The route may have been left while the files were in flight.
  if (!host.isConnected) return;

  const ordered = saved.slice().sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)));
  const { rows } = resolveBookmarks(core, ordered);
  if (!rows.length) { host.innerHTML = ''; return; }

  // The SAME card as «Häufig genutzte Dienstleistungen» on the home page
  // (js/pages/home.js `serviceTile`): .card--quick in the shared .card-grid.
  // Both bands are «a shortcut to something you already chose»; two card
  // shapes for one gesture was the only thing telling them apart (user
  // feedback, 2026-08-22). The kind takes the description slot — it is what
  // this tile has to say that the title does not.
  const tile = (row) => `
    <a class="card--quick plain-link" href="${C.escape(row.href)}">
      <h3 class="card--quick__title">${C.escape(row.title)}</h3>
      <p class="card--quick__desc">${C.escape(row.kindLabel)}</p>
      <span class="arrow-btn card--quick__arrow-btn" aria-hidden="true">${C.icon('ArrowRight', 'icon--base')}</span>
    </a>`;

  // C.pageSection with `alt`: the CD band anatomy (section + tint outside,
  // container inside) and its section rhythm, rather than a hand-built block
  // that would have to restate both.
  host.innerHTML = C.pageSection({
    title: 'Meine Favoriten',
    alt: true,
    body: `<div class="card-grid">${rows.map(tile).join('')}</div>`,
  });
}

// The case LIST, described once. Column set and sort order are an alignment
// decision shared with the tenant portal's inbox (docs/case-view-alignment.md
// L4): Referenz · Titel · Objekt · Prozess · Eingereicht · Status.
//
// «Eingereicht» rather than «Aktualisiert» in the column, because the filing
// date is the fact a person recognises a case by; how recently it moved is a
// SORT, and it stays the default one so the list still opens on what changed
// last.

const CASE_SORTS = [
  { value: 'submitted', label: 'Eingereicht (neueste zuerst)', cmp: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) },
  { value: 'updated', label: 'Zuletzt aktualisiert', cmp: (a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)) },
  { value: 'ref', label: 'Referenz', cmp: (a, b) => String(a.reference).localeCompare(String(b.reference), 'de') },
  { value: 'title', label: 'Titel (A–Z)', cmp: (a, b) => String(a.title).localeCompare(String(b.title), 'de') },
  { value: 'object', label: 'Objekt (A–Z)', cmp: (a, b) => String(a.object || '').localeCompare(String(b.object || ''), 'de') },
];

const caseObject = (core, r) => {
  const building = r.linkedEntities && r.linkedEntities.buildingId ? core.building(r.linkedEntities.buildingId) : null;
  return building ? `${building.street}, ${building.zip} ${building.city}` : '';
};
const CASE_COLUMNS = ({ C, core, links }) => [
  { key: 'reference', label: 'Referenz', nowrap: true, render: r => `<a href="${links.caseDetails(r.instanceId)}">${C.escape(r.reference)}</a>` },
  { key: 'title', label: 'Titel', render: r => C.escape(r.title) },
  { key: 'object', label: 'Objekt', render: r => C.escape(r.object || '—') },
  { key: 'defName', label: 'Prozess', render: r => C.escape(r.defName) },
  { key: 'createdAt', label: 'Eingereicht', nowrap: true, render: r => C.escape(formatDate(r.createdAt)) },
  { key: 'status', label: 'Status', render: r => C.statusBadge(r.status, statusLabel(core, r.status)) },
];

// Labels for submitted form fields (instance.data), making the case details
// readable instead of exposing raw keys. Quoted keys are persisted-schema
// compatibility literals.
const DATA_LABELS = {
  'costCenter': 'Kostenstelle', 'persons': 'Personen / Arbeitsplätze', 'naw': 'NAW-Klasse', 'area': 'Flächenbedarf',
  'termin': 'Wunschtermin', 'begruendung': 'Begründung', 'kategorie': 'Kategorie', 'prioritaet': 'Priorität',
  'standortDetail': 'Standortdetail', 'beschreibung': 'Beschreibung', 'position': 'Position', 'menge': 'Menge',
  'lieferadresse': 'Lieferadresse', 'art': 'Art des Vorfalls', 'betroffeneDaten': 'Betroffene Daten',
  'ressourcentyp': 'Ressource', 'datum': 'Datum', 'zeit': 'Zeit', 'bemerkung': 'Bemerkung',
  // Room booking (apps/room-booking.js). Without these the overview showed the
  // raw keys — which is the intended FALLBACK (a new field must never vanish),
  // not an acceptable resting state for a process the portal already ships.
  'gebaeude': 'Gebäude', 'raum': 'Raum', 'raumId': 'Raum-ID', 'geschoss': 'Geschoss',
  'start': 'Von', 'ende': 'Bis', 'teilnehmende': 'Teilnehmende', 'zweck': 'Zweck',
  'eingeladene': 'Eingeladene',
  // Building capture (apps/building-create.js)
  'bezeichnung': 'Objektbezeichnung', 'strasse': 'Strasse / Nr.', 'plz': 'PLZ', 'ort': 'Ort',
  'lat': 'Breitengrad (WGS 84)', 'lng': 'Längengrad (WGS 84)', 'egid': 'EGID', 'egrid': 'EGRID',
  'teilportfolio': 'Teilportfolio', 'gebaeudeart': 'Gebäudeart',
  'eigentum': 'Eigentumsverhältnis', 'baujahr': 'Baujahr',
};

// THREE SECTIONS, and the same three for every process
// (docs/case-view-alignment.md):
//
//   Vorgangsdaten  — the case ABOUT itself: reference, process, status, dates.
//                    Every process has it, it always leads.
//   Standort       — where it happens. Most processes have one; those that do
//                    not simply omit the section.
//   Angaben        — what the requester supplied. Everything else, whatever the
//                    process, under one neutral heading.
//
// Earlier this file grew a group per subject (Ort · Objekt · Bedarf · Termin ·
// Einordnung), which meant a new process either fitted someone else's grouping
// or added a sixth heading — the per-process layout this whole module exists to
// remove, arriving through the back door. Only the LOCATION keys are claimed,
// because a location is also derivable from the linked building and the two
// have to merge (see mergeSections).
const DATA_GROUPS = [
  { title: 'Standort', keys: [
    'gebaeude', 'raum', 'geschoss', 'raumId', 'standortDetail',
    'strasse', 'plz', 'ort', 'lieferadresse', 'egid', 'egrid', 'lat', 'lng',
    'bezeichnung', 'teilportfolio', 'gebaeudeart', 'eigentum', 'baujahr',
  ] },
];

// The submitter's address. Seed cases carry a name and an organisation but no
// mail address, so the card degrades to name + unit rather than inventing one.
const requesterEmail = (instance) => instance.requesterEmail || '';

// The service whose form starts THIS process — services.json links the two
// through `processDefId`. Without a match the resubmit row simply does not
// appear, which is better than a button that opens the wrong form.
const serviceForProcess = (core, defId) => {
  if (!defId) return '';
  const hit = (core.services() || []).find((x) => x.processDefId === defId);
  return hit ? links.service(hit.serviceId) : '';
};

function detail(ctx, id) {
  const { mount, query, core, engine, C, setTitle, setCrumbs, onUnmount } = ctx;
  const caseInstance = engine.instance(id);
  if (!caseInstance) {
    C.renderNotFound(ctx, { thing: 'Dieser Vorgang', title: 'Vorgang nicht gefunden',
      backHref: '#/my-cases', backLabel: 'Meine Vorgänge',
      crumbs: [{ label: 'Startseite', href: '#/' }, { label: 'Meine Vorgänge', href: '#/my-cases' }] });
    return;
  }
  setTitle(caseInstance.reference);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Meine Vorgänge', href: '#/my-cases' }, { label: caseInstance.reference }]);

  const definition = engine.definition(caseInstance.defId);
  const steps = definition ? definition.steps : [];
  const building = caseInstance.linkedEntities && caseInstance.linkedEntities.buildingId ? core.building(caseInstance.linkedEntities.buildingId) : null;
  const project = caseInstance.linkedEntities && caseInstance.linkedEntities.projectId ? core.project(caseInstance.linkedEntities.projectId) : null;
  const canAdvance = caseInstance.createdLocally && definition && caseInstance.stepIndex < steps.length - 1;
  const attachments = caseInstance.attachments || [];
  const dataEntries = Object.entries(caseInstance.data || {}).filter(([, v]) => v != null && v !== '');

  // --- Übersicht: the modular section grid ------------------------------
  // Sections are DATA. A process contributes { title, rows }; the grid decides
  // how that lands (js/ui/case-view.js, docs/case-view-alignment.md § 2). What
  // used to be a card grid plus a hand-built «Eckdaten» box now goes through the
  // same recipe the tenant portal renders, so a process added on either side
  // needs a descriptor rather than a layout of its own.
  const locationSection = building ? caseSection('Standort', [
    caseRow('Objekt', building.name),
    caseRow('Adresse', `${building.street}, ${building.zip} ${building.city}`),
    caseRow('Wirtschaftseinheit (WE)', building.businessEntityId),
    caseRow('EGID', building.egid),
  ]) : null;

  // The submitted fields. Groups are declarative and OPTIONAL: a key no group
  // claims still appears, under «Angaben», so a process that gains a field is
  // never silently dropped (js/ui/case-view.js).
  const dataSections = sectionsFromData(caseInstance.data, DATA_LABELS, { groups: DATA_GROUPS });

  // The invariant tail — true of every Vorgang whatever its process, so it
  // reads last and identically everywhere.
  const factsSection = caseSection('Vorgangsdaten', [
    caseRow('Referenz', caseInstance.reference),
    caseRow('Prozess', caseInstance.defName),
    caseRow('Status', statusLabel(core, caseInstance.status)),
    caseRow('Eingereicht', formatDate(caseInstance.createdAt)),
    caseRow('Letzte Änderung', formatDate(caseInstance.updatedAt || caseInstance.createdAt)),
  ]);

  // THE SPLIT: the reading column carries the record, the rail carries the
  // people and the actions. «Vorgangsdaten» leads because it is true of every
  // process and is what a reader checks first (docs/case-view-alignment.md).
  // `mergeSections` folds «Standort» from the linked building together with the
  // «Standort» the form submitted — one heading over one subject, with the
  // building name printed once (js/ui/case-view.js).
  const overviewPanel = caseOverview(
    mergeSections([factsSection, locationSection, ...dataSections]),
    caseAside([
      // ACTIONS LEAD. The rail's job is «what can I do with this», and that is
      // the question a case page is opened to answer; who filed it and where it
      // points are context for the answer, not ahead of it.
      C.actionCard({ title: 'Aktionen', titleTag: 'h3', items: caseActions(caseInstance, {
        canAdvance,
        serviceHref: serviceForProcess(core, caseInstance.defId),
      }) }),
      // Antragsteller is a CONTACT, not a fact: the same card the property view
      // uses for its Ansprechpersonen, so a person reads the same wherever they
      // appear.
      C.contactCard({
        title: 'Antragsteller',
        titleTag: 'h3',
        contacts: [{
          label: caseInstance.organization || 'Verwaltungseinheit',
          name: caseInstance.requester || '—',
          email: requesterEmail(caseInstance),
        }],
      }),
      // Where this Vorgang points. Separate from «Aktionen» because following a
      // link is not doing something TO the case.
      C.actionCard({ title: 'Verknüpfungen', titleTag: 'h3', items: [
        building ? { type: 'link', label: 'Gebäude ansehen', description: building.name, href: links.portfolioItem(building.bbl_id) } : null,
        project ? { type: 'link', label: 'Projekt ansehen', description: project.name, href: links.constructionProject(project.projectId) } : null,
      ].filter(Boolean) }),
    ]),
  );

  // --- Anhänge: a TABLE, and still a table when it is empty ---------------
  // Bar, column headers and footer stay; the reason sits in the table body.
  // Every other list in the portal already works this way — this tab was the
  // one that replaced itself with a sentence (docs/case-view-alignment.md § 3).
  const attachmentsPanel = '<div id="case-attachments"></div>';

  // --- Verlauf ------------------------------------------------------------
  const historyPanel = historyTimeline((caseInstance.history || []).map(h => ({
    when: formatDate(h.when), action: h.status, note: h.note, tone: h.status,
  })), { empty: 'Zu diesem Vorgang sind noch keine Ereignisse verzeichnet.' });

  // --- Kommentare ---------------------------------------------------------
  // Empty is a state, not a reason to hide the tab: a reader wondering whether
  // anyone has commented gets an answer instead of a missing reiter.
  const comments = caseInstance.comments || [];
  const commentsPanel = commentsList(comments.map(k => ({
    author: k.author, when: formatDate(k.when || k.ts), text: k.text,
  })), { empty: 'Zu diesem Vorgang wurden noch keine Kommentare erfasst.' })
    + caseCommentForm();

  const tabItems = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'attachments', label: `Anhänge (${attachments.length})` },
    { id: 'history', label: 'Verlauf' },
    { id: 'comments', label: `Kommentare (${comments.length})` },
  ];
  const panelsById = { overview: overviewPanel, attachments: attachmentsPanel, history: historyPanel, comments: commentsPanel };
  const requested = query && query.get('tab');
  // `data` was this tab's id until the four-tab set landed. A shared link must
  // not fall back to the overview as though it had named nothing.
  const LEGACY_TAB = { data: 'overview' };
  const wanted = LEGACY_TAB[requested] || requested;
  const activeTab = tabItems.some(t => t.id === wanted) ? wanted : 'overview';

  // A returned case is reported as a return rather than as forward progress.
  const pipelineSteps = steps.map((st, i) => (
    i === caseInstance.stepIndex && caseInstance.status === 'rueckfrage' ? { ...st, state: 'rueckfrage' } : st));

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: '#/my-cases', backLabel: 'Meine Vorgänge' })}
    ${/* CD Hero anatomy (Hero.vue:9-27): the meta strip sits ABOVE the h1. It
          replaces the reference-inside-the-h1 and the lead below it — one CD
          component for the provenance line, and a title that is only the title
          (docs/case-view-alignment.md V1). */''}
    ${caseHeader({
    metaItems: [
      caseInstance.defName,
      caseInstance.reference,
      building ? building.name : '',
      caseInstance.organization,
      `Eingereicht ${formatDate(caseInstance.createdAt)}`,
    ],
    title: caseInstance.title,
    actions: C.statusBadge(caseInstance.status, statusLabel(core, caseInstance.status)),
  })}

    ${/* Without a definition, there is no process to show. An empty <ol> would
          look like a case with no steps, while the footer also said «completed»
          even though the badge said «in progress» (M17). */''}
    ${definition ? `<div class="mt-6">${C.pipeline(pipelineSteps, caseInstance.stepIndex)}</div>`
    : `<div class="mt-6">${C.notificationHtml(
      `<strong>Ablauf nicht verfügbar</strong> — zu diesem Vorgang fehlt die Prozessdefinition «${C.escape(caseInstance.defId || '—')}». `
          + 'Status und Verlauf unten stammen aus dem Vorgang selbst; der Schrittfortschritt lässt sich nicht anzeigen.',
      'warning', 'WarningCircle')}</div>`}

    <div class="tabs mt-6">
      ${C.tabBar({ items: tabItems, active: activeTab, idPrefix: 'case-tab', ariaLabel: 'Vorgangsdetails' })}
      ${C.tabPanels({ items: tabItems, active: activeTab, idPrefix: 'case-tab', render: (t) => panelsById[t], heading: true })}
    </div>

    ${canAdvance
    ? `<div class="mt-6"><button class="btn btn--outline btn--icon-left" id="advance">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Nächster Schritt (Demo)</span></button></div>`
    : ''}
  </div>`;

  // The attachment table is mounted ONCE and kept. The tab wiring hides panels
  // rather than rebuilding them, so a search typed here survives a trip to the
  // Verlauf and back.
  const attachmentHost = mount.querySelector('#case-attachments');
  if (attachmentHost) {
    const types = [...new Set(attachments.map(a => a.type).filter(Boolean))].sort();
    onUnmount(C.mountDataTable(attachmentHost, {
      id: 'case-att', rows: attachments, unit: { one: 'Anhang', nom: 'Anhänge', dat: 'Anhängen' },
      caption: 'Anhänge zu diesem Vorgang mit Typ und Grösse',
      searchKeys: ['name', 'type'],
      searchLabel: 'Anhänge durchsuchen', placeholder: 'Dateiname oder Typ suchen…',
      perPage: 10,
      sorts: [
        { value: 'name', label: 'Dateiname (A–Z)', cmp: (a, b) => String(a.name).localeCompare(String(b.name), 'de') },
        { value: 'type', label: 'Dateityp', cmp: (a, b) => String(a.type || '').localeCompare(String(b.type || ''), 'de') },
      ],
      // A dimension with no values in THIS set is not a filter but an empty
      // drawer behind a button that promises one. With no attachments the
      // control disappears while the table, its header and its bar remain.
      facets: types.length ? [{ dim: 'type', legend: 'Dateityp', options: types.map(t => ({ value: t, label: t })),
        match: (r, vals) => vals.includes(r.type) }] : [],
      columns: attachmentColumns(),
      emptyMsg: 'Zu diesem Vorgang sind keine Anhänge hinterlegt.',
    }));
  }

  // APG tabs (click + arrow/Home/End, roving tabindex) through C.wireTabs. The
  // active tab is mirrored into the hash query for sharing and bookmarking.
  C.wireTabs(mount, {
    syncHash: (tab) => history.replaceState(history.state, '', `#/my-cases/${encodeURIComponent(id)}${tab === 'overview' ? '' : `?tab=${tab}`}`),
  });
  // Rail actions. Delegated on `mount`, so a tab switch that redraws a panel
  // cannot leave a dangling handler behind.
  mount.addEventListener('click', (event) => {
    const button = event.target.closest('#case-advance, #case-comment, #case-print');
    if (!button || !mount.contains(button)) return;
    if (button.id === 'case-advance') { engine.advance(caseInstance.instanceId); location.reload(); return; }
    if (button.id === 'case-print') { window.print(); return; }
    // «Kommentar hinzufügen» takes the reader to where comments are and puts the
    // caret in the box — the action is the writing, not the tab change.
    const tab = mount.querySelector('#case-tab-comments');
    if (tab) tab.click();
    const field = mount.querySelector('#case-comment-form-text');
    if (field) field.focus({ preventScroll: false });
  });

  // The compose box. Demo-scoped, like every other mutation here: the comment
  // is appended to the instance in memory and the panel redrawn in place.
  mount.addEventListener('submit', (event) => {
    const form = event.target.closest('#case-comment-form');
    if (!form) return;
    event.preventDefault();
    const field = form.querySelector('textarea');
    const text = (field && field.value || '').trim();
    if (!text) { if (field) field.focus(); return; }
    caseInstance.comments = [...(caseInstance.comments || []),
      { author: caseInstance.requester || 'Sie', when: new Date().toISOString().slice(0, 10), text }];
    const panel = mount.querySelector('#case-tab-panel-comments') || form.parentElement;
    if (panel) {
      panel.innerHTML = `<h2 class="sr-only">Kommentare (${caseInstance.comments.length})</h2>`
        + commentsList(caseInstance.comments.map(k => ({
          author: k.author, when: formatDate(k.when || k.ts), text: k.text,
        }))) + caseCommentForm();
    }
    const tabButton = mount.querySelector('#case-tab-comments');
    if (tabButton) tabButton.textContent = `Kommentare (${caseInstance.comments.length})`;
    C.announce('Kommentar gespeichert.');
  });
  // `C.wirePipeline(mount)` used to be here. Since the C.wireScrollRegions
  // migration it was an ineffective `return root;`; the router wires the
  // pipeline's scroll region.
}
