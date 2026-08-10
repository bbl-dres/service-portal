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

export function treeHTML(C, objects, { levels, leaf }) {
  const esc = C.escape;
  const rowContent = (icon, idText, label) => `${C.icon(icon, 'pf-tree__ico')}${
    idText ? `<span class="pf-tree__id">${esc(idText)}</span>` : ''}<span class="pf-tree__label">${esc(label)}</span>`;
  const nodeHTML = (content, count, attrs, children) => `<li class="pf-tree__item">
      <button type="button" class="pf-tree__node interactive-control" ${attrs} aria-expanded="false">
        ${C.icon('ChevronRight', 'pf-tree__chev')}${content}<span class="pf-tree__n">${count}</span>
      </button>
      <ul class="pf-tree__children" hidden>${children}</ul></li>`;

  const attrPairs = (pairs) => pairs.map(([attribute, value]) => `data-${attribute}="${esc(value)}"`).join(' ');

  // Optional level BELOW the leaf: `leaf.children(object)` returns
  // `[{ id, label, icon, idText }]`. The Plan-Editor needs it for the floors of a
  // building — the one place where the thing being chosen sits inside the object
  // rather than beside it. A leaf with children becomes a disclosure that still
  // selects its own object, exactly like a grouping node; every other explorer
  // omits `children` and renders the flat leaf unchanged.
  const subHTML = (object, pairs) => {
    const children = leaf.children ? leaf.children(object) : null;
    if (!Array.isArray(children) || !children.length) return '';
    return `<ul class="pf-tree__children" hidden>${children.map((child) => (
      `<li class="pf-tree__item"><button type="button" class="pf-tree__sub interactive-control" ${
        attrPairs([...pairs, ['sub', child.id]])}>${
        rowContent(child.icon || 'Stack', child.idText || '', child.label)}</button></li>`
    )).join('')}</ul>`;
  };

  const build = (items, depth, ancestors) => {
    if (depth === levels.length) {
      const sorted = leaf.sort ? items.slice().sort(leaf.sort) : items;
      return sorted.map((object) => {
        const pairs = [...ancestors, ['obj', leaf.objId(object)]];
        const children = subHTML(object, pairs);
        return `<li class="pf-tree__item"><button type="button" class="pf-tree__leaf interactive-control${
          children ? ' pf-tree__leaf--parent' : ''}" ${attrPairs(pairs)}${children ? ' aria-expanded="false"' : ''}>${
          children ? C.icon('ChevronRight', 'pf-tree__chev') : ''}${
          rowContent(leaf.icon(object), leaf.idText ? leaf.idText(object) : '', leaf.label(object))}</button>${children}</li>`;
      }).join('');
    }
    const level = levels[depth];
    const attribute = level.attr || level.key;
    const groups = new Map();
    for (const object of items) {
      const key = object[level.key];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(object);
    }
    const label = (key, entries) => (level.label ? level.label(key, entries) : key);
    const keys = [...groups.keys()].sort(level.sort || ((a, b) => compareGerman(label(a, groups.get(a)), label(b, groups.get(b)))));
    return keys.map((key) => {
      const entries = groups.get(key);
      const pairs = [...ancestors, [attribute, key]];
      return nodeHTML(rowContent(level.icon, level.idText ? level.idText(key, entries) : '', label(key, entries)), entries.length,
        attrPairs(pairs), build(entries, depth + 1, pairs));
    }).join('');
  };
  return `<ul class="pf-tree">${build(objects, 0, [])}</ul>`;
}

// Two-tone marking: the selected node is active (blue inner edge), while its
// ancestor path (country › region › city › business entity) uses light grey.
// This keeps the drill-down chain visible despite shallow indentation.
export function markTree(sidebar, activeNode) {
  sidebar.querySelectorAll('.pf-tree__node, .pf-tree__leaf, .pf-tree__sub')
    .forEach((node) => node.classList.remove('is-active', 'is-path'));
  if (!activeNode) return;
  activeNode.classList.add('is-active');
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
// keyed by `attrs`; this function maintains markTree and the clear-selection
// button (`clearBtn`, hidden for an empty selection).
export function wireTree(sidebar, { attrs = ['country', 'region', 'city', 'businessEntity'], onSelect, clearBtn } = {}) {
  const select = (selection, node) => {
    markTree(sidebar, node);
    if (clearBtn) clearBtn.hidden = !Object.keys(selection).length;
    onSelect(selection, node);
  };
  const ancestry = (button) => {
    const selection = {};
    for (const key of attrs) if (button.dataset[key]) selection[key] = button.dataset[key];
    return selection;
  };
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
  if (clearBtn) clearBtn.addEventListener('click', () => select({}, null));
}

// Restore tree selection from the URL: find its node, expand the path and mark
// it. Filtering already happens through app state; this handles the visible tree
// highlight. Compare via dataset rather than an attribute selector because SAP
// IDs contain «/».
export function restoreTreeSelection(sidebar, selection, { attrs = ['country', 'region', 'city', 'businessEntity'], clearBtn } = {}) {
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
  if (clearBtn) clearBtn.hidden = false;
  return button;
}
