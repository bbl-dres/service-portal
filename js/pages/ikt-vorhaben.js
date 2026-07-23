// IKT-Vorhaben — Überblick über die laufenden Informatik-Vorhaben des BBL.
// Demo-Inhalt: Die Vorhaben sind an real existierende Programme angelehnt
// (SUPERB, BIM/CDE, GEVER), Status und Termine sind für den Prototyp gesetzt.

const VORHABEN = [
  {
    titel: 'SUPERB — SAP S/4HANA',
    kuerzel: 'SUPERB',
    status: 'in_umsetzung',
    zeitraum: '2021–2028',
    lead: 'EFV / EFD (Programmleitung)',
    beschreibung: 'Migration der SAP-Systeme der Bundesverwaltung auf SAP S/4HANA (Ablösung der bisherigen Version ECC). Für das BBL betrifft das Beschaffung, Logistik und Immobilienbewirtschaftung.',
    href: '#/applications',
  },
  {
    titel: 'BIM und Common Data Environment',
    kuerzel: 'CDE',
    status: 'in_umsetzung',
    zeitraum: '2022–2027',
    lead: 'BBL Bau',
    beschreibung: 'Modellbasierte Planung und Übergabe von Bauprojekten mit einer gemeinsamen Datenumgebung über den Lebenszyklus.',
    href: '#/applications?bereich=bauten',
  },
  {
    titel: 'Kundenportal BBL',
    kuerzel: 'KP',
    status: 'in_umsetzung',
    zeitraum: '2025–2027',
    lead: 'Informatik BBL',
    beschreibung: 'Ein gemeinsames Portal für Dienstleistungen, Anwendungen, Daten und Vorgänge — dieses Portal.',
    href: '#/services',
  },
  {
    titel: 'Metadatenkatalog und Data Governance',
    kuerzel: 'MDK',
    status: 'in_planung',
    zeitraum: '2026–2028',
    lead: 'Informatik BBL',
    beschreibung: 'Dokumentation der Datenarchitektur, Verantwortlichkeiten und Schnittstellen als Grundlage für den Datenbezug.',
    href: '#/data/katalog',
  },
  {
    titel: 'Ablösung Dokumentenablage (GEVER)',
    kuerzel: 'GEVER',
    status: 'in_planung',
    zeitraum: '2027–2029',
    lead: 'Informatik BBL',
    beschreibung: 'Überführung der Bauwerksdokumentation in die Geschäftsverwaltung des Bundes mit Aufbewahrungs- und Archivierungsregeln.',
    href: '#/app/document-archive',
  },
  {
    titel: 'Photovoltaik-Monitoring',
    kuerzel: 'PVA-M',
    status: 'abgeschlossen',
    zeitraum: '2024–2025',
    lead: 'Nachhaltigkeit BBL',
    beschreibung: 'Anbindung der Photovoltaikanlagen an die Energiestatistik und das Datenportal.',
    href: '#/app/dataportal/energie-klima',
  },
];

const STATUS = {
  in_planung: ['In Planung', 'info'],
  in_umsetzung: ['In Umsetzung', 'warning'],
  abgeschlossen: ['Abgeschlossen', 'success'],
};

export default function render(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  setTitle('IKT-Vorhaben');
  setCrumbs([
    { label: 'Startseite', href: '#/' },
    { label: 'Daten und Digitalisierung', href: '#/data' },
    { label: 'IKT-Vorhaben' },
  ]);

  const rows = VORHABEN.map(v => ({ ...v }));

  mount.innerHTML = `
  <div class="container section">
    ${C.pageHeader({
      title: 'IKT-Vorhaben',
      lead: 'Die laufenden und geplanten Informatik-Vorhaben des BBL — was sie umfassen, wer sie führt und wann sie wirken.',
    })}
    ${C.notification('Demo-Inhalt: Die Vorhaben sind an real existierende Programme angelehnt; Status und Termine sind für den Prototyp gesetzt.', 'hint', 'InfoCircle')}
    <div class="mt-8">
      ${C.table({
        caption: 'IKT-Vorhaben des BBL',
        zebra: true,
        columns: [
          { key: 'titel', label: 'Vorhaben', render: r => `<a href="${r.href}">${C.escape(r.titel)}</a><br><span class="small muted">${C.escape(r.kuerzel)}</span>` },
          { key: 'beschreibung', label: 'Inhalt', render: r => C.escape(r.beschreibung) },
          { key: 'lead', label: 'Federführung', render: r => C.escape(r.lead) },
          { key: 'zeitraum', label: 'Zeitraum', render: r => C.escape(r.zeitraum) },
          { key: 'status', label: 'Status', render: r => C.badge(...STATUS[r.status]) },
        ],
        rows,
      })}
    </div>
  </div>`;
}
