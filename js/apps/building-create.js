// Building registration adds an object to the real-estate master inventory.
// It follows property-inventory/prototype-workflows and derives address, place,
// coordinates, and object name from open swisstopo services. The operator only
// selects the map location. EGID and EGRID remain read-only and empty until
// later REST lookups resolve them from the selected location.
//
// The keyless, CORS-enabled SearchServer endpoint provides address suggestions.
// The three steps cover location, master data, and review/submission; successful
// submission creates an entry under the German UI term: `Meine Vorgänge`.
import { initPickerMap } from '../map/buildings-map.js';
import * as links from '../links.js';
import { SERVICES, trail } from '../crumbs.js';
import { createListboxController } from '../ui/combobox.js';

// Copy shown by the router's authentication gate for this application.
export const loginText = 'Das Erfassen eines Gebäudes wird als Vorgang unter «Meine Vorgänge» geführt. Bitte melden Sie sich mit AGOV / FedLogin an.';

const SEARCH_URL = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';
const STEP_LABELS = ['Standort', 'Stammdaten', 'Prüfen & Absenden'];

// swisstopo returns label as an HTML fragment with <b> highlighting. Treat it
// as untrusted text and never reuse it as markup.
function plainLabel(html) {
  const d = document.createElement('div');
  d.innerHTML = String(html || '');
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

// Parse an address such as Fellerstrasse 21 3003 Bern into street, number,
// postal code, and place.
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
  setCrumbs(trail(SERVICES, { label: 'Gebäude erfassen' }));

  // Use controlled reference-data vocabularies instead of form-local lists.
  // Raw keys `teilportfolios` and `gebaeudearten` contain the Golden Record
  // values, preventing registration from creating unknown inventory values.
  const ref = core.ref();
  const asOptions = (list) => (list || []).map((x) => ({ value: x.id, label: x.label }));
  const PORTFOLIO_OPTIONS = asOptions(ref['teilportfolios']);
  const BUILDING_TYPE_OPTIONS = asOptions(ref['gebaeudearten']);
  const OWNERSHIP = ['Eigentum Bund', 'Miete'];
  // Keep required selects empty initially; silently choosing a portfolio would
  // invent master data.
  const PLEASE_PICK = { value: '', label: 'Bitte wählen…' };

  const state = {
    step: 1,
    // Step 1 values are derived from swisstopo, never typed manually.
    address: '', addressSelected: false,
    street: '', no: '', zip: '', city: '', lat: null, lng: null,
    // Step 2 values remain derived and empty until GWR/cadastre integration.
    egid: '', egrid: '',
    // Step 2 manual input.
    portfolio: '', buildingType: '', ownership: OWNERSHIP[0], constructionYear: '',
    // The responsible organisational unit comes from the session, not a form
    // control. It remains visible in the context header and review summary.
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

  // The building name is the derived address, preventing it from diverging
  // from address fields or acquiring inventory-name typos.
  const buildingName = () => [`${state.street} ${state.no}`.trim(), `${state.zip} ${state.city}`.trim()]
    .filter(Boolean).join(', ');

  const freeMap = () => { if (pickerMap) { try { pickerMap.remove(); } catch { /* Already removed. */ } pickerMap = null; } };

  const FIELD_LABELS = {
    'bc-address': 'Adresse',
    'bc-portfolio': 'Teilportfolio', 'bc-building-type': 'Gebäudeart', 'bc-construction-year': 'Baujahr',
  };

  /* --------------------------------------------------------------- Step 1 -- */

  function step1() {
    const coords = state.lat != null
      ? `${state.lat.toFixed(5)}, ${state.lng.toFixed(5)}`
      : '';
    return `
      <p class="small muted">Adresse suchen und die Lage auf der Karte bestätigen.</p>

      ${/* Search is an overlay centred inside the bottom of the map. */''}
      <div class="map-picker" id="bc-picker">
        <div class="map-picker__canvas"></div>
        <div class="map-search">
          <ul class="listbox listbox--map" id="bc-listbox" role="listbox" aria-label="Adressvorschläge" hidden></ul>
          <div class="map-search__field">
            ${/* Match the CD search pattern with a visually hidden label. */''}
            <label class="sr-only" for="bc-address">Adresse suchen</label>
            ${C.icon('Search', 'map-search__icon')}
            <input id="bc-address" class="input--outline input--base${state.errors['bc-address'] ? ' input--error' : ''}" type="text" role="combobox"
              autocomplete="off" spellcheck="false"
              aria-expanded="false" aria-controls="bc-listbox" aria-autocomplete="list"
              aria-describedby="bc-address-hint${state.errors['bc-address'] ? ' bc-address-msg' : ''}"${state.errors['bc-address'] ? ' aria-invalid="true"' : ''}
              placeholder="Adresse suchen, z. B. Fellerstrasse 21 Bern"
              value="${C.escape(state.address)}">
            <button type="button" class="map-search__clear interactive-control" id="bc-clear" aria-label="Eingabe löschen"${state.address ? '' : ' hidden'}>
              ${C.icon('Cancel', 'icon--base')}</button>
          </div>
        </div>
      </div>
      ${/* Render the address error as a standard field badge below the search. */''}
      ${state.errors['bc-address'] ? `<div class="badge badge--sm badge--error" id="bc-address-msg">${C.escape(state.errors['bc-address'])}</div>` : ''}
      <p id="bc-address-hint" class="small muted">Nach der Adressauswahl können Sie die Nadel ziehen oder die Lage in der Karte justieren.</p>
      <div id="bc-status" aria-live="polite"></div>

      ${state.lat != null ? `
        <dl class="kv">
          <dt>Strasse / Nr.</dt><dd>${C.escape(state.street)} ${C.escape(state.no)}</dd>
          <dt>PLZ / Ort</dt><dd>${C.escape(state.zip)} ${C.escape(state.city)}</dd>
          <dt>Koordinaten (WGS 84)</dt><dd>${C.escape(coords)}</dd>
        </dl>` : ''}

      ${/* form__actions keeps the primary mobile action first and full width. */''}
      <div class="form__actions">
        <button class="btn btn--filled btn--icon-right" type="submit">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Weiter</span></button>
      </div>`;
  }

  /* --------------------------------------------------------------- Step 2 -- */

  function step2() {
    return `
      ${/* Show derived read-only fields before manually entered master data. */''}
      <fieldset class="form__group">
        <legend class="form__group__legend">Abgeleitete Angaben</legend>
        ${C.field({ id: 'bc-name', label: 'Objektbezeichnung',
          hint: 'Wird aus der Adresse übernommen und kann hier nicht geändert werden.',
          control: (cls, attrs) => `<input id="bc-name" value="${C.escape(buildingName())}" class="${cls}" readonly${attrs}>` })}
        ${C.field({ id: 'bc-egid', label: 'EGID (Eidg. Gebäudeidentifikator)',
          hint: 'Wird anhand der Lage aus dem Gebäude- und Wohnungsregister (GWR) ermittelt.',
          control: (cls, attrs) => `<input id="bc-egid" value="${C.escape(state.egid)}" placeholder="wird ermittelt" class="${cls}" readonly${attrs}>` })}
        ${C.field({ id: 'bc-egrid', label: 'EGRID (Eidg. Grundstücksidentifikator)',
          hint: 'Wird anhand der Lage aus der amtlichen Vermessung ermittelt.',
          control: (cls, attrs) => `<input id="bc-egrid" value="${C.escape(state.egrid)}" placeholder="wird ermittelt" class="${cls}" readonly${attrs}>` })}
      </fieldset>
      <fieldset class="form__group">
        ${/* The German UI term: `Weitere Stammdaten` reflects the user's chosen wording. */''}
        <legend class="form__group__legend">Weitere Stammdaten</legend>
        ${C.select({ id: 'bc-portfolio', name: 'bc-portfolio', label: 'Teilportfolio', required: true,
          value: state.portfolio, message: state.errors['bc-portfolio'],
          options: [PLEASE_PICK, ...PORTFOLIO_OPTIONS] })}
        ${C.select({ id: 'bc-building-type', name: 'bc-building-type', label: 'Gebäudeart', required: true,
          value: state.buildingType, message: state.errors['bc-building-type'],
          options: [PLEASE_PICK, ...BUILDING_TYPE_OPTIONS] })}
        ${C.select({ id: 'bc-ownership', name: 'bc-ownership', label: 'Eigentumsverhältnis', value: state.ownership,
          options: OWNERSHIP.map(v => ({ value: v, label: v })) })}
        ${C.field({ id: 'bc-construction-year', label: 'Baujahr', required: true, message: state.errors['bc-construction-year'],
          control: (cls, attrs) => `<input id="bc-construction-year" type="number" min="1200" max="2100" placeholder="z. B. 1974" value="${C.escape(state.constructionYear)}" class="${cls}"${attrs}>` })}
      </fieldset>
      <div class="form__actions form__actions--between">
        <button class="btn btn--bare btn--icon-left" type="button" data-back>${C.icon('ChevronLeft', 'btn__icon')}<span class="btn__text">Zurück</span></button>
        <button class="btn btn--filled btn--icon-right" type="submit">${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">Weiter</span></button>
      </div>`;
  }

  /* --------------------------------------------------------------- Step 3 -- */

  function step3() {
    return `
      ${/* Use h3 because the wizard step heading is this section's h2. */''}
      <h3>Zusammenfassung</h3>
      <dl class="kv">
        <dt>Objektbezeichnung</dt><dd>${C.escape(buildingName())}</dd>
        <dt>Adresse</dt><dd>${C.escape(`${state.street} ${state.no}, ${state.zip} ${state.city}`.trim())}</dd>
        <dt>Koordinaten (WGS 84)</dt><dd>${state.lat != null ? `${state.lat.toFixed(5)}, ${state.lng.toFixed(5)}` : '—'}</dd>
        <dt>EGID</dt><dd>${C.escape(state.egid) || '<span class="muted">wird ermittelt</span>'}</dd>
        <dt>EGRID</dt><dd>${C.escape(state.egrid) || '<span class="muted">wird ermittelt</span>'}</dd>
        <dt>Teilportfolio</dt><dd>${C.escape(state.portfolio)}</dd>
        <dt>Gebäudeart</dt><dd>${C.escape(state.buildingType)}</dd>
        <dt>Eigentumsverhältnis</dt><dd>${C.escape(state.ownership)}</dd>
        <dt>Baujahr</dt><dd>${C.escape(state.constructionYear)}</dd>
        <dt>Verantwortliche OE</dt><dd>${C.escape(state.org)}</dd>
      </dl>
      ${C.notification('Mit dem Absenden wird ein Vorgang erstellt. EGID und EGRID löst der Kataster­dienst anhand der Lage auf; die Objekt-ID (bbl_id), die Flächen (GF/HNF) und die weiteren Stammdaten vergibt das Portfoliomanagement bei der Prüfung.', 'info')}
      <div class="form__actions form__actions--between">
        <button class="btn btn--bare btn--icon-left" type="button" data-back>${C.icon('ChevronLeft', 'btn__icon')}<span class="btn__text">Zurück</span></button>
        <button class="btn btn--filled btn--lg btn--icon-left" type="submit">${C.icon('Checkmark', 'btn__icon')}<span class="btn__text">Erfassung absenden</span></button>
      </div>`;
  }

  /* ------------------------------------------------------------ Validation -- */

  function validate() {
    const e = {};
    if (state.step === 1) {
      if (!state.addressSelected || !state.address.trim()
          || !Number.isFinite(state.lat) || !Number.isFinite(state.lng)) {
        e['bc-address'] = 'Bitte eine Adresse aus den Vorschlägen wählen';
      }
    }
    if (state.step === 2) {
      // Use actionable validation copy that tells the user how to fix the field.
      if (!state.portfolio) e['bc-portfolio'] = 'Bitte ein Teilportfolio wählen';
      if (!state.buildingType) e['bc-building-type'] = 'Bitte eine Gebäudeart wählen';
      const y = Number(state.constructionYear);
      if (!String(state.constructionYear).trim()) e['bc-construction-year'] = 'Bitte das Baujahr angeben';
      else if (!Number.isInteger(y) || y < 1200 || y > 2100) e['bc-construction-year'] = 'Bitte ein Jahr zwischen 1200 und 2100 angeben';
      // bc-ownership intentionally has no required attribute: it is binary and
      // the documented default is federal ownership, keeping markup and validation aligned.
    }
    state.errors = e;
    return !Object.keys(e).length;
  }

  function readStep() {
    if (state.step === 2) {
      Object.assign(state, C.readForm(mount, {
        portfolio: 'bc-portfolio', buildingType: 'bc-building-type', ownership: 'bc-ownership',
        constructionYear: 'bc-construction-year',
      }));
    }
  }

  /* ----------------------------------------------------------------- Render -- */

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
        ${C.backLink(links.service('gebaeude-erfassen'), 'Dienstleistungsbeschreibung')}
        <h1 tabindex="-1">Gebäude erfassen</h1>
        ${/* Explain the responsible unit and where the submitted case will appear. */''}
        ${C.contextLine({ action: 'Erfassung', name: session.user().name, org: state.org, process: 'Eingang → Prüfung PFM → Genehmigung → Publikation' })}
        ${/* Shared wizard structure; bc-step-head is the focused step heading. */''}
        ${C.wizardHead(STEP_LABELS, state.step, { headId: 'bc-step-head', label: 'Erfassungsschritte', legend: state.step === 2 })}
        ${C.errorSummary({ errors: state.errors, labels: FIELD_LABELS })}
        <!-- novalidate keeps the submit event available to the custom validator. -->
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
          text: `Das Objekt «${C.escape(buildingName())}» ist zur Prüfung beim Portfoliomanagement.`,
          extra: `<dl class="kv">
            <dt>Referenz</dt><dd>${C.escape(i.reference)}</dd>
            <dt>Adresse</dt><dd>${C.escape(`${state.street} ${state.no}, ${state.zip} ${state.city}`.trim())}</dd>
            <dt>Status</dt><dd>${C.statusBadge(i.status, 'Eingereicht')}</dd>
          </dl>`,
          actions: [
            { href: links.caseDetails(i.instanceId), label: 'Vorgang ansehen', icon: 'ArrowRight' },
            { href: '#/services', label: 'Zu den Dienstleistungen' },
          ] })}
      </div>
    </div>`;
    // Focus the success heading and announce the reference through the shared helper.
    C.focusProcessDone(mount, i);
  }

  /* ---------------------------------------------------------------- Wiring -- */

  function closeList() {
    if (addressCombobox) addressCombobox.close();
  }

  function renderList(items) {
    const box = mount.querySelector('#bc-listbox');
    const inp = mount.querySelector('#bc-address');
    if (!box || !inp) return;
    if (!items.length) { closeList(); return; }
    box.innerHTML = items.map((it, n) =>
      `<li class="listbox__option" role="option" id="bc-opt-${n}" aria-selected="false" data-idx="${n}">
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
    // Do not rebuild the map. Move its marker and camera so each keystroke does
    // not discard MapLibre and reload tiles.
    if (pickerMap && pickerMap.__setPin) pickerMap.__setPin(s.lat, s.lon);
    redrawFacts();
  }

  // Refresh only the facts and confirmation control, leaving the map intact.
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
      // After a failed attempt, redraw before wiring the error summary. The shared
      // helper focuses its heading and activates field links, satisfying WCAG 3.3.1.
      if (!validate()) { draw(); C.wireErrorSummary(mount); return; }
      if (state.step < 3) { state.step += 1; draw(); C.focusWizardStep(mount, STEP_LABELS, state.step, { headId: 'bc-step-head' }); return; }
      const inst = engine.start('gebaeude-erfassung', {
        title: `Gebäude erfassen — ${buildingName()}`.trim(),
        organization: state.org,
        requester: session.user().name,
        data: {
          'bezeichnung': buildingName(), 'strasse': `${state.street} ${state.no}`.trim(),
          'plz': state.zip, 'ort': state.city, lat: state.lat, lng: state.lng,
          egid: state.egid, egrid: state.egrid,
          'teilportfolio': state.portfolio, 'gebaeudeart': state.buildingType,
          'eigentum': state.ownership, 'baujahr': state.constructionYear,
        },
      });
      // engine.start returns null when localStorage fails; guard it before
      // drawDone reads the reference, matching space-request.
      if (!inst) { C.flashError(mount, 'Der Vorgang konnte nicht gespeichert werden — bitte erneut versuchen.'); return; }
      state.created = inst;
      freeMap();
      // drawDone delegates success focus and reference announcement to
      // C.focusProcessDone.
      draw();
    });

    const back = form.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => { readStep(); state.step -= 1; draw(); C.focusWizardStep(mount, STEP_LABELS, state.step, { headId: 'bc-step-head' }); });

    // Clear field errors as values change. The shared helper covers input and
    // select change events plus the derived-address badge.
    C.wireFieldErrors(mount, state.errors);

    if (state.step !== 1) return;

    /* Step 1: map and search overlay. */

    const picker = mount.querySelector('#bc-picker');
    const inp = mount.querySelector('#bc-address');
    const clear = mount.querySelector('#bc-clear');
    const box = mount.querySelector('#bc-listbox');
    if (!picker || !inp || !box) return;

    addressCombobox = createListboxController({ input: inp, list: box, onChoose: pick });

    // The overlay sits above MapLibre. Stop pointer and wheel propagation so
    // editing or scrolling suggestions does not pan or zoom the map.
    const swallow = (e) => e.stopPropagation();
    const overlay = picker.querySelector('.map-search');
    ['pointerdown', 'mousedown', 'click', 'dblclick', 'wheel', 'touchstart'].forEach(
      (t) => overlay.addEventListener(t, swallow, { passive: t === 'wheel' ? false : undefined }));

    initPickerMap(picker, {
      lat: state.lat, lng: state.lng,
      onPick: (la, ln) => {
        // A map position alone is incomplete master data; only refine a selected address.
        if (!state.addressSelected) {
          C.announce('Bitte zuerst eine Adresse aus den Vorschlägen wählen.');
          return;
        }
        state.lat = la; state.lng = ln;
        redrawFacts();
        C.announce('Standort angepasst.');
      },
    }).then((m) => { pickerMap = m; }).catch(() => { /* The map is optional. */ });
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
        // Address, derived fields, and coordinates form one selection. Editing
        // the query invalidates the former selection.
        Object.assign(state, {
          address: typed, addressSelected: false,
          street: '', no: '', zip: '', city: '', lat: null, lng: null,
        });
        redrawFacts();
        // redrawFacts restores the controlled value; move the cursor to the end
        // without dispatching another input event.
        inp.setSelectionRange(inp.value.length, inp.value.length);
      }
      if (clear) clear.hidden = !inp.value;
      const q = inp.value.trim();
      if (q.length < 3) { closeList(); return; }
      // Debounce by 300 ms to avoid one request per keystroke.
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

    // An outside click closes suggestions. A once-only document listener would
    // leak if the route changed before a click, so the route controller always removes it.
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
