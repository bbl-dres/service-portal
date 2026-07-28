// Gebäude erfassen — Anlegen eines neuen Objekts im Immobilien-Stammdatenbestand.
//
// Vorbild: property-inventory/prototype-workflows. Von dort übernommen ist die
// Kernidee «Datenqualität von Anfang an»: Adresse, Ort, Koordinaten UND die
// Objektbezeichnung werden nicht abgetippt, sondern aus den offenen
// swisstopo-Diensten abgeleitet; der Erfassende setzt nur die Lage auf der
// Karte. Bewusst NICHT übernommen sind dessen
// Kataster-Verkettungen (EGID über das GWR-Layer, EGRID/Parzelle über
// MapServer/find) — die brauchen mehrere abhängige Aufrufe je Objekt und tragen
// für die Demo nichts bei.
//
// Genutzt wird ein einziger Endpunkt, schlüssellos und CORS-freigegeben:
//   GET https://api3.geo.admin.ch/rest/services/api/SearchServer
//       ?type=locations&origins=address&sr=4326&searchText=…
//
// Drei Schritte: Standort (Suche als Auflage IN der Karte) → Stammdaten →
// Prüfen und Einreichen. Der Vorgang landet unter «Meine Vorgänge».

import { initPickerMap } from '../buildings-map.js';

const SEARCH_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';
const STEP_LABELS = ['Standort', 'Stammdaten', 'Prüfen & Einreichen'];

// swisstopo liefert `label` als HTML-Schnipsel mit <b>-Hervorhebungen. Als Text
// weiterverwenden, nie als Markup: es ist Fremdinhalt.
function plainLabel(html) {
  const d = document.createElement('div');
  d.innerHTML = String(html || '');
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

// «Fellerstrasse 21 3003 Bern» → Strasse / Hausnummer / PLZ / Ort.
function splitAddress(label) {
  const m = /^(.*?)\s+(\d+\s*[a-zA-Z]?)\s+(\d{4})\s+(.+)$/.exec(label);
  if (m) return { street: m[1].trim(), no: m[2].replace(/\s+/g, ''), zip: m[3], city: m[4].trim() };
  const z = /(\d{4})\s+(.+)$/.exec(label);
  return { street: z ? label.slice(0, z.index).trim() : label, no: '', zip: z ? z[1] : '', city: z ? z[2].trim() : '' };
}

async function searchAddresses(query) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('type', 'locations');
  url.searchParams.set('origins', 'address');
  url.searchParams.set('searchText', query);
  url.searchParams.set('sr', '4326');
  url.searchParams.set('limit', '6');
  url.searchParams.set('lang', 'de');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`swisstopo antwortete mit ${res.status}`);
  const data = await res.json();
  return (data.results || [])
    .filter(r => r.attrs && Number.isFinite(r.attrs.lat) && Number.isFinite(r.attrs.lon))
    .map(r => ({ label: plainLabel(r.attrs.label), lat: r.attrs.lat, lon: r.attrs.lon }));
}

export default async function render(ctx) {
  const { mount, core, engine, session, C, setTitle, setCrumbs, navigate } = ctx;
  setTitle('Gebäude erfassen');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen', href: '#/services' },
    { label: 'Gebäude erfassen' }]);

  // Persönlicher Vorgang — abgemeldet zum Login auffordern, statt unten
  // session.user() zu dereferenzieren (Direktaufruf-Schutz, wie space-request).
  if (!session.isLoggedIn()) {
    mount.innerHTML = `
    <div class="container section container--grid">
      <div class="container__center--xs">
        ${C.pageHeader({ title: 'Gebäude erfassen', lead: 'Ein neues Gebäude im Immobilien-Stammdatenbestand anlegen.' })}
        ${C.loginGate('Das Erfassen eines Gebäudes wird als Vorgang unter «Meine Vorgänge» geführt. Bitte melden Sie sich mit AGOV / FedLogin an.')}
      </div>
    </div>`;
    return;
  }

  const ref = core.ref();
  const tiers = ref.classificationTiers || [];
  const PORTFOLIO = ['Verwaltungsgebäude', 'Diplomatische Vertretung', 'Lager / Logistik',
    'Ausbildung', 'Wohnliegenschaft', 'Infrastruktur IT'];
  const OWNERSHIP = ['Eigentum Bund', 'Miete'];

  const state = {
    step: 1,
    // Schritt 1 — aus swisstopo abgeleitet, nicht eingetippt
    address: '', street: '', no: '', zip: '', city: '', lat: null, lng: null,
    // Schritt 2 — Handeingabe
    portfolio: PORTFOLIO[0], ownership: OWNERSHIP[0], baujahr: '', gf: '',
    classification: (tiers[0] || {}).id || 'INTERN',
    org: session.user().org,
    errors: {}, created: null,
  };

  let pickerMap = null;
  let searchTimer = null;
  let activeIdx = -1;
  let suggestions = [];

  // Die Objektbezeichnung IST die Adresse — sie wird abgeleitet, nicht getippt.
  // Damit kann sie nicht von den Adressfeldern abweichen (der frühere Freitext
  // liess genau das zu, inklusive Tippfehlern im Inventarnamen).
  const bezeichnung = () => [`${state.street} ${state.no}`.trim(), `${state.zip} ${state.city}`.trim()]
    .filter(Boolean).join(', ');

  const freeMap = () => { if (pickerMap) { try { pickerMap.remove(); } catch { /* schon weg */ } pickerMap = null; } };

  const FIELD_LABELS = {
    'bc-address': 'Adresse',
    'bc-baujahr': 'Baujahr', 'bc-gf': 'Geschossfläche (GF)',
  };

  /* ------------------------------------------------------------ Schritt 1 -- */
  function step1() {
    const coords = state.lat != null
      ? `${state.lat.toFixed(5)}, ${state.lng.toFixed(5)}`
      : '';
    return `
      <p class="small muted">Adresse suchen und die Lage auf der Karte bestätigen.</p>

      ${/* Die Suche liegt als Auflage IN der Karte (unten zentriert). Die
            Vorschlagsliste öffnet deshalb NACH OBEN, sonst stünde sie ausserhalb
            des Kartenrahmens. Combobox-Semantik nach WAI-ARIA APG. */''}
      <div class="map-picker" id="bc-picker">
        <div class="map-picker__canvas"></div>
        <div class="map-search">
          <ul class="map-search__list" id="bc-listbox" role="listbox" aria-label="Adressvorschläge" hidden></ul>
          <div class="map-search__field">
            ${C.icon('Search', 'map-search__icon')}
            <input id="bc-address" class="input--outline input--base" type="text" role="combobox"
              autocomplete="off" spellcheck="false"
              aria-expanded="false" aria-controls="bc-listbox" aria-autocomplete="list"
              aria-describedby="bc-address-hint"
              placeholder="Adresse suchen, z. B. Fellerstrasse 21 Bern"
              value="${C.escape(state.address)}">
            <button type="button" class="map-search__clear" id="bc-clear" aria-label="Eingabe löschen"${state.address ? '' : ' hidden'}>
              ${C.icon('Cancel', 'icon--base')}</button>
          </div>
        </div>
      </div>
      <p id="bc-address-hint" class="small muted">Nadel ziehen oder in die Karte klicken, um die Lage zu justieren.</p>
      <div id="bc-status" aria-live="polite"></div>

      ${state.errors['bc-address'] ? `<div class="notification notification--error" role="alert">${C.icon('WarningCircle', 'icon--lg')}<div>${C.escape(state.errors['bc-address'])}</div></div>` : ''}

      ${state.lat != null ? `
        <dl class="kv">
          <dt>Strasse / Nr.</dt><dd>${C.escape(state.street)} ${C.escape(state.no)}</dd>
          <dt>PLZ / Ort</dt><dd>${C.escape(state.zip)} ${C.escape(state.city)}</dd>
          <dt>Koordinaten (WGS 84)</dt><dd>${C.escape(coords)}</dd>
        </dl>` : ''}

      <div class="row mt-4" style="justify-content:flex-end">
        <button class="btn btn--filled" type="submit">Weiter ${C.icon('ArrowRight', 'icon--base')}</button>
      </div>`;
  }

  /* ------------------------------------------------------------ Schritt 2 -- */
  function step2() {
    return `
      ${C.field({ id: 'bc-bez', label: 'Objektbezeichnung',
        hint: 'Wird aus der Adresse übernommen und kann hier nicht geändert werden.',
        control: (cls, attrs) => `<input id="bc-bez" value="${C.escape(bezeichnung())}" class="${cls}" readonly${attrs}>` })}
      ${C.select({ id: 'bc-portfolio', name: 'bc-portfolio', label: 'Portfolio-Kategorie', value: state.portfolio,
        options: PORTFOLIO.map(v => ({ value: v, label: v })) })}
      ${C.select({ id: 'bc-ownership', name: 'bc-ownership', label: 'Eigentumsverhältnis', value: state.ownership,
        options: OWNERSHIP.map(v => ({ value: v, label: v })) })}
      ${C.field({ id: 'bc-baujahr', label: 'Baujahr', message: state.errors['bc-baujahr'],
        control: (cls, attrs) => `<input id="bc-baujahr" type="number" min="1200" max="2100" placeholder="z. B. 1974" value="${C.escape(state.baujahr)}" class="${cls}"${attrs}>` })}
      ${C.field({ id: 'bc-gf', label: 'Geschossfläche (GF) in m²', message: state.errors['bc-gf'],
        control: (cls, attrs) => `<input id="bc-gf" type="number" min="0" placeholder="z. B. 8500" value="${C.escape(state.gf)}" class="${cls}"${attrs}>` })}
      ${C.select({ id: 'bc-classification', name: 'bc-classification', label: 'Klassifizierung', value: state.classification,
        options: tiers.map(t => ({ value: t.id, label: t.label })) })}
      ${C.field({ id: 'bc-org', label: 'Verantwortliche Organisationseinheit',
        control: (cls, attrs) => `<input id="bc-org" value="${C.escape(state.org)}" class="${cls}"${attrs}>` })}
      <div class="row mt-4" style="justify-content:space-between">
        <button class="btn btn--bare" type="button" data-back>${C.icon('ChevronLeft', 'icon--base')}<span class="btn__text">Zurück</span></button>
        <button class="btn btn--filled" type="submit">Weiter ${C.icon('ArrowRight', 'icon--base')}</button>
      </div>`;
  }

  /* ------------------------------------------------------------ Schritt 3 -- */
  function step3() {
    const tier = tiers.find(t => t.id === state.classification);
    return `
      ${/* h3, nicht h2: die Schrittüberschrift oben ist die h2 dieses Abschnitts. */''}
      <h3>Zusammenfassung</h3>
      <dl class="kv">
        <dt>Objektbezeichnung</dt><dd>${C.escape(bezeichnung())}</dd>
        <dt>Adresse</dt><dd>${C.escape(`${state.street} ${state.no}, ${state.zip} ${state.city}`.trim())}</dd>
        <dt>Koordinaten (WGS 84)</dt><dd>${state.lat != null ? `${state.lat.toFixed(5)}, ${state.lng.toFixed(5)}` : '—'}</dd>
        <dt>Portfolio-Kategorie</dt><dd>${C.escape(state.portfolio)}</dd>
        <dt>Eigentumsverhältnis</dt><dd>${C.escape(state.ownership)}</dd>
        <dt>Baujahr</dt><dd>${C.escape(state.baujahr || '—')}</dd>
        <dt>Geschossfläche (GF)</dt><dd>${state.gf ? `${Number(state.gf).toLocaleString('de-CH')} m²` : '—'}</dd>
        <dt>Klassifizierung</dt><dd>${C.badge(tier ? tier.label : state.classification, tier ? tier.variant : 'gray')}</dd>
        <dt>Verantwortliche OE</dt><dd>${C.escape(state.org)}</dd>
      </dl>
      ${C.notification('Mit dem Absenden entsteht ein Vorgang. Die Objekt-ID (bbl_id) und die abgeleiteten Schlüssel (EGID, EGRID) vergibt das Portfoliomanagement bei der Prüfung — im Prototyp bleiben sie leer.', 'info')}
      <div class="row mt-4" style="justify-content:space-between">
        <button class="btn btn--bare" type="button" data-back>${C.icon('ChevronLeft', 'icon--base')}<span class="btn__text">Zurück</span></button>
        <button class="btn btn--filled btn--lg" type="submit">${C.icon('Checkmark', 'icon--base')} Erfassung einreichen</button>
      </div>`;
  }

  /* ------------------------------------------------------------ Prüfungen -- */
  function validate() {
    const e = {};
    if (state.step === 1) {
      if (state.lat == null) e['bc-address'] = 'Bitte eine Adresse suchen oder die Lage in der Karte anklicken.';
    }
    if (state.step === 2) {
      const y = Number(state.baujahr);
      if (state.baujahr && (!Number.isInteger(y) || y < 1200 || y > 2100)) e['bc-baujahr'] = 'Bitte ein Jahr zwischen 1200 und 2100 angeben.';
      if (state.gf && !(Number(state.gf) >= 0)) e['bc-gf'] = 'Bitte eine Fläche in m² angeben (0 oder mehr).';
    }
    state.errors = e;
    return !Object.keys(e).length;
  }

  function readStep() {
    const v = (id) => { const el = mount.querySelector('#' + id); return el ? el.value : ''; };
    if (state.step === 2) {
      state.portfolio = v('bc-portfolio'); state.ownership = v('bc-ownership');
      state.baujahr = v('bc-baujahr'); state.gf = v('bc-gf');
      state.classification = v('bc-classification'); state.org = v('bc-org');
    }
  }

  /* ---------------------------------------------------------------- Draw --- */
  function draw() {
    if (state.created) return drawDone();
    const restore = C.preserveFocus(mount);
    freeMap();
    mount.innerHTML = `
    <div class="container section container--grid">
      <div class="container__center--sm">
        ${C.backLink('#/services/gebaeude-erfassen', 'Service-Beschreibung')}
        <h1 tabindex="-1">Gebäude erfassen</h1>
        ${C.stepIndicator(STEP_LABELS, state.step - 1, { label: 'Erfassungsschritte' })}
        <h2 class="sr-only" id="bc-step-head" tabindex="-1">Schritt ${state.step} von 3: ${C.escape(STEP_LABELS[state.step - 1])}</h2>
        ${/* Nur Schritt 2 hat mit «*» markierte Felder — auf Schritt 1 stand die
              Legende zu einem Zeichen, das dort nirgends vorkommt. */''}
        ${state.step === 2 ? '<p class="small muted">Mit <span class="text--asterisk" aria-hidden="true"></span> markierte Felder sind Pflichtfelder.</p>' : ''}
        ${C.errorSummary({ errors: state.errors, labels: FIELD_LABELS })}
        <!-- novalidate — siehe space-request.js: ohne das Attribut feuert das
             submit-Event nie und validate() bleibt unerreichbar. -->
        <form id="bc-form" class="form" novalidate>${state.step === 1 ? step1() : state.step === 2 ? step2() : step3()}</form>
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
        ${C.notification(`<strong>Erfassung eingereicht.</strong> Ihre Referenz: <strong>${C.escape(i.reference)}</strong>`, 'success', 'CheckmarkCircle')}
        <h1 tabindex="-1" class="mt-6">Gebäude erfasst</h1>
        <p class="lead">Das Objekt «${C.escape(bezeichnung())}» ist zur Prüfung beim Portfoliomanagement.</p>
        <dl class="kv">
          <dt>Referenz</dt><dd>${C.escape(i.reference)}</dd>
          <dt>Adresse</dt><dd>${C.escape(`${state.street} ${state.no}, ${state.zip} ${state.city}`.trim())}</dd>
          <dt>Status</dt><dd>${C.statusBadge(i.status, 'Eingereicht')}</dd>
        </dl>
        <div class="row mt-6">
          <a class="btn btn--filled" href="#/my-cases/${encodeURIComponent(i.instanceId)}">Vorgang ansehen ${C.icon('ArrowRight', 'icon--base')}</a>
          <a class="btn btn--outline" href="#/services">Zu den Dienstleistungen</a>
        </div>
      </div>
    </div>`;
    const h = mount.querySelector('h1'); if (h) h.focus({ preventScroll: true });
  }

  function focusStepHeading() {
    const h = mount.querySelector('#bc-step-head') || mount.querySelector('h1');
    if (h) h.focus({ preventScroll: true });
    C.announce(`Schritt ${state.step} von 3: ${STEP_LABELS[state.step - 1]}`);
  }

  /* ------------------------------------------------------------- Verkabeln - */
  function closeList() {
    const box = mount.querySelector('#bc-listbox');
    const inp = mount.querySelector('#bc-address');
    if (box) { box.hidden = true; box.innerHTML = ''; }
    if (inp) { inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); }
    activeIdx = -1; suggestions = [];
  }

  function renderList(items) {
    const box = mount.querySelector('#bc-listbox');
    const inp = mount.querySelector('#bc-address');
    if (!box || !inp) return;
    suggestions = items; activeIdx = -1;
    if (!items.length) { closeList(); return; }
    box.innerHTML = items.map((it, n) =>
      `<li class="map-search__option" role="option" id="bc-opt-${n}" aria-selected="false" data-idx="${n}">
        ${C.icon('MapMarker', 'icon--sm')}<span>${C.escape(it.label)}</span></li>`).join('');
    box.hidden = false;
    inp.setAttribute('aria-expanded', 'true');
  }

  function highlight(n) {
    const box = mount.querySelector('#bc-listbox');
    const inp = mount.querySelector('#bc-address');
    if (!box || !suggestions.length) return;
    activeIdx = (n + suggestions.length) % suggestions.length;
    [...box.querySelectorAll('[role="option"]')].forEach((li, i) => {
      const on = i === activeIdx;
      li.classList.toggle('is-active', on);
      li.setAttribute('aria-selected', String(on));
      if (on) { inp.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
    });
  }

  function pick(idx) {
    const s = suggestions[idx];
    if (!s) return;
    const parts = splitAddress(s.label);
    Object.assign(state, {
      address: s.label, street: parts.street, no: parts.no, zip: parts.zip, city: parts.city,
      lat: s.lat, lng: s.lon, errors: {},
    });
    closeList();
    // Karte NICHT neu aufbauen: nur die Nadel setzen und heranfahren. Ein
    // Neurender würde die MapLibre-Instanz wegwerfen und das Kachelnachladen
    // bei jedem Tastendruck neu auslösen.
    if (pickerMap && pickerMap.__setPin) pickerMap.__setPin(s.lat, s.lon);
    redrawFacts();
  }

  // Nur die Faktenliste + Bestätigungshaken neu schreiben, damit die Karte steht.
  function redrawFacts() {
    const inp = mount.querySelector('#bc-address');
    if (inp) inp.value = state.address;
    const clear = mount.querySelector('#bc-clear');
    if (clear) clear.hidden = !state.address;
    const st = mount.querySelector('#bc-status');
    if (!st) return;
    st.innerHTML = state.lat == null ? '' : `
      <dl class="kv">
        <dt>Strasse / Nr.</dt><dd>${C.escape(state.street)} ${C.escape(state.no)}</dd>
        <dt>PLZ / Ort</dt><dd>${C.escape(state.zip)} ${C.escape(state.city)}</dd>
        <dt>Koordinaten (WGS 84)</dt><dd>${state.lat.toFixed(5)}, ${state.lng.toFixed(5)}</dd>
      </dl>`;
  }

  function wire() {
    const form = mount.querySelector('#bc-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      readStep();
      if (!validate()) { draw(); const s = mount.querySelector('.error-summary a'); if (s) s.focus(); return; }
      if (state.step < 3) { state.step += 1; draw(); focusStepHeading(); return; }
      const inst = engine.start('gebaeude-erfassung', {
        title: `Gebäude erfassen — ${bezeichnung()}`.trim(),
        organization: state.org,
        requester: session.user().name,
        data: {
          bezeichnung: bezeichnung(), strasse: `${state.street} ${state.no}`.trim(),
          plz: state.zip, ort: state.city, lat: state.lat, lng: state.lng,
          portfolio: state.portfolio, eigentum: state.ownership,
          baujahr: state.baujahr, gf: state.gf, klassifizierung: state.classification,
        },
      });
      state.created = inst;
      freeMap();
      draw();
      C.announce(`Erfassung eingereicht. Referenz ${inst.reference}`);
    });

    const back = form.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => { readStep(); state.step -= 1; draw(); focusStepHeading(); });

    // Fehlermeldung verschwindet, sobald der Nutzer das Feld korrigiert.
    Object.keys(state.errors).forEach((id) => {
      const el = mount.querySelector('#' + id);
      if (el) el.addEventListener('input', () => {
        if (!state.errors[id]) return;
        delete state.errors[id];
        const grp = el.closest('.form__group');
        const msg = grp && grp.querySelector('[role="alert"]');
        if (msg) msg.remove();
        el.classList.remove('input--error');
        el.removeAttribute('aria-invalid');
      }, { once: true });
    });

    if (state.step !== 1) return;

    /* ---- Schritt 1: Karte + Suchauflage ---- */
    const picker = mount.querySelector('#bc-picker');
    const inp = mount.querySelector('#bc-address');
    const clear = mount.querySelector('#bc-clear');
    const box = mount.querySelector('#bc-listbox');
    if (!picker || !inp) return;

    // Die Auflage liegt ÜBER dem MapLibre-Canvas. Ohne das Stoppen der
    // Weitergabe würde jeder Klick ins Feld die Karte verschieben und jedes
    // Scrollen in der Vorschlagsliste sie zoomen.
    const swallow = (e) => e.stopPropagation();
    const overlay = picker.querySelector('.map-search');
    ['pointerdown', 'mousedown', 'click', 'dblclick', 'wheel', 'touchstart'].forEach(
      (t) => overlay.addEventListener(t, swallow, { passive: t === 'wheel' ? false : undefined }));

    initPickerMap(picker, {
      lat: state.lat, lng: state.lng,
      onPick: (la, ln) => {
        // Nadel von Hand verschoben: Koordinaten übernehmen. Die Adresse aus
        // swisstopo gilt danach nur noch als Hinweis auf die Umgebung.
        state.lat = la; state.lng = ln;
        redrawFacts();
        C.announce('Standort angepasst.');
      },
    }).then((m) => { pickerMap = m; }).catch(() => { /* Karte optional */ });

    if (clear) clear.addEventListener('click', () => {
      inp.value = ''; clear.hidden = true; closeList(); inp.focus();
    });

    inp.addEventListener('input', () => {
      clearTimeout(searchTimer);
      if (clear) clear.hidden = !inp.value;
      const q = inp.value.trim();
      if (q.length < 3) { closeList(); return; }
      // 300ms Ruhe vor dem Aufruf — sonst ein Treffer pro Tastendruck.
      searchTimer = setTimeout(async () => {
        try {
          renderList(await searchAddresses(q));
        } catch (err) {
          closeList();
          C.announce('Die Adresssuche ist nicht erreichbar.');
          const st = mount.querySelector('#bc-status');
          if (st) st.innerHTML = `<div class="empty empty--unavailable">${C.icon('WarningCircle', 'icon--base')}
            <span>Adresssuche nicht erreichbar (${C.escape(err.message)}). Sie können die Lage stattdessen direkt in der Karte anklicken.</span></div>`;
        }
      }, 300);
    });

    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (suggestions.length) highlight(activeIdx + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (suggestions.length) highlight(activeIdx - 1); }
      else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(activeIdx); }
      else if (e.key === 'Escape' && !box.hidden) { e.preventDefault(); closeList(); }
    });

    box.addEventListener('click', (e) => {
      const li = e.target.closest('[data-idx]');
      if (li) pick(Number(li.dataset.idx));
    });
    box.addEventListener('mousemove', (e) => {
      const li = e.target.closest('[data-idx]');
      if (li) highlight(Number(li.dataset.idx));
    });

    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target)) closeList();
    }, { once: true });

    redrawFacts();
  }

  if (ctx.stale && ctx.stale()) return;
  draw();
}
