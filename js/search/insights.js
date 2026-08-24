// THE SKILL LAYER — the step that runs INSTEAD of a cited paragraph when the
// question asks for a number, a comparison or a location.
//
// js/search/answer.js can only ever repeat prose that already stands in a
// record. That is the right answer for «Wie melde ich eine defekte Heizung?»,
// and it is the wrong shape for «Wieviel m² Bürofläche belegen die Ämter im
// EFD?»: NO record carries that sentence, because the answer does not exist as
// text anywhere — it has to be COMPUTED from 728 room records. Measured, the
// retriever returns nothing for that question and the block says «Keine
// KI-Antwort», which is technically correct and useless.
//
// So a second answer path, and the same discipline as the first:
//
//   * EVERY number here is aggregated from the portal's own datasets. Nothing
//     is written into this file as a value. If a dataset is empty the skill
//     returns null and the ordinary answer block takes over — it never invents
//     a plausible figure, which is the one failure mode a demo must not have.
//   * The result names the records it counted (`basis`) and links the objects it
//     counted them from (`sources`). That is the citation contract of
//     js/search/answer.js applied to an aggregate: a sentence cites a record, a
//     number cites the records it was summed over.
//   * The block SAYS which skill ran. «Dashboard», «Karte», «Direktlink» — the
//     point of the mock-up is that a model does not answer everything in prose;
//     it picks a tool. Where that choice is invisible, nobody can judge it.
//
// COST GATE, same as everywhere else in this folder. `matchSkill()` is a pure
// keyword test over the raw question and touches NO data. Only a question that
// passes it loads the datasets its skill needs (`core.ensure`) — the search
// route must not pull 239 KB of room records because somebody typed «Störung».
// That is the same argument js/search/search-suggest.js makes for the deferred
// catalogues: someone who asks a floor-area question has shown the intent that
// justifies the request, and everyone else pays nothing.
//
// A REAL MODEL would replace `matchSkill` (intent + arguments) and keep
// everything below it: the run functions are the tools it would call, the shape
// they return is the tool result. Nothing about that contract assumes how the
// intent was recognised.

import { formatArea, formatCurrency, formatNumber } from '../format.js';
import * as links from '../links.js';

/* ============================================================ VOCABULARY == */

// German UI: every string a person types. These are matched against the RAW
// question, not against the resolved keywords — «wo» and «wie viel» are exactly
// the function words js/search/query-resolve.js throws away, and they are what
// distinguishes a location question from a floor-area question.
const AREA_WORDS = ['flaeche', 'flaechen', 'bueroflaeche', 'bueroflaechen', 'm2',
  'quadratmeter', 'hnf', 'nutzflaeche', 'buerofl', 'belegen', 'belegt'];
const ORG_WORDS = ['amt', 'aemter', 'amtes', 'departement', 'departemente',
  'verwaltungseinheit', 'verwaltungseinheiten', 've', 'mieter', 'nutzer', 'bundesamt'];
const COST_WORDS = ['betriebskosten', 'kosten', 'nebenkosten', 'unterhaltskosten',
  'bewirtschaftungskosten', 'betriebsaufwand', 'aufwand', 'kostet'];
const PLACE_WORDS = ['liegenschaft', 'liegenschaften', 'gebaeude', 'objekt', 'objekte',
  'immobilie', 'immobilien', 'standort', 'standorte', 'haus', 'botschaft', 'botschaften',
  'vertretung', 'vertretungen', 'areal'];
const WHERE_WORDS = ['wo', 'karte', 'standort', 'standorte', 'stehen', 'liegen',
  'befinden', 'gelegen', 'verteilt', 'verteilung'];

// A street name is the strongest signal that a property is meant, and it needs
// no data to recognise. Without it, every question containing «Kosten» would
// pull the property registers just to discover that no property was named.
const STREET_SUFFIX = /(?:strasse|str|weg|platz|gasse|allee|ring|hof|quai|matte|feld)$/;

/** Fold a question into comparable tokens. Umlauts to their two-letter
 *  spelling and «m²» to «m2», so a person may type either. */
function tokens(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/²/g, '2')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
const has = (list, words) => words.some((word) => list.includes(word));

/** One address line from the normalised building shape (js/core/index.js). The
 *  raw Golden Record carries a ready-made `adr_conct`, the normalised record
 *  does not — composing it here keeps every caller reading the same fields. */
const addressOf = (building) => [building.street, [building.zip, building.city]
  .filter(Boolean).join(' ')].filter(Boolean).join(', ');

/* ============================================================== MATCHING == */

/**
 * Which skill does this question ask for, and what does that skill need loaded?
 *
 *   { id, skill, needs: string[], label }   or   null
 *
 * PURE and data-free by design — see the cost gate above. `run()` may still
 * decide the question cannot be answered once it sees the records; the caller
 * then falls back to the ordinary answer block.
 */
export function matchSkill(raw) {
  const words = tokens(raw);
  if (!words.length) return null;

  const namesPlace = has(words, PLACE_WORDS) || words.some((word) => STREET_SUFFIX.test(word));

  // Costs of ONE property. Requires a property to be named — «Was kostet ein
  // Sitzungsraum?» is a price question about a service, not an aggregate over a
  // cost register, and must not reach here.
  if (has(words, COST_WORDS) && namesPlace) {
    return { id: 'operating-costs', skill: 'dashboard', label: 'Dashboard',
      needs: ['buildings', 'costs', 'areas'] };
  }

  // Floor area per organisational unit.
  if (has(words, AREA_WORDS) && (has(words, ORG_WORDS) || findScope(words))) {
    return { id: 'office-area', skill: 'dashboard', label: 'Dashboard',
      needs: ['buildings', 'spaces'] };
  }

  // Where something stands. The location word alone is not enough: «Wo melde ich
  // eine Störung?» is a service question and the ordinary answer handles it far
  // better than a map with no points on it.
  if (has(words, WHERE_WORDS) && namesPlace) {
    return { id: 'property-map', skill: 'map', label: 'Karte', needs: ['buildings'] };
  }

  return null;
}

/** A department or agency named in the question, if any. Reads the abbreviation
 *  vocabulary that data/reference-data.json carries — not a second copy of it. */
let SCOPE_INDEX = null;
export function primeScopeIndex(reference) {
  const departments = (reference && reference.departments) || [];
  const agencies = (reference && reference.agencyDepartment) || {};
  SCOPE_INDEX = {
    department: new Map(departments.map((entry) => [entry.id.toLowerCase(), entry])),
    agency: new Map(Object.keys(agencies).map((key) => [key.toLowerCase(), key])),
    agencies,
    departments,
  };
  return SCOPE_INDEX;
}
function findScope(words) {
  if (!SCOPE_INDEX) return null;
  for (const word of words) {
    const department = SCOPE_INDEX.department.get(word);
    if (department) return { type: 'department', key: department.id, label: department.label };
  }
  for (const word of words) {
    const agency = SCOPE_INDEX.agency.get(word);
    if (agency) return { type: 'agency', key: agency, label: agency };
  }
  return null;
}

/* ================================================================ SKILLS == */

// Which room uses count as «Bürofläche». Deliberately BROADER than the single
// use label «Büro»: a Multispace floor books the same work function as Open
// Space and Fokusraum, and counting only cellular offices would understate every
// modern building against every old one — the comparison would be an artefact of
// the fit-out, not of the area. The chosen set is named in the block's footnote,
// because a number whose definition is invisible cannot be checked.
const OFFICE_USES = ['Büro', 'Open Space', 'Fokusraum'];

const round = (value) => Math.round(value);
// Two decimals for a per-square-metre figure. «CHF 49.3» reads as a truncated
// number rather than as a rappen amount.
const RAPPEN = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/**
 * Bürofläche per organisational unit, from data/spaces.json.
 *
 * The scope decides the CUT, never the data: with a department named, the
 * department's agencies are broken out and the other departments stay on the
 * chart beside it — a number without its neighbours cannot be judged, and «is
 * that a lot?» is the question actually being asked.
 */
function officeArea(core, raw) {
  const words = tokens(raw);
  const reference = core.ref();
  const index = primeScopeIndex(reference);
  const scope = findScope(words);
  const agencyDepartment = index.agencies;
  const departmentLabel = (id) => (index.departments.find((entry) => entry.id === id) || {}).label || id;

  const buildingName = new Map(core.buildings().map((building) => [building.bbl_id, building.name]));
  const rooms = core.spaces().filter((room) => room.occupierVe && OFFICE_USES.includes(room.useLabel));
  if (!rooms.length) return null;

  // One pass, three groupings. Everything below reads from these maps, so the
  // totals on the tiles and the bars in the chart cannot drift apart.
  const perDepartment = new Map();
  const perAgency = new Map();
  const perAgencyBuilding = new Map();
  let grandTotal = 0;
  for (const room of rooms) {
    const agency = room.occupierVe;
    const department = agencyDepartment[agency] || 'Übrige';
    const area = Number(room.area) || 0;
    grandTotal += area;
    perDepartment.set(department, (perDepartment.get(department) || 0) + area);
    const agencyEntry = perAgency.get(agency) || { area: 0, rooms: 0, buildings: new Set() };
    agencyEntry.area += area; agencyEntry.rooms += 1; agencyEntry.buildings.add(room.buildingId);
    perAgency.set(agency, agencyEntry);
    const key = `${agency}|${room.buildingId}`;
    const cell = perAgencyBuilding.get(key) || { agency, buildingId: room.buildingId, area: 0, rooms: 0 };
    cell.area += area; cell.rooms += 1;
    perAgencyBuilding.set(key, cell);
  }

  // Which agencies the answer is ABOUT. Without a scope the answer is about all
  // of them, and the department chart alone would leave the reader counting bars.
  const inScope = [...perAgency.entries()].filter(([agency]) => {
    if (!scope) return true;
    if (scope.type === 'agency') return agency === scope.key;
    return (agencyDepartment[agency] || 'Übrige') === scope.key;
  });

  // A named scope with nothing behind it is a real answer, not an error: the
  // portal's demo portfolio holds 21 properties, and most departments are not in
  // it. Saying so is more useful than an empty chart.
  const scopeArea = inScope.reduce((sum, [, entry]) => sum + entry.area, 0);
  const scopeLabel = scope ? scope.key : '';

  const departmentRows = [...perDepartment.entries()]
    .map(([id, area]) => ({ 'Departement': id, 'Bürofläche': round(area) }))
    .sort((a, b) => b['Bürofläche'] - a['Bürofläche']);

  const agencyRows = inScope
    .map(([agency, entry]) => ({ 'Amt': agency, 'Bürofläche': round(entry.area) }))
    .sort((a, b) => b['Bürofläche'] - a['Bürofläche']);

  const buildingRows = [...perAgencyBuilding.values()]
    .filter((cell) => inScope.some(([agency]) => agency === cell.agency))
    .map((cell) => ({
      'Liegenschaft': buildingName.get(cell.buildingId) || cell.buildingId,
      'Bürofläche': round(cell.area),
      _agency: cell.agency, _buildingId: cell.buildingId, _rooms: cell.rooms,
    }))
    .sort((a, b) => b['Bürofläche'] - a['Bürofläche']);

  const share = grandTotal ? Math.round((scopeArea / grandTotal) * 100) : 0;
  const roomCount = inScope.reduce((sum, [, entry]) => sum + entry.rooms, 0);
  const buildingCount = new Set(buildingRows.map((row) => row._buildingId)).size;

  // Two charts, and the second one changes with the answer rather than being
  // padding: with several agencies in scope the comparison BETWEEN them is the
  // point; with one, the split across its properties is.
  const charts = [{
    spec: { id: 'answer-area-department', form: 'barH', title: 'Bürofläche je Departement',
      unit: 'm²', x: 'Departement', y: 'Bürofläche',
      note: `Alle im Portal erfassten Büroflächen — ${OFFICE_USES.join(', ')}.` },
    result: { columns: ['Departement', 'Bürofläche'], rows: departmentRows, label: 'Räume' },
  }];
  if (agencyRows.length > 1) {
    charts.push({
      spec: { id: 'answer-area-agency', form: 'barH',
        title: `Bürofläche je Amt${scope && scope.type === 'department' ? ` im ${scope.key}` : ''}`,
        unit: 'm²', x: 'Amt', y: 'Bürofläche' },
      result: { columns: ['Amt', 'Bürofläche'], rows: agencyRows, label: 'Räume' },
    });
  } else if (buildingRows.length > 1) {
    charts.push({
      spec: { id: 'answer-area-building', form: 'barH', title: 'Bürofläche je Liegenschaft',
        unit: 'm²', x: 'Liegenschaft', y: 'Bürofläche' },
      result: { columns: ['Liegenschaft', 'Bürofläche'], rows: buildingRows, label: 'Räume' },
    });
  }

  // The lead NAMES the agencies while there are few enough to name. «Die Ämter
  // im EFD» is a question about which ones, and a total alone answers only half
  // of it; beyond three names the list stops being a sentence and the chart
  // below takes over.
  const names = agencyRows.map((row) => row['Amt']);
  const namesText = names.length <= 3
    ? names.join(', ')
    : `${names.slice(0, 3).join(', ')} und ${names.length - 3} weitere`;
  const lead = !scopeArea
    ? `Für ${scopeLabel || 'diese Auswahl'} sind im Portalbestand keine Büroflächen erfasst. `
      + `Die Auswertung unten zeigt, welche Departemente erfasst sind.`
    : scope
      ? `Im ${scopeLabel} ${inScope.length === 1 ? 'ist ein Amt' : `sind ${inScope.length} Ämter`} `
        + `mit Bürofläche erfasst: ${namesText}. Zusammen ${formatArea(round(scopeArea))} `
        + `in ${buildingCount} ${buildingCount === 1 ? 'Liegenschaft' : 'Liegenschaften'} — `
        + `${share} % der im Portal erfassten Bürofläche.`
      : `Insgesamt sind ${formatArea(round(scopeArea))} Bürofläche erfasst — `
        + `${inScope.length} Ämter in ${buildingCount} Liegenschaften.`;

  return {
    id: 'office-area', skill: 'dashboard', skillLabel: 'Dashboard',
    title: 'Flächenauswertung',
    lead,
    kpis: [
      { label: scope ? `Bürofläche ${scopeLabel}` : 'Bürofläche total',
        value: formatNumber(round(scopeArea)), unit: 'm²' },
      { label: 'Ämter', value: formatNumber(inScope.length),
        hint: scope ? `im ${scopeLabel}` : 'mit erfasster Fläche' },
      { label: 'Liegenschaften', value: formatNumber(buildingCount) },
      // Only where it says something. Without a scope the share is 100 % by
      // construction, and a tile that can only ever show one value is furniture.
      ...(scope ? [{ label: 'Anteil am Portalbestand', value: formatNumber(share), unit: '%',
        hint: `von ${formatArea(round(grandTotal))}` }] : []),
    ],
    charts,
    table: buildingRows.length ? {
      caption: 'Bürofläche je Amt und Liegenschaft',
      columns: [
        { key: '_agency', label: 'Amt' },
        { key: 'Liegenschaft', label: 'Liegenschaft' },
        { key: '_rooms', label: 'Räume', align: 'right' },
        { key: 'Bürofläche', label: 'Bürofläche', align: 'right',
          render: (row) => formatArea(row['Bürofläche']) },
      ],
      rows: buildingRows.slice(0, 8),
    } : null,
    basis: `Aggregiert aus ${formatNumber(rooms.length)} Raumdatensätzen `
      + `(${OFFICE_USES.join(', ')}) zu ${formatNumber(buildingName.size)} Liegenschaften. `
      + `Die Zuordnung Amt → Departement stammt aus den Referenzdaten des Portals.`,
    sources: buildingRows.slice(0, 3).map((row) => ({
      title: row['Liegenschaft'], type: 'Liegenschaft',
      meta: `${row._agency} · ${formatArea(row['Bürofläche'])}`,
      href: links.portfolioItem(row._buildingId),
    })),
  };
}

// Cost-group labels for the two-digit prefixes the register actually uses.
// Kept as a LOOKUP rather than as prose in the answer: the numbers come from
// data/costs.json, so the grouping has to follow them and a group that appears
// there without an entry here still shows up — under its own number.
const COST_GROUPS = {
  21: 'Miete und Baurechtszinsen',
  22: 'Versicherungen und Abgaben',
  31: 'Energie',
  32: 'Ver- und Entsorgung',
  33: 'Reinigung',
  34: 'Bedienung und Wartung',
  35: 'Sicherheit',
  41: 'Instandhaltung',
  42: 'Instandsetzung',
};
const costGroupLabel = (group) => {
  const prefix = Number(String(group).slice(0, 2));
  return COST_GROUPS[prefix] ? `${prefix} ${COST_GROUPS[prefix]}` : `Kostengruppe ${group}`;
};

/**
 * Find the property a question names. Matches the building's designation, its
 * street, and its full address line — whichever the person happened to use.
 *
 * Returns the building with the LONGEST matched token, so «Bundeshaus West»
 * beats «Bundeshaus» when both are in the index.
 */
function findProperty(core, raw) {
  const question = ` ${tokens(raw).join(' ')} `;
  let best = null;
  for (const building of core.buildings()) {
    const candidates = [
      building.name,
      building.street,                       // Already «Strasse Hausnummer».
      String(building.street || '').replace(/\s+\d+\w?$/, ''),
      building.bbl_id,
    ];
    for (const candidate of candidates) {
      const needle = tokens(candidate).join(' ');
      // Two characters would match half the index; a street name never is.
      if (needle.length < 4) continue;
      if (!question.includes(` ${needle} `) && !question.includes(`${needle} `)) continue;
      if (!best || needle.length > best.length) best = { building, length: needle.length };
    }
  }
  return best ? best.building : null;
}

/**
 * Operating costs of ONE property, from data/costs.json.
 *
 * The cost register is a flat list of annual lines. What makes it an ANSWER
 * rather than a table dump is the reference figure: CHF per m², computed from
 * the property's own area measurement, is the only number in it that can be
 * compared with anything.
 */
function operatingCosts(core, raw) {
  const building = findProperty(core, raw);
  if (!building) return null;
  const lines = core.costsForBuilding(building.bbl_id);
  if (!lines.length) return null;

  const total = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const byGroup = new Map();
  for (const line of lines) {
    const label = costGroupLabel(line.costGroup);
    byGroup.set(label, (byGroup.get(label) || 0) + (Number(line.amount) || 0));
  }
  const groupRows = [...byGroup.entries()]
    .map(([label, amount]) => ({ 'Kostengruppe': label, 'Betrag': round(amount) }))
    .sort((a, b) => b['Betrag'] - a['Betrag']);
  const typeRows = lines
    .map((line) => ({ 'Kostenart': line.costType, 'Betrag': round(Number(line.amount) || 0),
      _group: costGroupLabel(line.costGroup), _period: line.period || '' }))
    .sort((a, b) => b['Betrag'] - a['Betrag']);

  // The reference area. HNF first because operating costs are charged on it;
  // GF as the fallback, and the tile says which one it used — a CHF/m² figure
  // whose denominator is unnamed is not a key figure, it is a rumour.
  const areas = core.areasForBuilding(building.bbl_id);
  const areaOf = (type) => (areas.find((entry) => entry.type === type) || {}).value;
  const reference = [
    ['Hauptnutzfläche', areaOf('Hauptnutzfläche')],
    ['Nettogeschossfläche', areaOf('Nettogeschossfläche')],
    ['Bruttogeschossfläche', areaOf('Bruttogeschossfläche')],
  ].find(([, value]) => Number(value) > 0)
    || ['Geschossfläche (Stammdaten)', building.gf];
  const [referenceLabel, referenceArea] = reference;
  const perSquareMetre = Number(referenceArea) > 0 ? total / Number(referenceArea) : null;
  const biggest = groupRows[0];
  const year = (lines.find((line) => line.extensionData && line.extensionData.budgetYear) || {})
    .extensionData?.budgetYear;

  return {
    id: 'operating-costs', skill: 'dashboard', skillLabel: 'Dashboard',
    title: 'Kostenauswertung',
    lead: `Die Liegenschaft ${building.name} (${addressOf(building)}) verursacht `
      + `${formatCurrency(round(total))} Betriebskosten pro Jahr`
      + `${perSquareMetre ? `, das sind ${formatCurrency(perSquareMetre, 'CHF', RAPPEN)} je m² ${referenceLabel}` : ''}. `
      + `Grösster Block: ${biggest['Kostengruppe']} mit ${formatCurrency(biggest['Betrag'])} `
      + `(${Math.round((biggest['Betrag'] / total) * 100)} %).`,
    kpis: [
      { label: 'Betriebskosten pro Jahr', value: formatNumber(round(total)), unit: 'CHF',
        hint: year ? `Budgetjahr ${year}` : '' },
      ...(perSquareMetre ? [{ label: 'Kosten je m²', value: formatNumber(perSquareMetre, RAPPEN),
        unit: 'CHF/m²', hint: `${referenceLabel} ${formatArea(round(Number(referenceArea)))}` }] : []),
      { label: 'Grösster Kostenblock', value: `${Math.round((biggest['Betrag'] / total) * 100)}`, unit: '%',
        hint: biggest['Kostengruppe'] },
      { label: 'Kostenpositionen', value: formatNumber(lines.length),
        hint: `${byGroup.size} Kostengruppen` },
    ],
    charts: [
      { spec: { id: 'answer-cost-group', form: 'barH', title: 'Betriebskosten nach Kostengruppe',
          unit: 'CHF', x: 'Kostengruppe', y: 'Betrag',
          note: 'Kostengruppen nach den Nummern des Kostenregisters (SAP RE-FX).' },
        result: { columns: ['Kostengruppe', 'Betrag'], rows: groupRows, label: 'Kosten' } },
      { spec: { id: 'answer-cost-type', form: 'barH', title: 'Grösste Kostenpositionen',
          unit: 'CHF', x: 'Kostenart', y: 'Betrag' },
        result: { columns: ['Kostenart', 'Betrag'], rows: typeRows.slice(0, 8), label: 'Kosten' } },
    ],
    table: {
      caption: `Kostenpositionen ${building.name}`,
      columns: [
        { key: 'Kostenart', label: 'Kostenart' },
        { key: '_group', label: 'Kostengruppe' },
        { key: '_period', label: 'Periode' },
        { key: 'Betrag', label: 'Betrag', align: 'right', render: (row) => formatCurrency(row['Betrag']) },
      ],
      rows: typeRows,
    },
    basis: `Summiert über ${formatNumber(lines.length)} Kostenpositionen aus dem Kostenregister `
      + `der Liegenschaft ${building.bbl_id}. Bezugsfläche: ${referenceLabel}.`,
    sources: [{
      title: building.name, type: 'Liegenschaft',
      meta: `${building.bbl_id} · ${addressOf(building)}`,
      href: links.portfolioItem(building.bbl_id),
    }],
  };
}

/**
 * Where properties stand, from data/buildings.geojson.
 *
 * The filter reads the property's OWN user field (`bbl_nutzer`) rather than a
 * separate register, because that is the field that answers «whose building is
 * this?» for a property that has no tenancy record in the demo portfolio.
 */
function propertyMap(core, raw) {
  const words = tokens(raw);
  primeScopeIndex(core.ref());
  const scope = findScope(words);
  const buildings = core.buildings().filter((building) => Number.isFinite(building.lat) && Number.isFinite(building.lng));

  const matches = buildings.filter((building) => {
    if (!scope) return true;
    const haystack = tokens([building.occupants, building.name, building.portfolioCategory,
      building.buildingType].filter(Boolean).join(' '));
    if (scope.type === 'agency') return haystack.includes(scope.key.toLowerCase());
    // A department matches through any of its agencies — the field names the
    // agency, and nobody writes «EFD» into a building record.
    const agencies = Object.keys(SCOPE_INDEX.agencies)
      .filter((agency) => SCOPE_INDEX.agencies[agency] === scope.key);
    return agencies.some((agency) => haystack.includes(agency.toLowerCase()));
  });
  if (!matches.length) return null;

  const point = (building) => ({
    lat: building.lat, lon: building.lng,
    label: building.name,
    sub: addressOf(building),
    bblId: building.bbl_id,
    href: links.portfolioItem(building.bbl_id),
  });
  const countries = new Set(matches.map((building) => building.country).filter(Boolean));
  const label = scope ? scope.key : 'das Portfolio';

  return {
    id: 'property-map', skill: 'map', skillLabel: 'Karte',
    title: 'Standortkarte',
    // The card's own heading names WHAT is on the map. The skill trace above it
    // already says «Karte — Standortkarte»; repeating that on the card would be
    // the third time the word appears before a single marker is visible.
    mapTitle: `Liegenschaften ${scope ? scope.key : 'im Portfolio'}`,
    lead: `${matches.length} ${matches.length === 1 ? 'Liegenschaft' : 'Liegenschaften'} für ${label}`
      + `${countries.size > 1 ? ` in ${countries.size} Ländern` : ''} — `
      + `${matches.slice(0, 3).map((building) => building.name).join(', ')}`
      + `${matches.length > 3 ? ` und ${matches.length - 3} weitere` : ''}.`,
    kpis: [
      { label: 'Liegenschaften', value: formatNumber(matches.length) },
      { label: 'Standorte', value: formatNumber(new Set(matches.map((b) => b.city)).size) },
      { label: 'Länder', value: formatNumber(countries.size) },
    ],
    charts: [],
    points: matches.map(point),
    table: {
      caption: 'Gefundene Liegenschaften',
      columns: [
        { key: 'name', label: 'Liegenschaft',
          render: (row) => `<a href="${row.href}">${row.name}</a>` },
        { key: 'address', label: 'Adresse' },
        { key: 'occupants', label: 'Nutzende Verwaltungseinheit' },
      ],
      rows: matches.slice(0, 8).map((building) => ({
        name: building.name, address: addressOf(building),
        occupants: building.occupants || '—', href: links.portfolioItem(building.bbl_id),
      })),
    },
    basis: `Gefiltert über ${formatNumber(buildings.length)} Liegenschaften des Portalbestands `
      + `anhand des Feldes «Nutzer» im Gebäudedatensatz.`,
    sources: matches.slice(0, 3).map((building) => ({
      title: building.name, type: 'Liegenschaft',
      meta: addressOf(building), href: links.portfolioItem(building.bbl_id),
    })),
  };
}

const RUNNERS = {
  'office-area': officeArea,
  'operating-costs': operatingCosts,
  'property-map': propertyMap,
};

/* ================================================================ PUBLIC == */

/**
 * Build the skill result for a question, or null.
 *
 * Async because a matched skill loads its own datasets first. The caller awaits
 * this BEFORE rendering, so the block never appears empty and then fills in.
 *
 * NULL IS THE COMMON CASE and it is not a failure: most questions are answered
 * better by the cited paragraph of js/search/answer.js than by anything here.
 * There was once a fourth «Direktlink» skill that fired for those — a trace line
 * and a button pointing at the service. Both were removed on review: the button
 * and the line named the entry that was already numbered in the answer's own
 * source list, so the block said the same thing three times. Where a skill has
 * nothing to add, adding nothing is the answer.
 */
export async function buildInsight(raw, core) {
  // Priming FIRST: `matchSkill` recognises «EFD» or «BAZG» only through the
  // abbreviation vocabulary in the reference data, which is loaded at startup.
  primeScopeIndex(core.ref());
  const match = matchSkill(raw);
  if (!match) return null;
  try {
    await core.ensure(match.needs);
  } catch {
    return null;                      // Data missing: fall back, never invent.
  }
  return RUNNERS[match.id](core, raw) || null;
}
