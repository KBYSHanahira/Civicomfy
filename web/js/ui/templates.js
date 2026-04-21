// Modal template for Civicomfy UI

export function modalTemplate(settings = {}) {
  const numConnections = Number.isFinite(settings.numConnections) ? settings.numConnections : 1;
  return `
    <div class="civitai-downloader-modal-content">
      <div class="civitai-downloader-header">
        <h2><i class="fas fa-cloud-download-alt" style="color:var(--cfy-accent,#5c8aff);margin-right:8px;"></i>Civicomfy</h2>
        <div class="civitai-header-actions">
          <button class="civitai-icon-button" id="civitai-fullscreen-toggle" title="Toggle fullscreen"><i class="fas fa-expand"></i></button>
          <button class="civitai-close-button" id="civitai-close-modal" title="Close">&times;</button>
        </div>
      </div>
      <div class="civitai-downloader-body">
        <div class="civitai-downloader-tabs">
          <button class="civitai-downloader-tab active" data-tab="download"><i class="fas fa-download"></i> Download</button>
          <button class="civitai-downloader-tab" data-tab="browse"><i class="fas fa-compass"></i> Browse</button>
          <button class="civitai-downloader-tab" data-tab="mymodels"><i class="fas fa-layer-group"></i> My Models</button>
          <button class="civitai-downloader-tab" data-tab="status"><i class="fas fa-tasks"></i> Status <span id="civitai-status-indicator" style="display:none;">(<span id="civitai-active-count">0</span>)</span></button>
          <button class="civitai-downloader-tab" data-tab="settings"><i class="fas fa-cog"></i> Settings</button>
        </div>
        <div id="civitai-tab-download" class="civitai-downloader-tab-content active">
          <form id="civitai-download-form">
            <div class="civitai-form-group">
              <label for="civitai-model-url"><i class="fas fa-link" style="margin-right:5px;opacity:0.6;"></i>Model URL or ID</label>
              <input type="text" id="civitai-model-url" class="civitai-input" placeholder="https://civitai.com/models/12345  or  HuggingFace /resolve/ link" required>
              <p class="civitai-field-hint">Supports Civitai URLs/IDs and HuggingFace <code>/resolve/</code> or <code>/blob/</code> file links. Add <code>?modelVersionId=xxxxx</code> for a specific version.</p>
            </div>
            <div class="civitai-form-row">
              <div class="civitai-form-group">
                <label for="civitai-model-type"><i class="fas fa-folder-open" style="margin-right:5px;opacity:0.6;"></i>Model Type (Save Location)</label>
                <div class="civitai-input-btn-group">
                  <select id="civitai-model-type" class="civitai-select" required></select>
                  <button type="button" id="civitai-create-model-type" class="civitai-button small icon-only" title="Create new model type folder"><i class="fas fa-folder-plus"></i></button>
                </div>
              </div>
              <div class="civitai-form-group">
                <label for="civitai-subdir-select"><i class="fas fa-sitemap" style="margin-right:5px;opacity:0.6;"></i>Save Subfolder</label>
                <div class="civitai-input-btn-group">
                  <select id="civitai-subdir-select" class="civitai-select">
                    <option value="">(root)</option>
                  </select>
                  <button type="button" id="civitai-create-subdir" class="civitai-button small icon-only" title="Create new subfolder"><i class="fas fa-folder-plus"></i></button>
                </div>
              </div>
              <div class="civitai-form-group">
                <label for="civitai-model-version-id"><i class="fas fa-code-branch" style="margin-right:5px;opacity:0.6;"></i>Version ID <span style="font-weight:400;text-transform:none;font-size:0.95em;">(Optional)</span></label>
                <input type="number" id="civitai-model-version-id" class="civitai-input" placeholder="Overrides URL / Latest">
              </div>
            </div>
            <div class="civitai-form-row">
              <div class="civitai-form-group">
                <label for="civitai-custom-filename"><i class="fas fa-file-signature" style="margin-right:5px;opacity:0.6;"></i>Custom Filename <span style="font-weight:400;text-transform:none;font-size:0.95em;">(Optional)</span></label>
                <input type="text" id="civitai-custom-filename" class="civitai-input" placeholder="Leave blank to use original name">
              </div>
              <div class="civitai-form-group">
                <label for="civitai-connections"><i class="fas fa-plug" style="margin-right:5px;opacity:0.6;"></i>Connections</label>
                <input type="number" id="civitai-connections" class="civitai-input" value="${numConnections}" min="1" max="16" step="1" required disabled>
                <p class="civitai-field-hint"><i class="fas fa-info-circle" style="margin-right:3px;"></i>Only single connection supported currently.</p>
              </div>
            </div>
            <div class="civitai-form-group inline">
              <input type="checkbox" id="civitai-force-redownload" class="civitai-checkbox">
              <label for="civitai-force-redownload"><i class="fas fa-redo" style="margin-right:5px;opacity:0.6;"></i>Force Re-download (if file already exists)</label>
            </div>
            <div id="civitai-download-preview-area" class="civitai-download-preview-area">
              <!-- Preview content will be injected here -->
            </div>
            <div class="civitai-form-actions">
              <button type="submit" id="civitai-download-submit" class="civitai-button primary"><i class="fas fa-download"></i> Start Download</button>
            </div>
          </form>
        </div>
        <div id="civitai-tab-browse" class="civitai-downloader-tab-content">
          <div class="civitai-browse-header">
            <div class="civitai-browse-controls">
              <select id="civitai-browse-type-select" class="civitai-select" style="width:auto;flex-shrink:0;" title="Model Type">
                <option value="all">All Types</option>
                <!-- Model type options will be injected here by JS -->
              </select>
              <select id="civitai-browse-search-mode" class="civitai-select" style="width:auto;flex-shrink:0;" title="Search field">
                <option value="all">All Fields</option>
                <option value="name">By Name</option>
                <option value="username">By Username</option>
              </select>
              <input type="text" id="civitai-browse-search" class="civitai-input civitai-browse-search-input" placeholder="Search models..." autocomplete="off">
              <select id="civitai-browse-sort" class="civitai-select" style="min-width:155px;">
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
              <select id="civitai-browse-limit" class="civitai-select" style="width:auto;" title="Results per page">
                <option value="25" selected>25 / page</option>
                <option value="50">50 / page</option>
                <option value="75">75 / page</option>
                <option value="100">100 / page</option>
              </select>
              <div class="civitai-card-size-control" title="Card size">
                <i class="fas fa-th" style="font-size:0.8em;opacity:0.55;"></i>
                <input type="range" id="civitai-browse-card-size" min="120" max="280" step="10" value="158" style="width:70px;cursor:pointer;">
              </div>
              <button id="civitai-browse-refresh" class="civitai-button" title="Refresh"><i class="fas fa-sync-alt"></i></button>
            </div>
          </div>
          <div id="civitai-browse-selected-bar" class="civitai-browse-selected-bar" style="display:none;">
            <i class="fas fa-check-circle" style="color:var(--accent-color,#5c8aff);flex-shrink:0;"></i>
            <span class="civitai-browse-selected-label">Selected:</span>
            <span id="civitai-browse-selected-text" class="civitai-browse-selected-text"></span>
          </div>
          <div id="civitai-browse-results" class="civitai-browse-cards"></div>
          <div id="civitai-browse-pagination" class="civitai-browse-pagination"></div>
        </div>
        <div id="civitai-tab-mymodels" class="civitai-downloader-tab-content">
          <div class="civitai-mymodels-header">
            <div class="civitai-mymodels-controls">
              <div class="civitai-mymodels-controls-row">
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
                <select id="civitai-mymodels-limit" class="civitai-select" title="Items per page">
                  <option value="25">25 / page</option>
                  <option value="50" selected>50 / page</option>
                  <option value="75">75 / page</option>
                  <option value="100">100 / page</option>
                </select>
                <div class="civitai-card-size-control" title="Card size">
                  <i class="fas fa-th" style="font-size:0.8em;opacity:0.55;"></i>
                  <input type="range" id="civitai-mymodels-card-size" min="100" max="260" step="10" value="148" style="width:70px;cursor:pointer;">
                </div>
              </div>
              <div class="civitai-mymodels-controls-row civitai-mymodels-controls-row--info">
                <span id="civitai-mymodels-count" class="civitai-mymodels-count"></span>
                <button id="civitai-mymodels-refresh" class="civitai-button" title="Refresh list"><i class="fas fa-sync-alt"></i> Refresh</button>
              </div>
            </div>
          </div>
          <div id="civitai-mymodels-list" class="civitai-mymodels-list">
            <p>Click Refresh to load your local models.</p>
          </div>
          <div id="civitai-mymodels-pagination" class="civitai-mymodels-pagination"></div>
        </div>
        <div id="civitai-tab-status" class="civitai-downloader-tab-content">
          <div id="civitai-status-content">
            <div class="civitai-status-section">
              <h3><i class="fas fa-bolt"></i> Active Downloads</h3>
              <div id="civitai-active-list" class="civitai-download-list">
                <p>No active downloads.</p>
              </div>
            </div>
            <div class="civitai-status-section">
              <h3><i class="fas fa-clock"></i> Queued Downloads</h3>
              <div id="civitai-queued-list" class="civitai-download-list">
                <p>Download queue is empty.</p>
              </div>
            </div>
            <div class="civitai-status-section">
              <div class="civitai-status-history-header">
                <h3><i class="fas fa-history"></i> Recent History</h3>
                <button id="civitai-clear-history-button" class="civitai-button danger small" title="Clear all history items">
                  <i class="fas fa-trash-alt"></i> Clear
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
                <h4><i class="fas fa-key"></i> API & Defaults</h4>
                <div class="civitai-form-group">
                  <label for="civitai-settings-api-key">Civitai API Key <span style="font-weight:400;">(Optional)</span></label>
                  <input type="password" id="civitai-settings-api-key" class="civitai-input" placeholder="Enter API key for higher limits / authenticated access" autocomplete="new-password">
                  <p class="civitai-field-hint">Needed for some downloads/features. Find keys at civitai.com/user/account</p>
                </div>
                <div class="civitai-form-group">
                  <label for="civitai-settings-hf-token">HuggingFace Token <span style="font-weight:400;">(Optional)</span></label>
                  <input type="password" id="civitai-settings-hf-token" class="civitai-input" placeholder="hf_..." autocomplete="new-password">
                  <p class="civitai-field-hint">Required for gated/private models on huggingface.co/settings/tokens</p>
                </div>
                <div class="civitai-form-group">
                  <label for="civitai-settings-connections">Default Connections</label>
                  <input type="number" id="civitai-settings-connections" class="civitai-input" value="1" min="1" max="16" step="1" required disabled>
                  <p class="civitai-field-hint"><i class="fas fa-info-circle" style="margin-right:3px;"></i>Only single connection supported currently.</p>
                </div>
                <div class="civitai-form-group">
                  <label for="civitai-settings-default-type">Default Model Type (for saving)</label>
                  <select id="civitai-settings-default-type" class="civitai-select" required></select>
                </div>
              </div>
              <div class="civitai-settings-section">
                <h4><i class="fas fa-sliders-h"></i> Interface & Search</h4>
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
                  <p class="civitai-field-hint">
                    Blur thumbnails when nsfwLevel &ge; this value. Safe: 1 &bull; PG-13: 2 &bull; R: 4 &bull; X: 5 &bull; Explicit: 16/32+
                  </p>
                </div>
              </div>

              <!-- ── Model Maintenance ─────────────────── -->
              <div class="civitai-settings-section">
                <h4><i class="fas fa-sync-alt"></i> Model Maintenance</h4>
                <p class="civitai-field-hint" style="margin-bottom:10px;">
                  Select the model categories to process, then use the buttons below to refresh metadata or update thumbnails from Civitai.
                </p>

                <!-- Category picker -->
                <div class="civitai-form-group">
                  <label>Model Categories</label>
                  <div class="civitai-maintenance-type-picker" id="civitai-maintenance-type-picker">
                    <label class="civitai-maintenance-type-opt">
                      <input type="checkbox" value="" id="civitai-maint-all" class="civitai-checkbox" checked>
                      <span>All</span>
                    </label>
                    <!-- Additional checkboxes injected by JS after model types are loaded -->
                  </div>
                </div>

                <!-- Force re-download option for thumbnails -->
                <div class="civitai-form-group inline">
                  <input type="checkbox" id="civitai-maint-force-thumb" class="civitai-checkbox">
                  <label for="civitai-maint-force-thumb">Force re-download existing thumbnails</label>
                </div>

                <!-- Action buttons -->
                <div class="civitai-maintenance-actions">
                  <button type="button" id="civitai-refresh-model-info-btn" class="civitai-button secondary">
                    <i class="fas fa-database"></i> Refresh Model Info
                  </button>
                  <button type="button" id="civitai-update-thumbnails-btn" class="civitai-button secondary">
                    <i class="fas fa-image"></i> Update Thumbnails
                  </button>
                </div>

                <!-- Controls shown while an operation is running -->
                <div id="civitai-maintenance-controls" style="display:none; margin-top:8px; gap:6px; flex-wrap:wrap;">
                  <button type="button" id="civitai-maint-stop-btn" class="civitai-button danger small">
                    <i class="fas fa-stop"></i> Stop
                  </button>
                  <button type="button" id="civitai-maint-skip-btn" class="civitai-button secondary small">
                    <i class="fas fa-forward"></i> Skip
                  </button>
                </div>

                <!-- Progress / result area -->
                <div id="civitai-maintenance-result" class="civitai-maintenance-result" style="display:none;"></div>
              </div>
            </div>
            <div class="civitai-form-actions">
              <button type="submit" id="civitai-settings-save" class="civitai-button primary"><i class="fas fa-save"></i> Save Settings</button>
            </div>
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
