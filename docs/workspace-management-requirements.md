# Workspace Management — Anforderungen für den Entwurf

Auftrag dieses Dokuments: die **echten fachlichen Anforderungen** aus
`research/Workspace Management/` so aufbereiten, dass daraus ein visueller
Prototyp entworfen werden kann (oder mehrere Entwurfsrichtungen erkundet
werden können). Es ersetzt die Annahmen, auf denen die heutige Mockup-App
[`js/apps/workspace.js`](../js/apps/workspace.js) steht — sie trifft die
Anforderungen nur an einer einzigen Stelle (Grundriss mit Einfärbung), der Rest
ist erfunden.

Alles hier Beschriebene stammt aus den Quellen; wo etwas offen ist, steht das
ausdrücklich (Kapitel 9). Wo eine Zahl genannt wird, kommt sie aus einem
Dokument, nicht aus einer Schätzung.

---

## 1 Quellenlage

`research/` ist nicht im Git (siehe [`research/README.md`](../research/README.md)).
Die folgenden Dateien liegen unter `research/Workspace Management/`.

| Datei | Was sie beiträgt | Verlässlichkeit |
| --- | --- | --- |
| `Zielbild Workspacemanagement_V1.0.pdf` | **Die Anforderungsquelle.** V1.0 vom 30.10.2024, freigegeben durch Stv. Direktor Bauten und Vizedirektor Logistik. 7 gewichtete Anforderungen (Nr. 1–7), Systemgrenzen, Begriffsdefinitionen, Prozessbezüge zur Prozesslandkarte ERP IMMO. | freigegeben |
| `Multispace-Handbuch-de-v8.pdf` (103 S., Stand 31.10.2025) | **Der aktuelle Ausstattungsstandard.** 10 Module mit Sub-Modulen, Flächenrichtmassen, Elementlisten, Artikelnummern, Farbkonzept CD-Bund, Einrichtungsrichtlinien. | verbindlich; zwei Kapitel leer (s. u.) |
| `20250601_Multispace Handbuch.pdf` (149 S., Stand 6.1.2025) | **Vorgängerausgabe** mit 11 Modulen. Der Dateiname legt Juni 2025 nahe, das Dokument stammt aber vom 6.1.2025 (PDF-Erstelldatum 06.01.2025 gegenüber 30.10.2025 bei v8). Kapitel 5 unten beschreibt noch diese Ausgabe. | überholt, für den Abgleich älterer Pläne weiterhin nützlich |
| `SBIM-4870 _ SBIM-4873 _ Workspacemanagement Schulung_UAT.vtt` | **Der realste Beleg.** 77-Minuten-Schulung/UAT der real gebauten Lösung (Korasoft auf SAP): Klickpfad, Systemregeln, bekannte Fehler, und die ungelösten fachlichen Fragen im Originalton. | Ist-Zustand, Feb./Mrz. 2026 |
| `PDF-Druck-Anforderungen-BBL.pdf` | Detailanforderungen an die Planausgabe «Flächennachweis SIA 416» inkl. Mockups. | Soll-Spezifikation |
| `Handout BBL Möbelkatalog.docx` | CAD-Block-Konvention: Modul, Repräsentant, Möbel (Layer + Attribute). | verbindlich |
| `Template_V_0.9.3.xlsx` | Die heutige Arbeitsweise als Excel: Register `Module`, `Sub-Module`, `Standard Mobiliar` (Materialnummern, Einzelpreise), Mengengerüst je Geschoss (UG…8.OG). | Ist-Werkzeug |
| `12 ZFCU_Funktionale Spezifikation Customizing_WSM_Teil RE-FX.docx` | Datenmodell-Erweiterung: Arbeitsplatz als eigenes AO-Objekt, Möblierungsgrade, m²-Konditionen. | Spezifikation, v0.1 |
| `20251211 BIT PM-Customizing für NAW …docx` | Der Inventarauftrag in SAP PM: Auftragsart, Anwenderstatus der CAD-Planung, Wertkategorien, Materialarten. | Spezifikation |
| `Korasoft_Berechtigungen_WSM.pdf`, `Korasoft_Prepare_for_Cloud_Connection.pdf`, `Korasoft Draw Check + Sync tech Requirements.pdf` | Technischer Rahmen: Fiori-Apps, Cloud-CAD-Server, Berechtigungsobjekte. | Herstellerdoku |
| `21.03.03.01 Objekte ausstatten v0.914.pdf` | BPMN Ebene 5 «Objekte ausstatten». | Prozessmodell, in Bearbeitung |
| `CAD.V01-CAFM-Plan-DE.dwg`, `231220_BBL Module CAD Blocks.dwg`, `CAD.V02-Aussenparkplätze.dwg` | Musterplan und Modul-Blockbibliothek. | nicht ausgewertet (Binär) |
| `BBL Möblierung Auftrag.mp4` | Screencast des Möblierungsauftrags. | nicht ausgewertet |

**Zwei Lücken in der Primärquelle**, die für den Entwurf zählen: im Multispace
Handbuch sind die Kapitel **«Prozesse» (S. 146/147) und «Kostenkennwerte»
(S. 148/149) leere Seiten** — in beiden Fassungen. Es gibt also keinen
freigegebenen Kostenkennwert je Modul. Gleichzeitig gilt laut Handbuch:
**«Die Preise sind vertraulich zu behandeln.»**

---

## 2 Was Workspace Management fachlich ist

Aus dem Zielbild, Kapitel 3.2 — diese drei Begriffe sind **definiert und nicht
austauschbar**, der Entwurf muss sie auseinanderhalten:

1. **Raumplanung** — strategische Planung der Raumstruktur im Gebäude.
2. **Unterbringungsplanung** — Zuordnung einer *Organisationseinheit* zu Gebäude
   oder Gebäudeteil, auf Basis von 1.
3. **Belegungsplanung** — operative Umsetzung von 2.: Zuweisung von Arbeitsräumen
   oder -plätzen an Mitarbeitende oder Gruppen.

**Systemgrenze** (Zielbild 3.2): Workspace Management umfasst die
*tätigkeitsbasierte Planung, Ausstattung und Bewirtschaftung der
Multispace-Module*, in den Phasen strategische Planung, Vorstudien,
Projektierung, Ausschreibung, Realisierung und Bewirtschaftung.

**Prämissen** (Zielbild 3.2), die Entwurfsentscheide vorwegnehmen:

- Die AP-Module sind **fix** — sie werden nicht verschoben.
- Lifecycle der Module: **mindestens 15 Jahre**.
- Für Mobiliar genügt ein **Sachinventar** (kein Wertinventar).
- **Der Nutzer passt sich dem Gebäude an** — nicht umgekehrt.

Das Workspace Management ist Teil des Serviceportals («einmal gebaut, mehrfach
genutzt») und soll **gleichermassen dem BBL und dem ILBO dienen** — es ist kein
reines Innenwerkzeug und kein reines Kundenportal.

---

## 3 Rollen (Bedarfsträger)

Aus den Anforderungskapiteln des Zielbilds und aus dem UAT. Der Entwurf sollte
sich entscheiden, für wen die erste Fläche gebaut ist.

| Rolle | Kommt aus | Braucht |
| --- | --- | --- |
| **ILBO** (Immobilien-/Logistikbeauftragte der Nutzerorganisation) | Nr. 1, 3, 5, 6, 7 | Übersicht «was habe ich, wo, wie ausgelastet»; Bedarf melden; Ersatz auslösen |
| **Portfoliomanager Logistik** | Nr. 1, 5 | Auslastung, Desk-Sharing-Ratio, Bedarfssteuerung |
| **Immobilienportfoliomanager / Projektentwickler / Interne Vermietung** | Nr. 3 | Unterbringungs- und Vermietungsszenarien, Flächeneffizienz |
| **Umzugsplaner** | Nr. 4 | Möblierung je Fläche, Mengengerüst |
| **BBL Bauten / Logistik** | Nr. 2, 4 | Flächendaten zentral erfassen und mutieren |
| **Raumausstattung BBL** (im UAT: «Bernhard») | UAT | Möbelkatalog pflegen; Listen und Angebote statt Excel |
| **CAD-Planung / externe Planer** (im UAT: «Petra») | UAT, Handout | Plan zeichnen, prüfen, einlesen; massstäblich drucken |
| **FM BBL** | Nr. 7 | Reparatur-/Ersatzaufträge auf der Fläche auslösen |

---

## 4 Der reale Systemkontext

Wichtig für den Entwurf, weil er festlegt, **was ein Prototyp behaupten darf**.
Die Lösung besteht heute aus SAP S/4HANA (RE-FX + PM) mit Korasoft-Fiori-Apps
und einem CAD-Server in der Cloud. Der Klickpfad aus dem UAT:

```
Gebäude existiert (Nutzungsgebäude am technischen Platz)
  └─ Projekt Möblierung anlegen/pflegen   ← je GEBÄUDE, Pflichtfeld: Stichtag
       └─ Plan (DWG) hochladen            ← erzeugt Änderungsantrag + Vorschaubild
            └─ Sync-App
                 ├─ 1. AO-Struktur synchronisieren   (immer zuerst — auch wenn
                 │     sich nur Möbel ändern; die Möbel brauchen ihre AO-ID)
                 ├─ 2. Ermittlung Möblierung          (Testlauf, ändert nichts)
                 └─ 3. Sicherung Möblierung           (schreibt in den Auftrag)
                      └─ Inventarauftrag (SAP PM, IW33) — Vorgänge je Etage
                           └─ Auswertungen (grafisch + Tabelle + Excel-Export)
                                └─ PDF-Druck (Plot aus AutoCAD in der Cloud)
```

Regeln und Eigenheiten, die im UAT ausdrücklich fallen:

- **Ein Projekt je Gebäude. Nur ein offener Auftrag je Gebäude.** Ein zweites
  Geschoss zu einem späteren Stichtag schreibt in denselben Auftrag weiter.
- **Der Stichtag ist Pflicht** und steht auf jedem Ausdruck.
- **Modulrepräsentant**: das System zählt Module über den Repräsentanten-Block,
  nicht über Einzelmöbel. Im UAT zeigte die Ermittlung deshalb «2 neue Artikel»,
  obwohl 4 Möbelstücke neu waren (einer davon dreimal). Das hat im Test
  Verwirrung ausgelöst — **eine Zähl- und Beschriftungsfrage für den Entwurf.**
- **Farblogik kollidiert.** Grün/grau meint in der Sync-App «neu/unverändert»,
  gelb in der Auswertung «zu bestellen». Zitat aus dem UAT: *«Das ist wieder eine
  andere Farblogik.»* Die Fachvertretung hielt dagegen, dass Farbe in einem
  Architekturplan eine feste Bedeutung habe (Bestand / Neubau / Abbruch), und
  fragte ausdrücklich nach, wofür sie hier stehe. **Der Entwurf muss jede
  Einfärbung eindeutig benennen.**
- **Der Plot ist nicht der Screen.** Gedruckt wird immer die DWG aus dem
  Dokumenteninfosatz, in der Cloud geöffnet; die Einfärbung wird als Schraffur
  mitgeschickt. Bekannter Fehler: nach «Vollbereich» stimmt der Massstab nicht
  mehr (1:119 statt 1:100), Abhilfe nur per F5.
- **Varianten gibt es nicht.** Ein zweiter Entwurf überschreibt den ersten;
  vergleichen kann man nur zwei exportierte Listen nebeneinander. Zitat: *«das ist
  Steinzeit»*. Variantenplanung wäre grundsätzlich möglich, war aber nicht
  beauftragt.
- **Der Umfang ist bewusst beschnitten.** Zitat: *«wir haben das Verbot bekommen,
  nicht direkt in die Bestellung zu gehen. Es darf nur eine Liste sein.»* Der
  gelieferte Stand ist eine **Erstausstattungs-Liste**, keine Beschaffung, keine
  Kreislaufwirtschaft.

### Datenmodell-Anker (für konsistente Beschriftungen im Entwurf)

- **Architektonische Objekte**: Gebäude → Ebene → Raum (`54RM`) → **Arbeitsplatz
  (`57AP`)**, neu unterhalb des Raums, mit Funktion `AP01`; als
  Reservierungsobjekt mit Verfügbarkeit «Reservierbar» (RE-FX-Spezifikation).
- **Möblierungsgrad am Raum**: `MM11` möbliert einfach, `MM12` möbliert Standard,
  `MM13` möbliert repräsentativ (Merkmalsgruppe `MMMO`).
- **m²-Konditionen** `TQ31/32/33` — erfasst, aber noch keiner Konditionsgruppe
  zugeordnet: *«für das neue Mietermodell»*.
- **Inventarauftrag** SAP PM, Auftragsart `ZTU0` «BBL Bau Inventarauftrag»,
  Anwenderstatus **CAD-Planung in Arbeit / im Auftrag fertig / abgenommen /
  verworfen**, Wertkategorien Eigenleistung / Fremdleistung / Lagermaterial /
  Nichtlagermaterial / Sonstiges.
- **Materialarten**: `ZTN6` BBL Mobi/Hausrat/-dienst, **`ZTN9`
  BBL-Occasionsmaterial** — Occasion ist im Datenmodell bereits vorgesehen, im
  Handbuch ebenso («Ausstattungen werden in erster Linie mit Occasionsmobiliar
  geplant»), im gelieferten Workflow aber nicht sichtbar.
- **CAD-Blöcke** (Handout Möbelkatalog): `Block Module` auf Layer
  *MS_Möbel Umriss* mit Attribut OBJEKT-ID · `Block Repräsentant` auf Layer
  *MS_Möbel AP* mit MODUL + OBJEKT-ID + Artikelnummer (jedes Modul braucht genau
  einen) · `Block Möbel` auf Layer *MS_Möbel Detail*.

---

## 5 Der Ausstattungsstandard «Multispace»

Der inhaltliche Kern, den die heutige App gar nicht kennt. Jedes Modul ist
«eine funktionale und gestalterische Einheit»; ein Mix einzelner Modulelemente
**wird nicht empfohlen**.

> **Achtung Ausgabenstand.** Die Tabelle unten gibt die Ausgabe vom **6.1.2025**
> mit 11 Modulen wieder. Die aktuelle Ausgabe vom **31.10.2025** führt **10**
> Module: Modul 1 heisst «Standardarbeitsplatz», der Coffee Point ist kein
> eigenes Modul mehr, und die früheren Module 8–11 rücken auf 7–10 auf. Der
> Wissensbereich «Arbeitsplätze gestalten» (`js/knowledge-content.js`) folgt der
> aktuellen Ausgabe; die Fixture-Daten in `data/workspace-planning.json` tragen
> noch die alte Nummerierung.

| Modul | Sub-Module | Flächenrichtmass |
| --- | --- | --- |
| **1** Einzel Arbeitsplatz | — | **3.0 m²** |
| **2** Team Arbeitsplatz | 6 / 8 Personen | 25 / 35 m² |
| **3** Fokus Arbeitsplatz | 3.1 (2-/3-/¾-seitig umschlossen), 3.2 Einzelkoje | je 3.0 m² |
| **4** Formelle Sitzungen | 4.1.1/4.1.2 sitzend, 4.2.1/4.2.2 stehend, 4.5 Besprechungsbox 4er, 4.6 Besprechungsbox 2er | 16–25 m² (4/6/8 Pers.); Box 4er 9 m², 2er 4.5 m² |
| **5** Telefon-/Videokonferenzbox | 5.1 VK-Box 1er, 5.2 Telefonbox 1er | 4.5 m² / 2.0 m² |
| **6** Informelle Sitzungen | 6.1.1 stehend rechteckig, 6.1.2 stehend rund, 6.2 Besprechungskoje, 6.3 Sofa Kabine, 6.4 Sofa Lounge, 6.5 Sessel Lounge | 4–27 m² |
| **7** Coffee Point | 7.1 Tresen, 7.2 Esstisch, 7.3 Sitzbank, 7.4 Bistro, 7.5 Sofa Kabine, 7.6 Lounge | 3–9 m² |
| **8** Interaktive Sitzungen | 8.1 Auditorium, 8.2 Kreativraum, 8.3 Werkstatt | 65 / 30 / 30 m² |
| **9** Team Ablage | 9.1 offen, 9.2/9.3 geschlossen | — |
| **10** Locker, Garderoben | 10.1 Locker, 10.2 Garderobe, 10.3 Organizer | — |
| **11** Service Funktionen | 11.1 Entsorgungsstationen | — |

Dazu: **Freies Sortiment / Diverses** und «Standard Mobiliar» (rund 95 Artikel
mit Materialnummer und Einzelpreis im Excel-Template).

Die Werte stammen aus der Modulübersicht des Handbuchs. Einzelne Detailseiten
weichen davon ab (z. B. Modul 5.1: Übersicht 4.5 m², Detailseite 6.0 m²) — wo
der Entwurf eine Zahl zeigt, sollte er die Übersicht als Leitwert nehmen und die
Abweichung nicht stillschweigend glätten.

Jede Modulseite im Handbuch trägt dieselbe Struktur — **das ist die natürliche
Vorlage für eine Katalog-Detailseite**: Charakteristik · Umsetzungsrichtlinien ·
beispielhafter Grundrissausschnitt · Elementliste · Produkttabelle
(Produkt / Spezifikation / Masse / Artikelnummer) · Oberflächen & Farben ·
Produktbeispiele.

**Einrichtungsrichtlinien** sind räumliche Regeln, keine Deko — sie gehören in
den Entwurf, wenn er Layout-Beratung leisten will: Einzelarbeitsplätze immer
entlang der Fassade und rechtwinklig zum Tageslicht, Gruppen von höchstens vier
Tischen, Drehwinkel ≤ 10°; Boxen gleichmässig auf der Fläche verteilt und **nicht
in Fluchtwegen**; Coffee Point möglichst im Zentrum, Locker nahe Eingang und
Coffee Point; Ablage immer vom Korridor zugänglich, nie hinter dem Arbeitsplatz;
Auditorium **nur einmal pro Gebäude**; SECO-Richtlinien zu Abständen,
Verkehrsflächen und Fluchtwegen sind einzuhalten.

---

## 6 Anforderungen

Gewichtung wie im Zielbild: **M** Muss · **S** Soll · **K** Kann.
`Nr.` verweist auf die Anforderungsnummer im Zielbild.

### A — Datengrundlage und Analyse

| ID | Anforderung | G | Quelle |
| --- | --- | --- | --- |
| **WSM-A1** | Arbeitsstilanalyse als Ausgangspunkt: Erhebung zu Arbeitsprozessen, Büroraumumgebung, Technologienutzung und Change Readiness; Ergebnis sind ein bedarfsbasiertes Büroraumkonzept, ein Workplace-Change-Fahrplan und ein Ergebnisbericht mit Kennzahlen. | M (Prio 1) | Zielbild Nr. 1 |
| **WSM-A2** | Vorher-/Nachher-Vergleich derselben Kennzahlen (vor Einzug / nach Einzug) muss möglich sein. | M | Zielbild Nr. 1 |
| **WSM-A3** | Die Analyse muss auf allen Ebenen erhoben werden können (Sponsor, Management, Mitarbeitende) und Mehrheitsmeinungen statt Einzelmeinungen sichtbar machen. | S | Zielbild Nr. 1 |

### B — Layer 1a: Gebäudekubatur und Grundrissgeometrie

| ID | Anforderung | G | Quelle |
| --- | --- | --- | --- |
| **WSM-B1** | Zentrale Erfassung, Mutation und Bereitstellung aktueller Flächendaten **in allen Phasen**, für **alle Stakeholder** — eine Quelle, nicht mehrere Kopien. | M (Prio 1) | Zielbild Nr. 2 |
| **WSM-B2** | Grundriss je Ebene mit Raumpolygonen, Flächenart nach SIA 416, AOID, Fläche, Nutzungsart. | M | Nr. 2, PDF-Druck 5.3 |
| **WSM-B3** | Planstand und Gültigkeit sind sichtbar: Stichtag, Status der CAD-Planung (in Arbeit / im Auftrag fertig / abgenommen / verworfen), Datum des letzten Syncs. | M | PM-Customizing, UAT |
| **WSM-B4** | Der Plan-Import zeigt vor dem Schreiben, **was sich ändern wird** (Testlauf), mit Zählung neu / unverändert / gelöscht und eindeutiger Beschriftung der Einfärbung. | M | UAT |

### C — Layer 1b: Unterbringungsplanung und Vermietung

| ID | Anforderung | G | Quelle |
| --- | --- | --- | --- |
| **WSM-C1** | Zuordnung Organisationseinheit → Gebäude/Gebäudeteil auf Basis der Raumstruktur; Mieterspiegel je Ebene. | M (Prio 1) | Zielbild Nr. 3 |
| **WSM-C2** | **Planszenarien** müssen möglich sein, auch für die Vermietung — mehrere Varianten nebeneinander, nicht nacheinander. | M | Zielbild Nr. 3 |
| **WSM-C3** | Lösungsstrategie prüfen: Synergien und Flächeneffizienz je Szenario sichtbar (HNF je Person, Zuteilungsgrad, freie Fläche). | M | Zielbild Nr. 3 |
| **WSM-C4** | Bestehende Daten mehrfach nutzen — kein erneutes Erfassen für die Vermietung. | S | Zielbild Nr. 3 |

### D — Layer 2: Möblierung und Ausstattung

| ID | Anforderung | G | Quelle |
| --- | --- | --- | --- |
| **WSM-D1** | Zentrale Erfassung, Mutation und Bereitstellung der Daten zu Möblierung und Ausstattung **in der Körnigkeit «Module Multispace»**, in allen Phasen. | M (Prio 1) | Zielbild Nr. 4 |
| **WSM-D2** | Modulkatalog nach Handbuch: 11 Module mit Sub-Modulen, Flächenrichtmass, Personenzahl, Elementliste, Artikelnummern, Farb-/Materialvorgaben. | M | Handbuch, Excel |
| **WSM-D3** | Verortung: welches Modul steht in welchem Raum, auf welcher Ebene, in welchem Gebäude — und **wie oft**. | M | Nr. 4, Nr. 6 |
| **WSM-D4** | Auswertung **auf zwei Stufen**: Stufe Modul und Stufe Einzelmöbelstück. Wörtliche UAT-Anforderung. | M | UAT |
| **WSM-D5** | Mengengerüst je Geschoss (UG…8.OG) als Liste, exportierbar — das ersetzt `Template_V_0.9.3.xlsx`. | M | Excel, UAT |
| **WSM-D6** | Einrichtungsrichtlinien und SECO-Vorgaben sind am Modul abrufbar; Planungsfehler sollen dadurch früher auffallen (UAT-Wunsch: «nachmessen, ob SECO-konform geplant wurde»). | S | Handbuch, UAT |
| **WSM-D7** | Occasionsmobiliar ist als eigene Materialart geführt und in der Planung wählbar («Ausstattungen werden in erster Linie mit Occasionsmobiliar geplant»). | S | Handbuch, PM-Customizing |

### E — Layer 3: Nutzung und Auslastung (Space Utilisation Survey)

| ID | Anforderung | G | Quelle |
| --- | --- | --- | --- |
| **WSM-E1** | Belegung je Platz dokumentieren: **belegt / leer / kalt belegt**, samt Tätigkeit am Platz. Nicht nur feste Arbeitsplätze, sondern auch Besprechungszimmer, Meeting-Areas, Kaffeelounges, Think Tanks. | M (Prio 2) | Zielbild Nr. 5 |
| **WSM-E2** | Daraus **Belegungsgrad und Maximalauslastung bezüglich einer Desk-Sharing-Ratio** ableiten. | M | Zielbild Nr. 5 |
| **WSM-E3** | Elektronische Erhebung (Sensoren, RFID, Badges, Triangulation) als Datenquelle vorgesehen. | K | Zielbild Nr. 5 |
| **WSM-E4** | Single Source of Truth: dieselbe Auslastungszahl in Planung, Bewirtschaftung und Reporting. | M | Zielbild Nr. 5 |

### F — Assetmanagement / Inventar

| ID | Anforderung | G | Quelle |
| --- | --- | --- | --- |
| **WSM-F1** | Sachinventar der BBL-eigenen Ausstattung mit Zuordnung zu **Gebäude · Fläche · Nutzer · Raum**. Schnittstelle zum Assetmanagement ist «Muss». | M | Zielbild Nr. 6 |
| **WSM-F2** | Identifikation am Möbelstück (QR-Code oder RFID) mit Schnittstelle ins Workspace-Management-Tool. | S | Zielbild Nr. 6 |
| **WSM-F3** | Lifecycle je Modul (≥ 15 Jahre) planbar: Alter, Restnutzungsdauer, Ersatzbedarf, Second-Life/Entsorgung. | M | Zielbild Nr. 6/7 |
| **WSM-F4** | **Rollendes Inventar statt Momentaufnahme**: Historie über den Bestand — was ist neu, was besteht, was ist weg. Im UAT als der eigentliche Mehrwert erkannt («das wäre ein Dienstleistungszuwachs»). | S | UAT |

### G — Bewirtschaftungsprozesse

| ID | Anforderung | G | Quelle |
| --- | --- | --- | --- |
| **WSM-G1** | Ersatz- und Ergänzungsbeschaffung sowie Reparaturaufträge **direkt auf der Fläche** auslösen, insbesondere für unpersönliche Arbeitsplätze. | K (Prio 2) | Zielbild Nr. 7 |
| **WSM-G2** | Proaktive Planung: Finanzplanung, Beschaffungsplanung, Second-Life-/Entsorgungsplanung. | K | Zielbild Nr. 7 |
| **WSM-G3** | Kostenoptimierung durch Verständnis von Raumgrössen und -auslastung. | K | Zielbild Nr. 7 |
| **WSM-G4** | **Angebot statt Excel**: aus dem Mengengerüst ein Angebot an Projekt/Mieter erzeugen — «welche Kosten sind für das Mobiliar zu budgetieren». Ausdrücklicher Wunsch der Fachseite, heute Handarbeit in Excel. | S | UAT |

### H — Planausgabe «Flächennachweis SIA 416»

Vollständig spezifiziert in `PDF-Druck-Anforderungen-BBL.pdf`; gilt für
Grundrisspläne und wird **Beilage zu Verkaufsdokumentationen und Verträgen mit
Dritten**.

| ID | Anforderung | G |
| --- | --- | --- |
| **WSM-H1** | Report heisst **«Flächennachweis SIA 416»** (nicht mehr «Bemessungsart nach DIN 277»). | M |
| **WSM-H2** | Formate A4 und A3, je hoch und quer — **und sonst keine**. | M |
| **WSM-H3** | Massstab wählbar 1:100 / 200 / 250 / 500 / 750 / 1000 / 1250 / 1500, dazu «gesamter Grundriss» mit automatischer Skalierung und ausgewiesenem Massstab (z. B. 1:427). Bei mehreren Geschossen **derselbe Massstab über alle Geschosse**. Druckbereich frei mit der Maus aufziehbar. | M |
| **WSM-H4** | **Keine anonymen Pläne**: Plankopf und Legende sind nicht abwählbar. | M |
| **WSM-H5** | Plankopf: Bez. Arch. Objekt (Gebäude) · Identifikation AO · Bez. Ebene · Freitext · Massstab · Druckdatum; Bundeslogo nach CD-Bund. Die Objektbezeichnung soll vor dem Druck überschreibbar sein. | M / S |
| **WSM-H6** | Legende: **pro Flächenart eine fest zugewiesene Farbe nach BBL-Vorgabe** (heute individuell vergeben); Reportname über der Farblegende; darunter GF Geschossfläche, NGF Nettogeschossfläche, KF Konstruktionsfläche der Ebene; je Eintrag Text, Fläche in m² **und Anzahl** — Beispiel: `HNF 2.2 Grossraumbüros (2'272.18 m² / 31 St.)`. Kein Rahmen um die Legende. | M |
| **WSM-H7** | Raumstempel dreizeilig: `Kurzbez. – Bez.ArchObj` / `SIA-416 – Fläche` / `AOID` — Beispiel `03.223 – Gruppenbüro gross` / `61.87 m2` / `8082.MO.03.223`. | M |
| **WSM-H8** | Layer-Auswahl in der Ausgabe: Architektur, Text, Raumstempel, Raumpolygon und Abzugsflächen werden **schwarz, Linienstärke 0.00** gedruckt; HLKE, Schraffur, Achsen, Bemassung, Referenzpunkt, Geschosspolygon **nicht**. | M |

---

## 7 Welche Lücken der frühere Kapazitäts-Mockup zeigte

Die frühere Fassung von [`js/apps/workspace.js`](../js/apps/workspace.js) zeigte:
Gebäudewahl · vier Kennzahlen · ein «Planungsszenario» (Mitarbeitende ×
Desk-Sharing-Faktor) · eine Geschosstabelle · den Grundriss mit drei
Einfärbungen und einem Raum-Panel. Die Portalumsetzung vom 7. August 2026
adressiert davon den Objekt-, Projekt-, Auftrags- und Lesekontext. Die übrigen
Punkte bleiben Anforderungen an Plan-Editor und Planprüfung.

| Befund | Warum es die Anforderung verfehlt |
| --- | --- |
| **Multispace-Module kommen nicht vor.** Kein Modul, kein Sub-Modul, kein Möbelstück, kein Artikel. | Das ist Layer 2 und damit **Anforderung Nr. 4, Prio 1, Muss** — und der eigentliche Gegenstand des Fachgebiets (WSM-D1…D7). Ohne Module ist es Flächenmanagement, nicht Workspace Management. |
| **Kein Projekt, kein Auftrag, kein Stichtag.** Die App kennt keinen Planungsstand und keine Zeitachse. | Projekt je Gebäude + Stichtag sind die Klammer der realen Lösung; ohne sie gibt es weder Historie (WSM-F4) noch Nachvollziehbarkeit (WSM-B3). |
| **Der Desk-Sharing-Rechner ist rückwärts gerechnet.** `state.people = workplaceCount / factor` — die App leitet den Personalbestand aus den Arbeitsplätzen ab und prüft dann, ob die Arbeitsplätze für diesen Bestand reichen. Das Ergebnis ist konstruktionsbedingt «ausgeglichen». | Anforderung ist die umgekehrte Richtung: aus Bedarf und Auslastung (SUS, WSM-E2) die nötige Fläche und Modulmenge ableiten. |
| **Auslastung ist nicht erhoben.** «Arbeitsplatzdichte» ist m²/Arbeitsplatz aus `floorplan.js`, keine Nutzungsmessung. | WSM-E1 verlangt belegt / leer / **kalt belegt** je Platz samt Tätigkeit — auch für Sitzungs- und Lounge-Flächen. |
| **Kein Inventar, keine Identifikation, kein Lifecycle.** | WSM-F1…F3; die Schnittstelle zum Assetmanagement ist «Muss». |
| **Keine Szenarien / Varianten.** Ein Zustand, ein Ergebnis. | WSM-C2 verlangt Planszenarien; im UAT ist genau das die schmerzhafteste Lücke der echten Lösung. |
| **Keine formelle Planausgabe.** Die Portalvorschau kann den sichtbaren Grundriss drucken; Flächennachweis, Massstab, Beilagen und Plankopf fehlen bewusst. | WSM-H1…H8 sind vollständig spezifiziert und gehen an Dritte. |
| **Rollen fehlen.** Eine Sicht für alle. | ILBO, Portfoliomanager, Umzugsplaner, CAD-Planung und FM brauchen unterschiedliche Einstiege. |
| **Was trägt:** Grundriss als Inline-SVG mit Einfärbung, Legende mit Σ m², Raumauswahl, Geschosswechsel ([`js/ui/floorplan.js`](../js/ui/floorplan.js)). | Bleibt — der SIA-416-Modus liegt bereits vor und ist genau der Report aus WSM-H6. |

---

## 8 Entwurfsauftrag

### 8.1 Was zu entwerfen ist

Mindestens diese Flächen; die Aufteilung auf Seiten/Dialoge ist Teil des Entwurfs:

1. **Einstieg / Objektwahl** — Gebäude, Ebene, Stichtag, Planstand. Beantwortet
   «wo stehe ich und wie aktuell ist das, was ich sehe».
2. **Plan als Arbeitsfläche** — Grundriss mit umschaltbaren Auswertungen
   (SIA 416 · Nutzung · Verwaltungseinheit · **Multispace-Modul** · Möblierungsgrad
   · Auslastung · Möbelstatus). Legende mit m² **und Stückzahl** je Kategorie.
3. **Modulkatalog** — 11 Module, Sub-Module, Flächenrichtmass, Elementliste,
   Richtlinien. Detailseite nach dem Aufbau der Handbuchseite (Kapitel 5).
4. **Mengengerüst / Ausstattungsliste** — je Gebäude, je Geschoss, auf Stufe Modul
   **und** Stufe Einzelmöbel, mit Status je Position, exportierbar.
5. **Szenario / Variante** — zwei oder mehr Belegungs-/Möblierungsentwürfe
   nebeneinander, mit Flächen-, Mengen- und (rollenabhängig) Kostenvergleich.
6. **Bedarf und Auslastung** — SUS-Ergebnisse: belegt/leer/kalt belegt,
   Desk-Sharing-Ratio, Bedarf gegen Bestand.
7. **Inventar / Lifecycle** — Bestand mit Verortung, Alter, Ersatzbedarf,
   Occasion/Second Life.
8. **Planausgabe** — Druckdialog mit Format, Massstab, Ausschnitt, Freitext, und
   eine Vorschau des Flächennachweises SIA 416 (Plankopf + Legende).

### 8.2 Zustände, die gezeigt werden müssen

Der Entwurf ist erst brauchbar, wenn er auch die unangenehmen Fälle zeigt:

- Plan **noch nicht synchronisiert** / Sync mit Fehlern.
- **Testlauf-Ergebnis** vor dem Schreiben: X neu, Y unverändert, Z entfällt.
- Auftrag **offen** vs. abgeschlossen; zweiter Stichtag auf demselben Auftrag.
- Modul **unvollständig** (Repräsentant fehlt, Artikelnummer unbekannt) — im UAT
  ein realer Fall: der Katalog enthielt nur Artikel, zu denen eine Nummer im PDF
  gefunden wurde.
- **Keine Berechtigung** für Kosten/Preise (siehe 8.4).
- Fläche **ohne Modulzuordnung** (Bestand vor Multispace).

### 8.3 Vorhandene Bausteine im Prototyp

Wiederverwenden statt neu erfinden — der Entwurf soll sich daran anlehnen:

- [`js/ui/floorplan.js`](../js/ui/floorplan.js) — SVG-Grundriss, Einfärbemodi
  (`none · use · sia · ve · capacity`), Legende mit Σ m², Raumauswahl.
- `C.catalogueBar` — die geteilte Katalogleiste (Suche + Anzahl | Sortieren ·
  Filtern · Ansichtswechsel), bereits auf vier Katalogansichten.
- [`js/ui/spatial-tree.js`](../js/ui/spatial-tree.js) — Strukturbaum Land/Region/Stadt/Objekt.
- [`js/ui/dashboard-chrome.js`](../js/ui/dashboard-chrome.js) — KPI-Kacheln, Filterpanel.
- Daten: [`data/spaces.json`](../data/spaces.json) (728 Räume mit `sia`, `useLabel`,
  `area`, `capacity`, `occupierVe`, `bookable`, `rect`),
  [`data/floors.json`](../data/floors.json) (29 Geschosse mit `areaGross`, `areaHnf`,
  `rooms`, `extent`), `buildings.geojson`.

**Was fehlt und neu erfunden werden muss**: Modulkatalog, Möbelartikel,
Ausstattungspositionen je Raum, Projekt/Auftrag/Stichtag, SUS-Messwerte,
Inventarpositionen. Der Modulkatalog lässt sich **mit echten Werten** aus
Kapitel 5 aufbauen (Modulnummern, Bezeichnungen, Flächenrichtmasse,
Personenzahlen, Elementlisten) — das ist der Teil, der nicht erfunden werden
muss und darum auch nicht erfunden werden sollte.

### 8.4 Harte Randbedingungen

- **Preise sind vertraulich** (Handbuch, wörtlich). Im Prototyp keine echten
  Einzelpreise aus `Template_V_0.9.3.xlsx`. Kosten nur als rollenabhängige,
  erkennbar erfundene Grössenordnung — oder als Platzhalter.
- **Es gibt keine freigegebenen Kostenkennwerte je Modul** (Kapitel «Kostenkennwerte»
  im Handbuch ist leer). Wer im Entwurf einen Modulpreis zeigt, muss ihn als
  Annahme kennzeichnen.
- **CD-Bund** gilt für Farbkonzept, Plankopf und Bundeslogo; das Farbkonzept des
  Mobiliars ist verpflichtend.
- **Die Farbe darf nicht doppelt belegt sein.** Plan-Einfärbung (Auswertung),
  Änderungsstatus (neu/unverändert/gelöscht) und Bestellstatus sind drei
  verschiedene Aussagen — im heutigen System kollidieren sie und haben im UAT
  nachweislich Verständnisfehler erzeugt.
- **Deutsch**, Ausdrücke aus dem Vokabular des Hauses (ILBO, HNF, NGF, AOID,
  Modul, Sub-Modul, Stichtag, Mengengerüst, Flächenrichtmass).
- Prototyp bleibt **abhängigkeitsfrei** (Vanilla, Inline-SVG statt WebGL —
  Begründung in [`js/ui/floorplan.js`](../js/ui/floorplan.js)).

### 8.5 Entwurfsrichtungen zum Erkunden

Drei Richtungen mit unterschiedlicher Antwort auf die Frage «was ist das
Rückgrat der Anwendung». Sie schliessen sich aus; eine davon zu wählen ist der
eigentliche Entwurfsentscheid.

**Richtung A — «Der Plan ist die Anwendung.»**
Ein Grundriss füllt die Fläche, alles andere ist Werkzeug daran: Ebenenwechsel,
Auswertungsmodi, Selektion → Detailspalte, Druck. Module und Möbel erscheinen
als Objekte *im* Plan, das Mengengerüst als aufklappbare Liste darunter.
*Stark*, weil es der Arbeitsweise von CAD-Planung und Raumausstattung entspricht
und die Planausgabe (WSM-H) natürlich integriert. *Risiko*: für ILBO und
Portfoliomanagement, die nie einen Plan zeichnen, ist es die falsche Einstiegstür.

**Richtung B — «Projekt und Stichtag sind das Rückgrat.»**
Einstieg über das Möblierungsprojekt je Gebäude: Stichtag, Planstand, offener
Auftrag, Positionen, Historie. Der Plan ist eine Ansicht des Projekts, nicht
umgekehrt.
*Stark*, weil es die reale Systemlogik abbildet, das rollende Inventar (WSM-F4)
sichtbar macht und die Frage «was ist neu, was ist weg» beantwortet — die im UAT
als eigentlicher Mehrwert erkannt wurde. *Risiko*: SAP-Vokabular («Auftrag»)
schlägt auf die Oberfläche durch; im UAT hat genau dieser Begriff die
Fachvertreter irritiert (*«was ist ein Auftrag? Diese Definition fehlt ja
offenbar»*).

**Richtung C — «Bedarf → Modulmix → Fläche.»**
Ein Planungswerkzeug: Organisationseinheit, Personalbestand, Tätigkeitsprofil und
Desk-Sharing-Ziel ergeben einen Modulmix nach Handbuch mit Flächenbedarf; dieser
wird gegen die verfügbare Fläche geprüft und als Angebot/Mengengerüst ausgegeben.
*Stark*, weil es Zielbild Nr. 1, 3 und 4 zusammenführt und den ausdrücklichen
Wunsch «Angebot statt Excel» (WSM-G4) trifft. *Risiko*: die Datengrundlage dafür
(Arbeitsstilanalyse, SUS) existiert heute nicht — der Entwurf müsste sie
mitentwerfen.

Empfehlung für die erste Runde: **A und C nebeneinander entwerfen** — sie
adressieren die beiden Rollenlager (Planung/Ausführung vs. Bedarf/Portfolio) und
machen den Zielkonflikt sichtbar. B lässt sich in beide als Zeitachse einziehen.

### 8.6 Woran der Entwurf gemessen wird

1. Ein ILBO erkennt in unter einer Minute, **was in seinem Gebäude steht** und
   wo es steht.
2. Die Modulkörnigkeit ist durchgehend: jede Zahl lässt sich von der Fläche über
   das Modul bis zum Einzelmöbel und zurück verfolgen (WSM-D4).
3. Jede Farbe im Plan hat genau eine Bedeutung, und die Legende benennt sie.
4. Der Stichtag ist auf jeder Fläche und jedem Ausdruck ablesbar.
5. Zwei Varianten sind nebeneinander vergleichbar, ohne zu exportieren.
6. Der Flächennachweis SIA 416 sieht aus wie die Mockups in
   `PDF-Druck-Anforderungen-BBL.pdf`, Kapitel 6.1.1 / 6.2.1.
7. Kein erfundener Preis steht ohne Kennzeichnung auf dem Schirm.

---

## 9 Offene Entscheide

Aus dem UAT — **ungelöst**, und für den Entwurf relevant, weil er sie entweder
umgeht oder eine Haltung dazu einnimmt.

| Frage | Stand |
| --- | --- |
| **Wann wird der Inventarauftrag geschlossen?** | Nie diskutiert. Fachseite tendiert zu «gar nicht» → rollendes Inventar. Korasoft: schliessen, sobald Kreislaufwirtschaft beginnt (Rücknahmen). |
| **Datenbank oder Arbeitsdokument?** | Wörtlich offen: *«Ist es jetzt eine reine Datenbank oder ist es ein Arbeitsdokument?»* Die Fachseite sieht den Nutzen nur im zweiten Fall. **Das ist die zentrale Produktfrage.** |
| **Variantenplanung** | Technisch möglich, nicht beauftragt. Heute nur Überschreiben + zwei Excel-Listen. |
| **Kreislaufwirtschaft / Rücknahme** | Ausdrücklich vertagt. Handbuch beschreibt Rückschub, Occasion und Wiederverwendung ausführlich — im Werkzeug fehlt sie. |
| **Weg zur Bestellung** | Untersagt («es darf nur eine Liste sein»). Wunsch der Fachseite: Angebot ans Bauprojekt, Stufe Modul und Einzelmöbel. |
| **Erstausstattung — wann endet sie?** | *«Wann hört die Erstausstattung auf im Gebäude?»* Unbeantwortet. Kleinere Umbauten mit Wandänderungen kommen vor. |
| **Umgang mit dem Modulrepräsentanten in der Zählung** | Systemlogik zählt Artikel, nicht Stücke; hat im Test verwirrt. Beschriftungsfrage. |
| **Massstab-Fehler im Druck** | Aufgenommen, Behebung zum Testende nicht zugesichert. |
| **Kostenkennwerte je Modul** | Kapitel im Handbuch leer. Ohne sie kein belastbares Angebot. |

---

## 10 Glossar

| Begriff | Bedeutung |
| --- | --- |
| **ILBO** | Immobilien- und Logistikbeauftragte(r) der Nutzerorganisation; Hauptgegenüber des BBL |
| **NAW** | Neue Arbeitswelten |
| **Multispace-Modul** | Standardisierte, funktional und gestalterisch abgeschlossene Ausstattungseinheit (M1–M11) |
| **Modulrepräsentant** | Der CAD-Block, über den das System ein Modul erkennt und zählt |
| **AO / AOID** | Architektonisches Objekt bzw. dessen eindeutige ID (Gebäude → Ebene → Raum `54RM` → Arbeitsplatz `57AP`) |
| **HNF / NGF / GF / KF** | Hauptnutz-, Nettogeschoss-, Geschoss-, Konstruktionsfläche (SIA 416) |
| **Flächenrichtmass** | Richtwert der Fläche je Modul bzw. je Person im Modul |
| **Mengengerüst** | Stückliste der Module/Möbel je Geschoss und Gebäude |
| **Stichtag** | Gültigkeitsdatum eines Planungs-/Möblierungsstands; Pflichtfeld |
| **SUS** | Space Utilisation Survey — Erhebung von Belegung und Tätigkeit je Platz |
| **Kalt belegt** | Platz ist belegt/besetzt zugewiesen, aber nicht genutzt |
| **Desk-Sharing-Ratio** | Arbeitsplätze je Person |
| **PZS / ProLeMo** | Prozesszuständigkeit bzw. Prozess- und Leistungsmodell (CRB) |
| **Occasionsmobiliar** | Gebrauchtmobiliar aus dem BBL-Kreislauf (Materialart `ZTN9`) |
