# Gap-Analyse — Wireframe `_CD-kompakt` gegen die Anwendung

> **Stand: alle neun Punkte geschlossen** (Commits `1bf9783` bis `16d5542`).
> Der Befund unten bleibt als Beleg stehen; die Reihenfolge am Ende trägt
> den Stand. Was bewusst NICHT angeglichen wurde, steht dort ebenfalls.

Verglichen wurde `docs/wireframes/260813 - Katalog mit Reitern_CD-kompakt.html`
mit `#/app/metadata-catalog` (Stand `14ca589`), auf **denselben Daten** — beide
zeigen 19 Geschäftsobjekte, 10 Systeme, 15 Wertelisten und dieselben fünf
Domänen. Die Gegenüberstellung lief über acht Szenen (L0 bis L4, je Reiter),
zuerst als Bildpaare, dann als Auslesung von Rollen und Formen im DOM. Die
Bilder liegen unter `scratchpad/pairs/`.

Was der Vergleich **nicht** als Lücke wertet: die Aufsätze rundherum
(«Das Raster», «Wo die Bedienelemente sitzen», «Interaktionsprotokoll», «Der
Befund…») sind Studienapparat, kein Produkt. Ebenso die im Rahmen simulierte
Brotkrume — die Anwendung hat die echte des Portals.

---

## Was bereits deckungsgleich ist

Der Kern stimmt, und das ist der teuerste Teil:

- **Der Reitervertrag** — welche Reiter es auf welcher Stufe gibt und auf
  welchem jede Stufe öffnet — ist auf allen acht Szenen identisch. Kein
  einziger Unterschied bei `tabs` oder `active`.
- **Baum als Umfang, Reiter als Darstellung**, beide in der URL, der Reiter
  überlebt jeden Baumklick.
- **Stufe 3 als «Übersicht auf Stufe 3»**, dieselben drei Abschnitte auf jeder
  Stufe (Definition, Verantwortlich, Metadaten).
- **Spalten auf Stufe 3** exakt gleich: Attribut · Beschreibung · Werttyp ·
  Schlüssel.
- **Kein Diagramm auf Stufe 3.** Der Prosa-Abschnitt «Das Raster» im Wireframe
  verspricht dort noch ein Beziehungsbild; sein eigener Code tut es nicht. Die
  Anwendung folgt dem Code. Das ist veraltete Dokumentation *im Wireframe*, kein
  Rückstand der Anwendung.

---

## A — Die Katalog-Startseite ist die grösste Lücke

Der Wireframe zeigt auf `#/` vier Dinge; die Anwendung zeigt eines davon, und
das unsichtbar.

| | Wireframe | Anwendung |
|---|---|---|
| Kennzahlkarten | 3 Karten mit grosser Zahl, Symbol und Detailzeile («85 Attribute · 17 Gültig · 2 Entwurf») | 3 Karten, **ohne jede Kontur** |
| Suche | «Im ganzen Katalog suchen…» | fehlt |
| Letzte Änderungen | Tabelle mit 6 Zeilen (Name · Typ · Gruppe · Status · Geändert) | fehlt |
| Domänen | Tabelle (Domäne · Umfang · Bestandteile) | fehlt |

**A1 — Die Karten haben keine Fläche.** `.card--clickable` liefert nur Cursor
und Hover-Rand; die Fläche kommt im Portal von `.card--default` oder
`.card--universal` (`box-shadow: var(--shadow-lg)`). Alle 13 anderen Karten im
Portal führen eine dieser Stufen, meine ist die einzige ohne. Ergebnis: drei
Textblöcke im Nichts. **Fehler, nicht Geschmacksfrage.**

**A2 — Keine Kennzahl.** Der Wireframe stellt die Zahl gross voran; die
Anwendung schreibt sie in einen Fliesstext («19 Geschäftsobjekte in 5 Domänen»).
Die Karte soll auf einen Blick eine Grösse nennen.

**A3 — «Letzte Änderungen» und «Domänen» fehlen ganz.** Zusammen mit A1/A2
erklärt das den Eindruck der Seite: zwei Drittel der Fläche sind leer.

---

## B — Bedienelemente: der Wireframe hat vier, die Anwendung hat anderthalb

Der Wireframe setzt in die Reiterzeile, rechts: **Alle zuklappen · Filter ·
Gruppieren: ‹Achse› · Aktionen**. Und über die Reiter, links: das **Suchfeld**.
Er begründet die Anordnung selbst (Abschnitt «Wo die Bedienelemente sitzen»):
Suche schränkt den *Umfang* ein wie der Baum, gehört also zur Trefferzahl;
Filter und Gruppieren gehören zu Tabelle und Diagramm, also in die Reiterzeile.

| Element | Wireframe | Anwendung |
|---|---|---|
| Suchfeld | über den Reitern, umfangsbezogene Beschriftung («In Bauwerk und Liegenschaft suchen…»), auf **jedem** Reiter sichtbar; auf L4 ausdrücklich abgeschaltet mit «Auf dieser Stufe gibt es nichts zu durchsuchen» | nur **innerhalb** der Tabelle, generisch «durchsuchen…», auf Übersicht und Diagramm gar nicht vorhanden |
| Filter | Reiterzeile rechts | innerhalb der Tabelle |
| **Gruppieren** | Auswahl: Domäne · Verantwortung · Status · keine | **fehlt** — fest verdrahtet |
| **Aktionen** | CSV · Excel · PDF drucken | **fehlt ganz** |
| Sortieren | anklickbare Spaltenköpfe (`Name ▲▼`) | Auswahlliste «Sortieren» |
| Alle zuklappen | vorhanden, auf beiden Reitern | nur im Diagramm |

**B1 — Der Export fehlt vollständig.** Das war eine ausdrückliche Anforderung
(«Aktionen-Dropdown … CSV, Excel, PDF»).

**B2 — «Gruppieren» ist im Wireframe die Achse, die *beide* Ansichten
umlegt** — dieselbe Auswahl bestimmt die Kästen im Diagramm und die Abschnitte
in der Tabelle. Die Anwendung gruppiert die Tabelle fest nach der Achse (Stufe 1)
oder gar nicht (Stufe 2) und kennt für das Diagramm keine Wahl. Damit fehlt der
Anwendung nicht nur ein Bedienelement, sondern der Gedanke dahinter: die
Gruppierung ist eine Eigenschaft der *Darstellung*, die sich beide Reiter teilen.

**B3 — Die Suche ist an die Tabelle gebunden.** Wer auf Übersicht oder Diagramm
steht, kann nicht suchen. Im Wireframe ist die Suche eine Eigenschaft des
Umfangs und deshalb immer da.

---

## C — Das Diagramm ist auf Stufe 2 ein anderes Modell

Das ist die inhaltlich schwerwiegendste Abweichung.

- **Wireframe:** Kacheln sind **immer Datensätze**. Die Kästen kommen aus
  «Gruppieren». Auf Stufe 1 mit «Gruppieren: Domäne» → fünf Kästen mit
  Datensatz-Kacheln. Auf Stufe 2 mit «Gruppieren: keine» → **ein** Kasten
  «Alle» mit denselben acht Datensatz-Kacheln. Es ist dieselbe Landschaft, nur
  anders umgelegt.
- **Anwendung:** auf Stufe 1 Kästen = Domänen, Kacheln = Datensätze (stimmt
  zufällig überein); auf Stufe 2 Kästen = **Datensätze**, Kacheln = **Attribute**.

Meine Regel «immer eine Stufe tiefer als Kasten, zwei Stufen tiefer als Kachel»
ist in sich stimmig, aber sie ist nicht die des Wireframes — und sie kostet die
Vergleichbarkeit: im Wireframe bedeutet eine Kachel auf jeder Stufe dasselbe.

---

## D — Das Diagramm sieht anders aus, weil es anders gebaut ist

| | Wireframe | Anwendung |
|---|---|---|
| Anordnung der Kästen | umbrechendes Raster, drei nebeneinander, **jeder Kasten so breit wie sein Inhalt** (gemessen 283px) | gestapelt, **jeder Kasten volle Breite** (gemessen 1021px) |
| Kacheln | dunkel gefüllt (secondary-500, weisse Schrift), kompakt, **nur der Name** | weiss mit Rand, Name **plus Metazeile** |

Das ist kein Stilunterschied, sondern ein Bedeutungsunterschied: im Wireframe
trägt die **Grösse des Kastens** die Aussage — man sieht, dass «Bauwerk und
Liegenschaft» dreimal so viel enthält wie «Finanzen», ohne eine Zahl zu lesen.
Volle Breite für jeden Kasten wirft genau diese Information weg. Die Anwendung
zeichnet eine Liste mit Kästen darum; der Wireframe zeichnet eine Karte.

---

## E — Tabellenspalten auf Stufe 1 und 2

| Wireframe | Anwendung |
|---|---|
| Name · **Verantwortung** · Beschreibung · Attribute · **Status** | Name · Beschreibung · Attribute |

**E1** — «Verantwortung» und «Status» fehlen. Status war in meiner ersten Fassung
vorgesehen und ist beim Schreiben der endgültigen Datei herausgefallen; es ist
keine Regression aus Phase 2, sondern von Anfang an nicht ausgeliefert worden.

**E2** — Reihenfolge der Abschnitte: der Wireframe ordnet nach Grösse absteigend
(8·3·3·3·2), die Anwendung nach der Sortierung der ersten Zeile.

**E3** — Der Wireframe wiederholt den Spaltenkopf je Abschnitt; die Anwendung hat
einen Kopf für die ganze Tabelle. Der Portalstandard spricht für einen Kopf —
kein Handlungsbedarf, nur zur Kenntnis.

---

## F — Der Baum

| | Wireframe | Anwendung |
|---|---|---|
| Symbole | auf den Ast-Zeilen (Würfel, Datenbank, Liste) | **keine** |
| Zähler | rechtsbündig in eigener Spalte | inline in Klammern |
| «Katalog» | trägt den Gesamtzähler **44** | ohne Zähler |

Die Symbole waren ein ausdrücklicher Entscheid («Symbole nur auf Baumstufe 1»).
`.pf-tree__ico` gibt es in `explorer.css` bereits; es wird nur nicht benutzt.

---

## G — Kleinigkeiten

- **G1** L1-Übersicht: dem Wireframe fehlt gegenüber der Anwendung nichts, der
  Anwendung aber die Zeile «Führender Nachweis».
- **G2** L4-Übersicht: der Wireframe nennt die Herkunftszeile «Übergeordnet», die
  Anwendung «Geerbt von». Die Anwendung zeigt zusätzlich Dateneigner und
  Datenverwalter — inhaltlich reicher, aber die Benennung sollte man
  vereinheitlichen.

---

## Empfohlene Reihenfolge

Nach Verhältnis von Wirkung zu Aufwand:

| | Was | Stand |
|---|---|---|
| 1 | **A1** Karten sichtbar machen (`card--default`) | ✅ `1bf9783` |
| 2 | **E1** Spalten «Verantwortung» und «Status» zurück | ✅ `1bf9783` |
| 3 | **F** Baumsymbole und Katalog-Zähler | ✅ `1bf9783` |
| 4 | **A2/A3** Startseite: Kennzahl gross, «Letzte Änderungen», «Domänen» | ✅ `d58a9ac` |
| 5 | **D** Diagramm als Karte statt als Liste | ✅ `d1f8db1` |
| 6 | **C** Kacheln immer Datensätze; Kästen aus der Gruppierung | ✅ `d1f8db1` |
| 7 | **B2** «Gruppieren» als geteiltes Bedienelement | ✅ `d1f8db1` |
| 8 | **B3** Suchfeld über den Reitern, umfangsbezogen | ✅ `681ae63` |
| 9 | **B1** Aktionen-Menü mit CSV, Excel, Drucken | ✅ `16d5542` |

---

## Was dabei zusätzlich herauskam

- **Der Status einer Datentabelle trug ihre Speicherform.** «GIS-Layer» in einer
  Status-Spalte liest sich als Zustand und ist eine Gestalt. Status ist jetzt die
  Zertifizierung; die Art hat wieder eine eigene Zeile. Erst dadurch decken sich
  die Kennzahlen Zeichen für Zeichen mit dem Wireframe.
- **Die Wertelisten trugen alle denselben erfundenen Beschreibungssatz.** Eine
  Suche nach «geb» traf deshalb alle fünfzehn — auf «vergeben». Das Datenmodell
  hat für Wertelisten keine Beschreibung; die Lücke steht jetzt sichtbar leer.
- **Zwei Zähler sagten dasselbe.** Der der Tabelle ist entfallen (Nutzerentscheid
  von früher: «der Zähler in der catbar ist nur Unruhe»); er bleibt für
  Screenreader als `sr-only` erhalten, und die Zahl der Gruppen ist in den
  Zähler der Suchleiste gewandert, der auf jedem Reiter da ist.
- Additiv am gemeinsamen Bestand: `C.table({ groups })`, `mountDataTable`
  `groupBy` / `showSearch` / `showCount`, `.pf-tree__split` und eine Regel in
  `tabs.css` für den durchschlagenden Aussenabstand. Alles voreingestellt aus,
  die sechs anderen Reiterflächen im Portal messen unverändert 32px.

## Bewusst nicht angeglichen

- **Die Zeilenhöhe.** Der Wireframe hält eine Zeile je Datensatz, aber auf seiner
  kompakten 13px-Skala; das Portal folgt dem CD und steht oberhalb 1280px auf
  18px. Zwei Zeilen sind hier dasselbe Ergebnis in der gewählten Schrift.
- **Die Kachelfarbe.** Der Wireframe füllt schiefergrau (`#46596b`), die
  Anwendung blau. Beide nehmen `--color-secondary-500`, den Grund gefüllter
  Bedienelemente — der Intranet-Skin des Portals setzt ihn anders. Der Token
  gilt, nicht der Hexwert; weiss darauf misst in beiden Fällen 7,2:1.
- **Der wiederholte Spaltenkopf je Abschnitt.** Der Portalstandard ist ein Kopf
  für die ganze Tabelle.
- **Die Aufsätze im Wireframe** («Das Raster», «Interaktionsprotokoll», …). Sie
  sind Studienapparat.
