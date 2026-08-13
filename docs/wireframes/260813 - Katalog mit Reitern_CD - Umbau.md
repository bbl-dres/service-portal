# CD-Umbau — «Katalog mit Reitern_CD»

Datei: [`260813 - Katalog mit Reitern_CD.html`](./260813%20-%20Katalog%20mit%20Reitern_CD.html)
Grundlage: `C:\Users\david\Documents\GitHub\designsystem` (Design System für die
Schweizerische Bundesverwaltung, v1.0.5)

Der Zwilling ohne Suffix behält sein eigenes, neutrales Stylesheet. Diese Fassung
ist auf das CD umgestellt: gleiche Daten, gleiches Verhalten, andere Hülle.

---

## Grundsatz: das Kompilat, nicht meine Lesart

Eingebettet ist **`dist/main.css` wortwörtlich** (352 KB) — das, was das Design
System tatsächlich erzeugt. Keine Auswahl, keine Abschrift, also auch keine
Abweichung durch Abschreiben. Der einzige Eingriff sind die vier
`url(fonts/…)`-Verweise, die zu Daten-URIs werden.

**Noto Sans Regular und Bold** liegen als Daten-URI in der Datei. Sie sind nicht
optional: das CD setzt `fontWeight: { normal: 400, bold: 400 }` und löst Fettung
über eine **eigene Schriftfamilie** (`Font-Bold`) auf. Ohne die zweite Datei gäbe
es keinen einzigen fetten Buchstaben. Die Kursiven fehlen bewusst — 1.5 MB für
Text, den diese Seite nicht kursiv setzt; die CD-Fallback-Kette greift, falls
doch.

**Die Icons stammen aus `app/assets/icons`** (218 Stück, gefüllte Pfade auf
24×24). Das ist keine Kosmetik: `foundations/icons.postcss` setzt
`fill: currentColor` auf jedes `path` und `circle`, weshalb ein strichbasierter
Satz — wie ihn der Zwilling benutzt — als schwarze Klumpen erscheinen würde.

### Eine Einschränkung, die die Arbeit geprägt hat

Tailwind-Utilities sind im Build **gegen den CD-Inhalt purged**. `.flex` und
`.sr-only` überleben, `.mt-4` und `.text-sm` nicht:

```
.flex ✓   .grid ✓   .sr-only ✓   .hidden ✓
.mt-4 ✗   .text-sm ✗
```

Es lässt sich also nichts «mit Tailwind» bauen. Alles steht auf CD-Komponenten-
klassen, und wo das CD nichts hat, auf einer klar abgegrenzten Zusatzschicht.

---

## Die Zuordnung

| Wireframe | CD | Quelle |
|---|---|---|
| Hülle, Rhythmus | `.container` `.section` `.box` | container/section/box.postcss |
| Brotkrumen | `.breadcrumb > nav > ul > li > a`, `.breadcrumb__include-icon` | sections/breadcrumb.postcss |
| Reiter | `.tab__controls-container` › `.tab__controls` › `.tab__control--active` | tab.postcss |
| Werkzeugknöpfe | `.btn.btn--outline.btn--sm` + `.btn__text` | btn.postcss |
| Menüs | `.menu__item--mini.menu__item--border` | menu.postcss |
| Suchfeld | `.input.input--sm` | input.postcss |
| Tabellen | `table.table`, `.table-wrapper` | table.postcss |
| Status | `.badge.badge--sm.badge--green/orange/gray` | badge.postcss |
| Diagrammkacheln | `.btn.btn--filled.btn--sm` | btn.postcss |
| KPI-Karten | `.card.card--default` | card.postcss |
| Seitenblättern | `.pagination` + `.btn--outline` | pagination.postcss |
| Baumzeilen | `.menu__item` | menu.postcss |
| Typografie | `.text--xs/sm/base/lg/xl/2xl`, `.font--bold`, `.text--light` | typography.postcss |

### Was das CD nicht hat

Vier Dinge, für die es keine Komponente gibt; sie liegen in einer eigenen,
kommentierten Schicht mit dem Präfix `wf-`:

1. **Baum.** Zeilen sind CD-`menu__item`; ergänzt ist nur die Tiefe
   (`--wf-step: 1.5rem`, ein konstanter Schritt je Stufe).
2. **Diagramm.** Kasten und Kopf borgen den Rahmen der Tabelle
   (`border-text-200` + `shadow-md`) und deren Kopfgrund (`bg-secondary-50`);
   die Kacheln sind CD-Knöpfe.
3. **Zwei-Spalten-Layout.** `.container` regelt den Seitenrhythmus, nicht einen
   Explorer. Das Raster ist gesetzt — mit `minmax(0,1fr)`, weil ein Rasterfeld
   sonst `min-width:auto` behält und eine breite Tabelle die Spalte aufzieht,
   statt in `.table-wrapper` zu scrollen.
4. **Kleinteile** ohne CD-Pendant: Definitionsliste, Zellknopf, Filterraster,
   Codeauszeichnung.

Keine Farbe ist erfunden. Jeder Wert der Zusatzschicht ist entweder eine
CD-Variable (`--color-secondary-*`, `--color-primary-*`) oder ein aus der
CD-Quelle gelesener Wert mit Fundstelle im Kommentar.

---

## Nachgemessen

Einundzwanzig Werte gegen die CD-Quelle, jeder mit Fundstelle:

```
✓ body Schrift      Font-Regular, Hind, Fallback-font, sans-serif
✓ body Grösse@1440  18px          ← text--base = text-base xl:text-lg
✓ body Ink          rgb(31,41,55) ← text-text-800
✓ Primärfarbe       #d8232a       ← skins/default
✓ Kopfzelle         16px 24px     ← thead th px-6 py-4
✓ Kopfzeile Grund   rgb(240,244,247) ← thead bg-secondary-50
✓ Datenzelle        16px 24px     ← td px-6 py-4
✓ Zeilentrenner     rgb(209,213,219) ← border-text-300
✓ Knopf Höhe        40px          ← btn--sm xl:min-h-[40px]
✓ Knopf Radius      2px           ← rounded-sm
✓ Knopf Rand/Ink    rgb(216,35,42) ← primary-600
✓ Eingabefeld       44px          ← --input-min-height
✓ Reiter Polster    16px          ← tab__control px-4 py-4
✓ Menüzeile         12px 16px     ← menu__item px-4 py-3
✓ Box Grund/Polster rgb(240,244,247) / 24px ← bg-secondary-50, lg:p-6
✓ Badge Radius      9999px        ← rounded-full
✓ Kachel            rgb(70,89,107) / weiss ← btn--filled bg-secondary-500
```

**Offline:** 4 Requests, 0 extern. **Verhalten:** unverändert — Reiter, Baum mit
vier Stufen, Falten, Blättern, Filter, Export-Umfang, Klickpfad von der KPI-Karte
über den Baum bis in die Attributtabelle. Keine Konsolenfehler.

---

## Was sich dadurch ändert — und was das kostet

**Die Seite wird deutlich grösser.** Die CD-Typografie ist responsiv:
`.text--base` ist 1 rem unterhalb 1280 px und **1.125 rem (18 px)** darüber,
`.text--sm` entsprechend 16 px. Der Zwilling arbeitet durchgehend mit 14 px. Die
Dichte sinkt spürbar; das ist der Preis der CD-Treue, kein Versehen.

**Die Werkzeugleiste bricht um.** CD-Knöpfe sind erheblich grösser
(`min-h-[40px]`, `px-4`), vier davon passen unterhalb von 1280 px nicht mehr
neben die Reiter. Die Zeile bricht, statt zu beschneiden.

**Rot ist laut.** `.btn--outline` ist `primary-600`, also Bundesrot. Eine
Werkzeugleiste aus vier roten Umrissknöpfen zieht mehr Aufmerksamkeit auf sich,
als ihre Funktion verdient. Das ist CD-korrekt und deshalb so belassen — falls es
stört, wäre `.btn--bare` (secondary-800) die CD-eigene Alternative.

**Die Datei wiegt rund 2 MB** statt 164 KB. Davon sind 1.5 MB die beiden
Schriftschnitte; das CD liefert kein WOFF2.

---

## Offen

- **Das CD kennt keinen Baum.** Die Zusatzschicht ist minimal und aus
  `menu__item` abgeleitet, aber ein echter Explorer-Baum wäre ein Kandidat für
  das Design System selbst.
- **`.tab__control` ist im CD ein Link in einer Leiste**, hier ein Knopf mit
  `role="tab"` samt Panel und Pfeiltasten. Das CD liefert für Reiter kein
  ARIA-Muster mit; die Ergänzung stammt aus der APG.
