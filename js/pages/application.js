// Landingpage einer Anwendung — #/applications/<appId>.
//
// Aufbau nach der heutigen Intranetseite «BBL GIS IMMO (Geoinformationssystem)»:
// Beschreibung · Zugriff (Einstiegspunkte + Hinweise) · Schulung und weitere
// Informationen · Kontakt · Letzte Änderung.
//
// Der Katalog verlinkt bewusst hierher statt direkt in die Anwendung: die
// Anwendungen unterscheiden sich in Einstieg (eingebettete Micro-App vs.
// externes System), Berechtigung und Ansprechstelle — das gehört auf eine
// Seite, bevor jemand auf «Öffnen» klickt.

export default function render(ctx, appId) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const a = core.application(decodeURIComponent(appId));

  if (!a) {
    setTitle('Anwendung nicht gefunden');
    setCrumbs(crumbs());
    mount.innerHTML = `<div class="container section">
      ${C.backLink('#/applications', 'Anwendungen')}
      <div class="page-header mt-4"><h1 tabindex="-1">Anwendung nicht gefunden</h1></div>
      <p class="muted">Diese Anwendung existiert nicht. <a href="#/applications">Zur Übersicht «Anwendungen»</a></p>
    </div>`;
    return;
  }

  const page = core.appPage(a.appId) || {};
  setTitle(a.name);
  setCrumbs([...crumbs(), { label: a.name }]);

  const external = a.link && a.link.kind === 'external';

  // ---- Einstiegspunkte: der Haupteinstieg aus dem Katalog plus die
  // zusätzlichen aus den Seitendaten (BBL GIS IMMO hat z. B. Portal und
  // Liegenschaftsinventar). Ein Katalog-Link auf «#» ist ein Platzhalter.
  const catalogEntry = a.link && a.link.href && a.link.href !== '#'
    ? { label: `${a.name} öffnen`, href: a.link.href, kind: a.link.kind }
    : null;
  const entries = [...(catalogEntry ? [catalogEntry] : []), ...(page.entries || [])];
  // Der Knopf im Zugriff-Kasten führt auf den ersten Einstiegspunkt.
  const primary = entries[0] || null;

  const entryItem = (e) => {
    const ext = e.kind === 'external';
    const attrs = ext ? ' target="_blank" rel="noopener external"' : '';
    return `<li>
      <a class="download-item" href="${C.escape(e.href)}"${attrs}>
        ${C.icon(ext ? 'External' : 'ArrowRight', 'download-item__icon')}
        <div>
          <h3 class="download-item__title">${C.escape(e.label)}</h3>
          ${e.note ? `<p class="download-item__description">${C.escape(e.note)}</p>` : ''}
          <p class="meta-info download-item__meta-info">
            <span class="meta-info__item">${ext ? 'Externes System' : 'Im Kundenportal'}</span>
          </p>
        </div>
      </a></li>`;
  };

  const resourceItem = (r) => {
    const ext = r.kind === 'external';
    const attrs = ext ? ' target="_blank" rel="noopener external"' : '';
    return `<li>
      <a class="download-item" href="${C.escape(r.href)}"${attrs}>
        ${C.icon(ext ? 'External' : 'Book', 'download-item__icon')}
        <div>
          <h3 class="download-item__title">${C.escape(r.label)}</h3>
          ${r.note ? `<p class="download-item__description">${C.escape(r.note)}</p>` : ''}
        </div>
      </a></li>`;
  };

  const related = (page.related || [])
    .map(id => core.application(id)).filter(Boolean);

  const contact = page.contact ? core.contacts().find(c => c.contactId === page.contact) : null;

  // Ohne echtes Ziel führt der Katalogeintrag ins Leere — das sagen wir hier,
  // statt einen toten «Öffnen»-Button anzubieten.
  const noTarget = !primary;

  const section = (title, body) => `
    <section class="detail-section">
      <h2 class="detail-section__title">${C.escape(title)}</h2>
      ${body}
    </section>`;

  mount.innerHTML = `
  <div class="container section">
    ${C.backLink('#/applications', 'Anwendungen')}

    <div class="page-header">
      <p class="meta-info">
        <span class="meta-info__item">${C.escape(a.group)}</span>
        ${page.subtitle ? `<span class="meta-info__item">${C.escape(page.subtitle)}</span>` : ''}
      </p>
      <h1 tabindex="-1">${C.escape(a.name)}</h1>
      <p class="lead">${C.escape(a.description)}</p>
      <div class="pill-row mt-2">
        ${C.audienceTag(a.audience)}
        ${a.hero ? C.badge('Schlüsselanwendung', 'info') : ''}
        ${external ? C.badge('Externes System', 'gray') : C.badge('Im Kundenportal', 'blue')}
      </div>
    </div>

    <div class="split mt-6">
      <div class="stack-lg">
        ${page.long ? `<div><h2 class="detail-section__title">Über die Anwendung</h2><p>${C.escape(page.long)}</p></div>` : ''}

        ${section('Einstieg', entries.length
          ? `<ul class="download-items">${entries.map(entryItem).join('')}</ul>`
          : `<p class="muted">Für diese Anwendung ist im Prototyp kein Einstiegspunkt hinterlegt.</p>`)}

        ${page.resources && page.resources.length
          ? section('Schulung und weitere Informationen',
              `<ul class="download-items">${page.resources.map(resourceItem).join('')}</ul>`)
          : ''}

        ${related.length
          ? section('Verwandte Anwendungen', `<div class="grid grid--2">${related.map(r => C.card({
              title: r.name, desc: r.description,
              href: `#/applications/${encodeURIComponent(r.appId)}`,
              badges: [C.audienceTag(r.audience)],
              footer: `<span>${C.escape(r.group)}</span>
                <span class="btn btn--link">Öffnen ${C.icon('ArrowRight', 'icon--base')}</span>`,
            })).join('')}</div>`)
          : ''}
      </div>

      <aside class="stack-lg">
        <div class="box">
          <h3>Zugriff</h3>
          ${primary ? `<p style="margin:0 0 1rem">
            <a class="btn btn--outline btn--icon-right" href="${C.escape(primary.href)}"${
              primary.kind === 'external' ? ' target="_blank" rel="noopener external"' : ''}>${
              /* CD: das Icon steht im DOM zuerst, btn--icon-right dreht die Reihenfolge */
              C.icon(primary.kind === 'external' ? 'External' : 'ArrowRight', 'btn__icon')
              }<span class="btn__text">${C.escape(primary.label)}</span>
            </a></p>` : ''}
          ${page.access && page.access.note
            ? `<p class="small" style="margin:0">${C.escape(page.access.note)}</p>` : ''}
          ${page.access && page.access.steps && page.access.steps.length
            ? `<ul class="list--default small mt-2" style="color:var(--color-text-muted)">${
                page.access.steps.map(s => `<li>${C.escape(s)}</li>`).join('')}</ul>` : ''}
          ${noTarget ? `<p class="small muted" style="margin:0">Im Prototyp ist kein Zielsystem verknüpft.</p>` : ''}
        </div>

        ${contact ? `<div class="box">
          <h3>Kontakt</h3>
          <p class="small" style="margin:0">
            <strong>${C.escape(contact.name)}</strong><br>
            ${C.escape(contact.role)}<br>
            <a href="mailto:${C.escape(contact.email)}">${C.escape(contact.email)}</a><br>
            ${C.escape(contact.phone || '')}
          </p>
        </div>` : ''}

        <div class="box">
          <h3>Eckdaten</h3>
          <dl class="kv" style="margin:0">
            <dt>Gruppe</dt><dd>${C.escape(a.group)}</dd>
            ${a.bereich ? `<dt>Bereich</dt><dd>${C.escape(bereichLabel(a.bereich))}</dd>` : ''}
            <dt>Zugang</dt><dd>${C.escape(a.accessNote || '—')}</dd>
            <dt>Einstieg</dt><dd>${external ? 'Externes System' : 'Im Kundenportal'}</dd>
            ${page.updated ? `<dt>Letzte Änderung</dt><dd>${C.escape(page.updated)}</dd>` : ''}
            <dt>ID</dt><dd><code>${C.escape(a.appId)}</code></dd>
          </dl>
        </div>
      </aside>
    </div>

    ${C.backLink('#/applications', 'Anwendungen')}
  </div>`;
}

function crumbs() {
  return [
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Anwendungen', href: '#/applications' },
  ];
}

function bereichLabel(key) {
  return { bauten: 'Fachanwendungen Bauten', logistik: 'Fachanwendungen Logistik',
    zentral: 'Zentrale Systeme' }[key] || key;
}
