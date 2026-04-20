import { CivitaiDownloaderAPI } from "../../api/civitai.js";

/**
 * Load browse results based on current browse state (type tab, sort, base model, page).
 * Reuses the same search API with an empty query.
 */
export async function handleBrowseLoad(ui) {
    if (!ui.browseResultsContainer || !ui.browsePaginationContainer) return;

    const loadingMsg = '<p><i class="fas fa-spinner fa-spin"></i> Loading models...</p>';
    ui.browseResultsContainer.innerHTML = loadingMsg;
    ui.browsePaginationContainer.innerHTML = '';

    if (ui.browseRefreshButton) {
        ui.browseRefreshButton.disabled = true;
    }

    const selectedType = ui.browseActiveType || 'all';
    const params = {
        query: ui.browseSearchInput?.value?.trim() || '',
        model_types: selectedType === 'all' ? [] : [selectedType],
        base_models: ui.getBrowseSelectedBaseModels(),
        sort: ui.browseSortSelect?.value || 'Most Downloaded',
        limit: ui.browsePagination.limit,
        page: ui.browsePagination.currentPage,
        api_key: ui.settings?.apiKey || '',
    };

    try {
        const response = await CivitaiDownloaderAPI.searchModels(params);
        if (!response || !response.metadata || !Array.isArray(response.items)) {
            throw new Error("Received invalid data from browse API.");
        }

        if (response.items.length === 0) {
            ui.browseResultsContainer.innerHTML = '<p>No models found for this category.</p>';
        } else {
            ui.renderBrowseResults(response.items);
        }
        ui.renderBrowsePagination(response.metadata);

    } catch (error) {
        const message = `Browse failed: ${error.details || error.message || 'Unknown error'}`;
        console.error("[Civicomfy] Browse Load Error:", error);
        ui.browseResultsContainer.innerHTML = `<p style="color: var(--error-text, #ff6b6b);">${message}</p>`;
        ui.showToast(message, 'error');
    } finally {
        if (ui.browseRefreshButton) {
            ui.browseRefreshButton.disabled = false;
        }
    }
}
