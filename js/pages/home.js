// Overview (home page) — a workspace, not a news wall.
//
// Ordered by how someone uses the page:
//   search → open cases → frequently used services →
//   applications and resources → news.
// See docs/design-review.md P1-1 for the rationale: an intranet supports
// repeated task completion rather than first-time orientation, so this
// deliberately does not follow the structure of public federal websites.

import { attachSuggest } from '../search/search-suggest.js';
import { sourcesControl, wireSources, restoreSourcesFocus } from '../search/search-ui.js';
import { statusLabel } from '../domain.js';
import { formatDate } from '../format.js';
import * as links from '../links.js';



// Deferred collections for this route. The router calls core.ensure(needs)
// BEFORE render(); without this declaration, an accessor would read the still
// empty list and the view would show «no entries» instead of data
// (docs/code-review.md §3).
// `applications` (~85 KB) is deliberately NOT in needs: the route used to
// block on it to look up four tile images. The cards render with their
// coloured placeholder tiles and the images are patched in when the file
// arrives (code review 2026-08, F-S7).
export const needs = ['news'];
const CLOSED = ['abgeschlossen', 'erledigt', 'geliefert'];

// «Aktuell» carousel page — module-scoped so paging survives the IN-PAGE
// carousel repaints without leaking to window; render() resets it, so a new
// visit always opens on the first slide (F-S2).
let aktuellPage = 0;

// Topic tiles (construction projects · accommodation · building operations ·
// security) once formed a separate home-page block. They were removed because
// the service drawer (router.js, `childrenFrom: 'topics'`) and the catalogue at
// #/services?topic=… expose these topics; the home page represents tasks, not
// the information hierarchy.

export default async function render(ctx) {
  const { mount, core, engine, session, C, setTitle, setCrumbs } = ctx;
  // Use «Startseite», matching the breadcrumb root. This tab alone was labelled
  // “Overview”, a word reserved for drawer first rows and detail tabs (D7).
  setTitle('Startseite');
  setCrumbs([]);

  // Fresh visit, first slide: the module scope only has to carry the page
  // across the in-page carousel repaints, not across navigations — coming
  // back from #/news used to reopen on whatever slide was last viewed
  // (code review 2026-08, F-S2).
  aktuellPage = 0;

  const services = core.services();
  const news = core.news();
  const cases = engine.instances();
  const open = cases.filter(i => !CLOSED.includes(i.status));

  /* ---------------------------------------------------------- BUILDING BLOCKS -- */

  // CD pattern (indexPage.vue, ServicesSection.vue): full-width sections
  // alternate white / secondary-50; the title sits at the top as .section__title
  // and the “all” link at bottom right as .section__action with btn--bare.
  // Content lives in .container. `alt` is assigned by position during assembly
  // so the bands always alternate cleanly.
  // This is the same building block used on hub pages (C.pageSection). The local
  // copy was the only place that constructed the CD section anatomy correctly.
  const section = ({ title, body, more }, alt) => C.pageSection({ title, body, more, alt });

  // Frequently used service — the SHARED cross-portal quick card (2026-08
  // alignment D41): white CD card--default/clickable anatomy with the corner
  // arrow, identical classes and geometry to the tenant portal's home band.
  // Verified against CD source: no grey icon tile exists there (.box is a
  // stacked commerce box), so the former tinted icon tile retired here; the
  // service icons stay in the catalogue and drawers where they lead rows.
  // The tile label is a real <h3>. It was a <span>, so it was absent from the
  // document outline and the home page offered no heading jump within
  // the frequently-used section. <a> has a transparent HTML5 content model, so a heading
  // inside it is valid.
  const serviceTile = (s) => `
    <a class="card--quick plain-link" href="#/services/${encodeURIComponent(s.serviceId)}">
      <h3 class="card--quick__title">${C.escape(s.title)}</h3>
      <p class="card--quick__desc">${C.escape(s.short)}</p>
      <span class="arrow-btn card--quick__arrow-btn" aria-hidden="true">${C.icon('ArrowRight', 'icon--base')}</span>
    </a>`;

  /* ------------------------------------------------------------- BLOCKS -- */

  const blocks = [];

  // Greeting strip — one line of personal context above the case preview,
  // ported from the tenant portal (alignment D44): time-of-day greeting,
  // first name, and the open-case count as an inline link; a Rückfrage count
  // follows when one exists, because that is the state waiting on the reader.
  const greetingFor = (hour) => hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
  const greetingStrip = (user) => {
    const rueckfragen = open.filter(i => i.status === 'rueckfrage').length;
    const sentence = open.length
      ? `Sie haben <a href="#/my-cases" class="greeting-strip__count"><strong>${open.length} ${open.length === 1 ? 'laufenden Vorgang' : 'laufende Vorgänge'}</strong></a>${rueckfragen ? `, <strong>${rueckfragen}</strong> mit Rückfrage` : ''}.`
      : 'Sie haben derzeit keine laufenden Vorgänge.';
    return `<p class="greeting-strip">${greetingFor(new Date().getHours())}, <strong>${C.escape(user.name.split(' ')[0])}</strong>. ${sentence}</p>`;
  };

  // 1 · Open cases — only when signed in and when any exist.
  if (session.isLoggedIn() && open.length) blocks.push({
    // The count is the TOTAL, not the five rows below it: the table is a preview,
    // and the number is what says so before the show-all link at the bottom does.
    // It sits on the heading rather than on that link (D4 removed it there — a
    // link labelled with a count reads as a filter, not as a destination), and
    // the heading is where every other counted collection in the portal carries
    // it.
    title: `Meine offenen Vorgänge (${open.length})`,
    // The strip precedes the table inside ONE band so greeting and preview
    // read as a single personal block, exactly as on the tenant home.
    // Use C.table rather than hand-built markup. The home page alone had custom
    // table markup, making its padding, separators, and scroll hint differ from
    // every other view.
    // NO fixed column widths and the same columns as the full list at #/my-cases:
    // this is the same five rows of the same records, and it has to look like a
    // preview of that table rather than a second design. The widths it used to
    // carry (10/9/11rem) were narrower than their own content — a case reference
    // and the longer status badges each broke onto a second line — while the
    // title column absorbed everything left over. Auto layout sizes each column
    // to what is in it; `nowrap` pins the identifier (see C.table).
    body: greetingStrip(session.user()) + C.table({
      caption: 'Meine offenen Vorgänge', zebra: true, rowsClickable: true,
      columns: [
        { key: 'reference', label: 'Referenz', nowrap: true,
          render: (i) => `<a href="${links.caseDetails(i.instanceId)}">${C.escape(i.reference)}</a>` },
        { key: 'title', label: 'Titel', render: (i) => C.escape(i.title) },
        { key: 'defName', label: 'Typ', render: (i) => C.escape(i.defName) },
        { key: 'updatedAt', label: 'Aktualisiert', render: (i) => C.escape(formatDate(i.updatedAt || i.createdAt)) },
        { key: 'status', label: 'Status', render: (i) => C.statusBadge(i.status, statusLabel(core, i.status)) },
      ],
      rows: open.slice(0, 5),
    }),
    // The “show all” wording follows the shared more-link pattern. Only this
    // link carried a count, which was therefore removed (D4).
    more: { href: '#/my-cases', label: 'Alle Vorgänge anzeigen' },
  });

  // 2 · Frequently used services
  // `popular` is a RANK (1 = first tile), not a flag. The grid is uniform, so
  // reading order alone carries the weighting, and that belongs in the data,
  // not in the file order of services.json. Selection follows the real customer
  // platform's footer shortcuts (e-shop, complaint, templates, fault reports),
  // hence frequency rather than editorial prominence.
  const popular = services.filter(s => s.popular).sort((a, b) => a.popular - b.popular);
  if (popular.length) blocks.push({
    // The SHARED band heading (alignment D41): both portals name the band by
    // the noun their nav and CTA already use — «Dienstleistungen» — instead of
    // two different shorthands («Häufig gebraucht» here, «Häufig genutzte
    // Dienste» in the tenant portal).
    title: 'Häufig genutzte Dienstleistungen',
    // .card-grid — the shared auto-fit quick-card grid (same column breaks as
    // the tenant portal's band at every width).
    body: `<div class="card-grid">${popular.map(serviceTile).join('')}</div>`,
    more: { href: '#/services', label: 'Alle Dienstleistungen anzeigen' },
  });

  // 3 · Applications, resources, and other offerings — the most-used entry
  //     points across the platform: two applications, one resource collection,
  //     one external shop, and one document collection. Deliberately mixed and
  //     deliberately short: this is a selection, not a second menu.
  //     Five cards in a three-column grid produce 3+2, with no orphaned card.
  //
  //     Applications lead to their LANDING PAGE (#/applications/<appId>), not
  //     directly into the system. This is the same rule as in the application
  //     catalogue: each application has its own entry points, access rules, and
  //     contacts, all explained on the landing page. Only resources link directly
  //     to their collection because there is nothing else to explain.
  /* Application tiles use the APPLICATION RECORD'S IMAGE
        (applications.json compatibility key `bild`), so the home page,
        catalogue card, and landing page show the same subject (user finding,
        2026-08-04: the data portal previously used a different image here from
        its landing page). Only the knowledge tile has no record and therefore
        brings its image from the heroes pool. */
  const HIGHLIGHTS = [
    { appId: 'datenportal', href: '#/applications/datenportal',
      title: 'Datenportal',
      desc: 'Auswertungen und Kennzahlen des BBL — Energie, Immobilien, Beschaffung, Personal und Logistik.',
      foot: 'Anwendung' },
    { appId: 'liegenschaften-inventar', href: '#/applications/liegenschaften-inventar',
      title: 'Liegenschaften Inventar',
      desc: 'Gebäude und Grundstücke des Bundes auf der Karte, mit Flächen, Verträgen, Kosten und Dokumenten.',
      foot: 'Anwendung' },
    { title: 'Informatik und IKT-Beschaffung', href: '#/knowledge/it', src: 'assets/images/heroes/it-beschaffung.jpg',
      desc: 'Mustervorlagen, Werkzeugkasten und Vorgaben für Beschaffungen im Informatikbereich.',
      foot: 'Hilfsmittel' },
    { appId: 'bundespublikationen', href: '#/applications/bundespublikationen',
      title: 'Bundespublikationen-Shop',
      desc: 'Publikationen und Drucksachen des Bundes ab Lager bestellen.',
      foot: 'Anwendung' },
    { appId: 'dokumentenarchiv', href: '#/applications/dokumentenarchiv',
      title: 'Bauwerksdokumentation',
      desc: 'Pläne, Dokumentationen und Berichte je Gebäude suchen und beziehen.',
      foot: 'Anwendung' },
  ];
  const highlightsGrid = () => `<div class="grid grid--responsive-cols-3" id="home-highlights">${HIGHLIGHTS.map(h => C.card({
    title: h.title, desc: h.desc, href: h.href,
    photo: { src: h.appId ? (core.application(h.appId)?.['bild']?.src || '') : h.src, alt: '' },
    footerInfo: h.foot, footerAction: C.cardAction(),
  })).join('')}</div>`;
  blocks.push({
    title: 'Anwendungen, Hilfsmittel und weitere Angebote',
    body: highlightsGrid(),
  });

  // 5 · Aktuell — the news carousel, byte-matching the tenant portal's home
  // band (2026-08 alignment D51; user decision): «Aktuell» heading, three
  // card--profile teasers per page, prev/next arrows at the CD carousel sizes
  // (carousel.postcss:74-76 — 48px svg, 56 from lg), CD bullet dots
  // (carousel.postcss:36-47) and a «Weitere News» link in the footer. It
  // replaced a static three-card «News» grid. Rendered OUTSIDE the blocks
  // list: it owns its band colour (secondary-100, one shade darker than the
  // alternating secondary-50 bands) and its footer replaces the section
  // more-link.
  const aktuellCard = (n) => `
    <a class="card--profile news-card" href="${links.news(n.id)}">
      ${n.bild && n.bild.src ? `<img class="card--profile__image" src="${C.escape(n.bild.src)}" alt="" loading="lazy" decoding="async" width="400" height="200">` : ''}
      <div class="card--profile__body">
        <p class="card--profile__date"><strong>${C.escape(n.source)}</strong> &nbsp;|&nbsp; ${C.escape(formatDate(n.date))}</p>
        <h3 class="card--profile__title">${C.escape(n.title)}</h3>
        <p class="card--profile__desc">${C.escape((n.teaser || '').length > 160 ? n.teaser.slice(0, 157) + '…' : (n.teaser || ''))}</p>
      </div>
      <span class="arrow-btn card--profile__arrow" aria-hidden="true">${C.icon('ArrowRight', 'icon--base')}</span>
    </a>`;
  const AKTUELL_PER_PAGE = 3;
  const aktuellSection = () => {
    const totalPages = Math.max(1, Math.ceil(news.length / AKTUELL_PER_PAGE));
    if (aktuellPage >= totalPages) aktuellPage = 0;
    const page = aktuellPage;
    const visible = news.slice(page * AKTUELL_PER_PAGE, page * AKTUELL_PER_PAGE + AKTUELL_PER_PAGE);
    return `
    <section class="news-section section section--default" aria-labelledby="newsSectionTitle">
      <div class="container">
        <h2 class="section__title" id="newsSectionTitle">Aktuell</h2>
        <div class="news-section__viewport">
          <button class="news-section__nav news-section__nav--prev" type="button" aria-label="Vorherige Nachrichten"
                  data-news-page="${page - 1}" ${page === 0 ? 'disabled' : ''}>${C.icon('ChevronLeft')}</button>
          <div class="news-section__track">${visible.map(aktuellCard).join('')}</div>
          <button class="news-section__nav news-section__nav--next" type="button" aria-label="Nächste Nachrichten"
                  data-news-page="${page + 1}" ${page >= totalPages - 1 ? 'disabled' : ''}>${C.icon('ChevronRight')}</button>
        </div>
        <div class="news-section__footer">
          ${/* role=group, NOT tablist: these are plain page buttons without
                tab/tabpanel semantics — a tablist with non-tab children reads
                as empty to AT (code review 2026-08, F-S8). */''}
          <div class="news-section__dots" role="group" aria-label="Seiten">
            ${Array.from({ length: totalPages }, (_, i) => `
              <button type="button" class="news-section__dot ${i === page ? 'news-section__dot--active' : ''}"
                      aria-label="Seite ${i + 1}${i === page ? ', aktiv' : ''}"
                      ${i === page ? 'aria-current="true"' : ''}
                      data-news-page="${i}"></button>
            `).join('')}
          </div>
          <a class="news-section__more" href="#/news">Weitere News ${C.icon('ArrowRight')}</a>
        </div>
      </div>
    </section>`;
  };

  // The hero is white; bands alternate after it, starting with grey.
  const sections = blocks.map((b, i) => section(b, i % 2 === 0)).join('');

  mount.innerHTML = `
    <div class="container">
      ${/* CD hero--main-image (hero.postcss:73-90): content on the left and image
            on the right in the same grid. The hero supplies its own section
            rhythm; the search row occupies the CTA slot. */''}
      <div class="hero hero--main-image">
        <div class="hero__content">
          <h1 class="hero__title" tabindex="-1">Willkommen im BBL Kundenportal</h1>
          <p class="hero__description">Dienstleistungen, Anwendungen, Dokumente und Daten des Bundesamts für Bauten und Logistik — an einem Ort.</p>
          <div class="hero__search">
          <form class="home-search" id="home-search" role="search">
            <label class="sr-only" for="home-q">Im Portal suchen</label>
            ${/* The field gets a box of its own so the suggestion popup can be
                  anchored to IT. attachSuggest appends the listbox to the input's
                  parent (js/search/search-suggest.js), and that parent used to be
                  this whole row — so the popup ran the width of field PLUS
                  button, which is not what it belongs to. */''}
            <span class="home-search__field">
              <input id="home-q" type="search" placeholder="Wonach suchen Sie? z. B. Störung, Raumbedarf, Bauprojekt…" autocomplete="off">
            </span>
            <button class="btn btn--filled btn--lg btn--icon-left" type="submit">${C.icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span></button>
          </form>
          ${/* The source selection belongs to the field, not to the hero column:
                as a direct child of .hero__content it would pick up that
                column's gap and stand an unrelated distance away. */''}
          ${sourcesControl()}
        </div>
        </div>
        <div class="hero__image">
          ${/* The source image is 2048×1258 and displays at no more than ~714px.
                Previously each home-page visit loaded 511KB for about one ninth
                of those pixels (docs/code-review.md §5). `srcset` lets the browser
                choose the appropriate size; AVIF remains the largest tier for
                very wide or high-resolution displays. `width`/`height` establish
                the aspect ratio to prevent layout shift while loading. Variants
                are generated by scripts/make-image-variants.mjs. */''}
          <figure class="hero__figure">
            <img class="hero-media hero-media--16x9" src="assets/images/BBL-FE21_O-01-800.webp"
                 srcset="assets/images/BBL-FE21_O-01-800.webp 800w,
                         assets/images/BBL-FE21_O-01-1400.webp 1400w,
                         assets/images/BBL-FE21_O-01.avif 2048w"
                 sizes="(min-width:768px) 46vw, 92vw"
                 width="2048" height="1258"
                 alt="Der Hauptsitz des BBL an der Fellerstrasse 21 von aussen" loading="eager" decoding="async">
            <figcaption>Der Hauptsitz des BBL an der Fellerstrasse 21 von aussen — © BBL</figcaption>
          </figure>
        </div>
      </div>
    </div>
    ${sections}${news.length ? aktuellSection() : ''}`;

  // Carousel paging — delegated to `mount` so the handler survives the
  // section swap; only the carousel repaints, the rest of the page keeps its
  // state (search input, open menus). `mount` is #main-content and PERSISTS
  // across routes, so the handler must go through ctx.onUnmount like every
  // other mount-level listener on this page — without it, each visit stacked
  // another handler for the life of the tab (code review 2026-08, F-S1).
  const onCarouselClick = (e) => {
    const btn = e.target.closest('[data-news-page]');
    if (!btn || btn.disabled || !btn.closest('.news-section')) return;
    const next = parseInt(btn.getAttribute('data-news-page'), 10);
    if (Number.isNaN(next)) return;
    const wasDot = btn.classList.contains('news-section__dot');
    const wasNext = btn.classList.contains('news-section__nav--next');
    aktuellPage = Math.max(0, next);
    const sec = mount.querySelector('.news-section');
    if (!sec) return;
    sec.outerHTML = aktuellSection();
    // The swap destroys the activated control — put focus on its successor
    // instead of letting it drop to <body> (WCAG 2.4.3; F-S9).
    const fresh = mount.querySelector('.news-section');
    const target = wasDot
      ? fresh?.querySelector(`.news-section__dot[data-news-page="${aktuellPage}"]`)
      : (fresh?.querySelector(`.news-section__nav--${wasNext ? 'next' : 'prev'}:not([disabled])`)
        || fresh?.querySelector('.news-section__nav:not([disabled])'));
    target?.focus();
  };
  mount.addEventListener('click', onCarouselClick);
  if (ctx.onUnmount) ctx.onUnmount(() => mount.removeEventListener('click', onCarouselClick));

  // Row clicks in the cases table (C.table `rowsClickable`).
  const unwireRows = C.wireTableRows(mount);
  if (ctx.onUnmount) ctx.onUnmount(unwireRows);

  const searchForm = mount.querySelector('#home-search');
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = mount.querySelector('#home-q').value.trim();
    location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/search';
  });

  // Search suggestions cover only services and knowledge/resources, both
  // without an extra request (js/search/search-suggest.js explains why the full index
  // is not used). Clean up through the router's unmount contract so the list
  // does not remain in the DOM after navigation.
  const detach = attachSuggest(mount.querySelector('#home-q'), searchForm, core, C);
  if (ctx.onUnmount) ctx.onUnmount(detach);

  // A changed source selection only changes the sentence under the search
  // field (searches read the selection at query time) — so only the control
  // repaints. The former full `render(ctx)` rebuilt hero, tables, cards and
  // carousel per checkbox tick, and stacked one more carousel listener each
  // time via the re-entrant render (code review 2026-08, F-S10).
  const repaintSources = () => {
    const el = mount.querySelector('.search-sources');
    if (!el) return;
    el.outerHTML = sourcesControl();
    wireSources(mount, repaintSources);
    restoreSourcesFocus(mount);
  };
  wireSources(mount, repaintSources);
  restoreSourcesFocus(mount);

  // Deferred tile images (F-S7): the applications file arrives after first
  // paint; patch the four highlight cards when it does. If the user has
  // already navigated on, the grid is gone and the patch is a no-op.
  void core.ensure(['applications']).then(() => {
    const grid = mount.querySelector('#home-highlights');
    if (grid) grid.outerHTML = highlightsGrid();
  }).catch(() => { /* the data banner reports the failure */ });
}
