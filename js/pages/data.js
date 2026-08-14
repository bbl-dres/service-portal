// Data and digitalisation section overview. Its child pages live in separate
// modules: catalog.js (data access), ict-projects.js, and digitalisation.js.

// A registry holds the module and collections for each delegated child view.
// The router calls `needs(params)` before render() reaches its first accessor,
// so data.js loads no collections outside this contract.
const SUBPAGES = {
  // `users` carries the bookmark seed: the dataset detail page draws the
  // «merken» star, and without the directory the star would render unfilled for
  // a person whose favourites already contain the dataset.
  catalog:        { modulePath: './catalog.js',        needs: ['datasets', 'catalogLabels', 'users'] },
  'ict-projects': { modulePath: './ict-projects.js',   needs: [] },
  digitalisation: { modulePath: './digitalisation.js', needs: [] },
  // The architecture signpost counts every layer it names, so it declares all
  // four collections. They are small (~90KB together) and this is a page people
  // pass THROUGH — the apps it points at need the same data one click later.
  architecture:   { modulePath: './architecture.js',   needs: ['processes', 'businessObjects', 'dataTables', 'datasets'] },
};

const OVERVIEW_NEEDS = ['applications', 'datasets'];
// The field definitions behind a dataset's «Datenfelder» tab. Loaded ONLY for a
// dataset's own page: the catalogue list shows titles and themes, and nobody
// browsing it needs 275 column definitions. `needs` sees the route parameters,
// so this is the one place that can tell the list from the detail.
const DETAIL_NEEDS = { catalog: ['dataTables'] };

// With no child route, data.js renders the overview. Known child routes read
// their entry from the same registry as the delegate. An unknown path also
// needs no collection before it renders the local 404 view.
export function needs(params = []) {
  if (!params.length) return OVERVIEW_NEEDS;
  const base = SUBPAGES[params[0]]?.needs || [];
  return params[1] ? [...base, ...(DETAIL_NEEDS[params[0]] || [])] : base;
}

export default async function render(ctx) {
  const { params } = ctx;
  if (!params.length) return overview(ctx);
  const subpage = SUBPAGES[params[0]];
  if (!subpage) return notFound(ctx);
  const module = await import(subpage.modulePath);
  if (ctx.stale()) return;   // A2: do not overwrite newer navigation after await
  return module.default(ctx);
}

// Section overview — the CD pattern for a top-level area: a short lead plus
// cards onto everything the section contains. (bbl.admin.ch, swisstopo.admin.ch)
function overview(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  setTitle('Daten und Digitalisierung');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Daten und Digitalisierung' }]);

  const apps = core.applications();
  const count = (b) => apps.filter(a => a.area === b).length;
  const datasets = core.datasets().length;

  const entries = [
    { title: 'Datenportal', icon: 'ChartBar', href: '#/app/dataportal',
      desc: 'Auswertungen zu den Kennzahlen des BBL — Energie, Immobilien, Beschaffung, Personal.',
      meta: '7 Themen' },
    { title: 'Datenbezug und API Verzeichnis', icon: 'FileDatabase', href: '#/data/catalog',
      desc: 'Datensatzkatalog nach DCAT-AP-CH: Beschreibung, Klassifizierung und Bezugswege der Datensätze des BBL.',
      meta: `${datasets} Datensätze` },
    // No count: this overview does not depend on the metadata collection
    // (`needs`), and a hard-coded count would drift from the file.
    { title: 'Dokumentation der Geschäftsarchitektur', icon: 'Stack', href: '#/app/metadata-catalog',
      desc: 'Geschäftsobjekte des BBL, ihre Realisierung in den Führungssystemen und die Wertelisten, auf die beide verweisen.',
      meta: 'Geschäftsobjekte, Systeme und Referenzdaten' },
    // No count, for the same reason as the metadata catalogue.
    { title: 'Prozessdokumentation Bauten', icon: 'Share', href: '#/app/process-docs',
      desc: 'Die Prozesse des Immobilienmanagements mit BPMN-Diagrammen und Prozessschritten — von der Akquisition bis zur Rückgabe.',
      meta: 'Prozesslandkarte und BPMN' },
    { title: 'Bauwerksdokumentation', icon: 'Folder', href: '#/app/document-archive',
      desc: 'Bauwerksdokumentationen, Grundrisse und Pläne pro Gebäude durchsuchen und beziehen.',
      meta: 'Dokumentenarchiv' },
    { title: 'Mediathek Bauten', icon: 'Image', href: '#/app/media-library',
      desc: 'Digital-Asset-Management für Fotos und Videos der Bundesbauten, inkl. historischer Aufnahmen.',
      meta: 'DAM' },
    { title: 'Fachanwendungen Bauten', icon: 'Building', href: '#/applications?area=buildings',
      desc: 'Fachanwendungen für Immobilien, Bauprojekte und Bauwerksdokumentation.',
      meta: `${count('buildings')} Anwendungen` },
    { title: 'Fachanwendungen Logistik', icon: 'ShoppingCart', href: '#/applications?area=logistics',
      desc: 'Fachanwendungen für Arbeitsplatz, Beschaffung und Logistik.',
      meta: `${count('logistics')} Anwendungen` },
    { title: 'Fachanwendungen Bundesverwaltung', icon: 'Key', href: '#/applications?area=federal',
      desc: 'Gemeinsam genutzte Anwendungen und Plattformen des Bundes — eGate, InfoPers, SAP ERP, I14Y, TERMDAT, Geoportal, geocat.ch und simap.ch.',
      meta: `${count('federal')} Anwendungen` },
    { title: 'Alle Anwendungen', icon: 'Apps', href: '#/applications',
      desc: 'Der vollständige Anwendungskatalog des BBL und der Bundesverwaltung.',
      meta: `${apps.length} Anwendungen` },
    { title: 'Digitalisierung', icon: 'Book', href: '#/data/digitalisation',
      desc: 'Strategie, Vorhaben und Grundsätze der Digitalisierung im BBL.',
      meta: 'Strategie & Vorhaben' },
  ].map(C.domainTile).join('');

  // CD section anatomy: <section> outside, .container inside. Only then can the
  // second band be tinted edge to edge. The tile heading was sr-only because it
  // had nothing to organise in the single white field; as the .section__title
  // of its own band, it becomes visible (Item 7.7).
  mount.innerHTML = `
    ${C.pageSection({
      body: C.pageHeader({
        title: 'Daten und Digitalisierung',
        lead: 'Auswertungen, Datenbezug und API Verzeichnis sowie die Fachanwendungen des BBL — an einem Ort.',
      }),
    })}
    ${C.pageSection({ title: 'Angebote', alt: true, body: `<div class="grid grid--responsive-cols-3">${entries}</div>` })}`;
}

function notFound(ctx) {
  ctx.C.renderNotFound(ctx, { thing: 'Diese Seite', title: 'Seite nicht gefunden',
    backHref: '#/data', backLabel: 'Daten und Digitalisierung',
    crumbs: [{ label: 'Startseite', href: '#/' }, { label: 'Daten und Digitalisierung', href: '#/data' }] });
}
