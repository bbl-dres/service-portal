// Inhalt von «Wissen und Hilfsmittel» — 113 Unterlagen in 22 Abschnitten,
// gegliedert nach Fachgebiet (L2) und darin nach Materialart (L3).
//
// WARUM EIN EIGENES MODUL: der Bestand hat jetzt zwei Leser. Die Seite
// (js/pages/knowledge.js) rendert ihn, die Suche (js/pages/search.js)
// indexiert ihn. Solange die Literale in der Seite lagen, war der grösste
// Inhaltsbestand des Portals unauffindbar — 113 Einträge gegenüber 108 im
// gesamten damaligen Suchindex (docs/search-review.md B1). Der Bestand bleibt
// bewusst JS statt JSON: er trägt Auszeichnung (`intro` mit Links) und eine
// Render-Funktion (`html`), und er soll KEINEN zusätzlichen Request kosten.
//
// Gliederung nach Fachgebiet, nicht nach Materialart: die Kundenplattform hat
// Hilfsmittel NIE gepoolt — Werkzeugkasten und Mustervorlagen liegen unter
// «Informatik», die BKB-Dokumente unter «Beschaffen». Material hängt am
// Fachgebiet, in dem man gerade arbeitet (docs/legacy-analysis.md).

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
        { title: 'Sicherheits- oder Datenschutzvorfall melden', desc: 'Meldung als Vorgang erfassen — die ISBO übernimmt die Bearbeitung.', href: '#/services/sicherheitsvorfall-melden', meta: ['Dienstleistung'] },
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
        { title: 'Erste Schritte im Kundenportal', desc: 'Überblick über Dienstleistungen, Anwendungen, Dokumente und Daten.', meta: ['PDF', 'Anleitung'] },
        { title: 'Einen Vorgang starten und verfolgen', desc: 'Wie Sie einen Service auslösen und den Status unter «Meine Vorgänge» einsehen.', meta: ['PDF', 'Anleitung'] },
        { title: 'Gebäude und Dokumente finden', desc: 'Suche im Portfolio sowie im Dokumenten- und Medienarchiv.', meta: ['PDF', 'Anleitung'] },
        { title: 'Unterlagen und Vorlagen finden', desc: 'Wie «Wissen und Hilfsmittel» nach Fachgebiet gegliedert ist.', meta: ['PDF', 'Anleitung'] },
      ] },
      { id: 'schulung', title: 'Schulungsunterlagen und Lernvideos', intro: 'Material für Einführung und Vertiefung.', items: [
        { title: 'Einführung ins Kundenportal', desc: 'Geführter Rundgang durch die wichtigsten Funktionen.', meta: ['Video', '8 Min'] },
        { title: 'Schulung Vorgangsbearbeitung', desc: 'Foliensatz zur Erfassung und Verfolgung von Vorgängen.', meta: ['PDF', '2.1 MB'] },
        { title: 'Webinar: Dienstleistungen des BBL', desc: 'Aufzeichnung des Einführungswebinars für neue Verwaltungseinheiten.', meta: ['Video', '45 Min'] },
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

export const FAQS = [
  { q: 'Wie melde ich zusätzlichen Raumbedarf an?', a: 'Öffnen Sie unter «Dienstleistungen» den Service «Raumbedarf melden» und folgen Sie dem geführten Antrag. Nach dem Absenden entsteht ein Vorgang, den Sie unter «Meine Vorgänge» verfolgen.' },
  { q: 'Welche Weisung gilt für die Flächenstandards?', a: 'Massgebend ist die Weisung «Neue Arbeitswelten (NAW)» unter «Unterbringung und Objektbetrieb».' },
  { q: 'Wo finde ich die Vertragsvorlagen für eine IT-Beschaffung?', a: 'Unter «Informatik und IKT-Beschaffung» im Abschnitt «Mustervorlagen für IKT-Beschaffungen».' },
  { q: 'Wie melde ich einen Sicherheits- oder Datenschutzvorfall?', a: 'Nutzen Sie den Service «Sicherheitsvorfall melden». Grundlagen sind das Informationssicherheitsgesetz (ISG) und das Datenschutzmerkblatt (DSG).' },
  { q: 'An wen wende ich mich bei Rückfragen zu einem Vorgang?', a: 'Verwenden Sie die Referenznummer (Format BBL-JJJJ-XXXX) aus der Detailansicht Ihres Vorgangs für Rückfragen.' },
];

// Die DOM-id eines Abschnitts. Ein Präfix, weil die ids sonst mit generischen
// Ankern der Seite kollidieren könnten («preise» kommt zweimal vor, in zwei
// Fachgebieten — innerhalb einer Seite bleibt sie eindeutig).
export const sectionDomId = (id) => 'wi-' + id;

// Flacher Index für die Suche: eine Zeile je Unterlage, plus je eine Zeile für
// den Abschnitt selbst und für jede FAQ-Frage.
//
// Das Ziel ist IMMER der Abschnitt, nie die Datei: die Unterlagen sind im
// Prototyp Platzhalter ohne echte URL (`href: '#'` in der Seite). Ein Treffer
// bringt die Nutzerin also an die Stelle, wo die Unterlage steht — mit ihrem
// fachlichen Umfeld. Bei externen Zielen (Fedlex, BKB) führt der Treffer direkt
// dorthin, weil es dort etwas zu holen gibt.
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
          // Externe Quellen (Erlasse, BKB) sind direkt erreichbar und deshalb das
          // bessere Ziel als der Abschnitt, in dem sie aufgelistet sind.
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
