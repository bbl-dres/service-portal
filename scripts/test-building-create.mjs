// «Gebäude erfassen» (js/apps/building-create.js) — der einzige Ablauf, der einen
// EXTERNEN Dienst aufruft: die swisstopo-Adresssuche
// (api3.geo.admin.ch/rest/services/api/SearchServer, schlüssellos, CORS-frei).
//
// Geprüft wird die Kette, die den Ablauf ausmacht:
//   Dienstleistungs-CTA → Karte mit Suchauflage → Vorschläge von swisstopo →
//   Tastaturauswahl → Koordinaten + Bestätigung → Stammdaten → Vorgang.
//
// Die Auflage sitzt IN der Karte (unten zentriert), deshalb muss die
// Vorschlagsliste NACH OBEN öffnen — sonst stünde sie ausserhalb des Rahmens.
// Genau das prüft eine der Zusicherungen unten, geometrisch statt per Klasse.
//
// Netzabhängig: ohne Internet liefert SearchServer nichts. Der Test meldet das
// als übersprungen statt als Fehlschlag, damit er im Bundesnetz nicht rot wird.
//
//   node scripts/test-building-create.mjs      (dev server must be running)
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const LOGIN = `(async () => {
  const s = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; while (typeof window.__login !== 'function' && n++ < 120) await s(50);
  if (typeof window.__login !== 'function') return 'no __login';
  window.__login(); return 'ok';
})()`;

const SUBMIT = `document.querySelector('#bc-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`;

(async () => {
  const cdp = await launch();
  let failures = 0;
  const check = (ok, label) => { console.log(`   ${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };
  try {
    const p = await openPage(cdp, 'about:blank');
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, p.sessionId);
    const go = async (route, wait = 3000) => {
      await cdp.send('Page.navigate', { url: `${APP_BASE}${route}?t=${Math.random().toString(36).slice(2)}` }, p.sessionId);
      await sleep(wait);
    };
    await cdp.send('Page.navigate', { url: `${APP_BASE}/` }, p.sessionId);
    await sleep(1200);
    await p.evaluate(LOGIN);
    await sleep(600);

    console.log('■ Dienstleistung «Gebäude erfassen»');
    await go('/services/gebaeude-erfassen');
    let r = await p.evaluate(`(function(){
      var a=[].slice.call(document.querySelectorAll('main a')).filter(function(x){
        return (x.getAttribute('href')||'').indexOf('building-create')>=0; });
      return {launches:a.map(function(x){ return {
        label:(x.querySelector('.btn__text')||x).textContent.trim(),
        target:x.getAttribute('target')||'', rel:x.getAttribute('rel')||''}; }),
        dead:document.querySelectorAll('main a[href="#"]').length};})()`);
    check(r.launches.length >= 2 && r.launches.every(function(x){
      return x.label === 'Vorgang starten' && x.target === '_blank'
        && x.rel.split(/\s+/).includes('noopener');
    }), `CTA öffnet den Assistenten konsistent in einem neuen Tab (${r.launches.length})`);
    check(r.dead === 0, `keine toten href="#"-Links (${r.dead})`);

    console.log('■ Schritt 1 — Karte mit Suchauflage');
    await go('/app/building-create', 5200);
    r = await p.evaluate(`(function(){
      var pk=document.querySelector('.map-picker'), inp=document.querySelector('#bc-address'),
          ov=document.querySelector('.map-search'), lb=document.querySelector('#bc-listbox');
      if(!pk||!inp||!ov||!lb) return {err:'Wähler fehlt'};
      var pr=pk.getBoundingClientRect(), ob=ov.getBoundingClientRect();
      var ho=pk.querySelector('.map-picker__canvas'), cv=pk.querySelector('canvas');
      var hr=ho.getBoundingClientRect(), cr=cv?cv.getBoundingClientRect():{width:0,height:0};
      return {canvas:!!cv,
        // Der Kartenkasten MUSS den Rahmen fuellen.
        // MapLibres Klasse .maplibregl-map setzt position:relative und schlaegt
        // bei gleicher Spezifitaet unser absolute (ihr Stylesheet kommt zur
        // Laufzeit spaeter in den head) - der Halter fiel dadurch auf Hoehe 0
        // zusammen und die Karte blieb grau, obwohl die Kacheln geladen waren.
        holderH:Math.round(hr.height), pickerH:Math.round(pr.height),
        canvasBox:Math.round(cr.height), canvasBuffer:cv?cv.height:0,
        tiles: !!pk._map && pk._map.areTilesLoaded(),
        steps:document.querySelectorAll('.step__indicator-step').length,
        role:inp.getAttribute('role'), expanded:inp.getAttribute('aria-expanded'),
        controls:inp.getAttribute('aria-controls'), listHidden:lb.hidden,
        inside: ob.bottom<=pr.bottom+1 && ob.left>=pr.left-1 && ob.right<=pr.right+1,
        centred: Math.abs((ob.left-pr.left)-(pr.right-ob.right))<2,
        gap: Math.round(pr.bottom-ob.bottom)};})()`);
    if (r.err) { check(false, r.err); }
    else {
      check(r.canvas, 'MapLibre-Karte gerendert');
      check(Math.abs(r.holderH - r.pickerH) <= 1,
        `Kartenkasten füllt den Rahmen (Halter ${r.holderH} / Rahmen ${r.pickerH})`);
      check(r.canvasBox > 0 && Math.abs(r.canvasBuffer - r.canvasBox) <= 2,
        `Zeichenpuffer passt zur Box (${r.canvasBuffer} / ${r.canvasBox})`);
      check(r.tiles === true, 'Kacheln geladen');
      check(r.inside && r.centred, `Suchauflage liegt in der Karte, unten zentriert (${r.gap}px Abstand)`);
      check(r.role === 'combobox' && r.controls === 'bc-listbox' && r.expanded === 'false',
        'Combobox-Semantik (role/aria-controls/aria-expanded)');
      check(r.listHidden === true, 'Vorschlagsliste initial geschlossen');
      check(r.steps === 3, `Schrittanzeige mit 3 Schritten (${r.steps})`);
    }

    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: 768, height: 1000, deviceScaleFactor: 1, mobile: false }, p.sessionId);
    await sleep(250);
    r = await p.evaluate(`(() => {
      const controls = [...document.querySelectorAll('#bc-picker .maplibregl-ctrl-group button')];
      return { count: controls.length, min: controls.length ? Math.min(...controls.map(el => el.getBoundingClientRect().height)) : 0 };
    })()`);
    check(r.count > 0 && r.min >= 44, `Kartenwerkzeuge auf Tablet mindestens 44px (${r.count} × min. ${r.min}px)`);
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, p.sessionId);
    await sleep(250);

    console.log('■ Adresszustand und überholte Suchantworten');
    r = await p.evaluate(`(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      window.__bcRealFetch = window.fetch;
      window.fetch = (input, init) => {
        const raw = input instanceof Request ? input.url : String(input);
        if (!raw.includes('/rest/services/api/SearchServer')) return window.__bcRealFetch(input, init);
        const text = new URL(raw).searchParams.get('searchText') || '';
        const old = text.startsWith('Altstrasse');
        const label = old ? 'Altstrasse 1 3003 Bern' : 'Neustrasse 2 3003 Bern';
        return new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ results: [{ attrs: {
            label, lat: old ? 46.94 : 46.95, lon: old ? 7.43 : 7.44,
          } }] }),
        }), old ? 700 : 30));
      };
      const input = document.querySelector('#bc-address');
      input.value = 'Altstrasse 1 Bern';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(350); // erster Fetch läuft bereits
      input.value = 'Neustrasse 2 Bern';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(900); // die langsamere alte Antwort kommt zuletzt an
      const first = document.querySelector('#bc-listbox [role="option"]')?.textContent.trim() || '';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await wait(80);
      const selected = document.querySelector('#bc-address').value;
      input.value = selected + ' geändert';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#bc-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await wait(100);
      return {
        first,
        selected,
        keptText: document.querySelector('#bc-address')?.value || '',
        step: document.querySelector('#bc-step-head')?.textContent || '',
        addressError: document.querySelector('#bc-address-msg')?.textContent.trim() || '',
        staleFacts: !!document.querySelector('#bc-status .kv'),
      };
    })()`);
    check(r.first.includes('Neustrasse') && !r.first.includes('Altstrasse'),
      `späte alte Suchantwort überschreibt die neue nicht («${r.first}»)`);
    check(r.selected.includes('Neustrasse') && /Schritt 1/.test(r.step),
      'manuell geänderte Auswahl bleibt in Schritt 1');
    check(r.keptText.endsWith('geändert') && /Vorschlägen/.test(r.addressError) && !r.staleFacts,
      'Textänderung bleibt sichtbar und invalidiert alte Adresse und Koordinaten');

    // Reale Suche und ein frischer App-Zustand für den vollständigen Durchlauf.
    await p.evaluate(`window.fetch = window.__bcRealFetch; delete window.__bcRealFetch;
      location.hash = '#/services'`);
    await sleep(300);
    await p.evaluate(`location.hash = '#/app/building-create'`);
    await sleep(1200);

    console.log('■ swisstopo-Adresssuche');
    await p.evaluate(`(function(){var i=document.querySelector('#bc-address');i.focus();
      i.value='Fellerstrasse 21 Bern';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await sleep(3000);
    r = await p.evaluate(`(function(){var lb=document.querySelector('#bc-listbox'),inp=document.querySelector('#bc-address');
      var opts=[].slice.call(lb.querySelectorAll('[role="option"]'));
      return {n:opts.length, first:opts[0]?opts[0].innerText.trim():'',
        expanded:inp.getAttribute('aria-expanded'),
        above: opts[0] ? opts[0].getBoundingClientRect().bottom <= inp.getBoundingClientRect().top+2 : false};})()`);
    if (!r.n) {
      console.log('   – übersprungen: swisstopo nicht erreichbar (offline / Netz gesperrt)');
    } else {
      check(r.n > 0, `Vorschläge geliefert (${r.n}: «${r.first}»)`);
      check(r.above, 'Liste öffnet nach OBEN (Auflage sitzt am unteren Kartenrand)');
      check(r.expanded === 'true', 'aria-expanded folgt dem Listenzustand');

      console.log('■ Tastaturauswahl (Pfeil ab, Enter)');
      await p.evaluate(`document.querySelector('#bc-address').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`);
      await sleep(300);
      const act = await p.evaluate(`document.querySelector('#bc-address').getAttribute('aria-activedescendant')`);
      check(!!act, `aria-activedescendant gesetzt (${act})`);
      await p.evaluate(`document.querySelector('#bc-address').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
      await sleep(1800);
      r = await p.evaluate(`(function(){var kv=document.querySelector('#bc-status .kv'),pin=document.querySelector('.map-pin');
        return {facts:!!kv, coords:/\\d+\\.\\d{4}/.test(kv?kv.innerText:''),
          listHidden:document.querySelector('#bc-listbox').hidden,
          pinShown: !!pin && getComputedStyle(pin).display!=='none'};})()`);
      check(r.facts && r.coords, 'Adresse + WGS-84-Koordinaten übernommen');
      check(r.listHidden && r.pinShown, 'Liste geschlossen, Stecknadel sichtbar');

      console.log('■ Durchlauf');
      await p.evaluate(SUBMIT); await sleep(1500);
      r = await p.evaluate(`(function(){return {step:(document.querySelector('#bc-step-head')||{}).innerText||'',
        bez:!!document.querySelector('#bc-bez')};})()`);
      check(/Schritt 2/.test(r.step) && r.bez, 'Schritt 2 (Stammdaten) erreicht');

      // Die Objektbezeichnung ist abgeleitet und nur lesbar — sie muss die
      // Adresse aus Schritt 1 tragen und darf nicht editierbar sein.
      r = await p.evaluate(`(function(){var b=document.querySelector('#bc-bez');
        return {ro:b.readOnly, val:b.value};})()`);
      check(r.ro === true, 'Objektbezeichnung ist nur lesbar');
      // «Strasse Nr., PLZ Ort» — vierstellige PLZ und das Komma müssen drin sein.
      check(/^.+\s\d+\w?,\s\d{4}\s.+$/.test(r.val),
        `Objektbezeichnung aus der Adresse abgeleitet («${r.val}»)`);

      console.log('■ Pflichtfelder in Schritt 2');
      r = await p.evaluate(`(function(){
        var st=[].slice.call(document.querySelectorAll('#bc-form label.text--asterisk'));
        return {n:st.length, txt:st.map(function(l){return l.textContent.trim();}).join(' | '),
          egid:(document.querySelector('#bc-egid')||{}).readOnly,
          egrid:(document.querySelector('#bc-egrid')||{}).readOnly,
          gf:!!document.querySelector('#bc-gf'), cls:!!document.querySelector('#bc-classification'),
          org:!!document.querySelector('#bc-org'),
          head:(document.querySelector('main .muted')||{}).innerText||''};})()`);
      // Schritt 2 trug die Legende «Mit * markierte Felder sind Pflichtfelder»,
      // hatte aber kein einziges Pflichtfeld — die Legende log.
      check(r.n === 3, `drei Pflichtfelder mit Stern markiert (${r.n}: ${r.txt})`);
      check(r.egid === true && r.egrid === true, 'EGID und EGRID sind nur lesbar');
      check(!r.gf && !r.cls, 'Geschossfläche und Klassifizierung stehen nicht mehr im Formular');
      // Die verantwortliche OE ist kein Feld mehr, muss aber als Kontext sichtbar
      // bleiben — sonst taucht sie in Schritt 3 ohne Vorankündigung auf.
      check(!r.org, 'Verantwortliche OE ist kein Formularfeld');
      check(/Erfassung als/.test(r.head), `OE steht in der Kopfzeile («${r.head.slice(0, 60)}»)`);

      // Leer absenden — alle drei Pflichtfelder müssen reklamiert werden.
      await p.evaluate(SUBMIT); await sleep(1200);
      r = await p.evaluate(`(function(){
        var sum=document.querySelector('.error-summary');
        var links=sum?[].slice.call(sum.querySelectorAll('a[data-err-link]')):[];
        return {shown:!!sum, ids:links.map(function(a){return a.getAttribute('data-err-link');}).sort().join(','),
          focused:!!sum && document.activeElement===sum.querySelector('.error-summary__title'),
          invalid:document.querySelectorAll('#bc-form [aria-invalid="true"]').length,
          step:(document.querySelector('#bc-step-head')||{}).innerText||''};})()`);
      check(r.shown && /Schritt 2/.test(r.step), 'Fehlerübersicht erscheint, Schritt 2 bleibt stehen');
      check(r.ids === 'bc-baujahr,bc-gebart,bc-portfolio', `die drei leeren Pflichtfelder reklamiert (${r.ids})`);
      check(r.invalid === 3, `aria-invalid auf genau diesen Feldern (${r.invalid})`);
      check(r.focused, 'Fokus steht auf der Überschrift der Fehlerübersicht');

      // Sprungmarke der Übersicht muss ins Feld führen (C.wireErrorSummary) —
      // ohne die Verdrahtung war es ein nackter Anker, der nirgends hinsprang.
      await p.evaluate(`document.querySelector('.error-summary a[data-err-link="bc-portfolio"]').click()`);
      await sleep(300);
      r = await p.evaluate(`({id:(document.activeElement||{}).id||''})`);
      check(r.id === 'bc-portfolio', `Sprungmarke fokussiert das Feld (${r.id})`);

      // Korrektur räumt die Feldmeldung sofort weg (`change`, weil es ein <select> ist).
      await p.evaluate(`(function(){var s=document.querySelector('#bc-portfolio');
        s.selectedIndex=1; s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await sleep(300);
      r = await p.evaluate(`({msg:!!document.querySelector('#bc-portfolio-msg'),
        inv:document.querySelector('#bc-portfolio').getAttribute('aria-invalid')})`);
      check(!r.msg && !r.inv, 'Feldmeldung verschwindet bei Korrektur');

      // Bereichsprüfung ist ein anderer Zweig als die Pflichtprüfung.
      await p.evaluate(`(function(){document.querySelector('#bc-gebart').selectedIndex=1;
        document.querySelector('#bc-baujahr').value='3000';})()`);
      await p.evaluate(SUBMIT); await sleep(1200);
      r = await p.evaluate(`(function(){var s=document.querySelector('.error-summary');
        return {n:s?s.querySelectorAll('a[data-err-link]').length:0, txt:s?s.innerText:''};})()`);
      check(r.n === 1 && /1200/.test(r.txt), `Baujahr 3000 als Bereichsfehler gemeldet (${r.n})`);

      console.log('■ Durchlauf bis zum Vorgang');
      await p.evaluate(`document.querySelector('#bc-baujahr').value='1974'`);
      await p.evaluate(SUBMIT); await sleep(1500);
      r = await p.evaluate(`(function(){var dl=document.querySelector('main dl.kv');
        return {step:(document.querySelector('#bc-step-head')||{}).innerText||'',
          rows:document.querySelectorAll('main dl.kv dt').length, txt:dl?dl.innerText:''};})()`);
      check(/Schritt 3/.test(r.step) && r.rows === 10, `Schritt 3 mit Zusammenfassung (${r.rows} Zeilen)`);
      check(/Teilportfolio/.test(r.txt) && /Gebäudeart/.test(r.txt) && /EGID/.test(r.txt),
        'Zusammenfassung führt Teilportfolio, Gebäudeart und EGID');

      await p.evaluate(SUBMIT); await sleep(1800);
      r = await p.evaluate(`(function(){var n=document.querySelector('.notification--success');
        return {done:!!n, ref:/BBL-\\d{4}-\\d+/.test(n?n.innerText:''),
          link:!!document.querySelector('main a[href*="my-cases/"]')};})()`);
      check(r.done && r.ref && r.link, 'Vorgang angelegt, Referenz + Verweis vorhanden');

      await go('/my-cases');
      r = await p.evaluate(`({hit: document.body.innerText.indexOf('ude erfassen')>=0})`);
      check(r.hit, 'Vorgang steht unter «Meine Vorgänge»');
    }

    check((await p.problems()).length === 0, `no exceptions / console errors / error banner${(await p.problems())[0] ? ": " + (await p.problems())[0] : ""}`);
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
