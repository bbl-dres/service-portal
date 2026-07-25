// Anwendungen — Katalog und Landingpage je Anwendung.
//
// Gleiches Muster wie #/services: Suche links, zwei Filter-Dropdowns,
// Ansichtswechsel rechts, aktive Filter als Pills, Galerie/Liste, Pagination.
// Die Seite hat immer denselben Kopf — «Fachanwendungen Bauten» ist kein
// eigener Seitentyp, sondern nur ?bereich=bauten.
//
// Karten führen auf #/applications/<appId>, nicht direkt in die Anwendung:
// jede Anwendung hat eigene Einstiegspunkte, Zugriffsregeln und Ansprechstellen.

const PER_PAGE = 9;

const BEREICHE = [
  { key: 'bauten',   label: 'Immobilien & Bau' },
  { key: 'logistik', label: 'Arbeitsplatz & Logistik' },
  { key: 'zentral',  label: 'Zentrale Systeme' },
];

const AUDIENCES = [
  { value: 'internal', label: 'Intern' },
  { value: 'external', label: 'Extern' },
  { value: 'both',     label: 'Intern + Extern' },
];

export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs } = ctx;
  if (params[0]) {
    const mod = await import('./application.js');
    if (ctx.stale()) return;   // A2: nach dem await keine überholte Navigation überschreiben
    return mod.default(ctx, params[0]);
  }

  setTitle('Anwendungen');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Anwendungen' },
  ]);

  const rawQ = query.get('q') || '';
  const q = rawQ.toLowerCase();
  const bereich = BEREICHE.some(b => b.key === query.get('bereich')) ? query.get('bereich') : '';
  const audience = AUDIENCES.some(a => a.value === query.get('audience')) ? query.get('audience') : '';
  const view = query.get('view') === 'liste' ? 'liste' : 'galerie';
  const wanted = Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1);

  const all = core.applications();
  const matches = (a) =>
    (!q || (a.name + ' ' + a.description + ' ' + a.group).toLowerCase().includes(q)) &&
    (!bereich || a.bereich === bereich) &&
    (!audience || a.audience === audience);

  // Schlüsselanwendungen zuerst, sonst Reihenfolge der Datenquelle
  const apps = all.filter(matches).sort((a, b) => (b.hero ? 1 : 0) - (a.hero ? 1 : 0));
  const totalPages = Math.max(1, Math.ceil(apps.length / PER_PAGE));
  const page = Math.min(wanted, totalPages);
  const visible = apps.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const base = { q: rawQ, bereich, audience, view };
  const hash = (patch = {}) => C.catalogueHash('#/applications', { ...base, ...patch });

  // Jede Pill verlinkt auf dieselbe Ansicht ohne diesen einen Wert.
  const active = [
    ...(rawQ ? [{ label: `Suche: „${rawQ}“`, href: hash({ q: '' }) }] : []),
    ...(bereich ? [{ label: bereichLabel(bereich), href: hash({ bereich: '' }) }] : []),
    ...(audience ? [{ label: audienceLabel(audience), href: hash({ audience: '' }) }] : []),
  ];
  const filterBar = C.activeFilters({ filters: active, resetHref: '#/applications' });

  const card = (a) => C.card({
    title: a.name,
    desc: a.description,
    href: `#/applications/${encodeURIComponent(a.appId)}`,
    photo: { id: a.photo, alt: '' },
    badges: [
      C.audienceTag(a.audience),
      ...(a.hero ? [C.badge('Schlüsselanwendung', 'info')] : []),
      ...(a.link && a.link.kind === 'external' ? [C.badge('Externes System', 'gray')] : []),
    ],
    footer: `<span>${C.escape(a.group)}</span>
      <span class="btn btn--link">Öffnen ${C.icon('ArrowRight', 'icon--base')}</span>`,
  });

  const listView = (rows) => C.table({
    caption: 'Anwendungen',
    zebra: true,
    columns: [
      { key: 'name', label: 'Anwendung', render: a =>
        `<a href="#/applications/${encodeURIComponent(a.appId)}">${C.escape(a.name)}</a>
         <br><span class="small muted">${C.escape(a.description)}</span>` },
      { key: 'group', label: 'Bereich', render: a => C.escape(a.group) },
      { key: 'audience', label: 'Zielgruppe', render: a => C.audienceTag(a.audience) },
      { key: 'link', label: 'Einstieg', render: a =>
        a.link && a.link.kind === 'external' ? C.badge('Externes System', 'gray') : C.badge('Im Kundenportal', 'blue') },
    ],
    rows,
  });

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Anwendungen',
      lead: 'Alle Anwendungen des BBL an einem Ort — von den Fachanwendungen für Bauten über Logistik bis zu den zentralen Systemen der Bundesverwaltung.',
    })}
    ${C.catalogueControls({
      formId: 'app-search', inputId: 'aq', searchLabel: 'Anwendung suchen', placeholder: 'Anwendung suchen...', q: rawQ,
      filtersLabel: 'Anwendungen filtern',
      filters: `
        ${C.select({ id: 'bereich-filter', name: 'bereich', label: 'Bereich', value: bereich,
          options: [{ value: '', label: 'Alle Bereiche' }, ...BEREICHE.map(b => ({ value: b.key, label: b.label }))] })}
        ${C.select({ id: 'audience-filter', name: 'audience', label: 'Zielgruppe', value: audience,
          options: [{ value: '', label: 'Alle Zielgruppen' }, ...AUDIENCES] })}`,
    })}
    ${filterBar}
    ${C.catalogueResults({
      visible, count: apps.length, total: all.length, view, page, totalPages,
      card, listView, unit: 'Anwendungen',
      paginationInputId: 'app-page', paginationLabel: 'Seitennavigation Anwendungen',
      paginationHref: (p) => hash({ page: p }),
      available: core.available('applications'),
    })}
  </div>`;

  C.announceCatalogue({ count: apps.length, total: all.length, unit: 'Anwendungen', page, totalPages, view });

  C.wireCatalogue(mount, {
    formId: 'app-search', inputId: 'aq', pageInputId: 'app-page', page, totalPages, hash,
    filters: [{ id: 'bereich-filter', param: 'bereich' }, { id: 'audience-filter', param: 'audience' }],
  });
}

function bereichLabel(key) { const b = BEREICHE.find(x => x.key === key); return b ? b.label : key; }
function audienceLabel(v) { const a = AUDIENCES.find(x => x.value === v); return a ? a.label : v; }
