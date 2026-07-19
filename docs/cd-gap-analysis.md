# CD Bund design-system gap analysis

Date: 2026-06-16

Source audited: `C:\Users\david\Documents\GitHub\designsystem`

Portal audited: `C:\Users\david\Documents\GitHub\service-portal`

## Executive summary

The service portal has the right visual foundation: CD Bund color tokens, Noto Sans, federal logo assets, the official icon set, header/navigation/footer regions, and a static no-build implementation that is easy to iterate. Recent changes also improved spacing, card proportions, table density, form inputs, and container width behavior.

The remaining gaps are mostly structural rather than cosmetic. The portal approximates CD Bund components with custom HTML helpers and page-level inline styles, while the official system relies on specific BEM-style component anatomy, section/container composition, and navigation behavior. The biggest alignment wins will come from adopting official markup patterns for shell, cards, buttons, forms, notifications, and page layout.

## Priority scale

- **P0 Blocking:** damages recognizability, accessibility, or layout fundamentals.
- **P1 High:** visible CD Bund mismatch on common pages/components.
- **P2 Medium:** polish, consistency, or maintainability gap.
- **P3 Low:** future hardening once the prototype stabilizes.

## 1. Global HTML structure

### P1: Header and footer IDs/classes do not match the official global shell

**CD Bund pattern**

`HtmlStructure.mdx` defines:

```html
<header id="main-header">
  <a href="#main-content" class="skip-to-content">Skip to main content</a>
  <div class="top-bar" />
  <div class="top-header" />
  <div class="desktop-menu" />
  <div class="mobile-menu" />
  <div class="breadcrumb" />
</header>
<main id="main-content">...</main>
<footer id="main-footer">...</footer>
```

**Portal today**

`index.html` uses `<header id="header">`, standalone `<nav id="breadcrumb-wrap">`, `<main id="main-content">`, and `<footer id="footer">`.

**Impact**

The visual shell can be approximated, but official global rules such as `#main-header`, `#main-footer`, `.skip-to-content`, `.desktop-menu`, `.mobile-menu`, and breadcrumb behavior cannot be reused directly.

**Recommendation**

Rename shell regions to the official structure and render top bar/header/navigation/breadcrumb inside `#main-header`. Keep the current router, but align DOM landmarks and class names.

### P1: Skip link is visually close but class name differs

**CD Bund pattern**

The official class is `.skip-to-content`; it uses a dark secondary background, white border, shadow, and appears centered on focus.

**Portal today**

Uses `.skip-link` with similar styling.

**Impact**

Low visual risk after recent styling, but blocks direct CSS reuse and differs from documented developer guidance.

**Recommendation**

Rename `.skip-link` to `.skip-to-content`, or support both classes during migration.

## 2. Layout, sections, and containers

### P0: Page sections often combine `.container` and `.section`

**CD Bund pattern**

Sections are full-width rhythm blocks. Content width is constrained by a nested container:

```html
<section class="section section--default">
  <div class="container">...</div>
</section>
```

For content pages, the official examples use:

```html
<div class="container container--grid gap--responsive">
  <div class="container__center--xs">...</div>
</div>
```

**Portal today**

Many pages render `<div class="container section">...</div>`. We fixed the immediate padding bug by changing `.section` to `padding-block`, but the DOM still does not match the official composition.

**Impact**

Background rhythms, consecutive section spacing, centered reading widths, and broader-than-container behavior cannot be implemented like CD Bund.

**Recommendation**

Migrate page templates to:

- Home/hub pages: `<section class="section section--default"><div class="container">...`
- Detail/form pages: `<section class="section section--default"><div class="container container--grid gap--responsive"><div class="container__center--xs|sm">...`
- Split/detail pages: official `container__main` and `container__aside` instead of custom `.split`.

### P1: Official 12-column subcontainer system is absent

**CD Bund pattern**

Uses `.container--grid`, `.container__full`, `.container__center--xs`, `.container__center--sm`, `.container__center--md`, `.container__main`, `.container__aside`.

**Portal today**

Uses custom `.measure`, `.split`, `.grid--2`, `.grid--3`, `.grid--4`, and inline `max-width`.

**Impact**

Detail pages and forms do not have the same reading measure and aside proportions as official pages.

**Recommendation**

Add official container subcontainer utilities to `css/app.css`, then convert `split` and `measure` usages incrementally.

### P1: Responsive grid naming and gaps differ

**CD Bund pattern**

`grid grid--responsive-cols-2|3|4 gap--responsive`.

**Portal today**

`grid grid--2|3|4` with fixed `1.5rem` gap.

**Impact**

Cards and tiles do not adapt with the same gap rhythm as CD Bund, especially at `xl`/`3xl`.

**Recommendation**

Add aliases or migrate markup to official grid names. Use `gap--responsive` for all card/list grids.

## 3. Header and navigation

### P1: Top bar is static, not the official drawer

**CD Bund pattern**

`TopBar.vue` has a button `top-bar__btn`, opens `.top-bar__drawer`, includes localization breadcrumb, authority lists, and a negative search/filter area.

**Portal today**

Top bar is a static link row with prototype chip, Notfall/eGate links, language select.

**Impact**

The top bar looks plausible but does not behave like the official federal authority switcher.

**Recommendation**

For higher fidelity, implement the top-bar drawer skeleton, even with demo content. If out of scope, document it as a deliberate prototype simplification.

### P1: Header lacks official meta navigation and burger/mobile integration

**CD Bund pattern**

`TopHeader.vue` contains `Logo`, `MetaNavigation`, `SearchMain`, optional shopping cart, language switcher for freebrand/mobile, and `Burger`.

**Portal today**

Logo plus a custom search form. Meta links live in the top bar, and mobile nav is a simple inline toggle in the main nav.

**Impact**

The header feels like a simplified admin-style shell, not the full CD Bund header.

**Recommendation**

Add a meta-navigation area in `.top-header__right`; move Notfall/eGate-style utilities there if they remain. Replace the simple mobile nav with a dedicated `.mobile-menu` container later.

### P1: Desktop menu markup does not match official `.desktop-menu` / `.main-navigation`

**CD Bund pattern**

`DesktopMenu.vue` wraps a `.main-navigation` inside `.desktop-menu`, supports drawers, overlay, sticky behavior, and "more" behavior.

**Portal today**

Uses `<nav id="main-nav" class="main-nav">` with a simple list.

**Impact**

Top-level nav styling can be matched, but overflow, active drawer states, sticky behavior, and mobile parity are missing.

**Recommendation**

Introduce:

```html
<div class="desktop-menu">
  <div class="container container--flex">
    <nav class="main-navigation main-navigation--desktop">...</nav>
  </div>
</div>
```

Keep the current hash links at first; add drawer/overflow only if the IA requires it.

### P2: Breadcrumb is simplified

**CD Bund pattern**

Breadcrumb is `.breadcrumb container container--flex`, with `BreadcrumbNavigation` and a `.breadcrumb__drawer` for dropdown behavior.

**Portal today**

Separate `<nav id="breadcrumb-wrap" class="breadcrumb">` with a nested container and plain chevrons.

**Impact**

Good enough for static paths, but not official for dropdown/overflow behavior.

**Recommendation**

Move breadcrumb into header shell and align class structure. Dropdown behavior can remain deferred.

## 4. Hero and home composition

### P1: Home hero does not use official hero anatomy

**CD Bund pattern**

`Hero.vue` uses `.hero`, `.container--grid`, `.hero__content`, `.hero__title`, `.hero__description`, `.hero__cta`, and optional `.hero__image`.

**Portal today**

Home has a gray full-width hero with raw `h1`, `.lead`, and a custom search form.

**Impact**

The hero is credible but not structurally aligned. It also lacks the official responsive hero content tracks.

**Recommendation**

Rebuild home hero markup as:

```html
<section class="hero hero--hub">
  <div class="container container--grid gap--responsive">
    <div class="hero__content">...</div>
  </div>
</section>
```

Then decide whether the search belongs in `hero__cta` or a search-specific section below.

### P2: Home page section order is now product-specific

Current order is welcome hero, Aktuelles, Beliebte Services, Meine offenen Anfragen. This is acceptable for the portal proposition, but official homepage examples commonly use full-width section components such as top news, media, services, and topics, each as separate `.section` blocks.

**Recommendation**

Keep the order, but make each block an official `.section` with nested container and `section__title`.

## 5. Cards, tiles, and list patterns

### P1: Card HTML lacks official `card__content`

**CD Bund pattern**

`Card.vue` structure:

```html
<div class="card card--default card--clickable">
  <div class="card__image">...</div>
  <div class="card__content">
    <div class="card__body">...</div>
    <div class="card__footer">...</div>
  </div>
</div>
```

**Portal today**

`components.js` returns `.card > .card__body + .card__footer`, without `.card__content`. Some pages hand-code card-like anchors.

**Impact**

Official card CSS cannot be reused cleanly. Footer placement, clickable overlay, line clamp, and list-card variants are approximate.

**Recommendation**

Update `C.card()` and hand-coded card templates to include `.card__content`. Add official variants:

- `.card--default` for grid cards.
- `.card--flat` / `.card--list-without-image` for result/list pages.
- `.card--clickable` only when there is a footer action or full-card link.

### P1: Too many dashboards use card grids where CD Bund would use flat lists

**Portal today**

Services, cases, directives, data products, documents, and media often use card grids.

**CD Bund pattern**

Home and hub pages can use card grids. Detail pages and result lists often use `.card--flat`, `.list`, `download-items`, tables, or content flow inside centered containers.

**Impact**

The app reads more like a generic SaaS dashboard than a federal content/service portal.

**Recommendation**

Convert:

- `knowledge` Weisungen list to `.card--flat` or official list.
- Search results/service hits to list/card-list pattern.
- Document/download rows to `download-item`-like rows.
- Data catalog can remain cards, but detail pages should be content-flow.

### P2: Custom `.tile` component is not a CD Bund component

**Portal today**

Home service teasers use `.tile`.

**Impact**

It approximates a teaser/card but lacks official component semantics and states.

**Recommendation**

Replace `.tile` with official `card--flat` or `card--default`, depending on section style.

## 6. Buttons and links

### P1: Button anatomy differs

**CD Bund pattern**

`Btn.vue` emits:

```html
<a class="btn btn--outline btn--icon-right">
  <svg class="btn__icon">...</svg>
  <span class="btn__text">Label</span>
</a>
```

**Portal today**

Buttons place icon spans directly inside `.btn`; text is raw.

**Impact**

Icon positioning, screen-reader behavior for icon-only buttons, text wrapping, and official spacing are approximated.

**Recommendation**

Add a `C.button()` helper that emits `btn__icon`, `btn__text`, `btn--icon-left|right|only`, and use it for repeated buttons.

### P2: Link taxonomy is incomplete

**CD Bund pattern**

There are distinct link, button-link, footer link, download item, and external link patterns.

**Portal today**

Uses raw anchors, `.btn--link`, and inline icons inconsistently.

**Recommendation**

Create helpers for:

- `C.textLink()`
- `C.actionLink()`
- `C.downloadItem()`
- `C.externalLink()` if external marking is retained.

## 7. Forms, search, and validation

### P1: Form markup lacks official `form__group` wrappers

**CD Bund pattern**

Forms use `.form`, `.form__group`, `.form__group__input`, `.form__group__select`, label classes, `.form__group__required`, and badge messages.

**Portal today**

Uses `.form .field`, `.input-error`, `.err`, and custom field helper functions in apps.

**Impact**

Visual spacing is close, but accessibility/validation markup and official class reuse are not aligned.

**Recommendation**

Introduce a shared form-field renderer that emits official form group structure. Migrate service flows first (`space-request`, `fault-report`, `workspace`, `document-archive` filters).

### P1: Search patterns are mixed

**CD Bund pattern**

`SearchMain.vue` uses `.search search--main`, `.search__group`, hidden heading, official input, and `.search__button`.

**Portal today**

Header search is a custom form with `.search--main`, `input`, `.search__btn`. Hero and page searches use `.hero__search`.

**Impact**

Recent behavior is better, but CD Bund search class anatomy still differs.

**Recommendation**

Adopt official search structure for header and define a separate page-search pattern for large service search. Avoid reusing `.hero__search` outside hero contexts.

### P2: Select markup is close but class names differ

**CD Bund pattern**

`.select > select + .select__icon`

**Portal today**

`.select-wrap > select + .icon`

**Recommendation**

Rename `.select-wrap` to `.select`, and use `.select__icon`. Keep the current CSS as alias during migration.

## 8. Notifications, badges, status, and messages

### P1: Notification anatomy differs

**CD Bund pattern**

`.notification`, optional `.notification__icon`, `.notification__header`, `.notification__content`, `.notification__close`, and `.notification--with-title`.

**Portal today**

`C.notification()` emits `.notification > .icon + div`.

**Impact**

The look is close, but title/close/content offset variants cannot match official behavior.

**Recommendation**

Update `C.notification()` to emit official child classes. Use no close button by default if the prototype does not support dismissing.

### P2: Audience tags are custom

**Portal today**

`.tag-internal`, `.tag-external`, `.tag-both` use custom colors.

**CD Bund pattern**

Badges use named variants (`gray`, `red/error`, `yellow`, `orange/warning`, `green/success`, `blue/info`, etc.).

**Recommendation**

Map audience tags to official badge variants or define documented domain-specific variants with design approval.

## 9. Tables and data-heavy surfaces

### P1: Tables are close visually, but sorting/accessibility classes are absent

**CD Bund pattern**

`table`, `.table`, `.table--zebra`, `.table--compact`, `.table__sorter`, optional visible caption.

**Portal today**

`C.table()` outputs `table.data`, with no caption support, no `aria-sort`, no sort controls.

**Impact**

Tables look acceptable but cannot adopt official sortable/table variants.

**Recommendation**

Update `C.table()` to support:

- `class="table table--zebra"` aliasing.
- Optional caption.
- `scope="col"` on headers.
- Sorter button markup for sortable columns later.

### P2: Portfolio map/media previews are custom app UI

This is expected for micro-app surfaces, but inline styles and custom colors reduce CD Bund consistency.

**Recommendation**

Move map/media CSS into `css/app.css`, and frame them as app-specific components with documented deviations.

## 10. Footer

### P1: Footer still uses inline list styling and lacks official link columns

**CD Bund pattern**

`FooterInformation.vue` uses `.footer-information`, `.footer-information__entry`, `.footer-information__links`, `.footer-information__links-column`, `.footer__link`, and icon-right modifiers. `FooterNavigation.vue` uses `.footer-navigation`.

**Portal today**

Footer has plain grid columns and inline `style="list-style:none"` on lists, with CSS approximations.

**Impact**

Footer is visually closer after CSS changes, but not structurally aligned.

**Recommendation**

Refactor `shell.js` footer markup to official classes. Resolve encoding issues first to avoid corrupting German text.

## 11. Mobile behavior

### P0: Mobile menu is not official

**CD Bund pattern**

Dedicated `.mobile-menu`, mobile meta navigation, burger control, body classes (`body--mobile-menu-is-open`), and menu tree behavior.

**Portal today**

Inline `nav-toggle` opens the same nav list as a vertical list.

**Impact**

This is one of the largest interaction fidelity gaps, especially for stakeholder demos on tablet/mobile.

**Recommendation**

Implement a dedicated mobile menu shell, even if second-level navigation remains simple.

### P2: Sticky top bar/navigation behavior is absent

Official components support sticky placeholders and scroll behavior. The portal currently uses static shell regions.

**Recommendation**

Defer unless stakeholders specifically need sticky navigation. Do not implement sticky behavior until mobile menu is corrected.

## 12. Accessibility

### P1: Focus and landmarks improved, but official landmarks are incomplete

Recent focus styling is close. Remaining issues are shell landmarks/classes, breadcrumb placement, mobile menu semantics, and button/icon text wrappers.

### P1: Form error messages are not consistently linked to controls

**Portal today**

Errors are rendered as `.err` but generally not connected via `aria-describedby`; invalid controls do not consistently use `aria-invalid`.

**Recommendation**

When migrating form fields, add `aria-invalid`, `aria-describedby`, and badge/message IDs.

### P2: Icon rendering via CSS mask has limited semantic variants

Most icons are decorative and marked `aria-hidden`, which is fine. Action icons inside buttons need official `btn__icon` and text wrappers for robust icon-only behavior.

## 13. Implementation hygiene

### P1: Inline styles are widespread

Evidence: `rg -n "style=" js index.html` returns many matches across `home`, `knowledge`, `data`, `portfolio`, `mediathek`, `workspace`, service flows, and `shell`.

**Impact**

Inline styles bypass the design tokens and make CD Bund conformance harder to reason about.

**Recommendation**

Create app-specific component classes for recurring patterns:

- media preview swatches
- inline metadata rows
- compact action rows
- aside link rows
- narrow form/search widths
- distribution/download rows

### P1: `components.js` should become the alignment choke point

Right now pages hand-code many cards/buttons/notifications/tables. The fastest route to consistency is to make `C.*` helpers emit official anatomy, then migrate pages away from bespoke HTML.

**Recommendation**

Prioritize helper changes in this order:

1. `C.icon()` support official role/label options.
2. Add `C.button()` and use official button anatomy.
3. Update `C.card()` to official structure.
4. Update `C.notification()` to official structure.
5. Update `C.table()` to official table classes.
6. Add official form field/select helpers.

### P2: Encoding/mojibake complicates safe refactors

Several files display mojibake in terminal output, and earlier patching against German text was brittle.

**Recommendation**

Normalize files to UTF-8 and verify rendering in browser and Git before large markup refactors.

## 14. Suggested remediation roadmap

### Phase 1: Structural shell alignment

- Rename top-level shell IDs/classes to `main-header`, `main-footer`, `.skip-to-content`.
- Wrap navigation in `.desktop-menu` and `.main-navigation`.
- Move breadcrumb into header and align `.breadcrumb container container--flex`.
- Refactor footer markup to official classes.

### Phase 2: Layout system migration

- Add official container subcontainer classes and `gap--responsive`.
- Convert `container section` pages to `section > container`.
- Replace `.split` with `container__main/container__aside`.
- Convert form pages to `container__center--sm` or `container__center--xs`.

### Phase 3: Component anatomy migration

- Update shared helpers for buttons, cards, notifications, tables, and selects.
- Remove most inline styles.
- Convert home/service/knowledge/data lists to official card/list variants.

### Phase 4: Interaction parity

- Implement a dedicated mobile menu.
- Consider top-bar drawer behavior.
- Add table sorting semantics where relevant.
- Improve form validation accessibility.

### Phase 5: Visual polish and regression

- Run Storybook side-by-side visual comparisons against: home, hub, detail, form.
- Add a small screenshot checklist for desktop/tablet/mobile.
- Keep documented deviations for micro-app-specific components such as maps and media previews.

## Current status after recent changes

Already improved:

- CD Bund token alignment and 3xl container width.
- Section block padding preserving container width.
- Top-bar icon simplification.
- Header search no longer has custom focus-expand behavior.
- Landing page content order and removal of nonessential stats/emergency blocks.
- Card, button, table, input/select, notification, footer visual tuning.

Still highest-value work:

1. Official shell DOM.
2. Official section/container layout.
3. Official component child markup.
4. Mobile menu.
5. Inline style cleanup.
