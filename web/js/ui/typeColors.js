// Categorical colours for model-type chips.
//
// One map for the whole UI so a "LoRA" chip is the same colour in Browse, My
// Models and the detail panels. Chips draw white text on these fills, often
// over imagery, so every hue is dark enough for white at ≥4.5:1. Orange is kept
// out of the set: it is the theme's signal colour for state, not a category.
//
// Keys cover both spellings we get from the two data sources: Civitai model
// types (singular, e.g. "checkpoint") and ComfyUI folder keys (plural, e.g.
// "checkpoints").

const TYPE_COLORS = {
    checkpoint: '#2f5f8f',   checkpoints: '#2f5f8f',
    lora: '#6b3fa0',         loras: '#6b3fa0',
    locon: '#6b3fa0',        lycoris: '#6b3fa0',     dora: '#6b3fa0',
    vae: '#2e6b4a',
    textualinversion: '#7a5a12', embedding: '#7a5a12', embeddings: '#7a5a12',
    hypernetwork: '#9a2f3a', hypernetworks: '#9a2f3a',
    controlnet: '#1f6a70',
    upscaler: '#5a6416',     upscalers: '#5a6416',   upscale_models: '#5a6416',
    motionmodule: '#8a2f6a', motion_models: '#8a2f6a',
    unet: '#43439a',
    diffusers: '#245e66',    diffusion_models: '#245e66',
    clip: '#4d6418',         clip_vision: '#4d6418',
    poses: '#6e4a2c',
    wildcards: '#4c4a44',
};

const FALLBACK = '#45433e';

/** Accent colour for a model type / folder key. Always returns a hex colour. */
export function typeColor(type) {
    if (!type || typeof type !== 'string') return FALLBACK;
    return TYPE_COLORS[type.trim().toLowerCase()] || FALLBACK;
}
