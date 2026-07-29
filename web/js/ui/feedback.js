// Centralized feedback utilities: toasts and icon CSS

// Titles for the acknowledgement dialog that errors and warnings are routed to.
const DIALOG_TITLES = { error: 'Something went wrong', warning: 'Heads up' };

export class Feedback {
  constructor(toastElement, dialog = null) {
    this.toastElement = toastElement || null;
    this.toastTimeout = null;
    // Errors and warnings go to a modal instead of a toast: a toast that fades
    // after 3s is easy to miss, and a failure the user never saw looks like the
    // action silently did nothing.
    this.dialog = dialog;
  }

  setDialog(dialog) {
    this.dialog = dialog;
  }

  ensureFontAwesome() {
    if (document.getElementById('civitai-fontawesome-link')) return;

    const localPath = '/extensions/Civicomfy/fontawesome/css/all.min.css';
    const cdnPath   = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';

    const faLink = document.createElement('link');
    faLink.id   = 'civitai-fontawesome-link';
    faLink.rel  = 'stylesheet';
    faLink.href = localPath;

    // If local file fails (first-run before files exist), fall back to CDN
    faLink.onerror = () => {
      if (faLink.href !== cdnPath) {
        console.warn('[Civicomfy] Local Font Awesome not found, falling back to CDN.');
        faLink.removeAttribute('integrity');
        faLink.removeAttribute('crossorigin');
        faLink.href = cdnPath;
      }
    };

    document.head.appendChild(faLink);
  }

  /**
   * Report something to the user. Passing type 'error'/'warning' raises a modal
   * that has to be dismissed; 'info'/'success' stay as a self-dismissing toast.
   * Pass { asToast: true } to keep a low-stakes warning non-blocking.
   */
  show(message, type = 'info', duration = 3000, { asToast = false } = {}) {
    const aliases = { warn: 'warning', danger: 'error', fail: 'error', ok: 'success' };
    const requested = aliases[type] || type;
    const valid = ['info', 'success', 'error', 'warning'];
    const toastType = valid.includes(requested) ? requested : 'info';

    if (!asToast && this.dialog && (toastType === 'error' || toastType === 'warning')) {
      this.dialog.alert({
        title: DIALOG_TITLES[toastType],
        message: String(message ?? ''),
        tone: toastType,
      });
      return;
    }

    if (!this.toastElement) return;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }

    this.toastElement.textContent = message;
    this.toastElement.className = 'civitai-toast';
    this.toastElement.classList.add(toastType);
    // Flush the reset styles so the fade-in still animates. This used to wait
    // for requestAnimationFrame, which never runs while the tab is hidden — the
    // toast then stayed at opacity 0 while its hide timer ticked down on real
    // time, so a message raised in a background tab was simply lost.
    void this.toastElement.offsetWidth;
    this.toastElement.classList.add('show');
    this.toastTimeout = setTimeout(() => {
      this.toastElement.classList.remove('show');
      this.toastTimeout = null;
    }, duration);
  }
}

