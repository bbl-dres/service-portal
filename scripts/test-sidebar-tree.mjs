// Focused accessibility contract for split disclosures in the shared sidebar tree.
import { APP_BASE, launch, openPage, sleep } from './lib/cdp.mjs';

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

const press = async (cdp, page, key, code, keyCode, modifiers = 0) => {
  const event = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers };
  const text = key === 'Enter' ? '\r' : key === ' ' ? ' ' : '';
  await cdp.send('Input.dispatchKeyEvent', {
    type: text ? 'keyDown' : 'rawKeyDown', ...event,
    ...(text ? { text, unmodifiedText: text } : {}),
  }, page.sessionId);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...event }, page.sessionId);
};

const cdp = await launch();
let page;
try {
  page = await openPage(cdp, `${APP_BASE}/applications`, { login: true });
  await sleep(500);

  const initial = JSON.parse(await page.evaluate(`(async () => {
    const { sidebarTree } = await import('/js/ui/components/sidebar-tree.js');
    const fixture = document.createElement('section');
    fixture.id = 'sidebar-tree-keyboard-fixture';
    fixture.innerHTML = '<button id="before-tree" type="button">Before</button>'
      + '<div id="nav-tree"></div><button id="after-tree" type="button">After</button>'
      + '<div id="select-tree"></div>';
    document.body.prepend(fixture);

    const children = () => [{ id: 'child', label: 'Child', href: '#/child' }];
    window.__dropNavTree = sidebarTree(document.getElementById('nav-tree'), {
      id: 'keyboard-nav', mode: 'nav', levels: [{ icons: false }, { icons: false }],
      sections: [[{
        id: 'parent', label: 'Parent', href: '#/parent', split: true,
        hasChildren: true, children,
      }]],
    });

    window.__selectCalls = 0;
    window.__dropSelectTree = sidebarTree(document.getElementById('select-tree'), {
      id: 'keyboard-select', mode: 'select', ariaLabel: 'Selection',
      levels: [{ icons: false }, { icons: false }],
      onSelect: () => { window.__selectCalls++; },
      sections: [[{
        id: 'select-parent', label: 'Select parent', href: '#/select-parent', split: true,
        state: 'active', hasChildren: true,
        children: [{ id: 'select-child', label: 'Select child', href: '#/select-child' }],
      }]],
    });

    const navFold = document.querySelector('#nav-tree .pf-tree__fold');
    const selectFold = document.querySelector('#select-tree .pf-tree__fold');
    document.getElementById('before-tree').focus();
    return JSON.stringify({
      navFoldTabIndex: navFold?.tabIndex,
      navFoldExpanded: navFold?.getAttribute('aria-expanded'),
      navChild: !!document.querySelector('#nav-tree [data-node="child"]'),
      selectFoldTabIndex: selectFold?.tabIndex,
      selectTabStops: document.querySelectorAll('#select-tree [tabindex="0"]').length,
      selectSelected: document.querySelector('#select-tree [aria-selected="true"]')?.dataset.node || '',
    });
  })()`));

  check(initial.navFoldTabIndex === 0, 'navigation disclosure is in the sequential tab order',
    String(initial.navFoldTabIndex));
  check(initial.navFoldExpanded === 'false' && !initial.navChild,
    'navigation branch starts collapsed and lazy', initial.navFoldExpanded);
  check(initial.selectFoldTabIndex === -1 && initial.selectTabStops === 1
    && initial.selectSelected === 'select-parent',
  'select mode retains one roving treeitem tab stop', JSON.stringify(initial));

  await press(cdp, page, 'Tab', 'Tab', 9);
  let state = JSON.parse(await page.evaluate(`JSON.stringify({
    activeClass: document.activeElement?.className || '',
    activeFold: document.activeElement?.dataset?.fold || '',
  })`));
  check(state.activeFold === 'parent' && /pf-tree__fold/.test(state.activeClass),
    'Tab reaches the split disclosure before its destination link', JSON.stringify(state));

  await press(cdp, page, 'Enter', 'Enter', 13);
  await sleep(50);
  state = JSON.parse(await page.evaluate(`JSON.stringify({
    expanded: document.querySelector('#nav-tree .pf-tree__fold')?.getAttribute('aria-expanded'),
    child: !!document.querySelector('#nav-tree [data-node="child"]'),
    focus: document.activeElement?.dataset?.fold || '',
    hash: location.hash,
  })`));
  check(state.expanded === 'true' && state.child, 'Enter expands and renders lazy children',
    JSON.stringify(state));
  check(state.focus === 'parent', 'focus returns to the replacement disclosure after Enter', state.focus);
  check(!/parent|child/.test(state.hash), 'fold activation does not navigate', state.hash);

  await press(cdp, page, ' ', 'Space', 32);
  await sleep(50);
  state = JSON.parse(await page.evaluate(`JSON.stringify({
    expanded: document.querySelector('#nav-tree .pf-tree__fold')?.getAttribute('aria-expanded'),
    child: !!document.querySelector('#nav-tree [data-node="child"]'),
    focus: document.activeElement?.dataset?.fold || '',
  })`));
  check(state.expanded === 'false' && !state.child, 'Space collapses the branch', JSON.stringify(state));
  check(state.focus === 'parent', 'focus returns to the replacement disclosure after Space', state.focus);

  const selection = JSON.parse(await page.evaluate(`(() => {
    document.querySelector('#select-tree .pf-tree__fold').click();
    return JSON.stringify({
      calls: window.__selectCalls,
      selected: document.querySelector('#select-tree [aria-selected="true"]')?.dataset.node || '',
      tabStops: document.querySelectorAll('#select-tree [tabindex="0"]').length,
      foldTabIndex: document.querySelector('#select-tree .pf-tree__fold')?.tabIndex,
    });
  })()`));
  check(selection.calls === 0 && selection.selected === 'select-parent',
    'folding does not fire select-mode selection', JSON.stringify(selection));
  check(selection.tabStops === 1 && selection.foldTabIndex === -1,
    'select mode remains a single-tab-stop tree after redraw', JSON.stringify(selection));

  const problems = await page.problems();
  check(problems.length === 0, 'no runtime errors', problems.join(' | '));
} finally {
  await page?.closeTarget();
  cdp.close();
}

console.log(failures ? `\n✗ ${failures} check(s) failed` : '\n✓ all checks passed');
process.exit(failures ? 1 : 0);
