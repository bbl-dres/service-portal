// Space-demand request: external service entry, mock process, and persisted case.
import * as links from '../links.js';
import { SERVICES, trail } from '../crumbs.js';

// Declare deferred datasets so the router calls core.ensure(needs) before render
// instead of exposing an empty inventory.
export const needs = ['buildings'];

// Application-specific copy shown by the router's authentication gate.
export const loginText = "«Raumbedarf melden» erfasst Ihren Bedarf als Vorgang unter «Meine Vorgänge». Bitte melden Sie sich mit AGOV / FedLogin an, um den Antrag zu erstellen.";
export default async function render(ctx) {
  const { mount, query, core, engine, session, C, setTitle, setCrumbs, navigate } = ctx;
  setTitle('Raumbedarf melden');
  setCrumbs(trail(SERVICES, { label: 'Raumbedarf melden' }));

  const buildings = core.buildings();
  const naw = core.ref().nawClasses || [];
  const dsf = core.ref().deskSharingFactor || 0.8;
  const AREA_PER_WORKPLACE = 12;

  // Prefill a calling portal's building only when its ID exists. Invalid or stale
  // deep links fall back to the established first-building behaviour.
  const requestedBuildingId = query.get('building');
  const requestedBuilding = requestedBuildingId
    && buildings.some((building) => building.bbl_id === requestedBuildingId);

  const state = {
    step: 1,
    org: session.user().org,
    costCenter: '',
    buildingId: requestedBuilding ? requestedBuildingId : (buildings[0] ? buildings[0].bbl_id : ''),
    persons: 10,
    nawClass: naw[1] ? naw[1].id : (naw[0] && naw[0].id),
    requestedDate: '',
    justification: '',
    created: null,
    errors: {},
  };

  const area = () => Math.round(state.persons * AREA_PER_WORKPLACE * dsf);

  // Human-readable error-summary labels are keyed by DOM IDs so links resolve.
  const FIELD_LABELS = {
    org: 'Verwaltungseinheit', cc: 'Kostenstelle',
    persons: 'Anzahl Personen / Arbeitsplätze', justification: 'Begründung',
  };

  const STEP_LABELS = ['Angaben', 'Bedarf', 'Prüfen & Absenden'];

  function draw() {
    if (state.created) return drawDone();
    // Preserve focus and selection across step changes and failed redraws.
    const restore = C.preserveFocus(mount);
    mount.innerHTML = `
    <div class="container section container--grid">
      <div class="container__center--xs">
        ${C.backLink(links.service('raumbedarf-melden'), 'Dienstleistungsbeschreibung')}
        <h1 tabindex="-1">Raumbedarf melden</h1>
        ${C.contextLine({ action: 'Antrag', name: session.user().name, org: state.org, process: 'Eingang → Prüfung GS → Prüfung PFM → Entscheid' })}
        ${/* Shared wizard structure combines progress and the visually hidden step heading. */''}
        ${C.wizardHead(STEP_LABELS, state.step, { legend: state.step < 3 })}
        ${C.errorSummary({ errors: state.errors, labels: FIELD_LABELS })}
        <!-- novalidate keeps custom validation reachable while required and
             aria-required preserve control semantics. -->
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
      ${/* form__actions keeps the primary mobile action first and full width. */''}
      <div class="form__actions"><button class="btn btn--filled btn--icon-right" type="submit">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Weiter</span></button></div>`;
  }

  function step2() {
    return `
      ${C.select({ id: 'naw', name: 'naw', label: 'Arbeitswelt (NAW-Klasse)', value: state.nawClass,
        options: naw.map(n => ({ value: n.id, label: n.label })) })}
      ${C.notification(`Geschätzter Flächenbedarf: <strong>${area()} m² HNF</strong><br><span class="small">${state.persons} Arbeitsplätze × ${AREA_PER_WORKPLACE} m² × Desk-Sharing-Faktor ${dsf}</span>`, 'info', 'InfoCircle')}
      ${C.field({ id: 'requested-date', label: 'Gewünschter Termin',
        control: (cls, attrs) => `<input id="requested-date" type="date" value="${C.escape(state.requestedDate)}" class="${cls}"${attrs}>` })}
      ${C.field({ id: 'justification', label: 'Begründung', required: true, message: state.errors.justification,
        control: (cls, attrs) => `<textarea id="justification" placeholder="Weshalb wird der zusätzliche Raum benötigt?" class="${cls}"${attrs}>${C.escape(state.justification)}</textarea>` })}
      <div class="form__actions form__actions--between"><button class="btn btn--bare btn--icon-left" type="button" data-back>${C.icon('ChevronLeft', 'btn__icon')}<span class="btn__text">Zurück</span></button><button class="btn btn--filled btn--icon-right" type="submit">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Weiter</span></button></div>`;
  }

  function step3() {
    const b = core.building(state.buildingId);
    const n = naw.find(x => x.id === state.nawClass);
    return `
      ${/* Use h3 because the wizard step heading is this section's h2. */''}
      <h3>Zusammenfassung</h3>
      <dl class="kv">
        <dt>Verwaltungseinheit</dt><dd>${C.escape(state.org)}</dd>
        <dt>Kostenstelle</dt><dd>${C.escape(state.costCenter)}</dd>
        <dt>Standort</dt><dd>${b ? C.escape(b.name + ', ' + b.city) : '—'}</dd>
        <dt>Arbeitsplätze</dt><dd>${state.persons}</dd>
        <dt>Arbeitswelt</dt><dd>${n ? C.escape(n.label) : '—'}</dd>
        <dt>Flächenbedarf</dt><dd>${area()} m² HNF</dd>
        <dt>Wunschtermin</dt><dd>${C.escape(state.requestedDate || '—')}</dd>
        <dt>Begründung</dt><dd>${C.escape(state.justification)}</dd>
      </dl>
      ${C.notification('Mit dem Absenden wird ein Vorgang erstellt und an die Prüfung weitergeleitet. Sie können den Status unter <strong>Meine Vorgänge</strong> verfolgen.', 'info')}
      <div class="form__actions form__actions--between"><button class="btn btn--bare btn--icon-left" type="button" data-back>${C.icon('ChevronLeft', 'btn__icon')}<span class="btn__text">Zurück</span></button><button class="btn btn--filled btn--lg btn--icon-left" type="submit">${C.icon('Checkmark', 'btn__icon')}<span class="btn__text">Antrag absenden</span></button></div>`;
  }

  function drawDone() {
    const i = state.created;
    mount.innerHTML = `
    <div class="container section container--grid">
      <div class="container__center--xs">
        ${C.processDone({ instance: i, lead: 'Antrag eingereicht.', title: 'Vielen Dank',
          text: 'Ihr Raumbedarf-Antrag wurde erfasst und an die Prüfung weitergeleitet. Den Status sehen Sie jederzeit unter «Meine Vorgänge».',
          actions: [
            { href: links.caseDetails(i.instanceId), label: 'Vorgang ansehen', icon: 'ArrowRight' },
            { href: '#/services', label: 'Zu den Dienstleistungen' },
          ] })}
      </div>
    </div>`;
    // Focus the success heading and announce the reference through the shared helper.
    C.focusProcessDone(mount, i);
  }

  function readStep() {
    if (state.step === 1) {
      Object.assign(state, C.readForm(mount, { org: 'org', costCenter: 'cc', buildingId: 'bld' }));
      // Preserve the raw value instead of clamping it to at least one. Validation
      // must expose zero, empty, and nonnumeric input rather than silently changing it.
      state.persons = C.val(mount, 'persons');
    } else if (state.step === 2) {
      Object.assign(state, C.readForm(mount, { nawClass: 'naw', requestedDate: 'requested-date', justification: 'justification' }));
    }
  }
  function validate() {
    const e = {};
    if (state.step === 1) {
      // Use actionable validation copy instead of a generic required-field label.
      if (!state.org.trim()) e.org = 'Bitte die Verwaltungseinheit angeben';
      if (!state.costCenter.trim()) e.cc = 'Bitte die Kostenstelle angeben';
      const n = Number.parseInt(state.persons, 10);
      if (!Number.isFinite(n) || n < 1) e.persons = 'Bitte eine Anzahl ab 1 angeben';
      else if (n > 5000) e.persons = 'Bitte einen Wert bis 5000 angeben';
      else state.persons = n;   // Normalize only after validation succeeds.
      // bld is intentionally optional in both C.select markup and validation.
    } else if (state.step === 2) {
      if (!state.justification.trim()) e.justification = 'Bitte begründen Sie den Bedarf';
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
      // Redraw a failed attempt, then focus the error summary so focus does not
      // fall back to body (WCAG 3.3.1).
      if (!validate()) { draw(); C.wireErrorSummary(mount); return; }
      if (state.step < 3) { state.step += 1; draw(); C.focusWizardStep(mount, STEP_LABELS, state.step); return; }
      // Submit the completed request.
      const b = core.building(state.buildingId);
      state.created = engine.start('raumbedarf', {
        title: `Raumbedarf ${state.persons} AP — ${b ? b.name : ''}`.trim(),
        organization: state.org,
        requester: session.user().name,
        data: { costCenter: state.costCenter, persons: state.persons, naw: state.nawClass, area: area(), 'termin': state.requestedDate, 'begruendung': state.justification },
        linkedEntities: state.buildingId ? { buildingId: state.buildingId } : {},
      });
      draw();
      if (!state.created) C.flashError(mount, 'Der Vorgang konnte nicht gespeichert werden — bitte erneut versuchen.');
    });
    const back = mount.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => { readStep(); state.step -= 1; draw(); C.focusWizardStep(mount, STEP_LABELS, state.step); });
    // Bind #persons here because it drives the step-two area estimate.
    const personsEl = mount.querySelector('#persons');
    // Keep the raw value so validation reports invalid input instead of correcting it.
    if (personsEl) personsEl.addEventListener('input', () => { state.persons = personsEl.value; });
    // Remove a field error immediately after the user corrects its value.
    C.wireFieldErrors(mount, state.errors);
  }

  draw();
}
