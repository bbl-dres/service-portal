import { breakable, escape, icon, photo, safeClassList, safeHeadingTag } from './primitives.js';
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
  const chips = (o.chips || []).filter(Boolean);
  const overlay = chips.length
    ? `<div class="card__chips">${chips.map((c) => `<span class="card__chip">${escape(c)}</span>`).join('')}</div>`
    : '';
  // `media` = caller-supplied, ready media HTML (RAW; caller escapes it). The
  // explorer gallery needs its own visual block (16:10 tile, parcel hatching)
  // and previously rebuilt the ENTIRE card by hand for it (portfolio pfCard,
  // design review A11). It now supplies only the media; body and footer come
  // from this single source.
  const media = o.media
    ? o.media
    : o.photo
    ? `<div class="card__image">${photo({ ...o.photo, alt: o.photo.alt || '', w: 640 })}${overlay}</div>`
    : safeResourceUrl(o.image) ? `<div class="card__image"><img src="${escape(safeResourceUrl(o.image))}" alt="${escape(o.imageAlt || '')}" loading="lazy">${overlay}</div>`
    : o.placeholder ? `<div class="card__image"><div class="photo image__not-available">${icon('Image')}<p class="image__not-available-text">${escape(o.placeholder === true ? 'Bild folgt' : o.placeholder)}</p></div>${overlay}</div>`
    : '';
  // CD: `card--default` is the plain shadow card (with or without image);
  // `card--universal` is the variant whose image is letterboxed (object-contain),
  // so it stays opt-in via o.variant — image-less cards are default, not universal.
  const variant = CARD_VARIANTS.has(o.variant) ? o.variant : 'default';
  const tag = safeHeadingTag(o.titleTag, 'h3');
  const ext = o.external ? newWindowAttrs(href, { external: classifyUrl(href) === 'external' }) : '';
  // Stretched-link pattern (CD/WAI-ARIA APG): the card is a <div>, and its title
  // is a real heading containing an <a> whose ::after makes the whole card
  // clickable. This preserves the document outline AND keeps nested links
  // (badges) valid, with no more <a> inside <a>.
  // `breakable`: long German compounds may break after «/» and «-»; otherwise,
  // for example, «Sicherheits-/Datenschutzvorfall» breaks mid-word (Item 5.8).
  const titleInner = href
    ? `<a class="card__link" href="${escape(href)}"${ext}>${breakable(o.title)}</a>`
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
        ${o.badges ? `<div class="pill-row">${o.badges.join('')}</div>` : ''}
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
// columns: [{ key, label, render?(row), align?, width? }]
//   align: 'right' for numbers — aligns BOTH header and cell, narrows the column,
//          and applies tabular figures (see app.css).
//   width: explicit column width ('12rem', '25%') where content-based shrinking
//          produces a poor result. Rendered in <colgroup>.
// rows: object[]; caption names the table.
// `foot` = ready <tr>…</tr> HTML for a <tfoot> row (for example, a total row);
// the caller escapes its content.
export function table({ columns, rows, zebra, caption, showCaption, foot, rowsClickable, emptyText }) {
  // Per-column `align: 'right'|'center'|'left'` maps to the CD alignment utility on header + cell.
  const al = (c) => ALIGNMENTS.has(c.align) ? ` class="text-${c.align}"` : '';
  const head = columns.map(c => `<th scope="col"${al(c)}>${escape(c.label)}</th>`).join('');
  const body = (rows || []).map(r =>
    `<tr>${columns.map((c, i) => {
      const cell = c.render ? c.render(r) : escape(r[c.key]);
      return i === 0 ? `<th scope="row"${al(c)}>${cell}</th>` : `<td${al(c)}>${cell}</td>`;
    }).join('')}</tr>`
  ).join('');
  // `rowsClickable`: the entire row follows its FIRST link. This is purely a
  // mouse convenience; keyboard and screen-reader interaction still uses that
  // link. A row without such a link does nothing; an `onclick` on `<tr>` without
  // a link target would be unreachable to both.
  const cls = ['table', zebra ? 'table--zebra' : '', showCaption ? 'table--caption' : '',
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
    <tbody>${body || `<tr><td colspan="${columns.length}" class="table__empty muted">${escape(emptyText || 'Keine Einträge.')}</td></tr>`}</tbody>
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
export function heroFigure({ src, id, color = 'var(--color-secondary-600)', alt = '', w = 800, ratio = '' } = {}) {
  if (!src && !id) return '';
  const ratioClass = { '16x9': 'photo--16x9', '4x3': 'photo--4x3', '21x9': 'photo--21x9' }[ratio]
    || 'hero-media hero-media--natural';
  return `<figure class="hero__figure">${photo({ src, id, color, alt, w, cls: ratioClass })}</figure>`;
}

export function detailHead({ backHref, backLabel, title, lead = '', tags = '', image = '' } = {}) {
  const content = `<div class="hero__content">
        <h1 class="hero__title" tabindex="-1">${escape(title)}</h1>
        ${lead ? `<p class="hero__description">${escape(lead)}</p>` : ''}
        ${tags ? `<div class="pill-row">${tags}</div>` : ''}
      </div>`;
  // CD Hero.vue:8: the hero is a <section> band, not a plain <div>. Appearance is
  // identical (all rules use class selectors), with correct document-outline parity.
  const hero = image
    ? `<section class="hero hero--main-image">${content}<div class="hero__image">${image}</div></section>`
    : `<section class="hero">${content}</section>`;
  return `${detailBar({ backHref, backLabel })}
    ${hero}`;
}

// Detail-page section: title + content. `body` is ready HTML. `titleTag` works as
// in pageSection. Inside tabs, the section sits below an h2 and needs an h3; two
// callers previously copied all markup by hand for this (design review, pages).
export function detailSection({ title, body = '', titleTag = 'h2' }) {
  const titleElement = safeHeadingTag(titleTag, 'h2');
  return `<section class="detail-section">
      <${titleElement} class="detail-section__title">${escape(title)}</${titleElement}>
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
// on the right because it indicates that the row leads away. `icon` in the old
// `links` contract remains ignored, so existing inventory callers retain their
// follow arrow and current appearance.
const ACTION_ICON = /^[A-Za-z][A-Za-z0-9_-]*$/;
function actionCardRow(item = {}) {
  let type = ['link', 'button', 'handoff', 'disabled'].includes(item.type) ? item.type : 'disabled';
  if (type === 'handoff') type = 'disabled';
  const href = safeLinkUrl(item.href);
  if (type === 'link' && !href) type = 'disabled';

  const description = item.description || '';
  const content = `<span class="fp-svc__content"><span class="fp-svc__label">${escape(item.label)}</span>${
    description ? `<small class="fp-svc__description">${escape(description)}</small>` : ''}</span>`;
  const fallbackIcon = type === 'disabled' || item.disabled ? 'Lock' : item.newWindow ? 'External' : 'ArrowRight';
  const iconName = ACTION_ICON.test(String(item.icon || '')) ? item.icon : fallbackIcon;
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

export function actionCard({ title = 'Aktionen', lead = '', links = [], items } = {}) {
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
  return `<div class="box">
    <h2>${escape(title)}</h2>
    ${lead ? `<p class="small muted">${escape(lead)}</p>` : ''}
    <div class="fp-svc-list">${rows.map(actionCardRow).join('')}</div>
  </div>`;
}

// `contacts` = [{ label, name, email, phone }]. Omit `name` where it merely
// repeats the role; «Portfoliomanagement / Portfoliomanagement» looked like a
// display error.
export function contactCard({ title = 'Ansprechpersonen', contacts = [] } = {}) {
  if (!contacts.length) return '';
  return `<div class="box">
    <h2>${escape(title)}</h2>
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
