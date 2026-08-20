# Suche — arbeitender Prototyp

Hero-Suche, Trefferseite und der Weg dazwischen. Kein Bild, sondern eine
laufende Anwendung: echte Daten, echte Suchmaschine, simulierte Antwort.

## Starten

Der Prototyp muss **ausgeliefert** werden. Per Doppelklick geöffnet bleibt er
leer: ES-Module und `fetch()` sind über `file://` gesperrt.

```bash
node scripts/serve.mjs
```

Dann <http://127.0.0.1:8848/docs/wireframes/260820%20-%20Suche/>

## Was echt ist und was nicht

| Teil | Status |
| --- | --- |
| Datensätze | **Echt** — `data/services.json`, `applications.json`, `datasets.json`, `processes.json`, `business-objects.json`, `news.json`, `buildings.geojson` (173 Zeilen) |
| Suchmaschine | **Echt** — `js/search/search-engine.js` wird unverändert importiert |
| Routen | **Echt** — gebildet wie in `js/links.js` |
| CD-Bauteile | **Echt** — Werte aus `swiss/designsystem` 1.0.5, Intranet-Rampe |
| Frageauflösung | **Deterministischer Platzhalter** — Stoppwörter raus (`js/query.js`) |
| Antwort | **Simuliert** — aus den Texten der gefundenen Datensätze zusammengesetzt (`js/answer.js`) |
| Detailseiten | **Attrappe** — ein Treffer landet auf einer Hinweisseite |

Es gibt keinen Modellaufruf und keinen Schlüssel. Eine statische Seite kann
beides nicht tragen, und der Prototyp soll nicht so tun als ob. Bewiesen wird
die **Form** — jeder Satz stammt aus einem Datensatz und trägt dessen Beleg —,
nicht die Antwortqualität.

## Der Befund, um den es geht

`js/search/search-engine.js` verlangt, dass **jeder** Term trifft
(`// AND: one absent term excludes the row`). Gemessen:

```
«stoerung melden»                      → 1 Treffer   (exakt richtig)
«heizung»                              → 1 Treffer   (Umgangssprache greift)
«Wie melde ich eine defekte Heizung?»  → 0 Treffer
```

`wie`, `ich` und `eine` streichen den Index, bevor «Heizung» gewertet wird. Der
Retriever ist nicht schwach; ihm fehlt der Schritt davor. `js/query.js` ist die
dümmstmögliche Fassung dieses Schritts — Stoppwörter entfernen — und macht aus
0 Treffern 20. Die Trefferseite zeigt beide Zahlen unter der Liste an.

## Was der Prototyp entscheidet

**1. Die Vorschläge sind gruppiert, nicht filterbar.**
Vorbild ist `map.geo.admin.ch`: Abschnittsköpfe je Inhaltsart mit Anzahl, dazu
Hervorhebung der Fundstelle. Das beantwortet «ich will nur Dienstleistungen
sehen», bevor jemand ein Bedienelement sucht — und kostet keinen Klick. Ein
Filterknopf im Hero müsste ohne Trefferzahlen auskommen; die Facetten auf der
Trefferseite haben sie.

**2. Die Hero-Suche zeigt Beispiele, keine Antwort.**
Beim Hineinklicken stehen vier echte Fragen im leeren Feld. Dort lernt jemand,
dass Fragen erlaubt sind — nicht aus einem Hinweistext, sondern weil sie
dastehen. Eine Antwort im Vorschlagsfeld ist ausgeschlossen: die Liste ist
`role="listbox"`, und eine Option darf keine Prosa und keine Verweise
enthalten.

**3. Wo die Suche heute abbricht, steht jetzt ein Weg.**
`js/search/search-suggest.js` ruft bei null Treffern `close()` — das Feld wird
still leer, genau wenn jemand eine Frage getippt hat. Hier erscheint stattdessen
«… als Frage stellen».

**4. Frageauflösung und Antwortbau sind zwei Funktionen.**
Der Schalter «Antworten anzeigen» nimmt nur den Block weg. Als beides am selben
Schalter hing, leerte «aus» auch die Trefferliste — wer die Antworten abschaltet,
will keine Antwort, keine kaputte Suche.

**5. Der Ausschalter sitzt am Antwortblock.**
Wer eine Antwort sieht, ist der Einzige, der entscheiden kann, ob er sie will.
Die Einstellung ist dauerhaft (`localStorage`), nicht pro Suche.

**6. Eine Relevanzschranke verhindert die gefährlichste Antwort.**
Einzelwort-Rückfallebenen finden immer etwas. «Wie viele Ferientage stehen mir
zu?» lieferte darüber eine sauber belegte Antwort über Mietobjekte — falsch,
aber überzeugend gesetzt. Quellen zählen nur aus Mehrwort-Abfragen; sonst
entfällt die Antwort. Die Liste bleibt grosszügig, die Antwort wird streng:
eine Liste bietet an, ein belegter Satz behauptet.

## Aufbau

```
index.html          Hülle, CD-Kaskade, Studien-Leiste
css/tokens.css      CD-Token + Intranet-Rampe + responsive text--* Rampen
css/cd.css          CD-Bauteile: btn · badge · notification · meta-info · search · listbox
css/suche.css       Vorschlagsfeld, Antwortblock, Facetten, Studien-Hülle
js/main.js          Start und Hash-Router
js/data.js          lädt data/*.json, baut den Index wie buildIndex()
js/query.js         Frageerkennung und Stichwortauflösung
js/answer.js        Antwortbau samt Relevanzschranke
js/suggest.js       gruppierte Vorschläge mit Hervorhebung
js/views.js         Startseite und Trefferseite
js/settings.js      der eine dauerhafte Schalter
```

## Zum Ausprobieren

- `bed` — gruppierte Vorschläge, Fundstelle hervorgehoben
- leeres Feld anklicken — die vier Beispiele
- `Wie melde ich eine defekte Heizung?` — 0 wörtliche Treffer, 20 nach Auflösung
- `Wie viele Ferientage stehen mir zu?` — die Antwort entfällt, korrekt
- Schalter oben rechts — Antworten weg, Treffer bleiben
