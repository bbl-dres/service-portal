// API documentation renders the specifications from data/api-specs.json
// through the standard swagger-ui-dist interface.
//
// Route: #/app/api-docs/<specId> (default: kundenportal). ?tag=<resource>
// scrolls to a resource linked by the data-access catalogue.
//
// Decision (user request, 2026-08-04): portal chrome remains above the detail
// bar, while the standard Swagger UI renders below it. The library loads lazily
// from a CDN like MapLibre and degrades to an error message. Deep linking stays
// off because Swagger would overwrite the portal hash route; Try it out also
// stays off because there is no live backend.
//
// The former live-data action survives as read-only response examples. Endpoints
// covered by LIVE[...] show actual portal data in their 200 response example.
import { fetchJSON } from '../core/fetch-json.js';
import { DATA } from '../crumbs.js';

// Breadcrumb prefix: this route belongs below the data-access catalogue.
const CRUMBS = [...DATA, { label: 'Datenbezug und API Verzeichnis', href: '#/data/catalog' }];

// Deferred route datasets populate the live examples. Since 2026-08-04 the
// API covers the complete data inventory with resource names matching data/*.
// Local JSON files load once and are then served from the core cache.
export const needs = [
  'services', 'applications', 'news', 'contacts', 'documents', 'projects',
  'media', 'datasets', 'buildings', 'parcels', 'tenancies', 'floors', 'spaces',
  'assets', 'contracts', 'costs', 'areas', 'buildingContacts', 'landcovers',
  'businessObjects', 'systemTables',
];

// Lazily load swagger-ui-dist from the CDN, following the MapLibre pattern.
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
  }).catch((e) => { suPromise = null; throw e; });   // Do not cache failures; a later visit may retry.
  return suPromise;
}

// Swagger adds parts of its tree after onComplete and creates more controls
// when an operation expands. The adapter only supplies names and language;
// structure and behaviour remain owned by the library.
function enhanceSwagger(host) {
  host.setAttribute('lang', 'en');
  host.querySelectorAll('.authorization__btn').forEach((button) => {
    button.setAttribute('aria-label', 'Authorize API access');
  });
  host.querySelectorAll('.expand-operation').forEach((button) => {
    if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', 'Expand or collapse all operations');
  });
  host.querySelectorAll('.opblock-control-arrow').forEach((button) => {
    if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', 'Expand or collapse operation');
  });
}

// Convert the maintainable shorthand in data/api-specs.json to OpenAPI 3 at
// render time. The source file stays authoritative and exampleFor can inject
// live examples from core.
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
      // Attach a covered live example to the first successful response code.
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
    // Convert the specification's authentication note into a security schema.
    // Swagger then shows its standard lock and documentation-only Authorize dialog.
    components: spec.auth ? { securitySchemes: {
      portalAuth: { type: 'apiKey', in: 'header', name: 'Authorization', description: spec.auth },
    } } : undefined,
    security: spec.auth ? [{ portalAuth: [] }] : undefined,
    paths,
  };
}

export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs, stale, signal } = ctx;
  const specId = C.safeDecode(params[0] || 'kundenportal');

  let specs = {};
  try { specs = await fetchJSON('data/api-specs.json', { shape: 'object', signal }); } catch (e) { /* Handled below. */ }
  // Process definitions normally load only through the engine; load them once
  // here to populate process-definitions examples outside the core inventory.
  let processDefs = [];
  try { processDefs = await fetchJSON('data/process-definitions.json', { shape: 'array', signal }); } catch (e) { /* Examples remain unavailable. */ }
  if (stale && stale()) return;
  const spec = specs[specId];

  // Add the breadcrumb only after validating the specification so an invalid
  // route ends at the German UI term: `Nicht gefunden`, not a phantom title.
  if (!spec) {
    return C.renderNotFound(ctx, { thing: 'Diese API-Spezifikation', title: 'API nicht gefunden',
      backHref: '#/data/catalog', backLabel: 'Datenbezug und API Verzeichnis',
      crumbs: CRUMBS });
  }
  setCrumbs([...CRUMBS, { label: spec.title }]);
  setTitle(spec.title);

  // Live examples use real portal data for covered endpoints.
  // Keys follow '<tag>.<endpoint>' from the specification's live property.
  // Response keys follow the English data/* model; stored status values remain unchanged.
  const t = core.t;
  const pick = (o, keys) => { const r = {}; if (o) for (const k of keys) r[k] = o[k]; return r; };
  const D = core.data;   // Registries without a dedicated list accessor.
  const LIVE = {
    'process-definitions.list': () => processDefs.slice(0, 3).map((d) => ({ defId: d.defId, name: d.name, serviceId: d.serviceId, steps: (d.steps || []).length })),
    'process-definitions.one': () => { const d = processDefs[0]; return d ? { defId: d.defId, name: d.name, serviceId: d.serviceId, steps: (d.steps || []).slice(0, 3).map((s) => pick(s, ['status', 'label', 'role', 'kind'])) } : {}; },
    // Services expose title while applications expose name; the entities differ.
    'services.list': () => core.services().slice(0, 5).map((s) => ({ serviceId: s.serviceId, title: s.title, domain: s.domain })),
    'services.one': () => pick(core.services()[0], ['serviceId', 'title', 'domain', 'description']),
    'applications.list': () => core.applications().slice(0, 5).map((a) => ({ appId: a.appId, name: a.name, group: a.group, audience: a.audience })),
    'applications.one': () => pick(core.applications()[0], ['appId', 'name', 'group', 'audience', 'description']),
    'buildings.list': () => core.buildings().slice(0, 3).map((b) => ({ bblId: b.bbl_id, name: b.name, 'land': b.country, canton: b.canton, gf: b.gf, ownership: b.ownership, status: b.status })),
    'buildings.one': () => { const b = core.buildings()[0]; return b ? { bblId: b.bbl_id, name: b.name, address: `${b.street}, ${b.zip} ${b.city}`, 'land': b.country, gf: b.gf, hnf: b.hnf, ownership: b.ownership, status: b.status } : {}; },
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
    'parcels.list': () => core.parcels().slice(0, 3).map((p) => ({ bblId: p.bbl_id, name: p.name, egrid: p.egrid, city: p.city, 'land': p.country, gsf: p.gsf, ownership: p.ownership })),
    'parcels.one': () => { const p = core.parcels()[0]; return p ? { bblId: p.bbl_id, name: p.name, plotNumber: p.plotNumber, egrid: p.egrid, zone: p.zone, gsf: p.gsf, city: p.city, canton: p.canton, 'land': p.country, ownership: p.ownership } : {}; },
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
    // Return the current canonical audience reference list.
    'reference-data.one': () => ({ list: 'audiences', items: core.ref().audiences || [] }),
  };
  const exampleFor = (ep) => {
    if (ep.live && LIVE[ep.live]) { try { return LIVE[ep.live](); } catch (e) { /* Fall back to the specification example. */ } }
    return ep.example;   // Undefined means the endpoint has a description only.
  };

  // Portal chrome above; standard Swagger UI below.
  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: '#/data/catalog', backLabel: 'Datenbezug und API Verzeichnis' })}
    <h1 tabindex="-1">${C.escape(spec.title)}</h1>
    <div class="pill-row">${C.badge('v' + spec.version, 'blue')} ${C.badge(spec.format || 'REST', 'gray')}</div>
    <p class="lead">${C.escape(spec.description)}</p>
    ${/* Portal chrome owns title, version, and description. Swagger's hidden
          information container would otherwise duplicate them. */''}
    <h2 class="sr-only" id="api-resources-title">API-Ressourcen</h2>
    <div class="swagger-host" id="api-swagger" aria-labelledby="api-resources-title">
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
  const swaggerObserver = new MutationObserver(() => enhanceSwagger(host));
  swaggerObserver.observe(host, { childList: true, subtree: true });
  let disposed = false;
  let tagPollTimer = null;
  if (ctx.onUnmount) ctx.onUnmount(() => {
    disposed = true;
    swaggerObserver.disconnect();
    if (tagPollTimer) clearTimeout(tagPollTimer);
  });
  SwaggerUIBundle({
    spec: toOpenApi(spec, exampleFor),
    domNode: host,
    presets: [SwaggerUIBundle.presets.apis],
    layout: 'BaseLayout',
    // Keep deepLinking disabled because Swagger anchors would collide with the
    // portal's hash router.
    deepLinking: false,
    docExpansion: 'list',
    defaultModelsExpandDepth: -1,   // Hide the models block because the compact spec has no schemas.
    supportedSubmitMethods: [],     // There is no backend for “Try it out”.
    validatorUrl: null,             // Do not call Swagger's external validator.
    onComplete: () => {
      if (disposed) return;
      enhanceSwagger(host);
      // A catalogue ?tag=<resource> link scrolls to its resource section.
      // onComplete fires before Swagger's React tree has finished rendering, so
      // poll briefly for the section. The router's initial scroll has already run
      // because the CDN library arrives later.
      const wanted = spec.resources.find((r) => r.tag === query.get('tag'));
      if (!wanted) return;
      let tries = 0;
      const hin = () => {
        if (disposed) return;
        const el = [...host.querySelectorAll('.opblock-tag')]
          .find((h) => h.getAttribute('data-tag') === wanted.label);
        if (el) { el.scrollIntoView({ block: 'start' }); return; }
        if (tries++ < 30) tagPollTimer = setTimeout(hin, 100);
      };
      hin();
    },
  });
}
