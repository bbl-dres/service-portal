// Daten und Digitalisierung — Abschnitts-Übersicht. Die Unterseiten liegen in
// eigenen Modulen: katalog.js (Datenbezug), ikt-vorhaben.js, digitalisierung.js.

export default async function render(ctx) {
  const { params } = ctx;
  if (!params.length) return overview(ctx);
  if (params[0] === 'katalog') return (await import('./katalog.js')).default(ctx);
  if (params[0] === 'ikt-vorhaben') return (await import('./ikt-vorhaben.js')).default(ctx);
  if (params[0] === 'digitalisierung') return (await import('./digitalisierung.js')).default(ctx);
  return notFound(ctx);
}

// Section overview — the CD pattern for a top-level area: a short lead plus
// cards onto everything the section contains. (bbl.admin.ch, swisstopo.admin.ch)
function overview(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  setTitle('Daten und Digitalisierung');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Daten und Digitalisierung' }]);

  const apps = core.applications();
  const count = (b) => apps.filter(a => a.bereich === b).length;
  const datasets = core.datasets().length;

  const entries = [
    { title: 'Datenportal', icon: 'ChartBar', href: '#/app/dataportal',
      desc: 'Auswertungen und Dashboards zu den Kennzahlen des BBL — Energie, Immobilien, Beschaffung, Personal.',
      meta: '6 Themen' },
    { title: 'Datenbezug', icon: 'FileDatabase', href: '#/data/katalog',
      desc: 'Datensatzkatalog nach DCAT-AP-CH: Beschreibung, Klassifizierung und Bezugswege der Datensätze des BBL.',
      meta: `${datasets} Datensätze` },
    { title: 'Bauwerksdokumentation', icon: 'Folder', href: '#/app/document-archive',
      desc: 'Bauwerksdokumentationen, Grundrisse und Pläne pro Gebäude durchsuchen und beziehen.',
      meta: 'Dokumentenarchiv' },
    { title: 'Mediathek', icon: 'Image', href: '#/app/mediathek',
      desc: 'Digital-Asset-Management für Fotos und Videos der Bundesbauten, inkl. historischer Aufnahmen.',
      meta: 'DAM' },
    { title: 'Fachanwendungen Bauten', icon: 'Building', href: '#/applications?bereich=bauten',
      desc: 'Fachanwendungen für Immobilien, Bauprojekte und Bauwerksdokumentation.',
      meta: `${count('bauten')} Anwendungen` },
    { title: 'Fachanwendungen Logistik', icon: 'ShoppingCart', href: '#/applications?bereich=logistik',
      desc: 'Fachanwendungen für Arbeitsplatz, Beschaffung und Logistik.',
      meta: `${count('logistik')} Anwendungen` },
    { title: 'Alle Anwendungen', icon: 'Apps', href: '#/applications',
      desc: 'Der vollständige Anwendungskatalog, inklusive der zentralen Systeme der Bundesverwaltung.',
      meta: `${apps.length} Anwendungen` },
    { title: 'Digitalisierung', icon: 'Book', href: '#/data/digitalisierung',
      desc: 'Strategie, Vorhaben und Grundsätze der Digitalisierung im BBL.',
      meta: 'Strategie & Vorhaben' },
  ].map(C.domainTile).join('');

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'Daten und Digitalisierung',
      lead: 'Auswertungen, Datenbezug und die Fachanwendungen des BBL — an einem Ort.',
    })}
    <div class="grid grid--3 mt-8">${entries}</div>
  </div>`;
}

function notFound(ctx) {
  const { mount, setTitle, setCrumbs } = ctx;
  setTitle('Seite nicht gefunden');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Daten und Digitalisierung', href: '#/data' }, { label: 'Nicht gefunden' }]);
  mount.innerHTML = `<div class="container section">
    <div class="page-header"><h1 tabindex="-1">Seite nicht gefunden</h1></div>
    <p class="muted">Diese Seite existiert nicht. <a href="#/data">Zur Übersicht «Daten und Digitalisierung»</a></p>
  </div>`;
}
