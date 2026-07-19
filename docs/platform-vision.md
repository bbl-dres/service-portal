# BBL Unified Service Platform — Vision & Concept

> **Status:** Draft v1 for discussion · **Date:** 2026-06-15 · **Working title:** "BBL Plattform"
> **Scope:** The north-star concept that unifies the BBL intranet redesign *and* the existing domain prototypes into **one process-oriented platform**.
> **Sits above:** [sitemap.md](sitemap.md) & [requirements.md](requirements.md) — those describe the *portal shell & service directory* layer of this larger picture.

---

## 1. The idea in one paragraph

Today BBL's digital landscape is a set of **silos**: three intranet sites (see [sitemap.md §1](sitemap.md)) plus five standalone domain prototypes, each re-implementing the same building/portfolio data and each with its own ad-hoc status tracking. The vision is to collapse them into **a single, process-oriented platform** — *a wiki and a service directory that open microservices, which in turn drive a process engine (Camunda) that manages every process's steps and status.* On top sit the cross-cutting overviews everyone keeps asking for (real-estate portfolio, construction projects, document/floor-plan search) and an **internal data catalog** (DCAT, an i14y for internal data). Modeled on the **Canton Aargau Smart Service Portal** for structure and the **federal I14Y platform** for the data catalog.

---

## 2. The problem: five silos + three intranets

The five prototypes we analyzed each solve a real BBL problem well — but in isolation, each with its own copy of the core data and its own lifecycle logic:

| Prototype | What it is | Audience | Has workflow? | Re-implements building data? |
|-----------|-----------|----------|---------------|------------------------------|
| **[tenant-portal](../../tenant-portal/)** (Mieterportal) | Self-service space requests, tenancy mgmt, fault reports for ~2,800 properties | External tenants + internal reviewers | ✅ Strong — Application pipeline, 3 BPMN-compatible variants, audit trail | ✅ buildings/floors/spaces GeoJSON |
| **[property-inventory](../../property-inventory/)** (Liegenschaften-Inventar) | GIS portfolio inventory + write workflows + a "GIS server" backend | Internal staff/stewards | ✅ Strong — Change-Request state machine, four-eyes, roles | ✅ canonical `DATAMODEL.json` |
| **[transaction-portal](../../transaction-portal/)** (Transaction Immo) | Sale/divestment of federal real estate | Internal PFM + external brokers | ✅ 7-milestone sales lifecycle with role hand-offs | ✅ Verkaufsobjekt model |
| **[workspace-management](../../workspace-management/)** | Furniture shop, circular reuse, occupancy & space planning, floor-plan editor | Internal staff | ⚠️ Status vocabularies (Order/Inventory/Listing), no engine | ✅ Site→Building→Floor→Room→Workspace |
| **[ppm-cockpit](../../ppm-cockpit/)** (PM-Cockpit) | Construction project & portfolio dashboard | Internal PM/PMO | ⚠️ SIA-phase lifecycle + Ampel, display-only | ✅ project + building model |

**The pattern (and the opportunity):**
- **Same core data, five times over.** Every prototype carries its own buildings/portfolio dataset keyed on the same Swiss identifiers (`egid`, `egrid`, `bbl_we` / Wirtschaftseinheit, SIA 416 areas, BKP costs). There is **no single source of truth**.
- **Same shape of process, five times over.** Each has a draft → submit → review → approve → done lifecycle with statuses, but expressed as bespoke JS. Two are already explicitly "BPMN-compatible."
- **Same building blocks, five times over.** All are vanilla-JS static SPAs using MapLibre, static JSON, and a Swiss-Confederation-style design system (tenant-portal and workspace-management track `swiss/designsystem` / CD Bund most closely). Several already draft **OpenAPI specs** and **data dictionaries**.

So the prototypes aren't throwaway — they are **the modules of the unified platform**, waiting to be connected through a shared core, a shared process engine, and a single front door.

---

## 3. Reference models

**A. [Canton Aargau Smart Service Portal](https://www.ag.ch/de/smartserviceportal)** — the structural model for the *front door*. Its navigation is the template:
- **Übersicht** (dashboard) · **Dienstleistungen** (service directory) · **Meine Vorgänge** (my cases / running processes) · **Meine Dokumente** (my documents) · **Hilfe & Infos** — behind a login, personalized per user/organization.
- Key idea we adopt: a **service directory that launches guided online processes**, and **"Meine Vorgänge"** as the place to track their status. This is exactly "service directory → microservice → process engine."

**B. [Federal I14Y Interoperability Platform](https://www.i14y.admin.ch/de/home)** — the model for the *data catalog*. I14Y is a central metadata catalog of Swiss public-sector data and interfaces, built on **DCAT-AP CH 2** ([handbook](https://i14y-ch.github.io/handbook/en/2_rollen_prozesse/informationmodel/)). Its core classes:
- **Catalog** → **Dataset** (data collections) · **Data Service** (APIs/interfaces) · **Distribution** (concrete representations, e.g. CSV/GeoJSON); extended with **Public Service**; data **structures & concepts** described via SHACL.
- We want **the same, but for BBL-internal data only** — a registry that makes the shared core's datasets, the prototypes' APIs, and shared code-lists (SIA categories, BKP, NAW classes, status enums) discoverable.

---

## 4. Internal vs. external services (a defining distinction)

The platform serves two sides of the same processes — this is the internal/external split the Smart Service Portal makes explicit:

- **🟦 External (front-office) services** — for BBL's *customers*: employees of other federal offices. They *request* things: space, office supplies, publications, fault repairs, IT equipment. Today scattered across the Kundenplattform.
- **🟩 Internal (back-office) services** — for *BBL staff* running the operation: manage the portfolio, run construction projects, approve change requests, handle divestments, plan workspace. Today = the five prototypes.

**The crucial insight: most processes cross the line.** A customer's external *space request* should trigger an internal *review/approval* workflow, which may spawn a *construction project* and a *workspace plan*, all touching the same building record and documents. Today those are five disconnected tools and a manual hand-off. In the unified platform they are **one process** spanning front and back office — which is precisely why a **process engine** is the backbone, not an afterthought.

Every entry in the service directory is therefore **tagged internal / external / both**, and routed to the right audience while sharing the same process spine.

---

## 5. Architecture — the building blocks

```
┌──────────────────────────────────────────────────────────────────────────┐
│  A. PORTAL SHELL  (single front door · CD Bund design · search · i18n · login) │
│     Übersicht · Dienstleistungen · Meine Vorgänge · Meine Dokumente ·          │
│     Wissen (Wiki) · Datenkatalog · Hilfe                                       │
└──────────────────────────────────────────────────────────────────────────┘
        │                 │                  │                    │
        ▼                 ▼                  ▼                    ▼
┌───────────────┐ ┌────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ B. WIKI /     │ │ C. SERVICE     │ │ D. MICROSERVICES │ │ G. DATA & API    │
│   KNOWLEDGE   │ │   DIRECTORY    │ │  (micro-frontends)│ │   CATALOG (DCAT) │
│  (read mode)  │ │ internal/ext.  │ │  the 5 prototypes │ │  i14y-internal   │
│  intranet     │ │  tagged; each  │ │  as modules:      │ │  datasets · APIs │
│  content,     │─┼─▶ launches a   │─┼─▶ space request,  │ │  · concepts/     │
│  guides,      │ │  microservice  │ │  inventory, sales,│ │  code-lists      │
│  processes    │ │  or a doc      │ │  workspace, PPM…  │ │                  │
└───────────────┘ └────────────────┘ └──────────────────┘ └──────────────────┘
                                              │                     ▲
                                              ▼                     │
                          ┌──────────────────────────────┐         │
                          │ E. PROCESS ENGINE (Camunda)   │         │
                          │  BPMN processes · user tasks  │         │
                          │  status · approvals · 4-eyes  │         │
                          │  → powers "Meine Vorgänge" +  │         │
                          │    reviewer task inboxes      │         │
                          └──────────────────────────────┘         │
                                              │                     │
                                              ▼                     │
                  ┌──────────────────────────────────────────────┐ │
                  │ F. SHARED DOMAIN CORE  (single source of truth)│─┘
                  │  Building/Portfolio registry (egid·egrid·we) · │
                  │  Floors/Rooms/Spaces (GeoJSON) · Projects ·    │
                  │  Documents/Floor-plans · Contacts · Costs      │
                  └──────────────────────────────────────────────┘
   Cross-cutting: identity (eIAM/AGOV) · CD Bund design system · search · i18n (DE/FR/IT)
```

**A. Portal shell** — the unified front door. This is the work already specced in [sitemap.md](sitemap.md) / [requirements.md](requirements.md), with the nav extended toward the Smart-Service-Portal model (add **Meine Vorgänge**, **Meine Dokumente**, **Datenkatalog**).

**B. Wiki / knowledge base** — the "read" layer: today's intranet content, process descriptions, guides, FAQs. The service directory links into it; it explains the things the services *do*.

**C. Service directory (Dienstleistungen)** — the catalog of everything BBL offers, each item tagged internal/external and pointing either to content (wiki) or to a **microservice** (a guided process). The normalized service inventory from [requirements.md §5/§6](requirements.md) is the seed.

**D. Microservices / micro-frontends** — focused task UIs. **The five prototypes become these modules.** A micro-frontend approach lets us absorb them incrementally rather than rewrite.

**E. Process engine (Camunda)** — the backbone. Every non-trivial service is a **BPMN process**: steps, user tasks, approvals (incl. four-eyes), timers, notifications, and a single status model. It powers **"Meine Vorgänge"** (the requester's view of their running instances) and the **task inboxes** reviewers use. The prototypes' existing state machines map directly onto BPMN definitions (see §7).

**F. Shared domain core** — the single source of truth the prototypes currently duplicate: one **Building/Portfolio registry** (keyed on `egid`/`egrid`/`bbl_we`), Floors/Rooms/Spaces, Projects, Documents & floor plans, Contacts, Costs. Every module reads/writes here instead of carrying its own copy. Exposed as APIs (the prototypes' draft OpenAPI specs are the starting contracts).

**G. Data & API catalog (DCAT)** — the internal I14Y: a registry that makes the shared core's **datasets**, the modules' **data services/APIs**, and shared **concepts/code-lists** discoverable, documented, and governed.

---

## 6. The "common features everyone asks for" → platform surfaces

These cross-cutting overviews are not new builds — they are **views over the shared core (F)**, surfaced in the portal shell:

| Requested feature | Fed by | Becomes |
|-------------------|--------|---------|
| **Real-estate portfolio overview** | property-inventory (map/list/gallery) + shared core | A portal-level **Portfolio** view |
| **Current construction projects** | ppm-cockpit | A **Projekte (laufend)** view + project microservice |
| **Finished construction projects** | ppm-cockpit (status=Abgeschlossen) + Bautendokumentationen | A **Projekte (abgeschlossen)** / project archive |
| **Query documents & floor plans** | tenant-portal plans&docs + workspace floorplan-editor | A **Dokumente & Pläne** search over the core document repository |
| **Software/application overview** | Fachanwendungen + [BLW /anwendungen](https://www.blw.admin.ch/de/anwendungen) | The **Anwendungen** section — grouped app card-grid |
| **Data catalog (APIs & data products)** | new (DCAT) + prototypes' OpenAPI specs & data dictionaries | The **Daten** section — BLW-style Datenbezug landing + i14y/agrarmarktdaten-style catalog (block G) |

---

## 7. How the prototypes map in

| Prototype | Role in the unified platform | Highest-value reusable assets |
|-----------|------------------------------|-------------------------------|
| **tenant-portal** | External space-request microservice + tenancy mgmt; reference for the **portal shell** (best CD-Bund alignment) | `swiss/designsystem` UI kit; 1,500-line `DATAMODEL.md`; BPMN-ready Application pipeline (standard/bypass/greenfield); eIAM stub |
| **property-inventory** | Portfolio overview + the **shared-core data steward**; `prototype-backend` is a natural **data-catalog/data-product hub** | Canonical `DATAMODEL.json`; Change-Request state machine + four-eyes role matrix; swisstopo/GeoJSON pipeline; "Maps & Apps" registry |
| **transaction-portal** | Internal divestment microservice | 7-milestone lifecycle w/ role responsibilities; Verkaufsobjekt model w/ valuations, documents[], events[] |
| **workspace-management** | Furniture-order + circular-reuse + occupancy microservices; **floor-plan viewer/editor** for the document/plan feature | CD-Bund design system; `openapi.yaml` (Swagger); Site→Building→Floor→Room→Workspace model; 2D/3D/walk floor-plan editor |
| **ppm-cockpit** | Construction-project overview + project microservice | Self-describing `data.json` (meta dictionary → catalog seed); SIA-phase/Ampel/risk model; `MARKETSCREEN.md` market scan |

Two cross-cutting reuse decisions fall out of this:
1. **Design system:** standardize on `swiss/designsystem` / CD Bund (tenant-portal & workspace-management already do).
2. **Process definitions:** the four existing state machines (tenant Application, property-inventory CR, transaction milestones, workspace order) are the **first BPMN diagrams** for Camunda.

---

## 8. Process-orientation — a worked example

*A space request that crosses front office, back office, and every layer:*

1. **Discover** — A customer at another federal office opens **Dienstleistungen** (C), filters to 🟦 external, finds *"Raumbedarf melden."* The linked **Wiki** (B) page explains eligibility and what's needed.
2. **Do** — They launch the **space-request microservice** (D, from tenant-portal): a guided wizard with live NAW classification and area calc.
3. **Orchestrate** — Submitting starts a **Camunda process** (E) — the standard pipeline (GS review → PFM review → decision). The customer now sees it in **Meine Vorgänge**; reviewers get **user tasks** in their inbox.
4. **Decide & branch** — On approval the process can spawn a **construction project** (ppm-cockpit module) and/or a **workspace plan** (workspace-management module) — same process, new sub-tasks.
5. **Single source of truth** — Throughout, the building record, floor plans and documents come from the **shared core** (F); the new project appears automatically in the **Portfolio** and **Projekte** overviews (§6).
6. **Discoverable** — The datasets and APIs touched are registered in the **Datenkatalog** (G), so the next team can find and reuse them.

One request, one process, one data source — instead of five tools and a manual hand-off.

---

## 9. Tech & design considerations (concept-level; stack still deferred)

- **Micro-frontend composition** so the existing prototypes can be absorbed incrementally (embed → integrate → consolidate), not big-bang rewritten.
- **Camunda** (BPMN 2.0; v8/Zeebe or v7) as the process engine; Tasklist-style user-task inboxes; Operate-style monitoring. Prototypes' state machines are the seed BPMN models.
- **Shared core as services/APIs** — promote the duplicated JSON into one data layer; the drafted OpenAPI specs become the real contracts.
- **DCAT-AP CH 2** vocabulary for the internal catalog, mirroring I14Y (Dataset / Data Service / Distribution / Concept).
- **Identity:** eIAM / AGOV (mocked in the prototype, per [requirements NFR-SEC-01](requirements.md)).
- **Design system:** CD Bund / `swiss/designsystem`, WCAG 2.1 AA, DE/FR/IT.
- For the **prototype**, none of this needs to be real — Camunda and the shared core can be *mocked* (client-side state) to demonstrate the experience, as already proposed in [requirements §10 D1](requirements.md).

---

## 10. Suggested phasing (thinking, not commitment)

1. **Front door + one crossing process.** Portal shell + service directory + wiki + **Meine Vorgänge**, with one external service (space request or fault report) running end-to-end through a *mocked* process engine. (≈ the [requirements.md](requirements.md) slice, extended with Meine Vorgänge.)
2. **Overviews over a shared core.** Stand up a single mock building/portfolio dataset; surface the **Portfolio** and **Construction-projects** overviews (from property-inventory + ppm-cockpit) reading from it.
3. **Data catalog.** A DCAT-style **Datenkatalog** over the shared core's datasets + the prototypes' API specs + shared code-lists.
4. **More microservices + real orchestration.** Absorb workspace, transaction, inventory modules; introduce real Camunda; add internal back-office workflows (CR, divestment).

---

## 11. Decisions

**✅ Resolved (2026-06-15) — detailed in [prototype-plan.md §1](prototype-plan.md):**

| # | Decision | Resolution |
|---|----------|------------|
| V1 | Prototype scope | **Demo the whole concept** at demo depth (shell + directory + apps + data + one crossing process). |
| V2 | Process engine | **Mocked** client-side; no real Camunda in the demo. |
| V3 | Absorb vs. embed | **Copy prototypes into new `apps/` folders and adapt** — originals untouched, not embedded. |
| V4 | Repo strategy | **Single repo** with a shared layer + separate micro-app folders. |
| V5 | Shared core | **Yes** — one canonical mock building/portfolio dataset as the backbone. |

**⏳ Still open:**

| # | Decision | Notes |
|---|----------|-------|
| — | **Tech stack** | Vanilla static SPA (recommended, matches the prototypes) vs Vue/Nuxt — see [prototype-plan.md §8](prototype-plan.md). |
| V6 | **Platform name** | "BBL Plattform" / "BBL Service Portal" / something else. |

---

## 12. Glossary (additions)

| Term | Meaning |
|------|---------|
| **Camunda** | Open-source BPMN process-orchestration / workflow engine; runs the steps, tasks and status of each process |
| **BPMN** | Business Process Model and Notation — the standard for modeling processes Camunda executes |
| **Micro-frontend** | An independently built UI module composed into a shell — lets the prototypes be absorbed incrementally |
| **DCAT / DCAT-AP CH** | W3C Data Catalog Vocabulary and its Swiss application profile — the metadata model behind I14Y |
| **Data product** | A curated, documented, discoverable dataset or API published in the catalog |
| **Vorgang** | A running process instance ("case") a user can track in *Meine Vorgänge* |
| **Shared core** | The single source of truth for buildings, portfolio, projects, documents — replacing the per-prototype copies |
| **egid / egrid / Wirtschaftseinheit (bbl_we)** | Swiss federal building / parcel / SAP RE-FX economic-unit identifiers shared by all prototypes |

---

**Sources:** [Canton Aargau Smart Service Portal](https://www.ag.ch/de/smartserviceportal) · [I14Y Interoperability Platform](https://www.i14y.admin.ch/de/home) · [I14Y handbook — information model](https://i14y-ch.github.io/handbook/en/2_rollen_prozesse/informationmodel/) · [I14Y handbook — glossary](https://i14y-ch.github.io/handbook/de/glossar/)
