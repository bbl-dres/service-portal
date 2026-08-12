// Search suggestions for the home page's large field (ARIA combobox).
//
// FOUR CONTENT TYPES, NONE OF THEM FETCHED BEFORE A KEYSTROKE. The list used to
// hold services and knowledge alone, because the other two live in files
// (applications 85 KB, datasets 128 KB) and loading them on the home page «just
// in case someone MIGHT type» would undo the startup work in
// docs/code-review.md §1. That argument was about page LOAD, and the index is
// built on the first typed character now, so it no longer applies: someone who
// types has shown the intent that justifies the request, core caches it for the
// session, and someone who never types pays nothing. Applications were the more
// visible gap — a person looking for «Liegenschaften Inventar» got no suggestion
// at all for a record the full search page has always indexed.
//
// Pressing Enter still searches everything at #/search, which indexes documents,
// news and the rest on top of these four.
//
// Keyboard follows WAI-ARIA 1.2 (combobox with listbox popup): ↓/↑ move, Enter
// selects, Escape closes and Tab leaves. aria-activedescendant announces the
// selection while focus remains in the input, preserving the caret position.

import { search as runSearch, prepare } from './search-engine.js';
import { createListboxController } from '../ui/combobox.js';
import { classifyUrl, safeLinkUrl } from '../security/urls.js';
import * as links from '../links.js';

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
// What the reader is most likely to have meant, as a tie-breaker only. The
// engine adds this to the field score (search-engine.js `score`), where a title
// hit is worth 100 and a description hit 20 — so a strong match of any type
// still outranks a weak match of a preferred one, and these numbers decide
// between comparable hits. Order comes from what the field is FOR: people search
// the portal to start something or to open a system; a reference document is
// what they read once they are there, and it dominated the list because there
// are more documents than anything else (user decision, 2026-08-12).
// Knowledge is pushed DOWN rather than the other three merely being pushed up,
// so that comparable hits separate in both directions.
//
// These stay small ON PURPOSE. Measured for «portfolio»: the directive titled
// «… im BBL Immobilienportfolio» scores 95 because it matches in title,
// description AND extra, while the best service scores 30. Nothing in this table
// closes a 65-point gap, and nothing should — there the document IS the best
// answer, which is why it is ranked lower rather than removed. What the table
// decides is the far commoner case where several types match about as well:
// «raum» now leads with the two services and the booking application, and the
// two documents that describe them follow.
const TYPE_BOOST = { service: 24, application: 16, dataset: 6, knowledge: -12 };

let CACHE = null;
async function suggestIndex(core) {
  if (CACHE) return CACHE;
  // Both requests are shared with the rest of the app through core.ensure, so a
  // later route that needs them finds them loaded. A failure yields no rows for
  // that type — core records it and the shell's data banner reports it.
  const [{ knowledgeIndex }] = await Promise.all([
    import('../knowledge-content.js'),
    core.ensure(['applications', 'datasets']).catch(() => {}),
  ]);
  // Two keystrokes can race to here; the first to finish wins and the second
  // returns the same rows rather than folding the whole index a second time.
  if (CACHE) return CACHE;
  const domainLabel = (k) => (core.ref().domains || []).find((d) => d.key === k)?.label || k;
  const rows = [];
  for (const s of core.services()) {
    if (s.type !== 'action') continue;   // Suggestions lead to something startable.
    rows.push({
      title: s.title, desc: domainLabel(s.domain), resultType: 'Dienstleistung',
      href: links.service(s.serviceId),
      extra: [domainLabel(s.domain), s.short, (s['voraussetzungen'] || []).join(' ')].join(' '),
      // Popularity still separates services from one another, on top of the type.
      boost: TYPE_BOOST.service + (s.popular ? Math.max(0, 20 - s.popular * 2) : 0),
    });
  }
  for (const a of core.applications()) {
    rows.push({
      title: a.name, desc: a.group, resultType: 'Anwendung',
      href: links.application(a.appId),
      extra: [a.group, a.area, a.description, a.appId.replace(/-/g, ' ')].join(' '),
      boost: TYPE_BOOST.application,
    });
  }
  for (const d of core.datasets()) {
    rows.push({
      title: core.t(d.title), desc: core.t(d.meta && d.meta['thema']), resultType: 'Datensatz',
      href: links.dataset(d.id),
      extra: [core.t(d.description), (d.tags || []).join(' ')].join(' '),
      boost: TYPE_BOOST.dataset,
    });
  }
  for (const k of knowledgeIndex()) {
    rows.push({
      title: k.title, desc: k.area, resultType: 'Unterlage',
      href: k.href, external: k.external, extra: k.extra,
      boost: TYPE_BOOST.knowledge,
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
