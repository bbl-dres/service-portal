// Quellenauswahl — welche Inhaltsarten überhaupt durchsucht werden.
//
// NICHT ZU VERWECHSELN MIT DEN FACETTEN. Die beiden sehen verwandt aus und sind
// es nicht; sie unterscheiden sich in dem, was am schwersten zu ändern ist,
// nämlich in ihrer Lebensdauer:
//
//                   Facetten (Trefferseite)     Quellen (hier)
//   Reichweite      grenzen EINE Trefferliste   bestimmen, was ÜBERHAUPT
//                   ein                          durchsucht wird
//   Dauer           diese Abfrage               dauerhaft, geräteweit
//   Zahlen          Trefferzahlen               keine (siehe unten)
//   In der Adresse  JA, teilbar                 NEIN
//
// Der letzte Punkt ist ein Entscheid, kein Versehen: Wer einen Trefferlink
// weitergibt, gibt seine Eingrenzung MIT — das ist bei einer Facette gewollt
// und bei einer persönlichen Voreinstellung falsch. Sonst erbt die Empfängerin
// stillschweigend, dass jemand anders keine Liegenschaften sehen wollte.
//
// KEINE BESTANDSZAHLEN im Auswahlfeld. «Wissen und Hilfsmittel (148)» stimmt
// für die Demodaten und wäre an einer echten Datenbank Unsinn — eine Zahl, die
// später falsch wird, ist schlimmer als keine, und eine Aggregation bei jedem
// Öffnen des Feldes wäre teuer dazu. Wo eine Zahl WIRKLICH etwas aussagt, steht
// sie trotzdem: über der Trefferliste, zum Zeitpunkt der Abfrage gemessen.
//
// GESPEICHERT WIRD, WAS AUS IST — nicht, was an ist. Kommt im Portal später
// eine Inhaltsart dazu, ist sie damit automatisch AN. Andersherum wäre jede
// neue Inhaltsart für alle bestehenden Geräte stillschweigend unsichtbar, und
// zwar genau für die Leute, die die Auswahl je angefasst haben.
//
// LEERE AUSWAHL = KEINE EINSCHRÄNKUNG. Vorher war die letzte verbleibende
// Quelle gesperrt: eine Suche über nichts sollte gar nicht erst entstehen.
// Das machte aber den häufigsten Wunsch teuer — «zeig mir NUR Dienstleistungen»
// kostete zehn Klicks, weil man alles Übrige einzeln abwählen musste. Jetzt
// darf man alles abwählen und dann eine Quelle ankreuzen, und der Zwischenschritt
// ist kein kaputter Zustand: keine Quelle gewählt heisst, es wird alles
// durchsucht. Das ist DIESELBE Konvention, die das Facettenpanel des Portals
// schon benutzt (`!selectedKinds.length || selectedKinds.includes(...)`) — und
// die Zeile beim Feld sagt es ausdrücklich, statt es den Leuten zu überlassen.

import { KIND_ORDER, index } from './data.js';
import { on } from './settings.js';

const KEY = 'bbl.suche.sources';

// Die Antwort ist auch ein Ergebnis. Sie steht deshalb in derselben Auswahl wie
// die Inhaltsarten — nicht, weil sie eine wäre (sie wird nicht durchsucht,
// sondern erzeugt), sondern weil die Frage dieselbe ist: was darf in meinen
// Ergebnissen auftauchen? Zwei Listen für eine Frage wären zwei Orte, an denen
// man dasselbe sucht. Im Panel steht sie darum abgesetzt unter den Inhaltsarten.
// SPEICHERSCHLÜSSEL, keine Beschriftung. Der Wert landet im localStorage und
// bleibt deshalb stabil, auch wenn die sichtbare Bezeichnung sich ändert — eine
// Umbenennung darf niemandem seine Auswahl zurücksetzen.
export const ANSWERS = 'Antworten';

let off = new Set();
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (Array.isArray(raw)) off = new Set(raw.filter((k) => typeof k === 'string'));
} catch { /* privater Modus, defekter Speicher — dann ist eben alles an */ }

const listeners = new Set();
const persist = () => {
  try { localStorage.setItem(KEY, JSON.stringify([...off])); } catch { /* siehe oben */ }
};
const notify = () => listeners.forEach((fn) => fn());

/** Die wählbaren Inhaltsarten: was der Index wirklich hergibt, in KIND_ORDER.
 *  Aus dem Index, nicht aus einer Liste: fehlt eine Datei, soll die Auswahl
 *  keine Quelle anbieten, die es gerade nicht gibt. */
export function kinds() {
  const present = new Set(index().map((r) => r.kind));
  return KIND_ORDER.filter((k) => present.has(k));
}

export const isOn = (key) => !off.has(key);
export const offList = () => kinds().filter((k) => off.has(k));
export const onList = () => kinds().filter((k) => !off.has(k));

/** Darf der Antwortblock erscheinen? Ohne den Schalter «Quellenauswahl» gibt es
 *  kein Panel, in dem man die Wahl zurücknehmen könnte — dann gilt sie nicht. */
export const answersAllowed = () => !on('sources') || isOn(ANSWERS);

/** Keine Inhaltsart angekreuzt — gültiger Zustand, siehe Kopfkommentar. */
export const isEmpty = () => onList().length === 0;
export const isFull = () => kinds().every((k) => !off.has(k));

export function toggle(key) {
  if (key !== ANSWERS && !kinds().includes(key)) return;
  if (off.has(key)) off.delete(key);
  else off.add(key);
  persist();
  notify();
}

/** Die beiden Sprünge an die Enden. Sie stehen NEBENEINANDER statt als ein
 *  umschaltender Knopf: bei teilweiser Auswahl müsste ein Umschalter raten,
 *  welches Ende gemeint ist, und die jeweils andere Richtung wäre nur über
 *  einen Umweg erreichbar. So ist beides immer EIN Klick.
 *
 *  Beide fassen NUR die Inhaltsarten an, nicht die Antworten. Wer eine einzelne
 *  Inhaltsart isolieren will, meint damit nicht, dass er nebenbei auch die
 *  Antworten loswerden möchte — und im Panel steht die Antwortzeile deshalb
 *  unterhalb der Trennlinie, auf der auch diese beiden Schaltflächen sitzen. */
export function enableAll() {
  const before = off.size;
  kinds().forEach((k) => off.delete(k));
  if (off.size === before) return;
  persist();
  notify();
}

export function disableAll() {
  const list = kinds();
  if (!list.length || list.every((k) => off.has(k))) return;
  list.forEach((k) => off.add(k));
  persist();
  notify();
}

/**
 * Die aktive Auswahl als Menge — oder `null`, wenn NICHT gefiltert wird.
 * `null` statt «alle Arten» ist Absicht: der Aufrufer soll den Fall, in dem die
 * Studie das Portal nachbildet, nicht von einer Filterung unterscheiden müssen,
 * die zufällig alles durchlässt.
 *
 * Zwei Wege führen zu `null`: alles angekreuzt, oder nichts angekreuzt. Der
 * zweite ist der Zwischenschritt beim «alle abwählen, dann eine wählen» und
 * darf keine leere Trefferliste erzeugen.
 */
export function active() {
  if (!on('sources')) return null;
  const list = onList();
  if (!list.length || list.length === kinds().length) return null;
  return new Set(list);
}

/** Der EINE Aufruf, den alle Suchpfade teilen — Vorschläge, Treffer, Antwort.
 *  Läge er nur an einer Stelle, könnte die Antwort eine Quelle zitieren, die
 *  jemand ausdrücklich abgeschaltet hat. */
export function filterRows(rows) {
  const a = active();
  return a ? rows.filter((r) => a.has(r.kind)) : rows;
}

/** Kurzfassung für Protokoll und Studien-Leiste: «8/11» oder '' wenn ungefiltert. */
export function ratio() {
  const a = active();
  return a ? `${a.size}/${kinds().length}` : '';
}

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
