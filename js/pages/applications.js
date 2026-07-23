// Anwendungen — software / application launcher.
// Reached from "Daten und Digitalisierung": ?bereich=bauten|logistik narrows it
// to the Fachanwendungen of one Bereich; without it, all groups are listed.
export default async function render(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;

  const GROUP_ORDER = ['Immobilien & Bau', 'Arbeitsplatz & Logistik', 'Zentrale Systeme'];
  const BEREICHE = {
    bauten: { label: 'Fachanwendungen Bauten', lead: 'Fachanwendungen für Immobilien, Bauprojekte und Bauwerksdokumentation.' },
    logistik: { label: 'Fachanwendungen Logistik', lead: 'Fachanwendungen für Arbeitsplatz, Beschaffung und Logistik.' },
  };

  const bereich = BEREICHE[query.get('bereich')] ? query.get('bereich') : '';
  const meta = BEREICHE[bereich];

  setTitle(meta ? meta.label : 'Anwendungen');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    ...(meta ? [{ label: 'Anwendungen', href: '#/applications' }, { label: meta.label }] : [{ label: 'Anwendungen' }]),
  ]);

  // Filter state: 'all' | 'internal' | 'external' | 'both'
  const FILTERS = [
    { id: 'all', label: 'Alle' },
    { id: 'internal', label: 'Intern' },
    { id: 'external', label: 'Extern' },
    { id: 'both', label: 'Intern + Extern' },
  ];
  let activeFilter = (() => {
    const f = query.get('audience');
    return FILTERS.some(x => x.id === f) ? f : 'all';
  })();

  const matchesAudience = (a) => activeFilter === 'all' || a.audience === activeFilter;
  const matchesBereich = (a) => !bereich || a.bereich === bereich;
  const matches = (a) => matchesAudience(a) && matchesBereich(a);

  // hero apps (Schlüsselanwendungen) lead each group; otherwise keep source order
  const orderApps = (list) => [...list].sort((a, b) => (b.hero ? 1 : 0) - (a.hero ? 1 : 0));

  const appsHash = ({ b = bereich, audience = activeFilter }) => {
    const p = new URLSearchParams();
    if (b) p.set('bereich', b);
    if (audience && audience !== 'all') p.set('audience', audience);
    const qs = p.toString();
    return '#/applications' + (qs ? '?' + qs : '');
  };

  function appCard(a) {
    const external = a.link && a.link.kind === 'external';
    const action = `<span class="btn btn--link">Öffnen ${C.icon(external ? 'External' : 'ArrowRight', 'icon--base')}</span>`;
    const badges = [C.audienceTag(a.audience)];
    if (a.hero) badges.push(C.badge('Schlüsselanwendung', 'info'));
    return C.card({
      title: a.name,
      desc: a.description,
      href: (a.link && a.link.href) || '#',
      badges,
      footer: `<span>${C.escape(a.accessNote || '')}</span>${action}`,
    });
  }

  function groupSections() {
    const byGroup = core.applicationsByGroup();
    const sections = GROUP_ORDER.map(g => {
      const list = orderApps((byGroup[g] || []).filter(matches));
      if (!list.length) return '';
      // inside a Bereich the group heading is redundant — the page title says it
      return `<section class="mt-8">
        ${bereich ? '' : `<h2>${C.escape(g)}</h2>`}
        <div class="grid grid--3 mt-4">${list.map(appCard).join('')}</div>
      </section>`;
    }).join('');
    return sections || C.empty('Keine Anwendungen für diese Auswahl.');
  }

  function chipsRow() {
    return `<div class="list list--flex list--wrap mt-4" role="group" aria-label="Anwendungen nach Zielgruppe filtern">${FILTERS.map(f =>
      `<button type="button" class="tag-item${f.id === activeFilter ? ' tag-item--active' : ''}" aria-pressed="${!!(f.id === activeFilter)}" data-filter="${f.id}"><span class="tag-item__inner"><span class="tag-item__text">${C.escape(f.label)}</span></span></button>`
    ).join('')}</div>`;
  }

  // Active-filter pills, same pattern as Dienstleistungen: each pill links to
  // the same view minus that one value.
  function filterBar() {
    const active = [
      ...(bereich ? [{ label: BEREICHE[bereich].label, href: appsHash({ b: '' }) }] : []),
      ...(activeFilter !== 'all' ? [{ label: FILTERS.find(f => f.id === activeFilter).label, href: appsHash({ audience: 'all' }) }] : []),
    ];
    if (!active.length) return '';
    return `<div class="active-filters mt-4" role="group" aria-label="Aktive Filter">
      <span class="small muted">Aktive Filter:</span>
      ${active.map(f => `<a class="badge badge--gray active-filter" href="${f.href}"
         aria-label="Filter „${C.escape(f.label)}“ entfernen">${C.escape(f.label)}${C.icon('Cancel', 'icon--sm')}</a>`).join('')}
      <a class="btn btn--link" href="#/applications">Alle Filter zurücksetzen</a>
    </div>`;
  }

  function draw() {
    mount.innerHTML = `
    <div class="container section">
      ${C.pageHeader({
        title: meta ? meta.label : 'Anwendungen',
        lead: meta ? meta.lead
          : 'Alle Anwendungen des BBL an einem Ort – von den Fachanwendungen für Bauten über Logistik bis zu den zentralen Systemen der Bundesverwaltung.',
      })}
      ${chipsRow()}
      ${filterBar()}
      <div id="app-groups">${groupSections()}</div>
    </div>`;
    wire();
  }

  function wire() {
    mount.querySelectorAll('.tag-item[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.getAttribute('data-filter');
        // keep the URL shareable; setting the same view's hash won't re-route, so re-draw here
        const next = appsHash({});
        if (location.hash !== next) history.replaceState(null, '', next);
        draw();
      });
    });
  }

  draw();
}
