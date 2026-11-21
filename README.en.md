<div align="center">

# Civicomfy 3.0

**A Civitai & HuggingFace model terminal, built into ComfyUI — now ready for Nodes 2.0.**

[🇯🇵 日本語](README.md)　|　**🇬🇧 English**

![version](https://img.shields.io/badge/version-3.0.0-ff6b1a?style=flat-square&labelColor=0a0a0b)
![ComfyUI](https://img.shields.io/badge/ComfyUI-Nodes%202.0%20ready-ff6b1a?style=flat-square&labelColor=0a0a0b)
![license](https://img.shields.io/badge/license-MIT-eceae4?style=flat-square&labelColor=0a0a0b)

<img width="920" alt="Civicomfy launcher and system monitor in the ComfyUI top bar" src="docs/images/system-monitor.png" />

</div>

Browse, search and download models — and manage the ones you already have — without leaving ComfyUI. One button in the toolbar opens everything, a live system monitor sits next to it, and every prompt box gets Danbooru / e621 tag autocomplete.

---

## What's new in 3.0

| | |
|---|---|
| 🧩 **Nodes 2.0 support** | The **CiviComfy Model Info** node renders on both the classic canvas and the new Vue-based Nodes 2.0, and resizes freely in both |
| 📈 **System monitor** | CPU, RAM, GPU load, VRAM, GPU temperature and models-disk meters in the top bar |
| 🏷️ **Tag autocomplete** | 227k+ Danbooru and e621 tags merged from three MIT datasets, with JA / ZH / KO aliases |
| 🎛️ **Feature switches** | Turn the monitor or autocomplete on and off, and tune each one, in ComfyUI's Settings |
| 🪪 **Redesigned model card** | The node card now uses the same field-terminal look as the Civicomfy window |

---

## Features

- 🔍 **Browse & search** Civitai's catalogue (powered by Meilisearch)
- ⬇️ **Download** from Civitai *or* HuggingFace by URL/ID
- 📂 **Auto-saves** to the right ComfyUI folder (checkpoints, loras, vae, etc.)
- 🗂️ **My Models** — see, sort, and delete locally installed models
- 🖼️ **Gallery** — browse the images *and videos* your workflows produced
- 📊 **Downloads** — watch active transfers, queue, and history in real time
- 🧩 **Model Info node** — a model's preview, trigger words and example prompts right in your workflow, with one-click copy
- 📈 **System monitor** — live hardware meters in the ComfyUI top bar
- 🏷️ **Tag autocomplete** — Danbooru / e621 suggestions in every prompt box
- 🎨 **Field-terminal theme** — orange-on-black industrial HUD, with a light palette too

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
<tr>
<td width="50%"><img alt="CiviComfy Model Info node" src="docs/images/model-info-node.png" /><br><em>Model Info node — classic canvas and Nodes 2.0</em></td>
<td width="50%"><img alt="Tag autocomplete in a prompt box" src="docs/images/tag-autocomplete.png" /><br><em>Tag autocomplete — merged sources, aliases, post counts</em></td>
</tr>
</table>

> Captured from the real interface; model names, thumbnails, counts and hardware readings are placeholder data.

---

## Install

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/KBYSHanahira/Civicomfy.git
```

For the GPU / VRAM / temperature meters on NVIDIA cards, install the one extra dependency into ComfyUI's Python:

```bash
pip install -r Civicomfy/requirements.txt
```

Restart ComfyUI. A **Civicomfy** button appears in the top-right toolbar, with the system monitor beside it. ComfyUI Manager installs the requirements for you.

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
**Acquire** (Download, Browse), **Archive** (My Models, Gallery),
**Operations** (Downloads), **System** (Settings, Directories), each numbered
01–07. The current section's number, name and a one-line description sit in the
top bar, and a badge on
**Downloads** counts transfers in flight from anywhere in the app.

**It shrinks with the window.** Collapse the sidebar to a 64 px icon rail, or let
it become a slide-over drawer when the window gets narrow. Every panel keeps its
own scroll position, and long forms keep their primary action pinned to the
bottom instead of hiding it below the fold.

**Field-terminal theme, two palettes.** Black with a signal-orange accent by
default, an off-white "field" palette on request — switch with the toggle at the
bottom of the sidebar. Square plates, cut corners, condensed and mono type, and
short mechanical motion (turned off when your system asks for reduced motion).
Every colour comes from one token set, so both palettes stay consistent down to
the badges and progress bars. Your choice is remembered per browser.

**Keyboard & mouse.** `Esc` closes the window (or just the panel on top of it),
arrow keys page through the gallery lightbox, and card grids resize live with the
slider in each toolbar.

---

## Inside your workflow

### 🧩 CiviComfy Model Info node

**Send to Workflow** (from Download, Browse or My Models) drops a **CiviComfy Model Info** node into your graph: the model's preview, type and base model, creator and version, file name, trigger words and example prompts.

- **Copy with one click** — the file name, every trigger word at once, or any example prompt
- **INFO** opens the full model details without leaving the canvas
- **Works on both renderers** — the classic LiteGraph canvas and ComfyUI's **Nodes 2.0**
- **Resize it freely** — drag any corner; the card reflows to the size you set and never grows on its own
- Narrow nodes stay tidy: long names and badges are cut with `…` instead of spilling out

### 📈 System monitor

Live meters next to the Civicomfy button in the top bar:

| Meter | Reads |
|---|---|
| **CPU** | Total CPU load |
| **RAM** | `used / total GB` (or %) |
| **GPU** | GPU load — NVIDIA, through `nvidia-ml-py` |
| **VRAM** | `used / total GB` (or %) |
| **TEMP** | GPU temperature |
| **DISK** | Space used on the drive that holds your models folder |

Meters turn hot at 90 % (or 80 °C). Hover a meter for the exact reading. Each NVIDIA GPU gets its own meters, and a GPU that drops out (after a driver reset, for example) has its meters removed. Without an NVIDIA GPU you still get CPU, RAM and DISK.

### 🏷️ Tag autocomplete

Start typing in any prompt box — classic text widgets and Nodes 2.0 textareas alike — and matching tags appear under the caret.

- **227,939 tags** merged from three MIT-licensed lists; the chips on each row show which lists have the tag:
  - **AP** — [newtextdoc1111/danbooru-tag-csv](https://huggingface.co/datasets/newtextdoc1111/danbooru-tag-csv) (Autocomplete-Plus data, with Japanese / Chinese / Korean aliases)
  - **TC** — [DominikDoom/a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete) Danbooru list
  - **E6** — the same project's e621 list
- **Search by alias** — type `ぱっつん` or `青髪` to get `blunt_bangs` / `blue_hair`; katakana and hiragana match each other
- Tags are coloured by category, show post counts, and link to their wiki page
- Tags already in the prompt are dimmed, so duplicates are easy to spot
- Understands prompt syntax: weights such as `(red hair:1.2)`, escaped `\(` `\)`, and it stays out of `<lora:…>` and `embedding:` text
- `↑` `↓` choose, `Enter` / `Tab` insert, `Esc` close; an insert goes on the undo stack, so `Ctrl+Z` takes it back
- IME friendly — Japanese input is matched once the text is confirmed

The tag lists download into `data/` the first time ComfyUI starts with Civicomfy, then merge on the server. Nothing is fetched again once the files exist.

### 🎛️ Settings in ComfyUI

Open ComfyUI's **Settings → Civicomfy**:

| Group | Settings |
|---|---|
| **Features** | Enable System Monitor · Enable Tag Autocomplete |
| **System monitor** | Show CPU / RAM / GPU / VRAM / TEMP / DISK · values in GB or % · refresh interval (0.5–10 s) |
| **Tag autocomplete** | Include Danbooru / e621 tags · maximum suggestions (5–50) · characters before suggesting (1–5) · underscores as spaces · escape parentheses · add `, ` after a tag · show aliases |

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
- Each card shows the download size of its latest version; the Info panel lists the size of every version
- NSFW thumbnails are blurred above your chosen threshold (click to reveal); pick **Unlock everything** in Settings to see every model unblurred and unfiltered
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

A grid view of your ComfyUI **output** folder — the images and videos your workflows actually produced.

- **Images and videos** (`.mp4` / `.webm` / `.mov` / `.m4v`). Video cards show the first frame as a poster with a ▶ badge, so a clip reads as a video at a glance
- **Play videos in the lightbox** with native controls (play, seek, volume) — no `ffmpeg` or extra dependency required
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
| **NSFW blur threshold** | Blur thumbnails at this `nsfwLevel` and above (0–128). **Unlock everything** turns blurring off *and* stops Civitai from withholding results — models whose imagery is entirely explicit are only listed at that setting |
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

## Changelog

### 3.0.0

Civicomfy is ready for ComfyUI's **Nodes 2.0**, and grows two tools you use outside the Civicomfy window.

- **Nodes 2.0 support for the CiviComfy Model Info node.** Nodes 2.0 draws nodes as DOM and never shows `onDrawBackground`, so the card was blank there. It now draws on its own widget canvas in Nodes 2.0 and keeps the classic canvas path. Dragging a corner resizes it in both directions; the node no longer grows by its title and padding on every drag.
- **Redesigned Model Info card** in the field-terminal style: corner-bracketed preview, type and base-model badges, a copyable file name, trigger-word chips with a "+N" overflow, example-prompt cards that fill the height you give the node, and a Civitai link footer.
- **System monitor** in the top bar: CPU, RAM, NVIDIA GPU load, VRAM and temperature (via `nvidia-ml-py`, now in `requirements.txt`) and the models disk. Values in GB or %, adjustable refresh rate.
- **Tag autocomplete** for every prompt box, classic and Nodes 2.0: three MIT tag lists merged into 227,939 tags with source chips, JA / ZH / KO alias search, category colours, post counts and wiki links. The lists download once on first start.
- **Features section in ComfyUI's Settings** to switch the monitor and autocomplete on or off, plus options for each.
- **Credits** in the Settings tab, and a redesigned launcher button matching the Start download button.
- Fixed: the base-model badge on Browse cards was cut short while space sat unused next to the type badge.
- Fixed: the Browse info panel's thumbnail strip scrolled instead of showing its images.

### 2.4.0

- **Model cards show their download size.** Civitai's search index carries no file information at all, so the size is resolved from the REST API in one batched request per page (`server/routes/ModelFileSizes.py`) and filled into the cards after they are already on screen — browsing never waits for it. Sizes of published versions never change, so they are cached for the life of the process. The Info panel lists the size of every version, which is what you actually pick between when a model has twenty of them.
- **"Unlock everything" now unlocks the results too, not just the blur.** The search request always carried a rating filter, and because a model's `nsfwLevel` is a *list*, that filter dropped every model whose imagery is exclusively explicit — 11,504 LoRAs alone were invisible with no indication anything was missing. At the unlock setting Browse and Search now ask for every rating level.
- **Fixed: the model type dropdown was blank on first run.** The default was `checkpoint`, but the options come from ComfyUI's own folder names (`checkpoints`), and assigning a missing value to a `<select>` silently blanks it — leaving the Download form with no model type at all. The saved value is now resolved against the real option list.
- **Fixed: long version names spilled out of Browse cards.** `text-overflow` cannot act on a bare text node between two other children, so names ran up to 61px past the card edge instead of ellipsing.
- **Fixed: on touch devices the action overlay covered every thumbnail.** With no hover to reveal it, the overlay sat open permanently and you could not see a single model image. Tapping the artwork now opens the actions for that card only.
- **Fixed: the "All (N)" button on a Browse card did nothing.** It toggled a container that only ever existed in the old Search tab's markup. It now opens the info panel, where every version is listed.
- **Fixed: an empty bordered box sat above Start download.** The container had a `:empty` rule to hide it, but an HTML comment inside it meant `:empty` never matched.
- **Fixed:** overlapping `<code>` chips in wrapped hint text, colliding type / base-model badges on narrow cards, download names crushed to `Meg…` in Activity, and a doubled gap between wrapped form fields.
- **A pass over the whole interface at phone, tablet and desktop widths.** Toolbar filter captions no longer strand themselves beside the wrong control when a row wraps (their widths lived in inline styles that beat every media query); directory rows put the path and its reset button on one line; touch pointers get ~40px hit areas throughout, including the card-size slider, whose grabbable area was 4px tall. Verified with a script that walks every element on all seven tabs at five widths in both themes looking for overflow, escaped boxes, overlaps and undersized targets: all zero.
- **Removed the dead Search tab.** Its renderer, handler and stylesheet section had been unreachable since the tab was replaced by Browse — about 350 lines.

### 2.3.0

- **Video playback in the Gallery.** Output-folder videos (`.mp4`, `.webm`, `.mov`, `.m4v`) now list alongside images. Grid cards show the video's first frame as a poster with a ▶ badge, and the lightbox plays the clip with native controls (play, seek, volume). Rendered client-side with a `<video>` element pointed at ComfyUI's `/view` route — which already serves the files with HTTP range support — so **no `ffmpeg` or extra dependency** is required. The output scan and delete routes now recognise video extensions and tag each entry with a `media_type` the client keys its rendering off.

### 2.2.0

- **Download and Delete buttons in the Gallery lightbox.** Previously the only actions were previous / next / close, so saving or removing an image meant closing the viewer and finding its card again. Delete asks for confirmation, then advances to the next image so you can keep culling without reopening; it closes the viewer when nothing is left. Download always fetches the full-resolution original, not the thumbnail.
- **Fixed: clicking a Gallery card after deleting one opened the wrong image.** Cards captured their grid position when built, but deleting an image shifts every later one down a slot, so the stored positions silently pointed at a neighbour. Cards now read their position at click time and are renumbered whenever one is removed. This affected the existing per-card delete too, not just the new lightbox button.
- **Fixed: arrow keys changed the image behind the delete confirmation.** The dialog swallows Escape and Enter but not the arrows, so the lightbox kept navigating underneath it while the prompt was open.

### 2.1.0

A performance release. Both image grids were sending full-resolution originals to the browser to draw thumbnails a few hundred pixels wide, which is what made them stutter.

**Thumbnails**

- **New cached thumbnail service** (`server/routes/Thumbnails.py`). Images are downscaled once to WebP, cached on disk, and served with an immutable cache header. The source file's mtime is part of the URL, so a regenerated image gets a new URL instead of a stale hit.
  - Gallery: a page of 50 dropped from **276 MB to ~1.1 MB**.
  - My Models: a page of 50 dropped from **134 MB to ~1.8 MB**.
  - Decoding runs on a small bounded thread pool, off the event loop, so browsing never blocks the ComfyUI server or steals CPU from a running generation. Concurrent requests for the same image collapse into one decode.
  - Cache is capped at 4000 files and prunes oldest-first. First visit after upgrading generates the initial set (~100 ms per image); everything after that is served from disk.
- **Lightboxes open instantly** — the cached thumbnail paints first, then the full-size image swaps in once it arrives. Gallery lightbox also preloads the neighbouring images so arrow-key navigation doesn't stall.
- **Send to Workflow** now puts a thumbnail URL on the node instead of the full preview. The node draws into a 580 px box and keeps its bitmap alive for as long as it's in the workflow, so this was costing multiple MB of canvas memory per node.
- **Download tab** asks Civitai's CDN for display-sized images. Preview URLs previously came through as `original=true` — the full upload — and were scaled down in the browser.

**Scrolling**

- My Models cards now use `content-visibility`, so cards scrolled out of view skip layout and paint. The Gallery grid already did this, which is why only My Models stuttered.
- The hover-overlay blur on both grids is now scoped to `:hover`. It was declared unconditionally, giving every card three permanently-composited layers — **151 across a page, now 1**.
- My Models builds its cards in a document fragment instead of appending 50 times into the live grid.

**Fixes**

- The **base-model filter selection is now remembered** between sessions. It was never written to the saved settings, so it reset on every reload.
- Cancelling or failing a **multi-connection download** no longer abandons its worker threads. They were left running while the temp directory was deleted underneath them, which on Windows strands a `.<name>.parts_<id>` folder in your model directory. Threads are now joined with a bound, and cleanup retries before giving up.
- The output-folder scan is cached briefly instead of re-walking every image on each page click, sort change, and subfolder switch. Deleting an image invalidates it, and **Refresh** forces a fresh scan.

---

## Credits

| | |
|---|---|
| **Developed by** | [KBYSHanahira](https://github.com/KBYSHanahira) (Kobayashi Hanahira) |
| **Original project** | [MoonGoblinDev/Civicomfy](https://github.com/MoonGoblinDev/Civicomfy) by MoonGoblin — MIT License |
| **Contributors** | snomiao |
| **Tag data** | [newtextdoc1111/danbooru-tag-csv](https://huggingface.co/datasets/newtextdoc1111/danbooru-tag-csv) (AP) · [DominikDoom/a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete) (TC, E6) — MIT |
| **Model data** | [Civitai](https://civitai.com) · [Hugging Face](https://huggingface.co) |

---

## Contributing

PRs welcome.
