// Vollbild-Bildergalerie — geteilt von der Objekt-Detailansicht
// (js/apps/portfolio.js) und der Mediathek (js/apps/media-library.js).
//
// Folgt dem CD-Overlay-Muster wie die Dokumentvorschau (js/doc-viewer.js):
// Kopfzeile mit Titel und Aktionen, darunter die Bildfläche. Tastatur: Esc
// schliesst, Pfeil links/rechts blättert, Tab bleibt in der Galerie gefangen.
//
// items = [{ photo, title, meta, type, gray, href?, details? }]
//   details = [[Bezeichnung, Wert], …] — schaltet den Metadaten-Knopf frei.
//   href    = Detailseite des Mediums, aus dem Metadaten-Panel verlinkt.
// C wird durchgereicht (das Modul importiert components.js nicht selbst).
//
// AUFBAU: das Gerüst wird EINMAL gebaut, `update()` schreibt danach nur noch,
// was sich je Bild ändert. Die frühere Fassung baute bei jedem Blättern das
// ganze Overlay per innerHTML neu. Gemessen bei 17
// Bildern: 77 DOM-Knoten und 18 <img> pro Tastendruck neu erzeugt (die Bilder
// kamen aus dem Cache, die Knoten nicht). Beim Halten der Pfeiltaste ist das
// spürbar, und der Fokus sprang dabei jedes Mal auf «Schliessen» zurück.

// Breitenstufen für das Vollbild. Feste 2000px luden auf einem 390px-Telefon ein
// Bild, das dort nie gebraucht wird; freie Breiten würden den Cache zersplittern.
const WIDTH_STEPS = [640, 1024, 1600, 2000];
function stageWidth() {
  const want = Math.round((window.innerWidth || 1024) * Math.min(window.devicePixelRatio || 1, 2));
  return WIDTH_STEPS.find((w) => w >= want) || WIDTH_STEPS[WIDTH_STEPS.length - 1];
}


export function openGallery(items, start, C, opts = {}) {
  // `opts.param`: Name eines Hash-Parameters, in dem das offene Bild steht
  // (z. B. ?bild=MED-007). Damit zeigt der Teilen-Knopf auf GENAU diese
  // Aufnahme statt nur auf die Seite. Gesetzt wird er mit history.replaceState —
  // ein direktes Schreiben auf location.hash löste ein hashchange aus, der
  // Router würde neu rendern und das Overlay unter sich wegziehen.
  const param = opts.param || '';
  if (!items || !items.length) return;
  let idx = Math.max(0, Math.min(start || 0, items.length - 1));
  // Metadaten sind standardmässig EINGEKLAPPT: im Vollbild ist das Bild die
  // Hauptinformation. Der Zustand bleibt über den Bildwechsel erhalten — wer
  // Metadaten sehen will, will sie meist für mehrere Bilder hintereinander.
  let showMeta = false;
  // Zoom: 'fit' (Standard — das ganze Bild passt in die Bühne) oder ein Faktor,
  // wobei 1 = ein Bildpunkt der gelieferten Datei je CSS-Pixel. Jeder Bildwechsel
  // setzt auf 'fit' zurück; ein mitgeschleppter Zoom vom vorigen Bild wäre bei
  // abweichenden Seitenverhältnissen desorientierend.
  let zoom = 'fit';
  const multi = items.length > 1;
  const trigger = document.activeElement;
  const esc = (s) => C.escape(String(s == null ? '' : s));
  const hasDetails = (it) => !!(it && it.details && it.details.length);
  // Echte, lokal abgelegte Aufnahme geht vor; sonst das Unsplash-Platzhalterbild.
  // Lokale Dateien haben eine feste Grösse — stageWidth() gilt nur für Unsplash.
  const fullUrl = (it) => (it && it.photoSrc) ? it.photoSrc : C.photoUrl(it.photo, { w: stageWidth(), gray: it.gray });

  const overlay = document.createElement('div');
  overlay.className = 'pf-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Bildergalerie');

  // Gerüst — einmalig. Alles, was sich je Bild ändert, trägt eine id/Klasse und
  // wird in update() beschrieben.
  //
    overlay.innerHTML = `
    <div class="pf-lightbox__bar">
      <div class="pf-lightbox__heading">
        <span class="pf-lightbox__heading-icon" data-el="icon"></span>
        <div style="min-width:0">
          <p class="pf-lightbox__title" data-el="title"></p>
          <p class="pf-lightbox__sub" data-el="sub"></p>
        </div>
      </div>
      <div class="pf-lightbox__actions">
        <a class="pf-lightbox__btn" data-el="download" href="#" download target="_blank" rel="noopener"
           aria-label="Bild herunterladen" title="Herunterladen">${C.icon('Download', 'icon--md')}</a>
        <button type="button" class="pf-lightbox__btn" data-act="meta" data-el="metabtn"
           aria-expanded="false" aria-controls="lb-meta"
           aria-label="Metadaten anzeigen" title="Metadaten" hidden>${C.icon('InfoCircle', 'icon--md')}</button>
        <button type="button" class="pf-lightbox__btn" data-act="share" aria-label="Bild teilen" title="Teilen">${C.icon('Share', 'icon--md')}</button>
        <button type="button" class="pf-lightbox__btn" data-act="close" aria-label="Galerie schliessen" title="Schliessen">${C.icon('Cancel', 'icon--md')}</button>
      </div>
    </div>
    ${/* Bühne und Metadaten teilen sich EINE Zeile innerhalb der Spalte. Vorher
          war das Overlay selbst `flex-flow:row wrap` — dann hat die Bühne keine
          feste Höhe mehr, `max-height:100%` am Bild löst gegen `auto` auf und das
          Bild stand in seiner natürlichen Grösse da (gemessen: Bühne 955px in
          einem 900px hohen Overlay, Bildunterkante unter dem Sichtfeld). */''}
    <div class="pf-lightbox__body">
      <div class="pf-lightbox__stage" data-el="stage">
        ${multi ? `<button type="button" class="pf-lightbox__nav pf-lightbox__nav--prev" data-act="prev" aria-label="Vorheriges Bild">${C.icon('ChevronLeft', 'icon--lg')}</button>` : ''}
        ${/* Gescrollt wird NUR dieser innere Rahmen. Läge der Überlauf auf der
              Bühne, wanderten Zoomleiste und Blätterpfeile beim Scrollen mit dem
              Bild aus dem Blick — sie sind absolut in der Bühne positioniert. */''}
        <div class="pf-lightbox__scroll" data-el="scroll" tabindex="0"
          aria-label="Bildfläche — mit den Bild-auf/ab-Tasten verschieben">
          <div class="pf-lightbox__canvas" data-el="canvas">
            <img class="pf-lightbox__img" data-el="img" src="" alt="" decoding="async">
          </div>
        </div>
        ${multi ? `<button type="button" class="pf-lightbox__nav pf-lightbox__nav--next" data-act="next" aria-label="Nächstes Bild">${C.icon('ChevronRight', 'icon--lg')}</button>` : ''}
        <div class="pf-lightbox__zoom" role="group" aria-label="Zoom">
          <button type="button" class="pf-lightbox__btn" data-act="zoom-out" data-el="zoomout"
            aria-label="Verkleinern" title="Verkleinern">${C.icon('Minus', 'icon--md')}</button>
          <output class="pf-lightbox__zoom-val" data-el="zoomval" aria-live="off">100 %</output>
          <button type="button" class="pf-lightbox__btn" data-act="zoom-in" data-el="zoomin"
            aria-label="Vergrössern" title="Vergrössern">${C.icon('Plus', 'icon--md')}</button>
          <span class="pf-lightbox__zoom-sep" aria-hidden="true"></span>
          <button type="button" class="pf-lightbox__btn" data-act="zoom-fit" data-el="zoomfit"
            aria-label="An Bildschirm anpassen" title="An Bildschirm anpassen">${C.icon('Expand', 'icon--md')}</button>
        </div>
      </div>
      ${/* Das Panel existiert IMMER, es wird nur ein-/ausgeblendet: aria-controls
            muss auf ein vorhandenes Element zeigen, sonst geht der Bezug ins Leere. */''}
      <div class="pf-lightbox__meta" id="lb-meta" data-el="meta" hidden>
        <h2 class="pf-lightbox__meta-title">Metadaten</h2>
        <dl class="kv kv--compact" data-el="metakv"></dl>
        <a class="btn btn--outline btn--sm" data-el="metalink" data-act="close-nav" href="#" hidden></a>
      </div>
    </div>`;

  const el = {};
  overlay.querySelectorAll('[data-el]').forEach((n) => { el[n.dataset.el] = n; });


  // Nachbarbilder vorwärmen: beim Blättern lag sonst immer eine frische
  // Anfrage zwischen Tastendruck und Bild.
  const warm = (i) => {
    const it = items[(i + items.length) % items.length];
    if (it && (it.photo || it.photoSrc)) { const im = new Image(); im.decoding = 'async'; im.src = fullUrl(it); }
  };

  // Zoomstufen wie in Bildbetrachtern üblich; 1 (=100 %) liegt bewusst drin,
  // damit «Originalgrösse» genau getroffen wird.
  const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];
  // Faktor, bei dem das Bild genau in die Bühne passt — Basis für die
  // Prozentanzeige im Fit-Modus und Startpunkt beim ersten Zoomschritt.
  function fitFactor() {
    const im = el.img;
    if (!im || !im.naturalWidth || !el.canvas) return 1;
    const box = el.canvas.getBoundingClientRect();
    if (!box.width || !box.height) return 1;
    return Math.min(box.width / im.naturalWidth, box.height / im.naturalHeight, 1);
  }
  function applyZoom() {
    const im = el.img;
    if (!im) return;
    const fit = zoom === 'fit';
    el.stage.classList.toggle('is-zoomed', !fit);
    if (fit) {
      im.style.width = ''; im.style.height = '';
    } else {
      // Feste Pixelmasse statt transform: so bekommt die Bühne echten
      // Scroll-Überlauf und damit Tastatur- und Touch-Verschiebung geschenkt.
      im.style.width = `${Math.round(im.naturalWidth * zoom)}px`;
      im.style.height = 'auto';
    }
    const pct = Math.round((fit ? fitFactor() : zoom) * 100);
    if (el.zoomval) el.zoomval.textContent = `${pct} %`;
    if (el.zoomout) el.zoomout.disabled = !fit && zoom <= STEPS[0];
    if (el.zoomin) el.zoomin.disabled = !fit && zoom >= STEPS[STEPS.length - 1];
    if (el.zoomfit) {
      el.zoomfit.disabled = fit;
      el.zoomfit.classList.toggle('is-active', fit);
    }
  }
  function stepZoom(dir) {
    const from = zoom === 'fit' ? fitFactor() : zoom;
    const next = dir > 0
      ? STEPS.find((s) => s > from + 0.001)
      : [...STEPS].reverse().find((s) => s < from - 0.001);
    if (next == null) return;
    zoom = next;
    applyZoom();
    // Nach dem Vergrössern mittig einsteigen, statt oben links.
    if (el.scroll) {
      el.scroll.scrollLeft = (el.scroll.scrollWidth - el.scroll.clientWidth) / 2;
      el.scroll.scrollTop = (el.scroll.scrollHeight - el.scroll.clientHeight) / 2;
    }
  }

  function update(first) {
    const it = items[idx];
    el.icon.innerHTML = C.icon(it.type === 'video' ? 'Video' : 'Image', 'icon--lg');
    el.title.textContent = it.title || '';
    el.sub.textContent = `${it.meta || ''}${multi ? ` · Bild ${idx + 1} von ${items.length}` : ''}`;
    zoom = 'fit';
    el.img.style.width = ''; el.img.style.height = '';
    el.img.src = fullUrl(it);
    el.img.alt = it.title || '';
    // naturalWidth steht erst nach dem Laden fest — die Prozentanzeige im
    // Fit-Modus braucht sie, also nach dem Ladeereignis nachziehen.
    if (el.img.complete) applyZoom(); else el.img.addEventListener('load', applyZoom, { once: true });
    el.download.href = fullUrl(it);

    el.metabtn.hidden = !hasDetails(it);
    el.metabtn.setAttribute('aria-expanded', String(showMeta && hasDetails(it)));
    el.metabtn.setAttribute('aria-label', showMeta ? 'Metadaten ausblenden' : 'Metadaten anzeigen');
    el.metabtn.classList.toggle('is-active', showMeta && hasDetails(it));
    el.meta.hidden = !(showMeta && hasDetails(it));
    if (hasDetails(it)) {
      el.metakv.innerHTML = it.details.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
      el.metalink.hidden = !it.href;
      if (it.href) { el.metalink.href = it.href; el.metalink.innerHTML = `Zur Detailseite ${C.icon('ArrowRight', 'icon--base')}`; }
    }

    // Fokus NUR beim Öffnen setzen. Vorher lief er bei jedem Blättern auf
    // «Schliessen» zurück — wer sich mit den Pfeilknöpfen durch die Galerie
    // klickte, verlor nach jedem Klick den Knopf unter dem Finger.
    if (first) { const cl = overlay.querySelector('[data-act="close"]'); if (cl) cl.focus(); }
    syncUrl(false);
    if (multi) { warm(idx + 1); warm(idx - 1); }
  }

  function syncUrl(clear) {
    if (!param || !history.replaceState) return;
    const [path, qs] = String(location.hash || '#/').replace(/^#/, '').split('?');
    const q = new URLSearchParams(qs || '');
    const id = items[idx] && items[idx].id;
    if (clear || !id) q.delete(param); else q.set(param, id);
    const str = q.toString();
    history.replaceState(null, '', `${location.pathname}${location.search}#${path}${str ? '?' + str : ''}`);
  }

  const go = (d) => { idx = (idx + d + items.length) % items.length; update(false); };
  const close = () => {
    syncUrl(true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    overlay.remove();
    document.body.classList.remove('chart-overlay-open');
    if (trigger && trigger.focus) trigger.focus();
  };
  function onKey(e) {
    // Liegt ein Modal (Teilen-Dialog) ÜBER der Galerie, gehört ihm die Tastatur:
    // sonst schlösse ein Escape beides auf einmal und Tab liefe gegen zwei
    // Fokusfallen gleichzeitig.
    if (document.querySelector('.modal')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); stepZoom(1); }
    else if (e.key === '-') { e.preventDefault(); stepZoom(-1); }
    else if (e.key === '0') { e.preventDefault(); zoom = 'fit'; applyZoom(); }
    else if (multi && e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (multi && e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'Tab') {
      // Auch `a[href]` einsammeln — der Herunterladen-Knopf ist ein Link und wäre
      // sonst aus der Fokusfalle gefallen.
      const f = [...overlay.querySelectorAll('button, a[href]')].filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  overlay.addEventListener('click', (e) => {
    // Der Hintergrund schliesst NICHT: beim Schieben eines gezoomten Bildes
    // endet fast jede Geste auf der dunklen Fläche, und ein versehentliches
    // Schliessen kostet die Zoomstufe und die Position in der Galerie.
    // Schliessen geht über das Kreuz — und über Esc, das bleibt Pflicht (das
    // Overlay ist ein Dialog).
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    if (btn.dataset.act === 'close') close();
    else if (btn.dataset.act === 'prev') go(-1);
    else if (btn.dataset.act === 'next') go(1);
    else if (btn.dataset.act === 'zoom-in') { stepZoom(1); }
    else if (btn.dataset.act === 'zoom-out') { stepZoom(-1); }
    else if (btn.dataset.act === 'zoom-fit') { zoom = 'fit'; applyZoom(); }
    else if (btn.dataset.act === 'meta') { showMeta = !showMeta; update(false); }
    else if (btn.dataset.act === 'close-nav') { close(); }
    else if (btn.dataset.act === 'share') {
      // Derselbe CD-Dialog wie in der share-bar. location.hash trägt dank
      // syncUrl() bereits das offene Bild, der geteilte Link öffnet also genau
      // diese Aufnahme.
      const url = `${location.origin}${location.pathname}${location.search}${location.hash}`;
      C.openShareModal(url, 'Aufnahme teilen');
    }
  });
  // Die Kopfzeile liegt ÜBER der Bildfläche; ihre Höhe wird gemessen und als
  // Innenabstand an den Scrollrahmen gegeben, damit im Fit-Zustand nichts unter
  // ihr verschwindet und die Bildlaufleiste trotzdem über die volle Fensterhöhe läuft.
  const syncChrome = () => {
    const bar = overlay.querySelector('.pf-lightbox__bar');
    overlay.style.setProperty('--lb-top', `${bar ? Math.round(bar.offsetHeight) : 0}px`);
    overlay.style.setProperty('--lb-bottom', '0px');
  };
  const onResize = () => { syncChrome(); if (zoom === 'fit') applyZoom(); };
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKey);
  document.body.classList.add('chart-overlay-open');
  document.body.appendChild(overlay);
  syncChrome();
  update(true);
  // Noch einmal nach dem ersten Bild: beim Anhängen steht die Zeilenhöhe der
  // Kopfzeile noch nicht endgültig fest (gemessen 63px, final 67px), und der
  // Innenabstand der Bildfläche hing an diesem Wert.
  requestAnimationFrame(syncChrome);
}

export default { openGallery };
