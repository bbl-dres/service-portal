# BBL Kundenplattform — Legacy analysis

> **Status:** Evidence, not specification · **Captured:** 2026-07-29
> **Companion to:** [sitemap.md](sitemap.md) — the navigation & routing specification this analysis motivates.
> **Source:** 38 MHTML captures of the live Kundenplattform (`D:\bbl kundenplattform`), covering the homepage and every L1 and L2 page. 63 pages exist; 38 captured, 25 referenced but not captured (marked ○).

Sections A and C predate the prototype (2026-06 / 2026-07) and are kept for rationale. **B and D are current** — B is the live platform as captured, D maps it page by page onto the prototype.

**Contents:** [A Where we started](#a-where-we-started--three-sites) · [B Verified capture](#b-verified-legacy-capture-2026-07-29) · [C Target IA, completed](#c-original-target-ia--completed-against-the-2026-07-29-capture) · [D Old → new mapping](#d-old--new-page-by-page-2026-07-29)

---
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

## B. Verified legacy capture (2026-07-29)

**Source:** 38 MHTML captures of `https://intranet.bbl.admin.ch/de/…` (Nuxt, rendered with CD Bund), taken 2026-07-29, held at `D:\bbl kundenplattform`. Each capture's `<nav aria-label="Hauptmenü">` gives the L1 items; each hub page's card grid names its own children ("Mehr über «X»").

**Coverage:** the homepage, all 8 L1 areas and **every L2 page** are captured. Following the card links, the platform has **63 pages**: **38 captured**, **25 not captured** — the latter are all leaves plus three shell pages, marked **○** below. They are referenced by a parent card, but their own content is unverified. All URLs are `/de/<slug>`.

> **This supersedes the earlier reconstruction** (2026-07-23), which was inferred from the navy drawer of a single saved page. Seven of its branches were wrong — see B.2.

### B.1 The tree as captured

```
Kundenplattform BBL   ·   intranet.bbl.admin.ch/de
│   Homepage = h1 + lead + hero image + 8 cards (one per L1 item).
│   No search. No news. No login. No tasks. No status. It is a menu of the menu.
│
├── Top bar ......... Jobs (extern) · Bundespublikationen (extern) · Kontakt ○
│
├── Unterbringung ............................. /unterbringung
│   ├── Raumbedarf, bauliche Bedürfnisse ...... /raumbedarf-bauliche-beduerfnisse   6 Dok.
│   ├── Standards ............................. /standards                          8 Dok. · ToC after content
│   └── Leistungsverrechnung .................. /leistungsverrechnung               7 Dok. · ToC after content
│
├── Objektbetrieb ............................. /objektbetrieb
│   ├── Störungsmeldungen Gebäude / Kleinaufträge  /stoerungsmeldungen-…            3 Dok. · FIORI + eGate
│   ├── Dienstleistungskatalog ................ /dienstleistungskatalog             3 Dok. (all 3 also on Leistungsverrechnung)
│   ├── Objektbewirtschaftung und Betrieb ..... /objektbewirtschaftung-und-betrieb
│   │   ├── Objektverantwortung ............... /objektverantwortung                    ○
│   │   ├── Objektbetrieb (Hauswartung) ....... /objektbetrieb-hauswartung              ○
│   │   ├── Techn. Gebäudemanagement .......... /techn-gebaeudemanagement               ○
│   │   ├── Reinigung ......................... /reinigung                              ○
│   │   ├── Anlässe ........................... /anlaesse                               ○
│   │   ├── Fahnenmanagement .................. /fahnenmanagement                       ○
│   │   ├── Blumendekorationen ................ /blumendekorationen                     ○
│   │   ├── Innenbegrünung .................... /innenbegruenung                        ○
│   │   └── Grünflächen ....................... /gruenflaechen                          ○
│   └── Umzüge / Transport / Entsorgung ....... /umzuege-transport-entsorgung
│       ├── Umzüge ............................ /umzuege                                ○
│       ├── Transport ......................... /transport                              ○
│       └── Entsorgung ........................ /entsorgung                             ○
│
├── Büroausrüstung ............................ /bueroausruestung
│   ├── Bestellen (E-Shop) .................... /bestellen-e-shop     3 Dok. · Kreis 1+2 vs. Kreis 3
│   ├── Büromaterial .......................... /bueromaterial        3 Dok. ·  494 Zeichen
│   ├── EDV-Verbrauchsmaterial ................ /edv-verbrauchsmaterial       259 Zeichen
│   ├── Bürotechnik ........................... /buerotechnik         1 Dok. ·  334 Zeichen
│   ├── Informatik-Sortiment .................. /informatik-sortiment 1 Dok. ·  351 Zeichen
│   ├── Mobiliar .............................. /mobiliar             9 Dok.
│   │   └── Mobiliarverkauf für Bundesmitarbeitende  /mobiliarverkauf-…                 ○
│   └── Hausdienstmaterial .................... /hausdienstmaterial   1 Dok. ·  335 Zeichen
│
├── Produktion ................................ /produktion
│   ├── Arbeitsvorbereitung AVOR .............. /arbeitsvorbereitung-avor          12 Dok.
│   ├── Datenbewirtschaftung / Formularentwicklung  /datenbewirtschaftung-…         3 Dok.
│   │   ├── Elektronische Formulare ........... /elektronische-formulare                ○
│   │   ├── Serienbriefverarbeitung ........... /serienbriefverarbeitung                ○
│   │   └── Projektberatung und Support ....... /projektberatung-und-support            ○
│   ├── Digital Druck ......................... /digital-druck                      2 Dok.
│   └── Versenden ............................. /versenden                          3 Dok.
│
├── Publikationen ............................. /publikationen
│   ├── Bestellen ............................. /bestellen
│   ├── Warengruppe Publikationen ............. /warengruppe-publikationen          4 Dok.
│   └── Externer Vertrieb ..................... bundespublikationen.admin.ch    (extern)
│
├── Informatik ................................ /informatik
│   ├── Einkauf Informatik .................... /einkauf-informatik
│   ├── Bedarfsmeldung / HBB-Prozess .......... /bedarfsmeldung-hbb-prozess   6 Dok. · 6× mailto
│   ├── Delegationen .......................... /delegationen                 2 Dok. (Word)
│   ├── Werkzeugkasten ........................ /werkzeugkasten              16 Dok. · 12 Ebenensprünge
│   ├── Mustervorlagen für IKT-Beschaffungen .. /mustervorlagen-…            12 Dok.
│   └── Zentral bewirtschaftete Rahmenverträge Informatik  /zentral-…         1 Dok. · 374 Zeichen
│
├── Beschaffen ................................ /beschaffen
│   ├── Einstieg und Übersicht ................ /einstieg-und-uebersicht           3 Dok.
│   ├── WTO-Verfahren ......................... /wto-verfahren                     ToC after content
│   ├── Kompetenzzentrum Beschaffungswesen Bund (KBB)  www.bbl.admin.ch        (extern)
│   ├── Dokumente der BKB ..................... /dokumente-der-bkb   8 Dok. · ToC after content
│   ├── Beschaffungscontrolling Bundesverwaltung  /beschaffungscontrolling-bund   3 Dok.
│   │   ├── Fachstelle Beschaffungscontrolling FSBC ......................          ○
│   │   ├── Bekanntgabe der Beschaffungen ab 50'000 Franken ..............          ○
│   │   ├── Beschaffungskategorien .......................................          ○
│   │   ├── Vertragsmanagementsystem VM-System ...........................          ○
│   │   ├── Monitoring Beschaffungsstrategie .............................          ○
│   │   └── Pilot Dashboard «Verträge/Bestellungen nach Departement» .....          ○
│   └── Beschaffungsstellen — Verzeichnis ..... beschaffungsstellen.admin.ch   (extern)
│
├── Mieterportal .............................. /mieterportal        ○   (an L1 item that is a system)
│
├── Reklamationsmeldung ....................... /reklamationsmeldung ○   (homepage link — NOT in the main nav)
│
└── Footer ......... AGB des Bundes · Rechtliches · Barrierefreiheit    (all three external)

○ = referenced but not captured; content unverified (25 of 63 pages).
```

### B.2 Corrections to the 2026-07-23 reconstruction

The earlier tree was inferred from one page's navy drawer. Against the hub pages' own card grids:

| Reconstruction claimed | The capture shows |
|---|---|
| *Unterbringung* has 5 children incl. **Störungsmeldungen** + **Dienstleistungskatalog** | `/unterbringung` has **3**; both of those are cards on **`/objektbetrieb`** |
| *Objektbetrieb* → **Anlässe** as its own branch with 4 children | `/objektbewirtschaftung-und-betrieb` has **9 flat children**; Anlässe, Fahnenmanagement, Blumendekorationen, Innenbegrünung and Grünflächen are siblings, not a nest |
| *Umzüge / Transport / Entsorgung* → 4, incl. **Kurierdienst BBL** | **3.** "Kurierdienst" appears nowhere in the capture |
| *Produktion* → 5, incl. **Projektberatung und Support** | **4.** Projektberatung is a child of *Datenbewirtschaftung* |
| *Publikationen* → 2 children | **3** — plus **Externer Vertrieb** (→ bundespublikationen.admin.ch) |
| *Beschaffen* → 4 children | **6** — plus **KBB** and **Beschaffungsstellen-Verzeichnis**, both external |
| *Beschaffungscontrolling* → incl. **Info-Notizen** | Info-Notizen is gone; there is now **Pilot Dashboard «Verträge/Bestellungen nach Departement»** |

**The disagreement is the finding.** The drawer and the hub-page card grids describe *different* hierarchies for the same site. Nesting lives only in menu configuration, so the two drift — and nothing can detect the drift, because no URL encodes the hierarchy.

### B.3 The evidence, counted (n = 38 pages)

| Measure | Count | What it means |
|---|---:|---|
| `<form>` elements | **0** | The customer platform has **no transactional surface at all** |
| `<table>` elements | **0** | No structured data anywhere — everything is prose |
| Document links (PDF/DOCX/ZIP) | **120** on 24 pages | The attachment *is* the service |
| Distinct `mailto:` addresses | **14** | E-mail is the process engine — `einkauf.it@bbl.admin.ch` on 7 pages, 6× on one page |
| Distinct external hosts | **30** | SRM shop on 8 pages, plus eGate, b2bshop, fedlex, bkb, kbob, simap, perimap, DTI, InfoPers, HERMES, NCSC, SEPOS, SWICO, YouTube |
| Pages with an empty `<h2>` | **21** | The card-grid wrapper ships a heading with no text |
| Heading-level skips | **12 on `/werkzeugkasten`** alone | |
| "Inhaltsverzeichnis" *after* the content | **4 pages** | standards · leistungsverrechnung · bestellen-e-shop · dokumente-der-bkb |
| Duplicate headings on one page | **5** on `/dokumente-der-bkb` and `/werkzeugkasten` | |
| Median page | **~1.2 KB of text** | Six Büroausrüstung pages are 259–494 characters |

**Structural problems (the diagnosis Part 1 responds to):**

1. **URLs are flat; the hierarchy is fake.** The breadcrumb claims `Startseite › Büroausrüstung › Bestellen (E-Shop)`, but all 61 pages sit at `/de/<slug>` — including grandchildren like `/objektverantwortung` and `/gruenflaechen`. Nesting exists only in menu config: it cannot be linked to, reasoned about, or kept honest (see B.2).
2. **Catalogue and entry point are siblings.** `/bestellen-e-shop` sits at the same level as the six product categories it is the way *into* — and all six link back to it ("Online Shop für zentrale Bundesstellen").
3. **Eight top-level items, not one kind of thing.** Object types (Büroausrüstung, Publikationen), lifecycle stages (Unterbringung, Objektbetrieb), a verb (Beschaffen) and a *system* (Mieterportal) share one bar, against CD's *"Try to limit mainmenus to 5"*.
4. **Organised by administrative structure, not task.** `/bestellen-e-shop` splits into "Kreis 1 + 2" and "Kreis 3" — you must work out your administrative circle before you can order a pen.
5. **Four jobs on one page.** `/bestellen-e-shop` is shop access, a registration process (a PDF form), an FAQ ("Einkaufshilfe") and a contact directory at once — with 2 empty headings, 3 duplicated ones and a ToC after the content.
6. **The transaction is a downloadable PDF.** `/mobiliar` carries an `<h2>` that is an instruction sentence — *"Damit das Formular vollständig ausgefüllt werden kann, muss es heruntergeladen und lokal abgespeichert werden"* — followed by *"zwingend mit Acrobat Reader oder Acrobat Pro"* and right-click instructions for Windows Explorer. Nothing tracks the result.
7. **Six pages that are one page.** Büromaterial, EDV-Verbrauchsmaterial, Bürotechnik, Informatik-Sortiment, Hausdienstmaterial and (partly) Mobiliar repeat the same sentence — *"Anstelle des PDF-Katalogs finden Sie eine Übersicht unserer Artikel neu unter folgendem Link"* — the same SRM link and the same link back to the E-Shop. They are product facets promoted to pages.
8. **Process leaks into content.** *"Speichern Sie die Links bitte nicht als Favoriten ab. Dies kann Zugriffsprobleme verursachen."* — a bookmarking bug is documented as a house rule instead of being fixed.
9. **Social share buttons on an intranet.** Facebook, Twitter, LinkedIn, Xing and WhatsApp share links on every page of a federal internal platform.
10. **The best-documented process is prose.** `/delegationen` narrates a full seven-step approval workflow (Gesuch → Erstprüfung → Prüfinstanz → Delegationsvereinbarung → digital signature → countersignature → Delegationsmanagement-Tool) in a paragraph, and hands over two Word files. It is a workflow that has been fully specified and never built.

## C. Original target IA — completed against the 2026-07-29 capture

The pre-build target separated the mixed axes into distinct ones — *what you want to **do*** (Dienstleistungen), *to **use*** (Anwendungen), *to **read/find*** (Dokumente & Medien, Wissen, Daten), *already **started*** (Meine Vorgänge). The tree below was the detailed target; **the build consolidated it to a four-item nav**, which the five-area target in Part 1 §2.1 now supersedes.

**Completeness pass (2026-07-29).** The original target was drafted before the full legacy inventory existed and turned out to be **missing 30 services** — a whole service line (Produktion) among them. Entries marked **⁺** were added from the capture. Legend: **(K)** Kunde · **(P)** Personal · **(B)** beide · **[SS]** self-service action · **[TX]** transaction · **(extern)** external system · **(Hero)** hero app.

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
│     │     Störungs-/Reinigungs-/Reparaturmeldung [SS] · Reklamationsmeldung [SS] ·
│     │     Dienstleistungskatalog · Mieterportal / FLM Info-App
│     │     ├── Objektbewirtschaftung und Betrieb
│     │     │     Objektverantwortung ⁺ · Objektbetrieb / Hauswartung ⁺ ·
│     │     │     Techn. Gebäudemanagement ⁺ · Reinigung ⁺
│     │     ├── Anlässe & Dekoration ⁺  — the whole line was missing
│     │     │     Anlässe ⁺ (Logistik für Bundesrat / Departementsvorsteher, Bernerhof & extern) ·
│     │     │     Fahnenmanagement ⁺ · Blumendekorationen ⁺ · Innenbegrünung ⁺ · Grünflächen ⁺
│     │     └── Umzüge / Transport / Entsorgung [SS]
│     │           Umzüge ⁺ · Transport ⁺ · Entsorgung ⁺   (three distinct services, not one)
│     ├── C. Büroausrüstung & Arbeitsplatz  (K,P)
│     │     E-Shop bestellen [TX] · Büromaterial · Mobiliar · Bürotechnik ·
│     │     EDV-Verbrauchsmaterial · Hausdienstmaterial · Informatik-Sortiment ·
│     │     Mobiliarverkauf für Bundesmitarbeitende ⁺ (P — a staff offer inside the customer platform)
│     ├── D. Informatik & Arbeitsgeräte  (K,P)
│     │     Bedarfsmeldung "BANF" [SS] · IKT-Beschaffung · Mustervorlagen · Rahmenverträge ·
│     │     Werkzeugkasten · M365 · BIT Support (extern) ·
│     │     Delegationen ⁺ [SS] (Gesuch unterschwellige Delegation / Projektdelegation —
│     │       a specified 7-step approval workflow, see B.3 §10)
│     ├── E. Beschaffung  (K,P)
│     │     Einstieg · WTO-Verfahren · Beratung KBB · Vorlagen · Dokumente der BKB · HBB (extern) ·
│     │     Beschaffungsstellen-Verzeichnis ⁺ (extern)
│     │     └── Beschaffungs-Controlling  — six sub-services, none previously listed
│     │           Fachstelle Beschaffungscontrolling FSBC ⁺ · Bekanntgabe der Beschaffungen
│     │           ab 50'000 Franken ⁺ · Beschaffungskategorien ⁺ · Vertragsmanagementsystem
│     │           VM-System ⁺ · Monitoring Beschaffungsstrategie ⁺ ·
│     │           Pilot Dashboard «Verträge/Bestellungen nach Departement» ⁺ → Datenportal
│     ├── F. Publizieren, Drucken & Versenden  (K,P)
│     │     Bundespublikationen bestellen [TX] · Publikationen erstellen · Digital Druck · Versenden ·
│     │     Externer Vertrieb ⁺ (extern — Bundespublikationen-Shop, ~60'000 Publikationen) ·
│     │     Warengruppe Publikationen ⁺ (zentrale Beschaffungsstelle: Publikationen,
│     │       Agenturleistungen, Sicherheitsprodukte — Pass, ID, Vignette)
│     │     └── Produktion ⁺  — the entire service line was missing
│     │           Arbeitsvorbereitung AVOR ⁺ (Auftragsannahme der Produktion: Beratung,
│     │             Offerten, Terminplanung, SAP-Kontrakte) ·
│     │           Datenbewirtschaftung / Formularentwicklung ⁺ ·
│     │           Elektronische Formulare ⁺ · Serienbriefverarbeitung ⁺ ·
│     │           Projektberatung und Support ⁺ ·
│     │           Zustellplattform ⁺ · Interaktive Kundenkorrespondenz ⁺
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

### C.1 What the completeness pass changed

| Domain | Added | Why it was missed |
|---|---|---|
| **B. Immobilien & Gebäudebetrieb** | 12 (4 OBB operations · the 5-service Anlässe & Dekoration line · Umzüge split into 3) | The target listed "Objektbewirtschaftung" as one item; the capture shows 9 flat children plus a 3-way split under Umzüge |
| **C. Büroausrüstung** | 1 (Mobiliarverkauf für Bundesmitarbeitende) | A **staff** offer sitting inside the *customer* platform — evidence for the audience-tag model (§5), not against it |
| **D. Informatik** | 1 (Delegationen) | A fully specified approval workflow that reads as a document page |
| **E. Beschaffung** | 7 (6 Beschaffungs-Controlling sub-services + Beschaffungsstellen-Verzeichnis) | Controlling was one line in the target; it is a section with six children |
| **F. Publizieren, Drucken & Versenden** | 9 (the whole **Produktion** line + Warengruppe Publikationen + Externer Vertrieb) | The target covered the *output* (Druck, Versand) but not the *intake* (AVOR) or the data/forms services behind it |
| | **30 additions across 5 domains** | |

**Two consequences for the target IA:**

1. **The service inventory is roughly twice the size assumed.** `data/services.json` holds 20 services; the legacy platform alone carries ~50 distinct offerings before the staff intranet (domains G and H) is counted. The prototype's catalogue is a representative sample, not a complete one — see D.2.
2. **Domain F is mis-shaped.** "Publizieren, Drucken & Versenden" was framed as an ordering domain, but AVOR, Datenbewirtschaftung, Formularentwicklung, Zustellplattform and Serienbriefverarbeitung are a **data-processing service line** that happens to end at a printer. Either F splits, or it is renamed to cover production services rather than publication products.

## D. Old → new, page by page (2026-07-29)

Every page in the capture, mapped to its home in the prototype. **GAP** = no surface exists yet. Routes use the Part 1 target naming (`#/knowledge/…`, `#/news`); under the current build these are still `#/knowledge/…`. ○ = leaf not captured.

**Shell**

| Legacy | New home | Note |
|---|---|---|
| `/` (8 cards) | `#/` | Startseite becomes search-first; the 8 area cards become Themen tiles + open cases + news |
| Top bar → Jobs (extern) | footer external links | |
| Top bar → Bundespublikationen (extern) | `#/applications/bundespublikationen` | |
| Top bar → `/kontakt` ○ | meta-nav *Hilfe* + per-service `C.contactBox` | contact moves *to* the service, not a directory page |
| Footer (AGB · Rechtliches · Barrierefreiheit) | footer | unchanged |

**Unterbringung → Thema U**

| Legacy | New home | Note |
|---|---|---|
| `/unterbringung` | `#/services?topic=U` | |
| `/raumbedarf-bauliche-beduerfnisse` | `#/services/raumbedarf-melden` → `#/app/space-request` **[TX]** | the 6 Grobterminplan PDFs → `#/knowledge/templates` |
| `/standards` | `#/knowledge/regulations` | 8 directives, linked as documents; the Nachhaltigkeit block keeps its KBOB/NNBS external links |
| `/leistungsverrechnung` | `#/knowledge/regulations` | `type: info` — leaves Dienstleistungen per §2.4; price lists → `#/knowledge/templates` |

**Objektbetrieb → Thema O**

| Legacy | New home | Note |
|---|---|---|
| `/objektbetrieb` | `#/services?topic=O` | |
| `/stoerungsmeldungen-gebaeude-kleinauftraege` | `#/services/stoerung-melden` → `#/app/fault-report` **[TX]** | replaces Helpdesk phone + FIORI + eGate with one intake |
| `/dienstleistungskatalog` | merged into `#/knowledge/regulations` | its 3 PDFs are the same 3 as `/leistungsverrechnung` — **dedupe, do not port** |
| `/objektbewirtschaftung-und-betrieb` | `#/services?topic=O` | |
| `/objektverantwortung` ○ | `#/app/portfolio/<id>` → Kontakte register | object responsibility is per-building **data**, not a page |
| `/objektbetrieb-hauswartung` ○ · `/techn-gebaeudemanagement` ○ | **GAP** | service descriptions with no catalogue entry |
| `/reinigung` ○ | `#/services/stoerung-melden` | the service explicitly covers Reinigungsmeldung |
| `/anlaesse` ○ · `/fahnenmanagement` ○ · `/blumendekorationen` ○ · `/innenbegruenung` ○ · `/gruenflaechen` ○ | **GAP** — app `#/applications/fahnen-event` exists, no service | 5 services with an app but no way to order |
| `/umzuege-transport-entsorgung` | `#/services/umzug-anmelden` | app `#/applications/umzug-transport` |
| `/umzuege` ○ · `/transport` ○ · `/entsorgung` ○ | `#/services/umzug-anmelden` | three variants of one service |

**Büroausrüstung → Thema C**

| Legacy | New home | Note |
|---|---|---|
| `/bueroausruestung` | `#/services?topic=C` | |
| `/bestellen-e-shop` | `#/services/eshop-bestellen` → `#/applications/eshop` (extern) | **Kreis 1+2 / Kreis 3 disappears** — it becomes an audience tag, not a fork in the page |
| ↳ Anmeldeformular-B2B-Shop (PDF) | **GAP** — should be a Vorgang | today a downloadable dead-end that nothing tracks |
| `/bueromaterial` · `/edv-verbrauchsmaterial` · `/buerotechnik` · `/informatik-sortiment` · `/hausdienstmaterial` | `#/services/eshop-bestellen` | **five stub pages collapse into one service** — product categories are shop-side facets |
| `/mobiliar` | `#/services/eshop-bestellen` + `#/services/umzug-anmelden` | the page is two services in one; its Umzugs-/Transport-PDFs belong to the latter |
| `/mobiliarverkauf-fuer-bundesmitarbeitende` ○ | `#/applications/moebelboerse` | audience **(P)** |

**Produktion → Thema F** *(the weakest coverage)*

| Legacy | New home | Note |
|---|---|---|
| `/produktion` | `#/services?topic=F` | |
| `/arbeitsvorbereitung-avor` | **GAP** — app `#/applications/produktion-druck` only | AVOR *is* the order intake; its 12 PDFs are the order forms |
| `/datenbewirtschaftung-formularentwicklung` | **GAP** | |
| `/elektronische-formulare` ○ · `/serienbriefverarbeitung` ○ · `/projektberatung-und-support` ○ | **GAP** | |
| ↳ Zustellplattform · Interaktive Kundenkorrespondenz | **GAP** | two named products documented only as Faktenblatt PDFs |
| `/digital-druck` | **GAP** — app only | |
| `/versenden` | **GAP** — app only | |

**Publikationen → Thema F**

| Legacy | New home | Note |
|---|---|---|
| `/publikationen` | `#/services?topic=F` | |
| `/bestellen` | `#/services/publikation-bestellen` → `#/applications/bundespublikationen` **[TX]** | |
| `/warengruppe-publikationen` | **GAP** | central procurement office (Pass, ID, Vignette); its 4 forms → `#/knowledge/templates` |
| Externer Vertrieb (extern) | `#/applications/bundespublikationen` | |

**Informatik → Thema D**

| Legacy | New home | Note |
|---|---|---|
| `/informatik` | `#/services?topic=D` | |
| `/einkauf-informatik` | `#/services/banf-bedarfsmeldung` | its 11 legal links → `#/knowledge/regulations` |
| `/bedarfsmeldung-hbb-prozess` | `#/services/banf-bedarfsmeldung` **[TX]** | replaces **6 mailto links on one page** with one tracked Vorgang |
| `/delegationen` | **GAP** — should be `delegation-beantragen` **[SS]** | the 7-step workflow is already fully specified in prose (B.3 §10) |
| `/werkzeugkasten` | `#/knowledge/templates` | 16 tools under 12 headings |
| `/mustervorlagen-fuer-ikt-beschaffungen` | `#/knowledge/templates` | 12 contract templates — the clearest case for §2.5 |
| `/zentral-bewirtschaftete-rahmenvertraege-informatik` | **GAP** | a contract register; belongs in **Daten**, not as a page with one PDF |

**Beschaffen → Thema E**

| Legacy | New home | Note |
|---|---|---|
| `/beschaffen` | `#/services?topic=E` | |
| `/einstieg-und-uebersicht` | `#/knowledge` (`beschaffung-einstieg`, `type: info` → §2.4) | |
| `/wto-verfahren` | `#/knowledge/regulations` + simap.ch (extern) | |
| KBB (extern) | **GAP** | |
| `/dokumente-der-bkb` | `#/knowledge/templates` | 8 federal forms (Bankgarantie, Bürgschaft, Sanktionsliste, Unbefangenheitserklärung) |
| `/beschaffungscontrolling-bund` | `#/knowledge/regulations` + `#/app/dataportal` → *Beschaffung* | |
| ↳ `Pilot Dashboard «Verträge/Bestellungen nach Departement»` ○ | `#/app/dataportal` → *Beschaffung* | **a direct fit** — the legacy platform is already trying to be a dashboard here |
| ↳ FSBC ○ · Bekanntgabe ab 50'000 ○ · Beschaffungskategorien ○ · VM-System ○ · Monitoring Beschaffungsstrategie ○ | **GAP** | |
| Beschaffungsstellen-Verzeichnis (extern) | **GAP** | |

**Standalone**

| Legacy | New home | Note |
|---|---|---|
| `/mieterportal` ○ (L1) | **GAP** — the `tenant-portal` sibling prototype | an L1 nav item that is a *system*; §2 retires that pattern |
| `/reklamationsmeldung` ○ | `#/services/reklamation` **[SS]** | promoted from a homepage link to a catalogue service |

### D.1 What the mapping retires

- **The Kreis 1+2 / Kreis 3 split** — an administrative distinction the customer must resolve before acting. Becomes an audience tag on one service.
- **Six near-identical product-category pages** — collapse into one E-Shop service.
- **`/dienstleistungskatalog`** — duplicate of `/leistungsverrechnung`'s attachments.
- **PDF forms as the transaction** — 120 documents; the ones that *are* the action (Anmeldeformular B2B, Transport-/Umzugsauftrag, Delegationsgesuch, Digitaldruckauftrag, Versandauftrag) become Vorgänge; the ones that are *reference* (templates, price lists, directives) become `#/knowledge/templates` and `#/knowledge/regulations` entries.
- **14 mailto addresses as the intake channel** — replaced by service contact boxes plus a tracked Vorgang.
- **Social share widgets** on an internal platform.

### D.2 Coverage — where the prototype is thin

| Legacy area | Pages | Covered | Gaps | Verdict |
|---|---:|---:|---:|---|
| Unterbringung | 4 | 4 | 0 | complete |
| Objektbetrieb | 17 | 10 | 7 | good — gaps are the Anlässe & Dekoration line (5) and two OBB descriptions |
| Büroausrüstung | 9 | 9 | 0 | complete, but the shop-registration **Vorgang** is still a PDF |
| **Produktion** | 8 | **1** | **7** | **the whole service line is unmodelled** |
| Publikationen | 3 | 2 | 1 | Warengruppe Publikationen missing |
| Informatik | 7 | 5 | 2 | Delegationen + Rahmenverträge missing |
| **Beschaffen** | 11 | **6** | **5** | **Beschaffungs-Controlling's five reporting sub-services are unmodelled** |
| Standalone / shell | 4 | 3 | 1 | Mieterportal has no home |
| **Total** | **63** | **40** | **23** | **23 legacy pages have no home yet** |

The prototype is strongest exactly where its hero apps are (Unterbringung, Objektbetrieb, Büroausrüstung) and weakest in **Produktion** and **Beschaffen** — the two areas with no micro-app behind them. That is a defensible prototype scope, but it should be stated rather than implied: the catalogue demonstrates the *pattern*, it does not yet contain the *inventory*.

### D.3 Staff intranet (unchanged, from the 2026-06 analysis)

| Today (where it lived) | New home |
|------------------------|----------|
| Staff intranet → Fachanwendungen | App launcher under **Daten und Digitalisierung** + Domains A/B |
| Staff intranet → Themen → Sicherheit | Domain **G. Sicherheit & Notfall** (service `sicherheitsvorfall-melden`) |
| Staff intranet → Personal und Ausbildung | Domain **H. Personal** (staff) |
| Staff intranet → Das BBL | footer / "Über das BBL" |
| Staff intranet → SUPERB (ERP program) | **Wissen und Hilfsmittel**; clusters map into Domains A–H |
| Staff intranet → Support@BIL / HBB | Domain **E. Beschaffung** |
| Staff intranet → News / Intranews | **News** (own L1 per §2.1) |
| Public site → Bautendokumentationen / Mediendatenbank | **Daten und Digitalisierung → Dokumentenarchiv / Mediathek** |
| Forms & templates | **Wissen und Hilfsmittel → Vorlagen** (§2.5) |
| eGate, InfoPers, PERIMAP, Admin-Directory | external systems — linked from home quick-links & footer |

**Notably retired/merged:** the split between "staff intranet" and "Kundenplattform"; the standalone "Departement" menu (becomes audience-tagged content + footer switcher); duplicate news entry points.

