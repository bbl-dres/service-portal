// Meldung erfassen — single-step report form that creates a Vorgang.
// Variants via ?type=: sicherheit | reklamation | kleinauftrag | umzug |
// (default Störung/Reinigung/Reparatur). Kleinauftrag teilt sich die Annahme mit
// der Störungsmeldung, weil der Helpdesk OM laut Kundenplattform die zentrale
// Annahmestelle für «Störungsmeldung UND Kleinaufträge» ist.

import * as links from '../links.js';
import { DIENSTLEISTUNGEN, trail } from '../crumbs.js';

// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
export const needs = ['buildings', 'contacts'];

// Wortlaut der Anmeldesperre, die der Router vor diese Anwendung zieht
// (js/router.js). Der Satz gehört zur Anwendung — «Diese Meldung wird als
// persönlicher Vorgang erfasst» sagt mehr als ein Einheitssatz.
export const loginText = "Diese Meldung wird als persönlicher Vorgang unter «Meine Vorgänge» erfasst. Bitte melden Sie sich mit AGOV / FedLogin an, um sie abzusenden.";
export default async function render(ctx) {
  const { mount, query, core, engine, session, C, setTitle, setCrumbs } = ctx;

  // serviceId = Katalogeintrag in data/services.json — Zurück/Abbrechen zielt
  // auf die Dienstleistungsbeschreibung des jeweiligen Typs, nicht den Hub
  // (Design-Review B11).
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
      // Katalogtitel = h1 (Verb inklusive) — services.json führt den Eintrag
      // als «Kleinauftrag am Gebäude erteilen».
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

  const typeKey = TYPES[query.get('type')] ? query.get('type') : 'default';
  const cfg = TYPES[typeKey];
  const isSecurity = typeKey === 'sicherheit';

  setTitle(cfg.title);
  setCrumbs(trail(DIENSTLEISTUNGEN, { label: cfg.title }));

  const buildings = core.buildings();
  const isbo = core.contacts().find(c => c.contactId === 'isbo');

  // Vorbelegung aus dem Aufruf: `?building=<bbl_id>&room=<Raumnummer>`. Das
  // Mietendenportal verlinkt aus dem Grundriss hierher (js/apps/tenancies.js) —
  // wer dort auf einen Raum geklickt hat, soll Gebäude und Ort nicht noch
  // einmal aus einer Liste von 21 Objekten heraussuchen müssen. Unbekannte IDs
  // werden ignoriert statt übernommen, sonst stünde im Feld eine Kennung, die
  // die Auswahlliste gar nicht führt.
  const vorgabeBld = query.get('building');
  const gueltig = vorgabeBld && buildings.some((b) => b.bbl_id === vorgabeBld);

  const state = {
    // Leere Vorauswahl (wie PLEASE_PICK in building-create.js): eine Pflicht-
    // auswahl, die schon ausgefüllt ist, ist keine — vorher stand hier still-
    // schweigend das erste von 21 Gebäuden, und required konnte nie fehlschlagen.
    // Nur der Deep-Link (?building=) darf vorbelegen.
    buildingId: gueltig ? vorgabeBld : '',
    ort: query.get('room') || '',
    category: cfg.categories[0] || '',
    beschreibung: '',
    dringlichkeit: 'normal',
    errors: {},
    created: null,
  };

  // Klartextnamen für die Fehlerübersicht. Die Schlüssel sind DOM-ids, damit
  // die Sprungmarken auflösen (Muster space-request.js / building-create.js).
  const FIELD_LABELS = { bld: 'Gebäude / Standort', beschreibung: 'Beschreibung' };

  function draw() {
    if (state.created) return drawDone();

    // «Bitte wählen …» als echte Leerauswahl an erster Stelle — erst damit kann
    // die required-Prüfung des Gebäude-Felds überhaupt fehlschlagen.
    const buildingOpts = [{ value: '', label: 'Bitte wählen…' },
      ...buildings.map(b => ({ value: b.bbl_id, label: `${b.name} — ${b.city}` }))];
    const categoryOpts = cfg.categories.map(c => ({ value: c, label: c }));
    const dringlichkeitOpts = [
      { value: 'normal', label: 'Normal' },
      { value: 'hoch', label: 'Hoch' },
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
      ${C.backLink(links.dienstleistung(cfg.serviceId), 'Dienstleistungsbeschreibung')}
      <h1 tabindex="-1">${C.escape(cfg.title)}</h1>
      <p class="lead">${C.escape(cfg.lead)}</p>
      ${C.contextLine({ action: 'Meldung', name: session.user().name, org: session.user().org })}
      ${securityNote}
      <!-- novalidate — siehe space-request.js: ohne das Attribut feuert das
           submit-Event nie und validate() bleibt unerreichbar. -->
      <h2 class="sr-only">Meldung erfassen</h2>
      <p class="small muted">Mit <span class="text--asterisk" aria-hidden="true"></span> markierte Felder sind Pflichtfelder.</p>
      ${C.errorSummary({ errors: state.errors, labels: FIELD_LABELS })}
      <form id="report-form" class="form mt-6" novalidate>
        ${buildings.length
          ? C.select({ id: 'bld', name: 'bld', label: 'Gebäude / Standort', required: true,
              value: state.buildingId, message: state.errors.bld, options: buildingOpts })
          : C.field({ id: 'bld', label: 'Gebäude / Standort', required: true, message: state.errors.bld,
              control: (cls, attrs) => `<input id="bld" value="" placeholder="Kein Gebäude verfügbar" disabled class="${cls}"${attrs}>` })}
        ${C.field({ id: 'ort', label: 'Ort (Stockwerk / Raum)', hint: 'Optional – hilft bei der Lokalisierung.',
          control: (cls, attrs) => `<input id="ort" placeholder="z. B. 3. OG, Raum 312" value="${C.escape(state.ort)}" class="${cls}"${attrs}>` })}
        ${C.select({ id: 'cat', name: 'cat', label: 'Kategorie', value: state.category, options: categoryOpts })}
        ${C.field({ id: 'beschreibung', label: 'Beschreibung', required: true, message: state.errors.beschreibung,
          control: (cls, attrs) => `<textarea id="beschreibung" placeholder="Beschreiben Sie den Sachverhalt möglichst genau." class="${cls}"${attrs}>${C.escape(state.beschreibung)}</textarea>` })}
        ${C.select({ id: 'dringlichkeit', name: 'dringlichkeit', label: 'Dringlichkeit', value: state.dringlichkeit, options: dringlichkeitOpts })}
        ${C.notification('Mit dem Absenden wird ein Vorgang erstellt. Sie können den Status jederzeit unter <strong>Meine Vorgänge</strong> verfolgen.', 'info')}
        <div class="form__actions">
          <a class="btn btn--outline" href="${links.dienstleistung(cfg.serviceId)}"><span class="btn__text">Abbrechen</span></a>
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
          { href: links.vorgang(i.instanceId), label: 'Vorgang ansehen', icon: 'ArrowRight' },
          { href: '#/services', label: 'Zu den Dienstleistungen' },
        ] })}
      </div>
    </div>`;
    // Nach dem Absenden fiele der Fokus sonst auf <body> — Überschrift
    // fokussieren + Referenz ansagen (Design-Review B8).
    C.focusProcessDone(mount, i);
  }

  function read() {
    Object.assign(state, C.readForm(mount, {
      buildingId: 'bld', ort: 'ort', category: 'cat', beschreibung: 'beschreibung', dringlichkeit: 'dringlichkeit',
    }));
  }

  function validate() {
    const e = {};
    if (!state.buildingId) e.bld = 'Bitte ein Gebäude oder einen Standort wählen';
    if (!state.beschreibung.trim()) e.beschreibung = 'Bitte beschreiben Sie den Sachverhalt';
    state.errors = e;
    return Object.keys(e).length === 0;
  }

  function wire() {
    const form = mount.querySelector('#report-form');
    if (!form) return;
    // Fehler löschen, sobald das Feld korrigiert wird — fehlte hier komplett,
    // Meldungen blieben nach der Korrektur stehen (Design-Review A8).
    C.wireFieldErrors(mount, state.errors);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      read();
      // Fehlversuch: neu zeichnen, dann Fokus auf die Fehlerübersicht — sonst
      // landet er auf <body> und der Nutzer erfährt nichts (WCAG 3.3.1).
      if (!validate()) { draw(); C.wireErrorSummary(mount); return; }
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
