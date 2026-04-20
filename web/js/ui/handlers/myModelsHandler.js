import { CivitaiDownloaderAPI } from "../../api/civitai.js";

const CIVITAI_BASE = 'https://civitai.com/models/';

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
 * Re-render the model list applying current name/type filter.
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

    if (countEl) {
        countEl.textContent = `${filtered.length} model${filtered.length !== 1 ? 's' : ''}${all.length !== filtered.length ? ` (of ${all.length})` : ''}`;
    }

    if (filtered.length === 0) {
        listEl.innerHTML = '<p>No models found.</p>';
        return;
    }

    listEl.innerHTML = '';
    filtered.forEach(model => {
        listEl.appendChild(_buildModelRow(model));
    });
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

    // Type badge
    if (model.model_type) {
        const badge = document.createElement('div');
        badge.className = 'civitai-mymodel-card-badge';
        badge.textContent = model.model_type;
        previewWrap.appendChild(badge);
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

    const meta = document.createElement('span');
    meta.className = 'civitai-mymodel-meta';
    const sizeMB = model.size_bytes > 0 ? (model.size_bytes / 1024 / 1024).toFixed(1) + ' MB' : '';
    const dateStr = model.modified ? new Date(model.modified * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    const parts = [
        model.version_name,
        model.base_model,
        sizeMB ? `<i class="fas fa-hdd" style="opacity:.6;"></i> ${sizeMB}` : '',
        dateStr ? `<i class="fas fa-clock" style="opacity:.6;"></i> ${dateStr}` : '',
    ].filter(Boolean);
    meta.innerHTML = parts.join(' · ');

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

function _showDetailModal(ui, model) {
    // Remove any existing detail modal
    const existing = ui.modal.querySelector('#civitai-mymodel-detail-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'civitai-mymodel-detail-modal';
    overlay.className = 'civitai-mymodel-detail-overlay';

    const panel = document.createElement('div');
    panel.className = 'civitai-mymodel-detail-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'civitai-mymodel-detail-header';
    const title = document.createElement('h3');
    title.textContent = model.model_name || model.name;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'civitai-close-button';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => overlay.remove());
    header.appendChild(title);
    header.appendChild(closeBtn);

    // Body
    const body = document.createElement('div');
    body.className = 'civitai-mymodel-detail-body';

    // Left: preview
    const left = document.createElement('div');
    left.className = 'civitai-mymodel-detail-left';
    if (model.has_preview) {
        const img = document.createElement('img');
        img.src = `/civitai/model_preview_image?rel_path=${encodeURIComponent(model.rel_path)}`;
        img.alt = model.name;
        img.className = 'civitai-mymodel-detail-preview';
        img.onerror = () => img.remove();
        left.appendChild(img);
    }

    // Right: info fields
    const right = document.createElement('div');
    right.className = 'civitai-mymodel-detail-right';

    const fields = [
        ['File', model.name],
        ['Path', model.rel_path],
        ['Size', model.size_bytes > 0 ? (model.size_bytes / 1024 / 1024).toFixed(2) + ' MB' : ''],
        ['Model Type', model.model_type || model.model_type_civitai],
        ['Base Model', model.base_model],
        ['Version', model.version_name],
        ['Civitai Model ID', model.civitai_model_id],
        ['Civitai Version ID', model.civitai_version_id],
    ];

    const table = document.createElement('table');
    table.className = 'civitai-mymodel-detail-table';
    fields.forEach(([label, val]) => {
        if (!val && val !== 0) return;
        const tr = document.createElement('tr');
        const td1 = document.createElement('td');
        td1.className = 'detail-label';
        td1.textContent = label;
        const td2 = document.createElement('td');
        td2.textContent = String(val);
        tr.appendChild(td1);
        tr.appendChild(td2);
        table.appendChild(tr);
    });
    right.appendChild(table);

    // Trigger words
    if (Array.isArray(model.trained_words) && model.trained_words.length > 0) {
        const twLabel = document.createElement('div');
        twLabel.className = 'detail-section-title';
        twLabel.textContent = 'Trigger Words';
        const twWrap = document.createElement('div');
        twWrap.className = 'civitai-mymodel-detail-tags';
        model.trained_words.forEach(w => {
            const tag = document.createElement('span');
            tag.className = 'civitai-mymodel-tag';
            tag.textContent = w;
            tag.title = 'Click to copy';
            tag.addEventListener('click', () => {
                navigator.clipboard?.writeText(w).catch(() => {});
                ui.showToast(`Copied: ${w}`, 'success', 1500);
            });
            twWrap.appendChild(tag);
        });
        right.appendChild(twLabel);
        right.appendChild(twWrap);
    }

    // Description
    if (model.description) {
        const descLabel = document.createElement('div');
        descLabel.className = 'detail-section-title';
        descLabel.textContent = 'Description';
        const desc = document.createElement('div');
        desc.className = 'civitai-mymodel-detail-desc';
        // Strip HTML tags for safety
        const tmp = document.createElement('div');
        tmp.innerHTML = model.description;
        desc.textContent = tmp.textContent || tmp.innerText || '';
        right.appendChild(descLabel);
        right.appendChild(desc);
    }

    // Footer: Open on Civit link
    if (model.civitai_model_id) {
        const footer = document.createElement('div');
        footer.className = 'civitai-mymodel-detail-footer';
        const civitLink = document.createElement('a');
        civitLink.href = `${CIVITAI_BASE}${model.civitai_model_id}`;
        civitLink.target = '_blank';
        civitLink.rel = 'noopener noreferrer';
        civitLink.className = 'civitai-button primary small';
        civitLink.innerHTML = '<i class="fas fa-external-link-alt"></i> Open on Civitai';
        footer.appendChild(civitLink);
        right.appendChild(footer);
    }

    body.appendChild(left);
    body.appendChild(right);
    panel.appendChild(header);
    panel.appendChild(body);
    overlay.appendChild(panel);

    // Close on backdrop click
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    ui.modal.appendChild(overlay);
}

/**
 * Handle Delete button click with confirmation.
 */
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
