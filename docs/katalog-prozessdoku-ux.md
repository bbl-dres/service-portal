# Geschäftsarchitektur und Prozessdokumentation — Interaktions- und Flussreview

Stand 2026-08-15. Zwei Nachbaranwendungen mit derselben Anatomie: Baum wählt den
Umfang, drei Sichten zeigen ihn, eine Leiste trägt Suche und Bedienelemente. Wer
eine kennt, soll die andere nicht neu lernen müssen. Dieses Dokument prüft, ob
das stimmt — Stufe für Stufe, gemessen an der laufenden Anwendung.

> **Fortschreibung 2026-08-17:** Der fokussierte
> [Design-Review](design-review-metadata-process-docs-2026-08-17.md) ersetzt vier
> damalige Detailregeln. Ein Geschäftsobjekt oder eine Datentabelle startet jetzt
> in der Übersicht, Inhalte eines Datensatzes werden als Textregister statt als
> Ansichtsschalter dargestellt, und die Wahl eines anderen Datensatzes startet
> wieder informationsorientiert in der Übersicht. Hierarchie ist keine aktive
> Filtermarke mehr; Baum, Krume, H1 und Zurück-Link zeigen den Umfang. Die
> Prozesswurzel durchsucht nun beide Zweige. Die Messungen und Begründungen unten
> bleiben als Entscheidungsverlauf erhalten, nicht als aktuelle Spezifikation.

---

## 1 — Der Vergleich, gemessen

Aufgenommen an acht Stellen (`scratchpad/flow.mjs`, 1400px):

| Stelle | Vorgabesicht | Schalter | «Zurück» führt nach | Werkzeuge |
|---|---|---|---|---|
| Katalog · Wurzel | – | – | Anwendungen | 0 |
| Katalog · Ast | Diagramm | Ü/D/T | Wurzel | 3 |
| Katalog · Gruppe | Diagramm | Ü/D/T | Ast | 3 |
| Katalog · Datensatz | Tabelle | Ü/T | Gruppe | 2 |
| Prozesse · Wurzel | – | – | Anwendungen | 1 |
| Prozesse · Ast | Diagramm | Ü/D/T | Wurzel | 3 |
| Prozesse · Gruppe | Diagramm | Ü/D/T | ~~Wurzel~~ → Bereich | 3 |
| Prozesse · Prozess | Übersicht | Ü/D/Schritte | Gruppe | 1 |

Die Anatomie stimmt überein. Auseinander liefen vier Dinge.

---

## 2 — Befunde

### U1 · Die Marken logen über den Umfang (behoben, Nutzerfund)

Die Zeile «Aktive Filter» soll zeigen, was gerade einschränkt. Gemessen:

| Adresse | Marke | Baum markiert |
|---|---|---|
| `?branch=fachlich` | *(keine)* | Fachliche Prozesse |
| `?org=BBL Bauten` | *(keine)* | BBL Bauten |
| `?area=…` | *(keine)* | Immobilienmanagement (K0) |
| `?id=TQ.21.00.00.02` | **Akquisition & Planung** | Machbarkeit Projektdefinition |
| `?def=raumbedarf` | **Bauprojekte und Projektportfolio** | Raumbedarf-Antrag |

Zwei verschiedene Fehler in einer Zeile. Die drei neuen Stufen erzeugten gar
keine Marke — die Zeile behauptete «nichts eingeschränkt», während der Baum
daneben eine Auswahl zeigte. Und auf einem Datensatz nannte die Marke **seine
Gruppe**, also einen Umfang, in dem man gar nicht mehr stand; ein Klick darauf
hätte den Leser dorthin geführt, wo er glaubte schon zu sein.

Der Katalog hatte das an allen Stellen richtig — nachgeprüft, nicht angenommen.

**Behoben:** die Marke nennt jetzt auf jeder Stufe genau das, was der Baum
markiert. Abwählen führt eine Stufe hinauf.

### U2 · Die Sicht ging beim Nachbarn verloren (behoben, Nutzerfund)

`?id=X&tab=diagramm` → einen anderen Prozess im Baum anklicken → `?id=Y`, und
damit zurück auf die Vorgabesicht. Wer Diagramme vergleicht, musste nach jedem
Wechsel erneut auf «Diagramm» klicken.

**Behoben:** der Verweis trägt die Sicht mit. Aus der *Liste* heraus bewusst
nicht — dort heisst «Diagramm» die Landschaft und meint etwas anderes als das
BPMN eines einzelnen Ablaufs.

### U3 · «Zurück» sprang über Stufen (behoben)

Im Katalog steigt «Zurück» eine Stufe: Datensatz → Gruppe → Ast → Wurzel. In
der Prozessdokumentation sprang **jede** Stufe direkt auf die Wurzel und liess
genau die Zwischenstufen aus, die der Leser gerade durchschritten hatte.

**Behoben:** eine Stufe je Druck, entlang derselben Kette, die auch der Baum
zeigt. Gemessen: Gruppe → Prozessbereich → Organisation → Ast → Wurzel.

### U4 · Ungleiche Wurzeln (offen, bewusst)

Die Katalogwurzel bietet keine Werkzeuge, die Prozesswurzel bietet «Aktionen».
Beide Einstiegsseiten zeigen Tabellen, die man mitnehmen könnte — für die
Katalogwurzel wäre «Aktionen» also ebenso sinnvoll.

Nicht angefasst, weil es eine Produktfrage ist und keine Inkonsistenz mit
Folgen: niemand vermisst einen Knopf, den er nie gesehen hat. Vermerkt, damit
die Entscheidung bewusst fällt.

### U5 · Der dritte Schalter heisst verschieden (offen, bewusst)

«Tabelle» im Katalog, «Prozessschritte (24)» in der Prozessansicht. Die Zahl im
Schalter ist im Portal sonst nirgends üblich, und sie macht die Gruppe breiter.

Belassen: die Benennung stammt aus der fachlichen Absprache («Prozessschritte =
table view»), und die Zahl beantwortet dort eine echte Frage — wie lang ist
dieser Ablauf —, bevor man klickt.

---

## 3 — Was das Muster trägt

Gegengeprüft und in Ordnung, damit es nicht später erneut untersucht wird:

- **Der Baum ist überall Umfang, nie Darstellung.** Beide Anwendungen halten
  das durch: Klick auf die Beschriftung wählt, das Chevron klappt.
- **Die Wurzel ist kein Umfang, sondern der Weg hinein.** Beide zeigen dort
  Karten statt Sichten, und beide unterdrücken die Sichtwahl.
- **Die Vorgabesicht ist das Diagramm**, bis ein Einzelding gewählt ist — dann
  die Übersicht bzw. die Tabelle. Das ist in beiden gleich und richtig herum:
  auf einem Umfang fragt man «wie teilt sich das», auf einem Ding «was ist das».
- **Die Suche schränkt Baum UND Fläche ein**, in beiden.

---

## 4 — Umgesetzt

1. **U1** — Marken zeigen den tatsächlichen Umfang, auf jeder Stufe, und nennen
   das gewählte Ding statt seines Elters.
2. **U2** — die Sicht reist zum Nachbarn mit.
3. **U3** — «Zurück» steigt eine Stufe statt auf die Wurzel zu springen.

Offen und begründet: **U4** (Produktfrage), **U5** (fachlich gewollt).
