# Design Alignment — Tenant Portal ↔ Service Portal ↔ CD Bund

**Shared document.** The identical file lives in both prototype repos:
`tenant-portal/docs/design-alignment.md` and `service-portal/docs/design-alignment.md`.

| | |
|---|---|
| Date | 2026-08-21/22 |
| Reference | `swiss/designsystem` local clone (`designsystem/css/**`, `app/tailwind.config.js`, Vue components) — **read from source, not assumed** |
| Prototypes | `tenant-portal` (Mieterportal — medium ambition) · `service-portal` (Kundenportal — large ambition) |
| Method | Three-way source diff of every shared CSS family (tokens, chrome, layout, typography, buttons, forms, tables, pagination, cards, badges, notifications, tabs, accordion, footer, focus/skip) + rendered screenshots at 375/768/1280/1600 px + live computed-style measurement of both apps side by side |
| Scope rule | Visual/structural refactor only. **No feature is added or removed.** Where one app has a feature the other lacks (cart, back-to-top, role switching, drill-down drawers), the feature stays and only its *styling* is aligned. |

---

## 1. Verdict in one paragraph

Both prototypes are genuinely close to CD Bund — the token layers (color ramps, type scale,
container/gap/section ramps, radii, shadows) are **numerically identical to the CD and to each
other** in almost every value. The differences that make the two apps feel different are
concentrated in (a) a handful of *semantic* choices (focus-ring thickness, lead-paragraph
color/size, hover hues, table header case), (b) *chrome anatomy* where tenant re-created CD
components under portal-local class names while service ports the CD classes verbatim
(logo/lockup, meta navigation, mobile menu zones, footer), and (c) *mobile behavior*
(sub-480 brand lockup, open header search, demo-chip visibility, table density). Each app also
carries a few outright bugs against its own intent (service: disabled language select paints a
filled box on the top bar, drawer anchors to the viewport instead of the container; tenant: open
mobile search overlaps the federal lockup, hero+section seam double-pads).

## 2. Reference baseline (CD Bund, from source)

Facts every decision below is anchored to (files in `designsystem/`):

- **Breakpoints** `xs 480 · sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1544 · 3xl 1920` (`app/tailwind.config.js:20-28`).
- **Container** px `16/28/36/40/48/64`, max-width `1544 @2xl → 1676 @3xl` (`css/layouts/container.postcss`).
- **Type ramps** `text--base 16/16/18/20`, `--sm 14/14/16/18`, `--xs 12/12/14/16`, `--lg 18/18/20/22`, `--xl 20/22/26/32`, `--2xl 22/26/32/40`, `--3xl 26/32/40/48` at base/lg/xl/3xl (`css/foundations/typography.postcss`).
- **Section rhythm** `container--py = 56/80/128`; hero top `48/56/80`; consecutive same-background sections collapse (incl. `.hero + .section--default`) (`css/layouts/section.postcss`, `sections/hero.postcss`).
- **Focus** `*:focus-visible → ring-2 (2 px) purple-500 #8655F6, no offset, z-10`; purple-300 `#C4B5FD` on `.top-bar` and `bg--secondary-500…900` (`css/foundations/global.postcss:75-86`).
- **Buttons** min-h `44/48/52` (base), `34/40/44` (sm), `48/52/56` (lg); `px-4`; left-aligned; radius 2 px; flat disabled fills, never opacity (`css/components/btn.postcss`).
- **Inputs** `px-4 py-2.5`, border 1 px `text-500 #6b7280`, radius 1 px, `shadow`, min-h `44 → 48 @2xl only`; size variants change type+leading only (`css/components/input.postcss`).
- **Tables** border `text-200`, `shadow-md`, cells `24/16`, thead `secondary-50` + **uppercase** `text--sm text-700`, row rules `text-300`, no row hover anywhere (`css/components/table.postcss`).
- **Badges** `py .219em / px 1em`, pill, `12/14 @768/16 @1024` + `leading 20/24`; color pairs `*-100` bg / `*-800` text (`css/components/badge.postcss`).
- **Notifications** padding `8/16/24/32`, radius 3 px, `shadow-lg`; variant pairs error `red-50/800`, success `green-50/800`, info `blue-50/700`, warning `orange-50/800`, hint `secondary-50/text-700`; banner `py 16/32 @640/40 @1024`, fixed variant carries a 1 px white frame + `shadow-2xl`; toast = a `.notification` at `bottom 10 %`, max-w 500 px (`notification.postcss`, `notification-banner.postcss`, `toast-message.postcss`).
- **Logo** flag `30×33 → 32×34 @lg → 40×44 @3xl`; wordmark from `xl`; separator `h 40/56 @md/70 @3xl` with `mx 8/16 @sm/24 @lg/32 @3xl`; title `sr-only` below 480 (acronym instead) and `12 @xs / 14 @sm / 16 @xl / 18 @3xl` (`css/components/logo.postcss`).
- **Top bar** `text-sm → base @2xl`; first link `pl-4 -ml-4 py-1 min-h 44`, label `w-min sm:w-full` (wraps, never hidden) (`css/sections/top-bar.postcss`).
- **Nav** row `h-14/16 @xl/20 @3xl`, links `px-4`, list `-ml-4`, 3 px rail `primary-500` inset by the link padding; drawer `450/650 @xl/850 @3xl` wide, `p-8 pt-16 → p-12 pt-20 → p-24`, **anchored at the navigation's left edge** (`navigations/main-navigation.postcss`, `sections/desktop-menu.postcss`).
- **Mobile menu (v1)** white panel: white nav rows → grey (`secondary-50`) meta rows → dark (`secondary-500`) federal rows, each `menu__item--small` with `secondary-100` rules; search integrated in the panel; `body` slides up by the top-bar height (`sections/mobile-menu.postcss`, `navigations/navy.postcss`, `foundations/global.postcss:34-38`).
- **Footer** `bg--secondary-600` info band + `bg--secondary-700` legal band; grid `lg:3 → xl:4` cols, gap 64, entry titles `text--xl` **regular**, mb `24/40 @lg`; link rows `py-16/px-8`, rule `secondary-300`, hover fills `secondary-700`; legal bar `py-12`, `text--xs` white links (`sections/footer.postcss` + `FooterInformation.vue`).

## 3. Gap analysis

Legend: **T** = tenant-portal, **S** = service-portal, **CD** = design system.
"→" names the alignment decision (§4). Documented `DELIBERATE DEVIATION` comments in either
repo were respected as input, not overridden silently.

### 3.1 Tokens (foundations)

| Aspect | T | S | CD | Finding |
|---|---|---|---|---|
| Color ramps (primary/secondary/gray/red…) | exact | exact | — | ✔ identical everywhere, incl. intranet skin values |
| Type/space/radius/shadow/container/gap ramps | exact | exact | — | ✔ identical numbers, different vocabularies (`--space-md` vs `--sp-4`) — naming kept per repo |
| Muted text | `--color-text-muted` = gray-**500** | = gray-**600** | `.text--light` = 500 | both used broadly; leads aligned to 600 (D18), other uses left per-app |
| Warning accent | `#F59E0B` amber | `#F97316` orange | orange family | → orange in both (D37) |
| Info accent | `#0F6B75` teal | `#3B82F6` blue | blue family | → blue family in both (D37) |
| Focus ring | 3 px, offset 2 | 2 px, offset 2 | **2 px, offset 0** | → 2 px both; shared 2 px offset kept as a deliberate common deviation (D17) |
| Fonts | 4 static Noto faces (`NotoSans`) | 1 variable Noto (`Noto Sans`) | 4 faces | kept — same family, same weights; infrastructure not worth churning (documented) |

### 3.2 Federal chrome

| Aspect | T | S | CD | Decision |
|---|---|---|---|---|
| Demo chip | uppercase, tracked, `red-700`, 2/8 px pad, hidden < 1024 | CD badge pill, federal red `#d8232a`, visible everywhere | one `.badge` in this slot | **D1/D4**: CD pill geometry, `#d8232a`, visible at all widths — S wins |
| Language switcher | custom listbox dropdown (functional DE/FR/IT/EN) | native select, disabled (DE only) — **bug: disabled fill `#828e9a` paints a box on the bar** | native select, transparent; disabled = opacity .4 only | **D2**: fix S background leak. T keeps its functional dropdown (feature); trigger geometry already CD (3.5em/4.5em, 24 px chevron) |
| "Alle Schweizer Bundesbehörden" | label hidden < 768 | wraps `w-min` < 640 | wraps `w-min` < 640, never hidden | **D3**: S/CD win |
| Auth placement | user pill in dark top bar | meta navigation (white bar) with separator + Abmelden | meta navigation carries site utilities | **D5**: S/CD win — T moves login/user to the meta bar |
| Lockup < 480 | full office name (duplicates the grey strip) | `BBL` acronym + strip | acronym + strip | **D6**: S/CD win |
| Lockup title size | 14 static < 1280 | 12 @480 / 14 @640 / 16 @xl / 18 @3xl | same as S | **D7**: S/CD win |
| Product sub-line | hidden < 1024 | always shown from 480 | title + block span | **D6**: shown from 480 in both |
| Grey mobile strip copy | "…Bauten und Logistik BBL" | "… — Kundenportal" | office name | **D6**: `office — portal` pattern in both |
| Meta row height | ~26 px rows | 48 px rows (a11y Item 2.5b) → brand bar 31 px taller | ~20 px rows + `mb 12/16` | **D8**: compact layout height in S, 44 px hit-area preserved via padding/negative-margin; brand-bar heights equalized |
| Header search label / icon | "Suchen", 28 px icon everywhere | "Suche", 36→28 @lg icon | `Suche`-style + 36→28 @lg | **D9**: S/CD win |
| Open mobile search | inline flyout, **overlaps the lockup** | full-width row below header, brand hidden | `.search--mobile` full-width row | **D10**: S/CD win — T repositions below the header |
| Open desktop search field | 2 px `gray-200` border, grey fill, radius 3 | 1 px `gray-500`, white, `shadow-2xl`, radius 1, `py-16 @lg` | 1 px text-500, white, shadow-2xl | **D10**: S/CD win |
| Nav link padding | `px-16` (CD) | `px-12` (dense — was for 9 items; now 5) | `px-16`, list `-ml-16` | **D11**: T/CD win — S returns to `px-16/-ml-16` |
| Active route marking | dropdown trigger not marked on its own overview route | trigger marked | `.active` rail | **D13**: S wins — T marks the trigger |
| Desktop drawer anchor | JS-positioned exactly under the trigger word | JS-positioned under the trigger minus `panel padding + 12` (overshoots; the first drawer clamps to the viewport edge) | **under the trigger minus the `.with-offset` step** (16/32 @xl/80 @3xl — `Navy.js:137-146` + `desktop-menu.postcss:36-38`), so the drawer's padding leaves its rows flush with the trigger text | **D12**: CD wins — both portals now run the identical Navy.js rule (offset + right-align-to-trigger overflow branch) |
| Drawer title | 18 px @xl (responsive, CD) | fixed 16 px | inherits `text--base` (18 @xl) | **D30**: T/CD win |
| Breadcrumb | tight (chevron margins only) | CD-roomy | links `px-16 py-8 / py-16 @md`, nav `-ml-16`, `text-sm`, hidden < lg | **D14**: CD paddings in both |
| Mobile menu zones | white nav rows → **dark** meta rows (right-aligned account) → dark lang row | white nav → **grey** meta → dark federal rows, search on top | white → grey → dark (v1) | **D15**: S/CD win — T re-tints meta to grey, left-aligns rows; T's language row stays (feature) as the dark foot zone |

### 3.3 Footer

| Aspect | T | S | CD | Decision |
|---|---|---|---|---|
| Class system | portal-local (`__col`, `__heading`, `app-footer__bottom`) | CD verbatim (`__entry`, `footer__link`, `footer-navigation`, `bg--secondary-*`) | — | **D16**: T adopts CD anatomy values (classes may stay, values align) |
| Heading weight | regular (CD ✔) | **bold** (leaks from global `h3` rule) | regular | S fixes to regular |
| Heading level | `h2` | `h3` | `h3` | T keeps `h2` SEMANTICS with the identical h3 LOOK — its a11y gate forbids the h1→h3 jump on h1-only pages (repair, queue); rendered output equal |
| Wide column | brand column spans 2 | links entry spans 2 (`--entry--big`) | links entry spans 2 | T follows S/CD |
| Mobile entry gap | 48 px | 64 px | 64 px | T → 64 |
| Link icons | 24 px arrow, 16 px gap, hover slides 4 px; arrow even for external links | 1.4em glyph, 0.2em gap, no motion; External icon for external links | 1.4em, 0.2em, no motion | T → CD values + external glyphs |
| Legal-bar ink | `rgba(255,255,255,.75)` | white | white | T → white |
| Brand paragraph rhythm | 24 px | 12/16 px | `mb-3 xl:mb-4` | T → CD |
| Back-to-top button | present (sticky-CSS variant, DS `back-to-top-btn--outline` skin) | present (rail variant, same DS skin) | DS component | both present; mechanisms differ, rendered button identical — kept |

### 3.4 Layout & typography

| Aspect | T | S | CD | Decision |
|---|---|---|---|---|
| Page top rhythm | 56/80/128 (CD) | 48/56/80 ("tighter above") | content after breadcrumb: 56/80/128; only `.hero` is 48/56/80 | **D21**: T/CD win — S page tops go to 56/80/128, heroes keep 48/56/80 |
| Hero + section seam | double-pads (112→256 px) | collapses (CD) | collapses | **D22**: port CD collapse rules to T |
| Hero content rhythm | flat 32 px | 24/32/40 stack (CD) | `space-y 24/32/40` | **D23**: S/CD win |
| Hero lead | 18-ramp, gray-500, 60ch cap, 16 px < 480 | 18-ramp, gray-600, no cap | 18-ramp, default ink, no cap | **D18**: 18-ramp + gray-600 + no cap in both; no phone downstep |
| Section intro | 16-ramp, gray-500, 60ch | `.lead` 18-ramp, gray-600 | closest = `hero__description` 18-ramp | **D18**: 18-ramp + gray-600 in both |
| h4/h5 line-height | 1.375 | 1.5 (CD) | 1.5 | **D19**: S/CD win |
| Page title | fixed CD ramp | `clamp(22px, 7.5vw, …)` < ~347 px | fixed ramp | **D24**: T/CD win — S drops the clamp |
| Page-header spacing | title→sub 8 px; bottom 24/32/48 responsive | 4 px; 24 flat | — | **D24**: T's values in both |
| Eyebrow/kicker | `.overtitle` .06em, gray-500, mb 8 | `.eyebrow` .08em, gray-600, mb 4 | (CD's `.overtitle` is a dark-hero element, no uppercase) | **D20**: unified portal recipe — uppercase 12-ramp, **.06em, gray-600, mb 8** |
| 12-col grid layer | absent (bespoke per surface) | full CD port | `container--grid`… | structural; not retrofitted (no rendered diff on existing pages) — documented |
| Two-column split | lg (1024) | md (768, CD) | md | noted; per-page (info TOC) kept — T's TOC layout is a documented choice |

### 3.5 Components (summary of the biggest visible splits)

| Component | Split a user can see | Decision |
|---|---|---|
| Buttons | T centers labels, S left-aligns (CD); T `--lg` is 32 px wider; T disabled anchors 50 % opacity; focus 3 px vs 2 px; T no `:active`; T no touch floor for `--sm` | **D25**: CD/S geometry everywhere; add `:active` + touch floor to T; flat disabled; filled buttons get the purple-300 dark-ground focus ring in both |
| Inputs | T `--sm`/`--lg` break the CD contract (44/62 px vs 46/50); S paints **red hover borders** on every field (CD: none); invalid border red-600 (T) vs red-500 (S/CD); error message plain 12 px text (T) vs badge pill (S/CD); labels bold (T) vs regular (S/CD) | **D26**: CD contract in both; S removes red hover; T: red-500 invalid, pill errors, regular labels; hint = 12 px text-500 in both |
| Tables | header sentence-case (T, documented) vs **uppercase** (S = CD); T hovers every row (CD: none); row-`th` bold/14 (T) vs regular/16 (S); S compact < 768, T stays full density | **D27**: uppercase default in both; hover only on clickable rows; T adopts S's < 768 density; zebra covers tfoot; caption text-500 + `pre-line` in both |
| Pagination | T: 8 px gaps, flat 24 px band, 44 px flat input, radius 3, no shadow, 50 % disabled | **D28**: S/CD win — 12 px gaps, 24/28/32 band, 44/48/52 input, radius 1 + shadow, flat disabled |
| Cards | T inner stack 8 px (CD 16); hover title red-600 + 120 ms (CD 700 + 300 ms); T fixed image heights (CD 16:9 ratio); result rows boxed (T) vs flat rule rows (S/CD) | **D29**: CD values in T; both keep the shared 12 px chip inset (joint deviation, documented) |
| Badges | class APIs don't overlap (`--danger` vs `--error/--red`); T lacks `--sm`; T icon-badges wider (extra gap) | **D30**: T adds `--error`/`--red` aliases + `--sm` + CD icon offsets |
| Step indicator / pipeline | T rings gray-400 (fails AA 2.54:1 — S measured) + bright-green confirm; S ring secondary-400, active primary + halo, confirm green-800 | **D30**: S's AA scheme in both; pipeline active rides the skin primary in both |
| Notifications | padding/colors identical ✔; banner radius 0 (T) vs 3 (S/CD); fixed frame full (T/CD) vs top-only (S); banner z above toasts (S) vs below (T); button margins absent (S) | **D31**: radius 3, full white frame, z below toasts, CD button margins — mixed wins |
| Prototype banner height | compact 16/24 (T, documented) | CD 16/32/40 | **D32**: compact in both — shared deliberate deviation (persistent bar in a dense app) |
| Toasts | bespoke pill, bottom 24 px, 480 px (T) vs CD `.notification` at bottom 10 %, 500 px (S) | **D38**: S/CD win — T re-bases its toast on the notification recipe (stacking behavior kept) |
| Tabs | rail/padding identical ✔; T's scroll-fade covers the rail; bar→panel gap collapsible (T); rounded focus (T) | **D33**: S/CD win on all three |
| Accordion | paddings identical ✔; chevron gutter flat 16 (T) vs 16/24/32 (S/CD); panel pb 48 (T) vs 40 (S/CD); S lacks the touch-hover guard | **D34**: ramp + 40 px in T; guard added in S |
| Home hero search | field 58 px (T) vs 52 px (S) | **D35**: both ride the `btn--lg` ramp (48/52/56) |
| Dropdown surfaces | three recipes (square/gray-500 · 3 px/gray-200 · 3 px/secondary-300) | **D26**: one recipe — square, 1 px `text-500`, like the CD multiselect |

### 3.6 Cross-cutting

- **Hover hue**: T darkens to `primary-600` where S and CD use `primary-700` (card titles). → 700.
- **Motion**: T 120–200 ms where S/CD use 300 ms for card shadows; rail transitions 200 (T) vs 150 ms (S/CD). → CD durations.
- **News overview**: T = centered editorial column with an article-style date line; S = left page header + card grid. Both are CD-legal patterns. → **D36**: page header (left title + lead) aligned in both; T's flat-list vs S's grid is retained as each portal's content-strategy choice (documented, one line below).

## 4. Recommendations (decision register)

Each decision names the winner and the loser's change. All were implemented unless marked *(documented only)*.

| # | Decision | Change in tenant | Change in service |
|---|---|---|---|
| D1 | Demo chip = CD badge pill, federal red `#d8232a` | geometry, case, color (`header.css`) | — |
| D2 | Disabled top-bar select stays transparent (CD: opacity-40 only) | — | bug fix (`header.css` — `.input--negative:disabled` outranked the resting rule) |
| D3 | Federal link label wraps `w-min` < 640, never hidden | replace `display:none` | — |
| D4 | Demo chip visible at every width | remove `display:none` < 1024 | — |
| D5 | Auth lives in the white meta bar (icon+name label, divider, Abmelden) | markup move (`shell.js`) + meta-user/divider styles | — |
| D6 | Acronym < 480; sub-line from 480; strip = "office — portal" | markup (`org.bblShort`/`org.bblPlain` i18n keys) + lockup-compact CSS | — |
| D7 | Lockup title 12 @480 / 14 @640 / 16 @xl / 18 @3xl | add the 12 px xs step | — |
| D8 | Meta rows: compact layout height, ≥44 px hit area | right-column gaps 12/16 @lg/xl | `padding-block:12px; margin-block:-12px` on the desktop meta entries (hit box stays, flow box shrinks); brand bars now 154 vs 153 px @1280 |
| D9 | Search label «Suche» (noun), icon 36→28 @lg | new `top.searchToggle` key + icon ramp | — |
| D10 | Open search: CD field skin (1 px text-500, white, radius-xs, `py-16 @lg`); mobile = full-width row below the header, lockup fades | reposition + restyle + `body--search-is-open` | — |
| D11 | Nav links `px-16`, list `-ml-16`, rail inset 16 (CD) | already CD | densification retired (was for 9 items; the row now carries 5) |
| D12 | Drawer = CD Navy.js placement: under the trigger − 16/32/80 offset, overflow → right-align to the trigger | shared `positionNavMenu()` with the offset (was flush-under-trigger) | same rule replaces the padding-based subtraction (first drawer no longer clamps to the viewport edge) |
| D13 | Nav trigger marks active on its own routes | `activeNav: 'services'` on overview/stubs/wizard/moves/cleaning/repair | — |
| D14 | Breadcrumb: CD crumb paddings (`px-16 py-16`), list `-ml-16`, sep `-ml-20/mr-12`, text-500 incl. current page | adopt (was chevron-margins-only) | already CD |
| D15 | Mobile menu = CD v1 zones: white panel, white nav rows, GREY meta rows (left-aligned), dark foot zone | panel → white + shadow-2xl; meta zone secondary-50; account rows left-aligned | — |
| D16 | Footer: regular text--xl headings, links entry `--big` (2 sub-columns), 64 px mobile gap, 1.4em/24 px icons at 0.2em, External glyphs on external links, white legal links, `mb-12/16` paragraph rhythm, no hover slide | several (`footer.css` + `shell.js` markup; headings stay `h2` semantically — see §3.3 — with the identical look) | un-bold h3 (global bold leak) |
| D17 | Focus ring 2 px purple everywhere; offset 2 kept as the joint deviation | 3→2 px global, dark-chrome, buttons, back-to-top, tabs, file-label, sections sweep | already 2 px |
| D18 | Leads: 18-ramp (`text--lg`), gray-600, snug leading, no measure cap, no phone downstep | `.section-intro` + `.hero__lead` | `.lead` gains the snug leading |
| D19 | h4/h5 line-height 1.5 (DS: leading-tight starts at `text--xl`) | change | already 1.5 |
| D20 | Eyebrow: uppercase 12-ramp, `.06em`, gray-600, mb 8 | ink 500→600 | tracking .08→.06, mb 4→8 |
| D21 | Page tops symmetric 56/80/128 (CD `container--py`); heroes net 48/56/80 | already CD | page root re-ramped; hero pages compensated via negative margin; `check-ramps` expectations updated |
| D22 | Hero + white-section seam collapses (`.hero + .section/.bg--white`) | port CD collapse rules (tinted bands keep their top) | already complete |
| D23 | Hero content stack 24/32/40 (`space-y-6 lg:8 3xl:10`) | sibling-margin rules on title/lead | already CD |
| D24 | Page header: fixed CD title ramp (no `clamp`), title→sub 8 px, bottom 24/32 @1024/48 @1280 | already so | drop clamp; adopt both spacings |
| D25 | Buttons: left labels, `--lg` px-16, 0.2em icon gap, 1.4em icons, `--sm` 44 px touch floor, `:active` states, flat disabled (no opacity), 2 px focus + purple-300 on `--filled` | all | already so (their `:active`/touch floor were the source) |
| D26 | Inputs: size variants = type+leading only (CD contract), NO resting hover tint, red-500 invalid, badge-pill error messages, regular labels, hints 12 px text-500, 24 px group gap, ONE dropdown surface (square, 1 px text-500, like the CD multiselect), select disabled opacity .4, checkbox `shadow` | `--sm/--lg` contract, labels, pill errors, invalid red, checkbox shadow + no hover, select opacity, combobox surface, multiselect focus ring | remove red field hover/active, hint recipe, group gap 40→24, listbox + suggest-shell surface |
| D27 | Tables: UPPERCASE headers (thead only), row-`th` at the body size, hover only on `--rows-clickable` (secondary-100), <768 density 8/12+sm, zebra covers tfoot, caption text-500 + `pre-line` | all (incl. `--caps` → inert alias) | caption ink 600→500 |
| D28 | Pagination: 12 px gaps, 24/28 @1024/32 @1544 band, input on the 44/48/52 ramp + radius-xs + `shadow` + px-8, CD icon-only buttons (0.625em + 1.4em glyph), flat disabled anchors | all | already CD |
| D29 | Cards: 16 px inner stack, hover title primary-700 @ 200 ms, shadow lift @ 300 ms, no translate lifts, 16:9 media ratio (property cards), result rows = flat `card--flat` geometry (rule secondary-200, `py-16/24/32 px-4`), grid result cards = `card--default` skin | all | already CD |
| D30 | Badges: `--error`/`--red`/`--danger` aliases, `--sm` ramp (tokens `--text-badge-sm`), CD icon offsets (no flex gap); step indicator = the AA scheme (ring secondary-400, active primary-600 + primary-100 halo, confirmed green-800); pipeline done = solid green-800, active = skin primary-600 | all | already so (scheme source) |
| D31 | Notification details: banner radius 3 (inherited), fixed banner full 1 px white frame, banner BELOW the toast layer, CD button margins (`mt-16/32, lg:ml-24`), first-child ¶ rhythm, 44 px close target | banner radius (drop the `radius:0` override) | frame, z (toast→overlay layer), button margins, ¶ rhythm |
| D32 | Prototype banner: compact 16 → 24 @640 padding — joint deliberate deviation vs CD's 16/32/40; action button auto-width left below lg (CD column) | drop the full-width mobile button | adopt compact padding |
| D33 | Tabs: 4 px-short scroll fade (never over the rail), 150 ms rail, square inset 2 px focus, collapse-guarded 32 px bar→panel gap | all | already so |
| D34 | Accordion: chevron gutter 16/24 @1024/32 @1544, panel bottom 40 px, touch-hover guard | gutter ramp + 40 px | add the `hover:none` guard |
| D35 | Home search row = one height (48/52 @xl/56 @3xl via the `btn--lg` geometry) | via the `--lg` padding fix (52 px @1280 both, measured) | already so |
| D36 | News overview: LEFT page header (h1 + lead); the dated centred article header retired | `app.js` + `news.css` | already so |
| D37 | Semantic accents: warning = orange-500, info = blue-500 | token values | already so |
| D38 | Toast = CD recipe: bottom 10 %, ≤ 500 px, notification padding ramp, 40 px icon, fade-in (stacking kept as a tenant capability) | re-base | already so |
| D39 | Skip link slide 150 ms | adopt | already so |
| D40 | Active nav rail suppressed while a menu is open | ✔ already common | ✔ |

### Kept, now-shared deviations from CD (deliberate, documented here)

1. **Focus-ring offset 2 px** (CD: 0) — ring reads better against colored controls; both apps agree.
2. **Prototype banner compact padding** 16/24 (CD: 16/32/40) — persistent disclosure bar in dense applications.
3. **Media-chip inset 12 px** on card imagery (CD: 8 px) — both apps already agreed.
4. **Compact tables keep row separators** (CD removes them) — both apps agree; dense data needs the rules.
5. **Demo chip pinned to federal red** under the intranet skin (brand-swap-proof) — both apps agree.
6. **`--sm` buttons get a 44 px floor on touch** (WCAG 2.5.5) — service's rule, adopted by tenant.
7. **Step-indicator recolored off CD's gray-400** (fails AA at 2.54:1, service measured) — service's scheme, adopted by tenant.
8. **Banner/notification icons** where upstream has none (WCAG 1.4.1) — tenant's rule, kept.
9. Tenant's **functional language switcher** (custom listbox) vs CD's native select — feature, kept; resting geometry is CD.
10. Service's **row-header (`th[scope=row]`) regular weight** — documented readability choice for description columns; tenant aligns the *size* (16-ramp) to CD while keeping CD's bold, since its row headers are short keys. Noted as the one intentionally un-unified table detail.
11. **News overview presentation**: tenant = flat teaser list (CD `card--list` family), service = card grid (CD index-page family). Both CD patterns; the shared part (page header) is aligned.

## 5. Implementation register

Implemented 2026-08-21/22 across both repos (this section lists *what changed
where*; the per-line rationale lives as comments at the call sites, each
referencing its D-number).

### tenant-portal
- `css/foundations/tokens.css` — focus ring 3→2 px (light + dark-chrome variants), skip-link slide 150 ms, `--color-warning` → orange-500, `--color-info` → blue-500, eyebrow ink gray-600, new `--text-badge-sm`/`--leading-badge-sm` ramp tokens.
- `css/foundations/typography.css` — h4/h5 line-height 1.5; `.section-intro` → 18-ramp / gray-600 / snug / no measure cap.
- `data/i18n.json` — new keys `top.searchToggle` («Suche»), `org.bblPlain`, `org.bblShort`.
- `css/navigations/header.css` — demo chip = CD badge pill (red-600, visible at every width), authorities label wraps `w-min` <640, meta-bar auth cluster (user label + divider + button resets), lockup acronym block + 12 px @480-639 title step + sub-line from 480, right-column gaps 12/16 @lg/xl, search toggle 36→28 icon ramp, open field = CD input skin + `py-16 @lg` + inset ring, mobile full-width search row + lockup fade.
- `css/navigations/main-navigation.css` — breadcrumb CD crumb paddings + `-ml-16` + CD separator geometry + text-500 current page; mobile menu white panel + grey meta zone + left-aligned account rows.
- `css/components/buttons.css` — left-aligned labels (+ `--full-width` centred), 0.2em icon gap, 1.4em button icons, `--lg` back to px-16, `--sm` 44 px touch floor, `:active` states, 2 px focus + purple-300 on `--filled`, flat disabled, back-to-top ring 2 px.
- `css/components/forms.css` — `--sm`/`--base`/`--lg` = type+leading only, field ring = the global outline, multiselect focus-within outline, invalid red-500, error messages as badge pills (14 px/1.35), regular labels, checkbox `shadow` + no hover recolor, select disabled opacity .4, combobox surface = square/text-500 + secondary-50 hover + dark active row.
- `css/components/tables.css` — UPPERCASE thead (uppercase scoped to thead; `--caps` inert), row-`th` at the body size, hover gated to `--rows-clickable` (secondary-100), <768 density 8/12+sm, zebra tfoot, caption `pre-line`, filter pills = CD tag-item geometry on the service tint (secondary-100→200, 44/48/52), pagination CD metrics (12 px gaps, 24/28/32 band, ramped input with radius-xs+shadow), CD icon-only buttons, flat disabled anchors.
- `css/components/cards.css` / `sections/media-viewer.css` / `sections/secondary-pages.css` — card stack 16 px, hover titles primary-700, shadow lifts at 300 ms, property-card translate lift removed, property media 16:9, result rows on the `card--flat` ramp + secondary-200 rule, grid result cards = `card--default` skin.
- `css/components/status.css` — badge icon offsets (no flex gap), `--error`/`--red` aliases, `--sm`, AA step-indicator scheme, pipeline done = green-800 solid / active = skin primary-600.
- `css/components/feedback.css` — banner inherits the 3 px radius, banner action auto-width below lg, toast re-based on the CD recipe (bottom 10 %, ≤ 500 px, padding ramp, 40 px icon, fade).
- `css/components/disclosure.css` — accordion gutter 16/24/32 + 40 px panel bottom; tab fade stops 4 px short, rail 150 ms, square inset 2 px focus, collapse guard.
- `css/layouts/layout.css` + `sections/home.css` — hero+section seam collapse, hero content stack 24/32/40, hero title cap removed, hero lead gray-600/no cap/no phone downstep, hero split from md with `--gap-responsive`.
- `css/sections/footer.css` — 64 px mobile gap, `--big` on the links entry + `__links` sub-columns, CD paragraph rhythm, note = secondary-100 text-sm, 1.4em/24 px icons at 0.2em (no hover slide), white legal links.
- `css/sections/news.css` — left-aligned overview header.
- `js/shell.js` — auth into the meta bar, acronym + strip markup, «Suche» toggle, `body--search-is-open`, shared CD drawer placement (`positionNavMenu` with the 16/32/80 offset), footer markup (h3, `--big` + sub-columns, External glyphs via `footerLink()`).
- `js/app.js` / `js/wizard.js` — `activeNav: 'services'` across the services family, news overview header.
- `scripts/verify/check-mobile-nav.mjs` — drawer-anchor assertion updated to the CD −32 px @xl contract.
- `docs/DESIGNGUIDE.md` — §5.10 (header case) and §5.12 (ring) marked resolved/reworded; §5.13 updated.

### service-portal
- `css/tokens.css` / `css/skins/intranet.css` — untouched (already exact).
- `css/navigations/header.css` — disabled language select background leak fixed (transparent + no shadow), desktop meta rows compacted via padding/negative-margin (44 px hit box kept; brand bar −24 px).
- `css/navigations/drawer.css` — nav `px-16` / `-ml-16` / rail inset 16 (densification retired), `navy__title` on the responsive base ramp.
- `js/ui/shell/header.js` — `positionPanel` = the CD Navy.js rule (fixed 16/32/80 offset + right-align-to-trigger overflow branch).
- `css/components/form.css` — resting field hover/active tint removed, hint = 12 px text-500, group gap 40→24.
- `css/components/listbox.css` — listbox + suggest shell = square / 1 px text-500.
- `css/components/table.css` — caption ink text-500.
- `css/components/feedback.css` — notification first-child ¶ rhythm, CD button margins (+ banner exception), banner compact 16/24 padding, fixed banner full 1 px white frame + moved below the toast layer, accordion touch-hover guard.
- `css/layouts/page.css` — page roots symmetric 56/80/128 with hero compensation (net hero top stays 48/56/80).
- `css/layouts/shell.css` — footer h3 regular, page-header fixed title ramp + 8 px sub-gap + 24/32/48 bottom, `.lead` snug leading.
- `css/utilities.css` — eyebrow .06em / mb 8.
- `scripts/check-ramps.mjs` — `sectionPt` expectations updated to the symmetric contract.

### Verification (all run against the final state)
- tenant: `npm test` (ESLint + domain units + **CD token guard**) green; full Playwright suite `npm run verify:all` green — one assertion updated (`check-mobile-nav`: drawer anchor now expects the CD −32 px offset), 12/12 after.
- service: `check-css-tokens` (343 props), `check-ramps` (all 8 widths × 5 ramps), `test-hero-layout`, `check-banner`, `check-focus`, `test-html-contracts`, `test-css-layers`, `test-tabs`, `test-forms`, `test-routes`, `test-catalogue`, `test-search`, `test-content`, `test-ui-state` — green. `check-cd-contracts` reports one **pre-existing** deviation (`.card__body` container-query padding 24 vs CD 40 in sub-500 px cards — the portal's own documented extension; untouched by this alignment).
- Chrome metrics re-measured equal at 1280: top bar 48/48, brand bar 154/153, nav 65/65, chip geometry byte-identical, home-search rows 52/52, drawer width/offset identical.
- Fresh before/after screenshot sweeps (375/768/1280/1600 + burger, drawer, mobile-search states) in the session scratchpad.

### Remaining, deliberately not unified (documented)
- News overview *presentation* (T flat teaser list vs S card grid) — both CD patterns; the shared page header is aligned (kept-deviations #11).
- Pipeline *shape/overflow* (T border-triangle chevrons that scroll vs S clip-path chevrons that wrap) — colors and states are unified; the wrap-vs-scroll behaviour is each portal's documented a11y trade-off.
- T's profile cards (`.card--profile__title` h3 scale, fixed 200 px image) — a swisstopo-pattern surface with no service counterpart.
- Icon sets (T hand-drawn set vs S's DS-1.0.45-matching set) — same 24 px grid; small glyph-whitespace differences remain visible e.g. in breadcrumb chevrons.
- Fonts: T four static Noto faces, S one variable Noto file — same family and weights; different loading infrastructure, not worth the churn.
- S's 12-column grid utility layer has no T counterpart (T's bespoke grids resolve to the same numbers); retrofit only if T ever consumes CD grid markup.
