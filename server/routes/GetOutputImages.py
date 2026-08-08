# ================================================
# File: server/routes/GetOutputImages.py
# ================================================
import os
import time
import asyncio
from aiohttp import web
import server
import folder_paths

prompt_server = server.PromptServer.instance

IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}

# Walking a large output folder means an os.stat per file — several hundred
# milliseconds on a spinning disk with a few thousand images, and it used to run
# again for every page click, sort change and subfolder switch. The full scan is
# cached briefly and filtered in memory instead; the Refresh button bypasses it.
_SCAN_TTL = 15.0
_scan_cache = {}
_scan_lock = asyncio.Lock()


def _get_output_dir():
    try:
        return folder_paths.get_output_directory()
    except Exception:
        base = getattr(folder_paths, 'base_path', os.getcwd())
        return os.path.join(base, 'output')


def _scan_output_dir(output_dir):
    """Blocking: enumerate every image under output_dir. Runs off the loop."""
    subfolders = set()
    all_images = []

    for dirpath, dirnames, filenames in os.walk(output_dir):
        rel_dir = os.path.relpath(dirpath, output_dir).replace('\\', '/')
        if rel_dir == '.':
            rel_dir = ''
        else:
            subfolders.add(rel_dir)

        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext not in IMAGE_EXTENSIONS:
                continue

            full_path = os.path.join(dirpath, filename)
            try:
                stat = os.stat(full_path)
            except OSError:
                continue
            all_images.append({
                "filename": filename,
                "subfolder": rel_dir,
                "size_bytes": stat.st_size,
                "mtime": stat.st_mtime,
            })

    return all_images, sorted(subfolders)


async def _get_scan(output_dir, force_refresh=False):
    """Return (images, subfolders), reusing a recent scan when one is fresh."""
    now = time.time()
    cached = _scan_cache.get(output_dir)
    if not force_refresh and cached and (now - cached['ts']) < _SCAN_TTL:
        return cached['images'], cached['subfolders']

    async with _scan_lock:
        # A concurrent request may have refreshed the cache while we waited.
        cached = _scan_cache.get(output_dir)
        if not force_refresh and cached and (time.time() - cached['ts']) < _SCAN_TTL:
            return cached['images'], cached['subfolders']

        loop = asyncio.get_running_loop()
        images, subfolders = await loop.run_in_executor(None, _scan_output_dir, output_dir)
        _scan_cache[output_dir] = {'ts': time.time(), 'images': images, 'subfolders': subfolders}
        return images, subfolders


def invalidate_scan_cache():
    """Called after a delete so the gallery does not show ghosts."""
    _scan_cache.clear()


@prompt_server.routes.get("/civitai/output_images")
async def route_get_output_images(request):
    """List output images with pagination and filtering."""
    try:
        output_dir = _get_output_dir()
        if not os.path.isdir(output_dir):
            return web.json_response({"images": [], "total": 0, "total_pages": 1, "subfolders": []})

        try:
            page = max(1, int(request.rel_url.query.get('page', 1)))
        except (ValueError, TypeError):
            page = 1
        try:
            limit = min(200, max(1, int(request.rel_url.query.get('limit', 50))))
        except (ValueError, TypeError):
            limit = 50

        subfolder_filter = request.rel_url.query.get('subfolder', '').strip()
        sort = request.rel_url.query.get('sort', 'time_desc')
        force_refresh = request.rel_url.query.get('refresh') in ('1', 'true', 'yes')

        scanned, subfolders = await _get_scan(output_dir, force_refresh)

        if subfolder_filter:
            all_images = [i for i in scanned if i['subfolder'] == subfolder_filter]
        else:
            # Copied because the sort below would otherwise reorder the cache in
            # place, and the next request may ask for a different order.
            all_images = list(scanned)

        if sort == 'time_asc':
            all_images.sort(key=lambda x: x['mtime'])
        elif sort == 'name_asc':
            all_images.sort(key=lambda x: x['filename'].lower())
        elif sort == 'name_desc':
            all_images.sort(key=lambda x: x['filename'].lower(), reverse=True)
        else:  # time_desc (default)
            all_images.sort(key=lambda x: x['mtime'], reverse=True)

        total = len(all_images)
        start = (page - 1) * limit
        page_images = all_images[start:start + limit]

        return web.json_response({
            "images": page_images,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": max(1, (total + limit - 1) // limit),
            "subfolders": subfolders,
        })
    except Exception as e:
        print(f"[Civicomfy] Error listing output images: {e}")
        return web.json_response({"error": str(e)}, status=500)
