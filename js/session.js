// Mock-Session — keine echte Authentisierung. Der Prototyp startet abgemeldet
// und simuliert die Anmeldung über AGOV / FedLogin (der föderale Login-Dienst,
// der eIAM ablöst). Es wird bewusst KEIN Rollen- oder Berechtigungskonzept
// abgebildet — Login dient nur dazu, den User-Flow «Vorgang starten» zu zeigen.
// Inhalte bleiben abgemeldet vollständig sichtbar; nur das Auslösen eines
// Vorgangs verlangt eine Anmeldung.

const LS_KEY = 'bbl_session_v1';
const DEMO_USER = { name: 'Andrea Muster', org: 'Bundesamt für Umwelt BAFU' };

let user = load();
const listeners = new Set();

function load() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch { return null; }
}
function save() {
  try {
    if (user) localStorage.setItem(LS_KEY, JSON.stringify(user));
    else localStorage.removeItem(LS_KEY);
  } catch (e) { console.warn('[session] localStorage unavailable', e); }
}
function emit() { listeners.forEach(fn => { try { fn(user); } catch (e) { console.error(e); } }); }

export const session = {
  user: () => user,
  isLoggedIn: () => !!user,
  // Anmelden über AGOV / FedLogin — im Prototyp ein Stub ohne echten Redirect.
  login: () => { user = { ...DEMO_USER }; save(); emit(); return user; },
  logout: () => { user = null; save(); emit(); },
  // Header und aktive Seite abonnieren Änderungen, um sich neu zu zeichnen.
  onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
};

export default session;
