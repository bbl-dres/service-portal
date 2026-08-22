// Mein Profil — identity and settings behind the signed-in name in the meta
// bar. Ported from the tenant portal's profile page in the 2026-08 cross-portal
// alignment (docs/design-alignment.md D43): the same three cards — identity,
// notifications, language — adapted to this portal's world (AGOV / FedLogin
// instead of eIAM, no role model; the tenant page dropped its role rows in the
// same decision). Notifications and language are prototype mocks, exactly as
// they are in the tenant portal: the save button confirms with a toast and
// persists nothing, and only German is offered.

import { session } from '../core/session.js';

// The session record carries userId/name/org synchronously; the directory
// (data/users.json) adds e-mail. Declared so the router ensures it before
// render (docs/code-review.md §3).
export const needs = ['users'];

export default async function render(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  setTitle('Mein Profil');
  setCrumbs([{ label: 'Startseite', href: '#/' }, { label: 'Mein Profil' }]);

  // The profile is the personal area behind the meta-bar name; signed out it
  // prompts for authentication, like #/my-cases.
  if (!session.isLoggedIn()) {
    mount.innerHTML = `
    <div class="container section">
      ${C.pageHeader({ title: 'Mein Profil', lead: 'Ihre Angaben aus AGOV / FedLogin und Ihre Einstellungen.' })}
      ${C.loginGate('Das Profil zeigt Ihre Angaben aus AGOV / FedLogin und Ihre Einstellungen. Bitte melden Sie sich an, um es zu öffnen.')}
    </div>`;
    return;
  }

  const user = session.user();
  // The directory record may add fields the session copy does not carry
  // (e-mail); the session record remains the fallback so the page renders
  // even if data/users.json failed to load (the data banner reports that).
  const record = core.user(user.userId) || user;

  const checkboxRow = (label, checked) => `
    <label class="option-list__item"><input type="checkbox"${checked ? ' checked' : ''}> <span>${C.escape(label)}</span></label>`;
  const radioRow = (label, { checked = false, disabled = false } = {}) => `
    <label class="option-list__item"><input type="radio" name="profile-lang"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}> <span>${C.escape(label)}</span></label>`;

  // Header and cards share ONE centred narrow column (container__center--xs,
  // the same 6/12 grid slot the news article uses) — the tenant profile page
  // centres its content the same way (container--reading), and the two pages
  // are a pair (2026-08 alignment, D43 follow-up: user decision).
  mount.innerHTML = `
  <div class="container section">
    <div class="container--grid">
    <div class="container__center--xs">
    ${C.pageHeader({ title: 'Mein Profil' })}
    <div>

      <div class="card card--default">
        <div class="card__body">
          <h2 class="card__title">Identität (über AGOV / FedLogin)</h2>
          <dl class="kv">
            <dt>Name</dt><dd>${C.escape(record.name)}</dd>
            <dt>E-Mail</dt><dd>${record.email ? C.escape(record.email) : '—'}</dd>
            <dt>Benutzer-ID</dt><dd><code>${C.escape(record.userId)}</code></dd>
            <dt>Organisation</dt><dd>${C.escape(record.org || '—')}</dd>
          </dl>
          <p class="legend">Diese Daten kommen aus AGOV / FedLogin und dem föderalen Verzeichnis und können hier nicht geändert werden.</p>
        </div>
      </div>

      <div class="card card--default mt-6">
        <div class="card__body">
          <h2 class="card__title">Benachrichtigungen</h2>
          <p class="muted">Per E-Mail, sobald sich der Status Ihrer Vorgänge ändert.</p>
          <fieldset class="option-list">
            <legend class="sr-only">Benachrichtigungs-Einstellungen</legend>
            ${checkboxRow('Statuswechsel meiner Vorgänge', true)}
            ${checkboxRow('Rückfragen zu meinen Vorgängen', true)}
            ${checkboxRow('Wartungsfenster & Systemmeldungen', true)}
            ${checkboxRow('Tägliche Zusammenfassung statt Einzel-E-Mails', false)}
          </fieldset>
          <div><button class="btn btn--outline btn--sm" type="button" data-profile-save>
            <span class="btn__text">Einstellungen speichern</span></button></div>
        </div>
      </div>

      <div class="card card--default mt-6">
        <div class="card__body">
          <h2 class="card__title">Sprache</h2>
          <p class="muted">Wird in Inhalten und Benachrichtigungen verwendet, wo verfügbar.</p>
          <fieldset class="option-list">
            <legend class="sr-only">Sprache</legend>
            ${radioRow('Deutsch', { checked: true })}
            ${radioRow('Français (noch nicht verfügbar)', { disabled: true })}
            ${radioRow('Italiano (noch nicht verfügbar)', { disabled: true })}
            ${radioRow('Rumantsch (nicht vorgesehen)', { disabled: true })}
          </fieldset>
        </div>
      </div>

      <!-- data-logout rides the global wireLogin delegate (js/app.js) — the
           same control the header uses; after signing out this page redraws
           as its login gate. -->
      <button class="btn btn--bare mt-6" type="button" data-logout>Abmelden</button>
    </div>
    </div>
    </div>
  </div>`;

  // Prototype mock, as in the tenant portal: confirm, persist nothing.
  mount.querySelector('[data-profile-save]')?.addEventListener('click', () => {
    C.toast('Einstellungen gespeichert');
  });
}
