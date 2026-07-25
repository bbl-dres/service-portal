// Liegenschaften Inventar — real-estate portfolio (overview: Liste/Galerie/Karte + detail).
//
// Datenquelle ist der SAP-RE-FX-Golden-Record (data/buildings.geojson, via core),
// dieselbe Quelle und dieselben bbl_id wie das Immobilienportfolio-Dashboard. Ein
// Objekt wird über die URL angesprochen: #/app/portfolio?id=<bbl_id>. Die id steht
// bewusst im Query-Parameter, nicht im Pfad — SAP-ids enthalten «/» (1000/4840/AF),
// was der Hash-Router sonst in mehrere Segmente zerlegen würde.

let pfMap = null;   // aktive MapLibre-Instanz der Kartenansicht (einmalig, App-Singleton)
function freePfMap() { if (pfMap) { try { pfMap.remove(); } catch { /* schon weg */ } pfMap = null; } }

export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs } = ctx;
  const detailId = (query && query.get('id')) || params[0];
  if (detailId) return detail(ctx, detailId);
  freePfMap();

  setTitle('Liegenschaften Inventar');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' }, { label: 'Anwendungen', href: '#/applications' },
    { label: 'Liegenschaften Inventar' },
  ]);

  const all = core.buildings();
  const ref = core.ref();

  // distinct filter values from data
  const categories = [...new Set(all.map(b => b.portfolioCategory))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'de'));
  const regions = [...new Set(all.map(b => b.canton))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'de'));

  // local view state
  const state = {
    view: 'liste',      // liste | galerie | karte
    category: '',       // '' = alle
    region: '',         // '' = alle (Kanton / ausländische Region)
    q: '',
  };

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return all.filter(b =>
      (!state.category || b.portfolioCategory === state.category) &&
      (!state.region || b.canton === state.region) &&
      (!q || (b.name + ' ' + b.city).toLowerCase().includes(q))
    );
  }

  function statsRow(list) {
    const totalGf = list.reduce((s, b) => s + (b.gf || 0), 0);
    const byStatus = {};
    for (const b of list) byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    const stats = [
      { num: list.length, label: 'Liegenschaften' },
      { num: totalGf.toLocaleString('de-CH'), label: 'Geschossfläche (m² GF)' },
    ];
    for (const s of (ref.buildingStatuses || [])) {
      if (byStatus[s.id]) stats.push({ num: byStatus[s.id], label: s.label });
    }
    return `<div class="stats mt-4">${stats.map(s =>
      `<div class="stat"><div class="stat__num">${s.num}</div><div class="stat__label">${C.escape(s.label)}</div></div>`
    ).join('')}</div>`;
  }

  function chipsBlock() {
    const cat = [`<button type="button" class="tag-item${!state.category ? " tag-item--active" : ""}" aria-pressed="${!!(!state.category)}" data-cat=""><span class="tag-item__inner"><span class="tag-item__text">Alle Kategorien</span></span></button>`]
      .concat(categories.map(c => `<button type="button" class="tag-item${state.category === c ? " tag-item--active" : ""}" aria-pressed="${!!(state.category === c)}" data-cat="${C.escape(c)}"><span class="tag-item__inner"><span class="tag-item__text">${C.escape(c)}</span></span></button>`))
      .join('');
    const reg = [`<button type="button" class="tag-item${!state.region ? " tag-item--active" : ""}" aria-pressed="${!!(!state.region)}" data-region=""><span class="tag-item__inner"><span class="tag-item__text">Alle Regionen</span></span></button>`]
      .concat(regions.map(c => `<button type="button" class="tag-item${state.region === c ? " tag-item--active" : ""}" aria-pressed="${!!(state.region === c)}" data-region="${C.escape(c)}"><span class="tag-item__inner"><span class="tag-item__text">${C.escape(c)}</span></span></button>`))
      .join('');
    return `
      <div class="stack mt-6">
        <div>
          <div class="small muted mb-4">Portfolio-Kategorie</div>
          <div class="list list--flex list--wrap">${cat}</div>
        </div>
        <div>
          <div class="small muted mb-4">Region / Kanton</div>
          <div class="list list--flex list--wrap">${reg}</div>
        </div>
      </div>`;
  }

  function viewToggle() {
    const modes = [
      { id: 'liste', label: 'Liste', icon: 'List' },
      { id: 'galerie', label: 'Galerie', icon: 'Apps' },
      { id: 'karte', label: 'Karte', icon: 'Map' },
    ];
    return `<div class="list list--flex list--wrap" role="group" aria-label="Ansicht wählen">${modes.map(m =>
      `<button type="button" class="tag-item${state.view === m.id ? " tag-item--active" : ""}" aria-pressed="${!!(state.view === m.id)}" data-view="${m.id}"><span class="tag-item__inner"><span class="tag-item__text">${C.icon(m.icon, 'icon--base')} ${m.label}</span></span></button>`
    ).join('')}</div>`;
  }

  function listView(list) {
    return C.table({
      zebra: true,
      columns: [
        { key: 'name', label: 'Name', render: b => `<a href="#/app/portfolio?id=${encodeURIComponent(b.bbl_id)}">${C.escape(b.name)}</a>` },
        { key: 'standort', label: 'Standort', render: b => `${C.escape(b.street)}<br><span class="small muted">${C.escape(b.zip)} ${C.escape(b.city)}</span>` },
        { key: 'land', label: 'Land', render: b => C.escape(b.land) },
        { key: 'portfolioCategory', label: 'Kategorie', render: b => C.escape(b.portfolioCategory) },
        { key: 'ownership', label: 'Eigentum', render: b => C.escape(b.ownership) },
        { key: 'status', label: 'Status', render: b => statusBadge(C, ref, b.status) },
        { key: 'gf', label: 'GF (m²)', render: b => Number(b.gf || 0).toLocaleString('de-CH') },
        { key: 'classification', label: 'Klassifizierung', render: b => classBadge(C, ref, b.classification) },
      ],
      rows: list,
    });
  }

  function galleryView(list) {
    if (!list.length) return C.empty('Keine Liegenschaften gefunden.');
    return `<div class="grid grid--3 mt-2">${list.map(b => C.card({
      title: b.name,
      desc: b.street + ', ' + b.zip + ' ' + b.city,
      href: `#/app/portfolio?id=${encodeURIComponent(b.bbl_id)}`,
      photo: { id: b.photo, color: '#2f4356', alt: `${b.name}, ${b.city}` },
      badges: [C.badge(b.portfolioCategory, 'gray'), statusBadge(C, ref, b.status)],
      footer: `<span>${C.escape([b.land, b.canton].filter(Boolean).join(' · '))}${b.buildYear ? ' · ' + C.escape(String(b.buildYear)) : ''}</span><span class="btn btn--link">Öffnen ${C.icon('ArrowRight', 'icon--base')}</span>`,
    })).join('')}</div>`;
  }

  // Weltweite Karte auf CARTO-Grau (dieselbe geclusterte Komponente wie das
  // Dashboard). Der Container wird hier synchron gerendert; die Karte selbst hängt
  // MapLibre nach dem Einfügen asynchron ein (mountMap).
  function mapView() {
    return `
      <div class="dash-map" id="pf-map-el" role="group" aria-label="Weltweite Karte der Liegenschaften"
        style="height:32rem;border-radius:var(--radius-lg);overflow:hidden"></div>
      <p class="small muted mt-2">Weltweites Portfolio · Punktgrösse ∝ Geschossfläche · gruppiert (Cluster) · Kartengrundlage CARTO · Klick öffnet das Objekt.</p>`;
  }

  async function mountMap(list) {
    freePfMap();
    const el = mount.querySelector('#pf-map-el');
    if (!el) return;
    const { initEstateMap } = await import('../buildings-map.js');
    const points = list
      .filter(b => Number.isFinite(b.lat) && Number.isFinite(b.lng))
      .map(b => ({
        lat: b.lat, lon: b.lng, label: b.name, size: b.gf, bblId: b.bbl_id,
        sub: `${b.street}, ${b.zip} ${b.city}`.trim(),
        href: `#/app/portfolio?id=${encodeURIComponent(b.bbl_id)}`,
      }));
    pfMap = await initEstateMap(el, points);
  }

  function body() {
    const list = filtered();
    let content;
    if (state.view === 'galerie') content = galleryView(list);
    else if (state.view === 'karte') content = mapView();
    else content = `<div class="mt-2">${listView(list)}</div>`;
    return `
      ${statsRow(list)}
      ${chipsBlock()}
      <div class="row row--between mt-6">
        ${viewToggle()}
        <form id="pf-search" role="search" class="row" style="margin:0;gap:.5rem">
          <input id="pf-q" type="search" placeholder="Name oder Ort suchen…" value="${C.escape(state.q)}" autocomplete="off" style="min-width:14rem">
          <button class="btn btn--bare btn--icon-only" type="submit" aria-label="Suchen" title="Suchen">${C.icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span></button>
        </form>
      </div>
      <div id="pf-content" class="mt-6">${content}</div>`;
  }

  function draw() {
    mount.innerHTML = `
    <div class="container section">
      ${C.pageHeader({ title: 'Liegenschaften Inventar', lead: 'Weltweites Immobilienportfolio des Bundesamts für Bauten und Logistik — Gebäude, Standorte und Kennzahlen aus dem SAP-RE-FX-Stammdatenbestand.' })}
      ${body()}
    </div>`;
    wire();
    if (state.view === 'karte') mountMap(filtered());
    else freePfMap();
  }

  // Full redraw on filter/view change; refocus search box if it was active.
  function redraw() {
    const hadSearchFocus = document.activeElement && document.activeElement.id === 'pf-q';
    draw();
    if (hadSearchFocus) {
      const el = mount.querySelector('#pf-q');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }
  }

  function wire() {
    mount.querySelectorAll('[data-view]').forEach(btn =>
      btn.addEventListener('click', () => { state.view = btn.getAttribute('data-view'); redraw(); }));
    mount.querySelectorAll('[data-cat]').forEach(btn =>
      btn.addEventListener('click', () => { state.category = btn.getAttribute('data-cat'); redraw(); }));
    mount.querySelectorAll('[data-region]').forEach(btn =>
      btn.addEventListener('click', () => { state.region = btn.getAttribute('data-region'); redraw(); }));
    const form = mount.querySelector('#pf-search');
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      state.q = (mount.querySelector('#pf-q').value || '');
      redraw();
    });
  }

  draw();
}

// ---------------------------------------------------------------------------
// Detail view
// ---------------------------------------------------------------------------
function detail(ctx, id) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  freePfMap();
  const b = core.building(id);
  if (!b) {
    mount.innerHTML = `<div class="container section">${C.backLink('#/app/portfolio', 'Liegenschaften Inventar')}${C.empty('Liegenschaft nicht gefunden.')}</div>`;
    return;
  }
  const ref = core.ref();
  setTitle(b.name);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' }, { label: 'Anwendungen', href: '#/applications' },
    { label: 'Liegenschaften Inventar', href: '#/app/portfolio' },
    { label: b.name },
  ]);

  const projects = core.projectsForBuilding(b.bbl_id);
  const documents = core.documentsForBuilding(b.bbl_id);
  const media = core.mediaForBuilding(b.bbl_id);
  const regionLabel = [b.land, b.canton].filter(Boolean).join(' · ');

  const tabs = [
    { id: 'uebersicht', label: 'Übersicht' },
    { id: 'bauprojekte', label: `Bauprojekte (${projects.length})` },
    { id: 'dokumente', label: `Dokumente (${documents.length})` },
    { id: 'medien', label: `Medien (${media.length})` },
  ];

  function tabUebersicht() {
    return `
      <dl class="kv">
        <dt>BBL-ID</dt><dd>${C.escape(b.bbl_id)}</dd>
        <dt>Wirtschaftseinheit (WE)</dt><dd>${C.escape(b.bbl_we)}</dd>
        <dt>EGID</dt><dd>${C.escape(b.egid || '—')}</dd>
        <dt>Adresse</dt><dd>${C.escape(b.street)}, ${C.escape(b.zip)} ${C.escape(b.city)}</dd>
        <dt>Land / Region</dt><dd>${C.escape(regionLabel)}</dd>
        <dt>Portfolio-Kategorie</dt><dd>${C.escape(b.portfolioCategory)}</dd>
        <dt>Gebäudetyp</dt><dd>${C.escape(b.typ || '—')}</dd>
        <dt>Eigentumsverhältnis</dt><dd>${C.escape(b.ownership)}</dd>
        <dt>Baujahr</dt><dd>${C.escape(String(b.buildYear || '—'))}</dd>
        <dt>Geschossfläche (GF)</dt><dd>${Number(b.gf || 0).toLocaleString('de-CH')} m²</dd>
        <dt>Hauptnutzfläche (HNF)</dt><dd>${Number(b.hnf || 0).toLocaleString('de-CH')} m²</dd>
        ${b.erhaltung ? `<dt>Erhaltungsstrategie</dt><dd>${C.escape(b.erhaltung)}</dd>` : ''}
        ${b.heritage ? `<dt>Baudenkmal</dt><dd>Ja</dd>` : ''}
        <dt>Status</dt><dd>${statusBadge(C, ref, b.status)}</dd>
        <dt>Klassifizierung</dt><dd>${classBadge(C, ref, b.classification)}</dd>
      </dl>`;
  }

  function tabBauprojekte() {
    if (!projects.length) return C.empty('Keine Bauprojekte zu dieser Liegenschaft.');
    return C.table({
      zebra: true,
      columns: [
        { key: 'name', label: 'Projekt', render: p => `<a href="#/app/projects/${encodeURIComponent(p.projectId)}">${C.escape(p.name)}</a><br><span class="small muted">${C.escape(p.projectNumber)}</span>` },
        { key: 'siaPhaseLabel', label: 'SIA-Phase', render: p => C.escape(p.siaPhaseLabel) },
        { key: 'status', label: 'Status', render: p => projectStatusBadge(C, ref, p.status) },
        { key: 'plannedTotalCost', label: 'Gepl. Kosten', render: p => 'CHF ' + Number(p.plannedTotalCost || 0).toLocaleString('de-CH') },
        { key: 'span', label: 'Zeitraum', render: p => `${C.escape(String(p.start))}–${C.escape(String(p.end))}` },
      ],
      rows: projects,
    });
  }

  function tabDokumente() {
    if (!documents.length) {
      return `${C.empty('Keine Dokumente verknüpft.')}<p class="mt-4"><a class="btn btn--link" href="#/app/document-archive">In der Bauwerksdokumentation öffnen ${C.icon('ArrowRight', 'icon--base')}</a></p>`;
    }
    const items = documents.map(d => `
      <div class="row row--between" style="padding:.75rem 0;border-bottom:1px solid var(--color-border)">
        <div class="row" style="gap:.75rem">
          ${C.icon('File', 'icon--lg')}
          <div>
            <div><strong>${C.escape(d.title)}</strong></div>
            <div class="small muted">${C.escape(d.type)} · ${C.escape(d.format)} · ${C.escape(formatSize(d.sizeKB))} · ${C.escape(String(d.year))} · ${classBadge(C, ref, d.classification)}</div>
          </div>
        </div>
        <a class="btn btn--outline btn--sm" href="${C.escape(d.url || '#')}">${C.icon('Download', 'icon--base')} Download</a>
      </div>`).join('');
    return `
      <div class="stack">${items}</div>
      <p class="mt-6"><a class="btn btn--link" href="#/app/document-archive">In der Bauwerksdokumentation öffnen ${C.icon('ArrowRight', 'icon--base')}</a></p>`;
  }

  function tabMedien() {
    if (!media.length) {
      return `${C.empty('Keine Medien verknüpft.')}<p class="mt-4"><a class="btn btn--link" href="#/app/mediathek">Zur Mediathek ${C.icon('ArrowRight', 'icon--base')}</a></p>`;
    }
    const tiles = media.map(m => `
      <a class="pf-media" href="#/app/mediathek/${encodeURIComponent(m.mediaId)}" title="${C.escape(m.title)}">
        ${C.photo({
          id: m.photo, color: m.color || '#3a4a5a', alt: m.title, w: 480,
          gray: m.historicPeriod === 'historisch', cls: 'pf-media__bg',
        })}
        <span class="pf-media__type">${C.icon(m.mediaType === 'video' ? 'Video' : 'Image', 'icon--base')} ${m.mediaType === 'video' ? 'Video' : 'Foto'}</span>
        <span class="pf-media__title">${C.escape(m.title)}</span>
        <span class="pf-media__meta">${C.escape(String(m.date))} · ${C.escape(m.historicPeriod)}</span>
      </a>`).join('');
    return `
      <div class="grid grid--4 mt-2">${tiles}</div>
      <p class="mt-6"><a class="btn btn--link" href="#/app/mediathek">Zur Mediathek ${C.icon('ArrowRight', 'icon--base')}</a></p>`;
  }

  function panelHtml(tabId) {
    if (tabId === 'bauprojekte') return tabBauprojekte();
    if (tabId === 'dokumente') return tabDokumente();
    if (tabId === 'medien') return tabMedien();
    return tabUebersicht();
  }

  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/app/portfolio', 'Liegenschaften Inventar')}
    <div class="row mt-4" style="gap:.5rem">${classBadge(C, ref, b.classification)} ${statusBadge(C, ref, b.status)} <span class="small muted">${C.escape(b.bbl_id)}</span></div>
    <h1 tabindex="-1">${C.escape(b.name)}</h1>
    <p class="lead">${C.escape(b.street)}, ${C.escape(b.zip)} ${C.escape(b.city)} · ${C.escape(b.portfolioCategory)}</p>
    ${C.photo({
      id: b.photo, color: '#2f4356', alt: `${b.name}, ${b.city}`, w: 1600,
      cls: 'pf-hero', style: 'aspect-ratio:21/9;max-height:22rem;border-radius:var(--radius-lg)',
    })}

    <div class="tabs mt-6">
      ${C.tabBar({ items: tabs, active: tabs[0].id, idPrefix: 'pf-tab', ariaLabel: 'Gebäudedetails' })}
      ${C.tabPanels({ items: tabs, active: tabs[0].id, idPrefix: 'pf-tab', render: panelHtml })}
    </div>
  </div>`;

  C.wireTabs(mount);
  // Liste→Detail ist für den Router ein Zustandswechsel (gleicher Pfad, andere
  // Query) — er scrollt/fokussiert dann nicht. Für den Objektwechsel ist das aber
  // eine echte Navigation, also hier selbst an den Anfang und auf die H1.
  window.scrollTo(0, 0);
  const h = mount.querySelector('h1');
  if (h) h.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------
// Golden-Record-Status (Datensatz-Lebenszyklus), identisch zum Dashboard.
const BUILDING_STATUS_VARIANT = { Aktiv: 'success', Abgang: 'warning', 'Löschvermerk': 'gray' };
const PROJECT_STATUS_VARIANT = { geplant: 'info', aktiv: 'warning', sistiert: 'gray', abgeschlossen: 'success', abgebrochen: 'error' };

function statusBadge(C, ref, statusId) {
  const m = (ref.buildingStatuses || []).find(s => s.id === statusId);
  return C.badge(m ? m.label : statusId, BUILDING_STATUS_VARIANT[statusId] || 'gray');
}
function projectStatusBadge(C, ref, statusId) {
  const m = (ref.projectStatuses || []).find(s => s.id === statusId);
  return C.badge(m ? m.label : statusId, PROJECT_STATUS_VARIANT[statusId] || 'gray');
}
function classBadge(C, ref, clsId) {
  const m = (ref.classificationTiers || []).find(t => t.id === clsId);
  return C.badge(m ? m.label : clsId, m ? m.variant : 'gray');
}
function formatSize(kb) {
  if (kb == null) return '';
  return kb >= 1024 ? (kb / 1024).toFixed(1).replace('.', ',') + ' MB' : kb + ' KB';
}
