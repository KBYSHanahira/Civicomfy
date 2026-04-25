import { Feedback } from "./feedback.js";
import { setupEventListeners } from "./handlers/eventListeners.js";
import { handleDownloadSubmit, fetchAndDisplayDownloadPreview, debounceFetchDownloadPreview } from "./handlers/downloadHandler.js";
import { handleBrowseLoad } from "./handlers/browseHandler.js";
import { handleSettingsSave, loadAndApplySettings, loadSettingsFromCookie, saveSettingsToCookie, applySettings, getDefaultSettings, saveBrowseSettings, loadBrowseSettings, saveMyModelsSettings, loadMyModelsSettings } from "./handlers/settingsHandler.js";
import { startStatusUpdates, stopStatusUpdates, updateStatus, handleCancelDownload, handleRetryDownload, handleOpenPath, handleClearHistory } from "./handlers/statusHandler.js";
import { handleMyModelsLoad, renderMyModels, handleMyModelOpenOnCivit, handleMyModelViewDetail, handleMyModelDelete } from "./handlers/myModelsHandler.js";
import { handleGalleryLoad, renderGalleryGrid, openGalleryLightbox, closeGalleryLightbox, lightboxPrev, lightboxNext, toggleGallerySelect, updateGallerySelectionBar, deleteSelectedGallery, downloadSelectedGallery, deleteGalleryImage } from "./handlers/galleryHandler.js";
import { renderDownloadList } from "./statusRenderer.js";
import { renderSearchResults, renderBrowseCards, showBrowseCardInfo } from "./searchRenderer.js";
import { renderDownloadPreview } from "./previewRenderer.js";
import { modalTemplate } from "./templates.js";
import { CivitaiDownloaderAPI } from "../api/civitai.js";

export class CivitaiDownloaderUI {
    constructor() {
        this.modal = null;
        this.tabs = {};
        this.tabContents = {};
        this.activeTab = 'download';
        this.modelTypes = {};
        this.statusInterval = null;
        this.statusData = { queue: [], active: [], history: [] };
        this.baseModels = [];
        this.browsePagination = { currentPage: 1, totalPages: 1, limit: 25 };
        this.searchPagination = { currentPage: 1, totalPages: 1, limit: 25 };
        this.myModelsPagination = { currentPage: 1, limit: 50 };
        this.browseActiveType = 'all';
        this.browseLoaded = false;
        this.settings = this.getDefaultSettings();
        this.toastTimeout = null;
        this.modelPreviewDebounceTimeout = null;
        this._myModelsAll = [];
        this._myModelsLoaded = false;
        this._galleryImages = [];
        this._galleryPage = 1;
        this._galleryLoaded = false;
        this._lightboxIndex = 0;
        this._gallerySelected = new Set();

        this.updateStatus();
        this.buildModalHTML();
        this.cacheDOMElements();
        this.setupEventListeners();
        this.feedback = new Feedback(this.modal.querySelector('#civitai-toast'));
        // Ensure icon stylesheet is loaded so buttons render icons immediately
        this.ensureFontAwesome();
    }

    // --- Core UI Methods ---
    buildModalHTML() {
        this.modal = document.createElement('div');
        this.modal.className = 'civitai-downloader-modal';
        this.modal.id = 'civitai-downloader-modal';
        this.modal.innerHTML = modalTemplate(this.settings);
    }

    cacheDOMElements() {
        this.closeButton = this.modal.querySelector('#civitai-close-modal');
        this.fullscreenButton = this.modal.querySelector('#civitai-fullscreen-toggle');
        this.tabContainer = this.modal.querySelector('.civitai-downloader-tabs');

        // Download Tab
        this.downloadForm = this.modal.querySelector('#civitai-download-form');
        this.downloadPreviewArea = this.modal.querySelector('#civitai-download-preview-area');
        this.modelUrlInput = this.modal.querySelector('#civitai-model-url');
        this.modelVersionIdInput = this.modal.querySelector('#civitai-model-version-id');
        this.downloadModelTypeSelect = this.modal.querySelector('#civitai-model-type');
        this.createModelTypeButton = this.modal.querySelector('#civitai-create-model-type');
        this.customFilenameInput = this.modal.querySelector('#civitai-custom-filename');
        this.subdirSelect = this.modal.querySelector('#civitai-subdir-select');
        this.createSubdirButton = this.modal.querySelector('#civitai-create-subdir');
        this.downloadConnectionsInput = this.modal.querySelector('#civitai-connections');
        this.forceRedownloadCheckbox = this.modal.querySelector('#civitai-force-redownload');
        this.downloadSubmitButton = this.modal.querySelector('#civitai-download-submit');

        // Browse Tab
        this.browseTypeSelect = this.modal.querySelector('#civitai-browse-type-select');
        this.browseSearchModeSelect = this.modal.querySelector('#civitai-browse-search-mode');
        this.browseSearchInput = this.modal.querySelector('#civitai-browse-search');
        this.browseSortSelect = this.modal.querySelector('#civitai-browse-sort');
        this.browseLimitSelect = this.modal.querySelector('#civitai-browse-limit');
        this.browseBaseModelPickerToggle = this.modal.querySelector('#civitai-browse-base-model-toggle');
        this.browseBaseModelPickerDropdown = this.modal.querySelector('#civitai-browse-base-model-dropdown');
        this.browseBaseModelPickerOptions = this.modal.querySelector('#civitai-browse-base-model-options');
        this.browseBaseModelPickerLabel = this.modal.querySelector('#civitai-browse-base-model-label');
        this.browseBaseModelPickerSearch = this.modal.querySelector('#civitai-browse-base-model-search');
        this.browseBaseModelClearButton = this.modal.querySelector('#civitai-browse-base-model-clear');
        this.browseRefreshButton = this.modal.querySelector('#civitai-browse-refresh');
        this.browseCardSizeSlider = this.modal.querySelector('#civitai-browse-card-size');
        this.browseResultsContainer = this.modal.querySelector('#civitai-browse-results');
        this.browsePaginationContainer = this.modal.querySelector('#civitai-browse-pagination');
        this.browseSelectedBar = this.modal.querySelector('#civitai-browse-selected-bar');
        this.browseSelectedText = this.modal.querySelector('#civitai-browse-selected-text');

        // Status Tab
        this.statusContent = this.modal.querySelector('#civitai-status-content');
        this.activeListContainer = this.modal.querySelector('#civitai-active-list');
        this.queuedListContainer = this.modal.querySelector('#civitai-queued-list');
        this.historyListContainer = this.modal.querySelector('#civitai-history-list');
        this.statusIndicator = this.modal.querySelector('#civitai-status-indicator');
        this.activeCountSpan = this.modal.querySelector('#civitai-active-count');
        this.clearHistoryButton = this.modal.querySelector('#civitai-clear-history-button');
        this.confirmClearModal = this.modal.querySelector('#civitai-confirm-clear-modal');
        this.confirmClearYesButton = this.modal.querySelector('#civitai-confirm-clear-yes');
        this.confirmClearNoButton = this.modal.querySelector('#civitai-confirm-clear-no');

        // Settings Tab
        this.settingsForm = this.modal.querySelector('#civitai-settings-form');
        this.settingsApiKeyInput = this.modal.querySelector('#civitai-settings-api-key');
        this.settingsHfTokenInput = this.modal.querySelector('#civitai-settings-hf-token');
        this.settingsConnectionsInput = this.modal.querySelector('#civitai-settings-connections');
        this.settingsDefaultTypeSelect = this.modal.querySelector('#civitai-settings-default-type');
        this.settingsAutoOpenCheckbox = this.modal.querySelector('#civitai-settings-auto-open-status');
        this.settingsHideMatureCheckbox = this.modal.querySelector('#civitai-settings-hide-mature');
        this.settingsNsfwThresholdInput = this.modal.querySelector('#civitai-settings-nsfw-threshold');
        this.settingsSaveButton = this.modal.querySelector('#civitai-settings-save');

        // Settings – Model Maintenance
        this.maintenanceTypePicker = this.modal.querySelector('#civitai-maintenance-type-picker');
        this.maintenanceAllCheckbox = this.modal.querySelector('#civitai-maint-all');
        this.maintenanceForceThumbCheckbox = this.modal.querySelector('#civitai-maint-force-thumb');
        this.refreshModelInfoBtn = this.modal.querySelector('#civitai-refresh-model-info-btn');
        this.updateThumbnailsBtn = this.modal.querySelector('#civitai-update-thumbnails-btn');
        this.maintenanceResultEl = this.modal.querySelector('#civitai-maintenance-result');
        this.maintenanceControlsEl = this.modal.querySelector('#civitai-maintenance-controls');
        this.maintenanceStopBtn = this.modal.querySelector('#civitai-maint-stop-btn');
        this.maintenanceSkipBtn = this.modal.querySelector('#civitai-maint-skip-btn');

        // My Models Tab
        this.myModelsTypeFilter = this.modal.querySelector('#civitai-mymodels-type-filter');
        this.myModelsSearchInput = this.modal.querySelector('#civitai-mymodels-search');
        this.myModelsSortSelect = this.modal.querySelector('#civitai-mymodels-sort');
        this.myModelsLimitSelect = this.modal.querySelector('#civitai-mymodels-limit');
        this.myModelsRefreshButton = this.modal.querySelector('#civitai-mymodels-refresh');
        this.myModelsCardSizeSlider = this.modal.querySelector('#civitai-mymodels-card-size');
        this.myModelsListContainer = this.modal.querySelector('#civitai-mymodels-list');
        this.myModelsPaginationContainer = this.modal.querySelector('#civitai-mymodels-pagination');
        this.myModelsCountEl = this.modal.querySelector('#civitai-mymodels-count');

        // Gallery Tab
        this.gallerySubfolderSelect = this.modal.querySelector('#civitai-gallery-subfolder');
        this.gallerySortSelect = this.modal.querySelector('#civitai-gallery-sort');
        this.galleryLimitSelect = this.modal.querySelector('#civitai-gallery-limit');
        this.galleryCardSizeSlider = this.modal.querySelector('#civitai-gallery-card-size');
        this.galleryRefreshButton = this.modal.querySelector('#civitai-gallery-refresh');
        this.galleryGrid = this.modal.querySelector('#civitai-gallery-grid');
        this.galleryPaginationContainer = this.modal.querySelector('#civitai-gallery-pagination');
        this.galleryCountEl = this.modal.querySelector('#civitai-gallery-count');
        this.gallerySelectBar = this.modal.querySelector('#civitai-gallery-select-bar');
        this.gallerySelectCount = this.modal.querySelector('#civitai-gallery-select-count');
        this.gallerySelectAllBtn = this.modal.querySelector('#civitai-gallery-select-all');
        this.galleryDeselectAllBtn = this.modal.querySelector('#civitai-gallery-deselect-all');
        this.galleryDownloadSelectedBtn = this.modal.querySelector('#civitai-gallery-download-selected');
        this.galleryDeleteSelectedBtn = this.modal.querySelector('#civitai-gallery-delete-selected');
        this.galleryLightbox = this.modal.querySelector('#civitai-gallery-lightbox');
        this.galleryLightboxImg = this.modal.querySelector('#civitai-gallery-lightbox-img');
        this.galleryLightboxName = this.modal.querySelector('#civitai-gallery-lightbox-name');
        this.galleryLightboxMeta = this.modal.querySelector('#civitai-gallery-lightbox-meta');
        this.galleryLightboxClose = this.modal.querySelector('#civitai-gallery-lightbox-close');
        this.galleryLightboxPrev = this.modal.querySelector('#civitai-gallery-lightbox-prev');
        this.galleryLightboxNext = this.modal.querySelector('#civitai-gallery-lightbox-next');

        // Toast Notification
        this.toastElement = this.modal.querySelector('#civitai-toast');

        // Collect tabs and contents
        this.tabs = {};
        this.modal.querySelectorAll('.civitai-downloader-tab').forEach(tab => {
            this.tabs[tab.dataset.tab] = tab;
        });
        this.tabContents = {};
        this.modal.querySelectorAll('.civitai-downloader-tab-content').forEach(content => {
            const tabName = content.id.replace('civitai-tab-', '');
            if (tabName) this.tabContents[tabName] = content;
        });
    }

    async initializeUI() {
        console.info("[Civicomfy] Initializing UI components...");
        await this.populateModelTypes();
        await this.populateBaseModels();
        this.loadAndApplySettings();
        this.loadBrowseSettings();
        this.loadMyModelsSettings();
    }

    async populateModelTypes() {
        console.log("[Civicomfy] Populating model types...");
        try {
            const types = await CivitaiDownloaderAPI.getModelTypes();
            if (!types || typeof types !== 'object' || Object.keys(types).length === 0) {
                 throw new Error("Received invalid model types data format.");
            }
            this.modelTypes = types;
            const sortedTypes = Object.entries(this.modelTypes).sort((a, b) => a[1].localeCompare(b[1]));

            this.downloadModelTypeSelect.innerHTML = '';
            this.settingsDefaultTypeSelect.innerHTML = '';

            // Rebuild browse type select (keep "All" first)
            if (this.browseTypeSelect) {
                this.browseTypeSelect.innerHTML = '<option value="all">All Types</option>';
            }

            sortedTypes.forEach(([key, displayName]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = displayName;
            this.downloadModelTypeSelect.appendChild(option.cloneNode(true));
            this.settingsDefaultTypeSelect.appendChild(option.cloneNode(true));

            // Add to browse type select
            if (this.browseTypeSelect) {
                this.browseTypeSelect.appendChild(option.cloneNode(true));
            }
        });
        // Restore saved active type after options are populated
        if (this.browseTypeSelect && this._savedBrowseActiveType) {
            if (this.browseTypeSelect.querySelector(`option[value="${this._savedBrowseActiveType}"]`)) {
                this.browseTypeSelect.value = this._savedBrowseActiveType;
                this.browseActiveType = this._savedBrowseActiveType;
            }
            this._savedBrowseActiveType = undefined;
        }
        // After types are populated, load subdirs for the current selection
        await this.loadAndPopulateSubdirs(this.downloadModelTypeSelect.value);
        // Populate the maintenance type picker
        this._buildMaintenanceTypePicker(sortedTypes);
        } catch (error) {
            console.error("[Civicomfy] Failed to get or populate model types:", error);
            this.showToast('Failed to load model types', 'error');
            this.downloadModelTypeSelect.innerHTML = '<option value="checkpoint">Checkpoint (Default)</option>';
            this.modelTypes = { "checkpoint": "Checkpoint (Default)" };
        }
    }

    async loadAndPopulateSubdirs(modelType) {
        try {
            const res = await CivitaiDownloaderAPI.getModelDirs(modelType);
            const select = this.subdirSelect;
            if (!select) return;
            const current = select.value;
            select.innerHTML = '';
            const optRoot = document.createElement('option');
            optRoot.value = '';
            optRoot.textContent = '(root)';
            select.appendChild(optRoot);
            if (res && Array.isArray(res.subdirs)) {
                // res.subdirs contains '' for root; skip empty since we added (root)
                res.subdirs.filter(p => p && typeof p === 'string').forEach(rel => {
                    const opt = document.createElement('option');
                    opt.value = rel;
                    opt.textContent = rel;
                    select.appendChild(opt);
                });
            }
            // Restore selection if still present
            if (Array.from(select.options).some(o => o.value === current)) {
                select.value = current;
            }
        } catch (e) {
            console.error('[Civicomfy] Failed to load subdirectories:', e);
            if (this.subdirSelect) {
                this.subdirSelect.innerHTML = '<option value="">(root)</option>';
            }
        }
    }

    // (loadAndPopulateRoots removed; dynamic types already reflect models/ subfolders)

    async populateBaseModels() {
        console.log("[Civicomfy] Populating base models...");
        try {
            const result = await CivitaiDownloaderAPI.getBaseModels();
            if (!result || !Array.isArray(result.base_models)) {
                throw new Error("Invalid base models data format received.");
            }
            this.baseModels = result.base_models.sort();
            this._buildBrowseBaseModelPicker(this.baseModels);
        } catch (error) {
             console.error("[Civicomfy] Failed to get or populate base models:", error);
             this.showToast('Failed to load base models list', 'error');
        }
    }

    _buildBrowseBaseModelPicker(models) {
        const container = this.browseBaseModelPickerOptions;
        if (!container) return;
        container.innerHTML = '';
        models.forEach(name => {
            const label = document.createElement('label');
            label.className = 'civitai-base-model-option';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = name;
            cb.className = 'civitai-base-model-checkbox';
            label.appendChild(cb);
            label.appendChild(document.createTextNode(' ' + name));
            container.appendChild(label);
        });
    }

    getBrowseSelectedBaseModels() {
        if (!this.browseBaseModelPickerOptions) return [];
        return Array.from(this.browseBaseModelPickerOptions.querySelectorAll('input[type=checkbox]:checked'))
            .map(cb => cb.value);
    }

    updateBrowseBaseModelLabel() {
        if (!this.browseBaseModelPickerLabel) return;
        const selected = this.getBrowseSelectedBaseModels();
        if (selected.length === 0) {
            this.browseBaseModelPickerLabel.textContent = 'Any Base Model';
        } else if (selected.length <= 2) {
            this.browseBaseModelPickerLabel.textContent = selected.join(', ');
        } else {
            this.browseBaseModelPickerLabel.textContent = `${selected.length} selected`;
        }
    }

    // --- Maintenance Type Picker ---
    _buildMaintenanceTypePicker(sortedTypes) {
        const picker = this.maintenanceTypePicker;
        if (!picker) return;
        // Remove previously injected checkboxes (keep "All")
        picker.querySelectorAll('.civitai-maintenance-type-opt:not(:first-child)').forEach(el => el.remove());

        sortedTypes.forEach(([key, displayName]) => {
            const label = document.createElement('label');
            label.className = 'civitai-maintenance-type-opt';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = key;
            cb.className = 'civitai-checkbox civitai-maint-type-cb';
            const span = document.createElement('span');
            span.textContent = displayName;
            label.appendChild(cb);
            label.appendChild(span);
            picker.appendChild(label);
        });

        // "All" checkbox toggles the rest
        if (this.maintenanceAllCheckbox) {
            this.maintenanceAllCheckbox.addEventListener('change', () => {
                if (this.maintenanceAllCheckbox.checked) {
                    picker.querySelectorAll('.civitai-maint-type-cb').forEach(cb => { cb.checked = false; });
                }
            });
        }
        picker.querySelectorAll('.civitai-maint-type-cb').forEach(cb => {
            cb.addEventListener('change', () => {
                if (this.maintenanceAllCheckbox) this.maintenanceAllCheckbox.checked = false;
            });
        });
    }

    _getMaintenanceSelectedTypes() {
        if (!this.maintenanceTypePicker) return [];
        if (this.maintenanceAllCheckbox?.checked) return [];
        return Array.from(this.maintenanceTypePicker.querySelectorAll('.civitai-maint-type-cb:checked'))
            .map(cb => cb.value);
    }

    _showMaintenanceResult(html, type = 'info') {
        const el = this.maintenanceResultEl;
        if (!el) return;
        el.className = `civitai-maintenance-result civitai-maintenance-result--${type}`;
        el.innerHTML = html;
        el.style.display = 'block';
    }

    async handleRefreshModelInfo() {
        const btn = this.refreshModelInfoBtn;
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing…'; }
        if (this.maintenanceControlsEl) this.maintenanceControlsEl.style.display = 'flex';
        this._showMaintenanceResult('<i class="fas fa-spinner fa-spin"></i> Fetching model info from Civitai… <strong>0/?</strong>', 'info');

        // Poll progress every 600 ms while the POST is running
        const pollInterval = setInterval(async () => {
            try {
                const prog = await CivitaiDownloaderAPI.getMaintenanceProgress();
                if (prog && prog.active && prog.operation === 'refresh') {
                    const skippedBadge = prog.skipped > 0
                        ? ` &bull; <span style="color:var(--cfy-warning);">Skipped: ${prog.skipped}</span>`
                        : '';
                    const itemBadge = prog.current_item
                        ? `<br><small style="opacity:0.75;font-style:italic;">${prog.current_item}</small>`
                        : '';
                    this._showMaintenanceResult(
                        `<i class="fas fa-spinner fa-spin"></i> Refreshing model info… <strong>${prog.current}/${prog.total}</strong>${skippedBadge}${itemBadge}`,
                        'info'
                    );
                }
            } catch (e) { /* ignore polling errors */ }
        }, 600);

        try {
            const types = this._getMaintenanceSelectedTypes();
            const result = await CivitaiDownloaderAPI.refreshModelInfo({
                model_types: types,
                api_key: this.settings.apiKey || '',
            });
            if (result && result.success) {
                const skippedPart = result.skipped > 0
                    ? ` &bull; <span style="color:var(--cfy-warning);">Skipped: ${result.skipped}</span>`
                    : '';
                const stoppedNote = result.stopped
                    ? `<br><small style="color:var(--cfy-warning);"><i class="fas fa-stop-circle"></i> Stopped early by user.</small>`
                    : '';
                this._showMaintenanceResult(
                    `<i class="fas fa-check-circle"></i> <strong>${result.message}</strong>` +
                    `<br><small>Total: ${result.total} &bull; Updated: ${result.updated}${skippedPart} &bull; Failed: ${result.failed}</small>` +
                    stoppedNote +
                    (result.errors?.length ? `<br><small style="color:var(--cfy-danger);">Errors: ${result.errors.slice(0, 5).join(', ')}</small>` : ''),
                    result.stopped ? 'info' : 'success'
                );
                this._myModelsLoaded = false;
            } else {
                this._showMaintenanceResult(`<i class="fas fa-exclamation-triangle"></i> ${result?.error || 'Unknown error'}`, 'error');
            }
        } catch (err) {
            this._showMaintenanceResult(`<i class="fas fa-exclamation-triangle"></i> ${err.message || 'Request failed'}`, 'error');
        } finally {
            clearInterval(pollInterval);
            if (this.maintenanceControlsEl) this.maintenanceControlsEl.style.display = 'none';
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-database"></i> Refresh Model Info'; }
        }
    }

    async handleUpdateThumbnails() {
        const btn = this.updateThumbnailsBtn;
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating…'; }
        if (this.maintenanceControlsEl) this.maintenanceControlsEl.style.display = 'flex';
        this._showMaintenanceResult('<i class="fas fa-spinner fa-spin"></i> Downloading thumbnails… <strong>0/?</strong>', 'info');

        // Poll progress every 600 ms while the POST is running
        const pollInterval = setInterval(async () => {
            try {
                const prog = await CivitaiDownloaderAPI.getMaintenanceProgress();
                if (prog && prog.active && prog.operation === 'thumbnails') {
                    const skippedBadge = prog.skipped > 0
                        ? ` &bull; <span style="color:var(--cfy-warning);">Skipped: ${prog.skipped}</span>`
                        : '';
                    const itemBadge = prog.current_item
                        ? `<br><small style="opacity:0.75;font-style:italic;">${prog.current_item}</small>`
                        : '';
                    this._showMaintenanceResult(
                        `<i class="fas fa-spinner fa-spin"></i> Downloading thumbnails… <strong>${prog.current}/${prog.total}</strong>${skippedBadge}${itemBadge}`,
                        'info'
                    );
                }
            } catch (e) { /* ignore polling errors */ }
        }, 600);

        try {
            const types = this._getMaintenanceSelectedTypes();
            const forceRedownload = this.maintenanceForceThumbCheckbox?.checked || false;
            const result = await CivitaiDownloaderAPI.updateThumbnails({
                model_types: types,
                force_redownload: forceRedownload,
                api_key: this.settings.apiKey || '',
            });
            if (result && result.success) {
                const skippedPart = result.skipped > 0
                    ? ` &bull; <span style="color:var(--cfy-warning);">Skipped: ${result.skipped}</span>`
                    : '';
                const stoppedNote = result.stopped
                    ? `<br><small style="color:var(--cfy-warning);"><i class="fas fa-stop-circle"></i> Stopped early by user.</small>`
                    : '';
                this._showMaintenanceResult(
                    `<i class="fas fa-check-circle"></i> <strong>${result.message}</strong>` +
                    `<br><small>Total: ${result.total} &bull; Downloaded: ${result.downloaded}${skippedPart} &bull; Failed: ${result.failed}</small>` +
                    stoppedNote +
                    (result.errors?.length ? `<br><small style="color:var(--cfy-danger);">Errors: ${result.errors.slice(0, 5).join(', ')}</small>` : ''),
                    result.stopped ? 'info' : 'success'
                );
                this._myModelsLoaded = false;
            } else {
                this._showMaintenanceResult(`<i class="fas fa-exclamation-triangle"></i> ${result?.error || 'Unknown error'}`, 'error');
            }
        } catch (err) {
            this._showMaintenanceResult(`<i class="fas fa-exclamation-triangle"></i> ${err.message || 'Request failed'}`, 'error');
        } finally {
            clearInterval(pollInterval);
            if (this.maintenanceControlsEl) this.maintenanceControlsEl.style.display = 'none';
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-image"></i> Update Thumbnails'; }
        }
    }

    switchTab(tabId) {
        if (this.activeTab === tabId || !this.tabs[tabId] || !this.tabContents[tabId]) return;

        this.tabs[this.activeTab]?.classList.remove('active');
        this.tabContents[this.activeTab]?.classList.remove('active');

        this.tabs[tabId].classList.add('active');
        this.tabContents[tabId].classList.add('active');
        this.tabContents[tabId].scrollTop = 0;
        this.activeTab = tabId;

        if (tabId === 'status') this.updateStatus();
        else if (tabId === 'browse') {
            if (!this.browseLoaded) {
                this.browseLoaded = true;
                this.browsePagination.currentPage = 1;
                this.handleBrowseLoad();
            }
        }
        else if (tabId === 'mymodels') {
            if (!this._myModelsLoaded) {
                this._myModelsLoaded = true;
                this.handleMyModelsLoad();
            }
        }
        else if (tabId === 'gallery') {
            if (!this._galleryLoaded) {
                this._galleryLoaded = true;
                this._galleryPage = 1;
                this.handleGalleryLoad();
            }
        }
        else if (tabId === 'settings') this.applySettings();
        else if(tabId === 'download') {
            this.downloadConnectionsInput.value = this.settings.numConnections;
            if (Object.keys(this.modelTypes).length > 0) {
                this.downloadModelTypeSelect.value = this.settings.defaultModelType;
            }
        }
    }

    // --- Modal Control ---
    openModal() {
        this.modal?.classList.add('open');
        document.body.style.setProperty('overflow', 'hidden', 'important');
        this.startStatusUpdates();
        if (this.activeTab === 'status') this.updateStatus();
        if (!this.settings.apiKey) this.switchTab('settings');
    }

    closeModal() {
        this.modal?.classList.remove('open');
        document.body.style.removeProperty('overflow');
        this.stopStatusUpdates();
    }

    toggleFullscreen() {
        const content = this.modal?.querySelector('.civitai-downloader-modal-content');
        if (!content) return;
        const isFs = content.classList.toggle('fullscreen');
        const icon = this.fullscreenButton?.querySelector('i');
        if (icon) {
            icon.className = isFs ? 'fas fa-compress' : 'fas fa-expand';
        }
        if (this.fullscreenButton) {
            this.fullscreenButton.title = isFs ? 'Exit fullscreen' : 'Toggle fullscreen';
        }
    }

    // --- Utility Methods ---
    formatBytes(bytes, decimals = 2) {
        if (bytes === null || bytes === undefined || isNaN(bytes)) return 'N/A';
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    formatSpeed(bytesPerSecond) {
        if (!isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '';
        return this.formatBytes(bytesPerSecond) + '/s';
    }

    formatDuration(isoStart, isoEnd) {
        try {
            const diffSeconds = Math.round((new Date(isoEnd) - new Date(isoStart)) / 1000);
            if (isNaN(diffSeconds) || diffSeconds < 0) return 'N/A';
            if (diffSeconds < 60) return `${diffSeconds}s`;
            const diffMinutes = Math.floor(diffSeconds / 60);
            const remainingSeconds = diffSeconds % 60;
            return `${diffMinutes}m ${remainingSeconds}s`;
        } catch (e) {
            return 'N/A';
        }
    }

    showToast(message, type = 'info', duration = 3000) {
        this.feedback?.show(message, type, duration);
    }

    ensureFontAwesome() {
        this.feedback?.ensureFontAwesome();
    }

    // --- Rendering (delegated to external renderers) ---
    renderDownloadList = (items, container, emptyMessage) => renderDownloadList(this, items, container, emptyMessage);
    renderSearchResults = (items) => renderSearchResults(this, items);
    renderDownloadPreview = (data) => renderDownloadPreview(this, data);
    renderBrowseResults = (items) => renderBrowseCards(this, items);
    showBrowseCardInfo = (modelId) => showBrowseCardInfo(this, modelId);
    
    // --- Auto-select model type based on Civitai model type ---
    inferFolderFromCivitaiType(civitaiType) {
        if (!civitaiType || typeof civitaiType !== 'string') return null;
        const t = civitaiType.trim().toLowerCase();
        const keys = Object.keys(this.modelTypes || {});
        if (keys.length === 0) return null;

        const exists = (k) => keys.includes(k);
        const findBy = (pred) => keys.find(pred);

        // Direct matches first
        if (exists(t)) return t;
        if (exists(`${t}s`)) return `${t}s`;

        // Common mappings from Civitai types to ComfyUI folders
        const candidates = [];
        const addIfExists = (k) => { if (exists(k)) candidates.push(k); };

        switch (t) {
            case 'checkpoint':
                addIfExists('checkpoints');
                addIfExists('models');
                break;
            case 'lora': case 'locon': case 'lycoris':
                addIfExists('loras');
                break;
            case 'vae':
                addIfExists('vae');
                break;
            case 'textualinversion': case 'embedding': case 'embeddings':
                addIfExists('embeddings');
                break;
            case 'hypernetwork':
                addIfExists('hypernetworks');
                break;
            case 'controlnet':
                addIfExists('controlnet');
                break;
            case 'unet': case 'unet2':
                addIfExists('unet');
                break;
            case 'diffusers': case 'diffusionmodels': case 'diffusion_models': case 'diffusion':
                addIfExists('diffusers');
                addIfExists('diffusion_models');
                break;
            case 'upscaler': case 'upscalers':
                addIfExists('upscale_models');
                addIfExists('upscalers');
                break;
            case 'motionmodule':
                addIfExists('motion_models');
                break;
            case 'poses':
                addIfExists('poses');
                break;
            case 'wildcards':
                addIfExists('wildcards');
                break;
            case 'onnx':
                addIfExists('onnx');
                break;
        }
        if (candidates.length > 0) return candidates[0];

        // Relaxed match: name contains type
        const contains = findBy(k => k.toLowerCase().includes(t));
        if (contains) return contains;

        return null;
    }

    async autoSelectModelTypeFromCivitai(civitaiType) {
        try {
            const folder = this.inferFolderFromCivitaiType(civitaiType);
            if (!folder) return;
            if (this.downloadModelTypeSelect && this.downloadModelTypeSelect.value !== folder) {
                this.downloadModelTypeSelect.value = folder;
                await this.loadAndPopulateSubdirs(folder);
                // Reset subdir to root after auto-switch
                if (this.subdirSelect) this.subdirSelect.value = '';
            }
        } catch (e) {
            console.warn('[Civicomfy] Auto-select model type failed:', e);
        }
    }

    renderBrowsePagination(metadata) {
        if (!this.browsePaginationContainer) return;
        if (!metadata || metadata.totalPages <= 1) {
            this.browsePaginationContainer.innerHTML = '';
            this.browsePagination = { ...this.browsePagination, ...metadata };
            return;
        }

        this.browsePagination = { ...this.browsePagination, ...metadata };
        const { currentPage, totalPages, totalItems } = this.browsePagination;

        const createButton = (text, page, isDisabled = false, isCurrent = false) => {
            const button = document.createElement('button');
            button.className = `civitai-button small civitai-browse-page-button ${isCurrent ? 'primary active' : ''}`;
            button.dataset.page = page;
            button.disabled = isDisabled;
            button.innerHTML = text;
            button.type = 'button';
            return button;
        };

        const fragment = document.createDocumentFragment();
        fragment.appendChild(createButton('&laquo; Prev', currentPage - 1, currentPage === 1));

        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, currentPage + 2);

        if (startPage > 1) fragment.appendChild(createButton('1', 1));
        if (startPage > 2) { const sp = document.createElement('span'); sp.textContent = '...'; fragment.appendChild(sp); }

        for (let i = startPage; i <= endPage; i++) {
            fragment.appendChild(createButton(i, i, false, i === currentPage));
        }

        if (endPage < totalPages - 1) { const sp = document.createElement('span'); sp.textContent = '...'; fragment.appendChild(sp); }
        if (endPage < totalPages) fragment.appendChild(createButton(totalPages, totalPages));

        fragment.appendChild(createButton('Next &raquo;', currentPage + 1, currentPage === totalPages));

        if (totalItems !== undefined) {
            const info = document.createElement('div');
            info.className = 'civitai-pagination-info';
            info.textContent = `Page ${currentPage} of ${totalPages} (${Number(totalItems).toLocaleString()} models)`;
            fragment.appendChild(info);
        }

        this.browsePaginationContainer.innerHTML = '';
        this.browsePaginationContainer.appendChild(fragment);
    }

    // --- Event Handlers and State Management (delegated to handlers) ---
    setupEventListeners = () => setupEventListeners(this);
    getDefaultSettings = () => getDefaultSettings();
    loadAndApplySettings = () => loadAndApplySettings(this);
    loadSettingsFromCookie = () => loadSettingsFromCookie(this);
    saveSettingsToCookie = () => saveSettingsToCookie(this);
    applySettings = () => applySettings(this);
    handleSettingsSave = () => handleSettingsSave(this);
    saveBrowseSettings = () => saveBrowseSettings(this);
    loadBrowseSettings = () => loadBrowseSettings(this);
    saveMyModelsSettings = () => saveMyModelsSettings(this);
    loadMyModelsSettings = () => loadMyModelsSettings(this);
    handleDownloadSubmit = () => handleDownloadSubmit(this);
    handleBrowseLoad = () => handleBrowseLoad(this);
    fetchAndDisplayDownloadPreview = () => fetchAndDisplayDownloadPreview(this);
    debounceFetchDownloadPreview = (delay) => debounceFetchDownloadPreview(this, delay);
    startStatusUpdates = () => startStatusUpdates(this);
    stopStatusUpdates = () => stopStatusUpdates(this);
    updateStatus = () => updateStatus(this);
    handleCancelDownload = (downloadId) => handleCancelDownload(this, downloadId);
    handleRetryDownload = (downloadId, button) => handleRetryDownload(this, downloadId, button);
    handleOpenPath = (downloadId, button) => handleOpenPath(this, downloadId, button);
    handleClearHistory = () => handleClearHistory(this);

    // My Models tab
    handleMyModelsLoad = () => handleMyModelsLoad(this);
    renderMyModels = () => renderMyModels(this);
    handleMyModelOpenOnCivit = (modelId) => handleMyModelOpenOnCivit(modelId);
    handleMyModelViewDetail = (relPath) => handleMyModelViewDetail(this, relPath);
    handleMyModelDelete = (relPath, name, btn) => handleMyModelDelete(this, relPath, name, btn);

    // Gallery tab
    handleGalleryLoad = () => handleGalleryLoad(this);
    renderGalleryGrid = () => renderGalleryGrid(this, this._galleryImages);
    openGalleryLightbox = (index) => openGalleryLightbox(this, index);
    closeGalleryLightbox = () => closeGalleryLightbox(this);
    lightboxPrev = () => lightboxPrev(this);
    lightboxNext = () => lightboxNext(this);
    toggleGallerySelect = (key) => toggleGallerySelect(this, key);
    updateGallerySelectionBar = () => updateGallerySelectionBar(this);
    deleteSelectedGallery = () => deleteSelectedGallery(this);
    downloadSelectedGallery = () => downloadSelectedGallery(this);
    deleteGalleryImage = (img) => deleteGalleryImage(this, img);
}
