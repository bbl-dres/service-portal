// Smoke test for the portal-native BBL Intranetshop.
// Requires the dev server and uses the same dependency-free CDP helper as the
// rest of the project:
//   APP_BASE=http://127.0.0.1:8848/# node scripts/test-shop.mjs

import { launch, openPage, APP_BASE, sleep } from './lib/cdp.mjs';

const ROUTES = [
  ['/applications/eshop', 'BBL Intranetshop'],
  ['/app/shop', 'BBL Intranetshop'],
  ['/app/shop/product/3', 'Bürostuhl Giroflex 64 Anthrazit'],
  ['/app/shop/cart', 'Warenkorb'],
];

const fails = [];
const cdp = await launch();

try {
  const page = await openPage(cdp, `${APP_BASE}/app/shop`);
  await sleep(1200);

  for (const [route, h1Prefix] of ROUTES) {
    const got = await page.evaluate(`(async () => {
      location.hash = '#${route}';
      await new Promise(r => setTimeout(r, 900));
      const h1 = document.querySelector('#main-content h1');
      const err = document.querySelector('#main-content .notification--error');
      const imgs = [...document.querySelectorAll('#main-content img')].slice(0, 5)
        .map(img => ({ src: img.getAttribute('src'), ok: img.complete && img.naturalWidth > 0 }));
      return {
        h1: h1 ? h1.textContent.trim() : '',
        err: err ? err.textContent.trim().slice(0, 160) : '',
        imgs,
      };
    })()`);
    if (got.err) fails.push(`${route} → Fehlerband: ${got.err}`);
    if (!got.h1 || !got.h1.startsWith(h1Prefix)) fails.push(`${route} → h1 «${got.h1}», erwartet «${h1Prefix}…»`);
    if (route === '/app/shop/product/3' && got.imgs.length && got.imgs.some((img) => !img.ok)) {
      fails.push(`${route} → Produktbild nicht geladen: ${got.imgs.filter((img) => !img.ok).map((img) => img.src).join(', ')}`);
    }
    console.log(`  ok  ${route.padEnd(28)} h1=«${got.h1.slice(0, 48)}»`);
  }

  const failedAdd = await page.evaluate(`(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    localStorage.removeItem('bbl_shop_cart_v1');
    location.hash = '#/app/shop';
    await wait(700);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'bbl_shop_cart_v1') throw new DOMException('blocked for test', 'QuotaExceededError');
      return original.call(this, key, value);
    };
    document.querySelector('[data-add]')?.click();
    await wait(100);
    Storage.prototype.setItem = original;
    return {
      cart: localStorage.getItem('bbl_shop_cart_v1'),
      success: [...document.querySelectorAll('.toast__message .notification--success')]
        .some(node => /hinzugefügt/.test(node.textContent)),
      error: document.querySelector('#main-content .notification--error')?.textContent.trim() || '',
    };
  })()`);
  if (failedAdd.cart !== null || failedAdd.success || !/nicht gespeichert/.test(failedAdd.error)) {
    fails.push(`Warenkorb: Speicherfehler als Erfolg behandelt (${JSON.stringify(failedAdd)})`);
  }
  console.log('  ok  Warenkorb meldet fehlgeschlagenes Speichern ohne Erfolgstoast');

  const catalogueCard = await page.evaluate(`(async () => {
    localStorage.removeItem('bbl_shop_cart_v1');
    location.hash = '#/app/shop';
    await new Promise(r => setTimeout(r, 900));
    const card = document.querySelector('.shop-card');
    const btn = card?.querySelector('[data-add]');
    btn?.click();
    await new Promise(r => setTimeout(r, 250));
    const cart = JSON.parse(localStorage.getItem('bbl_shop_cart_v1') || '[]');
    return {
      clickable: card?.classList.contains('card--clickable') || false,
      hasLink: !!card?.querySelector('.card__link'),
      hasImage: !!card?.querySelector('.card__image img'),
      buttonPointer: btn ? getComputedStyle(btn).pointerEvents : '',
      added: cart.reduce((n, r) => n + Number(r.qty || 0), 0),
      headerCart: document.querySelectorAll('#main-header [data-shop-cart-button]:not([hidden])').length,
      headerCount: [...document.querySelectorAll('#main-header [data-cart-count]')].map(x => x.textContent.trim()).join('|'),
      pageCartLink: !!document.querySelector('#main-content .shop-cart-link'),
    };
  })()`);
  if (!catalogueCard.clickable || !catalogueCard.hasLink || !catalogueCard.hasImage) {
    fails.push(`Katalogkarte: CD-Kartenanatomie unvollständig (${JSON.stringify(catalogueCard)})`);
  }
  if (catalogueCard.buttonPointer === 'none' || catalogueCard.added < 1) {
    fails.push(`Katalogkarte: Warenkorb-Knopf nicht bedienbar (${JSON.stringify(catalogueCard)})`);
  }
  if (catalogueCard.headerCart < 1 || !/(^|\\|)1(\\||$)/.test(catalogueCard.headerCount) || catalogueCard.pageCartLink) {
    fails.push(`Warenkorb: Platzierung/Zaehler nicht im Top-Header (${JSON.stringify(catalogueCard)})`);
  }
  console.log(`  ok  Katalogkarte CD-Anatomie add=${catalogueCard.added}`);

  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 320, height: 900, deviceScaleFactor: 1, mobile: false }, page.sessionId);
  const mobileCategories = await page.evaluate(`(async () => {
    location.hash = '#/app/shop';
    await new Promise(r => setTimeout(r, 700));
    const sidebar = document.querySelector('.shop-layout .pf-sidebar');
    const panel = document.querySelector('#shop-filters');
    const toggle = document.querySelector('#shop-filter');
    const initiallyHidden = panel?.hidden;
    toggle?.click();
    await new Promise(r => setTimeout(r, 80));
    const mobileNav = panel?.querySelector('.shop-categories-filter');
    return {
      sidebarHidden: sidebar ? getComputedStyle(sidebar).display === 'none' : false,
      initiallyHidden,
      expanded: toggle?.getAttribute('aria-expanded'),
      panelVisible: panel ? !panel.hidden : false,
      mobileNavVisible: mobileNav ? getComputedStyle(mobileNav).display !== 'none' : false,
      categoryLinks: mobileNav?.querySelectorAll('.pf-tree__leaf').length || 0,
      addHeight: Math.round(document.querySelector('[data-add]')?.getBoundingClientRect().height || 0),
    };
  })()`);
  if (!mobileCategories.sidebarHidden || !mobileCategories.initiallyHidden
      || mobileCategories.expanded !== 'true' || !mobileCategories.panelVisible
      || !mobileCategories.mobileNavVisible || mobileCategories.categoryLinks < 2
      || mobileCategories.addHeight < 44) {
    fails.push(`Mobile Kategorien: Filter-Disclosure unvollständig (${JSON.stringify(mobileCategories)})`);
  }
  console.log(`  ok  Mobile Kategorien im Filter (${mobileCategories.categoryLinks} Links)`);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, page.sessionId);

  const globalCart = await page.evaluate(`(async () => {
    location.hash = '#/';
    await new Promise(r => setTimeout(r, 900));
    return {
      h1: document.querySelector('#main-content h1')?.textContent.trim() || '',
      headerCart: document.querySelectorAll('#main-header [data-shop-cart-button]:not([hidden])').length,
      headerCount: [...document.querySelectorAll('#main-header [data-cart-count]')].map(x => x.textContent.trim()).join('|'),
    };
  })()`);
  if (globalCart.headerCart < 1 || !/(^|\\|)1(\\||$)/.test(globalCart.headerCount)) {
    fails.push(`Warenkorb: Top-Header nicht global sichtbar (${JSON.stringify(globalCart)})`);
  }
  console.log(`  ok  Warenkorb im globalen Top-Header count=${globalCart.headerCount}`);

  const add = await page.evaluate(`(async () => {
    localStorage.removeItem('bbl_shop_cart_v1');
    location.hash = '#/app/shop/product/3';
    await new Promise(r => setTimeout(r, 700));
    document.querySelector('#shop-add-detail')?.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
    await new Promise(r => setTimeout(r, 300));
    location.hash = '#/app/shop/cart';
    await new Promise(r => setTimeout(r, 700));
    return {
      h1: document.querySelector('#main-content h1')?.textContent.trim() || '',
      rows: document.querySelectorAll('.shopping__card').length,
      total: document.querySelector('.total__summary-container')?.textContent.trim() || '',
    };
  })()`);
  if (add.rows < 1) fails.push('Warenkorb: Produkt wurde nicht hinzugefügt');
  console.log(`  ok  Warenkorb nach Hinzufügen rows=${add.rows}`);

  const login = await page.evaluate(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let n = 0;
    while (typeof window.__login !== 'function' && n++ < 120) await sleep(50);
    if (typeof window.__login !== 'function') return 'no __login';
    window.__login();
    return 'login-called';
  })()`).catch((e) => 'login-eval-destroyed: ' + e.message);
  if (login !== 'login-called') fails.push(`Login: ${login}`);
  await sleep(1200);

  const checkout = await page.evaluate(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const submit = () => document.querySelector('#shop-checkout')
      ?.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
    location.hash = '#/app/shop/checkout';
    await sleep(900);
    submit();
    await sleep(300);
    const cc = document.querySelector('#shop-cc');
    const delivery = document.querySelector('#shop-delivery');
    if (cc) cc.value = '810.123';
    if (delivery) delivery.value = 'Fellerstrasse 21, 4. OG, Raum 401';
    submit();
    await sleep(300);
    submit();
    await sleep(700);
    const cases = JSON.parse(localStorage.getItem('bbl_vorgaenge_v1') || '[]');
    const latest = cases[0] || {};
    return {
      h1: document.querySelector('#main-content h1')?.textContent.trim() || '',
      done: document.querySelector('#main-content')?.textContent.includes('Bestellung eingereicht') || false,
      defId: latest.defId || '',
      itemCount: latest.data?.items?.length || 0,
      cart: localStorage.getItem('bbl_shop_cart_v1'),
    };
  })()`);
  if (!checkout.done || checkout.defId !== 'bestellung' || checkout.itemCount < 1) {
    fails.push(`Checkout: Vorgang nicht korrekt erstellt (${JSON.stringify(checkout)})`);
  }
  if (checkout.cart !== null) fails.push('Checkout: Warenkorb wurde nach dem Absenden nicht geleert');
  console.log(`  ok  Checkout Vorgang=${checkout.defId || '-'} items=${checkout.itemCount}`);

  const failedCheckoutCleanup = JSON.parse(await page.evaluate(`(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const submit = () => document.querySelector('#shop-checkout')
      ?.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
    localStorage.setItem('bbl_shop_cart_v1', JSON.stringify([{ id: 3, qty: 1 }]));
    location.hash = '#/app/shop';
    await sleep(150);
    location.hash = '#/app/shop/checkout';
    await sleep(700);
    submit();
    await sleep(100);
    document.querySelector('#shop-cc').value = '810.123';
    document.querySelector('#shop-delivery').value = 'Fellerstrasse 21';
    submit();
    await sleep(100);
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (key === 'bbl_shop_cart_v1') throw new DOMException('blocked for test', 'SecurityError');
      return original.call(this, key);
    };
    submit();
    await sleep(200);
    Storage.prototype.removeItem = original;
    return JSON.stringify({
      done: document.querySelector('#main-content')?.textContent.includes('Bestellung eingereicht') || false,
      cart: localStorage.getItem('bbl_shop_cart_v1'),
      error: document.querySelector('#main-content .notification--error')?.textContent.trim() || '',
    });
  })()`));
  if (failedCheckoutCleanup.done || failedCheckoutCleanup.cart === null || !/nicht geleert/.test(failedCheckoutCleanup.error)) {
    fails.push(`Checkout: fehlgeschlagenes Leeren als Erfolg behandelt (${JSON.stringify(failedCheckoutCleanup)})`);
  }
  console.log('  ok  Checkout bestätigt erst nach persistiertem Leeren des Warenkorbs');

  await page.evaluate(`location.hash = '#/app/shop'; localStorage.removeItem('bbl_shop_cart_v1')`);
  await sleep(300);

  const probs = await page.problems();
  if (probs.length) fails.push(...probs.map((p) => `Seitenproblem: ${p}`));
  await page.closeTarget();
} finally {
  cdp.close();
}

if (fails.length) {
  console.error('\nFEHLER:\n' + fails.map((f) => `  ✗ ${f}`).join('\n'));
  process.exit(1);
}

console.log('\nShop-Routen ok.');
