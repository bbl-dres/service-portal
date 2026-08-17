// End-to-end building registration covers the external, keyless swisstopo
// SearchServer: service CTA, map overlay, suggestions, keyboard selection,
// coordinates, master data, and persisted case. The upward-opening suggestion
// geometry is asserted because the overlay sits at the map bottom. Without network
// results the suite skips rather than failing in restricted environments.
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

    console.log('■ “Register building” service');
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
    }), `CTA consistently opens the wizard in a new tab (${r.launches.length})`);
    check(r.dead === 0, `no dead href="#" links (${r.dead})`);

    console.log('■ Step 1 — map with search overlay');
    await go('/app/building-create', 5200);
    r = await p.evaluate(`(function(){
      var pk=document.querySelector('.map-picker'), inp=document.querySelector('#bc-address'),
          ov=document.querySelector('.map-search'), lb=document.querySelector('#bc-listbox');
      if(!pk||!inp||!ov||!lb) return {err:'Wähler fehlt'};
      var pr=pk.getBoundingClientRect(), ob=ov.getBoundingClientRect();
      var ho=pk.querySelector('.map-picker__canvas'), cv=pk.querySelector('canvas');
      var hr=ho.getBoundingClientRect(), cr=cv?cv.getBoundingClientRect():{width:0,height:0};
      return {canvas:!!cv,
        // The map holder must fill its frame. MapLibre's later-loaded relative
        // positioning otherwise beats equal-specificity absolute positioning and
        // collapses the holder to zero height despite loaded tiles.
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
      check(r.canvas, 'MapLibre map renders');
      check(Math.abs(r.holderH - r.pickerH) <= 1,
        `map holder fills its frame (holder ${r.holderH} / frame ${r.pickerH})`);
      check(r.canvasBox > 0 && Math.abs(r.canvasBuffer - r.canvasBox) <= 2,
        `drawing buffer matches its box (${r.canvasBuffer} / ${r.canvasBox})`);
      check(r.tiles === true, 'tiles load');
      check(r.inside && r.centred, `search overlay is centred at the bottom of the map (${r.gap}px gap)`);
      check(r.role === 'combobox' && r.controls === 'bc-listbox' && r.expanded === 'false',
        'combobox semantics (role/aria-controls/aria-expanded)');
      check(r.listHidden === true, 'suggestion list starts closed');
      check(r.steps === 3, `step indicator has three steps (${r.steps})`);
    }

    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: 768, height: 1000, deviceScaleFactor: 1, mobile: false }, p.sessionId);
    await sleep(250);
    r = await p.evaluate(`(() => {
      const controls = [...document.querySelectorAll('#bc-picker .maplibregl-ctrl-group button')];
      return { count: controls.length, min: controls.length ? Math.min(...controls.map(el => el.getBoundingClientRect().height)) : 0 };
    })()`);
    check(r.count > 0 && r.min >= 44, `map tools are at least 44 px on tablet (${r.count} × min. ${r.min}px)`);
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, p.sessionId);
    await sleep(250);

    console.log('■ Address state and stale search responses');
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
      await wait(350); // The first request is already in flight.
      input.value = 'Neustrasse 2 Bern';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(900); // The slower stale response arrives last.
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
      `late stale search response does not overwrite the latest response («${r.first}»)`);
    check(r.selected.includes('Neustrasse') && /Schritt 1/.test(r.step),
      'manually edited selection remains on step 1');
    check(r.keptText.endsWith('geändert') && /Vorschlägen/.test(r.addressError) && !r.staleFacts,
      'text edit remains visible and invalidates the old address and coordinates');

    // Use a real search and fresh application state for the complete flow.
    await p.evaluate(`window.fetch = window.__bcRealFetch; delete window.__bcRealFetch;
      location.hash = '#/services'`);
    await sleep(300);
    await p.evaluate(`location.hash = '#/app/building-create'`);
    await sleep(1200);

    console.log('■ swisstopo address search');
    await p.evaluate(`(function(){var i=document.querySelector('#bc-address');i.focus();
      i.value='Fellerstrasse 21 Bern';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await sleep(3000);
    r = await p.evaluate(`(function(){var lb=document.querySelector('#bc-listbox'),inp=document.querySelector('#bc-address');
      var opts=[].slice.call(lb.querySelectorAll('[role="option"]'));
      return {n:opts.length, first:opts[0]?opts[0].innerText.trim():'',
        expanded:inp.getAttribute('aria-expanded'),
        above: opts[0] ? opts[0].getBoundingClientRect().bottom <= inp.getBoundingClientRect().top+2 : false};})()`);
    if (!r.n) {
      console.log('   – skipped: swisstopo unavailable (offline or network blocked)');
    } else {
      check(r.n > 0, `suggestions returned (${r.n}: «${r.first}»)`);
      check(r.above, 'list opens upward from the lower map edge');
      check(r.expanded === 'true', 'aria-expanded follows the list state');

      console.log('■ Keyboard selection (ArrowDown, Enter)');
      await p.evaluate(`document.querySelector('#bc-address').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`);
      await sleep(300);
      const act = await p.evaluate(`document.querySelector('#bc-address').getAttribute('aria-activedescendant')`);
      check(!!act, `aria-activedescendant is set (${act})`);
      await p.evaluate(`document.querySelector('#bc-address').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
      await sleep(1800);
      r = await p.evaluate(`(function(){var kv=document.querySelector('#bc-status .kv'),pin=document.querySelector('.map-pin');
        return {facts:!!kv, coords:/\\d+\\.\\d{4}/.test(kv?kv.innerText:''),
          listHidden:document.querySelector('#bc-listbox').hidden,
          pinShown: !!pin && getComputedStyle(pin).display!=='none'};})()`);
      check(r.facts && r.coords, 'address and WGS-84 coordinates are applied');
      check(r.listHidden && r.pinShown, 'list closes and map pin remains visible');

      console.log('■ Complete flow');
      await p.evaluate(SUBMIT); await sleep(1500);
      r = await p.evaluate(`(function(){return {step:(document.querySelector('#bc-step-head')||{}).innerText||'',
        nameField:!!document.querySelector('#bc-name')};})()`);
      check(/Schritt 2/.test(r.step) && r.nameField, 'Step 2 (master data) reached');

      // The derived, read-only name must carry the step-one address.
      r = await p.evaluate(`(function(){var b=document.querySelector('#bc-name');
        return {ro:b.readOnly, val:b.value};})()`);
      check(r.ro === true, 'building name is read-only');
      // Require the expected street-number, four-digit-postcode, place format.
      check(/^.+\s\d+\w?,\s\d{4}\s.+$/.test(r.val),
        `building name is derived from the address («${r.val}»)`);

      console.log('■ Required fields on step 2');
      r = await p.evaluate(`(function(){
        var st=[].slice.call(document.querySelectorAll('#bc-form label.text--asterisk'));
        return {n:st.length, txt:st.map(function(l){return l.textContent.trim();}).join(' | '),
          egid:(document.querySelector('#bc-egid')||{}).readOnly,
          egrid:(document.querySelector('#bc-egrid')||{}).readOnly,
          gf:!!document.querySelector('#bc-gf'), cls:!!document.querySelector('#bc-classification'),
          org:!!document.querySelector('#bc-org'),
          head:(document.querySelector('main .muted')||{}).innerText||''};})()`);
      // Step two has no required fields, so it must not display a required-fields legend.
      check(r.n === 3, `three required fields have an asterisk (${r.n}: ${r.txt})`);
      check(r.egid === true && r.egrid === true, 'EGID and EGRID are read-only');
      check(!r.gf && !r.cls, 'floor area and classification are absent from the form');
      // The responsible unit is session context, not a field, and must remain visible.
      check(!r.org, 'responsible unit is not a form field');
      check(/Erfassung als/.test(r.head), `responsible unit appears in the header («${r.head.slice(0, 60)}»)`);

      // Submit empty to exercise all three required-field errors.
      await p.evaluate(SUBMIT); await sleep(1200);
      r = await p.evaluate(`(function(){
        var sum=document.querySelector('.error-summary');
        var links=sum?[].slice.call(sum.querySelectorAll('a[data-err-link]')):[];
        return {shown:!!sum, ids:links.map(function(a){return a.getAttribute('data-err-link');}).sort().join(','),
          focused:!!sum && document.activeElement===sum.querySelector('.error-summary__title'),
          invalid:document.querySelectorAll('#bc-form [aria-invalid="true"]').length,
          step:(document.querySelector('#bc-step-head')||{}).innerText||''};})()`);
      check(r.shown && /Schritt 2/.test(r.step), 'error summary appears and step 2 remains active');
      check(r.ids === 'bc-building-type,bc-construction-year,bc-portfolio', `all three empty required fields reported (${r.ids})`);
      check(r.invalid === 3, `aria-invalid appears on exactly these fields (${r.invalid})`);
      check(r.focused, 'focus lands on the error-summary heading');

      // Error-summary links must focus their fields through C.wireErrorSummary.
      await p.evaluate(`document.querySelector('.error-summary a[data-err-link="bc-portfolio"]').click()`);
      await sleep(300);
      r = await p.evaluate(`({id:(document.activeElement||{}).id||''})`);
      check(r.id === 'bc-portfolio', `error-summary link focuses the field (${r.id})`);

      // Correcting a select clears its field error immediately on change.
      await p.evaluate(`(function(){var s=document.querySelector('#bc-portfolio');
        s.selectedIndex=1; s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await sleep(300);
      r = await p.evaluate(`({msg:!!document.querySelector('#bc-portfolio-msg'),
        inv:document.querySelector('#bc-portfolio').getAttribute('aria-invalid')})`);
      check(!r.msg && !r.inv, 'field message clears after correction');

      // Range validation is distinct from required validation.
      await p.evaluate(`(function(){document.querySelector('#bc-building-type').selectedIndex=1;
        document.querySelector('#bc-construction-year').value='3000';})()`);
      await p.evaluate(SUBMIT); await sleep(1200);
      r = await p.evaluate(`(function(){var s=document.querySelector('.error-summary');
        return {n:s?s.querySelectorAll('a[data-err-link]').length:0, txt:s?s.innerText:''};})()`);
      check(r.n === 1 && /1200/.test(r.txt), `construction year 3000 is reported as out of range (${r.n})`);

      console.log('■ Complete flow to case creation');
      await p.evaluate(`document.querySelector('#bc-construction-year').value='1974'`);
      await p.evaluate(SUBMIT); await sleep(1500);
      r = await p.evaluate(`(function(){var dl=document.querySelector('main dl.kv');
        return {step:(document.querySelector('#bc-step-head')||{}).innerText||'',
          rows:document.querySelectorAll('main dl.kv dt').length, txt:dl?dl.innerText:''};})()`);
      check(/Schritt 3/.test(r.step) && r.rows === 10, `step 3 shows the summary (${r.rows} rows)`);
      check(/Teilportfolio/.test(r.txt) && /Gebäudeart/.test(r.txt) && /EGID/.test(r.txt),
        'summary includes portfolio, building type, and EGID');

      await p.evaluate(SUBMIT); await sleep(1800);
      r = await p.evaluate(`(function(){var n=document.querySelector('.notification--success');
        return {done:!!n, ref:/BBL-\\d{4}-\\d+/.test(n?n.innerText:''),
          link:!!document.querySelector('main a[href*="my-cases/"]')};})()`);
      check(r.done && r.ref && r.link, 'case is created with a reference and link');

      await go('/my-cases');
      r = await p.evaluate(`({hit: document.body.innerText.indexOf('ude erfassen')>=0})`);
      check(r.hit, 'case appears under “My cases”');
    }

    console.log('■ Optional map failure preserves address controls');
    const offline = await openPage(cdp, 'about:blank', { login: true });
    await cdp.send('Network.enable', {}, offline.sessionId);
    await cdp.send('Network.setBlockedURLs', { urls: ['*unpkg.com/maplibre-gl@4.7.1*'] }, offline.sessionId);
    await cdp.send('Page.navigate', { url: `${APP_BASE}/app/building-create?map=blocked` }, offline.sessionId);
    await offline.waitFor(`document.querySelector('#bc-picker .map-picker__canvas .empty')`, { timeout: 5000 });
    const offlineResult = await offline.evaluate(`(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const input = document.querySelector('#bc-address');
      const canvas = document.querySelector('#bc-picker .map-picker__canvas');
      const controlsBefore = {
        input: !!input,
        list: !!document.querySelector('#bc-listbox'),
        clear: !!document.querySelector('#bc-clear'),
        mapFailure: !!canvas?.querySelector('.empty--unavailable'),
      };
      window.fetch = async () => ({ ok: true, json: async () => ({ results: [{ attrs: {
        label: 'Teststrasse 7 3003 Bern', lat: 46.95, lon: 7.44,
      } }] }) });
      input.value = 'Teststrasse 7 Bern';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(500);
      return {
        ...controlsBefore,
        option: document.querySelector('#bc-listbox [role="option"]')?.textContent.trim() || '',
        expanded: input.getAttribute('aria-expanded'),
      };
    })()`);
    check(offlineResult.mapFailure && offlineResult.input && offlineResult.list && offlineResult.clear,
      'a blocked MapLibre loader replaces only the canvas, not the required address combobox');
    check(offlineResult.option.includes('Teststrasse') && offlineResult.expanded === 'true',
      'address-search listeners remain functional after the optional map fails');
    const offlineProblems = await offline.problems();
    check(offlineProblems.length === 0,
      `blocked optional map has no uncaught application errors${offlineProblems[0] ? ': ' + offlineProblems[0] : ''}`);
    await offline.closeTarget();

    const problems = await p.problems();
    check(problems.length === 0, `no exceptions / console errors / error banner${problems[0] ? ": " + problems[0] : ""}`);
  } finally {
    cdp.close();
  }
  console.log(`\n${failures ? '✗ ' + failures + ' check(s) FAILED' : '✓ all checks passed'}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('DRIVER ERROR', e); process.exit(2); });
