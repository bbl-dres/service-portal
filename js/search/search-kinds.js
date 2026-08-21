// The one list of searchable content kinds.
//
// `kind` is the facet dimension of the results page, the grouping of the
// suggestion list, and the unit a person switches off in the source selection.
// Three consumers, so it needs one source: the order was previously written out
// in the page that happened to need it first, and every later consumer either
// repeated it or invented its own.
//
// ORDER FOLLOWS USE, not the alphabet and not the index size. People open the
// portal to get something done, to open a system, or to look something up — the
// list is sorted by how often each of those brings someone here. It is the same
// ranking `TYPE_BOOST` applies inside the engine (js/search/search-suggest.js);
// stating it once means the two cannot drift apart silently.
export const KINDS = [
  'Dienstleistungen',
  'Anwendungen',
  'Wissen und Hilfsmittel',
  'Datensätze',
  'Datentabellen',
  'Prozesse',
  'Geschäftsobjekte',
  'Dokumente',
  'News',
  'Liegenschaften',
  'Bauprojekte',
];

const RANK = new Map(KINDS.map((kind, index) => [kind, index]));

/**
 * Sort comparator for kind labels. An unknown kind sorts LAST rather than
 * first: a kind added to the index but not to this list should look like an
 * afterthought, not like the most important thing in the portal.
 */
export const byKind = (a, b) =>
  (RANK.has(a) ? RANK.get(a) : KINDS.length) - (RANK.has(b) ? RANK.get(b) : KINDS.length);
