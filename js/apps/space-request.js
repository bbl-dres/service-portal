// Raumbedarf melden — the hero service flow (external → mock process → Meine Vorgänge).
export default async function render(ctx) {
  const { mount, core, engine, session, C, setTitle, setCrumbs, navigate } = ctx;
  setTitle('Raumbedarf melden');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen', href: '#/services' }, { label: 'Raumbedarf melden' }]);

  const buildings = core.buildings();
  const naw = core.ref().nawClasses || [];
  const dsf = core.ref().deskSharingFactor || 0.8;
  const AREA_PER_WORKPLACE = 12;

  const state = {
    step: 1,
    org: session.user().org,
    costCenter: '',
    buildingId: buildings[0] ? buildings[0].bbl_id : '',
    persons: 10,
    nawClass: naw[1] ? naw[1].id : (naw[0] && naw[0].id),
    termin: '',
    begruendung: '',
    created: null,
    errors: {},
  };

  const area = () => Math.round(state.persons * AREA_PER_WORKPLACE * dsf);

  function stepsBar() {
    const labels = ['Angaben', 'Bedarf', 'Prüfen & Absenden'];
    return `<ol class="steps">${labels.map((l, idx) => {
      const n = idx + 1;
      const done = state.step > n, active = state.step === n;
      const dot = done ? ' step__indicator-step--confirmed' : active ? ' step__indicator-step--active' : '';
      return `<li class="${done ? 'done' : active ? 'active' : ''}"${active ? ' aria-current="step"' : ''}><span class="step__indicator-step${dot}">${done ? C.icon('CheckmarkBold', 'icon--sm') : n}</span> ${l}</li>`;
    }).join('')}</ol>`;
  }

  function draw() {
    if (state.created) return drawDone();
    mount.innerHTML = `
    <div class="container section">
      <div class="container__center--xs">
        ${C.backLink('#/services/raumbedarf-melden', 'Service-Beschreibung')}
        <h1 tabindex="-1">Raumbedarf melden</h1>
        <p class="muted">Antrag als <strong>${C.escape(state.org)}</strong> · Prozess: Eingang → Prüfung GS → Prüfung PFM → Entscheid.</p>
        ${stepsBar()}
        <form id="wiz" class="form">${state.step === 1 ? step1() : state.step === 2 ? step2() : step3()}</form>
      </div>
    </div>`;
    wire();
  }

  function field(id, label, control, err, hint) {
    const required = /class="req"/.test(label);
    const clean = label.replace(/\s*<span class="req">\*<\/span>/, '');
    const ids = [hint ? `${id}-hint` : '', err ? `${id}-err` : ''].filter(Boolean).join(' ');
    const attrs = `${required ? ' required aria-required="true"' : ''}${err ? ' aria-invalid="true"' : ''}${ids ? ` aria-describedby="${ids}"` : ''}`;
    const ctrl = control
      .replace(/<(input|select|textarea)\b([^>]*?)>/, (m, tag, a) => `<${tag}${a}${attrs}>`)
      .replace(/<(input|select|textarea)\b([^>]*?)class="([^"]*)"/, (m, tag, a, cls) =>
        `<${tag}${a}class="${cls}${err ? ' input--error' : ''}"`);
    return `<div class="form__group__input">
      <label for="${id}"${required ? ' class="text--asterisk"' : ''}>${clean}${required ? '<span class="sr-only"> Pflichtfeld</span>' : ''}</label>
      ${ctrl}
      ${hint ? `<div class="badge badge--sm badge--info" id="${id}-hint">${hint}</div>` : ''}
      ${err ? `<div class="badge badge--sm badge--error" id="${id}-err" role="alert">${C.escape(err)}</div>` : ''}
    </div>`;
  }

  function step1() {
    return `
      ${field('org', 'Verwaltungseinheit <span class="req">*</span>', `<input id="org" value="${C.escape(state.org)}">`, state.errors.org)}
      ${field('cc', 'Kostenstelle <span class="req">*</span>', `<input id="cc" placeholder="z. B. 810.123" value="${C.escape(state.costCenter)}">`, state.errors.costCenter)}
      ${field('bld', 'Standort / Gebäude', `<div class="select"><select id="bld" class="input--outline input--base">${buildings.map(b => `<option value="${b.bbl_id}"${b.bbl_id === state.buildingId ? ' selected' : ''}>${C.escape(b.name)} — ${C.escape(b.city)}</option>`).join('')}</select><div class="select__icon">${C.chevron}</div></div>`)}
      ${field('persons', 'Anzahl Personen / Arbeitsplätze <span class="req">*</span>', `<input id="persons" type="number" min="1" value="${state.persons}">`, state.errors.persons)}
      <div class="row" style="justify-content:flex-end"><button class="btn btn--filled" type="submit">Weiter ${C.icon('ArrowRight', 'icon--base')}</button></div>`;
  }

  function step2() {
    return `
      ${field('naw', 'Arbeitswelt (NAW-Klasse)', `<div class="select"><select id="naw" class="input--outline input--base">${naw.map(n => `<option value="${n.id}"${n.id === state.nawClass ? ' selected' : ''}>${C.escape(n.label)}</option>`).join('')}</select><div class="select__icon">${C.chevron}</div></div>`)}
      <div class="notification notification--info">${C.icon('InfoCircle', 'icon--lg')}<div>Geschätzter Flächenbedarf: <strong>${area()} m² HNF</strong><br><span class="small">${state.persons} Arbeitsplätze × ${AREA_PER_WORKPLACE} m² × Desk-Sharing-Faktor ${dsf}</span></div></div>
      ${field('termin', 'Gewünschter Termin', `<input id="termin" type="date" value="${C.escape(state.termin)}">`)}
      ${field('beg', 'Begründung <span class="req">*</span>', `<textarea id="beg" placeholder="Weshalb wird der zusätzliche Raum benötigt?">${C.escape(state.begruendung)}</textarea>`, state.errors.begruendung)}
      <div class="row" style="justify-content:space-between"><button class="btn btn--bare" type="button" data-back>${C.icon('ChevronLeft', 'icon--base')} Zurück</button><button class="btn btn--filled" type="submit">Weiter ${C.icon('ArrowRight', 'icon--base')}</button></div>`;
  }

  function step3() {
    const b = core.building(state.buildingId);
    const n = naw.find(x => x.id === state.nawClass);
    return `
      <h2>Zusammenfassung</h2>
      <dl class="kv">
        <dt>Verwaltungseinheit</dt><dd>${C.escape(state.org)}</dd>
        <dt>Kostenstelle</dt><dd>${C.escape(state.costCenter)}</dd>
        <dt>Standort</dt><dd>${b ? C.escape(b.name + ', ' + b.city) : '—'}</dd>
        <dt>Arbeitsplätze</dt><dd>${state.persons}</dd>
        <dt>Arbeitswelt</dt><dd>${n ? C.escape(n.label) : '—'}</dd>
        <dt>Flächenbedarf</dt><dd>${area()} m² HNF</dd>
        <dt>Wunschtermin</dt><dd>${C.escape(state.termin || '—')}</dd>
        <dt>Begründung</dt><dd>${C.escape(state.begruendung)}</dd>
      </dl>
      ${C.notification('Mit dem Absenden wird ein Vorgang erstellt und an die Prüfung weitergeleitet. Sie können den Status unter <strong>Meine Vorgänge</strong> verfolgen.', 'info')}
      <div class="row" style="justify-content:space-between"><button class="btn btn--bare" type="button" data-back>${C.icon('ChevronLeft', 'icon--base')} Zurück</button><button class="btn btn--filled btn--lg" type="submit">${C.icon('Checkmark', 'icon--base')} Antrag absenden</button></div>`;
  }

  function drawDone() {
    const i = state.created;
    mount.innerHTML = `
    <div class="container section">
      <div class="container__center--xs">
        <div class="notification notification--success">${C.icon('CheckmarkCircle', 'icon--lg')}<div><strong>Antrag eingereicht.</strong> Ihre Referenz: <strong>${C.escape(i.reference)}</strong></div></div>
        <h1 tabindex="-1">Vielen Dank</h1>
        <p>Ihr Raumbedarf-Antrag wurde erfasst und an die Prüfung weitergeleitet. Den Status sehen Sie jederzeit unter «Meine Vorgänge».</p>
        <div class="row mt-4">
          <a class="btn btn--outline" href="#/my-cases/${i.instanceId}">Vorgang ansehen ${C.icon('ArrowRight', 'icon--base')}</a>
          <a class="btn btn--outline" href="#/services">Weitere Services</a>
        </div>
      </div>
    </div>`;
  }

  function readStep() {
    if (state.step === 1) {
      state.org = val('org'); state.costCenter = val('cc');
      state.buildingId = val('bld'); state.persons = Math.max(1, parseInt(val('persons'), 10) || 0);
    } else if (state.step === 2) {
      state.nawClass = val('naw'); state.termin = val('termin'); state.begruendung = val('beg');
    }
  }
  function validate() {
    const e = {};
    if (state.step === 1) {
      if (!state.org.trim()) e.org = 'Pflichtfeld';
      if (!state.costCenter.trim()) e.costCenter = 'Pflichtfeld';
      if (!state.persons || state.persons < 1) e.persons = 'Mindestens 1';
    } else if (state.step === 2) {
      if (!state.begruendung.trim()) e.begruendung = 'Bitte begründen Sie den Bedarf';
    }
    state.errors = e;
    return Object.keys(e).length === 0;
  }
  function val(id) { const el = mount.querySelector('#' + id); return el ? el.value : ''; }

  function wire() {
    const form = mount.querySelector('#wiz');
    if (!form) return;
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      readStep();
      if (!validate()) { draw(); return; }
      if (state.step < 3) { state.step += 1; draw(); return; }
      // submit
      const b = core.building(state.buildingId);
      state.created = engine.start('raumbedarf', {
        title: `Raumbedarf ${state.persons} AP — ${b ? b.name : ''}`.trim(),
        organization: state.org,
        requester: session.user().name,
        data: { costCenter: state.costCenter, persons: state.persons, naw: state.nawClass, area: area(), termin: state.termin, begruendung: state.begruendung },
        linkedEntities: state.buildingId ? { buildingId: state.buildingId } : {},
      });
      draw();
    });
    const back = mount.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => { readStep(); state.step -= 1; draw(); });
    // live area recompute on persons change while on step 2 is handled by re-draw; bind persons on step1 not needed
    const personsEl = mount.querySelector('#persons');
    if (personsEl) personsEl.addEventListener('input', () => { state.persons = Math.max(1, parseInt(personsEl.value, 10) || 0); });
  }

  draw();
}
