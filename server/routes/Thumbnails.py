# ================================================
# File: server/routes/Thumbnails.py
# Serves small, disk-cached thumbnails for every image grid in the UI.
#
# Both grids used to point their <img> tags straight at a route that returned
# the untouched source file, so the browser fetched and decoded full-resolution
# originals just to draw postage stamps:
#
#   * Gallery cards render at ~148px, but pulled 5-6 MB output PNGs — roughly
#     276 MB for a single page of 50.
#   * My Models cards render at ~200px, but pulled the .preview.jpeg sidecars,
#     which run to a 2.6 MB median and 15 MB at the top end.
#
# Here we downscale once, cache the result as WebP on disk, and let the browser
# cache it forever: the URL carries the source mtime, so a regenerated image
# gets a new URL rather than a stale hit.
# ================================================
import os
import time
import asyncio
import hashlib
from concurrent.futures import ThreadPoolExecutor

from aiohttp import web

import server
import folder_paths

from ...config import PLUGIN_ROOT, PREVIEW_SUFFIX

prompt_server = server.PromptServer.instance

IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}

# Requests are snapped to this ladder so a dragged size-slider cannot spray the
# cache with a hundred near-identical widths.
ALLOWED_SIZES = (256, 384, 512, 768)
DEFAULT_SIZE = 512
WEBP_QUALITY = 80

CACHE_DIR = os.path.join(PLUGIN_ROOT, '.cache', 'thumbs')

# Decoding a 6 MB PNG is CPU-bound and blocking; it must never run on the event
# loop or the whole ComfyUI server (queue included) stalls behind the UI.
# Kept deliberately small so browsing thumbnails cannot steal the CPU from a
# running generation.
_MAX_WORKERS = max(2, min(4, (os.cpu_count() or 4) // 2))
_EXECUTOR = ThreadPoolExecutor(
    max_workers=_MAX_WORKERS,
    thread_name_prefix='civicomfy-thumb',
)
# A page of 50 cards fires 50 requests at once. Without a gate they would all
# queue up decodes and starve every other route.
_gen_semaphore = None

# Two cards for the same file (or a re-request during scroll) should wait on one
# generation rather than each decoding the same source.
_inflight = {}

CACHE_MAX_FILES = 4000
_last_prune = 0.0
_PRUNE_INTERVAL = 600  # seconds


def _get_output_dir():
    try:
        return folder_paths.get_output_directory()
    except Exception:
        base = getattr(folder_paths, 'base_path', os.getcwd())
        return os.path.join(base, 'output')


def _get_models_dir():
    models_dir = getattr(folder_paths, 'models_dir', None)
    if not models_dir:
        base = getattr(folder_paths, 'base_path', os.getcwd())
        models_dir = os.path.join(base, 'models')
    return models_dir


def _semaphore():
    """Created lazily so it binds to the running loop, not import-time state.

    Only ever touched from the event loop thread, so no lock is needed.
    """
    global _gen_semaphore
    if _gen_semaphore is None:
        _gen_semaphore = asyncio.Semaphore(_MAX_WORKERS)
    return _gen_semaphore


def _resolve_source(filename, subfolder):
    """Resolve a gallery entry to an absolute path inside the output dir.

    Returns None when the request points outside the output folder, names a
    non-image, or the file is gone.
    """
    if not filename:
        return None
    filename = os.path.basename(filename)
    if os.path.splitext(filename)[1].lower() not in IMAGE_EXTENSIONS:
        return None

    output_dir = os.path.abspath(_get_output_dir())
    subfolder = (subfolder or '').strip().replace('\\', '/').strip('/')
    if subfolder:
        if '..' in subfolder.split('/'):
            return None
        target_dir = os.path.abspath(os.path.join(output_dir, *subfolder.split('/')))
    else:
        target_dir = output_dir

    try:
        if os.path.commonpath((target_dir, output_dir)) != output_dir:
            return None
    except ValueError:
        # commonpath raises when the paths sit on different drives.
        return None

    path = os.path.join(target_dir, filename)
    return path if os.path.isfile(path) else None


def _resolve_model_preview(rel_path):
    """Resolve a model's rel_path to its .preview.jpeg sidecar.

    Returns None when the path escapes the models dir or has no sidecar.
    """
    rel_path = (rel_path or '').strip()
    if not rel_path:
        return None

    models_dir = os.path.realpath(_get_models_dir())
    target = os.path.realpath(os.path.join(models_dir, rel_path))
    if not target.startswith(models_dir + os.sep):
        return None

    preview_path = os.path.splitext(target)[0] + PREVIEW_SUFFIX
    return preview_path if os.path.isfile(preview_path) else None


def _cache_path(src_path, size, mtime):
    digest = hashlib.sha1(
        f"{os.path.normcase(src_path)}|{size}|{int(mtime)}".encode('utf-8')
    ).hexdigest()
    return os.path.join(CACHE_DIR, f"{digest}.webp")


def _render_thumb(src_path, dest_path, size):
    """Blocking: decode, downscale, encode. Runs on the thread pool."""
    from PIL import Image, ImageOps

    os.makedirs(os.path.dirname(dest_path), exist_ok=True)

    with Image.open(src_path) as img:
        # JPEG can decode straight to a reduced size — far cheaper than a full
        # decode followed by a resize. A no-op for PNG.
        try:
            img.draft('RGB', (size, size))
        except Exception:
            pass

        img = ImageOps.exif_transpose(img)

        if img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGBA' if 'A' in img.getbands() else 'RGB')

        img.thumbnail((size, size), Image.Resampling.LANCZOS, reducing_gap=2.0)

        # Write to a temp name first so a crash mid-encode cannot leave a
        # truncated file that would be served as a valid cache hit forever.
        tmp_path = f"{dest_path}.{os.getpid()}.tmp"
        img.save(tmp_path, format='WEBP', quality=WEBP_QUALITY, method=4)

    os.replace(tmp_path, dest_path)


def _prune_cache():
    """Blocking: drop the oldest entries once the cache outgrows its budget."""
    try:
        entries = []
        with os.scandir(CACHE_DIR) as it:
            for entry in it:
                if not entry.name.endswith('.webp'):
                    continue
                try:
                    entries.append((entry.stat().st_mtime, entry.path))
                except OSError:
                    pass
        if len(entries) <= CACHE_MAX_FILES:
            return
        entries.sort()
        for _, path in entries[:len(entries) - CACHE_MAX_FILES]:
            try:
                os.remove(path)
            except OSError:
                pass
    except Exception as e:
        print(f"[Civicomfy] Thumbnail cache prune failed: {e}")


def _maybe_prune(loop):
    global _last_prune
    now = time.time()
    if now - _last_prune < _PRUNE_INTERVAL:
        return
    _last_prune = now
    loop.run_in_executor(_EXECUTOR, _prune_cache)


async def _ensure_thumb(src_path, cache_path, size):
    """Generate the thumbnail if missing, collapsing duplicate requests."""
    if os.path.isfile(cache_path):
        return True

    loop = asyncio.get_running_loop()

    existing = _inflight.get(cache_path)
    if existing is not None:
        return await existing

    future = loop.create_future()
    _inflight[cache_path] = future
    try:
        async with _semaphore():
            # Another waiter may have finished it while we queued for a slot.
            if not os.path.isfile(cache_path):
                await loop.run_in_executor(_EXECUTOR, _render_thumb, src_path, cache_path, size)
        result = True
    except Exception as e:
        print(f"[Civicomfy] Thumbnail generation failed for {src_path}: {e}")
        result = False
    finally:
        _inflight.pop(cache_path, None)
        if not future.done():
            future.set_result(result)

    return result


def _requested_size(query):
    try:
        size = int(query.get('size', DEFAULT_SIZE))
    except (TypeError, ValueError):
        return DEFAULT_SIZE
    if size in ALLOWED_SIZES:
        return size
    return min(ALLOWED_SIZES, key=lambda s: (abs(s - size), s))


async def _serve_thumb(src_path, size):
    """Shared tail of both routes: generate if needed, then serve the cache."""
    try:
        mtime = os.path.getmtime(src_path)
    except OSError:
        return web.Response(status=404, text="Image not found")

    cache_path = _cache_path(src_path, size, mtime)

    ok = await _ensure_thumb(src_path, cache_path, size)
    if not ok or not os.path.isfile(cache_path):
        # Signals the caller to fall back to the full-size route.
        return web.Response(status=500, text="Thumbnail generation failed")

    _maybe_prune(asyncio.get_running_loop())

    # The mtime is baked into the URL the client requests, so a given URL always
    # maps to the same bytes — safe to mark immutable and skip revalidation.
    return web.FileResponse(cache_path, headers={
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
    })


@prompt_server.routes.get("/civitai/output_thumb")
async def route_get_output_thumbnail(request):
    """Return a downscaled, disk-cached WebP preview of an output image."""
    query = request.rel_url.query

    src_path = _resolve_source(query.get('filename', ''), query.get('subfolder', ''))
    if not src_path:
        return web.Response(status=404, text="Image not found")

    return await _serve_thumb(src_path, _requested_size(query))


@prompt_server.routes.get("/civitai/model_thumb")
async def route_get_model_thumbnail(request):
    """Return a downscaled, disk-cached WebP preview of a local model."""
    query = request.rel_url.query

    src_path = _resolve_model_preview(query.get('rel_path', ''))
    if not src_path:
        return web.Response(status=404, text="No preview")

    return await _serve_thumb(src_path, _requested_size(query))
