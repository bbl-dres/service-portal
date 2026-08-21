// Die Ansichten: Startseite, Trefferseite, Suchprotokoll.
//
// Die Trefferseite ist Zeile für Zeile die des Portals (js/pages/search.js):
// grosses Feld im getönten Band, darunter Trefferkopf mit Zahl links und
// Sortierung/Filter/Ansicht rechts, Facettenpanel mit Kontrollkästchen, aktive
// Filterpillen, Liste oder Galerie, zehn je Seite, Blätterung, und bei null
// Treffern CDs Nichts-gefunden-Block mit Einzelbegriff-Rückfragen.
//
// Was die STUDIE hinzufügt, steht sichtbar getrennt darin:
//   · der Antwortblock ÜBER der Liste (Schalter «Antworten»)
//   · die Plan-Notiz UNTER der Leiste (nur wenn ein Schalter an ist)
//   · die Quellenauswahl BEIM FELD (Schalter «Quellenauswahl»)
// Beides verschwindet spurlos, wenn die Schalter aus sind — dann ist diese
// Seite die des Portals, und was sie zeigt, gilt auch dort.

import { search, fold } from '../../../../js/search/search-engine.js';
import { index, KIND_ORDER } from './data.js';
import { attachSuggest, BEISPIELE } from './suggest.js';
import { isQuestion, plan } from './query.js';
import { build } from './answer.js';
import { on, set as setSwitch } from './settings.js';
import * as sources from './sources.js';
import { record as logQuery, summary as logSummary, clear as logClear } from './search-log.js';
import {
  esc, icon, badge, notification, empty, resultRow, card, catbar, filterGroup,
  panelReset, activeFilters, pagination, table, catalogueState, announce,
} from './ui.js';

let detachSuggest = null;
export function teardown() { if (detachSuggest) { detachSuggest(); detachSuggest = null; } }

/* Grosses Suchfeld. CD `search--large`: 4rem hoch, fetter Text, Symbolknopf
   absolut rechts (search.postcss:135-152 + Portal css/sections/search.css). */
const searchForm = (id, inputId, value, placeholder, extraClass = '') => `
  <form class="search search--large ${extraClass}" id="${id}" role="search">
    <div class="search__group">
      <label class="sr-only" for="${inputId}">Im Portal suchen</label>
      <input id="${inputId}" class="search__field" type="search" name="q"
        placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off">
      <button class="btn btn--bare btn--lg btn--icon-only search__submit" type="submit" aria-label="Suchen">
        ${icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span>
      </button>
    </div>
  </form>`;

/* ======================================================= QUELLENAUSWAHL == */
// Eine Zeile, kein Knopf. Beide Bauformen standen zum Vergleich nebeneinander;
// die Zeile hat gewonnen, weil sie im Ruhezustand nichts kostet und im Betrieb
// mehr sagt: sie NENNT die abgewählten Arten, statt nur «8/11» zu zählen.
//
// KEINE BESTANDSZAHLEN. «Wissen und Hilfsmittel (148)» stimmt für die
// Demodaten; an einer echten Datenbank wäre es entweder falsch oder eine
// Aggregation, die bei jedem Öffnen des Feldes läuft. Was die Auswahl kostet,
// zeigt sich stattdessen dort, wo es ohne Zusatzabfrage ablesbar ist: an der
// Trefferliste.
//
// Das Panel bleibt über einen Neuzeichnen-Vorgang hinweg offen und der Fokus
// kehrt auf dasselbe Kontrollkästchen zurück — sonst schlösse sich die Auswahl
// bei jedem Haken, und man müsste sie für jede Quelle neu öffnen.
let PANEL_OPEN = false;
let RESTORE_FOCUS = '';

function sourcesPanel() {
  const boxes = sources.kinds().map((k, i) => `<label class="filter-check">
      <input type="checkbox" id="src-${i}" data-source="${esc(k)}"${
        sources.isOn(k) ? ' checked' : ''}><span>${esc(k)}</span></label>`).join('');
  // BEIDE Sprünge, nebeneinander, jeder abgeblendet wenn er nichts täte. Ein
  // einzelner Umschalter müsste bei teilweiser Auswahl raten, welches Ende
  // gemeint ist, und die andere Richtung wäre nur über einen Umweg erreichbar.
  // «Alle abwählen» ist der kurze Weg zu EINER Inhaltsart: abwählen, ankreuzen,
  // fertig — statt zehnmal einzeln wegzuklicken.
  const actions = `<div class="sources-panel__actions">
      <button type="button" class="btn btn--link btn--sm" data-sources-none${
        sources.isEmpty() ? ' disabled' : ''}><span class="btn__text">Alle abwählen</span></button>
      <button type="button" class="btn btn--link btn--sm" data-sources-all${
        sources.isFull() ? ' disabled' : ''}><span class="btn__text">Alle einschalten</span></button>
    </div>`;
  // ZWEITE GRUPPE, nicht zweiter Anhang. Die KI-Antwort gehört nicht in die
  // Liste darüber, weil «nicht angekreuzt» dort etwas ANDERES heisst: bei den
  // Inhaltsarten bedeutet nichts angekreuzt «es wird alles durchsucht», hier
  // bedeutet es schlicht «keine Antwort». Dieselbe Geste mit zwei Bedeutungen
  // in einer Liste ist keine Liste mehr — und die beiden Schaltflächen oben
  // müssten sie entweder mitnehmen (und dann still die Antworten abschalten,
  // wer nur eine Inhaltsart isolieren wollte) oder sichtbar auslassen (und dann
  // wie ein Fehler aussehen).
  //
  // Als BESCHRIFTETE Gruppe statt als loser Haken unter zwei Trennlinien liest
  // sie sich als das, was sie ist: eine zweite Frage, nicht ein Rest.
  const answers = on('answers') ? `<fieldset class="filter-group sources-panel__extra">
      <legend class="filter-group__legend">Zusätzlich</legend>
      <label class="filter-check"><input type="checkbox" id="src-answers"
        data-source="${esc(sources.ANSWERS)}"${sources.isOn(sources.ANSWERS) ? ' checked' : ''
        }><span>KI-Antworten anzeigen</span></label>
    </fieldset>` : '';
  return `<div class="sources-panel" id="sources-panel"${PANEL_OPEN ? '' : ' hidden'}>
    <fieldset class="filter-group sources-panel__group">
      <legend class="filter-group__legend">Welche Inhaltsarten durchsucht werden</legend>
      ${boxes}
    </fieldset>
    ${actions}${answers}
  </div>`;
}

/** Der Auslöser: ein Satz mit einer Schaltfläche darin.
 *
 *  Der Satz WECHSELT DIE RICHTUNG, und das ist der Punkt. Gemessen mit einer
 *  einzigen gewählten Inhaltsart lautete er: «1 von 11 Inhaltsarten · ohne
 *  Anwendungen, Wissen und Hilfsmittel, Datensätze, Datentabellen, Prozesse,
 *  Geschäftsobjekte, Dokumente, News, Liegenschaften, Bauprojekte.» — zehn
 *  Namen, um eine Auswahl zu beschreiben. Wer weniger als die Hälfte gewählt
 *  hat, meint «nur diese», nicht «ohne jene»; die Zeile sagt dann dasselbe in
 *  drei Wörtern. Aufgezählt werden höchstens drei, der Rest wird gezählt: eine
 *  Zeile, die man überfliegen kann, ist mehr wert als eine vollständige.
 *
 *  Der leere Zustand ist der wichtigste — «nichts gewählt» MUSS sagen, dass
 *  trotzdem alles durchsucht wird, sonst liest sich der Zwischenschritt beim
 *  Umstellen wie ein Defekt.
 */
const MAX_NAMEN = 3;
const nenne = (list) => list.length <= MAX_NAMEN
  ? esc(list.join(', '))
  : `${esc(list.slice(0, MAX_NAMEN).join(', '))} und ${list.length - MAX_NAMEN} weitere`;

function sourcesTrigger() {
  const off = sources.offList();
  const an = sources.onList();
  const total = sources.kinds().length;
  const ohneAntwort = on('answers') && !sources.isOn(sources.ANSWERS);
  let text;
  if (sources.isEmpty()) text = 'Keine Inhaltsart gewählt — es wird alles durchsucht.';
  else if (!off.length) text = 'Durchsucht alle Inhaltsarten.';
  else if (an.length <= off.length) text = `<strong>Nur ${nenne(an)}.</strong>`;
  else text = `<strong>${an.length} von ${total} Inhaltsarten</strong> · ohne ${nenne(off)}.`;
  return `<p class="sources-line">
    <button type="button" class="sources-line__toggle" id="sources-toggle"
      aria-expanded="${PANEL_OPEN}" aria-controls="sources-panel">
      <span class="sources-line__text">${text}${ohneAntwort ? ' Ohne KI-Antworten.' : ''}</span>
      ${/* Aktion und Pfeil in EINEM Element: als Geschwister brach der Pfeil
            allein in die nächste Zeile, sobald der Satz umlief. */''}
      <span class="sources-line__action">${off.length || ohneAntwort ? 'Ändern' : 'Auswählen'}${
        icon('ChevronDown', 'sources__chev')}</span>
    </button></p>`;
}

// EIN Element, nicht zwei. Als Auslöser und Panel Geschwister waren, bekam im
// Hero JEDES von beiden den Spaltenabstand von .hero__content (2rem) — die Zeile
// stand 2rem unter dem Feld und das Panel nochmals 2rem unter der Zeile, während
// dieselbe Zeile auf der Trefferseite 8px unter dem Feld klebte. Zusammengefasst
// gilt der Abstand einmal für das ganze Bauteil, und der innere Rhythmus gehört
// dem Bauteil selbst.
const sourcesControl = () => on('sources')
  ? `<div class="sources">${sourcesTrigger()}${sourcesPanel()}</div>`
  : '';

/** Verkabelung, geteilt von Startseite und Trefferseite. */
function wireSources(mount, nav) {
  const toggle = mount.querySelector('#sources-toggle');
  const panel = mount.querySelector('#sources-panel');
  if (!toggle || !panel) return;
  toggle.addEventListener('click', () => {
    PANEL_OPEN = panel.hidden;
    panel.hidden = !PANEL_OPEN;
    toggle.setAttribute('aria-expanded', String(PANEL_OPEN));
  });
  panel.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-source]');
    if (!cb) return;
    RESTORE_FOCUS = cb.id;
    sources.toggle(cb.dataset.source);   // löst das Neuzeichnen aus
  });
  // Nicht nur im Panel: «Alle einschalten» steht auch im Nichts-gefunden-Hinweis,
  // wo es am dringendsten gebraucht wird.
  mount.querySelectorAll('[data-sources-all]').forEach((b) => b.addEventListener('click', () => {
    RESTORE_FOCUS = 'sources-toggle';
    sources.enableAll();
  }));
  // Nach «Alle abwählen» geht der Fokus ins Panel, nicht auf die Zeile: der
  // nächste Schritt ist fast immer das Ankreuzen einer einzelnen Inhaltsart.
  mount.querySelectorAll('[data-sources-none]').forEach((b) => b.addEventListener('click', () => {
    RESTORE_FOCUS = 'src-0';
    sources.disableAll();
  }));
}

/** Nach dem Neuzeichnen den Fokus dorthin zurück, wo er war (WCAG 2.4.3). */
function restoreFocus(mount) {
  if (!RESTORE_FOCUS) return;
  const el = mount.querySelector('#' + RESTORE_FOCUS);
  RESTORE_FOCUS = '';
  if (el && !el.disabled) el.focus({ preventScroll: true });
  else mount.querySelector('#sources-toggle')?.focus({ preventScroll: true });
}

/* ============================================================ STARTSEITE == */
// Anatomie wie js/pages/home.js: CD `hero--main-image`, Inhalt links, Bild
// rechts im selben Raster. Die Suchzeile besetzt den CTA-Platz.
export function renderHome(mount, nav) {
  mount.innerHTML = `
    <div class="container section">
      <div class="hero hero--main-image">
        <div class="hero__content">
          <h1 class="hero__title" tabindex="-1">Willkommen im BBL Kundenportal</h1>
          <p class="hero__description">Dienstleistungen, Anwendungen, Dokumente und Daten des
            Bundesamts für Bauten und Logistik — an einem Ort.</p>
          ${/* Feld und Quellenauswahl gehören zusammen und zählen deshalb als EIN
                Kind von .hero__content — sonst legt sich dessen Spaltenabstand
                zwischen sie und macht aus einer Beschriftung einen Absatz. */''}
          <div class="hero__search">
          <form class="home-search" id="home-search" role="search">
            <label class="sr-only" for="home-q">Im Portal suchen</label>
            ${/* Das Feld bekommt eine eigene Box, damit das Vorschlagsfeld an IHM
                  hängt und nicht an der Zeile aus Feld PLUS Knopf. */''}
            <span class="home-search__field">
              <input id="home-q" type="search" autocomplete="off"
                placeholder="Wonach suchen Sie? z. B. Störung, Raumbedarf, Bauprojekt…">
            </span>
            <button class="btn btn--filled btn--lg btn--icon-left" type="submit">${
              icon('Search', 'btn__icon')}<span class="btn__text">Suchen</span></button>
          </form>
          ${sourcesControl()}
          </div>
        </div>
        <div class="hero__image">
          <figure class="hero__figure">
            <img src="../../../assets/images/BBL-FE21_O-01-800.webp"
                 srcset="../../../assets/images/BBL-FE21_O-01-800.webp 800w,
                         ../../../assets/images/BBL-FE21_O-01-1400.webp 1400w"
                 sizes="(min-width:768px) 46vw, 92vw" width="2048" height="1258"
                 alt="Der Hauptsitz des BBL an der Fellerstrasse 21 von aussen"
                 loading="eager" decoding="async">
            <figcaption>Der Hauptsitz des BBL an der Fellerstrasse 21 von aussen — © BBL</figcaption>
          </figure>
        </div>
      </div>
    </div>`;

  const form = mount.querySelector('#home-search');
  const input = mount.querySelector('#home-q');
  detachSuggest = attachSuggest(input, form, {
    onSubmitQuery: (q) => nav.search(q),
    onOpenRoute: (href, external) => nav.route(href, external),
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) nav.search(q);
  });
  wireSources(mount, nav);
  restoreFocus(mount);
}

/* ========================================================== ANTWORTBLOCK == */
// SIMULIERT, NICHT GENERIERT — der Fusstext sagt das, und der Block darf nie
// aussehen, als sagte er es nicht.
// Die Marke sitzt am Kopf und gilt für ALLE Zustände des Blocks — auch für den
// Ruhezustand, in dem noch nichts dasteht. Wer den Block sieht, weiss, woran er
// ist, bevor der erste Satz erscheint.
const kopf = (titel) => `<p class="answer__head">
    <span class="answer__title">${esc(titel)}</span>
    ${badge('Simuliert', 'blue')}</p>`;

function answerHtml(res, trefferZahl) {
  // Die Marke «Simuliert» am Kopf und die Studien-Leiste sagen bereits, dass hier
  // kein Sprachmodell schreibt. Unten steht deshalb nur noch der Satz, den auch
  // ein fertiges Produkt trüge — der Rest war Erklärung an die Lesenden dieser
  // Studie, nicht an die Benutzenden der Suche.
  const fuss = `<div class="answer__foot">
      <span class="legend">Automatisch erstellt und kann Fehler enthalten. Massgebend sind die verlinkten Quellen.</span>
      <button class="answer__off" type="button" data-answers-off>KI-Antworten ausblenden</button>
    </div>`;

  if (res.state === 'none') {
    // «Keine Antwort» ist ein ERFOLGSZUSTAND, kein Fehler — und der Text darf
    // nicht auf Treffer verweisen, die es nicht gibt.
    const satz = trefferZahl > 0
      ? 'Die Treffer unten stammen aus der Stichwortsuche.'
      : 'Auch die Stichwortsuche findet dazu nichts im Portal.';
    return `<div class="notification notification--hint answer-slot">${icon('SpeechBubble', 'notification__icon')}
      <div class="notification__content">
        ${kopf('Keine KI-Antwort')}
        <p>Zu dieser Frage wurde im Portal nichts Passendes gefunden. ${satz}</p>
        ${fuss}
      </div></div>`;
  }

  // Ein Abschnitt OHNE Beleg wird nicht gezeichnet. Der Renderer setzt das
  // durch — nicht der Text, der ihn geliefert hat. Genau diese Eigenschaft muss
  // später erzwungen werden, statt sie dem Prompt zu glauben.
  const abschnitte = res.abschnitte.filter((a) => Number.isInteger(a.beleg) && a.beleg > 0
    && res.quellen[a.beleg - 1]);
  if (!abschnitte.length) return answerHtml({ state: 'none', plan: res.plan }, trefferZahl);

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

  return `<div class="notification notification--hint answer-slot">${icon('SpeechBubble', 'notification__icon')}
    <div class="notification__content">
      ${kopf('KI-Antwort')}
      ${saetze}
      ${quellen}
      ${fuss}
    </div></div>`;
}

/** RUHEZUSTAND. Der Block steht auch dort, wo es nichts zu antworten gibt —
 *  bei einer Stichwortsuche. Zwei Gründe, und der zweite ist der wichtigere:
 *
 *  1. Der Platz bleibt reserviert. Erschiene der Block nur bei Fragen, spränge
 *     die Trefferliste je nach Eingabe um seine Höhe nach unten.
 *  2. Er sagt, WANN er etwas beiträgt. Die Auslösebedingung (ganze Frage, nicht
 *     Stichwort) ist sonst unsichtbar: Wer nie eine Frage tippt, erfährt nie,
 *     dass er eine tippen könnte — und das ist genau die Lücke, an der diese
 *     Studie ansetzt.
 *
 *  Deshalb steht hier ein Weg und keine Werbung: die vier Beispiele sind
 *  anklickbar und führen zu Fragen, die diese Studie wirklich beantwortet. */
function idleHtml() {
  return `<div class="notification notification--hint answer-slot answer-slot--idle">${
    icon('SpeechBubble', 'notification__icon')}
    <div class="notification__content">
      ${kopf('KI-Antwort')}
      <p class="muted">Stellen Sie eine ganze Frage, und hier steht eine Antwort —
        jeder Satz mit Beleg aus den Treffern.</p>
      ${/* Anführungszeichen INNERHALB des Verweises: vier unterstrichene Fragen
            nebeneinander lasen sich als ein einziger langer Strich, und wo die
            eine aufhörte und die nächste anfing, war nicht zu sehen. Die «…»
            begrenzen jede für sich — und es ist dieselbe Schreibweise, in der
            die Studie sonst Abfragen zitiert. */''}
      <p class="answer__examples">${BEISPIELE.map((b) =>
        `<a href="#/search?q=${encodeURIComponent(b)}">«${esc(b)}»</a>`).join('')}</p>
      <div class="answer__foot">
        <button class="answer__off" type="button" data-answers-off>KI-Antworten ausblenden</button>
      </div>
    </div></div>`;
}

/* ========================================================= TREFFERSEITE === */
// Portal js/pages/search.js `noResults`: den Suchbegriff wiederholen, dann
// Tipps und ein Kontakthinweis. Die Rückfragen ergänzen begriffsweise Versuche
// — «vorlage vertrag xyz» findet nichts, «vorlage» schon. Das kostet weniger
// als eine Rechtschreibkorrektur und deckt den häufigsten Fall ab: einen
// einschränkenden Begriff zu viel.
function noResults(rawQ, rows) {
  const words = fold(rawQ).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const alt = words.length > 1
    ? words.map((w) => ({ w, n: search(rows, w).length })).filter((x) => x.n)
    : [];
  return `
    <div class="search-results__no-results">
      <h2 class="text--xl">Die Suche nach <strong>«${esc(rawQ)}»</strong> ergab keine Treffer.</h2>
      ${alt.length ? `<h3>Einzelne Begriffe führen weiter</h3><ul class="list--default">${
        alt.map((x) => `<li><a href="#/search?q=${encodeURIComponent(x.w)}">${esc(x.w)}</a> — ${x.n} Treffer</li>`).join('')
      }</ul>` : ''}
      <h3>Tipps zur Suche</h3>
      <ul class="list--default">
        <li>Überprüfen Sie die Schreibweise Ihres Suchbegriffs.</li>
        <li>Verwenden Sie einen anderen oder allgemeineren Begriff.</li>
        <li>Verwenden Sie weniger Suchbegriffe — es müssen alle vorkommen.</li>
      </ul>
      ${notification(`<p><strong class="text--bold">Nicht gefunden, wonach Sie suchen?</strong><br>
        Wenden Sie sich an die zuständige Stelle oder öffnen Sie die
        <a href="#/services">Dienstleistungen</a>.</p>`, 'info')}
    </div>`;
}

export function renderResults(mount, query, nav) {
  const rows = index();
  const state = catalogueState(query, {
    base: '#/search', perPage: 10, sortOpts: ['title', 'kind'],
    defaultView: 'list', filters: { kind: null },
  });
  const rawQ = state.q;

  /* --- Retrieval. ZWEI GETRENNTE FUNKTIONEN, und das ist der Entscheid hinter
     diesen Zeilen:

       Frageauflösung  → verbessert die TREFFER   (Schalter «resolve»)
       Antwortbau      → erzeugt den BLOCK        (Schalter «answers»)

     Als beides am selben Schalter hing, leerte «Antworten aus» auch die
     Trefferliste: die wörtliche Suche findet zu einer Frage nichts (0 Treffer,
     gemessen). Wer die Antworten abschaltet, will keine Antwort — keine
     kaputte Suche. --- */
  // Die Quellenauswahl wirkt VOR der Suche, nicht danach. Das ist der billigere
  // Weg und der einzige, der sich auf eine echte Datenbank übertragen lässt:
  // dort wird sie zur WHERE-Klausel. Erst suchen und dann wegwerfen hiesse, die
  // volle Menge zu holen, um sie zu verkleinern.
  const pool = sources.filterRows(rows);
  const direkt = rawQ ? search(pool, rawQ) : [];
  const frage = rawQ ? isQuestion(rawQ) : false;
  const p = rawQ ? plan(rawQ) : { keywords: [], dropped: [], queries: [] };

  // `build()` läuft nur, wenn es gebraucht wird — die Rückfallebenen kosten
  // mehrere Durchläufe über den ganzen Index.
  const gebaut = rawQ && frage && (on('resolve') || on('answers')) ? build(rawQ) : null;

  // Die Relevanzschranke (js/answer.js) entscheidet, OB die Frage verstanden
  // wurde — nicht, wie viel danach gezeigt wird. Beide Seiten brauchen anderes:
  //
  //   Antwort → nur `strong`. Ein Satz mit Beleg BEHAUPTET etwas; er darf sich
  //             nicht auf einen Einzelwort-Zufallstreffer stützen.
  //   Liste   → alle Treffer, sobald überhaupt etwas Starkes dabei war. Eine
  //             Liste behauptet nichts, sie BIETET AN; Verwandtes ist dort
  //             brauchbar. Auf `strong` verengt schrumpfte «defekte Heizung»
  //             von 20 auf 2 Zeilen — Präzision am falschen Ort.
  //
  // Ist NICHTS stark, war die Frage nicht verstanden: dann fällt die Liste auf
  // die wörtliche Suche zurück und zeigt lieber nichts als Beliebiges.
  const aufgeloest = on('resolve') && gebaut && gebaut.strong.length;
  const hits = aufgeloest ? gebaut.hits : direkt;
  const total = hits.length;

  // Zwei Bedingungen, zwei Ebenen: der Schalter sagt, ob es die Funktion in
  // dieser Konfiguration GIBT, die Quellenauswahl, ob jemand sie WILL.
  // Der Block ist AN, sobald jemand eine Abfrage gestellt hat — nicht nur bei
  // Fragen. Was er zeigt, hängt davon ab, ob es etwas zu zeigen gibt.
  const antwortAn = !!rawQ && on('answers') && sources.answersAllowed();
  const res = antwortAn && gebaut ? gebaut : null;

  // Protokoll: mit Schalterzustand, damit «0» aus dem Portalzustand und «20»
  // aus dem Studienzustand nicht als Widerspruch desselben Begriffs dastehen.
  // Ohne den Quellenzustand stünde «3 Treffer» neben «22 Treffer» für denselben
  // Begriff — genau der Widerspruch, den die Spalte «Zustand» schon einmal
  // aufgelöst hat.
  const ratio = sources.ratio();
  if (rawQ) logQuery(rawQ, total, (aufgeloest ? 'aufgelöst' : 'wörtlich') + (ratio ? ` · ${ratio} Quellen` : ''));

  /* --- Liegt es an der Auswahl? NUR im Nullfall gefragt, und als JA/NEIN.
     Eine dauerhafte, stille Voreinstellung wird irgendwann die richtige
     Antwort verschlucken — das ist der eine Fehler, den dieses Bauteil machen
     kann. Der Ausweg darf aber nichts kosten:

       · Im Normalfall wird GAR NICHT nachgezählt. Was fehlt, steht ohnehin
         beim Feld — die Zeile nennt die abgewählten Arten beim Namen, und das
         ist aus dem localStorage gelesen, nicht aus dem Index gerechnet.
       · Erst wenn null Treffer herauskommen, wird EINMAL nachgefragt, und zwar
         «gibt es überhaupt welche?», nicht «wie viele?». Auf einer echten
         Datenbank ist das ein LIMIT 1, keine Aggregation.

     Der Nullfall ist auch der einzige Moment, in dem die Zahl etwas ändern
     würde: solange Treffer da sind, sucht niemand nach einer Erklärung. --- */
  const activeSources = sources.active();
  let hiddenElsewhere = false;
  if (rawQ && !total && activeSources) {
    const excluded = rows.filter((r) => !activeSources.has(r.kind));
    hiddenElsewhere = search(excluded, rawQ).length > 0;   // EXISTS-Semantik
  }

  /* --- Facetten aus den TREFFERN, nicht aus dem Index: sonst stünden leere
     Kontrollkästchen im Panel. Weil `pool` bereits gefiltert ist, kann hier
     keine abgewählte Quelle auftauchen — die beiden Bedienelemente können sich
     also gar nicht widersprechen, ohne dass es dafür eine Sonderregel braucht. --- */
  const counts = new Map();
  for (const r of hits) counts.set(r.kind, (counts.get(r.kind) || 0) + 1);
  const kindOptions = [...counts.entries()]
    .sort((a, b) => KIND_ORDER.indexOf(a[0]) - KIND_ORDER.indexOf(b[0]))
    .map(([kind, count]) => ({ value: kind, label: `${kind} (${count})` }));

  const selectedKinds = state.selected.kind.filter((k) => counts.has(k));
  const filtered = hits.filter((r) => !selectedKinds.length || selectedKinds.includes(r.kind));

  const SORT_OPTIONS = [
    { value: 'title', label: 'Titel (A–Z)' },
    { value: 'kind', label: 'Inhaltsart' },
  ];
  const SORTS = {
    title: (a, b) => String(a.title).localeCompare(String(b.title), 'de'),
    kind: (a, b) => String(a.kind).localeCompare(String(b.kind), 'de') || b._score - a._score,
  };
  // Ohne ausdrückliche Sortierung gilt die Punktzahl der Suchmaschine;
  // search() liefert bereits Relevanzreihenfolge.
  const sorted = state.sort ? filtered.slice().sort(SORTS[state.sort]) : filtered;
  const { visible, totalPages, page } = state.clamp(sorted);

  const bar = catbar({
    countId: 'sr-count',
    count: `<strong>${sorted.length}</strong> von ${total} Treffern für «${esc(rawQ)}»${
      totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : ''}`,
    sort: { id: 'sr-sort', label: 'Sortierung', value: state.sort, options: SORT_OPTIONS },
    filterId: 'sr-filter', filterCount: selectedKinds.length,
    panelId: 'sr-filters',
    panel: filterGroup({ dim: 'kind', legend: 'Inhaltsart', selected: selectedKinds, options: kindOptions })
      + panelReset(state.hash({ kind: [], page: 1 })),
    panelHidden: !selectedKinds.length,
    view: state.view, views: [['list', 'Listenansicht', 'List'], ['gallery', 'Galerieansicht', 'Apps']],
  });

  const pills = activeFilters({
    filters: selectedKinds.map((kind) => ({
      label: kind, href: state.hash({ kind: selectedKinds.filter((x) => x !== kind), page: 1 }) })),
    resetHref: state.hash({ kind: [], page: 1 }),
  });

  /* --- Plan-Notiz. Diagnose der STUDIE, nicht des Portals: sie erscheint nur,
     wenn ein Schalter an ist, und nennt BEIDE Zahlen. Das Portal zeigt keine
     Diagnose, es zeigt Treffer.
     Sie erscheint auch, wenn NUR «Antworten» an ist. Sonst stünde dort ein
     belegter Antwortblock über einer leeren Liste, und die Quellen sähen
     erfunden aus — dabei ist die Erklärung banal: der Antwortbau löst die Frage
     selbst auf, die Liste tut es nur mit ihrem eigenen Schalter. --- */
  const zeigeNote = frage && p.keywords.length && (on('resolve') || on('answers'));
  const nachAufloesung = gebaut ? gebaut.hits.length : direkt.length;
  const planNote = zeigeNote ? `
    <p class="plan-note">Wörtliche Stichwortsuche: <strong>${direkt.length}</strong> Treffer ·
      nach Frageauflösung (<code>${esc(p.keywords.join(' '))}</code>):
      <strong>${nachAufloesung}</strong> Treffer${
        p.dropped.length ? ` · entfernt: <code>${esc(p.dropped.join(' '))}</code>` : ''}${
        !on('resolve')
          ? ' · <strong>Die Liste bleibt wörtlich</strong>, weil «Frageauflösung» aus ist — die KI-Antwort löst die Frage für sich auf.'
          : !aufgeloest && gebaut
            ? ' · nichts Starkes gefunden, die Liste bleibt wörtlich'
            : ''}</p>` : '';

  const listView = (items) => `<ul class="search-results-list">${items.map(resultRow).join('')}</ul>`;
  const galleryView = (items) => `<div class="grid grid--responsive-cols-3 gap--top">${items.map(card).join('')}</div>`;

  const body = !rawQ
    ? `<p class="muted">Geben Sie einen Suchbegriff ein — zum Beispiel «Störung», «Mustervorlage»
        oder «Guisanplatz». Durchsucht werden ${rows.length} Einträge aus Dienstleistungen,
        Anwendungen, Wissen und Hilfsmitteln, Datensätzen, Datentabellen, Prozessen,
        Geschäftsobjekten, Dokumenten, News, Liegenschaften und Bauprojekten.</p>`
    : total
      ? `${bar}${pills}${planNote}
         <section>
           <h2 class="sr-only">Treffer</h2>
           ${sorted.length
             ? (state.view === 'list' ? listView(visible) : galleryView(visible))
               + pagination({ page, totalPages, inputId: 'sr-page',
                   label: 'Seitennavigation Suchergebnisse', href: (n) => state.hash({ page: n }) })
             : empty('Keine Treffer für diese Filter.', { hint: 'Passen Sie Ihre Suche oder die Filter an.' })}
         </section>`
      : `${planNote}${hiddenElsewhere ? notification(
            `<p><strong class="text--bold">Ihre Quellenauswahl blendet Treffer aus.</strong>
             Ohne <code>${esc(sources.offList().join(', '))}</code> findet diese Suche nichts —
             mit allen Inhaltsarten gäbe es Treffer.</p>
             <p><button type="button" class="btn btn--outline btn--sm" data-sources-all><span
               class="btn__text">Alle Quellen einschalten</span></button></p>`, 'warning') : ''
        }${noResults(rawQ, pool)}`;

  mount.innerHTML = `
    <section class="section section--default bg--secondary-50">
      <div class="container">
        <h1 tabindex="-1">Suche</h1>
        ${searchForm('search-page-form', 'search-page-input', rawQ, 'Suchen…', 'search--page-result')}
        ${/* Beide Bauformen sitzen hier UNTER dem Feld: die Trefferseite hat
              keine Knopfzeile wie der Hero, und für den Vergleich der beiden
              zählt der Hero. */''}
        ${sourcesControl()}
      </div>
    </section>
    <section class="section section--default">
      <div class="container">
        <div class="search-results">
          ${!antwortAn ? '' : res ? answerHtml(res, total) : idleHtml()}
          ${body}
        </div>
      </div>
    </section>`;

  /* ------------------------------------------------------------ Verkabeln */
  const form = mount.querySelector('#search-page-form');
  const input = mount.querySelector('#search-page-input');
  detachSuggest = attachSuggest(input, form, {
    onSubmitQuery: (nq) => nav.search(nq),
    onOpenRoute: (href, external) => nav.route(href, external),
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    nav.go(v ? `#/search?q=${encodeURIComponent(v)}` : '#/search');
  });

  const sortSel = mount.querySelector('#sr-sort');
  if (sortSel) sortSel.addEventListener('change', () => nav.go(state.hash({ sort: sortSel.value, page: 1 })));

  // Das Panel bleibt offen, sobald es geöffnet wurde — ein Filterpanel, das
  // nach jedem Klick zuklappt, zwingt zu einem Klick je Facette.
  const fbtn = mount.querySelector('#sr-filter');
  const fpanel = mount.querySelector('#sr-filters');
  if (fbtn && fpanel) fbtn.addEventListener('click', () => {
    const open = fpanel.hidden;
    fpanel.hidden = !open;
    fbtn.setAttribute('aria-expanded', String(open));
  });
  if (fpanel) fpanel.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-fdim]');
    if (!cb) return;
    const next = cb.checked
      ? [...selectedKinds, cb.value]
      : selectedKinds.filter((k) => k !== cb.value);
    nav.go(state.hash({ kind: next, page: 1 }));
  });

  const vs = mount.querySelector('.view-switch');
  if (vs) vs.addEventListener('click', (e) => {
    const b = e.target.closest('.view-switch__btn');
    if (b) nav.go(state.hash({ view: b.dataset.view, page: 1 }));
  });

  // Blätterfeld: Eingabe springt auf die Seite, wie C.wirePagination im Portal.
  const pageInput = mount.querySelector('#sr-page');
  if (pageInput) pageInput.addEventListener('change', () => {
    const n = Number.parseInt(pageInput.value, 10);
    if (Number.isFinite(n) && n >= 1 && n <= totalPages) nav.go(state.hash({ page: n }));
    else pageInput.value = String(page);
  });

  // Der Ausschalter am Block trifft die Ebene, die gerade erreichbar ist: mit
  // Quellenauswahl die Vorliebe (im Panel wieder einschaltbar), ohne sie den
  // Schalter — sonst läge die Wahl in einem Panel, das gar nicht existiert.
  const off = mount.querySelector('[data-answers-off]');
  if (off) off.addEventListener('click', () => {
    if (on('sources')) sources.toggle(sources.ANSWERS);
    else setSwitch('answers', false);
  });

  wireSources(mount, nav);
  restoreFocus(mount);

  // EINMALIGE Ansage über die dauerhafte Live-Region, nicht Wort für Wort:
  // sonst unterbricht der Screenreader bei jedem Zeichen.
  const hinweis = hiddenElsewhere ? ' Ihre Quellenauswahl blendet Treffer aus.' : '';
  announce(!rawQ ? 'Suchbegriff eingeben'
    : res && res.state === 'answer'
      ? `KI-Antwort verfügbar, ${res.quellen.length} Quellen. ${total} Treffer für ${rawQ}.`
      : total ? `${total} Treffer für ${rawQ}` : `Keine Treffer für ${rawQ}.${hinweis}`);
}

/* ======================================================= SUCHPROTOKOLL === */
// Portal js/pages/search.js `logView`, erreichbar unter #/search?log=1.
export function renderLog(mount, nav) {
  const { rows, total, zero } = logSummary();
  const body = rows.length
    ? table({
        caption: 'Suchbegriffe dieses Geräts',
        zebra: true,
        columns: [
          { key: 'q', label: 'Suchbegriff',
            render: (r) => `<a href="#/search?q=${encodeURIComponent(r.q)}">${esc(r.q)}</a>` },
          { key: 'mode', label: 'Zustand',
            render: (r) => r.mode ? esc(r.mode) : '—' },
          { key: 'count', label: 'Anfragen', align: 'right',
            render: (r) => esc(String(r.count)) },
          { key: 'hits', label: 'Treffer', align: 'right',
            render: (r) => r.hits === 0 ? badge('0 Treffer', 'red') : esc(String(r.hits)) },
        ],
        rows,
      })
    : '<p class="muted">Noch keine Suchanfragen auf diesem Gerät protokolliert.</p>';

  mount.innerHTML = `
    <section class="section section--default">
      <div class="container">
        <h1 tabindex="-1">Suchprotokoll</h1>
        <p class="muted">${total} Anfragen, ${rows.length} verschiedene Kombinationen aus Begriff und
          Zustand, davon <strong>${zero} ohne Treffer</strong>. Index: ${index().length} Einträge.</p>
        ${notification(`<p>Nur auf diesem Gerät gespeichert (localStorage), ohne Kennung und ohne
          Übertragung — ein Notizblock, kein Tracking. Er beantwortet die Frage, welche Begriffe ins
          Leere laufen. Die Spalte <strong class="text--bold">Zustand</strong> hält fest, ob mit oder
          ohne Frageauflösung gemessen wurde; ohne sie stünden beide Messungen desselben Begriffs als
          Widerspruch nebeneinander. <a href="#/search">Zurück zur Suche</a></p>`, 'info')}
        ${body}
        <div class="mt-4"><button class="btn btn--outline btn--sm btn--icon-left" type="button" id="log-clear">${
          icon('Trash', 'btn__icon')}<span class="btn__text">Protokoll löschen</span></button></div>
      </div>
    </section>`;

  mount.querySelector('#log-clear').addEventListener('click', () => { logClear(); nav.redraw(); });
  announce(`Suchprotokoll: ${rows.length} Einträge, ${zero} ohne Treffer.`);
}
