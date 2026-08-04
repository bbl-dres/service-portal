# Design Review — Konsistenz, Komplexität, Sprache (August 2026)

_Dritte Review-Welle, mit frischem Blick. Anders als die beiden Vorgänger (CD-Pixel-Treue, dann A11y/Shared-Layer) fragt diese Review nicht «stimmt das Pixel?», sondern: **Sieht Gleiches gleich aus, funktioniert Gleiches gleich, heisst Gleiches gleich?** Dazu: Komplexität abbauen (Duplikate, Parallel-Implementierungen, toter Code), Namen, Abstände, Hartkodiertes → Tokens._

_Methode: 12 unabhängige Expertendurchgänge — 8 Design-Dimensionen (App-Shells, Seiten-Anatomie, Formular-Workflows, Liste→Detail-Workflows, Tokens/Spacing, Naming, CSS-Duplikate, JS-Duplikate), 3 Sprach-Dimensionen (Aktions-Beschriftungen, System-Feedback, Navigation/Terminologie), 1 Vollständigkeits-Kritiker — plus ein eigener struktureller Browser-Durchgang über alle Routen. Jede Behauptung wurde an der zitierten Zeile verifiziert; Sprachbefunde listen **jede** Fundstelle jeder Variante, damit die Fix-Welle vollständig migriert. Frühere Reviews wurden bewusst nicht gelesen; dokumentierte Entscheide (deutsche Kommentare im Code) wurden respektiert und nicht neu verhandelt._

## Verdikt

Die beiden früheren Wellen haben getragen: **Die Grundanatomie ist konvergiert.** Alle Listenansichten teilen `container.section → page-header → lead → catbar`; Trefferzähler, Blätterleiste, Ansichtswechsel und Nicht-gefunden-Fluss sind portalweit einheitlich; das Token-Blatt ist reif und wird konsumiert. Es gibt kein strukturelles Redesign-Bedürfnis.

Die Rest-Inkonsistenz konzentriert sich in vier Clustern:

1. **Die JS-State-Explorer sind Kopien voneinander.** Portfolio, Bauprojekte, Mietende (+ Bauwerksdokumentation für die Toolbar) tragen je ~150 Zeilen wortgleiche Katalog-Verdrahtung, einen dreifach kopierten Raumbaum und eine fragile Pagination über das deutsche aria-label — und die Kopien sind bereits nutzersichtbar abgedriftet: im Mietendenportal zeigt der Baum **keine** Auswahl-Hervorhebung (`is-selected` hat kein CSS), der «Alle Filter zurücksetzen»-Knopf ist **tot**, der Trefferzähler verliert das Seiten-Suffix. Das Dashboard-Chrome doppelt wortgleich in Datenportal und Immobilien-Board — die Extraktion ist im Code selbst als ausstehend vermerkt.
2. **Gleiche Funktion, verschiedene Beschriftung.** Ein Nutzer, der zwei Flows durchläuft, sieht «absenden» und «einreichen» für dieselbe Handlung — einmal beides auf einem Bildschirm; vier Beschriftungen fürs Zurücksetzen; «Aktuelles» → «Alle Aktualitäten ansehen» → Seite «News» auf einem Klickpfad; «Download» neben «Herunterladen» auf derselben Detailseite; Fusszeile nennt `#/data` «Datenkatalog», Meta-Navigation nennt `#/knowledge` «Hilfe». Dazu grammatisch falsches Deutsch aus der Shared-API: `unit` dient Dativ- und Nominativ-Slots zugleich («3 von 6 Verträge»).
3. **Zwei Rezepte, wo eines reicht.** Detailseiten-Kopf (Hero vs. h1+lead), Schlüssel-Wert-Listen (`.kv` vs. `.data-rows`), Grossziffer-Kacheln (`.stat`/`.kpi`/`.kpi-strip`), Vollbild-Chrome (Lightbox vs. Dokumentbetrachter), Kombobox-Listen, Scroll-Locks, Grid-Familien (`grid--3` vs. `grid--responsive-cols-3`), Datum (ISO roh vs. `format.datum` vs. vorformatiert) — je zweimal bis dreimal implementiert, je mit sichtbarer Drift.
4. **Spacing-Streuung unterhalb der Token-Ebene.** ~108 Deklarationen auf 21 skalenfremden Werten (.35/.4/.6 …), drei Kopien der Sektionsrhythmus-Rampe mit Breakpoint-Drift, `mt-8`-Inseln, sechs Inline-Styles, 13 nackte `ease`-Keywords.

**130 verifizierte Befunde** (16 hoch · 60 mittel · 54 niedrig). **Umsetzungsstand: 125 umgesetzt · 4 teilweise (B13/B16/B19/C18 — Rest jeweils benannt) · 1 offen (C21, dokumentierter Übergangszustand «Chart-Vollbild → Modal», Item 6.12).** Bewusste Abweichungen sind am Ende dokumentiert und im Code kommentiert.

## Der Kanon

Damit «konsistent» prüfbar wird, hält diese Review die Soll-Rezepte fest. Neue Ansichten bauen auf diesen auf; Abweichungen brauchen einen dokumentierten Grund.

### Archetyp-Rezepte

| Archetyp | Ansichten | Rezept |
|---|---|---|
| **Explorer-Übersicht** (Liste+Detail, JS-State oder Hash) | Portfolio, Bauprojekte, Mietende, Mediathek, Metadatenkatalog, Bauwerksdok. | `container.section` → `C.pageHeader` → `C.catalogueBar` → Aktiv-Pillen → (`pf-layout` mit geteiltem Baum) → Treffer → Pagination als `data-page`-Buttons → `announceCatalogue`. Leerzustand IMMER mit Hinweis + Reset-Aktion. |
| **Objekt-Detail** (App) | Gebäude, Grundstück, Projekt, Mietverhältnis, Geschäftsobjekt, Tabelle, Medium | `C.detailBar` → (`eyebrow` nur mit dokumentiertem Grund) → `h1[tabindex=-1]` → `p.lead` → Medienstreifen (`heroMosaic`) → `.tabs.mt-6` (tabBar+tabPanels, `?tab=`-Deeplink) → je Register `mountDataTable` → `renderNotFound`. KEIN eigenes scrollTo/Fokus — das gehört dem Router. |
| **Inhalts-Detail** (Seite) | Dienstleistung, Anwendung, Datensatz, Info-Seite, News, Vorgang | `C.detailHead` (detailBar + Hero) bzw. detailBar + h1 für registerartige Fälle (my-cases). News trägt die detailBar wie alle anderen. |
| **Formular-Prozess** | Störung, Raumbedarf, Gebäude erfassen, Buchung | `container--grid` → `container__center--xs/--sm` → `backLink` zur Dienstleistungsbeschreibung → h1 → Kontextzeile «‹Aktion› als NAME · ORG (· Prozess: …)» → `stepIndicator` + sr-h2 → `errorSummary` (Feldmeldungen ohne Live-Rolle) → Formular → `processDone` mit fokussierter Überschrift. Ausgeloggt: derselbe Kopf + `loginGate`. Fehler verschwinden beim Korrigieren (`wireFieldErrors`). |
| **Dashboard** | Datenportal-Boards, Immobilien | Geteiltes Modul `js/dashboard-chrome.js`: backLink → dash-header (pageHeader + Menü) → dashboard-layout (Filterpanel + Tabs) → KPI-Zeile → dash-grid → dash-footer. |

### Sprach-Kanon (gleiche Funktion → gleiche Beschriftung)

| Funktion | Kanonisch | Ersetzt |
|---|---|---|
| Formular abschicken | «‹Nomen› absenden»; Stufe «Prüfen & Absenden» | «Erfassung einreichen», «Prüfen & Einreichen» («Buchung anfragen» bleibt: Bestätigung erfolgt durch Workspace BBL) |
| Filterpanel-Reset | «Filter zurücksetzen» (CD-Wortlaut) | 13× «Zurücksetzen» |
| Pillenreihe-Reset | «Alle Filter zurücksetzen» (unverändert) | — |
| Leerzustand-Reset | «Suche und Filter zurücksetzen» | Wortdreher «Filter und Suche …» |
| Baum-Auswahl aufheben | «Auswahl zurücksetzen» | «Auswahl» |
| Alle anzeigen | «Alle ‹Einheit› anzeigen» | «Alle Aktualitäten ansehen», «Alle Vorgänge (N)» |
| Herunterladen | «Herunterladen» | «Download» (Knopf) |
| Seiten-URL kopieren | «Link kopieren» / Toast «Link kopiert.» / Fehler als error-Toast | «URL kopieren», stiller Erfolgs-Toast bei Fehlschlag |
| Wert kopieren | «Kopieren» (satzinitial gross) | «kopieren» |
| Detail öffnen (verwandt) | «‹Objekt› ansehen» | «Zur Detailseite» |
| Overlay-Vorschau | «Vorschau» | «Öffnen» (Bauwerksdok.-Tabelle) |
| Nutzereingabe zitieren | «…» (Guillemets, Hausnorm) | „…“ (12 Stellen) |
| Leerzustand gefilterte Liste | «Keine ‹Einheit› gefunden.» + Hinweis + Reset | «Keine ‹X› für diese Auswahl.» (ohne Ausweg) |
| Leerzustand Inventardaten | «Keine ‹X› erfasst.»; «hinterlegt» nur für Angehängtes | «verknüpft», Satzformen |
| Prototyp-Simulation | Suffix «— im Prototyp simuliert.» | «simuliert.», «(Demo)» |
| Bereich News | «News»; Einzelbeitrag «Mitteilung» | «Aktuelles», «Aktualitäten», «Meldung» (bleibt dem Meldewesen) |
| Dienstleistungen | «Dienstleistung(en)», «Zu den Dienstleistungen» | «Services», «Weitere Services» |
| Erfolgstitel | «Vielen Dank» | «Gebäude erfasst» |
| Sortieren | sichtbar «Sortieren», sr «Sortierung»; Optionen «Titel (A–Z)» (Titel-Felder) / «Bezeichnung (A–Z)» (sonst); Richtung gesprochen («grösste zuerst») | «Name (A–Z)», «(absteigend)» |
| Validierung | «Bitte + Artikel + Objekt + Infinitiv», ohne Schlusspunkt; Sie-Imperativ nur für Freitext | artikellose und punktierte Varianten |
| Kontakt-Slot | «Kontakt» (eine Stelle) / «Ansprechpersonen» (Liste) | «Ansprechstelle»-aria; «Objektkontakte»-Caption |
| Eckdaten-Slot | «Eckdaten» («Metadaten» nur DCAT) | «Objektdaten», «Grundstücksdaten», «Angaben zum Vorgang» |
| Datum | immer `format.datum()` (ISO in den Daten) | rohes ISO, vorformatiertes «30.07.2026» |
| Datumszeilen-Label | «Stand» (Datenstand) / «Aktualisiert» (Tabellenspalte) | «Letzte Änderung» |

### Terminologie-Entscheide

- **Startseite** heisst der Ort `#/` (Titel, 404-Link); «Übersicht» bleibt Drawer-Erstzeile und erster Detail-Tab.
- Fusszeile: `#/data` heisst **«Daten und Digitalisierung»** (nicht «Datenkatalog»). Meta-Nav «Hilfe» zeigt auf `#/knowledge/guides` (Anleitungen und Schulungen — das ist Hilfe), nicht auf die Wissens-Übersicht.
- **Workspace & Buchung** überall (Katalogkarte, Crumb, h1); der Buchungs-Einstieg heisst in services.json UND applications.json «Raum-, Arbeitsplatz- & Parkplatzbuchung».
- Katalogtitel = h1 der Zielseite («Raumbedarf melden», «Kleinauftrag am Gebäude erteilen», «Liegenschaften Inventar einsehen», «Bauwerksdokumentation abrufen», «Grundstück erfassen»).
- **Vertragsende** für das Datum (die App bleibt «Mietende»). **Bodenbedeckung** (amtliche Vermessung), nie «Bodenabdeckung». **Geschäftsobjekt** als Fachterm des Metadatenkatalogs («Fachbegriff» nur einführend); Zeilenzahl heisst «Zeilen», «Datensatz» bleibt dem DCAT-Katalog. **Veräusserung von Bundesliegenschaften** statt «Verkauf / Divestment». «Bemessungsgrösse» (ss).
- Produktnamen mit Leerzeichen («Liegenschaften Inventar», «Metadaten Katalog Bauten», «Datenbezug und API Verzeichnis») sind **gesetzte Markennamen** — Fliesstext darf regulär komponieren («Liegenschafteninventar»); nicht «korrigieren».

### Struktur-Konventionen

- **Lesemass:** das Mass sitzt am Eltern-/Spaltenelement (container__main/anchor-page__header 60rem, measure-xl-Artikel-Wrapper), nie an Textklassen; Ausnahmen: notification__content, api-resource__desc (C25).
- **Spacing:** rem-Literale AUF der CD-Skala sind Konvention; skalenfremde Werte werden auf die nächste Stufe gesnappt (`--sp-1-5`/`--sp-2-5` ergänzen die Bruchstufen). Icon+Label-Lücke: `.5rem` (Mehrheitsrezept `.gap-sm`). Sektionsrhythmus aus `--stack-gap` (3rem → 3.5rem ab 1544px, CD-Kanon).
- **Easing:** nur `var(--ease-out)` / `var(--ease-in-out)`, kein nacktes `ease`.
- **Panel-Rand:** `--panel-border` (secondary-100). **Viewer-Schatten:** `--shadow-viewer`.
- **Grids:** nur die CD-Familie `grid--responsive-cols-N`; die Aliase `grid--2/3/4` sind entfernt.
- **Scroll-Lock:** eine Klasse `body--overlay-open` für Modal, Galerie, Dokumentbetrachter.
- **Deep-Links modulübergreifend:** immer über `js/links.js` (Selbst-Links innerhalb einer App dürfen literal bleiben).
- **`pf-`-Namespace** ist die geteilte Explorer-Schicht (5 Apps) — dokumentiert, nicht umbenannt (Tests greppen die Klassen; Umbenennen wäre Churn ohne Nutzwert).

## Befunde und Status

Status: ✅ umgesetzt · 🔶 teilweise · 📌 bewusste Abweichung (dokumentiert) · ⬜ offen. Belegstellen (Datei:Zeile) beziehen sich auf den Stand VOR der Fix-Welle.

### A — Workflows & Shells (hoch)

| # | Befund | Aktion | Status |
|---|---|---|---|
| A1 | Raumbaum dreifach kopiert; Mietende-Auswahl unsichtbar (`is-selected` ohne CSS), kein Vorfahrenpfad | Baum-Builder, markTree, Klick- und URL-Restore nach `js/spatial-tree.js`; Mietende erhält `is-active`/`is-path` | ✅ |
| A2 | JS-State-Katalogverdrahtung 4× kopiert (Suche/Sort/Filter/Pillen, ~180 Z.) | `C.wireCatalogueState` als lokaler Zwilling von `wireCatalogue`; 4 Apps migriert | ✅ |
| A3 | Explorer-Pagination: tote `href:'#'`-Links + `/Nächste/`-Regex 3× | `C.wirePagination` bindet `[data-page]`; href-Builder + Regex-Handler entfernt | ✅ |
| A4 | Dashboard-Chrome wortgleich doppelt (Menü, KPI-Kachel, Filter-Collapse, Footer) | Extraktion nach `js/dashboard-chrome.js` (im Code als ausstehend markiert) | ✅ |
| A5 | Mietende: «Alle Filter zurücksetzen» tot; Trefferzähler ohne Seiten-Suffix | data-reset-Zweig + Zähler-Format der Geschwister | ✅ |
| A6 | Leerzustand: Reset-Aktion nur in der Hälfte der Kataloge | Explorer-Trio erhält Hinweis + verdrahteten Reset | ✅ |
| A7 | Drei verschiedene Ausgelogt-Shells der Formular-Apps | Ein Rezept: grid + center + backLink + h1 + lead + loginGate | ✅ |
| A8 | Fokus nach Submit nur in 1 von 4 Formular-Apps | `C.focusProcessDone` in allen vier drawDone-Pfaden | ✅ |
| A9 | Fehler-Löschen bei Korrektur: 2× kopiert, 2× fehlend | `C.wireFieldErrors` (input+change), 4 Apps | ✅ |
| A10 | Toter Link «Meine Vorgänge» → `#/app/my-cases` auf jeder Prozess-Dienstleistungsseite | `#/my-cases` | ✅ |
| A11 | Galeriekarten/Grids der Explorer sichtbar verschieden (pfCard vs. C.card vs. Alt-Footer; pf-gallery vs. grid--3) | C.card mit `idLine`-Slot überall; `.pf-gallery` in allen drei | ✅ |
| A12 | Vollbild-Chrome doppelt (.pf-lightbox vs. .docviewer) mit Drift (Schatten, Fokus-Offset, Tinten) | geteilter `.viewer-*`-Block, dokumentierte Deltas als Modifier | ✅ |
| A13 | Datum dreisprachig: `format.datum` vs. rohes ISO vs. vorformatiert («2026-05-28» auf der Startseite) | alles durch `datum()`; applications.json `updated` → ISO; Labels «Stand»/«Aktualisiert» | ✅ |
| A14 | `unit` in zwei Kasus gezwungen — «3 von 6 Verträge» | `unit: {nom, dat}` in mountDataTable/catalogueResults/announce | ✅ |

### B — Workflows & Shells (mittel/niedrig)

| # | Befund | Aktion | Status |
|---|---|---|---|
| B1 | 9 Apps schreiben Brotkrumen-Ketten von Hand an `js/crumbs.js` vorbei | Importe (HOME/DATEN/DIENSTLEISTUNGEN/ANWENDUNGEN + trail); lokale CRUMB_BASE gelöscht; Mediathek + Bauwerksdok. tragen das «Anwendungen»-Glied (stehen im Katalog) | ✅ |
| B2 | Metadatenkatalog-Details nutzen `detailHead` gegen den eigenen Bauplan («wie das Inventar») + :has()-CSS-Sonderfall | Kopf → detailBar + h1 (App-Rezept); :has()-Patch entfernt | ✅ |
| B3 | `?tab=`-Deeplinks nur in der Hälfte der Register-Ansichten | Portfolio, Mediathek, Metadatenkatalog lesen+syncen `?tab=` | ✅ |
| B4 | Vier Detail-Ansichten scrollen/fokussieren gegen den Router | vier scrollTo/focus-Blöcke ersatzlos (Muster tenancies) | ✅ |
| B5 | api-docs: handgerollter NotFound-Pfad, kein detailBar/Share trotz `?tag`-Deeplink | `C.renderNotFound` + Krume «Nicht gefunden»; detailBar; check-404-Zeile | ✅ |
| B6 | News-Detail als einziges ohne Share/Print-Leiste | `C.detailBar` statt backLink | ✅ |
| B7 | my-cases-Detailkopf handgerollt (.page-header) | detailBar + h1 + lead (App-Rezept; pill-row für Statusbadge) | ✅ |
| B8 | Wizard-Gerüst doppelt (Stufenkopf, Legende, focusStepHeading) mit Ansage-Drift | `C.wizardHead`/`C.focusWizardStep` («Schritt N von M: LABEL») | ✅ |
| B9 | quiet-Vertrag ungenutzt: jeder Fehlversuch wird 2-3× angesagt | Feld-Badge ohne Live-Rolle (CD Input.vue), `quiet`-Parameter entfernt | ✅ |
| B10 | building-create-Adressfehler als Live-Notification statt Feld-Badge | Standard-Badge `bc-address-msg`, Summary sagt an | ✅ |
| B11 | fault-report: Zurück/Abbrechen zielt auf den Hub statt die Beschreibung | serviceId je TYPES-Eintrag; backLink «Dienstleistungsbeschreibung» | ✅ |
| B12 | Kontextzeilen-Formel je Flow anders | «‹Aktion› als NAME · ORG (· Prozess: …)» in allen vier | ✅ |
| B13 | processDone-Links handgebaut, 3× ohne Encoding | `links.vorgang()` in allen vier; links.js-Adoption auch in pages/search/buildings-map (≥15 Stellen) | 🔶 |
| B14 | Options-Schlüssel `text` vs. `label` | fault-report → `label`; Fallback aus C.select entfernt | ✅ |
| B15 | transaction: Wizard-Stepper für passiven Status | `C.pipeline` (wie my-cases/services) | ✅ |
| B16 | Katalog-Quartett: ~35 Z. Hash-State-Boilerplate 4× | `C.catalogueState`-Helper; PER_PAGE vereinheitlicht (12) | 🔶 |
| B17 | Filterpanel-Reset in ~7 Anatomien; 3 Katalogseiten ohne `.catbar__panel__actions` | `C.panelReset({href|id})`, kanonische Anatomie, 13 Stellen | ✅ |
| B18 | search.js baut die Section-Bänder von Hand | `C.pageSection` | ✅ |
| B19 | Mosaik-Klickverdrahtung 3×; projects baut galleryItemsFrom nach (verlor schon einmal den Bildnachweis) | `wireHeroMosaic()` in hero-mosaic.js; projects → `galleryItemsFrom` | 🔶 |
| B20 | media-library: Objektauflösung + Galerieeintrag doppelt in einer Datei (Koordinaten-Zeile schon verloren) | Modul-Hoist `galleryItem`/`objektId` | ✅ |
| B21 | tenancies: Aktionen-Box handgerollt trotz gegenteiligem Kommentar; Restlaufzeit-Badge doppelt | `C.actionCard`; `restBadge`-Hoist | ✅ |
| B22 | Kontakt-Aside zwei Helfer, zwei Typografien | contactBox rendert intern die contactCard-Anatomie | ✅ |
| B23 | Format-/Label-Bypässe: `CH()`, toLocaleString ×5, lokale statusLabel/domainLabel, Audience-Labels 3×, esc-Wrapper 6×, matchBadge 2×, search-log an storage.js vorbei | format.js/domain.js/storage.js konsequent; `AUDIENCES` in domain.js | ✅ |
| B24 | Sortier-sr-Label und Sortieroptionen-Wortlaut driften | Default «Sortierung»; Optionsregel Titel/Bezeichnung; gesprochene Richtung | ✅ |
| B25 | Zugriffszustand ohne festen Ort: Dienstleistungs-Landingpages sagten erst im Inhalt (login-gate-Band), ob und wie man startet; Systemtabellen-Blätter boten keinen Weg zum Datenbezug (Nutzerentscheide 2026-08-04) | Konsistente «Zugriff»-Karte als ERSTE Randspalten-Karte: Dienstleistung → kompakter Login-Hinweis (abgemeldet) / Sitzungskontext (angemeldet) / «frei zugänglich» (Info-Angebote); Tabellenblatt → «Datensatz ansehen»-Weg zum publizierten DCAT-Datensatz (nur wenn publiziert) | ✅ |

### C — CSS, Tokens, Spacing

| # | Befund | Aktion | Status |
|---|---|---|---|
| C1 | ~108 skalenfremde Spacing-Deklarationen (21 Werte), Icon-Gap .35/.4/.5 | Snap auf Skala; `--sp-1-5`/`--sp-2-5` ergänzt; Icon-Gap → .5rem | ✅ |
| C2 | Sektionsrhythmus 3× mit Breakpoint-Drift (detail-section stuft bei 1024 statt 1544) | `--stack-gap`-Token; alle drei konsumieren; 1544 (CD-Kanon) | ✅ |
| C3 | `.stats` mit privater Rampen-Kopie (bereits gedriftet) | `gap:var(--gap-responsive)` | ✅ |
| C4 | transaction stapelt mit `mt-8` statt `.detail-section` | `.detail-section` | ✅ |
| C5 | Inline-Spacing-Styles in Views (6, darunter ein dokumentiert «behobener» Defekt) | Utilities/list--default | ✅ |
| C6 | 13× `ease`-Keyword | `var(--ease-out)`/`var(--ease-in-out)` | ✅ |
| C7 | `.data-rows` vs. `.kv` | catalog/my-cases → `.kv` (+`.kv--ruled`); .data-rows gelöscht | ✅ |
| C8 | Grossziffer 3 Rezepte (stat/kpi/kpi-strip), 3 Grössen, 2 Farben | eine Ziffern-Typografie, Flächen als dokumentierte Modifier | ✅ |
| C9 | ~50 Z. tote Selektoren (verifiziert, inkl. dynamischer Klassenbau) | gelöscht | ✅ |
| C10 | ~70 Z. vorprovisionierte CD-Blöcke ohne Konsument (gegen die eigene Policy) | exzidiert (Adoption bleibt möglich, wenn ein Konsument kommt) | ✅ |
| C11 | Panel-Randton driftet über 3 Tokens | `--panel-border` (secondary-100) | ✅ |
| C12 | Kombobox-Liste doppelt (.suggest vs. .map-search) mit zweierlei Popup-Chrome | ein Listbox-Rezept | ✅ |
| C13 | Kein Basis-`code`-Rezept; drei scoped Wiederholungen; Metadatenkatalog fällt auf UA-Mono | `code { font-family:var(--font-mono) }` | ✅ |
| C14 | Scroll-Lock doppelt, Name lügt (`chart-overlay-open` sperrt alles) | `body--overlay-open`, ein Regelpaar | ✅ |
| C15 | «Du bist hier»-Markierung 3 Mechanismen, 2 Farben | ein Rezept (3px, primary-500) für api-rail + pf-tree | ✅ |
| C16 | Viewer-Schatten-Literal 3×, Zwilling nutzt anderes Token | `--shadow-viewer` (4 Stellen) | ✅ |
| C17 | Grid-Familien doppelt; `gap--responsive` redundant neben `.grid` | Migration auf `grid--responsive-cols-N` abgeschlossen; Aliase gelöscht | ✅ |
| C18 | Blatt-Struktur: App-Sektionen nach PRINT, Utilities unter Seiten-Bannern, pf-Banner nennt einen Besitzer statt fünf | Banner nachgeführt, Strays umgezogen, Viewer-Sektionen vor MOTION/PRINT | 🔶 |
| C19 | Print: `.btn--back`/`.notification-banner` nicht ausgeblendet (CD print.postcss:62,72) | display:none ergänzt | ✅ |
| C20 | Kleinstellen: fw 700 ×3, radius 2px ×2, z-index 20, tote SERIES, toter reduced-motion-Rest, .stack-lg, api-layout-Gap, stale Token-Querverweis | bereinigt | ✅ |
| C21 | Chart-Vollbild neben geplantem .modal-Nachfolger (Item 6.12 offen) | Chart-Vollbild auf `C.openModal`; .chart-overlay entfernt | ⬜ |
| C22 | Geteilte Helfer emittieren App-Klassen (card→.pf-card__chips, actionCard→.fp-svc in der Mietende-Sektion) | CSS in die COMPONENTS-Sektion umgezogen, Konsumenten dokumentiert (kein Rename — Tests greppen die Klassen) | ✅ |
| C23 | Kopf-Suchfeld: Fokusring dunkel statt CD-Purpur — der globale Aussenring wird vom overflow:hidden der Aufklapp-Animation beschnitten (Nutzerbefund 2026-08-04) | Inset-Ring (:focus, -2px) in --color-focus-ring am .search__form-Feld | ✅ |
| C24 | Gestapelte Kästen der Dienstleistungs-Landingpage («Das brauchen Sie» / «So läuft es ab») klebten als EIN Block — das 1px-Naht-Fossil `.box + .box` schlug mit (0,2,0) den Spaltenrhythmus (Nutzerbefund 2026-08-04) | Fossil entfernt; Kastenabstand kommt überall aus dem Kontextrhythmus (vertical-spacing 3/3.5rem · Aside 1.75/2rem · detail-layout 1.5rem); Wächter in check-consistency.mjs | ✅ |
| C26 | Unsplash-Hotlinks in fünf Flächen (Startseiten-Kacheln, News, Dienstleistungs-/Digitalisierungs-Heroes, ein Datensatz) — Bilder ausserhalb des Repos, Startseiten-Kachel «Datenportal» zeigte ein ANDERES Motiv als die Landingpage (Nutzerbefunde 2026-08-04) | Alle Bilder lokal unter assets/images: news/ (bild{src, quelle} je Meldung), heroes/ (geteilter Pool mit Nachweis-README), datasets/; Anwendungs-Kacheln der Startseite lesen das Bild aus dem ANWENDUNGSDATENSATZ (eine Quelle für Kachel, Katalog und Landingpage); photoUrl bleibt nur Rückfallebene, kein Datenbestand trägt mehr Ids | ✅ |
| C25 | Lesemass-Wildwuchs: 70ch-Einzeldeckel an p/ul in container__main, detail-/anchor-section und page-intro neben ungedeckelten Geschwistern — Text endete, Kästen liefen weiter (Nutzerbefund 2026-08-04) | EIN Modell: das Mass sitzt am Eltern-/Spaltenelement — container__main und anchor-page__header messen 60rem (= hero__content); Blattseiten (Datensatz, Metadatenkatalog-Übersicht) tragen einen measure-xl-Artikel-Wrapper; Einzeldeckel gelöscht; measure-lg entfallen (Workspace-Erfolg = 46rem-Formularspalte). Dokumentierte Ausnahmen: notification__content und api-resource__desc (komponenten-interne Lesbarkeit). Datentabellen/Registerpanels bewusst vollbreit. Wächter in check-consistency.mjs | ✅ |

### D — Sprache (Detailliste)

Die vollständigen Fundstellenlisten je Variante liegen im Review-Protokoll; hier die Familien mit Status.

| # | Familie | Aktion | Status |
|---|---|---|---|
| D1 | absenden/einreichen gemischt (ein Bildschirm zeigt beide) | Kanon «absenden» (siehe Sprach-Kanon) | ✅ |
| D2 | Reset-Vierfalt inkl. Wortdreher | Panel «Filter zurücksetzen» (+ Test check-fixes.mjs Regex), Leerzustand vereinheitlicht, Zoom «Zoom zurücksetzen» | ✅ |
| D3 | News-Dreifaltigkeit + «Meldung»-Kollision | «News»/«Mitteilung» durchgängig | ✅ |
| D4 | «Alle …»-Links dreierlei auf der Startseite | «Alle ‹Einheit› anzeigen» | ✅ |
| D5 | Download/Herunterladen; Link/URL kopieren; kopieren klein | Kanon (Sprach-Tabelle); Kopier-Fehlertoast überall error-Variante | ✅ |
| D6 | «Weitere Services», «Service-Beschreibung», «den Service» | «Dienstleistung(en)»-Familie | ✅ |
| D7 | Startseite: Titel «Übersicht», 404 «Zur Übersicht» | «Startseite» | ✅ |
| D8 | «Öffnen» dreifach belegt; «Zur Detailseite» | «Vorschau» (Overlay), «Aufnahme ansehen» (Galerie-Panel) | ✅ |
| D9 | erfassen/anlegen/erstellen gemischt | Nutzerhandlung «erfassen», Systemseite «wird ein Vorgang erstellt» | ✅ |
| D10 | Leerzustände: gefunden/für diese Auswahl/vorhanden; Hinweiszeile 3×; erfasst/hinterlegt/verknüpft | Familien nach Kanon; C.table-Default mit Punkt | ✅ |
| D11 | Anführungszeichen „…“ ×12 | «…» | ✅ |
| D12 | Validierungsgrammatik + Punktdrift | «Bitte + Artikel + Infinitiv», ohne Punkt | ✅ |
| D13 | Prototyp-Hinweise vier Grammatiken; «verknüpft/angebunden» | Suffix-Kanon; «angebunden» | ✅ |
| D14 | Ellipsen (ASCII, Leerzeichen davor) und Platzhalter («Suche»/«Suche…») | «…» ohne Leerzeichen; «Suchen…»; «‹Felder› suchen…» | ✅ |
| D15 | «Hinweis/Meldung geschlossen»; Modal-aria «Schliessen» | «Hinweis geschlossen.»; «Dialog schliessen» | ✅ |
| D16 | Fusszeile «Datenkatalog»; Meta-Nav «Hilfe» | «Daten und Digitalisierung»; Hilfe → guides | ✅ |
| D17 | Workspace: 5 Namen, 1 App | «Workspace & Buchung»-Kanon (JSON + Crumb) | ✅ |
| D18 | Katalogtitel ≠ Ziel-h1 (4 Fälle) | Titel = h1 | ✅ |
| D19 | «Mietende» als kv-Label fürs Vertragsende | «Vertragsende» | ✅ |
| D20 | Bautendokumentation/Bauwerksdokumentation im selben Datensatz | services.json-Titel «Bauwerksdokumentation abrufen»; Begriffsklärung dokumentiert | ✅ |
| D21 | Bodenabdeckung (JSON) vs. Bodenbedeckung (App) — einmal Titel gegen Beschreibung | «Bodenbedeckung» in catalog-labels/system-tables/datasets | ✅ |
| D22 | Metadatenkatalog: Begriff/Geschäftsobjekt/Domäne/Datensätze-Kollision | Kanon (Terminologie-Entscheide) | ✅ |
| D23 | Suchseiten-Leerzustand nennt Facetten, die es nicht gibt | Facettennamen | ✅ |
| D24 | Nav «Fachanwendungen Bauten» → Pille «Immobilien & Bau» | Pille/Checkbox zeigen navLabel (dokumentierter Zwei-Label-Entscheid bleibt für `group`) | ✅ |
| D25 | Brotkrumen-Tiefe uneinheitlich (6 Apps mit, 5 ohne «Anwendungen») | Regel: Katalogeintrag → ANWENDUNGEN-Glied | ✅ |
| D26 | Kontakt-/Eckdaten-Slots (4 bzw. 6 Überschriften) | Kanon-Zweiteilung / «Eckdaten» | ✅ |
| D27 | «Auswertung» vs. «Dashboard» in einem Satz (data.js) | Satz entdoppelt; Board=«Dashboard», Inhalt=«Auswertung» dokumentiert | ✅ |
| D28 | NotFound-Labels («Bauprojekte» vs. «… / EPPM»; «Mediathek» vs. «Mediathek Bauten») | vereinheitlicht | ✅ |
| D29 | ß in system-tables.json («Bemessungsgröße») | «Bemessungsgrösse» | ✅ |
| D30 | «Dienstleistung starten» vs. «Vorgang starten» | «Vorgang starten» | ✅ |
| D31 | Schritt-Ansage mit/ohne Label | «Schritt N von M: LABEL» | ✅ |
| D32 | «Parzelle erfassen» vs. Geschwister-Wortschatz | «Grundstück erfassen» | ✅ |
| D33 | Metadatenkatalog-Details ohne Datensatzblatt-Anatomie: Beschreibung als kv-Zeile versteckt, keine Personen, «Eckdaten» ohne Trennlinien; Sammeladresse und Personen vermischt (Nutzerentscheide 2026-08-04) | Datensatzblatt-Muster für beide Detailansichten: Definition/Beschreibung als Lead unter der H1 · «Verantwortliche Personen» = AdminDir-Einträge (kv--ruled; Tabellen erben die Personen ihres publizierten Datensatzes) · «Metadaten» (kv--ruled) · «Kontakt»-Karte (Sammeladresse der Datenverwaltung) in der Randspalte; «Zertifiziert»/«Zeilen» aus dem Tabellenblatt entfallen | ✅ |

### E — Meta (Tests, Doku)

| # | Befund | Aktion | Status |
|---|---|---|---|
| E1 | test-routes.mjs deckt 3 von 13 App-Routen; Bauwerksdok./transaction nirgends getestet | Routen ergänzt (Smoke je App) | ✅ |
| E2 | check-404.mjs kennt api-docs nicht (deshalb blieb die Abweichung grün) | 14. Zeile ergänzt | ✅ |
| E3 | check-fixes.mjs pinnt /Zurücksetzen/ (case-sensitiv) | Regex /zurücksetzen/i | ✅ |
| E4 | READMEs beschreiben einen zwei Wellen alten Stand (tote Links, fehlende Apps, falscher Port) | docs/README.md-Index + Routen-Tabellen nachgeführt | ✅ |

## Bewusste Abweichungen (dokumentiert, nicht «reparieren»)

1. **Filter-Umschalter «Filter»** (statt CD-Demo «Filter anzeigen/ausblenden»): Chevron + Zähler tragen den Zustand; eine Quelle in `C.catalogueBar`.
2. **«Link kopieren»** statt CD-Demo «URL Kopieren» — CDs Binnengrosschreibung ist kein Standarddeutsch; Toast und Knopf sprechen jetzt dasselbe Wort.
3. **«Buchung anfragen»** bleibt (Bestätigung durch Workspace BBL — semantisch korrekt).
4. **Mietende-Eyebrow** (Gebäudename über dem Mietverhältnis-Titel): trägt Eltern-Kontext, den die Geschwister nicht haben.
5. **`pf-`-Namespace** bleibt (geteilte Explorer-Schicht, Tests greppen ihn) — Banner dokumentiert die fünf Konsumenten.
6. **Produktnamen mit Leerzeichen** sind Branding (siehe Terminologie-Entscheide).
7. **Metadatenkatalog `?id=`/`?table=`** bleibt (Kommentar dokumentiert die bewusste Wiederverwendung des Inventar-Idioms; ein Routenwechsel bräche geteilte Links ohne Nutzergewinn).
8. **`(Ladefehler)`-Suffix** nur in Trefferlisten-Leerzuständen; die Fehlerbänder formulieren frei (verschiedene Flächen).
9. **kpi-strip rahmenlos** (dokumentiert) — nur die Ziffern-Typografie ist vereinheitlicht.
10. **estate ohne `needs`**, **workspace-Gate im Panel**, **Mietende-Vorgänge im Übersicht-Tab**, **map-Zähler ohne Seiten-Suffix**: im Code dokumentierte Entscheide der Vorwellen, unangetastet.

## Reststand der Teil-Umsetzungen

- **B13** (links.js-Adoption): Formulare, Startseite, Vorgänge, News und Suche laufen über links.*; hand-gebaut bleiben Selbst-Links innerhalb einer App (dokumentierte Regel in links.js) sowie transaction/buildings-map (Karten-Popups erhalten ihre Hrefs vom Aufrufer).
- **B16** (catalogueState): Anwendungen + Datenbezug umgezogen; Dienstleistungen und Suche folgen demselben Muster (identische Signatur, reine Fleissarbeit).
- **B19** (Mosaik-Verdrahtung): portfolio nutzt wireHeroMosaic (2 Stellen); der Mietende-Loop bleibt lokal mit Begründungs-Kommentar — der Helfer scopt inzwischen über .pf-mosaic (Klasse), einer künftigen Migration steht nichts mehr im Weg.
- **B24** (Sortier-Wortlaute): Regel umgesetzt; die Feld-Facette «Trägt einen Begriff» des Metadatenkatalogs behält «Begriff» (test-gepinnt, Attribut-Ebene — dokumentiert).
- **C18** (Blattstruktur): Banner benennen jetzt die echten Besitzer (Explorer-Schicht, Dashboards, Viewer); das physische Umziehen der Sektionen bleibt bewusst aus — reine Umordnung mit Cascade-Risiko ohne Nutzersichtbarkeit.
- **C21** (Chart-Vollbild → C.openModal): offener, im Blatt dokumentierter Übergangszustand (Item 6.12) — beide Rezepte koexistieren, bis das Chart-Vollbild auf die Modal-Ebene umzieht.

## Testauswirkungen der Fix-Welle

- `scripts/check-fixes.mjs:13` — Regex auf /zurücksetzen/i (D2).
- `scripts/check-404.mjs` — api-docs-Zeile neu (B5/E2).
- `scripts/test-metadata-catalog.mjs:197` — pinnt «keine Realisierung erfasst» (Wortlaut bleibt erhalten).
- Pagination-aria («Nächste Seite») bleibt unverändert — die drei /Nächste/-Parser verschwinden mit A3.
- `.pf-card`/`.fp-svc`/`.dashboard-main`-Klassen bleiben bestehen (check-pfcard, check-pjcards, test-tenancies, test-dashboard).
