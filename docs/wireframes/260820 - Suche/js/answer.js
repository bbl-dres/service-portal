// Antwortbau — SIMULIERT, NICHT GENERIERT.
//
// Eine statische Seite kann keinen Modellschlüssel tragen, und ein Prototyp
// soll nicht so tun als ob. Hier setzt sich die Antwort deterministisch aus den
// Beschreibungstexten der WIRKLICH gefundenen Datensätze zusammen. Jeder Satz
// stammt aus genau einem Datensatz und trägt dessen Beleg.
//
// Das ist keine Notlösung, sondern die Probe aufs Exempel: Genau diese
// Eigenschaft — kein Satz ohne Beleg — muss der Renderer später erzwingen,
// statt sie dem Prompt zu glauben. Was hier unmöglich ist (ein unbelegter
// Satz), muss dort unmöglich gemacht werden.
//
// Nicht bewiesen wird die Antwortqualität. Bewiesen wird die FORM.

import { search } from '../../../../js/search/search-engine.js';
import { index } from './data.js';
import { plan } from './query.js';

const MAX_QUELLEN = 3;

/** Alle Planabfragen durchlaufen, Treffer vereinigen, nach href entdoppeln.
 *  `tier` merkt sich, aus welcher Planstufe ein Treffer stammt: 0 ist die
 *  vollständige Stichwortabfrage, alles darüber eine Rückfallebene. Für die
 *  TREFFERLISTE zählen alle; für die QUELLEN einer Antwort nur die beste
 *  Stufe — sonst zieht eine Einzelwort-Rückfallebene beliebig Verwandtes
 *  herein und die Antwort redet über etwas anderes als die Frage. */
export function retrieve(raw) {
  const p = plan(raw);
  const rows = index();
  const seen = new Set();
  const hits = [];
  p.queries.forEach((q, tier) => {
    if (hits.length >= 20) return;
    const words = q.split(' ').length;
    for (const r of search(rows, q)) {
      if (seen.has(r.href)) continue;
      seen.add(r.href);
      hits.push(Object.assign(Object.create(Object.getPrototypeOf(r)), r,
        { _tier: tier, _qWords: words }));
    }
  });
  // RELEVANZSCHRANKE. Eine Einzelwort-Rückfallebene findet IMMER etwas: das
  // UND greift bei einem Wort nicht mehr. «Wie viele Ferientage stehen mir zu?»
  // lieferte darüber eine sauber belegte Antwort über Mietobjekte — der
  // gefährlichste Fehler, den dieses Bauteil machen kann, weil er sich richtig
  // liest. Zählen darf deshalb nur, was von einer MEHRWORT-Abfrage kam; sonst
  // hat der Retriever die Frage nicht verstanden und die Antwort entfällt.
  const minWords = p.keywords.length >= 2 ? 2 : 1;
  const strong = hits.filter((h) => h._qWords >= minWords);
  return { plan: p, hits, strong };
}

/** Zwei Texte sagen dasselbe? Der Portal-Ablauf übernimmt oft den Beschrieb
 *  seiner Dienstleistung wörtlich; zwei Sätze mit demselben Inhalt und zwei
 *  verschiedenen Belegen lesen sich wie zwei Aussagen, sind aber eine. */
function saysTheSame(a, b) {
  const t = (s) => new Set(String(s || '').toLowerCase()
    .split(/[^a-zäöüß0-9]+/i).filter((w) => w.length > 3));
  const A = t(a); const B = t(b);
  if (!A.size || !B.size) return false;
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / Math.min(A.size, B.size) >= 0.6;
}

/** Ein Satz endet mit genau einem Punkt. */
const satz = (s) => {
  const clean = String(s || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return /[.!?]$/.test(clean) ? clean : clean + '.';
};

/**
 * Antwort bauen. Rückgabe:
 *   { state:'answer', abschnitte:[{text, beleg}], quellen:[{n,titel,art,href}], plan }
 *   { state:'none', plan }
 *
 * `beleg` ist immer eine Zahl — ein Abschnitt ohne Beleg entsteht hier gar
 * nicht erst, und der Renderer prüft es trotzdem noch einmal.
 */
export function build(raw) {
  const { plan: p, hits, strong } = retrieve(raw);
  if (!p.keywords.length || !strong.length) return { state: 'none', plan: p, hits, strong };

  // Quellen NUR aus der besten Planstufe, die überhaupt etwas gefunden hat.
  // Danach: der beste Treffer, dann bis zu zwei weitere aus ANDEREN
  // Inhaltsarten, und keiner, der dasselbe sagt wie ein schon gewählter.
  const bestTier = Math.min(...strong.map((h) => h._tier ?? 0));
  const kandidaten = strong.filter((h) => (h._tier ?? 0) === bestTier);
  const quellen = [];
  const kinds = new Set();
  for (const h of kandidaten) {
    if (quellen.length >= MAX_QUELLEN) break;
    if (quellen.length && kinds.has(h.kind)) continue;
    if (quellen.some((q) => saysTheSame(q.answerText, h.answerText))) continue;
    kinds.add(h.kind);
    quellen.push(h);
  }

  const abschnitte = [];
  const beleg = (row) => quellen.indexOf(row) + 1;

  const erste = quellen[0];
  if (erste.answerText) {
    abschnitte.push({ text: satz(erste.answerText), beleg: beleg(erste) });
  }
  // Voraussetzungen sind das, was jemand VOR dem Start wissen muss — die
  // nützlichste zweite Zeile, die eine Dienstleistung hergibt.
  if (Array.isArray(erste.requires) && erste.requires.length) {
    abschnitte.push({
      text: satz(`Bereit halten müssen Sie ${erste.requires.join(', ')}`),
      beleg: beleg(erste),
    });
  }
  for (const q of quellen.slice(1)) {
    if (!q.answerText) continue;
    abschnitte.push({ text: satz(q.answerText), beleg: beleg(q) });
  }

  if (!abschnitte.length) return { state: 'none', plan: p, hits, strong };

  return {
    state: 'answer',
    plan: p,
    hits,
    strong,
    abschnitte,
    quellen: quellen.map((r, i) => ({
      n: i + 1, titel: r.title, art: r.type, meta: r.meta || '', href: r.href,
    })),
  };
}
