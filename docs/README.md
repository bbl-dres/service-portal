# BBL Unified Service Platform — Documentation

Konzept- und Review-Dokumente des Service-Portal-Prototyps. Leseordnung:

**Konzept (Plan-first-Phase):**

1. **[platform-vision.md](platform-vision.md)** — der Nordstern. Intranet + fünf Fach-Prototypen zu EINER prozessorientierten Plattform: Wiki + Dienstleistungskatalog, Micro-Apps, Prozess-Engine (Camunda), geteilter Datenkern, interner DCAT-Datenkatalog. Vorbilder: Aargau Smart Service Portal + I14Y.
2. **[sitemap.md](sitemap.md)** — Informationsarchitektur von Portal-Shell und Dienstleistungskatalog. *(Teilweise überholt: «Anwendungskatalog» heisst im Bau «Anwendungen», die Wissens-Abschnitte sind nach Fachgebieten gegliedert — massgebend ist js/router.js.)*
3. **[requirements.md](requirements.md)** — priorisierte Anforderungen (MoSCoW).
4. **[data-model.md](data-model.md)** — Datenkern + DCAT-Katalogmodell.
5. **[services.md](services.md)** — der Dienstleistungskatalog fachlich.
6. **[bbl-vokabular.md](bbl-vokabular.md)** — Terminologie-Autorität (BKP, SIA, Rollen, Objektbegriffe).
7. **[legacy-analysis.md](legacy-analysis.md)** — Analyse des heutigen Intranets.
8. **[swisstopo-api.md](swisstopo-api.md)** — Karten-/Geodatengrundlagen.
9. **[portfolio-redesign.md](portfolio-redesign.md)** — Entwurfsnotizen zum Liegenschaften-Explorer.

**Reviews (je Welle, chronologisch):**

10. **[code-review.md](code-review.md)** — technischer Review (Lade-/Fehlerpfade, Router-Verträge).
11. **[design-review.md](design-review.md)** — die AKTUELLE Design-Review (August 2026): Konsistenz, Komplexität, Sprache — Kanon, 130 Befunde, Umsetzungsstand, bewusste Abweichungen.

## Status

- **Phase:** lauffähiger Prototyp — 8 Seitenbereiche + 13 Micro-Apps (vanilla JS, kein Build; Start: `node scripts/serve.mjs` oder `python -m http.server`).
- Frühere Einzeldokumente der ersten Review-Wellen (prototype-plan, expert-review, cd-audit) sind in die obigen Dokumente aufgegangen und existieren nicht mehr als Dateien.

## Offene Entscheide

- Plattformname (V6); produktiver Stack (der Prototyp ist bewusst vanilla).
- Aufgelöste Plattform-Entscheide: [platform-vision.md §11](platform-vision.md).
