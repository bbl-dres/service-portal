// Metadaten Katalog Bauten — der Data-Governance-Katalog des Immobilienbereichs.
//
// Er trägt die beiden Schichten UNTER dem Datenkatalog (#/data/catalog, DCAT-AP CH):
//
//   Geschäftsobjekt (technologieneutral)   data/business-objects.json
//     └── Attribut ──abgebildet auf──▶ Feld
//                                        └── Tabelle/Layer (systemgebunden)
//                                                                data/system-tables.json
//                                                └── datasetId ──▶ #/data/catalog/<id>
//
// Die Frage, für die es den Katalog gibt, ist die Abbildung: WELCHES FELD WELCHEN
// SYSTEMS trägt diesen Fachbegriff. Gepflegt wird sie am Attribut (dort weiss man
// es), gelesen wird sie in beide Richtungen — die Gegenrichtung liefert core.js
// über einen Rückwärtsindex, nicht über eine dritte Datei.
//
// Aufbau wie die übrigen Katalogseiten (#/data/catalog, #/applications) und NICHT
// wie das Liegenschafteninventar: der Zustand steht im Hash, nicht in einer
// lokalen Variablen — jede Auswahl ist damit teilbar. Optik und Seitenbaum
// (pf-layout/pf-sidebar/pf-tree) sind die des Inventars, damit sich beide
// Bestandsansichten gleich anfühlen; die Detailansichten tragen dieselbe
// Reiterstruktur (Übersicht · Liste · Realisierung) wie die Objekt-Detailseite
// dort. Beide Detailansichten dieses Katalogs sind untereinander gleich gebaut.

import { ANWENDUNGEN, trail } from '../crumbs.js';
import { num, datum } from '../format.js';
import * as links from '../links.js';
// escape/badge direkt aus components.js (Muster buildings-map.js/floorplan.js):
// EIN modulweites `esc` statt dreier funktionslokaler `const esc = C.escape;`-
// Aliase — und matchBadge (unten) braucht beide schon auf Modulebene.
import { escape as esc, badge } from '../components.js';

// `contacts` trägt die Datenverwaltung (steward) beider Schichten. `datasets`
// wird NUR in der Tabellen-Detailansicht gebraucht (115 KB für einen Titel) und
// dort einzeln nachgefordert.
export const needs = ['businessObjects', 'systemTables', 'contacts'];

const BASE = '#/app/metadata-catalog';
// «… Bauten» wie bei der Mediathek Bauten: der Bestand deckt den Immobilien-
// bereich ab (SAP RE-FX, GIS IMMO), nicht das ganze Amt. Der Name steht EINMAL
// hier — er trägt Seitentitel, Brotkrume, Überschrift und jeden Rück-Link.
const TITEL = 'Metadaten Katalog Bauten';
const PER_PAGE = 12;

// Beschriftungen der Typ-Kennungen aus den Daten. Bewusst hier und nicht in
// reference-data.json: es sind Formen der Ablage, keine fachliche Codeliste.
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
const KEY_ROLE = { PK: 'Primärschlüssel', FK: 'Fremdschlüssel', UK: 'Eindeutig' };

// Definitionen sind ganze Sätze. In einer Tabellenzelle drängen sie die übrigen
// Spalten aus dem Bild (die Spaltenbreiten unten fangen das ab, aber ein
// sechszeiliger Zellentext bleibt unlesbar) — hier steht der Anfang, den ganzen
// Satz trägt die Detailansicht.
const kurz = (s, n = 110) => {
  const t = String(s || '').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 20)).trimEnd() + '…';
};

export default async function render(ctx) {
  // Detailansichten per ?id=/?table= statt eigener Routensegmente — bewusste
  // Wiederverwendung des Inventar-Idioms (Design-Review «Bewusste Abweichungen»
  // Nr. 7): ein Routenwechsel bräche bereits geteilte Links ohne Nutzergewinn.
  const objectId = ctx.query.get('id');
  const tableId = ctx.query.get('table');
  if (objectId) return objectDetail(ctx, objectId);
  if (tableId) return tableDetail(ctx, tableId);
  return list(ctx);
}

// --- gemeinsame Nachschläge --------------------------------------------------
const refList = (core, key) => core.ref()[key] || [];
const domainOf = (core, key) => core.dataDomains().find((d) => d.key === key) || {};
const domainLabel = (core, key) => domainOf(core, key).label || key;
const statusOf = (core, id) => refList(core, 'objectStatuses').find((s) => s.id === id) || { label: id, variant: 'gray' };
const matchOf = (core, id) => refList(core, 'mappingMatches').find((m) => m.id === id) || { label: id, variant: 'gray' };
// Hostname einer Quell-URL; unparsbare Werte kommen unverändert zurück, damit
// eine kaputte Rohangabe sichtbar bleibt statt zu verschwinden.
const hostOf = (url) => { try { return new URL(url).host; } catch { return String(url || ''); } };
// Auf-/zugeklappte Zweige des Seitenbaums. Die Seite wird bei JEDEM Hash-Wechsel
// neu gebaut, das Modul aber nur einmal geladen — der Zustand gehört deshalb
// hierher und nicht in die Renderfunktion, sonst klappte jeder Filterklick den
// Baum wieder auf den Standard zurück. Nur echte Nutzerentscheide landen hier;
// ohne Eintrag gilt der Standard (der Zweig der aktuellen Sicht ist offen).
const OPEN = new Map();
const isOpen = (key, fallback) => (OPEN.has(key) ? OPEN.get(key) : fallback);

// Was «Exakt», «Nahe» und «Teilweise» bedeuten, steht am Wert selbst (title)
// statt als Legende unter der Tabelle: eine Legende erklärt drei Marken für alle
// Zeilen und steht dort, wo man sie beim Lesen der Zeile nicht sieht.
const MATCH_HINT = {
  exact: 'Exakt — Feldinhalt und Begriff sind deckungsgleich.',
  close: 'Nahe — inhaltlich dasselbe, aber mit abweichender Kodierung oder Einheit.',
  partial: 'Teilweise — das Feld deckt nur einen Teil des Begriffs ab.',
};

// Güte-Marke mit Erklärung am Element (siehe MATCH_HINT): beide Detailansichten
// zeigen dieselbe Marke — die Definition steht deshalb EINMAL hier statt
// wortgleich in beiden Renderfunktionen; `core` reicht der Aufrufer durch.
const matchBadge = (core, id) => {
  const m = matchOf(core, id);
  return `<span title="${esc(MATCH_HINT[id] || m.label)}">${badge(m.label, m.variant, 'sm')}</span>`;
};

// «Verantwortliche Personen» — dasselbe Muster wie das Datensatzblatt
// (js/pages/catalog.js): Abschnitt mit linierter kv-Liste (kv--ruled),
// dt = Rolle im Katalog («Datenverwaltung»), dd = Stelle mit
// Organisationseinheit, Aufgabenbeschrieb und Erreichbarkeit
// (Nutzerentscheid 2026-08-04; beide Detailansichten teilen den Baustein).
const personsSection = (contact) => `
    <h2 class="detail-section__title">Verantwortliche Personen</h2>
    <div class="box">${contact ? `<dl class="kv kv--ruled">
      <dt>Datenverwaltung</dt>
      <dd><strong>${esc(contact.name)}</strong>${contact.unit ? `<br>${esc(contact.unit)}` : ''}${
        contact.role ? `<br><span class="small muted">${esc(contact.role)}</span>` : ''}${
        contact.email ? `<br><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>` : ''}${
        contact.phone ? `<br>${esc(contact.phone)}` : ''}</dd>
    </dl>` : '<p class="muted m-0">Für diesen Eintrag ist keine verantwortliche Person hinterlegt.</p>'}</div>`;

const objHref = (id) => `${BASE}?id=${encodeURIComponent(id)}`;
const tblHref = (id) => `${BASE}?table=${encodeURIComponent(id)}`;

// ---------------------------------------------------------------------------
// Bestandsansicht
// ---------------------------------------------------------------------------
function list(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  setTitle(TITEL);
  setCrumbs(trail(ANWENDUNGEN, { label: TITEL }));

  const objects = core.businessObjects();
  const tables = core.systemTables();
  const domains = core.dataDomains();

  // --- Zustand aus dem Hash ---------------------------------------------------
  const kind = query.get('kind') === 'tabellen' ? 'tabellen' : 'objekte';
  const rawQ = query.get('q') || '';
  const q = rawQ.toLowerCase();
  const multi = (param, valid) => (query.get(param) || '').split(',').map((s) => s.trim()).filter((x) => valid.includes(x));
  const selDomains = multi('domain', domains.map((d) => d.key));
  const selSystems = multi('system', [...new Set(tables.map((t) => t.system))]);
  const selSchemas = multi('schema', [...new Set(tables.map((t) => t.schema))]);
  const selStatus = multi('status', refList(core, 'objectStatuses').map((s) => s.id));
  const mapped = ['ja', 'nein'].includes(query.get('mapped')) ? query.get('mapped') : '';
  const view = query.get('view') === 'gallery' ? 'gallery' : 'list';
  const wantedPage = Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1);

  // --- Kennzahlen je Eintrag --------------------------------------------------
  const mapCount = (o) => core.realisationsOf(o).length;
  const realCount = (t) => core.realisationsForTable(t.tableId).length;

  const SORTS = kind === 'objekte'
    ? [
      { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
      { value: 'domain', label: 'Domäne', cmp: (a, b) => domainLabel(core, a.domain).localeCompare(domainLabel(core, b.domain), 'de') || a.name.localeCompare(b.name, 'de') },
      { value: 'attrs', label: 'Attribute (meiste zuerst)', cmp: (a, b) => b.attributes.length - a.attributes.length },
      { value: 'maps', label: 'Realisierungen (meiste zuerst)', cmp: (a, b) => mapCount(b) - mapCount(a) },
    ]
    : [
      { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.displayName.localeCompare(b.displayName, 'de') },
      { value: 'system', label: 'System', cmp: (a, b) => a.systemName.localeCompare(b.systemName, 'de') || a.name.localeCompare(b.name, 'de') },
      { value: 'fields', label: 'Felder (meiste zuerst)', cmp: (a, b) => b.fields.length - a.fields.length },
      { value: 'real', label: 'Realisierte Geschäftsobjekte (meiste zuerst)', cmp: (a, b) => realCount(b) - realCount(a) },
    ];
  const sortKey = SORTS.some((s) => s.value === query.get('sort')) ? query.get('sort') : '';

  // --- Filterung --------------------------------------------------------------
  const objMatches = (o) => {
    const hay = `${o.name} ${o.definition} ${o.comment} ${o.attributes.map((a) => a.name).join(' ')}`.toLowerCase();
    return (!q || hay.includes(q))
      && (!selDomains.length || selDomains.includes(o.domain))
      && (!selStatus.length || selStatus.includes(o.status))
      && (!mapped || (mapped === 'ja' ? mapCount(o) > 0 : mapCount(o) === 0));
  };
  const tblMatches = (t) => {
    const hay = `${t.name} ${t.displayName} ${t.description} ${t.schema} ${t.systemName} ${t.fields.map((f) => f.name).join(' ')}`.toLowerCase();
    return (!q || hay.includes(q))
      && (!selSystems.length || selSystems.includes(t.system))
      && (!selSchemas.length || selSchemas.includes(t.schema))
      && (!mapped || (mapped === 'ja' ? realCount(t) > 0 : realCount(t) === 0));
  };

  const all = kind === 'objekte' ? objects : tables;
  const filtered = all.filter(kind === 'objekte' ? objMatches : tblMatches);
  const sortDef = SORTS.find((s) => s.value === sortKey);
  const sorted = sortDef ? filtered.slice().sort(sortDef.cmp) : filtered.slice().sort(SORTS[0].cmp);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const page = Math.min(wantedPage, totalPages);
  const visible = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // --- Hash-Bau ---------------------------------------------------------------
  // `kind` bleibt aus der Adresse, solange die Standardsicht (Geschäftsobjekte)
  // gilt — dieselbe Regel wie für page 1 und die Standardansicht.
  const base = {
    kind: kind === 'objekte' ? '' : kind, q: rawQ, sort: sortKey, view,
    domain: selDomains, system: selSystems, schema: selSchemas, status: selStatus, mapped,
  };
  const hash = (patch = {}) => C.catalogueHash(BASE, { ...base, ...patch, defaultView: 'list' });
  // Ein Sichtwechsel nimmt die Filter der anderen Sicht nicht mit: `domain` gilt
  // nur für Begriffe, `system`/`schema` nur für Tabellen.
  const kindHref = (k) => C.catalogueHash(BASE, {
    kind: k === 'objekte' ? '' : k, q: rawQ, view, defaultView: 'list',
  });

  // --- aktive Filter als Pillen ------------------------------------------------
  const active = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hash({ q: '' }) }] : []),
    ...selDomains.map((x) => ({ label: domainLabel(core, x), href: hash({ domain: selDomains.filter((y) => y !== x) }) })),
    ...selSystems.map((x) => ({ label: (tables.find((t) => t.system === x) || {}).systemName || x, href: hash({ system: selSystems.filter((y) => y !== x) }) })),
    ...selSchemas.map((x) => ({ label: `Schema ${x}`, href: hash({ schema: selSchemas.filter((y) => y !== x) }) })),
    ...selStatus.map((x) => ({ label: statusOf(core, x).label, href: hash({ status: selStatus.filter((y) => y !== x) }) })),
    ...(mapped ? [{ label: mapped === 'ja' ? 'Mit Realisierung' : 'Ohne Realisierung', href: hash({ mapped: '' }) }] : []),
  ];

  // --- Karten und Listen -------------------------------------------------------
  // Ohne Bildmaterial trägt die Liste den Bestand; die Galerie bleibt über den
  // Ansichtswechsel erreichbar und benutzt die gewöhnliche CD-Karte OHNE Bild
  // (card--default) statt der bildgeführten Inventarkarte.
  const objCard = (o) => {
    const n = mapCount(o);
    return C.card({
      title: o.name,
      desc: o.definition,
      href: objHref(o.objectId),
      badges: [
        C.badge(domainLabel(core, o.domain), 'blue'),
        C.badge(statusOf(core, o.status).label, statusOf(core, o.status).variant),
        ...(n ? [] : [C.badge('Ohne Realisierung', 'gray')]),
      ],
      footerInfo: `${o.attributes.length} Attribute · ${n} Realisierung${n === 1 ? '' : 'en'}`,
      footerAction: C.cardAction(),
    });
  };
  const tblCard = (t) => C.card({
    title: t.displayName,
    desc: t.description,
    href: tblHref(t.tableId),
    badges: [
      C.badge(t.systemName, 'blue'),
      C.badge(TABLE_TYPE[t.type] || t.type, 'gray'),
      ...(t.certified ? [C.badge('Zertifiziert', 'success')] : []),
    ],
    footerInfo: `${t.fields.length} Felder${t.rowCount ? ` · ${num(t.rowCount)} Zeilen` : ''}`,
    footerAction: C.cardAction(),
  });

  // Spaltenbreiten sind hier NICHT Kosmetik: ohne sie verteilt der Browser die
  // Breite nach Inhalt, die Definitionsspalte frisst alles und die letzte Spalte
  // rutscht aus dem Bild (sie bleibt scrollbar, aber niemand findet sie).
  // Fünf Spalten je Bestand, eine Angabe pro Spalte. Domäne und System stehen
  // als Marke, nicht als Fliesstext: es sind dieselben endlichen Werte, die im
  // Filter und im Seitenbaum auftauchen — als Marke liest man sie als Kategorie
  // und findet die Zeilen einer Gruppe beim Überfliegen wieder. Der Status ist
  // aus demselben Grund eine Marke.
  const objList = (rows) => C.table({
    caption: 'Geschäftsobjekte', zebra: true, rowsClickable: true,
    columns: [
      { key: 'name', label: 'Geschäftsobjekt', width: '13rem', render: (o) =>
        `<a href="${objHref(o.objectId)}">${esc(o.name)}</a>` },
      { key: 'domain', label: 'Domäne', width: '12rem', render: (o) => C.badge(domainLabel(core, o.domain), 'blue') },
      { key: 'definition', label: 'Beschreibung', render: (o) => esc(kurz(o.definition, 130)) },
      { key: 'attrs', label: 'Attribute', align: 'right', render: (o) => String(o.attributes.length) },
      { key: 'status', label: 'Status', width: '9rem', render: (o) => C.badge(statusOf(core, o.status).label, statusOf(core, o.status).variant) },
    ],
    rows,
  });
  const tblList = (rows) => C.table({
    caption: 'Systemtabellen', zebra: true, rowsClickable: true,
    columns: [
      { key: 'name', label: 'Tabelle', width: '13rem', render: (t) =>
        `<a href="${tblHref(t.tableId)}">${esc(t.displayName)}</a><br><span class="small muted"><code>${esc(t.name)}</code></span>` },
      { key: 'system', label: 'System', width: '10rem', render: (t) => C.badge(t.systemName, 'blue') },
      { key: 'description', label: 'Beschreibung', render: (t) => esc(kurz(t.description, 130)) },
      { key: 'fields', label: 'Felder', align: 'right', render: (t) => String(t.fields.length) },
      // «Status» ist bei einer Systemtabelle die Zertifizierung — die einzige
      // Zustandsangabe, die der Bestand führt. Art und Datensatzzahl stehen im
      // Detail; in der Liste trugen sie wenig zum Vergleich bei.
      { key: 'certified', label: 'Status', width: '9rem', render: (t) =>
        C.badge(t.certified ? 'Zertifiziert' : 'Nicht zertifiziert', t.certified ? 'success' : 'gray') },
    ],
    rows,
  });

  // --- Filterpanel -------------------------------------------------------------
  const panel = kind === 'objekte' ? `
      ${C.filterGroup({ dim: 'domain', legend: 'Domäne', selected: selDomains, idPrefix: 'mc',
        options: domains.map((d) => ({ value: d.key, label: d.label })) })}
      ${C.filterGroup({ dim: 'status', legend: 'Status', selected: selStatus, idPrefix: 'mc',
        options: refList(core, 'objectStatuses').map((s) => ({ value: s.id, label: s.label })) })}
      ${C.filterGroup({ dim: 'mapped', legend: 'Realisierung', selected: mapped ? [mapped] : [], idPrefix: 'mc',
        options: [{ value: 'ja', label: 'In einem System realisiert' }, { value: 'nein', label: 'In keinem System realisiert' }] })}
      ${C.panelReset({ href: hash({ domain: [], status: [], mapped: '' }) })}`
    : `
      ${C.filterGroup({ dim: 'system', legend: 'System', selected: selSystems, idPrefix: 'mc',
        options: [...new Map(tables.map((t) => [t.system, t.systemName])).entries()].map(([v, l]) => ({ value: v, label: l })) })}
      ${C.filterGroup({ dim: 'schema', legend: 'Schema', selected: selSchemas, idPrefix: 'mc',
        options: [...new Map(tables.map((t) => [t.schema, t.schemaLabel])).entries()].map(([v, l]) => ({ value: v, label: l })) })}
      ${C.filterGroup({ dim: 'mapped', legend: 'Realisierung', selected: mapped ? [mapped] : [], idPrefix: 'mc',
        options: [{ value: 'ja', label: 'Realisiert Geschäftsobjekte' }, { value: 'nein', label: 'Realisiert keine Geschäftsobjekte' }] })}
      ${C.panelReset({ href: hash({ system: [], schema: [], mapped: '' }) })}`;

  const filterCount = kind === 'objekte'
    ? selDomains.length + selStatus.length + (mapped ? 1 : 0)
    : selSystems.length + selSchemas.length + (mapped ? 1 : 0);

  // `unit` als { nom, dat }: «19 von 19 Geschäftsobjekten» (Dativ nach «von»),
  // aber «Keine Geschäftsobjekte gefunden.» (Nominativ der Leertexte) — ein
  // einzelner String traf nur einen der beiden Kasus (Design-Review A14).
  const unit = kind === 'objekte'
    ? { nom: 'Geschäftsobjekte', dat: 'Geschäftsobjekten' }
    : { nom: 'Systemtabellen', dat: 'Systemtabellen' };

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: TITEL,
      lead: 'Fachbegriffe des BBL und ihre Realisierung in den Führungssystemen — welches Geschäftsobjekt welche Attribute hat, und welches Feld welcher Tabelle sie trägt.',
    })}
    ${C.catalogueBar({
      formId: 'mc-search', inputId: 'mc-q',
      searchLabel: kind === 'objekte' ? 'Geschäftsobjekt oder Attribut suchen' : 'Tabelle oder Feld suchen',
      placeholder: kind === 'objekte' ? 'Geschäftsobjekt oder Attribut suchen…' : 'Tabelle oder Feld suchen…',
      q: rawQ, countId: 'mc-count',
      count: `<strong>${sorted.length}</strong> von ${all.length} ${esc(unit.dat)}${totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : ''}`,
      sort: { id: 'mc-sort', value: sortKey, options: SORTS.map((s) => ({ value: s.value, label: s.label })) },
      filterId: 'mc-filter', filterLabel: 'Filter', filterCount,
      panelId: 'mc-filters', panel,
      view, views: [['list', 'Listenansicht', 'List'], ['gallery', 'Galerieansicht', 'Apps']],
    })}
    ${C.activeFilters({ filters: active, resetHref: BASE })}
    <div class="pf-layout">
      <aside class="pf-sidebar" aria-label="Domänen und Systeme">
        <div class="pf-sidebar__head"><h2 class="pf-sidebar__title">Katalog</h2></div>
        ${treeHTML()}
      </aside>
      <div class="pf-main">
        ${C.catalogueResults({
          resetHref: BASE, visible, count: sorted.length, total: all.length,
          view, page, totalPages, header: false,
          card: kind === 'objekte' ? objCard : tblCard,
          listView: kind === 'objekte' ? objList : tblList,
          unit, gridCls: 'grid grid--responsive-cols-2',
          regionLabel: kind === 'objekte' ? 'Geschäftsobjekte' : 'Systemtabellen',
          paginationInputId: 'mc-page', paginationLabel: `Seitennavigation ${unit.nom}`,
          paginationHref: (p) => hash({ page: p }),
          available: core.available(kind === 'objekte' ? 'businessObjects' : 'systemTables'),
        })}
      </div>
    </div>
  </div>`;

  C.announceCatalogue({ count: sorted.length, total: all.length, unit, page, totalPages, view });
  C.wireCatalogue(mount, {
    formId: 'mc-search', inputId: 'mc-q', pageInputId: 'mc-page', page, totalPages, hash,
    sortId: 'mc-sort', filterToggleId: 'mc-filter', panelId: 'mc-filters',
  });
  ctx.onUnmount(C.wireTableRows(mount));

  // Zweigknöpfe des Seitenbaums. Ein Klick bedeutet zweierlei, je nachdem, wo
  // man steht: von woanders führt er auf den ganzen Zweig (und öffnet ihn), im
  // Zweig selbst klappt er auf und zu. Kein onUnmount nötig — der Horcher hängt
  // an der Seitenleiste, die der Router beim nächsten Rendern wegwirft.
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
    const list = mount.querySelector(`#${btn.getAttribute('aria-controls')}`);
    if (list) list.hidden = open;
    OPEN.set(btn.dataset.branch, !open);
  });

  // --- Seitenbaum ---------------------------------------------------------------
  // Zweige sind Links (Filter) MIT eigenem Klappknopf davor; die Blätter sind
  // reine Links. Ohne Symbole — die Einrückung trägt die Ebene (siehe
  // .pf-tree--plain in css/app.css).
  function treeHTML() {
    const row = (label, count) =>
      `<span class="pf-tree__label">${esc(label)}</span><span class="pf-tree__n">${count}</span>`;
    // `plain-link` ist der Ausweg aus der :not()-Kette von «#main-content a»
    // (css/app.css:135): das CD unterstreicht jeden Inhaltslink im Hauptbereich,
    // und diese Regel schlägt mit (1,1,1) das `text-decoration:none` der
    // Baum-Klasse. Im Inventar fällt das nicht auf, weil dessen Baum aus
    // <button> besteht; hier sind es Links, weil der Zustand im Hash steht.
    // Navigation wird nicht unterstrichen — dieselbe Ausnahme nimmt die
    // Sprungleiste des API-Verzeichnisses (js/apps/api-docs.js).
    const leaf = (label, count, href, on) =>
      `<li class="pf-tree__item"><a class="pf-tree__leaf plain-link${on ? ' is-active' : ''}" href="${href}"${
        on ? ' aria-current="true"' : ''}>${row(label, count)}</a></li>`;
    // Aufbau wie im Inventar: der Zweig IST der Knopf, das Chevron sitzt in ihm,
    // und ein Klick tut beides — er zeigt den ganzen Zweig und klappt ihn auf.
    // Genauer (siehe Verdrahtung unten): steht man noch woanders, führt der
    // Klick auf die Sicht «alles in diesem Zweig» und öffnet ihn; ist man schon
    // dort, klappt derselbe Klick auf und zu. Damit braucht es keine
    // «Alle …»-Zeile — die wäre eine zweite Beschriftung für dasselbe Ziel.
    // `open`: der Zweig der aktuellen Sicht ist offen, der andere zu — bis der
    // Nutzer selbst klappt; dann gilt seine Entscheidung (OPEN, modulweit).
    const branch = (key, label, count, href, on, open, children) => `
      <li class="pf-tree__item">
        <button type="button" class="pf-tree__node${on ? ' is-active' : ''}" data-branch="${key}"
          data-href="${esc(href)}" aria-expanded="${open}" aria-controls="mc-branch-${key}">
          ${C.icon('ChevronRight', 'pf-tree__chev')}${row(label, count)}</button>
        <ul class="pf-tree__children" id="mc-branch-${key}"${open ? '' : ' hidden'}>${children}</ul>
      </li>`;

    const domCount = {};
    for (const o of objects) domCount[o.domain] = (domCount[o.domain] || 0) + 1;

    const domainItems = domains.map((d) => leaf(
      d.label, domCount[d.key] || 0,
      C.catalogueHash(BASE, { domain: [d.key], view, defaultView: 'list' }),
      kind === 'objekte' && selDomains.length === 1 && selDomains[0] === d.key,
    )).join('');

    // Genau ZWEI Ebenen, in beiden Ästen dieselben: Wurzel → Filterwert. Eine
    // dritte Ebene (System › Schema) hatte der geteilte Baum optisch nicht
    // hergegeben — `.pf-tree__leaf` rückt genau eine Stufe ein, also standen
    // die Systeme auf Wurzelhöhe und lasen sich als Geschwister von «Systeme».
    // Die drei Schemata bleiben als Filter im Panel erreichbar; im Baum hätten
    // sie ohnehin fast dieselbe Menge gezeigt wie ihr System.
    const bySystem = new Map();
    for (const t of tables) {
      if (!bySystem.has(t.system)) bySystem.set(t.system, { name: t.systemName, n: 0 });
      bySystem.get(t.system).n++;
    }
    const systemItems = [...bySystem.entries()].map(([key, s]) => leaf(
      s.name, s.n,
      C.catalogueHash(BASE, { kind: 'tabellen', system: [key], view, defaultView: 'list' }),
      kind === 'tabellen' && selSystems.length === 1 && selSystems[0] === key,
    )).join('');

    // Ein Zweig, in dem gerade gefiltert wird, ist IMMER offen — sonst läge die
    // hervorgehobene Auswahl hinter einem zugeklappten Knoten. Sonst gilt die
    // Entscheidung des Nutzers, und ohne eine solche der Zweig der aktuellen Sicht.
    // Standardsicht ist «Geschäftsobjekte»: ohne Filter ist ihr Zweig markiert
    // und offen, «Systeme» zu.
    return `<ul class="pf-tree pf-tree--plain">
      ${branch('objekte', 'Geschäftsobjekte', objects.length, kindHref('objekte'),
        kind === 'objekte' && !selDomains.length,
        selDomains.length ? true : isOpen('objekte', kind === 'objekte'), domainItems)}
      ${branch('systeme', 'Systeme', tables.length, kindHref('tabellen'),
        kind === 'tabellen' && !selSystems.length,
        selSystems.length ? true : isOpen('systeme', kind === 'tabellen'), systemItems)}
    </ul>`;
  }
}

// ---------------------------------------------------------------------------
// Geschäftsobjekt — Detail
// ---------------------------------------------------------------------------
function objectDetail(ctx, id) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  const o = core.businessObject(C.safeDecode(id));
  if (!o) {
    return C.renderNotFound(ctx, {
      thing: 'Dieses Geschäftsobjekt', title: 'Geschäftsobjekt nicht gefunden',
      backHref: BASE, backLabel: TITEL,
      crumbs: trail(ANWENDUNGEN, { label: TITEL, href: BASE }),
    });
  }
  setTitle(o.name);
  setCrumbs(trail(ANWENDUNGEN, { label: TITEL, href: BASE }, { label: o.name }));

  const st = statusOf(core, o.status);
  const maps = core.realisationsOf(o);
  const contact = core.contacts().find((c) => c.contactId === o.steward);

  // Registerkarten wie in der Objekt-Detailansicht des Inventars: der Einstieg
  // zeigt, WO der Begriff in den Systemen liegt; die Attributliste — die lange
  // Tabelle — liegt einen Klick daneben, statt die Seite zu verlängern.
  // Beide Panels stehen im DOM (C.tabPanels blendet nur um), deshalb lassen sich
  // ihre Tabellen unten in einem Zug montieren.
  const tabs = [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'attribute', label: `Attribute (${o.attributes.length})` },
    { id: 'realisierung', label: `Realisierung (${maps.length})` },
  ];
  // ?tab= steht in der Adresse (App-Detail-Rezept, Design-Review B3): ein
  // geteilter Link öffnet denselben Reiter; unbekannte Werte fallen still auf
  // die Übersicht zurück. replaceState statt location.hash — ein Reiterwechsel
  // ist ein Zustandswechsel, der Router soll weder neu rendern noch fokussieren.
  let active = query.get('tab') || tabs[0].id;
  if (!tabs.some((x) => x.id === active)) active = tabs[0].id;
  const syncHash = (tab) => {
    const p = new URLSearchParams({ id: o.objectId });
    if (tab !== tabs[0].id) p.set('tab', tab);
    history.replaceState(history.state, '', `${BASE}?${p}`);
  };
  // Die Übersicht trägt, was den Begriff AUSMACHT — Definition, Abgrenzung,
  // gebräuchliche Benennungen. Als eigene Abschnitte waren sie zu viel für den
  // Einstieg (siehe unten); als erster Reiter sind sie genau das, was man beim
  // Aufschlagen lesen will, ohne die langen Tabellen davor.
  const panelHtml = (id) => {
    if (id === 'attribute') return '<div id="mc-attrs"></div>';
    // Auch ohne Abbildung die TABELLE, nicht ein Leerzustand an ihrer Stelle:
    // C.mountDataTable behält Kopfzeile und Spalten und schreibt eine Zeile
    // hinein, die sagt warum — dasselbe Muster wie «Anträge zu diesem
    // Mietobjekt» im Mietendenportal. So sieht man, WAS hier stünde.
    if (id === 'realisierung') return '<div id="mc-maps"></div>';
    // Übersicht im Muster des Datensatzblatts (js/pages/catalog.js,
    // Nutzerentscheid 2026-08-04): die Definition steht als Lead unter der H1,
    // danach «Verantwortliche Personen» und «Metadaten» als linierte kv-Listen
    // in voller Breite — «Metadaten» statt «Eckdaten», weil die Einträge dieses
    // Katalogs Metadaten SIND (dieselbe Ausnahme wie das DCAT-Blatt, Kanon D26).
    // Die frühere Randspalte entfällt; die Tabellen-Reiter daneben sind ohnehin
    // vollbreit. Attribut- und Realisierungszahl fehlen bewusst — sie stehen in
    // den Reiterbeschriftungen, eine zweite Nennung wäre eine Dublette.
    return `${personsSection(contact)}
      <section class="detail-section">
        <h2 class="detail-section__title">Metadaten</h2>
        <dl class="kv kv--ruled">
          <dt>Datendomäne</dt><dd><a href="${C.catalogueHash(BASE, { domain: [o.domain] })}">${esc(domainLabel(core, o.domain))}</a></dd>
          <dt>Status</dt><dd>${C.badge(st.label, st.variant)}</dd>
          ${o.standardRef ? `<dt>Norm-Referenz</dt><dd>${esc(o.standardRef)}</dd>` : ''}
          ${/* Abgrenzung, Zweitbenennungen und EGID/EGRID-Relevanz sind im
                Bestand zu EINER Bemerkung zusammengefasst — drei dünne Zeilen,
                von denen keine gefiltert oder sortiert wurde. */''}
          ${o.comment ? `<dt>Bemerkung</dt><dd>${esc(o.comment)}</dd>` : ''}
          ${o.updated ? `<dt>Stand</dt><dd>${esc(datum(o.updated))}</dd>` : ''}
          <dt>ID</dt><dd><code>${esc(o.objectId)}</code></dd>
        </dl>
      </section>`;
  };

  mount.innerHTML = `
  <div class="container section">
    ${/* App-Detailkopf (detailBar + h1, Design-Review B2) statt des Hero-Bands:
          diese Ansichten folgen dem Objekt-Detail-Rezept der Apps — der Hero
          gehört den Inhaltsseiten. Ohne Pillenzeile: Domäne, Status und
          Realisierungsgrad standen dort als Marken UND direkt darunter in den
          Eckdaten — zweimal dasselbe, und die Marken sagten es unpräziser. */''}
    ${C.detailBar({ backHref: BASE, backLabel: TITEL })}
    <h1 tabindex="-1">${esc(o.name)}</h1>
    ${/* Die Definition ist die Beschreibung des Begriffs und steht als Lead
          unter der H1 — wie auf dem Datensatzblatt (Nutzerentscheid
          2026-08-04); in der Metadaten-Liste wiederholt sie sich nicht. */''}
    ${o.definition ? `<p class="lead">${esc(o.definition)}</p>` : ''}

    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active, idPrefix: 'mc-tab', ariaLabel: 'Geschäftsobjekt' })}
      ${C.tabPanels({ items: tabs, active, idPrefix: 'mc-tab', render: panelHtml, heading: true })}
    </div>
  </div>`;

  C.wireTabs(mount, { syncHash });

  // Attribute — die Tabelle trägt die eigentliche Substanz des Geschäftsobjekts
  // und wird bei grösseren Objekten lang; darum C.mountDataTable mit Suche,
  // Sortierung und Blätterleiste statt einer nackten C.table.
  ctx.onUnmount(C.mountDataTable(mount.querySelector('#mc-attrs'), {
    id: 'mc-at', unit: { nom: 'Attribute', dat: 'Attributen' }, caption: `Attribute von ${o.name}`, perPage: 15,
    rows: o.attributes,
    searchKeys: ['name', 'definition'],
    sorts: [
      { value: 'ord', label: 'Reihenfolge', cmp: () => 0 },
      { value: 'name', label: 'Bezeichnung (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
    ],
    facets: [
      { dim: 'keyRole', legend: 'Schlüsselrolle',
        options: Object.entries(KEY_ROLE).map(([v, l]) => ({ value: v, label: l })),
        match: (r, vals) => vals.includes(r.keyRole) },
      { dim: 'required', legend: 'Pflichtangabe',
        options: [{ value: 'ja', label: 'Pflicht' }, { value: 'nein', label: 'Optional' }],
        match: (r, vals) => vals.includes(r.required ? 'ja' : 'nein') },
    ],
    // Eine Angabe je Spalte, nichts übereinandergestapelt. «Realisiert durch»
    // steht bewusst NICHT hier: die Abbildung hat einen eigenen Abschnitt
    // darunter, mit eigenen Spalten für System, Tabelle, Feld und Güte — hier
    // wäre sie eine gedrängte Wiederholung. Die Norm-Referenz je Attribut
    // entfällt aus demselben Grund; die des Geschäftsobjekts steht in den
    // Metadaten.
    columns: [
      { key: 'name', label: 'Attribut', width: '14rem', render: (a) =>
        `<strong>${esc(a.name)}</strong>${a.required ? '' : ' <span class="small muted">optional</span>'}` },
      { key: 'definition', label: 'Beschreibung', render: (a) =>
        a.definition ? esc(a.definition) : '<span class="muted">—</span>' },
      { key: 'type', label: 'Werttyp', width: '8rem', render: (a) => esc(VALUE_TYPE[a.type] || a.type) },
      { key: 'keyRole', label: 'Schlüssel', width: '6rem', render: (a) =>
        a.keyRole ? C.badge(a.keyRole, a.keyRole === 'PK' ? 'info' : 'gray', 'sm') : '<span class="muted">—</span>' },
    ],
  }));

  ctx.onUnmount(C.mountDataTable(mount.querySelector('#mc-maps'), {
    id: 'mc-mp', unit: 'Realisierungen', caption: `Realisierungen von ${o.name}`, perPage: 15,
    emptyMsg: 'Für dieses Geschäftsobjekt ist keine Realisierung erfasst — entweder führt es kein angeschlossenes System, oder die Abbildung ist noch nicht dokumentiert.',
    rows: maps.map((m) => {
      const t = core.systemTable(m.tableId) || {};
      return { ...m, systemName: t.systemName || '', tableName: t.displayName || m.tableId, technical: t.name || '' };
    }),
    searchKeys: ['attribute', 'field', 'tableName', 'systemName'],
    sorts: [
      { value: 'attr', label: 'Attribut (A–Z)', cmp: (a, b) => a.attribute.localeCompare(b.attribute, 'de') },
      { value: 'sys', label: 'System', cmp: (a, b) => a.systemName.localeCompare(b.systemName, 'de') },
    ],
    columns: [
      { key: 'attribute', label: 'Attribut', render: (m) => esc(m.attribute) },
      { key: 'systemName', label: 'System', render: (m) => esc(m.systemName) },
      { key: 'tableName', label: 'Tabelle', render: (m) =>
        `<a href="${tblHref(m.tableId)}">${esc(m.tableName)}</a><br><span class="small muted"><code>${esc(m.technical)}</code></span>` },
      { key: 'field', label: 'Feld', render: (m) => `<code>${esc(m.field)}</code>` },
      { key: 'match', label: 'Güte', render: (m) => matchBadge(core, m.match) },
    ],
  }));
}

// ---------------------------------------------------------------------------
// Systemtabelle — Detail
// ---------------------------------------------------------------------------
async function tableDetail(ctx, id) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  const t = core.systemTable(C.safeDecode(id));
  if (!t) {
    return C.renderNotFound(ctx, {
      thing: 'Diese Tabelle', title: 'Tabelle nicht gefunden',
      backHref: BASE, backLabel: TITEL,
      crumbs: trail(ANWENDUNGEN, { label: TITEL, href: BASE }),
    });
  }
  // Der publizierte Datensatz wird NUR hier gebraucht — 115 KB lädt man nicht
  // für die Bestandsansicht mit. Nach dem await prüft ctx.stale(), damit eine
  // zwischenzeitliche Navigation nicht überschrieben wird (docs/code-review.md A2).
  if (t.datasetId) {
    await core.ensure('datasets');
    if (ctx.stale()) return;
  }
  setTitle(t.displayName);
  setCrumbs(trail(ANWENDUNGEN, { label: TITEL, href: BASE }, { label: t.displayName }));

  const real = core.realisationsForTable(t.tableId);
  const contact = core.contacts().find((c) => c.contactId === t.steward);
  const dataset = t.datasetId ? core.dataset(t.datasetId) : null;
  // Gleicher Aufbau wie das Geschäftsobjekt: drei Reiter, in der Übersicht die
  // Gleicher Aufbau wie das Geschäftsobjekt (Lead + Verantwortliche Personen +
  // Metadaten) — beide Detailansichten dieses Katalogs sollen sich gleich
  // bedienen lassen; nur die Felder unterscheiden sich.
  const tabs = [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'felder', label: `Felder (${t.fields.length})` },
    { id: 'realisierung', label: `Realisierung (${real.length})` },
  ];
  // ?tab= wie beim Geschäftsobjekt (Design-Review B3): geteilter Link öffnet
  // denselben Reiter; replaceState, weil ein Reiterwechsel kein Neuaufbau ist.
  let active = query.get('tab') || tabs[0].id;
  if (!tabs.some((x) => x.id === active)) active = tabs[0].id;
  const syncHash = (tab) => {
    const p = new URLSearchParams({ table: t.tableId });
    if (tab !== tabs[0].id) p.set('tab', tab);
    history.replaceState(history.state, '', `${BASE}?${p}`);
  };
  const panelHtml = (id) => {
    if (id === 'felder') return '<div id="mc-fields"></div>';
    // Wie beim Geschäftsobjekt: leere Tabelle mit Kopfzeile statt Leerzustand.
    if (id === 'realisierung') return '<div id="mc-real"></div>';
    // Wie beim Geschäftsobjekt (Nutzerentscheid 2026-08-04): Beschreibung als
    // Lead unter der H1, dann «Verantwortliche Personen» und «Metadaten» als
    // linierte kv-Listen; die Zahlen der Reiterbeschriftungen (Felder,
    // Realisierungen) stehen nicht ein zweites Mal hier.
    return `${personsSection(contact)}
      <section class="detail-section">
        <h2 class="detail-section__title">Metadaten</h2>
        <dl class="kv kv--ruled">
          <dt>System</dt><dd>${esc(t.systemName)}</dd>
          <dt>Schema</dt><dd>${esc(t.schemaLabel)}<br><span class="small muted"><code>${esc(t.schema)}</code> · ${esc(SCHEMA_TYPE[t.schemaType] || t.schemaType)}</span></dd>
          <dt>Technischer Name</dt><dd><code>${esc(t.name)}</code></dd>
          <dt>Art</dt><dd>${esc(TABLE_TYPE[t.type] || t.type)}</dd>
          ${/* Aus der entfallenen Pillenzeile hierher: die Zertifizierung ist
                eine Eigenschaft der Tabelle und darf nicht verschwinden. */''}
          <dt>Zertifiziert</dt><dd>${t.certified ? 'Ja' : 'Nein'}</dd>
          ${/* «Zeilen», nicht «Datensätze»: das Wort «Datensatz» bleibt dem
                DCAT-Katalog vorbehalten (Terminologie-Kanon D22). */''}
          <dt>Zeilen</dt><dd>${t.rowCount ? num(t.rowCount) : '—'}</dd>
          ${/* Die Brücke in den DCAT-Katalog steht in den Metadaten statt in einer
                eigenen Karte: sie ist eine EIGENSCHAFT dieser Tabelle («wird als
                dieser Datensatz publiziert»), keine Aktion. */''}
          ${dataset ? `<dt>Publiziert als</dt><dd><a href="${esc(links.datensatz(dataset.id))}">${esc(core.t(dataset.title))}</a></dd>` : ''}
          ${/* Externer Sprung, darum mit target/rel; beschriftet mit dem Host statt
                mit der ganzen REST-Adresse, die 70 Zeichen lang nichts hinzufügt. */''}
          ${t.sourceUrl ? `<dt>Quellsystem</dt><dd><a href="${esc(t.sourceUrl)}" target="_blank" rel="noopener external">${esc(hostOf(t.sourceUrl))}</a></dd>` : ''}
          ${t.updated ? `<dt>Stand</dt><dd>${esc(datum(t.updated))}</dd>` : ''}
          <dt>ID</dt><dd><code>${esc(t.tableId)}</code></dd>
        </dl>
      </section>`;
  };

  mount.innerHTML = `
  <div class="container section">
    ${/* App-Detailkopf (detailBar + h1, Design-Review B2) statt des Hero-Bands
          — wie beim Geschäftsobjekt. Ohne Pillenzeile: System, Art und
          Zertifizierung stehen in den Metadaten. */''}
    ${C.detailBar({
      backHref: C.catalogueHash(BASE, { kind: 'tabellen', system: [t.system] }),
      backLabel: t.systemName,
    })}
    <h1 tabindex="-1">${esc(t.displayName)}</h1>
    ${t.description ? `<p class="lead">${esc(t.description)}</p>` : ''}

    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active, idPrefix: 'mc-ttab', ariaLabel: 'Systemtabelle' })}
      ${C.tabPanels({ items: tabs, active, idPrefix: 'mc-ttab', render: panelHtml, heading: true })}
    </div>
  </div>`;

  C.wireTabs(mount, { syncHash });

  ctx.onUnmount(C.mountDataTable(mount.querySelector('#mc-fields'), {
    id: 'mc-fl', unit: { nom: 'Felder', dat: 'Feldern' }, caption: `Felder von ${t.name}`, perPage: 15,
    rows: t.fields.map((f) => ({ ...f, real: core.realisedBy(t.tableId, f.name) })),
    searchKeys: ['name', 'description', 'dataType'],
    sorts: [
      { value: 'ord', label: 'Reihenfolge im System', cmp: () => 0 },
      { value: 'name', label: 'Feldname (A–Z)', cmp: (a, b) => a.name.localeCompare(b.name, 'de') },
      { value: 'real', label: 'Realisierte Geschäftsobjekte zuerst', cmp: (a, b) => b.real.length - a.real.length },
    ],
    facets: [
      { dim: 'key', legend: 'Schlüssel',
        options: [{ value: 'pk', label: 'Primärschlüssel' }, { value: 'fk', label: 'Fremdschlüssel' }],
        match: (r, vals) => (vals.includes('pk') && r.primaryKey) || (vals.includes('fk') && r.foreignKey) },
      { dim: 'katalog', legend: 'Katalog',
        options: [{ value: 'ja', label: 'Trägt einen Begriff' }, { value: 'nein', label: 'Ohne Begriff' }],
        match: (r, vals) => vals.includes(r.real.length ? 'ja' : 'nein') },
    ],
    columns: [
      // Wie die Attributtabelle: eine Angabe je Spalte, die Beschreibung mit
      // eigener Spalte statt unter dem Feldnamen gestapelt.
      { key: 'name', label: 'Feld', width: '13rem', render: (f) => `<code>${esc(f.name)}</code>` },
      { key: 'description', label: 'Beschreibung', render: (f) =>
        f.description ? esc(kurz(f.description, 120)) : '<span class="muted">—</span>' },
      { key: 'dataType', label: 'Datentyp', width: '9rem', render: (f) => `<code class="small">${esc(f.dataType)}</code>` },
      { key: 'key', label: 'Schlüssel', width: '7rem', render: (f) =>
        [f.primaryKey ? C.badge('PK', 'info', 'sm') : '', f.foreignKey ? C.badge('FK', 'gray', 'sm') : ''].filter(Boolean).join(' ')
        || (f.nullable ? '<span class="muted">optional</span>' : '<span class="muted">—</span>') },
      // Nur das Geschäftsobjekt, nicht zusätzlich das Attribut: das Paar
      // «Objekt · Attribut» zwang die Spalte auf eine Breite, die der Tabelle
      // bei 1280px nicht mehr blieb. Welches Attribut es ist, steht im
      // Abschnitt «Realisierte Geschäftsobjekte» darunter — und im Titel.
      { key: 'real', label: 'Realisiert', render: (f) => f.real.length
        ? f.real.map((r) => `<a class="badge badge--info" href="${objHref(r.objectId)}" title="${esc(`${r.objectName} · ${r.attribute}`)}">${esc(r.objectName)}</a>`).join(' ')
        : '<span class="muted">—</span>' },
    ],
  }));

  ctx.onUnmount(C.mountDataTable(mount.querySelector('#mc-real'), {
    id: 'mc-rl', unit: { nom: 'Begriffe', dat: 'Begriffen' }, caption: `Von ${t.name} realisierte Geschäftsobjekte`, perPage: 15,
    emptyMsg: 'Diese Tabelle realisiert kein katalogisiertes Geschäftsobjekt — die Abbildung wird am Attribut des Geschäftsobjekts gepflegt und ist hier noch nicht erfasst.',
    rows: real,
    searchKeys: ['objectName', 'attribute', 'field'],
    sorts: [
      { value: 'obj', label: 'Geschäftsobjekt (A–Z)', cmp: (a, b) => a.objectName.localeCompare(b.objectName, 'de') },
      { value: 'field', label: 'Feld (A–Z)', cmp: (a, b) => a.field.localeCompare(b.field, 'de') },
    ],
    columns: [
      { key: 'objectName', label: 'Geschäftsobjekt', render: (r) => `<a href="${objHref(r.objectId)}">${esc(r.objectName)}</a>` },
      { key: 'attribute', label: 'Attribut', render: (r) => esc(r.attribute) },
      { key: 'field', label: 'Feld', render: (r) => `<code>${esc(r.field)}</code>` },
      { key: 'match', label: 'Güte', render: (r) => matchBadge(core, r.match) },
    ],
  }));
}
