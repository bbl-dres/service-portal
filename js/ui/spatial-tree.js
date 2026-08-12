// Sidebar structure tree (`.pf-tree`). Portfolio, construction projects and
// tenancies use the same anatomy: one <li class="pf-tree__item"> per level,
// whose button carries levels as `data-country` / `data-region` / `data-city` /
// `data-business-entity`, a count in `<span class="pf-tree__n">`, and leaves
// with `data-obj`.
//
// Since the consistency review (docs/design-review.md, A1), the WHOLE anatomy
// lives here rather than just counts: construction (treeHTML), two-tone marking
// (markTree: `is-active` on the selected node and `is-path` on ancestors), click
// wiring (wireTree), and URL restoration (restoreTreeSelection). Previously the
// three explorers carried almost identical copies. The tenant-portal copy had
// already drifted: it used `is-selected`, for which the tree had no CSS rule, so
// selection was invisible. The metadata catalogue's deliberately different
// link variant (hash links rather than buttons, documented there) remains local.
//
// The tree is rendered ONCE and never rebuilt, which preserves expanded branches
// and selection. Counts are therefore synchronised rather than regenerated.

// Synchronise counts and visibility with the current filters.
//
// `visible` is the list remaining AFTER search and facets, deliberately without
// the tree selection itself. Otherwise a click would leave only the selected
// branch showing «1», turning navigation into a dead end.
//
// `levelsOf(entry)` returns level values in country · region · city · business-
// entity order (shorter trees return fewer), and `idOf(entry)` returns the ID
// carried by leaves in `data-obj`.
export function syncTreeCounts(root, visible, levelsOf, idOf) {
  if (!root) return;
  // One count per path prefix: «CH», «CH▸BE», «CH▸BE▸Bern», …
  const counts = new Map();
  for (const entry of visible) {
    const levels = levelsOf(entry);
    for (let index = 0; index < levels.length; index++) {
      const key = levels.slice(0, index + 1).join('▸');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const ids = new Set(visible.map(idOf));

  root.querySelectorAll('.pf-tree__node').forEach((button) => {
    const data = button.dataset;
    const levels = [data.country, data.region, data.city, data.businessEntity].filter((value) => value !== undefined);
    const count = counts.get(levels.join('▸')) || 0;
    const field = button.querySelector('.pf-tree__n');
    if (field) field.textContent = String(count);
    // Hide empty branches instead of offering a «0» that leads nowhere.
    button.closest('.pf-tree__item').hidden = count === 0;
  });
  root.querySelectorAll('.pf-tree__leaf').forEach((button) => {
    button.closest('.pf-tree__item').hidden = !ids.has(button.dataset.obj);
  });
  // Filtering can hide the row that currently holds the tree's single tab stop,
  // which would leave the whole tree unreachable by keyboard. Put it back on a
  // visible row — the selected one if it survived the filter, else the first.
  const reachable = [...root.querySelectorAll('.pf-tree__node, .pf-tree__leaf, .pf-tree__sub')]
    .filter((button) => button.offsetParent !== null);
  if (!reachable.length) return;
  // Row dividers are LEADING rules (css/sections/explorer.css), which leaves the
  // column without a trailing line. CSS clears the rule on the first top-level
  // row, but filtering can hide exactly that row — so mark whichever row is
  // actually first now, otherwise a line hangs under the sidebar head.
  root.querySelectorAll('.is-first-row').forEach((row) => row.classList.remove('is-first-row'));
  reachable[0].classList.add('is-first-row');
  reachable.forEach((button) => { button.tabIndex = -1; });
  (reachable.find((button) => button.classList.contains('is-active')) || reachable[0]).tabIndex = 0;
}

// --- Construction ------------------------------------------------------------
// `levels` describes grouping levels from outside to inside:
//   { key: 'country', attr: 'country', icon: 'Globe', label: (value, entries) => …,
//     idText: (value, entries) => …, sort: (a, b, label) => … }
// `attr` is the data-attribute name (default: key). Tenancies group by `canton`
// but expose it as `data-region`, keeping selection keys consistent across all
// three explorers. `leaf` describes the leaf:
//   { icon: (o) => …, idText: (o) => …, label: (o) => …, objId: (o) => …, sort }
// Leaves automatically carry data attributes for ALL ancestor levels plus
// `data-obj`, exactly the shape read by syncTreeCounts/wireTree/restore.
const compareGerman = (a, b) => String(a).localeCompare(String(b), 'de');

export function treeHTML(C, objects, { levels, leaf, ariaLabel = 'Struktur' }) {
  const esc = C.escape;
  // The count is a bare number in the DOM — the parentheses are drawn by CSS, so
  // scripts and assertions keep reading a number — and it gains a named figure
  // for assistive technology, which would otherwise hear «Schweiz 7».
  const countHTML = (count, unit) => `<span class="pf-tree__n">${count}</span>${
    unit ? `<span class="sr-only"> ${esc(unit)}</span>` : ''}`;
  const rowContent = (icon, idText, label, kindWord) => `${C.icon(icon, 'pf-tree__ico')}${
    kindWord ? `<span class="sr-only">${esc(kindWord)}: </span>` : ''}${
    idText ? `<span class="pf-tree__id">${esc(idText)}</span>` : ''}<span class="pf-tree__label">${esc(label)}</span>`;
  const nodeHTML = (content, count, unit, attrs, children, level) => `<li class="pf-tree__item" role="none">
      <button type="button" class="pf-tree__node interactive-control" role="treeitem" tabindex="-1"
        aria-level="${level}" aria-selected="false" aria-expanded="false" ${attrs}>
        ${C.icon('ChevronRight', 'pf-tree__chev')}${content}${countHTML(count, unit)}
      </button>
      <ul class="pf-tree__children" role="group" hidden>${children}</ul></li>`;

  const attrPairs = (pairs) => pairs.map(([attribute, value]) => `data-${attribute}="${esc(value)}"`).join(' ');

  // Optional level BELOW the leaf: `leaf.children(object)` returns
  // `[{ id, label, icon, idText }]`. The Plan-Editor needs it for the floors of a
  // building — the one place where the thing being chosen sits inside the object
  // rather than beside it. A leaf with children becomes a disclosure that still
  // selects its own object, exactly like a grouping node; every other explorer
  // omits `children` and renders the flat leaf unchanged.
  const subHTML = (object, pairs, level) => {
    const children = leaf.children ? leaf.children(object) : null;
    if (!Array.isArray(children) || !children.length) return '';
    return `<ul class="pf-tree__children" role="group" hidden>${children.map((child) => (
      `<li class="pf-tree__item" role="none"><button type="button" class="pf-tree__sub interactive-control"
        role="treeitem" tabindex="-1" aria-level="${level}" aria-selected="false" ${
        attrPairs([...pairs, ['sub', child.id]])}>${
        rowContent(child.icon || 'Stack', child.idText || '', child.label, leaf.subWord)}</button></li>`
    )).join('')}</ul>`;
  };

  const build = (items, depth, ancestors) => {
    const level = depth + 1;
    if (depth === levels.length) {
      const sorted = leaf.sort ? items.slice().sort(leaf.sort) : items;
      return sorted.map((object) => {
        const pairs = [...ancestors, ['obj', leaf.objId(object)]];
        const children = subHTML(object, pairs, level + 1);
        const count = leaf.count ? leaf.count(object) : null;
        return `<li class="pf-tree__item" role="none"><button type="button" class="pf-tree__leaf interactive-control${
          children ? ' pf-tree__leaf--parent' : ''}" role="treeitem" tabindex="-1"
          aria-level="${level}" aria-selected="false" ${attrPairs(pairs)}${
          children ? ' aria-expanded="false"' : ''}>${
          children ? C.icon('ChevronRight', 'pf-tree__chev') : ''}${
          rowContent(leaf.icon(object), leaf.idText ? leaf.idText(object) : '', leaf.label(object), leaf.word)}${
          count == null ? '' : countHTML(count, leaf.countWord)}</button>${children}</li>`;
      }).join('');
    }
    const levelDef = levels[depth];
    const attribute = levelDef.attr || levelDef.key;
    const groups = new Map();
    for (const object of items) {
      const key = object[levelDef.key];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(object);
    }
    const label = (key, entries) => (levelDef.label ? levelDef.label(key, entries) : key);
    const keys = [...groups.keys()].sort(levelDef.sort
      || ((a, b) => compareGerman(label(a, groups.get(a)), label(b, groups.get(b)))));
    return keys.map((key) => {
      const entries = groups.get(key);
      const pairs = [...ancestors, [attribute, key]];
      return nodeHTML(
        rowContent(levelDef.icon, levelDef.idText ? levelDef.idText(key, entries) : '',
          label(key, entries), levelDef.word),
        entries.length, levelDef.countWord || 'Objekte', attrPairs(pairs),
        build(entries, depth + 1, pairs), level);
    }).join('');
  };
  return `<ul class="pf-tree" role="tree" aria-label="${esc(ariaLabel)}">${build(objects, 0, [])}</ul>`;
}

// Two-tone marking: the selected node is active (blue inner edge), while its
// ancestor path (country › region › city › business entity) uses light grey.
// This keeps the drill-down chain visible despite shallow indentation.
export function markTree(sidebar, activeNode) {
  sidebar.querySelectorAll('.pf-tree__node, .pf-tree__leaf, .pf-tree__sub')
    .forEach((node) => {
      node.classList.remove('is-active', 'is-path');
      if (node.hasAttribute('aria-selected')) node.setAttribute('aria-selected', 'false');
    });
  if (!activeNode) return;
  activeNode.classList.add('is-active');
  if (activeNode.hasAttribute('aria-selected')) activeNode.setAttribute('aria-selected', 'true');
  let item = activeNode.closest('.pf-tree__item');
  while (item) {
    const list = item.parentElement;
    if (!list || !list.classList.contains('pf-tree__children')) break; // Reached the top-level list.
    const parentNode = list.parentElement.querySelector(':scope > .pf-tree__node, :scope > .pf-tree__leaf');
    if (parentNode) parentNode.classList.add('is-path');
    item = list.parentElement;
  }
}

// Click wiring: nodes expand/collapse and select their level, while leaves select
// the object (`selection.id`). `onSelect(selection, node)` receives an object
// keyed by `attrs`; this function maintains markTree.
//
// There is deliberately no clear-selection control here any more. Each explorer
// showed one in its sidebar head while the selection ALSO appeared as a
// removable chip in the active-filter row — two controls for one job, in two
// places. The chip row won: it is where every other filter is cleared.
export function wireTree(sidebar, { attrs = ['country', 'region', 'city', 'businessEntity'], onSelect } = {}) {
  const select = (selection, node) => {
    markTree(sidebar, node);
    onSelect(selection, node);
  };
  const ancestry = (button) => {
    const selection = {};
    for (const key of attrs) if (button.dataset[key]) selection[key] = button.dataset[key];
    return selection;
  };
  // One level per click: a country opens its regions and nothing deeper. Opening
  // a whole branch was tried and rejected — it buries the column, and at estate
  // scale a single click would unfold thousands of rows.
  const toggle = (button) => {
    const children = button.closest('.pf-tree__item').querySelector(':scope > .pf-tree__children');
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    if (children) children.hidden = expanded;
  };
  sidebar.addEventListener('click', (event) => {
    // Sub-leaf (a floor inside its building): selects object plus sub-key.
    const subButton = event.target.closest('.pf-tree__sub');
    if (subButton) {
      const selection = ancestry(subButton);
      selection.id = subButton.dataset.obj;
      selection.sub = subButton.dataset.sub;
      select(selection, subButton);
      return;
    }
    const leafButton = event.target.closest('.pf-tree__leaf');
    if (leafButton) { // Leaf: filter to the object (+ optional map popup), not a detail jump.
      // A leaf with its own children behaves like a node: it opens AND selects.
      if (leafButton.classList.contains('pf-tree__leaf--parent')) toggle(leafButton);
      const selection = ancestry(leafButton);
      selection.id = leafButton.dataset.obj;
      select(selection, leafButton);
      return;
    }
    const node = event.target.closest('.pf-tree__node'); if (!node) return;
    toggle(node);
    const selection = {};
    for (const key of attrs) if (node.dataset[key] != null) selection[key] = node.dataset[key];
    select(selection, node);
  });
  // --- Keyboard: the ARIA tree pattern ---------------------------------------
  // The whole tree is ONE tab stop with a roving tabindex. Before this, every row
  // was its own stop: reaching the map past the property inventory meant pressing
  // Tab through more than a hundred buttons, and the arrow keys did nothing.
  const rows = () => [...sidebar.querySelectorAll('.pf-tree__node, .pf-tree__leaf, .pf-tree__sub')]
    .filter((row) => row.offsetParent !== null);
  const focusRow = (row) => {
    if (!row) return;
    rows().forEach((candidate) => { candidate.tabIndex = -1; });
    row.tabIndex = 0;
    row.focus();
  };
  // Exactly one row is reachable by Tab: the selected one if it is on screen, the
  // first otherwise. Re-run whenever the visible set changes.
  const syncTabStop = () => {
    const visible = rows();
    if (!visible.length) return;
    visible.forEach((row) => { row.tabIndex = -1; });
    (visible.find((row) => row.classList.contains('is-active')) || visible[0]).tabIndex = 0;
  };
  sidebar.addEventListener('keydown', (event) => {
    const row = event.target.closest('.pf-tree__node, .pf-tree__leaf, .pf-tree__sub');
    if (!row || event.ctrlKey || event.metaKey || event.altKey) return;
    const visible = rows();
    const index = visible.indexOf(row);
    const expandable = row.hasAttribute('aria-expanded');
    const open = row.getAttribute('aria-expanded') === 'true';
    const step = (offset) => { event.preventDefault(); focusRow(visible[Math.max(0, Math.min(visible.length - 1, index + offset))]); };
    if (event.key === 'ArrowDown') return step(1);
    if (event.key === 'ArrowUp') return step(-1);
    if (event.key === 'Home') { event.preventDefault(); return focusRow(visible[0]); }
    if (event.key === 'End') { event.preventDefault(); return focusRow(visible[visible.length - 1]); }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (expandable && !open) { toggle(row); syncTabStop(); focusRow(row); } else step(1);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (expandable && open) { toggle(row); syncTabStop(); focusRow(row); return; }
      // Otherwise move to the parent row, which is the level above this list.
      const list = row.closest('.pf-tree__item')?.parentElement;
      const parent = list?.classList.contains('pf-tree__children')
        ? list.parentElement.querySelector(':scope > .pf-tree__node, :scope > .pf-tree__leaf')
        : null;
      focusRow(parent);
    }
  });
  // Clicking also moves the tab stop, so Tab and the pointer never disagree.
  sidebar.addEventListener('click', () => syncTabStop());
  syncTabStop();
  return { syncTabStop };
}

// Restore tree selection from the URL: find its node, expand the path and mark
// it. Filtering already happens through app state; this handles the visible tree
// highlight. Compare via dataset rather than an attribute selector because SAP
// IDs contain «/».
export function restoreTreeSelection(sidebar, selection, { attrs = ['country', 'region', 'city', 'businessEntity'] } = {}) {
  if (!selection || !Object.keys(selection).length) return null;
  // A sub-leaf is a handoff, never a stored selection, so only nodes and leaves
  // are restored here.
  const button = selection.id
    ? [...sidebar.querySelectorAll('.pf-tree__leaf')].find((node) => node.dataset.obj === selection.id)
    : [...sidebar.querySelectorAll('.pf-tree__node')].find((n) =>
        attrs.every((key) => (n.dataset[key] || '') === (selection[key] || '')));
  if (!button) return null;
  let item = button.closest('.pf-tree__item');
  while (item) {
    const list = item.parentElement;
    if (!list || !list.classList.contains('pf-tree__children')) break;
    list.hidden = false;
    const parentNode = list.parentElement.querySelector(':scope > .pf-tree__node, :scope > .pf-tree__leaf');
    if (parentNode) parentNode.setAttribute('aria-expanded', 'true');
    item = list.parentElement;
  }
  // As on click, a restored node also reveals its children.
  if (button.classList.contains('pf-tree__node') || button.classList.contains('pf-tree__leaf--parent')) {
    const children = button.closest('.pf-tree__item').querySelector(':scope > .pf-tree__children');
    button.setAttribute('aria-expanded', 'true');
    if (children) children.hidden = false;
  }
  markTree(sidebar, button);
  return button;
}
