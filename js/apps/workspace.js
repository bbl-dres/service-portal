// Workspace & Buchung — Möblierung & Material, Belegungsplanung und interaktive Ressourcenbuchung.

import * as links from '../links.js';
import { ANWENDUNGEN, trail } from '../crumbs.js';
import { num, datum } from '../format.js';

// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
export const needs = ['buildings'];
export default async function render(ctx) {
  const { mount, query, core, engine, session, C, setTitle, setCrumbs } = ctx;
  setTitle('Workspace & Buchung');
  // Crumb-Blatt = Titel/h1 («Workspace & Buchung»-Kanon, Design-Review D17).
  setCrumbs(trail(ANWENDUNGEN, { label: 'Workspace & Buchung' }));

  const buildings = core.buildings();
  const totalWorkplaces = buildings.reduce((sum, b) => sum + (b.workplaces || 0), 0);

  const TABS = [
    { id: 'moeblierung', label: 'Möblierung & Material', icon: 'ShoppingCart' },
    { id: 'belegung', label: 'Belegungsplanung', icon: 'Map' },
    { id: 'buchung', label: 'Buchung', icon: 'Calendar' },
  ];

  const RESSOURCEN = [
    { id: 'sitzungsraum', label: 'Sitzungsraum', icon: 'Users', hint: 'Besprechungs- und Sitzungsräume nach Verfügbarkeit.' },
    { id: 'arbeitsplatz', label: 'Arbeitsplatz (Desk-Sharing)', icon: 'Briefcase', hint: 'Geteilte Arbeitsplätze im Desk-Sharing-Modell.' },
    { id: 'parkplatz', label: 'Parkplatz', icon: 'Car', hint: 'Tages- oder halbtageweise Parkplatzbuchung.' },
  ];

  const ZEITEN = [
    'Ganzer Tag (08:00–17:00)',
    'Vormittag (08:00–12:00)',
    'Nachmittag (13:00–17:00)',
    '08:00–10:00',
    '10:00–12:00',
    '13:00–15:00',
    '15:00–17:00',
  ];

  // Klartextnamen für die Fehlerübersicht. Die Schlüssel sind DOM-ids, damit
  // die Sprungmarken auflösen (Muster space-request.js / building-create.js).
  const FIELD_LABELS = { ressourcentyp: 'Ressourcentyp', bld: 'Standort', datum: 'Datum' };

  // ---- state -------------------------------------------------------------
  const initialTab = TABS.some(t => t.id === query.get('tab')) ? query.get('tab') : 'moeblierung';
  const state = {
    tab: initialTab,
    ressourcentyp: RESSOURCEN[0].id,
    buildingId: buildings[0] ? buildings[0].bbl_id : '',
    datum: '',
    zeit: ZEITEN[0],
    bemerkung: '',
    errors: {},
    created: null,
  };

  // ---- tab panels --------------------------------------------------------
  function panelMoeblierung() {
    return `
      <div class="container--grid gap--responsive">
        <div class="container__main vertical-spacing">
          <h2>${C.icon('ShoppingCart', 'icon--base')} Möblierung & Material</h2>
          <p>Mobiliar, Büromaterial und Ausstattung für Bundesarbeitsplätze beziehen Sie über den
             zentralen E-Shop des BBL. Standardisierte Sortimente sorgen für einheitliche, ergonomische
             und wirtschaftliche Arbeitsumgebungen über alle Standorte hinweg.</p>
          ${C.notification('<strong>Kreislaufwirtschaft:</strong> Gut erhaltenes Mobiliar wird wiederverwendet statt neu beschafft. Prüfen Sie vor jeder Bestellung das Angebot an aufbereitetem Occasions-Mobiliar im E-Shop – das spart Kosten und Ressourcen.', 'success', 'CheckmarkCircle')}
          <div class="row">
            <a class="btn btn--outline btn--lg btn--icon-right" href="#" target="_blank" rel="noopener">${C.icon('External', 'btn__icon')}<span class="btn__text">Zum E-Shop</span></a>
            <a class="btn btn--outline" href="#/services"><span class="btn__text">Verwandte Dienstleistungen</span></a>
          </div>
        </div>
        ${/* Kein stack-lg auf der Aside: .container__aside bringt den CD-Rhythmus
              (1.75/2rem) schon mit — ein zweiter Takt obendrauf gewinnt nur. */''}
        <aside class="container__aside">
          <div class="box">
            <h3>Sortimente</h3>
            <ul class="list--default stack">
              <li>Büro- und Sitzungsmobiliar</li>
              <li>Ergonomie-Ausstattung</li>
              <li>Büro- und Verbrauchsmaterial</li>
              <li>Aufbereitetes Occasions-Mobiliar</li>
            </ul>
          </div>
          <div class="box">
            <h3>Gut zu wissen</h3>
            <p class="small muted m-0">Bestellungen lösen einen Vorgang vom Typ
              «Bestellung» aus und sind unter <a href="#/my-cases">Meine Vorgänge</a> nachverfolgbar.</p>
          </div>
        </aside>
      </div>`;
  }

  function panelBelegung() {
    return `
      <div class="container--grid gap--responsive">
        <div class="container__main vertical-spacing">
          <h2>${C.icon('Map', 'icon--base')} Belegungsplanung</h2>
          <p>Die Belegungs- und Flächenplanung – wer sitzt wo, wie sind Flächen zugeteilt und wie hoch ist
             die Auslastung – erfolgt in der Fachanwendung <strong>GIS/FLM</strong> (Flächen- und
             Liegenschaftsmanagement). Dort stehen Belegungspläne, Flächenbilanzen und Auswertungen je
             Gebäude und Verwaltungseinheit zur Verfügung.</p>
          ${C.notification('Die detaillierte Belegungsplanung ist in der GIS/FLM-Fachanwendung verfügbar. Den Zugang finden Sie unter Anwendungen.', 'info')}
          <div class="row">
            <a class="btn btn--outline btn--icon-right" href="#/applications">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Zu den Anwendungen</span></a>
          </div>
        </div>
        <aside class="container__aside">
          <div class="stat">
            <div class="stat__num">${num(totalWorkplaces)}</div>
            <div class="stat__label">Arbeitsplätze im Portfolio (${buildings.length} Gebäude)</div>
          </div>
          <div class="box">
            <h3>Belegung planen</h3>
            <p class="small muted m-0">Belegungspläne, Desk-Sharing-Quoten und
              Flächenauslastung werden zentral in GIS/FLM geführt.</p>
          </div>
        </aside>
      </div>`;
  }

  function panelBuchung() {
    if (state.created) return doneBuchung();
    // Buchung ist ein persönlicher Vorgang — abgemeldet zum Login auffordern statt
    // session.user() zu dereferenzieren (Möblierung/Belegung bleiben frei sichtbar).
    if (!session.isLoggedIn()) {
      return C.loginGate('Die Ressourcenbuchung wird als persönlicher Vorgang unter «Meine Vorgänge» erfasst. Bitte melden Sie sich mit AGOV / FedLogin an, um einen Raum, Arbeitsplatz oder Parkplatz zu buchen.');
    }
    const b = core.building(state.buildingId);
    const r = RESSOURCEN.find(x => x.id === state.ressourcentyp);
    return `
      <div class="container--grid gap--responsive">
        <div class="container__main vertical-spacing">
          <h2>${C.icon('Calendar', 'icon--base')} Ressource buchen</h2>
          ${C.contextLine({ action: 'Buchung', name: session.user().name, org: session.user().org })}
          <p class="muted">Eine Anfrage wird als Vorgang erfasst und durch Workspace BBL bestätigt.</p>
          <p class="small muted">Mit <span class="text--asterisk" aria-hidden="true"></span> markierte Felder sind Pflichtfelder.</p>
          ${C.errorSummary({ errors: state.errors, labels: FIELD_LABELS })}
          <!-- novalidate — siehe space-request.js -->
          <form id="buchung-form" class="form" novalidate>
            ${C.select({ id: 'ressourcentyp', name: 'ressourcentyp', label: 'Ressourcentyp', required: true,
              value: state.ressourcentyp, hint: r ? r.hint : '', message: state.errors.ressourcentyp,
              options: RESSOURCEN.map(x => ({ value: x.id, label: x.label })) })}
            ${C.select({ id: 'bld', name: 'bld', label: 'Standort', required: true, value: state.buildingId,
              message: state.errors.bld,
              options: buildings.map(x => ({ value: x.bbl_id, label: `${x.name} — ${x.city}` })) })}
            ${C.field({ id: 'datum', label: 'Datum', required: true, message: state.errors.datum,
              control: (cls, attrs) => `<input id="datum" type="date" value="${C.escape(state.datum)}" class="${cls}"${attrs}>` })}
            ${C.select({ id: 'zeit', name: 'zeit', label: 'Zeit', value: state.zeit,
              options: ZEITEN.map(z => ({ value: z, label: z })) })}
            ${C.field({ id: 'bemerkung', label: 'Bemerkung',
              control: (cls, attrs) => `<textarea id="bemerkung" placeholder="z. B. benötigte Ausstattung, Personenzahl, besondere Wünsche" class="${cls}"${attrs}>${C.escape(state.bemerkung)}</textarea>` })}
            <div class="form__actions">
              <button class="btn btn--filled btn--lg btn--icon-left" type="submit">${C.icon('Checkmark', 'btn__icon')}<span class="btn__text">Buchung anfragen</span></button>
            </div>
          </form>
        </div>
        <aside class="container__aside">
          <div class="box">
            <h3>Ihre Auswahl</h3>
            <dl class="kv">
              <dt>Ressource</dt><dd>${r ? C.escape(r.label) : '—'}</dd>
              <dt>Standort</dt><dd>${b ? C.escape(b.name) : '—'}</dd>
              ${/* format.datum statt rohem ISO-Wert des date-Inputs; '' → «—». */''}
              <dt>Datum</dt><dd>${C.escape(datum(state.datum))}</dd>
              <dt>Zeit</dt><dd>${C.escape(state.zeit || '—')}</dd>
            </dl>
          </div>
          <div class="box">
            <h3>Hinweis</h3>
            <p class="small muted m-0">Arbeitsplätze werden im Desk-Sharing-Modell vergeben.
              Buchungen sind unter <a href="#/my-cases">Meine Vorgänge</a> einsehbar.</p>
          </div>
        </aside>
      </div>`;
  }

  function doneBuchung() {
    const i = state.created;
    return `
      ${/* 46rem wie die Erfolgsscreens der Formular-Apps (container__center--xs
            trägt standalone nur den max-width-Deckel) — measure-lg war die
            einzige abweichende Breite für dieselbe Funktion (C25). */''}
      <div class="vertical-spacing container__center--xs">
        ${C.processDone({ instance: i, lead: 'Buchung angefragt.', title: 'Vielen Dank',
          // h2, nicht h1: die Reiterseite trägt ihre Überschrift schon.
          heading: 'h2',
          text: `Ihre Ressourcenbuchung «${C.escape(i.title)}» wurde erfasst und wird durch Workspace BBL
             bestätigt. Den Status sehen Sie jederzeit unter «Meine Vorgänge».`,
          actions: [
            { href: links.vorgang(i.instanceId), label: 'Vorgang ansehen', icon: 'ArrowRight' },
            // Bewusst NICHT «Zu den Dienstleistungen»: die Sekundäraktion startet
            // das Buchungsformular neu (dokumentierter Unterschied der Reiterseite).
            { id: 'buchung-neu', label: 'Weitere Buchung' },
          ] })}
      </div>`;
  }

  // ---- render ------------------------------------------------------------
  function draw() {
    const panel = state.tab === 'moeblierung' ? panelMoeblierung()
      : state.tab === 'belegung' ? panelBelegung()
      : panelBuchung();

    // Fokus + Schreibmarke über den kompletten Neuaufbau (inkl. wire()) retten.
    const restore = C.preserveFocus(mount);
    mount.innerHTML = `
    <div class="container section">
      ${C.pageHeader({ title: 'Workspace & Buchung', lead: 'Möblierung und Material, Belegungsplanung sowie Buchung von Räumen, Arbeitsplätzen und Parkplätzen.' })}
      <div class="tabs">
        ${C.tabBar({ items: TABS, active: state.tab, idPrefix: 'ws-tab', panelId: 'wpanel', ariaLabel: 'Workspace-Ansichten' })}
        <div class="tab__container" role="tabpanel" id="wpanel" aria-labelledby="ws-tab-${state.tab}" tabindex="0">${panel}</div>
      </div>
    </div>`;
    wire();
    restore();
  }

  function readForm() {
    // Selects behalten bei Abwesenheit ihren Wert (|| alt); Datum/Bemerkung nicht.
    state.ressourcentyp = C.val(mount, 'ressourcentyp') || state.ressourcentyp;
    state.buildingId = C.val(mount, 'bld') || state.buildingId;
    state.datum = C.val(mount, 'datum');
    state.zeit = C.val(mount, 'zeit') || state.zeit;
    state.bemerkung = C.val(mount, 'bemerkung');
  }

  function validate() {
    const e = {};
    if (!state.datum) e.datum = 'Bitte ein Datum wählen';
    // Defensiv: beide Felder sind required:true im Markup und tragen immer einen
    // Wert — mit novalidate greift aber keine Browserprüfung mehr, also hier.
    // Die Fehlerschlüssel sind DOM-ids (Sprungmarken der Fehlerübersicht);
    // geprüft wird der State-Schlüssel: `state.bld` gab es nie, der Standort-
    // Fehler stand deshalb IMMER und blockierte jede Absendung.
    if (!state.ressourcentyp) e.ressourcentyp = 'Bitte einen Ressourcentyp wählen';
    if (!state.buildingId) e.bld = 'Bitte einen Standort wählen';
    state.errors = e;
    return Object.keys(e).length === 0;
  }

  function wire() {
    // Tab-Wechsel via C.wireTabs; onSelect rendert das Einzel-Panel via draw() neu.
    // Vor dem Verlassen der Buchung deren Eingaben sichern (bleiben so erhalten).
    C.wireTabs(mount, {
      onSelect: (id) => {
        if (state.tab === 'buchung' && !state.created) readForm();
        state.tab = id;
        draw();
      },
    });

    // Fehler löschen, sobald das Feld korrigiert wird — der Redraw zeigte vorher
    // stale Fehler (Design-Review A8). VOR der Live-Aside-Verdrahtung anmelden:
    // beide hängen am selben change-Ereignis, und nur in dieser Reihenfolge ist
    // der Fehler schon aus state.errors raus, wenn draw() neu zeichnet.
    C.wireFieldErrors(mount, state.errors);

    // live aside update on the booking tab
    ['ressourcentyp', 'bld', 'datum', 'zeit'].forEach(id => {
      const el = mount.querySelector('#' + id);
      if (el) el.addEventListener('change', () => { readForm(); draw(); });
    });

    const form = mount.querySelector('#buchung-form');
    if (form) {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        readForm();
        // Fehlversuch: neu zeichnen, dann Fokus auf die Fehlerübersicht — sonst
        // landet er auf <body> und der Nutzer erfährt nichts (WCAG 3.3.1).
        if (!validate()) { draw(); C.wireErrorSummary(mount); return; }
        const b = core.building(state.buildingId);
        const r = RESSOURCEN.find(x => x.id === state.ressourcentyp);
        const buildingName = b ? b.name : 'Standort';
        state.created = engine.start('buchung', {
          title: `${r ? r.label : 'Buchung'} — ${buildingName}`,
          organization: session.user().org,
          requester: session.user().name,
          data: {
            ressourcentyp: r ? r.label : state.ressourcentyp,
            standort: buildingName,
            datum: state.datum,
            zeit: state.zeit,
            bemerkung: state.bemerkung,
          },
          linkedEntities: state.buildingId ? { buildingId: state.buildingId } : {},
        });
        draw();
        // Fokus + Ansage auf den Erfolgsscreen — HIER statt in doneBuchung():
        // das Done-Panel wird auch beim blossen Reiterwechsel neu gezeichnet,
        // und nur der Absende-Moment ist ein Kontextwechsel. Wurzel ist das
        // Tab-Panel, weil die Seiten-h1 ebenfalls tabindex="-1" trägt und den
        // Fokus sonst abfinge (die Erfolgsüberschrift ist ein h2 im Panel).
        if (state.created) C.focusProcessDone(mount.querySelector('#wpanel') || mount, state.created);
        else C.flashError(mount, 'Die Buchung konnte nicht gespeichert werden — bitte erneut versuchen.');
      });
    }

    const neu = mount.querySelector('#buchung-neu');
    if (neu) {
      neu.addEventListener('click', () => {
        state.created = null;
        state.datum = '';
        state.bemerkung = '';
        state.errors = {};
        draw();
      });
    }
  }

  draw();
}
