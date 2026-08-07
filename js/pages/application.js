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

import { audienceTags } from '../domain.js';

const LAUNCH_LABEL = 'Anwendung starten';

// Die Landingpage-Felder (long, entries, access, resources, contact, updated)
// stehen seit 2026-07 am Anwendungsdatensatz selbst — es gab keinen Grund für
// eine zweite Datei mit demselben Schlüssel. `page` bleibt als lokaler Alias
// stehen, damit unten nicht jede Fundstelle umgeschrieben werden muss.
export default function render(ctx, appId) {
  const { mount, core, session, C, setTitle, setCrumbs } = ctx;
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
    ? { label: LAUNCH_LABEL, href: a.link.href, kind: a.link.kind }
    : null;
  const entries = [...(catalogEntry ? [catalogEntry] : []), ...(page.entries || [])];
  // Der Knopf im Zugriff-Kasten führt auf den ersten Einstiegspunkt.
  const primary = entries[0] || null;

  const entryItem = (e) => C.downloadItem({
    href: e.href, title: e.label, note: e.note, heading: 'h3', wrapLi: true,
    external: e.kind === 'external', newWindow: true, icon: 'External',
    meta: [e.kind === 'external' ? 'Externes System' : 'Im Kundenportal'],
  });
  const resourceItem = (r) => C.downloadItem({
    href: r.href, title: r.label, note: r.note, heading: 'h3', wrapLi: true,
    external: r.kind === 'external', icon: r.kind === 'external' ? 'External' : 'Book',
  });

  const contact = page.contact ? core.contacts().find(c => c.contactId === page.contact) : null;

  const section = (title, body) => C.detailSection({ title, body });

  mount.innerHTML = `
  <div class="container section">
    ${C.detailHead({
      backHref: '#/applications', backLabel: 'Anwendungen',
      title: a.name, lead: a.description,
      tags: `${audienceTags(core, C, a.audience)}${a.hero ? C.badge('Schlüsselanwendung', 'info') : ''}${
        external ? C.badge('Externes System', 'gray') : C.badge('Im Kundenportal', 'blue')}`,
      image: heroBild(C, a),
    })}

    ${''/* Kein mt-6 mehr: den Abstand unter dem Hero trägt die geteilte Regel
          .hero + .container--grid (EIN Wert für alle Detail-Geschwister). */}
    <div class="container--grid gap--responsive">
      ${/* .stack-lg kodierte dieselbe Rampe wie CDs .vertical-spacing (3/3.5rem)
            ein zweites Mal — hier steht der kanonische Name (Review layout/main-1). */''}
      <div class="container__main vertical-spacing">
        ${page.long ? section('Über die Anwendung', `<p>${C.escape(page.long)}</p>`) : ''}

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
      ${''/* Benannte Randspalte mit sr-h2 — wie das Dienstleistungs-Detail; ohne
            die Stufe hingen die Box-h3 in der Gliederung unter der letzten
            Haupt-h2 (Design-Review, pages). */}
      <aside class="container__aside" aria-labelledby="app-aside-head">
        <h2 class="sr-only" id="app-aside-head">Zugriff und Kontakt</h2>
        ${C.accessCard({
          href: primary ? primary.href : '',
          label: LAUNCH_LABEL,
          external: primary ? primary.kind === 'external' : false,
          newWindow: true,
          // Portalinterne Fachanwendungen (#/app/…) verlangen eine Anmeldung —
          // dieselbe Sperre, die der Router vor der Anwendung selbst zieht
          // (js/router.js). Der Einstieg öffnet diese Sperre im neuen Tab;
          // externe Systeme bringen ihre eigene Anmeldung mit.
          requiresLogin: !!primary && primary.kind !== 'external' && String(primary.href).startsWith('#/app/'),
          loggedIn: session.isLoggedIn(), user: session.user(),
          note: page.access && page.access.note ? page.access.note : '',
          steps: (page.access && page.access.steps) || [],
        })}

        ${C.contactBox(contact)}
        ${/* «Eckdaten» ist entfallen (Nutzerentscheid 2026-08-06). Die Karte trug
              sechs Zeilen, von denen «Einstieg» den Knopf darüber wiederholte und
              «Stand» und «ID» auf einer Landingpage niemand sucht.
              MIT ENTFALLEN sind «Gruppe» und «Bereich»: sie stehen jetzt auf
              dieser Seite nirgends mehr. Erschlossen wird die Anwendung über den
              Katalog (#/applications?area=…), der beide als Filter führt — die
              Landingpage beantwortet «was ist das und wie komme ich rein?»,
              nicht «wie ist das abgelegt?». */''}
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
  return C.photo({ src: b.src, alt: b.titel || a.name, w: 800, cls: 'photo--16x9' });
}

function crumbs() {
  return [
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Anwendungen', href: '#/applications' },
  ];
}
