# Design Review service-portal gegen CD Bund

| Merkmal | Wert |
| --- | --- |
| Stand | 5. August 2026 |
| Branch | `design-review-2026-08` |
| Referenz | Schweizer Design System, lokale Version 1.0.5 |

## 1. Zusammenfassung

Das Portal ist in seiner Grundstruktur weitgehend CD-konform. Farb- und
Typografierampen, Intranet-Skin, Container, Bundes-Chrome, Karten, Formulare,
Tabellen, Register und Fokusdarstellung orientieren sich nachvollziehbar an
`swiss/designsystem` 1.0.5. Das Portal deklariert dieselbe Version als
Ausrichtungsziel. Eine Versionsabweichung liegt nicht vor.

Geprüft wurden der vollständige statische SPA-Code, die lokale CD-Quelle, alle
gemeinsamen UI-Fabriken und alle fachlichen Ansichten. Die visuelle Baseline
umfasst 57 repräsentative Routen und Zustände in 320, 768 und 1440 px, insgesamt
171 Full-Page-Screenshots. Nach Freigabe wurden die neun Befunde F01–F09 in
sechs Wellen umgesetzt. Der abschliessende Render-Audit meldet in 171 Zuständen
keine horizontalen Überläufe, fehlenden H1, doppelten IDs, unbeschrifteten
Bedienelemente, Bilder ohne `alt`, Überschriftensprünge, fehlerhafte
Tabellenköpfe oder Zielgrössen unter der geltenden Mindestgrösse. Alle 20
Funktionssuiten laufen durch.

Die Umsetzung umfasst die priorisierte Token-Bereinigung, gemeinsame
Combobox- und Viewer-Muster, eine korrigierte Inhalts- und
Swagger-Überschriftenstruktur, natürliche Hero-Bildformate, vollständige
Fokus-/Disabled-Zustände, responsive Zielgrössen, mobile Shop-Kategorien und
eine dynamische Platzreserve für den fixierten Hinweisbanner. Der ergänzende
Accessibility-Kurztest ist in allen 57 Zuständen ohne automatisierten Befund.

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
| S6 | Responsive Grundqualität | 171 gerenderte Zustände ohne horizontalen Seitenüberlauf; Tabellen besitzen fokussierbare Scrollregionen, Karten und Viewer feste responsive Rahmen. | Beibehalten und nach jeder Welle erneut prüfen. | konform |
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
| Responsive | Kein horizontaler Seitenüberlauf in 171 Zuständen bei 320/768/1440 px. |
| Bilder | Kein gerendertes Bild ohne `alt` in der Audit-Matrix. |
| IDs und Namen | Keine doppelten IDs und keine unbenannten gerenderten Controls in der Audit-Matrix. |
| Reduced Motion | Bewegungsdauern laufen über Tokens und werden in `prefers-reduced-motion` auf eine minimale Dauer gesetzt. |
| Prozessdiagramm | Eigenes Vollbreiten-Register, vertikale Overlay-Werkzeuge, Reset und gleichwertige Schritttabelle. |
| Warenkorb | Global im Top-Header, auf allen Routen erreichbar; Zähler reagiert auf Änderungen. |

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
| 1 Tokens | Direkte Farben mit vorhandenem Rollen-Token ersetzen; `#fff` in Warenkorb/BPMN bereinigen. | mittel | klein | erledigt | CSS-Scan und 171 Screenshots |
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
| 6 Accessibility | Reproduzierbare Tastatur-, Fokus-, 200-%-Reflow- und AX-Tree-Prüfung der 57 Zustände; reale Sprachausgabe als Release-Check dokumentieren. | hoch | gross | erledigt | `docs/accessibility-review.md` |
| Entscheidung | L1-Überlauf, mobiles Menü, Tabellen-Zeilenkopf und Step-Farben nicht ändern. | vermeidet Regression | – | bewusst nicht umgesetzt | als bewusste Abweichung dokumentiert |

### Abnahme nach jeder Welle

1. Alle 20 Funktionssuiten laufen.
2. `scripts/review-audit.mjs` läuft für 57 Zustände in drei Viewports.
3. `scripts/review-screenshots.mjs after` aktualisiert 171 Nachher-Bilder.
4. Beabsichtigte Änderungen werden gegen `docs/review-assets/before/` geprüft;
   andere visuelle Abweichungen gelten als Regression.
5. Die Welle erhält einen eigenen Commit mit nachvollziehbarer Message.

## 8. Prüfartefakte

| Artefakt | Inhalt |
| --- | --- |
| `docs/design-system-reference.md` | Tokens, Layout, Komponentenstrukturen, Zustände und Bundes-Chrome der Version 1.0.5 |
| `docs/feature-inventory.md` | Routen, Funktionen, Interaktionen und Zustände des Portals |
| `docs/review-assets/before/` | 171 Full-Page-Screenshots |
| `docs/review-assets/after/` | 171 Full-Page-Screenshots nach der Umsetzung |
| `docs/review-assets/audit.json` | Strukturierter Render-Audit über dieselbe Matrix |
| `docs/review-assets/accessibility.json` | Reflow-, Tastatur-, ARIA- und Accessibility-Tree-Audit über 57 Zustände |
| `docs/accessibility-review.md` | Methode, Ergebnis und Grenze des Accessibility-Kurztests |
| `scripts/review-routes.mjs` | Zentrale Liste der 57 Prüfzustände |
| `scripts/review-audit.mjs` | Overflow-, Semantik-, Label-, Tabellen- und Touch-Target-Prüfung |
| `scripts/review-accessibility.mjs` | 200-%-Reflow-, Fokus-, ARIA- und Accessibility-Tree-Prüfung |
| `scripts/review-screenshots.mjs` | Vorher-/Nachher-Aufnahme in 320/768/1440 px |

Die freigegebenen Phasen 5 und 6 sind umgesetzt. Die Nachher-Baseline und die
strukturierten Prüfergebnisse bilden den Abnahmestand dieser Runde.
