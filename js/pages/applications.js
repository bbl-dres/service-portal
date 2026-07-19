// Anwendungen — software / application launcher (overview of all BBL applications).
export default async function render(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;

  setTitle('Anwendungen');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Anwendungen' }]);

  const GROUP_ORDER = ['Immobilien & Bau', 'Arbeitsplatz & Logistik', 'Zentrale Systeme'];
  const byGroup = core.applicationsByGroup();

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

  const matches = (a) => activeFilter === 'all' || a.audience === activeFilter;

  // hero apps (Schlüsselanwendungen) lead each group; otherwise keep source order
  const orderApps = (list) => [...list].sort((a, b) => (b.hero ? 1 : 0) - (a.hero ? 1 : 0));

  function appCard(a) {
    const external = a.link && a.link.kind === 'external';
    const action = `<span class="btn btn--link">Öffnen ${C.icon(external ? 'External' : 'ArrowRight', 'icon--sm')}</span>`;
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
    const sections = GROUP_ORDER.map(g => {
      const list = orderApps((byGroup[g] || []).filter(matches));
      if (!list.length) return '';
      return `<section class="mt-8">
        <h2>${C.escape(g)}</h2>
        <div class="grid grid--3 mt-4">${list.map(appCard).join('')}</div>
      </section>`;
    }).join('');
    return sections || C.empty('Keine Anwendungen für diese Auswahl.');
  }

  function chipsRow() {
    return `<div class="chips mt-4" role="group" aria-label="Anwendungen nach Zielgruppe filtern">${FILTERS.map(f =>
      `<button type="button" class="chip${f.id === activeFilter ? ' active' : ''}" data-filter="${f.id}" aria-pressed="${f.id === activeFilter}">${C.escape(f.label)}</button>`
    ).join('')}</div>`;
  }

  function draw() {
    mount.innerHTML = `
    <div class="container section">
      ${C.pageHeader({ title: 'Anwendungen', lead: 'Alle Anwendungen des BBL an einem Ort – von den zentralen Fachanwendungen für Immobilien und Bau über Arbeitsplatz und Logistik bis zu den zentralen Systemen der Bundesverwaltung.' })}
      ${chipsRow()}
      <div id="app-groups">${groupSections()}</div>
    </div>`;
    wire();
  }

  function wire() {
    mount.querySelectorAll('.chip[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.getAttribute('data-filter');
        // keep the URL shareable; setting the same view's hash won't re-route, so re-draw here
        const base = '#/applications';
        const next = activeFilter === 'all' ? base : `${base}?audience=${activeFilter}`;
        if (location.hash !== next) history.replaceState(null, '', next);
        draw();
      });
    });
  }

  draw();
}
