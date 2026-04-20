import { CivitaiDownloaderAPI } from "../../api/civitai.js";
export function setupEventListeners(ui) {
    // Modal close
    ui.closeButton.addEventListener('click', () => ui.closeModal());
    if (ui.fullscreenButton) {
        ui.fullscreenButton.addEventListener('click', () => ui.toggleFullscreen());
    }
    ui.modal.addEventListener('click', (event) => {
        if (event.target === ui.modal) ui.closeModal();
    });

    // Tab switching
    ui.tabContainer.addEventListener('click', (event) => {
        if (event.target.matches('.civitai-downloader-tab')) {
            ui.switchTab(event.target.dataset.tab);
        }
    });

    // --- FORMS ---
    ui.downloadForm.addEventListener('submit', (event) => {
        event.preventDefault();
        ui.handleDownloadSubmit();
    });

    // Change of model type should refresh subdir list
    ui.downloadModelTypeSelect.addEventListener('change', async () => {
        await ui.loadAndPopulateSubdirs(ui.downloadModelTypeSelect.value);
    });

    // Create new model type folder (first-level under models/)
    ui.createModelTypeButton.addEventListener('click', async () => {
        const name = prompt('Enter new model type folder name (will be created under models/)');
        if (!name) return;
        try {
            const res = await CivitaiDownloaderAPI.createModelType(name);
            if (res && res.success) {
                await ui.populateModelTypes();
                ui.downloadModelTypeSelect.value = res.name;
                await ui.loadAndPopulateSubdirs(res.name);
                ui.showToast(`Created model type folder: ${res.name}`, 'success');
            } else {
                ui.showToast(res?.error || 'Failed to create model type folder', 'error');
            }
        } catch (e) {
            ui.showToast(e.details || e.message || 'Error creating model type folder', 'error');
        }
    });

    // Create new subfolder under current model type
    ui.createSubdirButton.addEventListener('click', async () => {
        const type = ui.downloadModelTypeSelect.value;
        const name = prompt('Enter new subfolder name (you can include nested paths like A/B):');
        if (!name) return;
        try {
            const res = await CivitaiDownloaderAPI.createModelDir(type, name);
            if (res && res.success) {
                await ui.loadAndPopulateSubdirs(type);
                if (ui.subdirSelect) ui.subdirSelect.value = res.created || '';
                ui.showToast(`Created folder: ${res.created}`, 'success');
            } else {
                ui.showToast(res?.error || 'Failed to create folder', 'error');
            }
        } catch (e) {
            ui.showToast(e.details || e.message || 'Error creating folder', 'error');
        }
    });

    ui.settingsForm.addEventListener('submit', (event) => {
        event.preventDefault();
        ui.handleSettingsSave();
    });

    // Download form inputs
    ui.modelUrlInput.addEventListener('input', () => ui.debounceFetchDownloadPreview());
    ui.modelUrlInput.addEventListener('paste', () => ui.debounceFetchDownloadPreview(0));
    ui.modelVersionIdInput.addEventListener('blur', () => ui.fetchAndDisplayDownloadPreview());

    // --- DYNAMIC CONTENT LISTENERS (Event Delegation) ---

    // Status tab actions (Cancel/Retry/Open/Clear) and click-to-toggle blur on thumbs
    ui.statusContent.addEventListener('click', (event) => {
        const thumbContainer = event.target.closest('.civitai-thumbnail-container');
        if (thumbContainer) {
            const nsfwLevel = Number(thumbContainer.dataset.nsfwLevel ?? thumbContainer.getAttribute('data-nsfw-level'));
            const threshold = Number(ui.settings?.nsfwBlurMinLevel ?? 4);
            const enabled = ui.settings?.hideMatureInSearch === true;
            if (enabled && Number.isFinite(nsfwLevel) && nsfwLevel >= threshold) {
                if (thumbContainer.classList.contains('blurred')) {
                    thumbContainer.classList.remove('blurred');
                    const overlay = thumbContainer.querySelector('.civitai-nsfw-overlay');
                    if (overlay) overlay.remove();
                } else {
                    thumbContainer.classList.add('blurred');
                    if (!thumbContainer.querySelector('.civitai-nsfw-overlay')) {
                        const ov = document.createElement('div');
                        ov.className = 'civitai-nsfw-overlay';
                        ov.title = 'R-rated: click to reveal';
                        ov.textContent = 'R';
                        thumbContainer.appendChild(ov);
                    }
                }
                return; // consume
            }
        }

        const button = event.target.closest('button');
        if (!button) return;

        const downloadId = button.dataset.id;
        if (downloadId) {
            if (button.classList.contains('civitai-cancel-button')) ui.handleCancelDownload(downloadId);
            else if (button.classList.contains('civitai-retry-button')) ui.handleRetryDownload(downloadId, button);
            else if (button.classList.contains('civitai-openpath-button')) ui.handleOpenPath(downloadId, button);
        } else if (button.id === 'civitai-clear-history-button') {
            ui.confirmClearModal.style.display = 'flex';
        }
    });

    // Download preview click-to-toggle blur
    ui.downloadPreviewArea.addEventListener('click', (event) => {
        const thumbContainer = event.target.closest('.civitai-thumbnail-container');
        if (thumbContainer) {
            const nsfwLevel = Number(thumbContainer.dataset.nsfwLevel ?? thumbContainer.getAttribute('data-nsfw-level'));
            const threshold = Number(ui.settings?.nsfwBlurMinLevel ?? 4);
            const enabled = ui.settings?.hideMatureInSearch === true;
            if (enabled && Number.isFinite(nsfwLevel) && nsfwLevel >= threshold) {
                if (thumbContainer.classList.contains('blurred')) {
                    thumbContainer.classList.remove('blurred');
                    const overlay = thumbContainer.querySelector('.civitai-nsfw-overlay');
                    if (overlay) overlay.remove();
                } else {
                    thumbContainer.classList.add('blurred');
                    if (!thumbContainer.querySelector('.civitai-nsfw-overlay')) {
                        const ov = document.createElement('div');
                        ov.className = 'civitai-nsfw-overlay';
                        ov.title = 'R-rated: click to reveal';
                        ov.textContent = 'R';
                        thumbContainer.appendChild(ov);
                    }
                }
            }
        }
    });


    if (ui.browseTypeTabsContainer) {
        ui.browseTypeTabsContainer.addEventListener('click', (event) => {
            const tab = event.target.closest('.civitai-browse-type-tab');
            if (!tab) return;
            const type = tab.dataset.type;
            if (type === ui.browseActiveType) return;

            // Update active state
            ui.browseTypeTabsContainer.querySelectorAll('.civitai-browse-type-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            ui.browseActiveType = type;
            ui.browsePagination.currentPage = 1;
            ui.saveBrowseSettings();
            ui.handleBrowseLoad();
        });
    }

    if (ui.browseSortSelect) {
        ui.browseSortSelect.addEventListener('change', () => {
            ui.browsePagination.currentPage = 1;
            ui.saveBrowseSettings();
            ui.handleBrowseLoad();
        });
    }

    if (ui.browseBaseModelPickerToggle) {
        ui.browseBaseModelPickerToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            const dropdown = ui.browseBaseModelPickerDropdown;
            const isOpen = dropdown.style.display !== 'none';
            dropdown.style.display = isOpen ? 'none' : 'block';
        });
    }

    if (ui.browseBaseModelPickerSearch) {
        ui.browseBaseModelPickerSearch.addEventListener('input', () => {
            const q = ui.browseBaseModelPickerSearch.value.toLowerCase();
            ui.browseBaseModelPickerOptions.querySelectorAll('.civitai-base-model-option').forEach(label => {
                label.style.display = label.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        });
    }

    if (ui.browseBaseModelPickerOptions) {
        ui.browseBaseModelPickerOptions.addEventListener('change', () => {
            ui.updateBrowseBaseModelLabel();
            ui.browsePagination.currentPage = 1;
            ui.saveBrowseSettings();
            ui.handleBrowseLoad();
        });
    }

    if (ui.browseBaseModelClearButton) {
        ui.browseBaseModelClearButton.addEventListener('click', () => {
            ui.browseBaseModelPickerOptions.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
            ui.updateBrowseBaseModelLabel();
            ui.browsePagination.currentPage = 1;
            ui.saveBrowseSettings();
            ui.handleBrowseLoad();
        });
    }

    // Close picker when clicking outside
    document.addEventListener('click', (event) => {
        if (ui.browseBaseModelPickerDropdown && ui.browseBaseModelPickerDropdown.style.display !== 'none') {
            if (!ui.browseBaseModelPickerDropdown.contains(event.target) && event.target !== ui.browseBaseModelPickerToggle) {
                ui.browseBaseModelPickerDropdown.style.display = 'none';
            }
        }
    });

    if (ui.browseRefreshButton) {
        ui.browseRefreshButton.addEventListener('click', () => {
            ui.browsePagination.currentPage = 1;
            ui.handleBrowseLoad();
        });
    }

    if (ui.browsePaginationContainer) {
        ui.browsePaginationContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.civitai-browse-page-button');
            if (button && !button.disabled) {
                const page = parseInt(button.dataset.page, 10);
                if (page && page !== ui.browsePagination.currentPage) {
                    ui.browsePagination.currentPage = page;
                    ui.handleBrowseLoad();
                    // Scroll browse tab content to top
                    ui.tabContents['browse']?.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        });
    }

    // Browse results: download button + show all versions + nsfw toggle
    if (ui.browseResultsContainer) {
        ui.browseResultsContainer.addEventListener('click', (event) => {
            const thumbContainer = event.target.closest('.civitai-thumbnail-container');
            if (thumbContainer) {
                const nsfwLevel = Number(thumbContainer.dataset.nsfwLevel ?? thumbContainer.getAttribute('data-nsfw-level'));
                const threshold = Number(ui.settings?.nsfwBlurMinLevel ?? 4);
                const enabled = ui.settings?.hideMatureInSearch === true;
                if (enabled && Number.isFinite(nsfwLevel) && nsfwLevel >= threshold) {
                    if (thumbContainer.classList.contains('blurred')) {
                        thumbContainer.classList.remove('blurred');
                        const overlay = thumbContainer.querySelector('.civitai-nsfw-overlay');
                        if (overlay) overlay.remove();
                    } else {
                        thumbContainer.classList.add('blurred');
                        if (!thumbContainer.querySelector('.civitai-nsfw-overlay')) {
                            const ov = document.createElement('div');
                            ov.className = 'civitai-nsfw-overlay';
                            ov.title = 'R-rated: click to reveal';
                            ov.textContent = 'R';
                            thumbContainer.appendChild(ov);
                        }
                    }
                    return;
                }
            }

            const downloadButton = event.target.closest('.civitai-search-download-button');
            if (downloadButton) {
                event.preventDefault();
                const { modelId, versionId, modelType } = downloadButton.dataset;
                if (!modelId || !versionId) { ui.showToast("Error: Missing data for download.", "error"); return; }
                const modelTypeInternalKey = ui.inferFolderFromCivitaiType(modelType) || ui.settings.defaultModelType;
                ui.modelUrlInput.value = modelId;
                ui.modelVersionIdInput.value = versionId;
                ui.customFilenameInput.value = '';
                ui.forceRedownloadCheckbox.checked = false;
                ui.downloadModelTypeSelect.value = modelTypeInternalKey;
                ui.switchTab('download');
                ui.showToast(`Filled download form for Model ID ${modelId}.`, 'info', 4000);
                ui.fetchAndDisplayDownloadPreview();
                return;
            }

            const viewAllButton = event.target.closest('.show-all-versions-button');
            if (viewAllButton) {
                const modelId = viewAllButton.dataset.modelId;
                const versionsContainer = ui.browseResultsContainer.querySelector(`#all-versions-${modelId}`);
                if (versionsContainer) {
                    const currentlyVisible = versionsContainer.style.display !== 'none';
                    versionsContainer.style.display = currentlyVisible ? 'none' : 'flex';
                    viewAllButton.innerHTML = currentlyVisible
                        ? `All versions (${viewAllButton.dataset.totalVersions}) <i class="fas fa-chevron-down"></i>`
                        : `Show less <i class="fas fa-chevron-up"></i>`;
                }
            }
        });
    }

    // Confirmation Modal
    ui.confirmClearYesButton.addEventListener('click', () => ui.handleClearHistory());
    ui.confirmClearNoButton.addEventListener('click', () => {
        ui.confirmClearModal.style.display = 'none';
    });
    ui.confirmClearModal.addEventListener('click', (event) => {
        if (event.target === ui.confirmClearModal) {
            ui.confirmClearModal.style.display = 'none';
        }
    });

    // --- My Models Tab ---
    if (ui.myModelsRefreshButton) {
        ui.myModelsRefreshButton.addEventListener('click', () => {
            ui._myModelsLoaded = true;
            ui.handleMyModelsLoad();
        });
    }

    if (ui.myModelsTypeFilter) {
        ui.myModelsTypeFilter.addEventListener('change', () => {
            ui._myModelsLoaded = true;
            ui.saveMyModelsSettings();
            ui.handleMyModelsLoad();
        });
    }

    if (ui.myModelsSearchInput) {
        let _myModelsSearchDebounce = null;
        ui.myModelsSearchInput.addEventListener('input', () => {
            clearTimeout(_myModelsSearchDebounce);
            _myModelsSearchDebounce = setTimeout(() => ui.renderMyModels(), 200);
        });
    }

    if (ui.myModelsSortSelect) {
        ui.myModelsSortSelect.addEventListener('change', () => {
            ui.saveMyModelsSettings();
            ui.renderMyModels();
        });
    }

    if (ui.myModelsListContainer) {
        ui.myModelsListContainer.addEventListener('click', (event) => {
            const civitBtn = event.target.closest('.civitai-mymodel-opencivit-btn');
            if (civitBtn) {
                ui.handleMyModelOpenOnCivit(civitBtn.dataset.modelId);
                return;
            }
            const detailBtn = event.target.closest('.civitai-mymodel-detail-btn');
            if (detailBtn) {
                ui.handleMyModelViewDetail(detailBtn.dataset.relPath);
                return;
            }
            const deleteBtn = event.target.closest('.civitai-mymodel-delete-btn');
            if (deleteBtn) {
                ui.handleMyModelDelete(deleteBtn.dataset.relPath, deleteBtn.dataset.name, deleteBtn);
            }
        });
    }
}
