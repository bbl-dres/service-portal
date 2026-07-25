# BBL Kundenportal — Navigation & Routing

> **Status:** Living reference (the prototype as built) · **Updated:** 2026-07-25
> **Part of:** the [Unified Platform Vision](platform-vision.md).
> **Scope:** the portal's navigation (information architecture) **and** its URL/routing contract. Part 1 describes the prototype **as built**; the Appendix keeps the pre-build analysis that motivated the structure.
> A "sitemap" is only the page tree — this document also owns the routing rules, hence *Navigation & Routing*.

---

# Part 1 — Living reference (the prototype as built)

## 1. The one rule: path = place, query = state

> **The path names a _place_** — a navigable page/resource with its own breadcrumb and `h1`. **Query parameters carry only the _state_ within that one page.**

**Mnemonic:** if a parameter changes *which page you are on* (its own breadcrumb/`h1`, a distinct "place") → **path segment**. If it only changes *what is shown on the same page* → **query parameter**.

- **Path segments = places:** `#/<area>` · `#/<area>/<section>` · `#/<area>/<id>` · `#/<area>/<section>/<id>` · `#/app/<name>` · `#/app/<name>/<id>`. Detail ids are built with `encodeURIComponent` and read with `C.safeDecode`.
- **Query = page state:** `?q=` (search), filters (`?audience=` `?bereich=` `?topic=` `?thema=` `?klass=` `?tags=`, multi-value comma-joined), `?page=`, `?view=galerie|liste`, `?from=`/`?to=` (dashboards), and `?tab=` **only** for genuine in-page tabs of a single object.
- **`?tab=` is allowed** for facets of the *same* object: Vorgang detail (`daten`/`anhaenge`/`verlauf`), dashboard views (`ueberblick`/`karte`/…), project detail, building detail, workspace modes. **`?tab=` is forbidden** for switching between standalone content pages — those get path segments.

## 2. Navigation (as built) — annotated tree

Global chrome on every page: **Logo → Startseite · global search · meta-nav (Notfall & Vorfälle · Hilfe · Anmelden) · language switcher (DE; FR/IT/RM/EN disabled in the prototype) · top-bar (Alle Bundesbehörden · eGate) · Prototyp chip.** The header renders a CD Bund `navy` drawer per main-nav item (drill-down sub-branches); a persistent breadcrumb and a footer sit on every page.

```
Kundenportal — Startseite  #/           (reached via the logo)
│
├── Dienstleistungen  #/services
│     Service catalogue — search, filters (Zielgruppe, Thema), gallery/list, pagination.
│     Drawer: "Übersicht" + one row per Thema (sets the topic filter) + the five
│     intranet task areas as navy drill-down branches.
│     └── #/services/<serviceId>
│           Service detail: CTA "Vorgang starten" (login-gated for type=action) or a
│           link to an external system; requirements, contact, applicable Weisungen.
│           Starting one creates a Vorgang → Meine Vorgänge.
│
├── Daten und Digitalisierung  #/data
│     Topic hub. Drawer: Übersicht · Digitalisierung (drill-down) · Datenportal ·
│     Datenbezug und API Verzeichnis · Fachanwendungen Bauten / Logistik (filtered app catalogue).
│     ├── #/data/katalog  (+ /<id>)
│     │     Datenbezug und API Verzeichnis — DCAT-AP-CH dataset catalogue + dataset
│     │     detail (distributions, metadata).
│     ├── #/data/digitalisierung[/<sub>]
│     │     Strategie · Vision · Prinzipien (anchor-nav pages) · SUPERB · BIM/CDE.
│     ├── #/data/ikt-vorhaben
│     │     Running and planned IT initiatives.
│     └── Anwendungen — micro-apps, all under #/app/… (nav highlight stays "Daten"):
│           #/applications  (+ /<id>)   App catalogue + application detail
│           #/app/dataportal            Analytics dashboards (filter panel, tabs, MapLibre map)
│           #/app/portfolio             Liegenschaften Inventar (hero app)
│           #/app/projects              Bauprojekte / EPPM (hero app)
│           #/app/document-archive      Bauwerksdokumentation (document archive)
│           #/app/mediathek             Photos & videos of federal buildings
│           #/app/workspace             Furnishing, occupancy, room/resource booking
│           (service flows: #/app/space-request · #/app/fault-report · #/app/transaction)
│
├── News und Wissen  #/knowledge
│     Section overview (cards). Drawer: Übersicht + the four sections.
│     ├── #/knowledge/grundlagen  (+ /<directiveId>)
│     │     Gesetzliche Grundlagen & Vorgaben; Weisung detail (anchor-nav layout).
│     ├── #/knowledge/news  (+ /<id>)
│     │     Aktuelles; news-item detail.
│     ├── #/knowledge/prozesse
│     │     Prozessdokumentation (Archimap) + FAQ accordion.
│     └── #/knowledge/anleitungen
│           Guides & training material.
│
└── Meine Vorgänge  #/my-cases          (login-gated — logged out shows a login prompt)
      Personal cases: list (status, type) + KPIs.
      └── #/my-cases/<instanceId>
            Vorgang detail: status stepper + tabs (Daten · Anhänge · Verlauf).

Also: #/search (global search) · meta-nav "Notfall & Vorfälle" →
#/services/sicherheitsvorfall-melden · "Hilfe" → #/knowledge · footer (Impressum,
Rechtliches, Datenschutz, Barrierefreiheit; external federal links).
```

**Notes on the built nav vs. the original target (Appendix C):** the main nav was consolidated from the aspirational ~10 areas to **four**: *Anwendungen*, *Dokumente & Medien* and *Daten* fold into **Daten und Digitalisierung**; *Aktuelles* and *Wissen* merge into **News und Wissen**; *Über das BBL* / *Hilfe & Kontakt* move to the footer/meta-nav. This keeps the top nav within CD Bund's "limit main menus to ~5" guidance.

## 3. Route contract

| Route | Page | State (query) |
|---|---|---|
| `#/` | Startseite | — |
| `#/services` · `#/services/<id>` | Service catalogue · detail | `q, audience, topic, page, view` |
| `#/applications` · `#/applications/<id>` | App catalogue · detail | `q, bereich, audience, page, view` |
| `#/data` | Daten und Digitalisierung (hub) | — |
| `#/data/katalog` · `#/data/katalog/<id>` | Datenbezug und API Verzeichnis (DCAT) · dataset detail | `q, thema, klass, tags, page, view` |
| `#/data/digitalisierung[/<sub>]` | Digitalisierung (`strategie/vision/prinzipien/superb/bim`) | — |
| `#/data/ikt-vorhaben` | IKT-Vorhaben | — |
| `#/app/<name>[/<id>]` | Micro-apps (portfolio, projects, workspace, mediathek, document-archive, dataportal, space-request, fault-report, transaction) | `?tab=` for real in-page tabs; dashboard also `from, to` |
| `#/knowledge` | News und Wissen (overview) | — |
| `#/knowledge/<section>` | grundlagen · news · prozesse · anleitungen | — |
| `#/knowledge/grundlagen/<id>` · `#/knowledge/news/<id>` | Weisung detail · news detail | — |
| `#/my-cases` · `#/my-cases/<id>` | Meine Vorgänge (login-gated) · Vorgang detail | detail: `?tab=daten\|anhaenge\|verlauf` |
| `#/search` | Search | `q` |

- Non-addressable sub-views (`#`, in-page anchors) do **not** dispatch (router guard) — a bare `#` used to render a 404 over the page.
- **Meine Vorgänge** is the only login-gated area; all catalogue content stays visible when logged out (only *starting* a Vorgang needs login).
- **Correction (2026-07):** `#/knowledge?tab=grundlagen|news|prozesse|anleitungen` were standalone pages wrongly addressed as tabs. They are now path segments `#/knowledge/<section>[/<id>]`. Side effect: switching between them is real navigation (focus moves to the new `h1`), not a state change.

## 4. Design principles

A *service portal* answers **"What do you want to do?"** — not "Where in the org chart does this live?". Five principles:

1. **Service-first, task-oriented.** The primary nav is a service catalogue grouped by domain. Every entry is either a *service* (an action you can start) or *information* (something to read), and the two are visually distinguished.
2. **One front door.** A single home with search-first entry and the most-used services one click away; the three legacy sites federate behind it.
3. **Self-service & status.** Real transactional actions (orders, fault reports, requests, incident reports) are first-class "services", and **Meine Vorgänge** tracks them — the hallmark of a service portal.
4. **Consistent, normalized vocabulary.** One canonical name per service/app; plain-language German labels.
5. **Audience-aware, not audience-fragmented.** One portal; domains/services carry an audience tag instead of splitting into separate sites.

## 5. Audience model

Two overlapping audiences share one portal; the difference is *which services* a person uses. Tags: **(K)** Kunde · **(P)** Personal · **(B)** beide.

- **(K) Kunden** — employees of *other* federal offices who consume BBL services (buildings, office supplies, IT procurement, publishing, moves). Today's *Kundenplattform* audience and the strongest service-portal fit.
- **(P) Personal** — BBL's own staff, who additionally need HR, org, internal news, and the specialist construction applications.
- **(B) Beide** — shared services (security/incident reporting, emergency, news, forms & templates, knowledge base).

Confirmed (2026-06-15): build the *unified* model (Kunden + Personal in one portal, domains audience-tagged), not a customers-only scope.

## 6. Decisions & out of scope

**Confirmed:**
1. **Audience scope** → unified portal (Kunden + Personal), domains audience-tagged.
2. **Top-level breadth** → four task areas as built (Dienstleistungen · Daten und Digitalisierung · News und Wissen · Meine Vorgänge); service domains nest under the catalogue; apps under *Daten*.
3. **"Meine Vorgänge" realism** → request forms actually create/track client-side entries (mock process engine, `localStorage`).
4. **Login** → mocked AGOV / FedLogin; only *starting a Vorgang* and *Meine Vorgänge* require it.

**Out of scope (prototype):** real authentication/SSO (eGate) · live backend data (E-Shop, SAP/SUPERB, InfoPers) · full content migration · FR/IT/RM/EN translations (switcher stubbed).

---

# Appendix — Pre-build analysis (before the prototype)

> This is the situation analysis that **motivated** the structure in Part 1, written *before* the prototype existed (2026-06 / 2026-07). It is kept for rationale and traceability — it is **not** a description of the current app. Where it conflicts with Part 1, Part 1 wins.

## A. Where we started — three sites

What looks like "the intranet" was actually **three different websites on three hostnames**, plus a dozen external systems, tied together only by links.

| # | "Site" | Hostname | Platform | Organized by | Audience |
|---|--------|----------|----------|--------------|----------|
| 1 | **Staff intranet** (EFD-BBL) | `intranet.efd-bbl.admin.ch` | Classic AEM, 10-item mega-menu | BBL org & topics | BBL employees |
| 2 | **Kundenplattform BBL** | `intranet.bbl.admin.ch/de` | Nuxt + CD Bund (relaunched — see §B) | BBL *services* | BBL's internal customers |
| 3 | **Public website** | `www.bbl.admin.ch` | Newer Nuxt/Vue SPA | BBL's public offerings | Public / industry |

On top of these sit separate applications: eGate (SSO), InfoPers (HR), PERIMAP/ILIAS (learning), Admin-Directory, BIT Kundenplattform, the E-Shop, plus 8 construction apps (GIS IMMO, DALA/FileNET, CDE, EDM, EHP, FLM, PVA, QualityGate).

**Why it felt chaotic:** no single front door · two competing taxonomies (org/topic vs. service domain) · services buried as deep links inside content · inconsistent labels · mixed audiences in one nav · content and transactions at the same level with no distinction.

**Worth keeping:** the Kundenplattform's **service-domain taxonomy** (the right backbone), the **Fachanwendungen** app catalogue, reusable UI patterns (news lists, accordion document libraries, contact boxes), and the CD Bund design system.

## B. Captured legacy tree (2026-07-23)

**Source:** saved page `Bestellen (E-Shop).html` from `https://intranet.bbl.admin.ch/de/bestellen-e-shop` (Nuxt, rendered with CD Bund). The eight L1 items each open a `navy` drawer with nested sub-branches (`navy__level-0 … level-7`). All URLs are `https://intranet.bbl.admin.ch/de/<slug>`.

```
Kundenplattform BBL   ·   intranet.bbl.admin.ch/de
│
├── Top bar ......................... Jobs · Bundespublikationen · Kontakt
│
├── Unterbringung  /unterbringung
│   ├── Raumbedarf, bauliche Bedürfnisse ...... /raumbedarf-bauliche-beduerfnisse
│   ├── Standards ............................. /standards
│   ├── Leistungsverrechnung .................. /leistungsverrechnung
│   ├── Störungsmeldungen Gebäude / Kleinaufträge  /stoerungsmeldungen-gebaeude-kleinauftraege
│   └── Dienstleistungskatalog ................ /dienstleistungskatalog
│
├── Objektbetrieb  /objektbetrieb
│   ├── Objektbewirtschaftung und Betrieb ..... /objektbewirtschaftung-und-betrieb
│   │   ├── Objektverantwortung ............... /objektverantwortung
│   │   ├── Objektbetrieb (Hauswartung) ....... /objektbetrieb-hauswartung
│   │   ├── Techn. Gebäudemanagement .......... /techn-gebaeudemanagement
│   │   └── Reinigung ......................... /reinigung
│   ├── Anlässe ............................... /anlaesse
│   │   ├── Fahnenmanagement .................. /fahnenmanagement
│   │   ├── Blumendekorationen ................ /blumendekorationen
│   │   ├── Innenbegrünung .................... /innenbegruenung
│   │   └── Grünflächen ....................... /gruenflaechen
│   └── Umzüge / Transport / Entsorgung ....... /umzuege-transport-entsorgung
│       ├── Umzüge ............................ /umzuege
│       ├── Transport ......................... /transport
│       ├── Kurierdienst BBL .................. /kurierdienst-bbl
│       └── Entsorgung ......................... /entsorgung
│
├── Büroausrüstung  /bueroausruestung
│   ├── Bestellen (E-Shop) .................... /bestellen-e-shop
│   ├── Büromaterial ......................... /bueromaterial
│   ├── EDV-Verbrauchsmaterial ............... /edv-verbrauchsmaterial
│   ├── Bürotechnik .......................... /buerotechnik
│   ├── Informatik-Sortiment ................. /informatik-sortiment
│   ├── Mobiliar ............................. /mobiliar
│   │   └── Mobiliarverkauf für Bundesmitarbeitende  /mobiliarverkauf-fuer-bundesmitarbeitende
│   └── Hausdienstmaterial ................... /hausdienstmaterial
│
├── Produktion  /produktion
│   ├── Arbeitsvorbereitung AVOR ............. /arbeitsvorbereitung-avor
│   ├── Datenbewirtschaftung / Formularentwicklung  /datenbewirtschaftung-formularentwicklung
│   │   ├── Elektronische Formulare .......... /elektronische-formulare
│   │   └── Serienbriefverarbeitung .......... /serienbriefverarbeitung
│   ├── Projektberatung und Support .......... /projektberatung-und-support
│   ├── Digital Druck ........................ /digital-druck
│   └── Versenden ............................ /versenden
│
├── Publikationen  /publikationen
│   ├── Bestellen ............................ /bestellen
│   └── Warengruppe Publikationen ............ /warengruppe-publikationen
│
├── Informatik  /informatik
│   ├── Einkauf Informatik ................... /einkauf-informatik
│   ├── Bedarfsmeldung / HBB-Prozess ......... /bedarfsmeldung-hbb-prozess
│   ├── Delegationen ......................... /delegationen
│   ├── Werkzeugkasten ....................... /werkzeugkasten
│   ├── Mustervorlagen für IKT-Beschaffungen . /mustervorlagen-fuer-ikt-beschaffungen
│   └── Zentral bewirtschaftete Rahmenverträge Informatik  /zentral-bewirtschaftete-rahmenvertraege-informatik
│
├── Beschaffen  /beschaffen
│   ├── Einstieg und Übersicht ............... /einstieg-und-uebersicht
│   ├── WTO-Verfahren ........................ /wto-verfahren
│   ├── Dokumente der BKB .................... /dokumente-der-bkb
│   └── Beschaffungscontrolling Bundesverwaltung  /beschaffungscontrolling-bund
│       ├── Fachstelle Beschaffungscontrolling FSBC  /fachstelle-beschaffungscontrolling-fsbc
│       ├── Bekanntgabe der Beschaffungen ab 50'000 Franken  /bekanntgabe-der-beschaffungen-ab-50-000-franken
│       ├── Beschaffungskategorien ........... /beschaffungskategorien
│       ├── Vertragsmanagementsystem VM-System  /vertragsmanagementsystem-vm-system
│       ├── Info-Notizen ..................... /info-notizen
│       └── Monitoring Beschaffungsstrategie . /monitoring-beschaffungsstrategie
│
├── Mieterportal  /mieterportal   (external system, own portal)
├── Reklamationsmeldung  /reklamationsmeldung
└── Footer .......................... AGB des Bundes · Rechtliches · Barrierefreiheit
```

**Structural problems (the diagnosis Part 1 responds to):**

1. **URLs are flat; the hierarchy is fake.** The breadcrumb claims `Startseite › Büroausrüstung › Bestellen (E-Shop)`, but every page sits at `/de/<slug>`. Nesting exists only in the menu config — it cannot be linked to or reasoned about.
2. **Catalogue and entry point are siblings.** "Bestellen (E-Shop)" sits at the same level as the six product categories it is the way *into*.
3. **Eight top-level items, not one kind of thing.** Object types (Büroausrüstung, Publikationen), a lifecycle stage (Unterbringung, Objektbetrieb), a verb (Beschaffen), and a *system* (Mieterportal) share one bar. CD guidance is "limit main menus to ~5".
4. **Organised by administrative structure, not task.** Ordering is split into "Kreis 1 + 2" vs "Kreis 3" — the user must work out their administrative circle before ordering a pen.
5. **Four jobs on one page.** `Bestellen (E-Shop)` is shop access, a registration process (PDF form), an FAQ, and a contact directory at once.
6. **The action is buried in prose;** process leaks into content ("Speichern Sie die Links bitte nicht als Favoriten ab…"); the registration path is a downloadable PDF dead-end that nothing tracks.

**Page-level defects (E-Shop page as a specimen):** two `<h1>` (title vs. share widget) · 4 empty headings · repeated headings ("Kontakt" ×2 …) · trailing colons in headings · a table-of-contents rendered *after* the content and listing only 2 of 4 sections · duplicated body copy · 18 PDF links used as functions.

## C. Original target IA (partly realized)

The pre-build target separated the mixed axes into distinct ones — *what you want to **do*** (Dienstleistungen), *to **use*** (Anwendungen), *to **read/find*** (Dokumente & Medien, Wissen, Daten), *already **started*** (Meine Vorgänge). The tree below was the detailed target; **the build consolidated it to the four-item nav in Part 1 §2** (see the note there). Legend: **(K)** Kunde · **(P)** Personal · **(B)** beide · **[SS]** self-service action · **[TX]** transaction · **(extern)** external system · **(Hero)** hero app (full micro-app, also on the dashboard).

```
BBL Service Portal
│
├── Home / Dashboard
│     Global service search · popular services · my open requests · Aktuelles ·
│     Notfall · quick links (canteen, eGate, BIT Support, Admin-Directory) · app launcher
│
├── Servicekatalog  (the core)
│     ├── A. Bauten & Bauprojekte  (K,P)
│     │     Raumbedarf & bauliche Bedürfnisse melden [SS] · Bauprojekt-Infos ·
│     │     Standards & Nachhaltiges Bauen · Leistungsverrechnung ·
│     │     Bautendokumentationen → Wissen · Kunst am Bau
│     ├── B. Immobilien & Gebäudebetrieb  (K,P)
│     │     Störungs-/Reinigungs-/Reparaturmeldung [SS] · Umzüge/Transport/Entsorgung [SS] ·
│     │     Reklamationsmeldung [SS] · Objektbewirtschaftung · Dienstleistungskatalog ·
│     │     Mieterportal / FLM Info-App
│     ├── C. Büroausrüstung & Arbeitsplatz  (K,P)
│     │     E-Shop bestellen [TX] · Büromaterial · Mobiliar · Bürotechnik ·
│     │     EDV-Verbrauchsmaterial · Hausdienstmaterial · Informatik-Sortiment
│     ├── D. Informatik & Arbeitsgeräte  (K,P)
│     │     Bedarfsmeldung "BANF" [SS] · IKT-Beschaffung · Mustervorlagen · Rahmenverträge ·
│     │     Werkzeugkasten · M365 · BIT Support (extern)
│     ├── E. Beschaffung  (K,P)
│     │     Einstieg · WTO-Verfahren · Beratung KBB · Vorlagen · Dokumente der BKB ·
│     │     Beschaffungs-Controlling · HBB (extern)
│     ├── F. Publizieren, Drucken & Versenden  (K,P)
│     │     Bundespublikationen bestellen [TX] · Publikationen erstellen · Digital Druck · Versenden
│     ├── G. Sicherheit & Notfall  (B)
│     │     Sicherheits-/Datenschutzvorfall melden [SS] · Integrale Sicherheit ·
│     │     Informatiksicherheit · Physische Sicherheit · Notfallnummern
│     └── H. Personal & Arbeiten beim BBL  (P)
│           Onboarding · Aus-/Weiterbildung (PERIMAP/ILIAS) (extern) · Stellen (extern) ·
│           InfoPers (extern) · Personalentwicklung · Frauennetzwerk · Ideenmanagement
│
├── Anwendungen  (software launcher)
│     Immobilien & Bau: Liegenschaften Inventar (Hero) · Bauprojekte/EPPM (Hero) ·
│       Fachanwendungen (GIS IMMO · DALA/FileNET · CDE · EHP · FLM · EDM · PVA · QualityGate)
│     Arbeitsplatz & Logistik (Workspace · E-Shop · Möbel & Circular)
│     Zentrale Systeme (eGate · InfoPers · SAP/SUPERB · Admin-Directory (extern))
│
├── Dokumente & Medien
│     Dokumentenarchiv / Bauwerksdokumentation · Mediathek (photos & videos)
│
├── Daten
│     Datenbezug (thematic dataset landing) · Datenkatalog (DCAT: Datasets · Services · Concepts)
│
├── Meine Anfragen  (→ "Meine Vorgänge" as built)
│     Status tracking across all services (offen / in Bearbeitung / erledigt)
│
├── Wissen
│     Weisungen & Vorgaben · Formulare & Vorlagen · Anleitungen · FAQ · Prozesse · Demos & Lernvideos
│
├── Aktuelles  (News)
│     Intranews BBL · Intranews EFD · Direktionsflash · Medienmitteilungen · SUPERB-Programm
│
├── Über das BBL
│     Organigramm · Strategie & Jahresziele · Nachhaltigkeit · Standort · Mitarbeitendenvertretung
│
└── Hilfe & Kontakt
      Kontakt (by domain) · Hilfe / Support · Feedback zum Portal

Footer / "Wechseln zu": Andere EFD-Ämter · Andere Departemente ·
  Öffentliche Website www.bbl.admin.ch (extern) · eGate (extern) · Admin-Directory (extern)
```

## D. Old → new mapping (consolidation)

| Today (where it lived) | New home |
|------------------------|----------|
| Staff intranet → Fachanwendungen | App launcher under **Daten und Digitalisierung** + Domains A/B |
| Staff intranet → Themen → Sicherheit | Domain **G. Sicherheit & Notfall** (service `sicherheitsvorfall-melden`) |
| Staff intranet → Personal und Ausbildung | Domain **H. Personal** (staff) |
| Staff intranet → Das BBL | footer / "Über das BBL" |
| Staff intranet → SUPERB (ERP program) | **News und Wissen**; clusters map into Domains A–H |
| Staff intranet → Support@BIL / HBB | Domain **E. Beschaffung** |
| Staff intranet → News / Intranews | **News und Wissen → News** |
| Kundenplattform → all service categories | **Dienstleistungen** (the backbone) |
| Public site → Bautendokumentationen / Mediendatenbank | **Daten und Digitalisierung → Dokumentenarchiv / Mediathek** |
| Forms & templates | **News und Wissen → Anleitungen / Vorlagen** |
| eGate, InfoPers, PERIMAP, Admin-Directory | external systems — linked from home quick-links & footer |

**Notably retired/merged:** the split between "staff intranet" and "Kundenplattform"; the standalone "Departement" menu (becomes audience-tagged content + footer switcher); duplicate news entry points.
