// Rendering of the Browse tab: model card grid + the per-model info modal.
// Usage: renderBrowseCards(uiInstance, itemsArray)
//        showBrowseCardInfo(uiInstance, modelId)

import { attachLightboxZoom } from "../utils/dom.js";
import { buildCivitaiModelUrl } from "./handlers/settingsHandler.js";
import { typeColor } from "./typeColors.js";
import { CivitaiDownloaderAPI } from "../api/civitai.js";

const PLACEHOLDER_IMAGE_URL = `/extensions/Civicomfy/images/placeholder.jpeg`;

// Escape a value for safe interpolation into HTML text or a double-quoted
// attribute. Civitai image-meta values (sampler, prompts, etc.) are untrusted.
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Module-level cache so info modal can access full hit data
const _browseHitData = new Map();

// Meilisearch documents carry no file information at all, so download sizes
// are resolved from the REST API after the results are already on screen and
// filled in place. Sizes of published versions never change, so both maps are
// kept for the lifetime of the session.
const _versionSizes = new Map();      // versionId (string) -> { sizeKB, name }
const _sizeLookedUpModels = new Set(); // model ids already asked about

/**
 * Open a fullscreen lightbox to zoom an image or video.
 */
function _openLightbox(url, isVideo = false) {
    const existing = document.getElementById('civitai-lightbox');
    if (existing) existing.remove();

    const lb = document.createElement('div');
    lb.id = 'civitai-lightbox';
    lb.className = 'civitai-lightbox';

    // Centralized teardown so every close path (Esc, backdrop, ×) removes the
    // document-level listeners and the zoom handlers — avoids listener leaks.
    let zoomHandle = null;
    const close = () => {
        document.removeEventListener('keydown', onKey);
        if (zoomHandle && typeof zoomHandle.cleanup === 'function') {
            try { zoomHandle.cleanup(); } catch (_) {}
        }
        lb.remove();
    };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'civitai-lightbox-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });

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
    lb.addEventListener('click', () => close());

    // ESC key closes lightbox
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(lb);

    // Wheel zoom (images only)
    if (!isVideo) {
        zoomHandle = attachLightboxZoom(media, lb);
    }
}

// Return a consistent accent color for a model type (shared with My Models)
function _typeColor(modelType) {
    return typeColor(modelType);
}

// ─── Download size (lazy) ─────────────────────────────────────
// Placeholder stays hidden until a size is known, so results that Civitai
// won't resolve simply show nothing instead of an empty slot.
function _createSizePlaceholder(versionId) {
    const el = document.createElement('span');
    el.className = 'civitai-model-size';
    el.dataset.sizeVersionId = String(versionId);
    el.hidden = true;
    el.innerHTML = '<i class="fas fa-hdd"></i> <span class="civitai-model-size-value"></span>';
    return el;
}

function _fillSizePlaceholder(el) {
    const entry = _versionSizes.get(String(el.dataset.sizeVersionId || ''));
    if (!entry) return;
    const text = _fmtBytes(Number(entry.sizeKB) * 1024);
    if (!text) return;
    const valueEl = el.querySelector('.civitai-model-size-value');
    if (valueEl) valueEl.textContent = text;
    el.title = entry.name ? `${entry.name} — ${text}` : `Download size: ${text}`;
    el.hidden = false;
}

/**
 * Fill every size placeholder inside `container`, fetching the ones that
 * aren't cached yet. Fire-and-forget: results render without waiting on it.
 */
async function _hydrateModelSizes(ui, items, container) {
    if (!container) return;
    const fillAll = () => container.querySelectorAll('.civitai-model-size[hidden]').forEach(_fillSizePlaceholder);
    fillAll();

    const modelIds = [];
    (items || []).forEach(hit => {
        const id = hit?.id;
        if (id == null) return;
        const key = String(id);
        if (_sizeLookedUpModels.has(key) || modelIds.includes(key)) return;
        modelIds.push(key);
    });
    if (modelIds.length === 0) return;

    let data;
    try {
        data = await CivitaiDownloaderAPI.getModelFileSizes(modelIds, ui.settings?.apiKey || '');
    } catch (error) {
        // Sizes are supplementary — a failed lookup must not disturb browsing.
        console.warn('[Civicomfy] Model size lookup failed:', error);
        return;
    }

    modelIds.forEach(id => _sizeLookedUpModels.add(id));
    Object.entries(data?.versions || {}).forEach(([versionId, entry]) => {
        if (entry && entry.sizeKB != null) _versionSizes.set(String(versionId), entry);
    });
    // Placeholders are keyed by version id, so a late response can only ever
    // fill in matching cards — no need to guard against a newer render.
    fillAll();
}

/**
 * Render Browse tab results as a card grid (similar to My Models).
 */
export function renderBrowseCards(ui, items) {
    ui.feedback?.ensureFontAwesome();
    _browseHitData.clear();

    if (!items || items.length === 0) {
        ui.browseResultsContainer.className = 'civitai-browse-cards';
        ui.browseResultsContainer.innerHTML = '<p class="civitai-empty-state"><i class="fas fa-compass"></i> No models match these filters.</p>';
        return;
    }

    const placeholder = PLACEHOLDER_IMAGE_URL;
    const onErrorScript = `this.onerror=null; this.src='${placeholder}'; this.style.backgroundColor='transparent';`;
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

        // "Installed" overlay — shown when this model exists locally
        const installedIds = ui._installedModelIds;
        if (installedIds && installedIds.has(String(modelId))) {
            const installedOverlay = document.createElement('div');
            installedOverlay.className = 'civitai-browse-card-installed-overlay';
            const installedBadge = document.createElement('div');
            installedBadge.className = 'civitai-browse-card-installed-badge';
            installedBadge.innerHTML = '<i class="fas fa-check-circle"></i> Installed';
            installedOverlay.appendChild(installedBadge);
            preview.appendChild(installedOverlay);
        }

        // Touch affordance: with no hover, the overlay is opened by tapping the
        // artwork, and this chip is the only thing that says so. CSS hides it
        // wherever hover exists.
        const tapHint = document.createElement('span');
        tapHint.className = 'civitai-browse-card-tap-hint';
        tapHint.setAttribute('aria-hidden', 'true');
        tapHint.innerHTML = '<i class="fas fa-ellipsis-h"></i>';
        preview.appendChild(tapHint);

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
            btn.title = ver.id ? `Pre-fill Download tab — ${ver.name || 'Unknown'}` : 'Version ID missing';
            if (!ver.id) btn.disabled = true;
            btn.innerHTML = `<span class="base-model-badge">${esc(ver.baseModel || 'N/A')}</span>`
                + `<span class="cfy-vbtn-name">${esc(ver.name || 'Unknown')}</span>`
                + `<i class="fas fa-download"></i>`;
            overlay.appendChild(btn);
        });

        if (allVersions.length > visibleVersions.length) {
            const moreBtn = document.createElement('button');
            moreBtn.className = 'civitai-button secondary small show-all-versions-button';
            moreBtn.dataset.modelId = modelId;
            moreBtn.title = `Show all ${allVersions.length} versions`;
            // Opens the info modal rather than expanding in place, so the icon
            // should not promise a dropdown.
            moreBtn.innerHTML = `<span class="cfy-vbtn-name">All (${allVersions.length})</span><i class="fas fa-layer-group"></i>`;
            overlay.appendChild(moreBtn);
        }

        const viewBtn = document.createElement('a');
        viewBtn.href = buildCivitaiModelUrl(modelId, primaryVersionId);
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
        // Download count and file size share one line so adding the size
        // doesn't make every card taller.
        const statsLine = document.createElement('span');
        statsLine.className = 'civitai-browse-card-meta-line';
        if (stats.downloadCount) {
            const dlStat = document.createElement('span');
            dlStat.className = 'civitai-browse-card-stat';
            dlStat.innerHTML = `<i class="fas fa-download"></i> ${stats.downloadCount.toLocaleString()}`;
            statsLine.appendChild(dlStat);
        }
        if (primaryVersionId) {
            const sizeStat = _createSizePlaceholder(primaryVersionId);
            sizeStat.classList.add('civitai-browse-card-stat');
            statsLine.appendChild(sizeStat);
        }
        if (statsLine.childElementCount > 0) metaEl.appendChild(statsLine);

        body.appendChild(nameRow);
        body.appendChild(metaEl);

        card.appendChild(preview);
        card.appendChild(body);

        fragment.appendChild(card);
    });

    ui.browseResultsContainer.className = 'civitai-browse-cards';
    ui.browseResultsContainer.innerHTML = '';
    ui.browseResultsContainer.appendChild(fragment);

    _hydrateModelSizes(ui, items, ui.browseResultsContainer);
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

// ─── Helper: format large numbers ────────────────────────────
function _fmtNum(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
}

function _fmtBytes(bytes) {
    if (!bytes) return '';
    if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' GB';
    if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
}

function _ratingStars(rating) {
    const full = Math.floor(rating);
    const half = (rating - full) >= 0.5;
    let s = '';
    for (let i = 0; i < 5; i++) {
        if (i < full) s += '<i class="fas fa-star"></i>';
        else if (i === full && half) s += '<i class="fas fa-star-half-alt"></i>';
        else s += '<i class="far fa-star"></i>';
    }
    return `<span class="civitai-browse-info-stars">${s}</span>`;
}

function _fmtDate(d) {
    try { return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (_) { return ''; }
}

// ─── Info section factory ─────────────────────────────────────
function _infoSection(label, iconClass = null) {
    const sec = document.createElement('div');
    sec.className = 'civitai-browse-info-section';
    const lbl = document.createElement('div');
    lbl.className = 'civitai-browse-info-section-label';
    lbl.innerHTML = iconClass ? `<i class="${iconClass}"></i> ${label}` : label;
    sec.appendChild(lbl);
    return sec;
}

// ─── Main info modal ──────────────────────────────────────────
function _renderBrowseInfoModal(ui, hit) {
    ui.modal.querySelector('#civitai-browse-info-modal')?.remove();

    const placeholder = PLACEHOLDER_IMAGE_URL;
    const blurMinLevel = Number(ui.settings?.nsfwBlurMinLevel ?? 4);
    const shouldBlurGlobal = ui.settings?.hideMatureInSearch === true;
    const onError = `this.onerror=null;this.src='${placeholder}';this.style.backgroundColor='transparent';`;

    // ── Data ──────────────────────────────────────
    const modelId       = hit.id;
    const modelName     = hit.name || 'Untitled Model';
    const modelTypeApi  = hit.type || 'other';
    const typeColor     = _typeColor(modelTypeApi);
    const creator       = hit.user?.username || 'Unknown';
    const creatorAvatar = hit.user?.image || null;
    const stats         = hit.metrics || {};
    const tags          = (hit.tags || []).map(t => t.name);
    const allVersions   = hit.versions || [];
    const primaryVersion   = hit.version || (allVersions[0] || {});
    const primaryVersionId = primaryVersion.id;

    const publishedAt = hit.publishedAt ? _fmtDate(hit.publishedAt) : '';
    const updatedAt   = hit.updatedAt   ? _fmtDate(hit.updatedAt)   : '';

    const uniqueBaseModels = [...new Set(
        allVersions.map(v => v.baseModel).filter(Boolean)
            .concat(primaryVersion.baseModel ? [primaryVersion.baseModel] : [])
    )];

    let images = (hit.images || [])
        .filter(img => shouldBlurGlobal ? Number(img.nsfwLevel ?? 0) < blurMinLevel : true)
        .filter(img => img.url)
        .slice(0, 12);
    if (images.length === 0 && hit.thumbnailUrl) images = [{ url: hit.thumbnailUrl, type: 'image' }];

    const allTrainedWords = [...new Set(
        allVersions.flatMap(v => v.trainedWords || [])
            .concat(hit.version?.trainedWords || [])
            .filter(Boolean)
    )];

    const exampleImages = (hit.images || [])
        .filter(img => typeof img?.meta?.prompt === 'string' && img.meta.prompt.trim())
        .slice(0, 4);

    const rating      = Number(stats.rating ?? stats.ratingAllTime ?? 0);
    const ratingCount = Number(stats.ratingCount ?? stats.ratingCountAllTime ?? 0);

    // ── DOM skeleton ──────────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'civitai-browse-info-modal';
    overlay.className = 'civitai-browse-info-overlay';

    const panel = document.createElement('div');
    panel.className = 'civitai-browse-info-panel';

    // ── HEADER ───────────────────────────────────
    const header = document.createElement('div');
    header.className = 'civitai-browse-info-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'civitai-browse-info-title-wrap';

    const typeChip = document.createElement('span');
    typeChip.className = 'civitai-browse-info-type-chip';
    typeChip.textContent = modelTypeApi;
    typeChip.style.cssText = `color:${typeColor};border-color:${typeColor}88;background:${typeColor}22;`;

    const titleEl = document.createElement('h3');
    titleEl.className = 'civitai-browse-info-title';
    titleEl.textContent = modelName;
    titleEl.title = modelName;

    titleWrap.append(typeChip, titleEl);

    const headerRight = document.createElement('div');
    headerRight.className = 'civitai-browse-info-header-right';

    const civitaiLink = document.createElement('a');
    civitaiLink.href = buildCivitaiModelUrl(modelId, primaryVersionId);
    civitaiLink.target = '_blank';
    civitaiLink.rel = 'noopener noreferrer';
    civitaiLink.className = 'civitai-button small';
    civitaiLink.title = 'Open on Civitai';
    civitaiLink.innerHTML = '<i class="fas fa-external-link-alt"></i>';
    civitaiLink.style.textDecoration = 'none';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'civitai-close-button';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Close (Esc)';
    closeBtn.addEventListener('click', () => overlay.remove());

    headerRight.append(civitaiLink, closeBtn);
    header.append(titleWrap, headerRight);

    // ── META BAR (creator + stats) ────────────────
    const metaBar = document.createElement('div');
    metaBar.className = 'civitai-browse-info-meta-bar';

    const creatorEl = document.createElement('div');
    creatorEl.className = 'civitai-browse-info-creator';

    if (creatorAvatar) {
        const av = document.createElement('img');
        av.src = creatorAvatar;
        av.className = 'civitai-browse-info-creator-avatar';
        av.alt = creator;
        av.setAttribute('onerror', `this.style.display='none';`);
        creatorEl.appendChild(av);
    } else {
        const avI = document.createElement('i');
        avI.className = 'fas fa-user-circle civitai-browse-info-creator-avatar-icon';
        creatorEl.appendChild(avI);
    }

    const creatorNameEl = document.createElement('span');
    creatorNameEl.className = 'civitai-browse-info-creator-name';
    creatorNameEl.textContent = creator;
    creatorEl.appendChild(creatorNameEl);

    if (publishedAt) {
        const dateEl = document.createElement('span');
        dateEl.className = 'civitai-browse-info-date';
        dateEl.title = updatedAt ? `Updated: ${updatedAt}` : '';
        dateEl.innerHTML = `<i class="fas fa-calendar-alt"></i> ${publishedAt}${updatedAt && updatedAt !== publishedAt ? ` <span class="civitai-browse-info-updated">(Updated ${updatedAt})</span>` : ''}`;
        creatorEl.appendChild(dateEl);
    }

    const statsEl = document.createElement('div');
    statsEl.className = 'civitai-browse-info-stats';

    [
        { icon: 'fa-download',  val: stats.downloadCount,                    title: 'Downloads' },
        { icon: 'fa-thumbs-up', val: stats.thumbsUpCount ?? stats.thumbsUpCountAllTime,   title: 'Likes' },
        { icon: 'fa-comment',   val: stats.commentCount  ?? stats.commentCountAllTime,    title: 'Comments' },
        { icon: 'fa-bookmark',  val: stats.collectedCount ?? stats.favoriteCount,          title: 'Saved' },
        { icon: 'fa-bolt',      val: stats.tippedAmountCount,                title: 'Buzz' },
    ].forEach(({ icon, val, title }) => {
        if (val == null || Number(val) === 0) return;
        const sp = document.createElement('span');
        sp.title = title;
        sp.innerHTML = `<i class="fas ${icon}"></i> ${_fmtNum(Number(val))}`;
        statsEl.appendChild(sp);
    });

    if (rating > 0 && ratingCount > 0) {
        const rSp = document.createElement('span');
        rSp.className = 'civitai-browse-info-rating';
        rSp.title = `${rating.toFixed(1)} / 5  (${ratingCount.toLocaleString()} ratings)`;
        rSp.innerHTML = `${_ratingStars(rating)}<span class="civitai-browse-info-rating-val"> ${rating.toFixed(1)}</span><span class="civitai-browse-info-rating-count"> (${_fmtNum(ratingCount)})</span>`;
        statsEl.appendChild(rSp);
    }

    metaBar.append(creatorEl, statsEl);

    // ── BODY ──────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'civitai-browse-info-body';

    // Gallery
    const galleryWrap = document.createElement('div');
    galleryWrap.className = 'civitai-browse-info-gallery';

    const mainImgWrap = document.createElement('div');
    mainImgWrap.className = 'civitai-browse-info-main-image civitai-zoomable';
    mainImgWrap.title = 'Click to zoom';

    const imgCounter = document.createElement('div');
    imgCounter.className = 'civitai-browse-info-img-counter';
    mainImgWrap.appendChild(imgCounter);

    const imgMetaEl = document.createElement('div');
    imgMetaEl.className = 'civitai-browse-info-img-meta';
    imgMetaEl.style.display = 'none';

    let _currentImg = null;
    let strip = null;

    function _updateImgMeta(img) {
        const m = img?.meta || {};
        const parts = [];
        if (m.sampler)                       parts.push(`<span title="Sampler"><i class="fas fa-random"></i> ${esc(m.sampler)}</span>`);
        if (m.steps)                         parts.push(`<span title="Steps"><i class="fas fa-layer-group"></i> ${esc(m.steps)} steps</span>`);
        if (m.cfgScale != null || m.cfg_scale != null) parts.push(`<span title="CFG Scale"><i class="fas fa-sliders-h"></i> CFG ${esc(m.cfgScale ?? m.cfg_scale)}</span>`);
        if (m.seed != null)                  parts.push(`<span title="Seed"><i class="fas fa-seedling"></i> ${esc(m.seed)}</span>`);
        if (m.size)                          parts.push(`<span title="Size"><i class="fas fa-expand-alt"></i> ${esc(m.size)}</span>`);
        imgMetaEl.innerHTML = parts.join('');
        imgMetaEl.style.display = parts.length > 0 ? 'flex' : 'none';
    }

    function _setMainMedia(img, idx) {
        _currentImg = img;
        mainImgWrap.querySelectorAll('img,video').forEach(e => e.remove());
        let el;
        if (img.type === 'video') {
            el = document.createElement('video');
            el.src = img.url;
            el.autoplay = true; el.loop = true; el.muted = true; el.controls = false;
            el.setAttribute('playsinline', '');
        } else {
            el = document.createElement('img');
            el.src = img.url || placeholder;
            el.alt = modelName;
            el.setAttribute('onerror', onError);
        }
        mainImgWrap.appendChild(el);
        imgCounter.textContent = `${idx + 1} / ${images.length}`;
        imgCounter.style.display = images.length > 1 ? 'flex' : 'none';
        strip?.querySelectorAll('.civitai-browse-info-thumb').forEach((t, i) => t.classList.toggle('active', i === idx));
        _updateImgMeta(img);
    }

    mainImgWrap.addEventListener('click', () => {
        if (_currentImg?.url) _openLightbox(_currentImg.url, _currentImg.type === 'video');
    });

    if (images.length > 0) {
        _setMainMedia(images[0], 0);
    } else {
        mainImgWrap.innerHTML = '<i class="fas fa-image" style="font-size:3em;opacity:0.2;"></i>';
        imgCounter.style.display = 'none';
    }
    galleryWrap.append(mainImgWrap, imgMetaEl);

    if (images.length > 1) {
        strip = document.createElement('div');
        strip.className = 'civitai-browse-info-thumb-strip';
        images.forEach((img, idx) => {
            const thumb = document.createElement('div');
            thumb.className = 'civitai-browse-info-thumb' + (idx === 0 ? ' active' : '');
            if (img.type === 'video') {
                const vIcon = document.createElement('div');
                vIcon.className = 'civitai-browse-info-thumb-video-icon';
                vIcon.innerHTML = '<i class="fas fa-play"></i>';
                thumb.appendChild(vIcon);
            }
            const tImg = document.createElement('img');
            tImg.src = img.url || placeholder;
            tImg.alt = `Image ${idx + 1}`;
            tImg.loading = 'lazy';
            tImg.setAttribute('onerror', onError);
            thumb.appendChild(tImg);
            thumb.addEventListener('click', () => _setMainMedia(img, idx));
            strip.appendChild(thumb);
        });
        galleryWrap.appendChild(strip);
    }
    body.appendChild(galleryWrap);

    // Details (right panel, scrollable)
    const detailsWrap = document.createElement('div');
    detailsWrap.className = 'civitai-browse-info-details';

    // ── Overview: KV grid ─────────────────────────
    {
        const sec = _infoSection('Overview', 'fas fa-info-circle');
        const grid = document.createElement('div');
        grid.className = 'civitai-browse-info-kv-grid';

        const kv = (label, html) => {
            if (html == null || html === '') return;
            const k = document.createElement('span');
            k.className = 'civitai-browse-info-kv-key';
            k.textContent = label;
            const v = document.createElement('span');
            v.className = 'civitai-browse-info-kv-val';
            v.innerHTML = String(html);
            grid.append(k, v);
        };

        kv('Model ID',  `<code>${esc(modelId)}</code>`);
        if (uniqueBaseModels.length > 0)
            kv('Base Model', uniqueBaseModels.map(bm => `<span class="base-model-badge">${esc(bm)}</span>`).join(' '));
        if (allVersions.length > 0) kv('Versions', allVersions.length);
        if (publishedAt) kv('Published', publishedAt);
        if (updatedAt && updatedAt !== publishedAt) kv('Updated', updatedAt);
        const nsfwLvl = hit.nsfwLevel ?? hit.nsfw;
        if (nsfwLvl != null) {
            const n = Number(nsfwLvl);
            const label = n <= 1 ? '🟢 Safe (PG)' : n <= 2 ? '🟡 Mild (PG-13)' : n <= 4 ? '🟠 Mature (R)' : n <= 8 ? '🔴 Adult (X)' : '⛔ Explicit';
            kv('Content', label);
        }

        grid.addEventListener('click', e => {
            const btn = e.target.closest('.civitai-browse-info-copy-id');
            if (btn) { navigator.clipboard?.writeText(btn.dataset.copy).catch(() => {}); ui.showToast('Copied!', 'success', 1200); }
        });

        sec.appendChild(grid);
        detailsWrap.appendChild(sec);
    }

    // ── Trigger Words ─────────────────────────────
    if (allTrainedWords.length > 0) {
        const sec = _infoSection('Trigger Words', 'fas fa-magic');

        const twHeader = document.createElement('div');
        twHeader.className = 'civitai-browse-info-tw-header';
        const copyAllBtn = document.createElement('button');
        copyAllBtn.className = 'civitai-button small';
        copyAllBtn.innerHTML = '<i class="fas fa-copy"></i> Copy All';
        copyAllBtn.addEventListener('click', () => {
            navigator.clipboard?.writeText(allTrainedWords.join(', ')).catch(() => {});
            ui.showToast('All trigger words copied!', 'success', 1500);
        });
        twHeader.appendChild(copyAllBtn);
        sec.appendChild(twHeader);

        const twWrap = document.createElement('div');
        twWrap.className = 'civitai-browse-info-trigger-words';
        allTrainedWords.forEach(w => {
            const chip = document.createElement('span');
            chip.className = 'civitai-browse-info-trigger-word';
            chip.textContent = w;
            chip.title = 'Click to copy';
            chip.addEventListener('click', () => {
                navigator.clipboard?.writeText(w).catch(() => {});
                ui.showToast(`Copied: ${w}`, 'success', 1200);
            });
            twWrap.appendChild(chip);
        });
        sec.appendChild(twWrap);
        detailsWrap.appendChild(sec);
    }

    // ── Versions ──────────────────────────────────
    if (allVersions.length > 0) {
        const sec = _infoSection(`Versions (${allVersions.length})`, 'fas fa-code-branch');
        const versList = document.createElement('div');
        versList.className = 'civitai-browse-info-versions';

        allVersions.slice(0, 10).forEach(ver => {
            const card = document.createElement('div');
            card.className = 'civitai-browse-info-version-card';

            // Header row: base model + name + download button
            const vHead = document.createElement('div');
            vHead.className = 'civitai-browse-info-version-head';

            const vNameWrap = document.createElement('div');
            vNameWrap.className = 'civitai-browse-info-version-name-wrap';
            if (ver.baseModel) {
                const bm = document.createElement('span');
                bm.className = 'base-model-badge';
                bm.textContent = ver.baseModel;
                vNameWrap.appendChild(bm);
            }
            const vName = document.createElement('span');
            vName.className = 'civitai-browse-info-version-name';
            vName.textContent = ver.name || `Version ${ver.id}`;
            vName.title = ver.name || '';
            vNameWrap.appendChild(vName);

            if (ver.id && ver.id === primaryVersionId) {
                const badge = document.createElement('span');
                badge.className = 'civitai-browse-info-latest-badge';
                badge.textContent = 'Latest';
                vNameWrap.appendChild(badge);
            }

            if (ver.id) {
                const sizeEl = _createSizePlaceholder(ver.id);
                sizeEl.classList.add('civitai-browse-info-version-size');
                _fillSizePlaceholder(sizeEl);
                vNameWrap.appendChild(sizeEl);
            }

            const dlBtn = document.createElement('button');
            dlBtn.className = 'civitai-button primary small civitai-search-download-button';
            dlBtn.dataset.modelId = modelId;
            dlBtn.dataset.versionId = ver.id || '';
            dlBtn.dataset.modelType = modelTypeApi;
            dlBtn.dataset.modelName = modelName;
            dlBtn.dataset.versionName = ver.name || 'Unknown';
            dlBtn.title = `Download: ${ver.name || 'this version'}`;
            if (!ver.id) dlBtn.disabled = true;
            dlBtn.innerHTML = '<i class="fas fa-download"></i>';

            vHead.append(vNameWrap, dlBtn);
            card.appendChild(vHead);

            // Files
            const files = ver.files || [];
            if (files.length > 0) {
                const filesList = document.createElement('div');
                filesList.className = 'civitai-browse-info-version-files';
                files.slice(0, 4).forEach(f => {
                    const fRow = document.createElement('div');
                    fRow.className = 'civitai-browse-info-version-file';
                    const ext = (f.name || '').split('.').pop().toUpperCase() || 'FILE';
                    const sizeStr = f.sizeKB ? _fmtBytes(f.sizeKB * 1024) : '';
                    const isPrimary = f.primary || (f.type || '').toLowerCase() === 'model';
                    fRow.innerHTML = `
                        <span class="civitai-browse-info-file-ext${isPrimary ? ' primary' : ''}">${esc(ext)}</span>
                        <span class="civitai-browse-info-file-name" title="${esc(f.name || '')}">${esc(f.name || 'Unknown')}</span>
                        ${sizeStr ? `<span class="civitai-browse-info-file-size">${esc(sizeStr)}</span>` : ''}
                    `;
                    filesList.appendChild(fRow);
                });
                card.appendChild(filesList);
            }

            // Trained words for this version (brief)
            const vWords = (ver.trainedWords || []).slice(0, 6);
            if (vWords.length > 0) {
                const vwEl = document.createElement('div');
                vwEl.className = 'civitai-browse-info-version-words';
                vwEl.textContent = vWords.join(', ') + (ver.trainedWords.length > 6 ? '…' : '');
                card.appendChild(vwEl);
            }

            versList.appendChild(card);
        });

        // Download button click handler
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
            ui.showToast(`Filled download form for "${mname || 'Model #' + mid}".`, 'info', 3500);
            ui.fetchAndDisplayDownloadPreview();
        });

        _hydrateModelSizes(ui, [hit], versList);
        sec.appendChild(versList);
        detailsWrap.appendChild(sec);
    }

    // ── Example Prompts ───────────────────────────
    if (exampleImages.length > 0) {
        const sec = _infoSection(`Example Prompts (${exampleImages.length})`, 'fas fa-magic');
        const epWrap = document.createElement('div');
        epWrap.className = 'civitai-browse-info-prompts';

        exampleImages.forEach((img, i) => {
            const meta = img.meta || {};
            const card = document.createElement('div');
            card.className = 'civitai-browse-info-prompt-card';

            const metaParts = [];
            if (meta.sampler) metaParts.push(`<span title="Sampler"><i class="fas fa-random"></i> ${esc(meta.sampler)}</span>`);
            if (meta.steps)   metaParts.push(`<span title="Steps"><i class="fas fa-layer-group"></i> ${esc(meta.steps)}</span>`);
            if (meta.cfgScale != null || meta.cfg_scale != null) metaParts.push(`<span title="CFG"><i class="fas fa-sliders-h"></i> CFG ${esc(meta.cfgScale ?? meta.cfg_scale)}</span>`);
            if (meta.size)    metaParts.push(`<span title="Resolution"><i class="fas fa-expand-alt"></i> ${esc(meta.size)}</span>`);

            const promptHeader = document.createElement('div');
            promptHeader.className = 'civitai-browse-info-prompt-header';
            promptHeader.innerHTML = `<span class="civitai-browse-info-prompt-num">#${i + 1}</span>${metaParts.join('')}`;

            const copyBtn = document.createElement('button');
            copyBtn.className = 'civitai-button small icon-only';
            copyBtn.title = 'Copy prompt';
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard?.writeText(meta.prompt).catch(() => {});
                ui.showToast('Prompt copied!', 'success', 1500);
            });
            promptHeader.appendChild(copyBtn);

            const promptText = document.createElement('div');
            promptText.className = 'civitai-browse-info-prompt-text';
            promptText.textContent = meta.prompt;

            card.append(promptHeader, promptText);

            if (meta.negativePrompt) {
                const negEl = document.createElement('div');
                negEl.className = 'civitai-browse-info-prompt-neg';
                negEl.innerHTML = `<span class="civitai-browse-info-prompt-neg-label"><i class="fas fa-minus-circle"></i> Negative</span> ${esc(meta.negativePrompt)}`;
                card.appendChild(negEl);
            }
            epWrap.appendChild(card);
        });
        sec.appendChild(epWrap);
        detailsWrap.appendChild(sec);
    }

    // ── Description ───────────────────────────────
    const rawDesc = hit.description || '';
    if (rawDesc) {
        const sec = _infoSection('Description', 'fas fa-align-left');
        const descEl = document.createElement('div');
        descEl.className = 'civitai-browse-info-desc';
        // Parse with DOMParser (inert document) to strip HTML to plain text
        // without triggering resource loads (e.g. <img onerror>) the way an
        // innerHTML assignment on a detached element would.
        const parsed = new DOMParser().parseFromString(rawDesc, 'text/html');
        descEl.textContent = parsed.body.textContent || '';
        sec.appendChild(descEl);
        detailsWrap.appendChild(sec);
    }

    // ── Tags ──────────────────────────────────────
    if (tags.length > 0) {
        const sec = _infoSection('Tags', 'fas fa-tags');
        const tagsWrap = document.createElement('div');
        tagsWrap.className = 'civitai-browse-info-tags';
        tags.slice(0, 20).forEach(tag => {
            const el = document.createElement('span');
            el.className = 'civitai-browse-info-tag';
            el.textContent = tag;
            tagsWrap.appendChild(el);
        });
        sec.appendChild(tagsWrap);
        detailsWrap.appendChild(sec);
    }

    body.appendChild(detailsWrap);

    // ── FOOTER ────────────────────────────────────
    const footer = document.createElement('div');
    footer.className = 'civitai-browse-info-footer';

    const footerLeft = document.createElement('div');
    footerLeft.className = 'civitai-browse-info-footer-left';
    footerLeft.innerHTML = `<span class="civitai-browse-info-model-id-label"><i class="fas fa-hashtag"></i> Model ID: <code>${modelId}</code></span>`;

    const footerRight = document.createElement('div');
    footerRight.className = 'civitai-browse-info-footer-right';

    const copyIdBtn = document.createElement('button');
    copyIdBtn.className = 'civitai-button small secondary';
    copyIdBtn.title = 'Copy Model ID to clipboard';
    copyIdBtn.innerHTML = '<i class="fas fa-copy"></i> Copy ID';
    copyIdBtn.addEventListener('click', () => {
        navigator.clipboard?.writeText(String(modelId)).catch(() => {});
        ui.showToast('Model ID copied!', 'success', 1200);
    });

    const viewBtn = document.createElement('a');
    viewBtn.href = civitaiLink.href;
    viewBtn.target = '_blank';
    viewBtn.rel = 'noopener noreferrer';
    viewBtn.className = 'civitai-button small primary';
    viewBtn.title = 'Open model page on Civitai';
    viewBtn.innerHTML = '<i class="fas fa-external-link-alt"></i> View on Civitai';
    viewBtn.style.textDecoration = 'none';

    footerRight.append(copyIdBtn, viewBtn);
    footer.append(footerLeft, footerRight);

    // ── Assemble ──────────────────────────────────
    panel.append(header, metaBar, body, footer);
    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    // Esc closes
    const _onKey = e => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', _onKey); } };
    document.addEventListener('keydown', _onKey);
    // Clean up listener when overlay is removed
    new MutationObserver((_, obs) => {
        if (!overlay.isConnected) { document.removeEventListener('keydown', _onKey); obs.disconnect(); }
    }).observe(ui.modal, { childList: true, subtree: false });

    ui.modal.appendChild(overlay);
}
