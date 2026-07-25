# Technische Code-Review — BBL Kundenportal

**Stand:** 25. Juli 2026 · **Gegenstand:** Prototyp (laufender Stand, no-build Vanilla ES-Module)
**Umfang:** gesamte Codebasis (~6 800 Zeilen JS in 34 Modulen · ~1 750 Zeilen CSS · 17 JSON-Datensätze)

Senior-Developer-Review der **Technik** (Korrektheit, Sicherheit, Robustheit, Komplexität, Modularität, Performance) — Gegenstück zum funktionalen/gestalterischen `design-review.md`. Befunde nach Themen gegliedert; **Prio** (Hoch · Mittel · Niedrig) gewichtet nach Wirkung, **Status** zeigt den Umsetzungsstand. Ausdrücklich respektiert wird der bewusste Rahmen: **kein Build-Schritt, kein Framework, keine externen Abhängigkeiten** (Ausnahme: MapLibre lazy für eine Karte); Prozess-Engine und Query-Layer sind **absichtlich gemockt** — das ist kein Mangel.

## Legende (Status)

| Status | Bedeutung |
|---|---|
| **Erledigt** | behoben und (wo sinnvoll) verifiziert |
| **Teilweise** | Kern behoben, Rest offen |
| **Offen** | Befund, noch nicht angegangen |
| **Geplant** | grössere Umbaute, bewusst als eigene Runde |
| **Verworfen** | bewusst nicht umsetzen |

**Methode:** sechs parallele Fachagenten (Fundament/Routing · geteilte Komponenten · Shell/Navigation · Seiten · Micro-Apps · CSS), lesend gegen den laufenden Stand; anschliessend konsolidiert, entdupliziert und die Hoch-Befunde stichprobenartig gegen den Code verifiziert. Schwerpunkte: XSS-Grenze (`innerHTML`/`escape`), Event-Listener-Leaks, Fehlerpfade und konkrete Extraktions­kandidaten.

> **XSS-Gesamturteil (alle sechs Agenten einig): kein aktiv ausnutzbares XSS.** Jede dynamische, nutzer-/URL-/localStorage-nahe Interpolation ist am Renderpunkt escaped (Suchbegriff `q`, Formularwerte aus localStorage in `my-cases.js`, Chart-`data-tip` via `textContent`, Karten-Popups). Die Sicherheitsbefunde (B) betreffen **latente** Lücken (undokumentierte Roh-HTML-Slots, wenige unescapte Attribute mit heute konstanten Daten) — Härtung, nicht Notfall.

---

## A · Korrektheit & Defekte

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| A1 | **Falsche Tab-Klasse** — `activate()` schaltet `tag-item--active` statt `tab__control--active`; Markup nutzt `tab__control` (`portfolio.js:316`). Tab 0 bleibt dauerhaft aktiv markiert, der geklickte Tab bekommt eine wirkungslose Klasse. Sichtbarer Defekt auf **jeder** Liegenschafts-Detailseite | Hoch | **Erledigt** | `portfolio.js:328` auf `tab__control--active` korrigiert; anschliessend strukturell durch **D1** (`C.wireTabs`) abgelöst — headless-verifiziert |
| A2 | **Router-Race beim Rendern** — das Dispatch-„Ticket" (`stale()`) schützt Pre-Render und Fokus, **nicht** den `mount.innerHTML`-Schreibvorgang **innerhalb** eines `await`-Renders. Seiten, die intern awaiten (`applications.js:27` dyn. Import, `data.js`, `katalog.js`), können bei schneller Navigation die neue Seite überschreiben → URL/Nav zeigen B, Bildschirm zeigt A | Hoch | **Erledigt** | `ctx.stale()` in `makeCtx` exponiert; die zwei await-vor-Schreiben-Delegatoren (`applications.js` Detail, `data.js` Unterseiten — die einzigen, die vor dem Schreiben awaiten) prüfen `if (ctx.stale()) return;` nach dem `await import`. Irreführender Kommentar korrigiert. Headless-verifiziert (`scripts/test-race.mjs`): schnelle Navigation A→B landet immer auf der zuletzt angeforderten Seite (auch beim ungecachten Import-Rennen, mehrere Timings), 0 Exceptions |
| A3 | **Listener-Leak in `renderHeader`** — bei jedem Login/Logout re-rendert `app.js:35-37` den Header; `el.innerHTML=` verwirft Kind-Listener, aber die 5 globalen `document`/`window`/`matchMedia`-Handler (`shell.js:327,447,460,463,492`) werden nie entfernt. Nach N Umschaltungen: 5N Handler + N verwaiste Header-DOM-Bäume festgehalten; der veraltete keydown-Handler mutiert weiter `body`/`main.inert` → doppelte Escape-Seiteneffekte | Hoch | **Erledigt** | Pro Render `shellAbort?.abort()` + neuer `AbortController`; `{signal}` an allen 5 globalen Listenern. Probe (8× Login/Logout): 0 Fehler, Header rebuilt, 32/32 Listener mit Signal → gebundene aktive Anzahl. Decomposition (E1) bleibt offen |
| A4 | **Doppel-Dispatch beim Laden** — `location.hash='#/'` feuert `hashchange`→`dispatch()`, danach läuft das explizite `dispatch()` erneut; Startseite rendert zweimal (2. als Schein-Zustandswechsel, doppelte Live-Ansage) | Mittel | **Erledigt** | `router.js:265-266` → `else dispatch();` |
| A5 | **Ungeschützter `s.target`-Zugriff** — `s.target.kind`/`.href` läuft für jede Dienstleistung inkl. `type:'information'`; fehlt `target`, wirft es `TypeError` → generisches Fehlerband statt Detailseite | Mittel | **Erledigt** | `services.js` → `const tgt = s.target || {}` (heute defensiv: alle 20 Dienstleistungen haben ein `target`); Detailseite unverändert verifiziert |
| A6 | **`decodeURIComponent` kann werfen** — malformte Hashes (`#/applications/%`) lösen `URIError` **vor** dem Not-found-Pfad aus → rohes Fehlerband statt gestylter „nicht gefunden"-Seite | Mittel | **Erledigt** | neues `C.safeDecode()`; `application.js`/`katalog.js` nutzen es. Verifiziert: `#/applications/%C3%28` → gestyltes „Anwendung nicht gefunden" |
| A7 | **`instanceId`-Kollision** — `'inst-'+Date.now()` kollidiert bei gleicher Millisekunde; es ist der Primärschlüssel (`instance`/`advance`) → zweiter Vorgang unerreichbar (Doppel-Submit) | Mittel | **Erledigt** | `process-engine.js` → `+'-'+Math.random().toString(36).slice(2,7)`. Node-verifiziert: zwei Starts in derselben ms → eindeutige IDs |
| A8 | «5Treffer für …» — toter Ternär (beide Zweige `'Treffer'`) **und** fehlendes Leerzeichen nach `</strong>` | Niedrig | **Erledigt** | `search.js` → `</strong> Treffer für …` (Ternär entfernt, «Treffer» ist im Deutschen sing./plur. gleich); verifiziert |
| A9 | `advance()` liest `def.steps.length` ohne `def.steps` zu prüfen (`start()` tut es); eine Definition ohne `steps` wirft `TypeError` | Niedrig | **Erledigt** | `process-engine.js` → `!Array.isArray(def.steps)` ergänzt |
| A10 | Fokus geht bei reinem Zustandswechsel an `<body>` verloren, wenn das auslösende Element keine `id` hat (`activeId` nur bei truthy `id` erfasst); trifft auch den Post-Login-`redraw()` (Login-Button ohne id) | Niedrig | Offen | `router.js:200-201,239-241` → Fallback `focusHeading(mount)` bei leerem `activeId` |
| A11 | Chart-Geometrie-Randfälle: `per=min(24,(band-8)/n)` kann ≤0 werden (negative Balkenbreite); `lineChart` erzeugt bei kategorialem x `NaN`; `chart()` nimmt `result.columns/sql` als vorhanden an | Niedrig | Offen | `charts.js:121,77-79,200-201` → `per=max(1,…)`, `||[]`/`||''`; heute ausserhalb der Demodaten |
| A12 | `parseHash` verliert bei mehrfachem `?` alles nach dem 2.; `matchesSubNav` reimplementiert dieselbe Aufspaltung | Niedrig | Offen | `router.js:101-106,121-124` → einmal `indexOf('?')`; Split-Helper teilen |
| A13 | `sql` `count`-Aggregat über benannte Spalte benennt die Ausgabespalte nach der Spalte statt `count`; `groupBy===col` kollidiert im Objektliteral | Niedrig | Offen | `sql.js:76-82` → Zählwert immer als `count` ausgeben; Selbst-Aggregation absichern |
| A14 | Ungültige `?id=` bei Weisungen zeigt still die Übersicht statt Not-found (anders als `newsDetail`) | Niedrig | Offen | `knowledge.js:24-30` → `C.notFound` für unbekannte id |
| A15 | Karten-`sub` erzeugt führendes Komma bei leerer `street` (`, 3003 Bern`) | Niedrig | **Erledigt** | `buildings-map.js` → `[b.street, \`${zip} ${city}\`.trim()].filter(Boolean).join(', ')`; Karte mit 12 Markern verifiziert |
| A16 | **Absturz abgemeldet — `session.user()` = null** — drei transaktionale Wizards dereferenzieren `session.user().name/.org` ungeschützt: `space-request.js:14` (Zustands-Init → sofortiger Absturz beim Direktaufruf), `fault-report.js:105` (Formular) und `workspace.js:137` (Buchung-Tab — **über die normale Navigation erreichbar**, nicht nur per Direktaufruf). Der Normalpfad ist am Dienstleistungs-CTA (`services.js:146`) anmeldungs-gated, der Direktaufruf bzw. der Buchung-Tab jedoch nicht → weisser Bildschirm / toter Tab statt Login-Hinweis | Hoch | **Erledigt** | Login-Gate analog `my-cases` (gemäss Anmelde-Entscheid): `space-request`/`fault-report` mit frühem `return C.loginGate(...)`, `workspace` nur in `panelBuchung()` (Möblierung/Belegung bleiben frei sichtbar). Headless-CDP-verifiziert: abgemeldet Gate statt Absturz (0 Exceptions), angemeldet rendert das Buchungsformular («Buchung als Andrea Muster · BAFU»). **Beim D1-Tabtest entdeckt** |

## B · Sicherheit (XSS · Injection · CSP)

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| B1 | **Undokumentierte Roh-HTML-Slots** — ~15 `C.*`-Helfer geben Aufruferdaten **unescaped** durch (`notification` text, `notFound` body, `detailHead` tags/image, `detailSection`/`accordion` body/meta, `table` `render()`, `card` footer/badges/image, `empty` hint, `catalogueResults` note, …). Alle heutigen Aufrufer escapen — **kein Live-XSS** —, aber nichts signalisiert HTML- vs. Text-Parameter → ein unachtsamer künftiger Aufruf = Stored/Self-XSS | Hoch | Offen | `components.js` — Roh-Slots per Konvention umbenennen (`bodyHtml`/`noteHtml`/`textHtml`) und je Slot `// RAW HTML — Aufrufer muss escapen` |
| B2 | **Zwei unescapte Attribute** — `tile` `href="${href}"` (`components.js:95`) und `card` `<img src="${o.image}">` (`:106`), während `card`/`domainTile`/`backLink` den href sonst escapen. Heute konstante/`encodeURI`-Werte, aber ein `"` bricht aus dem Attribut aus | Hoch | **Erledigt** | `escape(href)` / `escape(o.image)` gesetzt |
| B3 | Boot-Fehlerhandler interpoliert `e.message` unescaped in `innerHTML` (obwohl `escape` importiert und in derselben Datei genutzt; `router.js:251` escapet es) | Mittel | **Erledigt** | `app.js:43` → `escape(e.message)` |
| B4 | Unescapte `mailto`/E-Mail + Label in vertrauenswürdigen Kontaktdaten: `services.js:183` (mailto+Text), `services.js:38` (`domainLabel`), `fault-report.js:96` (mailto), `grundlagen.js:94/97` (`docItem` href). `application.js`/`katalog.js` escapen bereits | Niedrig | **Erledigt** | Mit **D4** gelöst: `C.contactBox` (services/application — mailto + E-Mail escaped), `C.downloadItem` (href escaped in grundlagen/knowledge/digitalisierung); zusätzlich `domainLabel` in der services-Karte und die `isbo`-mailto in fault-report escaped |
| B5 | `navyRow` interpoliert `href` unescaped (während `data-navsub` escaped ist); ebenso `topBarNav`/`metaNav`/Footer `fLink` — heute statisch | Niedrig | Offen | `shell.js:13` → `escape(child.href)` konsistent |
| B6 | Inline `onclick` bei `shareBar` (Clipboard, `window.print`), `loginGate`, Auth-Buttons — bricht unter strikter `script-src`-CSP und weicht vom `addEventListener`-Muster ab. `shareBar`-Clipboard scheitert im unsicheren Kontext (`http://<LAN-IP>`) still, Promise-Rejection entkommt dem `try/catch` | Niedrig | Offen | `components.js:216-217,535`, `shell.js:152` → `data-*`-Hooks + zentrale Bindung; Clipboard feature-detecten + `.catch()` + Feedback |
| B7 | `photo` `style` erlaubt CSS-Injection, falls `color` je dynamisch wird (`escape()` ist HTML-, nicht CSS-Escaper; `;` passiert). Heute nur Datendateien | Niedrig | Offen | `components.js:31` — Hex/Keyword-Allowlist, falls je nutzer-/datengetrieben |

## C · Fehlerbehandlung & Robustheit

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| C1 | **Stiller localStorage-Datenverlust** — `saveLS` schluckt Quota-/Serialisierungsfehler, `start()`/`advance()` melden trotzdem Erfolg. Bei `QuotaExceededError` verpufft der Schreibvorgang, der Aufrufer navigiert zu `#/my-cases/<id>`, `instance(id)` liest leer → „nicht gefunden" nach erfolgreicher Absendung | Mittel | **Erledigt** | `saveLS` gibt bool zurück; `start`/`advance` liefern `null` bei Fehler; die 3 Wizards zeigen `C.flashError(...)` statt still weiterzumachen. Node-verifiziert (Quota-Mock → `start()` = null) |
| C2 | **Karte erholt sich nie** — ein transienter CDN-Fehler cached eine **abgelehnte** `mlPromise`; jeder spätere `initBuildingsMap` gibt sie zurück und wirft erneut → „Karte"-Tab bleibt bis zum vollen Reload tot | Mittel | **Erledigt** | `buildings-map.js` → `.catch(e => { mlPromise = null; throw e; })` (Fehler nicht cachen) + 12 s Load-Timeout |
| C3 | `engine.load` prüft `response.ok` nicht (fetch rejectet nicht bei 404); ein JSON-Fehlerbody setzt `DEFS` auf Nicht-Array → `DEFS.find` wirft. `core`/`sql` schützen mit `r.ok` — Ausreisser | Niedrig | **Erledigt** | neues `fetchArray()` in `process-engine.js` (prüft `r.ok` + `Array.isArray`) |
| C4 | JSON, das parst aber falsch geformt ist (`buildings.json`→`{}`), umgeht den Failed-Key-Pfad; erster Accessor (`{}.find`) wirft | Niedrig | **Erledigt** | Mit **D6** gelöst: `core.load()` fordert je Datei `shape: 'array'\|'object'` an; eine parsende-aber-falsch-geformte Datei wirft nun und landet im `FAILED`-Pfad (Fallback `[]`/`{}`) statt später beim Accessor. Unit-verifiziert |

## D · Architektur & Modularität (Extraktionskandidaten)

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| D1 | **Tab-Komponente extrahieren** — Tab-Markup + APG-Tastaturverdrahtung (roving tabindex, Arrow/Home/End) **5×** kopiert, davon eine mit Bug (A1) und eine ohne Tastatur (`projects.js`). Geteilte a11y-Logik ist die riskanteste Duplikation | Hoch | **Erledigt** | `C.tabBar({items,active,idPrefix,ariaLabel,panelId,controlsClass})` + `C.tabPanels({items,active,idPrefix,render})` + `C.wireTabs(root,{onSelect,syncHash})` in `components.js`. Alle 5 Kopien ersetzt (portfolio · projects · workspace · dataportal · my-cases); **eine** APG-Implementierung (roving tabindex, Klick + Pfeil/Home/End, Fokus per Neuabfrage → überlebt Neurender), deckt Mehr-Panel (auto `[data-panel]`) und Einzel-Panel/`onSelect`-Neurender ab. Behebt A1 **und** die fehlende Tastaturbedienung in `projects.js`. Headless-CDP-verifiziert (Edge): Panel-Umblenden, aria-selected, roving tabindex, Fokusführung, Tastatur und Hash-Sync (`?tab=` nur für Nicht-Default) auf allen vier abgemeldet erreichbaren Ansichten, 0 Konsolenfehler. Netto weniger Code trotz +3 Helfern |
| D2 | **Katalog-Triplett zusammenführen** — `services`/`applications`/`katalog` teilen Suchformular, View-Switch-/Submit-Verdrahtung und `hash()`-Builder nahezu identisch | Mittel | **Erledigt** | `C.catalogueHash(base,{q,page,view,…filters})` (ersetzt 3× lokale `hash()`; String → gesetzt, Array → komma-verbunden), `C.catalogueControls({formId,inputId,…,filters})` (die identische `service-controls`-Suchleiste) + `C.wireCatalogue(mount,{…,hash,filters:[{id,param}]})` (Submit → Seite 1, einfache Filter, View-Switch, Pagination). Alle drei Seiten auf Daten + `card`/`listView` + eine `base`/`hash`-Closure reduziert; services' mehrwertiges `topic` separat verdrahtet. Headless-verifiziert (`scripts/test-catalogue.mjs`): Deep-Links (q/view/filter), Submit/View/Filter-Interaktion, Pill-Entfernung, `topic=A,B`, Detailansichten — 0 Exceptions |
| D3 | **Formular-Helfer konsolidieren** — `field(id,label,control,err,hint)` **3× byte-identisch** (workspace/fault-report/space-request), 3 divergente Select-Builder, `val(id)` 3×; die fertigen `C.field()`/`C.select()` liegen **ungenutzt** und escapen strenger | Mittel | **Erledigt** | 3× lokale `field()` + `selectWrap`/`selectControl` + `val()` gelöscht; alle drei Wizards routen über `C.field({…,control:(cls,attrs)=>…})` / `C.select({…,options})`; neu `C.val(mount,id)` + `C.readForm(mount,{key:id})`. Behebt **C5** by construction. Headless-verifiziert (`scripts/test-forms.mjs`): #org/#cc/#beschreibung/#datum bekommen bei Validierungsfehler `input--error`+`aria-invalid`+Badge, erfolgreicher Submit erstellt einen Vorgang — 0 Exceptions |
| D4 | **Download-Item vereinheitlichen** — 4 Renderer: `C.downloadItem`, `grundlagen.docItem` (in knowledge/digitalisierung wiederverwendet), `application.entryItem`+`resourceItem`; divergent bei Heading/external/Icon/Meta/`<li>`/Escaping | Mittel | **Erledigt** | `C.downloadItem` um `{note/desc, meta, icon, external, heading, wrapLi}` erweitert — deckt Dokument · App-Einstieg · Ressource · Anhang ab; `grundlagen.docItem` + `application.entryItem`/`resourceItem` gelöscht (grundlagen/knowledge/digitalisierung/application/my-cases routen darüber). Neu `C.contactBox(contact)` (intern escaped) für services/application. Headless-verifiziert (`scripts/test-content.mjs`): download-items (20/7/2/3/2) + Kontakt-mailto rendern, 0 Exceptions |
| D5 | **`js/storage.js`** — localStorage-Boilerplate (Read-mit-Fallback / Write-schluckt-Quota) 2× hand-gerollt (`session.js:14-22`, `process-engine.js:10-11`), subtil unterschiedlich | Mittel | **Erledigt** | `js/storage.js` mit `readJSON(key,fallback)`, `writeJSON(key,val)→bool`, `remove(key)`; `session.js` + `process-engine.js` nutzen es (trägt den C1-Fix) |
| D6 | **`fetchJSON(url,{fallback})`** — drei verschiedene `fetch→json→fallback`-Implementierungen mit drei Robustheitsgraden (`core` prüft `r.ok`+FAILED; `sql` still; `engine` gar nicht) | Mittel | **Erledigt** | Neues `js/fetch-json.js` mit `fetchJSON(url,{shape:'array'\|'object'})` — prüft `r.ok`, parst, validiert die Grundform, wirft bei Fehler; `core`/`sql`/`process-engine` fangen und tracken selbst (FAILED / stiller Fallback). Ersetzt drei divergente Implementierungen inkl. `engine.fetchArray`. Unit-getestet (Mock-`fetch`, inkl. C4-Fälle) + alle fünf Headless-Suites grün |
| C5 | **Fehlerklasse greift nicht** — die `field()`-Regex hängt `input--error` nur an, wenn bereits `class="…"` existiert; klassenlose Pflichtfelder (`#org`,`#cc`,`#persons`,`#datum`,`#beschreibung`) bekommen nie den roten Rahmen (aria-invalid + Badge rendern, degradiert) | Mittel | **Erledigt** | Mit **D3** gelöst: `C.field()` übergibt dem Control `cls = 'input--outline input--base'` (+ `' input--error'` bei Fehler) bedingungslos — die vormals klassenlosen Pflichtfelder bekommen jetzt Rahmen + `aria-invalid`. Headless-verifiziert (`scripts/test-forms.mjs`) |
| D7 | Weitere Extraktionen: `C.renderNotFound(ctx,…)` (7× Not-found-Ritual), `C.chipGroup` + `C.tagItem`-Adoption + Konvergenz auf `C.viewSwitch` (portfolio/projects/mediathek), `C.steps`/`C.fileSize`/ein Status-Badge, `C.kvBox`, `C.AUDIENCES`+Closed-Status → `core` | Niedrig | Offen | Siehe F (Duplikations-Inventar) |

## E · Komplexität & Vereinfachung

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| E1 | `renderHeader` ist ein ~200-Zeilen-Monolith (Skip-Link, Mobil-Drawer, Flyouts, Drill-down, Suche in einem Scope) — genau das versteckt den Leak A3 | Mittel | Offen | `shell.js:294-497` → `wireMobileDrawer/wireFlyouts/wireDrilldown/wireSearch` (pro Render, element-scoped) + einmaliges `wireGlobalShellListeners()` |
| E2 | Verschachtelte 3-Wege-`level0`-Konstruktion (mischt `navyRow`/`themaBranchRows`/`areaBranchRows`/`branchRow`/`resolveChildren` inline) | Mittel | Offen | `shell.js:84-93` → `level0Rows(item)` liefert Array, Pane-Template = ein `<ul>` |
| E3 | Gitterlinien+Ticks zwischen `lineChart`/`columnChart` verbatim dupliziert | Niedrig | Offen | `charts.js:82-85,124-127` → `gridY(max,py,x1,x2)` (wie `barPath` bereits geteilt) |
| E4 | `ikt-vorhaben.js:77` klont ein statisches read-only-Array sinnlos (`.map(v=>({...v}))`); `:95` `C.badge(...STATUS[r.status])` wirft bei unbekanntem Status | Niedrig | **Erledigt** | `const rows = VORHABEN;` direkt; `C.badge(...(STATUS[r.status] || [r.status, 'gray']))`; Seite verifiziert |

## F · Duplikation (Inventar — speist D)

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| F1 | `escape`/`esc` **3× byte-identisch** (`components.js:39`, `charts.js:20`, `buildings-map.js:29`); `doc-viewer` importiert korrekt `C.escape` | Niedrig | Offen | `import { escape }` in charts + buildings-map, lokale löschen |
| F2 | Visually-hidden-Idiom **5×** hand-kopiert (`.sr-only`, `.logo__title`, `.search__button__title`, `.btn--icon-only .btn__text`, `table caption`) | Niedrig | Offen | `app.css:102,347-348,419,753-754,886` → `.sr-only` wiederverwenden / eine Selektorliste |
| F3 | Audience-Map 3× (`services:190`, `applications:19`, `components.audienceTag:66`); Closed-Status-Liste 2× (`home:12`, `my-cases:10`); `formatSize`/`fmtSize` 2×; `projectStatusBadge` 2×; Step-Bar 2× (`space-request:27`, `transaction:47`) | Niedrig | Offen | `C.AUDIENCES`+`C.audienceLabel`; Closed-Status→`core`; `C.fileSize`; ein Status-Badge; `C.steps` |
| F4 | `.text--light` 2× deklariert (`app.css:50` & `218`); redundante `:focus-visible`-Re-Deklarationen (`.table-wrapper`/`input`/`.view-switch__btn` = global) | Niedrig | Offen | Zeile 50 entfernen; redundante Outlines droppen |

## G · Performance & Ressourcen

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| G1 | `doc-viewer` fügt den `backdrop`-Scroll-Listener bei **jedem** `mount()` neu hinzu (init **und** jede Vor/Zurück-Navigation) → ein Leak pro Navigation; jeder läuft `querySelectorAll`+`getBoundingClientRect` pro Scroll-Frame | Mittel | **Erledigt** | Scroll-Listener + `raf`-Throttle einmalig in `openDocumentViewer` gebunden (backdrop stabil; `total`/`indicator` je `mount()` aktualisiert und im Handler live gelesen) statt je `mount()`. Headless-verifiziert: Öffnen → Weiter-Navigation → Scroll aktualisiert die Seitenanzeige weiterhin (liest den neuen `total`), 0 Exceptions |
| G2 | `dataportal` berechnet `withYearRange(spec,…)` zweimal je Chart | Niedrig | Offen | `dataportal.js:193` → `const ranged = withYearRange(...)` hochziehen |
| G3 | `instances()` re-`JSON.parse`t localStorage bei jedem Aufruf; `instance(id)` ruft es → N Parses für N Instanzen. `servicesByDomain`/`applicationsByGroup` bauen Maps pro Render | Niedrig | Offen | `process-engine.js:28`, `core.js:67,69` — bei winzigen Daten Notiz; memoisieren nur bei Hot-Path |
| G4 | Voller `mount.innerHTML`-Neuaufbau je Tastenanschlag (`mediathek:167`, `document-archive:179`, `workspace:259`) — bei heutigen Datenmengen unkritisch, kein Leak (ersetzte Knoten werden GC't) | Niedrig | Offen | Gezieltes Teil-Rendering erst wenn Listen wachsen |

## H · CSS-Qualität & toter Code

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| H1 | **Fokus-Ring-Übermatch (a11y-Defekt)** — `[class*="bg--secondary-5"] :focus-visible` matcht auch die **helle** `.bg--secondary-50` (Substring), die auf hellen Sektionen live ist (`home.js:41`, `search.js:119`); Tastaturfokus dort bekommt den kontrastarmen negativen Ring (#c4b5fd, für dunkle Chrome) → WCAG 2.4.7/1.4.11. `-8`/`-9`-Matcher sind tot | Hoch | **Erledigt** | `app.css:92` — `[class*=bg--secondary-5]` → exakt `.bg--secondary-500` (helles `-50` matcht nicht mehr; `-6/-7/-8/-9` bleiben, kein Kollisions-Token) |
| H2 | **Toter CSS-Code in Menge** — ~40 verifiziert ungenutzte Selektoren + 3 tote Tokens. Highlights: External-Link-Affordanz (`app.css:65-73` — **kein** `rel="external"` im JS, feuert nie), ganzer `.ratio`-Block (244-249), Badge-Farb-Aliasse/Varianten (853-858), `.input--negative`-Familie, `.photo--*`-Utilities, `.subnav`, `.notification--alert/--warning` | Hoch | Offen | Löschen; volle Liste im Review-Anhang. Tote Tokens: `--modal-z`, `--sticky-z`, `--fs-9xl` |
| H3 | `.btn .icon,.btn__icon{width:1.4em}` (0,2,0) übersteuert `.icon--lg/xl/2xl` (0,1,0) in Buttons; latent (ShareBar bei 627-629 gepatcht) — jeder künftige Grossicon-Button rendert 1.4em | Mittel | Offen | `app.css:749` — auf größenlose Icons scopen oder dokumentieren |
| H4 | `#main-content a:not(…)`-Kette (~10 `:not()`, 3× für base/hover/focus), Spezifität ~(1,10,1); korrekt nur per Opt-out-Konvention — neue link-artige Komponente ohne Opt-out-Klasse wird zwangs-unterstrichen/rot. `:not(.tile)` ist vestigial | Mittel | Offen | `app.css:56-62` → auf Opt-in `.content-link`/`.prose a` invertieren; totes `:not(.tile)` droppen |
| H5 | Token-Inkonsistenz Big-Number-Chrome: `.stat__num` `--text-3xl` (responsiv) vs. `.kpi__value` `--fs-3xl` vs. `.dash-hero__value` `--fs-6xl`; Labels mischen `--text-*`/`--fs-*`. Chrome-Regel = fixe `--fs-*` | Niedrig | Offen | `app.css:1125,1317,1279` — Metrik-Kacheln auf `--fs-*` vereinheitlichen |
| H6 | Kleinkram: `.clicked{…!important}` unnötig (477); tote z-Tokens + `#main-footer(60)` überragt `#main-header(30)` (Footer kann Mega-Menü überzeichnen); `.icon{width:auto}` sofort überschrieben (252-256); `.box` in 3 Blöcken; Rest-Hardcodes (`10px`/`36px`/`#f7f9fb`) | Niedrig | Offen | Sammelkorrektur |

## I · Konsistenz & Feinschliff

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| I1 | `encodeURIComponent` uneinheitlich auf id-hrefs (portfolio/mediathek encoden; projects/transaction/services roh; my-cases gemischt) | Niedrig | Offen | Eine Regel: encode-beim-Bauen + safe-decode-beim-Lesen; via `hrefFor(kind,id)` |
| I2 | Eingabevalidierung unterschiedlich: `applications` validiert `bereich/audience` gegen Listen; `services`/`katalog` akzeptieren jeden URL-Wert (leeres Ergebnis + roher Pill) | Niedrig | Offen | Konsistent gegen die geteilten Options-Listen validieren |
| I3 | Redundantes `!!(…)` in `aria-pressed` (portfolio/mediathek/projects); fehlende `C.announce` bei Filteränderung in mediathek/portfolio/document-archive (WCAG 4.1.3) | Niedrig | Offen | `!!` droppen; `C.announce`/`C.announceCatalogue` ergänzen |
| I4 | Stale/tote Kommentare: `space-request.js:165` „bind persons not needed" direkt vor dem Code, der `#persons` bindet; toter `resolveChildren`-`themen`-Zweig (`shell.js:46-56`); `components.js:497` `unit` doppelt escaped | Niedrig | Offen | Kommentare korrigieren; Zweige entfernen |
| I5 | Tote Exporte: `session` `onChange/listeners/emit` (Pub-Sub ungenutzt), `sql.colIndex`/`topic`/`datasets`, `intranet-areas.areasAsNav`, `components.tile`/`chevron`, `engine.reset`, `router.matchesSubNav` | Niedrig | Offen | Entfernen. `C.field`/`C.select` sind seit **D3** in Verwendung; `C.tagItem` bleibt Extraktionsziel (D7) |

## J · Stärken

| # | Befund |
|---|---|
| J1 | **Kein aktives XSS** — durchgängige Escape-Disziplin am Interpolationspunkt; sechs unabhängige Agenten bestätigen. localStorage-Formularwerte, Suchbegriff, Chart-Tooltips (`textContent`), Karten-Popups alle korrekt behandelt |
| J2 | **Robustes `core.load()`** — per-Datei `try/catch` in `Promise.all`, korrekte Array-vs-Objekt-Fallbacks, Failed-Key-Tracking speist ein ehrliches Datenausfall-Band (design-review P0-4) |
| J3 | **Saubere SPA-Architektur** — Router → `render(ctx)` → `innerHTML` + Wire; konsistenter Seitenvertrag, dispatch-Ticket (bis auf A2), getrennter Zustandswechsel-vs-Navigations-Fokus |
| J4 | **Gute ARIA-Grundlage** — tablist/roving-tabindex, persistente Live-Region, `inert`-Drawer, Escape-Handling (auch wenn dupliziert → D1) |
| J5 | **Starke Token-Disziplin** — bewusste Hardcodes dokumentiert; fixe vs. responsive Typo-Ramp klar getrennt; `doc-viewer`-keydown-Listener korrekt einmal-gebunden/aufgeräumt (das richtige Muster) |
| J6 | **Sinnvolle Mock-Grenze** — `sql.js`/`process-engine.js` bilden Superset/Camunda plausibel nach (Query-Spec + „View query"-SQL), ohne echtes Backend vorzutäuschen |

---

## Nächste Schritte (Vorschlag)

1. **Schnelle Hoch-Fixes** (klein, hohe Wirkung) — **erledigt & verifiziert:** A1 (Tab-Klasse), H1 (Fokus-Ring-Selektor), A3 (Listener-Leak via `AbortController`), B2 (zwei Attribut-Escapes), B3 (`escape(e.message)`), A4 (`else dispatch`).
2. **Robustheit** — **erledigt & verifiziert:** D5 (`storage.js`), C1 (Speicherfehler → `null` + `C.flashError`), A7 (id-Entropie), A5/A6 (`target`/`safeDecode`-Guards), A9 (`def.steps`-Guard), C2 (`mlPromise`-Reset + Timeout), C3 (`fetchArray` mit `r.ok`). Offen bleibt der breitere **D6 `fetchJSON`** (core/sql/engine noch nicht vereinheitlicht).
3. **Modularitäts-Runde** (grösster LOC-/Drift-Abbau): **D1** (`C.tabBar`/`C.tabPanels`/`C.wireTabs`), **D2** (`C.catalogueHash`/`C.catalogueControls`/`C.wireCatalogue`), **D3** (`C.field`/`C.select`/`C.val`/`C.readForm`, behebt C5) und **D4** (`C.downloadItem`/`C.contactBox`, löst B4) — **erledigt & verifiziert** (`scripts/test-*.mjs`; D1 fand & behob nebenbei **A16**). Als Nächstes: **D6** (`fetchJSON`), dann E1 (`renderHeader` zerlegen), C4, und der Rest.
4. **Toter-Code-Sweep**: H2 (~40 CSS-Selektoren + 3 Tokens), I5 (tote JS-Exporte), F1–F4 (mechanische Dedup).
5. **Sicherheits-Posture**: B1 (Roh-HTML-Slots umbenennen/dokumentieren) + B4/B5/B6 (Escaping/CSP-Härtung) — kein Notfall, aber schliesst die latente Lücke.
6. **A2 Router-Race** — **erledigt & verifiziert** (`ctx.stale()` + Guards in den beiden Import-Delegatoren; `scripts/test-race.mjs`).
