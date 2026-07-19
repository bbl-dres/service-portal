// Übersicht (landing) — full-width CD section stack (no content/sidebar split).
export default async function render(ctx) {
  const { mount, core, engine, C, setTitle, setCrumbs } = ctx;
  setTitle('Übersicht');
  setCrumbs([]);

  const popular = core.services().filter(s => s.popular);
  const open = engine.instances().filter(i => !['abgeschlossen', 'erledigt', 'geliefert'].includes(i.status)).slice(0, 3);
  const news = core.news().slice(0, 3);
  // Service teasers — text-led, no icon (CD teaser style)
  const serviceTile = (s) => `<a class="tile" href="#/services/${s.serviceId}">
      <span class="tile__title">${C.escape(s.title)}</span>
      <span class="tile__desc">${C.escape(s.short)}</span>
      <span>${C.audienceTag(s.audience)}</span>
    </a>`;

  const openCard = (i) => `<a class="card card--clickable" href="#/my-cases/${i.instanceId}">
      <div class="card__body">
        <div class="pill-row">${C.statusBadge(i.status, statusLabel(core, i.status))}</div>
        <div class="card__title">${C.escape(i.title)}</div>
        <p class="card__desc">${C.escape(i.reference)} · ${C.escape(i.defName)}</p>
      </div>
    </a>`;

  const newsCard = (n) => `<a class="card card--clickable" href="#/knowledge?tab=news&id=${n.id}">
      <div class="card__image" style="background:${C.escape(n.color)};display:flex;align-items:flex-end;padding:.75rem">
        <span class="badge badge--on-image">${C.escape(n.source)}</span>
      </div>
      <div class="card__body">
        <span class="small muted">${C.escape(n.date)}</span>
        <div class="card__title">${C.escape(n.title)}</div>
        <p class="card__desc">${C.escape(n.teaser)}</p>
      </div>
    </a>`;

  const moreLink = (href, label) => `<div class="more-link"><a class="btn btn--bare" href="${href}">${C.escape(label)} ${C.icon('ArrowRight', 'icon--sm')}</a></div>`;

  mount.innerHTML = `
  <section class="hero">
    <div class="container">
      <h1 tabindex="-1">Willkommen auf der BBL Service-Plattform</h1>
      <p class="lead">Dienstleistungen, Anwendungen, Dokumente und Daten des Bundesamts für Bauten und Logistik — an einem Ort.</p>
      <form class="hero__search" id="hero-search" role="search">
        <label class="sr-only" for="hs">Was benötigen Sie?</label>
        <input id="hs" type="search" placeholder="Was benötigen Sie? z. B. Störung, Raumbedarf, Parkplatz…" autocomplete="off">
        <button class="btn btn--filled btn--lg" type="submit">Suchen</button>
      </form>
    </div>
  </section>

  <div class="container section">
    <div class="stack-lg">
      <section>
        <h2>Aktuelles</h2>
        <div class="grid grid--3 mt-4">${news.map(newsCard).join('')}</div>
        ${moreLink('#/knowledge?tab=news', 'Alle anzeigen')}
      </section>

      <section>
        <h2>Beliebte Services</h2>
        <div class="grid grid--3 mt-4">${popular.map(serviceTile).join('')}</div>
        ${moreLink('#/services', 'Alle Dienstleistungen')}
      </section>

      <section>
        <h2>Meine offenen Anfragen</h2>
        ${open.length ? `<div class="grid grid--3 mt-4">${open.map(openCard).join('')}</div>` : C.empty('Keine offenen Vorgänge.')}
        ${moreLink('#/my-cases', 'Alle Vorgänge')}
      </section>

    </div>
  </div>`;

  mount.querySelector('#hero-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = mount.querySelector('#hs').value.trim();
    location.hash = q ? `#/services?q=${encodeURIComponent(q)}` : '#/services';
  });
}

function statusLabel(core, id) {
  const m = (core.ref().statusModel || []).find(s => s.id === id);
  return m ? m.label : id;
}
