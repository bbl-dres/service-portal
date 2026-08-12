// Favourite locations and rooms — now a thin view onto the ONE bookmark store
// (js/core/bookmarks.js).
//
// This module used to own its own localStorage key with its own shape
// (`{ kind: [id, …] }`, device-local and anonymous). Once anything else in the
// portal could be starred, that made two bookmark stores with two shapes: the
// same person's favourite room would have lived in one and their bookmarked room
// in the other. Room booking keeps calling `favorites.*` and its stars now write
// where every other star writes; `bookmarks` migrates the old key on first read.
//
// The `building` and `room` kinds it uses are part of the shared vocabulary
// (bookmarks.KINDS), so nothing here needs to translate.

import { bookmarks } from './bookmarks.js';

export const favorites = {
  /** All saved identifiers of one kind, oldest first. */
  list: (kind) => bookmarks.listKind(kind),
  has: (kind, id) => bookmarks.has(kind, id),
  /** Saves or removes an item and returns the NEW state (true = saved). */
  toggle: (kind, id) => bookmarks.toggle(kind, id),
};
