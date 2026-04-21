# ================================================
# File: server/routes/MaintenanceProgress.py
# Live progress, stop, and skip endpoints for maintenance operations.
# ================================================
from aiohttp import web
import server
from ..maintenance_state import get_state, request_stop, request_skip

prompt_server = server.PromptServer.instance


@prompt_server.routes.get("/civitai/maintenance_progress")
async def route_maintenance_progress(request):
    """GET /civitai/maintenance_progress – returns live progress state."""
    return web.json_response(get_state())


@prompt_server.routes.post("/civitai/maintenance_stop")
async def route_maintenance_stop(request):
    """POST /civitai/maintenance_stop – request the running operation to stop."""
    request_stop()
    return web.json_response({'ok': True})


@prompt_server.routes.post("/civitai/maintenance_skip")
async def route_maintenance_skip(request):
    """POST /civitai/maintenance_skip – request the running operation to skip the current item."""
    request_skip()
    return web.json_response({'ok': True})
