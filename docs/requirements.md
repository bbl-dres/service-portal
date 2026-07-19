# BBL Service Portal — Requirements

> **Status:** Draft v1 for discussion · **Date:** 2026-06-15
> **Companion to:** [sitemap.md](sitemap.md) (information architecture) · **Part of:** [platform-vision.md](platform-vision.md) · **Source analysis:** [bbl-intranet/](../bbl-intranet/)
> **Phase:** Requirements only — no implementation yet. Tech stack is deliberately deferred (sitemap §7.5).

This document specifies *what* the prototype must do, prioritized so the convincing-clickable-prototype scope (**Must/Should**) is clearly separated from full-product ambitions (**Could/Won't-yet**).

---

## 1. Purpose & background

The BBL (Bundesamt für Bauten und Logistik / Federal Office for Buildings and Logistics) intranet today is split across **three sites** plus ~12 external systems, organized by org-chart and topic rather than by task (see [sitemap.md §1](sitemap.md)). This prototype demonstrates a **single, service-oriented portal** — an internal counterpart to the public site [www.bbl.admin.ch](https://www.bbl.admin.ch/de) — that lets users find and start the things they actually need to *do*.

The prototype is a **demonstrator for BBL stakeholders**, not a production system. Its job is to make the target experience tangible and to validate the IA from the sitemap.

---

## 2. Goals & success criteria

| # | Goal | Success looks like |
|---|------|--------------------|
| G1 | **One front door** | A user reaches any service from a single home page via search or ≤2 clicks. |
| G2 | **Service-first** | The most common actions (fault report, order, incident report, IT request) are findable as named "services", not buried in content. |
| G3 | **Self-service + status** | A user can start a request and see it appear in "Meine Anfragen". |
| G4 | **Consolidation is legible** | A stakeholder can see how today's three sites map into one (sitemap §6). |
| G5 | **On-brand & credible** | Looks and feels like a Swiss Confederation / admin.ch product. |

**Headline demo scenario** (the vertical slice we optimize for): *A facility manager lands on Home, searches "Störung", starts a Störungsmeldung (fault report), submits it, and sees it tracked under Meine Anfragen.*

---

## 3. Non-goals

- Not a production system; **no real backend, SSO, or live data**.
- Not a content-migration exercise — we model structure with representative sample content.
- Not replacing the specialist applications (GIS IMMO, SAP/SUPERB, E-Shop, etc.) — the portal *links to / launches* them.
- No new visual identity — we adopt the existing admin.ch / CD Bund design language.

---

## 4. Audiences & personas

Confirmed scope: **unified** portal (sitemap §3, §7).

| Persona | Audience | Primary needs |
|---------|----------|---------------|
| **Petra – Customer (other federal office)** 🟦 | Consumes BBL services | Order supplies, report a building fault, request publications, request space. |
| **Marco – BBL staff (facility/operations)** 🟩 | Runs BBL services | Same services + specialist apps, internal news, processes. |
| **Sara – BBL staff (HR/admin)** 🟩 | Internal | HR/onboarding info, forms & templates, org info. |
| **All** ⬛ | Both | Search, news, emergency info, security/incident reporting, knowledge base. |

Personalization beyond audience tagging is a **Could** (see FR-HOME-05).

---

## 5. Scope

**In scope (prototype):** Home/Dashboard · Servicekatalog (all 8 domains as pages; representative depth) · at least **one fully working service request flow** end-to-end · Meine Anfragen · Wissen & Dokumente (one library populated) · Aktuelles (list + detail) · Über/Hilfe (static) · global search · responsive layout · DE content.

**Out of scope (prototype):** real auth, real integrations, full content, FR/IT content translation, write-back to any real system, analytics. (See sitemap §8.)

---

## 6. Functional requirements

Priorities: **M** = Must (prototype), **S** = Should, **C** = Could (later), **W** = Won't (this prototype).
"Mock" = realistic sample data / client-side only, no server.

### 6.1 Global navigation & chrome

| ID | Requirement | Pri |
|----|-------------|-----|
| FR-NAV-01 | Persistent global header: BBL logo/home link, global search, primary nav (the 6 task areas), language switcher, login/profile, Notfall (emergency) shortcut. | M |
| FR-NAV-02 | Primary nav = 6 areas: **Home · Servicekatalog · Meine Anfragen · Wissen & Dokumente · Aktuelles · Über das BBL / Hilfe**. | M |
| FR-NAV-03 | Servicekatalog exposes its 8 domains (sitemap §4 A–H) via a dropdown/mega-menu or a catalog landing grid. | M |
| FR-NAV-04 | Breadcrumb (Seitenpfad) on all sub-pages, reflecting the new IA. | S |
| FR-NAV-05 | Footer with "Wechseln zu" switchers (other EFD offices, departments, public site, eGate) + standard admin.ch footer links (Impressum, Datenschutz, Barrierefreiheit, Rechtliches). | S |
| FR-NAV-06 | Audience tags (🟦/🟩/⬛) visible on domains/services so users see what applies to them. | C |

### 6.2 Search

| ID | Requirement | Pri |
|----|-------------|-----|
| FR-SRCH-01 | Prominent global search on Home framed as "Was benötigen Sie?" (What do you need?). | M |
| FR-SRCH-02 | Search returns **services first**, then content/docs/news, with type labels and result counts. | M |
| FR-SRCH-03 | Search over the prototype's static content index (client-side); no external search backend. | M |
| FR-SRCH-04 | Type-ahead suggestions for popular services. | C |

### 6.3 Home / Dashboard

| ID | Requirement | Pri |
|----|-------------|-----|
| FR-HOME-01 | Search-first hero (FR-SRCH-01). | M |
| FR-HOME-02 | "Beliebte Services" — tiles for the top transactional services (sitemap §5). | M |
| FR-HOME-03 | "Meine offenen Anfragen" widget summarizing the user's requests (links to Meine Anfragen). | M |
| FR-HOME-04 | "Aktuelles" teaser (Intranews BBL + EFD) and a persistent "Notfall" box with emergency numbers. | M |
| FR-HOME-05 | "Direkt zu" quick links (canteen menu, eGate, BIT Support, Admin-Directory…) + Fachanwendungen app-launcher. | S |
| FR-HOME-06 | Dashboard adapts to selected audience/role (Customer vs Staff view). | C |

### 6.4 Servicekatalog (catalog)

| ID | Requirement | Pri |
|----|-------------|-----|
| FR-CAT-01 | Catalog landing page listing the 8 domains with icon, title, short description, and audience tag. | M |
| FR-CAT-02 | Each domain page lists its services/sub-pages, visually distinguishing **⭐ services (actions)** from **information pages**. | M |
| FR-CAT-03 | Each service has a detail page: what it is, who it's for, what you need, and a clear primary call-to-action ("Antrag starten" / "Zum E-Shop" / "Melden"). | M |
| FR-CAT-04 | Services that are really external systems link out clearly marked (↗) and open appropriately. | S |
| FR-CAT-05 | Normalized, canonical naming — one name per service/app (resolve label inconsistencies, sitemap §1.4). | M |
| FR-CAT-06 | Filter/sort the catalog (by domain, by audience, services-only vs all). | C |

### 6.5 Service request flows (the ⭐ services)

| ID | Requirement | Pri |
|----|-------------|-----|
| FR-REQ-01 | At least **one** service implemented end-to-end as a multi-step form → confirmation. Recommended: **Störungs-/Reparaturmeldung** (fault report). | M |
| FR-REQ-02 | Form includes validation, a review/confirm step, and a success screen with a mock reference number. | M |
| FR-REQ-03 | Submitting creates an entry visible in Meine Anfragen (see §6.6 decision D1). | M |
| FR-REQ-04 | 2–3 additional services stubbed (form layout shown, may not fully submit): E-Shop order, BANF (IT requirement), Sicherheitsvorfall melden. | S |
| FR-REQ-05 | Forms reuse a common, accessible field/component pattern. | S |

### 6.6 Meine Anfragen (My Requests)

| ID | Requirement | Pri |
|----|-------------|-----|
| FR-MINE-01 | List of the user's requests with type, date, reference, and status (offen / in Bearbeitung / erledigt). | M |
| FR-MINE-02 | Pre-seeded with sample requests so the page is populated on first visit. | M |
| FR-MINE-03 | New submissions (FR-REQ-03) appear here. **Persistence model = decision D1.** | M |
| FR-MINE-04 | Request detail view with a simple status timeline. | S |
| FR-MINE-05 | Filter by status / type. | C |

### 6.7 Wissen & Dokumente (Knowledge & Documents)

| ID | Requirement | Pri |
|----|-------------|-----|
| FR-DOC-01 | One document library implemented with category accordions + search/filter (model: Bautendokumentationen). | M |
| FR-DOC-02 | "Formulare & Vorlagen" listed as a cross-cutting library. | S |
| FR-DOC-03 | Demos & Lernvideos section (e.g. BVML demos) as a media list. | C |
| FR-DOC-04 | **Dokumentenarchiv (Bauwerksdokumentation):** query documents & plans **per building** — filter by building/project, type, year; download. | M |
| FR-DOC-05 | **Mediathek:** real-estate media library — gallery + faceted search (type/date/building/period) + asset detail (preview, metadata, copyright, multi-resolution download). Ref: mediathek.admin.ch. | S |
| FR-DOC-06 | **Weisungen & Vorgaben:** categorized, filterable directives catalog (by topic / issuing body / type / status); entry detail with code, type, validity, PDF; cross-linked from the services it governs. Ref: bk.admin.ch/de/vorgaben. | M |

### 6.8 Aktuelles (News)

| ID | Requirement | Pri |
|----|-------------|-----|
| FR-NEWS-01 | News list with thumbnails, dates, and source (BBL / EFD); search + date filter; pagination. | M |
| FR-NEWS-02 | News detail page. | S |

### 6.9 Über das BBL / Hilfe & Kontakt

| ID | Requirement | Pri |
|----|-------------|-----|
| FR-ABT-01 | Static "Über das BBL" pages (org, strategy, sustainability, location). | S |
| FR-ABT-02 | Kontakt page with domain-specific contacts (dres@bbl, isbo@bbl, Support@BIL…). | M |
| FR-ABT-03 | Portal feedback affordance. | C |

### 6.10 Anwendungen & Daten (new surfaces — detailed in [prototype-plan.md §4](prototype-plan.md))

| ID | Requirement | Pri |
|----|-------------|-----|
| FR-APP-01 | **Anwendungen** — software/application overview: card grid (icon/screenshot, name, short description, audience tag, access note, link), grouped (BBL-Fachanwendungen · Plattform-Apps · Zentrale Systeme). Ref: Fachanwendungen + BLW /anwendungen. | M |
| FR-APP-02 | Light filter by group/audience; links resolve to a micro-app, a wiki page, or an external system (↗). | S |
| FR-DATA-01 | **Daten** — Datenbezug landing: thematic dataset cards (Liegenschaften, Bauprojekte, Gebäude/Flächen, Energie, Dokumente/Pläne, Standards, Geodaten) linking deeper. Ref: BLW /datenbezug. | M |
| FR-DATA-02 | **Datenkatalog** (DCAT): browse data products by domain; detail = description, owner, format, Distribution (download), linked Data Service/API, Concepts/code-lists. Ref: I14Y / agrarmarktdaten.ch. | M |
| FR-DATA-03 | Optional dashboard tile (counts / a small chart) on the Daten landing for data-platform flavor. | C |

---

## 7. Content requirements

- **Representative, not complete.** Each of the 8 domains gets a real landing page; depth concentrated where it supports the demo scenario.
- **Realistic German labels** from the source intranet (keep authentic terminology; normalize duplicates per FR-CAT-05).
- **Sample data:** ~6–10 seeded requests for Meine Anfragen; ~10 news items; ~10–15 documents in the one populated library; canteen/quick-link targets may be placeholder.
- **Imagery/icons:** use admin.ch-style iconography and neutral placeholder imagery; do not hotlink production assets.

---

## 8. Non-functional requirements

| ID | Area | Requirement | Pri |
|----|------|-------------|-----|
| NFR-DS-01 | **Design system** | Adopt the Swiss Confederation Corporate Design / admin.ch design language (typography, color, grid, components) for visual credibility. | M |
| NFR-A11Y-01 | **Accessibility** | Target **WCAG 2.1 AA**, in line with Swiss federal requirements (BehiG; eCH-0059). Semantic HTML, keyboard operability, visible focus, alt text, sufficient contrast. | M |
| NFR-A11Y-02 | Accessibility | Forms have proper labels, error messaging, and ARIA where needed. | S |
| NFR-LANG-01 | **Multilingual** | DE is the content language. Language switcher (DE/FR/IT) is **present**; FR/IT behavior per decision D2. | M |
| NFR-RESP-01 | **Responsive** | Usable on desktop, tablet, mobile (mobile-friendly nav). | M |
| NFR-PERF-01 | **Performance** | Fast first load; prototype-appropriate (no heavy assets); lazy-load long lists/images. | S |
| NFR-SEC-01 | **Auth/security** | Login is **mocked** (a profile/role toggle); no real credentials, no PII. | M |
| NFR-BROWSER-01 | **Browser support** | Current Edge, Chrome, Firefox, Safari. | S |
| NFR-MAINT-01 | **Maintainability** | Content/sample data kept in clearly separated, editable structures so stakeholders' edits are easy. | S |

---

## 9. Constraints & assumptions

- **Prototype, demonstrator-grade.** Correctness of flows and IA matters more than production-hardening.
- **No production data or credentials** are used; all content is sample/synthetic.
- **External systems are linked, not rebuilt.** Where a "service" is really eGate/InfoPers/E-Shop/SAP, the portal hands off (marked ↗).
- **Design system availability:** assumes we can approximate CD Bund / admin.ch styling from public design tokens/components; exact internal component libraries may not be available.
- Tech stack is **not yet chosen** (sitemap §7.5); these requirements are stack-agnostic.

---

## 10. Open decisions (proposed defaults)

These remain open; proposed defaults let requirements stay concrete. Confirm or override.

| ID | Decision | Proposed default | Why |
|----|----------|------------------|-----|
| **D1** | Meine Anfragen persistence | **Client-side state** for the session (new submissions appear; resets on reload), on top of seeded samples. | Shows the self-service loop convincingly without a backend; keeps the prototype shareable. |
| **D2** | FR/IT language switcher | **Present but stubbed** — switches UI chrome labels if cheap, otherwise shows a "nur DE im Prototyp" notice. | Signals multilingual intent without the cost of translating content. |
| **D3** | Number of fully-built service flows | **1 end-to-end (fault report)** + 2–3 stubbed. | Concentrates effort on one credible vertical slice. |
| **D4** | Which document library to populate | **Bautendokumentationen** (144-PDF accordion model). | Best existing pattern; visually rich. |

---

## 11. Prioritized prototype scope (summary)

**Must-have walking skeleton:** Global nav (6 areas) + search → Home dashboard → Servicekatalog (8 domain pages) → one end-to-end service flow → Meine Anfragen → one document library → Aktuelles list → Kontakt. On-brand, responsive, accessible (AA target), DE content, mocked login.

**Should-have if time allows:** breadcrumbs, footer switchers, stubbed extra services, news detail, request detail timeline, forms & templates library.

**Could/later:** personalized dashboard, catalog filtering, type-ahead search, audience-tag UI, demos/media library, FR/IT content.

---

## 12. Glossary

| Term | Meaning |
|------|---------|
| **BBL** | Bundesamt für Bauten und Logistik — Federal Office for Buildings and Logistics |
| **EFD** | Eidgenössisches Finanzdepartement — Federal Department of Finance (BBL's parent) |
| **Kundenplattform** | The current BBL customer service platform (`intranet.bbl.admin.ch`) |
| **Servicekatalog** | Service catalog — the portal's core, domains A–H |
| **Fachanwendungen** | Specialist business applications (GIS IMMO, DALA/FileNET, CDE, EDM, EHP, FLM, PVA, QualityGate) |
| **BANF** | Bedarfsmeldung — IT requirement/procurement request |
| **SUPERB** | Federal SAP S/4HANA ERP transformation programme |
| **eGate** | Federal SSO / self-service portal |
| **CD Bund** | Corporate Design of the Swiss Confederation |
| **⭐ service** | A transactional self-service action (vs. an information page) |
