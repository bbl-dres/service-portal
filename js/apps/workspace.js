// Workspace & Buchung — Möblierung & Material, Belegungsplanung und interaktive Ressourcenbuchung.

// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
export const needs = ['buildings'];
export default async function render(ctx) {
  const { mount, query, core, engine, session, C, setTitle, setCrumbs } = ctx;
  setTitle('Workspace & Buchung');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Daten und Digitalisierung', href: '#/data' }, { label: 'Anwendungen', href: '#/applications' }, { label: 'Workspace' }]);

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
        <div class="container__main stack">
          <h2>${C.icon('ShoppingCart', 'icon--base')} Möblierung & Material</h2>
          <p>Mobiliar, Büromaterial und Ausstattung für Bundesarbeitsplätze beziehen Sie über den
             zentralen E-Shop des BBL. Standardisierte Sortimente sorgen für einheitliche, ergonomische
             und wirtschaftliche Arbeitsumgebungen über alle Standorte hinweg.</p>
          ${C.notification('<strong>Kreislaufwirtschaft:</strong> Gut erhaltenes Mobiliar wird wiederverwendet statt neu beschafft. Prüfen Sie vor jeder Bestellung das Angebot an aufbereitetem Occasions-Mobiliar im E-Shop – das spart Kosten und Ressourcen.', 'success', 'CheckmarkCircle')}
          <div class="row mt-4">
            <a class="btn btn--outline btn--lg" href="#" target="_blank" rel="noopener">Zum E-Shop ${C.icon('External', 'icon--base')}</a>
            <a class="btn btn--outline" href="#/services">Verwandte Dienstleistungen</a>
          </div>
        </div>
        <aside class="container__aside stack-lg">
          <div class="box">
            <h3>Sortimente</h3>
            <ul class="stack" style="padding-left:1.1rem; margin:0">
              <li>Büro- und Sitzungsmobiliar</li>
              <li>Ergonomie-Ausstattung</li>
              <li>Büro- und Verbrauchsmaterial</li>
              <li>Aufbereitetes Occasions-Mobiliar</li>
            </ul>
          </div>
          <div class="box">
            <h3>Gut zu wissen</h3>
            <p class="small muted" style="margin:0">Bestellungen lösen einen Vorgang vom Typ
              «Bestellung» aus und sind unter <a href="#/my-cases">Meine Vorgänge</a> nachverfolgbar.</p>
          </div>
        </aside>
      </div>`;
  }

  function panelBelegung() {
    return `
      <div class="container--grid gap--responsive">
        <div class="container__main stack">
          <h2>${C.icon('Map', 'icon--base')} Belegungsplanung</h2>
          <p>Die Belegungs- und Flächenplanung – wer sitzt wo, wie sind Flächen zugeteilt und wie hoch ist
             die Auslastung – erfolgt in der Fachanwendung <strong>GIS/FLM</strong> (Flächen- und
             Liegenschaftsmanagement). Dort stehen Belegungspläne, Flächenbilanzen und Auswertungen je
             Gebäude und Verwaltungseinheit zur Verfügung.</p>
          ${C.notification('Die detaillierte Belegungsplanung ist in der GIS/FLM-Fachanwendung verfügbar. Den Zugang finden Sie unter Anwendungen.', 'info')}
          <div class="row mt-4">
            <a class="btn btn--outline" href="#/applications">Zu den Anwendungen ${C.icon('ArrowRight', 'icon--base')}</a>
          </div>
        </div>
        <aside class="container__aside stack-lg">
          <div class="stat">
            <div class="stat__num">${totalWorkplaces.toLocaleString('de-CH')}</div>
            <div class="stat__label">Arbeitsplätze im Portfolio (${buildings.length} Gebäude)</div>
          </div>
          <div class="box">
            <h3>Belegung planen</h3>
            <p class="small muted" style="margin:0">Belegungspläne, Desk-Sharing-Quoten und
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
        <div class="container__main stack">
          <h2>${C.icon('Calendar', 'icon--base')} Ressource buchen</h2>
          <p class="muted">Buchung als <strong>${C.escape(session.user().name)}</strong> · ${C.escape(session.user().org)}.
             Eine Anfrage wird als Vorgang erfasst und durch Workspace BBL bestätigt.</p>
          <!-- novalidate — siehe space-request.js -->
          <form id="buchung-form" class="form" novalidate>
            ${C.select({ id: 'ressourcentyp', name: 'ressourcentyp', label: 'Ressourcentyp', required: true,
              value: state.ressourcentyp, hint: r ? r.hint : '',
              options: RESSOURCEN.map(x => ({ value: x.id, label: x.label })) })}
            ${C.select({ id: 'bld', name: 'bld', label: 'Standort', required: true, value: state.buildingId,
              options: buildings.map(x => ({ value: x.bbl_id, label: `${x.name} — ${x.city}` })) })}
            ${C.field({ id: 'datum', label: 'Datum', required: true, message: state.errors.datum,
              control: (cls, attrs) => `<input id="datum" type="date" value="${C.escape(state.datum)}" class="${cls}"${attrs}>` })}
            ${C.select({ id: 'zeit', name: 'zeit', label: 'Zeit', value: state.zeit,
              options: ZEITEN.map(z => ({ value: z, label: z })) })}
            ${C.field({ id: 'bemerkung', label: 'Bemerkung',
              control: (cls, attrs) => `<textarea id="bemerkung" placeholder="z. B. benötigte Ausstattung, Personenzahl, besondere Wünsche" class="${cls}"${attrs}>${C.escape(state.bemerkung)}</textarea>` })}
            <div class="row" style="justify-content:flex-end">
              <button class="btn btn--filled btn--lg" type="submit">${C.icon('Checkmark', 'icon--base')} Buchung anfragen</button>
            </div>
          </form>
        </div>
        <aside class="container__aside stack-lg">
          <div class="box">
            <h3>Ihre Auswahl</h3>
            <dl class="kv">
              <dt>Ressource</dt><dd>${r ? C.escape(r.label) : '—'}</dd>
              <dt>Standort</dt><dd>${b ? C.escape(b.name) : '—'}</dd>
              <dt>Datum</dt><dd>${C.escape(state.datum || '—')}</dd>
              <dt>Zeit</dt><dd>${C.escape(state.zeit || '—')}</dd>
            </dl>
          </div>
          <div class="box">
            <h3>Hinweis</h3>
            <p class="small muted" style="margin:0">Arbeitsplätze werden im Desk-Sharing-Modell vergeben.
              Buchungen sind unter <a href="#/my-cases">Meine Vorgänge</a> einsehbar.</p>
          </div>
        </aside>
      </div>`;
  }

  function doneBuchung() {
    const i = state.created;
    return `
      <div class="stack-lg" style="max-width:50rem">
        ${C.notification(`<strong>Buchung angefragt.</strong> Ihre Referenz: <strong>${C.escape(i.reference)}</strong>`, 'success', 'CheckmarkCircle')}
        <div>
          <h2>Vielen Dank</h2>
          <p>Ihre Ressourcenbuchung «${C.escape(i.title)}» wurde erfasst und wird durch Workspace BBL
             bestätigt. Den Status sehen Sie jederzeit unter «Meine Vorgänge».</p>
        </div>
        <div class="row">
          <a class="btn btn--outline" href="#/my-cases/${i.instanceId}">Vorgang ansehen ${C.icon('ArrowRight', 'icon--base')}</a>
          <button class="btn btn--outline" type="button" id="buchung-neu">Weitere Buchung</button>
        </div>
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
    if (!state.ressourcentyp) e.ressourcentyp = 'Bitte Ressourcentyp wählen';
    if (!state.bld) e.bld = 'Bitte Standort wählen';
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
        if (!validate()) { draw(); return; }
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
        if (!state.created) C.flashError(mount, 'Die Buchung konnte nicht gespeichert werden — bitte erneut versuchen.');
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
