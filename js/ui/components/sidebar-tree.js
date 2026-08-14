// The portal's ONE sidebar tree.
//
// Eight surfaces carried a sidebar tree built by four different pieces of code,
// which disagreed with each other: level 1 began at three different x positions,
// the process documentation put the child LEFT of its parent, and every row on
// every surface drew a divider. The study behind this file is
// docs/seitenbaum-analyse.md and docs/wireframes/260814 - Seitenbaum als Bauteil.html.
//
// Three rules carry the whole design.
//
// 1. THE CHEVRON STANDS OUTSIDE THE FLOW, in a fixed gutter left of the label.
//    A row with one therefore begins where a row without one begins, and a child
//    can no longer land left of its parent — the bug that rule exists to kill.
//
// 2. THE LADDER IS A RUNNING SUM, and every level contributes what IT occupies:
//    an icon column when that level declares icons, otherwise a step. Two things
//    follow, and they are the point. A level without icons sits flush under one
//    with them, because the icon column IS its indent. And a tree with icons on
//    every level gets the icon width as an even step instead of counting it
//    twice. There is no ceiling: a recursive category does not know its depth in
//    advance, and a ladder that ends yields NaN, an invalid padding, and a row
//    at x=0 — left of level 1.
//
// 3. A DECLARED ICON COLUMN IS ALWAYS RESERVED (variant (c), decision of
//    2026-08-14, docs/seitenbaum-analyse.md §5). `levels[i].icons` reserves it,
//    `node.icon` fills it. The rejected alternative — draw the glyph if present,
//    nothing if absent — is flush only as long as every row of a level happens
//    to bring one, which nothing enforces; the day one does not, it collapses
//    into the failure the whole design rejects. A component that is only correct
//    while everyone honours an unwritten rule is not a component.
//
// Dividers separate SECTIONS and nothing else. Hierarchy is carried by the
// ladder, belonging by the fill of the chosen row, importance by weight.
import { escape, icon as iconHTML } from './primitives.js';
import { safeLinkUrl } from '../../security/urls.js';

// Measured in px and kept here rather than in CSS: the ladder is a sum, and a
// sum of custom properties cannot be expressed as a rule per level.
const GUTTER = 20;   // the chevron sits in it, out of flow
const ICOCOL = 24;   // an icon column, where a level declares one
const STEP = 16;     // a level that declares no icons

// Fold state outlives a redraw but not the page. Keyed per instance, because two
// trees on one page must not share it — and because ids are only unique within
// the tree that issued them.
const FOLDS = new Map();
const foldsFor = (id) => {
  if (!FOLDS.has(id)) FOLDS.set(id, new Set());
  return FOLDS.get(id);
};

const kidsOf = (node) =>
  (typeof node.children === 'function' ? node.children(node) : node.children) || [];

// `hasChildren` states THAT there are children without building them. Without it
// `children()` would have to run on every render just to decide whether to draw
// a chevron — and then nothing would be late. A data table carries up to 75
// fields; building every list up front would put hundreds of hidden rows in the
// rail for a reader who opens none of them.
const canOpen = (node) => node.hasChildren === true
  || (Array.isArray(node.children) && node.children.length > 0)
  || (typeof node.children === 'function' && node.hasChildren !== false);

/**
 * sidebarTree(host, cfg) — renders into `host`, returns a disposer.
 *
 *   id       unique per instance; namespaces the fold state
 *   title    optional heading above the tree
 *   mode     'nav'    rows are links; a click changes the address
 *            'select' ARIA tree; one tab stop, arrow keys, the address stays
 *   levels   [{ icons: true|false }, …] — per DEPTH, reserves the icon column
 *   sections [[node, …], …] — one divider between groups, none within
 *   onSelect (node, event) => void, for mode 'select'
 *
 * A node: { id, label, count, countUnit?, icon?, href?, children?, hasChildren?,
 *           state?: 'active'|'path', split?: true, open?: true }
 *
 * `href` + `children` + `split` gives the split row: the link chooses, the
 * chevron opens. Without `split` a link row expands by navigating, and a row
 * with no `href` toggles itself.
 */
export function sidebarTree(host, cfg = {}) {
  const {
    id = 'tree', title = '', mode = 'nav', levels = [], sections = [],
    ariaLabel = 'Navigation', onSelect,
  } = cfg;
  const open = foldsFor(id);
  const select = mode === 'select';

  // Rule 2. Computed rather than declared, and deliberately unbounded.
  const rung = (depth) => {
    let x = GUTTER;
    for (let i = 0; i < depth; i++) x += (levels[i] || {}).icons ? ICOCOL : STEP;
    return x;
  };

  const CHEV = iconHTML('ChevronRight', 'pf-tree__chev');
  // Rule 3: the column is reserved by the LEVEL, filled by the node.
  const glyph = (node, depth) => ((levels[depth] || {}).icons
    ? (node.icon ? iconHTML(node.icon, 'pf-tree__ico') : '<span class="pf-tree__ico" aria-hidden="true"></span>')
    : '');

  const inner = (node, depth) => glyph(node, depth)
    + `<span class="pf-tree__label">${escape(node.label)}</span>`
    // The count is a BARE NUMBER in the DOM — the parentheses are drawn by CSS,
    // so scripts and assertions keep reading a number — with a named unit for
    // assistive technology, which would otherwise hear «Schweiz 7».
    + (node.count == null ? '' : `<span class="pf-tree__n">${escape(String(node.count))}</span>`
      + (node.countUnit ? `<span class="sr-only"> ${escape(node.countUnit)}</span>` : ''));

  const rows = (nodes, depth) => nodes.map((node) => {
    const expandable = canOpen(node);
    // Drei Wege, offen zu sein, und der dritte ist der wichtige:
    //   · der Leser hat das Chevron gedrückt (open)
    //   · der Knoten liegt auf dem WEG zur Auswahl — die Strecke muss zu sehen sein
    //   · die Anwendung sagt es ausdrücklich (node.open)
    // Ausdrücklich, weil «gewählt» und «aufgeklappt» nicht dasselbe sind und die
    // Anwendung das je Stufe verschieden beantwortet: einen Ast zu wählen heisst,
    // seine Gruppen zu zeigen; einen DATENSATZ zu wählen darf nicht heissen,
    // seine fünfundsiebzig Bestandteile mitzubringen. Das kann das Bauteil nicht
    // erraten.
    const isOpen = expandable
      && (open.has(node.id) || node.open === true || node.state === 'path');
    const href = node.href ? safeLinkUrl(node.href) : '';
    const state = node.state === 'active' ? ' is-active'
      : node.state === 'path' ? ' is-path' : '';
    const aria = node.state === 'active'
      ? (select ? ' aria-selected="true"' : ' aria-current="true"') : '';
    const level = ` aria-level="${depth + 1}"`;
    const exp = expandable ? ` aria-expanded="${isOpen}"` : '';
    const li = ` style="--pf-ind:${rung(depth)}px"`;

    // A chevron may NEVER nest inside an interactive row: a <button> inside a
    // <button> (or inside an <a>) is invalid, the parser closes the outer one
    // early, and the label falls out as a sibling — measured once as four
    // entirely empty rows. Hence three forms, none of which nests.
    const chevBtn = `<button type="button" class="pf-tree__fold" data-fold="${escape(node.id)}"`
      + ` tabindex="-1" aria-expanded="${isOpen}"`
      + ` aria-label="${escape(node.label)} ${isOpen ? 'zuklappen' : 'aufklappen'}">${CHEV}</button>`;
    const chevMute = `<span class="pf-tree__chev-slot" aria-hidden="true">${CHEV}</span>`;

    let body;
    if (node.split && href && expandable) {
      // The link chooses, the chevron opens — for a record whose parts are many.
      body = `<span class="pf-tree__split${state}">${chevBtn}`
        + `<a class="pf-tree__row" href="${escape(href)}"${aria}${select ? ' role="treeitem"' + level : ''}`
        + ` data-node="${escape(node.id)}">${inner(node, depth)}</a></span>`;
    } else if (href && !select) {
      body = `<a class="pf-tree__row${state}" href="${escape(href)}"${aria}`
        + (expandable ? ` data-fold="${escape(node.id)}"${exp}` : '')
        + ` data-node="${escape(node.id)}">${expandable ? chevMute : ''}${inner(node, depth)}</a>`;
    } else {
      body = `<button type="button" class="pf-tree__row${state}"`
        + (select ? ` role="treeitem"${level}${aria} tabindex="-1"` : '')
        + (expandable ? ` data-fold="${escape(node.id)}"${exp}` : '')
        + ` data-node="${escape(node.id)}">${expandable ? chevMute : ''}${inner(node, depth)}</button>`;
    }

    const sub = expandable
      ? `<ul class="pf-tree__children"${select ? ' role="group"' : ''}${isOpen ? '' : ' hidden'}>`
        + (isOpen ? rows(kidsOf(node), depth + 1) : '') + '</ul>'
      : '';
    return `<li class="pf-tree__item"${li}${select ? ' role="none"' : ''}>${body}${sub}</li>`;
  }).join('');

  const draw = () => {
    host.innerHTML = (title
      ? `<div class="pf-sidebar__head"><h2 class="pf-sidebar__title">${escape(title)}</h2></div>`
      : '')
      + sections.map((nodes) => `<ul class="pf-tree pf-tree__section"`
        + `${select ? ` role="tree" aria-label="${escape(ariaLabel)}"` : ''}>`
        + rows(nodes, 0) + '</ul>').join('');
    if (select) roving();
  };

  // One tab stop for the whole widget (WAI-ARIA tree pattern): the selected row
  // holds it, or the first one.
  const roving = () => {
    const all = [...host.querySelectorAll('[role="treeitem"]')];
    all.forEach((r) => { r.tabIndex = -1; });
    (all.find((r) => r.getAttribute('aria-selected') === 'true') || all[0])?.setAttribute('tabindex', '0');
  };

  const toggle = (key, focusBack) => {
    if (open.has(key)) open.delete(key); else open.add(key);
    draw();
    const again = host.querySelector(`[data-fold="${CSS.escape(key)}"]`);
    if (again && focusBack) again.focus();
  };

  const onClick = (e) => {
    const fold = e.target.closest('[data-fold]');
    // A link row that also folds still navigates; only a real fold BUTTON and a
    // non-link row swallow the click.
    if (fold && (fold.tagName === 'BUTTON' || !fold.getAttribute('href'))) {
      const row = e.target.closest('.pf-tree__row');
      if (fold.classList.contains('pf-tree__fold') || row === fold) {
        e.preventDefault();
        if (select && row === fold && onSelect) onSelect(nodeById(fold.dataset.fold), e);
        toggle(fold.dataset.fold, true);
        return;
      }
    }
    if (!select) return;
    const row = e.target.closest('[data-node]');
    if (row && onSelect) onSelect(nodeById(row.dataset.node), e);
  };

  const flat = () => {
    const out = [];
    const walk = (nodes) => nodes.forEach((n) => {
      out.push(n);
      if (Array.isArray(n.children)) walk(n.children);
    });
    sections.forEach(walk);
    return out;
  };
  const nodeById = (nid) => flat().find((n) => n.id === nid) || { id: nid };

  // Arrow keys, Home/End — required by the tree pattern, and the reason the
  // select surfaces cannot simply become a list of links.
  const onKey = (e) => {
    if (!select) return;
    const items = [...host.querySelectorAll('[role="treeitem"]')];
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    const go = (j) => { e.preventDefault(); items.forEach((r) => { r.tabIndex = -1; });
      items[j].tabIndex = 0; items[j].focus(); };
    const key = e.key;
    if (key === 'ArrowDown' && i < items.length - 1) go(i + 1);
    else if (key === 'ArrowUp' && i > 0) go(i - 1);
    else if (key === 'Home') go(0);
    else if (key === 'End') go(items.length - 1);
    else if (key === 'ArrowRight' || key === 'ArrowLeft') {
      const nid = document.activeElement.dataset.node;
      const wasOpen = open.has(nid);
      if (key === 'ArrowRight' && !wasOpen && document.activeElement.getAttribute('aria-expanded')) {
        e.preventDefault(); toggle(nid, false);
      } else if (key === 'ArrowLeft' && wasOpen) { e.preventDefault(); toggle(nid, false); }
    }
  };

  host.addEventListener('click', onClick);
  host.addEventListener('keydown', onKey);
  draw();

  return () => {
    host.removeEventListener('click', onClick);
    host.removeEventListener('keydown', onKey);
  };
}
