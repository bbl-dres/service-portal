// Suche — föderierte Ergebnisseite über alle Inhaltsarten (#/search?q=…).
// Aufbau nach dem CD (searchResults.vue, search.postcss «SEARCH RESULTS PAGE»):
// grosses Suchfeld (search--large search--page-result), Ergebniskopf mit
// Trefferzahl, danach die Treffer als Ergebnisliste. Statt CD-Tabs pro
// Inhaltsart werden die Treffer nach Art gruppiert — bei bis zu sechs Arten
// übersichtlicher als Reiter — und jede Gruppe verlinkt mit erhaltener
// Suchanfrage in den jeweiligen Katalog.

const PER_GROUP = 4;

// Synonyme: die Nutzenden kennen nicht die BBL-Terminologie (Review P1-4).
const SYNONYMS = {
  heizung: 'störung', lüftung: 'störung', kaputt: 'störung', defekt: 'störung',
  plan: 'dokument', grundriss: 'dokument', pläne: 'dokument',
  umzug: 'transport', parkplatz: 'buchung', sitzungszimmer: 'buchung',
  material: 'bestellen', möbel: 'mobiliar',
};

export default async function render(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  const rawQ = (query.get('q') || '').trim();
  setTitle(rawQ ? `Suche: ${rawQ}` : 'Suche');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Suche' }]);

  const q = rawQ.toLowerCase();
  const terms = [...new Set([q, ...q.split(/\s+/).map(t => SYNONYMS[t]).filter(Boolean)])].filter(Boolean);
  const hit = (...parts) => {
    if (!terms.length) return false;
    const hay = parts.filter(Boolean).join(' ').toLowerCase();
    return terms.some(t => hay.includes(t));
  };
  const t = core.t;

  // ---- Gruppen: je Inhaltsart eine Trefferliste + Katalog-Verweis mit q ----
  const groups = rawQ ? [
    {
      label: 'Dienstleistungen', icon: 'Briefcase',
      all: core.services().filter(s => hit(s.title, s.short, s.description)),
      more: `#/services?q=${encodeURIComponent(rawQ)}`,
      row: s => ({ type: 'Dienstleistung', title: s.title, desc: s.short,
        href: `#/services/${encodeURIComponent(s.serviceId)}` }),
    },
    {
      label: 'Anwendungen', icon: 'Apps',
      all: core.applications().filter(a => hit(a.name, a.description, a.group)),
      more: `#/applications?q=${encodeURIComponent(rawQ)}`,
      row: a => ({ type: 'Anwendung', title: a.name, desc: a.description,
        href: `#/applications/${encodeURIComponent(a.appId)}` }),
    },
    {
      label: 'Datensätze', icon: 'FileDatabase',
      all: core.datasets().filter(d => hit(t(d.title), t(d.description), t(d.fullDescription), (d.tags || []).join(' '))),
      more: `#/data/katalog?q=${encodeURIComponent(rawQ)}`,
      row: d => ({ type: 'Datensatz', title: t(d.title), desc: t(d.description),
        href: `#/data/katalog/${encodeURIComponent(d.id)}` }),
    },
    {
      label: 'Dokumente', icon: 'Folder',
      all: core.documents().filter(d => hit(d.title, d.type, d.category)),
      more: '#/app/document-archive',
      row: d => ({ type: 'Dokument', title: d.title, desc: [d.type, d.year].filter(Boolean).join(' · '),
        href: '#/app/document-archive' }),
    },
    {
      label: 'Gesetzliche Grundlagen und Vorgaben', icon: 'Book',
      all: core.weisungen().filter(w => hit(w.title, w.summary, w.code, w.topic)),
      more: '#/knowledge?tab=grundlagen',
      row: w => ({ type: w.type || 'Weisung', title: w.title, desc: w.summary,
        href: `#/knowledge?tab=grundlagen&id=${encodeURIComponent(w.directiveId)}` }),
    },
    {
      label: 'News', icon: 'Bell',
      all: core.news().filter(n => hit(n.title, n.teaser, n.body)),
      more: '#/knowledge?tab=news',
      row: n => ({ type: 'News', title: n.title, desc: n.teaser, date: n.date,
        href: `#/knowledge?tab=news&id=${encodeURIComponent(n.id)}` }),
    },
  ].filter(g => g.all.length) : [];

  const total = groups.reduce((s, g) => s + g.all.length, 0);

  const resultRow = (r) => `
    <li class="search-result">
      <a class="search-result__link plain-link" href="${r.href}">
        <p class="meta-info search-result__meta">
          <span class="meta-info__item">${C.escape(r.type)}</span>
          ${r.date ? `<span class="meta-info__item">${C.escape(r.date)}</span>` : ''}
        </p>
        <h3 class="search-result__title">${C.escape(r.title)}</h3>
        ${r.desc ? `<p class="search-result__desc">${C.escape(r.desc)}</p>` : ''}
      </a>
    </li>`;

  const groupBlock = (g) => {
    const rows = g.all.slice(0, PER_GROUP).map(g.row).map(resultRow).join('');
    const more = g.all.length > PER_GROUP
      ? `<div class="section__action"><a class="btn btn--bare" href="${g.more}">Alle ${g.all.length} in „${C.escape(g.label)}“ ansehen ${C.icon('ArrowRight', 'icon--base')}</a></div>`
      : '';
    return `
      <section class="search-group">
        <h2 class="search-group__title">${C.icon(g.icon, 'icon--base')} ${C.escape(g.label)}
          <span class="search-group__count">${g.all.length}</span></h2>
        <ul class="search-results-list">${rows}</ul>
        ${more}
      </section>`;
  };

  const header = `<div class="search-results__header">
    <div class="search-results__header__left"><strong>${total}</strong>${total === 1 ? 'Treffer' : 'Treffer'} für „${C.escape(rawQ)}“</div>
  </div>`;

  const body = !rawQ
    ? `<p class="muted">Geben Sie einen Suchbegriff ein — zum Beispiel «Störung», «Raumbedarf» oder «Bauprojekt».</p>`
    : total
      ? `${header}${groups.map(groupBlock).join('')}`
      : noResults(C, rawQ);

  mount.innerHTML = `
    <section class="section section--default bg--secondary-50">
      <div class="container">
        <h1 tabindex="-1">Suche</h1>
        <form class="search search--large search--page-result" id="search-page-form" role="search">
          <div class="search__group">
            <label class="sr-only" for="search-page-input">Im Portal suchen</label>
            <input id="search-page-input" class="search__field" type="search" name="q"
              placeholder="Suche" value="${C.escape(rawQ)}" autocomplete="off">
            <button class="btn btn--bare btn--lg btn--icon-only search__submit" type="submit" aria-label="Suchen">
              ${C.icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span>
            </button>
          </div>
        </form>
      </div>
    </section>
    <section class="section section--default">
      <div class="container">
        <div class="search-results" aria-live="polite">${body}</div>
      </div>
    </section>`;

  const form = mount.querySelector('#search-page-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = mount.querySelector('#search-page-input').value.trim();
    location.hash = v ? `#/search?q=${encodeURIComponent(v)}` : '#/search';
  });
}

// CD-Muster (searchResults.vue): Suchbegriff wiederholen, Tipps, Kontakthinweis.
function noResults(C, rawQ) {
  return `
    <div class="search-results__no-results">
      <h2 class="text--xl">Die Suche nach <strong>«${C.escape(rawQ)}»</strong> ergab keine Treffer.</h2>
      <h3>Tipps zur Suche</h3>
      <ul class="list--default">
        <li>Überprüfen Sie die Schreibweise Ihres Suchbegriffs.</li>
        <li>Verwenden Sie einen anderen oder allgemeineren Begriff.</li>
        <li>Verwenden Sie weniger Suchbegriffe.</li>
      </ul>
      ${C.notification(`<strong>Nicht gefunden, wonach Sie suchen?</strong><br>
        Wenden Sie sich an die zuständige Stelle oder öffnen Sie die
        <a href="#/services">Dienstleistungen</a>.`, 'info')}
    </div>`;
}
