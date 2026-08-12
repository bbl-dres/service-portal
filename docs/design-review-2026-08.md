# Design-Review, CD-Abgleich (2026-08-12)

Frische Prüfung gegen die **Quelle**, nicht gegen die Dokumentation davon:
`C:\Users\david\Documents\GitHub\designsystem`, insbesondere
`css/foundations/*`, `css/layouts/*`, `css/components/*`, `css/skins/*` und
`app/tailwind.config.js` (der die Tailwind-Werte auflöst, auf die jedes `@apply`
im CD verweist).

## Wie geprüft wurde

Lesen allein genügt für «pixelgenau» nicht: eine Regel kann richtig dastehen und
per Spezifität verlieren, und eine responsive Rampe kann bei einer Breite
stimmen und bei der nächsten fehlen. Deshalb wurde jede Erwartung aus der
CD-Quelle transkribiert und anschliessend **im Browser gemessen** — dasselbe, was
man in den Devtools abliest.

Neu: `scripts/check-cd-contracts.mjs`. Es prüft elf Bausteine auf echten Seiten
bei den drei CD-Breakpoints, an denen sich etwas ändert (1024, 1280, 1920), und
nennt zu jedem die CD-Datei und Zeilennummer.

## Das Ergebnis zuerst

**Von rund 60 gemessenen Eigenschaften weicht genau eine ab.** Der Prototyp ist
bereits sehr genau am CD. Die Erwartung, hier flächige Abweichungen zu finden,
hat sich nicht bestätigt, und ein Bericht, der trotzdem eine lange Mängelliste
produziert, wäre erfunden.

Exakt getroffen, jeweils über alle drei Breiten gemessen:

| Baustein | CD-Quelle | Status |
|---|---|---|
| Typo-Rampen `text--xs`…`text--5xl` | `typography.postcss:18-57` | alle neun Stufen, alle Breakpoints |
| Farbrampen (default + intranet) | `skins/default.postcss`, `skins/intranet.postcss` | Wert für Wert identisch |
| `.container` Innenabstand | `container.postcss:5-17` | 40/48/64px |
| Sektionsrhythmus `container--py`, `--py-half` | `container.postcss:29-49` | 3.5/5/8rem |
| `.hero` Polster + `.hero__content` Abstände | `hero.postcss:5-16` | 32/32/40px |
| `.hero__title`, `.hero__description` | `hero.postcss:18-34` | Rampe + leading |
| `.section__title` | `section.postcss:53-56` | text--2xl, pb-10 |
| `.card__title` inkl. `leading-snug` | `card.postcss:215-220` | 18/20/22px, 24.75/27.5/30.25px |
| `.card__footer__info` | `card.postcss:254-257` | text--sm-Rampe |
| Tabellenkopf und -zellen | `table.postcss:34-57` | Polster, Rampen, uppercase |
| `.badge` Grösse und Radius | `badge.postcss:5-9,73-77` | .219em/1em, full |
| `.btn` Höhenrampe | `btn.postcss:112-117` | 44/48/52px |
| Kontrollgrössen `--control-size-*` | `btn.postcss:112-129` | 34/44/48/52px |

## Der eine Befund

### D1 · `.card__body` verliert bei schmalen Karten 16px Polster

`css/components/card.css:44-50` verkleinert das Polster von CDs `py-10` (40px)
auf 24px, sobald der Karten-Container schmaler als 500px ist — in einem
dreispaltigen Raster also fast immer. Gemessen: **40px erwartet, 24px erhalten**,
bei allen drei Breiten.

Das ist kein Versehen, sondern begründet dokumentiert («in a three-column grid a
card is ~400px wide; py-10 is 14% of its height»). CD selbst nutzt die
500px-Schwelle nur für die Zeilenbegrenzung des Textes (`card.postcss:230`),
nicht für Polster — CDs eigene dreispaltige Karten behalten `py-10`.

**Das ist eine Gestaltungsentscheidung, keine Korrektur**, und sie betrifft jede
Katalogkarte im Portal. Deshalb steht sie hier zur Entscheidung statt still
geändert zu werden:

- **CD folgen** → `@container (max-width:499px)` streichen; Karten werden luftiger
  und exakt CD-konform.
- **Bleiben lassen** → dann gehört die Abweichung in die Liste der bewussten
  Abweichungen, damit der nächste Durchgang sie nicht erneut als Fehler meldet.

## Zwei Korrekturen aus diesem Durchgang

### Karten-Hover ohne weissen Rand (bereits umgesetzt)

CD zeichnet auf `:hover` eine Kante: `border-2 border-text-50 border-opacity-0`
→ `border-opacity-90` (`card.postcss:20-40`), also #f9fafb bei 90 %. Das
funktioniert als Glanz, **weil jede CD-Karte auf `bg-white` steht**
(`card.postcss:5-9`). Die Hälfte der Kartenflächen hier steht auf dem getönten
Band (#f0f4f7), und dort liest sich dieselbe Kante als versehentlicher weisser
Rand. Ein grundabhängiger Effekt lässt sich nicht durch eine dritte Farbe
reparieren, deshalb bleiben die beiden CD-Signale, die auf jedem Grund tragen:
`shadow-2xl` und die Titelfarbe.

### Kommentar korrigiert

Der Kommentar dazu behauptete, das CD spezifiziere nur «opacity .9» und das
Portal habe mit einer Volltonfarbe genähert. Nach Einsicht in die Quelle stimmt
das so nicht — die Farbe war richtig, nur die Deckkraft fehlte. Der Kommentar
nennt jetzt die CD-Regel wörtlich.

## Nachtrag: vier Meldungen aus der Mobilansicht, in CD nachgeschlagen

**Externes Symbol in `.top-bar`** — kein Fehler. CD zeigt in der Leiste unter
1024 NUR das Symbol (`top-bar-navigation.postcss:7-11`, `span { hidden lg:block }`)
und im Schubfach NUR die Beschriftung (`.top-bar-navigation--mobile { svg { hidden } }`).
Die Verdoppelung ist CDs eigenes Modell. Unverändert gelassen.

**Zeilenumbruch bei «Alle Schweizer Bundesbehörden»** — ebenfalls CD:
`top-bar.postcss:136-138` setzt `span { w-min sm:w-full }`, unter 640 also eine
Spalte in Mindestbreite, die umbricht statt zu verschwinden. Bereits so umgesetzt.

**Benutzerzeile im Schubfach** — echter Fehler, behoben. CD macht dort jeden
Meta-Eintrag zu einer vollbreiten Zeile (`mobile-menu.postcss:126-134`), gestylt
über `ul a`. Der angemeldete Eintrag ist ein `<li>` aus Name, Trennstrich und
`<button>`: nur der Knopf traf einen Selektor und wurde 100 % breit, der Name
blieb ein Inline-Cluster — beide in einer Flex-Zeile, die aus dem Schubfach lief.
Jetzt eine Spalte aus Zeilen wie die Einträge darüber.

**Nach-oben-Knopf zu spät** — echter Fehler, behoben. CD verankert seine Hülle
bei `top: 80vh` des Inhalts und lässt sie bis zum Ende laufen
(`back-to-top-btn.postcss:11-25`): der Knopf existiert nach vier Fünfteln eines
Bildschirms. Die Schiene hier war 200vh hoch und am Fuss verankert. **Gemessen:
Startseite bei 375px ist 10,2 Bildschirme hoch, der Knopf erschien erst nach 5,6
Bildschirmen** — nach der halben Seite. Nach der Korrektur: ab dem ersten
Bildschirm, wie im CD.

**`gap--top` über dem Galerieraster** — kein Fehler, jetzt gemessen. CDs
Suchergebnisraster trägt `gap--responsive` + `gap--top`
(`search.postcss:196-201`), und `.catbar` ist hier CDs `.search-results__header`
(pb-2 + `border-b border-secondary-300`). Der Abstand ist der Abstand zwischen
Linie und erster Karte: 40/48/64px, in `check-cd-contracts.mjs` festgehalten.

## Was dieser Durchgang NICHT geprüft hat

Ehrlich zum Umfang: geprüft wurden die Grundlagen und die elf meistgenutzten
Bausteine auf sechs Routen. **Nicht** gemessen wurden die Fachanwendungen
(`js/apps/**`, siebzehn Stück mit eigenen Stylesheets unter `css/apps/`), der
Plan-Editor, die Detailansichten von Portfolio und Mietverhältnissen sowie
Mobil-Breiten unter 1024px.

Der nächste Durchgang sollte `check-cd-contracts.mjs` genau dorthin erweitern:
die Mechanik steht, jede weitere Prüfung ist ein Eintrag in `CHECKS`.
