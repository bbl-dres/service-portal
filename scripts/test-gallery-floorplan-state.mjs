// Shared-gallery deep-link and partial floor-plan redraw regression suite.



import { APP_BASE, launch, openPage, sleep } from './lib/cdp.mjs';

let failures = 0;
const check = (condition, label, detail = '') => {
  if (!condition) failures++;
  console.log(`   ${condition ? '✓' : '✗'} ${label}${detail ? `  (${detail})` : ''}`);
};

const browser = await launch({ webgl: true });

async function galleryLink({ label, route, imageId, position, total }) {
  console.log(`\n■ Gallery link — ${label}`);
  const joiner = route.includes('?') ? '&' : '?';
  const page = await openPage(browser, `${APP_BASE}${route}${joiner}bild=${encodeURIComponent(imageId)}`);
  try {
    const result = JSON.parse(await page.evaluate(`(async () => {
      const deadline = performance.now() + 5000;
      while (!document.querySelector('.pf-lightbox') && performance.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const [path, query = ''] = location.hash.split('?');
      return JSON.stringify({
        overlay: !!document.querySelector('.pf-lightbox'),
        path,
        imageId: new URLSearchParams(query).get('bild'),
        position: document.querySelector('.pf-lightbox__sub')?.textContent || '',
        focus: document.activeElement?.getAttribute('data-act') || '',
      });
    })()`));
    check(result.overlay, 'The overlay opens during the first render');
    check(result.path === `#${route.split('?')[0]}`, 'The route path remains unchanged', result.path);
    check(result.imageId === imageId, 'The image ID remains in the hash', result.imageId);
    const expectedPosition = total === 1
      ? !/Bild \d+ von \d+/.test(result.position)
      : result.position.includes(`Bild ${position} von ${total}`);
    check(expectedPosition,
      'The referenced image is restored', result.position.trim());
    check(result.focus === 'close', 'Focus enters the restored dialog', result.focus);
    const problems = await page.problems();
    check(!problems.length, 'There are no runtime errors', problems.join(' | '));
  } finally {
    await page.closeTarget();
  }
}

async function unknownGalleryLink() {
  console.log('\n■ Gallery link — unknown image ID');
  const imageId = 'missing-image';
  const page = await openPage(browser,
    `${APP_BASE}/app/projects/PRJ-04?bild=${encodeURIComponent(imageId)}`);
  try {
    await sleep(500);
    const result = JSON.parse(await page.evaluate(`JSON.stringify({
      overlay: !!document.querySelector('.pf-lightbox'),
      imageId: new URLSearchParams(location.hash.split('?')[1] || '').get('bild'),
      title: document.querySelector('h1')?.textContent?.trim() || '',
    })`));
    check(!result.overlay, 'An unknown ID does not open a fallback image');
    check(result.imageId === imageId, 'An unknown ID remains unchanged in the route', result.imageId);
    check(!!result.title, 'The detail page remains usable', result.title);
    const problems = await page.problems();
    check(!problems.length, 'There are no runtime errors', problems.join(' | '));
  } finally {
    await page.closeTarget();
  }
}

async function staleGalleryRestore() {
  console.log('\n■ Gallery link — stale restoration request');


  const page = await openPage(browser, 'about:blank', { login: true });
  try {
    await browser.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.requestAnimationFrame = (callback) => setTimeout(
        () => callback(performance.now()), 150);`,
    }, page.sessionId);
    const firstId = '1080/4840/AF';
    const secondId = '1080/4850/AG';
    const imageId = '1080/4840/AF-bild-2';
    await browser.send('Page.navigate', {
      url: `${APP_BASE}/app/portfolio?id=${encodeURIComponent(firstId)}&bild=${encodeURIComponent(imageId)}`,
    }, page.sessionId);
    const result = JSON.parse(await page.evaluate(`(async () => {
      const deadline = performance.now() + 5000;
      while (!document.querySelector('h1') && performance.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      history.replaceState(history.state, '',
        '#/app/portfolio?id=${encodeURIComponent(secondId)}&bild=${encodeURIComponent(imageId)}');
      await new Promise((resolve) => setTimeout(resolve, 300));
      return JSON.stringify({
        overlay: !!document.querySelector('.pf-lightbox'),
        id: new URLSearchParams(location.hash.split('?')[1] || '').get('id'),
      });
    })()`));
    check(!result.overlay, 'A stale frame does not open a gallery over the newer route');
    check(result.id === secondId, 'The newer property identity is preserved', result.id);
    const problems = await page.problems();
    check(!problems.length, 'There are no runtime errors', problems.join(' | '));
  } finally {
    await page.closeTarget();
  }
}

try {
  await galleryLink({
    label: 'Property',
    route: `/app/portfolio?id=${encodeURIComponent('1080/4840/AF')}`,
    imageId: '1080/4840/AF-bild-2', position: 3, total: 4,
  });
  await galleryLink({
    label: 'Construction project', route: '/app/projects/PRJ-04',
    imageId: 'PRJ-04-bild-2', position: 3, total: 3,
  });
  await galleryLink({
    label: 'Tenancy', route: '/app/tenancies/MV-2026-001',
    imageId: 'MV-2026-001-bild-1', position: 2, total: 3,
  });
  await galleryLink({
    label: 'Workspace property',
    route: `/app/workspace?id=${encodeURIComponent('1080/6650/AA')}`,
    imageId: '1080-6650-AA-bild-0', position: 1, total: 1,
  });
  await unknownGalleryLink();
  await staleGalleryRestore();

  console.log('\n■ Floor plan — stable subtree');
  const page = await openPage(browser,
    `${APP_BASE}/app/tenancies/MV-2026-001?tab=grundriss&floor=1080-4850-AG-2og&color=use`);
  try {
    await page.evaluate(`(async () => {
      const deadline = performance.now() + 5000;
      while (!document.querySelector('#fp-wrap') && performance.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      window.__reviewCaseSearch = document.querySelector('#tenancy-case-table input[type="search"]');
    })()`);



    await browser.send('Runtime.evaluate', {
      expression: `document.querySelector('#fp-wrap').requestFullscreen()`,
      awaitPromise: true, returnByValue: true, userGesture: true,
    }, page.sessionId);
    await sleep(150);

    const state = JSON.parse(await page.evaluate(`(async () => {
      const first = document.querySelector('.fp__room[data-space]');
      const selectedId = first?.dataset.space || '';
      first?.querySelector('rect')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      const afterPick = {
        fullscreen: document.fullscreenElement?.id || '',
        selected: document.querySelector('.fp__room.is-selected')?.dataset.space || '',
        hiddenTableStable: window.__reviewCaseSearch === document.querySelector('#tenancy-case-table input[type="search"]'),
      };

      document.querySelector('[data-space="' + CSS.escape(selectedId) + '"] rect')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      const afterDeselect = {
        selected: document.querySelectorAll('.fp__room.is-selected').length,
        focusSpace: document.activeElement?.closest?.('[data-space]')?.dataset.space || '',
      };
      document.querySelector('[data-space="' + CSS.escape(selectedId) + '"] rect')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));

      const color = document.querySelector('#fp-color');
      color.value = 'capacity';
      color.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 100));
      const afterColor = {
        fullscreen: document.fullscreenElement?.id || '',
        selected: document.querySelector('.fp__room.is-selected')?.dataset.space || '',
        color: document.querySelector('#fp-color')?.value || '',
        hiddenTableStable: window.__reviewCaseSearch === document.querySelector('#tenancy-case-table input[type="search"]'),
      };

      const otherFloor = [...document.querySelectorAll('.fp-floors [data-floor]')]
        .find((item) => !item.classList.contains('tag-item--active'));
      otherFloor?.focus();
      otherFloor?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const afterFloor = {
        fullscreen: document.fullscreenElement?.id || '',
        floor: document.querySelector('.fp-floors .tag-item--active')?.dataset.floor || '',
        selected: document.querySelectorAll('.fp__room.is-selected').length,
        focusFloor: document.activeElement?.closest?.('[data-floor]')?.dataset.floor || '',
        hiddenTableStable: window.__reviewCaseSearch === document.querySelector('#tenancy-case-table input[type="search"]'),
        hash: location.hash,
      };

      if (document.fullscreenElement) await document.exitFullscreen();
      return JSON.stringify({ selectedId, afterPick, afterDeselect, afterColor, afterFloor });
    })()`));

    check(state.afterPick.fullscreen === 'fp-wrap', 'Room selection preserves fullscreen mode', state.afterPick.fullscreen);
    check(state.afterPick.selected === state.selectedId && !!state.selectedId,
      'One click selects the room exactly once', state.afterPick.selected);
    check(state.afterDeselect.selected === 0 && state.afterDeselect.focusSpace === state.selectedId,
      'A second click clears selection while retaining room focus', state.afterDeselect.focusSpace);
    check(state.afterColor.fullscreen === 'fp-wrap', 'Changing colour preserves fullscreen mode', state.afterColor.fullscreen);
    check(state.afterColor.selected === state.selectedId && state.afterColor.color === 'capacity',
      'Changing colour preserves room selection', `${state.afterColor.selected} · ${state.afterColor.color}`);
    check(state.afterFloor.fullscreen === 'fp-wrap', 'Changing floors preserves fullscreen mode', state.afterFloor.fullscreen);
    check(state.afterFloor.floor === '1080-4850-AG-3og'
      && state.afterFloor.selected === 0 && !state.afterFloor.hash.includes('space=')
      && state.afterFloor.focusFloor === '1080-4850-AG-3og',
    'Changing floors clears only the invalid room selection', state.afterFloor.hash);
    check(state.afterPick.hiddenTableStable && state.afterColor.hiddenTableStable && state.afterFloor.hiddenTableStable,
      'The hidden case table is not remounted');
    const problems = await page.problems();
    check(!problems.length, 'There are no runtime errors', problems.join(' | '));
  } finally {
    await page.closeTarget();
  }
} finally {
  browser.close();
}

console.log(failures ? `\n✗ ${failures} check(s) failed` : '\n✓ all checks passed');
process.exit(failures ? 1 : 0);
