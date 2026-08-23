# Suche — arbeitende Studie

Hero-Suche, Vorschlagsfeld und Trefferseite als laufende Anwendung. Sie zeigt
**den Vorschlag**: alle fünf Zutaten sind eingeschaltet.

Dieselben Daten, dieselbe Suchmaschine, derselbe Index wie das Portal. Was hier
gefunden wird, findet das Portal auch — nachgeprüft, nicht behauptet (siehe
*Nachweis* unten). Dieser Nachweis hängt **nicht** an den Schaltern: er misst den
Index, nicht die Oberfläche.

Die fünf Schalter bleiben trotzdem, einzeln. Sie beantworten die Anschlussfrage —
welcher Teil des Vorschlags welche Wirkung hat — und über sie ist der heutige
Portalzustand nach wie vor erreichbar. Sie stecken hinter **«Studie «Suche»»**
oben rechts, eingeklappt: die Leiste ist Werkzeug, nicht Entwurf, und soll
weder den ersten Eindruck noch einen Screenshot beherrschen.

Die Kennzeichnung der KI-Antwort hängt **nicht** an dieser Leiste. Sie steht, wo
sie hingehört: als Marke **Simuliert** am Antwortblock, mit «Automatisch erstellt
und kann Fehler enthalten» darunter, dazu die Fussnote im Fussbereich. Wer eine
Antwort sieht, sieht die Kennzeichnung — eingeklappt wie aufgeklappt.

## Starten

Die Studie muss **ausgeliefert** werden. Per Doppelklick geöffnet bleibt sie
leer: ES-Module und `fetch()` sind über `file://` gesperrt.

```bash
node scripts/serve.mjs
```

Dann <http://127.0.0.1:8848/docs/wireframes/260820%20-%20Suche/>

## Die fünf Schalter

| Schalter | Was er ändert |
| --- | --- |
| **Frageauflösung** | Verbessert die **Treffer**. Stoppwörter raus, Rest an die unveränderte Suchmaschine (`js/query.js`). |
| **Gruppierte Vorschläge** | Ändert das **Vorschlagsfeld**. Abschnittsköpfe je Inhaltsart mit Anzahl, Fundstelle hervorgehoben. |
| **«… als Frage stellen»** | Ergänzt den **Weg**. Beispiele im leeren Feld, Aktionszeile statt des stillen Abbruchs. |
| **KI-Antworten** | Erzeugt den **Block** über der Liste. Simuliert, jeder Satz mit Beleg. |
| **Quellenauswahl** | Nimmt Inhaltsarten **dauerhaft aus dem Index**. Wirkt auf Vorschläge, Treffer und KI-Antwort. |

Alle fünf sind eingeschaltet. Wer einen abschaltet, sieht, was er beigetragen
hat; wer alle abschaltet, sieht das heutige Portal.

## Der Antwortblock

Er steht über der Trefferliste, **bei jeder Abfrage**, in drei Zuständen:

| Eingabe | Was der Block zeigt |
| --- | --- |
| Stichwortsuche (`bedarf`) | Ruhezustand: was er beitragen würde, plus vier anklickbare Beispielfragen |
| Frage, verstanden | die simulierte Antwort, jeder Satz mit Beleg |
| Frage, nichts Starkes | «Keine KI-Antwort» — ein Erfolgszustand, kein Fehler |

Der Ruhezustand ist kein Platzhalter aus Verlegenheit. Er tut zwei Dinge:

* **Er hält den Platz.** Erschiene der Block nur bei Fragen, spränge die
  Trefferliste je nach Eingabe um seine Höhe.
* **Er zeigt die Auslösebedingung.** Dass eine ganze Frage etwas anderes bewirkt
  als ein Stichwort, ist sonst unsichtbar — wer nie eine Frage tippt, erfährt
  nie, dass er eine tippen könnte. Genau das ist die Lücke, an der diese Studie
  ansetzt, also steht dort ein Weg und keine Werbung: die vier Beispiele führen
  zu Fragen, die die Studie wirklich beantwortet.

Gemessen löst die Frageerkennung bei **6 von 6** echten Fragen aus und bei
**0 von 42** Stichwortabfragen. Das ist der Kostenschalter: jede erkannte Frage
wäre später ein Modellaufruf.

Ausblenden lässt sich der Block an ihm selbst — wer eine Antwort sieht, ist der
Einzige, der entscheiden kann, ob er sie will.

## Quellenauswahl

Nicht zu verwechseln mit den Facetten der Trefferseite. Sie sehen verwandt aus
und unterscheiden sich in dem, was am schwersten zu ändern ist — ihrer
Lebensdauer:

| | Facetten (Katalogleiste) | Quellen (beim Suchfeld) |
| --- | --- | --- |
| Reichweite | grenzen **eine** Trefferliste ein | bestimmen, was **überhaupt** durchsucht wird |
| Dauer | diese Abfrage | dauerhaft, geräteweit |
| Zahlen | Trefferzahlen | keine |
| In der Adresse | **ja**, teilbar | **nein** |

Der letzte Punkt ist ein Entscheid: wer einen Trefferlink weitergibt, gibt seine
Eingrenzung mit — bei einer Facette gewollt, bei einer persönlichen
Voreinstellung falsch. Sonst erbt die Empfängerin stillschweigend, dass jemand
anders keine Liegenschaften sehen wollte.

Widersprechen können sich die beiden nicht: die Quellenauswahl wirkt **vor** der
Suche, das Facettenpanel listet deshalb nur, was der Trefferliste tatsächlich
zugrunde liegt.

**Zwei Bauformen stehen zur Wahl** (Schaltflächen «Zeile» / «Knopf» in der
Studien-Leiste), weil sich nicht auf dem Papier entscheiden lässt, welche
besser ist:

```
ZEILE    Wonach suchen Sie? …            [🔍 Suchen]
         8 von 11 Quellen · ohne Wissen und Hilfsmittel,
         Prozesse, News.  Ändern ⌄

KNOPF    Wonach suchen Sie? …  [Quellen 8/11 ⌄]  [🔍 Suchen]
```

Die Zeile ist im Ruhezustand still und nennt im Betrieb, was fehlt. Der Knopf
ist auffindbarer und sagt im Ruhezustand nichts.

### Was hier keine Zahlen hat, und warum

Im Auswahlfeld stehen **elf Inhaltsarten ohne Bestandszahl**. «Wissen und
Hilfsmittel (148)» stimmt für die Demodaten und wäre an einer echten Datenbank
entweder falsch oder eine Aggregation, die bei jedem Öffnen des Feldes läuft.
Eine Zahl, die später falsch wird, ist schlimmer als keine.

Dieselbe Regel gilt für den Hinweis, der eine stille Voreinstellung davor
bewahrt, irgendwann die richtige Antwort zu verschlucken:

* **Im Normalfall wird nicht gezählt.** Was fehlt, steht beim Feld — namentlich,
  aus dem `localStorage` gelesen, nicht aus dem Index gerechnet.
* **Erst bei null Treffern** wird einmal nachgefragt, und zwar *gibt es
  überhaupt welche?*, nicht *wie viele?*. Auf einer echten Datenbank ist das
  ein `LIMIT 1`, keine Aggregation. Der Nullfall ist auch der einzige Moment,
  in dem die Antwort etwas ändert: solange Treffer da sind, sucht niemand nach
  einer Erklärung.

```
⚠ Ihre Quellenauswahl blendet Treffer aus. Ohne Wissen und
  Hilfsmittel, Prozesse, News findet diese Suche nichts —
  mit allen Inhaltsarten gäbe es Treffer.
  [Alle Quellen einschalten]
```

Die Filterung wirkt **vor** der Suche, nicht danach: an einer echten Datenbank
wird sie zur `WHERE`-Klausel. Erst suchen und dann wegwerfen hiesse, die volle
Menge zu holen, um sie zu verkleinern.

Gespeichert wird, **was aus ist** — nicht, was an ist. Kommt im Portal später
eine Inhaltsart dazu, ist sie damit automatisch an; andersherum wäre jede neue
Inhaltsart für alle bestehenden Geräte stillschweigend unsichtbar. Die letzte
verbleibende Quelle lässt sich nicht abwählen.

### Was das Abschalten misst

37 realistische Abfragen über die 355 Einträge:

| Inhaltsart | Anteil aller Treffer | Anteil Top 10 |
| --- | --- | --- |
| Wissen und Hilfsmittel | **50 %** | **35 %** |
| Dienstleistungen | 12 % | 17 % |
| Datensätze | 10 % | 11 % |
| Prozesse · Anwendungen | 8 % · 7 % | 3 % · 8 % |
| übrige sechs zusammen | 13 % | 12 % |

```
alles an                                25,2 Treffer je Abfrage
ohne Bauten (Liegensch./Bauproj./Dok.)  24,1  ·  3 andere 1. Treffer
ohne Datenschicht (4 Arten)             18,8  ·  4 andere 1. Treffer
ohne Wissen und Hilfsmittel             12,5  · 11 andere 1. Treffer
```

Der Lärm ist einseitig: Wissen und Hilfsmittel stellt 42 % des Index, aber die
Hälfte aller Treffer — obwohl `TYPE_BOOST.knowledge = -12` es bereits nach unten
schiebt. Sieben der elf Arten bewegen die Trefferzahl kaum. Sie stehen trotzdem
zur Wahl: die Auswahl erfindet kein eigenes Vokabular, sondern benutzt dieselbe
Dimension wie die Facetten der Trefferseite.

## Was echt ist und was nicht

| Teil | Status |
| --- | --- |
| Datensätze | **Echt** — 355 Einträge aus elf Inhaltsarten, dieselben `data/*.json` wie das Portal |
| Suchmaschine | **Echt** — `js/search/search-engine.js` wird unverändert importiert |
| Wissen und Hilfsmittel | **Echt** — `js/knowledge-content.js` wird unverändert importiert (148 Zeilen im Index) |
| Suchindex | **Gespiegelt** — `js/data.js` baut ihn wie `buildIndex()` in `js/pages/search.js`; ein Skript prüft es |
| CD-Bauteile | **Kopiert** — `css/tokens.css` und `css/cd.css` aus den Portal-Dateien, jede Regel nennt ihre Quelle |
| Routen | **Echt** — gebildet wie `js/links.js` |
| Frageauflösung | **Deterministischer Platzhalter** — Stoppwörter raus (`js/query.js`) |
| Antwort | **Simuliert** — aus den Texten der gefundenen Datensätze zusammengesetzt (`js/answer.js`) |
| Detailseiten und Navigation | **Attrappe** — ein Treffer landet auf einer Hinweisseite |

Es gibt keinen Modellaufruf und keinen Schlüssel. Eine statische Seite kann
beides nicht tragen, und die Studie soll nicht so tun als ob. Bewiesen wird die
**Form** — jeder Satz stammt aus einem Datensatz und trägt dessen Beleg —, nicht
die Antwortqualität.

### Eigenständig, mit zwei Ausnahmen

Die Studie ändert **nichts** am Portal. Kopiert ist alles, was sie selbst
verändert: Token, CD-Bauteile, Indexaufbau, Vorschlagsfeld, Trefferseite.

Gelesen statt kopiert werden nur zwei Module, und beide aus demselben Grund —
man forkt nicht, was man misst:

* `js/search/search-engine.js` ist der **Gegenstand** der Studie. Eine
  Zweitfassung wäre eine zweite Wahrheit.
* `js/knowledge-content.js` ist der **Bestand** selbst: 113 Datensätze in Prosa,
  mit Verweisen im Text. Eine Kopie wäre nach der ersten Redaktion falsch, und
  «was findet man im Portal» hinge dann an einer veralteten Zweitfassung.

Beides sind Lesezugriffe; am Portal ändert sich dadurch keine Zeile.

## Nachweis

Der Preis der Eigenständigkeit ist Abdriften. Der Gegenzug ist ein Skript:

```bash
node "docs/wireframes/260820 - Suche/verify-parity.mjs"
```

Es baut **beide** Indizes — den der Studie aus ihrem echten Modul, den des
Portals aus dem Quelltext von `js/pages/search.js` — und vergleicht sie. Stand
heute:

```
Indexgrösse                      Studie 355 · Portal 355
Zeilen je Inhaltsart             11 von 11 gleich
Feldweiser Vergleich             355 von 355 identisch in kind/type/desc/meta/extra/boost
Vorschlagsindex                  243 · 243, gleiche Zeilen in gleicher Reihenfolge
14 Abfragen · 6 Vorschlagseingaben  alle identisch
```

Solange es grün ist, gilt jede Messung in der Studie auch für das Portal.

Zwei Befunde stammen aus diesem Abgleich und wären ohne ihn unentdeckt geblieben:

**Der Vorschlagsindex braucht die richtige REIHENFOLGE.** `search()` sortiert
`b.score - a.score || a.i - b.i` — bei Gleichstand entscheidet die
Eingabereihenfolge. Der Vorschlagsindex des Portals sammelt Dienstleistungen →
Anwendungen → Datensätze → Unterlagen, der Vollindex hat Wissen an dritter
Stelle. Einfach aus dem Vollindex zu filtern gab 335 von 243 Zeilen an anderer
Position. Die geprüften Abfragen fielen trotzdem gleich aus — was den Fehler
unsichtbar machte, nicht harmlos.

**Die Trefferzeile trägt bei drei Inhaltsarten kein `meta`.** Das Portal setzt
bei Dienstleistungen, Anwendungen und Datensätzen keines; die Domäne dort
einzublenden wäre eine Verbesserung gewesen, aber eine ungefragte. Sie erscheint
weiterhin dort, wo das Portal sie zeigt: im Vorschlagsfeld, als `desc`.

## Der Befund, um den es geht

`js/search/search-engine.js` verlangt, dass **jeder** Term trifft
(`// AND: one absent term excludes the row`). Gemessen gegen den vollen Index:

```
«stoerung melden»                      → 3 Treffer
«heizung»                              → 9 Treffer   (Umgangssprache greift)
«Wie melde ich eine defekte Heizung?»  → 0 Treffer
```

`wie`, `ich` und `eine` streichen den Index, bevor «Heizung» gewertet wird. Der
Retriever ist nicht schwach; ihm fehlt der Schritt davor. `js/query.js` ist die
dümmstmögliche Fassung dieses Schritts — Stoppwörter entfernen — und macht aus
0 Treffern 20.

Wie gross die Lücke ist, sagt das Portal selbst: seine eigene
Nichts-gefunden-Seite bietet bei dieser Frage «wie — 20 Treffer», «ich — 5
Treffer», «eine — 86 Treffer» an. Es weiss, dass es die Frage nicht verstanden
hat, und kann nur einzelne Wörter zurückreichen.

## Was die Studie entscheidet

**1. Der Nullpunkt ist das Portal, nicht der Vorschlag.**
Die Studie startet mit allen Schaltern aus. Wer sie öffnet, sieht zuerst, was
heute passiert — und kann dann einzeln zuschalten. Ein Prototyp, der nur seinen
eigenen Endzustand zeigt, kann nichts widerlegen.

**2. Die Vorschläge sind gruppiert, nicht filterbar.**
Vorbild ist `map.geo.admin.ch`: Abschnittsköpfe je Inhaltsart mit Anzahl, dazu
Hervorhebung der Fundstelle. Das beantwortet «ich will nur Dienstleistungen
sehen», bevor jemand ein Bedienelement sucht — und kostet keinen Klick. Ein
Filterknopf im Hero müsste ohne Trefferzahlen auskommen; die Facetten auf der
Trefferseite haben sie.

**3. Die Hero-Suche zeigt Beispiele, keine Antwort.**
Beim Hineinklicken stehen vier echte Fragen im leeren Feld. Dort lernt jemand,
dass Fragen erlaubt sind — nicht aus einem Hinweistext, sondern weil sie
dastehen. Eine Antwort im Vorschlagsfeld ist ausgeschlossen: die Liste ist
`role="listbox"`, und eine Option darf keine Prosa und keine Verweise enthalten.

**4. Wo die Suche heute abbricht, steht jetzt ein Weg.**
`js/search/search-suggest.js` ruft bei null Treffern `close()` — das Feld wird
still leer, genau wenn jemand eine Frage getippt hat. Hier erscheint stattdessen
«… als Frage stellen», ausserhalb der Listbox, damit der Options-Vertrag hält.

**5. Frageauflösung und Antwortbau sind zwei Funktionen.**
Als beides am selben Schalter hing, leerte «aus» auch die Trefferliste: die
wörtliche Suche findet zu einer Frage nichts. Wer die Antworten abschaltet, will
keine Antwort — keine kaputte Suche. Die beiden bleiben getrennt, und wo das
sichtbar wird (Antwort an, Auflösung aus), sagt die Notiz unter der Leiste,
warum die Liste leer bleibt, während die Antwort Quellen zeigt.

**6. Der Ausschalter sitzt am Antwortblock.**
Wer eine Antwort sieht, ist der Einzige, der entscheiden kann, ob er sie will.
Die Einstellung ist dauerhaft (`localStorage`), nicht pro Suche.

**7. Eine Relevanzschranke verhindert die gefährlichste Antwort.**
Einzelwort-Rückfallebenen finden immer etwas. «Wie viele Ferientage stehen mir
zu?» lieferte darüber eine sauber belegte Antwort über Mietobjekte — falsch,
aber überzeugend gesetzt. Quellen zählen nur aus Mehrwort-Abfragen; sonst
entfällt die Antwort. Die Liste bleibt grosszügig, die Antwort wird streng:
eine Liste bietet an, ein belegter Satz behauptet.

**8. Die Trefferliste wird nie ersetzt, blockiert oder eingeklappt.**
Der Antwortblock steht darüber und nimmt ihr nichts weg.

## Messen

`#/search?log=1` — dieselbe Diagnoseansicht wie im Portal, mit einer Spalte
mehr: **Zustand**. Ohne sie stünden «0 Treffer» aus dem Portalzustand und
«20 Treffer» aus dem Studienzustand als Widerspruch desselben Begriffs
nebeneinander.

```
Suchbegriff                          Zustand              Anfragen  Treffer
Wie melde ich eine defekte Heizung?  wörtlich                    1  0 Treffer
Wie melde ich eine defekte Heizung?  aufgelöst                   1         20
bedarf                               wörtlich                    2         22
vorlage                              wörtlich · 8/11 Quellen     1          2
```

Der Zustand nennt auch die Quellenauswahl: ohne sie stünden «2 Treffer» und
«24 Treffer» für denselben Begriff als Widerspruch nebeneinander.

Nur im `localStorage` dieses Geräts, ohne Kennung und ohne Übertragung — ein
Notizblock, kein Tracking. Eigener Schlüssel (`bbl.suche.log`), damit Testläufe
sich nicht mit dem Protokoll des Portals mischen.

## Die Sprachwahl in der Bundesleiste

Sie ist deaktiviert und soll es bleiben. Sie steht da, damit die grösste offene
Frage an dieser Suche sichtbar bleibt: **die Suche ist heute durchgehend deutsch
gebaut.** Faltung und Stemming in `js/search/search-engine.js` (`SUFFIXES`,
`COLLOQUIAL`) sind deutsche Regeln, `core.t()` nimmt aus mehrsprachigen Feldern
immer die deutsche Fassung, und die Stoppwortliste in `js/query.js` ist eine
deutsche Liste. Was Mehrsprachigkeit für Index, Vorschläge, Frageauflösung und
Quellenauswahl bedeutet, ist ungeklärt. Ein leeres Bedienelement an der
richtigen Stelle erinnert bei jedem weiteren Entscheid daran; ohne es sähe die
Studie so aus, als gäbe es die Frage nicht.

## Aufbau

```
index.html            Portalhülle (Bundesleiste · Marke · Navigation · Fusszeile) + Studien-Leiste
verify-parity.mjs     der Nachweis: Studienindex gegen Portalindex
css/tokens.css        Token + Intranet-Haut, kopiert aus css/tokens.css + css/skins/intranet.css
css/cd.css            CD-Bauteile, kopiert aus den Portal-Dateien (jede Regel nennt ihre Quelle)
css/study.css         nur was die Studie hinzufügt: Leiste, gruppierte Vorschläge, Antwortblock
js/main.js            Start, Hash-Router, Studien-Leiste
js/data.js            lädt data/*.json und spiegelt buildIndex()
js/ui.js              Bauteile: Katalogleiste, Facetten, Pillen, Blätterung, Karte, Tabelle
js/query.js           Frageerkennung und Stichwortauflösung
js/answer.js          Antwortbau samt Relevanzschranke
js/suggest.js         Vorschlagsfeld — Portal flach, Studie gruppiert
js/views.js           Startseite, Trefferseite, Suchprotokoll
js/settings.js        die fünf Schalter und die Wahl der Bauform
js/sources.js         die Quellenauswahl (dauerhaft, nicht in der Adresse)
js/search-log.js      das Protokoll
```

## Zum Ausprobieren

Ein Schalter aus, dieselbe Abfrage nochmals — der Unterschied ist der Gegenstand.

- `bed` — gruppierte Vorschläge; ohne «Gruppierte Vorschläge» die flache Portal-Liste mit sieben Zeilen
- leeres Feld anklicken — vier Beispiele; ohne «… als Frage stellen» bleibt es zu, wie im Portal
- `Wie melde ich eine defekte Heizung?` — 20 Treffer; ohne «Frageauflösung» null, wie heute
- `Wie viele Ferientage stehen mir zu?` — die Antwort entfällt, korrekt
- `COMP_CODE` — findet die Datentabelle über ihren Feldnamen
- `TQ.21.00.00.01` — findet den Prozess über seine Nummer
- Nur «Antworten» an, «Frageauflösung» aus — die Notiz erklärt die leere Liste
- Schalter «KI-Antworten ausblenden» am Block — Antwort weg, Treffer bleiben
- «Quellenauswahl» an, «Wissen und Hilfsmittel» aus, dann `vorlage` — 24 Treffer werden 2
- danach `werkzeugkasten` — null Treffer, und der Hinweis sagt, dass es an der Auswahl liegt
- «Zeile» und «Knopf» in der Studien-Leiste — dieselbe Auswahl, zwei Bauformen
