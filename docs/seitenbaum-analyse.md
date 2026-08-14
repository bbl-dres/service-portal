# Seitenbaum als gemeinsames Bauteil — Analyse

Grundlage für den Umbau von `.pf-sidebar` / `.pf-tree` zu einem Bauteil, das
jede Fachanwendung des Portals benutzt. Vorbild ist der Baum in
`docs/wireframes/260813 - Katalog mit Reitern_CD-kompakt.html`.

**Nur Befund und Vorschlag — noch nichts umgebaut.**

---

## 1 — Was heute existiert

Acht Oberflächen führen einen Seitenbaum. Gemessen wurde, wo die **Beschriftung**
beginnt, nicht die Polsterung der Zeile: das ist, was ein Leser als Einrückung
sieht.

| Oberfläche | ARIA | Symbole | Trennlinien | Beschriftung je Stufe |
|---|---|---|---|---|
| Liegenschaften | `tree` | jede Zeile | jede Zeile | L1 **56** |
| Bauprojekte | `tree` | jede Zeile | jede Zeile | L1 **56** |
| Mietverhältnisse | `tree` | jede Zeile | jede Zeile | L1 **56** |
| Workspace | `tree` | jede Zeile | jede Zeile | L1 **56** |
| Plan-Editor | `tree` | jede Zeile | jede Zeile | L1 **56** · L2 **72** |
| Metadaten-Katalog | — | nur Äste | jede Zeile | L1 **32** · L2 **48** · L3 **48** |
| Prozessdoku | — | keine | jede Zeile | L1 **48** · L2 **40** |
| Shop | — | keine | jede Zeile | L1 **32** |

Dahinter stehen **vier verschiedene Baumbauer**:

- `js/ui/spatial-tree.js` — `treeHTML(C, objects, { levels, leaf })`. Nimmt eine
  **flache Liste** und gruppiert sie nach Attributen (Land → Region → Ort →
  Wirtschaftseinheit → Objekt). Fünf Anwendungen.
- `js/apps/metadata-catalog.js` — echte Hierarchie, je Ast andere Stufen,
  geteilte Zeile (Link + eigenes Chevron), Kinder werden beim Öffnen gebaut.
- `js/apps/process-docs.js` — Ast → Dokument, `pf-tree--plain`.
- `js/apps/shop.js` — rekursive Kategorien beliebiger Tiefe.

Und **zwei Bedienmodelle**, die nicht dasselbe sind:

- **Auswählen** (die fünf geteilten): `role="tree"`, ein Tabstopp, Pfeiltasten,
  `aria-selected`. Ein Klick filtert die Trefferliste daneben, die Adresse
  bleibt.
- **Navigieren** (Katalog, Prozessdoku, Shop): eine Liste von Links. Ein Klick
  wechselt die Adresse.

Das ist kein Versehen, das zusammengeführt gehört. Ein ARIA-`tree` ist ein
Auswahl-Steuerelement; wo der Baum navigiert, wäre er die falsche Zusage. Das
Bauteil muss beides können.

---

## 2 — Was daran nicht stimmt

**B1 — Stufe 1 beginnt an drei verschiedenen Stellen.** 56px bei den geteilten,
32px bei Katalog und Shop, 48px bei der Prozessdoku. Kein Paar stimmt überein.

**B2 — Die Prozessdoku stellt die Hierarchie auf den Kopf.** L2 liegt bei 40px,
L1 bei 48px: das Kind steht **links** von seinem Elternteil. Ursache ist ein
Chevron **im Fluss** — L1 hat eines, L2 nicht, also fällt L2 um dessen Breite
nach links. Genau dieser Fehler wurde im Wireframe schon einmal behoben.

**B3 — Im Katalog fallen L2 und L3 zusammen** (beide 48px). Selbst verursacht:
`.pf-tree__fold` zieht sich mit `margin-left:calc(-1 * var(--tree-indent))` in
die Rinne, und die Beschriftung kommt mit. Die Stufe ist da, man sieht sie nicht.

**B4 — Jede Zeile trägt eine Trennlinie.** Bei sechzehn Kategorien im Shop sind
das fünfzehn Linien für eine Gliederung, die schon durch Einrückung dasteht. Der
Wireframe zieht **keine einzige** (`.tnode{border:0}`); nur die Seitenleiste
selbst hat einen Rand.

**B5 — Das Symbol ist beim geteilten Bauer Pflicht.** `rowContent()` ruft immer
`C.icon(...)`; jede Stufe **muss** ein `icon` deklarieren. Prozessdoku und Shop
haben deshalb gar keinen Baum aus diesem Bauer bauen können.

---

## 3 — Was der Wireframe anders macht

Drei Regeln, aus denen der ruhige Eindruck entsteht:

**W1 — Das Chevron steht ausserhalb des Flusses.**

```css
.tnode > .chev { position:absolute; left:calc(var(--ind) - var(--tree-gutter));
                 width:var(--tree-gutter); }
```

Es sitzt in einer festen Rinne links der Beschriftung. Damit beginnt eine Zeile
**mit** Chevron an derselben Stelle wie eine **ohne** — B2 kann gar nicht
entstehen.

**W2 — Das Symbol IST die Stufe.** Die Leiter lautet:

```
L1  --ind: gutter                              Symbol im Fluss → Text bei 53
L2  --ind: gutter + icon                       kein Symbol     → Text bei 53
L3  --ind: gutter + icon + step                                → Text bei 69
L4  --ind: gutter + icon + step + step/2                       → Text bei 77
```

L1 und L2 stehen **bündig**: L1 füllt die Symbolspalte mit einem Symbol, L2
benutzt dieselbe Breite als Einrückung. Ab L2 läuft eine gleichmässige Leiter.
L4 rückt nur einen halben Schritt ein, weil ein Attribut kein Chevron hat und ein
ganzer Schritt eine leere Aufklappspalte hinterliesse.

**W3 — Keine Zeilentrenner.** Hierarchie trägt die Einrückung, Zugehörigkeit die
Fläche der ausgewählten Zeile, Wichtigkeit die Schriftstärke.

---

## 4 — Anforderungen

Aus dem Auftrag, geschärft:

**A1 — Trennlinien nur an Abschnittsgrenzen.** «Katalog» ist etwas anderes als
die drei Äste darunter, also eine Linie dazwischen — und sonst keine. Das
verlangt einen ausdrücklichen Abschnittsbegriff, nicht eine Regel je Zeile.

**A2 — Symbole erklärt, nicht erzwungen.** Welche Zeilen eines bekommen und
welches, muss die Anwendung sagen können; ohne Angabe kein Symbol und **keine
leere Spalte**.

**A3 — Chevron an jedem Elternteil mit Kindern**, und nur dort. Ausserhalb des
Flusses (W1).

**A4 — Eine einzige Leiter**, die auf jeder Oberfläche dieselbe ist und in der
kein Kind links von seinem Elternteil steht.

---

## 5 — Der Knackpunkt: Symbol und Einrückung

A2 und A4 ziehen gegeneinander. Drei Auflösungen:

| | Regel | Folge |
|---|---|---|
| **(a)** | Symbol im Fluss, Einrückung = Tiefe × Schritt | Zwei **Geschwister**, eines mit Symbol, stehen um 24px versetzt. Unbrauchbar. |
| **(b)** | Stufe führt Symbole: Zeichen zeichnen, wenn vorhanden — sonst nichts | Bündig, **solange** jede Zeile der Stufe eines mitbringt. Bringt eine keines mit, fällt sie auf (a) zurück. |
| **(c)** | Stufe führt Symbole: Spalte **reservieren**, Zeichen zeichnen, wenn vorhanden | Bündig, immer, ohne Bedingung. Eine symbollose Zeile in einer symbolführenden Stufe trägt eine leere Spalte. |

### Entschieden: (c) — 2026-08-14

Zuerst stand hier **(b)**, mit zwei Begründungen. Eine unabhängige
Design-Durchsicht hat beide widerlegt, und die Messungen geben ihr recht:

**Die erste Begründung war falsch.** Gegen (c) stand hier, jede symbollose Zeile
trüge ein 24px-Loch, «bei Shop und Prozessdoku der ganze Baum». Das ist nicht,
was (c) tut. Die Spalte wird nur reserviert, wo die **Stufe** Symbole erklärt;
Shop und Prozessdoku erklären auf keiner Stufe welche, also reserviert (c) dort
**nichts**. Die eine handfeste Kosten, die gegen (c) angeführt wurde, existiert
nicht. Sie entsteht ausschliesslich in einer Stufe, die Symbole **verlangt** und
dann bei einer Zeile keines liefert — und dort *soll* es auffallen.

**Die zweite Begründung war eine Bedingung, keine Eigenschaft.** «Bündig, weil
heute nie gemischt» ist kein Verhalten des Bauteils, sondern eine Annahme über
seine Aufrufer. Nichts erzwingt sie. Am Tag, an dem eine Anwendung einer Stufe
ein Symbol gibt und einer Schwesterzeile keines, liefert (b) genau das Versagen,
für das (a) verworfen wurde. Gemessen an der Vergleichstafel des Wireframes mit
gemischten Daten: (b) **53 / 29 / 53** — die mittlere Zeile 24px daneben —
gegen (c) **53 / 53 / 53**.

Ein Bauteil, das nur richtig liegt, solange sich alle an eine ungeschriebene
Regel halten, ist kein Bauteil. **(c)** hält ohne Regel.

Praktisch heisst das: `levels[i].icons` reserviert die Spalte, `node.icon`
füllt sie. Wer keine Symbole will, erklärt keine, und es wird nichts reserviert.

---

## 6 — Vorschlag für die Schnittstelle

Das Bauteil darf keine Datenform kennen. Es nimmt **Knoten**; das Übersetzen
bleibt Sache der Anwendung, die ihre Daten kennt.

```js
C.sidebarTree({
  title: 'Katalog',
  mode: 'nav',           // 'nav' = Links (Adresse wechselt)
                         // 'select' = ARIA-tree (Auswahl, Adresse bleibt)
  levels: [              // je Stufe: hat sie Symbole? (Punkt 5, Variante b)
    { icons: true }, { icons: false }, { icons: false }, { icons: false },
  ],
  sections: [            // ein Abschnitt = eine Gruppe zwischen Trennlinien (A1)
    [{ id: 'root', label: 'Katalog', count: 44, icon: 'Home', href: BASE }],
    [
      { id: 'objekt', label: 'Geschäftsobjekte', count: 19, icon: 'Apps',
        href: '…', open: true, children: [ … ] },
      { id: 'tabelle', label: 'Systeme', count: 10, icon: 'Database', href: '…' },
      { id: 'referenz', label: 'Referenzdaten', count: 15, icon: 'List', href: '…' },
    ],
  ],
});
```

Ein Knoten: `{ id, label, count, icon?, href|value, children?, open?, state? }`.

- `children` darf eine **Funktion** sein — der Katalog baut fünfundsiebzig Felder
  erst beim Aufklappen, und das muss das Bauteil können.
- `state: 'active' | 'path'` für die zweifarbige Markierung, die es heute schon
  gibt.
- **Geteilte Zeile**: entsteht von selbst, wenn ein Knoten `href` **und**
  `children` hat — dann wählt der Link und das Chevron klappt auf, wie im
  Katalog. Ohne `href` schaltet die ganze Zeile.

Die drei Datenformen übersetzen dann so:

- **flach + Gruppierachsen** (Liegenschaften, Bauprojekte, Mietverhältnisse,
  Workspace, Plan-Editor): `spatial-tree.js` bleibt — aber als **Adapter**, der
  Knoten liefert, statt selbst Markup zu schreiben. Seine `levels`/`leaf`-API
  bleibt für die fünf Aufrufer unverändert.
- **echte Hierarchie** (Katalog): die Anwendung baut die Knoten direkt.
- **rekursiv** (Shop, Prozessdoku): eine Funktion, die sich selbst aufruft.

---

## 7 — Was der Umbau nicht verlieren darf

Alles davon ist heute in Betrieb und durch Tests abgedeckt:

- `syncTreeCounts` — Zähler folgen der Filterung, plus `is-first-row` (die
  führende Zeile darf keine Linie tragen, auch wenn Filtern die erste versteckt)
- `markTree` / `restoreTreeSelection` — Auswahl und Pfad wiederherstellen
- `wireTree` — Pfeiltasten, Home/End, ein Tabstopp, `aria-expanded`
- die sechs Verschachtelungsstufen in `explorer.css`
- der Zähler als **blosse Zahl** im DOM (die Klammern zeichnet CSS) mit
  `sr-only`-Einheit dahinter
- `.shop-layout .pf-sidebar` (eigene Höhe)
- Mindest-Trefferfläche 24px unter `pointer:coarse`

---

## 8 — Offene Fragen

1. **Punkt 5** — Variante (b)? Das ist die eine Entscheidung, die den Rest
   bestimmt.
2. **«no icon should collapse the div»** — ich lese das als: eine fehlende
   Symbolangabe darf das Layout nicht verschieben. Unter (b) ist das erfüllt.
   Falls stattdessen gemeint war, dass eine symbollose Zeile trotzdem auf- und
   zuklappen können muss: ebenfalls erfüllt, das Chevron hängt an `children`,
   nicht am Symbol.
3. **Trennlinien** — nur zwischen Abschnitten auf **oberster** Stufe, oder auch
   tiefer? Im Katalog reicht die eine unter «Katalog».
4. **Reihenfolge des Umbaus** — Vorschlag: Bauteil + Katalog zuerst (der ist der
   anspruchsvollste Fall und der einzige mit geteilter Zeile und späten
   Kindern), dann Prozessdoku und Shop (die gewinnen am meisten, B2 und B4),
   die fünf geteilten zuletzt über den Adapter, weil dort am meisten Verhalten
   hängt.

---

## 9 — Stand 2026-08-14: was der Umzug der übrigen sieben kostet

Der Katalog läuft auf dem Bauteil, die anderen sieben nicht. Die Frage ist
nicht mehr «bauen wir ein Bauteil» — es steht —, sondern ob die sieben
umziehen oder ob eine reine CSS-Angleichung reicht. Deshalb zuerst gemessen,
was heute überhaupt auseinanderläuft.

### 9.1 Gemessen, nicht behauptet

Beide bei 1440px, gleiche Fragen an beide (`scratchpad/two-trees.mjs`):

| | alt (Portfolio, 94 Zeilen) | Bauteil (Katalog) |
|---|---|---|
| Leiter | L1=97 L2=113 L3=129 L4=145 **L5=137** | L1=85 L2=109 L3=125 L4=141 |
| Symbol | **94/94** — Pflicht | **4/17** — Spalte reserviert, Angabe frei |
| Zähler | `(1)` — Klammern aus CSS `::before` | `44` — blank |
| Aktiv | Schlagschatten, kein linker Balken | 3px grau, kein Schatten |
| Pfad | `rgb(31,41,55)` dunkelgrau | offen (siehe 9.5) |
| Chevron | `static` — im Fluss | `absolute`, z-index 2 |
| Trennlinien | **auf jeder Zeile** (`border-top`, explorer.css:68) | nur zwischen Abschnitten |
| Abschnitte | keine | 2 |

> Messfehler im ersten Durchgang, hier festgehalten, damit ihn niemand
> wiederholt: der Kopf zählte `border-bottom` und fand null. Die Linie wird
> aber als **führende** Regel gezeichnet (`border-top`, erste Zeile
> transparent) — der Kommentar in explorer.css:42 erklärt auch, warum. Der
> Screenshot zeigte sie die ganze Zeit; die Messung war falsch, nicht das Bild.

Zwei Zahlen sind die eigentliche Nachricht:

**L5=137 nach L4=145.** Das Kind steht **8px links von seinem Elter**. Die
umgekehrte Hierarchie, die ich in der Prozessdoku gefunden hatte, steckt auch
im Portfolio — sie war nur nie aufgefallen, weil die fünfte Stufe (`__sub`,
die Geschosse) selten aufgeklappt wird. Das ist kein Stilunterschied, das ist
eine falsche Aussage über die Daten.

**94/94 gegen 4/17.** Der alte Baum *muss* auf jeder Zeile ein Symbol
zeichnen, weil `treeHTML` `C.icon(levelDef.icon)` bedingungslos ausgibt. Das
ist Punkt B5 und der Grund, warum im Portfolio auf jeder Zeile ein Globus,
eine Landkarte und eine Nadel stehen, auch wo sie nichts unterscheiden.

### 9.2 Ein Unterschied, der keiner ist

Der Messkopf fand im Katalog kein `aria-level` und keine `role="treeitem"`.
Das ist **Absicht, kein Mangel**: das Bauteil vergibt die Baumrollen nur im
`select`-Modus. Im `nav`-Modus sind die Zeilen Links, die die Seite wechseln —
und ein Satz Links soll sich nicht als Bedienelement ausgeben, sonst erwartet
die Vorlesesoftware Pfeiltastenbedienung, die es dort nicht gibt. Die beiden
Modi haben also verschieden viel ARIA, und das ist richtig so.

Für den Umzug heisst das aber: die sieben teilen sich **nicht** einen Weg.
Prozessdoku und Shop sind `nav` — derselbe Pfad, den der Katalog schon
beweist. Die fünf Explorer sind `select` — und dieser Pfad ist **gebaut, aber
von keiner Oberfläche je benutzt worden**. Das ist das eigentliche Risiko.

### 9.3 Der Adapter ist kleiner als gedacht

`treeHTML` tut zwei Dinge, die nichts miteinander zu tun haben: es
**gruppiert** eine flache Objektliste über `levels` zu einer Hierarchie, und
es **zeichnet** daraus Markup. Nur das Zeichnen ist doppelt. Die Gruppierung
ist wertvoll und im Bauteil nicht vorhanden.

Also trennen statt ersetzen: `objectsToNodes(objects, {levels, leaf})` behält
die Gruppierung Zeile für Zeile und gibt Knoten zurück statt HTML; `treeHTML`
wird zu `C.sidebarTree(objectsToNodes(...))`. **Die Aufrufstellen der fünf
Apps ändern sich nicht.** `markTree`, `wireTree`, `syncTreeCounts` und
`restoreTreeSelection` bleiben als Namen bestehen und arbeiten gegen das neue
Markup.

Ein Glücksfall dabei: `leaf.children` — die Geschosse im Plan-Editor, die
einzige Stelle mit einer Ebene unter dem Blatt — trifft genau auf die
Funktions-Kinder, die das Bauteil für die langen Attributlisten schon hat.
Dieselbe Mechanik, zwei Anlässe.

### 9.4 Die zwei Wege, ehrlich gerechnet

**(A) Nur CSS angleichen.** Klammern weg, Aktivmarkierung angleichen, Chevron
aus dem Fluss nehmen — das geht alles im Stylesheet, ohne eine Zeile
JavaScript. Was damit **nicht** geht: das Pflichtsymbol (B5, steckt im
Markup), Abschnitte (gibt es im alten Markup nicht), und die L5-Umkehrung nur
mit Mühe. Vor allem bleiben zwei Implementierungen stehen, die beim nächsten
Mal wieder auseinanderlaufen — genau das, was gerade passiert ist.

**(B) Umziehen.** Löst alle sieben Punkte an einer Stelle und lässt eine
Codebasis zurück statt zwei. Kostet die Absicherung des `select`-Modus.

Empfehlung: **(B), aber in der Reihenfolge des Risikos** — nicht (A) als
Zwischenschritt, denn die CSS-Arbeit aus (A) wäre nach (B) wegzuwerfen.

### 9.5 Reihenfolge

1. **Prozessdoku und Shop** (`nav`) — bewiesener Pfad, kleine Bäume, sofortiger
   Gewinn: die Umkehrung und die Trennlinien verschwinden.
2. **`objectsToNodes` + Portfolio als Pilot** — der reichste Fall: fünf Stufen,
   Blattkinder, und er zeigt die L5-Umkehrung. Was hier hält, hält überall.
3. **Projekte, Mietobjekte, Arbeitsplätze, Plan-Editor** — gleiche Form, danach
   mechanisch.
4. **Pfadmarkierung** (offen aus dem Review, 1.11:1): erst danach entscheiden.
   Sie trägt jetzt Tiefeninformation, die vorher die Einrückung trug — und die
   Einrückung ist nach dem Umzug in allen sieben eine andere.
