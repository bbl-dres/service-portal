// Vorschläge zur Hero-Suche — gruppiert, mit Trefferhervorhebung.
//
// VORBILD: map.geo.admin.ch. Dort trennen Abschnittsköpfe («Gehe nach …»,
// «Karte hinzufügen …») die Trefferarten, statt sie über einen Filterknopf
// eingrenzen zu lassen. Das ist die bessere Antwort auf «ich will nur
// Dienstleistungen sehen»: die Gliederung ist schon da, bevor jemand ein
// Bedienelement suchen muss — und sie kostet keinen Klick.
//
// DREI ZUSTÄNDE, und der erste ist der wichtigste:
//   leer      → Beispiele. Das Feld zeigt, was man es fragen kann.
//   getippt   → Gruppen mit hervorgehobenem Treffer.
//   Frage     → zusätzlich die Aktionszeile «als Frage stellen».
//
// Die Aktionszeile steht AUSSERHALB der role="listbox"-Liste. Eine Option darf
// keine Prosa und keine Verweise enthalten; wer sie hineinlegt, bricht den
// Options-Vertrag und macht sie für Screenreader unbedienbar.

import { search } from '../../../../js/search/search-engine.js';
import { index, KIND_ORDER } from './data.js';
import { isQuestion } from './query.js';

const MAX_PRO_GRUPPE = 4;
const MAX_TOTAL = 10;

// Beispiele. Echte Fragen, die dieser Prototyp wirklich beantwortet — eine
// Beispielzeile, die ins Leere führt, wäre schlimmer als keine.
export const BEISPIELE = [
  'Wie melde ich eine defekte Heizung?',
  'Kann ich einen Sitzungsraum reservieren?',
  'Was brauche ich für eine IKT-Beschaffung?',
  'Wo finde ich die Pläne eines Gebäudes?',
];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Treffer im Titel markieren. Bewusst auf dem ROHTEXT und ohne Faltung: Die
// Suchmaschine faltet «ä→ae», wodurch sich Zeichenlängen verschieben und eine
// Rückabbildung auf den Originaltitel nur raten könnte. Lieber gar nicht
// hervorheben als an der falschen Stelle.
function highlight(title, terms) {
  const raw = String(title || '');
  if (!terms.length) return esc(raw);
  const spans = [];
  for (const t of terms) {
    if (t.length < 2) continue;
    const needle = t.toLowerCase();
    let from = 0;
    const hay = raw.toLowerCase();
    for (;;) {
      const at = hay.indexOf(needle, from);
      if (at < 0) break;
      spans.push([at, at + needle.length]);
      from = at + needle.length;
    }
  }
  if (!spans.length) return esc(raw);
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([...s]);
  }
  let out = '';
  let cursor = 0;
  for (const [a, b] of merged) {
    out += esc(raw.slice(cursor, a)) + '<mark>' + esc(raw.slice(a, b)) + '</mark>';
    cursor = b;
  }
  return out + esc(raw.slice(cursor));
}

const terms = (q) => String(q || '').toLowerCase()
  .split(/[^a-zäöüßà-ÿ0-9]+/i).filter((w) => w.length > 1);

/** Treffer nach Inhaltsart gruppieren, in der Reihenfolge aus KIND_ORDER. */
function group(hits) {
  const by = new Map();
  for (const h of hits) {
    if (!by.has(h.kind)) by.set(h.kind, []);
    by.get(h.kind).push(h);
  }
  const groups = [];
  for (const kind of KIND_ORDER) {
    const rows = by.get(kind);
    if (rows && rows.length) groups.push({ kind, rows: rows.slice(0, MAX_PRO_GRUPPE), total: rows.length });
  }
  for (const [kind, rows] of by) {
    if (!KIND_ORDER.includes(kind)) groups.push({ kind, rows: rows.slice(0, MAX_PRO_GRUPPE), total: rows.length });
  }
  return groups;
}

/**
 * @param {HTMLInputElement} input
 * @param {HTMLFormElement} form
 * @param {{onSubmitQuery:(q:string)=>void, onOpenRoute:(href:string)=>void}} handlers
 */
export function attachSuggest(input, form, handlers) {
  const shell = document.createElement('div');
  shell.className = 'suggest__shell';
  shell.hidden = true;

  const listId = input.id + '-listbox';
  const list = document.createElement('div');
  list.className = 'listbox listbox--suggest';
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Suchvorschläge');

  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'suggest__action';
  action.hidden = true;

  shell.append(list, action);
  const anchor = input.closest('.listbox-anchor') || input.parentElement;
  anchor.classList.add('listbox-anchor');
  anchor.appendChild(shell);

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', listId);
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('autocomplete', 'off');

  let options = [];      // flache Liste: {href?, query?, el}
  let active = -1;

  const close = () => {
    shell.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    options = []; active = -1;
  };

  const setActive = (i) => {
    if (options[active]) options[active].el.classList.remove('is-active');
    if (options[active]) options[active].el.setAttribute('aria-selected', 'false');
    active = i;
    if (options[active]) {
      options[active].el.classList.add('is-active');
      options[active].el.setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', options[active].el.id);
      options[active].el.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  };

  const choose = (opt) => {
    if (!opt) return;
    close();
    if (opt.query != null) { input.value = opt.query; handlers.onSubmitQuery(opt.query); }
    else if (opt.href) handlers.onOpenRoute(opt.href);
  };

  // --- Aufbau ---------------------------------------------------------------
  function render(q) {
    const typed = q.trim();
    const ts = terms(typed);
    options = []; active = -1;
    list.innerHTML = '';
    action.hidden = true;

    if (!typed) {
      // LEERZUSTAND: Beispiele. Hier lernt jemand, dass Fragen erlaubt sind —
      // nicht aus einem Hinweistext, sondern weil vier davon dastehen.
      const g = document.createElement('div');
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', 'Beispiele');
      g.className = 'suggest__group';
      g.innerHTML = '<div class="suggest__grouptitle" aria-hidden="true">Beispiele</div>';
      BEISPIELE.forEach((b, i) => {
        const el = document.createElement('div');
        el.className = 'listbox__option';
        el.id = `${listId}-b${i}`;
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', 'false');
        el.innerHTML = `<span class="listbox__title">${esc(b)}</span>`
          + '<span class="listbox__meta">Beispiel · als Frage stellen</span>';
        el.addEventListener('mousedown', (e) => { e.preventDefault(); choose({ query: b }); });
        g.appendChild(el);
        options.push({ query: b, el });
      });
      list.appendChild(g);
      shell.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      return;
    }

    const hits = search(index(), typed).slice(0, 40);
    const groups = group(hits).slice(0, 4);
    let n = 0;
    for (const grp of groups) {
      if (n >= MAX_TOTAL) break;
      const g = document.createElement('div');
      g.className = 'suggest__group';
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', grp.kind);
      g.innerHTML = `<div class="suggest__grouptitle" aria-hidden="true">${esc(grp.kind)}`
        + `<span class="suggest__groupcount">${grp.total}</span></div>`;
      for (const r of grp.rows) {
        if (n >= MAX_TOTAL) break;
        const el = document.createElement('div');
        el.className = 'listbox__option';
        el.id = `${listId}-o${n}`;
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', 'false');
        el.innerHTML = `<span class="listbox__title">${highlight(r.title, ts)}</span>`
          + `<span class="listbox__meta">${esc(r.type)}${r.meta ? ' · ' + esc(r.meta) : ''}</span>`;
        el.addEventListener('mousedown', (e) => { e.preventDefault(); choose({ href: r.href }); });
        g.appendChild(el);
        options.push({ href: r.href, el });
        n++;
      }
      list.appendChild(g);
    }

    // Die Aktionszeile erscheint, wenn die Eingabe nach einer Frage aussieht
    // ODER die Stichwortsuche nichts findet. Der zweite Fall ist heute der
    // Abbruch: js/search/search-suggest.js ruft dort close() und das Feld
    // wird still leer. Genau da gehört ein Weg hin, kein Verschwinden.
    const frage = isQuestion(typed);
    if (frage || !hits.length) {
      action.hidden = false;
      action.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">'
        + '<path d="m7.38763 19.46794v-3.458h-3.32129v-10.39454h16.583v10.39453h-8.186zm-2.57129-4.208h3.32129v2.79l'
        + '4.09424-2.79h7.668v-8.89454h-15.08353z"/></svg>'
        + `<span>«<strong>${esc(typed)}</strong>» als Frage stellen</span>`;
      action.onclick = () => choose({ query: typed });
    }

    const leer = !options.length && action.hidden;
    shell.hidden = leer;
    input.setAttribute('aria-expanded', String(!leer));
  }

  // --- Ereignisse -----------------------------------------------------------
  const onInput = () => render(input.value);
  const onFocus = () => { if (!input.value.trim()) render(''); };

  const onKey = (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (shell.hidden) {
      if (e.key === 'ArrowDown') { render(input.value); e.preventDefault(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(active + 1 >= options.length ? 0 : active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(active - 1 < 0 ? options.length - 1 : active - 1);
    } else if (e.key === 'Enter') {
      if (active >= 0) { e.preventDefault(); choose(options[active]); }
      // sonst: das Formular sendet — «alles suchen», wie im Portal.
    } else if (e.key === 'Home' && options.length) {
      e.preventDefault(); setActive(0);
    } else if (e.key === 'End' && options.length) {
      e.preventDefault(); setActive(options.length - 1);
    }
  };

  const onDocDown = (e) => { if (!anchor.contains(e.target)) close(); };

  input.addEventListener('input', onInput);
  input.addEventListener('focus', onFocus);
  input.addEventListener('keydown', onKey);
  form.addEventListener('submit', close);
  document.addEventListener('mousedown', onDocDown);

  return () => {
    input.removeEventListener('input', onInput);
    input.removeEventListener('focus', onFocus);
    input.removeEventListener('keydown', onKey);
    form.removeEventListener('submit', close);
    document.removeEventListener('mousedown', onDocDown);
    shell.remove();
  };
}
