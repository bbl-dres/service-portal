// Mock-Session — keine echte Authentisierung. Der Prototyp startet abgemeldet
// und simuliert die Anmeldung über AGOV / FedLogin (der föderale Login-Dienst,
// der eIAM ablöst). Es wird bewusst KEIN Rollen- oder Berechtigungskonzept
// abgebildet — Login dient nur dazu, den User-Flow «Vorgang starten» zu zeigen.
// Inhalte bleiben abgemeldet vollständig sichtbar; nur das Auslösen eines
// Vorgangs verlangt eine Anmeldung.

import { readJSON, writeJSON, remove } from './storage.js';

const LS_KEY = 'bbl_session_v1';
const DEMO_USER = { name: 'Andrea Muster', org: 'Bundesamt für Umwelt BAFU' };

// Ein Nutzer ohne Namen ist kein Nutzer — lieber abgemeldet starten als mit
// einem halben Datensatz weiterarbeiten (M20).
const isUser = (u) => !!u && typeof u === 'object' && typeof u.name === 'string' && u.name.trim() !== '';
let user = readJSON(LS_KEY, null, isUser);
const listeners = new Set();

function save() {
  if (user) writeJSON(LS_KEY, user); else remove(LS_KEY);
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
