// News — its own L1 area (docs/sitemap.md §2.1). Until July 2026 it was a section
// of the former combined news-and-knowledge area; it was separated because a news item is dated and read
// once, while the reference layer is consulted repeatedly.
//
// Two locations: `#/news` (list) and `#/news/<id>` (item).
//
// The LIST is the CD's own news-list page, verified against the design-system
// source (app/pages/newsList.vue + css/components/search.postcss «SEARCH
// RESULTS PAGE»; 2026-08 alignment D46): a tinted header band with the h1 and a
// COLLAPSED filter drawer (keyword, Herausgeber, date range — the fields this
// portal's news actually carries; the CD demo's Organisation/Themen selects are
// its own examples), active filters as removable chips, then a results section
// with the count + sort + list/gallery display toggle, LIST view by default
// (bbl.admin.ch news ships `display=list`), rows with a right-hand thumbnail
// where an image exists, and pagination when a second page exists. State lives
// in the URL query, like every catalogue view. The tenant portal renders the
// same anatomy.

// Deferred collections for this route. The router calls core.ensure(needs)
// BEFORE render(); without this declaration, an accessor would read the still
// empty list and the view would show «no entries» instead of data
// (docs/code-review.md §3).
export const needs = ['news'];
import { formatDate } from '../format.js';
import * as links from '../links.js';

const PAGE_SIZE = 6;

export default async function render(ctx) {
  const { params, C } = ctx;
  const id = params[0] ? C.safeDecode(params[0]) : '';
  return id ? newsDetail(ctx, id) : newsList(ctx);
}

// URL query → filter state. Every control writes back through hashFor(), so
// reload/share preserves the view (state-only changes re-render in place).
function newsState(query) {
  const q = (query.get('q') || '').trim();
  return {
    q,
    herausgeber: query.get('herausgeber') || '',
    von: query.get('von') || '',
    bis: query.get('bis') || '',
    sort: ['datum-auf', 'titel'].includes(query.get('sort')) ? query.get('sort') : 'datum-ab',
    view: query.get('view') === 'galerie' ? 'galerie' : 'liste',
    seite: Math.max(1, parseInt(query.get('seite') || '1', 10) || 1),
  };
}

function hashFor(state, overrides = {}) {
  const next = { ...state, ...overrides };
  const parts = [];
  if (next.q) parts.push('q=' + encodeURIComponent(next.q));
  if (next.herausgeber) parts.push('herausgeber=' + encodeURIComponent(next.herausgeber));
  if (next.von) parts.push('von=' + encodeURIComponent(next.von));
  if (next.bis) parts.push('bis=' + encodeURIComponent(next.bis));
  if (next.sort !== 'datum-ab') parts.push('sort=' + next.sort);
  if (next.view !== 'liste') parts.push('view=' + next.view);
  if (next.seite > 1) parts.push('seite=' + next.seite);
  return '#/news' + (parts.length ? '?' + parts.join('&') : '');
}

function applyFilters(items, state) {
  let rows = items;
  if (state.q) {
    const needle = state.q.toLowerCase();
    rows = rows.filter(n => [n.title, n.teaser, n.body, n.source].join(' ').toLowerCase().includes(needle));
  }
  if (state.herausgeber) rows = rows.filter(n => n.source === state.herausgeber);
  if (state.von) rows = rows.filter(n => String(n.date) >= state.von);
  if (state.bis) rows = rows.filter(n => String(n.date) <= state.bis);
  if (state.sort === 'titel') rows = [...rows].sort((a, b) => a.title.localeCompare(b.title, 'de'));
  else if (state.sort === 'datum-auf') rows = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  else rows = [...rows].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return rows;
}

function newsList(ctx) {
  const { mount, core, C, query, navigate, setTitle, setCrumbs } = ctx;
  setTitle('News');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News' }]);

  const state = newsState(query);
  const all = core.news();
  const rows = applyFilters(all, state);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const seite = Math.min(state.seite, totalPages);
  const pageRows = rows.slice((seite - 1) * PAGE_SIZE, seite * PAGE_SIZE);
  const publishers = [...new Set(all.map(n => n.source).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));

  // Active filters as removable chips (CD `.search__filters__tags`,
  // newsList.vue:95-120) — each chip clears exactly its own filter; the reset
  // chip clears them all. Anatomy = this portal's search-page active-filter
  // tag-items.
  const chip = (label, overrides) => `
    <a class="tag-item active-filter" href="${hashFor(state, { seite: 1, ...overrides })}">
      <span class="tag-item__inner"><span class="tag-item__text">${C.escape(label)}</span>${C.icon('Cancel', 'tag-item__icon')}</span>
    </a>`;
  const chips = [
    state.q ? chip(`«${state.q}»`, { q: '' }) : '',
    state.herausgeber ? chip(state.herausgeber, { herausgeber: '' }) : '',
    (state.von || state.bis) ? chip(`${state.von ? formatDate(state.von) : '…'} – ${state.bis ? formatDate(state.bis) : '…'}`, { von: '', bis: '' }) : '',
  ].filter(Boolean);
  const tagsRow = chips.length
    ? `<div class="search__filters__tags">${chips.join('')}
        <a class="tag-item" href="${hashFor(state, { q: '', herausgeber: '', von: '', bis: '', seite: 1 })}">
          <span class="tag-item__inner"><span class="tag-item__text">Filter zurücksetzen</span>${C.icon('Repeat', 'tag-item__icon')}</span>
        </a>
      </div>`
    : '';

  // LIST row — the CD `card--list` slot order (SearchResultsList.vue): meta
  // (Herausgeber | Datum), title, teaser, thumbnail on the right where an
  // image exists (hidden on phones). Rows reuse the search page's flat-row
  // recipe, which already carries the CD card--flat ramp.
  const listRow = (n) => `
    <li class="search-result">
      <a class="search-result__link search-result__link--media" href="${links.news(n.id)}">
        <div class="search-result__body">
          <p class="meta-info search-result__meta">
            <span class="meta-info__item"><strong>${C.escape(n.source)}</strong></span>
            <span class="meta-info__item">${C.escape(formatDate(n.date))}</span>
          </p>
          <h3 class="search-result__title">${C.escape(n.title)}</h3>
          <p class="search-result__desc">${C.escape(n.teaser)}</p>
        </div>
        ${n.bild && n.bild.src ? `<img class="search-result__image" src="${C.escape(n.bild.src)}" alt="" loading="lazy" decoding="async" width="180" height="120">` : ''}
      </a>
    </li>`;

  // GALLERY view — the portal's standard news card (C.card), as before.
  const galleryCards = pageRows.map(n => C.card({
    title: n.title, desc: n.teaser,
    href: links.news(n.id),
    photo: { src: n.bild && n.bild.src, color: n.color, alt: '' },
    footerInfo: `${C.escape(formatDate(n.date))} · ${C.escape(n.source)}`, footerAction: C.cardAction(),
  })).join('');

  // The view toggle is the portal-wide `.view-switch` control (same classes as
  // the catalogue bars), rendered as links because the state lives in the URL.
  // Links use aria-current, not aria-pressed — that attribute belongs to
  // buttons (2026-08 alignment, view-toggle unification).
  const viewBtn = (view, iconName, label) => `
    <a class="view-switch__btn${state.view === view ? ' view-switch__btn--active' : ''}" href="${hashFor(state, { view })}"
       aria-label="${label}"${state.view === view ? ' aria-current="true"' : ''}>${C.icon(iconName, 'icon--md')}</a>`;

  mount.innerHTML = `
  <section class="section section--default bg--secondary-50">
    <div class="container">
      <h1 tabindex="-1">News</h1>
      <div class="search__filters">
        <!-- No show/hide toggle: the CD news page collapses this drawer behind
             a «Filter anzeigen» button (newsList.vue:60-88), but with four
             fields the indirection bought nothing — filters stay visible
             (user decision, 2026-08; kept-deviation under D46). -->
        <form class="search__filters__drawer" id="news-filters" data-filter-form>
          <div class="form__group__input">
            <label for="news-q">Stichwortfilter</label>
            <input id="news-q" name="q" type="text" class="input--outline input--sm" value="${C.escape(state.q)}" autocomplete="off">
          </div>
          ${C.select({
            id: 'news-herausgeber', label: 'Herausgeber', size: 'sm', value: state.herausgeber,
            options: [{ value: '', label: '- Alle -' }, ...publishers.map(p => ({ value: p, label: p }))],
          })}
          <div class="form__group__input">
            <label for="news-von">Zeitraum | Startdatum</label>
            <input id="news-von" name="von" type="date" class="input--outline input--sm" value="${C.escape(state.von)}">
          </div>
          <div class="form__group__input">
            <label for="news-bis">Zeitraum | Enddatum</label>
            <input id="news-bis" name="bis" type="date" class="input--outline input--sm" value="${C.escape(state.bis)}">
          </div>
          <div class="search__filters__apply"><button class="btn btn--outline btn--sm" type="submit">
            <span class="btn__text">Filter anwenden</span></button></div>
        </form>
        ${tagsRow}
      </div>
    </div>
  </section>
  <section class="section section--default">
    <div class="container">
      <div class="search-results ${state.view === 'galerie' ? 'search-results--grid' : 'search-results--list'}">
        <div class="search-results__header">
          <div class="search-results__header__left">
            <div class="search-results__occurences"><strong>${rows.length}</strong>&nbsp;${rows.length === 1 ? 'Treffer' : 'Treffer'}</div>
          </div>
          <div class="search-results__header__right">
            ${C.select({
              id: 'news-sort', label: 'Sortierung', hideLabel: true, bare: true, size: 'sm', value: state.sort,
              options: [
                { value: 'datum-ab', label: 'Datum absteigend' },
                { value: 'datum-auf', label: 'Datum aufsteigend' },
                { value: 'titel', label: 'Titel A–Z' },
              ],
            })}
            <div class="view-switch search-results__views" role="group" aria-label="Ansicht">
              ${viewBtn('liste', 'List', 'Als Liste anzeigen')}
              ${viewBtn('galerie', 'Apps', 'Als Galerie anzeigen')}
            </div>
          </div>
        </div>
        <h2 class="sr-only">News-Beiträge</h2>
        ${pageRows.length
          ? (state.view === 'galerie'
            ? `<div class="grid grid--responsive-cols-3 gap--top">${galleryCards}</div>`
            : `<ul class="search-results-list">${pageRows.map(listRow).join('')}</ul>`)
          : C.empty('Keine Mitteilungen zu diesen Filtern.', { available: core.available('news') })}
        ${totalPages > 1 ? `
          <nav class="pagination-wrap pagination-wrap--right" aria-label="Seitennavigation">
            <div class="pagination">
              <a class="btn btn--bare btn--icon-only" href="${hashFor(state, { seite: Math.max(1, seite - 1) })}"
                 ${seite === 1 ? 'aria-disabled="true"' : ''} aria-label="Vorherige Seite">${C.icon('ChevronLeft', 'btn__icon')}<span class="btn__text">Zurück</span></a>
              <span class="pagination__text">Seite ${seite} von ${totalPages}</span>
              <a class="btn btn--bare btn--icon-only" href="${hashFor(state, { seite: Math.min(totalPages, seite + 1) })}"
                 ${seite === totalPages ? 'aria-disabled="true"' : ''} aria-label="Nächste Seite">${C.icon('ChevronRight', 'btn__icon')}<span class="btn__text">Weiter</span></a>
            </div>
          </nav>` : ''}
      </div>
    </div>
  </section>`;

  const drawer = mount.querySelector('[data-filter-form]');
  drawer?.addEventListener('submit', (e) => {
    e.preventDefault();
    navigate(hashFor(state, {
      q: drawer.querySelector('#news-q').value.trim(),
      herausgeber: drawer.querySelector('#news-herausgeber').value,
      von: drawer.querySelector('#news-von').value,
      bis: drawer.querySelector('#news-bis').value,
      seite: 1,
    }));
  });
  mount.querySelector('#news-sort')?.addEventListener('change', (e) => {
    navigate(hashFor(state, { sort: e.target.value, seite: 1 }));
  });
}

// An individual news item gets its own page, title, h1, and breadcrumb.
// Anatomy = the CD press-release detail (app/pages/detailPressRelease.vue,
// alignment D46): back + share row, then meta-info (Herausgeber | Datum),
// title, LEAD, figure — the CD hero--default order puts the lead BEFORE the
// image — then the body in the centred reading column.
function newsDetail(ctx, id) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const n = core.newsItem(id);
  if (!n) {
    C.renderNotFound(ctx, { thing: 'Diese Mitteilung', title: 'Mitteilung nicht gefunden',
      backHref: '#/news', backLabel: 'News',
      crumbs: [{ label: 'Startseite', href: '#/' }, { label: 'News', href: '#/news' }] });
    return;
  }
  setTitle(n.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News', href: '#/news' }, { label: n.title }]);
  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: '#/news', backLabel: 'News' })}
    <div class="container--grid">
      <article class="container__center--xs vertical-spacing mt-4">
        <header>
          <p class="meta-info">
            <span class="meta-info__item"><strong>${C.escape(n.source)}</strong></span>
            <span class="meta-info__item">${C.escape(formatDate(n.date))}</span>
          </p>
          <h1 tabindex="-1">${C.escape(n.title)}</h1>
        </header>
        <p class="lead">${C.escape(n.teaser)}</p>
        ${C.photo({ src: n.bild && n.bild.src, color: n.color, alt: '', w: 1200, cls: 'news-detail__photo' })}
        <p>${C.escape(n.body)}</p>
      </article>
    </div>
  </div>`;
}
