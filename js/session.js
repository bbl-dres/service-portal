// Mock session: no real authentication. The prototype starts logged out and
// simulates login through AGOV / FedLogin (the federal login service replacing
// eIAM). It deliberately models NO roles or permissions. Login only demonstrates
// the start-case user flow. All content remains visible while logged out;
// only starting a case requires login.

import { readJSON, writeJSON, remove } from './storage.js';

const LS_KEY = 'bbl_session_v1';
const DEMO_USER = { name: 'Andrea Muster', org: 'Bundesamt für Umwelt BAFU' };

// A user without a name is not a user. Starting logged out is safer than
// continuing with a partial record (M20).
const isUser = (candidate) => !!candidate && typeof candidate === 'object'
  && typeof candidate.name === 'string' && candidate.name.trim() !== '';
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
  // Login through AGOV / FedLogin: a prototype stub without a real redirect.
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
