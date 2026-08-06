# Accessibility-Kurzprüfung

| Merkmal | Wert |
| --- | --- |
| Stand | 6. August 2026 (Accessibility-Lauf); 5. August 2026 (Render-Audit) |
| Umfang | 58 Accessibility-Zustände; 57 Zustände im erhaltenen Render- und Screenshot-Snapshot |
| Browser | Headless Microsoft Edge über Chrome DevTools Protocol |
| Referenz | WCAG 2.2 AA und Review-Vorgabe 44 × 44 px für Touch-Ziele |

## Ergebnis

Der reproduzierbare Accessibility-Kurztest ist für alle 58 Zustände ohne Befund
durchgelaufen. Die strukturierte Ausgabe liegt in
`docs/review-assets/accessibility.json` und enthält auch Room Booking. Der ältere,
ergänzende Render-Audit prüfte 57 Zustände bei 320, 768 und 1440 px, insgesamt
also 171 Renderings; er liegt in `docs/review-assets/audit.json`.

Die Artefakte bilden bewusst zwei verschiedene Zeitstände ab:

| Artefakt | Abdeckung | Room Booking |
| --- | ---: | --- |
| `accessibility.json` | 58 Zustände × 1 Reflow-Viewport = 58 Prüfungen | Enthalten |
| `audit.json` | 57 Zustände × 3 Viewports = 171 Renderings | Nicht enthalten |
| Screenshots `before/` | 57 Zustände × 3 Viewports = 171 PNGs | Nicht enthalten |
| Screenshots `after/` | 57 Zustände × 3 Viewports = 171 PNGs | Nicht enthalten |

Room Booking kam nach dem gepaarten Screenshot-Baseline-Lauf zur Routenmatrix.
Es wurde nicht nachträglich nur in `after/` ergänzt und auch nicht mit einem
aktuellen Bild als vermeintlichem `before/` aufgefüllt, weil beides den
Vorher-/Nachher-Vergleich verfälschen würde. Die Route ist im aktuellen
Accessibility-Lauf und durch `scripts/test-room-booking.mjs` abgedeckt. Eine
künftige vollständige Screenshot-Serie soll mit einer neuen, gemeinsam
erzeugten Baseline beginnen.

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

Für einen Kontrolllauf wird ein temporäres Ausgabeverzeichnis verwendet. So
bleiben der ältere 57-State-Render-Audit und das gepaarte Screenshot-Artefakt
unverändert:

```powershell
$env:APP_BASE='http://127.0.0.1:8848/#'
$reviewOutput = Join-Path ([System.IO.Path]::GetTempPath()) ('service-portal-review-' + [guid]::NewGuid().ToString('N'))
$env:REVIEW_OUTPUT_DIR=$reviewOutput
node scripts/review-accessibility.mjs
node scripts/review-audit.mjs
Remove-Item Env:REVIEW_OUTPUT_DIR
```

Ohne `REVIEW_OUTPUT_DIR` überschreiben die beiden Skripte die getrackten
JSON-Artefakte. Das ist nur für eine bewusst gemeinsam aktualisierte
Review-Baseline vorgesehen; danach müssen Abdeckung, Datum und Artefaktstatus in
diesem Dokument ebenfalls angepasst werden. Die Screenshot-Paare werden nicht
einseitig ergänzt; das Verfahren ist in `scripts/README.md` beschrieben.
