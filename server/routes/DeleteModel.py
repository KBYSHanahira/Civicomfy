# ================================================
# File: server/routes/DeleteModel.py
# ================================================
import os
import json
from aiohttp import web
import server
import folder_paths

prompt_server = server.PromptServer.instance

MODEL_EXTENSIONS = {'.safetensors', '.ckpt', '.pt', '.pth', '.bin', '.gguf', '.sft'}

@prompt_server.routes.post("/civitai/delete_model")
async def route_delete_model(request):
    """Delete a local model file by its path relative to the models directory."""
    try:
        data = await request.json()
        rel_path = data.get("rel_path", "").strip()

        if not rel_path:
            return web.json_response({"error": "Missing 'rel_path'"}, status=400)

        # Normalise and validate: must not escape models_dir
        models_dir = getattr(folder_paths, 'models_dir', None)
        if not models_dir:
            base = getattr(folder_paths, 'base_path', os.getcwd())
            models_dir = os.path.join(base, 'models')

        # Resolve absolute path and confirm it's inside models_dir
        target = os.path.realpath(os.path.join(models_dir, rel_path))
        if not target.startswith(os.path.realpath(models_dir) + os.sep):
            return web.json_response({"error": "Invalid path: must be inside models directory"}, status=400)

        # Validate extension
        ext = os.path.splitext(target)[1].lower()
        if ext not in MODEL_EXTENSIONS:
            return web.json_response({"error": f"Refusing to delete file with extension '{ext}'"}, status=400)

        if not os.path.isfile(target):
            return web.json_response({"error": "File not found"}, status=404)

        os.remove(target)
        print(f"[Civicomfy] Deleted model file: {target}")
        return web.json_response({"success": True, "deleted": rel_path})

    except json.JSONDecodeError:
        return web.json_response({"error": "Invalid JSON body"}, status=400)
    except PermissionError:
        return web.json_response({"error": "Permission denied: cannot delete the file"}, status=403)
    except Exception as e:
        print(f"[Civicomfy] Error deleting model: {e}")
        return web.json_response({"error": "Internal Server Error", "details": str(e)}, status=500)


@prompt_server.routes.post("/civitai/open_model_folder")
async def route_open_model_folder(request):
    """Open the folder containing a local model file in the system file explorer."""
    import subprocess
    import sys

    try:
        data = await request.json()
        rel_path = data.get("rel_path", "").strip()

        if not rel_path:
            return web.json_response({"error": "Missing 'rel_path'"}, status=400)

        models_dir = getattr(folder_paths, 'models_dir', None)
        if not models_dir:
            base = getattr(folder_paths, 'base_path', os.getcwd())
            models_dir = os.path.join(base, 'models')

        target = os.path.realpath(os.path.join(models_dir, rel_path))
        if not target.startswith(os.path.realpath(models_dir) + os.sep):
            return web.json_response({"error": "Invalid path: must be inside models directory"}, status=400)

        folder = os.path.dirname(target)
        if not os.path.isdir(folder):
            return web.json_response({"error": "Folder not found"}, status=404)

        if sys.platform == 'win32':
            # Highlight the file in Explorer if it exists, otherwise open folder
            if os.path.isfile(target):
                subprocess.Popen(['explorer', '/select,', target])
            else:
                os.startfile(folder)
        elif sys.platform == 'darwin':
            subprocess.Popen(['open', folder])
        else:
            subprocess.Popen(['xdg-open', folder])

        return web.json_response({"success": True})

    except json.JSONDecodeError:
        return web.json_response({"error": "Invalid JSON body"}, status=400)
    except Exception as e:
        print(f"[Civicomfy] Error opening model folder: {e}")
        return web.json_response({"error": "Internal Server Error", "details": str(e)}, status=500)
