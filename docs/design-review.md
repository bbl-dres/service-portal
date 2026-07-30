# Design Review — Alignment with CD Bund (swiss/designsystem v1.0.5)

_Fresh-eyes second review (July 2026), component by component and pixel-level against the official sources — `css/**/*.postcss`, `app/tailwind.config.js` and the Vue reference components. Method: 13 expert passes (one per component group); every claim re-checked by an independent adversarial verifier against both codebases (cascade, Tailwind resolution, skin overrides); plus an automated visual sweep over 28 routes × 2 viewports (1280/390 px — screenshots with overflow, target-size and outline probes). Earlier reviews were deliberately not read._

## Verdict

The portal is **CD-faithful in its foundations**: the token layer (color ramps, three-skin architecture, type ramps, breakpoints, container widths, focus purple) matches `tailwind.config.js` and the skins value for value, and the federal shell follows the CD anatomy (top-bar → top-header → logo block → meta-navigation → desktop-menu/navy → mobile-menu) including inert handling, Escape levels and focus management. The visual sweep confirms it: **zero horizontal overflow across 28 routes at 390 px, exactly one h1 per view, no error banners, no real target-size violations** (the only sub-24-px hits are inline prose links — the WCAG 2.5.8 inline exception).

The drift sits one level deeper, in four patterns:

1. **State recipes deviate.** Hover/focus/disabled are where most pixel deviations live: card hover invents an image zoom and an arrow-button inversion (CD: shadow + title color + border overlay), the active tab goes bold (CD: the 3-px bar alone), half the button palette lacks disabled recipes, the modal scrim is too light (its negative focus ring drops below 3:1).
2. **Parallel implementations of the same pattern.** Two toasts, three focus traps, four dark-chrome icon-button recipes, two hero implementations, two result counters with different font weights, dead `card--flat`/`card--list` variants next to a re-implementation. Every duplication has already drifted.
3. **The button core.** `.btn` carries its own block padding AND a flex `gap`, neither of which CD has; half the views skip the `.btn__text` wrapper. Result: two different heights for the same variant depending on markup.
4. **Cross-cutting gaps between the app views.** Result announcements, URL state, the share bar, form action rows and error summaries are each implemented in 2–3 of 5 apps instead of everywhere.

**270 verified findings** (5 high · 65 medium · 200 low); 3 first-pass claims were refuted in verification and are documented at the end. Implementation status: **162 fixed · 17 partial · 3 deliberate deviations (documented) · 88 open**.

## The five high-severity findings

1. **Buttons carry double vertical padding — two different heights for the same variant** — ✅ fixed — .btn ohne Block-Padding (padding:0 1rem); Höhe kommt aus Rampe + .btn__text py-2
2. **Hero title one type step larger than CD and than every other h1** — ✅ fixed — .hero__title = text-3xl wie h1; main-image-Override entfallen
3. **Lightbox focus trap breaks: disabled zoom buttons counted as trap boundary, so Tab escapes the aria-modal gallery** — ✅ fixed — Galerie-Falle über C.trapFocus — deaktivierte Zoomknöpfe brechen den Ring nicht mehr
4. **Modal backdrop lighter than CD — negative focus ring on modal close fails 3:1** — ✅ fixed — Scrim text-900/70 — Negativ-Fokusring wieder ≥3:1
5. **Mietende: Filter toggle rendered but never wired — panel unreachable** — ✅ fixed — Filter-Umschalter verdrahtet inkl. fcount-Pflege (Tenancies-Agent)

## Legend

Severity: **H** visibly off-brand / a11y failure / broken on mobile · M noticeable inconsistency · L pixel/naming nuance. Categories: pixel · a11y · mobile · consistency · naming · ux. Status: ✅ fixed · 🔶 partial · 📌 deliberate, documented deviation · ⬜ open. Every entry cites portal evidence and CD source as file:line (line numbers refer to the state before the fix wave).

## Foundations — colors, tokens, scales, skins

### input-ramp-1 · M · pixel — Inputs consume the button height ramp; CD gives inputs their own flatter ramp (44 -> 48 at 2xl, never 52)

- **Portal:** css/tokens.css:98 '--control-h: 2.75rem', tokens.css:305 'xl: --control-h: 3rem', tokens.css:314 '3xl: --control-h: 3.25rem'; consumed by inputs at css/app.css:1488 'input, select, textarea { ... min-height:var(--control-h) }'. Deliberate per app.css:1484-1487: "EINE Steuerhoehen-Rampe im ganzen Produkt (Item 2.5e). Vorher liefen zwei: hier 2.75rem mit einer Stufe bei 2xl/1544, und --control-h mit CDs Stufen bei xl/1280 und 3xl/1920"
- **CD:** designsystem/css/components/input.postcss:1-4 '--input-min-height: 44px; --input-min-height-2xl: 48px' and :16 'min-h-[var(--input-min-height)] 2xl:min-h-[var(--input-min-height-2xl)]' — inputs step 44->48 at 2xl (1544px) and cap at 48px; only buttons step at xl/3xl (btn.postcss:112-117)
- **Fix:** For strict parity add an --input-h token (2.75rem base, 3rem inside a min-width:1544px block) in tokens.css and switch BOTH the input/select/textarea rule at app.css:1488 AND .map-search__field input at app.css:2713 to it, keeping --control-h for button-like controls (the language-switcher select at app.css:535 and meta-navigation items at app.css:611 sit in the top-bar and should stay on the button ramp). If the unified ramp is retained instead, update the comment at app.css:1484-1487 to state explicitly that it overrides CD input.postcss:1-4, not just the btn ramp.
- **Status:** ✅ fixed — --input-h (44→48@2xl) eingeführt; Felder, Kopfsuche, map-search umgestellt; Katalogleiste als dokumentierte 44px-Ausnahme

### skin-literal-1 · L · consistency — --color-bg-subtle/--color-bg-muted hardcode default-skin secondary-50/100, breaking the shipped freebrand skin cascade

- **Portal:** css/tokens.css:88-89 '--color-bg-subtle: #f0f4f7; /* secondary-50 ... */ --color-bg-muted: #dfe4e9; /* secondary-100 */' — literals, not var() references; the skin blocks at tokens.css:281-288 re-declare --color-secondary-* but these role tokens keep pointing at default-skin values. tokens.css:277-280 claims the block "completes CD's three-skin architecture so a co-branded tenant switches via one body class exactly as CD does"
- **CD:** designsystem/css/skins/freebrand.postcss:18-19 '--color-secondary-50: #efffee; --color-secondary-100: #b0beb0' — in CD every secondary-50/100 surface resolves through the CSS variable and re-skins automatically (e.g. notification.postcss:46 'bg-secondary-50', section.postcss:106 'bg-secondary-50')
- **Fix:** Either alias the two unused role tokens to the skin cascade ('--color-bg-subtle: var(--color-secondary-50); --color-bg-muted: var(--color-secondary-100);') or delete them outright — they have no consumers, so neither change alters any rendered pixel under any skin. If kept, the alias form is preferred so a future consumer rides the skin switch the block at tokens.css:277-280 promises.
- **Status:** ✅ fixed — --color-bg-subtle/-muted aliasieren jetzt die Sekundärrampe

### placeholder-skin-1 · L · consistency — --color-placeholder pins default-skin secondary-400; CD placeholder re-skins to #5076b3 under the intranet skin the portal actually runs

- **Portal:** css/tokens.css:86 '--color-placeholder: #596978;    /* secondary-400 — AA on white */' (literal); consumed at css/app.css:1491 and app.css:1959. The intranet skin block (tokens.css:249-274) does not re-point it, and index.html ships body--intranet, so every placeholder renders default-skin #596978
- **CD:** designsystem/css/components/input.postcss:18 '@apply placeholder-secondary-400' resolves through var(--color-secondary-400), which intranet.postcss:25 sets to #5076b3 — CD intranet placeholders are blue-grey
- **Fix:** Two accurate options: (a) for strict CD parity set '--color-placeholder: var(--color-secondary-400)' — safe, since the intranet value #5076b3 is 4.58:1 on white and still passes AA (marginally); or (b) keep the frozen #596978 and add a decoupling comment in the style of tokens.css:67-69, but with the correct rationale: skin-independent placeholders with a larger contrast margin (5.65:1 vs the intranet ramp's marginal 4.58:1), not an AA failure.
- **Status:** ✅ fixed — --color-placeholder folgt var(--color-secondary-400); Kontrastmargen im Kommentar

### container-px-1 · L · mobile — Container side padding below 480px is 1.25rem; CD uses 1rem (px-4)

- **Portal:** css/app.css:185-186 '.container { ... padding:0 var(--gap-responsive); overflow-x:clip; }' with css/tokens.css:198 '--gap-responsive: 1.25rem' as the base step (first override only at min-width:480px, tokens.css:293). Verified: no other rule overrides .container horizontal padding
- **CD:** designsystem/css/layouts/container.postcss:7 '@apply px-4 xs:px-7 sm:px-9 lg:px-10 xl:px-12 3xl:px-16' — base step is 1rem; all steps from xs upward coincide with the gap ramp (grids.postcss:10 'gap-5 xs:gap-7 sm:gap-9 lg:gap-10 xl:gap-12 3xl:gap-16')
- **Fix:** CD's container-padding ramp and grid-gap ramp only differ at the base step (1rem vs 1.25rem); collapsing both onto --gap-responsive gives every page 4px too much side padding on <480px phones. Add a dedicated '--container-px: 1rem' that is set equal to --gap-responsive from the xs breakpoint upward (one extra line in the existing min-width:480px block), and use it in .container.
- **Status:** ✅ fixed — --container-px 1rem Basis, ab xs deckungsgleich mit der Spalten-Rampe

### text-light-1 · L · naming — --color-text-light shadows CD's 'light' text vocabulary (text-500) with the non-AA text-400 — and has zero consumers

- **Portal:** css/tokens.css:81 '--color-text-light:  var(--color-text-400);' (#9ca3af, 2.54:1 on white). Verified unused: the only other occurrence in the repo is the warning comment at css/app.css:98 ("...text-text-500 (4.83:1 auf Weiss), nicht --color-text-light (2.54:1)")
- **CD:** designsystem/css/foundations/typography.postcss:87-89 '.text--light { @apply text-text-500; }' and colors.postcss:9-11 '.color--light { @apply text-text-500; }' — CD's 'light' text tone is #6b7280
- **Fix:** Delete the token, or redefine it as var(--color-text-500) so the name matches CD's text--light value. As defined it is a trap: any future consumer reaching for the CD-sounding name gets a colour that fails WCAG AA for text. (The neighbouring --color-text-muted = text-600 deviation from CD's text-500 is documented at tokens.css:80 and its rationale verifies: text-500 is ~4.1:1 on secondary-50 surfaces, failing AA — keep that one.)
- **Status:** ✅ fixed — Repointed --color-text-light to var(--color-text-500) (= CD .text--light) with warning comment; updated the stale app.css legend comment that cited the old 2.54:1 value. Zero consu

### z-footer-1 · L · consistency — #main-footer stacked at z-60, above header (30) and nav (40); CD stacks the footer at z-0, below everything

- **Portal:** css/tokens.css:217 '--z-footer: 60;        /* Bezugsrahmen fuer <<nach oben>> */' consumed at css/app.css:968 '#main-footer { position:relative; z-index:var(--z-footer); }'
- **CD:** designsystem/css/foundations/global.postcss:59-61 '#main-footer { @apply relative z-0; }' — CD's page order is header 30 > content 10 > footer 0
- **Fix:** Either (a) minimal: lower --z-footer from 60 to 20 — above --z-content (10) so the sticky back-to-top button stays visible over content, but below --z-header (30) and --z-nav (40), restoring CD's guarantee that header/nav surfaces paint over the footer; or (b) full CD parity: move the back-to-top rail out of #main-footer into its own page-level wrapper with a high z-index (CD uses z-500, back-to-top-btn.postcss:14), then set --z-footer: 0. Do not use z-0 while the rail remains a footer child.
- **Status:** ✅ fixed — Option (a): --z-footer 60 -> 20 (above content 10, below header 30/nav 40), moved into the bottom-to-top scale order, comment explains why not CD's z-0 (sticky back-to-top inside f

### scrim-skin-1 · L · consistency — Scrim tokens claim to follow the secondary ramp but pin default-skin secondary-900 while the app ships body--intranet

- **Portal:** css/tokens.css:186-190 comment 'Alle drei folgen jetzt der Sekundaerrampe' with literals '--scrim-chip: rgba(19,27,34,.72)' etc. — rgb(19,27,34) is default-skin secondary-900 #131b22; under the shipped intranet skin secondary-900 is #1c3c7d (tokens.css:273), so the stated derivation is false at runtime
- **CD:** CD convention — CD has no scrim tokens (portal invention); skin-aware tokens elsewhere in the sheet resolve via var(--color-secondary-*), and deliberately skin-frozen tokens carry an explicit decoupling comment (tokens.css:118-121 chart palette, 67-69 error reds)
- **Fix:** A neutral dark photo scrim is the right call (a blue-tinted intranet scrim would be worse), so keep the values — but fix the comment: state that the scrims are deliberately frozen on the default-skin secondary-900 and NOT skin-switched, matching the documentation pattern used for --color-error-400/700 and the chart series. As written, the comment invites a future 'fix' toward blue scrims.
- **Status:** ✅ fixed — Comment rewritten: chip scrims are deliberately frozen on default-skin secondary-900 and NOT skin-switched, same documentation pattern as --color-error-400/700 and the chart palett

### fw-bold-1 · L · naming — Bold via --fw-bold:700 on a variable font vs CD's font-family switch at weight 400 — equivalent but undocumented in tokens.css

- **Portal:** css/tokens.css:148 '--fw-regular: 400;  --fw-bold: 700;' with app.css:25-26 '@font-face { font-family:Noto Sans; ... font-weight:100 900; src:url(../assets/fonts/NotoSans-latin.woff2) }'. Verified: the woff2 contains fvar/gvar/avar/STAT tables (true variable font), so weight 700 renders real bold glyphs despite app.css:50 'font-synthesis:none'
- **CD:** designsystem/app/tailwind.config.js:200-203 'fontWeight: { normal: 400, bold: 400 }' plus fontFamily bold = Font-Bold (config:222) and font-face.postcss:13-19 — CD keeps weight 400 everywhere and switches to a separate NotoSans-Bold.ttf file for bold
- **Fix:** No visual change needed — the variable-font axis at 700 renders the same Noto Sans bold design as CD's separate file, and app.css:22-24/48-50 documents the single-file decision. Add one line next to --fw-bold in tokens.css noting that CD's 'fontWeight.bold: 400 + Font-Bold family' idiom is replaced by the 700 axis, so a future reader diffing against tailwind.config.js does not 'correct' --fw-bold to 400 (which, with font-synthesis:none, would silently remove all bold).
- **Status:** ✅ fixed — Comment added at --fw-bold: CD's fontWeight.bold:400 + Font-Bold family idiom is replaced by the 700 wght axis; correcting to 400 would silently remove all bold.

### fallback-metrics-1 · L · consistency — Fallback-font metric overrides deviate from CD's literal values — verified as a correct fix of invalid CD CSS; keep

- **Portal:** css/app.css:35-39 '@font-face { font-family:Fallback-font; src:local(Verdana); size-adjust:94%; ascent-override:114%; descent-override:31%; line-gap-override:0%; }' with rationale app.css:27-34: "advance-override ist keine CSS-Eigenschaft (abgebrochenes Chrome-Experiment, ersetzt durch size-adjust) und descent-override verlangt einen nicht-negativen Wert — -25% wird verworfen"
- **CD:** designsystem/css/foundations/font-face.postcss:37-44 'advance-override: 125%; ascent-override: 95%; descent-override: -25%; line-gap-override: 25%' — two of CD's four declarations are invalid CSS (advance-override never shipped; negative descent-override is rejected by the parser)
- **Fix:** Deviation assessed and it holds: CD's literal values cannot take effect in any browser, so copying them would be cargo-cult parity; the portal's measured size-adjust/ascent/descent values are the faithful implementation of CD's intent (metric-compatible Verdana fallback). No change — retain, and keep the measurement comment so the divergence from the CD source stays explainable.
- **Status:** ✅ fixed — bereits durch die erste Welle abgedeckt (verifiziert)

### sp-scale-1 · L · naming — Spacing token scale omits steps CD components use (fractional 0.5/2.5 and 36/40), forcing raw literals in app.css

- **Portal:** css/tokens.css:156-161 --sp-0 through --sp-32 in whole steps only — no --sp-0-5 (.125rem), --sp-1-5, --sp-2-5 (.625rem), --sp-3-5, and nothing above 8rem
- **CD:** CD uses the untouched Tailwind default spacing scale (app/tailwind.config.js defines no spacing key), and its components consume the missing steps: typography.postcss:158 'mark { py-0.5 px-1 }', notification.postcss:77 'mt-2.5 xl:mt-2', hero.postcss:93 'py-20 lg:py-32 3xl:py-40' (py-40 = 10rem > --sp-32)
- **Fix:** Comment-only fix: amend the header at tokens.css:156 to state the scale is a deliberately trimmed subset of the Tailwind/CD default scale covering the steps the portal consumes (fractional 0.5-3.5 steps and steps above 8rem intentionally absent). Adding --sp-0-5/--sp-1-5/--sp-2-5/--sp-3-5/--sp-36/--sp-40 is optional future-proofing with zero current consumers — nothing in app.css needs them today.
- **Status:** ✅ fixed — Header comment now states the scale is a deliberately trimmed subset (fractional 0.5-3.5 and >8rem steps absent until a consumer needs them). No tokens added (zero consumers).

## Typography, links, lists, focus ring

### italic-1 · M · pixel — Italics can never render: font-synthesis:none contradicts the documented single-woff2 strategy

- **Portal:** css/app.css:50 — body sets `font-synthesis:none;`; css/app.css:25-26 — the only @font-face is 'Noto Sans' font-style:normal (wght 100-900, no italic face); css/app.css:82 — `.text--italic, .font--italic { font-style:italic; }`; the font comment (app.css:22-24) promises "Der Browser synthetisiert die wenigen kursiven Stellen" — which font-synthesis:none explicitly forbids
- **CD:** css/foundations/font-face.postcss:21-35 — real italic cuts 'Font-Italic' (NotoSans-Italic.ttf) and 'Font-Bold-Italic'; css/foundations/typography.postcss:161-169 — `em, i { @apply font-italic }` with nested strong → font--bold-italic
- **Fix:** The deliberate deviation's rationale is internally contradictory: the comment relies on synthesized oblique, but font-synthesis:none blocks it, so em/i/.text--italic/.text--bold-italic silently render upright (latent today — no em/i/.text--italic occurs in js/html yet, but the shim comment at app.css:79-80 promises CD markup renders unchanged). Fix: change to `font-synthesis:style;` (keeps faux-bold off — the real 100-900 wght axis covers bold — while allowing oblique synthesis), or ship a NotoSans-Italic latin woff2 subset; align the comment either way.
- **Status:** ✅ fixed — font-synthesis:style — Oblique-Synthese erlaubt, Faux-Bold bleibt aus

### marker-focus-1 · M · a11y — Map marker focus ring uses primary-700 instead of the CD focus purple, and focus = hover

- **Portal:** css/app.css:2150 — `.map-marker:hover, .map-marker:focus-visible { background:rgba(37,99,235,.95); outline:2px solid var(--color-primary-700); outline-offset:1px; }`
- **CD:** css/foundations/global.postcss:75-77 — `*:focus-visible { @apply outline-none ring-2 ring-purple-500 }` (#8655F6); CD uses the purple ring on every focusable element
- **Fix:** Split the states: keep the hover background change, but give `:focus-visible` the standard recipe `outline:2px solid var(--color-focus-ring); outline-offset:2px;`. Under body--intranet, primary-700 is #1d4ed8 — the same hue as the marker fill rgba(37,99,235,.95), so the current indicator has almost no contrast against the marker and reads as hover, not keyboard focus.
- **Status:** ✅ fixed — Hover und :focus-visible getrennt; Fokus trägt den CD-Purpurring

### text-light-1 · L · consistency — Three different values for the 'light text' role; the CD-named class carries the wrong one

- **Portal:** css/app.css:387 — `.muted, .text--light { color:var(--color-text-muted); }` (= text-600 #4b5563 via tokens.css:80); css/app.css:88 — `.color--light { color:var(--color-gray-500); }` (#6b7280, with comment citing CD text-text-500); css/tokens.css:81 — `--color-text-light: var(--color-text-400)` (#9ca3af, which app.css:86-88 itself warns is 2.54:1 on white)
- **CD:** css/foundations/typography.postcss:87-89 — `.text--light { @apply text-text-500; }` = #6b7280
- **Fix:** One value per name: merge into a single rule `.text--light, .color--light { color:var(--color-gray-500); }` so the CD-named class matches CD; keep `.muted` (#4b5563) only if the darker AA-safe tone is a deliberate portal choice and document it; rename or repoint the misleading `--color-text-light` token (#9ca3af) that no rule should consume for body text.
- **Status:** ✅ fixed — .text--light moved out of the .muted rule and grouped with .color--light on var(--color-gray-500) (CD text-500); .muted kept at text-600 with documenting comment (AA on secondary-5

### focus-ring-1 · L · pixel — Global focus ring deviates from CD: 2px offset + border-radius:1px side effect, no z-raise — undocumented

- **Portal:** css/app.css:149 — `:focus-visible { outline:2px solid var(--color-focus-ring); outline-offset:2px; border-radius:1px; }` (the comment at 143-148 documents only the deduplication, not this deviation)
- **CD:** css/foundations/global.postcss:75-86 — `*:focus-visible { @apply outline-none ring-2 ring-purple-500 z-10; }` → a 2px box-shadow ring hugging the element (ring offset 0), element raised with z-10; dark contexts get ring-purple-300
- **Fix:** For strict parity remove `outline-offset:2px` (CD's ring touches the element edge) — or keep the offset, which is arguably more visible, but add the documenting comment the file's own convention requires. Independently, drop `border-radius:1px`: it mutates the focused element's actual radius (background clipping) — outlines already follow border-radius in all evergreen browsers, so the hack is obsolete. The negative-context selector list (app.css:150-154) itself is a correct superset of CD's.
- **Status:** ✅ fixed — Dropped the obsolete border-radius:1px; kept the 2px offset and documented it as a deliberate deviation from CD's adjacent box-shadow ring + z-10.

### link-focus-1 · L · a11y — .link--negative and .notification links darken on hover but not on focus (CD does both)

- **Portal:** css/app.css:118 — `.link--negative:hover { color:var(--color-gray-300); }` (no :focus); css/app.css:115-116 — the darkened state lists `.notification a:hover` but not `.notification a:focus`, while sibling `.link:hover, .link:focus` covers both
- **CD:** css/components/link.postcss:12-15 — `.link--negative { @apply text-white hover:text-text-300 focus:text-text-300 … }`; link.postcss:7 — `hover:text-primary-800 focus:text-primary-800`
- **Fix:** Change to `.link--negative:is(:hover,:focus) { color:var(--color-gray-300); }` and add `.notification a:focus` to the selector list at app.css:116, matching the hover/focus parity every other link variant already has.
- **Status:** ✅ fixed — .link--negative:is(:hover,:focus) and .notification a:focus added to the darkened-state selector list.

### link-cursor-1 · L · pixel — Link recipe omits cursor:pointer (CD sets it explicitly)

- **Portal:** css/app.css:111-114 — the shared content-link rule sets color/underline/underline-offset/overflow-wrap but no cursor; css/app.css:117 — `.link--negative` likewise
- **CD:** css/components/link.postcss:8 — `@apply underline underline-offset-2 cursor-pointer;` and link.postcss:14 for .link--negative
- **Fix:** Add `cursor:pointer` to the rule at app.css:111-114 and to `.link--negative`. Anchors with href default to pointer anyway, but `.link` applied to a button or an anchor without href currently shows the text cursor — CD guards against exactly that.
- **Status:** ✅ fixed — cursor:pointer added to the shared content-link recipe and .link--negative (CD link.postcss:8,14).

### overtitle-1 · L · pixel — .overtitle uses the responsive xs ramp; CD pins it to the fixed 0.75rem step

- **Portal:** css/app.css:95 — `.overtitle { display:flex; gap:.5rem; font-size:var(--text-xs); color:var(--color-text-muted); }` — var(--text-xs) grows to 0.875rem at 1280px and 1rem at 1920px (tokens.css:307,317)
- **CD:** css/foundations/typography.postcss:100-104 — `.overtitle { @apply flex space-x-2 text-secondary-100 text-xs; }` — Tailwind `text-xs` is the fixed 0.75rem step (tailwind.config.js:205), not the responsive .text--xs ramp
- **Fix:** Use `font-size:var(--fs-xs)` for size parity at every breakpoint. The colour deviation (text-muted instead of CD secondary-100) is documented at app.css:92-100 — "CDs Eyebrow/Legende ist für dunkle Hero-Hintergründe entworfen" (secondary-100 would be 1.2:1 on white) — that rationale still holds for the portal's light surfaces; keep it.
- **Status:** ✅ fixed — .overtitle now uses var(--fs-xs) (fixed step, like CD's text-xs); colour deviation kept as documented. Comment notes the fixed-step point.

### mark-1 · L · pixel — mark: smaller vertical padding and an extra border-radius CD does not have

- **Portal:** css/app.css:129 — `mark { background:var(--color-primary-200); padding:.05em .25em; border-radius:var(--radius-sm); }` (.05em ≈ 0.8px vertical)
- **CD:** css/foundations/typography.postcss:157-159 — `mark { @apply bg-primary-200 py-0.5 px-1; }` = padding 0.125rem 0.25rem, no radius
- **Fix:** Set `padding:.125rem .25rem;` and drop `border-radius:var(--radius-sm)` (or keep the radius as a documented deviation — it is currently uncommented, which the sheet's own convention treats as accidental).
- **Status:** ✅ fixed — mark padding .125rem .25rem (CD py-0.5 px-1), border-radius dropped — CD verbatim.

### text5xl-1 · L · consistency — .text--5xl utility missing although the token ramp is fully wired

- **Portal:** css/app.css:70-75 — utility ramp ends at `.text--4xl`; no `.text--5xl` rule exists anywhere in app.css, while tokens.css:154,300,309,319 carry the complete --text-5xl ramp (2.5→3→3.5→4rem)
- **CD:** css/foundations/typography.postcss:18-21 — `.text--5xl { @apply text-5xl lg:text-6xl xl:text-7xl 3xl:text-8xl leading-tight; }`
- **Fix:** Treat like the unimplemented list variants: an acceptable omission while no hero-scale consumer exists. When one appears, add `.text--5xl { font-size:var(--text-5xl); line-height:var(--lh-tight); }` beside the others. Independently, note that tokens.css currently maintains the four-breakpoint --text-5xl ramp with zero consumers — either accept that carrying cost as CD-parity bookkeeping (one comment) or add the class now to give the ramp its consumer; doing neither leaves silent dead weight.
- **Status:** ✅ fixed — Comment-only per the verified note: .text--5xl deliberately absent until a hero consumer exists; tokens ramp documented as CD-parity bookkeeping. No dead class added.

### lead-1 · L · consistency — The .lead recipe is written twice in different scopes (drift risk); not a CD class

- **Portal:** css/app.css:1012 — `.page-header .lead { font-size:var(--text-lg); color:var(--color-text-muted); }` and css/app.css:2979 — `.home-hero .lead { font-size:var(--text-lg); color:var(--color-text-muted); margin-bottom:1.5rem; }` — identical declarations duplicated; `.lead` has no counterpart in designsystem/css
- **CD:** CD convention — lead paragraphs compose text--lg (typography.postcss:43-45) with a muted text utility; there is no .lead component
- **Fix:** Two honest options: (a) pure refactor — merge the duplicates as `.page-header .lead, .home-hero .lead { font-size:var(--text-lg); color:var(--color-text-muted); }` and keep `.home-hero .lead { margin-bottom:1.5rem; }`, leaving the raw consumers untouched; or (b) define the unscoped `.lead { font-size:var(--text-lg); color:var(--color-text-muted); }` in the BASE block — explicitly acknowledging this restyles the ~8 currently-unstyled `<p class="lead">` occurrences (portfolio.js:633/713/727, api-docs.js:132, components.js:852 et al.) and visually checking those pages. Option (b) is likely the intended fix for a real latent bug, but must be framed as such, not as drift-proofing two consumers.
- **Status:** 🔶 partial — JS-Anteil umgesetzt; CSS-Rest: css/app.css: either merge the duplicated scoped rules (.page-header .lead, .home-hero .lead { font-size:var(--text-lg); color:var(--color-te

### util-naming-1 · L · naming — Duplicate utility vocabulary beside the CD names (.small vs .text--sm, .muted/.color--light vs .text--light)

- **Portal:** css/app.css:388 — `.small { font-size:var(--text-sm); }` duplicates `.text--sm` (app.css:70); css/app.css:387 — `.muted` and css/app.css:88 — `.color--light` both cover the light-text role that CD names `.text--light`
- **CD:** css/foundations/typography.postcss:51-53 (.text--sm) and :87-89 (.text--light) — the canonical CD names
- **Fix:** Keep the short aliases but merge each into the CD-named rule as grouped selectors (`.text--sm, .small { … }` / `.text--light, .color--light, .muted { … }` once text-light-1 settles the value) so an alias can never drift from the canonical value again — the .text--light divergence at app.css:387 shows the drift has already happened once. Prefer CD names in new markup.
- **Status:** ✅ fixed — .small grouped into the .text--sm rule (only combos in markup are small+muted/mt-*, no cascade conflicts); .color--light grouped with .text--light; .muted kept separate as a docume

### p-margin-1 · L · consistency — Global paragraph bottom margin is a base-layer deviation from CD and is undocumented

- **Portal:** css/app.css:67 — `p { margin:0 0 1rem; }` with no rationale comment; the counter-rule css/app.css:979 `.footer-information__entry p:last-child { margin-bottom:0; }` shows the trailing-space cost
- **CD:** CD convention — Tailwind preflight zeroes p margins; rhythm comes from .vertical-spacing (css/foundations/spacings.postcss:7-41, which the portal mirrors correctly at app.css:372-383) and per-component spacing
- **Fix:** Keep the pragmatic base margin for this content-heavy vanilla app, but add the documenting German comment the sheet requires for deliberate deviations, and audit closed containers (cards, boxes, notifications) for the 1rem trailing slack, extending the `:last-child { margin-bottom:0 }` fix where it shows.
- **Status:** ✅ fixed — German BEWUSSTE-ABWEICHUNG comment added on p{margin:0 0 1rem} citing preflight + vertical-spacing and the existing local :last-child resets. No new resets needed (notification/foo

### a-default-1 · L · consistency — Bare `a` rule colours links outside #main-content without underlining them (colour-only cue)

- **Portal:** css/app.css:104 — `a { color:var(--color-link); text-decoration:none; }` — the underline recipe (app.css:111-114) is scoped to #main-content/.notification/.link, but modals and toasts mount on document.body (js/components.js:486, js/components.js:1613), so an unclassed anchor there renders brand-coloured with no underline
- **CD:** css/components/link.postcss:5-10 — CD scopes the recipe to `main a`/`.link`; outside main, preflight leaves anchors inheriting text colour until a component styles them
- **Fix:** Add only the modal root to the underline recipe (e.g. `.modal a:not(.btn)` beside `.notification a` at app.css:112) — omit `.toast a`, since toast() renders via textContent (components.js:1612-1613) and can never contain markup. Alternatively drop the colour from the bare `a` rule at app.css:104 so chrome links inherit like CD; if so, spot-check header/footer/nav anchors that may currently rely on inheriting the brand colour.
- **Status:** ✅ fixed — Added .modal a:not(.btn, .notification a) to both the underline and hover recipes (modals mount on body). Toast half correctly omitted (toast renders via textContent). Selector ver

### fill-available-1 · L · mobile — Missing -webkit-fill-available viewport fallbacks on html/body (iOS Safari toolbar overflow)

- **Portal:** css/app.css:43 — `html { -webkit-text-size-adjust:100%; height:100%; overflow-y:scroll; }` and css/app.css:51 — body `min-height:100vh;` only
- **CD:** css/foundations/global.postcss:7 — `html { height:-webkit-fill-available; }`; global.postcss:29-30 — body `min-height:100vh; min-height:-webkit-fill-available;`
- **Fix:** Add `height:-webkit-fill-available;` after height:100% on html and `min-height:-webkit-fill-available;` (or the modern `min-height:100dvh` as a documented deviation) after min-height:100vh on body, so the flex shell doesn't overflow behind iOS Safari's collapsed toolbar.
- **Status:** ✅ fixed — html height:-webkit-fill-available and body min-height:-webkit-fill-available added after the standard values (CD global.postcss:7,29-30).

### skiplink-1 · L · pixel — Skip-link slide transition 200ms vs CD's 150ms; rest of the recipe matches

- **Portal:** css/app.css:176-179 — `.skip-to-content { … transition:transform var(--duration); }` = 200ms (tokens.css:179); padding/position/colors/border/shadow/transform all match CD
- **CD:** css/foundations/global.postcss:63-73 — `@apply shadow-md transition-transform` = Tailwind default 150ms
- **Fix:** Use `var(--duration-fast)` (150ms). The z-index deviation (--z-skiplink:2000 vs CD z-50) is documented at tokens.css:224 ("muss alles überlagern, sonst ist er wertlos") — rationale holds: the portal stacks up to --z-viewer:200 and --z-sticky:1000, where CD's 50 would be buried; keep it.
- **Status:** ✅ fixed — Skip-link transition now var(--duration-fast) = 150ms; documented z-index deviation untouched.

### list-variants-1 · L · consistency — CD list modifiers --indented/--roman/--negative/--icon not implemented (currently unused)

- **Portal:** css/app.css:133-140 — implements list default/ordered/bare/loose/flex/wrap only; grep confirms no usage of the missing variants in js/html. Implemented values verified: disc/decimal outside, padding-left 1.25rem, 0.5rem item gap, loose 0.75rem — all match CD
- **CD:** css/components/list.postcss:27-67 — .list--indented (li ml-1.5/pl-3.5), .list--roman (upper-roman, pl-5), .list--negative (white), .list--icon
- **Fix:** Acceptable omission while no consumer exists (adding them now would be dead CSS). When a consumer appears, add with CD values: `.list--roman { list-style:upper-roman outside; padding-left:1.25rem; }`, `.list--negative { color:var(--color-text-negative); }`, `.list--default.list--indented li { margin-left:.375rem; padding-left:.875rem; }`.
- **Status:** ⬜ open

### font-1 · L · consistency — Single variable woff2 + corrected fallback metrics — deliberate deviation verified, rationale holds

- **Portal:** css/app.css:25-39 — one 'Noto Sans' variable woff2 (wght 100-900, latin subset) replaces CD's four TTFs; Verdana fallback with `size-adjust:94%; ascent-override:114%; descent-override:31%; line-gap-override:0%;`
- **CD:** css/foundations/font-face.postcss:5-44 — four TTF families (Font-Regular/Bold/Italic/Bold-Italic) and a Verdana fallback declaring `advance-override:125%; ascent-override:95%; descent-override:-25%; line-gap-override:25%;`; tailwind.config.js:200-203 maps bold to weight 400 + family switch
- **Fix:** Keep — no realignment needed. Rationale (app.css:9-24: 1138KB→35KB, latin subset verified against all app text; app.css:27-34: `advance-override` "ist keine CSS-Eigenschaft" and the negative descent-override is discarded, so CD's own fallback metrics are half-broken) was re-verified and still holds; the wght-700 render is the same NotoSans-Bold design CD reaches via family switch, and font-synthesis correctly prevents faux-bold. The one broken leg is italics — tracked separately as italic-1.
- **Status:** ✅ fixed — bereits durch die erste Welle abgedeckt (verifiziert)

## Buttons and icons

### btn-1 · **H** · consistency — Buttons carry double vertical padding — two different heights for the same variant

- **Portal:** css/app.css:1079 — ".btn { … padding:.5rem 1rem; … }" plus css/app.css:1083 — ".btn__text { padding-block:.5rem; … }": a button whose label is wrapped in .btn__text gets 1rem total block padding (~51px tall at 1440px), while a button with bare text gets .5rem (min-height 44px governs). Both markups exist side by side (e.g. js/apps/media-library.js:331 with .btn__text vs js/apps/workspace.js:62 without).
- **CD:** css/components/btn.postcss:8 — ".btn { @apply px-4; }" (horizontal padding only, NO block padding on the button) and btn.postcss:133-137 — ".btn__text { @apply py-2 … }": the .5rem block padding lives exclusively on the text span; height is governed by the 44/48/52 min-height ramp.
- **Fix:** Change .btn to padding:0 1rem (keep the transparent border), keep padding-block:.5rem on .btn__text/.btn__text-centered, and wrap every label in .btn__text (see btn-2). All buttons then land exactly on the CD 44/48/52 ramp regardless of markup.
- **Status:** ✅ fixed — .btn ohne Block-Padding (padding:0 1rem); Höhe kommt aus Rampe + .btn__text py-2

### btn-2 · M · consistency — Half the views skip the canonical .btn__text wrapper

- **Portal:** js/apps/space-request.js:97,109,129; js/apps/building-create.js:164,195; js/apps/workspace.js:61-62,95; js/apps/fault-report.js:142-143; js/apps/api-docs.js:107; js/pages/catalog.js:125; js/pages/services.js:99,165-168; js/pages/my-cases.js:171; js/apps/portfolio.js:618; js/apps/document-archive.js:63 — label rendered as bare text inside .btn, while components.js:307-308, media-library.js:331-332, home.js:162 etc. use <span class="btn__text">.
- **CD:** app/components/ch/components/Btn.vue:12-14,106-110 — the label is ALWAYS wrapped in .btn__text (or .btn__text-centered); btn.postcss:133-137 gives that span py-2 and overflow-wrap:anywhere.
- **Fix:** Mechanically wrap every button/link label in <span class="btn__text"> across the listed views (or add a small btn() factory in js/components.js that enforces it). Without the wrapper, labels lose the py-2 rhythm and the overflow-wrap:anywhere long-word protection the sheet itself documents at app.css:2991.
- **Status:** ✅ fixed — btn__text-Wrapper in components.js und allen Ansichten nachgezogen (Agenten je Cluster)

### btn-3 · M · pixel — Icon-to-label gap is a portal invention (.5rem flex gap) and double-counts with btn--icon-left

- **Portal:** css/app.css:1078 — ".btn { … gap:.5rem; … }"; css/app.css:1106 — ".btn--icon-left .btn__icon { position:relative; right:.1em; margin-right:.2em; }" (gap + margin ≈ 11.4px on the backLink); css/app.css:1119 — ".btn--icon-right { flex-direction:row-reverse; }" with no nudge (spacing 8px) — left- and right-icon buttons are spaced differently.
- **CD:** css/components/btn.postcss:6-8 — .btn has no gap; btn.postcss:168-180 — spacing comes solely from the nudges: icon-left "mr-[0.2em] right-[0.1em]", icon-right "ml-[0.2em] left-[0.1em]" (≈3.2px optical gap).
- **Fix:** Remove gap:.5rem from .btn, keep the icon-left nudge, and add the missing mirror to .btn--icon-right (.btn--icon-right .btn__icon { position:relative; left:.1em; margin-left:.2em; }). Buttons that rely on DOM-order icons (see btn-2 list) then need btn--icon-left/right classes, matching CD markup.
- **Status:** ✅ fixed — gap entfernt; icon-left/right-Nudges tragen den Abstand; icon-right ohne row-reverse (DOM-Reihenfolge = visuelle Reihenfolge, dokumentiert)

### btn-4 · M · a11y — .btn--link/.btn--link-negative drop the CD min-height ramp (touch target shrinks to ~27px)

- **Portal:** css/app.css:1101 — ".btn--link { … padding:.25rem 0; min-height:0; }"; css/app.css:1099 — ".btn--link-negative { … padding:.25rem 0; min-height:0; }". Used by downloadLink (js/components.js:1108-1112), my-cases.js:114/117, portfolio.js:618, document-archive.js:63, catalogueBar reset (components.js:362-363).
- **CD:** css/components/btn.postcss:38-53 — .btn--link only changes padding to "pr-2 pl-0"; the size block btn.postcss:112-117 (min-h 44px / xl 48px / 3xl 52px) applies to every variant including link.
- **Fix:** Delete min-height:0 from both link variants and use CD padding (padding:0 .5rem 0 0). The 44px ramp from .btn then applies; vertical rhythm inside running text is CD's own behavior (inline-flex + min-height).
- **Status:** ✅ fixed — Link-Varianten behalten die 44er-Rampe; CD-Padding pr-2 pl-0

### btn-5 · M · pixel — .btn--sm and .btn--lg override padding that CD never changes

- **Portal:** css/app.css:1103 — ".btn--sm { min-height:2.125rem; padding:.35rem .8rem; font-size:var(--text-sm); }"; css/app.css:1110 — ".btn--lg { min-height:3rem; padding:.75rem 1rem; … }". .35rem/.8rem are off the CD spacing scale.
- **CD:** css/components/btn.postcss:119-129 — the size modifiers set ONLY min-height, text size and leading; horizontal padding stays px-4 (1rem) from .btn for all sizes, and there is no block padding.
- **Fix:** Reduce both modifiers to min-height + font-size (padding inherited from .btn once btn-1 lands): .btn--sm { min-height:2.125rem; font-size:var(--text-sm); } .btn--lg { min-height:3rem; font-size:var(--text-lg); }. The min-height ramps at 1111-1112 already match CD exactly (34/40/44, 44/48/52, 48/52/56 — verified).
- **Status:** ✅ fixed — btn--sm/--lg nur noch min-height + font-size

### btn-7 · M · consistency — Disabled ([disabled]) rules missing for bare, link and all negative variants

- **Portal:** css/app.css:1086-1113 — only .btn--outline[disabled] (1088) and .btn--filled[disabled] (1091) exist; .btn--bare, .btn--link, .btn--link-negative, .btn--outline-negative, .btn--bare-negative have no disabled styling, only the generic cursor rule .btn[disabled] (1113). A disabled bare/link button keeps full enabled colors.
- **CD:** css/components/btn.postcss:21-24,32-35,49-52,67-70,80-84,94-98,106-108 — every variant defines :disabled (text secondary-300 for positives; secondary-200 text / secondary-300 border for negatives; bg-transparent for bare/link).
- **Fix:** Add: .btn--bare[disabled], .btn--link[disabled] { color:var(--color-secondary-300); background:transparent; } .btn--link-negative[disabled], .btn--bare-negative[disabled] { color:var(--color-secondary-200); } .btn--outline-negative[disabled] { color:var(--color-secondary-200); border-color:var(--color-secondary-300); background:transparent; }.
- **Status:** ✅ fixed — Disabled-Rezepte für bare/link/negative Varianten ergänzt

### btn-10 · M · a11y — Lightbox rebuilds the negative outline button ad hoc with a 16%-white border

- **Portal:** css/app.css:2875-2876 — ".pf-lightbox__meta .btn--outline { … color:var(--color-text-negative); border-color:var(--border-negative); }" (rgba(255,255,255,.16) on secondary-900 — component boundary far below 3:1, WCAG 1.4.11) and hover adds a background fill CD's negative variant doesn't have, while the real .btn--outline-negative (app.css:1095) sits unused.
- **CD:** css/components/btn.postcss:87-92 — outline on dark = .btn--outline-negative with a solid white border, hover border/text secondary-100, no background fill.
- **Fix:** Switch the lightbox meta button (js/gallery.js:117) to btn--outline-negative and delete the .pf-lightbox__meta .btn--outline override at css/app.css:2875-2876 — noting that per CD (btn.postcss:87-92, and once btn-9 lands) the button then renders with a solid secondary-500 fill and white border, a visible change from today's ghost style; the white border restores a clearly visible component boundary on the dark panel.
- **Status:** ✅ fixed — Lightbox-Metaknopf = echter btn--outline-negative; Ad-hoc-Override gelöscht

### btn-11 · M · consistency — Four bespoke dark-chrome icon buttons instead of one shared negative bare pattern

- **Portal:** css/app.css:2793-2796 — .pf-lightbox__btn (44px, radius-sm, hover surface-negative-hover); css/app.css:3203-3208 — .docviewer__btn (2.5rem, radius 0.1875rem, close-button hover background:var(--color-primary-600) — turns blue under the intranet skin); css/app.css:3215-3222 — .docviewer__nav (radius-full); css/app.css:3260-3264 — .docviewer__zoom (radius-full, 2.25rem). Same role, four sizes/radii/hover recipes.
- **CD:** CD convention — btn.postcss:101-108 (.btn--bare-negative) combined with .btn--icon-only (btn.postcss:160-166) is the canonical icon-only control on dark surfaces; CD has no primary-colored hover fill anywhere in the button set.
- **Fix:** Base all four on .btn .btn--bare-negative .btn--icon-only plus a thin situational modifier (size/radius where genuinely needed, e.g. the pill-shaped zoom group), and replace the docviewer close-button's primary-600 hover with the shared surface-negative-hover so hover color no longer depends on the skin.
- **Status:** ✅ fixed — Ein Dunkel-Chrome-Rezept: 44px, radius-sm, surface-negative-Hover; primary-Hover am Schliessen entfernt

### btn-6 · L · pixel — Button line-height fixed at 1.2 instead of CD's per-size leading ramp

- **Portal:** css/app.css:1081 — ".btn { … line-height:1.2; }" for all sizes and viewports (19.2px at base font 16px).
- **CD:** css/components/btn.postcss:112-129 — base: "leading-5 lg:leading-6" (20px, 24px from 1024px); sm: "leading-4 lg:leading-5"; lg: "leading-6". Fixed rem values, stepping at lg.
- **Fix:** Set line-height:1.25rem on .btn/.btn--base, 1rem on .btn--sm, 1.5rem on .btn--lg, and inside @media (min-width:1024px) raise base to 1.5rem and sm to 1.25rem. Only affects multi-line labels (min-height governs single lines), but aligns wrap rhythm with CD.
- **Status:** ✅ fixed — CD leading ramp: .btn 1.25rem, --sm 1rem, --lg 1.5rem, plus @media 1024px base 1.5rem / sm 1.25rem. Verified computed 24px at 1280 viewport.

### btn-8 · L · consistency — Three different disabled recipes: [disabled]=secondary-300, [aria-disabled]=secondary-400, icon-only=opacity .4

- **Portal:** css/app.css:1088 — outline[disabled] uses secondary-300; css/app.css:1127-1129 — the same states via [aria-disabled="true"] use secondary-400; css/app.css:1125 — ".btn--icon-only[aria-disabled=\"true\"] { opacity:.4; … }" is a third recipe.
- **CD:** css/components/btn.postcss:21-24 etc. — CD's disabled state is always the color pair text secondary-300 / border secondary-200, never opacity.
- **Fix:** Unify: make the [aria-disabled="true"] selectors use the same secondary-300/secondary-200 pair as [disabled], and replace the opacity:.4 on icon-only with the color-based recipe (color:var(--color-secondary-300); border-color:var(--color-secondary-200)).
- **Status:** ✅ fixed — All [aria-disabled] recipes unified to the [disabled] pair (text secondary-300 / border secondary-200); .btn--icon-only opacity:.4 replaced by the colour recipe. Comment documents 

### btn-9 · L · pixel — .btn--outline-negative misses CD's secondary-500 fill

- **Portal:** css/app.css:1095 — ".btn--outline-negative { background:transparent; border-color:var(--color-text-negative); … }" (comment at 1094 cites CD btn.postcss:78-109 but the fill was not carried over).
- **CD:** css/components/btn.postcss:87-92 — ".btn--outline-negative { @apply text-white font-bold; @apply bg-secondary-500; @apply border border-white; … }" — the variant has a solid secondary-500 background.
- **Fix:** Add background:var(--color-secondary-500) (and keep it on hover, per CD only text/border change to secondary-100). Currently unused in markup, but it is the documented API surface and btn-10 proposes using it.
- **Status:** ✅ fixed — bereits durch die erste Welle abgedeckt (verifiziert)

### btn-12 · L · pixel — Icon-only padding in rem instead of CD's em

- **Portal:** css/app.css:1121 — ".btn--icon-only { gap:0; padding-left:.625rem; padding-right:.625rem; }" — fixed 10px at every viewport.
- **CD:** css/components/btn.postcss:160-162 — ".btn--icon-only { @apply px-[0.625em]; }" — scales with the button font (11.25px at the xl step where text--base = 18px).
- **Fix:** Change to padding-left:.625em; padding-right:.625em so icon-only buttons keep CD's proportions on the 1280/1920 font steps.
- **Status:** ✅ fixed — bereits durch die erste Welle abgedeckt (verifiziert)

### btn-13 · L · naming — Three call conventions for icons inside buttons; icon--* size class is a documented no-op there

- **Portal:** js/components.js:307 uses 'btn__icon icon--base', components.js:1376 uses 'btn__icon', js/apps/building-create.js:164 and ~20 other sites use only 'icon--base' — while css/app.css:1114-1118 documents that ".btn .icon { width:1.4em }" (0,2,0) overrides every .icon--* class inside a button, so the size class is dead weight.
- **CD:** app/components/ch/components/Btn.vue:11 — the icon inside a button is always and only class btn__icon.
- **Fix:** Standardize every icon() call inside a .btn on the single class 'btn__icon' (mechanical find/replace); reserve icon--* for icons outside buttons. Removes markup that promises a size it can never deliver.
- **Status:** ✅ fixed — Every C.icon() inside a .btn in the four files now uses the single class 'btn__icon' (this also activates the .btn--icon-left/right .btn__icon spacing rules, which require that cla

### btn-14 · L · pixel — .btn__icon geometry/transition drift: square 1.4em, no transform transition; color transition added instead

- **Portal:** css/app.css:1118 — ".btn .icon, .btn__icon { width:1.4em; height:1.4em; flex:none; }" (no transition); css/app.css:1081 — .btn adds background/color/border transitions 150ms that CD does not define.
- **CD:** css/components/btn.postcss:147-152 — ".btn__icon { @apply w-[1.4em] h-full; … @apply transition-transform duration-200; }" — height fills the button, and the only button transition in CD is the icon transform.
- **Fix:** Add transition:transform var(--duration) to the .btn .icon/.btn__icon rule (rotating chevrons then animate without per-component rules like .catbar__chev). Keeping the color transitions and the square 1.4em box are defensible for the mask technique — document them in the German comment if retained.
- **Status:** ✅ fixed — transition:transform var(--duration) added to .btn .icon/.btn__icon; the 1.4em square box (mask technique) and the extra colour transitions documented as deliberate in the German c

### btn-15 · L · pixel — .btn--link hover: underline instead of CD's primary-700 color shift

- **Portal:** css/app.css:1101-1102 — ".btn--link { … color:var(--color-primary-600); … } .btn--link:hover { text-decoration:underline; }" — color stays 600, underline appears; no rationale comment.
- **CD:** css/components/btn.postcss:38-41 — ".btn--link { @apply text-primary-600 …; @apply hover:text-primary-700; }" with .btn's no-underline (btn.postcss:10) — hover darkens, never underlines.
- **Fix:** Replace the hover rule with color:var(--color-primary-700) (keep text-decoration:none). Matches .btn--outline's existing 600→700 hover in the same sheet.
- **Status:** ✅ fixed — .btn--link:hover now darkens 600->700 (CD), underline removed. The .doc-open (0,2,0) underline rule is a separate, deliberate portal control and untouched.

### btn-16 · L · pixel — .btn--link icon renders at 1.4em instead of CD's 2rem

- **Portal:** css/app.css:1118 — the generic 1.4em (~22.4px) applies to link buttons too; used by downloadLink (js/components.js:1108-1112) and the arrow links in js/pages/my-cases.js:114,117.
- **CD:** css/components/btn.postcss:43-47 — ".btn--link .btn__icon { @apply w-8; … }" — 2rem icon with near-zero stroke; download/arrow icons in link buttons are deliberately larger in CD.
- **Fix:** Add .btn--link .btn__icon, .btn--link-negative .btn__icon { width:2rem; height:2rem; } after the generic rule (same specificity, later wins for width; height stays square for the mask).
- **Status:** 🔶 partial — JS-Anteil umgesetzt; CSS-Rest: css/app.css: after the generic `.btn .icon, .btn__icon { width:1.4em; height:1.4em; }` rule (app.css:1164), add `.btn--link .btn__icon, .btn

### btn-17 · L · consistency — .btn--bare keeps the 1px transparent border the other borderless variants reset

- **Portal:** css/app.css:1092 — ".btn--bare { background:none; color:…; padding-left:.5rem; padding-right:.5rem; }" — inherits border:1px solid transparent from .btn (1079), while .btn--bare-negative (1097), .btn--link-negative (1099) and .btn--link (1101) all set border:0.
- **CD:** css/components/btn.postcss:27-36 — .btn--bare has no border at all (only outline/filled/outline-negative apply one).
- **Fix:** Either add border:0 to .btn--bare (matching its negative twin) or, cleaner, remove border from .btn and let only outline/filled/outline-negative declare it — then delete the four border:0 resets.
- **Status:** ✅ fixed — border:0 added to .btn--bare, matching its negative twin (CD bare has no border).

### btn-18 · L · pixel — .btn--bare-negative narrows padding to .5rem although CD keeps px-4 for it

- **Portal:** css/app.css:1097 — ".btn--bare-negative { … padding-left:.5rem; padding-right:.5rem; }" — copied from .btn--bare.
- **CD:** css/components/btn.postcss:101-109 — .btn--bare-negative does NOT override padding; only .btn--bare has px-2 (btn.postcss:28). The negative bare keeps .btn's px-4 (1rem).
- **Fix:** Drop the padding overrides from .btn--bare-negative so it inherits 1rem from .btn (CD quirk, but it is the ground truth; currently unused in markup so the fix is free).
- **Status:** ✅ fixed — Padding overrides removed from .btn--bare-negative so it inherits .btn's px-4; unused in markup (grep), so the change is free. CD-quirk noted in comment.

### icon-1 · L · a11y — Forced-colors mode paints button icons LinkText instead of the button's own system color

- **Portal:** css/app.css:472-473 — "@media (forced-colors: active){ .icon { forced-color-adjust:none; background-color:CanvasText; } .btn .icon, .btn--link .icon, a .icon { background-color:LinkText; } }" — inside a real <button> the label is forced to ButtonText while its icon renders LinkText (two colors in one control; filled buttons lose their fill and the mismatch shows).
- **CD:** CD convention — icons.postcss:5-13 uses inline SVG with fill-current, which automatically tracks the forced color of its context (ButtonText in buttons, LinkText in links).
- **Fix:** Replace the static colors with context tracking: .icon { forced-color-adjust:none; background-color:currentColor; } — with forced-color-adjust:none on the span, currentColor resolves to the parent's forced color (ButtonText/LinkText/CanvasText) exactly like CD's fill-current. Keep a LinkText fallback only for bare <a> contexts if testing shows engines not forwarding it.
- **Status:** ✅ fixed — Forced-colors: .icon now background-color:currentColor with forced-color-adjust:none (tracks ButtonText/LinkText/CanvasText like CD fill-current); static LinkText rule deleted.

### icon-2 · L · naming — Icon size scale truncated at 2xl (CD ships full/3xl/4xl/5xl)

- **Portal:** css/app.css:451-462 — scale ends at .icon--2xl (values sm→2xl and their 768/1024 steps verified identical to CD: .75/1/1.25→1.5/1.5→1.75/1.75→2→2.25/2.25→2.5→3rem).
- **CD:** css/foundations/icons.postcss:15-53 — additionally defines .icon--full (w-full), .icon--3xl (h-12/16/20), .icon--4xl (h-20/24/28), .icon--5xl (h-28/32/36).
- **Fix:** Treat as documentation/API-parity backlog: add .icon--full { width:100% } and .icon--3xl/4xl/5xl (heights 3/4/5rem, md 4/6/8rem... i.e. CD's 3-4-5 / 5-6-7 / 7-8-9rem ramps at base/768/1024, width tracking height for the mask) the first time a view needs an icon above 3rem; nothing renders differently until then, so bundling it with a consuming change keeps the sheet free of dead rules.
- **Status:** ✅ fixed — Comment-only per the verified note: icon--full/3xl/4xl/5xl follow with the first >3rem consumer; adding them now would be dead CSS.

### b2t-1 · L · pixel — Back-to-top button never reaches CD's 4rem size, contradicting its own rationale

- **Portal:** css/app.css:1884-1886 — lg and xl both cap at 3rem; the comment ("CDs xl:w-16 setzt eine Platzierung im Seitengraben voraus, die erst ab 1920 gilt") argues the 4rem size belongs to the gutter placement available from 1920 — yet no ≥1920 rule restores it. Also .back-to-top-btn__icon (1893) is 50%/50% vs CD w-1/2 h-full.
- **CD:** css/components/back-to-top-btn.postcss:27-30 — w-11/h-11 → lg:w-12/h-12 → xl:w-16/h-16; back-to-top-btn.postcss:53-57 — icon w-1/2 h-full.
- **Fix:** Add @media (min-width:1920px){ .back-to-top-btn { width:4rem; height:4rem; } } (the rationale's own condition), and set the icon to height:100% with width:50%.
- **Status:** ✅ fixed — Added @media 1920px width/height 4rem (the rationale's own condition) and fixed the icon to w-1/2 h-full; also moved the rail's 4rem dock reservation from 1280 to 1920 so dock = ma

### nb-1 · L · mobile — Notification-banner buttons force nowrap, defeating the btn__text wrap contract

- **Portal:** css/app.css:357 — ".notification-banner .btn__text { white-space:nowrap; }" — overrides the overflow-wrap:anywhere from .btn__text (1083); a longer action label cannot wrap at 320px and will push the banner row wide.
- **CD:** css/components/btn.postcss:133-137 — .btn__text deliberately allows "line break for all strings" via overflow-wrap:anywhere; CD has no nowrap exception for banners.
- **Fix:** Remove the nowrap rule; the banner's flex layout (app.css:353,356) already keeps the button on its own line on small screens, and short labels are unaffected.
- **Status:** ✅ fixed — .notification-banner .btn__text nowrap rule removed; the banner's column/row anatomy keeps the button on its own line.

## Forms — inputs, selects, search, validation

### srch-1 · M · ux — Search page: text and native clear-X run under the absolute submit button

- **Portal:** css/app.css:1955 — `.search__field { ... padding:.75rem 1rem; ... }` and app.css:1960 — `.search--large .search__submit { position:absolute; top:0; right:0; bottom:0; z-index:2; }` — no right padding reserved for the ~3.5rem wide button; the WebKit cancel-X (app.css:1510-1515) renders at the content-box right edge, underneath the button and unclickable
- **CD:** designsystem css/components/search.postcss:113-124 — `.search__group & input { ... @apply pr-12; }` (3rem right padding reserved for the overlaid button)
- **Fix:** Add `.search--large .search__field { padding-right:3.5rem; }` (matches the btn--lg icon-only width) so long queries and the clear-X stay clear of the submit button — the header search already does this correctly with its 3rem right padding (app.css:679).
- **Status:** ✅ fixed — .search__field reserviert rechts 3.5rem für den überlagerten Knopf

### srch-2 · M · pixel — .search__field drifts from CD: light border, kept shadow, responsive font blow-up

- **Portal:** css/app.css:1955-1956 — `.search__field { ... padding:.75rem 1rem; border:1px solid var(--color-border); background:var(--color-bg); font-size:var(--text-xl); font-weight:var(--fw-bold); outline:none; }` — border #e5e7eb; box-shadow not reset (global input shadow applies); --text-xl ramps 1.25rem → 1.375 @1024 → 1.625 @1280 → 2rem @1920
- **CD:** designsystem css/components/search.postcss:135-141 — `.search--large & input { @apply text-xl font-bold shadow-none; }` (static 1.25rem, shadow removed, border inherits input default text-500 #6b7280); search.postcss:148-152 `.search__field { @apply p-3 }`
- **Fix:** Realign the flagship field: `border-color:var(--color-border-input)` (the #e5e7eb border nearly vanishes on the bg--secondary-50 section), `box-shadow:none` inside .search--large per CD, and cap the size at CD's static step (`font-size:var(--fs-xl)`) or at most one responsive step — 2rem bold at 1920px is visibly off-CD. The placeholder-color override IS documented and correct (app.css:1957-1958: «war --color-secondary-300 ... 3.34:1 (Soll 4.5:1) ... --color-placeholder = 5.65:1») — keep it.
- **Status:** ✅ fixed — Input-Rahmenfarbe, shadow:none, statisches fs-xl statt responsiver Rampe

### srch-3 · M · consistency — Four bespoke search-input heights (44/48/52/64px) across the portal

- **Portal:** css/app.css:680 — header `.search__form input { ... min-height:var(--target-min) }` (44px fixed); app.css:1919 — `.service-controls__search input { min-height:3rem; }` (48px fixed); app.css:2990 — `.home-search input { ... min-height:3.25rem; ... }` (52px fixed); app.css:2312 — `.catbar__search input { min-height:var(--target-min); }` (44px fixed); app.css:1954 — `.search--large .search__group { height:4rem }` — meanwhile every form input rides the --control-h ramp (44→48→52)
- **CD:** CD convention: css/components/input.postcss:1-16 knows exactly one input height ramp (44/48@2xl) plus the single h-16 exception for .search--large (search.postcss:135-137)
- **Fix:** Move header (.search__form input, app.css:680), service-controls (1919) and home (2990) search fields to `min-height:var(--control-h)`, and change `.service-controls__submit` (1920) to `height:var(--control-h)` in the same commit so the bottom-aligned button keeps tracking the field. Keep .search--large at the CD-sanctioned 4rem. For the catbar, either move the whole documented equal-height cluster (input, bare sort, filter toggle, view-switch — app.css:2312/1940/2316-2318) to --control-h together, or leave the catbar at --target-min as a documented compact-toolbar exception — but do not ramp only its input.
- **Status:** ✅ fixed — Header/Service/Home-Suche auf --input-h; search--large bleibt CD-h-16; Katalogleiste dokumentierte Ausnahme

### act-1 · M · mobile — .form__actions is fully styled but zero forms use it — mobile action rows break the CD pattern

- **Portal:** css/app.css:1453-1460 defines `.form__actions { display:flex; flex-direction:column-reverse; ... }` with the comment «(a) Aktionsreihe ... column-reverse hält die Primäraktion im DOM zuletzt ... und zeigt sie auf Mobile ZUERST und vollbreit — wie CDs eigene Formularaktion (newsletter.postcss:35-39, btn.postcss:193-195)» — but all five forms use `.row`: js/apps/fault-report.js:141 `<div class="row row--end mt-4">`, building-create.js:163/193/217, space-request.js:97/109/129, workspace.js:140
- **CD:** designsystem css/sections (newsletter.postcss:35-39) / btn.postcss:193-195 — form action row: primary action full-width and first on mobile
- **Fix:** Swap the five action rows to the class the stylesheet already provides: `<div class="form__actions">` (append `form__actions--between` where a Zurück button leads). Today `.row { flex-wrap:wrap }` (app.css:2946) stacks «Abbrechen» ABOVE the intrinsic-width submit on narrow screens — exactly the layout the app.css comment says was built to prevent.
- **Status:** ✅ fixed — All 8 action rows swapped: fault-report.js (row row--end mt-4 -> form__actions), building-create.js x3 and space-request.js x3 (row--between -> form__actions form__actions--between

### errsum-1 · M · a11y — Error-summary pattern applied to 2 of 4 validating forms

- **Portal:** js/apps/fault-report.js:117-150 and :185-188 — validation populates state.errors and re-renders, but no `C.errorSummary` and no `C.wireErrorSummary` (focus stays wherever it was); js/apps/workspace.js:128-143 (buchung-form) likewise; also no «Mit * markierte Felder»-legend line, which space-request.js:72 and building-create.js:271 render
- **CD:** Portal's own established pattern (space-request.js:73+186, building-create.js:272+385 — «Fehlversuch: neu zeichnen, dann Fokus auf die Fehlerübersicht — sonst landet er auf <body> und der Nutzer erfährt nichts (WCAG 3.3.1)»); CD convention: consistent form validation feedback
- **Fix:** In fault-report.js first re-key errors by DOM id — `e.bld = 'Bitte Gebäude / Standort wählen'` and update the consumer `message: state.errors.bld` (line 131) — then add `${C.errorSummary({ errors: state.errors, labels: FIELD_LABELS })}` above the form with FIELD_LABELS { bld: 'Gebäude / Standort', beschreibung: 'Beschreibung' } and call `C.wireErrorSummary(mount)` in the failed-submit branch (line 188). workspace.js needs no re-keying ('datum' is already the DOM id, workspace.js:134-135): add the summary, wireErrorSummary on the failed branch (line 242), and the asterisk-legend line in both.
- **Status:** ✅ fixed — fault-report.js: errors re-keyed to DOM id 'bld' (validate + both message consumers), FIELD_LABELS {bld, beschreibung} added, C.errorSummary rendered above the form, C.wireErrorSum

### cbx-1 · M · a11y — Address combobox (bc-address) has no label — accessible name is the placeholder

- **Portal:** js/apps/building-create.js:140-145 — `<input id="bc-address" ... role="combobox" ... placeholder="Adresse suchen, z. B. Fellerstrasse 21 Bern" ...>` — no <label>, no aria-label; aria-describedby points at a hint, which does not name the field
- **CD:** designsystem css/components/search.postcss:113-118 — `.search__group & label { @apply sr-only; }` — CD search inputs always carry a (visually hidden) label; portal follows this in shell.js:220 and home.js:160
- **Fix:** Add `<label class="sr-only" for="bc-address">Adresse suchen</label>` inside .map-search__field (or `aria-label="Adresse suchen"`). Placeholder-as-name is fragile: some AT ignores it and it visually disappears the moment the user types.
- **Status:** ✅ fixed — Added <label class="sr-only" for="bc-address">Adresse suchen</label> inside .map-search__field with a WHY comment referencing the CD search pattern (placeholder is not an accessibl

### inp-1 · L · pixel — Input height ramp steps at xl/3xl instead of CD's 2xl

- **Portal:** css/app.css:1488 — `input, select, textarea { ... min-height:var(--control-h) ... }` with css/tokens.css:98/305/314 — `--control-h: 2.75rem` → `3rem` @1280 (xl) → `3.25rem` @1920 (3xl)
- **CD:** designsystem css/components/input.postcss:1-4,16 — `--input-min-height: 44px; --input-min-height-2xl: 48px` and `min-h-[var(--input-min-height)] 2xl:min-h-[var(--input-min-height-2xl)]` — CD inputs are 44px, stepping to 48px only at 2xl (1544px), never 52px
- **Fix:** Documented deviation (app.css:1484-1487: «EINE Steuerhöhen-Rampe im ganzen Produkt (Item 2.5e). Vorher liefen zwei ... auf demselben Bildschirm wären die Steuerhöhen an unterschiedlichen Breakpoints gesprungen.»). The rationale still holds — buttons and inputs sit side by side in search groups and action rows, and CD's own ramps would mismatch them between 1280-1543px. Keep the unified ramp, but extend the comment to state the concrete CD delta (inputs 48px@1280 and 52px@1920 vs CD 44/48@1544) so future audits do not re-litigate it.
- **Status:** ✅ fixed — bereits durch die erste Welle abgedeckt (verifiziert)

### inp-2 · L · pixel — Placeholder color hardcoded, ignores intranet skin (CD: secondary-400)

- **Portal:** css/tokens.css:86 — `--color-placeholder: #596978;    /* secondary-400 — AA on white */` consumed at css/app.css:1491 — `input::placeholder, textarea::placeholder { color:var(--color-placeholder); }`
- **CD:** designsystem css/components/input.postcss:18 — `@apply placeholder-secondary-400;` where secondary-400 is the skinned variable — under the intranet skin it resolves to #5076b3 (blue), matching the portal's own tokens.css:268 `--color-secondary-400: #5076b3`
- **Fix:** Either document the decoupling in the token comment at tokens.css:86 the way --color-error-400/700 does (tokens.css:67-69), or couple per-skin: keep `--color-placeholder: var(--color-secondary-400)` in :root and .body--intranet (5.65:1 and 4.58:1, both AA), but add an explicit AA-checked override in .body--freebrand — its secondary-400 #758874 is only 3.80:1 on white.
- **Status:** ✅ fixed — Freebrand override added: --color-placeholder: var(--color-secondary-600) (#5f755f = 5.0:1 AA; secondary-400 #758874 would be 3.80:1). Plus the intranet re-declaration (see placeho

### inp-3 · L · pixel — .input--sm/--base/--lg drop CD's line-height overrides

- **Portal:** css/app.css:1516 — `.input--sm { font-size:var(--text-sm); } .input--base { font-size:var(--text-base); } .input--lg { font-size:var(--text-lg); }` — no line-height, so the base rule's `line-height:1` (app.css:1488) wins
- **CD:** designsystem css/components/input.postcss:21-31 — `.input--sm { @apply text--sm leading-6; } .input--lg { @apply text--lg leading-7; } .input--base { @apply leading-6 text--base; }` (leading-6 = 1.5rem, leading-7 = 1.75rem)
- **Fix:** Port the leadings for CD parity: `.input--sm, .input--base { line-height:1.5rem; } .input--lg { line-height:1.75rem; }` — but with the impact stated honestly: textareas already carry 1.5rem via app.css:1492 (sm/base textareas are CD-correct today; no input--lg consumer exists), so the change only formally aligns single-line inputs/selects, where centering hides the drift. Note in the comment that sized inputs grow to 46px at <1280px (24px line + 20px padding + 2px border beats the 44px min-height), exactly as CD's own input--base does.
- **Status:** ✅ fixed — CD leadings ported (sm/base 1.5rem, lg 1.75rem) with the honest comment: textareas already carried 1.5rem; single-line sm/base fields grow to 46px exactly like CD's own input--base

### inp-5 · L · consistency — CD state/variant rules not ported: negative hover/disabled, error+negative, error label, radio-after-label gap, checkbox size variants

- **Portal:** css/app.css:1520-1522 — `.input--negative { color...; background...; border-color... }` (no :hover/:focus, no :disabled variant, no `.input--error.input--negative`); app.css:1536-1537 (no `.input--error.input--negative + .select__icon`); no `.input--error + label` rule; no `label + .form__group__radio` rule; no checkbox/radio `.input--sm/--lg` sizes
- **CD:** designsystem css/components/input.postcss:55-57 (`.input--error & + label { text-red-800 mr-3 }`), :60-76 (`.input--negative hover:text-text-300 focus:text-text-300`, disabled `bg-secondary-300 text-secondary-200`, `.input--error.input--negative { text-red-200 border-red-300 }`), :95-107 (checkbox size variants); css/components/select.postcss:66-72; css/components/form.postcss:19-22 (`label + .form__group__radio { mt-2 }`)
- **Fix:** Port the listed 6 state rules exactly as given (values verified against CD), and complete the set with the size variants the title names: `input[type='checkbox'].input--sm, input[type='radio'].input--sm { width:.75rem; height:.75rem; }` and `input[type='checkbox'].input--lg, input[type='radio'].input--lg { width:1rem; height:1rem; }` (CD input.postcss:95-108; base .9rem is already the portal's base rule at app.css:1551).
- **Status:** ✅ fixed — All six CD state rules ported (.input--error + label, negative hover/focus text-300, negative disabled bg-300/text-200, error.negative red-200/300, error.negative + .select__icon, 

### chk-1 · L · pixel — Checkbox rows double the box-to-label gap (1rem vs CD 0.5rem)

- **Portal:** css/app.css:1438 — `.form__group__checkbox { display:flex; align-items:baseline; gap:.5rem; margin-bottom:.5rem; }` combined with app.css:1551 — checkbox `margin:0 .5rem 0 0` → 1rem total gap
- **CD:** designsystem css/components/form.postcss:25-27 — `.form__group__checkbox { @apply mb-2; }` (block, no flex/gap) + input.postcss:82 `mr-2` → 0.5rem gap; only the radio row (form.postcss:17-19, flex gap-2) reaches 1rem in CD
- **Fix:** Keep the flex row, zero the margin only for the checkbox row, and win the tie explicitly: add `.form__group__checkbox input[type='checkbox'] { margin-right:0; }` (or place a `.form__group__checkbox input { margin-right:0; }` rule after app.css:1551) so the flex gap alone delivers CD's 0.5rem. Leave the radio row untouched — its effective 1rem already equals CD's (form.postcss:17-19 + input.postcss:82). Note in the comment that both row classes are currently without consumers.
- **Status:** ✅ fixed — .form__group__checkbox input[type=checkbox]{margin-right:0} — flex gap alone now delivers CD's 0.5rem; radio row untouched (already CD-effective 1rem); no-consumer status noted in 

### srch-4 · L · consistency — Visible search cancel-X where CD hides it — documented, but WebKit-only

- **Portal:** css/app.css:1508-1515 — comment «Native Löschen-Schaltfläche (X) sichtbar lassen, im CD-Stil (Cancel-Icon) — erscheint, sobald Text eingegeben ist, und leert das Feld.» styling `input[type='search']::-webkit-search-cancel-button { -webkit-appearance:none; ... mask:url('../assets/icons/Cancel.svg') ... }`
- **CD:** designsystem css/components/input.postcss:165-171 — `.search__group input[type='search']::-webkit-search-cancel-button, input[type='search']::-webkit-search-decoration, ... { display: none; }` — CD suppresses the native X inside search groups
- **Fix:** The rationale (clear affordance) holds for standalone fields, but it relies on a WebKit pseudo-element: Firefox users get no clear affordance anywhere, so behavior differs by browser. Where a clear control matters, prefer the portal's own real button pattern (.map-search__clear, building-create) which is cross-browser and 40px+; inside .search__group contexts follow CD and hide the native X so it cannot collide with the overlaid submit (see srch-1).
- **Status:** ✅ fixed — Deviation kept, comment extended: BEWUSSTE ABWEICHUNG from input.postcss:165-171, collision solved by reserved padding-right (srch-1), WebKit-only limitation named, cross-browser b

### fset-1 · L · consistency — Fieldset grouping styled but unused — 7-field wizard steps render flat

- **Portal:** css/app.css:1479-1482 — «(e) Fieldset-Gruppierung (Item 3.14) — vollständig gestaltet, bisher ohne Konsumenten.» `.form > .form__group > * + * { margin-top:1.5rem; } .form__group__legend { font-size:var(--text-lg); font-weight:var(--fw-bold); }`; js/apps/building-create.js:169-196 renders 7 sibling fields (3 readonly identifiers + 4 classification inputs) with no grouping
- **CD:** designsystem app/components/ch/components/Fieldset.vue:1-15 — `<fieldset class="form__group"><legend class="form__group__legend">` is the canonical grouping; css/components/form.postcss:5-10
- **Fix:** Markup-only realignment: in building-create step 2 wrap the derived identifiers (Objektbezeichnung/EGID/EGRID) and the manual classification fields (Teilportfolio/Gebäudeart/Eigentum/Baujahr) in two `<fieldset class="form__group">` with legends — the two clusters are already narrated as distinct in the code comment («Zuerst die abgeleiteten Felder ..., dann die Handeingabe»); the CSS for it exists and is dormant.
- **Status:** ✅ fixed — building-create step 2 now renders two <fieldset class="form__group"> with <legend class="form__group__legend">: 'Abgeleitete Angaben' (bc-bez/bc-egid/bc-egrid) and 'Klassifizierun

### selreq-1 · L · ux — fault-report required Gebäude-select can never be invalid (no empty option)

- **Portal:** js/apps/fault-report.js:91 — `buildingId: gueltig ? vorgabeBld : (buildings[0] ? buildings[0].bbl_id : '')` and :103/:130 — `buildingOpts = buildings.map(...)` passed to C.select with `required: true` but no empty «Bitte wählen» entry; validate() (:176) checks `!state.buildingId`, which is always truthy
- **CD:** Portal's own sibling pattern: js/apps/building-create.js:185/188 — `options: [PLEASE_PICK, ...TEILPORTFOLIO]` gives required selects a genuine unselected state
- **Fix:** Either drop `required:true` (and aria-required) from the pre-filled select — matching the documented «Markup und Prüfung beschreiben dieselbe Menge» principle from space-request.js:168-170 — or prepend the PLEASE_PICK empty option like building-create so the required semantics are real. Current state announces a requirement that cannot fail while silently defaulting to the first of 21 buildings.
- **Status:** ✅ fixed — Took the PLEASE_PICK branch (matching building-create): buildingId now defaults to '' (only the ?building= deep-link prefills) and buildingOpts is prepended with {value:'', text:'B

### cbx-2 · L · consistency — Two drifted combobox implementations (home suggest vs map address search)

- **Portal:** js/search-suggest.js:50-157 — closes via blur+120ms timeout, opens at 2 chars, no hover-highlight, option ids `${listId}-${i}`; js/apps/building-create.js:310-510 — closes via document-click AbortController, opens at 3 chars + 300ms debounce, mousemove highlight, option ids `bc-opt-${n}`; skins also differ: `.suggest` (app.css:3003-3011, bordered flat list, secondary-300 border) vs `.map-search__list` (app.css:2726-2734, floating rounded, shadow-2xl)
- **CD:** CD convention — one canonical pattern per widget (cf. the shared C.select/C.field factories the portal itself established)
- **Fix:** Extract the shared ARIA mechanics (open/close/highlight/choose, aria-expanded/activedescendant handling) into one helper both call, and let one listbox skin with a modifier (.suggest--float) carry both looks. The behavioral deltas (blur-close vs outside-click, 2 vs 3 chars) are currently unexplained differences a keyboard user can feel.
- **Status:** 🔶 partial — JS-Anteil umgesetzt; CSS-Rest: The full de-drift needs shared files: a C.combobox helper (open/close/highlight/choose + aria-expanded/activedescendant) in js/components.js

### cbx-3 · L · consistency — Listbox active-option highlight is a light tint; CD's canonical dropdown highlight is dark

- **Portal:** css/app.css:3009 — `.suggest__item:hover, .suggest__item.is-active { background:var(--color-secondary-50); }` (hover and keyboard-active are indistinguishable) and app.css:2733-2734 — `.map-search__option.is-active, .map-search__option:hover { background:var(--color-secondary-50); }` / `[aria-selected="true"] { background:var(--color-primary-100); }`; documented at app.css:3000-3001 «Optik nach dem CD-Menü (menu__item): ... aktive Zeile in der Sekundärfläche»
- **CD:** designsystem css/components/multiselect.postcss:70-71 — `--vs-dropdown-option--active-bg: theme('colors.text.600'); --vs-dropdown-option--active-color: theme('colors.white')` — CD's only listbox-popup component marks the active option dark-on-light-inverted
- **Fix:** The menu-derived tint is a defensible documented choice, but secondary-50 on white is a very low-salience keyboard cue (the two lists are also internally inconsistent: map-search separates selected vs active, suggest does not). Adopt CD's stronger active state — `background:var(--color-gray-600); color:#fff` — for `.is-active` in both lists, or at least add a visible inset accent so aria-activedescendant users can find the highlight at a glance.
- **Status:** ✅ fixed — Keyboard-active rows in both listboxes now use CD's multiselect invert (gray-600 bg, white text, children inherit); hover stays secondary-50 so hover != active; map-search .is-acti

### tgt-1 · L · mobile — Suggest/map options and map clear button fall below the portal's 44px target floor

- **Portal:** css/app.css:3007 — `.suggest__item { ... padding:.55rem .9rem; ... }` (~38-40px rows at text-sm); app.css:2729-2731 — `.map-search__option { ... padding:.55rem .7rem; ... font-size:var(--text-sm); }` (~36px); app.css:2718-2720 — `.map-search__clear { ... width:2.5rem; height:2.5rem; ... }` (40px)
- **CD:** Portal's own token contract css/tokens.css:100-105 — «Feste Mindest-Tippfläche (WCAG 2.5.8 'Target Size', 44px)» `--target-min: 2.75rem` — applied to catbar controls, filter-check (app.css:2202) and search buttons, but not here
- **Fix:** Drop the .suggest__item change — its two-line anatomy already clears 44px. Apply the floor where it is genuinely broken: `.map-search__option { min-height:var(--target-min); }` (align-items:center is already set) and `.map-search__clear { width:var(--target-min); height:var(--target-min); right:0; }` — the input already reserves padding-right:var(--target-min) (app.css:2714), so the bigger button fits without overlapping text.
- **Status:** ✅ fixed — Applied the corrected scope: .map-search__option min-height:var(--target-min), .map-search__clear 44px at right:0 (field already reserves the width). .suggest__item untouched — its

### hint-1 · L · pixel — Hint margin stacks on the flex gap — uneven rhythm inside form groups

- **Portal:** css/app.css:1472 — `.form__group__hint { margin:0 0 .35rem; ... }` inside app.css:1434 — `.form__group__input, .form__group__select { ... display:flex; flex-direction:column; gap:.5rem; }` → label→hint = .5rem but hint→control = .85rem
- **CD:** designsystem css/components/form.postcss:12-15 — `.form__group__input ... { @apply w-full space-y-2; }` — uniform 0.5rem rhythm between all children of a form group
- **Fix:** Set `.form__group__hint { margin:0; }` — the flex gap already provides the CD spacing; the extra .35rem is a leftover from a non-flex context and makes hint-bearing groups visibly taller than their neighbors.
- **Status:** ✅ fixed — .form__group__hint margin:0 — the group's flex gap provides the uniform 0.5rem rhythm (CD space-y-2).

### msg-1 · L · pixel — Form message badge raised above CD's 10px ramp — documented deviation, holds, but ramps past CD's cap

- **Portal:** css/app.css:1477-1478 — `.form__group__input > .badge--sm, .form__group__select > .badge--sm { font-size:var(--text-sm); line-height:1.35rem; padding:.219em .75em; }` — --text-sm resolves to 1rem @1280 and 1.125rem @1920
- **CD:** designsystem css/components/badge.postcss:79-82 — `.badge--sm { @apply text-[10px] md:text-xs lg:text-sm; @apply leading-4 md:leading-[1.35rem]; }` — CD validation messages top out at 0.875rem
- **Fix:** Rationale documented and valid (app.css:1473-1476: «`.badge--sm` startet bei 10px (CD badge.postcss:76) — das ist die kleinste Schrift der App und trägt die folgenreichste Microcopy.») — keep the floor. But the responsive --text-sm keeps growing past CD's lg cap; if pixel parity at large screens matters, use the static step: `font-size:var(--fs-sm)` (0.875rem) which still satisfies the readability rationale at every viewport.
- **Status:** ✅ fixed — Form message badges capped at the static --fs-sm step (0.875rem at every viewport); readability-floor rationale kept and comment extended with the CD lg cap.

### hdr-1 · L · pixel — Header search: CD's lg py-4 not applied; overlay re-architecture is documented and sound

- **Portal:** css/app.css:679-680 — `.search__form input { width:100%; padding:.625rem 3rem .625rem 1rem; ... min-height:var(--target-min); }` — same .625rem vertical padding at all widths
- **CD:** designsystem css/components/search.postcss:120-123 — `.search__group & input { @apply h-full lg:py-4; @apply pr-12; @apply bg-white; }` — at lg+ the header search input gets 1rem vertical padding (taller field)
- **Fix:** Add `@media (min-width:1024px){ .search__form input { padding-top:1rem; padding-bottom:1rem; } }` for CD parity of the opened header field. The larger re-architecture (toggle + slide-out + full-width row below lg, logo fade) is a documented deviation with measurements (app.css:684-689: «Das offene Feld lag quer über der Bundesmarke: es überlappte das Logo um 64px bei 320 ... Unser Markenblock ist breiter als CDs (Amt + Produkt + Intranet-Pille), darum gilt das bis lg statt nur bis xs») — the rationale checks out against the wider logo block; keep it.
- **Status:** ✅ fixed — @media 1024px py-4 on .search__form input added (CD search.postcss:120-123); documented overlay re-architecture untouched.

### leg-1 · L · consistency — Three legend typographies in play; form legend deviates from CD's base-size legend

- **Portal:** css/app.css:1482 — `.form__group__legend { font-size:var(--text-lg); font-weight:var(--fw-bold); }` vs app.css:2195 — `.filter-group__legend { font-size:var(--fs-sm); font-weight:var(--fw-bold); ... margin:0 0 .35rem; }` — two portal legend styles, both off CD
- **CD:** designsystem css/components/form.postcss:8-10 — `.form__group__legend { @apply mb-2; }` — CD legends inherit base typography (size overrides only via explicit text--* props in Fieldset.vue:51-57)
- **Fix:** The form legend upsizing is documented as intentional hierarchy (app.css:1441-1444: «sie ist die Überschrift der Gruppe und steht weiter unten auf --text-lg/--fw-bold») — defensible, keep if wanted. But align the filter panel to the same voice: `.filter-group__legend { font-size:var(--text-sm); }` (responsive token instead of frozen --fs-sm) and unify margin to CD's mb-2 (.5rem) so the two fieldset legends of the product differ by scale, not by system.
- **Status:** ✅ fixed — .filter-group__legend moved to var(--text-sm) + CD mb-2 (.5rem) — both fieldset legends now differ by scale, not system. Form legend upsizing kept as documented.

## Badges, tags, notifications, toasts, banners

### notif-1 · M · pixel — Notification link hover flips to brand primary instead of staying currentColor

- **Portal:** css/app.css:116 — ".notification a:hover, .link:hover, .link:focus { color:var(--color-primary-800); }" (specificity 0,2,1) beats css/app.css:1595-1596 ".notification a { color:currentColor } .notification a:hover { filter:brightness(.5) }" (0,1,1 / no color on hover). Hovered links inside e.g. .notification--error turn intranet blue-800 + brightness(.5) instead of darkened red-800. Contradicts the file's own intent comment at 1593-1594: «Links erben die Meldungsfarbe (currentColor) statt Brand-Primary».
- **CD:** designsystem/css/components/notification.postcss:11-21 — links/btns inside .notification are "text-current border-current" and on hover "text-current brightness-50" (hue never changes, only darkens).
- **Fix:** Remove '.notification a' from app.css:112 and '.notification a:hover' from app.css:116, add 'color:currentColor' to the hover rule at 1596, AND exempt notification links from the #main-content rules: append the complex argument '.notification a' to both :not() lists at app.css:111 and 115 (Selectors 4, supported by all evergreen browsers), or add '#main-content .notification a, #main-content .notification a:is(:hover,:focus) { color:currentColor; }' after 1596. Without this second step, links inside notifications rendered in <main> (error summary, form notifications) stay brand-blue even at rest.
- **Status:** ✅ fixed — .notification a als komplexes :not()-Argument; Hover pinnt currentColor

### notif-2 · M · consistency — Missing .notification .btn currentColor rule — banner button shows primary-600 instead of variant color

- **Portal:** css/app.css:1086 — ".btn--outline { border-color:var(--color-primary-600); color:var(--color-primary-600); }" applies unchanged inside notifications; only the alert variant is overridden (app.css:1592 ".notification--alert .btn { color:var(--color-text-negative); border-color:var(--color-text-negative); }"). The prototype consent banner (js/components.js:142-147) puts a .btn--outline inside "notification notification--info", so it renders primary-600 next to blue-700 text on blue-50.
- **CD:** designsystem/css/components/notification.postcss:11-21 — ".notification .btn, a … { @apply text-current border-current; &:hover { @apply text-current brightness-50; } }": every button inside any notification takes the variant's text color (blue-700 in the info banner).
- **Fix:** Add ".notification .btn { color:currentColor; border-color:currentColor; } .notification .btn:hover { filter:brightness(.5); }" next to app.css:1595 and delete the now-redundant --alert special case at 1592 (it becomes, as line 1593's comment already wishes, a special case of the general rule).
- **Status:** ✅ fixed — .notification .btn erbt currentColor; --alert-Sonderregel entfallen

### notif-3 · M · consistency — button.link inside notifications keeps global link palette (blue on red error band)

- **Portal:** js/app.js:23 — the data-failure band injects '<button type="button" class="link" onclick="location.reload()">Seite neu laden</button>' into a notification--error; css/app.css:112-116 styles ".link" with var(--color-primary-600)/800 (intranet blue), and the currentColor override at 1595 targets only ".notification a", not ".notification .link". Result: blue control text sitting in a red-800-on-red-50 error message.
- **CD:** designsystem/css/components/notification.postcss:11-21 — CD forces text-current on ALL interactive descendants (.btn, a, external links) of a notification; nothing inside a notification keeps the brand link color.
- **Fix:** Extend the selector at app.css:1595-1596 to ".notification a, .notification .link" (both color and hover), so the reload button inherits red-800 like an anchor would.
- **Status:** ✅ fixed — .notification .link in beiden Regeln ergänzt

### toast-1 · M · consistency — Global toast is a bespoke dark pill, not CD's toast-message (anatomy, position, colors, duration)

- **Portal:** css/app.css:2538-2542 — ".toast { position:fixed; left:50%; bottom:2rem; … background:var(--color-secondary-800); color:var(--color-text-negative); padding:.7rem 1.1rem; border-radius:var(--radius-lg); … max-width:calc(100vw - 2rem); }" plus js/components.js:1607-1615 — className 'toast', fade/slide via .toast--in, auto-dismiss after 2800ms. No German comment documents this as a deliberate deviation (the comment only states purpose).
- **CD:** designsystem/css/components/toast-message.postcss:5-18 + ToastMessage.vue — ".toast__message { fixed z-50 bottom-[10%] w-full }", ".toast__message.active { flex justify-center }", inner ".toast__message-notification { max-w-[500px]; mx-[20px] }" which is a full Notification (default success: green-50 bg, green-800 text, CheckmarkCircle icon), shown for 5000ms, display-toggled (no transform animation).
- **Fix:** Refactor toast() to CD anatomy — fixed host 'toast__message active' at bottom:10%, width:100%, display:flex/justify-content:center, containing a notification with max-width:500px and margin-inline:20px, 5000ms timeout, keeping role="status" and the reduced-motion guard — but give it CD ToastMessage's payload shape, toast(msg, variant='success', iconName='CheckmarkCircle'), and pass 'error'/'warning' from the failure call-sites (js/charts.js:507-533 etc.) instead of hardcoding the success look for every message.
- **Status:** ✅ fixed — toast() = CD toast-message: Notification im fixen Host bei 10 %, 5 s, Varianten-Parameter; Ansage über #live

### toast-2 · M · consistency — Second, drifted toast implementation in the document viewer

- **Portal:** js/doc-viewer.js:113-120 — local toast(): className 'docviewer__toast', 2200ms, no transition, appended to the viewer backdrop; css/app.css:3274-3276 — ".docviewer__toast { … bottom:5rem; … background:var(--color-bg); color:var(--color-text); border-radius:var(--radius); box-shadow:0 10px 40px rgba(0,0,0,.45); }" (white card, raw shadow literal) vs the global ".toast" (dark secondary-800 pill, bottom 2rem, var(--shadow-lg), animated, 2800ms). The in-overlay placement is justified by tokens.css:221-222 («--z-viewer … bewusst ÜBER dem Toast: … ein Toast darunter wäre unerreichbar») — that rationale holds for placement, but not for the divergent styling and duration.
- **CD:** CD convention — one toast-message component (toast-message.postcss); a host may reposition it, but anatomy/colors/duration stay identical.
- **Fix:** Keep the backdrop-mounted host (the z-index rationale at tokens.css:221-222 holds) but reuse the shared toast visual and duration: give .docviewer__toast the same declarations as .toast at app.css:2538-2543 including its box-shadow:var(--shadow-lg) (or, after toast-1, the CD notification anatomy), and the same 2800/5000ms timing. Do not swap the literal for var(--shadow-2xl) — that token is a faint light-chrome shadow (tokens.css:176) that disappears on the dark overlay; if a heavier shadow is wanted there, keep it as a documented negative-layer exception alongside .docviewer__toolbar's identical literal (app.css:3259).
- **Status:** ✅ fixed — Docviewer-Toast nutzt dieselbe Anatomie im Viewer-Host (bottom 5rem, dokumentierte Schatten-Ausnahme)

### notif-4 · L · pixel — CD's .notification .btn spacing ramp not implemented (wrapper gap and an inline style stand in)

- **Portal:** css/app.css:348-356 — banner wrapper uses "gap:1rem" (lg: 1.5rem) and ".notification-banner .btn { flex:none; }"; js/components.js:1626 — loginGate hard-codes '<p style="margin:0 0 .75rem">' to create space before its button because no .notification .btn margin rule exists.
- **CD:** designsystem/css/components/notification.postcss:89-92 and notification-banner.postcss:24-27 — ".notification .btn / .notification-banner .btn { @apply mt-4 sm:mt-8 lg:mt-0; @apply lg:ml-6; }": 1rem top gap, 2rem from sm, 0 + 1.5rem left from lg.
- **Fix:** Apply CD's ramp to the banner only: remove the wrapper gap at ALL widths (app.css:350 and 353) and add '.notification-banner .btn { margin-top:1rem } @media(min-width:640px){ .notification-banner .btn { margin-top:2rem } } @media(min-width:1024px){ .notification-banner .btn { margin-top:0; margin-left:1.5rem } }' per notification-banner.postcss:24-27. For the loginGate, whose button sits inside .notification__content rather than beside it, replace the inline style at js/components.js:1626 with a scoped rule such as '.login-gate .btn { margin-top:1rem }' instead of the banner ramp.
- **Status:** ✅ fixed — Banner half applied: wrapper gap removed at ALL widths, CD ramp on .notification-banner .btn (mt-4 / sm:mt-8 / lg:mt-0 + ml-6); wrapper side padding also aligned to --container-px 

### notif-5 · L · naming — Orphan .notification__title rule; CD title anatomy (--with-title/header/content-offset) absent

- **Portal:** css/app.css:1585 — ".notification__title { margin:0; font-weight:var(--fw-bold); }" is the only occurrence of the class in the repo (no JS/HTML emits it; notification() at js/components.js:812-823 renders icon+content+close only).
- **CD:** designsystem/css/components/notification.postcss:98-112 + Notification.vue:5-19 — titled notifications use .notification__header wrapping icon+title, .notification--with-title { block } on the root, and .notification__content-offset { ml-[3.3rem] } to align body text under the title.
- **Fix:** Either delete the dead .notification__title rule, or complete the CD anatomy (add __header, --with-title, __content-offset rules) so a future titled notification lands on canonical classes instead of reviving a half-implemented one.
- **Status:** ✅ fixed — Dead .notification__title rule deleted (zero emitters, grep) and replaced by a comment pointing at CD's full --with-title anatomy so a future titled notification lands canonically.

### notif-6 · L · consistency — Dismiss patterns drifted: inline onclick close vs data-action convention; close is silent, banner close announces

- **Portal:** js/components.js:820 — notification close uses inline 'onclick="this.closest('.notification').remove()"' and js/components.js:1627 — loginGate uses 'onclick="window.__login && window.__login()"', while the menu component documents the house rule «kein inline onclick» (js/components.js:1543-1544); the banner close announces («Hinweis geschlossen.», js/components.js:166) but the notification close removes silently.
- **CD:** CD convention — Notification.vue:20-27 binds the close handler programmatically (@click) with aria-label; no inline handlers in markup.
- **Fix:** Wire the dismiss via a delegated data-action listener (same idiom as wireMenu/wireShare) and call announce('Meldung geschlossen.') on removal, matching mountBanner's behavior.
- **Status:** ✅ fixed — Dismiss rewired: notification() close button now carries data-notification-close (no inline onclick); a one-time delegated document listener (ensureNotificationClose, same idiom as

### badge-1 · L · naming — Badge icon/text anatomy diverges from CD BEM (no badge__icon/badge__icon-left/badge__text; gap + margin double-space)

- **Portal:** css/app.css:1268 — ".badge { … gap:.3rem … }"; js/components.js:359-360 and 601-602 place generic icon('Cancel','icon--sm') / icon('Checkmark','icon--base') directly in the badge, and badge() (js/components.js:82-84) has no .badge__text span; css/app.css:2016 additionally sets ".active-filter .icon { margin-left:.15rem }", stacking with the .3rem gap to .45rem.
- **CD:** designsystem/css/components/badge.postcss:84-97 — ".badge__icon { h-full w-[1.5em]; relative left-[0.4em]; stroke-… }" / ".badge__icon-left { … right-[0.4em] }" (icon optically pulled 0.4em into the 1em padding, no flex gap); Badge.vue:11-18 — text wrapped in <span class="badge__text">.
- **Fix:** Add .badge__icon/.badge__icon-left rules (width:1.5em; position:relative; left/right:.4em) to app.css, emit them from badge()/activeFilters()/the copy-URL badges, wrap the label in .badge__text, and drop the gap on .badge plus the extra margin at 2016 so spacing comes from the CD offsets.
- **Status:** ✅ fixed — CSS half applied (components.js already emits badge__icon-left/badge__text): .badge__icon/.badge__icon-left rules added, gap:.3rem removed from .badge, redundant .share-url .badge 

### badge-2 · L · pixel — .badge base sets white-space:nowrap — not in CD, needs carve-outs and can still clip at zoom

- **Portal:** css/app.css:1268-1269 — ".badge { … white-space:nowrap; … }" with two documented exceptions: 1274-1275 form badges («…ein ganzer Satz, der mit nowrap aus dem Feld läuft») and 1282 ".pill-row .badge { white-space:normal; overflow-wrap:anywhere; }" («Kartenpillen … müssen bei 200% Textzoom umbrechen dürfen (WCAG 1.4.4)»). Badges outside these hosts (e.g. status badges in tables) still cannot wrap at 200% zoom.
- **CD:** designsystem/css/components/badge.postcss:5-9 — .badge sets only inline-flex, items-center, py/px and rounded-full; no white-space handling.
- **Fix:** Remove white-space:nowrap from the .badge base at app.css:1269 to match CD badge.postcss:5-9, and drop the now-redundant white-space:normal declarations at 1274-1275 and 1282 — but keep overflow-wrap:anywhere on .pill-row .badge (or move it to the .badge base), since the comment at 1276-1281 documents a measured WCAG 1.4.4 case a plain wrap cannot fix. If a specific decorative count chip must not wrap, give that call-site a local nowrap.
- **Status:** ✅ fixed — white-space:nowrap removed from the .badge base (CD has none), both carve-outs reduced to what remains needed (text-align:left for form prose, overflow-wrap:anywhere for .pill-row 

### badge-3 · L · consistency — .badge--clickable lacks CD's cursor:pointer and is never emitted; active-filter duplicates its role

- **Portal:** css/app.css:2904 — ".badge--clickable, button.active-filter, a.active-filter { min-height:2rem; }" is the only .badge--clickable rule (no cursor), no JS emits the class; the clickable-badge behavior lives in the portal-own ".active-filter" (css/app.css:2015 — cursor:pointer, transition) attached to badge pills (js/components.js:359-360). The 2rem min-height is a documented a11y addition («Klickbare Pillen erreichen ~2rem (näher an WCAG 2.5.8)», app.css:2903) — that rationale holds (32px ≥ the 24px minimum).
- **CD:** designsystem/css/components/badge.postcss:99-101 — ".badge--clickable { @apply cursor-pointer; }"; BadgeFilter.vue drives interactive badges purely via badge--clickable on a <button>.
- **Fix:** Add cursor:pointer to .badge--clickable and put the class on the active-filter pills (keeping .active-filter for the portal-specific remove-icon/hover styling), so interactive badges carry the canonical CD modifier.
- **Status:** ✅ fixed — cursor:pointer added to .badge--clickable (CD's only own declaration). The removable pills themselves now ride CD's .tag-item anatomy since wave 1, which is the canonical interacti

### badge-4 · L · naming — .badge--teal is a portal extension beyond CD's badge hues (formula-correct)

- **Portal:** css/app.css:1298 — ".badge--teal { background:var(--color-teal-bg); color:var(--color-teal-text); }" with tokens.css:71-77 («CD-Akzent-Hues für Badges/Tags: 100-bg / 800-text … Ergänzt die vier fehlenden Hues») defining #cbfbf8/#11575f.
- **CD:** designsystem/css/components/badge.postcss:16-70 — color set is gray, red/error, yellow, orange/warning, green/success, blue/info, indigo, negative, purple, pink; no teal. Values #cbfbf8/#11575f do match teal-100/teal-800 from app/tailwind.config.js:160-171, so the 100/800 formula is applied correctly.
- **Fix:** Keep (the documented formula extension holds — the hue exists in CD's palette even though badge.postcss omits it), but extend the tokens.css comment to state explicitly that badge--teal itself has no CD counterpart, so a future CD sync doesn't mistake it for canon.
- **Status:** ✅ fixed — tokens.css comment extended: badge--teal is a portal extension with no CD badge counterpart (values are CD teal-100/800) — not to be mistaken for canon in a CD sync.

### badge-5 · L · consistency — Form message badges enlarged from CD's 10px — documented deviation, still justified

- **Portal:** css/app.css:1473-1478 — «(d) Meldungsgrösse. `.badge--sm` startet bei 10px (CD badge.postcss:76) — das ist die kleinste Schrift der App und trägt die folgenreichste Microcopy. Nur dort anheben, wo die Badge Prosa ist…» → ".form__group__input > .badge--sm, .form__group__select > .badge--sm { font-size:var(--text-sm); line-height:1.35rem; padding:.219em .75em; }".
- **CD:** designsystem/css/components/badge.postcss:79-82 — .badge--sm text-[10px] md:text-xs lg:text-sm; Input.vue:22-28 uses exactly "badge badge--sm badge--{type}" for field messages (portal markup at js/components.js:933/1009 matches CD).
- **Fix:** Keep as is — the rationale holds (full-sentence validation copy at 10px is a readability regression CD accepts but the portal need not); the override is correctly scoped to the two form hosts so decorative count chips keep CD's scale.
- **Status:** ⬜ open

### tag-1 · L · consistency — .tag-item--active missing pointer-events:none — active chip stays clickable

- **Portal:** css/app.css:1317 — ".tag-item--active .tag-item__inner, .tag-item--primary .tag-item__inner { background:var(--color-gray-800); color:var(--color-text-negative); }" (colors only); js/apps/tenancies.js:557-559 renders the active floor chip as a clickable <a href="#" … aria-current="true">.
- **CD:** designsystem/css/components/tag-item.postcss:61-67 — ".tag-item--active { @apply pointer-events-none; … }": the active tag is inert.
- **Fix:** Add "pointer-events:none" to .tag-item--active in app.css (keep aria-current="true" — a portal improvement over CD); optionally also guard the click handler so re-selecting the current floor is a no-op.
- **Status:** ✅ fixed — Applied the JS share only: the [data-floor] click handler now returns early when the clicked chip is the active floor (keyboard can still reach the link even with pointer-events:no

### tag-2 · L · pixel — tag-item bottom margin flat .25rem instead of CD's 0 / md 2px / lg 4px ramp

- **Portal:** css/app.css:1303 — ".tag-item { … margin-right:.75rem; margin-bottom:.25rem; … }" at all widths.
- **CD:** designsystem/css/components/tag-item.postcss:9 — "@apply mr-3 md:mb-0.5 lg:mb-1;": no bottom margin below 768px, 0.125rem from md, 0.25rem from lg.
- **Fix:** Drop margin-bottom from the base rule and add "@media(min-width:768px){ .tag-item{margin-bottom:.125rem} } @media(min-width:1024px){ .tag-item{margin-bottom:.25rem} }" to reproduce the CD ramp.
- **Status:** ⬜ open

### tag-3 · L · pixel — tag-item focus ring floats 2px off the pill; CD's ring hugs it (and fires on :focus)

- **Portal:** css/app.css:1319-1320 — ".tag-item:focus-visible { outline:none; } .tag-item:focus-visible .tag-item__inner { outline:2px solid var(--color-focus-ring); outline-offset:2px; }".
- **CD:** designsystem/css/components/tag-item.postcss:17-19 — "&:focus .tag-item__inner { @apply outline-none ring-2 ring-purple-500; }": a 2px box-shadow ring with zero offset, adjacent to the rounded pill, on any :focus.
- **Fix:** Change outline-offset to 0 (or use box-shadow:0 0 0 2px var(--color-focus-ring) which follows the border-radius) so the ring hugs the pill as in CD; :focus-visible may stay — it is the portal-wide convention (app.css:142-149) and strictly an improvement.
- **Status:** ⬜ open

### tag-4 · L · consistency — tag-item hardcodes the 44/48/52px touch ramp instead of consuming --control-h

- **Portal:** css/app.css:1304,1307-1308 — "min-height:var(--target-min)" (static 2.75rem) plus "@media(min-width:1280px){ min-height:3rem } @media(min-width:1920px){ min-height:3.25rem }" — re-implementing exactly the ramp that tokens.css:93-98 declares as «EIN Token für die Touch-Rampe aller Bedienelemente» (--control-h: 2.75rem → 3rem @1280 → 3.25rem @1920, tokens.css:305,314).
- **CD:** designsystem/css/components/tag-item.postcss:37-42 — min-h-[44px] xl:min-h-[48px] 3xl:min-h-[52px] (values match; only the portal's own token indirection is bypassed).
- **Fix:** Replace the three declarations with "min-height:var(--control-h)" and delete the two media-query overrides — identical rendering, one source of truth.
- **Status:** ⬜ open

### tag-5 · L · pixel — Floor-chip row stacks container gap on top of tag-item's own margin (1rem gaps vs CD 0.75rem)

- **Portal:** css/app.css:3365 — ".fp-floors { display:flex; flex-wrap:wrap; gap:.25rem; }" combines with ".tag-item { margin-right:.75rem; … }" (app.css:1303) → 1rem horizontal gaps plus a trailing 0.75rem after the last chip.
- **CD:** designsystem/css/components/tag-item.postcss:9 — spacing between tags comes solely from the tag's own mr-3 (0.75rem); a host adds no extra gap.
- **Fix:** Drop the gap from .fp-floors (rely on the tag's mr-3 like CD), or zero the tag margins inside .fp-floors and let gap:.75rem carry the spacing — either way one mechanism, 0.75rem.
- **Status:** ⬜ open

### tag-6 · L · pixel — Hover transitions on tag-item/active-filter are portal additions absent from CD

- **Portal:** css/app.css:1312 — ".tag-item__inner { … transition:background var(--duration-fast),color var(--duration-fast); }" and css/app.css:2015 — ".active-filter { … transition:background var(--duration-fast); … }" — no German comment documents these as deliberate.
- **CD:** designsystem/css/components/tag-item.postcss:22-27 / badge.postcss — CD tag and badge hover states switch instantly; no transition property.
- **Fix:** Either remove the transitions for literal CD parity, or (preferred, they are harmless polish and reduced-motion-safe via the --duration tokens) add a short comment documenting them as a deliberate portal-wide hover convention so future audits don't re-litigate them.
- **Status:** ⬜ open

### fc-1 · L · a11y — forced-colors borders cover badges and active tags only — notifications, toasts and default tag pills lose their surface

- **Portal:** css/app.css:2902 — "@media (forced-colors:active){ .badge { border:1px solid currentColor; } }" and app.css:1321 — forced-colors outline for .tag-item--active only. No equivalent for .notification (variant surfaces vanish, leaving the 2.5rem icon floating beside text), .toast/.docviewer__toast (borderless floating text), or the default .tag-item__inner (gray-200 pill boundary disappears).
- **CD:** CD convention — CD sources define no forced-colors rules for these components either, but the portal's own documented pattern («Badges behalten in Windows High Contrast … einen sichtbaren Rand, sonst … verschwimmen», app.css:2900-2901) applies equally to every surface-only component.
- **Fix:** Extend the existing block: "@media (forced-colors:active){ .notification, .toast, .docviewer__toast, .tag-item__inner { border:1px solid currentColor; } }" — same rationale, complete coverage.
- **Status:** ⬜ open

### notif-7 · L · ux — 70ch cap on notification content is a portal deviation — documented and still justified

- **Portal:** css/app.css:1029-1030 — ".notification__content > p, .notification__content > ul { max-width:70ch; }  /* die Login-Gates massen 137ch */".
- **CD:** designsystem/css/components/notification.postcss:75-87 — .notification__content sets only min-w-0, margins and break-words; CD relies on the container grid to bound line length, which full-width portal notifications (login gates, data band) do not sit in.
- **Fix:** Keep — the measured 137ch line length breaks readability and the CD mechanism (grid columns) is absent at these call-sites; the deviation is documented at the rule.
- **Status:** ⬜ open

### misc-1 · L · consistency — .share-url .badge redeclares base badge properties verbatim

- **Portal:** css/app.css:2813 — ".share-url .badge { display:inline-flex; align-items:center; gap:.3rem; }" — all three declarations are already set identically by the .badge base rule at app.css:1268.
- **CD:** CD convention — component base classes are not re-declared at call-sites (badge.postcss defines the anatomy once).
- **Fix:** Delete the rule at 2813 (rendering is unchanged); if badge-1 is implemented and the gap moves out of the base rule, ensure the share-url badge uses .badge__icon-left instead of relying on this duplicate.
- **Status:** ⬜ open

## Cards, boxes, tiles, hero

### hero-1 · **H** · pixel — Hero title one type step larger than CD and than every other h1

- **Portal:** css/app.css:1042 — `.hero__title { font-size:var(--text-4xl); font-weight:var(--fw-bold); line-height:var(--lh-tight); }` while app.css:1050 sets `.hero--main-image .hero__title { font-size:var(--text-3xl) }` and app.css:62 sets `h1,.h1 { font-size:var(--text-3xl) }` — so detail pages WITHOUT an image render their h1 at 3rem (xl) while pages WITH an image and all list/home pages render 2.5rem
- **CD:** designsystem/css/sections/hero.postcss:18-22 — `.hero__title { @apply text--3xl font-bold; @apply leading-tight; }`; text--4xl is reserved for `.hero--main` only (hero.postcss:102-104). typography.postcss:106-109 `.h1` is also text--3xl
- **Fix:** Change `.hero__title` to `font-size:var(--text-3xl)`; the `.hero--main-image .hero__title` override (app.css:1050) becomes redundant and can be deleted — exactly mirroring CD, where the main-image override restates the base value. This also removes the cross-page h1 size split.
- **Status:** ✅ fixed — .hero__title = text-3xl wie h1; main-image-Override entfallen

### hero-2 · M · pixel — hero--main-image vertical padding 2rem/0 instead of CD container--py ramp

- **Portal:** css/app.css:1048 — `.hero--main-image { display:grid; gap:1.5rem; padding-top:2rem; padding-bottom:0; }` (the comment at 1046-1047 documents the grid, not the padding values)
- **CD:** hero.postcss:73-75 — `.hero--main-image { @apply container--py; }` → container.postcss:29-31 `py-14 lg:py-20 3xl:py-32` = 3.5/5/8rem top AND bottom
- **Fix:** Delete both padding declarations from .hero--main-image (app.css:1048): top stays 0 via the documented .detail-bar + .hero rule (app.css:934), and the bottom falls back to .hero's var(--section-py) — the CD container--py equivalent already in the sheet. If the tight 0-bottom detail-head rhythm is instead intended, keep it, document it (the comment at 1046-1047 covers only the grid), and align the plain .hero bottom so both detailHead variants share one rhythm. The aside about app.css:325-326 collapsing a following section's gap is accurate but hypothetical (no page renders a section sibling after a hero today).
- **Status:** ✅ fixed — Eigenes Padding der hero--main-image entfernt; CD-Rhythmus greift

### hero-9 · M · consistency — Home page hero is a parallel implementation with an off-scale 900px breakpoint

- **Portal:** css/app.css:2976-2986 — `.home-hero { display:grid; gap:2rem; }` / `@media (min-width:900px){ .home-hero { grid-template-columns:minmax(0,1.1fr) minmax(0,1fr); gap:3rem; } }`, image `aspect-ratio:4/3`; js/pages/home.js:155-181 renders plain h1 + .lead. The comment at app.css:2974 itself says «(CD hero--main-image)» yet none of the hero classes are used
- **CD:** hero.postcss:73-90 — hero--main-image: 6/6 columns from md (768), gap--responsive, hero__title/hero__description anatomy; tailwind.config.js:20-28 — CD screens are 480/640/768/1024/1280/1544/1920, 900px does not exist
- **Fix:** Rebuild the home hero on `.hero.hero--main-image` (h1.hero__title, p.hero__description, the search form as `.hero__cta` content, figure in `.hero__image`). Minimal fix: move the breakpoint to 768px or 1024px, use equal `1fr 1fr` columns, `gap:var(--gap-responsive)`, and 16:9 media to match every other hero image.
- **Status:** ✅ fixed — Startseiten-Hero auf .hero--main-image umgebaut (hero__title/description/cta/image); .home-hero-Rules entfernt

### card-1 · M · pixel — Card hover inverts the footer arrow button to filled primary — not a CD state

- **Portal:** css/app.css:1184-1185 — `.card--clickable:hover .card__footer__action > .btn--outline { background:var(--color-primary-600); border-color:var(--color-primary-600); color:var(--color-text-negative); }`
- **CD:** card.postcss:15-41 — clickable-card hover is exactly: shadow-lg→shadow-2xl, card__title→text-primary-700, and the faint full-card border overlay (border-text-50 @ opacity 90). The outline button in the footer keeps its appearance
- **Fix:** The neighbouring rationale (app.css:1181-1183 «Der Pfeil im Kartenfuss ist Dekoration … erbt aber den Hover-Zustand der Karte, damit er nicht toter Rahmen wirkt») justifies pointer-events:none, not a color inversion; CD's answer to the 'dead frame' concern is the title color + shadow. Delete the inversion rule (in the intranet skin it paints a solid blue block that CD never shows).
- **Status:** ✅ fixed — Pfeil-Inversion beim Karten-Hover gelöscht — CD-Triade Schatten/Titel/Randoverlay

### card-2 · M · pixel — Hover zoom scale(1.04) on card images is off-CD

- **Portal:** css/app.css:1259-1260 — `.card--clickable .photo > img { transition:transform var(--duration-slow) ease; }` / `.card--clickable:hover .photo > img { transform:scale(1.04); }`
- **CD:** card.postcss — no transform on card images in any state; the only scale in the system is scale-102 on the card--highlight background plane (card.postcss:66-70, tailwind.config.js:33-36)
- **Fix:** Remove the zoom so card hover equals CD's shadow/border/title triad; if kept as a portal signature, use the existing token `var(--scale-hover)` (1.02, tokens.css:181) with `var(--ease-in-out)` and add a documenting comment — today it is an undocumented deviation with a magic number and literal `ease`.
- **Status:** ✅ fixed — Bild-Zoom beim Karten-Hover entfernt

### card-9 · M · consistency — card--flat/card--list fully styled but unused, while catalogue-grid re-implements the same flat look

- **Portal:** css/app.css:1205-1235 — complete flat/list card implementation with zero consumers (grep over js/html finds none); app.css:1239-1246 separately flattens `.card--default` inside `.catalogue-grid` under 768px («unter md dieselbe Dichte wie CDs card--list, ohne das Karten-Markup anzufassen»)
- **CD:** card.postcss:331-433 — card--list IS the canonical list rendering (the portal's own comment at app.css:1216-1218 cites newsList.vue:124-137 / searchResults.vue:44-46 and notes «Adoption: Item 5.10»)
- **Fix:** Two mechanisms for one pattern, one of them dead. Either complete the documented adoption (render news/search/catalog result lists as card--list, letting the catalogue-grid override shrink to the grid-gap reset), or remove the unused card--flat/card--list block until adoption — dead variants invite silent drift (its body padding already deviates, see card-10).
- **Status:** ⬜ open

### card-11 · M · a11y — Three whole-card click patterns coexist (stretched link vs two whole-<a> cards)

- **Portal:** js/components.js:199-207 — card() uses the documented stretched `.card__link` (div.card + real heading + overlay ::after); js/components.js:539 — domainTile wraps the whole card in `<a class="card card--default card--clickable">` claiming «(CD-Ausnahme; kein verschachtelter Link)»; js/apps/portfolio.js:165 — pfCard likewise `<a class="card card--universal card--clickable pf-card">`
- **CD:** Card.vue:2-39 + card.postcss:20-25 — the card root is always a div; the inner a/.btn stretches via ::after. No whole-card <a> exists anywhere in CD
- **Fix:** The «CD-Ausnahme» claim has no basis in the CD source, and the whole-<a> pattern makes title+description+meta the accessible name (verbose for screen readers) while the stretched-link version keeps the name to the title. Converge domainTile and pfCard on the `.card__link` pattern card() already implements; the focus-ring rule at app.css:155 for a.card then becomes removable.
- **Status:** ✅ fixed — domainTile und pf-card auf das Stretched-Link-Muster konvergiert

### card-12 · M · consistency — pf-card drifts from card anatomy: 16:10 media, misused card--universal

- **Portal:** css/app.css:2473 — `.pf-card__vis { … padding-bottom:62.5%; }` (16:10) with `.pf-card__img { object-fit:cover }` (:2474), while the element is classed `card--universal` (portfolio.js:165) whose whole meaning is letterboxed object-contain imagery; compact overrides at app.css:2490-2503
- **CD:** card.postcss:166 — card__image is 56.25% (16:9); card.postcss:315-328 — card--universal = object-contain images inside the body; shadow-lg comes equally from card--default
- **Fix:** The density rationale (app.css:2486-2489 «Galerie-Karte: kompaktere, stimmige Typo & Abstände. Nur die Galerie …») holds for an inventory grid, but two points are not covered by it: (a) 16:10 adds a third card-media ratio next to 16:9 cards and the 4:3 home hero — set `.pf-card__vis` to 56.25% or document the ratio choice; (b) replace `card--universal` with `card--default` since the images are cropped, not letterboxed — the class currently only smuggles in the shadow and contradicts its CD meaning.
- **Status:** ✅ fixed — pf-card-Medien 16:9; card--universal → card--default (Portfolio-Agent)

### hero-3 · L · consistency — hero--main-image gap hardcoded instead of the gap--responsive ramp

- **Portal:** css/app.css:1048 `gap:1.5rem` and :1052 `@media(min-width:768px){ ... gap:2.5rem }`
- **CD:** Hero.vue:9 — hero children sit in `container--grid gap--responsive`; grids ramp = 1.25/1.75/2.25/2.5/3/4rem at base/480/640/1024/1280/1920. The portal already owns this ramp as --gap-responsive (tokens.css:198,293-316)
- **Fix:** Use `gap:var(--gap-responsive)` on `.hero--main-image` and delete both literal gap declarations — the token exists precisely so these ramps cannot drift (tokens.css:192-197 states this intent).
- **Status:** ⬜ open

### hero-4 · L · pixel — hero__content spacing missing the 3xl step

- **Portal:** css/app.css:1039-1040 — gap:1.5rem, ≥1024px gap:2rem; no ≥1920px rule
- **CD:** hero.postcss:14-16 — `.hero__content { @apply space-y-6 lg:space-y-8 3xl:space-y-10; }` = 1.5/2/2.5rem
- **Fix:** Add `@media (min-width:1920px){ .hero__content { gap:2.5rem; } }`.
- **Status:** ⬜ open

### hero-5 · L · pixel — hero__description rendered muted; CD uses default ink

- **Portal:** css/app.css:1044 — `.hero__description { ... color:var(--color-text-muted); ... }` (text-600 #4b5563)
- **CD:** hero.postcss:30-34 — `.hero__description { @apply text--lg leading-snug; }` — no color, inherits body text-text-800 (#1f2937)
- **Fix:** Remove the color override to match CD. If the lighter lead is a portal-wide convention (page-header .lead app.css:1012 and home-hero .lead app.css:2979 use the same muted text-lg), keep it but add the documenting comment — today the deviation is silent.
- **Status:** ⬜ open

### hero-6 · L · consistency — Narrow hero content is left-aligned; CD centers the column

- **Portal:** css/app.css:1041 — `.hero:not(.hero--main-image) .hero__content { max-width:42rem; }  /* CD hero--title-only = 6/12 Spalten */`
- **CD:** hero.postcss:65-71 — hero--title-only content is `container__center--xs`; hero--default is `container__center--sm` — both use col-start offsets to CENTER the column (container.postcss:65-87)
- **Fix:** The quoted rationale covers the width (6/12 at xl ≈ 38-42rem — holds) but silently drops CD's horizontal centering. Add `margin-inline:auto` to the capped `.hero__content`, or note the left-alignment as a deliberate intranet deviation in the comment.
- **Status:** ⬜ open

### hero-7 · L · pixel — Generic hero image rules force a 16:9 crop; CD leaves hero images uncropped

- **Portal:** css/app.css:1063-1066 — `.hero__image .photo { width:100%; aspect-ratio:16/9; }` and `.hero__image > img { ... aspect-ratio:16/9; object-fit:cover; ... }`
- **CD:** hero.postcss:41-49 — `.hero__image { block relative overflow-hidden w-full } img { @apply w-full; }` — no ratio, no cover; hero--default merely centers the image (m-auto, hero.postcss:56-62)
- **Fix:** Drop aspect-ratio/object-fit from the generic `.hero__image` rules and let callers opt into crops via the existing `.photo--16x9` utility (app.css:1254), so free-format hero images render as CD intends.
- **Status:** ⬜ open

### hero-8 · L · pixel — hero__cta spacing static (and rule currently has no consumer)

- **Portal:** css/app.css:1045 — `.hero__cta { display:flex; flex-wrap:wrap; gap:1rem; }`; no `hero__cta` occurrence in js/**or index.html
- **CD:** hero.postcss:36-39 — `.hero__cta .btn { mr-4 md:mr-5 xl:mr-6; mb-4 md:mb-5 xl:mb-6 }` = 1/1.25/1.5rem ramp
- **Fix:** Ramp the gap (1rem, md 1.25rem, xl 1.5rem). Since no renderer emits `.hero__cta` today, alternatively delete the rule until the home-hero search form adopts it (see hero-9).
- **Status:** 🔶 partial — Teilweise; offener Rest: css cluster: ramp .hero__cta gap at css/app.css:1078 (1rem, md 1.25rem, xl 1.5rem per hero.postcss:36-39). Note: the finding's 'no consumer 

### hero-10 · L · consistency — Detail hero is a <div> inside the page container; CD hero is a full-width <section> with its own container grid

- **Portal:** js/components.js:655-656 — detailHead emits `<div class="hero hero--main-image">…` / `<div class="hero">…` inside the page's `.container.section`
- **CD:** Hero.vue:8-9 — `<section class="hero…"><div class="container container--grid gap--responsive">` — the hero band is full-width, its content aligned by its own container
- **Fix:** The portal-wide container/section merge is documented in components.js:110-115 («40 von 42 Seiten rendern <div class="container section">… keine solche Seite kann ein Wechselband … tragen») — the rationale holds as an accepted structural debt, but detailHead can already emit `<section class="hero…">` instead of `<div>` for landmark/outline parity at zero visual cost.
- **Status:** ✅ fixed — detailHead now emits <section class="hero…"> / <section class="hero hero--main-image"> instead of <div>; all hero CSS is class-selector-based (verified app.css:306-330, 962, 1068-1

### card-3 · L · mobile — hover:none guard misses two card hover effects

- **Portal:** css/app.css:2909-2916 — the touch guard resets title color, shadow, border overlay and image transform, but not the footer-button inversion (app.css:1184) nor the domain-tile icon color (app.css:2022 `.card--clickable:hover .domain-tile__icon { color:var(--color-primary-700); }`)
- **CD:** CD convention — the portal's own guard comment (app.css:2905-2908) states ALL hover accents must be neutralized on touch («der Guard deckte bisher nur Farbwechsel ab, nicht Transforms und Schatten»)
- **Fix:** Inside `@media (hover:none)` add `.card--clickable:hover .card__footer__action > .btn--outline { background:transparent; border-color:var(--color-primary-600); color:var(--color-primary-600); }` and `.card--clickable:hover .domain-tile__icon { color:var(--color-primary-600); }` (both become no-ops if card-1 is fixed and the icon rule removed).
- **Status:** ⬜ open

### card-4 · L · pixel — card__image placeholder frame (secondary-50 @70% + 2px white inset) missing

- **Portal:** css/app.css:1146-1147 — `.card__image { … background:var(--color-secondary-50); overflow:hidden; }` — solid tint, no inset frame
- **CD:** card.postcss:173-179 — `.card__image:before { absolute inset-0 bg-secondary-50 border-2 border-white opacity-70 }`
- **Fix:** Add `.card__image::before { content:""; position:absolute; inset:0; z-index:0; background:var(--color-secondary-50); border:2px solid var(--color-bg); opacity:.7; }` — the loaded image paints over it, so only the empty/loading state changes, matching CD.
- **Status:** ⬜ open

### card-5 · L · pixel — 2:1 card image ratio inside grid--responsive-cols-2 not ported

- **Portal:** css/app.css:396-403 defines .grid--responsive-cols-2, but no rule adjusts .card__image inside it (only the global 56.25% at app.css:1146)
- **CD:** card.postcss:169-171 — `.grid--responsive-cols-2 & { @apply relative pb-[50%]; /* 2/1 ratio */ }`
- **Fix:** Add `.grid--responsive-cols-2 .card__image { padding-bottom:50%; }`. No page composes cards in a 2-col responsive grid today (verified), but the class is public API of the sheet and the ratio switch is part of CD's card contract.
- **Status:** ⬜ open

### card-6 · L · pixel — Color transitions drop CD's ease-in-out curve

- **Portal:** css/app.css:1158 `.card__title { … transition:color var(--duration); }`, :1187 `.card--clickable::after { … transition:border-color var(--duration-slow); }`, :1826-1827 `.download-item__title { … transition:color var(--duration); }` — all fall back to the default `ease` curve
- **CD:** card.postcss:17,24,219 and download-item.postcss:32 — `transition-… duration-…` utilities carry Tailwind's default cubic-bezier(.4,0,.2,1); card--clickable explicitly adds `ease-in-out`
- **Fix:** Append `var(--ease-in-out)` (tokens.css:180) to these three transition declarations, as `.card--clickable` (app.css:1186) already does.
- **Status:** ⬜ open

### card-7 · L · pixel — .card carries overflow:hidden that CD does not have

- **Portal:** css/app.css:1135-1136 — `.card { … overflow:hidden; … }`; it forces the inset focus rings at app.css:155 and :1193 (outline-offset:-2px)
- **CD:** card.postcss:5-8 — `.card { flex flex-col h-full bg-white; container-type:inline-size }` — no overflow; only `.card__image` clips (card.postcss:165-167)
- **Fix:** Remove `overflow:hidden` from `.card` — the image box already clips its media, and nothing else overflows (line-clamp handles text). The focus rings can then use the sheet's standard +2px offset instead of the compensating −2px inset.
- **Status:** ⬜ open

### card-8 · L · naming — .card__title--sm is dead CSS with a non-CD modifier name

- **Portal:** css/app.css:1159 — `.card__title--sm { font-size:var(--text-base); }` — zero usages repo-wide (verified via grep)
- **CD:** card.postcss:215-220 — CD knows exactly one card__title size per breakpoint; no --sm modifier exists
- **Fix:** Delete the rule (the anchor-nav's smaller title need is already served by `.anchor-nav .card__title` at app.css:261).
- **Status:** ⬜ open

### card-10 · L · pixel — card--list details deviate from CD: body bottom padding and image inset borders

- **Portal:** css/app.css:1209-1210 — `.card--list .card__body, .card--list .card__footer { padding:0; }`; app.css:1232-1233 — list image has no vertical inset
- **CD:** card.postcss:381-383 — `.card--list .card__body { @apply pt-0 pb-4; }` (1rem bottom); card.postcss:364 — image carries `border-t-[0.5em] border-b-[0.5em] border-transparent`
- **Fix:** When adopting card--list (card-9): give its body `padding-bottom:1rem` and add `border-block:.5em solid transparent` to `.card--list .card__image`. The two deliberately unported CD clauses (btn h-0, sm-vs-md grid start) are correctly documented at app.css:1220-1228 and that rationale still holds.
- **Status:** ⬜ open

### dl-1 · L · pixel — download-item on bg--secondary-50 bands keeps the white-surface border color

- **Portal:** css/app.css:1820 — only `.box .download-item { border-bottom-color:var(--color-secondary-300); }`; a `.download-items` list inside a `pageSection({alt:true})` band (bg--secondary-50, components.js:122) would keep secondary-200 — near-invisible on the tinted surface
- **CD:** download-item.postcss:12-14 — `.bg--secondary-50 & { @apply border-secondary-300; }`
- **Fix:** Extend the selector: `.bg--secondary-50 .download-item, .box .download-item { border-bottom-color:var(--color-secondary-300); }` (same context pattern the sheet already uses for `.box .separator` at app.css:1840).
- **Status:** 🔶 partial — Teilweise; offener Rest: css/app.css only: extend `.box .download-item` (border-bottom secondary-300) to `.bg--secondary-50 .download-item` — selector currently abse

### dl-2 · L · pixel — CD's accordion last-download-item rule not ported

- **Portal:** css/app.css:1815-1830 — no `.accordion .download-item` rule; portal has both components (accordion app.css:1708-1729) and currently renders download lists only as accordion siblings (js/pages/knowledge.js:90-93), so the gap is inert today
- **CD:** download-item.postcss:16-19 — `.accordion &:last-of-type { @apply mb-4 border-b-0; }`
- **Fix:** Add `.accordion .download-item:last-of-type { margin-bottom:1rem; border-bottom:0; }` for parity, so the first page that puts a download list into a drawer doesn't end on a stray divider.
- **Status:** 🔶 partial — JS-Anteil umgesetzt; CSS-Rest: css/app.css: add `.accordion .download-item:last-of-type { margin-bottom:1rem; border-bottom:0; }` (CD download-item.postcss:16-19). No page

### dl-3 · L · pixel — meta-info base color one step darker than CD (documented, holds)

- **Portal:** css/app.css:1833 — `.meta-info { … color:var(--color-text-muted); … }` = text-600 everywhere
- **CD:** meta-info.postcss:5-14 — base `text-gray-500`, switching to text-600 only inside `.box`/`.bg--secondary-50`
- **Fix:** Deliberate deviation backed by tokens.css:80 («passes AA on white AND on secondary-50» — gray-500 on secondary-50 is only ~4.4:1, which is why CD itself switches). Assessment: holds; keep the single value, but move the justification (or a pointer to it) next to the .meta-info rule so the diff against meta-info.postcss is explained at the point of deviation.
- **Status:** ⬜ open

### mos-1 · L · consistency — Portfolio media tiles are rounded while all CD-derived media is square

- **Portal:** css/app.css:2741-2742 (.pf-mosaic__cell border-radius:var(--radius-lg)), :2650-2653 (.pf-hero__map/.pf-hero__maplink), :2456 (.pf-map), :2482 (.pj-hero__btn) — vs square .card__image (1146), .hero__image (1055), .detail-image (1152)
- **CD:** card.postcss/hero.postcss — no border-radius on any card or hero media; CD radii are reserved for small controls (tailwind.config.js:236-249 scale exists but is unused on media)
- **Fix:** Drop the radius on mosaic cells, map and project-hero button, or make the rounding an explicit documented portal decision applied to ALL full-bleed media — currently the object detail head (rounded mosaic) sits pages away from square card images of the same buildings.
- **Status:** ⬜ open

### mos-2 · L · consistency — On-image chips mix static and responsive type scales

- **Portal:** css/app.css:2485 — `.pf-card__land { … font-size:var(--fs-xs) … }` (static); app.css:2766-2768 — `.photo > .pf-hero__badge { … font-size:var(--text-sm) … }` (responsive ramp); app.css:2761 — `.pf-mosaic__more-num { font-size:var(--fs-2xl); }` (static)
- **CD:** CD convention — tokens.css:150-151 instructs «Consume these [--text-*] … for anything that should scale»; overlays that scale with the image, not the viewport, are the static case
- **Fix:** Pick one rule for image overlays: static --fs-* (recommended — a chip on a fixed-ratio photo should not grow to 1.375rem at 1920px). Change `.pf-hero__badge` to `var(--fs-sm)`.
- **Status:** ⬜ open

### tile-1 · L · consistency — quick-tile hover shadow animates at 200ms while cards use CD's 300ms

- **Portal:** css/app.css:3018-3021 — `.quick-tile { … transition:box-shadow var(--duration), border-color var(--duration); }` (200ms) with the same shadow-lg→shadow-2xl lift
- **CD:** card.postcss:17 — `transition-shadow duration-300 ease-in-out` is CD's card-lift timing; portal cards follow it at app.css:1186 (var(--duration-slow))
- **Fix:** Use `var(--duration-slow)` for the quick-tile box-shadow transition so the two shadow-lift components on the home page move in step.
- **Status:** ⬜ open

### card-13 · L · consistency — Container-query body-padding reduction is a documented CD extension (holds)

- **Portal:** css/app.css:1171-1174 — `@container (max-width:499px){ .card__body { padding:1.5rem; } .card__footer { padding:0 1.5rem 1.5rem; } }`
- **CD:** card.postcss:210-234 — CD keeps px-6 py-10 at every card width; 500px appears only as the line-clamp threshold (card.postcss:230)
- **Fix:** Deviation is documented (app.css:1168-1170: «In einem 3-spaltigen Raster ist eine Karte ~400px breit; py-10 (2×40px) sind dort 14% der Kartenhöhe. Das CD nutzt 500px selbst als Schwelle …») and the assessment holds — CD's fixed 2.5rem visibly bloats narrow intranet grid cards, and the threshold reuses CD's own container breakpoint. Keep; no change needed beyond retaining the comment.
- **Status:** ⬜ open

## Tables, pagination, catalogue bar, filters

### tbl-1 · M · ux — Row hover applied to every table, CD tables have no hover state

- **Portal:** css/app.css:1398-1399 — `table.table tbody tr:hover, table.table--zebra tbody tr:hover { background:var(--color-secondary-100); }` applies to ALL tables (every C.table call), not only `.table--rows-clickable`.
- **CD:** css/components/table.postcss:1-137 — no :hover rule exists anywhere in the CD table component; rows are static.
- **Fix:** Scope hover to interactive rows AND extend the touch guard to match specificity: replace app.css:1398-1399 with `table.table--rows-clickable tbody tr:hover, table.table--rows-clickable.table--zebra tbody tr:hover { background:var(--color-secondary-100); }` and change the guard at app.css:1418 to `@media (hover:none){ table.table tbody tr:hover, table.table--rows-clickable.table--zebra tbody tr:hover { background:inherit; } }`. Static data tables (Bodenbedeckung, Kosten) then stop signalling clickability; the chevron-hover rule at 1415 keeps working.
- **Status:** ✅ fixed — Zeilen-Hover nur noch auf table--rows-clickable (inkl. hover:none-Guard)

### tbl-4 · M · pixel — Total row (.table__total) diverges from CD tfoot: wrong border color, missing bottom border, added tint, all-bold cells

- **Portal:** css/app.css:2896-2897 — `.table__total th, .table__total td { border-top:2px solid var(--color-secondary-300); font-weight:var(--fw-bold); background:var(--color-secondary-50); }` (#828e9a border, bg tint, td bold). Markup: js/apps/portfolio.js:569 and js/apps/tenancies.js:729 render `<tr class="table__total">` inside <tfoot>. No generic tfoot rule exists.
- **CD:** css/components/table.postcss:65-67 — `tfoot { @apply border-y-2 border-text-300; }` (2px top AND bottom, #d1d5db); :45-62 — tfoot td stays text-gray-600 regular, only tfoot th is bold text-gray-800; no background (zebra tints tfoot only in .table--zebra, :102-109).
- **Fix:** Style the element as CD does and drop the invented class: `table.table tfoot { border-top:2px solid var(--color-border-strong); border-bottom:2px solid var(--color-border-strong); }` with `table.table tfoot th { font-weight:var(--fw-bold); color:var(--color-gray-800); }`; remove the secondary-50 background and the bold on td (keep tabular-nums/text-right utilities). Then `<tfoot>` needs no class in portfolio.js/tenancies.js.
- **Status:** ✅ fixed — tfoot generisch im CD-Rezept (2px oben+unten, th bold, kein Flächenton); Markup-Klassen bereinigt

### catbar-1 · M · consistency — Result-count <strong> is bold in the catbar but regular in the portal's own search-results header (CD: regular)

- **Portal:** css/app.css:2315 — `.catbar__count strong { font-weight:var(--fw-bold); color:var(--color-text); }` vs the sibling implementation app.css:1934 — `.search-results__header strong { margin-right:1ex; font-weight:var(--fw-regular); }`. Both render the same «N von M Einheit» line (js/components.js:1169 and 1446).
- **CD:** css/components/search.postcss:215-217 — `.search-results__header strong { @apply block sm:inline mr-[1ex] font-regular; }` — CD deliberately keeps the count regular-weight.
- **Fix:** Set `.catbar__count strong { font-weight:var(--fw-regular); }` (keep the darker `color:var(--color-text)` if the count must stand out from the muted suffix) so both result counters and CD agree; today the same number reads bold on catalogue pages and regular on the search page.
- **Status:** ✅ fixed — Trefferzahl regular wie CD und die Suchseite

### catbar-5 · M · pixel — Gallery grid top spacing fixed at 1rem/1.5rem instead of CD's responsive gap--top ramp

- **Portal:** js/components.js:1199 — gallery branch renders `<div class="${gridCls} ${header ? 'mt-4' : 'mt-6'}">` (1rem under the results header, 1.5rem under the catbar; comment at :1197-1198 even names the CD source: «CD: `gap--top` über dem Raster»). mt-4/mt-6 are fixed (app.css:3046).
- **CD:** css/components/search.postcss:196-201 — `.search-results--grid .search-results-list { @apply grid …; @apply gap--responsive; @apply gap--top; }` — top padding ramps 1.25rem→2.5rem (lg)→3rem (xl)→4rem (3xl). The portal already implements it: css/app.css:247 `.gap--top { padding-top:var(--gap-responsive); }`.
- **Fix:** Replace the mt-4/mt-6 utility with the existing `gap--top` class on the grid container (`<div class="${gridCls} gap--top">`). At 1024px the gap grows from 1rem to 2.5rem — this is the single most visible density difference between the portal's result pages and CD's.
- **Status:** ✅ fixed — Galerie-Raster trägt gap--top (responsive Rampe) statt mt-4/mt-6

### af-1 · M · a11y — Active-filter dismiss pills built on 32px .badge although the portal ships CD's 44px interactive pill (.tag-item)

- **Portal:** js/components.js:358-360 — pills are `class="badge badge--gray active-filter"` (a/button); css/app.css:2903-2904 — «Klickbare Pillen erreichen ~2rem (näher an WCAG 2.5.8) statt ~24-30px.» `button.active-filter, a.active-filter { min-height:2rem; }`. Rationale at app.css:2012-2013: «CD ships badge-filter, but that is a filter *chooser*; it has no removable pill.»
- **CD:** css/components/tag-item.postcss:7-42 — CD's interactive pill control: outer hit area `min-h-[44px] xl:min-h-[48px] 3xl:min-h-[52px]` around a rounded-full inner, with `.tag-item__icon` slot — already faithfully implemented in the portal at app.css:1302-1321 including the full height ramp and focus ring.
- **Fix:** Rebuild the pill as `<button class="tag-item tag-item--sm active-filter"><span class="tag-item__inner"><span class="tag-item__text">Label</span>${icon('Cancel','tag-item__icon')}</span></button>` AND (1) port CD's icon rule, missing from app.css: `.tag-item__icon { height:100%; width:1.5em; position:relative; left:.4em; }` (tag-item.postcss:80-85); (2) delete `button.active-filter, a.active-filter` from the min-height rule at app.css:2904, which would otherwise out-specificity the tag-item ramp; (3) retarget the legacy pill rules at app.css:2015-2018 to the inner: `.active-filter .tag-item__inner { background:var(--color-secondary-100); } .active-filter:hover .tag-item__inner { background:var(--color-secondary-200); }`. Minimum fix otherwise: raise the pill min-height to var(--target-min) at 2904.
- **Status:** ✅ fixed — Entfernen-Pillen sind .tag-item mit voller 44er-Rampe; tag-item__icon-Regel portiert; Altregeln retargetiert

### tbl-2 · L · pixel — Divider under the header row is one shade lighter than CD

- **Portal:** css/app.css:1349-1351 — `table.table thead th { … border-bottom:1px solid var(--color-border); }` (#e5e7eb / text-200), while body rows use `var(--color-border-strong)` (#d1d5db) at app.css:1352.
- **CD:** css/components/table.postcss:45-50 — `tbody, tfoot { tr { @apply border-t border-text-300; } }` — the line between thead and the first body row is text-300 #d1d5db, same as all row dividers.
- **Fix:** Change the thead border-bottom to `var(--color-border-strong)` so the header divider matches the row dividers exactly as in CD.
- **Status:** ⬜ open

### tbl-3 · L · consistency — Header cells forced to white-space:nowrap on desktop (CD lets them wrap)

- **Portal:** css/app.css:1349-1351 — `table.table thead th { … white-space:nowrap; … }`; only the <768 media query at app.css:1424 resets it to normal.
- **CD:** css/components/table.postcss:37-42 — `thead th { @apply px-6 py-4 text-left text-text-700 uppercase text--sm align-top; }` — `align-top` exists precisely because wrapped multi-line headers are expected; no nowrap.
- **Fix:** Drop `white-space:nowrap` from the base thead rule; the portal already has the `.text-nowrap` utility (app.css:1332, documented «nur Identifikatorspalten») for the columns that genuinely must not wrap. Nowrap on every header widens tables and triggers the overflow scroller more often than CD would.
- **Status:** ⬜ open

### tbl-5 · L · consistency — Row headers (tbody th) rendered regular/gray-600 instead of CD bold/gray-800 — documented deviation, rationale holds

- **Portal:** css/app.css:1361 — `table.table tbody th { text-align:left; font-weight:var(--fw-regular); color:var(--color-gray-600); }`. Documented rationale app.css:1354-1360: «EINE Schriftstärke in der ganzen Zeile … der Fettdruck hat in Listenansichten ganze Beschreibungstexte erfasst und liess jede Tabelle wie eine Rangliste aussehen.»
- **CD:** css/components/table.postcss:59-61 — `th { @apply text-gray-800 font-bold text-left; }` inside tbody/tfoot.
- **Fix:** Keep the deviation — the documented rationale (app.css:1354-1360) holds for the link-first list tables. No tfoot th repair is needed: it is unaffected by the tbody reset and already renders bold/gray-800. If tbl-4 is applied, declare `table.table tfoot th { font-weight:var(--fw-bold); }` explicitly there rather than relying on the UA default, but that is belt-and-braces, not a regression fix.
- **Status:** ⬜ open

### tbl-6 · L · pixel — Table caption: color one step darker than CD legend and pre-line behavior dropped

- **Portal:** css/app.css:1346-1348 — `table.table--caption caption { … white-space:normal; … padding-top:.5rem; font-size:var(--text-xs); color:var(--color-text-muted); }` — text-muted = text-600 #4b5563 (tokens.css:80).
- **CD:** css/foundations/typography.postcss:131-133 — `.legend { @apply text--xs pt-2 text-text-500; }` (#6b7280); css/components/table.postcss:13-15 — `.table-wrapper caption { white-space: pre-line; }`.
- **Fix:** The darker color is a portal-wide token decision (tokens.css:80 «passes AA on white AND on secondary-50») and can stay. Restore `white-space:pre-line` in the visible-caption rule so multi-line captions keep their authored line breaks as in CD.
- **Status:** ⬜ open

### tbl-7 · L · consistency — .table--compact rules lose the cascade against table.table — compact styling can never apply

- **Portal:** css/app.css:1427-1428 — `.table--compact { border:0; box-shadow:none; }` is (0,1,0) vs `table.table` (0,1,1) at app.css:1344; `.table--compact thead th …` is (0,1,2) vs `table.table thead th` (0,1,3) at app.css:1349. With the actual markup `<table class="table table--compact">` (js/charts.js:153) the higher-specificity base rules win, so border, shadow and the 1rem/1.5rem padding all remain. Currently invisible only because the sole consumer is the sr-only chart fallback table.
- **CD:** css/components/table.postcss:69-87 — `.table--compact` must remove border/shadow and reduce all cells to px-2 py-2 text--sm.
- **Fix:** Raise the selectors to `table.table--compact { … }` and `table.table--compact thead th, table.table--compact td, table.table--compact tbody th { padding:.5rem; font-size:var(--text-sm); }` so any future visible compact table actually renders compact.
- **Status:** 🔶 partial — JS-Anteil umgesetzt; CSS-Rest: Entirely a css/app.css change (file forbidden to this cluster) and verified still unfixed: raise app.css:1475-1476 to table.table--compact {

### tbl-8 · L · consistency — rowsClickable applied inconsistently across identical list tables

- **Portal:** js/pages/home.js:73 and js/apps/tenancies.js:706 pass `rowsClickable: true`, while the structurally identical entity-list tables (link in first column) do not: js/pages/catalog.js:92-94, js/apps/portfolio.js:176, js/apps/projects.js:166, js/pages/services.js:61-63, js/pages/applications.js:104-106, js/apps/media-library.js:132-134, js/apps/tenancies.js:158-159.
- **CD:** CD convention — CD has no clickable-row pattern; the portal invented one (documented app.css:1400-1417), so the portal's own rule is the standard, and it should apply uniformly to one anatomy.
- **Fix:** Decide once: either pass `rowsClickable: true` in every catalogue/inventory list view whose first cell is the row's link (they all satisfy the wireTableRows contract), or reserve it for task tables only — but apply the choice uniformly so the cursor+chevron affordance stops appearing and disappearing between near-identical tables.
- **Status:** ✅ fixed — Uniform choice is forced by untouchable js/pages/home.js (passes true): every list whose first cell is the row link gets rowsClickable. Applied to media-library.js listView (rowsCl

### pag-1 · L · a11y — Disabled prev/next rendered as <span aria-disabled> instead of CD's <button disabled>

- **Portal:** js/components.js:1125 — `if (disabled) return `<li><span class="btn btn--outline btn--icon-only" aria-disabled="true" aria-label="${text}">${inner}</span></li>`;` — even in the button-mode branch (no href) the disabled end is a span. The span rationale at app.css:1122-1124 («ein span nimmt kein [disabled]») was written for dead LINKS, not for buttons.
- **CD:** app/components/ch/components/PaginationItem.vue:2-7 — `<button type="button" … :disabled="disabled">`; Pagination.vue:20 passes `:disabled` for the first item on page 1.
- **Fix:** When `href` is absent, emit `<button type="button" class="btn btn--outline btn--icon-only" disabled aria-label="…">` for the disabled ends (the existing `.btn--outline[disabled]` styling at app.css:1088 already covers it); keep the span form only for the href/hash-navigation mode where an <a> cannot be disabled.
- **Status:** ✅ fixed — bereits durch die erste Welle abgedeckt (verifiziert)

### pag-2 · L · pixel — Pagination input pinned to 44px via --target-min while CD ramps it 44/48/52 like a button

- **Portal:** css/app.css:1774 — `.pagination__input { width:3rem; min-height:var(--target-min); text-align:center; padding:.5rem; }` — --target-min is deliberately non-scaling (tokens.css:100-105), so the intrinsic min stays 44px at every width; only flex-stretch from `.pagination { align-items:stretch }` rescues the alignment next to the 48px buttons at ≥1280px.
- **CD:** css/components/pagination.postcss:8-11 — `input { @apply w-12 h-full text-center px-2; @apply btn--base; }` with btn.postcss:112-117 `min-h-[44px] xl:min-h-[48px] 3xl:min-h-[52px]`.
- **Fix:** Use the scaling control token: `min-height:var(--control-h);` — that token exists precisely for this ramp (tokens.css:93-98, stepped at :305/:314) and makes the input's own height match the adjacent `.btn` ramp without relying on flex stretch.
- **Status:** ⬜ open

### pag-3 · L · consistency — Two right-alignment mechanisms: dead .pagination--right duplicates live .pagination-wrap--right

- **Portal:** css/app.css:1780-1782 — `.pagination--right { display:flex; justify-content:flex-end; padding-block:1.5rem; }` (+ media steps) has no consumer: pagination() emits `pagination-wrap--right` (js/components.js:1133), styled separately at app.css:2943 `.pagination-wrap--right { justify-content:flex-end; }`. Grep over js/html finds no `pagination--right` usage.
- **CD:** css/components/pagination.postcss:30-32 — CD has exactly one variant, `.pagination--right`.
- **Fix:** Delete the unused `.pagination--right` block (its padding ramp is already carried by `.pagination-wrap`, app.css:1770-1772) and keep the single live `.pagination-wrap--right` modifier — or rename it to `.pagination-wrap--right` in one place with a comment pointing at pagination.postcss:30.
- **Status:** 🔶 partial — Teilweise; offener Rest: css/app.css only: dead `.pagination--right` block still at :1837-1839 — delete (live modifier is .pagination-wrap--right).

### pag-4 · L · a11y — Pagination input double-named: sr-only <label> plus aria-label

- **Portal:** js/components.js:1135-1137 — `<label class="sr-only" for="${inputId}">Seite</label>` AND `aria-label="Seite"` on the same input; aria-label silently overrides the label element.
- **CD:** app/components/ch/components/Pagination.vue:3-9 — CD uses a single name (`aria-label="pagination input"`), no second label.
- **Fix:** Keep exactly one accessible name — drop the `aria-label` attribute and keep the sr-only label (it survives translation tooling better), matching the one-name convention.
- **Status:** ✅ fixed — Pagination input keeps the sr-only <label> as the single name source; aria-label="Seite" removed (CD Pagination.vue single-source convention); WHY-comment added.

### catbar-2 · L · naming — Off-scale spacing literals in the catbar (.6rem/.35rem/.1rem) outside the token scale

- **Portal:** css/app.css:2308-2309 — `.catbar { … gap:.6rem 1rem; … padding-bottom:.6rem; … }`; :2325 — `.catbar__controls { … gap:.6rem .25rem; … }`; :2356 — `.catbar__fcount { margin-left:.35rem; … }`; :2359 — `.catbar__chev { … margin-left:.1rem; … }`.
- **CD:** CD convention — all CD spacing resolves to the Tailwind quarter-rem scale (tailwind.config.js uses default spacing; portal mirrors it as --sp-* in tokens.css:156-161). .6/.35/.1rem exist on no step.
- **Fix:** Snap the live literals: `.catbar` gap `.5rem 1rem` and padding-bottom `.5rem` (or `.75rem`); `.catbar__fcount` margin-left `.25rem`; `.catbar__chev` margin-left `.25rem` or drop it (source value is .1rem). In `.catbar__controls`, simply delete the dead `.6rem` half of the gap shorthand (write `gap:.5rem .25rem` and drop the separate row-gap) — its effective values are already on-scale.
- **Status:** ⬜ open

### catbar-3 · L · consistency — Catbar controls frozen at 44px while CD equivalents ramp 44/48/52 — documented, defensible

- **Portal:** css/app.css:2312, 2353, 2355, 2361 — search input, sort select, filter button and view-switch all pinned to `min-height:var(--target-min)` (fixed 2.75rem). Documented at app.css:2316-2318: «Alle Controls gleich hoch (--target-min)».
- **CD:** css/components/btn.postcss:112-117 and input.postcss — every CD control carries the `min-h-[44px] xl:min-h-[48px] 3xl:min-h-[52px]` ramp; the CD results header's select/buttons scale with it.
- **Fix:** Keep the uniform 44px toolbar — the documented rationale holds and the bar is internally consistent. If alignment next to 48px page controls at ≥1280px ever needs fixing, switch the four rules to var(--control-h) (which mirrors the CD BUTTON ramp; CD's own inputs would only reach 48px at 1544px per input.postcss:1-16). Amend the comment at app.css:2316-2318 to note 44px is a conscious divergence, not the CD value.
- **Status:** ⬜ open

### catbar-4 · L · pixel — Filter drawer (.catbar__panel) gaps and breakpoint deviate beyond the documented tinted-card decision

- **Portal:** css/app.css:2366-2375 — `.catbar__panel { … gap:.75rem 2rem; … background:var(--color-secondary-50); border-radius:var(--radius-lg); }` with `@media (min-width:768px){ … gap:1rem 2rem; }`. The documented deviation covers only the surface: app.css:2362-2365 «Die getönte, gerundete Karte ist eine bewusste Entscheidung und BLEIBT — umgestellt wird nur die umbrechende Flex-Zeile …».
- **CD:** css/components/search.postcss:257-264 — `.search__filters__drawer { @apply grid md:grid-cols-2 lg:grid-cols-3; @apply gap-3 lg:gap-4; … border-t border-secondary-200; }` — uniform .75rem gap, stepping to 1rem at lg (1024), no 2rem column gutter.
- **Fix:** Keep the tinted card (rationale is explicit and still holds), but align the grid metrics with CD: `gap:.75rem` stepping to `1rem` at 1024px, dropping the 2rem column gutter — the column count (1/md:2/lg:3) already matches, so only the gap values drift.
- **Status:** ⬜ open

### af-2 · L · naming — Pill dismiss icon uses generic icon--sm + opacity instead of CD's badge/tag icon anatomy

- **Portal:** js/components.js:359-360 — `${escape(f.label)}${icon('Cancel', 'icon--sm')}` inside the pill; css/app.css:2016 — `.active-filter .icon { margin-left:.15rem; opacity:.65; }` (off-scale margin, opacity-dimmed).
- **CD:** css/components/badge.postcss:85-90 — `.badge__icon { @apply h-full w-[1.5em]; @apply relative left-[0.4em]; @apply stroke-current; }` (em-scaled, optically pulled toward the rounded edge, full-strength); tag-item.postcss:80-85 identical convention.
- **Fix:** Port CD's icon anatomy into app.css first — `.badge__icon { height:100%; width:1.5em; position:relative; left:.4em; }` (badge.postcss:85-90; stroke-current is moot for the portal's mask-based icons) or the identical `.tag-item__icon` if af-1 lands — then swap the pill markup to `${icon('Cancel','badge__icon')}` and delete `.active-filter .icon { margin-left:.15rem; opacity:.65; }` plus the hover-to-full-opacity rule at app.css:2018; CD never dims the icon.
- **Status:** 🔶 partial — Teilweise; offener Rest: css/app.css: JS already emits tag-item__icon and the CD icon rule exists (:1367); remaining: delete the opacity dimming `.active-filter .tag

### af-3 · L · pixel — Active-filter row top spacing fixed (mt-4) instead of CD's responsive ramp

- **Portal:** js/components.js:364 — `<div class="active-filters mt-4" role="group" …>` — fixed 1rem above the pill row at every viewport (app.css:3046).
- **CD:** css/components/search.postcss:266-269 — `.search__filters__tags { @apply flex flex-wrap; @apply pt-4 sm:pt-6 2xl:pt-8; }` — 1rem→1.5rem (640)→2rem (1544).
- **Fix:** Move the spacing into the component rule with the CD steps: `.active-filters { margin-top:1rem; } @media (min-width:640px){ margin-top:1.5rem; } @media (min-width:1544px){ margin-top:2rem; }` and drop the inline `mt-4` utility.
- **Status:** ✅ fixed — JS half: fixed mt-4 utility removed from the .active-filters row (it would pin the ramp at 1rem from 640px since the utility sits later in the sheet). Depends on css cluster adding

### filt-1 · L · consistency — Two filter-panel surfaces drifted apart: sidebar .filter-panel vs drawer .catbar__panel

- **Portal:** css/app.css:2045-2046 — `.filter-panel { background:var(--color-bg); border:1px solid var(--color-secondary-100); border-radius:var(--radius-lg); padding:1.25rem; }` (white, secondary-100 border) vs app.css:2372-2373 — `.catbar__panel { … padding:1rem 1.25rem; background:var(--color-secondary-50); border:1px solid var(--color-border); border-radius:var(--radius-lg); }` (tinted, gray border). Additionally `.filter-panel__title { font-size:var(--fs-lg); … }` (app.css:2048) consumes the static step instead of the responsive `--text-lg` that tokens.css:150-151 prescribes («Consume these, not the raw --fs-* steps»).
- **CD:** CD convention — search.postcss:249-264 defines ONE facet-filter surface (border-t border-secondary-200, no card); when a product invents a card variant it should at least be one variant, not two.
- **Fix:** Pick one card recipe for both hosts of the shared `.filter-group` content: same background token, same border token (secondary-100 or --color-border, not both) and same padding pair; and change `.filter-panel__title` to `font-size:var(--text-lg)` so it scales with the rest of the type ramp.
- **Status:** ⬜ open

### sort-1 · L · ux — Sort select right-alignment deviates from CD below 768px — documented, rationale holds

- **Portal:** css/app.css:2337-2338 — `.catbar__sort select { text-align:right; }` with `@media (max-width:767.98px){ .catbar__sort select { text-align:left; } }`; documented at app.css:2332-2342 including the option-padding deviation: «BEWUSSTE ABWEICHUNG vom CD: rechtsbündige Optionen klebten in der aufgeklappten Liste direkt an der Kante des Popups …».
- **CD:** css/components/search.postcss:229-234 — `.search-results__header__right select { @apply text-right; }` unconditionally.
- **Fix:** Keep. The mobile exception applies only where the portal stretches the select to full width (a layout CD never has), and the option padding fix addresses a real Chromium popup issue. No change; the comments already carry the rationale.
- **Status:** ⬜ open

### tbl-9 · L · mobile — Mobile cell-density override (<768px) has no CD counterpart — documented, holds, but verify tfoot

- **Portal:** css/app.css:1420-1426 — `@media (max-width:767.98px){ .table-wrapper table.table thead th, … td, … tbody th { padding:.5rem .75rem; font-size:var(--text-sm); } … }` (Item 2.11). Note the selector list omits `tfoot th`/`tfoot td`: the Total row keeps 1rem/1.5rem padding (app.css:1365 `table.table tfoot th { padding:1rem 1.5rem; }`) while all other rows shrink.
- **CD:** css/components/table.postcss:37-63 — CD keeps px-6 py-4 at all widths (density is opt-in via .table--compact only); CD convention for the portal's own override is at least uniform application per table.
- **Fix:** Add only the th selector to the mobile override at app.css:1420-1426: `.table-wrapper table.table tfoot th { padding:.5rem .75rem; font-size:var(--text-sm); }` — tfoot td is already covered by the existing `.table-wrapper table.table td` line. The denser mobile ramp itself stays.
- **Status:** ⬜ open

## Federal header — top bar, logo, language switcher, meta nav, search

### lang-1 · M · a11y — Disabled language switcher is clobbered by the generic disabled-field rules — washed-out light box on the navy top bar

- **Portal:** css/app.css:535 — `.language-switcher select { background:transparent; border:1px solid transparent; color:var(--color-text-negative); }` (specificity 0-1-1) is overridden by the LATER equal-specificity rules css/app.css:1497 — `select[disabled] { background:var(--color-gray-50); color:var(--color-gray-400); border-color:var(--color-border-strong); pointer-events:none; }` and css/app.css:1534 — `select:disabled { opacity:.4 }`. js/shell.js:172 renders the header select with `disabled: true` and a `title` tooltip, so the actual rendered state is a #f9fafb box with #9ca3af text at 40% opacity on the #2f4356 bar (contrast far below 4.5:1), and `pointer-events:none` kills the explanatory title tooltip the comment relies on.
- **CD:** css/components/select.postcss:28-35 — CD's disabled select is `opacity-40` only (no background/color/pointer-events swap); css/components/language-switcher.postcss:5-33 + css/components/select.postcss:9-26 — the bare negative header select stays transparent with white text. CD never renders the header switcher disabled.
- **Fix:** Add `.language-switcher select:disabled { color:var(--color-text-negative); pointer-events:auto; cursor:default; }` — specificity (0,2,1) beats both generic rules regardless of position; the background/border overrides in the original recommendation are unnecessary because `.select--bare select` (app.css:1544-1545) already restores transparency after the disabled rule. Keeping opacity:.4 reproduces CD's exact disabled recipe (select.postcss:28-35) while pointer-events:auto revives the explanatory tooltip. The alternative — rendering the single-language state as a static `<span>DE</span>` with the sr-only explanation — remains sound, since a control that can never be operated need not be a form control.
- **Status:** ✅ fixed — Disabled-Sprachwahl: CD-Rezept opacity-40, weisse Schrift, Tooltip lebt

### logo-1 · M · mobile — Mobile menu open: CD fades the logo out (and slides the top bar away); portal keeps both fully visible

- **Portal:** css/app.css:555 — `.logo { display:flex; align-items:center; flex-wrap:nowrap; text-decoration:none; }` has no `transition-opacity` and app.css contains no `.body--mobile-menu-is-open .logo` rule (the only fade is the search-open one at css/app.css:700-701, 300ms, ≤1023.98px). css/app.css:868 — `.body--mobile-menu-is-open { overflow:hidden; }` only.
- **CD:** css/components/logo.postcss:5-13 — `.logo { transition-opacity duration-700; } .body--mobile-menu-is-open & { opacity-0 }`; css/foundations/global.postcss:27-38 — `body { transition-transform duration-700 }` and `.body--mobile-menu-is-open { transform: translateY(-3em); height: calc(100vh + 3rem); }` (page shifts up so the navy top bar scrolls out while the drawer is open).
- **Fix:** Change the existing transition at css/app.css:700 to `var(--duration-slowest)` and move it out of the ≤1023.98px block onto the base `.logo` rule at app.css:555, then add `.body--mobile-menu-is-open .logo { opacity:0; }`. This matches CD exactly: logo.postcss:8's single duration-700 transition governs BOTH the search-open fade (search.postcss:99-103) and the menu-open fade, so unifying the portal's two cases on --duration-slowest (700ms, tokens.css:179) is the faithful port. Skip the body translateY(-3em) slide, or if adopted, recompute --shell-top (consumed at app.css:866) in shell.js setMobileMenu() — the fade alone restores the dominant visual cue.
- **Status:** ✅ fixed — .logo fadet bei offenem Mobilmenü (duration-slowest, wie CD)

### badge-1 · M · pixel — Intranet badge is pinned to 12px at all widths; CD's badge ramps to 16px on desktop

- **Portal:** css/app.css:582-587 — `.body--intranet .logo__title::after, .body--intranet .logo__accronym::after { … font-size:var(--fs-xs); line-height:1.25rem; }` — one fixed 0.75rem/1.25rem for both, no breakpoint steps.
- **CD:** css/skins/intranet.postcss:32-43 — `.logo__title::after { @apply badge badge--blue … }` inherits the badge size ramp css/components/badge.postcss:73-77 — `text-xs md:text-sm lg:text-base; leading-5 lg:leading-6` (0.75rem → 0.875rem @768 → 1rem/1.5rem @1024). Only `.logo__accronym::after` gets the extra `text-xs` pin (intranet.postcss:42).
- **Fix:** Split the two selectors: keep `--fs-xs` only on `.logo__accronym::after`; give `.logo__title::after` the badge ramp — `@media (min-width:768px){ font-size:var(--fs-sm); } @media (min-width:1024px){ font-size:var(--fs-base); line-height:1.5rem; }` — matching the CD pill size next to the office title on desktop.
- **Status:** ✅ fixed — Intranet-Pille am Titel reitet die Badge-Grössenrampe; Akronym-Pille bleibt xs

### topbar-1 · L · pixel — Top bar and brand row miss CD's large-screen font-size steps

- **Portal:** css/app.css:494 — `.top-bar { … font-size:var(--fs-sm); }` (fixed 0.875rem, no 1544px step); css/app.css:548-549 — `.top-header { … font-size:var(--fs-sm); }` (fixed, no 1920px step).
- **CD:** css/sections/top-bar.postcss:7 — `text-sm 2xl:text-base` (1rem from 1544px); css/sections/top-header.postcss:8 — `text-sm 3xl:text-base` (1rem from 1920px); breakpoints per app/tailwind.config.js:20-28.
- **Fix:** Add `@media (min-width:1544px){ .top-bar { font-size:var(--fs-base); } }` and `@media (min-width:1920px){ .top-header { font-size:var(--fs-base); } }` (use the raw --fs steps, matching CD's non-ramped utilities).
- **Status:** ⬜ open

### topbar-2 · L · consistency — .top-bar__btn has no :focus color state (its sibling nav links do)

- **Portal:** css/app.css:499 — `.top-bar__btn:hover { color:var(--color-gray-300); }` — :hover only, while css/app.css:519 gives `.top-bar-navigation a:hover, .top-bar-navigation a:focus` both states.
- **CD:** css/sections/top-bar.postcss:130 — `.top-bar__btn { hover:text-text-300 focus:text-text-300 }` (#d1d5db on both states).
- **Fix:** Change the selector to `.top-bar__btn:hover, .top-bar__btn:focus { color:var(--color-gray-300); text-decoration:none; }` so keyboard focus gets the same lightening as hover, matching both CD and the adjacent top-bar-navigation links.
- **Status:** ⬜ open

### topbar-3 · L · mobile — «Alle Schweizer Bundesbehörden» label fully hidden below 640px; CD keeps it visible as a narrow wrapped column

- **Portal:** css/app.css:169 — `.top-bar__btn > span:not(.icon)` sits in the sr-only group; css/app.css:507-508 reveals it only `@media (min-width:640px)`. Below 640 the link is icon-only (comment at js/shell.js:179-180 argues the icon is the only affordance).
- **CD:** css/sections/top-bar.postcss:136-138 — `.top-bar__btn span { @apply w-min sm:w-full }` — below sm CD narrows the span to min-content (text wraps) but never hides it.
- **Fix:** Replace the sr-only treatment below 640 with CD's approach: keep the span visible and add `.top-bar__btn > span:not(.icon) { width:min-content; } @media (min-width:640px){ width:auto; }`. The documented rationale (icon as sole affordance) was a fix for a worse bug (invisible label AND icon) — CD's wrapped-label pattern solves the same problem without dropping the text.
- **Status:** 🔶 partial — Teilweise; offener Rest: css cluster: replace the below-640 sr-only treatment of .top-bar__btn > span:not(.icon) (app.css:173-180 + reveal at 511-512) with CD's widt

### topbarnav-1 · L · pixel — Top-bar navigation labels appear from 640px; CD shows them only from 1024px

- **Portal:** css/app.css:522-525 — `@media (min-width:640px){ .top-bar-navigation a > span:not(.icon) { position:static; … } }` un-hides the «eGate» label at sm.
- **CD:** css/navigations/top-bar-navigation.postcss:7-11 — `span { @apply hidden lg:block; pl-2 lg:pl-4; pr-1 lg:pr-2 }` — labels are display:none below 1024, icon-only between 480–1023.
- **Fix:** Move the reveal to `@media (min-width:1024px)` (merge with the existing lg rule at css/app.css:526-529) and keep sr-only below — between 640–1023 the bar then shows icon-only utility links exactly like CD.
- **Status:** ⬜ open

### topbar-4 · L · pixel — .top-bar__right adds a 1rem flex gap CD does not have

- **Portal:** css/app.css:513 — `.top-bar__right { display:flex; align-items:stretch; gap:1rem; }` (the align-items:stretch deviation is documented at :509-512 and holds; the gap is not).
- **CD:** css/sections/top-bar.postcss:154-166 — `.top-bar__right { @apply flex items-center; }` — no gap; spacing comes from each item's own padding (nav `px-1 lg:px-2`, switcher `pl-1 lg:pl-4`).
- **Fix:** Drop `gap:1rem` and let the per-item padding-inline carry the rhythm; keep a small `margin-right` on `.demo-chip` if the portal-specific chip needs breathing room (CD's badge in this slot uses `mr-2`).
- **Status:** ⬜ open

### logo-2 · L · pixel — .logo__title misses the 3xl font step and CD's -0.16rem optical top offset

- **Portal:** css/app.css:571-579 — `.logo__title` steps --fs-xs @480 / --fs-sm @640 / --fs-base @1280, no 1920 step and no negative top margin.
- **CD:** css/components/logo.postcss:76-82 — `text-sm xs:text-xs sm:text-sm xl:text-base 3xl:text-lg; font-bold leading-snug; relative mt-[-0.160rem]` — 1.125rem from 1920px plus the optical alignment against the flag's top edge.
- **Fix:** Add `@media (min-width:1920px){ .logo__title { font-size:var(--fs-lg); } }` and `margin-top:-0.16rem` to the ≥480 block (the md:items-start alignment at css/app.css:556 makes the offset visible from 768px up).
- **Status:** ⬜ open

### logo-3 · L · mobile — Office title forced to nowrap from 480px; CD allows wrapping until 768px

- **Portal:** css/app.css:571-577 — the ≥480 `.logo__title` rule sets `white-space:nowrap` (the comment cites logo.postcss:80 as "stays on one line", but that line is the md-scoped utility).
- **CD:** css/components/logo.postcss:78 — `md:whitespace-nowrap` — below 768 the title may wrap; nowrap only from 768px.
- **Fix:** Move `white-space:nowrap` into a `@media (min-width:768px)` block. Between 480–767 the long «Bundesamt für Bauten und Logistik» can then wrap instead of risking overflow next to flag + separator, exactly as CD intends.
- **Status:** ⬜ open

### burger-1 · L · pixel — Burger icon resting color is text-600 instead of CD's text-500

- **Portal:** css/app.css:642-643 — `.burger__icon { … color:var(--color-text-muted); }` where --color-text-muted = --color-text-600 = #4b5563 (css/tokens.css:80).
- **CD:** css/components/burger.postcss:10-17 — `.burger__icon { text-text-500 … hover:text-primary-600 }` — resting #6b7280.
- **Fix:** Use `color:var(--color-text-500)` (alias exists in tokens.css:50) on `.burger__icon`; keep the primary-600 hover which already matches.
- **Status:** ⬜ open

### search-1 · L · pixel — Search toggle padding is a fixed portal value; CD ramps it (lg:p-1 xl:p-2 2xl:py-3) and nudges the title -0.125rem

- **Portal:** css/app.css:660-661 — `.search__button { … padding:.4rem .5rem; }` at all widths; css/app.css:663-666 — revealed `.search__button__title` gets `padding-right:.375rem` but no negative top nudge.
- **CD:** css/components/search.postcss:75-86 — `.search__button { lg:p-1 xl:p-2 2xl:py-3 }` (0 below lg; .25rem @1024; .5rem @1280; py .75rem @1544) and `.search__button__title { lg:pr-1.5 lg:-mt-0.5 }`.
- **Fix:** Adopt the CD ramp but preserve the tap target: base `padding:0; min-width:var(--target-min); justify-content:center;` then `@media (min-width:1024px){ .search__button { padding:.25rem; } } @media (min-width:1280px){ padding:.5rem; } @media (min-width:1544px){ padding-block:.75rem; }`, and add `margin-top:-.125rem` to the revealed `.search__button__title` in the existing ≥1024 block at app.css:663-666. CD's own base is p-0 with a 36px icon, so the min-width guard is the only portal-specific addition needed.
- **Status:** ⬜ open

### search-2 · L · pixel — Mobile expanded search row uses 1rem side padding; CD uses 0.875rem

- **Portal:** css/app.css:695-698 — `.search--main.open .search__form { … margin-top:.5rem; padding-inline:1rem; … }` inside the ≤1023.98px block.
- **CD:** css/components/search.postcss:37-42 — `.search--mobile { @apply mt-2 px-3.5; }` — 0.5rem top ✓ but 0.875rem inline.
- **Fix:** Change `padding-inline:1rem` to `padding-inline:.875rem` so the dropped-down field aligns with CD's mobile search inset (mt-2 already matches).
- **Status:** ⬜ open

### search-3 · L · consistency — .search__submit color declared twice 25 lines apart

- **Portal:** css/app.css:681-682 — `.search__submit { … color:var(--color-text); … }` then css/app.css:707 — `.search__submit { color:var(--color-secondary-700); }` silently overrides it.
- **CD:** CD convention — one declaration per property per component block (no CD counterpart for this portal-specific in-field submit).
- **Fix:** Delete the trailing rule at css/app.css:707 and set `color:var(--color-secondary-700)` directly in the main `.search__submit` block at :681, so the intended value is where a reader looks for it.
- **Status:** ⬜ open

### meta-1 · L · consistency — Dead `.top-header__auth` CSS block for a markup structure that no longer exists

- **Portal:** css/app.css:603-606 — `.top-header__auth { display:none; } @media (min-width:1024px){ … } .top-header__auth ul { … }` — no element in js/shell.js renders this class (auth now lives inside the meta-navigation ul, js/shell.js:158-162, 212).
- **CD:** CD convention — css/sections/top-header.postcss contains only selectors its Vue markup emits.
- **Fix:** Remove the three `.top-header__auth` rules; the meta-navigation auth styles at css/app.css:618-629 are the live implementation.
- **Status:** 🔶 partial — Teilweise; offener Rest: css cluster: delete the three dead .top-header__auth rules at css/app.css:622-624. Confirmed no consumer in js/shell.js or index.html (auth 

### meta-2 · L · ux — Auth entry uses primary-600 text inside a meta-navigation whose sibling links are text-colored

- **Portal:** css/app.css:613-614 — `.meta-navigation a { color:var(--color-text); }` with hover primary-600, but css/app.css:619-623 — `.meta-navigation__auth { … color:var(--color-primary-600); }` (hover primary-800), so «Notfall & Vorfälle \| Hilfe \| Anmelden» renders in two different link styles in one list.
- **CD:** css/navigations/meta-navigation.postcss:5-12 + app/components/ch/navigations/MetaNavigation.vue:4-20 — all meta items share one uniform plain style; CD defines no accent variant in this bar.
- **Fix:** Give `.meta-navigation__auth` the same resting `color:var(--color-text)` and hover as `.meta-navigation a`; if login emphasis is wanted, carry it via the existing User icon (already primary-tinted in the logged-in state, css/app.css:629) rather than a second link color.
- **Status:** ⬜ open

### chip-1 · L · consistency — Demo chip invents a non-CD chip anatomy (uppercase, tracking, 2px radius)

- **Portal:** css/app.css:489-491 — `.demo-chip { padding:.12rem .5rem; … letter-spacing:.08em; text-transform:uppercase; … border-radius:var(--radius-sm); }` — the German comment (:485-488) justifies only the pinned red color, not the geometry.
- **CD:** css/components/badge.postcss:5-9,73-77 — CD's only chip pattern is the badge: `py-[0.219em] px-[1em]; rounded-full`, no uppercase/tracking; the top bar hosts exactly this component in its right cluster (top-bar.postcss:154-166).
- **Fix:** Keep the pinned #d8232a/white pair (documented rationale at app.css:485-488 holds — it must survive the intranet skin) and adopt badge geometry only: `padding:.219em 1em; border-radius:var(--radius-full);` and drop `text-transform`/`letter-spacing`. Leave `font-size:var(--text-xs)` as is, or for exact CD badge parity reuse the portal's own badge ramp already implemented at app.css:1284-1285 (font-size:var(--fs-sm)@768, var(--fs-base) + line-height:1.5rem@1024).
- **Status:** ⬜ open

### spacing-1 · L · consistency — Off-scale icon gaps (.4rem/.35rem) across header controls instead of CD spacing steps

- **Portal:** css/app.css:496 — `.top-bar__btn { … gap:.4rem; }`; css/app.css:660 — `.search__button { … gap:.4rem; }`; css/app.css:619 — `.meta-navigation__auth { … gap:.4rem; }`; css/app.css:628 — `.meta-navigation__name { … gap:.35rem; }` — none of these values exist on the token scale (css/tokens.css:157-161).
- **CD:** app/tailwind.config.js spacing (Tailwind default scale: 0.375rem / 0.5rem); CD icon gaps in this area are `ml-2` = 0.5rem (top-bar.postcss:141-143) and `pr-1.5` = 0.375rem (search.postcss:83-85).
- **Fix:** Snap `.top-bar__btn` (app.css:496) and `.meta-navigation__auth` (app.css:619) gaps to .5rem (var(--sp-2), mirroring CD's ml-2 icon offset) and `.meta-navigation__name` (app.css:628) to .375rem. For `.search__button` (app.css:660) remove the gap entirely (gap:0): CD carries that spacing solely via the title's lg:pr-1.5, which the portal already implements as padding-right:.375rem at app.css:665 — keeping any gap double-spaces the desktop toggle relative to CD.
- **Status:** ⬜ open

## Main navigation, drawers, mobile menu, breadcrumb, footer

### l1-1 · M · ux — L1 nav wraps to a second row instead of CD's «Mehr» overflow flyout

- **Portal:** css/app.css:721-724 — comment «Neun L1-Einträge passen nicht in eine Reihe — die Leiste darf umbrechen (der Nutzerentscheid zu den fünf Intranet-Bereichen)» + `.main-navigation > ul { display:flex; flex-wrap:wrap; margin-left:-.7rem; min-height:3.5rem; }`; js/shell.js:141 renders all NAV items flat
- **CD:** designsystem/css/navigations/main-navigation.postcss:19-21 `ul { @apply flex h-full; }` (fixed height, no wrap) + :62-64 `.icon--MoreFilled` and navy.postcss:25-27 `.desktop-menu__more`; app/components/ch/navigations/MainNavigation.vue:164-175 + app/scripts MenuMore pattern: overflowing L1 items collapse into a «Mehr» flyout
- **Fix:** The user decision to keep nine L1 entries holds, but CD's answer to overflow is not wrapping — a two-row nav bar exists nowhere in CD, and the h-full/underline anatomy assumes one row. Port CD's MenuMore behavior: measure available width on resize, move items that no longer fit into a «Mehr» navy__has-children entry (drawer markup already exists in shell.js), keeping the bar a single 3.5/4/5rem row. Alternatively, if wrap is retained, document that trade-off explicitly next to the deviating min-height (rows already stay 3.5rem, which mitigates the visual break).
- **Status:** 📌 deliberate deviation (documented) — Zeilenumbruch statt «Mehr»-Flyout — Begründung als BEWUSSTE ABWEICHUNG am Selektor dokumentiert

### mob-1 · M · consistency — Mobile drill-down is an inline accordion, not CD's sliding level panes

- **Portal:** css/app.css:906 `.mobile-menu__drawer { position:static; width:100%; padding:0; background:var(--color-secondary-50); }` + :913-914 indent `padding-left:2.25rem` + :792-796 display-switch panes; css/app.css:901-903 chevron rotates 90° on aria-expanded
- **CD:** designsystem/css/navigations/navy.postcss:79-99 — levels are absolutely stacked full panes with `transform:translateX` and `transition: transform 600ms ease-in-out`; .show-level-N classes slide the whole menu; mobile rows keep full-width white rows (navy.postcss:30-32), no grey inset accordion
- **Fix:** Scope CD's slide to the mobile drawer using CD's own absolute-stacking recipe (navy.postcss:79-99), not the width:200% slider the portal comment rejects: give the open .mobile-menu__drawer position:relative plus a height driven by the active pane (e.g. measure and set --pane-h on drill, or grid-template-areas stacking with visibility), absolutely stack the two existing .navy__pane elements, and translate them on the existing data-level attribute; drop the 2.25rem inset and secondary-50 tint so rows match navy.postcss:16,30-32 (white rows + 3px bar). If the per-trigger accordion structure is kept instead, document that as the deliberate deviation next to app.css:906 — CD's pattern slides the entire menu, which would require restructuring shell.js's per-item drawers into one navy tree.
- **Status:** 📌 deliberate deviation (documented) — Inline-Akkordeon statt CD-Schiebepanels — Begründung am .mobile-menu__drawer dokumentiert

### bc-1 · M · pixel — Breadcrumb links use half of CD's vertical padding — bar ~16px shorter

- **Portal:** css/app.css:956 `.breadcrumb a, .breadcrumb [aria-current] { padding:.5rem 1rem; }` (no md/xl step; verified no later override)
- **CD:** designsystem/css/sections/breadcrumb.postcss:23-27 `& > nav > ul > li > a { @apply px-4 py-2; @apply md:py-4; }` — since the breadcrumb is hidden below lg (breadcrumb.postcss:9), the effective CD link padding is always 1rem vertical
- **Fix:** Change to `padding:1rem;` (the breadcrumb only renders ≥1024px, so the md:py-4 value is the only visible one). Wrapper padding-block .5rem/xl .75rem (app.css:953-954) already matches CD's py-2 xl:py-3 and stays as is.
- **Status:** ✅ fixed — Brotkrumen-Padding py-4 (einzige sichtbare CD-Stufe ≥1024)

### l1-2 · L · pixel — L1 horizontal rhythm 0.7rem instead of CD's 1rem (padding, negative margin, underline insets)

- **Portal:** css/app.css:724 `margin-left:-.7rem`; :730 `padding:1rem .7rem`; :735 `::after { left:.7rem; right:.7rem; }` — the tightening is not covered by the wrap comment at :721-723
- **CD:** designsystem/css/navigations/main-navigation.postcss:16 `-ml-4` (-1rem), :29 `lg:px-4` (1rem), :38 `absolute right-4 bottom-0 left-4` (1rem insets)
- **Fix:** Internally consistent (first label still aligns to the container edge), but item spacing and the active-underline length are visibly tighter than CD. If l1-1 is fixed with a «Mehr» overflow, restore 1rem: `margin-left:-1rem`, `padding:1rem`, `::after{left:1rem;right:1rem}`. If wrap stays, document 0.7rem as a deliberate density deviation next to the wrap comment.
- **Status:** ⬜ open

### l1-3 · L · pixel — L1 line-height 1.2 vs CD leading-tight 1.25

- **Portal:** css/app.css:730 `line-height:1.2` on `.main-navigation > ul > li > a/button`
- **CD:** designsystem/css/navigations/main-navigation.postcss:30 `@apply hover:text-primary-600 leading-tight;` — Tailwind leading-tight = 1.25
- **Fix:** Change to `line-height:var(--lh-tight)` (tokens.css:147 already defines 1.25).
- **Status:** ⬜ open

### l1-4 · L · a11y — L1 focus ring is an outset outline; CD specifies an inset ring on nav items

- **Portal:** css/app.css:149 global `:focus-visible { outline:2px solid var(--color-focus-ring); outline-offset:2px; }` — no nav-specific override exists (verified via grep)
- **CD:** designsystem/css/navigations/main-navigation.postcss:42-44 `&:focus-visible { @apply ring-inset; }` — the L1 item fills the bar height, so CD draws the ring inside the item
- **Fix:** Add `.main-navigation > ul > li > a:focus-visible, .main-navigation > ul > li > button:focus-visible { outline-offset:-2px; }` so the ring stays inside the full-height item instead of colliding with the nav border and adjacent items.
- **Status:** ⬜ open

### drawer-1 · L · pixel — navy__back styled as a primary-colored link; CD uses the grey menu__action-btn anatomy

- **Portal:** css/app.css:805-808 `.navy__back { padding:.4rem .75rem; color:var(--color-primary-600); } .navy__back:hover { color:var(--color-primary-800); }` (no hover background); :839 desktop position `left:0`
- **CD:** designsystem/css/navigations/navy.postcss:54-58 `.navy__back { @apply menu__action-btn; @apply lg:absolute lg:-top-12 lg:-left-5; }` + components/menu.postcss:109-123 menu__action-btn = `px-4 py-3`, `text-sm`, `text-text-500`, hover `bg-secondary-50 text-text-600` — resolved against the 2rem drawer padding, CD's -left-5 puts it 0.75rem from the drawer edge
- **Fix:** Align to the action-button anatomy shared with «Schliessen»: `padding:.75rem 1rem; color:var(--color-text-muted);` and `.navy__back:hover { color:var(--color-text-600 equivalent); background:var(--color-secondary-50); }`; shift the desktop position to `left:.75rem` (lg). The red/blue link colour reads as a navigation link, not a menu action, and drifts from the close button it shares the top row with.
- **Status:** ⬜ open

### drawer-2 · L · pixel — Drawer rows use 0.75rem horizontal padding at all widths (CD: 1rem below xl); menu__item--condensed repurposed

- **Portal:** js/shell.js:16,46 rows emit `menu__item menu__item--border menu__item--condensed`; css/app.css:827-828 `.navy .menu__item--condensed > .menu__item__flex, … > .navy-branch { padding:.75rem; }` and :850 `.menu__item--condensed { padding:.75rem; }`
- **CD:** designsystem/css/navigations/navy.postcss:13-15 rows are `menu__item menu__item--small` + `xl:px-3 xl:py-3`; components/menu.postcss:15-16 menu__item = `px-4 py-3` (1rem/.75rem below xl); menu.postcss:87-93 defines --condensed as a different variant (px-3 py-3 + icon lg:h-6) not used by navy
- **Fix:** Give navy rows CD's ramp: `.navy .menu__item > .menu__item__flex, .navy .menu__item > .navy-branch { padding:.75rem 1rem; }` plus `@media (min-width:1280px){ … { padding:.75rem; } }`, and drop the --condensed modifier from navyRow()/branchRow() so the CD modifier name keeps its CD meaning.
- **Status:** ✅ fixed — JS half applied: dropped menu__item--condensed from navyRow()/branchRow() in js/shell.js (rows now take the generic .navy .menu__item > * rule at app.css:847-848 = CD's .75rem 1rem

### drawer-3 · L · consistency — navy__title is a span at fs-lg in secondary-700; CD renders an h2 at base size, inherited color

- **Portal:** js/shell.js:100,105,111 `<span class="navy__title">…`; css/app.css:810-811 `.navy__title { padding:0 .75rem; font-size:var(--fs-lg); font-weight:var(--fw-bold); color:var(--color-secondary-700); }`
- **CD:** designsystem/app/components/ch/navigations/MainNavigation.vue:41 `<h2 class="navy__title">`; css/navigations/navy.postcss:69-73 `.navy__title { @apply menu__item menu__item--title; @apply font-bold; }` → base font-size, inherited text color, px-4 with lg:px-0 (menu.postcss:68-71)
- **Fix:** Use a heading element (h2) for the pane title so the drawer exposes structure to AT as CD does, and align metrics: `font-size:var(--fs-base); color:inherit;` with padding matching the row inset (1rem, lg:0 per menu__item--title). Keep font-weight bold.
- **Status:** ✅ fixed — JS half applied: all three navy titles in js/shell.js are now <h2 class="navy__title"> (CD MainNavigation.vue:41/62/85); branch title keeps tabindex="-1". Safe: .navy__title (app.c

### drawer-4 · L · pixel — Drawer closes instantly (hidden attribute); CD animates close with opacity + height transition

- **Portal:** css/app.css:768 `animation:navMenuIn var(--duration) ease` (open only) + :771-773 documented rationale «Nur ein dezentes Einschieben — die Sichtbarkeit steuert das hidden-Attribut. Keine Opazität im Keyframe: sonst blieb der Drawer je nach Fill-Mode/Timing durchscheinend hängen.»; js/shell.js:411/423 toggle `panel.hidden`
- **CD:** designsystem/css/sections/desktop-menu.postcss:19 `transition: opacity 300ms ease-in-out, height 200ms ease-in-out` + :25-34 `.hidden { display:block !important; height:0 !important; opacity-0 … }` with children translate-y-8
- **Fix:** The opacity-stuck rationale holds for keyframes, but a transition (not animation) cannot get stuck: replicate CD's close by toggling a class instead of `hidden` (keep `hidden` semantics via `[data-closed]{visibility:hidden}` after transitionend, or use CD's own display:block+height:0 recipe). Low priority; acceptable as a documented reduction if motion parity is not required.
- **Status:** 🔶 partial — Teilweise; offener Rest: css cluster first: CD's close animation needs the transition recipe (desktop-menu.postcss:19,25-34 — transition on opacity/height with the d

### drawer-5 · L · consistency — Drill level change is a 300ms fade; CD slides panes 600ms ease-in-out

- **Portal:** css/app.css:788-800 — documented: «Robuster Display-Wechsel statt Slider-Transform (width:200% + flex + translateX rendert je nach Browser Glyphen nicht)» and «Fade, not a translateX slide: a transformed pane becomes a containing block, which would re-anchor the absolutely-positioned .navy__back»; `animation:navyDrillIn var(--duration-slow) ease` (opacity fade)
- **CD:** designsystem/css/navigations/navy.postcss:97-98 `transform: translateX(0%); transition: transform 600ms ease-in-out, opacity 600ms ease-in-out;`
- **Fix:** The containing-block rationale is real and verified (navy__back is absolutely positioned against the drawer at :839). Keep the fade on desktop, but match CD's tempo (`var(--duration-slowest)` ≈ 600-700ms is closer than 300ms, or add a dedicated 600ms token) so the level change reads as the same motion family; on mobile prefer the true slide (see mob-1) where the anchoring constraint does not exist.
- **Status:** ⬜ open

### drawer-6 · L · a11y — Menu rows lack CD's focus text-color state

- **Portal:** css/app.css:829-831 only defines hover (`.navy .menu__item > .menu__item__flex:hover … { background:var(--color-secondary-50); }`); no :focus/:focus-visible color rule for menu rows anywhere in app.css (verified)
- **CD:** designsystem/css/components/menu.postcss:21 `.menu__item { … @apply focus:text-primary-600; }`
- **Fix:** Add `.menu__item a:focus-visible, .navy .menu__item > .navy-branch:focus-visible { color:var(--color-primary-600); }` so keyboard focus gets the same ink feedback as CD, in addition to the global ring.
- **Status:** ⬜ open

### drawer-7 · L · pixel — Close-button ink one ramp step off CD (text-600 resting, secondary-700 hover)

- **Portal:** css/app.css:778-780 `.desktop-menu__close { … color:var(--color-text-muted); }` (--color-text-muted = text-600 #4b5563, tokens.css:80) `.desktop-menu__close:hover { color:var(--color-secondary-700); background:var(--color-secondary-50); }`
- **CD:** designsystem/css/sections/desktop-menu.postcss:56-58 → components/menu.postcss:116 `text-text-500` (#6b7280), :119-122 hover `bg-secondary-50` + `text-text-600` (#4b5563)
- **Fix:** Positions and icon size already match CD exactly (top 1/1.5/2rem, right 0/1/5rem, icon 1.25rem). Align ink: resting `color:var(--color-text-500 alias, #6b7280)`, hover `color:#4b5563` — or document that the darker resting grey is the portal's AA-driven muted token. Apply the same pair to navy__back (drawer-1).
- **Status:** ⬜ open

### mob-2 · L · pixel — Mobile menu fade 300ms vs CD 700ms

- **Portal:** css/app.css:862-864 `.mobile-menu { … transition:opacity var(--duration-slow); }` (--duration-slow = 300ms, tokens.css:179)
- **CD:** designsystem/css/sections/mobile-menu.postcss:10 `@apply transition-opacity duration-700;`
- **Fix:** Use `transition:opacity var(--duration-slowest)` (700ms token already exists in tokens.css:179).
- **Status:** ⬜ open

### mob-3 · L · naming — Portal-invented .mobile-menu__drawer class; desktop-named close button rendered (then hidden) in the mobile tree

- **Portal:** js/shell.js:72 `drawerClass = scope === 'desktop' ? 'desktop-menu__drawer' : 'mobile-menu__drawer'`; shell.js:117 renders `.desktop-menu__close` in both scopes; css/app.css:906,909 `.mobile-menu__drawer { … } .mobile-menu__drawer .desktop-menu__close … { display:none; }`
- **CD:** CD convention — no `.mobile-menu__drawer` exists in the design system; mobile levels live inside `.mobile-menu` via `.navy__level-N` (navy.postcss:79-99), and `.desktop-menu__close` is `@apply hidden lg:block` by its own definition (desktop-menu.postcss:57)
- **Fix:** Skip emitting the close button for the mobile scope in renderNavMenu() instead of hiding it in CSS, and fold the mobile drawer styling onto CD vocabulary (`.mobile-menu .navy` / level classes) so the BEM tree mirrors CD; keeps DOM smaller and removes the desktop-named element from the mobile accessibility tree.
- **Status:** ✅ fixed — Applied the actionable half: renderNavMenu() in js/shell.js no longer emits .desktop-menu__close for scope==='mobile' (desktop-only closeBtn conditional). [data-menu-close] wiring 

### mob-4 · L · pixel — Active mobile row is bolded; CD marks active only with the 3px bar

- **Portal:** css/app.css:895 `.mobile-menu .main-navigation .active { font-weight:var(--fw-bold); }` with comment at :744-746 «Fett bleibt nur im mobilen Menü»
- **CD:** designsystem/css/navigations/navy.postcss:18-23 active state = `::after` 3px `bg-primary-500` left bar only; no bold anywhere (CD's tailwind fontWeight maps bold→400, tailwind.config.js:200-203 — emphasis is a font-family swap, not weight 700)
- **Fix:** The comment asserts the deviation but no CD source backs it: navy's mobile active recipe is bar-only. Drop the font-weight rule (the existing ::before 3px primary-500 bar at :896-897 already matches CD's marker) — a 700-weight row also shifts line length, which CD's 400-weight bold never does.
- **Status:** ⬜ open

### bc-2 · L · pixel — Breadcrumb separator chevron 0.85rem vs CD 1rem

- **Portal:** css/app.css:960 `.breadcrumb__include-icon { margin-left:-1.25rem; margin-right:.75rem; width:.85rem; height:.85rem; }`
- **CD:** designsystem/app/components/ch/navigations/BreadcrumbNavigation.vue:108-112 — ChevronRight rendered without a size prop → SvgIcon default 'base' (SvgIcon.vue:14-17) → icons.postcss:23-25 `.icon--base { @apply h-4; }` = 1rem; breadcrumb.postcss:63-65 sets only `-ml-5 mr-3` (margins already match)
- **Fix:** Set `width:1rem; height:1rem;` — margins are already pixel-exact against CD.
- **Status:** ⬜ open

### bc-3 · L · pixel — Breadcrumb ink one step darker than CD, and the current crumb darkened further

- **Portal:** css/app.css:951 `.breadcrumb { … color:var(--color-text-muted); }` + :957 `.breadcrumb a { color:var(--color-text-muted); }` (text-600 #4b5563) + :959 `.breadcrumb [aria-current] { color:var(--color-text); }` (text-800) — no documenting comment for either
- **CD:** designsystem/css/sections/breadcrumb.postcss:8 `@apply text-sm text-text-500;` (#6b7280) — CD keeps every crumb, including the active one, at text-500
- **Fix:** CD's #6b7280 already passes AA (≈4.8:1) so the darker muted token is not required here: use `color:#6b7280` (add a --color-text-500 alias consumer) for the trail and drop the [aria-current] darkening, or keep the current-crumb emphasis and document it as a deliberate wayfinding deviation. Hover primary-600 already matches CD.
- **Status:** ⬜ open

### ft-1 · L · pixel — Footer paragraphs downsized via .small; CD footer body runs at base size with mb-3 xl:mb-4

- **Portal:** js/shell.js:291-292 `<p class="small">…` (css/app.css:388 `.small { font-size:var(--text-sm); }`); css/app.css:978 `.footer-information__entry p { margin-bottom:.75rem; }` with no xl step
- **CD:** designsystem/app/components/ch/sections/FooterInformation.vue:7-13 plain `<p>` (body text--base); css/sections/footer.postcss:54-60 `p { @apply mb-3 xl:mb-4; }`
- **Fix:** Remove the `small` class from the two footer paragraphs and add `@media (min-width:1280px){ .footer-information__entry p { margin-bottom:1rem; } }`.
- **Status:** ✅ fixed — JS half applied: removed class="small" from the two footer paragraphs in js/shell.js footerHTML() — footer body now runs at base size like CD FooterInformation.vue:7-13. CSS half (

### ft-2 · L · pixel — Legal-bar link colors inverted versus CD (grey resting → white hover instead of white → grey hover)

- **Portal:** css/app.css:993-997 `.footer-navigation { … color:var(--color-secondary-100); } .footer-navigation .footer__link { color:var(--color-secondary-100); } …:hover { color:var(--color-text-negative); }`
- **CD:** designsystem/css/sections/footer.postcss:19-23 `.footer__link { @apply text-white hover:text-text-300 focus:text-text-300; }` — the legal bar (FooterNavigation.vue) uses this unmodified, so CD is white resting, #d1d5db hover
- **Fix:** Drop the two .footer-navigation color overrides so `.footer__link` (app.css:980-981, already white → gray-300 hover, matching CD exactly) applies in the legal bar too.
- **Status:** ⬜ open

### ft-3 · L · pixel — Footer link-row icons: CD's h-6 (1.5rem) override missing; icon-right nudge left-[0.1em] missing

- **Portal:** css/app.css:982 `.footer-information__icon { … width:1.4em; height:1.4em; }` with no larger size inside `.footer-information__links`; :992 `.footer-information__link--icon-right .footer-information__icon { margin-left:.2em; margin-right:0; }` (no left offset)
- **CD:** designsystem/css/sections/footer.postcss:100-102 `.footer-information__links .footer__link { .footer-information__icon { @apply h-6; } }` (1.5rem); :33-38 `.footer-information__link--icon-right .footer-information__icon { @apply relative ml-[0.2em] left-[0.1em]; }`
- **Fix:** Add `.footer-information__links .footer-information__icon { height:1.5rem; }` (CD h-6 — width stays the existing 1.4em, matching CD's w-[1.4em] from footer.postcss:28), and extend the icon-right modifier at app.css:992 with `position:relative; left:.1em;` per footer.postcss:33-38. If a square box is preferred for the masked icons, note the 1.6px width deviation from CD explicitly.
- **Status:** ⬜ open

### btt-1 · L · consistency — Back-to-top: xl button 3rem vs CD 4rem, missing 1920 step promised by its own comment, and rail reserves 4rem it never uses

- **Portal:** css/app.css:1884-1886 lg and xl both `width:3rem; height:3rem;` with comment :1885 «CDs xl:w-16 setzt eine Platzierung im Seitengraben voraus, die erst ab 1920 gilt» — yet no ≥1920 rule sets 4rem; meanwhile :1876 `@media (min-width:1280px){ .back-to-top-rail { bottom:calc(100% - (1rem + 4rem)); } }` reserves docking space for a 4rem button, so the docked resting position is 1rem off the stated intent; :1879 `bottom:1.5rem` constant (mobile 1rem at :1888)
- **CD:** designsystem/css/components/back-to-top-btn.postcss:28-30 `w-11 h-11; lg:w-12 lg:h-12; xl:w-16 xl:h-16` and :37-50 sticky top calc(100vh − 3.5/4.5/5rem) → bottom gaps 0.75/1.5/1rem
- **Fix:** Either honour the comment — add `@media (min-width:1920px){ .back-to-top-btn { width:4rem; height:4rem; } .back-to-top-rail { bottom:calc(100% - (1rem + 4rem)); } }` and revert the 1280 rail rule to 3rem — or cap at 3rem consistently (rail 1280 rule → `1rem + 3rem`) and reword the comment. Sizes at base/lg, radius-sm, shadow-lg→xl, and the outline recipe already match CD exactly.
- **Status:** ⬜ open

### misc-1 · L · consistency — Dead rule .navy__group-title contradicts the documented flat-list decision

- **Portal:** css/app.css:786-787 `.navy__group-title { … }` — no emitter in js/ (grep confirms only navy__title is rendered), while :812-814 documents «Item 4.10 zurückgenommen: CDs Drawer hat keine Abschnittstitel … Die Liste bleibt flach.»
- **CD:** CD convention — no `.navy__group-title` exists in the design system; menu.postcss:68-71 `menu__item--title` is the only title class and is unused by the drawer
- **Fix:** Delete the .navy__group-title rule; it is the CSS remnant of the rolled-back Item 4.10 and can only drift.
- **Status:** ⬜ open

## Modal, tabs, accordion, viewers, lightbox

### lb-trap-1 · **H** · a11y — Lightbox focus trap breaks: disabled zoom buttons counted as trap boundary, so Tab escapes the aria-modal gallery

- **Portal:** js/gallery.js:247 — `const f = [...overlay.querySelectorAll('button, a[href]')].filter((n) => n.offsetParent !== null);` — no `:not([disabled])`. In default fit mode js/gallery.js:159-163 sets `el.zoomfit.disabled = fit` (true), and zoomfit is the last matched element. `activeElement === last` can never be true for a disabled button, so forward Tab from the real last tabbable (zoom-in) leaves the dialog to the page behind the scrim; Shift+Tab from the first element calls `last.focus()` on the disabled button, which silently fails.
- **CD:** CD convention: designsystem/app/scripts/Accordion.js:1-9 and portal's own js/components.js:451 both exclude disabled elements ('button:not([disabled])' / `!el.hasAttribute('disabled')`); WCAG 2.4.3 + aria-modal requires focus to stay inside the dialog.
- **Fix:** In gallery.js onKey Tab branch, reuse the shared FOCUSABLE selector from components.js (export it) or change the query to `button:not([disabled]), a[href], [tabindex="0"]`. That also brings the tabindex-0 `.pf-lightbox__scroll` region into the trap list.
- **Status:** ✅ fixed — Galerie-Falle über C.trapFocus — deaktivierte Zoomknöpfe brechen den Ring nicht mehr

### modal-scrim-1 · M · pixel — Modal backdrop scrim much lighter than CD (rgba(0,0,0,.45) vs text-900/70)

- **Portal:** css/app.css:2568 — `.modal__backdrop { background:var(--overlay-scrim); }` with css/tokens.css:187 `--overlay-scrim: rgba(0,0,0,.45)`. White header/title (app.css:2583/2585) sits on this at only ~3.4:1 over a white page.
- **CD:** designsystem/css/components/modal.postcss:25-29 — `.modal__backdrop { @apply bg-text-900/70 }` = rgba(17,24,39,0.7) (~9:1 behind the white header). Same value on popover-backdrop (popover.postcss:9-14).
- **Fix:** Introduce a dedicated `--modal-scrim: rgba(17,24,39,.7)` token (text-900/70, tailwind.config.js:74) and use it on `.modal__backdrop` (app.css:2568); keep the lighter `--overlay-scrim` for the Mediathek tiles and the interim `.chart-overlay` (app.css:2605). Contrast behind the white header rises from ~3.4:1 to ~6.6:1 over a white page — matching CD's modal.postcss:27.
- **Status:** ✅ fixed — --modal-scrim rgba(17,24,39,.7); Bild-Scrim bleibt getrennt

### modal-size-2 · M · consistency — Modal size scale does not map to CD screen widths — and sm (420px) is smaller than xs (480px)

- **Portal:** css/app.css:2577-2581 — `.modal--xs .modal__content { width:min(480px,100%); } .modal--sm { 420px } .modal--md { 640px } .modal--lg { 880px } .modal--xl { 1100px }`. Only xs matches CD; the scale is internally inverted (sm < xs). The comment at 2575-2576 documents only the xs=480 correction.
- **CD:** designsystem/css/components/modal.postcss:52-70 — `modal--xs` max-w-screen-xs … `modal--xl` max-w-screen-xl, with app/tailwind.config.js:20-28 screens: xs 480, sm 640, md 768, lg 1024, xl 1280.
- **Fix:** Realign the ramp to CD screen tokens: xs 480, sm 640, md 768, lg 1024, xl 1280 (all as `width:min(Npx,100%)`). Audit the two current callers (`openShareModal` uses xs; default md) — visual change is only wider md/lg/xl dialogs.
- **Status:** ✅ fixed — Skala = CD-Screens 480/640/768/1024/1280

### modal-pos-3 · M · pixel — Modal is vertically centered; CD tops the dialog at 10vh

- **Portal:** css/app.css:2567 — `.modal { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; padding:2rem; }`
- **CD:** designsystem/css/components/modal.postcss:10-14 + 31-35 — `.modal { py-[10vh] }` with `.modal__content { my-0 mx-auto max-h-[80vh] }`: content starts a fixed 10vh from the top, not centered.
- **Fix:** Replace vertical centering with the CD offset: `align-items:flex-start; padding:10vh 2rem;` (keep `max-height:80vh` on the content). Small dialogs then sit high like every CD modal instead of mid-screen.
- **Status:** ✅ fixed — Dialog bei 10vh, nicht zentriert

### modal-close-4 · M · pixel — Modal close icon is half CD size (icon--md vs CD SvgIcon 2xl)

- **Portal:** js/components.js:471 — `class="modal__close" … ${icon('Cancel', 'icon--md')}` → css/app.css:453/458 icon--md = 1.25rem (1.5rem ≥768px).
- **CD:** designsystem/app/components/ch/components/Modal.vue:23 — `<SvgIcon icon="Cancel" size="2xl" />`; css/foundations/icons.postcss:39-41 icon--2xl = h-9 md:h-10 lg:h-12 (2.25/2.5/3rem). Portal's own `.icon--2xl` ramp (app.css:456-462) already matches CD.
- **Fix:** Change the close button markup in components.js modal() to `icon('Cancel', 'icon--2xl')`; the 44px min-target on `.modal__close` (app.css:2598) already accommodates it.
- **Status:** ✅ fixed — Schliessen-Icon icon--2xl wie CDs SvgIcon

### tab-bold-1 · M · pixel — Active tab gets bold (700) — CD marks the active tab with the 3px underline only; bold causes tab-width jitter on switch

- **Portal:** css/app.css:1766 — `.tab__control--active { font-weight:var(--fw-bold); }` (700 in Noto Sans). Switching tabs changes the label width, so the whole tablist reflows.
- **CD:** designsystem/css/components/tab.postcss:49-77 — `.tab__control` has no weight change in any state; active/hover only set the `::after` bar to primary-500. (CD's fontWeight.bold is even mapped to 400, tailwind.config.js:200-203.)
- **Fix:** Remove the font-weight declaration from `.tab__control--active`; the red marker alone carries the state, exactly as CD, and the layout shift disappears.
- **Status:** ✅ fixed — Aktiver Reiter ohne bold — nur der 3px-Balken

### acc-arrow-1 · M · pixel — Accordion chevron rendered at 1rem — CD uses SvgIcon xl (1.75–2.25rem)

- **Portal:** js/components.js:701 — `${icon('ChevronDown', 'icon--base accordion__arrow')}` → app.css:452 icon--base = 1rem at all widths.
- **CD:** designsystem/app/components/ch/components/AccordionItem.vue:12 — `<SvgIcon icon="ChevronDown" size="xl" class="accordion__arrow" />`; icons.postcss:35-37 icon--xl = h-7 md:h-8 lg:h-9. The portal's `.icon--xl` ramp (app.css:455-462) already matches.
- **Fix:** Swap the class to `icon--xl accordion__arrow` in components.js accordion(); the `.accordion__meta` flex cluster (app.css:1729) absorbs the larger box without layout change.
- **Status:** ✅ fixed — Akkordeon-Chevron icon--xl

### acc-motion-2 · M · pixel — Accordion drawer snaps open/closed — CD animates max-height 300ms ease-out

- **Portal:** css/app.css:1726 — `.accordion__drawer { width:100%; }` and js/components.js:714-722 — wireAccordion toggles `drawer.hidden`; no transition anywhere (rotation of the arrow is the only animated part, app.css:1722).
- **CD:** designsystem/css/components/accordion.postcss:59-68 — `.accordion__drawer { max-h-0 overflow-hidden; transition:max-height .3s ease-out }`; app/scripts/Accordion.js:27-43 sets `content.style.maxHeight = scrollHeight + 'px'`.
- **Fix:** In wireAccordion, animate like CD: set `max-height:0; overflow:hidden; transition:max-height var(--duration-slow) var(--ease-out)` on the drawer, drive `style.maxHeight = scrollHeight+'px'` on open, and flip `hidden` after `transitionend` (the reduced-motion token ramp in tokens.css:330-335 already neutralizes it for prefers-reduced-motion).
- **Status:** ✅ fixed — max-height-Animation (300ms ease-out) mit transitionend + Sequenzwächter

### dv-lock-1 · M · mobile — Docviewer scroll lock misses the html:has() rule — the page scroller behind the viewer stays active (bug this codebase already diagnosed for the other overlays)

- **Portal:** css/app.css:3190 — `body.docviewer-open { overflow:hidden; }` is the only lock; but app.css:43 sets `html { overflow-y:scroll }`, and the comment at app.css:2546-2555 explains for chart overlays that 'overflow:hidden allein auf dem <body> genügt NICHT: der Dokument-Scroller ist hier das <html>-Element' — the fix `html:has(> body.chart-overlay-open){overflow:hidden}` (2555) was never extended to docviewer-open.
- **CD:** Portal-internal convention (app.css:2546-2561); CD has no viewer counterpart.
- **Fix:** Add `html:has(> body.docviewer-open) { overflow:hidden; }` next to the chart-overlay rule — or have doc-viewer.js reuse the existing `chart-overlay-open` class like gallery.js:288 does.
- **Status:** ✅ fixed — html:has(> body.docviewer-open) Scroll-Sperre ergänzt

### viewer-drift-1 · M · consistency — The twin dark viewers (docviewer vs pf-lightbox) drifted apart: button size, radius, close-hover, toolbar recipe and z-tier all differ

- **Portal:** css/app.css:3203-3208 — `.docviewer__btn { width:2.5rem; height:2.5rem; border-radius:var(--radius); }` with `--close:hover { background:var(--color-primary-600) }` and z at 3191 `var(--z-viewer)` (200); vs app.css:2793-2796 — `.pf-lightbox__btn { width/height:var(--target-min); border-radius:var(--radius-sm); }`, close hover = generic `--surface-negative-hover`, overlay z at 2781 `var(--z-modal)` (100). Toolbar: docviewer fixed dark pill with `--border-negative` (3257-3259) vs lightbox `--scrim-chip` + backdrop-blur (2854-2857).
- **CD:** CD convention: one negative-layer vocabulary (portal's own tokens.css:107-116 was created for exactly this: 'damit nicht jede Regel ihre eigene Weiss-Deckkraft erfindet').
- **Fix:** Pick one chrome recipe for both viewers: 44px buttons (`--target-min`), one radius token, one close-hover treatment (the red `primary-600` close is the more explicit affordance — apply it to `.pf-lightbox__btn[data-act=close]` too or drop it in docviewer), one toolbar surface, and one z tier (`--z-viewer` for both fullscreen viewers so toast layering is deliberate).
- **Status:** ✅ fixed — Beide Betrachter teilen Grösse/Radius/Hover/Toolbar-Fläche und --z-viewer

### lb-zoom-2 · M · mobile — Lightbox zoom buttons are 36px with no touch-size bump — the docviewer twin explicitly bumps to 44px citing WCAG 2.5.5

- **Portal:** css/app.css:2859 — `.pf-lightbox__zoom .pf-lightbox__btn { width:2.25rem; height:2.25rem; }` with no `(max-width:1023.98px), (hover:none)` override anywhere.
- **CD:** Portal-internal convention app.css:3266-3272 — '44-px-Ziel ohne Zeigegerät (WCAG 2.5.5)': `.docviewer__zoom { min-width:var(--target-min); height:var(--target-min); }` under the same media condition.
- **Fix:** Mirror the docviewer rule: `@media (max-width:1023.98px), (hover:none){ .pf-lightbox__zoom .pf-lightbox__btn { width:var(--target-min); height:var(--target-min); } }` (the chip pill grows gracefully).
- **Status:** ✅ fixed — 44px-Zoomknöpfe ohne Zeigegerät (Spiegel der Docviewer-Regel)

### chart-modal-1 · M · consistency — Chart fullscreen still uses its own overlay anatomy (white shadow-card, 36px bordered close) instead of the canonical .modal — consolidation already planned in-code

- **Portal:** css/app.css:2604-2613 — `.chart-overlay` puts the scrim on the container (no `__backdrop`), `.chart-overlay__box` is a white radius/shadow card (not CD modal anatomy), `.chart-overlay__close` is 2.25rem (below 44px target) with its own border recipe; js/charts.js:454-496 duplicates dialog wiring. The comment at app.css:2587-2590 states 'Item 6.12 baut das Chart-Vollbild auf die .modal-Ebene um' and the `.modal__body .chart` bridge rules already exist (2591-2594).
- **CD:** designsystem/css/components/modal.postcss:5-107 — one modal anatomy (backdrop + transparent content + white header text + close 2xl); CD has no second dialog recipe.
- **Fix:** Complete the in-code plan: render chart fullscreen through openModal({size:'xl'}) (the `.modal__body .chart` and `.modal--xl .modal__body{overflow:visible}` rules are already in place), then delete `.chart-overlay*` rules and the bespoke wiring in charts.js. Interim minimum: bump `.chart-overlay__close` to `var(--target-min)`.
- **Status:** ✅ fixed — Chart-Vollbild läuft über C.openModal (xl); openModal exportiert; .chart-overlay-Reste entfernt

### trap-dup-1 · M · consistency — Three parallel focus-trap implementations (components.trapFocus, gallery inline, docviewer inline) — the drift already produced lb-trap-1

- **Portal:** js/components.js:452-463 (shared trapFocus with a correct FOCUSABLE list, comment: 'Geteilt, damit alle Dialoge identisch fangen') vs js/gallery.js:244-252 (own list 'button, a[href]') vs js/doc-viewer.js:145-151 (own list 'button, [tabindex]:not([tabindex="-1"])').
- **CD:** CD convention: one shared getFocusableElements() helper reused by Accordion.js and Popover.js (designsystem/app/scripts/*.js:1-9).
- **Fix:** Have gallery.js and doc-viewer.js call C.trapFocus(overlay/backdrop) for the Tab handling (their remaining keys stay in the local onKey), or at minimum export FOCUSABLE from components.js and use it in both inline traps.
- **Status:** ✅ fixed — FOCUSABLE exportiert; Galerie und Docviewer nutzen C.trapFocus

### modal-header-5 · L · consistency — Title-less modal renders the close button without a .modal__header wrapper — it stretches full-width in the flex column

- **Portal:** js/components.js:475 — `${title ? `<div class="modal__header">…${closeBtn}</div>` : closeBtn}`: without a title the button is a direct child of `.modal__content` (align-items:stretch, app.css:2573-2574), so the 44px close control becomes a full-width strip. Currently latent (both callers pass a title) but the primitive is documented for reuse (components.js:465-468).
- **CD:** designsystem/app/components/ch/components/Modal.vue:9-25 + css/components/modal.postcss:77-86 — the header always exists (`flex justify-end items-start`), `--with-title` only switches to justify-between.
- **Fix:** Always emit `<div class="modal__header">${closeBtn}</div>` and add the `modal__header--with-title` modifier when a title is present, mirroring CD anatomy.
- **Status:** ✅ fixed — modal() always emits <div class="modal__header">…close…</div>; modal__header--with-title modifier added when a title is present (CD Modal.vue:9-12). Current .modal__header space-be

### modal-footer-6 · L · pixel — modal__footer lost CD's white background — it would render on the scrim, contradicting its own comment

- **Portal:** css/app.css:2595-2596 — `.modal__footer { … padding:1rem 1.5rem; border-top:1px solid var(--color-secondary-100); }` (no background). Comment at 2602 claims 'Der Fuss bleibt am weissen Kasten — er sitzt innerhalb der Karte', but modal() (components.js:476-477) places the footer as a sibling of `.modal__body`, outside the card. Latent — no caller passes footer yet.
- **CD:** designsystem/css/components/modal.postcss:103-107 — `.modal__footer { text-right p-4; bg-white border-t border-secondary-100 }`.
- **Fix:** Add `background:var(--color-bg)` (and CD's uniform 1rem padding) to `.modal__footer`, or move the footer markup inside the card and fix the comment — either way the declaration and the comment must agree.
- **Status:** 🔶 partial — Teilweise; offener Rest: css/app.css only: `.modal__footer` (:2676-2677) still lacks `background:var(--color-bg)` (CD modal.postcss:103-107 bg-white); the contradict

### modal-aria-7 · L · a11y — Modal aria wiring differs from CD: no aria-describedby, role=dialog on the wrapper that also contains the backdrop

- **Portal:** js/components.js:472-478 — `role="dialog" aria-modal="true" aria-labelledby` sit on the outer `.modal` div, which also contains `.modal__backdrop`; `.modal__body` has no id and nothing references it.
- **CD:** designsystem/app/components/ch/components/Modal.vue:2-8, 27 — role=dialog + aria-labelledby + aria-describedby on `.modal__content`; the body div carries `id=modal-desc-…`; aria-modal on the wrapper.
- **Fix:** Move role/aria-labelledby to `.modal__content`, give `.modal__body` an id and reference it via aria-describedby — pure attribute shuffle in components.js modal().
- **Status:** ✅ fixed — Attribute shuffle per CD Modal.vue:2-27: aria-modal stays on the .modal wrapper; role="dialog" + aria-labelledby (when titled) + aria-describedby moved to .modal__content; .modal__

### modal-title-8 · L · pixel — Modal title one type-ramp step larger than CD (text-xl vs h4 = text--lg)

- **Portal:** css/app.css:2585 — `.modal__title { font-size:var(--text-xl); font-weight:var(--fw-bold); }` (1.25rem base → 1.375/1.625 at lg/xl via tokens.css:299-309).
- **CD:** designsystem/app/components/ch/components/Modal.vue:13 — `<h4 class="h4">`; css/foundations/typography.postcss:121-124 — `.h4 { text--lg font-bold }` (1.125rem base).
- **Fix:** Set `.modal__title { font-size:var(--text-lg); }` (or reuse the portal's h4 ramp class) to land on CD's modal title size.
- **Status:** ⬜ open

### modal-close-9 · L · pixel — Close button misses CD's optical edge alignment (-mr-3, -mt-1 lg:-mt-2, pl-10 hit extension)

- **Portal:** css/app.css:2597-2599 — `.modal__close { … min-width/min-height:var(--target-min); padding:.375rem; }` — the icon sits ~10px inside the content's right edge instead of flush with it.
- **CD:** designsystem/css/components/modal.postcss:88-97 — `.modal__close { -mr-3 -mt-1 lg:-mt-2; pl-10 }` pulls the icon to the optical edge and extends the hit area leftwards.
- **Fix:** Add `margin:-0.25rem -0.75rem 0 0` (lg: -0.5rem top) to `.modal__close` so the enlarged 44px box overhangs the edge like CD, keeping the icon optically flush with the card edge.
- **Status:** ⬜ open

### tab-spacing-2 · L · pixel — Tab panel spacing rebuilt as 1.5rem bar-margin + 1rem panel padding instead of CD's single pt-8

- **Portal:** css/app.css:1750 — `.tab__controls-container { margin-bottom:1.5rem; }` and app.css:1767 — `.tab__container { padding-top:1rem; }` → 2.5rem combined above panel content.
- **CD:** designsystem/css/components/tab.postcss:79-82 — `.tab__container.vertical-spacing { @apply pt-8 }` (2rem) is the only gap; `.tab__controls-container` has no margin (tab.postcss:12-29).
- **Fix:** Drop the 1.5rem margin on `.tab__controls-container` and set `.tab__container { padding-top:2rem; }` so the rhythm matches CD with one declaration.
- **Status:** ⬜ open

### tab-fade-3 · L · pixel — Overflow fade stops 1px above the tab border; CD stops 0.25rem above

- **Portal:** css/app.css:1751 — `.tab__controls-container::after { … right:0; top:0; bottom:1px; width:2.5rem; }`
- **CD:** designsystem/css/components/tab.postcss:15-17 — `@apply absolute right-0 top-0 bottom-1 w-10;` → bottom:0.25rem.
- **Fix:** Change `bottom:1px` to `bottom:.25rem` so the gradient clears the underline zone like CD.
- **Status:** ⬜ open

### tab-border-4 · L · pixel — Missing CD variant: tab__controls border stays gray-200 on tinted (.box / secondary-50) background

- **Portal:** css/app.css:1755-1756 — `.tab__controls { … border-bottom:1px solid var(--color-border); }` (#e5e7eb) with no `.box` override; only the ::after gradient has a box variant (app.css:1754).
- **CD:** designsystem/css/components/tab.postcss:36-38 — `.bg--secondary-50 & { @apply border-gray-300 }` (#d1d5db).
- **Fix:** Add `.box .tab__controls { border-bottom-color:var(--color-border-strong); }` next to the existing `.box .tab__controls-container::after` rule.
- **Status:** ⬜ open

### acc-pad-3 · L · pixel — accordion__content misses CD's 2xl horizontal padding bump — content misaligns with the button at ≥1544px

- **Portal:** css/app.css:1727 — `.accordion__content { padding:1rem .5rem 2.5rem; }` with no 1544px media query, while `.accordion__button` bumps to `.75rem` inline padding at 1544px (app.css:1715).
- **CD:** designsystem/css/components/accordion.postcss:70-73 — `.accordion__content { px-2 pt-4 pb-10 2xl:px-3 }`.
- **Fix:** Add `@media (min-width:1544px){ .accordion__content { padding-inline:.75rem; } }` alongside the existing button bump.
- **Status:** ⬜ open

### acc-title-4 · L · pixel — accordion__title lacks CD's responsive right-padding ramp (lg:pr-6, 2xl:pr-8)

- **Portal:** css/app.css:1721 — `.accordion__title { … padding:.25rem 1rem .25rem 0; }` — pr fixed at 1rem for all widths.
- **CD:** designsystem/css/components/accordion.postcss:75-78 — `.accordion__title { text-base text-left py-1 pr-4; lg:pr-6 2xl:pr-8 }`.
- **Fix:** Add `@media (min-width:1024px){ .accordion__title{padding-right:1.5rem} }` and `@media (min-width:1544px){ .accordion__title{padding-right:2rem} }`.
- **Status:** ⬜ open

### acc-wire-5 · L · consistency — anchor-nav.js re-implements wireAccordion verbatim instead of calling it

- **Portal:** js/pages/anchor-nav.js:139-146 — inline click handler toggling aria-expanded + hidden, byte-for-byte the logic of C.wireAccordion (js/components.js:714-723), whose comment says it 'ersetzt die je Seite kopierte Toggle-Logik'.
- **CD:** CD convention: one Accordion.init() (designsystem/app/scripts/Accordion.js) wires every instance.
- **Fix:** Replace the inline block with `C.wireAccordion(mount)` (the AbortController signal can wrap the call site or wireAccordion can accept an options bag) so future accordion behavior changes land in one place — especially relevant once acc-motion-2 adds animation.
- **Status:** ✅ fixed — anchor-nav.js: inline aria-expanded/hidden toggle replaced by ctx.C.wireAccordion(mount) (accordion buttons live inside mount, so no AbortController signal needed — listeners die w

### step-color-1 · L · consistency — Step indicator colors deviate from CD (documented BehiG/contrast deviation — rationale still holds)

- **Portal:** css/app.css:1629-1638 — idle: text-600 on white with secondary-400 border; active: primary-600 + primary-100 ring; confirmed: success-text — vs CD gray-400/green-500. Rationale quoted at app.css:1616-1628: 'die CD-Vorlage selbst ist hier nicht AA-konform (step-indicator.postcss:6-24 nutzt gray-400) — bewusste Abweichung nach BehiG/P028 … alt #9ca3af auf Weiss … = 2.54:1 (Soll 4.5:1)'.
- **CD:** designsystem/css/components/step-indicator.postcss:5-23 — text-gray-400/border-gray-400, active bg-gray-400, confirmed bg-green-500 (white text ≈2.5:1 and 2.5:1 — genuinely fails AA/3:1).
- **Fix:** Keep the deviation: the measured CD values fail WCAG and the replacement stays inside CD token vocabulary. No change needed; retain the comment as the audit trail.
- **Status:** ⬜ open

### step-dead-2 · L · naming — Legacy `.steps > li >` union selectors are now dead — every call site emits CD's .step__indicator wrapper

- **Portal:** css/app.css:1629/1634/1637 — union selectors `.steps > li > .step__indicator-step, .step__indicator .step__indicator-step` kept 'ohne kaputten Zwischenzustand' (comment 1610-1615, Items 3.10/7.8); but stepIndicator() (js/components.js:866-868) already renders `<li class="step__indicator">`, and all four consumers go through it (building-create.js:267, transaction.js:54, space-request.js:53).
- **CD:** designsystem/app/components/ch/components/StepIndicator.vue:2-9 — anatomy is `.step__indicator > .step__indicator-step` only.
- **Fix:** Execute the planned Item 7.8: delete the `.steps > li > .step__indicator-step`-half of each union selector at app.css:1629/1634/1637. Note they are redundant rather than dead — `<li class="step__indicator">` matches both halves — so removal is a no-op visually; the CD-verbatim `.step__indicator .step__indicator-step` rules keep matching every current call site (building-create.js:267, space-request.js:53, transaction.js:54).
- **Status:** 🔶 partial — JS-Anteil umgesetzt; CSS-Rest: Delete the '.steps > li > .step__indicator-step' half of the union selectors at css/app.css:1629/1634/1637 (redundant, visually a no-op). No

### menu-a11y-1 · L · a11y — Action menu: Tab does not close the open popup, and the trigger lacks aria-controls/popup id

- **Portal:** js/components.js:1553-1554 — trigger has aria-haspopup/aria-expanded but no aria-controls and the popup no id; js/components.js:1590-1602 — keydown handles Arrow/Home/End/Escape only, so Tab moves focus out of the still-open menu (aria-expanded stays true until the global click closer at 1565-1574 fires).
- **CD:** designsystem/app/components/ch/components/Popover.vue:3-9 — trigger carries `aria-controls="popover-${id}"`; APG menu-button pattern: Tab closes the menu.
- **Fix:** Give the popup `id="${menuId}-popup"`, add `aria-controls` on the trigger, and in the menu keydown handler close on `Tab` (without preventDefault, so focus proceeds naturally).
- **Status:** ✅ fixed — Popup gets id="${menuId}-popup", trigger gets aria-controls (CD Popover.vue:3-9; menuIds verified unique per page: dashboard/spec.id/estate-map). Tab-close covered by the new focus

### share-btn-1 · L · consistency — Share dialog copy button adds a Link icon that CD's template does not have

- **Portal:** js/components.js:583-584 — `<button … data-share-copy>${icon('Link','icon--base')}<span class="btn__text">URL kopieren</span></button>`.
- **CD:** designsystem/app/pages/detailPageSimple.vue:847-853 — `<Btn variant="outline" size="base" label="URL Kopieren" class="mt-3" />` — label only, no icon.
- **Fix:** Drop the Link icon from the copy button (keep the outline variant and mt-3), matching the CD share template the dialog otherwise mirrors.
- **Status:** ✅ fixed — Link icon and btn--icon-left dropped from the copy button — now label-only btn--outline mt-3 exactly like CD detailPageSimple.vue:847-853.

### toast-dup-1 · L · consistency — Docviewer carries its own toast that drifted from the global .toast (white vs dark, no fade, different timeout)

- **Portal:** css/app.css:3274-3276 — `.docviewer__toast { background:var(--color-bg); color:var(--color-text); … }` no transition, 2200ms (js/doc-viewer.js:113-120) vs css/app.css:2538-2543 — `.toast { background:var(--color-secondary-800); color:var(--color-text-negative); transition:…; }` 2800ms with reduced-motion guard (js/components.js:1607-1616). The split exists because `--z-toast` (110) sits below `--z-viewer` (200) (tokens.css:220-222).
- **CD:** Portal-internal convention: one toast pattern (components.js toast, tokens z-scale).
- **Fix:** Restyle `.docviewer__toast` with the .toast declarations (dark surface, radius-lg, fade transition, same 2800ms) — or let C.toast accept a host element so the docviewer mounts the shared toast inside its own stacking context.
- **Status:** ✅ fixed — Same fix as badges/toast-2 (duplicate finding): dark-vs-white drift, missing fade and 2200ms timeout all resolved by adopting the shared anatomy and 5000/300ms timing; docviewer ke

### css-dup-1 · L · naming — Scroll-lock rule and its comment duplicated back-to-back in app.css

- **Portal:** css/app.css:2555 and 2560 — `html:has(> body.chart-overlay-open) { overflow:hidden; }` appears twice, with the explanatory comment repeated at 2546-2553 and 2556-2559.
- **CD:** CD convention: single declaration per rule.
- **Fix:** Delete the second copy of the comment block and rule (lines 2556-2560), keeping one authoritative instance.
- **Status:** ⬜ open

## Layout — container, grid, sections, rhythm

### grid-1 · M · consistency — Anchor-page header misaligned with content columns at lg (stale col-start-2 rule)

- **Portal:** css/app.css:271-272 — .anchor-page__header { grid-column:1 / -1; } @media(min-width:1024px){ grid-column:2 / 12; } — but app.css:209-210 sets .container__main { grid-column:1 / span 7 } and .container__aside { grid-column:9 / span 4 } at the same breakpoint. On js/pages/anchor-nav.js:53-59 the header therefore starts in column 2 while the content below starts in column 1, and ends at column 11 while the TOC ends at column 12. The comment justifying it ('richtet seine linke Kante ab lg an der Inhaltsspalte (container__main: lg col-start-2) aus … container__aside endet bei Spalte 11') is stale on both counts.
- **CD:** css/layouts/container.postcss:94-98 — CD's .container__main is lg:col-span-6 lg:col-start-2, which is what the header rule was written against. The portal's documented deviation (app.css:200-208: application pages have Seitenkopf/Reiterleiste/Katalogleiste all starting in column 1, so the CD indent 'las sich … als Fehlausrichtung') is sound — but it must then apply to the anchor-page header too.
- **Fix:** Drop the lg override: .anchor-page__header { grid-column:1 / -1; } at all widths, so the header shares the flush-left edge with .container__main (and reaches column 12 like the aside). Update or delete the stale comment at app.css:267-270.
- **Status:** ✅ fixed — anchor-page__header volle Rasterbreite; Kommentar korrigiert

### aside-1 · M · consistency — stack-lg on container__aside defeats the CD aside rhythm (3rem instead of 1.75/2rem)

- **Portal:** css/app.css:217-218 correctly implements .container__aside > * { margin-bottom:1.75rem } (lg 2rem), but 5 of 6 call sites also add stack-lg (css/app.css:385 — .stack-lg > * + * { margin-top:3rem; } / 3.5rem at 1544): js/apps/workspace.js:65,98,145, js/pages/application.js:84, js/pages/services.js:202. Collapsed sibling margins resolve to max(3rem, 1.75rem) = 3rem, so aside boxes sit 3/3.5rem apart; only js/pages/anchor-nav.js:59 (no stack class) renders the CD value.
- **CD:** css/layouts/container.postcss:113-124 — .container__aside & > *, & .sticky > * { @apply mb-7 lg:mb-8; } → 1.75rem, lg 2rem between aside modules.
- **Fix:** Remove stack-lg from the container__aside call sites — the existing .container__aside > * rule already provides the CD spacing. If a tighter/looser aside is ever wanted, express it as a documented modifier, not by stacking a second rhythm utility on the same element.
- **Status:** ✅ fixed — Removed stack-lg from the two container__aside call sites in my files (services.js detail, application.js) with a German WHY comment; .container__aside > * now yields the CD 1.75/2

### cont-1 · L · pixel — Container side padding below 480px is 1.25rem instead of CD's 1rem

- **Portal:** css/app.css:185-186 — .container { padding:0 var(--gap-responsive); } with css/tokens.css:198 — --gap-responsive: 1.25rem base step. The comment app.css:182-184 claims container padding and column gap are 'dieselben sechs Stufen 1/1.75/2.25/2.5/3/4rem' — but the shared token starts at 1.25rem, so the container gets 1.25rem below 480px.
- **CD:** css/layouts/container.postcss:7 — @apply px-4 xs:px-7 sm:px-9 lg:px-10 xl:px-12 3xl:px-16 → base side padding is 1rem (px-4); only the gap ramp starts at 1.25rem (grids.postcss:10 gap-5). The two ramps differ at the base step only.
- **Fix:** Restore the CD base step: add '@media (max-width:479.98px){ .container, .notification-banner__wrapper { padding-inline:1rem; } }' (matches the repo's max-width convention), or introduce a --container-px token that is 1rem at base and follows --gap-responsive from 480px up. Also correct the comment at app.css:182-184 — the ramps are identical only from xs upward.
- **Status:** ⬜ open

### grid-2 · L · consistency — Consecutive container--grid spacing is static 1.25rem instead of the responsive gap ramp

- **Portal:** css/app.css:250 — .container--grid + .container--grid { padding-top:1.25rem; } — a literal, one line below the correctly tokenised .gap--top { padding-top:var(--gap-responsive); } (app.css:247). Above 480px the rule diverges from the ramp (1.75→4rem). No adjacent container--grid pairs exist in current markup, so no visible defect today, but the rule contradicts the token architecture the file itself established.
- **CD:** css/layouts/container.postcss:56-58 — .container--grid & + & { @apply gap--top; } → responsive ramp pt-5 xs:pt-7 sm:pt-9 lg:pt-10 xl:pt-12 3xl:pt-16.
- **Fix:** Change to .container--grid + .container--grid { padding-top:var(--gap-responsive); } — identical to CD at every breakpoint and consistent with .gap--top.
- **Status:** ⬜ open

### main-1 · L · consistency — Three different vertical rhythms across identical container__main detail layouts

- **Portal:** The same main+aside detail pattern uses three spacings: .stack (1rem — js/apps/workspace.js:54,87,123, js/pages/services.js:191), .stack-lg (3rem — js/pages/application.js:71), and .vertical-spacing (3rem/3.5rem — js/pages/anchor-nav.js:58). css/app.css:384-386 defines the portal-only .stack/.stack-lg; .stack-lg duplicates the .vertical-spacing base ramp (app.css:372-374).
- **CD:** css/foundations/spacings.postcss:7-13 — CD's canonical content rhythm is .vertical-spacing (mt-12 2xl:mt-14 = 3rem/3.5rem); CD has no stack utilities.
- **Fix:** Converge the detail mains: use vertical-spacing (now that the intra-block rules exist, app.css:379-383) for prose-like mains, and keep .stack only for genuinely compact widget stacks; replace .stack-lg usages with vertical-spacing since they encode the same ramp twice.
- **Status:** ✅ fixed — Converged my detail mains on the canonical CD rhythm: application.js container__main stack-lg → vertical-spacing (identical ramp, canonical name) and services.js detail container__

### sect-1 · L · consistency — Same-background section collapse list misses CD pairs (section--py combos, bg--secondary-200…900)

- **Portal:** css/app.css:319-326 — collapse list covers only white/white, white/bg--white, bg--secondary-50 and -100 self-pairs, and hero + white. Missing vs CD: .hero + .section--py, .section--default + .section--py, .section--py-half + .section--default, .section--default + .section--py-half, .section--py + .section--default, and .bg--secondary-200…900 + same. The documented refinement (app.css:314-318: 'Bei Farbwechsel behält der zweite Abschnitt seinen Abstand, sonst klebt der Inhalt eines farbigen Bandes an dessen Oberkante') justifies not collapsing across colour changes — it does not cover omitting same-colour pairs for 200-900 or the --py aliases. No affected adjacency exists in current markup (section--py unused; only 50/600/700 bands rendered), so no visible defect today.
- **CD:** css/layouts/section.postcss:31-51 — collapse list includes .hero + .section--py, all section--default/--py/--py-half permutations, and every .bg--secondary-N + .bg--secondary-N pair from 900 down to 50.
- **Fix:** Extend the selector list to full CD parity while keeping the portal's colour-change refinement: add the section--py/--py-half permutations (with the same :not([class*="bg--"]) guards) and the bg--secondary-200…900 self-pairs, so future coloured bands collapse correctly without revisiting this rule.
- **Status:** ⬜ open

### bg-1 · L · consistency — bg--secondary-400 is treated as a dark surface; CD's negative threshold starts at 500

- **Portal:** css/app.css:365 — .bg--secondary-400 { background:var(--color-secondary-400); color:var(--color-text-negative); } — white text on a step CD considers light. (Folding the negative text colour into the bg utilities for 500-900 is a reasonable vanilla translation of CD's per-component negative rules; extending it to 400 is not backed by CD.) Currently unused in markup (only 50/600/700 appear), so no visible defect.
- **CD:** css/layouts/section.postcss:58-70 — negative text overrides exist only for bg--secondary-900…500; backgrounds.postcss:5-38 sets background-color only. CD convention: 400 keeps dark text.
- **Fix:** Remove color:var(--color-text-negative) from .bg--secondary-400 so the light/dark threshold matches CD (negative from 500 upward), or add a German comment documenting the deviation with a contrast rationale if 400-with-white is genuinely wanted.
- **Status:** ⬜ open

### cont-2 · L · consistency — container--flex silently extended with align-items:center and gap:1rem

- **Portal:** css/app.css:187 — .container--flex { display:flex; align-items:center; justify-content:space-between; gap:1rem; } — undocumented additions vs CD, which then need a counter-override at app.css:711 (.desktop-menu .container--flex { align-items:stretch; }). Used 4× in the shell (top-bar, top-header, breadcrumb, desktop-menu).
- **CD:** css/layouts/container.postcss:23-25 — .container--flex { @apply flex justify-between; } — no alignment, no gap; components set their own.
- **Fix:** Keep .container--flex CD-neutral (flex + justify-between only) and move align-items:center/gap:1rem to the shell contexts that need them (.top-bar .container--flex, .breadcrumb.container--flex …); the .desktop-menu counter-override then disappears.
- **Status:** ⬜ open

### grid-3 · L · naming — Duplicate grid column naming: grid--2/3/4 alongside CD's grid--responsive-cols-N, mixed in markup

- **Portal:** css/app.css:395-407 — .grid--2, .grid--3, .grid--4 declared as synonyms of .grid--responsive-cols-2/3/4 in every rule. Markup mixes both names, even on the same page: js/pages/home.js:96 uses grid--responsive-cols-3, js/pages/home.js:140 uses grid--3 (8× grid--N vs 3× CD name overall).
- **CD:** css/layouts/grids.postcss:29-56 — canonical names are grid--responsive-cols-2/-3/-4 (breakpoint behaviour md:2, lg:3/4, which the portal matches exactly).
- **Fix:** Standardise call sites on the CD names (grid--responsive-cols-N) and delete the grid--N aliases from the selectors, so the same pattern cannot drift into two definitions later.
- **Status:** ✅ fixed — Renamed every grid--2/grid--3 call site in my files to the CD names: knowledge.js, data.js, digitalisation.js (strategy boxes), news.js, my-cases.js (detail cards), search.js gridC

### grid-4 · L · naming — .grid bakes the responsive gap in; CD keeps gap opt-in via gap--responsive

- **Portal:** css/app.css:394 — .grid { display:grid; gap:var(--gap-responsive); } — the gap is welded to the class, and grid call sites omit the CD gap--responsive class (e.g. js/pages/home.js:96 'grid grid--responsive-cols-3'). Rendered output matches CD for current markup, but the class contract diverges: a portal .grid can never be gapless, and CD-shaped markup copied from the design system would double-declare the gap harmlessly today but rely on non-CD behaviour.
- **CD:** css/layouts/grids.postcss:21-23 — .grid { /* default Tailwind value */ } (display:grid only); gap comes from .gap--responsive (grids.postcss:9-11) applied in markup.
- **Fix:** Either (a) move the gap out of .grid and add gap--responsive at the ~14 grid call sites to mirror CD's markup contract, or (b) keep the merge but document it with a German comment at app.css:394 stating that .grid deliberately implies gap--responsive.
- **Status:** ✅ fixed — Applied option (a)'s markup half in my files: gap--responsive added at all grid call sites I renamed (plus digitalisation.js Themen grid which already had the CD column name). Harm

### ratio-1 · L · naming — Ratio utilities renamed (--16x9 vs CD --16/9) and missing .ratio z-lift and .ratio--mb

- **Portal:** css/app.css:438-443 — .ratio { position:relative; } (no z-index) and .ratio--1x1/--2x1/--4x3/--16x9. Percentages (98/50/75/56.25) match CD exactly. CD's .ratio--mb (mb-6) is absent. All ratio classes are currently unused in js/ markup.
- **CD:** css/layouts/ratio.postcss:5-33 — class names .ratio--1\/1, --2\/1, --4\/3, --16\/9 (markup 'ratio--16/9'); .ratio also gets z-50 ('for video iframes in clickable cards') and .ratio--mb { @apply mb-6 }.
- **Fix:** Rename to the escaped CD selectors (.ratio--16\/9 etc. — valid vanilla CSS) so future CD-shaped markup works verbatim, and add .ratio--mb { margin-bottom:1.5rem }. Leave the z-index lift out until a video-in-clickable-card case exists, since the portal has its own z-scale and a bare z-index:50 would collide with --z-nav-active.
- **Status:** ⬜ open

### notif-1 · L · pixel — Notification banner text-to-button spacing 1rem at 640-1023px; CD uses 2rem

- **Portal:** css/app.css:348-354 — .notification-banner__wrapper is flex-column with gap:1rem below lg, switching to row with gap:1.5rem at 1024px. The 1024px row gap matches CD's ml-6; the sm step is missing, so between 640 and 1023px the button sits 1rem under the text instead of 2rem. (The wrapper's container-ramp side padding and py ramp 1/2/2.5rem are correct per notification-banner.postcss:9,20.)
- **CD:** css/components/notification-banner.postcss:24-27 — .notification-banner .btn { @apply mt-4 sm:mt-8 lg:mt-0; @apply lg:ml-6; } → 1rem below 640, 2rem from 640, 1.5rem horizontal from 1024.
- **Fix:** Add @media (min-width:640px){ .notification-banner__wrapper { gap:2rem; } } before the existing 1024px rule (which already restores 1.5rem for the row layout).
- **Status:** ⬜ open

### sect-2 · L · pixel — section__title/subtitle use margin-bottom where CD uses padding-bottom

- **Portal:** css/app.css:2958 — .section__title { … margin:0 0 2.5rem; } and app.css:2969 — .section__subtitle { … margin:0 0 2.5rem; }. Distance value (2.5rem) and the grid + subtitle ramp (3/4/5rem, app.css:2970-2972) match CD, but as a margin it can collapse against a following sibling's margin-top (e.g. a .mt-* utility or .grid + .grid margin), yielding max() instead of CD's additive padding.
- **CD:** css/layouts/section.postcss:53-56, 80-83 — .section__title / .section__subtitle { @apply pb-10; } — padding-bottom 2.5rem, immune to margin collapsing.
- **Fix:** Switch both to padding-bottom:2.5rem; margin:0; (and keep the .grid + .section__subtitle padding-top ramp as is).
- **Status:** ⬜ open

### sect-3 · L · consistency — Two page anatomies coexist: fused .container.section root vs CD's section > container

- **Portal:** 40 of 42 pages render '<div class="container section">' as the page root (e.g. js/pages/anchor-nav.js:48, js/apps/fault-report.js:67), requiring the special rules css/app.css:306-310; js/pages/home.js:153 and js/pages/search.js:133 build the CD anatomy (section outer, container inner). The repo's own comment (js/components.js:106-120) names the consequence: 'keine solche Seite kann ein Wechselband, einen getönten Einstieg oder einen vollbreiten Aufruf tragen — sie ist ein einziges weisses Feld von der Brotkrume bis zum Footer. Die Startseite baut es richtig.' The fused root's padding values themselves are CD-faithful (top = hero ramp 3/3.5/5rem, verified against hero.postcss:6-7; bottom = container--pb ramp), so there is no pixel defect today — the drift is structural.
- **CD:** css/layouts/section.postcss:5-25 + container.postcss:5-17 — CD convention: .section is the full-width band carrying bg--*/padding, .container the inner width-constrained element.
- **Fix:** Migrate page roots to the CD anatomy incrementally (as home/search already model): wrap page content in '<section class="section section--default"><div class="container">…' via the existing pageSection/detail factories, then retire the .container.section special-case rules once the last fused root is gone. Until then, keep the current rules — they are value-correct — but treat the fused form as legacy in new pages.
- **Status:** 📌 deliberate deviation (documented) — Verschmolzene container.section-Wurzeln sind wertgleich (Kommentar in app.css); Umbau nur bei Bedarf an Wechselbändern

## Accessibility (cross-cutting)

### a11y-modal-scrim-1 · **H** · a11y — Modal backdrop lighter than CD — negative focus ring on modal close fails 3:1

- **Portal:** css/tokens.css:187 — `--overlay-scrim: rgba(0,0,0,.45)`; css/app.css:2568 — `.modal__backdrop { background:var(--overlay-scrim); }`; css/app.css:2583/2599/2601 — modal header, title and `.modal__close` are white (`--color-text-negative`) with `outline:2px solid var(--color-focus-ring-negative)` (#c4b5fd). Computed over a white page: white on the 45%-black scrim = 3.36:1; focus ring #c4b5fd on that scrim = 1.82:1 (fails WCAG 1.4.11, 3:1). Modal title (20px bold, large text) passes 3:1 only barely at 3.36:1.
- **CD:** designsystem/css/components/modal.postcss:25-29 — `.modal__backdrop { @apply bg-text-900/70; }` (#111827 at 70%). On CD's scrim the same white chrome measures 6.60:1 and the purple-300 ring 3.58:1 — both pass.
- **Fix:** Give the modal its own backdrop value matching CD instead of reusing the image-tile scrim: `.modal__backdrop { background:rgba(17,24,39,.7); }` (or a new token `--modal-scrim: rgba(17,24,39,.7)`), leaving `--overlay-scrim` for the Mediathek tiles. This restores CD parity and fixes the focus-indicator contrast without touching the close-button styling.
- **Status:** ✅ fixed — Scrim text-900/70 — Negativ-Fokusring wieder ≥3:1

### a11y-pagination-1 · M · a11y — Disabled pagination prev/next is a generic span with aria-label, CD uses button[disabled]

- **Portal:** js/components.js:1125 — `if (disabled) return `<li><span class="btn btn--outline btn--icon-only" aria-disabled="true" aria-label="${text}">${inner}</span></li>`;` — aria-label sits on a generic <span> (ARIA: name prohibited on role generic), and aria-disabled on a non-focusable, role-less element is not reliably exposed; SR users tabbing the pagination simply lose the control at the ends.
- **CD:** designsystem/app/components/ch/components/PaginationItem.vue:2-7 — `<button type="button" :class :aria-label="label" :disabled="disabled">` — CD always renders a real button and disables it natively.
- **Fix:** Render `<button type="button" class="btn btn--outline btn--icon-only" disabled aria-label="${text}">${inner}</button>` for the disabled ends. The styling already exists (css/app.css:1088 `.btn--outline[disabled]`, 1113 `.btn[disabled]`), so this is a markup-only change in pagination().
- **Status:** ✅ fixed — Deaktivierte Enden sind echte button[disabled]

### a11y-announce-map-1 · M · a11y — Live region announces «Ansicht Galerie» when the map view is active

- **Portal:** js/components.js:1230-1232 — `announce(...Ansicht ${view === 'list' ? 'Liste' : 'Galerie'}`)` knows only two views, but callers pass view='map': js/apps/media-library.js:213, js/apps/tenancies.js:230 (and portfolio/projects route through the same helper with a Kartenansicht in their view-switch, e.g. js/apps/portfolio.js:280). A screen-reader user switching to «Kartenansicht» hears «Ansicht Galerie».
- **CD:** CD convention (WCAG 4.1.3 status messages must be accurate); the portal's own view-switch labels the third state «Kartenansicht» (js/apps/media-library.js:198).
- **Fix:** Extend the ternary in announceCatalogue (js/components.js:1231): `view === 'list' ? 'Liste' : view === 'map' ? 'Karte' : 'Galerie'` so the announcement matches the «Kartenansicht» aria-label of the pressed view-switch button. This fixes the two affected callers (js/apps/media-library.js:213, js/apps/tenancies.js:230); portfolio.js and projects.js do not call announceCatalogue at all, so they are not affected by the wrong text (their view changes are silent, a separate matter).
- **Status:** ✅ fixed — announceCatalogue kennt die Kartenansicht

### a11y-dup-ids-1 · M · a11y — filterGroup checkbox ids collide when two data tables share a facet dimension

- **Portal:** js/components.js:1534-1536 — filterGroup renders `id="f-${dim}-${i}"` without any per-instance prefix. On the Liegenschaften object detail both `ausstattung` (dim 'status', js/apps/portfolio.js:518) and `vertraege` (dim 'status', js/apps/portfolio.js:537) are mounted simultaneously (js/apps/portfolio.js:652-655 mounts every DT at once; inactive tab panels stay in the DOM), producing duplicate `id="f-status-0"` etc. in one document.
- **CD:** CD convention — unique ids per control instance (HTML validity / robust programmatic association; the comment at js/components.js:1532-1533 itself relies on ids being stable for focus restoration).
- **Fix:** Add an idPrefix parameter to filterGroup (`id="${idPrefix}-f-${dim}-${i}"`) and pass the table id from mountDataTable (js/components.js:1451) and the page catalogues. Wrapping labels keep working; document-wide id lookups (router state-change focus restore) become unambiguous.
- **Status:** ✅ fixed — filterGroup idPrefix; mountDataTable reicht sein id-Präfix durch

### a11y-toast-1 · M · a11y — toast() creates a fresh role=status node with text already set — violates the portal's own live-region doctrine

- **Portal:** js/components.js:1607-1616 — toast() builds a new div, sets role="status" and textContent, then appends it. The portal's own comments state this never fires: js/components.js:373 «Nur Text mutieren, nie den Knoten neu erzeugen, sonst feuert aria-live nicht» and js/components.js:815-817 «in einer neu erzeugten Region feuert aria-live ohnehin nicht (Item 3.9)». Simulated actions confirmed via toast are therefore silent for SR users.
- **CD:** index.html:22 — the portal's own persistent `#live` region (role=status aria-live=polite) is the sanctioned channel; CD's ToastMessage.vue carries no live role at all.
- **Fix:** In toast(), additionally call announce(msg) so the message goes through the persistent #live region, and drop role="status" from the transient element (keep it purely visual). This is the same split already used by mountBanner (js/components.js:166).
- **Status:** ✅ fixed — toast() sagt über die persistente #live-Region an

### a11y-loading-1 · L · consistency — Route loading state relies on a freshly created role=status region — same self-documented pitfall

- **Portal:** js/router.js:313-314 — `mount.innerHTML = `<div class="container section" role="status" aria-busy="true">…<span class="sr-only">Inhalt wird geladen…</span></div>`` — the status region is created together with its content, which js/components.js:373 and 815-817 document as not firing. The «Inhalt wird geladen…» text is therefore likely never announced (mitigated by the h1 focus after render).
- **CD:** Portal-internal doctrine (js/components.js:373; Item 3.9) — live announcements go through the persistent #live node.
- **Fix:** Keep the visual spinner markup, but announce the loading state through the persistent region: `announce('Inhalt wird geladen…')` before the innerHTML swap (and let the subsequent h1 focus signal completion). aria-busy on the container can stay.
- **Status:** ✅ fixed — Applied in js/router.js: C.announce('Inhalt wird geladen…') now fires through the persistent #live region before the innerHTML swap; spinner markup, role=status and aria-busy kept 

### a11y-form-verbosity-1 · L · a11y — Failed submit triggers triple announcement: error summary alert + focus move + one alert per field

- **Portal:** js/components.js:949 — errorSummary renders role="alert" and wireErrorSummary (968-978) moves focus to its title; js/components.js:1009 and 933-934 — every field/select message badge ALSO carries role="alert" while the same text is already linked via aria-describedby (js/components.js:988, 903). Re-rendering the form after submit inserts all of them at once — the same errors are announced two to three times.
- **CD:** designsystem/app/components/ch/components/Input.vue:22-28 — CD renders the message badge with no live role at all; WCAG 4.1.3 asks for one status message, not N.
- **Fix:** Keep role="alert" on the error summary (and on messages that appear from inline validation without a summary), but drop it from per-field badges rendered together with an errorSummary — aria-describedby already reads the message when the user reaches the field. Simplest: add a `quiet` option to field()/select() that the form apps set when they render a summary.
- **Status:** ✅ fixed — quiet:true option added to field() and select(): omits the live role from the message badge (aria-describedby still reads it at the field); default behavior unchanged (verified ale

### a11y-scroller-1 · L · a11y — Overflowing pre.api-code becomes a focusable scroller with no role and no name

- **Portal:** js/components.js:411-424 — wireScrollRegions gives every overflowing `pre.api-code` tabindex="0" but removes role when no aria-label is present («Nur wer einen Namen mitbringt, wird auch zur benannten Gruppe erklärt»); js/apps/api-docs.js:102 and 111 render `<pre class="api-code">` without any label. Keyboard users land on an anonymous focus stop that announces only its raw JSON content.
- **CD:** CD convention / WAI guidance for keyboard-scrollable regions: role="region" plus an accessible name (the portal already does exactly this for table wrappers via caption → aria-label, js/components.js:269).
- **Fix:** Add aria-label to the two api-docs call sites (e.g. `aria-label="Beispiel-Request (JSON)"` on api-docs.js:102 and `aria-label="Antwort der Testanfrage"` on :111). The existing wireScrollRegions logic will then promote them to named groups automatically — no helper change needed.
- **Status:** ✅ fixed — aria-label="Beispiel-Request (JSON)" and aria-label="Antwort der Testanfrage" added to the two pre.api-code call sites in api-docs.js, plus a German WHY comment; verified in the pr

### a11y-landmark-1 · L · a11y — Catalogue-bar search forms are unnamed role=search landmarks duplicating the named header search

- **Portal:** js/components.js:1373 — `<form class="catbar__search" id="…" role="search">` has no aria-label, while the header already exposes a search landmark named «Suche auf der Plattform» (js/shell.js:219). On every catalogue page (and on object details with mountDataTable, one per table) the landmark list shows multiple «Suche» landmarks, all but one anonymous.
- **CD:** CD convention / ARIA landmark guidance: when a landmark role appears more than once per page, each instance needs a distinguishing accessible name.
- **Fix:** Reuse the already-passed searchLabel as the landmark name in catalogueBar: `<form … role="search" aria-label="${escape(searchLabel)}">` (js/components.js:1373). mountDataTable already supplies per-table labels like «Verträge durchsuchen» (js/components.js:1443), so names become unique for free.
- **Status:** ✅ fixed — catbar search form now carries aria-label="${escape(searchLabel)}" — mountDataTable already supplies unique labels («Verträge durchsuchen»), so multiple role=search landmarks per p

### a11y-backtotop-1 · L · consistency — Back-to-top focuses #main-header, which is missing from the focus-outline suppression list

- **Portal:** js/shell.js:561-566 — the back-to-top handler sets tabindex="-1" on #main-header and focuses it; css/app.css:158-160 suppresses the ring only for `h1[tabindex="-1"]`, `h2[tabindex="-1"]` and `#main-content`. Activating the button with Enter (keyboard → :focus-visible applies) paints the 2px purple outline around the entire header band.
- **CD:** Portal's own rule and rationale at css/app.css:156-160 («Route-change focus targets are not interactive controls … without painting a ring»); CD back-to-top (back-to-top-btn.postcss) scrolls without decorating the header.
- **Fix:** Extend the existing suppression rule: `#main-header:focus, #main-header:focus-visible { outline:none; }` next to css/app.css:160 — same rationale as the current list (non-interactive programmatic focus target).
- **Status:** 🔶 partial — Teilweise; offener Rest: css cluster: extend the focus-outline suppression rule at app.css:163-165 with #main-header:focus, #main-header:focus-visible { outline:none

### a11y-navy-title-1 · L · naming — Drawer titles are spans; CD's canonical navy markup uses h2.navy__title

- **Portal:** js/shell.js:100, 105 and 111 — `<span class="navy__title">…</span>` (level-0 title, branch title with tabindex="-1", flat-drawer title).
- **CD:** designsystem/app/components/ch/navigations/MainNavigation.vue:41, 62, 85 — `<h2 class="navy__title">Dienstleistungen</h2>` — the drawer title is a heading in CD's canonical DOM.
- **Fix:** Render the navy titles as `<h2 class="navy__title">` (keeping tabindex="-1" on the branch title so the existing focus-on-drill behaviour still announces the branch). Closed drawers are `hidden`, so the headings do not pollute the page outline while collapsed.
- **Status:** ✅ fixed — Applied via the same span→h2 change in js/shell.js:100/105/111 (now 107/112/118). Bonus: the existing h2[tabindex="-1"]:focus suppression at app.css:163-165 now also covers the bra

### a11y-fc-icon-1 · L · a11y — Forced-colors: icons inside real <button class=btn> are painted LinkText next to ButtonText labels

- **Portal:** css/app.css:471-473 — `@media (forced-colors: active){ … .btn .icon, .btn--link .icon, a .icon { background-color:LinkText; } }` — the selector matches <button> elements carrying .btn (e.g. catbar submit js/components.js:1376, filter toggle :1366, form buttons), whose text renders ButtonText in Windows High Contrast; the icon shows in the system link colour inside a button.
- **CD:** CD needs no such rule: its icons are inline SVG with fill:currentColor (SvgIcon.vue), so they always match the surrounding control's forced colour.
- **Fix:** Split the repaint by element: `a .icon, a.btn .icon { background-color:LinkText; }` and `button.btn .icon { background-color:ButtonText; }` (keep the generic `.icon { CanvasText }` fallback). Icons then track their host control's forced colour like CD's currentColor SVGs.
- **Status:** 🔶 partial — Teilweise; offener Rest: css/app.css:475-477: split the forced-colors repaint by host element — `a .icon, a.btn .icon { background-color:LinkText }` / `button.btn .i

### a11y-close-target-1 · L · consistency — Overlay close buttons drift between 44px and 36px targets without a documented exception

- **Portal:** css/app.css:2597-2598 — `.modal__close { min-width:var(--target-min); min-height:var(--target-min); }` (44px) and css/app.css:2793 — `.pf-lightbox__btn` 44px, but css/app.css:2609-2610 — `.chart-overlay__close { min-width:2.25rem; min-height:2.25rem; }` (36px) and css/app.css:2859 — `.pf-lightbox__zoom .pf-lightbox__btn { width:2.25rem; height:2.25rem; }`. The 36px variants carry no rationale comment, unlike the map-control exception which documents its pointer:fine condition (css/app.css:2123-2129).
- **CD:** Portal's own token contract: css/tokens.css:100-105 — `--target-min` is the deliberate 44px tap-target floor for icon-only controls.
- **Fix:** Raise `.chart-overlay__close` and the lightbox zoom buttons to `min-width/min-height:var(--target-min)` (visual size can stay smaller via padding), or scope the denser size behind `(min-width:1024px) and (pointer:fine)` with the same documenting comment style as the map controls.
- **Status:** ⬜ open

### a11y-menu-tab-1 · L · a11y — Action menu (kebab) stays open with aria-expanded=true when focus tabs out

- **Portal:** js/components.js:1579-1603 — wireMenu handles ArrowUp/Down, Home/End and Escape, but not Tab or focusout: pressing Tab on a role=menuitem moves focus out of the popup while it remains visible and the trigger keeps aria-expanded="true" until a pointer click lands outside (ensureMenuGlobal, :1562-1575, is click-only).
- **CD:** WAI-ARIA APG menu-button pattern: Tab from an open menu closes the menu; expanded state must track visibility.
- **Fix:** In wireMenu, add `m.addEventListener('focusout', (e) => { if (!m.contains(e.relatedTarget)) close(false); })` (or intercept Tab in the item keydown handler and call close(false)) so keyboard users never leave a phantom open menu behind.
- **Status:** ✅ fixed — wireMenu: focusout on the .action-menu closes when e.relatedTarget leaves the component (covers Tab-out, and click-to-focusable-outside; relatedTarget null → close). close(false), 

### a11y-combobox-1 · L · consistency — Two combobox implementations have drifted: address suggest never closes on Tab/blur

- **Portal:** js/search-suggest.js:118-136 — the home-search combobox closes on Tab (:124) and on blur (:136); js/apps/building-create.js:485-499 — the address combobox handles ArrowUp/Down, Enter and Escape only: tabbing from #bc-address into the map leaves the listbox open with aria-expanded="true" (only an outside *click* closes it, :501-504). Same ARIA pattern, two implementations, diverged behaviour.
- **CD:** Portal-internal consistency (both follow WAI-ARIA 1.2 combobox per js/search-suggest.js:11-14, which specifies «Tab verlässt» as closing).
- **Fix:** Align building-create with search-suggest: add `else if (e.key === 'Tab') closeList();` to the keydown handler (building-create.js:485-490) and a blur timeout like search-suggest.js:136 — or extract the shared open/close/highlight plumbing into a C.combobox helper so the two cannot drift again.
- **Status:** ✅ fixed — building-create address combobox now closes on Tab (keydown branch, no preventDefault so focus still moves) and on blur via setTimeout(closeList, 120) — parity with search-suggest.

### a11y-dupname-1 · L · consistency — Icon controls carry both a (sr-only) label and an identical aria-label

- **Portal:** js/components.js:1135-1137 — pagination input has `<label class="sr-only" for="${inputId}">Seite</label>` AND `aria-label="Seite"` on the same input; js/components.js:1376 — catbar submit has `aria-label="Suchen"` plus a sr-only `<span class="btn__text">Suchen</span>`. Two name sources per control; aria-label silently wins and the second source is dead weight that can drift.
- **CD:** designsystem/app/components/ch/components/Pagination.vue:8 — CD uses a single name source (aria-label) on the pagination input; btn--icon-only buttons in CD name themselves via the sr-only .btn__text alone (btn.postcss:160-166 pattern).
- **Fix:** Pick one source per control: drop aria-label from the pagination input (the explicit sr-only label already names it) and drop aria-label from .catbar__submit (the sr-only btn__text names it). Keeps names single-sourced as in CD.
- **Status:** ✅ fixed — Both controls single-sourced: pagination input's aria-label removed (sr-only label names it); catbar submit's aria-label removed (sr-only .btn__text names it, CD btn.postcss:160-16

### a11y-datastatus-1 · L · a11y — Data-failure band lives outside every landmark

- **Portal:** index.html:18 — `<div id="data-status" role="alert"></div>` sits between <header> and <main>; when js/app.js:12-25 fills it, the notification incl. the interactive «Seite neu laden» button is in no landmark, so landmark/region navigation skips it (the initial alert announcement is the only pointer to it).
- **CD:** CD convention (HtmlStructure.mdx shell: all page content inside #main-header / #main-content / #main-footer landmarks); ARIA landmark guidance that all perceivable content belong to a landmark.
- **Fix:** Split the two jobs across the persistent node and its content: in index.html:18 make the container a named region — `<div id="data-status" role="region" aria-label="Hinweis zum Datenbestand">` — so the band and its reload button are reachable via landmark/region navigation; and in js/app.js:20-24 pass `{ live:true }` to notification(), which for variant 'error' renders role="alert" on the injected notification (components.js:818), preserving the one-time announcement when the band is inserted. Keeps the node outside #main-content for persistence, no visual change.
- **Status:** ✅ fixed — Applied per the corrected fix: index.html #data-status is now role="region" aria-label="Hinweis zum Datenbestand" (named region = landmark, band + reload button reachable via landm

### a11y-focus-style-1 · L · pixel — Focus indicator: outline with 2px offset vs CD's hugging 2px ring

- **Portal:** css/app.css:149 — `:focus-visible { outline:2px solid var(--color-focus-ring); outline-offset:2px; border-radius:1px; }` — colour (#8655F6 = CD purple-500, tokens.css:90) and width match, but the 2px offset draws the ring 2px away from the control; CD's ring hugs the edge.
- **CD:** designsystem/css/foundations/global.postcss:75-86 — `*:focus-visible { @apply outline-none ring-2 ring-purple-500 z-10; }` — Tailwind ring-2 is a box-shadow flush with the element (no offset); purple-500 = #8655F6 (tailwind.config.js:142).
- **Fix:** Acceptable-to-keep deviation (the offset improves indicator visibility and outline survives forced-colors, which box-shadow rings do not) — but it is undocumented. Either add the standard German rationale comment at css/app.css:142-149 declaring the offset deliberate, or drop `outline-offset` to 0 for strict CD parity.
- **Status:** ⬜ open

## App views — consistency and mobile

### mt-filter-1 · **H** · ux — Mietende: Filter toggle rendered but never wired — panel unreachable

- **Portal:** js/apps/tenancies.js:248 — catalogueBar renders `filterId: 'mt-filter', panelId: 'mt-filters'`, but the file wires only `#mt-filters` change (line 285) and `#mt-reset`; no click handler for `#mt-filter` exists and C.wireCatalogue is not called, so the panel stays `hidden` forever and the VE facet plus its Zurücksetzen button are unreachable (mouse, keyboard and SR alike; aria-expanded stays 'false'). The `.catbar__fcount` badge is also never updated.
- **CD:** Portal standard: js/apps/portfolio.js:317 and document-archive.js:155 wire the identical toggle (`fpanel.hidden` flip + aria-expanded), and js/components.js:1299-1313 offers the shared filterToggleId/panelId wiring; CD's facet filter is an openable panel on every width (search.postcss:249-265).
- **Fix:** Add the same wiring as portfolio.js: `const fbtn = mount.querySelector('#mt-filter'); fbtn.addEventListener('click', () => { const open = !fpanel.hidden; fpanel.hidden = open; fbtn.setAttribute('aria-expanded', String(!open)); })` plus a `catbar__fcount` badge update on filter change — or route the whole bar through C.wireCatalogue with filterToggleId/panelId.
- **Status:** ✅ fixed — Filter-Umschalter verdrahtet inkl. fcount-Pflege (Tenancies-Agent)

### announce-1 · M · a11y — Result updates not announced in 3 of 5 JS-state catalogs

- **Portal:** js/apps/portfolio.js:201-229 renderMain() rewrites count and results with no C.announceCatalogue; identical omission in js/apps/projects.js:186-212 and js/apps/document-archive.js:88-108 — screen-reader users get no feedback after search/filter/tree interactions.
- **CD:** Internal standard: js/apps/tenancies.js:230 and js/apps/media-library.js:213 call C.announceCatalogue (js/components.js:1230) after every result render; C.mountDataTable announces too (components.js:1500).
- **Fix:** Call C.announceCatalogue({ count, total, unit, page, totalPages, view }) at the end of renderMain() in portfolio.js, projects.js and document-archive.js.
- **Status:** ✅ fixed — Added C.announceCatalogue({count, total, unit: 'Dokumenten', page, totalPages, view: 'list'}) as the last step of renderMain(), after syncHash — same convention as tenancies.js/med

### fp-scroll-1 · M · a11y — Floorplan stage is a horizontal scroller without the shared scroll-region wiring

- **Portal:** css/app.css:3389 `.fp-stage { overflow:auto; padding:1rem; … }` with css/app.css:3392 `.fp { min-width:38rem }` — always overflows below ~640px; the markup (js/apps/tenancies.js:597 `<div class="fp-stage" id="fp-stage">`) carries no data-scroll-region, so it gets no tabindex, no focus ring and no scroll hint.
- **CD:** Portal convention css/app.css:1323-1329: every horizontal scroll host is positioned, focusable and hinted via C.wireScrollRegions; js/components.js:411 SCROLL_SEL = '[data-scroll-region], .table-wrapper, pre.api-code'.
- **Fix:** Add `data-scroll-region` to the .fp-stage element and `position:relative` to the .fp-stage rule; the router's wireScrollRegions call (router.js:338) then adds tabindex/role/hint only when it actually overflows.
- **Status:** ✅ fixed — Added data-scroll-region to #fp-stage plus an aria-label ("Grundriss <Geschoss>") so wireScrollRegions can promote it to a NAMED group when it overflows (its MutationObserver cover

### map-tokens-1 · M · consistency — Map palette hardcoded — bypasses the token layer and the skin

- **Portal:** js/buildings-map.js:172-173 `const BLUE = '#2563eb'; const PARCEL = '#0f766e';` used in paint specs at 231/237 (circle-color) and 241 (text-color '#1f2937', halo '#fff'); css/app.css:2145-2146 `.map-marker { … background:rgba(37,99,235,.72); }` — the intranet primary-600 literal. Under the default (red) or freebrand skin the markers stay intranet-blue; PARCEL #0f766e is a near-miss of --chart-series-1 #0f6b75.
- **CD:** js/charts.js:29-53 establishes the pattern: resolve tokens at render time via getComputedStyle (cssVar('--chart-series-1', …)) precisely because paint specs cannot carry var(); tokens.css:249-259 shows primary-600 is skin-dependent.
- **Fix:** Resolve marker/cluster color from --color-primary-600 and the parcel tint from --chart-series-1 with the same cssVar helper before building the paint objects; derive .map-marker background from the primary token (e.g. color-mix(in srgb, var(--color-primary-600) 72%, transparent)) instead of a fixed rgba.
- **Status:** ✅ fixed — JS share applied in js/buildings-map.js: added the charts.js-style cssVar helper (getComputedStyle at render time) and moved color resolution into initEstateMap — circle-color for 

### api-ramp-1 · M · consistency — API docs mix frozen --fs-* with responsive --text-* type ramps

- **Portal:** css/app.css:2234 `.api-rail__item { … font-size:var(--fs-sm) … }`, 2251 `.api-ep__path { font-size:var(--fs-sm) }`, 2252 `.api-ep__summary { font-size:var(--fs-sm) }`, 2270 `.api-block__label { font-size:var(--fs-xs) }`, 2271 `.api-params { font-size:var(--fs-sm) }` — frozen steps; the same page puts its section text on the responsive ramp at 2244-2245 (`.api-resource__title { font-size:var(--text-xl) }`, `.api-resource__desc { font-size:var(--text-sm) }`, comment Item 2.22). At ≥1280px paragraphs grow to 16px while the endpoint list stays 14px.
- **CD:** css/tokens.css:150-151 — «CD `text--*` responsive ramps … Consume these, not the raw --fs-* steps, for anything that should scale» (typography.postcss:18-57).
- **Fix:** Switch the api-docs text sizes to var(--text-sm)/var(--text-xs); keep --fs-* only where a frozen size is deliberate (mono code, see api-code-1) and document it.
- **Status:** ✅ fixed — API-Prosa auf text-*-Rampen; Mono bewusst starr (Kommentar)

### share-1 · M · consistency — Detail-page header drift: share bar present on media/my-cases, absent on portfolio/tenancies/projects

- **Portal:** js/apps/portfolio.js:631 and 725, js/apps/tenancies.js:791, js/apps/projects.js:476 use bare C.backLink — no share affordance — although tenancies.js:399-402 explicitly designs its hash state to be shareable («eine bestimmte Ansicht teilbar … ist ein Link»); js/apps/media-library.js:359 uses C.detailBar (back + shareBar).
- **CD:** js/components.js:624-629 — detailBar implements the CD pattern «.back-bar + .share-bar auf derselben Höhe nach der Brotkrume».
- **Fix:** Replace C.backLink with C.detailBar({ backHref, backLabel }) on the building, parcel, tenancy and project detail heads so all detail pages share the CD back+share row.
- **Status:** ✅ fixed — detail() head swapped C.backLink('#/app/projects','Bauprojekte') for C.detailBar({backHref,backLabel}); share wiring is global (C.wireShare), no per-page code needed. Only the proj

### estate-fg-1 · M · consistency — estate.js re-implements the shared filter group with a different data attribute

- **Portal:** js/apps/estate.js:254-263 — local fGroup() emits `<input type="checkbox" data-dim=…>` without ids; the rest of the portal uses C.filterGroup with `data-fdim` and stable ids (js/components.js:1531-1537). Two checkbox vocabularies for the same pattern.
- **CD:** js/apps/portfolio.js:256-261 documents why the local copy was retired there («C.filterGroup statt einer eigenen Fassung: der lokale Nachbau wertete selected nicht aus und vergab keine id»).
- **Fix:** Extend C.filterGroup with an optional `max`/«Alle anzeigen» cap (the only extra feature estate needs, estate.js:253-262) and use it in estate.js with data-fdim, retiring the local fGroup.
- **Status:** ✅ fixed — Local fGroup() retired; now a thin adapter over C.filterGroup with dim/legend/options({value,label})/selected/idPrefix:'estate'/max:5. Change listener switched from input[data-dim]

### overlay-mobile-1 · M · mobile — Chart 'Vollbild' overlay renders the chart smaller than inline on phones

- **Portal:** css/app.css:2604-2607 — `.chart-overlay { padding:2rem }` + `.chart-overlay__box { padding:1.75rem 2rem }` have no <640px rule (≈128px lost at 320px viewport → ~192px content), and js/charts.js:463 clones the already-painted SVG (fixed viewBox width from the card) instead of repainting, so on a 320-390px phone the fullscreen chart and all its 12-13px labels scale DOWN below the inline size.
- **CD:** Portal standard js/charts.js:69-80 (Item 6.1): charts are drawn at 1 user-unit = 1 CSS px from the measured container width so labels never scale; .pf-lightbox and .docviewer, the sibling full-screen overlays, use the full viewport.
- **Fix:** Add `@media (max-width:639.98px){ .chart-overlay { padding:.5rem } .chart-overlay__box { padding:1rem } }` and, in openChartFullscreen, re-run renderSvg with the measured overlay-box width (the spec/result lookup already exists for paintCharts) instead of relying on the scaled clone.
- **Status:** ✅ fixed — Vollbild über Modal + Repaint auf gemessene Breite; enge Viewports entpolstert

### url-state-1 · M · consistency — Shareable-URL state drifts across the five sibling catalog explorers

- **Portal:** js/apps/portfolio.js:228 `history.replaceState(null,'', '#/app/portfolio?view='+state.view)` — drops q, facets and tree selection; js/apps/projects.js:211 identical; tenancies overview persists nothing; js/apps/document-archive.js:78-86 persists q+filters but not sort/page; js/apps/media-library.js:71-72 keeps everything in the hash via C.catalogueHash.
- **CD:** Internal standard js/components.js:1252-1271 (catalogueHash: «Zustand vollständig im URL-Hash … kurz und teilbar») — the model the dashboards also follow (dataportal.js:276-283 syncs tab+range).
- **Fix:** In portfolio.js, projects.js, tenancies.js (overview) and document-archive.js, serialize q, active filters, tree selection, sort and page into the hash on every renderMain (via C.catalogueHash or the existing history.replaceState calls) AND initialize state from those same query params on load (portfolio/projects/tenancies currently read only `view`; document-archive already parses q+filters at lines 42-46 and only needs sort/page added) — then a copied URL reproduces the visible result set, as media-library.js:64-72 demonstrates.
- **Status:** ✅ fixed — document-archive share only: syncHash() now also serializes sort (when not the 'title' default) and page (when > 1), keeping defaults out of the URL per the C.catalogueHash convent

### kv-compact-1 · L · naming — Lightbox metadata list uses undefined modifier .kv--compact

- **Portal:** js/gallery.js:116 — `<dl class="kv kv--compact" data-el="metakv">`; css/app.css defines only .kv--tight (3420) and .kv--stack (3119), so the 20rem dark side panel gets the full-size .kv grid (2rem column gap, fit-content(18rem) label track) instead of the intended compact form.
- **CD:** css/app.css:3420 `.kv--tight { gap:.2rem .75rem; font-size:var(--text-sm); }` — the existing compact variant used by the floorplan room panel.
- **Fix:** Rename the class in gallery.js to `kv kv--tight` (or add `.kv--compact` as an alias if the name is preferred).
- **Status:** ✅ fixed — Renamed the metadata list class from undefined kv--compact to the existing kv--tight (app.css:3523), giving the 20rem dark panel the intended compact grid.

### chart-fs-1 · L · pixel — Chart direct labels use off-scale 13px and literal #fff

- **Portal:** js/charts.js:196 (line endpoint label), 281/285 (bar labels/values) `font-size="13"`; 339 pie percentage `fill="#fff" font-size="13"` — 13px sits between the CD steps, and the fill bypasses the resolved --chart-surface token that every other mark stroke uses (charts.js:190).
- **CD:** css/tokens.css:142-143 — the CD scale has no 13px step (--fs-xs .75rem/12px, --fs-sm .875rem/14px); charts.js:75 itself states «CDs kleinste Stufe ist 0.75rem».
- **Fix:** Use 12 for secondary labels / 14 for emphasized value labels, and `fill="${SURFACE}"` (already resolved in each renderer) instead of #fff.
- **Status:** ✅ fixed — All off-scale 13px labels fixed: line endpoint label 13→14 (bold value), horizontal-bar category labels 13→12, bar value labels 13→14, pie percentage 13→14 and fill="#fff"→fill="${

### map-fs-1 · L · pixel — Map label typography off the CD scale (11px/13px)

- **Portal:** js/buildings-map.js:234 cluster count `'text-size': 13`; 240 bbl_id labels `'text-size': 11` — 11px is below the smallest CD step, 13px between steps.
- **CD:** css/tokens.css:142 — smallest CD step is --fs-xs 0.75rem (12px).
- **Fix:** Set both symbol layers to text-size 12 (cluster counts may take 14 if more weight is wanted).
- **Status:** ✅ fixed — Both symbol layers set to text-size 12 (cluster-count 13→12, point-labels 11→12), matching --fs-xs, with a German comment explaining the CD scale rationale.

### api-code-1 · L · pixel — .api-code frozen at 0.8125rem — a 13px size that exists nowhere in the scale

- **Portal:** css/app.css:2275 — `.api-code { … font-family:var(--font-mono); font-size:.8125rem; … }`.
- **CD:** css/tokens.css:142-145 — CD fontSize scale steps are 12/14/16…; no 13px step.
- **Fix:** Use `font-size:var(--fs-sm)` (14px, frozen deliberately for code) or var(--text-sm) if it should ride the ramp; add a German comment if 13px is kept deliberately.
- **Status:** ⬜ open

### dead-css-1 · L · naming — Dead app CSS: .dash-hero, .chart__sql, .map and a duplicated overlay rule

- **Portal:** css/app.css:2025-2032 (.dash-hero block), 2169-2175 (.chart__sql rules), 2000 (`.map { width:100%; height:420px; … }` — fixed height contradicting the clamp() philosophy documented at 2001-2004) have no consumer anywhere in js/ (verified by grep); css/app.css:2555 and 2560 declare `html:has(> body.chart-overlay-open) { overflow:hidden; }` twice with near-identical comments.
- **CD:** Portal convention (tokens.css preamble, design-review process): app.css rules exist only for live consumers; duplicates invite silent drift.
- **Fix:** Delete .dash-hero, .chart__sql, .map (also remove `.map` from the print hide-list at 3168) and one of the two duplicate :has rules.
- **Status:** ⬜ open

### list-pad-1 · L · consistency — Inline padding-left:1.1rem lists bypass .list--default (and use a different indent)

- **Portal:** js/apps/workspace.js:68 `<ul class="stack" style="padding-left:1.1rem; margin:0">` and js/apps/transaction.js:100 `<ul style="padding-left:1.1rem" class="small">` — 1.1rem vs the canonical 1.25rem.
- **CD:** css/app.css:134 — `.list--default { list-style:disc outside; padding-left:1.25rem; }` (used by pages/digitalisation.js:63, search.js:307).
- **Fix:** Replace the inline styles with `class="list--default small"` (add .stack alongside if the row rhythm is wanted).
- **Status:** ✅ fixed — transaction.js: <ul style="padding-left:1.1rem" class="small"> replaced with class="list--default small" (verified 20px/1.25rem indent live). workspace.js:68 is another cluster's s

### inline-style-1 · L · consistency — Leftover style= attributes where utilities/BEM classes already exist

- **Portal:** js/apps/dataportal.js:192 `<div class="field" style="margin:.9rem 0 0">` (utilities .mt-3/.mt-4 exist at app.css:3046); js/apps/media-library.js:330 `<div class="row mt-4" style="gap:.75rem">` — redundant, `.row` already sets gap:.75rem (app.css:2946); js/gallery.js:68 `<div style="min-width:0">` in the lightbox heading while the sibling viewer has a class for exactly this (`.docviewer__heading-text { min-width:0 }`, app.css:3197).
- **CD:** Portal convention css/app.css:3092-3093 — «Fünf verschiedene style="max-width:…" standen dafür in js/ — als Klassen sind sie benannt, wiederverwendbar und im Blatt auffindbar».
- **Fix:** Use .mt-4 in dataportal, drop the redundant gap in media-library, and add `.pf-lightbox__heading-text { min-width:0 }` mirroring the docviewer BEM.
- **Status:** ✅ fixed — dataportal.js field now class="field mt-4" (inline margin gone, 16px verified); media-library.js redundant style="gap:.75rem" dropped (.row already supplies gap:.75rem, verified 12

### pj-hero-1 · L · consistency — Project hero photo styled via inline aspect-ratio + max-height — the exact pattern the mosaic comment warns against

- **Portal:** js/apps/projects.js:454 — `style: 'aspect-ratio:21/9;max-height:22rem;border-radius:var(--radius-lg)'` passed into C.photo; it also drifts from the shared 16/10 hero ratio.
- **CD:** css/app.css:2670-2674 documents the bug class («max-height UND aspect-ratio auf demselben Element deckeln nicht nur die Höhe, sie rechnen auch die BREITE zurück»); shared ratios: .pf-mosaic__cell--main 16/10 (2629), .med-shot__photo 16/10 (2803).
- **Fix:** Add a `.pj-hero__photo { aspect-ratio:16/10 (or 21/9); border-radius:var(--radius-lg); }` rule (no max-height — cap via the container if needed) and pass `cls` instead of `style`.
- **Status:** ✅ fixed — JS side applied: C.photo now receives cls:'pj-hero__photo' instead of style:'aspect-ratio:21/9;max-height:22rem;border-radius:var(--radius-lg)'. The companion CSS rule lives in css

### tab-idiom-1 · L · consistency — Projects detail drifts from the shared detail-tab idiom (no .tabs wrapper, no panel headings)

- **Portal:** js/apps/projects.js:481-482 — `C.tabBar({ …, controlsClass:'mt-6' })` + `C.tabPanels({ … })` without `heading:true`; the Kennzahlen and Risiken panels have no h2 at all (heading structure jumps h1→content), and there is no `.tabs` wrapper.
- **CD:** Sibling standard: js/apps/portfolio.js:643-646, tenancies.js:812-815, media-library.js:363-366 all use `<div class="tabs mt-6">` + `heading:true` (components.js:751-760 renders the sr-only h2 per panel).
- **Fix:** Wrap in `<div class="tabs mt-6">` and pass heading:true to tabPanels in projects.js detail().
- **Status:** ✅ fixed — Detail tabs wrapped in <div class="tabs mt-6"> (controlsClass:'mt-6' removed from tabBar) and tabPanels gets heading:true, matching portfolio.js/tenancies.js/media-library.js; Kenn

### floors-chip-1 · L · a11y — Floor-switch chips are href="#" anchors acting as state toggles

- **Portal:** js/apps/tenancies.js:557 — `<a class="tag-item…" href="#" data-floor=…>` with click-preventDefault wiring (896-900); SRs announce a link whose target is '#', middle-click/copy-link is broken.
- **CD:** CD tag-item chips on the catalog pages are real links to filtered URLs; the floor table itself already builds the canonical href (tenancies.js:716 `?floor=<id>`).
- **Fix:** Give each chip the real `${links.mietverhaeltnis(id)}?floor=…` href (keep preventDefault wiring for the partial redraw) so fallback navigation and copy-link work; alternatively render <button class="tag-item">.
- **Status:** ✅ fixed — Floor chips now carry the canonical href links.mietverhaeltnis(id)?floor=<id> (same as the floor table builds); preventDefault wiring kept for the partial redraw, so middle-click/c

### fchev-1 · L · ux — Dashboard filter toggle chevron points left even for the mobile top-collapse

- **Portal:** js/apps/dataportal.js:184 and estate.js:311 use icon 'ChevronLeft'; css/app.css:2079 rotates it only for the DESKTOP rail collapse (.dashboard-layout--collapsed); under 1024px the collapse class is .filter-panel--collapsed (app.css:2064-2068) — no rotation rule, so a left-pointing chevron sits on a vertically collapsing panel.
- **CD:** Internal standard: the catbar filter toggle uses ChevronDown that flips on aria-expanded (js/components.js:1367, css/app.css:2359-2360).
- **Fix:** Add `@media (max-width:1023.98px){ .filter-panel--collapsed .filter-panel__toggle .icon { transform:rotate(-90deg); } .filter-panel__toggle .icon { transform:rotate(90deg); } }` (turning the left chevron into down/up), or switch the mobile icon to ChevronDown with the catbar rotation.
- **Status:** 🔶 partial — JS-Anteil umgesetzt; CSS-Rest: css/app.css: add the mobile rotation for the filter-panel toggle chevron (no estate.js change needed — icon stays 'ChevronLeft' so the deskt

### dash-dup-1 · L · consistency — Dashboard chrome duplicated verbatim between dataportal.js and estate.js

- **Portal:** js/apps/estate.js:36-42 (DASHBOARD_MENU), 152-155 (kpi tile markup), 356-389 (filter-collapse + menu wiring, comment «identisch zu dataportal.js») duplicate js/apps/dataportal.js:28-38, 163-177 and 302-342 line-for-line — two copies that can silently drift (the KPI delta arrow/sr-only affordance of dataportal.js:169-176 is already missing from estate's kpi()).
- **CD:** Portal convention: shared patterns live in factories (js/components.js), cf. the C.filterGroup consolidation note in portfolio.js:256-261.
- **Fix:** Extract a shared dashboard-chrome module (DASHBOARD_MENU, kpi() incl. delta arrow + sr-only word, filter-collapse wiring, dash-footer) consumed by both dashboards.
- **Status:** ✅ fixed — PARTIAL (same-file share only): estate's kpi() aligned verbatim to dataportal.js kpiTiles() anatomy — kpi__delta with is-good/is-bad modifier, kpi__arrow glyph (aria-hidden) plus s

### count-gram-1 · L · consistency — Result-count wording drifts across catalogs (nominative vs dative)

- **Portal:** js/apps/portfolio.js:213/221 «… von N Objekte», js/apps/projects.js:197/204 «… von N Projekte», js/apps/document-archive.js:94 «… von N Dokumente» vs js/apps/tenancies.js:201 «… von N Mietverhältnissen» (grammatically correct dative).
- **CD:** CD result header convention (search.postcss SEARCH RESULTS) uses one consistent phrase; internally C.mountDataTable emits «X von Y {unit}».
- **Fix:** Standardize the phrase (e.g. dative units «Objekten / Projekten / Dokumenten», or restructure to «N von M · Objekte») in all count templates.
- **Status:** ✅ fixed — Visible count now reads «N von M Dokumenten» (dative after «von», matching tenancies.js), and the new announceCatalogue call uses the same dative unit so the live-region announceme

### mt-dblmount-1 · L · consistency — Tenancies detail mounts every data table twice per draw — duplicate SR announcements

- **Portal:** js/apps/tenancies.js:819-820 — draw() calls mountTables() and then wireGrundriss(), and wireGrundriss() calls mountTables() again at line 871; each C.mountDataTable draw ends in a live-region announce (js/components.js:1500), so every page build/tab redraw fires two announcements per table (up to 6 on load).
- **CD:** Sibling standard js/apps/portfolio.js:652-655 mounts each table exactly once after render.
- **Fix:** Remove the mountTables() call from draw() (wireGrundriss already performs it), or guard mountTables against re-entry within one render pass.
- **Status:** ✅ fixed — Removed the mountTables() call from draw(); wireGrundriss() remains the single mount site, so each C.mountDataTable announces once per render pass. Comment explains why.

## Claims refuted in verification

The adversarial second pass rejected these first-pass findings — documented so they do not resurface:

- **[typography/focus-offset-1] Focus-ring offset drifts per component (1px / 3px) against the portal's own 2px recipe** — The quoted declarations exist (app.css:2141-2143 offset 1px; app.css:2483 offset 3px), but the claim fails on two counts. (1) The base comment the finding invokes explicitly SANCTIONS these rules: app.css:146-148 says a custom :focus-visible rule is needed by 'wer den Ring vorher abschaltet … oder wer einen anderen Versatz bzw. den Negativ-Ring braucht' — 'a different offset' is a listed legitimate reason, so the portal's own convention is not violated and demands no rationale comment. (2) Dele…
- **[buttons/form-1] Form actions center labels via context override instead of CD's btn__text-centered** — The premise that CD's API for form actions is btn--full-width + btn__text-centered is contradicted by CD's own sheet: the newsletter form button — CD's only real form-action styling — uses exactly the portal's contextual pattern: .newsletter__button { @apply w-full ... } with a nested .btn__text { @apply w-full text-center } and a responsive md:w-auto reversion (newsletter.postcss:34-44), not the static classes. The portal comment at app.css:1448-1452 explicitly cites newsletter.postcss:35-39 a…
- **[forms/inp-4] textarea line-height 1.5rem deviates from CD's leading-none — undocumented** — CD misresolved. Every portal textarea is rendered by C.field with class input--base hardcoded (components.js:1000), and CD's .input--base applies leading-6 = 1.5rem (input.postcss:29-31; Input.vue:135-136 adds `input--${size}`). So for equivalent markup, CD's EFFECTIVE textarea line-height is 1.5rem — the portal's `textarea { line-height:1.5rem }` (app.css:1492) matches CD, it does not deviate from it. Only a classless CD textarea gets leading-none (input.postcss:6-15), a case the portal never …

---
_Generated 2026-07-30 from the verified finding set (26 review agents across 13 areas, plus a 56-screenshot visual sweep). Line numbers refer to the repo state before the fix wave; the status line records what has been adjusted since._
