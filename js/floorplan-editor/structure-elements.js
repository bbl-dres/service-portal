// Plan-editor glyphs the design system's icon set does not carry, and the
// catalogue of structural elements the structure menu lists.
//
// These are inline SVG rather than `C.icon()` calls because the design system's
// icon set has no architectural symbols at all — no wall, door, window, column,
// stair or railing — and `C.icon()` can only draw a mask from a file in
// `assets/icons/`. Checked: the set answers «door», «window», «wall», «stair»,
// «column», «railing» and «kitchen» with nothing.
//
// They are drawn the way the elements read on a floor plan, seen from above: a wall
// is a filled band, a door is a leaf with its swing, a window is a band with a
// glazing line. That is the vocabulary the people using this already have from the
// plan itself, so the menu needs no legend.
//
// Every glyph is a 24×24 viewBox using `currentColor`, so it inherits the menu's
// disabled colour without a second rule.

const glyph = (body) => `<svg class="fpe-element-icon" viewBox="0 0 24 24" aria-hidden="true"
  fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square">${body}</svg>`;

/**
 * Two toolbar glyphs that were standing in for missing ones.
 *
 * The room-rectangle tool carried `Apps`, a grid of tiles, which reads as
 * «applications» and not «draw a rectangle». The colour-by control carried
 * `Stack`, stacked layers, which reads as z-order. The set's nearest colour icon
 * is `Brush`, and painting is not what this does either — the plan is shaded by a
 * category, not painted. Both are drawn here for the reason the elements are.
 */
export const TOOL_GLYPHS = {
  // A rectangle being drawn: dashed edges with two corner handles.
  roomArea: glyph('<rect x="4" y="6.5" width="16" height="11" stroke-dasharray="3 2"></rect>'
    + '<rect x="2.4" y="4.9" width="3.2" height="3.2" fill="currentColor" stroke="none"></rect>'
    + '<rect x="18.4" y="15.9" width="3.2" height="3.2" fill="currentColor" stroke="none"></rect>'),
  // Three swatches: one attribute, several values, which is what colouring by
  // attribute actually produces.
  colorBy: glyph('<rect x="3" y="5" width="18" height="4.5" fill="currentColor" stroke="none"></rect>'
    + '<rect x="3" y="11" width="12" height="4.5" fill="currentColor" stroke="none" opacity=".6"></rect>'
    + '<rect x="3" y="17" width="7" height="4.5" fill="currentColor" stroke="none" opacity=".32"></rect>'),
};


export const ELEMENT_GLYPHS = {
  // A band, filled: on a plan a wall is mass, not an outline.
  wall: glyph('<rect x="3" y="9.5" width="18" height="5" fill="currentColor" stroke="none"></rect>'),
  // Leaf plus swing: the arc is what distinguishes a door from an opening.
  door: glyph('<rect x="3" y="10" width="4" height="4" fill="currentColor" stroke="none"></rect>'
    + '<rect x="17" y="10" width="4" height="4" fill="currentColor" stroke="none"></rect>'
    + '<path d="M7 12h7"></path><path d="M14 12a7 7 0 0 0-7-7" stroke-dasharray="2 2"></path>'),
  // A band interrupted by glazing, drawn as the thin line through it.
  window: glyph('<rect x="3" y="10" width="18" height="4"></rect><path d="M3 12h18"></path>'),
  // Wall stubs with nothing between them.
  opening: glyph('<rect x="3" y="9.5" width="5" height="5" fill="currentColor" stroke="none"></rect>'
    + '<rect x="16" y="9.5" width="5" height="5" fill="currentColor" stroke="none"></rect>'),
  // A cabinet run against a wall, with its fronts.
  casework: glyph('<rect x="3" y="8" width="18" height="8"></rect>'
    + '<path d="M9 8v8"></path><path d="M15 8v8"></path>'),
  // A counter run with two hobs.
  kitchen: glyph('<rect x="3" y="8" width="18" height="8"></rect>'
    + '<circle cx="9" cy="12" r="1.6"></circle><circle cx="15" cy="12" r="1.6"></circle>'),
  // A single small mass, free-standing.
  column: glyph('<rect x="9" y="9" width="6" height="6" fill="currentColor" stroke="none"></rect>'),
  // A rail on posts.
  railing: glyph('<path d="M3 8h18"></path><path d="M6 8v8"></path><path d="M12 8v8"></path><path d="M18 8v8"></path>'),
  // Treads with the direction of travel.
  stairs: glyph('<path d="M4 19V5h16"></path><path d="M4 15h5"></path><path d="M4 11h9"></path><path d="M4 7h13"></path>'),
  // A light partition: dashed, because it does not carry.
  divider: glyph('<path d="M3 12h18" stroke-dasharray="3 2.5"></path>'
    + '<path d="M3 9v6"></path><path d="M21 9v6"></path>'),
  // Nothing in particular: the shape stands for «some other element».
  generic: glyph('<path d="M12 4l7 4v8l-7 4-7-4V8z"></path>'),
  // The outer envelope: a closed ring, heavier than an internal wall.
  boundary: glyph('<rect x="4" y="6" width="16" height="12" stroke-width="2.4"></rect>'),
};

/**
 * The structural elements the editor will place, in the order they appear in the
 * menu: enclosure first, then what sits inside it, then what connects levels.
 *
 * Every entry is `available: false`. They are listed as DISABLED menu items rather
 * than left out because the range of elements is itself the information — someone
 * evaluating this needs to see that space management is the target, not just room
 * rectangles. A greyed row makes that visible without promising a date.
 *
 * No keyboard hints. The reference design shows two-letter mnemonics, but printing
 * a shortcut next to a control that cannot run is a promise the application would
 * break the first time anyone tried it.
 */

export const STRUCTURE_ELEMENTS = [
  { key: 'wall', label: 'Wand' },
  { key: 'boundary', label: 'Umfassungswand' },
  { key: 'divider', label: 'Raumteiler' },
  { key: 'door', label: 'Tür' },
  { key: 'window', label: 'Fenster' },
  { key: 'opening', label: 'Öffnung' },
  { key: 'column', label: 'Stütze' },
  { key: 'casework', label: 'Einbaumöbel' },
  { key: 'kitchen', label: 'Küche' },
  { key: 'railing', label: 'Geländer' },
  { key: 'stairs', label: 'Treppe' },
  { key: 'generic', label: 'Generisches Bauteil' },
].map((element) => Object.freeze({ ...element, available: false }));
