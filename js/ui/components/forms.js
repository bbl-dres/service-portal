import { CHEVRON_SVG, escape, icon, safeClassList } from './primitives.js';
import { announce } from './feedback.js';
import { classifyUrl, newWindowAttrs, safeLinkUrl } from '../../security/urls.js';

// --- Forms (form.postcss + input.postcss + select.postcss) -------------------
// CD select: label + .select wrapper + native <select> + .select__icon chevron.
export function select(o = {}) {
  const id = o.id;
  const size = ['sm', 'base', 'lg'].includes(o.size) ? o.size : 'base';
  const variant = ['outline', 'negative'].includes(o.variant) ? o.variant : 'outline';
  const msgType = ['error', 'hint', 'info', 'success', 'warning'].includes(o.messageType) ? o.messageType : 'error';
  const isError = Boolean(o.message) && msgType === 'error';
  const hintId = o.hint ? `${id}-hint` : '';
  const msgId = o.message ? `${id}-msg` : '';
  const described = [hintId, msgId, o.describedBy].filter(Boolean).join(' ');

  const ctrl = [`input--${variant}`, `input--${size}`];
  if (isError) ctrl.push('input--error');

  const lbl = [];
  if (variant === 'negative') lbl.push('text--negative');
  if (o.hideLabel) lbl.push('sr-only');
  if (o.required) lbl.push('text--asterisk');

  const opts = (o.options || []).map((x) => {
    const v = (x && typeof x === 'object') ? x.value : x;
    // Option key is consistently `label`. Only fault-report still consumed the
    // former secondary `text` path, and it has been migrated (review B14).
    const t = (x && typeof x === 'object') ? x.label : x;
    const sel = String(v) === String(o.value == null ? '' : o.value) ? ' selected' : '';
    const dis = (x && typeof x === 'object' && x.disabled) ? ' disabled' : '';
    return `<option value="${escape(v)}"${sel}${dis}>${escape(t)}</option>`;
  }).join('');

  const wrapClass = safeClassList(o.wrapClass);
  return `<div class="form__group__select${wrapClass ? ' ' + wrapClass : ''}">
  ${o.label ? `<label for="${escape(id)}"${lbl.length ? ` class="${lbl.join(' ')}"` : ''}>${escape(o.label)}${
      o.required ? '<span class="sr-only"> Pflichtfeld</span>' : ''}</label>` : ''}
  ${o.hint ? `<p class="form__group__hint" id="${escape(hintId)}">${escape(o.hint)}</p>` : ''}
  <div class="select${o.bare ? ' select--bare' : ''}">
    <select id="${escape(id)}" name="${escape(o.name || id)}" class="${ctrl.join(' ')}"${
      o.required ? ' required aria-required="true"' : ''}${
      o.disabled ? ' disabled' : ''}${
      isError ? ' aria-invalid="true"' : ''}${
      described ? ` aria-describedby="${escape(described)}"` : ''}${o.attrsHtml ? ' ' + o.attrsHtml : ''}>${opts}</select>
    <div class="select__icon">${CHEVRON_SVG}</div>
  </div>
  ${/* NO live role on the field message: every form page renders one errorSummary
        (role="alert") as its ONE status message (WCAG 4.1.3). A role on the field
        announced the same error two or three times. CD Input.vue likewise gives
        the message no live role; aria-describedby still reads it with the field.
        The former `quiet` parameter had zero callers and was removed (design
        review B9). */''}
  ${o.message ? `<div class="badge badge--sm badge--${escape(msgType)}" id="${escape(msgId)}">${escape(o.message)}</div>` : ''}
</div>`;
}


// Error summary at the form header (WCAG 3.3.1/3.3.3). Previously only field
// messages existed. After a failed submission of a multi-page government form,
// the user must see in one place WHAT needs correction and be able to jump there.
// `errors` is keyed by DOM id so anchors resolve; `labels` supplies plain names.
export function errorSummary({ errors = {}, labels = {}, id = 'err-summary' } = {}) {
  const ids = Object.keys(errors);
  if (!ids.length) return '';
  const items = ids.map((k) => `<li><a href="#${escape(k)}" data-err-link="${escape(k)}">${
    escape(labels[k] || k)}: ${escape(errors[k])}</a></li>`).join('');
  return `<div class="notification notification--error error-summary" id="${escape(id)}" role="alert">
    ${icon('WarningCircle', 'notification__icon')}
    <div class="notification__content">
      <h2 class="error-summary__title" tabindex="-1">${ids.length === 1
        ? 'Ein Feld muss noch korrigiert werden'
        : `${ids.length} Felder müssen noch korrigiert werden`}</h2>
      <ul class="error-summary__list">${items}</ul>
    </div></div>`;
}

// CD select wrapper: `<select>` plus an overlaid chevron. `CHEVRON_SVG` is the
// module constant above. The former `chevron` export merely aliased it and had
// no callers.
export function selectBox(innerHtml, extraClass = '') {
  const classes = safeClassList(extraClass);
  return `<div class="select${classes ? ' ' + classes : ''}">${innerHtml}<div class="select__icon">${CHEVRON_SVG}</div></div>`;
}

// Wire error-summary anchors and focus its heading; otherwise focus lands on
// <body> after an unsuccessful attempt.
export function wireErrorSummary(mount, { focus = true } = {}) {
  mount.querySelectorAll('[data-err-link]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const t = mount.querySelector('#' + CSS.escape(a.dataset.errLink));
    if (t) { t.focus(); t.scrollIntoView({ block: 'center', behavior: 'auto' }); }
  }));
  if (!focus) return false;
  const h = mount.querySelector('.error-summary__title');
  if (h) { h.focus({ preventScroll: false }); return true; }
  return false;
}

// CD field wrapper for input/textarea. `control` receives (classes, attributes)
// so required/aria-describedby/aria-invalid land on the control itself.
export function field(o = {}) {
  const id = o.id;
  const msgType = ['error', 'hint', 'info', 'success', 'warning'].includes(o.messageType) ? o.messageType : 'error';
  const isError = Boolean(o.message) && msgType === 'error';
  const hintId = o.hint ? `${id}-hint` : '';
  const msgId = o.message ? `${id}-msg` : '';
  const described = [hintId, msgId].filter(Boolean).join(' ');
  const lblCls = [o.required ? 'text--asterisk' : '', o.hideLabel ? 'sr-only' : ''].filter(Boolean).join(' ');
  const lbl = lblCls ? ` class="${lblCls}"` : '';
  // `name` was missing throughout (a field without name is invisible to autofill
  // and any real backend). `autocomplete`/`inputmode` control the mobile keyboard
  // and suggestions (Item 3.11).
  const attrs = ` name="${escape(o.name || id)}"`
    + `${o.required ? ' required aria-required="true"' : ''}`
    + `${o.autocomplete ? ` autocomplete="${escape(o.autocomplete)}"` : ''}`
    + `${o.inputmode ? ` inputmode="${escape(o.inputmode)}"` : ''}`
    + `${isError ? ' aria-invalid="true"' : ''}`
    + `${described ? ` aria-describedby="${escape(described)}"` : ''}`;
  const cls = `input--outline input--base${isError ? ' input--error' : ''}`;
  // The hint appears BEFORE the field (needed while completing it, not after) and
  // is a paragraph rather than a pill. Only the error message remains a badge
  // with role="alert". Previously both looked alike and the hint appeared below
  // the field (Item 3.12).
  return `<div class="form__group__input">
    <label for="${escape(id)}"${lbl}>${escape(o.label)}${o.required ? '<span class="sr-only"> Pflichtfeld</span>' : ''}</label>
    ${o.hint ? `<p class="form__group__hint" id="${escape(hintId)}">${escape(o.hint)}</p>` : ''}
    ${o.control(cls, attrs)}
    ${/* No live role. As with select(), errorSummary is the single status
          message (WCAG 4.1.3, design review B9). */''}
    ${o.message ? `<div class="badge badge--sm badge--${escape(msgType)}" id="${escape(msgId)}">${escape(o.message)}</div>` : ''}
  </div>`;
}

// Read a form value from `mount` (replaces three copied local val() functions);
// return '' when the field is absent.
export function val(mount, id) { const el = mount.querySelector('#' + id); return el ? el.value : ''; }

// Read several fields into an object. `map` = { targetKey: fieldId }. Missing
// fields return ''; callers handle coercion (numbers) and `|| fallback` logic.
// Typical: Object.assign(state, C.readForm(mount, { buildingId: 'bld', 'ort': 'ort' })).
export function readForm(mount, map) {
  const out = {};
  for (const [key, id] of Object.entries(map)) out[key] = val(mount, id);
  return out;
}

// --- Form seams (design review A8/A9/B8/B12) --------------------------------
// Remove an error message as soon as the user corrects its field (Item 3.6).
// Superset version from building-create: listen to `change` in addition to
// `input`, because pointer interaction with <select> fires no input event.
// space-request and building-create previously had one copy each, while
// fault-report and workspace had none, making equivalent forms behave differently.
export function wireFieldErrors(mount, errors) {
  Object.keys(errors).forEach((id) => {
    const el = mount.querySelector('#' + CSS.escape(id));
    if (!el) return;
    const clear = () => {
      if (!errors[id]) return;
      delete errors[id];
      el.classList.remove('input--error');
      el.removeAttribute('aria-invalid');
      const msg = mount.querySelector('#' + CSS.escape(id) + '-msg');
      if (msg) msg.remove();
    };
    el.addEventListener('input', clear, { once: true });
    el.addEventListener('change', clear, { once: true });
  });
}

// Focus + announcement on the success screen. processDone renders its heading
// with tabindex="-1" PRECISELY for this, but only building-create used it. In
// three sibling flows, focus fell to <body> after submission.
export function focusProcessDone(mount, instance) {
  const h = mount.querySelector('h1[tabindex="-1"], h2[tabindex="-1"]');
  if (h) h.focus();
  if (instance && instance.reference) announce(`Vorgang erstellt. Referenz ${instance.reference}.`);
}

// CD step-indicator.postcss:5-24 / StepIndicator.vue:2-9 — ONE numbered step
// indicator instead of two hand-rolled copies in space-request and transaction
// (Item 3.10). Supplies CD's `.step__indicator` wrapper, which the union selectors
// from Item 1.17d/2.3 already support.
function stepIndicator(labels, current = 0, { label = 'Fortschritt' } = {}) {
  const li = (l, i) => {
    const done = i < current, active = i === current;
    const mod = done ? ' step__indicator-step--confirmed' : active ? ' step__indicator-step--active' : '';
    const sr = done ? 'Erledigt: ' : active ? 'Aktueller Schritt: ' : 'Offen: ';
    return `<li class="step__indicator"${active ? ' aria-current="step"' : ''}>`
      + `<span class="step__indicator-step${mod}">${done ? icon('CheckmarkBold', 'icon--sm') : i + 1}</span>`
      + `<span><span class="sr-only">${sr}Schritt ${i + 1} von ${labels.length}: </span>${escape(l)}</span></li>`;
  };
  return `<ol class="steps" aria-label="${escape(label)}">${labels.map(li).join('')}</ol>`;
}

// Wizard header: step indicator + step heading (sr-only by default, optionally
// visible at the appropriate level) + required-field legend. `step` is one-based,
// matching the apps.
export function wizardHead(labels, step, { headId = 'wiz-step-head', label = 'Antragsschritte', legend = true,
  heading = 'h2', title = '', visible = false } = {}) {
  const headingTag = ['h2', 'h3', 'h4'].includes(heading) ? heading : 'h2';
  const headingText = title || labels[step - 1];
  return `${stepIndicator(labels, step - 1, { label })}
    <${headingTag} class="${visible ? 'wizard-step__title' : 'sr-only'}" id="${escape(headId)}" tabindex="-1">Schritt ${step} von ${labels.length}: ${escape(headingText)}</${headingTag}>
    ${legend ? '<p class="small muted">Mit <span class="text--asterisk" aria-hidden="true"></span> markierte Felder sind Pflichtfelder.</p>' : ''}`;
}

// A step change is a context change: focus the step heading and announce WITH
// its name («Schritt 2 von 3: Bedarf»). space-request previously announced only
// the number, while building-create included the name (design review D31).
export function focusWizardStep(mount, labels, step, { headId = 'wiz-step-head' } = {}) {
  const h = mount.querySelector('#' + headId) || mount.querySelector('h1');
  if (h) h.focus({ preventScroll: true });
  announce(`Schritt ${step} von ${labels.length}: ${labels[step - 1]}`);
}

// Context row below the form h1 — ONE formula for all four flows:
// «<action> als NAME · ORG (· Prozess: …)». Previously every app decided
// independently whether to show name and process preview (design review B12).
export function contextLine({ action, name = '', org, process = '' }) {
  return `<p class="muted">${escape(action)} als ${name ? `<strong>${escape(name)}</strong> · ` : ''}<strong>${escape(org)}</strong>${
    process ? ` · Prozess: ${escape(process)}` : ''}.</p>`;
}

// --- Login notice (AGOV / FedLogin) -----------------------------------------
// No content is hidden; when signed out, only this notice appears where a case
// would be started.
//
// `next` is the route that COMPLETES login. Without it, the path stopped halfway:
// the button sat where the start-case action normally appears, signed in, redrew the
// page, and forced the user to press the real button a second time in the same
// place they had just clicked (user finding, 2026-08-06). When the notice is
// ALREADY on the target page (form apps, personal cases), leave `next` empty;
// redrawing is already the destination there.
export function loginGate(text = 'Zum Starten dieses Vorgangs ist eine Anmeldung erforderlich.', opts = {}) {
  // Space before the button through `.login-gate .btn { margin-top:1rem }`
  // (app.css), not an inline style. CD's banner scale
  // (notification.postcss:89-92) does not apply because the button sits INSIDE
  // __content, not beside it.
  return `<div class="notification notification--hint login-gate">
    ${icon('Lock', 'notification__icon')}
    <div class="notification__content">
      <p class="m-0">${escape(text)}</p>
      ${loginButton({ ...opts, cls: 'btn btn--outline btn--icon-left login-gate__btn' })}
    </div>
  </div>`;
}

// The ONE login button (notice banner, access card, header). Delegated through
// `data-login`, not inline onclick, matching the house rule for menu() and
// notifications. `next` as a data attribute is also safely escaped, while a URL
// inside an onclick string breaks at every apostrophe.
function loginButton({ next = '', label = '', cls = 'btn btn--outline btn--icon-left', size = '' } = {}) {
  const safeNext = safeLinkUrl(next);
  return `<button type="button" class="${cls}${size ? ' ' + size : ''}" data-login${
    safeNext ? ` data-login-next="${escape(safeNext)}"` : ''}>${icon('User', 'btn__icon')}<span class="btn__text">${
    escape(label || 'Anmelden mit AGOV / FedLogin')}</span></button>`;
}

// --- Access card ------------------------------------------------------------
// ONE card for the question «how do I get in here?» on both service and
// application landing pages. Previously there were two constructions: the
// application put the button above the text, while the service reversed them at
// half the size. The button belongs above (user decision, 2026-08-06): it is the
// answer, and the text is the footnote.
//
// The caller separates target kind (`external`) from window behaviour
// (`newWindow`). Same-tab targets can continue connecting login directly to the
// entry. In a new tab, the start remains a real link; the target application's
// router shows its login gate there if required. The browser click remains
// synchronous and is not intercepted by popup blockers.
export function accessCard({
  title = 'Zugriff', href = '', label = 'Öffnen', loginLabel = '',
  external = false, newWindow = false, requiresLogin = false, loggedIn = false, user = null,
  note = '', steps = [], free = '',
  missing = 'Im Prototyp ist kein Zielsystem angebunden.',
} = {}) {
  // `#` and rejected URL schemes are unavailable targets.
  const safeHref = safeLinkUrl(href);
  const has = !!safeHref;
  const opensNewWindow = external || newWindow;
  const arrow = opensNewWindow ? 'External' : 'ArrowRight';
  const linkAttrs = opensNewWindow
    ? newWindowAttrs(safeHref, { external: external && classifyUrl(safeHref) === 'external' })
    : '';
  let action, context;

  if (!has) {
    // <span aria-disabled>, not <button disabled>: the target is a link, and a
    // disabled link is not an HTML control (app.css:1375).
    action = `<span class="btn btn--outline btn--icon-right" aria-disabled="true">${
      icon(arrow, 'btn__icon')}<span class="btn__text">${escape(label)}</span></span>`;
    context = `<p class="small muted m-0">${escape(missing)}</p>`;
  } else if (requiresLogin && !loggedIn && !newWindow) {
    action = loginButton({ next: safeHref, label: loginLabel || `Anmelden und ${label}` });
    context = `<p class="small m-0">${icon('Lock', 'icon--base')} Für den Zugriff ist eine Anmeldung mit AGOV / FedLogin erforderlich.</p>`;
  } else {
    action = `<a class="btn btn--outline btn--icon-right" href="${escape(safeHref)}"${linkAttrs}>${
      icon(arrow, 'btn__icon')}<span class="btn__text">${escape(label)}</span></a>`;
    context = requiresLogin
      ? (loggedIn && user
        ? `<p class="small muted m-0">Angemeldet als <strong>${escape(user.name)}</strong> · ${escape(user.org)}.</p>`
        : `<p class="small m-0">${icon('Lock', 'icon--base')} Die Anmeldung erfolgt in der gestarteten Anwendung.</p>`)
      : (free ? `<p class="small muted m-0">${escape(free)}</p>` : '');
  }

  return `<div class="box access-card">
    <h3>${escape(title)}</h3>
    <p class="access-card__action">${action}</p>
    ${context}
    ${note ? `<p class="small m-0">${escape(note)}</p>` : ''}
    ${steps.length ? `<ul class="list--default small muted mt-2">${
      steps.map((s) => `<li>${escape(s)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

// One delegated wiring for all login buttons (app.js). Delegate on document so
// it survives every page change, like wireShare.
export function wireLogin(root = document) {
  root.addEventListener('click', (e) => {
    const login = e.target.closest && e.target.closest('[data-login]');
    if (login && window.__login) {
      window.__login(login.dataset.loginNext || '');
      return;
    }
    const logout = e.target.closest && e.target.closest('[data-logout]');
    if (logout && window.__logout) window.__logout();
  });
}
