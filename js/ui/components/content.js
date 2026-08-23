import { badge, breakable, domToken, escape, icon, photo, safeClassList, safeHeadingTag } from './primitives.js';
import { backLink } from './navigation.js';
import { shareBar } from './overlays.js';
import { classifyUrl, newWindowAttrs, safeLinkUrl, safeMailto, safeResourceUrl } from '../../security/urls.js';

const ALIGNMENTS = new Set(['left', 'center', 'right']);
const CARD_VARIANTS = new Set([
  'default', 'disabled', 'edit', 'empty', 'error', 'flat', 'highlight', 'list', 'loading', 'universal',
]);
const COLUMN_WIDTH = /^(?:0|[0-9]+(?:\.[0-9]+)?(?:px|rem|em|ch|%))$/;

const columnWidth = (value) => COLUMN_WIDTH.test(String(value || '')) ? String(value) : '';

// Page section in CD anatomy (section.postcss): <section> is the OUTER element,
// with .container inside. Only this allows a background to run edge to edge;
// `bg--*` belongs on the section, never on the container.
//
// 40 of 42 pages render `<div class="container section">`, merging both roles in
// one element. The consequence is structural, not cosmetic: none can support
// alternating bands, a tinted introduction, or a full-width callout. Each is a
// single white field from breadcrumb to footer. The home page constructs it
// correctly and therefore reads as a composed page.
//
// `alt` tints the band (secondary-50). Callers alternate it by position so bands
// switch cleanly. No new CSS: .section, .section--default, .section__title,
// .section__action, and .bg--secondary-50 already exist.
export function pageSection({ title = '', body = '', more = null, alt = false, titleTag = 'h2' }) {
  const moreHref = more && safeLinkUrl(more.href);
  const titleElement = safeHeadingTag(titleTag, 'h2');
  return `<section class="section section--default${alt ? ' bg--secondary-50' : ''}">
      <div class="container">
        ${title ? `<${titleElement} class="section__title">${escape(title)}</${titleElement}>` : ''}
        ${body}
        ${moreHref ? `<div class="section__action">
          <a class="btn btn--bare btn--icon-right" href="${escape(moreHref)}">${icon('ArrowRight', 'btn__icon')}<span class="btn__text">${escape(more.label)}</span></a>
        </div>` : ''}
      </div>
    </section>`;
}

// `lead` is escaped (the normal case). `leadHtml` is the deliberate exception
// for leads with markup, such as a link to a neighbouring system. It is ONLY
// for author-owned markup, never data from core or external services; those keep
// `lead`, and therefore escaping, mandatory.
export function pageHeader({ title, lead, leadHtml }) {
  const body = leadHtml || (lead ? escape(lead) : '');
  return `<div class="page-header"><h1 tabindex="-1">${escape(title)}</h1>${body ? `<p class="lead">${body}</p>` : ''}</div>`;
}


// --- Cards (card.postcss) ----------------------------------------------------
export function card(o) {
  const href = safeLinkUrl(o.href);
  const extraClasses = safeClassList(o.cls);
  // `chips`: short attributes OVERLAID on the image rather than a pill row in the
  // card body, matching the property inventory gallery (`.card__chips`). Useful
  // for details read while scanning the grid (country, status) that would only
  // consume space before title and description in the text. `.card__image` is
  // already `position:relative`, so the overlay needs no separate box.
  // Chips are ordinary badges. They say the same kind of thing as every other
  // badge in the portal — a country, a status, a count — and a card-local pill
  // shape (the former `.card__chip`, a dark scrim capsule) made the same fact
  // look like a different species depending on whether it sat on a picture or
  // under one (user decision, 2026-08-12).
  const chips = (o.chips || []).filter(Boolean);
  const overlay = chips.length
    ? `<div class="card__chips">${chips.map((c) => badge(c, 'info')).join('')}</div>`
    : '';
  // `mark`: ready HTML stating something about the record AS A WHOLE — today the
  // «gemerkt» star (js/ui/bookmark.js). A card has two shapes and the mark needs
  // a home in both:
  //   · WITH a picture it belongs ON it, top left, the same corner as the detail
  //     hero. Over an image it reads across a whole grid at a glance;
  //   · WITHOUT one there is no corner, so the mark joins the pill row under the
  //     title — and that copy is also the fallback for a grid that drops card
  //     images at some width (`.catalogue-grid` does, card.css).
  // Both are emitted and CSS decides. `display:none` takes a copy out of the
  // accessibility tree too, so exactly one is ever announced.
  const markOnImage = o.mark ? `<div class="card__mark">${o.mark}</div>` : '';
  // `media` = caller-supplied, ready media HTML (RAW; caller escapes it). The
  // explorer gallery needs its own visual block (16:10 tile, parcel hatching)
  // and previously rebuilt the ENTIRE card by hand for it (portfolio pfCard,
  // design review A11). It now supplies only the media; body and footer come
  // from this single source.
  const media = o.media
    ? o.media
    : o.photo
    ? `<div class="card__image">${photo({ ...o.photo, alt: o.photo.alt || '', w: 640 })}${overlay}${markOnImage}</div>`
    : safeResourceUrl(o.image) ? `<div class="card__image"><img src="${escape(safeResourceUrl(o.image))}" alt="${escape(o.imageAlt || '')}" loading="lazy">${overlay}${markOnImage}</div>`
    : o.placeholder ? `<div class="card__image"><div class="photo image__not-available">${icon('Image')}<p class="image__not-available-text">${escape(o.placeholder === true ? 'Bild folgt' : o.placeholder)}</p></div>${overlay}${markOnImage}</div>`
    : '';
  // No picture, no corner: the inline copy is then the ONLY one, so it must not
  // be the one the media query hides.
  const markInlineCls = media ? 'card__mark-inline' : 'card__mark-inline card__mark-inline--only';
  // CD: `card--default` is the plain shadow card (with or without image);
  // `card--universal` is the variant whose image is letterboxed (object-contain),
  // so it stays opt-in via o.variant — image-less cards are default, not universal.
  const variant = CARD_VARIANTS.has(o.variant) ? o.variant : 'default';
  const tag = safeHeadingTag(o.titleTag, 'h3');
  const ext = o.external ? newWindowAttrs(href, { external: classifyUrl(href) === 'external' }) : '';
  const popup = o.dialog ? ' aria-haspopup="dialog"' : '';
  // Stretched-link pattern (CD/WAI-ARIA APG): the card is a <div>, and its title
  // is a real heading containing an <a> whose ::after makes the whole card
  // clickable. This preserves the document outline AND keeps nested links
  // (badges) valid, with no more <a> inside <a>.
  // `breakable`: long German compounds may break after «/» and «-»; otherwise,
  // for example, «Sicherheits-/Datenschutzvorfall» breaks mid-word (Item 5.8).
  const titleInner = href
    ? `<a class="card__link" href="${escape(href)}"${ext}${popup}>${breakable(o.title)}</a>`
    : breakable(o.title);
  // CD builds the footer from TWO named slots (card.postcss:245-257,
  // Card.vue:27-37): `footerInfo` (metadata row) and `footerAction` (CTA).
  // `footer` remains as a raw slot for legacy callers. Without an info slot,
  // CD's --icon-only modifier replaces the former empty <span></span> trick
  // (Item 5.12).
  const footerSlots = (o.footerInfo || o.footerAction)
    ? `<div class="card__footer${o.footerInfo ? '' : ' card__footer--icon-only'}">${
        o.footerInfo ? `<div class="card__footer__info">${o.footerInfo}</div>` : ''}${
        o.footerAction ? `<div class="card__footer__action">${o.footerAction}</div>` : ''}</div>`
    : (o.footer ? `<div class="card__footer">${o.footer}</div>` : '');
  const inner = `${media}
    <div class="card__content">
      <div class="card__body">
        <${tag} class="card__title">${titleInner}</${tag}>
        ${/* `idLine`: monospace identifier row directly below the title (bbl_id,
              project number), using the shared card recipe (.card__identifier). */''}
        ${o.idLine ? `<p class="card__identifier">${escape(o.idLine)}</p>` : ''}
        ${/* The inline twin of the image mark. It leads the pill row rather than
              forming a line of its own: on a phone every saved card would
              otherwise gain a row of height for one symbol. */''}
        ${o.mark || o.badges ? `<div class="pill-row">${
          o.mark ? `<span class="${markInlineCls}">${o.mark}</span>` : ''}${
          (o.badges || []).join('')}</div>` : ''}
        ${o.desc ? `<p class="card__description">${escape(o.desc)}</p>` : ''}
      </div>
      ${footerSlots}
    </div>`;
  return `<div class="card card--${variant}${href ? ' card--clickable' : ''}${extraClasses ? ' ' + extraClasses : ''}">${inner}</div>`;
}

// --- Tables (table.postcss) --------------------------------------------------
// THE portal table. Every table passes through here, either directly or through
// C.mountDataTable, which wraps the same function with catalogue and pagination
// bars. The purpose is consistency: one font weight per row, text on the left,
// numbers on the right, and matching padding and separators.
//
// columns: [{ key, label, render?(row), align?, width?, nowrap?, labelHidden? }]
//   labelHidden: keep the header as the column's accessible name, but take it
//          out of the layout. For a column whose cells are a single symbol, a
//          visible header is what sets the width — «GEMERKT» in header type is
//          four times the glyph it labels. The <th> stays: a data cell with no
//          column header is announced without the dimension it belongs to.
//   align: 'right' for numbers — aligns BOTH header and cell, narrows the column,
//          and applies tabular figures (see app.css).
//   nowrap: for IDENTIFIER columns (a case reference, a BBL id). Such a value is
//          one token to a reader but offers the line breaker an opportunity at
//          every hyphen, so «BBL-2026-0880» split across two lines in the very
//          column people scan down. Under auto layout the flag also asks for the
//          width the identifier actually needs — which is what a hand-measured
//          `width` was standing in for, and getting wrong.
//   width: explicit column width ('12rem', '25%') where content-based shrinking
//          produces a poor result. Rendered in <colgroup>.
// rows: object[]; caption names the table.
// `foot` = ready <tr>…</tr> HTML for a <tfoot> row (for example, a total row);
// the caller escapes its content.
// `groups` replaces `rows` with sections: [{ key, label, count, open, rows }].
// Each becomes its own <tbody>, which is what makes the zebra restart per
// section rather than running straight through — a stripe that carries across a
// section boundary reads as one continuous list. A section opens with a header
// row spanning the full width; `scope="colgroup"` is what tells a screen reader
// that the heading governs the rows below rather than a column beside them.
export function table({ columns, rows, groups, zebra, caption, showCaption, foot, rowsClickable, emptyText, rowClass, compact }) {
  // Per-column `align: 'right'|'center'|'left'` maps to the CD alignment utility on header + cell.
  const al = (c) => {
    const classes = [ALIGNMENTS.has(c.align) ? `text-${c.align}` : '', c.nowrap ? 'text-nowrap' : ''];
    const list = classes.filter(Boolean).join(' ');
    return list ? ` class="${list}"` : '';
  };
  const head = columns.map(c => `<th scope="col"${al(c)}>${
    c.labelHidden ? `<span class="sr-only">${escape(c.label)}</span>` : escape(c.label)}</th>`).join('');
  // `rowClass(row)` marks individual rows — the Plan-Editor points at one floor
  // arriving from the structure tree. A class rather than free attributes: the
  // component escapes it, so a caller cannot inject markup into the row tag.
  const rowAttr = (r) => {
    const name = typeof rowClass === 'function' ? String(rowClass(r) || '') : '';
    return name ? ` class="${escape(name)}"` : '';
  };
  const dataRow = (r) =>
    `<tr${rowAttr(r)}>${columns.map((c, i) => {
      const cell = c.render ? c.render(r) : escape(r[c.key]);
      return i === 0 ? `<th scope="row"${al(c)}>${cell}</th>` : `<td${al(c)}>${cell}</td>`;
    }).join('')}</tr>`;
  const body = (rows || []).map(dataRow).join('');
  // A collapsed section keeps its header — that is the whole point of collapsing,
  // and it is also what stays as the control to open it again.
  // Repeat visible labels in each group, while the real thead retains semantic
  // column ownership and prevents duplicate screen-reader announcements.
  const subHead = `<tr class="table__subhead" aria-hidden="true">${columns.map((c) => (
    `<td${al(c)}>${c.labelHidden ? '' : escape(c.label)}</td>`)).join('')}</tr>`;
  const sections = (groups || []).map((g) => `<tbody>
    <tr class="table__group"><th scope="colgroup" colspan="${columns.length}">
      <button type="button" class="table__group-toggle" data-group="${escape(g.key)}"
        aria-expanded="${g.open !== false}">${icon('ChevronRight', 'table__group-chev')}
        <span>${escape(g.label)}</span>${g.count == null ? ''
    : ` <span class="table__group-n">${escape(String(g.count))}</span>`}</button></th></tr>
    ${/* Every open group uses the same visible group-label-row order. */''}
    ${g.open === false ? '' : subHead}
    ${g.open === false ? '' : (g.rows || []).map(dataRow).join('')}</tbody>`).join('');
  // `rowsClickable`: the entire row follows its FIRST link. This is purely a
  // mouse convenience; keyboard and screen-reader interaction still uses that
  // link. A row without such a link does nothing; an `onclick` on `<tr>` without
  // a link target would be unreachable to both.
  const cls = ['table', zebra ? 'table--zebra' : '', showCaption ? 'table--caption' : '',
    compact ? 'table--compact' : '',
    // Grouped tables repeat visible column labels while retaining the semantic thead.
    groups ? 'table--grouped' : '',
    rowsClickable ? 'table--rows-clickable' : ''].filter(Boolean).join(' ');
  // Only a named table becomes a named region. `aria-label="Tabelle"` named 11 of
  // 15 tables, producing eleven indistinguishable «Tabelle» regions in the
  // landmarks tree (Item 5.6). Without a name, the box remains only a scrolling
  // surface; `wireScrollRegions` adds tabindex/role only when it actually
  // overflows. Render <colgroup> only when at least one column supplies a width;
  // a group of empty <col> elements would be ineffective but not free.
  const colgroup = columns.some((c) => columnWidth(c.width))
    ? `<colgroup>${columns.map((c) => {
      const width = columnWidth(c.width);
      return `<col${width ? ` style="width:${width}"` : ''}>`;
    }).join('')}</colgroup>`
    : '';
  return `<div class="table-wrapper"${caption ? ` role="region" aria-label="${escape(caption)}"` : ''}>
    <table class="${cls}">
    ${caption ? `<caption>${escape(caption)}</caption>` : ''}
    ${colgroup}
    <thead><tr>${head}</tr></thead>
    ${groups ? (sections || `<tbody><tr><td colspan="${columns.length}" class="table__empty muted">${escape(emptyText || 'Keine Einträge.')}</td></tr></tbody>`)
    : `<tbody>${body || `<tr><td colspan="${columns.length}" class="table__empty muted">${escape(emptyText || 'Keine Einträge.')}</td></tr>`}</tbody>`}
    ${foot ? `<tfoot>${foot}</tfoot>` : ''}
  </table>
  ${/* Visible horizontal-overflow hint (Item 5.7). A table continuing to the
        right previously looked as though it ended there, so nobody discovered
        the clipped column. `position:sticky; left:0` keeps the hint in place
        while scrolling. `wireScrollRegions` sets `is-scrollable`, so it appears
        only for real overflow. aria-hidden because the wrapper carries name +
        tabindex, and assistive technology reads tables cell by cell rather than
        scrolling them. */''}
  <p class="table-wrapper__hint" aria-hidden="true">${icon('ArrowRight', 'icon--sm')}Tabelle seitlich scrollbar</p></div>`;
}

// Empty state. `unavailable: true` (P0-4) marks a load failure rather than a
// zero-result state, using a warning icon and error tint. `hint` adds a second,
// helpful sentence. German UI term: `Daten nicht verfügbar`.
export function empty(msg, opts = {}) {
  // ONE name for this state: `available: false`. It was previously called
  // `unavailable: true` here and `available` in the twin `catalogueResults`
  // component, with opposite names and polarity. `news.js` passed `available`
  // and could therefore never reach the failure path: if `news.json` failed,
  // the page claimed there were no messages. Continue reading `unavailable` as
  // a legacy name so no caller silently breaks.
  if (opts.available === false || opts.unavailable) {
    return `<div class="empty empty--unavailable">${icon('WarningCircle', 'icon--base')}<span>${escape(msg)}</span></div>`;
  }
  // Enrich the empty state only with a hint; without one, keep the plain variant.
  // `action` gives the zero state a control rather than advice alone. Previously
  // it offered text-only advice, but acting on that meant
  // scrolling back up and finding the bar. `href` navigates; `id` expects the
  // caller to wire the button.
  const actionHref = opts.action && safeLinkUrl(opts.action.href);
  const action = opts.action
    ? (actionHref
      ? `<a class="btn btn--outline btn--sm empty__action" href="${escape(actionHref)}">${icon('Refresh', 'btn__icon icon--base')}<span class="btn__text">${escape(opts.action.label)}</span></a>`
      : opts.action.id
        ? `<button type="button" class="btn btn--outline btn--sm empty__action" id="${escape(opts.action.id)}">${icon('Refresh', 'btn__icon icon--base')}<span class="btn__text">${escape(opts.action.label)}</span></button>`
        : `<span class="btn btn--outline btn--sm empty__action" aria-disabled="true">${icon('Refresh', 'btn__icon icon--base')}<span class="btn__text">${escape(opts.action.label)}</span></span>`)
    : '';
  return (opts.hint || action)
    ? `<div class="empty"><p class="empty__title">${escape(msg)}</p>${
        opts.hint ? `<p class="empty__hint">${escape(opts.hint)}</p>` : ''}${action}</div>`
    : `<div class="empty">${escape(msg)}</div>`;
}

// Standard «not found» block for detail routes (formerly copied repeatedly).
// The calling page sets title/breadcrumb; `body` is HTML (including a back link).
function notFound({ backHref, backLabel, title, body }) {
  return `<div class="container section">
    ${backLink(backHref, backLabel)}
    <div class="page-header mt-4"><h1 tabindex="-1">${escape(title)}</h1></div>
    <p class="muted">${body}</p>
  </div>`;
}

// The complete FLOW of a «not found» response, not just its markup.
//
// Eleven places (eight pages, five apps) hand-wrote the same four steps:
// setTitle · setCrumbs · mount.innerHTML = notFound({…}) · return. `notFound`
// standardised only the last one, and the eleven copies promptly drifted: two
// set no breadcrumbs at all (leaving those of the previously visited record),
// six added a not-found suffix, and three did not.
//
// `thing` carries the grammatical gender that varies by subject. Where the
// sentence must say more than the default missing-item message, `body` replaces
// it completely.
export function renderNotFound(ctx, {
  thing, title, backHref, backLabel, overview = backLabel, crumbs, body,
} = {}) {
  const { mount, setTitle, setCrumbs } = ctx;
  setTitle(title);
  if (crumbs) setCrumbs([...crumbs, { label: 'Nicht gefunden' }]);
  const safeBackHref = safeLinkUrl(backHref);
  mount.innerHTML = notFound({ backHref: safeBackHref, backLabel, title,
    body: body || `${thing} existiert nicht. ${safeBackHref
      ? `<a href="${escape(safeBackHref)}">Zur Übersicht «${escape(overview)}»</a>`
      : `Zur Übersicht «${escape(overview)}»`}` });
}

// Active-filter pill row (formerly copied in services/applications/catalogue).
// filters = [{ label, href }] — href is the same view without that one filter.
// Two modes with the same appearance (`.active-filters` / `.active-filter`):
// catalogue pages pass an `href` per pill plus `resetHref` (shareable hash
// navigation). JS-state pages (portfolio) pass `remove` instead (one data token
// per pill), turning pills into <button data-remove> and reset into <button
// data-reset>, which the caller wires. `label` overrides the «Aktive Filter:» prefix.
export function activeFilters({ filters, resetHref, resetLabel = 'Alle Filter zurücksetzen', label = 'Aktive Filter:' }) {
  if (!filters || !filters.length) return '';
  // One id per pill, or removing one loses focus to <body> (Item 3.3). CD's
  // interactive pill is .tag-item (full 44px height scale + focus ring,
  // tag-item.postcss:7-42); the former 32px badge was below the target size.
  const inner = (f) => `<span class="tag-item__inner"><span class="tag-item__text">${escape(f.label)}</span>${icon('Cancel', 'tag-item__icon')}</span>`;
  const pill = (f, i) => safeLinkUrl(f.href)
    ? `<a class="tag-item tag-item--sm active-filter" id="af-${i}" href="${escape(safeLinkUrl(f.href))}" aria-label="Filter «${escape(f.label)}» entfernen">${inner(f)}</a>`
    : f.href != null
      ? `<span class="tag-item tag-item--sm active-filter" id="af-${i}" aria-disabled="true">${inner(f)}</span>`
    : `<button type="button" class="tag-item tag-item--sm active-filter" id="af-${i}" data-remove="${escape(f.remove == null ? '' : f.remove)}" aria-label="Filter «${escape(f.label)}» entfernen">${inner(f)}</button>`;
  const safeResetHref = safeLinkUrl(resetHref);
  const reset = safeResetHref
    ? `<a class="btn btn--link" href="${escape(safeResetHref)}"><span class="btn__text">${escape(resetLabel)}</span></a>`
    : resetHref != null
      ? `<span class="btn btn--link" aria-disabled="true"><span class="btn__text">${escape(resetLabel)}</span></span>`
    : `<button type="button" class="btn btn--link" data-reset><span class="btn__text">${escape(resetLabel)}</span></button>`;
  // Spacing above the pill row lives in the component rule (.active-filters, CD
  // scale pt-4/sm:pt-6/2xl:pt-8 — search.postcss:266-269), not a fixed mt-4
  // utility that would pin the scale at >=640px.
  return `<div class="active-filters" role="group" aria-label="Aktive Filter">
    <span class="small muted">${escape(label)}</span>
    ${filters.map(pill).join('')}
    ${reset}
  </div>`;
}

// Card footer in CD anatomy (Card.vue:27-37, card.postcss:245-257):
// `card__footer__info` on the left, `card__footer__action` on the right. In CD,
// the action is an icon-only outline button; the arrow is visible and the label
// is sr-only (btn.postcss:160-166). CD therefore has no visible action text.
//
// Here the entire card is an <a>, so the action cannot be a second link (nested
// <a> elements are invalid and previously produced a pseudo-link: a styled
// <span> that looked interactive but could not
// receive focus and was not announced as a link). It is therefore decorative
// and hidden from assistive technology; the card link itself carries the
// accessible name and action.
export function cardAction({ external = false } = {}) {
  return `<span class="btn btn--outline btn--icon-only" aria-hidden="true">${icon(external ? 'External' : 'ArrowRight', 'btn__icon icon--base')}</span>`;
}

function cardFooter(meta = '', opts = {}) {
  return `<div class="card__footer${meta ? '' : ' card__footer--icon-only'}">
    ${meta ? `<div class="card__footer__info">${meta}</div>` : ''}
    <div class="card__footer__action">${cardAction(opts)}</div>
  </div>`;
}

// Icon tile (domain-tile): image-free card with a large icon, title, text, and
// arrow footer. One source for overview cards (data, knowledge, digitalisation);
// image-free cards are card--default (CD), not --universal.
export function domainTile({ icon: ic, title, desc, meta = '', href, external = false, titleTag = 'h3' }) {
  const safeHref = safeLinkUrl(href);
  const ext = external ? newWindowAttrs(safeHref, { external: classifyUrl(safeHref) === 'external' }) : '';
  const titleElement = safeHeadingTag(titleTag, 'h3');
  // Same stretched-link pattern as card(): the card is a <div>, and the title's
  // <a> covers it through ::after. In CD, the card root is ALWAYS a div
  // (Card.vue:2-39). The former whole-card <a> gave screen readers title +
  // description + metadata as one long link name.
  return `<div class="card card--default${safeHref ? ' card--clickable' : ''}">
    <div class="card__content">
      <div class="card__body">
        <span class="domain-tile__icon">${icon(ic, 'icon--2xl')}</span>
        <${titleElement} class="card__title">${safeHref ? `<a class="card__link" href="${escape(safeHref)}"${ext}>${escape(title)}</a>` : escape(title)}</${titleElement}>
        <p class="card__description">${escape(desc)}</p>
      </div>
      ${cardFooter(escape(meta), { external })}
    </div>
  </div>`;
}

// Detail-page top bar: back link on the left, share bar on the right, in ONE row
// (CD: .back-bar + .share-bar at the same height after the breadcrumb).
export function detailBar({ backHref, backLabel } = {}) {
  return `<div class="detail-bar">${
    backHref ? backLink(backHref, backLabel) : '<span></span>'}${shareBar()}</div>`;
}

// Standardised detail-page header (CD detailPage* pattern): detailBar (back +
// share), then a hero with title, lead, badges, and optional contextual image
// (hero--main-image). Without `image`, the hero falls back to its narrow variant.
// `tags`/`image` are ready HTML; `title`/`lead` are escaped. The contextual image
// helper appeared verbatim in services.js and digitalisation.js, including a
// `<figure>` without margin reset that retained the UA default (margin:1em 40px):
// its image did not fill the grid column and was inset 40px on both sides. Its
// figcaption also carried `class="small muted"`, although `figcaption` globally
// inherits `.legend` since Item 1.6, creating a fifth legend style. NO image
// caption on detail pages (user decision, 2026-07-30): Unsplash placeholders
// inconsistently carried a «Symbolbild» notice. Omit it consistently in the
// prototype. The home page (a real BBL photo with © notice) writes and retains
// its own figcaption. The `credit` parameter remains in the interface but is
// not rendered.
// `loading` forwards to photo(): a detail-page hero is usually the LCP
// element, and heroFigure used to force it lazy with no way to opt out
// (code review 2026-08, F-S21). Callers above the fold pass 'eager'.
export function heroFigure({ src, id, color = 'var(--color-secondary-600)', alt = '', w = 800, ratio = '', loading } = {}) {
  if (!src && !id) return '';
  const ratioClass = { '16x9': 'photo--16x9', '4x3': 'photo--4x3', '21x9': 'photo--21x9' }[ratio]
    || 'hero-media hero-media--natural';
  return `<figure class="hero__figure">${photo({ src, id, color, alt, w, cls: ratioClass, loading })}</figure>`;
}

// `bookmark` is ready HTML like `tags` and `image` — the «merken» control for
// this record (js/ui/bookmark.js), or nothing. Passing it as markup keeps this
// layer data-free: the head does not know what a bookmark is, only that
// something belongs to the record as a whole.
//
// It sits in the top right corner OF THE PICTURE (.hero__image), the same place
// on services, datasets and applications, so «merken» is one gesture across the
// portal rather than three. The title row remains the FALLBACK, not a second
// option: a head can render without an image (a dataset with no preview), and
// an anchor that disappears is not an anchor. Exactly one of the two placements
// renders, never both — two stars in one head would read as two different things
// to save. (The labelled link in the «Zugriff» card is not a second star but the
// same control in words; wireBookmarks keeps them in step.)
export function detailHead({ backHref, backLabel, title, lead = '', tags = '', image = '', bookmark = '' } = {}) {
  const content = `<div class="hero__content">
        <div class="hero__titlebar">
          <h1 class="hero__title" tabindex="-1">${escape(title)}</h1>
          ${image ? '' : bookmark}
        </div>
        ${lead ? `<p class="hero__description">${escape(lead)}</p>` : ''}
        ${tags ? `<div class="pill-row">${tags}</div>` : ''}
      </div>`;
  // CD Hero.vue:8: the hero is a <section> band, not a plain <div>. Appearance is
  // identical (all rules use class selectors), with correct document-outline parity.
  const hero = image
    ? `<section class="hero hero--main-image">${content}<div class="hero__image">${image}${bookmark}</div></section>`
    : `<section class="hero">${content}</section>`;
  return `${detailBar({ backHref, backLabel })}
    ${hero}`;
}

// Detail-page section: title + content. `body` is ready HTML. `titleTag` works as
// in pageSection. Inside tabs, the section sits below an h2 and needs an h3; two
// callers previously copied all markup by hand for this (design review, pages).
// `id` makes the section an in-page jump target. The title takes tabindex="-1"
// with it, so focus can follow the scroll instead of staying behind at the top
// of the page (the anchor-nav pattern, js/pages/anchor-nav.js).
export function detailSection({ title, body = '', titleTag = 'h2', id = '' }) {
  const titleElement = safeHeadingTag(titleTag, 'h2');
  const anchor = id ? domToken(id, '') : '';
  return `<section class="detail-section"${anchor ? ` id="${anchor}"` : ''}>
      <${titleElement} class="detail-section__title"${anchor ? ' tabindex="-1"' : ''}>${escape(title)}</${titleElement}>
      ${body}
    </section>`;
}

// --- Download items (download-item.postcss) ----------------------------------
// One CD download-item row for every case (document, app entry, resource,
// attachment). `external` identifies another system; independently, `newWindow`
// can open a portal-internal app entry in a new tab. `#` degrades to a disabled
// substitute. `note`/`desc` are interchangeable (data objects carry `desc`, app
// entries `note`); `icon` overrides the default symbol. `wrapLi` wraps the row in
// `<li>` for `.download-items`.
export function downloadItem({ href, title, note = '', desc = '', meta = [], icon: iconName,
  external = false, newWindow = false, heading = 'h3', wrapLi = false, download = false } = {}) {
  const safeHref = download ? safeResourceUrl(href) : safeLinkUrl(href);
  const titleTag = /^h[2-6]$/.test(heading) ? heading : 'h3';
  const text = note || desc;
  const opensNewWindow = external || newWindow;
  const sym = iconName || (opensNewWindow ? 'External' : 'Download');
  const inner = `${icon(sym, 'download-item__icon')}
    <div>
      <${titleTag} class="download-item__title">${escape(title)}</${titleTag}>
      ${text ? `<p class="download-item__description">${escape(text)}</p>` : ''}
      ${meta.length ? `<p class="meta-info download-item__meta-info">${
        meta.filter(Boolean).map(m => `<span class="meta-info__item">${escape(m)}</span>`).join('')}</p>` : ''}
    </div>`;
  const real = !!safeHref;
  const attrs = opensNewWindow
    ? newWindowAttrs(safeHref, { external: external && classifyUrl(safeHref) === 'external' })
    : (download ? ' download' : '');
  const el = real
    ? `<a class="download-item" href="${escape(safeHref)}"${attrs}>${inner}</a>`
    : `<span class="download-item" aria-disabled="true" title="Im Prototyp nicht verfügbar">${inner}
       <span class="sr-only">(im Prototyp nicht verfügbar)</span></span>`;
  return wrapLi ? `<li>${el}</li>` : el;
}

// CD contact box (.box): name/role/email (mailto)/phone, all escaped. Replaces
// contact markup copied per page and closes unescaped mailto sites (code review B4).
export function contactBox(contact, { title = 'Kontakt', heading = 'h3' } = {}) {
  if (!contact) return '';
  const titleElement = safeHeadingTag(heading, 'h3');
  // SAME anatomy as contactCard (dl.kv--stack). Detail-page contact slots used
  // two typographies for the same purpose: line list here, labelled key-value
  // rows there (design review B22). dt = role; `unit` = directorate according to
  // the BBL organisation chart («Portfoliomanagement» says little, while
  // «Direktionsbereich Bauten — Portfoliomanagement» provides context).
  const dd = [
    contact.name ? `<strong>${escape(contact.name)}</strong>` : '',
    contact.unit ? escape(contact.unit) : '',
    safeMailto(contact.email) ? `<a href="${escape(safeMailto(contact.email))}">${escape(contact.email)}</a>` : '',
    contact.phone ? escape(contact.phone) : '',
  ].filter(Boolean);
  return `<div class="box"><${titleElement}>${escape(title)}</${titleElement}>
    <dl class="kv kv--stack">
      <dt>${escape(contact.role || 'Ansprechperson')}</dt>
      <dd>${dd.join('<br>')}</dd>
    </dl></div>`;
}

// («Original» source box removed — exported for two weeks without a
// single call site; the adoption named in architecture.js never happened.
// Code review 2026-08, F-S15; retrieve from git history if a consumer
// materialises.)

// --- Detail-view side column ------------------------------------------------
// Two cards that serve the same purpose on every property detail page: what can
// I start here, and whom can I ask? They live here as building blocks so the
// property inventory and tenant portal do not maintain two versions of the same
// box. The side column is exactly where users expect familiarity.

// Legacy contract: `links` = [{ label, href }]. Rows use the same `.fp-svc` grid
// as shortcuts in room detail: label, follow arrow.
//
// The structured `items` contract adds real links and buttons, plus unavailable
// handoffs:
//   { type:'link',     label, href, description?, icon?, id? }
//   { type:'button',   label,       description?, icon?, id?, disabled? }
//   { type:'handoff',  label,       description?, icon?, id? }
// `disabled` aliases `handoff`. The description remains visible so an unavailable
// destination does not look like a broken link.
//
// WITHOUT a leading symbol. Symbols represented the linked service («Wrench» for
// fault reporting, «File» for documents) and merely repeated the adjacent label;
// a symbol must add something the text does not already say. The arrow remains
// on the right because it indicates what the row does. `icon` on an item is
// ignored — see actionCardRow.
function actionCardRow(item = {}) {
  let type = ['link', 'button', 'handoff', 'disabled'].includes(item.type) ? item.type : 'disabled';
  if (type === 'handoff') type = 'disabled';
  const href = safeLinkUrl(item.href);
  if (type === 'link' && !href) type = 'disabled';

  const description = item.description || '';
  const content = `<span class="fp-svc__content"><span class="fp-svc__label">${escape(item.label)}</span>${
    description ? `<small class="fp-svc__description">${escape(description)}</small>` : ''}</span>`;
  // THREE glyphs, and the ROW TYPE picks them — a row leads somewhere, does
  // something here, or cannot be used yet. A per-item override is gone: a card
  // of rows each carrying its own picture is a card you have to read twice, and
  // the label already says what the row is.
  //
  // Lucide, not the CD set: these render at 16px, where a stroked outline stays
  // legible and a filled silhouette closes up into a blob.
  const iconName = type === 'disabled' || item.disabled ? 'lucide/lock'
    : type === 'link' ? (item.newWindow ? 'lucide/external-link' : 'lucide/link')
      : 'lucide/arrow-right';
  const rowIcon = icon(iconName, 'icon--sm fp-svc__go');
  const id = item.id != null && item.id !== '' ? ` id="${escape(item.id)}"` : '';

  if (type === 'link') {
    const externalWindow = item.newWindow ? newWindowAttrs(href, { external: classifyUrl(href) === 'external' }) : '';
    return `<a class="fp-svc" href="${escape(href)}"${id}${externalWindow}>${content}${rowIcon}</a>`;
  }
  if (type === 'button') {
    const disabled = item.disabled ? ' disabled' : '';
    const cls = item.disabled ? ' fp-svc--disabled' : '';
    return `<button class="fp-svc${cls}" type="button"${id}${disabled}>${content}${rowIcon}</button>`;
  }
  return `<span class="fp-svc fp-svc--disabled" role="link" aria-disabled="true"${id}>${content}${rowIcon}</span>`;
}

export function actionCard({ title = 'Aktionen', lead = '', links = [], items, titleTag = 'h2' } = {}) {
  // `items` deliberately becomes the primary contract whenever passed as an
  // array, allowing a caller to hide the card explicitly with `items:[]`.
  // Legacy links are normalised to the new shape; their historical `icon` fields
  // do not reach rendering (see above), while the explicit window contract is
  // preserved.
  const rows = Array.isArray(items)
    ? items
    : (Array.isArray(links) ? links : []).map((link) => ({
      type: 'link', label: link.label, href: link.href, newWindow: !!link.newWindow,
    }));
  if (!rows.length) return '';
  // `titleTag`: a card in a detail rail sits beside <h3> sections and has to
  // match them, or the outline jumps back up a level mid-page.
  const heading = safeHeadingTag(titleTag, 'h2');
  return `<div class="box">
    <${heading}>${escape(title)}</${heading}>
    ${lead ? `<p class="small muted">${escape(lead)}</p>` : ''}
    <div class="fp-svc-list">${rows.map(actionCardRow).join('')}</div>
  </div>`;
}

// `contacts` = [{ label, name, email, phone }]. Omit `name` where it merely
// repeats the role; «Portfoliomanagement / Portfoliomanagement» looked like a
// display error.
export function contactCard({ title = 'Ansprechpersonen', contacts = [], titleTag = 'h2' } = {}) {
  if (!contacts.length) return '';
  const heading = safeHeadingTag(titleTag, 'h2');
  return `<div class="box">
    <${heading}>${escape(title)}</${heading}>
    <dl class="kv kv--stack">${contacts.map((c) => `
      <dt>${escape(c.label)}</dt>
      <dd>${c.name && c.name !== c.label ? `${escape(c.name)}<br>` : ''}${
        safeMailto(c.email) ? `<a href="${escape(safeMailto(c.email))}">${escape(c.email)}</a>` : ''}${
        c.phone ? `<br>${escape(c.phone)}` : ''}</dd>`).join('')}
    </dl>
  </div>`;
}

// Link for a demo download that has no real target yet.
export function downloadLink(url, label, iconName = 'Download') {
  const safeUrl = safeResourceUrl(url);
  const real = !!safeUrl;
  return real
    ? `<a class="btn btn--link btn--icon-left" href="${escape(safeUrl)}">${icon(iconName, 'btn__icon')}<span class="btn__text">${escape(label)}</span></a>`
    : `<span class="btn btn--link btn--icon-left" aria-disabled="true" title="Im Prototyp nicht verfügbar">${icon(iconName, 'btn__icon')}<span class="btn__text">${escape(label)}<span class="sr-only"> (im Prototyp nicht verfügbar)</span></span></span>`;
}

// --- Landscape ---------------------------------------------------------------
// Render catalogue counts as proportional group area rather than row order.
// `isOpen` remains caller-owned so disclosure survives route redraws.
//   boxes  [{ key, label, count, tiles: [{ label, href, on }] }]
//   cols   fixed tiles per row; callers choose a value that keeps labels readable
export function landscape({ boxes, isOpen, emptyText = 'Hier ist nichts erfasst.', cols = 2 }) {
  if (!boxes || !boxes.length) return `<p class="lscape__empty">${escape(emptyText)}</p>`;
  const chev = icon('ChevronRight', 'lscape__chev');
  return `<div class="lscape" style="--lscape-cols:${Number(cols) || 2}">${boxes.map((b) => {
    const open = isOpen ? isOpen(b.key) !== false : true;
    return `<section class="lscape__group">
      <h3 class="lscape__head"><button type="button" class="lscape__toggle" data-box="${escape(b.key)}"
        aria-expanded="${open}">${chev}<span>${escape(b.label)}</span>
        <span class="lscape__n">${escape(String(b.count))}</span></button></h3>
      ${!open ? '' : (b.tiles || []).length
    ? `<ul class="lscape__tiles">${b.tiles.map((t) => `<li><a class="lscape__tile${t.on ? ' is-active' : ''}"
          href="${escape(t.href)}"${t.on ? ' aria-current="true"' : ''}>${escape(t.label)}</a></li>`).join('')}</ul>`
    : `<p class="lscape__empty">Für «${escape(b.label)}» ist nichts erfasst.</p>`}
    </section>`;
  }).join('')}</div>`;
}
