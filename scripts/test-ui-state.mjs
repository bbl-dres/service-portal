// Lifecycle regressions from docs/code-review.md W-03/W-04/W-05/W-22.
// The dev server must serve the repository root; override APP_BASE as needed.
import { launch, openPage, APP_BASE } from './lib/cdp.mjs';

let failures = 0;
const check = (condition, label, detail = '') => {
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!condition) failures++;
};

const cdp = await launch();
try {
  const page = await openPage(cdp, `${APP_BASE}/app/tenancies`, { login: true });
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
  }, page.sessionId);

  console.log('■ Catalogue teardown');
  const debounce = await page.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let tries = 0;
    while (!document.querySelector('#mt-q') && tries++ < 100) await wait(50);
    const input = document.querySelector('#mt-q');
    if (!input) return { missing: true };
    input.value = 'Bern';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(40);
    location.hash = '#/services';
    tries = 0;
    while (!/Dienstleistungen/.test(document.querySelector('h1')?.textContent || '') && tries++ < 100) await wait(50);
    await wait(400);
    return { hash: location.hash, h1: document.querySelector('h1')?.textContent.trim() || '' };
  })()`);
  check(!debounce.missing && debounce.hash === '#/services' && debounce.h1 === 'Dienstleistungen',
    'a pending search cannot restore the route it belongs to', JSON.stringify(debounce));

  console.log('■ Overlay ownership and action menus');
  const overlay = await page.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    location.hash = '#/app/tenancies';
    let tries = 0;
    while (!document.querySelector('#mt-q') && tries++ < 100) await wait(50);
    const C = (await import('./js/components.js')).default;
    const { openGallery } = await import('./js/ui/gallery.js');
    const { openDocumentViewer } = await import('./js/ui/doc-viewer.js');

    const menuHost = document.createElement('div');
    menuHost.innerHTML = C.menu({ menuId: 'probe-a', items: [{ action: 'a', label: 'A' }] })
      + C.menu({ menuId: 'probe-b', items: [{ action: 'b', label: 'B' }] });
    document.body.appendChild(menuHost);
    C.wireMenu(menuHost);
    const triggers = menuHost.querySelectorAll('.action-menu__trigger');
    triggers[0].click();
    triggers[1].click();
    const menuState = [triggers[0].getAttribute('aria-expanded'), triggers[1].getAttribute('aria-expanded')];
    menuHost.remove();

    openGallery([{
      id: 'probe', title: 'Probe', meta: 'Test', photoSrc: 'assets/swiss-logo-flag.svg',
    }], 0, C, { param: 'bild' });
    const genericShare = document.querySelector('.pf-lightbox [data-act="share"]');
    const genericShareLabel = genericShare?.getAttribute('aria-label') || '';
    genericShare?.click();
    await wait(50);
    const nested = {
      gallery: !!document.querySelector('.pf-lightbox'),
      modal: !!document.querySelector('.modal'),
      lock: document.body.classList.contains('body--overlay-open'),
      shareLabel: genericShareLabel,
      modalTitle: document.querySelector('.modal__title')?.textContent.trim() || '',
    };
    document.querySelector('.modal__close').click();
    await wait(50);
    const afterModal = {
      gallery: !!document.querySelector('.pf-lightbox'),
      modal: !!document.querySelector('.modal'),
      lock: document.body.classList.contains('body--overlay-open'),
    };
    location.hash = '#/services';
    tries = 0;
    while ((document.querySelector('.pf-lightbox') || document.querySelector('.modal')) && tries++ < 100) await wait(50);
    await wait(100);
    const afterRoute = {
      gallery: !!document.querySelector('.pf-lightbox'),
      modal: !!document.querySelector('.modal'),
      lock: document.body.classList.contains('body--overlay-open'),
      hash: location.hash,
    };

    openDocumentViewer({
      docId: 'DOC-PROBE', title: 'Lifecycle probe', type: 'Bericht',
      format: 'PDF', year: 2026, classification: 'Test', sizeKB: 1,
    }, []);
    const documentBefore = {
      viewer: !!document.querySelector('.docviewer'),
      lock: document.body.classList.contains('body--overlay-open'),
    };
    location.hash = '#/knowledge';
    tries = 0;
    while (document.querySelector('.docviewer') && tries++ < 100) await wait(50);
    await wait(100);
    const documentAfter = {
      viewer: !!document.querySelector('.docviewer'),
      lock: document.body.classList.contains('body--overlay-open'),
      hash: location.hash,
    };
    return { menuState, nested, afterModal, afterRoute, documentBefore, documentAfter };
  })()`);
  check(overlay.menuState[0] === 'false' && overlay.menuState[1] === 'true',
    'opening a second menu normalises the old trigger', JSON.stringify(overlay.menuState));
  check(overlay.nested.gallery && overlay.nested.modal && overlay.nested.lock,
    'nested gallery/share dialog retains both owners', JSON.stringify(overlay.nested));
  check(overlay.nested.shareLabel === 'Bild teilen'
    && overlay.nested.modalTitle === 'Aufnahme teilen',
  'ordinary media retains its existing share terminology', JSON.stringify(overlay.nested));
  check(overlay.afterModal.gallery && !overlay.afterModal.modal && overlay.afterModal.lock,
    'closing the nested dialog leaves the gallery locked', JSON.stringify(overlay.afterModal));
  check(!overlay.afterRoute.gallery && !overlay.afterRoute.modal && !overlay.afterRoute.lock,
    'route dispatch closes overlays and releases the lock', JSON.stringify(overlay.afterRoute));
  check(overlay.documentBefore.viewer && overlay.documentBefore.lock
      && !overlay.documentAfter.viewer && !overlay.documentAfter.lock && overlay.documentAfter.hash === '#/knowledge',
    'route dispatch also closes the document viewer', JSON.stringify({ before: overlay.documentBefore, after: overlay.documentAfter }));

  console.log('■ Mobile shell redraw');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  }, page.sessionId);
  const mobile = await page.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    location.hash = '#/app/tenancies';
    let tries = 0;
    while (!document.querySelector('#mt-q') && tries++ < 100) await wait(50);
    document.querySelector('#burger').click();
    const snapshot = () => ({
      menu: document.body.classList.contains('body--mobile-menu-is-open'),
      main: document.querySelector('#main-content').inert,
      footer: document.querySelector('#main-footer').inert,
      expanded: document.querySelector('#burger').getAttribute('aria-expanded'),
    });
    const before = snapshot();
    await window.__logout();
    return { before, after: snapshot() };
  })()`);
  check(mobile.before.menu && mobile.before.main && mobile.before.footer && mobile.before.expanded === 'true',
    'the open drawer owns the mobile page state', JSON.stringify(mobile.before));
  check(!mobile.after.menu && !mobile.after.main && !mobile.after.footer && mobile.after.expanded === 'false',
    'logout redraw clears the mobile page state', JSON.stringify(mobile.after));

  const problems = await page.problems();
  check(problems.length === 0, 'no browser exceptions or console errors', problems.join(' | '));
  await page.closeTarget();
} finally {
  cdp.close();
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
