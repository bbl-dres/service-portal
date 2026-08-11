# Bilder der Multispace-Beispiele

Fotografien der realisierten Flächen aus `data/workspace-examples.json`. Ein Beispiel ist
ein ausgebauter **Ort** — ein Geschoss, eine Zone darin oder ein einzelner Raum — und
nicht ein Gebäude; entsprechend zeigen die Bilder hier Innenräume, nicht Fassaden.

## Namensschema

    <example-slug>_<n>.jpg

Beispiel: `bundeshaus-west-2og-stabsstelle_1.jpg`

## Woher die Bilder kommen

Zwei Wege, und sie sind nicht gleichwertig:

- **Eigene Aufnahmen der Fläche.** Hierher, mit dem Schema oben, und im Beispielrecord
  unter `images` eingetragen.
- **Bestehende Assets der Mediendatenbank.** NICHT hierher kopieren. Der Beispielrecord
  verweist über `mediaIds` in `data/media.json`, damit Lizenz, Fotograf:in, Copyright und
  Quelle beim Asset bleiben. Ein Teil dieser Aufnahmen ist als «BBL-Mediendatenbank, nicht
  frei lizenziert» geführt; eine Kopie hier würde diese Angabe verlieren.

Die Beispielseite bevorzugt `images` und fällt auf `mediaIds` zurück. Solange keine
eigenen Aufnahmen vorliegen, zeigen die Beispiele die verwiesenen Assets — mit ihrer
Lizenzangabe.
