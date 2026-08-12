// The «merken» control and its wiring — ONE star for every bookmarkable record.
//
// Lives here rather than in js/ui/components/ because it reads the session and
// the bookmark store, and the component layer is deliberately data-free (pages
// pass it everything). Pages import this the way they import js/links.js.
//
// STATE, NOT LABEL. The star is a toggle button carrying `aria-pressed`, so the
// saved state is announced rather than merely drawn. Filled means saved, outline
// means not — plus a title that names the action either way, because fill alone
// is exactly the kind of difference that disappears at a glance.
//
// HIDDEN WHEN SIGNED OUT. A bookmark belongs to a person; without one there is
// nowhere to put it. The catalogue pages that carry the star stay public, so
// this is a real state rather than a theoretical one — it returns nothing at all
// rather than a control that would fail on click.

import { bookmarks } from '../core/bookmarks.js';
import { session } from '../core/session.js';
import { icon, escape } from './components/primitives.js';
import { announce } from './components/feedback.js';

// `name` is the record's own title; it makes the button's accessible name say
// WHAT is being remembered, so a screen reader hears the record it belongs to
// rather than a page full of identically labelled buttons.
const TITLE = (on) => (on ? 'Aus meinen Favoriten entfernen' : 'Zu meinen Favoriten hinzufügen');

// The button's contents, rebuilt identically on first render and after every
// toggle — one formula, so the two can never drift apart.
function inner(variant, name, on) {
  const symbol = icon(on ? 'StarFilled' : 'Star', 'btn__icon');
  return variant === 'button'
    ? `${symbol}<span class="btn__text">${on ? 'Gemerkt' : 'Merken'}</span>`
    : `${symbol}<span class="sr-only">${escape(name)} — ${TITLE(on)}</span>`;
}

export function bookmarkButton({ kind, id, name = '', variant = 'star' } = {}) {
  if (!session.isLoggedIn()) return '';
  if (!bookmarks.KINDS.includes(kind) || !String(id ?? '').trim()) return '';
  const on = bookmarks.has(kind, id);
  const cls = variant === 'button'
    ? 'btn btn--outline btn--icon-left bookmark-btn'
    : 'btn btn--bare btn--icon-only bookmark-star';
  return `<button type="button" class="${cls}" data-bookmark-kind="${escape(kind)}"
    data-bookmark-id="${escape(String(id))}" data-bookmark-name="${escape(name)}"
    data-bookmark-variant="${variant === 'button' ? 'button' : 'star'}"
    aria-pressed="${on}" title="${TITLE(on)}">${inner(variant, name, on)}</button>`;
}

// Delegated once on the document (js/app.js), like wireShare and wireLogin: the
// star survives every route change without per-page wiring.
//
// EVERY control for the same record is redrawn, not just the clicked one. The
// same record can carry a star in its page head and a «Merken» button in its
// access card; updating only the one that was clicked would leave the other
// showing the opposite state on the same screen.
export function wireBookmarks(root = document) {
  root.addEventListener('click', (event) => {
    const button = event.target.closest && event.target.closest('[data-bookmark-kind]');
    if (!button) return;
    const { bookmarkKind: kind, bookmarkId: id } = button.dataset;
    const on = bookmarks.toggle(kind, id);
    syncBookmarkControls(root, kind, id, on);
    announce(on ? 'Zu meinen Favoriten hinzugefügt.' : 'Aus meinen Favoriten entfernt.');
  });
}

// Rewrites the pressed state, the title and the contents of every control for
// this record. Deliberately NOT a page re-render: replacing a button's children
// leaves focus on the button, while redrawing the page would drop it back to the
// document and lose the reader's place.
export function syncBookmarkControls(root, kind, id, on) {
  const selector = `[data-bookmark-kind="${CSS.escape(kind)}"][data-bookmark-id="${CSS.escape(String(id))}"]`;
  root.querySelectorAll(selector).forEach((control) => {
    control.setAttribute('aria-pressed', String(on));
    control.setAttribute('title', TITLE(on));
    control.innerHTML = inner(control.dataset.bookmarkVariant, control.dataset.bookmarkName || '', on);
  });
}
