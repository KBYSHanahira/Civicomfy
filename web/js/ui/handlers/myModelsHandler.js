import { CivitaiDownloaderAPI } from "../../api/civitai.js";
import { app } from "../../../../../scripts/app.js";

const CIVITAI_BASE = 'https://civitai.com/models/';

// Track the CiviComfyModelInfo node added to workflow so it can be updated
let _workflowNodeId = null;

/**
 * Load local models from the server, populate type filter, and render the list.
 * @param {object} ui - CivitaiDownloaderUI instance
 */
export async function handleMyModelsLoad(ui) {
    const listEl = ui.myModelsListContainer;
    const countEl = ui.myModelsCountEl;
    if (!listEl) return;

    listEl.innerHTML = '<p>Loading models...</p>';
    if (countEl) countEl.textContent = '';

    try {
        const filterType = ui.myModelsTypeFilter?.value || '';
        const data = await CivitaiDownloaderAPI.getLocalModels(filterType);
        if (!data || !Array.isArray(data.models)) {
            throw new Error("Invalid response from server.");
        }

        // Populate type filter dropdown
        if (ui.myModelsTypeFilter && Array.isArray(data.types)) {
            const current = ui._savedMyModelsTypeFilter !== undefined
                ? ui._savedMyModelsTypeFilter
                : ui.myModelsTypeFilter.value;
            ui._savedMyModelsTypeFilter = undefined;
            ui.myModelsTypeFilter.innerHTML = '<option value="">All Types</option>';
            data.types.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                ui.myModelsTypeFilter.appendChild(opt);
            });
            if (Array.from(ui.myModelsTypeFilter.options).some(o => o.value === current)) {
                ui.myModelsTypeFilter.value = current;
            }
        }

        ui._myModelsAll = data.models;
        renderMyModels(ui);

    } catch (err) {
        console.error("[Civicomfy] Failed to load local models:", err);
        listEl.innerHTML = `<p style="color:var(--error-text,#ff6b6b);">Failed to load models: ${err.message}</p>`;
    }
}

/**
 * Re-render the model list applying current name/type filter and pagination.
 * @param {object} ui
 */
export function renderMyModels(ui) {
    const listEl = ui.myModelsListContainer;
    const countEl = ui.myModelsCountEl;
    if (!listEl) return;

    const query = (ui.myModelsSearchInput?.value || '').toLowerCase().trim();
    const typeFilter = ui.myModelsTypeFilter?.value || '';
    const sortBy = ui.myModelsSortSelect?.value || 'time_desc';
    const all = ui._myModelsAll || [];

    const filtered = all.filter(m => {
        const matchType = !typeFilter || m.model_type === typeFilter;
        const matchName = !query || m.name.toLowerCase().includes(query) || m.rel_path.toLowerCase().includes(query);
        return matchType && matchName;
    });

    // Sort
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'name_asc':  return (a.name || '').localeCompare(b.name || '');
            case 'name_desc': return (b.name || '').localeCompare(a.name || '');
            case 'size_desc': return (b.size_bytes || 0) - (a.size_bytes || 0);
            case 'size_asc':  return (a.size_bytes || 0) - (b.size_bytes || 0);
            case 'time_asc':  return (a.modified || 0) - (b.modified || 0);
            case 'time_desc':
            default:          return (b.modified || 0) - (a.modified || 0);
        }
    });

    // Pagination
    const limit = ui.myModelsPagination?.limit || 50;
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    if (!ui.myModelsPagination) ui.myModelsPagination = { currentPage: 1, limit };
    // Clamp currentPage if filter changed
    if (ui.myModelsPagination.currentPage > totalPages) ui.myModelsPagination.currentPage = 1;
    const currentPage = ui.myModelsPagination.currentPage;
    const startIdx = (currentPage - 1) * limit;
    const pageItems = filtered.slice(startIdx, startIdx + limit);

    if (countEl) {
        const showingStart = totalItems === 0 ? 0 : startIdx + 1;
        const showingEnd = Math.min(startIdx + limit, totalItems);
        countEl.textContent = totalItems === 0
            ? '0 models'
            : `${showingStart}–${showingEnd} of ${totalItems} model${totalItems !== 1 ? 's' : ''}${all.length !== totalItems ? ` (filtered from ${all.length})` : ''}`;
    }

    if (filtered.length === 0) {
        listEl.innerHTML = '<p>No models found.</p>';
        if (ui.myModelsPaginationContainer) ui.myModelsPaginationContainer.innerHTML = '';
        return;
    }

    listEl.innerHTML = '';
    pageItems.forEach(model => {
        listEl.appendChild(_buildModelRow(model));
    });

    _renderMyModelsPagination(ui, currentPage, totalPages);
}

function _renderMyModelsPagination(ui, currentPage, totalPages) {
    const container = ui.myModelsPaginationContainer;
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const frag = document.createDocumentFragment();

    const makeBtn = (html, page, disabled = false, active = false) => {
        const btn = document.createElement('button');
        btn.className = `civitai-button small civitai-mymodels-page-button${active ? ' primary active' : ''}`;
        btn.innerHTML = html;
        btn.disabled = disabled;
        btn.type = 'button';
        btn.dataset.page = page;
        return btn;
    };

    frag.appendChild(makeBtn('&laquo;', currentPage - 1, currentPage === 1));

    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);

    if (start > 1) { frag.appendChild(makeBtn('1', 1)); }
    if (start > 2) { const sp = document.createElement('span'); sp.textContent = '…'; sp.style.padding = '0 4px'; frag.appendChild(sp); }
    for (let i = start; i <= end; i++) { frag.appendChild(makeBtn(i, i, false, i === currentPage)); }
    if (end < totalPages - 1) { const sp = document.createElement('span'); sp.textContent = '…'; sp.style.padding = '0 4px'; frag.appendChild(sp); }
    if (end < totalPages) { frag.appendChild(makeBtn(totalPages, totalPages)); }

    frag.appendChild(makeBtn('&raquo;', currentPage + 1, currentPage === totalPages));

    const info = document.createElement('div');
    info.className = 'civitai-pagination-info';
    info.textContent = `Page ${currentPage} of ${totalPages}`;
    frag.appendChild(info);

    container.innerHTML = '';
    container.appendChild(frag);

    // Replace onclick to avoid listener accumulation (container persists between renders)
    container.onclick = (e) => {
        const btn = e.target.closest('.civitai-mymodels-page-button');
        if (btn && !btn.disabled) {
            const page = parseInt(btn.dataset.page, 10);
            if (page && page !== ui.myModelsPagination.currentPage) {
                ui.myModelsPagination.currentPage = page;
                renderMyModels(ui);
                ui.tabContents?.['mymodels']?.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    };
}


/**
 * Build a DOM card for a single model entry.
 */
function _buildModelRow(model) {
    const card = document.createElement('div');
    card.className = 'civitai-mymodel-card';
    card.dataset.relPath = model.rel_path;

    // --- Preview image ---
    const previewWrap = document.createElement('div');
    previewWrap.className = 'civitai-mymodel-card-preview';
    if (model.has_preview) {
        const img = document.createElement('img');
        img.src = `/civitai/model_preview_image?rel_path=${encodeURIComponent(model.rel_path)}`;
        img.alt = model.name;
        img.loading = 'lazy';
        img.onerror = () => { previewWrap.classList.add('no-preview'); img.remove(); };
        previewWrap.appendChild(img);
    } else {
        previewWrap.classList.add('no-preview');
        previewWrap.innerHTML = '<i class="fas fa-image" style="font-size:2em;opacity:0.25;"></i>';
    }

    // Type badge — bottom-left
    if (model.model_type) {
        const badge = document.createElement('div');
        badge.className = 'civitai-mymodel-card-badge';
        badge.textContent = model.model_type;
        previewWrap.appendChild(badge);
    }

    // Base model badge — bottom-right (NoobAI / Illustrious / SDXL 1.0 …)
    if (model.base_model) {
        const bmBadge = document.createElement('div');
        bmBadge.className = 'civitai-mymodel-card-bm-badge';
        bmBadge.textContent = model.base_model;
        bmBadge.title = `Base model: ${model.base_model}`;
        previewWrap.appendChild(bmBadge);
    }

    // Hover overlay with action buttons
    const overlay = document.createElement('div');
    overlay.className = 'civitai-mymodel-card-overlay';

    const civitBtn = document.createElement('button');
    civitBtn.className = 'civitai-button small civitai-mymodel-opencivit-btn';
    civitBtn.dataset.relPath = model.rel_path;
    civitBtn.dataset.modelId = model.civitai_model_id || '';
    civitBtn.title = model.civitai_model_id ? `Open on Civitai (Model #${model.civitai_model_id})` : 'No Civitai info found';
    civitBtn.disabled = !model.civitai_model_id;
    civitBtn.innerHTML = '<i class="fas fa-external-link-alt"></i>';

    const detailBtn = document.createElement('button');
    detailBtn.className = 'civitai-button small civitai-mymodel-detail-btn';
    detailBtn.dataset.relPath = model.rel_path;
    detailBtn.title = 'View model details';
    detailBtn.innerHTML = '<i class="fas fa-info-circle"></i>';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'civitai-button small danger civitai-mymodel-delete-btn';
    deleteBtn.dataset.relPath = model.rel_path;
    deleteBtn.dataset.name = model.name;
    deleteBtn.title = 'Delete this model file';
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';

    overlay.appendChild(civitBtn);
    overlay.appendChild(detailBtn);
    overlay.appendChild(deleteBtn);
    previewWrap.appendChild(overlay);

    // --- Card body ---
    const body = document.createElement('div');
    body.className = 'civitai-mymodel-card-body';

    const displayName = model.model_name || model.name;
    const name = document.createElement('span');
    name.className = 'civitai-mymodel-name';
    name.textContent = displayName;
    name.title = model.rel_path;

    const meta = document.createElement('div');
    meta.className = 'civitai-mymodel-meta';
    const sizeMB = model.size_bytes > 0 ? (model.size_bytes / 1024 / 1024).toFixed(1) + ' MB' : '';
    const dateStr = model.modified ? new Date(model.modified * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    const metaLines = [
        model.version_name ? { icon: 'fa-tag', text: model.version_name } : null,
        sizeMB ? { icon: 'fa-hdd', text: sizeMB } : null,
        dateStr ? { icon: 'fa-clock', text: dateStr } : null,
    ].filter(Boolean);
    metaLines.forEach(({ icon, text }) => {
        const line = document.createElement('span');
        line.className = 'civitai-mymodel-meta-line';
        line.innerHTML = `<i class="fas ${icon}"></i> ${text}`;
        meta.appendChild(line);
    });

    body.appendChild(name);
    body.appendChild(meta);

    card.appendChild(previewWrap);
    card.appendChild(body);

    return card;
}

/**
 * Open the model's Civitai page in a new browser tab.
 */
export function handleMyModelOpenOnCivit(modelId) {
    if (!modelId) return;
    window.open(`${CIVITAI_BASE}${modelId}`, '_blank', 'noopener,noreferrer');
}

/**
 * Show a detail modal with metadata from the model's .cminfo.json data (already in the list entry).
 */
export function handleMyModelViewDetail(ui, relPath) {
    const model = (ui._myModelsAll || []).find(m => m.rel_path === relPath);
    if (!model) {
        ui.showToast('Model data not found.', 'error');
        return;
    }
    _showDetailModal(ui, model);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function _fmtBytes(bytes) {
    if (!bytes || bytes <= 0) return '';
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576)    return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(0) + ' KB';
}

function _fmtDate(ts) {
    if (!ts) return '';
    return new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function _mmTypeColor(type) {
    const map = {
        'checkpoints': '#4a9eff', 'loras': '#f59e0b', 'controlnet': '#22d3ee',
        'vae': '#fb7185', 'embeddings': '#a78bfa', 'hypernetworks': '#34d399',
        'upscale_models': '#fb923c', 'clip': '#a3e635',
    };
    return map[(type || '').toLowerCase()] || '#888';
}

function _mmSection(label, iconClass) {
    const sec = document.createElement('div');
    sec.className = 'civitai-mymodel-detail-section';
    const lbl = document.createElement('div');
    lbl.className = 'civitai-mymodel-detail-section-label';
    lbl.innerHTML = iconClass ? `<i class="fas ${iconClass}"></i> ${label}` : label;
    sec.appendChild(lbl);
    return sec;
}

function _showDetailModal(ui, model) {
    // Remove any existing detail modal
    const existing = ui.modal.querySelector('#civitai-mymodel-detail-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'civitai-mymodel-detail-modal';
    overlay.className = 'civitai-mymodel-detail-overlay';

    const panel = document.createElement('div');
    panel.className = 'civitai-mymodel-detail-panel';

    // ── HEADER ────────────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'civitai-mymodel-detail-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'civitai-mymodel-detail-title-wrap';

    const typeLabel = model.model_type || model.model_type_civitai || '';
    if (typeLabel) {
        const chip = document.createElement('span');
        chip.className = 'civitai-mymodel-detail-type-chip';
        chip.textContent = typeLabel;
        const tc = _mmTypeColor(typeLabel);
        chip.style.background = tc + '28';
        chip.style.borderColor = tc + '60';
        chip.style.color = tc;
        titleWrap.appendChild(chip);
    }

    const titleEl = document.createElement('h3');
    titleEl.className = 'civitai-mymodel-detail-title';
    titleEl.textContent = model.model_name || model.name;
    titleEl.title = model.model_name || model.name;
    titleWrap.appendChild(titleEl);

    const headerRight = document.createElement('div');
    headerRight.className = 'civitai-mymodel-detail-header-right';

    if (model.civitai_model_id) {
        const civitLink = document.createElement('a');
        civitLink.href = `${CIVITAI_BASE}${model.civitai_model_id}`;
        civitLink.target = '_blank';
        civitLink.rel = 'noopener noreferrer';
        civitLink.className = 'civitai-button secondary small';
        civitLink.innerHTML = '<i class="fas fa-external-link-alt"></i> Civitai';
        civitLink.title = 'View on Civitai';
        headerRight.appendChild(civitLink);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'civitai-close-button';
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Close (Esc)';

    headerRight.appendChild(closeBtn);
    header.appendChild(titleWrap);
    header.appendChild(headerRight);

    // ── META BAR ──────────────────────────────────────────────────────────────
    const metaBar = document.createElement('div');
    metaBar.className = 'civitai-mymodel-detail-meta-bar';

    const metaItems = [
        model.version_name          ? { icon: 'fa-code-branch', text: model.version_name } : null,
        model.base_model            ? { icon: 'fa-layer-group', text: model.base_model }   : null,
        _fmtBytes(model.size_bytes) ? { icon: 'fa-hdd',         text: _fmtBytes(model.size_bytes) } : null,
        _fmtDate(model.modified)    ? { icon: 'fa-clock',        text: _fmtDate(model.modified) }   : null,
    ].filter(Boolean);

    metaItems.forEach(({ icon, text }) => {
        const item = document.createElement('span');
        item.className = 'civitai-mymodel-detail-meta-item';
        item.innerHTML = `<i class="fas ${icon}"></i> ${text}`;
        metaBar.appendChild(item);
    });

    // ── BODY ─────────────────────────────────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'civitai-mymodel-detail-body';

    // Left: preview
    const left = document.createElement('div');
    left.className = 'civitai-mymodel-detail-left';

    const previewWrap = document.createElement('div');
    previewWrap.className = 'civitai-mymodel-detail-preview-wrap';

    if (model.has_preview) {
        const imgUrl = `/civitai/model_preview_image?rel_path=${encodeURIComponent(model.rel_path)}`;
        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = model.name;
        img.className = 'civitai-mymodel-detail-preview civitai-zoomable';
        img.title = 'Click to zoom';
        img.onerror = () => {
            previewWrap.classList.add('no-preview');
            img.remove();
            previewWrap.innerHTML = '<i class="fas fa-image"></i>';
        };
        img.addEventListener('click', () => {
            const lb = document.createElement('div');
            lb.id = 'civitai-lightbox';
            lb.className = 'civitai-lightbox';
            const closeX = document.createElement('button');
            closeX.className = 'civitai-lightbox-close';
            closeX.innerHTML = '&times;';
            closeX.addEventListener('click', (e) => { e.stopPropagation(); lb.remove(); });
            const zoomImg = document.createElement('img');
            zoomImg.src = imgUrl;
            zoomImg.className = 'civitai-lightbox-media';
            zoomImg.addEventListener('click', (e) => e.stopPropagation());
            lb.appendChild(closeX);
            lb.appendChild(zoomImg);
            lb.addEventListener('click', () => lb.remove());
            const onLbKey = (e) => { if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', onLbKey); } };
            document.addEventListener('keydown', onLbKey);
            document.body.appendChild(lb);
        });
        previewWrap.appendChild(img);
    } else {
        previewWrap.classList.add('no-preview');
        previewWrap.innerHTML = '<i class="fas fa-image"></i>';
    }
    left.appendChild(previewWrap);

    // Right: details
    const right = document.createElement('div');
    right.className = 'civitai-mymodel-detail-right';

    // ── Section: File Info
    const infoSec = _mmSection('File Info', 'fa-file-alt');
    const kvGrid = document.createElement('div');
    kvGrid.className = 'civitai-mymodel-detail-kv-grid';

    const kvRows = [
        ['Filename',    model.name,         null],
        ['Model Name',  (model.model_name && model.model_name !== model.name) ? model.model_name : null, null],
        ['Version',     model.version_name, null],
        ['Type',        model.model_type || model.model_type_civitai, null],
        ['Base Model',  model.base_model,   null],
        ['File Size',   _fmtBytes(model.size_bytes), null],
        ['Modified',    _fmtDate(model.modified),    null],
        ['Model ID',    model.civitai_model_id,
            model.civitai_model_id ? () => { navigator.clipboard?.writeText(String(model.civitai_model_id)).catch(() => {}); ui.showToast('Model ID copied!', 'success', 1500); } : null],
        ['Version ID',  model.civitai_version_id,
            model.civitai_version_id ? () => { navigator.clipboard?.writeText(String(model.civitai_version_id)).catch(() => {}); ui.showToast('Version ID copied!', 'success', 1500); } : null],
    ];

    kvRows.forEach(([key, val, onCopy]) => {
        if (!val && val !== 0) return;
        const kEl = document.createElement('div');
        kEl.className = 'civitai-mymodel-detail-kv-key';
        kEl.textContent = key;
        const vEl = document.createElement('div');
        vEl.className = 'civitai-mymodel-detail-kv-val';
        if (onCopy) {
            const code = document.createElement('code');
            code.textContent = String(val);
            const copyBtn = document.createElement('button');
            copyBtn.className = 'civitai-button small icon-only';
            copyBtn.title = `Copy ${key}`;
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
            copyBtn.addEventListener('click', onCopy);
            vEl.appendChild(code);
            vEl.appendChild(copyBtn);
        } else {
            vEl.textContent = String(val);
        }
        kvGrid.appendChild(kEl);
        kvGrid.appendChild(vEl);
    });
    infoSec.appendChild(kvGrid);
    right.appendChild(infoSec);

    // ── Section: Trigger Words
    if (Array.isArray(model.trained_words) && model.trained_words.length > 0) {
        const twSec = _mmSection('Trigger Words', 'fa-tags');

        const twHeader = document.createElement('div');
        twHeader.className = 'civitai-mymodel-detail-tw-header';
        const copyAllBtn = document.createElement('button');
        copyAllBtn.className = 'civitai-button small secondary';
        copyAllBtn.innerHTML = '<i class="fas fa-copy"></i> Copy All';
        copyAllBtn.addEventListener('click', () => {
            navigator.clipboard?.writeText(model.trained_words.join(', ')).catch(() => {});
            ui.showToast('All trigger words copied!', 'success', 1800);
        });
        twHeader.appendChild(copyAllBtn);
        twSec.appendChild(twHeader);

        const twWrap = document.createElement('div');
        twWrap.className = 'civitai-mymodel-detail-trigger-words';
        model.trained_words.forEach(w => {
            const tag = document.createElement('span');
            tag.className = 'civitai-mymodel-detail-trigger-word';
            tag.textContent = w;
            tag.title = 'Click to copy';
            tag.addEventListener('click', () => {
                navigator.clipboard?.writeText(w).catch(() => {});
                ui.showToast(`Copied: ${w}`, 'success', 1500);
            });
            twWrap.appendChild(tag);
        });
        twSec.appendChild(twWrap);
        right.appendChild(twSec);
    }

    // ── Section: Example Prompts
    if (Array.isArray(model.example_prompts) && model.example_prompts.length > 0) {
        const epSec = _mmSection('Example Prompts', 'fa-lightbulb');
        const promptsWrap = document.createElement('div');
        promptsWrap.className = 'civitai-mymodel-detail-prompts';
        model.example_prompts.forEach((prompt, i) => {
            const card = document.createElement('div');
            card.className = 'civitai-mymodel-detail-prompt-card';
            const cardHeader = document.createElement('div');
            cardHeader.className = 'civitai-mymodel-detail-prompt-header';
            const num = document.createElement('span');
            num.className = 'civitai-mymodel-detail-prompt-num';
            num.textContent = `Prompt ${i + 1}`;
            const copyBtn = document.createElement('button');
            copyBtn.className = 'civitai-button small';
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard?.writeText(prompt).catch(() => {});
                ui.showToast('Prompt copied!', 'success', 1500);
            });
            cardHeader.appendChild(num);
            cardHeader.appendChild(copyBtn);
            const text = document.createElement('div');
            text.className = 'civitai-mymodel-detail-prompt-text';
            text.textContent = prompt;
            card.appendChild(cardHeader);
            card.appendChild(text);
            promptsWrap.appendChild(card);
        });
        epSec.appendChild(promptsWrap);
        right.appendChild(epSec);
    }

    // ── Section: Description
    if (model.description) {
        const descSec = _mmSection('Description', 'fa-align-left');
        const desc = document.createElement('div');
        desc.className = 'civitai-mymodel-detail-desc';
        desc.innerHTML = model.description;
        descSec.appendChild(desc);
        right.appendChild(descSec);
    }

    body.appendChild(left);
    body.appendChild(right);

    // ── FOOTER BAR ────────────────────────────────────────────────────────────
    const footerBar = document.createElement('div');
    footerBar.className = 'civitai-mymodel-detail-footer-bar';

    const footerLeft = document.createElement('div');
    footerLeft.className = 'civitai-mymodel-detail-footer-left';
    const pathIcon = document.createElement('span');
    pathIcon.className = 'civitai-mymodel-detail-path-label';
    pathIcon.innerHTML = '<i class="fas fa-folder-open"></i>';
    pathIcon.title = model.rel_path;
    const pathCode = document.createElement('code');
    pathCode.className = 'civitai-mymodel-detail-path-code';
    pathCode.textContent = model.rel_path;
    pathCode.title = model.rel_path;
    const copyPathBtn = document.createElement('button');
    copyPathBtn.className = 'civitai-button small secondary';
    copyPathBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Path';
    copyPathBtn.title = 'Copy relative path';
    copyPathBtn.addEventListener('click', () => {
        navigator.clipboard?.writeText(model.rel_path).catch(() => {});
        ui.showToast('Path copied!', 'success', 1500);
    });
    footerLeft.appendChild(pathIcon);
    footerLeft.appendChild(pathCode);
    footerLeft.appendChild(copyPathBtn);

    const footerRight = document.createElement('div');
    footerRight.className = 'civitai-mymodel-detail-footer-right';

    // ── Send to Workflow button ────────────────────
    // Recover node ID from graph after page reload (module var reset to null)
    if (_workflowNodeId === null && app.graph) {
        const found = app.graph._nodes?.find(n => n.type === 'CiviComfyModelInfo');
        if (found) _workflowNodeId = found.id;
    }
    const _nodeExists = () => _workflowNodeId !== null && !!(app.graph && app.graph.getNodeById(_workflowNodeId));

    const sendToWfBtn = document.createElement('button');
    sendToWfBtn.className = 'civitai-button small';
    sendToWfBtn.style.cssText = 'background:var(--cfy-accent,#5c8aff);color:#fff;';
    sendToWfBtn.title = 'Add or update model info as a CiviComfy Model Info node in the workflow';
    sendToWfBtn.innerHTML = _nodeExists()
        ? '<i class="fas fa-sync-alt"></i> Update Workflow'
        : '<i class="fas fa-project-diagram"></i> Send to Workflow';

    sendToWfBtn.addEventListener('click', () => {
        try {
            const LG = window.LiteGraph;
            if (!LG || !app.graph) { ui.showToast('ComfyUI graph not available.', 'error'); return; }

            const imageUrl = model.has_preview
                ? `/civitai/model_preview_image?rel_path=${encodeURIComponent(model.rel_path)}`
                : '';
            const civitaiUrl = model.civitai_model_id
                ? `https://civitai.com/models/${model.civitai_model_id}${model.civitai_version_id ? '?modelVersionId=' + model.civitai_version_id : ''}`
                : '';
            const nodeProps = {
                modelName:      model.model_name || model.name || '',
                imageUrl,
                modelType:      model.model_type || model.model_type_civitai || '',
                baseModel:      model.base_model || '',
                creator:        model.creator || '',
                modelId:        String(model.civitai_model_id || ''),
                versionName:    model.version_name || '',
                civitaiUrl,
                triggerWords:   Array.isArray(model.trained_words)   ? model.trained_words   : [],
                examplePrompts: Array.isArray(model.example_prompts) ? model.example_prompts : [],
                fileName:       model.name || '',
                filePath:       model.rel_path || '',
            };

            let wfNode = _nodeExists() ? app.graph.getNodeById(_workflowNodeId) : null;

            if (wfNode) {
                // Update existing node
                Object.assign(wfNode.properties, nodeProps);
                if (nodeProps.imageUrl !== wfNode._imgSrc) wfNode._loadImg?.(nodeProps.imageUrl);
                wfNode.title = nodeProps.modelName ? `CiviComfy — ${nodeProps.modelName}` : 'CiviComfy Model Info';
                app.graph.setDirtyCanvas(true, true);
                ui.showToast('Workflow node updated!', 'success', 2000);
            } else {
                // Create new CiviComfyModelInfo node
                wfNode = LG.createNode('CiviComfyModelInfo');
                if (!wfNode) { ui.showToast('CiviComfyModelInfo node type not registered yet.', 'error'); return; }
                const cvs = app.canvas;
                let px = 100, py = 100;
                if (cvs && cvs.ds) {
                    px = -cvs.ds.offset[0] + cvs.canvas.width  / 2 / cvs.ds.scale - 260;
                    py = -cvs.ds.offset[1] + cvs.canvas.height / 2 / cvs.ds.scale - 130;
                }
                wfNode.pos  = [px, py];
                wfNode.size = [520, 260];
                wfNode.title = nodeProps.modelName ? `CiviComfy — ${nodeProps.modelName}` : 'CiviComfy Model Info';
                Object.assign(wfNode.properties, nodeProps);
                if (nodeProps.imageUrl) wfNode._loadImg?.(nodeProps.imageUrl);
                app.graph.add(wfNode);
                _workflowNodeId = wfNode.id;
                app.graph.setDirtyCanvas(true, true);
                ui.showToast('Model info added to workflow!', 'success', 2000);
            }

            sendToWfBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Workflow';
        } catch (err) {
            console.error('[Civicomfy] sendToWorkflow error:', err);
            ui.showToast('Failed to add to workflow.', 'error');
        }
    });

    footerRight.appendChild(sendToWfBtn);

    if (model.civitai_model_id) {
        const civitBtn = document.createElement('a');
        civitBtn.href = `${CIVITAI_BASE}${model.civitai_model_id}`;
        civitBtn.target = '_blank';
        civitBtn.rel = 'noopener noreferrer';
        civitBtn.className = 'civitai-button primary small';
        civitBtn.innerHTML = '<i class="fas fa-external-link-alt"></i> Open on Civitai';
        footerRight.appendChild(civitBtn);
    }

    footerBar.appendChild(footerLeft);
    footerBar.appendChild(footerRight);

    // ── ASSEMBLE ─────────────────────────────────────────────────────────────
    panel.appendChild(header);
    if (metaItems.length > 0) panel.appendChild(metaBar);
    panel.appendChild(body);
    panel.appendChild(footerBar);
    overlay.appendChild(panel);

    // Close on Escape key
    const onEsc = (e) => {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onEsc); }
    };
    document.addEventListener('keydown', onEsc);

    // Close on backdrop click or close button
    const _close = () => { overlay.remove(); document.removeEventListener('keydown', onEsc); };
    closeBtn.addEventListener('click', _close);
    overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });

    ui.modal.appendChild(overlay);
}
export async function handleMyModelDelete(ui, relPath, name, btn) {
    if (!confirm(`Delete "${name}"?\n\nThis will permanently remove the file from disk.`)) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        await CivitaiDownloaderAPI.deleteModel(relPath);
        ui.showToast(`Deleted: ${name}`, 'success', 3000);
        if (ui._myModelsAll) {
            ui._myModelsAll = ui._myModelsAll.filter(m => m.rel_path !== relPath);
        }
        renderMyModels(ui);
    } catch (err) {
        ui.showToast(err.details || err.message || 'Failed to delete model.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
    }
}
