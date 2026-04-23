import { app } from "../../../scripts/app.js";
import { addCssLink } from "./utils/dom.js";
import { CivitaiDownloaderUI } from "./ui/UI.js";

console.log("Loading Civicomfy UI...");

// --- Configuration ---
const EXTENSION_NAME = "Civicomfy";
const CSS_URL = `../civitaiDownloader.css`;
const PLACEHOLDER_IMAGE_URL = `/extensions/Civicomfy/images/placeholder.jpeg`;

// Add Menu Button to ComfyUI
function addMenuButton() {
    const buttonGroup = document.querySelector(".comfyui-button-group");

    if (!buttonGroup) {
        console.warn(`[${EXTENSION_NAME}] ComfyUI button group not found. Retrying...`);
        setTimeout(addMenuButton, 500);
        return;
    }

    if (document.getElementById("civitai-downloader-button")) {
        console.log(`[${EXTENSION_NAME}] Button already exists.`);
        return;
    }

    const civitaiButton = document.createElement("button");
    civitaiButton.innerHTML = `<i class="fas fa-cloud-download-alt"></i> Civicomfy`;
    civitaiButton.id = "civitai-downloader-button";
    civitaiButton.title = "Open Civicomfy";

    civitaiButton.onclick = async () => {
        if (!window.civitaiDownloaderUI) {
            console.info(`[${EXTENSION_NAME}] Creating CivitaiDownloaderUI instance...`);
            window.civitaiDownloaderUI = new CivitaiDownloaderUI();
            document.body.appendChild(window.civitaiDownloaderUI.modal);

            try {
                await window.civitaiDownloaderUI.initializeUI();
                console.info(`[${EXTENSION_NAME}] UI Initialization complete.`);
            } catch (error) {
                console.error(`[${EXTENSION_NAME}] Error during UI initialization:`, error);
                window.civitaiDownloaderUI?.showToast("Error initializing UI components. Check console.", "error", 5000);
            }
        }

        if (window.civitaiDownloaderUI) {
            window.civitaiDownloaderUI.openModal();
        } else {
            console.error(`[${EXTENSION_NAME}] Cannot open modal: UI instance not available.`);
            alert("Civicomfy failed to initialize. Please check the browser console for errors.");
        }
    };

    buttonGroup.appendChild(civitaiButton);
    console.log(`[${EXTENSION_NAME}] Civicomfy button added to .comfyui-button-group.`);

    const menu = document.querySelector(".comfy-menu");
    if (!buttonGroup.contains(civitaiButton) && menu && !menu.contains(civitaiButton)) {
        console.warn(`[${EXTENSION_NAME}] Failed to append button to group, falling back to menu.`);
        const settingsButton = menu.querySelector("#comfy-settings-button");
        if (settingsButton) {
            settingsButton.insertAdjacentElement("beforebegin", civitaiButton);
        } else {
            menu.appendChild(civitaiButton);
        }
    }
}

// --- Initialization ---
app.registerExtension({
    name: "Civicomfy.CivitaiDownloader",
    async setup(appInstance) {
        console.log(`[${EXTENSION_NAME}] Setting up Civicomfy Extension...`);
        addCssLink(CSS_URL);
        addMenuButton();

        // Optional: Pre-check placeholder image
        fetch(PLACEHOLDER_IMAGE_URL)
            .then(res => {
                if (!res.ok) {
                    console.warn(`[${EXTENSION_NAME}] Placeholder image not found at ${PLACEHOLDER_IMAGE_URL}.`);
                }
            })
            .catch(err => console.warn(`[${EXTENSION_NAME}] Error checking for placeholder image:`, err));

        console.log(`[${EXTENSION_NAME}] Extension setup complete. UI will initialize on first click.`);
    },

    registerCustomNodes() {
        const LG = window.LiteGraph;
        if (!LG) {
            console.warn("[Civicomfy] LiteGraph not available — skipping CiviComfyModelInfo node registration.");
            return;
        }

        /** Rounded-rect path helper — caller must open beginPath first */
        function _rrect(ctx, x, y, w, h, r) {
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.arcTo(x + w, y, x + w, y + r, r);
            ctx.lineTo(x + w, y + h - r);
            ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
            ctx.lineTo(x + r, y + h);
            ctx.arcTo(x, y + h, x, y + h - r, r);
            ctx.lineTo(x, y + r);
            ctx.arcTo(x, y, x + r, y, r);
            ctx.closePath();
        }

        class CiviComfyModelInfoNode extends LG.LGraphNode {
            constructor() {
                super();
                this.isVirtualNode = true;
                this.title = "CiviComfy Model Info";
                this.properties = {
                    modelName: "",
                    imageUrl: "",
                    modelType: "",
                    baseModel: "",
                    creator: "",
                    modelId: "",
                    versionName: "",
                    civitaiUrl: "",
                    triggerWords: [],
                    examplePrompts: [],
                    fileName: "",
                    filePath: "",
                };
                this.size = [560, 320];
                this.resizable = true;
                this._img = null;
                this._imgLoaded = false;
                this._imgSrc = "";
                this._clickZones = []; // [{x,y,w,h,action}]
                this.bgcolor = "#16213e";
            }

            onPropertyChanged(name, val) {
                if (name === "imageUrl" && val !== this._imgSrc) this._loadImg(val);
            }

            _loadImg(url) {
                this._imgSrc = url || "";
                this._img = null;
                this._imgLoaded = false;
                if (!url) return;
                const img = new Image();
                img.onload = () => { this._img = img; this._imgLoaded = true; this.graph?.setDirtyCanvas(true, true); };
                img.onerror = () => { this._img = null; this.graph?.setDirtyCanvas(true, true); };
                img.src = url;
            }

            _wrap(ctx, text, maxW) {
                const words = String(text).split(" ");
                const lines = [];
                let cur = "";
                for (const word of words) {
                    const t = cur ? `${cur} ${word}` : word;
                    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = word; }
                    else cur = t;
                }
                if (cur) lines.push(cur);
                return lines;
            }

            /** Draw a small clickable chip button; returns its left-edge x */
            _drawChip(ctx, label, actionFn, rightEdgeX, baselineY) {
                ctx.font = "10px Arial";
                const bW = Math.ceil(ctx.measureText(label).width) + 12;
                const bH = 16;
                const bX = rightEdgeX - bW;
                const bY = baselineY - 12;
                ctx.beginPath();
                _rrect(ctx, bX, bY, bW, bH, 4);
                ctx.fillStyle = "#1e3258";
                ctx.fill();
                ctx.strokeStyle = "#3a5a9a";
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.fillStyle = "#78aaee";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(label, bX + bW / 2, bY + bH / 2);
                ctx.textAlign = "left";
                ctx.textBaseline = "alphabetic";
                this._clickZones.push({ x: bX, y: bY, w: bW, h: bH, action: actionFn });
                return bX;
            }

            onMouseDown(e, pos) {
                for (const z of this._clickZones) {
                    if (pos[0] >= z.x && pos[0] <= z.x + z.w &&
                        pos[1] >= z.y && pos[1] <= z.y + z.h) {
                        z.action();
                        return true; // consumed
                    }
                }
                return false;
            }

            onDrawBackground(ctx) {
                if (this.flags?.collapsed) return;
                this._clickZones = [];
                const [W, H] = this.size;
                const pad = 10;

                // ── Background ──────────────────────────────
                ctx.fillStyle = "#16213e";
                ctx.fillRect(0, 0, W, H);

                // ── Image column ────────────────────────────
                const imgW = Math.min(150, Math.floor(W * 0.28));
                const imgColH = H - pad * 2;

                if (this._img && this._imgLoaded) {
                    const ratio = this._img.naturalHeight / this._img.naturalWidth;
                    const dH = Math.min(imgColH, Math.round(imgW * ratio));
                    ctx.save();
                    ctx.beginPath();
                    _rrect(ctx, pad, pad, imgW, dH, 6);
                    ctx.clip();
                    ctx.drawImage(this._img, pad, pad, imgW, dH);
                    ctx.restore();
                } else {
                    ctx.fillStyle = "#1e2a44";
                    ctx.beginPath();
                    _rrect(ctx, pad, pad, imgW, imgColH, 6);
                    ctx.fill();
                    ctx.fillStyle = "#404060";
                    ctx.font = "28px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("🖼", pad + imgW / 2, H / 2);
                    ctx.textAlign = "left";
                    ctx.textBaseline = "alphabetic";
                }

                // ── Right text column ────────────────────────
                const tx = pad * 2 + imgW;
                const tw = W - tx - pad;
                let ty = pad + 14;
                const p = this.properties;

                // ── Model Name (large, bold) ──────────────────
                ctx.font = "bold 14px Arial";
                ctx.fillStyle = "#ddeeff";
                const nameLines = this._wrap(ctx, p.modelName || "–", tw);
                nameLines.slice(0, 2).forEach(l => { ctx.fillText(l, tx, ty, tw); ty += 17; });
                ty += 3;

                // ── Meta badges ──────────────────────────────
                ctx.font = "11px Arial";
                if (p.modelType)   { ctx.fillStyle = "#5c8aff"; ctx.fillText(p.modelType, tx, ty, tw); ty += 14; }
                if (p.baseModel)   { ctx.fillStyle = "#80b8d8"; ctx.fillText("Base: " + p.baseModel, tx, ty, tw); ty += 14; }
                if (p.creator)     { ctx.fillStyle = "#7888b0"; ctx.fillText("By: " + p.creator, tx, ty, tw); ty += 14; }
                if (p.versionName) { ctx.fillStyle = "#607090"; ctx.fillText("Ver: " + p.versionName, tx, ty, tw); ty += 14; }

                // ── Filename row ─────────────────────────────
                const fname = p.fileName || (p.filePath ? p.filePath.split(/[\/\\]/).pop() : '');
                if (fname) {
                    this._drawChip(ctx, "📋 Copy", () => {
                        navigator.clipboard?.writeText(fname).catch(() => {});
                    }, tx + tw, ty);
                    ctx.font = "11px Arial";
                    ctx.fillStyle = "#a0e0b0";
                    ctx.fillText(fname, tx, ty, tw - 65);
                    ty += 14;
                }

                // ── Divider ──────────────────────────────────
                ty += 4;
                ctx.strokeStyle = "#263558";
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + tw, ty); ctx.stroke();
                ty += 11;

                // ── Trigger Words ────────────────────────────
                const words = Array.isArray(p.triggerWords) ? p.triggerWords.filter(Boolean) : [];
                if (words.length > 0) {
                    // Label + Copy All chip
                    ctx.font = "bold 11px Arial";
                    ctx.fillStyle = "#f0a050";
                    ctx.fillText("✦ Trigger Words", tx, ty, tw - 75);
                    const allStr = words.join(", ");
                    this._drawChip(ctx, "📋 Copy All", () => {
                        navigator.clipboard?.writeText(allStr).catch(() => {});
                    }, tx + tw, ty);
                    ty += 15;

                    // Words text
                    ctx.font = "11px Arial";
                    ctx.fillStyle = "#b8d8f8";
                    const twLines = this._wrap(ctx, allStr, tw);
                    twLines.slice(0, 3).forEach(l => { ctx.fillText(l, tx, ty, tw); ty += 14; });
                    ty += 5;

                    // Divider
                    ctx.strokeStyle = "#263558";
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + tw, ty); ctx.stroke();
                    ty += 11;
                }

                // ── Example Prompts ──────────────────────────
                const prompts = Array.isArray(p.examplePrompts) ? p.examplePrompts.filter(Boolean) : [];
                if (prompts.length > 0) {
                    ctx.font = "bold 11px Arial";
                    ctx.fillStyle = "#70d890";
                    ctx.fillText(`💡 Example Prompts (${prompts.length})`, tx, ty, tw);
                    ty += 15;

                    prompts.slice(0, 2).forEach((prompt, i) => {
                        const pStr = String(prompt);
                        // Chip on right; label row
                        this._drawChip(ctx, `📋 #${i + 1}`, () => {
                            navigator.clipboard?.writeText(pStr).catch(() => {});
                        }, tx + tw, ty);

                        ctx.font = "10px Arial";
                        ctx.fillStyle = "#88a8c8";
                        // Reserve space for chip on first line
                        const pLines = this._wrap(ctx, pStr, tw - 60);
                        pLines.slice(0, 2).forEach(l => { ctx.fillText(l, tx, ty, tw - 65); ty += 13; });
                        ty += 5;
                    });

                    // Divider
                    if (p.civitaiUrl) {
                        ctx.strokeStyle = "#263558";
                        ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + tw, ty); ctx.stroke();
                        ty += 9;
                    }
                }

                // ── Civitai URL ──────────────────────────────
                if (p.civitaiUrl && ty + 12 <= H - 4) {
                    ctx.font = "10px Arial";
                    ctx.fillStyle = "#4a78cc";
                    ctx.fillText(p.civitaiUrl.replace("https://", ""), tx, ty, tw);
                }
            }

            onConfigure(info) {
                if (info?.properties) Object.assign(this.properties, info.properties);
                if (this.properties.imageUrl) this._loadImg(this.properties.imageUrl);
            }
        }

        CiviComfyModelInfoNode.title = "CiviComfy Model Info";
        CiviComfyModelInfoNode.category = "Civicomfy";
        LG.registerNodeType("CiviComfyModelInfo", CiviComfyModelInfoNode);
        console.log("[Civicomfy] Registered CiviComfyModelInfo node type.");
    },
});
