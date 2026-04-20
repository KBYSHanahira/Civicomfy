# ================================================
# File: server/routes/GetLocalModels.py
# ================================================
import os
import json
from aiohttp import web
import server
import folder_paths
from ...config import METADATA_SUFFIX, PREVIEW_SUFFIX

prompt_server = server.PromptServer.instance

MODEL_EXTENSIONS = {'.safetensors', '.ckpt', '.pt', '.pth', '.bin', '.gguf', '.sft'}


def _get_models_dir():
    models_dir = getattr(folder_paths, 'models_dir', None)
    if not models_dir:
        base = getattr(folder_paths, 'base_path', os.getcwd())
        models_dir = os.path.join(base, 'models')
    return models_dir


def _read_sidecar(base_path_no_ext):
    """Read .cminfo.json sidecar and return relevant fields, or empty dict."""
    meta_path = base_path_no_ext + METADATA_SUFFIX
    if not os.path.isfile(meta_path):
        return {}
    try:
        with open(meta_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return {
            "civitai_model_id": data.get("ModelId"),
            "civitai_version_id": data.get("VersionId"),
            "model_name": data.get("ModelName"),
            "version_name": data.get("VersionName"),
            "base_model": data.get("BaseModel"),
            "model_type_civitai": data.get("ModelType"),
            "trained_words": data.get("TrainedWords", []),
            "example_prompts": data.get("ExamplePrompts", []),
            "description": data.get("ModelDescription") or data.get("VersionDescription") or "",
            "nsfw": data.get("Nsfw", False),
        }
    except Exception:
        return {}


@prompt_server.routes.get("/civitai/local_models")
async def route_get_local_models(request):
    """List all local model files, optionally filtered by model type folder."""
    try:
        filter_type = request.rel_url.query.get('type', '').strip()

        models_dir = _get_models_dir()
        if not os.path.isdir(models_dir):
            return web.json_response({"models": [], "types": []})

        # Collect type folders
        type_folders = sorted(
            name for name in os.listdir(models_dir)
            if os.path.isdir(os.path.join(models_dir, name))
        )

        models = []
        scan_root = os.path.join(models_dir, filter_type) if filter_type else models_dir

        for dirpath, dirnames, filenames in os.walk(scan_root):
            rel_dir = os.path.relpath(dirpath, models_dir)
            parts = rel_dir.replace('\\', '/').split('/')
            model_type = parts[0] if parts[0] != '.' else ''

            for filename in sorted(filenames):
                ext = os.path.splitext(filename)[1].lower()
                if ext not in MODEL_EXTENSIONS:
                    continue

                full_path = os.path.join(dirpath, filename)
                rel_path = os.path.relpath(full_path, models_dir).replace('\\', '/')

                try:
                    size_bytes = os.path.getsize(full_path)
                    mtime = os.path.getmtime(full_path)
                except OSError:
                    size_bytes = 0
                    mtime = 0

                base_no_ext = os.path.splitext(full_path)[0]
                sidecar = _read_sidecar(base_no_ext)
                has_preview = os.path.isfile(base_no_ext + PREVIEW_SUFFIX)

                entry = {
                    "name": filename,
                    "rel_path": rel_path,
                    "model_type": model_type,
                    "size_bytes": size_bytes,
                    "modified": mtime,
                    "has_preview": has_preview,
                }
                entry.update(sidecar)
                models.append(entry)

        return web.json_response({"models": models, "types": type_folders})

    except Exception as e:
        print(f"[Civicomfy] Error listing local models: {e}")
        return web.json_response({"error": "Internal Server Error", "details": str(e)}, status=500)


@prompt_server.routes.get("/civitai/model_preview_image")
async def route_model_preview_image(request):
    """Serve the .preview.jpeg sidecar for a local model file."""
    try:
        rel_path = request.rel_url.query.get('rel_path', '').strip()
        if not rel_path:
            return web.Response(status=400, text="Missing rel_path")

        models_dir = _get_models_dir()
        target = os.path.realpath(os.path.join(models_dir, rel_path))
        if not target.startswith(os.path.realpath(models_dir) + os.sep):
            return web.Response(status=400, text="Invalid path")

        base_no_ext = os.path.splitext(target)[0]
        preview_path = base_no_ext + PREVIEW_SUFFIX

        if not os.path.isfile(preview_path):
            return web.Response(status=404, text="No preview")

        return web.FileResponse(preview_path, headers={"Content-Type": "image/jpeg", "Cache-Control": "max-age=86400"})

    except Exception as e:
        print(f"[Civicomfy] Error serving model preview: {e}")
        return web.Response(status=500, text="Internal Server Error")

