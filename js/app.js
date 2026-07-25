// Bootstrap: load the shared core + process engine, render the federal shell, start the router.
import { core } from './core.js';
import { engine } from './process-engine.js';
import { session } from './session.js';
import { shell } from './shell.js';
import { initRouter, redraw } from './router.js';
import { notification, escape } from './components.js';

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
  const refresh = () => { shell.renderHeader(header); redraw(); };
  window.__login = () => { session.login(); refresh(); };
  window.__logout = () => { session.logout(); refresh(); };
}

boot().catch(e => {
  console.error('[app] boot failed', e);
  document.getElementById('main-content').innerHTML =
    `<div class="container section"><div class="notification notification--error">Die Anwendung konnte nicht gestartet werden: ${e.message}</div></div>`;
});
