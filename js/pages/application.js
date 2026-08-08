// Application landing page: #/applications/<appId>.
//
// Anatomy follows the current intranet page «BBL GIS IMMO
// (Geoinformationssystem)»: description · access (entry points + notices) ·
// training and further information · contact · last updated.
//
// The catalogue deliberately links here rather than directly into the app.
// Applications differ in entry point (embedded micro-app vs external system),
// access and contact; users need that context before opening it.

import { audienceTags } from '../domain.js';

const LAUNCH_LABEL = 'Anwendung starten';
const NO_ENTRY_POINT_MESSAGE = 'Für diese Anwendung ist im Prototyp kein Einstiegspunkt hinterlegt.';

// Since July 2026, landing-page fields (long, entries, access, resources,
// contact, updated) live on the application record itself; a second file with
// the same key had no purpose. `page` remains a local alias to keep references
// below concise.
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

  // Entry points: the main catalogue entry plus additional page-data entries
  // (BBL GIS IMMO, for example, has the portal and property inventory). A
  // catalogue link to «#» is a placeholder.
  const catalogEntry = a.link && a.link.href && a.link.href !== '#'
    ? { label: LAUNCH_LABEL, href: a.link.href, kind: a.link.kind }
    : null;
  const entries = [...(catalogEntry ? [catalogEntry] : []), ...(page.entries || [])];
  // The access-card button uses the first entry point.
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
      image: heroImage(C, a),
    })}

    ${''/* No mt-6: the shared .hero + .container--grid rule provides spacing
          below the hero (ONE value for every sibling detail page). */}
    <div class="container--grid gap--responsive">
      ${/* .stack-lg duplicated the same scale as CD's .vertical-spacing
            (3/3.5rem); use the canonical name (review layout/main-1). */''}
      <div class="container__main vertical-spacing">
        ${page.long ? section('Über die Anwendung', `<p>${C.escape(page.long)}</p>`) : ''}

        ${section('Einstieg', entries.length
          ? `<ul class="download-items">${entries.map(entryItem).join('')}</ul>`
          : `<p class="muted">${NO_ENTRY_POINT_MESSAGE}</p>`)}

        ${page.resources && page.resources.length
          ? section('Schulung und weitere Informationen',
              `<ul class="download-items">${page.resources.map(resourceItem).join('')}</ul>`)
          : ''}
      </div>

      ${/* NO .stack-lg here: .container__aside > * already provides CD spacing
            between sidebar modules (1.75/2rem; review layout/aside-1). */''}
      ${''/* Named sidebar with sr-h2, matching service detail. Without this level,
            box h3 headings followed the final main h2 in the outline
            (design review, pages). */}
      <aside class="container__aside" aria-labelledby="app-aside-head">
        <h2 class="sr-only" id="app-aside-head">Zugriff und Kontakt</h2>
        ${C.accessCard({
          href: primary ? primary.href : '',
          label: LAUNCH_LABEL,
          external: primary ? primary.kind === 'external' : false,
          newWindow: true,
          // Portal-internal domain apps (#/app/…) require login, using the same
          // gate the router places before the app itself (js/router.js). The entry
          // opens that gate in a new tab; external systems own their login.
          requiresLogin: !!primary && primary.kind !== 'external' && String(primary.href).startsWith('#/app/'),
          loggedIn: session.isLoggedIn(), user: session.user(),
          note: page.access && page.access.note ? page.access.note : '',
          steps: (page.access && page.access.steps) || [],
        })}

        ${C.contactBox(contact)}
        ${/* «Eckdaten» was removed (user decision 2026-08-06). Its six rows
              included an «Einstieg» that repeated the button above, while nobody
              looks for «Stand» or «ID» on a landing page. «Gruppe» and «Bereich»
              were removed with it and no longer appear here. The catalogue
              (#/applications?area=…) exposes both as filters. The landing page
              answers «what is this and how do I enter?», not «how is it filed?». */''}
      </aside>
    </div>
  </div>`;
}

// Hero image without caption. Pexels stock photos are stored locally under
// assets/images/applications/. The Pexels licence permits commercial use and
// requires NO attribution, so a credit here would be decoration rather than a
// condition and would tell readers nothing about the app. Author, licence and
// source page remain recorded in raw field: `bild` in data/applications.json, so
// maintainers can trace provenance.
function heroImage(C, application) {
  const image = application['bild'];
  if (!image || !image.src) return '';
  return C.photo({ src: image.src, alt: image['titel'] || application.name, w: 800, cls: 'photo--16x9' });
}

function crumbs() {
  return [
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'Anwendungen', href: '#/applications' },
  ];
}
