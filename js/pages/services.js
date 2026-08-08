// Services — service directory (catalogue) and service detail.
import { audienceOptions, audienceLabel, audienceTags } from '../domain.js';
const MISSING_TARGET_MESSAGE = 'Im Prototyp ist kein Zielsystem angebunden.';

// Deferred collections for this route. The router calls core.ensure(needs)
// BEFORE render(); without this declaration, an accessor would read the still
// empty list and the view would show «no entries» instead of data
// (docs/code-review.md §3).
export const needs = ['applications', 'contacts', 'documents'];
export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs } = ctx;
  if (params[0]) return detail(ctx, params[0]);

  setTitle('Dienstleistungen');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen' }]);

  const rawQ = query.get('q') || '';
  const q = rawQ.toLowerCase();
  // Filters accept multiple values (multi-select checkboxes), comma-separated in the hash.
  const selectedAudiences = (query.get('audience') || '').split(',').map(t => t.trim()).filter(Boolean);
  const selectedTopics = (query.get('topic') || '').split(',').map(t => t.trim()).filter(Boolean);
  const view = query.get('view') === 'list' ? 'list' : 'gallery';
  const currentPage = Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1);
  const perPage = 12;
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
  const sortKey = SORT_OPTIONS.some(o => o.value === query.get('sort')) ? query.get('sort') : '';

  const matches = (s) => !q || (s.title + ' ' + s.short + ' ' + s.description).toLowerCase().includes(q);
  const matchesAudience = (s) => !selectedAudiences.length || selectedAudiences.some(v => (s.audience || []).includes(v));
  const matchesTopic = (s) => !selectedTopics.length || selectedTopics.includes(s.domain);
  const filtered = all.filter(s => matches(s) && matchesAudience(s) && matchesTopic(s));
  const services = sortKey ? filtered.slice().sort(SORTS[sortKey]) : filtered;
  const totalPages = Math.max(1, Math.ceil(services.length / perPage));
  const page = Math.min(currentPage, totalPages);
  const visibleServices = services.slice((page - 1) * perPage, page * perPage);

  const base = { q: rawQ, audience: selectedAudiences, topic: selectedTopics, sort: sortKey, view };
  const hash = (patch = {}) => C.catalogueHash('#/services', { ...base, ...patch });

  // “Also in” hint across other surfaces (services first, then content).
  const otherHits = q ? {
    apps: core.applications().filter(a => (a.name + a.description).toLowerCase().includes(q)).length,
    docs: core.documents().filter(d => d.title.toLowerCase().includes(q)).length,
  } : null;

  const card = (s) => C.card({
    title: s.title, desc: s.short, href: `#/services/${s.serviceId}`,
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
      { key: 'title', label: 'Dienstleistung', render: s => `<a href="#/services/${s.serviceId}">${C.escape(s.title)}</a><br><span class="small muted">${C.escape(s.short)}</span>` },
      { key: 'domain', label: 'Bereich', render: s => C.escape(domainLabel(domains, s.domain)) },
      { key: 'audience', label: 'Zielgruppe', render: s => audienceTags(core, C, s.audience) },
    ],
    rows: list,
  });

  // Active-filter pills. Each pill links to the same view minus that one value,
  // so removing a filter needs no JS and stays deep-linkable.
  const activeFilters = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hash({ q: '' }) }] : []),
    ...selectedAudiences.map(a => ({ label: audienceLabel(core, a), href: hash({ audience: selectedAudiences.filter(x => x !== a) }) })),
    ...selectedTopics.map(t => ({ label: domainLabel(domains, t), href: hash({ topic: selectedTopics.filter(x => x !== t) }) })),
  ];
  const filterBar = C.activeFilters({ filters: activeFilters, resetHref: '#/services' });

  const relatedHits = otherHits && (otherHits.apps + otherHits.docs)
    ? `Auch in: ${[
        otherHits.apps ? `<a href="#/applications?q=${encodeURIComponent(rawQ)}">${otherHits.apps} Anwendung(en)</a>` : '',
        otherHits.docs ? `<a href="#/app/document-archive?q=${encodeURIComponent(rawQ)}">${otherHits.docs} Dokument(e)</a>` : '',
      ].filter(Boolean).join(' · ')}`
    : '';

  const pageInfo = totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : '';
  const filterPanel = `
    ${C.filterGroup({ dim: 'audience', legend: 'Zielgruppe', selected: selectedAudiences, options: audienceOptions(core) })}
    ${/* Derive topics from the data using the same rule as the drawer (ui/shell/header.js):
          a topic appears as soon as it has a case behind it. Raw field: `thema`
          compatibility flag in reference-data.json previously decided this and
          was stale: the drawer offered «Alle anzeigen» for procurement or
          publishing while the filter omitted those same topics. The filter could
          be set but neither seen nor deselected. The flag has been removed. */''}
    ${C.filterGroup({ dim: 'topic', legend: 'Thema', selected: selectedTopics,
      options: domains.filter(d => all.some(s => s.domain === d.key)).map(d => ({ value: d.key, label: d.label })) })}
    ${C.panelReset({ href: hash({ audience: [], topic: [] }) })}`;

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({ title: 'Dienstleistungen', lead: 'Was möchten Sie tun? Als «Vorgang» gekennzeichnete Dienstleistungen starten einen Ablauf; Informationsangebote führen weiter.' })}
    ${C.catalogueBar({
      formId: 'svc-search', inputId: 'sq', searchLabel: 'Dienstleistung suchen', placeholder: 'Dienstleistung suchen…', q: rawQ,
      countId: 'svc-count', count: `<strong>${services.length}</strong> von ${all.length} Dienstleistungen${pageInfo}`,
      sort: { id: 'svc-sort', value: sortKey, options: SORT_OPTIONS },
      filterId: 'svc-filter', filterLabel: 'Filter', filterCount: selectedAudiences.length + selectedTopics.length,
      panelId: 'svc-filters', panel: filterPanel,
      view, views: [['gallery', 'Galerieansicht', 'Apps'], ['list', 'Listenansicht', 'List']],
    })}
    ${filterBar}
    ${C.catalogueResults({
      resetHref: '#/services',
      visible: visibleServices, count: services.length, view, page, totalPages,
      card, listView, unit: 'Dienstleistungen',
      paginationInputId: 'svc-page', paginationLabel: 'Seitennavigation Dienstleistungen',
      paginationHref: (p) => hash({ page: p }),
      available: core.available('services'), note: relatedHits || '',
    })}
  </div>`;

  C.announceCatalogue({ count: services.length, total: all.length, unit: 'Dienstleistungen', page, totalPages, view });

  // C.wireCatalogue wires the multi-select filters (audience/topic) through the panel.
  C.wireCatalogue(mount, {
    formId: 'svc-search', inputId: 'sq', pageInputId: 'svc-page', page, totalPages, hash,
    sortId: 'svc-sort', filterToggleId: 'svc-filter', panelId: 'svc-filters',
  });
  // Row clicks in list view. Clean up through onUnmount so the reused mount does
  // not accumulate another click listener on every visit.
  ctx.onUnmount(C.wireTableRows(mount));
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
  const ctaLabel = service.type === 'action' ? (isExternal ? 'Zum externen System' : 'Vorgang starten') : 'Öffnen';
  // A «#» target is a placeholder. Do not offer a dead button; explain that the
  // prototype is not connected to the target system.
  const hasTarget = target.href && target.href !== '#';
  // «Zugriff» card, first card in the side column (user decision, 2026-08-04):
  // the same location and, since 2026-08-06, the same BUILDING BLOCK as on the
  // application landing page (C.accessCard). Previously the application placed
  // the button above the text, while the service reversed them at half the size,
  // although the card answers the same question on both pages. The building block
  // derives target, session hint, and safe new-tab contract together.
  const accessCard = C.accessCard({
    href: hasTarget ? target.href : '', label: ctaLabel, external: isExternal, newWindow: true,
    // Only starting a case (type=action) requires authentication. Information
    // offerings are public. External target systems provide their own login;
    // internal targets rely on the newly opened application's router login gate.
    requiresLogin: service.type === 'action' && !isExternal,
    loggedIn: session.isLoggedIn(), user: session.user(),
    free: service.type !== 'action' ? 'Frei zugänglich — keine Anmeldung erforderlich.' : '',
  });

  const ctaBlock = `<div class="row mt-4">
      ${/* CD Btn.vue: the icon comes first in the DOM, btn--icon-right reverses
            the order, and the label ALWAYS uses the .btn__text wrapper. */''}
      ${hasTarget
        ? `<a class="btn btn--outline btn--lg btn--icon-right" href="${C.escape(target.href)}" target="_blank" rel="${
            isExternal ? 'noopener external' : 'noopener'}">${
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
      image: C.heroFigure({ src: image, ratio: '16x9' }),
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
