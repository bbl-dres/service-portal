// Bauprojekte / EPPM — Übersicht (Karten/Liste) + Projektdetail.
export default async function render(ctx) {
  const { params } = ctx;
  if (params[0]) return detail(ctx, params[0]);
  return overview(ctx);
}

// ---- helpers ------------------------------------------------------------

const PROJECT_STATUS_VARIANT = {
  geplant: 'info', aktiv: 'warning', sistiert: 'gray', abgeschlossen: 'success', abgebrochen: 'error',
};
const AMPEL_VARIANT = { gruen: 'success', gelb: 'warning', rot: 'error' };
const AMPEL_LABEL = { gruen: 'Grün', gelb: 'Gelb', rot: 'Rot' };

function statusLabel(core, id) {
  const m = (core.ref().projectStatuses || []).find(s => s.id === id);
  return m ? m.label : id;
}
function projectStatusBadge(C, core, status) {
  return C.badge(statusLabel(core, status), PROJECT_STATUS_VARIANT[status] || 'gray');
}
function ampelBadge(C, prefix, value) {
  const v = AMPEL_VARIANT[value] || 'gray';
  const l = AMPEL_LABEL[value] || value;
  return C.badge(`${prefix}: ${l}`, v);
}
function chf(x) {
  return 'CHF ' + Number(x || 0).toLocaleString('de-CH');
}

// ---- overview -----------------------------------------------------------

function overview(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  setTitle('Bauprojekte / EPPM');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' }, { label: 'Anwendungen', href: '#/applications' },
    { label: 'Bauprojekte / EPPM' },
  ]);

  const all = core.projects();
  const projectStatuses = core.ref().projectStatuses || [];
  const subPortfolios = [...new Set(all.map(p => p.subPortfolio))].sort((a, b) => a.localeCompare(b, 'de'));

  // local UI state (from query, then mutated locally)
  const PHASE_GROUPS = {
    laufend: ['geplant', 'aktiv', 'sistiert'],
    abgeschlossen: ['abgeschlossen', 'abgebrochen'],
    alle: null,
  };
  const state = {
    phase: PHASE_GROUPS[query.get('phase')] !== undefined ? query.get('phase') : 'laufend',
    sub: query.get('sub') || '',          // subPortfolio filter
    status: query.get('status') || '',    // single status filter
    view: query.get('view') === 'liste' ? 'liste' : 'karten',
  };
  if (!(state.phase in PHASE_GROUPS)) state.phase = 'laufend';

  function filtered() {
    return all.filter(p => {
      const grp = PHASE_GROUPS[state.phase];
      if (grp && !grp.includes(p.status)) return false;
      if (state.sub && p.subPortfolio !== state.sub) return false;
      if (state.status && p.status !== state.status) return false;
      return true;
    });
  }

  function phaseTabs() {
    const tabs = [
      ['laufend', 'Laufend'],
      ['abgeschlossen', 'Abgeschlossen'],
      ['alle', 'Alle'],
    ];
    return `<div class="tab__controls" role="tablist" aria-label="Projektphase">${tabs.map(([id, label]) =>
      `<button type="button" role="tab" class="tab__control${state.phase === id ? " tab__control--active" : ""}" aria-selected="${state.phase === id}" data-phase="${id}">${C.escape(label)}</button>`
    ).join('')}</div>`;
  }

  function chipRow() {
    const sub = `<div class="list list--flex list--wrap" data-chipgroup="sub" role="group" aria-label="Teilportfolio">
      <button type="button" class="tag-item${!state.sub ? " tag-item--active" : ""}" aria-pressed="${!!(!state.sub)}" data-sub=""><span class="tag-item__inner"><span class="tag-item__text">Alle Teilportfolios</span></span></button>
      ${subPortfolios.map(s => `<button type="button" class="tag-item${state.sub === s ? " tag-item--active" : ""}" aria-pressed="${!!(state.sub === s)}" data-sub="${C.escape(s)}"><span class="tag-item__inner"><span class="tag-item__text">${C.escape(s)}</span></span></button>`).join('')}
    </div>`;
    const stat = `<div class="list list--flex list--wrap mt-2" data-chipgroup="status" role="group" aria-label="Status">
      <button type="button" class="tag-item${!state.status ? " tag-item--active" : ""}" aria-pressed="${!!(!state.status)}" data-status=""><span class="tag-item__inner"><span class="tag-item__text">Alle Status</span></span></button>
      ${projectStatuses.map(s => `<button type="button" class="tag-item${state.status === s.id ? " tag-item--active" : ""}" aria-pressed="${!!(state.status === s.id)}" data-status="${s.id}"><span class="tag-item__inner"><span class="tag-item__text">${C.escape(s.label)}</span></span></button>`).join('')}
    </div>`;
    return sub + stat;
  }

  function statsBlock(list) {
    const aktiv = list.filter(p => p.status === 'aktiv').length;
    const invest = list.reduce((sum, p) => sum + (p.plannedTotalCost || 0), 0);
    return `<div class="stats mt-6">
      <div class="stat"><div class="stat__num">${list.length}</div><div class="stat__label">Anzahl Projekte</div></div>
      <div class="stat"><div class="stat__num">${aktiv}</div><div class="stat__label">davon aktiv</div></div>
      <div class="stat"><div class="stat__num">${C.escape(chf(invest))}</div><div class="stat__label">Gesamtinvestition</div></div>
    </div>`;
  }

  function viewToggle() {
    return `<div class="row" role="group" aria-label="Ansicht">
      <button type="button" class="btn btn--sm ${state.view === 'karten' ? 'btn--filled' : 'btn--outline'}" data-view="karten">${C.icon('Apps', 'icon--base')} Karten</button>
      <button type="button" class="btn btn--sm ${state.view === 'liste' ? 'btn--filled' : 'btn--outline'}" data-view="liste">${C.icon('List', 'icon--base')} Liste</button>
    </div>`;
  }

  function projectCard(p) {
    const b = core.building(p.buildingId);
    return C.card({
      title: p.name,
      desc: p.teaser,
      href: `#/app/projects/${p.projectId}`,
      photo: { id: b?.photo, color: '#2f4356', alt: b ? `${p.name} — ${b.name}` : p.name },
      badges: [
        projectStatusBadge(C, core, p.status),
        ampelBadge(C, 'Ziele', p.zielAmpel),
        ampelBadge(C, 'Risiko', p.risikoAmpel),
      ],
      footer: `<span>${C.escape(p.projectNumber)}</span><span>${C.icon('Building', 'icon--base')} SIA ${C.escape(p.siaPhase)} · ${C.escape(p.siaPhaseLabel)}</span>`,
    });
  }

  function listView(list) {
    return C.table({
      zebra: true,
      columns: [
        { key: 'projectNumber', label: 'Projektnr.', render: r => `<a href="#/app/projects/${r.projectId}">${C.escape(r.projectNumber)}</a>` },
        { key: 'name', label: 'Name', render: r => `<a href="#/app/projects/${r.projectId}">${C.escape(r.name)}</a>` },
        { key: 'building', label: 'Gebäude', render: r => { const b = core.building(r.buildingId); return b ? C.escape(b.name) : '—'; } },
        { key: 'status', label: 'Status', render: r => projectStatusBadge(C, core, r.status) },
        { key: 'siaPhaseLabel', label: 'SIA-Phase', render: r => `${C.escape(r.siaPhase)} · ${C.escape(r.siaPhaseLabel)}` },
        { key: 'plannedTotalCost', label: 'Investition', render: r => C.escape(chf(r.plannedTotalCost)) },
      ],
      rows: list,
    });
  }

  function draw() {
    const list = filtered();
    const body = list.length
      ? (state.view === 'karten'
        ? `<div class="grid grid--3 mt-6">${list.map(projectCard).join('')}</div>`
        : `<div class="mt-6">${listView(list)}</div>`)
      : `<div class="mt-6">${C.empty('Keine Projekte für die gewählten Filter.')}</div>`;

    mount.innerHTML = `
    <div class="container section">
      ${C.pageHeader({ title: 'Bauprojekte / EPPM', lead: 'Laufende und abgeschlossene Bauprojekte des BBL — Enterprise Project & Portfolio Management.' })}
      ${phaseTabs()}
      ${chipRow()}
      ${statsBlock(list)}
      <div class="row row--between mt-8">
        <p class="muted small" style="margin:0">${list.length} Projekt(e)</p>
        ${viewToggle()}
      </div>
      ${body}
    </div>`;
    wire();
  }

  function syncHash() {
    const qp = new URLSearchParams();
    if (state.phase !== 'laufend') qp.set('phase', state.phase);
    if (state.sub) qp.set('sub', state.sub);
    if (state.status) qp.set('status', state.status);
    if (state.view !== 'karten') qp.set('view', state.view);
    const qs = qp.toString();
    history.replaceState(null, '', '#/app/projects' + (qs ? '?' + qs : ''));
  }

  function wire() {
    mount.querySelectorAll('[data-phase]').forEach(btn =>
      btn.addEventListener('click', () => { state.phase = btn.dataset.phase; syncHash(); draw(); }));
    mount.querySelectorAll('[data-sub]').forEach(btn =>
      btn.addEventListener('click', () => { state.sub = btn.dataset.sub; syncHash(); draw(); }));
    mount.querySelectorAll('[data-status]').forEach(btn =>
      btn.addEventListener('click', () => { state.status = btn.dataset.status; syncHash(); draw(); }));
    mount.querySelectorAll('[data-view]').forEach(btn =>
      btn.addEventListener('click', () => { state.view = btn.dataset.view; syncHash(); draw(); }));
  }

  draw();
}

// ---- detail -------------------------------------------------------------

function detail(ctx, id) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  const p = core.project(id);
  if (!p) {
    mount.innerHTML = `<div class="container section">${C.empty('Projekt nicht gefunden.')}<a href="#/app/projects">Zur Übersicht</a></div>`;
    return;
  }
  setTitle(p.name);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' }, { label: 'Anwendungen', href: '#/applications' },
    { label: 'Bauprojekte / EPPM', href: '#/app/projects' },
    { label: p.name },
  ]);

  const b = core.building(p.buildingId);
  const tabs = [
    ['uebersicht', 'Übersicht'],
    ['kennzahlen', 'Kennzahlen'],
    ['risiken', 'Risiken & Ziele'],
  ];
  let active = query.get('tab') || 'uebersicht';
  if (!tabs.some(([t]) => t === active)) active = 'uebersicht';

  function panelUebersicht() {
    return `<dl class="kv">
      <dt>Projektnummer</dt><dd>${C.escape(p.projectNumber)}</dd>
      <dt>Gebäude</dt><dd>${b ? `<a href="#/app/portfolio/${b.bbl_id}">${C.escape(b.name)}</a>` : '—'}</dd>
      <dt>Projektleitung</dt><dd>${C.escape(p.pm || '—')}</dd>
      <dt>Teilportfolio</dt><dd>${C.escape(p.subPortfolio || '—')}</dd>
      <dt>SIA-Phase</dt><dd>${C.escape(p.siaPhase)} · ${C.escape(p.siaPhaseLabel)}</dd>
      <dt>BIM-Level</dt><dd>${C.escape(p.bimLevel || '—')}</dd>
      <dt>Start</dt><dd>${C.escape(p.start || '—')}</dd>
      <dt>Ende</dt><dd>${C.escape(p.end || '—')}</dd>
    </dl>
    <p class="mt-6">${C.escape(p.teaser || '')}</p>`;
  }

  function panelKennzahlen() {
    return `<div class="stats">
      <div class="stat"><div class="stat__num">${C.escape(chf(p.plannedTotalCost))}</div><div class="stat__label">Geplante Gesamtkosten</div></div>
      <div class="stat"><div class="stat__num">${C.escape(chf(p.bkp2))}</div><div class="stat__label">BKP 2 — Gebäude</div></div>
    </div>
    <dl class="kv mt-6">
      <dt>Geplante Gesamtkosten</dt><dd>${C.escape(chf(p.plannedTotalCost))}</dd>
      <dt>BKP 2 (Gebäude)</dt><dd>${C.escape(chf(p.bkp2))}</dd>
      <dt>SIA-Phase</dt><dd>${C.escape(p.siaPhase)} · ${C.escape(p.siaPhaseLabel)}</dd>
      <dt>Laufzeit</dt><dd>${C.escape(p.start || '—')} – ${C.escape(p.end || '—')}</dd>
    </dl>`;
  }

  function panelRisiken() {
    const row = (icon, prefix, value, desc) => `
      <div class="box">
        <div class="row gap-sm">${C.icon(icon, 'icon--lg')}<strong>${C.escape(prefix)}</strong> ${ampelBadge(C, prefix === 'Projektziele' ? 'Ziele' : 'Risiko', value)}</div>
        <p class="small muted mt-2" style="margin-top:.5rem">${C.escape(desc)}</p>
      </div>`;
    const zielDesc = {
      gruen: 'Projektziele (Termine, Kosten, Qualität) werden voraussichtlich erreicht.',
      gelb: 'Projektziele unter Beobachtung — einzelne Abweichungen möglich.',
      rot: 'Projektziele gefährdet — Massnahmen erforderlich.',
    }[p.zielAmpel] || 'Keine Bewertung verfügbar.';
    const risikoDesc = {
      gruen: 'Keine wesentlichen Risiken identifiziert.',
      gelb: 'Mittlere Risiken — werden aktiv überwacht.',
      rot: 'Hohe Risiken — eskaliert, Steuerung durch Projektleitung.',
    }[p.risikoAmpel] || 'Keine Bewertung verfügbar.';
    return `<div class="grid grid--2">
      ${row('CheckmarkCircle', 'Projektziele', p.zielAmpel, zielDesc)}
      ${row('WarningCircle', 'Risiken', p.risikoAmpel, risikoDesc)}
    </div>
    ${C.notification('Ampelbewertung gemäss BBL-Projektreporting (Demo-Daten): <strong>Grün</strong> = im Plan, <strong>Gelb</strong> = unter Beobachtung, <strong>Rot</strong> = kritisch.', 'info')}`;
  }

  const panels = { uebersicht: panelUebersicht, kennzahlen: panelKennzahlen, risiken: panelRisiken };

  function draw() {
    mount.innerHTML = `
    <div class="container section">
      ${C.backLink('#/app/projects', 'Alle Bauprojekte')}
      <div class="mt-4">
        <div class="pill-row">
          ${projectStatusBadge(C, core, p.status)}
          ${ampelBadge(C, 'Projektziele', p.zielAmpel)}
          ${ampelBadge(C, 'Risiken', p.risikoAmpel)}
        </div>
        <h1 tabindex="-1" class="mt-2">${C.escape(p.name)}</h1>
        <p class="muted">${C.escape(p.projectNumber)} · ${b ? C.escape(b.name + ', ' + b.city) : C.escape(p.buildingId)}</p>
      </div>
      ${C.photo({
        id: b?.photo, color: '#2f4356', alt: b ? `${p.name} — ${b.name}` : p.name, w: 1600,
        style: 'aspect-ratio:21/9;max-height:22rem;border-radius:var(--radius-lg);margin-top:1rem',
      })}
      <div class="tab__controls mt-6" role="tablist" aria-label="Projektdetails">
        ${tabs.map(([t, label]) => `<button type="button" role="tab" class="tab__control${active === t ? " tab__control--active" : ""}" aria-selected="${active === t}" data-tab="${t}">${C.escape(label)}</button>`).join('')}
      </div>
      ${tabs.map(([t]) => `<div class="tab__container" data-panel="${t}"${active === t ? '' : ' hidden'}>${panels[t]()}</div>`).join('')}
    </div>`;
    wire();
  }

  function wire() {
    mount.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
      active = btn.dataset.tab;
      mount.querySelectorAll('[data-tab]').forEach(b => {
        const on = b.dataset.tab === active;
        b.classList.toggle('tag-item--active', on);
        b.setAttribute('aria-selected', String(on));
      });
      mount.querySelectorAll('[data-panel]').forEach(pan => {
        pan.hidden = pan.dataset.panel !== active;
      });
      const qs = active === 'uebersicht' ? '' : '?tab=' + active;
      history.replaceState(null, '', `#/app/projects/${p.projectId}` + qs);
    }));
  }

  draw();
}
