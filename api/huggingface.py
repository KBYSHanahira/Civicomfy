# ================================================
# File: api/huggingface.py
# ================================================
import re
import requests
from typing import Optional, Dict, Any


class HuggingFaceAPI:
    """Utility for parsing HuggingFace URLs and retrieving file metadata."""

    BASE_URL = "https://huggingface.co"

    # Matches both /resolve/ and /blob/ URLs
    # e.g. https://huggingface.co/owner/repo/resolve/main/path/to/file.safetensors
    _URL_PATTERN = re.compile(
        r"https?://huggingface\.co/([^/]+/[^/]+)/(resolve|blob)/([^/?#]+)/([^?#]+)"
    )

    def __init__(self, token: Optional[str] = None):
        self.token = token
        self._auth_headers: Dict[str, str] = {}
        if token:
            self._auth_headers["Authorization"] = f"Bearer {token}"
            print("[HuggingFace API] Using token.")
        else:
            print("[HuggingFace API] No token provided (public files only).")

    # ------------------------------------------------------------------
    # URL parsing
    # ------------------------------------------------------------------

    def parse_hf_url(self, url: str) -> Dict[str, Any]:
        """
        Parse a HuggingFace file URL.

        Supported formats:
          - https://huggingface.co/{owner}/{repo}/resolve/{revision}/{filepath}
          - https://huggingface.co/{owner}/{repo}/blob/{revision}/{filepath}

        Returns a dict with:
          valid        – bool
          repo_id      – "{owner}/{repo}"
          revision     – branch/tag/commit (e.g. "main")
          filepath     – path inside the repo (e.g. "model.safetensors")
          filename     – basename of filepath
          download_url – canonical /resolve/ download URL
          error        – present only when valid is False
        """
        url_clean = url.strip().split("?")[0].split("#")[0]
        match = self._URL_PATTERN.match(url_clean)
        if not match:
            return {
                "valid": False,
                "error": (
                    "Not a valid HuggingFace file URL. "
                    "Expected format: https://huggingface.co/{owner}/{repo}/resolve/{revision}/{filepath}"
                ),
            }

        repo_id = match.group(1)
        revision = match.group(3)
        filepath = match.group(4)
        filename = filepath.split("/")[-1]
        download_url = f"{self.BASE_URL}/{repo_id}/resolve/{revision}/{filepath}"

        return {
            "valid": True,
            "repo_id": repo_id,
            "revision": revision,
            "filepath": filepath,
            "filename": filename,
            "download_url": download_url,
        }

    # ------------------------------------------------------------------
    # File metadata (HEAD request)
    # ------------------------------------------------------------------

    def get_file_info(self, download_url: str) -> Dict[str, Any]:
        """
        Retrieve file metadata (primarily size) via a HEAD request.

        Returns a dict with:
          success – bool
          size    – file size in bytes (or None if not available)
          error   – present only when success is False
        """
        try:
            resp = requests.head(
                download_url,
                headers=self._auth_headers,
                allow_redirects=True,
                timeout=20,
            )

            if resp.status_code == 200:
                size: Optional[int] = None
                for header in ("Content-Length", "x-linked-size"):
                    raw = resp.headers.get(header)
                    if raw:
                        try:
                            size = int(raw)
                            break
                        except ValueError:
                            pass
                return {"success": True, "size": size}

            if resp.status_code == 401:
                return {
                    "success": False,
                    "error": "Unauthorized – a HuggingFace token is required for this file.",
                }
            if resp.status_code == 403:
                return {
                    "success": False,
                    "error": (
                        "Access forbidden – you may need to accept the model's "
                        "license on huggingface.co before downloading."
                    ),
                }
            if resp.status_code == 404:
                return {"success": False, "error": "File not found on HuggingFace."}

            return {"success": False, "error": f"Unexpected HTTP {resp.status_code} from HuggingFace."}

        except requests.exceptions.ConnectionError:
            return {"success": False, "error": "Could not connect to huggingface.co. Check your network."}
        except requests.exceptions.Timeout:
            return {"success": False, "error": "Connection to HuggingFace timed out."}
        except requests.exceptions.RequestException as exc:
            return {"success": False, "error": str(exc)}
