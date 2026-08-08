// Bootstrap: load the shared core + process engine, render the federal shell, start the router.
import { core } from './core.js';
import { engine } from './process-engine.js';
import { session } from './session.js';
import { shell } from './shell.js';
import { initRouter, redraw, requestNavigationPermission } from './router.js';
import { notification, escape, announce, toast, wireShare, wireLogin, mountBanner } from './components.js';

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
  // { live:true }: der Container ist eine benannte Region (index.html), keine
  // Live-Region mehr — die einmalige Ansage beim Einfügen übernimmt die
  // Notification selbst als role="alert" (Review a11y-datastatus-1).
  el.innerHTML = `<div class="container" style="padding-top:1rem">${notification(
    `<strong>Einige Daten konnten nicht geladen werden</strong> (${escape(areas.join(', '))}). `
    + 'Betroffene Listen sind unvollständig oder leer — das ist ein Ladefehler, keine leere Ablage. '
    + '<button type="button" class="link" onclick="location.reload()">Seite neu laden</button>',
    'error', 'WarningCircle', { live: true })}</div>`;
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
  window.addEventListener('core:data-loaded', renderDataStatus);
  const header = document.getElementById('main-header');
  shell.renderHeader(header);
  shell.renderFooter(document.getElementById('main-footer'));
  renderDataStatus();
  // Teilen-Dialog EINMAL global verdrahten (delegiert): jede Seite mit einer
  // share-bar bekommt ihn, ohne selbst etwas zu tun — und er überlebt jeden
  // Seitenwechsel, weil der Listener am Dokument hängt.
  wireShare(document);
  // Anmeldeknöpfe ebenso EINMAL global verdrahten: sie stehen in der Kopfzeile,
  // in jedem Login-Hinweis und in den Zugriff-Karten — und jeder von ihnen darf
  // ein Ziel mitbringen (data-login-next).
  wireLogin(document);
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
  let refreshId = 0;
  const refresh = async (msg, next = '') => {
    const ownRefresh = ++refreshId;
    const startHash = location.hash;
    shell.renderHeader(header);
    // Anmeldung MIT Ziel: der Knopf stand dort, wo sonst «Vorgang starten»
    // steht, also erledigt er beides. Die Navigation ersetzt das Neuzeichnen —
    // `hashchange` löst den Router aus, und der setzt den Fokus auf die neue
    // Überschrift, was hier die richtige Ortsangabe ist («Sie sind jetzt im
    // Formular»), nicht der Anmeldeknopf in der Kopfzeile.
    // Nur portalinterne Routen: ein externes Ziel liesse sich nach dem
    // `await` ohnehin nicht mehr ohne Popup-Blocker öffnen.
    if (next && next.startsWith('#/')) {
      announce(msg);
      if (next === location.hash) await redraw();   // kein hashchange → selbst zeichnen
      else location.hash = next;
      return;
    }
    await redraw();          // erst abwarten — der Router setzt am Ende selbst den Fokus
    if (ownRefresh !== refreshId) return false;
    announce(msg);
    // A navigation that superseded this redraw owns focus. The session change
    // remains announced, but the late auth refresh must not steal focus from
    // the newly requested route.
    if (location.hash !== startHash) return true;
    const btn = header.querySelector('.meta-navigation--desktop .meta-navigation__auth')
             || header.querySelector('.meta-navigation__auth');
    if (btn) btn.focus({ preventScroll: true });
    return true;
  };
  window.addEventListener('session:changed', () => {
    const ownRefresh = ++refreshId;
    shell.renderHeader(header);
    void redraw().then(() => {
      if (ownRefresh !== refreshId) return;
      announce(session.isLoggedIn()
        ? 'Die Anmeldung aus einem anderen Tab wurde übernommen.'
        : 'Die Sitzung wurde in einem anderen Tab beendet.');
    }).catch((error) => console.error('[app] cross-tab session refresh failed', error));
  });
  window.__login = (next = '') => {
    const u = session.login();
    if (!u) {
      toast('Die Anmeldung konnte auf diesem Gerät nicht gespeichert werden. Bitte prüfen Sie die Browser-Einstellungen.', 'error', 'WarningCircle');
      return Promise.resolve(false);
    }
    return refresh(`Angemeldet als ${u ? u.name : ''}.${next ? '' : ' Die Seite wurde aktualisiert.'}`, next);
  };
  window.__logout = () => {
    // A guarded application may own unsaved state. Ask before changing the
    // session or header: checking only inside redraw() would be too late because
    // the logout mutation itself changes what the current route is allowed to
    // render.
    if (!requestNavigationPermission(location.hash || '#/', 'session-logout')) {
      return Promise.resolve(false);
    }
    if (!session.logout()) {
      toast('Die Abmeldung konnte auf diesem Gerät nicht gespeichert werden. Bitte versuchen Sie es erneut.', 'error', 'WarningCircle');
      return Promise.resolve(false);
    }
    return refresh('Abgemeldet. Die Seite wurde aktualisiert.');
  };
  // Nur für die Prüfskripte: die Prozess-Engine ohne Formularlauf erreichbar
  // machen. Anders lässt sich nicht belegen, dass start() eine unbekannte
  // Definition ablehnt, statt sich eine zu erfinden (H10).
  window.__engine = engine;
}

// Bewusst NICHT über C.notification (anders als die übrigen Fehlerbänder, §2.6):
// das hier ist der letzte Auffangnetz-Handler. Wenn der Start scheitert, kann
// die Ursache in einem Baustein liegen — dann würde ein Aufruf im catch-Zweig
// gleich noch einmal werfen und der Nutzer sähe eine leere Seite statt einer
// Meldung. `escape` allein ist eine reine Funktion ohne Abhängigkeiten.
boot().catch(e => {
  console.error('[app] boot failed', e);
  document.getElementById('main-content').innerHTML =
    `<div class="container section"><div class="notification notification--error">Die Anwendung konnte nicht gestartet werden: ${escape(e.message)}</div></div>`;
});
