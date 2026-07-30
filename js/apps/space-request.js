// Raumbedarf melden — the hero service flow (external → mock process → Meine Vorgänge).

// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
export const needs = ['buildings'];
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

  // Klartextnamen für die Fehlerübersicht. Die Schlüssel sind DOM-ids, damit die
  // Sprungmarken auflösen (Item 3.5).
  const FIELD_LABELS = {
    org: 'Verwaltungseinheit', cc: 'Kostenstelle',
    persons: 'Anzahl Personen / Arbeitsplätze', beg: 'Begründung',
  };

  // Gemeinsame Schrittanzeige (C.stepIndicator) — `current` ist 0-basiert (Item 3.10).
  const STEP_LABELS = ['Angaben', 'Bedarf', 'Prüfen & Absenden'];
  function stepsBar() {
    return C.stepIndicator(STEP_LABELS, state.step - 1, { label: 'Antragsschritte' });
  }

  function draw() {
    if (state.created) return drawDone();
    // Fokus + Schreibmarke über den Schrittwechsel bzw. den Fehler-Neuaufbau retten.
    const restore = C.preserveFocus(mount);
    mount.innerHTML = `
    <div class="container section container--grid">
      <div class="container__center--xs">
        ${C.backLink('#/services/raumbedarf-melden', 'Service-Beschreibung')}
        <h1 tabindex="-1">Raumbedarf melden</h1>
        <p class="muted">Antrag als <strong>${C.escape(state.org)}</strong> · Prozess: Eingang → Prüfung GS → Prüfung PFM → Entscheid.</p>
        ${stepsBar()}
        ${/* Stufe 2 der Gliederung: die Seite bot Hilfsmitteln ausser der <h1> keinen
              einzigen Sprungpunkt. sr-only, weil die CD-Schrittanzeige die Position
              schon sichtbar trägt — und Fokusziel beim Schrittwechsel, damit die
              Ansage «Schritt N von 3» aus dem Dokument selbst kommt. */''}
        <h2 class="sr-only" id="wiz-step-head" tabindex="-1">Schritt ${state.step} von 3: ${C.escape(STEP_LABELS[state.step - 1])}</h2>
        ${state.step < 3 ? '<p class="small muted">Mit <span class="text--asterisk" aria-hidden="true"></span> markierte Felder sind Pflichtfelder.</p>' : ''}
        ${C.errorSummary({ errors: state.errors, labels: FIELD_LABELS })}
        <!-- novalidate: ohne das Attribut bricht die HTML-Constraint-Validierung
             die Absendung ab, BEVOR das submit-Event feuert - validate() lief nie
             und die gesamte CD-Fehlerebene (.input--error / badge--error /
             aria-invalid / role=alert) war auf dem echten Nutzerpfad toter Code.
             required/aria-required bleiben auf den Feldern: sie tragen die
             Semantik fuer Screenreader und steuern die Pflichtfeld-Markierung. -->
        <form id="wiz" class="form" novalidate>${state.step === 1 ? step1() : state.step === 2 ? step2() : step3()}</form>
      </div>
    </div>`;
    wire();
    restore();
  }

  function step1() {
    return `
      ${C.field({ id: 'org', label: 'Verwaltungseinheit', required: true, message: state.errors.org,
        control: (cls, attrs) => `<input id="org" value="${C.escape(state.org)}" class="${cls}"${attrs}>` })}
      ${C.field({ id: 'cc', label: 'Kostenstelle', required: true, message: state.errors.cc,
        control: (cls, attrs) => `<input id="cc" placeholder="z. B. 810.123" value="${C.escape(state.costCenter)}" class="${cls}"${attrs}>` })}
      ${C.select({ id: 'bld', name: 'bld', label: 'Standort / Gebäude', value: state.buildingId,
        options: buildings.map(b => ({ value: b.bbl_id, label: `${b.name} — ${b.city}` })) })}
      ${C.field({ id: 'persons', label: 'Anzahl Personen / Arbeitsplätze', required: true, message: state.errors.persons,
        control: (cls, attrs) => `<input id="persons" type="number" min="1" value="${state.persons}" class="${cls}"${attrs}>` })}
      <div class="row row--end"><button class="btn btn--filled" type="submit">Weiter ${C.icon('ArrowRight', 'icon--base')}</button></div>`;
  }

  function step2() {
    return `
      ${C.select({ id: 'naw', name: 'naw', label: 'Arbeitswelt (NAW-Klasse)', value: state.nawClass,
        options: naw.map(n => ({ value: n.id, label: n.label })) })}
      <div class="notification notification--info">${C.icon('InfoCircle', 'icon--lg')}<div>Geschätzter Flächenbedarf: <strong>${area()} m² HNF</strong><br><span class="small">${state.persons} Arbeitsplätze × ${AREA_PER_WORKPLACE} m² × Desk-Sharing-Faktor ${dsf}</span></div></div>
      ${C.field({ id: 'termin', label: 'Gewünschter Termin',
        control: (cls, attrs) => `<input id="termin" type="date" value="${C.escape(state.termin)}" class="${cls}"${attrs}>` })}
      ${C.field({ id: 'beg', label: 'Begründung', required: true, message: state.errors.beg,
        control: (cls, attrs) => `<textarea id="beg" placeholder="Weshalb wird der zusätzliche Raum benötigt?" class="${cls}"${attrs}>${C.escape(state.begruendung)}</textarea>` })}
      <div class="row row--between"><button class="btn btn--bare" type="button" data-back>${C.icon('ChevronLeft', 'icon--base')} Zurück</button><button class="btn btn--filled" type="submit">Weiter ${C.icon('ArrowRight', 'icon--base')}</button></div>`;
  }

  function step3() {
    const b = core.building(state.buildingId);
    const n = naw.find(x => x.id === state.nawClass);
    return `
      ${/* h3, nicht h2: die Schrittüberschrift oben ist die h2 dieses Abschnitts. */''}
      <h3>Zusammenfassung</h3>
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
      <div class="row row--between"><button class="btn btn--bare" type="button" data-back>${C.icon('ChevronLeft', 'icon--base')} Zurück</button><button class="btn btn--filled btn--lg" type="submit">${C.icon('Checkmark', 'icon--base')} Antrag absenden</button></div>`;
  }

  function drawDone() {
    const i = state.created;
    mount.innerHTML = `
    <div class="container section container--grid">
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
      // Rohwert übernehmen, NICHT stillschweigend auf >=1 klemmen: `Math.max(1, …)`
      // schrieb die Eingabe des Nutzers um, sodass eine 0 oder ein Tippfehler
      // unbemerkt zu 1 wurde und validate() nie etwas zu meckern hatte (Item 3.15).
      state.persons = C.val(mount, 'persons');
    } else if (state.step === 2) {
      Object.assign(state, C.readForm(mount, { nawClass: 'naw', termin: 'termin', begruendung: 'beg' }));
    }
  }
  function validate() {
    const e = {};
    if (state.step === 1) {
      // Anweisende Formulierung wie in fault-report.js — nicht «Pflichtfeld».
      if (!state.org.trim()) e.org = 'Bitte Verwaltungseinheit angeben';
      if (!state.costCenter.trim()) e.cc = 'Bitte Kostenstelle angeben';
      const n = Number.parseInt(state.persons, 10);
      if (!Number.isFinite(n) || n < 1) e.persons = 'Bitte eine Anzahl ab 1 angeben';
      else if (n > 5000) e.persons = 'Bitte einen Wert bis 5000 angeben';
      else state.persons = n;   // erst nach erfolgreicher Prüfung normalisieren
      // `bld` (Standort) wird von C.select OHNE required gerendert und ist damit
      // bewusst optional — hier absichtlich nicht geprüft, damit Markup und
      // Validierung dieselbe Menge beschreiben.
    } else if (state.step === 2) {
      if (!state.begruendung.trim()) e.beg = 'Bitte begründen Sie den Bedarf';
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
      // Fehlversuch: neu zeichnen, dann Fokus auf die Fehlerübersicht — sonst
      // landet er auf <body> und der Nutzer erfährt nichts (WCAG 3.3.1).
      if (!validate()) { draw(); C.wireErrorSummary(mount); return; }
      if (state.step < 3) { state.step += 1; draw(); focusStepHeading(); return; }
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
    if (back) back.addEventListener('click', () => { readStep(); state.step -= 1; draw(); focusStepHeading(); });
    // `#persons` wird hier gebunden, weil der Wert die Flächenschätzung in Schritt 2
    // speist (der frühere Kommentar behauptete das Gegenteil direkt über dem Code).
    const personsEl = mount.querySelector('#persons');
    // Rohwert halten (siehe readStep) — die Prüfung meldet Ungültiges, statt es
    // stillschweigend zu korrigieren.
    if (personsEl) personsEl.addEventListener('input', () => { state.persons = personsEl.value; });
    // Fehlermeldung verschwindet, sobald der Nutzer das Feld korrigiert (Item 3.6).
    Object.keys(state.errors).forEach((id) => {
      const el = mount.querySelector('#' + id);
      if (!el) return;
      el.addEventListener('input', () => {
        if (!state.errors[id]) return;
        delete state.errors[id];
        el.classList.remove('input--error');
        el.removeAttribute('aria-invalid');
        const msg = mount.querySelector('#' + id + '-msg');
        if (msg) msg.remove();
      }, { once: true });
    });
  }

  // Schrittwechsel ist ein Kontextwechsel: Fokus auf die Seitenüberschrift, damit
  // Screenreader den neuen Schritt ansagen (bisher war er völlig still).
  function focusStepHeading() {
    const h = mount.querySelector('#wiz-step-head') || mount.querySelector('h1');
    if (h) h.focus({ preventScroll: true });
    C.announce(`Schritt ${state.step} von 3`);
  }

  draw();
}
