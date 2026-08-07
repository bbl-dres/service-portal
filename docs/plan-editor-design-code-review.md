# Plan-Editor — Design- und Code-Review

Stand: 7. August 2026

## Review-Rahmen

Geprüft wurden die Plan-Editor-Wireframes 2a-4 bis 2a-9 in `docs/wireframes/260806 - Workpace Management`, die vorhandenen Muster des Portals und des Mietendenportals sowie die Komponenten- und Interaktionsmuster des Swiss Federal Design Systems. Der Review umfasst Informationsarchitektur, visuelle Hierarchie, Interaktion, responsive Zustände, Barrierefreiheit, Daten- und Lebenszyklusgrenzen sowie Regressionstests.

Der Plan-Editor ist als eigenständige Power-User-Anwendung richtig geschnitten. Portal, schreibgeschützte Vorschau, Autorenwerkzeug und spätere Planprüfung bleiben getrennte Produkte mit stabilen Übergabeschlüsseln. Die aktuelle Implementierung eignet sich als Feedback-Prototyp; sie ist bewusst noch kein Mehrbenutzer-CAD-System.

## Umgesetzte Befunde

| Priorität | Befund | Umsetzung |
| --- | --- | --- |
| Hoch | Planaktionen und Canvas-Werkzeuge waren vermischt. Dadurch wirkten Teilen und technische IDs wie geometrische Werkzeuge. | Teilen/Link/Plan-ID liegen jetzt im CD-konformen Menü «Mehr» in der Kontextzeile. Die schwebende Leiste enthält direkte Canvas-Werkzeuge; der lokale Verlauf steht im Bearbeitungsmodus wie im Wireframe bei Rückgängig/Wiederholen. |
| Hoch | Die Bibliothek ersetzte im Bearbeitungsmodus dauerhaft den Ressourcenbaum und verkleinerte den Canvas, auch wenn keine Ausstattung hinzugefügt wurde. | Der beschriftete Toolbar-Einstieg «Hinzufügen» öffnet Produkt- oder Modulbibliothek kontextuell. Eine Produktwahl wechselt in die freie Canvas-Platzierung (oder setzt bei gewähltem Raum direkt); Modulzuweisung, Werkzeugwechsel, Schliessen und Escape geben die Canvasbreite frei. `library=products|modules` bildet nur den explizit offenen Zustand ab. |
| Hoch | Die Strukturwerkzeuge des Wireframes waren entweder als einzelner Plus-Knopf zusammengezogen oder hätten im Prototyp nicht vorhandene CAD-Fähigkeiten suggeriert. | Ein eigenes, tastaturbedienbares Strukturmenü bildet die Wireframe-Gruppe ab. Nur die funktionierende rechteckige Raumfläche ist aktiv; Wand/Tür/Fenster und weitere CAD-Tools sind als Folgeumfang deaktiviert. Ein wirksamer Lock schaltet Griffe, Geometriefelder und Strukturaufbau gemeinsam. |
| Hoch | Das Farbmenü lag im beschnittenen linken Panel und konnte visuell hinter dem Canvas verschwinden; gleichzeitig erzeugte «Keine» eine bedeutungslose Gruppe «Alle Räume». | Das Menü wird in einer eigenen festen Top-Layer-Schicht positioniert und bleibt über dem Viewer bedienbar. `Keine` ist der URL-kanonische Default und zeigt eine direkte, flache Raumliste; Aggregation entsteht nur bei einem ausgewählten Farbattribut. |
| Hoch | Jede Auswahl und jeder Neuaufbau der Three.js-Szene setzte die Kamera zurück. Inspektion in 3D oder Begehung verlor dadurch ihren räumlichen Kontext. | Orbit- und Begehungskamera werden je Modus validiert gespeichert und nach einem Szenen-Neuaufbau wiederhergestellt. |
| Hoch | Seitenpanel-Zustände liefen über Breakpoints weiter. Ein auf Mobile geschlossenes Panel konnte deshalb auf Desktop fehlen; zwei offene Mobile-Panels konnten den Canvas überdecken. | Desktop-Präferenzen und kompakter Drawer-Zustand sind getrennt. Kompakt startet geschlossen, öffnet immer nur einen Drawer und unterstützt Backdrop sowie Escape; Desktop stellt die Dreispaltenansicht wieder her. |
| Mittel | Ein Klick auf eine Raumzeile war gleichzeitig Auswahl und Disclosure. Das machte Baum und Inspektor unvorhersehbar. | Raum-Disclosure und Raumselektion sind unabhängige, benannte Bedienelemente. Auswahl öffnet den betreffenden Ast gezielt, ohne spätere Disclosure-Klicks als Selektion zu interpretieren. |
| Mittel | Menü-, Farbauswahl- und Bibliotheks-Tabs waren per Maus nutzbar, erfüllten das erwartete Tastaturmuster aber nur teilweise. | `Mehr` und «Einfärben nach» unterstützen Pfeiltasten, Home/End, Escape und Fokusrückgabe. Bibliotheks-Tabs verwenden roving tabindex, verknüpfte Tabpanels und automatische Aktivierung. Aussenklick schliesst offene Menüs. |
| Mittel | Formularänderungen zeichneten den gesamten Inspektor neu und setzten seine Scrollposition zurück. | Der Inspektor erhält seine Scrollposition bei feldbezogenen Neuzeichnungen. |
| Mittel | Navigation im Lesemodus erforderte zuerst das separate Pan-Werkzeug; direkte Maus- und Touch-Gesten verhielten sich nicht wie in etablierten Plan- und Kartenviewern. | Primärtaste beziehungsweise ein Finger verschieben den Plan jetzt direkt. Eine Bewegungsschwelle trennt Tap-Selektion von Drag-Pan; im Bearbeitungsmodus bleibt das direkte Ziehen von Räumen und Objekten erhalten und das Pan-Werkzeug erlaubt weiterhin das Verschieben über Entitäten. |
| Mittel | Darstellungswechsel und Viewport-Navigation waren auf eine einfache 2D/3D/Begehung-Leiste unten und Zoom-/Reset-Aktionen in der oberen Werkzeugleiste verteilt. | Eine persistente View-Navigationsleiste bündelt Darstellungswechsel und die jeweils sinnvollen Zoom-, Einpassen- oder Reset-Aktionen. Die obere Leiste bleibt fachlichen Canvas-Werkzeugen vorbehalten. Roving tabindex, Pfeiltasten/Home/End, 44-px-Ziele und eine beschriftete kompakte Variante ergänzen das Muster. |
| Mittel | Der Prototyp-Hinweis beanspruchte dauerhaft viel Aufmerksamkeit, obwohl er nur eine Sicherheitsgrenze erklären soll. | Die Fusszeile ist visuell kompakt und nennt die lokale Browser-Arbeitskopie; der vollständige Hinweis zu fehlender Synchronisation und Berechtigungsprüfung bleibt als zugänglicher Name und Tooltip erhalten. |
| Niedrig | Der mobile Bearbeitungszustand reduzierte sich auf einen nicht selbsterklärenden orangefarbenen Punkt. | «Bearbeitungsmodus» bleibt auch in der kompakten Kopfzeile lesbar und mittig; der orange Canvas-Rahmen ergänzt den Zustand. |

## Designbeurteilung

Die überarbeitete Hierarchie entspricht dem Wireframe und den bestehenden Portal-Mustern:

- Die primäre Kopfzeile trägt Identität, globale Suche/Upload und den globalen Bearbeitungszustand.
- Die Kontextzeile trägt Breadcrumb, Planstand, planweite Aktionen und die Panel-Schalter.
- Die Canvas-Leiste trägt ausschliesslich räumliche Werkzeuge.
- Im Bearbeitungsmodus gliedert sie Aufgaben lesbar in Hinzufügen, Auswahl/Messung, Struktur und Verlauf; die Bibliothek ist ein temporärer Arbeitskontext und keine permanente Hauptnavigation.
- Ressourcenbaum und Inspektor sind gleichwertige, unabhängig schaltbare Arbeitsbereiche; die Zeichenfläche bleibt der visuelle Schwerpunkt.
- Auswahl wird nicht nur durch Farbe vermittelt: Baumzeile, Canvas-Entität, Inspektortitel und URL-Zustand bilden eine konsistente Auswahlkette.
- 3D und Begehung verwenden das bestehende 2D-Dokument als Quelle und bleiben ohne dauerhafte Hilfetexte ruhig. Ein Reset und das Fadenkreuz liefern nur die unmittelbar nötige Orientierung.
- Der 2D-Lesemodus folgt dem vertrauten Karten-/Planmuster: Ziehen mit Primärtaste oder einem Finger verschiebt, kurzes Tippen beziehungsweise Klicken wählt aus, Mausrad zoomt. Grab-/Grabbing-Cursor geben die direkte Manipulation zurückhaltend wieder.
- Die View-Navigation bleibt in 2D, 3D und Begehung an derselben Position. Der aktive Modus ist visuell und über `aria-pressed` eindeutig; Modus- und Navigationsaktionen sind getrennte, benannte Gruppen. Auf schmalen Screens bleiben 2D und 3D ausgeschrieben, Begehung verwendet den zugänglich benannten Augen-Glyph.

Die Anwendung ist für Desktop-Power-User optimiert. Auf schmalen Viewports bleiben Navigation, Canvas und beide Drawer erreichbar und ohne Dokument-Overflow. Vollwertiges mobiles geometrisches Authoring ist bewusst kein Ziel dieser Iteration; dafür wären grössere Touch-Ziele, eine andere Werkzeugpriorisierung und gerätespezifische Usability-Tests erforderlich.

## Codebeurteilung

Positiv sind die klare Trennung von kanonischem Lesebestand und abgelöstem Editor-Dokument, die strikte Repository-Validierung, deterministische Baselines, begrenzter Undo/Redo-Verlauf, URL-reproduzierbarer Zustand und das konsequente Aufräumen von Browser- und Three.js-Ressourcen. `floorplan-editor-canvas.js`, `floorplan-editor-three.js`, `floorplan-editor-model.js` und `floorplan-editor-repository.js` bilden bereits belastbare technische Nähte für die nächste Iteration.

Vor dem Produktionsausbau bleiben folgende Punkte bewusst offen:

1. `js/apps/floorplan-editor.js` ist weiterhin ein grosser UI-Orchestrator. Beim Backend-Anschluss sollten Chrome/Navigation, Ressourcenbaum, Bibliothek, Inspektor und Aktionsdialoge in zustandsarme Controller oder View-Module zerlegt werden; das Dokumentmodell soll dabei die einzige fachliche Schreibschnittstelle bleiben.
2. Vier seltene Verwerfungs-/Löschpfade verwenden noch native `confirm`-Dialoge. Für die Produktionsfassung sollten sie durch die vorhandenen CD-Modalmuster mit Aktionstitel, konkreter Auswirkung, destruktiver Schaltfläche und sauberem Fokusrücklauf ersetzt werden. `beforeunload` bleibt aus Browsergründen separat.
3. Rendering und Suche müssen mit realistischen Grossplänen profiliert werden. Der aktuelle vollständige Baum- und Inspektor-Neuaufbau ist für die Prototypdaten angemessen; bei mehreren hundert Räumen und tausenden Objekten werden inkrementelle Updates oder Listen-Virtualisierung nötig.
4. Die lokale Publikation ist keine Sicherheits- oder Kollaborationsgrenze. Produktion benötigt eigenständige Raum-Entitäten, authentifizierte API-Aufrufe, Row-Level Security, serverseitige Autorenschaft, Planrevisionen und optimistische Konfliktprüfung.
5. Das erzeugte 3D-Modell ist semantisch an das aktuelle Editor-Dokument gebunden, aber geometrisch weiterhin eine Näherung. CAD-Wand-/Türtopologie, Kollisionsprüfung, importierte Produktmodelle und Planprüfung gehören in spätere, getrennt spezifizierte Ausbauschritte.

## Verifikation

- `node --check js/apps/floorplan-editor.js`
- `node --check js/floorplan-editor-three.js`
- `node scripts/test-floorplan-editor.mjs`
- `node scripts/test-floorplan-editor-model.mjs`
- `git diff --check`

Der Browserlauf deckt Login-Gate, Gebäude-/Geschossnavigation, Deep Links, Dreispaltenlayout, Ressourcenhierarchie, editmodusspezifische Werkzeugreihenfolge, kontextuelle Bibliothek, Strukturmenü/-Lock, Aktionsmenüs, Tastaturbedienung, 2D/3D/Begehung, Kameraerhalt, Selektion, Editieren, Undo/Redo, lokale Arbeitskopie/Publikation, kanonische Datenisolation sowie die 320-px-Drawer- und Breakpoint-Zustände ab.
