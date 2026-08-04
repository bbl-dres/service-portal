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

// Zielgruppen (`audience` in services.json/applications.json) — seit Aug. 2026
// ein ARRAY von Kennungen: ein Angebot für beide Gruppen trägt beide Werte
// statt des Pseudowerts «both», und die Etiketten heissen nur noch
// «Mitarbeiter» und «Kunden» (Nutzerentscheid; das frühere «Intern/Extern»
// der Anwendungen ist damit ebenfalls abgelöst). Die Liste selbst — Kennung,
// Wortlaut, Badge-Farbe — liegt als Referenzliste in data/reference-data.json
// (`audiences`); hier stehen nur die Nachschläge darauf.
export const audiences = (core) => core.ref().audiences || [];
export const audienceOptions = (core) => audiences(core).map((a) => ({ value: a.id, label: a.label }));
export const audienceLabel = (core, id) => refLabel(core, 'audiences', id);
// Etikettenreihe für Karten, Listen und Detailköpfe: ein Badge je Zielgruppe,
// in Referenzreihenfolge (Mitarbeiter vor Kunden, egal wie die Daten sortieren).
export const audienceTags = (core, C, audience) => {
  const ids = Array.isArray(audience) ? audience : [audience].filter(Boolean);
  return audiences(core).filter((a) => ids.includes(a.id))
    .map((a) => C.badge(a.label, a.variant)).join('');
};

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

export default { LAND, landName, weOf, APP_AREAS, appAreaLabel, audiences, audienceOptions, audienceLabel, audienceTags, refLabel, statusLabel, projectStatusLabel, domainLabel };
