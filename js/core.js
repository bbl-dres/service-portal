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
  // Liegenschaften-Inventar-Detailregister (SAP RE-FX-Untertabellen, re-keyed auf bbl_id):
  assets:           'data/assets.json',            // Ausstattung
  contracts:        'data/contracts.json',         // Verträge
  costs:            'data/costs.json',              // Kosten
  areas:            'data/area-measurements.json',  // Flächen / Bemessungen
  buildingContacts: 'data/building-contacts.json',  // Objektkontakte (nicht die Dienstleistungs-Kontakte)
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
  buildings: 'Liegenschaften', parcels: 'Grundstücke', projects: 'Bauprojekte', services: 'Dienstleistungen',
  applications: 'Anwendungen', documents: 'Dokumente', media: 'Mediathek',
  weisungen: 'Weisungen', news: 'News', contacts: 'Kontakte', reference: 'Referenzdaten',
  datasets: 'Datenkatalog', catalogLabels: 'Katalog-Beschriftungen', appPages: 'Anwendungsseiten',
  assets: 'Ausstattung', contracts: 'Verträge', costs: 'Kosten', areas: 'Flächen',
  buildingContacts: 'Objektkontakte', landcovers: 'Bodenbedeckung',
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

// Grundstücke (parcels.geojson) — Polygon-Geometrie, verknüpft mit dem Gebäude über
// das WE-Segment der bbl_id (1000/4840/01 ↔ 1000/4840/AF). Geometrie bleibt erhalten
// für die Karten-Polygone und die Detail-Minikarte.
function normalizeParcel(f) {
  const p = (f && f.properties) || {};
  return {
    bbl_id: p.bbl_id, bbl_we: p.bbl_we || '', name: p.bbl_bez || p.bbl_id, plotNumber: p.av_nr || '',
    street: [p.adr_str, p.adr_hsnr].filter(Boolean).join(' ').trim(),
    zip: p.adr_plz || '', city: p.adr_ort || '', land: p.adr_land || '', canton: p.adr_reg || '',
    gemeinde: p.bfs_gem || p.adr_ort || '', egrid: p.av_egrid || '',
    gsf: p.larea_gsf || 0, zone: p.av_znut || p.av_zbez || '', portfolio: p.bbl_port || '—',
    ownership: OWNERSHIP(p.bbl_eigen), status: p.bbl_stat || '',
    lat: p.wgs84_lat, lng: p.wgs84_lon, geom: (f && f.geometry) || null,
  };
}

// Bodenbedeckung (AV-Landcover) — Polygone je Grundstück; verknüpft über bbl_id
// (= Grundstück-ID) bzw. geb_id (= Gebäude-ID). Für das Grundstück-Register «Bodenbedeckung».
function normalizeLandcover(f) {
  const p = (f && f.properties) || {};
  return {
    parcelId: p.bbl_id, buildingId: p.geb_id, type: p.av_type || '—', area: p.lc_area || 0,
    status: p.av_stat || '', egid: p.av_egid || '', egrid: p.av_egrid || '',
    geom: (f && f.geometry) || null, lat: p.wgs84_lat, lng: p.wgs84_lon,
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

  // Golden Record (Gebäude + Grundstücke): GeoJSON-Objekte ({type,features}), nicht
  // die Listenform der übrigen Dateien — eigener Pfad mit Normalisierung, aber
  // parallel geladen, damit der Boot (window.__login etc.) nicht unnötig wartet.
  const [bFc, pFc, lFc] = await Promise.all([
    fetchJSON('data/buildings.geojson', { shape: 'object' }).catch((e) => { console.warn('[core] buildings.geojson', e.message); return null; }),
    fetchJSON('data/parcels.geojson', { shape: 'object' }).catch((e) => { console.warn('[core] parcels.geojson', e.message); return null; }),
    fetchJSON('data/landcovers.geojson', { shape: 'object' }).catch((e) => { console.warn('[core] landcovers.geojson', e.message); return null; }),
  ]);
  DATA.buildings = bFc ? (bFc.features || []).map(normalizeBuilding).filter((b) => b.bbl_id) : [];
  if (!DATA.buildings.length) FAILED.add('buildings');
  DATA.parcels = pFc ? (pFc.features || []).map(normalizeParcel).filter((p) => p.bbl_id) : [];
  if (!pFc) FAILED.add('parcels');
  DATA.landcovers = lFc ? (lFc.features || []).map(normalizeLandcover).filter((l) => l.parcelId) : [];
  if (!lFc) FAILED.add('landcovers');
  return DATA;
}

const find = (arr, key, id) => (arr || []).find(x => x[key] === id);

export const core = {
  load,
  data: DATA,
  buildings: () => DATA.buildings || [],
  building: (id) => find(DATA.buildings, 'bbl_id', id),
  parcels: () => DATA.parcels || [],
  parcel: (id) => find(DATA.parcels, 'bbl_id', id),
  // Grundstücke eines Gebäudes (oder umgekehrt) über das WE-Segment der bbl_id.
  parcelsForBuilding: (bid) => { const we = String(bid || '').split('/')[1]; return (DATA.parcels || []).filter(p => String(p.bbl_id).split('/')[1] === we); },
  projects: () => DATA.projects || [],
  project: (id) => find(DATA.projects, 'projectId', id),
  projectsForBuilding: (bid) => (DATA.projects || []).filter(p => p.buildingId === bid),
  // Liegenschaften-Inventar-Detailregister — je Gebäude über buildingId (= bbl_id).
  assetsForBuilding: (bid) => (DATA.assets || []).filter(a => a.buildingId === bid),
  contractsForBuilding: (bid) => (DATA.contracts || []).filter(c => c.buildingId === bid),
  costsForBuilding: (bid) => (DATA.costs || []).filter(c => c.buildingId === bid),
  areasForBuilding: (bid) => (DATA.areas || []).filter(a => a.buildingId === bid),
  buildingContactsFor: (bid) => (DATA.buildingContacts || []).filter(c => c.buildingId === bid),
  // Bodenbedeckung je Grundstück (parcelId = bbl_id des Grundstücks).
  landcoversForParcel: (pid) => (DATA.landcovers || []).filter(l => l.parcelId === pid),
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
