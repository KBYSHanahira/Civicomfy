# ================================================
# File: server/routes/ModelFileSizes.py
# ================================================
import traceback
from typing import Any, Dict, List
from aiohttp import web

import server # ComfyUI server instance
from ..utils import get_request_json
from ...api.civitai import CivitaiAPI
from ...utils.helpers import select_primary_file

prompt_server = server.PromptServer.instance

# The Meilisearch documents used by Browse/Search carry no file information at
# all, so sizes have to come from the REST API. Published version files are
# immutable, so the lookups are cached for the life of the process — Browse
# re-renders the same models constantly (paging back and forth, switching
# tabs) and every miss is a Civitai round trip.
_MODEL_SIZE_CACHE: Dict[str, Dict[str, Dict[str, Any]]] = {}
_MODEL_SIZE_CACHE_MAX = 4000

# Cap the work a single render can ask for, and keep each upstream call inside
# the /models endpoint's own `limit` ceiling of 100.
MAX_MODELS_PER_REQUEST = 200
CHUNK_SIZE = 50


def _versions_from_model(model: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Map version id -> {sizeKB, name} for a model's primary file per version."""
    out: Dict[str, Dict[str, Any]] = {}
    for version in model.get("modelVersions") or []:
        if not isinstance(version, dict):
            continue
        version_id = version.get("id")
        if version_id is None:
            continue
        files = version.get("files")
        primary_file = select_primary_file(files if isinstance(files, list) else [])
        size_kb = primary_file.get("sizeKB") if primary_file else None
        if size_kb is None:
            size_kb = version.get("fileSizeKB")
        if size_kb is None:
            continue
        try:
            size_kb = float(size_kb)
        except (TypeError, ValueError):
            continue
        out[str(version_id)] = {
            "sizeKB": size_kb,
            "name": (primary_file or {}).get("name") or "",
        }
    return out


@prompt_server.routes.post("/civitai/model_file_sizes")
async def route_model_file_sizes(request):
    """Resolve download sizes for a batch of models, keyed by version id."""
    try:
        data = await get_request_json(request)
        raw_ids = data.get("model_ids") or []
        api_key = data.get("api_key") or ""

        if not isinstance(raw_ids, list):
            raise web.HTTPBadRequest(reason="'model_ids' must be a list.")

        model_ids: List[str] = []
        for raw_id in raw_ids:
            model_id = str(raw_id).strip()
            if model_id.isdigit() and model_id not in model_ids:
                model_ids.append(model_id)
            if len(model_ids) >= MAX_MODELS_PER_REQUEST:
                break

        pending = [mid for mid in model_ids if mid not in _MODEL_SIZE_CACHE]

        if pending:
            api = CivitaiAPI(api_key or None)
            for start in range(0, len(pending), CHUNK_SIZE):
                chunk = pending[start:start + CHUNK_SIZE]
                result = api.get_models_bulk(chunk)
                if not isinstance(result, dict) or "error" in result:
                    details = result.get("details") if isinstance(result, dict) else None
                    print(f"[Server FileSizes] Lookup failed for {len(chunk)} models: {details}")
                    continue

                if len(_MODEL_SIZE_CACHE) > _MODEL_SIZE_CACHE_MAX:
                    _MODEL_SIZE_CACHE.clear()

                returned = set()
                for model in result.get("items") or []:
                    if not isinstance(model, dict) or model.get("id") is None:
                        continue
                    model_id = str(model["id"])
                    returned.add(model_id)
                    _MODEL_SIZE_CACHE[model_id] = _versions_from_model(model)

                # Models the API withheld (deleted, unpublished, or otherwise
                # unavailable) get an empty entry so they are not re-requested
                # on every render.
                for model_id in chunk:
                    if model_id not in returned:
                        _MODEL_SIZE_CACHE[model_id] = {}

        versions: Dict[str, Dict[str, Any]] = {}
        for model_id in model_ids:
            versions.update(_MODEL_SIZE_CACHE.get(model_id) or {})

        return web.json_response({"versions": versions})

    except web.HTTPError as http_err:
        return web.json_response(
            {"error": http_err.reason, "details": "", "status_code": http_err.status},
            status=http_err.status,
        )
    except Exception as e:
        print("--- Unhandled Error in /civitai/model_file_sizes ---")
        traceback.print_exc()
        print("--- End Error ---")
        return web.json_response(
            {"error": "Internal Server Error", "details": str(e), "status_code": 500},
            status=500,
        )
