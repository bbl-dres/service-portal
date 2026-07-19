// Dokumente & Medien — hub page linking the document archive and the media library.
export default async function render(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;

  setTitle('Dokumente & Medien');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Dokumente & Medien' }]);

  const documents = core.documents();
  const media = core.media();

  // --- Entry cards -----------------------------------------------------------
  const entryCard = (o) => `
    <a class="card card--clickable" href="${o.href}">
      <div class="card__body">
        <div class="card__title">${C.escape(o.title)}</div>
        <p class="card__desc">${C.escape(o.desc)}</p>
      </div>
      <div class="card__footer">
        <span><strong>${o.count}</strong> ${C.escape(o.countLabel)}</span>
        <span class="btn btn--link">Öffnen ${C.icon('ArrowRight', 'icon--sm')}</span>
      </div>
    </a>`;

  const entries = [
    entryCard({
      title: 'Dokumentenarchiv',
      desc: 'Bauwerksdokumentationen, Grundrisse und Pläne pro Gebäude.',
      href: '#/app/document-archive',
      count: documents.length,
      countLabel: documents.length === 1 ? 'Dokument' : 'Dokumente',
    }),
    entryCard({
      title: 'Mediathek',
      desc: 'Fotos und Videos der Bauten, inkl. historischer Aufnahmen.',
      href: '#/app/mediathek',
      count: media.length,
      countLabel: media.length === 1 ? 'Medienobjekt' : 'Medienobjekte',
    }),
  ].join('');

  // --- "Zuletzt hinzugefügt" -------------------------------------------------
  // Recent documents (highest year first) + recent media (latest date first).
  const recentDocs = [...documents]
    .sort((a, b) => (b.year || 0) - (a.year || 0))
    .slice(0, 4);

  const recentMedia = [...media]
    .sort((a, b) => (parseInt(b.date, 10) || 0) - (parseInt(a.date, 10) || 0))
    .slice(0, 4);

  const docTile = (d) => {
    const b = core.building((d.linkedTo || [])[0]);
    return `
      <a class="card card--clickable" href="#/app/document-archive?id=${encodeURIComponent(d.docId)}">
        <div class="card__body">
          <div class="pill-row">
            ${C.badge(d.type, 'gray')}
            ${C.badge(d.format, 'info')}
          </div>
          <div class="card__title" style="font-size:var(--fs-base)">${C.escape(d.title)}</div>
          <p class="card__desc row gap-sm">
            ${C.icon('Building', 'icon--sm')} <span>${b ? C.escape(b.name) : 'Gebäudeübergreifend'} · ${C.escape(String(d.year))}</span>
          </p>
        </div>
      </a>`;
  };

  const mediaTile = (m) => {
    const b = core.building(m.buildingId);
    const isVideo = m.mediaType === 'video';
    const swatch = m.color || '#2f4356';
    return `
      <a class="card card--clickable" href="#/app/mediathek?id=${encodeURIComponent(m.mediaId)}">
        <div class="card__image" style="background:${C.escape(swatch)};display:flex;align-items:center;justify-content:center;color:#fff">
          ${C.icon(isVideo ? 'Video' : 'Image', 'icon--xl')}
        </div>
        <div class="card__body">
          <div class="pill-row">
            ${C.badge(isVideo ? 'Video' : 'Foto', isVideo ? 'red' : 'blue')}
            ${C.badge(m.historicPeriod === 'historisch' ? 'Historisch' : 'Aktuell', 'gray')}
          </div>
          <div class="card__title" style="font-size:var(--fs-base)">${C.escape(m.title)}</div>
          <p class="card__desc">${b ? C.escape(b.name) + ' · ' : ''}${C.escape(String(m.date))}</p>
        </div>
      </a>`;
  };

  const recentTiles = [
    ...recentDocs.map(docTile),
    ...recentMedia.map(mediaTile),
  ].join('');

  // --- Compose ---------------------------------------------------------------
  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Dokumente & Medien',
      lead: 'Zentraler Zugang zu Bauwerksdokumenten und Plänen sowie zu Fotos und Videos der Liegenschaften des Bundes.',
    })}

    <div class="grid grid--2 mt-4">
      ${entries}
    </div>

    <section class="mt-8">
      <h2>Zuletzt hinzugefügt</h2>
      ${recentTiles
        ? `<div class="grid grid--4 mt-4">${recentTiles}</div>`
        : C.empty('Noch keine Inhalte verfügbar.')}
    </section>
  </div>`;
}
