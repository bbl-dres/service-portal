# Design- und UX-Review — BBL Kundenportal

**Datum:** 23. Juli 2026 · **Gegenstand:** Prototyp im Stand dieses Tages
**Referenzen:** CD Bund (`designsystem/`, v1.0.5) · bbl.admin.ch · swisstopo.admin.ch · kbob.admin.ch · WCAG 2.1 AA / P028 / eCH-0059

## Methode

Sechs Fachreviews parallel: CD-Komponententreue · Informationsarchitektur · Barrierefreiheit · Designphilosophie · Nutzersegmente und Aufgabenflüsse · Responsive und Robustheit. Jedes Review arbeitete lesend gegen den laufenden Prototyp und gegen die CD-Quelle, nicht gegen Screenshots.

Belegstufen in diesem Dokument:

| Stufe | Bedeutung |
|---|---|
| **[V]** | in diesem Review selbst nachgeprüft (Code gelesen oder im Browser gemessen) |
| **[C]** | vom Fachreview belegt, mit Quellenangabe auf beiden Seiten |
| **[O]** | fachliche Einschätzung, nicht messbar |

Barrierefreiheit und Responsive wurden live instrumentiert (Headless Edge über CDP: Tab-Reihenfolgen, `activeElement`, berechnete Stile, Kontrastwerte, `scrollWidth` je Breakpoint bei 320/375/768/1024/1280/1544/1920 px).

---

## Gesamturteil

Die **Bausubstanz ist gut**: CD-Anatomie ist grösstenteils wörtlich übernommen statt nachempfunden, Tokens stimmen bis auf eine systematische Abweichung, Kontraste sind durchgehend AA-konform, Fokusführung und Dispatch-Sicherung im Router sind besser als in den meisten produktiven Bundesauftritten.

Die **Schwächen liegen eine Ebene höher**: Das Portal sieht aus wie ein Portal, arbeitet aber noch wie ein Linkverzeichnis. Vier der sechs Nutzersegmente haben keinen Einstiegspunkt, die Startseite beantwortet keine Aufgabe, und die Suche findet nur 14 Dienstleistungen. Dazu kommen drei handfeste Defekte, die im Alltag sofort auffallen würden.

Reihenfolge der Empfehlung: **erst P0 (Defekte und Sperren), dann P1 (der Portalcharakter), dann P2/P3.**

---

## P0 — Sperren und Defekte

### P0-1 · `href="#"` wirft Nutzende wortlos auf die Startseite **[V]**

4 von 14 Dienstleistungen haben `target.href = "#"` (E-Shop, BANF, Publikationen, Leistungsverrechnung); `services.js:174` rendert den Wert ungeprüft in den Haupt-CTA. Ein Klick setzt `location.hash = ''`. Der Router-Guard prüft `if (location.hash && !location.hash.startsWith('#/')) return;` — der **leere** Hash ist falsy, fällt durch und dispatcht `PAGES['']`, also die Startseite.

Ergebnis: Klick auf «Zum externen System» → kommentarlos zurück auf die Startseite. Dieselbe Ursache trifft 9 gerenderte Links auf `#/knowledge?tab=prozesse` (2 Stellen in `knowledge.js`, in Schleifen).

**Fix:** Router-Guard auf leeren Hash erweitern **und** das Muster aus `application.js:36` (`href !== '#'`) auf Dienstleistungs-CTA und Wissens-Listen anwenden — `C.downloadLink()` rendert dafür bereits einen nicht fokussierbaren Ersatz.

### P0-2 · Jede Filteränderung wirft den Fokus auf die H1 **[V]** · WCAG 3.2.2 (A)

Zwei bewusst gebaute Eigenschaften kollidieren: Filterzustand steht im Hash (verlinkbar) und Routenwechsel setzt den Fokus auf die H1 (`router.js` `focusHeading`). Damit ist **jede** Dropdown-Änderung ein Kontextwechsel: Fokus springt an den Seitenanfang, die Trefferzahl ändert sich still von «14 von 14» auf «3 von 14», und Tastaturnutzende müssen ~10 Bedienelemente erneut durchlaufen, um zum nächsten Filter zu kommen. Betroffen: alle Filter, beide Ansichtsschalter und die Pagination in `services.js`, `katalog.js`, `applications.js`.

**Fix:** Der Router muss Zustandsänderung von Navigation unterscheiden. Nach dem Rendern den auslösenden Bedienpfad wiederherstellen (über `id`), `focusHeading()` nur bei echtem Seitenwechsel.

### P0-3 · Keine einzige Live-Region **[V]** · WCAG 4.1.3 (AA)

`aria-live` / `role="status"` / `role="log"`: **null Treffer** in `js/` und `index.html`. Nur vier `role="alert"`-Badges an Formularfeldern. Trefferzahlen, Ansichtswechsel, Seitenwechsel und Wizard-Schritte werden nie angesagt.

**Fix:** Eine persistente `<div role="status" aria-live="polite" class="sr-only">` in `index.html`, beschrieben von Router und Katalogseiten (Anzahl · Ansicht · Seite).

### P0-4 · Datenausfall rendert als plausible Null **[C]**

`core.js:31-34` verschluckt jeden Fetch-Fehler und setzt `[]`/`{}`. Mit entferntem `data/`-Verzeichnis: **keine Konsolenfehler, keine sichtbare Warnung** — stattdessen «0 Vorgänge total», «0 Liegenschaften, 0 m² GF», «Dienstleistung nicht gefunden». Für ein Arbeitswerkzeug ist eine selbstbewusst gerenderte Null schlimmer als ein Absturz.

**Fix:** `load()` merkt sich fehlgeschlagene Schlüssel; die Shell zeigt ein `notification--error`-Band. `C.empty()` muss «leer» von «nicht verfügbar» unterscheiden.

### P0-5 · Burger-Menü ist 20 px hoch **[V]** · WCAG 2.5.5

`.burger` (`app.css:349`) setzt `height:100%` in einem `align-items:center`-Flexelternteil — das kollabiert auf die Icon-Höhe von 1.25 rem. Gemessen **60 × 20 px**. Das ist der einzige Zugang zum Menü unter 1024 px. Ebenfalls unter 44 px: eGate-Link (8 × 44), `.top-bar__btn` (16 × 44), `.view-switch__btn` (36 × 36 bei allen Breiten).

**Fix:** `min-height:2.75rem; min-width:2.75rem` auf Burger, Ansichtsschalter und die Icon-Links der Topbar.

### P0-6 · Überlaufende Tabs sind unsichtbar **[V]**

Das CD legt die Scroll-Andeutung auf `.tab__controls-container::after` (Verlauf am rechten Rand). Die CSS dafür ist in `app.css:897-901` vorhanden — **kein Modul gibt den Wrapper je aus**. Alle vier Tab-Leisten (`portfolio.js:315`, `projects.js:77`, `workspace.js:210`, `knowledge.js:26`) rendern `.tab__controls` blank, und `.tab__controls` setzt zusätzlich `scrollbar-width:none`. Auf schmalen Fenstern gibt es damit weder Scrollbalken noch Verlauf: Tabs jenseits der Kante existieren für Nutzende schlicht nicht.

**Fix:** `<div class="tab__controls-container">` um jede Leiste.

### P0-7 · Deaktivierte Bedienelemente sehen aktiv aus **[V]**

`app.css:621` stylt genau einen Selektor: `.btn--icon-only[aria-disabled="true"]`. `components.js` rendert nicht verfügbare Downloads aber als `<span class="btn btn--link" aria-disabled="true">` und `<span class="download-item" aria-disabled="true">` — beide greifen nicht. Jeder «im Prototyp nicht verfügbare» Download sieht aus wie ein normaler blauer Link, inklusive Zeigerhand und Hover-Unterstreichung.

**Fix:** Selektoren erweitern (`.btn[aria-disabled="true"]`, `.download-item[aria-disabled="true"]`) und den Hinweis sichtbar machen, nicht nur `sr-only` und `title`.

---

## P1 — Portalcharakter

### P1-1 · Die Startseite ist eine Nachrichtenwand **[V]** — von drei Reviews unabhängig als Top-Befund genannt

`home.js` sind 40 Zeilen: Kopf plus drei News-Karten. Keine Suche, keine offenen Vorgänge, keine häufigen Dienstleistungen, kein Anwendungsstarter, keine Notfallnummern. `docs/sitemap.md:165-172` spezifiziert sieben Blöcke; `requirements.md` FR-HOME-02/03/04/05 sind sämtlich offen. Für ein Werkzeug, das täglich zehnmal geöffnet wird, beantwortet die meistbesuchte Route keine einzige Frage.

Wichtig: Das Muster öffentlicher Auftritte (Leitbild, Themen, Medienmitteilungen) ist hier **nicht** zu kopieren — öffentliche Seiten dienen der Erstorientierung, ein Intranet der wiederholten Aufgabenerledigung.

**Fix:** (a) grosses Suchfeld, (b) «Meine offenen Vorgänge» aus `engine.instances()`, (c) 6–8 häufige Dienstleistungen, (d) Schlüsselanwendungen, (e) Aktuelles zuletzt und flach.

### P1-2 · «Meine Vorgänge» ist eine Belegablage, kein Fallsystem **[C]**

`my-cases.js` zeigt eine 5-spaltige Tabelle mit 6 Zeilen: kein Filter, keine Sortierung, keine Frist, keine Zuständigkeit, keine Anhänge, keine Rückfrage. Alles ist als «von Ihnen ausgelöste Anfragen» gerahmt — es gibt **keinen Eingang für die Bearbeitenden**, obwohl `process-definitions.json` Objektbetrieb, PFM, ISBO, Logistik und Informatik BBL als Schrittverantwortliche benennt und `reference-data.json` die Status `rueckfrage` und `abgelehnt` definiert, die kein Bildschirm je erzeugen kann.

Das ist der grösste Abstand zwischen «Portal» und «Linkliste».

**Fix im gesetzten Rahmen (ohne Rollen, siehe P1-3):** die Bearbeitungsseite als **beispielhaften Prozessschritt** zeigen — Vorgang mit Verlauf, Rückfrage, Anhang und Statuswechsel, damit der Ablauf und die Navigation sichtbar werden. Keine Berechtigungslogik, kein Rollenwechsel, keine Zuweisung an Personen. Ziel ist, dass man den Weg eines Vorgangs durchklicken kann, nicht dass Zugriffsrechte modelliert sind.

### P1-3 · ~~Rollen und Personenwechsler~~ — **verworfen, nicht umsetzen**

Das Fachreview empfiehlt einen Personenwechsler (Kunde VE · Objektbetrieb · PFM · Projektleitung · Beschaffung), der Startseite, Eingang und Katalogvoreinstellungen steuert.

**Entscheid: wird nicht umgesetzt.** Eine Rollen- und Berechtigungsvorschau gab es in einer früheren Fassung und war nicht hilfreich. Der Prototyp soll **User-Flow und Navigation** zeigen, nicht Berechtigungslogik.

Damit entfällt auch die Begründung «vier Segmente haben keinen Einstieg» als Argument für Rollen — die Segmentanalyse bleibt als Verständnis der Zielgruppen gültig, führt aber zu **beispielhaften Dienstleistungen und Prozessen** statt zu einem Rollenmodell.

### P1-4 · Die Suche findet nur 14 Dienstleistungen **[V]**

`shell.js` schickt jede Anfrage auf `#/services?q=`, und `services.js` durchsucht nur Titel/Kurztext/Beschreibung von `services.json`. Gemessen: `Heizung` → **0**, `Plan` → **0**, `Mietvertrag` → **0** Treffer. Das Leitszenario («die Heizung ist defekt») scheitert, sofern jemand nicht das Wort «Störung» kennt. Der Hinweis «Auch in: 3 Anwendung(en)» verlinkt zudem auf den **ungefilterten** Katalog und wirft die Anfrage weg.

**Fix:** kurzfristig `q=` in die «Auch in»-Links durchreichen und Synonyme hinterlegen (Heizung→Störung, Plan→Bauwerksdokumentation). Mittelfristig eine `#/search`-Seite mit Reitern je Inhaltsart — das CD liefert das Muster in `searchResults.vue`.

### P1-5 · Die Weisungen-Sammlung ist verwaist **[C]**

`weisungen.json` enthält 12 strukturierte Weisungen mit Code, Verbindlichkeit, Status, Nachfolger und Bezug zu Dienstleistungen — plus eine gute Detailansicht. Die Browse-Seite `#/knowledge?tab=grundlagen` rendert aber ein **fest verdrahtetes Akkordeon** (`grundlagen.js:9-80`) mit anderen Dokumenten, von denen keines auf eine `directiveId` verweist. «Welche Weisung gilt für Desk-Sharing?» führt über fünf Klicks zu «im Prototyp nicht verfügbar»; der richtige Datensatz ist nur über eine Dienstleistungs-Seitenspalte erreichbar.

**Fix:** Grundlagen-Tab aus `weisungen.json` rendern, mit Filter (Thema, Erlassgeber, Typ, Status) und Volltextsuche.

### P1-6 · Detailseiten in `#/knowledge` haben keine eigene Identität **[V]**

Für jeden Tab und jedes Detail setzt `knowledge.js:20` den Titel auf «News und Wissen» und rendert dieselbe H1; die eigentliche Überschrift ist ein `h2` (Zeilen 137, 192), das `focusHeading()` nie erreicht. Eine einzelne Weisung — das rechtlich folgenreichste Dokument im Produkt — teilt Titel, H1 und Brotkrume mit der Abschnittsübersicht, obwohl sie per URL zitiert und geteilt wird.

**Fix:** bei aufgelöstem `?id=` `setTitle(titel)`, Überschrift zu `h1` hochziehen, Brotkrume ergänzen.

### P1-7 · Drei unvereinbare Katalog-Idiome **[C]**

Idiom A (`services`, `applications`, `katalog`): Suchleiste, zwei Selects, Ergebniskopf, Icon-Ansichtsschalter, Pagination. Idiom B (`portfolio`, `mediathek`): Chip-Reihen, handgebauter Umschalter, keine Trefferzahl, keine Pagination. Idiom C (`document-archive`): vier blanke Selects, nichts weiter. `projects.js` erfindet ein viertes (Filled/Outline-Buttonpaar als Umschalter). Wer das Filtern bei den Dienstleistungen gelernt hat, lernt es in der Bauwerksdokumentation neu.

**Fix:** Idiom A als `C.catalogue({search, filters, view, page})` herausziehen und in allen sechs verwenden. `tag-item`-Chips nur für Facetten mit ≤5 Werten (die 26 Kantons-Chips im Portfolio sind ein Select).

### P1-8 · Zwei verwaiste Ziele, ein unvollständiger «vollständiger» Katalog **[V]**

`#/app/transaction` hat **null** eingehende Links — nur per URL erreichbar, setzt aber eine Brotkrume, die «Anwendungen» behauptet. `dataportal` und `transaction` fehlen beide in `applications.json` (20 Einträge), obwohl `#/applications` auf der Übersicht als «der vollständige Anwendungskatalog» beworben wird. Das Datenportal habe ich in dieser Sitzung ins Menü aufgenommen, aber nicht in den Katalog.

**Fix:** beide in `applications.json` aufnehmen — oder die Transaktions-Route entfernen.

---

## P2 — CD-Treue und Konsistenz

### P2-1 · Statische CD-Schriftgrössen auf die responsive Rampe abgebildet **[C]**

Das CD unterscheidet `text--sm` (responsive Rampe) von `text-sm` (fix 0.875 rem). Chrome-Elemente nutzen die **feste** Variante: Topbar, Top-Header, Brotkrume, `menu__item--small`, `accordion__title`. Die App speist alle mit der Rampe (`app.css:258, 295, 502, 452, 871`). Zwischen 1280–1543 px rendert jedes davon eine Stufe zu gross, ab 1920 px zwei. Bei 1440 px unsichtbar — deshalb ist es allen Screenshots dieser Sitzung entgangen.

**Fix:** auf die unveränderlichen `--fs-*`-Stufen umstellen, mit dem jeweils richtigen einzelnen Sprung (2xl bzw. 3xl).

### P2-2 · Gefüllte Buttons als Betonung statt als Formularabschluss **[V]**

`Btn.mdx:29` ist eindeutig: `btn--filled` «for buttons used in a form», `btn--outline` sonst. 13 Vorkommen, davon 5 ehrliche Submits. Der Rest ist Lärm: vier «Suchen»-Buttons auf Filterleisten (das CD nutzt dort einen **blanken Icon-Button**), «Nächster Schritt (Demo)» in `my-cases`, und in `projects.js` kodiert Filled einen Umschaltzustand — das tut das CD nie.

### P2-3 · Akkordeon-Anatomie weicht ab **[C]**

CD: `<ul class="accordion"><li class="accordion__item">`, Chevron als `.accordion__arrow`, Panel als `.accordion__drawer > .accordion__content.vertical-spacing`. App: `div`/`div`, generisches Icon, kein `__drawer`, dazu ein erfundenes `.accordion__meta`. Folge: für assistive Technik ist das Akkordeon keine Liste, und `accordion__content` verliert seinen Abstandsrhythmus.

### P2-4 · Erfundene Klassen in CD-Notation **[C]**

Ohne Gegenstück im CD, aber mit `__`/`--`-Schreibweise: `.search__form`, `.search__submit`, `.mobile-menu__drawer`, `.card__title--sm`, `.accordion__meta`, `.pagination-wrap` sowie die Kurzformen `.grid--2/3/4/auto` (CD: `.grid--responsive-cols-N`, in der App bereits als Alias vorhanden). Das führt Mitlesende in die Irre — genau der Grund, aus dem `.hero__tags` bereits entfernt wurde. **Fix:** auf ein eigenes Präfix umbenennen (`.pf-…`). `.pagination__input/__text/_items` sind echt und bleiben.

### P2-5 · Kaputte ARIA-Tabs **[C]** · WCAG 4.1.2 (A)

`knowledge.js`: `role="tablist"` mit `role="tab"` auf `<a>`, ohne `aria-controls`, Panels ohne `role="tabpanel"`, keine Pfeiltasten. `workspace.js`: `role="tabpanel"` ohne `id`/`aria-labelledby`. `projects.js`: Phasen**filter** als `role="tab"` ohne Panels. `portfolio.js:315-340` macht es richtig — von dort kopieren oder die Tab-Rollen ganz weglassen, wo es Links bzw. Filter sind.

### P2-6 · Weitere Werteabweichungen **[C]**

`.menu__item__icon` ohne Grösse (CD 1.5/1.75 rem — die Menüpfeile fallen auf 1 rem zurück) · `.btn__icon` fix 1.15 rem statt `1.4em` (skaliert nicht mit `btn--lg`) · `.card__description` erzwingt `--text-sm`, das CD erbt `text--base` · `.step__indicator-step--confirmed` nutzt `--color-success-text` (#065f46) statt CD-Grün (#10b981) · `card--universal` wird für bildlose Karten verwendet, ist im CD aber die Karte mit *eingepasstem* Bild.

### P2-7 · Wizard-Schrittanzeige ohne aktuellen Schritt **[C]** · WCAG 1.3.1 / 1.4.3

Alle drei Schritte rendern in `#9ca3af` auf Weiss = **2.54:1**. Die CSS-Haken `--active`/`--confirmed` und `li[aria-current="step"]` existieren, werden aber nie ausgegeben (`space-request.js:31-32`, `transaction.js:47-49` setzen `done`/`active` auf das `<li>`). `aria-current` ist auf allen Schritten `null`, der aktuelle Schritt ist optisch nicht unterscheidbar.

### P2-8 · Fokus-Suchfeld kapert den Fokus **[C]** · WCAG 3.2.1 (A)

`shell.js` öffnet die Suche bei `focusin` und setzt nach 60 ms den Fokus ins Eingabefeld, während der auslösende Button `visibility:hidden` wird. Fokussieren allein verschiebt also den Fokus und lässt ein Element verschwinden. **Fix:** nur auf `click`/`keydown` öffnen.

### P2-9 · Mobiles Menü lässt die verdeckte Seite fokussierbar **[C]**

Bei offener Schublade bleiben 48 fokussierbare Elemente erreichbar, darunter der gesamte verdeckte Inhalt. Escape und Fokusrückgabe sind korrekt — es fehlt nur `inert` auf `#main-content`/`#main-footer`.

### P2-10 · Ansichtszustand nur über Farbe **[C]** · WCAG 1.4.1

`.view-switch__btn`: inaktiv `#234dc2`, aktiv `#1f2937` — **2.04:1** zwischen den Zuständen, kein Rahmen, kein Hintergrund, keine Gewichtsänderung. `aria-pressed` ist korrekt, sehende Nutzende haben nichts.

---

## P3 — Feinschliff

- **Terminologie** [V]: «Service» 57 zu «Dienstleistung» 40. Navigation, Titel und Brotkrume sagen Dienstleistung, im Inneren steht «Service suchen», «Keine Services gefunden», Badge «Service». Das Badge-Paar **Service / Information** ist zudem ein Scheingegensatz — beides sind Dienstleistungen. Vorschlag: «Vorgang starten» / «Information». («Anwendung» ist mit 63:0 gegen «Applikation» sauber.)
- **Leere Zustände** [C]: `C.empty()` ist ein grauer Satz. Das CD-Muster nennt die Anfrage in einer `h2`, gibt vier Suchtipps und schliesst mit einem Kontakt-Hinweis.
- **Ladezustand** [C]: `<p class="muted">Lädt…</p>` ohne `role="status"`; die Shell rendert zudem erst nach 15 JSON-Dateien (132 KB) — auf langsamem VPN bleibt die Seite weiss.
- **Kein `share-bar`, kein Druckeinstieg, kaum «Stand»** [C]: Das CD verlangt den Druck-Button in der `.share-bar` nach der Brotkrume; die App hat null Vorkommen. «Letzte Änderung» erscheint einmal, «Stand:» einmal. Die Weisung-Detailseite hat weder Stand noch Ansprechstelle.
- **Druck verliert den Inhalt** [V]: `[hidden]{display:none!important}` (`app.css:30`) schlägt den Druckblock. Beim Drucken von `#/data/katalog/<id>` fehlen damit **alle** Bereitstellungsformen, Formate, Lizenzen und Bezugs-URLs — also genau das Datenblatt.
- **320-px-Überlauf** [C]: `#/app/document-archive` +43 px, `#/data/katalog/1` +31 px, jeweils durch unbrechbare Komposita. `h1` hat kein `overflow-wrap`; bei `.hero__title` reduziert `break-word` den min-content-Beitrag nicht — dort braucht es `anywhere`.
- **Tabellen** [C]: `thead th { white-space:nowrap }` ist eine App-Zutat, nicht CD. Bauwerksdokumentation braucht 1167 px und scrollt damit bis 1280 px einschliesslich. Vier Routen sind reine Tabellen ohne Kartenalternative.
- **Schriften** [V]: 4 × ~570 KB unkomprimiertes TTF; auf der Startseite 1.14 MB = 74 % des Seitengewichts. WOFF2 spart rund 85 %.
- **Unsplash-Bilder** [C]: 3 Anfragen an `images.unsplash.com` auf der Startseite — im Bundesnetz blockiert. Der Fallback greift, die Startseite hat dann aber gar keine Bilder.
- **Badge-Inflation** [O]: bis zu 27 farbige Pillen in einer 3×3-Galerie. Vorschlag: eine Auszeichnung je Karte — die, welche die Entscheidung ändert.
- **Galerie als harte Voreinstellung** [O]: für ein Expertenwerkzeug ist die Liste die bessere Voreinstellung; `table--compact` existiert und wird genau einmal verwendet (in `charts.js`).
- **Thema-Dropdown ohne `selected`** [C]: über die Menü-Themen ankommen zeigt «Alle Themen», während Pille und Trefferzahl etwas anderes sagen. `katalog.js` macht es richtig.
- **Domäne H** [V]: «Personal & Arbeiten beim BBL» hat null Dienstleistungen, erscheint aber im Thema-Filter — das Menü blendet sie korrekt aus. Menü und Filter widersprechen sich.
- **`#/my-cases/<unbekannt>`** [C]: ohne `h1` und ohne `setTitle` — als einzige Nicht-gefunden-Route.
- **Kleinigkeiten** [C]: `<strong>3</strong>von 14` ohne Leerzeichen (Screenreader liest «3von 14») · `aria-label` auf rollenlosen `div`s wird verworfen · redundantes `alt` in verlinkten Bildkarten · `.badge--sm` mit fixem 10 px · Chart-Tooltips ohne Escape.

---

## Entschieden — nicht erneut aufmachen

- **`.lead` ohne `max-width`** — ein Review empfiehlt `65ch`. Das widerspricht der ausdrücklichen Vorgabe «class='lead' doesn't need a max width, can be full width». `.page-intro` behält seine `70ch`.
- **Bauwerksdokumentation und Mediathek nicht im Dropdown** — bewusst entfernt, sie stehen im Anwendungskatalog und auf der Übersicht.
- **Zurück-Button nur oben** — das CD wiederholt ihn am Seitenende; hier bewusst einmalig.
- **Kein «Verwandte Anwendungen»** auf der Anwendungs-Detailseite — bewusst entfernt.
- **`.container.section` mit asymmetrischem Innenabstand** (oben 3/3.5/5 rem, unten 3.5/5/8 rem) — bewusst nach CD-Hero-Werten, dokumentiert in `app.css`.
- **Keine Rollen-, Personen- oder Berechtigungsvorschau** (siehe P1-3). In einer früheren Fassung vorhanden, nicht hilfreich. Der Prototyp zeigt User-Flow und Navigation; Prozesse und Dienstleistungen werden beispielhaft durchgespielt, nicht rechtebasiert gesteuert.

---

## Stärken — nicht wegoptimieren

- **CD-Anatomie kopiert statt nachempfunden**: Zurück-Button, Pagination mit editierbarem Seitenfeld, Select mit Chevron und vollständiger ARIA-Verdrahtung, `card__image` als `padding-bottom`-Verhältnis, DCAT-Detail mit einem Akkordeon je Bereitstellungsform.
- **Tokens stimmen**: alle Farbrampen, Radien, Schatten, Button-Mindesthöhen, Container-Stufen, Breakpoints inklusive 2xl = 1544 px.
- **Kontrast durchgehend AA**, in beiden Skins gemessen: Fliesstext 14.68:1, gedämpft 7.56:1, alle Badge- und Notification-Paare 6.16–13.34:1, Fokusring ≥3:1 auf Weiss und auf Navy.
- **Kein horizontaler Scroll bei 320/400/640 px**, Bildverhältnisse bleiben erhalten, `prefers-reduced-motion` und `forced-colors` sind behandelt.
- **Robuster Router**: Dispatch-Ticket gegen Wettläufe, Fokusführung bei Seitenwechsel, unbekannte Routen mit echter H1. 32 feindliche Routen (`page=abc`, `page=1e9`, XSS-Versuche in `q`/`tag`) → 0 Konsolenfehler, alles sauber escaped.
- **Keine Speicherlecks** über 30 Navigationen; Seiten-Listener hängen am Mount, nur die Shell bindet global und läuft einmal.
- **Aktive Filter als reine Links** — ohne JS, verlinkbar, einzeln entfernbar.
- **Ehrlichkeit als Gestaltungsprinzip**: «Platzhalterbild — Demo-Daten», deaktivierte Downloads mit Begründung, Prototyp-Chip. Nicht gegen eine glattere Demo eintauschen.
- **`grundlagen.js`** ist die beste Seite der App (KBOB-treu, mit Vorrangregel bei Widersprüchen) — als Vorlage für jede Dokumentliste nehmen.
- **Klares Deutsch** dort, wo es zählt: «Was möchten Sie tun?», «Das brauchen Sie». Kein Amtsdeutsch — Linie halten.

---

## Vorschlag zur Reihenfolge

| Schritt | Inhalt | Aufwand |
|---|---|---|
| **1** | P0-1, P0-5, P0-6, P0-7 — vier lokale Defekte, je wenige Zeilen | klein |
| **2** | P0-2 und P0-3 — Router trennt Zustand von Navigation, eine Live-Region | mittel |
| **3** | P0-4 — Ladefehler sichtbar machen | klein |
| **4** | P1-1 — Startseite als Arbeitsfläche | mittel |
| **5** | P1-2 — Vorgangsverlauf beispielhaft durchklickbar (ohne Rollen, P1-3 verworfen) | mittel |
| **6** | P1-4/5/6/8 — Suche, Weisungen aus den Daten, Detail-Identität, Katalog-Lücken | mittel |
| **7** | P2 gesammelt — CD-Treue in einem Durchgang | mittel |
| **8** | P3 nach Bedarf | klein |

Schritte 1–3 heben die Barrierefreiheit auf ein prüffähiges Niveau. Schritte 4–5 entscheiden, ob das Produkt ein Portal oder ein Linkverzeichnis ist.
