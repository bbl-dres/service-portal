// Shared domain core — single source of truth (mock).
// Loads all data/*.json once; pages read via the accessors below.

import { fetchJSON } from './fetch-json.js';

const DATA = {};

// EAGER — nur, was die Shell braucht, bevor der Router überhaupt verteilt.
// js/shell.js liest genau zwei Schlüssel: `ref().domains` und `services()` für
// den Dienstleistungs-Drawer. Alles andere gehört einer Route und wird über
// `needs` nachgeladen.
//
// Vorher standen hier elf Dateien (275 KB, 13 Requests), und `boot()` wartete
// auf jede einzelne, bevor irgendetwas gezeichnet wurde — gedrosselt gemessen
// 7.7 s bis zum ersten Inhalt, obwohl die Startseite fünf davon braucht und die
// Wissensseiten gar keine (docs/code-review.md §1/§3).
const FILES = {
  services:     'data/services.json',
  reference:    'data/reference-data.json',
};

// Aufschiebbar (H4): der Router ruft core.ensure(mod.needs) VOR dem Rendern auf,
// die Zusage je Schlüssel wird gemerkt (PENDING) — zehn Aufrufer erzeugen eine
// Anfrage. Ausfälle landen im selben FAILED-Register wie die Startdateien und
// erscheinen im Fehlerband.
const DEFERRED = {
  applications: 'data/applications.json',           // Anwendungskatalog + Landingpages
  news:         'data/news.json',                   // Startseite, #/news, Suche
  contacts:     'data/contacts.json',               // Dienstleistungs- und Anwendungskontakte
  documents:    'data/documents.json',              // Dokumentenarchiv, Suche
  projects:     'data/projects.json',               // Bauprojekte, Meine Vorgänge
  media:        'data/media.json',                  // 55 KB, NUR die Mediathek
  catalogLabels:'data/catalog-labels.json',         // nur der Datenkatalog
  datasets:     'data/datasets.json',               // 115 KB, nur Datenkatalog + Suche
  // Golden Record — GeoJSON, wird beim Laden normalisiert (siehe loadDeferred).
  buildings:    'data/buildings.geojson',           // 66 KB, Portfolio + 9 weitere Apps
  parcels:      'data/parcels.geojson',             // 79 KB, NUR Portfolio + Mediathek
  // Liegenschaften-Inventar-Detailregister (SAP RE-FX-Untertabellen, re-keyed auf bbl_id):
  assets:           'data/assets.json',            // Ausstattung
  contracts:        'data/contracts.json',         // Verträge
  costs:            'data/costs.json',              // Kosten
  areas:            'data/area-measurements.json',  // Flächen / Bemessungen
  buildingContacts: 'data/building-contacts.json',  // Objektkontakte (nicht die Dienstleistungs-Kontakte)
  landcovers:       'data/landcovers.geojson',      // Bodenbedeckung, nur im Grundstück-Register
  // Mietendenportal (#/app/tenancies): Mietverhältnisse, Geschosse, Räume.
  // Die drei Bestände sind selbsttragend — Standort, Bild und Ansprechstellen
  // stehen im Mietverhältnis, Nutzung und SIA-Kategorie am Raum. Erzeugt von
  // scripts/build-tenancy-data.mjs.
  tenancies:        'data/tenancies.json',
  floors:           'data/floors.json',
  spaces:           'data/spaces.json',
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
  news: 'News', contacts: 'Kontakte', reference: 'Referenzdaten',
  datasets: 'Datenkatalog', catalogLabels: 'Katalog-Beschriftungen',
  assets: 'Ausstattung', contracts: 'Verträge', costs: 'Kosten', areas: 'Flächen',
  buildingContacts: 'Objektkontakte', landcovers: 'Bodenbedeckung',
  tenancies: 'Mietverhältnisse', floors: 'Geschosse', spaces: 'Räume',
};

// Objekt-Dateien (Key-Value-Maps) vs. Listen — bestimmt Fallback und Formprüfung.
const OBJECT_FILES = new Set(['reference', 'catalogLabels']);

// Gebäude kommen aus dem SAP-RE-FX-Golden-Record (data/buildings.geojson) — dieselbe
// Quelle und dieselben bbl_id wie das Immobilienportfolio-Dashboard, damit die
// Karten-Deeplinks (#/app/portfolio?id=<bbl_id>) im Inventar aufgehen. Die rohen
// SAP-Felder werden hier auf die schlanke Gebäudeform normalisiert, die alle
// Ansichten (Liste, Detail, Formular-Auswahllisten, Verknüpfungen) lesen.
const OWNERSHIP = (v) => v === 'Eigentum Bund' ? 'Im Eigentum' : v === 'Miete' ? 'Anmieter' : 'Sonderfall';
function normalizeBuilding(f) {
  const p = (f && f.properties) || {};
  const isDiplo = /Botschaft|Konsulat|Diplomat|Vertretung/i.test(`${p.bbl_bez || ''} ${p.bbl_port || ''}`);
  return {
    bbl_id: p.bbl_id, bbl_we: p.bbl_we || '', egid: p.av_egid || '',
    name: p.bbl_bez || p.bbl_id, portfolioCategory: p.bbl_port || p.bbl_gbda1 || '—', typ: p.bbl_gbda1 || '',
    street: [p.adr_str, p.adr_hsnr].filter(Boolean).join(' ').trim(),
    zip: p.adr_plz || '', city: p.adr_ort || '', land: p.adr_land || '', canton: p.adr_reg || '',
    lat: p.wgs84_lat, lng: p.wgs84_lon,
    gf: p.garea_gf || 0, hnf: p.garea_hnf || 0, buildYear: p.bbl_bjahr || '',
    ownership: OWNERSHIP(p.bbl_eigen), erhaltung: p.bbl_ostr || '', heritage: p.bbl_arch === 'Ja',
    // Recherchierte, belegte Angaben zu den echten Bauten (siehe research/README.md).
    // Leer bei Objekten, für die nichts publiziert ist — dann entfällt die Zeile.
    architekt: p.bbl_architekt || '', nutzer: p.bbl_nutzer || '',
    renovationYear: p.bbl_vjahr || '', kgsKat: p.kgs_kat || '', kgsNr: p.kgs_nr || null,
    quellen: Array.isArray(p.quellen) ? p.quellen : [],
    status: p.bbl_stat || '',                          // Aktiv | Abgang | Löschvermerk (reference.buildingStatuses)
    classification: isDiplo ? 'VERTRAULICH' : 'INTERN', // im Golden Record nicht geführt → aus dem Portfolio-Typ abgeleitet
    // `media` = Auswahl von mediaId ins Register data/media.json (nur noch für die Mediathek).
    media: Array.isArray(p.media) ? p.media : [],
    // Portfolio-Bilder kommen aus der kuratierten Auswahl `bilder` DIREKT am Objekt
    // (geojson); erstes Bild = Hauptbild, aufgelöst in linkMedia() unten.
    bilder: Array.isArray(p.bilder) ? p.bilder : [],
    photoSrc: '', photo: '', bildCredit: '', bildQuelle: '', color: '#2f4356',
  };
}

// Grundstücke (parcels.geojson) — Polygon-Geometrie, verknüpft mit dem Gebäude über
// das WE-Segment der bbl_id (1080/4840/01 ↔ 1080/4840/AF). Geometrie bleibt erhalten
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
    bilder: Array.isArray(p.bilder) ? p.bilder : [],
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
  return DATA;
}

// Hauptbild + Bildnachweis kommen aus der kuratierten Auswahl `bilder` DIREKT am
// Objekt (buildings.geojson / parcels.geojson) — das erste Bild ist das Hauptbild.
// data/media.json wird dafür NICHT mehr gelesen (das Register bleibt allein der
// Mediathek vorbehalten). Ohne `bilder` bleibt das Objekt bildlos (Farbfläche),
// statt einen Unsplash-Platzhalter zu zeigen.
function linkMedia() {
  for (const o of [...(DATA.buildings || []), ...(DATA.parcels || [])]) {
    const b0 = (o.bilder || [])[0];
    o.photoSrc = b0 ? (b0.src || '') : '';
    o.photo = '';
    o.bildCredit = b0 ? (b0.credit || '') : '';
    o.bildQuelle = b0 ? (b0.sourceUrl || '') : '';
    o.bildPlatzhalter = false;
  }
}

// --- Nachladen aufschiebbarer Bestände (H4) ---------------------------------
// Je Schlüssel EIN Versprechen, gemerkt: zehn Aufrufe erzeugen eine Anfrage, und
// wer später kommt, wartet auf dieselbe. Fehlschläge landen im selben Register
// wie beim Start, damit das Fehlerband auch nachgeladene Ausfälle zeigt.
const PENDING = new Map();

async function loadDeferred(key) {
  const url = DEFERRED[key];
  const isObj = OBJECT_FILES.has(key);
  try {
    // GeoJSON-Bestände tragen {type,features} statt einer Liste und werden beim
    // Laden auf die schlanke Form normalisiert, die alle Ansichten lesen.
    const GEO = { buildings: normalizeBuilding, parcels: normalizeParcel, landcovers: normalizeLandcover };
    const ID = { buildings: 'bbl_id', parcels: 'bbl_id', landcovers: 'parcelId' };
    if (GEO[key]) {
      const fc = await fetchJSON(url, { shape: 'object' });
      DATA[key] = (fc.features || []).map(GEO[key]).filter((x) => x[ID[key]]);
      // Hauptbild/Bildnachweis stehen an den Objekten selbst; nach jedem der
      // beiden Bestände neu verknüpfen, weil sie unabhängig eintreffen können.
      if (key === 'buildings' || key === 'parcels') linkMedia();
    } else {
      DATA[key] = await fetchJSON(url, { shape: isObj ? 'object' : 'array' });
    }
  } catch (e) {
    console.warn('[core] could not load', url, e.message);
    FAILED.add(key);
    DATA[key] = isObj ? {} : [];
    // Das Fehlerband wurde beim Start gezeichnet und kennt diesen Ausfall noch
    // nicht — ohne das Ereignis bliebe er unsichtbar.
    try { window.dispatchEvent(new CustomEvent('core:data-failed', { detail: { key } })); } catch { /* kein DOM */ }
  }
}

// ensure('assets','costs') → Promise. Unbekannte oder bereits beim Start
// geladene Schlüssel werden still übergangen, damit Aufrufer nicht wissen
// müssen, welcher Bestand aufschiebbar ist.
function ensure(...keys) {
  const list = keys.flat().filter((k) => DEFERRED[k]);
  return Promise.all(list.map((k) => {
    if (!PENDING.has(k)) PENDING.set(k, loadDeferred(k));
    return PENDING.get(k);
  }));
}

const find = (arr, key, id) => (arr || []).find(x => x[key] === id);

export const core = {
  load,
  ensure,
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
  // Mietendenportal. `floorsForTenancy` liest die Geschossliste AM
  // Mietverhältnis (gemietet ist ein Geschoss, nicht das Gebäude) — nicht alle
  // Geschosse des Hauses.
  tenancies: () => DATA.tenancies || [],
  tenancy: (id) => find(DATA.tenancies, 'tenancyId', id),
  floors: () => DATA.floors || [],
  floor: (id) => find(DATA.floors, 'floorId', id),
  floorsForTenancy: (t) => (t && t.floors ? t.floors : []).map((fid) => find(DATA.floors, 'floorId', fid)).filter(Boolean),
  spacesForFloor: (fid) => (DATA.spaces || []).filter((s) => s.floorId === fid),
  services: () => DATA.services || [],
  service: (id) => find(DATA.services, 'serviceId', id),
  servicesByDomain: () => groupBy(DATA.services || [], 'domain'),
  applications: () => DATA.applications || [],
  applicationsByGroup: () => groupBy(DATA.applications || [], 'group'),
  application: (id) => find(DATA.applications, 'appId', id),
  documents: () => DATA.documents || [],
  documentsForBuilding: (bid) => (DATA.documents || []).filter(d => (d.linkedTo || []).includes(bid)),
  media: () => DATA.media || [],
  // Medien hängen über `buildingId` am Objekt. Der Name ist historisch: das Feld
  // trägt eine bbl_id, und die kann ebenso zu einer Parzelle gehören — die
  // Detailansicht behandelt Gebäude und Grundstücke gleich.
  mediaForObject: (id) => (DATA.media || []).filter(m => m.buildingId === id),
  mediaForBuilding: (bid) => (DATA.media || []).filter(m => m.buildingId === bid),
  // «Wissen und Hilfsmittel» hat KEINEN Bestand: Vorgaben, Vorlagen, Anleitungen
  // und Prozesse sind statische Seiten (js/pages/knowledge.js, regulations.js).
  // Es sind Dokumentenverzeichnisse zum Nachlesen und Herunterladen — eine
  // Weisung ist ein anderswo erlassenes Dokument, und das Portal verlinkt sie,
  // statt sie zu katalogisieren (docs/sitemap.md §2.4).
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
