// Modal template for Civicomfy UI
// Keep structure identical to the original inline HTML to minimize risk

export function modalTemplate(settings = {}) {
  const numConnections = Number.isFinite(settings.numConnections) ? settings.numConnections : 1;
  return `
    <div class="civitai-downloader-modal-content">
      <div class="civitai-downloader-header">
        <h2><i class="fas fa-cloud-download-alt" style="color:var(--accent-color,#5c8aff);margin-right:8px;"></i>Civicomfy</h2>
        <div class="civitai-header-actions">
          <button class="civitai-icon-button" id="civitai-fullscreen-toggle" title="Toggle fullscreen"><i class="fas fa-expand"></i></button>
          <button class="civitai-close-button" id="civitai-close-modal">&times;</button>
        </div>
      </div>
      <div class="civitai-downloader-body">
        <div class="civitai-downloader-tabs">
          <button class="civitai-downloader-tab active" data-tab="download"><i class="fas fa-download"></i> Download</button>
          <button class="civitai-downloader-tab" data-tab="browse"><i class="fas fa-compass"></i> Browse</button>
          <button class="civitai-downloader-tab" data-tab="mymodels"><i class="fas fa-layer-group"></i> My Models</button>
          <button class="civitai-downloader-tab" data-tab="status"><i class="fas fa-tasks"></i> Status <span id="civitai-status-indicator" style="display: none;">(<span id="civitai-active-count">0</span>)</span></button>
          <button class="civitai-downloader-tab" data-tab="settings"><i class="fas fa-cog"></i> Settings</button>
        </div>
        <div id="civitai-tab-download" class="civitai-downloader-tab-content active">
          <form id="civitai-download-form">
            <div class="civitai-form-group">
              <label for="civitai-model-url">Model URL or ID</label>
              <input type="text" id="civitai-model-url" class="civitai-input" placeholder="e.g., https://civitai.com/models/12345, https://civitai.red/models/12345 or 12345" required>
            </div>
            <p style="font-size: 0.9em; color: #ccc; margin-top: -10px; margin-bottom: 15px;">You can optionally specify a version ID using "?modelVersionId=xxxxx" in the URL or in the field below.</p>
            <div class="civitai-form-row">
              <div class="civitai-form-group">
                <label for="civitai-model-type">Model Type (Save Location)</label>
                <div style="display:flex; gap:6px; align-items:center;">
                  <select id="civitai-model-type" class="civitai-select" required></select>
                  <button type="button" id="civitai-create-model-type" class="civitai-button small" title="Create new model type folder"><i class="fas fa-folder-plus"></i></button>
                </div>
              </div>
              <div class="civitai-form-group">
                <label for="civitai-subdir-select">Save Subfolder</label>
                <div style="display:flex; gap:6px; align-items:center;">
                  <select id="civitai-subdir-select" class="civitai-select">
                    <option value="">(root)</option>
                  </select>
                  <button type="button" id="civitai-create-subdir" class="civitai-button small" title="Create new subfolder"><i class="fas fa-folder-plus"></i></button>
                </div>
              </div>
              <div class="civitai-form-group">
                <label for="civitai-model-version-id">Version ID (Optional)</label>
                <input type="number" id="civitai-model-version-id" class="civitai-input" placeholder="Overrides URL/Latest">
              </div>
            </div>
            <div class="civitai-form-row">
              <div class="civitai-form-group">
                <label for="civitai-custom-filename">Custom Filename (Optional)</label>
                <input type="text" id="civitai-custom-filename" class="civitai-input" placeholder="Leave blank to use original name">
              </div>
              <div class="civitai-form-group">
                <label for="civitai-connections">Connections</label>
                <input type="number" id="civitai-connections" class="civitai-input" value="${numConnections}" min="1" max="16" step="1" required disabled>
                <p style="font-size: 0.9em; color: #ccc; margin-top: 7px; margin-bottom: 15px;">Disabled: Only single connection possible for now</p>
              </div>
            </div>
            <div class="civitai-form-group inline">
              <input type="checkbox" id="civitai-force-redownload" class="civitai-checkbox">
              <label for="civitai-force-redownload">Force Re-download (if exists)</label>
            </div>
            <div id="civitai-download-preview-area" class="civitai-download-preview-area" style="margin-top: 25px; margin-bottom: 25px; padding-top: 15px; border-top: 1px solid var(--border-color, #444);">
              <!-- Preview content will be injected here -->
            </div>
            <button type="submit" id="civitai-download-submit" class="civitai-button primary">Start Download</button>
          </form>
        </div>
        <div id="civitai-tab-browse" class="civitai-downloader-tab-content">
          <div class="civitai-browse-header">
            <div class="civitai-browse-type-tabs" id="civitai-browse-type-tabs">
              <button class="civitai-browse-type-tab active" data-type="all">All</button>
              <!-- Model type tabs will be injected here by JS -->
            </div>
            <div class="civitai-browse-controls">
              <select id="civitai-browse-sort" class="civitai-select" style="min-width:160px;">
                <option value="Most Downloaded">Most Downloaded</option>
                <option value="Highest Rated">Highest Rated</option>
                <option value="Most Liked">Most Liked</option>
                <option value="Newest">Newest</option>
                <option value="Most Discussed">Most Discussed</option>
                <option value="Most Collected">Most Collected</option>
              </select>
              <div id="civitai-browse-base-model-picker" class="civitai-base-model-picker">
                <button type="button" class="civitai-base-model-picker-toggle" id="civitai-browse-base-model-toggle">
                  <span id="civitai-browse-base-model-label">Any Base Model</span> <i class="fas fa-chevron-down"></i>
                </button>
                <div class="civitai-base-model-picker-dropdown" id="civitai-browse-base-model-dropdown" style="display:none;">
                  <div class="civitai-base-model-picker-search-wrap">
                    <input type="text" id="civitai-browse-base-model-search" class="civitai-input" placeholder="Filter..." autocomplete="off">
                  </div>
                  <div class="civitai-base-model-picker-options" id="civitai-browse-base-model-options"></div>
                  <div class="civitai-base-model-picker-footer">
                    <button type="button" id="civitai-browse-base-model-clear" class="civitai-button small secondary">Clear</button>
                  </div>
                </div>
              </div>
              <button id="civitai-browse-refresh" class="civitai-button" title="Refresh"><i class="fas fa-sync-alt"></i></button>
            </div>
          </div>
          <div id="civitai-browse-results" class="civitai-search-results"></div>
          <div id="civitai-browse-pagination" style="text-align: center; margin-top: 20px;"></div>
        </div>
        <div id="civitai-tab-mymodels" class="civitai-downloader-tab-content">
          <div class="civitai-mymodels-header">
            <div class="civitai-mymodels-controls">
              <select id="civitai-mymodels-type-filter" class="civitai-select">
                <option value="">All Types</option>
              </select>
              <select id="civitai-mymodels-sort" class="civitai-select" title="Sort models">
                <option value="name_asc">Name (A → Z)</option>
                <option value="name_desc">Name (Z → A)</option>
                <option value="time_desc" selected>Newest First</option>
                <option value="time_asc">Oldest First</option>
                <option value="size_desc">Size (Large first)</option>
                <option value="size_asc">Size (Small first)</option>
              </select>
              <input type="text" id="civitai-mymodels-search" class="civitai-input" placeholder="Filter by name...">
              <span id="civitai-mymodels-count" class="civitai-mymodels-count"></span>
              <button id="civitai-mymodels-refresh" class="civitai-button" title="Refresh list"><i class="fas fa-sync-alt"></i> Refresh</button>
            </div>
          </div>
          <div id="civitai-mymodels-list" class="civitai-mymodels-list">
            <p>Click Refresh to load your local models.</p>
          </div>
        </div>
        <div id="civitai-tab-status" class="civitai-downloader-tab-content">
          <div id="civitai-status-content">
            <div class="civitai-status-section">
              <h3>Active Downloads</h3>
              <div id="civitai-active-list" class="civitai-download-list">
                <p>No active downloads.</p>
              </div>
            </div>
            <div class="civitai-status-section">
              <h3>Queued Downloads</h3>
              <div id="civitai-queued-list" class="civitai-download-list">
                <p>Download queue is empty.</p>
              </div>
            </div>
            <div class="civitai-status-section">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3>Download History (Recent)</h3>
                <button id="civitai-clear-history-button" class="civitai-button danger small" title="Clear all history items">
                  <i class="fas fa-trash-alt"></i> Clear History
                </button>
              </div>
              <div id="civitai-history-list" class="civitai-download-list">
                <p>No download history yet.</p>
              </div>
            </div>
          </div>
        </div>
        <div id="civitai-tab-settings" class="civitai-downloader-tab-content">
          <form id="civitai-settings-form">
            <div class="civitai-settings-container">
              <div class="civitai-settings-section">
                <h4>API & Defaults</h4>
                <div class="civitai-form-group">
                  <label for="civitai-settings-api-key">Civitai API Key (Optional)</label>
                  <input type="password" id="civitai-settings-api-key" class="civitai-input" placeholder="Enter API key for higher limits / authenticated access" autocomplete="new-password">
                  <p style="font-size: 0.85em; color: #bbb; margin-top: 5px;">Needed for some downloads/features. Find keys at civitai.com/user/account (also accessible via civit.com or civit.red)</p>
                </div>
                <div class="civitai-form-group">
                  <label for="civitai-settings-connections">Default Connections</label>
                  <input type="number" id="civitai-settings-connections" class="civitai-input" value="1" min="1" max="16" step="1" required disabled>
                  <p style="font-size: 0.85em; color: #bbb; margin-top: 5px;">Disabled. Only single connection possible for now</p>
                </div>
                <div class="civitai-form-group">
                  <label for="civitai-settings-default-type">Default Model Type (for saving)</label>
                  <select id="civitai-settings-default-type" class="civitai-select" required></select>
                </div>
              </div>
              <div class="civitai-settings-section">
                <h4>Interface & Search</h4>
                <div class="civitai-form-group inline">
                  <input type="checkbox" id="civitai-settings-auto-open-status" class="civitai-checkbox">
                  <label for="civitai-settings-auto-open-status">Switch to Status tab after starting download</label>
                </div>
                <div class="civitai-form-group inline">
                  <input type="checkbox" id="civitai-settings-hide-mature" class="civitai-checkbox" ${settings.hideMatureInSearch ? 'checked' : ''}>
                  <label for="civitai-settings-hide-mature">Hide R-rated (Mature) images in search (click to reveal)</label>
                </div>
                <div class="civitai-form-group">
                  <label for="civitai-settings-nsfw-threshold">NSFW Blur Threshold (nsfwLevel)</label>
                  <input type="number" id="civitai-settings-nsfw-threshold" class="civitai-input" value="${Number.isFinite(settings.nsfwBlurMinLevel) ? settings.nsfwBlurMinLevel : 4}" min="0" max="128" step="1">
                  <p style="font-size: 0.85em; color: #bbb; margin-top: 5px;">
                    Blur thumbnails when an image's <code>nsfwLevel</code> is greater than or equal to this value.
                    Higher numbers indicate more explicit content. None (Safe/PG): 1, Mild (PG-13): 2, Mature (R): 4, Adult (X): 5, Extra Explicit (R): 8, Explicit (XXX): 16/32+
                  </p>
                </div>
              </div>
            </div>
            <button type="submit" id="civitai-settings-save" class="civitai-button primary" style="margin-top: 20px;">Save Settings</button>
          </form>
        </div>
      </div>
      <!-- Toast Notification Area -->
      <div id="civitai-toast" class="civitai-toast"></div>
      <!-- Confirmation Modal -->
      <div id="civitai-confirm-clear-modal" class="civitai-confirmation-modal">
        <div class="civitai-confirmation-modal-content">
          <h4>Confirm Clear History</h4>
          <p>Are you sure you want to clear the download history? This action cannot be undone.</p>
          <div class="civitai-confirmation-modal-actions">
            <button id="civitai-confirm-clear-no" class="civitai-button secondary">Cancel</button>
            <button id="civitai-confirm-clear-yes" class="civitai-button danger">Confirm Clear</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
