// Verifies the shared sidebar-tree and legacy navigation-list appearance contract.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

// `component` distinguishes the ARIA widget from legacy link navigation.
const SURFACES = [
  ['Liegenschaften Inventar', '/app/portfolio', true, true],
  ['Bauprojekte', '/app/projects', true, true],
  ['Mietendenportal', '/app/tenancies', true, true],
  ['Workspace Management', '/app/workspace', true, true],
  ['Plan-Editor', '/app/floorplan-editor', true, true],
  // Depth is what this probe measures, and the catalogue root is deliberately
  // collapsed — so aim at a scope that actually has three levels on screen.
  ['Geschäftsarchitektur', '/app/metadata-catalog?kind=objekt&leaf=Bauwerk%20und%20Liegenschaft', false, true],
  ['Prozessdokumentation', '/app/process-docs', false, true],
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
  // Measure label starts by depth and alignment between siblings.
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
    // Folded branches render children lazily, so open enough levels before probing.
    if (component) {
      await page.evaluate(`(async () => {
        const w = (ms) => new Promise((r) => setTimeout(r, ms));
        for (let d = 0; d < 2; d++) {
          const shut = document.querySelector('.pf-tree__fold[aria-expanded="false"]')
            || document.querySelector('.pf-tree__row[aria-expanded="false"]');
          if (!shut) break;
          shut.click();
          await w(450);
        }
        return 1;
      })()`);
      await sleep(400);
    }
    const tree = await page.evaluate(READ);
    if (tree.missing) {
      check(false, 'renders a structure tree');
      continue;
    }

    // Indentation must grow with nesting on component and legacy surfaces.
    if (component) {
      // The component stores cumulative indentation in --pf-ind on each item.
      check(tree.ladder.length >= 2 && tree.ladder.every((x, i) => i === 0 || x >= tree.ladder[i - 1]),
        'Leiter faellt nie zurueck', tree.ladder.join(' → ') + 'px');
      check(!tree.siblingsOff.length, 'Geschwister teilen ihren linken Rand',
        tree.siblingsOff.slice(0, 2).join(' · ') || tree.siblingGroups + ' Gruppen geprueft');
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
    // Counts stay numeric in the DOM; punctuation is presentation-only.
    check(tree.countsNumeric, 'Zaehler bleibt im DOM eine blosse Zahl', tree.counts.join(','));
    if (!component) {
      check(/\(/.test(tree.parens) && /\)/.test(tree.parens),
        'shows counts as (n)', tree.parens);
    }

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
        // Re-query after selection because applications may replace the tree DOM.
        stops: [...document.querySelectorAll('.pf-tree__node, .pf-tree__leaf, .pf-tree__sub, .pf-tree__row')]
          .filter((row) => row.offsetParent !== null && row.tabIndex === 0).length };
    })()`);
    check(keys.opened === 'true' && keys.descended !== keys.closed && keys.returned === keys.closed,
      'opens with Right, descends with Down and returns to the parent with Left',
      `${keys.closed} → ${keys.descended} → ${keys.returned}`);
    check(keys.last && keys.last !== keys.first && keys.stops === 1,
      'jumps to the last row with End and keeps one tab stop', keys.last);

    // The guide exists only on the selected branch and remains below its rows.
    const guide = await page.evaluate(`(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const COMPONENT = ${component ? 'true' : 'false'};
      if (COMPONENT) {
        // Ensure the branch is open because keyboard checks may have changed it.
        for (let n = 0; n < 3; n++) {
          const shut = document.querySelector('.pf-tree__section > li > [aria-expanded="false"]');
          if (!shut) break;
          shut.click();
          await wait(450);
        }
        const kid = document.querySelector('.pf-tree__children .pf-tree__row');
        kid?.click();
        await wait(500);
      } else {
        document.querySelector('.pf-tree__leaf')?.click();
        await wait(400);
      }
      const active = document.querySelector(COMPONENT
        ? '.pf-tree__row.is-active, .pf-tree__split.is-active'
        : '.pf-tree :is(.pf-tree__leaf, .pf-tree__node).is-active');
      const holder = active?.closest('.pf-tree__item')?.parentElement;
      const plain = [...document.querySelectorAll('.pf-tree__children')]
        .find((list) => !list.querySelector('.is-active, .is-path'));
      const pseudo = (el) => (el ? getComputedStyle(el, COMPONENT ? '::after' : '::before') : null);
      const row = active && active.classList.contains('pf-tree__split')
        ? active.querySelector('.pf-tree__row') : active;
      return {
        selected: (row || active)?.getAttribute('aria-selected') || '',
        path: document.querySelectorAll('.is-path').length,
        accentWidth: pseudo(holder)?.width || '',
        quietContent: plain ? pseudo(plain).content : 'none',
        activeZ: row ? getComputedStyle(row).zIndex : '',
      };
    })()`);
    check(guide.selected === 'true' && guide.path > 0,
      'marks the selection and its ancestor path', `${guide.path} path rows`);
    if (component) {
      check(guide.accentWidth && guide.accentWidth !== 'auto' && guide.quietContent === 'none',
        'draws the guide only on the branch that holds the selection',
        `${guide.accentWidth} Leitlinie · Ast ohne Auswahl ${guide.quietContent}`);
      check(guide.activeZ === '1', 'keeps the selected row above the guide', `z-index ${guide.activeZ}`);
    } else {
      check(guide.accentWidth === '2px' && guide.quietContent === 'none',
        'draws the guide only on the branch that holds the selection',
        `${guide.accentWidth} accent · unselected branch ${guide.quietContent}`);
      check(guide.activeZ === '2', 'lifts the selected row above the guide', `z-index ${guide.activeZ}`);
    }

    const problems = await page.problems();
    check(problems.length === 0, 'no runtime problems', problems[0] || '');
  }
} finally {
  cdp.close?.();
}

console.log(failures ? `\n✗ ${failures} check(s) FAILED` : '\n✓ all checks passed');
process.exit(failures ? 1 : 0);
