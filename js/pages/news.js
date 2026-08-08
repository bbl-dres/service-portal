// News — its own L1 area (docs/sitemap.md §2.1). Until July 2026 it was a section
// of the former combined news-and-knowledge area; it was separated because a news item is dated and read
// once, while the reference layer is consulted repeatedly.
//
// Two locations: `#/news` (list) and `#/news/<id>` (item). No `?tab=` and no
// filter: the list is chronological, the only ordering people expect for news.


// Deferred collections for this route. The router calls core.ensure(needs)
// BEFORE render(); without this declaration, an accessor would read the still
// empty list and the view would show «no entries» instead of data
// (docs/code-review.md §3).
export const needs = ['news'];
import { formatDate } from '../format.js';
import * as links from '../links.js';
export default async function render(ctx) {
  const { params, C } = ctx;
  const id = params[0] ? C.safeDecode(params[0]) : '';
  return id ? newsDetail(ctx, id) : newsList(ctx);
}

function newsList(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  setTitle('News');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News' }]);

  const items = [...core.news()].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'News',
      lead: 'Aktuelle Mitteilungen rund um das BBL, das Kundenportal und die Bundesverwaltung.',
    })}
    <h2 class="sr-only">News-Beiträge</h2>
    ${/* CD grid names (grids.postcss): grid--responsive-cols-N + gap--responsive
          instead of the portal-specific grid--N aliases (review layout/grid-3/-4). */''}
    <div class="grid grid--responsive-cols-3 gap--responsive mt-6">
      ${/* One source for the news card: C.card supplies the stretched-link pattern
            (real <h3> elements for the outline) and the CD card footer. */''}
      ${items.length ? items.map(n => C.card({
        title: n.title, desc: n.teaser,
        href: links.news(n.id),
        photo: { src: n['bild'] && n['bild'].src, color: n.color, alt: '' },
        footerInfo: `${C.escape(formatDate(n.date))} · ${C.escape(n.source)}`, footerAction: C.cardAction(),
      })).join('') : ''}
    </div>
    ${/* Use «Mitteilung» for an individual item; «Meldung» belongs to incident
          reporting (fault/security incident, D3). Unfiltered list → «vorhanden». */''}
    ${items.length ? '' : C.empty('Keine Mitteilungen vorhanden.', { available: core.available('news') })}
  </div>`;
}

// An individual news item gets its own page, title, h1, and breadcrumb.
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
    ${/* detailBar as on every other detail page. News was the only one without
          a share/print bar, although an article is the archetypal print/share
          target (B6, CD detailPressRelease). */''}
    ${C.detailBar({ backHref: '#/news', backLabel: 'News' })}
    ${/* The app's only long reading surface. Measure and rhythm come from the CD
          container__center--xs + .vertical-spacing; the date line and title stay
          close together inside <header> rather than being spaced 1rem apart like
          every other child. */''}
    <div class="container--grid">
      <article class="container__center--xs vertical-spacing mt-4">
        <header>
          <p class="small muted">${C.escape(formatDate(n.date))} · ${C.escape(n.source)}</p>
          <h1 tabindex="-1">${C.escape(n.title)}</h1>
        </header>
        ${C.photo({ src: n['bild'] && n['bild'].src, color: n.color, alt: '', w: 1200, cls: 'news-detail__photo' })}
        <p class="lead">${C.escape(n.teaser)}</p>
        <div class="separator separator--md"></div>
        <p>${C.escape(n.body)}</p>
      </article>
    </div>
  </div>`;
}
