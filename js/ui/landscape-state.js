const MEMORY = new Map();

const memoryFor = (id) => {
  if (!MEMORY.has(id)) MEMORY.set(id, new Map());
  return MEMORY.get(id);
};

// Box keys must include the view axis and scope. Labels alone can collide when
// two scopes contain the same group name or when the reader changes grouping.
export const landscapeKey = (...parts) => parts
  .map((part) => encodeURIComponent(String(part == null ? '' : part)))
  .join(':');

export function landscapeState(id, { openByDefault = true } = {}) {
  const memory = memoryFor(id);
  const state = (key) => (memory.has(key) ? memory.get(key) === true : openByDefault);
  return {
    isOpen: state,
    toggle: (key) => {
      const next = !state(key);
      memory.set(key, next);
      return next;
    },
    setAll: (keys, open) => { keys.forEach((key) => memory.set(key, open === true)); },
    anyOpen: (keys) => keys.some(state),
  };
}

// Landscape markup is replaced on every fold. Event delegation stays on the
// stable hosts and focus is restored to the equivalent new control.
export function wireLandscape({ panel, tools, state, keys, redraw } = {}) {
  const findByData = (root, attribute, value) => [...(root?.querySelectorAll(`[${attribute}]`) || [])]
    .find((element) => element.getAttribute(attribute) === value);

  const onToolsClick = (event) => {
    const button = event.target.closest('[data-lscape-all]');
    if (!button || !tools?.contains(button)) return;
    const open = button.dataset.lscapeAll === 'open';
    state.setAll(keys(), open);
    redraw();
    tools.querySelector('[data-lscape-all]')?.focus();
  };

  const onPanelClick = (event) => {
    const button = event.target.closest('.lscape__toggle[data-box]');
    if (!button || !panel?.contains(button)) return;
    const key = button.dataset.box;
    state.toggle(key);
    redraw();
    findByData(panel, 'data-box', key)?.focus();
  };

  tools?.addEventListener('click', onToolsClick);
  panel?.addEventListener('click', onPanelClick);
  return () => {
    tools?.removeEventListener('click', onToolsClick);
    panel?.removeEventListener('click', onPanelClick);
  };
}
