// Router-facing entry point for the standalone DWG viewer and plan checker.
// Parsing, viewer state and cleanup live under ../plan-check/; this adapter owns
// only the portal's trusted building/floor hand-off contract.

import renderPlanCheck from '../plan-check/controller.js';

export const needs = ['buildings', 'floors'];
export const layout = 'standalone';
export const loginText = 'Melden Sie sich mit AGOV / FedLogin an, um DWG-Dateien lokal zu prüfen.';

export default async function render(ctx) {
  const { query, core } = ctx;
  const requestedBuildingId = query.get('building') || '';
  const requestedFloorId = query.get('floor') || '';
  const building = requestedBuildingId ? core.building(requestedBuildingId) : null;

  let floor = null;
  let contextWarning = '';
  if (requestedBuildingId && !building) {
    contextWarning = 'Das angeforderte Objekt wurde nicht gefunden. Die Planprüfung wird ohne Objektvorbelegung geöffnet.';
  } else if (requestedFloorId && !building) {
    contextWarning = 'Das angeforderte Geschoss konnte ohne gültigen Objektbezug nicht vorbelegt werden.';
  } else if (requestedFloorId) {
    const candidate = core.floor(requestedFloorId);
    if (candidate?.buildingId === building.bbl_id) floor = candidate;
    else contextWarning = 'Das angeforderte Geschoss gehört nicht zum gewählten Objekt und wurde deshalb nicht vorbelegt.';
  }

  const returnParams = new URLSearchParams();
  if (building) returnParams.set('id', building.bbl_id);
  if (floor) returnParams.set('floor', floor.floorId);
  const returnQuery = returnParams.toString();

  return renderPlanCheck(ctx, {
    building,
    floor,
    contextWarning,
    returnHref: `#/app/workspace${returnQuery ? `?${returnQuery}` : ''}`,
  });
}
