import { CivitaiDownloaderAPI } from "../../api/civitai.js";
import { attachLightboxZoom } from "../../utils/dom.js";

// ---- Helpers ----

function _imageViewUrl(filename, subfolder) {
    const params = new URLSearchParams({ filename, type: 'output' });
    if (subfolder) params.set('subfolder', subfolder);
    return `/view?${params.toString()}`;
}

// Server-side sizes the thumbnail endpoint will produce. Requests are snapped
// to this ladder so dragging the card-size slider cannot spray the disk cache
// with a hundred near-identical widths.
const THUMB_SIZES = [256, 384, 512, 768];

function _thumbSizeFor(cardWidthPx) {
    const needed = (cardWidthPx || 148) * (window.devicePixelRatio || 1);
    return THUMB_SIZES.find(s => s >= needed) ?? THUMB_SIZES[THUMB_SIZES.length - 1];
}

/**
 * Cards render at ~150px but the source files are multi-megabyte PNGs; pointing
 * <img> at /view meant downloading and decoding the full originals just to draw
 * postage stamps, which is what made the grid crawl. This asks the server for a
 * cached downscale instead. The mtime rides along so a regenerated image busts
 * the browser cache rather than serving a stale thumbnail.
 */
function _thumbUrl(img, size) {
    const params = new URLSearchParams({ filename: img.filename, size: String(size) });
    if (img.subfolder) params.set('subfolder', img.subfolder);
    if (img.mtime) params.set('t', String(Math.floor(img.mtime)));
    return `/civitai/output_thumb?${params.toString()}`;
}

function _formatBytes(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function _formatDate(mtime) {
    if (!mtime) return '';
    const d = new Date(mtime * 1000);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function _formatShortDate(mtime) {
    if (!mtime) return '';
    const d = new Date(mtime * 1000);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function _selKey(img) {
    return `${img.filename}|||${img.subfolder ?? ''}`;
}

function _triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Kept in sync with VIDEO_EXTENSIONS on the server. media_type from the listing
// is authoritative; the extension check is only a fallback for entries that
// predate the field (e.g. a cached response from an older build).
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];

function _isVideo(img) {
    if (!img) return false;
    if (img.media_type) return img.media_type === 'video';
    const name = (img.filename || '').toLowerCase();
    return VIDEO_EXTENSIONS.some(ext => name.endsWith(ext));
}

function _mediaNoun(img) {
    return _isVideo(img) ? 'video' : 'image';
}

/**
 * A video has no server-side thumbnail (Pillow can't decode a container), so the
 * card and lightbox point straight at /view. The #t=0.1 media fragment nudges the
 * browser to paint a frame at 0.1s as the poster instead of an empty black box.
 */
function _videoPosterUrl(img) {
    return _imageViewUrl(img.filename, img.subfolder) + '#t=0.1';
}

/**
 * Drop a broken preview element and leave the card's badges/overlay intact, so a
 * thumbnail that fails to decode is still selectable and deletable. Shared by the
 * image (`fa-image`) and video (`fa-film`) paths.
 */
function _markPreviewBroken(preview, mediaEl, iconClass) {
    if (mediaEl) mediaEl.remove();
    preview.classList.add('no-preview');
    if (!preview.querySelector('.civitai-card-fallback-icon')) {
        const fallback = document.createElement('i');
        fallback.className = `fas ${iconClass} civitai-card-fallback-icon`;
        preview.prepend(fallback);
    }
}

// ---- Build card element ----

function _buildGalleryCard(img, idx, ui, thumbSize) {
    const key = _selKey(img);
    const url = _imageViewUrl(img.filename, img.subfolder);
    const isSelected = ui._gallerySelected.has(key);
    const isVideo = _isVideo(img);

    const card = document.createElement('div');
    card.className = 'civitai-gallery-card' + (isSelected ? ' selected' : '');
    card.dataset.index = idx;
    card.dataset.key = key;

    // ---- Preview area ----
    const preview = document.createElement('div');
    preview.className = 'civitai-gallery-card-preview';

    // Both branches expose data-src so the one IntersectionObserver below lazily
    // applies the real src only once the card scrolls into view — a page of
    // videos must not fetch every file's metadata up front.
    let mediaEl;
    let playBadge = null;
    if (isVideo) {
        mediaEl = document.createElement('video');
        mediaEl.muted = true;            // required for the poster frame to load unattended
        mediaEl.loop = true;
        mediaEl.preload = 'metadata';
        mediaEl.setAttribute('playsinline', '');
        mediaEl.dataset.src = _videoPosterUrl(img);
        mediaEl.onerror = () => _markPreviewBroken(preview, mediaEl, 'fa-film');
        // A play glyph so a still poster frame still reads as a video at a glance.
        playBadge = document.createElement('div');
        playBadge.className = 'civitai-gallery-card-play-badge';
        playBadge.innerHTML = '<i class="fas fa-play"></i>';
    } else {
        mediaEl = document.createElement('img');
        mediaEl.loading = 'lazy';
        mediaEl.decoding = 'async';
        mediaEl.dataset.src = _thumbUrl(img, thumbSize);
        mediaEl.alt = img.filename;
        mediaEl.onerror = () => {
            // A thumbnail can fail on its own (unreadable source, Pillow missing)
            // while the original is perfectly servable, so fall back to /view once
            // before declaring the card broken.
            if (!mediaEl.dataset.fellBack && mediaEl.src.includes('/civitai/output_thumb')) {
                mediaEl.dataset.fellBack = '1';
                mediaEl.src = url;
                return;
            }
            // Only drop the media element — wiping preview.innerHTML here used to
            // take the date badge, the selection checkbox and the whole action
            // overlay with it, leaving broken thumbnails unselectable.
            _markPreviewBroken(preview, mediaEl, 'fa-image');
        };
    }

    // Date badge (top-right)
    if (img.mtime) {
        const dateBadge = document.createElement('div');
        dateBadge.className = 'civitai-gallery-card-date-badge';
        dateBadge.textContent = _formatShortDate(img.mtime);
        preview.appendChild(dateBadge);
    }

    // Selection checkbox (top-left)
    const selectWrap = document.createElement('div');
    selectWrap.className = 'civitai-gallery-card-select-wrap';
    const checkbox = document.createElement('div');
    checkbox.className = 'civitai-gallery-card-checkbox';
    if (isSelected) checkbox.innerHTML = '<i class="fas fa-check"></i>';
    selectWrap.appendChild(checkbox);

    // Hover action overlay
    const overlay = document.createElement('div');
    overlay.className = 'civitai-gallery-card-overlay';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'civitai-button small civitai-gallery-view-btn';
    viewBtn.title = isVideo ? 'Play video' : 'View full size';
    viewBtn.innerHTML = isVideo ? '<i class="fas fa-play"></i>' : '<i class="fas fa-search-plus"></i>';

    const dlBtn = document.createElement('button');
    dlBtn.className = 'civitai-button small civitai-gallery-download-btn';
    dlBtn.title = `Download ${_mediaNoun(img)}`;
    dlBtn.innerHTML = '<i class="fas fa-download"></i>';

    const delBtn = document.createElement('button');
    delBtn.className = 'civitai-button small danger civitai-gallery-delete-single-btn';
    delBtn.title = `Delete ${_mediaNoun(img)}`;
    delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';

    overlay.appendChild(viewBtn);
    overlay.appendChild(dlBtn);
    overlay.appendChild(delBtn);

    preview.appendChild(mediaEl);
    if (playBadge) preview.appendChild(playBadge);
    preview.appendChild(selectWrap);
    preview.appendChild(overlay);

    // ---- Card body ----
    const body = document.createElement('div');
    body.className = 'civitai-gallery-card-body';

    const name = document.createElement('span');
    name.className = 'civitai-gallery-card-name';
    name.title = img.filename;
    name.textContent = img.filename;

    const meta = document.createElement('div');
    meta.className = 'civitai-gallery-card-meta';

    if (img.size_bytes) {
        const sizeSpan = document.createElement('span');
        sizeSpan.innerHTML = `<i class="fas fa-file"></i> ${_formatBytes(img.size_bytes)}`;
        meta.appendChild(sizeSpan);
    }
    if (img.mtime) {
        const dateSpan = document.createElement('span');
        dateSpan.innerHTML = `<i class="fas fa-clock"></i> ${_formatDate(img.mtime)}`;
        meta.appendChild(dateSpan);
    }

    body.appendChild(name);
    body.appendChild(meta);
    card.appendChild(preview);
    card.appendChild(body);

    // ---- Click handlers ----

    // Read the position from the DOM at click time rather than closing over the
    // build-time `idx`. Deleting a card shifts every later image down one slot in
    // ui._galleryImages; a captured index would then point at its neighbour, so
    // clicking a card after a delete opened the wrong image. _reindexGalleryCards
    // rewrites dataset.index, and this makes the handlers honour it.
    const cardIndex = () => parseInt(card.dataset.index, 10);

    selectWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.shiftKey && ui._galleryAnchorIdx !== undefined && ui._gallerySelected.size > 0) {
            _selectRange(ui, ui._galleryAnchorIdx, cardIndex());
        } else {
            toggleGallerySelect(ui, key);
            _syncCardSelection(card, ui._gallerySelected.has(key));
            ui._galleryAnchorIdx = cardIndex();
        }
    });

    viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openGalleryLightbox(ui, cardIndex());
    });

    dlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _triggerDownload(url, img.filename);
    });

    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteGalleryImage(ui, img, card);
    });

    // Card click: if selection active → toggle (with Shift = range); else open lightbox
    card.addEventListener('click', (e) => {
        if (ui._gallerySelected.size > 0) {
            if (e.shiftKey && ui._galleryAnchorIdx !== undefined) {
                _selectRange(ui, ui._galleryAnchorIdx, cardIndex());
            } else {
                toggleGallerySelect(ui, key);
                _syncCardSelection(card, ui._gallerySelected.has(key));
                ui._galleryAnchorIdx = cardIndex();
            }
        } else {
            openGalleryLightbox(ui, cardIndex());
        }
    });

    return card;
}

/**
 * Renumber the remaining cards so dataset.index matches their position in
 * ui._galleryImages again. Must run after any card is removed from the grid.
 */
function _reindexGalleryCards(ui) {
    const grid = ui.galleryGrid;
    if (!grid) return;
    grid.querySelectorAll('.civitai-gallery-card').forEach((card, i) => {
        card.dataset.index = i;
    });
}

function _syncCardSelection(card, selected) {
    const cb = card.querySelector('.civitai-gallery-card-checkbox');
    if (selected) {
        card.classList.add('selected');
        if (cb) cb.innerHTML = '<i class="fas fa-check"></i>';
    } else {
        card.classList.remove('selected');
        if (cb) cb.innerHTML = '';
    }
}

// ---- Range select (Shift+click) ----

function _selectRange(ui, fromIdx, toIdx) {
    const grid = ui.galleryGrid;
    if (!grid) return;
    const min = Math.min(fromIdx, toIdx);
    const max = Math.max(fromIdx, toIdx);
    grid.querySelectorAll('.civitai-gallery-card').forEach(card => {
        const i = parseInt(card.dataset.index, 10);
        if (i >= min && i <= max) {
            const k = card.dataset.key;
            if (k) {
                ui._gallerySelected.add(k);
                _syncCardSelection(card, true);
            }
        }
    });
    ui._galleryAnchorIdx = toIdx;
    updateGallerySelectionBar(ui);
}

// ---- Main loader ----

export async function handleGalleryLoad(ui) {
    const grid = ui.galleryGrid;
    const countEl = ui.galleryCountEl;
    if (!grid) return;

    // Clear selection whenever we do a fresh load
    if (ui._gallerySelected) {
        ui._gallerySelected = new Set();
        updateGallerySelectionBar(ui);
    }
    ui._galleryAnchorIdx = undefined;

    grid.innerHTML = '<p class="civitai-empty-state"><i class="fas fa-spinner fa-spin"></i> Loading…</p>';
    if (countEl) countEl.textContent = '';

    try {
        // A saved subfolder can only be applied once the options exist, so the
        // first load restores it before reading the control.
        if (ui._savedGallerySubfolder !== undefined && ui.gallerySubfolderSelect) {
            if (ui.gallerySubfolderSelect.querySelector(`option[value="${ui._savedGallerySubfolder}"]`)) {
                ui.gallerySubfolderSelect.value = ui._savedGallerySubfolder;
                ui._savedGallerySubfolder = undefined;
            }
        }
        const subfolder = ui.gallerySubfolderSelect?.value ?? '';
        const sort = ui.gallerySortSelect?.value ?? 'time_desc';
        const limit = parseInt(ui.galleryLimitSelect?.value ?? '30', 10);
        const page = ui._galleryPage ?? 1;

        // Consumed once: an explicit Refresh forces a fresh directory scan, but
        // the internal reloads below (subfolder restore, page clamp) should not.
        const refresh = !!ui._galleryForceRefresh;
        ui._galleryForceRefresh = false;

        const data = await CivitaiDownloaderAPI.getOutputImages({ page, limit, subfolder, sort, refresh });

        if (!data || !Array.isArray(data.images)) {
            throw new Error("Invalid response from server.");
        }

        // Populate subfolder dropdown on first load
        if (ui.gallerySubfolderSelect && Array.isArray(data.subfolders)) {
            const current = ui.gallerySubfolderSelect.value;
            ui.gallerySubfolderSelect.innerHTML = '<option value="">All subfolders</option>';
            data.subfolders.forEach(sf => {
                const opt = document.createElement('option');
                opt.value = sf;
                opt.textContent = sf;
                ui.gallerySubfolderSelect.appendChild(opt);
            });
            const restore = ui._savedGallerySubfolder !== undefined ? ui._savedGallerySubfolder : current;
            if (Array.from(ui.gallerySubfolderSelect.options).some(o => o.value === restore)) {
                ui.gallerySubfolderSelect.value = restore;
            }
            if (ui._savedGallerySubfolder !== undefined) {
                ui._savedGallerySubfolder = undefined;
                // The first request used the default subfolder; reload if the
                // restored one differs so the view matches the control.
                if (ui.gallerySubfolderSelect.value !== subfolder) {
                    ui._galleryPage = 1;
                    return handleGalleryLoad(ui);
                }
            }
        }

        // Deleting the last image on the last page leaves the page index past
        // the end of the collection, and the server rightly answers with an
        // empty slice. Drop back to the new last page instead of showing an
        // empty grid over hundreds of remaining images. Terminates: the retry
        // requests a page that exists.
        if (data.images.length === 0 && data.total > 0 && page > data.total_pages) {
            ui._galleryPage = Math.max(1, data.total_pages);
            return handleGalleryLoad(ui);
        }

        // Store images for lightbox navigation
        ui._galleryImages = data.images;
        ui._galleryTotal = data.total;
        ui._galleryTotalPages = data.total_pages;

        renderGalleryGrid(ui, data.images);
        renderGalleryPagination(ui, data.page, data.total_pages, data.total, data.images.length);

        _renderGalleryCount(ui);

    } catch (err) {
        console.error("[Civicomfy] Failed to load gallery:", err);
        grid.innerHTML = `<p class="civitai-empty-state civitai-empty-state--error"><i class="fas fa-exclamation-triangle"></i> Failed to load images: ${err.message}</p>`;
    }
}

// ---- Count label ----

function _renderGalleryCount(ui) {
    const countEl = ui.galleryCountEl;
    if (!countEl) return;
    const total = Number.isFinite(ui._galleryTotal) ? ui._galleryTotal : (ui._galleryImages || []).length;
    if (total === 0) { countEl.textContent = 'No items found'; return; }
    const shown = (ui._galleryImages || []).length;
    countEl.textContent = shown < total
        ? `${shown} of ${total} items`
        : `${total} item${total !== 1 ? 's' : ''}`;
}

// ---- Lazy-load observer (one per grid instance) ----

function _ensureLazyObserver(ui) {
    if (ui._galleryLazyObserver) return ui._galleryLazyObserver;
    ui._galleryLazyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const imgEl = entry.target;
            const src = imgEl.dataset.src;
            if (src) {
                imgEl.src = src;
                delete imgEl.dataset.src;
            }
            ui._galleryLazyObserver.unobserve(imgEl);
        });
    }, { rootMargin: '200px' });
    return ui._galleryLazyObserver;
}

// ---- Grid renderer ----

const GALLERY_CHUNK_SIZE = 8;

export function renderGalleryGrid(ui, images) {
    const grid = ui.galleryGrid;
    if (!grid) return;

    // Disconnect old observer before clearing grid
    if (ui._galleryLazyObserver) {
        ui._galleryLazyObserver.disconnect();
        ui._galleryLazyObserver = null;
    }

    const cardSize = parseInt(ui.galleryCardSizeSlider?.value ?? '148', 10);
    grid.style.setProperty('--cfy-gallery-card-w', `${cardSize}px`);

    if (!images || images.length === 0) {
        grid.innerHTML = '<p class="civitai-empty-state"><i class="fas fa-images"></i> No images or videos in your ComfyUI output folder yet.</p>';
        return;
    }

    grid.innerHTML = '';
    const observer = _ensureLazyObserver(ui);
    const thumbSize = _thumbSizeFor(cardSize);

    // Bump a render token so any in-flight chunk chain from a previous render
    // (e.g. user changed page/sort/subfolder quickly) aborts instead of
    // appending stale cards into the freshly-cleared grid.
    const renderToken = (ui._galleryRenderToken || 0) + 1;
    ui._galleryRenderToken = renderToken;

    // Render first chunk immediately so UI feels instant
    const firstChunk = images.slice(0, GALLERY_CHUNK_SIZE);
    const frag = document.createDocumentFragment();
    firstChunk.forEach((img, idx) => {
        const card = _buildGalleryCard(img, idx, ui, thumbSize);
        const mediaEl = card.querySelector('[data-src]');
        if (mediaEl) observer.observe(mediaEl);
        frag.appendChild(card);
    });
    grid.appendChild(frag);

    // Render remaining chunks via rAF to avoid blocking the main thread
    if (images.length > GALLERY_CHUNK_SIZE) {
        let offset = GALLERY_CHUNK_SIZE;
        function renderNextChunk() {
            // Abort if a newer render has started.
            if (ui._galleryRenderToken !== renderToken) return;
            if (offset >= images.length) return;
            const chunk = images.slice(offset, offset + GALLERY_CHUNK_SIZE);
            const f = document.createDocumentFragment();
            chunk.forEach((img, i) => {
                const card = _buildGalleryCard(img, offset + i, ui, thumbSize);
                const mediaEl = card.querySelector('[data-src]');
                if (mediaEl) observer.observe(mediaEl);
                f.appendChild(card);
            });
            grid.appendChild(f);
            offset += GALLERY_CHUNK_SIZE;
            // Use setTimeout(0) to yield to browser between chunks
            setTimeout(renderNextChunk, 0);
        }
        setTimeout(renderNextChunk, 0);
    }
}

// ---- Pagination ----

function renderGalleryPagination(ui, currentPage, totalPages, total, shown) {
    const container = ui.galleryPaginationContainer;
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const makeBtn = (label, page, disabled, active) => {
        const btn = document.createElement('button');
        btn.className = `civitai-button small civitai-gallery-page-btn${active ? ' primary active' : ''}`;
        btn.textContent = label;
        btn.disabled = disabled;
        if (!disabled) btn.addEventListener('click', () => {
            ui._galleryPage = page;
            handleGalleryLoad(ui);
        });
        return btn;
    };

    container.appendChild(makeBtn('«', 1, currentPage === 1, false));
    container.appendChild(makeBtn('‹', currentPage - 1, currentPage === 1, false));

    // Page window
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + 4);
    start = Math.max(1, end - 4);
    for (let p = start; p <= end; p++) {
        container.appendChild(makeBtn(String(p), p, false, p === currentPage));
    }

    container.appendChild(makeBtn('›', currentPage + 1, currentPage === totalPages, false));
    container.appendChild(makeBtn('»', totalPages, currentPage === totalPages, false));
}

// ---- Lightbox ----

export function openGalleryLightbox(ui, index) {
    const images = ui._galleryImages;
    if (!images || images.length === 0) return;

    ui._lightboxIndex = Math.max(0, Math.min(index, images.length - 1));
    _renderLightboxImage(ui);

    const lb = ui.galleryLightbox;
    if (lb) lb.style.display = 'flex';

    // Attach wheel zoom once; reset on subsequent opens
    if (!ui._lightboxZoom && ui.galleryLightboxImg && lb) {
        ui._lightboxZoom = attachLightboxZoom(ui.galleryLightboxImg, lb);
    } else if (ui._lightboxZoom) {
        ui._lightboxZoom.reset();
    }
}

function _renderLightboxImage(ui) {
    const images = ui._galleryImages;
    const idx = ui._lightboxIndex;
    if (!images || idx < 0 || idx >= images.length) return;

    const img = images[idx];
    const url = _imageViewUrl(img.filename, img.subfolder);
    const isVideo = _isVideo(img);

    const imgEl = ui.galleryLightboxImg;
    const videoEl = ui.galleryLightboxVideo;

    // Bump a token so a slow full-res image load from a previously-viewed item
    // cannot land after the user has already arrowed on to another one.
    const token = (ui._lightboxToken || 0) + 1;
    ui._lightboxToken = token;

    if (isVideo) {
        // Hand the stage to the <video>: hide the image and drop any zoom state,
        // which only ever applies to the image element.
        if (ui._lightboxZoom) ui._lightboxZoom.reset();
        if (imgEl) { imgEl.style.display = 'none'; imgEl.src = ''; }
        if (videoEl) {
            videoEl.style.display = '';
            videoEl.src = url;
            // Opening the lightbox / arrowing is a user gesture, so autoplay with
            // sound is permitted; if a browser still blocks it the controls remain.
            const p = videoEl.play();
            if (p && p.catch) p.catch(() => {});
        }
    } else {
        // Hand the stage back to the <img>: stop and fully unload the video so its
        // audio does not keep playing underneath the next image.
        if (videoEl) {
            videoEl.pause();
            videoEl.removeAttribute('src');
            videoEl.load();
            videoEl.style.display = 'none';
        }
        if (imgEl) {
            imgEl.style.display = '';
            imgEl.decoding = 'async';
            imgEl.alt = img.filename;

            // Paint the cached thumbnail first — it is usually already in the
            // browser cache from the grid, so the lightbox fills immediately
            // instead of sitting blank for the second or two a big PNG needs.
            imgEl.src = _thumbUrl(img, 768);

            const full = new Image();
            full.decoding = 'async';
            full.onload = () => {
                if (ui._lightboxToken === token) imgEl.src = url;
            };
            full.src = url;
        }
        // Reset zoom when switching images
        if (ui._lightboxZoom) ui._lightboxZoom.reset();
    }

    const nameEl = ui.galleryLightboxName;
    if (nameEl) nameEl.textContent = img.filename;

    const metaEl = ui.galleryLightboxMeta;
    if (metaEl) {
        const parts = [];
        if (img.subfolder) parts.push(`📁 ${img.subfolder}`);
        if (img.size_bytes) parts.push(_formatBytes(img.size_bytes));
        if (img.mtime) parts.push(_formatDate(img.mtime));
        parts.push(`${idx + 1} / ${images.length}`);
        metaEl.textContent = parts.join('  ·  ');
    }

    // Prev/Next visibility
    if (ui.galleryLightboxPrev) ui.galleryLightboxPrev.style.visibility = idx > 0 ? 'visible' : 'hidden';
    if (ui.galleryLightboxNext) ui.galleryLightboxNext.style.visibility = idx < images.length - 1 ? 'visible' : 'hidden';

    _preloadLightboxNeighbours(ui);
}

/**
 * Warm the browser cache for the images either side of the current one so
 * arrowing through the lightbox does not re-stall on every step. The handles
 * are parked on `ui` because a detached Image() with no reference can be
 * collected before it finishes fetching.
 */
function _preloadLightboxNeighbours(ui) {
    const images = ui._galleryImages || [];
    const idx = ui._lightboxIndex;
    const preloads = [];

    [idx - 1, idx + 1].forEach(i => {
        if (i < 0 || i >= images.length) return;
        const neighbour = images[i];
        // A video's neighbour is streamed on demand with range requests; warming
        // it through an <img> would only fetch bytes the <video> can't reuse.
        if (_isVideo(neighbour)) return;
        const el = new Image();
        el.decoding = 'async';
        el.src = _imageViewUrl(neighbour.filename, neighbour.subfolder);
        preloads.push(el);
    });

    ui._lightboxPreloads = preloads;
}

export function closeGalleryLightbox(ui) {
    const lb = ui.galleryLightbox;
    if (lb) lb.style.display = 'none';
    // Invalidate any in-flight full-res load so it cannot re-populate the
    // lightbox after it has been dismissed.
    ui._lightboxToken = (ui._lightboxToken || 0) + 1;
    ui._lightboxPreloads = null;
    if (ui.galleryLightboxImg) ui.galleryLightboxImg.src = '';
    // Stop playback and release the file so closing actually silences a video.
    if (ui.galleryLightboxVideo) {
        ui.galleryLightboxVideo.pause();
        ui.galleryLightboxVideo.removeAttribute('src');
        ui.galleryLightboxVideo.load();
    }
    if (ui._lightboxZoom) ui._lightboxZoom.reset();
}

/** Save the image currently shown in the lightbox. */
export function downloadCurrentLightboxImage(ui) {
    const img = (ui._galleryImages || [])[ui._lightboxIndex];
    if (!img) return;
    _triggerDownload(_imageViewUrl(img.filename, img.subfolder), img.filename);
}

/**
 * Delete the image currently shown in the lightbox, then move to the next one so
 * the user can keep culling without reopening. Closes when nothing is left.
 */
export async function deleteCurrentLightboxImage(ui) {
    const images = ui._galleryImages || [];
    const idx = ui._lightboxIndex;
    const img = images[idx];
    if (!img) return;

    const noun = _mediaNoun(img);
    const name = img.subfolder ? `${img.subfolder}/${img.filename}` : img.filename;
    const ok = await ui.showConfirm({
        title: `Delete ${noun}?`,
        message: `"${name}" will be removed from the output folder. This cannot be undone.`,
        tone: 'warning',
        confirmLabel: 'Delete',
    });
    if (!ok) return;

    try {
        const result = await CivitaiDownloaderAPI.deleteOutputImages([
            { filename: img.filename, subfolder: img.subfolder ?? '' }
        ]);

        if (!result || !result.deleted) {
            const errMsg = result?.errors?.join(', ') || 'Unknown error';
            if (ui.feedback) ui.feedback.show(`Delete failed: ${errMsg}`, 'error');
            return;
        }

        // Drop the matching card and keep the model in step with the grid.
        const card = ui.galleryGrid?.querySelector(`.civitai-gallery-card[data-key="${CSS.escape(_selKey(img))}"]`);
        if (card) card.remove();
        ui._gallerySelected?.delete(_selKey(img));
        updateGallerySelectionBar(ui);

        images.splice(idx, 1);
        if (Number.isFinite(ui._galleryTotal)) ui._galleryTotal = Math.max(0, ui._galleryTotal - 1);
        _reindexGalleryCards(ui);
        _renderGalleryCount(ui);

        if (ui.feedback) ui.feedback.show(`${noun[0].toUpperCase()}${noun.slice(1)} deleted.`, 'success');

        if (images.length === 0) {
            closeGalleryLightbox(ui);
            // Other pages may still have images; reload so the grid is not left empty.
            if (ui._galleryTotal > 0) handleGalleryLoad(ui);
            return;
        }

        // Deleting the last image in the set leaves the index past the end.
        ui._lightboxIndex = Math.min(idx, images.length - 1);
        _renderLightboxImage(ui);
    } catch (err) {
        console.error('[Civicomfy] deleteCurrentLightboxImage error:', err);
        if (ui.feedback) ui.feedback.show(`Delete failed: ${err.message}`, 'error');
    }
}

export function lightboxPrev(ui) {
    if (ui._lightboxIndex > 0) {
        ui._lightboxIndex--;
        _renderLightboxImage(ui);
    }
}

export function lightboxNext(ui) {
    const images = ui._galleryImages || [];
    if (ui._lightboxIndex < images.length - 1) {
        ui._lightboxIndex++;
        _renderLightboxImage(ui);
    }
}

// ---- Selection ----

export function toggleGallerySelect(ui, key) {
    if (ui._gallerySelected.has(key)) {
        ui._gallerySelected.delete(key);
    } else {
        ui._gallerySelected.add(key);
    }
    updateGallerySelectionBar(ui);
}

export function updateGallerySelectionBar(ui) {
    const bar = ui.gallerySelectBar;
    if (!bar) return;
    const count = ui._gallerySelected ? ui._gallerySelected.size : 0;
    if (count === 0) {
        bar.style.display = 'none';
    } else {
        bar.style.display = 'flex';
        if (ui.gallerySelectCount) {
            ui.gallerySelectCount.textContent = `${count} selected`;
        }
    }
}

// ---- Delete (single) ----

export async function deleteGalleryImage(ui, img, cardEl) {
    const noun = _mediaNoun(img);
    const name = img.subfolder ? `${img.subfolder}/${img.filename}` : img.filename;
    const ok = await ui.showConfirm({
        title: `Delete ${noun}?`,
        message: `"${name}" will be removed from the output folder. This cannot be undone.`,
        tone: 'warning',
        confirmLabel: 'Delete',
    });
    if (!ok) return;

    try {
        const result = await CivitaiDownloaderAPI.deleteOutputImages([
            { filename: img.filename, subfolder: img.subfolder ?? '' }
        ]);

        if (result && result.deleted > 0) {
            const key = `${img.filename}|||${img.subfolder ?? ''}`;
            if (ui._gallerySelected) {
                ui._gallerySelected.delete(key);
                updateGallerySelectionBar(ui);
            }

            const idx = (ui._galleryImages || []).findIndex(
                i => i.filename === img.filename && (i.subfolder ?? '') === (img.subfolder ?? '')
            );
            if (idx !== -1) ui._galleryImages.splice(idx, 1);
            if (Number.isFinite(ui._galleryTotal)) ui._galleryTotal = Math.max(0, ui._galleryTotal - 1);

            if (cardEl) {
                cardEl.style.transition = 'opacity 0.3s, transform 0.3s';
                cardEl.style.opacity = '0';
                cardEl.style.transform = 'scale(0.85)';
                setTimeout(() => {
                    cardEl.remove();
                    _reindexGalleryCards(ui);
                    _renderGalleryCount(ui);
                    // Emptying the page while images remain elsewhere: reload so
                    // the view falls back to a page that still has content.
                    if ((ui._galleryImages || []).length === 0 && ui._galleryTotal > 0) {
                        handleGalleryLoad(ui);
                    }
                }, 300);
            }

            if (ui.feedback) ui.feedback.show(`${noun[0].toUpperCase()}${noun.slice(1)} deleted.`, 'success');
        } else {
            const errMsg = result?.errors?.join(', ') || 'Unknown error';
            if (ui.feedback) ui.feedback.show(`Delete failed: ${errMsg}`, 'error');
        }
    } catch (err) {
        console.error('[Civicomfy] deleteGalleryImage error:', err);
        if (ui.feedback) ui.feedback.show(`Delete failed: ${err.message}`, 'error');
    }
}

// ---- Delete (batch) ----

export async function deleteSelectedGallery(ui) {
    const count = ui._gallerySelected ? ui._gallerySelected.size : 0;
    if (count === 0) return;

    const ok = await ui.showConfirm({
        title: `Delete ${count} item${count !== 1 ? 's' : ''}?`,
        message: `${count} selected item${count !== 1 ? 's' : ''} will be removed from the output folder. This cannot be undone.`,
        tone: 'warning',
        confirmLabel: `Delete ${count}`,
    });
    if (!ok) return;

    const images = _resolveSelectedImages(ui);
    if (images.length === 0) return;

    try {
        const result = await CivitaiDownloaderAPI.deleteOutputImages(images);
        const deleted = result?.deleted ?? 0;

        if (ui._gallerySelected) ui._gallerySelected.clear();
        updateGallerySelectionBar(ui);

        if (deleted > 0) {
            if (ui.feedback) ui.feedback.show(`Deleted ${deleted} item${deleted !== 1 ? 's' : ''}.`, 'success');
            await handleGalleryLoad(ui);
        }

        const errors = result?.errors ?? [];
        if (errors.length > 0) {
            console.warn('[Civicomfy] Batch delete errors:', errors);
            if (ui.feedback) ui.feedback.show(`${errors.length} file(s) could not be deleted.`, 'warning');
        }
    } catch (err) {
        console.error('[Civicomfy] deleteSelectedGallery error:', err);
        if (ui.feedback) ui.feedback.show(`Delete failed: ${err.message}`, 'error');
    }
}

// ---- Download (batch) ----

export function downloadSelectedGallery(ui) {
    const images = _resolveSelectedImages(ui);
    if (images.length === 0) return;

    images.forEach((img, i) => {
        setTimeout(() => {
            const params = new URLSearchParams({ filename: img.filename, type: 'output' });
            if (img.subfolder) params.set('subfolder', img.subfolder);
            _triggerDownload(`/view?${params.toString()}`, img.filename);
        }, i * 250);
    });

    if (ui.feedback) ui.feedback.show(`Downloading ${images.length} item${images.length !== 1 ? 's' : ''}…`, 'success');
}

// ---- Helpers for batch ops ----

function _resolveSelectedImages(ui) {
    const allImages = ui._galleryImages || [];
    const result = [];
    for (const key of (ui._gallerySelected || [])) {
        const sepIdx = key.indexOf('|||');
        const filename = key.substring(0, sepIdx);
        const subfolder = key.substring(sepIdx + 3);
        const match = allImages.find(
            i => i.filename === filename && (i.subfolder ?? '') === subfolder
        );
        if (match) {
            result.push({ filename: match.filename, subfolder: match.subfolder ?? '' });
        } else {
            result.push({ filename, subfolder });
        }
    }
    return result;
}
