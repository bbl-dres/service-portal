// Fullscreen image gallery shared by the property detail view
// (js/apps/portfolio.js) and media library (js/apps/media-library.js).
//
// Follows the CD overlay pattern used by document preview (js/ui/doc-viewer.js):
// header with title and actions above the image stage. Keyboard: Escape closes,
// left/right arrows navigate, and Tab remains trapped in the gallery.
//
// items = [{ photo, photoSrc?, title, alt?, meta, type, gray, href?, details?, downloadable? }]
//   details = [[label, value], …] — enables the metadata button.
//   href    = media detail page linked from the metadata panel.
//   downloadable = false hides the file action for rights-restricted media;
//                  omitted keeps the existing downloadable-by-default behaviour.
// C is passed through; this module does not import components.js itself.
//
// STRUCTURE: build the shell ONCE; `update()` then writes only what changes per
// image. The former version rebuilt the entire overlay through innerHTML on each
// navigation. With 17 images, every keystroke recreated 77 DOM nodes and 18
// <img> elements (images came from cache, nodes did not). This was perceptible
// when holding an arrow key, and focus jumped back to «Schliessen» each time.

import { safeLinkUrl, safeResourceUrl } from '../security/urls.js';

// Width steps for fullscreen. A fixed 2000px loaded an image a 390px phone would
// never need, while unrestricted widths would fragment the cache.
const WIDTH_STEPS = [640, 1024, 1600, 2000];
function stageWidth() {
  const want = Math.round((window.innerWidth || 1024) * Math.min(window.devicePixelRatio || 1, 2));
  return WIDTH_STEPS.find((w) => w >= want) || WIDTH_STEPS[WIDTH_STEPS.length - 1];
}


// Restore a gallery link created by the share button. The router passes parsed
// hash parameters as URLSearchParams; only an EXACTLY known image ID may open an
// overlay. Query value: `bild`; an unknown or stale value therefore becomes neither the first image
// nor a navigation. Open in the next frame: after render(), the router first
// focuses the page heading, then the dialog may focus its close button.
// openGallery subsequently synchronises the same ID through replaceState,
// causing neither a hash change nor a second render.
export function restoreGalleryFromQuery(query, items, C, options = {}) {
  const param = options.param || 'bild';
  const requested = query && typeof query.get === 'function' ? query.get(param) : '';
  if (!requested || !Array.isArray(items) || !items.length) return null;
  const index = items.findIndex((item) => item && item.id === requested);
  if (index < 0) return null;
  // The complete route belongs to this request. In portfolio, object identity
  // lives in `?id=`; query value: `bild`. Comparing only path and that value would let an old frame open
  // object A's gallery over object B.
  const expectedHash = String(location.hash || '#/');
  return requestAnimationFrame(() => {
    // After render(), the frame may already belong to a newer navigation. The
    // stale restoration request must not open an overlay there.
    if (String(location.hash || '#/') !== expectedHash) return;
    openGallery(items, index, C, { ...options, param });
  });
}


export function openGallery(items, start, C, options = {}) {
  // `options.param`: name of the hash parameter containing the open image (for
  // example, the image compatibility query). The share button then points to EXACTLY this image,
  // not merely the page. history.replaceState sets it; writing location.hash
  // directly would fire hashchange, make the router rerender and remove the
  // overlay from underneath itself.
  const param = options.param || '';
  if (!items || !items.length) return;
  const openedPath = String(location.hash || '#/').split('?')[0];
  let idx = Math.max(0, Math.min(start || 0, items.length - 1));
  // Metadata is COLLAPSED by default because the image is primary in fullscreen.
  // State persists across image changes; someone viewing metadata usually wants
  // it for several consecutive images.
  let showMeta = false;
  // Zoom: 'fit' (default: the whole image fits the stage) or a factor, where
  // 1 = one source-image pixel per CSS pixel. Every image change resets to
  // 'fit'; carrying zoom across aspect ratios would be disorienting.
  let zoom = 'fit';
  const multi = items.length > 1;
  const trigger = document.activeElement;
  const esc = (s) => C.escape(String(s == null ? '' : s));
  const hasDetails = (it) => !!(it && it.details && it.details.length);
  // Prefer a real local image; otherwise use the Unsplash placeholder. Local
  // files have fixed dimensions, so stageWidth() applies only to Unsplash.
  const fullUrl = (it) => safeResourceUrl(
    (it && it.photoSrc) ? it.photoSrc : C.photoUrl(it && it.photo, { w: stageWidth(), gray: it && it.gray }),
  );

  const overlay = document.createElement('div');
  overlay.className = 'pf-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Bildergalerie');

  // One-time shell. Everything that changes per image has an ID/class and is
  // written by update().
  //
    overlay.innerHTML = `
    <div class="pf-lightbox__bar">
      <div class="pf-lightbox__heading">
        <span class="pf-lightbox__heading-icon" data-el="icon"></span>
        <div class="pf-lightbox__heading-text">
          <p class="pf-lightbox__title" data-el="title"></p>
          <p class="pf-lightbox__sub" data-el="sub"></p>
        </div>
      </div>
      <div class="pf-lightbox__actions">
        <a class="pf-lightbox__btn interactive-control interactive-control--negative" data-el="download" download target="_blank" rel="noopener noreferrer"
           aria-label="Bild herunterladen" title="Herunterladen" hidden>${C.icon('Download', 'icon--md')}</a>
        <button type="button" class="pf-lightbox__btn interactive-control interactive-control--negative" data-act="meta" data-el="metabtn"
           aria-expanded="false" aria-controls="lb-meta"
           aria-label="Metadaten anzeigen" title="Metadaten" hidden>${C.icon('InfoCircle', 'icon--md')}</button>
        <button type="button" class="pf-lightbox__btn interactive-control interactive-control--negative" data-act="share" data-el="share" aria-label="Bild teilen" title="Teilen">${C.icon('Share', 'icon--md')}</button>
        <button type="button" class="pf-lightbox__btn interactive-control interactive-control--negative" data-act="close" aria-label="Galerie schliessen" title="Schliessen">${C.icon('Cancel', 'icon--md')}</button>
      </div>
    </div>
    ${/* Stage and metadata share ONE row within the column. Previously the
          overlay itself used `flex-flow:row wrap`, leaving the stage without a
          fixed height. Image `max-height:100%` resolved against `auto`, so the
          image used its natural size (measured: 955px stage in a 900px overlay,
          with the image bottom below the viewport). */''}
    <div class="pf-lightbox__body">
      <div class="pf-lightbox__stage" data-el="stage">
        ${multi ? `<button type="button" class="pf-lightbox__nav pf-lightbox__nav--prev interactive-control" data-act="prev" aria-label="Vorheriges Bild">${C.icon('ChevronLeft', 'icon--lg')}</button>` : ''}
        ${/* ONLY this inner frame scrolls. If overflow lived on the stage, the
              zoom bar and navigation arrows would scroll out of view with the
              image; they are positioned absolutely within the stage. */''}
        <div class="pf-lightbox__scroll" data-el="scroll" tabindex="0"
          aria-label="Bildfläche — mit den Bild-auf/ab-Tasten verschieben">
          <div class="pf-lightbox__canvas" data-el="canvas">
            <img class="pf-lightbox__img" data-el="img" alt="" decoding="async">
          </div>
        </div>
        ${multi ? `<button type="button" class="pf-lightbox__nav pf-lightbox__nav--next interactive-control" data-act="next" aria-label="Nächstes Bild">${C.icon('ChevronRight', 'icon--lg')}</button>` : ''}
        <div class="viewer-toolbar viewer-toolbar--negative viewer-toolbar--horizontal pf-lightbox__zoom" role="group" aria-label="Zoom">
          <button type="button" class="viewer-toolbar__button pf-lightbox__btn interactive-control interactive-control--negative" data-act="zoom-out" data-el="zoomout"
            aria-label="Verkleinern" title="Verkleinern">${C.icon('Minus', 'icon--md')}</button>
          <output class="viewer-toolbar__readout pf-lightbox__zoom-val" data-el="zoomval" aria-live="off">100 %</output>
          <button type="button" class="viewer-toolbar__button pf-lightbox__btn interactive-control interactive-control--negative" data-act="zoom-in" data-el="zoomin"
            aria-label="Vergrössern" title="Vergrössern">${C.icon('Plus', 'icon--md')}</button>
          <span class="viewer-toolbar__separator pf-lightbox__zoom-sep" aria-hidden="true"></span>
          <button type="button" class="viewer-toolbar__button pf-lightbox__btn interactive-control interactive-control--negative" data-act="zoom-fit" data-el="zoomfit"
            aria-label="An Bildschirm anpassen" title="An Bildschirm anpassen">${C.icon('Expand', 'icon--md')}</button>
        </div>
      </div>
      ${/* The panel ALWAYS exists and is merely shown/hidden: aria-controls must
            point to an existing element or the relationship becomes empty. */''}
      <div class="pf-lightbox__meta" id="lb-meta" data-el="meta" hidden>
        <h2 class="pf-lightbox__meta-title">Metadaten</h2>
        <dl class="kv kv--tight" data-el="metakv"></dl>
        ${/* btn--outline-negative, not btn--outline: the panel is dark. The ad-hoc
              recolouring in app.css (16% white border, below 3:1) is gone. */''}
        <a class="btn btn--outline-negative btn--sm btn--icon-right" data-el="metalink" data-act="close-nav" hidden></a>
      </div>
    </div>`;

  const el = {};
  overlay.querySelectorAll('[data-el]').forEach((n) => { el[n.dataset.el] = n; });


  // Preload neighbouring images; otherwise each navigation put a fresh request
  // between keystroke and image.
  const warm = (i) => {
    const it = items[(i + items.length) % items.length];
    const url = it && (it.photo || it.photoSrc) ? fullUrl(it) : '';
    if (url) { const im = new Image(); im.decoding = 'async'; im.src = url; }
  };

  // Standard image-viewer zoom steps. Include 1 (=100%) deliberately so original
  // size can be reached exactly.
  const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];
  // Factor at which the image exactly fits the stage; basis for fit-mode
  // percentage and starting point for the first zoom step.
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
      // Fixed pixel dimensions rather than transform give the stage real scroll
      // overflow and therefore keyboard and touch panning for free.
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
    // After zooming in, start in the centre rather than top left.
    if (el.scroll) {
      el.scroll.scrollLeft = (el.scroll.scrollWidth - el.scroll.clientWidth) / 2;
      el.scroll.scrollTop = (el.scroll.scrollHeight - el.scroll.clientHeight) / 2;
    }
  }

  function update(first) {
    const it = items[idx];
    const imageUrl = fullUrl(it);
    const metaHref = safeLinkUrl(it.href);
    el.icon.innerHTML = C.icon(it.type === 'video' ? 'Video' : 'Image', 'icon--lg');
    const visualisation = it.type === 'visualisation';
    el.share.setAttribute('aria-label', visualisation ? 'Visualisierung teilen' : 'Bild teilen');
    el.share.title = visualisation ? 'Visualisierung teilen' : 'Teilen';
    el.title.textContent = it.title || '';
    el.sub.textContent = `${it.meta || ''}${multi ? ` · Bild ${idx + 1} von ${items.length}` : ''}`;
    zoom = 'fit';
    el.img.style.width = ''; el.img.style.height = '';
    if (imageUrl) {
      // Busy ring while a cold image decodes — assigning src clears the stage,
      // which used to sit blank with no feedback until the network delivered
      // (code review 2026-08, F-S20). The ±1 pre-warm keeps warm swaps
      // instant; `complete` clears the state synchronously for those.
      el.stage?.setAttribute('aria-busy', 'true');
      const settle = () => el.stage?.removeAttribute('aria-busy');
      el.img.addEventListener('load', settle, { once: true });
      el.img.addEventListener('error', settle, { once: true });
      el.img.src = imageUrl;
      if (el.img.complete) settle();
    } else {
      el.img.removeAttribute('src');
      el.stage?.removeAttribute('aria-busy');
    }
    el.img.alt = it.alt || it.title || '';
    // naturalWidth is known only after loading; fit-mode percentage needs it, so
    // update after the load event.
    if (el.img.complete) applyZoom(); else el.img.addEventListener('load', applyZoom, { once: true });
    const canDownload = !!imageUrl && it.downloadable !== false;
    el.download.hidden = !canDownload;
    if (canDownload) el.download.href = imageUrl; else el.download.removeAttribute('href');

    el.metabtn.hidden = !hasDetails(it);
    el.metabtn.setAttribute('aria-expanded', String(showMeta && hasDetails(it)));
    el.metabtn.setAttribute('aria-label', showMeta ? 'Metadaten ausblenden' : 'Metadaten anzeigen');
    el.metabtn.classList.toggle('is-active', showMeta && hasDetails(it));
    el.meta.hidden = !(showMeta && hasDetails(it));
    if (hasDetails(it)) {
      el.metakv.innerHTML = it.details.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
      el.metalink.hidden = !metaHref;
      // “View object” follows the other reference actions; the former detail-page
      // wording was the only outlier (design review D8).
      if (metaHref) {
        el.metalink.href = metaHref;
        const linkLabel = visualisation ? 'Visualisierung ansehen' : 'Aufnahme ansehen';
        el.metalink.innerHTML = `${C.icon('ArrowRight', 'btn__icon')}<span class="btn__text">${linkLabel}</span>`;
      } else {
        el.metalink.removeAttribute('href');
      }
    }

    // Set focus ONLY when opening. It previously returned to «Schliessen» after
    // every navigation, so arrow-button users lost the button under their finger
    // after each click.
    if (first) { const cl = overlay.querySelector('[data-act="close"]'); if (cl) cl.focus(); }
    syncUrl(false);
    if (multi) { warm(idx + 1); warm(idx - 1); }
  }

  function syncUrl(clear) {
    if (!param || !history.replaceState) return;
    // A route dispatch closes the gallery after hashchange has already updated
    // location. Never rewrite parameters on the destination route.
    if (String(location.hash || '#/').split('?')[0] !== openedPath) return;
    const [path, qs] = String(location.hash || '#/').replace(/^#/, '').split('?');
    const q = new URLSearchParams(qs || '');
    const id = items[idx] && items[idx].id;
    if (clear || !id) q.delete(param); else q.set(param, id);
    const str = q.toString();
    history.replaceState(history.state, '', `${location.pathname}${location.search}#${path}${str ? '?' + str : ''}`);
  }

  const go = (d) => { idx = (idx + d + items.length) % items.length; update(false); };
  let closed = false;
  let unregisterOverlay = () => {};
  let releaseOverlayLock = () => {};
  const close = () => {
    if (closed) return;
    closed = true;
    unregisterOverlay();
    syncUrl(true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    untrap();
    overlay.remove();
    releaseOverlayLock();
    if (trigger && trigger.focus) trigger.focus();
  };
  function onKey(e) {
    // When a modal (share dialog) sits ABOVE the gallery, it owns the keyboard;
    // otherwise Escape would close both at once. (C.trapFocus catches Tab on the
    // overlay itself; the external modal is unaffected.)
    if (document.querySelector('.modal')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); stepZoom(1); }
    else if (e.key === '-') { e.preventDefault(); stepZoom(-1); }
    else if (e.key === '0') { e.preventDefault(); zoom = 'fit'; applyZoom(); }
    else if (multi && e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (multi && e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  }
  overlay.addEventListener('click', (e) => {
    // The background does NOT close the gallery. When panning a zoomed image,
    // almost every gesture ends on the dark surface, and accidental closure
    // loses zoom and gallery position. Close through the cross or Escape, which
    // remains required because the overlay is a dialog.
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
      // The same CD dialog as the share bar. Thanks to syncUrl(), location.hash
      // already carries the open image, so the shared link opens that exact item.
      const url = `${location.origin}${location.pathname}${location.search}${location.hash}`;
      C.openShareModal(url,
        items[idx]?.type === 'visualisation' ? 'Visualisierung teilen' : 'Aufnahme teilen');
    }
  });
  // The header sits ABOVE the image stage. Its measured height becomes padding
  // on the scroll frame so fit mode hides nothing beneath it while the scrollbar
  // still spans the full viewport height.
  const syncChrome = () => {
    const bar = overlay.querySelector('.pf-lightbox__bar');
    overlay.style.setProperty('--lb-top', `${bar ? Math.round(bar.offsetHeight) : 0}px`);
    overlay.style.setProperty('--lb-bottom', '0px');
  };
  const onResize = () => { syncChrome(); if (zoom === 'fit') applyZoom(); };
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKey);
  // Tab/Shift+Tab use the SHARED focus trap from components.js. Its list excludes
  // [disabled] and includes [tabindex="0"] (the image stage). The former local
  // list ('button, a[href]') counted the disabled fit button as the last element,
  // allowing Tab to escape the dialog (review lb-trap-1).
  const untrap = C.trapFocus(overlay);
  document.body.appendChild(overlay);
  releaseOverlayLock = C.acquireOverlayLock();
  unregisterOverlay = C.registerOverlay(close);
  syncChrome();
  update(true);
  // Repeat after the first image: header line height is not final when attached
  // (measured 63px, final 67px), and the image-stage padding depends on it.
  requestAnimationFrame(syncChrome);
  return close;
}
