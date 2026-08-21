// Die Schalter der Studie.
//
// GRUNDSTELLUNG: ALLES AN. Die Studie zeigt den Vorschlag, nicht mehr den
// Nullpunkt — die Gegenüberstellung mit dem heutigen Portal hat ihren Zweck
// erfüllt, die Entscheide sind gefallen.
//
// Die Schalter bleiben trotzdem, EINZELN: Sie beantworten weiterhin die Frage,
// welcher Teil des Vorschlags welche Wirkung hat, und über sie ist der
// Portalzustand nach wie vor erreichbar — nur nicht mehr mit einem Klick.
//
// Dass die Studie findet, was das Portal findet, hängt NICHT an diesen
// Schaltern: das prüft verify-parity.mjs am Index, unabhängig von jeder
// Einstellung. Der Nachweis überlebt also, auch wenn hier nichts mehr auf «aus»
// steht.
//
// FÜNF SCHALTER, NICHT EINER. Das ist der Entscheid hinter dieser Datei:
//
//   resolve   Frageauflösung        → verbessert die TREFFER
//   grouped   Gruppierte Vorschläge → ändert das VORSCHLAGSFELD
//   ask       «… als Frage stellen» → ergänzt den WEG bei null Treffern
//   answers   KI-Antworten          → erzeugt den BLOCK über der Liste
//   sources   Quellenauswahl        → nimmt Inhaltsarten dauerhaft AUS DEM INDEX
//
// Als Frageauflösung und Antwortbau noch an EINEM Schalter hingen, leerte
// «Antworten aus» auch die Trefferliste: die wörtliche Suche findet zu einer
// Frage nichts. Wer die Antworten abschaltet, will keine Antwort — keine
// kaputte Suche. Die fünf bleiben deshalb unabhängig.
//
// DAUERHAFT, nicht pro Suche (localStorage). Wer keine KI-Antworten will, will
// das einmal sagen. Der Ausschalter sitzt zusätzlich AM ANTWORTBLOCK — dort ist
// die Frage «will ich das?» überhaupt beantwortbar.
//
// «KI-Antworten», nicht «Automatische Antworten»: der Name nennt die Technik,
// statt sie hinter «automatisch» zu verstecken. Das Portal führt in
// docs/architecture.md ohnehin eine KI-Schicht, und die Kennzeichnungspflicht
// für maschinell erzeugte Inhalte geht in dieselbe Richtung. NICHT «KI-Suche»:
// gesucht wird ohne KI — nur die Antwort entsteht so, und der Schritt davor
// (Frageauflösung) ist ein eigener Schalter.

// v2: Die Grundstellung hat sich von «alles aus» auf «alles an» gedreht. Ein
// alter Eintrag stünde auf «aus» und würde die neue Grundstellung stillschweigend
// aushebeln — ausgerechnet bei denen, die die Studie schon einmal geöffnet haben.
const KEY = 'bbl.suche.study.v2';

export const SWITCHES = [
  { key: 'resolve', label: 'Frageauflösung',
    hint: 'Stoppwörter raus, Rest an die unveränderte Suchmaschine (js/query.js).' },
  { key: 'grouped', label: 'Gruppierte Vorschläge',
    hint: 'Abschnittsköpfe je Inhaltsart mit Anzahl, Fundstelle hervorgehoben.' },
  { key: 'ask', label: '«… als Frage stellen»',
    hint: 'Beispiele im leeren Feld und eine Aktionszeile statt des stillen Abbruchs.' },
  { key: 'answers', label: 'KI-Antworten',
    hint: 'Simulierte KI-Antwort über der Trefferliste, jeder Satz mit Beleg.' },
  { key: 'sources', label: 'Quellenauswahl',
    hint: 'Inhaltsarten dauerhaft abwählen. Wirkt auf Vorschläge, Treffer und KI-Antwort.' },
];

const DEFAULTS = { resolve: true, grouped: true, ask: true, answers: true, sources: true };
const KEYS = SWITCHES.map((s) => s.key);

let state = { ...DEFAULTS };
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  // Nur bekannte Schlüssel und nur Wahrheitswerte übernehmen: ein von Hand
  // bearbeiteter Speicher ist eine ungeprüfte Eingabe wie jede andere.
  if (raw && typeof raw === 'object') {
    for (const k of KEYS) if (typeof raw[k] === 'boolean') state[k] = raw[k];
  }
} catch { /* privater Modus, defekter Speicher — die Grundstellung gilt weiter */ }

const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(state));
const persist = () => {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* siehe oben */ }
};

export function on(key) { return !!state[key]; }
export function all() { return { ...state }; }

export function set(key, value) {
  if (!KEYS.includes(key)) return;
  const next = !!value;
  if (state[key] === next) return;
  state = { ...state, [key]: next };
  persist();
  notify();
}

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
