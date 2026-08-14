// The shared structure tree (.pf-tree) as ONE reusable component.
//
// Five explorers build it through js/ui/spatial-tree.js — the property
// inventory, construction projects, tenancies, workspace and the Plan-Editor —
// and three further surfaces hand-roll the same markup as a navigation list:
// the metadata catalogue, the process documentation and the shop's mobile
// category nav. A change to the component or its CSS reaches all eight, so this
// suite checks the contract in one place rather than eight times.
//
// The design is variant H2 of docs/wireframes/260810 - Standortbaum.html:
// indentation as row padding, full-bleed dividers, and a vertical guide only
// along the selected branch. Verified here: the ARIA tree pattern, a single tab
// stop with working arrow keys, indentation that grows with nesting depth, and
// counts that stay machine-readable behind their CSS parentheses.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

// route, tree selector, whether it is built by the shared module
const SURFACES = [
  ['Liegenschaften Inventar', '/app/portfolio', true],
  ['Bauprojekte', '/app/projects', true],
  ['Mietendenportal', '/app/tenancies', true],
  ['Workspace Management', '/app/workspace', true],
  ['Plan-Editor', '/app/floorplan-editor', true],
  // Depth is what this probe measures, and the catalogue root is deliberately
  // collapsed — so aim at a scope that actually has three levels on screen.
  // `component: true` — laeuft auf C.sidebarTree (js/ui/components/sidebar-tree.js)
  ['Metadaten Katalog', '/app/metadata-catalog?kind=objekt&leaf=Bauwerk%20und%20Liegenschaft', false, true],
  ['Prozessdokumentation', '/app/process-docs', false],
];

const READ = `(() => {
  const treeEl = document.querySelector('.pf-tree');
  if (!treeEl) return { missing: true };
  const tree = document.querySelector('.pf-sidebar') || treeEl;
  const ROW = '.pf-tree__node, .pf-tree__leaf, .pf-tree__sub, .pf-tree__row';
  const rows = [...tree.querySelectorAll(ROW)].filter((row) => row.offsetParent !== null);
  const padAt = (depth) => {
    const chain = Array.from({ length: depth }, () => '.pf-tree__children').join(' ');
    const row = treeEl.querySelector(':scope ' + (chain ? chain + ' ' : '') + '> .pf-tree__item > :is(.pf-tree__node,.pf-tree__leaf,.pf-tree__sub,.pf-tree__split)');
    return row ? Math.round(parseFloat(getComputedStyle(row).paddingLeft)) : null;
  };
  // Fuer das Bauteil: wo die Beschriftung je Stufe beginnt, und ob Geschwister
  // — alle Kinder EINER Liste — ihren linken Rand teilen.
  const box = tree.getBoundingClientRect();
  const labelX = (row) => {
    const l = row && row.querySelector('.pf-tree__label');
    return l ? Math.round(l.getBoundingClientRect().left - box.left) : null;
  };
  const ladder = [];
  const seenDepth = new Set();
  tree.querySelectorAll('li').forEach((li) => {
    let d = 0;
    for (let n = li.parentElement; n && n !== tree; n = n.parentElement) {
      if (n.classList && n.classList.contains('pf-tree__children')) d++;
    }
    if (seenDepth.has(d)) return;
    const x = labelX(li.querySelector('.pf-tree__row'));
    if (x == null) return;
    seenDepth.add(d); ladder[d] = x;
  });
  let siblingGroups = 0;
  const siblingsOff = [];
  tree.querySelectorAll('ul').forEach((ul) => {
    const kids = [...ul.children].filter((li) => li.tagName === 'LI');
    if (kids.length < 2) return;
    siblingGroups++;
    const xs = kids.map((li) => labelX(li.querySelector('.pf-tree__row'))).filter((x) => x != null);
    if (xs.length > 1 && Math.max(...xs) !== Math.min(...xs)) {
      siblingsOff.push((kids[0].textContent || '').trim().slice(0, 18) + ': ' + xs.join('/'));
    }
  });
  const counts = [...tree.querySelectorAll('.pf-tree__n')].slice(0, 4).map((n) => n.textContent);
  const first = rows[0];
  return {
    role: treeEl.getAttribute('role') || '',
    treeitems: tree.querySelectorAll('[role="treeitem"]').length,
    groups: tree.querySelectorAll('[role="group"]').length,
    levels: [...new Set([...tree.querySelectorAll('[aria-level]')].map((r) => Number(r.getAttribute('aria-level'))))].sort((a, b) => a - b),
    tabStops: rows.filter((row) => row.tabIndex === 0).length,
    rows: rows.length,
    padding: [padAt(0), padAt(1), padAt(2)],
    // Dividers are LEADING rules, so a row is separated from the one above by
    // its own border-top, the column never ends in a stray line, and the first
    // row keeps the border for equal height but paints it transparent.
    divider: (() => {
      // Measured on the second row in DOM ORDER, not the second visible one: a
      // tree that opens fully collapsed (workspace) shows a single row, and the
      // rule belongs to the element either way.
      const second = [...tree.querySelectorAll(ROW)][1];
      const between = second ? getComputedStyle(second) : null;
      const last = rows.length ? getComputedStyle(rows[rows.length - 1]) : null;
      const head = first ? getComputedStyle(first) : null;
      return {
        between: between ? between.borderTopWidth : '',
        betweenPainted: between ? between.borderTopColor !== 'rgba(0, 0, 0, 0)' : false,
        trailing: last ? last.borderBottomWidth : '',
        leadingPainted: head ? head.borderTopColor !== 'rgba(0, 0, 0, 0)' : false,
      };
    })(),
    ladder: ladder.filter((x) => x != null),
    siblingGroups,
    siblingsOff,
    counts,
    countsNumeric: counts.every((value) => value !== '' && Number.isFinite(Number(value))),
    parens: (() => {
      const n = tree.querySelector('.pf-tree__n');
      if (!n) return 'none';
      return getComputedStyle(n, '::before').content + getComputedStyle(n, '::after').content;
    })(),
  };
})()`;

const cdp = await launch();
try {
  for (const [name, route, shared, component] of SURFACES) {
    console.log(`\n■ ${name}`);
    const page = await openPage(cdp, `${APP_BASE}${route}`, { login: true });
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);
    await sleep(1800);
    const tree = await page.evaluate(READ);
    if (tree.missing) {
      check(false, 'renders a structure tree');
      continue;
    }

    // Indentation must GROW with nesting depth. This is what carries affiliation
    // now that the fake icon-margin indentation is gone, and it has to work for
    // the hand-rolled surfaces too, which is why the CSS keys off nesting rather
    // than aria-level.
    if (component) {
      // Der neue Vertrag. Die Leiter ist eine Summe je Stufe und steht in
      // --pf-ind auf dem Listeneintrag; gemessen wird, wo die BESCHRIFTUNG
      // beginnt, denn das ist, was ein Leser als Einrueckung sieht. Geschwister
      // teilen ihren linken Rand — die Regel, an der die Vorgaenger scheiterten.
      check(tree.ladder.length >= 2 && tree.ladder.every((x, i) => i === 0 || x >= tree.ladder[i - 1]),
        'Leiter faellt nie zurueck', tree.ladder.join(' → ') + 'px');
      check(!tree.siblingsOff.length, 'Geschwister teilen ihren linken Rand',
        tree.siblingsOff.slice(0, 2).join(' · ') || tree.siblingGroups + ' Gruppen geprueft');
      // Und KEINE Zeilentrenner: eine Linie markiert einen Abschnitt, sonst
      // nichts. Sechzehn Kategorien trugen fuenfzehn Striche fuer eine
      // Gliederung, die die Einrueckung schon zeigt.
      check(tree.divider.between === '0px', 'zieht keine Linie zwischen Zeilen',
        'Breite ' + tree.divider.between);
    } else {
      const steps = tree.padding.filter((value) => value != null);
      const grows = steps.every((value, index) => index === 0 || value > steps[index - 1]);
      check(steps.length >= 2 && grows, 'indents each level further than its parent',
        steps.join(' → ') + 'px');
      check(tree.divider.between === '1px' && tree.divider.betweenPainted,
        'separates every row with a divider',
        `${tree.divider.between}, painted: ${tree.divider.betweenPainted}`);
      // The divider is a divider, not an underline: nothing hangs below the last
      // row, and nothing sits above the first one under the sidebar head.
      check(tree.divider.trailing === '0px' && !tree.divider.leadingPainted,
        'draws no rule below the last row or above the first',
        `trailing ${tree.divider.trailing}, leading painted: ${tree.divider.leadingPainted}`);
    }
    // The parentheses are CSS, so the element's text stays the bare number that
    // scripts/check-tree.mjs and the app suites parse.
    check(tree.countsNumeric && /\(/.test(tree.parens) && /\)/.test(tree.parens),
      'shows counts as (n) while keeping the text a bare number',
      `${tree.counts.join(',')} · ${tree.parens}`);

    if (!shared) {
      // A hand-rolled navigation list of links is NOT a tree widget: links should
      // stay links and each is its own tab stop. It only shares the appearance.
      check(tree.role === '', 'stays a navigation list rather than a tree widget', tree.role || 'no role');
      continue;
    }

    check(tree.role === 'tree' && tree.treeitems > 0 && tree.groups > 0,
      'exposes the ARIA tree pattern', `${tree.treeitems} treeitems · ${tree.groups} groups`);
    check(tree.levels.length >= 3 && tree.levels[0] === 1,
      'numbers every level for assistive technology', tree.levels.join(','));
    // One tab stop for the whole tree. Before this the property inventory alone
    // put more than a hundred buttons in the tab order ahead of the map.
    check(tree.tabStops === 1, 'is a single tab stop', `${tree.tabStops} of ${tree.rows} rows`);

    const keys = await page.evaluate(`(async () => {
      const tree = document.querySelector('.pf-tree');
      const start = tree.querySelector('[tabindex="0"]');
      if (!start) return { error: 'no tab stop' };
      start.focus();
      const label = () => (document.activeElement?.querySelector('.pf-tree__label')?.textContent || '').trim();
      const press = (key) => document.activeElement.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      const first = label();
      // Walk to a row that is genuinely CLOSED before testing Right: some trees
      // open their outermost level on load, and Right on an already-open row is
      // supposed to move down instead, which would make this a false failure.
      let guard = 0;
      while (guard++ < 40 && document.activeElement?.getAttribute('aria-expanded') !== 'false') {
        press('ArrowDown');
        await new Promise((r) => setTimeout(r, 20));
      }
      const closed = label();
      press('ArrowRight');
      await new Promise((r) => setTimeout(r, 160));
      const opened = document.activeElement?.getAttribute('aria-expanded');
      press('ArrowDown');
      await new Promise((r) => setTimeout(r, 90));
      const descended = label();
      press('ArrowLeft');
      await new Promise((r) => setTimeout(r, 140));
      const returned = label();
      press('End');
      await new Promise((r) => setTimeout(r, 90));
      const last = label();
      return { first, closed, opened, descended, returned, last,
        stops: [...tree.querySelectorAll('.pf-tree__node, .pf-tree__leaf, .pf-tree__sub')]
          .filter((row) => row.offsetParent !== null && row.tabIndex === 0).length };
    })()`);
    check(keys.opened === 'true' && keys.descended !== keys.closed && keys.returned === keys.closed,
      'opens with Right, descends with Down and returns to the parent with Left',
      `${keys.closed} → ${keys.descended} → ${keys.returned}`);
    check(keys.last && keys.last !== keys.first && keys.stops === 1,
      'jumps to the last row with End and keeps one tab stop', keys.last);

    // The guide appears only along the selected branch, and the selected row sits
    // ABOVE it: the row is where the trace arrives, not something it crosses.
    const guide = await page.evaluate(`(async () => {
      const leaf = document.querySelector('.pf-tree__leaf');
      leaf?.click();
      await new Promise((r) => setTimeout(r, 400));
      const active = document.querySelector('.pf-tree :is(.pf-tree__leaf, .pf-tree__node).is-active');
      const holder = active?.closest('.pf-tree__item')?.parentElement;
      const plain = [...document.querySelectorAll('.pf-tree__children')]
        .find((list) => !list.querySelector('.is-active, .is-path'));
      const before = (element) => (element ? getComputedStyle(element, '::before') : null);
      return {
        selected: active?.getAttribute('aria-selected') || '',
        path: document.querySelectorAll('.pf-tree .is-path').length,
        accentWidth: before(holder)?.width || '',
        accentColour: before(holder)?.backgroundColor || '',
        quietContent: plain ? before(plain).content : 'none',
        activeZ: active ? getComputedStyle(active).zIndex : '',
      };
    })()`);
    check(guide.selected === 'true' && guide.path > 0,
      'marks the selection and its ancestor path', `${guide.path} path rows`);
    check(guide.accentWidth === '2px' && guide.quietContent === 'none',
      'draws the guide only on the branch that holds the selection',
      `${guide.accentWidth} accent · unselected branch ${guide.quietContent}`);
    check(guide.activeZ === '2', 'lifts the selected row above the guide', `z-index ${guide.activeZ}`);

    const problems = await page.problems();
    check(problems.length === 0, 'no runtime problems', problems[0] || '');
  }
} finally {
  cdp.close?.();
}

console.log(failures ? `\n✗ ${failures} check(s) FAILED` : '\n✓ all checks passed');
process.exit(failures ? 1 : 0);
