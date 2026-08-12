// Mock session: no real authentication. The prototype starts LOGGED IN as the
// demo user and simulates login through AGOV / FedLogin (the federal login
// service replacing eIAM). It deliberately models NO roles or permissions.
// Login only demonstrates the start-case user flow. All content remains visible
// while logged out; only starting a case requires login.
//
// The logged-out start was the earlier default and read as a half-broken portal
// rather than as a demonstration of the sign-in flow (user feedback): visitors
// met a login gate before they had seen anything to log in for. Logging out
// still works and still survives a reload — see SIGNED_OUT.

import { readJSONResult, writeJSON } from './storage.js';

const LS_KEY = 'bbl_session_v1';
// The `demoDefault` record of data/users.json, repeated here on purpose: this
// module resolves the session during its own evaluation, synchronously, while
// the directory is a deferred fetch. `userId` is what ties the two together —
// personal state (js/core/bookmarks.js) is filed under it.
const DEMO_USER = { userId: 'U.123.456', name: 'Andrea Muster', org: 'Bundesamt für Umwelt BAFU' };

// logout() records this marker instead of removing the key. Without a stored
// trace, «nothing stored» would mean «first visit» on the next load and the
// default below would sign the user straight back in — logging out would be
// visible until reload only. Deliberately NOT exported (the module surface is
// pinned by scripts/test-api-surface.mjs); the test harness mirrors the literal
// the same way it mirrors the demo user (scripts/lib/cdp.mjs).
const SIGNED_OUT = 'signed-out';

// A user without a name is not a user: a partial record must never reach the
// forms that prefill from it (M20). `userId` is required for the same reason —
// personal state is filed under it, and a session without one would silently
// write somebody's bookmarks nowhere. Sessions stored before the id existed
// therefore fail here and are replaced by the complete demo user below.
const isUser = (candidate) => !!candidate && typeof candidate === 'object'
  && typeof candidate.name === 'string' && candidate.name.trim() !== ''
  && typeof candidate.userId === 'string' && candidate.userId.trim() !== '';
const isStored = (candidate) => candidate === SIGNED_OUT || isUser(candidate);

// Three storage states, two of them meaning «logged in»: a usable user, the
// explicit SIGNED_OUT marker, and everything else — first visit, cleared
// profile, unavailable or damaged storage. The last group falls back to the
// complete demo user, so the M20 concern (continuing with half an identity)
// stays covered even though the fallback is no longer the logged-out state.
function storedUser() {
  const stored = readJSONResult(LS_KEY, null, isStored);
  if (stored.value === SIGNED_OUT) return null;
  return isUser(stored.value) ? stored.value : { ...DEMO_USER };
}

let user = storedUser();

// A session mutation in another tab must update this module's cached value.
// The storage listener is application-wide (not route-owned), so it lives for
// exactly as long as the page and asks app.js to redraw the current gate/header.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== LS_KEY && event.key !== null) return;
    const nextUser = storedUser();
    const unchanged = user === nextUser
      || (user && nextUser && user.userId === nextUser.userId
        && user.name === nextUser.name && user.org === nextUser.org);
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
    if (!writeJSON(LS_KEY, SIGNED_OUT)) return false;
    user = null;
    return true;
  },
};
