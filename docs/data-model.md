# BBL Platform Demo — Shared Data Model

> **Status:** Draft v1 for discussion · **Date:** 2026-06-15 · **Planning only — not a build.**
> **Part of:** [platform-vision.md](platform-vision.md) (block F = shared core, block G = data catalog) · **Build context:** [prototype-plan.md §5/§7](prototype-plan.md)

This defines **one canonical data model** for the demo — the single source of truth (block F) that every section and micro-app reads from, replacing the five separate copies the prototypes carry today. It also defines the **platform entities** (services, applications, processes, news) and the **data-catalog model** (block G) that exposes all of it.

It is a *synthesis* of the data models already in the prototypes (`property-inventory/DATAMODEL.json`, `tenant-portal/DATAMODEL.md`, `workspace-management/DATAMODEL.md`, `ppm-cockpit` `data.json` meta, `transaction-portal`), normalized to remove the duplication.

---

## 1. Principles

- **One core, many views.** Buildings/projects/documents live **once**; apps and overviews are views over them.
- **Join on the real Swiss keys.** Everything links through the federal identifiers all five prototypes already share — so the silos *can* merge:
  - **`bbl_we`** — Wirtschaftseinheit (SAP RE-FX economic unit) — the primary business key linking buildings, tenancies, projects, costs.
  - **`egid`** — federal building register (GWR) id · **`egrid`** — federal parcel id.
  - **`bbl_id`** — internal surrogate PK per object.
- **Standards-anchored.** Areas per **SIA 416** (GF/HNF/NGF), costs per **BKP** (Baukostenplan 0–9), project phases per **SIA/HERMES**, space classes per **NAW** (Neue Arbeitswelten). These become the catalog's **Concepts/code-lists**.
- **Mock, but shaped right.** Static JSON/GeoJSON in `data/`, but with realistic fields so the model is credible and reusable.

---

## 2. Core entities (the single source of truth)

| Entity | DE | Key fields (abridged) | Geometry | Synthesized from |
|--------|----|-----------------------|----------|------------------|
| **Building** | Gebäude | `bbl_id` (PK), `bbl_we`, `egid`, designation, address, region/canton, `portfolioCategory`, `buildingStatus`, buildYear, areas (GF/HNF/NGF), lat/lng | Point + footprint | all 5 (property-inventory is richest: 67 fields) |
| **Parcel** | Grundstück | `egrid`, `bfs_gemnr`, `kgs_nr`, area, owner | Polygon | property-inventory |
| **Floor** | Geschoss | `floorId`, buildingId, level, name | Polygon | tenant-portal, workspace |
| **Space** | Raum / Fläche | `spaceId`, floorId, `siaCategory`, useType, area, capacity, `isBookable` | Polygon | tenant-portal (459), workspace |
| **Project** | Bauprojekt | `projectId`, `projectNumber`, buildingId, name, `siaPhase` (11–61), `projectStatus`, PM, plannedTotalCost, `kostenBkp`, milestones, `risiken` (Ampel) | — (via building) | ppm-cockpit, transaction |
| **Tenancy** | Mietverhältnis | `tenancyId`, `ve`, buildingId, spaceIds[], hnf2, leaseStart/End, yearlyCost, contacts{pfm,im,flm} | — | tenant-portal |
| **Document** | Dokument / Plan | `docId`, type (Floorplan/Lease/Permit/Valuation/CAD…), `linkedTo[]`, format, url, uploadedBy/at | — | tenant-portal, transaction, workspace |
| **Asset** | Inventar/Mobiliar | `assetId`, spaceId, productId, `inventoryStatus`, inventoryNumber | — | workspace (61 items) |
| **Contact** | Kontakt | `contactId`, name, role, email (dres@, isbo@, PFM…) | — | all |
| **Media** | Foto / Video | `mediaId`, mediaType (photo/video), title, `buildingId?`/`projectId?`, date, `historicPeriod?`, photographer, copyright/licence, url, thumbnail, resolutions[] | — | NEW (Mediathek) |

**Relationships:** `Parcel 1—* Building` (egrid) · `Building 1—* Floor 1—* Space` · `Building 1—* Project` (current vs finished via `projectStatus`) · `Building 1—* Tenancy *—* Space` · `Document *—1 {Building|Project|Space}` (polymorphic `linkedTo`) · `Asset *—1 Space` · `Media *—1 {Building|Project}` (powers the Mediathek + a building's photo gallery). All roll up to **`bbl_we`**.

---

## 3. Reference data / code-lists (→ catalog Concepts)

Shared enumerations, defined **once** and reused everywhere (filters, badges, the catalog's Concepts):

- **SIA-Kategorien** (416 area types) · **BKP-Hauptgruppen** (0–9) · **NAW-Klassen** (6 workplace classes, deskSharingFactor 0.8)
- **Portfolio-Kategorien** (Teilportfolios: Verwaltung, Zoll, …) · **SIA-Phasen** (11 Strategische Planung → 61 Betrieb)
- **Status-Enums:** `projectStatus` (Geplant/Aktiv/Sistiert/Abgeschlossen/Abgebrochen) · `buildingStatus` · `orderStatus` · `inventoryStatus` · `vorgangStatus` (see §4)
- **constructionTypes · bimLevels · Ampel** (grün/gelb/rot)

---

## 4. Platform entities

These power the portal surfaces and the mock engine.

| Entity | Purpose | Key fields |
|--------|---------|-----------|
| **Service** (Dienstleistung) | A service-directory entry | `serviceId`, title, domain (A–H), **audience** (internal/external/both), **type** (⭐action / info), target (app route / wiki / external ↗), `processDefId?` |
| **Application** (Anwendung) | A software-overview card | `appId`, name, **group** (Fachanwendung / Plattform-App / Zentrales System), description, icon/screenshot, audience, accessNote, link |
| **ProcessDefinition** | Mock-engine process (BPMN-ish) | `defId`, name, `serviceId`, `steps[]` {id, name, role, kind: user/auto} — lifted from the prototypes' state machines |
| **ProcessInstance / Vorgang** | A running case (→ Meine Vorgänge) | `instanceId`, defId, requester, **status**, currentStep, `history[]` (audit), `linkedEntities` (building/project), createdAt, reference no. |
| **Task** | A reviewer's to-do (→ task inbox) | `taskId`, instanceId, assigneeRole, name, status |
| **NewsArticle** | News (home widget + archive) | `id`, title, date, source (BBL/EFD), teaser, body, image |
| **Directive** (Weisung/Vorgabe) | Weisungen catalog (Wissen) | `directiveId`, code, title, type (Weisung/Richtlinie/Verordnung/Vorgabe), topic, issuingBody, status (in Kraft/aufgehoben), validFrom, validUntil?, version, summary, documentUrl, `relatedServices[]`/`relatedDomains[]` |

**Seed process definitions** (from the prototypes):
- *Raumbedarf* — `draft → submitted → review_gs → review_pfm → approved → in_project → closed` (+ clarification / rejected) — *tenant-portal*
- *Störungsmeldung* — `gemeldet → triage → in_arbeit → erledigt` — *tenant-portal / Kundenplattform*
- *Datenmutation (Change Request)* — `DRAFT → SUBMITTED → IN_REVIEW → APPROVED → APPLIED` (four-eyes) — *property-inventory*
- *Verkauf/Divestment* — 7 milestones (BBL PFM → Makler → BBL) — *transaction-portal*
- *Möbelbestellung* — `Entwurf → Übermittelt → In Bearbeitung → Geliefert → Abgeschlossen` — *workspace-management*

---

## 5. Data-catalog model (block G — DCAT, internal)

The **Daten** section is a DCAT-AP-CH-shaped registry over everything above. Four classes (mirroring [I14Y](https://www.i14y.admin.ch/de/home)):

| DCAT class | What it holds here | Examples (from this demo) |
|------------|--------------------|---------------------------|
| **Dataset** | A core dataset | *Liegenschaften/Gebäude*, *Bauprojekte*, *Flächen & Räume*, *Dokumente & Pläne*, *Energiedaten* |
| **Distribution** | A concrete download of a dataset | `buildings.geojson`, `projects.csv`, `spaces.geojson` |
| **Data Service** | An API/interface | the apps' OpenAPI specs: `workspace api/v1`, `transaction api`, `property-inventory backend` |
| **Concept** | A code-list / taxonomy | SIA-Kategorien, BKP, NAW-Klassen, Status-Enums (§3) |

Each **DataProduct** record: `id`, `dcatClass`, title, description, **owner** (Datenverantwortliche/r), domain, format, `distributions[]` {format, url}, `apiRef?`, `conceptRefs[]`, updated date. → `data/data-products.json`.

So the catalog isn't a separate dataset to invent — it is **generated from the core + the code-lists + the apps' API specs**, which is exactly what makes "an internal i14y" believable.

---

## 6. Mock files in `data/` (what we'll author)

| File | Entity | ~Records for the demo |
|------|--------|----------------------|
| `buildings.geojson` | Building (+ footprint) | 10–15 real Bern landmarks, fictional values |
| `parcels.geojson` | Parcel | matching subset |
| `floors.geojson` / `spaces.geojson` | Floor / Space | a few floors for 1–2 buildings |
| `projects.json` | Project | 8–10 (mix current + finished) |
| `tenancies.json` | Tenancy | 5–8 |
| `documents.json` | Document | 15–20 (incl. floor plans) |
| `media.json` | Media | 20–30 photos/videos (incl. historic) |
| `services.json` | Service | full directory (≈ requirements §5/§6) |
| `applications.json` | Application | ~20 (Fachanwendungen + Plattform-Apps + Zentrale Systeme) |
| `data-products.json` | DataProduct | ~15 (datasets + services + concepts) |
| `news.json` | NewsArticle | ~10 |
| `weisungen.json` | Directive | ~15–20 (by topic) |
| `process-definitions.json` / `process-instances.json` | Process | 5 defs + ~8 seeded Vorgänge |
| `reference-data.json` | code-lists | the §3 enumerations |

---

## 7. Open questions

| # | Question |
|---|----------|
| DM1 | Reuse one prototype's dataset as the seed for `buildings.geojson` (property-inventory is richest) and extend it, or author fresh? |
| DM2 | Demo language for data labels — DE only, or carry the prototypes' DE/FR/IT/EN field labels? |
| DM3 | How "real" should the data-catalog API entries be — link to the prototypes' actual `openapi.yaml` files, or describe them abstractly? |
| DM4 | Energy data (Energiedatenmanagement) — include a small dataset, or list it as a catalog entry only? |
