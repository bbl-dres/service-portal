// Probe a construction project's hero image and fullscreen gallery.
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const browser = await launch({ port: 9352 });
for (const id of ['PRJ-04', 'PRJ-02']) {
  const page = await openPage(browser, APP_BASE + `/app/projects/${id}`);
  await sleep(1400);
  console.log(id, await page.evaluate(`(() => {
    const button = document.querySelector('.pj-hero__btn');
    return JSON.stringify({
      button: !!button, aria: button?.getAttribute('aria-label'),
      legend: document.querySelector('.pj-hero .legend')?.textContent.replace(/\\s+/g, ' ').trim(),
      image: !!document.querySelector('.photo img'),
    });
  })()`));
  if (id === 'PRJ-04') {
    const gallery = await page.evaluate(`(async () => {
      document.querySelector('.pj-hero__btn').click();
      await new Promise((resolve) => setTimeout(resolve, 500));
      const overlay = document.querySelector('.pf-lightbox');
      // Read the counter out of the OVERLAY, whose caption carries the image index. A
      // number-slash-number search over document.body matched the object's SAP key
      // instead. It matched nothing at all until now: the pattern carried a
      // single-escaped slash, which in a template literal emits a bare slash that
      // closes the regex early, so the probe threw an invalid-flags error and the
      // harness returned undefined without failing.
      const count = (overlay?.textContent || '').match(/Bild\\s+(\\d+)\\s+von\\s+(\\d+)/);
      return JSON.stringify({ overlay: !!overlay, count, hash: location.hash });
    })()`);
    console.log('   Gallery opened:', gallery);
    await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  }
  const errors = page.problems ? await page.problems() : [...page.exceptions, ...page.consoleErrors];
  console.log('   Errors:', errors.length ? errors.join(' | ') : 'none');
  await page.closeTarget();
}
await browser.close();
