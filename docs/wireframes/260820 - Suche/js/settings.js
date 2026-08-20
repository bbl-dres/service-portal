// Die eine Einstellung, die dieser Prototyp kennt: Antworten an oder aus.
//
// BEWUSST DAUERHAFT, nicht pro Suche. Wer keine automatischen Antworten will,
// will das einmal sagen — nicht bei jeder Abfrage neu. Ein Schalter im
// Suchfeld hätte gefragt, bevor jemand überhaupt weiss, ob die Antwort nützt;
// der Ausschalter sitzt deshalb AM ANTWORTBLOCK (dort ist die Frage
// beantwortbar) und in der Studien-Leiste (dort ist sie auffindbar).
//
// Standard: AN. Das ist ein Kostenentscheid, keine Voreinstellung — jede
// fragenförmige Abfrage löst später einen Modellaufruf aus. Was ihn bezahlbar
// macht, ist die Auslöseprüfung in js/query.js, nicht der Schalter.

const KEY = 'bbl.suche.answers';

let on = true;
try {
  const raw = localStorage.getItem(KEY);
  if (raw === '0') on = false;
} catch { /* privater Modus, defekter Speicher — Standard gilt weiter */ }

const listeners = new Set();

export function answersOn() { return on; }

export function setAnswersOn(next) {
  const value = !!next;
  if (value === on) return;
  on = value;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* siehe oben */ }
  listeners.forEach((fn) => fn(on));
}

export function onAnswersChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
