// Centralized feedback utilities: toasts and icon CSS

export class Feedback {
  constructor(toastElement) {
    this.toastElement = toastElement || null;
    this.toastTimeout = null;
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

  show(message, type = 'info', duration = 3000) {
    if (!this.toastElement) return;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }
    const valid = ['info', 'success', 'error', 'warning'];
    const toastType = valid.includes(type) ? type : 'info';

    this.toastElement.textContent = message;
    this.toastElement.className = 'civitai-toast';
    this.toastElement.classList.add(toastType);
    requestAnimationFrame(() => this.toastElement.classList.add('show'));
    this.toastTimeout = setTimeout(() => {
      this.toastElement.classList.remove('show');
      this.toastTimeout = null;
    }, duration);
  }
}

