# Geschäftsarchitektur und Prozessdokumentation — Codereview

Stand 2026-08-15. Zwei Anwendungen, die dasselbe tun: ein Seitenbaum wählt den
Umfang, drei Sichten zeigen ihn (Übersicht, Diagramm, Tabelle), eine Leiste
darüber trägt Suche und Bedienelemente. Sie sind unabhängig gewachsen, und das
sieht man.

Gemessen wird hier, nicht behauptet: jeder Befund nennt, woran man ihn sieht.

---

## 1 — Befunde: Fehler und Bruchstellen

### B1 · Drei Mechanismen für dieselbe Geste (behoben)

«Die Sicht wechseln» lief auf drei Wegen:

| Ort | Weg |
|---|---|
| Katalog | `history.replaceState` + `redraw()` an Ort und Stelle, ohne Router |
| Prozessdoku, Liste | `location.hash = hash(...)` über `wireCatalogue` |
| Prozessdoku, Detail | `replaceState` + ein **selbst ausgelöstes** `HashChangeEvent` |

Der dritte Weg hängt an `ctx.rerender`, das es **nirgends im Code gibt** —
`grep -rn "rerender" js/` findet genau die eine Zeile, die es abfragt. Der
Zweig fällt also immer auf das nachgemachte Ereignis zurück. Das funktioniert,
aber es funktioniert aus Versehen.

Der zweite Weg hatte einen echten Fehler (Nutzerfund): `catalogueHash` kennt
nur `q`, `page`, `view`, `sort` und die angemeldeten Filter. Von `branch`,
`org`, `area` und `axis` weiss es nichts — und was es nicht kennt, lässt es
weg. Auf «Fachliche Prozesse» die Sicht zu wechseln warf damit den Umfang aus
der Adresse und landete auf der Wurzel.

**Behoben:** `hashA` trägt Umfang und Achse mit, und `wireCatalogue` bekommt
`hashA` statt `hash`. Gemessen auf allen drei Stufen: der Umfang überlebt den
Wechsel.

### B2 · Faltzustand ohne Lebensdauer

Beide Anwendungen halten den Faltzustand der Landschaft in einer Map auf
Modulebene (`OPEN` bzw. `BOXES`), die **nie geleert wird** — `grep` findet
kein `.clear()`. Das ist gewollt, solange man innerhalb der Anwendung bleibt,
aber:

- Der Schlüssel ist die **Beschriftung** des Kastens, nicht seine Identität.
  Zwei Umfänge mit gleich benannten Gruppen teilen sich den Zustand. Heute
  kollidiert nichts (Domänen und Prozessgruppen heissen verschieden), aber die
  Falle ist gestellt.
- Der Zustand überlebt den Wechsel in eine andere Anwendung und zurück.

Latent, nicht akut. Dokumentiert statt behoben.

### B3 · Ungleiche Bedienelemente an gleicher Stelle

Im Katalog trägt **jede** Stufe ab 1 die Werkzeugzeile (`toolsHtml`, Zeile
664: `if (s.lvl < 1) return ''`). In der Prozessdokumentation hat die
**Prozessansicht gar keine** — `extra:` kommt dort im Aufruf der Leiste nicht
vor. Derselbe Ort, andere Möglichkeiten.

### B4 · Verschiedene Kosten für dieselbe Geste

Der Katalog tauscht beim Sichtwechsel nur die Fläche. Die Prozessansicht fährt
über die Adresse und **liest die BPMN-Datei jedes Mal neu**, samt Neuaufbau des
Betrachters. Bei einer örtlichen Datei ist das billig, aber es ist ein anderes
Kostenmodell für dieselbe Handlung — und es verwirft den Zoomausschnitt, den
der Leser gerade eingestellt hat.

### B5 · Was in Ordnung ist

Gegengeprüft und **kein** Befund:

- `wireMenu` hängt seine Zuhörer an die Kinder, nicht an den Behälter. Die
  Werkzeugzeile wird bei jedem `redraw` neu verdrahtet; weil ihr `innerHTML`
  dabei ersetzt wird, sammeln sich keine Zuhörer an.
- Die Suche entprellt mit 250 ms und räumt ihren Zeitgeber in `onUnmount` ab —
  kein Nachzügler auf abgehängtem DOM.
- Die asynchronen Stellen der Prozessansicht prüfen `ctx.stale()` nach **jedem**
  `await` (sechs Stellen), nicht nur nach dem ersten.

---

## 2 — Doppelter Code

| # | Was | Katalog | Prozessdoku |
|---|---|---|---|
| D1 | Faltgedächtnis der Landschaft | `OPEN` / `isOpen(key, fallback)` | `BOXES` / `boxOpen(key)` |
| D2 | «Alle zuklappen» + Kastenschalter | Zeile 527/540 | Zeile 795/… |
| D3 | Werkzeugzeile (Zuklappen / Gruppieren / Aktionen) | `toolsHtml` | `toolsHtml` |
| D4 | Menübefehle → Achse navigiert, Export läuft | `onMenuAction` | `onMenuAction` |
| D5 | Eine Stufe hinauf für die Detailzeile | `backTo(s)` | im Aufruf verstreut |
| D6 | Die Leinwand: Leiste, Marken, `pf-layout`, Fläche | im Aufbau | im Aufbau |

D1–D4 sind Zeile für Zeile dasselbe mit anderen Namen. Das ist die lohnende
Zusammenlegung; D5 und D6 unterscheiden sich genug, dass eine gemeinsame Form
mehr Fallunterscheidungen bekäme als sie spart.

---

## 3 — Was umgesetzt wurde

1. **B1** — `hashA` trägt Umfang und Achse; `wireCatalogue` bekommt sie.
2. **D1/D2** — `js/ui/landscape-state.js`: ein Faltgedächtnis je Kennung, mit
   `isOpen`, `setAll` und `toggle`. Beide Anwendungen benutzen es.
3. **B3** — die Prozessansicht bekommt ihre Werkzeugzeile.

Offen gelassen und hier begründet: **B2** (latent), **B4** (ein Umbau des
Betrachters, der mehr riskiert als er heute einbringt), **D5/D6** (die
Unterschiede sind echt).
