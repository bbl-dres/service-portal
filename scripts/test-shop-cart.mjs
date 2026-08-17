const values = new Map();
const failedWrites = new Set();
globalThis.localStorage = {
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => {
    if (failedWrites.has(key)) throw new Error('write blocked');
    values.set(key, String(value));
  },
  removeItem: (key) => values.delete(key),
};
globalThis.window = new EventTarget();
globalThis.CustomEvent = class CustomEvent extends Event {};

const {
  SHOP_CART_KEY, addToCart, cartItemCount, readCart, removeCartItems, setCartQty,
} = await import('../js/core/shop-cart.js');
const LOCK_KEY = `${SHOP_CART_KEY}.__lock__`;

if (!addToCart(1, 1)) throw new Error('initial cart mutation failed');
values.set(SHOP_CART_KEY, JSON.stringify([...readCart(), { id: 2, qty: 2 }]));
if (!addToCart(1, 3)) throw new Error('mutation after another tab write failed');
const merged = readCart();
if (merged.find((row) => row.id === 1)?.qty !== 4
  || merged.find((row) => row.id === 2)?.qty !== 2) {
  throw new Error('a later mutation erased another tab\'s item');
}

values.set(SHOP_CART_KEY, JSON.stringify([...merged, { id: 1, qty: 3 }, null]));
const normalized = readCart();
if (normalized.filter((row) => row.id === 1).length !== 1
  || normalized.find((row) => row.id === 1)?.qty !== 7
  || !setCartQty(1, 4)
  || JSON.parse(values.get(SHOP_CART_KEY)).filter((row) => row.id === 1).length !== 1) {
  throw new Error('duplicate or malformed cart rows were not normalized');
}

const orderedSnapshot = readCart();
values.set(SHOP_CART_KEY, JSON.stringify([
  { id: 1, qty: 5 }, { id: 2, qty: 2 }, { id: 3, qty: 1 },
]));
if (!removeCartItems(orderedSnapshot)) throw new Error('ordered snapshot removal failed');
const afterCheckout = readCart();
if (afterCheckout.length !== 2
  || afterCheckout.find((row) => row.id === 1)?.qty !== 1
  || afterCheckout.find((row) => row.id === 3)?.qty !== 1) {
  throw new Error('checkout erased items added after its order snapshot');
}
values.set(SHOP_CART_KEY, JSON.stringify([{ id: 1, qty: 4 }, { id: 2, qty: 2 }]));

const beforeBusy = values.get(SHOP_CART_KEY);
values.set(LOCK_KEY, JSON.stringify({ token: 'other-tab', expires: Date.now() + 60_000 }));
if (setCartQty(1, 8) !== false || values.get(SHOP_CART_KEY) !== beforeBusy) {
  throw new Error('a live cross-tab lease did not reject the mutation');
}
values.delete(LOCK_KEY);

failedWrites.add(SHOP_CART_KEY);
if (addToCart(3, 1) !== false || values.get(SHOP_CART_KEY) !== beforeBusy) {
  throw new Error('a failed durable cart write was reported as success');
}
failedWrites.delete(SHOP_CART_KEY);

if (cartItemCount() !== 6) throw new Error('cart count does not match durable quantities');
console.log('Shop cart storage lifecycle passed.');
