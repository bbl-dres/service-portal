// Raumbedarf melden — the hero service flow (external → mock process → Meine Vorgänge).
export default async function render(ctx) {
  const { mount, core, engine, session, C, setTitle, setCrumbs, navigate } = ctx;
  setTitle('Raumbedarf melden');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen', href: '#/services' }, { label: 'Raumbedarf melden' }]);

  // Persönlicher Vorgang — abgemeldet zum Login auffordern (der Zustand unten
  // liest session.user().org, würde also sonst beim Direktaufruf werfen).
  if (!session.isLoggedIn()) {
    mount.innerHTML = `
    <div class="container section">
      ${C.pageHeader({ title: 'Raumbedarf melden', lead: 'Ihr Bedarf an Räumen und Flächen — als persönlicher Vorgang erfasst.' })}
      ${C.loginGate('«Raumbedarf melden» erfasst Ihren Bedarf als Vorgang unter «Meine Vorgänge». Bitte melden Sie sich mit AGOV / FedLogin an, um eine Meldung zu erstellen.')}
    </div>`;
    return;
  }

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

  function step1() {
    return `
      ${C.field({ id: 'org', label: 'Verwaltungseinheit', required: true, message: state.errors.org,
        control: (cls, attrs) => `<input id="org" value="${C.escape(state.org)}" class="${cls}"${attrs}>` })}
      ${C.field({ id: 'cc', label: 'Kostenstelle', required: true, message: state.errors.costCenter,
        control: (cls, attrs) => `<input id="cc" placeholder="z. B. 810.123" value="${C.escape(state.costCenter)}" class="${cls}"${attrs}>` })}
      ${C.select({ id: 'bld', name: 'bld', label: 'Standort / Gebäude', value: state.buildingId,
        options: buildings.map(b => ({ value: b.bbl_id, label: `${b.name} — ${b.city}` })) })}
      ${C.field({ id: 'persons', label: 'Anzahl Personen / Arbeitsplätze', required: true, message: state.errors.persons,
        control: (cls, attrs) => `<input id="persons" type="number" min="1" value="${state.persons}" class="${cls}"${attrs}>` })}
      <div class="row" style="justify-content:flex-end"><button class="btn btn--filled" type="submit">Weiter ${C.icon('ArrowRight', 'icon--base')}</button></div>`;
  }

  function step2() {
    return `
      ${C.select({ id: 'naw', name: 'naw', label: 'Arbeitswelt (NAW-Klasse)', value: state.nawClass,
        options: naw.map(n => ({ value: n.id, label: n.label })) })}
      <div class="notification notification--info">${C.icon('InfoCircle', 'icon--lg')}<div>Geschätzter Flächenbedarf: <strong>${area()} m² HNF</strong><br><span class="small">${state.persons} Arbeitsplätze × ${AREA_PER_WORKPLACE} m² × Desk-Sharing-Faktor ${dsf}</span></div></div>
      ${C.field({ id: 'termin', label: 'Gewünschter Termin',
        control: (cls, attrs) => `<input id="termin" type="date" value="${C.escape(state.termin)}" class="${cls}"${attrs}>` })}
      ${C.field({ id: 'beg', label: 'Begründung', required: true, message: state.errors.begruendung,
        control: (cls, attrs) => `<textarea id="beg" placeholder="Weshalb wird der zusätzliche Raum benötigt?" class="${cls}"${attrs}>${C.escape(state.begruendung)}</textarea>` })}
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
      Object.assign(state, C.readForm(mount, { org: 'org', costCenter: 'cc', buildingId: 'bld' }));
      state.persons = Math.max(1, parseInt(C.val(mount, 'persons'), 10) || 0);
    } else if (state.step === 2) {
      Object.assign(state, C.readForm(mount, { nawClass: 'naw', termin: 'termin', begruendung: 'beg' }));
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
      if (!state.created) C.flashError(mount, 'Der Vorgang konnte nicht gespeichert werden — bitte erneut versuchen.');
    });
    const back = mount.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => { readStep(); state.step -= 1; draw(); });
    // live area recompute on persons change while on step 2 is handled by re-draw; bind persons on step1 not needed
    const personsEl = mount.querySelector('#persons');
    if (personsEl) personsEl.addEventListener('input', () => { state.persons = Math.max(1, parseInt(personsEl.value, 10) || 0); });
  }

  draw();
}
