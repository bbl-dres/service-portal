// API-Dokumentation — Standard-Swagger-Oberfläche (swagger-ui-dist) über den
// Spezifikationen aus data/api-specs.json.
//
// Route: #/app/api-docs/<specId> (Standard: kundenportal). ?tag=<resource>
// scrollt zur Ressource — der Datenbezug-Katalog verlinkt je Distribution des
// Datensatzes «BBL Kundenportal (Portal-API)» hierher.
//
// ENTSCHEID (Nutzerwunsch 2026-08-04): oberhalb der detail-bar bleibt das
// Portal-Chrome (Krume, Zurück/Teilen, Seitenkopf), darunter rendert das
// ECHTE Swagger UI im Standard-Look — statt des früheren CD-nachgebauten
// api-*-Blocks (~160 Zeilen JS + 62 CSS-Regeln, beide entfallen). Die
// Bibliothek kommt wie MapLibre lazy vom CDN und degradiert bei Ausfall zu
// einer Meldung; deepLinking bleibt AUS (Swagger schriebe sonst in unseren
// Hash-Router), «Try it out» ebenso (kein echtes Backend — die Anfrage liefe
// ins Leere).
//
// Das frühere «Ausprobieren mit Live-Daten» lebt als Antwort-BEISPIELE weiter:
// wo ein Endpunkt datengedeckt ist (LIVE[...] liest aus dem core), steht das
// echte Portal-Datenbeispiel im 200er-Response — «real where free, mock the
// rest», nur eben als Beispiel statt als Knopf.

import { fetchJSON } from '../fetch-json.js';
import { DATEN } from '../crumbs.js';

// Brotkrumen-Präfix der Route: die Seite hängt unter dem Datenbezug-Katalog.
const CRUMBS = [...DATEN, { label: 'Datenbezug und API Verzeichnis', href: '#/data/catalog' }];

// Aufschiebbare Bestände dieser Route — sie speisen die Live-Beispiele. Die
// API deckt SEIT 2026-08-04 den ganzen Datenbestand (englische Ressourcen-
// namen, deckungsgleich mit data/*) — entsprechend breit ist die Liste; alles
// lokale JSON-Dateien, einmal geladen und dann aus dem core-Cache.
export const needs = [
  'services', 'applications', 'news', 'contacts', 'documents', 'projects',
  'media', 'datasets', 'buildings', 'parcels', 'tenancies', 'floors', 'spaces',
  'assets', 'contracts', 'costs', 'areas', 'buildingContacts', 'landcovers',
  'businessObjects', 'systemTables',
];

// --- swagger-ui-dist lazy vom CDN (Muster: loadMapLibre, buildings-map.js) ---
const SWAGGER_VER = '5.17.14';
let suPromise = null;
function loadSwaggerUI() {
  if (window.SwaggerUIBundle) return Promise.resolve(window.SwaggerUIBundle);
  if (suPromise) return suPromise;
  suPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Zeitüberschreitung beim Laden der Swagger-Oberfläche')), 12000);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VER}/swagger-ui.css`;
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VER}/swagger-ui-bundle.js`;
    s.onload = () => { clearTimeout(timer); window.SwaggerUIBundle ? resolve(window.SwaggerUIBundle) : reject(new Error('SwaggerUIBundle fehlt')); };
    s.onerror = () => { clearTimeout(timer); reject(new Error('Swagger UI konnte nicht geladen werden')); };
    document.head.appendChild(s);
  }).catch((e) => { suPromise = null; throw e; });   // Fehler nicht cachen → späterer Aufruf lädt neu
  return suPromise;
}

// --- Spezifikation → OpenAPI 3 ----------------------------------------------
// data/api-specs.json ist die pflegefreundliche Kurzform (Ressourcen mit
// Endpunkten); Swagger UI liest OpenAPI. Die Übersetzung passiert hier beim
// Rendern — die Datei bleibt die eine Quelle, und die Live-Beispiele können
// aus dem core einfliessen (`exampleFor`).
function toOpenApi(spec, exampleFor) {
  const paths = {};
  for (const r of spec.resources) {
    for (const ep of r.endpoints) {
      const op = {
        tags: [r.label],
        summary: ep.summary,
        parameters: (ep.params || []).map((p) => ({
          name: p.name, in: p.in, required: !!p.required,
          description: p.desc || '',
          schema: { type: p.type === 'integer' ? 'integer' : 'string' },
        })),
        responses: {},
      };
      if (ep.body) op.requestBody = { required: true, content: { 'application/json': { example: ep.body } } };
      const codes = Object.entries(ep.responses || { 200: 'OK' });
      for (const [code, desc] of codes) {
        op.responses[code] = { description: desc };
      }
      // Beispielantwort an den ersten (Erfolgs-)Code — Live-Daten wo gedeckt.
      const okCode = codes[0] ? codes[0][0] : '200';
      const example = exampleFor(ep);
      if (example !== undefined) {
        op.responses[okCode] = { ...op.responses[okCode], content: { 'application/json': { example } } };
      }
      (paths[ep.path] = paths[ep.path] || {})[ep.method.toLowerCase()] = op;
    }
  }
  return {
    openapi: '3.0.3',
    info: { title: spec.title, version: spec.version, description: spec.description },
    servers: [{ url: spec.baseUrl }],
    tags: spec.resources.map((r) => ({ name: r.label, description: r.description })),
    // Der Auth-Hinweis der Spezifikation wird zum Security-Schema — Swagger
    // zeigt damit sein Standard-Schloss samt «Authorize»-Dialog (nur Doku,
    // es gibt kein Backend, das den Wert prüfen würde).
    components: spec.auth ? { securitySchemes: {
      portalAuth: { type: 'apiKey', in: 'header', name: 'Authorization', description: spec.auth },
    } } : undefined,
    security: spec.auth ? [{ portalAuth: [] }] : undefined,
    paths,
  };
}

export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs, stale } = ctx;
  const specId = C.safeDecode(params[0] || 'kundenportal');

  let specs = {};
  try { specs = await fetchJSON('data/api-specs.json', { shape: 'object' }); } catch (e) { /* unten behandelt */ }
  // Prozessdefinitionen liest sonst nur die Engine — für die Live-Beispiele
  // der Ressource process-definitions einmal direkt dazuladen (kein core-Bestand).
  let processDefs = [];
  try { processDefs = await fetchJSON('data/process-definitions.json', { shape: 'array' }); } catch (e) { /* Beispiele entfallen */ }
  if (stale && stale()) return;
  const spec = specs[specId];

  // Krume erst NACH der spec-Prüfung — im Fehlerfall endet die Kette mit
  // «Nicht gefunden» (setzt renderNotFound), nicht mit einem Phantom-Titel.
  if (!spec) {
    return C.renderNotFound(ctx, { thing: 'Diese API-Spezifikation', title: 'API nicht gefunden',
      backHref: '#/data/catalog', backLabel: 'Datenbezug und API Verzeichnis',
      crumbs: CRUMBS });
  }
  setCrumbs([...CRUMBS, { label: spec.title }]);
  setTitle(spec.title);

  // --- Live-Beispiele: echte Portaldaten, wo ein Endpunkt gedeckt ist -------
  // Schlüssel-Konvention: '<tag>.<endpunkt>' aus der Spezifikation ("live").
  // Antwort-SCHLÜSSEL englisch (Datenmodell = data/*), WERTE aus den Beständen
  // (Status-Kennungen usw. bleiben, wie die Daten sie führen).
  const t = core.t;
  const pick = (o, keys) => { const r = {}; if (o) for (const k of keys) r[k] = o[k]; return r; };
  const D = core.data;   // Rohbestände der Register ohne eigenen Listen-Accessor
  const LIVE = {
    'process-definitions.list': () => processDefs.slice(0, 3).map((d) => ({ defId: d.defId, name: d.name, serviceId: d.serviceId, steps: (d.steps || []).length })),
    'process-definitions.one': () => { const d = processDefs[0]; return d ? { defId: d.defId, name: d.name, serviceId: d.serviceId, steps: (d.steps || []).slice(0, 3).map((s) => pick(s, ['status', 'label', 'role', 'kind'])) } : {}; },
    // Dienstleistungen heissen `title`, Anwendungen `name` — die beiden Entitäten
    // stimmen nicht überein (M19).
    'services.list': () => core.services().slice(0, 5).map((s) => ({ serviceId: s.serviceId, title: s.title, domain: s.domain })),
    'services.one': () => pick(core.services()[0], ['serviceId', 'title', 'domain', 'description']),
    'applications.list': () => core.applications().slice(0, 5).map((a) => ({ appId: a.appId, name: a.name, group: a.group, audience: a.audience })),
    'applications.one': () => pick(core.applications()[0], ['appId', 'name', 'group', 'audience', 'description']),
    'buildings.list': () => core.buildings().slice(0, 3).map((b) => ({ bblId: b.bbl_id, name: b.name, land: b.land, canton: b.canton, gf: b.gf, ownership: b.ownership, status: b.status })),
    'buildings.one': () => { const b = core.buildings()[0]; return b ? { bblId: b.bbl_id, name: b.name, address: `${b.street}, ${b.zip} ${b.city}`, land: b.land, gf: b.gf, hnf: b.hnf, ownership: b.ownership, status: b.status } : {}; },
    'buildings.floors': () => (D.floors || []).slice(0, 3).map((f) => pick(f, ['floorId', 'buildingId', 'key', 'label', 'level', 'areaGross', 'rooms'])),
    'buildings.spaces': () => (D.spaces || []).slice(0, 3).map((s) => pick(s, ['spaceId', 'floorId', 'buildingId', 'roomNumber', 'useType', 'useLabel'])),
    'buildings.tenancies': () => core.tenancies().slice(0, 2).map((x) => pick(x, ['tenancyId', 've', 'veName', 'department', 'buildingId'])),
    'buildings.contacts': () => (D.buildingContacts || []).slice(0, 2).map((c) => pick(c, ['contactId', 'name', 'role', 'organisation', 'email', 'isPrimary'])),
    'buildings.documents': () => { const b = core.buildings()[0]; return core.documentsForBuilding(b ? b.bbl_id : '').slice(0, 3).map((d) => pick(d, ['docId', 'title', 'format'])); },
    'buildings.media': () => (D.media || []).filter((m) => m.buildingId).slice(0, 2).map((m) => pick(m, ['mediaId', 'mediaType', 'title', 'buildingId', 'date'])),
    'buildings.assets': () => (D.assets || []).slice(0, 2).map((a) => pick(a, ['assetId', 'name', 'category', 'status', 'buildingId'])),
    'buildings.contracts': () => (D.contracts || []).slice(0, 2).map((c) => pick(c, ['contractId', 'type', 'contractPartner', 'validUntil', 'status', 'buildingId'])),
    'buildings.costs': () => (D.costs || []).slice(0, 2).map((c) => pick(c, ['costId', 'costGroup', 'costType', 'amount', 'currency', 'period', 'buildingId'])),
    'buildings.area-measurements': () => (D.areas || []).slice(0, 2).map((a) => pick(a, ['areaMeasurementId', 'type', 'value', 'unit', 'standard', 'buildingId'])),
    'parcels.list': () => core.parcels().slice(0, 3).map((p) => ({ bblId: p.bbl_id, name: p.name, egrid: p.egrid, city: p.city, land: p.land, gsf: p.gsf, ownership: p.ownership })),
    'parcels.one': () => { const p = core.parcels()[0]; return p ? { bblId: p.bbl_id, name: p.name, plotNumber: p.plotNumber, egrid: p.egrid, zone: p.zone, gsf: p.gsf, city: p.city, canton: p.canton, land: p.land, ownership: p.ownership } : {}; },
    'parcels.landcovers': () => (D.landcovers || []).slice(0, 3).map((l) => pick(l, ['parcelId', 'buildingId', 'type', 'area'])),
    'tenancies.list': () => core.tenancies().slice(0, 3).map((x) => pick(x, ['tenancyId', 'veName', 'department', 'buildingName', 'city'])),
    'tenancies.one': () => { const x = core.tenancies()[0]; return x ? { ...pick(x, ['tenancyId', 've', 'veName', 'department', 'buildingId', 'buildingName']), floors: x.floors || [] } : {}; },
    'projects.list': () => core.projects().slice(0, 3).map((p) => ({ projectId: p.projectId, name: p.name, siaPhase: p.siaPhaseLabel, status: p.status })),
    'projects.one': () => pick(core.projects()[0], ['projectId', 'name', 'status', 'plannedTotalCost', 'siaPhaseLabel']),
    'documents.list': () => core.documents().slice(0, 3).map((d) => pick(d, ['docId', 'title', 'format', 'classification'])),
    'documents.one': () => pick(core.documents()[0], ['docId', 'title', 'type', 'category', 'format', 'sizeKB', 'year', 'classification']),
    'media.list': () => core.media().slice(0, 3).map((m) => pick(m, ['mediaId', 'mediaType', 'title', 'buildingId', 'projectId', 'date'])),
    'media.one': () => pick(core.media()[0], ['mediaId', 'mediaType', 'title', 'slug', 'buildingId', 'date', 'photographer']),
    'news.list': () => core.news().slice(0, 3).map((n) => pick(n, ['id', 'title', 'date', 'source'])),
    'news.one': () => pick(core.news()[0], ['id', 'title', 'date', 'source', 'teaser']),
    'contacts.list': () => core.contacts().slice(0, 3).map((c) => pick(c, ['contactId', 'name', 'unit', 'role', 'email'])),
    'contacts.one': () => pick(core.contacts()[0], ['contactId', 'name', 'unit', 'role', 'email', 'phone']),
    'datasets.list': () => core.datasets().slice(0, 4).map((d) => ({ id: d.id, title: t(d.title), theme: t(d.meta.thema) })),
    'datasets.one': () => { const d = core.datasets()[0]; return d ? { id: d.id, title: t(d.title), theme: t(d.meta.thema), formats: (d.distributions || []).map((x) => x.dateiformat || x.format) } : {}; },
    'business-objects.list': () => core.businessObjects().slice(0, 3).map((o) => pick(o, ['objectId', 'name', 'domain', 'status'])),
    'business-objects.one': () => { const o = core.businessObjects()[0]; return o ? { ...pick(o, ['objectId', 'name', 'domain', 'status']), attributes: (o.attributes || []).slice(0, 3).map((a) => a.name) } : {}; },
    'system-tables.list': () => core.systemTables().slice(0, 3).map((x) => pick(x, ['tableId', 'system', 'systemName', 'name', 'type'])),
    'system-tables.one': () => pick(core.systemTables()[0], ['tableId', 'system', 'schema', 'name', 'displayName', 'type']),
    'reference-data.list': () => ({ lists: Object.keys(core.ref()) }),
    // Zeigt gleich die Zielgruppen-Referenzliste — die jüngste des Kanons.
    'reference-data.one': () => ({ list: 'audiences', items: core.ref().audiences || [] }),
  };
  const exampleFor = (ep) => {
    if (ep.live && LIVE[ep.live]) { try { return LIVE[ep.live](); } catch (e) { /* Beispiel aus der Spez */ } }
    return ep.example;   // undefined = kein Beispiel, nur die Beschreibung
  };

  // --- Chrome (oberhalb: Portal, unterhalb: Standard-Swagger) ----------------
  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: '#/data/catalog', backLabel: 'Datenbezug und API Verzeichnis' })}
    <h1 tabindex="-1">${C.escape(spec.title)}</h1>
    <div class="pill-row">${C.badge('v' + spec.version, 'blue')} ${C.badge(spec.format || 'REST', 'gray')}</div>
    <p class="lead">${C.escape(spec.description)}</p>
    ${/* Der Kopf (Titel, Version, Beschreibung) gehört dem Portal — Swaggers
          eigener .information-container ist per CSS ausgeblendet, sonst stünde
          alles doppelt. Server-Zeile, Authorize und die Ressourcen-Abschnitte
          liefern den Standard-Look darunter. */''}
    <div class="swagger-host" id="api-swagger">
      ${C.loading({ label: 'API-Dokumentation wird geladen…' })}
    </div>
  </div>`;

  const host = mount.querySelector('#api-swagger');
  let SwaggerUIBundle;
  try {
    SwaggerUIBundle = await loadSwaggerUI();
    if (stale && stale()) return;
  } catch (e) {
    if (stale && stale()) return;
    host.innerHTML = C.notification(
      '<strong>Die Swagger-Oberfläche konnte nicht geladen werden.</strong> '
      + `${C.escape(e.message)} — sie kommt von unpkg.com und braucht Netzzugang. `
      + '<button type="button" class="link" onclick="location.reload()">Seite neu laden</button>',
      'error', 'WarningCircle', { live: true });
    return;
  }

  host.innerHTML = '';
  SwaggerUIBundle({
    spec: toOpenApi(spec, exampleFor),
    domNode: host,
    presets: [SwaggerUIBundle.presets.apis],
    layout: 'BaseLayout',
    // KEIN deepLinking: Swagger schriebe seine Anker in location.hash und
    // kollidierte mit dem Hash-Router des Portals.
    deepLinking: false,
    docExpansion: 'list',
    defaultModelsExpandDepth: -1,   // keine Schemas in der Spez → Models-Block weglassen
    supportedSubmitMethods: [],     // kein Backend → kein «Try it out»
    validatorUrl: null,             // kein Anruf beim externen Validator-Badge
    onComplete: () => {
      // ?tag=<resource> aus dem Datenbezug-Katalog: zur Ressource scrollen.
      // onComplete feuert, BEVOR Swaggers React-Baum fertig im DOM steht —
      // deshalb kurz auf den Abschnitt pollen statt einmal zu greifen (das
      // scrollTo(0,0) des Routers ist zu diesem Zeitpunkt längst gelaufen,
      // die Bibliothek kam ja erst Sekunden später vom CDN).
      const wanted = spec.resources.find((r) => r.tag === query.get('tag'));
      if (!wanted) return;
      let tries = 0;
      const hin = () => {
        const el = [...host.querySelectorAll('.opblock-tag')]
          .find((h) => h.getAttribute('data-tag') === wanted.label);
        if (el) { el.scrollIntoView({ block: 'start' }); return; }
        if (tries++ < 30) setTimeout(hin, 100);
      };
      hin();
    },
  });
}
