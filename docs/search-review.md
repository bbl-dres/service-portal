# Suche — Review und Umsetzung

**Stand:** 29. Juli 2026 · **Gegenstand:** `#/search` · **Status:** Empfehlungen 1–10 umgesetzt

Gemessen, nicht geschätzt: 43 realistische Anfragen wurden gegen die laufende Seite gefahren (CDP, `scratchpad/probe-search.mjs`), dazu ein Durchlauf auf Fehlerbilder. Die Anfragen stammen aus belegten Quellen — Formulartiteln des Exports, dem Dienstleistungsregister und den Begriffen, die der Auftraggeber selbst genannt hat.

**Ergebnis in einer Zahl: 13 von 43 Anfragen lieferten null Treffer, jetzt ist es eine** — und die eine ist ein echter Tippfehler (`störunng`), für den bewusst keine Rechtschreibkorrektur gebaut wurde.

## 1. Was durchsucht wird

| | vorher | nachher |
|---|---|---|
| Dienstleistungen | 37 | 37 |
| Anwendungen | 29 | 29 |
| **Wissen und Hilfsmittel** | **0** | **113** |
| Datensätze | 20 | 20 |
| Dokumente | 14 | 14 |
| News | 8 | 8 |
| **Liegenschaften** | **0** | **21** |
| **Bauprojekte** | **0** | **10** |
| **Index gesamt** | **108** | **269** |

Bewusst **nicht** indexiert: die eigenen Vorgänge. «Meine Vorgänge» ist eine persönliche Arbeitsliste mit eigener Filterung, kein Portalinhalt — und sie hätte Antragstellende und Organisationen in einen Ergebnisstrom gemischt, der sonst nur veröffentlichte Inhalte zeigt. Ebenfalls draussen: Mediathek und Kontakte; Kontaktnamen sind stattdessen als unsichtbares Suchvokabular an der jeweiligen Dienstleistung hinterlegt.

## 2. Wonach gesucht wird

Es gab **keinerlei Telemetrie** — keine Query-Protokollierung, keinen Zähler für Nulltreffer. Die Priorisierung stützte sich deshalb auf vier Stellvertreter:

1. Die Fusszeilen-Kurzwahl der echten Kundenplattform, nach Häufigkeit gewählt: E-Shop · Reklamationsmeldung · **Vorlagen** · Störungsmeldungen.
2. Die Dokumentenmasse im Export: von 91 Referenzdokumenten entfallen 40 auf Informatik und Beschaffung; die dicksten Seiten sind `werkzeugkasten` (16), `mustervorlagen-fuer-ikt-beschaffungen` (12), `arbeitsvorbereitung-avor` (12).
3. Die `popular`-Ränge in `services.json`.
4. Die Aussage des Auftraggebers: «I'm always looking Beschaffen und Informatik — in Informatik, die Mustervorlagen sind super important.»

Drei der vier zeigten auf **Vorlagen und Hilfsmittel** — und genau dort war die Suche blind. `mustervorlage`, `werkzeugkasten`, `open source`, `agb`, `preisliste`: je null Treffer, obwohl alle fünf im Bestand stehen. **Der meistverlinkte Inhaltstyp der Altplattform war der einzige, den die Suche nicht sah.**

Damit die nächste Runde nicht wieder raten muss, protokolliert [`js/search-log.js`](../js/search-log.js) jetzt Suchbegriff und Trefferzahl — nur im `localStorage` des eigenen Geräts, ohne Kennung, ohne Übertragung. Auswertung unter **`#/search?log=1`**, Nulltreffer zuerst. Das ist ein Notizblock, kein Tracking; nach zwei Wochen Pilotbetrieb beantwortet er die Frage oben mit Daten statt mit Stellvertretern.

## 3. Befunde und was daraus wurde

| | Befund | Behoben durch |
|---|---|---|
| B1 | Wissensbestand nicht im Index — 113 Einträge, 0 % | [`js/knowledge-content.js`](../js/knowledge-content.js) als eigenes Modul mit `knowledgeIndex()` |
| B2 | `stoerung` → 0, `störung` → 2 | `fold()` faltet Umlaute auf beiden Seiten |
| B3 | `raum buchen` → 0 (ganze Anfrage als eine Zeichenkette gesucht) | `tokenize()` + UND über alle Begriffe |
| B4 | Keine Relevanz: `rank = Gruppenindex + Dateireihenfolge` | Gewichtete Bewertung, Titel vor Beschreibung |
| B5 | `bern` traf über «ü**bern**immt», `is` → 66 Treffer | Nur noch Wort-Treffer: exakt, Präfix, Kompositum-Kopf |
| B6 | Alle 14 Dokumenttreffer → ungefiltertes Archiv | `#/app/document-archive?q=<Titel>` |
| B7 | `störungen` fand einen Treffer weniger als `störung` | Leichtes Stemming (`stem()`) |
| B8 | Synonymliste mit 13 Einträgen, keiner für Vorlagen/Vergabe | ~60 Alltagsbegriffe + Fachvokabular aus den Daten (`extra`) |
| B9 | Tote Felder `more` und `icon` an jeder Trefferzeile | entfernt |
| B10 | Suchroute lädt am meisten Daten | gemessen: 236 KB roh, **43 KB brotli** über [`scripts/serve.mjs`](../scripts/serve.mjs) |
| B11 | Klassifizierung im Treffer nicht sichtbar | offen — bewusst, siehe unten |

## 4. Die zwei Entscheidungen, die Arbeit gekostet haben

**Deutsche Komposita.** Präfix-Matching allein reicht nicht: «buchen» findet «Buchung» nicht, und «Parkplatzbuchung» trägt den gesuchten Kopf am Ende. Die Lösung ist ein leichtes Stemming (nur Flexionsendungen, Rest ≥ 4 Zeichen) plus eine dritte Regel «Wort ENDET auf den Begriff». Weil beide Seiten gestemmt werden, muss die Regel nicht sprachlich korrekt sein, sondern nur konsistent. Die generische `includes()`-Regel ist dabei **ersatzlos entfallen** — sie war die Ursache von B5, und die Kompositum-Regel holt den nützlichen Teil zurück, ohne die Wortmitte zu öffnen.

**Umgangssprache richtig dosieren.** Der erste Versuch liess Synonyme immer mitsuchen: `wto` lieferte 87 Treffer, `beschaffungsrecht` ebenfalls — technisch Volltreffer, praktisch unbrauchbar. Der zweite Versuch machte sie zur harten Rückfallebene (nur wenn der Begriff nirgends vorkommt): dann verlor `heizung` die Störungsmeldung, sobald irgendein Datensatz das Wort wörtlich führte. Die Lösung ist eine Abstufung **je Zeile**: kommt der Begriff selbst darin vor, zählt er voll; sonst greift die Alltagsentsprechung mit 45 % der Punkte. `wto` steht jetzt bei 8, `heizung` bei 4 — mit der Störungsmeldung an erster Stelle.

## 5. Angleichung ans CD

Die Ergebnisseite wich in vier Punkten vom CD ab (`css/components/search.postcss`, `card.postcss`, `searchResults.vue`):

1. **`.search-result { max-width:70ch }`** kappte jede Zeile, während Trennlinie und Umgebung weiterliefen. Das CD legt `.search-results` ohne `container__center--*` direkt in den `.container` (searchResults.vue:45-46) — die Treffer nehmen die volle Containerbreite. Deckel entfernt; gemessen füllen Liste und Zeilen jetzt exakt die 667 px von `.search-results`.
2. **Linie oben statt unten.** Jede Zeile trug `border-top`, die letzte zusätzlich `border-bottom`. Die CD-Karte, die diese Zeilen trägt, hat **nur** `border-b` (card.postcss:106-112). Weil die Katalogleiste darüber selbst schon `border-bottom` hat, entstand unter ihr eine doppelte Linie.
3. **`mt-6` zwischen Leiste und Liste.** Im CD folgt die Liste ohne Abstand auf `.search-results__header`. `C.catalogueResults` setzt den Abstand jetzt nur noch, wenn es keine Katalogleiste über sich hat (`header:false` heisst genau das) — die Galerie behält ihren Abstand, die Liste schliesst bündig an.
4. **Nulltreffer-Block und Meta-Zeile.** `container--py` ergänzt, `mb-6 lg:mb-8 2xl:mb-10` auf Überschrift **und** Liste (vorher nur die h2, fester Wert), `.search-results .notification { my-16 }` statt `margin-top:2rem`, und der Trenner der Meta-Zeile wächst wie im CD von `px-2` auf `lg:px-3`.

**Offen und bewusst so:** `.search-results` trägt im CD `aria-live="polite"`; hier läuft die Ansage über die persistente Region `#live`, weil ein bei jedem Rendern neu erzeugter Knoten nicht feuert. Und das CD trennt Inhaltsarten über Reiter (Webseiten/Dokumente), hier ist es eine Facette — bei acht Inhaltsarten skaliert das besser.

## 6. Was offen bleibt

- **B11 Klassifizierung.** Das Archiv zeigt je Zeile ein Klassifizierungs-Badge, die Suche nicht; ein `VERTRAULICH`-Dokument steht ununterscheidbar neben 13 `INTERN`-Dokumenten. Im reinen Intranet-Kontext kein Leck, aber eine Inkonsistenz zwischen zwei Ansichten desselben Bestands.
- **Rechtschreibkorrektur.** `störunng` bleibt bei null. Eine Levenshtein-Nachsuche über 269 Einträge wäre machbar; sinnvoll wird sie erst, wenn das Suchprotokoll zeigt, wie oft Tippfehler wirklich vorkommen.
- **Katalogseiten.** `#/services`, `#/applications` und `#/data/catalog` filtern weiterhin mit einfachem `includes()` auf dem Rohtext. Sie haben damit alle Schwächen B2, B3, B5 und B7 — die Suchmaschine ist bewusst als eigenes Modul gebaut, damit sie dort ohne Umbau übernommen werden kann.
- **Kopfzeilen-Suchfeld.** Suchvorschläge laufen nur im grossen Feld der Startseite. Das Feld im Kopf klappt als Überlagerung auf; eine Vorschlagsliste darin ist der heikelste Fall für Tastatur und Screenreader und wurde deshalb ausgeklammert.

## 7. Prüfen

```
node scripts/test-search.mjs        # 31 Prüfungen, ohne Browser (reine Funktionen)
node scripts/serve.mjs 8848         # Server MIT Kompression — für ehrliche Messwerte
```

`scripts/test-search.mjs` prüft genau die Befunde aus §3 gegen einen kleinen, echten Indexausschnitt: Falten, Mehrwortanfragen, Rangfolge, Wortgrenzen, Flexion, Umgangssprache, Referenznummern und Randfälle. Die Suchlogik liegt dafür in [`js/search-engine.js`](../js/search-engine.js) — reine Funktionen, kein DOM; [`js/pages/search.js`](../js/pages/search.js) baut nur noch den Index und stellt ihn dar.
