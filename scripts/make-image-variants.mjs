// Erzeugt kleinere Varianten des Startseiten-Bildes — ohne Bildbibliothek, mit
// dem Browser als Encoder (Canvas → WebP). Das Original bleibt unangetastet.
//
// Warum überhaupt: das Hero-Bild ist 2048×1258 (511 KB) und wird mit höchstens
// ~714 px Breite dargestellt — rund neunmal so viele Pixel wie gebraucht
// (docs/code-review.md §5). Mit `srcset` lädt der Browser die passende Grösse.
//
//   node scripts/make-image-variants.mjs        (Dev-Server muss laufen)
import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';
import { writeFileSync, statSync } from 'node:fs';

const SRC = 'assets/images/BBL-FE21_O-01.avif';
const WIDTHS = [800, 1400];
const QUALITY = 0.82;
const BASE = APP_BASE.replace(/#$/, '');

const cdp = await launch({ port: 9409 });
try {
  const p = await openPage(cdp, `${APP_BASE}/`);
  await sleep(1500);
  for (const w of WIDTHS) {
    const dataUrl = await p.evaluate(`(async () => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = '${BASE}${SRC}';
      await img.decode();
      const scale = ${w} / img.naturalWidth;
      const c = document.createElement('canvas');
      c.width = ${w};
      c.height = Math.round(img.naturalHeight * scale);
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', ${QUALITY});
    })()`);
    if (!dataUrl || !dataUrl.startsWith('data:image/webp')) {
      console.error('  ✗ ' + w + 'w — Encoder lieferte kein WebP:', String(dataUrl).slice(0, 40));
      continue;
    }
    const out = SRC.replace(/\.avif$/, `-${w}.webp`);
    writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('  ✓ ' + out.padEnd(46) + (statSync(out).size / 1024).toFixed(1).padStart(7) + ' KB');
  }
  await p.closeTarget();
} finally { cdp.close(); }
