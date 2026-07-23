// Mediathek — Immobilien-Medienbibliothek (Fotos & Videos der Bauten), modelliert nach mediathek.admin.ch.

// Historic material is rendered desaturated, so the archive reads as an archive.
const isHistoric = (m) => m.historicPeriod === 'historisch';
// Demo images are Unsplash placeholders — say so rather than passing them off
// as the (fictional) BBL archive credits shown in the metadata block.
const PLACEHOLDER_NOTE = '<p class="small muted">Platzhalterbild (Unsplash) — Demo-Daten, nicht das reale Archivbild.</p>';

export default async function render(ctx) {
  const { mount, params, query, core, C, setTitle, setCrumbs } = ctx;
  if (params[0]) return detail(ctx, params[0]);

  setTitle('Mediathek');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Dokumente & Medien', href: '#/documents' },
    { label: 'Mediathek' },
  ]);

  const all = core.media();
  const buildings = core.buildings();
  const histCount = all.filter(m => m.historicPeriod === 'historisch').length;

  // Local filter state (re-render driven). Lightbox holds the currently opened mediaId.
  const state = {
    typ: query.get('type') || 'alle',     // alle | photo | video
    epoche: 'alle',                        // alle | historisch | aktuell
    building: query.get('building') || 'alle',
    lightbox: query.get('id') || null,
  };

  const bname = (id) => { const b = core.building(id); return b ? b.name : id; };

  function periodBadge(p) {
    return p === 'historisch'
      ? C.badge('Historisch', 'warning')
      : C.badge('Aktuell', 'info');
  }

  function filtered() {
    return all.filter(m =>
      (state.typ === 'alle' || m.mediaType === state.typ) &&
      (state.epoche === 'alle' || m.historicPeriod === state.epoche) &&
      (state.building === 'alle' || m.buildingId === state.building)
    );
  }

  function chip(label, group, value) {
    const active = state[group] === value;
    return `<button type="button" class="tag-item${active ? " tag-item--active" : ""}" aria-pressed="${!!(active)}" data-group="${group}" data-value="${C.escape(value)}"><span class="tag-item__inner"><span class="tag-item__text">${C.escape(label)}</span></span></button>`;
  }

  function tileMarkup(m) {
    const isVideo = m.mediaType === 'video';
    return `
      <a class="card card--clickable media-tile" href="#/app/mediathek/${encodeURIComponent(m.mediaId)}" data-media="${C.escape(m.mediaId)}">
        ${C.photo({
          id: m.photo, color: m.color, alt: m.title, w: 640, gray: isHistoric(m),
          cls: 'media-preview photo--scrim',
          style: 'height:150px;display:flex;align-items:flex-end;justify-content:space-between;padding:.6rem .75rem',
          overlay: `
            ${isVideo ? `<span class="media-play" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;opacity:.92;">${C.icon('Video', 'icon--xl')}</span>` : ''}
            <span class="media-type-icon" style="color:rgba(255,255,255,.9);">${C.icon(isVideo ? 'Video' : 'Image', 'icon--base')}</span>
            <span class="badge badge--gray" style="background:rgba(0,0,0,.45);color:#fff;">${C.escape(m.date)}</span>`,
        })}
        <div class="card__body">
          <div class="card__title" style="font-size:var(--fs-base);">${C.escape(m.title)}</div>
          <p class="card__description" style="margin:0;">${C.icon('Building', 'icon--base')} ${C.escape(bname(m.buildingId))}</p>
          <div class="pill-row mt-2">${periodBadge(m.historicPeriod)}${m.accessLevel !== 'öffentlich' ? C.badge('Intern', 'gray') : ''}</div>
        </div>
      </a>`;
  }

  function lightboxMarkup() {
    if (!state.lightbox) return '';
    const m = core.media().find(x => x.mediaId === state.lightbox);
    if (!m) return '';
    const isVideo = m.mediaType === 'video';
    const isPublic = m.accessLevel === 'öffentlich';
    return `
    <div class="lightbox" id="lightbox" style="margin-top:2rem;">
      <div class="card">
        <div class="card__body" style="gap:1.25rem;">
          <div class="row row--between">
            <div class="row gap-sm">${C.badge(isVideo ? 'Video' : 'Foto', 'blue')}${periodBadge(m.historicPeriod)}</div>
            <button type="button" class="btn btn--link" id="lb-close">${C.icon('Cancel', 'icon--base')} Schliessen</button>
          </div>
          <div class="split">
            <div class="stack">
              ${C.photo({
                id: m.photo, color: m.color, alt: m.title, w: 1000, gray: isHistoric(m),
                style: 'height:320px;border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center',
                overlay: isVideo ? `<span style="color:#fff;opacity:.92;">${C.icon('Video', 'icon--xl')}</span>` : '',
              })}
              ${PLACEHOLDER_NOTE}
            </div>
            <aside class="stack">
              <h2 style="margin:0;font-size:var(--fs-xl);">${C.escape(m.title)}</h2>
              <dl class="kv">
                <dt>Typ</dt><dd>${isVideo ? 'Video' : 'Foto'}</dd>
                <dt>Datum</dt><dd>${C.escape(m.date)}</dd>
                <dt>Epoche</dt><dd>${m.historicPeriod === 'historisch' ? 'Historisch' : 'Aktuell'}</dd>
                <dt>Gebäude</dt><dd><a href="#/app/portfolio/${encodeURIComponent(m.buildingId)}">${C.escape(bname(m.buildingId))}</a></dd>
                <dt>${isVideo ? 'Quelle' : 'Fotograf:in'}</dt><dd>${C.escape(m.photographer)}</dd>
                <dt>Copyright</dt><dd>${C.escape(m.copyright)}</dd>
                <dt>Zugriff</dt><dd>${C.escape(m.accessLevel)}</dd>
              </dl>
              <a class="btn btn--outline" href="${C.escape(m.url || '#')}">${C.icon('Download', 'icon--base')} Herunterladen</a>
              ${!isPublic ? C.notification('Dieses Medium ist als <strong>intern</strong> klassifiziert. Der Download erfordert eine entsprechende Berechtigung.', 'warning', 'Lock') : `<p class="small muted">Frei verwendbar gemäss angegebenem Copyright.</p>`}
            </aside>
          </div>
        </div>
      </div>
    </div>`;
  }

  function draw() {
    const list = filtered();
    mount.innerHTML = `
    <div class="container section">
      ${C.pageHeader({
        title: 'Mediathek',
        lead: `Fotos und Videos der Bundesbauten — von historischen Aufnahmen bis zu aktuellen Dokumentationen. ${histCount} historische Aufnahmen verfügbar.`,
      })}

      <div class="box stack" style="margin-bottom:1.5rem;">
        <div>
          <div class="small muted" style="font-weight:var(--fw-bold);margin-bottom:.35rem;">Typ</div>
          <div class="list list--flex list--wrap">
            ${chip('Alle', 'typ', 'alle')}
            ${chip('Foto', 'typ', 'photo')}
            ${chip('Video', 'typ', 'video')}
          </div>
        </div>
        <div>
          <div class="small muted" style="font-weight:var(--fw-bold);margin-bottom:.35rem;">Epoche</div>
          <div class="list list--flex list--wrap">
            ${chip('Alle', 'epoche', 'alle')}
            ${chip('Historisch', 'epoche', 'historisch')}
            ${chip('Aktuell', 'epoche', 'aktuell')}
          </div>
        </div>
        <div>
          <label for="med-building" class="small muted" style="display:block;font-weight:var(--fw-bold);margin-bottom:.35rem;">Gebäude</label>
          <div class="select" style="max-width:24rem;">
            <select id="med-building" class="input--outline input--base">
              <option value="alle"${state.building === 'alle' ? ' selected' : ''}>Alle Gebäude</option>
              ${buildings.map(b => `<option value="${C.escape(b.bbl_id)}"${state.building === b.bbl_id ? ' selected' : ''}>${C.escape(b.name)} — ${C.escape(b.city)}</option>`).join('')}
            </select>
            <div class="select__icon">${C.chevron}</div>
          </div>
        </div>
      </div>

      <p class="muted small">${list.length} ${list.length === 1 ? 'Eintrag' : 'Einträge'}</p>

      ${list.length
        ? `<div class="grid grid--auto mt-2">${list.map(tileMarkup).join('')}</div>`
        : C.empty('Keine Medien für die gewählten Filter gefunden.')}

      ${lightboxMarkup()}
    </div>`;

    wire();
  }

  function wire() {
    mount.querySelectorAll('.tag-item[data-group]').forEach(btn => {
      btn.addEventListener('click', () => {
        state[btn.dataset.group] = btn.dataset.value;
        draw();
      });
    });
    const sel = mount.querySelector('#med-building');
    if (sel) sel.addEventListener('change', () => { state.building = sel.value; draw(); });

    // Open lightbox inline instead of navigating away.
    mount.querySelectorAll('.media-tile[data-media]').forEach(tile => {
      tile.addEventListener('click', (e) => {
        e.preventDefault();
        state.lightbox = tile.dataset.media;
        draw();
        const lb = mount.querySelector('#lightbox');
        if (lb) lb.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    const close = mount.querySelector('#lb-close');
    if (close) close.addEventListener('click', () => { state.lightbox = null; draw(); });
  }

  draw();
}

// Detail view: #/app/mediathek/MED-001
function detail(ctx, id) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const m = core.media().find(x => x.mediaId === id);
  if (!m) {
    mount.innerHTML = `<div class="container section">${C.backLink('#/app/mediathek', 'Zur Mediathek')}${C.empty('Medium nicht gefunden.')}</div>`;
    return;
  }

  setTitle(m.title);
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Dokumente & Medien', href: '#/documents' },
    { label: 'Mediathek', href: '#/app/mediathek' },
    { label: m.title },
  ]);

  const b = core.building(m.buildingId);
  const bn = b ? b.name : m.buildingId;
  const isVideo = m.mediaType === 'video';
  const isPublic = m.accessLevel === 'öffentlich';
  const periodBadge = m.historicPeriod === 'historisch'
    ? C.badge('Historisch', 'warning')
    : C.badge('Aktuell', 'info');

  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/app/mediathek', 'Zur Mediathek')}
    <div class="split mt-4">
      <div class="stack">
        <div class="row gap-sm">${C.badge(isVideo ? 'Video' : 'Foto', 'blue')}${periodBadge}</div>
        <h1 tabindex="-1">${C.escape(m.title)}</h1>
        ${C.photo({
          id: m.photo, color: m.color, alt: m.title, w: 1200, gray: m.historicPeriod === 'historisch',
          style: 'height:380px;border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center',
          overlay: isVideo ? `<span style="color:#fff;opacity:.92;">${C.icon('Video', 'icon--xl')}</span>` : '',
        })}
        ${PLACEHOLDER_NOTE}
        <a class="btn btn--outline btn--lg" href="${C.escape(m.url || '#')}">${C.icon('Download', 'icon--base')} Herunterladen</a>
        ${!isPublic
          ? C.notification('Dieses Medium ist als <strong>intern</strong> klassifiziert. Der Download erfordert eine entsprechende Berechtigung (Freigabe).', 'warning', 'Lock')
          : `<p class="small muted">Frei verwendbar gemäss angegebenem Copyright.</p>`}
      </div>
      <aside class="stack-lg">
        <div class="box">
          <h3>Metadaten</h3>
          <dl class="kv">
            <dt>Typ</dt><dd>${isVideo ? 'Video' : 'Foto'}</dd>
            <dt>Datum</dt><dd>${C.escape(m.date)}</dd>
            <dt>Epoche</dt><dd>${m.historicPeriod === 'historisch' ? 'Historisch' : 'Aktuell'}</dd>
            <dt>Gebäude</dt><dd><a href="#/app/portfolio/${encodeURIComponent(m.buildingId)}">${C.escape(bn)}</a></dd>
            <dt>${isVideo ? 'Quelle' : 'Fotograf:in'}</dt><dd>${C.escape(m.photographer)}</dd>
            <dt>Copyright</dt><dd>${C.escape(m.copyright)}</dd>
            <dt>Zugriff</dt><dd>${C.escape(m.accessLevel)}</dd>
          </dl>
        </div>
      </aside>
    </div>
  </div>`;
}
