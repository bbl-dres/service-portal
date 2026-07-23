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
  const filterBar = activeFilters.length ? `
    <div class="active-filters mt-4" role="group" aria-label="Aktive Filter">
      <span class="small muted">Aktive Filter:</span>
      ${activeFilters.map(f => `<a class="badge badge--gray active-filter" href="${f.href}"
         aria-label="Filter „${C.escape(f.label)}“ entfernen">${C.escape(f.label)}${C.icon('Cancel', 'icon--sm')}</a>`).join('')}
      <a class="btn btn--link" href="#/services">Alle Filter zurücksetzen</a>
    </div>` : '';

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
        <button class="btn btn--filled" type="submit">Suchen</button>
      </div>
      <div class="service-controls__filters" aria-label="Dienstleistungen filtern">
        <div class="form__group__select">
          <label for="audience-filter">Zielgruppe</label>
          <div class="select">
            <select id="audience-filter" name="audience">
              <option value="">Alle Zielgruppen</option>
              ${audienceOptions().map(o => `<option value="${o.value}"${selectedAudience === o.value ? ' selected' : ''}>${C.escape(o.label)}</option>`).join('')}
            </select>
            <span class="select__icon">${C.icon('ChevronDown')}</span>
          </div>
        </div>
        <div class="form__group__select">
          <label for="topic-filter">Thema</label>
          <div class="select">
            <select id="topic-filter" name="topic">
              <option value="">Alle Themen</option>
              ${domains.map(d => `<option value="${C.escape(d.key)}">${C.escape(d.label)}</option>`).join('')}
            </select>
            <span class="select__icon">${C.icon('ChevronDown')}</span>
          </div>
        </div>
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
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const s = core.service(id);
  if (!s) {
    setTitle('Dienstleistung nicht gefunden');
    setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen', href: '#/services' }]);
    mount.innerHTML = `<div class="container section">
      ${C.backLink('#/services', 'Dienstleistungen')}
      <div class="page-header mt-4"><h1 tabindex="-1">Dienstleistung nicht gefunden</h1></div>
      <p class="muted">Diese Dienstleistung existiert nicht. <a href="#/services">Zur Übersicht «Dienstleistungen»</a></p>
    </div>`;
    return;
  }
  setTitle(s.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Dienstleistungen', href: '#/services' }, { label: s.title }]);

  const contact = core.contacts().find(c => c.contactId === s.contact);
  const weis = core.weisungenForService(s.serviceId);
  const ext = s.target.kind === 'external';
  const ctaLabel = s.type === 'action' ? (ext ? 'Zum externen System' : 'Vorgang starten') : 'Öffnen';

  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/services', 'Dienstleistungen')}
    <div class="split mt-4">
      <div class="stack">
        <div class="row gap-sm">${C.audienceTag(s.audience)} ${s.type === 'action' ? C.badge('Service', 'info') : C.badge('Information', 'gray')}</div>
        <h1 tabindex="-1">${C.escape(s.title)}</h1>
        <p class="lead">${C.escape(s.short)}</p>
        <p>${C.escape(s.description)}</p>
        ${s.voraussetzungen && s.voraussetzungen.length ? `<div class="box"><h3>Das brauchen Sie</h3><ul style="padding-left:1.1rem">${s.voraussetzungen.map(v => `<li>${C.escape(v)}</li>`).join('')}</ul></div>` : ''}
        <div class="row mt-4">
          <a class="btn btn--outline btn--lg" href="${s.target.href}">${ctaLabel} ${C.icon(ext ? 'External' : 'ArrowRight', 'icon--base')}</a>
        </div>
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
