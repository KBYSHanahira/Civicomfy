# ================================================
# File: server/routes/DownloadModelHF.py
# ================================================
import os
import json
import traceback
from aiohttp import web

import server  # ComfyUI server instance
from ..utils import get_request_json
from ...downloader.manager import manager as download_manager
from ...api.huggingface import HuggingFaceAPI
from ...utils.helpers import get_model_dir, sanitize_filename
from ...config import METADATA_SUFFIX, PREVIEW_SUFFIX

prompt_server = server.PromptServer.instance


@prompt_server.routes.post("/civitai/download_hf")
async def route_download_model_hf(request):
    """API Endpoint to initiate a HuggingFace model download."""
    try:
        data = await get_request_json(request)

        hf_url = (data.get("hf_url") or "").strip()
        model_type_value = data.get("model_type", "checkpoint")
        explicit_save_root = (data.get("save_root") or "").strip()
        custom_filename_input = (data.get("custom_filename") or "").strip()
        selected_subdir = (data.get("subdir") or "").strip()
        num_connections = int(data.get("num_connections", 1))
        force_redownload = bool(data.get("force_redownload", False))
        hf_token = (data.get("hf_token") or "").strip()

        if not hf_url:
            raise web.HTTPBadRequest(reason="Missing 'hf_url'")

        # --- Parse the HuggingFace URL ---
        api = HuggingFaceAPI(hf_token or None)
        parsed = api.parse_hf_url(hf_url)
        if not parsed.get("valid"):
            raise web.HTTPBadRequest(reason=parsed.get("error", "Invalid HuggingFace URL"))

        repo_id: str = parsed["repo_id"]
        filename: str = parsed["filename"]
        download_url: str = parsed["download_url"]
        filepath: str = parsed["filepath"]
        revision: str = parsed["revision"]

        print(f"[Server Download HF] repo={repo_id}, revision={revision}, file={filepath}")

        # --- Verify the file is accessible and get its size ---
        file_info = api.get_file_info(download_url)
        if not file_info.get("success"):
            raise web.HTTPBadRequest(reason=file_info.get("error", "Could not access HuggingFace file"))

        known_size: int | None = file_info.get("size")

        # --- Determine final filename ---
        if custom_filename_input:
            safe_name = sanitize_filename(custom_filename_input)
            base, ext = os.path.splitext(safe_name)
            if not ext:
                _, api_ext = os.path.splitext(filename)
                safe_name = base + (api_ext or "")
            final_filename = safe_name
        else:
            final_filename = sanitize_filename(filename)

        # --- Resolve subdirectory ---
        sub_path = ""
        if selected_subdir:
            norm_sub = os.path.normpath(selected_subdir.replace("\\", "/"))
            parts = [p for p in norm_sub.split("/") if p and p not in (".", "..")]
            if parts:
                sub_path = os.path.join(*[sanitize_filename(p) for p in parts])

        # --- Resolve base output directory ---
        if explicit_save_root:
            try:
                from ..routes.GetModelDirs import _get_all_roots_for_type
                known_roots = _get_all_roots_for_type(model_type_value)
                if os.path.abspath(explicit_save_root) in [os.path.abspath(p) for p in known_roots]:
                    base_output_dir = explicit_save_root
                else:
                    print(f"[Server Download HF] Warning: save_root not in known roots – using default.")
                    base_output_dir = get_model_dir(model_type_value)
            except Exception as exc:
                print(f"[Server Download HF] Warning: Could not validate save_root: {exc}")
                base_output_dir = get_model_dir(model_type_value)
        else:
            base_output_dir = get_model_dir(model_type_value)

        output_dir = os.path.join(base_output_dir, sub_path) if sub_path else base_output_dir
        try:
            os.makedirs(output_dir, exist_ok=True)
        except OSError as exc:
            raise web.HTTPInternalServerError(reason=f"Could not create output directory: {exc}")

        output_path = os.path.join(output_dir, final_filename)

        # --- Check for an existing file ---
        if not force_redownload and os.path.exists(output_path):
            existing_size = os.path.getsize(output_path)
            if known_size and existing_size == known_size:
                return web.json_response({
                    "status": "exists",
                    "message": f"File already exists: {final_filename}",
                    "details": {"filename": final_filename, "output_path": output_path},
                })
            elif known_size and existing_size != known_size:
                return web.json_response({
                    "status": "exists_size_mismatch",
                    "message": (
                        f"File exists but size differs "
                        f"({existing_size} vs {known_size} bytes). "
                        "Use Force Re-download to replace it."
                    ),
                    "details": {"filename": final_filename, "output_path": output_path},
                })

        # --- Build the download info dict ---
        # Keep the same shape as Civitai downloads for manager compatibility.
        download_info = {
            "url": download_url,
            "output_path": output_path,
            "filename": final_filename,
            "num_connections": num_connections,
            # ChunkDownloader uses api_key as the Bearer token header value.
            # For HuggingFace we pass the HF token via the same field.
            "api_key": hf_token or None,
            "known_size": known_size,
            "model_type": model_type_value,
            "model_url_or_id": hf_url,
            "model_version_id": None,
            "custom_filename": custom_filename_input,
            "force_redownload": force_redownload,
            # HuggingFace-specific metadata
            "source": "huggingface",
            "hf_repo_id": repo_id,
            "hf_revision": revision,
            "hf_filepath": filepath,
            # Civitai-specific fields – empty but required by manager for retry compatibility
            "civitai_model_info": {},
            "civitai_version_info": {},
            "civitai_primary_file": {},
            "thumbnail": None,
        }

        download_id = download_manager.add_to_queue(download_info)

        print(f"[Server Download HF] Queued: {final_filename} (ID: {download_id}, Size: {known_size})")

        return web.json_response({
            "status": "queued",
            "download_id": download_id,
            "message": f"Download queued: {final_filename}",
            "details": {
                "filename": final_filename,
                "repo_id": repo_id,
                "output_path": output_path,
                "known_size": known_size,
            },
        })

    except web.HTTPException:
        raise
    except Exception as exc:
        print(f"[Server Download HF] Unexpected error: {exc}\n{traceback.format_exc()}")
        raise web.HTTPInternalServerError(reason=str(exc))


@prompt_server.routes.post("/civitai/get_model_details_hf")
async def route_get_model_details_hf(request):
    """API Endpoint to fetch HuggingFace file metadata for the download preview."""
    try:
        data = await get_request_json(request)

        hf_url = (data.get("hf_url") or "").strip()
        hf_token = (data.get("hf_token") or "").strip()

        if not hf_url:
            raise web.HTTPBadRequest(reason="Missing 'hf_url'")

        api = HuggingFaceAPI(hf_token or None)
        parsed = api.parse_hf_url(hf_url)
        if not parsed.get("valid"):
            return web.json_response({"success": False, "error": parsed.get("error", "Invalid HuggingFace URL")})

        file_info = api.get_file_info(parsed["download_url"])
        if not file_info.get("success"):
            return web.json_response({"success": False, "error": file_info.get("error", "Could not access file")})

        return web.json_response({
            "success": True,
            "repo_id": parsed["repo_id"],
            "revision": parsed["revision"],
            "filepath": parsed["filepath"],
            "filename": parsed["filename"],
            "download_url": parsed["download_url"],
            "size": file_info.get("size"),
        })

    except web.HTTPException:
        raise
    except Exception as exc:
        print(f"[Server GetDetails HF] Unexpected error: {exc}\n{traceback.format_exc()}")
        raise web.HTTPInternalServerError(reason=str(exc))
