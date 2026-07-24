// Dienstleistungen - service directory (catalog) + service detail.
export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs } = ctx;
  if (params[0]) return detail(ctx, params[0]);

  setTitle('Dienstleistungen');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen' }]);

  const rawQ = query.get('q') || '';
  const q = rawQ.toLowerCase();
  const selectedAudience = query.get('audience') || '';
  // `topic` is multi-value (comma-separated) — several Themen can be active at once
  const selectedTopics = (query.get('topic') || '').split(',').map(t => t.trim()).filter(Boolean);
  const view = query.get('view') === 'liste' ? 'liste' : 'galerie';
  const currentPage = Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1);
  const perPage = 12;
  const domains = core.ref().domains || [];
  const all = core.services();

  const matches = (s) => !q || (s.title + ' ' + s.short + ' ' + s.description).toLowerCase().includes(q);
  const matchesAudience = (s) => !selectedAudience || s.audience === selectedAudience;
  const matchesTopic = (s) => !selectedTopics.length || selectedTopics.includes(s.domain);
  const services = all.filter(s => matches(s) && matchesAudience(s) && matchesTopic(s));
  const totalPages = Math.max(1, Math.ceil(services.length / perPage));
  const page = Math.min(currentPage, totalPages);
  const visibleServices = services.slice((page - 1) * perPage, page * perPage);

  // also-in hint across other surfaces (services-first, then content)
  const otherHits = q ? {
    apps: core.applications().filter(a => (a.name + a.description).toLowerCase().includes(q)).length,
    docs: core.documents().filter(d => d.title.toLowerCase().includes(q)).length,
    weisungen: core.weisungen().filter(w => (w.title + w.summary).toLowerCase().includes(q)).length,
  } : null;

  const card = (s) => C.card({
    title: s.title, desc: s.short, href: `#/services/${s.serviceId}`,
    badges: [C.audienceTag(s.audience), s.type === 'action' ? C.badge('Service', 'info') : C.badge('Information', 'gray')],
    footer: `<span>${domainLabel(domains, s.domain)}</span><span class="btn btn--link">Öffnen ${C.icon('ArrowRight', 'icon--base')}</span>`,
  });

  const listView = (list) => C.table({
    caption: 'Dienstleistungen',
    zebra: true,
    columns: [
      { key: 'title', label: 'Dienstleistung', render: s => `<a href="#/services/${s.serviceId}">${C.escape(s.title)}</a><br><span class="small muted">${C.escape(s.short)}</span>` },
      { key: 'domain', label: 'Bereich', render: s => C.escape(domainLabel(domains, s.domain)) },
      { key: 'audience', label: 'Zielgruppe', render: s => C.audienceTag(s.audience) },
      { key: 'type', label: 'Typ', render: s => s.type === 'action' ? C.badge('Service', 'info') : C.badge('Information', 'gray') },
    ],
    rows: list,
  });

  // Active-filter pills. Each pill links to the same view minus that one value,
  // so removing a filter needs no JS and stays deep-linkable.
  const activeFilters = [
    ...(rawQ ? [{ label: `Suche: „${rawQ}“`, href: servicesHash({ audience: selectedAudience, topics: selectedTopics, page: 1, view }) }] : []),
    ...(selectedAudience ? [{ label: audienceLabel(selectedAudience), href: servicesHash({ q: rawQ, topics: selectedTopics, page: 1, view }) }] : []),
    ...selectedTopics.map(t => ({
      label: domainLabel(domains, t),
      href: servicesHash({ q: rawQ, audience: selectedAudience, topics: selectedTopics.filter(x => x !== t), page: 1, view }),
    })),
  ];
  const filterBar = C.activeFilters({ filters: activeFilters, resetHref: '#/services' });

  const relatedHits = otherHits && (otherHits.apps + otherHits.docs + otherHits.weisungen)
    ? `Auch in: ${otherHits.apps ? `<a href="#/applications">${otherHits.apps} Anwendung(en)</a> · ` : ''}${otherHits.docs ? `<a href="#/app/document-archive">${otherHits.docs} Dokument(e)</a> · ` : ''}${otherHits.weisungen ? `<a href="#/knowledge">${otherHits.weisungen} Weisung(en)</a>` : ''}`
    : '';

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({ title: 'Dienstleistungen', lead: 'Was möchten Sie tun? Services starten einen Vorgang; Informationsangebote führen weiter.' })}
    <form class="service-controls" id="svc-search" role="search">
      <div class="service-controls__search">
        <label class="sr-only" for="sq">Service suchen</label>
        <input id="sq" type="search" placeholder="Service suchen..." value="${C.escape(rawQ)}" autocomplete="off">
        <button class="btn btn--bare btn--icon-only service-controls__submit" type="submit" aria-label="Suchen" title="Suchen">${C.icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span></button>
      </div>
      <div class="service-controls__filters" aria-label="Dienstleistungen filtern">
        ${C.select({ id: 'audience-filter', name: 'audience', label: 'Zielgruppe', value: selectedAudience,
          options: [{ value: '', label: 'Alle Zielgruppen' }, ...audienceOptions()] })}
        ${C.select({ id: 'topic-filter', name: 'topic', label: 'Thema', value: '',
          options: [{ value: '', label: 'Alle Themen' }, ...domains.filter(d => d.thema).map(d => ({ value: d.key, label: d.label }))] })}
      </div>
    </form>
    ${filterBar}
    <section class="mt-6">
      ${C.resultsHeader({ count: services.length, total: all.length, unit: 'Dienstleistungen', page, totalPages, view })}
      ${relatedHits ? `<p class="muted small mt-4">${relatedHits}</p>` : ''}
      ${services.length ? `${view === 'liste' ? listView(visibleServices) : `<div class="grid grid--3 mt-4">${visibleServices.map(card).join('')}</div>`}${
        C.pagination({ page, totalPages, inputId: 'svc-page', label: 'Seitennavigation Dienstleistungen',
          href: (p) => servicesHash({ q: rawQ, audience: selectedAudience, topics: selectedTopics, page: p, view }) })
      }` : C.empty('Keine Services gefunden.')}
    </section>
  </div>`;

  C.announce(`${services.length} von ${all.length} Dienstleistungen${totalPages > 1 ? `, Seite ${page} von ${totalPages}` : ''}, Ansicht ${view === 'liste' ? 'Liste' : 'Galerie'}`);

  mount.querySelector('#svc-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = mount.querySelector('#sq').value.trim();
    location.hash = servicesHash({ q: v, audience: selectedAudience, topics: selectedTopics, page: 1, view });
  });
  mount.querySelectorAll('.view-switch__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      location.hash = servicesHash({
        q: rawQ, audience: selectedAudience, topics: selectedTopics, page,
        view: btn.getAttribute('data-view'),
      });
    });
  });
  mount.querySelector('#audience-filter').addEventListener('change', (e) => {
    location.hash = servicesHash({ q: rawQ, audience: e.target.value, topics: selectedTopics, page: 1, view });
  });
  mount.querySelector('#topic-filter').addEventListener('change', (e) => {
    location.hash = servicesHash({ q: rawQ, audience: selectedAudience, topics: e.target.value && !selectedTopics.includes(e.target.value) ? [...selectedTopics, e.target.value] : selectedTopics, page: 1, view });
  });
  C.wirePagination(mount, 'svc-page', page, totalPages, (target) => {
    location.hash = servicesHash({ q: rawQ, audience: selectedAudience, topics: selectedTopics, page: target, view });
  });
}

function detail(ctx, id) {
  const { mount, core, session, C, setTitle, setCrumbs } = ctx;
  const s = core.service(id);
  if (!s) {
    setTitle('Dienstleistung nicht gefunden');
    setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen', href: '#/services' }]);
    mount.innerHTML = C.notFound({ backHref: '#/services', backLabel: 'Dienstleistungen',
      title: 'Dienstleistung nicht gefunden',
      body: 'Diese Dienstleistung existiert nicht. <a href="#/services">Zur Übersicht «Dienstleistungen»</a>' });
    return;
  }
  setTitle(s.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen', href: '#/services' }, { label: s.title }]);

  const contact = core.contacts().find(c => c.contactId === s.contact);
  const weis = core.weisungenForService(s.serviceId);
  const ext = s.target.kind === 'external';
  const ctaLabel = s.type === 'action' ? (ext ? 'Zum externen System' : 'Vorgang starten') : 'Öffnen';
  // Ein Ziel «#» ist ein Platzhalter — dann keinen toten Knopf anbieten,
  // sondern sagen, dass das System im Prototyp nicht angebunden ist.
  const hasTarget = s.target.href && s.target.href !== '#';
  // Nur das Auslösen eines Vorgangs (type=action) verlangt eine Anmeldung;
  // Informationsangebote sind frei. Inhalt wird nie versteckt — abgemeldet
  // erscheint statt des Knopfs der Login-Hinweis (AGOV / FedLogin).
  const needsLogin = s.type === 'action' && !session.isLoggedIn();

  const ctaBlock = needsLogin
    ? C.loginGate(`Zum Starten des Vorgangs «${C.escape(s.title)}» ist eine Anmeldung mit AGOV / FedLogin erforderlich. Alle Informationen auf dieser Seite sind frei einsehbar.`)
    : `<div class="row mt-4">
        ${hasTarget
          ? `<a class="btn btn--outline btn--lg" href="${C.escape(s.target.href)}"${
              ext ? ' target="_blank" rel="noopener external"' : ''}>${ctaLabel} ${
              C.icon(ext ? 'External' : 'ArrowRight', 'icon--base')}</a>`
          : `<span class="btn btn--outline btn--lg" aria-disabled="true">${ctaLabel} ${
              C.icon(ext ? 'External' : 'ArrowRight', 'icon--base')}</span>
             <span class="small muted">Im Prototyp ist kein Zielsystem angebunden.</span>`}
      </div>`;

  // Symbolbild je Thema (verifizierte Unsplash-ids aus dem Bestand); Fallback =
  // Farbfläche. Deckt sich mit den Themen-Bildern der Startseite/Bereiche.
  const DOMAIN_PHOTO = {
    A: '1541888946425-d81bb19240f5', B: '1481627834876-b7833e8f5570', U: '1497366216548-37526070297c',
    O: '1454165804606-c3d57bc86b40', G: '1522071820081-009f0129c71c', C: '1524758631624-e2822e304c36',
    D: '1522071820081-009f0129c71c', E: '1454165804606-c3d57bc86b40', F: '1481627834876-b7833e8f5570',
  };
  const img = DOMAIN_PHOTO[s.domain] || '1454165804606-c3d57bc86b40';

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: '#/services', backLabel: 'Dienstleistungen' })}
    <div class="hero hero--main-image">
      <div class="hero__content">
        <div class="row gap-sm">${C.audienceTag(s.audience)} ${s.type === 'action' ? C.badge('Service', 'info') : C.badge('Information', 'gray')}</div>
        <h1 class="hero__title" tabindex="-1">${C.escape(s.title)}</h1>
        <p class="hero__description">${C.escape(s.short)}</p>
      </div>
      <div class="hero__image"><figure>
        ${C.photo({ id: img, color: '#2f4356', alt: '', w: 800 })}
        <figcaption class="small muted">Symbolbild — © Unsplash</figcaption>
      </figure></div>
    </div>
    <div class="split mt-6">
      <div class="stack">
        <p>${C.escape(s.description)}</p>
        ${s.voraussetzungen && s.voraussetzungen.length ? `<div class="box"><h3>Das brauchen Sie</h3><ul style="padding-left:1.1rem">${s.voraussetzungen.map(v => `<li>${C.escape(v)}</li>`).join('')}</ul></div>` : ''}
        ${ctaBlock}
      </div>
      <aside class="stack-lg">
        ${contact ? `<div class="box"><h3>Kontakt</h3><p class="small" style="margin:0"><strong>${C.escape(contact.name)}</strong><br>${C.escape(contact.role)}<br><a href="mailto:${contact.email}">${contact.email}</a><br>${C.escape(contact.phone)}</p></div>` : ''}
        ${weis.length ? `<div class="box"><h3>Geltende Weisungen</h3>${weis.map(w => `<a class="row gap-sm" style="padding:.35rem 0" href="#/knowledge?tab=grundlagen&id=${w.directiveId}">${C.icon('Book', 'icon--base')}<span class="small">${C.escape(w.title)}</span></a>`).join('')}</div>` : ''}
      </aside>
    </div>
  </div>`;
}

function audienceOptions() {
  return [
    { value: 'internal', label: 'Intern' },
    { value: 'external', label: 'Extern' },
    { value: 'both', label: 'Intern + Extern' },
  ];
}

function audienceLabel(key) {
  const option = audienceOptions().find(o => o.value === key);
  return option ? option.label : key;
}


function servicesHash({ q = '', audience = '', topics = [], page = 1, view = '' }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (audience) params.set('audience', audience);
  if (topics.length) params.set('topic', topics.join(','));
  if (page > 1) params.set('page', String(page));
  if (view === 'liste') params.set('view', view);
  const suffix = params.toString();
  return suffix ? `#/services?${suffix}` : '#/services';
}

function domainLabel(domains, key) { const d = domains.find(x => x.key === key); return d ? d.label : key; }
