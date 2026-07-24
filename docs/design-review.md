# Design- und UX-Review — BBL Kundenportal

**Stand:** 24. Juli 2026 · **Gegenstand:** Prototyp (laufender Stand)
**Referenzen:** CD Bund (`designsystem/`, v1.0.5) · bbl.admin.ch · kbob.admin.ch · WCAG 2.1 AA / P028 / eCH-0059

Dieses Dokument fasst **alle** Befunde aus vier Review-Runden in einem statusgeführten Katalog zusammen. Die Befunde sind nach Themen gegliedert; die Spalte **Prio** (Hoch · Mittel · Niedrig) gewichtet nach Wirkung, die Spalte **Status** zeigt auf einen Blick, was erledigt, offen oder verworfen ist. Die ursprünglichen Kürzel (P0–P3) bleiben zur Nachverfolgung erhalten.

## Legende (Status)

| Status | Bedeutung |
|---|---|
| **Erledigt** | implementiert und (meist headless) verifiziert |
| **Teilweise** | Kern erledigt, Rest offen (siehe Notiz) |
| **Offen** | noch nicht angegangen |
| **Geplant** | bewusst für die nächste (technische / Modularitäts-) Runde eingeplant |
| **Verworfen** | bewusst nicht umsetzen |

**Methode:** vier bis sechs Fachagenten je Runde, lesend gegen den laufenden Prototyp und die CD-Quelle; Barrierefreiheit und Responsive live instrumentiert (Headless Edge, `activeElement`/`scrollWidth`/berechnete Stile bei 320/375/768/1024/1280 px).

---

## A · Sperren & Defekte (P0)

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| P0-1 | `href="#"` warf Nutzende wortlos auf die Startseite (leerer Hash fällt durch den Router-Guard) | Hoch | Erledigt | Guard auf leeren Hash erweitert; CTA/Downloads via `href !== '#'` (nicht fokussierbarer Ersatz) |
| P0-2 | Jede Filteränderung wirft den Fokus auf die H1 (WCAG 3.2.2) | Hoch | Erledigt | Router trennt Zustandswechsel von Navigation; Fokus zurück auf den Bedienpfad per `id` — `router.js` |
| P0-3 | Keine Live-Region — Trefferzahl/Ansicht/Seite werden nie angesagt (WCAG 4.1.3) | Hoch | Erledigt | Persistente `role="status"` in `index.html` + `C.announce()`; Katalogseiten sagen an |
| P0-4 | Datenausfall rendert als plausible Null (kein Fehlerband) | Hoch | Offen | `load()` soll fehlgeschlagene Schlüssel merken; Shell zeigt `notification--error`; `C.empty()` «leer» ≠ «nicht verfügbar» |
| P0-5 | Burger-Menü 60×20 px; weitere Touch-Ziele < 44 px (WCAG 2.5.5) | Hoch | Erledigt | `min-height/min-width:2.75rem` auf Burger, Ansichtsschalter, Topbar-Icons, Mobil-Auth-Button, `.navy__back`, `.doc-open`, Share-bar |
| P0-6 | Überlaufende Tabs unsichtbar (Wrapper `.tab__controls-container` fehlte) | Hoch | Erledigt | Wrapper um alle vier Tab-Leisten inkl. Projekt-Detail |
| P0-7 | Deaktivierte Bedienelemente sehen aktiv aus | Mittel | Erledigt | Selektoren auf `.btn[aria-disabled]` / `.download-item[aria-disabled]` erweitert |

---

## B · Barrierefreiheit (WCAG 2.1 AA)

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| P2-5 | Kaputte ARIA-Tabs (knowledge/workspace/projects) | Hoch | Erledigt | knowledge = echte Seiten; projects-Detail + **workspace** voll verdrahtet (`id`/`aria-controls`/`aria-labelledby`, roving `tabindex`, Pfeil/Home/End) |
| P2-7 | Wizard-Schrittanzeige ohne erkennbaren aktuellen Schritt (2.54:1) | Hoch | Erledigt | `--active`/`--confirmed` + `aria-current="step"` gesetzt, `CheckmarkBold`-Icon, CD-Grün |
| P2-8 | Fokus-Suchfeld öffnet bei `focusin` (3.2.1) | Mittel | Erledigt | Nur noch `click`/`keydown` — `shell.js` |
| P2-9 | Mobiles Menü lässt verdeckte Seite fokussierbar (2.4.3) | Mittel | Erledigt | `inert` auf `#main-content`/`#main-footer` in `setMobileMenu` |
| P2-10 | Ansichtszustand nur über Farbe (1.4.1) | Mittel | Erledigt | Aktiver Schalter mit Hintergrund + Fokusring |
| — | Chart-Tooltip nicht mit Escape schliessbar (1.4.13) | Niedrig | Erledigt | Escape-Handler in `wireCharts` |
| — | Back-to-top verschiebt Tastaturfokus nicht an den Seitenkopf | Niedrig | Erledigt | `onclick` fokussiert `#main-header` |
| — | Drill-down: `aria-haspopup` falsch; Escape/Fokus/Ansage | Mittel | Erledigt | `aria-haspopup` entfernt; Escape geht eine Ebene zurück; Fokus/Ansage auf Zweigtitel |
| — | Englische Glossen ohne `lang="en"` (3.1.2); Akronyme ohne `<abbr>` | Niedrig | Geplant | «Digital by Design», «Once-Only», «Common Data Environment» … in `<span lang="en">`; `<abbr>` bei Erstnennung |
| — | Kleinigkeiten: «3von 14» ohne Leerzeichen, `aria-label` auf rollenlosen `div`s, redundantes `alt`, `#/my-cases/<unbekannt>` ohne `h1` | Niedrig | Offen | Sammelkorrektur |

> **Kontrast durchgehend AA** (in beiden Skins gemessen); Heading-Hierarchie sauber; Lesebreite begrenzt (`.page-intro` 70ch, Info-Seiten 60rem). Als geprüft-in-Ordnung bestätigt.

---

## C · CD-Komponententreue & Tokens (P2)

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| P2-1 | Statische Chrome-Typografie auf der responsiven Rampe | Mittel | Erledigt | `.top-bar/.top-header/.breadcrumb/.menu__item--small/.accordion__title` → feste `--fs-*` |
| P2-2 | Gefüllte Buttons als Betonung statt Formularabschluss | Mittel | Teilweise | space-request-Navlink, my-cases, Portfolio-«Suchen» → outline/bare korrigiert · **offen:** `projects.js` Filled-als-Umschalter → `C.viewSwitch()` |
| P2-3 | Akkordeon-Anatomie `div`/`div` statt `ul>li`, ohne `__drawer`/`__arrow` | Mittel | Geplant | Trigger ist bereits `h3>button`; volle Anatomie über neuen `C.accordion()` |
| P2-4 | Erfundene CD-Notationsklassen | Niedrig | Geplant | `.search__form/__submit`, `.mobile-menu__drawer`, `.accordion__meta`, `.pagination-wrap`, `.card__title--sm` → `pf-`-Präfix (`.grid--N` sind bereits Aliase) |
| P2-6 | Werteabweichungen (Menu-Icon, `.btn__icon`, `.card__description`, Step-Grün, `card--universal`) | Mittel | Erledigt | alle behoben |
| — | `↵` (`ArrowAngleBottomLeft`) auf internen Menü-Blattzeilen | Mittel | Erledigt | entfernt — CD dekoriert interne Blattlinks nicht |
| — | Hardcodierte Werte statt Tokens | Niedrig | Teilweise | Doc-Viewer-Hex → `--color-secondary-800/900`, `.dash-hero__value` → `--fs-6xl/7xl`, Mediathek-`card__title` → `.card__title--sm` · **offen:** `rgba(0,0,0,.45)`-Scrim in `mediathek.js`, `charts.js`-INK-Konstanten |
| — | `.badge--sm` 10 px | Niedrig | Erledigt | **Fehlbefund korrigiert** — entspricht exakt CD `badge.postcss:79` |
| — | `.navy--drill` ist Eigenimplementierung statt CD-Navy-Slider | Niedrig | Verworfen | Bewusst — konzeptuell treu, wegen No-Build vertretbar |

---

## D · Mobile & Responsive

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| P3 | 320-px-Überlauf: `h1`/`.hero__title` (unbrechbare Komposita) | Hoch | Erledigt | `overflow-wrap:anywhere` |
| — | 320-px-Überlauf: FAQ-Akkordeon (`prozesse`), 336→305 px | Hoch | Erledigt | `overflow-wrap:anywhere` auf `.accordion__title`/`__button > span`, `flex:none` Chevron |
| — | Drill-down mobil: Zweigtitel auf Ebene 1 verborgen | Hoch | Erledigt | Selektor auf `[data-pane="0"] .navy__title` eingegrenzt |
| P3 | Tabellen brauchen bis 1167 px, keine Kartenalternative | Mittel | Teilweise | Scroll im `.table-wrapper` bestätigt sauber; Pagination ergänzt (Dokumentenarchiv) · **offen:** Kartenalternative unter ~1024 px |
| — | Nav-Drill-down, View-Switch, Share-bar, Back-to-top, Grid-Filter | Niedrig | Erledigt | Agent-gemessen sauber bei 320–1024 px (Touch-Ziele 44 px, kein Seitenüberlauf) |
| — | Ankernav-Inhaltsverzeichnis steht auf dem Handy erst nach allen Abschnitten | Niedrig | Offen | **Produktentscheid**: oben erreichbarer Anker-Picker wäre CD-typischer |

---

## E · Detailseiten, Bilder & Konsistenz

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| P1-6 | Wissen-Detailseiten ohne eigene Identität (Titel/H1/Brotkrume) | Hoch | Erledigt | eigene `setTitle`/`h1`/Brotkrume je `?id=` |
| P3 | Kein `share-bar`/Druckeinstieg (CD nach der Brotkrume) | Mittel | Teilweise | `C.shareBar()` (nur Icons, CD-treu) auf Ankernav-, Dienstleistungs-, Datensatz-, SUPERB-/BIM-Detailseiten · **offen:** Weisung, Anwendung, Medien via `C.detailHead()` |
| — | Detailseiten ohne Bild, wo eines passt | Mittel | Teilweise | Dienstleistungs-Detail (`hero--main-image`, Symbolbild je Thema), SUPERB, BIM erledigt · **offen:** Weisung, Datensatz, Medien |
| — | Karten flach (fehlende Schatten-Variante) | Mittel | Erledigt | News-Liste, Mediathek-Kacheln + Lightbox → `card--default` (CD `shadow-lg`) |
| — | Uneinheitliches Detailseiten-Skelett (H1-Varianten, Aside-Namen) | Mittel | Geplant | `C.detailHead()`/`C.detailSection()`: back-link · share-bar · Hero+Bild · Aside (Kontakt · Eckdaten · Verwandte Inhalte) vereinheitlichen |

---

## F · Modularität & Wiederverwendung

| Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|
| Icon-Kachel 3× kopiert (Daten/Wissen/Digitalisierung) | Mittel | Erledigt | `C.domainTile()` — behebt zugleich `card--universal`-Fehlnutzung |
| Aktive-Filter-Pillen 3× kopiert | Niedrig | Erledigt | `C.activeFilters({ filters, resetHref })` — services/applications/katalog umgestellt |
| «Nicht gefunden»-Block 7× kopiert | Niedrig | Erledigt | `C.notFound({ backHref, backLabel, title, body })` — 7 Detailrouten umgestellt |
| Zwei verschiedene Chevron-Glyphen bei Selects | Mittel | Erledigt | die 3 Katalog-Selects über `C.select()` (Inline-SVG); alle Selects nutzen nun denselben CD-Chevron |
| Inline-`.select`-Blöcke weiter dedupen | Niedrig | Teilweise | Katalogseiten via `C.select()`; **offen:** document-archive/mediathek/workspace/fault-report/space-request (bereits korrekter SVG-Chevron, reine Dedup) |
| Katalog-Idiom 3× (services/applications/katalog) — P1-7 | Mittel | Geplant | `C.catalogue({ search, filters, view, page })` |
| Akkordeon-Scaffold 2× | Mittel | Geplant | `C.accordion(items)` (zusammen mit P2-3) |

---

## G · Portalcharakter & Informationsarchitektur (P1)

| # | Befund | Prio | Status | Umsetzung / Referenz |
|---|---|---|---|---|
| P1-1 | Startseite war eine Nachrichtenwand | Hoch | Erledigt | Startseite als Arbeitsfläche (Suche, offene Vorgänge, häufige Dienstleistungen, Bereiche, Aktuelles) |
| P1-4 | Suche fand nur Dienstleistungen | Hoch | Erledigt | `#/search`-Seite mit Synonymen und Inhaltsart-Gruppen |
| P1-2 | «Meine Vorgänge» ist Belegablage, kein Fallsystem | Mittel | Teilweise | Demo-«Nächster Schritt» + Statuswechsel vorhanden · **offen:** beispielhafter Vorgangsverlauf (Rückfrage/Anhang) — **ohne Rollen** |
| P1-5 | Weisungen-Sammlung teilverwaist | Mittel | Teilweise | Grundlagen als saubere Ankernav-Seite; Weisung-Detail via `?id` · **offen:** filterbarer Weisungs-Browse aus `weisungen.json` |
| P1-8 | Verwaiste Ziele / unvollständiger Katalog | Niedrig | Teilweise | Katalog stark erweitert (u. a. 8 Logistik-Apps) · **prüfen:** `transaction`/`dataportal` im Katalog |
| P1-7 | Drei unvereinbare Katalog-Idiome | Mittel | Geplant | siehe **F** (`C.catalogue()`) |
| P1-3 | Rollen- / Personenwechsler | — | Verworfen | **Verworfen** — Prototyp zeigt User-Flow und Navigation, keine Berechtigungslogik |

---

## H · Feinschliff & Inhalt (P3)

| Befund | Prio | Status | Notiz |
|---|---|---|---|
| SUPERB-Text sachlich falsch («löst SAP ab») | Hoch | Erledigt | korrigiert: **Migration auf SAP S/4HANA** (web-belegt), an 3 Stellen |
| Terminologie «Service» vs. «Dienstleistung»; Badge-Paar Service/Information | Mittel | Offen | «Vorgang starten» / «Information» |
| Leere Zustände `C.empty()` sehr karg | Niedrig | Offen | CD-Muster: Anfrage in `h2` + Suchtipps + Kontakt |
| Ladezustand «Lädt…» ohne `role="status"`; 15 JSON vor erstem Render | Niedrig | Offen | (Live-Region existiert nun; Ladehinweis noch nicht angebunden) |
| Druck: `[hidden]{display:none!important}` schlägt Druckblock | Niedrig | Offen | Datensatzblatt fehlt beim Drucken |
| Schriften: 4× unkomprimiertes TTF (1.14 MB Startseite) | Niedrig | Offen | WOFF2 spart ~85 % |
| Unsplash im Bundesnetz blockiert | Niedrig | Teilweise | Fallback auf Farbfläche greift (bewusst akzeptiert) |
| Badge-Inflation (bis 27 Pillen/Galerie) | Niedrig | Offen | eine Auszeichnung je Karte |
| Galerie als harte Voreinstellung | Niedrig | Offen | für ein Expertenwerkzeug ggf. Liste als Default |
| Domäne H im Filter, nicht im Menü | Niedrig | Erledigt | Filter nutzt nun `d.thema` — Menü und Filter deckungsgleich |
| Back-to-top-Knopf fehlte (CD) | Mittel | Erledigt | CD `back-to-top-btn` ergänzt, dockt am Footer, kein Leerraum |

---

## I · Bewusst entschieden — nicht umsetzen

- **`.lead` ohne `max-width`** — ausdrückliche Vorgabe (voll­breit erlaubt). `.page-intro` behält `70ch`.
- **Rollen-/Personen-/Berechtigungsvorschau** (P1-3) — in früherer Fassung vorhanden, nicht hilfreich.
- **Zurück-Button nur oben** (CD wiederholt ihn am Seitenende) — bewusst einmalig.
- **Kein «Verwandte Anwendungen»** auf der Anwendungs-Detailseite — bewusst entfernt.
- **`.container.section` mit asymmetrischem Innenabstand** — bewusst nach CD-Hero-Werten.
- **Bauwerksdokumentation/Mediathek nicht im Dropdown** — stehen im Anwendungskatalog und auf der Übersicht.
- **`.navy--drill` als Display-Wechsel** statt CD-Navy-Slider — wegen No-Build vertretbar.

---

## J · Stärken — bewahren

- **CD-Anatomie kopiert statt nachempfunden**: Zurück-Button, Pagination mit editierbarem Seitenfeld, Select mit voller ARIA-Verdrahtung, `card__image` als `padding-bottom`-Verhältnis, DCAT-Detail mit Akkordeon je Bereitstellungsform.
- **Tokens stimmen**: Farbrampen, Radien, Schatten, Button-Mindesthöhen, Breakpoints (2xl = 1544 px).
- **Kontrast durchgehend AA** in beiden Skins; `prefers-reduced-motion` / `forced-colors` behandelt.
- **Robuster Router**: Dispatch-Ticket gegen Wettläufe, saubere Fokusführung, 32 feindliche Routen ohne Konsolenfehler, alles escaped.
- **Ehrlichkeit als Gestaltungsprinzip**: «Platzhalterbild — Demo», deaktivierte Downloads mit Begründung, Prototyp-Chip.
- **Klares Deutsch** dort, wo es zählt («Was möchten Sie tun?», «Das brauchen Sie»).

---

## Nächste Schritte (Vorschlag)

1. **Offene A11y/Defekte** (Offen): P0-4 (Ladefehler-Band), Sammelkorrektur Kleinigkeiten, `lang="en"`-Spans.
2. **Modularitäts-Runde** (Geplant, Kategorie F) — parallel zur technischen Code-Review: `C.detailHead`, `C.activeFilters`, `C.notFound`, `C.accordion`, `C.selectBox`-Routing, `C.catalogue`; danach die `pf-`-Umbenennung.
3. **Restliche Detailseiten-Bilder** (Weisung/Datensatz/Medien) über `C.detailHead`.
4. **P3-Feinschliff** nach Bedarf (Terminologie, leere Zustände, WOFF2, Druck).
