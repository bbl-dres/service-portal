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
  if (params[0]) return (await import('./application.js')).default(ctx, params[0]);

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

  // Jede Pill verlinkt auf dieselbe Ansicht ohne diesen einen Wert.
  const active = [
    ...(rawQ ? [{ label: `Suche: „${rawQ}“`, href: hash({ ...base, q: '' }) }] : []),
    ...(bereich ? [{ label: bereichLabel(bereich), href: hash({ ...base, bereich: '' }) }] : []),
    ...(audience ? [{ label: audienceLabel(audience), href: hash({ ...base, audience: '' }) }] : []),
  ];
  const filterBar = active.length ? `
    <div class="active-filters mt-4" role="group" aria-label="Aktive Filter">
      <span class="small muted">Aktive Filter:</span>
      ${active.map(f => `<a class="badge badge--gray active-filter" href="${f.href}"
         aria-label="Filter „${C.escape(f.label)}“ entfernen">${C.escape(f.label)}${C.icon('Cancel', 'icon--sm')}</a>`).join('')}
      <a class="btn btn--link" href="#/applications">Alle Filter zurücksetzen</a>
    </div>` : '';

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
    <form class="service-controls" id="app-search" role="search">
      <div class="service-controls__search">
        <label class="sr-only" for="aq">Anwendung suchen</label>
        <input id="aq" type="search" placeholder="Anwendung suchen..." value="${C.escape(rawQ)}" autocomplete="off">
        <button class="btn btn--filled" type="submit">Suchen</button>
      </div>
      <div class="service-controls__filters" aria-label="Anwendungen filtern">
        <div class="form__group__select">
          <label for="bereich-filter">Bereich</label>
          <div class="select">
            <select id="bereich-filter" name="bereich">
              <option value="">Alle Bereiche</option>
              ${BEREICHE.map(b => `<option value="${b.key}"${bereich === b.key ? ' selected' : ''}>${C.escape(b.label)}</option>`).join('')}
            </select>
            <span class="select__icon">${C.icon('ChevronDown')}</span>
          </div>
        </div>
        <div class="form__group__select">
          <label for="audience-filter">Zielgruppe</label>
          <div class="select">
            <select id="audience-filter" name="audience">
              <option value="">Alle Zielgruppen</option>
              ${AUDIENCES.map(a => `<option value="${a.value}"${audience === a.value ? ' selected' : ''}>${C.escape(a.label)}</option>`).join('')}
            </select>
            <span class="select__icon">${C.icon('ChevronDown')}</span>
          </div>
        </div>
      </div>
    </form>
    ${filterBar}
    <section class="mt-6">
      ${C.resultsHeader({ count: apps.length, total: all.length, unit: 'Anwendungen', page, totalPages, view })}
      ${apps.length
        ? `${view === 'liste' ? listView(visible) : `<div class="grid grid--3 mt-4">${visible.map(card).join('')}</div>`}
           ${C.pagination({ page, totalPages, inputId: 'app-page', label: 'Seitennavigation Anwendungen',
              href: (p) => hash({ ...base, page: p }) })}`
        : C.empty('Keine Anwendungen gefunden.')}
    </section>
  </div>`;

  mount.querySelector('#app-search').addEventListener('submit', (e) => {
    e.preventDefault();
    location.hash = hash({ ...base, q: mount.querySelector('#aq').value.trim() });
  });
  mount.querySelector('#bereich-filter').addEventListener('change', (e) => {
    location.hash = hash({ ...base, bereich: e.target.value });
  });
  mount.querySelector('#audience-filter').addEventListener('change', (e) => {
    location.hash = hash({ ...base, audience: e.target.value });
  });
  mount.querySelectorAll('.view-switch__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      location.hash = hash({ ...base, page, view: btn.getAttribute('data-view') });
    });
  });
  C.wirePagination(mount, 'app-page', page, totalPages, (target) => {
    location.hash = hash({ ...base, page: target });
  });
}

function bereichLabel(key) { const b = BEREICHE.find(x => x.key === key); return b ? b.label : key; }
function audienceLabel(v) { const a = AUDIENCES.find(x => x.value === v); return a ? a.label : v; }

function hash({ q = '', bereich = '', audience = '', page = 1, view = '' } = {}) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (bereich) p.set('bereich', bereich);
  if (audience) p.set('audience', audience);
  if (page > 1) p.set('page', String(page));
  if (view === 'liste') p.set('view', view);
  const s = p.toString();
  return s ? `#/applications?${s}` : '#/applications';
}
