// Daten und Digitalisierung — Abschnitts-Übersicht. Die Unterseiten liegen in
// eigenen Modulen: catalog.js (Datenbezug), ict-projects.js, digitalisation.js.

// Nur was die ÜBERSICHT liest. Die Unterseiten fordern ihren Bestand selbst an
// (siehe unten) — stünde hier die Vereinigungsmenge, zöge `#/data/digitalisation`
// die 115 KB des Datenkatalogs mit, obwohl es keinen einzigen Datensatz liest.
export const needs = ['applications', 'datasets'];

// Bestand je Unterseite. `data.js` lädt sie per dynamischem Import, der Router
// sieht deren `needs` also nicht — deshalb hier ensure() vor dem Delegieren.
const SUBS = {
  catalog:        { mod: './catalog.js',        needs: ['datasets', 'catalogLabels'] },
  'ict-projects': { mod: './ict-projects.js',   needs: [] },
  digitalisation: { mod: './digitalisation.js', needs: [] },
};

export default async function render(ctx) {
  const { params, core } = ctx;
  if (!params.length) return overview(ctx);
  const sub = SUBS[params[0]];
  if (!sub) return notFound(ctx);
  const [mod] = await Promise.all([import(sub.mod), core.ensure(sub.needs)]);
  if (ctx.stale()) return;   // A2: nach dem await keine überholte Navigation überschreiben
  return mod.default(ctx);
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
      meta: '6 Themen' },
    { title: 'Datenbezug und API Verzeichnis', icon: 'FileDatabase', href: '#/data/catalog',
      desc: 'Datensatzkatalog nach DCAT-AP-CH: Beschreibung, Klassifizierung und Bezugswege der Datensätze des BBL.',
      meta: `${datasets} Datensätze` },
    // Ohne Zahl: der Metadatenbestand hängt an dieser Übersicht nicht (`needs`),
    // und eine fest eingetragene Zahl liefe der Datei davon.
    { title: 'Metadaten Katalog Bauten', icon: 'Stack', href: '#/app/metadata-catalog',
      desc: 'Fachbegriffe der Bauten und Liegenschaften und ihre Realisierung in den Führungssystemen — Geschäftsobjekte, Attribute und Systemtabellen.',
      meta: 'Geschäftsobjekte und Systemtabellen' },
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
      desc: 'Gemeinsam genutzte Anwendungen und Plattformen des Bundes — eGate, InfoPers, SUPERB, I14Y, TERMDAT, Geoportal, geocat.ch und simap.ch.',
      meta: `${count('federal')} Anwendungen` },
    { title: 'Alle Anwendungen', icon: 'Apps', href: '#/applications',
      desc: 'Der vollständige Anwendungskatalog des BBL und der Bundesverwaltung.',
      meta: `${apps.length} Anwendungen` },
    { title: 'Digitalisierung', icon: 'Book', href: '#/data/digitalisation',
      desc: 'Strategie, Vorhaben und Grundsätze der Digitalisierung im BBL.',
      meta: 'Strategie & Vorhaben' },
  ].map(C.domainTile).join('');

  // CDs Section-Anatomie: <section> aussen, .container innen — erst dadurch kann
  // das zweite Band von Rand zu Rand getönt sein. Die Kachelüberschrift war
  // sr-only, weil sie im weissen Einheitsfeld nichts zu gliedern hatte; als
  // .section__title eines eigenen Bandes wird sie sichtbar (Item 7.7).
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
