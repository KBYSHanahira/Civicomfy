# ================================================
# File: config.py
# ================================================
import os
import folder_paths # Use ComfyUI's folder_paths

# --- Configuration ---
MAX_CONCURRENT_DOWNLOADS = 3
DEFAULT_CHUNK_SIZE = 1024 * 1024  # 1MB
DEFAULT_CONNECTIONS = 4
DOWNLOAD_HISTORY_LIMIT = 100
DOWNLOAD_TIMEOUT = 60 # Timeout for individual download chunks/requests (seconds)
HEAD_REQUEST_TIMEOUT = 25 # Timeout for initial HEAD request (seconds)
METADATA_DOWNLOAD_TIMEOUT = 20 # Timeout for downloading thumbnail (seconds)

# --- Paths ---
# The root directory of *this specific plugin/extension*
# Calculated based on the location of this config.py file
PLUGIN_ROOT = os.path.dirname(os.path.realpath(__file__))

# Construct web paths relative to the plugin's root directory
WEB_DIRECTORY = os.path.join(PLUGIN_ROOT, "web")
JAVASCRIPT_PATH = os.path.join(WEB_DIRECTORY, "js")
CSS_PATH = os.path.join(WEB_DIRECTORY, "css")
# Corrected path construction to avoid issues with leading slashes
PLACEHOLDER_IMAGE_PATH = os.path.join(WEB_DIRECTORY, "images", "placeholder.jpeg")

# Get ComfyUI directories using folder_paths
COMFYUI_ROOT_DIR = folder_paths.base_path
# MODELS_DIR removed; resolve per-type via folder_paths

# --- Model Types ---
# Maps the internal key (lowercase) to a tuple: (display_name, folder_paths_type)
# The folder_paths_type is used by ComfyUI's folder_paths.get_directory_by_type().
MODEL_TYPE_DIRS = {
    "checkpoint": ("Checkpoint", "checkpoints"),
    "diffusionmodels": ("Diffusion Models", "diffusion_models"),
    "unet": ("Unet", "unet"),
    "lora": ("Lora", "loras"),
    "locon": ("LoCon", "loras"),
    "lycoris": ("LyCORIS", "loras"),
    "vae": ("VAE", "vae"),
    "embedding": ("Embedding", "embeddings"),
    "hypernetwork": ("Hypernetwork", "hypernetworks"),
    "controlnet": ("ControlNet", "controlnet"),
    "upscaler": ("Upscaler", "upscale_models"),
    "motionmodule": ("Motion Module", "motion_models"),
    "poses": ("Poses", "poses"),
    "wildcards": ("Wildcards", "wildcards"),
    # 'other' will save to a dedicated folder inside the Civicomfy extension directory
    "other": ("Other", None)
}

# Maps ComfyUI folder names (lowercase) to Civitai API 'types' parameter value
# Used when Browse tab sends the actual folder name instead of the internal key
FOLDER_TO_CIVITAI_TYPE_MAP = {
    "checkpoints": "Checkpoint",
    "loras": "LORA",
    "vae": "VAE",
    "vae_approx": "VAE",
    "embeddings": "TextualInversion",
    "hypernetworks": "Hypernetwork",
    "controlnet": "Controlnet",
    "diffusers": "Checkpoint",
    "diffusion_models": "Checkpoint",
    "unet": "UNET",
    "upscale_models": "Upscaler",
    "latent_upscale_models": "Upscaler",
    "motion_models": "MotionModule",
    "poses": "Poses",
    "wildcards": "Wildcards",
    "clip": "Checkpoint",
    "clip_vision": "Checkpoint",
}

# Civitai API specific type mapping (for search filters)
# Maps internal key (lowercase) to Civitai API 'types' parameter value
CIVITAI_API_TYPE_MAP = {
    "checkpoint": "Checkpoint",
    "lora": "LORA",
    "locon": "LoCon",
    "lycoris": "LoCon",
    "dora": "DoRA",
    "vae": "VAE",
    "embedding": "TextualInversion",
    "textualinversion": "TextualInversion",
    "hypernetwork": "Hypernetwork",
    "controlnet": "Controlnet",
    "motionmodule": "MotionModule",
    "motion": "MotionModule",
    "poses": "Poses",
    "wildcards": "Wildcards",
    "workflows": "Workflows",
    "upscaler": "Upscaler",
    "unet": "UNET",
    "detection": "Detection",
    "aestheticgradient": "AestheticGradient",
    "aesthetic_gradient": "AestheticGradient",
    "other": "Other",
    "diffusionmodels": "Checkpoint",
}


# --- Filename Suffixes ---
METADATA_SUFFIX = ".cminfo.json"
PREVIEW_SUFFIX = ".preview.jpeg" # Keep as requested, even if source is png/webp

# --- Log Initial Paths for Verification ---
print("-" * 30)
print("[Civicomfy Config Initialized]")
print(f"  - Plugin Root: {PLUGIN_ROOT}")
print(f"  - Web Directory: {WEB_DIRECTORY}")
print(f"  - ComfyUI Base Path: {COMFYUI_ROOT_DIR}")
print("-" * 30)
