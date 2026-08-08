// Lifecycle of ONE MapLibre map in a view.
//
// Five apps previously kept their own bookkeeping: portfolio/projects/tenancies
// each had a module variable, `freeXxMap()` and a race-ticket counter, while
// media-library/estate retained a promise resolved and removed in `onUnmount`.
// Both designs solve the same problem and shared the same traps, now handled in
// one place:
//
//  * `initEstateMap` first loads MapLibre from a CDN. Without a race ticket, a
//    second call (search, second tree node) can begin while the first is pending;
//    `free()` then sees `null`, while the first resolved map leaves a WebGL
//    context attached to a removed node.
//  * `free()` runs TWICE per render cycle (at the start of `renderMain` and again
//    in `mount`) and must therefore be idempotent.
//  * The container may leave the document between start and resolution. The map
//    must then be removed immediately rather than assigned.
//
// The caller still supplies its own `initEstateMap(...)`; arguments differ by
// app (only portfolio passes a real parcel FeatureCollection, while others pass
// an empty one or `null`, and `initEstateMap` treats those differently). The slot
// handles ownership and disposal only.
//
//   const mapSlot = createMapSlot();
//   mapSlot.mount(element, (element) => initEstateMap(element, points, parcels, focus));
//   …
//   mapSlot.free();                      // Idempotent at any time.
//   ctx.onUnmount(mapSlot.free);         // One line instead of promise chains.
export function createMapSlot() {
  let map = null;
  let ticket = 0;

  // Remove the current map and invalidate every pending load. Repeated calls are
  // explicitly allowed and become no-ops after the first.
  function free() {
    ticket++;
    if (!map) return;
    try { map.remove(); } catch { /* Already removed. */ }
    map = null;
  }

  // `init(element)` returns the map promise. Returns the map or `null` if the
  // call was superseded or the container disappeared.
  async function mount(el, init) {
    free();
    if (!el) return null;
    const ownTicket = ++ticket;
    let created = null;
    try {
      created = await init(el);
    } catch {
      return null;                 // The map is optional; its error appears in the container.
    }
    if (ownTicket !== ticket || !el.isConnected) {
      if (created) { try { created.remove(); } catch { /* Disposal is best-effort. */ } }
      return null;
    }
    map = created;
    return created;
  }

  return { mount, free, get: () => map };
}
