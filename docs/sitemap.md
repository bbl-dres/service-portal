# BBL Service Portal — Sitemap & Information Architecture

> **Status:** Draft v1 for discussion · **Date:** 2026-06-15
> **Part of:** the [Unified Platform Vision](platform-vision.md) — this doc details the *portal shell & service directory* layer.
> **Goal:** An intranet *service portal* for the Bundesamt für Bauten und Logistik (BBL / Federal Office for Buildings and Logistics) — an internal counterpart to the public site [www.bbl.admin.ch](https://www.bbl.admin.ch/de), but organized around **services and tasks** rather than org structure.
> This document defines the target information architecture **before** we build the prototype. It is based on an analysis of the current intranet captured in [bbl-intranet/](../bbl-intranet/).

---

## 1. What we're starting from (the current state)

The downloaded intranet confirms the brief: it is *scattered and chaotic*. Concretely, what looks like "the intranet" is actually **three different websites on three hostnames**, plus a dozen external systems, tied together only by links.

| # | "Site" | Hostname | Platform | Organized by | Audience |
|---|--------|----------|----------|--------------|----------|
| 1 | **Staff intranet** (EFD-BBL) | `intranet.efd-bbl.admin.ch` | Classic AEM, 10-item mega-menu | BBL org & topics | BBL employees |
| 2 | **Kundenplattform BBL** (customer platform) | `intranet.bbl.admin.ch/de` | **Nuxt + CD Bund** (relaunched since this doc was written — see §1b) | BBL *services* (the closest thing to a service portal today) | BBL's internal customers (other federal offices) |
| 3 | **Public website** | `www.bbl.admin.ch` | Newer Nuxt/Vue SPA | BBL's offerings to the world | Public / industry |

On top of these sit numerous **separate applications**: eGate (SSO), InfoPers (HR), PERIMAP/ILIAS (learning), Admin-Directory, BIT Kundenplattform, the E-Shop, plus 8 construction-specific apps (GIS IMMO, DALA/FileNET, CDE, EDM, EHP, FLM, PVA, QualityGate).

### Why it feels chaotic — the structural problems

1. **No single front door.** A user must already know *which of the three sites* hosts what they need.
2. **Two competing taxonomies.** The staff intranet sorts by *org/topic* (News, Personal, Themen, Das BBL, SUPERB…); the Kundenplattform sorts by *service domain* (Bauprojekte, Objektbetrieb, Büroausrüstung, Beschaffen…). The same thing often appears in both, named differently.
3. **Services are buried.** Genuine self-service actions (report a fault, order supplies, report a security incident, submit an IT requirement) are scattered as deep links inside content pages — not presented as "services" you can find and start.
4. **Inconsistent labels.** e.g. the same app is "FLM Info-App" in one place and "Flächenmanagement (FLM)" in another.
5. **Mixed audiences in one nav.** BBL-only, EFD-wide ("Departement"), and customer-facing content share the same menus.
6. **Content vs. transaction mixed together.** Explanatory pages and actionable services sit at the same level with no distinction.

### What's genuinely good (worth keeping)

- The **Kundenplattform's service-domain taxonomy** is the right backbone for a service portal.
- The **Fachanwendungen** page is already a clean app catalog (icon + name + description + link).
- Reusable UI patterns already exist: searchable/date-filtered news lists, accordion document libraries (144 Bautendokumentationen PDFs), right-column contact boxes.
- The admin.ch / Swiss Confederation **design system** gives us a consistent visual language to build on.

---

## 1b. Current sitemap — as captured 2026-07-23

**Source:** saved page `Bestellen (E-Shop).html` from `https://intranet.bbl.admin.ch/de/bestellen-e-shop`.
**Platform:** Nuxt, rendered with the **official CD Bund design system** (`top-bar-navigation`, `meta-navigation`, `main-navigation--desktop`, `navy__*` drawers, `breadcrumb-navigation`).

> **This supersedes part of §1.** The Kundenplattform is no longer the AEM tile site described above — it has been relaunched on CD Bund at `intranet.bbl.admin.ch/de`, and it uses the *same* component vocabulary this prototype now targets. The IA problems below are therefore genuinely structural, not styling artefacts.

### The tree

```
Kundenplattform BBL   ·   intranet.bbl.admin.ch/de
│
├── Top bar ......................... Jobs · Bundespublikationen · Kontakt
├── Meta navigation ................. (present in markup, empty)
│
├── Main navigation (8 items)
│   ├── Unterbringung ............... /de/unterbringung
│   ├── Objektbetrieb ............... /de/objektbetrieb
│   ├── Büroausrüstung .............. /de/bueroausruestung
│   │   ├── Bestellen (E-Shop) ...... /de/bestellen-e-shop
│   │   ├── Büromaterial ............ /de/bueromaterial
│   │   ├── EDV-Verbrauchsmaterial .. /de/edv-verbrauchsmaterial
│   │   ├── Bürotechnik ............. /de/buerotechnik
│   │   ├── Informatik-Sortiment .... /de/informatik-sortiment
│   │   ├── Mobiliar ................ /de/mobiliar
│   │   └── Hausdienstmaterial ...... /de/hausdienstmaterial
│   ├── Produktion .................. /de/produktion
│   ├── Publikationen ............... /de/publikationen
│   ├── Informatik .................. /de/informatik
│   ├── Beschaffen .................. /de/beschaffen
│   └── Mieterportal ................ /de/mieterportal          ← external system in the content nav
│
├── Other pages reached from content ... Reklamationsmeldung · Kontakt
└── Footer .......................... AGB des Bundes · Rechtliches · Barrierefreiheit
```

### Structural problems

1. **URLs are flat; the hierarchy is fake.** The breadcrumb claims `Startseite › Büroausrüstung › Bestellen (E-Shop)`, but every page sits at `/de/<slug>`. Nesting exists only in the menu config, so it cannot be relied on, linked to, or reasoned about.
2. **Catalogue and entry point are siblings.** "Bestellen (E-Shop)" sits at the same level as the six product categories it is the way *into*. A user cannot tell whether to click the action or the category.
3. **Eight top-level items, and they are not one kind of thing.** Object types (Büroausrüstung, Publikationen), a lifecycle stage (Unterbringung, Objektbetrieb), a verb (Beschaffen), and a *system* (Mieterportal) share one bar. CD's own guidance is *"try to limit main menus to 5"* (`MainNavigation.vue:162`).
4. **Organised by internal administrative structure, not by task.** The ordering page is split into **"Kreis 1 + 2"** vs **"Kreis 3"** — the user must first work out which administrative circle their office belongs to before they can order a pen.
5. **Four jobs on one page.** `Bestellen (E-Shop)` is simultaneously: shop access, a registration process (PDF form), an FAQ ("Einkaufshilfe"), and a contact directory.
6. **The action is buried in prose.** The two shop links sit inside body copy, below explanation. There is no primary call to action.
7. **Process leaks into content.** "Speichern Sie die Links bitte nicht als Favoriten ab. Dies kann Zugriffsprobleme verursachen." — a workaround for a technical defect, published as user instructions, twice.
8. **The registration path is a dead end.** Access to the Kreis-3 shop is a downloadable PDF form; nothing in the portal tracks that request.

### Page-level defects (the E-Shop page as a specimen)

| | Finding |
|---|---|
| **Two `<h1>`** | "Bestellen (E-Shop)" and "Inhalt teilen" — the share widget competes with the page title |
| **4 empty headings** | heading tags with no text, which break heading navigation |
| **Repeated headings** | "Wichtige Anmerkungen:" ×2, "Weiterführende Informationen" ×2, "Kontakt" ×2 — ambiguous in a heading list |
| **Trailing colons in headings** | "Wichtige Anmerkungen:" — headings are labels, not sentence stems |
| **TOC at the bottom, and incomplete** | "Inhaltsverzeichnis" is rendered *after* the content and lists only 2 of the 4 `h2` sections |
| **Duplicated body copy** | the identical "Wichtige Anmerkungen" paragraph appears verbatim under both Kreis sections |
| **18 PDF links** | Browserverlauf, Neues Passwort, Anmeldeformular — instructions and forms shipped as documents rather than as portal functions |

---

## 1c. Proposed improvement — draft for discussion

The current tree mixes **object types**, **lifecycle stages**, **verbs** and **systems** at one level. The prototype's answer is to separate those into distinct axes:

- **what you want to do** → Dienstleistungen (the service catalogue)
- **what you want to use** → Anwendungen (systems, incl. Mieterportal and the shops)
- **what you want to read/find** → Dokumente & Medien, Wissen, Daten
- **what you already started** → Meine Vorgänge

Applied to this branch, `Bestellen (E-Shop)` stops being a page *about* ordering and becomes a **service** that starts a Vorgang:

```
Dienstleistungen › Büroausrüstung & Arbeitsplatz
└── Material bestellen                      ← one entry, audience-tagged, starts a Vorgang
    ├── (routing replaces "Kreis 1+2 / Kreis 3": the portal knows the user's office
    │    and sends them to the right shop — the administrative circle is never surfaced)
    ├── Sortiment: Büromaterial · EDV-Verbrauchsmaterial · Bürotechnik ·
    │              Informatik-Sortiment · Mobiliar · Hausdienstmaterial   ← the catalogue, one level down
    ├── Zugang beantragen                   ← replaces the PDF form; becomes a tracked Vorgang
    └── Einkaufshilfe                       ← moves to Wissen (FAQ), linked from the service
```

**Open questions for the next pass**

1. Is "Kreis 1+2 / Kreis 3" derivable from the logged-in user, or must it stay a user choice?
2. Do the six Sortiment pages carry real content, or are they shop deep-links? (Decides whether they are portal pages or app entry points.)
3. Should `Mieterportal` remain in the main nav, or move to **Anwendungen** with the other systems?
4. Which of the 8 current top-level items are genuinely top-level for *customers*, and which are staff-facing?

---

## 2. Design principles for the service portal

A *service portal* answers **"What do you want to do?"** — not "Where in the org chart does this live?". The redesign applies five principles:

1. **Service-first, task-oriented.** The primary navigation is a **service catalog** grouped by domain. Every entry is either a *service* (an action you can start) or *information* (something you can read) — and the two are visually distinguished.
2. **One front door.** A single home/dashboard with **search-first** entry and the most-used services one click away. Federate the three current sites behind it.
3. **Self-service & status.** Surface the real transactional actions (orders, fault reports, requests, incident reports) as first-class "services", and give users a **"My Requests"** view to track them — the hallmark of a service portal.
4. **Consistent, normalized vocabulary.** One canonical name per service/app. Plain-language labels with the German term primary (DE) and English glosses for this design doc only.
5. **Audience-aware, not audience-fragmented.** Keep one portal, but let domains/services carry an audience tag (Customer / Staff / Both) and optionally personalize the dashboard, instead of splitting into separate sites.

---

## 3. Audience model

The portal serves two overlapping audiences. The IA below holds both; the difference is mostly *which services* a person uses and what the dashboard surfaces.

- **🟦 Customers** — employees of *other* federal offices who consume BBL's services (buildings, office supplies, IT procurement, publishing, moves). This is today's *Kundenplattform* audience and the strongest "service portal" fit.
- **🟩 Staff** — BBL's own employees, who additionally need HR, org, internal news, and the specialist construction applications.
- **⬛ Both** — shared services (security/incident reporting, emergency, news, forms & templates, knowledge base).

> **✅ Confirmed (2026-06-15):** build the *unified* model above (Customers + Staff in one portal, domains audience-tagged) — not a customers-only scope.

---

## 4. Proposed sitemap (target information architecture)

> **Note (2026-06-15, rev 2):** the primary nav has evolved for the unified-platform demo. Top level: **Übersicht · Dienstleistungen · Anwendungen · Dokumente & Medien · Daten · Wissen · Meine Vorgänge.** Key calls: the big operational tools (**Liegenschaften Inventar** = real-estate portfolio overview, **Bauprojekte / EPPM**) are *hero apps* — listed in the **Anwendungen** launcher (Immobilien & Bau group) **and** surfaced directly on the dashboard; the building **Dokumentenarchiv** (Bauwerksdokumentation) and a real-estate **Mediathek** get their own **Dokumente & Medien** area; all apps are re-skinned to one **CD Bund** design system; **Wissen** also hosts a **Weisungen & Vorgaben** directives catalog. See [prototype-plan.md §3](prototype-plan.md). The tree below stays the detailed IA; new sections are folded in.

Global chrome on every page: **Logo/Home · Global search · Service catalog · My Requests · Language (DE/FR/IT) · Login/Profile · persistent Emergency (Notfall) shortcut.**

```
BBL Service Portal
│
├── 🏠 Home / Dashboard
│     ├── Global service search ("Was benötigen Sie?" / "What do you need?")
│     ├── Beliebte Services (popular/most-used service tiles)
│     ├── Meine offenen Anfragen (my open requests — widget)
│     ├── Aktuelles (Intranews BBL + EFD teasers)
│     ├── Notfall (emergency numbers — always visible)
│     ├── Direkt zu (quick links: canteen menu, eGate, BIT Support, Admin-Directory…)
│     └── Fachanwendungen-Launcher (app shortcuts)
│
├── 🧰 Servicekatalog  (Service Catalog — the core)
│     │
│     ├── A. Bauten & Bauprojekte  🟦🟩  (Construction & Building Projects)
│     │     ├── Raumbedarf & bauliche Bedürfnisse melden   ⭐service
│     │     ├── Bauprojekt-Informationen
│     │     ├── Standards & Nachhaltiges Bauen
│     │     ├── Leistungsverrechnung & Preiskatalog
│     │     ├── Bautendokumentationen        → Wissen & Dokumente
│     │     └── Kunst am Bau · Wettbewerbe
│     │
│     ├── B. Immobilien & Gebäudebetrieb  🟦🟩  (Real Estate & Building Operations)
│     │     ├── Störungs-, Reinigungs- & Reparaturmeldung   ⭐service
│     │     ├── Umzüge, Transport & Entsorgung               ⭐service
│     │     ├── Reklamationsmeldung (complaint)              ⭐service
│     │     ├── Objektbewirtschaftung & Betrieb
│     │     ├── Dienstleistungskatalog
│     │     └── Mieterportal / FLM Info-App
│     │
│     ├── C. Büroausrüstung & Arbeitsplatz  🟦🟩  (Office Equipment & Workplace)
│     │     ├── E-Shop / Online-Shop bestellen              ⭐transaction
│     │     ├── Büromaterial · Mobiliar · Bürotechnik
│     │     ├── EDV-Verbrauchsmaterial · Hausdienstmaterial
│     │     └── Informatik-Sortiment
│     │
│     ├── D. Informatik & Arbeitsgeräte  🟦🟩  (IT & Work Devices)
│     │     ├── Bedarfsmeldung "BANF"                        ⭐service
│     │     ├── IKT-Beschaffung des BBL
│     │     ├── Mustervorlagen IKT · Rahmenverträge · Werkzeugkasten · Delegationen
│     │     ├── Microsoft 365 (M365)
│     │     └── BIT Support ↗ (external)
│     │
│     ├── E. Beschaffung  🟦🟩  (Procurement)
│     │     ├── Einstieg & Übersicht
│     │     ├── WTO-Verfahren
│     │     ├── Beratungs-Support KBB (Kompetenzzentrum Beschaffung Bund)
│     │     ├── Vorlagen & Formulare
│     │     ├── Dokumente der BKB (AGB, Weisungen, Richtlinien)
│     │     ├── Beschaffungs-Controlling
│     │     └── HBB – Harmonisierte Beschaffungslösung Bund (Support@BIL) ↗
│     │
│     ├── F. Publizieren, Drucken & Versenden  🟦🟩  (Publishing, Printing & Dispatch)
│     │     ├── Bundespublikationen bestellen                ⭐transaction
│     │     ├── Publikationen neu erstellen
│     │     ├── Digital Druck
│     │     └── Versenden / Produktion
│     │
│     ├── G. Sicherheit & Notfall  ⬛  (Security & Emergency)
│     │     ├── Sicherheits-/Datenschutzvorfall melden       ⭐service
│     │     ├── Integrale Sicherheit BBL (overview)
│     │     ├── Informatiksicherheit · Informationsschutz · Datenschutz
│     │     ├── Physische Sicherheit & Notfallorganisation
│     │     └── Notfallnummern
│     │
│     └── H. Personal & Arbeiten beim BBL  🟩  (HR & Working at BBL — staff)
│           ├── Onboarding
│           ├── Aus- & Weiterbildung (PERIMAP/ILIAS) ↗
│           ├── Stellenplattform / Offene Stellen ↗
│           ├── InfoPers ↗ · Formulare DLZ Pers ↗
│           ├── Personalentwicklung · Berufsbildung · Führung & Zusammenarbeit
│           └── Frauennetzwerk · Sozialpartnerschaft · Ideenmanagement & KVP
│
├── 🧩 Anwendungen  (Software overview / launcher — lists every app; see prototype-plan §4.1)
│     ├── Immobilien & Bau
│     │     ├── Liegenschaften Inventar  ★ (real-estate portfolio overview)
│     │     ├── Bauprojekte / EPPM  ★ (construction project & portfolio mgmt)
│     │     └── Fachanwendungen: GIS IMMO · DALA/FileNET · CDE · EHP · FLM · EDM · PVA · QualityGate
│     ├── Arbeitsplatz & Logistik (Workspace · E-Shop · Möbel & Circular …)
│     └── Zentrale Systeme (eGate · InfoPers · SAP/SUPERB · Admin-Directory ↗)
│        (★ = hero app: full micro-app, also surfaced on the dashboard)
│
├── 📂 Dokumente & Medien  (building content archives — see prototype-plan §4.4)
│     ├── Dokumentenarchiv / Bauwerksdokumentation
│     │     └── query documents & plans for *every building* (Document entity)
│     └── Mediathek (real-estate photos & videos incl. historic — ref mediathek.admin.ch)
│
├── 📊 Daten  (Data platform + catalog — see prototype-plan §4.2)
│     ├── Datenbezug (thematic dataset landing — BLW-style)
│     └── Datenkatalog (DCAT: Datasets · Data Services/APIs · Concepts — i14y-style)
│
├── 📋 Meine Anfragen  (My Requests / "Meine Vorgänge" in the platform vision)
│     └── Status-Tracking across all services: offen / in Bearbeitung / erledigt
│         (faults, orders, BANF requirements, incidents, complaints)
│
├── 📚 Wissen  (Knowledge / Wiki + governance reference)
│     ├── Weisungen & Vorgaben  ★ (directives catalog — ref bk.admin.ch/de/vorgaben)
│     ├── Formulare & Vorlagen (forms & templates — cross-cutting library)
│     ├── Anleitungen · FAQ · Prozesse (guides, processes)
│     └── Demos & Lernvideos (BVML-Demos, HBB-Lernvideos)
│        (Bautendokumentationen & Mediathek now live under "Dokumente & Medien")
│
├── 📰 Aktuelles  (News)
│     ├── Intranews BBL
│     ├── Intranews EFD
│     ├── Direktionsflash
│     ├── Medienmitteilungen / Medienhinweise (admin.ch)
│     └── SUPERB-Programm (ERP-Transformation: News & Kontext)
│
├── ℹ️ Über das BBL  (About BBL)
│     ├── Organigramm · Wir sind das BBL
│     ├── Strategie & Jahresziele · Nachhaltigkeit · Standort
│     └── Mitarbeitendenvertretung
│
└── ❓ Hilfe & Kontakt  (Help & Contact)
      ├── Kontakt (by domain: dres@bbl, isbo@bbl, Support@BIL…)
      ├── Hilfe / Support
      └── Feedback zum Portal

Footer / "Wechseln zu" (switch to):
  · Andere EFD-Ämter (BIT, EPA, EFV, ESTV, BAZG, GS-EFD, SIF)
  · Andere Departemente (BK, EDA, EDI, EJPD, VBS, WBF, UVEK)
  · Öffentliche Website www.bbl.admin.ch ↗ · eGate ↗ · Admin-Directory ↗
```

**Legend:** ⭐ = transactional self-service · ↗ = external system · 🟦 Customer · 🟩 Staff · ⬛ Both · "→" = primary content lives elsewhere, cross-linked.

---

## 5. Service inventory (the actionable "services")

These are the real self-service actions scattered across today's sites, pulled to the surface as first-class catalog items. In the prototype, each becomes a request flow (can be mocked) that feeds **My Requests**.

| Service | Domain | Today's location |
|---------|--------|------------------|
| Störungs-, Reinigungs- & Reparaturmeldung (fault/repair report) | B | Kundenplattform → Objektbetrieb |
| Umzüge / Transport / Entsorgung (move request) | B | Kundenplattform → Objektbetrieb |
| Reklamationsmeldung (complaint) | B | Kundenplattform → Kontakt |
| E-Shop / Online-Shop Bestellung (order office goods) | C | Kundenplattform → Büroausrüstung |
| Bedarfsmeldung "BANF" (IT requirement request) | D | Kundenplattform → Informatik |
| Bundespublikationen bestellen (order publications) | F | Kundenplattform / public shop |
| Sicherheits-/Datenschutzvorfall melden (report incident) | G | Staff intranet → Themen → Sicherheit |
| Raumbedarf / bauliche Bedürfnisse melden (space request) | A | Kundenplattform → Bauliche Bedürfnisse |

---

## 6. Old → New mapping (consolidation)

How today's scattered structure folds into the new IA:

| Today (where it lives) | New home |
|------------------------|----------|
| Staff intranet → *Themen und Hilfsmittel* → Fachanwendungen | Home **App-Launcher** + Domain A/B (the 8 apps) |
| Staff intranet → *Themen* → Sicherheit | Domain **G. Sicherheit & Notfall** |
| Staff intranet → *Personal und Ausbildung* | Domain **H. Personal & Arbeiten beim BBL** |
| Staff intranet → *Das BBL* | **Über das BBL** |
| Staff intranet → *SUPERB* (ERP program) | **Aktuelles → SUPERB**; its clusters map into Domains A–H |
| Staff intranet → *Support@BIL* / HBB | Domain **E. Beschaffung** |
| Staff intranet → *News* / Intranews | **Aktuelles** |
| Kundenplattform → all service categories | **Servicekatalog** (Domains A–F) — the backbone |
| Public site → Bautendokumentationen / Downloads / Mediendatenbank | **Wissen & Dokumente** |
| Forms & templates (Formulare DLZ, Vorlagen CD Bund…) | **Wissen & Dokumente → Formulare & Vorlagen** |
| eGate, InfoPers, PERIMAP, Admin-Directory, BIT KP | **External systems** — linked from Home quick-links & footer |

**Notably retired/merged:** the artificial split between "staff intranet" and "Kundenplattform"; the standalone "Departement" (EFD-wide) menu (becomes audience-tagged content + footer switcher); duplicate news entry points.

---

## 7. Decisions

**✅ Confirmed (2026-06-15):**

1. **Audience scope** → **Unified** portal (Customers + Staff, §3), domains audience-tagged. Not customers-only.
2. **Top-level breadth** → **6 task areas** (Home · Servicekatalog · Meine Anfragen · Wissen · Aktuelles · Über/Hilfe), with the 8 service domains nested under the catalog.

**⏳ Still open (proposed defaults in [requirements.md](requirements.md)):**

3. **"My Requests" realism.** Mock with static sample data, or make request forms actually create/track entries (client-side state)?
4. **Language.** German only, or stub the DE/FR/IT switcher?

**⏸️ Deferred — not building yet:**

5. **Tech stack for the prototype.** Decide when we move from requirements to build.

---

## 8. Out of scope (for the prototype)

- Real authentication / SSO (eGate) — login is mocked.
- Live data from backend systems (E-Shop, SAP/SUPERB, InfoPers) — content is sample/static.
- Full content migration — we model the *structure*, with representative sample pages per domain.
- FR / IT translations of content (switcher may be stubbed).

---

## 9. Next steps

1. ✅ Confirm audience scope & top-level structure (done — §7).
2. **▶ Define requirements** — see [requirements.md](requirements.md) (current focus; no build yet).
3. *(Later)* Low-fidelity wireframes for the **Home/Dashboard** and one **service flow** (e.g. fault report → Meine Anfragen).
4. *(Later)* Choose the prototype stack and scaffold it with the admin.ch design language.
5. *(Later)* Build Home + Servicekatalog + one end-to-end service as a vertical slice.
