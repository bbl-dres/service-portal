# Kostenschätzung Produktivführung (Stand 2026-08-12)

Schätzung aus Entwicklersicht: was es kostet, aus diesem Prototyp ein
betriebsfähiges Kundenportal zu machen und es vier Jahre zu betreiben.

**Das ist eine Schätzung, keine Offerte.** Solange der Scope nicht fixiert ist,
liegt die reale Streuung bei ±40 %. Die beiden grössten Unbekannten —
Prozessanzahl und Qualität der SAP-Schnittstellen — lassen sich vor der
Verpflichtung günstig klären.

---

## 1. Was der Prototyp wert ist

Der Wert liegt in der **Spezifikation, nicht im Code**. Belastbar sind:

| Vorhanden | Umfang |
|---|---|
| Informationsarchitektur und Dienstleistungskatalog | 37 Dienstleistungen |
| Prozessdefinitionen + BPMN-Diagramme | 9 Definitionen, 19 Diagramme |
| Datenstrukturen in der Form der Zielsysteme (SAP RE-FX, ePPM, CAFM) | 31 Dateien |
| CD-konforme CSS-Schicht, gegen die echte Designsystem-Quelle gemessen | 1 Abweichung auf ~60 Eigenschaften |
| Browsertests, die das gewollte Verhalten festhalten | ~40 Skripte |

Das ist Anforderungs-, Design- und UX-Risiko, das bereits abgetragen ist —
üblicherweise 15–25 % eines Projekts und der grösste Teil seines Nacharbeits­risikos.

Die JS-Applikationsschicht selbst wird gegen ein echtes Framework und Backend
weitgehend neu geschrieben. «Prototyp produktiv machen» heisst realistisch:
neu bauen, aber mit beantworteten Fragen.

---

## 2. Scope: was in ein Minimalprojekt gehört

Der Prototyp trägt **19 Micro-Apps**. Zwei davon sind eigenständige Produkte:

| Subsystem | Umfang im Prototyp | Einschätzung |
|---|---|---|
| `floorplan-editor` | 22 Dateien, 438 KB | 6–12 Monate Spezialistenarbeit |
| `plan-check` | 12 Dateien, 344 KB, inkl. WASM-DWG-Parser | 6–12 Monate Spezialistenarbeit |

**MVP-Vorschlag**

| Enthalten | Zurückgestellt |
|---|---|
| Portalrahmen, Navigation, Suche, Barrierefreiheit | `floorplan-editor` |
| eIAM-Anbindung und Berechtigungsmodell | `plan-check` |
| Dienstleistungskatalog und Detailseiten | Shop / E-Commerce |
| Vorgangsbearbeitung auf BPMN, «Meine Vorgänge» | Raumbuchung |
| 3–4 echte Prozesse | Mediathek, Metadatenkatalog |
| 2–3 lesende SAP-Sichten | Datenportal-Dashboards |
| Wissen und Unterlagen, Favoriten | Workspace-Planung |

---

## 3. Ansatzbasis — der dominierende Faktor

| Basis | CHF/h | CHF/Tag (8,4 h) |
|---|---|---|
| Angestellt, voll belastet (Lohn 130–150k + 20–25 % AG-Kosten) | 90–105 | 750–860 |
| Freelance Webentwicklung | 130–170 | 1'090–1'430 |
| Freelance SAP-Spezialist | 220–240 | 1'850–2'015 |
| Beratungshaus / Integrator | 180–290 | 1'500–2'400 |

Nach Abzug der Fixkosten (Abschnitt 5) bleiben aus **CHF 1.5 Mio.** rund
**CHF 1.275 Mio.** für Personal. Was das an Kapazität ergibt:

| Ansatz | CHF/Tag | Personentage für 4 Jahre |
|---|---|---|
| SAP-Freelance @ 230/h | 1'932 | **660** |
| Web-Freelance @ 150/h | 1'260 | **1'012** |
| Web-Freelance @ 130/h | 1'092 | **1'168** |
| Angestellt @ ~95/h | 798 | **1'597** |

**Benötigt werden rund 1'450 PT** (Aufbau + Betrieb). Zu SAP-Freelance-Ansätzen
reicht das Budget nicht einmal für den Aufbau. Der Ansatz ist damit der grösste
einzelne Hebel im ganzen Modell — der Wechsel von 230 auf 140 CHF/h entspricht
rund **40 % Kostenreduktion**, mehr als jeder Funktionsverzicht einbringt, den
das Produkt überlebt.

---

## 4. Aufbau: ~950 PT

| Position | PT |
|---|---|
| Inception, Architektur, Sicherheitskonzept, PI-Aufsatz | 60 |
| Plattform: Cloud, CI/CD, Umgebungen, Observability, Restore-Übungen | 80 |
| eIAM-Anbindung und Berechtigungsmodell | 50 |
| Portalrahmen: Navigation, Suche, Barrierefreiheit, CD-Komponenten | 120 |
| Dienstleistungskatalog, Detailseiten, Wissen und Unterlagen | 90 |
| BPMN-Engine, Aufgabenliste, «Meine Vorgänge» | 90 |
| 4 Prozesse à 20 PT | 80 |
| 3 SAP-REST-Integrationen à 30 PT | 90 |
| Inhaltsverwaltung (Admin-Oberflächen oder CMS) | 110 |
| Test, Härtung, Behebung aus Pentest und Barrierefreiheitsaudit | 100 |
| Go-live, Dokumentation, Übergabe, Schulung | 40 |
| Reserve ~5 % | 40 |
| **Total** | **950** |

---

## 5. Betrieb und Fixkosten

**Betrieb Jahre 2–4: ~550 PT (≈ 0,85 VZÄ)** — korrektive Wartung,
Abhängigkeits- und Sicherheitsaktualisierungen, Nachführen von
SAP-Vertragsänderungen, kleines Weiterentwicklungskontingent.
Unter ~0,8 VZÄ beginnt ein Bundessystem Sicherheitsschulden aufzubauen.

| Fixkosten (nicht Personal), 4 Jahre | CHF |
|---|---|
| Cloud: 3 Umgebungen, managed PostgreSQL, Monitoring, Backup | 130'000 |
| Pentest zum Go-live + 3 leichtere Nachtests | 50'000 |
| Barrierefreiheitsaudit + eine Nachprüfung | 20'000 |
| eIAM-Onboarding, Lizenzen, Werkzeuge | 25'000 |
| BPMN-Engine (Operaton / Flowable CE) | 0 |
| **Total** | **225'000** |

---

## 6. Gesamtkosten über 4 Jahre

| Szenario | Aufbau | Betrieb (3 J.) | Fix | **Total** |
|---|---|---|---|---|
| Angestelltes Kernteam (Abschnitt 7) | ~0.76 Mio. | ~0.50 Mio. | 0.23 Mio. | **≈ 1.47 Mio.** |
| Web-Freelance durchgehend @ 150/h | ~1.20 Mio. | ~0.69 Mio. | 0.23 Mio. | **≈ 2.12 Mio.** |
| Beratungshaus @ 1'400/Tag | ~1.33 Mio. | ~0.77 Mio. | 0.23 Mio. | **≈ 2.33 Mio.** |
| SAP-Freelance-Ansätze durchgehend | ~1.84 Mio. | ~1.06 Mio. | 0.23 Mio. | **≈ 3.13 Mio.** |

---

## 7. Eine Aufstellung, die in CHF 1.5 Mio. passt

| Position | Rechnung | CHF |
|---|---|---|
| 3 angestellte Entwickler, Aufbaujahr | 3 × 165'000 | 495'000 |
| 1 angestellter Entwickler, Jahre 2–4 | 3 × 165'000 | 495'000 |
| Freelance Lead/Architektur, teilzeitlich im Aufbau | 60 PT × 1'430 | 86'000 |
| SAP-Integrationsspezialist, auf Tage gedeckelt | 60 PT × 1'932 | 116'000 |
| UX/CD, vorgezogen | 40 PT × 1'260 | 50'000 |
| Fixkosten | Abschnitt 5 | 225'000 |
| | | **1'467'000** |

**Kapazität:** ~805 PT Aufbau, ~645 PT Betrieb.

Der Aufbau liegt damit rund 15 % unter den 950 PT aus Abschnitt 4. Entweder
**3 statt 4 Prozesse und 2 statt 3 Integrationen**, oder die Aufbauphase auf
14 Monate strecken.

---

## 8. Haupttreiber, nach Wirkung geordnet

| # | Treiber | Grössenordnung |
|---|---|---|
| 1 | **Ansatzbasis** angestellt vs. Freelance vs. SAP-Ansatz | bis 2,4× auf 1'450 PT |
| 2 | **Prozessanzahl** — der Prototyp definiert 9 | 20 PT je Prozess |
| 3 | **SAP-Integrationen** — «ist REST» deckt die einfachere Hälfte ab | 30 PT je Integration |
| 4 | **Inhaltsverwaltung** — die vergessene Position | 110 PT |
| 5 | **Anzahl Micro-Apps** — Prototyp 19, Budget trägt 4–6 | 40–120 PT je App |
| 6 | **Nichtfunktionale Pflichten** — WCAG 2.1 AA (BehiG/eCH-0059), Sicherheit | fix, nicht verhandelbar |

---

## 9. Hebel für Spielraum

| Hebel | Einsparung | Preis dafür |
|---|---|---|
| Zuerst nur lesend, kein Rückschreiben nach SAP | 60–100 PT | Vorgänge bleiben portalseitig |
| CD-Schicht und Komponenten aus dem Prototyp übernehmen | 40–60 PT | keiner — bereits gemessen |
| Inhalte in Git mit leichtem Editor statt CMS | 60–80 PT | redaktionelle Eigenständigkeit |
| SAP-seitige Arbeit dem SAP-Produktbudget zuordnen | 100–150 PT | organisatorisch zu klären |
| `floorplan-editor` und `plan-check` zurückstellen | je 6–12 Monate | zwei sichtbare Funktionen fehlen |

Zur vierten Zeile: die REST-Schnittstelle existiert bereits. Wenn das SAP-Team
sie besitzt und pflegt, bezahlt dieses Budget nur die **Nutzung** — das ist
Webarbeit zu Webansätzen. Werden hingegen SAP-Spezialisten dafür bezahlt,
Endpunkte zu bauen und zu ändern, sind das 100–150 PT zu ~CHF 1'932, also
**CHF 200'000–290'000** — ein Fünftel des Budgets.

---

## 10. Risiken

| Risiko | Wirkung | Umgang |
|---|---|---|
| **Erwartung** — die Stakeholder haben 19 funktionierende Apps gesehen | Was nicht im ersten Release ist, liest sich als «gestrichen», nicht als «noch nicht finanziert» | MVP-Scope zeichnen lassen, bevor der Prototyp weiter zirkuliert; Prototyp ausdrücklich als Roadmap kennzeichnen |
| **Ansatzbasis nicht gesichert** | Fehlbetrag zeigt sich um Monat 14 | Rollen in der Beschaffung getrennt ausschreiben: Portal/Frontend, Plattform, SAP-Integration — drei Ansätze, nicht einer |
| **Prozessanzahl wächst** | 20 PT je Prozess, ungedeckt | Prozesse pro PI freigeben, nicht als Gesamtpaket zusagen |
| **SAP-Vertrag ändert sich** | Nacharbeit im Betrieb | Schnittstellenvertrag versionieren, Contract-Tests im CI |
| **CHF 1.5 Mio. ist Aufbau- statt Gesamtbudget** | Betrieb ab Jahr 2 ungedeckt | Vor Verpflichtung klären — ändert, was zugesagt werden kann |

---

## 11. Wenn nur Freelance möglich ist

Dann ist CHF 1.5 Mio. ehrlicherweise ein **Aufbaubudget, keine Gesamtkosten**,
zu reduziertem Scope:

| | |
|---|---|
| Portalrahmen + eIAM | enthalten |
| Prozesse | 2 |
| Lesende SAP-Sichten | 1–2 |
| Inhalte | Git + leichter Editor |
| Umfang | ~650–700 PT |

Das ist vertretbar: ausliefern, Wirkung zeigen, damit Betriebsbudget und das
nächste PI begründen. Nicht vertretbar wäre, vier Jahre Eigentümerschaft zu
SAP-Ansätzen auf dieses Budget zuzusagen.
