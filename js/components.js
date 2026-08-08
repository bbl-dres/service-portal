// Shared UI component helpers — all return HTML strings (pages compose via templates).
// Class names follow the CD Bund design system; see docs/cd-gap-analysis.md.

const ICON_BASE = 'assets/icons/';

// CD's own chevron path (Select.vue:19 — identical to assets/icons/ChevronDown.svg)
const CHEVRON_SVG = '<svg role="presentation" aria-hidden="true" viewBox="0 0 24 24">'
  + '<path d="m5.706 10.015 6.669 3.85 6.669-3.85.375.649-7.044 4.067-7.044-4.067z"/></svg>';

// --- Placeholder photography -------------------------------------------------
// SINCE THE IMAGE REVIEW (2026-08-04), NO collection carries Unsplash photo IDs.
// All images live locally under assets/images/ (provenance in the respective
// JSON or assets/images/heroes/README.md). photoUrl/`id` remains as a fallback
// for legacy states: the ID is interpolated only after strict character
// validation, and the card's `color` remains behind the image.
const PHOTO_BASE = 'https://images.unsplash.com/photo-';
const PHOTO_ID = /^[A-Za-z0-9_-]+$/;

function photoUrl(id, { w = 800, h = 0, q = 70, gray = false } = {}) {
  if (!id || !PHOTO_ID.test(id)) return '';
  let u = `${PHOTO_BASE}${id}?auto=format&fit=crop&w=${w}&q=${q}`;
  if (h) u += `&h=${h}`;
  if (gray) u += '&sat=-100';   // historic material reads as archival b/w
  return u;
}

// `src` takes precedence over `id`: use a real locally stored image when present
// (assets/images/buildings/…), otherwise retain the Unsplash placeholder via id.
// Both fall back to the colour field if loading fails.
const LOCAL_ASSET = /^assets\/[A-Za-z0-9/_.-]+$/;

function photo(o = {}) {
  const src = (o.src && LOCAL_ASSET.test(o.src)) ? o.src : photoUrl(o.id, { w: o.w, h: o.h, q: o.q, gray: o.gray });
  const img = src
    ? `<img src="${src}" alt="${escape(o.alt || '')}" loading="lazy" decoding="async" onerror="this.remove()">`
    : '';
  return `<div class="photo${o.cls ? ' ' + o.cls : ''}" style="background-color:${escape(o.color || 'var(--color-secondary-600)')}${o.style ? ';' + o.style : ''}">${img}${o.overlay || ''}</div>`;
}

export function icon(name, cls = 'icon--base') {
  const u = ICON_BASE + name + '.svg';
  return `<span class="icon ${cls}" style="-webkit-mask-image:url('${u}');mask-image:url('${u}')" aria-hidden="true"></span>`;
}

export function escape(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Break opportunities for long German compounds: UAX#14 does not permit a break
// after «/» or a hyphen by default, so «Sicherheits-/Datenschutzvorfall» was
// treated as one indivisible word and broke mid-word (visible at BOTH 1440 and
// 320). <wbr> enables the position without adding a character, so `textContent`
// remains identical and tests are unaffected (Item 5.8).
function breakable(s) {
  return escape(s).replace(/([/–—-])(?=\S)/g, '$1<wbr>');
}

// decodeURIComponent that returns the raw value rather than throwing on
// malformed sequences (such as a manually typed `#/applications/%` hash)
// (code review A6).
function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Recurring English terms within otherwise German text. For WCAG 3.1.2
// (language of parts), mark them inline with lang="en" so screen readers
// pronounce them in English.
const EN_TERMS = ['Digital by Design', 'Digital First', 'Digital Only', 'Once-Only', 'Common Data Environment'];

// Escape text and mark known foreign-language phrases with lang. Process longer
// phrases first so partial phrases are not wrapped prematurely.
function markLang(text, terms = EN_TERMS) {
  let out = escape(text);
  for (const phrase of [...terms].sort((a, b) => b.length - a.length)) {
    const e = escape(phrase);
    if (out.includes(e)) out = out.split(e).join(`<span lang="en">${e}</span>`);
  }
  return out;
}

// --- Badges (badge.postcss) --------------------------------------------------
// CD anatomy (Badge.vue:11-18): the label sits in a .badge__text span. Symbols
// use .badge__icon / .badge__icon-left (scaled in em and optically pulled into
// the 1em padding), not generic icon--* classes plus a flex gap.
export function badge(text, variant = 'gray', size = '') {
  return `<span class="badge badge--${variant}${size ? ' badge--' + size : ''}"><span class="badge__text">${escape(text)}</span></span>`;
}

// Loading state — the ONE pattern for «loading / processing» (user decision,
// 2026-08-04): the CD spinner symbol (icon--spin; reduced-motion kill switch in
// app.css) plus wording as a status row. role="status" makes the text a live
// announcement for screen readers; the symbol is decorative. German UI term:
// subject-specific wording, or generic wording without a subject. `hideLabel`
// makes the wording sr-only where the symbol is visually sufficient (router,
// card overlay). Replaces former one-off implementations (router inline,
// map spinner inline, dash-map__loading text row).
export function loading({ label = 'Wird geladen…', hideLabel = false, size = 'xl' } = {}) {
  return `<div class="loading" role="status">
    ${icon('Spinner', `icon--${size} icon--spin`)}
    <span class="${hideLabel ? 'sr-only' : 'loading__label'}">${escape(label)}</span>
  </div>`;
}

const STATUS_VARIANT = {
  'entwurf': 'gray', 'eingereicht': 'info', 'in_pruefung': 'warning', 'in_pruefung_gs': 'warning',
  'in_pruefung_pfm': 'warning', 'rueckfrage': 'warning', 'in_arbeit': 'warning', 'triage': 'info',
  'genehmigt': 'success', 'in_projekt': 'info', 'abgeschlossen': 'success', 'erledigt': 'success',
  'geliefert': 'success', 'abgelehnt': 'error', 'zurueckgezogen': 'gray', 'in_bearbeitung': 'warning',
};
function statusBadge(status, label) {
  return badge(label || status, STATUS_VARIANT[status] || 'gray');
}


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
function pageSection({ title = '', body = '', more = null, alt = false, titleTag = 'h2' }) {
  return `<section class="section section--default${alt ? ' bg--secondary-50' : ''}">
      <div class="container">
        ${title ? `<${titleTag} class="section__title">${escape(title)}</${titleTag}>` : ''}
        ${body}
        ${more ? `<div class="section__action">
          <a class="btn btn--bare btn--icon-right" href="${escape(more.href)}">${icon('ArrowRight', 'btn__icon')}<span class="btn__text">${escape(more.label)}</span></a>
        </div>` : ''}
      </div>
    </section>`;
}

// `lead` is escaped (the normal case). `leadHtml` is the deliberate exception
// for leads with markup, such as a link to a neighbouring system. It is ONLY
// for author-owned markup, never data from core or external services; those keep
// `lead`, and therefore escaping, mandatory.
// Fixed notice strip at the bottom of the viewport — CD's consent component
// (notification-banner.postcss + NotificationBanner.vue). Anatomy matches it:
// `.notification-banner` (+ `--fixed`) also carries `.notification` classes,
// containing a `__wrapper` with `__infos` and the action.
function notificationBanner({ id, html, actionLabel = 'Verstanden', variant = 'info', label = 'Hinweis' }) {
  return `<div class="notification-banner notification-banner--fixed notification notification--${escape(variant)}"
      role="region" aria-label="${escape(label)}" data-banner="${escape(id)}">
    <div class="notification-banner__wrapper">
      <p class="notification-banner__infos">${html}</p>
      <button type="button" class="btn btn--outline btn--sm btn--icon-right" data-banner-close>
        ${icon('Checkmark', 'btn__icon')}<span class="btn__text">${escape(actionLabel)}</span></button>
    </div>
  </div>`;
}

// Mount and remember dismissal. Without persistence, the notice would reappear
// after every page change, which is why consent banners need storage at all.
export function mountBanner(host, opts) {
  if (!host) return;
  const key = 'bbl_banner_' + opts.id;
  let seen = false;
  try { seen = localStorage.getItem(key) === '1'; } catch { /* Storage blocked. */ }
  if (seen) return;
  host.innerHTML = notificationBanner(opts);
  const banner = host.querySelector('.notification-banner--fixed');
  let observer = null;
  const reserveSpace = () => {
    if (!banner || !banner.isConnected) return;
    document.body.style.setProperty('--banner-offset', `${Math.ceil(banner.getBoundingClientRect().height)}px`);
    document.body.classList.add('body--banner-visible');
  };
  const keepFocusVisible = (event) => {
    const target = event.target;
    if (!banner || !(target instanceof Element) || banner.contains(target)) return;
    const targetRect = target.getBoundingClientRect();
    const bannerRect = banner.getBoundingClientRect();
    if (targetRect.bottom <= bannerRect.top || targetRect.top >= bannerRect.bottom) return;
    const delta = Math.ceil(targetRect.bottom - bannerRect.top + 8);
    const scroller = document.scrollingElement;
    if (!scroller) { window.scrollBy(0, delta); return; }
    const priorBehavior = scroller.style.scrollBehavior;
    scroller.style.scrollBehavior = 'auto';
    scroller.scrollTop += delta;
    scroller.style.scrollBehavior = priorBehavior;
  };
  const releaseSpace = () => {
    observer?.disconnect();
    window.removeEventListener('resize', reserveSpace);
    document.removeEventListener('focusin', keepFocusVisible);
    document.body.classList.remove('body--banner-visible');
    document.body.style.removeProperty('--banner-offset');
  };
  if (banner) {
    reserveSpace();
    document.addEventListener('focusin', keepFocusVisible);
    if ('ResizeObserver' in window) {
      observer = new ResizeObserver(reserveSpace);
      observer.observe(banner);
    } else window.addEventListener('resize', reserveSpace);
  }
  const btn = host.querySelector('[data-banner-close]');
  if (btn) btn.addEventListener('click', () => {
    releaseSpace();
    host.innerHTML = '';
    try { localStorage.setItem(key, '1'); } catch { /* It will simply return. */ }
    announce('Hinweis geschlossen.');
  });
  return releaseSpace;
}

function pageHeader({ title, lead, leadHtml }) {
  const body = leadHtml || (lead ? escape(lead) : '');
  return `<div class="page-header"><h1 tabindex="-1">${escape(title)}</h1>${body ? `<p class="lead">${body}</p>` : ''}</div>`;
}


// --- Cards (card.postcss) ----------------------------------------------------
function card(o) {
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
    : o.image ? `<div class="card__image"><img src="${escape(o.image)}" alt="${escape(o.imageAlt || '')}" loading="lazy">${overlay}</div>`
    : o.placeholder ? `<div class="card__image"><div class="photo image__not-available">${icon('Image')}<p class="image__not-available-text">${escape(o.placeholder === true ? 'Bild folgt' : o.placeholder)}</p></div>${overlay}</div>`
    : '';
  // CD: `card--default` is the plain shadow card (with or without image);
  // `card--universal` is the variant whose image is letterboxed (object-contain),
  // so it stays opt-in via o.variant — image-less cards are default, not universal.
  const variant = o.variant || 'default';
  const tag = o.titleTag || 'h3';
  const ext = o.external ? ' target="_blank" rel="noopener external"' : '';
  // Stretched-link pattern (CD/WAI-ARIA APG): the card is a <div>, and its title
  // is a real heading containing an <a> whose ::after makes the whole card
  // clickable. This preserves the document outline AND keeps nested links
  // (badges) valid, with no more <a> inside <a>.
  // `breakable`: long German compounds may break after «/» and «-»; otherwise,
  // for example, «Sicherheits-/Datenschutzvorfall» breaks mid-word (Item 5.8).
  const titleInner = o.href
    ? `<a class="card__link" href="${escape(o.href)}"${ext}>${breakable(o.title)}</a>`
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
  return `<div class="card card--${variant}${o.href ? ' card--clickable' : ''}${o.cls ? ' ' + escape(o.cls) : ''}">${inner}</div>`;
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
function table({ columns, rows, zebra, caption, showCaption, foot, rowsClickable, emptyText }) {
  // Per-column `align: 'right'|'center'|'left'` maps to the CD alignment utility on header + cell.
  const al = (c) => c.align ? ` class="text-${c.align}"` : '';
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
  const colgroup = columns.some((c) => c.width)
    ? `<colgroup>${columns.map((c) => `<col${c.width ? ` style="width:${escape(c.width)}"` : ''}>`).join('')}</colgroup>`
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
  const action = opts.action
    ? (opts.action.href
      ? `<a class="btn btn--outline btn--sm empty__action" href="${escape(opts.action.href)}">${icon('Refresh', 'btn__icon icon--base')}<span class="btn__text">${escape(opts.action.label)}</span></a>`
      : `<button type="button" class="btn btn--outline btn--sm empty__action"${opts.action.id ? ` id="${escape(opts.action.id)}"` : ''}>${icon('Refresh', 'btn__icon icon--base')}<span class="btn__text">${escape(opts.action.label)}</span></button>`)
    : '';
  return (opts.hint || action)
    ? `<div class="empty"><p class="empty__title">${escape(msg)}</p>${
        opts.hint ? `<p class="empty__hint">${opts.hint}</p>` : ''}${action}</div>`
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
function renderNotFound(ctx, {
  thing, title, backHref, backLabel, overview = backLabel, crumbs, body,
} = {}) {
  const { mount, setTitle, setCrumbs } = ctx;
  setTitle(title);
  if (crumbs) setCrumbs([...crumbs, { label: 'Nicht gefunden' }]);
  mount.innerHTML = notFound({ backHref, backLabel, title,
    body: body || `${thing} existiert nicht. <a href="${backHref}">Zur Übersicht «${escape(overview)}»</a>` });
}

// Active-filter pill row (formerly copied in services/applications/catalogue).
// filters = [{ label, href }] — href is the same view without that one filter.
// Two modes with the same appearance (`.active-filters` / `.active-filter`):
// catalogue pages pass an `href` per pill plus `resetHref` (shareable hash
// navigation). JS-state pages (portfolio) pass `remove` instead (one data token
// per pill), turning pills into <button data-remove> and reset into <button
// data-reset>, which the caller wires. `label` overrides the «Aktive Filter:» prefix.
function activeFilters({ filters, resetHref, resetLabel = 'Alle Filter zurücksetzen', label = 'Aktive Filter:' }) {
  if (!filters || !filters.length) return '';
  // One id per pill, or removing one loses focus to <body> (Item 3.3). CD's
  // interactive pill is .tag-item (full 44px height scale + focus ring,
  // tag-item.postcss:7-42); the former 32px badge was below the target size.
  const inner = (f) => `<span class="tag-item__inner"><span class="tag-item__text">${escape(f.label)}</span>${icon('Cancel', 'tag-item__icon')}</span>`;
  const pill = (f, i) => f.href != null
    ? `<a class="tag-item tag-item--sm active-filter" id="af-${i}" href="${escape(f.href)}" aria-label="Filter «${escape(f.label)}» entfernen">${inner(f)}</a>`
    : `<button type="button" class="tag-item tag-item--sm active-filter" id="af-${i}" data-remove="${escape(f.remove == null ? '' : f.remove)}" aria-label="Filter «${escape(f.label)}» entfernen">${inner(f)}</button>`;
  const reset = resetHref != null
    ? `<a class="btn btn--link" href="${escape(resetHref)}"><span class="btn__text">${escape(resetLabel)}</span></a>`
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

// Announce into the persistent live region (#live in index.html) for result-count,
// view, and page changes that would otherwise be silent (WCAG 4.1.3). Mutate
// text only; never recreate the node, or aria-live will not fire.
export function announce(msg) {
  const n = document.getElementById('live');
  if (n) n.textContent = msg;
}

// Replace `mount.innerHTML` and restore focus + cursor position when the active
// element has an id. A full innerHTML replacement otherwise drops
// document.activeElement back to <body>: in the booking form, each selection
// lost BOTH focus and caret, and Tab restarted at the page header (WCAG 2.4.3 /
// 3.2.2). Returns true when focus was restored. Capture focus + caret and return
// a function that restores both after rebuilding. This is a pair (not
// rerender(mount, html)) because draw() functions write multiline template
// literals with nested backticks, and focus then also survives rewiring in wire():
//     const restore = C.preserveFocus(mount);
//     mount.innerHTML = `…`;  wire();  restore();
function preserveFocus(mount) {
  const a = document.activeElement;
  const id = a && mount.contains(a) ? a.id : '';
  const sel = a && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null;
  return () => {
    if (!id) return false;
    const el = mount.querySelector('#' + CSS.escape(id));
    if (!el) return false;
    el.focus({ preventScroll: true });
    if (sel && el.setSelectionRange) { try { el.setSelectionRange(sel[0], sel[1]); } catch { /* Not supported by every field type. */ } }
    return true;
  };
}


// Make `tabindex` on scroll regions conditional on real overflow. An unconditional
// tabindex="0" creates a dead tab stop on wide viewports; `.table-wrapper` used
// to add it unconditionally, while this measures it. The region is also
// announced as a group only when it truly scrolls (Item 3.21).
const SCROLL_SEL = '[data-scroll-region], .table-wrapper, pre.api-code';
function wireScrollRegions(root) {
  const scan = () => {
    root.querySelectorAll(SCROLL_SEL).forEach((el) => {
      const scrolls = el.scrollWidth > el.clientWidth + 1;
      el.classList.toggle('is-scrollable', scrolls);
      if (scrolls) {
        el.setAttribute('tabindex', '0');
        // An UNNAMED region/group is worse for assistive technology than none: it
        // appears as an anonymous node in the landmark/group tree. Only elements
        // that provide a name are declared as named groups.
        const named = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        if (named && !el.hasAttribute('role')) el.setAttribute('role', 'group');
        if (!named) el.removeAttribute('role');
      } else {
        el.removeAttribute('tabindex');
        el.removeAttribute('role');
      }
    });
  };
  scan();
  // Two triggers: width changes (overflow appears/disappears) AND rerenders
  // (mountDataTable, renderMain, and tab changes replace entire subtrees; new
  // wrappers were otherwise never discovered and remained without tabindex).
  let pending = 0;
  const queue = () => { if (pending) return; pending = requestAnimationFrame(() => { pending = 0; scan(); }); };
  const mo = typeof MutationObserver === 'function' ? new MutationObserver(queue) : null;
  if (mo) mo.observe(root, { childList: true, subtree: true });
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(queue) : null;
  if (ro) ro.observe(root);
  return () => {
    if (pending) cancelAnimationFrame(pending);
    if (mo) mo.disconnect();
    if (ro) ro.disconnect();
  };
}

// Focus trap for modal overlays (lightbox, full-screen chart, document preview):
// Tab/Shift+Tab stay within `container`. Returns an unsubscribe function. Shared
// through C.trapFocus so overlays with their own keyboard logic (gallery,
// document viewer) trap identically. Three divergent copies of this list had
// produced an escape from the trap (WCAG 2.4.3 / 2.1.2; review lb-trap-1).
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function trapFocus(container) {
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const f = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

// Overlays can be nested (for example, the share dialog above the gallery).
// A boolean body class cannot represent that ownership: closing the topmost
// dialog used to unlock scrolling while the gallery underneath was still open.
// Give every overlay its own token and remove the class only after the last
// owner releases it.
const overlayLocks = new Set();
const overlayClosers = new Set();
function syncOverlayLock() {
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('body--overlay-open', overlayLocks.size > 0);
  }
}
function acquireOverlayLock() {
  const token = {};
  overlayLocks.add(token);
  syncOverlayLock();
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    overlayLocks.delete(token);
    syncOverlayLock();
  };
}

// Route-owned content may open a viewer long after render() has returned, so
// its close function cannot be known to ctx.onUnmount up front. The router uses
// this small registry to close all currently open overlays before replacing the
// route. Registration and closing are both idempotent.
function registerOverlay(close) {
  if (typeof close !== 'function') return () => {};
  overlayClosers.add(close);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    overlayClosers.delete(close);
  };
}
function closeOverlays() {
  // Close topmost/most recently opened first. Work on a snapshot because every
  // close removes itself from the registry.
  [...overlayClosers].reverse().forEach((close) => {
    try { close(); } catch (e) { console.warn('[overlay] cleanup failed', e); }
  });
}

// Canonical modal (CD modal.postcss BEM). `modal()` supplies markup; `openModal()`
// appends it to document.body, traps focus, closes on Escape / backdrop click /
// [data-modal-close], and restores focus. Primitive for new dialogs; `body` and
// `footer` are RAW HTML (caller escapes). `size` = sm|md|lg|xl.
function modal({ title = '', body = '', footer = '', size = 'md', id = 'modal' } = {}) {
  const titleId = `${id}-title`, bodyId = `${id}-desc`;
  // Accessible name «Dialog schliessen». This family names context everywhere
  // («Galerie schliessen», «Vorschau schliessen», «Hinweis schliessen»); modal
  // was the only bare «Schliessen» (design review D15).
  const closeBtn = `<button type="button" class="modal__close" data-modal-close aria-label="Dialog schliessen">${icon('Cancel', 'icon--2xl')}</button>`;
  // CD Modal.vue:2-27: aria-modal on the wrapper; role="dialog" plus
  // aria-labelledby and aria-describedby on .modal__content; the body carries
  // the referenced id. The header ALWAYS exists (without it, the flex column
  // stretched the close button to full width); `--with-title` changes only
  // distribution.
  return `<div class="modal modal--${size}" aria-modal="true">
    <div class="modal__backdrop" data-modal-close></div>
    <div class="modal__content" role="dialog"${title ? ` aria-labelledby="${escape(titleId)}"` : ''} aria-describedby="${escape(bodyId)}">
      <div class="modal__header${title ? ' modal__header--with-title' : ''}">${title ? `<h2 class="modal__title" id="${escape(titleId)}">${escape(title)}</h2>` : ''}${closeBtn}</div>
      <div class="modal__body" id="${escape(bodyId)}">${body}</div>
      ${footer ? `<div class="modal__footer">${footer}</div>` : ''}
    </div>
  </div>`;
}
function openModal(opts = {}) {
  const trigger = document.activeElement;
  const host = document.createElement('div');
  host.innerHTML = modal(opts);
  const el = host.firstElementChild;
  document.body.appendChild(el);
  const releaseOverlayLock = acquireOverlayLock();
  const untrap = trapFocus(el);
  let closed = false;
  let unregisterOverlay = () => {};
  const close = () => {
    if (closed) return;
    closed = true;
    unregisterOverlay();
    document.removeEventListener('keydown', onKey, true);
    untrap(); el.remove(); releaseOverlayLock();
    if (trigger && trigger.focus) trigger.focus();
  };
  // stopPropagation, not just preventDefault: a modal is modal. Otherwise the
  // same Escape reached the gallery underneath and closed BOTH at once. The
  // modal listener runs first in capture phase, so a simple «is a modal above?»
  // guard was ineffective.
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault(); e.stopPropagation();
    close();
  };
  unregisterOverlay = registerOverlay(close);
  el.addEventListener('click', (e) => { if (e.target.closest('[data-modal-close]')) close(); });
  document.addEventListener('keydown', onKey, true);
  const first = el.querySelector('.modal__close'); if (first) first.focus();
  return close;
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
function cardAction({ external = false } = {}) {
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
function domainTile({ icon: ic, title, desc, meta = '', href, external = false, titleTag = 'h3' }) {
  const ext = external ? ' target="_blank" rel="noopener external"' : '';
  // Same stretched-link pattern as card(): the card is a <div>, and the title's
  // <a> covers it through ::after. In CD, the card root is ALWAYS a div
  // (Card.vue:2-39). The former whole-card <a> gave screen readers title +
  // description + metadata as one long link name.
  return `<div class="card card--default card--clickable">
    <div class="card__content">
      <div class="card__body">
        <span class="domain-tile__icon">${icon(ic, 'icon--2xl')}</span>
        <${titleTag} class="card__title"><a class="card__link" href="${escape(href)}"${ext}>${escape(title)}</a></${titleTag}>
        <p class="card__description">${escape(desc)}</p>
      </div>
      ${cardFooter(escape(meta), { external })}
    </div>
  </div>`;
}

// Share bar (share-bar.postcss) after the breadcrumb on detail pages: print and
// copy link. Right-aligned (flex-row-reverse), as in CD.
function shareBar() {
  // CD: icons only (aria-label), no visible labels, large icons (ShareBar.vue,
  // SvgIcon size="xl"). The share button opens the CD dialog (openShareModal).
  // It previously copied silently to the clipboard, with no feedback, visible
  // URL, or fallback when the Clipboard API was blocked.
  return `<div class="share-bar">
    <div class="share-container">
      <button class="btn btn--bare share-bar__btn" type="button" onclick="window.print()" aria-label="Seite drucken" title="Drucken">${icon('Printer', 'icon--xl')}</button>
      <button class="btn btn--bare share-bar__btn share-bar__share-button" type="button" data-share
        aria-label="Inhalt teilen" title="Teilen">${icon('Share', 'icon--xl')}</button>
    </div>
  </div>`;
}

// «Inhalt teilen» — CD pattern (detailPageSimple.vue:810-866): an xs modal with
// a READ-ONLY input showing the URL, followed by `.share-url` containing the
// copy button and a live region that reports success. CD's template also lists
// social networks above it (Facebook/X/LinkedIn/Xing/WhatsApp); omit them because
// an internal federal portal does not share content on commercial platforms.
//
// Why show a field rather than only «copied»: the Clipboard API requires a secure
// context and may be blocked. With the URL visible in the field, it can still be
// selected manually, so the function never fails completely.
function shareUrlBlock(url, { id = 'share-url-input' } = {}) {
  return `<div class="pt-3">
    <label class="sr-only" for="${escape(id)}">Link zu diesem Inhalt</label>
    <input id="${escape(id)}" class="input--outline input--base" type="text" readonly
      value="${escape(url)}" data-share-url>
    <div class="share-url">
      ${/* CD detailPageSimple.vue:847-853: label-only button (outline, mt-3). The
            template has NO link icon on the copy button. */''}
      ${/* «Link kopieren», matching the five menu entries and «Link kopiert.»
            toast. CD's demo says «URL Kopieren» (detailPageSimple.vue:850), whose
            internal capitalisation is not standard German. This deliberate
            deviation is documented in docs/design-review.md. */''}
      <button type="button" class="btn btn--outline mt-3" data-share-copy>
        <span class="btn__text">Link kopieren</span></button>
      <div aria-live="polite" data-share-done></div>
    </div>
  </div>`;
}

function openShareModal(url = location.href, title = 'Inhalt teilen') {
  // CD places content in a white .card (detailPageSimple.vue:817); the header
  // sits above it in white on the scrim.
  const close = openModal({ title, size: 'xs',
    body: `<div class="card card--default"><div class="card__content"><div class="card__body">${shareUrlBlock(url)}</div></div></div>` });
  const root = document.querySelector('.modal--xs') || document;
  const input = root.querySelector('[data-share-url]');
  const btn = root.querySelector('[data-share-copy]');
  const done = root.querySelector('[data-share-done]');
  if (input) { input.focus(); input.select(); }
  if (btn) btn.addEventListener('click', () => {
    // Badge anatomy as in CD (Badge.vue:11-12): badge__icon-left before badge__text.
    const ok = () => { if (done) done.innerHTML = `<span class="badge badge--success badge--sm mt-3">${icon('Checkmark', 'badge__icon-left')}<span class="badge__text">Link kopiert</span></span>`; };
    const fail = () => { if (done) done.innerHTML = `<span class="badge badge--warning badge--sm mt-3">${icon('WarningCircle', 'badge__icon-left')}<span class="badge__text">Kopieren nicht möglich — bitte von Hand markieren</span></span>`; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok, fail);
    } else if (input) {
      // Fallback without the Clipboard API.
      try { input.select(); document.execCommand('copy'); ok(); } catch { fail(); }
    } else fail();
  });
  return close;
}

// Clicking a share button opens the dialog. Wire once globally so every page
// with a share bar gets it without additional setup.
export function wireShare(root = document) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-share]');
    if (!b) return;
    e.preventDefault();
    openShareModal(b.dataset.share || location.href);
  });
}

// Detail-page top bar: back link on the left, share bar on the right, in ONE row
// (CD: .back-bar + .share-bar at the same height after the breadcrumb).
function detailBar({ backHref, backLabel } = {}) {
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
function heroFigure({ src, id, color = 'var(--color-secondary-600)', alt = '', w = 800, ratio = '' } = {}) {
  if (!src && !id) return '';
  const ratioClass = { '16x9': 'photo--16x9', '4x3': 'photo--4x3', '21x9': 'photo--21x9' }[ratio]
    || 'hero-media hero-media--natural';
  return `<figure class="hero__figure">${photo({ src, id, color, alt, w, cls: ratioClass })}</figure>`;
}

function detailHead({ backHref, backLabel, title, lead = '', tags = '', image = '' } = {}) {
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

// Horizontal status stepper (CD steps / tenant-portal pipeline): chevron segments
// — done (green, check) · current (primary colour, clock) · open (grey). `steps`
// = [{ label }]; `currentIndex` is the current step index. Scrolls horizontally
// on mobile.
function pipeline(steps, currentIndex = 0, { label = 'Statusverlauf' } = {}) {
  const seg = (st, i) => {
    const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'todo';
    const glyph = state === 'done' ? icon('Checkmark', 'icon--sm pipeline__glyph')
      : state === 'active' ? icon('Clock', 'icon--sm pipeline__glyph') : '';
    const sr = state === 'done' ? '<span class="sr-only">Erledigt: </span>'
      : state === 'active' ? '<span class="sr-only">Aktueller Schritt: </span>' : '';
    return `<li class="pipeline__step pipeline__step--${state}"${state === 'active' ? ' aria-current="step"' : ''}>${glyph}<span>${sr}${escape(st.label)}</span></li>`;
  };
  // Move aria-label to the wrapper so <ol> remains a pure list and retains list
  // semantics. No more `data-scroll-region`: the strip wraps instead of
  // scrolling, so there is no scroll surface requiring keyboard access.
  return `<div class="pipeline-wrap" role="group" aria-label="${escape(label)}">`
    + `<ol class="pipeline">${steps.map(seg).join('')}</ol></div>`;
}


// Detail-page section: title + content. `body` is ready HTML. `titleTag` works as
// in pageSection. Inside tabs, the section sits below an h2 and needs an h3; two
// callers previously copied all markup by hand for this (design review, pages).
function detailSection({ title, body = '', titleTag = 'h2' }) {
  return `<section class="detail-section">
      <${titleTag} class="detail-section__title">${escape(title)}</${titleTag}>
      ${body}
    </section>`;
}

// CD accordion (accordion.postcss): ul > li > h3 > button (.accordion__title +
// optional .accordion__meta + .accordion__arrow) + .accordion__drawer >
// .accordion__content. `items` = [{ title, meta?, body, open? }]; `title` is
// escaped, while `meta`/`body` are ready HTML. Wired through wireAccordion().
function accordion(items, { id = 'acc' } = {}) {
  const li = ({ title, meta = '', body = '', open = false }, i) => {
    const bid = `${id}-b-${i}`, pid = `${id}-p-${i}`;
    return `<li class="accordion__item">
      <h3 class="accordion__heading">
        <button class="accordion__button" type="button" id="${bid}" aria-expanded="${open}" aria-controls="${pid}">
          <span class="accordion__title">${escape(title)}</span>
          <span class="accordion__meta">${meta}${icon('ChevronDown', 'icon--xl accordion__arrow')}</span>
        </button>
      </h3>
      <div class="accordion__drawer" id="${pid}" role="region" aria-labelledby="${bid}"${open ? '' : ' hidden'}>
        <div class="accordion__content">${body}</div>
      </div>
    </li>`;
  };
  return `<ul class="accordion" id="${id}-acc">${items.map(li).join('')}</ul>`;
}

// Click wiring for one or more accordions in `root` (aria-expanded + show/hide
// drawer). Replaces toggle logic copied per page.
function wireAccordion(root) {
  root.querySelectorAll('.accordion__button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      const drawer = root.querySelector('#' + CSS.escape(btn.getAttribute('aria-controls')));
      if (!drawer) return;
      // CD Accordion.js:27-43: animate max-height (300ms ease-out on
      // .accordion__drawer). Apply [hidden] only after `transitionend` so
      // measurement and transition work. `_accSeq` invalidates the completion
      // handler if a quick counter-click reverses direction. With reduced motion,
      // duration is ~0 (tokens.css), but transitionend still fires.
      const seq = (drawer._accSeq = (drawer._accSeq || 0) + 1);
      const done = (fn) => {
        const te = (e) => {
          if (e.propertyName !== 'max-height') return;
          drawer.removeEventListener('transitionend', te);
          if (drawer._accSeq === seq) fn();
        };
        drawer.addEventListener('transitionend', te);
      };
      if (open) {
        drawer.style.maxHeight = drawer.scrollHeight + 'px';
        requestAnimationFrame(() => { drawer.style.maxHeight = '0px'; });
        done(() => { drawer.hidden = true; drawer.style.maxHeight = ''; });
      } else {
        drawer.hidden = false;
        drawer.style.maxHeight = '0px';
        requestAnimationFrame(() => { drawer.style.maxHeight = drawer.scrollHeight + 'px'; });
        done(() => { drawer.style.maxHeight = ''; });
      }
    });
  });
}

// --- Tabs (tab.postcss) ------------------------------------------------------
// One APG tabs implementation (roving tabindex, click + arrow/Home/End) instead
// of five slightly divergent copies, one without keyboard support (projects).
// `items` = [{ id, label, icon? }]; `id` is a developer slug that also serves as
// selector/ARIA target and is therefore not escaped; `label` is escaped.
//
// tabBar renders only the tab bar. `panelId` links ALL tabs to ONE shared panel
// (single-panel/rerender pattern, for example data portal). Without `panelId`,
// each tab points to its own `${idPrefix}-panel-${id}` (multi-panel pattern; see
// tabPanels).
function tabBar({ items, active, idPrefix = 'tab', ariaLabel = '', panelId = '', controlsClass = '' } = {}) {
  const btns = items.map((t) => {
    const on = t.id === active;
    const controls = panelId || `${idPrefix}-panel-${t.id}`;
    return `<button type="button" role="tab" id="${idPrefix}-${t.id}" aria-controls="${controls}"`
      + ` class="tab__control${on ? ' tab__control--active' : ''}" aria-selected="${on}"`
      + ` tabindex="${on ? '0' : '-1'}" data-tab="${t.id}">`
      + `${t.icon ? icon(t.icon, 'icon--base') + ' ' : ''}${escape(t.label)}</button>`;
  }).join('');
  return `<div class="tab__controls-container"><div class="tab__controls${controlsClass ? ' ' + controlsClass : ''}"`
    + ` role="tablist"${ariaLabel ? ` aria-label="${escape(ariaLabel)}"` : ''}>${btns}</div></div>`;
}

// Multi-panel markup (Pattern A): one .tab__container per tab, inactive ones
// `hidden`. `render(id)` returns ready panel HTML. For the single-panel pattern,
// the caller supplies its own panel and lets wireTabs rerender content.
// `heading: true` prefixes every panel with an sr-only <h2> using the tab label.
// `aria-labelledby` names the panel once focus is inside it. For heading
// navigation (WCAG 2.4.10), tab-only pages previously had no level between <h1>
// and the <h3> elements in panel content.
function tabPanels({ items, active, idPrefix = 'tab', render, heading = false }) {
  return items.map((t) =>
    `<div class="tab__container" role="tabpanel" id="${idPrefix}-panel-${t.id}"`
    + ` aria-labelledby="${idPrefix}-${t.id}" tabindex="0" data-panel="${t.id}"`
    + `${t.id === active ? '' : ' hidden'}>`
    + `${heading ? `<h2 class="sr-only">${escape(t.label || t.id)}</h2>` : ''}`
    + `${render(t.id)}</div>`).join('');
}

// Wire tab bars in `root`: click + arrow keys/Home/End, roving tabindex, and
// aria-selected. Existing [data-panel] panels switch automatically (Pattern A);
// `onSelect(id)` renders content for single-panel/rerender use (Pattern B).
// `syncHash(id)` optionally mirrors the tab into the hash query. Focus is set by
// querying again after `onSelect`, so it survives a rerender.
function wireTabs(root, { onSelect, syncHash } = {}) {
  const btns = [...root.querySelectorAll('.tab__control')];
  const panels = [...root.querySelectorAll('[data-panel]')];
  const single = root.querySelectorAll('[role="tabpanel"]');
  const activate = (id) => {
    let activeBtn = null;
    btns.forEach((b) => {
      const on = b.dataset.tab === id;
      if (on) activeBtn = b;
      b.classList.toggle('tab__control--active', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => { p.hidden = p.dataset.panel !== id; });
    if (single.length === 1 && activeBtn) single[0].setAttribute('aria-labelledby', activeBtn.id);
    if (onSelect) onSelect(id);
    if (syncHash) syncHash(id);
    // Query again for focus so it survives an onSelect rerender. It stays
    // invisible for mouse clicks (:focus-visible applies only for keyboard),
    // and correct for keyboard roving. No-op when the bar remains unchanged.
    (root.querySelector(`.tab__control[data-tab="${id}"]`) || activeBtn)?.focus();
  };
  btns.forEach((btn, i) => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
    btn.addEventListener('keydown', (e) => {
      let ni = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ni = (i + 1) % btns.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ni = (i - 1 + btns.length) % btns.length;
      else if (e.key === 'Home') ni = 0;
      else if (e.key === 'End') ni = btns.length - 1;
      if (ni !== null) { e.preventDefault(); activate(btns[ni].dataset.tab); }
    });
  });
  // A tab deep-linked through `?tab=` may sit outside the viewport in a scrolling
  // bar, making the bar appear to have no active tab (Item 3.18). `nearest`
  // scrolls only when necessary.
  const cur = root.querySelector('.tab__control--active');
  if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return { activate };
}

// --- Notifications (notification.postcss) ------------------------------------
// One delegated wiring for every notification close button. House rule: no
// inline onclick (see menu()). Announcement through the persistent #live region
// matches mountBanner («Hinweis geschlossen.»); CD Notification.vue also binds
// the handler programmatically.
let notifCloseWired = false;
function ensureNotificationClose() {
  if (notifCloseWired || typeof document === 'undefined') return;
  notifCloseWired = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('[data-notification-close]');
    if (!btn) return;
    const n = btn.closest('.notification');
    if (!n) return;
    n.remove();
    announce('Hinweis geschlossen.');
  });
}

// variant: info | success | warning | error | hint | alert
export function notification(text, variant = 'info', iconName = 'InfoCircle', opts = {}) {
  // `live: true` ONLY for messages arriving as the result of an action. Every
  // notification previously carried a live role, including static notices
  // already present at load. Screen readers then read the page as a sequence of
  // status messages, and aria-live does not fire in a newly created region
  // anyway (Item 3.9).
  const role = opts.live ? ((variant === 'error' || variant === 'alert') ? 'alert' : 'status') : '';
  if (opts.dismissible) ensureNotificationClose();
  const close = opts.dismissible
    ? `<button type="button" class="notification__close interactive-control" aria-label="Hinweis schliessen" data-notification-close>${icon('Cancel', 'icon--md')}</button>`
    : '';
  const cls = `notification notification--${variant}${opts.dismissible ? ' notification--dismissible' : ''}`;
  return `<div class="${cls}"${role ? ` role="${role}"` : ''}>${icon(iconName, 'notification__icon')}<div class="notification__content">${text}</div>${close}</div>`;
}

// Completion state for a submitted case. Four form apps hand-built it: success
// message with reference, thank-you heading, explanatory sentence, and action
// row. They diverged exactly where it matters: space-request wrote its own
// `<div class="notification notification--success">` and lost
// `.notification__content`, the text-width constraint. workspace uses an h2
// (correct because the page already has an h1), while the others use h1. Buttons
// were `btn--outline` three times and `btn--filled` once.
//
//   lead     sentence in the success message («Antrag eingereicht.»)
//   title    heading; use `heading:'h2'` where the page already has an h1
//   text     explanatory sentence below
//   extra    optional HTML block between them (attribute list, extra notice)
//   actions  [{ href | id, label, variant, icon }] — first action filled
function processDone({ instance, lead, title, heading = 'h1', text,
  extra = '', actions = [] } = {}) {
  const button = (a, i) => {
    const cls = `btn btn--${a.variant || (i === 0 ? 'filled' : 'outline')}${a.icon ? ' btn--icon-right' : ''}`;
    const content = `${a.icon ? icon(a.icon, 'btn__icon') : ''}<span class="btn__text">${escape(a.label)}</span>`;
    return a.href
      ? `<a class="${cls}" href="${escape(a.href)}">${content}</a>`
      : `<button class="${cls}" type="button" id="${escape(a.id)}">${content}</button>`;
  };
  return `
    ${notification(`<strong>${escape(lead)}</strong> Ihre Referenz: <strong>${escape(instance.reference)}</strong>`,
      'success', 'CheckmarkCircle')}
    <${heading} tabindex="-1" class="mt-6">${escape(title)}</${heading}>
    <p class="lead">${text}</p>
    ${extra}
    ${actions.length ? `<div class="row mt-6">${actions.map(button).join('')}</div>` : ''}`;
}

// CD step-indicator.postcss:5-24 / StepIndicator.vue:2-9 — ONE numbered step
// indicator instead of two hand-rolled copies in space-request and transaction
// (Item 3.10). Supplies CD's `.step__indicator` wrapper, which the union selectors
// from Item 1.17d/2.3 already support.
function stepIndicator(labels, current = 0, { label = 'Fortschritt' } = {}) {
  const li = (l, i) => {
    const done = i < current, active = i === current;
    const mod = done ? ' step__indicator-step--confirmed' : active ? ' step__indicator-step--active' : '';
    const sr = done ? 'Erledigt: ' : active ? 'Aktueller Schritt: ' : 'Offen: ';
    return `<li class="step__indicator"${active ? ' aria-current="step"' : ''}>`
      + `<span class="step__indicator-step${mod}">${done ? icon('CheckmarkBold', 'icon--sm') : i + 1}</span>`
      + `<span><span class="sr-only">${sr}Schritt ${i + 1} von ${labels.length}: </span>${escape(l)}</span></li>`;
  };
  return `<ol class="steps" aria-label="${escape(label)}">${labels.map(li).join('')}</ol>`;
}

// Display and announce an error at the top of the page for client-side action
// failures (for example, localStorage persistence failed; code review C1).
function flashError(mount, msg) {
  announce(msg);
  const host = mount && mount.querySelector('.container');
  if (host) host.insertAdjacentHTML('afterbegin', notification(escape(msg), 'error', 'WarningCircle'));
}

// CD back button. Anatomy copied from the design system's own detail pages
// (app/pages/detailPressRelease.vue, detailPublicationCatalog.vue):
//   <Btn variant="outline" size="sm" icon="ArrowLeft" iconPos="left"
//        class="btn--back" />
// The visible label is always the back action; `label` names its target for
// screen readers. `.back-link-row` clears the CD float.
function backLink(href, label) {
  return `<div class="back-link-row"><a class="btn btn--outline btn--sm btn--icon-left btn--back" href="${escape(href)}"${
    label ? ` aria-label="Zurück zu ${escape(label)}"` : ''}>${
    icon('ArrowLeft', 'btn__icon')}<span class="btn__text">Zurück</span></a></div>`;
}

// --- Forms (form.postcss + input.postcss + select.postcss) -------------------
// CD select: label + .select wrapper + native <select> + .select__icon chevron.
export function select(o = {}) {
  const id = o.id;
  const size = o.size || 'base';
  const variant = o.variant || 'outline';
  const msgType = o.messageType || 'error';
  const isError = Boolean(o.message) && msgType === 'error';
  const hintId = o.hint ? `${id}-hint` : '';
  const msgId = o.message ? `${id}-msg` : '';
  const described = [hintId, msgId, o.describedBy].filter(Boolean).join(' ');

  const ctrl = [`input--${variant}`, `input--${size}`];
  if (isError) ctrl.push('input--error');

  const lbl = [];
  if (variant === 'negative') lbl.push('text--negative');
  if (o.hideLabel) lbl.push('sr-only');
  if (o.required) lbl.push('text--asterisk');

  const opts = (o.options || []).map((x) => {
    const v = (x && typeof x === 'object') ? x.value : x;
    // Option key is consistently `label`. Only fault-report still consumed the
    // former secondary `text` path, and it has been migrated (review B14).
    const t = (x && typeof x === 'object') ? x.label : x;
    const sel = String(v) === String(o.value == null ? '' : o.value) ? ' selected' : '';
    const dis = (x && typeof x === 'object' && x.disabled) ? ' disabled' : '';
    return `<option value="${escape(v)}"${sel}${dis}>${escape(t)}</option>`;
  }).join('');

  return `<div class="form__group__select${o.wrapClass ? ' ' + o.wrapClass : ''}">
  ${o.label ? `<label for="${escape(id)}"${lbl.length ? ` class="${lbl.join(' ')}"` : ''}>${escape(o.label)}${
      o.required ? '<span class="sr-only"> Pflichtfeld</span>' : ''}</label>` : ''}
  ${o.hint ? `<p class="form__group__hint" id="${escape(hintId)}">${escape(o.hint)}</p>` : ''}
  <div class="select${o.bare ? ' select--bare' : ''}">
    <select id="${escape(id)}" name="${escape(o.name || id)}" class="${ctrl.join(' ')}"${
      o.required ? ' required aria-required="true"' : ''}${
      o.disabled ? ' disabled' : ''}${
      isError ? ' aria-invalid="true"' : ''}${
      described ? ` aria-describedby="${escape(described)}"` : ''}${o.attrs ? ' ' + o.attrs : ''}>${opts}</select>
    <div class="select__icon">${CHEVRON_SVG}</div>
  </div>
  ${/* NO live role on the field message: every form page renders one errorSummary
        (role="alert") as its ONE status message (WCAG 4.1.3). A role on the field
        announced the same error two or three times. CD Input.vue likewise gives
        the message no live role; aria-describedby still reads it with the field.
        The former `quiet` parameter had zero callers and was removed (design
        review B9). */''}
  ${o.message ? `<div class="badge badge--sm badge--${escape(msgType)}" id="${escape(msgId)}">${escape(o.message)}</div>` : ''}
</div>`;
}


// Error summary at the form header (WCAG 3.3.1/3.3.3). Previously only field
// messages existed. After a failed submission of a multi-page government form,
// the user must see in one place WHAT needs correction and be able to jump there.
// `errors` is keyed by DOM id so anchors resolve; `labels` supplies plain names.
function errorSummary({ errors = {}, labels = {}, id = 'err-summary' } = {}) {
  const ids = Object.keys(errors);
  if (!ids.length) return '';
  const items = ids.map((k) => `<li><a href="#${escape(k)}" data-err-link="${escape(k)}">${
    escape(labels[k] || k)}: ${escape(errors[k])}</a></li>`).join('');
  return `<div class="notification notification--error error-summary" id="${escape(id)}" role="alert">
    ${icon('WarningCircle', 'notification__icon')}
    <div class="notification__content">
      <h2 class="error-summary__title" tabindex="-1">${ids.length === 1
        ? 'Ein Feld muss noch korrigiert werden'
        : `${ids.length} Felder müssen noch korrigiert werden`}</h2>
      <ul class="error-summary__list">${items}</ul>
    </div></div>`;
}

// CD select wrapper: `<select>` plus an overlaid chevron. `CHEVRON_SVG` is the
// module constant above. The former `chevron` export merely aliased it and had
// no callers.
function selectBox(inner, extraCls = '', style = '') {
  return `<div class="select${extraCls ? ' ' + extraCls : ''}"${style ? ` style="${style}"` : ''}>${inner}<div class="select__icon">${CHEVRON_SVG}</div></div>`;
}

// Wire error-summary anchors and focus its heading; otherwise focus lands on
// <body> after an unsuccessful attempt.
function wireErrorSummary(mount, { focus = true } = {}) {
  mount.querySelectorAll('[data-err-link]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const t = mount.querySelector('#' + CSS.escape(a.dataset.errLink));
    if (t) { t.focus(); t.scrollIntoView({ block: 'center', behavior: 'auto' }); }
  }));
  if (!focus) return false;
  const h = mount.querySelector('.error-summary__title');
  if (h) { h.focus({ preventScroll: false }); return true; }
  return false;
}

// CD field wrapper for input/textarea. `control` receives (classes, attributes)
// so required/aria-describedby/aria-invalid land on the control itself.
function field(o = {}) {
  const id = o.id;
  const msgType = o.messageType || 'error';
  const isError = Boolean(o.message) && msgType === 'error';
  const hintId = o.hint ? `${id}-hint` : '';
  const msgId = o.message ? `${id}-msg` : '';
  const described = [hintId, msgId].filter(Boolean).join(' ');
  const lblCls = [o.required ? 'text--asterisk' : '', o.hideLabel ? 'sr-only' : ''].filter(Boolean).join(' ');
  const lbl = lblCls ? ` class="${lblCls}"` : '';
  // `name` was missing throughout (a field without name is invisible to autofill
  // and any real backend). `autocomplete`/`inputmode` control the mobile keyboard
  // and suggestions (Item 3.11).
  const attrs = ` name="${escape(o.name || id)}"`
    + `${o.required ? ' required aria-required="true"' : ''}`
    + `${o.autocomplete ? ` autocomplete="${escape(o.autocomplete)}"` : ''}`
    + `${o.inputmode ? ` inputmode="${escape(o.inputmode)}"` : ''}`
    + `${isError ? ' aria-invalid="true"' : ''}`
    + `${described ? ` aria-describedby="${escape(described)}"` : ''}`;
  const cls = `input--outline input--base${isError ? ' input--error' : ''}`;
  // The hint appears BEFORE the field (needed while completing it, not after) and
  // is a paragraph rather than a pill. Only the error message remains a badge
  // with role="alert". Previously both looked alike and the hint appeared below
  // the field (Item 3.12).
  return `<div class="form__group__input">
    <label for="${escape(id)}"${lbl}>${escape(o.label)}${o.required ? '<span class="sr-only"> Pflichtfeld</span>' : ''}</label>
    ${o.hint ? `<p class="form__group__hint" id="${escape(hintId)}">${escape(o.hint)}</p>` : ''}
    ${o.control(cls, attrs)}
    ${/* No live role. As with select(), errorSummary is the single status
          message (WCAG 4.1.3, design review B9). */''}
    ${o.message ? `<div class="badge badge--sm badge--${escape(msgType)}" id="${escape(msgId)}">${escape(o.message)}</div>` : ''}
  </div>`;
}

// Read a form value from `mount` (replaces three copied local val() functions);
// return '' when the field is absent.
function val(mount, id) { const el = mount.querySelector('#' + id); return el ? el.value : ''; }

// Read several fields into an object. `map` = { targetKey: fieldId }. Missing
// fields return ''; callers handle coercion (numbers) and `|| fallback` logic.
// Typical: Object.assign(state, C.readForm(mount, { buildingId: 'bld', 'ort': 'ort' })).
function readForm(mount, map) {
  const out = {};
  for (const [key, id] of Object.entries(map)) out[key] = val(mount, id);
  return out;
}

// --- Download items (download-item.postcss) ----------------------------------
// One CD download-item row for every case (document, app entry, resource,
// attachment). `external` identifies another system; independently, `newWindow`
// can open a portal-internal app entry in a new tab. `#` degrades to a disabled
// substitute. `note`/`desc` are interchangeable (data objects carry `desc`, app
// entries `note`); `icon` overrides the default symbol. `wrapLi` wraps the row in
// `<li>` for `.download-items`.
function downloadItem({ href, title, note = '', desc = '', meta = [], icon: iconName,
  external = false, newWindow = false, heading = 'h3', wrapLi = false, download = false } = {}) {
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
  const real = href && href !== '#';
  const attrs = opensNewWindow
    ? ` target="_blank" rel="${external ? 'noopener external' : 'noopener'}"`
    : (download ? ' download' : '');
  const el = real
    ? `<a class="download-item" href="${escape(href)}"${attrs}>${inner}</a>`
    : `<span class="download-item" aria-disabled="true" title="Im Prototyp nicht verfügbar">${inner}
       <span class="sr-only">(im Prototyp nicht verfügbar)</span></span>`;
  return wrapLi ? `<li>${el}</li>` : el;
}

// CD contact box (.box): name/role/email (mailto)/phone, all escaped. Replaces
// contact markup copied per page and closes unescaped mailto sites (code review B4).
function contactBox(contact, { title = 'Kontakt', heading = 'h3' } = {}) {
  if (!contact) return '';
  // SAME anatomy as contactCard (dl.kv--stack). Detail-page contact slots used
  // two typographies for the same purpose: line list here, labelled key-value
  // rows there (design review B22). dt = role; `unit` = directorate according to
  // the BBL organisation chart («Portfoliomanagement» says little, while
  // «Direktionsbereich Bauten — Portfoliomanagement» provides context).
  const dd = [
    contact.name ? `<strong>${escape(contact.name)}</strong>` : '',
    contact.unit ? escape(contact.unit) : '',
    contact.email ? `<a href="mailto:${escape(contact.email)}">${escape(contact.email)}</a>` : '',
    contact.phone ? escape(contact.phone) : '',
  ].filter(Boolean);
  return `<div class="box"><${heading}>${escape(title)}</${heading}>
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
  if (type === 'link' && !item.href) type = 'disabled';

  const description = item.description || '';
  const content = `<span class="fp-svc__content"><span class="fp-svc__label">${escape(item.label)}</span>${
    description ? `<small class="fp-svc__description">${escape(description)}</small>` : ''}</span>`;
  const fallbackIcon = type === 'disabled' || item.disabled ? 'Lock' : item.newWindow ? 'External' : 'ArrowRight';
  const iconName = ACTION_ICON.test(String(item.icon || '')) ? item.icon : fallbackIcon;
  const rowIcon = icon(iconName, 'icon--sm fp-svc__go');
  const id = item.id != null && item.id !== '' ? ` id="${escape(item.id)}"` : '';

  if (type === 'link') {
    const externalWindow = item.newWindow ? ' target="_blank" rel="noopener"' : '';
    return `<a class="fp-svc" href="${escape(item.href)}"${id}${externalWindow}>${content}${rowIcon}</a>`;
  }
  if (type === 'button') {
    const disabled = item.disabled ? ' disabled' : '';
    const cls = item.disabled ? ' fp-svc--disabled' : '';
    return `<button class="fp-svc${cls}" type="button"${id}${disabled}>${content}${rowIcon}</button>`;
  }
  return `<span class="fp-svc fp-svc--disabled" role="link" aria-disabled="true"${id}>${content}${rowIcon}</span>`;
}

function actionCard({ title = 'Aktionen', lead = '', links = [], items } = {}) {
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
function contactCard({ title = 'Ansprechpersonen', contacts = [] } = {}) {
  if (!contacts.length) return '';
  return `<div class="box">
    <h2>${escape(title)}</h2>
    <dl class="kv kv--stack">${contacts.map((c) => `
      <dt>${escape(c.label)}</dt>
      <dd>${c.name && c.name !== c.label ? `${escape(c.name)}<br>` : ''}${
        c.email ? `<a href="mailto:${escape(c.email)}">${escape(c.email)}</a>` : ''}${
        c.phone ? `<br>${escape(c.phone)}` : ''}</dd>`).join('')}
    </dl>
  </div>`;
}

// Link for a demo download that has no real target yet.
function downloadLink(url, label, iconName = 'Download') {
  const real = url && url !== '#';
  return real
    ? `<a class="btn btn--link btn--icon-left" href="${escape(url)}">${icon(iconName, 'btn__icon')}<span class="btn__text">${escape(label)}</span></a>`
    : `<span class="btn btn--link btn--icon-left" aria-disabled="true" title="Im Prototyp nicht verfügbar">${icon(iconName, 'btn__icon')}<span class="btn__text">${escape(label)}<span class="sr-only"> (im Prototyp nicht verfügbar)</span></span></span>`;
}

// --- Pagination (pagination.postcss) -----------------------------------------
// CD anatomy: an editable current-page field, "von N Seiten", then prev/next as
// icon-only outline buttons (disabled at the ends). `href(page)` builds the
// target hash so the caller keeps its own filters; `inputId` is wired by the
// caller for typed page jumps.
function pagination({ page, totalPages, href, inputId, label = 'Seitennavigation', align }) {
  if (totalPages <= 1) return '';
  const control = (target, text, iconName, disabled, key) => {
    const inner = `${icon(iconName, 'btn__icon')}<span class="btn__text">${text}</span>`;
    const id = inputId ? ` id="${escape(inputId)}-${key}"` : '';   // Focus restoration (Item 3.3).
    // Real disabled <button>, as in CD PaginationItem.vue. A <span> with
    // aria-label has role=generic (name prohibited) and is unreliable for SR.
    if (disabled) return `<li><button type="button" class="btn btn--outline btn--icon-only" disabled aria-label="${text}">${inner}</button></li>`;
    // Without an `href` builder: local state rather than hash navigation
    // (C.mountDataTable), using the same CD anatomy as <button data-page>.
    return href
      ? `<li><a class="btn btn--outline btn--icon-only"${id} href="${escape(href(target))}" aria-label="${text}">${inner}</a></li>`
      : `<li><button type="button" class="btn btn--outline btn--icon-only"${id} data-page="${target}" aria-label="${text}">${inner}</button></li>`;
  };
  return `
    <nav class="pagination-wrap${align === 'right' ? ' pagination-wrap--right' : ''}" aria-label="${escape(label)}">
      <div class="pagination">
        ${/* ONE name per control (CD Pagination.vue uses exactly one source): the
              sr-only label names the field. An additional aria-label would
              silently override it and could drift. */''}
        <label class="sr-only" for="${inputId}">Seite</label>
        <input id="${inputId}" class="pagination__input input--outline input--base" type="text" inputmode="numeric"
          value="${page}" autocomplete="off">
        <div class="pagination__text">von ${totalPages} Seiten</div>
        <ul class="pagination__items">
          ${control(page - 1, 'Vorherige Seite', 'ChevronLeft', page === 1, 'prev')}
          ${control(page + 1, 'Nächste Seite', 'ChevronRight', page === totalPages, 'next')}
        </ul>
      </div>
    </nav>`;
}

// Wires the editable page field AND the prev/next `<button data-page>` controls
// of a pagination block. `go(target)` navigates. Three explorers previously bound
// buttons themselves through a regex on the German next-page aria-label,
// which would silently break on any rename (design review A3). The data-page
// binding now lives here, and mountDataTable uses the same path.
function wirePagination(mount, inputId, page, totalPages, go) {
  const clamp = (n) => Math.min(totalPages, Math.max(1, Number.isFinite(n) ? n : page));
  mount.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => {
    go(clamp(Number(b.dataset.page)));
  }));
  const input = mount.querySelector('#' + inputId);
  if (!input) return;
  const jump = () => {
    const target = clamp(Number.parseInt(input.value, 10));
    if (target === page) { input.value = String(page); return; }
    go(target);
  };
  input.addEventListener('change', jump);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); jump(); } });
}

// --- Results header (search.postcss:208-234) --------------------------------
// Bar above the results list: count on the left, controls on the right. The view
// switcher is an icon group on the right, separated by a rule.

// ONE `unit` string previously served both dative and nominative contexts.
// Depending on the supplied form, one half was grammatically incorrect German
// (design review A14). `unit` may therefore be an object `{ nom, dat }`;
// a plain string continues to serve both slots (most plurals are case-invariant:
// Objekte, Dokumente, Kosten).
const unitCase = (unit) => (unit && typeof unit === 'object')
  ? { nom: unit.nom || unit.dat || '', dat: unit.dat || unit.nom || '' }
  : { nom: unit || '', dat: unit || '' };

// Shared result block for catalogue pages (services/applications/datasets),
// previously copied three times (P1-7). Filtering/sorting/slicing stays in each
// page because it differs. This standardises gallery/list switching, pagination,
// and empty/unavailable state. catalogueBar already renders the visible results
// header for every caller. `visible` is the currently visible (already sliced)
// page; `count` is the total filtered hit count; `card(item)`/`listView(items)`
// render the view.
function catalogueResults({
  visible, count, view = 'gallery', page = 1, totalPages = 1,
  card, listView, mapView, unit, gridCls = 'grid grid--responsive-cols-3',
  paginationHref, paginationInputId, paginationLabel,
  available = true, emptyMsg, unavailableMsg, note = '',
  regionLabel = '', resetHref = '',
}) {
  // Map view deliberately shows ALL hits rather than one page. A map with 10 of
  // 17 points would misrepresent the distribution, so it gets no pagination;
  // `mapView` receives the full filtered collection.
  const isMap = view === 'map' && typeof mapView === 'function';
  const body = count
    ? isMap
      ? mapView()
      : `${view === 'list'
        ? listView(visible)
        // Gallery uses CD's responsive `gap--top` scale above the grid
        // (search.postcss:196-201). Fixed mt-4/mt-6 remained at 1rem at 1024px,
        // where CD specifies 2.5rem. Only the LIST aligns flush with the rule.
        : `<div class="${gridCls} gap--top">${visible.map(card).join('')}</div>`}${
      paginationHref ? pagination({ page, totalPages, inputId: paginationInputId, label: paginationLabel, href: paginationHref }) : ''}`
    : available
      // Zero state with an exit. Advice that active filters could be reset above
      // required scrolling back and finding the bar (Item 5.13). `resetHref`
      // gives the state the same route as a control.
      ? empty(emptyMsg || `Keine ${escape(unitCase(unit).nom)} gefunden.`, {
          hint: 'Passen Sie Ihre Suche oder die Filter an.',
          action: resetHref ? { label: 'Suche und Filter zurücksetzen', href: resetHref } : null,
        })
      : empty(unavailableMsg || `${unitCase(unit).nom} konnten nicht geladen werden (Ladefehler).`, { available: false });
  // The results list needs its own heading. Cards inside are <h3>, and without
  // <h2> the outline jumped directly from the page <h1> to level 3 (WCAG 1.3.1 /
  // 2.4.10). Keep it sr-only because the visible count in catalogueBar carries
  // the same information.
  return `<section>
      <h2 class="sr-only">${escape(regionLabel || unitCase(unit).nom || 'Ergebnisse')}</h2>
      ${note ? `<p class="muted small mt-4">${note}</p>` : ''}
      ${body}
    </section>`;
}

// Standard catalogue-page live-region announcement (hit count · page · view).
function announceCatalogue({ count, total, unit, page = 1, totalPages = 1, view = 'gallery' }) {
  announce(`${count} von ${total} ${unitCase(unit).dat}${totalPages > 1 ? `, Seite ${page} von ${totalPages}` : ''}, Ansicht ${view === 'list' ? 'Liste' : view === 'map' ? 'Karte' : 'Galerie'}`);
}

// Gallery/list icon switcher with no visible label; state is in aria-pressed and
// aria-label. CD view switcher (icon toggle group, aria-pressed). `items` permits
// other view pairs (for example, map/list for projects), rather than hard-coded
// btn--filled emphasis.
function viewSwitch(view = 'gallery', items = [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List']]) {
  const btn = ([key, label, iconName]) => {
    const on = view === key;
    // Stable id (from data in fixed order): after a state change, the router
    // restores focus through `document.getElementById(activeId)`. Without id,
    // activeId was '' and focus fell to <body> (WCAG 2.4.3).
    return `<button type="button" class="view-switch__btn interactive-control" id="view-${escape(key)}" data-view="${key}"
      aria-pressed="${on}" aria-label="${escape(label)}" title="${escape(label)}">${icon(iconName, 'icon--md')}</button>`;
  };
  return `<div class="view-switch" role="group" aria-label="Ansicht">
    ${items.map(btn).join('')}
  </div>`;
}

// --- Catalogue trio (services / applications / catalogue share this pattern) --
// One catalogue hash: consistent q/page/view, with all further filters from
// `filters` as query parameters (string is set when truthy; non-empty arrays are
// comma-joined). Default values (page 1, view 'gallery') stay out of the URL so
// it remains short and shareable. Key = parameter name (for example, `topic`,
// `tag`). `defaultView` remains 'gallery' (catalogue trio, unchanged). Search
// uses 'list' by default because CD presents search results as a list first, and
// needs the inverse: 'gallery' enters the URL there.
function catalogueHash(base, { q = '', page = 1, view = '', defaultView = 'gallery', ...filters } = {}) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  for (const [k, v] of Object.entries(filters)) {
    if (Array.isArray(v)) { if (v.length) p.set(k, v.join(',')); }
    else if (v) p.set(k, String(v));
  }
  if (page > 1) p.set('page', String(page));
  if (view && view !== defaultView) p.set('view', view);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}


// Wire shared catalogue interactions: search form (submit → page 1), simple
// filter dropdowns (`filters: [{id, param}]` → set value, page 1), view switching
// (keeps page), and pagination. `hash(patch)` builds the target hash from base
// state + patch (caller closes over the base). The caller separately wires
// multi-value filters (for example, service topics).
function wireCatalogue(mount, { formId, inputId, pageInputId, page = 1, totalPages = 1, hash, filters = [],
  sortId, sortParam = 'sort', filterToggleId, panelId }) {
  const form = mount.querySelector('#' + formId);
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = mount.querySelector('#' + inputId);
    location.hash = hash({ q: input ? input.value.trim() : '', page: 1 });
  });
  filters.forEach(({ id, param }) => {
    const el = mount.querySelector('#' + id);
    if (el) el.addEventListener('change', (e) => { location.hash = hash({ [param]: e.target.value, page: 1 }); });
  });
  // Sorting (catbar): value → hash, page 1.
  if (sortId) {
    const s = mount.querySelector('#' + sortId);
    if (s) s.addEventListener('change', (e) => { location.hash = hash({ [sortParam]: e.target.value, page: 1 }); });
  }
  // Filter toggle (catbar): show/hide panel (client-side only, no hash) plus
  // multi-select checkboxes. On change, comma-join every checked value in the
  // dimension (data-fdim = parameter name) into the hash, page 1.
  if (filterToggleId && panelId) {
    const btn = mount.querySelector('#' + filterToggleId), panel = mount.querySelector('#' + panelId);
    if (btn && panel) btn.addEventListener('click', () => {
      const open = !panel.hidden;
      panel.hidden = open;
      btn.setAttribute('aria-expanded', String(!open));
      // Preserve state across the rebuild (Item 3.4).
      if (open) PANEL_OPEN.delete(panelId); else PANEL_OPEN.add(panelId);
    });
    if (panel) panel.addEventListener('change', (e) => {
      const cb = e.target.closest('input[data-fdim]'); if (!cb) return;
      const dim = cb.dataset.fdim;
      const values = [...panel.querySelectorAll('input[data-fdim="' + dim + '"]:checked')].map((x) => x.value);
      location.hash = hash({ [dim]: values, page: 1 });
    });
  }
  mount.querySelectorAll('.view-switch__btn').forEach((btn) => {
    btn.addEventListener('click', () => { location.hash = hash({ page, view: btn.getAttribute('data-view') }); });
  });
  if (pageInputId) wirePagination(mount, pageInputId, page, totalPages, (target) => { location.hash = hash({ page: target }); });
}

// --- Compact catalogue bar (catbar) -----------------------------------------
// Single-row reusable toolbar for every catalogue view (portfolio, services,
// data access, applications): search + hit count on the left; after ONE rule on
// the right, sorting, filter toggle (with active count), and view switcher. The
// filter opens a collapsible panel below containing the formerly persistent
// filter dropdowns. Markup only; each page wires search/sort/filter/view itself
// (portfolio: JS state, catalogue pages: hash). `countId` names the JS-populated
// hit count; `sort` = optional dropdown {id,name,label,value,options:[{value,label}]};
// `views` = viewSwitch items; `panel` = ready filter HTML (RAW, caller escapes).
// Open filter panels survive rebuilding. On catalogue pages, a checkbox writes
// to the hash, the router redraws the page, and catalogueBar() used to return the
// panel with [hidden] again, so it closed after EVERY check. Selecting three
// topics meant opening the drawer three times. CD's `filtersAreOpen` is likewise
// state that survives filter changes (SearchResultsFilters.vue:42-104). It is
// module-wide because it belongs to the view, not the data.
const PANEL_OPEN = new Set();

function catalogueBar({
  formId, inputId, searchLabel, placeholder = 'Suchen…', q = '', countId = 'cat-count', count = '',
  sort = null, filterId = '', filterLabel = 'Filter', filterCount = 0,
  panelId = '', panel = '', panelHidden = true,
  view = 'gallery', views, showSearch = true, extra = '',
}) {
  // Once opened, a panel stays open until the user closes it.
  if (panelId && PANEL_OPEN.has(panelId)) panelHidden = false;
  // Sorting: bare select with NO visible label (CD pattern; see indexPage.vue).
  // A disabled «Sortieren» option provides an in-control hint, with an sr-only
  // label for accessibility. If no option matches (missing/empty sort value),
  // show the «Sortieren» placeholder; otherwise select the current sort.
  const sortHtml = sort ? (() => {
    const cur = sort.value == null ? '' : String(sort.value);
    const hasSel = (sort.options || []).some((o) => String(o.value) === cur);
    return `
      <label class="sr-only" for="${escape(sort.id)}">${escape(sort.label || 'Sortierung')}</label>
      <div class="select select--bare catbar__sort">
        <select id="${escape(sort.id)}" name="${escape(sort.name || 'sort')}" class="input--outline input--sm">
          <option disabled${hasSel ? '' : ' selected'}>${escape(sort.placeholder || 'Sortieren')}</option>${
          (sort.options || []).map((o) => `<option value="${escape(o.value)}"${String(o.value) === cur ? ' selected' : ''}>${escape(o.label)}</option>`).join('')}</select>
        <div class="select__icon">${CHEVRON_SVG}</div>
      </div>`;
  })() : '';
  // Filter toggle: bare button with a chevron that rotates when open (CD .search__filters__actions).
  const filterHtml = filterId ? `
      <button type="button" class="btn btn--bare btn--sm catbar__filter" id="${escape(filterId)}" aria-expanded="${!panelHidden}"${panelId ? ` aria-controls="${escape(panelId)}"` : ''}>
        ${icon('Filter', 'btn__icon')}<span class="btn__text">${escape(filterLabel)}</span><span class="catbar__fcount"${filterCount ? '' : ' hidden'}>${filterCount ? `(${filterCount})` : ''}</span>${icon('ChevronDown', 'catbar__chev')}
      </button>` : '';
  // `showSearch:false`: search already supplies its field in the hero. CD's
  // `.search-results__header` carries only hit count left and sorting right there
  // (search.postcss:208-233), not a second field.
  const searchHtml = showSearch ? `
      ${/* role=search occurs multiple times per page (header search plus one for
            each catalogue/table bar), so every landmark needs its own name.
            `searchLabel` is already unique per bar. The
            submit button has ONE naming source: sr-only btn__text (CD pattern,
            btn.postcss:160-166), with no duplicate aria-label beside it. */''}
      <form class="catbar__search" id="${escape(formId)}" role="search" aria-label="${escape(searchLabel)}">
        <label class="sr-only" for="${escape(inputId)}">${escape(searchLabel)}</label>
        <input id="${escape(inputId)}" type="search" placeholder="${escape(placeholder)}" value="${escape(q)}" autocomplete="off">
        <button class="btn btn--bare btn--icon-only catbar__submit" type="submit" title="Suchen">${icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span></button>
      </form>` : '';
  return `
    <div class="catbar${showSearch ? '' : ' catbar--no-search'}">${searchHtml}
      <div class="catbar__count" id="${escape(countId)}">${count}</div>
      ${/* `extra`: RAW HTML at the end of the control group for a bar-level
            secondary action that is neither sorting, filtering, nor view
            switching. Room booking inserts «Grundriss ansehen» here. Without
            this slot it would sit in a second, otherwise empty right-aligned row
            above. Empty by default, so the four catalogue bars see nothing.
            Caller escapes and wires it. */''}
      <div class="catbar__controls">${sortHtml}${filterHtml}${views ? viewSwitch(view, views) : ''}${extra}</div>
    </div>${filterId ? `
    <div class="catbar__panel" id="${escape(panelId)}"${panelHidden ? ' hidden' : ''}>${panel}</div>` : ''}`;
}

// --- Data table with catalogue bar + pagination -----------------------------
// ONE building block for the recurring «long table in a detail view» pattern:
// search + hit count + sorting (+ optional facets) above the table, pagination
// below. Previously only the catalogue trio had a bar, while tables in «Meine
// personal cases and the property detail view (dimensions, equipment, contracts,
// costs, contacts, documents) were unfiltered and unlimited. They become very
// long for real buildings.
//
// Deliberately LOCAL state rather than the hash: these tables sit in tabs, and a
// hash change would redraw the entire page and reset the tab. Only their own
// subtree is rendered, preserving focus.
//
//   host      element into which content is rendered
//   id        unique prefix for every id in this block
//   rows      data rows
//   columns   as in C.table
//   unit      plural used in the hit count
//   searchKeys / search  fields or search predicate
//   sorts     [{ value, label, cmp }]
//   facets    [{ dim, legend, options:[{value,label}], match(row, values) }]
//   perPage   default 10
//   foot(visible, filtered)  optional <tfoot> row
function mountDataTable(host, opts = {}) {
  let unwireScroll = null;
  let unwireRows = null;
  const {
    id = 'dt', rows: allRows = [], columns = [], unit = 'Einträge', caption,
    searchKeys = [], search, searchLabel, placeholder,
    sorts = [], facets = [], perPage = 10, foot, emptyMsg, note = '', rowsClickable = false,
  } = opts;
  const state = { q: '', sort: '', page: 1, open: false, sel: {} };
  facets.forEach((f) => { state.sel[f.dim] = []; });

  const unwire = () => {
    if (unwireRows) { try { unwireRows(); } catch { /* Already gone. */ } unwireRows = null; }
    if (unwireScroll) { try { unwireScroll(); } catch { /* Already gone. */ } unwireScroll = null; }
  };

  const matchQ = (row) => {
    if (!state.q) return true;
    const q = state.q.toLowerCase();
    if (typeof search === 'function') return search(row, q);
    return searchKeys.some((k) => String(row[k] == null ? '' : row[k]).toLowerCase().includes(q));
  };
  const matchFacets = (row) => facets.every((f) => {
    const vals = state.sel[f.dim] || [];
    if (!vals.length) return true;
    return typeof f.match === 'function' ? f.match(row, vals) : vals.includes(String(row[f.dim]));
  });

  const draw = () => {
    // Wiring attaches to `host`, which persists across drawing. Before inserting
    // the new subtree, dispose delegated row clicks and observers; otherwise each
    // search/sort/page change would add another handler.
    unwire();
    const filtered = allRows.filter((r) => matchQ(r) && matchFacets(r));
    const sortDef = sorts.find((s) => s.value === state.sort);
    const sorted = sortDef && sortDef.cmp ? filtered.slice().sort(sortDef.cmp) : filtered;
    const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
    if (state.page > totalPages) state.page = totalPages;
    const visible = sorted.slice((state.page - 1) * perPage, state.page * perPage);
    const activeFacetCount = facets.reduce((n, f) => n + (state.sel[f.dim] || []).length, 0);

    const restore = preserveFocus(host);
    const u = unitCase(unit);
    host.innerHTML = `
      ${catalogueBar({
        formId: `${id}-form`, inputId: `${id}-q`,
        searchLabel: searchLabel || `${u.nom} durchsuchen`,
        placeholder: placeholder || `${u.nom} durchsuchen…`, q: state.q,
        countId: `${id}-count`,
        count: `<strong>${escape(String(sorted.length))}</strong> von ${escape(String(allRows.length))} ${escape(u.dat)}${
          totalPages > 1 ? ` · Seite ${state.page} von ${totalPages}` : ''}`,
        sort: sorts.length ? { id: `${id}-sort`, value: state.sort, options: sorts.map((s) => ({ value: s.value, label: s.label })) } : null,
        filterId: facets.length ? `${id}-filter` : '', filterCount: activeFacetCount,
        panelId: facets.length ? `${id}-panel` : '',
        panel: facets.map((f) => filterGroup({ dim: f.dim, legend: f.legend, options: f.options, selected: state.sel[f.dim], idPrefix: id })).join(''),
        panelHidden: !state.open,
      })}
      ${note ? `<p class="muted small mt-4">${note}</p>` : ''}
      ${/* Keep the table even with NO hits, with a row explaining why. Replacing
            it with an empty state removed header and columns: people could no
            longer see what the table represented, and filtering shifted the
            layout. Text distinguishes «no data at all» from «nothing for this
            selection». */''}
      ${table({ columns, rows: visible, zebra: true, caption, rowsClickable,
        emptyText: allRows.length
          ? `Keine ${u.nom} für diese Suche oder Filterung.`
          : (emptyMsg || `Keine ${u.nom} erfasst.`),
        foot: sorted.length && foot ? foot(visible, sorted) : undefined })}
      ${pagination({ page: state.page, totalPages, inputId: `${id}-page`, label: `Seitennavigation ${u.nom}` })}`;

    // --- Wiring (within host only) ---
    const form = host.querySelector(`#${id}-form`);
    if (form) form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = host.querySelector(`#${id}-q`);
      state.q = input ? input.value.trim() : ''; state.page = 1; draw();
    });
    const sortEl = host.querySelector(`#${id}-sort`);
    if (sortEl) sortEl.addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; draw(); });
    const fBtn = host.querySelector(`#${id}-filter`);
    const fPanel = host.querySelector(`#${id}-panel`);
    if (fBtn && fPanel) {
      fBtn.addEventListener('click', () => { state.open = !state.open; draw(); });
      fPanel.addEventListener('change', (e) => {
        const cb = e.target.closest('input[data-fdim]'); if (!cb) return;
        const dim = cb.dataset.fdim;
        state.sel[dim] = [...fPanel.querySelectorAll(`input[data-fdim="${dim}"]:checked`)].map((x) => x.value);
        state.page = 1; draw();
      });
    }
    if (rowsClickable) unwireRows = wireTableRows(host);
    // wirePagination binds BOTH the input and [data-page] buttons (review A3).
    wirePagination(host, `${id}-page`, state.page, totalPages, (target) => { state.page = target; draw(); });
    unwireScroll = wireScrollRegions(host);
    restore();
    announce(`${sorted.length} von ${allRows.length} ${u.dat}${totalPages > 1 ? `, Seite ${state.page} von ${totalPages}` : ''}`);
  };
  draw();
  // Disposal function for the caller (ctx.onUnmount), ensuring observers and
  // delegated row clicks disappear when leaving the route.
  return unwire;
}

// Row click for `C.table({ rowsClickable: true })`. The row follows its FIRST
// link; keyboard and screen readers still use that link. Clicks on a control or
// selected text remain untouched, or nothing in the table could be copied.
// C.mountDataTable calls this itself. Callers rendering C.table directly invoke
// it once on `root` after insertion.
function wireTableRows(root) {
  if (!root) return () => {};
  const ctrl = new AbortController();
  root.addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, label, select')) return;
    const tr = e.target.closest('.table--rows-clickable tbody tr');
    if (!tr) return;
    if (String(window.getSelection?.() || '').length) return;
    tr.querySelector('a[href]')?.click();
  }, { signal: ctrl.signal });
  return () => ctrl.abort();
}

// Multi-select filter group (checkboxes), matching the portfolio panel
// (.filter-group / .filter-check). `dim` is the hash parameter name (placed on
// every checkbox as data-fdim); `selected` contains currently checked values.
// Wired through C.wireCatalogue: panel change → all checked values in the
// dimension → hash.
function filterGroup({ dim, legend, options = [], selected = [], idPrefix = '', max = 0 }) {
  // `id="${idPrefix}f-${dim}-${i}"`: the index is stable because options come from
  // data in fixed order, which focus restoration requires (Item 3.3). `idPrefix`
  // keeps ids document-wide unique when two tables use the same facet dimension
  // (review a11y-dup-ids-1). `max` truncates long value lists: the remainder sits
  // in a hidden span revealed by the caller through [data-fmore] (estate).
  const p = idPrefix ? escape(idPrefix) + '-' : '';
  const cb = (o, i) => `<label class="filter-check"><input type="checkbox" id="${p}f-${escape(dim)}-${i}" data-fdim="${escape(dim)}" value="${escape(o.value)}"${
    selected.includes(o.value) ? ' checked' : ''}><span>${escape(o.label)}</span></label>`;
  const head = max && options.length > max ? options.slice(0, max) : options;
  const rest = max && options.length > max ? options.slice(max) : [];
  return `<fieldset class="filter-group"><legend class="filter-group__legend">${escape(legend)}</legend>${
    head.map(cb).join('')}${rest.length
      ? `<span class="filter-group__more" hidden>${rest.map((o, i) => cb(o, i + head.length)).join('')}</span>
         <button type="button" class="btn btn--link btn--sm" data-fmore="${escape(dim)}" aria-expanded="false"><span class="btn__text">Alle anzeigen (${options.length})</span></button>`
      : ''}</fieldset>`;
}

// --- Action menu (kebab dropdown) -------------------------------------------
// Reusable action menu for the dashboard toolbar and every chart card (Superset
// pattern). `items` is a flat list of `{ action, label, icon }` (menu item),
// `{ heading }` (group title), or `{ separator:true }`. Behaviour comes through
// C.wireMenu; `data-action` passes the action to the caller (no inline onclick).
// `menuId` identifies the menu in the shared onAction handler.
export function menu({ menuId, items = [], label = 'Aktionen', align = 'end', triggerIcon = 'More', triggerClass = '' }) {
  const row = (it) => {
    if (it.separator) return '<div class="action-menu__sep" role="separator"></div>';
    if (it.heading) return `<div class="action-menu__heading">${escape(it.heading)}</div>`;
    return `<button type="button" role="menuitem" class="action-menu__item" data-action="${escape(it.action)}" tabindex="-1">`
      + `${it.icon ? icon(it.icon, 'action-menu__icon') : ''}<span>${escape(it.label)}</span></button>`;
  };
  // aria-controls + popup id as in CD Popover.vue:3-9. The trigger names WHAT it
  // opens (menuIds are unique per page; see callers).
  const popupId = `${menuId}-popup`;
  return `<div class="action-menu" data-menu="${escape(menuId)}">
    <button type="button" class="action-menu__trigger interactive-control${triggerClass ? ' ' + triggerClass : ''}" aria-haspopup="true" aria-expanded="false" aria-controls="${escape(popupId)}" aria-label="${escape(label)}" title="${escape(label)}">${icon(triggerIcon, 'icon--base')}</button>
    <div class="action-menu__popup action-menu__popup--${align}" id="${escape(popupId)}" role="menu" aria-label="${escape(label)}" hidden>${items.map(row).join('')}</div>
  </div>`;
}

// One global closer (clicking outside closes open menus), preventing repeated
// wireMenu() calls from accumulating listeners. Uses its own `.action-menu`
// namespace; `.menu` belongs to CD's navigation flyout component.
let menuGlobalWired = false;
function ensureMenuGlobal() {
  if (menuGlobalWired || typeof document === 'undefined') return;
  menuGlobalWired = true;
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.action-menu__trigger')) return;
    const inPopup = e.target.closest && e.target.closest('.action-menu__popup');
    document.querySelectorAll('.action-menu__popup:not([hidden])').forEach((pop) => {
      if (pop === inPopup) return;
      pop.hidden = true;
      const trg = pop.closest('.action-menu') && pop.closest('.action-menu').querySelector('.action-menu__trigger');
      if (trg) trg.setAttribute('aria-expanded', 'false');
    });
  });
}

// Wire every .action-menu in `root`: open/close, arrow keys/Home/End, Escape, and
// outside click. On selection → onAction(action, menuId, triggerEl).
export function wireMenu(root, onAction) {
  ensureMenuGlobal();
  root.querySelectorAll('.action-menu').forEach((m) => {
    const trigger = m.querySelector('.action-menu__trigger');
    const popup = m.querySelector('.action-menu__popup');
    const items = [...popup.querySelectorAll('.action-menu__item')];
    const open = () => {
      document.querySelectorAll('.action-menu__popup:not([hidden])').forEach((p) => {
        if (p === popup) return;
        p.hidden = true;
        const oldTrigger = p.closest('.action-menu')?.querySelector('.action-menu__trigger');
        if (oldTrigger) oldTrigger.setAttribute('aria-expanded', 'false');
      });
      popup.hidden = false; trigger.setAttribute('aria-expanded', 'true'); items[0] && items[0].focus();
    };
    const close = (focusTrigger) => { popup.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (focusTrigger) trigger.focus(); };
    trigger.addEventListener('click', (e) => { e.stopPropagation(); popup.hidden ? open() : close(false); });
    items.forEach((it, i) => {
      it.addEventListener('click', () => { const action = it.dataset.action; close(true); if (onAction) onAction(action, m.dataset.menu, trigger); });
      it.addEventListener('keydown', (e) => {
        let ni = null;
        if (e.key === 'ArrowDown') ni = (i + 1) % items.length;
        else if (e.key === 'ArrowUp') ni = (i - 1 + items.length) % items.length;
        else if (e.key === 'Home') ni = 0;
        else if (e.key === 'End') ni = items.length - 1;
        if (ni !== null) { e.preventDefault(); items[ni].focus(); }
      });
    });
    m.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !popup.hidden) { e.stopPropagation(); close(true); } });
    // APG menu pattern: close when focus leaves the menu (Tab from a menuitem or
    // click on a focusable outside target). Otherwise an open visible menu with
    // aria-expanded="true" remains; the global closer responds only to pointer
    // clicks. No preventDefault, so focus proceeds naturally (relatedTarget null
    // means the target cannot receive focus → close).
    m.addEventListener('focusout', (e) => {
      if (popup.hidden) return;
      if (!m.contains(e.relatedTarget)) close(false);
    });
  });
}

// Short, self-dismissed status message for simulated/completed actions. CD
// toast-message (toast-message.postcss:5-18 + ToastMessage.vue): fixed host at
// bottom 10%, containing a normal notification (default: success with
// CheckmarkCircle; failure paths pass 'error'/'warning'), visible for 5s. The
// message is visual only; the SR announcement uses the persistent #live region
// (announce), because aria-live does not fire in a newly created node.
export function toast(msg, variant = 'success', iconName = 'CheckmarkCircle') {
  announce(msg);
  if (typeof document === 'undefined') return;
  const t = document.createElement('div');
  t.className = 'toast__message';
  t.innerHTML = notification(escape(msg), variant, iconName);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast__message--in'));
  setTimeout(() => { t.classList.remove('toast__message--in'); setTimeout(() => t.remove(), 300); }, 5000);
}

// --- Catalogue state from the hash query (catalogue quartet) ----------------
// Read side of the catalogue pattern. services/applications/catalog/search each
// hand-rolled ~35 identical lines of parsing/validation/clamping/slicing (design
// review B16); only the write side (catalogueHash/wireCatalogue) was shared.
// Both now come from one source.
//
//   query      route URLSearchParams
//   base       page base hash ('#/services')
//   perPage    gallery page size (default 12, divisible by BOTH 2 and 3 columns)
//   sortOpts   allowed sort values (array of option values); '' = data order
//   filters    { param: allowedValues[]|null } — multi-value, comma-joined
//   views      allowed views; defaultView stays out of the URL
//
// Returns { q, view, page, sort, selected, hash(patch), clamp(list) }.
// clamp() slices the sorted list to the page and returns
// { visible, totalPages, page }, clamping page to the valid range if necessary.
function catalogueState(query, { base, perPage = 12, sortOpts = [], defaultSort = '',
  views = ['gallery', 'list'], defaultView = 'gallery', filters = {} } = {}) {
  const q = (query.get('q') || '').trim();
  const rawView = query.get('view') || defaultView;
  const view = views.includes(rawView) ? rawView : defaultView;
  const rawSort = query.get('sort') || defaultSort;
  const sort = sortOpts.includes(rawSort) ? rawSort : defaultSort;
  const selected = {};
  for (const [param, allowed] of Object.entries(filters)) {
    const vals = (query.get(param) || '').split(',').map((s) => s.trim()).filter(Boolean);
    selected[param] = allowed ? vals.filter((v) => allowed.includes(v)) : vals;
  }
  const parsed = Number.parseInt(query.get('page') || '1', 10);
  let page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const hash = (patch = {}) => catalogueHash(base, { q, page, view, defaultView, sort, ...selected, ...patch });
  const clamp = (list) => {
    const totalPages = Math.max(1, Math.ceil(list.length / perPage));
    if (page > totalPages) page = totalPages;
    return { visible: list.slice((page - 1) * perPage, page * perPage), totalPages, page };
  };
  return { q, view, page, sort, selected, perPage, hash, clamp };
}

// --- JS-state catalogue wiring (explorer) -----------------------------------
// Local twin of wireCatalogue. Portfolio, construction projects, tenants, and
// building documentation keep state in a variable rather than the hash (tabs/
// tree, documented per app), and each carried a ~45-line copy of the same wiring:
// debounced search, sort, filter panel with count badge, and active pills (design
// review A2). Copies had already drifted (dead reset in tenants).
//
//   state     { q, sort, page, view, filters: { dim: value[] } } — mutated here
//   onChange  redraw results surface (renderMain)
//   onRemove  (token) for pill tokens outside 'q'/'dim:value' (for example, 'sel')
//   onReset   replaces default onChange after the full filter reset
//             (explorers additionally reset tree selection here)
//
// Returns { updateFilterBadge, syncFilterChecks, clearFilters, destroy } for
// callers that manipulate panel state themselves (URL restoration). `destroy`
// belongs in ctx.onUnmount and notably discards the delayed search.
function wireCatalogueState(mount, {
  formId, inputId, sortId = '', filterToggleId = '', panelId = '', resetId = '',
  activeFiltersId = '', state, onChange, onRemove, onReset, debounceMs = 250,
} = {}) {
  const input = inputId ? mount.querySelector('#' + inputId) : null;
  let timer = null;
  let destroyed = false;
  const runSearch = () => {
    timer = null;
    // A delayed callback belongs to the mount that scheduled it. Do not let it
    // mutate state or the hash after the router has replaced that mount.
    if (destroyed || !mount.isConnected) return;
    state.q = input ? (input.value || '') : ''; state.page = 1; onChange();
  };
  const form = formId ? mount.querySelector('#' + formId) : null;
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(timer); timer = null; runSearch(); });
  if (input) input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runSearch, debounceMs); });

  const vs = mount.querySelector('.view-switch');
  if (vs) vs.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-switch__btn'); if (!btn) return;
    state.view = btn.dataset.view; state.page = 1; onChange();
  });

  const sortSel = sortId ? mount.querySelector('#' + sortId) : null;
  if (sortSel) sortSel.addEventListener('change', () => { state.sort = sortSel.value; state.page = 1; onChange(); });

  const fbtn = filterToggleId ? mount.querySelector('#' + filterToggleId) : null;
  const fpanel = panelId ? mount.querySelector('#' + panelId) : null;
  const fbadge = fbtn ? fbtn.querySelector('.catbar__fcount') : null;
  const dims = () => Object.keys(state.filters || {});
  const updateFilterBadge = () => {
    if (!fbadge) return;
    const total = dims().reduce((n, d) => n + (state.filters[d] || []).length, 0);
    fbadge.textContent = total ? `(${total})` : ''; fbadge.hidden = !total;
  };
  const syncFilterChecks = () => { if (fpanel) fpanel.querySelectorAll('input[data-fdim]').forEach((cb) => { cb.checked = (state.filters[cb.dataset.fdim] || []).includes(cb.value); }); };
  const clearFilters = () => { dims().forEach((d) => { state.filters[d] = []; }); syncFilterChecks(); updateFilterBadge(); };
  // Immediately show URL-restored filters on the button (url-state-1). Checkboxes
  // are already correct when filterGroup received `selected`.
  updateFilterBadge();
  if (fbtn && fpanel) fbtn.addEventListener('click', () => {
    const open = !fpanel.hidden; fpanel.hidden = open; fbtn.setAttribute('aria-expanded', String(!open));
  });
  if (fpanel) fpanel.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-fdim]'); if (!cb) return;
    const dim = cb.dataset.fdim, arr = state.filters[dim] || (state.filters[dim] = []);
    if (cb.checked) { if (!arr.includes(cb.value)) arr.push(cb.value); }
    else state.filters[dim] = arr.filter((x) => x !== cb.value);
    updateFilterBadge(); state.page = 1; onChange();
  });
  const resetBtn = resetId ? mount.querySelector('#' + resetId) : null;
  if (resetBtn) resetBtn.addEventListener('click', () => { clearFilters(); state.page = 1; onChange(); });

  const af = activeFiltersId ? mount.querySelector('#' + activeFiltersId) : null;
  if (af) af.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) {
      state.q = ''; if (input) input.value = '';
      clearFilters();
      if (onReset) onReset(); else { state.page = 1; onChange(); }
      return;
    }
    const pill = e.target.closest('[data-remove]'); if (!pill) return;
    const tok = pill.dataset.remove;
    if (tok === 'q') { state.q = ''; if (input) input.value = ''; state.page = 1; onChange(); return; }
    const i = tok.indexOf(':');
    if (i > 0 && state.filters[tok.slice(0, i)] !== undefined) {
      const dim = tok.slice(0, i);
      state.filters[dim] = (state.filters[dim] || []).filter((x) => x !== tok.slice(i + 1));
      syncFilterChecks(); updateFilterBadge(); state.page = 1; onChange(); return;
    }
    if (onRemove) onRemove(tok);   // For example, 'sel' — the caller's tree selection.
  });

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return { updateFilterBadge, syncFilterChecks, clearFilters, destroy };
}

// Canonical filter-panel reset — ONE anatomy for 13 panels that previously
// diverged into ~7 variants (icon class, modifier, wrapper; design review B17).
// The reset label follows CD wording (eventsList.vue). The pill row below retains
// its full-reset wording because it also clears search and tree
// selection. Use `wrap:''` for panels with their own action row (dashboards:
// .filter-panel__actions).
function panelReset({ href = '', id = '', label = 'Filter zurücksetzen', wrap = 'catbar__panel-actions' } = {}) {
  const inner = `${icon('Refresh', 'btn__icon icon--base')}<span class="btn__text">${escape(label)}</span>`;
  const ctl = href
    ? `<a class="btn btn--bare btn--sm btn--icon-left" href="${escape(href)}">${inner}</a>`
    : `<button type="button" class="btn btn--bare btn--sm btn--icon-left"${id ? ` id="${escape(id)}"` : ''}>${inner}</button>`;
  return wrap ? `<div class="${escape(wrap)}">${ctl}</div>` : ctl;
}

// --- Form seams (design review A8/A9/B8/B12) --------------------------------
// Remove an error message as soon as the user corrects its field (Item 3.6).
// Superset version from building-create: listen to `change` in addition to
// `input`, because pointer interaction with <select> fires no input event.
// space-request and building-create previously had one copy each, while
// fault-report and workspace had none, making equivalent forms behave differently.
function wireFieldErrors(mount, errors) {
  Object.keys(errors).forEach((id) => {
    const el = mount.querySelector('#' + CSS.escape(id));
    if (!el) return;
    const clear = () => {
      if (!errors[id]) return;
      delete errors[id];
      el.classList.remove('input--error');
      el.removeAttribute('aria-invalid');
      const msg = mount.querySelector('#' + CSS.escape(id) + '-msg');
      if (msg) msg.remove();
    };
    el.addEventListener('input', clear, { once: true });
    el.addEventListener('change', clear, { once: true });
  });
}

// Focus + announcement on the success screen. processDone renders its heading
// with tabindex="-1" PRECISELY for this, but only building-create used it. In
// three sibling flows, focus fell to <body> after submission.
function focusProcessDone(mount, instance) {
  const h = mount.querySelector('h1[tabindex="-1"], h2[tabindex="-1"]');
  if (h) h.focus();
  if (instance && instance.reference) announce(`Vorgang erstellt. Referenz ${instance.reference}.`);
}

// Wizard header: step indicator + step heading (sr-only by default, optionally
// visible at the appropriate level) + required-field legend. `step` is one-based,
// matching the apps.
function wizardHead(labels, step, { headId = 'wiz-step-head', label = 'Antragsschritte', legend = true,
  heading = 'h2', title = '', visible = false } = {}) {
  const headingTag = ['h2', 'h3', 'h4'].includes(heading) ? heading : 'h2';
  const headingText = title || labels[step - 1];
  return `${stepIndicator(labels, step - 1, { label })}
    <${headingTag} class="${visible ? 'wizard-step__title' : 'sr-only'}" id="${escape(headId)}" tabindex="-1">Schritt ${step} von ${labels.length}: ${escape(headingText)}</${headingTag}>
    ${legend ? '<p class="small muted">Mit <span class="text--asterisk" aria-hidden="true"></span> markierte Felder sind Pflichtfelder.</p>' : ''}`;
}

// A step change is a context change: focus the step heading and announce WITH
// its name («Schritt 2 von 3: Bedarf»). space-request previously announced only
// the number, while building-create included the name (design review D31).
function focusWizardStep(mount, labels, step, { headId = 'wiz-step-head' } = {}) {
  const h = mount.querySelector('#' + headId) || mount.querySelector('h1');
  if (h) h.focus({ preventScroll: true });
  announce(`Schritt ${step} von ${labels.length}: ${labels[step - 1]}`);
}

// Context row below the form h1 — ONE formula for all four flows:
// «<action> als NAME · ORG (· Prozess: …)». Previously every app decided
// independently whether to show name and process preview (design review B12).
function contextLine({ action, name = '', org, process = '' }) {
  return `<p class="muted">${escape(action)} als ${name ? `<strong>${escape(name)}</strong> · ` : ''}<strong>${escape(org)}</strong>${
    process ? ` · Prozess: ${escape(process)}` : ''}.</p>`;
}

// --- Login notice (AGOV / FedLogin) -----------------------------------------
// No content is hidden; when signed out, only this notice appears where a case
// would be started.
//
// `next` is the route that COMPLETES login. Without it, the path stopped halfway:
// the button sat where the start-case action normally appears, signed in, redrew the
// page, and forced the user to press the real button a second time in the same
// place they had just clicked (user finding, 2026-08-06). When the notice is
// ALREADY on the target page (form apps, personal cases), leave `next` empty;
// redrawing is already the destination there.
function loginGate(text = 'Zum Starten dieses Vorgangs ist eine Anmeldung erforderlich.', opts = {}) {
  // Space before the button through `.login-gate .btn { margin-top:1rem }`
  // (app.css), not an inline style. CD's banner scale
  // (notification.postcss:89-92) does not apply because the button sits INSIDE
  // __content, not beside it.
  return `<div class="notification notification--hint login-gate">
    ${icon('Lock', 'notification__icon')}
    <div class="notification__content">
      <p class="m-0">${text}</p>
      ${loginButton({ ...opts, cls: 'btn btn--outline btn--icon-left login-gate__btn' })}
    </div>
  </div>`;
}

// The ONE login button (notice banner, access card, header). Delegated through
// `data-login`, not inline onclick, matching the house rule for menu() and
// notifications. `next` as a data attribute is also safely escaped, while a URL
// inside an onclick string breaks at every apostrophe.
function loginButton({ next = '', label = '', cls = 'btn btn--outline btn--icon-left', size = '' } = {}) {
  return `<button type="button" class="${cls}${size ? ' ' + size : ''}" data-login${
    next ? ` data-login-next="${escape(next)}"` : ''}>${icon('User', 'btn__icon')}<span class="btn__text">${
    escape(label || 'Anmelden mit AGOV / FedLogin')}</span></button>`;
}

// --- Access card ------------------------------------------------------------
// ONE card for the question «how do I get in here?» on both service and
// application landing pages. Previously there were two constructions: the
// application put the button above the text, while the service reversed them at
// half the size. The button belongs above (user decision, 2026-08-06): it is the
// answer, and the text is the footnote.
//
// The caller separates target kind (`external`) from window behaviour
// (`newWindow`). Same-tab targets can continue connecting login directly to the
// entry. In a new tab, the start remains a real link; the target application's
// router shows its login gate there if required. The browser click remains
// synchronous and is not intercepted by popup blockers.
function accessCard({
  title = 'Zugriff', href = '', label = 'Öffnen', loginLabel = '',
  external = false, newWindow = false, requiresLogin = false, loggedIn = false, user = null,
  note = '', steps = [], free = '',
  missing = 'Im Prototyp ist kein Zielsystem angebunden.',
} = {}) {
  // `#` is the inventory placeholder for «known, but unavailable».
  const has = !!href && href !== '#';
  const opensNewWindow = external || newWindow;
  const arrow = opensNewWindow ? 'External' : 'ArrowRight';
  const linkAttrs = opensNewWindow
    ? ` target="_blank" rel="${external ? 'noopener external' : 'noopener'}"`
    : '';
  let action, context;

  if (!has) {
    // <span aria-disabled>, not <button disabled>: the target is a link, and a
    // disabled link is not an HTML control (app.css:1375).
    action = `<span class="btn btn--outline btn--icon-right" aria-disabled="true">${
      icon(arrow, 'btn__icon')}<span class="btn__text">${escape(label)}</span></span>`;
    context = `<p class="small muted m-0">${escape(missing)}</p>`;
  } else if (requiresLogin && !loggedIn && !newWindow) {
    action = loginButton({ next: href, label: loginLabel || `Anmelden und ${label}` });
    context = `<p class="small m-0">${icon('Lock', 'icon--base')} Für den Zugriff ist eine Anmeldung mit AGOV / FedLogin erforderlich.</p>`;
  } else {
    action = `<a class="btn btn--outline btn--icon-right" href="${escape(href)}"${linkAttrs}>${
      icon(arrow, 'btn__icon')}<span class="btn__text">${escape(label)}</span></a>`;
    context = requiresLogin
      ? (loggedIn && user
        ? `<p class="small muted m-0">Angemeldet als <strong>${escape(user.name)}</strong> · ${escape(user.org)}.</p>`
        : `<p class="small m-0">${icon('Lock', 'icon--base')} Die Anmeldung erfolgt in der gestarteten Anwendung.</p>`)
      : (free ? `<p class="small muted m-0">${escape(free)}</p>` : '');
  }

  return `<div class="box access-card">
    <h3>${escape(title)}</h3>
    <p class="access-card__action">${action}</p>
    ${context}
    ${note ? `<p class="small m-0">${escape(note)}</p>` : ''}
    ${steps.length ? `<ul class="list--default small muted mt-2">${
      steps.map((s) => `<li>${escape(s)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

// One delegated wiring for all login buttons (app.js). Delegate on document so
// it survives every page change, like wireShare.
export function wireLogin(root = document) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('[data-login]');
    if (!btn || !window.__login) return;
    window.__login(btn.dataset.loginNext || '');
  });
}

const C = {
  icon, escape, badge, statusBadge, loading, pageHeader, card, table, empty,
  openModal, openShareModal, domainTile, announce, trapFocus,
  acquireOverlayLock, registerOverlay, closeOverlays,
  renderNotFound, activeFilters, detailBar, detailHead, detailSection, markLang, accordion, wireAccordion,
  catalogueResults, announceCatalogue, catalogueHash, catalogueBar, filterGroup, wireCatalogue, pipeline,
  catalogueState, wireCatalogueState, panelReset, wireFieldErrors, focusProcessDone, wizardHead, focusWizardStep, contextLine,
  tabBar, tabPanels, wireTabs, menu, wireMenu, toast,
  notification, flashError, safeDecode, backLink, photo, photoUrl, select, selectBox, field, val, readForm, downloadItem, contactBox, downloadLink,
  actionCard, contactCard,
  pagination, wirePagination, loginGate, accessCard,
  preserveFocus, wireScrollRegions, errorSummary, wireErrorSummary, processDone,
  mountDataTable, wireTableRows, cardAction, pageSection, heroFigure,
};
export default C;
