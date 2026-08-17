import { readJSON, writeJSON, remove, withStorageLock } from './storage.js';

export const SHOP_CART_KEY = 'bbl_shop_cart_v1';

const asId = (id) => Number(id);
const clampQuantity = (qty, fallback) => Math.max(0, Math.min(99, Number.parseInt(qty, 10) || fallback));

function normalizeRows(rows) {
  const quantities = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== 'object') continue;
    const id = asId(row.id);
    if (!Number.isFinite(id)) continue;
    const qty = Math.max(1, clampQuantity(row.qty, 1));
    quantities.set(id, Math.min(99, (quantities.get(id) || 0) + qty));
  }
  return [...quantities].map(([id, qty]) => ({ id, qty }));
}

export function readCart() {
  return normalizeRows(readJSON(SHOP_CART_KEY, [], Array.isArray));
}

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('shop:cartchange'));
}

function persist(rows) {
  const kept = rows.filter((row) => row.qty > 0);
  const ok = kept.length ? writeJSON(SHOP_CART_KEY, kept) : remove(SHOP_CART_KEY);
  if (ok) notify();
  return ok;
}

function mutate(change) {
  const locked = withStorageLock(SHOP_CART_KEY, (owns) => {
    const rows = readCart();
    change(rows);
    return owns() && persist(rows);
  });
  return locked.ok && locked.value === true;
}

export function addToCart(productId, qty = 1) {
  const id = asId(productId);
  const increment = clampQuantity(qty, 0);
  if (!Number.isFinite(id) || increment < 1) return false;
  return mutate((rows) => {
    const row = rows.find((item) => item.id === id);
    if (row) row.qty = Math.min(99, row.qty + increment);
    else rows.push({ id, qty: increment });
  });
}

export function setCartQty(productId, qty) {
  const id = asId(productId);
  if (!Number.isFinite(id)) return false;
  return mutate((rows) => {
    const row = rows.find((item) => item.id === id);
    if (row) row.qty = clampQuantity(qty, 0);
  });
}

export function removeCartItems(items) {
  const ordered = normalizeRows(items);
  if (!ordered.length) return false;
  return mutate((rows) => {
    for (const item of ordered) {
      const row = rows.find((candidate) => candidate.id === item.id);
      if (row) row.qty = Math.max(0, row.qty - item.qty);
    }
  });
}

export function cartItemCount() {
  return readCart().reduce((total, row) => total + row.qty, 0);
}
