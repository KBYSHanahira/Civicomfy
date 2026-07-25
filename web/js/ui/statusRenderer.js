// Renders active/queued/history download lists

const PLACEHOLDER_IMAGE_URL = `/extensions/Civicomfy/images/placeholder.jpeg`;

// Escape a value for safe interpolation into HTML text or a double-quoted
// attribute. Model/version/file names and error text can contain markup or
// stray quotes that would otherwise break out of the surrounding context.
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderDownloadList(ui, items, container, emptyMessage) {
  if (!items || items.length === 0) {
    container.innerHTML = `<p class="civitai-empty-state">${emptyMessage}</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const id = item.id || 'unknown-id';
    const progress = item.progress !== undefined ? Math.max(0, Math.min(100, item.progress)) : 0;
    const speed = item.speed !== undefined ? Math.max(0, item.speed) : 0;
    const status = item.status || 'unknown';
    const size = item.known_size !== undefined && item.known_size !== null ? item.known_size : (item.file_size || 0);
    const downloadedBytes = size > 0 ? size * (progress / 100) : 0;
    const errorMsg = item.error || null;
    const modelName = item.model_name || item.model?.name || 'Unknown Model';
    const versionName = item.version_name || 'Unknown Version';
    const filename = item.filename || 'N/A';
    const addedTime = item.added_time || null;
    const startTime = item.start_time || null;
    const endTime = item.end_time || null;
    const outputDir = item.output_dir || null;
    const thumbnail = item.thumbnail || PLACEHOLDER_IMAGE_URL;
    const nsfwLevel = Number(item.thumbnail_nsfw_level ?? 0);
    const blurMinLevel = Number(ui.settings?.nsfwBlurMinLevel ?? 4);
    const shouldBlur = ui.settings?.hideMatureInSearch === true && nsfwLevel >= blurMinLevel;
    const connectionType = item.connection_type || "N/A";

    let progressBarClass = '';
    let statusText = status.charAt(0).toUpperCase() + status.slice(1);
    switch (status) {
      case 'completed': progressBarClass = 'completed'; break;
      case 'failed': progressBarClass = 'failed'; statusText = 'Failed'; break;
      case 'cancelled': progressBarClass = 'cancelled'; statusText = 'Cancelled'; break;
      case 'downloading': case 'queued': case 'starting': default: break;
    }

    const listItem = document.createElement('div');
    listItem.className = 'civitai-download-item';
    listItem.dataset.id = id;

    const onErrorScript = `this.onerror=null; this.src='${PLACEHOLDER_IMAGE_URL}'; this.style.backgroundColor='transparent';`;
    const addedTooltip = addedTime ? `data-tooltip="Added: ${new Date(addedTime).toLocaleString()}"` : '';
    const startedTooltip = startTime ? `data-tooltip="Started: ${new Date(startTime).toLocaleString()}"` : '';
    const endedTooltip = endTime ? `data-tooltip="Ended: ${new Date(endTime).toLocaleString()}"` : '';
    const durationTooltip = startTime && endTime ? `data-tooltip="Duration: ${ui.formatDuration(startTime, endTime)}"` : '';
    const filenameTooltip = filename !== 'N/A' ? `title="Filename: ${esc(filename)}"` : '';
    const errorTooltip = errorMsg ? `title="Error Details: ${esc(String(errorMsg).substring(0, 200))}${String(errorMsg).length > 200 ? '...' : ''}"` : '';

    const overlayHtml = shouldBlur ? `<div class=\"civitai-nsfw-overlay\" title=\"R-rated: click to reveal\">R</div>` : '';
    const containerClasses = `civitai-thumbnail-container${shouldBlur ? ' blurred' : ''}`;

    // File facts as a single wrapped chip row instead of one labelled line each —
    // an item used to be ~250px tall, so barely two downloads fit on screen.
    const chip = (text, icon, tip) => text
      ? `<span class="civitai-dl-chip"${tip ? ` title="${esc(tip)}"` : ''}>${icon ? `<i class="fas ${icon}"></i>` : ''}${esc(text)}</span>`
      : '';
    const chipsHtml = [
      chip(versionName !== 'Unknown Version' ? versionName : '', 'fa-code-branch', 'Version'),
      chip(size > 0 ? ui.formatBytes(size) : '', 'fa-hdd', 'File size'),
      chip(item.file_format || '', '', 'Format'),
      chip(item.file_precision ? String(item.file_precision).toUpperCase() : '', '', 'Precision'),
      chip(item.file_model_size || '', '', 'Model size'),
      // Only worth showing when it isn't the single-connection default.
      (connectionType !== 'N/A' && String(connectionType) !== '1')
        ? `<span class="civitai-dl-chip" title="Connections">${esc(connectionType)} conn</span>` : '',
    ].filter(Boolean).join('');

    const statusModifier = {
      downloading: 'active', starting: 'active', queued: 'queued',
      completed: 'completed', failed: 'failed', cancelled: 'cancelled',
    }[status] || 'queued';
    const timeTooltip = durationTooltip || endedTooltip || startedTooltip || addedTooltip;

    let innerHTML = `
      <div class="${containerClasses}" data-nsfw-level="${Number.isFinite(nsfwLevel) ? nsfwLevel : ''}">
        <img src="${esc(thumbnail)}" alt="thumbnail" class="civitai-download-thumbnail" loading="lazy" onerror="${onErrorScript}">
        ${overlayHtml}
      </div>
      <div class="civitai-download-info">
        <div class="civitai-dl-titlerow">
          <strong class="civitai-dl-name" title="${esc(modelName)}">${esc(modelName)}</strong>
          <span class="civitai-dl-status civitai-dl-status--${statusModifier}" ${timeTooltip}>${esc(statusText)}</span>
        </div>
        ${chipsHtml ? `<div class="civitai-dl-chips">${chipsHtml}</div>` : ''}
        <p class="filename" ${filenameTooltip}>${esc(filename)}</p>
        ${outputDir ? `<p class="output-dir" title="Saving to: ${esc(outputDir)}"><i class="fas fa-folder"></i> ${esc(outputDir)}</p>` : ''}
        ${errorMsg ? `<p class="error-message" ${errorTooltip}><i class="fas fa-exclamation-triangle"></i> ${esc(String(errorMsg).substring(0, 140))}${String(errorMsg).length > 140 ? '…' : ''}</p>` : ''}
    `;

    if (status === 'downloading' || status === 'starting') {
      const speedText = speed > 0 ? ui.formatSpeed(speed) : '';
      const progressText = size > 0 ? `${ui.formatBytes(downloadedBytes)} of ${ui.formatBytes(size)}` : '';
      innerHTML += `
        <div class="civitai-dl-progress-row">
          <div class="civitai-progress-container" title="${esc(statusText)} — ${progress.toFixed(1)}%">
            <div class="civitai-progress-bar ${progressBarClass}" style="width: ${progress}%;"></div>
          </div>
          <span class="civitai-progress-pct">${progress.toFixed(0)}%</span>
        </div>
        ${(speedText || progressText) ? `<div class="civitai-speed-indicator">${[speedText, progressText].filter(Boolean).join(' · ')}</div>` : ''}
      `;
    } else if (status === 'completed' && startTime && endTime) {
      innerHTML += `<div class="civitai-speed-indicator">Finished in ${esc(ui.formatDuration(startTime, endTime))}</div>`;
    }

    innerHTML += `</div>`;
    innerHTML += `<div class="civitai-download-actions">`;
    if (status === 'queued' || status === 'downloading' || status === 'starting') {
      innerHTML += `<button class="civitai-button danger small civitai-cancel-button" data-id="${id}" title="Cancel Download"><i class="fas fa-times"></i></button>`;
    }
    if (status === 'failed' || status === 'cancelled') {
      innerHTML += `<button class="civitai-button small civitai-retry-button" data-id="${id}" title="Retry Download"><i class="fas fa-redo"></i></button>`;
    }
    if (status === 'completed') {
      innerHTML += `<button class="civitai-button small civitai-openpath-button" data-id="${id}" title="Open Containing Folder"><i class="fas fa-folder-open"></i></button>`;
    }
    innerHTML += `</div>`;

    listItem.innerHTML = innerHTML;
    fragment.appendChild(listItem);
  });

  container.innerHTML = '';
  container.appendChild(fragment);
  ui.ensureFontAwesome();
}
