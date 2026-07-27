# Dienstleistungsregister BBL — Golden Record

**Stand:** 27. Juli 2026 · **Status:** massgebendes Referenzregister (Golden Record)

Dieses Dokument ist die **einzige massgebende Quelle** für die Dienstleistungen der BBL-Plattform. [`data/services.json`](../data/services.json) ist die im Prototyp **umgesetzte Teilmenge** und folgt diesem Register — nicht umgekehrt. Weicht der Prototyp ab, gilt diese Tabelle.

Das Register ist aus drei Quellen zusammengeführt (die sich widersprechen — siehe [§4](#4-lücken-und-blinde-flecken)): der Kundenplattform BBL in ihren zwei Generationen, dem EFD-BBL-Personalintranet und dem bestehenden Prototyp-Katalog. Rund zwei Drittel der Zeilen sind aus Navigationsbeschriftungen abgeleitet, nicht aus Leistungsbeschrieben — die Spalte **Reife** hält das je Zeile fest, statt einheitliche Sicherheit vorzutäuschen.

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
| SVC-O-002 | Kleinauftrag am Gebäude erteilen | Kleinere bauliche Anpassung ausserhalb eines Bauprojekts beauftragen. | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-002 | KP-alt, KP-neu | abgeleitet |
| SVC-O-003 | Umzug anmelden | Internen Umzug von Personen, Arbeitsplätzen oder Mobiliar anmelden. | O | beide | Objektbetrieb | PRC-STOER ✓ | FRM-O-003 ✓ | Prototyp, KP-alt, KP-neu | bestätigt |
| SVC-O-004 | Transportauftrag erteilen | Internen Transport von Material und Mobiliar beauftragen. | O | beide | Objektbetrieb | PRC-AUFT | FRM-O-004 | KP-alt, KP-neu | abgeleitet |
| SVC-O-005 | Kurierdienst BBL beauftragen | Kuriersendung zwischen Bundesstandorten beauftragen. | O | beide | Objektbetrieb | PRC-AUFT | FRM-O-005 | KP-alt, KP-neu | abgeleitet |
| SVC-O-006 | Entsorgung beauftragen | Fachgerechte Entsorgung von Mobiliar, Material und Akten beauftragen. | O | beide | Objektbetrieb | PRC-AUFT | FRM-O-006 | KP-alt, KP-neu | abgeleitet |
| SVC-O-007 | Sonderreinigung beauftragen | Reinigung ausserhalb des vereinbarten Unterhaltsrhythmus bestellen. | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-007 | KP-alt, KP-neu | abgeleitet |
| SVC-O-008 | Hauswartungsleistung anfordern | Leistung der Hauswartung ausserhalb des Standardumfangs anfordern. | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-008 | KP-alt, KP-neu | abgeleitet |
| SVC-O-009 | Wartung technische Anlage anfordern | Service, Wartung oder Störungsbehebung an einer technischen Anlage anfordern. | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-009 | KP-alt, KP-neu | abgeleitet |
| SVC-O-010 | Anlass in einem Bundesgebäude anmelden | Durchführung eines Anlasses inklusive Infrastruktur und Betreuung anmelden. | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-010 | KP-alt, KP-neu | abgeleitet |
| SVC-O-011 | Beflaggung bestellen | Beflaggung eines Gebäudes für Anlässe und Staatsbesuche bestellen (Fahnenmanagement). | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-011 | KP-alt, KP-neu | abgeleitet |
| SVC-O-012 | Blumendekoration bestellen | Blumenschmuck für Anlässe, Empfänge und Sitzungszimmer bestellen. | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-012 | KP-alt, KP-neu | abgeleitet |
| SVC-O-013 | Innenbegrünung bestellen | Bepflanzung und Unterhalt der Innenbegrünung bestellen. | O | Verwaltungseinheit | Objektbetrieb | PRC-AUFT | FRM-O-013 | KP-alt, KP-neu | abgeleitet |
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
| SVC-D-001 | Bedarfsmeldung BANF erfassen | Bedarf für Informatikmittel und IKT-Dienstleistungen erfassen. | D | BBL-Personal | Informatik BBL | PRC-BANF ✓ | FRM-D-001 | Prototyp, KP-alt, KP-neu | bestätigt |
| SVC-D-002 | IT-Arbeitsgerät beschaffen | Beschaffung von Bürotechnik und Informatikmitteln über den Einkauf Informatik auslösen. | D | beide | Informatik BBL | PRC-BANF ✓ | FRM-D-002 | KP-alt, KP-neu | abgeleitet |
| SVC-D-003 | Delegation für IKT-Beschaffung beantragen | Beschaffungsdelegation für eine Verwaltungseinheit beantragen. | D | Verwaltungseinheit | Informatik BBL | PRC-ZUG | FRM-D-003 | KP-alt, KP-neu | abgeleitet |
| SVC-D-004 | Abruf aus Rahmenvertrag Informatik | Leistung aus einem zentral bewirtschafteten Rahmenvertrag abrufen. | D | Verwaltungseinheit | Informatik BBL | PRC-BEST ✓ | FRM-D-004 | KP-alt, KP-neu | abgeleitet |
| SVC-D-005 | Support@BIL anfordern | Support zur harmonisierten Beschaffungslösung Bund (HBB) anfordern. | D | beide | Support@BIL | PRC-BERAT | FRM-D-005 | Staff | bestätigt |
| SVC-D-006 | Anforderung an BVML einreichen | Änderungs- oder Erweiterungsanforderung an die Beschaffungslösung einreichen. | D | beide | Support@BIL | PRC-MELD | FRM-D-006 | Staff | abgeleitet |
| SVC-D-007 | GEVER-Berechtigung und Support anfordern | Zugriff, Ablagestruktur oder Support für GEVER BBL anfordern. | D | BBL-Personal | Informatik BBL | PRC-ZUG | FRM-D-007 | Staff | abgeleitet |
| SVC-D-008 | M365-Support anfordern | Unterstützung bei Microsoft-365-Anwendungen und -Berechtigungen anfordern. | D | BBL-Personal | Informatik BBL | PRC-BERAT | FRM-D-008 | Staff | abgeleitet |
| SVC-D-009 | SAP-Stellvertretung beantragen | Stellvertretungsberechtigung in SAP für Abwesenheiten beantragen. | D | BBL-Personal | Finanzen und Controlling BBL | PRC-ZUG | FRM-D-009 | Staff | abgeleitet |
| SVC-E-001 | Beratung KBB anfordern | Beschaffungsrechtliche und verfahrenstechnische Beratung des Kompetenzzentrums anfordern. | E | beide | Kompetenzzentrum Beschaffungswesen Bund | PRC-BERAT | FRM-E-001 | KP-alt, KP-neu, Staff | bestätigt |
| SVC-E-002 | Beschaffungsverfahren durchführen lassen | WTO- oder Einladungsverfahren durch die Beschaffungsstelle des Bundes durchführen lassen. | E | Verwaltungseinheit | Kompetenzzentrum Beschaffungswesen Bund | PRC-VERG | FRM-E-002 | KP-alt, KP-neu | abgeleitet |
| SVC-E-003 | Beschaffung ab 50 000 Franken bekanntgeben | Meldepflichtige Beschaffung dem Beschaffungscontrolling bekanntgeben. | E | Verwaltungseinheit | Fachstelle Beschaffungscontrolling | PRC-MELD | FRM-E-003 | KP-neu | abgeleitet |
| SVC-E-004 | Vertrag im VM-System erfassen | Beschaffungsvertrag im Vertragsmanagementsystem des Bundes erfassen. | E | Verwaltungseinheit | Kompetenzzentrum Beschaffungswesen Bund | PRC-MELD | FRM-E-004 | KP-neu | abgeleitet |
| SVC-E-005 | Datenlieferung Beschaffungscontrolling | Jährliche Datenlieferung für das Beschaffungscontrolling des Bundes einreichen. | E | Verwaltungseinheit | Fachstelle Beschaffungscontrolling | PRC-MELD | FRM-E-005 | KP-alt, KP-neu | abgeleitet |
| SVC-E-006 | Rechtliche Beratung anfordern | Rechtsauskunft und Vertragsprüfung durch den Rechtsdienst BBL anfordern. | E | BBL-Personal | Rechtsdienst BBL | PRC-BERAT | FRM-E-006 | Staff | abgeleitet |
| SVC-E-007 | Beratungs- und Dienstleistungsbestellung erfassen | Bestellung für Berater, Mitgliederbeiträge, Verpflegung und Sonstiges erfassen. | E | BBL-Personal | Finanzen und Controlling BBL | PRC-BEST ✓ | FRM-E-007 | Staff | abgeleitet |
| SVC-F-001 | Bundespublikationen bestellen | Bundespublikationen, Formulare und bedrucktes Büromaterial ab Lager bestellen. | F | beide | Publikationen BBL | PRC-BEST ✓ | FRM-F-001 | Prototyp, KP-alt, KP-neu | bestätigt |
| SVC-F-002 | Druckauftrag erteilen | Digitaldruckauftrag für Broschüren, Formulare und Grossauflagen erteilen. | F | beide | Produktion BBL | PRC-DRUCK | FRM-F-002 | KP-alt, KP-neu | abgeleitet |
| SVC-F-003 | Versandauftrag erteilen | Konfektionierung und Versand einer Sendung beauftragen. | F | beide | Produktion BBL | PRC-DRUCK | FRM-F-003 | KP-alt, KP-neu | abgeleitet |
| SVC-F-004 | Arbeitsvorbereitung AVOR beauftragen | Druckvorstufe, Datenaufbereitung und Ausrüstarbeiten beauftragen. | F | beide | Produktion BBL | PRC-DRUCK | FRM-F-004 | KP-alt, KP-neu | abgeleitet |
| SVC-F-005 | Elektronisches Formular entwickeln lassen | Entwicklung oder Anpassung eines elektronischen Formulars beauftragen. | F | Verwaltungseinheit | Produktion BBL | PRC-DRUCK | FRM-F-005 | KP-alt, KP-neu | abgeleitet |
| SVC-F-006 | Serienbriefverarbeitung beauftragen | Serienbrieferstellung und -verarbeitung aus Adressdaten beauftragen. | F | Verwaltungseinheit | Produktion BBL | PRC-DRUCK | FRM-F-006 | KP-neu | abgeleitet |
| SVC-F-007 | Projektberatung Produktion anfordern | Beratung zu Druck-, Formular- und Versandprojekten anfordern. | F | beide | Produktion BBL | PRC-BERAT | FRM-F-007 | KP-alt, KP-neu | abgeleitet |
| SVC-F-008 | Neue Publikation erstellen lassen | Konzeption, Herstellung und Aufnahme einer neuen Bundespublikation auslösen. | F | Verwaltungseinheit | Publikationen BBL | PRC-DRUCK | FRM-F-008 | KP-alt | abgeleitet |
| SVC-F-009 | Newsletter Publikationen abonnieren | Newsletter zu neuen Bundespublikationen abonnieren. | F | beide | Publikationen BBL | PRC-ZUG | FRM-F-009 | KP-alt | abgeleitet |
| SVC-F-010 | Beitrag für Intranews einreichen | Beitrag zur Veröffentlichung in den Intranews BBL einreichen. | F | BBL-Personal | Kommunikation BBL | PRC-MELD | FRM-F-010 | Staff | vermutet |
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

**76 Dienstleistungen** · 20 bestätigt · 53 abgeleitet · 3 vermutet · **17 davon im Prototyp umgesetzt** (die Zuordnung steht in [§5](#5-abgleich-mit-dataservicesjson)) · 59 offen.

### Prozessregister (referenziert)

| Prozess-ID | Name | Status |
|---|---|---|
| PRC-RAUM | Raumbedarf-Antrag | umgesetzt — 6 Schritte, [`process-definitions.json`](../data/process-definitions.json) |
| PRC-STOER | Störungsmeldung | umgesetzt — 4 Schritte |
| PRC-SEC | Sicherheits- und Datenschutzvorfall | umgesetzt — 3 Schritte |
| PRC-BEST | Bestellung | umgesetzt — 4 Schritte |
| PRC-BANF | Bedarfsmeldung BANF | umgesetzt — 4 Schritte |
| PRC-BUCH | Ressourcenbuchung | umgesetzt — 2 Schritte |
| PRC-AUFT | Auftragsabwicklung Objektbetrieb | zu entwerfen — 12 Dienstleistungen |
| PRC-MUT | Stammdatenmutation | zu entwerfen — 4 Dienstleistungen |
| PRC-BERAT | Beratungsauftrag | zu entwerfen — 8 Dienstleistungen |
| PRC-MELD | Meldung und Nachweispflicht | zu entwerfen — 8 Dienstleistungen |
| PRC-ZUG | Zugang und Berechtigung beantragen | zu entwerfen — 9 Dienstleistungen |
| PRC-HR | Personalprozess | zu entwerfen — 5 Dienstleistungen |
| PRC-DRUCK | Produktionsauftrag | zu entwerfen — 6 Dienstleistungen |
| PRC-DOK | Dokumentenbezug | umgesetzt als Selbstbedienung, ohne Vorgang |
| PRC-UNTB | Unterbringungsbedarf | zu entwerfen |
| PRC-ZUW | Flächenzuweisung | zu entwerfen |
| PRC-VERG | Beschaffungsverfahren | zu entwerfen |

Sieben neue Prozesse decken 52 der 76 Dienstleistungen ab — die Bündelung ist bewusst: `PRC-AUFT` etwa ist für Beflaggung und Sonderreinigung derselbe Ablauf (erfassen → triagieren → ausführen → verrechnen), er unterscheidet sich nur im Formular. Insgesamt kommen 76 Dienstleistungen mit **17 Prozessen** aus, von denen 6 bereits existieren.

## 4. Lücken und blinde Flecken

Was dieses Register **nicht** belegen kann — jede Zeile mit Reife `abgeleitet` oder `vermutet` hängt an einer dieser Lücken:

1. **Der echte Dienstleistungskatalog fehlt.** Die erfasste Navigation enthält eine Seite `/dienstleistungskatalog` sowie `Leistungsverrechnung` mit Preiskatalog — also genau das massgebende, bepreiste Leistungsverzeichnis des BBL. Wir haben den Link, nicht den Inhalt. **Das ist die wichtigste zu beschaffende Quelle**; sie würde vermutlich die Hälfte der `abgeleitet`-Zeilen bestätigen oder korrigieren.
2. **Die zwei Kundenplattform-Generationen widersprechen sich.** Die erfasste AEM-Fassung führt Einträge, die im neueren Nuxt-Baum fehlen (Projektinformationen, FLM Info-App, Gratisabgabe Büromaterial, Einkaufshilfe, Kreis-1+2- vs. Kreis-3-Shop, Publikationen neu erstellen, Newsletter, Supportprozesse Bauten und Logistik, Change Management, Logistik Zusatzprogramm) — und umgekehrt. Keine der beiden ist eine Obermenge; das Register führt beide zusammen.
3. **Die Quelldatei zu [sitemap.md §B](sitemap.md) fehlt.** Der dort zitierte Nuxt-Baum stammt aus `Bestellen (E-Shop).html` — diese Datei liegt nicht mehr in [bbl-intranet/](../bbl-intranet/). Der Baum ist damit nur noch als Transkript belegt, nicht mehr nachprüfbar.
4. **`themen/arbeitshilfen` ist nur einblättrig erfasst.** Vom Arbeitshilfen-Teilbaum des Personalintranets kennen wir eine einzige Unterseite (`gebaeude/stoerungs_reinigungs_rep_meldungen`). Dort liegen mutmasslich weitere interne Leistungen.
5. **`www.bbl.admin.ch` ist gar nicht erfasst.** Die dritte Website (Publikum und Branche) fehlt vollständig — relevant für Leistungen an Externe.
6. **Keine Domäne für Finanzen und Controlling.** `SVC-D-009` und `SVC-E-007` stammen aus `themen/finanzen`, passen aber in keine der zehn Domänen sauber. Entweder eine elfte Domäne aufnehmen oder die Zuordnung bewusst als Notlösung bestätigen.
7. **Leistungserbringer sind nicht durchgängig belegt.** [`data/contacts.json`](../data/contacts.json) kennt 6 Stellen, dieses Register nennt 16. Die zehn neuen (Logistik BBL, Produktion BBL, Publikationen BBL, Informatik BBL, Rechtsdienst BBL, HR BBL, Finanzen und Controlling BBL, Kommunikation BBL, Workspace BBL, Notfallorganisation BBL, Risikomanagement BBL, Fachstelle Beschaffungscontrolling) sind aus der Organisationslogik erschlossen, nicht aus einem Organigramm.

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

**Drei Einträge fallen aus dem Register** — sie sind nach der Aufnahmeregel keine bezugsfähigen Leistungen, sondern Inhalte bzw. Anwendungen:

| Bisher | Neuer Ort | Begründung |
|---|---|---|
| `portfolio-einsicht` | Anwendungen (`#/app/portfolio`) | Einsicht in ein Inventar, keine Leistung mit Ergebnis |
| `beschaffung-einstieg` | News und Wissen | Einstiegs- und Vorlagenseite; die eigentliche Leistung ist SVC-E-001 |
| `leistungsverrechnung` | News und Wissen | Preis- und Verrechnungsinformation, kein auslösbarer Vorgang |

**Offene Migrationsschritte** (bewusst noch nicht ausgeführt): `serviceId` in [`data/services.json`](../data/services.json) auf die neuen IDs umstellen, `processDefId` auf die `PRC-*`-Schlüssel angleichen, [`data/process-definitions.json`](../data/process-definitions.json) umbenennen, und die drei ausgeschiedenen Einträge in Anwendungen bzw. Wissen überführen. Die Routen (`#/services/<id>`) und die Deep-Links in [`js/pages/services.js`](../js/pages/services.js) hängen an diesen IDs.
