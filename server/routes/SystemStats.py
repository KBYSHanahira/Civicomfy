# ================================================
# File: server/routes/SystemStats.py
# ================================================
import psutil
from aiohttp import web
import folder_paths
import server # ComfyUI server instance

try:
    import pynvml
except ImportError:
    pynvml = None

prompt_server = server.PromptServer.instance

# NVML only covers NVIDIA; without it (or without a driver) the monitor shows CPU/RAM/disk only.
_gpu_handles = []
if pynvml is not None:
    try:
        pynvml.nvmlInit()
        _gpu_handles = [pynvml.nvmlDeviceGetHandleByIndex(i) for i in range(pynvml.nvmlDeviceGetCount())]
    except pynvml.NVMLError:
        pass


def _gpu_stats(handle):
    try:
        mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
        return {
            "name": pynvml.nvmlDeviceGetName(handle),
            "util": pynvml.nvmlDeviceGetUtilizationRates(handle).gpu,
            "vram_used": mem.used,
            "vram_total": mem.total,
            "temp": pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU),
        }
    except pynvml.NVMLError:
        return None  # GPU lost (driver reset) or a reading this board does not support


@prompt_server.routes.get("/civitai/system_stats")
async def route_system_stats(request):
    """Live CPU, RAM, disk (the models drive) and NVIDIA GPU usage for the top-bar monitor."""
    ram = psutil.virtual_memory()
    try:
        disk = psutil.disk_usage(folder_paths.models_dir)
        disk = {"used": disk.used, "total": disk.total, "percent": disk.percent}
    except OSError:
        disk = None  # models folder removed (extra_model_paths-only setups)
    return web.json_response({
        "cpu": psutil.cpu_percent(interval=None),
        "ram": {"used": ram.used, "total": ram.total, "percent": ram.percent},
        "disk": disk,
        "gpus": [s for s in map(_gpu_stats, _gpu_handles) if s],
    })
