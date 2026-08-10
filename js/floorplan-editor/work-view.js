// View 2 of the Plan-Editor landing page: what is waiting for the visitor.
//
// The editor serves several groups that share one geometry but own different
// attribute layers (js/floorplan-editor/tasks.js). A layer is a CD tab here
// rather than an icon rail: the design system has no activity bar, and tabs are
// the component it does ship for exactly this job.
//
// The queue itself is the portal's shared data table — the same building block
// the personal case list uses — rather than a bespoke card list. One work item
// is one row: it needs a search field, a status filter and a stable scan
// column, not four lines and a button pair each.

import { floorplanEditor, planCheck } from '../links.js';
import {
  PLAN_EDITOR_LAYERS, planEditorLayer, planEditorRecentFloors, planEditorTaskCounts,
  planEditorTasks,
} from './tasks.js';
import { BASE, PLAN_STATUS, area, number } from './shared.js';

const list = (value) => Array.isArray(value) ? value : [];

export const SEVERITY_MARK = Object.freeze({
  error: { tone: 'error', label: 'Dringend' },
  warning: { tone: 'warning', label: 'Offen' },
  info: { tone: 'info', label: 'Hinweis' },
});

// Solid marks rather than the CD outline icons: at the 16 px of a dense work row
// the hairline set is illegible, and severity is the one thing a queue must make
// unmissable. Shapes differ so the meaning survives without colour.
const MARK_SHAPES = Object.freeze({
  error: '<circle cx="8" cy="8" r="7.25"/><path d="M8 4.3v5" stroke="var(--fpe-mark-knockout)" stroke-width="1.9" stroke-linecap="round"/><circle cx="8" cy="11.6" r="1.05" fill="var(--fpe-mark-knockout)"/>',
  warning: '<path d="M8 .9 15.6 14.4a.9.9 0 0 1-.78 1.35H1.18A.9.9 0 0 1 .4 14.4Z"/><path d="M8 5.6v4.1" stroke="var(--fpe-mark-knockout)" stroke-width="1.9" stroke-linecap="round"/><circle cx="8" cy="12.5" r="1.05" fill="var(--fpe-mark-knockout)"/>',
  info: '<circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 7.1v4.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="8" cy="4.6" r="1.05"/>',
});

export function severityMark(C, tone) {
  const mark = SEVERITY_MARK[tone] || SEVERITY_MARK.info;
  const shape = MARK_SHAPES[mark.tone] || MARK_SHAPES.info;
  return `<span class="fpe-work__mark fpe-work__mark--${mark.tone}" title="${C.escape(mark.label)}">`
    + `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" focusable="false" aria-hidden="true">${shape}</svg>`
    + `<span class="sr-only">${C.escape(mark.label)}</span></span>`;
}

// Where a work item leads. The FIRST link in a row is what a row click follows,
// so it is always the one that opens the thing the row is about.
function taskPrimary(C, task) {
  if (task.kind === 'order') return { href: floorplanEditor(task.buildingId), label: 'Geschosse öffnen' };
  if (task.kind === 'lease') {
    return { href: `#/app/tenancies?id=${encodeURIComponent(task.detail.split(' · ')[0])}`, label: 'Mietverhältnis' };
  }
  return { href: floorplanEditor(task.buildingId, task.floorId), label: 'Öffnen' };
}

function taskSecondary(C, task) {
  if (task.kind === 'sync') {
    return `<a class="btn btn--outline btn--sm" href="${C.escape(planCheck(task.buildingId, task.floorId))}"
      target="_blank" rel="noopener noreferrer"><span class="btn__text">Planprüfung</span></a>`;
  }
  if (task.kind === 'draft') {
    return `<button class="btn btn--outline btn--sm" type="button" data-action="discard-draft"
      data-floor="${C.escape(task.floorId)}"><span class="btn__text">Verwerfen</span></button>`;
  }
  return '';
}

/** Columns of the work queue, in scan order: severity · what · where · state. */
export function workColumns(C) {
  return [
    {
      key: 'title',
      label: 'Aufgabe',
      render: (task) => {
        const primary = taskPrimary(C, task);
        return `${severityMark(C, task.severity)}<a href="${C.escape(primary.href)}">${C.escape(task.title)}</a>`;
      },
    },
    { key: 'detail', label: 'Befund', render: (task) => `<span class="muted">${C.escape(task.detail)}</span>` },
    { key: 'state', label: 'Status', render: (task) => C.escape(task.state) },
    {
      key: 'actions',
      label: 'Aktion',
      render: (task) => {
        const primary = taskPrimary(C, task);
        return `<span class="fpe-work__actions">${taskSecondary(C, task)}
          <a class="btn btn--filled btn--sm" href="${C.escape(primary.href)}"><span class="btn__text">${C.escape(primary.label)}</span></a></span>`;
      },
    },
  ];
}

export function layerTabsHTML(C, activeId, counts) {
  return `<div class="tab__controls-container fpe-layer-tabs">
    <div class="tab__controls" role="tablist" aria-label="Ebenen des Plan-Editors">
      ${PLAN_EDITOR_LAYERS.map((layer) => {
        const active = layer.id === activeId;
        const count = counts[layer.id] || 0;
        return `<a class="tab__control${active ? ' tab__control--active' : ''}" role="tab"
          id="fpe-layer-${layer.id}" href="${BASE}?view=work&layer=${encodeURIComponent(layer.id)}"
          aria-selected="${active}" tabindex="${active ? '0' : '-1'}">${C.escape(layer.label)}${
          layer.available
            ? (count ? ` <span class="fpe-layer-tabs__count">${number(count)}</span>` : '')
            : ' <span class="fpe-layer-tabs__note">noch keine Daten</span>'}</a>`;
      }).join('')}
    </div>
  </div>`;
}

function recentCardHTML(C, entry, previewHTML) {
  const status = PLAN_STATUS[entry.planStatus] || PLAN_STATUS.inventory;
  return `<li class="fpe-recent">
    <a class="fpe-recent__link" href="${floorplanEditor(entry.buildingId, entry.floorId)}">
      ${previewHTML}
      <span class="fpe-recent__label">${C.escape(entry.label)}</span>
      <span class="fpe-recent__building">${C.escape(entry.buildingName)}</span>
      <span class="fpe-recent__facts">${area(entry.areaHnf)}</span>
      <span class="fpe-recent__status">${C.badge(entry.hasDraft ? 'Entwurf offen' : status.label,
        entry.hasDraft ? 'info' : status.variant, 'sm')}</span>
    </a>
  </li>`;
}

/**
 * `previewFor(entry)` returns the mini floor plan already used by the workbench;
 * injecting it keeps this module free of geometry code. The queue table itself is
 * mounted by the controller into `#fpe-work-table`.
 */
export function renderWorkView(C, {
  objects, layerId, counts, recents, cases, previewFor,
}) {
  const layer = planEditorLayer(layerId);
  const floorCount = objects.reduce((sum, entry) => sum + entry.floors.length, 0);

  return `<div class="fpe-work" id="fpe-work">
    <div class="fpe-work__head">
      <div>
        <h1 class="fpe-work__title-main" tabindex="-1">Meine Arbeit</h1>
        <p class="fpe-work__lead">${number(objects.length)} Objekte · ${number(floorCount)} Geschosse im Zugriff</p>
      </div>
      <a class="btn btn--filled" href="${planCheck()}" target="_blank" rel="noopener noreferrer">
        <span class="btn__text">Plan hochladen und prüfen</span></a>
    </div>

    ${layerTabsHTML(C, layer.id, counts)}

    <section class="fpe-work__section" aria-labelledby="fpe-open-heading">
      <h2 id="fpe-open-heading" class="sr-only">Offene Arbeiten</h2>
      ${layer.available
        ? '<div id="fpe-work-table"></div>'
        : `<div class="fpe-work__empty">${C.empty('Diese Ebene ist noch nicht mit Daten hinterlegt.', {
          hint: layer.emptyReason,
        })}</div>`}
    </section>

    ${cases.length ? `<section class="fpe-work__section" aria-labelledby="fpe-cases-heading">
      <div class="fpe-work__section-head">
        <h2 id="fpe-cases-heading">Meine Vorgänge</h2>
        <p class="fpe-work__count"><a href="#/my-cases">Alle Vorgänge</a></p>
      </div>
      <table class="table table--zebra fpe-work__cases">
        <caption class="sr-only">Eingereichte Planfreigaben</caption>
        <thead><tr><th scope="col">Referenz</th><th scope="col">Vorgang</th><th scope="col">Eingereicht</th><th scope="col">Status</th></tr></thead>
        <tbody>${cases.map((instance) => `<tr>
          <th scope="row"><a class="mono" href="#/my-cases">${C.escape(instance.reference)}</a></th>
          <td>${C.escape(instance.title)}</td>
          <td>${C.escape(instance.createdAt)}</td>
          <td>${C.escape(instance.statusLabel)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </section>` : ''}

    <section class="fpe-work__section" aria-labelledby="fpe-recent-heading">
      <div class="fpe-work__section-head">
        <h2 id="fpe-recent-heading">Zuletzt bearbeitet</h2>
        <p class="fpe-work__count"><a href="${BASE}">Alle Objekte</a></p>
      </div>
      ${recents.length
        ? `<ul class="fpe-recent-strip">${recents.map((entry) => recentCardHTML(C, entry, previewFor(entry))).join('')}</ul>`
        : `<div class="fpe-work__empty">${C.empty('Noch kein Plan geöffnet.', {
          hint: 'Geöffnete Geschosse erscheinen hier, sobald Sie im Editor gearbeitet haben.',
        })}</div>`}
    </section>
  </div>`;
}

/** Freigabe cases this editor should surface, newest first. */
export function planEditorCases(engine, { limit = 3 } = {}) {
  const open = new Set(['eingereicht', 'in_pruefung_fm', 'freigegeben']);
  return list(engine?.instances?.())
    .filter((instance) => instance?.defId === 'planfreigabe' && open.has(instance.status))
    .slice(0, limit)
    .map((instance) => {
      const definition = engine.definition?.(instance.defId);
      const step = list(definition?.steps).find((entry) => entry.status === instance.status);
      return {
        reference: String(instance.reference || ''),
        title: String(instance.title || ''),
        defName: String(instance.defName || ''),
        createdAt: String(instance.createdAt || ''),
        statusLabel: String(step?.label || instance.status || ''),
      };
    });
}

export { PLAN_EDITOR_LAYERS, planEditorRecentFloors, planEditorTaskCounts, planEditorTasks };
