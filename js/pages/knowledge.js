import { anchorNavPage } from './anchor-nav.js';

// Wissen und Hilfsmittel — die Referenzschicht des Portals.
//
// GEGLIEDERT NACH FACHGEBIET (L2), innerhalb dessen nach Materialart (L3).
// Nicht umgekehrt. Begründung aus dem Altbestand (docs/legacy-analysis.md):
// die Kundenplattform hat Hilfsmittel NIE gepoolt — der Werkzeugkasten und die
// Mustervorlagen liegen unter «Informatik», die BKB-Dokumente unter «Beschaffen».
// Material hängt am Fachgebiet, in dem man gerade arbeitet. Und der Bedarf ist
// stark konzentriert: von 91 Referenzdokumenten entfallen 40 auf Informatik und
// Beschaffung. Wer Möbel bestellt, kommt nie hierher — er braucht eine
// Dienstleistung, kein Hilfsmittel.
//
// L3 sind Abschnitte INNERHALB der Fachgebietsseite, keine eigenen Routen: es
// sind Facetten einer Sammlung, und das CD-Ankernavigations-Layout
// (detailPageAnchorNav) trägt sie mit klebendem Inhaltsverzeichnis. Eigene
// Routen ergäben Seiten mit drei Dokumenten.
//
// Alle Seiten sind BEWUSST statisch: Dokumentenverzeichnisse zum Nachlesen und
// Herunterladen, keine abfragbaren Bestände (docs/sitemap.md §2.4).

const AREAS = {
  it: {
    title: 'Informatik und IKT-Beschaffung',
    lead: 'Vorgaben, Mustervorlagen und Werkzeuge für Beschaffungen im Informatikbereich — der umfangreichste Bestand des Portals.',
    intro: 'Für Beschaffungen ausserhalb der Informatik gelten die Unterlagen unter <a href="#/knowledge/procurement">Beschaffung</a>.',
    sections: [
      { id: 'vorgaben', title: 'Vorgaben', intro: 'Verbindliche Vorgaben des Bundes für Informatik und Informationssicherheit.', items: [
        { title: 'IKT-Vorgaben der Bundesverwaltung (DTI)', desc: 'Vorgabensammlung der Bundeskanzlei — Architektur, Sicherheit, Projektführung.', href: 'https://intranet.dti.bk.admin.ch', external: true, meta: ['dti.bk.admin.ch'] },
        { title: 'Informatiksicherheitsvorgaben Bund', desc: 'Vorgaben des NCSC zur Informatiksicherheit.', href: 'https://www.ncsc.admin.ch', external: true, meta: ['ncsc.admin.ch'] },
        { title: 'Mustervertragsklausel der BKB betreffend Cyberrisiken', desc: 'Standardklausel für Verträge mit IKT-Bezug.', href: 'https://www.sepos.admin.ch', external: true, meta: ['sepos.admin.ch'] },
        { title: 'Weisung IKT-Beschaffung und Bedarfsmeldung (BANF)', desc: 'Ablauf der Bedarfsmeldung und Zuständigkeiten im BBL.', href: '#', meta: ['PDF', '640 kB', 'Weisung BBL'] },
        { title: 'Corporate Design der Bundesverwaltung (CD Bund)', desc: 'Verbindliche Gestaltungsvorgaben für digitale Auftritte.', href: '#', meta: ['PDF', '4.2 MB'] },
        { title: 'P028 — Barrierefreiheit von Internetangeboten', desc: 'Anforderungen an die Zugänglichkeit digitaler Angebote (WCAG 2.1 AA).', href: '#', meta: ['PDF', '1.1 MB'] },
      ] },
      { id: 'sicherheit', title: 'Informationssicherheit und Datenschutz', intro: 'Erlasse und Weisungen zum Umgang mit klassifizierten Informationen und Personendaten.', items: [
        { title: 'Informationssicherheitsgesetz (ISG)', desc: 'SR 128 — Klassifizierung und Schutz von Informationen.', href: 'https://www.fedlex.admin.ch', external: true, meta: ['fedlex.admin.ch'] },
        { title: 'Datenschutzgesetz (DSG) — Merkblatt BBL', desc: 'Umgang mit Personendaten im BBL.', href: '#', meta: ['PDF', '310 kB'] },
        { title: 'Weisung Informationssicherheit BBL', desc: 'Umsetzung im BBL, Meldewege, Zuständigkeit ISBO.', href: '#', meta: ['PDF', '820 kB', 'Weisung BBL'] },
        { title: 'Sicherheits- oder Datenschutzvorfall melden', desc: 'Meldung als Vorgang erfassen — die ISBO übernimmt die Bearbeitung.', href: '#/services/sicherheitsvorfall-melden', meta: ['Dienstleistung'] },
      ] },
      { id: 'mustervorlagen', title: 'Mustervorlagen für IKT-Beschaffungen', intro: 'Komplette Vorlagen-Sets für IT-Ausschreibungen sowie die einzelnen Vertragsvorlagen.', items: [
        { title: 'Vorlagen-Set IT-Dienstleistungen (Einzelzuschlag)', desc: 'Pflichtenheft, Kriterienkatalog, Vertrag und Bewertungsraster für eine Ausschreibung mit Einzelzuschlag.', meta: ['ZIP', '3.4 MB'] },
        { title: 'Vorlagen-Set IT-Dienstleistungen (Mehrfachzuschlag)', desc: 'Vollständiges Set für Ausschreibungen mit mehreren Zuschlagsempfängern.', meta: ['ZIP', '3.6 MB'] },
        { title: 'Vorlagen-Set Standardsoftware', desc: 'Beschaffung von Standardsoftware inklusive Wartung und Support.', meta: ['ZIP', '2.9 MB'] },
        { title: 'Vorlagen-Set Individualentwicklung', desc: 'Für Vorhaben mit individueller Softwareentwicklung.', meta: ['ZIP', '3.1 MB'] },
        { title: 'Vertrag IT-Dienstleistungen (Auftrag)', desc: 'Einzelvertrag für Informatik-Dienstleistungen nach BöB/VöB.', meta: ['DOCX', '182 kB'] },
        { title: 'Rahmenvertrag Leistungen im IT-Bereich', desc: 'Mehrjähriger Rahmenvertrag mit Abrufmechanismus.', meta: ['DOCX', '214 kB'] },
        { title: 'Werkvertrag IT-Leistungen Individualsoftwarepflege', desc: 'Werkvertrag für Pflege und Weiterentwicklung von Individualsoftware.', meta: ['DOCX', '196 kB'] },
        { title: 'Rahmenvertrag IT-Dienstleistungen als Personalverleih', desc: 'Für Leistungen, die als Personalverleih erbracht werden.', meta: ['DOCX', '203 kB'] },
      ] },
      { id: 'werkzeugkasten', title: 'Werkzeugkasten', intro: 'Checklisten, Wegleitungen und Entscheidungshilfen zur Beschleunigung von IKT-Beschaffungsprozessen.', items: [
        { title: 'Checkliste Integral-Ausnahme Art. 9 EMBAG', desc: 'Prüfung der Ausnahme nach Art. 9 EMBAG.', meta: ['PDF', '168 kB'] },
        { title: 'Wegleitung Open Source in der Beschaffung', desc: 'Vorgehen bei Open-Source-Komponenten und -Lizenzen.', meta: ['PDF', '486 kB'] },
        { title: 'Nachhaltigkeit bei IKT-Dienstleistungen', desc: 'Nachhaltigkeitskriterien für IKT-Beschaffungen.', meta: ['PDF', '512 kB'] },
        { title: 'Marktabklärungen — welche Analyse wann?', desc: 'Auswahl der passenden Form der Marktabklärung.', meta: ['PDF', '398 kB'] },
        { title: 'Entscheidungs-Cheatsheet SEPOS Standardbestimmungen', desc: 'Welche Standardbestimmungen wann gelten.', meta: ['PDF', '244 kB'] },
        { title: 'Planungstools für WTO und Freihänder', desc: 'Terminplanung für offene und freihändige Verfahren.', meta: ['XLSX', '318 kB'] },
      ] },
      { id: 'rahmenvertraege', title: 'Rahmenverträge', intro: 'Zentral bewirtschaftete Rahmenverträge, die ohne eigenes Verfahren abgerufen werden können.', items: [
        { title: 'IT-Rahmenverträge BBL Informatik', desc: 'Übersicht der zentral bewirtschafteten Rahmenverträge mit Abrufbedingungen.', meta: ['PDF', '410 kB'] },
      ] },
    ],
  },

  procurement: {
    title: 'Beschaffung',
    lead: 'Rechtsgrundlagen, Dokumente der Beschaffungskonferenz des Bundes (BKB) und Gesuche rund um Vergaben.',
    intro: 'Für Beschaffungen im Informatikbereich gelten zusätzlich die Unterlagen unter <a href="#/knowledge/it">Informatik und IKT-Beschaffung</a>.',
    sections: [
      { id: 'grundlagen', title: 'Gesetzliche Grundlagen', intro: 'Erlasse, auf denen das Beschaffungswesen des Bundes beruht — sie gehen allen weiteren Vorgaben vor.', items: [
        { title: 'Bundesgesetz über das öffentliche Beschaffungswesen (BöB)', desc: 'SR 172.056.1', href: 'https://www.fedlex.admin.ch', external: true, meta: ['fedlex.admin.ch'] },
        { title: 'Verordnung über das öffentliche Beschaffungswesen (VöB)', desc: 'SR 172.056.11', href: 'https://www.fedlex.admin.ch', external: true, meta: ['fedlex.admin.ch'] },
        { title: 'Verordnung über die Organisation des öffentlichen Beschaffungswesens (Org-VöB)', desc: 'SR 172.056.15 — Zuständigkeiten und Delegationen.', href: 'https://www.fedlex.admin.ch', external: true, meta: ['fedlex.admin.ch'] },
        { title: 'Weisung WTO-Verfahren und Schwellenwerte', desc: 'Verfahrenswahl, Fristen, Publikationspflichten.', href: '#', meta: ['PDF', '890 kB', 'Weisung BBL'] },
        { title: 'Weisung Harmonisierte Beschaffungsprozesse', desc: 'Der HBB-Prozess und seine Anhänge A1 und A2.', href: '#', meta: ['PDF', '1.2 MB', 'Weisung BBL'] },
      ] },
      { id: 'bkb', title: 'Dokumente der BKB', intro: 'Verbindliche Formulare und Hilfsmittel der Beschaffungskonferenz des Bundes.', items: [
        { title: 'Allgemeine Geschäftsbedingungen des Bundes', desc: 'AGB für Dienstleistungs- und Lieferaufträge.', href: 'https://www.bkb.admin.ch/de/agb-des-bundes', external: true, meta: ['bkb.admin.ch'] },
        { title: 'Formular Bankgarantie', desc: 'Sicherstellung durch Bankgarantie.', meta: ['PDF', '148 kB'] },
        { title: 'Formular Bürgschaft', desc: 'Sicherstellung durch Bürgschaft.', meta: ['PDF', '142 kB'] },
        { title: 'Unbefangenheitserklärung', desc: 'Erklärung der an einem Vergabeverfahren beteiligten Personen.', meta: ['PDF', '96 kB'] },
        { title: 'Formular Abfrage Sanktionsliste', desc: 'Abfrage vor Zuschlagserteilung.', meta: ['PDF', '88 kB'] },
        { title: 'Formular Meldung sanktionierte Anbieterin', desc: 'Meldung an die zuständige Stelle.', meta: ['PDF', '91 kB'] },
        { title: 'Handbuch AVB Forschungsaufträge', desc: 'Allgemeine Vertragsbedingungen für Forschungsaufträge.', meta: ['PDF', '1.4 MB'] },
      ] },
      { id: 'gesuche', title: 'Gesuche und Delegationen', intro: 'Anträge, mit denen eine Beschaffung an die Bedarfsstelle delegiert wird.', items: [
        { title: 'Gesuch unterschwellige Delegation (Dienstleistungen)', desc: 'Antrag auf Delegation einer Beschaffung an die Bedarfsstelle.', meta: ['DOCX', '67 kB'] },
        { title: 'Gesuch Projektdelegation', desc: 'Antrag auf Projektdelegation nach Org-VöB.', meta: ['DOCX', '66 kB'] },
        { title: 'Checkliste für die Anmeldung öffentlicher Beschaffungsvorhaben', desc: 'Prüfpunkte vor der Anmeldung eines Vorhabens.', meta: ['PDF', '210 kB'] },
        { title: 'Nachtrag zum Vertrag BBL', desc: 'Änderung oder Ergänzung eines bestehenden Vertrags.', meta: ['DOCX', '94 kB'] },
      ] },
      { id: 'controlling', title: 'Beschaffungscontrolling', intro: 'Vorgaben und Auswertungen zum Beschaffungscontrolling der Bundesverwaltung.', items: [
        { title: 'Weisungen über das Beschaffungscontrolling', desc: 'Gültig ab 1. Januar 2025, mit Anhängen zu Kategorien und Vergabeverfahren.', meta: ['PDF', '453 kB', 'Weisung BBL'] },
        { title: 'Beschaffungszahlungen Bundesverwaltung', desc: 'Reporting-Set der BKB.', href: 'https://www.bkb.admin.ch', external: true, meta: ['bkb.admin.ch'] },
        { title: 'Auswertungen im Datenportal', desc: 'Verträge und Bestellungen nach Departement als Dashboard.', href: '#/app/dataportal', meta: ['Datenportal'] },
      ] },
    ],
  },

  accommodation: {
    title: 'Unterbringung und Objektbetrieb',
    lead: 'Flächenstandards, Weisungen zum Immobilienportfolio sowie Preise und Formulare rund um den Gebäudebetrieb.',
    sections: [
      { id: 'standards', title: 'Standards und Weisungen', intro: 'Vorgaben zur wirtschaftlichen Nutzung und zum Betrieb der Bauten im BBL-Immobilienportfolio.', items: [
        { title: 'Verordnung über das Immobilienmanagement und die Logistik des Bundes (VILB)', desc: 'SR 172.010.21 — Aufgaben und Zuständigkeiten von BBL und Benutzerorganisationen.', href: 'https://www.fedlex.admin.ch', external: true, meta: ['fedlex.admin.ch'] },
        { title: 'Weisungen über die wirtschaftliche Nutzung und den Betrieb der Bauten', desc: 'Grundlagenweisung für das BBL-Immobilienportfolio.', meta: ['PDF', '232 kB', 'Weisung BBL'] },
        { title: 'Weisung Neue Arbeitswelten (NAW)', desc: 'Flächenstandards, Desk-Sharing-Faktor, Raumtypen.', meta: ['PDF', '1.5 MB', 'Weisung BBL'] },
        { title: 'Konzept Desksharing für die Bundesverwaltung', desc: 'Einführung kollektiver Arbeitsplätze.', meta: ['PDF', '1.7 MB'] },
        { title: 'Unterbringungskonzept flexible Arbeitsformen', desc: 'Für die zivile Bundesverwaltung.', meta: ['PDF', '485 kB'] },
      ] },
      { id: 'nachhaltigkeit', title: 'Nachhaltigkeit', intro: 'Vorgaben und Empfehlungen zum nachhaltigen Immobilienmanagement und Bauen.', items: [
        { title: 'Weisungen des EFD zum nachhaltigen Immobilienmanagement', desc: 'Verbindliche Vorgaben der KBOB.', href: 'https://www.kbob.admin.ch', external: true, meta: ['kbob.admin.ch'] },
        { title: 'KBOB-Empfehlung Standard Nachhaltiges Bauen Schweiz (SNBS)', desc: 'Zertifizierungspflicht und Zielwerte.', meta: ['PDF', '4.9 MB'] },
        { title: 'Cockpit nachhaltiges Immobilienmanagement', desc: 'Kennzahlen und Zielerreichung der KBOB.', href: 'https://www.kbob.admin.ch', external: true, meta: ['kbob.admin.ch'] },
        { title: 'Energiegesetz (EnG) — Vorbildfunktion des Bundes', desc: 'Art. 45b und 46a EnG.', href: 'https://www.fedlex.admin.ch', external: true, meta: ['fedlex.admin.ch'] },
        { title: 'Klima- und Innovationsgesetz (KlG)', desc: 'Netto-Null-Ziel der zentralen Bundesverwaltung, Art. 10.', href: 'https://www.fedlex.admin.ch', external: true, meta: ['fedlex.admin.ch'] },
      ] },
      { id: 'preise', title: 'Preise und Leistungsverrechnung', intro: 'Verrechnungsgrundlagen im Leistungsbereich Unterbringung und Objektbetrieb.', items: [
        { title: 'Preisliste Leistungsbereich Unterbringung', desc: 'Verrechnungspreise im Leistungsbereich Unterbringung.', meta: ['PDF', '26 kB'] },
        { title: 'Produktebeschreibung «Nebenkosten»', desc: 'Umfang und Verrechnung der Nebenkosten.', meta: ['PDF', '107 kB'] },
        { title: 'Produktebeschreibung Zusatzdienstleistungen', desc: 'Zusätzlich bestellbare Leistungen im Objektbetrieb.', meta: ['PDF', '97 kB'] },
        { title: 'Leistungsbeschreibung Betreibervereinbarung', desc: 'Umfang der Betreiberleistungen.', meta: ['PDF', '133 kB'] },
      ] },
      { id: 'formulare', title: 'Formulare', intro: 'Auftragsformulare rund um Umzüge und Transporte.', items: [
        { title: 'Transport- und Umzugsauftrag', desc: 'Auftrag für Umzüge und Transporte innerhalb der gemieteten Lokalitäten.', meta: ['PDF', '1.0 MB'] },
        { title: 'Checkliste Umzüge', desc: 'Vorbereitung, Durchführung und Abschluss eines Umzugs.', meta: ['ZIP', '50 kB'] },
        { title: 'Leitfaden Transporte und Umzüge', desc: 'Ablauf und Zuständigkeiten.', meta: ['PDF', '3.3 MB'] },
      ] },
    ],
  },

  publishing: {
    title: 'Publikationen, Druck und Versand',
    lead: 'Auftragsformulare, Preise und Merkblätter der Produktion und der Warengruppe Publikationen.',
    sections: [
      { id: 'auftraege', title: 'Aufträge und Formulare', intro: 'Die Produktion nimmt Aufträge über diese Formulare entgegen.', items: [
        { title: 'Digitaldruckauftrag', desc: 'Auftragsformular der Produktion für Digitaldruck.', meta: ['PDF', '2.5 MB'] },
        { title: 'Versandauftrag', desc: 'Auftragsformular für Kuvertierung und Massenversand.', meta: ['PDF', '2.6 MB'] },
        { title: 'Publikationsauftrag', desc: 'Auftrag an die Warengruppe Publikationen.', meta: ['PDF', '726 kB'] },
        { title: 'Output-Design- und Layout-Auftrag', desc: 'Gestaltungsaufträge an die Produktion.', meta: ['PDF', '1.5 MB'] },
      ] },
      { id: 'preise', title: 'Preise und Katalog', intro: 'Produkte und Preise der Produktion.', items: [
        { title: 'Produktekatalog Produktion', desc: 'Vollständiger Katalog der Produkte und Dienstleistungen.', meta: ['PDF', '5.7 MB'] },
        { title: 'Preisliste Dienstleistungen Produktion', desc: 'Preise für Druck-, Versand- und Datendienstleistungen.', meta: ['PDF', '91 kB'] },
      ] },
      { id: 'merkblaetter', title: 'Merkblätter', intro: 'Hinweise zu Sonderfällen und Zusatzleistungen.', items: [
        { title: 'Merkblatt Übersetzungen', desc: 'Vorgehen bei mehrsprachigen Publikationen.', meta: ['PDF', '132 kB'] },
        { title: 'Faktenblatt Zustellplattform', desc: 'Elektronische Zustellung von Dokumenten.', meta: ['PDF', '123 kB'] },
        { title: 'Faktenblatt Interaktive Kundenkorrespondenz', desc: 'Individualisierte Korrespondenz aus Fachanwendungen.', meta: ['PDF', '281 kB'] },
      ] },
    ],
  },

  // Kein Sammelbecken «Übergreifendes» mehr: das war eine Restekiste neben den
  // Fachgebieten und damit redundant. Die wenigen fachgebietslosen Erlasse und
  // Vorgaben stehen jetzt dort, wo sie angewandt werden (Sicherheit/CD/DTI unter
  // Informatik, Energie/Klima unter Unterbringung). Übrig bleibt, was wirklich
  // keinem Fachgebiet gehört: die Anleitung zum Portal selbst.
  guides: {
    title: 'Anleitungen und Schulungen',
    lead: 'Kurzanleitungen, Schulungsunterlagen und Lernvideos zur Nutzung des Kundenportals und seiner Dienstleistungen.',
    intro: 'Fachliche Unterlagen — Vorgaben, Vorlagen, Formulare — finden Sie im jeweiligen Fachgebiet.',
    sections: [
      { id: 'anleitungen', title: 'Anleitungen', intro: 'Kurzanleitungen zu den häufigsten Wegen durch das Portal.', items: [
        { title: 'Erste Schritte im Kundenportal', desc: 'Überblick über Dienstleistungen, Anwendungen, Dokumente und Daten.', icon: 'Book', meta: ['Anleitung'] },
        { title: 'Einen Vorgang starten und verfolgen', desc: 'Wie Sie einen Service auslösen und den Status unter «Meine Vorgänge» einsehen.', icon: 'Book', meta: ['Anleitung'] },
        { title: 'Gebäude und Dokumente finden', desc: 'Suche im Portfolio sowie im Dokumenten- und Medienarchiv.', icon: 'Book', meta: ['Anleitung'] },
        { title: 'Unterlagen und Vorlagen finden', desc: 'Wie «Wissen und Hilfsmittel» nach Fachgebiet gegliedert ist.', icon: 'Book', meta: ['Anleitung'] },
      ] },
      { id: 'schulung', title: 'Schulungsunterlagen und Lernvideos', intro: 'Material für Einführung und Vertiefung.', items: [
        { title: 'Einführung ins Kundenportal', desc: 'Geführter Rundgang durch die wichtigsten Funktionen.', icon: 'Desktop', meta: ['Video', '8 Min'] },
        { title: 'Schulung Vorgangsbearbeitung', desc: 'Foliensatz zur Erfassung und Verfolgung von Vorgängen.', meta: ['PDF', '2.1 MB'] },
        { title: 'Webinar: Dienstleistungen des BBL', desc: 'Aufzeichnung des Einführungswebinars für neue Verwaltungseinheiten.', icon: 'Desktop', meta: ['Video', '45 Min'] },
        { title: 'Schnellstart-Kurzreferenz', desc: 'Einseitige Übersicht der häufigsten Aufgaben und Wege.', meta: ['PDF', '480 kB'] },
      ] },
    ],
  },

  // Prozessdokumentation steht als eigener Eintrag im Menü: sie ist kein
  // Fachgebiet, sondern die Ablaufbeschreibung QUER über alle — und wird
  // entsprechend anders gesucht («wie läuft das ab?»), nicht als Unterlage.
  processes: {
    title: 'Prozessdokumentation',
    lead: 'Die Prozesslandschaft des BBL im Prozessportal Archimap sowie häufige Fragen zur Zusammenarbeit.',
    intro: 'Viele Anliegen können Sie direkt unter <a href="#/services">Dienstleistungen</a> als Vorgang starten.',
    sections: [
      { id: 'portal', title: 'Prozessportal', html: (C) => `
        <p>Die vollständige Prozesslandschaft des BBL — Abläufe, Rollen und Zuständigkeiten — wird im Prozessportal Archimap gepflegt.</p>
        <div class="row mt-4">
          <a class="btn btn--outline btn--lg" href="https://prozesse-archimap.admin.ch" target="_blank" rel="noopener external">Zum Prozessportal (Archimap) ${C.icon('External', 'icon--base')}</a>
        </div>` },
      { id: 'faq', title: 'Häufige Fragen (FAQ)', faq: true },
    ],
  },
};

const FAQS = [
  { q: 'Wie melde ich zusätzlichen Raumbedarf an?', a: 'Öffnen Sie unter «Dienstleistungen» den Service «Raumbedarf melden» und folgen Sie dem geführten Antrag. Nach dem Absenden entsteht ein Vorgang, den Sie unter «Meine Vorgänge» verfolgen.' },
  { q: 'Welche Weisung gilt für die Flächenstandards?', a: 'Massgebend ist die Weisung «Neue Arbeitswelten (NAW)» unter «Unterbringung und Objektbetrieb».' },
  { q: 'Wo finde ich die Vertragsvorlagen für eine IT-Beschaffung?', a: 'Unter «Informatik und IKT-Beschaffung» im Abschnitt «Mustervorlagen für IKT-Beschaffungen».' },
  { q: 'Wie melde ich einen Sicherheits- oder Datenschutzvorfall?', a: 'Nutzen Sie den Service «Sicherheitsvorfall melden». Grundlagen sind das Informationssicherheitsgesetz (ISG) und das Datenschutzmerkblatt (DSG).' },
  { q: 'An wen wende ich mich bei Rückfragen zu einem Vorgang?', a: 'Verwenden Sie die Referenznummer (Format BBL-JJJJ-XXXX) aus der Detailansicht Ihres Vorgangs für Rückfragen.' },
];

export default async function render(ctx) {
  const area = ctx.params[0];
  if (!area) return overview(ctx);
  if (!AREAS[area]) return notFound(ctx);
  return areaPage(ctx, AREAS[area]);
}

/* ================================ ÜBERSICHT =============================== */

function overview(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  setTitle('Wissen und Hilfsmittel');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Wissen und Hilfsmittel' }]);

  const count = (k) => AREAS[k].sections.reduce((n, s) => n + s.items.length, 0);
  const areaTiles = [
    { title: AREAS.it.title, icon: 'Desktop', href: '#/knowledge/it',
      desc: 'Vorgaben, Mustervorlagen, Werkzeugkasten und Rahmenverträge für IKT-Beschaffungen.', meta: `${count('it')} Unterlagen` },
    { title: AREAS.procurement.title, icon: 'Balance', href: '#/knowledge/procurement',
      desc: 'BöB, VöB und WTO-Verfahren, Dokumente der BKB sowie Gesuche und Delegationen.', meta: `${count('procurement')} Unterlagen` },
    { title: AREAS.accommodation.title, icon: 'Building', href: '#/knowledge/accommodation',
      desc: 'Flächenstandards, Nachhaltigkeit, Preise und Formulare rund um Gebäude und Betrieb.', meta: `${count('accommodation')} Unterlagen` },
    { title: AREAS.publishing.title, icon: 'Printer', href: '#/knowledge/publishing',
      desc: 'Auftragsformulare, Preise und Merkblätter der Produktion und der Publikationen.', meta: `${count('publishing')} Unterlagen` },
    { title: AREAS.guides.title, icon: 'Book', href: '#/knowledge/guides',
      desc: 'Kurzanleitungen, Schulungsunterlagen und Lernvideos zur Nutzung des Portals.', meta: `${count('guides')} Unterlagen` },
    { title: AREAS.processes.title, icon: 'InfoCircle', href: '#/knowledge/processes',
      desc: 'Die Prozesslandschaft des BBL im Prozessportal Archimap sowie häufige Fragen (FAQ).',
      meta: 'Prozessportal & FAQ' },
  ].map(C.domainTile).join('');

  mount.innerHTML = `
    ${C.pageSection({
      body: C.pageHeader({
        title: 'Wissen und Hilfsmittel',
        lead: 'Die geltenden Vorgaben, Vorlagen und Formulare — gegliedert nach Fachgebiet, weil Unterlagen dort gebraucht werden, wo man gerade arbeitet.',
      }),
    })}
    ${C.pageSection({ title: 'Fachgebiete', alt: true, body: `<div class="grid grid--2">${areaTiles}</div>` })}`;
}

/* ============================== FACHGEBIETSSEITE ========================== */

// Eine Seite je Fachgebiet, innerhalb nach Materialart gegliedert (L3). Das
// klebende Inhaltsverzeichnis der Ankernavigation IST die L3-Navigation.
function areaPage(ctx, area) {
  const { C, setTitle, setCrumbs } = ctx;
  setTitle(area.title);
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Wissen und Hilfsmittel', href: '#/knowledge' }, { label: area.title }]);

  // Ein Abschnitt ist entweder eine Dokumentliste (`items`), freier Inhalt
  // (`html`) oder das FAQ-Akkordeon (`faq`) — die Prozessseite braucht alle drei
  // Formen nicht als Liste.
  const sections = area.sections.map(s => ({
    id: 'wi-' + s.id,
    title: s.title,
    html: [
      s.intro ? `<p class="muted">${C.escape(s.intro)}</p>` : '',
      typeof s.html === 'function' ? s.html(C) : (s.html || ''),
      s.items ? `<ul class="download-items">${s.items.map(it => C.downloadItem({
        icon: 'FileLines', href: '#', ...it, wrapLi: true,
      })).join('')}</ul>` : '',
      s.faq ? C.accordion(FAQS.map(f => ({ title: f.q, body: `<p style="margin:0">${C.escape(f.a)}</p>` })), { id: 'faq' }) : '',
    ].join(''),
  }));

  anchorNavPage(ctx, {
    title: area.title, lead: area.lead, intro: area.intro,
    sections,
    back: { href: '#/knowledge', label: 'Wissen und Hilfsmittel' },
  });
}

function notFound(ctx) {
  const { mount, C, setTitle, setCrumbs } = ctx;
  setTitle('Seite nicht gefunden');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Wissen und Hilfsmittel', href: '#/knowledge' }, { label: 'Nicht gefunden' }]);
  mount.innerHTML = C.notFound({ backHref: '#/knowledge', backLabel: 'Wissen und Hilfsmittel',
    title: 'Seite nicht gefunden',
    body: 'Dieses Fachgebiet existiert nicht. <a href="#/knowledge">Zur Übersicht «Wissen und Hilfsmittel»</a>' });
}
