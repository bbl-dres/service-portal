// Datenkern des Prototyps: lädt die ECHTEN data/*.json und baut daraus den
// Suchindex — nach demselben Bauplan wie buildIndex() in js/pages/search.js.
//
// Bewusst NICHT geladen: spaces.json (239 KB), api-specs.json (173 KB) und die
// übrigen Grossdateien. Sie tragen zur Suchfrage nichts bei, was die sechs
// Sammlungen hier nicht schon zeigen, und der Prototyp soll sofort stehen.

import { prepare } from '../../../../js/search/search-engine.js';

const ROOT = '../../../../';
const json = (name) => fetch(ROOT + 'data/' + name).then((r) => {
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
});

// Mehrsprachige Felder wie im Portal (core.t): Deutsch, sonst erste Sprache.
const t = (v) => (v && typeof v === 'object' && !Array.isArray(v))
  ? (v.de || Object.values(v)[0] || '') : (v || '');

// Routen wie js/links.js sie bildet.
const q = (v) => encodeURIComponent(String(v ?? ''));
export const links = {
  service:      (id) => `#/services/${q(id)}`,
  application:  (id) => `#/applications/${q(id)}`,
  dataset:      (id) => `#/data/catalog/${q(id)}`,
  portfolioItem:(id) => `#/app/portfolio?id=${q(id)}`,
  news:         (id) => `#/news/${q(id)}`,
  businessObject:(id) => `#/app/metadata-catalog?id=${q(id)}`,
  processDoc:   (id, branch) => `#/app/process-docs?${branch === 'portal' ? 'def' : 'id'}=${q(id)}`,
};

// Reihenfolge der Gruppen im Vorschlagsfeld und in den Facetten. Sie folgt
// dem, wofür Leute das Portal öffnen: etwas erledigen, ein System öffnen,
// etwas nachschlagen. Dieselbe Rangfolge, die TYPE_BOOST im Portal setzt.
export const KIND_ORDER = [
  'Dienstleistungen', 'Anwendungen', 'Wissen und Hilfsmittel',
  'Datensätze', 'Prozesse', 'Geschäftsobjekte', 'Liegenschaften', 'News',
];

let INDEX = null;
let FAILED = [];

export function failedAreas() { return FAILED; }

export async function load() {
  if (INDEX) return INDEX;
  const names = ['services.json', 'applications.json', 'datasets.json', 'processes.json',
    'business-objects.json', 'news.json', 'reference-data.json', 'buildings.geojson'];
  const settled = await Promise.allSettled(names.map(json));
  const got = {};
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') got[names[i]] = r.value;
    else FAILED.push(names[i]);
  });

  const ref = got['reference-data.json'] || {};
  const domainLabel = (k) => (ref.domains || []).find((d) => d.key === k)?.label || k || '';
  const rows = [];

  // --- Dienstleistungen. `boost` wie im Portal: Vorgänge und häufig Genutztes
  //     zuerst, denn dafür wird das Portal geöffnet.
  for (const s of got['services.json'] || []) {
    rows.push({
      kind: 'Dienstleistungen',
      type: s.type === 'action' ? 'Dienstleistung · Vorgang' : 'Dienstleistung',
      title: s.title, desc: s.short, href: links.service(s.serviceId),
      meta: domainLabel(s.domain),
      answerText: s.description || s.short,
      requires: s['voraussetzungen'] || [],
      extra: [domainLabel(s.domain), s.description, (s['voraussetzungen'] || []).join(' '),
        String(s.serviceId).replace(/-/g, ' ')].join(' '),
      boost: (s.type === 'action' ? 12 : 0) + (s.popular ? Math.max(0, 20 - s.popular * 2) : 0),
    });
  }

  for (const a of got['applications.json'] || []) {
    rows.push({
      kind: 'Anwendungen', type: 'Anwendung',
      title: a.name, desc: a.description, href: links.application(a.appId),
      meta: a.group, answerText: a.description,
      extra: [a.group, a.area, a.long, String(a.appId).replace(/-/g, ' ')].join(' '),
      boost: 6,
    });
  }

  for (const d of got['datasets.json'] || []) {
    rows.push({
      kind: 'Datensätze', type: 'Datensatz',
      title: t(d.title), desc: t(d.description), href: links.dataset(d.id),
      meta: t(d.meta && d.meta['thema']), answerText: t(d.description),
      extra: ['Datensatz Datensätze', t(d.fullDescription), (d.tags || []).join(' ')].join(' '),
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
      extra: ['Prozess Prozesse Prozessdokumentation', p.processId, p.areaLabel, p.groupLabel,
        (p.tags || []).join(' '), (p.systems || []).join(' '),
        String(p.processId).replace(/\./g, ' ')].filter(Boolean).join(' '),
    });
  }

  for (const o of got['business-objects.json'] || []) {
    rows.push({
      kind: 'Geschäftsobjekte', type: 'Geschäftsobjekt',
      title: o.name, desc: o.definition, href: links.businessObject(o.objectId),
      meta: '', answerText: o.definition,
      extra: ['Geschäftsobjekt Geschäftsobjekte Fachbegriff', o.objectId, o.comment,
        (o.attributes || []).map((a) => `${a.name} ${a.definition || ''}`).join(' ')].join(' '),
    });
  }

  // --- Liegenschaften aus dem GeoJSON, Felder wie js/core/index.js sie abbildet.
  for (const f of (got['buildings.geojson'] || {}).features || []) {
    const b = f.properties || {};
    const name = b['bbl_bez'] || b['bbl_id'];
    const street = [b['adr_str'], b['adr_hsnr']].filter(Boolean).join(' ').trim();
    const place = [b['adr_plz'], b['adr_ort']].filter(Boolean).join(' ').trim();
    rows.push({
      kind: 'Liegenschaften', type: 'Liegenschaft',
      title: name, desc: [street, place].filter(Boolean).join(', '),
      href: links.portfolioItem(b['bbl_id']),
      meta: b['bbl_port'] || '',
      answerText: `${name} liegt an der Adresse ${[street, place].filter(Boolean).join(', ')}.`,
      contacts: [],
      buildingId: b['bbl_id'],
      extra: [String(b['bbl_id']).replace(/\//g, ' '), b['adr_ort'], b['adr_reg'],
        b['bbl_port'], b['bbl_port2'], b['bbl_nutzer']].filter(Boolean).join(' '),
    });
  }

  for (const n of got['news.json'] || []) {
    rows.push({
      kind: 'News', type: 'News', title: n.title, desc: n.teaser,
      href: links.news(n.id), meta: n.source || '', answerText: n.teaser,
      extra: [n.body, n.source].filter(Boolean).join(' '),
    });
  }

  INDEX = rows.map(prepare);
  return INDEX;
}

export function index() { return INDEX || []; }

// Ein Datensatz je Route — der Antwortbau braucht den Rückweg vom Beleg
// zur Quelle, so wie später `search_result_index` ihn liefert.
export function byHref(href) { return (INDEX || []).find((r) => r.href === href) || null; }
