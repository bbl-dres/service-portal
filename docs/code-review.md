# Code-Review — Vereinfachung, Wiederverwendung, Konsistenz

**Stand:** 30. Juli 2026 · **Gegenstand:** 13 000 Zeilen JS, 3 500 Zeilen CSS · **Auftrag:** ausschliesslich Refactoring — keine Funktion kommt dazu, keine fällt weg.

**Methode:** vier unabhängige Prüfläufe über getrennte Bereiche (CSS/Tokens, `components.js`, die sechs Micro-Apps, `pages`/`core`/`router`/`shell`), dazu ein eigener Lauf über die Formular-Apps und die Testwerkzeuge. Jeder Befund trägt Datei und Zeile. **Die schwerwiegenden Befunde sind einzeln nachgestellt**, nicht übernommen — was nachgestellt wurde, steht in [§8](#8-was-nachgeprüft-wurde).

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

## 7. Reihenfolge der Umsetzung

Von risikoarm nach risikoreich. Die ersten drei Stufen sind reine Textverschiebung.

1. **Die sieben Fehler aus §1** — zuerst, damit das Refactoring sie nicht mitzementiert. Klein, einzeln prüfbar.
2. **`js/format.js`, `js/domain.js`, `js/crumbs.js`, `js/links.js`** (§2.8) — kein Verhaltensrisiko, entfernt ~120 Zeilen und behebt nebenbei die Grössen-Divergenz aus §1.4.
3. **Toter Code** (§5) — ~200 Zeilen CSS und JS, keine Wirkung.
4. **Tokens** (§3) in der Reihenfolge Farbe → Zeit → Z-Achse → Abstand. Jede Stufe ist mechanisch und einzeln nachmessbar.
5. **`js/map-slot.js`** (§2.4) — klar abgegrenzt, sechs Aufrufstellen.
6. **`wireCatbar`** (§2.3) — zwei Aufrufer, klein, hoher Aufräumwert.
7. **`js/spatial-tree.js`** (§2.1) — grösster Einzelgewinn, aber erst nach 1–6: die acht Verhaltensunterschiede müssen Zeile für Zeile abgehakt werden.
8. **`js/catalogue-page.js`** (§2.2) — zuletzt und **als fünf kleine Bausteine**, nicht als eine Funktion mit dreissig Optionen.

**Erwartete Wirkung:** rund **900 Zeilen weniger** bei gleichem Funktionsumfang, eine Token-Schicht, die tatsächlich benutzt wird, und — der eigentliche Gewinn — **eine Stelle statt drei**, an der eine Änderung am räumlichen Baum oder an der Katalogleiste einzupflegen ist.

---

## 8. Was nachgeprüft wurde

Nicht übernommen, sondern selbst nachgestellt:

- **§1.1** im Browser reproduziert: Reset-Ziel bleibt `?classification=internal`.
- **§1.2** Signatur von `empty()` gegen den Aufruf in `news.js` gelesen — die Inversion ist real.
- **§1.3** `fgroup()` gegen `C.filterGroup` verglichen; `checked` und `id` fehlen, Vorgabefilter ist `['building']`.
- **§1.4** beide Formatierer mit 2048/4820/512 KB durchgerechnet: «4,7 MB» gegen «4.7 MB».
- **§1.5/§1.6** `--color-focus` und `--fw-normal` existieren in `tokens.css` nicht; `1544px` steht an 12 anderen Stellen.
- **§1.7** Zeilenreihenfolge und Spezifität beider Regeln gelesen.
- **§2.1/§2.3** Blöcke nebeneinandergelegt; die Verdrahtungen unterscheiden sich nur im Commit-Ziel.
- **§3** alle Zahlen der Tabelle einzeln gezählt (`grep -c`).
- **§5** jeder tote Export einzeln gegrept (`C.<name>` und blanker Aufruf); `resolveChildren` über `childrenFrom` und die Zweigbedingung geprüft; `estate.js` als **lebendig** nachgewiesen, bevor es auf die Liste kam.

**Nicht geprüft und deshalb als Vorschlag, nicht als Befund zu lesen:** die genauen Signaturen der vorgeschlagenen neuen Module (§2) — sie sind aus den Aufrufstellen abgeleitet, aber nicht implementiert.

---

## Anhang: Testwerkzeug

Kein Befund am Produktcode, aber die Ursache wiederkehrender Falschalarme:

`scripts/lib/cdp.mjs:28-46` startet Edge und verbindet sich anschliessend mit **dem, was auf dem Debug-Port antwortet**. Drei Suiten teilen sich Port 9333 — `test-tabs.mjs` nennt ihn, `test-building-create.mjs` und `test-media-library.mjs` rufen `launch()` ohne Port und erben denselben Standardwert. Ein übrig gebliebener Browser wird dadurch mitsamt seinem warmen HTTP-Cache übernommen.

Das hat am 29. und 30. Juli zweimal zu Phantomfehlern geführt, die nach dem Abschiessen der Prozesse verschwanden — zuletzt bei `table--rows-clickable`, wo die Klasse nachweislich im DOM stand, der Test sie aber nicht sah (185 verwaiste `msedge`-Prozesse).

→ `launch()` sollte einen freien Port selbst wählen **oder** abbrechen, wenn der Port schon antwortet, statt sich anzuhängen.
