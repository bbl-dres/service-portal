// Bauteile — Portierung der Portal-Helfer aus js/ui/components/* auf den
// Umfang, den diese Studie wirklich zeichnet.
//
// WARUM PORTIERT UND NICHT IMPORTIERT: `C` hängt an js/security/urls.js, am
// Router, an der Session und am Symbolvorrat und erwartet, dass das Dokument in
// der Portalwurzel liegt (alle Pfade sind dokumentrelativ). Die Studie liegt
// vier Ebenen tiefer und soll eigenständig laufen. Portiert ist deshalb die
// AUSGABE, nicht der Apparat: gleiche Klassen, gleiche Anatomie, gleiche
// ARIA-Attribute — nachprüfbar gegen die je genannte Portal-Datei.
//
// Was hier NICHT nachgebaut ist: safeLinkUrl/classifyUrl. Die Studie erzeugt
// jede Route selbst aus den Daten (js/data.js); es gibt keine fremde
// Zeichenkette, die zu einem href werden könnte, und ein halb nachgebauter
// URL-Prüfer wäre gefährlicher als gar keiner.

/* --------------------------------------------------------------- Basis --- */

// Portal js/ui/components/primitives.js: escape() deckt AUCH das Apostroph ab —
// Attributwerte werden hier in doppelten Anführungszeichen geschrieben, aber ein
// einzelnes Escape-Set für beide Fälle kann nicht am falschen Ort landen.
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Umbruchstellen für lange deutsche Komposita: UAX#14 erlaubt nach «/» und «-»
// keinen Umbruch, also gilt «Sicherheits-/Datenschutzvorfall» als EIN Wort und
// bricht mitten hinein. <wbr> öffnet die Stelle, ohne ein Zeichen einzufügen.
export const breakable = (s) => esc(s).replace(/([/–—-])(?=\S)/g, '$1<wbr>');

// Symbolpfad. Dokumentrelativ, nicht modulrelativ: der Wert landet in einem
// style-Attribut, und dessen url() löst gegen die DOKUMENT-Adresse auf.
// index.html liegt in docs/wireframes/<Studie>/ — drei Ebenen unter der Wurzel.
const ICON_BASE = '../../../assets/icons/';
const ICON_NAME = /^[A-Za-z][A-Za-z0-9]*$/;

/** Einfarbiges SVG als CSS-Maske, damit es currentColor annimmt (Portal-Rezept). */
export function icon(name, cls = 'icon--base') {
  const safe = ICON_NAME.test(String(name || '')) ? name : 'InfoCircle';
  const u = ICON_BASE + safe + '.svg';
  return `<span class="icon ${esc(cls)}" style="-webkit-mask-image:url('${u}');mask-image:url('${u}')" aria-hidden="true"></span>`;
}

export const CHEVRON_SVG = '<svg role="presentation" aria-hidden="true" viewBox="0 0 24 24">'
  + '<path d="m5.706 10.015 6.669 3.85 6.669-3.85.375.649-7.044 4.067-7.044-4.067z"/></svg>';

export const badge = (text, variant = 'gray') => `<span class="badge badge--${esc(variant)}">${esc(text)}</span>`;

/** Portal js/ui/components/feedback.js — `body` ist FERTIGES HTML, der Aufrufer escapt. */
export const notification = (body, variant = 'info', iconName = 'InfoCircle') =>
  `<div class="notification notification--${esc(variant)}">${icon(iconName, 'notification__icon')}
    <div class="notification__content">${body}</div></div>`;

/** Leerzustand (Portal C.empty), auf das reduziert, was die Studie zeigt. */
export const empty = (message, { hint = '' } = {}) =>
  `<div class="empty">${icon('InfoCircle', 'icon--md')}<div class="empty__body">
    <p>${esc(message)}</p>${hint ? `<p class="small">${esc(hint)}</p>` : ''}</div></div>`;

/* ---------------------------------------------------------- Trefferzeile --- */
// Portal js/pages/search.js `resultRow` — die Anatomie der Trefferliste:
// Meta-Zeile, Titel als h3, Beschreibung. Ein externer Treffer bekommt das
// External-Symbol hinter den Titel.
export function resultRow(r) {
  const body = `
      <p class="meta-info search-result__meta">
        <span class="meta-info__item">${esc(r.type)}</span>
        ${r.meta ? `<span class="meta-info__item">${esc(r.meta)}</span>` : ''}
      </p>
      <h3 class="search-result__title">${esc(r.title)}${
        r.external ? ' ' + icon('External', 'icon--sm') : ''}</h3>
      ${r.desc ? `<p class="search-result__desc">${esc(r.desc)}</p>` : ''}`;
  const attrs = r.external ? ' target="_blank" rel="noopener noreferrer external"' : '';
  return `<li class="search-result"><a class="search-result__link plain-link" href="${esc(r.href)}"${attrs}>${body}</a></li>`;
}

/* ------------------------------------------------------------- Karte ----- */
// Portal js/ui/components/content.js `card` — Galerieansicht. Ausgedehnter
// Verweis: der Titel-<a> deckt die Karte, die Karte selbst bleibt ein <div>.
export function card(r) {
  return `<div class="card card--default card--clickable">
    <div class="card__content">
      <div class="card__body">
        <h3 class="card__title"><a class="card__link" href="${esc(r.href)}"${
          r.external ? ' target="_blank" rel="noopener noreferrer external"' : ''}>${breakable(r.title)}</a></h3>
        <div class="pill-row">${badge(r.kind, 'blue')}</div>
        ${r.desc ? `<p class="card__description">${esc(r.desc)}</p>` : ''}
      </div>
      <div class="card__footer">
        <div class="card__footer__info">${esc(r.type)}${r.meta ? ` · ${esc(r.meta)}` : ''}</div>
        <div class="card__footer__action"><span class="btn btn--outline btn--icon-only" aria-hidden="true">${
          icon(r.external ? 'External' : 'ArrowRight', 'btn__icon icon--base')}</span></div>
      </div>
    </div>
  </div>`;
}

/* -------------------------------------------------------- Katalogleiste -- */
// Portal js/ui/components/catalogue.js `viewSwitch` + `catalogueBar`.
// Feste ids an den Ansichtsknöpfen: nach einem Zustandswechsel stellt der Router
// den Fokus über getElementById wieder her; ohne id fiele er auf <body>.
function viewSwitch(view, items) {
  const btn = ([key, label, iconName]) => `<button type="button"
      class="view-switch__btn interactive-control" id="view-${esc(key)}" data-view="${esc(key)}"
      aria-pressed="${view === key}" aria-label="${esc(label)}" title="${esc(label)}">${icon(iconName, 'icon--md')}</button>`;
  return `<div class="view-switch" role="group" aria-label="Ansicht">${items.map(btn).join('')}</div>`;
}

/**
 * Die Leiste über der Trefferliste. `showSearch:false` wie im Portal: die
 * Abfrage kommt aus dem grossen Feld darüber, CDs `.search-results__header`
 * trägt dort nur Trefferzahl links und Sortierung rechts.
 */
export function catbar({ countId = 'sr-count', count = '', sort = null,
  filterId = '', filterLabel = 'Filter', filterCount = 0,
  panelId = '', panel = '', panelHidden = true, view = 'list', views = null, extra = '' }) {
  const sortHtml = sort ? (() => {
    const cur = sort.value == null ? '' : String(sort.value);
    const hasSel = (sort.options || []).some((o) => String(o.value) === cur);
    return `
      <label class="sr-only" for="${esc(sort.id)}">${esc(sort.label || 'Sortierung')}</label>
      <div class="select select--bare catbar__sort">
        <select id="${esc(sort.id)}" name="sort">
          <option disabled${hasSel ? '' : ' selected'}>Sortieren</option>${
          (sort.options || []).map((o) => `<option value="${esc(o.value)}"${
            String(o.value) === cur ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
        <div class="select__icon">${CHEVRON_SVG}</div>
      </div>`;
  })() : '';
  const filterHtml = filterId ? `
      <button type="button" class="btn btn--bare btn--sm catbar__filter" id="${esc(filterId)}"
        aria-expanded="${!panelHidden}"${panelId ? ` aria-controls="${esc(panelId)}"` : ''}>
        ${icon('Filter', 'btn__icon')}<span class="btn__text">${esc(filterLabel)}</span><span
          class="catbar__fcount"${filterCount ? '' : ' hidden'}>${filterCount ? `(${filterCount})` : ''}</span>${
        icon('ChevronDown', 'catbar__chev')}
      </button>` : '';
  return `
    <div class="catbar catbar--no-search">
      <div class="catbar__count" id="${esc(countId)}">${count}</div>
      <div class="catbar__controls">${sortHtml}${filterHtml}${extra}${views ? viewSwitch(view, views) : ''}</div>
    </div>${filterId ? `
    <div class="catbar__panel" id="${esc(panelId)}"${panelHidden ? ' hidden' : ''}>${panel}</div>` : ''}`;
}

/** Portal `filterGroup`. Der Index in der id ist stabil, weil die Werte in
 *  fester Reihenfolge aus den Daten kommen — Fokuswiederherstellung braucht das. */
export function filterGroup({ dim, legend, options = [], selected = [] }) {
  const cb = (o, i) => `<label class="filter-check"><input type="checkbox" id="f-${esc(dim)}-${i}"
    data-fdim="${esc(dim)}" value="${esc(o.value)}"${selected.includes(o.value) ? ' checked' : ''
    }><span>${esc(o.label)}</span></label>`;
  return `<fieldset class="filter-group"><legend class="filter-group__legend">${esc(legend)}</legend>${
    options.map(cb).join('')}</fieldset>`;
}

export const panelReset = (href) => `<div class="catbar__panel-actions">
  <a class="btn btn--link btn--sm" href="${esc(href)}"><span class="btn__text">Filter zurücksetzen</span></a></div>`;

/** Portal `activeFilters` — entfernbare Pillen als echte .tag-item-Bauteile
 *  (volle 44px-Höhe, eigener Fokusring), nicht als 32px-Badges. */
export function activeFilters({ filters, resetHref, label = 'Aktive Filter:' }) {
  if (!filters || !filters.length) return '';
  const pill = (f, i) => `<a class="tag-item tag-item--sm active-filter" id="af-${i}"
    href="${esc(f.href)}" aria-label="Filter «${esc(f.label)}» entfernen"><span class="tag-item__inner"
    ><span class="tag-item__text">${esc(f.label)}</span>${icon('Cancel', 'tag-item__icon')}</span></a>`;
  return `<div class="active-filters" role="group" aria-label="Aktive Filter">
    <span class="small muted">${esc(label)}</span>
    ${filters.map(pill).join('')}
    <a class="btn btn--link" href="${esc(resetHref)}"><span class="btn__text">Alle Filter zurücksetzen</span></a>
  </div>`;
}

/** Portal `pagination`. Ein echter deaktivierter <button> an den Enden, wie in
 *  CDs PaginationItem.vue: ein <span aria-label> hat role=generic und darf
 *  keinen Namen tragen — Screenreader melden ihn unzuverlässig. */
export function pagination({ page, totalPages, href, inputId, label = 'Seitennavigation' }) {
  if (totalPages <= 1) return '';
  const control = (target, text, iconName, disabled, key) => {
    const inner = `${icon(iconName, 'btn__icon')}<span class="btn__text">${text}</span>`;
    if (disabled) return `<li><button type="button" class="btn btn--outline btn--icon-only" disabled aria-label="${text}">${inner}</button></li>`;
    return `<li><a class="btn btn--outline btn--icon-only" id="${esc(inputId)}-${key}" href="${esc(href(target))}" aria-label="${text}">${inner}</a></li>`;
  };
  return `
    <nav class="pagination-wrap" aria-label="${esc(label)}">
      <div class="pagination">
        <label class="sr-only" for="${esc(inputId)}">Seite</label>
        <input id="${esc(inputId)}" class="pagination__input" type="text" inputmode="numeric"
          value="${page}" autocomplete="off">
        <div class="pagination__text">von ${totalPages} Seiten</div>
        <ul class="pagination__items">
          ${control(page - 1, 'Vorherige Seite', 'ChevronLeft', page === 1, 'prev')}
          ${control(page + 1, 'Nächste Seite', 'ChevronRight', page === totalPages, 'next')}
        </ul>
      </div>
    </nav>`;
}

/** Portal `table`, reduziert auf das, was die Protokollansicht braucht. */
export function table({ caption, columns, rows, zebra = false }) {
  const head = columns.map((c) => `<th scope="col"${c.align === 'right' ? ' class="text-right"' : ''}>${esc(c.label)}</th>`).join('');
  const body = rows.map((r) => `<tr>${columns.map((c, i) => {
    const value = c.render ? c.render(r) : esc(r[c.key]);
    const cls = c.align === 'right' ? ' class="text-right"' : (c.nowrap ? ' class="text-nowrap"' : '');
    return i === 0 ? `<th scope="row"${cls}>${value}</th>` : `<td${cls}>${value}</td>`;
  }).join('')}</tr>`).join('');
  return `<div class="table-wrapper"><table class="table${zebra ? ' table--zebra' : ''}${caption ? ' table--caption' : ''}">
    ${caption ? `<caption>${esc(caption)}</caption>` : ''}
    <thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/* --------------------------------------------------- Katalog-Zustand ----- */
// Portal js/ui/components/catalogue.js `catalogueHash` / `catalogueState`.
// Standardwerte (Seite 1, Standardansicht) bleiben AUS der Adresse, damit sie
// kurz und teilbar bleibt.
export function catalogueHash(base, { q = '', page = 1, view = '', defaultView = 'list', ...filters } = {}) {
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

export function catalogueState(query, { base, perPage = 10, sortOpts = [],
  views = ['list', 'gallery'], defaultView = 'list', filters = {} } = {}) {
  const q = (query.get('q') || '').trim();
  const rawView = query.get('view') || defaultView;
  const view = views.includes(rawView) ? rawView : defaultView;
  const rawSort = query.get('sort') || '';
  const sort = sortOpts.includes(rawSort) ? rawSort : '';
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

/* ----------------------------------------------------------- Ansage ------ */
// Portal C.announce: EINE dauerhafte Live-Region, deren Text mutiert wird. Eine
// frisch eingefügte Live-Region feuert nicht — deshalb steht sie in index.html
// und wird hier nur beschrieben.
export function announce(text) {
  const live = document.getElementById('live');
  if (live) live.textContent = String(text || '');
}
