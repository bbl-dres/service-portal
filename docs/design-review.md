# Design Review service-portal gegen CD Bund

| Merkmal | Wert |
| --- | --- |
| Stand | 8. August 2026 |
| Branch | `main` (Ausgangsreview: `design-review-2026-08`) |
| Referenz | Schweizer Design System, lokale Version 1.0.5 |

## CSS-Refactoring – Nachtrag vom 8. August 2026

Dieser Nachtrag ist der aktuelle technische Abnahmestand des CSS-Refactorings.
Die Ausgangsbefunde und die 57 Zustände beziehungsweise 171 Bilder der
ursprünglichen visuellen Review bleiben weiter unten als historische Baseline
erhalten. Die heute ausführbare Matrix in `scripts/review-routes.mjs` enthält
70 Zustände. `review-audit.mjs` rendert jeden davon bei 320, 768 und 1440 px,
also 210 Renderzustände; `review-accessibility.mjs` prüft die 70 Zustände je
einmal. Die eingecheckten Vorher-/Nachher-Screenshot-Artefakte wurden nicht von
57 auf die aktuelle Matrix erweitert und bleiben deshalb bei 171.

### Umsetzung und CD-Abgleich

1. **Split (`73dd190`).** `css/app.css` wurde ohne Umbenennung, Zusammenführung,
   Tokenisierung oder Neuformatierung in die geordnete Layerstruktur verschoben.
   Die geprüfte Quelle hatte 4'760 Zeilen, 348'434 Bytes und SHA-256
   `3558fec8a0ef7d7db7321b772ca0beebb5c71ba0476d70c5226a1d8e3c2f6bbd`.
   `scripts/css-bundle.mjs --verify-legacy` bewies, dass die Konkatenation in
   kanonischer Ladefolge bytegleich war. Der reine Split bestand aus 19 neuen
   statischen Concern-Dateien plus dem bestehenden `tokens.css` und sieben
   lazy App-Dateien. `index.html` lud damit 20 statische Schichten explizit; der
   Router lud die App-Blätter erst vor dem Rendern der jeweiligen Micro-App.
   Nach Konsolidierung und der neuen Planprüfungsgrenze umfasst die aktuelle
   Struktur 32 Dateien – 24 statisch, acht lazy. Sie liegt über dem groben Ziel
   von fünfzehn, weil die geprüften
   App-Abhängigkeitsgrenzen sonst wieder unbeteiligtes CSS in den Erstaufruf
   ziehen würden. Innerhalb dieser Grenzen bleiben Komponenten nach Anliegen
   gruppiert und nicht auf eine Datei pro Komponente verteilt.
2. **Tokenisierung (`fb2e9bb`).** Referenz war die lokale Quelle von
   `swiss/designsystem` v1.0.5 am Commit `cbedbb9`. Das CD veröffentlicht als
   erstklassige CSS Custom Properties nur `--color-primary-50..900` und
   `--color-secondary-50..900`; die übrigen Portal-Tokens sind deshalb klar als
   lokale semantische Aliasse auf CD-Skalen dokumentiert und werden nicht als
   erfundene CD-Tokennamen ausgegeben. Farben, Abstände, Kontrollen, Radien,
   Schatten, Dauern, z-Ebenen und Breakpoints laufen über geprüfte Skalen. Der
   statische Token-Check verhindert undefinierte Variablen und neue Literale
   ausserhalb der dokumentierten Fachausnahmen.
3. **Konsolidierung (`a4e75c0`).** Gemeinsame Loading-, Filter-, Listbox-,
   Viewer- und Overlay-Regeln wurden aus lazy App-Dateien in statische
   Komponenten verschoben; Tabelle und Formular erhielten getrennte
   Concern-Dateien. Markup-Fabriken und alle Aufrufstellen wurden gemeinsam auf
   BEM umgestellt, unter anderem Pagination, Booking-Bar, Catbar und Warenkorb.
   CSS-ID-Selektoren sind entfernt, Selektoren mit `:where()` abgeflacht und
   verbleibende `!important` auf Reset-, Druck-/Reduced-Motion-,
   Drittanbieter- oder nachgewiesene Navigationsgrenzen kommentiert. Vor dem
   Löschen wurden `js/**`, `index.html` und `data/**` inklusive interpolierter
   Familien wie `card--${variant}` und `status--${s}` geprüft. Nur bestätigte
   Altregeln – etwa alte Service-Controls, Chart-Overlay-Hüllen sowie verwaiste
   Empty-/Form-/Lightbox-/FPE-Hooks – entfielen; dynamisch mögliche Familien
   blieben erhalten. Der gemeinsame Zustandsvertrag deckt Default, Hover,
   Active, `focus-visible`, Disabled, Loading, Error und Empty ab.
4. **Politur (`69386b5`).** Karten, Tabellen und Panels verwenden nun
   dokumentierte Surface-, Border-, Radius- und Elevation-Stufen; Formulare,
   Tabellenfuss, responsive Innenabstände, lange Inhalte und 320-px-Shrink-
   Grenzen sind vereinheitlicht. Icons behalten die CD-Grössenrampen, verwenden
   aber konsistente quadratische Maskenboxen und optische Ausrichtung. Die
   Federal bleibt die `:root`-Vorgabe, `.body--intranet` überschreibt beide
   Markenrampen zur Laufzeit; MapLibre und SVG-Charts lesen deshalb den berechneten Wert am
   `body` statt fälschlich nur an `html`. `#8655F6` bleibt ausschliesslich der
   helle Fokusring; auf dunklem Chrome gilt der CD-Negativring Purple 300, mit
   explizitem Reset auf hellen Flächen in Viewern.

Die wenigen im CD selbst vorkommenden mehrstufigen Elementnamen
(`card__footer__*`, `form__group__*`, `menu__item__*`,
`search__button__title`, `shopping__card__image`) bleiben bewusst erhalten.
Sie sind keine neu erfundenen Portal-Ausnahmen, sondern Quellkonventionen der
verbindlichen Version 1.0.5.

### Gesnappte Werte und bewusste Ausnahmen

Alle Längen in den ersten elf Zeilen sind `rem`-Werte.

| Ausgangswert | Skalenwert |
| ---: | ---: |
| `.2rem` | `.25rem` |
| `.1875rem` | `.25rem` |
| `.35rem` | `.375rem` |
| `.45rem` | `.5rem` |
| `.5625rem` | `.5rem` |
| `.7rem` | `.75rem` |
| `.8rem` | `.75rem` |
| `.85rem` | `.875rem` |
| `.9rem` | `.875rem` |
| `1.05rem` | `1rem` |
| `1.15rem` | `1.125rem` |
| Breakpoint `399.98px` | `479.98px` |

Bewusst beibehalten und am Verbraucher kommentiert sind die 1599.98-px-
Fit-Schwelle des Plan-Editors, fachliche Media-/Container-Schwellen,
Domänenpaletten, feste Scene-/Drafting-/Reticle-Farben, Canvas-/SVG-
Koordinatengeometrie und komponentenlokale z-Ordnungen. Ebenfalls bewusst sind
die strengeren 44/48/52-px-Zielgrössen, die zwei zur Laufzeit umgefärbten
Markenrampen und die vom Skin unabhängigen Fokusfarben.

### CSS-Umfang und Übertragung

Die gzip-Werte wurden mit Kompressionsstufe 6 je Datei ermittelt und danach
addiert.

| Messpunkt | Zeilen | Rohbytes | gzip -6, Summe je Datei |
| --- | ---: | ---: | ---: |
| Vorher `css/app.css` | 4'760 | 348'434 | 96'142 |
| Vorher `css/tokens.css` | 414 | 23'643 | 8'706 |
| Vorher, App + Tokens | 5'174 | 372'077 | 104'848 |
| Nachher, statischer Erstaufruf | 3'826 | 266'286 | 89'179 |
| Nachher, acht lazy App-Dateien | 1'508 | 110'533 | 23'243 |
| Nachher, alle 32 CSS-Dateien | 5'334 | 376'819 | 112'422 |

Die Summe aller Dateien ist keine Erstaufrufgrösse. Normale Seiten fordern kein
`css/apps/*.css` an; eine Micro-App lädt nur ihre deklarierte Teilmenge und der
Browser cached bereits geladene Abhängigkeiten. Zwischen statischem Erstaufruf
und dem theoretischen Abruf aller acht App-Dateien liegen 1'508 Zeilen,
110'533 Rohbytes beziehungsweise 23'243 gzip-Bytes. `plan-check.css` macht
davon 232 Zeilen, 18'572 Rohbytes und 3'345 gzip-Bytes aus und wird nur auf der
Planprüfungsroute geladen. Zudem ist eine Summe
einzeln komprimierter Dateien nicht direkt mit einem einzigen konkatenierten
gzip-Strom vergleichbar: jede Datei trägt einen eigenen gzip-/Wörterbuch-
Overhead. Der relevante initiale Vergleich ist daher 104'848 zu 89'179
gzip-Bytes; die Vollsumme dokumentiert Wartungsumfang und den kalten Worst Case
über alle Micro-Apps, nicht den Transfer einer einzelnen Route.

### Finale Dual-Skin-Abnahme

Federal und Intranet wurden jeweils gegen dieselbe aktuelle Matrix geprüft.
Beide `review-audit.mjs`-Läufe endeten mit Status 0 und exakt:

| Skin | Audit-Summe |
| --- | --- |
| Federal | `routes 210 · overflow 0 · h1 0 · duplicateIds 0 · labels 0 · images 0 · headings 9 · tables 0 · targets 1012 · compactTargets 427` |
| Intranet | `routes 210 · overflow 0 · h1 0 · duplicateIds 0 · labels 0 · images 0 · headings 9 · tables 0 · targets 1012 · compactTargets 427` |

`headings`, `targets` und `compactTargets` sind gezählte Review-Hinweise – unter
anderem fachliche SVG-Flächen und bewusst kompakte Editor-Geometrie – und keine
verschwiegenen Nullwerte. Die harten Struktur-/Reflow-Kategorien stehen separat
in derselben Summe.

Beide `review-accessibility.mjs`-Läufe endeten ebenfalls mit Status 0 und exakt:

| Skin | Accessibility-Summe |
| --- | --- |
| Federal | `routes 70 · overflow 0 · positiveTabindex 0 · brokenReferences 0 · hiddenFocusable 0 · focusIndicator 0 · mainLandmark 0 · unnamedAxControls 0` |
| Intranet | `routes 70 · overflow 0 · positiveTabindex 0 · brokenReferences 0 · hiddenFocusable 0 · focusIndicator 0 · mainLandmark 0 · unnamedAxControls 0` |

Der Planprüfungszustand in dieser Matrix ist die aktive, nicht-produktive
Testoberfläche für lokale DWG-Dateien. Der dedizierte `test-plan-check.mjs`
deckt zusätzlich Dateiauswahl und Drop, Validierungsfehler, den realen
Workbench-/Viewer-Zustand, Wiederholen, Abbruch und Worker-Cleanup ab. Diese
Abnahme bewertet das Browser-Testwerkzeug und ist keine Freigabe eines
produktiven Plan- oder Genehmigungsprozesses.

Zusätzlich liefen die zehn verlangten CDP-Suiten (`apidocs`, `catalogue`,
`content`, `dashboard`, `estate`, `forms`, `login`, `portfolio`, `race`,
`tabs`), alle 39 kanonischen Routen und 13 Redirects, der CSS-Layer-/FOUC-/404-Check, der
Token-Check, die Fokusprüfung, Reduced Motion und 320-px-Reflow ohne Regression.

## 1. Zusammenfassung

Das Portal ist in seiner Grundstruktur weitgehend CD-konform. Farb- und
Typografierampen, Intranet-Skin, Container, Bundes-Chrome, Karten, Formulare,
Tabellen, Register und Fokusdarstellung orientieren sich nachvollziehbar an
`swiss/designsystem` 1.0.5. Das Portal deklariert dieselbe Version als
Ausrichtungsziel. Eine Versionsabweichung liegt nicht vor.

Geprüft wurden der vollständige statische SPA-Code, die lokale CD-Quelle, alle
gemeinsamen UI-Fabriken und alle fachlichen Ansichten. Die historische visuelle
Baseline umfasst 57 repräsentative Routen und Zustände in 320, 768 und 1440 px,
insgesamt 171 Full-Page-Screenshots. Nach Freigabe wurden die neun Befunde
F01–F09 in sechs Wellen umgesetzt. Die aktuelle ausführbare Matrix umfasst
70 Zustände beziehungsweise 210 Renderzustände. Der Dual-Skin-Audit weist dort
keine horizontalen Überläufe, fehlenden H1, doppelten IDs, unbeschrifteten
Bedienelemente, Bilder ohne `alt` oder fehlerhaften Tabellenköpfe aus; die neun
Heading- und die Target-Hinweise sind im CSS-Nachtrag oben ausdrücklich
ausgewiesen. Die relevanten Funktions- und Architektursuiten laufen durch.

Die Umsetzung umfasst die priorisierte Token-Bereinigung, gemeinsame
Combobox- und Viewer-Muster, eine korrigierte Inhalts- und
Swagger-Überschriftenstruktur, natürliche Hero-Bildformate, vollständige
Fokus-/Disabled-Zustände, responsive Zielgrössen, mobile Shop-Kategorien und
eine dynamische Platzreserve für den fixierten Hinweisbanner. Der ergänzende
Accessibility-Kurztest ist in allen aktuellen 70 Zuständen und in beiden Skins
in sämtlichen ausgewiesenen Fehlerkategorien ohne automatisierten Befund.

Es wurden keine Produktfunktionen, Routen oder Daten entfernt oder vereinfacht.
Die bewusst nicht umgesetzten Architekturentscheide stehen in Abschnitt 6; die
gesprochene Ausgabe mit realer Assistenztechnik bleibt ein manueller
Release-Check.

### Bewertungslegende

| Kürzel | Bedeutung |
| --- | --- |
| K | konform |
| G | geringe Abweichung |
| W | wesentliche Abweichung |
| NB | nicht bewertbar, da kein CD-Pendant oder Drittanbieter-UI |

## 2. Bewertungsübersicht vor Umsetzung

Die Tabelle hält den bei der Bestandsaufnahme bewerteten Ausgangszustand fest.
Der Umsetzungsstatus der Abweichungen folgt in Abschnitt 5.1.

| Komponente | Pixel | Tokens | Namen | HTML | Zustände | Responsive | Barrierefreiheit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Grundlagen, Typografie, Links, Listen | K | G | G | K | K | K | K |
| Container, Grid, Sections | G | G | G | G | K | K | K |
| Bundes-Chrome: Top-Bar, Header, Logo | G | G | K | K | K | G | K |
| Hauptnavigation, Drawer, Mobile-Menü | G | G | G | G | K | G | K |
| Brotkrumen und Footer | K | G | K | K | K | K | K |
| Buttons und Icons | K | G | K | K | K | W | W |
| Karten | G | G | K | K | K | G | K |
| Badges und Tags | G | G | K | K | K | K | K |
| Notifications und Banner | K | G | K | K | K | G | G |
| Formulare, Inputs, Selects | K | G | K | K | K | K | K |
| Validierung und Fehlermeldungen | G | G | K | K | K | K | K |
| Tabellen und Pagination | G | G | K | K | K | K | K |
| Katalogleiste, Filter, Ansichtswechsel | G | G | G | K | K | K | K |
| Tabs und Accordion | K | G | K | K | K | K | K |
| Step Indicator und Wizard | G | G | K | K | K | K | K |
| Modal, Menü, Toast | K | G | K | K | K | K | K |
| Download Item | K | G | K | W | K | K | W |
| Hero, Detailkopf, Bildmosaik | G | G | G | K | K | G | K |
| Box, Detailabschnitt, Key-Value | K | G | K | K | K | K | K |
| Suchvorschläge und Adress-Combobox | G | G | G | K | K | K | G |
| Raumbaum und Kategoriebaum | NB | G | K | K | K | G | G |
| MapLibre-Karten | NB | G | NB | K | K | G | G |
| Charts und Dashboard-Chrome | NB | G | K | K | K | K | K |
| Dokument-, Galerie- und BPMN-Viewer | NB | G | K | K | K | G | G |
| Grundriss-Viewer | NB | G | K | K | K | K | K |
| Shop-Karten, Warenkorb, Checkout | G | G | G | K | K | G | G |
| Swagger UI | NB | W | NB | W | G | G | W |
| Loading, Empty, Not Found | K | G | K | K | K | K | K |

## 3. Komponenteninventar

Die Häufigkeit bezeichnet statische Aufrufstellen im JavaScript. Dynamisch
erzeugte Wiederholungen, etwa 54 Produktkarten, werden als eine Aufrufstelle
gezählt.

### Komponenten mit CD-Pendant

| Baustein | Portal-Fundstelle | CD-Pendant | Häufigkeit |
| --- | --- | --- | ---: |
| Bundes-Chrome | `js/shell.js`, `index.html` | TopBar, TopHeader, Logo, MetaNavigation, MainNavigation, MobileMenu, Footer | 1 Shell |
| Brotkrumen | `js/router.js:168`, `js/shell.js` | Breadcrumb | jede Route |
| Buttons | `css/app.css:1292`, Templates in `js/` | Btn | 25 `btn--icon-right`, weitere Varianten verteilt |
| Icons | `js/components.js:41` | SvgIcon | 104 `C.icon`-Aufrufe |
| Karten | `js/components.js:187`, direkte Shop-/Dashboard-Karten | Card | 17 `C.card`-Aufrufe plus Fachkarten |
| Badges | `js/components.js:86` | Badge | 60 `C.badge`-Aufrufe |
| Tags / aktive Filter | `js/components.js:375`, `:1921` | TagItem, BadgeFilter | 13 aktive Filter, 15 Panel-Resets |
| Notification | `js/components.js:907` | Notification | 28 Aufrufe |
| Notification Banner | `js/components.js:146` | NotificationBanner | 1 globaler Banner |
| Inputs / Selects / Fields | `js/components.js:991`, `:1085` | Input, Select, Form | 19 Fields, 14 Selects |
| Fehlerübersicht | `js/components.js:1047`, `:1935` | Formularmeldung / Badge | 5 Übersichten, 6 Feldverdrahtungen |
| Tabellen | `js/components.js:263`, `:1553` | Table | 28 direkte Tabellen, 18 Data Tables |
| Pagination | `js/components.js:1235` | Pagination | 8 Aufrufstellen |
| Tabs | `js/components.js:812`, `:832`, `:846` | Tab | 12 Tab Bars, 10 Panelgruppen |
| Accordion | `js/components.js:747`, `:767` | Accordion | 2 Aufrufstellen |
| Step Indicator | `js/components.js:957`, `:1963` | StepIndicator, Steps | 1 direkter Indikator, 3 Wizard-Köpfe |
| Download Item | `js/components.js:1137` | DownloadItem | 7 direkte Aufrufstellen, datengetriebene Listen |
| Modal | `js/components.js:634`, `C.openModal` | Modal | 2 allgemeine Modal-Aufrufe plus Teilen |
| Menü / Popover | `js/components.js:1700`, `:1737` | Menu, Popover | 3 Menüs, 2 Verdrahtungen |
| Toast | `js/components.js:1779` | ToastMessage | 9 Aufrufstellen |
| Page Header / Hero | `js/components.js:180`, `:691`, `:696` | Hero, Detail Page Header | 24 Page Header, 2 Hero Figures |
| Box / Kontakt | `js/components.js:1160`, `:1195`, `:1209` | Box, InfoBlock | 5 Kontaktboxen, 5 Action Cards |
| Loading | `js/components.js:98` | Progress / Spinner | 6 Aufrufstellen |
| Empty / Not Found | `js/components.js:310`, `:338`, `:358` | Empty-State-Prinzip, kein einzelnes Vue-Pendant | 10 Empty, 19 Not Found |

### Bausteine ohne direktes CD-Pendant

| Baustein | Fundstelle | Verwendung | Prüfbasis |
| --- | --- | --- | --- |
| Katalogleiste | `js/components.js:1480` | 15 Kataloge | CD Search, Select, BadgeFilter, Pagination |
| Raum-/Kategoriebaum | `js/spatial-tree.js`, `.pf-tree` | Portfolio, Mietende, Metadaten, Shop | Menu-Semantik, Fokus, Touch, Responsive |
| MapLibre-Karte | `js/buildings-map.js`, `js/map-slot.js` | Portfolio, Mietende, Medien, Dashboards, Gebäudeerfassung | Bedienelemente, Kontrast, Resize, Fokus |
| Charts | `js/charts.js` | Datenportal und Immobilienportfolio | Tabellenalternative, Beschriftung, Reduced Motion |
| Dashboard-Chrome | `js/dashboard-chrome.js` | 2 Dashboard-Familien | CD Box, Menu, Tabs, Filter |
| Bildmosaik / Lightbox | `js/hero-mosaic.js`, `js/gallery.js` | Portfolio, Mietende, Projekte | Modal, negative Buttons, Fokusfalle |
| Dokumentbetrachter | `js/doc-viewer.js` | Dokumentenarchiv | Modal, Toolbar, Fokusfalle |
| BPMN-Viewer | `js/apps/process-docs.js:411` | Prozessdiagramm | Viewer-Prinzip, alternative Schritttabelle |
| Grundriss-Viewer | `js/floorplan.js` | Mietendenportal | SVG-Semantik, Legende, Datentabelle |
| Swagger UI | `js/apps/api-docs.js:42` | API-Dokumentation | WCAG und Portal-Chrome, Drittanbieter-CSS |
| Suchvorschläge | `js/search-suggest.js` | globale Suche | Combobox-/Listbox-Semantik |
| Adresssuche | `js/apps/building-create.js` | Gebäudeerfassung | Combobox-/Listbox-Semantik |
| Shop-Warenkorb | `js/apps/shop.js` | Produktdetail, Warenkorb, Checkout | CD Shopping-Muster, Formular- und Prozessbausteine |

## 4. Systemische Ausgangsbefunde

| ID | Befund | Ist | Soll | Bewertung |
| --- | --- | --- | --- | --- |
| S1 | Token-Nutzung | Der statische Scan findet 1002 `rem`-Vorkommen in `css/app.css`; 861 entsprechen Werten der vorhandenen Spacing-Skala. Die Zahl enthält auch Kommentare und feste Medienmasse und ist deshalb keine Anzahl automatisch behebbarer Verstösse. Direkte Werte dominieren dennoch die Komponentenregeln. | Wenn ein Portal-Token dieselbe Bedeutung trägt, ist gemäss Auftrag das Token zu verwenden. Ausnahmen für Breakpoints, Seitenverhältnisse, Druck und fachliche SVG-Koordinaten müssen explizit dokumentiert sein. | wesentliche Abweichung |
| S2 | Touch-Ziele | Kleine CD-Buttons sind 34 px bis 1279 px und 40 px ab 1280 px. Der Audit zählt 363 Portal-Ziele unter 44 px ausserhalb Swagger; 164 davon sind der wiederkehrende Bannerknopf, 87 Back-Buttons und 27 Hinzufügen-Aktionen. | Review-Vorgabe: 44 × 44 px für Touch-Ziele. | wesentliche Abweichung |
| S3 | Überschriften | 20 Überschriftensprünge pro Viewport in sieben Seitenzuständen, davon 19 durch Download Items (`h2` → `h4`) und einer im Swagger UI (`h1` → `h3`). | Keine Sprünge; DownloadItem-Titel = Elternstufe + 1, gemäss CD-Dokumentation. | wesentliche Abweichung |
| S4 | Drittanbieter-Oberflächen | Swagger UI liefert eigenes CSS, Klassen, Überschriften und Bedienelemente. Im Audit liegen dort 113 kleine Ziele bei 320 px und je 160 bei 768/1440 px. | Drittanbieter-UI bleibt funktional, wird aber in einem Portal-Adapter auf Mindestsemantik, Fokus und Zielgrössen begrenzt. | wesentliche Abweichung |
| S5 | Abweichungsdokumentation | Gute Begründungen stehen direkt im CSS. Ein Kommentar zu `btn--icon-right` behauptet jedoch weiterhin, `row-reverse` werde nicht verwendet, obwohl die Regel unmittelbar davor aktiv ist. | Kommentare und Review-Entscheide müssen dem aktuellen Code entsprechen. | geringe Abweichung |
| S6 | Responsive Grundqualität | Die historische Ausgangsbaseline zeigte 171 gerenderte Zustände ohne horizontalen Seitenüberlauf; Tabellen besitzen fokussierbare Scrollregionen, Karten und Viewer feste responsive Rahmen. | Beibehalten und nach jeder Welle erneut prüfen. | konform |
| S7 | Gemeinsame Zustände | Loading, Error, Empty, Not Found, Disabled, Login-Gate, Formularfehler und Erfolgsabschluss sind in den gemeinsamen Fabriken vorhanden und in Tests abgedeckt. | Beibehalten. | konform |

## 5. Befunde je Komponente

### 5.1 Actionable (Ausgangsbefund)

| ID | Komponente | Fundstelle | Ist | Soll / CD-Referenz | Auswirkung | Schweregrad | Empfohlene Massnahme |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F01 | Tokens | `css/app.css`, repräsentativ `:1302`, `:1432`, `:1599`, `:2792` | Abstände und Masse stehen häufig als Literal, obwohl `css/tokens.css` passende `--sp-*`, `--target-min`, Radius- und Farbtokens enthält. `#fff` steht zudem direkt in `:684` und `:2599`. | `docs/design-system-reference.md`, Token- und Spacing-Kapitel; Auftrag Phase 3.2 | Skin-, Skalierungs- und Wartungsdrift; grosser mechanischer Änderungsumfang. | mittel | Property-basiert inventarisieren; eindeutige Gleichwerte ersetzen; Breakpoints, fachliche Paletten und feste Viewer-Geometrie als begründete Ausnahmen führen. |
| F02 | Kleine Buttons | `css/app.css:1332`, `:1346`; `js/components.js:156`; Back-Links und Shop-Aktionen | 34/40/44 px entsprechen exakt CD `btn.postcss:119–123`, unterschreiten aber bis 1919 px die Review-Vorgabe 44 px. | Review-Vorgabe 44 × 44; WCAG 2.5.8 fordert mindestens 24 px, der Auftrag ist strenger. | Kleine Touch-Ziele auf Telefon und Tablet, besonders beim globalen Banner. | hoch | `.btn--sm` auf groben Zeigegeräten und bis zum Tablet mindestens 44 px hoch ausführen; Desktop-CD-Masse nur bei `pointer:fine` beibehalten. |
| F03 | Karten-/Viewer-Werkzeuge | `css/app.css:2477`, `:2480`, `:2604`, `:2607`; MapLibre-Standardcontrols ausserhalb `.dash-map/.pf-map` | Teilweise 29 oder 40 px; BPMN und einige Karten verkleinern bei feinem Zeiger explizit auf 40 px. | Einheitliches Werkzeugleistenmuster mit 44 px auf Touch; visuell 40 px auf Mausgeräten nur mit vergrösserter Hit Area. | Inkonsistente Zielgrössen zwischen Karten, BPMN und Viewern. | mittel | Gemeinsame `.viewer-toolbar`-/Map-Control-Regel mit 44-px-Hitbox und optional 40-px-Symbolfläche. |
| F04 | Download Item | `js/components.js:1137`, `js/pages/knowledge.js:90`, `js/pages/digitalisation.js:103` | Standardtitel ist `h4`; Aufrufstellen unter `h2` übergeben keine Stufe. | CD `DownloadItem.mdx:48–56`: Titelstufe = Elternstufe + 1. | Überschriftensprünge in Wissen und Digitalisierungsstrategie; erschwerte Navigation mit Screenreader. | hoch | Default auf `h3` setzen und abweichende Kontexte explizit parametrisieren; Überschriften-Audit als Test behalten. |
| F05 | Swagger UI | `js/apps/api-docs.js:42–55`, `:201`; `docs/review-assets/audit.json` | Ressourcen starten unter Portal-H1 mit H3; zahlreiche Swagger-Buttons liegen unter 44 px. | Lückenlose Hierarchie, 44-px-Touchziele, sichtbarer Fokus; kein CD-Pendant. | Grösster verbleibender Accessibility-Block, obwohl Portal-Chrome korrekt bleibt. | hoch | Adapter-CSS unter `.swagger-host`, vorgeschaltete SR-H2 oder angepasste Swagger-Tag-Templates; Zielgrössen und Fokuszustände testen. |
| F06 | Hero-Bild | `css/app.css:1282–1284`, `js/components.js:691` | Generische Hero-Bilder werden auf 16:9 beschnitten. | CD `hero.postcss:41–49` lässt das Bildformat offen. | Bildausschnitte weichen vom CD ab; Inhalt kann abgeschnitten werden. | niedrig | Generischen Crop entfernen; 16:9 nur an Aufrufstellen setzen, die dieses Format fachlich benötigen. |
| F07 | Button-Dokumentation | `css/app.css:1336`, `:1357–1360` | Regel nutzt `row-reverse`; der Kommentar behauptet das Gegenteil und beschreibt die alte DOM-Reihenfolge. | CD `btn.postcss:171–191`; Code und Kommentar müssen übereinstimmen. | Hohes Risiko einer späteren Rückregression der gerade vereinheitlichten Pfeilposition. | niedrig | Veralteten Kommentar ersetzen und einen Strukturtest für Icon rechts behalten. |
| F08 | Mobile Shop-Navigation | `js/apps/shop.js:192`, `css/app.css:2792–2807`; Screenshot `before/320/app_shop.png` | Der vollständige Kategorienbaum steht vor den Produkten; Produktkarten behalten bewusst Bilder und Kartenrahmen. | Kein direktes CD-Shop-Pendant; mobile Kataloge priorisieren Ergebnis und legen Facetten in eine Disclosure-/Filterfläche. | Langer Weg zum ersten Produkt und geringere Scan-Dichte bei 320 px. Keine Überlappung oder Funktionsstörung. | mittel | Kategorien unter 1024 px als beschriftete Disclosure in die bestehende Filterfläche integrieren; Zustand und Tastaturbedienung beibehalten. |
| F09 | Banner über Inhalt | `css/app.css:401`, `js/components.js:146`; Full-Page-Baselines | Der fixe Prototyp-Banner liegt bis zur Bestätigung über dem unteren Viewportbereich; in Viewern kann er Werkzeugleisten oder Diagrammteile temporär verdecken. | CD Notification Banner ist fixierbar, interaktive Hauptinhalte sollen aber erreichbar und sichtbar bleiben. | Temporäre Verdeckung; besonders auffällig in BPMN, Karten und auf kleinen Viewports. | mittel | Solange der Banner sichtbar ist, dynamischen unteren Seiten-/Overlay-Abstand reservieren oder Banner in Viewer-Zuständen kompakt platzieren. |

Alle neun Befunde sind umgesetzt:

| Befund | Umsetzungsnachweis | Status |
| --- | --- | --- |
| F01 | Rollen-/Farbtokens ergänzt, eindeutige gemeinsame Masse tokenisiert, feste Fachgeometrie als Ausnahme belassen | erledigt |
| F02 | `.btn--sm` auf Telefon, Tablet und groben Zeigern mindestens 44 px; kompakte CD-Masse nur bei feinem Desktop-Zeiger | erledigt |
| F03 | Gemeinsame `.viewer-toolbar`-Anatomie und responsive MapLibre-/Viewer-Ziele | erledigt |
| F04 | `downloadItem` standardmässig `h3`, validierbarer Heading-Parameter und Hierarchie-Test | erledigt |
| F05 | Swagger-H2, benannte Controls, Sprachmarkierung, Zielgrössen sowie Fokus-/Disabled-Adapter | erledigt |
| F06 | Hero-Bilder standardmässig im natürlichen Format; 16:9 nur noch explizit am Konsumenten | erledigt |
| F07 | Kommentar und Strukturtest entsprechen der rechts stehenden Folgeaktion | erledigt |
| F08 | Kategorien unter 1024 px in der bestehenden Shop-Filter-Disclosure, Desktop-Seitenleiste bleibt erhalten | erledigt |
| F09 | Bannerhöhe wird mit `ResizeObserver` reserviert; Back-to-top folgt dem dynamischen Offset und verdeckter Tastaturfokus wird automatisch darüber gescrollt | erledigt |

### 5.2 Verifiziert konform

| Komponente | Nachweis |
| --- | --- |
| Version | Portal und lokales CD referenzieren 1.0.5. |
| Buttons, normale Grösse | 44/48/52 px, Typorampe, Varianten, Disabled und Icon-Reihenfolge entsprechen `btn.postcss`. |
| Karten-Hover | Schatten, Titel-Farbwechsel und Randoverlay entsprechen dem CD; kein Bildzoom. |
| Tabellen | Caption, `th`/`scope`, Scrollregion, Ausrichtung und Mobile-Verhalten sind programmatisch vorhanden. |
| Tabs | Roving `tabindex`, Pfeiltasten, Home/End, genau ein sichtbares Panel und Hash-Synchronisation sind getestet. |
| Formulare | Labels, Pflichtmarkierung, `aria-invalid`, verknüpfte Meldungen, Fehlerübersicht und Fokusführung sind getestet. |
| Responsive | Kein horizontaler Seitenüberlauf in der aktuellen Matrix mit 210 Renderzuständen bei 320/768/1440 px; die historische Screenshot-Baseline umfasst 171 Bilder. |
| Bilder | Kein gerendertes Bild ohne `alt` in der Audit-Matrix. |
| IDs und Namen | Keine doppelten IDs und keine unbenannten gerenderten Controls in der Audit-Matrix. |
| Reduced Motion | Bewegungsdauern laufen über Tokens und werden in `prefers-reduced-motion` auf eine minimale Dauer gesetzt. |
| Prozessdiagramm | Eigenes Vollbreiten-Register, vertikale Overlay-Werkzeuge, Reset und gleichwertige Schritttabelle. |
| Warenkorb | Global im Top-Header, auf allen Routen erreichbar; Zähler reagiert auf Änderungen. |
| Anwendungsgrenzen | Workspace Management und Raumbuchung sind getrennte Anwendungen mit eigenen Routen, Titeln und Aufgabenoberflächen. |

## 6. Zielkonflikte und bewusst nicht umgesetzte Punkte

| Thema | CD | Portal / Anforderung | Entscheid | Optionen |
| --- | --- | --- | --- | --- |
| Kleine Buttons | 34/40/44 px | Auftrag verlangt 44 × 44 px Touchziele | In Phase 5 nur auf Touch auf 44 px erhöhen; feine Zeiger dürfen CD-Masse behalten. | A: überall 44 px; B: `pointer:coarse` 44 px; C: strikt CD, Auftrag nicht erfüllt. |
| Step Indicator | CD nutzt teilweise kontrastarme Grau-/Grünwerte. | Portal nutzt dunklere CD-Tokens mit AA-Kontrast. | Beibehalten; Accessibility hat Vorrang vor Pixelgleichheit. | Nur bei korrigierter CD-Version neu bewerten. |
| Tabellen-Zeilenkopf | CD rendert `tbody th` fett und dunkel. | Portal hält den semantischen Zeilenkopf, aber visuell regulär, damit lange Listen nicht wie Ranglisten wirken. | Beibehalten und dokumentieren. | Pro Datentabelle opt-in für fette Zeilenköpfe. |
| L1-Navigation | CD nutzt einen «Mehr»-Überlauf. | Portal lässt die fünf Einträge umbrechen. | Nicht ohne separate Navigationsentscheidung ändern. | A: CD-Überlauf; B: Umbruch beibehalten. |
| Mobile-Menü | CD nutzt verschiebbare Ebenen. | Portal nutzt ein Inline-Accordion und erhält den Kontext. | Nicht in dieser Runde ändern. | A: CD-Slider; B: Accordion beibehalten. |
| Formularmeldungen | CD startet bei 10 px. | Portal vergrössert längere Validierungstexte. | Beibehalten; Lesbarkeit hat Vorrang. | Nur dekorative Badges bleiben in CD-Grösse. |
| Karten auf Mobil | CD `card--list` entfernt Bildwirkung. | Shop-Produkte benötigen Bilder zur Identifikation. | Bilder beibehalten; Kategoriennavigation verdichten. | Produktliste als zusätzliche Ansicht ist bereits vorhanden. |
| Drittanbieter-UI | Kein CD-Pendant. | Swagger und BPMN müssen fachlich vollständig bleiben. | Adapter-CSS und Semantik, keine Funktionsreduktion. | Bibliothek ersetzen ist ausserhalb des Refactoring-Auftrags. |

## 7. Umgesetzter Massnahmenplan

Die Reihenfolge folgt der freigegebenen Vorgabe für Phase 5. Alle als erledigt
markierten Massnahmen wurden umgesetzt und abgenommen.

| Welle | Massnahme | Wirkung | Aufwand | Status | Abnahme |
| --- | --- | --- | --- | --- | --- |
| 1 Tokens | Direkte Farben mit vorhandenem Rollen-Token ersetzen; `#fff` in Warenkorb/BPMN bereinigen. | mittel | klein | erledigt | CSS-Scan und historische 171 Screenshots |
| 1 Tokens | `rem`-Literale property-basiert klassifizieren und eindeutige Spacing-/Radius-/Control-Werte auf Tokens umstellen; Ausnahmen dokumentieren. | hoch | gross | erledigt | Keine Pixelabweichung in unveränderten Komponenten |
| 2 Namen | Veralteten `btn--icon-right`-Kommentar korrigieren; portal-eigene Viewer-Toolbar-Klassen auf ein gemeinsames BEM-Muster bringen. | mittel | klein | erledigt | Strukturtests, CSS-Suche |
| 2 Namen | Suchvorschlag und Adress-Combobox auf einen gemeinsamen ARIA-Controller zurückführen, visuelle Modifier behalten. | mittel | mittel | erledigt | Suche- und Gebäudeerfassungs-Tests |
| 3 HTML | DownloadItem-Überschriften kontextgerecht ausgeben; H2/H3/H4-Audit ergänzen. | hoch | klein | erledigt | `review-audit`, Content-Tests |
| 3 HTML | Swagger-Ressourcen unter eine programmatische H2-Struktur setzen, ohne Operationen zu entfernen. | hoch | mittel | erledigt | API-Docs-Test, Accessibility-Probe |
| 3 HTML | Generischen Hero-Crop entfernen und benötigte Bildverhältnisse an den Konsumenten deklarieren. | niedrig | mittel | erledigt | gezielter Screenshotvergleich |
| 4 Zustände | Swagger- und Viewer-Disabled-/Focus-Zustände angleichen; bestehende Loading/Error/Empty-Zustände unverändert lassen. | mittel | mittel | erledigt | Tastaturprüfung und Funktionssuiten |
| 5 Responsive | Touchziele für `.btn--sm`, MapLibre und Viewer auf groben Zeigern auf mindestens 44 px bringen. | hoch | mittel | erledigt | 320/768 Audit, Touch-Target-Test |
| 5 Responsive | Shop-Kategorien mobil in eine Disclosure-/Filterfläche verschieben; alle Filter und Deep-Links erhalten. | mittel | mittel | erledigt | Shop-Test plus 320/768 Screenshots |
| 5 Responsive | Sichtbaren Banner bei Hauptinhalt, Karten und Viewern in die verfügbare Höhe einrechnen. | mittel | mittel | erledigt | Screenshotvergleich mit offenem Banner |
| 6 Accessibility | Swagger-Zielgrössen, Fokus, Überschriften und Namen im Adapter korrigieren, soweit die Bibliothek dies ohne Funktionsverlust erlaubt. | hoch | gross | erledigt | Audit ohne Portal-verursachte Swagger-Warnungen |
| 6 Accessibility | Reproduzierbare Tastatur-, Fokus-, 200-%-Reflow- und AX-Tree-Prüfung der aktuellen 70 Zustände; reale Sprachausgabe als Release-Check dokumentieren. | hoch | gross | erledigt | `docs/accessibility-review.md` und Dual-Skin-Läufe |
| Entscheidung | L1-Überlauf, mobiles Menü, Tabellen-Zeilenkopf und Step-Farben nicht ändern. | vermeidet Regression | – | bewusst nicht umgesetzt | als bewusste Abweichung dokumentiert |

### Abnahme nach jeder Welle

1. Alle 20 Funktionssuiten laufen.
2. `scripts/review-audit.mjs` läuft für 70 Zustände in drei Viewports, also
   210 Renderzustände, separat für Federal und Intranet.
3. Die eingecheckten historischen Vorher-/Nachher-Artefakte umfassen weiterhin
   57 Zustände in drei Viewports, also 171 Bilder. Eine Erweiterung der
   Screenshot-Baseline auf die aktuelle Matrix wird nicht vorgetäuscht.
4. Beabsichtigte Änderungen werden gegen `docs/review-assets/before/` geprüft;
   andere visuelle Abweichungen gelten als Regression.
5. Die Welle erhält einen eigenen Commit mit nachvollziehbarer Message.

## 8. Prüfartefakte

| Artefakt | Inhalt |
| --- | --- |
| `docs/design-system-reference.md` | Tokens, Layout, Komponentenstrukturen, Zustände und Bundes-Chrome der Version 1.0.5 |
| `docs/feature-inventory.md` | Routen, Funktionen, Interaktionen und Zustände des Portals |
| `docs/review-assets/before/` | Historische Baseline: 57 Zustände × 3 Viewports = 171 Full-Page-Screenshots |
| `docs/review-assets/after/` | Historischer Nachher-Stand: 57 Zustände × 3 Viewports = 171 Full-Page-Screenshots |
| `docs/review-assets/audit.json` | Historischer strukturierter Render-Audit über dieselben 171 Renderzustände |
| `docs/review-assets/accessibility.json` | Eingecheckter Zwischenstand über 58 Zustände; die aktuelle Dual-Skin-Abnahme umfasst 70 |
| `docs/accessibility-review.md` | Methode, Ergebnis und Grenze des Accessibility-Kurztests |
| `scripts/review-routes.mjs` | Aktuelle zentrale Liste der 70 Prüfzustände |
| `scripts/review-audit.mjs` | Overflow-, Semantik-, Label-, Tabellen- und Touch-Target-Prüfung |
| `scripts/review-accessibility.mjs` | 200-%-Reflow-, Fokus-, ARIA- und Accessibility-Tree-Prüfung |
| `scripts/review-screenshots.mjs` | Vorher-/Nachher-Aufnahme in 320/768/1440 px |

Die eingecheckte visuelle Baseline umfasst die historischen 57 Zustände und 171
Bilder des Reviews. Danach wurde zuerst die Accessibility-Matrix um die
eigenständige Raumbuchung auf 58 Zustände und inzwischen die ausführbare
zentrale Matrix auf 70 Zustände erweitert. Die finalen 210/70-Dual-Skin-Werte
stehen im CSS-Nachtrag; sie werden nicht mit dem älteren Bildbestand vermischt.

Die freigegebenen Phasen 5 und 6 sind umgesetzt. Die eingecheckte
Nachher-Baseline bleibt der historische Bildstand; den aktuellen
CSS-Abnahmestand bilden die separaten 210/70-Dual-Skin-Läufe im Nachtrag.

## 9. Vertiefungsreview Plan-Editor

Stand: 7. August 2026. Geprüft wurde ausschliesslich der eigenständige
Plan-Editor in `js/floorplan-editor`: Gebäude- und Geschossnavigation,
2D-Grundriss, 3D-Ansicht, Begehung, Bearbeitungsmodus, Bibliothek und
Inspektor. Referenz waren die lokalen CD-Quellen der Version 1.0.5 sowie
gerenderte Zustände bei 320, 768 und 1440 px.

Der Plan-Editor bleibt bewusst eine kompakte Fachanwendung. Public-Site-
Container oder der vollständige TopHeader wären hier nicht aufgabengerecht.
CD-Konformität wird stattdessen über Schrift, Farbrampen, Abstände,
Button-Anatomie, Fokus, Formulare und Interaktionszustände hergestellt.

### Befunde und Umsetzung

| Thema | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| Visuelle Hinweise | Dauerhafte 3D-/Begehungsanweisungen, Auswahlhinweise und Prototyp-Erklärungen konkurrierten mit dem Plan. | Selbsterklärende Hinweise entfernt; unsichtbare Tastaturhilfe, Fehlermeldungen und Live-Ansagen bleiben erhalten. | erledigt |
| Unverfügbare Funktionen | Upload, zehn Strukturwerkzeuge und zwei Navigationsbereiche waren dauerhaft deaktiviert sichtbar. | Nicht verfügbare Funktionen ausgeblendet; sie werden erst mit funktionaler Umsetzung wieder angeboten. | erledigt |
| Inspektor | Dekorative `Building`-/`List`-Icons waren optisch unruhig und teils falsch ausgerichtet. | Einheitliche textuelle Titelanatomie aus Kontextzeile und Objektname; Icons nur noch für echte Aktionen. | erledigt |
| Ansichtswechsel | 2D/3D waren Text, Begehung war als einziges Segment Icon plus Text und mobil nur ein Auge. | Alle drei Modi als konsistente, immer lesbare Textsegmente. | erledigt |
| Aktionshierarchie | Drucken und Versionsverlauf belegten Werkzeugleisten; mobile Speichern-/Publizieren-/Beenden-Aktionen lagen ausserhalb des sichtbaren Bereichs. | Planweite Aktionen nach «Mehr» verschoben; mobile Bearbeitungsaktionen dort explizit verfügbar; Canvas-Werkzeugleisten auf Werkzeuge begrenzt. | erledigt |
| Kontrast | Bedeutungsvolle Grenzen nutzten `--color-border` mit rund 1.24:1. Warnungs- und Erfolgsumrisse nutzten zu helle Statusstufen. | Bediengruppen und auswählbare Karten verwenden `secondary-300` (gemessen 3.34:1); Statusumrisse verwenden die dunklen Texttokens. Dekorative Trenner bleiben bewusst zurückhaltend. | erledigt |
| Touch | Eigene Baum-, Register- und Menücontrols unterschritten teilweise 44 × 44 px. | Unter 1024 px und bei grobem Zeiger mindestens 44 px; Chevron-Grafik bleibt optisch kleiner als ihre Trefferfläche. | erledigt |
| Kompakte Panels | Seitenpanels überdeckten den Plan, ohne den Fokus in den Drawer zu führen. | Fokus auf die Drawer-Schliessen-Aktion, verdeckter Canvas `inert`, Escape/Backdrop schliessen und Fokus kehrt zum Auslöser zurück. | erledigt |
| Bibliothek | Zwei Produktkarten pro schmalem Mobil-Drawer erzeugten sehr kleine Texte und Bilder. | Mobile einspaltige, horizontale Produktkarten; Textgrössen auf die CD-Rampe angehoben. | erledigt |
| Mobile Navigation | Die 46-rem-Tabelle verlangte auf 320 px horizontales Scrollen. | Semantische Tabelle als kompakte, beschriftete Zeilen mit Identität, Kennzahl und Status dargestellt; kein horizontaler Scrollbereich. | erledigt |
| Sichere Bildschirmränder | Bottom- und Side-Controls lagen fest an Standardabständen. | Safe-Area-Abstände für mobile Header, Footer und schwebende Viewer-Controls ergänzt. | erledigt |
| Kurzes Querformat | Im 568 × 320-px-Bearbeitungsmodus ragten das Aktionsmenü und die vertikale Kameraleiste aus dem nutzbaren Bereich; der Fokus des aktiven Ansichtsmodus war zu kontrastarm. | Menü höhenbegrenzt, scrollbar und am Viewport geklemmt; Kameraaktionen horizontal; aktiver Fokus mit 5.17:1 Kontrast. | erledigt |

### Abnahme

- Vollständige Browser-Suite `scripts/test-floorplan-editor.mjs`: bestanden.
- Automatisierter Kontrastnachweis für Toolbar- und Ansichtsgrenzen: 3.34:1.
- 320-px-Prüfung: keine Dokumentüberläufe, kritische Aktionen im sichtbaren
  «Mehr»-Menü, textuelle Ansichtsmodi und mindestens 44-px-Ziele.
- 568 × 320-px-Prüfung: alle Planaktionen erreichbar, Kameraaktionen vollständig
  im Workbench und aktiver Fokus mit 5.17:1 Kontrast.
- Visuelle Nachprüfung der Editorzustände in 320, 768 und 1440 px.

Raumfarben und Three.js-Materialien bleiben bewusst fachliche Datenfarben.
Sie werden nicht auf Marken- oder Statusfarben reduziert; CD-Tokens gelten für
das umgebende Chrome, Auswahl, Fokus und Zustände.

## 10. Vertiefungsreview Plan-Editor Startseite

Stand: 10. August 2026. Geprüft wurde ausschliesslich die Startseite des
eigenständigen Plan-Editors (`js/floorplan-editor/navigation.js`,
`browse-view.js`, `work-view.js`) gegen die lokalen CD-Quellen 1.0.5 und gegen
die bereits etablierten Portalmuster. Referenzzustände wurden bei 320, 768 und
1440 px gerendert.

### Ausgangslage

Die Startseite war neu und hatte deshalb Muster erfunden, die das Portal bereits
besitzt. Das ist der teuerste Fehler in einem Designsystem: nicht die Abweichung
vom CD, sondern die Abweichung von der eigenen, bereits geprüften Lösung. Vier
der fünf Befunde sind Doppelspurigkeiten, nicht Geschmacksfragen.

### Befunde und Umsetzung

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 10.1 | Die Standardansicht war «Meine Arbeit». Wer den Editor öffnet, kennt aber in der Regel ein Gebäude und keine Aufgabe; die Frage «ist das das richtige Objekt» geht jeder Aufgabe voraus und lässt sich nur auf der Karte beantworten. | «Portfolio» ist die Standardroute und steht im Umschalter links; `?view=work` führt in die Arbeitsliste. Die Marke und der Breadcrumb-Stamm der Arbeitsfläche führen ebenfalls dorthin. | erledigt |
| 10.2 | Eigene Suchleiste, eigener Trefferzähler und eigener Darstellungsumschalter (`.fpe-browse__search`, `.fpe-browse__count`, `.fpe-browse__modes`) – drei Nachbauten von `catbar`. | Ersetzt durch `C.catalogueBar` mit Suche, Zähler, Sortierung, Filterpanel und `view-switch`, verdrahtet über `C.wireCatalogueState` – dieselbe Anatomie wie im Liegenschaften-Inventar. Darunter `C.activeFilters` als Pillenzeile für Suche, Auswahl und Planstandfilter. | erledigt |
| 10.3 | Das rechte Panel war ein zweites Objektdetail: bei leerer Auswahl leer, bei Auswahl sprunghaft, und es wiederholte, was die Liste bereits zeigte. Gleichzeitig lag eine Zählung als Overlay auf der Karte (`.fpe-browse__summary`). | Arbeitsteilung statt Wiederholung: Objektdetails, Geschossliste und beide Handoffs liegen im Marker-Popup (`.maplibregl-popup-content`), verankert dort, wo geklickt wurde. Das rechte Panel ist ein kompaktes Kennzahlen-Dashboard für die aktuelle Filtermenge (Objekte, Geschosse, Räume, Arbeitsplätze, Planstandverteilung, HNF) und bleibt dadurch immer gefüllt und ruhig. Das Karten-Overlay entfällt ersatzlos. | erledigt |
| 10.4 | Der Standortbaum endete beim Gebäude. Gesucht wird aber ein Geschoss; der letzte Schritt fand nur in der Liste oder im Panel statt. | `treeHTML` erhält eine optionale Ebene unterhalb des Blatts (`leaf.children`). Ein Gebäude mit Geschossen wird zum Disclosure, das weiterhin sich selbst auswählt; ein Geschoss ist ein direkter Handoff in die Arbeitsfläche. Die drei übrigen Explorer übergeben `children` nicht und bleiben unverändert. | erledigt |
| 10.5 | Die Arbeitsliste war eine Kartenliste: vier Zeilen und ein Knopfpaar je Eintrag, ohne Suche, Sortierung oder Filter. Bei zehn Einträgen ist das eine Bildschirmhöhe für zehn Zeilen Information. | Ersetzt durch `C.mountDataTable` – dieselbe kompakte Tabelle mit `catbar`, Suche, Dringlichkeitsfilter, Sortierung, Zebra und Paginierung wie «Meine Vorgänge». Eine Aufgabe ist eine Zeile; die Zeile folgt ihrem ersten Link. | erledigt |

| 10.6 | Ein Objekt hatte keine eigene Seite. Wer ein Gebäude gewählt hatte, sah nur ein Kartenpopup; Eckdaten, Ausstattung und Ansprechpersonen blieben unerreichbar, und der Gebäude-Breadcrumb der Arbeitsfläche führte auf eine Karte statt auf das Objekt. | Neues Objektdetail `?building=<bbl_id>` in der Anatomie des Liegenschaften-Inventars — Breadcrumb, Titel, Kennzahlenband, CD-Register, geteilte Datentabelle, Aktions- und Kontaktkarte — mit den drei fachlichen Registern Übersicht, Grundrisse und Ausstattungen. Vorschaubilder erscheinen nur auf Karten, nie in Tabellenzeilen; der Geschoss-Schnellzugriff liegt im Übersichtsregister, damit dieselben Miniaturen nicht zweimal auf einem Bildschirm stehen. | erledigt |
| 10.7 | `C.actionCard` ist eine geteilte Komponente, ihre Regeln lagen aber in `css/apps/floorplan.css`. Portfolio und Shop laden dieses Blatt nicht und stellten die Karte deshalb ungestylt dar. | `.fp-svc*` nach `css/components/content.css` verschoben, also neben die Komponente und in die immer geladene Schicht. Behebt den Fehler für alle vier Aufrufer. | erledigt |

### Bewusst beibehaltene Abweichungen

- **Kopfzeile, Standortbaum und Karte** bleiben portaleigene Muster. Das CD ist
  ein Website-System und liefert weder App-Shell noch Explorer noch Karte; die
  Startseite fügt diesen drei bestehenden Abweichungen keine vierte hinzu.
- **Severity-Marken** in der Arbeitsliste bleiben eigene Vollflächen-Glyphen.
  Die CD-Iconstärke ist bei 16 px in einer dichten Tabellenzeile nicht lesbar,
  und die Dringlichkeit ist die eine Information, die eine Warteschlange
  unübersehbar machen muss. Formen unterscheiden sich, damit die Bedeutung ohne
  Farbe trägt.
- **Attributebenen als Tabs.** Das CD kennt keine Aktivitätsleiste; `tab` ist die
  Komponente, die es für genau diese Aufgabe liefert.

### Prüfartefakte

- `node scripts/test-floorplan-editor.mjs` — Portfolio als Standard, Objektdetail
  mit seinen drei Registern, geteilte `catbar`-Anatomie, Kennzahlenpanel statt Objektinspektor, Geschossebene im
  Baum, Popup mit Detail und Aktionen, kompakte Tabellenzeile, 320-px-Zustände.
- `node scripts/test-floorplan-editor-landing.mjs` — reines Aufgabenmodell.
- `node scripts/test-portfolio.mjs`, `node scripts/test-tenancies.mjs` — die
  unveränderten Explorer nach der Erweiterung von `spatial-tree.js`.

## 11. Neues Fachgebiet «Arbeitsplätze gestalten»

Stand: 10. August 2026. Geprüft und entworfen wurde ein neues Fachgebiet unter
«Wissen und Hilfsmittel», das den Ausstattungsstandard Multispace des BBL führt.
Quellen: `research/Workspace Management` (Handbuch Multispace in zwei Ausgaben,
Zielbild Workspacemanagement V1.0, Anforderungen PDF-Druck) sowie die bereits im
Repository kuratierte Zusammenfassung in
`docs/workspace-management-requirements.md`, Kapitel 5.

### Entwurfsentscheid

Die sechs bestehenden Fachgebiete sind Linksammlungen: Titel, Beschrieb, Format,
Grösse. Für dieses Thema trägt das nicht. Das Handbuch umfasst rund 150 Seiten,
und seine Module sind kein Nachschlagestoff, sondern das **Vokabular, das die
übrigen Workspace-Oberflächen bereits sprechen** — `data/workspace-planning.json`
führt die Ausstattung je Objekt unter denselben Modulnamen, und das Objektdetail
des Plan-Editors weist sie im Register «Ausstattungen» aus. Ohne diese Seite
haben die Zahlen in der Anwendung keine Definition. Das Fachgebiet führt den
Inhalt deshalb selbst und verlinkt das Handbuch zusätzlich.

Gebaut ist es vollständig aus vorhandenen Bausteinen: die Ankernavigations-Seite
mit klebendem Inhaltsverzeichnis, `C.table` für die Modultabelle, `C.downloadItem`
für die Unterlagen, `kv kv--ruled` für die Begriffe, `C.notification` für den
Ausgabenhinweis. Neu sind drei kleine CSS-Muster, die die Wissensschicht noch
nicht hatte: eine Modulnummer-Marke, eine Regelliste und eine nummerierte
Schrittliste.

Diese Beschreibung dokumentiert den Stand vom 10. August. Die spätere
Kataloggestaltung und die Reduktion der Handbuch-Landingpage sind in 15.7 und
15.20 festgehalten; die damalige Ankernavigation, Modultabelle und Schrittliste
sind dort nicht mehr Teil der aktuellen Oberfläche.

### Befunde und Umsetzung

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 11.1 | Zwei Ausgaben des Handbuchs sind im Umlauf und widersprechen sich: «Stand 6.1.2025» führt elf Module mit Coffee Point als Modul 7, «Stand 31.10.2025» führt zehn — Modul 1 heisst neu «Standardarbeitsplatz», der Coffee Point ist kein eigenes Modul mehr, die früheren Module 8–11 rücken auf 7–10 auf. Der Fixture-Bestand und die Anforderungsdokumentation des Repositorys tragen noch die frühere Nummerierung. | Der spätere Entscheid aus 15.1 ersetzt die damalige Annahme «neueste Ausgabe = aktive Liste»: Das Portal publiziert 6.1.2025, weil der Plan-Editor genau diese Nummern bereits speichert. 31.10.2025 bleibt als Delta dokumentiert. `scripts/test-knowledge-workspace.mjs` pinnt elf Module und Coffee Point. | erledigt, durch 15.1 präzisiert |
| 11.2 | Die Flächenrichtmasse sind aus dem PDF nicht naiv auslesbar: Die Datei setzt Zero-Width-Spaces innerhalb mehrstelliger Zahlen, und die zweispaltige Seitenanlage lässt Modulüberschriften über Spaltengrenzen bluten. Eine einfache Extraktion liefert «2 5 m²» oder ordnet Zahlen dem falschen Modul zu. | Zahlen nur übernommen, wo zwei unabhängige Extraktionsverfahren übereinstimmen und die Zuordnung von der Modulseite selbst stammt, nicht vom laufenden Kolumnentitel. Wo die aktive Ausgabe kein Richtmass nennt (Module 9–11), steht ein Gedankenstrich statt einer Schätzung. | erledigt |
| 11.3 | Vertrauliches Material in den Quellen: Das Handbuch hält fest «Die Preise sind vertraulich zu behandeln»; das Anforderungsdokument zur PDF-Druckausgabe ist ein internes Papier mit Geschäftsnummer, Lieferantennennung und Ist/Soll-Mängeltabellen. | Preise, Kostenkennwerte, Lieferantennennungen und Mängeltabellen bleiben aussen vor. Der anwendungsbezogene Flächennachweis-Abschnitt war zunächst ohne diese Angaben publiziert und wurde mit 15.20 vollständig von der Landingpage entfernt. | erledigt, durch 15.20 präzisiert |
| 11.4 | Die Rechtsgrundlagen des Handbuchs — VILB, Weisungen, Anhang I «Standards für Büroarbeitsplätze», Anhang II, Desksharing-Konzept — stehen bereits vollständig unter «Unterbringung und Objektbetrieb». | Nicht dupliziert, sondern über den `intro` des Fachgebiets verlinkt — dasselbe Muster, mit dem sich `it` und `procurement` bereits gegenseitig referenzieren. Der Test scheitert, wenn ein Titel in beiden Fachgebieten auftaucht. | erledigt |
| 11.5 | Portalinterne Ziele in Unterlagenlisten wurden als deaktivierte Platzhalter dargestellt. `knowledge.js` markierte jeden nicht externen Eintrag als `download`, und `safeResourceUrl` verwirft Hash-URLs bewusst. Gemessen auf `#/knowledge/it`: «Sicherheits-/Datenschutzvorfall melden» war seit jeher tot. | `download` markiert nur noch Dateien; Portalrouten sind Links. Platzhalter ohne echtes Ziel bleiben deaktiviert, was das gewünschte Prototypverhalten ist. Behebt einen Bestandsfehler und ist Voraussetzung dafür, dass das neue Fachgebiet auf Plan-Editor, Planprüfung und Dienstleistungen verweisen kann. | erledigt |
| 11.6 | Der Unterlagenzähler der Übersichtsseite rechnete ungeschützt `s.items.length` und wäre an einem Abschnitt ohne Dokumentliste gescheitert — genau die Form, die das neue Fachgebiet überwiegend verwendet. | Auf `(s.items || []).length` gehärtet. | erledigt |

### Prüfartefakte

- `node scripts/test-knowledge-workspace.mjs` — Ausgabe, Module, Richtmasse,
  Vertraulichkeit, Abschnittsvertrag, Querverweis, Suchindex.
- `node scripts/test-content.mjs`, `node scripts/test-routes.mjs`,
  `node scripts/test-search.mjs`, `node scripts/test-anchor-search-state.mjs`.

## 12. Objektdetail des Plan-Editors: Wege hinein und Register darin

Stand: 10. August 2026. Ausgangspunkt war die Beobachtung, das Objektdetail
existiere bereits, «nur die Interaktion stimmt nicht zu 100 %». Das trifft zu:
die Seite war da, aber keiner der drei Wege dorthin führte sauber hin, und ihr
Ausstattungsregister vermischte drei Dinge.

### Befunde und Umsetzung

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 12.1 | Die Hauptaktion des Kartenpopups hiess «Im Editor öffnen» und öffnete das Objektdetail: `floorplanEditor(id)` ohne Geschoss ist die Detailroute. Das Etikett versprach die Arbeitsfläche und lieferte eine Übersichtsseite — der grösste Einzelgrund dafür, dass die Fläche als defekt empfunden wurde. | Das Popup führt Stammdaten und genau einen Weg weiter, benannt nach seinem Ziel: «Objektdetails öffnen». Die Geschossliste und der zweite Knopf entfallen; Geschosse, Module, Ausstattung und Aktionen stehen im Detail. Ein Popup, das eine Scheibe davon wiederholt, war die Stelle, an der Arbeit begann und dann in einer Sackgasse endete. | erledigt |
| 12.2 | Karten und Tabellenzeilen waren bereits Links auf die Detailroute, aber ein zusätzlicher Klick-Handler selektierte im selben Tick das Objekt und schrieb die URL um. Ein Klick löste damit Navigation und `replaceRoute` gleichzeitig aus. | Der Handler ist entfernt: Karten und Zeilen sind reine Links. Die Karte bleibt die Fläche, auf der ein Objekt ohne Verlassen des Portfolios betrachtet wird. | erledigt |
| 12.3 | Ein Geschoss im Standortbaum sprang direkt in die Arbeitsfläche. Der Baum beantwortet «wo ist der Plan», nicht «öffne ihn»; der Sprung nahm die zweite Entscheidung ungefragt vorweg. | Der Klick öffnet das Register «Grundrisse» des Gebäudes und markiert genau diese Zeile (`mark=<floorId>`). Ein eigener Schlüssel, weil `floor` die Arbeitsfläche öffnet. Die Markierung wird bei jedem Zeichnen der Tabelle über die neue `rowClass`-Option von `table()`/`mountDataTable()` erfragt und überlebt damit Suche, Sortierung und Blättern. | erledigt |
| 12.4 | Das Register «Ausstattungen» führte Multispace-Modulgruppen und Möblierungszahlen in einer Tabelle. Das sind zwei verschiedene Aussagen — ein Modul ist ein vordefiniertes Möblierungssetup, die Ausstattung ist das Mobiliar darin —, und die gebäudetechnische Ausstattung als dritte fehlte ganz. | Getrennt in «Module» und «Ausstattung»; gebäudetechnische Ausstattung wird im Register benannt, aber nicht behauptet. Die Registerleiste wird aus einer Liste gebaut, weil Zonen und Gebäudetechnik folgen. | erledigt |
| 12.5 | Ohne Planungsdatensatz war das Register schlicht leer, obwohl die Rauminformationen vorliegen: Bundeshaus West führt 14 Räume, aber `workspace-planning.json` kennt nur `planAvailability: 'legacy'`. | «Module» leitet die Zuordnung aus der Raumnutzung ab und bezeichnet das so. Verwendet wird `model.js/inferredModule()` — dieselbe Abbildung, mit der die Arbeitsfläche das Modul vorbelegt. Eine zweite Abbildung für dieselbe Frage würde auseinanderlaufen. `MODULE_OPTIONS` trägt dafür neu `name` und leitet `label` daraus ab, statt die Nummer aus einem Anzeigetext zurückzuparsen. | erledigt |
| 12.6 | Der Breadcrumb zeigte «Portfolio › Objekt». Der Standort dazwischen — Land, Kanton, Ort — war nur im Baum sichtbar, und ein Schritt nach oben landete im ungefilterten Portfolio. | Vollständiger Pfad «Alle Objekte › Land › Kanton › Ort › Objekt»; jede Stufe führt in das auf diese Stufe eingegrenzte Portfolio. `shared.js/portfolioRoute()` erzeugt Breadcrumb- und Baum-URLs gemeinsam, sodass nicht zwei URLs für denselben Ausschnitt entstehen. Ein Ort wird als vollständiger Pfad adressiert, weil `restoreTreeSelection` Knoten auf die gesamte Ahnenreihe abgleicht. | erledigt |
| 12.7 | Der erste Breadcrumb-Eintrag hiess in der Arbeitsfläche «Portfolio» und im Detail neu «Alle Objekte» — zwei Namen für dasselbe Ziel. | In der Arbeitsfläche angeglichen. Sie behält die kurze Kette; die Ortshierarchie gehört ins Detail, das eine Leiste über die volle Breite dafür hat. | erledigt |
| 12.8 | Die Galerie war der Standard des Registers «Grundrisse». Ein Geschoss wird nach Fläche, Räumen und Planstand gewählt; eine Wand aus Miniaturen beantwortet keine dieser Fragen. | Liste als Standard, Galerie als zweite Fläche. Der Standardwert steht nicht in der URL. | erledigt |
| 12.9 | Die Aktionskarte führte vier Verweise in andere Anwendungen (Planprüfung, Workspace-Portal, Liegenschaften-Inventar, Mediathek) und las sich als Menü. | Reduziert auf «Im Editor öffnen» und «Neuen Plan hochladen». Der Titelbereich verliert «Oberstes Geschoss öffnen»: einen Plan zu öffnen ist eine Aktion des Registers, das die Pläne führt. | erledigt |
| 12.10 | Leere Register waren teils leere Tabellen. | Beide Leerzustände nutzen das Portalmuster `C.empty` mit Hinweis **und** Aktion — «Im Editor öffnen» bei fehlenden Modulen, «Neuen Plan hochladen» bei fehlender Möblierung —, statt es bei einem Ratschlag zu belassen. | erledigt |
| 12.11 | Auf dem Objektdetail standen zwei senkrechte Rollbalken nebeneinander. Nur einer rollte: `reset.css` setzt `overflow-y:scroll` auf `<html>`, damit kurze und lange Portalseiten nicht springen, und `overlay.css` hält diese Rinne mit `scrollbar-gutter:stable` frei. Eine Anwendung mit fester Viewporthöhe rollt aber in sich selbst, sodass der Wurzelbalken nie fahren kann. | `html:has(> body.body--standalone-app)` schaltet beides ab; der Body schneidet ohnehin ab, also wird nichts unerreichbar. Die Planprüfung bleibt ausgenommen — sie rollt das Dokument und pinnt `overflow-y:auto` in ihrer eigenen Suite. Der Druckzweig gilt jetzt für alle eigenständigen Anwendungen statt nur für die Planprüfung. | erledigt |
| 12.12 | Der Befund 12.11 liess fünf Prüfungen der Struktur-Bearbeitung kippen. Ursache war nicht die Anwendung: Die Vorrichtung zeichnete die neue Fläche mit der Kante exakt auf der Kante des verkürzten Korridors. Ein CSS-Pixel entspricht bei diesem Zoom rund sechs Planeinheiten, also kippte die bündige Kante in eine Sub-Einheit-Überschneidung, sobald die Bühne 15 px breiter wurde — und der Editor weist überschneidende Räume zu Recht ab. | Die Vorrichtung verkürzt den Korridor um 400 statt 200 Einheiten und zeichnet die 200×140-Fläche mit 100 Einheiten Abstand mitten hinein. Sie prüft damit das Werkzeug statt der Koordinatenrundung. | erledigt |

### Prüfartefakte

- `node scripts/test-floorplan-editor.mjs` — Breadcrumb-Pfad und Ziel-URLs je
  Stufe, vier Register mit Zählern, Listen-Standard, Markierung aus dem Baum
  ohne `floor`-Schlüssel, Kartensprung ins Detail, Popup-Umfang und -Beschriftung,
  abgeleitete gegenüber abgenommener Modulherkunft, Leerzustand mit Aktion,
  genau ein Rollbalken auf der eigenständigen Anwendung.
- Die drei statischen Gates sowie `node scripts/test-html-contracts.mjs` und
  `node scripts/test-portfolio.mjs` für die erweiterte `table()`-Zeilenklasse.

## 13. Standortbaum als wiederverwendbares Bauteil, Autorenschaft in 3D

Stand: 10. August 2026. Zwei Blöcke: der Standortbaum wurde nach einer
Gestaltungsstudie auf eine Variante festgelegt und portiert, und die
Plan-Arbeitsfläche kann Möblierung jetzt auch im 3D-Modell bearbeiten.

### 13.1 Gestaltungsstudie und Portierung des Baums

Grundlage ist `docs/wireframes/260810 - Standortbaum.html` — ein eigenständiges
Einzeldatei-Prototyp mit zehn Behandlungen desselben echten Bestands aus
`buildings.geojson` und `parcels.geojson`, inklusive Lastsimulation über 2000
Gebäude und 1500 Grundstücke. Gewählt wurde Variante **H2**.

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 13.1 | Der Baum trug die Hierarchie nur über Icons; `explorer.css` hielt das ausdrücklich fest («Icons and path state carry hierarchy without indentation»). Bei der echten Tiefe — Land › Kanton › Ort › WE › Objekt › Geschoss — ist ab Ebene 3 nicht mehr erkennbar, was zu was gehört. | Einrückung von 16 px je Ebene, als **Zeilen-Innenabstand** statt als Rand der Liste. Damit spannt jede Zeile die ganze Spalte, ihre Trennlinie reicht an beide Kanten, und die linken Enden treppen nicht. | erledigt |
| 13.2 | Trennlinien und Führungslinien schnitten sich. Ein erster Versuch (Variante H) hatte drei Fehler: die Trennlinie begann 8 px rechts der Führungslinie (Kerbe), jede Ebene begann 12 px weiter rechts (Treppe), und die Führungslinie sass auf keiner sinnvollen Achse. | Trennlinien über die volle Breite; Führungslinien je Ebene auf der **Achse des übergeordneten Chevrons** (Gutter plus halbes Chevron). Das ist es, was sie beabsichtigt statt ungefähr wirken lässt. | erledigt |
| 13.3 | Eine Führungslinie je Ebene über die ganze Spalte ist Linienwerk ohne Anlass. | Die Linie erscheint **nur entlang des ausgewählten Zweigs**, wo die Frage nach der Zugehörigkeit gestellt wird. Der innerste Zweig trägt den Akzent, die Vorfahren eine Haarlinie in Flächenstärke. | erledigt |
| 13.4 | Die Linie lief über die ausgewählte Zeile hinweg und las sich dort als versehentlicher Strich. | Die ausgewählte Zeile liegt mit `z-index` **über** der Linie: sie ist das Ziel der Spur, nicht etwas, das die Spur durchquert. | erledigt |
| 13.5 | Die Auswahl war blau, der Pfad hellgrau. Gewünscht war ein zweistufiges Grau. | Auswahl dunkelgrau plus **Primärbalken an der Kante**, Vorfahren hellgrau. Auswahl ruht damit nicht auf Farbe allein. | erledigt |
| 13.6 | Der Zähler war eine nackte Zahl am Zeilenende. | Er liest sich als `(7)`. Die Klammern sind **CSS-Pseudoelemente**: der Textinhalt bleibt die Zahl, die `scripts/check-tree.mjs` und die App-Suiten mit `Number()` auswerten. Eine Klammer im Markup hätte drei Prüfungen stillschweigend gebrochen. | erledigt |
| 13.7 | Der Baum hatte **keine einzige ARIA-Rolle**. Er war eine Liste von Schaltflächen: jede Zeile ein eigener Tabstopp — im Liegenschaften-Inventar über hundert vor der Karte — und die Pfeiltasten taten nichts. | Vollständiges ARIA-Baummuster: `role="tree"`/`treeitem"`/`group"`, `aria-level`, `aria-selected`, ein einziger Tabstopp mit wanderndem `tabindex`, `↑↓` bewegen, `→` öffnet, `←` schliesst oder springt zur übergeordneten Ebene, `Home`/`End` an die Enden. Der Zähler erhält eine benannte Einheit, sonst hört eine Vorleseanwendung «Schweiz 7». | erledigt |
| 13.8 | Filtern kann die Zeile verbergen, die den einzigen Tabstopp trägt — der Baum wäre dann per Tastatur unerreichbar. | `syncTreeCounts` setzt den Tabstopp danach auf eine sichtbare Zeile zurück. | erledigt |
| 13.9 | Drei weitere Oberflächen bauen dieselben Klassen von Hand: Metadaten-Katalog, Prozessdokumentation und die mobile Shop-Navigation. Sie führen kein `aria-level`. | Die Tiefe wird über **verschachtelte `.pf-tree__children`-Selektoren** ausgedrückt, nicht über `aria-level`. Damit erben die handgebauten Listen Einrückung und Trennlinien unverändert und bleiben, was sie sind: Navigationslisten aus Links, keine Baum-Widgets. | erledigt |
| 13.10 | «Beim Klick den ganzen Zweig aufklappen» wurde eingebaut und wieder verworfen. | Eine Ebene je Klick. Das ist auch die Voraussetzung dafür, dass verzögertes Rendern später trägt: ein Klick kann höchstens eine Ebene hinzufügen. | erledigt |

Offen und bewusst nicht umgesetzt: **verzögertes Rendern**. Der Prototyp zeigt
gemessen, dass es die Architekturfrage ist — bei 3500 Objekten legt H2 mit
verzögertem Rendern 46 Zeilen in den DOM, ein vollständiger Aufbau bräuchte rund
13 500 Zeilen (≈ 108 000 Elemente). Ebenfalls offen: eigene Entitäts-Icons mit
echter Strichstärke. `C.icon()` zeichnet eine CSS-Maske, deren Gewicht sich nicht
beeinflussen lässt; schwerere Icons brauchen zwingend eigenes Inline-SVG und
damit eine Änderung der Aufrufer-Schnittstelle in fünf Apps.

`scripts/test-spatial-tree.mjs` prüft den Vertrag an einer Stelle für alle sieben
Oberflächen statt siebenmal einzeln.

### 13.2 Autorenschaft im 3D-Modell

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 13.11 | `toolbarHTML()` gab ausserhalb des 2D-Plans einen leeren String zurück: im 3D-Modell verschwand die Werkzeugleiste vollständig und die Ansicht wirkte defekt, nicht eingeschränkt. | Die Leiste erscheint in **jeder** Ansicht. Was sich unterscheidet, ist, welche Werkzeuge ein Renderer ausführen kann: Auswahl und Bibliothek bleiben aktiv, Messen und Strukturbearbeitung sind deaktiviert **und benannt** («… — nur im 2D-Plan»). | erledigt |
| 13.12 | Die Produktbibliothek war auf den 2D-Plan beschränkt, obwohl Platzieren im 3D-Modell mit der Wahl eines Produkts beginnt. | Bibliothek in allen Ansichten verfügbar; ihr URL-Zustand folgt. | erledigt |
| 13.13 | Möblierung liess sich nur im Plan bewegen und nur über ein Auswahlfeld drehen. | Dasselbe Transformationswerkzeug wie im Plan, flach auf den Boden gelegt: Ring als Drehbahn, ein Griff darauf an der Vorderseite des Objekts, ein Griff in der Mitte zum Verschieben. Die Geometrie kommt aus `transform-widget.js` in **Planeinheiten**, sodass die beiden Ansichten nicht auseinanderlaufen können; nur die Umrechnung in Meter passiert im Viewer. | erledigt |
| 13.14 | Das Werkzeug hing zuerst an `dynamicRoot` und lag damit eine halbe Geschossbreite neben dem Objekt. | Es hängt an derselben Gruppe wie die Möbel — der einzigen, die den Versatz um die halbe Ausdehnung trägt. | erledigt |
| 13.15 | Ein Griff ist ein kleines Ziel auf einer 59 m breiten Fläche; ihn aus einem Test zu treffen hiess, die Fläche abzurastern und zu hoffen. | Der Viewer veröffentlicht die Bildschirmposition der Griffe in `host.dataset.widgetGrips`, wie er seine Kamera schon in `orbitTarget` und `orbitFitRatio` veröffentlicht. | erledigt |
| 13.16 | Ein Ansichtswechsel setzte die Kamera zurück. | Beide Ansichten drücken den Zoom als Verhältnis zu «alles passt» aus, und das ist einheitenfrei. Mittelpunkt und Zoom werden in beide Richtungen übertragen. Exakte Gleichheit ist nicht erreichbar — ein flacher `viewBox` und ein perspektivischer Frustum bei anderem Seitenverhältnis definieren «alles passt» unterschiedlich, und `updateOrbitCamera` begrenzt die Distanz zusätzlich; gemessen 0.64 gegen 0.58. | erledigt |
| 13.17 | Die Kameraübernahme rief `set2dCamera` **während** des Viewer-Abbaus auf. Das zeichnete eine Szene, die unmittelbar danach ersetzt wurde, und liess die 2D-Fläche ganz verschwinden — sichtbar an sechzehn kippenden Prüfungen. | Die Übernahme setzt `camera` direkt; das Rendern nach dem Abbau übernimmt den Wert von selbst. | erledigt |

### 13.3 Ein Bestandsfehler, gefunden beim Prüfen

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 13.18 | **Alle Räume waren in jedem Farbmodus schwarz.** `js/routing/css-loader.js` lud für den Plan-Editor `['dataportal', 'portfolio', 'floorplan-editor']` — aber nicht `floorplan`, und genau dieses Blatt definiert alle `--fp-*`-Raumfarben auf `:root`. `colors.js` gibt sie als `var(--fp-use-work)` in das SVG-`fill`; ohne das Blatt ist die Variable undefiniert, die Deklaration ungültig und SVG fällt auf seinen Vorgabewert zurück — Schwarz. Kein CSS-Gate konnte das sehen, weil die Variable aus JavaScript referenziert wird. | `floorplan` in die Blattliste des Plan-Editors aufgenommen. Gemessen über alle fünf Farbmodi: keine schwarze Fläche mehr. | erledigt |

### Prüfartefakte

- `node scripts/test-spatial-tree.mjs` — ARIA-Muster, ein Tabstopp, Pfeiltasten,
  Einrückung je Ebene, Trennlinien, Führungslinie nur im aktiven Zweig,
  Stapelung der Auswahl, maschinenlesbare Zähler; über alle sieben Oberflächen.
- `node scripts/check-tree.mjs`, `node scripts/check-projects.mjs` und die Suiten
  der fünf Explorer — der Zähler bleibt trotz Klammern auswertbar.
- `node scripts/test-floorplan-editor.mjs` — Werkzeugleiste in 3D mit benannten
  Sperrungen, Transformationswerkzeug auf der Bodenebene, Drehen und Verschieben
  per Griff im Modell, Kamerabrücke, reduziertes Übersichtsregister.

## 14. Plan-Editor: Panels, Messen, Autorenschaft in 3D, Ressourcenbaum

Stand: 10. August 2026. Eine Reihe kleinerer Anliegen, die sich als ein Thema
erwiesen haben: das linke Panel diente zwei Zwecken, und daran hing mehr als
erwartet.

### 14.1 Ein Panel, zwei Aufgaben

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 14.1 | Im Bearbeitungsmodus verschwand der Standortbaum — in 2D genauso wie im 3D-Modell. Ursache war keine Renderer-Eigenheit, sondern `controller.js`: `leftOpen = assetLibraryOpen \|\| (!compactLayout && !editMode)`. Die Schiene war im Bearbeitungsmodus geschlossen, damit nicht ungefragt eine Produktauswahl aufgeht — und weil die Auswahl DIE Schiene war, ging der Baum mit. | `leftOpen = !compactLayout`. Die Schiene führt in jedem Modus den Ressourcenbaum. | erledigt |
| 14.2 | `leftPanelHTML()` war im Lesemodus der Baum und im Bearbeitungsmodus die Bibliothek: eine Fläche, zwei Identitäten, zwei Namen, zwei Schliessaktionen. | Die Bibliothek ist ein Dialog (`libraryHTML`) in der Anatomie des Designsystems: `aria-modal` am Rahmen, `role="dialog"` am Inhalt, schliessender Hintergrund, dasselbe Kreuz wie jedes andere Overlay im Portal. Sie zeichnet aus `assetLibraryOpen` innerhalb von `shellHTML()` statt über `openModal()`, weil der Editor diesen Zustand in die URL schreibt und ein imperativ angehängtes Overlay ausserhalb der Zustandsmaschine läge. | erledigt |
| 14.3 | Sechs Stellen setzten `assetLibraryOpen = false; leftOpen = false;` gemeinsam. Das Schliessen der Auswahl nahm den Baum mit. | Nur noch die Bibliothek. Escape schliesst den Dialog, bevor irgendetwas dahinter reagiert. | erledigt |
| 14.4 | `#fpe-left-list` hätte es zweimal gegeben — Baum und Auswahl. | Der Dialog führt `#fpe-library-list` und `#fpe-library-search`; `drawLeft()` versorgt beide Hosts getrennt. Die Schiene filtert Ressourcen, der Dialog den Katalog. | erledigt |
| 14.5 | **In 3D liess sich keine Möblierung platzieren.** «Hinzufügen» war nicht deaktiviert, tat aber nichts: `openAssetLibrary()` trug `if (viewMode !== '2d') { announce('… nur im 2D-Plan verfügbar.'); return; }`. Die Sperre hatte ihren Grund überlebt — Werkzeugleiste, `placeFromThree` und das Transformationswerkzeug arbeiten längst im Modell. Sichtbar war eine Schaltfläche, die lebendig aussah, nichts änderte und sich nur einer Vorleseanwendung erklärte. | Sperre entfernt. Gemessen vor der Änderung: Dialog öffnete nie, Platzierungen blieben bei 94. Danach: Dialog mit 54 Produkten, Bodenklick 94 → 95. | erledigt |

### 14.2 Ein Messwerkzeug statt zwei

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 14.6 | Zwei Werkzeuge, «Strecke messen» und «Fläche messen», verlangten die Entscheidung, was gemessen wird, bevor der erste Punkt gesetzt war. | Ein Werkzeug. `measurement` ist `{ points, closed }` ohne `kind`: was gemessen wird, folgt aus der Geometrie. Zwei Punkte ergeben eine Länge, ein geschlossener Ring eine Fläche. | erledigt |
| 14.7 | Ein Klick auf einen gesetzten Punkt sollte ihn entfernen — und ein Klick auf den ersten Punkt einen Ring schliessen. Beides zugleich ist widersprüchlich. | Rangfolge: auf dem ERSTEN Punkt bei mindestens drei gesetzten schliesst der Ring, auf jedem anderen entfernt der Klick. Rang eins gewinnt bewusst, sonst bräuchte das Schliessen ein zweites Bedienelement. Ein Klick in einen geschlossenen Ring öffnet ihn wieder, denn ein Ring ohne Ecke ist nicht mehr derselbe Ring. | erledigt |
| 14.8 | Ein geschlossener Ring beantwortete nur eine Frage. | Er nennt Fläche UND Umfang. Wer einen Raum misst, will die Fläche; wer einen Wandzug misst, die Länge; dieselbe Figur beantwortet beides, ohne zweimal gezeichnet zu werden. | erledigt |
| 14.9 | Der Trefferradius in Bildschirmpunkten hätte bedeutet, dass ein Zoom zwischen zwei Klicks die Bedeutung einer Messung ändern kann. | `MEASURE_CLOSE_UNITS = 40` in Planeinheiten. Derselbe Klick löst immer auf denselben Punkt auf. | erledigt |
| 14.10 | Die Anzeige war eine nackte Statuszeile ohne Weg, sie wegzulegen: Messung löschen hiess Werkzeug verlassen. | Eine Karte mit Kreuz, das die Messung löscht und das Werkzeug behält. Escape tut dasselbe, vor dem Werkzeugwechsel. `drawScene` zeichnet die Karte neu statt `textContent` zu setzen — das hätte das Kreuz bei jedem Neuzeichnen gelöscht. | erledigt |

### 14.3 Inspektor und Kamerabedienung

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 14.11 | Der Inspektor schloss mit einem Fenster-Piktogramm, das «Layout ändern» liest, nicht «das hier schliessen» — und trug gar kein Kreuz. | Das `Cancel`-Kreuz des Portals, dasselbe wie in Modal, Hinweis, Dokumentvorschau und Galerie. Auswahl aufheben ist etwas anderes als schliessen und behält mit `CancelCircle` ein eigenes Zeichen, damit nicht zwei Bedienelemente nebeneinander dasselbe Symbol tragen. | erledigt |
| 14.12 | Jeder Abschnitt trug eine Linie unten, auch der letzte — dort schloss sie nichts ab und las sich als abgeschnittenes Panel. | Linien an der OBERkante; der erste Abschnitt verzichtet, weil der Titel schon eine trägt. | erledigt |
| 14.13 | Lange Attributlisten liessen sich nicht wegklappen. | Acht Abschnitte klappen aus ihrer Überschrift, gebaut wie `.fpe-resource-group__head`: echte Schaltfläche, `aria-expanded`, `aria-controls`, Fokus bleibt am Bedienelement. Formulare bleiben bewusst offen — Felder zu verbergen, die jemand ausfüllt, ist kein Dienst. | erledigt |
| 14.14 | Zoom − stand über Zoom +. | Zoom + oben, wie im übrigen Portal: der Stapel liest sich als Skala mit «mehr» oben. Geprüft wird die Reihenfolge, nicht die Anzahl. | erledigt |
| 14.15 | Die Brotkrume nannte die übergeordnete Anwendung «Serviceportal». | «Kundenportal». Der dritte Treffer in `knowledge-content.js` ist ein Dokumenttitel und bleibt. | erledigt |
| 14.16 | Nach einer Platzierung war das Produkt entwaffnet: eine Reihe gleicher Stühle hiess jedes Mal zurück in die Bibliothek. | Das Produkt bleibt geladen. Escape und jedes andere Werkzeug entwaffnen von selbst, weil `chooseTool` `placementProduct` für jedes Werkzeug ausser «place» leert. Der Pfad, der direkt in einen ausgewählten Raum platziert, hatte nie geladen — dort wird jetzt ausdrücklich geladen. | erledigt |

### 14.4 Ressourcenbaum in der Baumsprache des Portals

Der Baum behält bewusst eigenes Markup: eine Zeile ist hier ZWEI Bedienelemente —
eine Aufklappung und eine Auswahl — und sie trägt Zahlen rechts, wovon der
Portfoliobaum nichts weiss. Übernommen ist alles, was ein Lesender sieht.

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 14.17 | Ausstattungszeilen standen auf derselben Einrückung wie ihr Raum und lasen sich als seine Geschwister. | Einrückung als Zeilen-Innenabstand, ein Schritt von 16 px je Ebene. Gemessen 20 / 36 / 76 px — Gruppe, Raum, Objekt, wobei die Objektzeile zusätzlich die Aufklappspalte des Raums freihält. | erledigt |
| 14.18 | `--tree-gutter` des Portfoliobaums sind 8 px, der Panelrand 20 px. | Der Baum übernimmt die SKALA, nicht den Startpunkt: `--tree-gutter:var(--fpe-panel-gutter)`, damit Kopf, Suchfeld und Baum eine linke Kante teilen. Ein Baum, der 12 px weiter innen beginnt als das Feld darüber, liest sich als Fehler. | erledigt |
| 14.19 | Räume trugen ein helleres Grau als Gruppen. | Eine Trennlinienstärke und -farbe über alle drei Ebenen. | erledigt |
| 14.20 | Der fünfspaltige Raster der Gruppenzeile brach «HNF · Hauptnutzfläche» auf zwei Zeilen. | Flex-Zeile; das Beschriftungsfeld kürzt mit Auslassung. | erledigt |
| 14.21 | Auswahl war einstufig. | Zweistufig wie im Portfoliobaum: `is-path` am Raum, der ein ausgewähltes Objekt hält, und an der Gruppe darüber — im Markup gesetzt, weil CSS das nicht herleiten kann. Führungslinie nur entlang des ausgewählten Zweigs, Akzent auf der innersten Liste. | erledigt |
| 14.22 | Der Zähler war eine nackte Zahl. | Er liest sich als `(23)`, die Klammern als Pseudoelemente, damit `textContent` eine Zahl bleibt. | erledigt |

### 14.5 Strukturbearbeitung: der Umfang hinter dem Schloss

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 14.23 | Entsperrt bot das Menü ein einziges Werkzeug an. Damit sah Strukturbearbeitung wie ein fertiges, sehr kleines Merkmal aus statt wie der Anfang von Flächenmanagement. | Zwölf Bauteile als deaktivierte Menüeinträge: Wand, Umfassungswand, Raumteiler, Tür, Fenster, Öffnung, Stütze, Einbaumöbel, Küche, Geländer, Treppe, generisches Bauteil. Gesperrt bleibt die Liste verborgen, damit das Menü nicht auf eine Wand unbedienbarer Einträge aufgeht. | erledigt |
| 14.24 | Die Vorlage zeigt Tastenkürzel je Zeile. | **Nicht übernommen.** Ein Kürzel neben einem Bedienelement, das nicht laufen kann, ist ein Versprechen, das die Anwendung beim ersten Versuch bricht. Der Vorbehalt steht einmal in der Überschrift — «Bauteile · in Vorbereitung» — statt zwölfmal in den Zeilen. | erledigt |
| 14.25 | Der Icon-Satz des Designsystems führt **kein einziges** Bausymbol. Geprüft: wall, door, window, stair, column, railing, kitchen — kein Treffer. | Eigene Inline-SVG in `js/floorplan-editor/structure-elements.js`, gezeichnet als Planzeichen von oben: eine Wand ist ein gefülltes Band, eine Tür ein Blatt mit Schwenkbogen, ein Fenster ein Band mit Glaslinie, ein Raumteiler gestrichelt, weil er nicht trägt. Das ist die Zeichensprache, die im Plan daneben schon steht, also braucht das Menü keine Legende. Damit ist auch die Frage nach besseren Menü-Icons beantwortet: was gewünscht ist, existiert im Satz nicht und braucht denselben Weg. | erledigt |

### 14.6 Platzierungsvorschau im Modell

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 14.26 | Der 2D-Plan zeigt unter dem Zeiger eine durchscheinende Grundfläche, getönt danach, ob sie in einem Raum landet. Das Modell zeigte nichts: Platzieren in 3D war ein Blindklick. | Dieselbe Vorschau im Modell — Grundfläche auf dem Boden, durchscheinendes Volumen darüber, Kanten. Die Farbwerte liegen als `PLACEMENT_PREVIEW` in `colors.js`, dem bestehenden Ort für Farben, die sowohl ein SVG als auch einen Three.js-Verbraucher bedienen müssen. Die Vorschau ist kein Pickziel, damit ein Klick durch sie hindurch den Boden erreicht. | erledigt |
| 14.27 | Drei Stellen bauten dasselbe Vorschauobjekt: der 2D-Zeiger, der 2D-Tastaturzeiger und nun 3D. Zwei davon waren schon Kopien. | Eine Funktion `ghostAt(point)` für alle drei. Gültigkeit ist derselbe `containingRoom`-Test, den die Platzierung selbst durchführt — eine grüne Fläche kann sich also nicht in eine Ablehnung verwandeln. | erledigt |
| 14.28 | Der 3D-Bodentest trifft die UNENDLICHE Ebene y = 0. Zielt jemand Richtung Horizont, entsteht ein Punkt zehner Meter jenseits des Gebäudes — gemessen `9684,-4883`. | `ghostAt` verwirft Punkte ausserhalb von `floor.extent`. Das ändert 2D geringfügig mit: im gepolsterten Rand um den Plan erscheint keine Vorschau mehr, was richtig ist. | erledigt |
| 14.29 | **Die 2D-Vorschau trug `class="fpe-placement fpe-placement--ghost"`.** Damit zählte JEDE Zählung von Platzierungen im DOM die Vorschau mit. Sichtbar geworden ist es daran, dass eine Prüfung 96 statt 95 Objekte fand, solange eine Vorschau auf dem Schirm war. | Eigene Klasse `.fpe-ghost`. Eine Vorschau ist kein Objekt im Dokument, und kein künftiger Selektor kann sie mehr dafür halten. | erledigt |
| 14.30 | Für keine der beiden Ansichten gab es Prüfungen der Vorschau. | Beide geprüft: Tönung nach Gültigkeit im Plan, Vorschau auf dem Boden im Modell, kein Rest ausserhalb des Plans, keiner nach dem Entwaffnen. Der Viewer veröffentlicht `dataset.ghost` wie schon die Griffe des Transformationswerkzeugs, damit das ohne Pixelvergleich prüfbar ist. | erledigt |

### 14.7 Zwei Fallen beim Prüfen, notiert für das nächste Mal

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 14.31 | Ein Elementverweis, der über ein Neuzeichnen hinweg gehalten wird, ist abgehängt: `drawScene` ersetzt `#fpe-canvas`, ein vollständiges Neuzeichnen die 3D-Fläche. Ein abgehängtes SVG meldet eine EINHEITSMATRIX als Bildschirmabbildung — die Sonde bildete Planpunkt (-60,-60) auf Clientpunkt (-60,-60) ab, sendete ins Leere und las eine alte Vorschau. Sie wäre aus dem falschen Grund grün geworden. | Beide Sonden fragen den Knoten bei jedem Zugriff neu ab. | erledigt |
| 14.32 | Der erste Versuch skalierte den `viewBox` gegen die Elementbox. `preserveAspectRatio` setzt die Zeichnung mit Rand in das Element, sodass eine lineare Abbildung auf den falschen Planpunkt zeigt. | `getScreenCTM()` und `createSVGPoint()` — die Abbildung des Browsers selbst, dieselbe, die `clientToPlan` invertiert. | erledigt |

### Prüfartefakte

- `node scripts/test-floorplan-editor.mjs` — Bibliothek als Dialog mit Baum in
  Schiene und Modell, Platzieren im 3D-Modell Ende zu Ende, ein Messwerkzeug mit
  Länge, Fläche, Umfang, Punktentfernung und verwerfbarer Anzeige, klappbare
  Inspektorabschnitte, Reihenfolge der Kamerabedienung, Baumsprache des
  Ressourcenbaums, zwölf inerte Bauteile mit Planzeichen.
- `node scripts/test-spatial-tree.mjs`, `node scripts/check-tree.mjs` — der
  Portfoliobaum bleibt unberührt.
- Sechs Prüfungen mussten neu geschrieben statt geflickt werden: vier lasen
  `has-left` als Stellvertreter für «Bibliothek offen», was jetzt «Baum offen»
  heisst, und eine forderte ausdrücklich `leftWidth <= 1`. Zwei waren echte
  Prüffehler, die die Trennung sichtbar gemacht hat: die Berührungsziel-Prüfung bei
  320 px mass Bedienelemente in einer geschlossenen Schublade und in eingeklappten
  Baumgruppen, die beide null melden.

## 15. «Arbeitsplätze gestalten»: vom Dokument zum Katalog

Stand: 11. August 2026. Ein Wissensgebiet trug acht Abschnitte, einen Modulkatalog und
eine Dokumentensammlung auf einer Seite. Es ist jetzt ein aufklappbarer Zweig mit fünf
Unterseiten, und die Modulliste existiert nur noch einmal.

### 15.1 Eine Liste, nicht zwei

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 15.1 | **Das Portal nannte zwei verschiedene Modulvokabulare.** Die Wissensseite beschrieb zehn Module nach «Stand 31.10.2025», das Raumattribut des Plan-Editors bot elf nach «Stand 6.1.2025» an. «Modul 7» hiess damit auf der einen Seite Interaktive Sitzungen und im Editor Coffee Point — und der Editor ist die Stelle, an der die Zahl in einen gespeicherten Plan geschrieben wird. | `data/multispace-modules.json` ist die Quelle; Editor und Wissensseite leiten daraus ab. Publiziert wird die Ausgabe 6.1.2025, weil genau sie der Editor immer schon geschrieben hat: keine Umnummerierung, keine Migration, kein gespeicherter Plan ändert seine Bedeutung. | erledigt |
| 15.2 | Zwei handgepflegte Kopien können wieder auseinanderlaufen, und das Repository hat keinen Build-Schritt, der das verhindern würde. | `scripts/check-multispace-modules.mjs` beweist, dass Fixture, `MODULE_OPTIONS` und die Seitenliste übereinstimmen. Das ersetzt hier den Compiler. | erledigt |
| 15.3 | Die neuere Ausgabe darf nicht verloren gehen, aber eine zweite Modulliste wäre wieder eine Kopie. | Sie steht als **Delta**: drei Änderungen und eine Umnummerierungstabelle (`7 → null`, `8–11 → 7–10`). Der Wechsel ist ein Feld plus eine Draft-Migration — und die Migration ist der Grund, warum er bewusst getroffen werden muss. | offen, bewusst |

### 15.2 Der Zweig

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 15.4 | Eine Seite mit acht Abschnitten, elf Modulen und einer Dokumentensammlung ist in einer Sitzung nicht lesbar. | Aufklappbarer Zweig wie «Digitalisierung»: Übersicht, Multispace-Handbuch, Planungsbeispiele, Kreislaufwirtschaft, Downloads. | erledigt |
| 15.5 | `js/pages/knowledge.js` begründete ausdrücklich das Gegenteil: «Separate Routen ergäben Seiten mit drei Dokumenten.» | Die Regel gilt weiter — für die anderen sechs Gebiete. Dieses eine trägt einen Katalog mit einer Seite je Modul, und der Kommentar sagt das jetzt, statt dem Code zu widersprechen. | erledigt |
| 15.6 | Fünf Unterseiten könnten fünf Inhaltslisten bedeuten, die auseinanderlaufen. | Die gemeinsame Abschnittsliste besitzt die zwei dokumentartigen Zweige und den Suchtreffer des Handbuchs. Modul- und Beispielkatalog rendern stattdessen ihre kanonischen JSON-Datensätze; damit gibt es auch dort keine zweite Inhaltskopie. | erledigt, durch 15.20 präzisiert |
| 15.7 | Das Handbuch war eine Dokumentseite mit Inhaltsverzeichnis, obwohl der Inhalt ein Katalog ist. | Volle Breite, Module als Karten, darunter die Planungsbeispiele — die Vorlage aus `docs/wireframes/260806 - Workspace Management.html`. | erledigt |
| 15.8 | Die Übersicht war eine Dokumentseite mit Inhaltsverzeichnis über einer einzigen Kartenreihe. | Nur Karten, im Muster der Digitalisierungsübersicht: `page-header`, dann `section section--default bg--secondary-50`, drei Spalten. Die Klassen wurden gegen jene Seite gemessen, nicht angenommen. | erledigt |
| 15.9 | Der «alles anzeigen»-Link stand links, weil er von Hand in den Abschnittsinhalt geschrieben war. | Über den `more`-Slot von `pageSection`, denselben, den das News-Band der Startseite benutzt. Gemessen: rechter Abstand 0 px auf allen drei Bändern. | erledigt |

### 15.3 Planungsbeispiele

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 15.10 | «Realisierte Flächen als Inspiration» braucht einen Moment zum Verstehen. | **Planungsbeispiele**. | erledigt |
| 15.11 | Ein Beispiel ist kein Gebäude. Es ist ein Geschoss, eine Zone darin oder ein einzelner Raum. | `scope` gehört zum Datensatz und steht auf jeder Karte; das Gebäude ist nur, wo der Ort liegt. | erledigt |
| 15.12 | Bilder mit dem Beispiel zu kopieren, hätte Lizenz, Fotograf:in und Quelle abgeschnitten — ein Teil der Aufnahmen ist als «BBL-Mediendatenbank, nicht frei lizenziert» geführt. | `mediaIds` verweisen in `data/media.json`. Die Detailseite zeigt zu jeder Aufnahme Titel, Urheberschaft und Lizenz, und der Gate prüft, dass keine Aufnahme ohne Bildunterschrift erscheint. | erledigt |
| 15.13 | Die Modul-Detailseite trug einen Abschnitt «Weitere Module» — eine Navigation, wo eine Aussage hingehört. | «Planungsbeispiele», **abgeleitet** aus den Beispielen, die ihre Module ohnehin deklarieren. Eine Linkliste im Modulrecord wäre die Kopie aus 15.1 gewesen. Module ohne Beispiel sagen das; drei der elf trifft das. | erledigt |
| 15.14 | Ein Filterbalken über vier Beispiele. | Nicht gebaut. Das Muster teilen fünf andere Sammlungen und gehört hierher, sobald die Menge einen Bildschirm überschreitet. | offen, bewusst |

### 15.4 Bilder ohne Bilder

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 15.15 | Alle elf skalaren Bildpfade zeigten auf nicht vorhandene Dateien; die Farbrückfallebene liess die Karten dennoch vollständig aussehen. Echte, freigegebene Modulaufnahmen gibt es nicht. | Elf unterscheidbare 1440×810-Prototypillustrationen wurden lokal erzeugt und ausdrücklich als nicht verbindlich gekennzeichnet. Jeder Modulrecord trägt eine geordnete `images[]`-Liste mit Alt-Text, Legende, Credit, Lizenzstatus und Provenienz; stabile Slug-Dateinamen überleben die dokumentierte Umnummerierung. | erledigt |
| 15.16 | Karte und Detail brauchten denselben Hero und eine Erweiterung auf mehrere Bilder, ohne einen zweiten `heroImage`-Vertrag. | `images[0]` ist Kartenbild und kanonischer Detail-Hero; weitere Einträge erscheinen in gespeicherter Reihenfolge als Galerie. `images:[]` ergibt eine kompakte textbasierte Darstellung ohne Anfrage. Eine angeforderte defekte Datei wird entfernt, während die sichere Modulfarbe und der Link erhalten bleiben. | erledigt |
| 15.17 | `swatchCss()` liefert `var(--fpe-module-4)`, und dieses Blatt lädt auf einer Wissensseite nicht — genau die Form des Fehlers, der einmal alle Räume schwarz gemalt hat. | `swatchHex()` für Verbraucher ausserhalb des Editors. | erledigt |
| 15.18 | Die drei «Planungsbeispiele» des Handbuchs waren eine zweite, hart codierte Datenliste. Lokale Dateipfade wurden als alte Unsplash-ID übergeben; deshalb blieben ihre Bildcontainer leer, obwohl die kanonischen Beispiele gültige Medien besitzen. | Die Duplikatliste und ihr Kartenrenderer sind entfernt. Handbuch und vollständige Beispielseite verwenden dieselben `workspaceExamples`, dieselben `coverMediaId`-Medien und `C.card`; die Vorschau zeigt die drei neuesten Einträge, «Alle Beispiele anzeigen» die vollständige Sammlung. | erledigt |
| 15.19 | Die alte Browserdiagnose zählte `.photo`-Container und konnte elf fehlende Bilder als Erfolg melden. | `test-workspace-knowledge.mjs` prüft echte, dekodierte Bildpixel, Same-Origin-Pfade, Karten-/Hero-Gleichheit, kanonische Routen, Tastaturöffnung, 320/768/1440-Containment und den sicheren Fehlerfall. Datenintegrität pinnt Dateifall, 1440×810 JPEG, 220-KiB-Einzel- und 2-MiB-Gesamtbudget. | erledigt |
| 15.20 | Die Katalog-Landingpage wiederholte nach Modulen und Planungsbeispielen fünf lange Fachabschnitte: Einrichtungsrichtlinien, Farbkonzept, Planungsablauf, Plandaten und Anwendungsverweise. Sie machte aus dem visuellen Einstieg erneut eine Dokumentseite und duplizierte Ziele, die das Portal bereits global erschliesst. | Die fünf Abschnitte sind aus Landingpage, Inhaltsmodell und Wissenssuche entfernt; ihre exklusiven Renderer und CSS-Regeln ebenfalls. Die Seite endet nach «Planungsbeispiele». Modulbezogene Einrichtungsrichtlinien bleiben auf den jeweiligen Moduldetails, Kreislauf und Downloads auf ihren eigenen Zweigseiten. Pure und Browser-Verträge pinnen die Abwesenheit. | erledigt, 17. August 2026 |

### 15.5 Zwei Ursachen, nicht eine

Vier Suiten fielen in Gesamtläufen aus und liefen einzeln durch. Die erste Erklärung —
feste Wartezeiten — war für mindestens eine davon falsch: `test-format.mjs` enthält keine
einzige, und ihr Fehlschlag brachte **gar keine Ausgabe**. Das ist ein Absturz, keine
fehlgeschlagene Prüfung.

- **Abstürze** nach rund fünfzig Browserstarts hintereinander. Der Läufer wiederholt einen
  stillen Fehlschlag einmal und meldet den Neustart, damit Absturz und echter Fehler
  unterscheidbar bleiben.
- **Eine echte Wartezeit-Schwäche**, in `test-floorplan-editor-three-controls.mjs`: Klick
  auf die 3D-Ansicht nach festen 350 ms, dann zwei Sekunden auf einen WebGL-Kontext. Beides
  wartet jetzt auf Bedingungen, und wenn der Viewer ausbleibt, sagt die Prüfung das, statt
  ein Dutzend Prüfungen an `undefined` scheitern zu lassen.

Dass der Unterschied überhaupt sichtbar wurde, geht auf die Harness-Korrektur aus Abschnitt
14 zurück: der Fehler kam als «Cannot read properties of null (reading
'getBoundingClientRect') at drag» an statt als leere Zusicherung unter fremdem Namen.

### Prüfartefakte

- `node scripts/check-multispace-modules.mjs` — eine Modulliste, drei Verbraucher, keine
  vertraulichen Zahlen im Fixture.
- `node scripts/check-workspace-branch.mjs` — fünf Unterseiten, elf Modulseiten, die
  Kartenbilder mit Farbrückfall, die Galerie und die Beispieldetailseite, und die Regel,
  dass keine Aufnahme ohne Lizenzangabe erscheint.
- `node scripts/test-workspace-knowledge.mjs` — echte dekodierte Karten-/Hero-Bilder,
  kanonische Beispiele, Tastaturroute, responsive Grenzen und sicherer Bildfehler.
- `node scripts/test-knowledge-workspace.mjs`, `node scripts/test-content.mjs` — die
  Bestandsprüfungen des Gebiets, angepasst an den Zweig statt an die eine Seite.

## 16. «Arbeitsplätze gestalten»: CD-Hub, Dokumentseiten und Bildergalerien

Stand: 17. August 2026. Dieser Abschnitt **ersetzt nicht die Historie in
Abschnitt 15**. Er präzisiert den heutigen Oberflächenvertrag nach der
anschliessenden Gesamtprüfung des Zweigs. Insbesondere beschreiben 15.8, 15.12,
15.18, 15.19 und die dortigen Prüfarbezeichnungen den Zwischenstand mit
generischen Hub-Karten und eigenen Beispieldetailseiten. Die Entscheidungen zu
einer kanonischen Modulliste, echten Medienreferenzen, Lizenzangaben und
dekodierten Bildprüfungen bleiben gültig.

Die vollständige Herleitung aus dem lokal ausgecheckten Swiss Federal Design
System, der Vorher-/Nachher-Befund, die Routen-/Datenmatrix und die verbleibenden
Grenzen stehen in
[`design-review-workspace-knowledge-2026-08-17.md`](design-review-workspace-knowledge-2026-08-17.md).

| Nr. | Befund | Entscheid / Umsetzung | Status |
| --- | --- | --- | --- |
| 16.1 | Der Zweig-Hub verwendete generische Icon-Kacheln und Zähler. Das lokal geprüfte CD baut Hubs aus Highlight-Karten auf und führt für vier kuratierte Ziele ein eigenes Raster: erste Karte breit, danach drei Geschwister. | `.card--highlight` und `.grid--items-4` sind nach dem CD-Quellcode als erster echter Verbraucher wiederhergestellt. Der Hub zeigt vier Ziele ohne Kategorie-Icon oder Zähler und behält die Gebietseinleitung. Frühere Bestandsnotizen, beide Klassen seien mangels Verbrauchern entfernt, sind damit datiert überholt. | erledigt |
| 16.2 | Kreislaufwirtschaft war ein einziger langer Abschnitt; vier Downloadgruppen steckten mit Zählern in Akkordeons. Weder Lebenszyklus noch Materialgruppen ergaben ein brauchbares Inhaltsverzeichnis. | Je vier echte `h2[id]`-Abschnitte in der geteilten Ankernavigation. Die zehn Downloadressourcen sind direkte CD-Zeilen, ohne Akkordeon und ohne Kopfzähler; Gruppen und Einträge sind im Wissensindex adressierbar. | erledigt |
| 16.3 | Vier visuelle Planungsbeispiele erzeugten vier umfangreiche Detailseiten mit Aufnahmen, Grundriss, Möbeltabelle und Ortsdaten. | Jede Karte öffnet die bereits vorhandene, auf dieses Beispiel begrenzte Galerie. `?bild=<example-id>:<media-id>` hält Bild und Sammlung teilbar; Metadaten tragen Projektfakten, Urheberschaft und Lizenz. Gültige alte Slug-Routen werden auf das Titelbild kanonisiert, ungültige bleiben 404. | erledigt |
| 16.4 | Der Galerie-Download war standardmässig sichtbar, solange eine Bilddatei existierte; unbekannte Rechte konnten damit wie eine Freigabe wirken. | Opt-in: nur erkannte CC0-/CC-BY-/CC-BY-SA-Angaben erlauben die Dateiaktion. Proprietäre oder unbekannte Labels verbergen sie, während die Rechteinformation sichtbar bleibt. | erledigt |
| 16.5 | Rund fünfhundert Zeilen Workspace-Katalog- und Detailcode lagen im generischen Wissensrenderer; jede Workspace-Route lud Module, Produkte, Medien und Beispiele. | `workspace-knowledge.js` besitzt den Zweig. `knowledge.js` lädt ihn dynamisch und deklariert Daten pro exakter Routenform: Hub/Kreislauf/Downloads sowie unbekannte Zweige, Fehlaliasse und Zusatzsegmente ohne Kataloge; recordförmige Modul-/Beispielpfade nur mit den Daten, die ihren Bestand prüfen und darstellen. | erledigt |
| 16.6 | Der allgemeine visuelle Prüflauf enthielt keine einzige Route dieses Wissenszweigs. | Hub, Handbuch, Inspiration, Kreislauf und Downloads sind in `scripts/review-routes.mjs` aufgenommen. Das ist künftige Abdeckung, kein behaupteter vollständiger Matrixlauf für diese Änderung. | erledigt |

### Prüfartefakte

- `node scripts/test-knowledge-workspace.mjs` — Abschnitts-, Ressourcen-, Such-
  und Vertraulichkeitsvertrag.
- `node scripts/test-route-needs.mjs`, `node scripts/test-routes.mjs` — exakte
  Datenbedürfnisse, kanonische Routen, Kompatibilität und strikte Fehlpfade.
- `node scripts/check-workspace-branch.mjs` — Hub, H2-/ToC-Struktur, direkte
  Downloadzeilen, Modul-/Beispielkatalog und kanonische Galerie-Links.
- `node scripts/test-workspace-knowledge.mjs` — echte Bildbytes,
  Galerietastatur, Deep Links, Fokusrückgabe, Rechteaktion, responsive Grenzen
  und sicherer Bildfehler.

Die vollständige Root-Regressionsmatrix einschliesslich 24/24 reinen Suiten
lief grün. Alle fünf fokussierten Routen-/Browser-Gates liefen grün; ebenso die
Shared-Surface-Regressions für CSS, Portfolio, UI-State, Galerie-/Grundrisszustand
und Ankersuche, `test-data-resilience`, Syntax für 241 JS/MJS-Dateien,
Englisch-Gate für 272 gepflegte Quelldateien und `git diff --check`. Der
unterstützte Bestand bleibt 63 Suiten (39 Browser, 24 rein) plus 25 Checker. Die
75 Einträge von `review-routes.mjs` wurden für diese Änderung nicht als
vollständige visuelle Screenshot-Matrix ausgeführt und werden deshalb nicht als
Prüfergebnis gezählt.
