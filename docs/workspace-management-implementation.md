# Workspace Management — Umsetzungsplan

Stand: 7. August 2026

## Anwendungsgrenzen

Die Wireframes beschreiben drei Anwendungen mit gemeinsamer Datenbasis, aber unterschiedlichen Aufgaben und Nutzungskontexten:

1. **Workspace Management Portal** — Objekte finden, Projekt- und Auftragskontext verstehen, Planstände und Mengengerüste einsehen, Bestandsgrundrisse schreibgeschützt als Vorschau prüfen und Prozesse starten.
2. **Plan-Editor / Viewer** — Grundrisse in einer spezialisierten Vollbild-Arbeitsumgebung betrachten und bearbeiten, Räume und Ausstattung selektieren sowie Attribute pflegen.
3. **Planprüfung** — DWG/DXF übernehmen, Regeln prüfen, Befunde bearbeiten und den geprüften Plan freigeben.

Die drei Anwendungen erhalten eigene Route-Module und eigene Lebenszyklen. Sie teilen stabile Schlüssel (`buildingId`, `floorId`, Projekt-/Auftrags-ID) und fachliche Daten, aber weder DOM noch UI-Zustand. Das Portal darf die bestehenden, auch im Mietendenportal verwendeten Grundrisskomponenten für eine schreibgeschützte Vorschau einbetten: Geschoss wechseln, einfärben, Räume auswählen, Vollbild und Drucken sind reine Leseinteraktionen. Geometrie oder Ausstattung ändern, Planversionen speichern und Regeln prüfen bleiben ausschliesslich den beiden spezialisierten Anwendungen vorbehalten.

## Schritt 1 — Portal (umgesetzt)

- Bestehendes `#/app/workspace` vom eingebetteten Kapazitätsrechner zum Objekt- und Prozessportal umbauen.
- Galerie, Liste und Karte sowie räumlichen Standortbaum und URL-reproduzierbare Suche/Filter bereitstellen.
- Objektdetail mit Projekt, Auftrag, Stichtag, Kennzahlen und Liegenschaften-Inventar-Verknüpfung umsetzen.
- Den geteilten Objekt-Hero aus dem Mietendenportal unverändert wiederverwenden: bei mehreren Bildern als Mosaik mit Standortkarte, bei nur einem kanonischen Bild ohne leere Galeriekacheln als breite Bild-/Kartenkomposition.
- Register `Übersicht`, `Grundrisse` und `Ausstattung` mit Tabellen und ehrlich bezeichnetem Export der aggregierten Planannahmen bereitstellen.
- Aus der Grundrisstabelle eine schreibgeschützte Vorschau mit teilbarem `floor`-/`color`-/`space`-Zustand, Raumdaten, Vollbild und Plandruck öffnen; dafür dieselben `floorplan.js`-Muster wie das Mietendenportal wiederverwenden.
- Den Plan-Editor als eigene, in einem neuen Fenster geöffnete Folgeanwendung verlinken; die noch nicht umgesetzte Planprüfung klar bezeichnet und deaktiviert ausweisen. Schreib- oder Prüflogik wird nicht in das Portal eingebettet.
- Workspace-spezifische Planung als kleinen Overlay-Bestand an den bestehenden Golden Record hängen; keine Adressen, Bilder, Koordinaten oder Grundrissgeometrie duplizieren.

## Schritt 2 — Plan-Editor / Viewer (umgesetzt)

- Eigenes, loginpflichtiges Route-Modul `#/app/floorplan-editor` mit Standalone-Layout und kompaktem Vollfenster-Chrome umgesetzt. Objekt und Geschoss werden aus Portal-Aktionskarte beziehungsweise Portalvorschau übernommen; der Rücksprung führt in dieselbe schreibgeschützte Vorschau.
- Lesemodus mit Gebäude-/Geschosswechsel, durchsuchbarem und mit der Einfärbung synchronisiertem Ressourcenbaum, technischer 2D-Planfläche, Raum-/Objektauswahl, Inspektor, Schwenken, Zoomen, Auswahl-Einpassen, dynamischem Massstab, Strecken-/Flächenmessung und Druck umgesetzt. Objekt, Geschoss, Einfärbung, Auswahl, 2D-/3D-/Begehungsansicht und Bearbeitungsmodus sind als validierter URL-Zustand reproduzierbar. Die 3D- und Begehungsansichten verwenden bewusst das im Wireframe gelieferte Referenzbild und bezeichnen sich als nicht aus dem gewählten Plan berechnete Feedback-Zustände.
- Bearbeitungsmodus mit Produkt- und Modulbibliothek, Platzierungsvorschau, Platzieren, Ziehen, Drehen und Entfernen von Ausstattungsobjekten, editierbaren Raumattributen sowie begrenztem Rückgängig-/Wiederholen-Verlauf umgesetzt. Für das Testen der Strukturinteraktion lassen sich rechteckige Flächen lokal anlegen, verschieben und über acht Kanten-/Eckpunkte oder Zahlenwerte skalieren; dies ist keine CAD-Topologie. Tastaturbedienung, Statusansagen und Warnungen vor dem Verwerfen ungespeicherter Änderungen gehören zum gleichen Interaktionsvertrag.
- Die Anwendung bezieht Gebäude, Geschosse, Räume, Workspace-Planungsmetadaten und Shop-Produkte aus dem bestehenden Kernbestand. Sie erzeugt daraus ein abgelöstes Editor-Dokument; illustrative Startplatzierungen sind ausdrücklich Prototypannahmen und keine Inventardaten.
- Speichern legt nach strikter Schema-, Schlüssel-, Revisions- und Geometrievalidierung ausschliesslich eine geschossbezogene Browser-Arbeitskopie in `localStorage` ab. «Veröffentlichen» erzeugt für den Usability-Test zusätzlich eine unveränderliche, lokal nummerierte Momentaufnahme und einen sichtbaren Versionsverlauf. Dialog, Statuszeile und Verlauf weisen ausdrücklich darauf hin, dass dies keine gemeinsame oder freigegebene Version ist. Der kanonische Bestand wird weder direkt verändert noch durch eine scheinbare Backend-Synchronisation überschrieben.
- Autorenfunktionen verwenden mit `floorplan-editor-canvas.js` und `floorplan-editor-model.js` eine eigene Planfläche und ein eigenes Dokumentmodell. `floorplan-editor-repository.js` kapselt als austauschbarer Adapter die einzige Browser-Persistenz. Die stabilen, schreibgeschützten `floorplan.js`-Primitiven für Workspace- und Mietendenportal bleiben davon unberührt.
- **Explizite Prototypgrenzen:** Es gibt noch keinen Backend-Versionsdienst, keine Row-Level Security, keine fachliche Rollen-/Schreibrechteprüfung und keine gemeinsame Bearbeitung. Räume sind für diesen Feedback-Prototyp als `rooms[]` in die Arbeitskopie eingebettet; dies ist ausdrücklich nicht das Zielmodell der nächsten Iteration. 3D, Begehung und Veröffentlichung sind lokal simulierte Feedback-Zustände. `Plan hochladen` bleibt deaktiviert. DWG/DXF-Übernahme, Regelprüfung, Befundbearbeitung und Freigabe gehören nicht zum Editor, sondern weiterhin ausschliesslich zu Schritt 3.

## Schritt 3 — Planprüfung

- Eigenes Route-Modul für Upload, Dateiprüfung, Regelergebnisse, Korrekturschleife und Freigabe.
- Regeltexte und Resultatmodell aus dem Plan-Check-Vertrag beziehen; keine zweite Regeldefinition im Portal pflegen.
- Übergabe aus Portal und Editor über Objekt, Geschoss, Datei-/Planversion und Rücksprungziel.

## Noch offene Verträge für den Produktionsausbau

- Produktionsfähiges Versionsmodell für Plan, Änderungssatz und Prüfresultat sowie die vorhandenen stabilen Objekt-/Geschoss-IDs verbindlich festschreiben.
- Räume als eigenständige Entität mit stabiler `roomId`, Plan-/Geschossbezug und eigener Änderungsfassung führen; Platzierungen referenzieren Räume, statt einen eingebetteten Browser-Datensatz als API-DTO zu übernehmen.
- Rollen, Schreibrechte und Mehrbenutzerkonflikte je Anwendung definieren. Lesen und Schreiben werden serverseitig und in der Datenbank mit Row-Level Security durchgesetzt; UI-Zustände oder lokale Schlüssel gelten nie als Berechtigungsgrenze.
- API-Vertrag für Arbeitskopie, `plan_revision`, Raum-Patches, Platzierungen, serverseitig gesetzte Akteure und optimistische Konflikte/ETags festschreiben. `floorplan-editor-repository.js` wird dafür durch einen authentifizierten Adapter ersetzt.
- Übergabe und Rücksprung zur künftigen Planprüfung um Datei-/Planversion und Prüfresultat ergänzen; Portal und Editor übergeben bereits Objekt und Geschoss.
- Fehlende Backend-Operationen sichtbar als Prototypgrenze behandeln; keine Schein-Speicherung oder erfundenen Preise.
