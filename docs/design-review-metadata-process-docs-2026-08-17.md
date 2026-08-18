# Metadata catalogue and process documentation design review

Date: 2026-08-17  
Scope: `js/apps/metadata-catalog.js`, `js/apps/process-docs.js`, their shared explorer/detail patterns, and the navigation paths that lead into them.

This review uses `katalog-prozessdoku-ux.md` and `katalog-prozessdoku-review.md`
as historical evidence. It retains their strongest decisions—one hierarchy,
one-level Back navigation, shared landscape state, and URL-addressable views—but
deliberately supersedes the old record-default and cross-record tab-persistence
rules with the information-first model below.

> **Follow-up, 2026-08-18:** explicit product direction restored the shared
> `detail-layout` contact rail on record **Overview** tabs. The historical
> no-aside decisions below remain useful rationale, but the current contract is
> documented in the final section of this review and supersedes those passages.

## Outcome

The two applications now follow one information-first detail model:

1. The selected entity is the page title.
2. Its overview opens by default and explains what the entity is before exposing its structure.
3. A single hierarchy rail provides context and navigation.
4. Text tabs switch between sections of the selected entity.
5. The overview uses a full-width, responsive content anatomy instead of a second sticky aside.

Collection scopes still offer overview, landscape, and table representations. Those controls change how a collection is shown; they are intentionally different from the tabs that navigate the contents of one record.

Existing route identifiers and legacy `tab` query values remain supported, so bookmarks and indexed links do not need a migration.

The review also corrected interaction defects discovered while following that
model end to end: the unified process root now searches and exports both process
branches, filtered summaries agree with their result count, hierarchy
disclosures are keyboard-operable, and process metadata no longer waits for a
BPMN request.

## Review method

The review followed real navigation paths rather than evaluating isolated screenshots:

- entered each app through the Data overview and global application navigation;
- moved through root, branch, group, record, and record-part scopes;
- followed links from landscape tiles, tables, the hierarchy tree, search, and related records;
- compared headings, back links, breadcrumbs, controls, panels, and empty/error states;
- inspected shared components for tab, tree, catalogue-bar, and responsive behavior;
- checked keyboard interaction, focus ownership, accessible relationships, narrow layouts, and existing URL contracts.

## Findings and decisions

### D1. Record selection opened implementation detail instead of meaning

**Impact: high. Implemented.**

Business objects and data tables previously opened on their attribute or field table. That made the first answer to “what is this?” a schema listing. It also made the detail view feel like another collection page.

Record links now open **Overview**. The overview presents the description, classification, ownership, status, source, and technical context first. Attributes, fields, and values remain one explicit tab away. Direct links that explicitly request that tab still work.

### D2. Equivalent details used different page anatomies

**Impact: high. Implemented.**

Metadata records, fachlich processes, and portal process definitions used different combinations of headings, cards, sections, and sidebars. The process detail combined the hierarchy sidebar with `detail-layout__aside`, producing two competing rails and an unnecessarily narrow reading column.

Both applications now use the shared `.mc-detail` anatomy:

- description;
- responsive fact sections;
- optional full-width source, standards, or related content.

`detail-layout__aside` is no longer used in either application. This is a local design decision, not a global deprecation: an aside can still be appropriate on a detail page where it is the only secondary rail and contains a persistent action or contact.

### D3. Metadata detail did not identify the selected entity as the page

**Impact: high. Implemented.**

The metadata application kept the application name as its H1 while the selected record was presented lower in the pane. This weakened orientation, document outline, browser titles, and screen-reader heading navigation.

The current scope now owns the H1: branch, group, record, and record part each receive an appropriate title and contextual lead. The application name remains in the breadcrumb and document title.

### D4. Icon view switches were doing the work of content tabs

**Impact: medium. Implemented.**

An overview, a process diagram, and process steps are sections of one entity, not alternate visualizations of the same result set. Representing them as icon-only view buttons made the relationship unclear and provided weaker orientation for keyboard and assistive-technology users.

Record details now use the shared APG-style text tabs with roving `tabindex`, `aria-selected`, panel relationships, Arrow keys, Home, and End. Labels name their actual content: for example **Attribute**, **Felder**, **Werte**, **Prozessdiagramm**, and **Prozessschritte**. Aggregate scopes retain the compact view switch because there it represents a genuine presentation choice.

### D5. Presentation state leaked into the next selection

**Impact: medium. Implemented.**

Links generated from an active table/diagram view preserved that mode when a different entity was selected. A reader inspecting attributes could therefore select another object and bypass its overview without asking to do so.

Entity and record-part links now reset to the information-first default. Presentation state remains stable only while the reader is working with the same entity. Explicit deep links remain authoritative.

### D6. Controls were visible where they had no effect

**Impact: medium. Implemented.**

Sort and group controls appeared in overview contexts where they could not change the content. The process-detail search field was rendered but was not wired to a useful search result transition. Selected-record chips also repeated the H1 without adding a removable filter.

Controls are now contextual:

- sort and group actions appear only for presentations they can change;
- process search submits to the process collection search;
- detail pages omit redundant scope chips;
- export actions remain available and export the named detail scope.

### D7. “Systeme” named the grouping dimension, not the selectable entity

**Impact: medium. Implemented.**

The metadata navigation labelled a branch **Systeme**, while its selectable records are data tables. “System” is only the axis used to group those records. This caused an information-architecture mismatch between the menu, tree, architecture overview, and detail labels.

The branch is now named **Datentabellen**. **System** remains the group heading and metadata property where it is accurate.

### D8. Portal and fachlich process details exposed different amounts of context

**Impact: medium. Implemented.**

The two process branches used separate overview grammars. Related processes, source information, responsibilities, and supporting context could appear in one branch but had no equivalent placement in the other.

Both now render through the same overview skeleton. Sections include only facts that exist for the selected record; the absence of branch-specific fields no longer changes the page structure.

### D9. The responsive layout nested one side rail inside another

**Impact: high. Implemented.**

The hierarchy rail plus process-detail aside left the main facts competing for width, especially between tablet and desktop breakpoints. On a phone, the resulting order also separated related facts from the description that introduced them.

The hierarchy remains the only rail. `.mc-detail__facts` uses an intrinsic responsive grid and stacks naturally without a special mobile markup variant. Long identifiers, links, and source content stay inside a `min-width: 0` content boundary.

### D10. Repeated labels competed with the content

**Impact: low. Implemented.**

The process description appeared both beneath the H1 and inside the Overview, while record chips repeated the selected record name. The page-header lead now supplies concise classification context; the full description has one home in Overview.

### D11. The process root looked unified but searched only one branch

**Impact: high. Implemented.**

The root cards, hierarchy, and group summaries included 27 records across the
fachlich and portal branches, while root search, count, recent records, and
export silently operated on the 18 fachlich records. A search for a portal-only
process could therefore return nothing on the page that visibly advertised it.

The root now has one 27-record universe. Mixed-branch tables and exports include
the branch as an explicit column; scoped views retain a useful branch-relative
denominator.

### D12. Filtered process views disagreed about their contents

**Impact: high. Implemented.**

Diagram and Table used the filtered result, but aggregate Overview calculated
its facts from the unfiltered scope. The result count and active query could say
one process while Overview described the full group.

All three representations now use the same filtered records. A zero-result
Overview or landscape shows the same query-aware empty state and a
scope-preserving reset action instead of blank metadata.

### D13. Split hierarchy disclosures were unreachable by keyboard

**Impact: high. Implemented in the shared component.**

A tree row that both navigates and exposes children has two independent
actions: its label selects the entity; its chevron reveals descendants. The
fold control was removed from the Tab sequence in navigation trees, so keyboard
users could not reveal metadata fields or process descendants.

Navigation-mode fold buttons now use normal button keyboard behavior. Enter and
Space toggle the disclosure, lazy children become reachable, and focus returns
to the replacement button after redraw. Select-mode trees retain their single
roving tree-item tab stop.

### D14. Overview waited for a document it did not display

**Impact: medium. Implemented.**

Opening a process fetched and parsed BPMN before rendering the page shell and
metadata. A slow or broken document therefore delayed the useful Overview.

The detail shell renders immediately. Diagram, steps, and process-step exports
share one deferred, cached document load. The steps tab receives its count once
parsing succeeds, and viewer failures point to the accessible step view.

### D15. Root-card and export labels described too much or too little

**Impact: medium. Implemented.**

Root cards were whole anchors, which made count and metric prose part of one
long link name. At the other extreme, a generic **CSV herunterladen** action on
Overview did not disclose that it exported records or process steps rather than
the visible facts.

Both roots now use the shared stretched-title-link card pattern. Counts remain
visible ordinary content. Export menus name their dataset—for example process
list, process steps, attributes, fields, or values—while retaining the existing
action identifiers.

### D16. Metadata facts do not follow the federal information-block anatomy

**Impact: medium. Implemented.**

The former `.mc-detail__facts` auto-fit grid placed fact sections beside one
another in narrow panels. Those panels can activate the local `.kv` container
query, so the row anatomy changes with the number of fact groups rather than the
viewport. At 1440 px the three-group SAP table has stacked label/value rows,
while the two-group Heizzentrale record has horizontal rows in the same pane.
This weakens both scan order and label/value consistency.

The Swiss Federal Design System uses a different detail pattern. Its
`InfoBlock` examples form one ordered stream. The two columns live *inside each
row*: label and value stack only below the `md` breakpoint, use equal halves at
`md`, and use a one-third/two-thirds split from `lg`. It does not arrange the
information blocks themselves as side-by-side fact cards. The portal should
retain semantic `<dl>`, `<dt>`, and `<dd>` markup while adopting that visual
anatomy rather than turning field labels into headings.

The metadata implementation now:

- makes record fact sections one full-width, DOM-ordered content stream;
- keeps each label/value row horizontal from the design system's `md` breakpoint
  upward, with the small-screen stack retained to prevent overflow;
- scopes the CSS to metadata details, because process documentation shares the
  `.mc-detail` class and should not change without its own visual check;
- removes the standalone **Original** box from all business-object and data-table
  record overviews, including `?id=heizzentrale` and
  `?table=sap-refx-vibdbe`;
- retains useful provenance such as leading system, reference, reconciliation
  date, and safe repository link as ordinary rows in the appropriate existing
  section, without the **Original** heading or `.mc-detail__wide` box; uses the
  concrete table system name, a semantic `<time>`, and an accessible new-window
  cue where applicable; and
- verifies the ordered facts, heading hierarchy, long-value wrapping, and lack of
  horizontal overflow at 320, 768, 1024, and 1440 px. At 768 px rows are
  1:1 and at 1024 px and above they are 1:2, matching the local design
  system.

This follow-up supersedes only D9's intrinsic multi-column fact-grid decision;
the single hierarchy rail and removal of `detail-layout__aside` remain valid.

### D17. Narrow layouts reverse visual order without changing focus order

**Impact: medium. Implemented.**

Metadata detail markup now places primary content before the hierarchy tree in
the DOM, accessibility tree, and keyboard order. At 1024 px, metadata-scoped
grid areas put that same tree node in the left column without moving or
duplicating it. The 320 and 768 px regressions drive actual Tab progression;
the desktop transition also proves the focused tree node remains stable.

The implementation is metadata-scoped. Process documentation still places its
hierarchy first in the DOM while visually moving the main pane first below
1024 px; the equivalent narrow-screen focus-order mismatch remains open there.

## Resulting interaction contract

| User action | Result |
|---|---|
| Open a catalogue branch or group | Open its aggregate default presentation |
| Select a business object, data table, value list, or process | Open that entity's Overview |
| Select another entity while a non-default tab is active | Open the new entity's Overview |
| Follow a URL with an explicit supported `tab` value | Open the requested tab |
| Select an attribute, field, or value | Open its information page; do not show a one-item tab bar |
| Use Arrow keys, Home, or End on record tabs | Move and activate according to the shared tabs pattern |
| Submit process search from a detail | Return to the searchable process collection |
| Search from the process root | Search both fachlich and portal branches |
| Open a process Overview | Render metadata without requesting BPMN |
| Operate a split tree disclosure with Enter or Space | Toggle descendants and keep focus on the disclosure |

## Maintainability effects

- One detail anatomy replaces branch- and app-specific markup variants.
- Shared tab primitives own keyboard and ARIA state instead of local click handlers.
- Record links enforce the default-view rule in one URL builder per application.
- Labels distinguish entity nouns from grouping axes.
- Shared root cards and contextual export labels avoid app-specific accessible names.
- The shared sidebar tree owns disclosure keyboard behavior for every explorer.
- Source comments touched by this work describe durable behavior in English; historical narration was not added.

## Validation

The implementation is covered by focused metadata-catalogue,
process-documentation, and shared-sidebar browser suites; pure catalogue-state
checks; syntax checks; CSS layer/token checks; and the repository's
English-source gate. The browser checks include default view selection,
explicit deep links, cross-record reset behavior, unified root search, filtered
summary parity, deferred BPMN loading, heading hierarchy, absence of the nested
detail aside, tab and disclosure keyboard behavior, focus restoration, and
narrow-layout overflow/order.

A final visual matrix covered root, record, table, and diagram routes at 320,
768, and 1440 px. It confirmed whole-word heading wraps, a single-column detail
flow before the secondary hierarchy on phones, and the restored desktop rail.

## Follow-up implementation — Overview contact rail (2026-08-18)

Metadata record details and process details now use the same Overview anatomy as
the portfolio application:

- `.detail-layout` contains one DOM-ordered `.vertical-spacing` fact stream,
  beginning with **Beschreibung**;
- fact sections use direct `<dt>`/`<dd>` children in the shared plain `.kv`
  grid;
- governance roles and AdminDir people remain in **Verantwortung**, while the
  actionable team contact appears once in an **Ansprechpersonen** card inside
  `.detail-layout__aside`;
- the aside exists only in Overview content; fields, attributes, values,
  diagrams, and process steps retain the full panel width; and
- because these pages already have a hierarchy rail, the nested contact area
  stays below the facts from 1024 through 1279 px and becomes the sticky 22rem
  right rail from 1280 px. This avoids the squeeze that motivated D9 while
  preserving the requested desktop pattern.

This decision supersedes Outcome item 5, the no-aside conclusions in D2 and D9,
the final single-rail statement in D16, and the old validation assertion that a
nested detail aside must be absent. The remaining information-first, routing,
navigation, accessibility, and hierarchy decisions are unchanged.
