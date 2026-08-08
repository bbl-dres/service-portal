// Router-facing entry point for the standalone Plan-Editor feature.
// Feature implementation lives in ../floorplan-editor/ so this module stays a
// small route adapter as navigation and authoring continue to grow.

import {
  planningFloor, planningObjects, renderNavigation,
} from '../floorplan-editor/navigation.js';
import renderWorkbench from '../floorplan-editor/controller.js';
import { BASE } from '../floorplan-editor/shared.js';

export const needs = ['buildings', 'floors', 'spaces', 'workspacePlanning', 'shopProducts'];
export const layout = 'standalone';
export const loginText = 'Der Plan-Editor enthält Arbeitsplatz- und Ausstattungsdaten. Melden Sie sich mit AGOV / FedLogin an, um einen Plan zu öffnen.';

function renderNoPlan(ctx, message) {
  const { mount, C, setTitle } = ctx;
  document.body.classList.remove('body--standalone-app');
  setTitle('Plan-Editor');
  mount.innerHTML = `<div class="container section">
    ${C.backLink(BASE, 'Plan-Editor Navigation')}
    <div class="page-header"><h1 tabindex="-1">Plan-Editor</h1></div>
    ${C.notificationHtml(`<p class="m-0">${C.escape(message)}</p>`, 'warning', 'WarningCircle')}
  </div>`;
}

export default async function render(ctx) {
  const { query, core } = ctx;
  const objects = planningObjects(core);
  if (!objects.length) return renderNoPlan(ctx, 'Es sind keine Gebäude mit einem bearbeitbaren Grundriss verfügbar.');

  const requestedBuilding = query.get('building') || '';
  if (!requestedBuilding) return renderNavigation(ctx, objects);
  const object = objects.find((entry) => entry.building.bbl_id === requestedBuilding);
  if (!object) return renderNoPlan(ctx, 'Das angeforderte Workspace-Objekt oder seine Grundrisse wurden nicht gefunden.');

  const requestedFloor = query.get('floor') || '';
  if (!requestedFloor) return renderNavigation(ctx, objects, object);
  const floor = object.floors.find((entry) => entry.floorId === requestedFloor);
  if (!floor) return renderNavigation(ctx, objects, object,
    'Das angeforderte Geschoss wurde nicht gefunden. Wählen Sie einen verfügbaren Plan.');

  const canonicalRooms = core.spacesForFloor(floor.floorId);
  if (!canonicalRooms.length) return renderNoPlan(ctx, 'Für das gewählte Geschoss ist keine Raumgeometrie hinterlegt.');

  return renderWorkbench(ctx, {
    object,
    floor,
    plan: planningFloor(object.planning, floor.floorId),
    canonicalRooms,
  });
}
