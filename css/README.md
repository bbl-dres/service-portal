# CSS-Architektur

Das Portal verwendet Plain CSS ohne Build-Schritt, Framework oder Laufzeitabhängigkeit. `index.html` lädt die statische Kaskade; `js/routing/css-loader.js` lädt die für eine Micro-App benötigten Blätter einmal pro Sitzung und der Router wartet vor dem Rendern auf deren `load`-Promise. Die Reihenfolge ist damit Teil der öffentlichen UI-Architektur: keine Datei per `@import` einschieben und keine App-Datei direkt in `index.html` verlinken.

## Kaskade und Laufzeitanker

Die 26 statischen Blätter stehen in dieser exakten Reihenfolge in `index.html`:

```text
01 css/tokens.css
02 css/skins/intranet.css
03 css/foundations/reset.css
04 css/foundations/typography.css
05 css/foundations/elements.css
06 css/layouts/page.css
07 css/layouts/grid.css
08 css/navigations/header.css
09 css/navigations/drawer.css
10 css/layouts/shell.css
11 css/components/button.css
12 css/components/card.css
13 css/components/table.css
14 css/components/form.css
15 css/components/listbox.css
16 css/components/feedback.css
17 css/navigations/tabs.css
18 css/components/content.css
19 css/sections/search.css
20 css/sections/filter-panel.css
   <meta name="css-app-anchor" content="early">
21 css/sections/catbar.css
22 css/sections/explorer.css
23 css/sections/sidebar-tree.css
24 css/sections/landscape.css
25 css/components/overlay.css
   <meta name="css-app-anchor" content="portfolio">
26 css/utilities.css
   <meta name="css-app-anchor" content="late">
```

Die acht lazy Blätter besitzen unabhängig von der Reihenfolge der besuchten Routen diese kanonische Reihenfolge:

| Nr. | Datei | Anker | Position in der Gesamtkaskade |
| ---: | --- | --- | --- |
| 1 | `css/apps/dataportal.css` | `early` | nach `filter-panel.css`, vor `catbar.css` |
| 2 | `css/apps/portfolio.css` | `portfolio` | nach `overlay.css`, vor `utilities.css` |
| 3 | `css/apps/archive.css` | `late` | nach `utilities.css` |
| 4 | `css/apps/floorplan.css` | `late` | nach `archive.css` |
| 5 | `css/apps/workplace.css` | `late` | nach `floorplan.css` |
| 6 | `css/apps/floorplan-editor.css` | `late` | nach `workplace.css` |
| 7 | `css/apps/plan-check.css` | `late` | nach `floorplan-editor.css` |
| 8 | `css/apps/room-booking.css` | `late` | nach `plan-check.css` |

`data-app-style-index` und `data-app-style-slot` halten diese Reihenfolge auch dann stabil, wenn eine spätere Route zuerst besucht wird. Die Anker müssen erhalten bleiben; ein fehlender Anker ist ein Laufzeitfehler. `scripts/test-css-layers.mjs` prüft Reihenfolge, CSS-404, Parse-Fehler, FOUC, beide Skins, Reduced Motion und 320-px-Reflow.

### Lazy-Abhängigkeiten

`APP_SHEETS` in `js/routing/css-loader.js` ist die einzige Quelle für die Zuordnung. Eine Änderung an App-CSS und Router-Abhängigkeiten erfolgt im selben Commit.

| Micro-App | Geladene Blätter in Reihenfolge |
| --- | --- |
| `space-request` | — |
| `fault-report` | — |
| `portfolio` | `dataportal`, `portfolio` |
| `projects` | `dataportal`, `portfolio` |
| `document-archive` | `dataportal`, `archive` |
| `workspace` | `dataportal`, `portfolio`, `floorplan`, `workplace` |
| `floorplan-editor` | `dataportal`, `portfolio`, `floorplan`, `floorplan-editor` |
| `plan-check` | `plan-check` |
| `room-booking` | `dataportal`, `floorplan`, `workplace`, `room-booking` |
| `transaction` | — |
| `dataportal` | `dataportal` |
| `api-docs` | `dataportal` |
| `building-create` | `dataportal`, `portfolio` |
| `media-library` | `dataportal`, `portfolio` |
| `tenancies` | `dataportal`, `portfolio`, `floorplan` |
| `metadata-catalog` | — |
| `process-docs` | `dataportal` |
| `shop` | — |

## Zuständigkeit der Schichten

| Schicht | Besitzt | Besitzt nicht |
| --- | --- | --- |
| `tokens.css` | CD-Rampen, Portalrollen, Skalen und dokumentierte feste Domänenwerte | Komponenten- oder Routenselektoren |
| `skins/` | ausschliesslich Laufzeitüberschreibungen der Markenrampen | Layout, Zustände oder Fokusfarben |
| `foundations/` | Reset, Font-Faces, Typografie, native Elemente und globale Accessibility-Grundlagen | Seiten- und App-Layout |
| `layouts/` | Seitenrahmen, Grid, Shell und Breadcrumb-Geometrie | fachliche Komponenten |
| `navigations/` | Header, Drawer sowie gemeinsam gruppierte Tabs und Pagination | App-spezifische Navigation |
| `components/` | wiederverwendbare Buttons, Cards, Tabellen, Formulare, Listbox, Feedback, Content und Overlays | Routenwissen |
| `sections/` | seitenübergreifende Kompositionen: Suche, Facetten, Catbar und Explorer | nur in einer App erreichbare Regeln |
| `apps/` | ausschliesslich lazy, routenspezifische Geometrie und Fachvisualisierung | Shell- oder Shared-Component-Regeln |
| `utilities.css` | kleine, eindeutige Hilfsklassen sowie Print-/Reduced-Motion-Kaskadenabschluss | neue Komponenten |

Die vorgeschlagene Taxonomie wurde nach dem Abhängigkeitsaudit leicht angepasst. `filter-panel.css` muss statisch sein, weil Facetten sowohl statische Kataloge als auch Micro-Apps bedienen. `listbox.css` wird von globalen Suchvorschlägen und der Adress-Combobox geteilt. `explorer.css` trägt die historischen `pf-*`-Strukturen; `sidebar-tree.css` und `landscape.css` enthalten die daraus konsolidierten, seitenübergreifenden Komponenten. Umgekehrt bilden die acht Dateien unter `apps/` die acht realen Lazy-Grenzen ab; ein Zusammenlegen würde auf mehreren Routen unbenutztes CSS laden oder Abhängigkeitsreihenfolgen verstecken.

Die Aufgabenbeschreibung sagte zugleich «roughly fifteen files» und lieferte eine 29-Dateien-Taxonomie. Die auditierte Struktur umfasst mit der neuen Planprüfung 34 Dateien (26 statisch, 8 lazy) und bleibt damit nahe an der konkreten Zielliste. Breadcrumb bleibt in `shell.css`, Pagination bei Tabs; das vermeidet die ausdrücklich unerwünschte Datei pro Kleinstkomponente.
Chart-Chrome bleibt in `dataportal.css`, Karten-/Mosaik-Chrome in
`portfolio.css`: separate `charts.css`/`map.css` wären keine eigenständigen
Ladegrenzen, sondern würden nur zusätzliche Abhängigkeitsdateien erzeugen.
Empty State gehört als Zustandsfeedback in `feedback.css`, nicht in eine eigene
Section-Datei.

## Benennung, Spezifität und Zustände

- Neue Klassen folgen BEM: `.block`, `.block__element`, `.block--modifier`. Ein Element wird nicht über die DOM-Tiefe benannt.
- Die aus CD Bund v1.0.5 übernommenen verschachtelten Namen bleiben autoritative Ausnahmen: `card__footer__*`, `form__group__*`, `menu__item__*`, `search__button__title` und `shopping__card__image`. Sie werden nicht kosmetisch umbenannt.
- CSS selektiert nie über eine ID. IDs bleiben im HTML für Labels, Fragmente, ARIA und JS erlaubt.
- Selektoren bleiben möglichst einstufig; `:where()` senkt die Spezifität gemeinsamer Zustandsverträge. Keine Verdopplung wie `.block.block` als Kaskadenwerkzeug.
- Jede interaktive Komponente definiert, soweit semantisch anwendbar: Default, `:hover`, `:active`, `:focus-visible`, Disabled, Loading, Error und Empty. Bevorzugte Zustandsquellen sind native/ARIA-Attribute (`:disabled`, `[aria-disabled="true"]`, `[aria-busy="true"]`, `[aria-invalid="true"]`, `[data-empty="true"]`); BEM-Modifier sind Render-Aliasse wie `--disabled`, `--loading`, `--error`, `--empty`.
- `focus-visible` verwendet `--color-focus-ring` beziehungsweise auf dunkler Chrome `--color-focus-ring-negative`; Fokus darf auf keiner Marken- oder Statusfläche verschwinden.
- Interaktive Ziele behalten die 44/48/52-px-Rampen und 320-px-Reflow. Kompakte Mausdarstellung darf die Trefferfläche für Touch oder grobe Zeiger nicht verkleinern.

`!important` ist nur an einer echten, kommentierten Kaskadengrenze zulässig. Die verbleibenden Fälle sind `[hidden]` im Reset, der verschachtelte Drawer-Zustand aus der CD-Navigation, der Adapter für fremdes Swagger-CSS sowie Reduced-Motion- und Print-Overrides in `utilities.css`. Jede neue Verwendung braucht unmittelbar daneben den Grund und einen Nachweis, warum Quellreihenfolge oder geringere Spezifität nicht genügen.

## Dead Code und dynamische Klassen

Vor dem Löschen wird in `js/**`, `index.html` und `data/**` gesucht. Klassen entstehen auch in Template-Strings, zum Beispiel `card--${variant}` oder `status--${s}`. Trifft der Stamm einer Regel auf eine solche Interpolation, ist die Regel nicht als tot bewiesen.

```powershell
rg -n "verdächtige-klasse|verdächtiger-stamm" js index.html data
rg -n '\$\{[^}]+\}' js
```

Nur eine Regel ohne statischen, dynamischen oder datengetriebenen Produzenten darf entfallen. Vermutlich tote Regeln bleiben mit einem kurzen Kommentar zu Suchumfang und möglichem dynamischem Produzenten erhalten. Beim Umbenennen werden Komponentenfabrik, alle direkten Templates, Tests und Datenproduzenten im selben Commit aktualisiert.

## Tokens und CD Bund

Autoritative Quelle ist CD Bund v1.0.5 im lokalen Checkout `C:\Users\david\Documents\GitHub\designsystem`, Commit `cbedbb9` (entspricht `github.com/swiss/designsystem`). In dieser Version sind nur `--color-primary-{50..900}` und `--color-secondary-{50..900}` erstklassige CSS-Rampennamen des Designsystems. Abstände, Radien, Schatten, Typografie, Striche und Breakpoints liegen dort als Tailwind-Skalen vor. Die übrigen Variablen dieses Portals sind deshalb ausdrücklich lokale Rollen-/Skalenaliase mit Quellenkommentar; sie dürfen nicht als erfundene CD-Token ausgegeben werden.

So wird ein Token ergänzt:

1. Im exakten CD-Commit nach Name, Wert und Komponentenkontext suchen. Existiert ein CSS-Custom-Property, dessen Namen unverändert übernehmen.
2. Andernfalls zuerst eine vorhandene Portalrolle wiederverwenden. Nur bei neuer, wiederkehrender Bedeutung einen lokalen Alias in `tokens.css` ergänzen und CD-Datei/Skalenstufe sowie Portalrolle kommentieren.
3. Markenabhängige Werte zeigen auf Primary/Secondary und werden gegebenenfalls in `skins/intranet.css` überschrieben. Fokus, Fehler und fachliche Datenfarben werden nicht an die Marke gekoppelt.
4. Komponenten konsumieren den Alias; sie definieren keine zweite private Skala. Ein einmaliger Fachwert bleibt nur mit Warum-Kommentar lokal.
5. `node scripts/check-css-tokens.mjs` ausführen. Der Check verbietet undefinierte Variablen, rohe Farben, Dauern, z-Indices, Radien, Schatten, Strichbreiten, skalenfremde Breakpoints und das Umgehen vorhandener Spacing-Aliasse.

### Snap-Regel

Tokenersatz erhält standardmässig den berechneten Wert. Ein Snap auf eine benachbarte CD-Stufe ist eine sichtbare Designänderung und benötigt Review-Dokumentation. In Schritt 2 wurden ausschliesslich diese Werte gesnappt:

```text
.2rem     -> .25rem
.1875rem  -> .25rem
.35rem    -> .375rem
.45rem    -> .5rem
.5625rem  -> .5rem
.7rem     -> .75rem
.8rem     -> .75rem
.85rem    -> .875rem
.9rem     -> .875rem
1.05rem   -> 1rem
1.15rem   -> 1.125rem
399.98px  -> 479.98px
```

Diese Liste ist abgeschlossen. Jeder künftige Snap muss mit Vorher/Nachher, Konsumenten, visueller Wirkung und Reflow-Prüfung im Design-Review dokumentiert werden. Neue Breakpoints verwenden die CD-Stufen 480, 640, 768, 1024, 1280, 1544 und 1920 px (Max-Varianten jeweils `.02px` darunter). Die kommentierte FPE-Fit-Grenze `1599.98px` ist die einzige fachlich begründete Ausnahme.

## Skins und bewusste Abweichungen

`:root` ist der Federal-Skin mit Primary `#d8232a`; `.body--intranet` retintet Primary **und** Secondary zur blauen Intranet-Rampe. Die Umschaltung erfolgt ausschliesslich über die Body-Klasse. Der exakte Farbwert `#8655F6` bleibt für `--color-focus-ring` reserviert und wird nie geskinnt; der negative Ring verwendet die CD-Stufe Purple-300.

Bewusst skinfest bleiben:

- `--color-federal-red` für hoheitliche/prototypische Hinweise und die dedizierte rote Error-Rampe;
- kategoriale Chartfarben, deren Bedeutung nicht mit der Marke wechseln darf;
- Dokumentpapier, Drafting-/3D-Canvas, Lightbox-Bedienflächen und kontrastbestimmte Scrims;
- fachliche SVG-/Canvas-Paletten, ViewBox-Koordinaten, Grundriss-, Karten-, BPMN- und 3D-Geometrie.

Weitere dokumentierte Portalentscheidungen sind die streng durchgehaltenen Zielgrössen, eine feste 44-px-Catbar-Zeile, die lokale `--surface-*`-Rolle für umrissene Panels und die beibehaltenen CD-Formen: Default-Cards bleiben quadratisch/randlos mit `shadow-lg`, Tabellen quadratisch mit neutralem Rand und `shadow-md`, Inputs `rounded-xs` mit der CD-Feldrampe. Abweichungen stehen direkt an der Regel; ohne solchen Kommentar gilt CD v1.0.5.

## Payload-Referenz

Aktueller Messstand, UTF-8-Rohbytes und gzip Level 6:

| Gruppe | Dateien | Zeilen | Rohbytes | gzip-6 |
| --- | ---: | ---: | ---: | ---: |
| vorher: `app.css` + `tokens.css` | 2 | 5'174 | 372'077 | 104'848 |
| aktuell: statische Kaskade | 26 | 4'611 | 321'404 | 107'339 |
| aktuell: lazy Apps allein | 8 | 1'980 | 145'471 | 32'333 |
| aktuell: alle Blätter | 34 | 6'591 | 466'875 | 139'672 |

Die gzip-Werte summieren jede tatsächlich getrennte HTTP-Response; sie sind
nicht die Kompression eines künstlich zusammengefügten Bundles. Der statische
Erstpfad liegt gegenüber dem Monolith-Baselinewert raw 13.6 % tiefer; die Summe
der getrennten gzip-Antworten liegt 2.4 % höher. `plan-check.css` kommt nur auf
der Planprüfungsroute hinzu: 398 Zeilen, 30'678 Rohbytes beziehungsweise 5'819
Bytes gzip-6. Die Summe aller, in einer
normalen Route nie gleichzeitig neu geladenen Blätter trägt 34 eigene
Kompressionskontexte. `scripts/css-bundle.mjs`
ist ein optionaler, dependency-freier Verifier/Concat-Schritt und keine
Entwicklungsvoraussetzung.

## Verifikation

Schnelle Struktur- und Token-Gates:

```powershell
node scripts/check-css-tokens.mjs
node scripts/css-bundle.mjs
node scripts/test-css-layers.mjs
node scripts/test-routes.mjs
node scripts/check-focus.mjs
node scripts/check-ramps.mjs
```

`node scripts/css-bundle.mjs --verify-legacy` ist ausschliesslich am Step-1-Split-Stand mit vorhandener, auditierter `css/app.css` ausführbar; im aktuellen Baum fehlt die absichtlich pensionierte Quelldatei. Der unveränderliche Byte-/SHA-Nachweis bleibt im Skript hinterlegt.

Die zehn CDP-Suiten:

```powershell
node scripts/test-apidocs.mjs
node scripts/test-catalogue.mjs
node scripts/test-content.mjs
node scripts/test-dashboard.mjs
node scripts/test-estate.mjs
node scripts/test-forms.mjs
node scripts/test-login.mjs
node scripts/test-portfolio.mjs
node scripts/test-race.mjs
node scripts/test-tabs.mjs
```

Vollreview für beide Skins; getrennte Ausgabeverzeichnisse verhindern, dass ein Lauf den anderen überschreibt:

```powershell
$env:APP_SKIN='federal'
$env:REVIEW_OUTPUT_DIR=Join-Path $env:TEMP 'service-portal-review-federal'
node scripts/review-audit.mjs
node scripts/review-accessibility.mjs

$env:APP_SKIN='intranet'
$env:REVIEW_OUTPUT_DIR=Join-Path $env:TEMP 'service-portal-review-intranet'
node scripts/review-audit.mjs
node scripts/review-accessibility.mjs
```

Danach folgt ein manueller Keyboard-Pass: Skip-Link, Header/Drawer, Tabs mit Pfeiltasten, Dialog-/Viewer-Fokusfalle, Escape/Schliessen mit Fokusrückgabe sowie jede sichtbare Aktion einmal ohne Zeiger bedienen. Es dürfen keine Konsolenfehler, CSS-404, ungestylte App-Frames oder Fokusverluste auftreten.
