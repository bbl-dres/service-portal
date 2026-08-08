// Shared ARIA combobox/listbox interaction. Callers own data fetching and
// option markup; this controller owns focus, active-descendant and open state.
export function createListboxController({
  input,
  list,
  onChoose,
  optionSelector = '[role="option"]',
  activeClass = 'is-active',
  blurDelay = 120,
  pointerHighlight = true,
} = {}) {
  if (!input || !list) throw new Error('Combobox input and list are required');

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-autocomplete', 'list');

  let items = [];
  let active = -1;
  let blurTimer = null;

  const options = () => [...list.querySelectorAll(optionSelector)];

  function close({ clear = true } = {}) {
    clearTimeout(blurTimer);
    list.hidden = true;
    if (clear) list.innerHTML = '';
    items = [];
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function paint() {
    options().forEach((option, index) => {
      const selected = index === active;
      option.classList.toggle(activeClass, selected);
      option.setAttribute('aria-selected', String(selected));
      if (selected) {
        input.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      }
    });
    if (active < 0) input.removeAttribute('aria-activedescendant');
  }

  function highlight(index) {
    if (!items.length) return;
    active = (index + items.length) % items.length;
    paint();
  }

  function setItems(next) {
    items = Array.isArray(next) ? next : [];
    active = -1;
    if (!items.length) return close();
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    paint();
  }

  function choose(index = active) {
    const item = items[index];
    if (item == null) return;
    close();
    if (onChoose) onChoose(item, index);
  }

  function optionIndex(target) {
    const option = target.closest(optionSelector);
    return option ? options().indexOf(option) : -1;
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      if (!list.hidden) event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab') {
      close();
      return;
    }
    if (list.hidden || !items.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlight(active + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlight(active - 1);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose();
    }
  }

  function onPointerDown(event) {
    if (optionIndex(event.target) >= 0) event.preventDefault();
  }

  function onClick(event) {
    const index = optionIndex(event.target);
    if (index >= 0) choose(index);
  }

  function onPointerMove(event) {
    if (!pointerHighlight) return;
    const index = optionIndex(event.target);
    if (index >= 0 && index !== active) highlight(index);
  }

  function onBlur() {
    blurTimer = setTimeout(close, blurDelay);
  }

  input.addEventListener('keydown', onKeydown);
  input.addEventListener('blur', onBlur);
  list.addEventListener('mousedown', onPointerDown);
  list.addEventListener('click', onClick);
  list.addEventListener('mousemove', onPointerMove);

  return {
    close,
    setItems,
    destroy() {
      clearTimeout(blurTimer);
      input.removeEventListener('keydown', onKeydown);
      input.removeEventListener('blur', onBlur);
      list.removeEventListener('mousedown', onPointerDown);
      list.removeEventListener('click', onClick);
      list.removeEventListener('mousemove', onPointerMove);
      input.removeAttribute('role');
      input.removeAttribute('aria-expanded');
      input.removeAttribute('aria-controls');
      input.removeAttribute('aria-autocomplete');
      input.removeAttribute('aria-activedescendant');
    },
  };
}
