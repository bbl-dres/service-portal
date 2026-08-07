# Target Architecture — Layer Model

> **Status:** Draft v1 for discussion · **Date:** 2026-08-07 · **Scope:** the intended layer architecture of the production platform.
> **Detail and rationale:** [production-architecture.md](production-architecture.md) · **Product north star:** [platform-vision.md](platform-vision.md) · **Entities:** [data-model.md](data-model.md)
> The current repository is a **mockup** validating user feedback. This document describes what it becomes, not what it is.

---

## 1. The one rule

**Layers have independent lifecycles and are replaced independently.** Every layer here will outlive or predecease its neighbours: the frontend follows design-system cycles, the process engine follows a vendor decision, the systems of record follow SAP roadmaps, the AI layer may never be built at all.

Independence is only real if it is enforced. Three rules make it so:

1. **A layer talks to adjacent layers through a published contract** — OpenAPI, SQL/PostgREST, BPMN, or a system's own API. Never past a neighbour, never into a neighbour's internals.
2. **Each layer has a "must not contain" list** (§3). Violations of that list are what make replacement expensive later, and they are invisible until you try.
3. **Verticals are enforced at a named layer**, not implemented everywhere (§4). A cross-cutting concern with no owner becomes eight inconsistent implementations.

---

## 2. The picture

```
                                                    ┌── VERTICALS ────────────┐
  ┌───────────────────────────────────────────────┐ │                         │
  │ 1  PRESENTATION                               │ │  Identity & access      │
  │    portal · CD Bund · a11y · URL state        │ │  (eIAM roles)           │
  ├───────────────────────────────────────────────┤ │                         │
  │ 2  EXPERIENCE & DOMAIN  (BFF)                 │ │  Observability          │
  │    session · API · domain rules               │ │  (logs·metrics·traces)  │
  ├────────────────────────────┬──────────────────┤ │                         │
  │ 3  PROCESS                 │ 5  AI  (post-MVP)│ │  Audit trail            │
  │    BPMN · tasks · 4-eyes   │    retrieval ·   │ │                         │
  │    deadlines · escalation  │    summarisation │ │  Metadata & docs        │
  ├────────────────────────────┴──────────────────┤ │                         │
  │ 4  DATA                                       │ │  Localization DE/FR/IT  │
  │    PostgreSQL · PostGIS · RLS · search        │ │                         │
  │    read models (cache) + own write models     │ │  Notification           │
  ├───────────────────────────────────────────────┤ │                         │
  │ 6  INTEGRATION                                │ │  Compliance             │
  │    adapters · ingestion · outbound writes     │ │  (records · privacy)    │
  ├───────────────────────────────────────────────┤ │                         │
  │ 7  SYSTEMS OF RECORD                          │ │  Security & secrets     │
  │    RE-FX · ePPM · GEVER · AdminDir · GWR/AV   │ │                         │
  └───────────────────────────────────────────────┘ └─────────────────────────┘
```

**Layer 3 sits beside layer 5, not above it.** Both are consumers of layer 4 and callable from layer 2. The AI layer is drawn inside the box to make one point: it is *additive*. Cutting it out must leave every other layer untouched — that is its acceptance criterion.

---

## 3. Horizontal layers

| # | Layer | Owns | Contract upward | Must **not** contain |
|---|---|---|---|---|
| 1 | **Presentation** | Rendering, routing, URL-as-state, accessibility, design system | — | Authorization decisions · business rules · copies of reference data |
| 2 | **Experience & domain** (BFF) | Session, eIAM token exchange, response shaping, domain rules that are neither orchestration nor storage | REST / OpenAPI | Process state · long-running logic · direct system-of-record calls |
| 3 | **Process** | BPMN definitions and instances, user tasks, deadlines, escalation, four-eyes | Engine API, wrapped by layer 2 | Domain **data** — only references (`bbl_id`, `projectId`, `tenancyId`) |
| 4 | **Data** | Read models of the masters, own write models, RLS policies, geometry, search index | SQL / PostgREST | Process state · business rules that belong to layer 2 |
| 5 | **AI** *(post-MVP)* | Retrieval, summarisation, question answering | REST, strictly additive | Its own permission model · any source-of-truth role |
| 6 | **Integration** | Adapters, ingestion, mapping, outbound writes, scheduling, error handling and replay | Internal only — never called by layer 1 | Business decisions — mapping and transport only |
| 7 | **Systems of record** | The truth | Their own APIs | Not ours to define |

### 3.1 Presentation

Consumes layer 2 only. The mockup's route contract survives: declarative route data needs, teardown hooks, navigation-scoped staleness guards, URL-as-state, and the deep-link redirect table. So does its failure semantics — *empty* and *unavailable* must remain distinguishable in every view, because no framework gives you that by default.

Replaceability rests on the URL contract and the existing browser test suites, which assert behaviour rather than internals.

### 3.2 Experience & domain (BFF)

Exists for three reasons, in this order: eIAM session handling and token minting; a stable API contract that shields the frontend from schema churn; and a home for domain logic that is neither process nor storage — capacity and area calculation, NAW classification, cross-aggregate validation, view composition.

Without this layer that logic scatters into RLS policies, frontend code and BPMN service tasks, and then no layer can be replaced. It stays thin: no state of its own.

### 3.3 Process

The engine is a **deliberate replacement candidate** — the vendor decision is open (Operaton, Flowable, jBPM/Kogito). Two rules keep that option alive: model in **portable BPMN 2.0** without vendor extensions, and keep process variables as **references, never copies** of domain data. The second rule matters more; it is also what stops the engine from becoming a second, stale data store.

The deployed models are the same artefacts the portal renders as process documentation, so execution and documentation cannot drift.

### 3.4 Data

Self-hosted **PostgreSQL + PostGIS**, with Supabase as the developer surface (SQL editor, schema and policy inspection). The platform underneath is standard Postgres — that is what makes this layer cheap to replace.

Two distinct kinds of content, and the distinction is architectural:

- **Read models** — cached projections of the systems of record. Rebuildable by definition. Never written to directly.
- **Own write models** — workspace planning, room booking, catalogue and editorial content, entitlement scoping. This is the data the platform is actually master of.

Authorization is enforced here by **row-level security**, driven by eIAM role claims (§4.1). Search is Postgres full-text with `unaccent` folding, which keeps permission filtering inside the same policies rather than in a second system with a second access model.

### 3.5 AI *(post-MVP, optional)*

Question answering over knowledge, services and catalogue content; summarisation of cases and documents. Three constraints, all non-negotiable:

- **It inherits the permission model.** Retrieval is filtered by the same eIAM roles and RLS predicates at query time. A retrieval index built without them is the fastest way to leak classified data.
- **It is never a source of truth.** Answers cite sources and link into the portal; the platform's facts stay in layer 4.
- **It is removable.** If deleting this layer requires changes elsewhere, the boundary was drawn wrong.

Embeddings live in the same Postgres (`pgvector`), so no new system and no second copy of the corpus. Model hosting follows federal sovereignty constraints — an open decision (§5).

### 3.6 Integration

Everything crossing the boundary to systems that are not ours: scheduled extracts or CDC from RE-FX and ePPM, GEVER document exchange, Admin-Directory lookups, outbound writes routed from the process layer, and live geo services consumed rather than copied.

Owns the unglamorous parts that decide whether the cache is trustworthy: mapping and normalisation, **rejects that are visible rather than silently dropped**, retry and replay, and a stated freshness SLA per feed. Mapping only — no business decisions.

### 3.7 Systems of record

The masters stay where they are. The platform is a consumer, and writes travel back through the process layer, never straight into a master. Declaring this explicitly is the difference between an integration project and a migration project.

| Data | Master |
|---|---|
| Building · Parcel · Wirtschaftseinheit · Areas · Mietobjekt/Mietvertrag | SAP RE-FX |
| Construction projects | SAP ePPM |
| Documents and records | GEVER |
| Persons and organisational units | Admin-Directory / InfoPers |
| `egid` · `egrid` | GWR · AV/Grundbuch |
| Base maps, addresses, cadastre | swisstopo / geo.admin.ch (live) |

---

## 4. Verticals

| Vertical | Why it cannot live in one layer | Enforced at | MVP |
|---|---|---|---|
| **Identity & access** | Every layer needs the caller's identity and rights | Layer 2 mints · layer 4 enforces (RLS) · layer 3 maps to candidate groups | ✅ |
| **Observability** | A request crosses every layer; a correlation id must survive the whole path | All layers, one convention | ✅ |
| **Audit trail** | Business facts arise in process *and* data | Layers 3 + 4, append-only store | ✅ |
| **Metadata & documentation** | Describes all layers: datasets, APIs, BPMN models, code lists, lineage | Own store, published (DCAT-AP CH 2 / OpenAPI) | ✅ |
| **Localization DE/FR/IT** | Every layer produces user-visible text | Layer 2 resolves; layers 1/3/4 carry keys, not strings | ✅ scaffolding |
| **Notification** | Triggered by process, delivered by a service, rendered per language and channel | Layer 2 owns templates and delivery; layer 3 triggers | ✅ |
| **Compliance: records & privacy** | Retention obligations attach to cases *and* documents *and* personal data | Layer 3 at case closure · layer 4 for retention/deletion | ⚠️ boundary only |
| **Security & secrets** | Supply chain, transport, secret handling, patching — everywhere | Platform + CI, verified per layer | ✅ |

### 4.1 Identity & access

**eIAM** is the identity provider and the role authority. Roles arrive as claims; the BFF exchanges the eIAM session for a short-lived JWT; Postgres RLS reads those claims. The browser holds an `HttpOnly` session cookie and never sees a token.

The design problem this layer must solve — and it is the only genuinely hard one here — is that **eIAM roles are coarse and RLS predicates are fine-grained**. A role says *what kind of user* someone is, not *which objects* they may see. Encoding scope into role names does not scale. Therefore:

> eIAM roles (from claims, fast-changing) × entitlement scope (local table, slow-changing) → RLS predicate

The scope table is **own write-model data** in layer 4, and its inputs are ingested. That makes entitlement partly a *cached* fact, with a freshness window — decide per fact which side of the line it sits on, and put an SLA on the ingested side.

### 4.2 Observability vs. audit trail — not the same vertical

Conflating these leads to either over-retained logs or under-protected audit.

| | Observability | Audit trail |
|---|---|---|
| Records | Technical events | Business facts |
| Purpose | Operate and debug | Prove what happened, to whom, when, by whose authority |
| Mutability | Sampled, rotated, discarded | Append-only, tamper-evident |
| Retention | Short, operational | Long, legally determined |
| Contains personal data | Avoid | By necessity — governed accordingly |

### 4.3 Metadata & documentation

The catalogue is not decoration — it is the layer that makes the others legible: datasets and their owners (DCAT-AP CH 2), API contracts (OpenAPI), deployed BPMN models, **reference data and code lists** (SIA, BKP, NAW, status models, audiences), and the mapping between business concepts and system tables.

Two rules keep it honest: it is **generated from the running system** wherever possible rather than hand-maintained; and **reference data has exactly one home** — every other layer holds keys, never duplicated labels. That second rule is also what makes localization tractable.

### 4.4 Compliance: records & privacy

A *Vorgang* is a Geschäftsfall subject to federal archiving obligations. A process engine's history is not an archive and does not satisfy them. When a case closes, its file — decisions, attachments, audit trail — is exported to GEVER with a retention class.

Personal data (contacts, bookings, case parties) needs a processing register, retention rules and a deletion path. The GEVER integration can follow the MVP; **the boundary and the retention model cannot** — both are far more expensive to retrofit than to design.

---

## 5. Open decisions

| # | Decision | Blocks |
|---|---|---|
| D1 | BPMN engine — Operaton · Flowable · jBPM/Kogito | Layer 3 selection; nothing else if BPMN stays portable |
| D2 | Ingestion mechanism per master — CDC, scheduled extract, or system-side push | Layer 6 design and the freshness SLA that layer 4 and §4.1 depend on |
| D3 | Frontend stack — Nuxt (design system becomes a dependency instead of a fork) vs. vanilla + Vite | Layer 1 migration; localization feasibility |
| D4 | Hosting and sovereignty model | Everything; also whether any AI model hosting is possible at all |
| D5 | Public/authenticated delivery — one deployment or two | Layer 1 and 2 topology, CSP, SSR |
| D6 | GEVER integration owner and retention classes | §4.4 — legally mandatory |
| D7 | Notification channels and whether a federal mail/notification service is mandated | §4 notification vertical |

---

## 6. Independence tests

The claim of replaceability is only worth making if it can be checked. Each of these should be answerable with *yes*:

| Replace… | …without touching | True when |
|---|---|---|
| The frontend framework | Layers 2–7 | The API contract and URL contract are stable, and behaviour tests assert neither |
| The process engine | Layers 1, 2, 4 | Models are portable BPMN 2.0 and process variables hold only references |
| The database platform | Layers 1–3 | Nothing depends on Supabase beyond standard Postgres — no GoTrue, no Storage, no Realtime |
| A system of record | Layers 1–4 | Its adapter is the only thing that knows its field names |
| The AI layer (delete it) | Everything | It is a pure consumer with no write path and no permission model of its own |
| The design system version | Layers 2–7 | It is a dependency, not a fork |
