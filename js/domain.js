// Small domain helpers needed by several apps: country names, the business-
// entity segment of bbl_id, and lookups into reference data.
//
// All three were previously copied into individual files: `COUNTRY_NAMES` /
// `countryName` three times verbatim, `businessEntityIdFromBblId` three times,
// and status lookups in four versions under four names (`statusLabel`, `sLabel`,
// `m`, inline).

// Country codes in the federal portfolio. Deliberately a short list rather than
// a complete ISO table: these are the countries where the Confederation owns
// buildings.
const COUNTRY_NAMES = {
  CH: 'Schweiz', DE: 'Deutschland', US: 'USA',
  JP: 'Japan', BR: 'Brasilien', AU: 'Australien',
};
export const countryName = (code) => COUNTRY_NAMES[code] || code || '—';

// Business entity = second segment of bbl_id (1080/4840/AF → 4840).
// It links buildings and parcels.
export const businessEntityIdFromBblId = (id) => String(id || '').split('/')[1] || '';

// Application-catalogue areas: the `area` field in data/applications.json.
// Each area has two labels because they serve different purposes: `label`
// appears in the area filter and matches `group` (short, for sorting cards),
// while `navLabel` appears in the menu, the data-overview tile and landing-page
// facts (where it also names the category). They previously lived separately in
// pages/applications.js and pages/application.js and had already diverged.
//
// `federal` contains applications owned by the federal administration as a
// whole rather than by the BBL. Until August 2026, `central` was labelled
// «Zentrale Systeme» and meant those same federal systems; after they moved,
// the key contains only the portal's two data applications and is named after
// them. Keeping the old label would have described something else.
export const APP_AREAS = [
  { key: 'buildings', label: 'Immobilien & Bau',        navLabel: 'Fachanwendungen Bauten' },
  { key: 'logistics', label: 'Arbeitsplatz & Logistik', navLabel: 'Fachanwendungen Logistik' },
  { key: 'central',   label: 'Daten und Auswertungen',  navLabel: 'Daten und Auswertungen' },
  { key: 'federal',   label: 'Bundesverwaltung',        navLabel: 'Fachanwendungen Bundesverwaltung' },
];
// Target audiences (`audience` in services.json/applications.json) have been an
// ARRAY of identifiers since August 2026: an offering for both groups carries
// both values instead of the pseudo-value `both`, and the labels are now simply
// «Mitarbeiter» and «Kunden» (user decision, replacing the applications' former
// «Intern/Extern» wording as well). The list itself — identifier, wording and
// badge colour — lives in data/reference-data.json (`audiences`); only its
// lookups live here.
const audiences = (core) => core.ref().audiences || [];
export const audienceOptions = (core) => audiences(core).map((a) => ({ value: a.id, label: a.label }));
export const audienceLabel = (core, id) => refLabel(core, 'audiences', id);
// Label row for cards, lists and detail headers: one badge per audience in
// reference order (employees before customers, regardless of data order).
export const audienceTags = (core, C, audience) => {
  const ids = Array.isArray(audience) ? audience : [audience].filter(Boolean);
  return audiences(core).filter((a) => ids.includes(a.id))
    .map((a) => C.badge(a.label, a.variant)).join('');
};

/**
 * Label from a reference list. `listName` is the key in
 * data/reference-data.json (`statusModel`, `projectStatuses`, `domains`,
 * `classificationTiers` …), while `idKey` is the identifier field. Without a
 * match, the identifier itself is returned: visible, but not broken.
 */
function refLabel(core, listName, id, idKey = 'id') {
  const list = core.ref()[listName] || [];
  const hit = list.find((x) => x[idKey] === id);
  return hit ? hit.label : id;
}

export const statusLabel = (core, id) => refLabel(core, 'statusModel', id);
export const projectStatusLabel = (core, id) => refLabel(core, 'projectStatuses', id);
export const domainLabel = (core, key) => refLabel(core, 'domains', key, 'key');
