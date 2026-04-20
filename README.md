# Civicomfy — Civitai Model Downloader for ComfyUI

Civicomfy integrates Civitai's model library directly into ComfyUI. Browse, search, download, and manage AI models without ever leaving your workflow.

---

## Screenshot

<img width="879" height="694" alt="image" src="https://github.com/user-attachments/assets/21f4e9a8-de3c-4790-8995-d5f048b7e4b3" />
<img width="880" height="696" alt="image" src="https://github.com/user-attachments/assets/58a528fd-af85-4b39-9810-633e48263e31" />
<img width="885" height="689" alt="image" src="https://github.com/user-attachments/assets/dbf21dd4-bae2-4494-b4b0-7ce3e6c20420" />
<img width="883" height="693" alt="image" src="https://github.com/user-attachments/assets/0632b748-5d13-45c3-9365-ca58c1cd579c" />
<img width="893" height="690" alt="image" src="https://github.com/user-attachments/assets/9c0cc454-0115-4425-a23b-6994fd511691" />


---

## Installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/KBYSHanahira/Civicomfy.git
```

Then restart ComfyUI. The **Civicomfy** button will appear in the top-right toolbar.

---

## Quick Start

1. Open Civicomfy from the toolbar button
2. Go to **Settings** and enter your [Civitai API Key](https://civitai.com/user/account)
3. Use **Browse** to explore models or **Download** to grab a specific model by URL
4. Monitor progress in the **Status** tab
5. View your installed models in **My Models**

---

## Features

- **CivitAI Blue / Red Support** — Support download from civitai both site
- **HuggigFace Support** — Support download from Hugginface

### Download Tab

Manually queue a download by pasting a Civitai model URL or numeric model ID.

- **Live preview** — fetches model details and renders a preview card (name, images, file list) as you type, with a 500ms debounce
- **Auto model-type detection** — automatically selects the correct ComfyUI folder based on the model's Civitai type (Checkpoint, LORA, VAE, etc.)
- **File selector** — choose which file variant to download when a model has multiple files
- **Model type & subdirectory selectors** — populated dynamically from your actual ComfyUI `models/` folder structure
- **Create folders** — create new model type folders or subdirectories directly from the UI
- **Custom filename** — override the saved filename
- **Parallel connections** — set 1–16 simultaneous chunk connections for faster downloads
- **Force re-download** — bypass the duplicate-file check
- **Duplicate detection** — server checks for existing files before queuing and warns you

---

### Browse Tab

Browse Civitai's full model catalogue without leaving ComfyUI.

- **Type tabs** — filter by model type (Checkpoint, LORA, VAE, ControlNet, etc.); tabs are generated dynamically from your installed model folders
- **Sort options** — Most Downloaded, Newest, Highest Rated, Most Collected, Most Buzz, and more
- **Base model filter** — multi-select picker with 40+ options (Flux.1, SDXL, SD 1.5, Pony, Illustrious, Wan Video, etc.) with live text search inside the picker
- **NSFW blur** — thumbnails above your configured NSFW threshold are blurred; click any thumbnail to reveal/hide
- **Pagination** — numbered pages with ellipsis for large result sets
- **Per-model download button** — pre-fills the Download tab with the correct model ID, version ID, and model type
- **Multiple versions** — up to 3 version download buttons shown per card; "All versions" expander for models with more
- **Persistent settings** — your sort, active type tab, and selected base models are saved to a cookie and restored automatically

---

### Status Tab

Real-time monitor for all downloads.

- **Live polling** — refreshes every 3 seconds while the modal is open; pauses when closed
- **Active downloads** — filename, progress bar, percentage, download speed, connection mode (Multi/Single), and start time
- **Queue** — shows jobs waiting to start; up to 3 downloads run concurrently
- **History** — completed, failed, and cancelled entries with outcome, file size, and duration
- **Cancel** — cancel any active or queued download instantly
- **Retry** — re-queue any failed or cancelled download from history using the original parameters
- **Open folder** — open the file's directory in your OS file explorer (Windows Explorer / Finder / Nautilus)
- **Clear history** — wipe the history list with a confirmation dialog

---

### My Models Tab

Browse and manage models already installed on your machine.

- **Local scan** — reads all model files from every ComfyUI model directory
- **Preview images** — displays `.preview.jpeg` sidecar thumbnails saved at download time
- **Type filter** — dropdown to show only a specific model type
- **Name/path search** — real-time text filter across model names and relative paths
- **Sort** — by name (A→Z / Z→A), file size (large→small / small→large), or date modified (newest first / oldest first)
- **Model count** — shows filtered vs. total count
- **Card actions** (appear on hover):
  - **Open on Civitai** — opens the model page in your browser (requires `.cminfo.json` metadata)
  - **View Detail** — opens an in-modal detail panel showing filename, path, size, type, base model, version, trigger words (click to copy), description, and a direct Civitai link
  - **Delete** — permanently removes the model file from disk after confirmation
- **Persistent settings** — sort and type filter are saved to a cookie

---

### Settings Tab

Global preferences saved to a browser cookie (365-day expiry).

| Setting | Description |
|---|---|
| **API Key** | Your Civitai API key — required for downloading gated models and for higher rate limits |
| **Default connections** | Default number of parallel download connections (1–16) |
| **Default model type** | Pre-selected model type folder in the Download tab |
| **Auto-open Status tab** | Automatically switch to Status after queuing a download |
| **Hide mature content** | Filters NSFW results in Browse/Search |
| **NSFW blur threshold** | Blur thumbnails with a Civitai `nsfwLevel` at or above this value (0–128) |

---

## Download Engine

### Parallel Chunk Downloader

- Issues a `HEAD` request to check if the server supports range requests
- If the file is **> 100 MB** and range requests are supported, splits the file into N segments and downloads them in parallel threads
- Falls back to a single streaming connection for smaller files or servers that don't support ranges
- Up to **3 retries per segment** with exponential backoff
- Cancellation is handled cleanly — temp files are removed and incomplete output files are deleted
- Progress (% and bytes/s) is reported to the Status tab in real time

### Sidecar Files

Every downloaded model gets two companion files saved alongside it:

| File | Content |
|---|---|
| `<modelname>.cminfo.json` | Full Civitai model/version metadata (ID, base model, trigger words, description, etc.) |
| `<modelname>.preview.jpeg` | Thumbnail image from Civitai |

These files power the **My Models** detail view and Open-on-Civitai links.

### Queue Limits

- Maximum **3 concurrent** downloads
- History capped at **100** entries (oldest trimmed automatically)
- History is persisted to `download_history.json` and survives ComfyUI restarts

---

## Contributing

Contributions are welcome! Please submit a Pull Request.
