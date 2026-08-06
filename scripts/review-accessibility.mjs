// Accessibility smoke review over every representative state. A 720 CSS-px
// viewport at deviceScaleFactor 2 reproduces the reflow pressure of a 1440px
// viewport at 200% zoom while retaining deterministic headless rendering.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';
import { REVIEW_ROUTES } from './review-routes.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const cdp = await launch({ webgl: true });
const findings = [];
const totals = {
  routes: 0,
  overflow: 0,
  positiveTabindex: 0,
  brokenReferences: 0,
  hiddenFocusable: 0,
  focusIndicator: 0,
  mainLandmark: 0,
  unnamedAxControls: 0,
};

const probe = `(() => {
  const visible = el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && !el.hidden && r.width > 0 && r.height > 0;
  };
  const focusables = [...document.querySelectorAll(
    'a[href],button,input:not([type="hidden"]),select,textarea,[tabindex]')]
    .filter(el => visible(el) && !el.disabled && el.tabIndex >= 0);
  const positiveTabindex = focusables.filter(el => el.tabIndex > 0)
    .map(el => el.outerHTML.slice(0, 140));
  const hiddenFocusable = focusables.filter(el => el.closest('[aria-hidden="true"]'))
    .map(el => el.outerHTML.slice(0, 140));
  const refs = [];
  for (const el of document.querySelectorAll('[aria-controls],[aria-labelledby],[aria-describedby]')) {
    for (const attr of ['aria-controls','aria-labelledby','aria-describedby']) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      for (const id of value.split(/\\s+/)) if (id && !document.getElementById(id)) refs.push(attr + ':' + id);
    }
  }
  return {
    overflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - document.documentElement.clientWidth,
    positiveTabindex,
    hiddenFocusable,
    brokenReferences: [...new Set(refs)],
    focusables: focusables.length,
  };
})()`;

function axValue(node, key) {
  return node[key] && typeof node[key] === 'object' ? node[key].value : node[key];
}

try {
  // Angemeldet: die Prüfmatrix läuft ALLE Zustände per Hash-Navigation ab,
  // darunter die Fachanwendungen — die liegen seit 2026-08 hinter der
  // Anmeldesperre (js/router.js) und zeigten sonst nur noch deren Band.
  const page = await openPage(cdp, `${APP_BASE}/`, { login: true });
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 720, height: 900, deviceScaleFactor: 2, mobile: false }, page.sessionId);
  await cdp.send('Accessibility.enable', {}, page.sessionId);

  for (const item of REVIEW_ROUTES) {
    await page.evaluate(`location.hash = '#${item.route}'; true`);
    await sleep(item.slow ? 1500 : 500);
    await page.evaluate('document.fonts.ready');

    const dom = await page.evaluate(probe);
    await page.evaluate(`(() => {
      const current = document.activeElement;
      if (current && current.blur) current.blur();
      document.body.setAttribute('tabindex', '-1');
      document.body.focus();
    })()`);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, page.sessionId);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, page.sessionId);
    const focus = await page.evaluate(`(() => {
      const el = document.activeElement;
      const style = el ? getComputedStyle(el) : null;
      return { tag: el?.tagName || '', name: el?.getAttribute('aria-label') || el?.textContent?.trim() || '',
        outline: style?.outlineStyle || '', width: style?.outlineWidth || '', shadow: style?.boxShadow || '' };
    })()`);
    await page.evaluate(`document.body.removeAttribute('tabindex')`);

    const tree = await cdp.send('Accessibility.getFullAXTree', {}, page.sessionId);
    const nodes = (tree.nodes || []).filter(node => !node.ignored);
    const roles = nodes.map(node => axValue(node, 'role'));
    const controlRoles = new Set([
      'button', 'checkBox', 'comboBox', 'link', 'menuItem', 'radio', 'searchBox',
      'slider', 'spinButton', 'switch', 'tab', 'textField',
    ]);
    const unnamed = nodes.filter(node => controlRoles.has(axValue(node, 'role'))
      && !String(axValue(node, 'name') || '').trim());
    const issues = [];
    if (dom.overflow > 1) { totals.overflow++; issues.push(`overflow ${dom.overflow}px`); }
    if (dom.positiveTabindex.length) { totals.positiveTabindex += dom.positiveTabindex.length; issues.push(`positive tabindex ${dom.positiveTabindex.length}`); }
    if (dom.brokenReferences.length) { totals.brokenReferences += dom.brokenReferences.length; issues.push(`broken aria refs ${dom.brokenReferences.length}`); }
    if (dom.hiddenFocusable.length) { totals.hiddenFocusable += dom.hiddenFocusable.length; issues.push(`focusable under aria-hidden ${dom.hiddenFocusable.length}`); }
    const hasFocusIndicator = focus.outline !== 'none' || (focus.shadow && focus.shadow !== 'none');
    if (dom.focusables && !hasFocusIndicator) { totals.focusIndicator++; issues.push('missing keyboard focus indicator'); }
    if (!roles.includes('main')) { totals.mainLandmark++; issues.push('missing main landmark'); }
    if (unnamed.length) { totals.unnamedAxControls += unnamed.length; issues.push(`unnamed AX controls ${unnamed.length}`); }
    totals.routes++;
    if (issues.length) findings.push({ route: item.route, issues, dom, focus,
      unnamedAxControls: unnamed.slice(0, 8).map(node => ({ role: axValue(node, 'role'), name: axValue(node, 'name') || '' })) });
    console.log(`${item.route} ${issues.length ? 'WARN ' + issues.join(' | ') : 'ok'}`);
  }
  await page.closeTarget();
} finally {
  cdp.close();
}

mkdirSync('docs/review-assets', { recursive: true });
writeFileSync('docs/review-assets/accessibility.json', JSON.stringify({
  generated: new Date().toISOString(),
  method: '720 CSS px at deviceScaleFactor 2 (1440px/200% reflow proxy), keyboard Tab, Chromium accessibility tree',
  routes: REVIEW_ROUTES.map(item => item.route),
  totals,
  findings,
}, null, 2));
console.log('\nSUMMARY ' + JSON.stringify(totals));
process.exit(findings.length ? 1 : 0);
