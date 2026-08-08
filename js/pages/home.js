// Overview (home page) — a workspace, not a news wall.
//
// Ordered by how someone uses the page:
//   search → open cases → frequently used services →
//   applications and resources → news.
// See docs/design-review.md P1-1 for the rationale: an intranet supports
// repeated task completion rather than first-time orientation, so this
// deliberately does not follow the structure of public federal websites.

import { attachSuggest } from '../search-suggest.js';
import { statusLabel } from '../domain.js';
import { formatDate } from '../format.js';
import * as links from '../links.js';



// Deferred collections for this route. The router calls core.ensure(needs)
// BEFORE render(); without this declaration, an accessor would read the still
// empty list and the view would show «no entries» instead of data
// (docs/code-review.md §3).
export const needs = ['news', 'applications'];   // Tile images come from application records.
const CLOSED = ['abgeschlossen', 'erledigt', 'geliefert'];

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

  const services = core.services();
  const news = core.news().slice(0, 3);
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

  // Frequently used service — a text tile without an image, because the
  // destination matters here rather than the illustration.
  // The tile label is a real <h3>. It was a <span>, so it was absent from the
  // document outline and the home page offered no heading jump within
  // the frequently-used section. <a> has a transparent HTML5 content model, so a heading
  // inside it is valid.
  const serviceTile = (s) => `
    <a class="quick-tile plain-link" href="#/services/${encodeURIComponent(s.serviceId)}">
      ${C.icon(s.icon || 'ArrowRight', 'icon--md')}
      <div class="quick-tile__text">
        <h3 class="quick-tile__label">${C.escape(s.title)}</h3>
        <span class="quick-tile__meta">${C.escape(s.short)}</span>
      </div>
    </a>`;

  /* ------------------------------------------------------------- BLOCKS -- */

  const blocks = [];

  // 1 · Open cases — only when signed in and when any exist.
  if (session.isLoggedIn() && open.length) blocks.push({
    title: 'Meine offenen Vorgänge',
    // Use C.table rather than hand-built markup. The home page alone had custom
    // table markup, making its padding, separators, and scroll hint differ from
    // every other view.
    body: C.table({
      caption: 'Meine offenen Vorgänge', zebra: true, rowsClickable: true,
      columns: [
        { key: 'reference', label: 'Referenz', width: '10rem',
          render: (i) => `<a href="${links.caseDetails(i.instanceId)}">${C.escape(i.reference)}</a>` },
        { key: 'title', label: 'Titel', render: (i) => C.escape(i.title) },
        { key: 'updatedAt', label: 'Aktualisiert', width: '9rem', render: (i) => C.escape(formatDate(i.updatedAt || i.createdAt)) },
        { key: 'status', label: 'Status', width: '11rem', render: (i) => C.statusBadge(i.status, statusLabel(core, i.status)) },
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
    title: 'Häufig gebraucht',
    body: `<div class="grid grid--responsive-cols-3">${popular.map(serviceTile).join('')}</div>`,
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
  blocks.push({
    title: 'Anwendungen, Hilfsmittel und weitere Angebote',
    body: `<div class="grid grid--responsive-cols-3">${HIGHLIGHTS.map(h => C.card({
      title: h.title, desc: h.desc, href: h.href,
      photo: { src: h.appId ? (core.application(h.appId)?.['bild']?.src || '') : h.src, alt: '' },
      footerInfo: h.foot, footerAction: C.cardAction(),
    })).join('')}</div>`,
  });

  // 5 · News — image gallery (CD TopNewsSection). Use «News», matching navigation
  // and destination; the click path previously used three names for one place (D3).
  if (news.length) blocks.push({
    title: 'News',
    body: `<div class="grid grid--responsive-cols-3">${news.map(n => C.card({
      title: n.title, desc: n.teaser,
      href: links.news(n.id),
      photo: { src: n['bild'] && n['bild'].src, color: n.color, alt: '' },
      footerInfo: `${C.escape(formatDate(n.date))} · ${C.escape(n.source)}`, footerAction: C.cardAction(),
    })).join('')}</div>`,
    more: { href: '#/news', label: 'Alle News anzeigen' },
  });

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
          <form class="home-search hero__cta" id="home-search" role="search">
            <label class="sr-only" for="home-q">Im Portal suchen</label>
            <input id="home-q" type="search" placeholder="Wonach suchen Sie? z. B. Störung, Raumbedarf, Bauprojekt…" autocomplete="off">
            <button class="btn btn--filled btn--lg btn--icon-left" type="submit">${C.icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span></button>
          </form>
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
    ${sections}`;

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
  // without an extra request (js/search-suggest.js explains why the full index
  // is not used). Clean up through the router's unmount contract so the list
  // does not remain in the DOM after navigation.
  const detach = attachSuggest(mount.querySelector('#home-q'), searchForm, core, C);
  if (ctx.onUnmount) ctx.onUnmount(detach);
}
