// Datenkern der Studie: lädt die ECHTEN data/*.json und baut daraus DENSELBEN
// Index, den js/pages/search.js im Portal baut.
//
// DAS IST DER PUNKT DIESER DATEI. Die frühere Fassung lud sechs Sammlungen und
// nannte das «genug für die Suchfrage». Gemessen war es das nicht: es fehlten
// Wissen und Hilfsmittel (113 Einträge — die grösste Sammlung des Portals),
// Dokumente, Datentabellen und Bauprojekte. Wer in der Studie eine Abfrage
// misst, mass damit etwas anderes als das Portal, und genau das soll hier nicht
// passieren.
//
// GESPIEGELT, NICHT IMPORTIERT: `buildIndex()` ist in js/pages/search.js nicht
// exportiert, und die Studie fasst das Portal nicht an. Der Aufbau unten folgt
// ihm Zeile für Zeile — `kind`, `type`, `title`, `desc`, `meta`, `href`, `extra`
// und `boost` je Sammlung. Ändert sich der Index im Portal, muss er hier
// nachgezogen werden; die Kategoriewörter und Gewichte sind mit demselben
// Wortlaut kommentiert, damit ein Abgleich eine Textsuche ist.
//
// EINZIGE AUSNAHME: js/knowledge-content.js wird UNVERÄNDERT importiert. Es ist
// kein Aufbau, sondern der Bestand selbst — 113 Datensätze in Prosa, mit
// Verweisen im Text. Eine Kopie davon wäre nach der ersten Redaktion falsch,
// und «was findet man im Portal» hinge dann an einer veralteten Zweitfassung.
// Ein Import liest nur; er ändert am Portal nichts.

import { prepare } from '../../../../js/search/search-engine.js';
import { knowledgeIndex } from '../../../../js/knowledge-content.js';

// fetch() löst gegen die DOKUMENT-Adresse auf, nicht gegen die Moduladresse:
// index.html liegt in docs/wireframes/<Studie>/, also drei Ebenen unter der
// Wurzel. Die Importe darüber sind modulrelativ (js/ ist eine Ebene tiefer),
// deshalb stehen dort vier.
const ROOT = '../../../';
const json = (name) => fetch(ROOT + 'data/' + name).then((r) => {
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
});

// Mehrsprachige Felder wie im Portal (core.t): Deutsch, sonst erste Sprache.
const t = (v) => (v && typeof v === 'object' && !Array.isArray(v))
  ? (v.de || Object.values(v)[0] || '') : (v || '');

/* ------------------------------------------------------------- Routen --- */
// Gebildet wie js/links.js sie bildet. Die Adressierung ist bewusst NICHT
// einheitlich: Liegenschaften und Parzellen sind Kartenzustand und benutzen
// `?id=`, Bauprojekte und Datensätze sind eigene Orte und benutzen ein
// Pfadsegment. Diese Sammlung soll den Unterschied zeigen, nicht verbergen.
const q = (v) => encodeURIComponent(String(v ?? ''));
// Modullokal: ausserhalb dieser Datei baut niemand Routen.
const links = {
  service:        (id) => `#/services/${q(id)}`,
  application:    (id) => `#/applications/${q(id)}`,
  dataset:        (id) => `#/data/catalog/${q(id)}`,
  dataTable:      (id) => `#/app/metadata-catalog?table=${q(id)}`,
  businessObject: (id) => `#/app/metadata-catalog?id=${q(id)}`,
  portfolioItem:  (id) => `#/app/portfolio?id=${q(id)}`,
  constructionProject: (id) => `#/app/projects/${q(id)}`,
  news:           (id) => `#/news/${q(id)}`,
  // Das Archiv filtert über `?q=`; Dokumente haben keine eigene Route.
  documentSearch: (title) => `#/app/document-archive?q=${q(title)}`,
  // Fachprozesse benutzen `id`, ausführbare Portal-Abläufe `def`.
  processDoc:     (id, branch) => `#/app/process-docs?${branch === 'portal' ? 'def' : 'id'}=${q(id)}`,
};

/* -------------------------------------------------------- Inhaltsarten --- */
// Reihenfolge im Vorschlagsfeld und in den Facetten. Sie folgt dem, wofür Leute
// das Portal öffnen: etwas erledigen, ein System öffnen, etwas nachschlagen.
export const KIND_ORDER = [
  'Dienstleistungen', 'Anwendungen', 'Wissen und Hilfsmittel', 'Datensätze',
  'Datentabellen', 'Prozesse', 'Geschäftsobjekte', 'Dokumente', 'News',
  'Liegenschaften', 'Bauprojekte',
];

// Portal js/search/search-suggest.js: was der Lesende am ehesten gemeint hat,
// NUR als Stichentscheid. Die Maschine addiert das auf die Feldpunkte, wo ein
// Titeltreffer 100 und ein Beschreibungstreffer 20 wert ist — ein starker
// Treffer irgendeiner Art schlägt also weiterhin einen schwachen einer
// bevorzugten. Wissen wird nach UNTEN geschoben statt die anderen drei nach
// oben, damit vergleichbare Treffer sich in beide Richtungen trennen.
const TYPE_BOOST = { service: 24, application: 16, dataset: 6, knowledge: -12 };

let INDEX = null;         // Vollindex der Trefferseite (alle Inhaltsarten)
let SUGGEST = null;       // Vorschlagsindex des Portals (vier Inhaltsarten)
const FAILED = [];

export function failedAreas() { return FAILED.slice(); }
export function index() { return INDEX || []; }
export function suggestIndex() { return SUGGEST || []; }
/** Ein Datensatz je Route — der Antwortbau braucht den Rückweg vom Beleg zur Quelle. */
export function byHref(href) { return (INDEX || []).find((r) => r.href === href) || null; }

/* ----------------------------------------------------------- Aufbau ------ */

export async function load() {
  if (INDEX) return INDEX;

  // Alle Sammlungen, die js/pages/search.js über `needs` anfordert, plus die
  // beiden, die das Portal beim Start ohnehin lädt (services, reference).
  const names = [
    'services.json', 'reference-data.json', 'applications.json', 'datasets.json',
    'data-tables.json', 'processes.json', 'business-objects.json', 'documents.json',
    'news.json', 'projects.json', 'contacts.json', 'buildings.geojson',
  ];
  // allSettled statt all: eine fehlende Datei darf die Studie nicht anhalten.
  // Was fehlt, meldet failedAreas() — sonst sähe ein Ladefehler wie eine
  // plausible Null aus («keine Einträge» statt «nicht geladen»).
  const settled = await Promise.allSettled(names.map(json));
  const got = {};
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') got[names[i]] = r.value;
    else FAILED.push(names[i]);
  });
  // services.json trägt die Studie allein; ohne sie gibt es nichts zu zeigen.
  if (!got['services.json']) throw new Error(FAILED.join(', '));

  const ref = got['reference-data.json'] || {};
  const domainLabel = (k) => (ref.domains || []).find((d) => d.key === k)?.label || k || '';
  const dataDomainLabel = (k) => (ref.dataDomains || []).find((d) => d.key === k)?.label || k || '';
  const contactName = (id) => (got['contacts.json'] || []).find((c) => c.contactId === id)?.name || '';
  const buildingName = (id) => BUILDINGS.find((b) => b.bbl_id === id)?.name || '';

  // Liegenschaften zuerst normalisieren: die Dokumentenzeilen nennen die
  // verknüpften Objekte beim Namen (js/core/index.js normalizeBuilding).
  const BUILDINGS = ((got['buildings.geojson'] || {}).features || []).map((f) => {
    const b = f.properties || {};
    return {
      bbl_id: b['bbl_id'],
      name: b['bbl_bez'] || b['bbl_id'],
      portfolioCategory: b['bbl_port'] || b['bbl_gbda1'] || '—',
      buildingType: b['bbl_gbda1'] || '',
      street: [b['adr_str'], b['adr_hsnr']].filter(Boolean).join(' ').trim(),
      zip: b['adr_plz'] || '', city: b['adr_ort'] || '', canton: b['adr_reg'] || '',
      architect: b['bbl_architekt'] || '', occupants: b['bbl_nutzer'] || '',
      ownership: b['bbl_eigen'] || '',
    };
  }).filter((b) => b.bbl_id);

  const rows = [];

  /* --- Dienstleistungen. `boost` wie im Portal: Rang 1 bekommt +18, Rang 8
     noch +4; jeder Vorgang bekommt +12. Startbares vor Nachschlagbarem. --- */
  for (const s of got['services.json'] || []) {
    rows.push({
      kind: 'Dienstleistungen',
      type: s.type === 'action' ? 'Dienstleistung · Vorgang' : 'Dienstleistung',
      title: s.title, desc: s.short, href: links.service(s.serviceId),
      // KEIN `meta`. Gemessen gegen buildIndex(): das Portal setzt bei
      // Dienstleistungen, Anwendungen und Datensätzen kein meta-Feld, die
      // Trefferzeile trägt dort also nur die Inhaltsart. Die Domäne hier
      // zusätzlich einzublenden wäre eine Verbesserung — aber eine ungefragte,
      // und die Studie wäre dann keine Nachbildung mehr.
      //
      // `sub` ist der Ausweg: ein Feld, das NUR die Studie liest (gruppierte
      // Vorschläge), nie die Trefferseite. So bleibt die Portal-Zeile exakt die
      // des Portals, und der gruppierte Vorschlag sagt trotzdem so viel wie die
      // flache Portal-Liste, in der die Domäne als `desc` erscheint.
      sub: domainLabel(s.domain),
      answerText: s.description || s.short,
      requires: s['voraussetzungen'] || [],
      extra: [domainLabel(s.domain), s.description, (s['voraussetzungen'] || []).join(' '),
        contactName(s.contact), String(s.serviceId).replace(/-/g, ' ')].join(' '),
      boost: (s.type === 'action' ? 12 : 0) + (s.popular ? Math.max(0, 20 - s.popular * 2) : 0),
      // Nur für den Vorschlagsindex, siehe unten.
      _suggest: s.type === 'action'
        ? { resultType: 'Dienstleistung', sdesc: domainLabel(s.domain),
            sextra: [domainLabel(s.domain), s.short, (s['voraussetzungen'] || []).join(' ')].join(' '),
            sboost: TYPE_BOOST.service + (s.popular ? Math.max(0, 20 - s.popular * 2) : 0) }
        : null,
    });
  }

  for (const a of got['applications.json'] || []) {
    rows.push({
      kind: 'Anwendungen', type: 'Anwendung',
      title: a.name, desc: a.description, href: links.application(a.appId),
      sub: a.group,                       // kein `meta`, siehe Dienstleistungen
      answerText: a.description,
      extra: [a.group, a.area, (a.entries || []).map((e) => e.label).join(' '),
        contactName(a.contact), String(a.appId).replace(/-/g, ' ')].join(' '),
      _suggest: { resultType: 'Anwendung', sdesc: a.group,
        sextra: [a.group, a.area, a.description, String(a.appId).replace(/-/g, ' ')].join(' '),
        sboost: TYPE_BOOST.application },
    });
  }

  /* --- Wissen und Hilfsmittel: 113 Dokumente, die vor der Suchüberarbeitung
     gar nicht auffindbar waren. Ziel ist der ABSCHNITT der Themenseite, nicht
     die Datei: dort steht das Dokument in seinem Fachkontext, und eine echte
     Datei-Adresse hat der Prototyp ohnehin nicht. --- */
  for (const k of knowledgeIndex()) {
    rows.push({
      kind: 'Wissen und Hilfsmittel',
      type: k.sectionTitle ? `Unterlage · ${k.sectionTitle}` : 'Unterlage',
      title: k.title, desc: k.desc, href: k.href, external: k.external,
      meta: k.area, extra: k.extra, answerText: k.desc,
      _suggest: { resultType: 'Unterlage', sdesc: k.area, sextra: k.extra, sboost: TYPE_BOOST.knowledge },
    });
  }

  /* --- `kind` ist eine Facette, kein indexierter Text (search-engine.js
     prepare()). Die Datenschichten tragen ihr Kategoriewort deshalb selbst in
     `extra`: wer «Daten» tippt, benennt die Kategorie, und ohne das traf das
     Wort nur dort, wo es zufällig im Titel stand. --- */
  const DATASET_CATEGORY = 'Datensatz Datensätze';
  const TABLE_CATEGORY = 'Datentabelle Datentabellen';
  const ARCHITECTURE_CATEGORY = 'Geschäftsarchitektur Architektur Dokumentation';
  const PROCESS_CATEGORY = `Prozess Prozesse Prozessdokumentation ${ARCHITECTURE_CATEGORY}`;
  const OBJECT_CATEGORY = `Geschäftsobjekt Geschäftsobjekte Fachbegriff ${ARCHITECTURE_CATEGORY}`;

  for (const d of got['datasets.json'] || []) {
    rows.push({
      kind: 'Datensätze', type: 'Datensatz',
      title: t(d.title), desc: t(d.description), href: links.dataset(d.id),
      sub: t(d.meta && d.meta['thema']),  // kein `meta`, siehe Dienstleistungen
      answerText: t(d.description),
      extra: [DATASET_CATEGORY, t(d.fullDescription), (d.tags || []).join(' '),
        t(d.meta && d.meta['thema'])].join(' '),
      _suggest: { resultType: 'Datensatz', sdesc: t(d.meta && d.meta['thema']),
        sextra: [t(d.description), (d.tags || []).join(' ')].join(' '), sboost: TYPE_BOOST.dataset },
    });
  }

  /* --- Datentabellen: ein Datensatz sagt, WAS es gibt; eine Datentabelle sagt,
     welche Felder er wirklich hat — und der Feldname ist genau das, was eine
     Entwicklerin ins Suchfeld tippt. EINE Zeile je TABELLE, nicht je Feld: 325
     Feldzeilen würden jede andere Trefferart begraben. Die Feldnamen fahren
     stattdessen in `extra` mit. --- */
  for (const tb of got['data-tables.json'] || []) {
    rows.push({
      kind: 'Datentabellen',
      type: tb.systemName ? `Datentabelle · ${tb.systemName}` : 'Datentabelle',
      title: tb.displayName || tb.name, desc: tb.description,
      href: links.dataTable(tb.tableId), meta: tb.systemName || '',
      answerText: tb.description,
      extra: [TABLE_CATEGORY, tb.name, tb.schema, tb.schemaLabel, tb.systemName,
        // Beide Hälften eines Feldes: technischer Name und deutsche Beschreibung.
        (tb.fields || []).map((f) => `${f.name} ${f.description || ''}`).join(' '),
      ].filter(Boolean).join(' '),
    });
  }

  for (const p of got['processes.json'] || []) {
    const portal = p.branch === 'portal';
    rows.push({
      kind: 'Prozesse',
      type: portal ? (p.groupLabel ? `Portal-Ablauf · ${p.groupLabel}` : 'Portal-Ablauf')
                   : (p.groupLabel ? `Prozess · ${p.groupLabel}` : 'Prozess'),
      title: p.name, desc: p.description,
      href: links.processDoc(p.processId, p.branch),
      meta: p.areaLabel || '', answerText: p.description,
      extra: [PROCESS_CATEGORY, p.processId, p.areaLabel, p.groupLabel,
        (p.tags || []).join(' '), (p.systems || []).join(' '),
        // Die Prozessnummer, wie sie in einem Dokument zitiert wird — mit und
        // ohne Punkte: «TQ.21.00.00.01» und «TQ 21 00 00 01» müssen beide finden.
        String(p.processId).replace(/\./g, ' '),
      ].filter(Boolean).join(' '),
    });
  }

  // Eine Zeile je OBJEKT, die Attributnamen fahren mit — dieselbe Form wie bei
  // den Datentabellen und aus demselben Grund.
  for (const o of got['business-objects.json'] || []) {
    rows.push({
      kind: 'Geschäftsobjekte', type: 'Geschäftsobjekt',
      title: o.name, desc: o.definition, href: links.businessObject(o.objectId),
      // Ein Geschäftsobjekt antwortet auf `dataDomains`, NICHT auf die
      // Dienstleistungs-Domänen — anderes Vokabular, gleiches Wort.
      meta: dataDomainLabel(o.domain), answerText: o.definition,
      extra: [OBJECT_CATEGORY, o.objectId, dataDomainLabel(o.domain), o.comment,
        (o.attributes || []).map((a) => `${a.name} ${a.definition || ''}`).join(' ')].join(' '),
    });
  }

  for (const d of got['documents.json'] || []) {
    const linked = (d.linkedTo || []).map(buildingName).filter(Boolean);
    rows.push({
      kind: 'Dokumente', type: 'Dokument',
      title: d.title, desc: [d.type, d.category].filter(Boolean).join(' · '),
      // Ziel MIT `q`: das Archiv kann filtern, bekam den Begriff aber nie —
      // jeder Dokumenttreffer landete im ungefilterten Archiv.
      href: links.documentSearch(d.title),
      meta: [d.format, d.year].filter(Boolean).join(' · '),
      answerText: '',
      extra: [d.type, d.category, d.classification, ...linked].join(' '),
    });
  }

  for (const n of got['news.json'] || []) {
    rows.push({
      kind: 'News', type: 'News', title: n.title, desc: n.teaser, meta: n.date,
      href: links.news(n.id), answerText: n.teaser, extra: n.body || '',
    });
  }

  // Liegenschaften: bbl_id OHNE Schrägstriche indexieren, damit sowohl
  // «1080 4840» als auch «1080/4840/AF» zum Objekt führen.
  for (const b of BUILDINGS) {
    rows.push({
      kind: 'Liegenschaften', type: 'Liegenschaft',
      title: b.name,
      desc: [b.street, [b.zip, b.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      href: links.portfolioItem(b.bbl_id),
      meta: b.portfolioCategory,
      answerText: `${b.name} liegt an der Adresse ${[b.street, [b.zip, b.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}.`,
      extra: [String(b.bbl_id).replace(/\//g, ' '), b.city, b.canton, b.portfolioCategory,
        b.buildingType, b.architect, b.occupants, b.ownership].join(' '),
    });
  }

  // Bauprojekte: die Anwendung adressiert sie über ein Pfadsegment, nicht über
  // `?id=` — anders als das Portfolio, wo die Detailansicht Kartenzustand ist.
  for (const p of got['projects.json'] || []) {
    rows.push({
      kind: 'Bauprojekte', type: 'Bauprojekt', title: p.name, desc: p.teaser || '',
      href: links.constructionProject(p.projectId),
      meta: [p.projectNumber, p.status].filter(Boolean).join(' · '),
      answerText: p.teaser || '',
      extra: [p.projectId, p.projectNumber, p.status, p.siaPhaseLabel, p.subPortfolio,
        p.pm, p.buildingId, p.siteName, p.street, p.city, p.canton].filter(Boolean).join(' '),
    });
  }

  // BEWUSST NICHT INDEXIERT, wie im Portal: persönliche Vorgänge. Das ist eine
  // persönliche Arbeitsliste mit eigener Filterung, kein Portalinhalt.

  // prepare() faltet Titel/Beschreibung/extra EINMAL vorab; sonst würde jede
  // Zeile für jeden Term neu normalisiert.
  INDEX = rows.map(prepare);

  /* --- Vorschlagsindex: das PORTAL-Verhalten (js/search/search-suggest.js).
     Vier Inhaltsarten, nicht elf: Vorschläge führen zu etwas Startbarem oder zu
     einem System, und `desc` ist dort die Domäne/Gruppe statt des Fliesstexts.
     Eigene Zeilen, weil `desc` und `boost` andere sind — derselbe Datensatz
     sieht im Vorschlagsfeld anders aus als auf der Trefferseite.

     DIE REIHENFOLGE IST TEIL DES VERHALTENS, nicht Kosmetik. search() sortiert
     `b.score - a.score || a.i - b.i`: bei GLEICHER Punktzahl entscheidet die
     Eingabereihenfolge. Der Vorschlagsindex des Portals sammelt in der Folge
     Dienstleistungen → Anwendungen → Datensätze → Unterlagen, der Vollindex
     dagegen mit Wissen an dritter Stelle. Einfach aus `rows` zu filtern gab
     deshalb 335 von 243 Zeilen an anderer Position — und damit potenziell eine
     andere Trefferfolge, sobald zwei Zeilen gleich punkten. Gemessen: die
     Abfragen fielen zufällig gleich aus, was den Fehler nur unsichtbar macht,
     nicht harmlos. --- */
  const SUGGEST_ORDER = ['Dienstleistungen', 'Anwendungen', 'Datensätze', 'Wissen und Hilfsmittel'];
  SUGGEST = SUGGEST_ORDER
    .flatMap((kind) => rows.filter((r) => r._suggest && r.kind === kind))
    .map((r) => prepare({
    title: r.title,
    desc: r._suggest.sdesc,
    resultType: r._suggest.resultType,
    href: r.href,
    external: r.external,
    kind: r.kind,
    type: r.type,
    meta: r.meta,
    extra: r._suggest.sextra,
    boost: r._suggest.sboost,
  }));

  return INDEX;
}
