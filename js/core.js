// Shared domain core — single source of truth (mock).
// Loads all data/*.json once; pages read via the accessors below.

const DATA = {};

const FILES = {
  buildings:    'data/buildings.json',
  projects:     'data/projects.json',
  services:     'data/services.json',
  applications: 'data/applications.json',
  dataProducts: 'data/data-products.json',
  documents:    'data/documents.json',
  media:        'data/media.json',
  weisungen:    'data/weisungen.json',
  news:         'data/news.json',
  contacts:     'data/contacts.json',
  reference:    'data/reference-data.json',
};

async function load() {
  const entries = await Promise.all(Object.entries(FILES).map(async ([k, url]) => {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status + ' ' + url);
      return [k, await r.json()];
    } catch (e) {
      console.warn('[core] could not load', url, e.message);
      return [k, k === 'reference' ? {} : []];
    }
  }));
  for (const [k, v] of entries) DATA[k] = v;
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
  dataProducts: () => DATA.dataProducts || [],
  dataProduct: (id) => find(DATA.dataProducts, 'id', id),
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
};

function groupBy(arr, key) {
  const out = {};
  for (const x of arr) { (out[x[key]] = out[x[key]] || []).push(x); }
  return out;
}

export default core;
