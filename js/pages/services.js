// Services — service directory (catalogue) and service detail.
import { audienceOptions, audienceLabel, audienceTags } from '../domain.js';
import { classifyUrl, newWindowAttrs, safeLinkUrl } from '../security/urls.js';
import { bookmarkButton, bookmarkMark, savedFilterDimension, savedFilterGroup, savedFilterPill, savedOnly } from '../ui/bookmark.js';
import { bookmarks } from '../core/bookmarks.js';
const MISSING_TARGET_MESSAGE = 'Im Prototyp ist kein Zielsystem angebunden.';

// Deferred collections for this route. The router calls core.ensure(needs)
// BEFORE render(); without this declaration, an accessor would read the still
// empty list and the view would show «no entries» instead of data
// (docs/code-review.md §3).
// `users` carries the bookmark seed — same contract as #/applications and
// #/data/catalog: the catalogue marks saved services and offers the favourites
// filter, the detail page draws the star, and neither can know what is saved
// before the directory is loaded (js/core/bookmarks.js seedOnce).
// `documents` feeds exactly one surface: the «Auch in …» cross-counter while
// a search query is active — so the plain catalogue no longer blocks on the
// largest content file (needs as a function of the query, the data.js
// pattern; code review 2026-08, F-S17).
export const needs = (params, query) => (params && params[0]) || (query && query.get('q'))
  ? ['applications', 'contacts', 'documents', 'users']
  : ['applications', 'contacts', 'users'];
export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs } = ctx;
  if (params[0]) return detail(ctx, params[0]);

  setTitle('Dienstleistungen');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen' }]);

  const domains = core.ref().domains || [];
  // The catalogue contains ONLY startable services (docs/sitemap.md §2.3).
  // `type: info` entries are reference pages dressed as services; the knowledge/
  // resources and data/digitalisation areas expose them. Their detail pages
  // remain reachable so shared links do not become dead ends.
  const all = core.services().filter(s => s.type === 'action');

  // Sorting (catbar): empty means data order (the «Sortieren» placeholder).
  const SORT_OPTIONS = [{ value: 'title', label: 'Bezeichnung (A–Z)' }, { value: 'domain', label: 'Bereich' }];
  const SORTS = {
    title: (a, b) => a.title.localeCompare(b.title, 'de'),
    domain: (a, b) => domainLabel(domains, a.domain).localeCompare(domainLabel(domains, b.domain), 'de') || a.title.localeCompare(b.title, 'de'),
  };
  // Read and validate the shared catalogue query contract in one place. Both
  // filters intentionally accept unknown values: the previous route preserved
  // them in shareable links and rendered a removable active-filter pill.
  const state = C.catalogueState(query, {
    base: '#/services', perPage: 12,
    sortOpts: SORT_OPTIONS.map((o) => o.value),
    filters: { audience: null, topic: null, ...savedFilterDimension() },
    trimQuery: false,
  });
  const { q: rawQ, view, sort: sortKey, hash } = state;
  const q = rawQ.toLowerCase();
  const selectedAudiences = state.selected.audience;
  const selectedTopics = state.selected.topic;
  const savedOnlyOn = savedOnly(state.selected.bookmark);

  const matches = (s) => !q || (s.title + ' ' + s.short + ' ' + s.description).toLowerCase().includes(q);
  const matchesAudience = (s) => !selectedAudiences.length || selectedAudiences.some(v => (s.audience || []).includes(v));
  const matchesTopic = (s) => !selectedTopics.length || selectedTopics.includes(s.domain);
  const matchesSaved = (s) => !savedOnlyOn || bookmarks.has('service', s.serviceId);
  const filtered = all.filter(s => matches(s) && matchesAudience(s) && matchesTopic(s) && matchesSaved(s));
  const services = sortKey ? filtered.slice().sort(SORTS[sortKey]) : filtered;
  const { visible: visibleServices, totalPages, page } = state.clamp(services);

  // “Also in” hint across other surfaces (services first, then content).
  const otherHits = q ? {
    apps: core.applications().filter(a => (a.name + a.description).toLowerCase().includes(q)).length,
    docs: core.documents().filter(d => d.title.toLowerCase().includes(q)).length,
  } : null;

  const serviceHref = (serviceId) => `#/services/${encodeURIComponent(String(serviceId ?? ''))}`;

  const card = (s) => C.card({
    title: s.title, desc: s.short, href: serviceHref(s.serviceId),
    // Placed by C.card — see applications.js. A service card carries no picture,
    // so here the pill-row copy is the only one and stays visible at every width.
    mark: bookmarkMark({ kind: 'service', id: s.serviceId }),
    badges: [audienceTags(core, C, s.audience)],
    footerInfo: C.escape(domainLabel(domains, s.domain)), footerAction: C.cardAction(),
  });

  const listView = (list) => C.table({
    caption: 'Dienstleistungen',
    zebra: true,
    // The first column is the row link; as in all catalogue list views, clicking
    // anywhere on the row follows it (consistent affordance, tbl-8).
    rowsClickable: true,
    columns: [
      { key: 'title', label: 'Dienstleistung', render: s => `<a href="${serviceHref(s.serviceId)}">${C.escape(s.title)}</a><br><span class="small muted">${C.escape(s.short)}</span>` },
      // One column of marks straight after the name — see applications.js.
      { key: 'bookmark', label: 'Favorit', labelHidden: true, align: 'center',
        render: s => bookmarkMark({ kind: 'service', id: s.serviceId }) },
      { key: 'domain', label: 'Bereich', render: s => C.escape(domainLabel(domains, s.domain)) },
      { key: 'audience', label: 'Zielgruppe', render: s => audienceTags(core, C, s.audience) },
    ],
    rows: list,
  });

  // Active-filter pills. Each pill links to the same view minus that one value,
  // so removing a filter needs no JS and stays deep-linkable.
  const activeFilters = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hash({ q: '', page: 1 }) }] : []),
    ...savedFilterPill(state.selected.bookmark, (patch) => hash({ ...patch, page: 1 })),
    ...selectedAudiences.map(a => ({ label: audienceLabel(core, a), href: hash({ audience: selectedAudiences.filter(x => x !== a), page: 1 }) })),
    ...selectedTopics.map(t => ({ label: domainLabel(domains, t), href: hash({ topic: selectedTopics.filter(x => x !== t), page: 1 }) })),
  ];
  const relatedHits = otherHits && (otherHits.apps + otherHits.docs)
    ? `Auch in: ${[
        otherHits.apps ? `<a href="#/applications?q=${encodeURIComponent(rawQ)}">${otherHits.apps} Anwendung(en)</a>` : '',
        otherHits.docs ? `<a href="#/app/document-archive?q=${encodeURIComponent(rawQ)}">${otherHits.docs} Dokument(e)</a>` : '',
      ].filter(Boolean).join(' · ')}`
    : '';

  const filterPanel = `
    ${/* Favourites first — see applications.js. */''}
    ${savedFilterGroup(state.selected.bookmark)}
    ${C.filterGroup({ dim: 'audience', legend: 'Zielgruppe', selected: selectedAudiences, options: audienceOptions(core) })}
    ${/* Derive topics from the data using the same rule as the drawer (ui/shell/header.js):
          a topic appears as soon as it has a case behind it. Raw field: `thema`
          compatibility flag in reference-data.json previously decided this and
          was stale: the drawer offered «Alle anzeigen» for procurement or
          publishing while the filter omitted those same topics. The filter could
          be set but neither seen nor deselected. The flag has been removed. */''}
    ${C.filterGroup({ dim: 'topic', legend: 'Thema', selected: selectedTopics,
      options: domains.filter(d => all.some(s => s.domain === d.key)).map(d => ({ value: d.key, label: d.label })) })}
    ${C.panelReset({ href: hash({ audience: [], topic: [], bookmark: [], page: 1 }) })}`;

  // Anatomy, ids and wiring from C.catalogueView — see applications.js.
  const catalogue = C.catalogueView({
    prefix: 'svc', hash, noun: 'Dienstleistung', unit: 'Dienstleistungen',
    title: 'Dienstleistungen',
    lead: 'Was möchten Sie tun? Als «Vorgang» gekennzeichnete Dienstleistungen starten einen Ablauf; Informationsangebote führen weiter.',
    q: rawQ, view, views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List']],
    page, totalPages, sort: { value: sortKey, options: SORT_OPTIONS },
    count: services.length, total: all.length,
    filterCount: selectedAudiences.length + selectedTopics.length + (savedOnlyOn ? 1 : 0),
    panel: filterPanel,
    activeFilters, resetHref: '#/services',
    visible: visibleServices, card, listView,
    available: core.available('services'), noteHtml: relatedHits || '',
  });

  mount.innerHTML = catalogue.html;
  catalogue.wire(mount, ctx);
}

function detail(ctx, id) {
  const { mount, core, engine, session, C, setTitle, setCrumbs } = ctx;
  const service = core.service(id);
  if (!service) {
    C.renderNotFound(ctx, { thing: 'Diese Dienstleistung', title: 'Dienstleistung nicht gefunden',
      backHref: '#/services', backLabel: 'Dienstleistungen',
      crumbs: [{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen', href: '#/services' }] });
    return;
  }
  setTitle(service.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen', href: '#/services' }, { label: service.title }]);

  const contact = core.contacts().find(c => c.contactId === service.contact);
  // processDefId was declaration-only: ten services carried the field and no
  // module read it (H11). This uses that edge so the case's process appears on
  // the page BEFORE submission. If the definition is missing, omit the block
  // silently because it is supplementary information, not a prerequisite.
  const definition = service.processDefId ? engine.definition(service.processDefId) : null;
  const target = service.target || {};   // Information offerings have no `target`; do not dereference it (A5).
  const isExternal = target.kind === 'external';
  const targetHref = safeLinkUrl(target.href);
  const ctaLabel = service.type === 'action' ? (isExternal ? 'Zum externen System' : 'Vorgang starten') : 'Öffnen';
  // A «#» target is a placeholder. Do not offer a dead button; explain that the
  // prototype is not connected to the target system.
  const hasTarget = !!targetHref;
  // «Zugriff» card, first card in the side column (user decision, 2026-08-04):
  // the same location and, since 2026-08-06, the same BUILDING BLOCK as on the
  // application landing page (C.accessCard). Previously the application placed
  // the button above the text, while the service reversed them at half the size,
  // although the card answers the same question on both pages. The building block
  // derives target, session hint, and safe new-tab contract together.
  const accessCard = C.accessCard({
    href: targetHref, label: ctaLabel, external: isExternal, newWindow: true,
    // Only starting a case (type=action) requires authentication. Information
    // offerings are public. External target systems provide their own login;
    // internal targets rely on the newly opened application's router login gate.
    requiresLogin: service.type === 'action' && !isExternal,
    loggedIn: session.isLoggedIn(), user: session.user(),
    free: service.type !== 'action' ? 'Frei zugänglich — keine Anmeldung erforderlich.' : '',
    // The second shape of the SAME control as the star on the hero image: one
    // reads at a glance from the picture, the other is findable by name in the
    // card people already scan for actions. wireBookmarks keeps both in step, so
    // clicking either flips the other on the spot.
    bookmark: bookmarkButton({ kind: 'service', id: service.serviceId, name: service.title, variant: 'link' }),
  });

  const ctaBlock = `<div class="row mt-4">
      ${/* CD Btn.vue: the icon comes first in the DOM, btn--icon-right reverses
            the order, and the label ALWAYS uses the .btn__text wrapper. */''}
      ${hasTarget
        ? `<a class="btn btn--outline btn--lg btn--icon-right" href="${C.escape(targetHref)}"${
            newWindowAttrs(targetHref, { external: isExternal && classifyUrl(targetHref) === 'external' })}>${
            C.icon('External', 'btn__icon')}<span class="btn__text">${ctaLabel}</span></a>`
        : `<span class="btn btn--outline btn--lg btn--icon-right" aria-disabled="true">${
            C.icon(isExternal ? 'External' : 'ArrowRight', 'btn__icon')}<span class="btn__text">${ctaLabel}</span></span>
           <span class="small muted">${MISSING_TARGET_MESSAGE}</span>`}
    </div>`;

  // One symbolic image per topic (verified inventory IDs), with a colour field
  // as fallback. This matches the topic images on the home and area pages. Use
  // the local hero pool (assets/images/heroes, attribution in its README) rather
  // than Unsplash hotlinks, following the 2026-08-04 image review.
  const HERO_BASE = 'assets/images/heroes/';
  const DOMAIN_PHOTOS = {
    A: HERO_BASE + 'domain-a.jpg', B: HERO_BASE + 'domain-b.jpg', U: HERO_BASE + 'domain-u.jpg',
    O: HERO_BASE + 'domain-o.jpg', G: HERO_BASE + 'domain-g.jpg', C: HERO_BASE + 'domain-c.jpg',
    D: HERO_BASE + 'domain-g.jpg', E: HERO_BASE + 'domain-o.jpg', F: HERO_BASE + 'domain-b.jpg',
  };
  const image = DOMAIN_PHOTOS[service.domain] || HERO_BASE + 'domain-o.jpg';

  mount.innerHTML = `
  <div class="container section">
    ${C.detailHead({
      backHref: '#/services', backLabel: 'Dienstleistungen',
      title: service.title, lead: service.short,
      tags: `${audienceTags(core, C, service.audience)}${service.type === 'action' ? C.badge('Vorgang', 'info') : C.badge('Information', 'gray')}`,
      image: C.heroFigure({ src: image, ratio: '16x9', loading: 'eager' }),   // LCP element (F-S21)
      // The same «merken» star as the dataset and application heads, in the same
      // corner of the same picture: the three detail pages are the surfaces
      // people arrive at from search, so one gesture has to mean one thing.
      bookmark: bookmarkButton({ kind: 'service', id: service.serviceId, name: service.title }),
    })}
    <div class="container--grid gap--responsive">
      ${/* CD content rhythm (.vertical-spacing, 3/3.5rem), not the portal-specific
            .stack. All primary detail columns should use the same scale
            (review layout/main-1). */''}
      <div class="container__main vertical-spacing">
        ${/* Apart from <h1>, the detail page had no outline level. Without
              prerequisites or guidance, it had no <h2>/<h3> at all. */''}
        <h2 class="sr-only">Beschreibung</h2>
        <p>${C.escape(service.description)}</p>
        ${service['voraussetzungen'] && service['voraussetzungen'].length ? `<div class="box"><h3>Das brauchen Sie</h3><ul class="list--default">${service['voraussetzungen'].map(v => `<li>${C.escape(v)}</li>`).join('')}</ul></div>` : ''}
        ${definition && Array.isArray(definition.steps) && definition.steps.length ? `<div class="box"><h3>So läuft es ab</h3>
          <p class="small muted">${C.escape(definition.name)} — ${definition.steps.length} Schritte. Den Stand sehen Sie danach unter <a href="#/my-cases">Meine Vorgänge</a>.</p>
          ${C.pipeline(definition.steps, 0, { label: `Ablauf «${definition.name}»` })}</div>` : ''}
        ${ctaBlock}
      </div>
      ${/* Do NOT use .stack-lg here: .container__aside > * already supplies the
            CD spacing between aside modules (1.75/2rem). A second rhythm utility
            would override it with 3rem (review layout/aside-1). */''}
      ${/* The legal-foundations card was removed (user decision, 2026-08-06). Every
            service repeated the same sentence and link to knowledge/resources,
            Hilfsmittel», without any service-specific information. The main
            navigation already provides the route there. */''}
      <aside class="container__aside" aria-labelledby="svc-aside-head">
        <h2 class="sr-only" id="svc-aside-head">Zugriff und Kontakt</h2>
        ${accessCard}
        ${C.contactBox(contact)}
      </aside>
    </div>
  </div>`;
}

// Deliberately use the list variant (the caller supplies its topic list). The
// core-bound version lives in domain.js; see design review B23.
function domainLabel(domains, key) { const domain = domains.find(x => x.key === key); return domain ? domain.label : key; }
