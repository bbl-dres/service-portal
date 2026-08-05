// BBL Intranetshop — portal-native first version.
//
// Data and product imagery are adapted from the workspace-management prototype:
// data/shop-products.json, data/shop-categories.json and assets/images/shop/.
// The UI follows this portal's CD Bund layer: catalogueBar/results, pf-tree,
// shopping-card/cart vocabulary, wizardHead and processDone.

import { readJSON, writeJSON, remove } from '../storage.js';
import { chf } from '../format.js';
import * as links from '../links.js';
import { ANWENDUNGEN, trail } from '../crumbs.js';

export const needs = ['shopProducts', 'shopCategories'];

const CART_KEY = 'bbl_shop_cart_v1';
const PER_PAGE = 12;
const SORT_OPTS = [
  ['name-asc', 'Bezeichnung (A-Z)'],
  ['name-desc', 'Bezeichnung (Z-A)'],
  ['price-asc', 'Preis (tiefste zuerst)'],
  ['price-desc', 'Preis (höchste zuerst)'],
  ['new', 'Neuheiten zuerst'],
];
const STEP_LABELS = ['Warenkorb', 'Lieferung', 'Prüfen & Absenden'];

const productImage = (p) => p && p.photo ? `assets/images/shop/${String(p.photo).replace(/^images\//, '')}` : '';
const productPhotos = (p) => {
  const photos = Array.isArray(p.photos) && p.photos.length ? p.photos : [p.photo].filter(Boolean);
  return photos.map((x) => `assets/images/shop/${String(x).replace(/^images\//, '')}`);
};
const asId = (id) => Number(id);

function readCart() {
  const rows = readJSON(CART_KEY, [], Array.isArray);
  return rows
    .map((r) => ({ id: asId(r.id), qty: Math.max(1, Math.min(99, Number.parseInt(r.qty, 10) || 1)) }))
    .filter((r) => Number.isFinite(r.id));
}
function writeCart(rows) {
  const cleaned = rows.filter((r) => r.qty > 0);
  const ok = cleaned.length ? writeJSON(CART_KEY, cleaned) : remove(CART_KEY);
  window.dispatchEvent(new CustomEvent('shop:cartchange'));
  return ok;
}
function addToCart(productId, qty = 1) {
  const id = asId(productId);
  const rows = readCart();
  const row = rows.find((r) => r.id === id);
  if (row) row.qty = Math.min(99, row.qty + qty);
  else rows.push({ id, qty });
  writeCart(rows);
}
function setCartQty(productId, qty) {
  const id = asId(productId);
  const rows = readCart();
  const row = rows.find((r) => r.id === id);
  if (row) row.qty = Math.max(0, Math.min(99, Number.parseInt(qty, 10) || 0));
  writeCart(rows);
}

function flattenCategories(categories, parent = null, depth = 0, out = []) {
  for (const c of categories || []) {
    out.push({ ...c, parent, depth });
    flattenCategories(c.children || [], c.id, depth + 1, out);
  }
  return out;
}
function categoryHelpers(categories) {
  const flat = flattenCategories(categories);
  const byId = new Map(flat.map((c) => [c.id, c]));
  const descendants = new Map();
  const collect = (c) => [c.id, ...(c.children || []).flatMap(collect)];
  for (const c of flat) descendants.set(c.id, collect(c));
  const label = (id) => byId.get(id)?.label || '';
  const contains = (p, catId) => {
    if (!catId || catId === 'alle') return true;
    const ids = descendants.get(catId) || [catId];
    return ids.includes(p.category) || ids.includes(p.subcategory);
  };
  return { flat, byId, descendants, label, contains };
}
function cartLines(core) {
  const products = core.shopProducts();
  return readCart()
    .map((row) => ({ ...row, product: products.find((p) => p.id === row.id) }))
    .filter((row) => row.product);
}
const cartTotal = (lines) => lines.reduce((sum, r) => sum + (Number(r.product.price) || 0) * r.qty, 0);
const cartCount = (lines) => lines.reduce((sum, r) => sum + r.qty, 0);
function updateCartBadges(root, core) {
  const n = cartCount(cartLines(core));
  (root?.ownerDocument || document).querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = String(n); });
  window.__updateShopCart?.();
}

export default async function render(ctx) {
  const { params } = ctx;
  if (params[0] === 'product') return detail(ctx, params[1]);
  if (params[0] === 'cart') return cart(ctx);
  if (params[0] === 'checkout') return checkout(ctx);
  return catalogue(ctx);
}

function catalogue(ctx) {
  const { mount, query, core, C, setTitle, setCrumbs } = ctx;
  setTitle('BBL Intranetshop');
  setCrumbs(trail(ANWENDUNGEN, { label: 'BBL Intranetshop' }));

  const products = core.shopProducts();
  const categories = core.shopCategories();
  const cat = categoryHelpers(categories);
  const rawQ = (query.get('q') || '').trim();
  const activeCat = cat.byId.has(query.get('category')) ? query.get('category') : 'alle';
  const brands = (query.get('brand') || '').split(',').filter(Boolean);
  const flags = (query.get('status') || '').split(',').filter(Boolean);
  const sortKey = SORT_OPTS.some(([v]) => v === query.get('sort')) ? query.get('sort') : 'name-asc';
  const view = ['gallery', 'list'].includes(query.get('view')) ? query.get('view') : 'gallery';

  const base = { q: rawQ, category: activeCat === 'alle' ? '' : activeCat, brand: brands, status: flags, sort: sortKey, view };
  const hash = (patch = {}) => C.catalogueHash('#/app/shop', { ...base, ...patch });

  const needle = rawQ.toLowerCase();
  const matchesQ = (p) => !needle || [p.name, p.description, p.brand, cat.label(p.category), cat.label(p.subcategory)]
    .some((v) => String(v || '').toLowerCase().includes(needle));
  const hits = products.filter((p) => matchesQ(p)
    && cat.contains(p, activeCat)
    && (!brands.length || brands.includes(p.brand))
    && (!flags.length || (flags.includes('new') && p.isNew)));

  const SORTS = {
    'name-asc': (a, b) => a.name.localeCompare(b.name, 'de-CH'),
    'name-desc': (a, b) => b.name.localeCompare(a.name, 'de-CH'),
    'price-asc': (a, b) => (a.price || 0) - (b.price || 0),
    'price-desc': (a, b) => (b.price || 0) - (a.price || 0),
    new: (a, b) => Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)) || a.name.localeCompare(b.name, 'de-CH'),
  };
  const sorted = hits.slice().sort(SORTS[sortKey]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const page = Math.min(Math.max(1, parseInt(query.get('page') || '1', 10) || 1), totalPages);
  const visible = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const brandOpts = [...new Set(products.map((p) => p.brand).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'de-CH'))
    .map((brand) => ({ value: brand, label: brand }));

  const active = [
    ...(rawQ ? [{ label: `Suche: «${rawQ}»`, href: hash({ q: '', page: 1 }) }] : []),
    ...(activeCat !== 'alle' ? [{ label: cat.label(activeCat), href: hash({ category: '', page: 1 }) }] : []),
    ...brands.map((b) => ({ label: b, href: hash({ brand: brands.filter((x) => x !== b), page: 1 }) })),
    ...flags.map(() => ({ label: 'Neuheiten', href: hash({ status: [], page: 1 }) })),
  ];

  const card = (p) => productCard(C, p);
  const listView = (rows) => C.table({
    caption: 'Produkte',
    zebra: true,
    rowsClickable: true,
    columns: [
      { key: 'name', label: 'Produkt', render: (p) => `<a href="${links.shopProdukt(p.id)}">${C.escape(p.name)}</a><br><span class="small muted">${C.escape(p.description)}</span>` },
      { key: 'brand', label: 'Marke', render: (p) => C.escape(p.brand) },
      { key: 'category', label: 'Kategorie', render: (p) => C.escape(cat.label(p.subcategory) || cat.label(p.category)) },
      { key: 'price', label: 'Preis', align: 'right', render: (p) => C.escape(chf(p.price, p.currency || 'CHF')) },
      { key: 'action', label: 'Aktion', render: (p) => `<button type="button" class="btn btn--outline btn--sm btn--icon-left" data-add="${p.id}">${C.icon('ShoppingCart', 'btn__icon')}<span class="btn__text">In den Warenkorb</span></button>` },
    ],
    rows,
  });

  mount.innerHTML = `
  <div class="container section">
    <div class="shop-head">
      ${C.pageHeader({
        title: 'BBL Intranetshop',
        lead: 'Mobiliar, Büro- und Arbeitsplatzmaterial aus dem BBL Sortiment bestellen.',
      })}
    </div>

    ${C.catalogueBar({
      formId: 'shop-search', inputId: 'shopq', searchLabel: 'Produkte suchen',
      placeholder: 'Produkt, Marke oder Kategorie suchen...', q: rawQ,
      countId: 'shop-count',
      count: `<strong>${sorted.length}</strong> von ${products.length} Produkten${totalPages > 1 ? ` · Seite ${page} von ${totalPages}` : ''}`,
      sort: { id: 'shop-sort', value: sortKey, options: SORT_OPTS },
      filterId: 'shop-filter', filterLabel: 'Filter', filterCount: brands.length + flags.length,
      panelId: 'shop-filters', panel: `
        ${C.filterGroup({ dim: 'brand', legend: 'Marke', selected: brands, options: brandOpts })}
        ${C.filterGroup({ dim: 'status', legend: 'Status', selected: flags, options: [{ value: 'new', label: 'Neuheiten' }] })}
        ${C.panelReset({ href: hash({ brand: [], status: [], page: 1 }) })}`,
      view,
    })}
    ${C.activeFilters({ filters: active, resetHref: '#/app/shop' })}

    <div class="pf-layout shop-layout">
      <aside class="pf-sidebar" aria-label="Produktkategorien">
        <div class="pf-sidebar__head">
          <h2 class="pf-sidebar__title">Kategorien</h2>
        </div>
        ${categoryTree(C, categories, {
          active: activeCat,
          href: (id) => hash({ category: id === 'alle' ? '' : id, page: 1 }),
          count: (id) => products.filter((p) => cat.contains(p, id)).length,
        })}
      </aside>
      <main class="pf-main">
        ${C.catalogueResults({
          resetHref: '#/app/shop',
          visible, count: sorted.length, total: products.length, view, page, totalPages, header: false,
          card, listView, unit: { nom: 'Produkte', dat: 'Produkten' }, regionLabel: 'Produkte',
          paginationInputId: 'shop-page', paginationLabel: 'Seitennavigation Produkte',
          paginationHref: (p) => hash({ page: p }),
          available: core.available('shopProducts'),
          emptyMsg: 'Keine Produkte gefunden.',
          unavailableMsg: 'Produkte konnten nicht geladen werden (Ladefehler).',
        })}
      </main>
    </div>
  </div>`;

  C.announceCatalogue({ count: sorted.length, total: products.length, unit: { nom: 'Produkte', dat: 'Produkten' }, page, totalPages, view });
  C.wireCatalogue(mount, {
    formId: 'shop-search', inputId: 'shopq', pageInputId: 'shop-page', page, totalPages, hash,
    sortId: 'shop-sort', filterToggleId: 'shop-filter', panelId: 'shop-filters',
  });
  if (view === 'list') C.wireTableRows(mount);
  wireAddButtons(ctx);
}

function productCard(C, p) {
  return `<div class="card card--default card--clickable shop-card">
    <div class="card__image shop-card__image">
      ${productImage(p) ? `<img src="${C.escape(productImage(p))}" alt="${C.escape(p.name)}" loading="lazy" decoding="async">` : C.icon('Image', 'icon--xl')}
      ${p.isNew ? `<span class="shop-card__badge">${C.badge('Neu', 'info')}</span>` : ''}
    </div>
    <div class="card__content">
      <div class="card__body">
        <h3 class="card__title"><a class="card__link" href="${links.shopProdukt(p.id)}">${C.escape(p.name)}</a></h3>
        <div class="pill-row">${C.badge(p.brand, 'gray')}</div>
        <p class="card__description">${C.escape(p.description)}</p>
      </div>
      <div class="card__footer">
        <div class="card__footer__info"><strong>${C.escape(chf(p.price, p.currency || 'CHF'))}</strong></div>
        <div class="card__footer__action">
          <button type="button" class="btn btn--outline btn--sm btn--icon-left" data-add="${p.id}">
            ${C.icon('ShoppingCart', 'btn__icon')}<span class="btn__text">Hinzufügen</span>
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

function categoryTree(C, categories, opts, depth = 0) {
  const rows = (categories || []).map((cat) => {
    const hasChildren = Array.isArray(cat.children) && cat.children.length;
    const active = opts.active === cat.id;
    const path = hasChildren && flattenCategories(cat.children || []).some((child) => child.id === opts.active);
    const body = `<span class="pf-tree__label">${C.escape(cat.label)}</span><span class="pf-tree__n">${opts.count(cat.id)}</span>`;
    const row = `<li class="pf-tree__item">
      <a class="pf-tree__leaf plain-link${active ? ' is-active' : ''}${path ? ' is-path' : ''}" href="${opts.href(cat.id)}"${active ? ' aria-current="true"' : ''}>
        ${body}
      </a>
      ${hasChildren ? categoryTree(C, cat.children, opts, depth + 1) : ''}
    </li>`;
    return row;
  }).join('');
  return `<ul class="pf-tree pf-tree--plain${depth ? ' pf-tree__children' : ''}">${rows}</ul>`;
}

function detail(ctx, id) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  const p = core.shopProduct(id);
  const cat = categoryHelpers(core.shopCategories());
  if (!p) {
    C.renderNotFound(ctx, {
      title: 'Produkt nicht gefunden',
      backHref: links.shop(), backLabel: 'BBL Intranetshop',
      crumbs: trail(ANWENDUNGEN, { label: 'BBL Intranetshop', href: links.shop() }),
      body: 'Dieses Produkt ist im aktuellen Sortiment nicht vorhanden.',
    });
    return;
  }
  setTitle(p.name);
  setCrumbs(trail(ANWENDUNGEN, { label: 'BBL Intranetshop', href: links.shop() }, { label: p.name }));

  const photos = productPhotos(p);
  const similar = core.shopProducts()
    .filter((x) => x.id !== p.id && (x.subcategory === p.subcategory || x.category === p.category))
    .sort((a, b) => Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)) || a.name.localeCompare(b.name, 'de-CH'))
    .slice(0, 3);
  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: links.shop(), backLabel: 'BBL Intranetshop' })}
    <div class="detail-layout shop-detail">
      <div class="detail-layout__main">
        <div class="shop-product-hero">
          <div class="shop-product-hero__media">
            ${photos.length ? `<img src="${C.escape(photos[0])}" alt="${C.escape(p.name)}">` : C.icon('Image', 'icon--xl')}
          </div>
          <div>
            <p class="eyebrow">${C.escape(p.brand || 'BBL Sortiment')}</p>
            <h1 tabindex="-1">${C.escape(p.name)}</h1>
            <p class="lead">${C.escape(p.description)}</p>
            <div class="pill-row">
              ${p.isNew ? C.badge('Neu', 'info') : ''}
              ${C.badge(cat.label(p.subcategory) || cat.label(p.category) || 'Sortiment', 'gray')}
            </div>
          </div>
        </div>
        ${photos.length > 1 ? `<div class="shop-thumbs" aria-label="Produktbilder">${photos.map((src, i) =>
          `<img src="${C.escape(src)}" alt="${C.escape(`${p.name}, Ansicht ${i + 1}`)}" loading="lazy">`).join('')}</div>` : ''}
        <section class="detail-section">
          <h2 class="detail-section__title">Produktangaben</h2>
          <dl class="kv">
            <dt>Artikelnummer</dt><dd>ART-${String(p.id).padStart(5, '0')}</dd>
            <dt>Marke</dt><dd>${C.escape(p.brand)}</dd>
            <dt>Kategorie</dt><dd>${C.escape(cat.label(p.subcategory) || cat.label(p.category))}</dd>
            <dt>Masse</dt><dd>${p.dimensions ? `${p.dimensions.width} x ${p.dimensions.depth} x ${p.dimensions.height} ${C.escape(p.dimensions.unit || 'cm')}` : '—'}</dd>
            <dt>Preis</dt><dd>${C.escape(chf(p.price, p.currency || 'CHF'))}</dd>
          </dl>
        </section>
        ${similar.length ? `<section class="detail-section">
          <h2 class="detail-section__title">Ähnliche Produkte</h2>
          <div class="grid grid--responsive-cols-3 gap--responsive">
            ${similar.map((item) => C.card({
              title: item.name,
              desc: item.description,
              href: links.shopProdukt(item.id),
              photo: { src: productImage(item), alt: item.name, color: 'var(--color-secondary-50)' },
              badges: [C.badge(item.brand, 'gray')],
              footerInfo: `<strong>${C.escape(chf(item.price, item.currency || 'CHF'))}</strong>`,
              footerAction: C.cardAction(),
            })).join('')}
          </div>
        </section>` : ''}
      </div>
      <aside class="detail-layout__aside">
        <div class="box">
          <h2>Bestellen</h2>
          <p class="shop-price">${C.escape(chf(p.price, p.currency || 'CHF'))}</p>
          <form id="shop-add-detail" class="form">
            ${C.field({ id: 'shop-qty', label: 'Menge',
              control: (cls, attrs) => `<input id="shop-qty" type="number" min="1" max="99" value="1" class="${cls}"${attrs}>` })}
            <button class="btn btn--filled btn--full-width btn--icon-left" type="submit" data-add-detail="${p.id}">
              ${C.icon('ShoppingCart', 'btn__icon')}<span class="btn__text">In den Warenkorb</span>
            </button>
          </form>
        </div>
        ${C.actionCard({ title: 'Weitere Aktionen', links: [
          { href: links.shopWarenkorb(), label: `Warenkorb ansehen (${cartCount(cartLines(core))})` },
          { href: links.dienstleistung('eshop-bestellen'), label: 'Dienstleistung ansehen' },
        ] })}
      </aside>
    </div>
  </div>`;
  wireAddButtons(ctx);
}

function cart(ctx) {
  const { mount, core, C, setTitle, setCrumbs } = ctx;
  setTitle('Warenkorb');
  setCrumbs(trail(ANWENDUNGEN, { label: 'BBL Intranetshop', href: links.shop() }, { label: 'Warenkorb' }));
  const lines = cartLines(core);
  const total = cartTotal(lines);

  mount.innerHTML = `
  <div class="container section">
    ${C.detailBar({ backHref: links.shop(), backLabel: 'BBL Intranetshop' })}
    ${C.pageHeader({ title: 'Warenkorb', lead: lines.length ? 'Prüfen Sie die Bestellpositionen vor dem Absenden.' : 'Der Warenkorb ist leer.' })}
    ${lines.length ? `
      <div class="shopping__cart-order-overview-container shop-cart">
        <ul class="shopping__cart-card-list">
          ${lines.map((line) => cartItem(C, line)).join('')}
        </ul>
        <aside class="shopping__cart-delivery-summary">
          ${summaryBox(C, lines)}
          <div class="shopping__cart__action-container">
            <a class="btn btn--filled btn--full-width btn--icon-right" href="#/app/shop/checkout">
              <span class="btn__text">Bestellung vorbereiten</span>${C.icon('ArrowRight', 'btn__icon')}
            </a>
          </div>
        </aside>
      </div>` : C.empty('Keine Produkte im Warenkorb.', {
        hint: 'Wählen Sie Produkte aus dem Intranetshop aus.',
        action: { href: links.shop(), label: 'Zum Produktkatalog' },
      })}
  </div>`;
  wireCart(ctx);
}

function cartItem(C, line) {
  const p = line.product;
  return `<li class="shopping__card shopping__card--edit">
    <div class="shopping__card__image">
      <span class="shopping__card-image-background"></span>
      ${productImage(p) ? `<img src="${C.escape(productImage(p))}" alt="${C.escape(p.name)}" loading="lazy" decoding="async">` : C.icon('Image', 'icon--xl')}
    </div>
    <div class="shopping__card-details-container">
      <h2 class="card__title"><a href="${links.shopProdukt(p.id)}">${C.escape(p.name)}</a></h2>
      <p class="card__description">${C.escape(p.description)}</p>
      <p class="small muted">${C.escape(p.brand)} · ART-${String(p.id).padStart(5, '0')}</p>
      <p class="shopping__card-price-mobile">${C.escape(chf(p.price, p.currency || 'CHF'))}</p>
    </div>
    <div class="shopping__card-amount-input">
      <label class="sr-only" for="cart-qty-${p.id}">Menge ${C.escape(p.name)}</label>
      <input id="cart-qty-${p.id}" class="input--outline input--sm shop-qty-input" type="number" min="0" max="99" value="${line.qty}" data-qty="${p.id}">
    </div>
    <div class="shopping__card-action-container">
      <p class="shopping__card-price">${C.escape(chf(p.price * line.qty, p.currency || 'CHF'))}</p>
      <div class="shopping__card-action">
        <button type="button" class="btn btn--bare btn--sm btn--icon-left" data-remove="${p.id}">
          ${C.icon('Trash', 'btn__icon')}<span class="btn__text">Entfernen</span>
        </button>
      </div>
    </div>
  </li>`;
}

function summaryBox(C, lines, delivery = null) {
  return `<div class="box total__summary-container">
    <h2 class="total__summary-total-title">Zusammenfassung</h2>
    <dl class="kv">
      <dt>Positionen</dt><dd>${lines.length}</dd>
      <dt>Artikel</dt><dd>${cartCount(lines)}</dd>
      <dt>Total</dt><dd><strong>${C.escape(chf(cartTotal(lines)))}</strong></dd>
      ${delivery ? `<dt>Kostenstelle</dt><dd>${C.escape(delivery.costCenter || '—')}</dd>
      <dt>Lieferadresse</dt><dd>${C.escape(delivery.delivery || '—')}</dd>` : ''}
    </dl>
  </div>`;
}

function checkout(ctx) {
  const { mount, core, engine, session, C, setTitle, setCrumbs } = ctx;
  setTitle('Bestellung absenden');
  setCrumbs(trail(ANWENDUNGEN, { label: 'BBL Intranetshop', href: links.shop() }, { label: 'Warenkorb', href: links.shopWarenkorb() }, { label: 'Bestellung absenden' }));

  const currentLines = () => cartLines(core);
  if (!currentLines().length) { cart(ctx); return; }
  if (!session.isLoggedIn()) {
    mount.innerHTML = `
    <div class="container section container--grid">
      <div class="container__center--xs">
        ${C.backLink(links.shopWarenkorb(), 'Warenkorb')}
        <h1 tabindex="-1">Bestellung absenden</h1>
        <p class="lead">Die Bestellung wird als persönlicher Vorgang unter «Meine Vorgänge» geführt.</p>
        ${C.loginGate('Bitte melden Sie sich mit AGOV / FedLogin an, um die Bestellung abzusenden. Ihr Warenkorb bleibt erhalten.')}
      </div>
    </div>`;
    return;
  }

  const state = {
    step: 1,
    org: session.user().org,
    name: session.user().name,
    costCenter: '',
    delivery: '',
    note: '',
    errors: {},
    created: null,
  };
  const labels = { 'shop-cc': 'Kostenstelle', 'shop-delivery': 'Lieferadresse' };

  function draw() {
    if (state.created) return done();
    if (!currentLines().length) { cart(ctx); return; }
    const restore = C.preserveFocus(mount);
    mount.innerHTML = `
    <div class="container section container--grid">
      <div class="container__center--sm">
        ${C.backLink(links.shopWarenkorb(), 'Warenkorb')}
        <h1 tabindex="-1">Bestellung absenden</h1>
        ${C.contextLine({ action: 'Bestellung', name: state.name, org: state.org, process: 'Bestellt → In Bearbeitung → Geliefert' })}
        ${C.wizardHead(STEP_LABELS, state.step, { legend: state.step === 2 })}
        ${C.errorSummary({ errors: state.errors, labels })}
        <form id="shop-checkout" class="form" novalidate>${state.step === 1 ? stepCart() : state.step === 2 ? stepDelivery() : stepReview()}</form>
      </div>
    </div>`;
    wire();
    restore();
  }
  function stepCart() {
    const lines = currentLines();
    return `<ul class="shopping__cart-card-list">${lines.map((line) => cartItem(C, line)).join('')}</ul>
      ${summaryBox(C, lines)}
      <div class="form__actions"><button class="btn btn--filled btn--icon-right" type="submit"><span class="btn__text">Weiter</span>${C.icon('ArrowRight', 'btn__icon')}</button></div>`;
  }
  function stepDelivery() {
    return `
      ${C.field({ id: 'shop-cc', label: 'Kostenstelle', required: true, message: state.errors['shop-cc'],
        control: (cls, attrs) => `<input id="shop-cc" placeholder="z. B. 810.123" value="${C.escape(state.costCenter)}" class="${cls}"${attrs}>` })}
      ${C.field({ id: 'shop-delivery', label: 'Lieferadresse', required: true, message: state.errors['shop-delivery'],
        control: (cls, attrs) => `<textarea id="shop-delivery" placeholder="Gebäude, Stockwerk, Raum, Kontaktperson" class="${cls}"${attrs}>${C.escape(state.delivery)}</textarea>` })}
      ${C.field({ id: 'shop-note', label: 'Bemerkung',
        control: (cls, attrs) => `<textarea id="shop-note" class="${cls}"${attrs}>${C.escape(state.note)}</textarea>` })}
      <div class="form__actions form__actions--between">
        <button class="btn btn--bare btn--icon-left" type="button" data-back>${C.icon('ChevronLeft', 'btn__icon')}<span class="btn__text">Zurück</span></button>
        <button class="btn btn--filled btn--icon-right" type="submit"><span class="btn__text">Weiter</span>${C.icon('ArrowRight', 'btn__icon')}</button>
      </div>`;
  }
  function stepReview() {
    const lines = currentLines();
    return `
      ${summaryBox(C, lines, state)}
      ${C.table({
        caption: 'Bestellpositionen',
        rows: lines,
        columns: [
          { key: 'product', label: 'Produkt', render: (r) => C.escape(r.product.name) },
          { key: 'qty', label: 'Menge', align: 'right', render: (r) => String(r.qty) },
          { key: 'price', label: 'Betrag', align: 'right', render: (r) => C.escape(chf(r.qty * r.product.price, r.product.currency || 'CHF')) },
        ],
      })}
      ${C.notification('Mit dem Absenden wird eine Bestellung erstellt und an die Logistik BBL weitergeleitet. Der Status erscheint unter <strong>Meine Vorgänge</strong>.', 'info')}
      <div class="form__actions form__actions--between">
        <button class="btn btn--bare btn--icon-left" type="button" data-back>${C.icon('ChevronLeft', 'btn__icon')}<span class="btn__text">Zurück</span></button>
        <button class="btn btn--filled btn--lg btn--icon-left" type="submit">${C.icon('Checkmark', 'btn__icon')}<span class="btn__text">Bestellung absenden</span></button>
      </div>`;
  }
  function readStep() {
    if (state.step !== 2) return;
    Object.assign(state, C.readForm(mount, { costCenter: 'shop-cc', delivery: 'shop-delivery', note: 'shop-note' }));
  }
  function validate() {
    const errors = {};
    if (state.step === 2) {
      if (!state.costCenter.trim()) errors['shop-cc'] = 'Bitte die Kostenstelle angeben';
      if (!state.delivery.trim()) errors['shop-delivery'] = 'Bitte die Lieferadresse angeben';
    }
    state.errors = errors;
    return !Object.keys(errors).length;
  }
  function done() {
    mount.innerHTML = `
    <div class="container section container--grid">
      <div class="container__center--xs">
        ${C.processDone({ instance: state.created, lead: 'Bestellung eingereicht.', title: 'Vielen Dank',
          text: 'Ihre Bestellung wurde erfasst und an die Logistik BBL weitergeleitet. Den Status sehen Sie jederzeit unter «Meine Vorgänge».',
          actions: [
            { href: links.vorgang(state.created.instanceId), label: 'Vorgang ansehen', icon: 'ArrowRight' },
            { href: links.shop(), label: 'Weiter einkaufen' },
          ] })}
      </div>
    </div>`;
    C.focusProcessDone(mount, state.created);
  }
  function wire() {
    wireCart(ctx, draw);
    const form = mount.querySelector('#shop-checkout');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      readStep();
      if (!validate()) { draw(); C.wireErrorSummary(mount); return; }
      if (state.step < 3) { state.step += 1; draw(); C.focusWizardStep(mount, STEP_LABELS, state.step); return; }
      const lines = currentLines();
      if (!lines.length) { cart(ctx); return; }
      state.created = engine.start('bestellung', {
        title: `Bestellung ${cartCount(lines)} Artikel`,
        requester: state.name,
        organization: state.org,
        data: {
          costCenter: state.costCenter,
          delivery: state.delivery,
          note: state.note,
          total: cartTotal(lines),
          items: lines.map((r) => ({ productId: r.product.id, name: r.product.name, quantity: r.qty, unitPrice: r.product.price })),
        },
      });
      if (state.created) {
        remove(CART_KEY);
        window.dispatchEvent(new CustomEvent('shop:cartchange'));
      }
      draw();
      if (!state.created) C.flashError(mount, 'Die Bestellung konnte nicht gespeichert werden — bitte erneut versuchen.');
    });
    const back = mount.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => { readStep(); state.step -= 1; draw(); C.focusWizardStep(mount, STEP_LABELS, state.step); });
    C.wireFieldErrors(mount, state.errors);
  }
  draw();
}

function wireAddButtons(ctx) {
  const { mount, core, C } = ctx;
  mount.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      addToCart(btn.getAttribute('data-add'), 1);
      updateCartBadges(mount, core);
      C.toast('Produkt wurde dem Warenkorb hinzugefügt.', 'success', 'CheckmarkCircle');
    });
  });
  const detailForm = mount.querySelector('#shop-add-detail');
  if (detailForm) detailForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = detailForm.querySelector('[data-add-detail]')?.getAttribute('data-add-detail');
    const qty = Number.parseInt(detailForm.querySelector('#shop-qty')?.value || '1', 10) || 1;
    addToCart(id, Math.max(1, Math.min(99, qty)));
    updateCartBadges(mount, core);
    C.toast('Produkt wurde dem Warenkorb hinzugefügt.', 'success', 'CheckmarkCircle');
  });
}
function wireCart(ctx, redraw = () => cart(ctx)) {
  const { mount } = ctx;
  mount.querySelectorAll('[data-qty]').forEach((input) => {
    input.addEventListener('change', () => { setCartQty(input.getAttribute('data-qty'), input.value); redraw(); });
  });
  mount.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => { setCartQty(btn.getAttribute('data-remove'), 0); redraw(); });
  });
}
