// Gebäude erfassen — Anlegen eines neuen Objekts im Immobilien-Stammdatenbestand.
//
// Vorbild: property-inventory/prototype-workflows. Von dort übernommen ist die
// Kernidee «Datenqualität von Anfang an»: Adresse, Ort, Koordinaten UND die
// Objektbezeichnung werden nicht abgetippt, sondern aus den offenen
// swisstopo-Diensten abgeleitet; der Erfassende setzt nur die Lage auf der
// Karte. EGID und EGRID stehen als Nur-Lese-Felder im Formular, bleiben hier
// aber leer: sie gehören nicht in die Handeingabe, sondern werden später über
// REST anhand der Lage aufgelöst (GWR-Layer für die EGID, MapServer/find für
// EGRID und Parzelle — mehrere abhängige Aufrufe je Objekt, wie in
// property-inventory/prototype-workflows).
//
// Genutzt wird ein einziger Endpunkt, schlüssellos und CORS-freigegeben:
//   GET https://api3.geo.admin.ch/rest/services/api/SearchServer
//       ?type=locations&origins=address&sr=4326&searchText=…
//
// Drei Schritte: Standort (Suche als Auflage IN der Karte) → Stammdaten →
// Prüfen und Absenden. Der Vorgang landet unter «Meine Vorgänge».

import { initPickerMap } from '../buildings-map.js';
import * as links from '../links.js';
import { DIENSTLEISTUNGEN, trail } from '../crumbs.js';
import { createListboxController } from '../combobox.js';

// Wortlaut der Anmeldesperre, die der Router vor diese Anwendung zieht
// (js/router.js).
export const loginText = 'Das Erfassen eines Gebäudes wird als Vorgang unter «Meine Vorgänge» geführt. Bitte melden Sie sich mit AGOV / FedLogin an.';

const SEARCH_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';
const STEP_LABELS = ['Standort', 'Stammdaten', 'Prüfen & Absenden'];

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

async function searchAddresses(query, { signal } = {}) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('type', 'locations');
  url.searchParams.set('origins', 'address');
  url.searchParams.set('searchText', query);
  url.searchParams.set('sr', '4326');
  url.searchParams.set('limit', '6');
  url.searchParams.set('lang', 'de');
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`swisstopo antwortete mit ${res.status}`);
  const data = await res.json();
  return (data.results || [])
    .filter(r => r.attrs && Number.isFinite(r.attrs.lat) && Number.isFinite(r.attrs.lon))
    .map(r => ({ label: plainLabel(r.attrs.label), lat: r.attrs.lat, lon: r.attrs.lon }));
}

export default async function render(ctx) {
  const { mount, core, engine, session, C, setTitle, setCrumbs, navigate } = ctx;
  setTitle('Gebäude erfassen');
  setCrumbs(trail(DIENSTLEISTUNGEN, { label: 'Gebäude erfassen' }));

  // Kontrollierte Vokabulare aus den Referenzdaten statt einer Liste im Formular:
  // `teilportfolios` (SAP-Feld bbl_port) und `gebaeudearten` (bbl_gbda1) tragen
  // genau die Werte, die der Golden Record führt — so kann die Erfassung keinen
  // Wert erzeugen, den das Inventar hinterher nicht kennt.
  const ref = core.ref();
  const asOptions = (list) => (list || []).map((x) => ({ value: x.id, label: x.label }));
  const TEILPORTFOLIO = asOptions(ref.teilportfolios);
  const GEBAEUDEART = asOptions(ref.gebaeudearten);
  const OWNERSHIP = ['Eigentum Bund', 'Miete'];
  // Leere Vorauswahl: eine Pflichtauswahl, die schon ausgefüllt ist, ist keine.
  // Ein stillschweigend gesetztes Teilportfolio wäre erfundenes Stammdatum.
  const PLEASE_PICK = { value: '', label: 'Bitte wählen…' };

  const state = {
    step: 1,
    // Schritt 1 — aus swisstopo abgeleitet, nicht eingetippt
    address: '', addressSelected: false,
    street: '', no: '', zip: '', city: '', lat: null, lng: null,
    // Schritt 2 — abgeleitet; bleibt leer, bis GWR/Kataster angebunden sind
    egid: '', egrid: '',
    // Schritt 2 — Handeingabe
    portfolio: '', gebaeudeart: '', ownership: OWNERSHIP[0], baujahr: '',
    // Kein Formularfeld: die verantwortliche OE steht in der Sitzung. Sie als
    // Feld anzubieten hiesse, sie zur Debatte zu stellen — der Vorgang wird
    // ohnehin unter der angemeldeten Einheit geführt. Sichtbar ist sie in der
    // Kopfzeile und in der Zusammenfassung.
    org: session.user().org,
    errors: {}, created: null,
  };

  let pickerMap = null;
  let searchTimer = null;
  let searchRequest = null;
  let searchVersion = 0;
  let addressCombobox = null;
  const cancelAddressSearch = () => {
    clearTimeout(searchTimer);
    searchTimer = null;
    searchVersion += 1;
    searchRequest?.abort();
    searchRequest = null;
  };
  ctx.onUnmount(() => {
    cancelAddressSearch();
    addressCombobox?.destroy();
  });

  // Die Objektbezeichnung IST die Adresse — sie wird abgeleitet, nicht getippt.
  // Damit kann sie nicht von den Adressfeldern abweichen (der frühere Freitext
  // liess genau das zu, inklusive Tippfehlern im Inventarnamen).
  const bezeichnung = () => [`${state.street} ${state.no}`.trim(), `${state.zip} ${state.city}`.trim()]
    .filter(Boolean).join(', ');

  const freeMap = () => { if (pickerMap) { try { pickerMap.remove(); } catch { /* schon weg */ } pickerMap = null; } };

  const FIELD_LABELS = {
    'bc-address': 'Adresse',
    'bc-portfolio': 'Teilportfolio', 'bc-gebart': 'Gebäudeart', 'bc-baujahr': 'Baujahr',
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
            ${/* sr-only-Label wie bei der CD-Suche (search.postcss): der Platz-
                  halter verschwindet beim Tippen und ist für manche Hilfsmittel
                  kein zugänglicher Name. */''}
            <label class="sr-only" for="bc-address">Adresse suchen</label>
            ${C.icon('Search', 'map-search__icon')}
            <input id="bc-address" class="input--outline input--base${state.errors['bc-address'] ? ' input--error' : ''}" type="text" role="combobox"
              autocomplete="off" spellcheck="false"
              aria-expanded="false" aria-controls="bc-listbox" aria-autocomplete="list"
              aria-describedby="bc-address-hint${state.errors['bc-address'] ? ' bc-address-msg' : ''}"${state.errors['bc-address'] ? ' aria-invalid="true"' : ''}
              placeholder="Adresse suchen, z. B. Fellerstrasse 21 Bern"
              value="${C.escape(state.address)}">
            <button type="button" class="map-search__clear" id="bc-clear" aria-label="Eingabe löschen"${state.address ? '' : ' hidden'}>
              ${C.icon('Cancel', 'icon--base')}</button>
          </div>
        </div>
      </div>
      ${/* Adressfehler als Standard-Feld-Badge unter dem Suchfeld (id-Konvention
            `<id>-msg`, wie C.field) — OHNE Live-Rolle: die errorSummary ist die
            eine Statusmeldung, und C.wireFieldErrors räumt die Badge beim
            Korrigieren ab. */''}
      ${state.errors['bc-address'] ? `<div class="badge badge--sm badge--error" id="bc-address-msg">${C.escape(state.errors['bc-address'])}</div>` : ''}
      <p id="bc-address-hint" class="small muted">Nach der Adressauswahl können Sie die Nadel ziehen oder die Lage in der Karte justieren.</p>
      <div id="bc-status" aria-live="polite"></div>

      ${state.lat != null ? `
        <dl class="kv">
          <dt>Strasse / Nr.</dt><dd>${C.escape(state.street)} ${C.escape(state.no)}</dd>
          <dt>PLZ / Ort</dt><dd>${C.escape(state.zip)} ${C.escape(state.city)}</dd>
          <dt>Koordinaten (WGS 84)</dt><dd>${C.escape(coords)}</dd>
        </dl>` : ''}

      ${/* form__actions statt .row: Primäraktion auf Mobile zuerst und vollbreit
            (app.css, Item 3.12). Icon VOR dem btn__text im DOM — die rechte
            Position stellt btn--icon-right per row-reverse her (CD Btn.vue). */''}
      <div class="form__actions">
        <button class="btn btn--filled btn--icon-right" type="submit">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Weiter</span></button>
      </div>`;
  }

  /* ------------------------------------------------------------ Schritt 2 -- */
  function step2() {
    return `
      ${/* Zuerst die abgeleiteten Felder (nur lesbar, gestrichelter Rahmen), dann
            die Handeingabe — als zwei <fieldset class="form__group">, damit die
            Zweiteilung nicht nur erzählt wird, sondern auch für Hilfsmittel als
            Gruppe hörbar ist (CD Fieldset.vue, Item 3.14). */''}
      <fieldset class="form__group">
        <legend class="form__group__legend">Abgeleitete Angaben</legend>
        ${C.field({ id: 'bc-bez', label: 'Objektbezeichnung',
          hint: 'Wird aus der Adresse übernommen und kann hier nicht geändert werden.',
          control: (cls, attrs) => `<input id="bc-bez" value="${C.escape(bezeichnung())}" class="${cls}" readonly${attrs}>` })}
        ${C.field({ id: 'bc-egid', label: 'EGID (Eidg. Gebäudeidentifikator)',
          hint: 'Wird anhand der Lage aus dem Gebäude- und Wohnungsregister (GWR) ermittelt.',
          control: (cls, attrs) => `<input id="bc-egid" value="${C.escape(state.egid)}" placeholder="wird ermittelt" class="${cls}" readonly${attrs}>` })}
        ${C.field({ id: 'bc-egrid', label: 'EGRID (Eidg. Grundstücksidentifikator)',
          hint: 'Wird anhand der Lage aus der amtlichen Vermessung ermittelt.',
          control: (cls, attrs) => `<input id="bc-egrid" value="${C.escape(state.egrid)}" placeholder="wird ermittelt" class="${cls}" readonly${attrs}>` })}
      </fieldset>
      <fieldset class="form__group">
        ${/* «Weitere Stammdaten», nicht «Klassifizierung» (Nutzerentscheid
              2026-07-30): der Begriff ist im Sicherheitskontext besetzt
              (Informationsklassifizierung) und hier irreführend. */''}
        <legend class="form__group__legend">Weitere Stammdaten</legend>
        ${C.select({ id: 'bc-portfolio', name: 'bc-portfolio', label: 'Teilportfolio', required: true,
          value: state.portfolio, message: state.errors['bc-portfolio'],
          options: [PLEASE_PICK, ...TEILPORTFOLIO] })}
        ${C.select({ id: 'bc-gebart', name: 'bc-gebart', label: 'Gebäudeart', required: true,
          value: state.gebaeudeart, message: state.errors['bc-gebart'],
          options: [PLEASE_PICK, ...GEBAEUDEART] })}
        ${C.select({ id: 'bc-ownership', name: 'bc-ownership', label: 'Eigentumsverhältnis', value: state.ownership,
          options: OWNERSHIP.map(v => ({ value: v, label: v })) })}
        ${C.field({ id: 'bc-baujahr', label: 'Baujahr', required: true, message: state.errors['bc-baujahr'],
          control: (cls, attrs) => `<input id="bc-baujahr" type="number" min="1200" max="2100" placeholder="z. B. 1974" value="${C.escape(state.baujahr)}" class="${cls}"${attrs}>` })}
      </fieldset>
      <div class="form__actions form__actions--between">
        <button class="btn btn--bare btn--icon-left" type="button" data-back>${C.icon('ChevronLeft', 'btn__icon')}<span class="btn__text">Zurück</span></button>
        <button class="btn btn--filled btn--icon-right" type="submit">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Weiter</span></button>
      </div>`;
  }

  /* ------------------------------------------------------------ Schritt 3 -- */
  function step3() {
    return `
      ${/* h3, nicht h2: die Schrittüberschrift oben ist die h2 dieses Abschnitts. */''}
      <h3>Zusammenfassung</h3>
      <dl class="kv">
        <dt>Objektbezeichnung</dt><dd>${C.escape(bezeichnung())}</dd>
        <dt>Adresse</dt><dd>${C.escape(`${state.street} ${state.no}, ${state.zip} ${state.city}`.trim())}</dd>
        <dt>Koordinaten (WGS 84)</dt><dd>${state.lat != null ? `${state.lat.toFixed(5)}, ${state.lng.toFixed(5)}` : '—'}</dd>
        <dt>EGID</dt><dd>${C.escape(state.egid) || '<span class="muted">wird ermittelt</span>'}</dd>
        <dt>EGRID</dt><dd>${C.escape(state.egrid) || '<span class="muted">wird ermittelt</span>'}</dd>
        <dt>Teilportfolio</dt><dd>${C.escape(state.portfolio)}</dd>
        <dt>Gebäudeart</dt><dd>${C.escape(state.gebaeudeart)}</dd>
        <dt>Eigentumsverhältnis</dt><dd>${C.escape(state.ownership)}</dd>
        <dt>Baujahr</dt><dd>${C.escape(state.baujahr)}</dd>
        <dt>Verantwortliche OE</dt><dd>${C.escape(state.org)}</dd>
      </dl>
      ${C.notification('Mit dem Absenden wird ein Vorgang erstellt. EGID und EGRID löst der Kataster­dienst anhand der Lage auf; die Objekt-ID (bbl_id), die Flächen (GF/HNF) und die weiteren Stammdaten vergibt das Portfoliomanagement bei der Prüfung.', 'info')}
      <div class="form__actions form__actions--between">
        <button class="btn btn--bare btn--icon-left" type="button" data-back>${C.icon('ChevronLeft', 'btn__icon')}<span class="btn__text">Zurück</span></button>
        <button class="btn btn--filled btn--lg btn--icon-left" type="submit">${C.icon('Checkmark', 'btn__icon')}<span class="btn__text">Erfassung absenden</span></button>
      </div>`;
  }

  /* ------------------------------------------------------------ Prüfungen -- */
  function validate() {
    const e = {};
    if (state.step === 1) {
      if (!state.addressSelected || !state.address.trim()
          || !Number.isFinite(state.lat) || !Number.isFinite(state.lng)) {
        e['bc-address'] = 'Bitte eine Adresse aus den Vorschlägen wählen';
      }
    }
    if (state.step === 2) {
      // Anweisende Formulierung wie in space-request.js / fault-report.js — der
      // Fehler sagt, was zu tun ist, nicht bloss «Pflichtfeld».
      if (!state.portfolio) e['bc-portfolio'] = 'Bitte ein Teilportfolio wählen';
      if (!state.gebaeudeart) e['bc-gebart'] = 'Bitte eine Gebäudeart wählen';
      const y = Number(state.baujahr);
      if (!String(state.baujahr).trim()) e['bc-baujahr'] = 'Bitte das Baujahr angeben';
      else if (!Number.isInteger(y) || y < 1200 || y > 2100) e['bc-baujahr'] = 'Bitte ein Jahr zwischen 1200 und 2100 angeben';
      // `bc-ownership` steht bewusst ohne required: die Auswahl ist zweiwertig und
      // «Eigentum Bund» ist der belegte Regelfall — Markup und Prüfung beschreiben
      // damit dieselbe Menge (vgl. space-request.js zum Standort-Feld).
    }
    state.errors = e;
    return !Object.keys(e).length;
  }

  function readStep() {
    if (state.step === 2) {
      Object.assign(state, C.readForm(mount, {
        portfolio: 'bc-portfolio', gebaeudeart: 'bc-gebart', ownership: 'bc-ownership',
        baujahr: 'bc-baujahr',
      }));
    }
  }

  /* ---------------------------------------------------------------- Draw --- */
  function draw() {
    if (state.created) return drawDone();
    const restore = C.preserveFocus(mount);
    cancelAddressSearch();
    addressCombobox?.destroy();
    addressCombobox = null;
    freeMap();
    mount.innerHTML = `
    <div class="container section container--grid">
      <div class="container__center--sm">
        ${C.backLink(links.dienstleistung('gebaeude-erfassen'), 'Dienstleistungsbeschreibung')}
        <h1 tabindex="-1">Gebäude erfassen</h1>
        ${/* Wie space-request.js: unter wem erfasst wird und wohin der Vorgang
              läuft, steht als Kontextzeile — nicht als Formularfeld. */''}
        ${C.contextLine({ action: 'Erfassung', name: session.user().name, org: state.org, process: 'Eingang → Prüfung PFM → Genehmigung → Publikation' })}
        ${/* Gemeinsames Wizard-Gerüst (Review B8). headId 'bc-step-head' ist im
              Test gepinnt. Legende nur auf Schritt 2: nur dort gibt es mit «*»
              markierte Felder — auf Schritt 1 stand sie zu einem Zeichen, das
              dort nirgends vorkommt. */''}
        ${C.wizardHead(STEP_LABELS, state.step, { headId: 'bc-step-head', label: 'Erfassungsschritte', legend: state.step === 2 })}
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
        ${C.processDone({ instance: i, lead: 'Erfassung eingereicht.', title: 'Vielen Dank',
          text: `Das Objekt «${C.escape(bezeichnung())}» ist zur Prüfung beim Portfoliomanagement.`,
          extra: `<dl class="kv">
            <dt>Referenz</dt><dd>${C.escape(i.reference)}</dd>
            <dt>Adresse</dt><dd>${C.escape(`${state.street} ${state.no}, ${state.zip} ${state.city}`.trim())}</dd>
            <dt>Status</dt><dd>${C.statusBadge(i.status, 'Eingereicht')}</dd>
          </dl>`,
          actions: [
            { href: links.vorgang(i.instanceId), label: 'Vorgang ansehen', icon: 'ArrowRight' },
            { href: '#/services', label: 'Zu den Dienstleistungen' },
          ] })}
      </div>
    </div>`;
    // Fokus auf die Erfolgsüberschrift + Ansage der Referenz (gemeinsamer Helfer).
    C.focusProcessDone(mount, i);
  }

  /* ------------------------------------------------------------- Verkabeln - */
  function closeList() {
    if (addressCombobox) addressCombobox.close();
  }

  function renderList(items) {
    const box = mount.querySelector('#bc-listbox');
    const inp = mount.querySelector('#bc-address');
    if (!box || !inp) return;
    if (!items.length) { closeList(); return; }
    box.innerHTML = items.map((it, n) =>
      `<li class="map-search__option" role="option" id="bc-opt-${n}" aria-selected="false" data-idx="${n}">
        ${C.icon('MapMarker', 'icon--sm')}<span>${C.escape(it.label)}</span></li>`).join('');
    addressCombobox.setItems(items);
  }

  function pick(s) {
    if (!s) return;
    cancelAddressSearch();
    const parts = splitAddress(s.label);
    Object.assign(state, {
      address: s.label, addressSelected: true,
      street: parts.street, no: parts.no, zip: parts.zip, city: parts.city,
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
      // Fehlversuch: neu zeichnen, dann die Fehlerübersicht verdrahten. C.wireErrorSummary
      // setzt den Fokus auf ihre Überschrift UND macht ihre Sprungmarken funktionsfähig —
      // vorher waren es nackte Anker, und der Fokus sprang auf den ersten Link statt auf
      // die Überschrift, die sagt, wie viele Felder zu korrigieren sind (WCAG 3.3.1).
      if (!validate()) { draw(); C.wireErrorSummary(mount); return; }
      if (state.step < 3) { state.step += 1; draw(); C.focusWizardStep(mount, STEP_LABELS, state.step, { headId: 'bc-step-head' }); return; }
      const inst = engine.start('gebaeude-erfassung', {
        title: `Gebäude erfassen — ${bezeichnung()}`.trim(),
        organization: state.org,
        requester: session.user().name,
        data: {
          bezeichnung: bezeichnung(), strasse: `${state.street} ${state.no}`.trim(),
          plz: state.zip, ort: state.city, lat: state.lat, lng: state.lng,
          egid: state.egid, egrid: state.egrid,
          teilportfolio: state.portfolio, gebaeudeart: state.gebaeudeart,
          eigentum: state.ownership, baujahr: state.baujahr,
        },
      });
      // engine.start() liefert null, wenn localStorage nicht schreiben konnte —
      // ohne diese Abzweigung liefe drawDone() auf `null.reference` (gleiches
      // Muster wie in space-request.js).
      if (!inst) { C.flashError(mount, 'Der Vorgang konnte nicht gespeichert werden — bitte erneut versuchen.'); return; }
      state.created = inst;
      freeMap();
      // drawDone() fokussiert die Erfolgsüberschrift und sagt die Referenz an
      // (C.focusProcessDone) — kein eigener announce mehr nötig.
      draw();
    });

    const back = form.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => { readStep(); state.step -= 1; draw(); C.focusWizardStep(mount, STEP_LABELS, state.step, { headId: 'bc-step-head' }); });

    // Fehlermeldung verschwindet, sobald der Nutzer das Feld korrigiert —
    // gemeinsamer Helfer (id-Konvention `<id>-msg`, `input` + `change`, weil
    // zwei der Pflichtfelder <select> sind). Deckt auch die Adress-Badge ab.
    C.wireFieldErrors(mount, state.errors);

    if (state.step !== 1) return;

    /* ---- Schritt 1: Karte + Suchauflage ---- */
    const picker = mount.querySelector('#bc-picker');
    const inp = mount.querySelector('#bc-address');
    const clear = mount.querySelector('#bc-clear');
    const box = mount.querySelector('#bc-listbox');
    if (!picker || !inp || !box) return;

    addressCombobox = createListboxController({ input: inp, list: box, onChoose: pick });

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
        // Eine Kartenposition ohne Adressauswahl wäre kein vollständiges
        // Stammdatum. Die Karte verfeinert deshalb nur eine gewählte Adresse.
        if (!state.addressSelected) {
          C.announce('Bitte zuerst eine Adresse aus den Vorschlägen wählen.');
          return;
        }
        state.lat = la; state.lng = ln;
        redrawFacts();
        C.announce('Standort angepasst.');
      },
    }).then((m) => { pickerMap = m; }).catch(() => { /* Karte optional */ });
    ctx.onUnmount(freeMap);

    if (clear) clear.addEventListener('click', () => {
      cancelAddressSearch();
      Object.assign(state, {
        address: '', addressSelected: false,
        street: '', no: '', zip: '', city: '', lat: null, lng: null,
      });
      closeList();
      redrawFacts();
      inp.focus();
    });

    inp.addEventListener('input', () => {
      cancelAddressSearch();
      const typed = inp.value;
      if (typed !== state.address) {
        // Adresse, abgeleitete Felder und Koordinaten bilden eine Auswahl. Eine
        // nachträgliche Textänderung darf nicht die alte Auswahl versteckt
        // weiterverwenden.
        Object.assign(state, {
          address: typed, addressSelected: false,
          street: '', no: '', zip: '', city: '', lat: null, lng: null,
        });
        redrawFacts();
        // redrawFacts übernimmt den kontrollierten Wert; den Cursor ans Ende
        // zurücksetzen, ohne ein weiteres input-Ereignis auszulösen.
        inp.setSelectionRange(inp.value.length, inp.value.length);
      }
      if (clear) clear.hidden = !inp.value;
      const q = inp.value.trim();
      if (q.length < 3) { closeList(); return; }
      // 300ms Ruhe vor dem Aufruf — sonst ein Treffer pro Tastendruck.
      searchTimer = setTimeout(async () => {
        const version = searchVersion;
        const request = new AbortController();
        searchRequest = request;
        try {
          const items = await searchAddresses(q, { signal: request.signal });
          if (version !== searchVersion || inp.value.trim() !== q) return;
          renderList(items);
        } catch (err) {
          if (err?.name === 'AbortError' || version !== searchVersion) return;
          closeList();
          C.announce('Die Adresssuche ist nicht erreichbar.');
          const st = mount.querySelector('#bc-status');
          if (st) st.innerHTML = `<div class="empty empty--unavailable">${C.icon('WarningCircle', 'icon--base')}
            <span>Adresssuche nicht erreichbar (${C.escape(err.message)}). Bitte versuchen Sie es später erneut.</span></div>`;
        } finally {
          if (searchRequest === request) searchRequest = null;
        }
      }, 300);
    });

    // Klick ausserhalb schliesst die Vorschlagsliste. `{ once: true }` allein
    // genügte NICHT: der Horcher verschwindet erst, wenn irgendwo geklickt WIRD —
    // wer die Seite ohne Klick verlässt, hinterlässt ihn. Gemessen: ein
    // lebender document-click je Besuch, ohne Obergrenze (code-review §4).
    // Der Controller hängt am Routenwechsel und räumt unabhängig davon auf.
    const outsideAc = new AbortController();
    ctx.onUnmount(() => outsideAc.abort());
    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target)) closeList();
    }, { signal: outsideAc.signal });

    redrawFacts();
  }

  if (ctx.stale && ctx.stale()) return;
  draw();
}
