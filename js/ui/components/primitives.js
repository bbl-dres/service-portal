import { safeAssetUrl } from '../../security/urls.js';

// Shared UI component helpers — all return HTML strings (pages compose via templates).
// Class names follow the CD Bund design system; see docs/cd-gap-analysis.md.

const ICON_BASE = 'assets/icons/';
// Permit one optional lowercase icon-set directory and no traversal segments.
const ICON_NAME = /^(?:[a-z][a-z0-9-]*\/)?[A-Za-z][A-Za-z0-9-]*$/;
const CLASS_TOKEN = /^-?[_A-Za-z][_A-Za-z0-9-]*$/;
const SAFE_COLOR = /^(?:#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8}|var\(--[a-z0-9-]+\))$/i;
const BADGE_VARIANTS = new Set(['gray', 'blue', 'purple', 'teal', 'green', 'yellow', 'orange', 'red', 'info', 'success', 'warning', 'error']);
const BADGE_SIZES = new Set(['', 'base', 'sm']);

export function safeClassList(value, fallback = '') {
  const tokens = String(value || '').split(/\s+/).filter((token) => CLASS_TOKEN.test(token));
  return tokens.join(' ') || fallback;
}

export function safeHeadingTag(value, fallback = 'h2') {
  return /^h[1-6]$/.test(String(value || '')) ? String(value) : fallback;
}

// An id or other DOM token from caller data. It lived privately in navigation.js
// until content.js needed the same guard for anchor ids; a second copy of a
// SECURITY check is the copy that gets fixed only once.
const DOM_TOKEN = /^[A-Za-z][A-Za-z0-9_-]*$/;
export function domToken(value, fallback = '') {
  return DOM_TOKEN.test(String(value || '')) ? String(value) : fallback;
}

// CD's own chevron path (Select.vue:19 — identical to assets/icons/ChevronDown.svg)
export const CHEVRON_SVG = '<svg role="presentation" aria-hidden="true" viewBox="0 0 24 24">'
  + '<path d="m5.706 10.015 6.669 3.85 6.669-3.85.375.649-7.044 4.067-7.044-4.067z"/></svg>';

// --- Placeholder photography -------------------------------------------------
// SINCE THE IMAGE REVIEW (2026-08-04), NO collection carries Unsplash photo IDs.
// All images live locally under assets/images/ (provenance in the respective
// JSON or assets/images/heroes/README.md). photoUrl/`id` remains as a fallback
// for legacy states: the ID is interpolated only after strict character
// validation, and the card's `color` remains behind the image.
const PHOTO_BASE = 'https://images.unsplash.com/photo-';
const PHOTO_ID = /^[A-Za-z0-9_-]+$/;

export function photoUrl(id, { w = 800, h = 0, q = 70, gray = false } = {}) {
  if (!id || !PHOTO_ID.test(id)) return '';
  const width = Number.isFinite(Number(w)) && Number(w) > 0 ? Math.round(Number(w)) : 800;
  const height = Number.isFinite(Number(h)) && Number(h) > 0 ? Math.round(Number(h)) : 0;
  const quality = Number.isFinite(Number(q)) && Number(q) > 0 && Number(q) <= 100 ? Math.round(Number(q)) : 70;
  let u = `${PHOTO_BASE}${id}?auto=format&fit=crop&w=${width}&q=${quality}`;
  if (height) u += `&h=${height}`;
  if (gray) u += '&sat=-100';   // historic material reads as archival b/w
  return u;
}

// `src` takes precedence over `id`: use a real locally stored image when present
// (assets/images/buildings/…), otherwise retain the Unsplash placeholder via id.
// Both fall back to the colour field if loading fails.
let photoFallbackWired = false;

function ensurePhotoFallback() {
  if (photoFallbackWired || typeof document === 'undefined') return;
  photoFallbackWired = true;
  // Resource errors do not bubble, so use one capture listener for every photo
  // instead of executable inline onerror attributes in generated markup.
  document.addEventListener('error', (event) => {
    const image = event.target;
    if (image && image.matches && image.matches('img[data-photo-fallback]')) image.remove();
  }, true);
}

export function photo(o = {}) {
  const src = safeAssetUrl(o.src) || photoUrl(o.id, { w: o.w, h: o.h, q: o.q, gray: o.gray });
  if (src) ensurePhotoFallback();
  const cls = safeClassList(o.cls);
  const color = SAFE_COLOR.test(String(o.color || '')) ? o.color : 'var(--color-secondary-600)';
  const img = src
    ? `<img src="${src}" alt="${escape(o.alt || '')}" loading="lazy" decoding="async" data-photo-fallback>`
    : '';
  return `<div class="photo${cls ? ' ' + cls : ''}" style="background-color:${color}">${img}${o.overlayHtml || ''}</div>`;
}

export function icon(name, cls = 'icon--base') {
  const safeName = ICON_NAME.test(String(name || '')) ? name : 'InfoCircle';
  const safeClasses = safeClassList(cls, 'icon--base');
  const u = ICON_BASE + safeName + '.svg';
  return `<span class="icon ${safeClasses}" style="-webkit-mask-image:url('${u}');mask-image:url('${u}')" aria-hidden="true"></span>`;
}

export function escape(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Break opportunities for long German compounds: UAX#14 does not permit a break
// after «/» or a hyphen by default, so «Sicherheits-/Datenschutzvorfall» was
// treated as one indivisible word and broke mid-word (visible at BOTH 1440 and
// 320). <wbr> enables the position without adding a character, so `textContent`
// remains identical and tests are unaffected (Item 5.8).
export function breakable(s) {
  return escape(s).replace(/([/–—-])(?=\S)/g, '$1<wbr>');
}

// decodeURIComponent that returns the raw value rather than throwing on
// malformed sequences (such as a manually typed `#/applications/%` hash)
// (code review A6).
export function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Recurring English terms within otherwise German text. For WCAG 3.1.2
// (language of parts), mark them inline with lang="en" so screen readers
// pronounce them in English.
const EN_TERMS = ['Digital by Design', 'Digital First', 'Digital Only', 'Once-Only', 'Common Data Environment'];

// Escape text and mark known foreign-language phrases with lang. Process longer
// phrases first so partial phrases are not wrapped prematurely.
export function markLang(text, terms = EN_TERMS) {
  let out = escape(text);
  for (const phrase of [...terms].sort((a, b) => b.length - a.length)) {
    const e = escape(phrase);
    if (out.includes(e)) out = out.split(e).join(`<span lang="en">${e}</span>`);
  }
  return out;
}

// --- Badges (badge.postcss) --------------------------------------------------
// CD anatomy (Badge.vue:11-18): the label sits in a .badge__text span. Symbols
// use .badge__icon / .badge__icon-left (scaled in em and optically pulled into
// the 1em padding), not generic icon--* classes plus a flex gap.
export function badge(text, variant = 'gray', size = '') {
  const safeVariant = BADGE_VARIANTS.has(variant) ? variant : 'gray';
  const safeSize = BADGE_SIZES.has(size) ? size : '';
  return `<span class="badge badge--${safeVariant}${safeSize ? ' badge--' + safeSize : ''}"><span class="badge__text">${escape(text)}</span></span>`;
}

// Loading state — the ONE pattern for «loading / processing» (user decision,
// 2026-08-04): the CD spinner symbol (icon--spin; reduced-motion kill switch in
// app.css) plus wording as a status row. role="status" makes the text a live
// announcement for screen readers; the symbol is decorative. German UI term:
// subject-specific wording, or generic wording without a subject. `hideLabel`
// makes the wording sr-only where the symbol is visually sufficient (router,
// card overlay). Replaces former one-off implementations (router inline,
// map spinner inline, dash-map__loading text row).
export function loading({ label = 'Wird geladen…', hideLabel = false, size = 'xl' } = {}) {
  return `<div class="loading" role="status">
    ${icon('Spinner', `icon--${size} icon--spin`)}
    <span class="${hideLabel ? 'sr-only' : 'loading__label'}">${escape(label)}</span>
  </div>`;
}

const STATUS_VARIANT = {
  'entwurf': 'gray', 'eingereicht': 'info', 'in_pruefung': 'warning', 'in_pruefung_gs': 'warning',
  'in_pruefung_pfm': 'warning', 'rueckfrage': 'warning', 'in_arbeit': 'warning', 'triage': 'info',
  'genehmigt': 'success', 'in_projekt': 'info', 'abgeschlossen': 'success', 'erledigt': 'success',
  'geliefert': 'success', 'abgelehnt': 'error', 'zurueckgezogen': 'gray', 'in_bearbeitung': 'warning',
};
export function statusBadge(status, label) {
  return badge(label || status, STATUS_VARIANT[status] || 'gray');
}

// Replace `mount.innerHTML` and restore focus + cursor position when the active
// element has an id. A full innerHTML replacement otherwise drops
// document.activeElement back to <body>: in the booking form, each selection
// lost BOTH focus and caret, and Tab restarted at the page header (WCAG 2.4.3 /
// 3.2.2). Returns true when focus was restored. Capture focus + caret and return
// a function that restores both after rebuilding. This is a pair (not
// rerender(mount, html)) because draw() functions write multiline template
// literals with nested backticks, and focus then also survives rewiring in wire():
//     const restore = C.preserveFocus(mount);
//     mount.innerHTML = `…`;  wire();  restore();
export function preserveFocus(mount) {
  const a = document.activeElement;
  const id = a && mount.contains(a) ? a.id : '';
  const sel = a && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null;
  return () => {
    if (!id) return false;
    const el = mount.querySelector('#' + CSS.escape(id));
    if (!el) return false;
    el.focus({ preventScroll: true });
    if (sel && el.setSelectionRange) { try { el.setSelectionRange(sel[0], sel[1]); } catch { /* Not supported by every field type. */ } }
    return true;
  };
}


// Make `tabindex` on scroll regions conditional on real overflow. An unconditional
// tabindex="0" creates a dead tab stop on wide viewports; `.table-wrapper` used
// to add it unconditionally, while this measures it. The region is also
// announced as a group only when it truly scrolls (Item 3.21).
const SCROLL_SEL = '[data-scroll-region], .table-wrapper, pre.api-code';
export function wireScrollRegions(root) {
  const scan = () => {
    root.querySelectorAll(SCROLL_SEL).forEach((el) => {
      const scrolls = el.scrollWidth > el.clientWidth + 1;
      el.classList.toggle('is-scrollable', scrolls);
      if (scrolls) {
        el.setAttribute('tabindex', '0');
        // An UNNAMED region/group is worse for assistive technology than none: it
        // appears as an anonymous node in the landmark/group tree. Only elements
        // that provide a name are declared as named groups.
        const named = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        if (named && !el.hasAttribute('role')) el.setAttribute('role', 'group');
        if (!named) el.removeAttribute('role');
      } else {
        el.removeAttribute('tabindex');
        el.removeAttribute('role');
      }
    });
  };
  scan();
  // Two triggers: width changes (overflow appears/disappears) AND rerenders
  // (mountDataTable, renderMain, and tab changes replace entire subtrees; new
  // wrappers were otherwise never discovered and remained without tabindex).
  let pending = 0;
  const queue = () => { if (pending) return; pending = requestAnimationFrame(() => { pending = 0; scan(); }); };
  const mo = typeof MutationObserver === 'function' ? new MutationObserver(queue) : null;
  if (mo) mo.observe(root, { childList: true, subtree: true });
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(queue) : null;
  if (ro) ro.observe(root);
  return () => {
    if (pending) cancelAnimationFrame(pending);
    if (mo) mo.disconnect();
    if (ro) ro.disconnect();
  };
}
