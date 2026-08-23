# Vorgangs-Ansichten — Cross-Portal-Abgleich (August 2026)

**Geteiltes Dokument.** Identische Kopie in `service-portal/docs/case-view-alignment.md`
und `tenant-portal/docs/case-view-alignment.md`. Referenz ist der Code von
[`swiss/designsystem`](https://github.com/swiss/designsystem) — gelesen wurden
`css/components/*.postcss`, `css/layouts/grids.postcss`, `css/layouts/section.postcss`
und die Vue-Vorlagen unter `app/components/ch/`, nicht die Dokumentation darüber.

Gegenstand sind die zwei Seiten, die beide Prototypen doppelt führen:

| | Service-Portal (grosse Ambition) | Mieterportal (mittlere Ambition) |
| --- | --- | --- |
| Liste | `#/my-cases` | `#/inbox` |
| Detail | `#/my-cases/:id` | `#/inbox/:id` |
| Code | `js/pages/my-cases.js` | `js/app.js` (`renderInbox`, `renderCaseDetail`) |

---

## 1. Ausgangslage — gemessen, nicht geschätzt

Beide Seiten wurden bei 1440 px gerendert und die berechneten Stile ausgelesen
(Playwright/Chromium, `deviceScaleFactor: 1`). Was bereits übereinstimmt, steht
hier bewusst mit, damit die Angleichung es nicht versehentlich zerstört.

### 1.1 Bereits deckungsgleich

| Eigenschaft | Wert in beiden | CD-Quelle |
| --- | --- | --- |
| `.container` max-width / padding | 1544 px / 48 px | `layouts/container.postcss` |
| `h1` | 40 px / 700 / 50 px Zeilenhöhe | `foundations/typography.postcss` |
| Tabs: Leiste | `border-bottom: 1px #e5e7eb` | `tab.postcss:31-38` |
| Tabs: Control | `padding: 16px`, erstes `padding-left: 0` | `tab.postcss:47-70` |
| Tabs: Schiene | 3 px, `left/right: 16px`, erstes `left: 0` | `tab.postcss:52-58` |
| Tabs: aktiv NICHT fett | `font-weight: 400` | `tab.postcss:60-66` |
| Leiste → Panel | 32 px | `tab.postcss:79-82` (`pt-8`) |
| Badge | 16 px, `border-radius: 9999px`, `padding: 3.5px 16px` | `badge.postcss:5-9` |
| Doppelpunkt in `dl` | `content: "\00A0:"` (CSS, nicht im String) | Hauskonvention, beidseitig gleich |
| `.meta-info` | `text--sm`, grau, Trenner `|` mit `px-2 lg:px-3` | `meta-info.postcss:5-18` |

Das ist die Grundlage: die Primitive stimmen. Auseinander läuft die **Anatomie**
— welche Bausteine in welcher Reihenfolge zusammengesetzt werden.

### 1.2 Abweichungen — Detailseite

| # | Merkmal | Service-Portal | Mieterportal |
| --- | --- | --- | --- |
| D1 | Kopfbereich | Badge-Zeile → `h1` = «Referenz — Titel» → `.lead` | `.overtitle` (Prozess, versal) → `h1` = Titel → `.page-header__sub` |
| D2 | Reiter | 3: Daten · Anhänge · 2 · Verlauf | 4: Übersicht · Anhänge (2) · Verlauf · Kommentare (0) |
| D3 | Zählerformat | `· 2` | `(2)` |
| D4 | Übersicht-Layout | `.box`-Kartengitter + «Eckdaten» in grauer Box | vertikaler Stapel voller Breite, vier `dl` untereinander |
| D5 | Genutzte Breite | 98 % | 100 % Panel, **aber** Werte enden bei ~35 % — der Rest ist leer |
| D6 | Abschnittstitel | `h3`, ohne Linie, `margin-bottom: 8px` | `h2`, `padding-bottom: 12px` + Trennlinie |
| D7 | `dl` Schriftgrad | 16 px | 16 px (`dt`) / 18 px (`dd`) |
| D8 | `dl` Labelspalte | `fit-content` → 196 px | fix 220 px |
| D9 | `dl` Abstände | `0 32px` | `8px 24px` |
| D10 | `dt` Farbe | `#4b5563` (gray-600) | `#6b7280` (gray-500) |
| D11 | Pipeline | 44 px hoch, 14 px, Icons, `<ol>` + `aria-current="step"` | 40 px hoch, 16 px, Icons, `<div role="list">` |
| D12 | Pipeline-Zustände | done / active / todo | done / active / todo / **rueckfrage** / **rejected** |
| D13 | Anhänge | `ul.download-items` (CD DownloadItem) | `ul.attachment-list` (Hausliste) |
| D14 | Anhänge leer | `C.empty(…)` | nackter `<p class="case-empty">` |
| D15 | Verlauf | `ul.timeline`, `.done`-Klasse | `ol.history-timeline`, farbige Punkte nach Ereignistyp |
| D16 | Kommentare | fehlt | `ul.case-comments` |
| D17 | Fussnote | «Seed-Vorgang (Demo) — nicht weiterführbar.» | — |

### 1.3 Abweichungen — Listenseite

| # | Merkmal | Service-Portal | Mieterportal |
| --- | --- | --- | --- |
| L1 | Kopf | `h1` + `.lead`, **keine** Aktion | `h1` + `.page-header__sub` + «+ Neuer Vorgang» |
| L2 | Kennzahlen | 2 `.stat`-Kacheln | keine |
| L3 | Katalogleiste | Suche · Anzahl · **Sortieren** · Filter | Suche · Anzahl · Filter |
| L4 | Spalten | Referenz · Titel · Typ · Aktualisiert · Status (+ Chevron) | Vorgang · Objekt · Prozess · Eingereicht · Status |
| L5 | Tabellenhinweis | — | «Klicken Sie eine Zeile, um Details zu öffnen.» |
| L6 | Seitenzahl | erst ab > 10 Zeilen | immer |

---

## 2. Der Kern: die Übersicht ist prozessabhängig, das Layout darf es nicht sein

Das ist der eigentliche Befund, nicht D4 allein.

Beide Portale führen **zwei Sorten von Vorgängen** und haben dafür zwei
Layouts gebaut:

- **getypte Vorgänge** — die Bedarfsmeldung im Mieterportal trägt ein
  ausmodelliertes Objekt (Antragsteller, Standort, NAW-Klasse, FTE, HNF2,
  Investitionspauschale …) und bekommt vier bis sechs handgeschriebene Abschnitte;
- **generische Vorgänge** — Schadensmeldung, Umzug, Sonderreinigung,
  Möbelbestellung, Raumbuchung, Bestellung tragen nur eine `data`-Map und
  bekommen einen einzigen Abschnitt «Angaben» plus die Vorgangsdaten.

Damit hängt nicht nur der **Inhalt** am Prozess, sondern auch das **Layout** —
und jeder neue Prozess bringt entweder eine neue Layout-Variante mit oder fällt
in den mageren generischen Fall. Bei elf Prozessen im Mieterportal und sechs im
Service-Portal ist das die Stelle, an der die zwei Prototypen künftig
auseinanderlaufen werden, unabhängig von jeder Pixelangleichung.

**Zusätzlich verschenkt der Stapel die Fläche.** Auf 1440 px ist das Panel
1344 px breit; die Labelspalte ist auf 220 px gepinnt, die Werte sind kurz
(«12», «810.140», «77 m²»). Gemessen enden die Werte bei ~35 % der Panelbreite.
Vier Abschnitte untereinander erzeugen dadurch eine 2336 px hohe Seite, deren
rechte zwei Drittel leer sind.

### 2.1 Entscheid — ein Deskriptor, ein Gitter

Die Übersicht wird zu **Daten plus einem Layout**, nicht zu Markup pro Prozess.

Jeder Prozess liefert eine Liste von Abschnitten:

```js
[
  { title: 'Standort',      rows: [{ label, value }, …] },
  { title: 'Flächenbedarf', rows: [ … ] },
  { title: 'Begründung',    rows: [ … ], wide: true },   // spannt beide Spalten
  { title: 'Vorgangsdaten', rows: [ … ] },               // invariant, immer zuletzt
]
```

Gerendert wird das **immer gleich**, mit den CD-Gitterklassen
(`layouts/grids.postcss`):

```html
<div class="case-overview grid gap--responsive grid--responsive-cols-2">
  <section class="case-section">
    <h3 class="case-section__title">Standort</h3>
    <dl class="detail-list">…</dl>
  </section>
  …
  <section class="case-section case-section--wide">…</section>
</div>
```

- `grid--responsive-cols-2` ist CD: `md:grid-cols-2` — eine Spalte auf dem
  Telefon, zwei ab 768 px. Bei 1440 px bekommt jeder Abschnitt ~650 px, was für
  Label plus Wert reicht und die Seitenhöhe etwa halbiert.
- `gap--responsive` ist CD (`grids.postcss:11-13`): `gap-5 xs:gap-7 sm:gap-9
  lg:gap-10 xl:gap-12 3xl:gap-16`.
- `.case-section--wide` (`grid-column: 1 / -1`) trägt, was eine Spalte nicht
  fasst: Fliesstext (Begründung, Beschreibung), die Auflagenliste einer
  Rückfrage, verknüpfte Objekte mit Aktion.
- **Drei Spalten wurden verworfen.** `grid--responsive-cols-3` gäbe ~430 px pro
  Abschnitt; die Labelspalte allein braucht 196–220 px, sodass jeder Wert
  umbräche — genau der Fehler, den das Mieterportal 2026-08 beim Abbau des
  vierspaltigen Kartengitters schon einmal behoben hat.

Damit ist ein neuer Prozess ein Deskriptor und kein Layout mehr. Ein Prozess
ohne getypte Felder erzeugt aus seiner `data`-Map automatisch Abschnitte; lange
Werte landen selbstständig in einem `--wide`-Abschnitt.

### 2.2 Warum die Labelspalte nicht mehr fix ist

Mit zwei Spalten sitzen zwei `dl` nebeneinander, deren Labels nichts
miteinander zu tun haben. Die feste Breite von 220 px (Mieterportal, gesetzt
damit vier gestapelte Listen bündig sind) ist genau dann falsch: sie schiebt in
einem Abschnitt mit kurzen Labels («FTE», «Menge») den Wert grundlos nach
rechts. Beide Portale nutzen künftig `fit-content(18rem)` — den Wert, den die
`.kv`/`.detail-list`-Rezepte ohnehin als Vorgabe tragen — und der Ausrichtungs-
grund entfällt mit dem Stapel.

---

## 3. Anhänge — die Tabelle bleibt, auch wenn sie leer ist

Heute ist der Reiter in beiden Portalen eine **Liste**, und bei null Anhängen
ein **einzelner Satz**: das Mieterportal zeigt `<p class="case-empty">Keine
Anhänge zu diesem Vorgang.</p>`, das Service-Portal `C.empty(…)`.

Das widerspricht dem, was beide Portale in jeder anderen Tabelle bereits tun.
`tenant-portal/js/data-table.js` und `service-portal/js/ui/components/catalogue.js`
tragen beide denselben, unabhängig voneinander gefassten Kommentar:

> *«Die Tabelle bleibt auch ohne Treffer stehen, samt Kopfzeile. Sie durch einen
> Leerzustand zu ersetzen nahm die Spalten weg, sodass niemand mehr sah, worum
> es in der Tabelle ging, und die Seite sprang bei jeder Filterung.»*

Der Reiter «Anhänge» ist die einzige Stelle, die diese Regel nicht befolgt.

### 3.1 Entscheid

Anhänge laufen in beiden Portalen über die vorhandene Tabellenmaschine
(`mountDataTable`), mit voller Umgebung:

| Spalte | Inhalt |
| --- | --- |
| Dokument | Dateiname als Download-Link, mit Dateityp-Icon |
| Typ | PDF / DWG / XLSX … |
| Grösse | 240 KB |
| Status | Badge (`ok` / geprüft), wo der Prozess einen führt |

- **Katalogleiste** (Suche, Trefferzahl, Filter über den Typ) — auch bei zwei
  Zeilen, weil die Umgebung die Fläche erklärt und nicht die Datenmenge.
- **Kopfzeile immer**, auch bei null Zeilen.
- **Leerzeile in der Tabelle**: `<td colspan="4" class="table__empty">Keine
  Anhänge erfasst.</td>` — und, sobald gesucht wurde, der andere Satz: «Keine
  Anhänge für diese Suche oder Filterung.» Beide Tabellenmaschinen
  unterscheiden diese zwei Fälle bereits.
- **Seitenfuss** wie in jeder anderen Tabelle des jeweiligen Portals — dort
  liegt eine bewusst NICHT angeglichene Differenz, siehe § 5.

Damit ist der leere Reiter ein Zustand der Tabelle statt ein Ersatz für sie —
und «Anhänge (0)» führt zu einer Anhängetabelle, die eben nichts enthält.

Die Trefferzahl in der Leiste sagt in beiden Portalen dasselbe: bei leerem
Bestand «Keine Anhänge» statt «0 von 0 Anhängen» — eine Menge zu zählen, die es
nicht gibt, ist keine Auskunft.

---

## 4. Kanon — die 17 Entscheide

Notation: **V** = Vorgangsdetail, **L** = Liste. «→» nennt die Quelle, aus der
die gemeinsame Fassung stammt.

### Detailseite

| # | Entscheid | Begründung |
| --- | --- | --- |
| V1 | **Kopf nach CD-Hero**: `.meta-info`-Zeile → `h1` (Titel) → Statusbadge + Aktionen | `Hero.vue:9-27` setzt `MetaInfo` **über** den `h1`; `meta-info.postcss` liefert Grad, Farbe und den `|`-Trenner. Ersetzt das portal-eigene `.overtitle` (Mieterportal) und die Referenz-im-`h1` (Service-Portal). Beide Portale implementieren `.meta-info` bereits CD-treu. |
| V2 | Meta-Zeile: Prozess `|` Referenz `|` Objekt `|` Eingereicht *Datum* | Alles, was vorher auf `.overtitle` + `.page-header__sub` bzw. `h1` + `.lead` verteilt war, in einem CD-Baustein. |
| V3 | Vier Reiter in beiden: **Übersicht · Anhänge (n) · Verlauf · Kommentare (n)** | «Übersicht» → Mieterportal (die Seite zeigt mehr als Daten). Kommentare → Mieterportal; leer ist ein Zustand, kein Grund, den Reiter zu verstecken. |
| V4 | Zählerformat `(n)` → Mieterportal | Dort bereits in Vorgangs- **und** Liegenschaftsreitern; im Service-Portal nur an dieser einen Stelle anders. |
| V5 | **Übersicht = Abschnittsgitter** (§ 2.1) | Der Kern des Auftrags. |
| V6 | Abschnittstitel `h3.case-section__title`, `padding-bottom: 12px` + Trennlinie → Mieterportal | Die Linie trennt Titel von Werten, wo zwei Abschnitte nebeneinander stehen. |
| V6a | Jedes Registerkarten-Panel trägt ein `sr-only`-`h2` mit dem Reiternamen | Folgt aus V6: mit `h3`-Abschnitten springt die Gliederung sonst von `h1` auf `h3` (gemessen von `check-a11y-responsive`). Das Service-Portal tat das über `C.tabPanels({ heading: true })` schon; das Mieterportal zog nach. Nebeneffekt: ein Panel wird nicht mehr nur als «tabpanel» angesagt. |
| V7 | `dl` einheitlich: 16 px, Labelspalte `fit-content(18rem)`, Abstände `8px 32px`, `dt` gray-600 | Grad und `dt`-Farbe → Service-Portal (18 px `dd` neben 16 px `dt` war ein Ausreisser), Zeilenabstand → Mieterportal (0 war zu eng ohne Linien). |
| V8 | Pipeline: `<ol>` + `aria-current="step"` + sr-only-Präfix → Service-Portal | Echte Liste statt `role="list"` auf `div`; `aria-current` benennt den Schritt. |
| V9 | Pipeline-Geometrie: min-height 44 px, `--text-sm`, Icons → Service-Portal | 44 px ist die Zielgrösse, die auch die Tabs tragen. |
| V10 | Pipeline-Zustände `--rueckfrage` / `--rejected` → Mieterportal | Zwei Zustände, die das Service-Portal nicht darstellen konnte. |
| V11 | **Anhänge als Tabelle mit voller Umgebung** (§ 3) | Der zweite Kernauftrag. |
| V12 | Verlauf: `ol.history-timeline` mit tongebenden Punkten → Mieterportal | Semantisch geordnet, und der Punkt trägt den Ereignistyp. |
| V13 | Kommentare: `ul.case-comments` → Mieterportal | Mit Leerzustand statt fehlendem Reiter. |
| V14 | «Seed-Vorgang (Demo) — nicht weiterführbar.» entfällt | Eine Notiz über die Herkunft der Demodaten, die dem Leser nichts über den Vorgang sagt. |

### Listenseite

| # | Entscheid | Begründung |
| --- | --- | --- |
| L1 | Kopf: `h1` + Untertitel + primäre Aktion «+ Neuer Vorgang» → Mieterportal | Eine Liste von Vorgängen ohne Weg zu einem neuen ist eine Sackgasse. |
| L2 | Kennzahlenstreifen (total / offen) → Service-Portal, in beiden | Beantwortet die Frage, die man an eine Vorgangsliste zuerst stellt. |
| L3 | Katalogleiste mit **Sortieren** → Service-Portal, in beiden | Sortierung fehlte im Mieterportal ganz. |
| L4 | Spalten: **Referenz · Titel · Objekt · Prozess · Eingereicht · Status** | Vereinigung beider Sätze: das Service-Portal hatte kein Objekt, das Mieterportal keinen Titel — beides trennt zwei gleichartige Vorgänge auf demselben Gebäude. «Eingereicht» statt «Aktualisiert» in der Spalte, weil das Eingangsdatum die Tatsache ist, an der man einen Vorgang wiedererkennt; wie kürzlich er sich bewegt hat, ist eine SORTIERUNG und bleibt als Option erhalten. Beide Listen öffnen neueste zuerst. |
| L4a | Das Service-Portal lädt `buildings` wieder in der Liste | Die Objektspalte braucht die Datei. F-S17 hatte sie aus der Liste genommen, weil diese auf Daten wartete, die nur das Detail las — das gilt nicht mehr, sobald eine Zeile ihr Gebäude nennt. Das Favoritenband darunter zieht dieselbe Datei ohnehin für die meisten Personen. |
| L5 | Tabellenhinweis unter klickbaren Zeilen → Mieterportal, in beiden | Die Zeile ist klickbar; das steht sonst nirgends. Dazu der Chevron am Zeilenende → Service-Portal: ein Zeiger zeigt die Klickbarkeit erst BEIM Überfahren, der Winkel schon davor. |
| L6 | «Meine Favoriten» bleibt Service-Portal-exklusiv, die Kacheln wechseln auf `.card--quick` in `.card-grid` | Das Band hängt am Lesezeichenspeicher, den das Mieterportal nicht führt — es bleibt also ein Unterschied der FUNKTION. Innerhalb des Service-Portals war es aber inkonsistent: dieselbe Geste («eine Abkürzung zu etwas, das ich selbst gewählt habe») trug auf der Startseite die Karte aus «Häufig genutzte Dienstleistungen» und hier eine zweite Kachelform (Rückmeldung, 2026-08-22). |

---

## 5. Bewusst NICHT angeglichen

- **Statusvokabular.** «in PFM-Prüfung» (Mieterportal) und «In Prüfung (PFM)»
  (Service-Portal) gehören zu unterschiedlichen Prozessmodellen mit
  unterschiedlichen Zustandsmengen. Die *Darstellung* (Badge, Farbzuordnung)
  ist angeglichen, die *Wörter* bleiben fachlich.
- **Favoritenband** unter der Liste (nur Service-Portal) — es hängt am
  Lesezeichenspeicher, den das Mieterportal nicht führt.
- **Rollenwechsel** (nur Mieterportal): die GS-Prüfer-Ansicht der Liste ist
  eine eigene Aufgabe, kein Gestaltungsunterschied.
- **`.overtitle`** bleibt als Klasse bestehen — andere Seiten des
  Mieterportals nutzen sie weiter; nur der Vorgangskopf wechselt auf
  `.meta-info`.
- **Der Tabellenfuss bei leerem Ergebnis.** Die beiden Fusszeilen sind nicht
  dasselbe Bauteil: im Service-Portal ist sie ein reiner SEITENWÄHLER und
  verschwindet bei einer Seite (portalweiter Vertrag, `C.pagination`); im
  Mieterportal ist sie zuerst eine BEREICHSAUSSAGE («1–11 von 11 Vorgängen»)
  und bleibt deshalb immer stehen — `scripts/verify/check-detail-tables.mjs`
  prüft das auf jedem Detailreiter. Die Information fehlt in keinem der beiden:
  das Service-Portal trägt sie in der Leiste («6 von 6 Vorgängen»). Eine
  Angleichung wäre ein portalweiter Eingriff in beide Paginierungen und gehört
  nicht in diese Welle.
- **Die Vorbelegung des Sortier-Menüs.** Das Mieterportal wählt die erste
  Sortierung sichtbar vor, das Service-Portal startet mit dem Platzhalter
  «Sortieren» und der übergebenen Reihenfolge. Die tatsächliche REIHENFOLGE ist
  angeglichen (neueste zuerst, L4); nur die Beschriftung des Menüs unterscheidet
  sich, und beide Vorbelegungen sind portalweite Verträge ihrer
  Katalogleisten.

## 5.1 Was bewusst NICHT geteilt wird: der Code

Beide Portale bleiben **eigenständige Repositorien**. Die Angleichung ist eine
Angleichung von ANATOMIE und WERTEN, nicht von Dateien: jedes Portal trägt
seine eigene `case-view.js` (`service-portal/js/ui/case-view.js`,
`tenant-portal/js/case-view.js`), sein eigenes CSS und seine eigene
Tabellenmaschine. Kein Modul importiert über die Repositoriumsgrenze; die
Verweise aufeinander sind Kommentare, die sagen, WARUM ein Wert so lautet.
Prüfbar mit einem Blick auf die `import`-Zeilen der beiden neuen Module.

---

## 6. Umsetzungsstand

| Entscheid | Service-Portal | Mieterportal |
| --- | --- | --- |
| V1–V2 Kopf nach CD-Hero | umgesetzt | umgesetzt |
| V3–V4 Reiter | umgesetzt | umgesetzt |
| V5–V7 Übersicht-Gitter | umgesetzt | umgesetzt |
| V8–V10 Pipeline | umgesetzt | umgesetzt |
| V11 Anhängetabelle | umgesetzt | umgesetzt |
| V12–V13 Verlauf / Kommentare | umgesetzt | umgesetzt |
| V14 Demo-Fussnote entfernt | umgesetzt | — (nicht vorhanden) |
| L1–L5 Liste | umgesetzt | umgesetzt |
| L6 Favoritenkacheln | umgesetzt | — (Band nicht vorhanden) |

### Angepasste Prüfungen

Vier Prüfungen hielten einen Vertrag fest, den der Kanon ersetzt hat; sie
prüfen jetzt den neuen:

- `service-portal/scripts/test-pipeline.mjs` — die Referenz steht in
  `.case-header__meta` statt im `h1` (V1).
- `service-portal/scripts/test-content.mjs` — der Anhang-Reiter ist eine
  Tabelle, kein `download-item`-Bestand (V11).
- `service-portal/scripts/test-bookmarks.mjs` — das Favoritenband trägt
  `.card--quick` statt `.quick-tile` (L6).
- `tenant-portal/scripts/verify/check-a11y-responsive.mjs` — unverändert; sie
  hat den `h1`→`h3`-Sprung gefunden, den V6a behebt.
