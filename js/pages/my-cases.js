// Meine Vorgänge — running cases (driven by the mock process engine).
export default async function render(ctx) {
  const { mount, params, core, engine, C, setTitle, setCrumbs } = ctx;
  if (params[0]) return detail(ctx, params[0]);

  setTitle('Meine Vorgänge');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Meine Vorgänge' }]);

  const all = engine.instances();
  const openCount = all.filter(i => !['abgeschlossen', 'erledigt', 'geliefert'].includes(i.status)).length;

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({ title: 'Meine Vorgänge', lead: 'Status aller von Ihnen ausgelösten Anfragen und Bestellungen.' })}
    <div class="stats mt-4" style="max-width:34rem">
      <div class="stat"><div class="stat__num">${all.length}</div><div class="stat__label">Vorgänge total</div></div>
      <div class="stat"><div class="stat__num">${openCount}</div><div class="stat__label">offen / in Arbeit</div></div>
    </div>
    <div class="mt-6">${C.table({
      zebra: true,
      columns: [
        { key: 'reference', label: 'Referenz', render: r => `<a href="#/my-cases/${r.instanceId}">${C.escape(r.reference)}</a>` },
        { key: 'title', label: 'Titel', render: r => C.escape(r.title) },
        { key: 'defName', label: 'Typ', render: r => C.escape(r.defName) },
        { key: 'updatedAt', label: 'Aktualisiert', render: r => C.escape(r.updatedAt || r.createdAt) },
        { key: 'status', label: 'Status', render: r => C.statusBadge(r.status, sLabel(core, r.status)) },
      ],
      rows: all,
    })}</div>
  </div>`;
}

function detail(ctx, id) {
  const { mount, core, engine, C, setTitle, setCrumbs } = ctx;
  const i = engine.instance(id);
  if (!i) { mount.innerHTML = `<div class="container section">${C.empty('Vorgang nicht gefunden.')}<a href="#/my-cases">Zurück</a></div>`; return; }
  setTitle(i.reference);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Meine Vorgänge', href: '#/my-cases' }, { label: i.reference }]);

  const def = engine.definition(i.defId);
  const steps = def ? def.steps : [];
  const b = i.linkedEntities && i.linkedEntities.buildingId ? core.building(i.linkedEntities.buildingId) : null;
  const p = i.linkedEntities && i.linkedEntities.projectId ? core.project(i.linkedEntities.projectId) : null;
  const canAdvance = i.createdLocally && def && i.stepIndex < steps.length - 1;

  const pipeline = steps.map((st, idx) => {
    const cls = idx < i.stepIndex ? 'done' : idx === i.stepIndex ? 'current' : '';
    return `<li class="${cls}"><strong>${C.escape(st.label)}</strong>${st.role ? `<br><span class="small muted">${C.escape(st.role)}</span>` : ''}</li>`;
  }).join('');

  const history = (i.history || []).map(h => `<li class="done"><strong>${C.escape(h.status)}</strong> <span class="when">${C.escape(h.when)}</span><br><span class="small muted">${C.escape(h.note || '')}</span></li>`).join('');

  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/my-cases', 'Meine Vorgänge')}
    <div class="split mt-4">
      <div class="stack-lg">
        <div>
          <div class="row gap-sm">${C.statusBadge(i.status, sLabel(core, i.status))} <span class="small muted">${C.escape(i.reference)}</span></div>
          <h1 tabindex="-1">${C.escape(i.title)}</h1>
          <p class="muted">${C.escape(i.defName)} · erstellt ${C.escape(i.createdAt)} · ${C.escape(i.organization || '')}</p>
        </div>
        <div>
          <h2>Prozess</h2>
          <ul class="timeline">${pipeline}</ul>
          ${canAdvance ? `<button class="btn btn--filled" id="advance">${C.icon('ArrowRight', 'icon--base')} Nächster Schritt (Demo)</button>` : (i.createdLocally ? '<p class="small muted">Vorgang abgeschlossen.</p>' : '<p class="small muted">Seed-Vorgang (Demo) — nicht weiterführbar.</p>')}
        </div>
        <div>
          <h2>Verlauf</h2>
          <ul class="timeline">${history}</ul>
        </div>
      </div>
      <aside class="stack-lg">
        ${b ? `<div class="box"><h3>Verknüpftes Gebäude</h3><a href="#/app/portfolio/${b.bbl_id}">${C.escape(b.name)}</a><br><span class="small muted">${C.escape(b.street)}, ${C.escape(b.city)}</span></div>` : ''}
        ${p ? `<div class="box"><h3>Verknüpftes Projekt</h3><a href="#/app/projects/${p.projectId}">${C.escape(p.name)}</a><br><span class="small muted">${C.escape(p.projectNumber)}</span></div>` : ''}
        <div class="box"><h3>Referenz</h3><p style="margin:0"><strong>${C.escape(i.reference)}</strong></p><p class="small muted">Diese Referenz gilt für Rückfragen.</p></div>
      </aside>
    </div>
  </div>`;

  const adv = mount.querySelector('#advance');
  if (adv) adv.addEventListener('click', () => { engine.advance(i.instanceId); location.reload(); });
}

function sLabel(core, id) { const m = (core.ref().statusModel || []).find(s => s.id === id); return m ? m.label : id; }
