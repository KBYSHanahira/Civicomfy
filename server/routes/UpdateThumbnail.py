# ================================================
# File: server/routes/UpdateThumbnail.py
# Downloads / refreshes preview thumbnails for local models
# that already have a Civitai sidecar with a ThumbnailUrl or
# VersionId that can be used to look one up.
# ================================================
import os
import json
import asyncio
import aiohttp as aiohttp_lib
from aiohttp import web

import server
import folder_paths
from ...api.civitai import CivitaiAPI
from ...config import METADATA_SUFFIX, PREVIEW_SUFFIX, METADATA_DOWNLOAD_TIMEOUT
from ..maintenance_state import (
    reset as maint_reset, update as maint_update, finish as maint_finish,
    set_current_item as maint_set_item, is_stop_requested, consume_skip,
)

prompt_server = server.PromptServer.instance

MODEL_EXTENSIONS = {'.safetensors', '.ckpt', '.pt', '.pth', '.bin', '.gguf', '.sft'}


def _get_models_dir():
    models_dir = getattr(folder_paths, 'models_dir', None)
    if not models_dir:
        base = getattr(folder_paths, 'base_path', os.getcwd())
        models_dir = os.path.join(base, 'models')
    return models_dir


def _read_sidecar(base_no_ext):
    meta_path = base_no_ext + METADATA_SUFFIX
    if not os.path.isfile(meta_path):
        return None
    try:
        with open(meta_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def _update_sidecar_thumbnail(base_no_ext, url):
    """Write/update ThumbnailUrl into sidecar without touching other fields."""
    meta_path = base_no_ext + METADATA_SUFFIX
    if not os.path.isfile(meta_path):
        return
    try:
        with open(meta_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        data['ThumbnailUrl'] = url
        tmp = meta_path + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp, meta_path)
    except Exception as e:
        print(f"[UpdateThumbnail] Could not update sidecar thumbnail: {e}")


async def _download_image(session, url, dest_path, api_key=''):
    """Download an image URL and save to dest_path as JPEG."""
    headers = {}
    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'
    tmp_path = dest_path + '.tmp'
    try:
        async with session.get(url, headers=headers, timeout=aiohttp_lib.ClientTimeout(total=METADATA_DOWNLOAD_TIMEOUT)) as resp:
            if resp.status != 200:
                return False, f"HTTP {resp.status}"
            content = await resp.read()
        with open(tmp_path, 'wb') as f:
            f.write(content)
        os.replace(tmp_path, dest_path)
        return True, None
    except Exception as e:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
        return False, str(e)


def _collect_models(models_dir, model_types, force_redownload):
    """Collect model files that have a Civitai sidecar."""
    results = []
    if not model_types:
        scan_dirs = [models_dir]
    else:
        scan_dirs = [os.path.join(models_dir, t) for t in model_types if os.path.isdir(os.path.join(models_dir, t))]

    for scan_root in scan_dirs:
        for dirpath, _, filenames in os.walk(scan_root):
            for filename in filenames:
                ext = os.path.splitext(filename)[1].lower()
                if ext not in MODEL_EXTENSIONS:
                    continue
                full_path = os.path.join(dirpath, filename)
                base_no_ext = os.path.splitext(full_path)[0]
                preview_path = base_no_ext + PREVIEW_SUFFIX

                # Skip if preview already exists and not force-redownloading
                if os.path.isfile(preview_path) and not force_redownload:
                    continue

                sidecar = _read_sidecar(base_no_ext)
                if not sidecar:
                    continue

                # Resolve thumbnail URL: prefer sidecar ThumbnailUrl, else need VersionId lookup
                thumb_url = sidecar.get('ThumbnailUrl')
                version_id = sidecar.get('VersionId')
                model_id = sidecar.get('ModelId')

                if not thumb_url and not version_id and not model_id:
                    continue

                results.append({
                    'base_no_ext': base_no_ext,
                    'preview_path': preview_path,
                    'filename': filename,
                    'thumb_url': thumb_url,
                    'version_id': version_id,
                    'model_id': model_id,
                })
    return results


@prompt_server.routes.post("/civitai/update_thumbnails")
async def route_update_thumbnails(request):
    """
    POST /civitai/update_thumbnails
    Body: {
        "model_types": ["checkpoint", "lora", ...],
        "force_redownload": false,
        "api_key": "..."
    }
    Downloads missing (or all when force=true) preview thumbnails for local models.
    """
    try:
        data = await request.json()
    except Exception:
        data = {}

    model_types = data.get('model_types', [])
    force_redownload = bool(data.get('force_redownload', False))
    api_key = data.get('api_key', '')

    models_dir = _get_models_dir()
    if not os.path.isdir(models_dir):
        return web.json_response({'success': False, 'error': 'Models directory not found'}, status=500)

    models = _collect_models(models_dir, model_types, force_redownload)
    if not models:
        return web.json_response({
            'success': True,
            'total': 0,
            'downloaded': 0,
            'skipped': 0,
            'failed': 0,
            'message': 'No models needing thumbnail updates found.',
        })

    api = CivitaiAPI(api_key or None)
    loop = asyncio.get_event_loop()

    # Resolve missing thumbnail URLs via Civitai API first
    for entry in models:
        if entry['thumb_url']:
            continue
        if is_stop_requested():
            break
        version_id = entry['version_id']
        model_id = entry['model_id']
        maint_set_item(f"{entry['filename']} (ID: {version_id or model_id or '?'}) – looking up URL")
        try:
            version_info = None
            if version_id:
                try:
                    res = await asyncio.wait_for(
                        loop.run_in_executor(None, api.get_model_version_info, int(version_id)),
                        timeout=5.0
                    )
                except asyncio.TimeoutError:
                    print(f"[UpdateThumbnail] Timeout looking up URL for {entry['filename']}, skipping")
                    continue
                if res and 'error' not in res:
                    version_info = res
                elif isinstance(res, dict) and res.get('status_code') in (502, 503, 504):
                    print(f"[UpdateThumbnail] Skipping URL lookup for {entry['filename']}: HTTP {res.get('status_code')}")
                    continue
            if not version_info and model_id:
                try:
                    res = await asyncio.wait_for(
                        loop.run_in_executor(None, api.get_model_info, int(model_id)),
                        timeout=5.0
                    )
                except asyncio.TimeoutError:
                    print(f"[UpdateThumbnail] Timeout looking up model info for {entry['filename']}, skipping")
                    continue
                if res and 'error' not in res:
                    versions = res.get('modelVersions') or []
                    if versions:
                        version_info = versions[0]
                elif isinstance(res, dict) and res.get('status_code') in (502, 503, 504):
                    print(f"[UpdateThumbnail] Skipping URL lookup for {entry['filename']}: HTTP {res.get('status_code')}")
                    continue
            if version_info:
                images = version_info.get('images') or []
                for img in images:
                    if isinstance(img, dict) and img.get('url'):
                        entry['thumb_url'] = img['url']
                        _update_sidecar_thumbnail(entry['base_no_ext'], img['url'])
                        break
        except Exception as e:
            print(f"[UpdateThumbnail] Failed to resolve URL for {entry['filename']}: {e}")

    downloaded = 0
    skipped = 0
    failed = 0
    errors = []
    total = len(models)
    maint_reset('thumbnails', total)

    # Download thumbnails using aiohttp async session
    headers = {'User-Agent': 'Civicomfy/1.0'}
    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'

    connector = aiohttp_lib.TCPConnector(limit=4)
    i = 0
    try:
        async with aiohttp_lib.ClientSession(connector=connector, headers=headers) as session:
            for i, entry in enumerate(models):
                # --- Stop check ---
                if is_stop_requested():
                    break

                # --- Skip check ---
                if consume_skip():
                    skipped += 1
                    maint_update(i + 1, downloaded, skipped, failed)
                    continue

                maint_set_item(f"{entry['filename']} (ID: {entry['version_id'] or '?'})")

                if not entry['thumb_url']:
                    skipped += 1
                    maint_update(i + 1, downloaded, skipped, failed)
                    continue

                try:
                    ok, err = await asyncio.wait_for(
                        _download_image(session, entry['thumb_url'], entry['preview_path']),
                        timeout=5.0
                    )
                except asyncio.TimeoutError:
                    print(f"[UpdateThumbnail] Timeout downloading {entry['filename']}, skipping")
                    skipped += 1
                    maint_update(i + 1, downloaded, skipped, failed)
                    continue

                if ok:
                    downloaded += 1
                else:
                    if err and any(code in err for code in ('HTTP 502', 'HTTP 503', 'HTTP 504')):
                        print(f"[UpdateThumbnail] Skipping {entry['filename']}: {err}")
                        skipped += 1
                    else:
                        failed += 1
                        errors.append(f"{entry['filename']}: {err}")
                maint_update(i + 1, downloaded, skipped, failed)
    finally:
        maint_finish()

    stopped = is_stop_requested()
    message = (
        f"Stopped at {i + 1}/{total}. Downloaded {downloaded} thumbnails."
        if stopped
        else f"Done. Downloaded {downloaded} thumbnails, {skipped} skipped, {failed} failed."
    )
    return web.json_response({
        'success': True,
        'stopped': stopped,
        'total': total,
        'downloaded': downloaded,
        'skipped': skipped,
        'failed': failed,
        'errors': errors[:20],
        'message': message,
    })
