# CD-Bund-Referenz — Design System der Schweizerischen Eidgenossenschaft

Prüfbare Referenz für das Design Review des BBL Kundenportals. Extrahiert aus dem
lokalen Design-System-Repo (`C:\Users\david\Documents\GitHub\designsystem`,
Version 1.0.5 — identisch mit github.com/swiss/designsystem main und mit der vom
Portal referenzierten Version). Stand: 2026-08-05.

Alle späteren Befunde des Reviews referenzieren dieses Dokument. Quellenangaben
verweisen auf Dateien des Design-System-Repos (css/… = PostCSS-Quelle,
app/components/… = Vue-Referenzstruktur).

## CD Bund Design System — Token-Referenz (Messlatte)

Quelle: `C:\Users\david\Documents\GitHub\designsystem`, Version **1.0.5** (`package.json`: "Design System for the Swiss Confederation").
Build: Tailwind CSS ^3.4.14 über PostCSS (`postcss.config.js` → Tailwind-Config `./app/tailwind.config.js`).
WICHTIG: In `app/tailwind.config.js` sind `screens`, `container`, `scale`, `colors`, `fontWeight`, `fontSize`, `fontFamily`, `boxShadow`, `borderRadius`, `listStyleType` auf **Top-Level von `theme`** definiert — sie ERSETZEN die Tailwind-Defaults vollständig. Alles nicht Aufgeführte (Spacing, lineHeight, letterSpacing, borderWidth, zIndex, transition*, ring*) bleibt Tailwind-3.4-Default. Einzige `extend`-Ergänzung: `animation.spin-fast`.

---

### 1. Token-Namensschema

| Ebene | Schema | Beispiel | Quelle |
|---|---|---|---|
| CSS-Variablen (Farben) | `--color-{primary\|secondary}-{50…900}` | `--color-primary-600` | `css/skins/*.postcss` |
| Skin-Scope | `:root` (Default), `.body--intranet`, `.body--freebrand` | `.body--intranet { --color-primary-600: #2563eb }` | `css/skins/default.postcss`, `intranet.postcss`, `freebrand.postcss` |
| Tailwind-Utilities | Standard-Tailwind (`text-primary-600`, `bg-secondary-50`, `mt-12`) | `@apply text-text-800` | `app/tailwind.config.js` |
| Foundation-Klassen | `{kategorie}--{variante}` (Doppel-Bindestrich) | `.text--base`, `.font--bold`, `.bg--secondary-900`, `.color--primary-600`, `.icon--md` | `css/foundations/*.postcss` |
| Komponenten | BEM-artig `.block`, `.block__element`, `.block--modifier` | `.container__aside`, `.container--py-half` | `css/components/*`, `css/layouts/*` |

Die Farb-Aliase `primary`/`secondary` im Tailwind-Theme zeigen auf die CSS-Variablen (skin-abhängig); alle übrigen Paletten sind fixe Hex-Werte (`app/tailwind.config.js`, Zeilen 37–199).

---

### 2. Farben

#### 2.1 Primary — Default-Skin (Rot) (`css/skins/default.postcss`, `:root`)

| Stufe | Hex |
|---|---|
| primary-50 | #ffedee |
| primary-100 | #fae1e2 |
| primary-200 | #ffccce |
| primary-300 | #fa9da1 |
| primary-400 | #fc656b |
| primary-500 | #e53940 |
| primary-600 | #d8232a |
| primary-700 | #bf1f25 |
| primary-800 | #99191e |
| primary-900 | #801519 |

Identisch mit der fixen Palette `red` in `app/tailwind.config.js` (Z. 148–159).

#### 2.2 Secondary — Default-Skin (Blaugrau) (`css/skins/default.postcss`)

| Stufe | Hex |
|---|---|
| secondary-50 | #f0f4f7 |
| secondary-100 | #dfe4e9 |
| secondary-200 | #acb4bd |
| secondary-300 | #828e9a |
| secondary-400 | #596978 |
| secondary-500 | #46596b |
| secondary-600 | #2f4356 |
| secondary-700 | #263645 |
| secondary-800 | #1c2834 |
| secondary-900 | #131b22 |

#### 2.3 Intranet-Skin (`css/skins/intranet.postcss`, Scope `.body--intranet`)

| Stufe | primary (Blau) | secondary |
|---|---|---|
| 50 | #eff6ff | #f0f4f7 (grau) |
| 100 | #dbeafe | #dfe4e9 (grau) |
| 200 | #bfdbfe | #acb4bd (grau) |
| 300 | #93c5fd | #828e9a (grau) |
| 400 | #60a5fa | #5076b3 (blau) |
| 500 | #3b82f6 | #234dc2 (blau) |
| 600 | #2563eb | #1e40af (blau) |
| 700 | #1d4ed8 | #1e3a8a (blau) |
| 800 | #1e40af | #1c3c7d (blau) |
| 900 | #1e3a8a | #1c3c7d (blau) |

Intranet-primary ist identisch mit der fixen Palette `blue`. Zusatz: `.logo__title::after` / `.logo__accronym::after` erhalten Badge «Intranet» (`badge badge--blue mt-1 -ml-[1px]`).

#### 2.4 Freebrand-Skin (Grün) (`css/skins/freebrand.postcss`, Scope `.body--freebrand`)

| Stufe | primary | secondary |
|---|---|---|
| 50 | #eaffe9 | #efffee |
| 100 | #d3ebd2 | #b0beb0 |
| 200 | #bdd8bc | #768176 |
| 300 | #a7c4a6 | #404941 |
| 400 | #91b191 | #758874 |
| 500 | #7c9f7c | #6a7f69 |
| 600 | #678d67 | #5f755f |
| 700 | #537b54 | #546c55 |
| 800 | #3e6940 | #49634b |
| 900 | #2a582e | #3e5a41 |

#### 2.5 Fixe Paletten (`app/tailwind.config.js`, `theme.colors`)

`text` und `gray` sind wertgleich (Tailwind-Gray).

| Stufe | text / gray | blue | green | indigo | orange | pink | purple | red | teal | yellow |
|---|---|---|---|---|---|---|---|---|---|---|
| 50 | #f9fafb | #eff6ff | #ecfdf5 | #eef2ff | #fff7ed | #fdf2f8 | #f5f3ff | #ffedee | #f2fdfc | #fffbeb |
| 100 | #f3f4f6 | #dbeafe | #d1fae5 | #e0e7ff | #ffedd5 | #fce7f3 | #ede9fe | #fae1e2 | #cbfbf8 | #fef3c7 |
| 200 | #e5e7eb | #bfdbfe | #a7f3d0 | #c7d2fe | #fed7aa | #fbcfe8 | #ddd6fe | #ffccce | #98f6f3 | #fde68a |
| 300 | #d1d5db | #93c5fd | #6ee7b7 | #a5b4fc | #fdba74 | #f9a8d4 | #c4b5fd | #fa9da1 | #5de8ea | #fcd34d |
| 400 | #9ca3af | #60a5fa | #34d399 | #818cf8 | #fb923c | #f472b6 | #a78bfa | #fc656b | #2bced4 | #fbbf24 |
| 500 | #6b7280 | #3b82f6 | #10b981 | #6366f1 | #f97316 | #ec4899 | #8655F6 | #e53940 | #14afb8 | #f59e0b |
| 600 | #4b5563 | #2563eb | #059669 | #4f46e5 | #ea580c | #db2777 | #7c3aed | #d8232a | #0d8b96 | #d97706 |
| 700 | #374151 | #1d4ed8 | #047857 | #4338ca | #c2410c | #be185d | #6d28d9 | #bf1f25 | #0f6b75 | #b45309 |
| 800 | #1f2937 | #1e40af | #065f46 | #3730a3 | #9a3412 | #9d174d | #5b21b6 | #99191e | #11575f | #92400e |
| 900 | #111827 | #1e3a8a | #064e3b | #312e81 | #7c2d12 | #831843 | #4c1d95 | #801519 | #13474e | #78350f |

Zusätzlich: `white: #ffffff`, `black: #000000`, `transparent`, `current: currentColor`, `inherit`.

#### 2.6 Semantische Text-/Hintergrund-Klassen

`css/foundations/colors.postcss`:

| Klasse | Auflösung | Hex (Default-Skin) |
|---|---|---|
| .color--default | text-text-800 | #1f2937 |
| .color--light | text-text-500 | #6b7280 |
| .color--negative | text-white | #ffffff |
| .color--link | text-primary-600 | #d8232a |
| .color--white / .color--black | text-white / text-black | #ffffff / #000000 |
| .color--text-{50…900} | text-text-{n} | s. Palette text |
| .color--primary-{50…900} | text-primary-{n} | s. Palette primary |

`css/foundations/backgrounds.postcss`: `.bg--white` (`bg-white`) und `.bg--secondary-{50…900}` (`bg-secondary-{n}`) — keine weiteren bg-Foundation-Klassen.

#### 2.7 Fokus-Ring (global) (`css/foundations/global.postcss`, Z. 75–86)

| Kontext | Wert |
|---|---|
| `*:focus-visible` | `outline-none ring-2 ring-purple-500 z-10` → 2px-Ring #8655F6 (box-shadow), z-index 10 |
| in `.top-bar`, `.bg--secondary-{500…900}` | `ring-purple-300` → #c4b5fd |

---

### 3. Typografie

#### 3.1 Font-Face (`css/foundations/font-face.postcss`)

| font-family | Datei / Quelle | font-style | font-display |
|---|---|---|---|
| Font-Regular | `./fonts/NotoSans-Regular.ttf` (truetype) | normal | swap |
| Font-Bold | `./fonts/NotoSans-Bold.ttf` (truetype) | normal | swap |
| Font-Italic | `./fonts/NotoSans-Italic.ttf` (truetype) | italic | swap |
| Font-Bold-Italic | `./fonts/NotoSans-BoldItalic.ttf` (truetype) | italic | swap |
| Fallback-font | `local(Verdana)` | — | — |

Fallback-Metrik-Overrides: `advance-override: 125%`, `ascent-override: 95%`, `descent-override: -25%`, `line-gap-override: 25%`. Fontdateien lokal unter `css/foundations/fonts/` (Noto Sans).

#### 3.2 Font-Familien-Tokens (`app/tailwind.config.js`, `theme.fontFamily`)

| Token / Klasse | Stack |
|---|---|
| font-regular (`.font--regular`, `.text--regular`) | 'Font-Regular', Hind, 'Fallback-font', Sans-Serif |
| font-italic (`.font--italic`, `.text--italic`) | 'Font-Italic', Hind, 'Fallback-font' |
| font-bold (`.font--bold`, `.text--bold`) | 'Font-Bold', Hind, 'Fallback-font' |
| font-bold-italic (`.font--bold-italic`, `.text--bold-italic`) | 'Font-Bold-Italic', Hind, 'Fallback-font' |

#### 3.3 Font-Gewichte (`app/tailwind.config.js`, `theme.fontWeight`)

| Token | Wert |
|---|---|
| font-normal | 400 |
| font-bold | **400** |

Fett wird NICHT über `font-weight` erzeugt, sondern über die eigene Familie `Font-Bold` (Klassen `.font--bold`/`font-bold` in Kombination). `strong, b { @apply font-bold }`, `em, i { @apply font-italic }`, verschachtelt `font--bold-italic` (`css/foundations/typography.postcss`, Z. 143–169).

#### 3.4 Grössenskala (`app/tailwind.config.js`, `theme.fontSize` — ersetzt Tailwind-Default)

| Token | rem | px |
|---|---|---|
| text-xs | 0.75rem | 12px |
| text-sm | 0.875rem | 14px |
| text-base | 1rem | 16px |
| text-lg | 1.125rem | 18px |
| text-xl | 1.25rem | 20px |
| text-2xl | 1.375rem | 22px |
| text-3xl | 1.625rem | 26px |
| text-4xl | 2rem | 32px |
| text-5xl | 2.5rem | 40px |
| text-6xl | 3rem | 48px |
| text-7xl | 3.5rem | 56px |
| text-8xl | 4rem | 64px |
| text-9xl | 5rem | 80px |

Werte sind reine Strings — die `text-*`-Klassen setzen NUR `font-size`, KEINE line-height (anders als Tailwind-Default).

#### 3.5 Responsive Textklassen (`css/foundations/typography.postcss`)

Berechnete font-size in px pro Viewport (Breakpoints s. Abschnitt 4):

| Klasse | base | ≥1024 (lg) | ≥1280 (xl) | ≥1920 (3xl) | line-height |
|---|---|---|---|---|---|
| .text--xs | 12 | 12 | 14 | 16 | geerbt (1.5) |
| .text--sm | 14 | 14 | 16 | 18 | geerbt (1.5) |
| .text--base | 16 | 16 | 18 | 20 | geerbt (1.5) |
| .text--lg | 18 | 18 | 20 | 22 | geerbt (1.5) |
| .text--xl | 20 | 22 | 26 | 32 | leading-tight (1.25) |
| .text--2xl | 22 | 26 | 32 | 40 | leading-tight (1.25) |
| .text--3xl | 26 | 32 | 40 | 48 | leading-tight (1.25) |
| .text--4xl | 32 | 40 | 48 | 56 | leading-tight (1.25) |
| .text--5xl | 40 | 48 | 56 | 64 | leading-tight (1.25) |

Quelltext exakt, z. B.: `.text--3xl { @apply text-3xl lg:text-4xl xl:text-5xl 3xl:text-6xl; @apply leading-tight; }`.

#### 3.6 Body-Grundzustand (`css/foundations/typography.postcss`, Z. 4–16)

| Eigenschaft | Wert |
|---|---|
| html word-spacing | 0.0625em |
| html font-smoothing | `-moz-osx-font-smoothing: grayscale; -webkit-font-smoothing: antialiased` |
| html text-size-adjust | 100% (ms + webkit) |
| body | `.text--base` (16→18→20px) + `.font--regular` + `text-text-800` (#1f2937) |
| line-height Basis | 1.5 (Tailwind-Preflight, nicht überschrieben) |

#### 3.7 Überschriften & Textbausteine (`css/foundations/typography.postcss`)

| Klasse | Definition | berechnete font-size (base/lg/xl/3xl) |
|---|---|---|
| .h1 | `text--3xl font-bold; mb-4` (16px) | 26/32/40/48px |
| .h2 | `text--2xl font-bold; mb-4` | 22/26/32/40px |
| .h3 | `text--xl font-bold; mb-4` | 20/22/26/32px |
| .h4 | `text--lg font-bold; mb-4` | 18/18/20/22px |
| .h5 | `text--base font-bold; mb-4` | 16/16/18/20px |
| .overtitle | `flex space-x-2; text-secondary-100; text-xs` | 12px, #dfe4e9 (Default-Skin) |
| .legend, figcaption | `text--xs pt-2 text-text-500` | 12/12/14/16px, #6b7280, padding-top 8px |
| .text--negative | text-white | — |
| .text--default | text-text-800 (#1f2937) | — |
| .text--light | text-text-500 (#6b7280) | — |
| mark | `bg-primary-200 py-0.5 px-1` | #ffccce, Padding 2px 4px |
| u | `underline underline-offset-2` | Offset 2px |
| .text--asterisk::after | `content-['\202F*']` (schmales geschütztes Leerzeichen + *) | — |

#### 3.8 Letter-Spacing

Keine eigene Skala — Tailwind-Default gilt: tighter −0.05em, tight −0.025em, normal 0, wide 0.025em, wider 0.05em, widest 0.1em. Einzige Verwendung im DS: `tracking-tighter` (−0.05em) in `css/components/date.postcss` (Z. 14).

---

### 4. Breakpoints & Container (`app/tailwind.config.js`, `theme.screens` / `theme.container`)

| Breakpoint | min-width |
|---|---|
| xs | 480px |
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| 2xl | 1544px |
| 3xl | 1920px |

Container (Tailwind-Core-Plugin `container` DEAKTIVIERT — `corePlugins.container: false`; eigene Klasse in `css/layouts/container.postcss`):

| Eigenschaft | Wert |
|---|---|
| max-width ab 2xl (1544px) | 1544px (`theme('container.2xl')`) |
| max-width ab 3xl (1920px) | 1676px (`theme('container.3xl')`) |
| Padding horizontal | `px-4 xs:px-7 sm:px-9 lg:px-10 xl:px-12 3xl:px-16` → 16 / 28 / 36 / 40 / 48 / 64 px |
| overflow-x | clip |
| .container--py | `py-14 lg:py-20 3xl:py-32` → 56 / 80 / 128 px |
| .container--py-half | `py-7 lg:py-10 3xl:py-16` → 28 / 40 / 64 px |
| .container + .container (nicht Breadcrumb) | `pt-14 lg:pt-20 3xl:pt-32` → 56 / 80 / 128 px |
| Grid | `.container--grid`: `grid grid-cols-12` |

---

### 5. Spacing-Skala

Tailwind-3.4-Default, NICHT überschrieben (`app/tailwind.config.js` definiert kein `spacing`). Raster 1 Einheit = 0.25rem = 4px:

| Token | rem | px | | Token | rem | px |
|---|---|---|---|---|---|---|
| 0 | 0 | 0 | | 10 | 2.5rem | 40 |
| px | — | 1 | | 11 | 2.75rem | 44 |
| 0.5 | 0.125rem | 2 | | 12 | 3rem | 48 |
| 1 | 0.25rem | 4 | | 14 | 3.5rem | 56 |
| 1.5 | 0.375rem | 6 | | 16 | 4rem | 64 |
| 2 | 0.5rem | 8 | | 20 | 5rem | 80 |
| 2.5 | 0.625rem | 10 | | 24 | 6rem | 96 |
| 3 | 0.75rem | 12 | | 28 | 7rem | 112 |
| 3.5 | 0.875rem | 14 | | 32 | 8rem | 128 |
| 4 | 1rem | 16 | | 36 | 9rem | 144 |
| 5 | 1.25rem | 20 | | 40 | 10rem | 160 |
| 6 | 1.5rem | 24 | | 48 | 12rem | 192 |
| 7 | 1.75rem | 28 | | 56 | 14rem | 224 |
| 8 | 2rem | 32 | | 64 | 16rem | 256 |
| 9 | 2.25rem | 36 | | 72–96 | 18–24rem | 288–384 |

#### Vertikaler Rhythmus (`css/foundations/spacings.postcss`)

| Selektor | Wert |
|---|---|
| `.vertical-spacing > *` | `mt-12 2xl:mt-14` → margin-top 48px, ab 1544px 56px; `:first-child` mt-0 |
| `> :is(h1…h5)` | `mb-0`; folgendes Element `mt-[1.5em]`; folgender Absatz `mt-[1em]` |
| `p + p`, `p + ul/ol/[identifier='list']`, `ul/ol + p` | `mt-[1em]` |

---

### 6. Radien (`app/tailwind.config.js`, `theme.borderRadius` — ersetzt Tailwind-Default)

| Token | rem | px |
|---|---|---|
| rounded-none | 0 | 0 |
| rounded-xs | 0.0625rem | 1px |
| rounded-sm | 0.125rem | 2px |
| rounded (DEFAULT) | 0.1875rem | 3px |
| rounded-lg | 0.3125rem | 5px |
| rounded-xl | 0.375rem | 6px |
| rounded-2xl | 0.5rem | 8px |
| rounded-3xl | 0.625rem | 10px |
| rounded-4xl | 0.75rem | 12px |
| rounded-5xl | 0.9375rem | 15px |
| rounded-6xl | 1.5rem | 24px |
| rounded-full | 9999px | — |

Achtung: `rounded-md` existiert NICHT (Skala ersetzt den Default).

---

### 7. Schatten (`app/tailwind.config.js`, `theme.boxShadow`)

| Token | Wert (exakt) |
|---|---|
| shadow-sm | `0px 1px 2px 0px rgba(0,0,0,0.05)` |
| shadow (DEFAULT) | `0px 1px 2px 0px rgba(0,0,0,0.06), 0px 1px 5px 0px rgba(0,0,0,0.08)` |
| shadow-md | `0px 2px 4px -1px rgba(0,0,0,0.06), 0px 4px 10px -1px rgba(0,0,0,0.08)` |
| shadow-lg | `0px 2px 6px -1px rgba(0,0,0,0.06), 0px 5px 20px -3px rgba(0,0,0,0.08)` |
| shadow-xl | `0px 6px 10px -5px rgba(0,0,0,0.06), 0px 15px 25px -3px rgba(0,0,0,0.09)` |
| shadow-2xl | `0px 10px 20px 0px rgba(0,0,0,0.06), 1px 10px 70px -8px rgba(0,0,0,0.13)` |
| shadow-none | `0px 0px 0px 0px rgba(0,0,0,0)` |

---

### 8. Border-Breiten

Tailwind-Default, nicht überschrieben:

| Token | px |
|---|---|
| border-0 | 0 |
| border (DEFAULT) | 1px |
| border-2 | 2px |
| border-4 | 4px |
| border-8 | 8px |

Ring-Breiten ebenfalls Default (ring = 3px, ring-2 = 2px — der globale Fokus-Ring nutzt `ring-2` = 2px).

---

### 9. Z-Index-Ebenen

Skala = Tailwind-Default (0, 10, 20, 30, 40, 50, auto; nicht überschrieben). Vergebene Ebenen:

| Ebene | Verwendung | Quelle |
|---|---|---|
| z-0 | `#main-footer` | `css/foundations/global.postcss` |
| z-10 | `#main-content`; `*:focus-visible` | `css/foundations/global.postcss` |
| z-20 | Breadcrumb, Carousel-Navigation, Badge-Filter | `css/sections/breadcrumb.postcss` u. a. |
| z-30 | `#main-header`; Modal-Inhalt; Popover; Suche | `css/foundations/global.postcss`, `css/components/modal.postcss` |
| z-40 | Modal-Backdrop/-Wrapper; Desktop-Menü; Navy-Navigation | `css/components/modal.postcss`, `css/sections/desktop-menu.postcss` |
| z-50 | `.skip-to-content`; Toast; Notification-Banner; Mobile-Menü; Hauptnavigation | `css/foundations/global.postcss`, `css/components/toast-message.postcss` |

---

### 10. Übergänge & Animationen

| Token | Wert | Quelle |
|---|---|---|
| animate-spin-fast | `spin 0.5s linear infinite` | `app/tailwind.config.js`, `theme.extend.animation` |
| transition-Timing (Default) | `cubic-bezier(0.4, 0, 0.2, 1)`, Dauer 150ms | Tailwind-Default (nicht überschrieben) |
| body | `transition-transform duration-700` → 700ms (Mobile-Menü-Slide) | `css/foundations/global.postcss`, Z. 31 |
| `.body--mobile-menu-is-open` | `height: calc(100vh + 3rem); transform: translateY(-3em)` | `css/foundations/global.postcss` |
| gebräuchliche Dauern im DS | 150ms (burger), 200ms (btn, accordion, carousel), 300ms (card, desktop-menu, breadcrumb, popover), 600ms (mobile-menu transform, navy), 700ms (body, logo, mobile-menu) | grep über `css/**` |
| .icon--spin | `animate-spin-fast` | `css/foundations/icons.postcss` |
| scale-102 | `1.02` (Zusatz zur Default-Skala) | `app/tailwind.config.js`, `theme.scale` |

---

### 11. Icon-Grössen (`css/foundations/icons.postcss`)

Basis: `.icon { @apply w-auto fill-current flex-shrink-0; stroke-width: 0.3px }`, `path, circle { fill-current }`.

| Klasse | Höhe base | ≥768 (md) | ≥1024 (lg) |
|---|---|---|---|
| .icon--sm | h-3 = 12px | — | — |
| .icon--base | h-4 = 16px | — | — |
| .icon--md | h-5 = 20px | h-6 = 24px | — |
| .icon--lg | h-6 = 24px | h-7 = 28px | — |
| .icon--xl | h-7 = 28px | h-8 = 32px | h-9 = 36px |
| .icon--2xl | h-9 = 36px | h-10 = 40px | h-12 = 48px |
| .icon--3xl | h-12 = 48px | h-16 = 64px | h-20 = 80px |
| .icon--4xl | h-20 = 80px | h-24 = 96px | h-28 = 112px |
| .icon--5xl | h-28 = 112px | h-32 = 128px | h-36 = 144px |
| .icon--full | w-full | — | — |

---

### 12. Weitere Theme-Tokens

| Kategorie | Werte | Quelle |
|---|---|---|
| listStyleType | none, disc, decimal, square, roman = `upper-roman` | `app/tailwind.config.js` |
| line-height-Skala | Tailwind-Default: leading-none 1, tight 1.25, snug 1.375, normal 1.5, relaxed 1.625, loose 2; leading-3…10 = 0.75–2.5rem | Default (nicht überschrieben) |
| `.skip-to-content` | `inline-block px-4 py-2` (16px/8px), `absolute z-50 top-0 left-1/2`, `bg-secondary-900 text-white border-white border-2`, `shadow-md`, `transform: translateX(-50%) translateY(-200%)`, bei `:focus` `translateY(0)` | `css/foundations/global.postcss` |
| Anker-Scroll | `[id] { scroll-mt-8 }` → scroll-margin-top 32px | `css/foundations/global.postcss` |
| html | `h-full`, `-webkit-fill-available`, `overflow-y-scroll`, `font-regular` | `css/foundations/global.postcss` |

## CD Bund Design System — Layout-Referenz (v1.0.5)

Quellenbasis: `C:\Users\david\Documents\GitHub\designsystem` (Version 1.0.5 gemäss `package.json`).
Die CSS-Pipeline (`postcss.config.js`) baut `css/main.postcss` mit Tailwind-Config `app/tailwind.config.js`. Spacing-Skala ist NICHT überschrieben → Tailwind-Default (1 Einheit = 0.25rem; Root-Font-Size 16px, in `css/foundations/global.postcss` nicht verändert). Alle px-Werte gegen `dist/main.css` verifiziert.

### 1. Breakpoints (`app/tailwind.config.js`, `theme.screens`)

| Name | min-width | rem (÷16) |
|---|---|---|
| xs | 480px | 30rem |
| sm | 640px | 40rem |
| md | 768px | 48rem |
| lg | 1024px | 64rem |
| xl | 1280px | 80rem |
| 2xl | 1544px | 96.5rem |
| 3xl | 1920px | 120rem |

Alle Media Queries sind `min-width` (mobile-first). Tailwind-Core-Plugin `container` ist deaktiviert (`corePlugins: { container: false }`) — `.container` ist eine Eigendefinition in `css/layouts/container.postcss`.

### 2. Container (`css/layouts/container.postcss`)

#### 2.1 Grundregel `.container`

`width: 100%; margin-left/right: auto; overflow-x: clip` plus horizontales Padding (= Seitenmargin des Inhalts):

| Breakpoint | Tailwind-Klasse | Padding links/rechts |
|---|---|---|
| Basis (<480px) | `px-4` | 16px / 1rem |
| xs ≥480px | `xs:px-7` | 28px / 1.75rem |
| sm ≥640px | `sm:px-9` | 36px / 2.25rem |
| md ≥768px | — (erbt sm) | 36px / 2.25rem |
| lg ≥1024px | `lg:px-10` | 40px / 2.5rem |
| xl ≥1280px | `xl:px-12` | 48px / 3rem |
| 2xl ≥1544px | — (erbt xl) | 48px / 3rem |
| 3xl ≥1920px | `3xl:px-16` | 64px / 4rem |

#### 2.2 Max-Breiten (`theme.container` in `app/tailwind.config.js`)

| Breakpoint | max-width |
|---|---|
| < 1544px | keine (fluid, 100%) |
| 2xl ≥1544px | 1544px (96.5rem) |
| 3xl ≥1920px | 1676px (104.75rem) |

Netto-Inhaltsbreite bei 2xl: 1544 − 2·48 = 1448px; bei 3xl: 1676 − 2·64 = 1548px.

#### 2.3 Abstand aufeinanderfolgender Container

`.container:not(.breadcrumb) + .container` → `pt-14 lg:pt-20 3xl:pt-32`:

| Breakpoint | padding-top |
|---|---|
| Basis | 56px / 3.5rem |
| lg ≥1024px | 80px / 5rem |
| 3xl ≥1920px | 128px / 8rem |

#### 2.4 Vertikale Padding-Modifier

| Klasse | Basis | lg ≥1024px | 3xl ≥1920px |
|---|---|---|---|
| `.container--py` (py) | 56px | 80px | 128px |
| `.container--py-half` (py) | 28px | 40px | 64px |
| `.container--pt` (nur pt, pb=0) | 56px | 80px | 128px |
| `.container--pb` (nur pb, pt=0) | 56px | 80px | 128px |
| `.container--pb-half` (nur pb) | 28px | 40px | 64px |

`.container--flex` → `display:flex; justify-content:space-between`.

#### 2.5 Container-Grid-Slots (12-Spalten)

`.container--grid` → `display:grid; grid-template-columns: repeat(12, minmax(0,1fr))`; `.container--grid + .container--grid` → `gap--top` (siehe 3.2).

| Klasse | Basis | md ≥768px | lg ≥1024px | xl ≥1280px |
|---|---|---|---|---|
| `.container__full` | span 12 | — | — | — |
| `.container__center--xs` | span 12 | span 10, start 2 | span 8, start 3 | span 6, start 4 |
| `.container__center--sm` | span 12 | span 10, start 2 | — | span 8, start 3 |
| `.container__center--md` | span 12 | — | — | start 2 / end 12 (10 Spalten) |
| `.container__main` | span 12 | span 7 | span 6, start 2 | — |
| `.container__aside` | span 12 | span 5, start 8 | span 4 | — |

- `.container__aside > *` und `.container__aside .sticky > *`: `mb-7 lg:mb-8` → 28px, ab lg 32px.
- `.container__mobile`: `md:hidden`; Kinder `mb-7` → 28px.
- `.container--reverse .container__main`: `md:col-start-6`, Order 1→md:2; `.container--reverse .container__aside`: `md:col-start-1`, `lg:col-start-2`, md:order-1.
- `.container--reverse-mobile`: tauscht Order nur mobil (main order-2, aside order-1 unter md).

#### 2.6 Utility `.broader-than-container`

Negative Seitenmargins + kompensierendes Padding via `--side-margin`:

| Breakpoint | `--side-margin` | berechnet |
|---|---|---|
| Basis | `calc(theme('spacing.4') * -1)` | −16px |
| xs ≥480px | `calc(theme('spacing.7') * -1)` | −28px |
| sm ≥640px | `calc((100vw - 6em) / -12)` | fluid |
| xl ≥1280px | `calc((1280px - 6em) / -12)` | −98.67px (6em = 96px) |
| 2xl ≥1544px | `calc((1544px - 6em) / -12)` | −120.67px |

### 3. Grid und Gutter (`css/layouts/grids.postcss`)

#### 3.1 Spalten

- Hauptraster: 12 Spalten (`.container--grid`, `grid-cols-12`; Bereichs-Grids nutzen `repeat(12, minmax(0,1fr))`).
- `.grid` selbst = Tailwind-Default (`display:grid`), ohne eigenen Gap.
- `.grid--responsive-cols-1` → `md:grid-cols-1`; `-2` → `md:grid-cols-2`; `-3` → `md:grid-cols-2 lg:grid-cols-3`; `-4` → `md:grid-cols-2 lg:grid-cols-4`.

#### 3.2 Gutter (responsive Gap-Skala)

`.gap--responsive` → `gap-5 xs:gap-7 sm:gap-9 lg:gap-10 xl:gap-12 3xl:gap-16`:

| Breakpoint | Gap |
|---|---|
| Basis (<480px) | 20px / 1.25rem |
| xs ≥480px | 28px / 1.75rem |
| sm ≥640px | 36px / 2.25rem |
| lg ≥1024px | 40px / 2.5rem |
| xl ≥1280px | 48px / 3rem |
| 3xl ≥1920px | 64px / 4rem |

Identische Skala als Padding: `.gap--top` (padding-top), `.gap--bottom` (padding-bottom). Identische Skala als Margin: `.grid + .grid` → `mt-5 xs:mt-7 sm:mt-9 lg:mt-10 xl:mt-12 3xl:mt-16` (20/28/36/40/48/64px).

#### 3.3 Verhältnis-Grids (ab md ≥768px, per `grid-template-areas`)

| Klasse | md ≥768px | lg ≥1024px | in `container__center--md` ab xl | in `--sm` ab xl | in `--xs` ab xl |
|---|---|---|---|---|---|
| `.grid--responsive-cols-1/2-1/2` | `1fr 1fr` | — | — | — | — |
| `.grid--responsive-cols-1/4-3/4` | 12 Sp.: `A A A B B B B B B B B B` (3/9) | — | 10 Sp.: `A A B…` (2/8) | 8 Sp.: `A A B…` (2/6) | 6 Sp.: `A A B…` (2/4) |
| `.grid--responsive-cols-3/4-1/4` | 12 Sp.: `A×9 B×3` | — | 10 Sp.: `A×8 B×2` | — | — |
| `.grid--responsive-cols-1/3-2/3` | 12 Sp.: `A×6 B×6` | `A×4 B×8` | 10 Sp.: `A×3 B×7` | — | — |
| `.grid--responsive-cols-2/3-1/3` | 12 Sp.: `A×6 B×6` | `A×8 B×4` | 10 Sp.: `A×7 B×3` | — | — |

`.grid--reverse`: tauscht ab md die Areas A/B (bzw. bei 4-Kind-Grids Order 4-3-2-1).

#### 3.4 Item-abhängige Grids

| Klasse | Verhalten |
|---|---|
| `.grid--items-1` | `md:grid-cols-1` |
| `.grid--items-2` | `md:grid-cols-2` |
| `.grid--items-3` | `md:grid-cols-2`; Kind 1 `col-span-2`, übrige `col-span-2 md:col-span-1` |
| `.grid--items-4` | `md:grid-cols-3`; Kind 1 `col-span-3`, übrige `col-span-3 md:col-span-1` |
| `.grid--items-5` | `md:grid-cols-12`; Kinder 1–2 `col-span-6`, übrige `col-span-6 lg:col-span-4` |

### 4. Section-Abstände (`css/layouts/section.postcss`)

- `.section` → `width:100%`.
- `.section--default`, `.section[class^='bg--']`, `.section[class*=' bg--']`, `.section--py` → `container--py` = py 56px / lg 80px / 3xl 128px.
- `.section--py-half` → `container--py-half` = py 28px / lg 40px / 3xl 64px.
- Kollabier-Regel (aufeinanderfolgende Sections mit gleichem Hintergrund verlieren das padding-top, nur noch `container--pb`): gilt für `.hero + .section--default`, `.hero + .section--py`, `.hero + .bg--white`, `.section--default + .section--default`, `.section--default + .section--py` (und umgekehrt), `.section--py-half`-Kombinationen, `.bg--white + .bg--white` sowie jede gleiche Paarung `.bg--secondary-50…900 + .bg--secondary-50…900`.
- `.section__title`: `text--bold text--2xl`, `pb-10` = 40px / 2.5rem.
- `.section__subtitle`: `text--bold text--lg`, `pb-10` = 40px; nach einem Grid (`.grid + .section__subtitle`): `pt-12 lg:pt-16 3xl:pt-20` = 48 / 64 / 80px.
- `.section__action`: `display:flex; justify-content:flex-end`, `pt-4` = 16px, `position:relative`, `top-6 lg:top-8 3xl:top-12` = 24 / 32 / 48px; nach Carousel (`.carousel + .section__action`): `pt-0`.
- Negativ-Varianten: auf `.bg--secondary-500…900` werden `section__title`/`section__subtitle` weiss, Buttons in `.section__action` → `btn--bare-negative`.
- `.section-full-height` → `height:100%`.
- `.section-overview` → `width/height:100%`, `bg-secondary-50`, `pt-4` = 16px, `pb-28` = 112px / 7rem.

### 5. Ratio-Muster (`css/layouts/ratio.postcss`)

Padding-Bottom-Technik: `.ratio` → `position:relative; z-index:50` (wegen Video-iframes in klickbaren Cards); jedes Kind absolut positioniert (`top/right/bottom/left:0; width/height:100%`).

| Klasse | padding-bottom | Verhältnis |
|---|---|---|
| `.ratio--1/1` | 98% | 1:1 mit visueller Korrektur (nicht 100%!) |
| `.ratio--2/1` | 50% | 2:1 |
| `.ratio--4/3` | 75% | 4:3 |
| `.ratio--16/9` | 56.25% | 16:9 |
| `.ratio--mb` | — | `mb-6` = 24px / 1.5rem unter dem Ratio-Block |

Zusatz in derselben Datei: `video::cue` → `text--base`, `text-yellow-200`, transparenter Hintergrund, schwarzer Text-Shadow-Umriss; im Fullscreen `font-family:'FrutigerNeueLTPro-Bold'; font-size: calc(13px + 2vw)`.

### 6. Sticky-Muster (`css/layouts/sticky.postcss`)

- `.sticky` → `position: sticky` (leerer Selektor in der Datei; Wert kommt aus der Tailwind-Utility, in `dist/main.css` verifiziert: `.sticky{position:sticky}`).
- `.sticky--top` → `top-4 md:top-10 lg:top-12`:

| Breakpoint | top |
|---|---|
| Basis | 16px / 1rem |
| md ≥768px | 40px / 2.5rem |
| lg ≥1024px | 48px / 3rem |

- Zusammenspiel: `.container__aside .sticky > *` erhält `mb-7 lg:mb-8` (28 / 32px), siehe `css/layouts/container.postcss`.

### 7. Flankierende Globals (`css/foundations/global.postcss`)

- `html`: `height:100%` (+ `-webkit-fill-available`), `overflow-y: scroll`, `font-regular`; KEINE Root-Font-Size-Änderung → 1rem = 16px.
- App-Wrapper (`#root`, `#__nuxt`, `#app`, …): `height:100%; display:flex; flex-direction:column`.
- `body`: `height:100%; min-height:100vh`, `transition-transform duration-700` (700ms).
- `.body--mobile-menu-is-open`: `overflow:hidden; height: calc(100vh + 3rem); transform: translateY(-3em)`.
- Z-Schichtung: `#main-header` z-30, `#main-content` z-10 (`flex-grow`), `#main-footer` z-0.
- `.skip-to-content`: `px-4 py-2` (16px/8px), absolut zentriert oben, `z-50`, versteckt via `translateY(-200%)`, sichtbar bei `:focus`.
- Fokus global: `*:focus-visible` → `outline:none; ring-2 ring-purple-500` (2px, `#8655F6`); auf dunklen Flächen (`.top-bar`, `.bg--secondary-500…900`) → `ring-purple-300` (`#c4b5fd`).
- Anker-Scroll: `[id]` → `scroll-mt-8` = scroll-margin-top 32px / 2rem.

## CD Bund Designsystem v1.0.5 — Komponentenreferenz A–L (Messlatte für Pixel-Review)

Quellen: `C:\Users\david\Documents\GitHub\designsystem\css\components\*.postcss` (Stile), `...\app\components\ch\components\*.vue` (kanonische Struktur), Token-Auflösung aus `...\app\tailwind.config.js`, `...\css\skins\default.postcss`, `...\css\foundations\*.postcss`; Werte gegen `...\dist\main.css` (Build) verifiziert.

### 0. Token-Auflösung (gilt für alle Tabellen)

#### 0.1 Breakpoints (`app/tailwind.config.js` Z. 20–28)

| Prefix | min-width |
|---|---|
| xs | 480px |
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| 2xl | 1544px |
| 3xl | 1920px |

#### 0.2 Schriftgrössen (`tailwind.config.js` Z. 204–218; reine font-size, KEINE line-height im Utility)

| Klasse | rem | px |
|---|---|---|
| text-xs | 0.75rem | 12px |
| text-sm | 0.875rem | 14px |
| text-base | 1rem | 16px |
| text-lg | 1.125rem | 18px |
| text-xl | 1.25rem | 20px |
| text-2xl | 1.375rem | 22px |
| text-3xl | 1.625rem | 26px |
| text-4xl | 2rem | 32px |
| text-5xl | 2.5rem | 40px |
| text-6xl | 3rem | 48px |
| text-7xl | 3.5rem | 56px |
| text-8xl | 4rem | 64px |

Responsive Sammel-Utilities (`css/foundations/typography.postcss` Z. 43–57):

| Klasse | Basis | ab xl (1280px) | ab 3xl (1920px) |
|---|---|---|---|
| .text--xs | 12px | 14px | 16px |
| .text--sm | 14px | 16px | 18px |
| .text--base | 16px | 18px | 20px |
| .text--lg | 18px | 20px | 22px |
| .text--4xl | 32px / lg: 40px | xl: 48px | 56px (+ leading-tight 1.25) |

Zeilenhöhen: leading-none = 1; leading-tight = 1.25; leading-snug = 1.375; leading-4 = 1rem/16px; leading-5 = 1.25rem/20px; leading-6 = 1.5rem/24px; leading-7 = 1.75rem/28px.

#### 0.3 Schriftschnitt — WICHTIG (`tailwind.config.js` Z. 200–224, `css/foundations/font-face.postcss`)

`font-bold` = `font-family: Font-Bold, Hind, Fallback-font` **UND** `font-weight: 400` (fett kommt aus der Fontdatei NotoSans-Bold, nicht aus dem Weight; in `dist/main.css` verifiziert). `font-regular` = Font-Regular (NotoSans-Regular), weight 400. Ausnahme: `.glossar-result__title` setzt explizit `font-weight: 600`.

#### 0.4 Farben (Default-Skin `css/skins/default.postcss` + `tailwind.config.js`)

| Token | Hex | Token | Hex |
|---|---|---|---|
| primary-50 | #ffedee | secondary-50 | #f0f4f7 |
| primary-100 | #fae1e2 | secondary-100 | #dfe4e9 |
| primary-200 | #ffccce | secondary-200 | #acb4bd |
| primary-300 | #fa9da1 | secondary-300 | #828e9a |
| primary-400 | #fc656b | secondary-400 | #596978 |
| primary-500 | #e53940 | secondary-500 | #46596b |
| primary-600 | #d8232a | secondary-600 | #2f4356 |
| primary-700 | #bf1f25 | secondary-700 | #263645 |
| primary-800 | #99191e | secondary-800 | #1c2834 |
| primary-900 | #801519 | secondary-900 | #131b22 |

text-Skala (= gray-Skala): 50 #f9fafb, 100 #f3f4f6, 200 #e5e7eb, 300 #d1d5db, 400 #9ca3af, 500 #6b7280, 600 #4b5563, 700 #374151, 800 #1f2937, 900 #111827. red = primary-Skala (identische Hexwerte). purple-500 #8655F6, purple-300 #c4b5fd.

#### 0.5 Radien, Schatten, Fokus

| Token | Wert |
|---|---|
| rounded-xs | 0.0625rem / 1px |
| rounded-sm | 0.125rem / 2px |
| rounded (DEFAULT) | 0.1875rem / 3px |
| rounded-full | 9999px |
| shadow (DEFAULT) | 0px 1px 2px 0px rgba(0,0,0,0.06), 0px 1px 5px 0px rgba(0,0,0,0.08) |
| shadow-lg | 0px 2px 6px -1px rgba(0,0,0,0.06), 0px 5px 20px -3px rgba(0,0,0,0.08) |
| shadow-2xl | 0px 10px 20px 0px rgba(0,0,0,0.06), 1px 10px 70px -8px rgba(0,0,0,0.13) |

Fokus GLOBAL (`css/foundations/global.postcss` Z. 75–86): `*:focus-visible` → `outline: none` + Ring `2px` `#8655F6` (purple-500); auf dunklen Hintergründen (.top-bar, .bg--secondary-500…900) Ring `#c4b5fd` (purple-300). Komponenten setzen zusätzlich `focus:outline-none` (btn, input).

---

### 1. accordion

Quellen: `css/components/accordion.postcss`, `app/components/ch/components/Accordion.vue`, `AccordionItem.vue`, Verhalten `app/scripts/Accordion.js`.

#### Struktur (AccordionItem.vue Z. 1–20)

```html
<ul id="accordion-{id}" class="accordion [accordion--spaced]">
  <li class="accordion__item">
    <button id="accordion-control-{id}" class="accordion__button"
            aria-expanded="false" aria-controls="content-{id}">
      <h3 class="accordion__title">Titel</h3>              <!-- Tag h2|h3|h4|h5|div, Default h3 -->
      <svg class="accordion__arrow" ...>ChevronDown, size xl</svg>
    </button>
    <div id="content-{id}" class="accordion__drawer" aria-hidden="true">
      <div class="accordion__content vertical-spacing">…Inhalt…</div>
    </div>
  </li>
</ul>
```

ARIA-Mechanik (Accordion.js Z. 23–38): offen = Button `.active` + `aria-expanded="true"`, Drawer `.active` + `aria-hidden="false"`; geschlossen umgekehrt.

#### Werte

| Element | Eigenschaft | Wert |
|---|---|---|
| .accordion | padding-left | 0 |
| .accordion--spaced | padding-block | py-8 = 32px / 2rem |
| .accordion__item | border-top | 1px solid #acb4bd (secondary-200); letztes Item zusätzlich border-bottom 1px #acb4bd |
| .accordion__item | margin-top | 0 !important; list-style: none |
| .accordion__button | display | flex, align-items center, width 100% |
| .accordion__button | padding | 12px 8px (py-3 px-2); ab 2xl (1544px): 20px 12px (py-5 px-3) |
| .accordion__button | Schrift | font-bold (Font-Bold, weight 400) |
| .accordion__button (hover) | color | #e53940 (primary-500), transition-colors 200ms; bei `(hover: none)` color: inherit |
| .accordion__button-disabled | cursor | default |
| .accordion__title | font-size | text-base = 16px (fix, nicht responsive); text-align left; padding 4px 16px 4px 0 (py-1 pr-4); pr ab lg 24px, ab 2xl 32px |
| .accordion__arrow | margin-left | auto; transition-transform 200ms; im Zustand `.active &`: rotate(180deg) |
| .accordion__drawer (zu) | max-height | 0; overflow hidden; transition max-height 0.3s ease-out |
| .accordion__drawer.active (offen) | max-height | fit-content |
| .accordion__content | padding | 8px 8px 40px (px-2 pt-4 pb-10); ab 2xl px-3 = 12px; width 100%; vertical-spacing (Kinder mt-12 = 48px, ab 2xl 56px, erstes Kind 0) |
| .highlight-blue (Suchtreffer) | background | #dbeafe (blue-100) |
| .accordion__loading-icon (Ladezustand) | margin-inline | auto (mx-auto) |

---

### 2. alert-banner

Quellen: `css/components/alert-banner.postcss`, `AlertBanner.vue`.

#### Struktur (AlertBanner.vue Z. 1–42)

```html
<div class="alert-banner alert-banner--{info|alert|warning|error|success}">
  <div class="alert-banner__wrapper">                     <!-- container + Icon + Grid -->
    <svg class="notification__icon">WarningCircle</svg>   <!-- optional -->
    <div class="alert-banner__grid">
      <div class="alert-banner__header"><h4 class="font--bold">Titel</h4><p>Thema</p><p>Stand</p></div>
      <div class="alert-banner__content"><p>Text</p></div>
      <ul class="alert-banner__list"><li class="alert-banner__list-item">
        <p>Intro</p>
        <div class="alert-banner__link"><!-- Btn variant link-negative, size sm, icon ArrowRight rechts --></div>
      </li></ul>
    </div>
    <button class="alert-banner__close" aria-label="Close alert banner"><svg>Cancel</svg></button>
  </div>
</div>
```

#### Werte

| Element | Eigenschaft | Wert |
|---|---|---|
| .alert-banner | color | #ffffff; `p` innen: .text--sm (14→16→18px) |
| .alert-banner__wrapper | layout | flex, items-start, relative; .container; padding-block 16px, ab md 24px, ab xl 32px |
| .alert-banner__grid | grid | 1 Spalte gap 12px; ab md 3 Spalten gap 24px; ab lg 4 Spalten gap 32px |
| .alert-banner__header | span | break-words; md: col-span-4; lg: col-span-1 row-start-1 |
| .alert-banner__content | span | md: col-span-3 row-start-2; lg: col-span-2 row-start-1 |
| .alert-banner__list | span | md: col-span-1 row-start-2; lg: col-span-1 row-start-1 |
| .alert-banner__close | position | absolute top 0 right 0; svg 32×32px (w-8 h-8) |
| .alert-banner--alert / --error | background | #801519 (red-900) |
| .alert-banner--info | background | #1e40af (blue-800) |
| .alert-banner--warning | background | #c2410c (orange-700) |
| .alert-banner--success | background | #047857 (green-700) |

Zustand geschlossen: Komponente wird komplett entfernt (v-if, Z. 2).

---

### 3. badge

Quellen: `css/components/badge.postcss`, `Badge.vue`.

#### Struktur (Badge.vue Z. 1–20)

```html
<div|button class="badge badge--{farbe} badge--{base|sm} [badge--icon] [badge--clickable] [badge--disabled]">
  <svg class="badge__icon-left">…</svg>   <!-- optional -->
  <span class="badge__text">Label</span>
  <svg class="badge__icon icon--{Name}">…</svg>  <!-- optional -->
</div|button>
```

`button` nur wenn `clickable`; kein ARIA-Attribut in der Vorlage.

#### Basiswerte

| Eigenschaft | Wert |
|---|---|
| display | inline-flex, align-items center |
| padding | 0.219em oben/unten, 1em links/rechts (em-basiert, skaliert mit Schriftgrösse) |
| border-radius | 9999px (rounded-full) |
| Grösse base (Default) | font-size 12px, ab md 14px, ab lg 16px; line-height 20px (leading-5), ab lg 24px (leading-6) |
| Grösse --sm | font-size 10px, ab md 12px, ab lg 14px; line-height 16px (leading-4), ab md 1.35rem/21.6px |
| .badge__icon | width 1.5em, height 100%, relative left 0.4em, stroke currentColor 0.3px / md 0.35px / lg 0.4px |
| .badge__icon-left | wie __icon, aber relative right 0.4em |

#### Farbvarianten (Text / Hintergrund)

| Variante | color | background |
|---|---|---|
| --gray (Default) | #1f2937 (gray-800) | #dfe4e9 (secondary-100) |
| --red, --error | #99191e (red-800) | #fae1e2 (red-100) |
| --yellow | #92400e | #fef3c7 |
| --orange, --warning | #9a3412 | #ffedd5 |
| --green, --success | #065f46 | #d1fae5 |
| --blue, --info | #1e40af | #dbeafe |
| --indigo | #3730a3 | #e0e7ff |
| --purple | #5b21b6 | #ede9fe |
| --pink | #9d174d | #fce7f3 |
| --negative | #f3f4f6 (gray-100) | #1f2937 (gray-800) |

#### Zustände

| Zustand | Wert |
|---|---|
| --clickable | cursor: pointer |
| --disabled | opacity 0.4 !important, cursor default !important (Klick wird in Vue unterdrückt) |
| hover/focus | keine eigenen Stile (nur globaler Fokusring) |

---

### 4. badge-filter

Quellen: `css/components/badge-filter.postcss`, `BadgeFilter.vue`, `CarouselBadgeFilter.vue`.

#### Struktur (BadgeFilter.vue: Desktop; CarouselBadgeFilter.vue Z. 2–3: Mobile)

```html
<!-- Desktop, ab md sichtbar -->
<div class="badge-filter">
  <Badge label="Alle" size="base" color="gray|negative" clickable [disabled] /> <!-- «Alle», «0-9», A…Z -->
</div>
<!-- Mobile, unter md -->
<div id="{id}" class="carousel-badge-filter"><div class="carousel">…Swiper mit Badges…
  <div class="carousel__fonctions">
    <div class="carousel__pagination"></div>
    <button class="carousel__prev"><span class="sr-only">…</span><svg/></button>
    <button class="carousel__next">…</button>
  </div>
</div></div>
```

Aktiver Filter = Badge-Farbe `negative` (#f3f4f6 auf #1f2937), inaktiv `gray`; deaktivierte Buchstaben = `badge--disabled` (opacity 0.4).

#### Werte

| Element | Eigenschaft | Wert |
|---|---|---|
| .badge-filter | display | hidden, ab md block (flex ist deklariert, hidden md:block gewinnt) |
| .badge-filter .badge | margin | bottom 16px (mb-4), right 10px (mr-[10px]) |
| .carousel-badge-filter | display | height 100%; ab md hidden |
| .carousel-badge-filter .carousel | Höhe | 40px (h-10), position relative |
| .carousel__fonctions (hier) | layout | flex, justify-center, items-center, py-2 = 8px; static, z-20 |
| .carousel__prev/__next (hier) | color | #d8232a (primary-600); svg 40×40px; `[disabled]` → hidden |
| .carousel__prev (hier) | position | absolute z-10, top 0 bottom 0 left 24px (left-6), translateX(-100%), 40×40px, Verlauf bg-gradient-to-r via/from #f0f4f7 (secondary-50) |
| .carousel__next (hier) | position | absolut analog rechts (right-6), translateX(100%), Verlauf to-l |
| .swiper (hier) | Höhe | 40px; .swiper-wrapper flex items-center; .swiper-slide width fit-content |

---

### 5. box

Quelle: `css/components/box.postcss`, Verwendung z. B. `app/pages/detailEvent.vue` Z. 46.

```html
<div class="box">…</div>
```

| Eigenschaft | Wert |
|---|---|
| padding | 16px (p-4); ab xs 20px; ab lg 24px; ab 2xl 32px |
| background | #f0f4f7 (secondary-50) |
| .box + .box | margin-top 1px (Trennlinieneffekt) |

Keine Zustände (statischer Container).

---

### 6. btn

Quellen: `css/components/btn.postcss`, `Btn.vue`.

#### Struktur (Btn.vue Z. 1–16)

```html
<button type="button" | a href="…"
  class="btn [btn--{outline|bare|filled|outline-negative|bare-negative|link|link-negative}]
         [btn--{sm|base|lg}] [btn--icon-{none|only|left|right}] [btn--full-width]"
  [aria-label="…"] [disabled]>
  <svg class="btn__icon">…</svg>                <!-- optional -->
  <span class="btn__text | btn__text-centered">Label</span>
</button>
```

aria-label wird gesetzt bei icon-only-Buttons (= Label) oder explizitem ariaLabel; bei `icon-only` ist `.btn__text` `sr-only`.

#### Basis (.btn)

| Eigenschaft | Wert |
|---|---|
| display | inline-flex, align-items center |
| padding-inline | 16px (px-4) |
| line-height | 1.25 (leading-tight) — von Grössenklasse überschrieben |
| border-radius | 2px (rounded-sm) |
| text-decoration | none; focus:outline-none (Ring global) |

#### Grössen

| Klasse | min-height | font-size | line-height |
|---|---|---|---|
| .btn / .btn--base | 44px; ab xl 48px; ab 3xl 52px | .text--base (16/18/20px) | 20px (leading-5), ab lg 24px |
| .btn--sm | 34px; ab xl 40px; ab 3xl 44px | .text--sm (14/16/18px) | 16px (leading-4), ab lg 20px |
| .btn--lg | 48px; ab xl 52px; ab 3xl 56px | .text--lg (18/20/22px) | 24px (leading-6) |

#### Varianten × Zustände (Farben)

| Variante | Default | Hover | Focus | Disabled |
|---|---|---|---|---|
| --outline | Text+Border #d8232a (primary-600), border 1px, font-normal | Text+Border #bf1f25 (primary-700) | Text+Border #d8232a | Text #828e9a (secondary-300), Border #acb4bd (secondary-200) |
| --filled | Text #fff font-bold, bg #46596b (secondary-500), border 1px #46596b | Text #dfe4e9 (secondary-100) | Text #fff | Text #fff, bg+Border #acb4bd (secondary-200) |
| --bare | px-2 (8px), Text #1c2834 (secondary-800), font-normal | Text #d8232a | — | Text #828e9a, bg transparent |
| --link | padding 0 8px 0 0 (pr-2 pl-0), Text #d8232a, font-normal; Icon w-8 (32px), fill+stroke currentColor, stroke 0/md 0.05px/lg 0.1px | Text #bf1f25 | — | Text #828e9a, bg transparent |
| --link-negative | wie --link, Text #fff, underline, underline-offset 2px | Text #dfe4e9 | Text #fff | Text #acb4bd, bg transparent |
| --outline-negative | Text #fff font-bold, bg #46596b, border 1px #fff | Text+Border #dfe4e9 | Text+Border #fff | Text #acb4bd, Border #828e9a, bg transparent |
| --bare-negative | Text #fff | Text #dfe4e9 | Text #fff | Text #acb4bd |

#### Text und Icons

| Element | Wert |
|---|---|
| .btn__text | padding-block 8px (py-2), text-align left, overflow-wrap anywhere |
| .btn__text-centered | wie __text, text-align center, width 100% |
| .btn__icon | width 1.4em, height 100%, stroke currentColor 0.3px / md 0.35px / lg 0.4px, transition-transform 200ms |
| .btn--icon-only | padding-inline 0.625em (10px bei 16px Schrift); Text sr-only |
| .btn--icon-left .btn__icon | margin-right 0.2em, relative right 0.1em |
| .btn--icon-right | flex-direction row-reverse; Icon margin-left 0.2em, relative left 0.1em |
| .btn--icon-180 .btn__icon | rotate(180deg) |
| .btn--icon-none .btn__icon | display none |
| .btn--back | float left, margin-top 0.4em, ab lg 4px (mt-1) |
| .btn--full-width | width 100% |

---

### 7. burger

Quellen: `css/components/burger.postcss`, `Burger.vue`.

#### Struktur (Burger.vue Z. 1–9)

```html
<button class="burger" title="Toggle mobile menu">
  <span class="burger__icon [burger--is-open]">
    <span class="burger__bar" /><span class="burger__bar" /><span class="burger__bar" />
  </span>
</button>
```

| Element | Eigenschaft | Wert |
|---|---|---|
| .burger | layout | height 100%, flex items-center; padding-inline 16px (px-4), margin-right -16px (-mr-4); ab lg hidden |
| .burger__icon | Grösse | 28×20px (w-7 h-5), block, relative; color #6b7280 (text-500), transition-colors |
| .burger__icon:hover | color | #d8232a (primary-600) |
| .burger__bar | Balken | Balken 1 und 3 via ::after: height 2px (border-t-2 bzw. border-b-2, currentColor), transition-transform 150ms delay 150ms; Balken 2: height 2px, background currentColor, top 50 %, translateY(-50 %) |
| offen (.burger--is-open oder body.body--mobile-menu-is-open) | Transformation | Balken 1: translateY(50 %), ::after rotate(45deg); Balken 2: scaleX(0); Balken 3: translateY(-50 %), ::after rotate(-45deg) |

---

### 8. card

Quellen: `css/components/card.postcss`, `Card.vue`.

#### Struktur (Card.vue Z. 1–40)

```html
<div class="card [card--{default|highlight|twitter|flat|universal}] [card--list|card--list-without-image]
             [card--image-left|card--image-right] [card--clickable]">
  <div class="card__image"><picture><img …></picture></div>   <!-- nicht bei highlight/universal an dieser Stelle -->
  <div class="card__header">…</div>                            <!-- optional -->
  <div class="card__content">
    <div class="card__body">
      <!-- metaInfos --> 
      <div class="card__title">…</div>
      <!-- description, [card__image bei universal], author, eventInfos, specifications, contentIcons -->
    </div>
    <div class="card__footer [card__footer--icon-only]">
      <div class="card__footer__info">…</div>
      <div class="card__footer__action">…Btn…</div>
    </div>
  </div>
</div>
```

`card--clickable` wird automatisch gesetzt, sobald ein footerAction-Slot existiert (Card.vue Z. 77).

#### Basiswerte

| Element | Eigenschaft | Wert |
|---|---|---|
| .card | layout | flex column, height 100 %, background #fff, container-type inline-size |
| .card--default | shadow | shadow-lg |
| .card__image | ratio | padding-bottom 56.25 % (16:9); in .grid--responsive-cols-2: 50 % (2:1); ::before Overlay bg #f0f4f7, border 2px #fff, opacity 0.7; img absolute, object-cover; Platzhalter-svg zentriert 50 %/50 % |
| .card__header | layout | flex items-center, padding 24px (p-6), bg #dfe4e9 (secondary-100) |
| .card__content | layout | flex column, justify-between, height 100 %, z-10, bg #fff |
| .card__body | padding | 24px links/rechts, 40px oben/unten (px-6 py-10); Kinderabstand space-y-4 = 16px |
| .card__title | Schrift | text-lg 18px, ab xl 20px (text-xl), ab 3xl 22px (text-2xl); font-bold; leading-snug 1.375; break-words; transition-colors 200ms |
| .card__body p | clamp | line-clamp-6; ab Containerbreite 500px: line-clamp-4 |
| .card__footer | layout | flex items-center justify-between; padding 0 24px 24px (px-6 pb-6) |
| .card__footer--icon-only | justify | flex-end |
| .card__footer__info | Schrift | .text--sm (14/16/18px), color #6b7280 (secondary-500 laut Klasse text-secondary-500 → #46596b! Achtung: `text-secondary-500` = #46596b), padding-right 24px |
| .card__content-icons | layout | relative flex, margin-left -4px; svg margin-right 8px |

Korrektur zur Zeile oben: `.card__footer__info` nutzt `text-secondary-500` = **#46596b**.

#### Zustände (card--clickable)

| Zustand | Wert |
|---|---|
| Default | transition-shadow 300ms ease-in-out; cursor pointer; a/btn ::after = unsichtbarer 2px-Rahmen (border-text-50 #f9fafb, opacity 0) über die ganze Karte (inset 0) |
| hover / focus-within | shadow-2xl; .card__title → #bf1f25 (primary-700); ::after-Rahmen opacity 0.9 |

#### Varianten

| Variante | Kernwerte |
|---|---|
| --highlight | bg transparent, padding-left+top 20px (pl-5 pt-5), ab lg 28px (pl-7 pt-7); ::before-Fläche bg #828e9a (secondary-300) versetzt (right/bottom 20px, ab lg 28px); hover/focus-within: ::before scale(1.02), kein Schatten; .card__content gap 20px; .card__body pt-8 (32px) pb-0 |
| --twitter | shadow-lg; body p-3 (12px), max-height 700px, overflow-y scroll; footer pt-6 (24px); iframe relative !important z-50 |
| --flat | padding-block 16px / lg 24px / 2xl 32px, padding-inline 4px (px-1); bg transparent; border-bottom 1px #acb4bd; body px-0, footer p-0; footer__action mt-4 (16px); hover: kein Schatten |
| --universal | shadow-lg; Bild im Body, border-block 0.5em transparent, img object-contain |
| --list (mit Bild) | erbt --flat; ab sm Grid 4fr/1fr gap-x-6 (24px); Bild rechts (Spalte 2), hidden bis md, pb-80 %, object-contain object-right-top; body pt-0 pb-4; footer__action mt -32px; .btn h-0 min-h-0 border-0, focus-visible-Ring auf ::after (ring-2 #8655F6) |
| --list-without-image | wie --list ohne Grid/Bild; content flex |
| --image-left | ab md Grid 2/3–1/3 (grid--responsive-cols-2/3-1/3) mit gap--responsive; content -ml-3/lg -5/xl -6/3xl -8; Titel md:text-xl (20px), xl:text-2xl (22px), 3xl:text-3xl (26px); body/footer pl-0 |
| --image-right | ab md Grid 1/3–2/3 reverse (Areas A/B); body/footer pr-0 |

Kontext Accordion (card.postcss Z. 143–163): letztes `.card--flat` im Drawer → mb-4, border-b-0.

---

### 9. carousel

Quellen: `css/components/carousel.postcss`, kanonische Verwendung `app/components/ch/demo/CarouselExample.vue` (Swiper 5-teilig).

#### Struktur (CarouselExample.vue Z. 2–107)

```html
<div class="carousel carousel--cards | carousel--bullets | carousel--fraction">
  <div class="swiper"><div class="swiper-wrapper">
    <div class="swiper-slide">…Card…</div>
  </div></div>
  <div class="carousel__fonctions">
    <div id="carousel-pagination-{id}" class="carousel__pagination"></div>
    <button id="carousel-prev-{id}" class="carousel__prev"><div class="sr-only">Previous image</div><svg aria-hidden="true">ChevronLeft</svg></button>
    <button id="carousel-next-{id}" class="carousel__next"><div class="sr-only">Next image</div><svg aria-hidden="true">ChevronRight</svg></button>
  </div>
</div>
```

Bullets: `bulletClass: carousel__bullet`, aktiv `carousel__bullet--active`. Swiper-Abstände (Demo Z. 8–41): spaceBetween 20 / xs 28 / sm 36 / md 36 (2 Slides) / lg 40 (3) / xl 48 (3) / 1800px 64.

#### Werte

| Element | Eigenschaft | Wert |
|---|---|---|
| .carousel | position | relative; figure py-0 |
| .carousel__fonctions | layout | flex justify-center items-center, padding-block 8px (py-2) |
| .carousel__prev/__next | hover | color #d8232a (primary-600), transition-colors 200ms; svg 40×40px |
| .carousel__prev/__next[disabled] | Zustand | bg #fff, ab 2xl Verlauf via/from #fff, opacity 0.5 |
| .carousel__pagination | layout | flex justify-center, padding-inline 24px (px-6) |
| .carousel__bullet | Punkt | 16×16px (w-4 h-4), rounded-full, margin-inline 8px (mx-2), bg transparent, border 1px #4b5563 (text-600); hover: border #d8232a, bg #e53940; cursor pointer; transition-colors 200ms |
| .carousel__bullet--active | Punkt | bg #6b7280 (text-500), hover bg identisch, cursor default |
| .carousel--fraction | Pfeile | __fonctions justify-end |
| .carousel--bullets | Pfeile | ab lg absolut: top 0, bottom 60px, left/right -56px (-left-14), ab 2xl -80px (-left-20); svg 48px / lg 56px / 2xl 80px |
| .carousel--cards .swiper | padding | p-12 (48px) mit !pt-0; Margins -48px seitlich, -32px unten; ab 2xl p-14 (56px), -56px seitlich, -48px unten |
| .carousel--cards .carousel__fonctions | padding | py-4 (16px), ab 2xl py-10 (40px); relative z-20, ab 2xl static |
| .carousel--cards .carousel__prev/__next | ab 2xl | absolut top/bottom 0 links bzw. rechts, translateX(∓100 %), Weissverlauf (to-r bzw. to-l via/from #fff); svg 48 / lg 56 / 2xl 80 / 3xl 96px |
| Hintergrund-Kontext | bg--secondary-50/100/500/600 | Verlauf und [disabled]-bg wechseln auf die jeweilige Hintergrundfarbe; auf 500/600: Bullets border #9ca3af (text-400), aktiv bg #d1d5db (text-300), Pfeile #f9fafb (text-50) hover #fc656b (primary-400) |
| .swiper-slide img | Grösse | mx-auto, width auto !important, max-height 480px / sm 560px / md 640px / lg 768px (30/35/40/48rem); in .card: width 100 % !important |
| Pagination-Ausblendung | ≥6 Punkte | hidden, ab sm flex; ≥13 Punkte: hidden, ab md flex |

Leerer/einzelner Zustand: keine Sonderstile; deaktivierte Pfeile siehe `[disabled]`.

---

### 10. date

Quelle: `css/components/date.postcss`; kanonische Verwendung `app/pages/detailEvent.vue` Z. 48–63 (kein eigenes Vue-SFC).

#### Struktur

```html
<div class="date" lang="de">
  <div class="date__wrapper">
    <div class="date__day">10</div><div class="date__month">Apr</div>
  </div>
  <div class="date__separator">–</div>
  <div class="date__wrapper">
    <div class="date__day">11</div><div class="date__month">Apr</div><div class="date__year">2023</div>
  </div>
</div>
<div class="hours">Freitag 18:00 – 21:00</div>
```

| Element | Eigenschaft | Wert |
|---|---|---|
| .date | layout | flex flex-wrap items-start relative; margin-bottom 16px, margin-left -4px, padding-bottom 16px |
| .date__day | Schrift | .text--4xl (32px / lg 40px / xl 48px / 3xl 56px), tracking-tighter (-0.05em), leading-none 1; ::after content "\00a0"; bei `[lang='de']` content "." |
| .date__month | Schrift | .text--base (16/18/20px), font-bold, padding-top 0.15em, ab lg 0.3em |
| .date__year | Schrift | wie __month, zusätzlich padding-left 8px (pl-2) |
| .date__separator | Schrift | .text--4xl, leading-none, padding 0 8px 0 16px (pr-4 pl-2) |
| .hours | margin-top | -16px (-mt-4) |

---

### 11. download-item

Quellen: `css/components/download-item.postcss`, `DownloadItem.vue`.

#### Struktur (DownloadItem.vue Z. 1–18)

```html
<a class="download-item" href="{url}" download="{filename|true}">
  <svg class="download-item__icon">Download, size xl</svg>
  <div>
    <h4 class="download-item__title">Titel</h4>          <!-- Tag h2|h3|h4|h5|div, Default h4 -->
    <p class="download-item__description">Beschreibung</p>
    <div class="download-item__meta-info"><!-- MetaInfo: Typ | Datum | Grösse --></div>
  </div>
</a>
```

| Element | Eigenschaft | Wert |
|---|---|---|
| .download-item | layout | flex, width 100 %; padding 16px 0 16px 0 (pt-4 pb-4 pl-0); border-bottom 1px #acb4bd (secondary-200); text-align left; keine Unterstreichung, Textfarbe inherit !important |
| Kontext .bg--secondary-50 | border | #828e9a (secondary-300) |
| Kontext .accordion, letztes Item | border | keine (border-b-0), margin-bottom 16px |
| .download-item__icon | Grösse | height 28px / md 32px / lg 36px (h-7/8/9); color #d8232a (primary-600); margin -4px oben/unten, -4px links; padding-right 4px, ab md 8px |
| .download-item__title | Schrift | font-bold, break-words, transition-colors 200ms |
| Hover (.download-item:hover) | Titel | color #d8232a (primary-600) — einziger Hover-Effekt |
| .download-item__description | Text | break-words, color #1f2937 (text-800) |
| .download-item__meta-info | Abstand | padding-top 12px (pt-3) |
| .download-meta-info | Farbe | #9ca3af (gray-400) |
| .download-item__meta-divider | Abstand | padding-inline 12px (px-3) |

---

### 12. form (inkl. checkbox / radio / fieldset)

Quellen: `css/components/form.postcss`, `Form.vue`, `Fieldset.vue`, `Checkbox.vue`, `Radio.vue`.

#### Struktur

```html
<form action="…" method="post|get" target="_blank|_self">        <!-- Form.vue Z. 1–11 -->
  <fieldset class="form__group">                                  <!-- Fieldset.vue Z. 1–15 -->
    <legend class="form__group__legend [text--negative] [text--{sm|base|lg}] [text--asterisk]">Legende <span class="sr-only">required</span></legend>
    <!-- Felder -->
    <div class="badge badge--sm badge--{error|warning|success|info}">Meldung</div>
  </fieldset>
</form>

<!-- Checkbox (Checkbox.vue Z. 1–27) -->
<div class="form__group__checkbox">
  <input id="{id}" type="checkbox" class="input input--{outline|negative} [input--{sm|base|lg}] [input--{error|…}]"
         name="…" value="…" [required] [checked]>
  <label for="{id}" class="[text--asterisk]…"><span>Label</span><span class="sr-only">required</span></label>
  <div class="badge badge--sm badge--{messageType}">Meldung</div>
</div>

<!-- Radio (Radio.vue Z. 1–25): identisch mit type="radio" in <div class="form__group__radio"> -->
```

#### Werte

| Element | Eigenschaft | Wert |
|---|---|---|
| .form | Abstände | space-y-6 = 24px zwischen Gruppen |
| .form__group__legend | margin-bottom | 8px (mb-2) |
| .form__group__input / __select | layout | width 100 %, space-y-2 = 8px |
| .form__group__radio | layout | flex items-baseline gap 8px, margin-bottom 8px; nach label: margin-top 8px |
| .form__group__checkbox | margin-bottom | 8px |
| .text--asterisk::after | Pflichtzeichen | content "\202F*" (schmales Leerzeichen + Stern), speak: none |

Checkbox/Radio-Werte siehe Abschnitt 15 (input, Block «Radio und Checkboxen»). Fehlerlogik Form.vue Z. 56–82: submit wird verhindert, solange ein Kind `input--error` trägt.

---

### 13. glossary

Quellen: `css/components/glossary.postcss`, `GlossarResultList.vue`, `GlossarResultTitle.vue`, `GlossarResultListItemAccordion.vue`, Seite `app/pages/glossar.vue`.

#### Struktur

```html
<div class="glossar-result__list">
  <div>
    <h2 class="glossar-result__title">A</h2>
    <ul class="accordion">…AccordionItems (Begriffe)…</ul>   <!-- Treffer-Highlight: <span class="highlight-blue"> -->
  </div>
</div>
<!-- Kopfleiste -->
<div class="glossary-results__header">
  <div class="glossary-results__header__left">…<strong>n</strong> Resultate…</div>
  <div class="glossary-results__header__right"><select class="…" style="text-align right">…</select></div>
</div>
<div class="glossary__filters">…BadgeFilter/CarouselBadgeFilter…</div>
```

| Element | Eigenschaft | Wert |
|---|---|---|
| .glossar-result__list | max-width | 900px |
| .glossar-result__title | Schrift | font-size 56px (text-7xl, fix), **font-weight 600** (explizit, glossary.postcss Z. 11), color #4b5563 (text-600); margin 20px 0 10px (mt-5 mb-2.5), ab md 40px 0 20px |
| .glossary-results__header | layout | flex flex-wrap gap-4 (16px) items-center justify-between; .text--sm; padding-top 16px / sm 24px / 2xl 32px; padding-bottom 8px / sm 12px / 2xl 16px; border-bottom 1px #828e9a (secondary-300) |
| .glossary-results__header strong | Anzeige | block, ab sm inline; margin-right 1ex; font-regular |
| .glossary-results__header__right select | Ausrichtung | text-align right; Container ml-auto |
| .glossary__filters | padding-top | 20px, ab md 24px |
| .glossary__filters__drawer | grid | ab md 2 Spalten, ab lg 3; gap 12px, ab lg 16px; padding-top 16/24/32px, padding-bottom 8/12/16px, margin-top 16/24/32px (sm/2xl-Stufen); border-top 1px #acb4bd |
| .glossary__filters__drawer-section | margin-top | 8px, ab md -4px |
| Treffer-Highlight .highlight-blue | background | #dbeafe (blue-100) |

Leerzustand (glossar.vue Z. 196 ff.): Hinweisliste + «Mehr laden»-Knopf entfällt; Ladezustand `isLoading` blendet Liste aus.

---

### 14. info-block

Quellen: `css/components/info-block.postcss`, `InfoBlock.vue`.

#### Struktur (InfoBlock.vue Z. 1–10)

```html
<div class="info-block [border-t] [border-b]">   <!-- borderTop Default true -->
  <h3 class="info-block__title">Titel</h3>        <!-- Tag h2|h3|h4|h5|div, Default h3 -->
  <div>…Inhalt (Slot)…</div>
</div>
```

| Element | Eigenschaft | Wert |
|---|---|---|
| .info-block | layout | padding-block 16px, ab lg 24px; grid grid--responsive-cols-1/3-2/3 (Titel 1/3, Inhalt 2/3); border-color #acb4bd (secondary-200) |
| border-t / border-b | Rahmen | 1px oben bzw. unten (#acb4bd) |
| .info-block__title | Schrift | font--bold; padding-right 4px (pr-1); margin-bottom 16px (mb-4); break-words |

---

### 15. input (inkl. textarea, select-Basis, checkbox/radio)

Quellen: `css/components/input.postcss`, `Input.vue`; Wrapper `Select.vue`/`select.postcss` für Selects.

#### Struktur (Input.vue Z. 1–30)

```html
<div class="form__group__input">
  <label for="{id}" class="[sr-only] [text--negative] [text--{sm|base|lg}] [text--asterisk]">Label</label>
  <input id="{id}" type="text|…" name="{id}"
         class="input--{outline|negative} [input--{sm|base|lg}] [input--{error|warning|success|info}] [input--submit]"
         [placeholder] [value] [required] [readonly] …>
  <div class="badge badge--sm badge--{error|…}">Meldung</div>    <!-- Fehler-/Statusmeldung -->
</div>
```

#### Basis (.input, input, textarea, select)

| Eigenschaft | Wert |
|---|---|
| width | 100 % |
| padding | 10px 16px (py-[0.625rem] px-4) |
| min-height | 44px (var(--input-min-height)); ab 2xl 48px (--input-min-height-2xl) |
| border | 1px solid #6b7280 (text-500); background #fff |
| border-radius | 1px (rounded-xs, 0.0625rem) |
| shadow | 0px 1px 2px 0px rgba(0,0,0,0.06), 0px 1px 5px 0px rgba(0,0,0,0.08) |
| line-height | 1 (leading-none) |
| placeholder | #596978 (secondary-400) |
| focus | outline-none (globaler Ring 2px #8655F6) |

#### Grössen

| Klasse | font-size | line-height |
|---|---|---|
| .input--sm | .text--sm (14/16/18px) | 24px (leading-6) |
| .input--base | .text--base (16/18/20px) | 24px (leading-6) |
| .input--lg | .text--lg (18/20/22px) | 28px (leading-7) |

#### Zustände

| Zustand | Werte |
|---|---|
| --outline (Default) | Text #1f2937 (text-800), Border #6b7280 |
| [disabled] / .input--disabled | bg #f9fafb (text-50), Text #9ca3af (text-400), Border #d1d5db (text-300), pointer-events none, cursor not-allowed |
| --error | Text #99191e (red-800), Border #e53940 (red-500), Placeholder #fc656b (red-400); nachfolgendes label: Text #99191e, margin-right 12px |
| --negative | Text #fff, bg #46596b (secondary-500), Placeholder #f0f4f7 (secondary-50), Border #828e9a (secondary-300); hover/focus Text #d1d5db (text-300) |
| --negative disabled | bg #828e9a, Text #acb4bd |
| --error.--negative | Text #ffccce (red-200), Border #fa9da1 (red-300) |
| --submit | cursor pointer |

#### Radio und Checkboxen (input.postcss Z. 78–152)

| Eigenschaft | Wert |
|---|---|
| Grösse Default/base | 0.9rem = 14.4px Quadrat; --sm 12px (h-3 w-3); --lg 16px |
| Layout | min-height 0, shrink-0, margin-right 8px (mr-2), padding 0, appearance none |
| Radio | border-radius 9999px (rounded-full) |
| checked | bg #374151 (text-700); Checkbox: weisses Häkchen als data-URI-SVG, no-repeat center; Radio: weisser Punkt (Kreis r=3/12), Position 50 % 50 % |
| checked + disabled | bg #374151, Border #6b7280 |
| disabled | opacity 0.4 |
| --outline disabled | bg #f3f4f6 (text-100), Border #d1d5db |
| --negative | bg #596978 (secondary-400), border 1px #fff; disabled bg #d1d5db, Border #9ca3af |

#### Sonstige Typen

| Typ | Wert |
|---|---|
| input[type=color] | height 48px (h-12) |
| input[type=range] | border 0, box-shadow none |
| input[type=search] | Webkit-Dekorationen (cancel/results-Buttons) display none |
| .textarea--static | resize none |

---

### 16. language-switcher

Quellen: `css/components/language-switcher.postcss`, `LanguageSwitcher.vue`, `Select.vue`, `select.postcss`.

#### Struktur (LanguageSwitcher.vue Z. 1–12, Select.vue Z. 1–32)

```html
<div class="language-switcher">
  <label for="lang-switcher" class="sr-only">Select language</label>
  <div class="form__group__select">
    <div class="select select--bare">
      <select id="lang-switcher" class="input--negative input--sm">
        <option>DE</option><option>FR</option><option>IT</option>
        <option disabled>RM</option><option>EN</option>
      </select>
      <div class="select__icon"><svg role="presentation" aria-hidden="true" viewBox="0 0 24 24">…Chevron…</svg></div>
    </div>
  </div>
</div>
```

| Element | Eigenschaft | Wert |
|---|---|---|
| .language-switcher | layout | flex, cursor pointer |
| select | Breite | 3.5em, ab lg 4.5em; padding-left 4px (pl-1), ab lg 16px (pl-4); cursor pointer; transition-colors |
| option:disabled | Farbe | #9ca3af (text-400) |
| .select__icon (hier) | Breite | 24px (w-6), transition-colors |
| select:hover/:focus + .select__icon | Farbe | #d1d5db (text-300) |
| .select--bare (select.postcss Z. 9–26) | Reset | width auto, inline-block, margin-top 0 !important; select: inline-block, padding-right 24px (pr-6), shadow transparent, border transparent, bg transparent, focus outline-none; Icon w-6, kein border-l; bei input--negative: Icon-bg transparent |
| Kontexte .top-header__right / .top-bar | Höhe | .select, .form__group__select, select: height 100 % |
| Allgemeines .select__icon (select.postcss Z. 37–56) | Layout | 48px breit (w-12), height 100 %, absolut oben rechts, flex zentriert, border-left 1px #6b7280, pointer-events none; svg w-8 h-full; bei input--negative: Text #fff, Border #828e9a, bg #46596b |
| select disabled | opacity | 0.4 (inkl. Icon) |

---

### 17. link

Quelle: `css/components/link.postcss` (kein SFC; gilt automatisch für `main a`).

```html
<a class="link" href="…">Text</a>
<a class="link link--external" | main a[rel*='external'] …>Text<!-- ::after-Icon --></a>
```

| Element/Zustand | Wert |
|---|---|
| .link, main a (Default) | color #d8232a (primary-600), underline, underline-offset 2px, cursor pointer, break-words |
| hover / focus | color #99191e (primary-800) |
| .link--negative | color #fff; hover/focus #d1d5db (text-300); underline offset 2px |
| .link--block | display block; .link--block + .link--block: margin-top 12px (mt-3) |
| .link--external, main a[rel*='external'] | wie .link; ausser bei .btn/.btn--link: ::after-Icon inline-block 1em×1em, relative top 0.2em, margin-inline 0.125em, bg currentColor, mask `--icon-external-link` (data-URI-SVG, link.postcss Z. 38) |

---

### 18. list

Quelle: `css/components/list.postcss` (kein SFC; gilt für `main ul/ol:not([class])`).

```html
<ul class="list--default | list--bare | list--roman [list--loose] [list--indented] [list--negative]">…
<ol class="list--ordered">…
<ul class="list--icon"><li><svg class="icon--xl|icon--2xl"/>Text</li></ul>
```

| Klasse | Werte |
|---|---|
| .list--bare, main .list--bare | list-style none, padding-left 0 |
| .list--default, main ul:not([class]) | list-style disc outside, padding-left 20px (pl-5), Abstand zwischen li 8px (space-y-2) |
| .list--ordered, main ol:not([class]) | list-style decimal outside, padding-left 20px, space-y-2 (8px) |
| .list--default.list--indented li | margin-left 6px (ml-1.5), padding-left 14px (pl-3.5) |
| .list--roman | list-style upper-roman outside, padding-left 20px |
| .list--loose | Abstand 12px (space-y-3) |
| .list--negative | color #fff |
| .list--flex / .list--wrap | display flex / flex-wrap wrap |
| .list--icon | padding-left 0; li flex mit space-x-2 (8px); .icon--xl relative top -4px; .icon--2xl top -8px, ab lg -12px, ab 3xl -14px |

---

### 19. load-more

Quelle: `css/components/load-more.postcss`; kanonische Verwendung `app/pages/glossar.vue` Z. 200–208 / `indexPage.vue` Z. 200–208.

```html
<div class="load-more-container">
  <!-- Btn: variant="outline" size="sm" label="Mehr laden" :disabled="!canLoadMore" -->
</div>
```

| Eigenschaft | Wert |
|---|---|
| padding-top | 16px (pt-4), ab md 56px (pt-14) |
| margin-bottom | 16px (mb-4), ab md 24px (mb-6) |
| Leer-/Endzustand | Button erhält `disabled` (btn--outline disabled: Text #828e9a, Border #acb4bd); Container entfällt bei 0 Resultaten (v-if) |

---

### 20. logo

Quellen: `css/components/logo.postcss`, `Logo.vue`.

#### Struktur (Logo.vue Z. 1–293)

```html
<a class="logo [logo--print-hidden|logo--print-only]" href="{link}">
  <svg class="logo__flag" viewBox="0 0 40 44" role="img" aria-hidden="true">…Schweizer Wappen (#ff0000/#ffffff)…</svg>
  <!-- Freebrand-Variante: class="logo__freebrand" statt logo__flag, ohne logo__name -->
  <svg class="logo__name" viewBox="0 0 244 70" role="img" aria-hidden="true">…Schriftzug…</svg>
  <div class="logo__separator" role="separator" aria-hidden="true"></div>
  <div class="logo-title__container">
    <div class="logo__accronym">…</div>
    <div class="logo__title">
      <div>Titel</div>
      <div class="badge-easy-language">Inhalte in Leichter Sprache</div>   <!-- optional -->
      <div class="badge-sign-language">Inhalte in Gebärdensprache</div>    <!-- optional -->
    </div>
  </div>
</a>
```

| Element | Eigenschaft | Wert |
|---|---|---|
| .logo | layout | flex items-center nowrap, ab md items-start; transition-opacity 700ms; bei body--mobile-menu-is-open opacity 0 |
| .logo__flag | Grösse | 30×33px; ab lg 32×34px; ab 3xl 40×44px; flex-shrink 0 |
| .logo__freebrand | Höhe | 40px; ab lg 60px; ab 3xl 80px |
| .logo__name | Grösse | 174×50px, hidden bis xl (ab 1280px block); ab 3xl 244×70px; overflow visible |
| .logo__separator | Linie | width 1px (w-px); height 40px, ab md 56px (h-14), ab 3xl 70px; margin-inline 8px, ab sm 16px, ab lg 24px, ab 3xl 32px (beidseitig); background #D1D5DB (Hex hart codiert, logo.postcss Z. 73) |
| .logo__title | Schrift | sr-only bis xs (ab 480px sichtbar); ab md whitespace-nowrap; font-size 14px (text-sm), xs 12px, sm 14px, xl 16px, 3xl 18px; font-bold; leading-snug 1.375; margin-top -0.160rem (-2.56px) |
| .logo__accronym | Schrift | font-bold, leading-snug; ab xs hidden (nur Mobil-Kürzel) |
| .badge-easy-language | Badge | badge + badge--green (#065f46 auf #d1fae5), margin-top 4px, margin-left -1px, width fit-content, font-bold; hidden, ab md block |
| .badge-sign-language | Badge | badge, Text #312e81 (indigo-900), bg #e0e7ff (indigo-100), sonst wie easy-language |
| .logo--print-hidden / --print-only | Druck | flex + print:hidden bzw. hidden + print:flex |

---

### Anhang: geprüfte Abweichungen/Fallstricke für das Review

1. `font-bold` ändert die font-family (Font-Bold), nicht das font-weight (bleibt 400) — Fettdarstellung via Fontdatei (dist/main.css bestätigt).
2. `text-*`-Utilities setzen NUR font-size (Skalarwerte im Config) — line-height kommt immer separat (leading-*).
3. Fokus ist zentral: `*:focus-visible` → Ring 2px #8655F6; Karten-Listen (`card--list`) verschieben den Ring auf das ::after-Overlay.
4. 2xl-Breakpoint ist 1544px (nicht Tailwind-Standard 1536px); 3xl = 1920px existiert zusätzlich.
5. red-Skala = primary-Skala im Default-Skin (identische Hexwerte) — «error» und «Bundesrot» sind visuell gleich.
6. Badge-Padding ist em-basiert (0.219em/1em) und skaliert mit der Badge-Schriftgrösse.
7. `.logo__separator` nutzt den hart codierten Hex #D1D5DB (= text-300), nicht das Token.
8. `.glossar-result__title` ist die einzige Stelle mit explizitem `font-weight: 600`.

## CD Bund Design System 1.0.5 — Komponenten M–Z (Messlatte für Pixel-Review)

Quelle: `C:\Users\david\Documents\GitHub\designsystem` (package.json: version 1.0.5).
Alle Tailwind-Klassen sind gegen `app/tailwind.config.js` (eigene Screens-, FontSize-, Shadow-, Radius-, Farb-Skalen) aufgelöst. 1 rem = 16px.

### 0 Auflösungs-Grundlagen

#### 0.1 Breakpoints (app/tailwind.config.js Z. 20–28)

| Screen | min-width |
|---|---|
| xs | 480px |
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| 2xl | 1544px |
| 3xl | 1920px |

Container-max-width (Z. 29–32): 2xl → 1544px, 3xl → 1676px.

#### 0.2 Font-Size-Skala (app/tailwind.config.js Z. 204–218, ÜBERSCHREIBT Tailwind-Default)

| Utility | Wert |
|---|---|
| text-xs | 0.75rem / 12px |
| text-sm | 0.875rem / 14px |
| text-base | 1rem / 16px |
| text-lg | 1.125rem / 18px |
| text-xl | 1.25rem / 20px |
| text-2xl | 1.375rem / 22px |
| text-3xl | 1.625rem / 26px |
| text-4xl | 2rem / 32px |
| text-5xl | 2.5rem / 40px |

WICHTIG: `fontWeight: { normal: 400, bold: 400 }` (Z. 200–203) — `font-bold` setzt `font-weight: 400`; Fettdruck entsteht NUR über die Font-Family `Font-Bold` (`.font--bold`/`.text--bold`, css/foundations/typography.postcss Z. 69–72).

#### 0.3 Responsive Text-Klassen (css/foundations/typography.postcss Z. 43–57)

| Klasse | Basis | ≥1280px (xl) | ≥1920px (3xl) |
|---|---|---|---|
| .text--xs | 12px | 14px | 16px |
| .text--sm | 14px | 16px | 18px |
| .text--base | 16px | 18px | 20px |
| .text--lg | 18px | 20px | 22px |

`.legend` (Z. 131–133): `.text--xs` + `padding-top: 8px` + `color: #6b7280` (text-500).

#### 0.4 Schatten (app/tailwind.config.js Z. 225–235)

| Utility | Wert |
|---|---|
| shadow (DEFAULT) | 0px 1px 2px 0px rgba(0,0,0,0.06), 0px 1px 5px 0px rgba(0,0,0,0.08) |
| shadow-md | 0px 2px 4px -1px rgba(0,0,0,0.06), 0px 4px 10px -1px rgba(0,0,0,0.08) |
| shadow-lg | 0px 2px 6px -1px rgba(0,0,0,0.06), 0px 5px 20px -3px rgba(0,0,0,0.08) |
| shadow-2xl | 0px 10px 20px 0px rgba(0,0,0,0.06), 1px 10px 70px -8px rgba(0,0,0,0.13) |

#### 0.5 Radien (app/tailwind.config.js Z. 236–249)

| Utility | Wert |
|---|---|
| rounded-xs | 0.0625rem / 1px |
| rounded-sm | 0.125rem / 2px |
| rounded (DEFAULT) | 0.1875rem / 3px |
| rounded-full | 9999px |

#### 0.6 Relevante Farben

Skin «default» (css/skins/default.postcss Z. 7–27); `text-*` = `gray-*` (identische Skala, tailwind.config.js Z. 64–75/184–195); `red-*` ist die CD-Bund-Rotskala (Z. 148–159).

| Token | Hex |
|---|---|
| primary-300 | #fa9da1 |
| primary-500 | #e53940 |
| primary-600 | #d8232a |
| primary-700 | #bf1f25 |
| secondary-50 | #f0f4f7 |
| secondary-100 | #dfe4e9 |
| secondary-200 | #acb4bd |
| secondary-300 | #828e9a |
| secondary-400 | #596978 |
| secondary-500 | #46596b |
| secondary-600 | #2f4356 |
| secondary-700 | #263645 |
| text-/gray-50 | #f9fafb |
| text-/gray-200 | #e5e7eb |
| text-/gray-300 | #d1d5db |
| text-/gray-400 | #9ca3af |
| text-/gray-500 | #6b7280 |
| text-/gray-600 | #4b5563 |
| text-/gray-700 | #374151 |
| text-/gray-800 | #1f2937 |
| text-/gray-900 | #111827 |
| red-50 | #ffedee |
| red-100 | #fae1e2 |
| red-300 | #fa9da1 |
| red-500 | #e53940 |
| red-600 | #d8232a |
| red-800 | #99191e |
| red-900 | #801519 |
| green-50 | #ecfdf5 |
| green-100 | #d1fae5 |
| green-500 | #10b981 |
| green-800 | #065f46 |
| blue-50 | #eff6ff |
| blue-100 | #dbeafe |
| blue-700 | #1d4ed8 |
| blue-800 | #1e40af |
| orange-50 | #fff7ed |
| orange-100 | #ffedd5 |
| orange-800 | #9a3412 |
| yellow-100 | #fef3c7 |
| yellow-800 | #92400e |
| purple-500 | #8655F6 |

#### 0.7 Input-Grundwerte (css/components/input.postcss Z. 1–19; von Select/Textarea/Pagination/MultiSelect referenziert)

`:root`: `--input-min-height: 44px`, `--input-min-height-2xl: 48px`.
`.input, input, textarea, select`: width 100%; padding 0.625rem 1rem (10px 16px); shadow (DEFAULT, s. 0.4); background #ffffff; border 1px solid #6b7280 (text-500); border-radius 1px (rounded-xs); line-height 1 (leading-none); min-height 44px, ≥1544px 48px; focus: outline none; placeholder #596978 (secondary-400).
Zustände: `[disabled], .input--disabled` (Z. 38–44): bg #f9fafb, Text #9ca3af, Border #d1d5db, pointer-events none, cursor not-allowed. `.input--error` (Z. 50–58): Text #99191e, Border #e53940, Placeholder #fc656b. `.input--negative` (Z. 60–72): Text #ffffff, bg #46596b, Placeholder #f0f4f7 (secondary-50), Border #828e9a; hover/focus Text #d1d5db; disabled bg #828e9a, Text #acb4bd. `.input--error.input--negative` (Z. 74–76): Text #ffccce (red-200), Border #fa9da1 (red-300).
Grössen: `.input--sm` text--sm + line-height 1.5rem/24px; `.input--base` text--base + leading-6 (24px); `.input--lg` text--lg + leading-7 (28px) (Z. 21–31).

#### 0.8 Formular-Meldung (Badge) — unter Select/MultiSelect/Textarea

`div.badge.badge--sm.badge--{error|warning|success|info}` (Select.vue Z. 24–30). Werte aus css/components/badge.postcss: `.badge` (Z. 5–9): inline-flex items-center; padding 0.219em 1em; border-radius 9999px. `.badge--sm` (Z. 79–82): font-size 10px, ≥768px 12px, ≥1024px 14px; line-height 1rem/16px, ≥768px 1.35rem/21.6px. Farben (Z. 23–50): error #99191e auf #fae1e2; warning #9a3412 auf #ffedd5; success #065f46 auf #d1fae5; info #1e40af auf #dbeafe.

#### 0.9 Transition-Utilities (Tailwind-Default)

`transition-colors`: property color, background-color, border-color, text-decoration-color, fill, stroke; 150ms; cubic-bezier(0.4, 0, 0.2, 1). `transition` (ohne Suffix): zusätzlich opacity, box-shadow, transform, filter, backdrop-filter; 150ms. `duration-200` = 200ms, `duration-300` = 300ms.

---

### 1 Mask (css/components/mask.postcss Z. 5–9)

Kein Vue-Pendant. Reines CSS:

| Selektor | Eigenschaft | Wert |
|---|---|---|
| .mask | mask-size | contain |
| .mask | mask-repeat | no-repeat |
| .mask | mask-position | center |

---

### 2 Menu (css/components/menu.postcss)

Kein Vue-Pendant. Kanonische Struktur: `ul.menu > li/a .menu__item (+Modifier) > .menu__item__flex > … + .icon.menu__item__icon`.

| Selektor | Werte | Quelle |
|---|---|---|
| .menu | list-style: none; a und a:hover: text-decoration none, color inherit | Z. 5–12 |
| .menu__item | display flex; align-items center; justify-content space-between; padding 12px 16px (0.75rem 1rem); position relative; cursor pointer; transition-colors (s. 0.9) | Z. 14–22 |
| .menu__item:hover | background #f0f4f7 (secondary-50) | Z. 20 |
| .menu__item:focus | color #d8232a (primary-600) | Z. 21 |
| .menu__item--small | font-size 14px, ≥1920px 16px | Z. 24–26 |
| .menu__item--action-btn | padding 12px 16px; ≥1024px font-size 12px; ≥1920px 14px; color #6b7280 (auch :focus) | Z. 28–32 |
| .menu__item--mini | padding 8px 16px | Z. 34–36 |
| .menu__item--border | border-bottom 1px solid #dfe4e9 (secondary-100), border-opacity 100% | Z. 38–40 |
| .menu__item--grey | background #f0f4f7 | Z. 42–44 |
| .menu__item--negative | background #2f4356 (secondary-600); color #ffffff; border-bottom 1px solid #596978 (secondary-400) | Z. 46–50 |
| .menu__item.menu__item--negative:hover | background #263645 (secondary-700) | Z. 52–54 |
| .menu__item--negative:focus | color #fa9da1 (primary-300) | Z. 56–58 |
| .menu__item--brim | padding-left/right 8px | Z. 60–62 |
| .icon.menu__item__icon | height 24px (1.5rem), ≥768px 28px (1.75rem) | Z. 64–66 |
| .menu__item--title | ≥1024px padding-x 0; hover background #ffffff; cursor default | Z. 68–71 |
| .menu__item--active::after | content ''; display block; background #e53940 (primary-500); width 3px; position absolute; top/bottom/left 0. In `.container__aside .sticky`: display none, ≥768px block | Z. 75–85 |
| .menu__item--condensed | padding 12px 12px; enthaltenes .icon ≥1024px 24px × 24px | Z. 87–93 |
| .menu__item--icon-on-hover | .menu__item__icon opacity 0, transition opacity 200ms; :hover → opacity 1 | Z. 95–103 |
| .menu__item__flex | display flex; width 100%; align-items center; justify-content space-between; horizontaler Abstand 8px (space-x-2) | Z. 105–107 |
| .menu__action-btn | flex; align-items center; justify-content space-between; padding 12px 16px; relative; font-size 14px, ≥1920px 16px; border 0; cursor pointer; transition-colors; color #6b7280 | Z. 109–117 |
| .menu__action-btn:hover | background #f0f4f7; color #4b5563 | Z. 119–123 |

---

### 3 Meta-Info (css/components/meta-info.postcss + MetaInfo.vue)

Struktur (MetaInfo.vue Z. 1–11): `p.meta-info > span.meta-info__item{n}` (Prop `metainfos: string[]`, required). Keine ARIA-Attribute.

| Selektor | Werte | Quelle |
|---|---|---|
| .meta-info | color #6b7280 (gray-500); .text--sm (14px / xl 16px / 3xl 18px) | meta-info.postcss Z. 5–7 |
| .meta-info__item in `.bg--secondary-50` oder `.box` | color #4b5563 (text-600) | Z. 9–14 |
| .meta-info__item:not(:last-child):after | content '\|'; padding-left/right 8px, ≥1024px 12px | Z. 16–19 |

---

### 4 Modal (css/components/modal.postcss + Modal.vue)

Kanonische Struktur (Modal.vue Z. 1–44):

```html
<div class="modal [modal--auto|--xs|--sm|--md|--lg|--xl]" open="true|false" aria-modal="{isOpen}">
  <div class="modal__content" role="dialog" aria-labelledby="modal-title-{uuid}" aria-describedby="modal-desc-{uuid}">
    <header class="modal__header [modal__header--with-title]">
      <h4 id="modal-title-{uuid}" class="h4">…</h4>          <!-- nur mit title -->
      <button tabindex="0" class="modal__close" aria-label="close"><svg class="icon icon--2xl icon--Cancel"/></button>
    </header>
    <div id="modal-desc-{uuid}" class="modal__body">…</div>   <!-- slot body -->
    <footer class="modal__footer">…</footer>                  <!-- slot footer -->
  </div>
  <div tabindex="0" class="modal__backdrop" aria-label="close"></div>
</div>
```

Verhalten (Modal.vue): öffnet über externe `triggerElements` (querySelectorAll + click, Z. 131–135); bei open Fokus auf Close-Button via requestAnimationFrame (Z. 100–103); Escape schliesst (keyup-Listener, Z. 121–125); Fokus auf Backdrop wird auf den Close-Button umgeleitet (Z. 127–129); beim Schliessen Fokus zurück aufs Trigger-Element (Z. 111–114).

| Selektor | Werte | Quelle (modal.postcss) |
|---|---|---|
| .modal, .modal__backdrop | width 100%; height 100%; top 0; left 0 | Z. 5–8 |
| .modal | display none; position fixed; z-index 40; padding-top/bottom 10vh | Z. 10–15 |
| .modal[open='true'] | display block | Z. 20–22 |
| .modal--auto | text-align center | Z. 16–18 |
| .modal__backdrop | position absolute; z-index 30; background rgba(17,24,39,0.7) (text-900/70); cursor pointer | Z. 25–29 |
| .modal__content | position relative; z-index 40; max-height 80vh; display flex; flex-direction column; align-items stretch; margin 0 auto; width 100%; padding-x 28px (1.75rem); ≥1544px max-width 1544px; ≥1920px max-width 1676px | Z. 31–43 |
| .modal--xs .modal__content | max-width 480px | Z. 52–54 |
| .modal--sm .modal__content | max-width 640px | Z. 56–58 |
| .modal--md .modal__content | max-width 768px | Z. 60–62 |
| .modal--lg .modal__content | max-width 1024px | Z. 64–66 |
| .modal--xl .modal__content | max-width 1280px | Z. 68–70 |
| .modal--auto .modal__content | display inline-flex; width auto; text-align left | Z. 72–74 |
| .modal__header | display flex; justify-content flex-end; align-items flex-start; width 100%; color #ffffff; margin-bottom 8px, ≥1024px 16px | Z. 77–82 |
| .modal__header--with-title | justify-content space-between | Z. 84–86 |
| .modal__close | position relative; margin-right -12px; margin-top -4px, ≥1024px -8px; padding-left 40px (2.5rem); cursor pointer; :hover opacity 0.5 | Z. 88–97 |
| .modal__close Icon | icon--2xl: height 36px, ≥768px 40px, ≥1024px 48px | Modal.vue Z. 23 + icons.postcss Z. 39–41 |
| .modal__body | width 100%; overflow auto | Z. 99–101 |
| .modal__footer | width 100%; height auto; text-align right; padding 16px; background #ffffff; border-top 1px solid #dfe4e9 (secondary-100) | Z. 103–107 |

---

### 5 MultiSelect (css/components/multiselect.postcss + MultiSelect.vue)

Kanonische Struktur (MultiSelect.vue Z. 1–57):

```html
<div class="form__group__select">                                <!-- w-full; space-y-2 → 8px Abstand (form.postcss Z. 12–15) -->
  <label for="multi-select-{uuid}" class="[text--negative] [text--{size}] [sr-only] [text--asterisk]">…</label>
  <div class="select shadow-lg [select--bare]">
    <div class="v-select input--{outline|negative} input--{sm|base|lg} [input--disabled] [input--{error|warning|success|info}] vs--multiple …">
      … <input class="vs__search" [required] …>                  <!-- required-Workaround, Z. 30–39 -->
    </div>
    <div class="select__icon"><svg role="presentation" aria-hidden="true" viewBox="0 0 24 24"><path d="m5.706 10.015 …"/></svg></div>
  </div>
  <div class="badge badge--sm badge--{messageType}">…</div>      <!-- optional (s. 0.8) -->
</div>
```

Custom-Komponenten: Deselect = `<span>×</span>`, OpenIndicator = leeres `<span>` (Vue Z. 66–67). Der Wrapper trägt IMMER `shadow-lg` (Vue Z. 145). `multiple` default true, Änderung sendet `window.postMessage({trigger:'emitSelect', …})` (Z. 172–178).

#### 5.1 Effektive CSS-Variablen auf `.v-select` (multiselect.postcss Z. 1–76; Overrides Z. 58–76 gewinnen)

| Variable | Effektiver Wert |
|---|---|
| --vs-font-size | inherit |
| --vs-line-height | 1.375 |
| --vs-search-input-placeholder-color | #9ca3af (text.400) |
| --vs-search-input-bg | inherit |
| --vs-search-input-color | inherit |
| --vs-border-color | #6b7280 (text.500) |
| --vs-border-width | 1px |
| --vs-border-style | solid |
| --vs-border-radius | 0px |
| --vs-actions-padding | 4px 3em 0 3px |
| --vs-controls-color | rgba(60,60,60,0.5) |
| --vs-selected-bg | #e5e7eb (text.200) |
| --vs-selected-color | #333 |
| --vs-selected-border-color | transparent |
| --vs-dropdown-bg | #fff |
| --vs-dropdown-z-index | 1000 |
| --vs-dropdown-min-width | 160px |
| --vs-dropdown-max-height | 350px |
| --vs-dropdown-box-shadow | 0px 3px 6px 0px rgba(0,0,0,0.15) |
| --vs-dropdown-option-padding | 3px 20px |
| --vs-dropdown-option--active-bg | #4b5563 (text.600) |
| --vs-dropdown-option--active-color | #ffffff |
| --vs-dropdown-option--deselect-bg | #fb5858 |
| --vs-dropdown-option--deselect-color | #fff |
| --vs-state-disabled-bg | #f9fafb (text.50) |
| --vs-state-disabled-color | #9ca3af (text.400) |
| --vs-state-disabled-controls-color | #9ca3af |
| --vs-state-disabled-cursor | not-allowed |
| --vs-transition-timing-function | cubic-bezier(1, -0.115, 0.975, 0.855) |
| --vs-transition-duration | 150ms |

#### 5.2 Custom-Klassen (multiselect.postcss Z. 80–137)

| Selektor | Werte |
|---|---|
| .v-select input, .v-select .vs__selected | min-height calc(44px − 10px) = 34px; ≥1544px calc(48px − 8px) = 40px (Z. 80–85) |
| .v-select.input--lg input / .vs__selected | min-height 44px − 6px = 38px; ≥1544px 48px − 6px = 42px (Z. 87–91) |
| .v-select .vs__selected | padding 4px 12px (py-1 px-3); border-radius 9999px (Z. 93–95) |
| .v-select .vs__selected-options | padding-left 8px (Z. 96–98); mit Auswahl in vs--multiple: padding-left 2px (Z. 104–106) |
| .v-select .vs__deselect | display block; width 20px (1.25rem); height 100%; text-align right; :hover color #d8232a (red-600) (Z. 100–102) |
| .v-select .vs__dropdown-option | white-space normal (Z. 108–110) |
| .v-select .vs__dropdown-option--selected::after | content '✔'; position relative; margin-left 8px (Z. 112–114) |
| .v-select.input--error | --vs-border-color: #e53940 (red.500) (Z. 116–118) |
| .v-select.input--negative | --vs-dropdown-bg #2f4356; --vs-dropdown-color #dfe4e9; Option-Farbe #ffffff; --vs-selected-bg #263645; --vs-selected-color #ffffff; --vs-selected-border-color #828e9a; --vs-search-input-color #dfe4e9; active-bg #6b7280; active-color #ffffff (Z. 120–133) |
| .v-select.input--error.input--negative | --vs-border-color: #fa9da1 (red.300) (Z. 135–137) |

#### 5.3 vue-select-Basisklassen und Zustände (multiselect.postcss Z. 139–443)

| Selektor / Zustand | Werte |
|---|---|
| .vs__dropdown-toggle | appearance none; display flex; padding 0 0 4px; background var(--vs-search-input-bg); border 1px solid #6b7280; border-radius 0 (Z. 209–217) |
| .vs__selected-options | display flex; flex-basis 100%; flex-grow 1; flex-wrap wrap; padding 0 2px; position relative (Z. 219–226) |
| .vs__actions | display flex; align-items center; padding 4px 3em 0 3px (Z. 228–232) |
| .vs--searchable .vs__dropdown-toggle | cursor text (Z. 234–236); .vs--unsearchable: cursor pointer (Z. 238–240) |
| .vs--open .vs__dropdown-toggle | border-bottom-color transparent; border-bottom-radius 0 (Z. 242–246) |
| .vs__open-indicator | fill rgba(60,60,60,0.5); transition transform 150ms cubic-bezier(1,-0.115,0.975,0.855) (Z. 248–254); .vs--open: rotate(180deg) (Z. 256–258); .vs--loading: opacity 0 (Z. 260–262) |
| .vs__clear | fill rgba(60,60,60,0.5); padding 0; border 0; background transparent; cursor pointer; margin-right 8px (Z. 264–271) |
| .vs__dropdown-menu | display block; position absolute; top calc(100% − 1px); left 0; z-index 1000; padding 5px 0; width 100%; max-height 350px; min-width 160px; overflow-y auto; box-shadow 0px 3px 6px 0px rgba(0,0,0,0.15); border 1px solid #6b7280, border-top none; border-radius 0; background #fff (Z. 273–294) |
| .vs__no-options | text-align center (Z. 296–298) |
| .vs__dropdown-option | line-height 1.42857143; display block; padding 3px 20px; white-space nowrap (custom: normal, s. 5.2); cursor pointer (Z. 300–308) |
| .vs__dropdown-option--highlight | background #4b5563; color #ffffff (Z. 310–313) |
| .vs__dropdown-option--deselect | background #fb5858; color #fff (Z. 315–318) |
| .vs__dropdown-option--disabled | background #f9fafb; color #9ca3af; cursor not-allowed (Z. 320–324) |
| .vs__selected | display flex; align-items center; background #e5e7eb; border 1px solid transparent; line-height 1.375; margin 4px 2px 0; padding 0 0.25em (custom: 4px 12px, s. 5.2) (Z. 326–338) |
| .vs__deselect | display inline-flex; margin-left 4px; padding 0; border 0; cursor pointer; text-shadow 0 1px 0 #fff (Z. 340–350) |
| .vs--single .vs__selected | background transparent; border transparent; bei .vs--loading/.vs--open: position absolute, opacity 0.4; bei .vs--searching: display none (Z. 352–367) |
| .vs__search, .vs__search:focus | appearance none; line-height 1.375; font-size inherit; border 1px solid transparent, border-left none; outline none; margin 4px 0 0; padding 0 7px; background none; width 0; max-width 100%; flex-grow 1; z-index 1 (Z. 380–397) |
| .vs__search::placeholder | color #9ca3af (Z. 399–401) |
| .vs--unsearchable .vs__search | opacity 1; nicht-disabled: cursor pointer (Z. 403–411) |
| .vs--single.vs--searching:not(.vs--open):not(.vs--loading) .vs__search | opacity 0.2 (Z. 413–417) |
| .vs--disabled | .vs__clear/.vs__dropdown-toggle/.vs__open-indicator/.vs__search/.vs__selected: cursor var(--vs-disabled-cursor), background var(--vs-disabled-bg) (Z. 178–187) |
| .vs__spinner | 5em × 5em; border 0.9em solid hsla(0,0%,39.2%,0.1); border-left-color rgba(60,60,60,0.45); animation vSelectSpinner 1.1s linear infinite; opacity 0, bei .vs--loading opacity 1 (Z. 419–443) |
| .vs__fade-enter/leave | opacity 0; transition opacity 150ms cubic-bezier(1,-0.115,0.975,0.855) (Z. 166–176) |

---

### 6 Navbar (css/components/navbar.postcss Z. 1–6)

Kein Vue-Pendant.

| Selektor | Werte |
|---|---|
| .navbar | display flex; align-items center |
| .navbar > * | display flex |

---

### 7 Notification (css/components/notification.postcss + Notification.vue)

Kanonische Struktur (Notification.vue Z. 1–29):

```html
<div class="notification [notification--{info|warning|error|success|alert|hint}] [notification--with-title]">
  <svg class="icon icon--base icon--{icon} notification__icon"/>       <!-- ohne Titel -->
  <div class="notification__header">                                    <!-- mit Titel -->
    <svg class="… notification__icon"/>
    <h2 class="h2 notification__title">…</h2>                           <!-- heading h2–h5, v-html -->
  </div>
  <div class="notification__content [notification__content-offset]">…</div>  <!-- v-html text -->
  <button class="notification__close" aria-label="Close notification"><svg class="icon icon--base icon--Cancel"/></button>
</div>
```

| Selektor | Werte | Quelle |
|---|---|---|
| .notification | display flex; position relative; padding 8px, ≥480px 16px, ≥1024px 24px, ≥1544px 32px; border-radius 3px (0.1875rem); box-shadow shadow-lg (s. 0.4); background #f9fafb (gray-50) | Z. 5–10 |
| .notification .btn, a, a[target], a[rel*=external] | color currentColor; border-color currentColor; :hover color currentColor + filter brightness(0.5) | Z. 11–21 |
| .notification a, a[target=_blank] | text-decoration underline; text-underline-offset 2px | Z. 23–26 |
| .notification--error | background #ffedee (red-50); color #99191e (red-800) | Z. 29–33 |
| .notification--success | background #ecfdf5 (green-50); color #065f46 (green-800) | Z. 35–38 |
| .notification--info | background #eff6ff (blue-50); color #1d4ed8 (blue-700) | Z. 40–43 |
| .notification--hint | background #f0f4f7 (secondary-50); color #374151 (text-700) | Z. 45–48 |
| .notification--warning | background #fff7ed (orange-50); color #9a3412 (orange-800) | Z. 50–53 |
| .notification--alert | background #801519 (red-900); color #ffffff (spätere Regel Z. 55–58 überschreibt Z. 29–33) | Z. 55–58 |
| .notification__icon | margin-right 12px; height 40px; width 40px (2.5rem); flex-shrink 0; fill currentColor | Z. 60–65 |
| .notification__close | position absolute; top 0; right 0; svg 32px × 32px (2rem) | Z. 67–73 |
| .notification__content | min-width 0; margin-top 10px (0.625rem), ≥1280px 8px; margin-bottom 10px, ≥1280px 8px; > p: overflow-wrap break-word, margin 0 | Z. 75–83 |
| .notification__content > *:first-child | margin-bottom 4px | Z. 85–87 |
| .notification .btn | margin-top 16px, ≥640px 32px, ≥1024px 0; ≥1024px margin-left 24px | Z. 89–92 |
| .notification__header | display flex; align-items center; width 100%; .notification__title margin-bottom 0 | Z. 98–104 |
| .notification--with-title | display block; .notification__content-offset margin-left 3.3rem (52.8px) | Z. 106–112 |
| .cookie-banner .btn__text | white-space nowrap | Z. 94–96 |

Typ-Validator (Vue Z. 44–51): info, warning, error, success, alert, hint. `closeBtn` default true.

---

### 8 Notification-Banner (css/components/notification-banner.postcss + NotificationBanner.vue)

Klassenzusammensetzung (Vue Z. 57–62): `notification-banner [notification-banner--fixed] notification notification--{type}` — erbt also die komplette Notification-Basis inkl. Typfarben (s. 7); Typ-Default `info`, Validator info/warning/error/success (Z. 49–55). Inhalt: `div.notification-banner__wrapper > p.notification-banner__infos + Btn(outline, sm, Icon rechts «Checkmark») + Btn(bare, sm, Icon rechts «Cancel»)` (Z. 1–33).

| Selektor | Werte | Quelle |
|---|---|---|
| .notification-banner | ≥1024px: display flex, flex-nowrap, align-items flex-end, justify-content space-between; padding-x 0; padding-y 16px, ≥640px 32px, ≥1024px 40px; .text--sm (14/16/18px); box-shadow none | Z. 5–11 |
| .notification-banner--fixed | position fixed; z-index 50; right/bottom/left 0; width 100vw; border 1px + border-top solid #ffffff; box-shadow shadow-2xl (s. 0.4) | Z. 13–17 |
| .notification-banner__wrapper | .container (width 100%; margin auto; padding-x 16px, ≥480px 28px, ≥640px 36px, ≥1024px 40px, ≥1280px 48px, ≥1920px 64px; max-width ≥1544px 1544px / ≥1920px 1676px; overflow-x clip — css/layouts/container.postcss Z. 5–11); ≥1024px flex nowrap items-start justify-between | Z. 19–22 |
| .notification-banner .btn | margin-top 16px, ≥640px 32px, ≥1024px 0; ≥1024px margin-left 24px | Z. 24–27 |
| .notification-banner .btn__text | white-space nowrap | Z. 29–31 |
| .notification-banner__infos | overflow-wrap break-word | Z. 33–35 |

---

### 9 Pagination (css/components/pagination.postcss + Pagination.vue + PaginationItem.vue)

Kanonische Struktur (Pagination.vue Z. 1–25):

```html
<div class="pagination [pagination--extended]">          <!-- --extended nur ohne Eingabefeld -->
  <input class="pagination__input input input--base input--{outline|outline-negative}" aria-label="pagination input">
  <div class="pagination__text">{totalPages}</div>
  <ul class="pagination_items">                          <!-- CSS zielt auf das ul-Element, nicht die Klasse -->
    <li><button type="button" class="btn btn--{outline|outline-negative} btn--icon-only" aria-label="…" [disabled]>
      <svg class="icon icon--base icon--{icon} btn__icon"/><span class="btn__text">…</span>
    </button></li>
  </ul>
</div>
```

Erstes Item wird `disabled`, wenn `currentPage === '1'` (Vue Z. 20).

| Selektor | Werte | Quelle |
|---|---|---|
| .pagination | display flex; align-items stretch; Kind-Abstand 12px (space-x-3, margin-left) | pagination.postcss Z. 5–6 |
| .pagination input | width 48px (3rem); height 100%; text-align center; padding-x 8px; + .btn--base: min-height 44px, ≥1280px 48px, ≥1920px 52px; .text--base (16/18/20px); line-height 20px, ≥1024px 24px | Z. 8–11 + btn.postcss Z. 113–117 |
| .pagination .pagination__text | display flex; align-items center | Z. 13–15 |
| .pagination ul | display flex; flex-wrap wrap; align-items center; white-space nowrap; height 100%; Kind-Abstand 4px, ≥1024px 8px, ≥1280px 12px | Z. 17–21 |
| .pagination--extended li | margin-bottom 12px | Z. 24–28 |
| .pagination--right | display flex; justify-content flex-end; padding-y 24px, ≥1024px 28px, ≥1544px 32px | Z. 30–32 |

---

### 10 Popover (css/components/popover.postcss + Popover.vue)

Kanonische Struktur (Popover.vue Z. 1–33):

```html
<span id="popover-wrapper-{id}" class="popover-wrapper">
  <button id="popover-button-{id}" class="popover-button" aria-controls="popover-{id}" aria-haspopup="dialog" aria-expanded="false">
    <span class="popover-button__label">…</span>
    <svg class="icon icon--lg icon--HelpCircle popover-button__icon"/>
  </button>
  <span class="popover-backdrop" aria-hidden="true"></span>
  <span id="popover-{id}" class="popover popover--{color}" aria-hidden="true" role="tooltip">
    <span class="popover__close" aria-hidden="true"><svg class="icon icon--lg icon--Cancel"/></span>
    …slot…
  </span>
</span>
```

Initialisierung über `Popover.init('#popover-wrapper-{id}')` (Vue Z. 83–85). Aktiv-Zustand via Klassen `.popover--active` / `.popover-backdrop--active`. Farb-Validator (Vue Z. 53–69) enthält `gray`, aber es existiert KEINE `.popover--gray`-CSS-Klasse (Fallback = Basis-Hintergrund). Default-Farbe: `white`.

| Selektor | Werte | Quelle (popover.postcss) |
|---|---|---|
| .popover-wrapper | position relative; display inline | Z. 5–7 |
| .popover-backdrop | display none; width/height 100%; top/left 0; position fixed; z-index 30; background rgba(17,24,39,0.7); cursor pointer | Z. 9–14 |
| .popover-backdrop--active | display block | Z. 16–18 |
| .popover-button | position relative; display inline; align-items baseline; text-align left | Z. 22–24 |
| .popover-button__label | border-bottom 1px dashed #6b7280 (gray-500); :hover color #d8232a + border-color #d8232a | Z. 26–29 |
| .popover-button__icon | display inline; height 1em; transform scale(1.5); position relative; bottom 0.1em; color #e53940 (primary-500); stroke #e53940; bei .popover-wrapper:hover color #d8232a | Z. 31–40 |
| .popover | erbt .notification (flex, relative, Padding 8/16/24/32px, rounded 3px, shadow-lg, s. 7); dann: display none; padding 16px, padding-right 24px; width 80vw; max-width 400px; position fixed; z-index 50; top 50%; left 50%; transform translate(-50%,-50%); margin-bottom 4px; transition all 300ms; color #1f2937 (gray-800); background #f0f4f7 (secondary-50); pointer-events none | Z. 44–56 |
| .popover--active | display block; pointer-events auto | Z. 58–61 |
| .popover__close | position absolute; top 0; right 0; cursor pointer | Z. 63–65 |
| .popover--red / --error | color #99191e; background #fae1e2 | Z. 69–73 |
| .popover--yellow | color #92400e; background #fef3c7 | Z. 75–78 |
| .popover--orange / --warning | color #9a3412; background #ffedd5 | Z. 80–84 |
| .popover--green / --success | color #065f46; background #d1fae5 | Z. 86–90 |
| .popover--blue / --info | color #1e40af; background #dbeafe | Z. 92–96 |
| .popover--indigo | color #3730a3; background #e0e7ff | Z. 98–101 |
| .popover--purple | color #5b21b6; background #ede9fe | Z. 103–106 |
| .popover--pink | color #9d174d; background #fce7f3 | Z. 108–111 |
| .popover--white | background #ffffff | Z. 113–115 |

---

### 11 Progress (css/components/progress.postcss)

Datei enthält NUR den Kopfkommentar (Z. 1–3) — keine Selektoren, keine Vue-Komponente. Für ein Pixel-Review existiert keine Referenz.

---

### 12 Search (css/components/search.postcss + SearchMain.vue)

Kanonische Struktur Hauptsuche (SearchMain.vue Z. 1–19):

```html
<div id="search-main-wrapper" class="search search--main">
  <div class="search__group">
    <h2 class="sr-only">Suche</h2>
    <input id="search-main" type="search" …>   <!-- via Input.vue; Label «Suche in dieser Website», Placeholder «Suche», autocomplete off -->
    <div class="search__button" title="Toggle search">
      <span class="search__button__title">Suche</span>
      <svg class="icon icon--lg icon--Search search__button__icon"/>
    </div>
  </div>
</div>
```

| Selektor | Werte | Quelle (search.postcss) |
|---|---|---|
| .search--main | display flex; position relative; z-index 30 | Z. 5–7 |
| .search--main .form__group__input | width/height 100%; position absolute; right 0 | Z. 9–12 |
| .search--main input | background-opacity 0; position absolute; right 0; z-index 30; cursor pointer; opacity 0; box-shadow none; transition all 300ms | Z. 14–20 |
| .search--main input:focus | width 40vw, ≥480px 35vw, ≥1024px 288px (18rem, w-72); padding-right 40px (2.5rem); z-index 0; opacity 1; cursor text; box-shadow shadow-2xl | Z. 22–29 |
| .search--desktop | display none, ≥1024px block | Z. 33–35 |
| .search--mobile | position absolute; right 0; z-index 30; margin-top 8px; padding-x 14px (0.875rem); display none; width 100%; label sr-only; input cursor text, background #ffffff, box-shadow shadow-2xl | Z. 37–52 |
| .search--mobile.active | display block | Z. 54–56 |
| .top-header-search__group | display flex; align-items stretch; justify-content space-between; position relative; .btn absolute right 0 z-20 margin-top 7px cursor text | Z. 58–65 |
| .search--main .search__group .form__group__input input | margin-top -4px, ≥1280px 0 | Z. 67–69 |
| .form__group__input:focus-within + .search__button > .search__button__title | display none | Z. 71–73 |
| .search__button | cursor pointer; display flex; align-items center; ≥1024px padding 4px, ≥1280px 8px, ≥1544px padding-y 12px; position relative; z-index 10; height 100% | Z. 75–81 |
| .search__button__title | sr-only, ≥1024px not-sr-only; ≥1024px padding-right 6px, margin-top -2px | Z. 83–86 |
| .search__button__icon | height/width 36px !important (2.25rem); ≥1024px 28px !important (1.75rem); svg stroke-width 0.5px | Z. 88–97 |
| .body--search-is-open .logo | opacity 0, ≥480px 1 | Z. 99–103 |
| .search--negative | background #46596b (secondary-500) | Z. 109–111 |
| .search__group | display flex; align-items stretch; justify-content space-between; position relative; label sr-only | Z. 113–118 |
| .search__group input | height 100%; ≥1024px padding-y 16px; padding-right 48px (3rem); background #ffffff | Z. 120–124 |
| .search--negative .search__group input | background #46596b; border-color #596978; position relative; z-index 10; ::placeholder color #dfe4e9 (secondary-100) | Z. 126–133 |
| .search--large .search__group | height 64px (4rem); input font-size 20px (text-xl), font-weight 400 (font-bold!), box-shadow none | Z. 135–141 |
| .search__group .btn | position absolute; top/right/bottom 0; z-index 20 | Z. 143–146 |
| .search__field | font-weight 400 (font-bold); font-size 22px (text-2xl, 1.375rem); padding 12px; width 100%; outline none; ::placeholder #acb4bd (secondary-200); in .search--negative: color #ffffff, background #46596b | Z. 148–162 |
| .search__icon | height 32px (2rem); margin-x 12px; color #ffffff | Z. 164–167 |
| .search__results | height 384px (24rem); width 100%; overflow-y scroll; overflow-x hidden | Z. 169–173 |
| .search__results--negative | border 1px solid #596978 | Z. 175–177 |
| .search--page-result | ≥1024px width 80%; ≥1280px width 66.666667%; padding-top 16px, ≥768px 24px, ≥1544px 32px; svg 40px × 40px, stroke-width 0 | Z. 183–191 |
| .search-results--grid .search-results-list | grid, 1 Spalte, ≥768px 2, ≥1024px 3; gap 20px/28px/36px/40px/48px/64px (gap--responsive, css/layouts/grids.postcss Z. 9–11); padding-top ebenso (gap--top, Z. 13–15) | Z. 196–202 |
| .search-results__tabs | padding-top 32px, ≥640px 48px, ≥1544px 64px | Z. 204–206 |
| .search-results__header | display flex; flex-wrap wrap; gap 16px; align-items center; justify-content space-between; .text--sm; padding-top 16px/24px/32px (sm/2xl); padding-bottom 8px/12px/16px; border-bottom 1px solid #828e9a (secondary-300); strong: block, ≥640px inline, margin-right 1ex, Font-Regular | Z. 208–218 |
| .search-results .notification | margin-y 64px (4rem) | Z. 236–238 |
| .search__filters | margin-top 16px | Z. 249–251 |
| .search__filters__actions | display flex; flex-wrap wrap; column-gap 8px | Z. 253–255 |
| .search__filters__drawer | grid, ≥768px 2 Spalten, ≥1024px 3; gap 12px, ≥1024px 16px; padding-top 16/24/32px; padding-bottom 8/12/16px; margin-top 16/24/32px; border-top 1px solid #acb4bd (secondary-200) | Z. 257–264 |
| .search__filters__tags | display flex; flex-wrap wrap; padding-top 16px, ≥640px 24px, ≥1544px 32px | Z. 266–269 |
| .search-results__sort | display flex; flex-wrap wrap; column-gap 16px; justify-content flex-end; .form__group flex, column-gap 16px | Z. 271–277 |
| .sticky-search-container | position fixed !important; left/right/top 0; z-index 1000; padding-y 16px; background #f0f4f7 | Z. 279–287 |

---

### 13 Select (css/components/select.postcss + Select.vue)

Kanonische Struktur (Select.vue Z. 1–32):

```html
<div class="form__group__select">                        <!-- w-full; space-y-2 → 8px (form.postcss Z. 12–15) -->
  <label for="{id}" class="[text--negative] [text--{size}] [sr-only] [text--asterisk]">
    {label}<span class="form__group__required"/>          <!-- Klasse OHNE CSS-Definition -->
  </label>
  <div class="select [select--bare]">
    <select id="{id}" class="input--{outline|negative} input--{sm|base|lg} [input--{error|warning|success|info}]" [required]>…</select>
    <div class="select__icon"><svg role="presentation" aria-hidden="true" viewBox="0 0 24 24"><path d="m5.706 10.015 6.669 3.85 6.669-3.85.375.649-7.044 4.067-7.044-4.067z"/></svg></div>
  </div>
  <div class="badge badge--sm badge--{messageType}">…</div>
</div>
```

`select` erhält zusätzlich die globalen Input-Grundwerte (s. 0.7). Pflichtfeld-Stern: `.text--asterisk::after` content '\202F*' (typography.postcss Z. 91–98).

| Selektor | Werte | Quelle (select.postcss) |
|---|---|---|
| .select | position relative | Z. 1–2 |
| .select select | padding-right 80px (5rem, pr-20); box-sizing border-box; appearance none | Z. 4–7 |
| .select--bare | width auto; display inline-block; margin-top 0 !important | Z. 9–12 |
| .select--bare select | display inline-block; padding-right 24px (1.5rem); box-shadow-Farbe transparent; border transparent; background transparent; focus outline none | Z. 13–17 |
| .select--bare .select__icon | width 24px; border-left 0 | Z. 19–22 |
| .select--bare .input--negative + .select__icon | background transparent | Z. 23–25 |
| select:disabled, .input--disabled select | opacity 0.4; nachfolgendes .select__icon ebenfalls opacity 0.4 | Z. 28–35 |
| .select__icon | width 48px (3rem); height 100%; display flex; align-items center; justify-content center; position absolute; top 0; right 0; border-left 1px solid #6b7280 (text-500); pointer-events none; svg width 32px, height 100% | Z. 37–46 |
| .input--negative + .select__icon | color #ffffff; border-color #828e9a (secondary-300); background #46596b (secondary-500); svg fill currentColor | Z. 48–56 |
| .input--error + .select__icon | color #bf1f25 (red-700); border-color #fc656b (red-400); svg fill currentColor | Z. 58–64 |
| .input--error.input--negative + .select__icon | color #ffccce (red-200); border-color #fa9da1 (red-300) | Z. 66–72 |
| .input--negative option | background #2f4356 (secondary-600), hover #46596b; color #ffffff | Z. 75–78 |

---

### 14 Separator (css/components/separator.postcss)

Kein Vue-Pendant. Kanonisch: `<hr class="separator [separator--md|--xl] [separator--negative] [separator--vertical]">`.

| Selektor | Werte | Quelle |
|---|---|---|
| .separator | display block; height auto; border 0 | Z. 5–7 |
| .separator::before | content ''; width 100%; display block; border-bottom 1px solid #acb4bd (secondary-200); in `.bg--secondary-50`: #828e9a (secondary-300) | Z. 9–17 |
| .separator--xl::before / ::after | width 100%; display block; height 16px, ≥768px 20px, ≥1024px 24px | Z. 19–29 |
| .separator--md::before / ::after | width 100%; display block; height 8px, ≥768px 12px, ≥1024px 16px | Z. 31–41 |
| .separator--negative::before | border-color #596978 (secondary-400) | Z. 43–45 |
| .separator--vertical | display inline; border-bottom 0; border-right 1px solid #596978; margin-x 16px; nachfolgender .btn--bare: margin-left -8px | Z. 47–53 |

---

### 15 Step-Indicator (css/components/step-indicator.postcss + StepIndicator.vue)

Kanonische Struktur (StepIndicator.vue Z. 1–10):

```html
<div class="step__indicator">
  <div class="step__indicator-step [step__indicator-step--confirmed|--active]">
    <span><svg class="icon icon--lg icon--CheckmarkBold"/></span>   <!-- confirmed -->
    <span>{step}</span>                                              <!-- sonst: Schrittnummer -->
  </div>
</div>
```

`--confirmed` gewinnt vor `--active` (Vue Z. 31–39). Keine ARIA-Attribute in der Komponente.

| Selektor | Werte | Quelle (step-indicator.postcss) |
|---|---|---|
| .step__indicator .step__indicator-step | border-radius 9999px; width 36px; height 36px; display flex; align-items center; justify-content center; color #9ca3af (gray-400); border 2px solid #9ca3af | Z. 6–12 |
| .step__indicator-step--confirmed | background #10b981 (green-500); color #ffffff; border none | Z. 13–17 |
| .step__indicator-step--active | background #9ca3af (gray-400); color #ffffff; border none | Z. 18–22 |

Icon confirmed: `icon--lg` = height 24px, ≥768px 28px (icons.postcss Z. 31–33).

---

### 16 Steps (css/components/steps.postcss)

Datei enthält NUR den Kopfkommentar (Z. 1–4) — keine Selektoren, keine Vue-Komponente.

---

### 17 Tab (css/components/tab.postcss)

Kein Vue-Pendant. Kanonisch: `.tabs > .tab__controls-container > .tab__controls > .tab__control (+--active)` und `.tab__container (+--is-hidden, +vertical-spacing)`.

| Selektor | Werte | Quelle |
|---|---|---|
| .tabs in .container__center--xs | padding-y 32px; broader-than-container | Z. 5–10 |
| .tab__controls-container | position relative | Z. 12–13 |
| .tab__controls-container::after | content ''; position absolute; right 0; top 0; bottom 4px (bottom-1); width 40px, ≥640px 80px; pointer-events none; background linear-gradient(to left, from #ffffff); in `.bg--secondary-50`: from #f0f4f7 | Z. 15–28 |
| .tab__controls | display flex; overflow-x auto; overflow-y hidden; white-space nowrap; border-bottom 1px (Default-Borderfarbe #e5e7eb); in `.bg--secondary-50`: border-color #d1d5db (gray-300); Scrollbar versteckt (-ms-overflow-style none; scrollbar-width none; ::-webkit-scrollbar display none) | Z. 31–47 |
| .tab__control | position relative; padding 16px 16px (px-4 py-4) | Z. 49–51 |
| .tab__control::after | content ''; display block; height 3px; position absolute; right 16px; bottom 0; left 16px; transition (alle Std.-Props, 150ms) | Z. 53–59 |
| .tab__control--active::after, .tab__control:hover::after | background #e53940 (primary-500) | Z. 61–66 |
| .tab__control:hover:not(.tab__control--active) | color #d8232a (primary-600) | Z. 67–69 |
| .tab__control:first-child | padding-left 0; ::after left 0 | Z. 70–76 |
| .tab__container.vertical-spacing | padding-top 32px (2rem) | Z. 79–82 |
| .tab__container--is-hidden | display none | Z. 84–86 |

---

### 18 Table (css/components/table.postcss)

Kein Vue-Pendant. Kanonisch: `div.table-wrapper > table[.table--compact|--bare|--zebra|--caption] > caption + thead + tbody + tfoot`; sortierbare Spalten: `th[aria-sort="ascending|descending"] > button.table__sorter > span`.

| Selektor | Werte | Quelle |
|---|---|---|
| .table-wrapper | overflow-x auto; in .container__center--xs/--sm: broader-than-container; caption white-space pre-line | Z. 5–16 |
| table, .table | width 100%; border 1px solid #e5e7eb (text-200); box-shadow shadow-md (s. 0.4) | Z. 18–23 |
| caption | display none; .legend (12px/xl 14px/3xl 16px, padding-top 8px, color #6b7280); caption-side bottom; in .table--caption: display table-caption, text-align left | Z. 25–32 |
| thead | background #f0f4f7 (secondary-50) | Z. 34–35 |
| thead th | padding 16px 24px (py-4 px-6); text-align left; color #374151 (text-700); text-transform uppercase; .text--sm (14/16/18px); vertical-align top | Z. 37–42 |
| table:not(.table--compact) tbody/tfoot tr | border-top 1px solid #d1d5db (text-300) | Z. 45–50 |
| table:not(.table--compact) tbody/tfoot td, th | padding 16px 24px; .text--base (16/18/20px); color #4b5563 (gray-600) | Z. 52–57 |
| table:not(.table--compact) tbody/tfoot th | color #1f2937 (gray-800); font-bold (font-weight 400, s. 0.2); text-align left | Z. 59–62 |
| tfoot | border-top und border-bottom 2px solid #d1d5db (border-y-2 text-300) | Z. 65–67 |
| .table--compact | border 0; shadow none; thead th padding 8px; tbody/tfoot td/th padding 8px, .text--sm | Z. 69–87 |
| .table--bare | shadow none; border 0; tr border 0, padding 0; td/th padding 0, .text--base, Font-Regular | Z. 89–100 |
| .table--zebra tbody/tfoot tr:nth-child(even) | background #f0f4f7 (secondary-50) | Z. 102–109 |
| .table__sorter | display inline-flex; align-items baseline; text-align left; :hover color #d8232a (red-600); text-transform inherit; font-weight inherit; in .text-right: justify-content flex-end, text-align right | Z. 111–120 |
| .table__sorter span::after | content '↕'; display block; margin-left 4px; min-width 1.25em; font-weight 400 (font-normal); .text--xs (12/14/16px); text-align center | Z. 122–127 |
| th[aria-sort='descending'] .table__sorter span::after | content '▼' | Z. 129–131 |
| th[aria-sort='ascending'] .table__sorter span::after | content '▲' | Z. 133–135 |

---

### 19 Tag-Item (css/components/tag-item.postcss + TagItem.vue)

Kanonische Struktur (TagItem.vue Z. 1–16): mit `to` → `<a href>`, sonst `<button type="button" aria-label="{label}">`; Klassen `tag-item tag-item--{default|primary|active} tag-item--{base|sm} [tag-item--icon]` (für `tag-item--icon` existiert KEINE CSS-Definition). Inhalt: `span.tag-item__inner > span.tag-item__text + svg.tag-item__icon`.

| Selektor | Werte | Quelle (tag-item.postcss) |
|---|---|---|
| .tag-item | display inline-flex; align-items center; margin-right 12px; ≥768px margin-bottom 2px, ≥1024px 4px; focus outline none; ring 0; text-decoration none; &, :hover color inherit | Z. 7–20 |
| .tag-item:focus .tag-item__inner | outline none; box-shadow ring 2px #8655F6 (ring-purple-500) | Z. 17–19 |
| .tag-item__inner | display inline-flex; align-items center; padding-x 16px, ≥1544px 20px; line-height 1.25 (leading-tight); border-radius 9999px | Z. 22–27 |
| .tag-item__text | display inline-block; padding-y 6px (py-1.5), ≥1280px 8px; text-align left | Z. 29–33 |
| .tag-item, .tag-item--base | min-height 44px, ≥1280px 48px, ≥1920px 52px; .text--base (16/18/20px); line-height 20px, ≥1024px 24px | Z. 37–42 |
| .tag-item--sm | .text--sm (14/16/18px) | Z. 44–46 |
| .tag-item (default) .tag-item__inner | background #e5e7eb (gray-200); :hover background #d1d5db (gray-300) | Z. 50–58 |
| .tag-item--active | pointer-events none; inner: color #ffffff, background #1f2937 (gray-800) | Z. 61–67 |
| .tag-item--primary .tag-item__inner | color #ffffff; background #1f2937; :hover background #000000 | Z. 69–77 |
| .tag-item__icon | height 100%; width 1.5em; position relative; left 0.4em; stroke-width 0.3px, ≥768px 0.35px, ≥1024px 0.4px; stroke currentColor | Z. 80–85 |

---

### 20 Toast-Message (css/components/toast-message.postcss + ToastMessage.vue)

Kanonische Struktur (ToastMessage.vue Z. 1–12): `div.toast__message[.active] > Notification.toast__message-notification` (ohne Close-Button, Typ default `success`, Icon default `CheckmarkCircle`). Trigger via `window.postMessage({trigger:'trigger-toast-message', data:{text,icon,type}})`; Auto-Hide nach 5000ms (Vue Z. 34–47).

| Selektor | Werte | Quelle (toast-message.postcss) |
|---|---|---|
| .toast__message | display none !important; position fixed; z-index 50; bottom 10%; width 100% | Z. 5–8 |
| .toast__message.active | display flex !important; justify-content center !important | Z. 10–13 |
| .toast__message-notification | max-width 500px; margin-x 20px | Z. 15–18 |

Optik des Toasts selbst = Notification-Regeln (s. 7), z. B. success: #065f46 auf #ecfdf5, shadow-lg, rounded 3px.

---

### 21 Textarea (Textarea.vue + input.postcss)

Kanonische Struktur (Textarea.vue Z. 1–25):

```html
<div class="form__group__input">                          <!-- w-full; space-y-2 → 8px (form.postcss Z. 12–15) -->
  <label for="{id}" class="[text--negative] [text--{size}] [text--asterisk]">…</label>
  <textarea id="{id}" name="{id}" rows="4" cols="50" class="input--{outline|negative} input--{sm|base|lg} [input--{error|warning|success|info}] [textarea--public]" [maxlength] [minlength] [placeholder] [required]/>
  <div class="badge badge--sm badge--{messageType}">…</div>
</div>
```

Defaults: rows 4, cols 50 (Vue Z. 57–64). `resizable: false` fügt `textarea--public` hinzu (Vue Z. 98) — diese Klasse hat KEINE CSS-Definition; definiert ist stattdessen `.textarea--static { resize: none }` (input.postcss Z. 174–176). Diskrepanz für das Review notieren.

Wirksame Werte: globale Input-Grundwerte + Zustände aus 0.7 (padding 10px 16px; border 1px #6b7280; rounded 1px; min-height 44px/2xl 48px; shadow DEFAULT; placeholder #596978; error #99191e/#e53940; negative weiss auf #46596b).

---

### 22 SvgIcon (SvgIcon.vue + css/foundations/icons.postcss)

Rendering (SvgIcon.vue Z. 1–3, 31–37): `<svg class="icon icon--{size} icon--{icon} [icon--spin]">` (InlineSvg aus `app/assets/icons/{icon}.svg`). Grössen-Validator (Z. 18–22): sm, base, md, lg, xl, 2xl, 3xl, 4xl, full — `5xl` fehlt im Validator, obwohl `.icon--5xl` in CSS existiert (icons.postcss Z. 51–53). Default-Grösse: `base`.

| Klasse | Höhe | Quelle (icons.postcss) |
|---|---|---|
| .icon | width auto; fill currentColor; flex-shrink 0; stroke-width 0.3px; path/circle fill currentColor | Z. 5–13 |
| .icon--full | width 100% | Z. 15–17 |
| .icon--sm | 12px (0.75rem) | Z. 19–21 |
| .icon--base | 16px (1rem) | Z. 23–25 |
| .icon--md | 20px, ≥768px 24px | Z. 27–29 |
| .icon--lg | 24px, ≥768px 28px | Z. 31–33 |
| .icon--xl | 28px, ≥768px 32px, ≥1024px 36px | Z. 35–37 |
| .icon--2xl | 36px, ≥768px 40px, ≥1024px 48px | Z. 39–41 |
| .icon--3xl | 48px, ≥768px 64px, ≥1024px 80px | Z. 43–45 |
| .icon--4xl | 80px, ≥768px 96px, ≥1024px 112px | Z. 47–49 |
| .icon--5xl | 112px, ≥768px 128px, ≥1024px 144px | Z. 51–53 |
| .icon--spin | animation spin 0.5s linear infinite (animate-spin-fast, tailwind.config.js Z. 16–18) | Z. 55–57 |

## CD Bund v1.0.5 — Bundes-Chrome (verbindliche Layout-Elemente)

Quelle: `C:\Users\david\Documents\GitHub\designsystem` (package.json: version 1.0.5).
Alle Tailwind-Klassen sind auf berechnete Werte aufgelöst (Basis 1rem = 16px; Spacing-Skala: 1 = 0.25rem = 4px).
Schreibweise: `Quelle:` nennt die Datei, aus der die Angabe stammt.

### 0. Grundlagen (für alle Elemente)

#### 0.1 Breakpoints und Container
Quelle: `app/tailwind.config.js` (screens, container), `css/layouts/container.postcss`

| Token | Wert |
|---|---|
| xs | 480px |
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| 2xl | 1544px |
| 3xl | 1920px |

`.container`: `w-full mx-auto; overflow-x: clip` mit horizontalem Padding:

| Breakpoint | px Padding | rem |
|---|---|---|
| Basis | 16px | 1rem (`px-4`) |
| ≥480px (xs) | 28px | 1.75rem (`px-7`) |
| ≥640px (sm) | 36px | 2.25rem (`px-9`) |
| ≥1024px (lg) | 40px | 2.5rem (`px-10`) |
| ≥1280px (xl) | 48px | 3rem (`px-12`) |
| ≥1920px (3xl) | 64px | 4rem (`px-16`) |

max-width: ≥1544px → 1544px; ≥1920px → 1676px.
`.container--flex`: `display:flex; justify-content:space-between`.
`.container:not(.breadcrumb) + .container`: `pt-14 lg:pt-20 3xl:pt-32` = 56px / 80px / 128px.
`.container--py` = `py-14 lg:py-20 3xl:py-32` = 56px / 80px / 128px; `--pb` analog nur unten; `--pb-half` = 28px / 40px / 64px.

#### 0.2 Farben (Skin default)
Quelle: `css/skins/default.postcss`, `app/tailwind.config.js`

| Token | Hex |
|---|---|
| primary-500 | #e53940 |
| primary-600 | #d8232a |
| primary-700 | #bf1f25 |
| secondary-50 | #f0f4f7 |
| secondary-100 | #dfe4e9 |
| secondary-200 | #acb4bd |
| secondary-300 | #828e9a |
| secondary-400 | #596978 |
| secondary-500 | #46596b |
| secondary-600 | #2f4356 |
| secondary-700 | #263645 |
| secondary-800 | #1c2834 |
| secondary-900 | #131b22 |
| text-300 | #d1d5db |
| text-400 | #9ca3af |
| text-500 | #6b7280 |
| text-800 | #1f2937 |
| text-900 | #111827 |
| purple-500 (Fokusring) | #8655F6 |
| purple-300 (Fokusring auf dunkel) | #c4b5fd |

#### 0.3 Typografie-Stufen (responsive Klassen)
Quelle: `css/foundations/typography.postcss`, `app/tailwind.config.js` (fontSize)

| Klasse | Basis | ≥1024 (lg) | ≥1280 (xl) | ≥1920 (3xl) |
|---|---|---|---|---|
| .text--xs | 12px | 12px | 14px | 16px |
| .text--sm | 14px | 14px | 16px | 18px |
| .text--base | 16px | 16px | 18px | 20px |
| .text--lg | 18px | 18px | 20px | 22px |
| .text--xl | 20px / leading-tight 1.25 | 22px | 26px | 32px |
| .text--3xl | 26px / 1.25 | 32px | 40px | 48px |
| .text--4xl | 32px / 1.25 | 40px | 48px | 56px |

Achtung: `font-weight: bold = 400` (Fettung via Font-Familie `Font-Bold`, nicht via weight) — `app/tailwind.config.js` fontWeight `{normal: 400, bold: 400}`.

#### 0.4 Seitenkomposition (verbindliche Reihenfolge)
Quelle: `app/pages/index.vue`, `css/foundations/global.postcss`

```html
<header id="main-header">              <!-- relative z-30 -->
  <a href="#main-content" class="skip-to-content">Skip to main content</a>
  <TopBar /> <TopHeader /> <DesktopMenu /> <MobileMenu /> <Breadcrumb />
</header>
<main id="main-content">…<BackToTopBtn /></main>   <!-- flex-grow, relative z-10 -->
<footer id="main-footer" class="footer">           <!-- relative z-0 -->
  <FooterInformation /> <FooterNavigation />
</footer>
```

`.skip-to-content`: `inline-block; padding 8px 16px; absolute z-50 top-0 left-1/2; bg secondary-900 #131b22; text-white; border 2px white; shadow-md; transform: translateX(-50%) translateY(-200%)`; bei `:focus` `translateY(0)`. Quelle: `css/foundations/global.postcss` Z.63–73.
Fokus global: `*:focus-visible { outline-none; ring-2 ring-purple-500 (#8655F6); z-10 }`; innerhalb `.top-bar` und `.bg--secondary-500…900`: `ring-purple-300 (#c4b5fd)`. Quelle: `global.postcss` Z.75–86.
`[id] { scroll-margin-top: 32px }` (`scroll-mt-8`).

---

### 1. Top-Bar («Alle Schweizer Bundesbehörden»)
Quellen: `css/sections/top-bar.postcss`, `app/components/ch/sections/TopBar.vue`, `css/navigations/top-bar-navigation.postcss`, `app/components/ch/navigations/TopBarNavigation.vue`

#### 1.1 Struktur (TopBar.vue)
```html
<div id="top-bar-container" class="top-bar [top-bar--is-open]">
  <div id="top-bar" class="top-bar__bar">
    <div class="container container--flex">
      <button class="top-bar__btn">
        <span>Alle Schweizer Bundesbehörden</span>
        <SvgIcon icon="ChevronDown" size="lg" class="top-bar__btn__icon"/>
      </button>
      <div class="top-bar__right">
        <nav class="top-bar-navigation" aria-label="Top bar">…</nav>
        <LanguageSwitcher type="negative"/>
      </div>
    </div>
  </div>
  <div id="stickyTopBarPlaceholder"/>          <!-- nur bei sticky -->
  <div class="top-bar__drawer">…</div>          <!-- nur bei is-open -->
</div>
```

#### 1.2 Masse und Farben
| Selektor | Werte |
|---|---|
| `.top-bar` | bg #2f4356 (secondary-600); Schrift 14px, ≥1544px 16px (`text-sm 2xl:text-base`); Farbe weiss |
| `.top-bar__bar` | bg #2f4356; bei `.top-bar--is-open` bg #263645 (secondary-700); innere `.container` `h-full` |
| `.top-bar__btn` | flex items-center text-left; `pl-4 -ml-4` = 16px links + −16px margin (Bündigkeit zum Container); `py-1` = 4px; **min-height: 2.75rem = 44px**; bg secondary-600; hover/focus Text #d1d5db (text-300); transition-colors |
| `.top-bar__btn__icon` | `ml-2` = 8px; `transition-transform duration-200`; bei is-open `rotate(180deg)` |
| `.top-bar__right` | flex items-center |
| `.sticky-top-bar` | `position:fixed; top:0; left:0; right:0; z-index:1000` (per JS gesetzt, Platzhalter erhält TopBar-Höhe) |

Varianten: `.top-bar__bar--easy-language` bg `#466975 !important`; `.top-bar__bar--sign-language` bg indigo-900 `#312e81 !important`.

#### 1.3 Top-Bar-Navigation (rechts)
`nav.top-bar-navigation` (aria-label="Top bar"), Einträge: Leichte Sprache (Icon EasyLanguage), Gebärdensprache (SignLanguage), Anmelden (User) — Icon `size="lg"`.

| Selektor | Werte |
|---|---|
| `.top-bar-navigation` | flex h-full; `span` hidden, ≥1024px block, `pl-2 lg:pl-4` (8/16px), `pr-1 lg:pr-2` (4/8px); `svg` `pr-1 lg:pr-2` |
| `.top-bar-navigation a` | flex items-center; h-full; `px-1 lg:px-2` = 4px/8px; hover/focus #d1d5db |
| `.top-bar-navigation--mobile` | flex flex-col; `pb-12` = 48px; bg secondary-500 #46596b; svg hidden; a `px-4` = 16px, weiss |

#### 1.4 Drawer (aufgeklappte Behördenübersicht)
| Selektor | Werte |
|---|---|
| `.top-bar__drawer` | `pt-6 md:pt-8` = 24px/32px; bg secondary-600; weiss |
| `.top-bar__drawer__close__btn` | flex items-center; Label «Schliessen» + Icon Cancel lg |
| `.top-bar__main-title` | `py-3 md:py-4` = 12/16px; `.text--xl` (20→32px) |
| `.top-bar__title` | min-height 1.5rem = 24px; `.text--lg`; `mb-6` = 24px; line-height 1.25rem = 20px (`leading-5`); folgendes `p` mb-6 |
| `.localization` | `my-6 md:my-7 lg:my-8` = 24/28/32px; ul flex flex-wrap; li flex items-center; letztes li `w-full md:w-auto`; a Farbe secondary-100 #dfe4e9, `my-2` = 8px; `a.active`: weiss, font-bold, `border-l-2` 2px primary-600 #d8232a, `pl-2` = 8px; `.localization__icon` `mx-4` = 16px |
| `.top-bar__grid` | grid 6 Spalten; `gap-x`: 36px / ≥1024 40px / ≥1280 48px / ≥1544 64px (`gap-x-9 lg:gap-x-10 xl:gap-x-12 2xl:gap-x-16`); `pt-5` = 20px; grid-template-rows `auto 1fr` |
| `.top-bar__grid__box-1` | col-span-6, ≥768 col-span-3, `pb-14` = 56px; ≥1024 col-span-2 row-span-1 |
| `.top-bar__grid__box-3` | col-span-6 → md 3 → lg 2 (col-start-3, row 1–3), pb-14 |
| `.top-bar__grid__box-4` | col-span-6 → md 3 → lg 2 (col-start-5, row 1–3), relative, pb-14; enthält `.search--negative .search--large` |
| `.top-bar__grid .search__results` | mobil `max-height:60vh; position:relative`; ≥768px `max-height:none; height:calc(100% - 10.5rem); position:absolute` |

ARIA im Drawer (TopBar.vue): Standort-Navi `nav.localization` mit `aria-label="breadcrumb"` und `aria-current="location"`; aktiver Link `aria-current="page"`. Listeneinträge: `li.menu__item.menu__item--negative.menu__item--brim > a.menu__item__flex` mit `.overtitle` (Kürzel, 12px, secondary-100) + Titel + Icon External.
Menü-Items (Quelle `css/components/menu.postcss`): `.menu__item` = `px-4 py-3` (16/12px), hover bg secondary-50; `--negative` bg secondary-600, weiss, border-b secondary-400; hover bg secondary-700; `--brim` `px-2` = 8px.
Trenner im Drawer: `.separator.separator--negative.separator--xl` — border-b secondary-400, Höhen ::before/::after je 16px / md 20px / lg 24px (Quelle `css/components/separator.postcss`).

---

### 2. Sprachwahl (Language Switcher)
Quellen: `app/components/ch/components/LanguageSwitcher.vue`, `css/components/language-switcher.postcss`

Struktur: `div.language-switcher > label.sr-only[for=lang-switcher] («Select language») + Select(bare, size sm, variant negative|outline) > option DE | FR | IT | RM (disabled) | EN`.

| Selektor | Werte |
|---|---|
| `.language-switcher` | flex; cursor-pointer |
| `.language-switcher select` | Breite `3.5em`, ≥1024px `4.5em`; `pl-1 lg:pl-4` = 4/16px; h-full (in Top-Bar und `.top-header__right`) |
| `.language-switcher option:disabled` | Farbe #9ca3af (text-400) |
| `.language-switcher .select__icon` | Breite 24px (`w-6`); hover/focus des Selects färbt Icon #d1d5db |
| `.meta-navigation-container .language-switcher` | `margin-bottom: 0.75rem` = 12px (Freebrand-Fall) |

Platzierung: im Bund-Standard in der Top-Bar (`type="negative"`); bei Freebrand-Skin im Top-Header (`type="outline"`, mobil <1024px neben Burger, Desktop in `.meta-navigation-container`). Quelle: `TopHeader.vue` Z.56–59, `MetaNavigation.vue` Z.22.

---

### 3. Top-Header (Logo-Zone)
Quellen: `css/sections/top-header.postcss`, `app/components/ch/sections/TopHeader.vue`, `css/components/logo.postcss`, `app/components/ch/components/Logo.vue`, `css/components/burger.postcss`, `app/components/ch/components/Burger.vue`

#### 3.1 Struktur
```html
<div id="top-header-id" class="top-header">
  <div class="top-header__mobile-title" aria-hidden="true">
    <div class="container container--flex">Departementsname…</div>
  </div>
  <div class="container container--flex">
    <a class="logo" href="/"> [Wappen-SVG] [Wortmarke-SVG] [Separator] [Titel] </a>
    <div class="top-header__right">
      <MetaNavigation/>
      <div class="top-header__container-flex"> <SearchMain/> <ShoppingCartButton desktop/> </div>
      <div class="top-header__shopping-cart-button-mobile">…</div>
      <button class="burger" title="Toggle mobile menu">…</button>
    </div>
  </div>
</div>
```

#### 3.2 Masse
| Selektor | Werte |
|---|---|
| `.top-header` | vertikales Padding `py-3 md:py-4 lg:py-6 xl:py-8 3xl:py-10` = **12 / 16 / 24 / 32 / 40px**; bg-white; Schrift 14px, ≥1920 16px; `border-b` 1px (#e5e7eb); relative |
| `.top-header__mobile-title` | bg secondary-100 #dfe4e9; **nur <480px** (`xs:hidden`); 12px Schrift (`text-xs`); `relative; top:-0.75rem` (−12px); overflow-hidden; `transition: max-height 300ms`; innere .container `py-2` = 8px (≥480 0); `br` display:none; bei offenem Mobile-Menü `max-h-0` |
| `.top-header__right` | flex; ≥1024px flex-col + items-end + `margin-right:-0.75rem` (−12px, `lg:-mr-3`) |
| `.top-header__container-flex` | flex items-center |
| `.top-header__shopping-cart-button-mobile` | flex items-center; `ml-2.5 mr-3` = 10px/12px; ≥1024px hidden |
| `.top-header__shopping-cart-button-desktop` | hidden; ≥1024px block, `mr-[0.7rem]` = 11.2px, `ml-4 xl:ml-2` = 16/8px |

#### 3.3 Logo (Schweizer Wappen + Wortmarke)
`a.logo` → Wappen-SVG (`viewBox="0 0 40 44"`, rotes Schild #ff0000 + weisses Kreuz #ffffff, `role="img" aria-hidden="true"`), Wortmarke-SVG (`.logo__name`, `viewBox="0 0 244 70"`), `div.logo__separator[role="separator"][aria-hidden="true"]`, `div.logo-title__container > .logo__accronym + .logo__title`.

| Selektor | Werte |
|---|---|
| `.logo` | flex items-center flex-nowrap; ≥768px items-start; `transition-opacity duration-700`; bei offenem Mobile-Menü opacity-0 |
| `.logo__flag` (Wappen) | flex-shrink-0; **30×33px**; ≥1024px **32×34px**; ≥1920px **40×44px** |
| `.logo__name` (Wortmarke) | hidden, **erst ≥1280px sichtbar** (`xl:block`); 174×50px; ≥1920px 244×70px |
| `.logo__separator` | Breite 1px (`w-px`); Höhe 40px / ≥768 56px / ≥1920 70px (`h-10 md:h-14 3xl:h-[70px]`); Margin links+rechts je 8px / ≥640 16px / ≥1024 24px / ≥1920 32px; Farbe #D1D5DB |
| `.logo__title` | `sr-only`, ab ≥480px sichtbar; ≥768px `whitespace-nowrap`; Schrift 14px / xs 12px / sm 14px / xl 16px / 3xl 18px; font-bold; leading-snug (1.375); `margin-top:-0.160rem` |
| `.logo__accronym` | font-bold leading-snug; **nur <480px** (`xs:hidden`) — mobil steht das Kürzel statt des vollen Namens |

#### 3.4 Burger (mobil)
| Selektor | Werte |
|---|---|
| `.burger` | h-full flex items-center; **≥1024px hidden**; `px-4 -mr-4` = 16px Padding, −16px Margin rechts |
| `.burger__icon` | 28×20px (`w-7 h-5`); Farbe text-500 #6b7280, hover primary-600 #d8232a |
| `.burger__bar` | 3 Balken je 2px (`h-[2px]` bzw. border 2px); Animation: `transition-transform duration-150 delay-150`; offen: Balken 1/3 rotieren ±45°, Balken 2 `scaleX(0)` |

Button-Markup: `button.burger[title="Toggle mobile menu"] > span.burger__icon[.burger--is-open] > 3× span.burger__bar`.

---

### 4. Metanavigation
Quellen: `css/navigations/meta-navigation.postcss`, `app/components/ch/navigations/MetaNavigation.vue`, `MobileMetaNavigation.vue`

Desktop-Markup: `div.meta-navigation-container > nav.meta-navigation.meta-navigation--desktop[aria-label="Meta"] > ul > li > a.meta-navigation__item` (Beispiele: Jobs, Kontakt, Medien, «Mehr» mit `span + SvgIcon MoreFilled md`).

| Selektor | Werte |
|---|---|
| `.meta-navigation` | flex; `a` flex items-center `px-3` = 12px |
| `.meta-navigation--desktop` | hidden; **≥1024px** flex, `mb-3` = 12px, ≥1280 `mb-4` = 16px; ul flex items-center |
| `.meta-navigation--mobile` | flex flex-col (nav aria-label="Meta") |
| `.meta-navigation__item span` | ≥1024px `sr-only`; `svg` hidden, ≥1024px block |
| `.meta-navigation-container` | flex |

Im Mobile-Menü erhalten Meta-Links `menu__item menu__item--small menu__item--border w-full` + bg secondary-50, hover secondary-100 (Quelle: `css/navigations/navy.postcss` Z.34–36, `css/sections/mobile-menu.postcss` Z.126–134).

---

### 5. Hauptnavigation Desktop (Desktop-Menü + Drawer)
Quellen: `css/sections/desktop-menu.postcss`, `css/navigations/main-navigation.postcss`, `css/navigations/navy.postcss`, `css/navigations/sticky-navigation.postcss`, `app/components/ch/sections/DesktopMenu.vue`, `app/components/ch/navigations/MainNavigation.vue`

#### 5.1 Struktur
```html
<div id="desktop-menu" class="desktop-menu">
  <div id="desktop-menu__overlay" class="desktop-menu__overlay hidden"/>
  <div><div id="desktop-navigation-id">
    <div class="container container--flex">
      <nav id="main-navigation" class="main-navigation main-navigation--desktop" aria-label="Main">
        <ul> <li><a><span>…</span></a></li> …
          <li id="more-button"><a role="button" class="navy__has-children desktop-menu__more">
            <span>Mehr</span><SvgIcon icon="MoreFilled"/></a>
            <ul id="more-container"/></li>
        </ul>
      </nav>
      <div id="desktop-menu__drawer" class="desktop-menu__drawer hidden">
        <button id="desktop-menu-closer" class="desktop-menu__close"><span>Schliessen</span><SvgIcon icon="Cancel"/></button>
      </div>
    </div>
  </div></div>
</div>
```
Untermenüs: verschachtelte `ul`; Elternlinks `a.navy__has-children[role=button]` mit `span` + ArrowRight; erste Kind-`li` enthält `a.navy__back` (ArrowLeft + «Back») und `h2.navy__title`.

#### 5.2 Leiste
| Selektor | Werte |
|---|---|
| `.desktop-menu` | `border-b` 1px; relative z-40 |
| `.main-navigation--desktop` | hidden, **≥1024px flex**; w-full; Höhe **56px (lg `h-14`) / 64px (xl `h-16`) / 80px (3xl `h-20`)**; `-ml-4` = −16px; relative; ul flex h-full; ul ul hidden |
| `> ul > li > a` | flex items-center; h-full; `px-4` = 16px; hover Farbe primary-600 #d8232a; leading-tight; whitespace-nowrap; `focus-visible` ring-inset |
| Aktiv-/Hover-Balken `a::after` | content:''; Höhe **3px** (`h-[3px]`); absolute `right-4 bottom-0 left-4` (16px eingerückt); bei `.active`/`:hover` bg **primary-500 #e53940** |
| `a.clicked` (Drawer offen) | bg-white; shadow-2xl (`0px 10px 20px 0px rgba(0,0,0,0.06), 1px 10px 70px -8px rgba(0,0,0,0.13)`); z-50; `clip-path: inset(-50px -50px -1px -50px)` |
| Icons | in Top-Level-Links hidden, Ausnahme `.icon--MoreFilled` |

#### 5.3 Drawer
| Selektor | Werte |
|---|---|
| `.desktop-menu__drawer` | erst ≥1024px (`lg:block`); Breite/Padding: **450px, p-8 (32px), pt-16 (64px)** / ≥1280 **650px, p-12 (48px), pt-20 (80px)** / ≥1920 **850px, p-24 (96px)**; absolute z-30; **top: 56px / xl 64px / 3xl 80px** (`top-14 xl:top-16 3xl:top-20`); left-0; bg-white; shadow-2xl; `transition: opacity 300ms ease-in-out, height 200ms ease-in-out`; Kinder `translate-y-0 duration-300` |
| `.desktop-menu__drawer.hidden` | `display:block !important; height:0 !important;` overflow-hidden, p-0, opacity-0; Kinder `-translate-y-8` (−32px) |
| `.desktop-menu__drawer.with-offset` | `left:-16px` / xl `-32px` / 3xl `-80px` |
| `.desktop-menu__overlay` | ≥1024px block; Höhe 120vh; absolute z-20 top wie Drawer (56/64/80px), right/bottom/left 0; Verlauf `from-text-900/20 via-text-900/20 to-transparent` (rgba(17,24,39,0.2)); transition-opacity 300ms |
| `.desktop-menu__close` | hidden, ≥1024px block; `menu__action-btn` (px-4 py-3, 14px/3xl 16px, Farbe text-500, hover bg secondary-50); absolute **lg: top-4 right-0 (16px/0), xl: top-6 right-4 (24/16px), 3xl: top-8 right-20 (32/80px)**; Icon 20×20px (`h-5 w-5`) |
| `.sticky-navigation` (per JS) | `position:fixed !important; left:0; right:0; z-index:1000`; border-b; bg-white; `top` = Höhe der Top-Bar (JS) |

#### 5.4 Navy (Ebenen-Slider im Drawer und Mobile-Menü)
Quelle: `css/navigations/navy.postcss`

| Selektor | Werte |
|---|---|
| `.navy` | relative; `perspective:1200px`; height 100% |
| Items (`.navy li > a/span/button`) | `menu__item menu__item--small menu__item--border w-full` → px-4 py-3 (16/12px), 14px/3xl 16px Schrift, border-b secondary-100; ≥1280px `px-3 py-3` (12px); bg-white; hover bg secondary-50 |
| `a.active::after` | Balken **3px breit**, bg primary-500 #e53940, absolute top-0 bottom-0 left-0 |
| `.navy__has-children` | flex row, items-start, justify-between; Icon 20×20px |
| `.navy__back` | `menu__action-btn`; ≥1024px absolut `top:-48px; left:-20px` (`lg:-top-12 lg:-left-5`), ≥1280 `top:-56px`, ≥1920 `top:-64px`; Icon ≥1024px 20×20px; auf Ebene 0 nur mobil sichtbar (`block lg:hidden`) |
| `.navy__title` | menu__item + `--title` (lg:px-0, hover bg-white, cursor-default), font-bold, border transparent |
| `.navy__level-0…7` | absolute inset-0; `transform: translateX(0%); transition: transform 600ms ease-in-out, opacity 600ms ease-in-out` (600ms ist mit Navy.js gekoppelt) |
| `.show-level-N` | Ebene N `translateX(0%) opacity:1`; Ebenen <N `translateX(-100%) opacity:0`; Ebenen >N `translateX(100%) opacity:0` |
| `.navy__level-0` | bg secondary-500, ≥1024px bg-white |
| Mobile-Einfärbung | `.mobile-menu .navy__level-0 ul:nth-of-type(2) a` → `menu__item--grey` (bg secondary-50); `ul:nth-of-type(3) a` → `menu__item--negative` (bg secondary-600, weiss) |

---

### 6. Mobile-Menü
Quellen: `css/sections/mobile-menu.postcss`, `app/components/ch/sections/MobileMenu.vue`, `css/foundations/global.postcss`

Struktur: `div#mobile-menu-id.mobile-menu[.mobile-menu--is-open] > MainNavigation(context=mobile) + MetaNavigationMobile + TopBarNavigation(isMobileMenu)`. Navigations-Stapel: Hauptnavi (weiss) → Metanavi (grau secondary-50) → Top-Bar-Links (dunkel secondary-500).

| Selektor | Werte |
|---|---|
| `.mobile-menu` | invisible, opacity-0, **≥1024px hidden**; w-full h-0; absolute z-10; `transition-opacity duration-700`; bg-white; shadow-2xl |
| `.mobile-menu--is-open` / `.body--mobile-menu-is-open .mobile-menu` | block (<1024px); **height: calc(100vh − 65px)**; visible opacity-100; overflow-y-auto |
| `.body--mobile-menu-is-open` (auf `<body>`) | overflow-hidden; `height: calc(100vh + 3rem)`; **`transform: translateY(-3em)`** (Seite rutscht 48px nach oben); Body hat `transition-transform duration-700` |
| `.main-navigation--mobile` | flex flex-col (Quelle `main-navigation.postcss` Z.6–9) |
| `.mobile-menu-navigation-bar` (Simple-Page-Variante) | border-b; relative z-40; `xs:px-5 md:px-10` = 20/40px; ≥1024px hidden |
| `.mobile-menu-sticky-navigation` | fixed left/right 0, z-1000, border-b, bg-white, `xs:px-5 md:px-10 lg:hidden` |

#### Mobile-Menü V2 (Vollbild-Variante)
| Selektor | Werte |
|---|---|
| `.mobile-menu-v2` | bg secondary-500; invisible/opacity-0, ≥1024px hidden; absolute z-50 inset-0; transition-opacity 700ms; offen: height 100vh, overflow-y-auto (Body-Klasse `.body--mobile-menu-v2-is-open`) |
| `.mobile-menu-v2__back-button` | absolute top-0 left-0; `margin-top: 2.2rem`, ≥768px `3.7rem`; `margin-left: 0.4rem`; sichtbar via `--is-visible` (flex) |
| `.mobile-menu-v2__close-button` | absolute top-0 right-0; `mt-8 md:mt-12` = 32/48px; `mr-4 xs:mr-7 sm:mr-9` = 16/28/36px |
| `.top-header__menu-v2-title` | bg-white; font-bold; `pt-[6.5rem] md:pt-[8rem]` = 104/128px; `pb-6` = 24px; `px-4` = 16px; `border-b-2` |
| Aktiv-Balken | `a.active::after` Breite **5px**, bg primary-500, absolute links |
| `.mobile-menu-v2__level` | absolute left/right 0; `transition: transform 600ms ease-in-out`; gleiche show-level-N-Mechanik wie Navy |

---

### 7. Brotkrumen (Breadcrumb)
Quellen: `css/sections/breadcrumb.postcss`, `app/components/ch/sections/Breadcrumb.vue`, `app/components/ch/navigations/BreadcrumbNavigation.vue`

Struktur: `div#breadcrumb.breadcrumb.container.container--flex > nav[aria-label="Breadcrumb"] > ul > li > a [+ ul (Drawer)]`. Auf der Startseite entfällt der Breadcrumb (`v-if="!isHomePage"`). Erster Eintrag «Startseite»; Folgeeinträge mit `SvgIcon ChevronRight.breadcrumb__include-icon[aria-hidden]` vor dem `span` und `SvgIcon ChevronDown.breadcrumb__dropdown-icon[aria-hidden]` danach; aktive Links `class="active" aria-current="true"` (letzte Ebene `aria-current="page"`).

| Selektor | Werte |
|---|---|
| `.breadcrumb` | `py-2 xl:py-3` = 8/12px; relative z-20; Schrift 14px (`text-sm`), Farbe text-500 #6b7280; **hidden, erst ≥1024px block** (Breadcrumb ist Desktop-only) |
| `.breadcrumb nav` | `-ml-4` = −16px |
| `.breadcrumb > nav > ul` | flex flex-wrap; li flex relative |
| `.breadcrumb a` | flex items-center; `px-4 py-2` = 16/8px, ≥768px `py-4` = 16px; hover Farbe primary-600; leading-tight; transition-colors |
| `a.clicked` | bg-white, shadow-2xl, z-50, `clip-path: inset(-50px -50px 0 -50px)`; folgendes `ul` wird block + opacity-100 (transition-opacity 300ms) |
| `.breadcrumb__dropdown-icon` | 1.25em × 1.25em; `ml-2` = 8px; Farbe primary-600; **border 1px primary-600, rounded-sm 2px**; Pfad rotiert 180° in 300ms bei `.clicked` |
| `.breadcrumb__include-icon` | `-ml-5 mr-3` = −20px/12px; blendet bei `.clicked` aus (opacity 200ms) |
| Drawer `.breadcrumb ul ul` | Breite **300px**; `p-2` = 8px; `mt-px` = 1px; absolute z-10 `top:3rem` (48px) left-0; bg-white shadow-2xl |
| Drawer-Links | `menu__item menu__item--mini menu__item--border w-full` → px-4 py-2 (16/8px), border-b secondary-100; hover Farbe primary-600; `a.active::after` Balken **2px** bg primary-600 links |

---

### 8. Hero
Quellen: `css/sections/hero.postcss`, `app/components/ch/sections/Hero.vue`, `css/layouts/container.postcss`, `css/layouts/grids.postcss`

Struktur: `section.hero[.hero--{type}] > div.container.container--grid.gap--responsive > div.hero__content (h1.hero__title, h2.hero__subtitle, div.hero__description, div.hero__cta) + div.hero__image`. Typen: `default | main | main-image | hub | title-only | sr-only | overview`.
`gap--responsive` = gap 20px / xs 28px / sm 36px / lg 40px / xl 48px / 3xl 64px.

| Selektor | Werte |
|---|---|
| `.hero` | `container--pb` (pb 56/80/128px) + `pt-12 lg:pt-14 3xl:pt-20` = **48 / 56 / 80px oben**; figure py-0 |
| `.hero__content` | vertikaler Abstand der Kinder `space-y-6 lg:space-y-8 3xl:space-y-10` = 24/32/40px |
| `.hero__title` | `.text--3xl` (26→48px) font-bold leading-tight; break-words |
| `.hero__subtitle` | `.text--xl` (20→32px) font-bold leading-tight |
| `.hero__description` | `.text--lg` (18→22px) leading-snug (1.375) |
| `.hero__cta .btn` | `mr-4 md:mr-5 xl:mr-6` und `mb-4 md:mb-5 xl:mb-6` = 16/20/24px |
| `.hero--default` | content `container__center--sm` (12 → md 10/start 2 → xl 8/start 3 Spalten); image `container__center--md` |
| `.hero--title-only` | `container--pb-half` (28/40/64px) ; content `container__center--xs` |
| `.hero--main-image` | `container--py` (56/80/128px); content + image je col-span-12, ≥768px je col-span-6; title `.text--3xl` |
| `.hero--main` | `py-20 lg:py-32 3xl:py-40` = **80 / 128 / 160px**; content col-span-12 / md 10 / lg 8; title `.text--4xl` (32→56px) |
| `.hero--hub`, `.hero--overview` | `pb-16 md:pb-16 3xl:pb-28` = 64/64/112px; content col-span-12 / md 10 / lg 8; image `container__aside` (md col-span-5 ab Spalte 8, lg col-span-4); `--overview` zusätzlich title `!mb-0` |

---

### 9. Footer
Quellen: `css/sections/footer.postcss`, `app/components/ch/sections/FooterInformation.vue`, `FooterNavigation.vue`, `app/pages/index.vue`

#### 9.1 Struktur
```html
<footer id="main-footer" class="footer">
  <div class="bg--secondary-600">                       <!-- #2f4356 -->
    <div class="container"><div class="footer-information">
      <div class="footer-information__entry">…Über uns…</div>
      <div class="footer-information__entry"> <div class="footer-information__social">…Socials…</div> <Btn variant="outline-negative"/> </div>
      <div class="footer-information__entry footer-information__entry--big">
        <div class="footer-information__links"> 2× <div class="footer-information__links-column">…</div> </div>
      </div>
    </div></div>
  </div>
  <div class="bg--secondary-700">                       <!-- #263645 -->
    <nav class="container" aria-label="Footer">
      <ul class="footer-navigation"> <li><a class="footer__link">Rechtliches</a></li> <li><a class="footer__link">Datenschutz</a></li> </ul>
    </nav>
  </div>
</footer>
```

#### 9.2 Masse
| Selektor | Werte |
|---|---|
| `.footer-information` | mobil flex-col; **≥1024px grid 3 Spalten, gap 64px (`gap-16`)**; ≥1280px 4 Spalten; vertikales Padding `container--py` = 56/80/128px |
| `.footer-information__entry` | `mb-16` = 64px (≥1024 0); Text weiss; `h3`/`__entry-title`: `.text--xl` + `mb-6 lg:mb-10` = 24/40px; `p` `mb-3 xl:mb-4` = 12/16px; `--big` ≥1280px col-span-2 |
| `.footer__link` | inline-flex items-center; `py-2` = 8px; weiss, hover/focus #d1d5db; Icon `.footer-information__icon` `w-[1.4em]`, `mr-1` = 4px, stroke-current |
| `.footer-information__link--icon-right` | flex-row-reverse; Icon `ml-[0.2em]`, `left-[0.1em]` |
| `.footer-information__social` | `mb-6 lg:mb-8` = 24/32px; `-mt-2` = −8px (Ausgleich Link-Padding); `.footer__link` `mr-5` = 20px; svg `stroke-width: 0.1px` |
| `.footer-information__links` | flex-col / ≥640 row + gap 64px / ≥1024 col / ≥1280 row + gap 64px; `-mt-4` = −16px; `__links-column` flex-1 |
| `.footer-information__links .footer__link` | w-full; flex justify-between; **`py-4 px-2` = 16px/8px; `border-b` 1px secondary-300 #828e9a**; hover bg secondary-700 + weiss; Icon h-6 = 24px |
| `.footer-navigation` | flex; `py-3` = 12px; `space-x-2 sm:space-x-4` = 8/16px; Schrift `.text--xs` (12/14/16px) |
| `#main-footer` | relative z-0 (Quelle `global.postcss`) |

Socials im Footer (FooterInformation.vue): Icons Facebook, Twitter (𝕏), Youtube, LinkedIn, Xing als `a.footer__link`; zusätzlich Btn «News abonnieren» (`variant="outline-negative"`, Icon ArrowRight rechts).

Hinweis: `css/sections/socials.postcss` (`.socials`, `.socials__grid` sm:2 / md:4 / xl:12 Spalten, Items col-span-4 auf xl) betrifft die **Social-Media-Sektion im Seiteninhalt**, nicht den Footer.

---

### 10. Back-to-top
Quellen: `css/components/back-to-top-btn.postcss`, `app/components/ch/components/BackToTopBtn.vue`

Markup: `div.back-to-top-wrapper > a.back-to-top-btn.back-to-top-btn--{default|negative|outline}[href="#main-header"][aria-label="Scroll to top"] > SvgIcon ChevronUp.back-to-top-btn__icon`. Platzierung am Ende von `<main>` (index.vue).
`html { scroll-behavior: smooth }` nur bei `prefers-reduced-motion: no-preference`.

| Selektor | Werte |
|---|---|
| `.back-to-top-wrapper` | absolute; `top:80vh; right:0.75rem (12px); bottom:-3.5rem (−56px)`; ≥1024px bottom −4rem (−64px); ≥1280px `right:1rem (16px); bottom:-5rem (−80px)`; z-index 500; pointer-events:none |
| `.back-to-top-btn` | **44×44px** (`w-11 h-11`); ≥1024px **48×48px**; ≥1280px **64×64px**; inline-flex items-center justify-center; `rounded-sm` = 2px; shadow-lg, hover shadow-xl; appearance-none |
| im Wrapper | `position: sticky` (Fallback fixed); pointer-events:all; `top: calc(100vh − 3.5rem)`; ≥1024px `calc(100vh − 4.5rem)`; ≥1280px `calc(100vh − 5rem)` |
| `.back-to-top-btn__icon` | Breite 50% der Buttonbreite (`w-1/2`), h-full; `stroke-[0.3px]` stroke-current |
| `--default` | bg-white; Icon secondary-500 #46596b, hover primary-600 #d8232a |
| `--negative` | bg secondary-500, hover secondary-600; Icon weiss |
| `--outline` | bg-white; **border 1px primary-600 #d8232a**, hover border primary-700 #bf1f25; Icon primary-600, hover primary-700 |

---

### 11. Sticky-Verhalten (Zusammenspiel, per JS)
Quellen: `app/components/ch/sections/TopBar.vue` (handleScroll), `DesktopMenu.vue` (handleScroll), `MobileMenu.vue`, `css/sections/top-bar.postcss` (`.sticky-top-bar`), `css/navigations/sticky-navigation.postcss`

| Element | Verhalten |
|---|---|
| Top-Bar | ab `scrollY > offsetTop`: Klasse `.sticky-top-bar` (fixed top 0, z-1000); Platzhalter `#stickyTopBarPlaceholder` erhält die TopBar-Höhe |
| Desktop-Navigation | ab `scrollY > topHeader.offsetTop + topHeader.clientHeight − topBar.clientHeight`: `.sticky-navigation` (fixed, z-1000, border-b, bg-white), `top` = TopBar-Höhe; Platzhalter `#sticky-desktop-navigation-placeholder` |
| Mobile-Navigationsleiste | analog: `.mobile-menu-sticky-navigation`, `top` = TopBar-Höhe |

z-Stapel des Chromes: `#main-header` z-30 → `.desktop-menu` z-40 (Drawer z-30, Overlay z-20) → Breadcrumb z-20 → sticky Elemente z-1000 → Back-to-top-Wrapper z-500 → `.skip-to-content` z-50.

## CD Bund Design System v1.0.5 — Konventionen (Messlatte)

Quelle: `C:\Users\david\Documents\GitHub\designsystem` (package.json: `"version": "1.0.5"`).
Alle Tailwind-Klassen sind auf berechnete Werte aufgelöst (Basis `html` = 16px; eigene Theme-Skalen aus `app\tailwind.config.js`). Pfadangaben relativ zum Repo-Root.

---

### 1. Klassen-Namensschema (BEM-Variante)

Schema: `.block`, `.block__element`, `.block--modifier`, `.block__element--modifier`. Kebab-case für alle Namensteile. Kein Präfix wie `c-`/`o-`/`u-`.

| Ebene | Muster | Beispiele | Quelle |
|---|---|---|---|
| Block | `.block` (kebab-case) | `.btn`, `.badge`, `.card`, `.tabs`, `.alert-banner`, `.back-to-top-btn`, `.notification-banner` | `css/components/*.postcss` |
| Element | `.block__element` | `.btn__text`, `.btn__icon`, `.badge__icon`, `.card__image`, `.card__header`, `.card__content`, `.card__body`, `.card__title`, `.card__description`, `.card__footer`, `.tab__controls-container`, `.tab__controls`, `.tab__control`, `.tab__container`, `.logo__title`, `.logo__accronym` (sic, Tippfehler im Original!) | `css/components/btn.postcss`, `badge.postcss`, `card.postcss`, `tab.postcss`, `logo.postcss` |
| Doppel-Element (existiert!) | `.block__el__el` | `.card__footer__action`, `.card__footer__info` | `css/components/card.postcss` Z.114/254, `css/print.postcss` Z.64 |
| Element-Variante als eigenes Element (kein `--`) | `.block__element-variante` | `.btn__text-centered`, `.badge__icon-left`, `.card__content-icons` | `btn.postcss` Z.139, `badge.postcss` Z.92, `card.postcss` Z.236 |
| Modifikator (Typ) | `.block--modifier` | `.btn--outline`, `.btn--bare`, `.btn--filled`, `.btn--link`, `.btn--outline-negative`, `.btn--bare-negative`, `.btn--link-negative` | `btn.postcss` |
| Modifikator (Grösse) | `--sm/--base/--lg` | `.btn--sm`, `.btn--base`, `.btn--lg`; `.badge--sm`, `.badge--base`; `.icon--sm` … `.icon--5xl` | `btn.postcss`, `badge.postcss`, `foundations/icons.postcss` |
| Modifikator (Farbe/Semantik) | `--farbe` / `--semantik` | `.badge--gray`, `.badge--red`/`.badge--error`, `.badge--yellow`, `.badge--orange`/`.badge--warning`, `.badge--green`/`.badge--success`, `.badge--blue`/`.badge--info`, `.badge--indigo`, `.badge--purple`, `.badge--pink`, `.badge--negative` | `badge.postcss` (Aliasse als Selektorliste, z. B. `.badge--red, .badge--error`) |
| Modifikator (Element) | `.block__el--mod` | `.card__footer--icon-only` | `card.postcss` Z.250 |
| Modifikator (Icon-Position) | `--icon-*` | `.btn--icon-none`, `.btn--icon-only`, `.btn--icon-left`, `.btn--icon-right`, `.btn--icon-180` | `btn.postcss` |
| Zustands-/Layout-Modifikator | `--zustand` | `.badge--disabled`, `.badge--clickable`, `.card--clickable`, `.card--flat`, `.card--highlight`, `.btn--full-width`, `.btn--back`, `.container--reverse`, `.grid--reverse` | `badge.postcss`, `card.postcss`, `btn.postcss`, `layouts/*.postcss` |

#### Konventions-Details

- **Modifikator ersetzt den Block nicht**: Markup kombiniert immer Basis + Modifikator (`class="btn btn--outline btn--sm"`, `class="icon icon--md"`). Grössen-Basisregeln stehen als Selektorliste `.btn, .btn--base { … }` bzw. `.badge, .badge--base { … }`.
- **Komposition per `@apply` von Komponentenklassen**: `.card--list { @apply card--flat; }` und `.card--list-without-image { @apply card--flat; }` (`card.postcss` Z.332/403); `figcaption { @apply legend; }` (`typography.postcss` Z.136). Der Intranet-Skin wendet `@apply badge badge--blue` auf `::after` an (`skins/intranet.postcss`).
- **`-negative` = Variante für dunklen Hintergrund**: `.btn--outline-negative`, `.btn--bare-negative`, `.btn--link-negative`, `.badge--negative`, `.text--negative`, `.color--negative` (btn/badge/typography/colors).
- **Body-State-Klassen** (Zustand global, Muster `.body--<zustand>`): `.body--mobile-menu-is-open` (`overflow-hidden; height: calc(100vh + 3rem); transform: translateY(-3em)`), `.body--mobile-menu-v2-is-open` (`overflow-hidden; height: 100vh`), `.body--mobile-menu-is-open-top-bar-disabled`, `.body--intranet`, `.body--freebrand` (`foundations/global.postcss` Z.34–48, `skins/*.postcss`).
- **IDs für Seitengerüst**: `#main-header` (`z-30`), `#main-content` (`flex-grow`, `z-10`), `#main-footer` (`z-0`); App-Mounts `#root, #__nuxt, #__layout, #vue-app, #app` (`foundations/global.postcss`).
- **Klassen mit Slash** (im CSS escaped, im HTML mit `/`): `.grid--responsive-cols-1\/2-1\/2`, `.grid--responsive-cols-1\/4-3\/4`, `.grid--responsive-cols-3\/4-1\/4`, `.grid--responsive-cols-1\/3-2\/3`, `.grid--responsive-cols-2\/3-1\/3` → HTML: `grid--responsive-cols-2/3-1/3` (`layouts/grids.postcss`).
- **Zustände via Attribut nur bei Tabellen-Sortierung**: `th[aria-sort='descending']`, `th[aria-sort='ascending']` (`components/table.postcss` Z.129/133). Sonst keine `[aria-*]`- oder `.is-*`-Selektoren im CSS; JS/Vue togglet Modifikator-/Body-Klassen.
- **Fokus-Konvention** (global): `*:focus-visible { outline-none; ring: 2px #8655f6 (purple-500); z-10 }`; innerhalb `.top-bar` und `.bg--secondary-500`…`-900`: Ring `#c4b5fd` (purple-300) (`foundations/global.postcss` Z.75–86).
- **`font-bold` ist KEIN Gewicht 700**: Tailwind-Config setzt `fontWeight: { normal: 400, bold: 400 }`; Fettung geschieht über Font-Familie `font-bold` = `Font-Bold, Hind, Fallback-font` (`app/tailwind.config.js` Z.200–224).

---

### 2. Utility-Muster (Doppelstrich ohne Block-Kontext)

Eigene Utility-Familien nutzen dasselbe `--`-Muster wie Modifikatoren, aber mit Funktionspräfix:

| Familie | Klassen | Berechnete Werte | Quelle |
|---|---|---|---|
| Text-Grösse | `.text--xs` … `.text--5xl` | responsiv, z. B. `.text--base` = 16px, xl≥1280: 18px, 3xl≥1920: 20px; `.text--sm` = 14/16/18px; `.text--lg` = 18/20/22px | `foundations/typography.postcss` |
| Schriftstil | `.font--regular`/`.text--regular`, `.font--italic`/`.text--italic`, `.font--bold`/`.text--bold`, `.font--bold-italic`/`.text--bold-italic` | Familienwechsel (Weight bleibt 400) | `typography.postcss` Z.59–77 |
| Textfarbe (semantisch) | `.text--negative` (weiss), `.text--default` (#1f2937 = text-800), `.text--light` (#6b7280 = text-500) | | `typography.postcss` Z.79–89 |
| Textfarbe (Skala) | `.color--default`, `.color--light`, `.color--negative`, `.color--link` (#d8232a = primary-600), `.color--white`, `.color--black`, `.color--text-50…900`, `.color--primary-50…900` | | `foundations/colors.postcss` |
| Hintergrund | `.bg--white`, `.bg--secondary-50` … `.bg--secondary-900` | Werte = Sekundärskala des aktiven Skins | `foundations/backgrounds.postcss` |
| Gap | `.gap--responsive`, `.gap--top`, `.gap--bottom` | 20px, xs≥480: 28px, sm≥640: 36px, lg≥1024: 40px, xl≥1280: 48px, 3xl≥1920: 64px (gap bzw. pt/pb) | `layouts/grids.postcss` Z.9–19 |
| Überschriften als Klassen | `.h1` (= `.text--3xl` fett, `mb-4` 16px), `.h2` (= text--2xl), `.h3` (= text--xl), `.h4` (= text--lg), `.h5` (= text--base) | | `typography.postcss` Z.106–129 |
| Sonstige | `.legend` (= text--xs, `pt-2` 8px, Farbe #6b7280), `.overtitle` (flex, `space-x-2` 8px, #dfe4e9/secondary-100, 12px), `.text--asterisk::after` (`content: '\202F*'`), `.skip-to-content`, `.broader-than-container` (einzige Klasse in `@layer utilities`, negative Seitenränder via `--side-margin`) | | `typography.postcss`, `global.postcss`, `layouts/container.postcss` Z.148–174 |
| Vertikal-Rhythmus | `.vertical-spacing > *` = `margin-top: 48px`, 2xl≥1544: 56px; nach Titeln `mt: 1.5em`, Titel+p `1em`; p+p/p+ul/ul+p `1em` | | `foundations/spacings.postcss` |

Container-Utilities (Block `container` mit `--`/`__`): `.container--py` (py 56px, lg: 80px, 3xl: 128px), `.container--py-half` (28/40/64px), `.container--pt`, `.container--pb`, `.container--pb-half`, `.container--flex`, `.container--grid` (12 Spalten), `.container__full`, `.container__center--xs/--sm/--md`, `.container__main`, `.container__aside`, `.container__mobile`, `.container--reverse`, `.container--reverse-mobile` (`layouts/container.postcss`).

---

### 3. Dateinamens- und Ordnerkonventionen

| Bereich | Konvention | Beispiele |
|---|---|---|
| CSS | `css/{skins,foundations,layouts,components,navigations,sections}/<name>.postcss`, kebab-case, eine Komponente pro Datei; Kopfbanner-Kommentar `/*---…*\  NAME  \*…---*/` | `css/components/back-to-top-btn.postcss`, `css/navigations/main-navigation.postcss` |
| Einstieg / Import-Reihenfolge | `css/main.postcss`: 1. `tailwindcss/base` + `tailwindcss/components`, 2. Skins (default, intranet, freebrand), 3. foundations, 4. layouts, 5. components, 6. navigations, 7. sections, 8. `print.postcss`, 9. `storybook.postcss`, 10. ZULETZT `tailwindcss/utilities` (Utilities gewinnen über Komponentenklassen) | `css/main.postcss` |
| Vue-Komponenten | `app/components/ch/{components,demo,foundations,navigations,objects,sections}/<PascalCase>.vue` | `ch/components/Btn.vue`, `ch/components/SvgIcon.vue`, `ch/sections/DesktopMenu.vue` |
| Stories | `app/components/stories/{components,foundations,layout,pages,sections}/<PascalCase>.stories.js` (Ordner `layout` singular, Titel aber `Layouts/…`) | `stories/components/Btn.stories.js` |
| Icons | `app/assets/icons/<PascalCase>.svg` | `ArrowRight.svg`, `ChevronSmallDown.svg`, `CC-BY-NC-ND.svg` |
| Tailwind-Config | `app/tailwind.config.js`; `content` inkl. `./safelist.txt`; `corePlugins: { container: false }` (eigener `.container`) | |

---

### 4. Skins (default vs. intranet vs. freebrand)

Mechanik: Alle drei Skins werden immer geladen (`main.postcss`). Der Default definiert die CSS-Variablen auf `:root`, die Skins überschreiben sie über eine Body-Klasse; alles in `@layer base`. Tailwind bindet `primary`/`secondary` an die Variablen (`primary.600 = var(--color-primary-600)` usw., `app/tailwind.config.js` Z.40–63) — dadurch skinnt JEDE `primary-*`/`secondary-*`-Nutzung automatisch mit. `text`, `red`, `blue`, … bleiben skin-unabhängige Festwerte.

| Skin | Selektor | Quelle |
|---|---|---|
| Default (Rot) | `:root` | `css/skins/default.postcss` |
| Intranet (Blau) | `.body--intranet` | `css/skins/intranet.postcss` |
| Freebrand (Grün) | `.body--freebrand` | `css/skins/freebrand.postcss` |

#### Variablenwerte im Vergleich

| Variable | Default | Intranet | Freebrand |
|---|---|---|---|
| `--color-primary-50` | `#ffedee` | `#eff6ff` | `#eaffe9` |
| `--color-primary-100` | `#fae1e2` | `#dbeafe` | `#d3ebd2` |
| `--color-primary-200` | `#ffccce` | `#bfdbfe` | `#bdd8bc` |
| `--color-primary-300` | `#fa9da1` | `#93c5fd` | `#a7c4a6` |
| `--color-primary-400` | `#fc656b` | `#60a5fa` | `#91b191` |
| `--color-primary-500` | `#e53940` | `#3b82f6` | `#7c9f7c` |
| `--color-primary-600` | `#d8232a` | `#2563eb` | `#678d67` |
| `--color-primary-700` | `#bf1f25` | `#1d4ed8` | `#537b54` |
| `--color-primary-800` | `#99191e` | `#1e40af` | `#3e6940` |
| `--color-primary-900` | `#801519` | `#1e3a8a` | `#2a582e` |
| `--color-secondary-50` | `#f0f4f7` | `#f0f4f7` (grau, wie Default) | `#efffee` |
| `--color-secondary-100` | `#dfe4e9` | `#dfe4e9` (grau) | `#b0beb0` |
| `--color-secondary-200` | `#acb4bd` | `#acb4bd` (grau) | `#768176` |
| `--color-secondary-300` | `#828e9a` | `#828e9a` (grau) | `#404941` |
| `--color-secondary-400` | `#596978` | `#5076b3` (blau) | `#758874` |
| `--color-secondary-500` | `#46596b` | `#234dc2` (blau) | `#6a7f69` |
| `--color-secondary-600` | `#2f4356` | `#1e40af` (blau) | `#5f755f` |
| `--color-secondary-700` | `#263645` | `#1e3a8a` (blau) | `#546c55` |
| `--color-secondary-800` | `#1c2834` | `#1c3c7d` (blau) | `#49634b` |
| `--color-secondary-900` | `#131b22` | `#1c3c7d` (identisch mit 800!) | `#3e5a41` |

#### Was der Intranet-Skin GENAU ändert

1. **Primärskala** komplett auf die (in der Config fest definierte) Blau-Skala umgestellt — Werte identisch mit `blue-50…900` aus `app/tailwind.config.js`. Folge: `btn--outline`-Text/Rahmen = `#2563eb`, Hover `#1d4ed8`, `color--link` = `#2563eb` usw.
2. **Sekundärskala geteilt** (Kommentare im Quelltext: «light secondary colors are grey» / «dense secondary colors are blue»): 50–300 unverändert grau, 400–900 blau (Werte s. o.; 800 und 900 beide `#1c3c7d`). Folge u. a.: `btn--filled`-Hintergrund = `#234dc2` (secondary-500), Footer-/dunkle Flächen mit `bg--secondary-600` = `#1e40af`.
3. **Logo-Zusatzbadge** (einzige strukturelle Änderung):
   - `.logo__title::after { content: 'Intranet' }` + `@apply badge badge--blue mt-1 -ml-[1px]` + `block w-fit` → Pill `rounded-full` (9999px), Padding `0.219em/1em`, Text `#1e40af` auf `#dbeafe`, `margin-top: 4px`, `margin-left: -1px`.
   - `.logo__accronym::after`: dieselben Regeln plus `text-xs` (12px).

Der Freebrand-Skin ändert NUR die 20 Farbvariablen (keine Logo-/Struktur-Regeln).

---

### 5. Print-Styles (`css/print.postcss`, komplett `@media print`)

| Regel | Wert |
|---|---|
| `html` | `font-size: 13px !important; max-width: 80% !important; margin: 2rem auto !important` (13px-Basis skaliert ALLE rem-Werte im Druck) |
| Versteckt in `#main-header` | `.top-bar`, `.top-header__right`, `.desktop-menu`, `.mobile-menu-navigation-bar`, `.mobile-menu-sticky-navigation`, `.breadcrumb`, `.icon-header-mobile` (alle `display: none !important`) |
| Sichtbar gemacht | `.badge-easy-language { display: block !important }`, `.logo__name { display: block !important }` |
| `.top-header` | `border: 0px !important` |
| `.logo` | `align-items: flex-start !important` |
| `.logo__title` | `display: block; height: 6.05em; margin-top: 0.05em; margin-left: 1em; padding-left: 2em; border-left: 0.025em solid #d1d5db` |
| Global versteckt | `#main-footer`, `.notification-banner`, `.back-to-top-wrapper`, `.card__footer__action`, `.section__action`, `.socials`, `.card--twitter`, `.carousel__fonctions` (sic), `.newsletter`, `.card__image`, `.share-bar`, `.btn--back`, `.breadcrumb__dropdown-icon`, `.logo__separator`, `.alert-banner`, `video`, `audio`, `object`, `iframe` |
| `.grid` | `display: block` (wegen `break-inside`) |
| `.swiper-wrapper` | `page-break-after: always; transform: none !important; height: auto !important; display: flex; flex-wrap: wrap` |
| `.swiper-slide` | `flex-basis: 50%; width: auto !important; margin-right: 0 !important` |
| `.ratio` | `padding-bottom: 0 !important`; `.ratio + figcaption { display: none !important }` |
| `p, img, ul, .card` | `position: relative; display: block; break-inside: avoid` |
| `.card` | `margin-bottom: 2em` |
| Breadcrumb | `.breadcrumb nav { margin-left: 0 !important }`; `.breadcrumb-navigation a { padding-left: 0.25rem !important }`; `.breadcrumb__include-icon { margin-left: -0.75rem !important; margin-right: 0.5rem !important }` |

---

### 6. Icon-System

#### Basisklasse (`css/foundations/icons.postcss`)

```
.icon { width: auto; fill: currentColor; flex-shrink: 0; stroke-width: 0.3px; }
.icon path, .icon circle { fill: currentColor; }
```

Buttons/Badges überschreiben stroke responsiv: `.btn__icon`/`.badge__icon`: `stroke-width: 0.3px`, md≥768: `0.35px`, lg≥1024: `0.4px`; `.btn--link .btn__icon`: `stroke-0`, md: `0.05px`, lg: `0.1px` (`btn.postcss`, `badge.postcss`).

#### Grössen (nur Höhe; Breite auto)

| Klasse | Basis | md ≥768px | lg ≥1024px |
|---|---|---|---|
| `.icon--sm` | 12px / 0.75rem | — | — |
| `.icon--base` | 16px / 1rem | — | — |
| `.icon--md` | 20px / 1.25rem | 24px / 1.5rem | — |
| `.icon--lg` | 24px / 1.5rem | 28px / 1.75rem | — |
| `.icon--xl` | 28px / 1.75rem | 32px / 2rem | 36px / 2.25rem |
| `.icon--2xl` | 36px / 2.25rem | 40px / 2.5rem | 48px / 3rem |
| `.icon--3xl` | 48px / 3rem | 64px / 4rem | 80px / 5rem |
| `.icon--4xl` | 80px / 5rem | 96px / 6rem | 112px / 7rem |
| `.icon--5xl` | 112px / 7rem | 128px / 8rem | 144px / 9rem |
| `.icon--full` | `width: 100%` | — | — |
| `.icon--spin` | `animation: spin 0.5s linear infinite` (Config-Extend `animate-spin-fast`) | — | — |

In Komponenten em-basiert statt Icon-Grössenklasse: `.btn__icon { width: 1.4em; height: 100% }`, `.btn--icon-only { padding-inline: 0.625em }`, `.badge__icon { width: 1.5em; left: 0.4em }`, `.badge__icon-left { width: 1.5em; right: 0.4em }`.

#### Verwendung

- Markup: `<svg viewBox="0 0 24 24" class="icon icon--<size>"><path …/></svg>` (Beispiele in `app/components/stories/foundations/Icons.stories.js`).
- Vue: `app/components/ch/components/SvgIcon.vue` — Props `icon` (PascalCase-Dateiname), `size` (Validator: `sm, base, md, lg, xl, 2xl, 3xl, 4xl, full`; Default `base`), `spin` (bool). Erzeugte Klassen: `icon icon--{size} icon--{IconName} [icon--spin]`; lädt `app/assets/icons/{icon}.svg` via `vue-inline-svg`.
- Storybook-Titel: `Foundations/Icons/List`.

#### Bestand

218 SVGs in `app/assets/icons/`, PascalCase; 205 davon mit `viewBox="0 0 24 24"` (Ausnahmen: `CC-0`, `CC-BY`, `CC-BY-SA`, `CC-BY-ND`, `CC-BY-NC`, `CC-BY-NC-SA`, `CC-BY-NC-ND`, `CheckmarkBold`, `CheckmarkBoldRounded`, `ConfirmationBadge`, `EasyLanguage`, `Eraser`, `SignLanguage`). Pfade ohne `fill`-Attribut (erben `currentColor`).

Vollständige Namensliste:
ALD, AddressBook, Anchor, Apps, Archive, ArrowAngleBottomLeft, ArrowDown, ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight, Art, Audio, AudioDescription, AudioLow, AudioMute, Balance, BalanceSlash, Ban, Bed, Bell, BellSlash, Blind, Bolt, Book, Bookmark, Braille, Briefcase, Brush, Bug, Building, Bullhorn, Bullseye, CC-0, CC-BY-NC-ND, CC-BY-NC-SA, CC-BY-NC, CC-BY-ND, CC-BY-SA, CC-BY, Calculator, Calendar, Camera, Cancel, CancelCircle, Car, Certificate, Chart, ChartBar, ChartLine, ChartPie, Checkmark, CheckmarkBold, CheckmarkBoldRounded, CheckmarkCircle, ChevronDoubleLeft, ChevronDoubleRight, ChevronDown, ChevronLeft, ChevronLineLeft, ChevronLineRight, ChevronRight, ChevronSmallDown, ChevronSmallLeft, ChevronSmallRight, ChevronSmallUp, ChevronUp, Clock, Cloud, CloudUpload, Coffee, Cog, Compass, Compress, ConfirmationBadge, CreditCard, Crop, Database, Deaf, Desktop, Download, DragIndicator, Duplicate, EasyLanguage, Envelope, Eraser, Exchange, Expand, External, Eye, EyeSlash, Eyedropper, Facebook, Family, Fax, File, FileAudio, FileBullet, FileCheckmark, FileCode, FileDatabase, FileEPUB, FileExcel, FileForward, FileImage, FileJSON, FileLines, FilePDF, FilePPT, FilePlus, FileRefresh, FileServer, FileUser, FileVideo, FileWord, FileZip, Filter, Flag, FlagFilled, Flask, Folder, FolderOpen, Forward, Frown, Globe, Headphones, Heart, HeartFilled, Help, HelpCircle, History, Home, ID-Card, Image, Inbox, Industry, Info, InfoCircle, Instagram, Key, Keyboard, Lifering, Link, LinkedIn, List, ListParagraph, Lock, Login, Logout, LowVision, Magnet, Map, MapMarker, Menu, Microphone, MicrophoneSlash, Minus, Mobile, More, MoreFilled, PaperPlane, Pen, Phone, Pin, Plus, Printer, QRCode, RSS, Random, Refresh, Repeat, Reply, Save, Search, Server, Share, ShoppingCart, SignLanguage, Smile, SpeechBubble, Spinner, Stack, Star, StarFilled, Stop, Tablet, Tachometer, Tag, ThumbsDown, ThumbsUp, Ticket, Trash, Truck, Twitter, UniversalAccess, University, Unlink, Unlock, Upload, User, UserBrush, UserCheckmark, UserCode, UserCog, UserPen, Users, Video, Wand, Warning, WarningCircle, Wheelchair, WiFi, Wrench, Xing, Youtube.

---

### 7. Storybook-Organisation (`app/components/stories/**`)

Titelhierarchie (`title:` im Default-Export), 5 Top-Level-Kategorien:

| Kategorie | Untergruppen / Beispiele |
|---|---|
| `Foundations/` | `Backgrounds`, `Fonts/Sizes and styles`, `Fonts/Colors`, `Icons/List` |
| `Layouts/` | `Containers`, `Grids`, `Ratios`, `Sections`, `Spacings` (Ordner heisst `layout/`, Titel `Layouts/`) |
| `Components/` | flach (`Button`, `Badge`, `Card`, `Accordion`, `AlertBanner`, `AudioPlayer`, `Authors`, `BackToTopBtn`, `Carousel`, `DownloadItem`, `Link`, `List`, `Logo`, `Metainfo`, `Modal`, `Newsletter`, `Notification`, `NotificationBanner`, `Pagination`, `Popover`, `Print`, `Separator`, `Slideshow`, `Table`, `Tabs`, `TagItem`) plus Untergruppen `Form/` (`Input`, `Input Checkbox`, `Input Radio`, `Select`, `MultiSelect`, `Fieldset`, `Textarea`), `Card/` (`Cards variants`, `Cards and grids`), `Video/` (`Embed`, `Captions`, `Transcript`) |
| `Sections/` | `Header/` (`TopBar`, `TopHeader`, `DesktopMenu`, `MobileMenu`, `Breadcrumb`), `Footer/` (`FooterNavigation`, `FooterInformation`), `Content/` (`Hero`, `Quote`, `Contact`, `Socials`, `Portrait`, `DateBox`, `More Infos`) |
| `Pages/` | flach (`Homepage`, `Hub Page`, `Index Page`, `Detail Page Simple/Complex/Anchor Nav`, `Detail Page Event`, `Detail Press release`, `Detail Shopping Cart`, `Events List`, `News List`, `Search Results`, `Search Results with Filters`, `Form Example`, `Glossar`, `Test - Spacings`, `Test - Hero title only`) plus Untergruppen `Intranet/` (`Homepage`, `Detail Page Simple`), `Freebrand/` (`Detail Page Simple`), `Publication/` (`Katalog`, `Shop`), `Easy & Sign Language/` (`Overview/Detail Easy/Sign Language`), `Mail/` (`Mail Templates`) |

- Story-Dateien PascalCase `*.stories.js`; Komponenten-Import aus `../../ch/…`; Varianten-Kanon in argTypes deckt CSS-Modifikatoren (z. B. Btn: `variant: outline|bare|filled|outline-negative|bare-negative|link|link-negative`, `size: sm|base|lg`, `iconPos: none|only|left|right` → Klassen `btn--icon-none/-only/-left/-right`).
- Negative-Varianten werden auf `bg--secondary-600` demonstriert (`Btn.stories.js` Z.51).
- `css/storybook.postcss`: NUR Storybook-Hilfsklassen mit Präfix `storybook-` (`storybook-icon-list`, `storybook-color-list`, `storybook-show-grid`, `storybook-bg-negative` = `bg-secondary-600 !important`, …) plus `.sbdocs-content`-Fixes; Kommentar «TODO remove them from output» — diese Klassen sind NICHT Teil des CD und dürfen in Produkten nicht vorkommen.

---

### 8. Referenzwerte für die Auflösung (Kontext)

| Token | Wert |
|---|---|
| Breakpoints | `xs` 480px, `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1544px, `3xl` 1920px (`app/tailwind.config.js`) |
| Container-Maxbreiten | 2xl: 1544px, 3xl: 1676px; Innenabstand `.container`: 16/28/36/40/48/64px (Basis/xs/sm/lg/xl/3xl) |
| Radius-Skala (eigene!) | none 0, xs 1px, sm 2px, DEFAULT 3px, lg 5px, xl 6px, 2xl 8px, 3xl 10px, 4xl 12px, 5xl 15px, 6xl 24px, full 9999px |
| Schriftgrössen-Skala | xs 12, sm 14, base 16, lg 18, xl 20, 2xl 22, 3xl 26, 4xl 32, 5xl 40, 6xl 48, 7xl 56, 8xl 64, 9xl 80 (px, bei 1rem=16px) |
| Btn-Mindesthöhen | base 44px, xl≥1280: 48px, 3xl≥1920: 52px; sm 34/40/44px; lg 48/52/56px; `px-4` = 16px; `rounded-sm` = 2px (`btn.postcss`) |
| Badge | Padding `0.219em`/`1em`, `rounded-full`; base: 12→14→16px (Basis/md/lg); sm: 10→12→14px |

