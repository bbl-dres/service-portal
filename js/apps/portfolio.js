// Liegenschaften Inventar — real-estate portfolio (overview: Liste/Galerie/Karte + detail).
export default async function render(ctx) {
  const { mount, params, core, C, setTitle, setCrumbs } = ctx;
  if (params[0]) return detail(ctx, params[0]);

  setTitle('Liegenschaften Inventar');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Anwendungen', href: '#/applications' },
    { label: 'Liegenschaften Inventar' },
  ]);

  const all = core.buildings();
  const ref = core.ref();

  // distinct filter values from data
  const categories = [...new Set(all.map(b => b.portfolioCategory))].sort((a, b) => a.localeCompare(b, 'de'));
  const cantons = [...new Set(all.map(b => b.canton))].sort();

  // local view state
  const state = {
    view: 'liste',      // liste | galerie | karte
    category: '',       // '' = alle
    canton: '',         // '' = alle
    q: '',
  };

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return all.filter(b =>
      (!state.category || b.portfolioCategory === state.category) &&
      (!state.canton || b.canton === state.canton) &&
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
    const cat = [`<button class="chip${!state.category ? ' active' : ''}" data-cat="">Alle Kategorien</button>`]
      .concat(categories.map(c => `<button class="chip${state.category === c ? ' active' : ''}" data-cat="${C.escape(c)}">${C.escape(c)}</button>`))
      .join('');
    const can = [`<button class="chip${!state.canton ? ' active' : ''}" data-canton="">Alle Kantone</button>`]
      .concat(cantons.map(c => `<button class="chip${state.canton === c ? ' active' : ''}" data-canton="${C.escape(c)}">${C.escape(c)}</button>`))
      .join('');
    return `
      <div class="stack mt-6">
        <div>
          <div class="small muted mb-4">Portfolio-Kategorie</div>
          <div class="chips">${cat}</div>
        </div>
        <div>
          <div class="small muted mb-4">Kanton</div>
          <div class="chips">${can}</div>
        </div>
      </div>`;
  }

  function viewToggle() {
    const modes = [
      { id: 'liste', label: 'Liste', icon: 'List' },
      { id: 'galerie', label: 'Galerie', icon: 'Apps' },
      { id: 'karte', label: 'Karte', icon: 'Map' },
    ];
    return `<div class="chips" role="group" aria-label="Ansicht wählen">${modes.map(m =>
      `<button class="chip${state.view === m.id ? ' active' : ''}" data-view="${m.id}" aria-pressed="${state.view === m.id}">${C.icon(m.icon, 'icon--sm')} ${m.label}</button>`
    ).join('')}</div>`;
  }

  function listView(list) {
    return C.table({
      zebra: true,
      columns: [
        { key: 'name', label: 'Name', render: b => `<a href="#/app/portfolio/${encodeURIComponent(b.bbl_id)}">${C.escape(b.name)}</a>` },
        { key: 'standort', label: 'Standort', render: b => `${C.escape(b.street)}<br><span class="small muted">${C.escape(b.zip)} ${C.escape(b.city)}</span>` },
        { key: 'portfolioCategory', label: 'Kategorie', render: b => C.escape(b.portfolioCategory) },
        { key: 'status', label: 'Status', render: b => statusBadge(C, ref, b.status) },
        { key: 'buildYear', label: 'Baujahr', render: b => C.escape(String(b.buildYear)) },
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
      href: `#/app/portfolio/${encodeURIComponent(b.bbl_id)}`,
      badges: [C.badge(b.portfolioCategory, 'gray'), statusBadge(C, ref, b.status)],
      footer: `<span>${C.escape(b.canton)} · ${C.escape(String(b.buildYear))}</span><span class="btn btn--link">Öffnen ${C.icon('ArrowRight', 'icon--sm')}</span>`,
    })).join('')}</div>`;
  }

  // Schematic CH map: lng [5.9, 9.6] -> x%, lat [45.8, 47.8] -> y% (inverted)
  const LNG0 = 5.9, LNG1 = 9.6, LAT0 = 45.8, LAT1 = 47.8;
  function mapView(list) {
    const clamp = (v) => Math.max(2, Math.min(98, v));
    const markers = list.map(b => {
      const x = clamp(((b.lng - LNG0) / (LNG1 - LNG0)) * 100);
      const y = clamp((1 - (b.lat - LAT0) / (LAT1 - LAT0)) * 100);
      const sl = (ref.buildingStatuses || []).find(s => s.id === b.status);
      const slabel = sl ? sl.label : b.status;
      return `<a class="pf-marker pf-status--${b.status}" href="#/app/portfolio/${encodeURIComponent(b.bbl_id)}"
        style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%"
        title="${C.escape(b.name)} — ${C.escape(b.city)} (${C.escape(slabel)})">
        <span class="sr-only">${C.escape(b.name)}, ${C.escape(b.city)}, ${C.escape(slabel)}</span></a>`;
    }).join('');
    const legend = (ref.buildingStatuses || []).map(s =>
      `<span class="row" style="gap:.35rem"><span class="swatch pf-status--${s.id}"></span>${C.escape(s.label)}</span>`
    ).join('');
    return `
      <div class="map pf-map mt-2" role="group" aria-label="Schematische Karte der Liegenschaften — Standorte als Marker">
        <span class="pf-map__hint small muted">Schweiz (schematisch)</span>
        ${markers}
      </div>
      <div class="row mt-4 small" style="gap:1.25rem">${legend}<span class="muted">${list.length} Standort(e)</span></div>`;
  }

  function body() {
    const list = filtered();
    let content;
    if (state.view === 'galerie') content = galleryView(list);
    else if (state.view === 'karte') content = mapView(list);
    else content = `<div class="mt-2">${listView(list)}</div>`;
    return `
      ${statsRow(list)}
      ${chipsBlock()}
      <div class="row row--between mt-6">
        ${viewToggle()}
        <form id="pf-search" role="search" class="row" style="margin:0;gap:.5rem">
          <input id="pf-q" type="search" placeholder="Name oder Ort suchen…" value="${C.escape(state.q)}" autocomplete="off" style="min-width:14rem">
          <button class="btn btn--filled btn--sm" type="submit">Suchen</button>
        </form>
      </div>
      <div id="pf-content" class="mt-6">${content}</div>`;
  }

  function draw() {
    mount.innerHTML = `
    <div class="container section">
      ${C.pageHeader({ title: 'Liegenschaften Inventar', lead: 'Portfolio des Bundesamts für Bauten und Logistik — Gebäude, Standorte und Kennzahlen.' })}
      ${body()}
    </div>`;
    wire();
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
    mount.querySelectorAll('[data-canton]').forEach(btn =>
      btn.addEventListener('click', () => { state.canton = btn.getAttribute('data-canton'); redraw(); }));
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
  const b = core.building(id);
  if (!b) {
    mount.innerHTML = `<div class="container section">${C.backLink('#/app/portfolio', 'Liegenschaften Inventar')}${C.empty('Liegenschaft nicht gefunden.')}</div>`;
    return;
  }
  const ref = core.ref();
  setTitle(b.name);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Anwendungen', href: '#/applications' },
    { label: 'Liegenschaften Inventar', href: '#/app/portfolio' },
    { label: b.name },
  ]);

  const projects = core.projectsForBuilding(b.bbl_id);
  const documents = core.documentsForBuilding(b.bbl_id);
  const media = core.mediaForBuilding(b.bbl_id);
  const regionLabel = [b.region, b.canton].filter(Boolean).join(' · ');

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
        <dt>EGID</dt><dd>${C.escape(b.egid)}</dd>
        <dt>Adresse</dt><dd>${C.escape(b.street)}, ${C.escape(b.zip)} ${C.escape(b.city)}</dd>
        <dt>Region / Kanton</dt><dd>${C.escape(regionLabel)}</dd>
        <dt>Baujahr</dt><dd>${C.escape(String(b.buildYear))}</dd>
        <dt>Geschossfläche (GF)</dt><dd>${Number(b.gf || 0).toLocaleString('de-CH')} m²</dd>
        <dt>Hauptnutzfläche (HNF)</dt><dd>${Number(b.hnf || 0).toLocaleString('de-CH')} m²</dd>
        <dt>Arbeitsplätze</dt><dd>${Number(b.workplaces || 0).toLocaleString('de-CH')}</dd>
        <dt>Portfolio-Kategorie</dt><dd>${C.escape(b.portfolioCategory)}</dd>
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
      return `${C.empty('Keine Dokumente verknüpft.')}<p class="mt-4"><a class="btn btn--link" href="#/app/document-archive">Im Dokumentenarchiv öffnen ${C.icon('ArrowRight', 'icon--sm')}</a></p>`;
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
        <a class="btn btn--outline btn--sm" href="${C.escape(d.url || '#')}">${C.icon('Download', 'icon--sm')} Download</a>
      </div>`).join('');
    return `
      <div class="stack">${items}</div>
      <p class="mt-6"><a class="btn btn--link" href="#/app/document-archive">Im Dokumentenarchiv öffnen ${C.icon('ArrowRight', 'icon--sm')}</a></p>`;
  }

  function tabMedien() {
    if (!media.length) {
      return `${C.empty('Keine Medien verknüpft.')}<p class="mt-4"><a class="btn btn--link" href="#/app/mediathek">Zur Mediathek ${C.icon('ArrowRight', 'icon--sm')}</a></p>`;
    }
    const tiles = media.map(m => `
      <a class="pf-media" href="#/app/mediathek" title="${C.escape(m.title)}" style="background:${C.escape(m.color || '#3a4a5a')}">
        <span class="pf-media__type">${C.icon(m.mediaType === 'video' ? 'Video' : 'Image', 'icon--sm')} ${m.mediaType === 'video' ? 'Video' : 'Foto'}</span>
        <span class="pf-media__title">${C.escape(m.title)}</span>
        <span class="pf-media__meta">${C.escape(String(m.date))} · ${C.escape(m.historicPeriod)}</span>
      </a>`).join('');
    return `
      <div class="grid grid--4 mt-2">${tiles}</div>
      <p class="mt-6"><a class="btn btn--link" href="#/app/mediathek">Zur Mediathek ${C.icon('ArrowRight', 'icon--sm')}</a></p>`;
  }

  function panelHtml(tabId) {
    if (tabId === 'bauprojekte') return tabBauprojekte();
    if (tabId === 'dokumente') return tabDokumente();
    if (tabId === 'medien') return tabMedien();
    return tabUebersicht();
  }

  mount.innerHTML = `
  <style>
    .pf-media { display:flex; flex-direction:column; justify-content:flex-end; gap:.2rem;
      aspect-ratio:4/3; padding:.7rem .8rem; border-radius:var(--radius-lg); color:#fff;
      text-decoration:none; box-shadow:var(--shadow-md); position:relative; overflow:hidden;
      transition:transform .12s; }
    .pf-media:hover { transform:translateY(-2px); text-decoration:none; }
    .pf-media::after { content:""; position:absolute; inset:0;
      background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.45)); }
    .pf-media > * { position:relative; z-index:1; }
    .pf-media__type { font-size:var(--fs-xs); font-weight:var(--fw-bold); opacity:.9; display:inline-flex; align-items:center; gap:.25rem; }
    .pf-media__title { font-size:var(--fs-sm); font-weight:var(--fw-bold); line-height:1.2; }
    .pf-media__meta { font-size:var(--fs-xs); opacity:.85; }
  </style>
  <div class="container section">
    ${C.backLink('#/app/portfolio', 'Liegenschaften Inventar')}
    <div class="row mt-4" style="gap:.5rem">${classBadge(C, ref, b.classification)} ${statusBadge(C, ref, b.status)} <span class="small muted">${C.escape(b.bbl_id)}</span></div>
    <h1 tabindex="-1">${C.escape(b.name)}</h1>
    <p class="lead">${C.escape(b.street)}, ${C.escape(b.zip)} ${C.escape(b.city)} · ${C.escape(b.portfolioCategory)}</p>

    <div class="tabs mt-6">
      <div class="tabs__controls" role="tablist">
        ${tabs.map((t, i) => `<button class="tab__btn${i === 0 ? ' active' : ''}" role="tab" id="tab-${t.id}" aria-controls="panel-${t.id}" aria-selected="${i === 0}" data-tab="${t.id}">${C.escape(t.label)}</button>`).join('')}
      </div>
      ${tabs.map((t, i) => `<div class="tab__panel" id="panel-${t.id}" role="tabpanel" aria-labelledby="tab-${t.id}"${i === 0 ? '' : ' hidden'}>${panelHtml(t.id)}</div>`).join('')}
    </div>
  </div>`;

  // tab interactivity (keyboard accessible)
  const btns = [...mount.querySelectorAll('.tab__btn')];
  const panels = [...mount.querySelectorAll('.tab__panel')];
  function activate(tabId) {
    btns.forEach(btn => {
      const on = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(p => { p.hidden = p.id !== 'panel-' + tabId; });
  }
  btns.forEach((btn, idx) => {
    btn.addEventListener('click', () => activate(btn.getAttribute('data-tab')));
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = e.key === 'ArrowRight' ? (idx + 1) % btns.length : (idx - 1 + btns.length) % btns.length;
      btns[next].focus();
      activate(btns[next].getAttribute('data-tab'));
    });
  });
}

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------
const BUILDING_STATUS_VARIANT = { in_betrieb: 'success', in_sanierung: 'warning', in_planung: 'info' };
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
