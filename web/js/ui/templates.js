// Modal template for Civicomfy UI
//
// Layout: a left navigation rail (grouped by task) plus a main column with a
// page header and one panel per section. Every element id used by the handlers
// is preserved — the rail buttons keep the `civitai-downloader-tab` class and
// `data-tab` attribute that switchTab() relies on.

// Page titles shown in the top bar, keyed by tab id.
export const PAGE_META = {
  download:  { title: 'Download',   sub: 'Paste a Civitai or HuggingFace link and pick where it lands' },
  browse:    { title: 'Browse',     sub: 'Search the Civitai catalogue and queue models directly' },
  mymodels:  { title: 'My Models',  sub: 'Everything installed in your ComfyUI models folder' },
  gallery:   { title: 'Gallery',    sub: 'Images generated in your ComfyUI output folder' },
  status:    { title: 'Activity',   sub: 'Active downloads, queue and history' },
  settings:  { title: 'Settings',   sub: 'API keys, interface preferences and model maintenance' },
  directory: { title: 'Directories', sub: 'Per-model-type save folders' },
};

export function modalTemplate(settings = {}) {
  const numConnections = Number.isFinite(settings.numConnections) ? settings.numConnections : 1;
  return `
    <div class="civitai-downloader-modal-content">
      <aside class="civitai-rail">
        <div class="civitai-rail-brand">
          <span class="civitai-rail-logo"><i class="fas fa-cloud-download-alt"></i></span>
          <span class="civitai-rail-brand-text">
            <strong>Civicomfy</strong>
            <small>Model manager</small>
          </span>
        </div>
        <nav class="civitai-downloader-tabs" aria-label="Sections">
          <div class="civitai-nav-group">
            <div class="civitai-nav-group-label">Get models</div>
            <button type="button" class="civitai-downloader-tab active" data-tab="download" title="Download">
              <i class="fas fa-download"></i><span>Download</span>
            </button>
            <button type="button" class="civitai-downloader-tab" data-tab="browse" title="Browse Civitai">
              <i class="fas fa-compass"></i><span>Browse</span>
            </button>
          </div>
          <div class="civitai-nav-group">
            <div class="civitai-nav-group-label">Library</div>
            <button type="button" class="civitai-downloader-tab" data-tab="mymodels" title="My Models">
              <i class="fas fa-layer-group"></i><span>My Models</span>
            </button>
            <button type="button" class="civitai-downloader-tab" data-tab="gallery" title="Gallery">
              <i class="fas fa-images"></i><span>Gallery</span>
            </button>
          </div>
          <div class="civitai-nav-group">
            <div class="civitai-nav-group-label">Activity</div>
            <button type="button" class="civitai-downloader-tab" data-tab="status" title="Downloads in progress">
              <i class="fas fa-tasks"></i><span>Downloads</span>
              <span class="civitai-nav-badge" id="civitai-status-indicator" style="display:none;"><span id="civitai-active-count">0</span></span>
            </button>
          </div>
          <div class="civitai-nav-group">
            <div class="civitai-nav-group-label">Configure</div>
            <button type="button" class="civitai-downloader-tab" data-tab="settings" title="Settings">
              <i class="fas fa-sliders-h"></i><span>Settings</span>
            </button>
            <button type="button" class="civitai-downloader-tab" data-tab="directory" title="Directories">
              <i class="fas fa-sitemap"></i><span>Directories</span>
            </button>
          </div>
        </nav>
        <div class="civitai-rail-footer">
          <button type="button" class="civitai-rail-action" id="civitai-theme-toggle" title="Switch between the dark and light Claude theme">
            <i class="fas fa-adjust"></i><span>Light theme</span>
          </button>
          <button type="button" class="civitai-rail-action" id="civitai-rail-collapse" title="Collapse the sidebar">
            <i class="fas fa-angle-double-left"></i><span>Collapse</span>
          </button>
        </div>
      </aside>
      <div class="civitai-rail-scrim" id="civitai-rail-scrim"></div>
      <div class="civitai-main">
        <div class="civitai-downloader-header">
          <button class="civitai-icon-button civitai-rail-open" id="civitai-rail-open" title="Show sections"><i class="fas fa-bars"></i></button>
          <div class="civitai-page-title-wrap">
            <h2 id="civitai-page-title">${PAGE_META.download.title}</h2>
            <p class="civitai-page-sub" id="civitai-page-sub">${PAGE_META.download.sub}</p>
          </div>
          <div class="civitai-header-actions">
            <button class="civitai-icon-button" id="civitai-fullscreen-toggle" title="Toggle fullscreen"><i class="fas fa-expand"></i></button>
            <button class="civitai-close-button" id="civitai-close-modal" title="Close (Esc)">&times;</button>
          </div>
        </div>
        <div class="civitai-downloader-body">
        <div id="civitai-tab-download" class="civitai-downloader-tab-content active">
          <form id="civitai-download-form">
            <div class="civitai-card">
              <div class="civitai-card-head">
                <i class="fas fa-link"></i>
                <h4>Source</h4>
              </div>
              <div class="civitai-form-group">
                <label for="civitai-model-url">Model URL or ID</label>
                <input type="text" id="civitai-model-url" class="civitai-input" placeholder="https://civitai.com/models/12345  or  HuggingFace /resolve/ link" required>
                <p class="civitai-field-hint">Civitai URLs/IDs and HuggingFace <code>/resolve/</code> or <code>/blob/</code> links are supported. Append <code>?modelVersionId=xxxxx</code> to pin a version.</p>
              </div>
              <div class="civitai-form-group">
                <label for="civitai-model-version-id">Version ID <span class="civitai-optional">(optional)</span></label>
                <input type="number" id="civitai-model-version-id" class="civitai-input" placeholder="Overrides the URL — leave blank for latest">
              </div>
            </div>

            <div class="civitai-card">
              <div class="civitai-card-head">
                <i class="fas fa-folder-open"></i>
                <h4>Destination</h4>
              </div>
              <div class="civitai-form-row">
                <div class="civitai-form-group">
                  <label for="civitai-model-type">Model type <span class="civitai-optional">(folder)</span></label>
                  <div class="civitai-input-btn-group">
                    <select id="civitai-model-type" class="civitai-select" required></select>
                    <button type="button" id="civitai-create-model-type" class="civitai-button icon-only" title="Create new model type folder"><i class="fas fa-folder-plus"></i></button>
                  </div>
                </div>
                <div class="civitai-form-group">
                  <label for="civitai-subdir-select">Subfolder</label>
                  <div class="civitai-input-btn-group">
                    <select id="civitai-subdir-select" class="civitai-select">
                      <option value="">(root)</option>
                    </select>
                    <button type="button" id="civitai-create-subdir" class="civitai-button icon-only" title="Create new subfolder"><i class="fas fa-folder-plus"></i></button>
                  </div>
                </div>
              </div>
              <div class="civitai-form-group">
                <label for="civitai-custom-filename">Custom filename <span class="civitai-optional">(optional)</span></label>
                <input type="text" id="civitai-custom-filename" class="civitai-input" placeholder="Leave blank to keep the original name">
              </div>
            </div>

            <div class="civitai-card">
              <div class="civitai-card-head">
                <i class="fas fa-cog"></i>
                <h4>Transfer options</h4>
              </div>
              <div class="civitai-form-group inline">
                <input type="checkbox" id="civitai-force-redownload" class="civitai-checkbox">
                <label for="civitai-force-redownload">Force re-download even if the file already exists</label>
              </div>
              <div class="civitai-form-group">
                <label for="civitai-connections">Connections</label>
                <input type="number" id="civitai-connections" class="civitai-input" value="${numConnections}" min="1" max="16" step="1" required disabled>
                <p class="civitai-field-hint"><i class="fas fa-info-circle"></i> Only a single connection is supported at the moment.</p>
              </div>
            </div>

            <!-- Kept literally empty: .civitai-download-preview-area:empty is what
                 hides the box before a model is resolved. -->
            <div id="civitai-download-preview-area" class="civitai-download-preview-area"></div>
            <div class="civitai-form-actions">
              <span class="civitai-form-actions-hint"><i class="fas fa-info-circle"></i> The preview above confirms the exact file and folder before you start.</span>
              <button type="submit" id="civitai-download-submit" class="civitai-button primary"><i class="fas fa-download"></i> Start download</button>
            </div>
          </form>
        </div>
        <div id="civitai-tab-browse" class="civitai-downloader-tab-content">
          <div class="civitai-browse-header civitai-toolbar">
            <div class="civitai-browse-controls civitai-toolbar-row">
              <input type="text" id="civitai-browse-search" class="civitai-input civitai-browse-search-input" placeholder="Search models..." autocomplete="off">
              <select id="civitai-browse-search-mode" class="civitai-select civitai-toolbar-select" title="Search field">
                <option value="all">All fields</option>
                <option value="name">By name</option>
                <option value="username">By username</option>
              </select>
              <div class="civitai-toolbar-spacer"></div>
              <div class="civitai-card-size-control" title="Card size">
                <i class="fas fa-th"></i>
                <input type="range" id="civitai-browse-card-size" min="120" max="280" step="10" value="158">
              </div>
              <button id="civitai-browse-refresh" class="civitai-button icon-only" title="Refresh results"><i class="fas fa-sync-alt"></i></button>
            </div>
            <div class="civitai-toolbar-row civitai-toolbar-row--filters">
              <span class="civitai-toolbar-label">Filter</span>
              <select id="civitai-browse-type-select" class="civitai-select civitai-toolbar-select" title="Model Type">
                <option value="all">All types</option>
                <!-- Model type options will be injected here by JS -->
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
              <span class="civitai-toolbar-label">Sort</span>
              <select id="civitai-browse-sort" class="civitai-select civitai-toolbar-select civitai-toolbar-select--wide">
                <option value="Most Downloaded">Most Downloaded</option>
                <option value="Highest Rated">Highest Rated</option>
                <option value="Most Liked">Most Liked</option>
                <option value="Newest">Newest</option>
                <option value="Most Discussed">Most Discussed</option>
                <option value="Most Collected">Most Collected</option>
              </select>
              <select id="civitai-browse-limit" class="civitai-select civitai-toolbar-select" title="Results per page">
                <option value="25" selected>25 / page</option>
                <option value="50">50 / page</option>
                <option value="75">75 / page</option>
                <option value="100">100 / page</option>
              </select>
            </div>
          </div>
          <div id="civitai-browse-selected-bar" class="civitai-browse-selected-bar" style="display:none;">
            <i class="fas fa-check-circle"></i>
            <span class="civitai-browse-selected-label">Selected:</span>
            <span id="civitai-browse-selected-text" class="civitai-browse-selected-text"></span>
          </div>
          <div id="civitai-browse-results" class="civitai-browse-cards"></div>
          <div id="civitai-browse-pagination" class="civitai-browse-pagination"></div>
        </div>
        <div id="civitai-tab-mymodels" class="civitai-downloader-tab-content">
          <div class="civitai-mymodels-header civitai-toolbar">
            <div class="civitai-mymodels-controls-row civitai-toolbar-row">
              <input type="text" id="civitai-mymodels-search" class="civitai-input" placeholder="Filter by name...">
              <span id="civitai-mymodels-count" class="civitai-mymodels-count"></span>
              <div class="civitai-toolbar-spacer"></div>
              <div class="civitai-card-size-control" title="Card size">
                <i class="fas fa-th"></i>
                <input type="range" id="civitai-mymodels-card-size" min="100" max="260" step="10" value="148">
              </div>
              <button id="civitai-mymodels-refresh" class="civitai-button" title="Reload the list from disk"><i class="fas fa-sync-alt"></i> Refresh</button>
            </div>
            <div class="civitai-mymodels-controls-row civitai-toolbar-row civitai-toolbar-row--filters">
              <span class="civitai-toolbar-label">Filter</span>
              <select id="civitai-mymodels-type-filter" class="civitai-select civitai-toolbar-select" title="Filter by model type">
                <option value="">All types</option>
              </select>
              <div id="civitai-mymodels-base-model-picker" class="civitai-base-model-picker">
                <button type="button" class="civitai-base-model-picker-toggle" id="civitai-mymodels-base-model-toggle" title="Filter by base model">
                  <span id="civitai-mymodels-base-model-label">All Base Models</span> <i class="fas fa-chevron-down"></i>
                </button>
                <div class="civitai-base-model-picker-dropdown" id="civitai-mymodels-base-model-dropdown" style="display:none;">
                  <div class="civitai-base-model-picker-search-wrap">
                    <input type="text" id="civitai-mymodels-base-model-search" class="civitai-input" placeholder="Filter..." autocomplete="off">
                  </div>
                  <div class="civitai-base-model-picker-options" id="civitai-mymodels-base-model-options"></div>
                  <div class="civitai-base-model-picker-footer">
                    <button type="button" id="civitai-mymodels-base-model-clear" class="civitai-button small secondary">Clear</button>
                  </div>
                </div>
              </div>
              <span class="civitai-toolbar-label">Sort</span>
              <select id="civitai-mymodels-sort" class="civitai-select civitai-toolbar-select" title="Sort models">
                <option value="name_asc">Name (A → Z)</option>
                <option value="name_desc">Name (Z → A)</option>
                <option value="time_desc" selected>Newest first</option>
                <option value="time_asc">Oldest first</option>
                <option value="size_desc">Size (large first)</option>
                <option value="size_asc">Size (small first)</option>
              </select>
              <select id="civitai-mymodels-limit" class="civitai-select civitai-toolbar-select" title="Items per page">
                <option value="25">25 / page</option>
                <option value="50" selected>50 / page</option>
                <option value="75">75 / page</option>
                <option value="100">100 / page</option>
              </select>
            </div>
          </div>
          <div id="civitai-mymodels-list" class="civitai-mymodels-list">
            <p class="civitai-empty-state"><i class="fas fa-layer-group"></i> Click <strong>Refresh</strong> to load your local models.</p>
          </div>
          <div id="civitai-mymodels-pagination" class="civitai-mymodels-pagination"></div>
        </div>
        <div id="civitai-tab-gallery" class="civitai-downloader-tab-content">
          <div class="civitai-gallery-header civitai-toolbar">
            <div class="civitai-gallery-controls civitai-toolbar-row">
              <select id="civitai-gallery-subfolder" class="civitai-select civitai-toolbar-select civitai-toolbar-select--wide" title="Filter by subfolder">
                <option value="">All subfolders</option>
              </select>
              <span id="civitai-gallery-count" class="civitai-mymodels-count"></span>
              <div class="civitai-toolbar-spacer"></div>
              <div class="civitai-card-size-control" title="Thumbnail size">
                <i class="fas fa-th"></i>
                <input type="range" id="civitai-gallery-card-size" min="100" max="300" step="10" value="148">
              </div>
              <button id="civitai-gallery-refresh" class="civitai-button icon-only" title="Refresh gallery"><i class="fas fa-sync-alt"></i></button>
            </div>
            <div class="civitai-toolbar-row civitai-toolbar-row--filters">
              <span class="civitai-toolbar-label">Sort</span>
              <select id="civitai-gallery-sort" class="civitai-select civitai-toolbar-select" title="Sort">
                <option value="time_desc" selected>Newest first</option>
                <option value="time_asc">Oldest first</option>
                <option value="name_asc">Name (A → Z)</option>
                <option value="name_desc">Name (Z → A)</option>
              </select>
              <select id="civitai-gallery-limit" class="civitai-select civitai-toolbar-select" title="Images per page">
                <option value="30" selected>30 / page</option>
                <option value="50">50 / page</option>
                <option value="100">100 / page</option>
                <option value="200">200 / page</option>
              </select>
            </div>
          </div>
          <!-- Multi-select action bar -->
          <div id="civitai-gallery-select-bar" class="civitai-gallery-select-bar" style="display:none;">
            <i class="fas fa-check-circle"></i>
            <span id="civitai-gallery-select-count" class="civitai-gallery-select-count">0 selected</span>
            <button id="civitai-gallery-select-all" class="civitai-button small secondary"><i class="fas fa-check-double"></i> Select all</button>
            <button id="civitai-gallery-deselect-all" class="civitai-button small secondary"><i class="fas fa-times"></i> Deselect all</button>
            <div class="civitai-toolbar-spacer"></div>
            <button id="civitai-gallery-download-selected" class="civitai-button small primary"><i class="fas fa-download"></i> Download</button>
            <button id="civitai-gallery-delete-selected" class="civitai-button small danger"><i class="fas fa-trash-alt"></i> Delete</button>
          </div>
          <div id="civitai-gallery-grid" class="civitai-gallery-grid"></div>
          <div id="civitai-gallery-pagination" class="civitai-gallery-pagination"></div>
        </div>
        <!-- Gallery Lightbox -->
        <div id="civitai-gallery-lightbox" class="civitai-gallery-lightbox" style="display:none;">
          <div class="civitai-gallery-lightbox-backdrop"></div>
          <button class="civitai-gallery-lightbox-nav prev" id="civitai-gallery-lightbox-prev" title="Previous"><i class="fas fa-chevron-left"></i></button>
          <button class="civitai-gallery-lightbox-nav next" id="civitai-gallery-lightbox-next" title="Next"><i class="fas fa-chevron-right"></i></button>
          <div class="civitai-gallery-lightbox-content">
            <button class="civitai-gallery-lightbox-close" id="civitai-gallery-lightbox-close" title="Close"><i class="fas fa-times"></i></button>
            <img id="civitai-gallery-lightbox-img" src="" alt="" class="civitai-gallery-lightbox-img">
            <video id="civitai-gallery-lightbox-video" class="civitai-gallery-lightbox-video" controls loop playsinline preload="metadata" style="display:none;"></video>
            <div class="civitai-gallery-lightbox-info">
              <span id="civitai-gallery-lightbox-name" class="civitai-gallery-lightbox-name"></span>
              <span id="civitai-gallery-lightbox-meta" class="civitai-gallery-lightbox-meta"></span>
              <div class="civitai-gallery-lightbox-actions">
                <button type="button" class="civitai-button small" id="civitai-gallery-lightbox-download" title="Download image">
                  <i class="fas fa-download"></i> Download
                </button>
                <button type="button" class="civitai-button small danger" id="civitai-gallery-lightbox-delete" title="Delete image">
                  <i class="fas fa-trash-alt"></i> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
        <div id="civitai-tab-status" class="civitai-downloader-tab-content">
          <div id="civitai-status-content">
            <div class="civitai-status-section">
              <h3><i class="fas fa-bolt"></i> Active downloads</h3>
              <div id="civitai-active-list" class="civitai-download-list">
                <p>No active downloads.</p>
              </div>
            </div>
            <div class="civitai-status-section">
              <h3><i class="fas fa-clock"></i> Queued</h3>
              <div id="civitai-queued-list" class="civitai-download-list">
                <p>Download queue is empty.</p>
              </div>
            </div>
            <div class="civitai-status-section">
              <div class="civitai-status-history-header">
                <h3><i class="fas fa-history"></i> Recent history</h3>
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
                <h4><i class="fas fa-key"></i> Accounts &amp; defaults</h4>
                <div class="civitai-form-group">
                  <label for="civitai-settings-api-key">Civitai API key <span class="civitai-optional">(optional)</span></label>
                  <input type="password" id="civitai-settings-api-key" class="civitai-input" placeholder="Enter API key for higher limits / authenticated access" autocomplete="new-password">
                  <p class="civitai-field-hint">Needed for some downloads. Create one at civitai.com/user/account</p>
                </div>
                <div class="civitai-form-group">
                  <label for="civitai-settings-hf-token">HuggingFace token <span class="civitai-optional">(optional)</span></label>
                  <input type="password" id="civitai-settings-hf-token" class="civitai-input" placeholder="hf_..." autocomplete="new-password">
                  <p class="civitai-field-hint">Required for gated or private repos — huggingface.co/settings/tokens</p>
                </div>
                <div class="civitai-form-group">
                  <label for="civitai-settings-default-type">Default model type</label>
                  <select id="civitai-settings-default-type" class="civitai-select" required></select>
                  <p class="civitai-field-hint">Pre-selected save folder for new downloads.</p>
                </div>
                <div class="civitai-form-group">
                  <label for="civitai-settings-connections">Default connections</label>
                  <input type="number" id="civitai-settings-connections" class="civitai-input" value="1" min="1" max="16" step="1" required disabled>
                  <p class="civitai-field-hint"><i class="fas fa-info-circle"></i> Only a single connection is supported at the moment.</p>
                </div>
              </div>
              <div class="civitai-settings-section">
                <h4><i class="fas fa-sliders-h"></i> Interface &amp; content</h4>
                <div class="civitai-form-group inline">
                  <input type="checkbox" id="civitai-settings-auto-open-status" class="civitai-checkbox" ${settings.autoOpenStatusTab ? 'checked' : ''}>
                  <label for="civitai-settings-auto-open-status">Jump to Downloads after starting a download</label>
                </div>
                <div class="civitai-form-group inline">
                  <input type="checkbox" id="civitai-settings-deep-subfolder-check" class="civitai-checkbox" ${settings.deepSubfolderCheck ? 'checked' : ''}>
                  <label for="civitai-settings-deep-subfolder-check">Search all subfolders for an existing copy before downloading</label>
                </div>
                <div class="civitai-form-group inline">
                  <input type="checkbox" id="civitai-settings-hide-mature" class="civitai-checkbox" ${settings.hideMatureInSearch ? 'checked' : ''}>
                  <label for="civitai-settings-hide-mature">Blur mature imagery until clicked</label>
                </div>
                <div class="civitai-form-group">
                  <label for="civitai-settings-nsfw-threshold">Blur threshold</label>
                  <select id="civitai-settings-nsfw-threshold" class="civitai-select">
                    <option value="1">Soft &amp; above (most strict)</option>
                    <option value="2">PG-13 &amp; above</option>
                    <option value="4">R &amp; above (recommended)</option>
                    <option value="8">X &amp; above</option>
                    <option value="16">XXX / Explicit only</option>
                    <option value="32">Blocked only (least strict)</option>
                    <option value="128">🔓 Unlock everything — show all, never blur</option>
                  </select>
                  <p class="civitai-field-hint">Thumbnails blur when a model's rating reaches this level. <strong>Unlock everything</strong> also stops Civitai from holding back results — models whose imagery is entirely explicit only appear in Browse and Search at that setting.</p>
                </div>
                <div class="civitai-form-group">
                  <label for="civitai-settings-civitai-domain">Civitai link domain</label>
                  <select id="civitai-settings-civitai-domain" class="civitai-select">
                    <option value="civitai.com" ${(settings.civitaiDomain || 'civitai.com') === 'civitai.com' ? 'selected' : ''}>civitai.com</option>
                    <option value="civitai.red" ${settings.civitaiDomain === 'civitai.red' ? 'selected' : ''}>civitai.red</option>
                  </select>
                  <p class="civitai-field-hint">Domain used whenever Civicomfy opens a model link.</p>
                </div>
              </div>

              <!-- ── Model Maintenance ─────────────────── -->
              <div class="civitai-settings-section civitai-settings-section--wide">
                <h4><i class="fas fa-wrench"></i> Model maintenance</h4>
                <p class="civitai-field-hint" style="margin-bottom:12px;">
                  Pick the categories to process, then refresh metadata or re-fetch thumbnails from Civitai.
                </p>

                <!-- Category picker -->
                <div class="civitai-form-group">
                  <label>Categories</label>
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
                  <label for="civitai-maint-force-thumb">Force re-download of existing thumbnails</label>
                </div>

                <!-- Action buttons -->
                <div class="civitai-maintenance-actions">
                  <button type="button" id="civitai-refresh-model-info-btn" class="civitai-button secondary">
                    <i class="fas fa-database"></i> Refresh model info
                  </button>
                  <button type="button" id="civitai-update-thumbnails-btn" class="civitai-button secondary">
                    <i class="fas fa-image"></i> Update thumbnails
                  </button>
                  <div id="civitai-maintenance-controls" class="civitai-maintenance-running" style="display:none;">
                    <button type="button" id="civitai-maint-stop-btn" class="civitai-button danger small">
                      <i class="fas fa-stop"></i> Stop
                    </button>
                    <button type="button" id="civitai-maint-skip-btn" class="civitai-button secondary small">
                      <i class="fas fa-forward"></i> Skip
                    </button>
                  </div>
                </div>

                <!-- Progress / result area -->
                <div id="civitai-maintenance-result" class="civitai-maintenance-result" style="display:none;"></div>
              </div>
            </div>
            <div class="civitai-form-actions">
              <span class="civitai-form-actions-hint"><i class="fas fa-info-circle"></i> Settings are stored in this browser.</span>
              <button type="submit" id="civitai-settings-save" class="civitai-button primary"><i class="fas fa-save"></i> Save settings</button>
            </div>
          </form>
        </div>
        <div id="civitai-tab-directory" class="civitai-downloader-tab-content">
          <div class="civitai-settings-container">
            <div class="civitai-settings-section civitai-settings-section--wide">
              <div class="civitai-dir-settings-header">
                <h4><i class="fas fa-sitemap"></i> Save folders</h4>
                <button type="button" id="civitai-dir-refresh-btn" class="civitai-button small secondary" title="Reload directory list">
                  <i class="fas fa-sync-alt"></i> Refresh
                </button>
              </div>
              <p class="civitai-field-hint" style="margin-bottom:12px;">
                Override the save folder for any model type. Leave a row blank to keep the default shown as its placeholder.
              </p>
              <div id="civitai-dir-settings-list" class="civitai-dir-settings-list">
                <p class="civitai-field-hint"><i class="fas fa-spinner fa-spin"></i> Loading directories...</p>
              </div>
            </div>
          </div>
          <div class="civitai-form-actions">
            <span class="civitai-form-actions-hint"><i class="fas fa-info-circle"></i> Paths are validated on the server before they are saved.</span>
            <button type="button" id="civitai-dir-save-btn" class="civitai-button primary">
              <i class="fas fa-save"></i> Save directories
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
    <!-- The toast lives OUTSIDE .civitai-downloader-modal-content: the
         backdrop-filter on the wrapper makes it the containing block for fixed
         positioning, so anything fixed inside the content box gets clipped by
         its overflow:hidden (toasts were invisible on tall screens). The
         dialog in ui/dialog.js mounts itself here for the same reason. -->
    <div id="civitai-toast" class="civitai-toast"></div>
  `;
}
