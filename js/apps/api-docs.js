// Mock OpenAPI/Swagger docs — renders an API spec (data/api-specs.json) in CD Bund
// style, matching the portal's "mocked backend" theme (no swagger-ui dependency).
//
// Route: #/app/api-docs/<specId> (default: kundenportal). A ?tag=<resource> opens
// the docs focused on one resource — used by the Datenbezug catalog, where each
// distribution of the «BBL Kundenportal (Portal-API)» dataset deep-links here.
//
// «Ausprobieren» returns live portal data where an endpoint is data-backed
// (LIVE[...] reads from core), otherwise the spec's static example — "real where
// free, mock the rest".

import { fetchJSON } from '../fetch-json.js';
import { copyText } from '../export.js';

const METHOD = { GET: 'get', POST: 'post', PUT: 'put', PATCH: 'patch', DELETE: 'delete' };

export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs, stale } = ctx;
  const specId = C.safeDecode(params[0] || 'kundenportal');

  let specs = {};
  try { specs = await fetchJSON('data/api-specs.json', { shape: 'object' }); } catch (e) { /* handled below */ }
  if (stale && stale()) return;
  const spec = specs[specId];

  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Datenbezug und API Verzeichnis', href: '#/data/katalog' },
    { label: spec ? spec.title : 'API-Dokumentation' },
  ]);
  if (!spec) {
    setTitle('API nicht gefunden');
    mount.innerHTML = `<div class="container section">${C.backLink('#/data/katalog', 'Datenbezug und API Verzeichnis')}
      ${C.empty('Diese API-Spezifikation existiert nicht.')}</div>`;
    return;
  }
  setTitle(spec.title);
  const activeTag = spec.resources.some((r) => r.tag === query.get('tag')) ? query.get('tag') : spec.resources[0].tag;

  // --- data-backed «Ausprobieren» responses (real where free) --------------
  const t = core.t;
  const pick = (o, keys) => { const r = {}; if (o) for (const k of keys) r[k] = o[k]; return r; };
  const LIVE = {
    'vorgaenge.list': () => [
      { id: 'V-2026-0042', serviceId: 'raumbedarf-melden', status: 'in_arbeit', created: '2026-07-20' },
      { id: 'V-2026-0039', serviceId: 'stoerung-melden', status: 'abgeschlossen', created: '2026-07-14' },
    ],
    'dienstleistungen.list': () => core.services().slice(0, 5).map((s) => ({ serviceId: s.serviceId, name: s.name, domain: s.domain })),
    'dienstleistungen.one': () => pick(core.services()[0], ['serviceId', 'name', 'domain', 'description']),
    'anwendungen.list': () => core.applications().slice(0, 5).map((a) => ({ appId: a.appId, name: a.name, group: a.group, audience: a.audience })),
    'anwendungen.one': () => pick(core.applications()[0], ['appId', 'name', 'group', 'audience', 'description']),
    'liegenschaften.list': () => core.buildings().slice(0, 3).map((b) => ({ bblId: b.bbl_id, name: b.name, land: b.land, kanton: b.canton, gf: b.gf, eigentum: b.ownership, status: b.status })),
    'liegenschaften.one': () => { const b = core.buildings()[0]; return b ? { bblId: b.bbl_id, name: b.name, adresse: `${b.street}, ${b.zip} ${b.city}`, land: b.land, gf: b.gf, hnf: b.hnf, eigentum: b.ownership, status: b.status } : {}; },
    'liegenschaften.docs': () => { const b = core.buildings()[0]; return core.documentsForBuilding(b ? b.bbl_id : '').slice(0, 3).map((d) => ({ docId: d.docId, titel: d.title, format: d.format })); },
    'bauprojekte.list': () => core.projects().slice(0, 3).map((p) => ({ projectId: p.projectId, name: p.name, siaPhase: p.siaPhaseLabel, status: p.status })),
    'bauprojekte.one': () => pick(core.projects()[0], ['projectId', 'name', 'status', 'plannedTotalCost', 'siaPhaseLabel']),
    'dokumente.list': () => core.documents().slice(0, 3).map((d) => ({ docId: d.docId, titel: d.title, format: d.format, klassifizierung: d.classification })),
    'datensaetze.list': () => core.datasets().slice(0, 4).map((d) => ({ id: d.id, titel: t(d.title), thema: t(d.meta.thema) })),
    'datensaetze.one': () => { const d = core.datasets()[0]; return d ? { id: d.id, titel: t(d.title), thema: t(d.meta.thema), formate: (d.distributions || []).map((x) => x.dateiformat || x.format) } : {}; },
    'suche': () => ({ query: 'bau', treffer: { dienstleistungen: 3, anwendungen: 1, dokumente: 4, weisungen: 2 } }),
  };
  const respond = (ep) => {
    if (ep.live && LIVE[ep.live]) { try { return LIVE[ep.live](); } catch (e) { /* fall back */ } }
    return ep.example || { message: 'OK' };
  };
  const okCode = (ep) => Object.keys(ep.responses || { 200: '' })[0];

  // --- markup --------------------------------------------------------------
  const rail = spec.resources.map((r) =>
    `<a class="api-rail__item${r.tag === activeTag ? ' is-active' : ''}" href="#res-${r.tag}" data-rail="${r.tag}">${C.escape(r.label)}<span class="api-rail__n">${r.endpoints.length}</span></a>`).join('');

  const paramTable = (ep) => (ep.params || []).length ? `
    <div class="api-block"><div class="api-block__label">Parameter</div>
      <table class="api-params"><tbody>${ep.params.map((p) => `<tr>
        <td><code>${C.escape(p.name)}</code>${p.required ? '<span class="api-req" title="erforderlich">*</span>' : ''}</td>
        <td class="muted small">${C.escape(p.in)}</td><td class="muted small">${C.escape(p.type)}</td>
        <td>${C.escape(p.desc || '')}</td></tr>`).join('')}</tbody></table></div>` : '';

  const endpoint = (ep, key) => `
    <div class="api-ep">
      <button type="button" class="api-ep__head" aria-expanded="false">
        <span class="api-method api-method--${METHOD[ep.method] || 'get'}">${ep.method}</span>
        <code class="api-ep__path">${C.escape(ep.path)}</code>
        <span class="api-ep__summary">${C.escape(ep.summary)}</span>
        ${C.icon('ChevronDown', 'api-ep__chev')}
      </button>
      <div class="api-ep__body" hidden>
        ${paramTable(ep)}
        ${ep.body ? `<div class="api-block"><div class="api-block__label">Request-Body <span class="muted small">(application/json)</span></div>
          <pre class="api-code">${C.escape(JSON.stringify(ep.body, null, 2))}</pre></div>` : ''}
        <div class="api-block"><div class="api-block__label">Antworten</div>
          <ul class="api-resp">${Object.entries(ep.responses || {}).map(([code, desc]) =>
            `<li><span class="api-status api-status--${String(code)[0]}">${C.escape(code)}</span> ${C.escape(desc)}</li>`).join('')}</ul></div>
        <div class="api-try">
          <button type="button" class="btn btn--outline btn--sm" data-try="${key}">${C.icon('ArrowRight', 'icon--base')} Ausprobieren</button>
          <div class="api-try__out" hidden>
            <div class="api-try__req"><span class="api-method api-method--${METHOD[ep.method] || 'get'}">${ep.method}</span> <code>${C.escape(spec.baseUrl + ep.path)}</code></div>
            <div class="api-try__status"></div>
            <pre class="api-code api-try__pre"></pre>
          </div>
        </div>
      </div>
    </div>`;

  const flat = [];
  const sections = spec.resources.map((r) => `
    <section class="api-resource" id="res-${r.tag}">
      <h2 class="api-resource__title">${C.escape(r.label)}</h2>
      <p class="muted api-resource__desc">${C.escape(r.description)}</p>
      <div class="api-endpoints">${r.endpoints.map((ep) => { const key = String(flat.push(ep) - 1); return endpoint(ep, key); }).join('')}</div>
    </section>`).join('');

  mount.innerHTML = `
  <div class="container section api-docs">
    ${C.backLink('#/data/katalog', 'Datenbezug und API Verzeichnis')}
    <div class="api-head">
      <h1 tabindex="-1">${C.escape(spec.title)}</h1>
      <div class="api-head__badges">${C.badge('v' + spec.version, 'blue')} ${C.badge(spec.format || 'REST', 'gray')}</div>
    </div>
    <p class="lead">${C.escape(spec.description)}</p>
    <div class="api-meta">
      <div class="api-meta__row"><span class="api-meta__k">Basis-URL</span>
        <code id="api-base">${C.escape(spec.baseUrl)}</code>
        <button type="button" class="btn btn--bare btn--sm" id="api-copy" title="Basis-URL kopieren">${C.icon('Link', 'icon--base')}<span class="btn__text">kopieren</span></button></div>
      ${spec.auth ? `<div class="api-meta__row"><span class="api-meta__k">${C.icon('Lock', 'icon--base')} Authentifizierung</span> <span class="muted">${C.escape(spec.auth)}</span></div>` : ''}
    </div>
    <div class="api-layout">
      <nav class="api-rail" aria-label="Ressourcen"><div class="api-rail__title">Ressourcen</div>${rail}</nav>
      <div class="api-main">${sections}</div>
    </div>
  </div>`;

  // --- wiring --------------------------------------------------------------
  mount.querySelectorAll('.api-ep__head').forEach((btn) => btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    btn.nextElementSibling.hidden = open;
    btn.closest('.api-ep').classList.toggle('is-open', !open);
  }));

  mount.querySelectorAll('[data-try]').forEach((btn) => btn.addEventListener('click', () => {
    const ep = flat[Number(btn.getAttribute('data-try'))];
    const out = btn.parentElement.querySelector('.api-try__out');
    const code = okCode(ep);
    out.querySelector('.api-try__status').innerHTML = `<span class="api-status api-status--${String(code)[0]}">${C.escape(code)}</span> <span class="muted small">application/json · Mock</span>`;
    out.querySelector('.api-try__pre').textContent = JSON.stringify(respond(ep), null, 2);
    out.hidden = false;
  }));

  mount.querySelectorAll('[data-rail]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    mount.querySelectorAll('[data-rail]').forEach((x) => x.classList.toggle('is-active', x === a));
    const sec = document.getElementById('res-' + a.getAttribute('data-rail'));
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  const copyBtn = mount.querySelector('#api-copy');
  if (copyBtn) copyBtn.addEventListener('click', () => copyText(spec.baseUrl).then((ok) => C.toast(ok ? 'Basis-URL kopiert.' : 'Kopieren nicht möglich.')));

  // Deep-link ?tag=… → open that resource focused. Deferred past the router's
  // post-render scrollTo(0,0) so the scroll actually lands on the resource.
  if (query.get('tag')) {
    const sec = document.getElementById('res-' + activeTag);
    if (sec) {
      const first = sec.querySelector('.api-ep__head');
      if (first) first.click();
      setTimeout(() => sec.scrollIntoView({ block: 'start' }), 0);
    }
  }
}
