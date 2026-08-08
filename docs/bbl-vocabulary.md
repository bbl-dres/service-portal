# BBL-Vokabular — die echten publizierten Begriffe

Wortlaut aus den Veröffentlichungen des BBL. Kein erfundenes Fachwort. Wo das
BBL selbst uneinheitlich schreibt, steht das hier so — die Abweichung ist eine
Eigenschaft der Quelle, kein Fehler dieser Zusammenstellung.

Quellen: die 144 Bautendokumentationen unter
<https://www.bbl.admin.ch/de/bautendokumentationen>, die Projektmanagement-
Vorlagen unter <https://www.bbl.admin.ch/de/downloads-bauten> und die Weisung
`Bau 203d`. Rohmaterial in [`research/`](../research/README.md).

## 1. Bauwerkskategorien

Jedes Datenblatt trägt eine Kategorie mit Zahlencode. **Es sind drei
Systematiken im Umlauf, die nicht deckungsgleich sind.**

Aktuell (zweistellig):

| Code | Begriff |
|---|---|
| 01 | Wohnen |
| 02 | Bildung · *auch* Bildung und Forschung |
| 04 | Landwirtschaft und Parkanlagen |
| 05 | Technische Anlagen |
| 06 | Verwaltung · *auch* Regierung |
| 07 | Justiz |
| 10 | Kultur und Denkmäler |
| 12 | Sport · *auch* Freizeit, Sport und Erholung |
| 13 | Verkehrs- und Zollanlagen |
| 15 | Verschiedenes |
| 16 | Bauten im Ausland · *auch* Gebäude im Ausland |

Älter (Bauwerkstyp + `Hauptgruppe.Untergruppe`): `Bürobauten 6.05` ·
`Verwaltungsgebäude 06.06` · `Botschaftsgebäude 06.08` ·
`Produktionsbauten 03.07` · `Kulturzentren 10.05`

Dazu die Navigation der Website mit nochmals eigenen Bezeichnungen (Parlament
und Regierung · Justiz und Polizei · Zoll · Produktion und Lager …).

→ **Für ein Datenmodell:** der Code ist der stabile Schlüssel, die Beschriftung
variiert. Beides getrennt führen.

## 2. Flächen und Volumen (SIA 416)

Die vollständige, gültige Liste stammt aus dem BBL-Formular
`K1P31 F07d Grundgrössen und Kennzahlen` (19.08.2025):

| Abk. | Begriff |
|---|---|
| GF | Geschossfläche |
| NGF | Nettogeschossfläche |
| NF | Nutzfläche |
| HNF | Hauptnutzfläche |
| NNF | Nebennutzfläche |
| FF | Funktionsfläche |
| VF | Verkehrsfläche |
| BUF | Bearbeitete Umgebungsfläche |
| GV | Gebäudevolumen |
| VMF | Vermietbare Fläche (SIA 0165) |

Das BBL führt **zusätzlich DIN 277** für die Nutzungsaufteilung:
`HNF 1 Wohnen und Aufenthalt` · `HNF 2 Büroarbeit` · `HNF 3 Produktion` ·
`HNF 4 Lagern, Verteilen, Verkaufen` · `HNF 5 Bildung, Unterricht, Kultur` ·
`HNF 6 Heilen, Pflegen` · `NNF 7` · `FF 8` · `VF 9` · `BUF 10`

Ältere Datenblätter nennen **SIA 116** (überholte Volumennorm) neben SIA 416 und
drucken beide: `Rauminhalt SIA 116` neben `Gebäudevolumen SIA 416`. Ein
Bestandsmodell muss beide vertragen.

## 3. Kosten — Baukostenplan BKP

| BKP | Begriff (Schreibweisen wie gedruckt) |
|---|---|
| 0 | Grundstück |
| 1 | Vorbereitung · Vorbereitungsarbeiten |
| 2 | Gebäude |
| 3 | Betriebseinrichtungen · Betriebseinrichtung |
| 4 | Umgebung · Umgebungskosten |
| 5 | Baunebenkosten |
| 6 | Nutzerspezifika · Mieterspezifischer Ausbau · Kunst am Bau · Telekommunikation |
| 8 | Unvorhergesehenes · Teuerung |
| 9 | Ausstattung |

Untergruppen zu BKP 2: `20 Baugrube` · `21 Rohbau 1` · `22 Rohbau 2` ·
`23 Elektroanlagen` · `24 HLKK` (auch HLKKS / CVS / Heizung, Lüftung, Klima) ·
`25 Sanitäranlagen` · `26 Transportanlagen` (auch Aufzüge) · `27 Ausbau 1` ·
`28 Ausbau 2` · `29 Honorare`

Summenzeilen heissen `Anlagekosten`, `Anlagekosten BKP 1 – 9`,
`Total Anlagekosten BKP 1-9`, `Gesamtkosten`.

Planerpositionen (aus `Leistungsbeschrieb Generalplaner`): `290 Gesamtleitung und
Architekt` · `292 Bauingenieur` · `293 Elektroingenieur` · `294 HLKS-Ingenieur` ·
`296.1 Brandschutz- und Sicherheitsplaner` · `296.2 Bauphysiker` ·
`296.3 Lichtplaner` · `297 Gebäudeautomationsingenieur`

## 4. Phasen — SIA 112, wie das BBL sie anwendet

| Phase | Teilphase | Begriff |
|---|---|---|
| 3 | | **Projektierung** |
| | 31 | Vorprojekt |
| | 32 | Bauprojekt |
| | 33 | Bewilligungsverfahren |
| 4 | | **Ausschreibung** |
| | 41 | Ausschreibung, Offertvergleich, Vergabeantrag |
| 5 | | **Realisierung** |
| | 51 | Ausführungsprojekt |
| | 52 | Ausführung |
| | 53 | Inbetriebnahme, Abschluss |

Kostengenauigkeit je Phase — mit den vom BBL geforderten Graden:

| Begriff | Phase | Genauigkeit |
|---|---|---|
| Kostengrobschätzung | Lösungsmöglichkeiten | ± 20 % |
| Kostenschätzung | Vorprojekt (31) | ± 15 % |
| Kostenvoranschlag | Bauprojekt (32) | ± 10 % |
| revidierter Kostenvoranschlag | nach Projektänderung | — |
| Bauabrechnung | Projektabschluss | — |

## 5. «Geschäftsfall Bauprojekt» — der eigene Prozess des BBL

Aus `K1P70_C20d`. Das BBL schreibt selbst: *«Das BBL arbeitet
prozessorientiert.»* Zwei Bahnen (**Planung**, **Ausführung**), 18 Schritte,
fünf Rollenspuren. **Das ist die realitätsnächste Vorlage für die
Prozessdefinitionen dieses Portals** (`data/process-definitions.json`).

| Nr. | Schritt | Spur |
|---|---|---|
| 1a | Bedürfnis / Antrag | Benutzerorganisation BO |
| 1b | Bedürfnis IM | BBL / Immobilienmanagement |
| 1c | Entscheid | GS |
| 2 | Antrag an BBL | GS |
| 3 | Entscheid Bau (Bedürfnisüberprüfung) | BBL / IM |
| 4 | Auslösung | BBL / Projektmanagement |
| 5 | Vorstudien, Wettbewerb | BBL / PM |
| 5a | Projektierungsauftrag | BBL / IM |
| 6 | Auftrag an Planer | BBL / PM |
| 7 | Vorprojekt und Bauprojekt | BBL / PM |
| 8 | Projektdokumente | BBL / PM |
| 9 | Realisierungsauftrag | BBL / IM |
| 9a | Einverständnis BO | BO |
| 10 | Bewilligungsverfahren | BBL / PM |
| 11 | Ausschreibung | BBL / PM |
| 12 | Ausführungsprojekt | BBL / PM |
| 13 | Ausführung | BBL / PM |
| 14 | Abnahme | BBL / PM |
| 15 | Übergabe an OM | BBL / PM |
| 16 | Übernahme BO | BO |
| 17 | Projektabschluss | BBL / PM |
| 18 | Auftragsabschluss | BBL / IM |

**Rollen:** `GS` Generalsekretariat · `IM` Immobilienmanagement ·
`PM` Projektmanagement · `KGM` Kaufmännisches Gebäudemanagement ·
`OM` Objektmanagement · `BO` Benutzerorganisation · `PL` Projektleiter ·
`BH` Bauherr · `AST` Auftragssteuerung

**Kernprozesse Bauten:** Immobilienmanagement → Projektmanagement →
Kaufmännisches Gebäudemanagement → Objektmanagement.

**Geschäftsblätter** (formale Freigabedokumente, von der BO zu unterzeichnen):
«Bedürfnis» · «Freigabe Umsetzung» · «Umsetzung» · «Projektabschluss»

Rechtsgrundlage durchgehend: **VILB** — Verordnung über das Immobilienmanagement
und die Logistik des Bundes vom 5. Dezember 2008.

## 6. Rollen in den Bautendokumentationen

Feldnamen im Impressum, mit Häufigkeit über 37 ausgewertete Datenblätter:

`Bauherrschaft` (37) · `Architektur` (36) · **`Nutzer`** (34) · `Fachplaner` (25) ·
`Landschaftsarchitektur` (11) · `Spezialisten` (8) · `Denkmalpflege` (5) ·
`Generalunternehmer` (5) · `Bauleitung` (4) · `Generalplaner` (4) ·
`Totalunternehmer` (2) · `Kunst am Bau` (2) · `Projektleiter Bauherr`

→ **Wichtig:** Das BBL sagt **`Nutzer`**, nicht «Bedarfsträger». Das Wort
«Bedarfsträger» kommt in keinem Datenblatt vor.

Fachplaner-Disziplinen: `Bauingenieur` (27) · `Elektroingenieur` (21) ·
`Bauphysik` (12) · `HLKKS-Ingenieur` (10) · `Sicherheit` (7) ·
`Fassadenplanung` (5) · `Brandschutz` · `Lichtplaner` · `Holzbauingenieur` · …

## 7. Nachhaltigkeit

Gültig ist `Bau 203d Weisungen betreffend die Standards für nachhaltiges Bauen`
vom **1. November 2025**; sie ersetzt die Minergie-Weisung von 2007. Grundsatz
im Wortlaut:

> «Das BBL verwendet den SNBS und den Klimapfad als Planungsgrundlage. Es
> projektiert und realisiert nach SNBS, Klimapfad sowie GI und berücksichtigt
> ergänzend und projektspezifisch das passende Minergie-ECO Label.»

Standards: `SNBS` (Standard Nachhaltiges Bauen Schweiz) · `Klimapfad` (SIA
390/1) · `GI` (Gutes Innenraumklima 2.0) · `Minergie` · `ECO`.
In den Datenblättern gedruckt: `SNBS Platin`, `MINERGIE-P-ECO®`,
`GI Gutes Innenraumklima®`, `Minergie-A`, `Minergie P`.

## 8. Dokumentkennungen

Schema: **`K1P<Prozess>_<Typ><Nr><Sprache>_<Titel>`**

Prozesse: `K1P31` Projektdokumentation · `K1P41` Beschaffung und Bauleitung ·
`K1P53` Projektabschluss · `K1P70` Finanzen · `K1P90` Fachberatung
Gebäudetechnik. Typen: `A` Anleitung · `C` Checkliste · `F` Formular ·
`M` Muster. Weisungen laufen separat als `Bau 2xxd`.

Benannte Artefakte, brauchbar für ein Dokumentenregister: `Baujournal` ·
`Bausitzungsprotokoll` · `Pendenzen- und Entscheidungsliste` · `Regieantrag` ·
`Prüfplan` · `Abnahmeprotokoll` · `Übergabe-/Übernahmeprotokoll` ·
`Projektabschlussdokumentation` · `Projektänderungsantrag` ·
`Leistungsprognose` · `Angebotsvergleich` · `Evaluationsbericht` ·
`Terminplan` · `Anlagedokumentation`

## 9. Offene Daten — Befund

**Das BBL veröffentlicht keine offenen Daten.** Gegen die Schnittstellen
geprüft, nicht bloss durchgeblättert:

- **opendata.swiss:** 175 Organisationen, **keine** für BBL, armasuisse oder
  eine Immobilienstelle des Bundes. Suche `Bundesbauten` → 1 Treffer, und das
  ist das Bundesarchiv (Stichwort-Zufall). `armasuisse` → 0.
- **geo.admin.ch:** 880 Ebenen, **keine** zu Bundesbauten oder -liegenschaften.
  Einziger Treffer auf «armasuisse» ist eine Naturschutzebene.
- **GWR/RegBL** ist offen, aber es ist **nicht** BBL-Datenbestand: alle Gebäude
  der Schweiz nach Adresse und Baumerkmalen — ohne Eigentumsdimension, ohne
  Projekt- und Kostendaten, ohne Bezug zu BBL-Objekten. Kein Ersatz.
- **EFV:** sieben CSV-Datensätze, reine Haushaltsaggregate, keine Immobilien.

→ Die 144 PDF-Datenblätter **sind** das Register. Es ist von Hand gepflegt und
maschinell nicht lesbar. Dass es keine offene Alternative gibt, ist selbst ein
Argument für dieses Portal.
