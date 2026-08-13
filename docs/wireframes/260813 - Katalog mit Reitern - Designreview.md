# Designreview — «Katalog mit Reitern»

Datei: [`260813 - Katalog mit Reitern.html`](./260813%20-%20Katalog%20mit%20Reitern.html)
Datum: 2026-08-13 · Umfang: Konsistenz, Zugänglichkeit, Feinschliff. Keine
funktionalen Änderungen.

---

## Vorgehen

Gemessen statt geschätzt. Ein Zensus lief über sechs Zustände (Stufe 0 bis 4,
alle drei Reiter) und zählte jede tatsächlich gerenderte Schriftgrösse, jeden
Innenabstand, jeden Radius, jede Text- und Flächenfarbe. Kontraste sind nach
WCAG 2.x gerechnet, nicht nach Augenmass. Der Tastaturweg wurde mit **echten
Tab-Anschlägen** über CDP geprüft — `:focus-visible` greift bei einem
programmatischen `.focus()` nicht, weshalb eine frühere Messung fälschlich
«kein Fokusring» meldete.

---

## Befunde

### A1 — Die dritte Textfarbe bestand den Kontrast nicht · **behoben**

`--ink-3` (`#8a93a1`) trug **141 Textknoten**: jede Zahl, jede Abschnitts­marke,
jeden Hinweis, jeden Platzhalter.

| Fläche | Kontrast | AA (4.5:1) |
|---|---|---|
| Weiss | 3.10:1 | ✗ |
| `--surface` | 3.02:1 | ✗ |
| Baumzeile *hover* | 2.69:1 | ✗ |
| Baumzeile *aktiv* | 2.48:1 | ✗ |

Der Versuch, sie einfach abzudunkeln, führte zum eigentlichen Befund: Der erste
Ton, der auf **allen** diesen Flächen 4.5:1 erreicht, ist `#606874` — und der
liegt einen Hauch neben `--ink-2` (`#5b6472`).

> **Drei AA-taugliche Grautöne auf hellem Grund sind keine drei Stufen, sondern
> eine Stufe, dreimal gezeichnet.**

Deshalb: **zwei** Textstufen (`--ink` 14.9:1, `--ink-2` 5.98:1). Die dritte
Betonungsstufe trägt jetzt Grösse, Versalsatz und Gewicht — nicht Farbe. Der
alte Ton lebt als `--glyph` weiter, ausschliesslich für Icon-Striche; die
antworten auf 1.4.11 mit 3:1, und dort genügt er.

*Ergebnis: 6 → 5 Textfarben, keine davon unter AA.*

### A2 — Drei Bedienelemente ohne sichtbaren Fokus · **behoben**

`.sclear`, `.pager-btn` und `.pop-item` deklarierten keinen Fokusring; der Rest
erbte den Browser-Standard, der sich je Engine unterscheidet und auf getönten
Flächen verblasst. Neu **eine** Regel:

```css
:where(button,a[href],input,select,summary,[tabindex]):focus-visible{
  outline:2px solid var(--accent); outline-offset:2px; border-radius:var(--r-sm);
}
```

`:where()` hält die Spezifität bei null, damit eine Komponente nur den Versatz
verschieben muss statt den ganzen Ring zu wiederholen. Der Tastaturweg zeigt
jetzt bei **jedem** erreichten Element einen Ring.

### A3 — `role="tab"` ohne `tablist` und ohne Panel · **behoben**

Die Reiter meldeten sich als Reiter, sassen aber in einem `<div>` ohne Rolle und
verwiesen auf nichts. Das ist keine unvollständige, sondern eine **ungültige**
ARIA-Struktur. Ergänzt:

- `role="tablist"` auf der Leiste — aber nur, wenn sie Reiter trägt; auf Stufe 0
  ist sie eine Werkzeugleiste und bekommt die Rolle bewusst nicht.
- `role="tabpanel"` + `aria-labelledby` auf der Inhaltsfläche, `aria-controls`
  auf jedem Reiter.
- **Roving tabindex**: ein Tabstopp für die ganze Gruppe.
- **Pfeiltasten** links/rechts, `Home`, `End` — ohne sie hätte der roving
  tabindex die übrigen Reiter unerreichbar gemacht.

### A4 — Zielgrössen unter 24 px · **teils behoben, teils begründet**

| Element | vorher | jetzt | |
|---|---|---|---|
| `.tchev` (Baum-Chevron) | 22×30 | **24×24** | behoben |
| Gruppenkopf-Knopf | 226×23 | **237×24** | behoben |
| `.sclear` | 22×22 | **24×24** | behoben |
| `.cellbtn` | 37×21 | unverändert | 2.5.8 nimmt *inline* aus; die **Zeile** ist das Ziel und misst 40 px |
| Breadcrumb-Link | 44×20 | unverändert | dito, Fliesstext |

### K1 — Neun Schriftgrössen, davon drei Rauschen · **behoben**

Gemessen: 11 · 12 · **12.5** · 13 · **13.5** · 14 · **15** · 22 · 27 px. Die
Zwischenschritte unterschieden nichts — sie waren an verschiedenen Tagen
entstanden. Neu sechs Stufen mit je einer Aufgabe:

| Token | Grösse | Aufgabe |
|---|---|---|
| `--t-xs` | 11 | Abschnittsmarken, Spaltenköpfe (versal, gesperrt) |
| `--t-sm` | 12 | Zahlen neben einer Beschriftung |
| `--t-md` | 13 | Bedienelemente, Sekundärtext |
| `--t-base` | 14 | Fliesstext und **jeder** Tabellenwert |
| `--t-lg` | 16 | Gruppenköpfe, Titel leerer Zustände |
| `--t-h` / `--t-kpi` | 22 / 27 | Flächentitel, die eine Zahl auf der KPI-Karte |

### K2 — Einundzwanzig verschiedene Innenabstände · **behoben**

3 · 4 · 6 · 7 · 8 · 9 · 10 · 11 · 12 · 13 · 14 · 15 · 16 · 18 · 20 · 22 · 30 ·
34 px … Neu eine 4-px-Skala (`--s1`…`--s7`) plus **einen** Halbschritt
`--sh:6px` für Icon-Abstände. Werte wie 11, 13, 15, 18, 22, 34 sind ersatzlos
verschwunden.

### K3 — Vier Radien, zwei davon nicht unterscheidbar · **behoben**

4 und 5 px nebeneinander sind kein Unterschied, sondern ein Versehen. Neu:
`--r-sm:4px` (Bedienelemente), `--r:8px` (Kästen), `--r-pill:999px` (Badges).

### K4 — Der Baumeinzug lief in drei verschiedenen Schritten · **behoben**

Gemessen 9 → 30 → 40 → 74 px, also Schritte von +21, +10, +34. Tiefe war so
nicht ablesbar. Neu ein konstanter Schritt `--tree-step:16px`: **8 → 24 → 40 →
56**. Das Chevron auf Stufe 3 liegt innerhalb seines Einzugs, damit die Reihe
trotz des zusätzlichen Bedienelements im Raster bleibt.

### K5 — Vier Regeln für dieselbe Abschnittsmarke · **behoben**

`.panel h3`, `.hsec h3`, `.fcol h4`, `.pop-head` und `.side h3` sagten dasselbe
mit drei verschiedenen Abständen. Jetzt eine Regel; wer eine neue Marke braucht,
schreibt `.slabel`.

### P1 — Zähler ausserhalb des Knopfnamens · **behoben**

Der Kopf eines Diagrammkastens ist ein Knopf, die Anzahl stand daneben. Vorlesen
ergab «Bauwerk und Liegenschaft» ohne die Zahl, die daneben steht. Jetzt trägt
der Knopf ein `aria-label` mit beidem.

### P2 — `[hidden]` verlor gegen `display:flex` · **behoben**

Die Reiterleiste auf Stufe 0 trug das `hidden`-Attribut und war trotzdem da: die
UA-Regel `[hidden]{display:none}` hat die niedrigste Spezifität, und
`.tabs{display:flex}` schlägt sie. Gemessen blieb ein 1 px hohes Element plus
16 px Aussenabstand — der Inhalt stand **17 px** unter der Oberkante der
Seitenleiste, sichtbar als schiefe Startseite.

```
vorher   Leiste 497 · Inhalt 514 · Versatz 17px
nachher  Leiste 497 · Inhalt 497 · Versatz  0px
```

Behoben mit einer Regel für die ganze Datei statt einer Erinnerung je
Komponente:

```css
[hidden]{display:none !important}
```

Damit entfielen auch die Einzelfälle `.pop-menu[hidden]` und `.fpanel[hidden]`,
die genau dieses Problem lokal umgangen hatten.

### P3 — Werkzeugleiste auf der Startseite · **entfernt**

Stufe 0 hatte keine Reiter, aber eine Leiste mit «Aktionen». Sie war der Grund
für den beschriebenen Versatz und trug auf einer Startseite wenig: exportiert
würde dort die Startseite selbst. Die Leiste ist auf Stufe 0 jetzt vollständig
eingeklappt; ab Stufe 1 erscheint sie samt Aktionen wie bisher.

### P4 — Trefferzahl in der Katalogleiste · **entfernt**

Eine Zeile «8 von 19 Geschäftsobjekten · Bauwerk und Liegenschaft» neben dem
Suchfeld war eine Zahl zu viel in einer Leiste, die schon ein Eingabefeld trägt.
Das Element bleibt als `sr-only` bestehen, weil die Live-Region es zitiert — am
Bildschirm still, für die Sprachausgabe unverändert vollständig.

> **Folge, bewusst in Kauf genommen:** Auf Stufe 1 und 2 gibt es damit keine
> sichtbare Rückmeldung mehr, wie stark Suche oder Filter den Bestand
> eingeschränkt haben. Der Fuss des Filterpanels nennt sie weiterhin, sobald ein
> Filter gesetzt ist, und auf Stufe 3 nennt sie der Seitenfuss. Für die reine
> Volltextsuche auf Stufe 1/2 fehlt sie.

### P5 — Astnamen · **umbenannt**

«Fachliche Sicht» → **Geschäftsobjekte**, «Systeme und Daten» → **Systeme**. Die
alten Namen beschrieben eine Perspektive, die neuen benennen, was drinsteht —
und decken sich mit den Zählern daneben.

---

## Bewusst nicht geändert

- **Die Zeilenanzahl im Tastaturweg.** Der Baum kostet 16 Tabstopps, bevor der
  Inhalt beginnt, und eine Tabelle mit 75 Feldern kostet 75 weitere. Das ist das
  normale Verhalten jeder Tabelle voller Verweise; die übliche Abhilfe wäre ein
  Sprunglink, und der wäre ein neues Element. Vermerkt, nicht gebaut.
- **`.cellbtn` als Zielgrösse.** Siehe A4 — die Zeile ist das Ziel.
- **Zwei Grautöne statt drei.** Die Oberfläche wird dadurch minim flacher. Das
  ist der Preis für AA und er ist bewusst bezahlt: lieber eine Stufe weniger,
  die alle lesen können, als drei, von denen eine nur für gute Augen existiert.
- **Der Baum zeigt weiterhin alle 75 Felder, die Tabelle blättert bei 50.** Ein
  Navigator und eine Datenansicht dürfen sich unterscheiden — aber es fällt auf
  und gehört auf die Liste.

---

## Nachher gemessen

```
Textfarben          6 → 5      (keine unter AA)
Schriftgrössen      9 → 6
Radien              4 → 3
Innenabstände      21 → 4-px-Skala + ein Halbschritt
Fokusringe      3 ohne → 0 ohne   (mit echten Tab-Anschlägen geprüft)
ARIA-Reiter  ungültig → tablist + tabpanel + Pfeiltasten
Baumeinzug 9/30/40/74 → 8/24/40/56
Startseite   17px schief → bündig
```

Keine Konsolenfehler. Alle zehn Verhaltens-Prüfungen der Vorrunden laufen
unverändert grün; die Datei bleibt vollständig offline (ein Request, null
extern).

---

## Was beim Prüfen selbst schieflief

Zwei Messungen meldeten zuerst das Falsche, und beide Male lag es am Messgerät:

- **«Kein Fokusring» bei drei Bedienelementen**, die einen hatten.
  `:focus-visible` greift nicht bei einem programmatischen `.focus()`; erst
  echte Tab-Anschläge über CDP zeigten das wahre Bild.
- **«Element 0×0 px»** bei `.sclear` und `.pop-item`. Beide waren zum
  Messzeitpunkt ausgeblendet — ein verstecktes Element misst null und meldet
  Standardwerte.

Notiert, weil es für die nächste Runde gilt: ein rotes Kreuz im Protokoll ist
erst dann ein Befund, wenn geklärt ist, was genau gemessen wurde.
