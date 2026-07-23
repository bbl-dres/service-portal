// Aufgabenbereiche des BBL-Intranets, die im Prototyp (noch) nicht nachgebaut
// sind: sie verlinken auf die echten Seiten unter intranet.bbl.admin.ch.
// Eine Quelle für beides — die L1-Navigation (Dropdowns) und die Galerie auf
// der Startseite. Struktur und URLs stammen aus der erfassten Kundenplattform
// (docs/sitemap.md §1b, «Bestellen (E-Shop).html», «Kundenplattform BBL.mhtml»).

const BASE = 'https://intranet.bbl.admin.ch/de/';

export const INTRANET_AREAS = [
  {
    key: 'bueroausruestung',
    label: 'Büroausrüstung',
    desc: 'Büromaterial, EDV-Verbrauchsmaterial, Bürotechnik, Mobiliar und Hausdienstmaterial im E-Shop bestellen.',
    photo: '1524758631624-e2822e304c36',
    overview: BASE + 'bueroausruestung',
    children: [
      { label: 'Bestellen (E-Shop)', href: BASE + 'bestellen-e-shop' },
      { label: 'Büromaterial', href: BASE + 'bueromaterial' },
      { label: 'EDV-Verbrauchsmaterial', href: BASE + 'edv-verbrauchsmaterial' },
      { label: 'Bürotechnik', href: BASE + 'buerotechnik' },
      { label: 'Informatik-Sortiment', href: BASE + 'informatik-sortiment' },
      { label: 'Mobiliar', href: BASE + 'mobiliar' },
      { label: 'Hausdienstmaterial', href: BASE + 'hausdienstmaterial' },
    ],
  },
  {
    key: 'produktion',
    label: 'Produktion',
    desc: 'Druck-, Kopier- und Ausrüstarbeiten sowie Grossauflagen über die Produktion des BBL.',
    photo: '1503694978374-8a2fa686963a',
    overview: BASE + 'produktion',
    children: [
      { label: 'Arbeitsvorbereitung AVOR', href: BASE + 'arbeitsvorbereitung-avor' },
      { label: 'Datenbewirtschaftung / Formularentwicklung', href: BASE + 'datenbewirtschaftung-formularentwicklung' },
      { label: 'Projektberatung und Support', href: BASE + 'projektberatung-und-support' },
      { label: 'Digital Druck', href: BASE + 'digital-druck' },
      { label: 'Versenden', href: BASE + 'versenden' },
    ],
  },
  {
    key: 'publikationen',
    label: 'Publikationen',
    desc: 'Bundespublikationen, Drucksachen und Formulare für die Bundesverwaltung.',
    photo: '1481627834876-b7833e8f5570',
    overview: BASE + 'publikationen',
    children: [
      { label: 'Bundespublikationen bestellen', href: 'https://www.bundespublikationen.admin.ch/de/' },
      { label: 'Warengruppe Publikationen', href: BASE + 'warengruppe-publikationen' },
    ],
  },
  {
    key: 'informatik',
    label: 'Informatik',
    desc: 'IT-Arbeitsgeräte, Support und Informatikdienstleistungen für die Verwaltungseinheiten.',
    photo: '1522071820081-009f0129c71c',
    overview: BASE + 'informatik',
    children: [
      { label: 'Einkauf Informatik', href: BASE + 'einkauf-informatik' },
      { label: 'Bedarfsmeldung / HBB-Prozess', href: BASE + 'bedarfsmeldung-hbb-prozess' },
      { label: 'Delegationen', href: BASE + 'delegationen' },
      { label: 'Werkzeugkasten', href: BASE + 'werkzeugkasten' },
      { label: 'Mustervorlagen für IKT-Beschaffungen', href: BASE + 'mustervorlagen-fuer-ikt-beschaffungen' },
      { label: 'Zentral bewirtschaftete Rahmenverträge Informatik', href: BASE + 'zentral-bewirtschaftete-rahmenvertraege-informatik' },
    ],
  },
  {
    key: 'beschaffen',
    label: 'Beschaffen',
    desc: 'Öffentliche Beschaffung: Verfahren, Vorlagen und Unterstützung der Beschaffungsstelle des Bundes.',
    photo: '1454165804606-c3d57bc86b40',
    overview: BASE + 'beschaffen',
    children: [
      { label: 'Einstieg und Übersicht', href: BASE + 'einstieg-und-uebersicht' },
      { label: 'WTO-Verfahren', href: BASE + 'wto-verfahren' },
      { label: 'Dokumente der BKB', href: BASE + 'dokumente-der-bkb' },
      { label: 'Beschaffungscontrolling Bundesverwaltung', href: BASE + 'beschaffungscontrolling-bund' },
    ],
  },
];

// Als L1-Navigationseinträge (Dropdowns): jede Fläche öffnet einen Drawer mit
// «Übersicht» (die Intranet-Seite) und den bekannten Unterseiten — alle extern.
export function areasAsNav() {
  return INTRANET_AREAS.map(a => ({
    base: 'ext-' + a.key,
    label: a.label,
    external: true,
    children: [
      { href: a.overview, label: 'Übersicht', external: true },
      ...(a.children || []).map(c => ({ href: c.href, label: c.label, external: true })),
    ],
  }));
}

export default INTRANET_AREAS;
