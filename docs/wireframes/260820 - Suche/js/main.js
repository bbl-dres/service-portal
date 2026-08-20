// Start und Router des Prototyps.
//
// Der Nutzerfluss ist der Punkt dieser Studie, deshalb ist er echt und nicht
// gestellt: Hero → tippen → Vorschlag oder Enter → Trefferseite → Antwort →
// Quelle. Alle drei Eingänge (Hero, Kopfsuche, Vorschlagszeile) landen auf
// derselben Route, genau wie im Portal — #/search?q=… ist die einzige Stelle,
// an der Treffer und Antwort entstehen.

import { load, byHref, failedAreas } from './data.js';
import { renderHome, renderResults, teardown } from './views.js';
import { answersOn, setAnswersOn, onAnswersChange } from './settings.js';

const mount = document.getElementById('main');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const nav = {
  search(q, state = {}) {
    const p = new URLSearchParams();
    p.set('q', q);
    if (state.kind) p.set('kind', state.kind);
    location.hash = `#/search?${p.toString()}`;
    // Gleiche Route, neuer Zustand: hashchange feuert nicht, wenn sich nichts
    // ändert — dann selbst neu zeichnen.
    if (decodeURIComponent(location.hash) === decodeURIComponent(`#/search?${p.toString()}`)) draw();
  },
  route(href) { location.hash = href; },
};

function parse() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { segs: path.split('/').filter(Boolean), query: new URLSearchParams(qs || '') };
}

/* Zielseiten-Attrappe. Ein Treffer muss irgendwo landen, sonst lässt sich der
   Fluss nicht zu Ende gehen — aber diese Studie baut keine Detailseiten. */
function renderStub(route) {
  const row = byHref(route);
  mount.innerHTML = `
    <section class="section">
      <div class="container">
        <p class="meta-info"><span class="meta-info__item">${esc(row ? row.type : 'Zielseite')}</span></p>
        <h1>${esc(row ? row.title : 'Zielseite')}</h1>
        <p class="text--muted">${esc(row ? (row.desc || '') : '')}</p>
        <div class="notification notification--info" style="margin-top:var(--sp-6)">
          <div class="notification__content">
            <p><strong class="text--bold">Attrappe.</strong> Diese Studie baut Hero-Suche,
            Trefferseite und den Weg dazwischen — nicht die Detailseiten des Portals.
            Im Portal führt <code>${esc(route)}</code> auf die echte Seite.</p>
          </div>
        </div>
        <p style="margin-top:var(--sp-6)"><a href="#/">← Zur Startseite</a></p>
      </div>
    </section>`;
}

function draw() {
  teardown();
  const { segs, query } = parse();
  const route = location.hash || '#/';
  if (!segs.length) { renderHome(mount, nav); return; }
  if (segs[0] === 'search') {
    renderResults(mount, (query.get('q') || '').trim(),
      { kind: query.get('kind') || '' }, nav);
    return;
  }
  renderStub(route);
}

/* --------------------------------------------------------------- Start --- */
(async function boot() {
  mount.innerHTML = '<section class="section"><div class="container">'
    + '<p class="text--muted">Daten werden geladen …</p></div></section>';
  try {
    await load();
  } catch (error) {
    mount.innerHTML = '<section class="section"><div class="container">'
      + '<div class="notification notification--warning"><div class="notification__content">'
      + `<p><strong class="text--bold">Daten konnten nicht geladen werden.</strong> ${esc(error.message)}</p>`
      + '<p>Der Prototyp muss <em>ausgeliefert</em> werden, nicht per Doppelklick geöffnet: '
      + '<code>node scripts/serve.mjs</code>, dann '
      + '<code>http://127.0.0.1:8848/docs/wireframes/260820%20-%20Suche/</code></p>'
      + '</div></div></div></section>';
    return;
  }
  const fehlt = failedAreas();
  if (fehlt.length) console.warn('[suche] nicht geladen:', fehlt.join(', '));

  // Kopfsuche: kein Vorschlagsfeld, dasselbe Ziel — wie heute im Portal.
  const headerForm = document.getElementById('header-search-form');
  const headerInput = document.getElementById('global-search');
  headerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = headerInput.value.trim();
    if (q) nav.search(q);
    headerInput.blur();
  });

  // Schalter in der Studien-Leiste und der Ausschalter am Antwortblock sind
  // DERSELBE Zustand — sonst hätte der Prototyp zwei Wahrheiten.
  const toggle = document.getElementById('ai-toggle');
  toggle.checked = answersOn();
  toggle.addEventListener('change', () => setAnswersOn(toggle.checked));
  onAnswersChange((on) => { toggle.checked = on; draw(); });

  window.addEventListener('hashchange', draw);
  draw();
})();
