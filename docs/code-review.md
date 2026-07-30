# Code-Review — Vereinfachung, Wiederverwendung, Konsistenz

**Stand:** 30. Juli 2026 · **Gegenstand:** 13 000 Zeilen JS, 3 500 Zeilen CSS · **Auftrag:** ausschliesslich Refactoring — keine Funktion kommt dazu, keine fällt weg.

**Methode:** vier unabhängige Prüfläufe über getrennte Bereiche (CSS/Tokens, `components.js`, die sechs Micro-Apps, `pages`/`core`/`router`/`shell`), dazu ein eigener Lauf über die Formular-Apps und die Testwerkzeuge. Jeder Befund trägt Datei und Zeile. **Die schwerwiegenden Befunde sind einzeln nachgestellt**, nicht übernommen — was nachgestellt wurde, steht in [§8](#8-was-nachgeprüft-wurde).

> **Stand der Umsetzung (30. Juli 2026):** §1, §3, §4, §5, §2.4, §2.6 (`processDone`),
> §2.7 und das Testwerkzeug sind umgesetzt und mit eigenen Prüfläufen belegt —
> siehe [§7](#7-reihenfolge-der-umsetzung--und-was-davon-umgesetzt-ist) für die
> Übersicht, [§8](#8-was-umgesetzt-wurde--im-einzelnen) für die Einzelheiten.
> **Offen bleiben** die vier grössten Zusammenlegungen: `wireCatbar` (§2.3),
> `C.loginPage` (§2.6), `js/spatial-tree.js` vollständig (§2.1) und
> `js/catalogue-page.js` (§2.2). Die Befundtexte unten beschreiben den Zustand
> **vor** der Umsetzung und bleiben als Begründung stehen.

**Befund in einem Satz:** die Architektur trägt, aber sie ist an sechs Stellen dreifach vorhanden. Die grössten Hebel sind der räumliche Baum (3 Kopien), die Katalogseiten-Pipeline (5 Kopien) und die Katalogleisten-Verdrahtung (2 Kopien) — zusammen rund **900 Zeilen**, die auf etwa 300 zusammengehen. Der Weg dorthin ist nicht die Schwierigkeit; die Schwierigkeit sind die **Verhaltensunterschiede zwischen den Kopien**, und die sind in [§2](#2-die-grossen-zusammenlegungen) je Zusammenlegung einzeln aufgelistet.

---

## 1. Zuerst: sieben Fehler, die kein Refactoring sind

Beim Durchsehen sind sieben echte Defekte aufgefallen. Sie gehören nicht zum Auftrag, aber sie stehen hier zuerst, weil ein Refactoring sie sonst mitzementiert. **Zwei davon sind am 30. Juli von mir selbst eingebaut worden** (1.5 und 1.6).

### 1.1 «Zurücksetzen» im Datenkatalog löscht die Klassifizierung nicht
`js/pages/catalog.js:64` führt den Parameter als `classification`, der Reset-Link bei `:121` setzt aber `klass: []` zurück. `catalogueHash` kennt `klass` nicht, lässt `classification` aus `base` stehen und wirft das leere Array weg.
**Nachgestellt:** `#/data/catalog?classification=internal&topic=Bauwerke` → der Reset-Link zeigt auf `#/data/catalog?classification=internal`. Thema und Tag verschwinden, die Klassifizierung bleibt.
`services.js:99` und `applications.js:133` machen es richtig. → `klass` in `classification` ändern.

### 1.2 Ladefehler der News liest sich als «keine Meldungen»
`js/pages/news.js:44` übergibt `{ available: core.available('news') }`, `empty()` prüft aber `opts.unavailable` (`js/components.js:306`) — und zwar invertiert. Der Ausfallpfad wird nie erreicht: fällt `news.json` aus, behauptet die Seite, es gebe keine Meldungen.
Ursache ist die gegenläufige Benennung: `catalogueResults` nennt es `available` (`:1120`), `empty` nennt es `unavailable`. **Einer der beiden Namen muss verschwinden.**

### 1.3 Der Objekttyp-Filter im Inventar zeigt einen falschen Zustand
`js/apps/portfolio.js:262` baut die Filtergruppen mit einem lokalen `fgroup()` statt mit `C.filterGroup`. Dem fehlen zwei Dinge: die Auswertung von `selected` und die `id="f-…"`.
Folge: `state.filters.kind` steht auf `['building']` (`:99`), das Inventar öffnet also auf Gebäude gefiltert — **die Checkbox «Gebäude» rendert aber ungehakt.** Das Panel widerspricht dem Zustand. Zusätzlich kann `C.preserveFocus` ohne `id` den Fokus nicht wiederherstellen.
Die vier anderen Apps nutzen `C.filterGroup`.

### 1.4 Dieselbe Datei, zwei Grössenangaben — eine davon nicht schweizerisch
`js/apps/portfolio.js:721` formatiert mit `(kb/1024).toFixed(1).replace('.', ',')`, `js/apps/document-archive.js:42` mit `toLocaleString('de-CH', …)`.
**Nachgestellt:** 4820 KB → **«4,7 MB»** im Objektdetail, **«4.7 MB»** im Bauwerksdokumenten-Archiv. `de-CH` schreibt den Dezimalpunkt; die Portfolio-Fassung ersetzt ihn aktiv durch ein deutsches Komma.

### 1.5 Der Fokusring am Grundriss-Titelbild ist nicht der CD-Fokusring
`css/app.css:2437` schreibt `var(--color-focus, var(--color-primary-600))`. Ein Token `--color-focus` gibt es nicht — es heisst `--color-focus-ring` (`tokens.css:90`, CD-Violett `#8655F6`). Der Ausweichwert greift, der Ring ist blau statt violett. **Am 30. Juli von mir eingebaut.**
Gleiche Stelle, gleicher Fehlertyp: `css/app.css:2447` nutzt `var(--fw-normal)`; das Token heisst `--fw-regular`, die Angabe fällt still aus.

### 1.6 Zwei Breakpoints auf Tailwind statt auf CD
`css/app.css:1934` und `:1949` verwenden `min-width:1536px` — das ist Tailwinds 2xl. Das CD setzt 2xl auf **1544px** (`designsystem/app/tailwind.config.js:26`), und `app.css` benutzt 1544 an zwölf anderen Stellen. **Ebenfalls am 30. Juli von mir eingebaut.**

### 1.7 Hoher Kontrastmodus: die Korrektur greift nie
`css/app.css:473` setzt im `@media (forced-colors: active)` `appearance:auto` für Checkboxen und Radios, damit das System den Zustand zeichnet. Die Basisregel bei `:1537` setzt `appearance:none` — **gleiche Spezifität, 1060 Zeilen später, gewinnt immer.** Der im Kommentar `:469-472` beschriebene Fix (weisses Häkchen auf weissem Grund) ist wirkungslos.
Dasselbe Muster zweimal mehr: `css/app.css:2397` (Touch-Vergrösserung der Dokumentbetrachter-Knöpfe, WCAG 2.5.5) und `:2874` (Klebe-Hover der Schnelleinstiege auf Touch) stehen vor den Regeln, die sie überschreiben sollen.

---

## 2. Die grossen Zusammenlegungen

Nach Wert geordnet. Jede trägt die Liste der Verhaltensunterschiede, die die gemeinsame Fassung erhalten muss — **dort liegt das Risiko, nicht im Zusammenlegen selbst.**

### 2.1 Der räumliche Baum — 3 Kopien, ~135 Zeilen je Kopie
`js/apps/portfolio.js:113-159` · `projects.js:110-152` · `tenancies.js:102-146`
`buildTree()`, `rowContent()`, `node()` und der Rumpf von `treeHTML()` sind zwischen Portfolio und Projekten **zeichengleich**; `node()` ist zwischen Portfolio und Mietenden byte-identisch. Dazu die Auswahl- und Markierungslogik (`portfolio.js:335-378`, `projects.js:311-348`, `tenancies.js:307-336`, ~112 Zeilen).

→ **`js/spatial-tree.js`** mit `spatialTree(C, { objects, levels, leaf, dataKeys })` und `wireSpatialTree(root, { dataKeys, mark, onSelect })`.

Zu erhalten:

| | |
|---|---|
| Mietende haben **keine WE-Stufe**; ihre Regionquelle heisst `canton`, wird aber als `data-region` ausgegeben | `tenancies.js:110-112, 124` |
| Portfolio sortiert Blätter **erst nach `kind`**, dann Name | `portfolio.js:149` vs. `projects.js:142` |
| WE-Label: erstes **Gebäude** der WE (Portfolio) vs. `buildingName` des ersten Objekts (Projekte) | `portfolio.js:150` vs. `projects.js:143` |
| WE-Icon `Folder` vs. `Building` | `portfolio.js:151` vs. `projects.js:144` |
| WE-Schlüssel mit nacktem `.sort()`, alle anderen Stufen mit `byDe` | `portfolio.js:147` |
| Markierung **zweifarbig** (`is-active` + `is-path`) vs. **einfarbig** (`is-selected`) | `portfolio.js:339-351` vs. `tenancies.js:310` |
| Bei Mietenden ist die Reihenfolge tragend: `setSelection` löscht alle Klassen, **danach** setzt der Aufrufer `is-selected` | `tenancies.js:320/321` |
| Blattzweig prüft `dataset[k]` (truthy), Knotenzweig `!= null` (vorhanden) — semantisch verschieden, in allen drei Dateien gleich | `portfolio.js:363` vs. `:375` |

### 2.2 Die Katalogseiten-Pipeline — 5 Kopien, ~400 Zeilen
`js/pages/services.js` · `applications.js` · `catalog.js` · `search.js` · `js/apps/media-library.js`
Zwölf identische Schritte je Datei (Hash lesen → filtern → sortieren → paginieren → `hash()` → Pillen → Leiste → Ergebnisse → Ansage → Verdrahtung). Etwa **250 der 400 Zeilen unterscheiden sich nur in Bezeichnern** (`svc-`/`app-`/`ds-`/`sr-`/`med-`).

→ **`js/catalogue-page.js`** mit einer `catalogueView(ctx, {…})`; die Seiten schrumpfen auf `card`, `listView`, `sorts`, `facets` — je 30–50 Zeilen.

Zu erhalten (Auswahl aus zwanzig dokumentierten Abweichungen):
- **`search.js` hat kein eigenes Suchfeld** (`showSearch:false`), kehrt den Standard-View auf `list` um, sortiert nach Relevanz, sagt selbst an statt über `announceCatalogue`, und rendert Leiste + Treffer nur bei `total > 0`.
- **`catalog.js` ist mehrsprachig** — alle Textfelder laufen durch `core.t`, Enum-Beschriftungen durch `core.label`, die Themenfacette filtert auf den *übersetzten* Wert.
- **`applications.js`** validiert Filterwerte gegen bekannte Schlüssel; `services.js` und `catalog.js` übernehmen beliebige Hash-Werte.
- **`perPage`** ist überall anders: 12 / 9 / 9 / 10 / `PER_PAGE`.
- **`media-library.js`** hat eine dritte Ansicht (`map`) mit eigener Zählformulierung und braucht einen Nachverdrahtungs-Haken (Vollbildgalerie + `?bild=`-Deeplink).
- **`unit`** steht in verschiedenen Fällen («Datensätzen» ist Dativ) und wird sowohl im Zähler als auch im Leerzustand verwendet.

### 2.3 Zwei Implementierungen derselben Katalogleisten-Verdrahtung
`js/components.js:1226-1266` (`wireCatalogue`) vs. `:1415-1438` (in `mountDataTable`)
Beide verdrahten dieselben fünf Dinge in derselben Reihenfolge: Suchformular, Sortierung, Filter-Umschalter, Panel-`change` mit `data-fdim`-Ernte, Blätterleiste. **Der einzige Unterschied ist das Ziel:** `location.hash = hash({…})` gegen `state.x = …; draw()`.
→ Ein `wireCatbar(root, ids, commit)`; `commit(patch)` entscheidet Hash oder lokaler Zustand. Spart ~50 Zeilen und macht die Leiste an einer Stelle wartbar.

### 2.4 Der Karten-Lebenszyklus — 5 Ausprägungen
`portfolio.js` · `projects.js` · `tenancies.js` (je Modulinstanz + `freeXxMap()` + Ticket + `mountMap`) gegen `media-library.js` · `estate.js` (festgehaltenes Promise + `onUnmount`).
→ **`js/map-slot.js`** mit `createMapSlot() → { mount, free, get }`.
Zu erhalten: `free()` läuft **zweimal je Renderdurchgang** (Kopf von `renderMain` und in `mountMap`) und muss idempotent bleiben; Portfolios Detailzweig schreibt ohne Ticket in dieselbe Modulvariable; nur Portfolio übergibt eine echte Parzellen-FeatureCollection, die anderen eine leere oder `null` — und `initEstateMap` behandelt beides verschieden.

### 2.5 Der Zustands- und Teilrender-Kreislauf — 4 Kopien, ~385 Zeilen
`portfolio.js` · `projects.js` · `tenancies.js` · `document-archive.js`
`renderMain()` ist zwischen Portfolio und Projekten bis auf Präfix und Substantiv identisch (26 Zeilen); der Verdrahtungsblock (43 Zeilen) unterscheidet sich **ausschliesslich** in `pf-`/`pj-` und drei Dimensionsnamen.
→ Fünf kleine Bausteine (`wireSearchBox`, `wireFilterPanel`, `wirePillRow`, `wirePrevNext`, `renderPills`) — **nicht** eine `mountExplorer()`-Funktion, sonst landen die zehn Abweichungen als Optionsflut im Signaturkopf.
Wichtigste Abweichung: **der Paginierungs-Kontrakt divergiert.** Drei Apps übergeben `href: () => '#'`, bekommen `<a href="#">` und parsen dann den deutschen `aria-label` mit `/Nächste/`; `document-archive.js` lässt `href` weg, bekommt `<button data-page>` und liest `data-page`. Die Button-Variante ist die richtige — der `#`-Link ist ein toter Link.

### 2.6 Vier Formular-Apps mit demselben Gerüst
`building-create.js` · `space-request.js` · `fault-report.js` · `workspace.js`
- **`drawDone()` viermal**: gleiches Skelett (Erfolgsmeldung mit Referenz, Dankeszeile, zwei Knöpfe), verschieden nur in Wortlaut, `h1` vs. `h2`, `btn--filled` vs. `btn--outline` und einem hartcodierten `max-width:50rem`.
- **Vier verschiedene Login-Gate-Gerüste** für dieselbe Lage: eines mit `pageHeader`, eines mit `backLink + h1 + lead`, eines nur mit dem nackten Gate.
- **Die Wizard-Fussleiste** (Zurück/Weiter) steht viermal, mit `style="justify-content:space-between"` — obwohl `.row--between` seit `app.css:2906` existiert.
- **`C.notification()` wird sechsmal umgangen**: `space-request.js:104,137`, `building-create.js:154`, `estate.js:110`, `router.js:351`, `app.js:91` schreiben `<div class="notification notification--…">` samt Icon von Hand.
→ `C.processDone({ instance, title, text, extra, actions })` und `C.loginPage(ctx, { title, lead, back, text })`.

### 2.7 Elf handgebaute «nicht gefunden»-Blöcke
Acht Seiten und fünf Apps wiederholen `setTitle` + `setCrumbs` + `mount.innerHTML = C.notFound({…})` + `return`. `C.notFound` vereinheitlicht das *Markup*, nicht den *Ablauf*.
→ `C.renderNotFound(ctx, { thing, article, backHref, backLabel, crumbs })`.
Zu erhalten: das Geschlecht wechselt («Diese Dienstleistung», «Dieser Datensatz», «Dieses Fachgebiet», «Diese Seite»); manche Brotkrumen tragen ein abschliessendes `{ label: 'Nicht gefunden' }`, andere nicht.

### 2.8 Kleinteiliges, das überall doppelt liegt

| Was | Wo | Vorschlag |
|---|---|---|
| `chf()` zeichengleich | `projects.js:36`, `tenancies.js:36` | **`js/format.js`**: `chf`, `m2`, `num`, `datum`, `dateiGroesse` |
| Datumsformatierer mit **unterschiedlicher Wache** (`isNaN(d)` vs. `isNaN(d.getTime())`) | `tenancies.js:38`, `portfolio.js:422` | ebd. |
| `toLocaleString('de-CH') + ' m²'` inline | 9× in `portfolio.js` | ebd. |
| `LAND` / `landName()` / `weOf()` | je 3× identisch | **`js/domain.js`** |
| `esc = (s) => C.escape(String(s ?? ''))` | 6× wortgleich, dazu 2 Eigenimplementierungen | `import { escape as esc }` — `escape` macht die Null-Wache bereits selbst |
| `CRUMBS`-Präfix «Startseite ›…» | 36× in 24 Dateien, 3 private Kopien | **`js/crumbs.js`** |
| Zielgruppen-Tabelle (`staff`/`customers`/`both`) | `components.js:89`, `services.js:220`, `applications.js:24` | eine Tabelle neben `audienceTag` |
| `statusLabel(core, id)` | `projects.js:61`, `tenancies.js:770`, `home.js:205`, `my-cases.js:188` | `core.statusLabel(id)` |
| `#/app/portfolio?id=` von Hand gebaut | 13 Stellen | **`js/links.js`** — Achtung: Bauprojekte adressieren über ein **Pfadsegment**, nicht `?id=` |
| Galerie-Einträge | 5 Kopien; Portfolio importiert `heroMosaic`, aber **nicht** `galleryItemsFrom` | die exportierte Fassung nutzen (schliesst zugleich die fehlende Quellenangabe, siehe §5) |
| Roving-Tastaturnavigation | `wireTabs:795` und `wireMenu:1540`, bis auf die Achse gleich | `rovingKeys(items, i, e, { horizontal })` |
| `target="_blank" rel="noopener external"` | **21×** portalweit, 10× allein in `shell.js` | ein `extLink()`-Baustein |
| `core.js`: 21 Accessoren in drei Mustern (`find-by-id` 10×, `filter-by-key` 10×, `list` 11×) | `core.js:216-281` | Fabriken `list(k)`, `one(k,f)`, `many(k,f)` + Deklarationstabelle |
| `core.js`: `FILES`/`DEFERRED`/`AREA`/`OBJECT_FILES` über denselben Schlüsselraum | `core.js:17-72` | **eine** `SOURCES`-Tabelle mit `{ url, area, eager, shape, geo, idKey }` |
| `core.js`: `load()` und `loadDeferred()` sind derselbe Ablauf | `core.js:138-154` vs. `:178-203` | ein `loadKey(key)`; `load()` = `Promise.all(eagerKeys.map(loadKey))` |
| `router.js`: `PAGES`/`APPS`/`SECTION_OF` über denselben Namensraum | `router.js:81-116` | Abschnitt als Feld am Eintrag |

---

## 3. Tokens statt Literale

Die Token-Schicht existiert und ist gut geschnitten — sie wird nur **kaum benutzt**. Die Zahlen sind gezählt, nicht geschätzt:

| Token | gedacht für | tatsächlich genutzt | daneben stehen |
|---|---|---|---|
| `--control-h` | Bedienhöhe | **8×** | `2.75rem` **46×** |
| `--duration-*` | «eine Quelle, auditierbar für reduced-motion» (`tokens.css:158`) | **5×** | **64** Zeitliterale (`.12s` 22×, `.15s` 14×, `.2s` 15× …) |
| `--z-*` | «statt verstreuter Magic Numbers» (`tokens.css:170`) | wenige | **34** rohe `z-index`, darunter `2000`, `200`, `60`, `50` |
| `--color-bg` | Fläche | wenige | `#fff` **112×** (67× als Textfarbe — dafür fehlt ein Token) |
| `--sp-*` | Abstandsraster | **6×** (nur in `.mt-*`) | `.4rem` 25×, `.35rem` 21×, `.6rem` 17× … |

Konkrete Schritte:

1. **`--control-h` und ein neues `--target-min: 2.75rem` trennen.** Heute vermischt `2.75rem` zwei Absichten: die *skalierende* Bedienhöhe und das *feste* 44-px-WCAG-Ziel für Icon-Knöpfe, die laut Kommentar `app.css:2086` ausdrücklich nicht mitwachsen sollen.
2. **Alle Übergangszeiten auf `--duration-*` einrasten** (`.12s/.15s`→fast, `.2s`→default, `.25s/.3s`→slow). Erst danach ist die `prefers-reduced-motion`-Abschaltung an einer Stelle prüfbar — das ist der erklärte Zweck der Tokens.
3. **Z-Skala vervollständigen** (`--z-content`, `--z-drawer`, `--z-viewer`, `--z-skiplink`). Heute liegt `.docviewer` auf `200` über `--z-toast: 110`, ohne dass diese Ordnung irgendwo steht.
4. **`--color-text-negative: #fff`** als Gegenstück zu `--color-focus-ring-negative` einführen; Flächen auf `--color-bg`. Ohne das ist eine Kontrast- oder Dunkelvariante gar nicht möglich.
5. **`--font-mono`** anlegen — `Consolas,Menlo,monospace` steht 9× wörtlich.
6. **Overlay-Abdunkelung vereinheitlichen:** fünf Rezepte für dieselbe Aufgabe (`rgba(0,0,0,…)`, `rgba(31,41,55,…)`, `rgba(13,27,42,…)` — Letzteres eine Farbe, die in keiner Rampe vorkommt). → `--scrim-chip`, `--scrim-gradient` neben `--overlay-scrim`.
7. **Die responsiven Rampen** (`gap` 1.25→4rem, `section-py` 3.5→8rem) sind zweimal bzw. fünfmal vollständig ausgeschrieben. → `--gap-responsive` und `--section-py` in `tokens.css` steppen, genau wie `--control-h` es vormacht.
8. **Elf freie Hexe in der API-Doku** (`app.css:2221-2238`), drei davon exakte Duplikate bestehender Tokens (`#fef3c7` = `--color-yellow-bg`, `#047857` = `--chart-series-4`, `#6d28d9` = `--chart-series-3`).
9. **Die dunkle Chrome** von Lightbox und Dokumentbetrachter erfindet ein eigenes Negativ-Vokabular aus **24** `rgba(255,255,255,…)`-Werten in zehn Deckkraftstufen, obwohl das CD eine benannte Negativ-Ebene führt (`btn--*-negative`, `link--negative`, `--color-focus-ring-negative`). → drei Tokens (`--surface-negative-hover`, `--border-negative`, `--text-negative-muted`).

Im JS gilt dasselbe: **57 Inline-`style=`-Attribute**, darunter 14× `margin:0`, fünf `max-width`-Deckel und 4× `justify-content:space-between` trotz `.row--between`. Und `#2f4356` steht **8× in sechs Dateien** als Platzhalterfarbe — es ist bereits `--color-secondary-600`, und da `C.photo` die Farbe als Inline-`background-color` setzt, funktioniert `var(--color-secondary-600)` dort unverändert.

---

## 4. CSS: Duplikate, Reihenfolge, Breakpoints

- **`.card--flat` und `.card--list` sind in der Basis byte-identisch** (`app.css:1198-1231`), inklusive zweier identischer `:hover`-Neutralisierungen; `.catalogue-grid .card__body` und `.search-result__link` wiederholen dieselbe Polsterrampe ein drittes und viertes Mal.
- **`.stat` ist `.box` minus einer Stufe** (`:1770` vs. `:1759`) — und weicht dadurch unbeabsichtigt von CD `box.postcss` ab. → `.stat` löschen, `.box` verwenden.
- **Der Visually-hidden-Block steht 7× in drei Fassungen**; `outline:2px solid var(--color-focus-ring); outline-offset:2px` steht **14×**.
- **Fünf echte Doubletten**, u. a. die `.meta-info__item`-Media-Query zweimal buchstabengleich hintereinander und `.text--light` zweimal.
- **Dreimal dasselbe Suchfeld-Bauteil** (`.service-controls__search`, `.catbar__search`, `.map-search__field`) — Deklarationen bis auf die Höhe identisch.
- **Vier Konventionen für dieselbe sm-Grenze**: `max-width:640px` (4×, überlappt bei genau 640 px mit `min-width:640px`), `639px`, `639.98px`. Dazu die Sonderbreiten `800px` und `900px`, die auf keiner CD-Stufe liegen.
- **Drei Regeln, die nie gewinnen können** — siehe §1.7. Dazu `.form__group__legend` mit zwei toten `font-weight`-Angaben (`:1428`, `:1434` gegen `:1472`) und zwei entbehrliche `!important` (`:751`, `:1528`).
- **Ein reines No-Op:** `@media (max-width:800px)` bei `:2457` setzt exakt die Basiswerte.
- **Die `:not()`-Kette auf `#main-content a`** (`:106-112`) ist dreimal ausgeschrieben und ergibt Spezifität (1,11,1) — jede spätere Link-Regel muss dagegen anschreiben. → eine `:not(…)`-Liste plus `:is(:hover,:focus)`, das senkt sie auf (1,2,1).

---

## 5. Toter und unerreichbarer Code

**Nachgeprüft** — jeweils `grep` über `js/`, `index.html` und die dynamische Klassenbildung:

| | |
|---|---|
| **5 tote Exporte** in `components.js`: `tile`, `tagItem`, `catalogueControls`, `rerender`, `chevron` | 0 Aufrufe, ~45 Zeilen |
| **9 Exporte nur modulintern genutzt**: `breakable`, `notificationBanner`, `modal`, `openModal`, `shareBar`, `shareUrlBlock`, `cardFooter`, `resultsHeader`, `viewSwitch` | aus `C` streichen; öffentliche Oberfläche 76 → ~62 Namen |
| **`resolveChildren`'s `themen`-Zweig** (`shell.js:56-60`) ist **unerreichbar**: `childrenFrom` steht nur am Services-Eintrag, der Zweig wird nur bei `base !== 'services'` erreicht | löschen |
| **`wirePipeline`** ist ein exportierter No-op (`return root`) mit genau einem Aufrufer | beide löschen |
| **Toter Zweig** in `wireAccordion:719` (`root.getElementById ? …`) — `root` ist am einzigen Aufrufort ein Mount-Element | vereinfachen |
| **Portfolio-Schemakarte** (`.pf-marker`, `.pf-status--*`, `.pf-map__hint`) — von MapLibre abgelöst | 3 Blöcke löschen |
| **`.media-tile`, `.media-play`, `.lightbox`, `.pf-media*`** — kein Konsument | löschen |
| **`.scroll-x` / `.table-scroll`** — `SCROLL_SEL` (`components.js:404`) kennt sie nicht; der Kommentar behauptet das Gegenteil | löschen oder `SCROLL_SEL` erweitern |
| **`.ratio--*` (5 Regeln) und alle 7 `.photo--*`** — `C.photo` wird nur mit drei anderen Klassen aufgerufen | löschen oder als CD-Vokabular kennzeichnen |
| **`.mt-3` wird benutzt, ist aber nicht definiert** (`components.js:576, 594, 595`) — die drei Elemente bekommen still keinen Abstand | `.mt-3` ergänzen |

Zwei Dinge, die **nicht** tot sind und es beinahe geworden wären: `js/apps/estate.js` sieht im Routentabellen-Vergleich verwaist aus, wird aber dynamisch von `dataportal.js:45` geladen. Und `trapFocus`/`mountBanner`/`wireShare` zeigen in der `C.`-Zählung null Treffer, weil sie **benannt importiert** werden.

---

## 6. Konventionen, die auseinanderlaufen

1. **Rückgabewerte der `wire*`-Familie:** sechs Konventionen. Vier geben eine Aufräumfunktion zurück, eine `{activate}`, eine `boolean`, eine `root`, fünf `undefined`. Ein Aufrufer kann nicht wissen, ob es ein Teardown gibt, ohne die Quelle zu lesen. → **Jede `wire*`-Funktion gibt eine Aufräumfunktion zurück** (notfalls `() => {}`), Zusatzergebnisse hängen als Eigenschaften daran.
2. **Positional vs. Objekt:** `notification(text, variant, iconName, opts)` hat vier Positionen, deren letzte bereits ein Optionsobjekt ist. → **Ab dem dritten Parameter Objekt.**
3. **Namen für dasselbe:** `iconName` gegen `icon:` gegen `triggerIcon`; `label` bedeutet je nach Bauteil sichtbaren Text, `aria-label`, Vorspann oder Zielbezeichnung. → `iconName` / `label` (sichtbar) / `ariaLabel` / `title` festlegen.
4. **`available` vs. `unavailable`** — siehe §1.2. Einer der beiden muss weg.
5. **Wer escaped?** `catalogueResults:1140` escaped `unit`, bevor es an `empty()` geht, das noch einmal escaped; vier Zeilen weiter (`:1144`) geht dasselbe `unit` roh hinein. Regel festhalten: **was an `empty()` geht, ist Klartext.**
6. **Drei Inline-`onclick`** in einer sonst durchgehend delegationsbasierten Bibliothek (`components.js:553`, `:822`, `:1574`) — für eine Content-Security-Policy unbrauchbar.
7. **`CSS.escape` uneinheitlich:** die eine Hälfte der Datei nutzt es, die andere konkateniert `'#' + id`.
8. **`openShareModal` greift global zu:** `document.querySelector('.modal--xs')` statt auf das soeben erzeugte Element (`components.js:588`) — `openModal` gibt nur `close` zurück, nicht `el`. Bei zwei offenen Dialogen wird der falsche verdrahtet.

---

## 7. Reihenfolge der Umsetzung — und was davon umgesetzt ist

Von risikoarm nach risikoreich. Der Stand am 30. Juli 2026, nach der Umsetzung:

| # | Gegenstand | Stand |
|---|---|---|
| 0 | Testwerkzeug (Anhang) | **erledigt** — `launch()` sucht sich einen freien Port und bricht ab, statt sich an einen fremden Browser zu hängen |
| 1 | Die sieben Fehler aus §1 | **erledigt** — alle sieben, einzeln nachgemessen |
| 2 | `js/format.js` · `js/domain.js` · `js/crumbs.js` · `js/links.js` (§2.8) | **erledigt** |
| 3 | Toter Code (§5) | **erledigt** |
| 4 | Tokens (§3) | **erledigt** |
| 5 | `js/map-slot.js` (§2.4) | **erledigt** — fünf Apps, sechs Aufrufstellen |
| 6 | `C.renderNotFound` (§2.7) | **erledigt** — zwölf Wege |
| 7 | `C.processDone` (§2.6) | **erledigt** — vier Formular-Apps |
| 8 | Zählstand im Strukturbaum (Nutzerbefund) | **erledigt** — `js/spatial-tree.js`, erster Baustein von §2.1 |
| 9 | `wireCatbar` (§2.3) | **offen** |
| 10 | `C.loginPage` (§2.6) | **offen** — vier Login-Gate-Gerüste stehen weiterhin einzeln |
| 11 | `js/spatial-tree.js` vollständig (§2.1) | **offen** — nur der Zählstand ist herausgezogen |
| 12 | `js/catalogue-page.js` (§2.2) | **offen** |

Die vier offenen Punkte sind die grössten und riskantesten; sie bleiben in dieser
Reihenfolge stehen. Alles davor ist umgesetzt und geprüft.

---

## 8. Was umgesetzt wurde — im Einzelnen

### §1 Die sieben Fehler
Alle behoben und über `scratchpad/check-fixes.mjs` einzeln nachgemessen: der
Reset-Parameter im Datenkatalog (`klass` → `classification`), die invertierte
Ausfallprüfung in `empty()`, der Objekttyp-Filter auf `C.filterGroup`, die
Grössenformatierung auf `de-CH` (Dezimalpunkt), `--color-focus-ring` statt des
nicht existierenden `--color-focus`, `--fw-regular` statt `--fw-normal`,
1536 → **1544** (CDs 2xl), und die Kontrastmodus-Regel hinter ihre Basisregel.

### §3 Tokens
| Vorher | Nachher |
|---|---|
| `2.75rem` **46×** wörtlich, vermischt mit `--control-h` | neues **`--target-min`** (feste WCAG-Tippfläche, rampt bewusst NICHT), 58 Literale ersetzt; `--control-h` bleibt die *skalierende* Bedienhöhe |
| **64** Zeitliterale in 7 Werten | alle auf `--duration-fast` / `--duration` / `--duration-slow` — und *dadurch* schaltet jetzt **eine** `prefers-reduced-motion`-Regel in `tokens.css` die Bewegung ab (vorher deckten zwei Einzelregeln zwei von 64 Fällen ab) |
| **34** rohe `z-index`, darunter `2000`, `200`, `60`, `50` | Skala vervollständigt (`--z-content`, `--z-nav`, `--z-drawer`, `--z-nav-active`, `--z-footer`, `--z-viewer`, `--z-skiplink`); die verbliebenen 18 sind kleine Ganzzahlen INNERHALB eines Komponenten-Stacking-Context — die Konvention steht jetzt in `tokens.css` |
| `#fff` **112×** | `--color-bg` (Fläche) bzw. neues **`--color-text-negative`** (Text auf dunkler Chrome); 0 verbliebene |
| fünf Rezepte für dieselbe Abdunkelung | `--scrim-chip` / `--scrim-chip-hover` / `--scrim-gradient`, alle auf der Sekundärrampe |
| **24** `rgba(255,255,255,…)` in zehn Deckkraftstufen | fünf benannte Werte der Negativ-Ebene (`--surface-negative` / `-hover` / `-active`, `--border-negative`, `--text-negative-muted`); die eine verbliebene ist begründet im Blatt vermerkt |
| `Consolas,Menlo,monospace` **9×** | `--font-mono` |
| elf freie Hexe in der API-Doku | HTTP-Verben auf die **kategoriale** Chart-Palette, Statusklassen auf die **Zustands**-Rampe |
| zwei Rampen fünffach ausgeschrieben | `--gap-responsive` und `--section-py` / `--section-py-half` / `--section-pt`; **auch der seitliche Innenabstand von `.container`** ist dieselbe Rampe und stand ein drittes Mal da |
| **57** Inline-`style=` in `js/` | **13** — der Rest über `.row--between` / `.row--end` / `.m-0` / `.mt-0` / `.h-full` / `.mb-3` und die neuen `.measure-*`; die verbliebenen sind echte Einzelfälle oder tokengetriebene `fill`/`background` |
| `#2f4356` 8× in sechs Dateien | `var(--color-secondary-600)` |

**Nachgemessen:** `scratchpad/check-ramps.mjs` liest an acht Breiten
(375 · 480 · 640 · 768 · 1024 · 1280 · 1544 · 1920) den berechneten Wert von
`.grid`-Spalte, `.container.section`-Polsterung, `--target-min` und
`--control-h` — **40 von 40 identisch zu vorher**. Der Umbau ist reines
Benennen, kein Layoutwechsel.

### §4 CSS
- `.card--flat` und `.card--list` teilen ihre byte-identische Basis. Dabei fiel auf, dass `.card--list` die Polsterrampe fehlte, die das CD für **beide** vorgibt (`card.postcss:331-400`) — nachgezogen.
- `.stat` war `.box` minus einer Stufe → eine Deklaration für beide.
- Der Visually-hidden-Block stand **7×** in drei Fassungen → eine Sammelregel; die Gegenregeln, die den Text ab einer Breite wieder einblenden, bleiben bei ihrer Komponente.
- Der CD-Fokusring stand **10×**; sieben davon waren reine Doubletten der globalen `:focus-visible`-Regel. **Nachgewiesen**, nicht angenommen: `scratchpad/check-focus.mjs` erzwingt über `CSS.forcePseudoState` den Fokuszustand für alle sieben Klassen und liest den berechneten Umriss — alle sieben tragen weiterhin `2px solid rgb(134,85,246)`.
- Fünf echte Doubletten entfernt (u. a. die `.meta-info__item`-Media-Query zweimal buchstabengleich hintereinander, `.text--light` zweimal), dazu das No-Op `@media (max-width:800px)` und zwei tote `font-weight` an `.form__group__legend`.
- Die drei Suchfeld-Bauteile: `.service-controls__search` und `.catbar__search` teilen jetzt ihre Anatomie; `.map-search__field` bleibt eigenständig (anderes Bauteil — Symbol statt Absendeknopf, beidseitige Polsterung, Schatten).
- Vier Schreibweisen für dieselbe sm-Grenze → durchgängig `max-width:639.98px`; die Konvention steht in `tokens.css`. Vorher überlappte `max-width:640px` bei genau 640 px mit `min-width:640px`, und `max-width:639px` liess dazwischen eine Lücke.
- Die `:not()`-Kette auf `#main-content a` stand **dreimal** ausgeschrieben und ergab (1,11,1) → eine `:not(a, b, c)`-Liste plus `:is(:hover,:focus)`, das ergibt (1,2,1). `.tile` ist aus der Liste raus, die Klasse existiert nicht mehr.

**Eine Korrektur an der Review selbst:** die zwei `!important` waren als
«entbehrlich» notiert. Das stimmt nur für eines. `.select--bare` kam mit einer
Selektorstufe mehr aus. Bei `.main-navigation > ul > li > .clicked` ist es
**nötig**: `[data-menu]` wird über die ganze Shell verdrahtet (`shell.js:374`),
`.clicked` kann also im mobilen Menü stehen, und
`.mobile-menu .main-navigation > ul > li > button:hover` (0,4,2) schlägt die
Regel (0,2,2) in Spezifität *und* Reihenfolge. Es bleibt stehen, jetzt mit
dieser Begründung daneben.

### §5 Toter Code
Fünf tote Exporte (`tile`, `tagItem`, `catalogueControls`, `rerender`,
`chevron`) und der No-op `wirePipeline` entfernt; neun nur modulintern genutzte
Helfer aus `C` gestrichen (**76 → 63** öffentliche Namen); der unerreichbare
`themen`-Zweig in `resolveChildren` und der tote Zweig in `wireAccordion`
vereinfacht; sieben tote CSS-Blöcke entfernt; `.mt-3` ergänzt, das an drei
Stellen benutzt wurde, ohne definiert zu sein.

`.ratio--*` und `.photo--*` sind **bewusst geblieben**: sie sind der
Modifikatorensatz zweier geteilter Bausteine (`ratio.postcss`, `C.photo`), kein
verwaister Code — die Review liess dafür ausdrücklich die Wahl.

### §2.4 `js/map-slot.js`
Fünf Karten-Lebenszyklen in zwei Bauarten (Modulvariable + `freeXxMap()` +
Rennmarke gegen festgehaltenes Promise + `onUnmount`) → ein
`createMapSlot() → { mount, free, get }`. Erhalten geblieben sind alle drei
Fallstricke, die die Kopien einzeln gelöst hatten: die Rennmarke gegen den
asynchronen CDN-Ladevorgang, die Idempotenz von `free()` (läuft zweimal je
Renderdurchgang) und das sofortige Abbauen, wenn der Container zwischenzeitlich
aus dem Dokument gefallen ist.

### §2.7 `C.renderNotFound`
Zwölf Stellen bauten `setTitle` + `setCrumbs` + `mount.innerHTML` + `return`
von Hand. **Zwei davon setzten überhaupt keine Brotkrumen** — die des zuvor
besuchten Datensatzes blieben stehen (`media-library.js`, `projects.js`) —,
sechs schlossen sie mit «Nicht gefunden» ab, drei nicht.
`scratchpad/check-404.mjs` fährt alle zwölf ab und prüft Überschrift,
Zurück-Leiste, letzte Brotkrume und den Verweis auf die Übersicht: **12/12
gleich aufgebaut.**

### §2.6 `C.processDone`
Vier Formular-Apps hatten die Abschlussseite von Hand. `space-request` schrieb
sein `<div class="notification notification--success">` selbst und verlor damit
`.notification__content`, also die Textbreitenbegrenzung; die Knöpfe waren
dreimal `btn--outline`, einmal `btn--filled`. Dazu sind fünf weitere
handgebaute `<div class="notification …">` auf `C.notification` umgestellt
(`space-request` ×2, `building-create`, `estate`, `router`).

**Bewusst nicht umgestellt:** `js/app.js:91`. Das ist der letzte
Auffangnetz-Handler — scheitert der Start an einem Baustein, würde ein Aufruf
im `catch`-Zweig gleich noch einmal werfen. Steht jetzt mit dieser Begründung
im Code.

### Nutzerbefunde, die während der Umsetzung dazukamen
- **Hinweisstreifen ohne seitliche Polsterung.** Das CD schreibt `.notification-banner__wrapper { @apply container }` (`notification-banner.postcss:20`); hier stand ein festes `padding:0 1rem`. Auf breiten Fenstern klebte der Text am Rand, während oben/unten 2.5rem Luft standen. Jetzt dieselbe Rampe wie `.container` — geprüft an sechs Breiten.
- **Objektart-Chip in der Inventar-Galerie** («Gebäude» / «Grundstück») entfernt: die Art sagt schon das Bild (Foto gegen schraffierte Parzelle) und die Einheit im Fuss (GF gegen GSF); als dritter Chip las er sich wie ein Filterwert.
- **Fusszeilen der Galeriekarten lagen auf verschiedenen Höhen**, weil die Karten auf Inhaltshöhe standen. Jetzt füllen sie ihre Rasterzeile, der Fuss sitzt über `margin-top:auto` an der Unterkante — der Höhenausgleich landet als Lücke *über* dem Fuss.
- **Merkmalliste `.kv`**: Doppelpunkt an jeder Beschriftung, aus dem Blatt (`dt::after`) statt aus neun Zeichenketten, und eine spürbar getrennte Beschriftungsspalte (`fit-content(18rem)` + 2rem Spalte­nabstand). Beim Nachmessen fiel auf, dass die zuerst geschriebene Fassung `minmax(0, min(18rem, max-content))` **ungültig** war — `max-content` ist keine Länge, `min()` verwirft die ganze Angabe und `.kv` fiel auf eine Spalte zurück. `fit-content()` ist die richtige Grundform.
- **Der Strukturbaum zählte an den Filtern vorbei** (`.pf-tree`, in allen drei Apps): «21 von 41 Objekte» in der Werkzeugleiste, aber 41 in den Baumzahlen. Die Zahlen folgen jetzt Suche und Facetten — **nicht** aber der Baumauswahl selbst, sonst bliebe nach einem Klick nur der geklickte Ast mit einer «1» stehen. Leere Äste werden ausgeblendet statt eine 0 anzubieten. `scratchpad/check-tree.mjs` prüft in allen drei Apps, dass die Summe der Wurzelknoten der Trefferzahl entspricht — vor und nach einem Filterwechsel.

---

## 9. Was nachgeprüft wurde

Die Befunde der Review selbst wurden vor der Umsetzung nachgestellt (§1.1 im
Browser reproduziert, §1.2 die Signatur gegen den Aufruf gelesen, §1.4 beide
Formatierer durchgerechnet, §3 alle Zahlen einzeln gezählt, §5 jeder tote
Export einzeln gegrept, `estate.js` als **lebendig** nachgewiesen, bevor es auf
die Liste kam).

Die Umsetzung ist zusätzlich mit eigenen Prüfläufen belegt:

| Prüflauf | Was er zeigt |
|---|---|
| `check-ramps.mjs` | 40 berechnete Werte an 8 Breiten — identisch zu vorher |
| `check-focus.mjs` | alle 7 entfernten Fokusring-Regeln: Umriss bleibt der CD-Ring |
| `check-404.mjs` | 12 «nicht gefunden»-Wege, gleicher Aufbau |
| `check-tree.mjs` | Baumzahlen = Trefferzahl, in 3 Apps, vor und nach Filterwechsel |
| `check-banner.mjs` | Streifen fluchtet mit dem Seiteninhalt, 6 Breiten |
| `check-kv.mjs` | Doppelpunkt und zweispaltige Spur in jeder App |
| `check-pfcard.mjs` | Fusszeilen einer Rasterreihe enden auf derselben Höhe |
| `check-done.mjs` | Abschlussseite über `C.processDone`, mit Referenz und Knopfreihe |

**Die Testsuiten** (`test-content`, `test-routes`, `test-catalogue`,
`test-tabs`, `test-tenancies`, `test-estate`, `test-dashboard`,
`test-media-library`, `test-forms`, `test-search`, `test-apidocs`,
`test-login`, `test-building-create`, `test-data-integrity`) laufen grün.

`test-portfolio` meldet weiterhin **26 Fehlschläge**. Sie sind
**vorbestehend und unabhängig** von dieser Arbeit — nachgewiesen, indem die
Änderungen weggelegt wurden: auf `HEAD` sind es 27. Sie betreffen das
Bildmosaik und die Grundstück-Detailansicht und gehören in eine eigene Runde.

---

## Anhang: Testwerkzeug — behoben

`scripts/lib/cdp.mjs` startete Edge und verband sich anschliessend mit **dem,
was auf dem Debug-Port antwortete**. Drei Suiten teilten sich Port 9333; ein
übrig gebliebener Browser wurde mitsamt seinem warmen HTTP-Cache übernommen.
Das hat am 29. und 30. Juli zweimal zu Phantomfehlern geführt, die nach dem
Abschiessen der Prozesse verschwanden (zuletzt 185 verwaiste `msedge`-Prozesse).

`launch()` sucht sich jetzt selbst einen freien Port und **bricht ab**, wenn auf
einem ausdrücklich genannten Port schon jemand antwortet, statt sich anzuhängen.
Zusätzlich startet der Browser mit `--disable-http-cache`.
