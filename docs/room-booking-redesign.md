# Raumbuchung — Redesign (`#/app/room-booking`)

Umsetzung der Entwurfsrichtung **1a «Eine Seite, Direktbuchung»** aus
`docs/wireframes/260806 - Room Booking.html` (Runde 1 bot zwei Richtungen;
1b «Zwei Schritte, Zeitraster» wurde nicht gewählt).

## Ausgangslage

Die App trug einen dreistufigen Assistenten: **Standort** (Katalogleiste,
Seitenliste, Karte) → **Termin & Raum** (Suchformular, Ergebnisliste bzw.
Grundriss, Detailspalte) → **Prüfen** (Titel, Eingeladene, Zusammenfassung).

Der häufigste Fall ist immer derselbe — «morgen früh ein Zimmer am eigenen
Standort». Er kostete drei Seitenwechsel, obwohl alle dafür nötigen Angaben in
eine Zeile passen. Zusätzlich trug Schritt 2 drei Aufgaben gleichzeitig
(Kriterien setzen, Ergebnisse lesen, Raum wählen) und war damit die dichteste
Fläche der ganzen Anwendung.

## Umgesetzt

- **Kein Assistent.** Suchleiste oben, Ergebnisliste darunter, Buchen im Dialog
  an der Raumkarte. Schrittanzeige, Schritt-Navigation und die
  «Ändern»-Rücksprünge sind entfallen.
- **Vorbelegung statt Auswahl.** Standort = gemerkter Favorit, sonst der
  Hausstandort; Datum = nächster Arbeitstag; Zeit = 09:00–10:00; 4 Personen.
  Die Liste steht beim Öffnen — eine Buchung braucht zwei Klicks.
- **Schnellauswahl** «Heute · Morgen · Jetzt für 30 Min.» sucht sofort; ein
  zweiter Klick auf «Räume anzeigen» wäre reine Bestätigungsarbeit.
- **Raumkarten ohne Foto.** An die Stelle des Bildes tritt das
  Geschoss-Kennzeichen (Raumnummer + Geschoss). Ausstattung sind Text-Chips;
  ein fehlender Videodienst steht als Warnung («Kein Teams») an der Karte.
- **Freies Fenster** («Frei 08:00–17:00») nur, wenn der Raum am gewählten Tag
  wirklich anderweitig belegt ist — an jeder Karte wäre die Angabe Rauschen.
- **Merkliste** (`js/favorites.js`, localStorage): Sterne an Standort und Raum.
  Gemerkte Standorte belegen die nächste Suche vor und stehen als eigene
  Optionsgruppe im Standortfeld; gemerkte Räume sortieren zuoberst.
- **Meine Buchungen** trägt zusätzlich die gemerkten Standorte und den Zugang
  zur Karte.

## Karte und Grundriss

Beide bleiben erhalten, aber als **Dialoge**. Sie beantworten «wo ist das?» und
sind nicht der Weg zur Buchung — sie dürfen ihn deshalb auch nicht verstellen.

- **Grundriss**: «Grundriss ansehen» in der Ergebnisleiste. Geschosswechsel,
  Verfügbarkeitseinfärbung und Legende wie zuvor; ein Klick auf einen freien
  Raum führt direkt in den Buchungsdialog.
- **Karte**: «Alle Standorte auf der Karte» unter Meine Buchungen, ohne
  Fokusobjekt — der Dialog heisst «alle» und zeigt alle.

Der Grundriss ist bewusst **kein** zweiter Ansichtsmodus (kein `view-switch`):
er zeigt nicht dieselbe Liste anders, sondern denselben Bestand im Raum.

## Bewusste Abweichungen vom Entwurf

| Entwurf 1a | Umsetzung | Grund |
| --- | --- | --- |
| «· 2 Min. von Ihrem Büro» an der Raumkarte | entfällt | Der Prototyp kennt keinen Arbeitsplatz der angemeldeten Person; die Angabe wäre erfunden. |
| «Auch belegte Räume zeigen (15)» und der Hinweis «Limmat ist erst ab 10:00 frei» | entfällt | Nicht beauftragt (Nutzerentscheid 2026-08-06). |
| «Wöchentlich wiederholen» im Buchungsdialog | entfällt | Nicht beauftragt; die Prozess-Engine kennt keine Serie, das wäre ein Datenmodell-Entscheid. |
| Chip «★ Meine Standorte (3)» in der Schnellauswahl | Stern am Standortfeld + Optionsgruppe «★ Meine Standorte» | Ein Feld mit zwölf Einträgen braucht keinen Filter; der Stern liegt dort, wo gemerkt wird. |
| «Zuletzt gebucht» als eigene Fläche | bestehendes «Erneut buchen» je vergangener Buchung | Nicht beauftragt; die Funktion gibt es bereits an der Buchung selbst. |
| Trefferzahl und Steuerung in EINER Zeile | Trefferzahl als Überschrift, Steuerung in der geteilten `C.catalogueBar` | Die Katalogleiste ist der Hausbaustein (vier weitere Ansichten tragen sie); «Grundriss ansehen» hängt über den neuen `extra`-Steckplatz darin. |

## Geteilte Bausteine

- **Neu:** `js/favorites.js` — Merkliste je Art (`building`, `room`).
- **Erweitert:** `C.catalogueBar({ extra })` — RAW-HTML am Ende der
  Steuergruppe für eine leistenweite Nebenaktion, abgesetzt wie der
  Ansichtswechsel (`.catbar__aside`). Standard leer; die vier Katalogleisten
  sehen davon nichts.
- **Entfallen:** der gesamte `.booking-step*` / `.booking-location-*` /
  `.booking-side*` / `.booking-room-row` / `.booking-confirm*`-Block in
  `css/app.css`, samt der Raumfoto-Regeln.

## Prüfung

`scripts/test-room-booking.mjs` deckt die neue Fläche in 1440 px und 320 px ab:
Suchleiste, Schnellauswahl, Gruppengrösse, ungültiger Zeitraum, Filter und
Filter-Reset, Merkliste (inklusive Sortierwirkung und localStorage),
Grundriss-Dialog, Buchungsdialog (leerer Titel wird abgewiesen), Abschluss mit
Referenz, Meine Buchungen, Karten-Dialog und der Tiefenlink `?room=`.

Ergänzend angepasst: `test-login.mjs`, `test-forms.mjs` (Assistent-Selektoren)
und `test-routes.mjs` (die Weiterleitung prüft jetzt den Pfad — die App spiegelt
ihren Suchzustand nach dem Zeichnen in die Adresse, damit ein frisch geöffneter
Link teilbar ist).
