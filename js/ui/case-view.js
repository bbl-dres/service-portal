// The case view — ONE anatomy for every process.
//
// A Vorgang is process-dependent in its CONTENT and process-independent in its
// LAYOUT. Before this module the two were the same thing: a typed process got
// hand-written sections, an untyped one got a single «Angaben» list, and every
// new process arrived either with a new layout or in the thin generic case.
//
// So the overview is a DESCRIPTOR plus a renderer. A process contributes
//
//     [{ title, rows: [{ label, value }], wide? }]
//
// and nothing else; `caseOverview` decides how that lands on the page. Adding a
// process is adding data. See docs/case-view-alignment.md § 2.
//
// The frame is `.detail-layout` — the portal's established detail anatomy
// (utilities.css; the property view at #/app/portfolio is the reference): a
// reading column of titled sections on the left, a 22rem rail of cards on the
// right. Measured at 1440px that is 929 / 48 / 352.
//
// THE SPLIT RULE: the main column is what you READ, the aside is what you ACT ON
// or CONTACT. That is why «Antragsteller» is a card and «Vorgangsdaten» is the
// first section — one is a person you would write to, the other is the record's
// identity.
//
// Sections STACK in one column. A two-across grid was tried while there was no
// aside (it fixed a 1344px panel whose values ended at ~35%); with the rail
// taking the right third that emptiness is gone, and pairing inside a 929px
// column would put a third visual column on the page.
import { escape, icon } from './components/primitives.js';

/** One `<dt>/<dd>` pair, or nothing when the value is empty. */
export function caseRow(label, value, { html = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  return { label: String(label), value: html ? String(value) : escape(String(value)) };
}

/**
 * A titled block of key/value rows.
 * `rows` accepts the output of caseRow (falsy entries are dropped), so a caller
 * can list every possible row and let the empty ones disappear. `body` is ready
 * HTML for a section that is not a key/value list (an Auflagen checklist).
 */
export function caseSection(title, rows, { body = '', iconName = '' } = {}) {
  const kept = (rows || []).filter(Boolean);
  if (!kept.length && !body) return null;
  return { title, rows: kept, body, iconName };
}

/**
 * Folds sections that carry the same title into one, in first-seen order.
 *
 * A Vorgang describes its location twice: once through the building it is
 * linked to (Objekt, Adresse, WE, EGID) and once through the fields the form
 * submitted (Gebäude, Raum, Geschoss). Rendered as «Standort» and «Ort» those
 * were two headings over the same subject, with the building name printed
 * under both.
 *
 * A row is dropped when its LABEL is already present or when its VALUE is —
 * «Objekt: Verwaltungsgebäude Liebefeld» and «Gebäude: Verwaltungsgebäude
 * Liebefeld» are the same statement under two names, and only the first
 * survives.
 */
export function mergeSections(sections) {
  const out = [];
  const byTitle = new Map();
  for (const section of (sections || []).filter(Boolean)) {
    const seen = byTitle.get(section.title);
    if (!seen) {
      const copy = { ...section, rows: [...section.rows] };
      byTitle.set(section.title, copy);
      out.push(copy);
      continue;
    }
    for (const row of section.rows) {
      if (seen.rows.some((r) => r.label === row.label || r.value === row.value)) continue;
      seen.rows.push(row);
    }
    if (section.body) seen.body = (seen.body || '') + section.body;
    if (!seen.iconName && section.iconName) seen.iconName = section.iconName;
  }
  return out;
}

/**
 * The Übersicht panel: sections left, `aside` (ready HTML) right.
 *
 * ONLY this tab is two-column. The other three carry one full-width surface
 * each — a table, a timeline, a comment list — and a 352px rail beside a table
 * would take the width the table needs. The rail is also why the actions sit
 * here at all: Übersicht is the default tab, so it is what a reader lands on.
 */
export function caseOverview(sections, aside = '') {
  const kept = (sections || []).filter(Boolean);
  if (!kept.length && !aside) return '';
  const block = (s) => `
    <section class="case-section">
      <h3 class="case-section__title">${s.iconName ? icon(s.iconName, 'icon--base case-section__icon') : ''}${escape(s.title)}</h3>
      ${s.rows.length ? `<dl class="kv case-section__list">${s.rows.map(
    (r) => `<dt>${escape(r.label)}</dt><dd>${r.value}</dd>`).join('')}</dl>` : ''}
      ${s.body || ''}
    </section>`;
  return `<div class="case-overview detail-layout"><div class="case-overview__main">${
    kept.map(block).join('')}</div>${aside}</div>`;
}

/**
 * The right rail. `cards` is ready HTML (C.actionCard / C.contactCard), so this
 * only owns the landmark and the sticky wrapper.
 *
 * The inner wrapper is what makes `position: sticky` work: a grid item aligned
 * to `start` is only as tall as its own content and therefore its own sticky
 * containing block, leaving zero travel. The item stretches to the row height
 * and the sticky sits inside it.
 */
export function caseAside(cards, { label = 'Aktionen und Beteiligte' } = {}) {
  const body = (cards || []).filter(Boolean).join('');
  if (!body) return '';
  return `<aside class="detail-layout__aside" aria-label="${escape(label)}">
    <div class="detail-layout__aside-inner">${body}</div>
  </aside>`;
}

/**
 * Sections derived from a flat `data` map — the fallback for every process that
 * submits fields rather than a typed record. `labels` maps a raw key to a
 * German label; an unknown key keeps its own name rather than disappearing.
 *
 * `groups` optionally splits the map into named sections:
 *   [{ title: 'Standort', keys: ['strasse', 'plz'] }]
 * Whatever no group claims lands in one final section under `restTitle`, so a
 * process that gains a field still shows it without touching this file.
 */
export function sectionsFromData(data, labels = {}, { groups = [], restTitle = 'Angaben' } = {}) {
  const entries = Object.entries(data || {}).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!entries.length) return [];
  const claimed = new Set();
  const rowsFor = (keys) => keys.map((k) => {
    const hit = entries.find(([key]) => key === k);
    if (!hit) return null;
    claimed.add(k);
    return caseRow(labels[k] || k, hit[1]);
  }).filter(Boolean);

  const out = groups.map((g) => caseSection(g.title, rowsFor(g.keys))).filter(Boolean);
  const rest = entries.filter(([k]) => !claimed.has(k)).map(([k, v]) => caseRow(labels[k] || k, v));
  const restSection = caseSection(restTitle, rest);
  // The unclaimed rows lead when no group matched anything; otherwise they
  // follow the named sections, because a named section is the more specific
  // statement about the record.
  return out.length ? [...out, restSection] : [restSection];
}

// --- Aktionen ----------------------------------------------------------------
// What a reader can DO with this Vorgang, derived from status × capability
// rather than from a switch on the process. A new process therefore inherits
// the whole card; only a process that gains a genuinely new capability adds a
// row here (docs/case-view-alignment.md).
//
// HONESTY RULE: a row either works or says that it does not. `type: 'disabled'`
// renders with a lock and its own explanation, which is a truthful statement
// about a prototype; a row that looked live and did nothing would not be.
const CLOSED = new Set(['abgeschlossen', 'erledigt', 'geliefert', 'closed', 'rejected', 'abgelehnt']);

export function caseActions(instance = {}, { canAdvance = false, serviceHref = '' } = {}) {
  const closed = CLOSED.has(instance.status);
  const items = [];
  // The action that is the reason the page was opened, where it applies. It
  // leads, and it is the only row that changes with the case's state.
  if (instance.status === 'rueckfrage' && serviceHref) {
    items.push({ type: 'link', href: serviceHref,
      label: 'Auflagen erfüllen — erneut einreichen',
      description: 'Öffnet das Formular dieser Dienstleistung.' });
  }
  if (canAdvance) {
    items.push({ type: 'button', id: 'case-advance',
      label: 'Nächster Schritt (Demo)',
      description: 'Setzt den Vorgang einen Schritt weiter.' });
  }
  items.push({ type: 'button', id: 'case-comment',
    label: 'Kommentar hinzufügen',
    description: 'Öffnet den Reiter «Kommentare».' });
  if (!closed) {
    items.push({ type: 'disabled', label: 'Weiterleiten …',
      description: 'Im Prototyp nicht verfügbar.' });
    items.push({ type: 'disabled', label: 'Vorgang zurückziehen',
      description: 'Im Prototyp nicht verfügbar.' });
  }
  items.push({ type: 'button', id: 'case-print',
    label: 'Vorgang drucken' });
  return items;
}

// --- Kommentar erfassen ------------------------------------------------------
// The compose box that makes «Kommentar hinzufügen» a real action rather than a
// link to a read-only list. It writes into the case in memory, like every other
// demo mutation in these prototypes.
export function caseCommentForm({ id = 'case-comment-form' } = {}) {
  return `<form class="case-comment-form" id="${escape(id)}" novalidate>
    <label class="form__label" for="${escape(id)}-text">Kommentar hinzufügen</label>
    <textarea id="${escape(id)}-text" class="input--outline input--base" rows="3"
      placeholder="Ihre Anmerkung zu diesem Vorgang …"></textarea>
    <p class="case-comment-form__actions">
      <button type="submit" class="btn btn--filled btn--icon-left">${icon('PaperPlane', 'btn__icon')}<span class="btn__text">Kommentar speichern</span></button>
    </p>
  </form>`;
}

// --- Verlauf -----------------------------------------------------------------
// An ordered list of what happened, newest last. The dot carries the kind of
// event as well as its position, so scanning the column tells apart «approved»
// from «returned with conditions» without reading every line.
const DOT_TONE = (kind) => {
  if (!kind) return '';
  if (/Added|Submitted|Eingereicht|Erstellt|Bestellt/i.test(kind)) return ' history-timeline__dot--info';
  if (/Approved|Closed|Genehmigt|Abgeschlossen|Erledigt|Geliefert/i.test(kind)) return ' history-timeline__dot--success';
  if (/Rejected|Clarification|Rückfrage|Abgelehnt/i.test(kind)) return ' history-timeline__dot--warning';
  if (/Handover|Project|System|Prüfung|Arbeit/i.test(kind)) return ' history-timeline__dot--neutral';
  return '';
};

/** `events`: [{ when, actor?, action, note? }] — already display-formatted. */
export function historyTimeline(events, { label = 'Verlauf', empty = 'Noch keine Ereignisse zu diesem Vorgang.' } = {}) {
  if (!events || !events.length) return caseEmpty(empty);
  return `<ol class="history-timeline" aria-label="${escape(label)}">${events.map((e) => `
    <li class="history-timeline__item">
      <span class="history-timeline__dot${DOT_TONE(e.tone || e.action)}" aria-hidden="true"></span>
      <div class="history-timeline__body">
        <span class="history-timeline__time">${escape(e.when)}</span>
        <p class="history-timeline__action">${e.actor ? `<strong>${escape(e.actor)}</strong> · ` : ''}${escape(e.action)}</p>
        ${e.note ? `<p class="history-timeline__note">${escape(e.note)}</p>` : ''}
      </div>
    </li>`).join('')}</ol>`;
}

// --- Kommentare --------------------------------------------------------------
/** `comments`: [{ author, when, text }]. */
export function commentsList(comments, { label = 'Kommentare', empty = 'Noch keine Kommentare zu diesem Vorgang.' } = {}) {
  if (!comments || !comments.length) return caseEmpty(empty);
  return `<ul class="case-comments" aria-label="${escape(label)}">${comments.map((c) => `
    <li class="case-comment">
      <p class="case-comment__meta"><strong>${escape(c.author)}</strong><span>${escape(c.when)}</span></p>
      <p class="case-comment__text">${escape(c.text)}</p>
    </li>`).join('')}</ul>`;
}

/** The shared empty paragraph for a tab that has nothing to show. */
export function caseEmpty(text) {
  return `<p class="case-empty muted">${escape(text)}</p>`;
}

// --- Kopfbereich -------------------------------------------------------------
// CD's Hero anatomy (Hero.vue:9-27): the meta strip sits ABOVE the h1, not
// below it as a lead and not beside it as an uppercase kicker. `.meta-info`
// (meta-info.postcss) supplies the size, the colour and the `|` separator, so
// the process, the reference, the object and the submission date read as one
// line of provenance rather than three competing subtitles.
//
// `metaItems` are plain strings; `actions` is ready HTML (status badge, buttons).
export function caseHeader({ metaItems = [], title, actions = '' }) {
  const meta = metaItems.filter(Boolean)
    .map((m) => `<span class="meta-info__item">${escape(m)}</span>`).join('');
  return `<header class="case-header">
    <div class="case-header__main">
      ${meta ? `<p class="meta-info case-header__meta">${meta}</p>` : ''}
      <h1 class="case-header__title" tabindex="-1">${escape(title)}</h1>
    </div>
    ${actions ? `<div class="case-header__actions">${actions}</div>` : ''}
  </header>`;
}

// --- Anhänge -----------------------------------------------------------------
// The attachment tab is a TABLE, and it stays a table when it is empty: bar,
// column headers and footer included, with the reason inside the table body.
// Every other list in both portals already works this way; this tab was the one
// that replaced itself with a sentence, so «Anhänge (0)» led to a page with no
// visible columns and nothing to say what had been there.
// See docs/case-view-alignment.md § 3.
const FILE_ICONS = { PDF: 'FilePDF', DWG: 'FileCode', XLSX: 'FileExcel', XLS: 'FileExcel', DOCX: 'FileWord', DOC: 'FileWord', ZIP: 'FileZip', JPG: 'FileImage', PNG: 'FileImage' };
export const attachmentIcon = (type) => FILE_ICONS[String(type || '').toUpperCase()] || 'File';

/** Column set for C.mountDataTable / mountDataTable. `render` returns HTML. */
export function attachmentColumns({ withStatus = false } = {}) {
  const columns = [
    { key: 'name', label: 'Dokument', render: (a) => `${icon(attachmentIcon(a.type), 'table__icon')}<span class="attachment__name">${escape(a.name)}</span>` },
    { key: 'type', label: 'Typ', render: (a) => escape(a.type || '—') },
    { key: 'size', label: 'Grösse', align: 'right', render: (a) => escape(a.size || '—') },
  ];
  if (withStatus) columns.push({ key: 'status', label: 'Status', render: (a) => a.statusHtml || escape(a.status || '—') });
  return columns;
}
