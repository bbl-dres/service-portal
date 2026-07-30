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

export default { LAND, landName, weOf, refLabel, statusLabel, projectStatusLabel, domainLabel };
