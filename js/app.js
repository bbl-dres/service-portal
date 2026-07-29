// Bootstrap: load the shared core + process engine, render the federal shell, start the router.
import { core } from './core.js';
import { engine } from './process-engine.js';
import { session } from './session.js';
import { shell } from './shell.js';
import { initRouter, redraw } from './router.js';
import { notification, escape, announce, wireShare, mountBanner } from './components.js';

// Datenausfall-Band (P0-4): Fehlt eine data/*.json, würde die betroffene Liste
// als leer (statt «nicht verfügbar») erscheinen. Ein persistentes Fehlerband über
// dem Inhalt macht den Ausfall ehrlich sichtbar, statt eine plausible Null zu zeigen.
function renderDataStatus() {
  const el = document.getElementById('data-status');
  if (!el) return;
  // Auch die Prozess-Engine meldet hierher: fehlen die Definitionen, lässt sich
  // KEIN Vorgang mehr starten — das muss sichtbar sein, bevor jemand ein
  // Formular ausfüllt (H10).
  const areas = [...core.failedAreas(), ...engine.failedAreas()];
  if (!areas.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="container" style="padding-top:1rem">${notification(
    `<strong>Einige Daten konnten nicht geladen werden</strong> (${escape(areas.join(', '))}). `
    + 'Betroffene Listen sind unvollständig oder leer — das ist ein Ladefehler, keine leere Ablage. '
    + '<button type="button" class="link" onclick="location.reload()">Seite neu laden</button>',
    'error', 'WarningCircle')}</div>`;
}

async function boot() {
  // Der Start wartet nur noch auf das, was die Shell zum Zeichnen braucht:
  // services + reference (17 KB, 2 Requests). Alles andere holt der Router je
  // Route über `needs` nach.
  //
  // Vorher hingen hier elf Bestände (275 KB, 13 Requests) VOR dem ersten
  // Pixel — gedrosselt 7.7 s bis zum ersten Inhalt, auch auf den Wissensseiten,
  // die gar keine Daten lesen (docs/code-review.md §1).
  //
  // Die Prozess-Engine (2 Dateien, 11 KB) bleibt im Start, aber PARALLEL: sie
  // trägt die Vorgangsliste, und «Meine Vorgänge» dürfte sie nicht halb sehen.
  // Vier Requests statt dreizehn.
  await Promise.all([core.load(), engine.load()]);
  // Nachgeladene Bestände (core.ensure) können später ausfallen — das Band wurde
  // da längst gezeichnet. Ohne diesen Horcher bliebe so ein Ausfall unsichtbar.
  window.addEventListener('core:data-failed', renderDataStatus);
  const header = document.getElementById('main-header');
  shell.renderHeader(header);
  shell.renderFooter(document.getElementById('main-footer'));
  renderDataStatus();
  // Teilen-Dialog EINMAL global verdrahten (delegiert): jede Seite mit einer
  // share-bar bekommt ihn, ohne selbst etwas zu tun — und er überlebt jeden
  // Seitenwechsel, weil der Listener am Dokument hängt.
  wireShare(document);
  // Prototyp-Hinweis als CD-Consent-Streifen. Einmal weggeklickt, bleibt er weg.
  mountBanner(document.getElementById('banner-host'), {
    id: 'prototyp',
    html: 'Diese Anwendung ist ein <strong>Prototyp</strong>. Darstellung, Funktionalität und Inhalte dienen ausschliesslich der Demonstration.',
    actionLabel: 'Verstanden',
    variant: 'info',   // CD-Vorgabe für dieses Bauteil (NotificationBanner.vue:51)
    label: 'Hinweis zum Prototyp',
  });
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
  // Nur für die Prüfskripte: die Prozess-Engine ohne Formularlauf erreichbar
  // machen. Anders lässt sich nicht belegen, dass start() eine unbekannte
  // Definition ablehnt, statt sich eine zu erfinden (H10).
  window.__engine = engine;
}

boot().catch(e => {
  console.error('[app] boot failed', e);
  document.getElementById('main-content').innerHTML =
    `<div class="container section"><div class="notification notification--error">Die Anwendung konnte nicht gestartet werden: ${escape(e.message)}</div></div>`;
});
