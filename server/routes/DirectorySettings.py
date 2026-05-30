# ================================================
# File: server/routes/DirectorySettings.py
# ================================================
import os
from aiohttp import web

import server  # ComfyUI server instance
import folder_paths

from ...utils.helpers import (
    get_default_model_dir,
    load_dir_overrides,
    save_dir_overrides,
)
from ...config import MODEL_TYPE_DIRS

prompt_server = server.PromptServer.instance


def _models_dir() -> str:
    models_dir = getattr(folder_paths, "models_dir", None)
    if not models_dir:
        base = getattr(folder_paths, "base_path", os.getcwd())
        models_dir = os.path.join(base, "models")
    return models_dir


def _display_name(key: str) -> str:
    """Human-friendly label for a model-type folder key."""
    # Prefer a configured display name if the folder maps to a known type.
    for _k, (display, fp_type) in MODEL_TYPE_DIRS.items():
        if fp_type and fp_type.lower() == key.lower():
            return display
    # Otherwise prettify the folder name: "upscale_models" -> "Upscale Models".
    return key.replace("_", " ").replace("-", " ").strip().title()


def _collect_type_keys() -> list:
    """All first-level folders under the models dir, plus any keys that already
    have an override (so a custom type isn't lost if its folder is missing)."""
    keys = set()
    models_dir = _models_dir()
    try:
        if os.path.isdir(models_dir):
            for name in os.listdir(models_dir):
                if os.path.isdir(os.path.join(models_dir, name)):
                    keys.add(name.lower())
    except Exception as e:
        print(f"[Civicomfy] Warning: Failed to enumerate models dir: {e}")
    keys.update(load_dir_overrides().keys())
    return sorted(keys)


@prompt_server.routes.get("/civitai/dir_settings")
async def route_get_dir_settings(request):
    """Return every model type with its default directory and current override."""
    try:
        overrides = load_dir_overrides()
        items = []
        for key in _collect_type_keys():
            try:
                default_dir = get_default_model_dir(key, ensure=False)
            except Exception as e:
                default_dir = f"(unresolved: {e})"
            items.append({
                "key": key,
                "display": _display_name(key),
                "default_dir": default_dir,
                "override": overrides.get(key, ""),
            })
        return web.json_response({"success": True, "items": items})
    except Exception as e:
        return web.json_response(
            {"error": "Failed to load directory settings", "details": str(e)},
            status=500,
        )


@prompt_server.routes.post("/civitai/dir_settings")
async def route_save_dir_settings(request):
    """Persist directory overrides.

    Body: {"overrides": {"<type>": "<absolute_path or empty>", ...}}
    An empty/whitespace path clears the override for that type (uses default).
    """
    try:
        data = await request.json()
        incoming = data.get("overrides")
        if not isinstance(incoming, dict):
            return web.json_response({"error": "Missing or invalid 'overrides'"}, status=400)

        result = {}
        warnings = []
        for raw_key, raw_path in incoming.items():
            key = str(raw_key).strip().lower()
            if not key:
                continue
            path = str(raw_path or "").strip()
            if not path:
                # Empty -> clear override (fall back to default).
                continue
            abs_path = os.path.abspath(os.path.expanduser(path))
            try:
                os.makedirs(abs_path, exist_ok=True)
            except Exception as e:
                warnings.append(f"{key}: could not create '{abs_path}' ({e})")
                continue
            result[key] = abs_path

        if not save_dir_overrides(result):
            return web.json_response({"error": "Failed to persist directory overrides"}, status=500)

        return web.json_response({
            "success": True,
            "overrides": result,
            "warnings": warnings,
        })
    except Exception as e:
        return web.json_response(
            {"error": "Failed to save directory settings", "details": str(e)},
            status=500,
        )
