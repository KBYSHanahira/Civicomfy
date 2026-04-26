// File: web/js/utils/dom.js

/**
 * Attaches mouse-wheel zoom and drag-to-pan to a lightbox media element.
 * @param {HTMLElement} mediaEl - The img (or video) element to zoom.
 * @param {HTMLElement} badgeContainer - Parent element (must be positioned) to host the zoom-% badge.
 * @returns {{ reset: Function, cleanup: Function }}
 */
export function attachLightboxZoom(mediaEl, badgeContainer) {
    let scale = 1.0;
    let tx = 0, ty = 0;
    let dragging = false, startX = 0, startY = 0;
    let fadeTimer = null;

    // Zoom-percentage badge
    const badge = document.createElement('div');
    badge.className = 'civitai-lightbox-zoom-badge';
    badge.textContent = '100%';
    badgeContainer.appendChild(badge);

    function _apply() {
        mediaEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
        mediaEl.style.cursor = scale > 1.01 ? (dragging ? 'grabbing' : 'grab') : '';
        if (scale > 1.01) {
            badgeContainer.classList.add('civitai-lightbox--zoomed');
        } else {
            badgeContainer.classList.remove('civitai-lightbox--zoomed');
        }
    }

    function _showBadge() {
        badge.textContent = `${Math.round(scale * 100)}%`;
        badge.classList.add('visible');
        clearTimeout(fadeTimer);
        fadeTimer = setTimeout(() => badge.classList.remove('visible'), 1500);
    }

    const _onWheel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        scale = Math.min(5.0, Math.max(0.2, parseFloat((scale + delta).toFixed(3))));
        if (scale < 1.05) { scale = 1.0; tx = 0; ty = 0; }
        _apply();
        _showBadge();
    };

    const _onMouseDown = (e) => {
        if (scale <= 1.01 || e.button !== 0) return;
        dragging = true;
        startX = e.clientX - tx;
        startY = e.clientY - ty;
        mediaEl.style.cursor = 'grabbing';
        e.preventDefault();
        e.stopPropagation();
    };

    const _onMouseMove = (e) => {
        if (!dragging) return;
        tx = e.clientX - startX;
        ty = e.clientY - startY;
        mediaEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    };

    const _onMouseUp = () => {
        if (!dragging) return;
        dragging = false;
        _apply();
    };

    mediaEl.addEventListener('wheel', _onWheel, { passive: false });
    mediaEl.addEventListener('mousedown', _onMouseDown);
    document.addEventListener('mousemove', _onMouseMove);
    document.addEventListener('mouseup', _onMouseUp);

    function reset() {
        scale = 1.0; tx = 0; ty = 0; dragging = false;
        mediaEl.style.transform = '';
        mediaEl.style.cursor = '';
        badge.classList.remove('visible');
        badgeContainer.classList.remove('civitai-lightbox--zoomed');
        clearTimeout(fadeTimer);
    }

    function cleanup() {
        mediaEl.removeEventListener('wheel', _onWheel);
        mediaEl.removeEventListener('mousedown', _onMouseDown);
        document.removeEventListener('mousemove', _onMouseMove);
        document.removeEventListener('mouseup', _onMouseUp);
        if (badge.parentNode) badge.remove();
        clearTimeout(fadeTimer);
    }

    return { reset, cleanup };
}

/**
 * Dynamically adds a CSS link to the document's head.
 * It resolves the path relative to this script's location using import.meta.url,
 * making it robust against case-sensitivity issues and different install paths.
 * @param {string} relativeHref - Relative path to the CSS file (e.g., '../civitaiDownloader.css').
 * @param {string} [id="civitai-downloader-styles"] - The ID for the link element.
 */
export function addCssLink(relativeHref, id = "civitai-downloader-styles") {
  if (document.getElementById(id)) return; // Prevent duplicates

  try {
    const absoluteUrl = new URL(relativeHref, import.meta.url);

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = absoluteUrl.href;

    link.onload = () => {
      console.log("[Civicomfy] CSS loaded successfully:", link.href);
    };
    link.onerror = () => {
      console.error("[Civicomfy] Critical error: Failed to load CSS from:", link.href);
    };

    document.head.appendChild(link);
  } catch (e) {
    console.error("[Civicomfy] Error creating CSS link. import.meta.url may be unsupported in this context.", e);
  }
}
