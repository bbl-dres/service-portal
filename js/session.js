// Mock session (no real auth — single demo user). See docs/requirements NFR-SEC-01.
const USER = { name: 'Andrea Muster', org: 'Bundesamt für Umwelt BAFU' };

export const session = {
  user: () => USER,
};

export default session;
