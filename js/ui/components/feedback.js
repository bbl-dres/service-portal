import { escape, icon, safeHeadingTag } from './primitives.js';
import { safeLinkUrl } from '../../security/urls.js';

const NOTIFICATION_VARIANTS = new Set(['alert', 'error', 'hint', 'info', 'success', 'warning']);
const BUTTON_VARIANTS = new Set(['bare', 'filled', 'link', 'outline']);
const notificationVariant = (value) => NOTIFICATION_VARIANTS.has(value) ? value : 'info';

// Fixed notice strip at the bottom of the viewport — CD's consent component
// (notification-banner.postcss + NotificationBanner.vue). Anatomy matches it:
// `.notification-banner` (+ `--fixed`) also carries `.notification` classes,
// containing a `__wrapper` with `__infos` and the action.
function notificationBanner({ id, html, actionLabel = 'Verstanden', variant = 'info', label = 'Hinweis' }) {
  const safeVariant = notificationVariant(variant);
  return `<div class="notification-banner notification-banner--fixed notification notification--${safeVariant}"
      role="region" aria-label="${escape(label)}" data-banner="${escape(id)}">
    <div class="notification-banner__wrapper">
      <p class="notification-banner__infos">${html}</p>
      <button type="button" class="btn btn--outline btn--sm btn--icon-right" data-banner-close>
        ${icon('Checkmark', 'btn__icon')}<span class="btn__text">${escape(actionLabel)}</span></button>
    </div>
  </div>`;
}

// Mount and remember dismissal. Without persistence, the notice would reappear
// after every page change, which is why consent banners need storage at all.
export function mountBanner(host, opts) {
  if (!host) return;
  const key = 'bbl_banner_' + opts.id;
  let seen = false;
  try { seen = localStorage.getItem(key) === '1'; } catch { /* Storage blocked. */ }
  if (seen) return;
  host.innerHTML = notificationBanner(opts);
  const banner = host.querySelector('.notification-banner--fixed');
  let observer = null;
  const reserveSpace = () => {
    if (!banner || !banner.isConnected) return;
    document.body.style.setProperty('--banner-offset', `${Math.ceil(banner.getBoundingClientRect().height)}px`);
    document.body.classList.add('body--banner-visible');
  };
  const keepFocusVisible = (event) => {
    const target = event.target;
    if (!banner || !(target instanceof Element) || banner.contains(target)) return;
    const targetRect = target.getBoundingClientRect();
    const bannerRect = banner.getBoundingClientRect();
    if (targetRect.bottom <= bannerRect.top || targetRect.top >= bannerRect.bottom) return;
    const delta = Math.ceil(targetRect.bottom - bannerRect.top + 8);
    const scroller = document.scrollingElement;
    if (!scroller) { window.scrollBy(0, delta); return; }
    const priorBehavior = scroller.style.scrollBehavior;
    scroller.style.scrollBehavior = 'auto';
    scroller.scrollTop += delta;
    scroller.style.scrollBehavior = priorBehavior;
  };
  const releaseSpace = () => {
    observer?.disconnect();
    window.removeEventListener('resize', reserveSpace);
    document.removeEventListener('focusin', keepFocusVisible);
    document.body.classList.remove('body--banner-visible');
    document.body.style.removeProperty('--banner-offset');
  };
  if (banner) {
    reserveSpace();
    document.addEventListener('focusin', keepFocusVisible);
    if ('ResizeObserver' in window) {
      observer = new ResizeObserver(reserveSpace);
      observer.observe(banner);
    } else window.addEventListener('resize', reserveSpace);
  }
  const btn = host.querySelector('[data-banner-close]');
  if (btn) btn.addEventListener('click', () => {
    releaseSpace();
    host.innerHTML = '';
    try { localStorage.setItem(key, '1'); } catch { /* It will simply return. */ }
    announce('Hinweis geschlossen.');
  });
  return releaseSpace;
}

// Announce into the persistent live region (#live in index.html) for result-count,
// view, and page changes that would otherwise be silent (WCAG 4.1.3). Mutate
// text only; never recreate the node, or aria-live will not fire.
export function announce(msg) {
  const n = document.getElementById('live');
  if (n) n.textContent = msg;
}

// --- Notifications (notification.postcss) ------------------------------------
// One delegated wiring for every notification close button. House rule: no
// inline onclick (see menu()). Announcement through the persistent #live region
// matches mountBanner («Hinweis geschlossen.»); CD Notification.vue also binds
// the handler programmatically.
let notifCloseWired = false;
function ensureNotificationClose() {
  if (notifCloseWired || typeof document === 'undefined') return;
  notifCloseWired = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('[data-notification-close]');
    if (!btn) return;
    const n = btn.closest('.notification');
    if (!n) return;
    n.remove();
    announce('Hinweis geschlossen.');
  });
}

let reloadActionWired = false;
function ensureReloadAction() {
  if (reloadActionWired || typeof document === 'undefined') return;
  reloadActionWired = true;
  document.addEventListener('click', (event) => {
    const button = event.target.closest && event.target.closest('[data-reload-page]');
    if (!button) return;
    event.preventDefault();
    location.reload();
  });
}

// Shared notification anatomy. The public `notification` helper treats its
// input as text. Author-owned markup must opt into `notificationHtml`, making
// the trust boundary visible at every call site.
function notificationMarkup(content, variant = 'info', iconName = 'InfoCircle', opts = {}) {
  // `live: true` ONLY for messages arriving as the result of an action. Every
  // notification previously carried a live role, including static notices
  // already present at load. Screen readers then read the page as a sequence of
  // status messages, and aria-live does not fire in a newly created region
  // anyway (Item 3.9).
  const safeVariant = notificationVariant(variant);
  const role = opts.live ? ((safeVariant === 'error' || safeVariant === 'alert') ? 'alert' : 'status') : '';
  if (opts.dismissible) ensureNotificationClose();
  const close = opts.dismissible
    ? `<button type="button" class="notification__close interactive-control" aria-label="Hinweis schliessen" data-notification-close>${icon('Cancel', 'icon--md')}</button>`
    : '';
  const cls = `notification notification--${safeVariant}${opts.dismissible ? ' notification--dismissible' : ''}`;
  return `<div class="${cls}"${role ? ` role="${role}"` : ''}>${icon(iconName, 'notification__icon')}<div class="notification__content">${content}</div>${close}</div>`;
}

// variant: info | success | warning | error | hint | alert
export function notification(text, variant = 'info', iconName = 'InfoCircle', opts = {}) {
  return notificationMarkup(escape(text), variant, iconName, opts);
}

// Deliberate raw-HTML counterpart for static, author-owned component markup.
// Data, URL parameters, storage values, and user input must be escaped before
// they are included in `html`.
export function notificationHtml(html, variant = 'info', iconName = 'InfoCircle', opts = {}) {
  ensureReloadAction();
  return notificationMarkup(String(html || ''), variant, iconName, opts);
}

// Completion state for a submitted case. Four form apps hand-built it: success
// message with reference, thank-you heading, explanatory sentence, and action
// row. They diverged exactly where it matters: space-request wrote its own
// `<div class="notification notification--success">` and lost
// `.notification__content`, the text-width constraint. workspace uses an h2
// (correct because the page already has an h1), while the others use h1. Buttons
// were `btn--outline` three times and `btn--filled` once.
//
//   lead     sentence in the success message («Antrag eingereicht.»)
//   title    heading; use `heading:'h2'` where the page already has an h1
//   text     explanatory sentence below
//   extraHtml optional author-owned HTML block (attribute list, extra notice)
//   actions  [{ href | id, label, variant, icon }] — first action filled
export function processDone({ instance, lead, title, heading = 'h1', text,
  extraHtml = '', actions = [] } = {}) {
  const headingTag = safeHeadingTag(heading, 'h1');
  const button = (a, i) => {
    const fallbackVariant = i === 0 ? 'filled' : 'outline';
    const variant = BUTTON_VARIANTS.has(a.variant) ? a.variant : fallbackVariant;
    const cls = `btn btn--${variant}${a.icon ? ' btn--icon-right' : ''}`;
    const content = `${a.icon ? icon(a.icon, 'btn__icon') : ''}<span class="btn__text">${escape(a.label)}</span>`;
    const href = safeLinkUrl(a.href);
    if (href) return `<a class="${cls}" href="${escape(href)}">${content}</a>`;
    if (a.id) return `<button class="${cls}" type="button" id="${escape(a.id)}">${content}</button>`;
    return `<span class="${cls}" aria-disabled="true">${content}</span>`;
  };
  return `
    ${notificationHtml(`<strong>${escape(lead)}</strong> Ihre Referenz: <strong>${escape(instance.reference)}</strong>`,
      'success', 'CheckmarkCircle')}
    <${headingTag} tabindex="-1" class="mt-6">${escape(title)}</${headingTag}>
    <p class="lead">${escape(text)}</p>
    ${extraHtml}
    ${actions.length ? `<div class="row mt-6">${actions.map(button).join('')}</div>` : ''}`;
}

// Display and announce an error at the top of the page for client-side action
// failures (for example, localStorage persistence failed; code review C1).
export function flashError(mount, msg) {
  announce(msg);
  const host = mount && mount.querySelector('.container');
  if (host) host.insertAdjacentHTML('afterbegin', notification(msg, 'error', 'WarningCircle'));
}

// Short, self-dismissed status message for simulated/completed actions. CD
// toast-message (toast-message.postcss:5-18 + ToastMessage.vue): fixed host at
// bottom 10%, containing a normal notification (default: success with
// CheckmarkCircle; failure paths pass 'error'/'warning'), visible for 5s. The
// message is visual only; the SR announcement uses the persistent #live region
// (announce), because aria-live does not fire in a newly created node.
export function toast(msg, variant = 'success', iconName = 'CheckmarkCircle') {
  announce(msg);
  if (typeof document === 'undefined') return;
  const t = document.createElement('div');
  t.className = 'toast__message';
  t.innerHTML = notification(msg, variant, iconName);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast__message--in'));
  setTimeout(() => { t.classList.remove('toast__message--in'); setTimeout(() => t.remove(), 300); }, 5000);
}
