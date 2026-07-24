// Workspace & Buchung — Möblierung & Material, Belegungsplanung und interaktive Ressourcenbuchung.
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

  // ---- helpers -----------------------------------------------------------
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

  function selectWrap(id, options) {
    return `<div class="select"><select id="${id}" class="input--outline input--base">${options}</select><div class="select__icon">${C.chevron}</div></div>`;
  }

  // ---- tab panels --------------------------------------------------------
  function panelMoeblierung() {
    return `
      <div class="split">
        <div class="stack">
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
        <aside class="stack-lg">
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
      <div class="split">
        <div class="stack">
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
        <aside class="stack-lg">
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
    const b = core.building(state.buildingId);
    const r = RESSOURCEN.find(x => x.id === state.ressourcentyp);
    return `
      <div class="split">
        <div class="stack">
          <h2>${C.icon('Calendar', 'icon--base')} Ressource buchen</h2>
          <p class="muted">Buchung als <strong>${C.escape(session.user().name)}</strong> · ${C.escape(session.user().org)}.
             Eine Anfrage wird als Vorgang erfasst und durch Workspace BBL bestätigt.</p>
          <form id="buchung-form" class="form">
            ${field('ressourcentyp', 'Ressourcentyp <span class="req">*</span>',
              selectWrap('ressourcentyp', RESSOURCEN.map(x =>
                `<option value="${x.id}"${x.id === state.ressourcentyp ? ' selected' : ''}>${C.escape(x.label)}</option>`).join('')),
              null, r ? r.hint : '')}
            ${field('bld', 'Standort <span class="req">*</span>',
              selectWrap('bld', buildings.map(x =>
                `<option value="${x.bbl_id}"${x.bbl_id === state.buildingId ? ' selected' : ''}>${C.escape(x.name)} — ${C.escape(x.city)}</option>`).join('')))}
            ${field('datum', 'Datum <span class="req">*</span>',
              `<input id="datum" type="date" value="${C.escape(state.datum)}">`, state.errors.datum)}
            ${field('zeit', 'Zeit',
              selectWrap('zeit', ZEITEN.map(z =>
                `<option value="${C.escape(z)}"${z === state.zeit ? ' selected' : ''}>${C.escape(z)}</option>`).join('')))}
            ${field('bemerkung', 'Bemerkung',
              `<textarea id="bemerkung" placeholder="z. B. benötigte Ausstattung, Personenzahl, besondere Wünsche">${C.escape(state.bemerkung)}</textarea>`)}
            <div class="row" style="justify-content:flex-end">
              <button class="btn btn--filled btn--lg" type="submit">${C.icon('Checkmark', 'icon--base')} Buchung anfragen</button>
            </div>
          </form>
        </div>
        <aside class="stack-lg">
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
    const controls = TABS.map(t => {
      const on = t.id === state.tab;
      return `<button class="tab__control${on ? " tab__control--active" : ""}" type="button" role="tab"
         id="wtab-${t.id}" aria-controls="wpanel" aria-selected="${on}" tabindex="${on ? '0' : '-1'}"
         data-tab="${t.id}">${C.icon(t.icon, 'icon--base')} ${C.escape(t.label)}</button>`;
    }).join('');

    const panel = state.tab === 'moeblierung' ? panelMoeblierung()
      : state.tab === 'belegung' ? panelBelegung()
      : panelBuchung();

    mount.innerHTML = `
    <div class="container section">
      ${C.pageHeader({ title: 'Workspace & Buchung', lead: 'Möblierung und Material, Belegungsplanung sowie Buchung von Räumen, Arbeitsplätzen und Parkplätzen.' })}
      <div class="tabs">
        <div class="tab__controls-container"><div class="tab__controls" role="tablist">${controls}</div></div>
        <div class="tab__container" role="tabpanel" id="wpanel" aria-labelledby="wtab-${state.tab}" tabindex="0">${panel}</div>
      </div>
    </div>`;
    wire();
  }

  function val(id) { const el = mount.querySelector('#' + id); return el ? el.value : ''; }

  function readForm() {
    state.ressourcentyp = val('ressourcentyp') || state.ressourcentyp;
    state.buildingId = val('bld') || state.buildingId;
    state.datum = val('datum');
    state.zeit = val('zeit') || state.zeit;
    state.bemerkung = val('bemerkung');
  }

  function validate() {
    const e = {};
    if (!state.datum) e.datum = 'Bitte ein Datum wählen';
    state.errors = e;
    return Object.keys(e).length === 0;
  }

  function wire() {
    // tab switching — Klick + Pfeiltasten/Home/End (APG Tabs). Bei Wechsel wird
    // die neu aktive Registerkarte fokussiert (roving tabindex im Markup).
    const tabs = [...mount.querySelectorAll('.tab__control')];
    const goto = (id) => {
      if (state.tab === 'buchung' && !state.created) readForm();
      state.tab = id;
      draw();
      mount.querySelector('#wtab-' + id)?.focus();
    };
    tabs.forEach((btn, i) => {
      btn.addEventListener('click', () => goto(btn.getAttribute('data-tab')));
      btn.addEventListener('keydown', (e) => {
        let ni = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ni = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ni = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') ni = 0;
        else if (e.key === 'End') ni = tabs.length - 1;
        if (ni !== null) { e.preventDefault(); goto(tabs[ni].getAttribute('data-tab')); }
      });
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
