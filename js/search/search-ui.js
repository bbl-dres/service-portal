// The two search surfaces that the home page and the results page share: the
// source selection beside the field, and the answer block above the results.
//
// They live here rather than in either page because BOTH pages need the first
// one and it has to look and behave identically in the two places. The version
// that lived next to one field grew the layout rhythm of that field's
// surroundings and read as a different control on the other page.
//
// TEXT BY DEFAULT. Everything interpolated here is either escaped through
// `C.escape` or an href built by js/links.js and re-checked with `safeLinkUrl`,
// following the same contract as the rest of the template helpers
// (scripts/test-html-contracts.mjs).

import { escape as escapeHtml, icon } from '../components.js';
import { safeLinkUrl } from '../security/urls.js';
import { KINDS } from './search-kinds.js';
import * as sources from './search-sources.js';

/** Example questions offered where somebody has not asked one yet. REAL ones:
 *  each is answered by the portal's own records, and an example that leads
 *  nowhere would be worse than none. */
export const EXAMPLE_QUESTIONS = [
  'Wie melde ich eine defekte Heizung?',
  'Kann ich einen Sitzungsraum reservieren?',
  'Was brauche ich für eine IKT-Beschaffung?',
  'Wo finde ich die Pläne eines Gebäudes?',
];

const searchHref = (query) => `#/search?q=${encodeURIComponent(query)}`;

/* ============================================================== SOURCES == */

// The panel keeps its open state across a redraw and returns focus to the same
// checkbox — otherwise the selection would close on every tick and have to be
// reopened for each kind. The page re-renders on every change, so this cannot
// live in the DOM.
let panelOpen = false;
let restoreFocusId = '';

const MAX_NAMED = 3;
const nameList = (list) => (list.length <= MAX_NAMED
  ? escapeHtml(list.join(', '))
  : `${escapeHtml(list.slice(0, MAX_NAMED).join(', '))} und ${list.length - MAX_NAMED} weitere`);

/**
 * The line under the field. It CHANGES DIRECTION, and that is the point.
 * Measured with a single kind selected it named the ten that were off rather
 * than the one that was on — German UI: «1 von 11 Inhaltsarten · ohne
 * Anwendungen, Wissen und Hilfsmittel, Datensätze, …». Ten names to describe one
 * choice. Below half selected somebody means «only these», not «without those».
 *
 * The empty state matters most: «nothing selected» MUST say that everything is
 * still searched, or the intermediate step of changing the selection reads as a
 * fault.
 */
function sourcesTrigger() {
  const off = sources.offKinds();
  const on = sources.onKinds();
  const withoutAnswers = !sources.answersAllowed();
  let text;
  if (sources.noneSelected()) text = 'Keine Inhaltsart gewählt — es wird alles durchsucht.';
  else if (!off.length) text = 'Durchsucht alle Inhaltsarten.';
  else if (on.length <= off.length) text = `<strong>Nur ${nameList(on)}.</strong>`;
  else text = `<strong>${on.length} von ${KINDS.length} Inhaltsarten</strong> · ohne ${nameList(off)}.`;
  return `<p class="search-sources__line">
    <button type="button" class="search-sources__toggle" id="search-sources-toggle"
      aria-expanded="${panelOpen}" aria-controls="search-sources-panel">
      <span class="search-sources__text">${text}${withoutAnswers ? ' Ohne KI-Antworten.' : ''}</span>
      ${/* Action and chevron in ONE element: as siblings the arrow wrapped to
            the next line on its own as soon as the sentence ran over. */''}
      <span class="search-sources__action">${off.length || withoutAnswers ? 'Ändern' : 'Auswählen'}${
        icon('ChevronDown', 'search-sources__chev')}</span>
    </button></p>`;
}

function sourcesPanel() {
  const boxes = KINDS.map((kind, index) => `<label class="filter-check">
      <input type="checkbox" id="search-source-${index}" data-search-source="${escapeHtml(kind)}"${
        sources.isOn(kind) ? ' checked' : ''}><span>${escapeHtml(kind)}</span></label>`).join('');
  // BOTH jumps, side by side, each disabled when it would do nothing. One
  // switching button would have to guess which end a partial selection meant.
  // The clearing jump is the short path to ONE kind: clear, tick, done — instead
  // of clicking ten away one at a time. German UI: «Alle abwählen».
  const actions = `<div class="search-sources__actions">
      <button type="button" class="btn btn--link btn--sm" data-search-sources-none${
        sources.noneSelected() ? ' disabled' : ''}><span class="btn__text">Alle abwählen</span></button>
      <button type="button" class="btn btn--link btn--sm" data-search-sources-all${
        sources.allSelected() ? ' disabled' : ''}><span class="btn__text">Alle einschalten</span></button>
    </div>`;
  // A SECOND GROUP, not an afterthought. The answer does not belong in the list
  // above, because «unticked» means something else there: for content kinds it
  // means «everything is searched», here it means simply «no answer». The same
  // gesture with two meanings in one list is no longer a list — and the two
  // buttons above would either have to take it along (silently switching answers
  // off for somebody who only wanted to isolate a kind) or visibly skip it (and
  // look like a bug).
  const answers = `<fieldset class="filter-group search-sources__extra">
      <legend class="filter-group__legend">Zusätzlich</legend>
      <label class="filter-check"><input type="checkbox" id="search-source-answers"
        data-search-source="${escapeHtml(sources.ANSWERS)}"${sources.answersAllowed() ? ' checked' : ''
        }><span>KI-Antworten anzeigen</span></label>
    </fieldset>`;
  return `<div class="search-sources__panel" id="search-sources-panel"${panelOpen ? '' : ' hidden'}>
    <fieldset class="filter-group search-sources__group">
      <legend class="filter-group__legend">Welche Inhaltsarten durchsucht werden</legend>
      ${boxes}
    </fieldset>
    ${actions}${answers}
  </div>`;
}

/** Trigger and panel as ONE element. As siblings each picked up the surrounding
 *  column gap, so the line sat one gap under the field and the panel another
 *  under the line — on the home page 2rem each, on the results page none. */
export const sourcesControl = () =>
  `<div class="search-sources">${sourcesTrigger()}${sourcesPanel()}</div>`;

/**
 * Wire the control. `onChange` is the caller's redraw: a changed selection
 * changes what the page finds, so the page has to render again.
 */
export function wireSources(root, onChange) {
  const toggle = root.querySelector('#search-sources-toggle');
  const panel = root.querySelector('#search-sources-panel');
  if (!toggle || !panel) return;
  toggle.addEventListener('click', () => {
    panelOpen = panel.hidden;
    panel.hidden = !panelOpen;
    toggle.setAttribute('aria-expanded', String(panelOpen));
  });
  panel.addEventListener('change', (event) => {
    const box = event.target.closest('input[data-search-source]');
    if (!box) return;
    restoreFocusId = box.id;
    sources.toggle(box.dataset.searchSource);
    onChange();
  });
  // The restoring jump also appears in the no-results notice, where it is needed
  // most; both are wired from the whole root rather than the panel alone.
  // German UI: «Alle einschalten».
  root.querySelectorAll('[data-search-sources-all]').forEach((button) =>
    button.addEventListener('click', () => {
      restoreFocusId = 'search-sources-toggle';
      sources.selectAllKinds();
      onChange();
    }));
  // After clearing, focus goes into the panel rather than back to the line: the
  // next step is almost always ticking a single kind.
  root.querySelectorAll('[data-search-sources-none]').forEach((button) =>
    button.addEventListener('click', () => {
      restoreFocusId = 'search-source-0';
      sources.clearAllKinds();
      onChange();
    }));
}

/** Put focus back where it was after the caller re-rendered (WCAG 2.4.3). */
export function restoreSourcesFocus(root) {
  if (!restoreFocusId) return;
  const target = root.querySelector(`#${restoreFocusId}`);
  restoreFocusId = '';
  if (target && !target.disabled) target.focus({ preventScroll: true });
  else root.querySelector('#search-sources-toggle')?.focus({ preventScroll: true });
}

/* =============================================================== ANSWER == */

// The badge sits on the head and applies to EVERY state of the block, including
// the idle one where nothing has been written yet. Whoever sees the block knows
// what they are looking at before the first sentence appears.
const answerHead = (title) => `<p class="answer__head">
    <span class="answer__title">${escapeHtml(title)}</span>
    <span class="badge badge--blue">Simuliert</span></p>`;

const answerFoot = `<div class="answer__foot">
    <span class="legend">Automatisch erstellt und kann Fehler enthalten.
      Massgebend sind die verlinkten Quellen.</span>
    <button class="answer__off" type="button" data-answers-off>KI-Antworten ausblenden</button>
  </div>`;

/**
 * IDLE STATE. The block also stands where there is nothing to answer — on a
 * keyword search. Two reasons, and the second matters more:
 *
 *   1. It holds the place. If the block appeared only for questions, the result
 *      list would jump by its height depending on the input.
 *   2. It shows WHEN it contributes. The trigger condition (a whole question,
 *      not a keyword) is otherwise invisible: somebody who never types a
 *      question never learns they could — and that is exactly the gap this
 *      addresses.
 *
 * So it offers a way rather than an advertisement: the examples are links to
 * questions the portal really answers.
 */
function answerIdle() {
  return `<div class="notification notification--hint answer-slot answer-slot--idle">${
    icon('SpeechBubble', 'notification__icon')}
    <div class="notification__content">
      ${answerHead('KI-Antwort')}
      <p class="muted">Stellen Sie eine ganze Frage, und hier steht eine Antwort —
        jeder Satz mit Beleg aus den Treffern.</p>
      ${/* The quotation marks sit INSIDE the link: four underlined questions in
            a row read as one long stroke, and where one ended and the next began
            was not visible. */''}
      <p class="answer__examples">${EXAMPLE_QUESTIONS.map((question) =>
        `<a href="${escapeHtml(safeLinkUrl(searchHref(question)))}">«${escapeHtml(question)}»</a>`).join('')}</p>
      ${answerFoot}
    </div></div>`;
}

/**
 * Render the answer block. `result` is what js/search/answer.js returned, or
 * null for a query that is not a question.
 */
export function answerBlock(result, resultCount) {
  if (!result) return answerIdle();

  if (result.state === 'none') {
    // «No answer» is a SUCCESS state, not a failure — and the text must not
    // point at results that do not exist.
    const line = resultCount > 0
      ? 'Die Treffer unten stammen aus der Stichwortsuche.'
      : 'Auch die Stichwortsuche findet dazu nichts im Portal.';
    return `<div class="notification notification--hint answer-slot">${icon('SpeechBubble', 'notification__icon')}
      <div class="notification__content">
        ${answerHead('Keine KI-Antwort')}
        <p>Zu dieser Frage wurde im Portal nichts Passendes gefunden. ${line}</p>
        ${answerFoot}
      </div></div>`;
  }

  // A part WITHOUT a citation is not rendered. The renderer enforces it — not
  // the code that produced the part. This is the second of two independent
  // guards on the one property the component exists to demonstrate.
  const parts = result.parts.filter((part) =>
    Number.isInteger(part.cite) && part.cite > 0 && result.sources[part.cite - 1]);
  if (!parts.length) return answerBlock({ ...result, state: 'none' }, resultCount);

  const sentences = parts.map((part) => `<p>${escapeHtml(part.text)}<a class="cite"
      href="${escapeHtml(safeLinkUrl(result.sources[part.cite - 1].href))}"
      aria-label="Beleg ${part.cite}">${part.cite}</a></p>`).join('');

  const sourceList = `<div class="answer__sources">
      <p class="answer__sources-label">Quellen</p>
      ${result.sources.map((source) => `<span class="source">
          <span class="source__n">${source.n}</span>
          <span><span class="meta-info"><span class="meta-info__item">${escapeHtml(source.type)}</span>${
            source.meta ? `<span class="meta-info__item">${escapeHtml(source.meta)}</span>` : ''
          }</span><br><a href="${escapeHtml(safeLinkUrl(source.href))}">${escapeHtml(source.title)}</a></span>
        </span>`).join('')}
    </div>`;

  return `<div class="notification notification--hint answer-slot">${icon('SpeechBubble', 'notification__icon')}
    <div class="notification__content">
      ${answerHead('KI-Antwort')}
      ${sentences}
      ${sourceList}
      ${answerFoot}
    </div></div>`;
}
