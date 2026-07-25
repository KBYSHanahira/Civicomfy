import { setCookie, getCookie } from "../../utils/cookies.js";
import { CivitaiDownloaderAPI } from "../../api/civitai.js";

const SETTINGS_COOKIE_NAME = 'civitaiDownloaderSettings';
const THEME_COOKIE_NAME = 'civicomfyTheme';

const ALLOWED_CIVITAI_DOMAINS = ['civitai.com', 'civitai.red'];

export function getDefaultSettings() {
    return {
        apiKey: '',
        hfToken: '',
        numConnections: 1,
        defaultModelType: 'checkpoint',
        autoOpenStatusTab: true,
        deepSubfolderCheck: false,
        hideMatureInSearch: true,
        nsfwBlurMinLevel: 4, // Blur thumbnails with nsfwLevel >= this value
        civitaiDomain: 'civitai.com',
    };
}

// --- Theme preference (stored separately so it applies instantly, without
// requiring the user to press "Save settings") ---
export function loadThemePreference() {
    try {
        return getCookie(THEME_COOKIE_NAME) === 'light' ? 'light' : 'dark';
    } catch (e) {
        return 'dark';
    }
}

export function saveThemePreference(theme) {
    try {
        setCookie(THEME_COOKIE_NAME, theme === 'light' ? 'light' : 'dark', 365);
    } catch (e) {
        console.error('[Civicomfy] Failed to save theme preference:', e);
    }
}

export function getCivitaiDomain() {
    try {
        const cookieValue = getCookie(SETTINGS_COOKIE_NAME);
        if (cookieValue) {
            const loaded = JSON.parse(cookieValue);
            if (loaded && ALLOWED_CIVITAI_DOMAINS.includes(loaded.civitaiDomain)) {
                return loaded.civitaiDomain;
            }
        }
    } catch (e) { /* ignore */ }
    return 'civitai.com';
}

export function buildCivitaiModelUrl(modelId, versionId) {
    const domain = getCivitaiDomain();
    return `https://${domain}/models/${modelId}${versionId ? '?modelVersionId=' + versionId : ''}`;
}

export function loadAndApplySettings(ui) {
    ui.settings = ui.loadSettingsFromCookie();
    ui.applySettings();
}

export function loadSettingsFromCookie(ui) {
    const defaults = ui.getDefaultSettings();
    const cookieValue = getCookie(SETTINGS_COOKIE_NAME);

    if (cookieValue) {
        try {
            const loadedSettings = JSON.parse(cookieValue);
            return { ...defaults, ...loadedSettings };
        } catch (e) {
            console.error("Failed to parse settings cookie:", e);
            return defaults;
        }
    }
    return defaults;
}

export function saveSettingsToCookie(ui) {
    try {
        const settingsString = JSON.stringify(ui.settings);
        setCookie(SETTINGS_COOKIE_NAME, settingsString, 365);
        ui.showToast('Settings saved successfully!', 'success');
    } catch (e) {
        console.error("Failed to save settings to cookie:", e);
        ui.showToast('Error saving settings', 'error');
    }
}

export function applySettings(ui) {
    if (ui.settingsApiKeyInput) {
        ui.settingsApiKeyInput.value = ui.settings.apiKey || '';
    }
    if (ui.settingsHfTokenInput) {
        ui.settingsHfTokenInput.value = ui.settings.hfToken || '';
    }
    if (ui.settingsConnectionsInput) {
        ui.settingsConnectionsInput.value = Math.max(1, Math.min(16, ui.settings.numConnections || 1));
    }
    if (ui.settingsDefaultTypeSelect) {
        ui.settingsDefaultTypeSelect.value = ui.settings.defaultModelType || 'checkpoint';
    }
    if (ui.settingsAutoOpenCheckbox) {
        ui.settingsAutoOpenCheckbox.checked = ui.settings.autoOpenStatusTab === true;
    }
    if (ui.settingsDeepSubfolderCheck) {
        ui.settingsDeepSubfolderCheck.checked = ui.settings.deepSubfolderCheck === true;
    }
    if (ui.settingsHideMatureCheckbox) {
        ui.settingsHideMatureCheckbox.checked = ui.settings.hideMatureInSearch === true;
    }
    if (ui.settingsNsfwThresholdInput) {
        const val = Number(ui.settings.nsfwBlurMinLevel);
        const target = Number.isFinite(val) ? val : 4;
        // Snap to the nearest available dropdown option so the control always
        // reflects the saved value, even if it predates the dropdown's set.
        const options = Array.from(ui.settingsNsfwThresholdInput.options).map(o => Number(o.value));
        const snapped = options.reduce(
            (best, cur) => (Math.abs(cur - target) < Math.abs(best - target) ? cur : best),
            options[0] ?? 4
        );
        ui.settingsNsfwThresholdInput.value = String(snapped);
    }
    if (ui.settingsCivitaiDomainSelect) {
        const dom = ALLOWED_CIVITAI_DOMAINS.includes(ui.settings.civitaiDomain) ? ui.settings.civitaiDomain : 'civitai.com';
        ui.settingsCivitaiDomainSelect.value = dom;
    }
    if (ui.downloadConnectionsInput) {
        ui.downloadConnectionsInput.value = Math.max(1, Math.min(16, ui.settings.numConnections || 1));
    }
    // Seed the download form's model type with the default ONCE, on first load.
    // After that we must not clobber whatever the user manually picked, otherwise
    // re-applying settings (e.g. visiting the Settings tab to set an HF token)
    // would silently reset their chosen save location back to the default.
    if (ui.downloadModelTypeSelect && Object.keys(ui.modelTypes).length > 0 && !ui._downloadTypeInitialized) {
        ui.downloadModelTypeSelect.value = ui.settings.defaultModelType || 'checkpoint';
        ui._downloadTypeInitialized = true;
    }
}

export function handleSettingsSave(ui) {
    // Guard every element access: if the settings form was not fully rendered,
    // fall back to the current persisted value instead of crashing.
    const apiKey = ui.settingsApiKeyInput ? ui.settingsApiKeyInput.value.trim() : (ui.settings.apiKey || '');
    const hfToken = ui.settingsHfTokenInput ? ui.settingsHfTokenInput.value.trim() : (ui.settings.hfToken || '');
    const numConnections = ui.settingsConnectionsInput
        ? parseInt(ui.settingsConnectionsInput.value, 10)
        : (ui.settings.numConnections || 1);
    const defaultModelType = ui.settingsDefaultTypeSelect
        ? ui.settingsDefaultTypeSelect.value
        : (ui.settings.defaultModelType || 'checkpoint');
    const autoOpenStatusTab = ui.settingsAutoOpenCheckbox ? ui.settingsAutoOpenCheckbox.checked : !!ui.settings.autoOpenStatusTab;
    const deepSubfolderCheck = ui.settingsDeepSubfolderCheck ? ui.settingsDeepSubfolderCheck.checked : !!ui.settings.deepSubfolderCheck;
    const hideMatureInSearch = ui.settingsHideMatureCheckbox ? ui.settingsHideMatureCheckbox.checked : !!ui.settings.hideMatureInSearch;
    const nsfwBlurMinLevel = ui.settingsNsfwThresholdInput ? Number(ui.settingsNsfwThresholdInput.value) : Number(ui.settings.nsfwBlurMinLevel);
    const civitaiDomain = ui.settingsCivitaiDomainSelect && ALLOWED_CIVITAI_DOMAINS.includes(ui.settingsCivitaiDomainSelect.value)
        ? ui.settingsCivitaiDomainSelect.value
        : 'civitai.com';

    if (isNaN(numConnections) || numConnections < 1 || numConnections > 16) {
        ui.showToast("Invalid Default Connections (must be 1-16).", "error");
        return;
    }
    if (ui.settingsDefaultTypeSelect && !ui.settingsDefaultTypeSelect.querySelector(`option[value="${defaultModelType}"]`)) {
        ui.showToast("Invalid Default Model Type selected.", "error");
        return;
    }

    ui.settings.apiKey = apiKey;
    ui.settings.hfToken = hfToken;
    ui.settings.numConnections = numConnections;
    ui.settings.defaultModelType = defaultModelType;
    ui.settings.autoOpenStatusTab = autoOpenStatusTab;
    ui.settings.deepSubfolderCheck = deepSubfolderCheck;
    ui.settings.hideMatureInSearch = hideMatureInSearch;
    ui.settings.nsfwBlurMinLevel = (Number.isFinite(nsfwBlurMinLevel) && nsfwBlurMinLevel >= 0) ? Math.min(128, Math.round(nsfwBlurMinLevel)) : 4;
    ui.settings.civitaiDomain = civitaiDomain;

    ui.saveSettingsToCookie();
    // Changing the default model type here is an explicit user action, so reflect
    // it on the download form immediately (applySettings only seeds it once).
    if (ui.downloadModelTypeSelect && ui.downloadModelTypeSelect.querySelector(`option[value="${defaultModelType}"]`)) {
        ui.downloadModelTypeSelect.value = defaultModelType;
    }
    ui.applySettings();
}

// --- Directory Settings (server-persisted per-model-type save folders) ---

export async function loadDirectorySettings(ui, force = false) {
    const listEl = ui.dirSettingsList;
    if (!listEl) return;
    if (ui._dirSettingsLoaded && !force) return;

    listEl.innerHTML = '<p class="civitai-field-hint"><i class="fas fa-spinner fa-spin"></i> Loading directories...</p>';
    try {
        const result = await CivitaiDownloaderAPI.getDirectorySettings();
        const items = (result && Array.isArray(result.items)) ? result.items : [];
        renderDirectorySettings(ui, items);
        ui._dirSettingsLoaded = true;
    } catch (e) {
        console.error('[Civicomfy] Failed to load directory settings:', e);
        listEl.innerHTML = '';
        const err = document.createElement('p');
        err.className = 'civitai-field-hint';
        err.style.color = 'var(--cfy-danger-text)';
        err.textContent = `Failed to load directories: ${e.details || e.message || 'Unknown error'}`;
        listEl.appendChild(err);
    }
}

function renderDirectorySettings(ui, items) {
    const listEl = ui.dirSettingsList;
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'civitai-field-hint';
        empty.textContent = 'No model directories found.';
        listEl.appendChild(empty);
        return;
    }

    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'civitai-dir-row';

        const label = document.createElement('label');
        label.className = 'civitai-dir-row-label';
        label.textContent = item.display || item.key;
        label.title = `Folder key: ${item.key}`;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'civitai-input civitai-dir-row-input';
        input.dataset.key = item.key;
        input.value = item.override || '';
        input.placeholder = item.default_dir || '(default)';
        input.spellcheck = false;
        input.autocomplete = 'off';

        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'civitai-button small secondary civitai-dir-row-reset';
        reset.title = 'Clear (use default)';
        reset.innerHTML = '<i class="fas fa-undo"></i>';
        reset.addEventListener('click', () => { input.value = ''; });

        row.append(label, input, reset);
        listEl.appendChild(row);
    });
}

export async function saveDirectorySettings(ui) {
    const listEl = ui.dirSettingsList;
    if (!listEl) return;

    const overrides = {};
    listEl.querySelectorAll('input.civitai-dir-row-input').forEach(input => {
        const key = input.dataset.key;
        if (key) overrides[key] = input.value.trim();
    });

    const btn = ui.dirSaveBtn;
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }

    try {
        const result = await CivitaiDownloaderAPI.saveDirectorySettings(overrides);
        if (result && result.success) {
            const warnings = Array.isArray(result.warnings) ? result.warnings : [];
            if (warnings.length) {
                ui.showToast(`Saved with warnings: ${warnings.join('; ')}`, 'warning', 7000);
            } else {
                ui.showToast('Directory settings saved!', 'success');
            }
            // Re-fetch so inputs reflect the normalized (absolute) saved paths.
            await loadDirectorySettings(ui, true);
        } else {
            ui.showToast(`Failed to save directories: ${result?.error || 'Unknown error'}`, 'error', 6000);
        }
    } catch (e) {
        console.error('[Civicomfy] Failed to save directory settings:', e);
        ui.showToast(`Failed to save directories: ${e.details || e.message || 'Unknown error'}`, 'error', 6000);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
    }
}

// --- Browse Tab Persistence ---
const BROWSE_SETTINGS_COOKIE = 'civitaiBrowseSettings';

export function saveBrowseSettings(ui) {
    try {
        const data = {
            sort: ui.browseSortSelect?.value || 'Most Downloaded',
            activeType: ui.browseTypeSelect?.value || 'all',
            baseModels: ui.getBrowseSelectedBaseModels(),
            searchQuery: ui.browseSearchInput?.value?.trim() || '',
            searchMode: ui.browseSearchModeSelect?.value || 'all',
            limit: ui.browsePagination?.limit || 25,
            cardSize: parseInt(ui.browseCardSizeSlider?.value, 10) || 158,
        };
        setCookie(BROWSE_SETTINGS_COOKIE, JSON.stringify(data), 365);
    } catch (e) {
        console.error('[Civicomfy] Failed to save browse settings:', e);
    }
}

export function loadBrowseSettings(ui) {
    try {
        const cookieValue = getCookie(BROWSE_SETTINGS_COOKIE);
        if (!cookieValue) return;
        const data = JSON.parse(cookieValue);

        if (data.sort && ui.browseSortSelect) {
            ui.browseSortSelect.value = data.sort;
        }
        if (data.activeType && ui.browseTypeSelect) {
            ui.browseActiveType = data.activeType;
            // browseTypeSelect options may not be populated yet; store for later
            ui._savedBrowseActiveType = data.activeType;
            if (ui.browseTypeSelect.querySelector(`option[value="${data.activeType}"]`)) {
                ui.browseTypeSelect.value = data.activeType;
            }
        }
        if (Array.isArray(data.baseModels) && data.baseModels.length > 0 && ui.browseBaseModelPickerOptions) {
            ui.browseBaseModelPickerOptions.querySelectorAll('input[type=checkbox]').forEach(cb => {
                cb.checked = data.baseModels.includes(cb.value);
            });
            ui.updateBrowseBaseModelLabel();
        }
        if (data.searchQuery && ui.browseSearchInput) {
            ui.browseSearchInput.value = data.searchQuery;
        }
        if (data.searchMode && ui.browseSearchModeSelect) {
            ui.browseSearchModeSelect.value = data.searchMode;
            const placeholders = { all: 'Search models...', name: 'Search by model name...', username: 'Search by username...' };
            if (ui.browseSearchInput) ui.browseSearchInput.placeholder = placeholders[data.searchMode] || 'Search models...';
        }
        if (data.limit && ui.browseLimitSelect) {
            const validLimits = ['25', '50', '75', '100'];
            const limitStr = String(data.limit);
            if (validLimits.includes(limitStr)) {
                ui.browseLimitSelect.value = limitStr;
                ui.browsePagination.limit = data.limit;
            }
        }
        if (data.cardSize && ui.browseCardSizeSlider) {
            const val = Math.max(120, Math.min(280, Math.round(data.cardSize / 10) * 10));
            ui.browseCardSizeSlider.value = val;
            if (ui.modal) ui.modal.style.setProperty('--cfy-browse-card-min-w', `${val}px`);
        }

    } catch (e) {
        console.error('[Civicomfy] Failed to load browse settings:', e);
    }
}

// --- My Models Tab Persistence ---
const MYMODELS_SETTINGS_COOKIE = 'civitaiMyModelsSettings';

export function saveMyModelsSettings(ui) {
    try {
        const data = {
            sort: ui.myModelsSortSelect?.value || 'time_desc',
            typeFilter: ui.myModelsTypeFilter?.value || '',
            limit: ui.myModelsPagination?.limit || 50,
            cardSize: parseInt(ui.myModelsCardSizeSlider?.value, 10) || 148,
        };
        setCookie(MYMODELS_SETTINGS_COOKIE, JSON.stringify(data), 365);
    } catch (e) {
        console.error('[Civicomfy] Failed to save My Models settings:', e);
    }
}

export function loadMyModelsSettings(ui) {
    try {
        const cookieValue = getCookie(MYMODELS_SETTINGS_COOKIE);
        if (!cookieValue) return;
        const data = JSON.parse(cookieValue);

        if (data.sort && ui.myModelsSortSelect) {
            ui.myModelsSortSelect.value = data.sort;
        }
        // Store saved typeFilter so handleMyModelsLoad can restore it after populating options
        if (data.typeFilter !== undefined) {
            ui._savedMyModelsTypeFilter = data.typeFilter;
        }
        if (data.limit && ui.myModelsLimitSelect) {
            const validLimits = ['25', '50', '75', '100'];
            const limitStr = String(data.limit);
            if (validLimits.includes(limitStr)) {
                ui.myModelsLimitSelect.value = limitStr;
                if (ui.myModelsPagination) ui.myModelsPagination.limit = data.limit;
            }
        }
        if (data.cardSize && ui.myModelsCardSizeSlider) {
            const val = Math.max(100, Math.min(260, Math.round(data.cardSize / 10) * 10));
            ui.myModelsCardSizeSlider.value = val;
            if (ui.modal) ui.modal.style.setProperty('--cfy-mymodels-card-min-w', `${val}px`);
        }
    } catch (e) {
        console.error('[Civicomfy] Failed to load My Models settings:', e);
    }
}
