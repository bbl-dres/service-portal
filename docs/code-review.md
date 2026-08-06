# Technisches Code Review: service-portal

**Stand:** 6. August 2026

**Geprüfter Stand:** `main`, Commit `fb9e9c2e60defc7ecdbf253e3b902446383971e3`

**Review-Umfang:** Phase 0–4 auf `main`; Phase 5 auf Branch `code-review-2026-08`

## 1. Zusammenfassung

Das Repository ist ein statisches, öffentliches Frontend-Mockup auf GitHub Pages. Es verwendet Vanilla JavaScript mit ES Modules, hashbasiertes Routing, statische JSON-/GeoJSON-/BPMN-Daten und drei zur Laufzeit geladene CDN-Bibliotheken. Es gibt keine Build-Kette, keinen Package-Manager und kein Backend. Diese Eigenschaften sind für den Mockup kein Mangel und wurden nicht als Befund gewertet.

Die Architektur ist für die Grösse grundsätzlich tragfähig. Der geprüfte Baseline-Stand enthielt jedoch einen reproduzierbaren Vorführfehler: Die monatliche Immobilienentwicklung erzeugte ungültige SVG-Koordinaten und zeichnete das Diagramm nicht korrekt. Daneben lagen normale Bedienfehler in Navigation, Overlays, Gebäudeerfassung, Raumbuchung, Shop und Mietflächenansicht vor. Diese technischen Punkte wurden in Phase 5 weitgehend behoben. Der verbleibende Schwerpunkt ist organisatorisch: Das öffentliche Repository enthält interne oder eingeschränkte Ziel-URLs, real wirkende Objekt- und Kontaktdaten sowie Medien ohne nachgewiesenes Weiterverteilungsrecht.

Produktionsanforderungen wie echte Authentisierung, Backend-Fehlerbehandlung oder Lastverhalten sind bewusst nicht hochgestuft. Sie stehen separat in Abschnitt 6. Fehlende Mock-Funktionen, Platzhalter und nicht verdrahtete Buttons sind kein Befund.

| Kategorie | Anzahl | Einordnung |
| --- | ---: | --- |
| Blocker | 1 | Der Mockup verhält sich in einer vorhandenen Ansicht sichtbar falsch |
| Wichtig | 22 | Reproduzierbare Bedien-, Zustands-, Daten- oder Publikationsfehler |
| Komplexität | 10 | Duplikate, toter Code, unnötige Schichten oder messbarer Wartungsballast |
| Produktionsrelevant | 9 | Heute im Mockup kein Problem; vor einer produktiven Nutzung zu lösen |
| Kosmetisch | 8 | Inkonsistenzen ohne wesentliche Funktionswirkung |
| Offene Fragen | 10 | Absicht oder Datenstatus ist aus dem Repository nicht bestimmbar |

### 1.1 Umsetzungsstand Phase 5

Die freigegebene erste Runde und die anschliessenden Pakete K-09/C-04 sowie K-05/K-06 wurden auf `code-review-2026-08` umgesetzt. Es wurden keine Route oder Ansicht entfernt, keine Hash-Verträge geändert und keine Framework- oder Runtime-Abhängigkeit ergänzt. Der Blocker, 19 von 22 wichtigen Befunden, C-08, K-05, K-06, K-09 und C-04 sind erledigt. W-01, W-02 und W-12 bleiben bewusst offen, weil ihre Korrektur eine Publikations-, Lizenz- oder fachliche Quellenentscheidung verlangt. Die Git-History wurde nicht umgeschrieben.

| Status | Befunde | Commit oder Abhängigkeit |
| --- | --- | --- |
| Erledigt | B-01 | `2bbf343` – kategoriale Monatsachse ohne ungültige SVG-Werte |
| Erledigt | W-03, W-04, W-05, W-10, W-14, W-20, W-22 | `89af11e` – Katalog-, Shell-, Overlay-, Kontext-, Gate-, Live-Region- und ARIA-Zustand |
| Erledigt | W-06, W-07, W-08 | `702964c` – Adress-, Buchungs- und Persistenzvalidierung |
| Erledigt | W-09, W-11 | `352a629` – stabiler Grundriss-Teilbaum und wiederherstellbare Galerie-Deep-Links |
| Erledigt | W-13 | `35be434` – einheitlicher Frauenanteil von 52 Prozent |
| Erledigt | W-15, W-16 | `75dc977` – dokumentrelative Anchor-Navigation und erhaltener Suchkontext |
| Erledigt | W-17, W-18 | `81a7e2f` – belastbarer CDP-Lebenszyklus und standardmässig schreibgeschützte Asset-Skripte |
| Erledigt | W-19 | `b5213ad` – expliziter Besitz von Karten, Observern, Tabellen und Listenern |
| Erledigt | W-21 | `39c7986` – ein lokaler Kalenderstempel für Datum, Historie und Referenzjahr |
| Erledigt | C-08 | `3d0992a` – korrekte Template-Regex und arbeitsverzeichnisunabhängiger BPMN-Test |
| Erledigt | K-05 | `05ca43f` – routenabhängige und alleinige Ladeverträge für Datenunterseiten |
| Erledigt | K-06 | `5ecaa98` – paralleles Prozessladen und ein vorbereiteter Buchungskontext pro Render |
| Erledigt | K-09 | `538975d` – portable Skriptpfade, klassifizierte Altproben und isolierbare Review-Ausgaben |
| Erledigt | C-04 | `b480181` – vollständige Runtime-Dokumentation und wahrheitsgetreue 58-/57-State-Artefaktmetadaten |
| Offen – Publikationsentscheid | W-01, W-02 | Q-01 bis Q-04, Positivliste und Medienfreigaben fehlen; Entfernung aus der History benötigt separate ausdrückliche Genehmigung |
| Offen – fachliche Quelle | W-12 | Q-01 ist offen; ohne kanonische Quelle darf BGF/NGF nicht technisch überschrieben werden |

| Verifikation nach Phase 5 | Ergebnis |
| --- | --- |
| Vollständige funktionale Suite | 28 von 28 `test-*.mjs` bestanden; Laufzeit 278.9 Sekunden |
| JavaScript-Syntax | 126 von 126 `.js`-/`.mjs`-Dateien bestehen `node --check` |
| Routen und Redirects | 37 Routen und 13 Redirects bestanden innerhalb von `test-routes.mjs` |
| C-08-Portabilität | `test-process-docs.mjs` besteht auch mit `scripts/` statt Repository-Root als Arbeitsverzeichnis |
| K-09-Portabilität | Sechs historische Dry-Run-/Prüfwerkzeuge und acht geänderte Browserproben liefen aus einem Unterverzeichnis; kein entwicklerspezifischer Checkout-Pfad bleibt |
| C-04-Artefakte | Isolierter Accessibility-Lauf: 58 von 58 Zuständen, null Befunde; erhaltener Audit 57 × 3 = 171 und Screenshot-Paar 171/171 konsistent |
| Gezielte neue Regressionen | Monatsachse, UI-State, Galerie/Grundriss, Anchor-/Suchzustand, Prozessdatum, exakte Datenrouten-Ladeverträge, unabhängige Prozessladefehler sowie Buchungskontext/Verfügbarkeits-Recheck bestanden |

### 1.2 Prüfumfang und Baseline

Alle 60 JavaScript-Module unter `js/`, alle 62 Skripte unter `scripts/`, die HTML-/CSS-Einstiegspunkte, 30 Datenquellen, 18 BPMN-Dateien, statische Assets sowie die erreichbare Git-History wurden geprüft. Ein abgebrochener technischer Rohreview mit 101 Hinweisen diente nur als Suchliste: 84 Hinweise waren am aktuellen Stand noch beobachtbar, darunter Duplikate; 8 waren bereits behoben oder veraltet; 9 waren ohne fachliche Entscheidung nicht verifizierbar. Jeder übernommene Befund wurde am aktuellen `HEAD` erneut gelesen oder ausgeführt und anschliessend dedupliziert.

| Prüfung | Rohresultat |
| --- | --- |
| JavaScript-Syntax | 122 von 122 `.js`-/`.mjs`-Dateien bestehen `node --check` |
| Strukturierte Daten | 32 JSON-/GeoJSON-Dateien und 18 BPMN-XML-Dateien lassen sich parsen |
| Reine Datentests | `test-data-integrity` und `test-search` bestehen |
| Browser-Suiten | 19 von 21 Suiten bestehen bei Einzelaufruf; `building-create` hängt an nicht erreichbaren externen Tiles, `tenancies` wartet fest 2.5 s auf eine asynchron geladene Karte und meldet zu früh einen Fehler |
| Routen | 37 Routen und 13 Redirects wurden durchlaufen |
| Hauptpfade | Dashboard, Kataloge, Dokumente, Portfolio, Mietflächen, Prozesse, Metadaten, Shop, Raumbuchung und Formular-Apps wurden im Browser geprüft |
| Linter, Typprüfung, Build, `npm audit` | Nicht konfiguriert; es gibt weder `package.json` noch Lockfile. Es wurde nichts nachgerüstet |
| Secret-Suche | Keine bekannten AWS-, GitHub-, Slack-, OpenAI-, Google-, JWT-, PEM- oder vergleichbaren Secret-Formate im aktuellen Baum oder in den 112 erreichbaren Commits gefunden; patternbasierter Negativbefund |

Zwei Browserfehler sind Testwerkzeug- statt Produktfehler: Die Gebäudeerfassung benötigt externe Karten-/Adressdienste, und die Mietflächenkarte war im direkten Zeitprofil nach rund einer Sekunde vorhanden. Die festen Testannahmen stehen als W-17 im Review.

### 1.3 Repo- und Laufzeitmetriken

| Messgrösse | Wert am Review-Baseline-Commit |
| --- | ---: |
| Getrackte Dateien | 939 |
| Arbeitsbaum | rund 184 MiB |
| `docs/` | 135.23 MiB |
| `docs/review-assets/` | 344 Dateien, 133.77 MiB; davon 342 PNGs |
| `assets/` | 418 Dateien, 46.72 MiB |
| JavaScript und MJS | 122 Dateien, 25'519 physische Zeilen |
| `css/app.css` | 4'249 Zeilen, 301'019 Byte |
| `css/tokens.css` | 413 Zeilen, 23'643 Byte |
| Grösste JS-Datei | `js/components.js`, 2'146 Zeilen, rund 125 KiB |
| Weitere grosse Module | `room-booking.js` 1'068, `tenancies.js` 970, `portfolio.js` 812, `metadata-catalog.js` 792 Zeilen |
| Initialer statischer Pfad | rund 180 KiB Brotli für HTML, CSS, Boot-JS und die vier eager geladenen Datendateien; kein erzeugtes Bundle |
| Runtime-Bibliotheken | MapLibre GL 4.7.1, Swagger UI 5.17.14, bpmn-js 17.11.1, jeweils lazy von `unpkg.com` |

## 2. Architekturbild

### 2.1 Einstieg und Datenfluss

| Stufe | Verantwortung | Daten- und Zustandsfluss |
| --- | --- | --- |
| `index.html` | Statischer Einstieg, globale Styles und Mount-Punkte | Lädt `js/app.js` als ES Module |
| `js/app.js` | Bootstrapping | Lädt Core und Prozess-Engine, danach Shell und Router |
| `js/core.js` | Datenzugriff und Domänen-Lookups | Lädt `services` und `reference-data` eager; weitere JSON-/GeoJSON-Dateien lazy |
| `js/process-engine.js` | Mock-Prozessdefinitionen und -instanzen | Lädt Definitionen und Seed-Instanzen; verbindet sie mit lokal gespeicherten Vorgängen |
| `js/router.js` | Hash-Routing und Lebenszyklus | Ordnet neun Seitenbereiche und 16 Apps dynamischen Imports zu; erstellt `ctx` mit `mount`, Query, Core, Engine, Session, Komponenten und `onUnmount` |
| `js/shell.js` | Header, Hauptnavigation, Mobile-Menü, Session-Chrome | Reagiert auf Session und Navigation, ersetzt Teile der Shell |
| `js/components.js` | HTML-Bausteine und `wire*`-Verhalten | Rendert Strings, bindet Events und liefert teilweise Teardown-Funktionen |
| `js/pages/*` | Öffentliche Inhalts- und Katalogseiten | Liest Hash-/Query-Zustand, filtert Core-Daten und rendert in den Haupt-Mount |
| `js/apps/*` | Fachliche Mock-Anwendungen | Hält lokalen Modul-/DOM-Zustand, nutzt Core, Engine, Storage, Karten und Viewer |
| `data/*`, `assets/*` | Statische Daten und Medien | Werden über `fetch` oder direkte Asset-URLs gelesen |
| `scripts/*` | CDP-Browsertests, Daten-/Asset-Generatoren und ältere Diagnoseproben | Liegt ausserhalb der Anwendung; keine zentrale Task- oder Build-Definition |

Der normale Ablauf ist `Hash → Router → dynamischer Import → render(ctx) → DOM/Event-Bindung`. Beim nächsten Routenwechsel führt der Router registrierte `onUnmount`-Callbacks aus. Der lokale Importgraph umfasst 60 Module und 137 statisch bestimmbare Importkanten; es wurde kein Zyklus gefunden. Mehrere Fehler entstehen dort, wo Timer, globale Listener, Observer, Karten oder lokale Redraws den Lebenszyklusvertrag umgehen.

### 2.2 Zustand

| Ort | Inhalt | Schreibende Stellen |
| --- | --- | --- |
| URL-Hash und Query | Route, Filter, Suche, Register, ausgewähltes Objekt oder Bild | Router, Katalogseiten, Apps, Galerie |
| `localStorage` | Mock-Session, Vorgänge, Warenkorb, Favoriten, Suchhistorie | `session.js`, `process-engine.js`, `shop.js`, `favorites.js`, `search-log.js` |
| `sessionStorage` | Scrollpositionen | `router.js` |
| Modulvariablen | Karteninstanzen, Loader-Promises, Redraw-Zustand | Karten-, Viewer-, Chart- und App-Module |
| DOM | Filterzustand, Expanded-State, aktive Tabs, Formulardaten | `components.js`, `shell.js`, einzelne Apps |

Es gibt drei konkurrierende Zustandsmuster: URL als Quelle der Wahrheit, lokales `state` mit Teilrender und DOM als impliziter Zustand. Jedes Muster ist für sich verständlich. Übergänge zwischen ihnen sind jedoch nicht einheitlich validiert oder abgeräumt; daraus entstehen W-03 bis W-09 und W-19.

### 2.3 Abgleich mit dem bisherigen Review

Das bisherige Dokument vom 30. Juli 2026 war primär ein Refactoring-Tagebuch und keine aktuelle technische Bestandsaufnahme. Die darin als umgesetzt bezeichneten Bausteine `format`, `domain`, `crumbs`, `links`, `map-slot`, `renderNotFound` und `processDone` sind im aktuellen Code vorhanden. Auch der damals noch als offen bezeichnete vollständige `spatial-tree` wird inzwischen von Portfolio, Projekten und Mietflächen gemeinsam genutzt. Die früher separaten Login-Gates wurden durch das zentrale Gate in `router.js:325-340` ersetzt.

Nicht übernommen wurden historische Vorher-Zustände und alte Testresultate. Insbesondere besteht `test-portfolio` aktuell, während andere aktuelle Testschwächen vorliegen. Die noch vorhandene Katalog-Duplizierung ist als K-02 neu und enger belegt. Ein separater `catalogue-page`-Baustein wurde nie eingeführt; das Fehlen einer früher vorgeschlagenen Abstraktion ist allein kein Fehler.

## 3. Befundübersicht

Die Fundstellen und Beschreibungen beziehen sich auf den geprüften Baseline-Commit `fb9e9c2`. Der aktuelle Umsetzungsstatus und die zugehörigen Fix-Commits stehen in Abschnitt 1.1; erledigte Befunde bleiben hier als nachvollziehbarer Review-Nachweis erhalten.

| Nr. | Status | Modul | Kategorie | Kurzbeschreibung | Fundstelle |
| --- | --- | --- | --- | --- | --- |
| B-01 | Erledigt | Immobilien-Dashboard | Blocker | Monatsansicht erzeugt `NaN` in SVG-Koordinaten | `js/apps/estate.js:216-221`, `js/charts.js:167-169` |
| W-01 | Entscheid offen | Daten / Repository | Wichtig | Interne URLs und real wirkende Bundes-, Objekt- und Verantwortlichkeitsdaten liegen öffentlich vor | `data/applications.json:603-645`, `data/buildings.geojson:9-80`, `data/datasets.json:32` |
| W-02 | Entscheid offen | Medien / Lizenzierung | Wichtig | 57 von 69 Medienrecords haben kein nachgewiesenes freies Weiterverteilungsrecht | `data/media.json:37`, `scripts/adopt-pdf-images.mjs:18-80` |
| W-03 | Erledigt | Katalogzustand | Wichtig | Debounce schreibt nach einem Routenwechsel den alten Hash zurück | `js/components.js:1897-1901`, `js/components.js:1959` |
| W-04 | Erledigt | Mobile Shell | Wichtig | Logout bei offenem Menü lässt Seite `inert` und Body gesperrt | `js/shell.js:397-434` |
| W-05 | Erledigt | Overlays | Wichtig | Route- und verschachtelte Dialogwechsel räumen Overlay und Scroll-Lock falsch auf | `js/gallery.js:229-297`, `js/components.js:561-565` |
| W-06 | Erledigt | Gebäude erfassen | Wichtig | Adressauswahl bleibt nach manueller Änderung gültig; ältere Suchantworten überschreiben neuere | `js/apps/building-create.js:240-244`, `js/apps/building-create.js:338-463` |
| W-07 | Erledigt | Raumbuchung | Wichtig | Ungültige, vergangene oder unplausible Zeitfenster und Teilnehmerzahlen werden bestätigt | `js/apps/room-booking.js:84-85`, `js/apps/room-booking.js:272-289`, `js/apps/room-booking.js:583-623` |
| W-08 | Erledigt | Shop | Wichtig | Speicherfehler werden als Bestellung/Warenkorb-Erfolg gemeldet | `js/apps/shop.js:44-63`, `js/apps/shop.js:580-612` |
| W-09 | Erledigt | Mietflächen | Wichtig | Teilrender zerstört Grundriss-/Fullscreen-Zustand und bindet Tabellen neu | `js/apps/tenancies.js:855-905`, `js/apps/tenancies.js:920-948` |
| W-10 | Erledigt | Portfolio | Wichtig | Kontextlinks verwenden falsche oder zu unspezifische Query-Parameter | `js/apps/portfolio.js:446`, `js/apps/portfolio.js:652` |
| W-11 | Erledigt | Galerie | Wichtig | Geteilte Bild-URL stellt die Bildauswahl nicht wieder her | `js/gallery.js:218-226` |
| W-12 | Fachentscheid offen | Flächendaten | Wichtig | BGF/NGF widersprechen zwischen Messungen und GeoJSON systematisch | `data/area-measurements.json:4-36`, `data/buildings.geojson:49-55` |
| W-13 | Erledigt | Personal-Dashboard | Wichtig | Frauenanteil ist gleichzeitig 52 und 50,4 Prozent | `data/dashboards.json:547-548`, `data/dashboards.json:2265-2266` |
| W-14 | Erledigt | Login-Gate | Wichtig | Fünf geschützte Routen fehlen im Anwendungskatalog und erhalten ein generisches Gate | `js/router.js:101-118`, `js/router.js:325-340` |
| W-15 | Erledigt | Anchor-Navigation | Wichtig | Scroll-Spy vergleicht mount-relative `offsetTop`- mit dokumentrelativen Scrollwerten | `js/pages/anchor-nav.js:129-131`, `css/app.css:1195` |
| W-16 | Erledigt | Dienstleistungen | Wichtig | «Auch in»-Treffer werden gezählt, die Ziel-Links verlieren aber den Suchbegriff | `js/pages/services.js:52-53`, `js/pages/services.js:85-89` |
| W-17 | Erledigt | Testwerkzeug | Wichtig | Suiten können falsch bestehen, zu früh scheitern und Browserprozesse hinterlassen | `scripts/lib/cdp.mjs:65-152`, `scripts/test-login.mjs:35-42` |
| W-18 | Erledigt | Asset-Skripte | Wichtig | Alte Bildpipelines arbeiten mit überholten Annahmen und können Assets überschreiben | `scripts/build-media-registry.mjs:162-170`, `scripts/fetch-building-images.mjs:109-121`, `scripts/link-building-images.mjs:67` |
| W-19 | Erledigt | Teardown | Wichtig | Apps ignorieren Cleanup-Rückgaben für Karten, Observer, Tabellen und Listener | `js/apps/room-booking.js:473-483`, `js/apps/portfolio.js:697-700` |
| W-20 | Erledigt | Mietflächen | Wichtig | Karten- und Leerergebnis-Pfad überspringen die Live-Region-Ansage | `js/apps/tenancies.js:227-259` |
| W-21 | Erledigt | Prozess-Engine | Wichtig | «Heute» wird in UTC, die Referenz aber im lokalen Jahr berechnet | `js/process-engine.js:29-34` |
| W-22 | Erledigt | Action-Menü | Wichtig | Beim Öffnen eines zweiten Menüs bleibt der alte Trigger für Assistive Technology expanded | `js/components.js:1790-1794` |
| K-01 | Nicht begonnen | Komponenten | Komplexität | Zentrale Komponenten- und App-Module bündeln zu viele Verantwortlichkeiten | `js/components.js:1-2146`, `js/apps/room-booking.js:1-1068` |
| K-02 | Nicht begonnen | Katalogseiten | Komplexität | Filter-, Hash-, Sortier- und Paging-Abläufe liegen in mehreren Varianten vor | `js/pages/services.js:15-201`, `js/components.js:1460-1959` |
| K-03 | Nicht begonnen | Öffentliche APIs | Komplexität | Nicht verwendete Exporte und Zustands-APIs vergrössern die Oberfläche | `js/session.js:17-31`, `js/core.js:186-359`, `js/components.js:1343-2143` |
| K-04 | Nicht begonnen | Dashboards | Komplexität | Generische Immobilien-/Hero-Konfiguration ist nicht erreichbar oder driftet | `js/apps/dataportal.js:138-236`, `data/dashboards.json:1782-2392` |
| K-05 | Erledigt | Datenrouten | Komplexität | Unterrouten laden breitere Datenbereiche als sie verwenden | `js/pages/data.js:4-31`, `js/router.js:453-461` |
| K-06 | Erledigt | Wiederholte Arbeit | Komplexität | Prozessdateien laden seriell; Raumsuche berechnet Profile und Sortierungen mehrfach | `js/process-engine.js:22-44`, `js/apps/room-booking.js:151-347,1145-1163` |
| K-07 | Nicht begonnen | CSS | Komplexität | Stylesheets dienen zugleich als Review-Historie; Kommentare und tote Regeln werden ausgeliefert | `css/app.css:8-139`, `css/app.css:3030-3103` |
| K-08 | Nicht begonnen | Repository | Komplexität | Binäre Review-Screenshots dominieren Grösse und History | `docs/review-assets/audit.json:1`, `docs/review-assets/accessibility.json:1` |
| K-09 | Erledigt | Skripte | Komplexität | Diagnoseproben enthalten lokale Windows-Pfade und überlappende Einmalwerkzeuge | `scripts/check-hero.mjs:3`, `scripts/check-services.mjs:30` |
| K-10 | Nicht begonnen | Registries | Komplexität | Core- und Router-Metadaten werden in parallelen Tabellen über denselben Schlüsselraum geführt | `js/core.js:17-72`, `js/router.js:81-118` |
| P-01 | Ausserhalb Runde | Supply Chain | Produktionsrelevant | CDN-Code läuft ohne SRI; eine restriktive CSP fehlt | `index.html:3-13`, `js/buildings-map.js:20-28` |
| P-02 | Ausserhalb Runde | Web Storage | Produktionsrelevant | Storage-Zugriffe und korrupte gespeicherte Werte sind nicht durchgehend abgesichert | `js/router.js:299-311`, `js/search-log.js:23-50` |
| P-03 | Ausserhalb Runde | Datenloader | Produktionsrelevant | Loader prüfen Schemas nur grob und bündeln parallele gleiche Requests nicht | `js/core.js:200-206`, `js/dashboard-data.js:21-47` |
| P-04 | Ausserhalb Runde | CSV-Export | Produktionsrelevant | Zellen mit Formelpräfix werden nicht neutralisiert | `js/export.js:34` |
| P-05 | Ausserhalb Runde | URL-Zustand | Produktionsrelevant | Vererbte Objekteigenschaften können als gültiger Störungstyp interpretiert werden | `js/apps/fault-report.js:70-114` |
| P-06 | Ausserhalb Runde | Trust Boundaries | Produktionsrelevant | Einige Hrefs und externe Label gelangen ohne passenden Kontext-Check in Markup | `js/router.js:226-239`, `js/apps/building-create.js:32-61` |
| P-07 | Ausserhalb Runde | Datumsformatierung | Produktionsrelevant | Reine ISO-Daten können westlich von UTC am Vortag erscheinen | `js/format.js:32-35` |
| P-08 | Ausserhalb Runde | Bildauslieferung | Produktionsrelevant | Grosse Originalbilder werden ohne Derivate oder `srcset` ausgeliefert | `data/media.json:20,43`, `assets/images/` |
| P-09 | Ausserhalb Runde | Diagramm-Randfall | Produktionsrelevant | Ein vollständig leerer Pie-Chart zeigt intern ein Total von 1 | `js/charts.js:317-350` |
| C-01 | Nicht begonnen | Escaping | Kosmetisch | Bereits escapte Texte werden in Hero und Einheiten nochmals escaped | `js/hero-mosaic.js:21-27`, `js/components.js:1386` |
| C-02 | Nicht begonnen | Router | Kosmetisch | Gate-, 404- und Fehlerpfade teilen Scroll-/Fokus-Finalisierung nicht | `js/router.js:325-342`, `js/router.js:409-494` |
| C-03 | Nicht begonnen | URL-Verarbeitung | Kosmetisch | `URLSearchParams` wird teils nochmals decodiert; IDs werden teils roh angezeigt | `js/apps/metadata-catalog.js:75-76`, `js/pages/services.js:57-141` |
| C-04 | Erledigt | Dokumentation | Kosmetisch | README, Review-Matrix und Kommentare beschreiben Runtime und Routenstand unvollständig oder veraltet | `README.md:31-37`, `docs/accessibility-review.md:5-16` |
| C-05 | Nicht begonnen | CSS-Details | Kosmetisch | Nicht animierbare Max-Height-Regel, Farbdrift und doppelte Deklarationen bleiben | `css/app.css:697-702`, `css/app.css:2107`, `css/app.css:3810` |
| C-06 | Nicht begonnen | Suche | Kosmetisch | Hash-Ersetzung schreibt denselben Wert ohne Wirkung erneut | `js/search-suggest.js:71` |
| C-07 | Nicht begonnen | Datenlabels | Kosmetisch | Papier-Dashboard deklariert eine leere Recycling-Spalte; Taglabels sind technisch | `data/dashboards.json:652`, `data/catalog-labels.json:36-37` |
| C-08 | Erledigt | Tests | Kosmetisch | Template-Regex verliert `\s`; BPMN-Test hängt vom aktuellen Arbeitsverzeichnis ab | `scripts/lib/cdp.mjs:208-210`, `scripts/test-process-docs.mjs:28-31` |

## 4. Systemische Befunde

| Thema | Beobachtung | Konsequenz | Zugehörige Befunde |
| --- | --- | --- | --- |
| Lebenszyklus ohne durchgehenden Besitz | `onUnmount` ist etabliert, aber Timer, globale Overlays, lokale Redraws, Observer und Karten umgehen ihn. Ein boolescher Body-Lock kann zudem keine verschachtelten Besitzer darstellen. | Schnelle Navigation oder wiederholtes Öffnen erzeugt stale State, gesperrte Seiten und Listener-Leaks. | W-03, W-04, W-05, W-09, W-19, W-22 |
| URL und lokaler State konkurrieren | Kataloge und Apps schreiben teils in den Hash, teils in lokales `state`, teils nur ins DOM. Validierung geschieht nicht an einer gemeinsamen Grenze. | URL-Parameter können alte Auswahl, ungültige Werte oder falsche Kontextlinks erzeugen. | W-06, W-07, W-10, W-11, P-05 |
| Datenherkunft ist nicht als Publikationsvertrag geführt | Datensätze mischen synthetische, generierte, offizielle und intern wirkende Angaben. Medien führen verschiedene Quellen, aber keinen belastbaren Freigabestatus. | Technische Reviews können Vertraulichkeit und Lizenzlage nicht aus dem Code entscheiden; die öffentliche History konserviert Fehlpublikationen. | W-01, W-02, W-12, W-13, Q-01 bis Q-04 |
| Tests prüfen häufig indirekte Signale | Einige Suiten authentisieren bereits im Setup, verwenden feste Wartezeiten oder verifizieren tote IDs. CDP-Cleanup ist bei Fehlerpfaden unvollständig. | Grün und Rot sind nicht in allen Suiten belastbar; lokale Läufe hinterlassen Ressourcen. | W-17, C-08 |
| Review-Historie liegt im Produktartefakt | Ausführliche Vorher-/Nachher-Kommentare stehen in ausgeliefertem CSS; komplette Screenshot-Matrizen liegen in Git. | Kommentare können erneut driften, CSS-Transfer und Clone-Grösse steigen. C-04 gleicht den aktuellen Dokumentationsstand ab; K-07 und K-08 bleiben offen. | K-07, K-08, C-04 |

## 5. Befunde im Detail

Aufwandsskala: **XS** unter 2 Stunden, **S** bis 0.5 Tag, **M** 1–2 Tage, **L** 3–5 Tage, **XL** über 5 Tage oder mit externer Freigabe. Die Schätzung umfasst Änderung und gezielte Regressionstests, nicht fachliche Entscheidungszeit.

### 5.1 Blocker

| Nr. | Status | Fundstelle | Ist, Auswirkung und Bedingung | Empfohlene Massnahme | Aufwand |
| --- | --- | --- | --- | --- | ---: |
| B-01 | Erledigt | `js/apps/estate.js:216-221`; `js/charts.js:167-169` | Die Monatsaggregation liefert Monatskeys als Strings, die Chart-Skalierung behandelt sie als numerische X-Werte. Unter `#/app/dataportal/immobilien?tab=entwicklung&gran=monat` entstehen 96 ungültige `cx`-Werte und drei SVG-Pfade mit `NaN`; die Entwicklung wird sichtbar falsch oder gar nicht gezeichnet. Im Browser reproduziert. | Monatswerte vor dem Chart in eine definierte numerische oder Datumsskala normalisieren; leere/ungültige Punkte abweisen; Monats- und Jahresansicht im Browser prüfen. | S |

### 5.2 Wichtig

| Nr. | Status | Fundstelle | Ist, Auswirkung und Bedingung | Empfohlene Massnahme | Aufwand |
| --- | --- | --- | --- | --- | ---: |
| W-01 | Entscheid offen | `data/applications.json:603-645,732,756,776,1148`; `js/knowledge-content.js:24,220`; `data/datasets.json:32`; `data/api-specs.json:7,193`; `data/buildings.geojson:9-80`; `scripts/add-research-buildings.mjs:1-2,163,206-211` | Das öffentliche Repo enthält eingeschränkte oder interne GIS-, CDE-, eGate-, Confluence-, DTI- und Archimap-Ziele sowie offizielle Kataster-/Objektkennungen, EGRID, CHF-Werte und benannte Verantwortlichkeiten. Die Werte sind in erreichbaren Commits enthalten. Die 728 Raumlayouts sind dagegen nachweislich generiert und wurden nicht als reale Räume eingestuft. | Veröffentlichung sofort fachlich und datenschutzrechtlich inventarisieren; nicht freigegebene Werte durch klar synthetische Fixtures ersetzen; für bereits publizierte Werte eine History-/Rotation-Strategie festlegen. | L–XL |
| W-02 | Entscheid offen | `data/media.json:37`; `scripts/adopt-pdf-images.mjs:18,76,80` | 57 von 69 Records verweisen auf BBL-Mediadatenbank oder interne Dokumentquellen statt auf eine freie Lizenz; betroffen sind 41 eindeutige Dateien. Sechs Records tragen bereits `reviewNeeded`. Im öffentlichen MIT-Repo ist das Weiterverteilungsrecht nicht belegt. | Für jedes Medium Lizenz, Rechteinhaber und Freigabe dokumentieren; ungeklärte Dateien aus öffentlicher Auslieferung und History entfernen oder durch frei lizenzierte Assets ersetzen. | L–XL |
| W-03 | Erledigt | `js/components.js:1897-1901,1959` | `wireCatalogueState` räumt seinen Debounce-Timer beim Unmount nicht auf. Reproduktion: in Mietflächen «Bern» tippen und innerhalb von 40 ms zu Dienstleistungen wechseln; danach zeigt die Seite Dienstleistungen, der Hash springt jedoch auf `#/app/tenancies?q=Bern` zurück und wirft im alten Callback. | Timer in die Teardown-Funktion aufnehmen; vor Commit zusätzlich Mount-/Routenidentität prüfen. | XS |
| W-04 | Erledigt | `js/shell.js:397-434` | Wird bei offenem Mobile-Menü ausgeloggt, ersetzt die Shell den Header, normalisiert aber den Body-Zustand nicht. Reproduziert: neuer Burger meldet `aria-expanded=false`, während `body` die Menüklasse behält und `main`/Footer `inert` bleiben. | Vor jedem Shell-Redraw den mobilen Overlay-Zustand zentral schliessen; Body-Klasse, `inert`, Fokus und Triggerzustand gemeinsam zurücksetzen. | S |
| W-05 | Erledigt | `js/gallery.js:229-237,265-297`; `js/doc-viewer.js:151-158,283-300`; `js/components.js:561-565` | Galerie und Dokumentbetrachter besitzen globale Listener und Body-Lock ausserhalb des Router-Teardowns. Eine Galerie bleibt nach Hash-Navigation über der neuen Seite. Galerie → Teilen → Teilen schliessen lässt die Galerie sichtbar, entsperrt aber bereits den Body, weil der Lock nur boolesch ist. Beides im Browser reproduziert. | Overlays als besitzende Instanzen mit idempotentem `close()` registrieren; Body-Lock referenzzählen oder stackbasiert führen; alle Route-Unmounts schliessen. | M |
| W-06 | Erledigt | `js/apps/building-create.js:240-244,261-267,338-344,371-379,442-463` | Die Validierung prüft nur `state.lat`. Nach Auswahl einer Adresse kann der Text geändert werden, ohne Auswahl und Koordinaten zu invalidieren; der nächste Schritt übernimmt die alte Adresse. Eine Kartenwahl kann Koordinaten ohne gültige Adresse setzen. Langsame ältere Suchantworten dürfen zudem neuere überschreiben; nach Fehlern geht der getippte Wert teilweise verloren. Im Browser mit verzögerten Antworten reproduziert. | Adresse als zusammengehöriges Objekt mit Query-Version führen; manuelle Textänderung invalidiert die Auswahl; Requests abbrechen oder sequenzieren; Validierung verlangt sichtbare Adresse und Koordinaten derselben Auswahl. | M |
| W-07 | Erledigt | `js/apps/room-booking.js:84-85,122-128,213-216,272-289,583-623` | Datum und Zeiten werden nur formal gelesen. `date=2020-01-01&start=99:00&end=99:30` kann als bestätigte Buchung persistiert werden. Leere, null-, negative oder nicht numerische Teilnehmerwerte werden vor der Fehlerprüfung auf 1 normalisiert. Im Browser reproduziert. | Eine gemeinsame Slot-Validierung für Query, Verfügbarkeit und Submit einführen: reales Datum, nicht vergangen, gültige Uhrzeit, Ende nach Start, Kapazität und ganzzahlige Teilnehmerzahl. | M |
| W-08 | Erledigt | `js/apps/shop.js:44-63,580-612` | Der Shop ignoriert den Rückgabewert der Storage-Schreibvorgänge. Bei simuliertem `localStorage`-Fehler erscheint eine Erfolgsmeldung; beim Checkout kann die Bestellung als erfolgreich gelten, obwohl der Warenkorb bestehen bleibt. Im Browser reproduziert. | Persistenz atomar behandeln: erst Erfolg anzeigen und lokalen State leeren, wenn Schreiben/Entfernen bestätigt ist; bei Fehlschlag Warenkorb erhalten und Fehler melden. | S |
| W-09 | Erledigt | `js/apps/tenancies.js:855-905,920-948` | Ein Tabellen-/Filter-Redraw mountet alle versteckten Tabellen neu und verwirft Grundriss- sowie Fullscreen-Zustand. Teardown-Rückgaben der Grundrissverdrahtung werden nicht gehalten. Normale Filter-/Ansichtswechsel können deshalb die aktuelle Arbeit zurücksetzen und Handler vervielfachen. | Nur sichtbaren Teilbaum aktualisieren oder vor Redraw alle Teil-Teardowns ausführen; Fullscreen und Auswahl als expliziten State erhalten. | M |
| W-10 | Erledigt | `js/apps/portfolio.js:446,652`; `js/apps/media-library.js:91-105`; `js/apps/document-archive.js:52-60` | Der Medienlink schreibt `building=`, die Medienbibliothek liest für Objektkontext aber `objekt`. Der Dokumentlink verliert den vorhandenen Gebäudekontext vollständig. Nutzer landen in einer generischen oder leeren Ansicht. Statisch verifiziert. | Kontextlinks über zentrale Link-Builder mit den von den Zielrouten gelesenen Parametern erzeugen; Deep-Link-Regressionsfälle ergänzen. | XS |
| W-11 | Erledigt | `js/gallery.js:218-226`; `js/apps/portfolio.js:702`; `js/apps/tenancies.js:876-877`; `js/apps/projects.js:487-488` | Die Galerie schreibt die Bild-URL beim Teilen, liest sie beim erneuten Laden aber nicht konsistent als Auswahl. Der geteilte Link öffnet die Seite, nicht zuverlässig das geteilte Bild. | Einen gemeinsamen Galerie-Deep-Link-Vertrag definieren und beim Mount auswerten; unbekannte Bild-IDs neutral behandeln. | S |
| W-12 | Fachentscheid offen | `data/area-measurements.json:4-36,804-836`; `data/buildings.geojson:49-55,893-899` | Bei allen elf gemeinsam geprüften Bestandsobjekten weichen BGF und NGF zwischen Messdatei und GeoJSON ab. HNF ist für zehn dieser Objekte in beiden Quellen vorhanden und stimmt in allen zehn Vergleichen. Ansichten können je Datenpfad trotzdem andere BGF-/NGF-Werte zeigen. Kein fachlich führender Datensatz ist dokumentiert. | Eine Quelle als kanonisch festlegen und die zweite generieren oder im Integritätstest objektweise abgleichen. Vor Korrektur Q-01 klären. | M |
| W-13 | Erledigt | `data/dashboards.json:547-548,2186,2190-2191,2265-2266` | Dasselbe Personal-Dashboard nennt den Frauenanteil als 52 und 50,4 Prozent; der Lead sagt zugleich «knapp die Hälfte». Die Vorführung widerspricht sich innerhalb einer Seite. | Kennzahl aus einer gemeinsamen Datenzelle ableiten und Text/Visualisierung darauf referenzieren. | XS |
| W-14 | Erledigt | `js/router.js:101-118,325-340`; `data/applications.json` | `space-request`, `fault-report`, `transaction`, `api-docs` und `building-create` besitzen keinen passenden Katalogeintrag für das zentrale Login-Gate. Ausgeloggte Nutzer sehen deshalb die Überschrift «Anwendung» und einen generischen Rückweg statt Dienst-/App-Namen. Im `test-tabs`-Lauf beobachtet. | Gate-Metadaten in der Routentabelle vollständig deklarieren oder aus Service-/App-Daten auflösen; Überschrift und Rückweg je Route prüfen. | S |
| W-15 | Erledigt | `js/pages/anchor-nav.js:129-131`; `css/app.css:1195` | Der Scroll-Spy vergleicht `section.offsetTop`, das sich auf den positionierten Haupt-Mount bezieht, mit dokumentrelativem `window.scrollY`. Der Versatz des Mounts fehlt; dadurch kann der aktive Anker beim Scrollen falsch markiert werden. | Abschnittsposition und Scrollwert im selben Koordinatensystem berechnen; aktive Sektion an Ober-/Unterkante testen. | S |
| W-16 | Erledigt | `js/pages/services.js:52-53,85-89` | Die Seite zählt Anwendungen und Dokumente, die zum aktuellen Suchtext passen. Die erzeugten Links führen jedoch nur auf `#/applications` beziehungsweise `#/app/document-archive` und übernehmen `q` nicht. Nutzer sehen am Ziel die ungefilterte Übersicht statt der angekündigten Treffer. Statisch verifiziert. | Ziel-Hashes mit demselben normalisierten Suchbegriff erzeugen und die Trefferzahl gegen die Zielansicht prüfen. | XS |
| W-17 | Erledigt | `scripts/lib/cdp.mjs:65-82,102-152`; `scripts/test-login.mjs:35-42`; `scripts/test-tenancies.mjs:95-102`; `scripts/check-services.mjs:30` | `openPage` authentisiert standardmässig, weshalb `test-login` den ausgeloggten Einstieg nicht wirklich prüft. Mietflächen wartet fest 2.5 s auf die CDN-Karte und scheitert, obwohl sie kurz danach vorhanden ist. Mehrere ältere Proben rufen asynchrone `problems()`-Funktionen ohne `await` auf. Fehlerpfade schliessen Edge-/Node-Helfer nicht zuverlässig; ein Review-Lauf hinterliess 91 Prozesse. | Auth-Zustand je Test explizit setzen; auf beobachtbare DOM-Bedingungen statt feste Zeit warten; Test-Entrypoints `await`en; Browserbesitz in `try/finally` schliessen und Child-Prozesse mitverfolgen. | M |
| W-18 | Erledigt | `scripts/build-media-registry.mjs:162-170`; `scripts/fetch-building-images.mjs:109-121`; `scripts/link-building-images.mjs:67` | Drei ältere Bildpipelines teilen Dateinamen-/Pfadannahmen nicht mit dem aktuellen Medienbestand und schreiben oder benennen Dateien in produktiven Asset-/Datenverzeichnissen um. Nur die Registry bietet einen optionalen `--pruefen`-Modus; ohne Flag ist Schreiben der Standard. Ein versehentlicher Lauf kann Zuordnungen oder Dateien überschreiben. | Skripte als historisch sperren oder entfernen; verbleibende Pipeline standardmässig auf Dry-Run stellen und erst mit explizitem Schreib-Flag, Ziel und Konsistenzprüfung mutieren lassen. | M |
| W-19 | Erledigt | `js/apps/room-booking.js:473-483,717-735`; `js/apps/dataportal.js:198-229`; `js/apps/estate.js:401-425`; `js/apps/portfolio.js:697-700`; `js/pages/my-cases.js:55`; `js/pages/home.js:209` | Karten im Buchungsdialog werden bei normalem Schliessen nicht freigegeben; Observer-, Tabellen- und Zeilen-Teardowns werden an mehreren Stellen verworfen. Nach wiederholtem Öffnen/Redraw bleiben Ressourcen und Listener aktiv. Karten-Cleanup wurde mit instrumentiertem `remove()` reproduziert. | Einheitlichen Teardown-Sammler pro Mount/Teilrender einsetzen; jede `wire*`-Funktion liefert idempotenten Cleanup; bei Dialogschluss und Redraw ausführen. | L |
| W-20 | Erledigt | `js/apps/tenancies.js:227-259` | Sowohl die Kartenansicht bei Zeile 234 als auch der Leerergebnis-Pfad bei Zeile 244 kehren vor `announceCatalogue()` zurück. Sehende Nutzer sehen Karte oder Leerzustand, Screenreader erhalten für beide Bedingungen keine aktualisierte Trefferansage. | Statusansage vor die gemeinsamen Rücksprungpunkte ziehen oder alle Pfade über ein gemeinsames Render-Finale führen. | XS |
| W-21 | Erledigt | `js/process-engine.js:29-34` | Das Prozessdatum verwendet `toISOString()` in UTC, die Referenznummer `getFullYear()` in Lokalzeit. In der Schweiz zwischen lokaler Mitternacht und 01:00 beziehungsweise 02:00 kann das Datum am Vortag liegen; um den Jahreswechsel können Datum und Referenzjahr auseinanderfallen. | Lokales Kalenderdatum einmal berechnen und für Datum sowie Jahr verwenden; Grenzfälle um Mitternacht/Jahreswechsel testen. | XS |
| W-22 | Erledigt | `js/components.js:1790-1794` | Beim Öffnen eines zweiten Action-Menüs wird das erste visuell geschlossen, sein Trigger behält aber `aria-expanded="true"`. Assistive Technology meldet einen Zustand, der nicht mehr existiert. | Beim Schliessen jedes alten Menüs auch dessen Trigger normalisieren und Fokusbesitz klar halten. | XS |

### 5.3 Komplexität

| Nr. | Status | Fundstelle | Ist, Auswirkung und Bedingung | Konkrete Vereinfachung | Aufwand |
| --- | --- | --- | --- | --- | ---: |
| K-01 | Nicht begonnen | `js/components.js:1-2146`; `js/apps/room-booking.js:1-1068`; `js/apps/tenancies.js:1-970`; `js/apps/portfolio.js:1-812` | Rendering, Zustandsreduktion, Event-Bindung und Teardown liegen in denselben sehr grossen Modulen. Änderungen an Katalog- oder Overlay-Verhalten berühren weit auseinanderliegende Abschnitte. | `components.js` nach Dialog/Overlay, Katalog/Tabelle und Formularfluss schneiden; App-spezifische Reducer/Validatoren als reine Funktionen auslagern. Keine neue Runtime-Abhängigkeit. | L |
| K-02 | Nicht begonnen | `js/pages/services.js:15-201`; `js/pages/applications.js`; `js/pages/catalog.js`; `js/pages/search.js`; `js/apps/media-library.js`; `js/components.js:1460-1959` | Die Seiten teilen denselben Ablauf Hash lesen → filtern → sortieren → paginieren → Pills → Verdrahtung, führen aber lokale Varianten und mit `wireCatalogueState` einen zweiten Commit-Pfad. Das erhöht Drift und erschwert Fixes wie W-03. | Kleine gemeinsame Zustandsreduktion und einen Commit-Adapter für Hash versus lokalen State extrahieren; Seiten behalten Card-, Facet- und Textlogik. Q-05 vor Umbau klären. | L |
| K-03 | Nicht begonnen | `js/session.js:17-31`; `js/links.js:19-24`; `js/crumbs.js:16`; `js/core.js:186,359`; `js/process-engine.js:107-120`; `js/components.js:1343-1352,2015-2143` | Listener-API, Link-/Crumb-Konstanten, Core-Zustände, Engine-Methoden und Komponentenexporte haben keine externen Aufrufer oder sind nur intern. Die öffentliche Oberfläche suggeriert nicht vorhandene Verträge. | Verwendungen mit statischer Suche/Importgraph bestätigen; ungenutzte Exporte entfernen oder intern machen; Engine-/Core-Diagnostik nur behalten, wenn ein konkreter Konsument benannt ist. | M |
| K-04 | Nicht begonnen | `js/apps/dataportal.js:138-236`; `data/dashboards.json:1782-2392` | Generische Immobilienkarten-/Dashboard- und Hero-Konfiguration wird von den aktuellen Routen nicht erreicht oder parallel zur spezialisierten `estate.js`-Ansicht gepflegt. Daten und Texte können unbemerkt driften. | Pro Dashboard genau einen Renderer und eine Datenform festlegen; unerreichbare Konfiguration nach Routen-/Screenshotprüfung entfernen. | M |
| K-05 | Erledigt | `js/pages/data.js:4-31`; `js/router.js:453-461`; `scripts/test-route-needs.mjs` | Jede Datenunterroute lud Anwendungen und Datensätze, auch wenn nur eine Teilansicht benötigt wurde; deklarierte `needs` waren teils unvollständig oder ohne Wirkung. Die Datenmenge ist heute klein, der Vertrag blieb aber irreführend. | `needs` ist jetzt die einzige Ladebeschreibung und deklariert pro Route nur tatsächlich verwendete Keys; kalte Seitenkontexte prüfen den Vertrag. | S |
| K-06 | Erledigt | `js/process-engine.js:22-44`; `js/apps/room-booking.js:151-347,1145-1163`; `scripts/test-process-dates.mjs`; `scripts/test-room-booking.mjs` | Prozessdefinitionen und Instanzen luden unabhängig, aber seriell. Die Raumsuche berechnete Profil, Sortierung und `engine.instances()` wiederholt innerhalb der Raumiteration. Bei den kleinen Fixtures war das nicht spürbar, erschwerte aber die Logik. | Unabhängige Prozessdateien laden jetzt mit `Promise.allSettled`; ein Buchungskontext pro Render bündelt Räume, Profile, Favoriten und Belegungen, während Aktionen frisch nachprüfen. | S |
| K-07 | Nicht begonnen | `css/app.css:8-139,517-519,3030-3103`; `css/tokens.css:23-143` | 45.3 Prozent der beiden CSS-Dateien sind Kommentare. Gzip-Grösse: 97'488 Byte mit, 31'198 Byte ohne Kommentare. Mehrere Kommentare sind bereits falsch, etwa «Spinner unreferenced» trotz Nutzung; tote Chart-/Service-/Filterregeln bleiben daneben bestehen. | Kurze Warum-Kommentare im CSS behalten, Review-Chronologie in ADR/Dokument verschieben, tote Regeln entfernen und für Deployment minifiziertes CSS ausliefern. | M |
| K-08 | Nicht begonnen | `docs/review-assets/audit.json:1`; `docs/review-assets/accessibility.json:1`; `docs/review-assets/` | 342 Vorher-/Nachher-PNGs belegen 133.77 MiB und rund 72 Prozent des getrackten Baums. Zehn Hash-Duplikatgruppen sparen allein rund 1.13 MiB; die vollständige Matrix verteuert jeden Clone und die History dauerhaft. | Komplette Matrizen als CI-/Release-Artefakt speichern; in Git Manifest, Resultat-JSON und wenige repräsentative Bilder behalten. History-Bereinigung separat freigeben. | L–XL |
| K-09 | Erledigt | `scripts/check-hero.mjs:3`; weitere `check-*`-Skripte; Daten-/Bildskripte | Neun Diagnoseproben referenzieren einen lokalen `file:///C:/.../cdp.mjs`-Pfad; weitere Generatoren enthalten einen fest codierten Repository-Pfad. Überlappende Einmalproben haben keinen gemeinsamen Entrypoint oder Status. | Benötigte Proben auf relative Imports/`import.meta.url` umstellen, Dubletten archivieren oder löschen, unterstützte Skripte im README mit Zweck und Schreibwirkung listen. | M |
| K-10 | Nicht begonnen | `js/core.js:17-72`; `js/router.js:81-118` | `FILES`, `DEFERRED`, `AREA` und `OBJECT_FILES` beziehungsweise `PAGES`, `APPS` und Abschnittszuordnung beschreiben dieselben Schlüssel in parallelen Tabellen. Ergänzungen können eine Tabelle vergessen, wie W-14 zeigt. | Je Bereich eine deklarative Registry mit URL, Shape, eager/area beziehungsweise Route, Modul, Abschnitt und Gate-Metadaten verwenden; bestehende Accessoren daraus ableiten. | M |

### 5.4 Kosmetisch

| Nr. | Status | Fundstelle | Ist, Auswirkung und Bedingung | Empfohlene Massnahme | Aufwand |
| --- | --- | --- | --- | --- | ---: |
| C-01 | Nicht begonnen | `js/hero-mosaic.js:21-27`; `js/components.js:1386` | Alt-/Einheitstext wird vor Übergabe und im Zielbaustein escaped. Sichtbar werden bei entsprechenden Daten HTML-Entities statt Originalzeichen. Aktuelle Fixtures lösen es kaum aus. | Klartext als Komponentenvertrag festlegen und genau am HTML-Sink escapen. | XS |
| C-02 | Nicht begonnen | `js/router.js:325-342,409-414,434,454-494` | Login-Gate, 404 und Fehlerpfad umgehen Teile des normalen Scroll-, Fokus- und Cleanup-Finales. Die Seite funktioniert, startet aber nicht immer an derselben Position oder mit demselben Fokus. | Gemeinsames Route-Finale für Erfolg, Gate, 404 und Fehler verwenden. | S |
| C-03 | Nicht begonnen | `js/apps/metadata-catalog.js:75-76,467,633`; `js/apps/process-docs.js:157,337`; `js/pages/services.js:57,69,141` | Bereits decodierte `URLSearchParams`-Werte werden erneut decodiert; unbekannte Service-IDs erscheinen teilweise roh. Ungewöhnliche Prozentwerte können dadurch verändert oder als technische IDs gezeigt werden. | Einmaliges Decoding am Router festlegen; Anzeige unbekannter IDs über neutrale Labels führen. | XS |
| C-04 | Erledigt | `README.md:31-37`; `docs/accessibility-review.md:5-16`; `docs/review-assets/audit.json:8-78`; `docs/review-assets/accessibility.json:5-65`; `css/app.css:517-519` | README nennt nur MapLibre, obwohl Swagger UI und bpmn-js ebenfalls zur Laufzeit vom CDN kommen. Accessibility-Dokumentation behauptet zwei gleiche 57-State-Läufe, der neue Lauf enthält 58 Routen; Room Booking fehlt in der Screenshot-Matrix. Kommentare widersprechen aktuellem Code. | README und Review-Metadaten aktualisieren; Artefaktstand und bewusst fehlende Screenshots explizit nennen; falsche CSS-Kommentare entfernen. | S |
| C-05 | Nicht begonnen | `css/app.css:697-702,2107,3810` | `max-height` kann von `none` nach `0` nicht animieren; einzelne harte Farben driften von Tokens; Deklarationen und Kommentare sind mehrfach gesplittet. Kein aktueller Funktionsbruch. | Animation auf messbare Höhe/`grid-template-rows` umstellen; vorhandene Tokens nutzen; unmittelbar benachbarte Dubletten konsolidieren. | S |
| C-06 | Nicht begonnen | `js/search-suggest.js:71` | Der Code ersetzt den Hash durch denselben Wert. Das erzeugt keinen Zustandswechsel und erschwert die Absicht. | No-op entfernen oder die beabsichtigte History-Semantik explizit implementieren. | XS |
| C-07 | Nicht begonnen | `data/dashboards.json:652`; `data/catalog-labels.json:36-37` | Das Papier-Dashboard deklariert eine Recycling-Spalte ohne Zeilenwerte; `tag.tag1`/`tag.tag2` werden technisch beschriftet. | Leere Spalte entfernen oder Daten ergänzen; Tags fachlich benennen. | XS |
| C-08 | Erledigt | `scripts/lib/cdp.mjs:208-210`; `scripts/test-process-docs.mjs:28-31,155` | In Template-Strings geht `\s` in der erzeugten Regex verloren; der BPMN-Fixture-Pfad hängt vom Aufrufverzeichnis ab. Aktuelle Standardläufe funktionieren, alternative Aufrufe sind fragil. | Regex korrekt escapen; Pfad relativ zu `import.meta.url` auflösen. | XS |

### 5.5 Sicherheits- und Datenprüfung

| Bereich | Resultat |
| --- | --- |
| Secrets und Zugangsdaten | Keine bekannten Secret-Formate in aktuellem Baum oder erreichbarer History gefunden. Lokale, nicht getrackte Temp-/Browserartefakte wurden nicht als Repository-Befund behandelt und keine Werte daraus übernommen. |
| Interne und reale Daten | W-01 ist bestätigt. Die fachliche Freigabe einzelner Miet-, Kontakt- und AdminDir-Daten bleibt offen; siehe Q-01 bis Q-04. |
| Personenbezug | `data/building-contacts.json` enthält 47 real formatierte Mailadressen; einzelne Generatorbeispiele sind klar synthetisch, der Status der übrigen Einträge ist nicht belegt. |
| Medienrechte | W-02 ist bestätigt; nur 12 von 69 Records tragen eine freie oder CC0-/CC-Lizenz. |
| Screenshots | Die 342 Review-PNGs zeigen die Portal-Routenmatrix. Es wurden keine Screenshots externer Fachanwendungen und keine GPS-/Artist-/Copyright-EXIF-Felder gefunden. |
| Markup | Kein `eval`, keine Inline-Eventhandler im Einstieg und kein allgemeiner unescaped User-HTML-Sink gefunden. Die verbleibenden Trust-Boundary-Risiken stehen als P-05 und P-06. |

## 6. Produktionsrelevante Punkte

Alle Punkte in diesem Abschnitt sind **heute im Frontend-Mockup kein Problem**. Sie sind ein Vorrat für den Fall, dass echte Nutzer, Daten, Backend-Antworten oder ein produktiver Sicherheitsrahmen eingeführt werden.

| Nr. | Status | Fundstelle | Heute kein Problem, weil | Risiko bei Produktivierung | Empfohlene Massnahme | Aufwand |
| --- | --- | --- | --- | --- | --- | ---: |
| P-01 | Ausserhalb Runde | `index.html:3-13`; `js/buildings-map.js:20-28`; `js/apps/api-docs.js:39-52`; `js/apps/process-docs.js:33-54` | Die Versionen sind gepinnt und der Mockup darf extern laden. | Ausfall oder Manipulation von `unpkg.com`; eine restriktive CSP würde durch CDN- und Inline-Styles blockiert. | Bibliotheken selbst hosten oder streng allowlisten, SRI ergänzen, CSP als Header planen und Inline-Styles inventarisieren. | L |
| P-02 | Ausserhalb Runde | `js/router.js:299-311`; `js/session.js:19-20`; `js/search-log.js:23,40-50` | Browserstorage enthält nur Mock-Zustand. | `SecurityError`, Quota oder korrupte Werte können Navigation und Suchlog abbrechen; Speichermisserfolg bleibt teilweise still. | Alle Reads/Writes über eine fehlertolerante Storage-Grenze mit Schema und explizitem Resultat führen. | M |
| P-03 | Ausserhalb Runde | `js/core.js:200-206`; `js/dashboard-data.js:21-47` | Statische, kontrollierte Fixtures haben bekannte Form. | Echte APIs können Teilformen liefern; parallele gleiche Loads erzeugen doppelte Requests und inkonsistenten Cache. | Schema an der Datenquelle validieren, in-flight Promises pro Key teilen, Fehlerzustände typisieren. | M |
| P-04 | Ausserhalb Runde | `js/export.js:34` | Exportiert werden kontrollierte Mock-Daten. | Werte mit `=`, `+`, `-` oder `@` können in Tabellenprogrammen als Formeln ausgeführt werden. | Gefährliche Präfixe im CSV-Modus neutralisieren und Exportfälle testen. | XS |
| P-05 | Ausserhalb Runde | `js/apps/fault-report.js:70,96,114` | Links werden aus bekannten UI-Werten erzeugt. | `?type=toString` trifft über den Objektprototyp und führt später beim Zugriff auf Kategorien zum Fehler; manipulierte URLs genügen. | Registry mit `Map` oder `Object.create(null)` führen und `hasOwn` plus Enum-Normalisierung verwenden. | XS |
| P-06 | Ausserhalb Runde | `js/router.js:226-239`; `js/components.js:403,1296-1297`; `js/apps/building-create.js:32-61` | Zielwerte stammen aktuell aus Repository-Fixtures oder Swisstopo. | Echte externe Daten könnten Protokolle, Attribute oder Markup einschleusen. | URL-Schemes und erlaubte Hosts validieren; Text, Attribute und URLs kontextgerecht behandeln; externe Labels als Textknoten einsetzen. | M |
| P-07 | Ausserhalb Runde | `js/format.js:32-35` | Zielpublikum und Vorführung liegen in der Schweiz, östlich von UTC. | `new Date('YYYY-MM-DD')` ist UTC; in westlichen Zeitzonen erscheint das Datum am Vortag. | Reine Kalenderdaten ohne `Date`-UTC-Rundreise formatieren oder Zeitzone explizit festlegen. | XS |
| P-08 | Ausserhalb Runde | `data/media.json:20,43`; `assets/images/` | Demo-Datenmenge und Zugriffe sind klein. | 178 Bilddateien belegen rund 46 MiB, Einzeldateien bis rund 2.1 MiB; Mobilgeräte laden unnötige Bytes. | AVIF/WebP-Derivate und `srcset`/`sizes` erzeugen, Abmessungen und Lazy Loading deklarieren. | M |
| P-09 | Ausserhalb Runde | `js/charts.js:317,330-350` | Aktuelle Pie-Daten enthalten positive Werte. | Ein vollständig leerer Datensatz wird intern auf Total 1 gesetzt und kann eine irreführende Visualisierung statt «keine Daten» erzeugen. | Für Total 0 einen expliziten Leerzustand rendern. | XS |

## 7. Offene Fragen

| Nr. | Status | Frage | Warum sie vor einer Änderung beantwortet werden muss | Fundstelle |
| --- | --- | --- | --- | --- |
| Q-01 | Offen | Sind Mietflächen, Organisationseinheiten, Geschosse, Mietdaten, CHF-Beträge und Kostenstellen vollständig synthetisch oder aus echten Beständen abgeleitet? | Das Repository bezeichnet Daten teils als Sample/synthetisch, Generatoren enthalten aber real wirkende Detailkombinationen. Davon hängen W-01 und W-12 ab. | `data/tenancies.json`; `scripts/build-tenancy-data.mjs:34-64`; `docs/requirements.md`; `docs/data-model.md` |
| Q-02 | Offen | Sind die 47 Mailadressen in `building-contacts.json` und die AdminDir-IDs erfunden, anonymisiert oder reale Verzeichniseinträge? | Format und direkte AdminDir-Links erlauben keine sichere Einordnung aus dem Code. | `data/building-contacts.json:8`; `data/datasets.json:107-115`; `js/apps/metadata-catalog.js:125-126` |
| Q-03 | Offen | Ist die persönliche Gmail-Adresse aus den Git-Autorendaten für dieses öffentliche Bundes-Repository bewusst freigegeben? | Sie steht in 103 von 112 erreichbaren Commits einschliesslich `HEAD`; eine Änderung betrifft History und Identitätsrichtlinie. Die Adresse wird hier nicht erneut ausgeschrieben. | Git-History |
| Q-04 | Offen | Welche der internen/restriktiven URLs und Objektkennungen sind ausdrücklich zur öffentlichen Publikation freigegeben? | Ohne Positivliste kann W-01 nicht sauber zwischen öffentlicher Referenz und Fehlpublikation trennen. | `data/applications.json`, `data/datasets.json`, `data/api-specs.json`, `js/knowledge-content.js` |
| Q-05 | Offen | Soll `mountDataTable` bewusst eine separate submit-orientierte Verdrahtung behalten oder denselben Commit-Vertrag wie `wireCatalogueState` verwenden? | Die Antwort bestimmt, ob K-02 vereinheitlicht werden kann, ohne Bedienverhalten zu ändern. | `js/components.js:1680-1715,1877-1959` |
| Q-06 | Offen | Ist die harte Angabe «7 Themen» bewusst redaktionell oder soll sie aus den Daten gezählt werden? | Bei Datenänderungen kann die Startseite sonst sichtbar driften. | `js/pages/data.js:41` |
| Q-07 | Offen | Soll eine sinkende Eigentumsquote im Immobilien-Dashboard neutral oder negativ markiert werden? | Aus Code und Text ist nicht erkennbar, ob «weniger Eigentum» Ziel oder Warnsignal ist. | `js/apps/estate.js:257` |
| Q-08 | Offen | Wie sollen ungültige Portfolio-Facetten wie `?kind=foo` erscheinen: ignoriert, leer oder als «Grundstück» normalisiert? | Aktuell können URL, Resultat und Label unterschiedliche Zustände ausdrücken; fachliche Absicht fehlt. | `js/apps/portfolio.js` |
| Q-09 | Offen | Ist im Prozessbaum beabsichtigt, dass Ebene 1 denselben `href`- und Aktivzustand nutzt, solange nur ein Bereich existiert? | Eine technische Änderung könnte ein bewusst vorbereitetes Navigationsmuster entfernen. | `js/apps/process-docs.js` |
| Q-10 | Offen | Soll der implementierte und aus der URL gelesene Shop-List-View später sichtbar auswählbar werden, oder ist er Altlast? | Nicht implementierte Buttons sind im Mockup kein Befund. Für eine Vereinfachung muss klar sein, ob der Code geplant oder tot ist. | `js/apps/shop.js:121-122,165-205` |

## 8. Massnahmenplan

Phase 5 wurde auf `code-review-2026-08` begonnen und für alle technisch entscheidbaren Punkte der empfohlenen ersten Runde abgeschlossen. Die ursprüngliche Priorisierung bleibt nachfolgend als Entscheidungs- und Review-Nachweis erhalten; der aktuelle Status steht in Abschnitt 1.1.

| Priorität | Status | Paket | Befunde | Wirkung | Geschätzter Aufwand | Abhängigkeit / Abnahmekriterium |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | Erledigt | Monatsdiagramm reparieren | B-01 | Beseitigt den einzigen bestätigten Vorführ-Blocker | S | Monats- und Jahresansicht enthalten keine `NaN`-/ungültigen SVG-Werte und stimmen in Tooltip/Skala |
| 2 | Entscheid offen | Publikationsentscheid und Eindämmung | W-01, W-02, Q-01 bis Q-04 | Verhindert weitere Verteilung ungeklärter Daten und Medien | L–XL plus externe Entscheidung | Positivliste/Freigabe liegt vor; ungeklärte Inhalte sind aus öffentlichem Baum entfernt oder klar synthetisch ersetzt; History-Entscheid separat genehmigt |
| 3 | Erledigt | Zustandsfehler in Kernpfaden | W-03, W-04, W-05, W-06, W-07, W-08 | Stabilisiert Navigation, Formulare, Buchung und Shop | L | Reproduktionsschritte jedes Befunds bestehen; keine Route oder Ansicht entfällt |
| 4 | Erledigt | Lifecycle und Accessibility | W-09, W-19, W-20, W-22 | Verhindert stale UI, Leaks und falsche Assistive-Technology-Zustände | L | Wiederholtes Öffnen/Schliessen/Navigieren hinterlässt keine Karten, Observer, Listener oder Locks; Live-Regionen und ARIA stimmen |
| 5 | Teilweise – W-12 offen | Daten- und Deep-Link-Korrektheit | W-10 bis W-16, W-21 | Entfernt widersprüchliche Zahlen, falsche Links und Gate-/Scroll-Zustände | M–L | Fachliche Antworten zu Q-01/Q-07/Q-08 liegen vor; relevante Deep-Links und Dashboardwerte sind konsistent |
| 6 | Erledigt | Testwerkzeug belastbar machen | W-17, C-08 | Macht Grün/Rot verlässlich und verhindert Prozessreste | M | Login startet nachweislich ausgeloggt; Karten warten auf Bedingung; Cleanup läuft auch bei Assertion-Fehlern; alle unterstützten Suiten enden ohne verwaiste Prozesse |
| 7 | Erledigt | Riskante und lokale Skripte bereinigen | W-18, K-09 | Senkt versehentliche Schreib- und Onboarding-Risiken | M | Unterstützte Skripte sind relativ und dokumentiert; Schreibwirkungen sind explizit, Altproben klar klassifiziert oder entfernt |
| 8 | Teilweise – K-05/K-06 erledigt | Gezielte Vereinfachung | K-01 bis K-07, K-10 | Reduziert Drift und Wartungskosten ohne Funktionsänderung | L–XL | Pro eng zusammenhängender Gruppe eigener Commit; vor/nach jeder Gruppe Routen- und Hauptpfadvergleich |
| 9 | Teilweise – C-04 erledigt | Repository-Artefakte | K-08, C-04 | Reduziert Clone-/History-Grösse und aktualisiert Nachweise | L–XL | Aufbewahrungsort und History-Rewrite ausdrücklich freigegeben; aktuelle Manifest-/Review-Dokumentation bleibt erhalten |
| 10 | Ausserhalb Runde | Produktions-Backlog | P-01 bis P-09 | Bereitet eine allfällige Produktivierung vor | nicht Teil dieser Runde | Erst aufnehmen, wenn Backend, reale Nutzer oder produktiver Betrieb beschlossen sind |
| 11 | Nicht begonnen | Kosmetik | C-01 bis C-03, C-05 bis C-07 | Kleine Konsistenzverbesserungen | S–M | Nur zusammen mit berührten Modulen; keine eigene Priorität vor wichtigen Befunden |

### 8.1 Freigegebene erste Runde

Freigegeben waren die Empfehlungen der ersten Runde: zuerst B-01, danach Publikationsentscheid, normale Zustands-/Workflowfehler, Lifecycle/Accessibility, Daten-/Deep-Link-Korrektheit und das Testwerkzeug. Die technisch entscheidbaren Teile sind umgesetzt. W-18 wurde wegen seines direkten Schreib- und Datenverlustrisikos im selben Werkzeugpaket ebenfalls abgesichert. In den anschliessenden Paketen wurden K-09/C-04 und K-05/K-06 erledigt. Offen bleiben K-01 bis K-04, K-07, K-08 und K-10. Produktionspunkte bleiben ausdrücklich ausserhalb dieser Runde.

Nach jeder Gruppe gelten die Guardrails des Auftrags: ein Commit pro Befund oder eng zusammenhängender Gruppe, Commit-Message mit Befundnummer, Syntax-/Datentests, relevante Browser-Suiten und manueller Hauptpfad. Wird eine Änderung grösser als geschätzt oder verlangt eine fachliche Entscheidung, wird angehalten.

### 8.2 Verbleibende Entscheidungen

| Befunde | Status | Benötigte Entscheidung | Nächster Schritt nach Freigabe |
| --- | --- | --- | --- |
| W-01 | Entscheid offen | Positivliste für interne URLs, Objektkennungen, Kontakt- und Finanzdaten; Einordnung als synthetisch, öffentlich oder nicht freigegeben | Nicht freigegebene Werte im aktuellen Baum durch klar synthetische Fixtures ersetzen; History- und Credential-/Link-Rotation separat planen |
| W-02 | Entscheid offen | Lizenz, Rechteinhaber und Weiterverteilungsfreigabe je Medium | Ungeklärte Medien aus der Auslieferung nehmen oder durch frei lizenzierte Assets ersetzen; History-Entscheid separat genehmigen |
| W-12 | Fachentscheid offen | Kanonische Quelle für BGF und NGF | Sekundärdatei aus der führenden Quelle erzeugen und einen objektweisen Integritätstest ergänzen |

Ohne diese Antworten würde eine automatische Bereinigung entweder möglicherweise freigegebene Inhalte entfernen oder fachliche Flächenwerte willkürlich überschreiben. Deshalb wurde an diesen drei Befunden nicht weitergearbeitet.
