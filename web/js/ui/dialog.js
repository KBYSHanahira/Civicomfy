// In-app replacement for window.confirm / alert / prompt.
//
// Native dialogs render browser chrome we do not control — it announces the
// page's own origin, ignores the theme and blocks the whole page. This mounts
// one reusable panel and hands back a promise, so callers read almost the same
// as before:
//
//   if (!await ui.showConfirm({ ... })) return;
//
// Only one dialog is visible at a time; further requests queue behind it, and an
// identical pending message is folded into the one already waiting so a burst of
// the same error cannot stack up panels.

// Font Awesome 5.15.4 is what ships with the extension — FA6 names render blank.
const TONE_ICONS = {
  info: 'fa-info-circle',
  success: 'fa-check-circle',
  warning: 'fa-exclamation-triangle',
  error: 'fa-exclamation-circle',
  question: 'fa-question-circle',
};

const TONE_ALIASES = { warn: 'warning', danger: 'error', fail: 'error', ok: 'success' };

function normaliseTone(tone) {
  const t = TONE_ALIASES[tone] || tone;
  return TONE_ICONS[t] ? t : 'info';
}

export class Dialog {
  /**
   * @param {() => HTMLElement|null} getMount Resolves the element to mount into.
   *   Mounted as a sibling of .civitai-downloader-modal-content, never inside
   *   it: the backdrop-filter on the wrapper makes it the containing block for
   *   fixed positioning, and the content box clips overflow (the same trap that
   *   once made toasts invisible).
   */
  constructor(getMount) {
    this._getMount = getMount;
    this._el = null;
    this._parts = null;
    this._current = null;
    this._queue = [];
    this._lastFocused = null;
  }

  get isOpen() {
    return this._current !== null;
  }

  /** Ask a yes/no question. Resolves true only when confirmed. */
  confirm({ title = 'Are you sure?', message = '', tone = 'question',
            confirmLabel = 'OK', cancelLabel = 'Cancel' } = {}) {
    return this._enqueue({ kind: 'confirm', title, message, tone, confirmLabel, cancelLabel });
  }

  /** Tell the user something they must acknowledge. Always resolves true. */
  alert({ title = 'Notice', message = '', tone = 'info', confirmLabel = 'OK' } = {}) {
    return this._enqueue({ kind: 'alert', title, message, tone, confirmLabel, cancelLabel: null });
  }

  /** Ask for a line of text. Resolves the trimmed value, or null if cancelled. */
  prompt({ title = '', message = '', defaultValue = '', placeholder = '',
           confirmLabel = 'Create', cancelLabel = 'Cancel', tone = 'question' } = {}) {
    return this._enqueue({
      kind: 'prompt', title, message, tone, confirmLabel, cancelLabel,
      defaultValue, placeholder,
    });
  }

  /** Dismiss whatever is showing as if Cancel was pressed. */
  cancelTop() {
    if (this._current) this._settle(this._current.kind === 'alert' ? true : false);
  }

  // ---- internals ----

  _enqueue(request) {
    // Fold a duplicate acknowledgement into the pending one rather than showing
    // the same panel twice (e.g. one failure reported by two code paths).
    if (request.kind === 'alert') {
      const same = (r) => r && r.kind === 'alert' && r.title === request.title && r.message === request.message;
      if (same(this._current) || this._queue.some(same)) return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      request.resolve = resolve;
      if (this._current) this._queue.push(request);
      else this._render(request);
    });
  }

  _build() {
    if (this._el) return true;
    const mount = this._getMount?.() || document.body;
    if (!mount) return false;

    const backdrop = document.createElement('div');
    backdrop.className = 'civitai-dialog';

    const panel = document.createElement('div');
    panel.className = 'civitai-dialog-panel';
    panel.setAttribute('role', 'alertdialog');
    panel.setAttribute('aria-modal', 'true');

    const heading = document.createElement('h4');
    heading.className = 'civitai-dialog-title';
    heading.id = 'civitai-dialog-title';
    const icon = document.createElement('i');
    const titleText = document.createElement('span');
    heading.append(icon, titleText);

    const message = document.createElement('p');
    message.className = 'civitai-dialog-message';
    message.id = 'civitai-dialog-message';

    const input = document.createElement('input');
    input.type = 'text';
    // Reuse .civitai-input so theming, hover and the focus ring come for free.
    input.className = 'civitai-input civitai-dialog-input';
    input.autocomplete = 'off';
    input.spellcheck = false;

    const actions = document.createElement('div');
    actions.className = 'civitai-dialog-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'civitai-button secondary civitai-dialog-cancel';
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'civitai-button primary civitai-dialog-confirm';
    actions.append(cancelBtn, confirmBtn);

    panel.append(heading, message, input, actions);
    panel.setAttribute('aria-labelledby', heading.id);
    panel.setAttribute('aria-describedby', message.id);
    backdrop.appendChild(panel);
    mount.appendChild(backdrop);

    confirmBtn.addEventListener('click', () => this._settle(this._currentValue()));
    cancelBtn.addEventListener('click', () => this._settle(this._current?.kind === 'prompt' ? null : false));
    // Clicking the backdrop is a cancel, matching the old confirmation modal.
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) this.cancelTop(); });

    backdrop.addEventListener('keydown', (e) => {
      if (!this._current) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        // Keep the plugin window's own Esc handler from closing everything.
        e.stopPropagation();
        this.cancelTop();
        return;
      }
      if (e.key === 'Enter' && e.target !== cancelBtn) {
        e.preventDefault();
        e.stopPropagation();
        this._settle(this._currentValue());
        return;
      }
      if (e.key === 'Tab') this._trapFocus(e);
    });

    this._el = backdrop;
    this._parts = { panel, heading, icon, titleText, message, input, actions, cancelBtn, confirmBtn };
    return true;
  }

  _currentValue() {
    if (this._current?.kind === 'prompt') return this._parts.input.value.trim();
    return true;
  }

  _focusable() {
    const { input, cancelBtn, confirmBtn } = this._parts;
    return [
      this._current?.kind === 'prompt' ? input : null,
      this._current?.kind === 'alert' ? null : cancelBtn,
      confirmBtn,
    ].filter(Boolean);
  }

  _trapFocus(event) {
    const items = this._focusable();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  _render(request) {
    if (!this._build()) {
      // No place to mount (initialisation failed before the UI existed): fall
      // back to the native dialogs rather than silently swallowing the message.
      request.resolve(this._native(request));
      return;
    }

    this._current = request;
    const tone = normaliseTone(request.tone);
    const { panel, icon, titleText, message, input, cancelBtn, confirmBtn } = this._parts;

    panel.className = `civitai-dialog-panel civitai-dialog-panel--${tone}`;
    icon.className = `fas ${TONE_ICONS[tone]}`;
    // textContent throughout: titles and messages carry model names and server
    // errors, so they must never be parsed as markup.
    titleText.textContent = request.title || '';
    message.textContent = request.message || '';
    message.style.display = request.message ? '' : 'none';

    const isPrompt = request.kind === 'prompt';
    input.style.display = isPrompt ? '' : 'none';
    input.value = isPrompt ? (request.defaultValue || '') : '';
    input.placeholder = isPrompt ? (request.placeholder || '') : '';

    cancelBtn.style.display = request.cancelLabel ? '' : 'none';
    cancelBtn.textContent = request.cancelLabel || '';
    confirmBtn.textContent = request.confirmLabel || 'OK';
    confirmBtn.className = 'civitai-button civitai-dialog-confirm '
      + (tone === 'error' || tone === 'warning' ? 'danger' : 'primary');

    // Remember where focus came from — but ignore our own controls, or draining
    // a queue would "restore" focus to the button of the dialog that just closed.
    const previous = document.activeElement;
    if (!this._el.contains(previous)) this._lastFocused = previous;
    this._el.classList.add('open');
    // Focus synchronously: adding .open already made the panel focusable, and a
    // requestAnimationFrame callback never runs while the tab is hidden, which
    // would leave the dialog open with focus stranded on the page behind it.
    if (isPrompt) {
      input.focus();
      input.select();
    } else {
      confirmBtn.focus();
    }
  }

  _settle(value) {
    const request = this._current;
    if (!request) return;
    this._current = null;
    this._el.classList.remove('open');

    try {
      request.resolve(value);
    } finally {
      const next = this._queue.shift();
      if (next) {
        this._render(next);
      } else if (this._lastFocused && typeof this._lastFocused.focus === 'function') {
        this._lastFocused.focus();
        this._lastFocused = null;
      }
    }
  }

  _native(request) {
    const text = [request.title, request.message].filter(Boolean).join('\n\n');
    if (request.kind === 'confirm') return window.confirm(text);
    if (request.kind === 'prompt') {
      const answer = window.prompt(text, request.defaultValue || '');
      return answer === null ? null : answer.trim();
    }
    window.alert(text);
    return true;
  }
}
