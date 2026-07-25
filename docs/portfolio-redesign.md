# Liegenschaften Inventar — Redesign (`#/app/portfolio`)

Map-first real-estate portfolio explorer, inspired by `property-inventory/prototype-tabs`
(adapted to CD Bund). Data = the SAP-RE-FX golden record (`data/buildings.geojson` +
`parcels.geojson`), same `bbl_id`s as the Immobilienportfolio dashboard.

## Reference findings (prototype-tabs)
- 7 building detail tabs: Übersicht · Bemessungen · Kosten · Verträge · Ausstattung · Dokumente · Kontakte. Tabs 2–7 are one `createEntityTable` factory (search/sort/select/paginate). Parcels get only a light info panel.
- Views: Karte (default) · Tabelle · Galerie. Status-coloured points, parcel polygons, **no clustering**, gallery **not paginated**. Deep-linkable URL state.
- **No spatial hierarchy tree** — navigation is breadcrumb (Alle Objekte › Land › Region › Objekt) + a filter drawer (Status/Art Eigentum/Teilportfolio/Gebäudeart/Land/Region, OR-within/AND-across).

## Our design — differences / improvements
- **Left spatial-hierarchy tree** (new): Land → Region → Stadt → Wirtschaftseinheit → [🏢 Gebäude · ▭ Grundstück]. Built from `adr_land/adr_reg/adr_ort/bbl_we`; a building and its parcel share the WE segment of the bbl_id (`1000/**4840**/AF` ↔ `1000/4840/01`). Node click → filter all views + fit/zoom map. Region-polygon highlight = optional/later. Tree stops at building/parcel; levels/rooms/zones/assets live in the detail tabs.
- **Clustered** worldwide CARTO map (reuse `initEstateMap`) + parcel polygons (already built).
- **Galerie + Liste paginated** (buildings + parcels as unified objects; parcels get a neutral land-tile card / a Typ column).
- Search by address · name · ID. Attribute filter (Status / Eigentum / Gebäudetyp / Land) collapsible.

## Layout
```
Liegenschaften Inventar  (title + lead)
[🔍 Adresse, Objekt oder ID…]     [ Karte ▮ Galerie · Liste ]   ⚙ Filter   N Objekte
┌ Portfolio (tree) ┬ Karte / Galerie / Liste ─────────────────┐
│ ▾ 🇨🇭 Schweiz (6) │  clustered map (default) · gallery · list │
│   ▾ Bern     (4) │                                           │
│     ▾ WE 4840(2) │                                           │
│       🏢 Bundesh.│                                           │
│       ▭ Parz. A  │                                           │
│ ▸ 🇩🇪 …          │                                           │
└──────────────────┴───────────────────────────────────────────┘
```
Detail = full-page, tabbed (see below); deep-linked `#/app/portfolio?id=<bbl_id>`.

## Detail tabs
**Building** (✅ have · ◐ from geojson · ➕ copy+re-key reference data):
Übersicht ◐ · Flächen/Bemessungen ◐ (`garea_*`/`gvol_*`, SIA) · Geschosse & Räume ➕(synthetic) ·
Ausstattung ➕ · Verträge ➕ · Kosten ➕ · Dokumente ✅ · Kontakte ➕ · Bauprojekte ✅ · Medien ✅.
Übersicht = 2-col: Bilder + Kennzahlen + Energie | Stammdaten + Adresse (mini-map).

**Parcel** (lighter, 4): Übersicht (+ polygon mini-map + linked building) · Flächen · Bodenbedeckung (`landcovers.geojson`) · Dokumente.

## Plan (confirmed: phased · copy+re-key reference data)
**Phase 1 — shell:** `core.parcels()` (+normalizeParcel); rewrite `portfolio.js` to the tree +
toolbar + Karte/Galerie/Liste + pagination + search + attribute filter; keep the current simple
detail. Verify live.
**Phase 2 — rich detail:** copy + re-key `assets/contracts/costs/contacts.json` from prototype-tabs
onto our bbl_ids; build the tabbed building/parcel detail (reuse `C.table`, `C.tabBar`).

Data note: reference entity ids are `BBL-001…`; re-key to our SAP ids by position (as with the
earlier BLD→SAP crosswalk). See [[buildings-golden-record]].
