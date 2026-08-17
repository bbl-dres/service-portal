# Pipeline icon design review

Date: 2026-08-17
Scope: the shared status pipeline, reviewed from `#/my-cases/seed-2`

## Outcome

The shared pipeline now uses legible, locally bundled Lucide status glyphs at the
Swiss Federal Design System's medium icon tier. The change belongs to the shared
component rather than the case page, so case details, service descriptions,
transactions, and plan approval use one visual and semantic contract.

## Evidence

- `js/ui/components/navigation.js` previously rendered the completed check and
  current clock with `icon--sm`. In `css/layouts/grid.css`, that tier is 12 px.
  The glyphs were consequently undersized inside a segment with a 44 px minimum
  height.
- The local CD source defines `icon--md` as 20 px and 24 px from the 768 px
  breakpoint (`designsystem/css/foundations/icons.postcss`, lines 27–29). Its
  closest status control uses a large check inside a 36 px step indicator
  (`designsystem/app/components/ch/components/StepIndicator.vue`, lines 1–9;
  `designsystem/css/components/step-indicator.postcss`, lines 5–21).
- The CD's `steps.postcss` and `progress.postcss` currently contain no component
  rules. The portal's horizontal chevron pipeline is therefore a portal-specific
  pattern using CD tokens, not a CD component implementation.
- The pipeline already had sound list semantics, one `aria-current="step"`,
  screen-reader state prefixes, wrapping, and no false interactive affordance.

## Decisions

- Completed steps use `lucide/circle-check-big`; the current step uses
  `lucide/clock-3`. Both use Lucide's consistent 24-unit, 2 px stroke language.
- Glyphs use `icon--md`: 20 px on phones and 24 px from 768 px. Existing segment
  height, padding, eight-pixel icon gap, chevron geometry, and wrapping remain
  unchanged.
- Upcoming steps remain glyph-free. Their position, neutral surface, and label
  communicate sequence without giving every step equal visual emphasis.
- The change is implemented in `C.pipeline`, not `my-cases.js`; page-specific
  overrides would let shared consumers drift.
- The curated set is named `assets/icons/lucide`, using the library's correct
  spelling and describing its source rather than its first tree consumer.

## Accessibility and responsive behaviour

The icons are decorative masks and retain `aria-hidden="true"`. Completed and
current labels keep the textual prefixes “Erledigt” and “Aktueller Schritt”, and
the current list item alone keeps `aria-current="step"`. State therefore does not
depend on colour, icon recognition, or stroke rendering. The ordered list wraps
at narrow widths instead of introducing a non-interactive horizontal scroll
region. The 20 px phone size preserves label room; the 24 px desktop size matches
the CD's responsive medium tier.

## Security, performance, and provenance

Only the two required SVGs are added to the existing pinned, ISC-licensed Lucide
subset. They are served from the portal origin as ordinary assets; no runtime
package or CDN request is introduced. The curated set includes the exact
upstream license, a SHA-256 manifest, and a fail-closed reproduction script.
`C.icon` continues to validate the single optional icon-set directory and rejects
traversal or injected names. The pipeline supplies static icon names and safe
class tokens.

## Verification

- The real prefixed route `#/my-cases/seed-2` renders the exact
  done/done/active/todo sequence at 320, 768, and 1440 px. Glyphs measure 20 px
  on the phone viewport and 24 px at the larger breakpoints; the pipeline wraps
  into two rows only at 320 px and never overflows.
- Both status masks and representative tree masks resolve from the deployment
  prefix, stay same-origin, and return HTTP 200. The icon inventory proves that
  all 18 declared, referenced, and shipped SVGs match their hashes and contain
  no active or external content.
- Focused browser regressions pass for the pipeline, sidebar and spatial trees,
  metadata catalogue, process documentation, portfolio, tenancies, and
  workspace. All 25 pure suites, syntax checks for 243 JavaScript/MJS files,
  the CSS-token gate, and the English-code gate also pass.

## Residuals

- This remains a portal-specific status visualization until the CD publishes a
  horizontal process component.
- The root CD icon collection remains in use elsewhere. Each pipeline uses one
  icon family internally; this review does not propose a portal-wide icon reset.
- Upcoming steps intentionally have no glyph. Revisit only if user testing shows
  that labels, order, and the neutral segment are insufficient.
- Deploy the JavaScript references and renamed asset directory atomically. A
  host with long-lived module caches should invalidate them during rollout so
  an older module cannot request the retired `assets/icons/tree` path.
