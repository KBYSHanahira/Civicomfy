// Categorical colours for model-type chips.
//
// One map for the whole UI so a "LoRA" chip is the same colour in Browse, My
// Models and the detail panels. The hues are deliberately desaturated so they
// sit next to the Claude coral accent without competing with it, and they keep
// enough contrast to stay readable in both the dark and light palettes.
//
// Keys cover both spellings we get from the two data sources: Civitai model
// types (singular, e.g. "checkpoint") and ComfyUI folder keys (plural, e.g.
// "checkpoints").

const TYPE_COLORS = {
    checkpoint: '#7f9ec4',   checkpoints: '#7f9ec4',
    lora: '#a98bc4',         loras: '#a98bc4',
    locon: '#a98bc4',        lycoris: '#a98bc4',
    vae: '#7fa88d',
    textualinversion: '#d99a4e', embedding: '#d99a4e', embeddings: '#d99a4e',
    hypernetwork: '#c9736a', hypernetworks: '#c9736a',
    controlnet: '#6fa8a8',
    upscaler: '#b9a04f',     upscalers: '#b9a04f',   upscale_models: '#b9a04f',
    motionmodule: '#c47f9e', motion_models: '#c47f9e',
    unet: '#8f8ac9',
    diffusers: '#6f9f9b',    diffusion_models: '#6f9f9b',
    clip: '#9fae6a',         clip_vision: '#9fae6a',
    poses: '#b08a6a',
    wildcards: '#96907f',
};

const FALLBACK = '#8d857a';

/** Accent colour for a model type / folder key. Always returns a hex colour. */
export function typeColor(type) {
    if (!type || typeof type !== 'string') return FALLBACK;
    return TYPE_COLORS[type.trim().toLowerCase()] || FALLBACK;
}
