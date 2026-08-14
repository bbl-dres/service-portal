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
