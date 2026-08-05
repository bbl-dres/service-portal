# Accessibility-Kurzprüfung

| Merkmal | Wert |
| --- | --- |
| Stand | 5. August 2026 |
| Umfang | 57 repräsentative Routen und Zustände |
| Browser | Headless Microsoft Edge über Chrome DevTools Protocol |
| Referenz | WCAG 2.2 AA und Review-Vorgabe 44 × 44 px für Touch-Ziele |

## Ergebnis

Der reproduzierbare Kurztest ist für alle 57 Zustände ohne Befund durchgelaufen.
Die strukturierte Ausgabe liegt in
`docs/review-assets/accessibility.json`. Der ergänzende Render-Audit prüft
dieselben Zustände bei 320, 768 und 1440 px und liegt in
`docs/review-assets/audit.json`.

| Prüfung | Ergebnis |
| --- | ---: |
| Horizontaler Überlauf bei 200-%-Reflow-Simulation | 0 |
| Positive `tabindex`-Werte | 0 |
| Fokussierbare Elemente unter `aria-hidden="true"` | 0 |
| Ungültige `aria-controls`-/`aria-labelledby`-/`aria-describedby`-Referenzen | 0 |
| Zustände ohne sichtbaren Fokus beim ersten Tab-Schritt | 0 |
| Zustände ohne `main`-Landmarke im Accessibility Tree | 0 |
| Unbenannte Links, Buttons, Tabs oder Formularelemente im Accessibility Tree | 0 |

## Methode

### Tastatur und Fokus

Je Route werden alle sichtbaren Fokusziele auf positive `tabindex`-Werte und
verdeckte, aber weiterhin fokussierbare Elemente geprüft. Danach startet ein
echter Tab-Tastendruck über CDP am Dokumentanfang. Das erreichte Element muss
einen berechneten Outline- oder Box-Shadow-Fokusindikator besitzen. Die
Funktionssuiten prüfen zusätzlich Tabs, Comboboxen, Menüs, Modals, Viewer,
Filter, Formulare und Wizards mit ihren jeweiligen Tastaturinteraktionen.
`check-banner.mjs` setzt ausserdem synthetisch ein Fokusziel hinter den fixierten
Hinweisstreifen und prüft, dass es unmittelbar über die Overlay-Kante gescrollt
wird.

### 200 Prozent und Reflow

Ein Viewport von 720 CSS-Pixeln bei `deviceScaleFactor: 2` bildet den
Reflow-Druck eines 1440-Pixel-Viewports bei 200 Prozent deterministisch ab. Für
jede Route werden Dokumentbreite und sichtbare Breite verglichen. Es entstand
kein horizontaler Seitenüberlauf.

### Semantik und Screenreader-Proxy

`Accessibility.getFullAXTree` liefert pro Zustand den Chromium Accessibility
Tree. Geprüft werden die Hauptlandmarke und zugängliche Namen von Links,
Buttons, Tabs, Menüpunkten, Comboboxen, Eingabefeldern und weiteren Controls.
Zusätzlich validiert der DOM-Test alle lokalen ARIA-ID-Referenzen.

Der AX-Tree-Test ist ein reproduzierbarer Screenreader-Proxy, aber kein Ersatz
für die gesprochene Ausgabe einer konkreten Kombination wie NVDA/Firefox oder
JAWS/Edge. Ein kurzer Test mit realer Assistenztechnik bleibt deshalb ein
manueller Release-Check; im headless Entwicklungsumfeld wurde keine
Sprachausgabe bewertet.

## Zielgrössen

Auf Viewports unter 1024 px sowie bei grobem Zeiger oder fehlendem Hover gilt
die Review-Vorgabe von mindestens 44 × 44 px. Auf einem feinen Desktop-Zeiger
bleiben die kompakten CD-Bund-Masse zulässig, sofern das WCAG-Minimum von 24 ×
24 px eingehalten wird. Checkboxen und Radios werden über ihre anklickbare
Beschriftungszeile gemessen, nicht nur über das gezeichnete Kontrollsymbol.

## Ausführen

```powershell
$env:APP_BASE='http://127.0.0.1:8848/#'
node scripts/review-accessibility.mjs
node scripts/review-audit.mjs
```
