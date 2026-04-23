// Renders the download preview panel

const PLACEHOLDER_IMAGE_URL = `/extensions/Civicomfy/images/placeholder.jpeg`;

export function renderDownloadPreview(ui, data) {
  if (!ui.downloadPreviewArea) return;
  ui.ensureFontAwesome();

  const modelId      = data.model_id;
  const modelName    = data.model_name || 'Untitled Model';
  const creator      = data.creator_username || 'Unknown Creator';
  const modelType    = data.model_type || 'N/A';
  const versionName  = data.version_name || 'N/A';
  const baseModel    = data.base_model || 'N/A';
  const stats        = data.stats || {};
  const descHtml     = data.description_html || '<p><em>No description.</em></p>';
  const verDescHtml  = data.version_description_html || '<p><em>No description.</em></p>';
  const fileInfo     = data.file_info || {};
  const files        = Array.isArray(data.files) ? data.files : [];
  const tags         = Array.isArray(data.tags) ? data.tags.slice(0, 12) : [];
  const trainedWords = Array.isArray(data.trained_words) ? data.trained_words : [];
  const previewImages = Array.isArray(data.preview_images) ? data.preview_images : [];
  const nsfwLevel    = Number(data.nsfw_level ?? 0);
  const blurMinLevel = Number(ui.settings?.nsfwBlurMinLevel ?? 4);
  const shouldBlur   = ui.settings?.hideMatureInSearch === true && nsfwLevel >= blurMinLevel;
  const civitaiLink  = `https://civitai.com/models/${modelId}${data.version_id ? '?modelVersionId=' + data.version_id : ''}`;
  const onError      = `this.onerror=null; this.src='${PLACEHOLDER_IMAGE_URL}';`;
  const thumbnail    = data.thumbnail_url || PLACEHOLDER_IMAGE_URL;

  // Gallery images: prefer previewImages array, fall back to thumbnail
  const galleryImgs = previewImages.length > 0
    ? previewImages
    : [{ url: thumbnail, nsfwLevel }];

  function isImgBlurred(img) {
    return shouldBlur && (img.nsfwLevel ?? 0) >= blurMinLevel;
  }

  // Thumbnail strip
  const thumbsHtml = galleryImgs.map((img, i) => `
    <div class="cfy-prev-gallery-thumb${i === 0 ? ' active' : ''}" data-idx="${i}">
      <img src="${img.url}" loading="lazy" onerror="${onError}" class="${isImgBlurred(img) ? 'blurred' : ''}">
      ${isImgBlurred(img) ? '<span class="cfy-prev-nsfw-badge">R</span>' : ''}
    </div>`).join('');

  // Stats row
  function statItem(icon, val, tip) {
    const fmt = (typeof val === 'number') ? val.toLocaleString() : (val || '0');
    return `<div class="cfy-prev-stat" title="${tip}"><i class="fas fa-${icon}"></i><span>${fmt}</span></div>`;
  }

  // File chips
  function chip(label) {
    return label && label !== 'N/A' ? `<span class="cfy-prev-chip">${label}</span>` : '';
  }

  // Files dropdown
  const filesDropdown = files.length > 1 ? `
    <div class="cfy-prev-section">
      <div class="cfy-prev-section-label"><i class="fas fa-file-alt"></i> File Variant</div>
      <select id="civitai-file-select" class="civitai-select" style="margin-top:4px;">
        <option value="">Auto (primary / best)</option>
        ${files.map(f => {
          const id   = f.id ?? '';
          const name = (f.name || '').replace(/</g, '&lt;');
          const fmt  = f.format || '';
          const prec = (f.precision || '').toUpperCase();
          const ms   = f.model_size || '';
          const sz   = typeof f.size_kb === 'number' ? ui.formatBytes(f.size_kb * 1024) : '';
          const label = [fmt, prec, ms, sz].filter(Boolean).join(' · ');
          const dis  = f.downloadable ? '' : 'disabled';
          return `<option value="${id}" ${dis}>${name}${label ? ' — ' + label : ''}${f.downloadable ? '' : ' (unavailable)'}</option>`;
        }).join('')}
      </select>
    </div>` : `<input type="hidden" id="civitai-file-select" value="">`;

  const hero0 = galleryImgs[0];
  const html = `
    <div class="cfy-preview-card">

      <!-- LEFT: image gallery -->
      <div class="cfy-prev-gallery">
        <div class="cfy-prev-gallery-main" id="cfy-prev-main-wrap">
          <img id="cfy-prev-hero" src="${hero0.url}" loading="lazy" onerror="${onError}"
               class="${isImgBlurred(hero0) ? 'blurred' : ''}">
          ${isImgBlurred(hero0) ? '<span class="cfy-prev-nsfw-badge large">R</span>' : ''}
        </div>
        ${galleryImgs.length > 1 ? `<div class="cfy-prev-thumbstrip">${thumbsHtml}</div>` : ''}
      </div>

      <!-- RIGHT: details -->
      <div class="cfy-prev-info">

        <div class="cfy-prev-header">
          <span class="cfy-prev-type-badge">${modelType}</span>
          <h3 class="cfy-prev-title">${modelName}</h3>
          <div class="cfy-prev-meta">
            <span><i class="fas fa-user"></i> ${creator}</span>
            <span><i class="fas fa-code-branch"></i> ${versionName}</span>
            <span class="cfy-prev-base-badge">${baseModel}</span>
          </div>
        </div>

        <div class="cfy-prev-stats">
          ${statItem('download', stats.downloads, 'Downloads')}
          ${statItem('thumbs-up', stats.likes, 'Likes')}
          ${statItem('thumbs-down', stats.dislikes, 'Dislikes')}
          ${statItem('bolt', stats.buzz, 'Buzz')}
        </div>

        <div class="cfy-prev-section">
          <div class="cfy-prev-section-label"><i class="fas fa-file-archive"></i> Primary File</div>
          <div class="cfy-prev-file-name" title="${fileInfo.name || ''}">${fileInfo.name || 'N/A'}</div>
          <div class="cfy-prev-chips">
            ${chip(fileInfo.size_kb ? ui.formatBytes(fileInfo.size_kb * 1024) : '')}
            ${chip(fileInfo.format)}
            ${chip(fileInfo.precision && fileInfo.precision !== 'N/A' ? fileInfo.precision.toUpperCase() : '')}
            ${chip(fileInfo.model_size)}
          </div>
        </div>

        ${filesDropdown}

        ${trainedWords.length > 0 ? `
        <div class="cfy-prev-section">
          <div class="cfy-prev-section-label"><i class="fas fa-pen-nib"></i> Trigger Words</div>
          <div class="cfy-prev-words">
            ${trainedWords.map(w => `<span class="cfy-prev-trained-word">${w}</span>`).join('')}
          </div>
        </div>` : ''}

        ${tags.length > 0 ? `
        <div class="cfy-prev-section">
          <div class="cfy-prev-section-label"><i class="fas fa-tags"></i> Tags</div>
          <div class="cfy-prev-tags">
            ${tags.map(t => `<span class="cfy-prev-tag">${t}</span>`).join('')}
          </div>
        </div>` : ''}

        <details class="cfy-prev-details">
          <summary><i class="fas fa-align-left"></i> Model Description</summary>
          <div class="cfy-prev-desc-body">${descHtml}</div>
        </details>

        <details class="cfy-prev-details">
          <summary><i class="fas fa-sticky-note"></i> Version Notes</summary>
          <div class="cfy-prev-desc-body">${verDescHtml}</div>
        </details>

        <a href="${civitaiLink}" target="_blank" rel="noopener noreferrer"
           class="civitai-button small secondary" style="margin-top:4px;align-self:flex-start;">
          <i class="fas fa-external-link-alt"></i> View on Civitai
        </a>

      </div>
    </div>`;

  ui.downloadPreviewArea.innerHTML = html;

  // Gallery thumb interaction
  if (galleryImgs.length > 1) {
    const thumbEls  = ui.downloadPreviewArea.querySelectorAll('.cfy-prev-gallery-thumb');
    const heroEl    = ui.downloadPreviewArea.querySelector('#cfy-prev-hero');
    const wrapEl    = ui.downloadPreviewArea.querySelector('#cfy-prev-main-wrap');

    thumbEls.forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        const img = galleryImgs[idx];
        if (!img) return;

        thumbEls.forEach(t => t.classList.remove('active'));
        el.classList.add('active');

        heroEl.src = img.url;
        heroEl.className = isImgBlurred(img) ? 'blurred' : '';

        const oldBadge = wrapEl.querySelector('.cfy-prev-nsfw-badge.large');
        if (oldBadge) oldBadge.remove();
        if (isImgBlurred(img)) {
          const b = document.createElement('span');
          b.className = 'cfy-prev-nsfw-badge large';
          b.textContent = 'R';
          wrapEl.appendChild(b);
        }
      });
    });
  }
}
