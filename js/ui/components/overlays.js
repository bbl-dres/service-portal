import { escape, icon } from './primitives.js';

const MODAL_SIZES = new Set(['xs', 'sm', 'md', 'lg', 'xl']);

// Focus trap for modal overlays (lightbox, full-screen chart, document preview):
// Tab/Shift+Tab stay within `container`. Returns an unsubscribe function. Shared
// through C.trapFocus so overlays with their own keyboard logic (gallery,
// document viewer) trap identically. Three divergent copies of this list had
// produced an escape from the trap (WCAG 2.4.3 / 2.1.2; review lb-trap-1).
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
export function trapFocus(container) {
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const f = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

// Overlays can be nested (for example, the share dialog above the gallery).
// A boolean body class cannot represent that ownership: closing the topmost
// dialog used to unlock scrolling while the gallery underneath was still open.
// Give every overlay its own token and remove the class only after the last
// owner releases it.
const overlayLocks = new Set();
const overlayClosers = new Set();
function syncOverlayLock() {
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('body--overlay-open', overlayLocks.size > 0);
  }
}
export function acquireOverlayLock() {
  const token = {};
  overlayLocks.add(token);
  syncOverlayLock();
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    overlayLocks.delete(token);
    syncOverlayLock();
  };
}

// Route-owned content may open a viewer long after render() has returned, so
// its close function cannot be known to ctx.onUnmount up front. The router uses
// this small registry to close all currently open overlays before replacing the
// route. Registration and closing are both idempotent.
export function registerOverlay(close) {
  if (typeof close !== 'function') return () => {};
  overlayClosers.add(close);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    overlayClosers.delete(close);
  };
}
export function closeOverlays() {
  // Close topmost/most recently opened first. Work on a snapshot because every
  // close removes itself from the registry.
  [...overlayClosers].reverse().forEach((close) => {
    try { close(); } catch (e) { console.warn('[overlay] cleanup failed', e); }
  });
}

// Canonical modal (CD modal.postcss BEM). `modal()` supplies markup; `openModal()`
// appends it to document.body, traps focus, closes on Escape / backdrop click /
// [data-modal-close], and restores focus. Primitive for new dialogs; `body` and
// `footer` are RAW HTML (caller escapes). `size` = sm|md|lg|xl.
function modal({ title = '', body = '', footer = '', size = 'md', id = 'modal' } = {}) {
  const modalSize = MODAL_SIZES.has(size) ? size : 'md';
  const titleId = `${id}-title`, bodyId = `${id}-desc`;
  // Accessible name «Dialog schliessen». This family names context everywhere
  // («Galerie schliessen», «Vorschau schliessen», «Hinweis schliessen»); modal
  // was the only bare «Schliessen» (design review D15).
  const closeBtn = `<button type="button" class="modal__close" data-modal-close aria-label="Dialog schliessen">${icon('Cancel', 'icon--2xl')}</button>`;
  // CD Modal.vue:2-27: aria-modal on the wrapper; role="dialog" plus
  // aria-labelledby and aria-describedby on .modal__content; the body carries
  // the referenced id. The header ALWAYS exists (without it, the flex column
  // stretched the close button to full width); `--with-title` changes only
  // distribution.
  return `<div class="modal modal--${modalSize}" aria-modal="true">
    <div class="modal__backdrop" data-modal-close></div>
    <div class="modal__content" role="dialog"${title ? ` aria-labelledby="${escape(titleId)}"` : ''} aria-describedby="${escape(bodyId)}">
      <div class="modal__header${title ? ' modal__header--with-title' : ''}">${title ? `<h2 class="modal__title" id="${escape(titleId)}">${escape(title)}</h2>` : ''}${closeBtn}</div>
      <div class="modal__body" id="${escape(bodyId)}">${body}</div>
      ${footer ? `<div class="modal__footer">${footer}</div>` : ''}
    </div>
  </div>`;
}
export function openModal(opts = {}) {
  const trigger = document.activeElement;
  const host = document.createElement('div');
  host.innerHTML = modal(opts);
  const el = host.firstElementChild;
  document.body.appendChild(el);
  const releaseOverlayLock = acquireOverlayLock();
  const untrap = trapFocus(el);
  let closed = false;
  let unregisterOverlay = () => {};
  const close = () => {
    if (closed) return;
    closed = true;
    unregisterOverlay();
    document.removeEventListener('keydown', onKey, true);
    untrap(); el.remove(); releaseOverlayLock();
    if (trigger && trigger.focus) trigger.focus();
  };
  // stopPropagation, not just preventDefault: a modal is modal. Otherwise the
  // same Escape reached the gallery underneath and closed BOTH at once. The
  // modal listener runs first in capture phase, so a simple «is a modal above?»
  // guard was ineffective.
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault(); e.stopPropagation();
    close();
  };
  unregisterOverlay = registerOverlay(close);
  el.addEventListener('click', (e) => { if (e.target.closest('[data-modal-close]')) close(); });
  document.addEventListener('keydown', onKey, true);
  const first = el.querySelector('.modal__close'); if (first) first.focus();
  return close;
}

// Share bar (share-bar.postcss) after the breadcrumb on detail pages: print and
// copy link. Right-aligned (flex-row-reverse), as in CD.
export function shareBar() {
  // CD: icons only (aria-label), no visible labels, large icons (ShareBar.vue,
  // SvgIcon size="xl"). The share button opens the CD dialog (openShareModal).
  // It previously copied silently to the clipboard, with no feedback, visible
  // URL, or fallback when the Clipboard API was blocked.
  return `<div class="share-bar">
    <div class="share-container">
      <button class="btn btn--bare share-bar__btn" type="button" data-print-page aria-label="Seite drucken" title="Drucken">${icon('Printer', 'icon--xl')}</button>
      <button class="btn btn--bare share-bar__btn share-bar__share-button" type="button" data-share
        aria-label="Inhalt teilen" title="Teilen">${icon('Share', 'icon--xl')}</button>
    </div>
  </div>`;
}

// «Inhalt teilen» — CD pattern (detailPageSimple.vue:810-866): an xs modal with
// a READ-ONLY input showing the URL, followed by `.share-url` containing the
// copy button and a live region that reports success. CD's template also lists
// social networks above it (Facebook/X/LinkedIn/Xing/WhatsApp); omit them because
// an internal federal portal does not share content on commercial platforms.
//
// Why show a field rather than only «copied»: the Clipboard API requires a secure
// context and may be blocked. With the URL visible in the field, it can still be
// selected manually, so the function never fails completely.
function shareUrlBlock(url, { id = 'share-url-input' } = {}) {
  return `<div class="pt-3">
    <label class="sr-only" for="${escape(id)}">Link zu diesem Inhalt</label>
    <input id="${escape(id)}" class="input--outline input--base" type="text" readonly
      value="${escape(url)}" data-share-url>
    <div class="share-url">
      ${/* CD detailPageSimple.vue:847-853: label-only button (outline, mt-3). The
            template has NO link icon on the copy button. */''}
      ${/* «Link kopieren», matching the five menu entries and «Link kopiert.»
            toast. CD's demo says «URL Kopieren» (detailPageSimple.vue:850), whose
            internal capitalisation is not standard German. This deliberate
            deviation is documented in docs/design-review.md. */''}
      <button type="button" class="btn btn--outline mt-3" data-share-copy>
        <span class="btn__text">Link kopieren</span></button>
      <div aria-live="polite" data-share-done></div>
    </div>
  </div>`;
}

export function openShareModal(url = location.href, title = 'Inhalt teilen') {
  // CD places content in a white .card (detailPageSimple.vue:817); the header
  // sits above it in white on the scrim.
  const close = openModal({ title, size: 'xs',
    body: `<div class="card card--default"><div class="card__content"><div class="card__body">${shareUrlBlock(url)}</div></div></div>` });
  const root = document.querySelector('.modal--xs') || document;
  const input = root.querySelector('[data-share-url]');
  const btn = root.querySelector('[data-share-copy]');
  const done = root.querySelector('[data-share-done]');
  if (input) { input.focus(); input.select(); }
  if (btn) btn.addEventListener('click', () => {
    // Badge anatomy as in CD (Badge.vue:11-12): badge__icon-left before badge__text.
    const ok = () => { if (done) done.innerHTML = `<span class="badge badge--success badge--sm mt-3">${icon('Checkmark', 'badge__icon-left')}<span class="badge__text">Link kopiert</span></span>`; };
    const fail = () => { if (done) done.innerHTML = `<span class="badge badge--warning badge--sm mt-3">${icon('WarningCircle', 'badge__icon-left')}<span class="badge__text">Kopieren nicht möglich — bitte von Hand markieren</span></span>`; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok, fail);
    } else if (input) {
      // Fallback without the Clipboard API.
      try { input.select(); document.execCommand('copy'); ok(); } catch { fail(); }
    } else fail();
  });
  return close;
}

// Clicking a share button opens the dialog. Wire once globally so every page
// with a share bar gets it without additional setup.
export function wireShare(root = document) {
  root.addEventListener('click', (e) => {
    const print = e.target.closest('[data-print-page]');
    if (print) {
      e.preventDefault();
      window.print();
      return;
    }
    const b = e.target.closest('[data-share]');
    if (!b) return;
    e.preventDefault();
    openShareModal(b.dataset.share || location.href);
  });
}
