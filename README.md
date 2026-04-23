# Civicomfy — Civitai Model Downloader for ComfyUI

Civicomfy integrates Civitai's model library directly into ComfyUI. Browse, search, download, and manage AI models without leaving your workflow.

---

## Screenshot

<img width="920" height="713" alt="image" src="https://github.com/user-attachments/assets/80cece16-c999-4766-848c-39d08ea4cde5" />

<img width="923" height="719" alt="image" src="https://github.com/user-attachments/assets/7de727ff-33b5-4a75-aaf3-a2d8d8aa31b9" />

<img width="914" height="719" alt="image" src="https://github.com/user-attachments/assets/8cb9ec25-70d8-4b37-a93b-7be3b4034742" />

<img width="919" height="719" alt="image" src="https://github.com/user-attachments/assets/c0d7b47f-4949-461c-8e9f-40b42a5285da" />

<img width="920" height="717" alt="image" src="https://github.com/user-attachments/assets/a2e24eec-f5b0-45ab-ae24-1f910275c098" />

---
## Screenshot (New!!!)

<img width="824" height="840" alt="image" src="https://github.com/user-attachments/assets/b9f7c0aa-b75c-4f39-82e7-3feca17cba0e" />

<img width="1180" height="610" alt="image" src="https://github.com/user-attachments/assets/dbb9c1cc-839e-4260-9ac8-da2c5f81c0e9" />


## Installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/KBYSHanahira/Civicomfy.git
```

Restart ComfyUI. The **Civicomfy** button will appear in the top-right toolbar.

---

## Quick Start

1. Open Civicomfy from the toolbar button
2. Go to **Settings** and enter your [Civitai API Key](https://civitai.com/user/account)
3. Use **Browse** to explore models, or **Download** to grab a model by URL or ID
4. Monitor progress in the **Status** tab
5. View installed models in **My Models**

---

## Tabs

### Download Tab

Queue a download by pasting a Civitai model URL, numeric model ID, or a HuggingFace `/resolve/` or `/blob/` URL.

**Civitai downloads:**
- **Live preview** — fetches model details and renders a preview card (name, images, file list) with a 500 ms debounce
- **Auto model-type detection** — selects the correct ComfyUI folder based on the model's Civitai type
- **File selector** — choose a specific file variant when a model has multiple files
- **Model type & subdirectory selectors** — populated from your actual `models/` folder structure
- **Create subdirectory** — create a new folder directly from the UI
- **Custom filename** — override the saved filename
- **Parallel connections** — set 1–16 connections (see [Download Engine](#download-engine))
- **Force re-download** — bypass the duplicate-file check
- **Duplicate detection** — server checks for an existing file with a matching size and warns before queuing; returns `exists` or `exists_size_mismatch`
- **API key required** — a Civitai API key must be set in Settings before a download can be queued

**HuggingFace downloads:**
- Detected automatically when the URL contains `/resolve/` or `/blob/`
- Optional HuggingFace token for gated models
- No API key required

**Supported Civitai domains:** `civitai.com`, `civit.com`, `civit.red`, `civitai.red`

---

### Browse Tab

Browse Civitai's model catalogue using the Meilisearch API.

- **Type tabs** — filter by model type; tab list is generated from your installed `models/` subfolders
- **Sort options** — Relevancy, Most Downloaded, Highest Rated, Most Liked, Most Discussed, Most Collected, Most Buzz, Newest
- **Base model filter** — multi-select picker with 43 options including Flux.1 D/S, SDXL, SD 1.5, Pony, Illustrious, Wan Video, Hunyuan Video, and more; live text search inside the picker
- **Results per page** — 25, 50, 75, or 100 models
- **NSFW blur** — thumbnails at or above the configured `nsfwLevel` threshold are blurred; click to reveal/hide
- **Pagination** — numbered pages
- **Per-model download button** — pre-fills the Download tab with the model ID, version ID, and model type
- **Persistent settings** — sort, active type tab, selected base models, search query, and page limit are saved in a browser cookie

> **Note:** Browse requires at least one of: a search query, a type filter, or a base model filter to be active.

---

### Status Tab

Real-time download monitor, polling every 3 seconds while the modal is open.

- **Active downloads** — filename, progress bar, percentage, speed, connection mode (Multi / Single), start time
- **Queue** — jobs waiting to start (up to 3 run concurrently)
- **History** — completed, failed, and cancelled entries with outcome, file size, and duration; capped at 100 entries
- **Cancel** — cancel any active or queued download
- **Retry** — re-queue any failed or cancelled download with the original parameters
- **Open folder** — open the file's containing directory in your OS file explorer (Windows Explorer / Finder / Nautilus); only available for completed downloads
- **Clear history** — wipe the history list with a confirmation dialog

---

### My Models Tab

Browse and manage models installed locally.

- **Local scan** — reads model files recursively from every ComfyUI model directory
- **Preview images** — shows `.preview.jpeg` sidecar thumbnails (Civitai downloads only)
- **Type filter** — dropdown to filter by model type
- **Name/path search** — real-time text filter across filenames and relative paths
- **Sort** — name A→Z / Z→A, file size large→small / small→large, date modified newest first / oldest first
- **Model count** — filtered vs. total
- **Card actions** (on hover):
  - **Open on Civitai** — opens the model page in your browser (requires `.cminfo.json`)
  - **View Detail** — shows filename, path, size, type, base model, version, trigger words (click to copy), description, and a Civitai link
  - **Delete** — permanently removes the model file after confirmation; supports `.safetensors`, `.ckpt`, `.pt`, `.pth`, `.bin`, `.gguf`, `.sft`
- **Persistent settings** — sort and type filter saved in a browser cookie

---

### Settings Tab

All settings are stored in a browser cookie (`civitaiDownloaderSettings`, 365-day expiry). There is no server-side settings storage; the API key and HF token are sent from the browser with each request.

| Setting | Default | Description |
|---|---|---|
| **Civitai API Key** | _(empty)_ | Required to queue Civitai downloads |
| **HuggingFace Token** | _(empty)_ | Optional; required for gated HF models |
| **Default connections** | `1` | Number of parallel download connections (1–16) |
| **Default model type** | `checkpoint` | Pre-selected folder in the Download tab |
| **Auto-open Status tab** | `true` | Switch to Status automatically after queuing |
| **Hide mature content** | `true` | Filters NSFW results in Browse |
| **NSFW blur threshold** | `4` | Blur thumbnails with `nsfwLevel` ≥ this value (0–128) |

---

## Download Engine

### Chunk Downloader

1. Sends a `HEAD` request (25 s timeout) to resolve the final URL and check range-request support
2. If the file is **> 100 MB** and the server supports ranges and `num_connections > 1`, splits the download into N equal segments downloaded in parallel threads
3. Otherwise falls back to a single streaming connection
4. Each segment retries up to **3 times** with exponential backoff (1 s, 2 s, up to 10 s)
5. Progress (bytes/s and %) is reported every 0.5 seconds
6. On cancellation or failure, temp part files and the incomplete output file are deleted

> **Known issue:** Multi-connection (parallel chunk) downloads have an unresolved bug. Single-connection downloads work correctly. Setting connections > 1 may not improve speed.

### Sidecar Files (Civitai only)

| File | Content |
|---|---|
| `<modelname>.cminfo.json` | Civitai model/version metadata — ID, base model, trigger words, description, up to 5 example prompts |
| `<modelname>.preview.jpeg` | Thumbnail image (450 px wide) from Civitai |

HuggingFace downloads do **not** produce sidecar files.

### Queue & History Limits

| Limit | Value |
|---|---|
| Max concurrent downloads | 3 |
| History entries cap | 100 |
| History persistence | `download_history.json` (survives restarts) |

---

## Contributing

Contributions are welcome! Please submit a Pull Request.
