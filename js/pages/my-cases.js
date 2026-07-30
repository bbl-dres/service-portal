// Meine Vorgänge — running cases (driven by the mock process engine).
import { statusLabel } from '../domain.js';

// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
export const needs = ['buildings', 'projects'];
export default async function render(ctx) {
  const { mount, params, session, core, engine, C, setTitle, setCrumbs } = ctx;

  // «Meine Vorgänge» ist der einzige persönliche Bereich — abgemeldet nicht den
  // Inhalt zeigen, sondern zur Anmeldung auffordern (Kataloginhalte bleiben frei).
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
    <div class="mt-6" id="mc-table"></div>
  </div>`;

  // «Meine Vorgänge» war die einzige Listenfläche ohne Werkzeugleiste: keine Suche,
  // keine Sortierung, keine Paginierung — bei wachsender Vorgangszahl unbrauchbar.
  // Gleicher Baustein wie in der Objekt-Detailansicht (C.mountDataTable).
  const STATUS_OPTS = [...new Set(all.map(i => i.status))]
    .map(s => ({ value: s, label: statusLabel(core, s) }));
  C.mountDataTable(mount.querySelector('#mc-table'), {
    id: 'mc', rows: all, unit: 'Vorgänge', caption: 'Meine Vorgänge',
    searchKeys: ['reference', 'title', 'defName'],
    searchLabel: 'Vorgang suchen', placeholder: 'Referenz oder Titel suchen…',
    perPage: 10,
    sorts: [
      { value: 'updated', label: 'Zuletzt aktualisiert', cmp: (a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)) },
      { value: 'ref', label: 'Referenz', cmp: (a, b) => String(a.reference).localeCompare(String(b.reference), 'de') },
      { value: 'title', label: 'Titel (A–Z)', cmp: (a, b) => String(a.title).localeCompare(String(b.title), 'de') },
    ],
    facets: [{ dim: 'status', legend: 'Status', options: STATUS_OPTS,
      match: (r, vals) => vals.includes(r.status) }],
    columns: [
      { key: 'reference', label: 'Referenz', render: r => `<a href="#/my-cases/${encodeURIComponent(r.instanceId)}">${C.escape(r.reference)}</a>` },
      { key: 'title', label: 'Titel', render: r => C.escape(r.title) },
      { key: 'defName', label: 'Typ', render: r => C.escape(r.defName) },
      { key: 'updatedAt', label: 'Aktualisiert', render: r => C.escape(r.updatedAt || r.createdAt) },
      { key: 'status', label: 'Status', render: r => C.statusBadge(r.status, statusLabel(core, r.status)) },
    ],
  });
}

// Beschriftungen für die eingereichten Formularfelder (instance.data), damit die
// «Angaben zum Vorgang» lesbar sind statt roher Schlüssel.
const DATA_LABELS = {
  costCenter: 'Kostenstelle', persons: 'Personen / Arbeitsplätze', naw: 'NAW-Klasse', area: 'Flächenbedarf',
  termin: 'Wunschtermin', begruendung: 'Begründung', kategorie: 'Kategorie', prioritaet: 'Priorität',
  standortDetail: 'Standortdetail', beschreibung: 'Beschreibung', position: 'Position', menge: 'Menge',
  lieferadresse: 'Lieferadresse', art: 'Art des Vorfalls', betroffeneDaten: 'Betroffene Daten',
  ressourcentyp: 'Ressource', datum: 'Datum', zeit: 'Zeit', bemerkung: 'Bemerkung',
  // Gebäude-Erfassung (apps/building-create.js)
  bezeichnung: 'Objektbezeichnung', strasse: 'Strasse / Nr.', plz: 'PLZ', ort: 'Ort',
  lat: 'Breitengrad (WGS 84)', lng: 'Längengrad (WGS 84)', egid: 'EGID', egrid: 'EGRID',
  teilportfolio: 'Teilportfolio', gebaeudeart: 'Gebäudeart',
  eigentum: 'Eigentumsverhältnis', baujahr: 'Baujahr',
};

function detail(ctx, id) {
  const { mount, query, core, engine, C, setTitle, setCrumbs } = ctx;
  const i = engine.instance(id);
  if (!i) {
    setTitle('Vorgang nicht gefunden');
    setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Meine Vorgänge', href: '#/my-cases' }]);
    mount.innerHTML = C.notFound({ backHref: '#/my-cases', backLabel: 'Meine Vorgänge',
      title: 'Vorgang nicht gefunden',
      body: 'Dieser Vorgang existiert nicht. <a href="#/my-cases">Zur Übersicht «Meine Vorgänge»</a>' });
    return;
  }
  setTitle(i.reference);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Meine Vorgänge', href: '#/my-cases' }, { label: i.reference }]);

  const def = engine.definition(i.defId);
  const steps = def ? def.steps : [];
  const b = i.linkedEntities && i.linkedEntities.buildingId ? core.building(i.linkedEntities.buildingId) : null;
  const p = i.linkedEntities && i.linkedEntities.projectId ? core.project(i.linkedEntities.projectId) : null;
  const canAdvance = i.createdLocally && def && i.stepIndex < steps.length - 1;
  const atts = i.attachments || [];
  const dataEntries = Object.entries(i.data || {}).filter(([, v]) => v != null && v !== '');

  // --- Tab «Daten»: Antragsteller/Standort/Projekt als Karten + Angaben-Tabelle ---
  const antragstellerCard = `<div class="box"><h3>Antragsteller</h3>
    <p class="m-0"><strong>${C.escape(i.requester || '—')}</strong>${
      i.organization ? `<br><span class="small muted">${C.escape(i.organization)}</span>` : ''}</p></div>`;
  const standortCard = b ? `<div class="box"><h3>Standort</h3>
    <p class="m-0">${C.escape(b.name)}<br>
      <span class="small muted">${C.escape(b.street)}, ${C.escape(b.zip)} ${C.escape(b.city)}</span><br>
      <span class="small muted">WE ${C.escape(b.bbl_we || '—')} · EGID ${C.escape(b.egid || '—')}</span></p>
    <p style="margin:.5rem 0 0"><a class="btn btn--link" href="#/app/portfolio?id=${encodeURIComponent(b.bbl_id)}">${C.icon('ArrowRight', 'btn__icon')} Gebäude ansehen</a></p></div>` : '';
  const projektCard = p ? `<div class="box"><h3>Verknüpftes Projekt</h3>
    <p class="m-0">${C.escape(p.name)}${p.projectNumber ? `<br><span class="small muted">${C.escape(p.projectNumber)}</span>` : ''}</p>
    <p style="margin:.5rem 0 0"><a class="btn btn--link" href="#/app/projects/${encodeURIComponent(p.projectId)}">${C.icon('ArrowRight', 'btn__icon')} Projekt ansehen</a></p></div>` : '';
  const cards = [antragstellerCard, standortCard, projektCard].filter(Boolean).join('');
  const angaben = dataEntries.length
    ? `<div class="detail-section"><h3 class="detail-section__title">Angaben zum Vorgang</h3>
        <div class="box"><div class="data-rows">${dataEntries.map(([k, v]) =>
          `<div class="data-row"><div class="data-row__key">${C.escape(DATA_LABELS[k] || k)}</div><div class="data-row__value">${C.escape(String(v))}</div></div>`).join('')}</div></div></div>`
    : '';
  const datenPanel = `<div class="grid grid--3">${cards}</div>${angaben}`;

  // --- Tab «Anhänge»: eingereichte Dateien (Demo, nicht herunterladbar) ---
  const anhaengePanel = atts.length
    ? `<ul class="download-items">${atts.map(a =>
        C.downloadItem({ href: '#', title: a.name, meta: [a.type, a.size].filter(Boolean), heading: 'h3', wrapLi: true })).join('')}</ul>
       <p class="small muted mt-2">Demodateien — im Prototyp nicht herunterladbar.</p>`
    : C.empty('Für diesen Vorgang sind keine Anhänge hinterlegt.');

  // --- Tab «Verlauf»: Ereignis-Timeline ---
  const verlaufPanel = `<ul class="timeline">${(i.history || []).map(h =>
    `<li class="done"><strong>${C.escape(h.status)}</strong> <span class="when">${C.escape(h.when)}</span>${
      h.note ? `<br><span class="small muted">${C.escape(h.note)}</span>` : ''}</li>`).join('')}</ul>`;

  const tabItems = [
    { id: 'data', label: 'Daten' },
    { id: 'attachments', label: `Anhänge${atts.length ? ` · ${atts.length}` : ''}` },
    { id: 'history', label: 'Verlauf' },
  ];
  const panelsById = { data: datenPanel, attachments: anhaengePanel, history: verlaufPanel };
  const requested = query && query.get('tab');
  const activeTab = tabItems.some(t => t.id === requested) ? requested : 'data';

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: '#/my-cases', backLabel: 'Meine Vorgänge' })}
    <div class="page-header">
      <div class="row gap-sm mb-3">${C.statusBadge(i.status, statusLabel(core, i.status))}</div>
      <h1 tabindex="-1">${C.escape(i.reference)} <span class="case-title-sub">— ${C.escape(i.title)}</span></h1>
      <p class="lead">Eingereicht ${C.escape(i.createdAt)} · Typ ${C.escape(i.defName)}${i.organization ? ` · ${C.escape(i.organization)}` : ''}</p>
    </div>

    ${/* Ohne Definition gibt es keinen Ablauf zu zeigen. Ein leeres <ol> sähe aus
          wie ein Vorgang ohne Schritte — und die Fusszeile meldete dazu noch
          «abgeschlossen», obwohl das Abzeichen «in Arbeit» sagt (M17). */''}
    ${def ? `<div class="mt-4">${C.pipeline(steps, i.stepIndex)}</div>`
      : `<div class="mt-4">${C.notification(
          `<strong>Ablauf nicht verfügbar</strong> — zu diesem Vorgang fehlt die Prozessdefinition «${C.escape(i.defId || '—')}». `
          + 'Status und Verlauf unten stammen aus dem Vorgang selbst; der Schrittfortschritt lässt sich nicht anzeigen.',
          'warning', 'WarningCircle')}</div>`}

    <div class="tabs mt-6">
      ${C.tabBar({ items: tabItems, active: activeTab, idPrefix: 'case-tab', ariaLabel: 'Vorgangsdetails' })}
      ${C.tabPanels({ items: tabItems, active: activeTab, idPrefix: 'case-tab', render: (t) => panelsById[t], heading: true })}
    </div>

    ${canAdvance
      ? `<div class="mt-6"><button class="btn btn--outline" id="advance">${C.icon('ArrowRight', 'icon--base')} Nächster Schritt (Demo)</button></div>`
      : !def ? ''
      : i.createdLocally ? '<p class="small muted mt-6">Vorgang abgeschlossen.</p>' : '<p class="small muted mt-6">Seed-Vorgang (Demo) — nicht weiterführbar.</p>'}
  </div>`;

  // APG-Tabs (Klick + Pfeil/Home/End, roving tabindex) via C.wireTabs; der aktive
  // Tab wird in die Hash-Query gespiegelt (teilbar/lesezeichenbar).
  C.wireTabs(mount, {
    syncHash: (tab) => history.replaceState(null, '', `#/my-cases/${encodeURIComponent(id)}${tab === 'data' ? '' : `?tab=${tab}`}`),
  });
  const adv = mount.querySelector('#advance');
  if (adv) adv.addEventListener('click', () => { engine.advance(i.instanceId); location.reload(); });
  // `C.wirePipeline(mount)` stand hier — die Funktion war seit dem Umbau auf
  // `C.wireScrollRegions` ein `return root;` ohne Wirkung. Der Scrollbereich
  // der Ablaufleiste wird vom Router verdrahtet.
}
