# ================================================
# File: server/routes/GetOutputImages.py
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


@prompt_server.routes.get("/civitai/output_images")
async def route_get_output_images(request):
    """List output images with pagination and filtering."""
    try:
        output_dir = _get_output_dir()
        if not os.path.isdir(output_dir):
            return web.json_response({"images": [], "total": 0, "total_pages": 1, "subfolders": []})

        try:
            page = max(1, int(request.rel_url.query.get('page', 1)))
        except (ValueError, TypeError):
            page = 1
        try:
            limit = min(200, max(1, int(request.rel_url.query.get('limit', 50))))
        except (ValueError, TypeError):
            limit = 50

        subfolder_filter = request.rel_url.query.get('subfolder', '').strip()
        sort = request.rel_url.query.get('sort', 'time_desc')

        subfolders = set()
        all_images = []

        for dirpath, dirnames, filenames in os.walk(output_dir):
            rel_dir = os.path.relpath(dirpath, output_dir).replace('\\', '/')
            if rel_dir == '.':
                rel_dir = ''
            else:
                subfolders.add(rel_dir)

            if subfolder_filter and rel_dir != subfolder_filter:
                continue

            for filename in sorted(filenames):
                ext = os.path.splitext(filename)[1].lower()
                if ext not in IMAGE_EXTENSIONS:
                    continue

                full_path = os.path.join(dirpath, filename)
                try:
                    stat = os.stat(full_path)
                    all_images.append({
                        "filename": filename,
                        "subfolder": rel_dir,
                        "size_bytes": stat.st_size,
                        "mtime": stat.st_mtime,
                    })
                except OSError:
                    pass

        if sort == 'time_asc':
            all_images.sort(key=lambda x: x['mtime'])
        elif sort == 'name_asc':
            all_images.sort(key=lambda x: x['filename'].lower())
        elif sort == 'name_desc':
            all_images.sort(key=lambda x: x['filename'].lower(), reverse=True)
        else:  # time_desc (default)
            all_images.sort(key=lambda x: x['mtime'], reverse=True)

        total = len(all_images)
        start = (page - 1) * limit
        page_images = all_images[start:start + limit]

        return web.json_response({
            "images": page_images,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": max(1, (total + limit - 1) // limit),
            "subfolders": sorted(subfolders),
        })
    except Exception as e:
        print(f"[Civicomfy] Error listing output images: {e}")
        return web.json_response({"error": str(e)}, status=500)
