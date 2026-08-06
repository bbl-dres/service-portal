# Feature-Inventar BBL Kundenportal

Regressionsgrundlage des Design Reviews 2026-08 (Phase 0). Jede Route, Funktion,
Interaktion und jeder Zustand — nach jeder Refactoring-Welle wird gegen diese
Liste geprüft. Erstellt automatisiert aus der vollständigen Modullektüre
(Stand: Branch design-review-2026-08, 2026-08-05).

Altlast-Weiterleitungen (js/router.js REDIRECTS) liegen in
scripts/test-routes.mjs. Die visuelle Regressionsmatrix steht zentral in
scripts/review-routes.mjs; Vorher-Screenshots (57 repräsentative Routen und
Zustände × 320/768/1440 px) liegen unter docs/review-assets/before/.

## Routenübersicht

| Route | Ansicht |
| --- | --- |
| `#/` | Startseite |
| `#/services` | Dienstleistungskatalog |
| `#/services/<id>` | Dienstleistungsdetail |
| `#/applications` | Anwendungskatalog |
| `#/applications/<id>` | Anwendungsdetail / Portal-Einstieg |
| `#/data` | Daten und Digitalisierung — Übersicht |
| `#/data/catalog` | Datenbezug und API Verzeichnis |
| `#/data/digitalisation` | Digitalisierung — Übersicht |
| `#/data/digitalisation/strategy` | Digitalisierungsstrategie |
| `#/data/digitalisation/vision` | Vision |
| `#/data/digitalisation/principles` | Prinzipien |
| `#/data/ict-projects` | IKT-Vorhaben |
| `#/knowledge` | Wissen und Hilfsmittel — Übersicht |
| `#/knowledge/it` | Informatik und IKT-Beschaffung |
| `#/knowledge/procurement` | Beschaffung |
| `#/knowledge/accommodation` | Unterbringung und Objektbetrieb |
| `#/knowledge/publishing` | Publikationen, Druck und Versand |
| `#/knowledge/guides` | Anleitungen und Schulungen |
| `#/knowledge/processes` | Prozessdokumentation (Wissen) |
| `#/news` | News-Liste |
| `#/news/<id>` | Einzelmeldung |
| `#/my-cases` | Meine Vorgänge (Login-Gate) |
| `#/my-cases/<id>` | Vorgangsdetail mit Tabs |
| `#/search?q=…` | Portalsuche |
| `#/app/space-request` | Raumbedarf melden (Wizard) |
| `#/app/fault-report` | Störung melden |
| `#/app/building-create` | Gebäude erfassen |
| `#/app/portfolio` | Liegenschaften Inventar |
| `#/app/portfolio?id=<id>&view=<map|gallery|list>` | Inventaransicht oder Objekt-/Grundstücksdetail |
| `#/app/projects` | Bauprojekte |
| `#/app/projects/<id>?tab=<id>` | Bauprojektdetail mit Registern |
| `#/app/tenancies` | Mietende |
| `#/app/tenancies/<id>?tab=<id>&floor=<id>&space=<id>` | Mietobjekt-, Vertrags- und Grundrissdetail |
| `#/app/dataportal` | Datenportal (Dashboards) |
| `#/app/dataportal/<dashboard>?tab=<id>` | Dashboard mit Filtern und Registern |
| `#/app/workspace` | Workspace |
| `#/app/transaction` | Veräusserung |
| `#/app/document-archive` | Bauwerksdokumentation |
| `#/app/media-library` | Mediathek |
| `#/app/media-library/<id>` | Mediendetail |
| `#/app/api-docs` | API-Dokumentation (Swagger UI) |
| `#/app/metadata-catalog` | Metadaten Katalog |
| `#/app/metadata-catalog?id=<id>` | Geschäftsobjektdetail |
| `#/app/metadata-catalog?table=<id>` | Systemtabellendetail |
| `#/app/process-docs` | Prozessdokumentation Bauten |
| `#/app/process-docs?id=<id>&tab=<uebersicht|diagramm|schritte>` | Prozessdetail mit BPMN- und Schrittansicht |
| `#/app/shop` | BBL Intranetshop – Produktkatalog |
| `#/app/shop/product/<id>` | Produktdetail |
| `#/app/shop/cart` | Warenkorb |
| `#/app/shop/checkout` | Bestellassistent |

## index.html

Statisches SPA-Grundgerüst: benannte Host-Elemente für Header, Datenausfall-Band, Hauptinhalt, Live-Region, Footer und Banner; lädt tokens.css/app.css und js/app.js als Modul.

**Funktionen**

- lang=de-CH, <title>BBL Kundenportal</title>, Meta-Description (Prototyp-Hinweis) — index.html:2-7
- Font-Preload einer variablen NotoSans-latin.woff2 (wght 100–900, 35 KB statt 2× 569 KB TTF) — index.html:8-10
- Stylesheets css/tokens.css + css/app.css — index.html:11-12
- body trägt Klasse body--intranet — index.html:14
- header#main-header — Host für die CD-Bund-Kopfzeile (von shell.js gefüllt)
- div#data-status role=region aria-label=«Hinweis zum Datenbestand» — persistentes Datenausfall-Band, überlebt Routenwechsel, weil der Router nur #main-content tauscht — index.html:16-22
- main#main-content tabindex=-1 — Renderfläche des Routers und Skip-Link-Ziel — index.html:23
- div#live role=status aria-live=polite sr-only — DIE persistente Live-Region für Treffer-/Ansichts-/Seitenwechsel-Ansagen (WCAG 4.1.3); nur Text mutieren — index.html:24-26
- footer#main-footer — Host für den CD-Footer
- div#banner-host — Host für den fixierten Hinweisstreifen (CD notification-banner), steht in der Lesereihenfolge NACH dem Inhalt — index.html:28-30
- Einstieg <script type=module src=js/app.js> — index.html:31

**Zustände**

- Datenband leer (kein Ausfall) vs. gefüllt (role=alert-Notification via app.js)
- Live-Region leer vs. mit Ansagetext

**Interaktionen**

- Keine eigenen — reine Host-Struktur; alle Bedienelemente kommen aus shell.js/app.js/Seitenmodulen

## js/components.js

Geteilte Komponentenbibliothek (HTML-String-Fabriken + wire*-Verdrahtungen) im CD-Bund-Vokabular: Karten, Tabellen, Kataloge, Formulare, Tabs, Modals, Toasts, Fokus-/A11y-Werkzeuge; Export als benannte Funktionen und Sammelobjekt C.

**Funktionen**

- icon(name, cls) — CSS-Mask-Icon aus assets/icons/, aria-hidden — components.js:41
- escape(s) — HTML-Escaping aller 5 Sonderzeichen — components.js:46
- safeDecode(s) — decodeURIComponent ohne Wurf bei malformten Sequenzen — components.js:62
- markLang(text, terms) — englische Fachbegriffe (Digital by Design …) inline mit lang=en (WCAG 3.1.2) — components.js:73
- photoUrl(id, opts) — Unsplash-Fallback-URL nur nach strikter Id-Zeichenprüfung (w/h/q/gray) — components.js:19
- photo(o) — Bildkachel: lokales assets/-src schlägt id, Farbfläche als Fallback, onerror entfernt das img — components.js:33
- badge(text, variant, size) — CD-Badge mit badge__text-Anatomie — components.js:86
- statusBadge(status, label) — Badge über STATUS_VARIANT-Mapping (16 Vorgangsstatus entwurf…abgelehnt) — components.js:105-113
- loading({label, hideLabel, size}) — DER Ladezustand: Spinner-Icon + role=status, Wortlaut-Kanon «… wird geladen…» — components.js:98
- pageSection({title, body, more, alt, titleTag}) — vollbreites Seitenband (section>container), alternierende Tönung, «mehr»-Link — components.js:131
- mountBanner(host, opts) — Consent-/Hinweisstreifen (notification-banner--fixed) mit localStorage-Merker bbl_banner_<id>, Schliess-Ansage, per ResizeObserver gemessener Platzreserve `--banner-offset` und Fokus-Schutz gegen verdeckte Bedienelemente — components.js:165
- pageHeader({title, lead, leadHtml}) — h1 tabindex=-1 + Lead (leadHtml nur für autoreneigenes Markup) — components.js:180
- card(o) — CD-Karte: Stretched-Link-Muster, Medien-Slots (photo/image/placeholder/media RAW), Chips-Overlay, idLine (Mono-Kennung), Badges, desc, footerInfo/footerAction/footer, external, variant, cls — components.js:187
- table({columns, rows, zebra, caption, showCaption, foot, rowsClickable, emptyText}) — DIE Tabelle: th scope row/col, align/width (colgroup), caption→benannte Region, tfoot, Leerzeile, sichtbarer Hinweis «Tabelle seitlich scrollbar» — components.js:263
- empty(msg, opts) — Leerzustand; available:false/unavailable = «nicht verfügbar» mit Warnsymbol; hint-Zweitzeile; action als Link oder Button — components.js:310
- notFound({backHref, backLabel, title, body}) — Standard-«nicht gefunden»-Block — components.js:338
- renderNotFound(ctx, opts) — ganzer Nicht-gefunden-ABLAUF: setTitle + Krumen («Nicht gefunden») + Markup, thing trägt das Genus — components.js:358
- activeFilters({filters, resetHref, resetLabel, label}) — Aktive-Filter-Pillen (tag-item) in zwei Modi: href je Pille (Hash) oder data-remove/data-reset (JS-State) — components.js:375
- announce(msg) — Ansage in die persistente #live-Region (nur Text mutieren) — components.js:400
- preserveFocus(mount) — merkt Fokus + Schreibmarke, Restore-Funktion überlebt innerHTML-Neuaufbau — components.js:417
- wireScrollRegions(root) — tabindex=0/role=group NUR bei echtem Überlauf (gemessen), Mutation-+ResizeObserver mit rAF-Drossel, Abmeldefunktion — components.js:438
- FOCUSABLE (Selektor-Konstante) + trapFocus(container) — die EINE Fokusfalle aller Overlays — components.js:480-492
- openModal(opts) — kanonisches Modal: trapFocus, Escape in Erfassungsphase (stopPropagation — schliesst nicht die Galerie darunter), Backdrop-/data-modal-close-Klick, Scroll-Lock body--overlay-open, Fokusrückgabe an den Auslöser — components.js:517-543
- cardAction({external}) — dekorative Icon-Fussaktion (aria-hidden, Name trägt der Kartenlink) — components.js:557
- domainTile({icon, title, desc, meta, href, external}) — bildlose Icon-Kachel-Karte mit Stretched-Link — components.js:571
- openShareModal(url, title) — Teilen-Dialog: readonly-URL-Feld (vorselektiert), «Link kopieren» via Clipboard-API mit execCommand-Fallback, Erfolgs-/Warn-Badge in aria-live-Region — components.js:634
- wireShare(root) — globale Delegation: Klick auf [data-share] öffnet den Teilen-Dialog — components.js:660
- detailBar({backHref, backLabel}) — Zurück-Link links + Share-Bar (Drucken window.print, Teilen) rechts — components.js:671, shareBar components.js:591
- heroFigure({src, id, color, alt, w, ratio}) — Hero-Kontextbild im natürlichen Format; `ratio` erlaubt explizit 16x9/4x3/21x9 am fachlichen Konsumenten — components.js:691
- detailHead({backHref, backLabel, title, lead, tags, image}) — Detailseiten-Kopf: detailBar + Hero (section) mit/ohne Bild — components.js:696
- pipeline(steps, currentIndex, {label}) — Chevron-Status-Stepper done/active/todo mit sr-Präfixen und aria-current=step — components.js:714
- detailSection({title, body, titleTag}) — Detailabschnitt mit Titel — components.js:736
- accordion(items, {id}) — CD-Akkordeon (h3>button, aria-expanded/controls, region) — components.js:747
- wireAccordion(root) — Toggle mit max-height-Animation (transitionend, _accSeq gegen Gegenklick, reduced-motion-fest) — components.js:767
- tabBar({items, active, idPrefix, ariaLabel, panelId, controlsClass}) — Tab-Leiste, Einzel- vs. Mehr-Panel-Verlinkung — components.js:812
- tabPanels({items, active, idPrefix, render, heading}) — Mehr-Panel-Markup, optionale sr-only-h2 je Panel (WCAG 2.4.10) — components.js:832
- wireTabs(root, {onSelect, syncHash}) — APG-Tabs: roving tabindex, Klick + Pfeile/Home/End, Panel-Umblendung, Fokus überlebt Neurender, aktiver Tab scrollIntoView; gibt {activate} zurück — components.js:846
- notification(text, variant, iconName, opts) — 6 Varianten (info/success/warning/error/hint/alert); live:true → role status bzw. alert; dismissible mit delegiertem Schliesser + Ansage «Hinweis geschlossen.» — components.js:907, 892-904
- processDone({instance, lead, title, heading, text, extra, actions}) — Erfolgsscreen eines eingereichten Vorgangs: Success-Notification mit Referenz, Überschrift (h1/h2, tabindex=-1), Knopfreihe (erste gefüllt) — components.js:935
- stepIndicator(labels, current, {label}) — nummerierte CD-Schrittanzeige mit sr-Zuständen Erledigt/Aktuell/Offen — components.js:957
- flashError(mount, msg) — Fehlerband oben im Container + Ansage (clientseitige Aktionsfehler) — components.js:971
- backLink(href, label) — CD-Zurück-Knopf, sichtbar «Zurück», aria-label «Zurück zu <Ziel>» — components.js:983
- select(o) — CD-Select: Label (hideLabel/required/negative), Hint, Fehler-Badge OHNE Live-Rolle (errorSummary ist die eine Statusmeldung), aria-describedby/invalid, bare/variant/size, disabled, attrs — components.js:991
- errorSummary({errors, labels, id}) — Fehlerübersicht am Formularkopf (role=alert, Sprungmarken je Feld, Singular/Plural-Titel) — components.js:1047
- selectBox(inner, extraCls, style) — Select-Hülle mit CD-Chevron-Overlay — components.js:1065
- wireErrorSummary(mount, {focus}) — Sprungmarken-Klick → Feld-Fokus+Scroll; Fokus auf die Übersichts-Überschrift — components.js:1071
- field(o) — Feld-Wrapper für input/textarea: name/autocomplete/inputmode, Hint VOR dem Feld, Fehler-Badge, control(cls, attrs)-Callback — components.js:1085
- val(mount, id) / readForm(mount, map) — Formularwerte einzeln bzw. als Objekt lesen — components.js:1120, 1125
- downloadItem(o) — CD-Download-Zeile (Dokument/App/Ressource/Anhang); Titel standardmässig h3, per `heading` auf h2–h6 anpassbar; href '#' degradiert zu aria-disabled «Im Prototyp nicht verfügbar»; meta-Zeile, wrapLi, download-Attribut — components.js:1137
- contactBox(contact, opts) — CD-Kontaktkasten (dl kv--stack, mailto escaped, unit = Direktionsbereich) — components.js:1160
- actionCard({title, lead, links}) — Randspalten-Karte «Aktionen» (fp-svc-Zeilen mit Folgepfeil, bewusst ohne führende Icons) — components.js:1195
- contactCard({title, contacts}) — Randspalten-Karte «Ansprechpersonen» (dt=Rolle, Name entfällt bei Dublette) — components.js:1209
- downloadLink(url, label, icon) — Demo-Download als Link oder aria-disabled-Ersatz — components.js:1223
- pagination({page, totalPages, href, inputId, label, align}) — CD-Blätterleiste: editierbares Seitenfeld, «von N Seiten», prev/next als echte disabled-Buttons; href-Modus (Hash) oder data-page-Modus (lokal); ab 2 Seiten — components.js:1235
- wirePagination(mount, inputId, page, totalPages, go) — bindet Seitenfeld (change/Enter, Klemmen) UND data-page-Buttons — components.js:1272
- catalogueResults(o) — gemeinsamer Ergebnisblock: sr-only-h2, resultsHeader (Trefferzahl + viewSwitch), Galerie (gap--top-Raster)/Liste/Karte (Karte = ALLE Treffer, ungeblättert), Pagination, Leerzustand mit Reset-Aktion, Ausfallzustand — components.js:1319
- announceCatalogue(o) — Standard-Ansage «X von Y Einheit, Seite …, Ansicht Galerie/Liste/Karte» — components.js:1370
- catalogueHash(base, state) — Katalog-URL-Bau: q/filters/page/view; Defaults (page 1, defaultView) bleiben aus der URL — components.js:1400
- wireCatalogue(mount, opts) — Hash-Katalogverdrahtung: Suche (Submit→Seite 1), Filter-Dropdowns, Sortierung, Filterpanel-Umschalter + Mehrfach-Checkboxen (data-fdim→Hash), Ansichtswechsel, Pagination — components.js:1419
- catalogueBar(o) — kompakte Katalogleiste (catbar): Suche+Trefferzähler | Sortierung (bare Select, sr-Label) · Filter-Knopf mit Aktiv-Zähler · viewSwitch; einklappbares Filterpanel; PANEL_OPEN-Gedächtnis überlebt Neuaufbau — components.js:1480, 1478
- mountDataTable(host, opts) — Tabelle mit Katalogleiste + Pagination in LOKALEM Zustand (q/sort/page/facets — kein Hash, weil in Registerkarten): Suche, Sortierung, Facetten, Leer-ZEILE statt Leerzustand (Kopf bleibt stehen), foot-Summenzeile, rowsClickable, Fokus-Restaurierung, Observer-Abmeldung, Ansage; gibt Abbaufunktion für ctx.onUnmount zurück — components.js:1553
- wireTableRows(root) — Zeilenklick folgt dem ERSTEN Link; Bedienelemente und Textauswahl bleiben unangetastet; AbortController-Abmeldung — components.js:1658
- filterGroup({dim, legend, options, selected, idPrefix, max}) — Checkbox-Facettengruppe (fieldset/legend, stabile ids), max-Kappung mit verstecktem Rest + [data-fmore]-Knopf — components.js:1675
- menu({menuId, items, label, align, triggerIcon}) — Kebab-Aktionsmenü (role=menu/menuitem, Gruppentitel, Separator, data-action statt inline onclick) — components.js:1700
- wireMenu(root, onAction) — Menü-Verdrahtung: Öffnen/Schliessen, Pfeile/Home/End, Escape (Fokus auf Trigger), focusout-Schliesser, EIN globaler Ausserhalb-Klick-Schliesser — components.js:1737, 1720
- toast(msg, variant, iconName) — selbstverschwindende Statusmeldung (5 s, Ein-/Ausblende-Klasse) + announce über #live (aria-live feuert in frischem Knoten nicht) — components.js:1779
- catalogueState(query, opts) — Lese-Seite des Katalogmusters: q/view/sort/filters/page aus der Hash-Query parsen, validieren (Whitelists), klemmen; liefert hash(patch) und clamp(list)→{visible, totalPages, page} — components.js:1806
- wireCatalogueState(mount, opts) — JS-State-Zwilling für Explorer: Debounce-Suche (250 ms) + Submit, Ansichtswechsel, Sortierung, Filterpanel mit Zähler-Badge, Aktiv-Pillen (data-remove/data-reset, onRemove für Fremd-Tokens wie 'sel'), onReset; liefert {updateFilterBadge, syncFilterChecks, clearFilters} — components.js:1845
- panelReset({href, id, label, wrap}) — kanonischer «Filter zurücksetzen»-Knopf/Link für die 13 Filterpanels — components.js:1921
- wireFieldErrors(mount, errors) — Feldfehler verschwinden bei Korrektur (input UND change, once; Badge wird entfernt, aria-invalid weg) — components.js:1935
- focusProcessDone(mount, instance) — Fokus auf die Erfolgs-Überschrift + Ansage «Vorgang erstellt. Referenz …» — components.js:1955
- wizardHead(labels, step, opts) — Wizard-Kopf: stepIndicator + sr-only-Schrittüberschrift (Fokusziel) + Pflichtfeld-Legende — components.js:1963
- focusWizardStep(mount, labels, step) — Schrittwechsel: Fokus auf Schrittüberschrift + Ansage MIT Schrittnamen — components.js:1972
- contextLine({action, name, org, process}) — Kontextzeile unter der Formular-h1 («<Aktion> als NAME · ORG · Prozess: …») — components.js:1981
- loginGate(text) — Login-Hinweis (hint-Notification mit Lock-Icon) + Knopf «Anmelden mit AGOV / FedLogin» (window.__login); kein Inhalt wird versteckt — components.js:1990
- Sammel-Export C mit allen ~76 Bausteinen + default-Export — components.js:2005-2018

**Zustände**

- loading: sichtbares vs. sr-only-Label (hideLabel), Grössenvarianten — components.js:98
- empty: drei Stufen — schlicht / mit hint+action / available:false-Ausfallvariante (Altname unavailable wird weiter gelesen) — components.js:310-334
- table: gefüllt vs. Leerzeile (emptyText unterscheidet «keine Daten» von «nichts für diese Auswahl» in mountDataTable) — components.js:294, 1606-1610
- Scroll-Regionen: is-scrollable + tabindex/role nur bei gemessenem Überlauf; sonst entfernt — components.js:438-455
- notification: statisch vs. live (role status/alert) vs. dismissible — components.js:907-919
- catbar-Filterpanel offen/zu mit modulweitem PANEL_OPEN-Gedächtnis (überlebt Hash-Neuaufbau) — components.js:1478, 1487
- mountDataTable-Zustand: q/sort/page/open/sel je Instanz; Seitenklemmen bei schrumpfender Treffermenge — components.js:1560, 1579-1581
- pagination: erste/letzte Seite → echte disabled-Buttons; ≤1 Seite → keine Leiste — components.js:1236-1242
- Tabs: aktiv/inaktiv (aria-selected, roving tabindex, hidden-Panels) — components.js:812-885
- Akkordeon offen/zu (aria-expanded, hidden nach transitionend) — components.js:767-800
- Modal offen (Scroll-Lock, Fokusfalle) vs. geschlossen (Fokusrückgabe) — components.js:517-543
- Aktionsmenü offen/zu (aria-expanded, nur eines offen) — components.js:1737-1771
- Formularfelder: Fehlerzustand (input--error, aria-invalid, Badge) vs. korrigiert (wireFieldErrors) — components.js:991-1116, 1935
- downloadItem/downloadLink: echtes Ziel vs. aria-disabled «Im Prototyp nicht verfügbar» — components.js:1148-1153, 1223-1228
- Teilen-Dialog: Erfolg («Link kopiert») vs. Fehlschlag («Kopieren nicht möglich — bitte von Hand markieren») — components.js:646-647

**Interaktionen**

- Katalog-Suche: Submit → Seite 1 (Hash) bzw. Debounce-Tipp-Suche 250 ms (JS-State) — components.js:1422-1426, 1851-1854
- Sortier-Dropdown → Hash bzw. State, Seite 1 — components.js:1432-1435, 1862-1863
- Filter-Knopf klappt Panel; Checkbox-Änderung (data-fdim) schreibt alle Werte der Dimension in Hash/State — components.js:1439-1453, 1879-1888
- Aktive-Filter-Pille entfernen (Link oder data-remove-Button), «Alle Filter zurücksetzen» (Link oder data-reset) — components.js:375-395, 1892-1910
- Ansichtswechsel Galerie/Liste/Karte (view-switch, aria-pressed, stabile ids für Fokus-Restaurierung) — components.js:1378-1390, 1455-1457
- Pagination: prev/next-Klick, Seitenzahl tippen + Enter/Change (geklemmt) — components.js:1272-1286
- Tabellenzeilen-Klick folgt erstem Link (rowsClickable); Kopieren markierter Zellen bleibt möglich — components.js:1658-1669
- [data-fmore]-Knopf deckt gekappte Facettenwerte auf («Alle anzeigen (N)») — components.js:1687-1691
- Tabs: Klick + ArrowLeft/Right/Up/Down, Home/End; optional syncHash — components.js:868-877
- Akkordeon-Knopf: Klick toggelt mit Animation — components.js:768-798
- Aktionsmenü: Trigger-Klick, ArrowUp/Down/Home/End, Escape (Fokus zurück), Auswahl → onAction(action, menuId, trigger), focusout/Ausserhalb-Klick schliesst — components.js:1743-1770
- Modal: Escape (capture), Backdrop-Klick, [data-modal-close], Tab-Kreis via trapFocus — components.js:517-543
- Teilen: [data-share]-Klick → Dialog; «Link kopieren» (Clipboard/execCommand); Drucken-Knopf window.print() — components.js:591-667
- Banner-/Notification-Schliessen ([data-banner-close]/[data-notification-close], delegiert) mit Ansage — components.js:171-177, 892-904
- Fehlerübersicht: Sprungmarken-Klick → Feld-Fokus + Scroll zentriert — components.js:1071-1081
- empty-action: Reset-Link/Button direkt im Nullzustand — components.js:325-329
- loginGate-Knopf «Anmelden mit AGOV / FedLogin» (window.__login) — components.js:1998-2000
- panelReset-Knopf/Link «Filter zurücksetzen» — components.js:1921-1927
- Tastaturzugang zu überlaufenden Scrollflächen (tabindex 0 via wireScrollRegions) — components.js:438-455

## js/router.js

Hash-Router: NAV-Definition, Seiten-/App-Registry mit dynamischem Import, Altlast-Weiterleitungen, 404, Ladezustand, Scroll-/Fokus-Strategie, Brotkrumen und ctx-Vertrag für alle Module.

**Routen**

- #/ und #/home → pages/home.js (Startseite) — router.js:90-92
- #/services(/…) → pages/services.js (params = Restsegmente, z. B. #/services/<serviceId>) — router.js:93
- #/applications(?area=…|?bereich=…) → pages/applications.js — router.js:94
- #/data(/…) → pages/data.js (u. a. /catalog, /digitalisation/{strategy,vision,principles,superb,bim}, /ict-projects als Untersegmente) — router.js:95
- #/knowledge(/…) → pages/knowledge.js (it, procurement, accommodation, publishing, guides, processes) — router.js:96
- #/news(/…) → pages/news.js — router.js:97
- #/my-cases → pages/my-cases.js — router.js:98
- #/search?q=… → pages/search.js — router.js:99
- #/app/space-request → apps/space-request.js — router.js:102
- #/app/fault-report → apps/fault-report.js — router.js:103
- #/app/portfolio(?id=…) → apps/portfolio.js — router.js:104
- #/app/projects → apps/projects.js — router.js:105
- #/app/document-archive → apps/document-archive.js — router.js:106
- #/app/workspace → apps/workspace.js — router.js:107
- #/app/transaction → apps/transaction.js — router.js:108
- #/app/dataportal → apps/dataportal.js — router.js:109
- #/app/api-docs → apps/api-docs.js — router.js:110
- #/app/building-create → apps/building-create.js — router.js:111
- #/app/media-library → apps/media-library.js — router.js:112
- #/app/tenancies → apps/tenancies.js — router.js:113
- #/app/metadata-catalog → apps/metadata-catalog.js — router.js:114
- #/app/process-docs → apps/process-docs.js — router.js:115
- #/app/<segmente> — Segmente NACH dem App-Namen landen als ctx.params (Deep-Links in Apps) — router.js:340-344
- Unbekannte Route → 404 «Seite nicht gefunden» mit Startseiten-Link — router.js:355-361
- Redirect: #/knowledge/news(/*) → #/news(/*) — router.js:142
- Redirect: #/knowledge/(grundlagen|regulations|general)(/*) → #/knowledge — router.js:147
- Redirect: #/knowledge/anleitungen → #/knowledge/guides — router.js:148
- Redirect: #/knowledge/prozesse → #/knowledge/processes — router.js:149
- Redirect: #/knowledge/templates → #/knowledge — router.js:150
- Redirect: #/data/katalog(/*) → #/data/catalog(/*) — router.js:151
- Redirect: #/data/digitalisierung(/sub) → #/data/digitalisation mit SUBS-Mapping (strategie→/strategy, prinzipien→/principles, vision, superb, bim) — router.js:152, 156
- Redirect: #/data/ikt-vorhaben → #/data/ict-projects — router.js:153
- Redirect: #/app/mediathek(/*) → #/app/media-library(/*) — router.js:154
- Redirects erhalten den Query-Teil und laufen über history.replaceState (kein Zurück-Loop) — router.js:161-168, 310-315
- Nicht-#/-Hashes (leer, #main-content, Platzhalter-#) dispatchen NICHT — kein 404 über der Seite — router.js:446-452

**Funktionen**

- NAV-Export (5 L1-Einträge: Dienstleistungen, Daten und Digitalisierung, Wissen und Hilfsmittel, News, Meine Vorgänge) mit children/childrenFrom:'themen'/branchKey-Zweigen — router.js:14-87
- SECTION_OF: Nav-Hervorhebung für Seiten/Apps ohne eigenen L1-Eintrag (applications→data; space-request/fault-report/building-create→services; übrige Apps→data) — router.js:120-127
- ctx-Vertrag: mount, params, query (URLSearchParams), core, engine, session, C, onUnmount(fn), stale(), navigate(h), setTitle(t) (Suffix «· BBL Kundenportal»), setCrumbs — router.js:227-243
- Brotkrumen-Rendering (CD-Anatomie, Chevron im Link, letzte Krume als span aria-current=page); leeres Array versteckt die Leiste — router.js:212-225
- Aufschiebbare Datenbestände: mod.needs → core.ensure VOR dem Render (sonst «keine Einträge» statt Daten) — router.js:384-387
- Zentrales C.wireScrollRegions je Route (Tastaturzugang für überlaufende Tabellen/Code-Kästen, WCAG 2.1.1) — router.js:397-398
- Scroll-Strategie: History-Einträge nummeriert (history.state.bblIdx), Positionen je Eintrag in sessionStorage bbl_scroll_v1; neue Navigation → Seitenanfang, Zurück/Vorwärts → gemerkte Position, Query-Zustandswechsel → Position bleibt — router.js:262-297, 422-430
- Drill-in-Regel: ändert ein Query-Wechsel die H1 (Liste → Objekt, z. B. portfolio?id=…), gilt er als Navigation → Scroll auf Inhaltsanfang + Fokus H1 — router.js:399-421
- legacyTarget(hash)-Export (testbare Redirect-Auflösung) — router.js:161-168
- matchesSubNav-Export: Sub-Nav-Aktivlogik mit Query-Teilmengenprüfung (Übersicht nur ohne Params aktiv; ?topic=bauten bleibt aktiv wenn &view=liste dazukommt) — router.js:182-200
- redraw()-Export: aktuelle Route neu zeichnen ohne Navigation (Login/Logout); gibt das dispatch-Promise zurück — router.js:456-461
- Route-Cleanups: ctx.onUnmount-Funktionen laufen zu Beginn des nächsten Dispatch, Fehler einzelner Cleanups stoppen die Navigation nicht — router.js:302-309

**Zustände**

- Ladezustand: C.loading-Spinner (sr-only-Label) in aria-busy-Container + Ansage «Inhalt wird geladen…» über #live — NUR bei echter Navigation, nicht bei Query-Zustandswechsel (kein Aufblitzen) — router.js:363-374
- 404-Zustand (Titel «Seite nicht gefunden», Fokus auf h1) — router.js:355-361
- Render-Fehlerzustand: error-Notification «Diese Ansicht konnte nicht geladen werden.» mit Fehlermeldung, role=alert (live:true) — router.js:431-437
- Veraltete Dispatches (Ticket-System dispatchId/stale) werden nach Modul-Load, ensure und render verworfen — router.js:259, 317-318, 377-389
- Zustandswechsel vs. Navigation: gleicher Pfad + andere Query = Zustandswechsel (kein H1-Fokus, keine Scroll-Rücksetzung, Fokus-Restaurierung per activeId) — router.js:326-336, 399-421
- Aktive Nav-Hervorhebung (.active + aria-current=page) und Sub-Nav (menu__item--active) je Dispatch neu berechnet — router.js:170-209
- Brotkrumen hidden bis die Seite setCrumbs ruft (je Dispatch zurückgesetzt) — router.js:353

**Interaktionen**

- hashchange-Navigation (nur #/-Hashes); initRouter setzt #/ wenn kein gültiger Hash — router.js:440-454
- Fokusführung: nach Navigation Fokus auf H1 (tabindex=-1, preventScroll); nach Zustandswechsel Fokus zurück auf das auslösende Element (per id) oder H1 (nie an body verlieren) — router.js:245-251, 399-421
- ctx.navigate(h) als programmatischer Navigationsweg der Module — router.js:239
- Keine eigenen sichtbaren Bedienelemente — Interaktionen liegen in Shell und Seitenmodulen

## js/session.js

Mock-Session für AGOV/FedLogin: Demo-Nutzerin in localStorage, kein Rollen-/Rechtekonzept; Inhalte bleiben abgemeldet sichtbar, nur das Starten eines Vorgangs verlangt Anmeldung.

**Funktionen**

- Demo-User «Andrea Muster, Bundesamt für Umwelt BAFU» — session.js:11
- Persistenz in localStorage-Schlüssel bbl_session_v1 (via storage.js readJSON/writeJSON/remove) — session.js:8-10, 19-21
- Validierung isUser: nur Objekt mit nicht-leerem name gilt; korrupter Bestand → abgemeldet starten (M20) — session.js:13-16
- API: user(), isLoggedIn(), login() (Stub ohne echten Redirect), logout(), onChange(fn) mit Abmeldefunktion — session.js:24-32
- Listener-Emit mit try/catch je Abonnent (ein defekter Abonnent bricht die anderen nicht) — session.js:22

**Zustände**

- Angemeldet (user gesetzt) vs. abgemeldet (null); Startzustand aus localStorage, sonst abgemeldet
- Bewusst KEIN Rollen-/Berechtigungskonzept — Login zeigt nur den Flow «Vorgang starten» — session.js:1-6

**Interaktionen**

- login()/logout() programmatisch (Header-Knöpfe, loginGate-Knopf via window.__login)
- onChange-Abo: Header und aktive Seite zeichnen sich bei Sessionwechsel neu

## js/shell.js

CD-Bund-Shell: Top-Bar, Marken-/Logo-Zeile, Meta-Navigation mit Login, Header-Suche, Desktop-Flyout- und Mobile-Drawer-Navigation mit Drill-down, Brotkrumen-Container und Footer inkl. Back-to-top.

**Funktionen**

- Skip-Link «Zum Inhalt springen» (#skip-link → Fokus #main-content, preventDefault gegen den Hash-Router) — shell.js:194, 371-377
- Top-Bar: externer Link «Alle Schweizer Bundesbehörden» (unter 640px nur Icon sichtbar) — shell.js:199
- Demo-Chip «Prototyp» mit title + sr-only-Langtext (Login/Engine/Datenkern simuliert) — shell.js:201
- Top-Bar-Navigation «Bundesangebote»: eGate (extern, External-Icon) — shell.js:72-74, 202
- Sprachwahl-Select: nur DE, disabled, Begründung im Label/title («weitere Sprachen im Prototyp nicht verfügbar») — shell.js:186-191
- Mobiler Titelstreifen «Bundesamt für Bauten und Logistik — Kundenportal» (aria-hidden, kompensiert das unter 480px verborgene Amtslogo) — shell.js:213-215
- Logo-/Markenzeile: Schweizer Flagge + Wortmarke, Akronym «BBL», Amtstitel + «Kundenportal», Link auf #/ (Startseite, sr-only-Zusatz) — shell.js:219-228
- Meta-Navigation: «Notfall & Vorfälle» → #/services/sicherheitsvorfall-melden, «Hilfe» → #/knowledge/guides — shell.js:64-71
- Anmeldestatus: abgemeldet «Anmelden»-Knopf (User-Icon, window.__login); angemeldet User-Icon + Name + vertikaler Separator + «Abmelden» (window.__logout) — shell.js:171-180
- Header-Suche (CD search--main): Toggle-Knopf mit aria-expanded/controls, role=search-Formular, sr-Label, Submit-Knopf — shell.js:232-243
- Burger-Knopf (aria-label/expanded/controls) — shell.js:244-248
- Desktop-Hauptnavigation aus NAV: Einträge mit Kindern als Flyout-Knopf (aria-expanded/controls), sonst Direktlink mit data-nav — shell.js:142-157, 254-263
- Desktop-Menü-Overlay (.desktop-menu__overlay) hinter offenem Flyout — shell.js:255
- Flyout-Drawer je Nav-Punkt: role=group, h2-Drawer-Titel, «Schliessen»-Knopf nur im Desktop-Baum — shell.js:107-139
- Drill-down-Drawer (navy--drill): Pane 0 (Direktlinks + Zweig-Knöpfe) / Pane 1 (Zurück-Knopf, fokussierbarer Zweigtitel, Zweig-Liste) — shell.js:107-120
- Dienstleistungs-Drawer DATENGETRIEBEN: jedes Thema mit ≥1 startbarer Dienstleistung (type=action) wird Zweig; Zweig-Inhalt = «Alle anzeigen» → #/services?topic=<key> + je Dienstleistung → #/services/<serviceId> — shell.js:38-53, 490-503
- Nav-Zweige aus NAV_BRANCHES (child.branchKey, z. B. «Digitalisierung» mit 4 L2-Seiten) — shell.js:57-60, 504-509
- Externe Drawer-Links mit target=_blank rel=noopener external + External-Icon — shell.js:18-25
- Mobile-Menü: Suchformular zuoberst, Hauptnavigation, Meta-Navigation (inkl. Auth), Top-Bar-Links + «Alle Schweizer Bundesbehörden» — shell.js:265-286
- Brotkrumen-Container #breadcrumb (nav aria-label=«Sie sind hier», hidden bis setCrumbs) — shell.js:288-290
- Footer: Back-to-top-Knopf im Seitengraben (Fokus auf #main-header, scrollTo 0, preventDefault gegen Routen-Überschreibung) — shell.js:304-310, 605-611
- Footer-Spalte 1: Amtsbeschrieb, Prototyp-Hinweis, Adresse Fellerstrasse 21 — shell.js:314-323
- Footer-Spalte 2 «Prototyp»: GitHub-Quellcode (extern), #/app/api-docs, Webauftritt Bundesverwaltung (extern) — shell.js:324-331
- Footer-Spalte 3 «Weitere Informationen»: #/knowledge, #/news, #/applications, #/data, #/my-cases, #/services/sicherheitsvorfall-melden, #/services — shell.js:332-342
- Footer-Rechtsleiste (nav «Rechtliches»): Impressum, Rechtliches, Datenschutz, Barrierefreiheit (alle extern admin.ch) — shell.js:346-354

**Zustände**

- Angemeldet vs. abgemeldet (authNav wechselt; Header wird bei Login/Logout komplett neu gerendert) — shell.js:171-180
- Pro-Render-AbortController wirft globale document/window/matchMedia-Listener der Vorrunde ab — shell.js:12, 364-366
- Mobilmenü offen/zu: body--mobile-menu-is-open, aria-expanded/label am Burger, main+footer inert, CSS-Variablen --topbar-h/--shell-top werden BERECHNET (nicht mitten in der Transition gemessen) — shell.js:382-403
- Flyout offen/zu je Nav-Punkt: panel.hidden, aria-expanded, .clicked; immer nur eines offen — shell.js:447-473
- Overlay nur auf Desktop (min-width 1024px) sichtbar — shell.js:420-424
- Drill-down data-level 0/1; Reset auf Ebene 0 bei jedem Öffnen/Schliessen — shell.js:468-469
- Panel-Positionierung + gemessener max-height-Deckel nur Desktop (sonst letzte Einträge unerreichbar) — shell.js:425-446
- Suche offen/zu: body--search-is-open, .open, aria-expanded; unter lg eigene Zeile, Logo blendet aus — shell.js:570-579
- Sprachwahl dauerhaft disabled (nur DE)
- Aktiver Nav-/Sub-Nav-Eintrag (.active/menu__item--active + aria-current) wird vom Router je Dispatch gesetzt

**Interaktionen**

- Skip-Link-Klick → Fokus + Scroll auf #main-content — shell.js:371-377
- Burger-Klick öffnet/schliesst Mobilmenü (aria-label wechselt «Menü öffnen/schliessen») — shell.js:404-405
- Mobil-Suche absenden → schliesst Drawer, navigiert #/search?q=… (leer → #/search) — shell.js:407-413
- Link-Klick im Mobilmenü schliesst es — shell.js:414
- Viewport-Wechsel auf ≥1024px schliesst das Mobilmenü automatisch (matchMedia change) — shell.js:415
- Nav-Knopf-Klick toggelt sein Flyout (stopPropagation); anderes offenes schliesst — shell.js:474-479
- Drawer-«Schliessen»-Knopf (Desktop) schliesst und fokussiert den Trigger — shell.js:480-487
- Zweig-Knopf-Klick füllt Pane 1 und fokussiert den Zweigtitel (SR liest den Zweig an) — shell.js:516-525
- «Zurück»-Knopf → Ebene 0, Fokus zurück auf den Zweig-Knopf — shell.js:526-533
- Klick auf echten Link im Drawer schliesst alle Menüs (Delegation, erfasst auch nachgeladene Drill-down-Links) — shell.js:537-539
- Overlay-Klick / Klick ausserhalb von Header-Triggern+Drawern schliesst Menüs — shell.js:540, 554-556
- Escape: erst Drill-down eine Ebene zurück (Fokus auf Zweig-Knopf), zweiter Escape schliesst Flyout (Fokus auf Trigger); schliesst auch das Mobilmenü (Fokus Burger) — shell.js:541-553
- Fenster-Resize repositioniert offenes Panel + Overlay — shell.js:557-563
- Such-Toggle: nur Klick bzw. Enter/Space öffnet (kein focusin — WCAG 3.2.1), Fokus ins Feld nach 60ms — shell.js:580-583
- Escape im Suchfeld schliesst die Suche, Fokus auf Toggle — shell.js:584
- Such-Submit → #/search?q=… und schliesst die Suche — shell.js:585-590
- Klick ausserhalb der offenen Suche schliesst sie — shell.js:591-595
- «Anmelden»/«Abmelden»-Knöpfe rufen window.__login/__logout (inline onclick) — shell.js:177-180
- Back-to-top-Klick → tabindex=-1 + Fokus auf #main-header, window.scrollTo(0) — shell.js:605-611

## js/combobox.js und js/search-suggest.js

Gemeinsamer WAI-ARIA-Controller für Eingabefelder mit Listbox-Popup. Die globale
Suche und die swisstopo-Adresssuche besitzen weiterhin eigenes Datenladen und
Markup, teilen aber Fokus-, Auswahl- und Schliessverhalten.

**Funktionen und Zustände**

- `createListboxController({input, list, onChoose, ...})` setzt role=combobox, `aria-expanded`, `aria-controls`, `aria-autocomplete` und `aria-activedescendant`
- `setItems`, `highlight`, `choose` und `close` verwalten Optionen, zyklische aktive Auswahl und `aria-selected`
- `destroy` entfernt Listener und die vom Controller gesetzten ARIA-Attribute; beide Konsumenten rufen ihn beim Unmount auf
- Geschlossen, geöffnet ohne aktive Option und geöffnet mit aktiver Option sind identisch für Suche und Adresssuche umgesetzt

**Interaktionen**

- ArrowDown/ArrowUp wechseln zyklisch die aktive Option, Enter übernimmt, Escape und Tab schliessen
- Mousedown auf einer Option erhält den Eingabefokus bis zur Auswahl; Klick und optional Pointer-Bewegung wählen beziehungsweise markieren
- `test-combobox.mjs` prüft Tastatur, aktive Nachfahren, Auswahl und Cleanup beider Konsumenten

## js/pages/anchor-nav.js

Geteiltes CD-Ankernavigations-Layout (detailPageAnchorNav): Abschnitte links, klebendes Inhaltsverzeichnis rechts; genutzt von 6 Wissens- und 3 Digitalisierungs-Seiten. Keine eigene Route.

**Routen**

- Keine eigene Route — liest ?section=<id> der Trägerseite für den Direktsprung (anchor-nav.js:6-10, 67-74; Query statt Sprungmarke, weil ein zweites # den Hash-Router bräche)

**Funktionen**

- Abschnitts-Sections mit fokussierbarer h2 (tabindex=-1, anchor-nav.js:14-18)
- Inhaltsverzeichnis als Card+menu, sticky (sticky--top), aktiver Abschnitt via .menu__item--active (anchor-nav.js:26-45)
- Mobil (<768px): ToC als eingeklappte <details> VOR dem Inhalt (container--reverse-mobile); ≥768px dauerhaft offen, summary ausgeblendet (anchor-nav.js:22-25, 95-107)
- detailBar mit Zurück-Link, pageHeader mit Titel/Lead, optionale intro-Zeile (anchor-nav.js:47-61)

**Zustände**

- ToC offen/zu je Viewportbreite, per matchMedia('min-width:768px') synchronisiert (anchor-nav.js:100-107)
- Scroll-Spy: zuletzt überschrittener Abschnitt aktiv, OFFSET 140px (anchor-nav.js:124-136)
- ?section-Sprung nach Router-h1-Fokus via requestAnimationFrame (anchor-nav.js:68-74)
- Listener-Abbau: AbortController je Render + onUnmount; Selbstabmeldung beim Scroll nach Seitenwechsel als Netz (anchor-nav.js:88-93, 128)

**Interaktionen**

- ToC-Klick: preventDefault, smooth scrollIntoView, Fokus auf Abschnittsüberschrift (anchor-nav.js:110-118)
- Mobile: <details>-Summary auf-/zuklappen
- Scrollen aktualisiert die aktive ToC-Markierung (passiver scroll-Listener)
- Akkordeons im Inhalt (z. B. FAQ) via C.wireAccordion (anchor-nav.js:142)
- Zurück-Link zur Trägersektion

## js/pages/applications.js

Anwendungskatalog nach demselben Muster wie #/services (catbar, Pills, Galerie/Liste, Pagination), Lesezustand über C.catalogueState gebündelt; die Detail-Landingpage delegiert per dynamischem Import an application.js; needs=['applications','contacts'] (applications.js:17).

**Routen**

- #/applications — Katalog aller Anwendungen (applications.js:36-47)
- #/applications?q=… — Volltextsuche über name+description+group (applications.js:66-67)
- #/applications?area=a,b — Mehrfach-Bereichsfilter aus APP_AREAS (domain.js); «Fachanwendungen Bauten» ist kein eigener Seitentyp, nur ?area=buildings (applications.js:5-6,59)
- #/applications?audience=a,b — Mehrfach-Zielgruppenfilter (applications.js:59,69)
- #/applications?view=list|gallery · ?sort=name|group · ?page=N — Ansicht/Sortierung/Pagination via C.catalogueState, 12 pro Seite (applications.js:19,30,56-61,74)
- #/applications/<appId> — Landingpage je Anwendung; dynamischer Import von ./application.js, appId in Karten-hrefs encodeURIComponent-kodiert (applications.js:38-45,87)

**Funktionen**

- Katalog-Toolbar C.catalogueBar: Suchfeld, Zähler «X von Y Anwendungen · Seite p von n», Sortier-Select, Filter-Knopf mit Zählbadge, View-Toggle (applications.js:124-138)
- Galerieansicht: C.card mit lokalem Foto aus a.bild.src (assets/images/applications, kein Unsplash-Rückfall — ohne Datei Farbfläche), Zielgruppen-Tags, Badges «Schlüsselanwendung»(info) und «Externes System»(gray), Gruppenlabel im Footer (applications.js:84-98)
- Listenansicht: C.table zebra mit Spalten Anwendung (Link+Beschreibung), Bereich, Zielgruppe, Einstieg (Badge «Externes System» gray vs «Im Kundenportal» blue); Zeile klickbar (applications.js:100-116)
- Aktive-Filter-Pills (Suche/Bereich/Zielgruppe) mit Reset auf #/applications (applications.js:77-82)
- Filterpanel: Bereich mit navLabel (nicht group-Label — ein Name je Wert im Klickpfad, D24) und Zielgruppe aus reference-data (applications.js:129-136)
- Standardreihenfolge: Schlüsselanwendungen (hero) zuerst, explizite Sortierung überschreibt (applications.js:71-73)
- Screenreader-Ansage des Ergebnisstands via C.announceCatalogue (applications.js:150)
- Seitenkopf mit festem Lead-Text; Brotkrumen Startseite › Daten und Digitalisierung (#/data) › Anwendungen (applications.js:47-52,120-123)

**Zustände**

- Laden: Bestände applications/contacts via export needs vor render (applications.js:14-17)
- Überholte Navigation: nach await import bricht ctx.stale() ab, damit keine alte Ansicht die neue überschreibt (A2) (applications.js:43)
- Leer/gefiltert-leer: C.catalogueResults mit resetHref und unit «Anwendungen» (applications.js:140-147)
- Teilbestand: available: core.available('applications') (applications.js:146)
- Filter aktiv: Pills nur bei Suche/Filtern; Filterzähler = areas+audiences am Knopf (applications.js:77-82,128)
- Ansichtszustand gallery vs list und Sortierung leer(=hero zuerst)|name|group, im Hash persistiert (applications.js:28-30,61,73)
- Pagination geklemmt über st.clamp(apps) (applications.js:74)
- Karten-Sonderzustände: hero-Badge, external-Badge, fehlendes Bild → Farbfläche (applications.js:88-96)

**Interaktionen**

- Suchformular app-search/aq (Submit setzt q via C.wireCatalogue) (applications.js:125,152-155)
- Sortier-Select app-sort (applications.js:127,154)
- Filter-Knopf app-filter klappt Panel app-filters auf/zu (applications.js:128-129,154)
- Mehrfachauswahl-Checkboxen Bereich und Zielgruppe im Panel (applications.js:134-135)
- Panel-Reset-Link (area+audience leeren) (applications.js:136)
- View-Toggle Galerie/Liste (Icons Apps/List) (applications.js:137)
- Pill-Klick entfernt einen Filterwert; «Zurücksetzen» auf #/applications (applications.js:77-82)
- Pagination mit Seitenlinks und Seiteneingabefeld app-page (applications.js:144-145,153)
- Kartenklick auf #/applications/<appId> und Zeilenklick der Listenansicht (C.wireTableRows, Abbau via ctx.onUnmount) (applications.js:87,156-158)

## js/pages/catalog.js

Datensatzkatalog nach DCAT-AP-CH mit Katalog-Muster (catbar, Filter, Galerie/Liste, Pagination) und Detailansicht je Datensatz; Zustand komplett in der URL via C.catalogueState.

**Routen**

- #/data/catalog — Liste (catalog.js:16)
- #/data/catalog?q=… — Volltextsuche über Titel+Beschreibung+fullDescription (catalog.js:55)
- #/data/catalog?topic=…&classification=…&tag=… — Mehrfach-Filter (tag: UND-Verknüpfung, catalog.js:58; tag nur via Detailseiten-Pills setzbar, kein Panel-Filtergroup)
- #/data/catalog?sort=title|thema|date — Sortierung; leer = Datenreihenfolge (catalog.js:43-52)
- #/data/catalog?view=gallery|list — Ansichtsumschaltung
- #/data/catalog?page=N — Pagination, 12 pro Seite (PER_PAGE, catalog.js:8)
- #/data/catalog/<id> — Detailansicht, id URL-dekodiert via C.safeDecode (catalog.js:154)
- #/data/catalog/<unbekannte-id> — «Datensatz nicht gefunden» (catalog.js:157-161)

**Funktionen**

- Galerieansicht: C.card mit Vorschaubild (lokales d.image, catalog.js:295-297), Badges Thema (blau)/Klassifizierung (Farbrampe public→success … secret→error, catalog.js:304-306)/Personenbezogen-Warnung (catalog.js:83-84), Footer mit Formatliste
- Listenansicht: Zebra-Tabelle, Spalten Datensatz (Link+Beschreibung)/Thema/Klassifizierung-Badge/Formate, ganze Zeile klickbar (catalog.js:89-105)
- Trefferzähler «X von Y Datensätzen · Seite p von n» (catalog.js:115)
- Datumssortierung parst deutsche Datumstexte «10. Mai 2025» (DE_MON, catalog.js:44-45)
- Detail: detailHead mit Zurück-Link, Lead, Schlagwort-Pills, Vorschaubild; Abschnitte Beschreibung, Verantwortliche Personen (AdminDir-Links, catalog.js:174-177), Metadaten (10 kv-Zeilen: Kontaktstelle-mailto, Ausgabedatum, Aktualisierungsintervall, Status, Klassifizierung, Personenbezogene Daten, Archivwürdig, Thema, Rechtsgrundlage, Bemerkung; catalog.js:180-192)
- Detail: Bereitstellungsformen als CD-Akkordeon je Distribution mit 8 DCAT-Feldern (Identifikator, Titel, Zugriffs-/Download-URL als externe Links, Status, Dateiformat, Lizenz mit Klartext-Label catalog.js:311-314, Bemerkungen) + Button «Datensatz beziehen» (catalog.js:196-226)
- Detail: Publikationen in externen Katalogen als kv-Liste, Name verlinkt nur wenn url vorhanden (catalog.js:233-240)
- Schlagwort-Pills auf der Detailseite führen als gesetzter tag-Filter zurück in den Katalog (catalog.js:168-169)

**Zustände**

- Der delegierende Daten-Routenvertrag lädt `datasets` und `catalogLabels` vor `render()` (`data.js:4-21`); Lade-/Nichtverfügbar-Zustand via `available: core.available('datasets')` an `catalogueResults` (catalog.js:135)
- Leerer Treffer-Zustand mit unit {nom:'Datensätze', dat:'Datensätzen'} und Reset-Link (catalog.js:128-132)
- Aktive Filter als Pills (Suche/Thema/Klassifizierung/Tag) mit «alle zurücksetzen» (catalog.js:66-72)
- Filterpanel auf-/zuklappbar mit Filterzähler im Button (catalog.js:117-123)
- Seiten-Clamp via st.clamp() bei zu hoher page (catalog.js:62)
- Detail-Leerzustände: keine verantwortliche Person, keine Bereitstellungsform, keine externe Publikation, fehlende Metawerte als «—» (catalog.js:258-272)
- 404-Zustand Datensatz mit Rücksprung #/data/catalog

**Interaktionen**

- Suchformular (formId ds-search, Absenden setzt ?q=)
- Sortier-Dropdown ds-sort (Titel A–Z / Thema / Ausgabedatum neuste zuerst)
- Filter-Button klappt Panel; Checkbox-Gruppen Thema+Klassifizierung; Panel-Reset-Link (catalog.js:118-123, Bugfix-Hinweis: Parameter heisst classification, catalog.js:121-122)
- Pill-Entfernen als reine Links ohne JS (catalog.js:64-71)
- Ansichtsumschaltung Galerie/Liste (catalog.js:124)
- Pagination mit Seiteneingabefeld ds-page + Links (catalog.js:133-134, 142)
- Zeilenklick in Listenansicht via wireTableRows, Abbau via onUnmount (catalog.js:145-147)
- Screenreader-Ansage des Ergebnisses via announceCatalogue (catalog.js:139)
- Detail: Akkordeon auf-/zuklappen (wireAccordion, catalog.js:277), mailto-Kontakt, externe Links (AdminDir, Zugriffs-/Download-URLs, Publikationskataloge; alle target=_blank rel=noopener external), Download-Button «Datensatz beziehen», Tag-Pill-Navigation, Zurück-Link

## js/pages/data.js

Abschnitts-Übersicht «Daten und Digitalisierung» plus Delegator: lädt Unterseiten (catalog, ict-projects, digitalisation) per dynamischem Import; ihr routenabhängiger `needs(params)`-Vertrag wird allein vom Router sichergestellt (data.js:4-30, router.js:453-461).

**Routen**

- #/data — Abschnitts-Übersicht mit Angebots-Kacheln
- #/data/catalog[...] — delegiert an catalog.js; `needs(params)` liefert dafür `datasets` und `catalogLabels` aus derselben Unterrouten-Registry (data.js:4-21)
- #/data/ict-projects — delegiert an ict-projects.js
- #/data/digitalisation[...] — delegiert an digitalisation.js
- #/data/<unbekannt> — 404 via C.renderNotFound (data.js:97)

**Funktionen**

- Zwei CD-Bänder: pageHeader-Band + getöntes Band «Angebote» mit sichtbarem section__title (data.js:81-88)
- 11 domainTile-Kacheln: Datenportal, Datenbezug/API, Metadaten Katalog Bauten, Prozessdokumentation Bauten, Bauwerksdokumentation, Mediathek Bauten, 3× Fachanwendungen (area-Filter buildings/logistics/federal), Alle Anwendungen, Digitalisierung
- Live-Zähler in Kachel-Meta: Datensatzanzahl aus core.datasets(), Anwendungszahlen je area aus core.applications() (data.js:34-36); Metadaten-/Prozess-Kacheln bewusst OHNE Zahl (data.js:45-50)
- Deep-Links mit Query in Kacheln: #/applications?area=buildings|logistics|federal

**Zustände**

- Routenabhängiges `needs(params)`: Übersicht lädt `applications` + `datasets`, Katalog lädt `datasets` + `catalogLabels`, IKT/Digitalisierung/404 laden keinen aufschiebbaren Bestand; allein der Router führt `core.ensure` aus (data.js:4-28, router.js:453-461)
- Stale-Guard: nach await keine überholte Navigation überschreiben (ctx.stale(), data.js:29)
- 404-Zustand für unbekannte Unterroute mit Rücksprung nach #/data

**Interaktionen**

- Kachel-Klicks (11 Ziele, inkl. Query-Deep-Links)
- Breadcrumb Startseite → Daten und Digitalisierung
- 404: Zurück-Link «Daten und Digitalisierung»

## js/pages/digitalisation.js

Themenbereich Digitalisierung: Karten-Übersicht mit vier Bändern plus fünf Unterseiten — drei Ankernavigations-Seiten (Strategie, Vision, Prinzipien) und zwei Platzhalter-Info-Landingpages (SUPERB, BIM).

**Routen**

- #/data/digitalisation — Übersicht (digitalisation.js:17)
- #/data/digitalisation/strategy — Digitalisierungsstrategie (Ankernav, 4 Abschnitte)
- #/data/digitalisation/vision — Vision/Mission/Zielbild (Ankernav, 3 Abschnitte)
- #/data/digitalisation/principles — 8 Prinzipien + Leitplanken (Ankernav, 9 Abschnitte)
- #/data/digitalisation/superb — Info-Landingpage Platzhalter
- #/data/digitalisation/bim — Info-Landingpage Platzhalter
- #/data/digitalisation/<unbekannt> — 404 (digitalisation.js:223)
- ?section=<id> auf den drei Ankernav-Seiten — Direktsprung zum Abschnitt (via anchor-nav.js:67-74)

**Funktionen**

- Übersicht mit 4 Bändern: pageHeader, Themen-Kacheln (5 CARDS, digitalisation.js:28-39), Prosa-Band «Über uns», Linkliste «Weitere Informationen» (5 Links inkl. extern bk.admin.ch; digitalisation.js:60-69); Prosa in container__center--xs-Mass (digitalisation.js:51)
- Strategie: Abschnitte Auftrag/Zweck, 4 Handlungsfelder als Box-Grid (digitalisation.js:94-97), Umsetzung/Steuerung, Dokumente mit 2 downloadItems (Platzhalter-href '#', digitalisation.js:101-105); intro-Zeile Strategiezeitraum (digitalisation.js:111)
- Vision: Abschnitte Vision, Mission, Zielbild mit Aufzählung Immobilienkreislauf (digitalisation.js:124-140)
- Prinzipien: 8 nummerierte Abschnitte aus PRINZIPIEN-Array mit C.markLang-Auszeichnung (digitalisation.js:152-170) + Abschnitt «Verbindliche Leitplanken»
- Info-Landingpages: detailHead mit heroFigure-Foto und Platzhalter-Notification (infoPage, digitalisation.js:186-201)

**Zustände**

- Keine needs — komplett statisch, kein Laden/leer
- 404-Zustand für unbekannte Unterroute mit Rücksprung #/data/digitalisation
- Ankernav-Zustände (ToC eingeklappt/offen, aktiver Abschnitt) siehe anchor-nav.js

**Interaktionen**

- Themen-Kacheln (5), Links im Prosa-/Linkband (davon 1 extern target=_blank)
- Ankernav-Seiten: Inhaltsverzeichnis-Sprung, Scroll-Spy, Zurück-Link «Digitalisierung» (via anchorNavPage)
- Strategie: 2 Download-Einträge (Platzhalter)
- Info-Landingpages: Zurück-Link «Digitalisierung»

## js/pages/home.js

Startseite (Arbeitsfläche): Hero mit Portalsuche, danach abwechselnde Bänder — offene Vorgänge, häufige Dienstleistungen, Anwendungs-/Hilfsmittel-Auswahl, News. needs=['news','applications'].

**Routen**

- #/ — Startseite (einzige Route, keine Unterrouten/Query-Varianten)

**Funktionen**

- Hero hero--main-image: h1 «Willkommen im BBL Kundenportal», Beschreibung, Foto Fellerstrasse 21 mit srcset (800/1400/AVIF 2048) + figcaption © BBL (home.js:175–204)
- Portal-Suchformular im Hero (role=search, sr-only-Label) als CTA-Slot (home.js:179–183)
- Block «Meine offenen Vorgänge»: C.table (zebra, rowsClickable) mit Spalten Referenz (Link auf Vorgangsdetail), Titel, Aktualisiert (datum), Status-Badge; max. 5 Zeilen; Mehr-Link «Alle Vorgänge anzeigen» → #/my-cases (home.js:72–91)
- Block «Häufig gebraucht»: Text-Kacheln (quick-tile mit Icon, h3-Label, Meta) der Dienstleistungen mit popular-RANG, sortiert nach Rang; Link je Kachel → #/services/<serviceId>; Mehr-Link → #/services (home.js:58–65, 100–105)
- Block «Anwendungen, Hilfsmittel und weitere Angebote»: 5 fest verdrahtete C.card-Kacheln (Datenportal, Liegenschaften Inventar, IT/IKT-Beschaffung→#/knowledge/it, Bundespublikationen-Shop, Bauwerksdokumentation); Anwendungs-Kacheln führen auf die Landingpage #/applications/<appId>, Bild aus applications.json `bild`, nur die Wissens-Kachel aus dem heroes-Pool (home.js:124–152)
- Block «News»: 3 neueste Meldungen als C.card (Bild/Farbe, Footer Datum · Quelle), Mehr-Link → #/news (home.js:37, 156–165)
- Bänder wechseln weiss/grau via C.pageSection alt-Flag nach Reihenfolge (home.js:50, 168)

**Zustände**

- Angemeldet UND offene Vorgänge vorhanden → Vorgangs-Block; abgemeldet oder alles geschlossen → Block entfällt komplett (home.js:72)
- «offen» = Status nicht in CLOSED ['abgeschlossen','erledigt','geliefert'] (home.js:21, 39)
- Keine popular-Dienstleistungen → Block «Häufig gebraucht» entfällt (home.js:101)
- Keine News → News-Block entfällt (home.js:156)
- Highlight-Block erscheint immer (kein Leerzustand)
- needs=['news','applications'] — Router lädt Bestände vor render, sonst leere Listen (home.js:20)

**Interaktionen**

- Suche absenden (Submit/Enter) → #/search?q=<begriff>, leeres Feld → #/search (home.js:212–216)
- Suchvorschläge via attachSuggest (nur Dienstleistungen + Wissen/Hilfsmittel); Cleanup über ctx.onUnmount beim Routenwechsel (home.js:222–223)
- Zeilenklick in der Vorgangstabelle folgt dem Referenz-Link (C.wireTableRows, rowsClickable) (home.js:209)
- Referenz-Link je Zeile → links.vorgang(instanceId) (home.js:81)
- Kachel-, Karten- und «Alle …»-Links (Dienstleistungsdetail, Applikations-Landingpages, #/knowledge/it, #/my-cases, #/services, #/news)
- h1 mit tabindex=-1 als Fokusziel des Routers (home.js:177)

## js/pages/ict-projects.js

Statische Übersichtstabelle der sechs IKT-Vorhaben des BBL (Demo-Inhalt, an SUPERB/BIM/GEVER angelehnt), jede Zeile verlinkt auf die zugehörige Portal-Seite.

**Routen**

- #/data/ict-projects — einzige Ansicht (kein Sub-Routing, keine Query)

**Funktionen**

- Demo-Hinweis-Notification (hint/InfoCircle, ict-projects.js:85)
- Zebra-Tabelle mit 6 Vorhaben (SUPERB, BIM/CDE, Kundenportal, Metadatenkatalog, GEVER, PVA-Monitoring; ict-projects.js:5-60), Spalten Vorhaben (Link+Kürzel)/Inhalt/Federführung/Zeitraum/Status-Badge
- Status-Badges: In Planung (info), In Umsetzung (warning), Abgeschlossen (success), Fallback gray (ict-projects.js:62-66, 100)
- Zeilen-Deep-Links in andere Module: #/applications, #/applications?area=buildings, #/services, #/data/catalog, #/app/document-archive, #/app/dataportal/energie-klima

**Zustände**

- Nur ein Zustand — statischer Bestand ohne needs, kein Laden/leer/Fehler

**Interaktionen**

- Zeilenklick (rowsClickable) folgt dem Titel-Link, Abbau via onUnmount (ict-projects.js:94, 109)
- Titel-Links direkt klickbar; Breadcrumb Startseite → Daten und Digitalisierung → IKT-Vorhaben

## js/pages/knowledge.js

Wissen und Hilfsmittel: Übersicht mit 6 Fachgebiets-Kacheln plus je eine Ankernavigations-Seite pro Fachgebiet; Inhalt (AREAS/FAQS) kommt aus js/knowledge-content.js, Layout aus anchor-nav.js.

**Routen**

- #/knowledge — Übersicht (knowledge.js:28)
- #/knowledge/it — Informatik und IKT-Beschaffung (5 Abschnitte, 39 Unterlagen)
- #/knowledge/procurement — Beschaffung (4 Abschnitte)
- #/knowledge/accommodation — Unterbringung und Objektbetrieb (4 Abschnitte)
- #/knowledge/publishing — Publikationen, Druck und Versand (3 Abschnitte)
- #/knowledge/guides — Anleitungen und Schulungen (2 Abschnitte)
- #/knowledge/processes — Prozessdokumentation (Prozessportal-Abschnitt + FAQ)
- #/knowledge/<area>?section=wi-<id> — Direktsprung zu einem Abschnitt (Suche/Kurzlinks; DOM-id-Präfix wi- via sectionDomId, knowledge-content.js:238)
- #/knowledge/<unbekannt> — 404 «Dieses Fachgebiet» (knowledge.js:104)

**Funktionen**

- Übersicht: 2 Bänder, 6 domainTile-Kacheln mit gerechnetem Unterlagen-Zähler je Fachgebiet (count aus sections.items, knowledge.js:40-55); processes-Kachel mit Text-Meta statt Zahl
- Fachgebietsseite: Ankernav-Layout mit Titel/Lead/optionalem intro (mit Querverweis-Links, z. B. it↔procurement, knowledge-content.js:21,78)
- Drei Abschnittsformen: Dokumentliste (items als C.downloadItem-ul), freier HTML-Inhalt (html, ggf. als Funktion mit C), FAQ-Akkordeon (knowledge.js:76-94)
- downloadItem wählt Icon selbst: Download für Datei, External für externes Ziel (kein icon-Override, knowledge.js:84-92); Platzhalter-Downloads href='#', download-Attribut nur für Nicht-Externe
- Unterlagen-Metadaten je Eintrag (Format, Grösse, Quelle wie fedlex.admin.ch/bkb.admin.ch; knowledge-content.js durchgängig)
- processes-Seite: Wegweiser-Text mit Link auf #/app/process-docs und externem CD-Button «Zum Prozessportal (Archimap)» (knowledge-content.js:210-221), FAQ-Akkordeon mit 5 Fragen (FAQS, knowledge-content.js:227-233)
- Interne Deep-Links in Unterlagenlisten (z. B. #/services/sicherheitsvorfall-melden, #/app/dataportal; knowledge-content.js:27,108)

**Zustände**

- Keine needs — Bestand ist im JS-Bundle (knowledge-content.js bewusst JS statt JSON, knowledge-content.js:8-10)
- 404-Zustand für unbekanntes Fachgebiet mit Rücksprung #/knowledge
- FAQ-Akkordeon auf-/zugeklappt; ToC-Zustände siehe anchor-nav.js
- ?section-Deep-Link: Abschnitt gescrollt + Überschrift fokussiert (anchor-nav.js:67-74)

**Interaktionen**

- Fachgebiets-Kacheln (6)
- Download-Einträge (Klick = Download bzw. externer Absprung mit External-Icon)
- FAQ-Akkordeon auf-/zuklappen (C.accordion + wireAccordion via anchor-nav.js:142)
- Querverweis-Links in intro-Texten (it↔procurement, guides→Fachgebiete, processes→#/services)
- Externer Button Archimap (target=_blank)
- Inhaltsverzeichnis-Navigation + Zurück-Link «Wissen und Hilfsmittel» (via anchorNavPage)

## js/pages/my-cases.js

Meine Vorgänge: einziger persönlicher Bereich (Login-Gate), Liste über C.mountDataTable mit Suche/Sortierung/Status-Facette/Paginierung, Detailseite mit Pipeline und drei Tabs (Daten/Anhänge/Verlauf) inkl. Tab-Deep-Link. needs=['buildings','projects'].

**Routen**

- #/my-cases — Vorgangsliste (angemeldet) bzw. Login-Gate (abgemeldet) (my-cases.js:15)
- #/my-cases/<id> — Vorgangsdetail, Tab «Daten» aktiv (my-cases.js:26)
- #/my-cases/<id>?tab=attachments|history — Tab-Deep-Link; tab=data wird nicht in die URL geschrieben, ungültige Werte fallen auf «data» zurück (my-cases.js:154–155, 190)

**Funktionen**

- Login-Gate mit AGOV/FedLogin-Aufforderung statt Inhalt (C.loginGate) (my-cases.js:18–22)
- Kennzahlen-Stats: «Vorgänge total» und «offen / in Arbeit» (Status nicht in abgeschlossen/erledigt/geliefert) (my-cases.js:31–41)
- Vorgangstabelle (C.mountDataTable, id 'cases'): Spalten Referenz (Link), Titel, Typ (defName), Aktualisiert (datum, Fallback createdAt), Status-Badge (my-cases.js:55–74)
- Detailkopf: Status-Pille, h1 «Referenz — Titel», Lead «Eingereicht <Datum> · Typ <defName> [· Organisation]» (my-cases.js:163–165)
- Prozess-Ablaufleiste C.pipeline(steps, stepIndex) aus der Prozessdefinition (my-cases.js:170)
- Warn-Notification «Ablauf nicht verfügbar» wenn die Prozessdefinition fehlt (statt leerer Pipeline, M17) (my-cases.js:171–174)
- Tab «Daten»: Karten Antragsteller (Name+Organisation), Standort (verknüpftes Gebäude: Name, Adresse, WE/EGID, Button «Gebäude ansehen» → links.objekt) und Verknüpftes Projekt (Name, Projektnummer, Button «Projekt ansehen» → links.bauprojekt) (my-cases.js:113–124)
- Tab «Daten», Abschnitt «Eckdaten»: eingereichte Formularfelder als dl.kv--ruled, Schlüssel über DATA_LABELS lesbar übersetzt (inkl. Gebäude-Erfassungs-Felder) (my-cases.js:79–90, 129–133)
- Tab «Anhänge»: Download-Liste (C.downloadItem, href '#') mit Typ/Grösse, Hinweis «Demodateien — im Prototyp nicht herunterladbar»; Anhangszahl im Tab-Label «Anhänge · N» (my-cases.js:137–141, 150)
- Tab «Verlauf»: Ereignis-Timeline (Status, Zeitpunkt, optionale Notiz) aus i.history (my-cases.js:144–146)
- Demo-Fortschaltung: Button «Nächster Schritt (Demo)» bzw. Fusszeile «Vorgang abgeschlossen.» / «Seed-Vorgang (Demo) — nicht weiterführbar.» (my-cases.js:181–184)
- Not-Found-Seite «Vorgang nicht gefunden» (C.renderNotFound, Zurück → #/my-cases) (my-cases.js:95–99)
- detailBar mit Zurück zu «Meine Vorgänge» (my-cases.js:159)

**Zustände**

- Abgemeldet → Login-Gate, Kataloginhalte bleiben andernorts frei (my-cases.js:15–24)
- Unbekannte Vorgangs-id → NotFound (my-cases.js:95)
- Aktiver Tab aus ?tab=, ungültig → «data» (my-cases.js:154–155)
- canAdvance nur wenn createdLocally && Definition vorhanden && stepIndex < letzter Schritt (my-cases.js:108)
- Definition fehlt → Warnung statt Pipeline UND keine Abschluss-Fusszeile (my-cases.js:170–174, 183)
- Keine Anhänge → C.empty «…keine Anhänge hinterlegt.» im Tab (my-cases.js:141)
- Keine dataEntries (leere/null-Werte gefiltert) → Abschnitt «Eckdaten» entfällt (my-cases.js:110, 129–133)
- Kein verknüpftes Gebäude/Projekt → jeweilige Karte entfällt (my-cases.js:106–107, 124)
- Listen-Zustände über mountDataTable: Suchbegriff aktiv, Sortierung gewählt, Status-Facette gefiltert, Seitenwechsel (10/Seite) (my-cases.js:55–66)
- Status-Facettenoptionen dynamisch aus den vorhandenen Vorgängen (my-cases.js:51–52)
- needs=['buildings','projects'] für die Verknüpfungs-Karten (my-cases.js:9)

**Interaktionen**

- Tabellen-Toolbar: Suche über reference/title/defName («Vorgang suchen»), Sortierung (Zuletzt aktualisiert / Referenz / Titel A–Z), Status-Facettenfilter, Paginierung 10/Seite (C.mountDataTable) (my-cases.js:55–66)
- Zeilenklick folgt dem Referenz-Link (rowsClickable, tbl-8) (my-cases.js:54–56)
- Tabs: Klick + Tastatur (Pfeiltasten/Home/End, roving tabindex, APG) via C.wireTabs (my-cases.js:189)
- Aktiver Tab wird per history.replaceState in die Hash-Query gespiegelt — teilbar/lesezeichenbar ohne Neurendern (my-cases.js:190)
- Button «Nächster Schritt (Demo)» → engine.advance + location.reload (my-cases.js:192–193)
- Buttons «Gebäude ansehen» / «Projekt ansehen» → Objekt- bzw. Bauprojekt-Detail (my-cases.js:120, 123)
- detailBar Zurück-Link; Anhang-Einträge als (Demo-)Download-Items mit href '#'

## js/pages/news.js

News-Bereich: chronologische Kartenliste (#/news) und Einzelmeldung als eigene Leseseite (#/news/<id>). Bewusst ohne Tabs/Filter. needs=['news'].

**Routen**

- #/news — Liste aller Mitteilungen, chronologisch absteigend sortiert (news.js:27)
- #/news/<id> — Einzelmeldung; id via C.safeDecode aus params[0] (news.js:18–19)

**Funktionen**

- Liste: C.pageHeader mit Titel+Lead, sr-only h2 «News-Beiträge», 3-Spalten-Kartenraster (C.card mit Bild/Fallback-Farbe, Teaser, Footer «Datum · Quelle», Stretched-Link mit echter h3) (news.js:29–47)
- Detail: C.detailBar (Zurück zu News + Teilen/Drucken-Leiste wie alle Detailseiten) (news.js:71)
- Detail-Artikel: Lesespalte container__center--xs, header mit Datumszeile «Datum · Quelle» + h1, Bild 21:9 (C.photo, max-height 20rem), Lead-Teaser, Separator, Body-Absatz (news.js:76–87)
- Not-Found-Seite über C.renderNotFound («Mitteilung nicht gefunden», Zurück → #/news) (news.js:58–62)
- Brotkrumen: Liste Startseite→News; Detail Startseite→News→Titel; Titel via setTitle (news.js:24–25, 64–65)

**Zustände**

- Liste leer → C.empty «Keine Mitteilungen vorhanden.» mit available-Hinweis (core.available('news')) (news.js:50)
- Unbekannte id → NotFound-Ansicht statt Detail (news.js:58)
- needs=['news'] — Bestand wird vor render sichergestellt (news.js:13)

**Interaktionen**

- Kartenlink (gesamte Karte klickbar, Stretched-Link) → #/news/<id> via links.news (news.js:43)
- detailBar: Zurück-Link zu #/news plus die Standard-Aktionen der Leiste (Teilen/Drucken) (news.js:71)
- NotFound: Zurück-Link «News»
- h1 mit tabindex=-1 als Fokusziel (news.js:80)

## js/pages/search.js

Föderierte Suche (#/search?q=…): baut den Index über 8 Inhaltsarten, ein Ergebnisstrom mit Inhaltsart-Facette, Sortierung, Listen-/Galerieansicht und Paginierung; Zustand komplett im Hash. Plus Suchprotokoll-Diagnose (?log=1). needs=['applications','datasets','documents','news','contacts','buildings','projects'].

**Routen**

- #/search — leere Suchseite mit Hinweistext und Indexgrösse (search.js:122–123)
- #/search?q=<begriff> — Ergebnisseite (search.js:33, 41)
- #/search?q=…&kind=<Art>[,<Art>…] — Inhaltsart-Facette, kommagetrennt (search.js:60, 76)
- #/search?q=…&sort=title|kind — Sortierung; leer/ungültig = Relevanz aus runSearch (search.js:63–72, 79)
- #/search?q=…&view=gallery — Galerieansicht; Default list wird nicht geschrieben (defaultView) (search.js:62, 85)
- #/search?q=…&page=N — Paginierung, geklemmt auf 1…totalPages (search.js:73, 80–82)
- #/search?log=1 — Suchprotokoll-Diagnoseansicht statt Ergebnissen (search.js:38, 120–121)

**Funktionen**

- Grosses CD-Suchfeld (search--large search--page-result) im ersten Band, vorbelegt mit q (search.js:139–148)
- Index über 8 Inhaltsarten (buildIndex): Dienstleistungen (boost für Vorgänge +12 und popular-Rang), Anwendungen, Wissen und Hilfsmittel (113 Unterlagen, Ziel = Abschnitt der Fachgebietsseite, external möglich), Datensätze, Dokumente (Deep-Link ins Archiv MIT ?q=<Titel>), News, Liegenschaften (bbl_id zusätzlich ohne Schrägstriche indexiert), Bauprojekte (Pfadsegment-Link) (search.js:189–293)
- `extra`-Feld je Zeile: unsichtbar durchsuchbares Fachvokabular aus den Daten (Domänenlabel, Voraussetzungen, Kontaktname, Tags, Ort …) statt Synonymtabelle (search.js:180–188)
- Eigene Vorgänge BEWUSST nicht im Index (persönliche Arbeitsliste, Datenschutz der Antragsteller) (search.js:285–289)
- Trefferzeile (Liste): Meta «Inhaltsart · Meta», h3-Titel, Beschreibung; externe Treffer mit External-Icon, target=_blank rel=noopener external (search.js:45–57)
- Galerieansicht: C.card mit Inhaltsart-Badge (blau) und Footer «Typ · Meta» (search.js:94–99)
- catalogueBar-Toolbar: Trefferzähler «X von Y Treffern für ‹q› · Seite p von n», Sortier-Dropdown, Filter-Knopf mit Zähler, aufklappbares Facetten-Panel (Inhaltsart mit Trefferzahl je Art — aus den Treffern, nicht dem Index), Panel-Reset, Ansichtsumschaltung Liste/Galerie; kein zweites Suchfeld (search.js:87–113)
- Aktive-Filter-Pillen mit Einzeln-Entfernen und «alle zurücksetzen» (C.activeFilters) (search.js:115–118)
- Paginierung 10 Treffer/Seite mit Seiteneingabe (C.catalogueResults, paginationHref über hash) (search.js:74, 125–131)
- Keine-Treffer-Ansicht: Anfrage wiederholt, «Einzelne Begriffe führen weiter» (jedes Wort ≥3 Zeichen einzeln gesucht, Link + Trefferzahl), Such-Tipps, Kontakt-Notification mit Link zu #/services (search.js:302–325)
- Suchprotokoll (log=1): Zusammenfassung (Anfragen/Begriffe/Null-Treffer/Indexgrösse), Tabelle Begriff (als Suchlink) / Anfragen / Treffer (0 als error-Badge), localStorage-Datenschutzhinweis, Löschen-Button (search.js:328–353)
- Jede Anfrage wird lokal protokolliert (logQuery, js/search-log.js) (search.js:43)
- Screenreader-Ansage der Trefferzahl über persistente Live-Region C.announce (kein aria-live im neu erzeugten Knoten) (search.js:150–159)
- Teilbarer Zustand: q/kind/sort/view/page vollständig im Hash via C.catalogueHash (search.js:84–85)

**Zustände**

- Ohne q → Hinweistext mit Beispielen und Indexgrösse, keine Toolbar (search.js:122–123)
- Treffer vorhanden → Toolbar + Pillen + Ergebnisse; keine Treffer → noResults-Ansicht (search.js:124–132)
- log=1 → Diagnoseansicht verdrängt Ergebnisse, keine Protokollierung und keine Ansage (search.js:41–43, 157)
- Facette aktiv (kind), Sortierung gewählt (ungültige Werte → Relevanz), Ansicht list/gallery, Seite auf gültigen Bereich geklemmt (search.js:60–82)
- Alternativ-Vorschläge nur bei mehrwortiger Anfrage mit treffenden Einzelwörtern (search.js:303–306)
- Protokoll leer → «Noch keine Suchanfragen auf diesem Gerät protokolliert.» (search.js:341)
- needs mit 7 Beständen; buildings/projects bewusst dabei (~76 KB), damit Objekte selbst gefunden werden (search.js:25–29)

**Interaktionen**

- Suchformular absenden → #/search?q=…, leer → #/search (verwirft dabei kind/sort/view/page) (search.js:161–166)
- Sortier-Dropdown, Filter-Panel auf-/zuklappen, Inhaltsart-Checkboxen, Ansichtsumschaltung, Paginierungslinks + Seiten-Eingabefeld — verdrahtet über C.wireCatalogue nur bei Treffern (search.js:170–177)
- Filter-Pille entfernen (je Art) und Reset-Link (Pillenzeile + Panel-Reset) (search.js:110–118)
- Trefferlink öffnen; externe Treffer in neuem Tab (search.js:47–48)
- Vorschlagslinks in der Keine-Treffer-Ansicht starten Einzelwort-Suche (search.js:308–309)
- Button «Protokoll löschen» → logClear + location.reload (search.js:168, 351–352)
- h1 mit tabindex=-1 als Fokusziel (search.js:138)

## js/pages/services.js

Dienstleistungskatalog (nur type=action) mit Suche/Filter/Sortierung/Galerie-Liste/Pagination plus Detailseite je Dienstleistung mit Zugriffskarte, Prozess-Pipeline, CTA und Login-Gate; deklariert needs=['applications','contacts','documents'] für core.ensure vor render (services.js:7).

**Routen**

- #/services — Katalog aller startbaren Dienstleistungen (type=action; type=info bewusst ausgeblendet, services.js:24-28)
- #/services?q=… — Volltextsuche über title+short+description (services.js:38)
- #/services?audience=a,b — Mehrfach-Zielgruppenfilter, kommagetrennt im Hash (services.js:18)
- #/services?topic=a,b — Mehrfach-Themenfilter (Domain-Keys, kommagetrennt) (services.js:19)
- #/services?view=list|gallery — Ansichtsumschaltung, Default gallery (services.js:20)
- #/services?sort=title|domain — Sortierung Bezeichnung A–Z bzw. Bereich; leer = Datenreihenfolge (services.js:31-36)
- #/services?page=N — Pagination 12 pro Seite, geklemmt auf 1..totalPages (services.js:21-22,43-45)
- #/services/<serviceId> — Detailseite; auch für type=info erreichbar, damit geteilte Links nicht ins Leere laufen (services.js:10,27)

**Funktionen**

- Katalog-Toolbar C.catalogueBar: Suchfeld, Trefferzähler «X von Y Dienstleistungen · Seite p von n», Sortier-Select, Filter-Knopf mit Zählbadge, View-Toggle (services.js:108-115)
- Galerieansicht: C.card mit Titel, Kurztext, Zielgruppen-Tags, Bereichslabel im Footer, Link auf Detail (services.js:56-60)
- Listenansicht: C.table zebra mit Spalten Dienstleistung (Link+Kurztext), Bereich, Zielgruppe; ganze Zeile klickbar (services.js:62-74)
- Aktive-Filter-Pills (Suche/Zielgruppe/Thema) mit Alles-zurücksetzen-Link, rein per href ohne JS deep-linkbar (services.js:78-83)
- «Auch in»-Hinweis bei Suche: Trefferzahl in Anwendungen (#/applications) und Dokumenten (#/app/document-archive) (services.js:51-54,85-90)
- Filterpanel: Zielgruppe aus reference-data, Themen datengetrieben nur wo Vorgänge existieren (Fahne `thema` entfallen, services.js:95-102)
- Screenreader-Ansage des Ergebnisstands via C.announceCatalogue (services.js:127)
- Detail: C.detailHead mit Zurück-Link, Titel, Lead, Zielgruppen-Tags + Badge «Vorgang»(info)/«Information»(gray), Hero-Bild je Domain aus assets/images/heroes mit Farbflächen-Fallback (services.js:207-226)
- Detail: Beschreibung mit sr-only-H2 «Beschreibung» (services.js:234-235)
- Detail: Box «Das brauchen Sie» aus s.voraussetzungen, nur wenn vorhanden (services.js:236)
- Detail: Box «So läuft es ab» — engine.definition(s.processDefId) als C.pipeline mit Schrittzahl und Link auf #/my-cases; entfällt wortlos ohne Definition (services.js:156,237-239)
- Detail: Primär-CTA «Vorgang starten»/«Zum externen System»/«Öffnen» je nach type und target.kind; extern mit target=_blank rel=noopener external (services.js:158-162,198-204)
- Detail-Randspalte: Zugriffskarte (Frei-zugänglich-Text / Sitzungskontext + Karten-CTA / Login-Hinweis mit Anmeldeknopf) (services.js:176-191)
- Detail-Randspalte: Kontaktbox C.contactBox aus core.contacts via s.contact (services.js:151,248)
- Detail-Randspalte: Box «Gesetzliche Grundlagen» mit Verweis auf #/knowledge statt zurückgezogener weisungen.json (services.js:249-256)
- Titel/Brotkrumen je Route: Katalog «Dienstleistungen», Detail Startseite›Dienstleistungen›<Titel> (services.js:12-13,148-149)

**Zustände**

- Laden: Bestände applications/contacts/documents werden vom Router via export needs vor render geladen, sonst zeigten Accessoren leere Listen (services.js:4-7)
- Leer/gefiltert-leer: C.catalogueResults mit resetHref und unit «Dienstleistungen» übernimmt Null-Treffer-Darstellung (services.js:117-124)
- Teilbestand: available: core.available('services') als Verfügbarkeitshinweis (services.js:123)
- Filter aktiv: Pills-Leiste erscheint nur bei aktiver Suche/Filtern; Filterzähler am Filter-Knopf (services.js:78-83,112)
- Ansichtszustand gallery vs list, im Hash persistiert (services.js:20)
- Pagination: page über totalPages wird auf letzte Seite geklemmt (services.js:44)
- Sortierung leer (Datenreihenfolge, Platzhalter «Sortieren») vs title vs domain; unbekannte sort-Werte ignoriert (services.js:36)
- Detail nicht gefunden: C.renderNotFound mit Rücklink und Brotkrumen (services.js:142-147)
- Angemeldet vs. anonym: nur type=action verlangt Login; anonym zeigt C.loginGate statt CTA, Inhalte bleiben stets sichtbar (services.js:163-166,193-194)
- Zugriffskarte dreistufig: Informationsangebot frei / angemeldet mit Name+Org+CTA / abgemeldet mit Lock-Hinweis+Anmeldeknopf (services.js:181-191)
- Ziel fehlt oder «#»-Platzhalter: CTA als aria-disabled-Span bzw. Kartentext «Im Prototyp ist kein Zielsystem angebunden.» statt totem Knopf (services.js:160-162,180,202-204)
- target.kind external vs intern steuert Label, Icon (External/ArrowRight) und _blank (services.js:158-159,177-179)
- Blöcke Voraussetzungen und Ablauf konditional (nur mit Daten) (services.js:236-239)

**Interaktionen**

- Suchformular svc-search/sq (Submit setzt q im Hash via C.wireCatalogue) (services.js:109,130-133)
- Sortier-Select svc-sort (services.js:111,132)
- Filter-Knopf svc-filter klappt Panel svc-filters auf/zu (services.js:112-113,132)
- Mehrfachauswahl-Checkboxen Zielgruppe und Thema im Panel, verdrahtet über C.wireCatalogue (services.js:94-103,129-133)
- Panel-Reset-Link (audience+topic leeren, Suche/Sort bleiben) (services.js:103)
- View-Toggle Galerie/Liste (Icons Apps/List) (services.js:114)
- Pill-Klick entfernt genau einen Filterwert; «Zurücksetzen» auf #/services (services.js:78-83)
- Pagination mit Seitenlinks und Seiteneingabefeld svc-page (services.js:121-122,131)
- Kartenklick und Zeilenklick (Listenansicht, C.wireTableRows mit Abbau via ctx.onUnmount gegen Listener-Anhäufung) (services.js:134-136)
- Links im «Auch in»-Hinweis zu #/applications und #/app/document-archive (services.js:87-88)
- Detail: Zurück-Link zu #/services (services.js:222)
- Detail: CTA-Link/Knopf Inhalt (lg) und Zugriffskarte (sm), extern in neuem Tab (services.js:176-179,198-201)
- Detail: Anmeldeknopf «Anmelden mit AGOV / FedLogin» via window.__login (services.js:189-190)
- Detail: Links auf #/my-cases (Ablauf-Box) und #/knowledge (Grundlagen-Box) (services.js:238,255)

## js/apps/api-docs.js

API-Dokumentation: echtes Swagger UI (swagger-ui-dist, lazy vom CDN) über data/api-specs.json, zur Renderzeit in OpenAPI 3.0.3 übersetzt; Antwort-Beispiele mit echten Portaldaten aus dem core (LIVE-Map, ~40 Endpunkt-Schlüssel, Z.139–184); Portal-Chrome oberhalb, Standard-Swagger darunter.

**Routen**

- #/app/api-docs — Standard-Spezifikation «kundenportal» (params[0]-Fallback, Z.111)
- #/app/api-docs/<specId> — beliebige Spezifikation aus data/api-specs.json (Z.111, 120)
- #/app/api-docs/<specId>?tag=<resource> — scrollt nach dem Swagger-Aufbau zur Ressource; Einstiegslinks je Distribution aus dem Datenbezug-Katalog (Z.4–6, 235–249)

**Funktionen**

- Portal-Kopf: detailBar (Zurück zu «Datenbezug und API Verzeichnis»), H1, Badges «v<Version>» (blau) und Format/REST (grau), Lead-Beschreibung (Z.191–196)
- Echtes Swagger UI 5.17.14 lazy vom CDN (unpkg), BaseLayout, docExpansion 'list' (Z.40–58, 222–231)
- Übersetzung Kurzform-Spez → OpenAPI 3: Pfade, Parameter, requestBody-Beispiel, Response-Codes, Tags, Server-URL (toOpenApi, Z.65–107)
- Live-Beispiele: 200er-Response mit echten core-Daten je Endpunkt (Schlüsselkonvention '<tag>.<endpunkt>', Z.132–184); Fallback auf ep.example aus der Spez (Z.185–188)
- process-definitions.json wird separat geladen (kein core-Bestand) für die Beispiele der Ressource process-definitions (Z.115–118, 140–141)
- Auth-Hinweis der Spez → apiKey-Security-Schema mit Swagger-Schloss + «Authorize»-Dialog (nur Doku, Z.98–104)
- Bewusst deaktiviert: deepLinking (Kollision mit Hash-Router), «Try it out» (supportedSubmitMethods []), Models-Block, externer Validator (Z.228–233)
- Swaggers eigener .information-container per CSS ausgeblendet — Kopf gehört dem Portal (Z.197–200)
- Programmatische sr-only-H2 «API-Ressourcen» benennt den Swagger-Host; `enhanceSwagger` stabilisiert nach React-Updates zugängliche Namen, englische Sprachmarkierungen sowie Fokus-/Zielgrössen der Drittanbieter-Controls
- Krume: Daten → Datenbezug und API Verzeichnis → Spez-Titel (Z.26, 129)

**Zustände**

- Laden: C.loading «API-Dokumentation wird geladen…» im swagger-host, bis die Bibliothek steht (Z.201–204)
- needs deckt den ganzen Datenbestand (21 Bestände) für die Live-Beispiele (Z.32–37)
- Nicht gefunden: renderNotFound bei unbekannter specId — Krume/Titel erst NACH der Prüfung gesetzt (Z.122–128)
- CDN-Fehler/Zeitüberschreitung (12 s): Fehlermeldung mit «Seite neu laden»-Knopf, live-Region (Z.46, 211–219)
- Ladefehler wird nicht gecacht — ein späterer Aufruf lädt die Bibliothek erneut (Z.56)
- stale()-Abbruch nach jedem await (fetchJSON, loadSwaggerUI) gegen überholte Navigation (Z.119, 210, 212)
- api-specs.json-Fetch-Fehler → leeres specs-Objekt → NotFound-Pfad; process-definitions-Fehler → Beispiele entfallen still (Z.114, 118)
- Live-Beispiel-Fehler je Endpunkt abgefangen → Fallback auf Spez-Beispiel (Z.186)

**Interaktionen**

- Zurück-Link zum Datenbezug-Katalog (Z.193)
- Swagger-Standardbedienung: Ressourcen-Abschnitte und Endpunkte auf-/zuklappen, Parameter/Responses lesen
- «Authorize»-Dialog (Schloss-Symbol) — reine Doku ohne Backend-Prüfung (Z.98–104)
- ?tag=-Deeplink: Scroll zur Ressource per Polling (30×100 ms), weil onComplete vor dem fertigen React-DOM feuert (Z.234–250)
- «Seite neu laden»-Knopf im CDN-Fehlerfall (location.reload, Z.216)

## js/apps/building-create.js

Gebäude erfassen — 3-Schritt-Wizard (Standort → Stammdaten → Prüfen & Absenden) mit MapLibre-Kartenpicker und swisstopo-Adresssuche; erzeugt Vorgang 'gebaeude-erfassung'. Kein needs-Export — nutzt core.ref() direkt; einziges der drei Module mit ctx.stale()-Guard (Z.530) und ctx.onUnmount-Cleanup.

**Routen**

- #/app/building-create — Erfassungs-Wizard (router.js:111); keine Query-Varianten

**Funktionen**

- 3-Schritt-Wizard STEP_LABELS «Standort → Stammdaten → Prüfen & Absenden» (Z.25); wizardHead mit gepinnter headId 'bc-step-head' und aria-Label «Erfassungsschritte» (Z.296)
- Schritt 1: MapLibre-Kartenpicker (initPickerMap aus js/buildings-map.js) mit setzbarer/ziehbarer Nadel (Z.455-464); Karte ist optional — Ladefehler wird geschluckt (Z.464)
- Adresssuche als Auflage IN der Karte gegen swisstopo SearchServer api3.geo.admin.ch (schlüssellos, CORS-frei, limit 6, lang de, sr 4326) — SEARCH_URL Z.24, searchAddresses Z.43-57
- Combobox nach WAI-ARIA APG: role=combobox, aria-expanded/-controls/-activedescendant/-autocomplete, Listbox öffnet nach OBEN (Z.139-159)
- swisstopo-HTML-Labels werden als reiner Text entschärft (plainLabel, Z.29-33); Adresszerlegung Strasse/Nr./PLZ/Ort per Regex (splitAddress, Z.36-41)
- Faktenliste nach Lagewahl: Strasse/Nr., PLZ/Ort, Koordinaten WGS 84 auf 5 Dezimalen (Z.168-173, redrawFacts Z.381-394)
- Schritt 2, fieldset «Abgeleitete Angaben»: Objektbezeichnung readonly (= Adresse, bezeichnung() Z.118-119), EGID + EGRID readonly mit Platzhalter «wird ermittelt» (Z.190-201)
- Schritt 2, fieldset «Weitere Stammdaten»: Teilportfolio- und Gebäudeart-Selects aus reference-data (core.ref().teilportfolios/gebaeudearten, Z.85-88), Eigentumsverhältnis Eigentum Bund/Miete, Baujahr-Nummernfeld (Z.202-217)
- Verantwortliche OE aus der Session — bewusst kein Formularfeld, nur Kontextzeile + Zusammenfassung (Z.101-106, 239, 291)
- Kontextzeile mit Prozesspfad «Eingang → Prüfung PFM → Genehmigung → Publikation» (Z.291)
- Schritt 3: Zusammenfassung als kv-Liste (10 Positionen, EGID/EGRID als «wird ermittelt» wenn leer, Z.229-240) + Info-Notification zur nachgelagerten Vergabe von bbl_id/Flächen (Z.241)
- Vorgangserzeugung engine.start('gebaeude-erfassung') mit vollständigem data-Payload inkl. Koordinaten (Z.407-418)
- Erfolgsseite C.processDone mit extra-kv (Referenz, Adresse, Status-Badge «Eingereicht») + Links «Vorgang ansehen»/«Zu den Dienstleistungen» (Z.307-327)

**Zustände**

- Abgemeldet: Login-Gate (AGOV/FedLogin) statt Formular (Z.66-79)
- Schrittzustand 1-3; alle Werte überleben Vor/Zurück im state (Z.94-108)
- Validierung Schritt 1: Lage muss gesetzt sein, sonst Fehler 'bc-address' als Badge unter dem Suchfeld + in der Fehlerübersicht (Z.160-164, 251-253)
- Validierung Schritt 2: Teilportfolio/Gebäudeart Pflicht (leere Vorauswahl «Bitte wählen…», PLEASE_PICK Z.90-92), Baujahr ganzzahlig 1200-2100; Eigentumsverhältnis bewusst ohne required (Z.254-265)
- Suchzustände: Liste offen/geschlossen/leer, aktive Option (activeIdx zyklisch), min. 3 Zeichen, 300 ms Debounce (Z.471-488)
- Fehlerzustand Adresssuche: C.announce «nicht erreichbar» + empty--unavailable-Hinweis mit Fehlermeldung und Ausweg «Lage direkt in der Karte anklicken» (Z.480-486)
- Live-Statusregion #bc-status (aria-live=polite) für die Faktenliste (Z.166)
- Pflichtfeld-Legende nur auf Schritt 2 (legend: state.step === 2, Z.296)
- Erfolgszustand state.created → drawDone; Speicherfehler engine.start null → C.flashError OHNE drawDone-Absturz (Z.419-423)
- Stale-Guard: render bricht ab, wenn die Route während des Ladens schon gewechselt hat (ctx.stale, Z.530)
- Karten-Lebenszyklus: freeMap bei jedem draw und bei Unmount (Z.121, 284, 424, 465)

**Interaktionen**

- Adress-Suchfeld: Tippen mit 300 ms Debounce, ab 3 Zeichen; Clear-Button «Eingabe löschen» (nur sichtbar bei Inhalt) leert + fokussiert zurück (Z.155-156, 467-469)
- Tastaturpfad Combobox: ArrowDown/ArrowUp durchlaufen die Vorschläge zyklisch, Enter wählt die aktive Option, Escape schliesst, Tab schliesst beim Verlassen (Z.490-499)
- Mauspfad: Klick wählt Option, mousemove hebt hervor, mousedown-preventDefault auf der Liste hält den Fokus im Feld, blur schliesst nach 120 ms, Klick ausserhalb schliesst (document-Listener mit AbortController + onUnmount, Z.504-525)
- Karte: Klick in die Karte oder Nadel ziehen setzt lat/lng (onPick → redrawFacts + C.announce «Standort angepasst», Z.457-463); Adresswahl setzt nur die Nadel per __setPin statt Karten-Neuaufbau (Z.373-377)
- Event-Swallow (pointerdown/mousedown/click/dblclick/wheel/touchstart) auf der Suchauflage verhindert Karten-Pan/Zoom beim Bedienen der Suche (Z.447-453)
- «Weiter»/«Zurück» (data-back)/«Erfassung absenden» mit Fokus auf Schrittüberschrift (C.focusWizardStep mit headId, Z.398-431)
- Fehlversuch: Fokus auf Fehlerübersicht + funktionierende Sprungmarken (C.wireErrorSummary, Z.398-405)
- Fehler-Badges räumen bei input UND change (Selects!) ab, inkl. der Adress-Badge (C.wireFieldErrors, Z.433-436)
- Formularfelder Schritt 2: zwei Pflicht-Selects, Eigentums-Select, Baujahr-Nummernfeld; readonly-Felder Objektbezeichnung/EGID/EGRID nicht editierbar
- Fokus + Schreibmarke über Neuaufbau gerettet (C.preserveFocus, Z.282); Erfolgsseite fokussiert Überschrift + sagt Referenz an (C.focusProcessDone, Z.326)
- Login-Gate-Aktion im ausgeloggten Zustand (Z.75)

## js/apps/dataportal.js

Datenportal — Superset-artige Analyse-Dashboards über data/dashboards.json: Themenübersicht als Kartengrid, je Thema ein Dashboard mit Filterpanel (Jahresbereich), Tabs, KPI-Zeile und Chart-Grid; delegiert das Immobilien-Board an estate.js; nutzt charts.js (Renderer/Menüs) und dashboard-chrome.js (Kopf/KPI/Panel/Fusszeile).

**Routen**

- #/app/dataportal — Themenübersicht (Karten je Thema, dataportal.js:55)
- #/app/dataportal/:id — Dashboard eines Themas (dataportal.js:50,119)
- #/app/dataportal/immobilien — Delegation an estate.js (record-basiertes Immobilien-Board, dataportal.js:30-34)
- #/app/dataportal/:id?tab=…&from=…&to=… — teilbarer Zustand: aktiver Tab + Jahresbereich, via history.replaceState gespiegelt (dataportal.js:142-147,242-249)

**Funktionen**

- Themenübersicht: C.domainTile-Karten (Icon, Titel, Beschreibung, Zählzeile «N Auswertungen»; t.meta-Override fürs Immobilien-Board) (dataportal.js:63-76)
- pageHeader mit Lead + externem MIS/SUPERB-Link (target _blank) (dataportal.js:84-89)
- Dashboard-Seite: Zurück-Link, dashHeader (pageHeader + Dashboard-Aktionsmenü), Filterpanel, Tab-Leiste, Tab-Panel, dashFooter mit Quelle/Stand (format.datum)/«Demo-Daten» (dataportal.js:176-191, dashboard-chrome.js:76-104)
- KPI-Zeile aus der einzigen generischen Datenform board.kpis; Immobilien-Kennzahlen werden ausschliesslich in estate.js aus den Stammdaten berechnet
- KPI-Kachel: Label, Wert+Einheit, Delta-Chip mit Pfeil + sr-only-Richtungswort, optional zweiter Delta-Chip (Vormonat/Vorjahr), achsenlose 24-Punkte-Sparkline (aria-hidden), Stichtags-Hinweis (dashboard-chrome.js:39-72)
- Chart-Karten je Spec: Formen line/column/bar (horizontal)/pie (Ring mit Total in der Mitte)/area (gestapelt)/table (Kennzahlen-Mehrjahres-Tabelle mit Gruppenzeilen, einheit-Spalte, Fussnoten) (charts.js:159-435,488-495)
- Globaler Jahresbereichsfilter wirkt nur auf Zeitreihen-Datasets (jahr-Spalte); Snapshot-Charts bleiben unberührt (withYearRange, dataportal.js:111-116); Jahresdomäne aus allen Board-Datasets (boardYears, 98-107)
- Legende ab 2 Serien, Direktlabel nur am Endpunkt, Tooltips (data-tip) an jedem Mark, «Ziel»-Serie gestrichelt (charts.js:128-134,196-200)
- sr-only-Datentabelle je SVG-Chart als Textalternative (WCAG 1.1.1) und CSV/Excel-Exportquelle (charts.js:136-157)
- Responsive Chart-Geometrie: Zeichnen in CSS-Pixeln nach gemessener Kartenbreite, x-Label-Ausdünnung, Neuzeichnen via ResizeObserver (charts.js:70-84,497-524)
- Chart-Farben aus Token-Layer (--chart-series-1..7, 700er-Stufen), zur Renderzeit aufgelöst (PNG-Export), Cache pro body-Klasse (charts.js:29-54)
- Deep-Link/Teilen: Tab + Zeitraum in Hash-Query; Defaults bleiben aus der URL (dataportal.js:242-249)

**Zustände**

- Laden: dashData.load() vor Render; ctx.stale()-Abbruch bei überholter Navigation (dataportal.js:32,36)
- Ladefehler dashboards.json: Error-Notification «Auswertungen konnten nicht geladen werden» mit Neu-laden-Button — explizit vom leeren Portal unterschieden (dataportal.js:39-48)
- Dashboard-ID unbekannt: C.renderNotFound mit Zurück-Link + Crumbs (dataportal.js:122-127)
- Keine Zeitreihen im Board: Filterpanel zeigt Hinweistext statt Jahres-Selects (dataportal.js:162-172)
- Chart ohne Daten/mit Query-Fehler: Karte mit «Keine Daten für diese Auswahl.» bzw. Fehlertext (charts.js:443-446)
- Tab aktiv (Default erster Tab), Jahresbereich aktiv (Default min/max); ungültige Query-Werte werden geklemmt, from>to korrigiert (dataportal.js:141-147)
- Filterpanel ein-/ausgeklappt: Desktop via dashboard-layout--collapsed, unter 1024px via filter-panel--collapsed (mobil Default zu); aria-expanded/-label synchron, matchMedia-Wechsel beobachtet (dashboard-chrome.js:111-139)
- Unsichtbare Plots (inaktiver Tab, Breite 0) werden ausgelassen und beim Sichtbarwerden per ResizeObserver nachgezeichnet (charts.js:510-512)
- Chart-Aufräumen: der aktive ResizeObserver wird vor jedem Grid-Neuzeichnen und bei onUnmount entfernt

**Interaktionen**

- Themenkarte klicken → Dashboard öffnen (dataportal.js:74)
- Jahres-Selects «Start Zeitreihe»/«bis Jahr»: change → Klemmen (je nach fokussiertem Feld) + Hash-Sync + Grid-Neuzeichnen (dataportal.js:251-255)
- Panel-Reset: Jahresbereich auf min/max zurück (dataportal.js:256-257)
- Tab-Wechsel via C.wireTabs (inkl. Tastaturpfad der Komponente); onSelect rendert Grid neu, syncHash spiegelt in URL (dataportal.js:262-265)
- Filterpanel-Toggle-Button (ChevronLeft) klappt Panel ein/aus (dashboard-chrome.js:129-133)
- Dashboard-Toolbar-Menü: Aktualisieren (echtes Neuzeichnen + Toast) · Als PDF/Bild (simuliert, Toast) · Link kopieren (Clipboard, Fehlschlag als Error-Toast) · Per E-Mail (mailto) (dashboard-chrome.js:18-28,145-155)
- Chart-Kebab-Menü je Diagramm: Vollbild (kanonisches Modal xl, SVG in Modalbreite NEU gezeichnet) · Als CSV · Als Excel · Als PNG (svgToPng) · Link kopieren; Tabellen-Charts ohne PNG (charts.js:60-69,412,556-630)
- Hover-/Fokus-Tooltip auf jedem Mark (data-tip); Escape schliesst Tooltip ohne Fokusverlust (WCAG 1.4.13); scroll versteckt (charts.js:527-554)
- Toast-Rückmeldungen für alle Export-/Kopieraktionen inkl. Fehler-/Warn-Varianten (charts.js:602-628)
- Link kopieren teilt die aktuelle URL inkl. Tab/Zeitraum-Query (Deep-Link)

## js/apps/document-archive.js

Bauwerksdokumentation — durchsuchbares, filterbares Dokumentarchiv als Liste mit gemeinsamer catbar (Suche/Sortierung/Filterpanel, ohne Ansichtswechsel), KBOB-Dokumenttypen, Aktiv-Filter-Pillen, Paginierung (10/Seite) und Dokument-Viewer mit Blätter-Kontext und Metadatenpanel; kompletter Zustand URL-teilbar.

**Routen**

- #/app/document-archive — Dokumentliste (router.js:106)
- #/app/document-archive?q=&building=&type=&year=&class=&sort=&page= — jeder Zustands-Aspekt als Query (Filter kommagetrennt mehrwertig); Start-Zustand liest ALLE Parameter, syncHash schreibt sie (Defaults title-Sortierung/Seite 1 bleiben draus) (document-archive.js:45-54,86-98)

**Funktionen**

- Katalog-Toolbar C.catalogueBar: Suchfeld mit Label/Placeholder, Trefferzähler «N von M Dokumenten · Seite x von y», Sortier-Select (Dateiname A–Z / KBOB-Typ / Jahr neuste zuerst / Grösse grösste zuerst, mit Dateinamen-Tiebreaker), Filter-Button mit Aktiv-Zähler-Badge, einklappbares Filterpanel (document-archive.js:17-29,141-148)
- Filterpanel: 4 Mehrfach-Filtergruppen — Gebäude (alle buildings), KBOB-Dokumenttyp (Code + Bezeichnung, distinct), Jahr (distinct, absteigend), Klassifizierung (classificationTiers aus reference-data) — plus Panel-Reset (document-archive.js:39-42,130-135)
- Aktive-Filter-Pillen inkl. Such-Pille «Suche: «…»», Gebäude-Pillen mit Klarnamen; je Pille entfernbar (document-archive.js:75-84)
- Ergebnistabelle (zebra, ohne Tabellen-Icons): Dateiname inkl. `.pdf` als einziger Viewer-Button, KBOB-Code + Dokumenttyp, Gebäude als Klartext, Jahr (rechtsbündig), Grösse (dateiGroesse), Klassifizierungs-Badge; keine separate Vorschau-Spalte (document-archive.js:66-73)
- Suche über Dateiname + KBOB-Code + Dokumenttyp + Kategorie (case-insensitiv) (document-archive.js:63)
- Paginierung 10 pro Seite: C.pagination mit Buttons + Eingabefeld (bewusst KEINE toten #-Links) (document-archive.js:27,100-118)
- Dokument-Viewer (openDocumentViewer) mit der aktuellen gefilterten/sortierten Trefferliste als Blätter-Kontext; Kopfzeilenknopf «Metadaten» zeigt Dokument-ID, Dateiname, KBOB-Typ, Kategorie, Gebäude, Jahr, Format, Grösse, Klassifizierung und Taxonomie. Kontextaktion «Gebäude ansehen» führt zum Portfolio-Objekt (document-archive.js:176-181; doc-viewer.js)
- Screenreader-Live-Ansage nach jedem Render (C.announceCatalogue mit Count/Total/Seite) (document-archive.js:121-123)

**Zustände**

- Filter aktiv: 4 Dimensionen mehrwertig kombinierbar (UND zwischen Dimensionen, ODER innerhalb) (document-archive.js:56-59)
- Suche aktiv (getrimmt; leere Suche = alle) (document-archive.js:60)
- Sortierung ≠ Default und Seite > 1 werden in URL gespiegelt; kopierter Link reproduziert die sichtbare Trefferliste (document-archive.js:47-54,94-95)
- Leerzustand: «Keine Dokumente gefunden.» mit Hinweis und Aktion «Suche und Filter zurücksetzen» (document-archive.js:114-117)
- Seitenklemme: page > totalPages fällt auf die letzte Seite zurück (document-archive.js:102-103)
- Dokument ohne verknüpftes Gebäude: «—» in der Gebäudespalte (document-archive.js:67)
- Filterpanel auf-/zugeklappt mit Zähler-Badge am Filter-Button (via wireCatalogueState) (document-archive.js:134,145)

**Interaktionen**

- Suche mit Tipp-Verzögerung, Sortier-Select, Filter-Panel-Toggle, Checkbox-Filter, Panel-Reset und Pillen-Entfernen — komplett über C.wireCatalogueState verdrahtet (onChange → renderMain) (document-archive.js:152-160)
- Nullzustands-Reset-Button: Suche + Filter + Seite in einem Klick zurück, Fokus zurück ins Suchfeld (document-archive.js:166-173)
- Dateiname klicken → Dokument-Viewer mit Blätterkontext (delegierter Klick-Handler auf #doc-main) (document-archive.js:167,176-181)
- Paginierungs-Buttons/Eingabe (C.wirePagination, nur bei >1 Seite verdrahtet) (document-archive.js:118)
- Gebäude in der Tabellenzeile ist bewusst kein Link; Navigation zum Objekt steht kontextuell im Metadatenpanel des Viewers (document-archive.js:70; doc-viewer.js)
- URL-Kopieren teilt Suche/Filter/Sortierung/Seite (syncHash via history.replaceState) (document-archive.js:86-98)

## js/apps/estate.js

Immobilienportfolio — Stammdaten-DASHBOARD (Superset-Muster), KEIN geteilter Helfer der drei Explorer, sondern eigenes Routen-Modul: dynamisch geladen von js/apps/dataportal.js:31 unter #/app/dataportal/immobilien. Lädt buildings/parcels/landcovers.geojson + contracts.json selbst (modulweiter CACHE, estate.js:51; kein needs-Export, estate.js:108) und die Zeitreihen aus data/dashboards.json via dashData. Einziger Konsument (neben dataportal.js) von js/dashboard-chrome.js: kpiTile, dashHeader, filterPanelShell, dashFooter, wireFilterCollapse, wireDashboardMenu. Weitere Helfer: charts.js (chart/wireCharts/wireChartMenus/paintCharts — Zwei-Durchgangs-Rendern mit gemessener Breite, estate.js:425), buildings-map.js, map-slot.js, fetch-json.js, format.num.

**Routen**

- #/app/dataportal/immobilien — Dashboard, Default-Register «Gebäude»
- #/app/dataportal/immobilien?tab=gebaeude|grundstuecke|bodenbedeckung|entwicklung — Registerwahl (estate.js:142)
- #/app/dataportal/immobilien?land=…&region=…&typ=…&eigentum=…&status=… (CSV) — globale Mehrfach-Dimensionsfilter; leere Auswahl = alle (estate.js:150)
- #/app/dataportal/immobilien?gran=monat|jahr — Körnung der Entwicklungs-Zeitachse, nur im Register Entwicklung (estate.js:146, 409)

**Funktionen**

- dashHeader (dashboard-chrome): pageHeader + Dashboard-Aktionsmenü (Aktualisieren echt · PDF/Bild simuliert · Link kopieren · Per E-Mail); Zusatzhinweis-Link ins Liegenschaften Inventar (target=_blank, estate.js:442); C.backLink zum Datenportal
- filterPanelShell (dashboard-chrome) mit registerabhängigem Körper: Stammdaten-Register → C.filterGroup-Facetten Land/Region/Gebäudetyp/Eigentum/Status (max 5 Werte sichtbar, Rest hinter «Alle anzeigen (N)», estate.js:373) + Panel-Reset; Register Entwicklung → Radiogruppe Zeitachse (Jahres-/Monatsstände) + Hinweis, dass die Dimensionsfilter dort nicht wirken (estate.js:384-392)
- Registerleiste (C.tabBar) mit 4 Registern; ein gemeinsames Tabpanel #dpanel
- KPI-Zeile je Register via kpiTile (dashboard-chrome: Wert+Einheit, Delta-Chip mit Pfeil+sr-only-Wort, Sparkline, Stand-Hinweis): Gebäude (Anzahl/GF/Ø GF/Eigentum %), Grundstücke (Anzahl/GSF/Ø/Eigentum %), Bodenbedeckung (Total/bebaut %/versiegelt %/grün %), Entwicklung (Gebäude+Delta ggü. Vorjahr+Sparkline, GF, Eigentumsquote, Auslaufende Verträge bis Jahr+2)
- Diagramme je Register (charts.js, Aggregation zur Laufzeit über die gefilterte Menge): Gebäude — Weltkarte + Pie Eigentum, barH GF nach Portfolio, barH nach Land, Histogramm GF (column), barH Gebäudetyp; Grundstücke — Pie Eigentum, barH Fläche/Portfolio, barH nach Land, GSF-Histogramm; Bodenbedeckung — barH nach Typ, column Versiegelt vs. Grünfläche; Entwicklung — Linien Gebäudebestand/GF/Eigentumsquote (Jahr- oder Monatsachse), indexierte Mehrserien-Linie (Basis=100), Säulen Zu-/Abgänge, Säulen Auslaufende Verträge je Jahr (nur wenn Daten, estate.js:274), Kennzahlen-Tabelle im Mehrjahresvergleich mit Fussnoten
- Geclusterte Weltkarte mit eigenem Karten-Aktionsmenü (Vollbild, PNG, Link kopieren, estate.js:174-184), C.loading als Ladezustand; Popups deep-linken via ?id= ins Liegenschaften Inventar; Parzellen-Polygone über WE-Match dem Gebäude zugeordnet (estate.js:355-367)
- dashFooter (dashboard-chrome): Quelle je Register per JS gesetzt (#dash-source, SAP RE-FX / GIS IMMO / Zeitreihen), Stand-Datum via format.datum, Marke «Demo-Daten»
- Filterwechsel aktualisiert NUR den Inhalt (KPIs/Charts/Karte/Quelle) — Panel behält Fokus/Scroll; Panel-Körper wird nur beim Registerwechsel getauscht (syncPanel, estate.js:393)

**Zustände**

- Ladezustand (await loadData + dashData.load; Karte mit C.loading-Spinner); stale-Wache nach dem Async-Laden (ctx.stale, estate.js:122)
- Fehlerzustand: C.notification error mit Live-Region statt Dashboard (estate.js:127)
- Default: Register gebaeude, keine Filter (leer=alle), gran=jahr
- Entwicklung ohne Zeitreihen: Empty-Kasten «Die Zeitreihen sind nicht verfügbar…» (estate.js:198); Verträge-Auswertung entfällt still bei fehlendem contracts.json (estate.js:76-80)
- Filterpanel eingeklappt/ausgeklappt: Desktop dashboard-layout--collapsed vs. mobil filter-panel--collapsed, unter lg standardmässig zu; matchMedia-Horcher mit onUnmount-Abmeldung (wireFilterCollapse, dashboard-chrome.js:111-139)
- Facetten-«mehr»-Zustand auf/zu je Gruppe («Alle anzeigen (N)»/«Weniger anzeigen», estate.js:476-487)
- Karten-Slot je update() abgebaut und nur im Register Gebäude neu montiert; onUnmount mapSlot.free (estate.js:402-403, 428-432)

**Interaktionen**

- Registerwechsel (C.wireTabs inkl. Tastatur) → syncHash + update
- Dimensionsfilter-Checkboxen (change-delegiert auf #filter-body, estate.js:461), Zeitachsen-Radios, Panel-Reset (delegiert, weil der Knopf im Entwicklungs-Register fehlt, estate.js:488-497)
- «Alle anzeigen»/«Weniger anzeigen» je Filtergruppe (aria-expanded)
- Filterpanel-Einklapp-Knopf (aria-expanded/aria-label synchron)
- Dashboard-Menü: Aktualisieren (Toast), PDF/Bild (Simulations-Toast), Link kopieren (Erfolgs-/FEHLER-Toast), Per E-Mail (wireDashboardMenu, dashboard-chrome.js:145)
- Diagramm-Aktionen je Chart (wireCharts/wireChartMenus aus charts.js); Karten-Menü Vollbild/PNG/Link
- Karten-Cluster/Popups mit Deep-Link ins Inventar; Inventar-Link im Lead (neuer Tab)

## js/apps/fault-report.js

Meldung erfassen — einschrittiges Meldeformular mit 5 Typ-Varianten über ?type=, erzeugt Vorgang ('stoerung' bzw. 'sicherheitsvorfall'); needs=['buildings','contacts'] (Z.13).

**Routen**

- #/app/fault-report — Standard: Störungs-, Reinigungs- & Reparaturmeldung (defId 'stoerung', Z.55-63; router.js:103)
- #/app/fault-report?type=sicherheit — Sicherheits-/Datenschutzvorfall melden (defId 'sicherheitsvorfall', Z.21-28)
- #/app/fault-report?type=reklamation — Reklamationsmeldung (Z.29-36)
- #/app/fault-report?type=kleinauftrag — Kleinauftrag am Gebäude erteilen (Z.37-46)
- #/app/fault-report?type=umzug — Umzug, Transport & Entsorgung (Z.47-54)
- ?building=<bbl_id>&room=<Raum> — Deep-Link-Vorbelegung von Gebäude + Ort aus Mietendenportal/Portfolio (Z.90-105; Aufrufer tenancies.js:682-696, portfolio.js:444)
- Unbekannter ?type fällt auf default zurück (Z.65); unbekannte ?building-IDs werden ignoriert statt übernommen (Z.96-97, 104)

**Funktionen**

- Typkonfiguration TYPES: je Variante eigener Titel (=h1 und setTitle), Lead, Kategorienliste, serviceId für Rückweg und Prozessdefinition defId (Z.20-63)
- Rück-Link + Abbrechen-Link zielen auf die typ-spezifische Dienstleistungsbeschreibung, nicht den Hub (links.dienstleistung(cfg.serviceId), Z.78/140/164)
- Kontextzeile mit Melder-Name und Org aus der Session (C.contextLine, Z.143)
- Sicherheitsvariante: Warn-Notification «Alarmzentrale +41 58 465 65 65» + Info-Karte der Fachstelle ISBO aus core.contacts() mit mailto-Link und Telefon (Z.88, 130-133)
- Formular: Gebäude/Standort-Select (Pflicht), Ort Stockwerk/Raum (optional, mit Hint), Kategorie-Select je Typ, Beschreibung (Pflicht, textarea), Dringlichkeit Normal/Hoch (Z.150-161)
- Info-Notification «Mit dem Absenden wird ein Vorgang erstellt …» (Z.162)
- Vorgangserzeugung engine.start(cfg.defId) mit Titel «Label — Gebäudename», data (kategorie/ort/beschreibung/dringlichkeit/standort) und linkedEntities.buildingId (Z.221-233)
- Erfolgsseite C.processDone; bei sicherheit zusätzliche Alarmzentrale-Warnung im extra-Slot (Z.179-185); Aktionen «Vorgang ansehen» + «Zu den Dienstleistungen»

**Zustände**

- Abgemeldet: Login-Gate (AGOV/FedLogin) statt Formular, Titel/Lead der Variante bleiben (Z.74-85)
- Gebäude-Pflichtauswahl startet leer mit «Bitte wählen…» — nur der Deep-Link darf vorbelegen (Z.99-104, 120-123)
- Leere Gebäudeliste: deaktiviertes Eingabefeld «Kein Gebäude verfügbar» statt Select (Z.151-155)
- Fehlerzustand je Feld + Fehlerübersicht mit Labels bld/beschreibung (FIELD_LABELS Z.115, Z.149)
- Validierung: Gebäude gewählt + Beschreibung nicht leer (Z.199-205)
- Erfolgszustand state.created → drawDone (Z.118, 174)
- Speicherfehler: engine.start null → C.flashError (Z.235)
- Pflichtfeld-Legende als eigene Zeile + sr-only-h2 «Meldung erfassen» (Z.147-148); novalidate-Formular (Z.150)

**Interaktionen**

- «Meldung absenden» (submit, btn--lg mit Checkmark) und «Abbrechen»-Link zur Dienstleistungsbeschreibung (Z.163-166)
- Fehlversuch: Neuzeichnen + Fokus auf Fehlerübersicht mit Sprungmarken (C.wireErrorSummary, Z.218)
- Feld-Fehlerbadges löschen sich bei Korrektur (C.wireFieldErrors, Z.212)
- Fokus + Schreibmarke über Neuaufbau gerettet (C.preserveFocus, Z.136)
- Selects für Gebäude, Kategorie, Dringlichkeit; Texteingaben Ort und Beschreibung
- mailto-Link zur ISBO-Fachstelle in der Sicherheitsvariante (Z.132)
- Erfolgsseite: Fokus auf Überschrift + Referenzansage (C.focusProcessDone, Z.190)
- Login-Gate-Aktion im ausgeloggten Zustand (Z.81)

## js/apps/media-library.js

Mediathek Bauten: Katalog der Fotos/Videos (Galerie/Liste/Karte) mit Vollbildgalerie und Medien-Detailseite; Georeferenz je Aufnahme, Objektbezug über Gebäude/Grundstücke/Projekte (needs: buildings, media, parcels, projects, Z.27).

**Routen**

- #/app/media-library — Übersicht, Standardansicht Galerie
- #/app/media-library?q=… — Volltextsuche (Titel, Objektname, Urheberschaft, Datum, Z.99)
- #/app/media-library?typ=photo,video — Medientyp-Filter (CSV-Mehrfachwert)
- #/app/media-library?epoche=historisch,aktuell — Epochen-Filter
- #/app/media-library?objekt=<id>,… — Objekt-Filter (Werte aus allen drei Beständen, Z.179)
- #/app/media-library?sort=datum-desc|datum-asc|titel|objekt — Sortierung (Standard datum-desc, ungültige Werte fallen zurück, Z.92)
- #/app/media-library?view=gallery|list|map — Ansichtswechsel (Standard gallery, Z.93)
- #/app/media-library?page=<n> — Blättern, 12 pro Seite, auf totalPages geklemmt (Z.116)
- #/app/media-library?bild=<mediaId> — Deep-Link: öffnet die Vollbildgalerie direkt bei der Aufnahme (nur in Galerieansicht, Z.244–248)
- #/app/media-library/<mediaId> — Detailansicht (params[0], Z.77)
- #/app/media-library/<mediaId>?tab=uebersicht|metadaten — Register-Deeplink, Unbekanntes fällt auf Übersicht zurück (Z.314–315)

**Funktionen**

- Katalogleiste C.catalogueBar: Suche, Trefferzahl (Zähltext in Kartenansicht ohne Seitenangabe, Z.195–197), Sortierung, Filterpanel, 3-fach-Ansichtswechsel (Z.190–208)
- Galerieansicht: C.card mit Foto, Badges Typ (Foto blau/Video violett), Epoche (Historisch warning/Aktuell info), «Intern» bei nicht-öffentlichem Zugriff (Z.123–135)
- Historisches Material wird desaturiert/grau gerendert (gray-Flag, Z.22, 128)
- Listenansicht: C.table zebra, Spalten Titel(-Link)/Typ/Objekt/Epoche-Badge/Urheberschaft/Datum rechtsbündig (Z.137–154)
- Kartenansicht: MapLibre-Karte (initEstateMap) mit einem Punkt je AUFNAHME aus eigenen Koordinaten, Popup mit Titel/Untertitel/Detail-Link (Z.156–170)
- Hinweiszeile unter der Karte: «n von m Aufnahmen sind georeferenziert» + Demo-Daten-Hinweis (Z.168–169)
- Aktive-Filter-Pillen mit Einzel-Entfernen und Gesamt-Reset (C.activeFilters, Z.172–177, 209)
- Pagination über C.catalogueResults mit Seiteneingabefeld (Z.214–215)
- Vollbildgalerie (openGallery) mit Detailzeilen je Bild: Typ, Datum, Epoche, Objekt, Fotograf:in/Quelle, Copyright, Zugriff, Koordinaten (galleryItem, Z.50–65)
- Galerie-Reihenfolge = Trefferliste, damit Blättern der Sortierung folgt (Z.241–242)
- Detail: detailBar (Zurück), H1, Lead «Objektname · Datum», Registerleiste (Z.359–369)
- Detail-Register Übersicht: grosses Bild als Button (öffnet Galerie), Play-Overlay bei Video, «Frei verwendbar»-Hinweis bei öffentlichem Zugriff, Download-Button (m.url), «In der Galerie öffnen»-Button (Z.317–335)
- Detail-Register Metadaten: kv-Liste Medien-ID/Typ/Datum/Epoche/Objekt(-Link auf #/app/portfolio?id=…)/Fotograf:in bzw. Quelle/Copyright/Zugriff/Aufnahmeort WGS84 (Z.337–354)
- Standortkarte im Metadaten-Register, nur bei vorhandener Georeferenz (Z.354, 392–400)
- Galerie im Detail blättert über die Geschwisteraufnahmen desselben Objekts (Z.306, 379)
- Objektauflösung buildingId/parcelId/projectId → objektId/objektName, «Ohne Objektbezug» als Fallback (Z.37–44)
- Screenreader-Ansage der Trefferzahl (C.announceCatalogue, Z.222)
- Krume: Anwendungen → Mediathek Bauten (→ Medientitel im Detail) (Z.81, 294–296)

**Zustände**

- Laden: Router ruft core.ensure(needs) vor render() — ohne needs-Deklaration zeigte die Sicht «keine Einträge» (Z.24–27)
- Leerzustand: «Keine Aufnahmen gefunden.» (Z.217)
- Ladefehler: «Medien konnten nicht geladen werden (Ladefehler).» via core.available('media') (Z.216–218)
- Nicht gefunden: C.renderNotFound mit eigenem Titel/Krume/Rück-Link bei unbekannter mediaId (Z.283–290)
- Filter aktiv: Pillenzeile, Filterzähler an der Leiste (typ+epoche+objekt, Z.199)
- Ansichtszustand gallery/list/map im Hash, ungültige Werte fallen auf gallery zurück (Z.93)
- Seitenzustand: page auf 1..totalPages geklemmt (Z.115–116)
- Detail-Registerzustand über ?tab, unbekannt → Übersicht (Z.314–315)
- Kartenansicht: WebGL-Kontext über map-slot gehalten und via ctx.onUnmount freigegeben (Z.263–268, 395–399)
- Galerieansicht: Deep-Link-Zustand ?bild= öffnet Galerie beim Rendern (Z.244–248)
- Detail ohne Georeferenz: Koordinaten «—», keine Karte (Z.63, 348–354)
- Listener-Hygiene: Klick-Horcher an per Render neu erzeugtem Container, nicht an mount (verhindert Mehrfachgalerien, Z.229–234, 381–390)

**Interaktionen**

- Suchformular (formId med-search, Submit schreibt q in den Hash via C.wireCatalogue, Z.223–226)
- Sortier-Dropdown (med-sort, 4 Optionen, Z.68–73)
- Filter-Knopf klappt Panel auf/zu; Checkbox-Gruppen Medientyp/Epoche/Objekt; Panel-Reset-Link (Z.199–206)
- Aktive-Filter-Pillen einzeln entfernen; «Zurücksetzen» auf resetHref (Z.172–177, 209)
- Ansichtsumschalter Galerie/Liste/Karte (Icons Apps/List/Map, Z.207)
- Pagination: Seitenlinks + Seiteneingabefeld med-page (Z.214–215, 224)
- Galerie: Kartenklick öffnet Vollbildgalerie an genau diesem Bild; href bleibt Tastatur-/Fallback-Pfad zur Detailseite (Z.237–257)
- Liste: Zeilenklick navigiert (C.wireTableRows, rowsClickable, Z.143, 228–235)
- Karte: Popup-Link je Punkt zur Detailseite (Z.162)
- Detail: Zurück-Link zur Übersicht (detailBar, Z.361)
- Detail: Registerwechsel mit URL-Sync per history.replaceState (C.wireTabs, Z.372–375)
- Detail: Bild-Button und «In der Galerie öffnen»-Button öffnen die Galerie (delegierter Klick auf [data-open-gallery], Z.322, 334, 387–390)
- Detail: «Herunterladen»-Button (Link auf m.url, Z.333)
- Detail: Objekt-Link ins Liegenschaften-Inventar (#/app/portfolio?id=…, Z.343)
- Galerie selbst: Blättern/Schliessen (js/gallery.js, mit URL-Param bild)

## js/apps/metadata-catalog.js

Metadaten Katalog Bauten: Data-Governance-Katalog mit zwei Sichten (Geschäftsobjekte / Systemtabellen), Seitenbaum, Detailseiten mit je 3 Registern und der Kernfrage «welches Feld welchen Systems trägt diesen Fachbegriff» (Realisierungen in beide Richtungen via core-Rückwärtsindex).

**Routen**

- #/app/metadata-catalog — Bestandsansicht, Standardsicht Geschäftsobjekte, Standardansicht Liste (Z.145, 154)
- #/app/metadata-catalog?kind=tabellen — Systemtabellen-Sicht (kind bleibt bei Standardsicht aus der Adresse, Z.203–205)
- #/app/metadata-catalog?q=… — Suche (Objekte: Name/Definition/Bemerkung/Attributnamen; Tabellen: Name/DisplayName/Beschreibung/Schema/System/Feldnamen, Z.177–186)
- #/app/metadata-catalog?domain=<key>,… — Domänen-Filter (nur Objekte-Sicht)
- #/app/metadata-catalog?system=<key>,…&schema=<key>,… — System-/Schema-Filter (nur Tabellen-Sicht)
- #/app/metadata-catalog?status=<id>,… — Status-Filter (objectStatuses, nur Objekte-Sicht)
- #/app/metadata-catalog?mapped=ja|nein — mit/ohne Realisierung (beide Sichten, Z.153)
- #/app/metadata-catalog?sort=name|domain|attrs|maps bzw. name|system|fields|real — Sortierung je Sicht (Z.161–174)
- #/app/metadata-catalog?view=list|gallery — Ansichtswechsel, Standard Liste (Z.154)
- #/app/metadata-catalog?page=<n> — Blättern, 12 pro Seite (Z.196–198)
- #/app/metadata-catalog?id=<objectId> — Geschäftsobjekt-Detail (Inventar-Idiom statt Routensegment, Z.71–78)
- #/app/metadata-catalog?id=<objectId>&tab=uebersicht|attribute|realisierung — Register-Deeplink (Z.487–497)
- #/app/metadata-catalog?table=<tableId> — Systemtabellen-Detail (Z.76–78)
- #/app/metadata-catalog?table=<tableId>&tab=uebersicht|felder|realisierung — Register-Deeplink (Z.658–666)

**Funktionen**

- Katalogleiste: Suche mit sichtabhängigem Label/Placeholder, Trefferzahl mit Kasus-korrekter unit {nom,dat} (Z.318–333), Sortierung (4 Optionen je Sicht), Filterpanel, Ansichtswechsel Liste/Galerie
- Seitenbaum pf-tree--plain, genau 2 Ebenen: «Geschäftsobjekte»→Domänen, «Systeme»→Systeme, mit Trefferzahlen je Knoten (Z.387–459)
- Baum-Klappzustand modulweit persistent (OPEN-Map überlebt Neu-Renders; gefilterter Zweig immer offen, Z.92–97, 446–457)
- Listenansicht Objekte: Tabelle mit festen Spaltenbreiten — Name-Link, Domäne-Badge, gekürzte Definition (kurz(), Z.64–69), Attributzahl, Status-Badge (Z.264–275)
- Listenansicht Tabellen: DisplayName-Link + technischer Name als code, System-Badge, Beschreibung, Felderzahl, Zertifiziert/Nicht-zertifiziert-Badge (Z.276–291)
- Galerieansicht: bildlose CD-Karten mit Badges (Domäne/Status bzw. System/Art/Zertifiziert) und Kennzahlen-Footer (Attribute·Realisierungen bzw. Felder·Zeilen, Z.228–254)
- Aktive-Filter-Pillen inkl. «Mit/Ohne Realisierung» und «Schema …» (Z.215–222)
- Objekt-Detail: detailBar, H1, Definition als Lead, 3 Register mit Zählern in den Beschriftungen (Z.487–491, 547–565)
- Objekt-Übersicht: «Verantwortliche Personen» (Rolle → AdminDir-Link, geteilter Baustein personsSection, Z.121–127), Metadaten-kv (Domäne als Filterlink, Status-Badge mit Definition+Konsequenz, Norm-Referenz, Bemerkung, Stand, ID), Kontakt-Karte (steward-Kontakt, Z.480–544)
- Objekt-Register Attribute: C.mountDataTable mit Suche, 2 Sortierungen, Facetten Schlüsselrolle/Pflichtangabe, 15 pro Seite; Spalten Attribut(+optional-Marke)/Beschreibung/Werttyp/Schlüssel-Badge (Z.569–603)
- Objekt-Register Realisierung: Datentabelle Attribut/System/Tabelle-Link(+technischer Name)/Feld/Güte-Badge (Z.605–625)
- Güte-Badge (Exakt/Nahe/Teilweise) mit Erklärung im title-Attribut am Wert statt Legende (MATCH_HINT/matchBadge, Z.99–114)
- Tabellen-Detail: gleiche Anatomie; Metadaten-kv System/Schema(+Typ)/technischer Name/Art/«Publiziert als» DCAT-Link/Quellsystem-Link (Host statt URL, hostOf Z.90)/Stand/ID (Z.680–702)
- Tabellen-Detail Randspalte: «Zugriff»-Karte mit «Datensatz ansehen»-Button (nur bei datasetId), Kontakt-Karte (Z.703–716)
- Tabellen-Register Felder: Datentabelle Feld-code/Beschreibung/Datentyp/PK-FK-optional/Realisiert-durch-Objektbadges mit Tooltip «Objekt · Attribut»; Facetten Schlüssel + «Trägt einen Begriff» (Z.739–774)
- Tabellen-Register Realisierung: Geschäftsobjekt-Link/Attribut/Feld/Güte (Z.776–791)
- datasets (115 KB) nur im Tabellen-Detail nachgefordert (core.ensure('datasets'), Z.641–647)
- Beschriftungs-Maps für Ablageformen: TABLE_TYPE/SCHEMA_TYPE/VALUE_TYPE/KEY_ROLE (Z.46–58)
- Krume: Anwendungen → Metadaten Katalog Bauten (→ Name im Detail); Seitentitel je Ansicht (Z.137–138, 475–476, 648–649)

**Zustände**

- needs businessObjects/systemTables/contacts (Z.35)
- Leerzustand/Ladefehler je Sicht via catalogueResults + core.available('businessObjects'|'systemTables') (Z.346–356)
- NotFound Geschäftsobjekt bzw. Tabelle mit renderNotFound (Z.468–474, 634–640)
- Filter aktiv: Pillenzeile + Filterzähler je Sicht (Z.311–313); Sichtwechsel nimmt Filter der anderen Sicht NICHT mit (kindHref, Z.208–212)
- Baumzustand: Zweig offen/zu (aria-expanded/hidden), aktiver Knoten is-active + aria-current; gefilterter Zweig erzwungen offen (Z.412–418, 446–457)
- Register-Zustand über ?tab, unbekannte Werte fallen still auf Übersicht (Z.496–497, 665–666)
- Leere Realisierung: Tabelle MIT Kopfzeile + erklärender Leertext statt Leerzustand (emptyMsg, Z.508–513, 607, 778)
- Keine verantwortliche Person: Hinweistext im Personen-Kasten (Z.127)
- stale()-Prüfung nach dem datasets-await im Tabellen-Detail (Z.644–647)
- Seite auf totalPages geklemmt (Z.196–197); Standard-Sortierung Name A–Z ohne sort-Param (Z.195)
- Detail-Datentabellen: eigener Such-/Facetten-/Seitenzustand je mountDataTable (mc-at/mc-mp/mc-fl/mc-rl)

**Interaktionen**

- Suchformular mc-search (Submit → Hash, C.wireCatalogue, Z.362–365)
- Sortier-Dropdown mc-sort (sichtabhängige Optionen)
- Filter-Knopf mit Panel: Checkbox-Gruppen Domäne/Status/Realisierung bzw. System/Schema/Realisierung; Panel-Reset (Z.294–309)
- Pillen einzeln entfernen, Gesamt-Reset auf BASE (Z.339)
- Ansichtsumschalter Liste/Galerie (Z.337)
- Pagination mit Seiteneingabefeld mc-page (Z.353–354)
- Baum: Zweigknopf — von woanders navigiert er auf den Zweig und öffnet ihn, an Ort klappt er auf/zu (Klick-Delegation an .pf-sidebar, Z.368–385); Blätter sind Filterlinks (Domäne/System)
- Zeilenklick in beiden Listen (C.wireTableRows mit onUnmount, Z.366)
- Registerwechsel mit URL-Sync per history.replaceState (C.wireTabs, Z.498–502, 567, 663–671, 737)
- Detail-Datentabellen: eigene Suche, Sortierung, Facettenfilter, Blätterleiste (C.mountDataTable, Z.572, 605, 739, 776)
- Externe Links: AdminDir-Personeneinträge (target _blank rel noopener, Z.125), Quellsystem-URL (Z.698)
- Interne Querlinks: Tabelle↔Geschäftsobjekt (Realisierungen), «Publiziert als»/«Datensatz ansehen» in den DCAT-Katalog (links.datensatz, Z.695, 712), Domänen-/Gruppen-Filterlink in den Metadaten (Z.526)
- Zurück-Link im Tabellen-Detail führt auf die GEFILTERTE Systemsicht (kind=tabellen&system=…, Z.724–727); im Objekt-Detail auf BASE
- Tooltip-Erklärungen: Güte-Badges (title=MATCH_HINT) und Realisiert-Badges (title «Objekt · Attribut», Z.771)

## js/apps/portfolio.js

Liegenschaften Inventar — map-first Explorer über Gebäude UND Grundstücke aus dem SAP-RE-FX-Golden-Record (core.buildings()+core.parcels()); links räumlicher Baum, rechts Galerie/Liste/Karte; Detailseiten für Gebäude (7 Reiter) und Grundstück (2 Reiter). needs=['areas','assets','buildingContacts','buildings','contracts','costs','documents','landcovers','parcels'] (portfolio.js:56). Geteilte Helfer: spatial-tree.js (treeHTML/wireTree/restoreTreeSelection/markTree/syncTreeCounts), map-slot.js (createMapSlot: Besitz/Abbau WebGL), buildings-map.js (initEstateMap), hero-mosaic.js (heroMosaic/galleryItemsFrom/wireHeroMosaic), gallery.js (openGallery), format.js (num/m2/chf/datum/dateiGroesse), domain.js (landName/weOf), links.js; C-Verträge: catalogueBar, wireCatalogueState, activeFilters, announceCatalogue, pagination/wirePagination, table/wireTableRows, card, filterGroup, panelReset, mountDataTable, tabBar/tabPanels/wireTabs, detailBar, actionCard, contactCard, renderNotFound, empty, badge, photo. NICHT genutzt: estate.js, dashboard-chrome.js.

**Routen**

- #/app/portfolio — Übersicht (Explorer), Default-Ansicht Galerie
- #/app/portfolio?view=map|gallery|list — Ansichtsumschaltung, unbekannter Wert fällt auf gallery zurück (portfolio.js:100)
- #/app/portfolio?q=…&sort=name|area|status|land&page=N — Suche/Sortierung/Seite vollständig in der URL; Defaults bleiben draussen (syncHash portfolio.js:212)
- #/app/portfolio?status=…&ownership=…&kind=… (CSV) — Facetten; kind-Default ist ['building'], ?kind=alle kodiert die bewusst geleerte Typ-Auswahl (portfolio.js:110)
- #/app/portfolio?land=…&region=…&city=…&we=…&obj=… — Baum-Auswahl in der URL; obj statt id, weil id der Detailroute gehört (portfolio.js:96-98)
- #/app/portfolio?id=<bbl_id> — Gebäudedetail (Query-Param, weil SAP-IDs «/» enthalten); params[0] als Fallback (portfolio.js:63)
- #/app/portfolio?id=<bbl_id> (Parzellen-ID) — Grundstücksdetail (portfolio.js:67-68)
- #/app/portfolio?id=…&tab=uebersicht|flaechen|ausstattung|vertraege|kosten|dokumente|kontakte — ?tab-Deeplink Gebäudedetail, Unbekanntes → Übersicht (portfolio.js:428)
- #/app/portfolio?id=…&tab=uebersicht|bodenbedeckung — ?tab-Deeplink Grundstücksdetail (portfolio.js:737)
- #/app/portfolio?id=<unbekannt> — Nicht-gefunden-Seite mit Rückweg (C.renderNotFound, portfolio.js:70)

**Funktionen**

- Katalogleiste (C.catalogueBar): Suchfeld, Trefferzähler #pf-count, Sortier-Select (Bezeichnung/Fläche/Status/Land), Filterknopf+Panel, Ansichtsumschalter Galerie/Liste/Karte
- Filterpanel: C.filterGroup-Facetten Status, Eigentumsverhältnis, Objekttyp (Gebäude/Grundstück) + C.panelReset; idPrefix 'pf' gegen doppelte Checkbox-ids (portfolio.js:309)
- Aktiv-Pillen-Zeile (C.activeFilters): Suche, Baum-Auswahl («Auswahl: …»), Status-/Eigentums-/Typ-Pillen, je entfernbar + «Alle Filter zurücksetzen»
- Räumlicher Baum (Sidebar «Standorte»): Land›Region›Stadt›WE›Gebäude/Grundstück; WE-Knoten mit Code+Namen des ersten Gebäudes; Blatt = Auswahl-Button (filtert + öffnet Karten-Popup, KEIN Detail-Link, portfolio.js:146); Zählersync auf Suche+Facetten (syncTreeCounts, portfolio.js:202)
- Galerieansicht: pf-Karten via C.card — 16:10-Foto bzw. Parzellen-Schraffur (Crop-Icon), Chips Land+Status auf dem Bild, idLine bbl_id, Adresse, Fuss Kategorie + Fläche GF/GSF; 9 je Seite
- Listenansicht: C.table zebra+rowsClickable — Typ (Icon mit title/aria-label), Bezeichnung (Link+ID), Ort (+Land), Kategorie, Fläche (GF/GSF), Status-Badge; 25 je Seite
- Kartenansicht: geclusterte Weltkarte (initEstateMap) — Gebäudepunkte + Parzellen-Polygone, Popups mit Deep-Link ins Detail; Fokus-Objekt öffnet sein Popup (state.focus)
- Blätterleiste C.pagination mit Seiten-Eingabefeld (inputId pf-page) + C.wirePagination
- Ergebniskopf «N von M Objekten · Seite X von Y» (Dativ); Karte nur «N Objekt(e)»
- Screenreader-Ansage jeder Treffermengen-Änderung (C.announceCatalogue, portfolio.js:271)
- URL-Vollzustand über history.replaceState ohne Router-Neurender (syncHash)
- Gebäudedetail: C.detailBar (Zurück+Teilen), h1, Lead-Adresse, heroMosaic (Bildmosaik + Standortkarte mit einem Punkt, focusPopup:false, portfolio.js:707)
- Gebäudedetail Übersicht: kv-Eckdaten (BBL-ID, WE, EGID, Adresse, Land/Region, Portfolio-Kategorie, Gebäudetyp, Eigentum, Baujahr+saniert, Architektur*, Nutzer*, GF, HNF, Erhaltungsstrategie*, Baudenkmal KGS*, Grundstück-Links, Status-Badge; *=nur wenn vorhanden)
- Gebäudedetail Randspalte (im Übersichtspanel): C.actionCard mit vorbelegten Deep-Links (Stammdaten mutieren #/services/stammdaten-mutieren?building=, Störung melden #/app/fault-report?building=, Bautendokumentation #/app/document-archive?building=, Mediathek #/app/media-library?building=) + C.contactCard (max 4, Primär zuerst)
- Detail-Datentabellen via C.mountDataTable (je Suche/Sortierung/Facetten/10er-Blätterung): Flächen (Facette Standard), Ausstattungen (Facetten Kategorie/Status, Badges), Verträge (Facette Status, Statusvarianten portfolio.js:806), Kosten (Facette Kostengruppe, tfoot «Total (n)» über die GEFILTERTE Menge portfolio.js:584), Kontakte (Primär-Badge, tel:/mailto:-Links), Dokumente (Facetten Dokumenttyp/Klassifizierung, Klassifizierungs-Badge aus ref, Download-Knopf je Zeile, Folgelink «In der Bauwerksdokumentation öffnen»)
- Vollbildgalerie aus den Mosaik-Kacheln (wireHeroMosaic→openGallery) inkl. Bildnachweis im Metadatenpanel; kuratierte Bilder aus o.bilder, NICHT media.json (portfolio.js:28)
- Grundstücksdetail: kv-Eckdaten (Parzellen-ID, WE, Parzellen-Nr., EGRID, Gemeinde, Land/Region, GSF, Nutzungszone, Eigentum, Status, Link «Gebäude auf der Parzelle» via WE-Match portfolio.js:725), Reiter Bodenbedeckungen mit Total-Zeile + Tabelle (Fläche absteigend), Mini-Karte mit Bodenbedeckungs-/Parzellen-Polygonen als räumlicher Hero (portfolio.js:789)

**Zustände**

- Default: Ansicht Galerie, Sortierung name, NUR Gebäude gefiltert (kind=['building'], Nutzerentscheid 2026-07-30); explizite Objektauswahl aus Baum/Karte hebt den Typfilter auf (portfolio.js:124)
- Leerzustand «Keine Objekte gefunden.» mit Hinweis + Knopf «Suche und Filter zurücksetzen» (voller Reset inkl. Baum, portfolio.js:248)
- Kartenzustand: keine Blätterung, nur Anzahl; WebGL-Karte wird bei jedem renderMain und beim Routenverlassen abgebaut (pfMap.free, ctx.onUnmount portfolio.js:62)
- Seitenklemme: state.page > pages wird auf die letzte Seite gesetzt (portfolio.js:257)
- Filterpanel offen/zu mit Zähler-Badge; Checkbox-Zustand aus state.filters vorbelegt (selected, portfolio.js:302-311)
- Baum: Zweiton-Markierung is-active/is-path, «Auswahl zurücksetzen»-Knopf hidden/sichtbar; Auswahl aus URL wird aufgeklappt+markiert (restoreTreeSelection portfolio.js:389)
- Ansichtsknöpfe aria-pressed synchron zum Zustand (portfolio.js:267)
- Nicht-gefunden-Zustand für unbekannte id mit Brotkrumen und Rückweg
- Detail: unbekannter ?tab fällt still auf Übersicht zurück (Gebäude UND Grundstück)
- Detail-Tabellen leer: Kopfzeile+Spalten bleiben, emptyMsg-Zeile darunter («Keine X erfasst.», portfolio.js:643); Facetten ohne Optionen entfallen (FACETS, portfolio.js:498)
- Hero-Karte ohne Koordinaten: empty--unavailable «Für dieses Objekt sind keine Koordinaten erfasst.» (portfolio.js:710)
- Grundstück ohne Bodenbedeckungen: Tabelle mit emptyText, Total-Zeile entfällt (portfolio.js:760)

**Interaktionen**

- Suche mit Tipp-Verzögerung (C.wireCatalogueState), Formular pf-search
- Sortier-Select, Ansichtsumschaltung Galerie/Liste/Karte
- Filterpanel auf/zu, Checkbox-Facetten, Panel-Reset, Aktiv-Pille einzeln entfernen, «Alle Filter zurücksetzen» (räumt AUCH Baum-Auswahl ab, onReset portfolio.js:376)
- Baum: Knoten auf-/zuklappen, Ebene/Blatt auswählen (Blatt fokussiert Karten-Popup), «Auswahl zurücksetzen»-Knopf
- Leerzustands-Knopf pf-empty-reset (je Render neu gebunden, portfolio.js:252)
- Blättern: Seitenknöpfe + Seitennummern-Eingabe (wirePagination)
- Listenzeile klickbar (C.wireTableRows, EINMAL auf #pf-main delegiert, portfolio.js:384); Tastatur/SR über den echten Link
- Karte: Cluster auf-/zuzoomen, Punkt-/Polygon-Popups mit Detail-Link
- Detail: Reiterwechsel (C.wireTabs inkl. Tastatur), spiegelt ?tab per replaceState (portfolio.js:689, 784)
- Mosaik-Kachel klicken → Vollbildgalerie beim eigenen Bild (wireHeroMosaic)
- Je Detail-Tabelle: eigene Suche, Sortierung, Facetten, Blätterung (mountDataTable)
- Dokumente: Download-Knopf je Zeile; Kontakte: tel:/mailto:-Links; Kreuzlinks Gebäude↔Grundstück
- Randspalten-Aktionen mit vorbelegtem building=-Query; Teilen-Leiste + Zurück-Link (C.detailBar)

## js/apps/process-docs.js

Prozessdokumentation Bauten: Prozesslandkarte (L1-Bereich → L2-Gruppe → L3-Prozess) als Katalog mit Seitenbaum; Detail mit BPMN-Diagramm (bpmn-js NavigatedViewer, lazy CDN) und viewer-unabhängiger Schrittliste aus dem BPMN-XML (DOMParser) als zugänglicher Alternative.

**Routen**

- #/app/process-docs — Landkarte (Liste + Baum), Standardansicht Liste (Z.179)
- #/app/process-docs?q=… — Suche über ID, Name, Beschreibung, Gruppenlabel, Tags, Systeme (Z.189–193)
- #/app/process-docs?group=<key>,… — Prozessgruppen-Filter (CSV)
- #/app/process-docs?status=<id>,… — Status-Filter (objectStatuses-Lebenszyklus wie Katalogobjekte, Z.139–141)
- #/app/process-docs?sort=nr|name|group — Sortierung (Standard nr numerisch, Z.182–187)
- #/app/process-docs?view=list|gallery — Ansichtswechsel (Z.179)
- #/app/process-docs?page=<n> — Blättern, 12 pro Seite (Z.201–203)
- #/app/process-docs?id=<processId> — Prozess-Detail (Z.156–158)
- #/app/process-docs?id=<processId>&tab=uebersicht|diagramm|schritte — Register-Deeplink, Unbekanntes → Übersicht (Z.366–368)

**Funktionen**

- Katalogleiste: Suche, Trefferzahl (unit {Prozesse, Prozessen}), Sortierung, Filter (Gruppe/Status), Ansichtswechsel Liste/Galerie (Z.278–286)
- Seitenbaum «Prozesshierarchie»: Prozessbereich (L1, mit Zähler) → Prozessgruppen (L2, als Filterlinks); L3 ist die gefilterte Liste rechts — Gruppenklick IST der Filter (Z.235–264)
- Baum-Klappzustand modulweit persistent (OPEN-Map, Standard: alle Bereiche offen, Filterzweig erzwungen offen, Z.150–153, 262)
- Listenansicht: Tabelle Nr.(code)/Prozess-Link mit gekürzter Beschreibung darunter/Prozessgruppe/Status-Badge (Z.224–233)
- Galerieansicht: Karten mit idLine (processId), gekürzter Beschreibung (kurz(), Z.143–148), Gruppen-Badge, Bereichslabel im Footer (Z.215–222)
- Aktive-Filter-Pillen (Suche/Gruppe/Status) mit Entfernen-Links (Z.209–213)
- Detail: detailBar, H1, Beschreibung als Lead, 3 Register — «Übersicht», «Prozessdiagramm» und «Prozessschritte (n)» mit Zähler aus dem BPMN (Z.363–366, 435–441)
- Übersicht: «Verantwortliche Personen» (AdminDir-Links, lokale Kopie von personsSection, Z.374–382), Metadaten-kv Bereich(+Code)/Gruppe als Filterlink/Status-Badge mit Definition+Konsequenz/Version/Unterstützende-Systeme-Badges/Grundlagen/Stand/ID (Z.384–397)
- Randspalte: «Verwandte Prozesse» (Links via links.prozess, Name aus core.processDoc aufgelöst, Z.399–406) + Kontakt-Karte (generische Ansprechstelle CONTACT_ID 'immobilienmanagement', Z.29–30, 407)
- BPMN-Diagramm in einem eigenen Register über die volle Inhaltsbreite; die zweispaltige Übersicht bleibt davon unabhängig (Z.411–428)
- bpmn-js NavigatedViewer 17.11.1 lazy vom CDN inkl. 3 Stylesheets, 12-s-Timeout (Z.32–59)
- Vertikale Overlay-Werkzeugleiste: Vergrössern, Verkleinern und Ausschnitt zurücksetzen (Faktor 1.2, fit-viewport, Z.419–422, 531–536)
- Das Diagramm-Tabpanel besitzt eine sr-only-H2; die gleichwertige textuelle Alternative steht im Register «Prozessschritte». Der interaktive Host trägt bewusst kein `role=img`.
- Schrittliste aus BPMN-XML via DOMParser: 21 typisierte Flusselementtypen in Dokumentreihenfolge, mit Lane-Zuordnung, Ein-/Ausgangszahlen, Dokumentation (parseBpmnSteps, Z.61–135)
- Schrittregister: Datentabelle Nr./Schritt (Fallback «ohne Bezeichnung» + id)/Typ/Rolle(Lane), Facetten Art + Rolle (Lane-Facette nur wenn Lanes existieren), 15 pro Seite (Z.446–467)
- Ein BPMN-Abruf für Diagramm UND Schrittliste (Z.350–360)
- Krume: Anwendungen → Prozessdokumentation Bauten (→ Prozessname im Detail); Screenreader-Trefferansage (Z.166–167, 307, 344–345)

**Zustände**

- needs processes/contacts (Z.23)
- Leerzustand/Ladefehler via catalogueResults + core.available('processes') (Z.294–302)
- NotFound Prozess mit renderNotFound (Z.337–343)
- Filter aktiv: Pillen + Filterzähler (Z.266); Baumzweige offen/zu mit aria-expanded/hidden, aktiver Knoten is-active/aria-current
- Register-Zustand ?tab mit stillem Fallback auf Übersicht (Z.366–367)
- BPMN-Fetch-Fehler: BEIDE Register degradieren einzeln — Schrittliste zeigt Fehlermeldung mit Pfad+Ursache (Z.441–445), Diagramm eigene Meldung (Z.489–493)
- Viewer-CDN-Fehler/Timeout: Meldung mit «Seite neu laden»-Knopf, live-Region; Fehler nicht gecacht → Retry (Z.57, 498–504)
- Import-/Zeichenfehler des Diagramms: eigene Fehlermeldung (Z.515–518)
- Ladeanzeige C.loading «Diagramm wird geladen…» im bpmn-Host (Z.424–426)
- Zoomknöpfe disabled, bis das Diagramm steht (Z.420–422, 513–514)
- Viewer startet erst beim ersten sichtbaren Aufruf des Registers «Prozessdiagramm» (viewerStarted-Guard)
- Aufgeschobenes Einpassen: bei 0×0-Panel (Registerwechsel während CDN-Laden) wird fit gemerkt und beim Rückwechsel per requestAnimationFrame nachgeholt (needsFit/fitDiagram, Z.474–483, 534–539)
- stale()-Prüfungen nach BPMN-Fetch, Viewer-Laden und importXML (Z.359, 499, 506, 511)
- viewer.destroy() via ctx.onUnmount, Fehler beim Zerstören geschluckt (Z.521)
- Seite auf totalPages geklemmt (Z.201–202); Detail-Schritttabelle mit eigenem Such-/Facetten-/Seitenzustand (pd-st)

**Interaktionen**

- Suchformular pd-search (Submit → Hash, C.wireCatalogue, Z.308–311)
- Sortier-Dropdown pd-sort (Nummer/Bezeichnung/Prozessgruppe)
- Filter-Knopf mit Panel: Checkbox-Gruppen Prozessgruppe/Status, Panel-Reset (Z.267–270)
- Pillen entfernen, Gesamt-Reset auf BASE (Z.287)
- Ansichtsumschalter Liste/Galerie (Z.285)
- Pagination mit Seiteneingabefeld pd-page (Z.299–300)
- Baum: Zweigknopf navigiert (nimmt q und view mit, sonst könnte er bei gesetzter Suche nie klappen, Z.256–262) oder klappt an Ort auf/zu; Gruppen-Blattlinks filtern (Z.314–328)
- Zeilenklick in der Liste (C.wireTableRows, Z.312)
- Registerwechsel mit URL-Sync (replaceState); onSelect auf «Prozessdiagramm» startet den Viewer beziehungsweise holt das Einpassen nach
- Overlay-Werkzeugleiste: 3 Knöpfe (in/out/reset), delegierter Klick am .tabs-Kind statt mount gegen Horcher-Ansammlung
- Diagramm: Pan/Zoom mit der Maus (NavigatedViewer, Z.417)
- Schritttabelle: eigene Suche, Sortierung (Reihenfolge/Name), Facetten (Art, Rolle), Blättern (C.mountDataTable, Z.448–467)
- Externe Links: AdminDir-Personeneinträge (target _blank, Z.380–381)
- Interne Links: Gruppen-Filterlink in den Metadaten (Z.389), verwandte Prozesse (Z.402–405), «Seite neu laden»-Knopf im Viewer-Fehlerfall (Z.502)

## js/apps/projects.js

Bauprojekte / EPPM — map-first Explorer nach dem Muster des Inventars, aber eigenes Führungssystem SAP ePPM: KEIN Join in RE-FX, Standort/Bild/Adresse aus data/projects.json, buildingId nur Querverweis (projects.js:1-10). needs=['projects'] (projects.js:27). Geteilte Helfer: spatial-tree.js, map-slot.js, buildings-map.js (initEstateMap ohne Parzellen), hero-mosaic.js (galleryItemsFrom), gallery.js (openGallery), format.chf, domain.js (landName/weOf/projectStatusLabel), links.js (links.bauprojekt/links.objekt); C-Verträge wie portfolio (catalogueBar, wireCatalogueState, catalogueHash, activeFilters, announceCatalogue, pagination, table/wireTableRows, card/cardAction, filterGroup, panelReset, tabBar/tabPanels/wireTabs, detailBar, renderNotFound, empty, badge, notification, select entfällt). NICHT genutzt: estate.js, dashboard-chrome.js.

**Routen**

- #/app/projects — Übersicht (Explorer), Default Galerie (bewusst: Karte zeigt keine Namen/Kennzahlen, projects.js:94-98)
- #/app/projects?view=map|gallery|list — Ansicht; Unbekanntes → gallery
- #/app/projects?q=…&sort=name|cost|status|sia&page=N — Suche/Sortierung/Seite in der URL (C.catalogueHash, projects.js:233)
- #/app/projects?status=…&sia=…&sub=… (CSV) — Facetten Status/SIA-Phase/Teilportfolio
- #/app/projects?land=…&region=…&city=…&we=…&id=… — Baum-Auswahl; id fokussiert wie ein Blatt-Klick die Karte (projects.js:108-109); veraltete Auswahl wird still verworfen (projects.js:335)
- #/app/projects/<projectId> — Projektdetail (Pfadsegment, projects.js:54)
- #/app/projects/<projectId>?tab=uebersicht|kennzahlen|risiken — ?tab-Deeplink, Unbekanntes → Übersicht (projects.js:373)
- #/app/projects/<unbekannt> — Nicht-gefunden-Seite mit Titel/Brotkrumen (projects.js:348)

**Funktionen**

- Katalogleiste: Suche (Projekt/Nummer/PL/Gebäude/Ort, projects.js:117), Zähler #pj-count, Sortierung (Bezeichnung/Investition/Status/SIA-Phase), Filterpanel, Ansichtsumschalter; filterCount aus der URL initialisiert (projects.js:276)
- Filterpanel: Facetten Status (Optionen aus ref.projectStatuses mit Labels), SIA-Phase, Teilportfolio + Panel-Reset
- Aktiv-Pillen: Suche, Baum-Auswahl, Status (übersetzt via projectStatusLabel), SIA, Teilportfolio
- Räumlicher Baum «Projekte»: Land›Region›Stadt›WE (Gebäudename des ersten Eintrags, WE-Nummern-Sortierung)›Projekt (Briefcase-Icon, Projektnummer als Kennung); Blatt = Auswahl-Button
- Galerie: C.card mit Titelfoto, Chips Land+Status AUF dem Bild, idLine Projektnummer, Teaser, Fuss «SIA x · Phase» + Pfeil (cardAction); 9 je Seite
- Liste: C.table zebra+rowsClickable — Projektnr. (Link), Bezeichnung (+Gebäude), Ort (+Land), Status-Badge (geplant=info/aktiv=warning/sistiert=gray/abgeschlossen=success/abgebrochen=error, projects.js:32), SIA-Phase, Investition CHF; 25 je Seite
- Karte: Projektpunkte (keine Polygone), Popup «Projektnummer · Gebäude» mit Detail-Link; Fokus über Baum-/URL-Auswahl
- Blätterung, Ergebniskopf, C.announceCatalogue (Dativ «Projekten»), URL-Sync via C.catalogueHash + replaceState
- Detail: C.detailBar, h1, Lead (Projektnummer · Standort, Ort · Statuswort)
- Detail-Hero: Einbild-Variante (BEWUSSTE Abweichung vom heroMosaic, dokumentiert projects.js:428-438) — Titelbild als Knopf, der die Vollbildgalerie (galleryItemsFrom p.media, ?bild-Param) öffnet; ohne Bilder Farbfläche
- Reiter Übersicht: kv Projektdaten (Projektnummer, Standort+Adresse, Objekt im Inventar als Link via links.objekt, Projektleitung, Teilportfolio, SIA-Phase, BIM-Level, Start, Ende) + Teaser-Absatz
- Reiter Kennzahlen: zwei Stat-Kacheln (Geplante Gesamtkosten, BKP 2 — Gebäude) + kv mit Laufzeit
- Reiter Risiken & Ziele: zwei Boxen mit Ampel-Badges (Ziele/Risiko: Grün=success/Gelb=warning/Rot=error, projects.js:33) samt zustandsabhängigem Beschreibungstext + Info-Notification zur Ampel-Legende

**Zustände**

- Default: Galerie, Sortierung name, keine Filter; gesamter Zustand aus der URL rekonstruierbar
- Leerzustand «Keine Projekte gefunden.» mit Reset-Knopf (delegiert auf #pj-main, projects.js:322)
- Kartenzustand ohne Blätterung; Karte je renderMain und beim Routenverlassen abgebaut (pjMap.free, projects.js:52)
- Seitenklemme vor den Zweigen (auch für die Ansage, projects.js:194)
- aria-pressed am Ansichtsumschalter
- Veraltete Baum-Auswahl aus der URL: still verworfen statt unsichtbarem Filter (projects.js:335-337)
- Nicht-gefunden-Zustand für unbekannte projectId
- Detail: unbekannter ?tab → Übersicht; Hero ohne Bilder = Farbfläche ohne Galerie-Knopf (projects.js:448)
- Ampel-Werte ohne Zuordnung: «Keine Bewertung verfügbar.» (projects.js:414, 419)

**Interaktionen**

- Suche mit Tipp-Verzögerung, Sortierung, Ansichtswechsel, Filter-Checkboxen, Panel-Reset, Pillen entfernen/alle zurücksetzen (Reset räumt auch Baum ab, onReset projects.js:317)
- Baum auf/zu, Ebenen-/Blatt-Auswahl (Blatt fokussiert Karte), «Auswahl zurücksetzen»
- Leerzustands-Knopf pj-empty-reset (delegiert)
- Blättern (Knöpfe + Seitenfeld pj-page)
- Listenzeile klickbar (wireTableRows auf stabilem #pj-main, projects.js:330)
- Karten-Popups mit Detail-Link, Cluster-Zoom
- Detail: Reiterwechsel per Tastatur/Klick (wireTabs), ?tab per replaceState (projects.js:481)
- Hero-Knopf öffnet Vollbildgalerie bei Bild 0 (projects.js:487)
- Teilen-Leiste + Zurück-Link (detailBar); Querverweis-Link ins Liegenschaftsinventar

## js/apps/space-request.js

Raumbedarf melden — 3-Schritt-Wizard (Angaben → Bedarf → Prüfen & Absenden), erzeugt Vorgang 'raumbedarf' unter «Meine Vorgänge»; exportiert needs=['buildings'] (Z.9), Router lädt Bestand vor render().

**Routen**

- #/app/space-request — Raumbedarf-Wizard (router.js:102); keine Query-Varianten, verlinkt u. a. aus tenancies.js:695

**Funktionen**

- 3-Schritt-Wizard mit gemeinsamem Gerüst C.wizardHead (Schrittanzeige + sr-only-Schrittüberschrift + Pflichtfeld-Legende) — STEP_LABELS Z.59, Z.74
- Rück-Link zur Dienstleistungsbeschreibung «raumbedarf-melden» (C.backLink, Z.23/68) — auch im ausgeloggten Zustand
- Kontextzeile: Aktion/Antragsteller/Org + Prozesspfad «Eingang → Prüfung GS → Prüfung PFM → Entscheid» (C.contextLine, Z.70)
- Schritt 1: Verwaltungseinheit (vorbelegt aus session.user().org, Z.39), Kostenstelle, Gebäude-Select aus core.buildings() (Z.95-96), Anzahl Personen
- Schritt 2: NAW-Klassen-Select aus core.ref().nawClasses (Z.33/107), Wunschtermin (date), Begründung (textarea)
- Live-Flächenschätzung als Info-Notification: Personen × 12 m² × Desk-Sharing-Faktor aus core.ref().deskSharingFactor, Fallback 0.8 (Z.34-35, 50, 109)
- Schritt 3: Zusammenfassung als kv-Liste (8 Positionen inkl. berechneter Fläche, Z.122-132) + Hinweis-Notification zum Vorgangsstart (Z.133)
- Vorgangserzeugung engine.start('raumbedarf') mit Titel «Raumbedarf N AP — Gebäude», data-Payload und linkedEntities.buildingId nur wenn gewählt (Z.197-203)
- Erfolgsseite C.processDone mit Referenz, Deep-Link «Vorgang ansehen» (links.vorgang) und «Zu den Dienstleistungen» #/services (Z.142-147)

**Zustände**

- Abgemeldet: Login-Gate (C.loginGate, AGOV/FedLogin-Aufforderung) statt Formular, gleicher Seitenkopf (Z.17-30)
- Schrittzustand state.step 1-3; Feldwerte überleben Vor/Zurück im state-Objekt (Z.37-48)
- Fehlerzustand je Feld (state.errors) + Fehlerübersicht C.errorSummary mit Klartext-Labels/Sprungmarken (FIELD_LABELS Z.54-57, Z.75)
- Validierung Schritt 1: org/cc Pflicht, persons ganzzahlig 1-5000 (Rohwert wird erst NACH erfolgreicher Prüfung normalisiert, Z.171-174); bld bewusst optional (Z.175-177)
- Validierung Schritt 2: Begründung Pflicht (Z.179); termin optional
- Pflichtfeld-Legende nur Schritt 1-2, entfällt auf Schritt 3 (legend: state.step < 3, Z.74)
- Erfolgszustand state.created → drawDone statt Formular (Z.62, 137)
- Speicherfehler: engine.start liefert null → C.flashError «konnte nicht gespeichert werden» (Z.205)
- novalidate-Formular: eigene CD-Fehlerebene statt Browser-Constraint-Validierung (Z.76-82)

**Interaktionen**

- «Weiter» (submit): readStep → validate → Schrittwechsel mit Fokus auf Schrittüberschrift inkl. Ansage «Schritt n von 3: Name» (C.focusWizardStep, Z.194)
- «Zurück»-Button (data-back) auf Schritt 2/3: liest Werte, geht zurück, fokussiert Schrittkopf (Z.207-208)
- «Antrag absenden» (btn--lg mit Checkmark-Icon) auf Schritt 3 (Z.134)
- Fehlversuch: Neuzeichnen + Fokus auf Fehlerübersicht, Sprungmarken zu den Feldern (C.wireErrorSummary, Z.193, WCAG 3.3.1)
- Feld-Fehlerbadges verschwinden bei Korrektur (C.wireFieldErrors, Z.216)
- Live-input-Listener auf #persons hält Rohwert für die Flächenschätzung in Schritt 2 (Z.211-214)
- Fokus + Schreibmarke werden über jeden Neuaufbau gerettet (C.preserveFocus, Z.64/86)
- Erfolgsseite: Fokus auf Erfolgsüberschrift + Ansage der Referenz (C.focusProcessDone, Z.151)
- Login-Gate-Aktion im ausgeloggten Zustand (C.loginGate, Z.26)

## js/apps/tenancies.js

Mietende — Sicht der mietenden Verwaltungseinheit auf ihre Flächen; Einheit ist das MIETVERHÄLTNIS, nicht das Gebäude (tenancies.js:1-15); kein Join, buildingId nur Querverweis. needs=['tenancies','floors','spaces','contracts'] (tenancies.js:28). Einziges der drei Module mit Grundriss-Betrachter (floorplan.js: floorplanSvg/floorplanLegend/wireFloorplan/COLOR_MODES) und Vorgangs-Anbindung (engine.instances über linkedEntities.buildingId, tenancies.js:373). Geteilte Helfer: spatial-tree.js, map-slot.js, buildings-map.js, hero-mosaic.js (heroMosaic/galleryItemsFrom; Galerie-Klicks BEWUSST lokal verdrahtet, weil wireHeroMosaic auf #pf-mosaic gepinnt ist, tenancies.js:869-875), gallery.js, format.js, domain.js (landName/statusLabel), links.js (links.mietverhaeltnis/objekt/vorgang); C-Verträge wie die Geschwister + C.select, C.mountDataTable mit foot. NICHT genutzt: estate.js, dashboard-chrome.js.

**Routen**

- #/app/tenancies — Übersicht (Explorer), Default Galerie, Default-SORTIERUNG 'end' (Vertragsende zuerst — abweichend von den Geschwistern, tenancies.js:96)
- #/app/tenancies?view=gallery|list|map&q=…&sort=name|area|end|cost&page=N — URL-Vollzustand (C.catalogueHash, tenancies.js:194)
- #/app/tenancies?ve=… (CSV) — VE-Facette; nur BEKANNTE VE-Kürzel werden übernommen (tenancies.js:101)
- #/app/tenancies?land=…&region=…&city=…&obj=… — Baum-Auswahl (obj = Blatt/tenancyId, tenancies.js:105)
- #/app/tenancies/<tenancyId> — Detail (Pfadsegment)
- #/app/tenancies/<id>?tab=uebersicht|grundriss|vertrag — ?tab-Deeplink; Unbekanntes UND das alte tab=vorgaenge fallen auf Übersicht zurück (tenancies.js:395-398)
- #/app/tenancies/<id>?floor=<floorId> — öffnet den Grundriss-Betrachter dieses Geschosses AUCH ohne tab= (tenancies.js:413); ungültige floorId wird verworfen
- #/app/tenancies/<id>?floor=…&color=<mode>&space=<spaceId> — geteilter Grundriss-Zustand: Einfärbung (Default 've', validiert gegen COLOR_MODES, tenancies.js:421) und gewählter Raum
- #/app/tenancies/<id>?bild=N — Vollbildgalerie-Param (openGallery {param:'bild'})
- #/app/tenancies/<unbekannt> — Nicht-gefunden-Seite (tenancies.js:360)

**Funktionen**

- Katalogleiste: Suche (Objekt/Ort/VE/Departement/ID/Strasse, tenancies.js:117), Zähler «N von M Mietverhältnissen», Sortierung (Objekt/Fläche/Vertragsende/Jahresmiete), VE-Filterpanel (Optionen mit Trefferzahl «BAFU (3)», tenancies.js:263), Ansichtsumschalter
- Aktiv-Pillen: Suche, VE-Werte, Baum-Auswahl (Stadt vor Region vor Land, tenancies.js:221)
- Räumlicher Baum «Standorte»: Land›Kanton (attr data-region)›Ort›Mietverhältnis (Home-Icon, VE-Kürzel als Kennung, Gebäudename als Label)
- Galerie: C.card mit Foto, Chips VE + Geschosse, Beschreibung «VE-Name · Departement», Fuss «HNF · N AP» + Pfeil; 9 je Seite
- Liste: C.table rowsClickable — Objekt (Link+Adresse), Verwaltungseinheit (+Departement), Geschosse, Fläche, AP, Vertragsende + Restlaufzeit-Badge; 25 je Seite
- Restlaufzeit-Badge restBadge: «noch N Monate/Jahre», abgestuft warning ≤12 Mte / info ≤36 / success — EINE Fassung für Liste UND Detailkopf (tenancies.js:43)
- Karte: Punkte aus lat/lon des Mietverhältnisses (Doppelbelegungen liegen exakt übereinander, Cluster fasst sie, tenancies.js:169), Popup «VE · Geschosse · HNF» mit Detail-Link
- Blätterung, C.announceCatalogue (unit {nom,dat}), URL-Sync via replaceState
- Detail-Kopf: detailBar (Zurück+Teilen), Augenbrauenzeile «tenancyId · Objekt buildingId» (tenancies.js:816), h1, Lead (Adresse · VE · Geschosse), Restlaufzeit-Badge als Pillenzeile
- Detail-Hero: heroMosaic (#mt-mosaic) + Standortkarte (#mt-hero-map, Punkt, focusPopup:false); Kacheln öffnen Vollbildgalerie
- Reiter Übersicht: KPI-Streifen (Fläche HNF, Arbeitsplätze, Fläche je AP, Jahresmiete, tenancies.js:446) + kv (VE, Objekt, Geschosse, Mietbeginn, Vertragsende, Kostenstelle, Objekt im Inventar als Link) + Abschnitt «Anträge zu diesem Mietobjekt» (Datentabelle der Engine-Vorgänge: Referenz-Link zu «Meine Vorgänge», Anliegen, Ablauf, Status-Badge, Aktualisiert)
- Randspalte (im Übersichtspanel): C.actionCard (Störung melden, Kleinauftrag, Umzug, Raumbedarf melden, Reklamation — alle mit vorbelegtem building=/type=-Query; Zeile entfällt, wenn die Dienstleistung fehlt, tenancies.js:691) + «Dokumente zum Gebäude» → document-archive?building= + C.contactCard (Rolle als Beschriftung)
- Reiter Grundrisse — Zustand 1 Geschosstabelle (mountDataTable): Geschoss-Link + Badge «Ihr Standort», Räume, HNF, Arbeitsplätze, «Davon <VE>» (eigene Räume+Fläche, tenancies.js:738), tfoot-Totale über die GEFILTERTE Menge (tenancies.js:747), Suche + Sortierung Niveau/Fläche/Räume, rowsClickable
- Reiter Grundrisse — Zustand 2 Betrachter (bei ?floor=): klebende Kopfleiste mit Rücksprung «Alle Geschosse» (echtes href ?tab=grundriss), Geschoss-Chips als tag-item mit ECHTEN ?floor=-Zielen (Mittelklick/Link-Kopieren funktioniert, tenancies.js:560-567), Einfärben-Select (C.select, COLOR_MODES, Default 've'), Vollbild- und Drucken-Knopf
- Betrachter-Fläche: interaktives SVG (floorplanSvg) mit Raumauswahl, data-scroll-region für Überbreite (tenancies.js:608); Seitenpanel mit Geschoss-kv (Räume/HNF/Bruttofläche), Legende (floorplanLegend, entfällt bei color=none) und Raum-Panel (Raumnummer, Nutzung, Fläche, SIA 416, Arbeitsplätze, VE, Buchbar; «Raum buchen» → #/app/workspace; «Vorgang starten»-Kurzwege Störung/Kleinauftrag/Umzug mit building+room vorbelegt, tenancies.js:679)
- Nur-Druck-Fusszeile mit Objekt/Geschoss/Einfärbung (tenancies.js:634)
- Reiter Verträge: Datentabelle (Vertrag, Art, Partnerin, Gültig ab/bis, Betrag, Status-Badge; Facette Vertragsart, Sortierung Gültig-bis/Betrag)
- Teil-Neuzeichnung redrawGrundriss: tauscht nur #mt-grundriss__body — Kopf/Mosaik/Reiter bleiben, Fokus bleibt erhalten (tenancies.js:855)

**Zustände**

- Default: Galerie, Sortierung 'end'; VE-Filter aus URL validiert (unbekannte Kürzel verworfen)
- Leerzustand «Keine Mietverhältnisse gefunden.» mit vollem Reset (delegiert auf #mt-main, tenancies.js:345)
- Kartenzustand: Zähler BEWUSST ohne Seiten-Suffix (Karte zeigt alle Treffer, dokumentierte Abweichung tenancies.js:228)
- Seitenklemme; aria-pressed am Ansichtsumschalter; Baum-Markierung + Clear-Knopf aus URL wiederhergestellt (tenancies.js:337)
- Nicht-gefunden-Zustand; unbekannter/legacy ?tab → Übersicht
- Grundriss: OHNE ?floor= steht die Geschosstabelle (bewusste Entscheidung, kein Auto-Erstgeschoss, tenancies.js:403-406); MIT ?floor= der Betrachter; keine Geschosse → C.empty «kein Grundriss hinterlegt» (tenancies.js:515)
- Einfärbung Default 've' (Belegung), color=none blendet Legende aus; Raum gewählt/keiner (leeres Raum-Panel mit Hinweis, tenancies.js:644)
- Aktiver Geschoss-Chip: tag-item--active + aria-current, erneuter Enter-Klick ist abgewacht (tenancies.js:935)
- Vollbild an/aus (Fullscreen-API auf #fp-wrap samt Bedienung; Esc beendet; Rücksprung verlässt Vollbild zuerst, tenancies.js:908-910)
- Druckzustand body.print--plan (nur der Plan; afterprint + 1s-Sicherheitsnetz räumt auf, tenancies.js:954-960)
- Leere Tabellen: Verträge «Keine Verträge erfasst.», Anträge «…kein Antrag offen.» (tenancies.js:759, 783)
- Aufräumen bei Routenverlassen: floorplan-detach, heroMap.free, Tabellen-Detacher (onUnmount tenancies.js:964)

**Interaktionen**

- Suche mit Tipp-Verzögerung, Sortierung, Ansichtswechsel, VE-Checkboxen, Panel-Reset, Pillen entfernen/alle zurücksetzen (Reset räumt auch Baum ab)
- Baum auf/zu, Auswahl, «Auswahl zurücksetzen»; Blätterung (Knöpfe + Seitenfeld mt-page); Listenzeilen-Klick
- Karten-Popups + Cluster
- Detail: Reiterwechsel (wireTabs, ?tab per syncHash); Mosaik-Kacheln → Vollbildgalerie (?bild)
- Geschosstabelle: Zeilen-/Link-Klick öffnet Betrachter (?floor=); eigene Suche/Sortierung
- Betrachter: Geschoss-Chips (Klick zeichnet nur den Grundrissbereich um, Mittelklick folgt dem echten Link), Einfärben-Select (Fokus bleibt auf dem Select, tenancies.js:925-927), Raumklick im SVG wählt/hebt bei erneutem Klick auf (Fokus zurück auf das Raum-Rect, tenancies.js:917-923), Rücksprung «Alle Geschosse» (Fokus auf ersten Tabellen-Link, tenancies.js:913)
- Vollbild-Knopf (beide Richtungen), Drucken-Knopf (window.print mit print--plan)
- Raum-Panel: «Raum buchen»-Link (nur bookable), «Vorgang starten»-Dienstleistungslinks mit building+room
- Randspalte: vorbelegte Aktionslinks, Kontakt-Links; Teilen-Leiste + Zurück-Link
- Anträge-Tabelle: Referenz-Link zum Vorgang; Verträge-Tabelle: Facette/Suche/Sortierung

## js/apps/transaction.js

Veräusserung von Bundesliegenschaften — statische Stub-/Demo-Seite der Transaktionsplattform (Divestment): 7-Phasen-Verkaufslebenszyklus als passive Pipeline + Timeline, fiktive Objektliste mit Links ins Portfolio, Beteiligten-Box; keine echten Vorgänge.

**Routen**

- #/app/transaction — einzige Route, keine Unterrouten/Query-Varianten (router.js:108)

**Funktionen**

- pageHeader mit deutschem Titel, englischer Fachbegriff (Divestment) im Lead (transaction.js:78-81)
- Stub-Warnung: Notification warning — Objekte/Status/Schritte sind fiktive Demo-Daten (transaction.js:83)
- 7-stufiger Verkaufslebenszyklus als C.pipeline (passiver Prozessstatus, NICHT stepIndicator); Demo-Stand Schritt 5 «Vermarktung» (CURRENT_STEP=4) (transaction.js:17-28,53)
- Timeline «Phasen im Detail»: alle 7 Phasen mit Beschreibung, Klassen done/current je Position (transaction.js:55-58,91-94)
- Tabelle «Objekte in Veräusserung» (zebra, rowsClickable): Objektname als Link → #/app/portfolio?id=<bbl_id> mit bbl_id-Unterzeile, Standort (Strasse/PLZ/Ort), fiktiver Status als Badge (warning/info/gray) (transaction.js:60-72)
- Fiktive Status auf reale Gebäude gemappt (core.building über Slash-IDs); nicht gefundene ausgelassen (transaction.js:31-40)
- Box «Beteiligte»: Rollenliste Portfoliomanagement / Recht-Beurkundung / externe Makler (transaction.js:103-113)

**Zustände**

- Demo-/Stub-Zustand (explizit als Warnung deklariert) — keine Lade-, Leer- oder Fehlerzustände darüber hinaus (transaction.js:83)
- Fallback: sind <2 der fiktiven Objekte im Bestand auffindbar, werden die ersten 3 Gebäude mit rotierenden Status aufgefüllt (transaction.js:41-48)

**Interaktionen**

- Zeilenklick auf die Objekttabelle → Portfolio-Objektdetail (C.wireTableRows am pro Render neuen Container, gegen Listener-Ansammlung) (transaction.js:63-66,116-119)
- Objektname-Link in der ersten Zelle → #/app/portfolio?id=… (transaction.js:67)

## js/apps/workspace.js

Workspace Management — eigenständige Planungsanwendung für Arbeitsplatzkapazität, Geschosse, Zonen und Verwaltungseinheiten. Buchung und E-Shop sind getrennte Anwendungen; die Route enthält keine Tabs.

**Routen**

- #/app/workspace — Planungsoberfläche
- #/app/workspace?building=…&floor=…&color=… — Gebäude, Geschoss und Einfärbung direkt adressieren
- Alte Tab-Links werden umgeleitet: `buchung` → `#/app/room-booking`, `moeblierung` → `#/app/shop`, `belegung` → `#/app/workspace`

**Funktionen**

- Gebäudeauswahl über alle Objekte mit planbaren Geschossen und Arbeitsplätzen
- Kennzahlen für Arbeitsplätze, Szenario-Personalbestand, Arbeitsfläche und Verwaltungseinheiten
- Live-Szenario aus Personalbestand und Ziel-Desk-Sharing-Faktor mit Bedarf, Reserve oder Fehlbestand
- Geschosstabelle mit Räumen, Arbeitsfläche, Arbeitsplätzen, Verwaltungseinheiten und Zuteilungsgrad
- Interaktiver SVG-Grundriss mit Geschosswahl, Einfärbung nach Verwaltungseinheit, Nutzung oder Belegungsdichte und Raumdetail
- Verknüpfung zum Gebäude im Liegenschaften Inventar

**Zustände**

- Gewähltes Gebäude, Geschoss und Einfärbung werden aus der URL gelesen
- Fehlende Geschoss-/Raumdaten ergeben einen expliziten Leer- oder Ausfallzustand
- Das Planungsszenario aktualisiert Ergebnis und Kennzahl ohne Seitenwechsel

**Interaktionen**

- Gebäude, Geschoss und Einfärbung wechseln über native CD-Auswahlfelder bzw. Tag-Links
- Personalbestand und Desk-Sharing-Faktor rechnen das Szenario unmittelbar neu
- Räume im Grundriss sind per Maus und Tastatur auswählbar

## js/apps/room-booking.js

Raumbuchung — eigenständige, loginpflichtige Aktionsanwendung für Sitzungs- und Besprechungsräume.

**Routen und Funktionen**

- #/app/room-booking — «Raum finden»; `building`, `room`, Zeitraum, Gruppengrösse, Filter und Ansicht sind tief verlinkbar
- «Meine Buchungen» zeigt bevorstehende sowie vergangene/stornierte Reservierungen
- Kriterien: Standort, Datum, Start/Ende und Teilnehmende; Verfügbarkeit wird gegen vorhandene Buchungsvorgänge geprüft
- CD-Katalogleiste mit Sortierung, Ausstattungs-/Barrierefreiheitsfiltern und Umschalter zwischen Liste und Grundriss
- Ergebnisliste mit Raumname, Raumnummer, Kapazität, Fläche, Ausstattung und ehrlich beschriftetem Foto bzw. Platzhalter
- Grundriss mit Zuständen für verfügbar, belegt, nicht passend und ausgewählt sowie aufgelegten Zoom-/Einpassen-Werkzeugen
- Randspalte mit Gebäudekarte, Raumdetails, Pflichtfeld Sitzungstitel, optionalen Eingeladenen und Buchungszusammenfassung
- Abschluss über `engine.start('buchung', …)` und `C.processDone`; Kalendereintrag als ICS herunterladen
- Eigene künftige Buchungen stornieren, vergangene wiederholen; anonym weiterhin `C.loginGate`

## js/app.js

Bootstrap: lädt core+engine parallel, rendert Shell, startet Router, verdrahtet Datenausfall-Band, Prototyp-Banner, globalen Teilen-Dialog und den AGOV/FedLogin-Stub (window.__login/__logout).

**Funktionen**

- Boot wartet nur auf core.load()+engine.load() (services+reference, 4 Requests); Rest je Route via needs — app.js:30-42
- Datenausfall-Band (P0-4): failedAreas von core UND engine als role=alert-Notification mit Bereichsliste in #data-status — app.js:12-28
- Horcher auf Event core:data-failed — auch später nachgeladene Ausfälle (core.ensure) erscheinen im Band — app.js:45
- Prototyp-Hinweisbanner (mountBanner, id 'prototyp', «Verstanden»-Knopf, localStorage-Merker) — app.js:55-61
- Teilen-Dialog EINMAL global delegiert (wireShare(document)) — überlebt jeden Seitenwechsel — app.js:53
- window.__login/__logout: Session setzen, Header neu rendern, redraw() abwarten, Ansage («Angemeldet als …»), Fokus zurück auf den Auth-Knopf — app.js:71-84
- window.__engine — Testzugang zur Prozess-Engine für Prüfskripte — app.js:88
- Boot-Fehlerband: bewusst OHNE C.notification (letztes Auffangnetz, nur escape) — app.js:96-100

**Zustände**

- Boot erfolgreich vs. Boot-Fehler («Die Anwendung konnte nicht gestartet werden: …»)
- Datenbestand vollständig vs. teilweise ausgefallen (Band sichtbar)
- Banner ungesehen vs. weggeklickt (localStorage bbl_banner_prototyp)

**Interaktionen**

- «Seite neu laden»-Knopf im Datenausfall-Band (location.reload) — app.js:26
- «Verstanden»-Knopf am Prototyp-Banner (schliesst + merkt + Ansage)
- An-/Abmelden über die Header-Knöpfe bzw. loginGate (rufen window.__login/__logout)

## js/charts.js

Geteilte SVG-Chart-Renderer des Datenportals (kein Chart-Lib, no-build): Formen line/column/bar/pie/area/table, Karten-Anatomie (figure/Titel/Kebab/Legende/Note/sr-only-Datentabelle), breitenabhängige Geometrie mit ResizeObserver, Tooltips, Vollbild-Modal und Export (CSV/Excel/PNG/Link) — Regressionsfläche für dataportal.js UND estate.js.

**Routen**

- keine eigene Route — von #/app/dataportal/* und #/app/dataportal/immobilien (estate.js) verwendet

**Funktionen**

- Liniendiagramm: Serien aus series-Spalte, 2px-Linien mit runden Kappen, >=8px-Punkte mit 2px-Oberflächenring, Endpunkt-Direktlabel (14px fett), «Ziel»-Serie gestrichelt, Gridlines + ganzzahlige Ticks (charts.js:159-207)
- Säulendiagramm: gruppierte Säulen <=24px mit 4px-Rundung am Datenende (square baseline), 2px-Oberflächenlücke zwischen Balken (charts.js:209-254)
- Balkendiagramm horizontal: anteilige Label-Spalte mit Ellipsis-Kürzung (voller Text im title), Wert-Direktlabel je Balken (charts.js:256-295)
- Ring-/Kreisdiagramm: echte Kreisring-Pfade, 2px-Oberflächen-Trennstrich, %-Label ab 8% Segmentanteil, Gesamtsumme + «Total» in der Mitte (nur wenn Platz), 100%-Sonderfall geschlossener Ring (charts.js:297-354)
- Gestapelte Fläche: kumulative Bänder, Tooltip mit Serien-Gesamtsumme (charts.js:356-403)
- Kennzahlen-Tabelle (form 'table'): sichtbare Mehrjahres-Tabelle mit Gruppentitelzeilen, optionaler einheit-Spalte je Zeile, Fussnoten-Liste, scrollbarem Wrapper; Menü ohne PNG (charts.js:405-435,449-457)
- Karten-Anatomie chart(): figure mit Titel (id-t für aria-labelledby), Kebab-Menü, Legende ab 2 Serien, leeres .chart__plot (2. Durchgang), note-Fusszeile, sr-only-Datentabelle mit caption (charts.js:437-480)
- paintCharts: synchroner Füll-Durchgang nach Layout + ResizeObserver-Neuzeichnen (1x pro Frame), Registry für Vollbild; gibt Aufräumfunktion zurück (charts.js:497-524)
- Palette aus CSS-Tokens zur Renderzeit aufgelöst (PNG-Export-Kompatibilität), Slot-Zuordnung in Reihenfolge (charts.js:24-54)
- Zahlenformat de-CH (Tausender ab 1000, max 1 Dezimale), «nice» Achsenmaximum, ganzzahlige Ticks bei Zähl-Achsen (charts.js:89-115)

**Zustände**

- Chart leer oder Query-Fehler: figure mit .empty «Keine Daten für diese Auswahl.» bzw. result.error (charts.js:443-446)
- Plot unsichtbar (Breite 0, inaktiver Tab): wird ausgelassen, ResizeObserver zeichnet beim Sichtbarwerden nach (charts.js:510-512)
- Ohne ResizeObserver (Testumgebung): nur Einmal-Zeichnung, No-op-Cleanup (charts.js:516)
- Toast-Zustände für Exporte: Erfolg (grün), Fehler (error), «nicht verfügbar» (warning) (charts.js:602-628)

**Interaktionen**

- Kebab-Menü je Chart: Vollbild · Als CSV · Als Excel · Als Bild (PNG) · Link kopieren; Tabellen-Variante ohne PNG (charts.js:60-69,412)
- Vollbild: kanonisches Modal (size xl), Klon ohne Kopf/ids, SVG in gemessener Modalbreite NEU gezeichnet, Tooltip im Modal neu verdrahtet (charts.js:556-589)
- Karten-Figur: Vollbild via Fullscreen-API, PNG vom WebGL-Canvas (toBlob), Rest → Warn-Toast (charts.js:606-619)
- Hover/Fokus-Tooltip auf jedem [data-tip]-Mark; Escape schliesst (WCAG 1.4.13), Scroll versteckt (charts.js:527-554)
- CSV/Excel-Export liest die (sr-only bzw. sichtbare) Datentabelle; Dateiname aus fileSlug(Titel) (charts.js:599,622-627)
- Link kopieren → Clipboard mit Erfolgs-/Fehler-Toast (charts.js:602)

## js/dashboard-chrome.js

Gemeinsames Dashboard-Chrome für dataportal.js und estate.js (eine Quelle statt zweier wortgleicher Kopien): KPI-Kachel mit Deltas/Sparkline/Hint, Dashboard-Kopf mit Toolbar-Menü, Filterpanel-Hülle, Einklapp-Logik (responsiv), Fusszeile und Menü-Handler.

**Routen**

- keine eigene Route — Chrome beider Dashboards (#/app/dataportal/* inkl. immobilien)

**Funktionen**

- KPI-Kachel kpiTile: Label, Wert + Einheiten-Span, bis zu 2 Delta-Chips (Pfeil ▲/▼ + sr-only «positive/negative Entwicklung», is-good/is-bad; undefined = neutral ohne Pfeil), Sparkline, Stichtags-Hint (dashboard-chrome.js:39-72)
- Sparkline: achsenlose Miniaturlinie 96x26 mit Endpunkt-Marker, aria-hidden/dekorativ, ab 2 endlichen Werten (dashboard-chrome.js:49-61)
- dashHeader: pageHeader (lead oder leadHtml) + optionales extra-HTML + Dashboard-Aktionsmenü (dashboard-chrome.js:76-81)
- DASHBOARD_MENU: Aktualisieren · Herunterladen (PDF/Bild — simuliert) · Teilen (Link kopieren/Per E-Mail — echt) (dashboard-chrome.js:16-28)
- filterPanelShell: aside mit Kopf «Filter», Einklapp-Knopf (aria-expanded), Body vom Aufrufer (dashboard-chrome.js:84-92)
- dashFooter: Quelle (statisch oder per sourceId-Span je Tab wechselbar — estate), Stand als format.datum, fester «Demo-Daten»-Hinweis (dashboard-chrome.js:98-104)

**Zustände**

- Filterpanel eingeklappt/ausgeklappt: Desktop (>=1024px) via .dashboard-layout--collapsed, darunter via .filter-panel--collapsed; mobil Default eingeklappt (dashboard-chrome.js:115-118)
- aria-expanded/aria-label/aria-controls des Toggles nach jedem Wechsel und bei Breakpoint-Wechsel (matchMedia change) synchronisiert (dashboard-chrome.js:119-127,138)
- matchMedia-Horcher via AbortController an ctx.onUnmount gebunden (kein Leck über Routenwechsel) (dashboard-chrome.js:136-138)
- Delta-Chip neutral (deltaGood undefined): kein Pfeil, keine Erfolgs-/Warnfarbe (dashboard-chrome.js:39-44)

**Interaktionen**

- Filter-Toggle-Klick klappt Panel bzw. Layout um (dashboard-chrome.js:129-133)
- Toolbar-Menü-Handler wireDashboardMenu: refresh → onRefresh + Toast «Dashboard aktualisiert.»; pdf/img → «im Prototyp simuliert»-Toast; copy → Clipboard mit Erfolgs-/ERROR-Toast; mail → shareMail mit Titel «<Board> — BBL Datenportal» (dashboard-chrome.js:145-155)

## js/dashboard-chrome.js

KEIN Routen-Modul — geteiltes Dashboard-Chrome (Superset-Muster). Konsumenten laut Kopfkommentar und Importen: js/apps/estate.js UND js/apps/dataportal.js — NICHT portfolio/projects/tenancies. Exporte→Nutzer: DASHBOARD_MENU (Menüstruktur; via dashHeader beide Boards), kpiTile (KPI-Kachel mit Delta-Chips/Sparkline/Hint; estate+dataportal), dashHeader (Kopf mit Aktionsmenü; beide), filterPanelShell (Panel-Hülle #dash-filters/#filter-body/#filter-toggle; beide), dashFooter (Quelle/Stand via format.datum/Demo-Marke; beide), wireFilterCollapse (Einklapp-Logik + matchMedia-Abmeldung über ctx.onUnmount; beide), wireDashboardMenu (Menü-Handler refresh/pdf/img/copy/mail mit Toasts; beide). DOM-ids/Klassen (.dash-header/.dash-grid/.filter-panel/#filter-toggle/#filter-body/#dash-filters) sind testgepinnt (scripts/test-dashboard.mjs, dashboard-chrome.js:9-11) — beim Refactoring stabil halten.

**Funktionen**

- kpiTile: Kachel mit Label, Wert+Einheit, bis zu ZWEI Delta-Chips (deltaGood true/false/undefined=neutral; Pfeil ▲/▼ + sr-only «positive/negative Entwicklung» — WCAG 1.4.1), achsenloser Sparkline-SVG (aria-hidden, ab 2 Werten), Stichtags-Hint (dashboard-chrome.js:63)
- dashHeader: pageHeader (lead ODER leadHtml) + extra-HTML + C.menu «Dashboard-Aktionen» mit DASHBOARD_MENU
- filterPanelShell: aside #dash-filters mit Kopf, Einklapp-Knopf #filter-toggle (aria-expanded) und Körper #filter-body (Inhalt liefert der Aufrufer)
- dashFooter: Quelle als Text ODER leeres per-JS gefülltes span (sourceId), Stand-Datum über format.datum formatiert, feste Marke «Demo-Daten»

**Zustände**

- Einklapp-Zustand zweigleisig: Desktop (≥1024px) toggelt .dashboard-layout--collapsed am Layout, mobil .filter-panel--collapsed am Panel; unter lg standardmässig ZUgeklappt (dashboard-chrome.js:118)
- aria-expanded/aria-label des Toggles werden bei jedem Wechsel und bei matchMedia-Änderung synchronisiert (syncToggle); Horcher wird über ctx.onUnmount abgemeldet (AbortController, dashboard-chrome.js:136-138)
- Delta-Chip neutral (deltaGood undefined): kein Pfeil, keine Farbklasse; Sparkline entfällt bei <2 endlichen Werten

**Interaktionen**

- Filter-Einklapp-Knopf (Klick toggelt je Viewport Layout- oder Panel-Klasse)
- Dashboard-Menü (wireDashboardMenu über C.wireMenu): refresh → onRefresh()+Toast «Dashboard aktualisiert.», pdf/img → Simulations-Toast, copy → copyText(location.href) mit Erfolgs- oder ERROR-Toast «Kopieren nicht möglich.», mail → shareMail mit «<Titel> — BBL Datenportal»

## js/knowledge-content.js

Inhaltsbestand von «Wissen und Hilfsmittel» (113 Unterlagen in 22 Abschnitten, 6 AREAS, 5 FAQS) mit zwei Lesern: knowledge.js rendert, search.js indexiert via knowledgeIndex(). Keine eigene Route.

**Routen**

- Keine — liefert aber die Suchziele: Abschnitt #/knowledge/<key>?section=wi-<id> je Abschnitt/Unterlage/FAQ; externe Einträge (Fedlex, BKB) und interne #/-hrefs sind direktes Suchziel (knowledgeIndex, knowledge-content.js:248-282)

**Funktionen**

- AREAS-Struktur je Fachgebiet: title/lead/intro(HTML)/sections mit id/title/intro und items|html|faq (knowledge-content.js:17-225)
- Unterlagen mit title/desc/meta (Format+Grösse bzw. Quelldomain), external-Flag, optionalem href (extern oder #/-intern)
- sectionDomId-Präfix wi- gegen id-Kollisionen («preise» existiert in zwei Fachgebieten, knowledge-content.js:235-238)
- FAQS: 5 Frage/Antwort-Paare für das Akkordeon der processes-Seite und die Suche (knowledge-content.js:227-233)
- knowledgeIndex(): flacher Suchindex — je Abschnitt, je Unterlage, je FAQ eine Zeile; Ziel ist der Abschnitt, nie die Platzhalter-Datei (knowledge-content.js:243-282)

**Zustände**

- Keine — reiner statischer Bestand im Bundle (bewusst JS statt JSON, kein Extra-Request; knowledge-content.js:8-10)

**Interaktionen**

- Keine eigenen — definiert aber die Link-/Download-Ziele, die knowledge.js und die Suche rendern

## js/apps/shop.js

Portal-native erste Version des BBL Intranetshops. Nutzt die Produkt- und
Kategoriedaten aus `data/shop-products.json` und `data/shop-categories.json`,
lokale Produktbilder sowie die gemeinsamen Katalog-, Tabellen-, Formular- und
Prozessbausteine.

**Routen**

- `#/app/shop` – Produktkatalog
- `#/app/shop/product/<id>` – Produktdetail
- `#/app/shop/cart` – Warenkorb
- `#/app/shop/checkout` – Login-Gate oder dreistufiger Bestellassistent

**Funktionen**

- Suche über Produkt, Beschreibung, Marke und Kategorie; hierarchischer Kategorienbaum; Marken- und Neuheitenfilter; Sortierung nach Bezeichnung, Preis und Neuheit
- Kategorien stehen auf Desktop in der Seitenleiste und unter 1024 px innerhalb der bestehenden Filter-Disclosure; beide Varianten verwenden dieselben Hash-Links und Zähler
- Galerie- und Listenansicht mit zwölf Produkten je Seite, URL-synchronisierten Filtern und Pagination
- CD-Karten mit Produktbild, Marke, Beschreibung, Preis und Warenkorb-Aktion; vollständige Produktdetailansicht mit Menge, Produktdaten und ähnlichen Produkten
- Warenkorb in `localStorage` (`bbl_shop_cart_v1`), Mengen 1–99, Entfernen, Positions- und Gesamtsumme; globaler Zähler im Top-Header über `shop:cartchange`
- Checkout mit Kostenstelle, Lieferadresse, Bemerkung, Fehlerübersicht und Prüfschritt; erzeugt über die Prozess-Engine einen Vorgang `bestellung`

**Zustände**

- Daten verfügbar, Ladefehler, keine Treffer, unbekanntes Produkt
- Warenkorb leer, gefüllt oder durch Produktänderungen bereinigt
- Checkout abgemeldet, Schritte Warenkorb/Lieferung/Prüfen, Validierungsfehler, erfolgreich eingereicht

**Interaktionen**

- Suche, Filter, Kategorien, Sortierung, Ansicht und Seitenwechsel schreiben den Zustand in den Hash
- Produkt hinzufügen, Menge ändern, Position entfernen und globalen Warenkorb öffnen
- Checkout vor/zurück, Pflichtfelder korrigieren, Bestellung absenden und erzeugten Vorgang öffnen
