// Shared limits and CAD conventions for the DWG checker core.

export const LIBREDWG_VERSION = '0.7.9';
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const DWG_FILE_TYPE = 0;
export const PARSER_TIMEOUT_MS = 120_000;
// Plan Check is a local browser prototype: selected bytes are transferred only
// to a same-origin module Worker and are never uploaded by the parser adapter.
export const PLAN_CHECK_INTAKE_ENABLED = true;

// Two kinds of bound live here, and the difference matters.
//
// SIZE CEILINGS are `Infinity`: a drawing is never refused for being large.
// They used to reject real production plans with a browser-safety message,
// which turned an ordinary big file into a dead end instead of a result. That
// refusal is gone, message included. The reference checker
// (bbl-dres/plan-check) enforces no such ceiling either. The browser's own
// memory remains the only real limit; exceeding it surfaces as a normal parser
// failure rather than a rule the checker invented.
//
// SHAPING BOUNDS stay finite. They truncate what is *reported* (handle lists,
// metadata entries, message lengths) or guard termination (block recursion
// depth, coordinate sanity). None of them can refuse a drawing, and each one
// that drops something reports how much it dropped.
const UNLIMITED = Number.POSITIVE_INFINITY;

export const LIMITS = Object.freeze({
  // --- Size ceilings: deliberately removed ---------------------------------
  entities: UNLIMITED,
  layers: UNLIMITED,
  blockRecords: UNLIMITED,
  expandedEntities: UNLIMITED,
  renderPrimitives: UNLIMITED,
  verticesPerPrimitive: UNLIMITED,
  totalVertices: UNLIMITED,
  validationErrors: UNLIMITED,
  validationOperations: UNLIMITED,
  selfIntersectionComparisons: UNLIMITED,
  resultTransferBytes: UNLIMITED,
  resultNodes: UNLIMITED,

  // --- Shaping bounds: what a report shows, and what terminates -------------
  blockExpansionDepth: 16,
  textLength: 4_096,
  changeReasonLength: 1_000,
  metadataEntries: 2_000,
  reportedItems: 2_000,
  visualCenterRefinementVertices: 512,
  visualCenterRefinementIterations: 1_000,
  visualCenterSegmentChecks: 1_000_000,
  coordinateMagnitude: 1e12,
  errorMessageLength: 1_024,
  errorDetailEntries: 16,
});

export const CAFM_LAYERS = Object.freeze({
  required: Object.freeze([
    'R_RAUMPOLYGON',
    'R_AOID',
    'R_GESCHOSSPOLYGON',
    'A_ARCHITEKTUR',
    'A_SCHRAFFUR',
    'V_BEMASSUNG',
    'V_PLANLAYOUT',
  ]),
  optional: Object.freeze([
    'R_RAUMPOLYGON-ABZUG',
    'A_ELEKTRO',
    'A_HEIZUNG-KUEHLUNG',
    'A_LUEFTUNG',
    'A_SANITAER',
    'V_ACHSEN',
    'V_REFERENZPUNKT',
    'V_TEXT',
  ]),
});

export const ALL_CAFM_LAYERS = Object.freeze([
  ...CAFM_LAYERS.required,
  ...CAFM_LAYERS.optional,
]);

export const AOID_TEXT_LAYERS = Object.freeze([
  'V_PLANLAYOUT',
  'V_ACHSEN',
  'V_TEXT',
  'R_AOID',
]);

// AutoCAD Color Index domain palette. These are all 257 raw slots, including
// the ByBlock (0) and ByLayer (256) sentinels. The table was verified during
// the 2026-08-08 audit against AUTO_CAD_COLOR_INDEX in
// @mlightcad/libredwg-web 0.7.9 and copied into core source intentionally: the
// application never loads an engine artifact merely to resolve CAD colors.
export const CAD_COLOR_INDEX = Object.freeze([
  '#000000', '#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FFFFFF',
  '#808080', '#C0C0C0', '#FF0000', '#FF7F7F', '#CC0000', '#CC6666', '#990000', '#994C4C',
  '#7F0000', '#7F3F3F', '#4C0000', '#4C2626', '#FF3F00', '#FF9F7F', '#CC3300', '#CC7F66',
  '#992600', '#995F4C', '#7F1F00', '#7F4F3F', '#4C1300', '#4C2F26', '#FF7F00', '#FFBF7F',
  '#CC6600', '#CC9966', '#994C00', '#99724C', '#7F3F00', '#7F5F3F', '#4C2600', '#4C3926',
  '#FFBF00', '#FFDF7F', '#CC9900', '#CCB266', '#997200', '#99854C', '#7F5F00', '#7F6F3F',
  '#4C3900', '#4C4226', '#FFFF00', '#FFFF7F', '#CCCC00', '#CCCC66', '#989800', '#98984C',
  '#7F7F00', '#7F7F3F', '#4C4C00', '#4C4C26', '#BFFF00', '#DFFF7F', '#99CC00', '#B2CC66',
  '#729800', '#85984C', '#5F7F00', '#6F7F3F', '#394C00', '#424C26', '#7FFF00', '#BFFF7F',
  '#66CC00', '#99CC66', '#4C9800', '#72984C', '#3F7F00', '#5F7F3F', '#264C00', '#394C26',
  '#3FFF00', '#9FFF7F', '#33CC00', '#7FCC66', '#269800', '#5F984C', '#1F7F00', '#4F7F3F',
  '#134C00', '#2F4C26', '#00FF00', '#7FFF7F', '#00CC00', '#66CC66', '#009800', '#4C984C',
  '#007F00', '#3F7F3F', '#004C00', '#264C26', '#00FF3F', '#7FFF9F', '#00CC33', '#66CC7F',
  '#009826', '#4C985F', '#007F1F', '#3F7F4F', '#004C13', '#264C2F', '#00FF7F', '#7FFFBF',
  '#00CC66', '#66CC99', '#00984C', '#4C9872', '#007F3F', '#3F7F5F', '#004C26', '#264C39',
  '#00FFBF', '#7FFFDF', '#00CC99', '#66CCB2', '#009872', '#4C9885', '#007F5F', '#3F7F6F',
  '#004C39', '#264C42', '#00FFFF', '#7FFFFF', '#00CCCC', '#66CCCC', '#009898', '#4C9898',
  '#007F7F', '#3F7F7F', '#004C4C', '#264C4C', '#00BFFF', '#7FDFFF', '#0099CC', '#66B2CC',
  '#007298', '#4C8598', '#005F7F', '#3F6F7F', '#00394C', '#26424C', '#007FFF', '#7FBFFF',
  '#0066CC', '#6699CC', '#004C98', '#4C7298', '#003F7F', '#3F5F7F', '#00264C', '#26394C',
  '#003FFF', '#7F9FFF', '#0033CC', '#667FCC', '#002698', '#4C5F98', '#001F7F', '#3F4F7F',
  '#00134C', '#262F4C', '#0000FF', '#7F7FFF', '#0000CC', '#6666CC', '#000098', '#4C4C98',
  '#00007F', '#3F3F7F', '#00004C', '#26264C', '#3F00FF', '#9F7FFF', '#3300CC', '#7F66CC',
  '#260098', '#5F4C98', '#1F007F', '#4F3F7F', '#13004C', '#2F264C', '#7F00FF', '#BF7FFF',
  '#6600CC', '#9966CC', '#4C0098', '#724C98', '#3F007F', '#5F3F7F', '#26004C', '#39264C',
  '#BF00FF', '#DF7FFF', '#9900CC', '#B266CC', '#720098', '#854C98', '#5F007F', '#6F3F7F',
  '#39004C', '#42264C', '#FF00FF', '#FF7FFF', '#CC00CC', '#CC66CC', '#980098', '#984C98',
  '#7F007F', '#7F3F7F', '#4C004C', '#4C264C', '#FF00BF', '#FF7FDF', '#CC0099', '#CC66B2',
  '#980072', '#984C85', '#7F005F', '#7F3F6F', '#4C0039', '#4C2642', '#FF007F', '#FF7FBF',
  '#CC0066', '#CC6699', '#98004C', '#984C72', '#7F003F', '#7F3F5F', '#4C0026', '#4C2639',
  '#FF003F', '#FF7F9F', '#CC0033', '#CC667F', '#980026', '#984C5F', '#7F001F', '#7F3F4F',
  '#4C0013', '#4C262F', '#333333', '#5B5B5B', '#848484', '#ADADAD', '#D6D6D6', '#FFFFFF',
  '#000000',
]);

export function aciToHex(index) {
  const numeric = Number(index);
  return Number.isInteger(numeric) && numeric >= 0 && numeric < CAD_COLOR_INDEX.length
    ? CAD_COLOR_INDEX[numeric]
    : CAD_COLOR_INDEX[7];
}

export class PlanCheckParserError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'PlanCheckParserError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/**
 * Measure the approximate structured-clone footprint of a result without
 * allocating a JSON copy. This is a diagnostic, not a gate: it reports what the
 * worker is about to transfer so a slow hand-off is explainable, and no size
 * makes it refuse. Cycles terminate because each object is counted once.
 */
export function assertResultBudget(value) {
  const stack = [value];
  const seen = new WeakSet();
  let estimatedBytes = 0;
  let nodes = 0;

  const consume = (bytes) => { estimatedBytes += bytes; };

  while (stack.length) {
    const current = stack.pop();
    if (current == null) { consume(4); continue; }
    if (typeof current === 'string') { consume(8 + current.length * 2); continue; }
    if (typeof current === 'number') { consume(8); continue; }
    if (typeof current === 'boolean') { consume(4); continue; }
    if (typeof current !== 'object') continue;
    // Structured clone preserves shared references. Count each object once;
    // this also guarantees traversal terminates if an unexpected cycle occurs.
    if (seen.has(current)) continue;
    seen.add(current);
    nodes += 1;
    if (current instanceof ArrayBuffer) { consume(current.byteLength); continue; }
    if (ArrayBuffer.isView(current)) { consume(current.byteLength); continue; }
    consume(Array.isArray(current) ? 24 : 32);
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    for (const [key, item] of Object.entries(current)) {
      consume(8 + key.length * 2);
      stack.push(item);
    }
  }

  return Object.freeze({ estimatedBytes, nodes });
}

export function inspectDwgHeader(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 6) {
    throw new PlanCheckParserError('INVALID_DWG_HEADER', 'Die Datei enthält keinen vollständigen DWG-Header.');
  }
  const version = new TextDecoder('ascii').decode(new Uint8Array(buffer, 0, 6));
  // Binary DWG files identify their format with AC10xx. Exact release support is
  // delegated to LibreDWG; this check rejects renamed/non-DWG input cheaply.
  if (!/^AC10\d{2}$/.test(version)) {
    throw new PlanCheckParserError('INVALID_DWG_HEADER', 'Die Datei besitzt keinen gültigen binären DWG-Header.');
  }
  return version;
}

export function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || Math.abs(numeric) > LIMITS.coordinateMagnitude) return fallback;
  return numeric;
}

export function boundedString(value, fallback = '') {
  const text = value == null ? fallback : String(value);
  return text.slice(0, LIMITS.textLength);
}
