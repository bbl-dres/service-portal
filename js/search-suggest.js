// Suchvorschläge für das grosse Feld auf der Startseite (ARIA-Combobox).
//
// BEWUSST NUR AUF DEM, WAS OHNEHIN DA IST: Dienstleistungen (eager geladen) und
// «Wissen und Hilfsmittel» (JS-Literale, kein Request). Das sind 150 Einträge
// und genau die beiden Inhaltsarten, auf die alle Signale zeigen — Vorgänge und
// Vorlagen (docs/search-review.md §2). Den vollen Index zu bauen hiesse, auf der
// Startseite 236 KB nachzuladen, nur damit jemand VIELLEICHT tippt; das würde
// die Startzeit-Arbeit aus docs/code-review.md §1 rückgängig machen. Wer mehr
// sucht, drückt Enter und bekommt auf #/search alles.
//
// Tastatur nach WAI-ARIA 1.2 (combobox mit listbox-popup): ↓/↑ wandern,
// Enter übernimmt, Escape schliesst, Tab verlässt. Die Auswahl wird über
// aria-activedescendant angesagt — der Fokus bleibt im Eingabefeld, sonst
// verlöre die Schreibmarke ihre Position.

import { search as runSearch, prepare } from './search-engine.js';
import { knowledgeIndex } from './knowledge-content.js';

const MAX = 7;

// Der Index wird einmal je Seitenaufbau gebaut und gemerkt — bei jedem
// Tastendruck neu zu falten wäre bei 150 Einträgen zwar bezahlbar, aber unnötig.
let CACHE = null;
function suggestIndex(core) {
  if (CACHE) return CACHE;
  const domainLabel = (k) => (core.ref().domains || []).find((d) => d.key === k)?.label || k;
  const rows = [];
  for (const s of core.services()) {
    if (s.type !== 'action') continue;   // Vorschläge führen zu etwas Startbarem
    rows.push({
      title: s.title, desc: domainLabel(s.domain), art: 'Dienstleistung',
      href: `#/services/${encodeURIComponent(s.serviceId)}`,
      extra: [domainLabel(s.domain), s.short, (s.voraussetzungen || []).join(' ')].join(' '),
      boost: s.popular ? Math.max(0, 20 - s.popular * 2) : 0,
    });
  }
  for (const k of knowledgeIndex()) {
    rows.push({
      title: k.title, desc: k.area, art: 'Unterlage',
      href: k.href, external: k.external, extra: k.extra,
    });
  }
  CACHE = rows.map(prepare);
  return CACHE;
}

// `input` ist das Eingabefeld, `form` sein Formular. Gibt eine Aufräumfunktion
// zurück; der Aufrufer hängt sie an ctx.onUnmount, damit beim Routenwechsel
// keine Liste im DOM zurückbleibt.
export function attachSuggest(input, form, core, C) {
  const listId = input.id + '-suggest';
  const list = document.createElement('ul');
  list.className = 'suggest';
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Suchvorschläge');
  list.hidden = true;
  // Das Feld liegt in einem Flex-Container; die Liste gehört unter das FELD,
  // nicht unter die Zeile mit dem Knopf.
  const anchor = input.parentElement;
  anchor.classList.add('suggest-anchor');
  anchor.appendChild(list);

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', listId);
  input.setAttribute('aria-autocomplete', 'list');

  let items = [];
  let active = -1;

  const close = () => {
    list.hidden = true;
    list.innerHTML = '';
    items = []; active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const paint = () => {
    list.querySelectorAll('.suggest__item').forEach((el, i) => {
      const on = i === active;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', String(on));
    });
    if (active >= 0) input.setAttribute('aria-activedescendant', `${listId}-${active}`);
    else input.removeAttribute('aria-activedescendant');
  };

  const open = (q) => {
    items = runSearch(suggestIndex(core), q).slice(0, MAX);
    if (!items.length) return close();
    list.innerHTML = items.map((r, i) => `
      <li class="suggest__item" role="option" id="${listId}-${i}" aria-selected="false" data-i="${i}">
        <span class="suggest__title">${C.escape(r.title)}</span>
        <span class="suggest__meta">${C.escape(r.art)}${r.desc ? ' · ' + C.escape(r.desc) : ''}</span>
      </li>`).join('');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = -1;
    paint();
  };

  const choose = (i) => {
    const r = items[i];
    if (!r) return;
    close();
    if (r.external) window.open(r.href, '_blank', 'noopener');
    else location.hash = r.href.replace(/^#/, '#');
  };

  const onInput = () => {
    const q = input.value.trim();
    if (q.length < 2) return close();
    open(q);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (list.hidden || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Tab') close();
  };

  // Klick auf einen Vorschlag: mousedown statt click, weil das Feld sonst
  // vorher den Fokus verliert und blur die Liste schliesst, bevor click feuert.
  const onDown = (e) => {
    const li = e.target.closest('.suggest__item');
    if (!li) return;
    e.preventDefault();
    choose(Number(li.dataset.i));
  };

  const onBlur = () => setTimeout(close, 120);
  const onSubmit = () => close();

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKey);
  input.addEventListener('blur', onBlur);
  list.addEventListener('mousedown', onDown);
  form.addEventListener('submit', onSubmit);

  return () => {
    input.removeEventListener('input', onInput);
    input.removeEventListener('keydown', onKey);
    input.removeEventListener('blur', onBlur);
    form.removeEventListener('submit', onSubmit);
    list.remove();
    input.removeAttribute('role');
    input.removeAttribute('aria-expanded');
    input.removeAttribute('aria-controls');
    input.removeAttribute('aria-autocomplete');
    input.removeAttribute('aria-activedescendant');
  };
}
