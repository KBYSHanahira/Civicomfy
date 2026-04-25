import { CivitaiDownloaderAPI } from "../../api/civitai.js";

// ---- Helpers ----

function _imageViewUrl(filename, subfolder) {
    const params = new URLSearchParams({ filename, type: 'output' });
    if (subfolder) params.set('subfolder', subfolder);
    return `/view?${params.toString()}`;
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

// ---- Build card element ----

function _buildGalleryCard(img, idx, ui) {
    const key = _selKey(img);
    const url = _imageViewUrl(img.filename, img.subfolder);
    const isSelected = ui._gallerySelected.has(key);

    const card = document.createElement('div');
    card.className = 'civitai-gallery-card' + (isSelected ? ' selected' : '');
    card.dataset.index = idx;
    card.dataset.key = key;

    // ---- Preview area ----
    const preview = document.createElement('div');
    preview.className = 'civitai-gallery-card-preview';

    const imgEl = document.createElement('img');
    imgEl.loading = 'lazy';
    imgEl.src = url;
    imgEl.alt = img.filename;
    imgEl.onerror = () => {
        imgEl.style.display = 'none';
        preview.classList.add('no-preview');
        preview.innerHTML = '<i class="fas fa-image" style="font-size:2em;opacity:0.25;"></i>';
    };

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
    viewBtn.title = 'View full size';
    viewBtn.innerHTML = '<i class="fas fa-search-plus"></i>';

    const dlBtn = document.createElement('button');
    dlBtn.className = 'civitai-button small civitai-gallery-download-btn';
    dlBtn.title = 'Download image';
    dlBtn.innerHTML = '<i class="fas fa-download"></i>';

    const delBtn = document.createElement('button');
    delBtn.className = 'civitai-button small danger civitai-gallery-delete-single-btn';
    delBtn.title = 'Delete image';
    delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';

    overlay.appendChild(viewBtn);
    overlay.appendChild(dlBtn);
    overlay.appendChild(delBtn);

    preview.appendChild(imgEl);
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

    selectWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleGallerySelect(ui, key);
        _syncCardSelection(card, ui._gallerySelected.has(key));
    });

    viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openGalleryLightbox(ui, idx);
    });

    dlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _triggerDownload(url, img.filename);
    });

    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteGalleryImage(ui, img, card);
    });

    // Card click: if selection active → toggle; else open lightbox
    card.addEventListener('click', () => {
        if (ui._gallerySelected.size > 0) {
            toggleGallerySelect(ui, key);
            _syncCardSelection(card, ui._gallerySelected.has(key));
        } else {
            openGalleryLightbox(ui, idx);
        }
    });

    return card;
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

    grid.innerHTML = '<p style="padding:20px;color:var(--cfy-text-dim)"><i class="fas fa-spinner fa-spin"></i> Loading images…</p>';
    if (countEl) countEl.textContent = '';

    try {
        const subfolder = ui.gallerySubfolderSelect?.value ?? '';
        const sort = ui.gallerySortSelect?.value ?? 'time_desc';
        const limit = parseInt(ui.galleryLimitSelect?.value ?? '30', 10);
        const page = ui._galleryPage ?? 1;

        const data = await CivitaiDownloaderAPI.getOutputImages({ page, limit, subfolder, sort });

        if (!data || !Array.isArray(data.images)) {
            throw new Error("Invalid response from server.");
        }

        // Populate subfolder dropdown on first load
        if (ui.gallerySubfolderSelect && Array.isArray(data.subfolders)) {
            const current = ui.gallerySubfolderSelect.value;
            ui.gallerySubfolderSelect.innerHTML = '<option value="">All Subfolders</option>';
            data.subfolders.forEach(sf => {
                const opt = document.createElement('option');
                opt.value = sf;
                opt.textContent = sf;
                ui.gallerySubfolderSelect.appendChild(opt);
            });
            if (Array.from(ui.gallerySubfolderSelect.options).some(o => o.value === current)) {
                ui.gallerySubfolderSelect.value = current;
            }
        }

        // Store images for lightbox navigation
        ui._galleryImages = data.images;
        ui._galleryTotal = data.total;
        ui._galleryTotalPages = data.total_pages;

        renderGalleryGrid(ui, data.images);
        renderGalleryPagination(ui, data.page, data.total_pages, data.total, data.images.length);

        if (countEl) {
            countEl.textContent = data.total === 0
                ? 'No images found'
                : `${data.total} image${data.total !== 1 ? 's' : ''}`;
        }

    } catch (err) {
        console.error("[Civicomfy] Failed to load gallery:", err);
        grid.innerHTML = `<p style="padding:20px;color:var(--cfy-danger);">Failed to load images: ${err.message}</p>`;
    }
}

// ---- Grid renderer ----

export function renderGalleryGrid(ui, images) {
    const grid = ui.galleryGrid;
    if (!grid) return;

    const cardSize = parseInt(ui.galleryCardSizeSlider?.value ?? '148', 10);
    grid.style.setProperty('--cfy-gallery-card-w', `${cardSize}px`);

    if (!images || images.length === 0) {
        grid.innerHTML = '<p style="padding:20px;color:var(--cfy-text-dim);">No output images found.</p>';
        return;
    }

    grid.innerHTML = '';
    images.forEach((img, idx) => {
        grid.appendChild(_buildGalleryCard(img, idx, ui));
    });
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
}

function _renderLightboxImage(ui) {
    const images = ui._galleryImages;
    const idx = ui._lightboxIndex;
    if (!images || idx < 0 || idx >= images.length) return;

    const img = images[idx];
    const url = _imageViewUrl(img.filename, img.subfolder);

    const imgEl = ui.galleryLightboxImg;
    if (imgEl) { imgEl.src = url; imgEl.alt = img.filename; }

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
}

export function closeGalleryLightbox(ui) {
    const lb = ui.galleryLightbox;
    if (lb) lb.style.display = 'none';
    if (ui.galleryLightboxImg) ui.galleryLightboxImg.src = '';
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
    const name = img.subfolder ? `${img.subfolder}/${img.filename}` : img.filename;
    if (!confirm(`Delete "${name}"?\n\nThis cannot be undone.`)) return;

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

            if (cardEl) {
                cardEl.style.transition = 'opacity 0.3s, transform 0.3s';
                cardEl.style.opacity = '0';
                cardEl.style.transform = 'scale(0.85)';
                setTimeout(() => {
                    cardEl.remove();
                    const countEl = ui.galleryCountEl;
                    if (countEl && ui._galleryImages) {
                        const total = ui._galleryImages.length;
                        countEl.textContent = total === 0 ? 'No images found' : `${total} image${total !== 1 ? 's' : ''}`;
                    }
                }, 300);
            }

            if (ui.feedback) ui.feedback.show('Image deleted.', 'success');
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

    if (!confirm(`Delete ${count} selected image${count !== 1 ? 's' : ''}?\n\nThis cannot be undone.`)) return;

    const images = _resolveSelectedImages(ui);
    if (images.length === 0) return;

    try {
        const result = await CivitaiDownloaderAPI.deleteOutputImages(images);
        const deleted = result?.deleted ?? 0;

        if (ui._gallerySelected) ui._gallerySelected.clear();
        updateGallerySelectionBar(ui);

        if (deleted > 0) {
            if (ui.feedback) ui.feedback.show(`Deleted ${deleted} image${deleted !== 1 ? 's' : ''}.`, 'success');
            ui._galleryPage = 1;
            await handleGalleryLoad(ui);
        }

        const errors = result?.errors ?? [];
        if (errors.length > 0) {
            console.warn('[Civicomfy] Batch delete errors:', errors);
            if (ui.feedback) ui.feedback.show(`${errors.length} file(s) could not be deleted.`, 'warn');
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

    if (ui.feedback) ui.feedback.show(`Downloading ${images.length} image${images.length !== 1 ? 's' : ''}…`, 'success');
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
