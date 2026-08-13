// Knowledge-and-resources content: 117 resources in 27 sections across seven
// subject areas (L2), grouped by material type within each (L3).
//
// WHY A SEPARATE MODULE: this content now has two consumers. The page
// (js/pages/knowledge.js) renders it, while search (js/pages/search.js) indexes
// it. While literals lived in the page, the portal's largest content collection
// was unfindable: 113 entries compared with 108 in the entire search index at
// the time (docs/search-review.md B1). It deliberately remains JS rather than
// JSON because it carries markup (`intro` with links) and a render function
// (`html`), and should cost NO additional request.
//
// Group by subject, not material type: the customer platform NEVER pooled tools.
// Toolkits and templates sit under «Informatik», while BKB documents sit under
// «Beschaffen». Material belongs to the subject currently being worked on
// (docs/legacy-analysis.md).

export const AREAS = {
  it: {
    title: 'Informatik und IKT-Beschaffung',
    lead: 'Vorgaben, Mustervorlagen und Werkzeuge für Beschaffungen im Informatikbereich — der umfangreichste Bestand des Portals.',
    intro: 'Für Beschaffungen ausserhalb der Informatik gelten die Unterlagen unter <a href="#/knowledge/procurement">Beschaffung</a>.',
    sections: [
      { id: 'vorgaben', title: 'Vorgaben', intro: 'Verbindliche Vorgaben des Bundes für Informatik und Informationssicherheit.', items: [
        { title: 'IKT-Vorgaben der Bundesverwaltung (DTI)', desc: 'Vorgabensammlung der Bundeskanzlei — Architektur, Sicherheit, Projektführung.', href: 'https://intranet.dti.bk.admin.ch', external: true, meta: ['dti.bk.admin.ch'] },
        { title: 'Informatiksicherheitsvorgaben Bund', desc: 'Vorgaben des NCSC zur Informatiksicherheit.', href: 'https://www.ncsc.admin.ch', external: true, meta: ['ncsc.admin.ch'] },
        { title: 'Mustervertragsklausel der BKB betreffend Cyberrisiken', desc: 'Standardklausel für Verträge mit IKT-Bezug.', href: 'https://www.sepos.admin.ch', external: true, meta: ['sepos.admin.ch'] },
        { title: 'Sicherheits-/Datenschutzvorfall melden', desc: 'Meldung als Vorgang erfassen — die ISBO übernimmt die Bearbeitung.', href: '#/services/sicherheitsvorfall-melden', meta: ['Dienstleistung'] },
      ] },
      { id: 'mustervorlagen', title: 'Mustervorlagen für IKT-Beschaffungen', intro: 'Komplette Vorlagen-Sets für IT-Ausschreibungen (Pflichtenheft, Kriterienkatalog, Vertrag) sowie die einzelnen Vertragsvorlagen für Informatik-Leistungen.', items: [
        { title: 'IT Dienstleistungen Einzelzuschlag', desc: 'Vollständiges Vorlagen-Set für eine Ausschreibung mit Einzelzuschlag.', meta: ['ZIP', '3.4 MB'] },
        { title: 'IT-Dienstleistungen Mehrfachzuschlag', desc: 'Vorlagen-Set für Ausschreibungen mit mehreren Zuschlagsempfängern.', meta: ['ZIP', '3.6 MB'] },
        { title: 'Standardsoftware', desc: 'Vorlagen-Set für die Beschaffung von Standardsoftware.', meta: ['ZIP', '2.9 MB'] },
        { title: 'Individualentwicklung', desc: 'Vorlagen-Set für Vorhaben mit individueller Softwareentwicklung.', meta: ['ZIP', '3.1 MB'] },
        { title: '1 Vertrag IT DL (Auftrag)', desc: 'Vertrag für Informatik-Dienstleistungen.', meta: ['DOCX', '182 kB'] },
        { title: '2 Einzelvertrag IT DL (Auftrag)', desc: 'Einzelvertrag unter einem bestehenden Rahmenvertrag.', meta: ['DOCX', '168 kB'] },
        { title: '3 Rahmenvertrag Leistungen im IT Bereich', desc: 'Mehrjähriger Rahmenvertrag mit Abrufmechanismus.', meta: ['DOCX', '214 kB'] },
        { title: '4 Werkvertrag IT-Leistungen Individualsoftwarepflege', desc: 'Werkvertrag für Pflege und Weiterentwicklung von Individualsoftware.', meta: ['DOCX', '196 kB'] },
        { title: '5 Einzelvertrag IT-Leistungen Individualsoftwarepflege', desc: 'Abruf unter dem Werkvertrag.', meta: ['DOCX', '178 kB'] },
        { title: '6 Nachtrag zum Vertrag BBL', desc: 'Änderung oder Ergänzung eines bestehenden Vertrags.', meta: ['DOCX', '94 kB'] },
        { title: '7 Rahmenvertrag IT DL als Personalverleih', desc: 'Für Leistungen, die als Personalverleih erbracht werden.', meta: ['DOCX', '203 kB'] },
        { title: '8 Einzelvertrag IT DL als Personalverleih', desc: 'Abruf unter dem Personalverleih-Rahmenvertrag.', meta: ['DOCX', '191 kB'] },
      ] },
      { id: 'werkzeugkasten', title: 'Werkzeugkasten', intro: 'Checklisten, Wegleitungen und Entscheidungshilfen zur Beschleunigung von IKT-Beschaffungsprozessen.', items: [
        { title: 'Checkliste für die Anmeldung öffentlicher Beschaffungsvorhaben', desc: 'Prüfpunkte vor der Anmeldung eines Vorhabens.', meta: ['PDF', '210 kB'] },
        { title: 'Beschaffung-IT Marktabklärung', desc: 'Wann kommt welche Art von Marktanalyse zum Zug?', meta: ['PDF', '398 kB'] },
        { title: 'Nachhaltigkeit bei IKT-Dienstleistung', desc: 'Guideline zur Nachhaltigkeit bei IKT-Dienstleistungen.', meta: ['PDF', '512 kB'] },
        { title: 'Wegleitung Open Source in der Beschaffung', desc: 'Entscheidungshilfe für Einkäufer bei Projekten mit möglichem OSS-Bezug, inklusive Umsetzung in Ausschreibung und Vertrag.', meta: ['PDF', '486 kB'] },
        { title: 'Checkliste Integral-Ausnahme Art. 9 EMBAG', desc: 'Hilft bei der Prüfung und Dokumentation, ob im Einzelfall auf die Publikation entwickelter Software verzichtet werden kann.', meta: ['PDF', '168 kB'] },
        { title: 'Entscheidungs-Cheatsheet SEPOS Standardbestimmungen', desc: 'Welche Standardbestimmungen wann gelten.', meta: ['PDF', '244 kB'] },
        { title: 'Prüfung von Ausschluss- und Sanktionslisten', desc: 'Vorgehen bei der Prüfung, Stand September 2025.', meta: ['PDF', '186 kB'] },
        { title: 'Leistungserbringung im Ausland', desc: 'Guideline zur Leistungserbringung im Ausland.', meta: ['PDF', '294 kB'] },
        { title: 'Beschaffung-IT Varianten Dialog', desc: 'Dialog «light» — Elemente aus dem Dialogverfahren im offenen oder selektiven Verfahren.', meta: ['PDF', '221 kB'] },
        { title: 'Beschaffung-IT Zusammenarbeit & Zuständigkeiten', desc: 'Vorgehen und Rollenteilung zwischen Bedarfsstelle und Beschaffungsstelle.', meta: ['PDF', '265 kB'] },
        { title: 'Funktion BeschaffungskoordinatorIn', desc: 'Aufgaben und Abgrenzung der Rolle.', meta: ['PDF', '142 kB'] },
        { title: 'Zusammenarbeiten via HBB (Acta Nova)', desc: 'Zusammenarbeit im harmonisierten Beschaffungsprozess.', meta: ['PDF', '318 kB'] },
        { title: 'Beschaffung-IT Deblockierung', desc: 'Vorgehen zur raschen Deblockierung von Geschäften (gelbe und rote Karte).', meta: ['PDF', '203 kB'] },
        { title: 'Beschaffung-IT Planungstool für WTO', desc: 'Terminplanung für WTO-Verfahren.', meta: ['XLSX', '48 kB'] },
        { title: 'Beschaffung-IT Planungstool für Freihänder', desc: 'Terminplanung für freihändige Verfahren.', meta: ['XLSX', '45 kB'] },
        { title: 'Kickoff Folien und Protokoll', desc: 'Vorlage für den Projekt-Kickoff.', meta: ['PPTX', '1.0 MB'] },
      ] },
      { id: 'bedarfsmeldung', title: 'Bedarfsmeldung und HBB-Prozess', intro: 'Formulare und Kurzhilfen für die Anmeldung eines IKT-Bedarfs.', items: [
        { title: 'HBB QuickHelp – Wie starte ich eine Beschaffung', desc: 'Kurzhilfe für Bedarfsstellen mit Acta Nova.', meta: ['PDF', '412 kB'] },
        { title: 'HBB QuickHelp – Was wird mit HBB gemacht', desc: 'Umfang und Abgrenzung des harmonisierten Beschaffungsprozesses.', meta: ['PDF', '386 kB'] },
        { title: 'Bedarfsmeldung Software', desc: 'Für Bedarfsstellen ohne Acta Nova.', meta: ['DOCX', '84 kB'] },
        { title: 'Bedarfsmeldung Hardware', desc: 'Für Bedarfsstellen ohne Acta Nova.', meta: ['DOCX', '82 kB'] },
        { title: 'Bedarfsmeldung Dienstleistung', desc: 'Für Bedarfsstellen ohne Acta Nova.', meta: ['DOCX', '86 kB'] },
        { title: 'Anmeldung überschwellige Beschaffung', desc: 'Anmeldung ab dem massgebenden Schwellenwert.', meta: ['DOCX', '91 kB'] },
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
      { id: 'grundlagen', title: 'Gesetzliche Grundlagen', intro: 'Erlasse, auf denen das Beschaffungswesen des Bundes beruht — sie gehen allen weiteren Vorgaben vor. Die Fassungen stehen auf Fedlex.', items: [
        { title: 'Bundesgesetz über das öffentliche Beschaffungswesen (BöB)', desc: 'SR 172.056.1', href: 'https://www.fedlex.admin.ch/eli/cc/2020/126/de', external: true, meta: ['fedlex.admin.ch'] },
        { title: 'Verordnung über das öffentliche Beschaffungswesen (VöB)', desc: 'SR 172.056.11 — Verordnung vom 12. Februar 2020.', href: 'https://www.fedlex.admin.ch/eli/cc/2020/127/de', external: true, meta: ['fedlex.admin.ch'] },
        { title: 'Verordnung über die Organisation des öffentlichen Beschaffungswesens (Org-VöB)', desc: 'SR 172.056.15 — Zuständigkeiten und Delegationen.', href: 'https://www.fedlex.admin.ch/eli/cc/2024/224/de', external: true, meta: ['fedlex.admin.ch'] },
        { title: 'Regierungs- und Verwaltungsorganisationsverordnung (RVOV)', desc: 'SR 172.010.1 — Verordnung vom 25. November 1998.', href: 'https://www.fedlex.admin.ch/eli/cc/1999/170/de', external: true, meta: ['fedlex.admin.ch'] },
        { title: 'Weisung Harmonisierte Beschaffungsprozesse', desc: 'Der HBB-Prozess, mit den Anhängen A1 und A2.', meta: ['PDF', '1.2 MB', 'Weisung BBL'] },
        { title: 'Rechtsgrundlagen der BKB', desc: 'Die vollständige Sammlung der Rechtsgrundlagen zum Beschaffungswesen.', href: 'https://www.bkb.admin.ch/', external: true, meta: ['bkb.admin.ch'] },
      ] },
      { id: 'bkb', title: 'Dokumente der BKB', intro: 'Verbindliche Formulare und Hilfsmittel der Beschaffungskonferenz des Bundes. Die BKB führt die vollständige Sammlung auf ihrer eigenen Plattform — hier steht, was im Alltag am häufigsten gebraucht wird.', items: [
        { title: 'Beschaffungskonferenz des Bundes (BKB)', desc: 'Die Plattform der BKB mit allen Vorgaben, Hilfsmitteln, Merkblättern und Vertragsbedingungen des Bundes.', href: 'https://www.bkb.admin.ch/', external: true, meta: ['bkb.admin.ch'] },
        { title: 'Allgemeine Geschäftsbedingungen des Bundes', desc: 'AGB für Dienstleistungs- und Lieferaufträge.', href: 'https://www.bkb.admin.ch/de/agb-des-bundes', external: true, meta: ['bkb.admin.ch'] },
        { title: 'Formular Bankgarantie', desc: 'Sicherstellung durch Bankgarantie.', meta: ['PDF', '148 kB'] },
        { title: 'Formular Bürgschaft', desc: 'Sicherstellung durch Bürgschaft.', meta: ['PDF', '142 kB'] },
        { title: 'Unbefangenheitserklärung', desc: 'Erklärung der an einem Vergabeverfahren beteiligten Personen.', meta: ['PDF', '96 kB'] },
        { title: 'Formular Abfrage Sanktionsliste', desc: 'Abfrage vor Zuschlagserteilung.', meta: ['PDF', '88 kB'] },
        { title: 'Formular Meldung sanktionierte Anbieterin', desc: 'Meldung an die zuständige Stelle.', meta: ['PDF', '91 kB'] },
        { title: 'Vorlage Verfügung Auftragssperre', desc: 'Verfügung bei Ausschluss einer Anbieterin.', meta: ['DOCX', '104 kB'] },
        { title: 'Merkblatt Sanktionsverfügung und Sanktionsliste', desc: 'Ablauf und Zuständigkeiten.', meta: ['PDF', '167 kB'] },
        { title: 'Handbuch AVB Forschungsaufträge', desc: 'Allgemeine Vertragsbedingungen für Forschungsaufträge.', meta: ['PDF', '1.4 MB'] },
        { title: 'Merkblatt Übersetzungen', desc: 'Vorgehen bei mehrsprachigen Ausschreibungsunterlagen.', meta: ['PDF', '132 kB'] },
      ] },
      { id: 'gesuche', title: 'Gesuche und Delegationen', intro: 'Anträge, mit denen eine Beschaffung an die Bedarfsstelle delegiert wird. Das ausgefüllte Gesuch geht ans BBL; nach Gutheissung entsteht eine Delegationsvereinbarung.', items: [
        { title: 'Gesuch unterschwellige Delegation (Dienstleistungen)', desc: 'Antrag auf Delegation einer Beschaffung an die Bedarfsstelle.', meta: ['DOCX', '67 kB'] },
        { title: 'Gesuch Projektdelegation', desc: 'Antrag auf Projektdelegation nach Org-VöB.', meta: ['DOCX', '66 kB'] },
      ] },
      { id: 'controlling', title: 'Beschaffungscontrolling', intro: 'Vorgaben und Auswertungen zum Beschaffungscontrolling der Bundesverwaltung.', items: [
        { title: 'Weisungen über das Beschaffungscontrolling', desc: 'Gültig ab 1. Januar 2025, mit Anhängen zu Kategorien und Vergabeverfahren.', meta: ['PDF', '453 kB', 'Weisung BBL'] },
        { title: 'Beschaffungszahlungen Bundesverwaltung', desc: 'Reporting-Set der BKB.', href: 'https://www.bkb.admin.ch', external: true, meta: ['bkb.admin.ch'] },
        { title: 'Auswertungen im Datenportal', desc: 'Verträge und Bestellungen nach Departement als Dashboard.', href: '#/app/dataportal', meta: ['Datenportal'] },
      ] },
    ],
  },

  // The Multispace standard is the one subject area whose SUBSTANCE, not just its
  // document list, belongs in the portal: the handbook is 149 pages, the eleven
  // modules are the vocabulary every other Workspace surface already speaks
  // (data/workspace-planning.json carries the same eleven `equipmentGroups`, and
  // the Plan-Editor reports them per object), and nobody reads a 149-page PDF to
  // learn what «Modul 6.2» means. Figures come from the curated chapter 5 of
  // docs/workspace-management-requirements.md, which reconciles the handbook's
  // overview against its detail pages; prices are deliberately absent because the
  // handbook marks them confidential.
  workspace: {
    title: 'Arbeitsplätze gestalten',
    lead: 'Der Ausstattungsstandard «Multispace» des BBL — die Module für die Büroflächen der Bundesverwaltung, von der Arbeitsstilanalyse bis zur Planübernahme.',
    intro: 'Die rechtlichen Grundlagen — VILB, Weisungen und Standards für Büroarbeitsplätze — stehen unter <a href="#/knowledge/accommodation">Unterbringung und Objektbetrieb</a>. Geplant und geprüft wird im <a href="#/app/floorplan-editor">Plan-Editor</a> und in der <a href="#/app/plan-check">Planprüfung</a>.',
    sections: [
      { id: 'standard', branch: 'multispace', title: 'Die Multispace-Module', intro: 'Jedes Modul bildet eine funktionale und gestalterische Einheit. Module lassen sich kombinieren; ein Mix einzelner Modulelemente wird ausdrücklich nicht empfohlen. Die Flächenrichtmasse sind Planungswerte aus der Modulübersicht des Handbuchs.', html: (C) => moduleList(C) },
      { id: 'einrichtung', branch: 'multispace', title: 'Einrichtungsrichtlinien', intro: 'Räumliche Regeln aus dem Handbuch — sie entscheiden über die Qualität einer Fläche mehr als die Möbelwahl.', html: (C) => guidelineList(C) },
      { id: 'farbe', branch: 'multispace', title: 'Farbkonzept und Materialien', html: (C) => `
        <p>Das Farbkonzept leitet sich aus «Polychromie Architecturale» ab, dem 1931 von Le Corbusier entwickelten Farbsystem mit 43 Farben. Aus einer Serie von Volltonfarben ergeben sich abgestufte Aufhellungen; die Abstufungen der Rottöne der Schweizer Fahne dienen als Grundton der Farbwelten.</p>
        <p><strong>Die Farben des Mobiliars sind verbindlich und standardisiert und können nicht angepasst werden.</strong> Das BBL folgt damit dem Bundesratsauftrag zur Standardisierung und ermöglicht eine nachhaltige Kreislaufwirtschaft.</p>
        <p>Die Farben für Wände und Böden sind integraler Bestandteil der Module. Pro Modul stehen vier Wandfarben zur freien Auswahl. Weisse Wände sind ausdrücklich nicht im Sinn des Konzepts. Gibt es nachvollziehbare Gründe, vom Farbkonzept für Wände und Böden abzuweichen, ist dem BBL ein alternatives Farbkonzept zur Freigabe vorzulegen.</p>` },
      { id: 'planungsschritte', branch: 'multispace', title: 'Von der Analyse zur Belegung', intro: 'Drei Begriffe des Zielbilds, die nicht austauschbar sind, und die vier Schritte, die das Handbuch der Gestaltung einer Büroumgebung voranstellt.', html: (C) => planningSteps(C) },
      { id: 'plandaten', branch: 'multispace', title: 'Plandaten und Flächennachweis', intro: 'Was ein Grundriss enthalten muss, damit er übernommen, geprüft und massstäblich ausgegeben werden kann.', html: (C) => planDataBlock(C), items: [
        { title: 'Grundriss im Plan-Editor bearbeiten', desc: 'Räume, Nutzungsarten und Multispace-Module direkt im Geschossplan pflegen.', href: '#/app/floorplan-editor', meta: ['Anwendung'] },
        { title: 'DWG-Datei prüfen lassen', desc: 'Layerstruktur, Raumpolygone, Raumstempel und Bemassung lokal im Browser gegen die CAD-Vorgaben prüfen.', href: '#/app/plan-check', meta: ['Anwendung'] },
        { title: 'Grundriss prüfen', desc: 'Die Dienstleistung mit Beschrieb, Voraussetzungen und Ablauf.', href: '#/services/plan-pruefen', meta: ['Dienstleistung'] },
      ] },
      { id: 'beschaffung', branch: 'kreislauf', title: 'Beschaffung, Lieferung und Kreislauf', intro: 'Die standardisierte Raumausstattung wird in einem Kreislaufmodell bewirtschaftet. Das bestimmt, womit geplant wird und was mit ausgedientem Mobiliar geschieht.', html: (C) => `
        <ul class="wsm-rules">
          <li>Ausstattungen werden in erster Linie mit <strong>Occasionsmobiliar</strong> geplant.</li>
          <li>Das Mobiliarportfolio ist auf einen Life Cycle von <strong>15 Jahren</strong> ausgerichtet.</li>
          <li>Die Benutzerorganisationen führen keine eigenen Lager; nicht mehr benötigtes Mobiliar wird mit einem Umzugsauftrag zurückgegeben.</li>
          <li>Für zurückgegebenes Mobiliar erfolgt keine Vergütung. Über Wiederverwendung im Kreislaufmodell oder einen Verkauf von ausgedientem Mobiliar entscheidet das BBL.</li>
          <li>Die Zuständigkeit des BBL für Reparaturen und Rückschubaufträge beschränkt sich auf die vom BBL beschafften Artikel.</li>
          <li>In der Region Bern übernimmt das BBL die Montage. Ausserhalb stellen die Dienststellen das Personal für Entgegennahme, Verteilung und Aufstellung.</li>
        </ul>
        <p class="small muted mt-4">Formulare für Transport-, Umzugs- und Rückschubaufträge stehen unter <a href="#/knowledge/accommodation?section=${sectionDomId('formulare')}">Unterbringung und Objektbetrieb</a>.</p>` },
      { id: 'unterlagen', branch: 'downloads', title: 'Zum Herunterladen', intro: 'Nach Zweck gruppiert: erst lesen, dann zeichnen, dann prüfen. Die Preise des Handbuchs sind vertraulich und deshalb nicht Teil dieser Sammlung.', html: (C) => downloadGroups(C) },
      { id: 'anwendungen', branch: 'multispace', title: 'Anwendungen und Dienstleistungen', intro: 'Wo die hier beschriebenen Vorgaben im Portal angewendet werden.', items: [
        { title: 'Workspace Management (Portal)', desc: 'Objekte, Planstände, schreibgeschützte Grundrissvorschauen und Ausstattung der Arbeitsplatzplanung.', href: '#/app/workspace', meta: ['Anwendung'] },
        { title: 'Plan-Editor', desc: 'Flächen, Räume und Multispace-Ausstattung direkt im Grundriss verwalten und planen.', href: '#/app/floorplan-editor', meta: ['Anwendung'] },
        { title: 'BBL Intranetshop', desc: 'Büromaterial und Mobiliar aus dem Standardsortiment bestellen.', href: '#/app/shop', meta: ['Anwendung'] },
        { title: 'Raumbedarf melden', desc: 'Zusätzlichen Flächenbedarf, Umnutzungen oder bauliche Anpassungen anmelden.', href: '#/services/raumbedarf-melden', meta: ['Dienstleistung'] },
        { title: 'Umzug, Transport und Entsorgung', desc: 'Umzüge und Transporte innerhalb der gemieteten Lokalitäten beauftragen.', href: '#/services/umzug-anmelden', meta: ['Dienstleistung'] },
      ] },
    ],
  },

  accommodation: {
    title: 'Unterbringung und Objektbetrieb',
    lead: 'Flächenstandards, Weisungen zum Immobilienportfolio sowie Preise und Formulare rund um den Gebäudebetrieb.',
    sections: [
      { id: 'standards', title: 'Standards und Weisungen', intro: 'Vorgaben zur wirtschaftlichen Nutzung und zum Betrieb der Bauten im BBL-Immobilienportfolio.', items: [
        { title: 'Verordnung über das Immobilienmanagement und die Logistik des Bundes (VILB)', desc: 'SR 172.010.21 — Verordnung vom 5. Dezember 2008; Aufgaben und Zuständigkeiten von BBL und Benutzerorganisationen.', href: 'https://fedlex.data.admin.ch/eli/cc/2008/857', external: true, meta: ['fedlex.admin.ch'] },
        { title: 'Weisungen über die wirtschaftliche Nutzung und den Betrieb der Bauten im BBL Immobilienportfolio', desc: 'Grundlagenweisung für das BBL-Immobilienportfolio.', meta: ['PDF', '232 kB', 'Weisung BBL'] },
        { title: 'Anhang I — Standards für Büroarbeitsplätze', desc: 'Zu den Weisungen über die wirtschaftliche Nutzung und den Betrieb der Bauten im BBL-Immobilienportfolio.', meta: ['PDF', '1.0 MB'] },
        { title: 'Anhang II — Standards für Büroarbeitsplätze', desc: 'Bau 201d, wirtschaftliche Nutzung von Bundesbauten.', meta: ['PDF', '437 kB'] },
        { title: 'Konzept für die Einführung kollektiver Arbeitsplätze (Desksharing)', desc: 'Für die Bundesverwaltung.', meta: ['PDF', '1.7 MB'] },
        { title: 'Unterbringungskonzept flexible Arbeitsformen', desc: 'Für die zivile Bundesverwaltung.', meta: ['PDF', '485 kB'] },
        { title: 'Vermietungs- und Betriebskonzept für Verpflegungsräume', desc: 'In der Bundesverwaltung.', meta: ['PDF', '1.5 MB'] },
      ] },
      { id: 'nachhaltigkeit', title: 'Nachhaltigkeit', intro: 'Vorgaben und Empfehlungen zum nachhaltigen Immobilienmanagement und Bauen.', items: [
        { title: 'Weisungen nachhaltiges Immobilienmanagement', desc: 'Weisungen des EFD, umgesetzt über die KBOB.', meta: ['PDF', '160 kB'] },
        { title: 'KBOB-Empfehlung Standard Nachhaltiges Bauen Schweiz SNBS', desc: 'Zertifizierungspflicht und Zielwerte.', meta: ['PDF', '4.9 MB'] },
        { title: 'Cockpit nachhaltiges Immobilienmanagement der KBOB', desc: 'Kennzahlen und Zielerreichung.', href: 'https://www.kbob.admin.ch', external: true, meta: ['kbob.admin.ch'] },
        { title: 'Empfehlungen der KBOB zum nachhaltigen Bauen', desc: 'Die Empfehlungssammlung der KBOB.', href: 'https://www.kbob.admin.ch', external: true, meta: ['kbob.admin.ch'] },
        { title: 'Netzwerk Nachhaltiges Bauen Schweiz (NNBS)', desc: 'Trägerorganisation des SNBS.', href: 'https://www.nnbs.ch', external: true, meta: ['nnbs.ch'] },
      ] },
      { id: 'preise', title: 'Preise und Leistungsverrechnung', intro: 'Verrechnungsgrundlagen im Leistungsbereich Unterbringung und Objektbetrieb.', items: [
        { title: 'Preisliste Leistungsbereich Unterbringung', desc: 'Verrechnungspreise im Leistungsbereich Unterbringung.', meta: ['PDF', '26 kB'] },
        { title: 'Produktebeschreibung «Nebenkosten»', desc: 'Umfang und Verrechnung der Nebenkosten.', meta: ['PDF', '107 kB'] },
        { title: 'Produktebeschreibung Zusatzdienstleistungen', desc: 'Zusätzlich bestellbare Leistungen im Objektbetrieb.', meta: ['PDF', '97 kB'] },
        { title: 'Produktebeschreibung Nutzerspezifische Dienstleistungen', desc: 'Nutzerspezifisch vereinbarte Leistungen.', meta: ['PDF', '114 kB'] },
        { title: 'Leistungsbeschreibung Betreibervereinbarung', desc: 'Umfang der Betreiberleistungen.', meta: ['PDF', '133 kB'] },
      ] },
      { id: 'formulare', title: 'Formulare', intro: 'Auftragsformulare rund um Umzüge, Transporte und Dekorationen.', items: [
        { title: 'K7P90 F1d Transport- und Umzugsauftrag', desc: 'Auftrag für Umzüge und Transporte innerhalb der gemieteten Lokalitäten.', meta: ['PDF', '1.0 MB'] },
        { title: 'K7P90 C2 Checkliste Umzüge', desc: 'Vorbereitung, Durchführung und Abschluss eines Umzugs.', meta: ['ZIP', '50 kB'] },
        { title: 'K7P90 C1d Leitfaden Transporte und Umzüge', desc: 'Ablauf und Zuständigkeiten.', meta: ['PDF', '3.3 MB'] },
        { title: 'K3P901F1 Bestellformular für Mobiliarschlüssel', desc: 'Schliessungen und Ersatzschlüssel für Büromobiliar.', meta: ['PDF', '288 kB'] },
        { title: 'Bestellformular für Dekorationen', desc: 'Blumen- und Pflanzendekorationen über die Bundesgärtnerei.', meta: ['PDF', '204 kB'] },
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
        { title: 'Vorlage und Musteradressen', desc: 'Adressformate für den Massenversand.', meta: ['XLSX', '86 kB'] },
        { title: 'Output Design Auftrag', desc: 'Gestaltung von Ausgabedokumenten.', meta: ['PDF', '1.5 MB'] },
        { title: 'Layout Auftrag', desc: 'Layoutarbeiten durch die Produktion.', meta: ['PDF', '1.4 MB'] },
        { title: 'Publikationsauftrag', desc: 'Auftrag an die Warengruppe Publikationen.', meta: ['PDF', '726 kB'] },
        { title: 'Agenturleistung / Elektronische Publikationen', desc: 'Formular für Agenturleistungen und elektronische Publikationen.', meta: ['PDF', '756 kB'] },
      ] },
      { id: 'preise', title: 'Preise und Katalog', intro: 'Produkte und Preise der Produktion.', items: [
        { title: 'Produktekatalog Produktion', desc: 'Vollständiger Katalog der Produkte und Dienstleistungen.', meta: ['PDF', '5.7 MB'] },
        { title: 'Preisliste Dienstleistungen Produktion', desc: 'Preise für Druck-, Versand- und Datendienstleistungen.', meta: ['PDF', '91 kB'] },
        { title: 'Technischer Beschrieb', desc: 'Technische Anforderungen für Publikationsaufträge.', meta: ['PDF', '134 kB'] },
      ] },
      { id: 'merkblaetter', title: 'Merkblätter und Faktenblätter', intro: 'Hinweise zu Sonderfällen und Zusatzleistungen.', items: [
        { title: 'Informationsblatt Warengruppe Publikationen', desc: 'Leistungen und Zuständigkeiten der zentralen Beschaffungsstelle für Publikationen.', meta: ['PDF', '285 kB'] },
        { title: 'Faktenblatt Zustellplattform', desc: 'Elektronische Zustellung von Dokumenten.', meta: ['PDF', '123 kB'] },
        { title: 'Flyer Zustellplattform', desc: 'Kurzübersicht zur Zustellplattform.', meta: ['PDF', '2.1 MB'] },
        { title: 'Faktenblatt Interaktive Kundenkorrespondenz', desc: 'Individualisierte Korrespondenz aus Fachanwendungen.', meta: ['PDF', '281 kB'] },
      ] },
    ],
  },

  // No more cross-cutting catch-all: it was a leftovers box beside subject
  // areas and therefore redundant. The few cross-cutting statutes and standards
  // now sit where they are applied (security/CD/DTI under IT, energy/climate
  // under accommodation). What remains genuinely belongs to no subject: guidance
  // for the portal itself.
  guides: {
    title: 'Anleitungen und Schulungen',
    lead: 'Kurzanleitungen, Schulungsunterlagen und Lernvideos zur Nutzung des Kundenportals und seiner Dienstleistungen.',
    intro: 'Fachliche Unterlagen — Vorgaben, Vorlagen, Formulare — finden Sie im jeweiligen Fachgebiet.',
    sections: [
      { id: 'anleitungen', title: 'Anleitungen', intro: 'Kurzanleitungen zu den häufigsten Wegen durch das Portal.', items: [
        { title: 'Erste Schritte im Kundenportal', desc: 'Überblick über Dienstleistungen, Anwendungen, Dokumente und Daten.', meta: ['PDF', 'Anleitung'] },
        { title: 'Einen Vorgang starten und verfolgen', desc: 'Wie Sie eine Dienstleistung auslösen und den Status unter «Meine Vorgänge» einsehen.', meta: ['PDF', 'Anleitung'] },
        { title: 'Gebäude und Dokumente finden', desc: 'Suche im Portfolio sowie im Dokumenten- und Medienarchiv.', meta: ['PDF', 'Anleitung'] },
        { title: 'Unterlagen und Vorlagen finden', desc: 'Wie «Wissen und Hilfsmittel» nach Fachgebiet gegliedert ist.', meta: ['PDF', 'Anleitung'] },
      ] },
      { id: 'schulung', title: 'Schulungsunterlagen und Lernvideos', intro: 'Material für Einführung und Vertiefung.', items: [
        { title: 'Einführung ins Kundenportal', desc: 'Geführter Rundgang durch die wichtigsten Funktionen.', meta: ['Video', '8 Min'] },
        { title: 'Schulung Vorgangsbearbeitung', desc: 'Foliensatz zur Erfassung und Verfolgung von Vorgängen.', meta: ['PDF', '2.1 MB'] },
        { title: 'Webinar: Dienstleistungen des BBL', desc: 'Aufzeichnung des Einführungswebinars für neue Verwaltungseinheiten.', meta: ['Video', '45 Min'] },
        { title: 'Schnellstart-Kurzreferenz', desc: 'Einseitige Übersicht der häufigsten Aufgaben und Wege.', meta: ['PDF', '480 kB'] },
      ] },
      // The FAQ moved here from the retired «Prozessdokumentation» page
      // (2026-08-13). Its questions were always about USING the portal — how do
      // I report space demand, where are the templates — which is this page's
      // subject; they sat under process documentation only because that page
      // happened to exist.
      { id: 'faq', title: 'Häufige Fragen (FAQ)', faq: true },
    ],
  },

  // The «Prozessdokumentation» area was retired on 2026-08-13. Two pages carried
  // that name in the same header: this guide and the app it linked to. Process
  // documentation now lives with the metadata catalogue under
  // the architecture signpost (#/data/architecture), and the old paths redirect
  // there (routing/routes.js).
  //
  // The external portal named here was ALSO wrong: the binding IKT-Vorgabe A736
  // prescribes Innovator for modelling and smartfacts for web publication, not
  // Archimap. The corrected reference lives on the new page, next to the
  // directory entries it explains.
};

export const FAQS = [
  { q: 'Wie melde ich zusätzlichen Raumbedarf an?', a: 'Öffnen Sie unter «Dienstleistungen» die Dienstleistung «Raumbedarf melden» und folgen Sie dem geführten Antrag. Nach dem Absenden wird ein Vorgang erstellt, den Sie unter «Meine Vorgänge» verfolgen.' },
  { q: 'Welche Weisung gilt für die Flächenstandards?', a: 'Massgebend ist die Weisung «Neue Arbeitswelten (NAW)» unter «Unterbringung und Objektbetrieb».' },
  { q: 'Wo finde ich die Vertragsvorlagen für eine IT-Beschaffung?', a: 'Unter «Informatik und IKT-Beschaffung» im Abschnitt «Mustervorlagen für IKT-Beschaffungen».' },
  { q: 'Wie melde ich einen Sicherheits- oder Datenschutzvorfall?', a: 'Nutzen Sie die Dienstleistung «Sicherheitsvorfall melden». Grundlagen sind das Informationssicherheitsgesetz (ISG) und das Datenschutzmerkblatt (DSG).' },
  { q: 'An wen wende ich mich bei Rückfragen zu einem Vorgang?', a: 'Verwenden Sie die Referenznummer (Format BBL-JJJJ-XXXX) aus der Detailansicht Ihres Vorgangs für Rückfragen.' },
];

// DOM ID for a section. A prefix avoids collisions with generic page anchors
// («preise» occurs twice in two subject areas but remains unique per page). The
// `wi-` prefix is retained as a stable deep-link compatibility literal.
/* ========================= Multispace equipment standard ==================
   The modules are the shared vocabulary of the whole Workspace suite:
   `data/workspace-planning.json` records equipment per object under module
   names, and the Plan-Editor reports them in its Ausstattungen register. Stating
   the standard here once means the app's numbers have a definition.

   THE SOURCE IS data/multispace-modules.json. This array is a synchronous copy for
   the page layer; `scripts/check-multispace-modules.mjs` proves the two still agree,
   which is what the repository has instead of a build step. The same gate covers the
   Plan-Editor's MODULE_OPTIONS, because that list and this one had drifted apart:
   «Modul 7» meant Coffee Point in the editor and something else on this page.

   EDITION MATTERS. Two editions are in circulation. This portal publishes «Stand
   6.1.2025» with ELEVEN modules, which is also what the editor's room attribute has
   always written, so no saved plan changes meaning. «Stand 31.10.2025» retires the
   Coffee Point, renames module 1 to «Standardarbeitsplatz» and moves 8–11 up to 7–10;
   the fixture records that as a delta so switching is one field plus a draft
   migration.

   Figures were read from the handbook itself and cross-checked between two
   independent text extractions; the PDF injects zero-width spaces inside
   multi-digit numbers, so single-pass extraction is not trustworthy. Prices are
   deliberately absent — the handbook marks them confidential. */
/**
 * The workspace area's sub-pages.
 *
 * The area was one page carrying eight sections, an eleven-module catalogue and a
 * document library — too much to read in one sitting, and the reason it is now a
 * drill-down branch. Sections declare which branch they belong to, so the content
 * stays in ONE list and each page filters it; five separate lists would drift.
 */
export const WORKSPACE_BRANCHES = Object.freeze([
  Object.freeze({ slug: '', key: 'overview', label: 'Übersicht',
    lead: 'Wie eine Bürofläche geplant, geprüft und übernommen wird — und wo das im Portal passiert.' }),
  Object.freeze({ slug: 'multispace', key: 'multispace', label: 'Multispace-Handbuch',
    lead: 'Der Ausstattungsstandard: die Module mit Sub-Modulen und Flächenrichtmassen, die Einrichtungsrichtlinien und das Farbkonzept.' }),
  Object.freeze({ slug: 'inspiration', key: 'inspiration', label: 'Planungsbeispiele',
    lead: 'Umgesetzte Flächen der Bundesverwaltung: je Beispiel ein ausgebauter Ort — ein Geschoss, eine Zone oder ein Raum — mit den eingesetzten Modulen, Grundrissen und Möbeln.' }),
  Object.freeze({ slug: 'kreislauf', key: 'kreislauf', label: 'Kreislaufwirtschaft und Occasionsmobiliar',
    lead: 'Die standardisierte Raumausstattung wird in einem Kreislaufmodell bewirtschaftet. Das bestimmt, womit geplant wird und was mit ausgedientem Mobiliar geschieht.' }),
  Object.freeze({ slug: 'downloads', key: 'downloads', label: 'Downloads und Vorlagen',
    lead: 'Handbuch, CAD-Bausteine, Vorlagen und Werkzeuge zum Herunterladen.' }),
]);

export const MULTISPACE_EDITION = '6.1.2025';

export const MULTISPACE_MODULES = Object.freeze([
  { nr: 1, name: 'Einzel Arbeitsplatz', variants: '—', area: '3 m²',
    desc: 'Schreibtischarbeitsplatz im offenen Raum, in Gruppen von höchstens vier Tischen. Keine zugewiesenen Plätze; der Platz wird aufgeräumt hinterlassen.' },
  { nr: 2, name: 'Team Arbeitsplatz', variants: '2.1 Team Arbeitsplatz 6 Personen, 2.2 Team Arbeitsplatz 8 Personen', area: '25 / 35 m²',
    desc: 'Gruppentisch für ein Team, das eine Aufgabe gemeinsam bearbeitet. Räumlich von anderen Arbeitsbereichen separiert, mit AV-Screen und Whiteboard. Ein Mix einzelner Modulelemente wird nicht empfohlen — das Modul ist eine funktionale und gestalterische Einheit.' },
  { nr: 3, name: 'Fokus Arbeitsplatz', variants: '—', area: '3 m²',
    desc: 'Arbeitsplatz in ruhiger Umgebung, akustisch durch eine freistehende Umbauung geschützt. Lautes Sprechen und Telefonieren sind hier nicht erlaubt.' },
  { nr: 4, name: 'Formelle Sitzungen', variants: '4.1 Sitzungsraum sitzend, 4 Personen, 4.1 Sitzungsraum sitzend, 6 Personen, 4.1 Sitzungsraum sitzend, 8 Personen, 4.2 Sitzungsraum stehend, 4.5 Besprechungsbox gross, 4.6 Besprechungsbox klein', area: '19 / 22 / 25 / 9 / 4,5 m²',
    desc: 'Geschlossene Sitzungsräume mit magnetischem Whiteboard und farbiger Wand, über das interne Buchungssystem reservierbar. Besprechungsboxen sind autarke Raum-in-Raum-Lösungen.' },
  { nr: 5, name: 'Telefon- / Videokonferenzbox', variants: '5.1 Videokonferenzbox, 5.2 Telefonbox 1er', area: '4,5 / 2 m²',
    desc: 'Raum-in-Raum-Lösung für eine Person, gleichmässig auf der Fläche verteilt. Nicht reservierbar, gehört zum Gebäude und ersetzt kein gebautes Sitzungszimmer.' },
  { nr: 6, name: 'Informelle Sitzungen', variants: '6.1 Informelle Sitzung stehend, 6.2 Besprechungskoje, 6.4 Lounge klein, 6.5 Lounge gross', area: '4 / 8 / 15 / 23 m²',
    desc: 'Schneller Austausch abseits des Arbeitsplatzes, ohne Raumbuchung. Auf offener Fläche, in einer Nische oder im geschlossenen Raum.' },
  { nr: 7, name: 'Coffee Point', variants: '—', area: '12 m²',
    desc: 'Zentraler Treffpunkt auf der Fläche für Pausen, Kaffee und den beiläufigen Austausch, der zwischen Terminen entsteht. Die Nachfolgeausgabe des Handbuchs führt den Coffee Point nicht mehr als eigenes Modul.' },
  { nr: 8, name: 'Interaktive Sitzungen', variants: '8.1 Auditorium, 8.2 Kreativraum, 8.3 Werkstatt', area: '65 / 30 m²',
    desc: 'Grosse, flexibel möblierte Räume mit multimedialer Anlage. Nach der Veranstaltung in den Ausgangszustand zurückversetzen.' },
  { nr: 9, name: 'Team Ablage', variants: '9.1 Team Ablage offen, 9.2 Team Ablage geschlossen', area: '—',
    desc: 'Ablage für Ordner, dekorative Elemente und Archivgut. Dient zugleich als raumbildendes Element zwischen Arbeitsplatzgruppen.' },
  { nr: 10, name: 'Locker, Garderoben', variants: '10.1 Locker, 10.2 Garderobe', area: '—',
    desc: 'Persönliche, abschliessbare Ablage nahe dem Eingang. Ohne zugewiesene Schreibtische werden alle persönlichen Gegenstände hier aufbewahrt.' },
  { nr: 11, name: 'Service Funktionen', variants: '—', area: '—',
    desc: 'Sammelbehälter an den Arbeitsplätzen und Entsorgungsstellen auf den Etagen, damit Reststoffe getrennt in den Stoffkreislauf zurückgeführt werden.' },
]);

// Spatial rules from the handbook. They are design constraints, not decoration:
// each one decides whether a floor plan can be approved.
export const MULTISPACE_GUIDELINES = Object.freeze([
  'Einzelarbeitsplätze immer entlang der Fassade und rechtwinklig zum Tageslicht, damit keine Reflexion auf dem Bildschirm entsteht.',
  'Arbeitsplatzgruppen umfassen höchstens vier Tische; grössere Teams werden über mehrere Gruppen verteilt.',
  'Telefon- und Besprechungsboxen gleichmässig auf der Fläche verteilen und nie in Fluchtwegen aufstellen.',
  'Boxen dürfen sicherheitsrelevante Installationen weder verdecken noch behindern — Sprinkler, Brandmelder, Notausgänge, Fluchtwegkennzeichen, Sicherheitsbeleuchtung, Löschgeräte sowie Rauch- und Wärmeabzugsöffnungen.',
  'Der Zugang für Wartung und Unterhalt an gebäudetechnischen Anlagen, Leitungssystemen und Wartungsöffnungen in Boden, Wand und Decke bleibt frei.',
  'Locker und Garderoben stehen nahe beim Eingang.',
  'Die Team Ablage ist immer vom Korridor zugänglich, nie hinter dem Arbeitsplatz.',
  'Ein Auditorium wird nur einmal pro Gebäude eingerichtet.',
  'Die SECO-Richtlinien zu Abständen, Verkehrsflächen und Fluchtwegen sind einzuhalten.',
]);

// The three planning terms are defined in the Zielbild and are NOT
// interchangeable; the portal keeps them apart because each has a different
// owner and a different system.
export const WORKSPACE_TERMS = Object.freeze([
  { term: 'Raumplanung', gloss: 'Strategische Planung der Raumstruktur im Gebäude.' },
  { term: 'Unterbringungsplanung', gloss: 'Zuordnung einer Organisationseinheit zu einem Gebäude oder Gebäudeteil, auf Basis der Raumplanung.' },
  { term: 'Belegungsplanung', gloss: 'Operative Zuweisung von Arbeitsräumen oder Arbeitsplätzen an Mitarbeitende oder Gruppen.' },
]);

// The handbook's four preparatory steps before a layout is drawn.
export const WORKSPACE_STEPS = Object.freeze([
  { title: 'Arbeitsstilanalyse', desc: 'Wie arbeitet die Organisationseinheit heute — allein, im Team, mobil, im Sitzungszimmer?' },
  { title: 'Spezifische Bedürfnisse der Organisationseinheit', desc: 'Aufgaben, Arbeitsweisen und Grad der Digitalisierung unterscheiden sich stark und bestimmen den Modulmix.' },
  { title: 'Erhebung der Multispace Module', desc: 'Welche Module in welcher Anzahl gebraucht werden, abgeleitet aus Analyse und Bedürfnissen.' },
  { title: 'Adaption der Multispace Module auf die Fläche', desc: 'Layout und Belegung — die Module werden auf dem konkreten Geschoss platziert.' },
]);

/**
/**
 * The modules as a navigable list, followed by the summary table.
 *
 * The table alone could not answer «what is in module 4?», which is the question the
 * handbook is opened for; each row now leads to the module's own page. The table stays,
 * because reading the area guide values DOWN a column is how a floor gets planned.
 */
/**
 * Downloads, grouped by the moment they are needed.
 *
 * Every entry is a placeholder in this prototype: `href: '#'` renders as a disabled
 * download item, which is the honest state for a file the portal does not host yet.
 * The CAD plugin is described as planned rather than shown as available.
 */
export const WORKSPACE_DOWNLOAD_GROUPS = Object.freeze([
  Object.freeze({
    title: 'Standard und Vorgaben',
    intro: 'Was gilt. Vor dem Planen zu lesen.',
    items: Object.freeze([
      Object.freeze({ title: 'Handbuch Multispace — Neue Arbeitswelten (NAW)',
        desc: 'Der vollständige Ausstattungsstandard: Farbkonzept, Materialisierung, die Module mit Charakteristik, Umsetzungsrichtlinien und Elementlisten.',
        meta: Object.freeze(['PDF', 'Handbuch', 'Stand 6.1.2025']) }),
      Object.freeze({ title: 'Zielbild «Serviceportal & Workspacemanagement»',
        desc: 'Systemgrenze, Prämissen und strategische Anforderungen des Workspace Managements. Version 1.0, freigegeben am 30.10.2024.',
        meta: Object.freeze(['PDF', 'Zielbild']) }),
      Object.freeze({ title: 'Anforderungen PDF-Druck «Flächennachweis SIA 416»',
        desc: 'Vorgaben an Papierformate, Massstäbe, Plankopf und Legende der grafischen Planausgabe.',
        meta: Object.freeze(['PDF', 'Anforderungen']) }),
    ]),
  }),
  Object.freeze({
    title: 'CAD-Bausteine',
    intro: 'Womit gezeichnet wird. Die Blöcke tragen die Layer- und Attributkonvention, auf der die Planübernahme beruht.',
    items: Object.freeze([
      Object.freeze({ title: 'BBL Module — CAD-Blöcke',
        desc: 'Die Multispace-Module als Zeichnungsblöcke, je Modul ein Repräsentant mit den Möbeln als Attribute.',
        meta: Object.freeze(['DWG', 'CAD-Bibliothek']) }),
      Object.freeze({ title: 'Vorlagezeichnung CAFM-Plan',
        desc: 'Layerstruktur, Raumpolygone und Raumstempel als leere Ausgangszeichnung.',
        meta: Object.freeze(['DWG', 'Vorlage']) }),
      Object.freeze({ title: 'Handout BBL Möbelkatalog',
        desc: 'Die CAD-Block-Konvention erklärt: Modul, Repräsentant, Möbel mit Layer und Attributen.',
        meta: Object.freeze(['DOCX', 'Handout']) }),
    ]),
  }),
  Object.freeze({
    title: 'Werkzeuge für AutoCAD und Revit',
    intro: 'Geplant, noch nicht verfügbar. Das Plug-in soll die Prüfung, die heute im Browser läuft, in die Zeichenumgebung holen und den Planstand mit dem Portal abgleichen.',
    items: Object.freeze([
      Object.freeze({ title: 'BBL Plan-Check — Plug-in für AutoCAD',
        desc: 'Layerstruktur, Raumpolygone, Raumstempel und Bemassung direkt in der Zeichnung gegen die CAD-Vorgaben prüfen, ohne Datei-Upload.',
        meta: Object.freeze(['In Vorbereitung', 'Plug-in']) }),
      Object.freeze({ title: 'BBL Plan-Sync — Plan-Editor-Abgleich',
        desc: 'Den geprüften Planstand aus AutoCAD oder Revit in das Portal übernehmen und Änderungen aus dem Portal zurückholen.',
        meta: Object.freeze(['In Vorbereitung', 'Plug-in']) }),
    ]),
  }),
  Object.freeze({
    title: 'Vorlagen für die Planung',
    intro: 'Womit der Bedarf erhoben und das Mengengerüst geführt wird.',
    items: Object.freeze([
      Object.freeze({ title: 'Mengengerüst je Geschoss',
        desc: 'Register für Module, Sub-Module und Standardmobiliar mit dem Mengengerüst von UG bis 8. OG.',
        meta: Object.freeze(['XLSX', 'Vorlage']) }),
      Object.freeze({ title: 'Arbeitsstilanalyse — Erhebungsbogen',
        desc: 'Grundlage für den Modulmix: Aufgaben, Arbeitsweisen und tatsächliche Präsenz einer Organisationseinheit.',
        meta: Object.freeze(['XLSX', 'Vorlage']) }),
    ]),
  }),
]);

function downloadGroups(C) {
  return C.accordion(WORKSPACE_DOWNLOAD_GROUPS.map((group) => ({
    title: group.title,
    meta: `<span class="small muted">${C.escape(String(group.items.length))}</span>`,
    body: `<p class="muted">${C.escape(group.intro)}</p>
      <ul class="download-items">${group.items.map((item) => C.downloadItem({
        href: '#', ...item, meta: [...item.meta], download: false, wrapLi: true,
      })).join('')}</ul>`,
  })), { id: 'wsm-downloads' });
}

function moduleList(C) {
  const items = MULTISPACE_MODULES.map((module) => `
    <a class="wsm-catalogue__item" href="#/knowledge/workspace/multispace/modul-${module.nr}">
      <span class="wsm-catalogue__nr">${C.escape(String(module.nr))}</span>
      <span class="wsm-catalogue__body">
        <strong>${C.escape(module.name)}</strong>
        <small>${C.escape(module.desc)}</small>
      </span>
      ${C.icon('ChevronRight', 'icon--sm')}
    </a>`).join('');
  return `<nav class="wsm-catalogue" aria-label="Module">${items}</nav>
    <h3 class="mt-6">Flächenrichtmasse im Überblick</h3>
    ${moduleTable(C)}`;
}

function moduleTable(C) {
  return `${C.table({
    caption: 'Die Multispace-Module mit Sub-Modulen und Flächenrichtmass',
    zebra: true,
    columns: [
      // The characteristic sits under the name rather than in a fourth column:
      // four columns overflow the anchor-navigation content width, and a module
      // is read as one thing, not as a name and a separate sentence.
      { key: 'nr', label: 'Modul',
        render: (m) => `<span class="wsm-module__nr">${m.nr}</span>${C.escape(m.name)}`
          + `<span class="wsm-module__desc">${C.escape(m.desc)}</span>` },
      { key: 'variants', label: 'Sub-Module', width: '15rem', render: (m) => C.escape(m.variants) },
      { key: 'area', label: 'Flächenrichtmass', width: '11rem',
        render: (m) => `<span class="wsm-module__area">${C.escape(m.area)}</span>` },
    ],
    rows: MULTISPACE_MODULES,
  })}
  <p class="small muted mt-4">Die Flächenrichtmasse sind Planungswerte aus der Modulübersicht des Handbuchs. Einzelne Detailseiten weichen davon ab; verbindlich ist das Handbuch.</p>
  ${C.notification(`Diese Übersicht folgt der Ausgabe vom ${MULTISPACE_EDITION}. Gegenüber der Ausgabe vom 6.1.2025 heisst Modul 1 neu «Standardarbeitsplatz», der Coffee Point ist kein eigenes Modul mehr, und die früheren Module 8 bis 11 sind zu 7 bis 10 aufgerückt. Ältere Pläne und Ausstattungslisten können deshalb eine andere Nummerierung tragen.`, 'info', 'InfoCircle')}`;
}

function guidelineList(C) {
  return `<ul class="wsm-rules">${
    MULTISPACE_GUIDELINES.map((rule) => `<li>${C.escape(rule)}</li>`).join('')}</ul>`;
}

function planningSteps(C) {
  return `<h3 class="wsm-subhead">Drei Planungsebenen</h3>
    <dl class="kv kv--ruled">${WORKSPACE_TERMS.map((t) => `
      <dt>${C.escape(t.term)}</dt><dd>${C.escape(t.gloss)}</dd>`).join('')}
    </dl>
    <h3 class="wsm-subhead">Vier Schritte vor dem Layout</h3>
    <ol class="wsm-steps">${WORKSPACE_STEPS.map((s) => `
      <li><strong>${C.escape(s.title)}</strong><span class="muted">${C.escape(s.desc)}</span></li>`).join('')}
    </ol>
    <p class="small muted mt-4">Für die Umsetzung empfiehlt das Handbuch die Beauftragung eines externen Changemanagements nach dem FlexWork-Change-Konzept.</p>`;
}

function planDataBlock(C) {
  return `<p>Grundrisse werden als binäre DWG-Datei übernommen. Geprüft werden Layerstruktur, Raumpolygone, Raumstempel (AOID), Beschriftung und Bemassung — die <a href="#/app/plan-check">Planprüfung</a> führt diese Prüfung lokal im Browser aus und erstellt einen Prüfbericht.</p>
    <p>Der grafische Report für die Flächenausgabe heisst <strong>Flächennachweis SIA 416</strong>. Er dient als Beilage zu Verkaufsdokumentationen und zu Verträgen mit Dritten und wird in den Formaten A4 und A3 quer oder hoch gedruckt, wahlweise als gesamter Grundriss oder als Ausschnitt in einem festen Massstab von 1:100 bis 1:1500. Über alle Geschosse eines Gebäudes gilt derselbe Massstab.</p>`;
}

export const sectionDomId = (id) => 'wi-' + id;

// Flat search index: one row per resource, plus one for the section itself and
// each FAQ question.
//
// The target is ALWAYS the section, never the file: resources are placeholders
// without real URLs in the prototype (`href: '#'` on the page). A result takes
// the user to where the resource appears, with its domain context. External
// targets (Fedlex, BKB) link directly because they provide a real resource.
export function knowledgeIndex() {
  const out = [];
  for (const [key, area] of Object.entries(AREAS)) {
    const areaHref = `#/knowledge/${key}`;
    for (const s of area.sections) {
      const sectionHref = `${areaHref}?section=${sectionDomId(s.id)}`;
      out.push({
        title: s.title, desc: s.intro || area.lead, href: sectionHref,
        extra: [area.title, 'Wissen Hilfsmittel Unterlagen'].join(' '),
        area: area.title, sectionTitle: s.title,
      });
      for (const it of s.items || []) {
        out.push({
          title: it.title, desc: it.desc || '',
          // External sources (statutes, BKB) are directly available and therefore
          // a better target than the section where they are listed.
          href: it.external && it.href ? it.href : (it.href && it.href.startsWith('#/') ? it.href : sectionHref),
          external: !!it.external,
          extra: [area.title, s.title, ...(it.meta || [])].join(' '),
          area: area.title, sectionTitle: s.title,
        });
      }
      if (s.faq) {
        for (const f of FAQS) {
          out.push({
            title: f.q, desc: f.a, href: sectionHref,
            extra: [area.title, s.title, 'FAQ häufige Fragen'].join(' '),
            area: area.title, sectionTitle: s.title,
          });
        }
      }
    }
  }
  return out;
}
