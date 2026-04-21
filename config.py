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
    "diffusionmodels": ("Diffusion Models", "diffusers"),
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

AVAILABLE_MEILI_BASE_MODELS = [
    "Anima", "Aura Flow", "Chroma", "CogVideoX", "Ernie",
    "Flux .1 D", "Flux .1 Kontext", "Flux .1 Krea", "Flux .1 S", "Flux .2 D",
    "Flux .2 Klein 4B", "Flux .2 Klein 4B-Base", "Flux .2 Klein 9B", "Flux .2 Klein 9B-Base",
    "Grok", "HiDream", "Hunyuan 1", "Hunyuan Video",
    "Illustrious", "Illustrious 0.1", "Imagen 4",
    "Kling", "Kolors", "LTXV", "LTXV 2.3", "LTXV2", "Lumina",
    "Mochi", "Nano Banana", "NoobAI", "ODOR", "Open AI", "Other",
    "PixArt Σ", "PixArt A", "Playground V2", "Pony", "Pony V7",
    "Qwen", "Qwen 2",
    "SD 1.4", "SD 1.5", "SD 1.5 Hyper", "SD 1.5 LCM",
    "SD 2.0", "SD 2.0 768", "SD 2.1", "SD 2.1 768", "SD 2.1 Unclip",
    "SDXL 0.9", "SDXL 1.0", "SDXL 1.0 LCM", "SDXL Distilled", "SDXL Hyper", "SDXL Lightning",
    "SVD XT", "Seedance", "Seedream", "Sora 2", "Stable Cascade",
    "Upscaler", "Veo 3", "Vidu Q1",
    "Wan Image 2.7", "WAN Video",
    "Wan Video 1.3B T2v",
    "Wan Video 14B I2v 480p", "Wan Video 14B I2v 720p", "Wan Video 14B T2v",
    "Wan Video 2.2 I2V-A14B", "Wan Video 2.2 T2V-A14B", "Wan Video 2.2 TI2V-5B",
    "Wan Video 2.5 I2V", "Wan Video 2.5 T2V", "Wan Video 2.7",
    "Z Image Base", "Z Image Turbo",
]

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
