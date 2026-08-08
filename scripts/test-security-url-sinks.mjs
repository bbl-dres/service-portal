// Browser-level proof that rejected URLs never become live DOM navigation or
// resource attributes. The development server must be running.
import { APP_BASE, launch, openPage } from './lib/cdp.mjs';

let failures = 0;
const check = (ok, label) => {
  console.log(`   ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures++;
};

const cdp = await launch();
try {
  const page = await openPage(cdp, `${APP_BASE}/`);
  const result = await page.evaluate(`(async () => {
    const C = (await import('/js/components.js?security-sinks=1')).default;
    const { openGallery } = await import('/js/ui/gallery.js?security-sinks=1');
    const host = document.createElement('div');
    host.innerHTML = [
      C.card({ title: 'Karte', href: 'javascript:alert(1)' }),
      C.downloadItem({ title: 'Datei', href: 'data:text/html,<script>alert(1)</script>' }),
      C.accessCard({ href: '//evil.example/app', external: true }),
    ].join('');
    document.body.appendChild(host);
    const liveUnsafe = [...host.querySelectorAll('a[href],img[src]')].map((el) => el.getAttribute('href') || el.getAttribute('src'));

    const closeUnsafe = openGallery([{
      id: 'hostile', title: 'Hostile', photoSrc: 'javascript:alert(1)',
      href: 'data:text/html,<script>alert(1)</script>', details: [['Quelle', 'Test']],
    }], 0, C);
    await new Promise(requestAnimationFrame);
    const unsafeGallery = {
      downloadHidden: document.querySelector('[data-el="download"]')?.hidden,
      downloadHref: document.querySelector('[data-el="download"]')?.getAttribute('href'),
      imageSrc: document.querySelector('[data-el="img"]')?.getAttribute('src'),
      metaHidden: document.querySelector('[data-el="metalink"]')?.hidden,
      metaHref: document.querySelector('[data-el="metalink"]')?.getAttribute('href'),
    };
    closeUnsafe();

    const closeSafe = openGallery([{
      id: 'safe', title: 'Safe', photoSrc: 'assets/images/BBL-FE21_O-01-800.webp',
      href: '#/app/media-library/safe', details: [['Quelle', 'Test']],
    }], 0, C);
    await new Promise(requestAnimationFrame);
    const safeGallery = {
      downloadHidden: document.querySelector('[data-el="download"]')?.hidden,
      downloadHref: document.querySelector('[data-el="download"]')?.getAttribute('href'),
      metaHidden: document.querySelector('[data-el="metalink"]')?.hidden,
      metaHref: document.querySelector('[data-el="metalink"]')?.getAttribute('href'),
      rel: document.querySelector('[data-el="download"]')?.getAttribute('rel'),
    };
    closeSafe();

    const closeModal = C.openModal({
      title: 'Safe modal', body: '<p>Author body</p>', size: 'xs" onclick="alert(1)',
    });
    const modalShape = {
      className: document.querySelector('.modal')?.className,
      inlineHandler: document.querySelector('.modal')?.hasAttribute('onclick'),
    };
    closeModal();
    host.remove();

    return {
      liveUnsafe,
      unsafeGallery,
      safeGallery,
      modalShape,
      inlineHandlers: document.querySelectorAll('[onclick],[onload],[onerror]').length,
    };
  })()`);

  console.log('■ Browser DOM sinks');
  check(result.liveUnsafe.length === 0, 'component attacks create no live href/src attributes');
  check(result.unsafeGallery.downloadHidden === true && result.unsafeGallery.downloadHref == null,
    'invalid gallery download is hidden and has no href');
  check(result.unsafeGallery.imageSrc == null,
    'invalid gallery image has no src');
  check(result.unsafeGallery.metaHidden === true && result.unsafeGallery.metaHref == null,
    'invalid gallery metadata target is hidden and has no href');
  check(result.safeGallery.downloadHidden === false
    && result.safeGallery.downloadHref === 'assets/images/BBL-FE21_O-01-800.webp',
  'valid relative gallery resource remains downloadable');
  check(result.safeGallery.metaHidden === false
    && result.safeGallery.metaHref === '#/app/media-library/safe',
  'valid internal gallery route remains navigable');
  check(result.safeGallery.rel?.split(/\s+/).includes('noopener')
    && result.safeGallery.rel?.split(/\s+/).includes('noreferrer'),
  'gallery new-window download isolates opener and referrer');
  check(result.modalShape.className === 'modal modal--md' && result.modalShape.inlineHandler === false,
    'modal size uses the component enum and cannot create attributes');
  check(result.inlineHandlers === 0, 'rendered shell contains no executable inline handlers');
  const problems = await page.problems();
  check(problems.length === 0, `no browser exceptions or console errors${problems[0] ? `: ${problems[0]}` : ''}`);
  await page.closeTarget();
} finally {
  cdp.close();
}

console.log(`\n${failures ? `✗ ${failures} check(s) FAILED` : '✓ all checks passed'}`);
process.exit(failures ? 1 : 0);
