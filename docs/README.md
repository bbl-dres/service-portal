# BBL Unified Service Platform — Documentation

Planning & concept docs for the BBL service-portal prototype. Read in this order:

1. **[platform-vision.md](platform-vision.md)** — the north star. Unify the intranet + five domain prototypes into one **process-oriented platform**: a wiki + a service directory that open microservices, driven by a process engine (Camunda), over a shared data core, with an internal DCAT **data catalog**. Modeled on the Aargau Smart Service Portal + federal I14Y.
2. **[sitemap.md](sitemap.md)** — information architecture of the **portal shell & service directory** (the front door): the 6 top-level task areas and the 8-domain service catalog.
3. **[requirements.md](requirements.md)** — prioritized prototype requirements (MoSCoW), functional + non-functional.
4. **[prototype-plan.md](prototype-plan.md)** — the concrete **demo build plan**: confirmed decisions, evolved nav, the new **Anwendungen** & **Daten** surfaces, folder structure, micro-app plan, and the one remaining stack decision.
5. **[data-model.md](data-model.md)** — the shared core data model + the DCAT data-catalog model.
6. **[expert-review.md](expert-review.md)** — multi-persona expert review (10 personas, fact-checked): verdict, validated strengths, prioritized gaps, the blind spots the whole panel missed, and recommended doc changes.
7. **[cd-audit.md](cd-audit.md)** — CD Bund alignment audit (4 reviewers vs designsystem + tenant-portal): what's fixed and the prioritized backlog.

## Status

- **Phase:** requirements & concept — *no implementation yet.*
- **Confirmed:** unified audience (customers + staff); 6 top-level task areas (sitemap §7).
- **Source material analyzed:** the current intranet ([bbl-intranet/](../bbl-intranet/), gitignored) and the five sibling prototypes — `tenant-portal`, `property-inventory`, `transaction-portal`, `workspace-management`, `ppm-cockpit`.

## Open decisions

- **Remaining:** tech stack — vanilla vs Vue/Nuxt ([prototype-plan.md §8](prototype-plan.md)); platform name (V6).
- Resolved platform decisions: [platform-vision.md §11](platform-vision.md). Prototype-level defaults: [requirements.md §10](requirements.md).
