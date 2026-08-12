# Code-Review, dritter Durchgang (2026-08-12)

Frische Sicht auf Performance, Fehler und Nebenläufigkeit, plus Gelegenheiten,
gleichartigen Code zu einem wiederverwendbaren Baustein zusammenzuziehen.
`docs/code-review.md` (zwei frühere Durchgänge) diente als Kontext, nicht als
Befundliste: vieles dort ist erledigt oder überholt.

## Was dieser Durchgang tatsächlich geprüft hat

Ehrlichkeitshalber zuerst der Umfang. Das Projekt hat 119 JS-Module (1,9 MB) und
32 Stylesheets (420 KB). Eine Zeile-für-Zeile-Prüfung aller Module war in einem
Durchgang nicht zu leisten, also wurden Klassen von Fehlern gezielt gesucht statt
Dateien der Reihe nach gelesen:

| Geprüft | Methode |
|---|---|
| Route-Lebenszyklus, Abbruch, Wettläufe | `js/routing/router.js` vollständig gelesen; alle `await`-Stellen in `js/pages` + `js/apps` auf `ctx.stale()`-Wachen geprüft |
| Horcher-Lecks | alle 177 `addEventListener`-Stellen kategorisiert; jeder `wire*`-Aufruf daraufhin geprüft, ob sein Entsorger registriert wird UND ob sein Ziel den Neuaufbau überlebt |
| Timer-Lecks | alle `setTimeout`/`setInterval` ausserhalb `js/vendor` |
| Startlast | Importgraph der Startroute `#/` vermessen |
| Datenzugriff | `js/core/index.js` (Laden, `ensure`, Fallbacks, Validierung) vollständig |
| Duplikation | die vier Katalogseiten strukturell verglichen |

**Nicht geprüft:** `js/floorplan-editor/**` (103 KB Controller), `js/plan-check/**`,
`js/vendor/**`, die Three.js-Ansicht. Das sind ~350 KB der Codebasis und der
nächste sinnvolle Abschnitt.

## Der allgemeine Befund

Die Codebasis ist in gutem Zustand. Die Muster, die in solchen Reviews sonst
Treffer liefern, sind hier bereits systematisch gelöst: `AbortController` statt
loser Horcher, `ctx.stale()` vor jedem späten `innerHTML`, ein Ticket-System im
Router gegen Ausser-Reihe-Renderings, `PENDING`/`LOADED` gegen Doppelanfragen,
Formvalidierung beim Laden statt Absturz im ersten Zugriff. Die Befunde unten
sind deshalb wenige und spezifisch, nicht flächig.

---

## Befunde

### B1 · Horcher-Leck am Shop-Katalog (Fehler, klein, echt)

`js/apps/shop.js:235` verwirft den Entsorger:

```js
if (view === 'list') C.wireTableRows(mount);
```

`wireTableRows(root)` hängt einen Klick-Horcher an `root` und gibt seinen
Entsorger zurück. `mount` ist `#main-content` — das Element **überlebt jeden
Renderdurchgang**, ersetzt wird nur sein `innerHTML`. Jede Navigation innerhalb
des Shops in der Listenansicht (Suche, Sortierung, Filter, Blättern) hängt also
einen weiteren Horcher an dasselbe Element, und keiner wird je entfernt — auch
nicht beim Verlassen des Shops.

Sichtbare Folge heute gering (jeder Horcher löst denselben Link aus, und der
Router verwirft die Folgeaufrufe, weil sich der Hash nicht ändert), aber es ist
ein echtes Leck und eine latente Doppelnavigation.

**Warum es passieren konnte:** `wireTableRows` wird an 12 Stellen aufgerufen, in
drei verschiedenen Mustern — mit `ctx.onUnmount`, ohne, und auf einem Kindknoten
statt auf `mount`. Ob ein verworfener Entsorger leckt, hängt allein davon ab, ob
das Ziel den Neuaufbau überlebt. Das ist an der Aufrufstelle nicht ablesbar.

**Empfehlung:** nicht nur die eine Stelle korrigieren, sondern die Falle
schliessen — `wireTableRows` idempotent pro Wurzel machen. Ein zweiter Aufruf auf
derselben Wurzel ersetzt dann den ersten, statt sich zu addieren. Danach ist eine
vergessene Entsorgung folgenlos.

### B2 · Die Startseite lädt 50,7 KB Wissensinhalte, die sie nicht braucht (Performance)

`js/pages/home.js:10` importiert `search-suggest.js` statisch, dieses wiederum
`js/knowledge-content.js` (50,7 KB) — für die Vorschlagsliste des Suchfelds.

Der Modulkopf von `search-suggest.js` benennt genau dieses Problem und hält sich
dann nicht daran:

> «Building the full index would load another 236 KB on the home page just in
> case someone MIGHT type, undoing the startup work in docs/code-review.md §1.»

Der Wissensindex ist derselbe Fall in klein: er wird ausschliesslich in
`suggestIndex()` gelesen, und das läuft erst ab dem zweiten getippten Zeichen.
Bis dahin liegen 50,7 KB im kritischen Pfad der meistbesuchten Route.

Zum Vergleich: der Startdatenbestand wurde bewusst auf zwei Dateien reduziert
(`services.json` + `reference-data.json`), weil elf Dateien den ersten Inhalt auf
7,7 s gedrückt hatten. Dieselbe Absicht, andere Ebene.

**Empfehlung:** `knowledge-content.js` erst beim ersten Tastendruck dynamisch
importieren.

### B3 · Vier Katalogseiten wiederholen dasselbe Gerüst (Komplexität)

`services.js`, `applications.js`, `catalog.js` (und in Teilen `media-library.js`,
`shop.js`) bauen alle dieselbe Ansicht:

```
catalogueState → filtern/sortieren/clampen → aktive Pillen →
pageHeader + catalogueBar + activeFilters + catalogueResults →
announceCatalogue + wireCatalogue + wireTableRows
```

Die schweren Teile sind bereits Bausteine (`C.catalogueState`,
`C.catalogueBar`, `C.catalogueResults`, `C.wireCatalogue`, `C.filterGroup`).
Was sich pro Seite wiederholt, ist die **Verdrahtung und die Namensvergabe**:
jede Seite erfindet sieben zusammengehörige IDs neu (`app-search`/`aq`/
`app-count`/`app-sort`/`app-filter`/`app-filters`/`app-page`) und wiederholt
denselben Dreiklang aus Ansage, Verdrahtung und Zeilenklick.

Das ist auch die Ursache von B1: fünf Verdrahtungsstellen, fünf Gelegenheiten,
eine Entsorgung zu vergessen.

**Empfehlung:** ein `C.catalogueView({ prefix, … })`, das die IDs aus einem
Präfix ableitet, das Gerüst rendert und **einen** Entsorger zurückgibt.

---

## Plan

Reihenfolge nach Risiko, jeder Schritt einzeln prüfbar:

1. **B1** — `wireTableRows` idempotent machen, Aufrufstelle in `shop.js` mit
   `ctx.onUnmount` korrigieren. Regressionstest, der doppelte Verdrahtung
   nachweist.
2. **B2** — dynamischer Import in `search-suggest.js`, Reihenfolge-Wache gegen
   überholte Ergebnisse. Test, der die Startroute auf den Wissensindex prüft.
3. **B3** — `C.catalogueView` einführen und die drei Katalogseiten darauf
   umstellen. Nur diese drei: `shop.js` und `media-library.js` haben eigene
   Layouts (Sidebar, Galerie-Deeplinks) und werden nicht in dieselbe Form
   gezwungen.

Nicht in diesem Durchgang: `floorplan-editor` und `plan-check` prüfen.

---

## Umgesetzt

### B1 → `js/ui/components/catalogue.js`, `js/apps/shop.js`

`wireTableRows` führt jetzt eine `WeakMap` Wurzel → `AbortController`: eine
zweite Verdrahtung derselben Wurzel **ersetzt** die erste. Die Eigenschaft liegt
damit in der Funktion statt im Vertrauen auf zwölf Aufrufstellen. Zusätzlich
entsorgt `shop.js` seinen Entsorger jetzt über `ctx.onUnmount`.

Nachweis, dass die Prüfung beisst: mit ausgebauter Wache meldet
`test-lifecycle-hygiene.mjs` «3 navigation(s)» statt 1.

### B2 → `js/search/search-suggest.js`

`knowledge-content.js` wird dynamisch beim ersten Tastendruck geladen. Die
Startroute fordert es nicht mehr an (Messung im Test über
`performance.getEntriesByType('resource')`): **50,7 KB weniger im kritischen
Pfad von `#/`.**

Weil der Index jetzt asynchron kommt, kann ein Tastendruck verlieren: eine
Versionszählung verwirft das Ergebnis einer überholten Eingabe, ein
`detached`-Merker das einer bereits verlassenen Route. Beides ist geprüft —
schnelles Weitertippen und Leeren des Feldes.

### B3 → `C.catalogueView`

Neuer Baustein in `js/ui/components/catalogue.js`; `services.js`,
`applications.js` und `catalog.js` sind darauf umgestellt. Alle Element-IDs
leiten sich aus einem Präfix ab (`app` → `app-search`/`app-q`/`app-count`/…),
die drei Verdrahtungsaufrufe sind einer, und der Zeilenklick-Entsorger wird im
Baustein registriert — eine Seite kann ihn nicht mehr vergessen.

Nebenbei erledigt: die Feld-IDs `aq`/`sq`/`dsq` benannten nichts mehr.

Bilanz der drei Seiten: −189 Zeilen, +91 im Baustein.

`shop.js` und `media-library.js` bleiben bewusst aussen vor (eigene Layouts).

## Prüfung

Neu: `scripts/test-lifecycle-hygiene.mjs` (beide Eigenschaften, beide fallen
ohne die Korrektur um).

Grün nach der Umstellung: `test-catalogue`, `check-services`, `test-content`,
`test-search`, `test-bookmarks`, `test-shop`, `test-media-library`,
`test-routes`, `test-route-needs`, `test-html-contracts`, `check-consistency`,
`check-layout`, `check-banner`, `test-ui-state`, `test-data-integrity`,
`check-css-tokens`, `check-english-code` (bis auf drei Altbefunde in
`scripts/build-project-report-data.mjs`).
