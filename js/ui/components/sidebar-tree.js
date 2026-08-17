// Shared navigation/select tree. Indentation is an unbounded running sum: each
// level contributes either its reserved icon column or one plain indent step.
// The chevron sits outside that flow, so children never start left of parents.
import { escape, icon as iconHTML } from './primitives.js';
import { safeLinkUrl } from '../../security/urls.js';

// CSS cannot express the per-level running sum used for indentation.
const GUTTER = 20;
const ICON_COLUMN = 24;
const STEP = 16;

// Host-keyed state survives redraws without retaining detached pages or sharing
// folds between unrelated trees that happen to reuse an id.
const FOLDS = new WeakMap();
const foldsFor = (host, id) => {
  if (!FOLDS.has(host)) FOLDS.set(host, new Map());
  const instances = FOLDS.get(host);
  if (!instances.has(id)) instances.set(id, new Map());
  return instances.get(id);
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
 *           state?: 'active'|'path', split?: true, open?: true, defaultOpen?: true }
 *
 * `open` and `defaultOpen` are not the same question. `open` INSISTS — it wins
 * over the reader, and is for the case where the application must show
 * something (the branch the reader just navigated into). `defaultOpen` merely
 * states the starting position and yields to the first click. Use `open` where
 * a closed row would hide the answer, `defaultOpen` where it is only a habit.
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
  const open = foldsFor(host, id);
  const select = mode === 'select';

  const rung = (depth) => {
    let x = GUTTER;
    for (let i = 0; i < depth; i++) x += (levels[i] || {}).icons ? ICON_COLUMN : STEP;
    return x;
  };

  const CHEV = iconHTML('lucide/chevron-right', 'pf-tree__chev');
  // A level reserves its icon column even when an individual node has no icon.
  const glyph = (node, depth) => ((levels[depth] || {}).icons
    ? (node.icon ? iconHTML(node.icon, 'pf-tree__ico') : '<span class="pf-tree__ico" aria-hidden="true"></span>')
    : '');

  const inner = (node, depth) => glyph(node, depth)
    + (node.idText ? `<span class="pf-tree__id">${escape(node.idText)}</span>` : '')
    + (node.srPrefix ? `<span class="sr-only">${escape(node.srPrefix)}: </span>` : '')
    + `<span class="pf-tree__label">${escape(node.label)}</span>`
    // CSS draws count punctuation; countUnit supplies the spoken context.
    + (node.count == null ? '' : `<span class="pf-tree__n">${escape(String(node.count))}</span>`
      + (node.countUnit ? `<span class="sr-only"> ${escape(node.countUnit)}</span>` : ''));

  const rows = (nodes, depth) => nodes.map((node) => {
    INDEX.set(node.id, node);
    const expandable = canOpen(node);
    // Required-open paths win over reader state; defaults apply only before the
    // reader has explicitly folded the node.
    const isOpen = expandable && (
      node.open === true || node.state === 'path'
        ? true
        : open.has(node.id) ? open.get(node.id) === true
          : node.defaultOpen === true);
    const href = node.href ? safeLinkUrl(node.href) : '';
    const state = node.state === 'active' ? ' is-active'
      : node.state === 'path' ? ' is-path' : '';
    const aria = node.state === 'active'
      ? (select ? ' aria-selected="true"' : ' aria-current="true"') : '';
    const level = ` aria-level="${depth + 1}"`;
    const exp = expandable ? ` aria-expanded="${isOpen}"` : '';
    const li = ` style="--pf-ind:${rung(depth)}px"`;

    // Keep the fold control beside interactive rows; nested buttons/links are
    // invalid HTML and browsers re-parent their contents.
    const chevBtn = `<button type="button" class="pf-tree__fold" data-fold="${escape(node.id)}"`
      + `${select ? ' tabindex="-1"' : ''} aria-expanded="${isOpen}"`
      + ` aria-label="${escape(node.label)} ${isOpen ? 'zuklappen' : 'aufklappen'}">${CHEV}</button>`;
    const chevMute = `<span class="pf-tree__chev-slot" aria-hidden="true">${CHEV}</span>`;

    let body;
    if (node.split && href && expandable) {
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
    // Only nodes in the current rendering may answer delegated clicks.
    INDEX = new Map();
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
    // Toggle the rendered state because a required path may override memory.
    const findFold = () => [...host.querySelectorAll('[data-fold]')]
      .find((element) => element.dataset.fold === key);
    const shown = findFold();
    const now = shown ? shown.getAttribute('aria-expanded') === 'true' : open.get(key) === true;
    open.set(key, !now);
    draw();
    const again = findFold();
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
        // Capture and fold before selection; onSelect may replace this tree.
        const picked = nodeById(fold.dataset.fold);
        toggle(fold.dataset.fold, true);
        if (select && row === fold && picked && onSelect) onSelect(picked, e);
        return;
      }
    }
    if (!select) return;
    const row = e.target.closest('[data-node]');
    const picked = row && nodeById(row.dataset.node);
    if (picked && onSelect) onSelect(picked, e);
  };

  // This render-time index includes lazy children only after they become visible.
  let INDEX = new Map();
  const nodeById = (nid) => INDEX.get(nid) || null;

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
      const wasOpen = document.activeElement.getAttribute('aria-expanded') === 'true';
      // Redrawing removes the focused row, so keyboard folds must restore it.
      if (key === 'ArrowRight' && !wasOpen && document.activeElement.getAttribute('aria-expanded')) {
        e.preventDefault(); toggle(nid, true);
      } else if (key === 'ArrowLeft') {
        // APG tree behavior: Left closes an open node, then moves to its parent.
        if (wasOpen) { e.preventDefault(); toggle(nid, true); return; }
        const list = document.activeElement.closest('.pf-tree__item')?.parentElement;
        if (!list || !list.classList.contains('pf-tree__children')) return;
        const up = list.parentElement.querySelector(
          ':scope > [role="treeitem"], :scope > .pf-tree__split > [role="treeitem"]');
        if (!up) return;
        e.preventDefault();
        items.forEach((r) => { r.tabIndex = -1; });
        up.tabIndex = 0; up.focus();
      }
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
