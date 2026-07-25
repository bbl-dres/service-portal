// Shared domain core — single source of truth (mock).
// Loads all data/*.json once; pages read via the accessors below.

import { fetchJSON } from './fetch-json.js';

const DATA = {};

const FILES = {
  projects:     'data/projects.json',
  services:     'data/services.json',
  applications: 'data/applications.json',
  documents:    'data/documents.json',
  media:        'data/media.json',
  weisungen:    'data/weisungen.json',
  news:         'data/news.json',
  contacts:     'data/contacts.json',
  reference:    'data/reference-data.json',
  datasets:     'data/datasets.json',
  catalogLabels:'data/catalog-labels.json',
  appPages:     'data/application-pages.json',
};
// data/data-products.json bleibt liegen (DataService- und Concept-Einträge für
// einen künftigen Metadatenkatalog), wird aber von keiner Ansicht mehr gelesen
// und daher auch nicht mehr geladen.

// Schlüssel, deren Datei nicht geladen werden konnte. Ohne diese Merkliste würde
// ein Ausfall als plausible Null durchgehen (leere Liste = «keine Einträge»); die
// Shell blendet stattdessen ein Fehlerband ein und C.empty() unterscheidet
// «leer» von «nicht verfügbar» (core.available()).
const FAILED = new Set();

// Fachlicher Name je Datenschlüssel — für das Fehlerband der Shell.
const AREA = {
  buildings: 'Liegenschaften', projects: 'Bauprojekte', services: 'Dienstleistungen',
  applications: 'Anwendungen', documents: 'Dokumente', media: 'Mediathek',
  weisungen: 'Weisungen', news: 'News', contacts: 'Kontakte', reference: 'Referenzdaten',
  datasets: 'Datenkatalog', catalogLabels: 'Katalog-Beschriftungen', appPages: 'Anwendungsseiten',
};

// Objekt-Dateien (Key-Value-Maps) vs. Listen — bestimmt Fallback und Formprüfung.
const OBJECT_FILES = new Set(['reference', 'catalogLabels', 'appPages']);

// Gebäude kommen aus dem SAP-RE-FX-Golden-Record (data/buildings.geojson) — dieselbe
// Quelle und dieselben bbl_id wie das Immobilienportfolio-Dashboard, damit die
// Karten-Deeplinks (#/app/portfolio?id=<bbl_id>) im Inventar aufgehen. Die rohen
// SAP-Felder werden hier auf die schlanke Gebäudeform normalisiert, die alle
// Ansichten (Liste, Detail, Formular-Auswahllisten, Verknüpfungen) lesen.
const OWNERSHIP = (v) => v === 'Eigentum Bund' ? 'Im Eigentum' : v === 'Miete' ? 'Anmieter' : 'Sonderfall';
function normalizeBuilding(f) {
  const p = (f && f.properties) || {};
  const m = String((Array.isArray(p.img_url) ? p.img_url[0] : p.img_url) || '').match(/photo-([\w-]+)/);
  const isDiplo = /Botschaft|Konsulat|Diplomat|Vertretung/i.test(`${p.bbl_bez || ''} ${p.bbl_port || ''}`);
  return {
    bbl_id: p.bbl_id, bbl_we: p.bbl_we || '', egid: p.av_egid || '',
    name: p.bbl_bez || p.bbl_id, portfolioCategory: p.bbl_port || p.bbl_gbda1 || '—', typ: p.bbl_gbda1 || '',
    street: [p.adr_str, p.adr_hsnr].filter(Boolean).join(' ').trim(),
    zip: p.adr_plz || '', city: p.adr_ort || '', land: p.adr_land || '', canton: p.adr_reg || '',
    lat: p.wgs84_lat, lng: p.wgs84_lon,
    gf: p.garea_gf || 0, hnf: p.garea_hnf || 0, buildYear: p.bbl_bjahr || '',
    ownership: OWNERSHIP(p.bbl_eigen), erhaltung: p.bbl_ostr || '', heritage: p.bbl_arch === 'Ja',
    status: p.bbl_stat || '',                          // Aktiv | Abgang | Löschvermerk (reference.buildingStatuses)
    classification: isDiplo ? 'VERTRAULICH' : 'INTERN', // im Golden Record nicht geführt → aus dem Portfolio-Typ abgeleitet
    photo: m ? m[1] : '', color: '#2f4356',
  };
}

async function load() {
  const entries = await Promise.all(Object.entries(FILES).map(async ([k, url]) => {
    const isObj = OBJECT_FILES.has(k);
    try {
      // Formprüfung (C4): eine Datei, die zwar parst, aber die falsche Grundform
      // hat (z. B. projects.json → {}), landet so im Ausfallpfad statt später
      // beim ersten Accessor (`{}.find`) zu werfen.
      return [k, await fetchJSON(url, { shape: isObj ? 'object' : 'array' })];
    } catch (e) {
      console.warn('[core] could not load', url, e.message);
      FAILED.add(k);
      return [k, isObj ? {} : []];
    }
  }));
  for (const [k, v] of entries) DATA[k] = v;

  // Golden Record separat laden: GeoJSON ist ein Objekt ({type,features}), nicht die
  // Listenform der übrigen Dateien — daher eigener Pfad mit Normalisierung.
  try {
    const fc = await fetchJSON('data/buildings.geojson', { shape: 'object' });
    DATA.buildings = (fc.features || []).map(normalizeBuilding).filter(b => b.bbl_id);
    if (!DATA.buildings.length) throw new Error('keine Gebäude im Golden Record');
  } catch (e) {
    console.warn('[core] could not load data/buildings.geojson', e.message);
    FAILED.add('buildings');
    DATA.buildings = [];
  }
  return DATA;
}

const find = (arr, key, id) => (arr || []).find(x => x[key] === id);

export const core = {
  load,
  data: DATA,
  buildings: () => DATA.buildings || [],
  building: (id) => find(DATA.buildings, 'bbl_id', id),
  projects: () => DATA.projects || [],
  project: (id) => find(DATA.projects, 'projectId', id),
  projectsForBuilding: (bid) => (DATA.projects || []).filter(p => p.buildingId === bid),
  services: () => DATA.services || [],
  service: (id) => find(DATA.services, 'serviceId', id),
  servicesByDomain: () => groupBy(DATA.services || [], 'domain'),
  applications: () => DATA.applications || [],
  applicationsByGroup: () => groupBy(DATA.applications || [], 'group'),
  application: (id) => find(DATA.applications, 'appId', id),
  appPage: (id) => (DATA.appPages || {})[id] || null,
  documents: () => DATA.documents || [],
  documentsForBuilding: (bid) => (DATA.documents || []).filter(d => (d.linkedTo || []).includes(bid)),
  media: () => DATA.media || [],
  mediaForBuilding: (bid) => (DATA.media || []).filter(m => m.buildingId === bid),
  weisungen: () => DATA.weisungen || [],
  weisung: (id) => find(DATA.weisungen, 'directiveId', id),
  weisungenForService: (sid) => (DATA.weisungen || []).filter(w => (w.relatedServices || []).includes(sid)),
  news: () => DATA.news || [],
  newsItem: (id) => find(DATA.news, 'id', id),
  contacts: () => DATA.contacts || [],
  ref: () => DATA.reference || {},
  // DCAT-AP-CH datasets (Datenbezug). Strings are multilingual objects; the
  // portal is DE-only, so read them through core.t().
  datasets: () => DATA.datasets || [],
  dataset: (id) => find(DATA.datasets, 'id', id),
  t: (v) => (v && typeof v === 'object') ? (v.de ?? v.en ?? '') : (v ?? ''),
  label: (key, fallback) => (DATA.catalogLabels || {})[key] || fallback || key,
  // Datenausfall-Status (P0-4): available() sagt, ob ein Schlüssel geladen wurde;
  // failedAreas() liefert die fachlichen Namen der ausgefallenen Bereiche.
  available: (key) => !FAILED.has(key),
  failed: () => Array.from(FAILED),
  failedAreas: () => Array.from(FAILED).map(k => AREA[k] || k),
};

function groupBy(arr, key) {
  const out = {};
  for (const x of arr) { (out[x[key]] = out[x[key]] || []).push(x); }
  return out;
}

export default core;
