// Bootstrap: load the shared core + process engine, render the federal shell, start the router.
import { core } from './core.js';
import { engine } from './process-engine.js';
import { session } from './session.js';
import { shell } from './shell.js';
import { initRouter, redraw } from './router.js';
import { notification, escape, announce } from './components.js';

// Datenausfall-Band (P0-4): Fehlt eine data/*.json, würde die betroffene Liste
// als leer (statt «nicht verfügbar») erscheinen. Ein persistentes Fehlerband über
// dem Inhalt macht den Ausfall ehrlich sichtbar, statt eine plausible Null zu zeigen.
function renderDataStatus() {
  const el = document.getElementById('data-status');
  if (!el) return;
  const areas = core.failedAreas();
  if (!areas.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="container" style="padding-top:1rem">${notification(
    `<strong>Einige Daten konnten nicht geladen werden</strong> (${escape(areas.join(', '))}). `
    + 'Betroffene Listen sind unvollständig oder leer — das ist ein Ladefehler, keine leere Ablage. '
    + '<button type="button" class="link" onclick="location.reload()">Seite neu laden</button>',
    'error', 'WarningCircle')}</div>`;
}

async function boot() {
  await Promise.all([core.load(), engine.load()]);
  const header = document.getElementById('main-header');
  shell.renderHeader(header);
  shell.renderFooter(document.getElementById('main-footer'));
  renderDataStatus();
  initRouter();

  // AGOV / FedLogin-Stub: An- und Abmelden zeichnen Kopfzeile und aktuelle
  // Seite neu, damit der Login-Status und der Vorgangs-Hinweis überall stimmen.
  // Kein Rollen- oder Rechtekonzept — nur der User-Flow «Vorgang starten».
  // An-/Abmelden zeichnet Kopfzeile UND Seite neu — der auslösende Knopf wird
  // dabei zerstört, sodass der Fokus auf <body> fiel und nichts angesagt wurde.
  // Jetzt: Statusmeldung in die Live-Region und Fokus zurück auf den (neu
  // gerenderten) Auth-Knopf (Item 3.7).
  const refresh = async (msg) => {
    shell.renderHeader(header);
    await redraw();          // erst abwarten — der Router setzt am Ende selbst den Fokus
    announce(msg);
    const btn = header.querySelector('.meta-navigation--desktop .meta-navigation__auth')
             || header.querySelector('.meta-navigation__auth');
    if (btn) btn.focus({ preventScroll: true });
  };
  window.__login = () => {
    session.login();
    const u = session.user();
    return refresh(`Angemeldet als ${u ? u.name : ''}. Die Seite wurde aktualisiert.`);
  };
  window.__logout = () => { session.logout(); return refresh('Abgemeldet. Die Seite wurde aktualisiert.'); };
}

boot().catch(e => {
  console.error('[app] boot failed', e);
  document.getElementById('main-content').innerHTML =
    `<div class="container section"><div class="notification notification--error">Die Anwendung konnte nicht gestartet werden: ${escape(e.message)}</div></div>`;
});
