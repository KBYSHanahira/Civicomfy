# ================================================
# File: server/routes/DeleteOutputImage.py
# ================================================
import os
from aiohttp import web
import server
import folder_paths

prompt_server = server.PromptServer.instance

IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}


def _get_output_dir():
    try:
        return folder_paths.get_output_directory()
    except Exception:
        base = getattr(folder_paths, 'base_path', os.getcwd())
        return os.path.join(base, 'output')


@prompt_server.routes.post("/civitai/delete_output_image")
async def route_delete_output_image(request):
    """Delete one or more output images by filename + subfolder."""
    try:
        data = await request.json()
        images = data.get("images", [])
        if not images or not isinstance(images, list):
            return web.json_response({"error": "Missing 'images' list"}, status=400)

        output_dir = os.path.realpath(_get_output_dir())

        deleted = 0
        errors = []

        for item in images:
            filename = (item.get("filename") or "").strip()
            subfolder = (item.get("subfolder") or "").strip()

            if not filename:
                continue

            rel = os.path.join(subfolder, filename) if subfolder else filename
            target = os.path.realpath(os.path.join(output_dir, rel))

            # Security: path must stay inside output_dir
            if not target.startswith(output_dir + os.sep) and target != output_dir:
                errors.append(f"Invalid path: {filename}")
                continue

            ext = os.path.splitext(target)[1].lower()
            if ext not in IMAGE_EXTENSIONS:
                errors.append(f"Refused to delete non-image file: {filename}")
                continue

            if not os.path.isfile(target):
                errors.append(f"File not found: {filename}")
                continue

            try:
                os.remove(target)
                deleted += 1
            except OSError as e:
                errors.append(f"Failed to delete {filename}: {e}")

        return web.json_response({
            "success": True,
            "deleted": deleted,
            "errors": errors,
        })

    except Exception as e:
        print(f"[Civicomfy] Error deleting output image(s): {e}")
        return web.json_response({"error": str(e)}, status=500)
