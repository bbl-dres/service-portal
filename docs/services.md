# Dienstleistungsregister BBL — Golden Record

**Stand:** 29. Juli 2026 · **Status:** massgebendes Referenzregister (Golden Record)

Dieses Dokument ist die **einzige massgebende Quelle** für die Dienstleistungen der BBL-Plattform. [`data/services.json`](../data/services.json) ist die im Prototyp **umgesetzte Teilmenge** und folgt diesem Register — nicht umgekehrt. Weicht der Prototyp ab, gilt diese Tabelle.

Das Register ist aus drei Quellen zusammengeführt (die sich widersprechen — siehe [§4](#4-lücken-und-blinde-flecken)): der Kundenplattform BBL in ihren zwei Generationen, dem EFD-BBL-Personalintranet und dem bestehenden Prototyp-Katalog. Die Spalte **Reife** hält je Zeile fest, wie gut sie belegt ist, statt einheitliche Sicherheit vorzutäuschen.

Seit dem 29. Juli 2026 kommt eine vierte, härtere Quelle dazu: die **Formulare** aus den erfassten Kundenplattform-Seiten. Ein Formular ist der beste erreichbare Beleg dafür, dass eine Leistung wirklich bezogen werden kann — es benennt Auslöser, Eingaben und Empfängerstelle. [§3.1](#31-formularbelege-aus-dem-export) führt die 31 gefundenen Formulare und ihre Zuordnung; sie haben 11 Zeilen von `abgeleitet` auf `bestätigt` gehoben und 7 neue Zeilen erzwungen.

## 1. Aufnahmeregel

Eine Zeile bekommt, was **bezugsfähig** ist: Die Kundin löst etwas aus — bestellen, melden, buchen, beantragen, beauftragen — und erhält ein Ergebnis (Ware, Auftrag, Entscheid, Zugang, Beratung).

**Nicht aufgenommen** werden reine Inhalts- und Orientierungsangebote, auch wenn sie im Intranet gleichrangig neben Leistungen stehen: Standards, Dokumente der BKB, Vorlagen, Werkzeugkasten, Einkaufshilfe, Dienstleistungskatalog, Leistungsverrechnung, Objektverantwortung, Organigramm. Diese gehören in **News und Wissen** bzw. **Anwendungen** — ihre Aufnahme hätte das Register zum Seiteninventar gemacht. Drei bestehende Einträge aus `services.json` fallen dadurch heraus (siehe [§5](#5-abgleich-mit-dataservicesjson)).

## 2. Legende

**Kategorie** — die Domänenschlüssel aus [`data/reference-data.json`](../data/reference-data.json):

| | | | |
|---|---|---|---|
| **A** Bauprojekte und Projektportfolio | **B** Stammdaten und Mutationen | **U** Unterbringung | **O** Objektbetrieb |
| **C** Büroausrüstung und Arbeitsplatz | **D** Informatik und Arbeitsgeräte | **E** Beschaffung | **F** Publizieren, Drucken, Versenden |
| **G** Sicherheit und Notfall | **H** Personal und Arbeiten beim BBL | | |

**Zielgruppe** — `Verwaltungseinheit` (Kundin des BBL) · `BBL-Personal` · `beide`

**Quelle** — `KP-alt` Kundenplattform AEM (`/bbl_kp/`, erfasst) · `KP-neu` Kundenplattform Nuxt (`/de/<slug>`, via [sitemap.md §B](sitemap.md)) · `Staff` EFD-BBL-Personalintranet · `Prototyp` bereits in `services.json`

**Reife** — `bestätigt` Leistungsbeschrieb oder Umsetzung liegt vor · `abgeleitet` aus Navigationseintrag erschlossen, Leistung plausibel, Details offen · `vermutet` fachlich naheliegend, ohne Beleg in den erfassten Quellen

**✓** hinter einer Prozess- oder Formular-ID = **dieser Prozess bzw. dieses Formular existiert bereits** im Prototyp. Das heisst nicht, dass die Dienstleistung umgesetzt ist: `SVC-C-002` verweist auf den vorhandenen Bestellprozess, die Dienstleistung selbst fehlt aber noch. Ohne ✓ ist die ID ein **Platzhalter** — der Bezug ist vergeben, Prozess bzw. Formular sind noch zu entwerfen. Das Register ist damit zugleich der Backlog für das Prozess- und Formulardesign.

## 3. Register

| ID | Name | Beschreibung | Kat. | Zielgruppe | Leistungserbringer | Prozess | Formular | Quelle | Reife |
|---|---|---|---|---|---|---|---|---|---|
| SVC-A-001 | Raumbedarf und bauliche Bedürfnisse melden | Zusätzlichen Flächenbedarf, Umnutzungen oder bauliche Anpassungen anmelden. | A | Verwaltungseinheit | Portfoliomanagement BBL | PRC-RAUM ✓ | FRM-A-001 ✓ | Prototyp, KP-alt, KP-neu | bestätigt |
| SVC-A-002 | Bautendokumentation beziehen | Bauwerksdokumentationen, Grundrisse und Pläne zu einem Objekt beziehen. | A | beide | Fachstelle Daten und Anwendungen Bauten | PRC-DOK ✓ | FRM-A-002 | Prototyp, Public | bestätigt |
| SVC-A-003 | Auskunft zu einem Bauprojekt anfordern | Projektstand, Termine und Kennzahlen zu einem laufenden Bauprojekt erfragen. | A | beide | Portfoliomanagement BBL | PRC-BERAT | FRM-A-003 | KP-alt, Prototyp | abgeleitet |
| SVC-B-001 | Gebäude erfassen | Neues Gebäude mit Adresse, Objekt-ID und Grunddaten im Stammdatenbestand anlegen. | B | BBL-Personal | Portfoliomanagement BBL | PRC-MUT | FRM-B-001 | Prototyp | bestätigt |
| SVC-B-002 | Parzelle erfassen | Neue Parzelle mit Grundstücknummer, Gemeinde und Fläche anlegen. | B | BBL-Personal | Portfoliomanagement BBL | PRC-MUT | FRM-B-002 | Prototyp | bestätigt |
| SVC-B-003 | Stammdaten mutieren | Bestehende Objekt- oder Parzellenstammdaten ändern und prüfen lassen. | B | BBL-Personal | Portfoliomanagement BBL | PRC-MUT | FRM-B-003 | Prototyp | bestätigt |
| SVC-B-004 | Objekt archivieren | Gebäude oder Parzelle nach Verkauf oder Rückbau in den Archivstatus setzen. | B | BBL-Personal | Portfoliomanagement BBL | PRC-MUT | FRM-B-004 | Prototyp | bestätigt |
| SVC-U-001 | Unterbringungsbedarf anmelden | Unterbringungsbedarf einer Verwaltungseinheit anmelden und Varianten prüfen lassen. | U | Verwaltungseinheit | Portfoliomanagement BBL | PRC-UNTB | FRM-U-001 | Prototyp, KP-alt, KP-neu | bestätigt |
| SVC-U-002 | Arbeitsplatz- und Flächenzuweisung beantragen | Flächen, Zonen und Arbeitsplätze einer Verwaltungseinheit zuweisen lassen. | U | BBL-Personal | Portfoliomanagement BBL | PRC-ZUW | FRM-U-002 | Prototyp | bestätigt |
| SVC-U-003 | Zugang zur FLM Info-App beantragen | Zugriff auf die Flächenmanagement-Info-App für eine Verwaltungseinheit beantragen. | U | Verwaltungseinheit | Fachstelle Daten und Anwendungen Bauten | PRC-ZUG | FRM-U-003 | KP-alt | abgeleitet |
| SVC-U-004 | Zugang zum Mieterportal beantragen | Zugriff auf das Mieterportal für Mieterinnen und Mieter von Bundesliegenschaften beantragen. | U | Verwaltungseinheit | Portfoliomanagement BBL | PRC-ZUG | FRM-U-004 | KP-neu | abgeleitet |
| SVC-O-001 | Störungs-, Reinigungs- und Reparaturmeldung | Defekte, Reinigungs- oder Reparaturbedarf in einem Gebäude melden. | O | beide | Objektbetrieb | PRC-STOER ✓ | FRM-O-001 ✓ | Prototyp, KP-alt, KP-neu, Staff | bestätigt |
| SVC-O-002 | Kleinauftrag am Gebäude erteilen | Kleinere bauliche Anpassung ausserhalb eines Bauprojekts beauftragen. | O | Verwaltungseinheit | Objektbetrieb | PRC-STOER ✓ | FRM-O-002 | KP-alt, KP-neu | bestätigt |
| SVC-O-003 | Umzug anmelden | Internen Umzug von Personen, Arbeitsplätzen oder Mobiliar anmelden. | O | beide | Objektbetrieb | PRC-STOER ✓ | FRM-O-003 ✓ | Prototyp, KP-alt, KP-neu | bestätigt |
| SVC-O-004 | Transportauftrag erteilen | Internen Transport von Material und Mobiliar beauftragen. | O | beide | Objektbetrieb | PRC-AUFT | FRM-O-004 | KP-alt, KP-neu | bestätigt |
| SVC-O-005 | Kurierdienst BBL beauftragen | Kuriersendung zwischen Bundesstandorten beauftragen. | O | beide | Objektbetrieb | PRC-AUFT | FRM-O-005 | KP-alt, KP-neu | abgeleitet |
| SVC-O-006 | Entsorgung beauftragen | Fachgerechte Entsorgung von Mobiliar, Material und Akten beauftragen. | O | beide | Objektbetrieb | PRC-AUFT | FRM-O-006 | KP-alt, KP-neu | abgeleitet |
| SVC-O-007 | Sonderreinigung beauftragen | Reinigung ausserhalb des vereinbarten Unterhaltsrhythmus bestellen. | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-007 | KP-alt, KP-neu | abgeleitet |
| SVC-O-008 | Hauswartungsleistung anfordern | Leistung der Hauswartung ausserhalb des Standardumfangs anfordern. | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-008 | KP-alt, KP-neu | abgeleitet |
| SVC-O-009 | Wartung technische Anlage anfordern | Service, Wartung oder Störungsbehebung an einer technischen Anlage anfordern. | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-009 | KP-alt, KP-neu | abgeleitet |
| SVC-O-010 | Anlass in einem Bundesgebäude anmelden | Durchführung eines Anlasses inklusive Infrastruktur und Betreuung anmelden. | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-010 | KP-alt, KP-neu | abgeleitet |
| SVC-O-011 | Beflaggung bestellen | Beflaggung eines Gebäudes für Anlässe und Staatsbesuche bestellen (Fahnenmanagement). | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-011 | KP-alt, KP-neu | abgeleitet |
| SVC-O-012 | Blumendekoration bestellen | Blumenschmuck für Anlässe, Empfänge und Sitzungszimmer bestellen. | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-012 | KP-alt, KP-neu | bestätigt |
| SVC-O-013 | Innenbegrünung bestellen | Bepflanzung und Unterhalt der Innenbegrünung bestellen. | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-013 | KP-alt, KP-neu | bestätigt |
| SVC-O-014 | Grünflächenunterhalt beauftragen | Pflege der Aussenanlagen und Grünflächen eines Objekts beauftragen. | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-014 | KP-alt, KP-neu | abgeleitet |
| SVC-O-015 | Reklamation melden | Reklamation zu einer erbrachten BBL-Dienstleistung erfassen. | O | beide | Objektbetrieb | PRC-STOER ✓ | FRM-O-015 ✓ | Prototyp, KP-alt, KP-neu | bestätigt |
| SVC-C-001 | Büromaterial bestellen | Büromaterial ab Lager über den Online-Shop der Bundesverwaltung bestellen. | C | beide | Logistik BBL | PRC-BEST ✓ | FRM-C-001 | Prototyp, KP-alt, KP-neu | bestätigt |
| SVC-C-002 | EDV-Verbrauchsmaterial bestellen | Toner, Datenträger und weiteres EDV-Verbrauchsmaterial bestellen. | C | beide | Logistik BBL | PRC-BEST ✓ | FRM-C-002 | KP-alt, KP-neu | abgeleitet |
| SVC-C-003 | Bürotechnik bestellen | Drucker, Multifunktionsgeräte und Bürotechnik bestellen. | C | beide | Logistik BBL | PRC-BEST ✓ | FRM-C-003 | KP-alt, KP-neu | abgeleitet |
| SVC-C-004 | Mobiliar bestellen | Büromobiliar für Arbeitsplätze und Sitzungszimmer bestellen. | C | beide | Logistik BBL | PRC-BEST ✓ | FRM-C-004 | KP-alt, KP-neu | abgeleitet |
| SVC-C-005 | Hausdienstmaterial bestellen | Reinigungs- und Hausdienstmaterial ab Lager bestellen. | C | beide | Logistik BBL | PRC-BEST ✓ | FRM-C-005 | KP-alt, KP-neu | abgeleitet |
| SVC-C-006 | Informatik-Sortiment bestellen | Standardisierte Informatikartikel aus dem BBL-Sortiment bestellen. | C | beide | Logistik BBL | PRC-BEST ✓ | FRM-C-006 | KP-alt, KP-neu | abgeleitet |
| SVC-C-007 | Gratisabgabe Büromaterial beziehen | Büromaterial aus der kostenlosen Abgabe beziehen. | C | BBL-Personal | Logistik BBL | PRC-BEST ✓ | FRM-C-007 | KP-alt | abgeleitet |
| SVC-C-008 | Mobiliar als Bundesmitarbeitende kaufen | Ausgemustertes Mobiliar als Mitarbeitende oder Mitarbeitender käuflich erwerben. | C | BBL-Personal | Logistik BBL | PRC-BEST ✓ | FRM-C-008 | KP-neu | abgeleitet |
| SVC-C-009 | Zugang BBL Intranetshop (Kreis 3) beantragen | Bestellberechtigung für dezentrale Bundesstellen im Intranetshop beantragen. | C | Verwaltungseinheit | Logistik BBL | PRC-ZUG | FRM-C-009 | KP-alt | bestätigt |
| SVC-C-010 | Raum, Arbeitsplatz oder Parkplatz buchen | Sitzungsraum, flexiblen Arbeitsplatz oder Parkplatz an einem BBL-Standort reservieren. | C | beide | Workspace BBL | PRC-BUCH ✓ | FRM-C-010 ✓ | Prototyp | bestätigt |
| SVC-C-011 | Mobiliarschlüssel bestellen | Ersatzschlüssel für Büromobiliar wie Rollcontainer und Schränke bestellen. | C | beide | BBL Mobiliar und Hausdienst | PRC-BEST ✓ | K3P901F1 | KP-neu | bestätigt |
| SVC-D-001 | Bedarfsmeldung BANF erfassen | Bedarf für Informatikmittel und IKT-Dienstleistungen erfassen. | D | BBL-Personal | Informatik BBL | PRC-BANF ✓ | FRM-D-001 | Prototyp, KP-alt, KP-neu | bestätigt |
| SVC-D-002 | IT-Arbeitsgerät beschaffen | Beschaffung von Bürotechnik und Informatikmitteln über den Einkauf Informatik auslösen. | D | beide | Informatik BBL | PRC-BANF ✓ | FRM-D-002 | KP-alt, KP-neu | bestätigt |
| SVC-D-003 | Delegation für IKT-Beschaffung beantragen | Beschaffungsdelegation für eine Verwaltungseinheit beantragen. | D | Verwaltungseinheit | Informatik BBL | PRC-DELEG ✓ | FRM-D-003 | KP-alt, KP-neu | bestätigt |
| SVC-D-004 | Abruf aus Rahmenvertrag Informatik | Leistung aus einem zentral bewirtschafteten Rahmenvertrag abrufen. | D | Verwaltungseinheit | Informatik BBL | PRC-BEST ✓ | FRM-D-004 | KP-alt, KP-neu | abgeleitet |
| SVC-D-005 | Support@BIL anfordern | Support zur harmonisierten Beschaffungslösung Bund (HBB) anfordern. | D | beide | Support@BIL | PRC-BERAT | FRM-D-005 | Staff | bestätigt |
| SVC-D-006 | Anforderung an BVML einreichen | Änderungs- oder Erweiterungsanforderung an die Beschaffungslösung einreichen. | D | beide | Support@BIL | PRC-MELD | FRM-D-006 | Staff | abgeleitet |
| SVC-D-007 | GEVER-Berechtigung und Support anfordern | Zugriff, Ablagestruktur oder Support für GEVER BBL anfordern. | D | BBL-Personal | Informatik BBL | PRC-ZUG | FRM-D-007 | Staff | abgeleitet |
| SVC-D-008 | M365-Support anfordern | Unterstützung bei Microsoft-365-Anwendungen und -Berechtigungen anfordern. | D | BBL-Personal | Informatik BBL | PRC-BERAT | FRM-D-008 | Staff | abgeleitet |
| SVC-D-009 | SAP-Stellvertretung beantragen | Stellvertretungsberechtigung in SAP für Abwesenheiten beantragen. | D | BBL-Personal | Finanzen und Controlling BBL | PRC-ZUG | FRM-D-009 | Staff | abgeleitet |
| SVC-E-001 | Beratung KBB anfordern | Beschaffungsrechtliche und verfahrenstechnische Beratung des Kompetenzzentrums anfordern. | E | beide | Kompetenzzentrum Beschaffungswesen Bund | PRC-BERAT | FRM-E-001 | KP-alt, KP-neu, Staff | bestätigt |
| SVC-E-002 | Beschaffungsverfahren durchführen lassen | WTO- oder Einladungsverfahren durch die Beschaffungsstelle des Bundes durchführen lassen. | E | Verwaltungseinheit | Kompetenzzentrum Beschaffungswesen Bund | PRC-VERG | FRM-E-002 | KP-alt, KP-neu | bestätigt |
| SVC-E-003 | Beschaffung ab 50 000 Franken bekanntgeben | Meldepflichtige Beschaffung dem Beschaffungscontrolling bekanntgeben. | E | Verwaltungseinheit | Fachstelle Beschaffungscontrolling | PRC-MELD | FRM-E-003 | KP-neu | abgeleitet |
| SVC-E-004 | Vertrag im VM-System erfassen | Beschaffungsvertrag im Vertragsmanagementsystem des Bundes erfassen. | E | Verwaltungseinheit | Kompetenzzentrum Beschaffungswesen Bund | PRC-MELD | FRM-E-004 | KP-neu | abgeleitet |
| SVC-E-005 | Datenlieferung Beschaffungscontrolling | Jährliche Datenlieferung für das Beschaffungscontrolling des Bundes einreichen. | E | Verwaltungseinheit | Fachstelle Beschaffungscontrolling | PRC-MELD | FRM-E-005 | KP-alt, KP-neu | abgeleitet |
| SVC-E-006 | Rechtliche Beratung anfordern | Rechtsauskunft und Vertragsprüfung durch den Rechtsdienst BBL anfordern. | E | BBL-Personal | Rechtsdienst BBL | PRC-BERAT | FRM-E-006 | Staff | abgeleitet |
| SVC-E-007 | Beratungs- und Dienstleistungsbestellung erfassen | Bestellung für Berater, Mitgliederbeiträge, Verpflegung und Sonstiges erfassen. | E | BBL-Personal | Finanzen und Controlling BBL | PRC-BEST ✓ | FRM-E-007 | Staff | abgeleitet |
| SVC-E-008 | Sanktionierte Anbieterin melden | Rechtskräftig sanktionierte Anbieterin zur Aufnahme in die Sanktionsliste melden. | E | beide | Beschaffungskonferenz des Bundes | PRC-MELD | FRM-E-008 | KP-neu | bestätigt |
| SVC-E-009 | Sanktionsliste abfragen | Vor dem Zuschlag prüfen, ob eine Anbieterin auf der Sanktionsliste steht. | E | beide | Beschaffungskonferenz des Bundes | PRC-BERAT | FRM-E-009 | KP-neu | bestätigt |
| SVC-E-010 | Unbefangenheitserklärung abgeben | Periodische Erklärung über fehlende private Verbindungen zu Anbieterinnen abgeben. | E | beide | Beschaffungskonferenz des Bundes | PRC-MELD | FRM-E-010 | KP-neu | bestätigt |
| SVC-F-001 | Bundespublikationen bestellen | Bundespublikationen, Formulare und bedrucktes Büromaterial ab Lager bestellen. | F | beide | Publikationen BBL | PRC-BEST ✓ | FRM-F-001 | Prototyp, KP-alt, KP-neu | bestätigt |
| SVC-F-002 | Druckauftrag erteilen | Digitaldruckauftrag für Broschüren, Formulare und Grossauflagen erteilen. | F | beide | Produktion BBL | PRC-DRUCK | FRM-F-002 | KP-alt, KP-neu | bestätigt |
| SVC-F-003 | Versandauftrag erteilen | Konfektionierung und Versand einer Sendung beauftragen. | F | beide | Produktion BBL | PRC-DRUCK | FRM-F-003 | KP-alt, KP-neu | bestätigt |
| SVC-F-004 | Arbeitsvorbereitung AVOR beauftragen | Druckvorstufe, Datenaufbereitung und Ausrüstarbeiten beauftragen. | F | beide | Produktion BBL | PRC-DRUCK | FRM-F-004 | KP-alt, KP-neu | bestätigt |
| SVC-F-005 | Elektronisches Formular entwickeln lassen | Entwicklung oder Anpassung eines elektronischen Formulars beauftragen. | F | Verwaltungseinheit | Produktion BBL | PRC-DRUCK | FRM-F-005 | KP-alt, KP-neu | abgeleitet |
| SVC-F-006 | Serienbriefverarbeitung beauftragen | Serienbrieferstellung und -verarbeitung aus Adressdaten beauftragen. | F | Verwaltungseinheit | Produktion BBL | PRC-DRUCK | FRM-F-006 | KP-neu | bestätigt |
| SVC-F-007 | Projektberatung Produktion anfordern | Beratung zu Druck-, Formular- und Versandprojekten anfordern. | F | beide | Produktion BBL | PRC-BERAT | FRM-F-007 | KP-alt, KP-neu | abgeleitet |
| SVC-F-008 | Neue Publikation erstellen lassen | Konzeption, Herstellung und Aufnahme einer neuen Bundespublikation auslösen. | F | Verwaltungseinheit | Publikationen BBL | PRC-DRUCK | FRM-F-008 | KP-alt | abgeleitet |
| SVC-F-009 | Newsletter Publikationen abonnieren | Newsletter zu neuen Bundespublikationen abonnieren. | F | beide | Publikationen BBL | PRC-ZUG | FRM-F-009 | KP-alt | abgeleitet |
| SVC-F-010 | Beitrag für Intranews einreichen | Beitrag zur Veröffentlichung in den Intranews BBL einreichen. | F | BBL-Personal | Kommunikation BBL | PRC-MELD | FRM-F-010 | Staff | vermutet |
| SVC-F-011 | SRM-Limitbestellung Auftragsproduktion erfassen | Wiederkehrende Produktionsleistungen (RZ / NON RZ) über eine Limitbestellung abwickeln. | F | beide | Produktion BBL | PRC-DRUCK | FRM-F-011 | KP-neu | bestätigt |
| SVC-F-012 | Publikationsauftrag erteilen | Gedruckte oder elektronische Publikation über die zentrale Beschaffungsstelle beziehen. | F | Verwaltungseinheit | Warengruppe Publikationen | PRC-DRUCK | FRM-F-012 | KP-neu | bestätigt |
| SVC-F-013 | Agenturleistung beschaffen | Agentur- und Kommunikationsleistungen über die zentrale Beschaffungsstelle beziehen. | F | Verwaltungseinheit | Warengruppe Publikationen | PRC-VERG | FRM-F-013 | KP-neu | bestätigt |
| SVC-G-001 | Sicherheits- oder Datenschutzvorfall melden | Vorfall der Informationssicherheit oder des Datenschutzes der ISBO melden. | G | beide | Informationssicherheit BBL | PRC-SEC ✓ | FRM-G-001 ✓ | Prototyp, Staff | bestätigt |
| SVC-G-002 | Notfall melden | Akuten Notfall über die Alarmzentrale und die Notfallorganisation melden. | G | beide | Notfallorganisation BBL | PRC-SEC ✓ | FRM-G-002 | Staff | bestätigt |
| SVC-G-003 | Beratung Informationsschutz anfordern | Beratung zu Klassifizierung und Schutz von Informationen anfordern. | G | beide | Informationssicherheit BBL | PRC-BERAT | FRM-G-003 | Staff | abgeleitet |
| SVC-G-004 | Bearbeitungstätigkeit melden | Neue Bearbeitung von Personendaten für das Bearbeitungsverzeichnis melden. | G | BBL-Personal | Informationssicherheit BBL | PRC-MELD | FRM-G-004 | Staff | abgeleitet |
| SVC-G-005 | ISDS-Konzept prüfen lassen | Informationssicherheits- und Datenschutzkonzept einer Anwendung prüfen lassen. | G | BBL-Personal | Informationssicherheit BBL | PRC-BERAT | FRM-G-005 | Staff | vermutet |
| SVC-G-006 | Zutrittsberechtigung beantragen | Badge und Zutrittsrechte für ein Gebäude oder eine Zone beantragen. | G | beide | Informationssicherheit BBL | PRC-ZUG | FRM-G-006 | — | vermutet |
| SVC-G-007 | Risiko melden | Risiko für das Risikomanagement BBL erfassen und bewerten lassen. | G | BBL-Personal | Risikomanagement BBL | PRC-MELD | FRM-G-007 | Staff | abgeleitet |
| SVC-H-001 | Eintritt melden und Onboarding auslösen | Eintritt einer Person melden und Arbeitsplatz, Zugänge und Material auslösen. | H | BBL-Personal | HR BBL | PRC-HR | FRM-H-001 | Staff | abgeleitet |
| SVC-H-002 | Aus- und Weiterbildung buchen | Kurs oder Weiterbildung über PERIMAP/ILIAS buchen. | H | BBL-Personal | HR BBL | PRC-HR | FRM-H-002 | Staff | abgeleitet |
| SVC-H-003 | Fall im Case Management melden | Fall für das betriebliche Case Management melden. | H | BBL-Personal | HR BBL | PRC-HR | FRM-H-003 | Staff | abgeleitet |
| SVC-H-004 | Idee einreichen | Verbesserungsvorschlag im Ideenmanagement und KVP einreichen. | H | BBL-Personal | HR BBL | PRC-MELD | FRM-H-004 | Staff | abgeleitet |
| SVC-H-005 | Personaldaten mutieren | Personalstammdaten und Abwesenheiten über InfoPers ändern. | H | BBL-Personal | HR BBL | PRC-HR | FRM-H-005 | Staff | abgeleitet |
| SVC-H-006 | Stelle ausschreiben | Offene Stelle über die Stellenplattform des Bundes ausschreiben. | H | BBL-Personal | HR BBL | PRC-HR | FRM-H-006 | Staff | abgeleitet |
| SVC-H-007 | Vergünstigung beziehen | Personalvergünstigung als Mitarbeitende oder Mitarbeitender beziehen. | H | BBL-Personal | HR BBL | PRC-ZUG | FRM-H-007 | Staff | abgeleitet |

**83 Dienstleistungen** · 38 bestätigt · 42 abgeleitet · 3 vermutet · **34 davon im Prototyp umgesetzt** (die Zuordnung steht in [§5](#5-abgleich-mit-dataservicesjson)) · 49 offen.

### 3.1 Formularbelege aus dem Export

Der ursprüngliche Suchmarker — «Dienstleistungen haben Formulare mit einer Nummer» — trägt nicht: **nur 5 von 31 Formularen im ganzen Bestand tragen eine BBL-Nummer** (viermal `K7P90*` für Umzüge und Transporte, einmal `K3P901F1`). Der belastbare Marker ist der Titel: `…auftrag`, `Bestellformular…`, `Gesuch…`, `Bedarfsmeldung…`, `Anmeldung…`.

Die 31 Formulare verteilen sich auf **9 von 38 erfassten Seiten**. Was daraus folgt:

| Seite | Formular(e) | Zeile |
|---|---|---|
| `raumbedarf-bauliche-beduerfnisse` | Grosser Antrag (> Fr. 100 000.—) · Kleiner Antrag (< Fr. 100 000.—) | SVC-A-001 |
| `stoerungsmeldungen-gebaeude-kleinauftraege` | Kleiner Antrag (< Fr. 100 000.—) | SVC-O-002 |
| `stoerungsmeldungen-gebaeude-kleinauftraege` | Bestellformular für Dekorationen | SVC-O-012 |
| `stoerungsmeldungen-gebaeude-kleinauftraege` | Innenbegrünungsauftrag | SVC-O-013 |
| `mobiliar` | K7P90 F1d Transport- und Umzugsauftrag · K7P90 F2 Masterliste Umzüge | SVC-O-003 + SVC-O-004 |
| `mobiliar` | **K3P901F1 Bestellformular für Mobiliarschlüssel** | SVC-C-011 *(neu)* |
| `bestellen-e-shop` | Anmeldeformular-B2B-Shop | SVC-C-009 |
| `bedarfsmeldung-hbb-prozess` | Bedarfsmeldung Software · Hardware · Dienstleistung | SVC-D-002 |
| `bedarfsmeldung-hbb-prozess` | Anmeldung überschwellige Beschaffung | SVC-E-002 |
| `delegationen` | Gesuch unterschwellige Delegation · Gesuch Projektdelegation | SVC-D-003 |
| `arbeitsvorbereitung-avor` · `digital-druck` | Digitaldruckauftrag | SVC-F-002 |
| `arbeitsvorbereitung-avor` · `versenden` | Versandauftrag | SVC-F-003 |
| `arbeitsvorbereitung-avor` | Output Design Auftrag · Layout Auftrag | SVC-F-004 |
| `arbeitsvorbereitung-avor` | **SRM Limitbestellung RZ · NON RZ · SRM Dienstleistung Prod NON RZ** | SVC-F-011 *(neu)* |
| `warengruppe-publikationen` | **Publikationsauftrag** | SVC-F-012 *(neu)* |
| `warengruppe-publikationen` | **Agenturleistung / Elektronische Publikationen** | SVC-F-013 *(neu)* |
| `dokumente-der-bkb` | **Formular Meldung sanktionierte Anbieterin · Vorlage Verfügung Auftragssperre** | SVC-E-008 *(neu)* |
| `dokumente-der-bkb` | **Formular Abfrage Sanktionsliste** | SVC-E-009 *(neu)* |
| `dokumente-der-bkb` | **Unbefangenheitserklärung** | SVC-E-010 *(neu)* |

Drei Beobachtungen, die über die einzelne Zeile hinausgehen:

1. **`K3P901F1` ist der stärkste Einzelbefund** — das einzige nummerierte Formular des Bestands ohne jede Registerzeile. Nummerierte Formulare sind die formalisiertesten Leistungen des BBL; dass eines davon durchgefallen ist, zeigt, wie schnell die Herleitung aus Navigationsbeschriftungen an einer Unterposition scheitert.
2. **Die Warengruppe Publikationen war ein blinder Fleck** und stand in keiner der fünf Lücken von [§4](#4-lücken-und-blinde-flecken). Sie ist nach Org-VöB Art. 9 lit. c die **zentrale Beschaffungsstelle** für alle Publikationen, Agenturleistungen und Sicherheitsprodukte des Bundes (Pass, ID, Vignette) — unabhängig vom Schwellenwert. Das ist etwas anderes als `SVC-F-008` (Publikationen BBL als Verlag).
3. **Nicht aufgenommen** wurden Formular Bankgarantie und Formular Bürgschaft (`dokumente-der-bkb`): sie werden von der **Anbieterin** ausgefüllt, nicht von einer Kundin des Portals, und fallen damit unter die Ausschlussregel in [§1](#1-aufnahmeregel). Ebenso wenig aufgenommen: Checklisten, Leitfäden und Mustervorlagen (`K7P90 C1d`, `K7P90 C2`, Mustervorlagen IKT) — sie sind Hilfsmittel und gehören nach «Wissen und Hilfsmittel».

**Deckungsvorbehalt:** die 38 Exporte umfassen Unterbringung, Objektbetrieb, Büroausrüstung, Produktion, Publizieren und Beschaffung. Für Stammdaten (B), Sicherheit (G), Personal (H) sowie die Zugangsleistungen `SVC-U-003`/`SVC-U-004` enthalten sie **keine einzige Seite**. Das Schweigen dort ist kein Gegenbeleg — jene 22 Zeilen ruhen weiterhin allein auf dem Personalintranet.

### Prozessregister (referenziert)

| Prozess-ID | Name | Status |
|---|---|---|
| PRC-RAUM | Raumbedarf-Antrag | umgesetzt — 6 Schritte, [`process-definitions.json`](../data/process-definitions.json) |
| PRC-STOER | Störungsmeldung | umgesetzt — 4 Schritte |
| PRC-SEC | Sicherheits- und Datenschutzvorfall | umgesetzt — 3 Schritte |
| PRC-BEST | Bestellung | umgesetzt — 4 Schritte |
| PRC-BANF | Bedarfsmeldung BANF | umgesetzt — 4 Schritte |
| PRC-BUCH | Raumbuchung | umgesetzt — 2 Schritte |
| PRC-DELEG | Delegationsgesuch | umgesetzt — 6 Schritte |
| PRC-AUFT | Auftragsabwicklung Objektbetrieb | zu entwerfen — 11 Dienstleistungen |
| PRC-MUT | Stammdatenmutation | zu entwerfen — 4 Dienstleistungen |
| PRC-BERAT | Beratungsauftrag | zu entwerfen — 9 Dienstleistungen |
| PRC-MELD | Meldung und Nachweispflicht | zu entwerfen — 10 Dienstleistungen |
| PRC-ZUG | Zugang und Berechtigung beantragen | zu entwerfen — 8 Dienstleistungen |
| PRC-HR | Personalprozess | zu entwerfen — 5 Dienstleistungen |
| PRC-DRUCK | Produktionsauftrag | zu entwerfen — 8 Dienstleistungen |
| PRC-DOK | Dokumentenbezug | umgesetzt als Selbstbedienung, ohne Vorgang |
| PRC-UNTB | Unterbringungsbedarf | zu entwerfen |
| PRC-ZUW | Flächenzuweisung | zu entwerfen |
| PRC-VERG | Beschaffungsverfahren | zu entwerfen — 2 Dienstleistungen |

Sieben zu entwerfende Prozesse decken 55 der 83 Dienstleistungen ab — die Bündelung ist bewusst: `PRC-AUFT` etwa ist für Beflaggung und Sonderreinigung derselbe Ablauf (erfassen → triagieren → ausführen → verrechnen), er unterscheidet sich nur im Formular. Insgesamt kommen 83 Dienstleistungen mit **18 Prozessen** aus, von denen 7 bereits existieren.

**`PRC-DELEG` ist der einzige Prozess, der nicht entworfen, sondern abgeschrieben ist.** Die Seite `/de/delegationen` beschreibt ihren Ablauf als einzige der 38 erfassten Seiten vollständig: Gesuch einreichen → Erstprüfung durch das BBL → Entscheid der Prüfinstanz → Delegationsvereinbarung → digitale Gegenzeichnung → Erfassung im Delegationsmanagement-Tool. Damit fällt `SVC-D-003` aus `PRC-ZUG` heraus; ein belegter Ablauf schlägt eine Sammelkategorie. Ebenso wechselt `SVC-O-002` von `PRC-AUFT` zu `PRC-STOER`: der Helpdesk OM ist laut Kundenplattform die zentrale Annahmestelle für «Störungsmeldung **und** Kleinaufträge» — also derselbe Ablauf, nicht ein eigener.

## 4. Lücken und blinde Flecken

Was dieses Register **nicht** belegen kann — jede Zeile mit Reife `abgeleitet` oder `vermutet` hängt an einer dieser Lücken:

1. **Der bepreiste Leistungskatalog liegt in PDFs, die wir nicht haben.** *(korrigiert am 29. Juli 2026 — die frühere Fassung dieser Lücke war zu pessimistisch und zugleich zu optimistisch.)* Die Seite `/dienstleistungskatalog` **ist erfasst**; sie erweist sich als dünn: drei PDF-Links und eine Helpdesk-Adresse. Ihr Geltungsbereich ist ausserdem enger als angenommen — sie deckt **allein den Objektbetrieb** ab, unterschieden nach Standard und Zusatz, nicht das Leistungsverzeichnis des ganzen BBL. Der Inhalt steckt in fünf Dateien, die weiterhin fehlen: `Produktebeschreibung Nutzerspezifische Dienstleistungen`, `Produktebeschreibung Zusatzdienstleistungen`, `Produktebeschreibung Nebenkosten`, `Preisliste Leistungsbereich Unterbringung` und `Leistungsbeschreibung Betreibervereinbarung`. **Diese fünf PDFs sind die wichtigste zu beschaffende Quelle** — sie würden die elf offenen `PRC-AUFT`-Zeilen bepreisen und abgrenzen. Ein BBL-weiter Dienstleistungskatalog existiert nach heutigem Kenntnisstand gar nicht; dieses Register ist der erste.
2. **Die zwei Kundenplattform-Generationen widersprechen sich.** Die erfasste AEM-Fassung führt Einträge, die im neueren Nuxt-Baum fehlen (Projektinformationen, FLM Info-App, Gratisabgabe Büromaterial, Einkaufshilfe, Kreis-1+2- vs. Kreis-3-Shop, Publikationen neu erstellen, Newsletter, Supportprozesse Bauten und Logistik, Change Management, Logistik Zusatzprogramm) — und umgekehrt. Keine der beiden ist eine Obermenge; das Register führt beide zusammen.
3. **Die Quelldatei zu [sitemap.md §B](sitemap.md) fehlt.** Der dort zitierte Nuxt-Baum stammt aus `Bestellen (E-Shop).html` — diese Datei liegt nicht mehr in [bbl-intranet/](../bbl-intranet/). Der Baum ist damit nur noch als Transkript belegt, nicht mehr nachprüfbar.
4. **`themen/arbeitshilfen` ist nur einblättrig erfasst.** Vom Arbeitshilfen-Teilbaum des Personalintranets kennen wir eine einzige Unterseite (`gebaeude/stoerungs_reinigungs_rep_meldungen`). Dort liegen mutmasslich weitere interne Leistungen.
5. **`www.bbl.admin.ch` ist gar nicht erfasst.** Die dritte Website (Publikum und Branche) fehlt vollständig — relevant für Leistungen an Externe.
6. **Keine Domäne für Finanzen und Controlling.** `SVC-D-009` und `SVC-E-007` stammen aus `themen/finanzen`, passen aber in keine der zehn Domänen sauber. Entweder eine elfte Domäne aufnehmen oder die Zuordnung bewusst als Notlösung bestätigen.
7. **Leistungserbringer sind nicht durchgängig belegt.** [`data/contacts.json`](../data/contacts.json) kennt inzwischen 17 Stellen, dieses Register nennt 18. Für sechs davon liefert der Export das echte, generische Rollenpostfach (Helpdesk OM, Mobiliar und Hausdienst, Produktion, Hotline Intranetshop, Einkauf IT — dazu die publizierten Abteilungsnummern 058 462 08 10 und 058 465 50 71). Für **Warengruppe Publikationen und BKB nennt der Export nur personenbezogene Adressen**; sie sind bewusst nicht übernommen, ihre Postfächer im Prototyp sind generische Platzhalter. Die übrigen Stellen (Logistik BBL, Publikationen BBL, Rechtsdienst BBL, HR BBL, Finanzen und Controlling BBL, Kommunikation BBL, Workspace BBL, Notfallorganisation BBL, Risikomanagement BBL, Fachstelle Beschaffungscontrolling) sind weiterhin aus der Organisationslogik erschlossen, nicht aus einem Organigramm.

## 5. Abgleich mit `data/services.json`

17 der 20 bestehenden Einträge werden übernommen und bekommen eine neue ID:

| Bisher (`serviceId`) | Neu | Bisher | Neu |
|---|---|---|---|
| `raumbedarf-melden` | SVC-A-001 | `bautendokumentation-abrufen` | SVC-A-002 |
| `bauprojekt-informationen` | SVC-A-003 | `gebaeude-erfassen` | SVC-B-001 |
| `parzelle-erfassen` | SVC-B-002 | `stammdaten-mutieren` | SVC-B-003 |
| `objekt-archivieren` | SVC-B-004 | `unterbringungsbedarf` | SVC-U-001 |
| `flaechenzuweisung` | SVC-U-002 | `stoerung-melden` | SVC-O-001 |
| `umzug-anmelden` | SVC-O-003 | `reklamation` | SVC-O-015 |
| `eshop-bestellen` | SVC-C-001 | `raumbuchung` | SVC-C-010 |
| `banf-bedarfsmeldung` | SVC-D-001 | `publikation-bestellen` | SVC-F-001 |
| `sicherheitsvorfall-melden` | SVC-G-001 | | |

### Am 29. Juli 2026 nachgeführt

17 formularbelegte Zeilen sind in [`data/services.json`](../data/services.json) umgesetzt worden — der Katalog wächst damit von 20 auf 37 Einträge (33 startbar):

| `serviceId` | Register | `serviceId` | Register |
|---|---|---|---|
| `kleinauftrag-gebaeude` | SVC-O-002 | `dekoration-bestellen` | SVC-O-012 |
| `innenbegruenung-bestellen` | SVC-O-013 | `mobiliarschluessel-bestellen` | SVC-C-011 |
| `intranetshop-zugang` | SVC-C-009 | ~~`hbb-bedarfsmeldung`~~ | SVC-D-002, entfernt |
| `delegation-beantragen` | SVC-D-003 | `beschaffung-anmelden` | SVC-E-002 |
| `sanktionierte-anbieterin-melden` | SVC-E-008 | `sanktionsliste-abfragen` | SVC-E-009 |
| `unbefangenheitserklaerung` | SVC-E-010 | `druckauftrag` | SVC-F-002 |
| `versandauftrag` | SVC-F-003 | `avor-auftrag` | SVC-F-004 |
| `srm-limitbestellung` | SVC-F-011 | `publikationsauftrag` | SVC-F-012 |
| `agenturleistung-beschaffen` | SVC-F-013 | | |

Drei Entscheide, die dabei gefallen sind:

- **`SVC-O-004` Transportauftrag bekommt keinen eigenen Eintrag.** Umzug und Transport teilen sich im Export ein einziges Formular (`K7P90 F1d Transport- und Umzugsauftrag`); der bestehende Eintrag `umzug-anmelden` deckt beide ab, ebenso `SVC-O-006` Entsorgung. Zwei Registerzeilen, ein Bezugsweg — das Register bleibt feiner als der Katalog, weil die Verrechnung getrennt läuft.
- **Acht der neuen Einträge tragen bewusst keinen `processDefId`.** `PRC-AUFT` und `PRC-DRUCK` sind laut Prozessregister *zu entwerfen*. Ihnen ersatzweise `PRC-BEST` unterzuschieben hätte einen Ablauf behauptet, den niemand entworfen hat; die Detailseite lässt den Block «So läuft es ab» dann weg. Nur `kleinauftrag-gebaeude` (PRC-STOER), `mobiliarschluessel-bestellen` (PRC-BEST) und `delegation-beantragen` (PRC-DELEG) haben einen belegten Ablauf.
- **Die Fahne `thema` in [`data/reference-data.json`](../data/reference-data.json) ist entfallen.** Sie steuerte zuletzt nur noch die Themenliste im Katalogfilter und war dort genauso veraltet wie zuvor im Drawer: Büroausrüstung, Informatik, Beschaffung und Publizieren tragen Vorgänge, waren aber nicht filterbar — der Drawer verlinkte `?topic=E`, der Filter konnte es weder zeigen noch abwählen. Beide Oberflächen leiten die Themen jetzt aus derselben Regel ab: ein Thema erscheint, sobald ein Vorgang dahintersteht.

**Drei Einträge fallen aus dem Register** — sie sind nach der Aufnahmeregel keine bezugsfähigen Leistungen, sondern Inhalte bzw. Anwendungen:

| Bisher | Neuer Ort | Begründung |
|---|---|---|
| `portfolio-einsicht` | Anwendungen (`#/app/portfolio`) | Einsicht in ein Inventar, keine Leistung mit Ergebnis |
| `beschaffung-einstieg` | News und Wissen | Einstiegs- und Vorlagenseite; die eigentliche Leistung ist SVC-E-001 |
| `leistungsverrechnung` | News und Wissen | Preis- und Verrechnungsinformation, kein auslösbarer Vorgang |

**Offene Migrationsschritte** (bewusst noch nicht ausgeführt): `serviceId` in [`data/services.json`](../data/services.json) auf die neuen IDs umstellen, `processDefId` auf die `PRC-*`-Schlüssel angleichen, [`data/process-definitions.json`](../data/process-definitions.json) umbenennen, und die drei ausgeschiedenen Einträge in Anwendungen bzw. Wissen überführen. Die Routen (`#/services/<id>`) und die Deep-Links in [`js/pages/services.js`](../js/pages/services.js) hängen an diesen IDs — deshalb tragen auch die 17 neuen Einträge weiterhin sprechende Slugs statt `SVC-*`; die Umstellung ist ein Schritt für alle 37 Einträge gemeinsam, nicht für die neuen allein.

**Was als Nächstes ansteht:** die 49 offenen Zeilen sind kein gleichförmiger Rest. `PRC-AUFT` (11 Zeilen Objektbetrieb) ist der grösste zusammenhängende Block und hängt an den fünf fehlenden PDFs aus [§4](#4-lücken-und-blinde-flecken); `PRC-DRUCK` (8 Zeilen Produktion) ist nach den AVOR-Formularen dagegen gut belegt und wäre als Nächstes entwerfbar.
