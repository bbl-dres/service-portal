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

// Die Landingpage-Felder (long, entries, access, resources, contact, updated)
// stehen seit 2026-07 am Anwendungsdatensatz selbst — es gab keinen Grund für
// eine zweite Datei mit demselben Schlüssel. `page` bleibt als lokaler Alias
// stehen, damit unten nicht jede Fundstelle umgeschrieben werden muss.
export default function render(ctx, appId) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const a = core.application(C.safeDecode(appId));

  if (!a) {
    C.renderNotFound(ctx, { thing: 'Diese Anwendung', title: 'Anwendung nicht gefunden',
      backHref: '#/applications', backLabel: 'Anwendungen', crumbs: crumbs() });
    return;
  }

  const page = a;
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

  const entryItem = (e) => C.downloadItem({
    href: e.href, title: e.label, note: e.note, heading: 'h3', wrapLi: true,
    external: e.kind === 'external', icon: e.kind === 'external' ? 'External' : 'ArrowRight',
    meta: [e.kind === 'external' ? 'Externes System' : 'Im Kundenportal'],
  });
  const resourceItem = (r) => C.downloadItem({
    href: r.href, title: r.label, note: r.note, heading: 'h3', wrapLi: true,
    external: r.kind === 'external', icon: r.kind === 'external' ? 'External' : 'Book',
  });

  const contact = page.contact ? core.contacts().find(c => c.contactId === page.contact) : null;

  // Ohne echtes Ziel führt der Katalogeintrag ins Leere — das sagen wir hier,
  // statt einen toten «Öffnen»-Button anzubieten.
  const noTarget = !primary;

  const section = (title, body) => C.detailSection({ title, body });

  mount.innerHTML = `
  <div class="container section">
    ${C.detailHead({
      backHref: '#/applications', backLabel: 'Anwendungen',
      title: a.name, lead: a.description,
      tags: `${C.audienceTag(a.audience)}${a.hero ? C.badge('Schlüsselanwendung', 'info') : ''}${
        external ? C.badge('Externes System', 'gray') : C.badge('Im Kundenportal', 'blue')}`,
      image: heroBild(C, a),
    })}

    <div class="container--grid gap--responsive mt-6">
      ${/* .stack-lg kodierte dieselbe Rampe wie CDs .vertical-spacing (3/3.5rem)
            ein zweites Mal — hier steht der kanonische Name (Review layout/main-1). */''}
      <div class="container__main vertical-spacing">
        ${page.long ? `<div><h2 class="detail-section__title">Über die Anwendung</h2><p>${C.escape(page.long)}</p></div>` : ''}

        ${section('Einstieg', entries.length
          ? `<ul class="download-items">${entries.map(entryItem).join('')}</ul>`
          : `<p class="muted">Für diese Anwendung ist im Prototyp kein Einstiegspunkt hinterlegt.</p>`)}

        ${page.resources && page.resources.length
          ? section('Schulung und weitere Informationen',
              `<ul class="download-items">${page.resources.map(resourceItem).join('')}</ul>`)
          : ''}
      </div>

      ${/* KEIN .stack-lg hier: den CD-Abstand der Aside-Module (1.75/2rem)
            liefert bereits .container__aside > * (Review layout/aside-1). */''}
      <aside class="container__aside">
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
            ? `<p class="small m-0">${C.escape(page.access.note)}</p>` : ''}
          ${page.access && page.access.steps && page.access.steps.length
            ? `<ul class="list--default small mt-2" style="color:var(--color-text-muted)">${
                page.access.steps.map(s => `<li>${C.escape(s)}</li>`).join('')}</ul>` : ''}
          ${noTarget ? `<p class="small muted m-0">Im Prototyp ist kein Zielsystem verknüpft.</p>` : ''}
        </div>

        ${C.contactBox(contact)}

        <div class="box">
          <h3>Eckdaten</h3>
          <dl class="kv m-0">
            <dt>Gruppe</dt><dd>${C.escape(a.group)}</dd>
            ${a.area ? `<dt>Bereich</dt><dd>${C.escape(bereichLabel(a.area))}</dd>` : ''}
            <dt>Zugang</dt><dd>${C.escape(a.accessNote || '—')}</dd>
            <dt>Einstieg</dt><dd>${external ? 'Externes System' : 'Im Kundenportal'}</dd>
            ${page.updated ? `<dt>Letzte Änderung</dt><dd>${C.escape(page.updated)}</dd>` : ''}
            <dt>ID</dt><dd><code>${C.escape(a.appId)}</code></dd>
          </dl>
        </div>
      </aside>
    </div>
  </div>`;
}

// Titelbild — ohne Bildlegende. Die Aufnahmen sind Stockbilder von Pexels und
// liegen lokal unter assets/images/applications/. Die Pexels-Lizenz erlaubt die
// Nutzung auch kommerziell und verlangt KEINE Namensnennung, der Nachweis ist
// hier also keine Bedingung, sondern nur Zierde — und eine Zeile «Fotograf —
// Pexels» unter jedem Symbolbild sagt der Leserin nichts über die Anwendung.
// Urheber, Lizenz und Quellseite bleiben in data/applications.json `bild`
// erfasst, damit die Herkunft beim Pflegen nachvollziehbar bleibt.
function heroBild(C, a) {
  const b = a.bild;
  if (!b || !b.src) return '';
  return C.photo({ src: b.src, alt: b.titel || a.name, w: 800 });
}

function crumbs() {
  return [
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Anwendungen', href: '#/applications' },
  ];
}

function bereichLabel(key) {
  return { buildings: 'Fachanwendungen Bauten', logistics: 'Fachanwendungen Logistik',
    central: 'Zentrale Systeme' }[key] || key;
}
