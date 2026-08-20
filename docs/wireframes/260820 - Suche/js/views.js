// Die zwei Ansichten: Hero-Suche und Trefferseite.

import { search } from '../../../../js/search/search-engine.js';
import { index, KIND_ORDER } from './data.js';
import { attachSuggest } from './suggest.js';
import { isQuestion, plan } from './query.js';
import { build } from './answer.js';
import { answersOn, setAnswersOn } from './settings.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ICON_SUCHE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13.3 12.8c1.9-2.2 1.7-5.6-.5-7.5s-5.6-1.7-7.5.5-1.7 5.6.5 7.5c2 1.7 4.9 1.7 6.9 0l6 6 .5-.5zm-4 1c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5-2 4.5-4.5 4.5z"/></svg>';
const ICON_ANTWORT = '<svg class="notification__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m7.38763 19.46794v-3.458h-3.32129v-10.39454h16.583v10.39453h-8.186zm-2.57129-4.208h3.32129v2.79l4.09424-2.79h7.668v-8.89454h-15.08353z"/></svg>';

let detachSuggest = null;
export function teardown() { if (detachSuggest) { detachSuggest(); detachSuggest = null; } }

const feld = (id, value, placeholder) => `
  <div class="listbox-anchor">
    <div class="search__group">
      <label class="sr-only" for="${id}">Suche auf der Plattform</label>
      <input class="search__field" id="${id}" type="search" autocomplete="off"
             placeholder="${esc(placeholder)}" value="${esc(value)}">
      <button class="search__submit" type="submit" aria-label="Suchen">${ICON_SUCHE}</button>
    </div>
  </div>`;

/* ============================================================ STARTSEITE == */
export function renderHome(mount, nav) {
  mount.innerHTML = `
    <section class="section">
      <div class="container">
        <h1 class="hero__title">Willkommen im BBL Kundenportal</h1>
        <p class="hero__lead">Dienstleistungen, Anwendungen, Dokumente und Daten des
          Bundesamts für Bauten und Logistik — an einem Ort.</p>
        <form class="search--large" role="search" id="hero-form">
          <div class="hero__searchrow">
            ${feld('hero-q', '', 'Suchen oder Frage stellen …')}
            <button class="btn btn--filled hero__submit" type="submit">
              <span class="btn__text">Suchen</span>
            </button>
          </div>
        </form>
        <p class="hero__affordance">
          Stichwörter funktionieren wie bisher. Ganze Fragen ebenfalls —
          das Feld zeigt beim Hineinklicken Beispiele.
        </p>
      </div>
    </section>`;

  const form = mount.querySelector('#hero-form');
  const input = mount.querySelector('#hero-q');
  detachSuggest = attachSuggest(input, form, {
    onSubmitQuery: (q) => nav.search(q),
    onOpenRoute: (href) => nav.route(href),
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) nav.search(q);
  });
  input.focus({ preventScroll: true });
}

/* ========================================================== ANTWORTBLOCK == */
function antwortHtml(res, q, trefferZahl) {
  const kopf = (titel, marke) => `<p class="answer__head">
      <span class="answer__title">${esc(titel)}</span>
      <span class="badge badge--blue">${esc(marke)}</span></p>`;

  const fuss = `<div class="answer__foot">
      <span class="legend">Diese Antwort ist in diesem Prototyp <strong>simuliert</strong>:
        sie wird aus den Texten der gefundenen Datensätze zusammengesetzt, nicht von einem
        Sprachmodell erzeugt. Massgebend sind die verlinkten Quellen.</span>
      <button class="answer__off" type="button" data-answers-off>Antworten ausblenden</button>
    </div>`;

  if (res.state === 'none') {
    // «Keine Antwort» ist ein Erfolgszustand, kein Fehler — und der Text darf
    // nicht auf Treffer verweisen, die es nicht gibt.
    const trefferSatz = trefferZahl > 0
      ? 'Die Treffer unten stammen aus der Stichwortsuche.'
      : 'Auch die Stichwortsuche findet dazu nichts im Portal.';
    return `<div class="notification notification--hint answer-slot">${ICON_ANTWORT}
      <div class="notification__content">
        ${kopf('Keine Antwort', 'Simuliert')}
        <p>Zu dieser Frage wurde im Portal nichts Passendes gefunden. ${trefferSatz}</p>
        ${fuss}
      </div></div>`;
  }

  // Ein Abschnitt ohne Beleg wird nicht gerendert. Der Renderer setzt das
  // durch — nicht der Text, der ihn geliefert hat.
  const abschnitte = res.abschnitte.filter((a) => Number.isInteger(a.beleg) && a.beleg > 0);
  if (!abschnitte.length) return antwortHtml({ state: 'none', plan: res.plan }, q, trefferZahl);

  const saetze = abschnitte.map((a) =>
    `<p>${esc(a.text)}<a class="cite" href="${esc(res.quellen[a.beleg - 1].href)}"
       aria-label="Beleg ${a.beleg}">${a.beleg}</a></p>`).join('');

  const quellen = `<div class="answer__sources">
      <p class="answer__sources-label">Quellen</p>
      ${res.quellen.map((s) => `<span class="source">
          <span class="source__n">${s.n}</span>
          <span><span class="meta-info"><span class="meta-info__item">${esc(s.art)}</span>${
            s.meta ? `<span class="meta-info__item">${esc(s.meta)}</span>` : ''
          }</span><br><a href="${esc(s.href)}">${esc(s.titel)}</a></span>
        </span>`).join('')}
    </div>`;

  return `<div class="notification notification--hint answer-slot">${ICON_ANTWORT}
    <div class="notification__content">
      ${kopf('Antwort', 'Simuliert')}
      ${saetze}
      ${quellen}
      ${fuss}
    </div></div>`;
}

/* ========================================================= TREFFERSEITE === */
export function renderResults(mount, q, state, nav) {
  const rows = index();
  const direkt = q ? search(rows, q) : [];
  const p = plan(q);
  const frage = isQuestion(q);

  // ZWEI GETRENNTE FUNKTIONEN, und das ist der Entscheid hinter diesen Zeilen:
  //
  //   Frageauflösung  → verbessert die TREFFER. Läuft immer.
  //   Antwortbau      → erzeugt den BLOCK. Schaltbar.
  //
  // Als beides noch am selben Schalter hing, leerte «Antworten aus» auch die
  // Trefferliste: die wörtliche Suche findet zu einer Frage nichts (0 Treffer,
  // gemessen). Wer die Antworten abschaltet, will keine Antwort — keine
  // kaputte Suche. Der Schalter darf die Auflösung deshalb nicht mitnehmen.
  const gebaut = frage ? build(q) : null;
  const res = (frage && answersOn()) ? gebaut : null;
  // Die Relevanzschranke (js/answer.js) entscheidet, OB die Frage verstanden
  // wurde — nicht, wie viel danach gezeigt wird. Beide Seiten brauchen etwas
  // anderes:
  //
  //   Antwort → nur `strong`. Ein Satz mit Beleg behauptet etwas; er darf sich
  //             nicht auf einen Einzelwort-Zufallstreffer stützen.
  //   Liste   → alle Treffer, sobald überhaupt etwas Starkes dabei war. Eine
  //             Liste behauptet nichts, sie bietet an; Verwandtes ist dort
  //             brauchbar. Auf `strong` verengt schrumpfte «defekte Heizung»
  //             von 20 auf 2 Zeilen — Präzision am falschen Ort.
  //
  // Ist NICHTS stark, war die Frage nicht verstanden: dann fällt die Liste auf
  // die wörtliche Suche zurück und zeigt lieber nichts als Beliebiges.
  const hits = (gebaut && gebaut.strong.length) ? gebaut.hits : direkt;

  const counts = new Map();
  for (const h of hits) counts.set(h.kind, (counts.get(h.kind) || 0) + 1);
  const kinds = [...counts.keys()].sort(
    (a, b) => (KIND_ORDER.indexOf(a) + 99) % 999 - (KIND_ORDER.indexOf(b) + 99) % 999);
  const gewaehlt = state.kind && counts.has(state.kind) ? state.kind : '';
  const sichtbar = gewaehlt ? hits.filter((h) => h.kind === gewaehlt) : hits;

  const planNote = frage
    ? `<p class="plan-note">Wörtliche Stichwortsuche: <strong>${direkt.length}</strong> Treffer ·
       nach Frageauflösung (<code>${esc(p.keywords.join(' '))}</code>):
       <strong>${hits.length}</strong> Treffer${
         p.dropped.length ? ` · entfernt: <code>${esc(p.dropped.join(' '))}</code>` : ''}</p>`
    : '';

  mount.innerHTML = `
    <section class="section section--tint">
      <div class="container">
        <h1>Suche</h1>
        <form class="search--large search--page-result" role="search" id="res-form">
          ${feld('res-q', q, 'Suchen oder Frage stellen …')}
        </form>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div id="answer-host">${
          (frage && answersOn() && res) ? antwortHtml(res, q, hits.length) : ''
        }</div>
        <div class="catbar">
          <span><strong>${sichtbar.length}</strong> von ${hits.length} Treffern für
            «${esc(q)}»</span>
          <span class="catbar__actions">Sortierung: Relevanz</span>
        </div>
        ${kinds.length > 1 ? `<div class="facets" role="group" aria-label="Inhaltsart">
          <button class="facet" type="button" data-kind="" aria-pressed="${gewaehlt ? 'false' : 'true'}">
            Alle <span class="facet__n">${hits.length}</span></button>
          ${kinds.map((k) => `<button class="facet" type="button" data-kind="${esc(k)}"
            aria-pressed="${gewaehlt === k ? 'true' : 'false'}">${esc(k)}
            <span class="facet__n">${counts.get(k)}</span></button>`).join('')}
        </div>` : ''}
        ${planNote}
        ${sichtbar.length ? `<ul class="search-results-list">${sichtbar.map((r) => `
          <li class="search-result">
            <a class="search-result__link plain-link" href="${esc(r.href)}">
              <p class="meta-info search-result__meta">
                <span class="meta-info__item">${esc(r.type)}</span>${
                  r.meta ? `<span class="meta-info__item">${esc(r.meta)}</span>` : ''}
              </p>
              <h3 class="search-result__title">${esc(r.title)}</h3>
              ${r.desc ? `<p class="search-result__desc">${esc(r.desc)}</p>` : ''}
            </a>
          </li>`).join('')}</ul>`
        : `<div class="results-empty">
             <h2>Keine Treffer für «${esc(q)}»</h2>
             <p class="text--muted">Versuchen Sie weniger oder andere Stichwörter.</p>
           </div>`}
      </div>
    </section>`;

  const form = mount.querySelector('#res-form');
  const input = mount.querySelector('#res-q');
  detachSuggest = attachSuggest(input, form, {
    onSubmitQuery: (nq) => nav.search(nq),
    onOpenRoute: (href) => nav.route(href),
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nq = input.value.trim();
    if (nq) nav.search(nq);
  });

  mount.querySelectorAll('.facet').forEach((b) => b.addEventListener('click', () => {
    nav.search(q, { kind: b.dataset.kind });
  }));
  const off = mount.querySelector('[data-answers-off]');
  if (off) off.addEventListener('click', () => { setAnswersOn(false); nav.search(q, state); });

  // EINMALIGE Ansage, nicht Wort für Wort — sonst unterbricht der Screenreader
  // bei jedem Zeichen des Streams.
  const live = document.getElementById('live');
  if (live) {
    live.textContent = res && res.state === 'answer'
      ? `Antwort verfügbar, ${res.quellen.length} Quellen. ${hits.length} Treffer.`
      : `${hits.length} Treffer für ${q}.`;
  }
}
