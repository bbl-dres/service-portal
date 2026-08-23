# Tabellen — eine Darstellung, keine Ausnahmen (August 2026)

**Geteiltes Dokument.** Identische Kopie in `service-portal/docs/table-consistency.md`
und `tenant-portal/docs/table-consistency.md`. Referenz ist der Code von
[`swiss/designsystem`](https://github.com/swiss/designsystem),
`css/components/table.postcss`.

---

## 1. Befund

Beide Prototypen wurden bei 1440 px gerendert und jede Tabellenzelle mit einem
Symbol oder einer Auszeichnung ausgelesen (Playwright/Chromium). Geprüft wurden
13 tabellenführende Routen.

### 1.1 Symbolgrössen — drei Werte für dieselbe Sache

| Oberfläche | Box | Klasse | Tinte* |
| --- | --- | --- | --- |
| Service-Portal · Anhänge eines Vorgangs | 16 px | `.icon.icon--base` | 16 px |
| Service-Portal · Datensatzliste (Favoritenstern) | **24 px** | `.icon.icon--md` | **24 px** |
| Service-Portal · Bauwerksdokumente, Objekt-Typ | 16 px | `.icon.icon--base` | 16 px |
| Mieterportal · Anhänge eines Vorgangs | 24 px | `.inline-icon.attachment__icon` | ~16 px |
| Mieterportal · Dokumentenliste | 24 px | `.inline-icon` | ~16 px |

\* «Tinte» = die tatsächlich gezeichnete Fläche. Die beiden Portale bauen
Symbole unterschiedlich: das Service-Portal als CSS-Maske (Box = Tinte), das
Mieterportal als `<use>` auf die CD-SVGs, die im `viewBox` eine Innenkante
tragen (Tinte ≈ ⅔ der Box). **24 px im Mieterportal und 16 px im Service-Portal
zeichnen daher gleich gross** — der echte Ausreisser ist der 24-px-Stern in der
Datensatzliste, der neben einem 16-px-Dateisymbol in derselben Anwendung steht.

### 1.2 Fettschrift — fünf Tabellen, fünf Meinungen

| Oberfläche | Fett | Quelle |
| --- | --- | --- |
| Service-Portal · Ausstattung | Spalte «Bezeichnung» | `<strong>` im Renderer |
| Service-Portal · Kontakte | Spalte «Name» | `<strong>` im Renderer |
| Service-Portal · Bauwerksdokumente | Spalte «Titel» | `<strong>` im Renderer |
| Service-Portal · Projektkosten | Spalte «BKP» | `<strong>` im Renderer |
| Service-Portal · Ausstattungsstandards | Spalte «Ausstattungsstandard» | `<strong>` im Renderer |
| Mieterportal · Verträge | Spalte «Referenz» | `<strong>` im Renderer |
| Mieterportal · Dokumente (Liegenschaft) | Spalte «Titel» | `<strong>` im Renderer |
| Mieterportal · Vorgänge, Geschosse | erste Spalte | `<strong>` im Renderer |

Jede Tabelle zeichnete eine ANDERE Spalte aus, und keine tat es aus demselben
Grund. Das Service-Portal hatte die Regel bereits einmal gefasst — sein
`table.css` trägt sie als Kommentar:

> *«ONE font weight across the row … in list views, bold captured entire
> descriptions and made every table look ranked.»*

— und dann in fünf Renderern per `<strong>` wieder unterlaufen. CSS-Regel und
Markup widersprachen sich; das Markup gewann.

---

## 2. Entscheid

Zwei Regeln, die jede Tabelle in beiden Portalen befolgt, ohne Ausnahme pro
Oberfläche.

### T1 · Ein Symbolmass: 16 px Tinte

Ein Symbol in einer Zelle hat die Grösse des Fliesstexts daneben. Eine Zeile
soll als EINE Zeile lesbar sein, nicht als Bild mit Bildunterschrift.

```css
/* Service-Portal — Maske, Box = Tinte */
.table__icon { width:var(--sp-4); height:var(--sp-4); }        /* 16 px */

/* Mieterportal — CD-SVG mit viewBox-Innenkante, Box ≈ 1,5 × Tinte */
.table__icon { width:var(--icon-base); height:var(--icon-base); }  /* 24 px Box → 16 px Tinte */
```

Eine Klasse, `.table__icon`, an jeder Zelle mit Symbol. Die Box unterscheidet
sich zwischen den Portalen, weil ihre Symbolsysteme sich unterscheiden; **die
gezeichnete Grösse ist dieselbe**, und das ist die Eigenschaft, die man sieht.
Ein Lucide-Glyph in einer Zelle trägt keine Innenkante und nimmt die 16-px-Box
direkt.

### T2 · Keine Fettschrift, ausser in der Summenzeile

```css
.table tbody td, .table tbody th,
.table tbody td *, .table tbody th * { font-weight:regular; }
.table tfoot td, .table tfoot th,
.table tfoot td *, .table tfoot th * { font-weight:bold; }
```

Gewicht ist keine Spalteneigenschaft. Die einzige Ausnahme ist die
Summenzeile im `<tfoot>`: dort markiert Fett eine andere ART von Zeile, nicht
eine wichtigere.

Die Regel steht im CSS **und** die `<strong>` sind aus den Renderern
verschwunden. Nur eines von beidem zu tun, war der Zustand, der zu diesem
Befund geführt hat: eine CSS-Regel, die Markup übersteuert, ist eine Regel, die
beim nächsten Renderer wieder unterlaufen wird — und ein `<strong>`, das nicht
fett zeichnet, ist irreführendes Markup.

---

## 3. Umgesetzt

| | Service-Portal | Mieterportal |
| --- | --- | --- |
| T1 `.table__icon` eingeführt | umgesetzt | umgesetzt |
| T1 Aufrufstellen umgestellt | 5 (Anhänge, Favoritenstern, Objekt-Typ, Bauwerksdokumente) | 2 (Anhänge, Dokumentenliste) |
| T2 CSS-Regel | umgesetzt | umgesetzt |
| T2 `<strong>` entfernt | 5 Renderer | 3 Renderer |

Nachgemessen: alle Tabellenzellen-Symbole zeichnen 16 px, keine
`tbody`-Zelle in einer der 13 geprüften Routen trägt noch Fettschrift.
