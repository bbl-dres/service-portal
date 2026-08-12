// Search suggestions for the home page's large field (ARIA combobox).
//
// DELIBERATELY LIMITED TO WHAT IS ALREADY PRESENT: eagerly loaded services and
// knowledge and resources (JS literals, no request). These 150 entries are the
// two content types indicated by every signal: cases and templates
// (docs/search-review.md §2). Building the full index would load another 236 KB
// on the home page just in case someone MIGHT type, undoing the startup work in
// docs/code-review.md §1. Pressing Enter searches everything at #/search.
//
// Keyboard follows WAI-ARIA 1.2 (combobox with listbox popup): ↓/↑ move, Enter
// selects, Escape closes and Tab leaves. aria-activedescendant announces the
// selection while focus remains in the input, preserving the caret position.

import { search as runSearch, prepare } from './search-engine.js';
import { createListboxController } from '../ui/combobox.js';
import { classifyUrl, safeLinkUrl } from '../security/urls.js';

const MAX = 7;

// Build and cache the index once per page load. Refolding 150 entries on every
// keystroke would be affordable but unnecessary.
//
// js/knowledge-content.js is imported DYNAMICALLY, and that is the point of this
// function being async. The paragraph above about not loading 236 KB «just in
// case someone MIGHT type» applies to the knowledge content itself: it is 50 KB,
// the home page is the most visited route in the portal, and a static import put
// all of it in that route's critical path for a list that cannot appear before
// the second typed character. Nothing else here reads the module, so deferring
// it costs one import at the first keystroke and nothing afterwards.
let CACHE = null;
async function suggestIndex(core) {
  if (CACHE) return CACHE;
  const { knowledgeIndex } = await import('../knowledge-content.js');
  // Two keystrokes can race to here; the first to finish wins and the second
  // returns the same rows rather than folding 150 entries a second time.
  if (CACHE) return CACHE;
  const domainLabel = (k) => (core.ref().domains || []).find((d) => d.key === k)?.label || k;
  const rows = [];
  for (const s of core.services()) {
    if (s.type !== 'action') continue;   // Suggestions lead to something startable.
    rows.push({
      title: s.title, desc: domainLabel(s.domain), resultType: 'Dienstleistung',
      href: `#/services/${encodeURIComponent(s.serviceId)}`,
      extra: [domainLabel(s.domain), s.short, (s['voraussetzungen'] || []).join(' ')].join(' '),
      boost: s.popular ? Math.max(0, 20 - s.popular * 2) : 0,
    });
  }
  for (const k of knowledgeIndex()) {
    rows.push({
      title: k.title, desc: k.area, resultType: 'Unterlage',
      href: k.href, external: k.external, extra: k.extra,
    });
  }
  CACHE = rows.map(prepare);
  return CACHE;
}

// `input` is the field and `form` its form. Returns a cleanup function which the
// caller attaches to ctx.onUnmount so no list remains in the DOM after a route
// change.
export function attachSuggest(input, form, core, C) {
  const listId = input.id + '-suggest';
  const list = document.createElement('ul');
  list.className = 'listbox listbox--suggest';
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Suchvorschläge');
  list.hidden = true;
  // The field sits in a flex container; the list belongs below the FIELD, not
  // below the row containing the button.
  const anchor = input.parentElement;
  anchor.classList.add('listbox-anchor');
  anchor.appendChild(list);

  let items = [];
  const controller = createListboxController({
    input,
    list,
    onChoose: (item) => {
      const href = safeLinkUrl(item.href);
      const kind = classifyUrl(href);
      if (item.external && kind === 'external') window.open(href, '_blank', 'noopener,noreferrer');
      else if (!item.external && kind === 'route') location.hash = href;
    },
  });
  const close = controller.close;

  // The index now arrives asynchronously on the first query, so a keystroke has
  // to be able to lose: `version` drops the result of any query the user has
  // already typed past, and `detached` drops one that arrives after the route
  // changed. Without either, a slow first import could paint suggestions for a
  // prefix that is no longer in the field, or into a list already removed.
  let version = 0;
  let detached = false;

  const open = async (q) => {
    const mine = ++version;
    const index = await suggestIndex(core);
    if (detached || mine !== version) return;
    items = runSearch(index, q).slice(0, MAX);
    if (!items.length) return close();
    list.innerHTML = items.map((r, i) => `
      <li class="listbox__option" role="option" id="${listId}-${i}" aria-selected="false" data-i="${i}">
        <span class="listbox__title">${C.escape(r.title)}</span>
        <span class="listbox__meta">${C.escape(r.resultType)}${r.desc ? ' · ' + C.escape(r.desc) : ''}</span>
      </li>`).join('');
    controller.setItems(items);
  };

  const onInput = () => {
    const q = input.value.trim();
    // Deleting back below two characters must also invalidate an in-flight
    // query, or its result would reopen the list the user just emptied.
    if (q.length < 2) { version++; return close(); }
    void open(q);
  };

  const onSubmit = () => close();

  input.addEventListener('input', onInput);
  form.addEventListener('submit', onSubmit);

  return () => {
    detached = true;
    input.removeEventListener('input', onInput);
    form.removeEventListener('submit', onSubmit);
    controller.destroy();
    list.remove();
  };
}
