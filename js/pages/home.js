// Übersicht (landing) — full-width CD section stack (no content/sidebar split).
export default async function render(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  setTitle('Übersicht');
  setCrumbs([]);

  const news = core.news().slice(0, 3);

  const newsCard = (n) => `<a class="card card--clickable" href="#/knowledge?tab=news&id=${n.id}">
      <div class="card__image">
        ${C.photo({
          id: n.photo, color: n.color, alt: n.title, w: 640, cls: 'photo--scrim',
          style: 'height:100%;display:flex;align-items:flex-end;padding:.75rem',
          overlay: `<span class="badge badge--negative">${C.escape(n.source)}</span>`,
        })}
      </div>
      <div class="card__body">
        <span class="small muted">${C.escape(n.date)}</span>
        <div class="card__title">${C.escape(n.title)}</div>
        <p class="card__description">${C.escape(n.teaser)}</p>
      </div>
    </a>`;

  const moreLink = (href, label) => `<div class="more-link"><a class="btn btn--bare" href="${href}">${C.escape(label)} ${C.icon('ArrowRight', 'icon--base')}</a></div>`;

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Willkommen im BBL Kundenportal',
      lead: 'Dienstleistungen, Anwendungen, Dokumente und Daten des Bundesamts für Bauten und Logistik — an einem Ort.',
    })}
    <div class="stack-lg mt-8">
      <section>
        <h2>Aktuelles</h2>
        <div class="grid grid--3 mt-4">${news.map(newsCard).join('')}</div>
        ${moreLink('#/knowledge?tab=news', 'Alle anzeigen')}
      </section>
    </div>
  </div>`;
}
