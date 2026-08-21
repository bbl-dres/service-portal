// Vorschlagsfeld — Portal-Verhalten als Grundstellung, die Vorschläge der
// Studie als Zuschaltungen.
//
// GRUNDSTELLUNG = js/search/search-suggest.js, Zeile für Zeile nachgebildet:
//   · greift erst ab dem ZWEITEN Zeichen (`q.length < 2` → close)
//   · durchsucht VIER Inhaltsarten, nicht elf: startbare Dienstleistungen,
//     Anwendungen, Datensätze, Unterlagen — mit TYPE_BOOST als Stichentscheid
//   · zeigt höchstens SIEBEN Zeilen
//   · `desc` ist dort die Domäne bzw. Gruppe, nicht der Fliesstext
//   · schliesst bei null Treffern still
//
// Der letzte Punkt ist der Befund, an dem die Studie ansetzt: `close()` bei null
// Treffern heisst, dass das Feld genau dann leer wird, wenn jemand eine Frage
// getippt hat. Der Schalter «… als Frage stellen» setzt dort einen Weg hin.
//
// TASTATUR nach WAI-ARIA 1.2 (combobox mit listbox-Popup), wie
// js/ui/combobox.js im Portal: ↓/↑ bewegen, Enter wählt, Escape schliesst, Tab
// verlässt. aria-activedescendant meldet die Auswahl, während der Fokus im Feld
// bleibt — die Schreibmarke behält ihre Stelle.

import { search } from '../../../../js/search/search-engine.js';
import { suggestIndex, index, KIND_ORDER } from './data.js';
import { isQuestion } from './query.js';
import { esc, icon } from './ui.js';
import { on } from './settings.js';
import { filterRows } from './sources.js';

const MAX = 7;                 // Portal js/search/search-suggest.js
const MAX_PRO_GRUPPE = 4;      // Studie: gruppierte Ansicht
const MAX_GRUPPIERT = 10;
const BLUR_DELAY = 120;        // Portal js/ui/combobox.js

// Beispiele im leeren Feld. ECHTE Fragen, die diese Studie wirklich beantwortet
// — eine Beispielzeile, die ins Leere führt, wäre schlimmer als keine.
export const BEISPIELE = [
  'Wie melde ich eine defekte Heizung?',
  'Kann ich einen Sitzungsraum reservieren?',
  'Was brauche ich für eine IKT-Beschaffung?',
  'Wo finde ich die Pläne eines Gebäudes?',
];

/* ------------------------------------------------------ Hervorhebung ---- */
// Treffer im Titel markieren. BEWUSST auf dem ROHTEXT und ohne Faltung: die
// Suchmaschine faltet «ä→ae», wodurch sich Zeichenlängen verschieben und eine
// Rückabbildung auf den Originaltitel nur raten könnte. Lieber gar nicht
// hervorheben als an der falschen Stelle.
function highlight(title, terms) {
  const raw = String(title || '');
  if (!terms.length) return esc(raw);
  const hay = raw.toLowerCase();
  const spans = [];
  for (const t of terms) {
    if (t.length < 2) continue;
    const needle = t.toLowerCase();
    let from = 0;
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
  let out = ''; let cursor = 0;
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
 * @param {HTMLInputElement} input   das Feld
 * @param {HTMLFormElement}  form    sein Formular
 * @param {{onSubmitQuery:(q:string)=>void, onOpenRoute:(href:string, external?:boolean)=>void}} handlers
 * @returns {() => void} Abbau. Gehört in den Aufräumpfad des Routers, sonst
 *   bleibt nach einem Seitenwechsel eine Liste im Dokument stehen.
 */
export function attachSuggest(input, form, handlers) {
  const grouped = on('grouped');
  const ask = on('ask');

  const listId = input.id + '-suggest';
  // GRUPPIERT braucht <div>: eine role="group" zwischen listbox und option ist
  // in ARIA vorgesehen, als <li><ul> aber nur mit role="none"-Flickwerk zu
  // bekommen. Ungruppiert bleibt es beim <ul>/<li> des Portals.
  const list = document.createElement(grouped ? 'div' : 'ul');
  list.className = 'listbox listbox--suggest';
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Suchvorschläge');
  list.hidden = true;

  // Die Aktionszeile steht AUSSERHALB der role="listbox"-Liste. Eine Option darf
  // keine Prosa und keine Verweise enthalten; wer sie hineinlegt, bricht den
  // Options-Vertrag und macht sie für Screenreader unbedienbar.
  const action = ask ? document.createElement('button') : null;
  if (action) {
    action.type = 'button';
    action.className = 'suggest__action';
    action.hidden = true;
  }

  // Das Feld sitzt in einem Flex-Container; die Liste gehört unter das FELD,
  // nicht unter die Zeile aus Feld plus Knopf (Portal-Kommentar in home.js).
  const anchor = input.parentElement;
  anchor.classList.add('listbox-anchor');
  // Mit Aktionszeile braucht es eine gemeinsame Hülle, die Rahmen und Schatten
  // trägt — sonst stünde die Zeile ohne Liste als nackter Streifen da.
  const shell = ask ? document.createElement('div') : null;
  if (shell) {
    shell.className = 'suggest__shell';
    shell.hidden = true;
    shell.append(list, action);
    list.hidden = false;             // Die Hülle übernimmt das Verstecken.
    anchor.appendChild(shell);
  } else {
    anchor.appendChild(list);
  }

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', listId);
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('autocomplete', 'off');

  let items = [];        // flach: { href?, external?, query?, el }
  let active = -1;
  let blurTimer = null;
  let detached = false;

  const box = shell || list;
  const setOpen = (open) => {
    box.hidden = !open;
    if (shell) list.hidden = false;
    input.setAttribute('aria-expanded', String(open));
  };

  function close() {
    clearTimeout(blurTimer);
    setOpen(false);
    list.innerHTML = '';
    if (action) { action.hidden = true; action.onclick = null; }
    items = []; active = -1;
    input.removeAttribute('aria-activedescendant');
  }

  function paint() {
    items.forEach((it, i) => {
      const sel = i === active;
      it.el.classList.toggle('is-active', sel);
      it.el.setAttribute('aria-selected', String(sel));
      if (sel) {
        input.setAttribute('aria-activedescendant', it.el.id);
        it.el.scrollIntoView({ block: 'nearest' });
      }
    });
    if (active < 0) input.removeAttribute('aria-activedescendant');
  }

  const move = (i) => { if (items.length) { active = (i + items.length) % items.length; paint(); } };

  function choose(item) {
    if (!item) return;
    close();
    if (item.query != null) { input.value = item.query; handlers.onSubmitQuery(item.query); }
    else if (item.href) handlers.onOpenRoute(item.href, item.external);
  }

  /* ------------------------------------------------------- Zeichnen ----- */

  const option = (id, titleHtml, metaText) => {
    const el = document.createElement(grouped ? 'div' : 'li');
    el.className = 'listbox__option';
    el.id = id;
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', 'false');
    el.innerHTML = `<span class="listbox__title">${titleHtml}</span>`
      + `<span class="listbox__meta">${esc(metaText)}</span>`;
    return el;
  };

  /** Leerzustand: die vier Beispiele. Nur mit «… als Frage stellen» — im Portal
   *  bleibt das Feld beim Hineinklicken zu. Hier lernt jemand, dass Fragen
   *  erlaubt sind, nicht aus einem Hinweistext, sondern weil vier dastehen. */
  function renderExamples() {
    // Der Abschnittskopf gehört zur gruppierten Fassung. Ohne sie ist die Liste
    // ein <ul>, und ein <div role="group"> darin wäre ungültiges HTML — die vier
    // Zeilen stehen dann flach da und sagen in ihrer Metazeile, was sie sind.
    const host = grouped ? document.createElement('div') : list;
    if (grouped) {
      host.className = 'suggest__group';
      host.setAttribute('role', 'group');
      host.setAttribute('aria-label', 'Beispiele');
      host.innerHTML = '<div class="suggest__grouptitle" aria-hidden="true">Beispiele</div>';
    }
    BEISPIELE.forEach((b, i) => {
      const el = option(`${listId}-b${i}`, esc(b), 'Beispiel · als Frage stellen');
      host.appendChild(el);
      items.push({ query: b, el });
    });
    if (grouped) list.appendChild(host);
    setOpen(true);
  }

  /** PORTAL: flache Liste, höchstens sieben, vier Inhaltsarten. */
  function renderFlat(typed) {
    // filterRows VOR dem Abschneiden: erst filtern, dann die sieben nehmen.
    // Andersherum lieferte eine abgewählte Quelle, die zufällig die ersten
    // sieben Plätze belegt, eine leere Liste statt der nächstbesten Treffer.
    const hits = search(filterRows(suggestIndex()), typed).slice(0, MAX);
    hits.forEach((r, i) => {
      const el = option(`${listId}-${i}`, esc(r.title),
        r.resultType + (r.desc ? ' · ' + r.desc : ''));
      list.appendChild(el);
      items.push({ href: r.href, external: r.external, el });
    });
    return hits.length;
  }

  /** STUDIE: Abschnittsköpfe je Inhaltsart mit Anzahl, Fundstelle hervorgehoben.
   *  Sucht im VOLLEN Index — die Gruppierung ist genau die Antwort darauf, dass
   *  elf Inhaltsarten in einer flachen Siebenerliste nicht unterscheidbar sind. */
  function renderGrouped(typed) {
    const ts = terms(typed);
    const hits = search(filterRows(index()), typed).slice(0, 60);
    const groups = group(hits).slice(0, 4);
    let n = 0;
    for (const grp of groups) {
      if (n >= MAX_GRUPPIERT) break;
      const g = document.createElement('div');
      g.className = 'suggest__group';
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', grp.kind);
      g.innerHTML = `<div class="suggest__grouptitle" aria-hidden="true">${esc(grp.kind)}`
        + `<span class="suggest__groupcount">${grp.total}</span></div>`;
      for (const r of grp.rows) {
        if (n >= MAX_GRUPPIERT) break;
        // `sub` ist das studieneigene Zweitfeld für die drei Inhaltsarten, bei
        // denen das Portal auf der Trefferseite kein `meta` setzt (js/data.js).
        const zusatz = r.meta || r.sub || '';
        const el = option(`${listId}-${n}`, highlight(r.title, ts),
          r.type + (zusatz ? ' · ' + zusatz : ''));
        g.appendChild(el);
        items.push({ href: r.href, external: r.external, el });
        n++;
      }
      list.appendChild(g);
    }
    return hits.length;
  }

  function render(raw) {
    const typed = raw.trim();
    items = []; active = -1;
    list.innerHTML = '';
    if (action) { action.hidden = true; action.onclick = null; }

    if (!typed) {
      if (ask) renderExamples(); else close();
      return;
    }

    const found = grouped ? renderGrouped(typed) : renderFlat(typed);

    // Die Aktionszeile erscheint, wenn die Eingabe nach einer Frage aussieht
    // ODER die Stichwortsuche nichts findet. Der zweite Fall ist heute der
    // Abbruch: search-suggest.js ruft dort close(), und das Feld wird still
    // leer. Genau da gehört ein Weg hin, kein Verschwinden.
    if (action && (isQuestion(typed) || !found)) {
      action.hidden = false;
      action.innerHTML = icon('SpeechBubble', 'icon--md')
        + `<span>«<strong>${esc(typed)}</strong>» als Frage stellen</span>`;
      action.onclick = () => choose({ query: typed });
    }

    const leer = !items.length && (!action || action.hidden);
    setOpen(!leer);
    if (leer) close();
  }

  /* ------------------------------------------------------- Ereignisse --- */

  const onInput = () => {
    const q = input.value.trim();
    // Zurücklöschen unter zwei Zeichen muss die Liste schliessen — ausser die
    // Studie zeigt dort ihre Beispiele.
    if (q.length < 2) { if (ask) render(input.value); else close(); return; }
    render(input.value);
  };
  // Der Fokus öffnet NUR die Beispiele. Das Portal reagiert überhaupt nicht auf
  // Fokus, und eine Trefferliste beim blossen Hineinklicken wäre ein
  // unerbetener Kontextwechsel.
  const onFocus = () => { if (ask && !input.value.trim()) render(''); };
  const onKey = (e) => {
    if (e.key === 'Escape') { if (!box.hidden) e.preventDefault(); close(); return; }
    if (e.key === 'Tab') { close(); return; }
    if (box.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); move(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(active - 1); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(items[active]); }
    else if (e.key === 'Enter') { close(); }   // sonst sendet das Formular: «alles suchen»
  };
  // Verzögert schliessen: ein Klick auf eine Option löst zuerst blur aus, und
  // ein sofortiges close() nähme dem Klick sein Ziel.
  const onBlur = () => { blurTimer = setTimeout(() => { if (!detached) close(); }, BLUR_DELAY); };
  const onListDown = (e) => { if (e.target.closest('[role="option"]')) e.preventDefault(); };
  const onListClick = (e) => {
    const el = e.target.closest('[role="option"]');
    if (!el) return;
    choose(items.find((it) => it.el === el));
  };
  const onListMove = (e) => {
    const el = e.target.closest('[role="option"]');
    if (!el) return;
    const i = items.findIndex((it) => it.el === el);
    if (i >= 0 && i !== active) move(i);
  };
  const onSubmit = () => close();
  // Die Aktionszeile liegt ausserhalb der Liste: ohne dieses mousedown nähme
  // ihr der blur-Timer den Klick weg.
  const onActionDown = (e) => e.preventDefault();

  input.addEventListener('input', onInput);
  input.addEventListener('focus', onFocus);
  input.addEventListener('keydown', onKey);
  input.addEventListener('blur', onBlur);
  list.addEventListener('mousedown', onListDown);
  list.addEventListener('click', onListClick);
  list.addEventListener('mousemove', onListMove);
  form.addEventListener('submit', onSubmit);
  if (action) action.addEventListener('mousedown', onActionDown);

  return () => {
    detached = true;
    clearTimeout(blurTimer);
    input.removeEventListener('input', onInput);
    input.removeEventListener('focus', onFocus);
    input.removeEventListener('keydown', onKey);
    input.removeEventListener('blur', onBlur);
    list.removeEventListener('mousedown', onListDown);
    list.removeEventListener('click', onListClick);
    list.removeEventListener('mousemove', onListMove);
    form.removeEventListener('submit', onSubmit);
    if (action) action.removeEventListener('mousedown', onActionDown);
    for (const attr of ['role', 'aria-expanded', 'aria-controls', 'aria-autocomplete', 'aria-activedescendant']) {
      input.removeAttribute(attr);
    }
    (shell || list).remove();
  };
}
