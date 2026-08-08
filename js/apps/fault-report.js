// Single-step report form that creates a case. Stable ?type= compatibility
// values select security, complaint, small-order, and move variants; the default
// covers faults, cleaning, and repairs. Small orders share the central OM helpdesk.
import * as links from '../links.js';
import { SERVICES, trail } from '../crumbs.js';

// Deferred datasets are declared so the router calls core.ensure(needs) before
// render; otherwise accessors would read an empty inventory.
export const needs = ['buildings', 'contacts'];

// Application-specific copy shown by the router's authentication gate.
export const loginText = "Diese Meldung wird als persönlicher Vorgang unter «Meine Vorgänge» erfasst. Bitte melden Sie sich mit AGOV / FedLogin an, um sie abzusenden.";
export default async function render(ctx) {
  const { mount, query, core, engine, session, C, setTitle, setCrumbs } = ctx;

  // serviceId identifies the data/services.json entry, so Back and Cancel return
  // to the selected service detail rather than the hub.
  const TYPES = {
    sicherheit: {
      title: 'Sicherheits-/Datenschutzvorfall melden',
      defId: 'sicherheitsvorfall',
      serviceId: 'sicherheitsvorfall-melden',
      label: 'Sicherheits-/Datenschutzvorfall',
      categories: ['Informationssicherheit', 'Datenschutz'],
      lead: 'Melden Sie einen Vorfall der Informationssicherheit oder des Datenschutzes an die Fachstelle ISBO.',
    },
    reklamation: {
      title: 'Reklamationsmeldung',
      defId: 'stoerung',
      serviceId: 'reklamation',
      label: 'Reklamation',
      categories: ['Reklamation'],
      lead: 'Erfassen Sie eine Reklamation zu Liegenschaften, Betrieb oder Dienstleistungen.',
    },
    kleinauftrag: {
      // Use the catalogue title, including its verb, as the page heading.
      title: 'Kleinauftrag am Gebäude erteilen',
      defId: 'stoerung',
      serviceId: 'kleinauftrag-gebaeude',
      label: 'Kleinauftrag',
      categories: ['Bauliche Anpassung', 'Möblierung', 'Beschilderung'],
      lead: 'Beauftragen Sie eine kleinere bauliche Anpassung ausserhalb eines Bauprojekts.',
    },
    umzug: {
      title: 'Umzug, Transport & Entsorgung',
      defId: 'stoerung',
      serviceId: 'umzug-anmelden',
      label: 'Umzug / Transport / Entsorgung',
      categories: ['Umzug', 'Transport', 'Entsorgung'],
      lead: 'Beauftragen Sie einen Umzug, einen Transport oder eine Entsorgung.',
    },
    default: {
      title: 'Störungs-, Reinigungs- & Reparaturmeldung',
      defId: 'stoerung',
      serviceId: 'stoerung-melden',
      label: 'Störungsmeldung',
      categories: ['Störung', 'Reinigung', 'Reparatur'],
      lead: 'Melden Sie eine Störung, einen Reinigungs- oder Reparaturbedarf am Objekt.',
    },
  };

  const requestedType = query.get('type');
  const typeKey = requestedType && Object.hasOwn(TYPES, requestedType) ? requestedType : 'default';
  const cfg = TYPES[typeKey];
  const isSecurity = typeKey === 'sicherheit';

  setTitle(cfg.title);
  setCrumbs(trail(SERVICES, { label: cfg.title }));

  const buildings = core.buildings();
  const isbo = core.contacts().find(c => c.contactId === 'isbo');

  // ?building=<bbl_id>&room=<room-number> prefills links from the tenancy floor
  // plan. Ignore unknown IDs so controls never contain values absent from their options.
  const requestedBuildingId = query.get('building');
  const hasRequestedBuilding = requestedBuildingId && buildings.some((b) => b.bbl_id === requestedBuildingId);

  const state = {
    // Keep the required building select empty unless a valid ?building deep link
    // supplies a value; an implicit first option would make required ineffective.
    buildingId: hasRequestedBuilding ? requestedBuildingId : '',
    locationDetail: query.get('room') || '',
    category: cfg.categories[0] || '',
    description: '',
    urgency: 'normal',
    errors: {},
    created: null,
  };

  // Human-readable error-summary labels are keyed by DOM IDs so links resolve.
  const FIELD_LABELS = { bld: 'Gebäude / Standort', description: 'Beschreibung' };

  function draw() {
    if (state.created) return drawDone();

    // A genuine empty first option allows required building validation to fail.
    const buildingOpts = [{ value: '', label: 'Bitte wählen…' },
      ...buildings.map(b => ({ value: b.bbl_id, label: `${b.name} — ${b.city}` }))];
    const categoryOpts = cfg.categories.map(c => ({ value: c, label: c }));
    const urgencyOptions = [
      { value: 'normal', label: 'Normal' },
      { value: 'hoch', label: 'Hoch' },
    ];

    const securityNote = isSecurity ? `
      ${C.notification(`<strong>Bei akuter Gefahr: Alarmzentrale +41 58 465 65 65</strong><br>Lebensbedrohliche Lagen sofort telefonisch melden – nicht über dieses Formular.`, 'warning', 'WarningCircle')}
      ${isbo ? C.notification(`Fachstelle <strong>${C.escape(isbo.name)}</strong> · <a href="mailto:${C.escape(isbo.email)}">${C.escape(isbo.email)}</a> · ${C.escape(isbo.phone)}`, 'info', 'Lock') : ''}
    ` : '';

    // Preserve focus and selection across redraws.
    const restore = C.preserveFocus(mount);
    mount.innerHTML = `
    <div class="container section container--grid">
      <div class="container__center--xs">
      ${C.backLink(links.service(cfg.serviceId), 'Dienstleistungsbeschreibung')}
      <h1 tabindex="-1">${C.escape(cfg.title)}</h1>
      <p class="lead">${C.escape(cfg.lead)}</p>
      ${C.contextLine({ action: 'Meldung', name: session.user().name, org: session.user().org })}
      ${securityNote}
      <!-- novalidate keeps the submit event available to the custom validator. -->
      <h2 class="sr-only">Meldung erfassen</h2>
      <p class="small muted">Mit <span class="text--asterisk" aria-hidden="true"></span> markierte Felder sind Pflichtfelder.</p>
      ${C.errorSummary({ errors: state.errors, labels: FIELD_LABELS })}
      <form id="report-form" class="form mt-6" novalidate>
        ${buildings.length
          ? C.select({ id: 'bld', name: 'bld', label: 'Gebäude / Standort', required: true,
              value: state.buildingId, message: state.errors.bld, options: buildingOpts })
          : C.field({ id: 'bld', label: 'Gebäude / Standort', required: true, message: state.errors.bld,
              control: (cls, attrs) => `<input id="bld" value="" placeholder="Kein Gebäude verfügbar" disabled class="${cls}"${attrs}>` })}
        ${C.field({ id: 'location-detail', label: 'Ort (Stockwerk / Raum)', hint: 'Optional – hilft bei der Lokalisierung.',
          control: (cls, attrs) => `<input id="location-detail" placeholder="z. B. 3. OG, Raum 312" value="${C.escape(state.locationDetail)}" class="${cls}"${attrs}>` })}
        ${C.select({ id: 'cat', name: 'cat', label: 'Kategorie', value: state.category, options: categoryOpts })}
        ${C.field({ id: 'description', label: 'Beschreibung', required: true, message: state.errors.description,
          control: (cls, attrs) => `<textarea id="description" placeholder="Beschreiben Sie den Sachverhalt möglichst genau." class="${cls}"${attrs}>${C.escape(state.description)}</textarea>` })}
        ${C.select({ id: 'urgency', name: 'urgency', label: 'Dringlichkeit', value: state.urgency, options: urgencyOptions })}
        ${C.notification('Mit dem Absenden wird ein Vorgang erstellt. Sie können den Status jederzeit unter <strong>Meine Vorgänge</strong> verfolgen.', 'info')}
        <div class="form__actions">
          <a class="btn btn--outline" href="${links.service(cfg.serviceId)}"><span class="btn__text">Abbrechen</span></a>
          <button class="btn btn--filled btn--lg btn--icon-left" type="submit">${C.icon('Checkmark', 'btn__icon')}<span class="btn__text">Meldung absenden</span></button>
        </div>
      </form>
      </div>
    </div>`;
    wire();
    restore();
  }

  function drawDone() {
    const i = state.created;
    mount.innerHTML = `
    <div class="container section container--grid">
      <div class="container__center--xs">
      ${C.processDone({ instance: i, lead: 'Meldung erfasst.', title: 'Vielen Dank',
        text: 'Ihre Meldung wurde erfasst und an die zuständige Stelle weitergeleitet. Den Bearbeitungsstand sehen Sie jederzeit unter «Meine Vorgänge».',
        extra: isSecurity ? C.notification('Bei akuter Gefahr wenden Sie sich umgehend an die <strong>Alarmzentrale +41 58 465 65 65</strong>.', 'warning', 'WarningCircle') : '',
        actions: [
          { href: links.caseDetails(i.instanceId), label: 'Vorgang ansehen', icon: 'ArrowRight' },
          { href: '#/services', label: 'Zu den Dienstleistungen' },
        ] })}
      </div>
    </div>`;
    // Focus the success heading and announce the reference after submission.
    C.focusProcessDone(mount, i);
  }

  function read() {
    Object.assign(state, C.readForm(mount, {
      buildingId: 'bld', locationDetail: 'location-detail', category: 'cat', description: 'description', urgency: 'urgency',
    }));
  }

  function validate() {
    const e = {};
    if (!state.buildingId) e.bld = 'Bitte ein Gebäude oder einen Standort wählen';
    if (!state.description.trim()) e.description = 'Bitte beschreiben Sie den Sachverhalt';
    state.errors = e;
    return Object.keys(e).length === 0;
  }

  function wire() {
    const form = mount.querySelector('#report-form');
    if (!form) return;
    // Clear errors immediately when the corresponding field is corrected.
    C.wireFieldErrors(mount, state.errors);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      read();
      // Redraw a failed attempt, then focus and wire the error summary so focus
      // does not fall back to body (WCAG 3.3.1).
      if (!validate()) { draw(); C.wireErrorSummary(mount); return; }
      const b = core.building(state.buildingId);
      const buildingName = b ? b.name : state.buildingId;
      state.created = engine.start(cfg.defId, {
        title: `${cfg.label} — ${buildingName}`,
        organization: session.user().org,
        requester: session.user().name,
        data: {
          'kategorie': state.category,
          'ort': state.locationDetail,
          'beschreibung': state.description,
          'dringlichkeit': state.urgency,
          'standort': buildingName,
        },
        linkedEntities: state.buildingId ? { buildingId: state.buildingId } : {},
      });
      draw();
      if (!state.created) C.flashError(mount, 'Die Meldung konnte nicht gespeichert werden — bitte erneut versuchen.');
    });
  }

  draw();
}
