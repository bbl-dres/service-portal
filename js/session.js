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

// A session mutation in another tab must update this module's cached value.
// The storage listener is application-wide (not route-owned), so it lives for
// exactly as long as the page and asks app.js to redraw the current gate/header.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== LS_KEY && event.key !== null) return;
    const nextUser = readJSON(LS_KEY, null, isUser);
    const unchanged = user === nextUser
      || (user && nextUser && user.name === nextUser.name && user.org === nextUser.org);
    if (unchanged) return;
    user = nextUser;
    window.dispatchEvent(new CustomEvent('session:changed', { detail: { source: 'storage' } }));
  });
}

export const session = {
  user: () => user,
  isLoggedIn: () => !!user,
  // Anmelden über AGOV / FedLogin — im Prototyp ein Stub ohne echten Redirect.
  login: () => {
    const nextUser = { ...DEMO_USER };
    if (!writeJSON(LS_KEY, nextUser)) return false;
    user = nextUser;
    return user;
  },
  logout: () => {
    if (!remove(LS_KEY)) return false;
    user = null;
    return true;
  },
};
