# ================================================
# File: server/routes/GetBaseModels.py
# ================================================
import asyncio
from aiohttp import web
import requests
import server # ComfyUI server instance
from ...api.civitai import CivitaiAPI

prompt_server = server.PromptServer.instance

@prompt_server.routes.get("/civitai/base_models")
async def route_get_base_models(request):
    """Base model names for the Browse filter, read live from the search index.

    Civitai adds base models often and renames some (e.g. "Flux .1 D" became
    "Flux.1 D"); a filter value must match the index spelling exactly.
    """
    try:
        base_models = await asyncio.to_thread(CivitaiAPI().get_base_models_from_search)
        return web.json_response({"base_models": base_models})
    except (requests.exceptions.RequestException, ValueError, KeyError, IndexError, TypeError) as e:
        print(f"[Civicomfy] Could not load base models from Civitai search: {e}")
        return web.json_response({"error": "Could not load base models from Civitai", "details": str(e), "status_code": 502}, status=502)
