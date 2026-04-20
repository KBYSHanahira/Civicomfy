import { setCookie, getCookie } from "../../utils/cookies.js";

const SETTINGS_COOKIE_NAME = 'civitaiDownloaderSettings';

export function getDefaultSettings() {
    return {
        apiKey: '',
        hfToken: '',
        numConnections: 1,
        defaultModelType: 'checkpoint',
        autoOpenStatusTab: true,
        hideMatureInSearch: true,
        nsfwBlurMinLevel: 4, // Blur thumbnails with nsfwLevel >= this value
    };
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
    if (ui.settingsHideMatureCheckbox) {
        ui.settingsHideMatureCheckbox.checked = ui.settings.hideMatureInSearch === true;
    }
    if (ui.settingsNsfwThresholdInput) {
        const val = Number(ui.settings.nsfwBlurMinLevel);
        ui.settingsNsfwThresholdInput.value = Number.isFinite(val) ? val : 4;
    }
    if (ui.downloadConnectionsInput) {
        ui.downloadConnectionsInput.value = Math.max(1, Math.min(16, ui.settings.numConnections || 1));
    }
    if (ui.downloadModelTypeSelect && Object.keys(ui.modelTypes).length > 0) {
        ui.downloadModelTypeSelect.value = ui.settings.defaultModelType || 'checkpoint';
    }
}

export function handleSettingsSave(ui) {
    const apiKey = ui.settingsApiKeyInput.value.trim();
    const hfToken = ui.settingsHfTokenInput ? ui.settingsHfTokenInput.value.trim() : '';
    const numConnections = parseInt(ui.settingsConnectionsInput.value, 10);
    const defaultModelType = ui.settingsDefaultTypeSelect.value;
    const autoOpenStatusTab = ui.settingsAutoOpenCheckbox.checked;
    const hideMatureInSearch = ui.settingsHideMatureCheckbox.checked;
    const nsfwBlurMinLevel = Number(ui.settingsNsfwThresholdInput.value);

    if (isNaN(numConnections) || numConnections < 1 || numConnections > 16) {
        ui.showToast("Invalid Default Connections (must be 1-16).", "error");
        return;
    }
    if (!ui.settingsDefaultTypeSelect.querySelector(`option[value="${defaultModelType}"]`)) {
        ui.showToast("Invalid Default Model Type selected.", "error");
        return;
    }

    ui.settings.apiKey = apiKey;
    ui.settings.hfToken = hfToken;
    ui.settings.numConnections = numConnections;
    ui.settings.defaultModelType = defaultModelType;
    ui.settings.autoOpenStatusTab = autoOpenStatusTab;
    ui.settings.hideMatureInSearch = hideMatureInSearch;
    ui.settings.nsfwBlurMinLevel = (Number.isFinite(nsfwBlurMinLevel) && nsfwBlurMinLevel >= 0) ? Math.min(128, Math.round(nsfwBlurMinLevel)) : 4;

    ui.saveSettingsToCookie();
    ui.applySettings();
}

// --- Browse Tab Persistence ---
const BROWSE_SETTINGS_COOKIE = 'civitaiBrowseSettings';

export function saveBrowseSettings(ui) {
    try {
        const data = {
            sort: ui.browseSortSelect?.value || 'Most Downloaded',
            activeType: ui.browseActiveType || 'all',
            baseModels: ui.getBrowseSelectedBaseModels(),
            searchQuery: ui.browseSearchInput?.value?.trim() || '',
            limit: ui.browsePagination?.limit || 25,
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
        if (data.activeType && ui.browseTypeTabsContainer) {
            ui.browseActiveType = data.activeType;
            ui.browseTypeTabsContainer.querySelectorAll('.civitai-browse-type-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.type === data.activeType);
            });
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
        if (data.limit && ui.browseLimitSelect) {
            const validLimits = ['25', '50', '75', '100'];
            const limitStr = String(data.limit);
            if (validLimits.includes(limitStr)) {
                ui.browseLimitSelect.value = limitStr;
                ui.browsePagination.limit = data.limit;
            }
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
    } catch (e) {
        console.error('[Civicomfy] Failed to load My Models settings:', e);
    }
}
