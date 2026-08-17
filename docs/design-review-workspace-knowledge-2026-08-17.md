# «Arbeitsplätze gestalten» — UX and CD refactor review

**Date:** 17 August 2026
**Status:** Implemented; focused verification recorded below
**Scope:** `#/knowledge/workspace` and its Multispace, planning-example,
lifecycle, and download branches

> **Planning-example imagery supersession (2026-08-17):** The information
> architecture and gallery interaction in this review remain current.
> Statements below about four-item media-registry galleries, photographer or
> download actions, and route-time `media.json` use describe the earlier
> implementation and are superseded by the
> [planning-example imagery review](design-review-planning-examples-imagery-2026-08-17.md):
> every example now opens a four-item gallery containing one attributed real
> context photo followed by three disclosed, non-binding visualisations. The
> generated items expose neither a download nor a media-detail action. Earlier
> verification remains a historical record of that refactor.

## Outcome

The branch now behaves as one coherent knowledge product rather than a mixture
of a document page, a catalogue, and small stand-alone case studies:

- the branch landing page is a four-destination CD hub with highlight cards;
- Multispace remains the visual catalogue, with eleven module details;
- each planning example opens its own image collection in the portal's shared
  gallery instead of creating a long detail page;
- lifecycle guidance and download groups are real `h2` sections represented in
  the table of contents;
- downloads are direct rows without accordion counts;
- image attribution travels with the media record and file downloads fail
  closed unless the licence is explicitly reusable; and
- the workspace renderer and its data requirements are isolated from the six
  ordinary knowledge areas.

This is an information-architecture and interaction refactor, not a decorative
skin. It changes what constitutes a page, what constitutes a dialog, and which
data a route is allowed to request.

## Review basis

The review used the checked-in Swiss Federal Design System at
`C:\Users\david\Documents\GitHub\designsystem`, package version **1.0.5**, commit
`5f03f257`. The source implementation was inspected directly; decisions below
are not inferred from screenshots or from generic design-system conventions.

The relevant CD evidence is:

| Question | Source evidence | Applied decision |
| --- | --- | --- |
| How should a branch hub work? | `app/pages/hubPage.vue:13-22` composes `Hero type="hub"` with `SubpagesSection`; `app/components/ch/sections/SubpagesSection.vue:2-98` uses highlight cards for subpages. | Use four highlight cards as the complete sibling navigation, and keep the area introduction in the hub header. |
| How should four curated cards lay out? | `app/components/stories/components/CardsOnGrid.mdx:39-55` distinguishes curated cards; `css/layouts/grids.postcss:248-258` makes the first of four cards full width followed by three equal siblings. | Restore the first-consumer `.grid--items-4` pattern rather than inventing a workspace grid. |
| What is the highlight treatment? | `css/components/card.postcss:43-80` defines the offset secondary panel, white reading surface, and hover/focus scale. | Restore `.card--highlight` from the CD source and use the existing stretched-link card anatomy. |
| How should long detail content be structured? | `app/pages/detailPageAnchorNav.vue:46-211` uses real `h2[id]` sections, a reverse-mobile main/aside grid, and a sticky condensed menu; `app/scripts/AnchorNav.js:5-23` observes `main h2[id]`. | Use the shared `anchorNavPage()` for lifecycle, downloads, and module details. Section headings are content structure, not styled labels. |
| Do accordion headers carry counts? | `app/components/ch/components/AccordionItem.vue:2-41` exposes only `id`, `title`, and `headingLevel`, with a title and chevron. | Do not put resource counts or metadata in workspace accordion headers. In this case, remove the accordions entirely because each group is already a meaningful page section. |
| How are downloads grouped? | `app/components/stories/components/DownloadItem.mdx:10-20` places multiple items directly in `ul.download-items`; only a list of roughly ten or more may gain a bare expansion control. | Render each two- or three-item group as direct download rows under its own `h2`. |
| How should an image collection behave? | `app/components/stories/components/Slideshow.mdx:6-20` defines a one-image-at-a-time collection, while `app/components/ch/demo/SlideshowExample.vue:3-69` enables keyboard and A11y modules. `app/components/ch/components/Modal.vue:90-128` focuses the dialog, closes on Escape, and restores trigger focus. The package has no dedicated lightbox component. | Reuse the portal gallery, which already combines those modal and image-navigation behaviours, rather than create a workspace-only lightbox. |
| How should card images behave? | `app/components/stories/layout/ResponsiveImages.mdx:325-331` specifies 16:9 card images and the CD examples use responsive sources. | Keep 16:9 imagery, lazy-load catalogue images, and request only the module-detail hero eagerly. |

## Findings and implemented decisions

| ID | Before | Implemented target | Result |
| --- | --- | --- | --- |
| WK-01 | The workspace overview used generic icon tiles with derived counts. The tiles did not match the actual federal hub composition. | Four curated highlight cards, no decorative category icon and no count metadata. The first destination spans the first row at the CD breakpoint and the other three form the second row. | A recognisable hub whose hierarchy comes from card size and order, not badges. |
| WK-02 | Kreislaufwirtschaft was one long section, so its table of contents contained one unhelpful entry. | Four authored sections: «Occasionsmobiliar zuerst», «Lieferung und Montage», «Reparaturen und Zuständigkeiten», and «Rückgabe und Wiederverwendung». | The table of contents now previews the actual reading path and supports stable section links. |
| WK-03 | Downloads were one HTML block containing four accordions and counts. The group headings were absent from the document outline and resource records were not individually searchable. | Four real sections: «Standard und Vorgaben», «CAD-Bausteine», «Werkzeuge für AutoCAD und Revit», and «Vorlagen für die Planung», containing ten direct download rows in total. | CD-aligned scanning, meaningful anchors, and one search entry for each section and resource. |
| WK-04 | Four planning examples each opened a full detail page containing image, plan, furniture, and location sections. The interaction cost was disproportionate to a visual reference collection. | Cards open only that example's shared gallery. Project facts and media attribution are carried in gallery metadata. | The overview remains the place for comparison; the gallery is the place for looking. |
| WK-05 | Example media inherited the gallery's downloadable-by-default behaviour even when the record was proprietary or its licence was unknown. | File actions are enabled only for recognised `CC0`, `CC BY`, or `CC BY-SA` labels. Unknown and proprietary labels hide the action. | Rights are opt-in rather than inferred from the absence of a known restriction phrase. |
| WK-06 | `js/pages/knowledge.js` contained both the generic knowledge renderer and roughly five hundred lines of workspace-only catalogue/detail code. | Workspace rendering moved to `js/pages/workspace-knowledge.js`; the generic module delegates only after the area has been identified. | Smaller ownership boundaries and fewer workspace regressions in ordinary knowledge pages. |
| WK-07 | Every workspace route requested modules, products, media, and examples, including static pages and malformed paths. | Data requirements are declared for the exact route shape. Static, unknown-branch, malformed-alias, and surplus routes request none of the four catalogues. A record-shaped module/example URL loads only the data required to validate that record. | Less transfer, parsing, and failure surface; rejected route shapes no longer fetch data they cannot render. |
| WK-08 | Existing `/inspiration/<slug>` URLs represented full example pages. Removing them outright would break bookmarks and references from module details. | A valid legacy slug is replaced with the canonical `?bild=<example-id>:<media-id>` URL and opens the matching gallery; unknown or surplus paths remain 404s. | One canonical interaction without abandoning shared links. |
| WK-09 | The maintained visual-review route matrix omitted the entire workspace knowledge branch. | Representative hub, handbook, inspiration, lifecycle, and download routes were added to `scripts/review-routes.mjs`. | Future broad visual/accessibility passes include this branch. Adding the routes is not itself evidence that a full matrix run passed. |

## Current information architecture

```text
Arbeitsplätze gestalten
├── Multispace-Handbuch
│   ├── 11 module cards
│   └── module detail: hero + anchored sections
├── Planungsbeispiele
│   └── 4 cards → per-example shared gallery
├── Kreislaufwirtschaft und Occasionsmobiliar
│   └── 4 anchored lifecycle sections
└── Downloads und Vorlagen
    └── 4 anchored groups → 10 direct resource rows
```

The overview card order is deliberate. The handbook is the primary destination
and therefore receives the wide first row. Examples, lifecycle guidance, and
downloads are sibling tasks, not metadata appended to the handbook.

## Interaction contract

### Planning-example galleries

Each card remains a real link. Its URL contains a scoped identifier such as
`?bild=<example-id>:<media-id>`; scoping prevents a media identifier from opening
in the wrong example collection.

- An unmodified primary click is enhanced in place and opens a dialog.
- Modified clicks and normal link navigation retain a shareable URL fallback.
- `aria-haspopup="dialog"` announces the interaction before activation.
- Left and right arrows move only within the selected example.
- Escape closes the gallery and focus returns to the activating card link.
- Direct `?bild=` navigation restores the same example and image.
- The metadata panel exposes project scope, building, address, area,
  workplaces, completion, module numbers, media ID, date, photographer,
  copyright, licence, and source when present.
- Valid old `/inspiration/<slug>` links canonicalise to the example cover;
  invalid slugs and surplus route segments do not silently fall back.

The gallery is intentionally shared with the media library and estate surfaces.
A second lightbox would duplicate focus trapping, URL synchronisation, safe URL
handling, zoom, keyboard navigation, and overlay ownership.

### Document pages

Lifecycle and download pages use the same reading model:

1. page title and lead;
2. a compact contents disclosure before the content on small screens;
3. a sticky contents card beside the content from the CD breakpoint;
4. DOM-ordered sections with stable `h2[id]` headings; and
5. scroll-spy state that does not replace the accessible link names.

The download section title is the group label. Repeating it as an accordion
header and adding a count would add a second navigation layer without hiding a
meaningful amount of content: every group contains only two or three rows.

## Route-scoped data contract

| Route shape | Deferred data |
| --- | --- |
| `#/knowledge/workspace` | none |
| `#/knowledge/workspace/kreislauf` | none |
| `#/knowledge/workspace/downloads` | none |
| unknown branch, malformed alias such as `modul-01`, or surplus path | none |
| `#/knowledge/workspace/multispace` | `multispaceModules`, `media`, `workspaceExamples` |
| record-shaped `#/knowledge/workspace/multispace/modul-N` | `multispaceModules`, `shopProducts`, `workspaceExamples` |
| `#/knowledge/workspace/inspiration` | `media`, `workspaceExamples` |
| one-segment legacy `#/knowledge/workspace/inspiration/<slug>`, valid or unknown | `media`, `workspaceExamples` |

This mapping follows presentation needs rather than subject ownership. A module
detail does not load the media catalogue because its authored module imagery is
already part of the module record; the inspiration page does not load modules
or products because module numbers are enough for its badges and metadata.

The extracted renderer is dynamically imported only for the workspace area.
That keeps workspace catalogue code off ordinary subject-area navigation while
preserving the existing route-module and `ctx.stale()` lifecycle contract.

## Accessibility and responsive behaviour

- Cards preserve one semantic heading and one stretched title link; the whole
  visual card is clickable without creating nested interactive controls.
- The four-card hub is one column on small screens and uses the CD's curated
  three-column arrangement from 768 px.
- All document sections are represented by real headings. Download titles sit
  one heading level below their section.
- The mobile contents disclosure precedes the content in DOM and visual order;
  the desktop aside becomes sticky without duplicating the links.
- Gallery cards announce a dialog. Focus is trapped while open, Escape works,
  and the trigger regains focus on close.
- Catalogue images have empty alternative text because their adjacent card
  title carries the destination. Gallery metadata and captions carry the image
  context and rights information.
- Card images are lazy by default. Only the first module-detail image opts into
  eager loading and high fetch priority.

## Security, rights, and failure behaviour

- Media and project text pass through the existing escaped component and
  gallery sinks; this refactor does not introduce a trusted-HTML path for data.
- Gallery image/resource URLs continue through the shared URL allowlists.
- Download rights fail closed. A missing, unfamiliar, or proprietary licence
  produces no file action even if a same-origin file exists.
- The download page's ten prototype resources remain visibly unavailable while
  their real publication URLs and clearance are absent. A placeholder is not
  presented as a successful download.
- Missing media removes neither the example card's text nor its navigation
  contract; missing module artwork retains the authored colour fallback.
- Unknown route shapes reach a focused not-found state and do not request
  unrelated catalogues first. A syntactically valid record path may load its
  minimal catalogue to determine that the requested record does not exist.

## Compatibility decisions

| Previous address | Current behaviour |
| --- | --- |
| `#/knowledge/workspace/inspiration/<valid-slug>` | Replace with the canonical inspiration `?bild=` URL and open that example's cover image. |
| `#/knowledge/workspace/inspiration/<unknown-slug>` | Focused «Planungsbeispiel nicht gefunden» state. |
| `#/knowledge/workspace/inspiration/<slug>/<surplus>` | Not found; no permissive prefix matching. |
| Existing module-detail URLs | Retained. Planning-example links now target the canonical gallery query. |
| Existing `?section=wi-…` lifecycle/download links | Retained through stable section IDs and the shared anchor-navigation query contract. |

## Verification contract

The implementation is covered at complementary levels:

- `scripts/test-knowledge-workspace.mjs` pins the authored model: eleven modules,
  four lifecycle sections, four download sections, ten direct resources, routed
  search targets, and absence of the five removed handbook sections.
- `scripts/test-route-needs.mjs` records the exact request matrix above,
  including zero catalogue requests for static, malformed, and surplus routes.
- `scripts/test-routes.mjs` protects canonical addresses and compatibility
  behavior for valid and invalid legacy example paths.
- `scripts/check-workspace-branch.mjs` covers rendered branch anatomy, real
  headings/contents links, direct download rows, canonical gallery launchers,
  and strict not-found states.
- `scripts/test-workspace-knowledge.mjs` covers decoded module/example imagery,
  keyboard gallery operation, deep links, focus restoration, responsive
  containment, and failed-image fallback in a real browser.
- `scripts/test-content.mjs`, `scripts/test-html-contracts.mjs`,
  `scripts/test-data-integrity.mjs`, and `scripts/test-data-resilience.mjs`
  protect the shared components, safe markup, authored media contracts, and
  malformed-data behavior touched by the refactor.

### Focused run evidence

The maintained root regression matrix completed green, including all **24/24
pure suites** and the supported browser matrix. The focused evidence for this
refactor is:

- `test-workspace-knowledge.mjs` passed in 25.2 s: four scoped galleries with
  four ordered images each; cover click and Enter; direct deep links; ArrowLeft/
  ArrowRight URL synchronization; Escape query cleanup and focus restoration;
  valid legacy normalization; strict invalid, surplus, and leading-zero paths;
  complete licence metadata; reusable CC BY-SA download and suppressed non-free
  BBL download; fixed shared overlay at 320/768/1440 px; and no browser problem
  or dependency on portfolio-only CSS.
- `check-workspace-branch.mjs` passed in 22.3 s: the four-card CD highlight hub,
  lifecycle H2/ToC order, four download H2 sections, ten direct rows, no download
  accordion, and canonical gallery launchers.
- `test-content.mjs` passed in 6.4 s: exact section IDs, titles, contents links,
  and direct-list anatomy.
- `test-route-needs.mjs` passed in 8.9 s: the exact zero/static and routed
  catalogue subsets, including no data for the rejected `modul-01` alias.
- `test-routes.mjs` passed in 11.6 s: new canonical paths, strict not-found
  behavior, and valid legacy normalization.
- `test-knowledge-workspace.mjs` passed with **11 modules, 9 sections, and 19
  workspace search rows**. `test-data-resilience.mjs`, all **241** JavaScript/MJS
  syntax checks, the English-code gate across **272** maintained source files,
  and `git diff --check` also passed.
- The shared-surface regressions `test-css-layers.mjs`, `test-portfolio.mjs`,
  `test-ui-state.mjs`, `test-gallery-floorplan-state.mjs`, and
  `test-anchor-search-state.mjs` passed. This matters because the refactor
  extended shared card, grid, gallery, overlay, photo, and anchor primitives.

The supported repository inventory remains **63** `test-*.mjs` suites (39
browser and 24 pure) plus **25** `check-*.mjs` probes.

The five route additions in `scripts/review-routes.mjs` were inspected but the
complete 75-route visual matrix was not run; this review does not present route
inclusion as visual evidence.

## Residuals and follow-up thresholds

1. **Prototype imagery remains prototype imagery.** The eleven generated module
   illustrations are explicitly marked non-binding. Replace them only with
   approved photography that carries the same alt, caption, credit, licence,
   provenance, dimensions, and budget contract.
2. **Download files are not published yet.** Keep their rows unavailable until a
   real URL, publication authority, and redistribution status are known.
3. **Licence text is still a string.** The fail-closed allowlist is safe for the
   current fixture, but a production media API should expose structured rights
   and an explicit `mayDownload` capability rather than asking the client to
   interpret labels.
4. **Four examples do not justify catalogue controls.** Add search, filters, or
   pagination only when the collection no longer fits a single useful overview.
5. **The CD is still hand-ported.** `.card--highlight` and `.grid--items-4` now
   match the audited local source, but they can drift until the portal consumes
   the federal package directly or adds a parity gate.
6. **The full visual-review matrix remains a separate run.** Its five new route
   entries ensure coverage next time; focused workspace suites remain the
   evidence for this change.

## Supersession map

This review supersedes only the current-interface implications of historical
findings 15.8, 15.12, 15.18, and 15.19 in `docs/design-review.md`. It does not
invalidate their underlying decisions about canonical workspace records,
licence attribution, module numbering, or real image validation. The earlier
full example pages remain useful history explaining why the lighter gallery
interaction was chosen.
