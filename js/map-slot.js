// Lebenszyklus EINER MapLibre-Karte in einer Ansicht.
//
// Fünf Apps hielten sich dafür ihre eigene Buchführung: portfolio/projects/
// tenancies je eine Modulvariable + `freeXxMap()` + ein Rennmarken-Zähler,
// media-library/estate stattdessen ein festgehaltenes Promise, das im
// `onUnmount` aufgelöst und abgebaut wurde. Beide Bauarten lösen dasselbe
// Problem, und beide hatten dieselben Fallstricke — die hier einmal
// zusammengefasst sind:
//
//  * `initEstateMap` lädt MapLibre erst vom CDN. Ohne Rennmarke kann ein
//    zweiter Aufruf (Suche, zweiter Baumknoten) starten, während der erste noch
//    offen ist; `free()` läuft dann gegen `null` und die zuerst aufgelöste
//    Karte bleibt als WebGL-Kontext auf einem entfernten Knoten liegen.
//  * `free()` läuft pro Renderdurchgang ZWEIMAL (am Kopf von `renderMain` und
//    noch einmal in `mount`) und muss deshalb idempotent sein.
//  * Der Container kann zwischen Start und Auflösung aus dem Dokument fallen;
//    dann darf die Karte gar nicht erst zugewiesen, sondern muss sofort wieder
//    abgebaut werden.
//
// Der Aufrufer bringt weiterhin sein eigenes `initEstateMap(...)` mit — die
// Argumente unterscheiden sich je App (nur das Portfolio übergibt eine echte
// Parzellen-FeatureCollection, die anderen eine leere oder `null`, und
// `initEstateMap` behandelt beides verschieden). Der Slot kümmert sich
// ausschliesslich um Besitz und Abbau.
//
//   const karte = createMapSlot();
//   karte.mount(el, (el) => initEstateMap(el, points, parcels, focus));
//   …
//   karte.free();                       // idempotent, jederzeit
//   ctx.onUnmount(karte.free);          // eine Zeile statt eines Promise-Ketten
export function createMapSlot() {
  let map = null;
  let ticket = 0;

  // Baut die aktuelle Karte ab und entwertet jeden noch laufenden Ladevorgang.
  // Mehrfachaufruf ist ausdrücklich erlaubt und tut beim zweiten Mal nichts.
  function free() {
    ticket++;
    if (!map) return;
    try { map.remove(); } catch { /* schon weg */ }
    map = null;
  }

  // `init(el)` liefert das Karten-Promise. Gibt die Karte zurück, oder `null`,
  // wenn der Aufruf überholt wurde bzw. der Container verschwunden ist.
  async function mount(el, init) {
    free();
    if (!el) return null;
    const meins = ++ticket;
    let created = null;
    try {
      created = await init(el);
    } catch {
      return null;                 // Karte ist optional; der Fehlertext steht im Container
    }
    if (meins !== ticket || !el.isConnected) {
      if (created) { try { created.remove(); } catch { /* egal */ } }
      return null;
    }
    map = created;
    return created;
  }

  return { mount, free, get: () => map };
}
