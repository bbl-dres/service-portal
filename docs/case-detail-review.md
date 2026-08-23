# Vorgangsdetail — Review und Redesign-Optionen (August 2026)

**Gegenstand:** `#/my-cases/:id`, gerendert von `js/pages/my-cases.js` (`detail()`)
über die Bausteine in `js/ui/case-view.js`, das CSS in `css/components/content.css`
(Abschnitt `CASE VIEW`) und `.detail-layout` in `css/utilities.css`.

**Vorgänger:** `docs/case-view-alignment.md` (Kanon V1–V14 / L1–L6, umgesetzt).
Dieses Dokument prüft **nicht**, ob der Kanon eingehalten ist — er ist es —,
sondern ob die Seite die Frage beantwortet, für die man sie öffnet.

**Referenzfall:** `#/my-cases/seed-6` (Raumbuchung BBL-2026-1099, abgeschlossen,
zwei Schritte, keine Anhänge). Gegengeprüft an `seed-1` (Raumbedarf-Antrag,
offen, sechs Schritte, zwei Anhänge, drei Ereignisse) und `seed-5`.

---

## 1. Methode — gemessen, nicht geschätzt

Headless Edge über CDP (`scripts/lib/cdp.mjs`), angemeldete Demo-Sitzung,
`deviceScaleFactor: 1`. Vollseiten-Aufnahmen und ausgelesene Layout-Boxen bei
**1440 / 1024 / 768 / 375 px**, je Fall über alle vier Reiter, dazu eine
Aufnahme unter `Emulation.setEmulatedMedia: { media: 'print' }`. Die Zahlen
unten stammen aus diesen Messungen, nicht aus dem Quelltext.

### 1.1 Die Anatomie heute

```text
  detailBar        ← Zurück                                  Drucken · Teilen
  case-header      meta-info: Prozess | Referenz | Objekt | Organisation | Eingereicht
                   h1: Titel                                      [Statusbadge]
  pipeline         ▓▓ Angefragt ▓▓▶ ░░ Bestätigt ░░          (volle Breite, 44 px)
  tabs             Übersicht · Anhänge (n) · Verlauf · Kommentare (n)
  ├ Übersicht      ┌─ 929 px Lesespalte ───────────┐  ┌─ 352 px Schiene ─┐
  │                │ Vorgangsdaten   (5 Zeilen)    │  │ Aktionen         │
  │                │ Standort        (7 Zeilen)    │  │ Antragsteller    │
  │                │ Angaben         (7 Zeilen)    │  │ Verknüpfungen    │
  │                └───────────────────────────────┘  └──────────────────┘
  ├ Anhänge        mountDataTable        (volle Breite)
  ├ Verlauf        ol.history-timeline   (volle Breite)
  └ Kommentare     ul.case-comments + Formular
```

### 1.2 Die Messwerte

| Grösse (`seed-6`) | 1440 px | 1024 px | 375 px |
| --- | ---: | ---: | ---: |
| Seitenhöhe | 2231 px | 2286 px | 3841 px |
| Lesespalte | 929 px | 537 px | 328 px |
| Schiene | 352 px | 352 px | 328 px (oben) |
| `kv`-Raster Label / Wert | 224 / 673 px | 224 / 281 px | gestapelt |
| Höhe Übersicht-Panel | 799 px | — | — |
| Höhe Schiene (3 Karten) | 559 px | 513 px | 467 px |
| **Wert endet im Median bei** | **37 %** | **61 %** | — |
| Zeilen mit Wertende vor 50 % | **17 von 19** | 1 von 19 | — |

Für `seed-1` bei 1440 px: 13 von 15 Zeilen enden vor 50 %, Median 38 %.

---

## 2. Befunde

Notation **B1–B20**. «Beleg» nennt die Messung oder die Codestelle.

### A · Korrektheit

| # | Befund | Beleg |
| --- | --- | --- |
| **B1** | **Ein abgeschlossener Vorgang zeigt seinen letzten Schritt als «Aktueller Schritt»** — blau, mit Uhr-Symbol, dazu die Vorlesefassung «Aktueller Schritt: Bestätigt». Betroffen sind **4 der 6 Seed-Vorgänge** (`seed-3`, `seed-4`, `seed-5`, `seed-6`). Ursache: der Zustand wird allein aus `stepIndex` abgeleitet (`i === currentIndex → active`) und nie `steps[i].status` gegen `instance.status` geprüft. Die Daten wüssten es: `seed-6.status === 'abgeschlossen'` **ist** `steps[1].status`. Das Badge sagt «Abgeschlossen», der Balken darunter sagt «läuft noch». | `js/ui/components/navigation.js:36-53`; über alle Instanzen in `data/process-instances.json` geprüft |
| **B2** | **Zwei Datumsformate in einem Panel.** `formatDate` greift auf `createdAt`/`updatedAt`, nie auf Datumswerte in `data`. `seed-6` zeigt «Eingereicht : 1.8.2026» und drei Abschnitte tiefer «Datum : 2026-08-07»; `seed-1` «18.5.2026» und «Wunschtermin : 2026-09-01». Beim Buchungsfall trifft es ausgerechnet die wichtigste Angabe des Vorgangs. | `sectionsFromData` reicht Rohwerte an `caseRow` |
| **B3** | **Listenwerte laufen durch `String()`:** «Eingeladene : Anna Keller,Marco Rossi» — ohne Leerzeichen, ohne «und», ohne Umbruch. | `caseRow` → `escape(String(value))`; `seed-6.data.eingeladene` |
| **B4** | **Die einzige zustandsabhängige Aktion kann das falsche Formular öffnen.** `serviceForProcess` sucht mit `.find()` über `services.processDefId` — ein Schlüssel, der **nicht eindeutig** ist: `stoerung-melden`, `umzug-anmelden` und `reklamation` zeigen alle auf `stoerung`; `eshop-bestellen` und `publikation-bestellen` beide auf `bestellung`. Eine Reklamation in Rückfrage schickt damit auf «Störung melden». Die Instanz merkt sich nicht, welche Dienstleistung sie gestartet hat. | `js/pages/my-cases.js:serviceForProcess`; `data/services.json` — 14 von 37 Diensten mit `processDefId`, 5 davon mehrdeutig |
| **B5** | **«Vorgang drucken» druckt keinen Vorgang.** Unter `media: print` sind 3 der 4 Panels `display:none` — Anhänge, Verlauf und Kommentare fehlen im Ausdruck vollständig (bei `seed-1`: zwei Anhänge, drei Ereignisse). Gedruckt werden dafür die Reiterleiste, die Aktionskarte samt zwei gesperrten Zeilen «Im Prototyp nicht verfügbar» und die Zeile «Vorgang drucken →». Wegen `order:-1` steht die Schiene zudem **vor** dem Datensatz. Der Knopf ruft rohes `window.print()` statt `createPrintMode`. | Gemessen; `css/utilities.css:270` kennt eine Druckausnahme für `.accordion__drawer[hidden]`, aber keine für Reiter-Panels |

### B · Redundanz

| # | Befund | Beleg |
| --- | --- | --- |
| **B6** | **Der erste Abschnitt der Lesespalte ist zu vier Fünfteln eine Wiederholung des Kopfs.** «Vorgangsdaten» führt Referenz, Prozess, Status und Eingereicht — alle vier stehen 200 px darüber in der `meta-info`-Zeile. Neu ist einzig «Letzte Änderung», und bei `seed-6` ist auch die identisch mit «Eingereicht». Der Abschnitt, der laut Kanon führt, *weil* er für jeden Prozess gilt, ist damit der einzige, der nichts Neues sagt. | Gemessen |
| **B7** | **Derselbe Sachverhalt bis zu dreimal.** Status: Badge, Pipeline, `Vorgangsdaten → Status`. Objekt bei `seed-6`: `h1`, `meta-info`, `Standort → Objekt`. Der Raum: `h1` («EG 06 — …») und `Standort → Raum`. | Gemessen |
| **B8** | **Pipeline und Verlauf sind dieselbe Zustandsmaschine zweimal**, die eine über, die andere hinter einem Reiter. Bei `seed-1` nennt der Balken «Eingereicht ✓ · In Prüfung (GS) ✓ · In Prüfung (PFM) ●», die Zeitachse dieselben drei Schritte mit Datum. Der Balken kennt die Zukunft, aber keine Daten; die Zeitachse kennt die Daten, aber keine Zukunft. Keine der beiden beantwortet allein «wo steht der Vorgang und seit wann». | Gemessen, Reiter «Verlauf» bei `seed-1` |

### C · Was fehlt

| # | Befund | Beleg |
| --- | --- | --- |
| **B9** | **Die Zuständigkeit liegt in den Daten und wird nicht gezeigt.** Jeder Schritt trägt `role` und `kind`: «In Prüfung (PFM) / Portfoliomanagement BBL / user», «Bestätigt / Workspace BBL / auto». Gerendert wird nur `st.label`. Bei einem offenen Vorgang weiss das Modell, **wer** ihn gerade hält — die Seite sagt es nicht. | `data/processes.json`; `pipeline()` liest nur `st.label`/`st.state` |
| **B10** | **Keine Antwort auf «und jetzt?»** Weder nächster Schritt noch Frist noch Liegedauer. `seed-1` steht seit dem 3.6.2026 in PFM-Prüfung; die Seite nennt das Datum als Zeile 5 von 5 im redundantesten Abschnitt und rechnet nichts daraus. | Gemessen |
| **B11** | **Keine prozesseigene Aktion.** `seed-6` ist eine Raumbuchung, und `calendarFile(instance)` — ein fertiger RFC-5545-Export für genau diese Instanz — existiert bereits. Im Vorgangsdetail sind die angebotenen Aktionen «Kommentar hinzufügen» und «Vorgang drucken». Ebenso wenig verlinkt: die Prozessbeschreibung (`def.description`), das BPMN-Diagramm (`def.bpmn` → `#/app/process-docs`) und die auslösende Dienstleistung. | `js/apps/room-booking/calendar.js:48`; `js/apps/room-booking.js:755,785,926`; `caseActions` |
| **B12** | **Der Vorgang lässt sich nicht merken.** `KIND_META` kennt `service`, `application`, `dataset`, `news`, `building`, `project`, `tenancy`, `process`, `room` — aber keine Vorgänge. Die einzige Seite über die *eigene* Arbeit ist die einzige ohne «merken»-Stern; das Favoritenband steht ausgerechnet unter der Vorgangsliste. | `js/ui/bookmark-kinds.js`; `detail()` rendert keinen Stern |

### D · Fläche und Rhythmus

| # | Befund | Beleg |
| --- | --- | --- |
| **B13** | **Bei 1440 px enden 17 von 19 Werten vor der Hälfte der Lesespalte** (Median 37 %, also rund 585 px leer neben jeder Zeile) — und zwar *neben* der Schiene, die 240 px vor dem Ende der Lesespalte ausgeht. Das ist exakt die Diagnose aus `case-view-alignment.md § 2` («die Werte enden bei ~35 %, die rechten zwei Drittel sind leer»); sie ist von der Seitenebene in die Lesespalte gewandert. Die Schiene hat das rechte Drittel gefüllt, nicht das Problem gelöst. | Gemessen |
| **B14** | **Bei 1024 px kippt es ins Gegenteil.** Die Labelspalte bleibt bei fixen 224 px, die Wertspalte fällt auf 281 px: «Verwaltungsgebäude Liebefeld (BAG / BLV)» und «Schwarzenburgstrasse 157, 3097 Liebefeld» brechen um, während die Schiene 300 px über dem Spaltenende endet und rechts unten ein totes Viertel von rund 500 × 300 px stehen lässt. Dieselbe Seite ist bei 1440 px zu breit und bei 1024 px zu eng für denselben Inhalt. | Gemessen; `content.css:376` `--kv-label-col:14rem` |
| **B15** | **2231 px Seitenhöhe für 19 Fakten** (1440 px), 3841 px auf dem Telefon. Der eigentliche Inhalt des Übersicht-Panels misst davon 799 px. | Gemessen |
| **B16** | **Auf dem Telefon stehen drei Aktionskarten (rund 470 px) vor dem Datensatz.** Die Begründung im Code — «ein Vorgang ist etwas, das man TUT» — trägt für einen offenen Vorgang mit «Auflagen erfüllen»; bei `seed-6` sind es «Kommentar hinzufügen» und «Vorgang drucken» vor Datum, Raum und Zeit. Zudem ist bei 375 px der vierte Reiter abgeschnitten (Leiste: 450 px Inhalt in 343 px Fenster). Die Leiste scrollt waagerecht, ohne sichtbares Zeichen dafür und ohne als `data-scroll-region` registriert zu sein — Tastaturbedienung trägt der `role="tablist"` mit rollendem `tabindex`, Zeige- und Tippbedienung nichts. | Gemessen; `content.css:394` |

### E · Tote Verträge im Code

| # | Befund | Beleg |
| --- | --- | --- |
| **B17** | **`wide` gibt es nicht.** Der Deskriptor in `case-view.js:10` und der Kanon (`case-view-alignment.md § 2.1`, V5) versprechen `{ title, rows, wide? }` mit `.case-section--wide { grid-column: 1 / -1 }`. Die Klasse steht in keinem Stylesheet, `caseOverview` liest das Feld nicht, kein Aufrufer setzt es. Der dokumentierte Ausweg für Fliesstext (Begründung, Auflagenliste) ist eine Attrappe. | `grep` über `js/` und `css/` |
| **B18** | **`iconName` wird durch drei Funktionen gereicht und nie gesetzt.** `caseSection` nimmt es, `mergeSections` erbt es, `caseOverview` rendert es — kein Aufrufer übergibt es. | `js/ui/case-view.js:43,79,97` |

### F · Sprache und Semantik

| # | Befund | Beleg |
| --- | --- | --- |
| **B19** | **«Angaben» ist keine Überschrift, sondern ein Platzhalter.** Bei `seed-6` steht darunter der eigentliche Gegenstand des Vorgangs: Datum, Von, Bis, Zeit, Teilnehmende, Zweck, Eingeladene. Der Rest-Eimer aus `sectionsFromData` ist als *Rückfallebene* richtig — ein neues Feld darf nie verschwinden. Als Ruhezustand für einen Prozess, den das Portal ausliefert, ist er es nicht. | `sectionsFromData({ restTitle: 'Angaben' })` |
| **B20** | **Interne Schlüssel stehen gleichwertig neben fachlichen Angaben.** «Raum-ID : 1080-6650-AA-eg-06», «EGID : 191458950», «Wirtschaftseinheit (WE) : 6650» tragen dieselbe Typografie und dasselbe Gewicht wie «Zweck : Bereichssitzung». Für die buchende Person sind das keine Fakten, sondern Fremdkörper. | Gemessen |

---

## 3. Die Diagnose in einem Satz

> Die Seite ist ein **korrekt gebautes Karteiblatt** für einen Datensatz —
> gefragt wird sie aber als **Statusauskunft zu einem laufenden Verfahren**.

Alles Weitere folgt daraus. Wer `#/my-cases/seed-6` öffnet, will wissen: *Wo
steht mein Vorgang, wer hat ihn, was passiert als Nächstes, was kann ich tun?*
Die Seite antwortet mit einer neutralen Feldliste, deren erster Abschnitt den
Kopf wiederholt (B6), deren Zustandsanzeige bei abgeschlossenen Vorgängen
falsch ist (B1), deren Verlauf hinter einem Reiter liegt (B8), deren
Zuständigkeit im Datensatz bleibt (B9) und deren Aktionsschiene für den
häufigsten Fall nichts anzubieten hat (B11).

Der Kanon `case-view-alignment.md` hat das **Layout** vom Prozess entkoppelt —
ein richtiger und tragender Entscheid, der bleibt. Er hat dabei aber die
**Rangfolge** mitentkoppelt: Wenn jeder Prozess dieselben drei Abschnitte in
derselben Reihenfolge bekommt, kann keine Seite mehr sagen, was an *diesem*
Vorgang das Wichtige ist. Bei einer Raumbuchung ist das der Termin. Er steht an
vorletzter Stelle, im falschen Datumsformat, unter der Überschrift «Angaben».

---

## 4. Vier Optionen

### Option 1 — Minimalkorrektur (das Karteiblatt bleibt)

B1–B5 beheben, B6/B7 durch Streichen auflösen, B17/B18 entfernen.

- «Vorgangsdaten» entfällt als Abschnitt; «Letzte Änderung» wandert in die
  `meta-info`-Zeile.
- Ein `formatValue` in `sectionsFromData`: ISO-Daten über `formatDate`, Arrays
  über `Intl.ListFormat('de-CH')`, Zeitpaare als eine Spanne.
- Pipeline-Zustand aus `steps[i].status` gegen `instance.status`.
- Druck: alle Panels sichtbar, Reiterleiste und Schiene aus.

**Kosten:** klein. **Wirkung:** Die Seite hört auf, falsch zu sein. Die
Statusfrage beantwortet sie weiterhin nicht.

### Option 2 — Antwortkopf («Wo steht der Vorgang»)

Option 1, plus: Der oben gewonnene Platz trägt einen **Statusblock** statt einer
Feldliste — aktueller Schritt, Zuständigkeit (B9), seit wann, nächster Schritt,
und bei offenen Vorgängen die eine Handlung, die ansteht. Darunter bleibt die
bekannte Anatomie unverändert.

```text
  meta-info · h1 · Badge
  ┌──────────────────────────────────────────────┬────────────────────┐
  │  In Prüfung (PFM) · seit 12 Tagen            │  [Auflagen         │
  │  Bei: Portfoliomanagement BBL                │   erfüllen]        │
  │  Als Nächstes: Genehmigung durch PFM         │  Kalender · Drucken│
  └──────────────────────────────────────────────┴────────────────────┘
  Pipeline (korrigiert, mit Rolle je Schritt)
  Reiter …
```

**Kosten:** mittel. **Wirkung:** Die Frage, für die man die Seite öffnet, wird
über der Falz beantwortet. Die Doppelung Pipeline / Verlauf (B8) bleibt.

### Option 3 — Eine Seite ohne Reiter

Option 2, plus: Die vier Reiter entfallen. Pipeline und Verlauf verschmelzen zu
**einem senkrechten Prozess-Rückgrat** mit Datum, Rolle und Notiz je erledigtem
Schritt und ausgegrauten künftigen Schritten. Anhänge und Kommentare werden
Abschnitte statt Reiter.

```text
  ┌─ Rückgrat (Prozess) ─────────┬─ Datensatz + Aktionen ─────────────┐
  │ ● 18.5.  Eingereicht         │  Termin   7.8.2026, 09:00–12:00    │
  │          Antragstellende St. │  Raum     EG 06, Erdgeschoss       │
  │ ● 22.5.  In Prüfung (GS)     │  Objekt   Verwaltungsgeb. Liebefeld│
  │          Generalsekretariat  │  Zweck    Bereichssitzung          │
  │ ◉  3.6.  In Prüfung (PFM)    │  …                                 │
  │          Portfoliomanagement │  ──────────────────────────────────│
  │ ○        Genehmigt           │  Anhänge (2)                       │
  │ ○        In Projekt überführt│  Kommentare (0)                    │
  └──────────────────────────────┴────────────────────────────────────┘
```

Damit sind B8, B13, B14 und B16 strukturell erledigt: Die leere rechte Hälfte
der Lesespalte bekommt einen Bewohner, der Verlauf verliert seinen Reiter, der
Druck wird trivial (es gibt nur eine Ansicht), und auf dem Telefon stapeln sich
zwei sinnvolle Blöcke statt vier Karten vor dem Inhalt.

**Kosten:** gross — betrifft `case-view.js`, das CSS sowie `test-content.mjs`,
`test-pipeline.mjs` und `test-tabs.mjs`. **Risiko:** bricht Kanon V3 («vier
Reiter in beiden Portalen») und damit die Angleichung mit dem Mieterportal; der
Entscheid müsste dort mitgetragen werden.

### Option 4 — Verlaufszentriert

Die Zeitachse *ist* die Seite; der Datensatz wird ein einklappbares Panel. Passt
für lange, mehrstufige Verfahren (Raumbedarf, Delegationsgesuch, Planfreigabe),
ergibt aber für die zweistufige Raumbuchung eine Zeitachse mit zwei Punkten über
einer versteckten Buchung. **Verworfen** — sie tauscht ein Missverhältnis gegen
das andere.

---

## 5. Empfehlung

**Option 1 sofort, Option 2 als Ziel dieser Welle, Option 3 als Studie.**

1. **B1–B5 sind Fehler, keine Gestaltungsfragen.** B1 (abgeschlossene Vorgänge
   zeigen sich als laufend) und B5 (der Druckknopf druckt den Vorgang nicht)
   widersprechen dem, was die Seite behauptet, und betreffen 4 von 6
   Demofällen. Sie gehören unabhängig von jedem Redesign behoben.
2. **B6/B7 sind kostenlos.** Die Redundanz zu streichen gewinnt genau den Platz,
   den Option 2 braucht — ohne eine einzige neue Komponente.
3. **Option 2 ist die kleinste Änderung, die die Diagnose adressiert**, und sie
   bleibt vollständig innerhalb des Kanons: `.meta-info`, `.notification`,
   Pipeline und `.detail-layout` sind vorhanden; der Statusblock ist ein
   Deskriptor mehr — genau die Erweiterungsart, für die `case-view.js` gebaut
   wurde.
4. **Option 3 ist der interessantere Entwurf und der teurere.** Sie berührt die
   Cross-Portal-Angleichung und sollte deshalb erst als Studie gegen Option 2
   antreten, nicht als Umbau.

Ausserhalb dieser Reihenfolge, weil unabhängig und klein: **B12** (Vorgänge
merkbar machen — eine `KIND_META`-Zeile plus ein Stern im Kopf) und **B11**
(der `.ics`-Export existiert bereits; ihn in `caseActions` zu hängen ist ein
Import plus eine Zeile).

---

## 6. Was die Designstudie zeigen muss

Für `docs/wireframes/`, Format wie `260820 - Answer Before Results.html`: eine
eigenständige HTML-Datei, kein Build, echte Daten aus `data/`, CD-Werte aus
`swiss/designsystem` statt aus dem Nachbau.

**Bühne:** `seed-6` (Raumbuchung, abgeschlossen, zwei Schritte, keine Anhänge)
**und** `seed-1` (Raumbedarf, offen, sechs Schritte, zwei Anhänge, drei
Ereignisse). Ein Entwurf, der nur den reichen Fall zeigt, versteckt genau das
Missverhältnis, um das es geht — und einer, der nur den armen Fall zeigt, lässt
jede Zeitachse gut aussehen.

**Die vier Varianten:** heutiger Stand · Option 1 · Option 2 · Option 3, in
derselben Breite nebeneinander, damit die gewonnene Höhe sichtbar wird.

**Die Prüffragen, die die Studie beantworten muss:**

1. Was steht bei 1440 px über der Falz — und was bei 375 px?
2. Wie sieht Option 3 aus, wenn der Prozess **zwei** Schritte hat?
3. Wo steht der Termin einer Raumbuchung, wo die Begründung eines Raumbedarfs
   (Fliesstext, den B17 heute nicht unterbringen kann)?
4. Wie sieht der Zustand «Rückfrage / Auflagen erfüllen» aus? Kein Seed führt
   ihn — er ist der einzige Zustand, in dem die Aktionsschiene etwas zu sagen
   hat, und er ist deshalb nie gestaltet worden.
5. Wie druckt sich jede Variante?

---

## 7. Prüfungen, die mitwandern

| Prüfung | Betrifft |
| --- | --- |
| `scripts/test-pipeline.mjs` | B1 — braucht einen Fall «abgeschlossener Vorgang, letzter Schritt ist `done`» |
| `scripts/test-content.mjs` | B5 — die Druckansicht enthält alle vier Panels |
| neu | B2/B3 — `sectionsFromData` formatiert ISO-Daten und Listen |
| neu | B4 — `serviceForProcess` bei mehrdeutigem `processDefId` |

---

## 8. Anhang — Reproduktion

```bash
node scripts/serve.mjs
# danach die Sonde aus § 1 gegen #/my-cases/seed-6 und #/my-cases/seed-1
```

Die Vollseiten-Aufnahmen bei 1440 / 1024 / 768 / 375 px sowie die Druckansicht
wurden für diesen Review erzeugt und liegen ausserhalb des Repositoriums;
`docs/review-assets/` ist seit dieser Welle nicht mehr versioniert
(`.gitignore`).
