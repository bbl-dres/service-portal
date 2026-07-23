// Meldung erfassen — single-step report form that creates a Vorgang.
// Variants via ?type=: sicherheit | reklamation | umzug | (default Störung/Reinigung/Reparatur).
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

  function selectControl(id, options, selected) {
    return `<div class="select"><select id="${id}" class="input--outline input--base">${options.map(o =>
      `<option value="${C.escape(o.value)}"${o.value === selected ? ' selected' : ''}>${C.escape(o.text)}</option>`
    ).join('')}</select><div class="select__icon">${C.chevron}</div></div>`;
  }

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
      ${isbo ? C.notification(`Fachstelle <strong>${C.escape(isbo.name)}</strong> · <a href="mailto:${isbo.email}">${C.escape(isbo.email)}</a> · ${C.escape(isbo.phone)}`, 'info', 'Lock') : ''}
    ` : '';

    mount.innerHTML = `
    <div class="container section">
      <div class="container__center--xs">
      ${C.backLink('#/services', 'Alle Dienstleistungen')}
      <h1 tabindex="-1">${C.escape(cfg.title)}</h1>
      <p class="lead">${C.escape(cfg.lead)}</p>
      <p class="muted">Meldung als <strong>${C.escape(session.user().name)}</strong> · ${C.escape(session.user().org)}</p>
      ${securityNote}
      <form id="report-form" class="form mt-6">
        ${field('bld', 'Gebäude / Standort <span class="req">*</span>',
          buildings.length ? selectControl('bld', buildingOpts, state.buildingId)
            : `<input id="bld" value="" placeholder="Kein Gebäude verfügbar" disabled>`,
          state.errors.buildingId)}
        ${field('ort', 'Ort (Stockwerk / Raum)',
          `<input id="ort" placeholder="z. B. 3. OG, Raum 312" value="${C.escape(state.ort)}">`,
          null, 'Optional – hilft bei der Lokalisierung.')}
        ${field('cat', 'Kategorie',
          selectControl('cat', categoryOpts, state.category))}
        ${field('beschreibung', 'Beschreibung <span class="req">*</span>',
          `<textarea id="beschreibung" placeholder="Beschreiben Sie den Sachverhalt möglichst genau.">${C.escape(state.beschreibung)}</textarea>`,
          state.errors.beschreibung)}
        ${field('dringlichkeit', 'Dringlichkeit',
          selectControl('dringlichkeit', dringlichkeitOpts, state.dringlichkeit))}
        ${C.notification('Mit dem Absenden wird ein Vorgang erstellt. Sie können den Status jederzeit unter <strong>Meine Vorgänge</strong> verfolgen.', 'info')}
        <div class="row mt-4" style="justify-content:flex-end">
          <a class="btn btn--outline" href="#/services">Abbrechen</a>
          <button class="btn btn--filled btn--lg" type="submit">${C.icon('Checkmark', 'icon--base')} Meldung absenden</button>
        </div>
      </form>
      </div>
    </div>`;
    wire();
  }

  function drawDone() {
    const i = state.created;
    mount.innerHTML = `
    <div class="container section">
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

  function val(id) { const el = mount.querySelector('#' + id); return el ? el.value : ''; }

  function read() {
    state.buildingId = val('bld');
    state.ort = val('ort');
    state.category = val('cat');
    state.beschreibung = val('beschreibung');
    state.dringlichkeit = val('dringlichkeit');
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
    });
  }

  draw();
}
