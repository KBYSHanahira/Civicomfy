# ================================================
# File: server/routes/TagAutocomplete.py
# ================================================
import asyncio
import csv
import os
import threading
import time
import requests
from aiohttp import web
import server # ComfyUI server instance

prompt_server = server.PromptServer.instance

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__)))), "data")
MERGED_PATH = os.path.join(DATA_DIR, "tags_merged.csv")
_retry_merge_at = 0.0  # set after a failed merge write

# id -> (url, local file, site, file has a header row). All rows are tag,category,count,aliases.
# Merge order is alias order: "ap" first so its Japanese/Chinese/Korean aliases are the ones shown.
SOURCES = {
    # Autocomplete-Plus dataset (MIT): https://huggingface.co/datasets/newtextdoc1111/danbooru-tag-csv
    "ap": ("https://huggingface.co/datasets/newtextdoc1111/danbooru-tag-csv/resolve/main/danbooru_tags.csv", "danbooru_tags.csv", "d", True),
    # a1111-sd-webui-tagcomplete (MIT): https://github.com/DominikDoom/a1111-sd-webui-tagcomplete
    "tc": ("https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/main/tags/danbooru.csv", "tagcomplete_danbooru.csv", "d", False),
    "e6": ("https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/main/tags/e621.csv", "tagcomplete_e621.csv", "e", False),
}


def _source_path(source_id):
    return os.path.join(DATA_DIR, SOURCES[source_id][1])


def _download(source_id):
    url = SOURCES[source_id][0]
    path = _source_path(source_id)
    tmp_path = f"{path}.{os.getpid()}.part"  # per process: two instances may share custom_nodes
    try:
        with requests.get(url, stream=True, timeout=(10, 60)) as res:
            res.raise_for_status()
            with open(tmp_path, "wb") as f:
                for chunk in res.iter_content(chunk_size=1 << 16):
                    f.write(chunk)
        os.replace(tmp_path, path)
        print(f"[Civicomfy] Downloaded tag list {os.path.basename(path)}")
    except (requests.RequestException, OSError) as e:
        print(f"[Civicomfy] Tag list download failed ({os.path.basename(path)}), retrying on next start: {e}")
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def _download_missing():
    os.makedirs(DATA_DIR, exist_ok=True)
    for source_id in SOURCES:
        if not os.path.exists(_source_path(source_id)):
            _download(source_id)


def _build_merged():
    """Merge every downloaded list by tag name: highest count, all aliases, one entry per source."""
    started = time.time()
    tags = {}
    for source_id, (_, _, site, has_header) in SOURCES.items():
        path = _source_path(source_id)
        if not os.path.exists(path):
            continue
        try:
            with open(path, encoding="utf-8-sig", newline="") as f:
                rows = csv.reader(f)
                if has_header:
                    next(rows, None)
                _merge_rows(tags, rows, source_id, site)
        except (UnicodeDecodeError, csv.Error) as e:
            # A broken download would otherwise fail every request; delete it so the next start fetches it again.
            print(f"[Civicomfy] Tag list {os.path.basename(path)} is unreadable, re-downloading on next start: {e}")
            os.remove(path)

    tmp_path = f"{MERGED_PATH}.{os.getpid()}.part"
    try:
        with open(tmp_path, "w", encoding="utf-8", newline="") as f:
            out = csv.writer(f)
            out.writerow(["tag", "category", "count", "alias", "sources"])
            for name, e in sorted(tags.items(), key=lambda kv: kv[1]["count"], reverse=True):
                out.writerow([name, e["category"], e["count"], ",".join(e["aliases"]), " ".join(e["sources"])])
        os.replace(tmp_path, MERGED_PATH)
    except OSError as e:
        # On Windows the replace fails while a request is still streaming the old file; keep serving
        # that one and wait a minute before merging again instead of re-merging on every request.
        global _retry_merge_at
        _retry_merge_at = time.time() + 60
        print(f"[Civicomfy] Could not update the merged tag list, using the previous one: {e}")
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        return
    # Date the merge to when reading began, so a list that finished downloading mid-merge still counts as newer.
    os.utime(MERGED_PATH, (started, started))


def _merge_rows(tags, rows, source_id, site):
    for row in rows:
        if len(row) < 3 or not (row[2].isascii() and row[2].isdigit()):
            continue
        name, category, count = row[0], f"{site}{row[1]}", int(row[2])
        entry = tags.get(name)
        if entry is None:
            entry = tags[name] = {"category": category, "count": 0, "aliases": {}, "sources": []}
        elif site == "d" and entry["category"][0] == "e":
            entry["category"] = category  # a Danbooru category wins over e621's for shared names
        entry["count"] = max(entry["count"], count)
        if len(row) > 3:
            entry["aliases"].update(dict.fromkeys(a for a in row[3].split(",") if a))
        entry["sources"].append(f"{source_id}:{count}")


def _merged_is_stale():
    sources = [p for p in map(_source_path, SOURCES) if os.path.exists(p)]
    if not sources or (time.time() < _retry_merge_at and os.path.exists(MERGED_PATH)):
        return False
    return not os.path.exists(MERGED_PATH) or max(map(os.path.getmtime, sources)) > os.path.getmtime(MERGED_PATH)


threading.Thread(target=_download_missing, name="civicomfy-tags", daemon=True).start()
_merge_lock = asyncio.Lock()


@prompt_server.routes.get("/civitai/tags.csv")
async def route_tags_csv(request):
    """Merged tag list (tag,category,count,alias,sources) for the prompt autocomplete; 404 until a list is downloaded."""
    async with _merge_lock:
        if _merged_is_stale():
            await asyncio.to_thread(_build_merged)
    if not os.path.exists(MERGED_PATH):
        raise web.HTTPNotFound(reason="Tag data not downloaded yet")
    return web.FileResponse(MERGED_PATH)
