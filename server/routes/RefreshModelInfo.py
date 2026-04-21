# ================================================
# File: server/routes/RefreshModelInfo.py
# Scans local models that have a Civitai sidecar (.cminfo.json)
# and re-fetches their metadata from the Civitai API, then updates
# the sidecar in place.  Works per model-type folder.
# ================================================
import os
import json
import datetime
import asyncio
from aiohttp import web

import server
import folder_paths
from ...api.civitai import CivitaiAPI
from ...config import METADATA_SUFFIX, PREVIEW_SUFFIX
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


def _write_sidecar(base_no_ext, data):
    meta_path = base_no_ext + METADATA_SUFFIX
    tmp_path = meta_path + '.tmp'
    try:
        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, meta_path)
        return True
    except Exception as e:
        print(f"[RefreshModelInfo] Failed to write sidecar {meta_path}: {e}")
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
        return False


def _collect_models(models_dir, model_types):
    """Collect all model files that have a civitai sidecar with a VersionId or ModelId."""
    results = []
    if not model_types:
        # Scan everything
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
                sidecar = _read_sidecar(base_no_ext)
                if not sidecar:
                    continue
                version_id = sidecar.get('VersionId')
                model_id = sidecar.get('ModelId')
                if not version_id and not model_id:
                    continue
                results.append({
                    'base_no_ext': base_no_ext,
                    'filename': filename,
                    'version_id': version_id,
                    'model_id': model_id,
                    'sidecar': sidecar,
                })
    return results


def _merge_sidecar(old: dict, model_info: dict, version_info: dict) -> dict:
    """Merge fresh API data into the existing sidecar, preserving local fields."""
    creator_info = model_info.get('creator', {}) or {}
    model_stats = model_info.get('stats', {}) or {}
    version_stats = version_info.get('stats', {}) or {}

    updated = dict(old)  # start from existing

    # Core identifiers
    updated['ModelId'] = model_info.get('id', old.get('ModelId'))
    updated['ModelName'] = model_info.get('name', old.get('ModelName'))
    updated['ModelDescription'] = model_info.get('description', old.get('ModelDescription'))
    updated['ModelType'] = model_info.get('type', old.get('ModelType'))
    updated['Nsfw'] = model_info.get('nsfw', old.get('Nsfw', False))
    updated['Poi'] = model_info.get('poi', old.get('Poi', False))
    updated['Tags'] = model_info.get('tags', old.get('Tags', []))
    updated['CreatorUsername'] = creator_info.get('username', old.get('CreatorUsername'))

    # Version fields
    updated['VersionId'] = version_info.get('id', old.get('VersionId'))
    updated['VersionName'] = version_info.get('name', old.get('VersionName'))
    updated['VersionDescription'] = version_info.get('description', old.get('VersionDescription'))
    updated['BaseModel'] = version_info.get('baseModel', old.get('BaseModel'))
    updated['BaseModelType'] = version_info.get('baseModelType', old.get('BaseModelType'))
    updated['TrainedWords'] = version_info.get('trainedWords', old.get('TrainedWords', []))

    # Example prompts from images
    images = version_info.get('images') or []
    example_prompts = [
        img['meta']['prompt']
        for img in images
        if isinstance(img, dict)
        and isinstance(img.get('meta'), dict)
        and img['meta'].get('prompt')
    ][:5]
    if example_prompts:
        updated['ExamplePrompts'] = example_prompts

    # Stats
    updated['Stats'] = {
        'downloadCount': version_stats.get('downloadCount', model_stats.get('downloadCount', 0)),
        'rating': version_stats.get('rating', model_stats.get('rating', 0)),
        'ratingCount': version_stats.get('ratingCount', model_stats.get('ratingCount', 0)),
        'thumbsUpCount': version_stats.get('thumbsUpCount', 0),
        'thumbsDownCount': version_stats.get('thumbsDownCount', 0),
    }

    # Thumbnail URL (first valid image)
    for img in images:
        if isinstance(img, dict) and img.get('url'):
            updated['ThumbnailUrl'] = img['url']
            break

    updated['RefreshedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return updated


@prompt_server.routes.post("/civitai/refresh_model_info")
async def route_refresh_model_info(request):
    """
    POST /civitai/refresh_model_info
    Body: { "model_types": ["checkpoint", "lora", ...], "api_key": "..." }
    Scans local models with Civitai metadata and refreshes them from the API.
    Returns a progress-friendly summary.
    """
    try:
        data = await request.json()
    except Exception:
        data = {}

    model_types = data.get('model_types', [])  # empty = all
    api_key = data.get('api_key', '')

    models_dir = _get_models_dir()
    if not os.path.isdir(models_dir):
        return web.json_response({'success': False, 'error': 'Models directory not found'}, status=500)

    models = _collect_models(models_dir, model_types)
    if not models:
        return web.json_response({
            'success': True,
            'total': 0,
            'updated': 0,
            'skipped': 0,
            'failed': 0,
            'message': 'No models with Civitai metadata found for the selected types.',
        })

    api = CivitaiAPI(api_key or None)
    updated = 0
    skipped = 0
    failed = 0
    errors = []

    loop = asyncio.get_event_loop()
    total = len(models)
    maint_reset('refresh', total)

    try:
        for i, entry in enumerate(models):
            # --- Stop check ---
            if is_stop_requested():
                break

            version_id = entry['version_id']
            model_id = entry['model_id']
            sidecar = entry['sidecar']
            base_no_ext = entry['base_no_ext']
            entry_updated = False
            entry_skipped = False
            entry_failed = False

            item_label = f"{entry['filename']} (ID: {version_id or model_id or '?'})"
            maint_set_item(item_label)

            # --- Skip check (requested before this item started) ---
            if consume_skip():
                entry_skipped = True

            try:
                version_info = {}
                model_info = {}

                # Fetch version info (preferred) – 5-second timeout
                if not entry_skipped and version_id:
                    try:
                        result = await asyncio.wait_for(
                            loop.run_in_executor(None, api.get_model_version_info, int(version_id)),
                            timeout=5.0
                        )
                    except asyncio.TimeoutError:
                        print(f"[RefreshModelInfo] Timeout for {entry['filename']}, skipping")
                        entry_skipped = True
                        result = None
                    if result and 'error' not in result:
                        version_info = result
                        if not model_id and version_info.get('modelId'):
                            model_id = version_info['modelId']
                    elif isinstance(result, dict) and result.get('status_code') in (502, 503, 504):
                        print(f"[RefreshModelInfo] Skipping {entry['filename']}: HTTP {result.get('status_code')}")
                        entry_skipped = True

                # Check skip after first API call
                if not entry_skipped and consume_skip():
                    entry_skipped = True

                # Fetch model info – 5-second timeout
                if not entry_skipped and model_id:
                    try:
                        result = await asyncio.wait_for(
                            loop.run_in_executor(None, api.get_model_info, int(model_id)),
                            timeout=5.0
                        )
                    except asyncio.TimeoutError:
                        print(f"[RefreshModelInfo] Timeout fetching model info for {entry['filename']}, skipping")
                        entry_skipped = True
                        result = None
                    if result and 'error' not in result:
                        model_info = result
                    elif isinstance(result, dict) and result.get('status_code') in (502, 503, 504):
                        print(f"[RefreshModelInfo] Skipping {entry['filename']}: HTTP {result.get('status_code')}")
                        entry_skipped = True

                if not entry_skipped and not version_info and not model_info:
                    entry_skipped = True

                if not entry_skipped:
                    merged = _merge_sidecar(sidecar, model_info, version_info)
                    if _write_sidecar(base_no_ext, merged):
                        entry_updated = True
                    else:
                        entry_failed = True
                        errors.append(entry['filename'])

            except Exception as e:
                print(f"[RefreshModelInfo] Error processing {entry['filename']}: {e}")
                entry_failed = True
                errors.append(f"{entry['filename']}: {str(e)[:100]}")

            if entry_updated:
                updated += 1
            elif entry_skipped:
                skipped += 1
            elif entry_failed:
                failed += 1

            maint_update(i + 1, updated, skipped, failed)
    finally:
        maint_finish()

    stopped = is_stop_requested()
    message = (
        f"Stopped at {i + 1}/{total}. Updated {updated} models."
        if stopped
        else f"Done. Updated {updated}/{total} models."
    )
    return web.json_response({
        'success': True,
        'stopped': stopped,
        'total': total,
        'updated': updated,
        'skipped': skipped,
        'failed': failed,
        'errors': errors[:20],
        'message': message,
    })
