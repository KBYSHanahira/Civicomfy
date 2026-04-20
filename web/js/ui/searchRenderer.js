// Rendering of search results list (Browse cards + Search list)
// Usage: renderSearchResults(uiInstance, itemsArray)
//        renderBrowseCards(uiInstance, itemsArray)
//        showBrowseCardInfo(uiInstance, modelId)

const PLACEHOLDER_IMAGE_URL = `/extensions/Civicomfy/images/placeholder.jpeg`;

// Module-level cache so info modal can access full hit data
const _browseHitData = new Map();

/**
 * Open a fullscreen lightbox to zoom an image or video.
 */
function _openLightbox(url, isVideo = false) {
    const existing = document.getElementById('civitai-lightbox');
    if (existing) existing.remove();

    const lb = document.createElement('div');
    lb.id = 'civitai-lightbox';
    lb.className = 'civitai-lightbox';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'civitai-lightbox-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); lb.remove(); });

    let media;
    if (isVideo) {
        media = document.createElement('video');
        media.src = url;
        media.autoplay = true;
        media.loop = true;
        media.muted = true;
        media.controls = true;
        media.setAttribute('playsinline', '');
    } else {
        media = document.createElement('img');
        media.src = url;
        media.alt = 'Full size image';
    }
    media.className = 'civitai-lightbox-media';
    media.addEventListener('click', (e) => e.stopPropagation());

    lb.appendChild(closeBtn);
    lb.appendChild(media);
    lb.addEventListener('click', () => lb.remove());

    // ESC key closes lightbox
    const onKey = (e) => { if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(lb);
}

// Return a consistent accent color for a model type
function _typeColor(modelType) {
    const t = (modelType || '').toLowerCase();
    const map = {
        'checkpoint': '#5c8aff',
        'lora': '#a855f7', 'locon': '#a855f7', 'lycoris': '#a855f7',
        'vae': '#22c55e',
        'textualinversion': '#f97316', 'embedding': '#f97316',
        'hypernetwork': '#ef4444',
        'controlnet': '#06b6d4',
        'upscaler': '#eab308', 'upscalers': '#eab308',
        'motionmodule': '#ec4899',
        'unet': '#8b5cf6',
        'diffusers': '#14b8a6', 'diffusion_models': '#14b8a6',
    };
    return map[t] || '#888';
}

/**
 * Render Browse tab results as a card grid (similar to My Models).
 */
export function renderBrowseCards(ui, items) {
    ui.feedback?.ensureFontAwesome();
    _browseHitData.clear();

    if (!items || items.length === 0) {
        ui.browseResultsContainer.className = 'civitai-browse-cards';
        ui.browseResultsContainer.innerHTML = '<p style="grid-column:1/-1;">No models found for this category.</p>';
        return;
    }

    const placeholder = PLACEHOLDER_IMAGE_URL;
    const onErrorScript = `this.onerror=null; this.src='${placeholder}'; this.style.backgroundColor='#444';`;
    const fragment = document.createDocumentFragment();

    items.forEach(hit => {
        const modelId = hit.id;
        if (!modelId) return;

        // Cache for info modal
        _browseHitData.set(String(modelId), hit);

        const modelName = hit.name || 'Untitled Model';
        const modelTypeApi = hit.type || 'other';
        const typeColor = _typeColor(modelTypeApi);
        const creator = hit.user?.username || 'Unknown';
        const stats = hit.metrics || {};

        const thumbnailUrl = hit.thumbnailUrl || placeholder;
        const firstImage = Array.isArray(hit.images) && hit.images.length > 0 ? hit.images[0] : null;
        const thumbnailType = firstImage?.type;
        const nsfwLevel = Number(firstImage?.nsfwLevel ?? hit.nsfwLevel ?? 0);
        const blurMinLevel = Number(ui.settings?.nsfwBlurMinLevel ?? 4);
        const shouldBlur = ui.settings?.hideMatureInSearch === true && nsfwLevel >= blurMinLevel;

        const allVersions = hit.versions || [];
        const primaryVersion = hit.version || (allVersions.length > 0 ? allVersions[0] : {});
        const primaryVersionId = primaryVersion.id;
        const primaryBaseModel = primaryVersion.baseModel || 'N/A';

        // Up to 3 version buttons in hover overlay
        const MAX_VISIBLE = 3;
        const visibleVersions = [];
        if (primaryVersionId) {
            visibleVersions.push({ id: primaryVersionId, name: primaryVersion.name || 'Primary', baseModel: primaryBaseModel });
        }
        allVersions.forEach(v => {
            if (v.id !== primaryVersionId && visibleVersions.length < MAX_VISIBLE) visibleVersions.push(v);
        });

        // ── Card ──────────────────────────────────
        const card = document.createElement('div');
        card.className = 'civitai-browse-card';
        card.dataset.modelId = modelId;

        // Preview area
        const preview = document.createElement('div');
        preview.className = 'civitai-browse-card-preview' + (shouldBlur ? ' blurred' : '');
        preview.dataset.nsfwLevel = nsfwLevel;

        let thumbEl;
        if (thumbnailUrl && thumbnailType === 'video') {
            thumbEl = document.createElement('video');
            thumbEl.src = thumbnailUrl;
            thumbEl.autoplay = true;
            thumbEl.loop = true;
            thumbEl.muted = true;
            thumbEl.setAttribute('playsinline', '');
        } else {
            thumbEl = document.createElement('img');
            thumbEl.src = thumbnailUrl || placeholder;
            thumbEl.alt = modelName;
            thumbEl.loading = 'lazy';
            thumbEl.setAttribute('onerror', onErrorScript);
        }
        preview.appendChild(thumbEl);

        if (shouldBlur) {
            const nsfw = document.createElement('div');
            nsfw.className = 'civitai-nsfw-overlay';
            nsfw.title = 'R-rated: click to reveal';
            nsfw.textContent = 'R';
            preview.appendChild(nsfw);
        }

        // Type badge — bottom-left, with type color
        const badge = document.createElement('div');
        badge.className = 'civitai-browse-card-badge';
        badge.textContent = modelTypeApi;
        badge.style.backgroundColor = typeColor;
        preview.appendChild(badge);

        // Base model badge — bottom-right (NoobAI / Illustrious / SDXL 1.0 …)
        if (primaryBaseModel && primaryBaseModel !== 'N/A') {
            const bmBadge = document.createElement('div');
            bmBadge.className = 'civitai-browse-card-bm-badge';
            bmBadge.textContent = primaryBaseModel;
            bmBadge.title = `Base model: ${primaryBaseModel}`;
            preview.appendChild(bmBadge);
        }

        // Hover overlay: version download buttons + view link
        const overlay = document.createElement('div');
        overlay.className = 'civitai-browse-card-overlay';

        visibleVersions.forEach(ver => {
            const btn = document.createElement('button');
            btn.className = 'civitai-button primary small civitai-search-download-button';
            btn.dataset.modelId = modelId;
            btn.dataset.versionId = ver.id || '';
            btn.dataset.modelType = modelTypeApi;
            btn.dataset.modelName = modelName;
            btn.dataset.versionName = ver.name || 'Unknown';
            btn.title = ver.id ? 'Pre-fill Download Tab' : 'Version ID missing';
            if (!ver.id) btn.disabled = true;
            btn.innerHTML = `<span class="base-model-badge">${ver.baseModel || 'N/A'}</span> ${ver.name || 'Unknown'} <i class="fas fa-download"></i>`;
            overlay.appendChild(btn);
        });

        if (allVersions.length > visibleVersions.length) {
            const moreBtn = document.createElement('button');
            moreBtn.className = 'civitai-button secondary small show-all-versions-button';
            moreBtn.dataset.modelId = modelId;
            moreBtn.dataset.totalVersions = allVersions.length;
            moreBtn.title = `Show all ${allVersions.length} versions`;
            moreBtn.innerHTML = `All (${allVersions.length}) <i class="fas fa-chevron-down"></i>`;
            overlay.appendChild(moreBtn);
        }

        const viewBtn = document.createElement('a');
        viewBtn.href = `https://civitai.com/models/${modelId}${primaryVersionId ? '?modelVersionId=' + primaryVersionId : ''}`;
        viewBtn.target = '_blank';
        viewBtn.rel = 'noopener noreferrer';
        viewBtn.className = 'civitai-button small';
        viewBtn.innerHTML = 'View on Civitai <i class="fas fa-external-link-alt"></i>';
        overlay.appendChild(viewBtn);

        preview.appendChild(overlay);

        // ── Card body ─────────────────────────────
        const body = document.createElement('div');
        body.className = 'civitai-browse-card-body';

        // Row 1: name + info button
        const nameRow = document.createElement('div');
        nameRow.className = 'civitai-browse-card-name-row';

        const nameEl = document.createElement('span');
        nameEl.className = 'civitai-browse-card-name';
        nameEl.textContent = modelName;
        nameEl.title = modelName;

        const infoBtn = document.createElement('button');
        infoBtn.className = 'civitai-browse-card-info-btn';
        infoBtn.dataset.modelId = modelId;
        infoBtn.title = 'Show model info & gallery';
        infoBtn.innerHTML = '<i class="fas fa-info-circle"></i><span>Info</span>';

        nameRow.appendChild(nameEl);
        nameRow.appendChild(infoBtn);

        // Row 2: meta (split into per-line spans)
        const metaEl = document.createElement('div');
        metaEl.className = 'civitai-browse-card-meta';
        if (creator) {
            const creatorLine = document.createElement('span');
            creatorLine.className = 'civitai-browse-card-meta-line';
            creatorLine.innerHTML = `<i class="fas fa-user"></i> ${creator}`;
            metaEl.appendChild(creatorLine);
        }
        if (stats.downloadCount) {
            const dlLine = document.createElement('span');
            dlLine.className = 'civitai-browse-card-meta-line';
            dlLine.innerHTML = `<i class="fas fa-download"></i> ${stats.downloadCount.toLocaleString()}`;
            metaEl.appendChild(dlLine);
        }

        body.appendChild(nameRow);
        body.appendChild(metaEl);

        card.appendChild(preview);
        card.appendChild(body);

        fragment.appendChild(card);
    });

    ui.browseResultsContainer.className = 'civitai-browse-cards';
    ui.browseResultsContainer.innerHTML = '';
    ui.browseResultsContainer.appendChild(fragment);
}

/**
 * Open the Browse Info modal for a given model ID.
 * Data must already be cached by renderBrowseCards.
 */
export function showBrowseCardInfo(ui, modelId) {
    const hit = _browseHitData.get(String(modelId));
    if (!hit) { ui.showToast('Model data not available.', 'error'); return; }
    _renderBrowseInfoModal(ui, hit);
}

function _renderBrowseInfoModal(ui, hit) {
    // Remove any existing info modal
    ui.modal.querySelector('#civitai-browse-info-modal')?.remove();

    const placeholder = PLACEHOLDER_IMAGE_URL;
    const blurMinLevel = Number(ui.settings?.nsfwBlurMinLevel ?? 4);
    const shouldBlurGlobal = ui.settings?.hideMatureInSearch === true;
    const onError = `this.onerror=null; this.src='${placeholder}'; this.style.backgroundColor='#444';`;

    const modelId = hit.id;
    const modelName = hit.name || 'Untitled Model';
    const modelTypeApi = hit.type || 'other';
    const typeColor = _typeColor(modelTypeApi);
    const creator = hit.user?.username || 'Unknown';
    const stats = hit.metrics || {};
    const tags = (hit.tags || []).map(t => t.name);
    const allVersions = hit.versions || [];
    const primaryVersion = hit.version || (allVersions.length > 0 ? allVersions[0] : {});
    const primaryVersionId = primaryVersion.id;

    const publishedAt = hit.publishedAt;
    let publishedFormatted = '';
    if (publishedAt) {
        try { publishedFormatted = new Date(publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (_) {}
    }

    const uniqueBaseModels = allVersions.length > 0
        ? [...new Set(allVersions.map(v => v.baseModel).filter(Boolean))]
        : (primaryVersion.baseModel ? [primaryVersion.baseModel] : []);

    // Gallery images — images[].url are now full CDN URLs (processed by server)
    // Fall back to thumbnailUrl if images array is empty
    let images = (hit.images || []).filter(img => {
        if (!shouldBlurGlobal) return true;
        return Number(img.nsfwLevel ?? 0) < blurMinLevel;
    }).filter(img => img.url).slice(0, 10);
    if (images.length === 0 && hit.thumbnailUrl) images = [{ url: hit.thumbnailUrl, type: 'image' }];

    // ── Overlay ───────────────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'civitai-browse-info-modal';
    overlay.className = 'civitai-browse-info-overlay';

    const panel = document.createElement('div');
    panel.className = 'civitai-browse-info-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'civitai-browse-info-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'civitai-browse-info-title-wrap';

    const hTypeChip = document.createElement('span');
    hTypeChip.className = 'civitai-browse-info-type-chip';
    hTypeChip.textContent = modelTypeApi;
    hTypeChip.style.color = typeColor;
    hTypeChip.style.borderColor = typeColor + '88';
    hTypeChip.style.backgroundColor = typeColor + '22';

    const titleEl = document.createElement('h3');
    titleEl.className = 'civitai-browse-info-title';
    titleEl.textContent = modelName;

    titleWrap.appendChild(hTypeChip);
    titleWrap.appendChild(titleEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'civitai-close-button';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => overlay.remove());

    header.appendChild(titleWrap);
    header.appendChild(closeBtn);

    // Body: gallery (left) + details (right)
    const body = document.createElement('div');
    body.className = 'civitai-browse-info-body';

    // ── Gallery ───────────────────────────────────
    const galleryWrap = document.createElement('div');
    galleryWrap.className = 'civitai-browse-info-gallery';

    const mainImgWrap = document.createElement('div');
    mainImgWrap.className = 'civitai-browse-info-main-image civitai-zoomable';
    mainImgWrap.title = 'Click to zoom';

    let _currentImg = images.length > 0 ? images[0] : null;

    function _setMainMedia(img) {
        _currentImg = img;
        mainImgWrap.innerHTML = '';
        let el;
        if (img.type === 'video') {
            el = document.createElement('video');
            el.src = img.url;
            el.autoplay = true; el.loop = true; el.muted = true;
            el.setAttribute('playsinline', '');
        } else {
            el = document.createElement('img');
            el.src = img.url || placeholder;
            el.alt = modelName;
            el.setAttribute('onerror', onError);
        }
        mainImgWrap.appendChild(el);
    }

    mainImgWrap.addEventListener('click', () => {
        if (_currentImg?.url) _openLightbox(_currentImg.url, _currentImg.type === 'video');
    });

    if (images.length > 0) {
        _setMainMedia(images[0]);
    } else {
        mainImgWrap.innerHTML = '<i class="fas fa-image" style="font-size:3em;opacity:0.2;"></i>';
    }
    galleryWrap.appendChild(mainImgWrap);

    if (images.length > 1) {
        const strip = document.createElement('div');
        strip.className = 'civitai-browse-info-thumb-strip';
        images.forEach((img, idx) => {
            const thumb = document.createElement('div');
            thumb.className = 'civitai-browse-info-thumb' + (idx === 0 ? ' active' : '');
            const tImg = document.createElement('img');
            tImg.src = img.url || placeholder;
            tImg.alt = `Image ${idx + 1}`;
            tImg.loading = 'lazy';
            tImg.setAttribute('onerror', onError);
            thumb.appendChild(tImg);
            thumb.addEventListener('click', () => {
                strip.querySelectorAll('.civitai-browse-info-thumb').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
                _setMainMedia(img);
            });
            strip.appendChild(thumb);
        });
        galleryWrap.appendChild(strip);
    }
    body.appendChild(galleryWrap);

    // ── Details panel ─────────────────────────────
    const detailsWrap = document.createElement('div');
    detailsWrap.className = 'civitai-browse-info-details';

    // Creator + date
    const creatorRow = document.createElement('div');
    creatorRow.className = 'civitai-browse-info-creator';
    creatorRow.innerHTML = `
        <span><i class="fas fa-user" style="margin-right:5px;opacity:.6;"></i>${creator}</span>
        ${publishedFormatted ? `<span><i class="fas fa-calendar-alt" style="margin-right:5px;opacity:.6;"></i>${publishedFormatted}</span>` : ''}
    `;
    detailsWrap.appendChild(creatorRow);

    // Stats
    const statsRow = document.createElement('div');
    statsRow.className = 'civitai-browse-info-stats';
    statsRow.innerHTML = `
        <span title="Downloads"><i class="fas fa-download"></i> ${stats.downloadCount?.toLocaleString() || 0}</span>
        <span title="Thumbs Up"><i class="fas fa-thumbs-up"></i> ${stats.thumbsUpCount?.toLocaleString() || 0}</span>
        <span title="Collected"><i class="fas fa-archive"></i> ${stats.collectedCount?.toLocaleString() || 0}</span>
        <span title="Buzz"><i class="fas fa-bolt"></i> ${stats.tippedAmountCount?.toLocaleString() || 0}</span>
    `;
    detailsWrap.appendChild(statsRow);

    // Base models
    if (uniqueBaseModels.length > 0) {
        const sec = _infoSection('Base Models');
        const bmWrap = document.createElement('div');
        bmWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;';
        uniqueBaseModels.forEach(bm => {
            const chip = document.createElement('span');
            chip.className = 'base-model-badge';
            chip.textContent = bm;
            bmWrap.appendChild(chip);
        });
        sec.appendChild(bmWrap);
        detailsWrap.appendChild(sec);
    }

    // Tags
    if (tags.length > 0) {
        const sec = _infoSection('Tags');
        const tagsWrap = document.createElement('div');
        tagsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;';
        tags.slice(0, 15).forEach(tag => {
            const el = document.createElement('span');
            el.className = 'civitai-search-tag';
            el.textContent = tag;
            tagsWrap.appendChild(el);
        });
        sec.appendChild(tagsWrap);
        detailsWrap.appendChild(sec);
    }

    // Description
    const rawDesc = hit.description || '';
    if (rawDesc) {
        const sec = _infoSection('Description');
        const descEl = document.createElement('div');
        descEl.className = 'civitai-browse-info-description';
        const tmp = document.createElement('div');
        tmp.innerHTML = rawDesc;
        descEl.textContent = tmp.textContent || tmp.innerText || '';
        sec.appendChild(descEl);
        detailsWrap.appendChild(sec);
    }

    // Trigger Words — collect from all versions (deduplicated)
    const allTrainedWords = [...new Set(
        allVersions.flatMap(v => v.trainedWords || []).concat(
            (hit.version?.trainedWords || [])
        ).filter(Boolean)
    )];
    if (allTrainedWords.length > 0) {
        const sec = _infoSection('Trigger Words');
        const twWrap = document.createElement('div');
        twWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;';
        allTrainedWords.forEach(w => {
            const chip = document.createElement('span');
            chip.className = 'civitai-browse-info-trigger-word';
            chip.textContent = w;
            chip.title = 'Click to copy';
            chip.addEventListener('click', () => {
                navigator.clipboard?.writeText(w).catch(() => {});
                ui.showToast(`Copied: ${w}`, 'success', 1500);
            });
            twWrap.appendChild(chip);
        });
        sec.appendChild(twWrap);
        detailsWrap.appendChild(sec);
    }

    // Example Prompts — from images[].meta.prompt (unique, non-empty, max 3)
    const examplePrompts = [...new Set(
        (hit.images || [])
            .map(img => img?.meta?.prompt)
            .filter(p => typeof p === 'string' && p.trim().length > 0)
    )].slice(0, 3);
    if (examplePrompts.length > 0) {
        const sec = _infoSection('Example Prompts');
        const epWrap = document.createElement('div');
        epWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:5px;';
        examplePrompts.forEach((prompt, i) => {
            const row = document.createElement('div');
            row.className = 'civitai-browse-info-example-prompt';
            const num = document.createElement('span');
            num.className = 'civitai-browse-info-example-num';
            num.textContent = `${i + 1}.`;
            const text = document.createElement('span');
            text.className = 'civitai-browse-info-example-text';
            text.textContent = prompt;
            const copyBtn = document.createElement('button');
            copyBtn.className = 'civitai-button small civitai-browse-info-example-copy';
            copyBtn.title = 'Copy prompt';
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard?.writeText(prompt).catch(() => {});
                ui.showToast('Prompt copied!', 'success', 1500);
            });
            row.appendChild(num);
            row.appendChild(text);
            row.appendChild(copyBtn);
            epWrap.appendChild(row);
        });
        sec.appendChild(epWrap);
        detailsWrap.appendChild(sec);
    }

    // Versions + download buttons
    if (allVersions.length > 0) {
        const sec = _infoSection(`Versions (${allVersions.length})`);
        const versList = document.createElement('div');
        versList.style.cssText = 'display:flex;flex-direction:column;gap:5px;margin-top:6px;';

        allVersions.slice(0, 8).forEach(ver => {
            const vBtn = document.createElement('button');
            vBtn.className = 'civitai-button primary small civitai-search-download-button';
            vBtn.dataset.modelId = modelId;
            vBtn.dataset.versionId = ver.id || '';
            vBtn.dataset.modelType = modelTypeApi;
            vBtn.dataset.modelName = modelName;
            vBtn.dataset.versionName = ver.name || 'Unknown';
            vBtn.style.textAlign = 'left';
            if (!ver.id) vBtn.disabled = true;
            vBtn.innerHTML = `<span class="base-model-badge">${ver.baseModel || 'N/A'}</span> ${ver.name || 'Unknown'} <i class="fas fa-download"></i>`;
            versList.appendChild(vBtn);
        });

        // Handle clicks on version download buttons inside this modal
        versList.addEventListener('click', e => {
            const btn = e.target.closest('.civitai-search-download-button');
            if (!btn) return;
            e.preventDefault();
            const { modelId: mid, versionId, modelType, modelName: mname, versionName } = btn.dataset;
            if (!mid || !versionId) { ui.showToast('Missing version data.', 'error'); return; }
            const typeKey = ui.inferFolderFromCivitaiType(modelType) || ui.settings.defaultModelType;
            ui.modelUrlInput.value = mid;
            ui.modelVersionIdInput.value = versionId;
            ui.customFilenameInput.value = '';
            ui.forceRedownloadCheckbox.checked = false;
            ui.downloadModelTypeSelect.value = typeKey;
            if (ui.browseSelectedBar && ui.browseSelectedText) {
                ui.browseSelectedText.textContent = `${mname || `Model #${mid}`}  —  ${versionName || `Version #${versionId}`}`;
                ui.browseSelectedBar.style.display = 'flex';
            }
            overlay.remove();
            ui.switchTab('download');
            ui.showToast(`Filled download form for Model ID ${mid}.`, 'info', 4000);
            ui.fetchAndDisplayDownloadPreview();
        });

        sec.appendChild(versList);
        detailsWrap.appendChild(sec);
    }

    // External link
    const extLink = document.createElement('a');
    extLink.href = `https://civitai.com/models/${modelId}${primaryVersionId ? '?modelVersionId=' + primaryVersionId : ''}`;
    extLink.target = '_blank';
    extLink.rel = 'noopener noreferrer';
    extLink.className = 'civitai-button small';
    extLink.style.cssText = 'display:inline-block;margin-top:12px;text-decoration:none;';
    extLink.innerHTML = 'View on Civitai <i class="fas fa-external-link-alt"></i>';
    detailsWrap.appendChild(extLink);

    body.appendChild(detailsWrap);

    panel.appendChild(header);
    panel.appendChild(body);
    overlay.appendChild(panel);

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    ui.modal.appendChild(overlay);
}

function _infoSection(label) {
    const sec = document.createElement('div');
    sec.className = 'civitai-browse-info-section';
    const lbl = document.createElement('div');
    lbl.className = 'civitai-browse-info-section-label';
    lbl.textContent = label;
    sec.appendChild(lbl);
    return sec;
}

export function renderSearchResults(ui, items) {
  ui.feedback?.ensureFontAwesome();

  if (!items || items.length === 0) {
    const queryUsed = ui.searchQueryInput && ui.searchQueryInput.value.trim();
    const typeFilterUsed = ui.searchTypeSelect && ui.searchTypeSelect.value !== 'any';
    const baseModelFilterUsed = ui.searchBaseModelSelect && ui.searchBaseModelSelect.value !== 'any';
    const message = (queryUsed || typeFilterUsed || baseModelFilterUsed)
      ? 'No models found matching your criteria.'
      : 'Enter a query or select filters and click Search.';
    ui.searchResultsContainer.innerHTML = `<p>${message}</p>`;
    return;
  }

  const placeholder = PLACEHOLDER_IMAGE_URL;
  const onErrorScript = `this.onerror=null; this.src='${placeholder}'; this.style.backgroundColor='#444';`;
  const fragment = document.createDocumentFragment();

  items.forEach(hit => {
    const modelId = hit.id;
    if (!modelId) return;

    const creator = hit.user?.username || 'Unknown Creator';
    const modelName = hit.name || 'Untitled Model';
    const modelTypeApi = hit.type || 'other';
    console.log('Model type for badge:', modelTypeApi);
    const stats = hit.metrics || {};
    const tags = hit.tags?.map(t => t.name) || [];

    const thumbnailUrl = hit.thumbnailUrl || placeholder;
    const firstImage = Array.isArray(hit.images) && hit.images.length > 0 ? hit.images[0] : null;
    const thumbnailType = firstImage?.type;
    const nsfwLevel = Number(firstImage?.nsfwLevel ?? hit.nsfwLevel ?? 0);
    const blurMinLevel = Number(ui.settings?.nsfwBlurMinLevel ?? 4);
    const shouldBlur = ui.settings?.hideMatureInSearch === true && nsfwLevel >= blurMinLevel;

    const allVersions = hit.versions || [];
    const primaryVersion = hit.version || (allVersions.length > 0 ? allVersions[0] : {});
    const primaryVersionId = primaryVersion.id;
    const primaryBaseModel = primaryVersion.baseModel || 'N/A';

    const uniqueBaseModels = allVersions.length > 0
      ? [...new Set(allVersions.map(v => v.baseModel).filter(Boolean))]
      : (primaryBaseModel !== 'N/A' ? [primaryBaseModel] : []);
    const baseModelsDisplay = uniqueBaseModels.length > 0 ? uniqueBaseModels.join(', ') : 'N/A';

    const publishedAt = hit.publishedAt;
    let lastUpdatedFormatted = 'N/A';
    if (publishedAt) {
      try {
        const date = new Date(publishedAt);
        lastUpdatedFormatted = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      } catch (_) {}
    }

    const listItem = document.createElement('div');
    listItem.className = 'civitai-search-item';
    listItem.dataset.modelId = modelId;

    const MAX_VISIBLE_VERSIONS = 3;
    let visibleVersions = [];
    if (primaryVersionId) {
      visibleVersions.push({ id: primaryVersionId, name: primaryVersion.name || 'Primary Version', baseModel: primaryBaseModel });
    }
    allVersions.forEach(v => {
      if (v.id !== primaryVersionId && visibleVersions.length < MAX_VISIBLE_VERSIONS) visibleVersions.push(v);
    });

    let versionButtonsHtml = visibleVersions.map(version => {
      const versionId = version.id;
      const versionName = version.name || 'Unknown Version';
      const baseModel = version.baseModel || 'N/A';
      return `
        <button class="civitai-button primary small civitai-search-download-button"
                data-model-id="${modelId}"
                data-version-id="${versionId || ''}"
                data-model-type="${modelTypeApi || ''}"
                ${!versionId ? 'disabled title="Version ID missing, cannot pre-fill"' : 'title="Pre-fill Download Tab"'} >
          <span class="base-model-badge">${baseModel}</span> ${versionName} <i class="fas fa-download"></i>
        </button>
      `;
    }).join('');

    const hasMoreVersions = allVersions.length > visibleVersions.length;
    const totalVersionCount = allVersions.length;
    const moreButtonHtml = hasMoreVersions ? `
      <button class="civitai-button secondary small show-all-versions-button"
              data-model-id="${modelId}"
              data-total-versions="${totalVersionCount}"
              title="Show all ${totalVersionCount} versions">
        All versions (${totalVersionCount}) <i class="fas fa-chevron-down"></i>
      </button>
    ` : '';

    let allVersionsHtml = '';
    if (hasMoreVersions) {
      const hiddenVersions = allVersions.filter(v => !visibleVersions.some(vis => vis.id === v.id));
      allVersionsHtml = `
        <div class="all-versions-container" id="all-versions-${modelId}" style="display: none;">
          ${hiddenVersions.map(version => {
            const versionId = version.id;
            const versionName = version.name || 'Unknown Version';
            const baseModel = version.baseModel || 'N/A';
            return `
              <button class="civitai-button primary small civitai-search-download-button"
                      data-model-id="${modelId}"
                      data-version-id="${versionId || ''}"
                      data-model-type="${modelTypeApi || ''}"
                      ${!versionId ? 'disabled title="Version ID missing, cannot pre-fill"' : 'title="Pre-fill Download Tab"'} >
                <span class="base-model-badge">${baseModel}</span> ${versionName} <i class="fas fa-download"></i>
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    let thumbnailHtml = '';
    const videoTitle = `Video preview for ${modelName}`;
    const imageAlt = `${modelName} thumbnail`;
    if (thumbnailUrl && typeof thumbnailUrl === 'string' && thumbnailType === 'video') {
      thumbnailHtml = `
        <video class="civitai-search-thumbnail" src="${thumbnailUrl}" autoplay loop muted playsinline
               title="${videoTitle}"
               onerror="console.error('Failed to load video preview:', this.src)">
          Your browser does not support the video tag.
        </video>
      `;
    } else {
      const effective = thumbnailUrl || placeholder;
      thumbnailHtml = `
        <img src="${effective}" alt="${imageAlt}" class="civitai-search-thumbnail" loading="lazy" onerror="${onErrorScript}">
      `;
    }

    const overlayHtml = shouldBlur ? `<div class="civitai-nsfw-overlay" title="R-rated: click to reveal">R</div>` : '';
    const containerClasses = `civitai-thumbnail-container${shouldBlur ? ' blurred' : ''}`;

    listItem.innerHTML = `
      <div class="${containerClasses}" data-nsfw-level="${nsfwLevel ?? ''}">
        ${thumbnailHtml}
        ${overlayHtml}
        <div class="civitai-type-badge" data-type="${modelTypeApi.toLowerCase()}">${modelTypeApi}</div>
      </div>
      <div class="civitai-search-info">
        <h4>${modelName}</h4>
        <div class="civitai-search-meta-info">
          <span title="Creator: ${creator}"><i class="fas fa-user"></i> ${creator}</span>
          <span title="Base Models: ${baseModelsDisplay}"><i class="fas fa-layer-group"></i> ${baseModelsDisplay}</span>
          <span title="Published: ${lastUpdatedFormatted}"><i class="fas fa-calendar-alt"></i> ${lastUpdatedFormatted}</span>
        </div>
        <div class="civitai-search-stats" title="Stats: Downloads / Rating (Count) / Likes">
          <span title="Downloads"><i class="fas fa-download"></i> ${stats.downloadCount?.toLocaleString() || 0}</span>
          <span title="Thumbs"><i class="fas fa-thumbs-up"></i> ${stats.thumbsUpCount?.toLocaleString() || 0}</span>
          <span title="Collected"><i class="fas fa-archive"></i> ${stats.collectedCount?.toLocaleString() || 0}</span>
          <span title="Buzz"><i class="fas fa-bolt"></i> ${stats.tippedAmountCount?.toLocaleString() || 0}</span>
        </div>
        ${tags.length > 0 ? `
        <div class="civitai-search-tags" title="${tags.join(', ')}">
          ${tags.slice(0, 5).map(tag => `<span class="civitai-search-tag">${tag}</span>`).join('')}
          ${tags.length > 5 ? `<span class="civitai-search-tag">...</span>` : ''}
        </div>
        ` : ''}
      </div>
      <div class="civitai-search-actions">
        <a href="https://civitai.com/models/${modelId}${primaryVersionId ? '?modelVersionId='+primaryVersionId : ''}" 
           target="_blank" rel="noopener noreferrer" class="civitai-button small" 
           title="Open on Civitai website">
          View <i class="fas fa-external-link-alt"></i>
        </a>
        <div class="version-buttons-container">
          ${versionButtonsHtml}
          ${moreButtonHtml}
        </div>
        ${allVersionsHtml}
      </div>
    `;

    fragment.appendChild(listItem);
  });

  ui.searchResultsContainer.innerHTML = '';
  ui.searchResultsContainer.appendChild(fragment);
}
