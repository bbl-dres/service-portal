# BBL Unified Service Platform — Documentation

Konzept- und Review-Dokumente des Service-Portal-Prototyps. Leseordnung:

**Konzept (Plan-first-Phase):**

1. **[platform-vision.md](platform-vision.md)** — der Nordstern. Intranet + fünf Fach-Prototypen zu EINER prozessorientierten Plattform: Wiki + Dienstleistungskatalog, Micro-Apps, Prozess-Engine, geteilter Datenkern, interner DCAT-Datenkatalog. Vorbilder: Aargau Smart Service Portal + I14Y.
2. **[sitemap.md](sitemap.md)** — Informationsarchitektur von Portal-Shell und Dienstleistungskatalog. *(Teilweise überholt: «Anwendungskatalog» heisst im Bau «Anwendungen», die Wissens-Abschnitte sind nach Fachgebieten gegliedert — massgebend ist `js/routing/routes.js`.)*
3. **[requirements.md](requirements.md)** — priorisierte Anforderungen (MoSCoW).
4. **[data-model.md](data-model.md)** — Datenkern + DCAT-Katalogmodell.
5. **[services.md](services.md)** — der Dienstleistungskatalog fachlich.
6. **[bbl-vocabulary.md](bbl-vocabulary.md)** — Terminologie-Autorität (BKP, SIA, Rollen, Objektbegriffe).
7. **[legacy-analysis.md](legacy-analysis.md)** — Analyse des heutigen Intranets.
8. **[swisstopo-api.md](swisstopo-api.md)** — Karten-/Geodatengrundlagen.
9. **[portfolio-redesign.md](portfolio-redesign.md)** — Entwurfsnotizen zum Liegenschaften-Explorer.
10. **[room-booking-redesign.md](room-booking-redesign.md)** — Raumbuchung: vom dreistufigen Assistenten zur einen Seite mit Direktbuchung (Entwurf 1a, `docs/wireframes/`).

**Zielarchitektur (Produktivierung — der Prototyp ist Spezifikation, nicht Vorstufe):**

11. **[architecture.md](architecture.md)** — das Schichtenmodell, kompakt: sieben horizontale Schichten (Präsentation · BFF · Prozess · Daten · KI · Integration · Führungssysteme) mit «darf nicht enthalten»-Regeln, acht Verticals (IAM/eIAM · Observability · Audit · Metadaten · Lokalisierung · Notifikation · Compliance · Sicherheit) und die Unabhängigkeitstests.
12. **[production-architecture.md](production-architecture.md)** — die ausführliche Begründung: Bewertung des Prototyps (was trägt, was bricht), Zielarchitektur je Schicht, Strangler-Reihenfolge und offene Entscheide.

**Reviews (je Welle, chronologisch):**

13. **[code-review.md](code-review.md)** — technischer Review (Lade-/Fehlerpfade, Router-Verträge).
14. **[design-review.md](design-review.md)** — die AKTUELLE Design-Review (August 2026): Konsistenz, Komplexität, Sprache — Kanon, 130 Befunde, Umsetzungsstand, bewusste Abweichungen.

## Status

- **Phase:** lauffähiger Prototyp — 8 Seitenbereiche + 17 Micro-Apps (vanilla JS, kein Build; Start: `node scripts/serve.mjs` oder `python -m http.server`).
- Frühere Einzeldokumente der ersten Review-Wellen (prototype-plan, expert-review, cd-audit) sind in die obigen Dokumente aufgegangen und existieren nicht mehr als Dateien.

## Offene Entscheide

- Plattformname (V6); produktiver Stack (der Prototyp ist bewusst vanilla).
- Aufgelöste Plattform-Entscheide: [platform-vision.md §11](platform-vision.md).
