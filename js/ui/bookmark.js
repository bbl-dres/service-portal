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
import { filterGroup } from './components/catalogue.js';

// `name` is the record's own title; it makes the button's accessible name say
// WHAT is being remembered, so a screen reader hears the record it belongs to
// rather than a page full of identically labelled buttons.
const TITLE = (on) => (on ? 'Aus meinen Favoriten entfernen' : 'Zu meinen Favoriten hinzufügen');

// TWO shapes, ONE control and ONE sentence.
//
// `star` is the anchor over the hero image, where a label would have to sit on
// top of a photograph. `link` is the same toggle spelled out inside the access
// card, where an unlabelled icon among labelled actions would be the one thing
// on the page you must hover to understand. Both say TITLE — the link shows it,
// the star hides it for screen readers — so the feature has ONE wording rather
// than a short visible label beside a longer spoken one.
//
// Rebuilt identically on first render and after every toggle — one formula, so
// the two can never drift apart.
const shapeOf = (variant) => (variant === 'link' ? 'link' : 'star');

function inner(variant, name, on) {
  const symbol = icon(on ? 'StarFilled' : 'Star', 'btn__icon');
  return shapeOf(variant) === 'link'
    ? `${symbol}<span class="btn__text">${TITLE(on)}</span>`
    : `${symbol}<span class="sr-only">${escape(name)} — ${TITLE(on)}</span>`;
}

export function bookmarkButton({ kind, id, name = '', variant = 'star' } = {}) {
  if (!session.isLoggedIn()) return '';
  if (!bookmarks.KINDS.includes(kind) || !String(id ?? '').trim()) return '';
  const on = bookmarks.has(kind, id);
  const shape = shapeOf(variant);
  // `.btn--link .btn--icon-left` is the house shape for a secondary action inside
  // a .box card (the linked-building and linked-project cards in my-cases). The
  // card's own primary action keeps the outline button, so opening the thing and
  // saving it never compete for the same weight.
  const cls = shape === 'link'
    ? 'btn btn--link btn--icon-left bookmark-link'
    : 'btn btn--bare btn--icon-only bookmark-star';
  return `<button type="button" class="${cls}" data-bookmark-kind="${escape(kind)}"
    data-bookmark-id="${escape(String(id))}" data-bookmark-name="${escape(name)}"
    data-bookmark-variant="${shape}"
    aria-pressed="${on}"${
    // A tooltip that repeats a visible label is read out twice and hovered for
    // nothing; the star has no label, so there it is the whole explanation.
    shape === 'star' ? ` title="${TITLE(on)}"` : ''}>${inner(variant, name, on)}</button>`;
}

// The READ-ONLY twin: «this one is already saved», for catalogue rows and cards.
//
// A <span>, deliberately not a button. A catalogue shows twelve records at once;
// twelve toggles would put twelve tab stops between the reader and the next
// link, and saving is a decision you make on the record, not while scanning past
// it. So this states a fact and offers no action — no aria-pressed, no title, no
// focus. It renders NOTHING when the record is not saved: an empty outline star
// on every row would be twelve invitations to click something that does nothing.
//
// It needs no wireBookmarks entry for the same reason: nothing on these pages
// can change the state, so a mark is correct from paint until the next render.
export function bookmarkMark({ kind, id } = {}) {
  if (!bookmarks.KINDS.includes(kind) || !String(id ?? '').trim()) return '';
  if (!bookmarks.has(kind, id)) return '';
  // The symbol alone is not a label. In a list the column header names the
  // dimension and this names the value; on a card it is the whole statement.
  return `<span class="bookmark-mark">${icon('StarFilled', 'icon--md')}<span class="sr-only">Gemerkt</span></span>`;
}

// A saved-only catalogue filter — the read side of the same store, expressed in
// the machinery the panels already use (C.filterGroup + the `bookmark` hash
// dimension declared in each catalogue's C.catalogueState).
// German UI term: `Nur meine Favoriten`.
//
// SIGNED OUT IT DOES NOT EXIST. Without a person there are no favourites, so the
// option could only ever produce an empty catalogue; offering a filter whose
// single outcome is «no results» explains nothing. Same rule as the star.
export const SAVED_VALUE = 'saved';
export const SAVED_FILTER_LABEL = 'Nur meine Favoriten';

/** The `bookmark` dimension for C.catalogueState, or nothing when signed out. */
export function savedFilterDimension() {
  return session.isLoggedIn() ? { bookmark: [SAVED_VALUE] } : {};
}

/** The panel fieldset, or nothing when signed out. */
export function savedFilterGroup(selected = []) {
  if (!session.isLoggedIn()) return '';
  return filterGroup({ dim: 'bookmark', legend: 'Favoriten', selected,
    options: [{ value: SAVED_VALUE, label: SAVED_FILTER_LABEL }] });
}

/**
 * Whether the filter is on. Guarded by the session too: a hand-typed
 * `?bookmark=saved` must not empty the catalogue for a signed-out reader, who
 * has no way to see why or to switch it off.
 */
export function savedOnly(selected = []) {
  return session.isLoggedIn() && selected.includes(SAVED_VALUE);
}

/** The active-filter pill for the bar above the results. */
export function savedFilterPill(selected, hash) {
  return savedOnly(selected)
    ? [{ label: SAVED_FILTER_LABEL, href: hash({ bookmark: [] }) }]
    : [];
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
    const variant = control.dataset.bookmarkVariant;
    control.setAttribute('aria-pressed', String(on));
    // Only the star owns a title — see bookmarkButton. Setting one here would
    // hand the labelled link the duplicate tooltip it was built without.
    if (shapeOf(variant) === 'star') control.setAttribute('title', TITLE(on));
    control.innerHTML = inner(variant, control.dataset.bookmarkName || '', on);
  });
}
