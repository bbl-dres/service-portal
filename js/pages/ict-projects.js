// ICT projects — overview of the BBL's current IT projects.
// Demo content: projects are based on real programmes (SUPERB, BIM/CDE, GEVER),
// while status and dates are set for the prototype.

const PROJECTS = [
  {
    title: 'SUPERB — SAP S/4HANA',
    abbreviation: 'SUPERB',
    status: 'implementation',
    period: '2021–2028',
    lead: 'EFV / EFD (Programmleitung)',
    description: 'Migration der SAP-Systeme der Bundesverwaltung auf SAP S/4HANA (Ablösung der bisherigen Version ECC). Für das BBL betrifft das Beschaffung, Logistik und Immobilienbewirtschaftung.',
    href: '#/applications',
  },
  {
    title: 'BIM und Common Data Environment',
    abbreviation: 'CDE',
    status: 'implementation',
    period: '2022–2027',
    lead: 'BBL Bau',
    description: 'Modellbasierte Planung und Übergabe von Bauprojekten mit einer gemeinsamen Datenumgebung über den Lebenszyklus.',
    href: '#/applications?area=buildings',
  },
  {
    title: 'Kundenportal BBL',
    abbreviation: 'KP',
    status: 'implementation',
    period: '2025–2027',
    lead: 'Informatik BBL',
    description: 'Ein gemeinsames Portal für Dienstleistungen, Anwendungen, Daten und Vorgänge — dieses Portal.',
    href: '#/services',
  },
  {
    title: 'Metadatenkatalog und Data Governance',
    abbreviation: 'MDK',
    status: 'planning',
    period: '2026–2028',
    lead: 'Informatik BBL',
    description: 'Dokumentation der Datenarchitektur, Verantwortlichkeiten und Schnittstellen als Grundlage für den Datenbezug.',
    href: '#/data/catalog',
  },
  {
    title: 'Ablösung Dokumentenablage (GEVER)',
    abbreviation: 'GEVER',
    status: 'planning',
    period: '2027–2029',
    lead: 'Informatik BBL',
    description: 'Überführung der Bauwerksdokumentation in die Geschäftsverwaltung des Bundes mit Aufbewahrungs- und Archivierungsregeln.',
    href: '#/app/document-archive',
  },
  {
    title: 'Photovoltaik-Monitoring',
    abbreviation: 'PVA-M',
    status: 'completed',
    period: '2024–2025',
    lead: 'Nachhaltigkeit BBL',
    description: 'Anbindung der Photovoltaikanlagen an die Energiestatistik und das Datenportal.',
    href: '#/app/dataportal/energie-klima',
  },
];

const STATUS = {
  planning: ['In Planung', 'info'],
  implementation: ['In Umsetzung', 'warning'],
  completed: ['Abgeschlossen', 'success'],
};

export default function render(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  setTitle('IKT-Vorhaben');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'IKT-Vorhaben' },
  ]);

  const rows = PROJECTS;

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'IKT-Vorhaben',
      lead: 'Die laufenden und geplanten Informatik-Vorhaben des BBL — was sie umfassen, wer sie führt und wann sie wirken.',
    })}
    ${C.notification('Demo-Inhalt: Die Vorhaben sind an real existierende Programme angelehnt; Status und Termine sind für den Prototyp gesetzt.', 'hint', 'InfoCircle')}
    ${''/* mt-6, as on every sibling block after the page header; this page was
          the only mt-8 user (design review, pages). */}
    <div class="mt-6">
      ${C.table({
        caption: 'IKT-Vorhaben des BBL',
        zebra: true,
        // The first column is the row link; as in every list table, clicking
        // anywhere on the row follows it (consistent affordance, tbl-8).
        rowsClickable: true,
        columns: [
          { key: 'title', label: 'Vorhaben', render: r => `<a href="${r.href}">${C.escape(r.title)}</a><br><span class="small muted">${C.escape(r.abbreviation)}</span>` },
          { key: 'description', label: 'Inhalt', render: r => C.escape(r.description) },
          { key: 'lead', label: 'Federführung', render: r => C.escape(r.lead) },
          { key: 'period', label: 'Zeitraum', render: r => C.escape(r.period) },
          { key: 'status', label: 'Status', render: r => C.badge(...(STATUS[r.status] || [r.status, 'gray'])) },
        ],
        rows,
      })}
    </div>
  </div>`;

  // Table row clicks. Clean up through onUnmount so the reused mount does not
  // accumulate another click listener on every visit.
  ctx.onUnmount(C.wireTableRows(mount));
}
