// Focus-safe action dialogs for the floor-plan workbench.
//
// Keeping modal composition here prevents destructive workflow copy and event
// wiring from leaking into the state/controller layer. `C.openModal` owns the
// focus trap, Escape/backdrop handling, overlay lock and focus restoration.

let actionSequence = 0;

function actionId(prefix) {
  actionSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${actionSequence}`;
}

function wireAction({ queueFrame, id, close, onConfirm }) {
  queueFrame(() => document.getElementById(id)?.addEventListener('click', () => {
    onConfirm(close);
  }, { once: true }));
}

export function openConfirmationDialog({
  C, queueFrame, id = 'fpe-confirm-modal', title, body, confirmLabel, onConfirm,
}) {
  const confirmId = actionId(`${id}-action`);
  const close = C.openModal({
    id,
    size: 'sm',
    title,
    body,
    footer: `<button type="button" class="btn btn--outline" data-modal-close>Abbrechen</button>
      <button type="button" class="btn btn--filled" id="${confirmId}">${C.escape(confirmLabel)}</button>`,
  });
  wireAction({ queueFrame, id: confirmId, close, onConfirm });
  return close;
}

export function openPublishConfirmation({ C, queueFrame, rooms, placements, onConfirm }) {
  const confirmId = actionId('fpe-confirm-publish');
  const close = C.openModal({
    id: 'fpe-publish-modal',
    size: 'sm',
    title: 'Veröffentlichung simulieren?',
    body: `${C.notification('<strong>Nur Feedback-Prototyp.</strong> Die Version wird ausschliesslich in diesem Browser gespeichert. Es findet keine Freigabe, Synchronisation oder Berechtigungsprüfung statt.', 'info', 'InfoCircle')}
      <p>Die aktuelle Arbeitskopie enthält <strong>${rooms} Räume</strong> und <strong>${placements} Ausstattungsobjekte</strong>.</p>`,
    footer: `<button type="button" class="btn btn--outline" data-modal-close>Abbrechen</button>
      <button type="button" class="btn btn--filled" id="${confirmId}">Im Prototyp veröffentlichen</button>`,
  });
  wireAction({ queueFrame, id: confirmId, close, onConfirm });
  return close;
}

export function openVersionHistoryDialog({
  C, queueFrame, revisions, baseline, planLastSync, showReset, onReset,
}) {
  const resetId = actionId('fpe-reset-copy');
  const rows = [...revisions].reverse().map((revision) => `<li>
    <strong>V${revision.number + 1} · lokal publiziert</strong>
    <span>${C.escape(new Date(revision.createdAt).toLocaleString('de-CH'))} · ${C.escape(revision.createdBy)}</span>
    <small>${revision.document.rooms.length} Räume · ${revision.document.placements.length} Objekte</small>
  </li>`).join('');
  const close = C.openModal({
    id: 'fpe-history-modal',
    size: 'md',
    title: 'Versionsverlauf im Prototyp',
    body: `${C.notification('Diese Einträge existieren nur auf diesem Gerät und sind keine freigegebenen Planrevisionen.', 'info', 'InfoCircle')}
      <ol class="fpe-version-list">${rows || '<li><strong>Noch keine lokale Veröffentlichung</strong><span>Eine Publikation kann im Bearbeitungsmodus simuliert werden.</span></li>'}
        <li><strong>V1 · Ausgangsstand</strong><span>${C.escape(planLastSync || 'Quellstand des Portals')}</span><small>${baseline.rooms.length} Räume · ${baseline.placements.length} illustrative Objekte</small></li>
      </ol>`,
    footer: `${showReset ? `<button type="button" class="btn btn--outline" id="${resetId}">Arbeitskopie verwerfen</button>` : ''}
      <button type="button" class="btn btn--filled" data-modal-close>Schliessen</button>`,
  });
  if (showReset) wireAction({ queueFrame, id: resetId, close, onConfirm: onReset });
  return close;
}
