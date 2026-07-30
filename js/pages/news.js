// News — eigener L1-Bereich (docs/sitemap.md §2.1). Bis Juli 2026 ein Abschnitt
// von «News und Wissen»; herausgelöst, weil eine Meldung datiert ist und einmal
// gelesen wird, während die Referenzschicht immer wieder konsultiert wird.
//
// Zwei Orte: `#/news` (Liste) und `#/news/<id>` (Meldung). Kein `?tab=`, kein
// Filter — die Liste ist chronologisch, das ist bei News die einzige Ordnung,
// die jemand erwartet.


// Aufschiebbare Bestände dieser Route. Der Router ruft core.ensure(needs) VOR
// render() auf — ohne die Deklaration läse ein Accessor die noch leere Liste
// und die Ansicht zeigte «keine Einträge» statt Daten (docs/code-review.md §3).
export const needs = ['news'];
export default async function render(ctx) {
  const { params, C } = ctx;
  const id = params[0] ? C.safeDecode(params[0]) : '';
  return id ? newsDetail(ctx, id) : newsList(ctx);
}

function newsList(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  setTitle('News');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News' }]);

  const items = [...core.news()].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'News',
      lead: 'Aktuelle Mitteilungen rund um das BBL, das Kundenportal und die Bundesverwaltung.',
    })}
    <h2 class="sr-only">Aktualitäten</h2>
    ${/* CD-Rasternamen (grids.postcss): grid--responsive-cols-N + gap--responsive
          statt der portal-eigenen grid--N-Aliasse (Review layout/grid-3/-4). */''}
    <div class="grid grid--responsive-cols-3 gap--responsive mt-6">
      ${/* Eine Quelle für die Nachrichtenkarte: C.card liefert das Stretched-Link-
            Muster (echte <h3> für die Gliederung) und den CD-Kartenfuss. */''}
      ${items.length ? items.map(n => C.card({
        title: n.title, desc: n.teaser,
        href: `#/news/${encodeURIComponent(n.id)}`,
        photo: { id: n.photo, color: n.color, alt: '' },
        footerInfo: `${C.escape(n.date)} · ${C.escape(n.source)}`, footerAction: C.cardAction(),
      })).join('') : ''}
    </div>
    ${items.length ? '' : C.empty('Keine Meldungen vorhanden.', { available: core.available('news') })}
  </div>`;
}

// Einzelne Meldung als eigene Seite (eigener Titel, h1, Brotkrume).
function newsDetail(ctx, id) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const n = core.newsItem(id);
  if (!n) {
    C.renderNotFound(ctx, { thing: 'Diese Meldung', title: 'Meldung nicht gefunden',
      backHref: '#/news', backLabel: 'News',
      crumbs: [{ label: 'Startseite', href: '#/' }, { label: 'News', href: '#/news' }] });
    return;
  }
  setTitle(n.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'News', href: '#/news' }, { label: n.title }]);
  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/news', 'News')}
    ${/* Die einzige lange Lesefläche der App. Mass und Rhythmus kommen aus CDs
          container__center--xs + .vertical-spacing; Datumszeile und Titel bleiben
          als <header> eng beieinander, statt wie alle anderen Kinder 1rem
          auseinanderzustehen. */''}
    <div class="container--grid">
      <article class="container__center--xs vertical-spacing mt-4">
        <header>
          <p class="small muted">${C.escape(n.date)} · ${C.escape(n.source)}</p>
          <h1 tabindex="-1">${C.escape(n.title)}</h1>
        </header>
        ${C.photo({ id: n.photo, color: n.color, alt: '', w: 1200, style: 'aspect-ratio:21/9;max-height:20rem;border-radius:var(--radius-lg)' })}
        <p class="lead">${C.escape(n.teaser)}</p>
        <div class="separator separator--md"></div>
        <p>${C.escape(n.body)}</p>
      </article>
    </div>
  </div>`;
}
