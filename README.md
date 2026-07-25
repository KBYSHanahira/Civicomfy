# Civicomfy

**A Civitai & HuggingFace model downloader, built into ComfyUI.**

Browse, search, and download models — and manage the ones you already have — without leaving ComfyUI. One button in the toolbar opens everything.

---

## What it does

- 🔍 **Browse & search** Civitai's catalogue (powered by Meilisearch)
- ⬇️ **Download** from Civitai *or* HuggingFace by URL/ID
- 📂 **Auto-saves** to the right ComfyUI folder (checkpoints, loras, vae, etc.)
- 🗂️ **My Models** — see, sort, and delete locally installed models
- 🖼️ **Gallery** — browse the images your workflows produced
- 📊 **Downloads** — watch active transfers, queue, and history in real time
- 🎨 **Claude theme** — one warm design system, in dark or cream

---

## Screenshots

<img width="920" alt="Download — paste a link, pick a folder" src="docs/images/download.png" />

The preview resolves before you commit: exact file, exact folder, trigger words ready to copy.

<img width="920" alt="Download — live model preview" src="docs/images/download-preview.png" />

<table>
<tr>
<td width="50%"><img alt="Browse Civitai" src="docs/images/browse.png" /><br><em>Browse — search, filter, queue</em></td>
<td width="50%"><img alt="My Models" src="docs/images/my-models.png" /><br><em>My Models — everything on disk</em></td>
</tr>
<tr>
<td width="50%"><img alt="Downloads" src="docs/images/downloads.png" /><br><em>Downloads — active, queued, history</em></td>
<td width="50%"><img alt="Gallery in the light theme" src="docs/images/gallery-light.png" /><br><em>Gallery — light theme, multi-select</em></td>
</tr>
<tr>
<td width="50%"><img alt="Settings in the light theme" src="docs/images/settings-light.png" /><br><em>Settings — light theme</em></td>
<td width="50%"><img alt="Sidebar collapsed to an icon rail" src="docs/images/collapsed.png" /><br><em>Sidebar collapsed to an icon rail</em></td>
</tr>
</table>

> Captured from the real interface; model names, thumbnails and counts are placeholder data.

---

## Install

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/KBYSHanahira/Civicomfy.git
```

Restart ComfyUI. A **Civicomfy** button appears in the top-right toolbar.

---

## Get started in 30 seconds

1. Click **Civicomfy** in the toolbar
2. Open **Settings** → paste your [Civitai API Key](https://civitai.com/user/account)
3. Paste a Civitai or HuggingFace link into the **Download** tab
4. Click **Start download** — watch progress in **Downloads**

> 💡 No API key? You can still browse and download HuggingFace files. Civitai downloads need a free API key.

---

## The interface

**Sidebar navigation.** Sections are grouped by what you're trying to do —
**Get models** (Download, Browse), **Library** (My Models, Gallery),
**Activity** (Downloads), **Configure** (Settings, Directories). The current
section's name and a one-line description sit in the top bar, and a badge on
**Downloads** counts transfers in flight from anywhere in the app.

**It shrinks with the window.** Collapse the sidebar to a 60 px icon rail, or let
it become a slide-over drawer when the window gets narrow. Every panel keeps its
own scroll position, and long forms keep their primary action pinned to the
bottom instead of hiding it below the fold.

**Claude theme, two palettes.** Warm dark by default, warm cream on request —
switch with the toggle at the bottom of the sidebar. Every colour comes from one
token set, so both palettes stay consistent down to the badges and progress bars.
Your choice is remembered per browser.

**Keyboard & mouse.** `Esc` closes the window (or just the panel on top of it),
arrow keys page through the gallery lightbox, and card grids resize live with the
slider in each toolbar.

---

## The sections

### 📥 Download

Paste any of these and Civicomfy handles the rest:

- Civitai model URL: `civitai.com/models/12345`
- Civitai model ID: `12345`
- Civitai version URL: `…?modelVersionId=67890`
- HuggingFace file URL: `huggingface.co/.../resolve/main/model.safetensors`

**What you get:**
- A live preview of the model (images, file variants, version info)
- Auto-selected save folder based on model type
- Optional: pick a specific file variant (fp16 vs fp8, pruned vs full, etc.)
- Optional: choose a subfolder, or create a new one inline
- Optional: rename the file
- **Duplicate detection** — won't re-download a file that already exists (toggle a deeper check in Settings — scans every subfolder including MKLink/junction-mounted ones)
- **Force Re-download** — overrides duplicate detection when you actually want to overwrite

**Supported Civitai domains:** `civitai.com`, `civit.com`, `civit.red`, `civitai.red`

---

### 🔎 Browse

Search and discover models from Civitai.

- Filter by **type**, **base model** (SDXL, SD 1.5, Flux, Pony, Illustrious, Wan, Hunyuan, +35 more), **sort order**, **page size**
- Click a model card → pre-fills the Download tab
- NSFW thumbnails are blurred above your chosen threshold (click to reveal)
- Your filters and search are remembered between sessions

> Browse needs at least one filter active (search text, type, or base model).

---

### 📊 Downloads (Activity)

A live dashboard for everything that's downloading.

- **Active** — current downloads with speed, progress %, time elapsed
- **Queued** — waiting jobs (up to 3 run at once)
- **History** — last 100 finished/failed/cancelled downloads, persisted across restarts
- **Cancel**, **retry**, **open folder**, **clear history**

Polls every 3 seconds while the modal is open.

---

### 🗂️ My Models

Manage models already on disk.

- Recursive scan of every ComfyUI model folder
- Preview thumbnails from Civitai sidecar files (`.preview.jpeg`)
- Filter by type, search by name/path, sort by name/size/date
- **Open on Civitai** • **View Detail** (description, trigger words — click to copy) • **Delete** (with confirmation)
- Supports `.safetensors`, `.ckpt`, `.pt`, `.pth`, `.bin`, `.gguf`, `.sft`

---

### 🖼️ Gallery

A grid view of your ComfyUI **output** folder — the images your workflows actually produced.

- Filter by subfolder, sort by date or name, resize thumbnails live
- Lightbox with arrow-key navigation and zoom
- Multi-select for batch **download** or **delete**

---

### 🧭 Directories

Point any model type at a folder of your choosing — handy when checkpoints live
on a different drive from LoRAs. Leave a row blank to keep ComfyUI's default
(shown as the placeholder). Paths are validated on the server before they're
saved, and overrides persist in `directory_overrides.json`.

---

### ⚙️ Settings

| Setting | What it does |
|---|---|
| **Civitai API Key** | Required to download from Civitai |
| **HuggingFace Token** | Needed for gated/private HF models |
| **Default model type** | What's pre-selected in the Download tab |
| **Auto-open Downloads** | Jumps to Downloads after queuing a download |
| **Deep subfolder check** | When checking for duplicates, scans every subfolder (and MKLink/junction-mounted drives) instead of just the target folder |
| **Hide mature content** | Filter NSFW out of Browse results |
| **NSFW blur threshold** | Blur thumbnails at this `nsfwLevel` and above (0–128) |
| **Model Maintenance** | Bulk-refresh metadata or thumbnails for any category |

Settings live in a browser cookie (365 days). API keys never touch the server's filesystem — they're sent per-request from your browser.

---

## How downloads work

1. **HEAD request** to resolve the final URL and check if the server supports byte-range requests
2. **Big files (>100 MB) with range support** → split into N parallel chunks
3. **Otherwise** → single streaming connection
4. Each chunk retries up to **3 times** with exponential backoff
5. Progress updates every 0.5 s
6. Cancel cleanly removes partial files

> ⚠️ **Known issue:** Multi-connection downloads currently have a bug. Use 1 connection for reliability.

### Sidecar files (Civitai only)

| File | What's inside |
|---|---|
| `<name>.cminfo.json` | Model metadata, base model, trigger words, description, sample prompts |
| `<name>.preview.jpeg` | 450 px thumbnail from Civitai |

HuggingFace downloads don't create sidecars.

### Limits

| | |
|---|---|
| Concurrent downloads | 3 |
| History entries | 100 |
| History storage | `download_history.json` |

---

## MKLink / symlink / junction support

If you store models on an external drive and link them in with `mklink /D` or `mklink /J`, Civicomfy follows the links — both the subfolder dropdown and the duplicate-file scanner walk into them. Circular links are detected and skipped.

---

## Contributing

PRs welcome.
