# Bilder der Multispace-Module

Ein Bild je Modul aus `data/multispace-modules.json`, verwendet auf der Handbuchseite
(`#/knowledge/workspace/multispace`) und auf der Detailseite des Moduls.

## Namensschema

    modul-<nr>.jpg

Beispiel: `modul-2.jpg` für «Team Arbeitsplatz». Die Pfade stehen im Modulrecord unter
`image`; ein Bild wird also erkannt, sobald die Datei hier liegt.

## Was fehlt, fällt zurück

Fehlt die Datei, zeigt die Karte eine Farbfläche in der Modulfarbe aus
`js/floorplan-editor/colors.js` — dieselbe Farbe, mit der der Plan-Editor Räume dieses
Moduls einfärbt. Die Karte bleibt damit lesbar und das Modul behält seine Identität,
statt ein kaputtes Bild zu zeigen.

## Herkunft und Lizenz

Für den Prototyp genügen Platzhalter, etwa von Unsplash (Unsplash-Lizenz, kommerzielle
Nutzung erlaubt, keine Namensnennung erforderlich). Zwei Regeln:

- **Keine Bilder, die Personen erkennbar zeigen.** Die Karten stehen für Raumtypen, nicht
  für Menschen; ausserdem entfällt damit die Frage nach Einwilligungen.
- **Herkunft festhalten.** Datei und Quelle in dieser Datei ergänzen, damit später
  entschieden werden kann, was durch echte BBL-Aufnahmen ersetzt wird.

Echte Aufnahmen realisierter Flächen gehören nicht hierher, sondern zu den
Planungsbeispielen (`assets/images/workspace-examples/`, verwiesen über `data/media.json`).

## Verwendete Platzhalter

| Datei | Quelle | Lizenz |
| --- | --- | --- |
| _(noch keine)_ | | |
