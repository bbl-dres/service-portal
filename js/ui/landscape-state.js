// Welche Kästen der Landschaft offen stehen.
//
// Der Zustand gehoert der Anwendung, nicht dem Bauteil: er muss ein
// Neuzeichnen ueberleben, aber er gehoert nicht in die Adresse — ein
// Faltzustand ist kein Ort, an den man jemanden schickt. Beide Anwendungen
// hatten dafuer dieselbe Map mit anderen Namen (OPEN/isOpen bzw.
// BOXES/boxOpen), samt derselben Voreinstellung «offen».
//
// Je Kennung ein eigenes Gedaechtnis, damit sich zwei Anwendungen nicht in die
// Quere kommen.
const MEMORY = new Map();

const memoryFor = (id) => {
  if (!MEMORY.has(id)) MEMORY.set(id, new Map());
  return MEMORY.get(id);
};

export function landscapeState(id, { openByDefault = true } = {}) {
  const mem = memoryFor(id);
  return {
    // Voreingestellt offen: eine Landschaft, die zugeklappt beginnt, zeigt
    // beim Aufschlagen nichts als Ueberschriften.
    isOpen: (key) => (mem.has(key) ? mem.get(key) === true : openByDefault),
    toggle: (key) => {
      const now = mem.has(key) ? mem.get(key) === true : openByDefault;
      mem.set(key, !now);
      return !now;
    },
    setAll: (keys, open) => { keys.forEach((k) => mem.set(k, open === true)); },
    // «Alle zuklappen» oder «Alle aufklappen» — die Beschriftung nennt, was der
    // Druck TUN wird, also braucht der Aufrufer diese Frage.
    anyOpen: (keys) => keys.some((k) => (mem.has(k) ? mem.get(k) === true : openByDefault)),
  };
}
