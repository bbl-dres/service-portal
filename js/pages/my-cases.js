// My cases — running cases driven by the mock process engine.
import { statusLabel } from '../domain.js';
import { formatDate } from '../format.js';
import * as links from '../links.js';

// Deferred collections for this route. The router calls core.ensure(needs)
// BEFORE render(); without this declaration, an accessor would read the still
// empty list and the view would show «no entries» instead of data
// (docs/code-review.md §3).
export const needs = ['buildings', 'projects'];
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
    ${C.pageHeader({ title: 'Meine Vorgänge', lead: 'Status aller von Ihnen ausgelösten Anfragen und Bestellungen.' })}
    <h2 class="sr-only">Kennzahlen</h2>
    <div class="stats measure-sm mt-4">
      <div class="stat"><div class="stat__num">${all.length}</div><div class="stat__label">Vorgänge total</div></div>
      <div class="stat"><div class="stat__num">${openCount}</div><div class="stat__label">offen / in Arbeit</div></div>
    </div>
    <h2 class="sr-only">Vorgänge</h2>
    ${/* Use id 'cases', not 'mc': the mc prefix belongs to the metadata catalogue,
          creating a collision in searches (design review, naming). */''}
    <div class="mt-6" id="cases-table"></div>
  </div>`;

  // Personal cases was the only list surface without a toolbar: no search,
  // sorting, or pagination, making it unusable as the case count grew. This is
  // the same building block used in the property detail view (C.mountDataTable).
  const STATUS_OPTIONS = [...new Set(all.map(i => i.status))]
    .map(s => ({ value: s, label: statusLabel(core, s) }));
  // `rowsClickable`, as in the equivalent home-page cases table: the first
  // column is the row link, and clicking the row follows it (tbl-8).
  const unmountTable = C.mountDataTable(mount.querySelector('#cases-table'), {
    id: 'cases', rows: all, unit: { nom: 'Vorgänge', dat: 'Vorgängen' }, caption: 'Meine Vorgänge', rowsClickable: true,
    searchKeys: ['reference', 'title', 'defName'],
    searchLabel: 'Vorgang suchen', placeholder: 'Referenz oder Titel suchen…',
    perPage: 10,
    sorts: [
      { value: 'updated', label: 'Zuletzt aktualisiert', cmp: (a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)) },
      { value: 'ref', label: 'Referenz', cmp: (a, b) => String(a.reference).localeCompare(String(b.reference), 'de') },
      { value: 'title', label: 'Titel (A–Z)', cmp: (a, b) => String(a.title).localeCompare(String(b.title), 'de') },
    ],
    facets: [{ dim: 'status', legend: 'Status', options: STATUS_OPTIONS,
      match: (r, vals) => vals.includes(r.status) }],
    columns: [
      { key: 'reference', label: 'Referenz', render: r => `<a href="${links.caseDetails(r.instanceId)}">${C.escape(r.reference)}</a>` },
      { key: 'title', label: 'Titel', render: r => C.escape(r.title) },
      { key: 'defName', label: 'Typ', render: r => C.escape(r.defName) },
      { key: 'updatedAt', label: 'Aktualisiert', render: r => C.escape(formatDate(r.updatedAt || r.createdAt)) },
      { key: 'status', label: 'Status', render: r => C.statusBadge(r.status, statusLabel(core, r.status)) },
    ],
  });
  onUnmount(unmountTable);
}

// Labels for submitted form fields (instance.data), making the case details
// readable instead of exposing raw keys. Quoted keys are persisted-schema
// compatibility literals.
const DATA_LABELS = {
  'costCenter': 'Kostenstelle', 'persons': 'Personen / Arbeitsplätze', 'naw': 'NAW-Klasse', 'area': 'Flächenbedarf',
  'termin': 'Wunschtermin', 'begruendung': 'Begründung', 'kategorie': 'Kategorie', 'prioritaet': 'Priorität',
  'standortDetail': 'Standortdetail', 'beschreibung': 'Beschreibung', 'position': 'Position', 'menge': 'Menge',
  'lieferadresse': 'Lieferadresse', 'art': 'Art des Vorfalls', 'betroffeneDaten': 'Betroffene Daten',
  'ressourcentyp': 'Ressource', 'datum': 'Datum', 'zeit': 'Zeit', 'bemerkung': 'Bemerkung',
  // Building capture (apps/building-create.js)
  'bezeichnung': 'Objektbezeichnung', 'strasse': 'Strasse / Nr.', 'plz': 'PLZ', 'ort': 'Ort',
  'lat': 'Breitengrad (WGS 84)', 'lng': 'Längengrad (WGS 84)', 'egid': 'EGID', 'egrid': 'EGRID',
  'teilportfolio': 'Teilportfolio', 'gebaeudeart': 'Gebäudeart',
  'eigentum': 'Eigentumsverhältnis', 'baujahr': 'Baujahr',
};

function detail(ctx, id) {
  const { mount, query, core, engine, C, setTitle, setCrumbs } = ctx;
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

  // --- «Daten» tab: requester/location/project cards plus details table ---
  const requesterCard = `<div class="box"><h3>Antragsteller</h3>
    <p class="m-0"><strong>${C.escape(caseInstance.requester || '—')}</strong>${
      caseInstance.organization ? `<br><span class="small muted">${C.escape(caseInstance.organization)}</span>` : ''}</p></div>`;
  const locationCard = building ? `<div class="box"><h3>Standort</h3>
    <p class="m-0">${C.escape(building.name)}<br>
      <span class="small muted">${C.escape(building.street)}, ${C.escape(building.zip)} ${C.escape(building.city)}</span><br>
      <span class="small muted">WE ${C.escape(building.businessEntityId || '—')} · EGID ${C.escape(building.egid || '—')}</span></p>
    <p class="mt-2 mb-0"><a class="btn btn--link btn--icon-left" href="${links.portfolioItem(building.bbl_id)}">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Gebäude ansehen</span></a></p></div>` : '';
  const projectCard = project ? `<div class="box"><h3>Verknüpftes Projekt</h3>
    <p class="m-0">${C.escape(project.name)}${project.projectNumber ? `<br><span class="small muted">${C.escape(project.projectNumber)}</span>` : ''}</p>
    <p class="mt-2 mb-0"><a class="btn btn--link btn--icon-left" href="${links.constructionProject(project.projectId)}">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Projekt ansehen</span></a></p></div>` : '';
  const cards = [requesterCard, locationCard, projectCard].filter(Boolean).join('');
  // «Eckdaten» uses the same slot as sibling detail pages (D26). Rows go through
  // the ONE dl.kv key-value recipe (ruled variant), rather than the parallel
  // .data-rows implementation (C7). detailSection uses titleTag h3 because the
  // section sits below the panel's h2.
  const detailsSection = dataEntries.length
    ? C.detailSection({ title: 'Eckdaten', titleTag: 'h3',
        body: `<div class="box"><dl class="kv kv--ruled">${dataEntries.map(([k, v]) =>
          `<dt>${C.escape(DATA_LABELS[k] || k)}</dt><dd>${C.escape(String(v))}</dd>`).join('')}</dl></div>` })
    : '';
  const dataPanel = `<div class="grid grid--responsive-cols-3">${cards}</div>${detailsSection}`;

  // --- Attachments tab: submitted files (demo, not downloadable) ---
  const attachmentsPanel = attachments.length
    ? `<ul class="download-items">${attachments.map(a =>
        C.downloadItem({ href: '#', title: a.name, meta: [a.type, a.size].filter(Boolean), heading: 'h3', wrapLi: true })).join('')}</ul>
       <p class="small muted mt-2">Demodateien — im Prototyp nicht herunterladbar.</p>`
    : C.empty('Für diesen Vorgang sind keine Anhänge hinterlegt.');

  // --- «Verlauf» tab: event timeline ---
  const historyPanel = `<ul class="timeline">${(caseInstance.history || []).map(h =>
    `<li class="done"><strong>${C.escape(h.status)}</strong> <span class="when">${C.escape(h.when)}</span>${
      h.note ? `<br><span class="small muted">${C.escape(h.note)}</span>` : ''}</li>`).join('')}</ul>`;

  const tabItems = [
    { id: 'data', label: 'Daten' },
    { id: 'attachments', label: `Anhänge${attachments.length ? ` · ${attachments.length}` : ''}` },
    { id: 'history', label: 'Verlauf' },
  ];
  const panelsById = { data: dataPanel, attachments: attachmentsPanel, history: historyPanel };
  const requested = query && query.get('tab');
  const activeTab = tabItems.some(t => t.id === requested) ? requested : 'data';

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: '#/my-cases', backLabel: 'Meine Vorgänge' })}
    ${/* Application-detail recipe (detailBar + h1 + lead), not the .page-header
          wrapper. The case header was the only detail header with list-page
          anatomy (design review B7); the status row remains above as a pill row. */''}
    <div class="row gap-sm mb-3">${C.statusBadge(caseInstance.status, statusLabel(core, caseInstance.status))}</div>
    <h1 tabindex="-1">${C.escape(caseInstance.reference)} <span class="case-title-sub">— ${C.escape(caseInstance.title)}</span></h1>
    <p class="lead">Eingereicht ${C.escape(formatDate(caseInstance.createdAt))} · Typ ${C.escape(caseInstance.defName)}${caseInstance.organization ? ` · ${C.escape(caseInstance.organization)}` : ''}</p>

    ${/* Without a definition, there is no process to show. An empty <ol> would
          look like a case with no steps, while the footer also said «completed»
          even though the badge said «in progress» (M17). */''}
    ${definition ? `<div class="mt-4">${C.pipeline(steps, caseInstance.stepIndex)}</div>`
      : `<div class="mt-4">${C.notification(
          `<strong>Ablauf nicht verfügbar</strong> — zu diesem Vorgang fehlt die Prozessdefinition «${C.escape(caseInstance.defId || '—')}». `
          + 'Status und Verlauf unten stammen aus dem Vorgang selbst; der Schrittfortschritt lässt sich nicht anzeigen.',
          'warning', 'WarningCircle')}</div>`}

    <div class="tabs mt-6">
      ${C.tabBar({ items: tabItems, active: activeTab, idPrefix: 'case-tab', ariaLabel: 'Vorgangsdetails' })}
      ${C.tabPanels({ items: tabItems, active: activeTab, idPrefix: 'case-tab', render: (t) => panelsById[t], heading: true })}
    </div>

    ${canAdvance
      ? `<div class="mt-6"><button class="btn btn--outline btn--icon-left" id="advance">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Nächster Schritt (Demo)</span></button></div>`
      : !definition ? ''
      : caseInstance.createdLocally ? '<p class="small muted mt-6">Vorgang abgeschlossen.</p>' : '<p class="small muted mt-6">Seed-Vorgang (Demo) — nicht weiterführbar.</p>'}
  </div>`;

  // APG tabs (click + arrow/Home/End, roving tabindex) through C.wireTabs. The
  // active tab is mirrored into the hash query for sharing and bookmarking.
  C.wireTabs(mount, {
    syncHash: (tab) => history.replaceState(history.state, '', `#/my-cases/${encodeURIComponent(id)}${tab === 'data' ? '' : `?tab=${tab}`}`),
  });
  const advanceButton = mount.querySelector('#advance');
  if (advanceButton) advanceButton.addEventListener('click', () => { engine.advance(caseInstance.instanceId); location.reload(); });
  // `C.wirePipeline(mount)` used to be here. Since the C.wireScrollRegions
  // migration it was an ineffective `return root;`; the router wires the
  // pipeline's scroll region.
}
