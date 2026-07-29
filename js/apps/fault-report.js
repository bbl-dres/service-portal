// Meldung erfassen — single-step report form that creates a Vorgang.
// Variants via ?type=: sicherheit | reklamation | umzug | (default Störung/Reinigung/Reparatur).

// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
export const needs = ['buildings', 'contacts'];
export default async function render(ctx) {
  const { mount, query, core, engine, session, C, setTitle, setCrumbs } = ctx;

  const TYPES = {
    sicherheit: {
      title: 'Sicherheits-/Datenschutzvorfall melden',
      defId: 'sicherheitsvorfall',
      label: 'Sicherheits-/Datenschutzvorfall',
      categories: ['Informationssicherheit', 'Datenschutz'],
      lead: 'Melden Sie einen Vorfall der Informationssicherheit oder des Datenschutzes an die Fachstelle ISBO.',
    },
    reklamation: {
      title: 'Reklamationsmeldung',
      defId: 'stoerung',
      label: 'Reklamation',
      categories: ['Reklamation'],
      lead: 'Erfassen Sie eine Reklamation zu Liegenschaften, Betrieb oder Dienstleistungen.',
    },
    umzug: {
      title: 'Umzug, Transport & Entsorgung',
      defId: 'stoerung',
      label: 'Umzug / Transport / Entsorgung',
      categories: ['Umzug', 'Transport', 'Entsorgung'],
      lead: 'Beauftragen Sie einen Umzug, einen Transport oder eine Entsorgung.',
    },
    default: {
      title: 'Störungs-, Reinigungs- & Reparaturmeldung',
      defId: 'stoerung',
      label: 'Störungsmeldung',
      categories: ['Störung', 'Reinigung', 'Reparatur'],
      lead: 'Melden Sie eine Störung, einen Reinigungs- oder Reparaturbedarf am Objekt.',
    },
  };

  const typeKey = TYPES[query.get('type')] ? query.get('type') : 'default';
  const cfg = TYPES[typeKey];
  const isSecurity = typeKey === 'sicherheit';

  setTitle(cfg.title);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Dienstleistungen', href: '#/services' },
    { label: cfg.title },
  ]);

  // Meldung = persönlicher Vorgang — abgemeldet zum Login auffordern statt in der
  // Formularansicht session.user() zu dereferenzieren (Direktaufruf-Schutz).
  if (!session.isLoggedIn()) {
    mount.innerHTML = `
    <div class="container section container--grid">
      <div class="container__center--xs">
        ${C.backLink('#/services', 'Dienstleistungen')}
        <h1 tabindex="-1">${C.escape(cfg.title)}</h1>
        <p class="lead">${C.escape(cfg.lead)}</p>
        ${C.loginGate('Diese Meldung wird als persönlicher Vorgang unter «Meine Vorgänge» erfasst. Bitte melden Sie sich mit AGOV / FedLogin an, um sie einzureichen.')}
      </div>
    </div>`;
    return;
  }

  const buildings = core.buildings();
  const isbo = core.contacts().find(c => c.contactId === 'isbo');

  const state = {
    buildingId: buildings[0] ? buildings[0].bbl_id : '',
    ort: '',
    category: cfg.categories[0] || '',
    beschreibung: '',
    dringlichkeit: 'normal',
    errors: {},
    created: null,
  };

  function draw() {
    if (state.created) return drawDone();

    const buildingOpts = buildings.map(b => ({ value: b.bbl_id, text: `${b.name} — ${b.city}` }));
    const categoryOpts = cfg.categories.map(c => ({ value: c, text: c }));
    const dringlichkeitOpts = [
      { value: 'normal', text: 'Normal' },
      { value: 'hoch', text: 'Hoch' },
    ];

    const securityNote = isSecurity ? `
      ${C.notification(`<strong>Bei akuter Gefahr: Alarmzentrale +41 58 465 65 65</strong><br>Lebensbedrohliche Lagen sofort telefonisch melden – nicht über dieses Formular.`, 'warning', 'WarningCircle')}
      ${isbo ? C.notification(`Fachstelle <strong>${C.escape(isbo.name)}</strong> · <a href="mailto:${C.escape(isbo.email)}">${C.escape(isbo.email)}</a> · ${C.escape(isbo.phone)}`, 'info', 'Lock') : ''}
    ` : '';

    // Fokus + Schreibmarke über den Neuaufbau retten (Item 3.2).
    const restore = C.preserveFocus(mount);
    mount.innerHTML = `
    <div class="container section container--grid">
      <div class="container__center--xs">
      ${C.backLink('#/services', 'Dienstleistungen')}
      <h1 tabindex="-1">${C.escape(cfg.title)}</h1>
      <p class="lead">${C.escape(cfg.lead)}</p>
      <p class="muted">Meldung als <strong>${C.escape(session.user().name)}</strong> · ${C.escape(session.user().org)}</p>
      ${securityNote}
      <!-- novalidate — siehe space-request.js: ohne das Attribut feuert das
           submit-Event nie und validate() bleibt unerreichbar. -->
      <h2 class="sr-only">Meldung erfassen</h2>
      <form id="report-form" class="form mt-6" novalidate>
        ${buildings.length
          ? C.select({ id: 'bld', name: 'bld', label: 'Gebäude / Standort', required: true,
              value: state.buildingId, message: state.errors.buildingId, options: buildingOpts })
          : C.field({ id: 'bld', label: 'Gebäude / Standort', required: true, message: state.errors.buildingId,
              control: (cls, attrs) => `<input id="bld" value="" placeholder="Kein Gebäude verfügbar" disabled class="${cls}"${attrs}>` })}
        ${C.field({ id: 'ort', label: 'Ort (Stockwerk / Raum)', hint: 'Optional – hilft bei der Lokalisierung.',
          control: (cls, attrs) => `<input id="ort" placeholder="z. B. 3. OG, Raum 312" value="${C.escape(state.ort)}" class="${cls}"${attrs}>` })}
        ${C.select({ id: 'cat', name: 'cat', label: 'Kategorie', value: state.category, options: categoryOpts })}
        ${C.field({ id: 'beschreibung', label: 'Beschreibung', required: true, message: state.errors.beschreibung,
          control: (cls, attrs) => `<textarea id="beschreibung" placeholder="Beschreiben Sie den Sachverhalt möglichst genau." class="${cls}"${attrs}>${C.escape(state.beschreibung)}</textarea>` })}
        ${C.select({ id: 'dringlichkeit', name: 'dringlichkeit', label: 'Dringlichkeit', value: state.dringlichkeit, options: dringlichkeitOpts })}
        ${C.notification('Mit dem Absenden wird ein Vorgang erstellt. Sie können den Status jederzeit unter <strong>Meine Vorgänge</strong> verfolgen.', 'info')}
        <div class="row mt-4" style="justify-content:flex-end">
          <a class="btn btn--outline" href="#/services">Abbrechen</a>
          <button class="btn btn--filled btn--lg" type="submit">${C.icon('Checkmark', 'icon--base')} Meldung absenden</button>
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
      ${C.notification(`<strong>Meldung erfasst.</strong> Ihre Referenz: <strong>${C.escape(i.reference)}</strong>`, 'success', 'CheckmarkCircle')}
      <h1 tabindex="-1">Vielen Dank</h1>
      <p>Ihre Meldung wurde erfasst und an die zuständige Stelle weitergeleitet. Den Bearbeitungsstand sehen Sie jederzeit unter «Meine Vorgänge».</p>
      ${isSecurity ? C.notification('Bei akuter Gefahr wenden Sie sich umgehend an die <strong>Alarmzentrale +41 58 465 65 65</strong>.', 'warning', 'WarningCircle') : ''}
      <div class="row mt-4">
        <a class="btn btn--outline" href="#/my-cases/${i.instanceId}">Vorgang ansehen ${C.icon('ArrowRight', 'icon--base')}</a>
        <a class="btn btn--outline" href="#/services">Weitere Services</a>
      </div>
      </div>
    </div>`;
  }

  function read() {
    Object.assign(state, C.readForm(mount, {
      buildingId: 'bld', ort: 'ort', category: 'cat', beschreibung: 'beschreibung', dringlichkeit: 'dringlichkeit',
    }));
  }

  function validate() {
    const e = {};
    if (!state.buildingId) e.buildingId = 'Bitte Gebäude / Standort wählen';
    if (!state.beschreibung.trim()) e.beschreibung = 'Bitte beschreiben Sie den Sachverhalt';
    state.errors = e;
    return Object.keys(e).length === 0;
  }

  function wire() {
    const form = mount.querySelector('#report-form');
    if (!form) return;
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      read();
      if (!validate()) { draw(); return; }
      const b = core.building(state.buildingId);
      const buildingName = b ? b.name : state.buildingId;
      state.created = engine.start(cfg.defId, {
        title: `${cfg.label} — ${buildingName}`,
        organization: session.user().org,
        requester: session.user().name,
        data: {
          kategorie: state.category,
          ort: state.ort,
          beschreibung: state.beschreibung,
          dringlichkeit: state.dringlichkeit,
          standort: buildingName,
        },
        linkedEntities: state.buildingId ? { buildingId: state.buildingId } : {},
      });
      draw();
      if (!state.created) C.flashError(mount, 'Die Meldung konnte nicht gespeichert werden — bitte erneut versuchen.');
    });
  }

  draw();
}
