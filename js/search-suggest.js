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
import { knowledgeIndex } from './knowledge-content.js';
import { createListboxController } from './combobox.js';

const MAX = 7;

// Build and cache the index once per page load. Refolding 150 entries on every
// keystroke would be affordable but unnecessary.
let CACHE = null;
function suggestIndex(core) {
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
      if (item.external) window.open(item.href, '_blank', 'noopener');
      else location.hash = item.href.replace(/^#/, '#');
    },
  });
  const close = controller.close;

  const open = (q) => {
    items = runSearch(suggestIndex(core), q).slice(0, MAX);
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
    if (q.length < 2) return close();
    open(q);
  };

  const onSubmit = () => close();

  input.addEventListener('input', onInput);
  form.addEventListener('submit', onSubmit);

  return () => {
    input.removeEventListener('input', onInput);
    form.removeEventListener('submit', onSubmit);
    controller.destroy();
    list.remove();
  };
}
