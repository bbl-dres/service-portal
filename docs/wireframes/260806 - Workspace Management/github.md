repo: bbl-dres/service-portal
branch: main

## Last sync

date: 2026-08-06T19:40:00Z

### Updated in this project

- Cluster 4a «Plan hochladen» auf vier Schritte umgebaut: Datei · Datenqualität · Ziel · Übernahme.
- Prüfbericht (4a-2) an der realen Prüfplattform ausgerichtet: Regelcodes, Regeltexte und Meldungstexte aus `bbl-dres/plan-check` (`locales/de.json`, `docs/pruefregeln-de.md`).
- Abbruchregel übernommen: fehlen alle drei Pflicht-Layer (LAYER_001–003), bricht die Prüfung ab; Score sonst als «bestandene Regeln / 40».

## Related repos

| Repo | Rolle in diesem Projekt |
| --- | --- |
| `bbl-dres/service-portal` | Portal-Shell, CD-Bund-Komponenten, Fixtures, Grundriss-Zeichnung |
| `bbl-dres/plan-check` | Prüfplattform Flächenmanagement — Regelkatalog und Prüfbericht, eingebettet als Schritt 2 des Upload-Assistenten |

## Screen map

| Screen im Projekt | Quelle im Repo |
| --- | --- |
| Portal-Shell (Top-Bar, Kopfzeile, Hauptnavigation, Brotkrume, Footer) | `service-portal`: `js/shell.js`, `js/router.js`, `js/crumbs.js` |
| CD-Komponenten (btn, badge, card, table, catbar, select, steps, fp-*) | `service-portal`: `css/app.css`, `css/tokens.css`, `js/components.js` |
| Grundriss-Zeichnung, Einfärbemodi, Legende | `service-portal`: `js/floorplan.js` |
| Gebäudedaten, Geschosse, Räume, Fotos | `service-portal`: `data/buildings.geojson`, `data/floors.json`, `data/spaces.json`, `assets/images/buildings/` |
| Objektwahl Galerie / Karte / Objekt-Detail (2a) | `service-portal`: `js/apps/tenancies.js`, `js/spatial-tree.js` |
| Modulkatalog und Handbuch (3a) | `service-portal`: `docs/workspace-management-requirements.md`, Kap. 5 |
| Upload-Assistent Schritt 2 «Datenqualität» (4a-2) | `plan-check`: `locales/de.json`, `docs/pruefregeln-de.md`, `js/validation.js` |
| Upload-Assistent Schritt 1 «Datei» (4a-1) | `plan-check`: `locales/de.json` (`upload.*`, `file.*`) |
