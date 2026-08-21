// Start, Router und Studien-Leiste.
//
// Der Nutzerfluss ist der Gegenstand dieser Studie, deshalb ist er echt und
// nicht gestellt: Hero → tippen → Vorschlag oder Enter → Trefferseite → Treffer
// oder Antwort → Quelle. Alle drei Eingänge (Hero, Kopfsuche, Vorschlagszeile)
// landen auf DERSELBEN Route, genau wie im Portal — #/search?q=… ist die
// einzige Stelle, an der Treffer und Antwort entstehen.

import { load, byHref, failedAreas, index } from './data.js';
import { renderHome, renderResults, renderLog, teardown } from './views.js';
import { SWITCHES, on, all, set, onChange } from './settings.js';
import { onChange as onSourcesChange, ratio as sourceRatio } from './sources.js';
import { esc, icon, notification, announce } from './ui.js';

const mount = document.getElementById('main-content');

/* ------------------------------------------------------------- Router --- */

const nav = {
  /** Eine Abfrage suchen. Setzt Seite und Filter zurück: eine neue Frage ist
   *  keine Verfeinerung der alten. */
  search(q) { nav.go(`#/search?q=${encodeURIComponent(q)}`); },
  /** Eine Route ansteuern. Externe Ziele öffnen ein neues Fenster, wie im Portal. */
  route(href, external) {
    if (external && /^https?:/i.test(href)) window.open(href, '_blank', 'noopener,noreferrer');
    else nav.go(href);
  },
  go(href) {
    // Gleiche Route, gleicher Zustand: hashchange feuert nicht, wenn sich
    // nichts ändert — dann selbst neu zeichnen, sonst bleibt ein Klick wirkungslos.
    if (decodeURIComponent(location.hash) === decodeURIComponent(href)) draw();
    else location.hash = href;
  },
  redraw() { draw(); },
};

function parse() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { segs: path.split('/').filter(Boolean), query: new URLSearchParams(qs || '') };
}

/* Zielseiten-Attrappe. Ein Treffer muss irgendwo landen, sonst lässt sich der
   Fluss nicht zu Ende gehen — aber diese Studie baut keine Detailseiten und
   keine Navigation. Sie sagt das, statt es zu verschweigen. */
function renderStub(route) {
  const row = byHref(route);
  mount.innerHTML = `
    <section class="section section--default">
      <div class="container">
        ${row ? `<p class="meta-info"><span class="meta-info__item">${esc(row.type)}</span>${
          row.meta ? `<span class="meta-info__item">${esc(row.meta)}</span>` : ''}</p>` : ''}
        <h1 tabindex="-1">${esc(row ? row.title : 'Nicht Teil dieser Studie')}</h1>
        ${row && row.desc ? `<p class="muted">${esc(row.desc)}</p>` : ''}
        <div class="stub-note">${notification(
          `<p><strong class="text--bold">Attrappe.</strong> Diese Studie baut Hero-Suche,
           Vorschlagsfeld und Trefferseite — nicht die Detailseiten und nicht die Navigation
           des Portals. Im Portal führt <code>${esc(route)}</code> auf die echte Seite.</p>
           <p><a href="#/">← Zur Startseite</a> · <a href="../../../index.html${esc(route)}">Im echten Portal öffnen</a></p>`,
          'info')}</div>
      </div>
    </section>`;
  announce(row ? `${row.type}: ${row.title}. Attrappe.` : 'Attrappe, nicht Teil dieser Studie.');
}

function draw() {
  teardown();
  const { segs, query } = parse();
  if (!segs.length) { renderHome(mount, nav); return; }
  if (segs[0] === 'search') {
    // Diagnoseansicht statt Treffer (#/search?log=1), wie im Portal.
    if (query.get('log') === '1') renderLog(mount, nav);
    else renderResults(mount, query, nav);
    return;
  }
  renderStub(location.hash || '#/');
}

/* -------------------------------------------------- Studien-Leiste ------ */
// EINGEKLAPPT als Grundstellung. Die Leiste ist Werkzeug, nicht Entwurf — wer
// die Studie das erste Mal sieht oder einen Screenshot macht, soll das Produkt
// sehen und nicht das Messgerät darüber. Aufgeklappt ist sie einen Klick weit
// weg, und der Zustand bleibt erhalten: wer die Schalter braucht, arbeitet
// nicht gegen ein Panel, das bei jedem Neuzeichnen wieder zufällt.
//
// DIE OFFENLEGUNG WANDERT DAMIT NACH INNEN, und das ist vertretbar, weil sie
// nicht hier zu Hause ist: die Marke «Simuliert» steht AM Antwortblock, direkt
// neben dem Satz, den sie betrifft, dazu «Automatisch erstellt und kann Fehler
// enthalten» und die Fussnote im Fussbereich. Wer eine Antwort sieht, sieht die
// Kennzeichnung — unabhängig davon, ob dieses Panel offen ist.

const BAR_KEY = 'bbl.suche.studybar';
let BAR_OPEN = false;
try { BAR_OPEN = localStorage.getItem(BAR_KEY) === '1'; } catch { /* privater Modus */ }

function studyBar() {
  const alle = all();
  const quellen = sourceRatio();
  return `
    <div class="container study-bar__inner">
      <button type="button" class="study-bar__trigger" id="study-toggle"
        aria-expanded="${BAR_OPEN}" aria-controls="study-panel">
        ${icon('Flask', 'icon--base')}<span>Studie «Suche»</span>${icon('ChevronDown', 'study-bar__chev')}
      </button>
    </div>
    <div class="container study-bar__panel" id="study-panel"${BAR_OPEN ? '' : ' hidden'}>
      <p class="study-bar__note">Echte Daten, echte Suchmaschine,
        <strong>simulierte</strong> KI-Antwort.</p>
      <div class="study-bar__switches">
        ${SWITCHES.map((s) => `<label class="study-toggle${alle[s.key] ? '' : ' study-toggle--off'}" title="${esc(s.hint)}">
          <input type="checkbox" data-switch="${esc(s.key)}"${alle[s.key] ? ' checked' : ''}>
          <span>${esc(s.label)}${s.key === 'sources' && quellen ? ` <span class="study-toggle__n">${esc(quellen)}</span>` : ''}</span></label>`).join('')}
        <span class="study-sep" aria-hidden="true"></span>
        <a class="study-bar__link" href="#/search?log=1">Protokoll</a>
        <a class="study-bar__link" href="../../../index.html#/search">Echte Portalsuche</a>
      </div>
    </div>`;
}

function paintStudyBar() {
  const bar = document.getElementById('study-bar');
  bar.innerHTML = studyBar();
  const toggle = bar.querySelector('#study-toggle');
  const panel = bar.querySelector('#study-panel');
  toggle.addEventListener('click', () => {
    BAR_OPEN = panel.hidden;
    panel.hidden = !BAR_OPEN;
    toggle.setAttribute('aria-expanded', String(BAR_OPEN));
    try { localStorage.setItem(BAR_KEY, BAR_OPEN ? '1' : '0'); } catch { /* siehe oben */ }
  });
  bar.querySelectorAll('[data-switch]').forEach((cb) =>
    cb.addEventListener('change', () => set(cb.dataset.switch, cb.checked)));
}

/* --------------------------------------------------------------- Start --- */
(async function boot() {
  mount.innerHTML = '<section class="section section--default"><div class="container">'
    + '<p class="muted">Daten werden geladen …</p></div></section>';
  paintStudyBar();

  try {
    await load();
  } catch (error) {
    mount.innerHTML = '<section class="section section--default"><div class="container">'
      + notification(
        `<p><strong class="text--bold">Daten konnten nicht geladen werden.</strong> ${esc(error.message)}</p>
         <p>Die Studie muss <em>ausgeliefert</em> werden, nicht per Doppelklick geöffnet:
         <code>node scripts/serve.mjs</code>, dann
         <code>http://127.0.0.1:8848/docs/wireframes/260820%20-%20Suche/</code></p>`, 'warning')
      + '</div></section>';
    return;
  }

  // Teilausfälle sind KEIN Abbruch, aber auch keine plausible Null: was fehlt,
  // fehlt sichtbar, sonst liest sich «keine Treffer» wie ein Suchbefund.
  const fehlt = failedAreas();
  if (fehlt.length) {
    console.warn('[suche] nicht geladen:', fehlt.join(', '));
    document.getElementById('main-header').insertAdjacentHTML('afterend',
      `<div class="container" style="padding-top:var(--sp-4)">${notification(
        `<p><strong class="text--bold">Unvollständiger Datenbestand.</strong> Nicht geladen:
         <code>${esc(fehlt.join(', '))}</code>. Trefferzahlen dieser Sitzung sind mit dem Portal
         nicht vergleichbar.</p>`, 'warning')}</div>`);
  }

  // Kopfsuche: kein Vorschlagsfeld, dasselbe Ziel — wie heute im Portal.
  const headerForm = document.getElementById('header-search-form');
  const headerInput = document.getElementById('global-search');
  headerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = headerInput.value.trim();
    nav.go(q ? `#/search?q=${encodeURIComponent(q)}` : '#/search');
    headerInput.blur();
  });

  // Bedienelemente, die diese Studie NICHT baut, führen auf die Hinweisseite,
  // statt beim Klick nichts zu tun.
  document.querySelectorAll('[data-stub]').forEach((el) =>
    el.addEventListener('click', () => nav.go(`#/stub/${encodeURIComponent(el.dataset.stub)}`)));

  // Ein Schalterwechsel ändert, was die Seite zeigt — Leiste und Ansicht müssen
  // denselben Zustand zeigen, sonst hätte die Studie zwei Wahrheiten.
  onChange(() => { paintStudyBar(); draw(); });
  // Eine geänderte Quellenauswahl ändert, was die Seite findet — Leiste und
  // Ansicht müssen denselben Zustand zeigen, sonst hätte die Studie zwei
  // Wahrheiten. Denselben Weg nimmt schon der Schalterwechsel darüber.
  onSourcesChange(() => { paintStudyBar(); draw(); });

  window.addEventListener('hashchange', draw);
  draw();

  console.info(`[suche] Index: ${index().length} Einträge · Schalter: ${
    SWITCHES.filter((s) => on(s.key)).map((s) => s.key).join(', ') || 'keine (Portalzustand)'}`);
})();
