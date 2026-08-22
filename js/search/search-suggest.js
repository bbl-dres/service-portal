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
//
// GROUPED BY KIND, NOT FILTERABLE. Model: map.geo.admin.ch, where section
// headings separate the kinds instead of a filter control narrowing them. That
// is the better answer to «I only want to see services»: the grouping is already
// there before anyone has to look for a control, and it costs no click. A filter
// button here would have to manage without result counts; the facets on the
// results page have them.
//
// Grouping stays inside the FOUR kinds this index already holds. Reaching for
// the full eleven would mean loading documents, buildings, projects, data tables,
// processes and business objects on the portal's most visited route — exactly the
// startup cost docs/code-review.md §1 removed, and for a list that shows at most
// seven rows.
//
// WHERE THE SEARCH GIVES UP, THERE IS NOW A WAY. `close()` on zero results means
// the list goes quietly empty at the precise moment somebody typed a question.
// The action row below the list offers «… als Frage stellen» instead. It sits
// OUTSIDE the role="listbox" element: an option may contain neither prose nor
// links, and putting it inside would break the option contract and make it
// unusable for screen readers.

import { search as runSearch, prepare } from './search-engine.js';
import { createListboxController } from '../ui/combobox.js';
import { classifyUrl, safeLinkUrl } from '../security/urls.js';
import * as links from '../links.js';
import { isQuestion } from './query-resolve.js';
import { EXAMPLE_QUESTIONS } from './search-ui.js';
import { filterRows } from './search-sources.js';
import { byKind } from './search-kinds.js';

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
// If applications/datasets fail on the FIRST keystroke (the ensure below
// swallows the rejection by design), the index is built from empty accessors
// — without this it stayed empty for the whole session even after the data
// recovered. core dispatches this event on late/recovered loads
// (code review 2026-08, F-S18).
document.addEventListener('core:data-loaded', () => { CACHE = null; });
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
      kind: 'Dienstleistungen',
      href: links.service(s.serviceId),
      extra: [domainLabel(s.domain), s.short, (s['voraussetzungen'] || []).join(' ')].join(' '),
      // Popularity still separates services from one another, on top of the type.
      boost: TYPE_BOOST.service + (s.popular ? Math.max(0, 20 - s.popular * 2) : 0),
    });
  }
  for (const a of core.applications()) {
    rows.push({
      title: a.name, desc: a.group, resultType: 'Anwendung', kind: 'Anwendungen',
      href: links.application(a.appId),
      extra: [a.group, a.area, a.description, a.appId.replace(/-/g, ' ')].join(' '),
      boost: TYPE_BOOST.application,
    });
  }
  for (const d of core.datasets()) {
    rows.push({
      title: core.t(d.title), desc: core.t(d.meta && d.meta['thema']), resultType: 'Datensatz',
      kind: 'Datensätze',
      href: links.dataset(d.id),
      extra: [core.t(d.description), (d.tags || []).join(' ')].join(' '),
      boost: TYPE_BOOST.dataset,
    });
  }
  for (const k of knowledgeIndex()) {
    rows.push({
      title: k.title, desc: k.area, resultType: 'Unterlage', kind: 'Wissen und Hilfsmittel',
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
const MAX_PER_GROUP = 4;
const MAX_GROUPED = 10;
const MAX_GROUPS = 4;

/**
 * Mark the matched part of a title.
 *
 * Deliberately on the RAW text and WITHOUT folding: the engine folds umlauts to
 * two-letter spellings (js/search/search-engine.js), which shifts character
 * positions, so mapping a
 * match back onto the original title could only guess. Better no highlight than
 * one in the wrong place — a mark two characters off reads as a rendering fault
 * and undermines the list it is meant to help.
 */
function highlight(title, terms, escapeHtml) {
  const raw = String(title || '');
  if (!terms.length) return escapeHtml(raw);
  const haystack = raw.toLowerCase();
  const spans = [];
  for (const term of terms) {
    if (term.length < 2) continue;
    const needle = term.toLowerCase();
    for (let from = 0; ;) {
      const at = haystack.indexOf(needle, from);
      if (at < 0) break;
      spans.push([at, at + needle.length]);
      from = at + needle.length;
    }
  }
  if (!spans.length) return escapeHtml(raw);
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([...span]);
  }
  let out = '';
  let cursor = 0;
  for (const [start, end] of merged) {
    out += `${escapeHtml(raw.slice(cursor, start))}<mark>${escapeHtml(raw.slice(start, end))}</mark>`;
    cursor = end;
  }
  return out + escapeHtml(raw.slice(cursor));
}

/** Query terms for the highlight, without folding — see above. */
const queryTerms = (query) => String(query || '').toLowerCase()
  .split(/[^a-zäöüßà-ÿ0-9]+/i).filter((word) => word.length > 1);

/**
 * Group results by kind, in the order of js/search/search-kinds.js.
 *
 * The per-group cap exists so one prolific kind cannot crowd the others out —
 * knowledge alone supplies half of all hits. But a FIXED cap threw away rows
 * that nothing else wanted: measured, «vorlage» matches only documents, so the
 * list showed four suggestions where seven would have fitted. The cap is
 * therefore a starting budget, not a ceiling: every group gets up to
 * MAX_PER_GROUP first, then the remaining slots are handed out round by round to
 * whichever groups still have rows. Diversity when there is competition, a full
 * list when there is not.
 */
function groupByKind(rows) {
  const buckets = new Map();
  for (const row of rows) {
    if (!buckets.has(row.kind)) buckets.set(row.kind, []);
    buckets.get(row.kind).push(row);
  }
  const groups = [...buckets.entries()]
    .sort((a, b) => byKind(a[0], b[0]))
    .slice(0, MAX_GROUPS)
    .map(([kind, matches]) => ({ kind, matches, total: matches.length }));

  const quota = groups.map((group) => Math.min(group.matches.length, MAX_PER_GROUP));
  let used = quota.reduce((sum, value) => sum + value, 0);
  for (let spare = true; spare && used < MAX_GROUPED;) {
    spare = false;
    for (let i = 0; i < groups.length && used < MAX_GROUPED; i++) {
      if (quota[i] < groups[i].matches.length) { quota[i]++; used++; spare = true; }
    }
  }
  return groups.map((group, i) => ({
    kind: group.kind, rows: group.matches.slice(0, quota[i]), total: group.total,
  }));
}

export function attachSuggest(input, form, core, C) {
  const listId = input.id + '-suggest';
  // A <div> rather than a <ul>: ARIA allows role="group" between listbox and
  // option, but as <li><ul> it needs role="none" patchwork to stay valid markup.
  const list = document.createElement('div');
  list.className = 'listbox listbox--suggest';
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Suchvorschläge');

  // The action row lives outside the listbox, so the popup needs a shell that
  // carries the border and shadow — otherwise the row would stand alone as a
  // bare strip whenever the list is empty.
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'suggest__action';
  action.hidden = true;
  const shell = document.createElement('div');
  shell.className = 'suggest__shell';
  shell.hidden = true;
  shell.append(list, action);

  // The field sits in a flex container; the list belongs below the FIELD, not
  // below the row containing the button.
  const anchor = input.parentElement;
  anchor.classList.add('listbox-anchor');
  anchor.appendChild(shell);

  /**
   * The empty field offers EXAMPLES. This is where somebody learns that whole
   * questions are allowed — not from a hint text, but because four of them are
   * standing there. Without it the trigger is invisible: the portal answers a
   * question differently from a keyword, and nobody who only ever types keywords
   * finds that out.
   *
   * It needs NO index: the four are static, so focusing the field does not pull
   * the deferred catalogues that the first keystroke pays for.
   */
  function showExamples() {
    items = EXAMPLE_QUESTIONS.map((question) => ({ query: question }));
    list.innerHTML = `<div class="suggest__group" role="group" aria-label="Beispiele">
        <div class="suggest__grouptitle" aria-hidden="true">Beispiele</div>${
        EXAMPLE_QUESTIONS.map((question, i) => `<div class="listbox__option" role="option"
            id="${listId}-${i}" aria-selected="false">
            <span class="listbox__title">${C.escape(question)}</span>
            <span class="listbox__meta">Beispiel · als Frage stellen</span>
          </div>`).join('')}</div>`;
    action.hidden = true;
    shell.hidden = false;
    controller.setItems(items);
  }

  let items = [];
  const controller = createListboxController({
    input,
    list,
    onChoose: (item) => {
      // An example is not a target but a query: it goes into the field and is
      // searched, so the person sees where it leads and can edit it afterwards.
      if (item.query) {
        input.value = item.query;
        location.hash = `#/search?q=${encodeURIComponent(item.query)}`;
        return;
      }
      const href = safeLinkUrl(item.href);
      const kind = classifyUrl(href);
      if (item.external && kind === 'external') window.open(href, '_blank', 'noopener,noreferrer');
      else if (!item.external && kind === 'route') location.hash = href;
    },
  });
  // The controller owns the list; the shell around it has to follow, or an
  // empty popup would keep its border and the action row would float on.
  const close = (options) => {
    controller.close(options);
    shell.hidden = true;
    action.hidden = true;
    action.onclick = null;
  };

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
    // The source selection applies here too: a kind somebody switched off must
    // not reappear in the suggestions. Filtered BEFORE the cut to ten, or a
    // switched-off kind holding the top rows would leave an empty list instead
    // of the next best results.
    const terms = queryTerms(q);
    const hits = runSearch(filterRows(index), q);
    const groups = groupByKind(hits);
    items = [];
    let html = '';
    for (const group of groups) {
      if (items.length >= MAX_GROUPED) break;
      let options = '';
      for (const row of group.rows) {
        if (items.length >= MAX_GROUPED) break;
        options += `<div class="listbox__option" role="option" id="${listId}-${items.length}" aria-selected="false">
            <span class="listbox__title">${highlight(row.title, terms, C.escape)}</span>
            <span class="listbox__meta">${C.escape(row.resultType)}${row.desc ? ' · ' + C.escape(row.desc) : ''}</span>
          </div>`;
        items.push(row);
      }
      // aria-hidden on the visible heading: its text is already the group's
      // accessible name, and announcing both would read the kind twice.
      html += `<div class="suggest__group" role="group" aria-label="${C.escape(group.kind)}">
          <div class="suggest__grouptitle" aria-hidden="true">${C.escape(group.kind)}<span
            class="suggest__groupcount">${group.total}</span></div>${options}</div>`;
    }
    list.innerHTML = html;

    // The action row appears when the input looks like a question OR the keyword
    // search found nothing. The second case is today's dead end.
    const asksSomething = isQuestion(q) || !items.length;
    action.hidden = !asksSomething;
    if (asksSomething) {
      action.innerHTML = `${C.icon('SpeechBubble', 'icon--md')}<span>«<strong>${
        C.escape(q)}</strong>» als Frage stellen</span>`;
      action.onclick = () => {
        close();
        input.value = q;
        location.hash = `#/search?q=${encodeURIComponent(q)}`;
      };
    }

    if (!items.length && !asksSomething) return close();
    shell.hidden = false;
    if (!items.length) {
      // Nothing to step through, but the way out is visible: keep the popup open
      // and tell the combobox there is no active option.
      input.setAttribute('aria-expanded', 'true');
      return;
    }
    controller.setItems(items);
  };

  const onInput = () => {
    const q = input.value.trim();
    // Deleting back below two characters must also invalidate an in-flight
    // query, or its result would reopen the list the user just emptied. An
    // EMPTY field falls back to the examples; one character still shows nothing,
    // because a single letter matches too much to be worth a list.
    if (q.length < 2) { version++; close(); if (!q) showExamples(); return; }
    void open(q);
  };
  const onFocus = () => { if (!input.value.trim()) showExamples(); };

  const onSubmit = () => close();
  // The action row sits outside the list, so the controller's blur handling does
  // not cover it: without this the delayed close would take the click away.
  const onActionDown = (event) => event.preventDefault();

  input.addEventListener('input', onInput);
  input.addEventListener('focus', onFocus);
  form.addEventListener('submit', onSubmit);
  action.addEventListener('mousedown', onActionDown);

  return () => {
    detached = true;
    input.removeEventListener('input', onInput);
    input.removeEventListener('focus', onFocus);
    form.removeEventListener('submit', onSubmit);
    action.removeEventListener('mousedown', onActionDown);
    controller.destroy();
    shell.remove();
  };
}
