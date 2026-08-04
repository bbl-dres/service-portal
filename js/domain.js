// Fachliche Kleinigkeiten, die mehrere Apps brauchen: Ländernamen, das
// WE-Segment der bbl_id und die Nachschläge in die Referenzdaten.
//
// Alle drei lagen zuvor je Datei kopiert vor — `LAND`/`landName` dreimal
// zeichengleich, `weOf` dreimal, die Status-Nachschläge in vier Fassungen mit
// vier Namen (`statusLabel`, `sLabel`, `m`, inline).

// Ländercodes des Bundesportfolios. Bewusst eine kurze Liste statt einer
// vollständigen ISO-Tabelle: es sind die Länder, in denen der Bund Bauten hat.
export const LAND = {
  CH: 'Schweiz', DE: 'Deutschland', US: 'USA',
  JP: 'Japan', BR: 'Brasilien', AU: 'Australien',
};
export const landName = (code) => LAND[code] || code || '—';

// Wirtschaftseinheit = zweites Segment der bbl_id (1080/4840/AF → 4840).
// Darüber hängen Gebäude und Grundstücke zusammen.
export const weOf = (id) => String(id || '').split('/')[1] || '';

// Bereiche des Anwendungskatalogs — das Feld `area` in data/applications.json.
// Zwei Beschriftungen je Bereich, weil sie an zwei Stellen Verschiedenes
// leisten: `label` steht im Bereichsfilter und ist deckungsgleich mit `group`
// (kurz, es sortiert Karten), `navLabel` steht im Menü, auf der Kachel der
// Daten-Übersicht und in den Eckdaten der Landingpage (es benennt die Gattung
// mit). Beide lagen zuvor getrennt in pages/applications.js und
// pages/application.js und wichen bereits voneinander ab.
//
// `federal` trägt die Anwendungen, die nicht dem BBL gehören, sondern der
// Bundesverwaltung als Ganzes. `central` hiess bis Aug. 2026 «Zentrale Systeme»
// und meinte genau diese bundesweiten Systeme; nachdem sie ausgezogen sind,
// trägt der Schlüssel nur noch die beiden Datenanwendungen des Portals und
// heisst nach ihnen — die alte Beschriftung hätte sonst weitergelebt und
// etwas anderes bedeutet.
export const APP_AREAS = [
  { key: 'buildings', label: 'Immobilien & Bau',        navLabel: 'Fachanwendungen Bauten' },
  { key: 'logistics', label: 'Arbeitsplatz & Logistik', navLabel: 'Fachanwendungen Logistik' },
  { key: 'central',   label: 'Daten und Auswertungen',  navLabel: 'Daten und Auswertungen' },
  { key: 'federal',   label: 'Bundesverwaltung',        navLabel: 'Fachanwendungen Bundesverwaltung' },
];
export const appAreaLabel = (key) => (APP_AREAS.find((a) => a.key === key) || {}).navLabel || key;

// Zielgruppen (`audience` in services.json/applications.json). Die Liste stand
// dreimal im Code (components.audienceTag, services.js, applications.js) —
// hier die EINE Quelle für Filteroptionen und Beschriftung; C.audienceTag
// behält seine interne Farbzuordnung (components.js bleibt import-frei), die
// Wortlaute sind per Kommentar dort hierher gebunden.
export const AUDIENCES = [
  { value: 'staff', label: 'BBL-Personal' },
  { value: 'customers', label: 'Kundschaft' },
  { value: 'both', label: 'Beide' },
];
export const audienceLabel = (value) => (AUDIENCES.find((a) => a.value === value) || {}).label || value;

/**
 * Beschriftung aus einer Referenzliste. `listName` ist der Schlüssel in
 * data/reference-data.json (`statusModel`, `projectStatuses`, `domains`,
 * `classificationTiers` …), `idKey` das Feld, das die Kennung trägt.
 * Ohne Treffer kommt die Kennung selbst zurück — sichtbar, aber nicht kaputt.
 */
export function refLabel(core, listName, id, idKey = 'id') {
  const list = core.ref()[listName] || [];
  const hit = list.find((x) => x[idKey] === id);
  return hit ? hit.label : id;
}

export const statusLabel = (core, id) => refLabel(core, 'statusModel', id);
export const projectStatusLabel = (core, id) => refLabel(core, 'projectStatuses', id);
export const domainLabel = (core, key) => refLabel(core, 'domains', key, 'key');

export default { LAND, landName, weOf, APP_AREAS, appAreaLabel, AUDIENCES, audienceLabel, refLabel, statusLabel, projectStatusLabel, domainLabel };
