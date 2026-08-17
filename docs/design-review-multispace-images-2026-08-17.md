# Multispace imagery review

> Date: 2026-08-17
> Scope: `#/knowledge/workspace/multispace`, module details, and the handbook's
> «Planungsbeispiele» preview.

> **Planning-example imagery supersession (2026-08-17):** The module-image
> contract in this review remains current. Statements below about
> media-registry-only planning-example galleries describe the earlier
> implementation and are superseded by the
> [planning-example imagery review](design-review-planning-examples-imagery-2026-08-17.md):
> each example now retains one attributed real context photo as card cover and
> first gallery item, followed by three explicit, non-binding visualisations.

## Findings

The page appeared to have image fallbacks, but all eleven scalar module paths
pointed to files that did not exist. The delegated image-error handler removed
the failed `<img>` and left a coloured wrapper, while the retained browser
diagnostic counted wrappers rather than decoded pixels. This made eleven broken
requests look like a passing visual contract.

The handbook also maintained a second, hard-coded list of three realised spaces.
Its renderer passed a local media path through the legacy remote-photo ID slot,
so no image element was emitted. The canonical records in
`data/workspace-examples.json` already had valid `coverMediaId` references,
licence data, and working local files; the duplicate renderer simply bypassed
them. Its empty local `images` arrays were also a documented but unimplemented
precedence contract; they have been removed so the media registry is the one
truthful image source until exact workspace photography is implemented.

Module and example cards copied shared card markup instead of using `C.card`.
That duplication caused the image-channel drift and inconsistent title, body,
footer, and focus behavior.

## Implemented design and data contract

- A module owns an ordered `images[]` collection. Each item carries `src`, `alt`,
  `caption`, `credit`, `license`, and `provenance`.
- `images[0]` is the single source for the catalogue card and canonical detail
  hero. Later items form an ordered detail gallery. `images:[]` is a supported
  compact text-first state and issues no request.
- Eleven distinct, people-free 16:9 illustrations were generated locally for
  the prototype. They are visibly and structurally described as illustrative,
  non-binding, and not photographs of realised BBL spaces or technical plans.
- Module details use the shared `C.detailHead`; above-the-fold heroes can request
  eager, high-priority loading while catalogue images remain lazy.
- Module and planning-example previews use `C.card`. The handbook preview now
  selects the three newest canonical workspace examples and resolves their
  existing media records; the full inspiration page remains the route to all
  examples.
- Search opens the current Multispace handbook route instead of the retired
  workspace section query. Only `modul-<number>` is accepted as a detail slug.
- The unreachable pre-card row catalogue and its private CSS were removed; its
  section record remains explicitly search-only instead of carrying dead HTML.

## Safety, accessibility, and performance

Core validation rejects the retired scalar field, unsafe or traversal paths,
duplicate sources, incomplete provenance, malformed nested module data, and
non-finite figures. Integrity checks require exact filename case, 1440×810 JPEG
dimensions, a maximum of 220 KiB per file, and at most 2 MiB for the set.

Card images are decorative because the adjacent link already names the module.
The detail hero uses the authored scene description, followed by a visible
non-binding caption and credit. A failed requested image is removed without
disabling the card link; an empty image list emits no blank media surface.

The module illustrations are repository-local, so they introduce no runtime
third-party request, tracking, CORS, or external-availability dependency.

## Verification

- `test-data-integrity.mjs` checks image files, dimensions, byte budgets,
  provenance, and workspace-example media references.
- `test-data-resilience.mjs` checks malformed, unsafe, duplicate, legacy, empty,
  and ordered image states at the core boundary.
- `test-workspace-knowledge.mjs` checks decoded pixels on all eleven cards and
  details, the three example covers, keyboard opening, responsive containment,
  canonical slugs, and safe image failure behavior.
- `test-html-contracts.mjs` checks default lazy loading and the explicit eager
  hero option.
