import { CivitaiDownloaderAPI } from "../../api/civitai.js";

// Returns true when the URL looks like a HuggingFace file link.
function isHuggingFaceUrl(input) {
    return /huggingface\.co\/.+\/(resolve|blob)\//i.test(input.trim());
}

// Format bytes into a human-readable string.
function formatBytes(bytes) {
    if (!bytes) return 'Unknown size';
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
    return (bytes / 1024).toFixed(1) + ' KB';
}

export function debounceFetchDownloadPreview(ui, delay = 500) {
    clearTimeout(ui.modelPreviewDebounceTimeout);
    ui.modelPreviewDebounceTimeout = setTimeout(() => {
        fetchAndDisplayDownloadPreview(ui);
    }, delay);
}

export async function fetchAndDisplayDownloadPreview(ui) {
    const modelUrlOrId = ui.modelUrlInput.value.trim();
    const versionId = ui.modelVersionIdInput.value.trim();

    if (!modelUrlOrId) {
        ui.downloadPreviewArea.innerHTML = '';
        return;
    }

    ui.downloadPreviewArea.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading model details...</p>';
    ui.ensureFontAwesome();

    // ---- HuggingFace branch ----
    if (isHuggingFaceUrl(modelUrlOrId)) {
        try {
            const result = await CivitaiDownloaderAPI.getModelDetailsHF({
                hf_url: modelUrlOrId,
                hf_token: ui.settings.hfToken || '',
            });
            if (result && result.success) {
                ui.downloadPreviewArea.innerHTML = `
                    <div style="display:flex;align-items:flex-start;gap:14px;">
                      <div style="flex-shrink:0;font-size:2em;color:var(--accent-color,#5c8aff);">
                        <i class="fas fa-database"></i>
                      </div>
                      <div>
                        <div style="font-weight:bold;font-size:1.05em;margin-bottom:4px;">
                          <i class="fas fa-cubes" style="margin-right:5px;color:#fbbf24;"></i>
                          ${result.repo_id}
                        </div>
                        <div style="color:#aaa;font-size:0.9em;margin-bottom:2px;">
                          Revision: <code>${result.revision}</code>
                        </div>
                        <div style="color:#ccc;font-size:0.9em;margin-bottom:2px;">
                          File: <code>${result.filepath}</code>
                        </div>
                        <div style="color:#ccc;font-size:0.9em;">
                          Size: <strong>${formatBytes(result.size)}</strong>
                        </div>
                      </div>
                    </div>`;
            } else {
                const message = result?.error || 'Unknown error from server';
                ui.downloadPreviewArea.innerHTML = `<p style="color:var(--error-text,#ff6b6b);">${message}</p>`;
            }
        } catch (error) {
            const message = `Error fetching HuggingFace details: ${error.details || error.message || 'Unknown error'}`;
            console.error("HF Preview Fetch Error:", error);
            ui.downloadPreviewArea.innerHTML = `<p style="color:var(--error-text,#ff6b6b);">${message}</p>`;
        }
        return;
    }

    // ---- Civitai branch (original) ----
    const params = {
        model_url_or_id: modelUrlOrId,
        model_version_id: versionId ? parseInt(versionId, 10) : null,
        api_key: ui.settings.apiKey
    };

    try {
        const result = await CivitaiDownloaderAPI.getModelDetails(params);
        if (result && result.success) {
            ui.renderDownloadPreview(result);
            // Auto-select model type save location based on Civitai model type
            if (result.model_type) {
                await ui.autoSelectModelTypeFromCivitai(result.model_type);
            }
        } else {
            const message = `Failed to get details: ${result.details || result.error || 'Unknown backend error'}`;
            ui.downloadPreviewArea.innerHTML = `<p style="color: var(--error-text, #ff6b6b);">${message}</p>`;
        }
    } catch (error) {
        const message = `Error fetching details: ${error.details || error.message || 'Unknown error'}`;
        console.error("Download Preview Fetch Error:", error);
        ui.downloadPreviewArea.innerHTML = `<p style="color: var(--error-text, #ff6b6b);">${message}</p>`;
    }
}

export async function handleDownloadSubmit(ui) {
    const modelUrlOrId = ui.modelUrlInput.value.trim();
    if (!modelUrlOrId) {
        ui.showToast("Model URL or ID cannot be empty.", "error");
        return;
    }

    // ---- Route HuggingFace URLs to the dedicated endpoint ----
    if (isHuggingFaceUrl(modelUrlOrId)) {
        await _handleHFDownloadSubmit(ui, modelUrlOrId);
        return;
    }

    // ---- Civitai (original flow) ----
    if (!ui.settings.apiKey) {
        ui.showToast("API key empty, please fill your API key in the settings", "error");
        ui.switchTab("settings");
        return;
    }

    ui.downloadSubmitButton.disabled = true;
    ui.downloadSubmitButton.textContent = 'Starting...';

    // Subfolder comes from dropdown; filename is base name only
    const selectedSubdir = ui.subdirSelect ? ui.subdirSelect.value.trim() : '';
    const userFilename = ui.customFilenameInput.value.trim();

    const params = {
        model_url_or_id: modelUrlOrId,
        model_type: ui.downloadModelTypeSelect.value,
        model_version_id: ui.modelVersionIdInput.value ? parseInt(ui.modelVersionIdInput.value, 10) : null,
        custom_filename: userFilename,
        subdir: selectedSubdir,
        num_connections: parseInt(ui.downloadConnectionsInput.value, 10),
        force_redownload: ui.forceRedownloadCheckbox.checked,
        api_key: ui.settings.apiKey
    };

    const fileSelectEl = ui.modal.querySelector('#civitai-file-select');
    if (fileSelectEl && fileSelectEl.value) {
        const fid = parseInt(fileSelectEl.value, 10);
        if (!Number.isNaN(fid)) params.file_id = fid;
    }

    try {
        const result = await CivitaiDownloaderAPI.downloadModel(params);

        if (result.status === 'queued') {
            ui.showToast(`Download queued: ${result.details?.filename || 'Model'}`, 'success');
            if (ui.settings.autoOpenStatusTab) {
                ui.switchTab('status');
            } else {
                ui.updateStatus();
            }
        } else if (result.status === 'exists' || result.status === 'exists_size_mismatch') {
            ui.showToast(`${result.message}`, 'info', 4000);
        } else {
            console.warn("Unexpected success response from /civitai/download:", result);
            ui.showToast(`Unexpected status: ${result.status} - ${result.message || ''}`, 'info');
        }
    } catch (error) {
        const message = `Download failed: ${error.details || error.message || 'Unknown error'}`;
        console.error("Download Submit Error:", error);
        ui.showToast(message, 'error', 6000);
    } finally {
        ui.downloadSubmitButton.disabled = false;
        ui.downloadSubmitButton.textContent = 'Start Download';
    }
}

async function _handleHFDownloadSubmit(ui, hfUrl) {
    ui.downloadSubmitButton.disabled = true;
    ui.downloadSubmitButton.textContent = 'Starting...';

    const selectedSubdir = ui.subdirSelect ? ui.subdirSelect.value.trim() : '';
    const userFilename = ui.customFilenameInput.value.trim();

    const params = {
        hf_url: hfUrl,
        model_type: ui.downloadModelTypeSelect.value,
        custom_filename: userFilename,
        subdir: selectedSubdir,
        num_connections: parseInt(ui.downloadConnectionsInput.value, 10),
        force_redownload: ui.forceRedownloadCheckbox.checked,
        hf_token: ui.settings.hfToken || '',
    };

    try {
        const result = await CivitaiDownloaderAPI.downloadModelHF(params);

        if (result.status === 'queued') {
            ui.showToast(`HuggingFace download queued: ${result.details?.filename || 'Model'}`, 'success');
            if (ui.settings.autoOpenStatusTab) {
                ui.switchTab('status');
            } else {
                ui.updateStatus();
            }
        } else if (result.status === 'exists' || result.status === 'exists_size_mismatch') {
            ui.showToast(result.message, 'info', 4000);
        } else {
            console.warn("Unexpected HF download response:", result);
            ui.showToast(`Unexpected status: ${result.status} - ${result.message || ''}`, 'info');
        }
    } catch (error) {
        const message = `HuggingFace download failed: ${error.details || error.message || 'Unknown error'}`;
        console.error("HF Download Submit Error:", error);
        ui.showToast(message, 'error', 6000);
    } finally {
        ui.downloadSubmitButton.disabled = false;
        ui.downloadSubmitButton.textContent = 'Start Download';
    }
}

