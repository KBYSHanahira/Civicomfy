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
            r = Math.min(r, w / 2, h / 2);
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
                this.size = [580, 360];
                this.resizable = true;
                this._img = null;
                this._imgLoaded = false;
                this._imgSrc = "";
                this._clickZones = [];
                this.bgcolor = "#0f1825";
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

            /** Draw a copy button chip, returns the left-edge x */
            _drawCopyChip(ctx, label, actionFn, rightEdgeX, centerY,
                          bgColor = "#1a2d50", borderColor = "#2e4e8a", textColor = "#7aabee") {
                ctx.font = "bold 9px Arial";
                const bW = Math.ceil(ctx.measureText(label).width) + 14;
                const bH = 17;
                const bX = rightEdgeX - bW;
                const bY = centerY - bH / 2;
                ctx.beginPath();
                _rrect(ctx, bX, bY, bW, bH, 5);
                ctx.fillStyle = bgColor;
                ctx.fill();
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.fillStyle = textColor;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(label, bX + bW / 2, centerY);
                ctx.textAlign = "left";
                ctx.textBaseline = "alphabetic";
                this._clickZones.push({ x: bX, y: bY, w: bW, h: bH, action: actionFn });
                return bX;
            }

            /**
             * Draw word/tag chips and return new Y after all rows.
             * Words wrap to new lines; each chip is a rounded pill.
             */
            _drawWordChips(ctx, words, startX, startY, maxW,
                           chipBg, chipBorder, chipText, maxRows = 4) {
                const CHIP_H = 17, CHIP_GAP_X = 5, CHIP_GAP_Y = 5, PAD_X = 8, FONT = "10px Arial";
                ctx.font = FONT;
                let cx = startX, cy = startY, rows = 0;
                const chipZones = [];
                for (const w of words) {
                    const wW = ctx.measureText(w).width + PAD_X * 2;
                    if (cx + wW > startX + maxW && cx > startX) {
                        cx = startX; cy += CHIP_H + CHIP_GAP_Y; rows++;
                        if (rows >= maxRows) { /* draw "…more" */ break; }
                    }
                    ctx.beginPath();
                    _rrect(ctx, cx, cy, wW, CHIP_H, 5);
                    ctx.fillStyle = chipBg;
                    ctx.fill();
                    ctx.strokeStyle = chipBorder;
                    ctx.lineWidth = 0.7;
                    ctx.stroke();
                    ctx.fillStyle = chipText;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(w, cx + wW / 2, cy + CHIP_H / 2);
                    ctx.textAlign = "left";
                    ctx.textBaseline = "alphabetic";
                    chipZones.push({ x: cx, y: cy, w: wW, h: CHIP_H, word: w });
                    cx += wW + CHIP_GAP_X;
                }
                return cy + CHIP_H; // bottom of last row
            }

            /** Draw a section box header bar and return y after the header */
            _drawSectionHeader(ctx, label, x, y, w,
                               bgColor = "rgba(255,255,255,0.05)",
                               borderColor = "rgba(255,255,255,0.1)",
                               textColor = "rgba(200,210,230,0.7)") {
                const H = 20;
                ctx.beginPath();
                _rrect(ctx, x, y, w, H, 5);
                ctx.fillStyle = bgColor;
                ctx.fill();
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.font = "bold 10px Arial";
                ctx.fillStyle = textColor;
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.fillText(label, x + 8, y + H / 2);
                ctx.textBaseline = "alphabetic";
                return y + H;
            }

            onMouseDown(e, pos) {
                for (const z of this._clickZones) {
                    if (pos[0] >= z.x && pos[0] <= z.x + z.w &&
                        pos[1] >= z.y && pos[1] <= z.y + z.h) {
                        z.action();
                        return true;
                    }
                }
                return false;
            }

            onDrawBackground(ctx) {
                if (this.flags?.collapsed) return;
                this._clickZones = [];
                const [W, H] = this.size;
                const pad = 10;

                // ── Background ──────────────────────────────────
                ctx.fillStyle = "#0f1825";
                ctx.fillRect(0, 0, W, H);

                // Subtle inner border
                ctx.strokeStyle = "rgba(92,138,255,0.15)";
                ctx.lineWidth = 1;
                ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

                // ── Image column ─────────────────────────────────
                const imgW = Math.min(160, Math.floor(W * 0.28));
                const imgColH = H - pad * 2;

                if (this._img && this._imgLoaded) {
                    const ratio = this._img.naturalHeight / this._img.naturalWidth;
                    const dH = Math.min(imgColH, Math.round(imgW * ratio));
                    // Shadow behind image
                    ctx.save();
                    ctx.shadowColor = "rgba(0,0,0,0.6)";
                    ctx.shadowBlur = 12;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;
                    ctx.beginPath();
                    _rrect(ctx, pad, pad, imgW, dH, 7);
                    ctx.clip();
                    ctx.shadowColor = "transparent";
                    ctx.drawImage(this._img, pad, pad, imgW, dH);
                    ctx.restore();
                    // Thin border around image
                    ctx.beginPath();
                    _rrect(ctx, pad, pad, imgW, dH, 7);
                    ctx.strokeStyle = "rgba(92,138,255,0.3)";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    _rrect(ctx, pad, pad, imgW, imgColH, 7);
                    ctx.fillStyle = "#1a2540";
                    ctx.fill();
                    ctx.strokeStyle = "rgba(92,138,255,0.2)";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.font = "28px Arial";
                    ctx.fillStyle = "#2a3a5a";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("🖼", pad + imgW / 2, H / 2);
                    ctx.textAlign = "left";
                    ctx.textBaseline = "alphabetic";
                }

                // ── Right text column ─────────────────────────────
                const tx = pad * 2 + imgW;
                const tw = W - tx - pad;
                let ty = pad + 14;
                const p = this.properties;

                // ── Model Name ────────────────────────────────────
                ctx.font = "bold 13px Arial";
                ctx.fillStyle = "#e0eaff";
                const nameLines = this._wrap(ctx, p.modelName || "–", tw);
                nameLines.slice(0, 2).forEach(l => { ctx.fillText(l, tx, ty, tw); ty += 17; });
                ty += 2;

                // ── Meta pills row ────────────────────────────────
                if (p.modelType || p.baseModel) {
                    let mx = tx;
                    const drawPill = (text, bg, border, col) => {
                        ctx.font = "bold 9px Arial";
                        const pw = ctx.measureText(text).width + 12;
                        const ph = 15;
                        const py = ty - 12;
                        ctx.beginPath();
                        _rrect(ctx, mx, py, pw, ph, 7);
                        ctx.fillStyle = bg;
                        ctx.fill();
                        ctx.strokeStyle = border;
                        ctx.lineWidth = 0.7;
                        ctx.stroke();
                        ctx.fillStyle = col;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(text, mx + pw / 2, py + ph / 2);
                        ctx.textAlign = "left";
                        ctx.textBaseline = "alphabetic";
                        mx += pw + 5;
                    };
                    if (p.modelType) drawPill(p.modelType.toUpperCase(), "rgba(92,138,255,0.2)", "rgba(92,138,255,0.5)", "#7aabff");
                    if (p.baseModel) drawPill(p.baseModel, "rgba(128,184,216,0.12)", "rgba(128,184,216,0.35)", "#80b8d8");
                    ty += 18;
                }

                // ── Creator / Version ─────────────────────────────
                ctx.font = "10px Arial";
                if (p.creator)     { ctx.fillStyle = "#6878a0"; ctx.fillText("by  " + p.creator, tx, ty, tw); ty += 14; }
                if (p.versionName) { ctx.fillStyle = "#505878"; ctx.fillText("ver  " + p.versionName, tx, ty, tw); ty += 14; }
                ty += 2;

                // ── Filename box ──────────────────────────────────
                const fname = p.fileName || (p.filePath ? p.filePath.split(/[\/\\]/).pop() : '');
                if (fname) {
                    const boxH = 24;
                    const boxY = ty - 2;
                    ctx.beginPath();
                    _rrect(ctx, tx, boxY, tw, boxH, 5);
                    ctx.fillStyle = "rgba(160,224,176,0.07)";
                    ctx.fill();
                    ctx.strokeStyle = "rgba(160,224,176,0.2)";
                    ctx.lineWidth = 0.8;
                    ctx.stroke();

                    const chipCenterY = boxY + boxH / 2;
                    const chipRight = tx + tw - 4;
                    this._drawCopyChip(ctx, "⎘ Copy", () => {
                        navigator.clipboard?.writeText(fname).catch(() => {});
                    }, chipRight, chipCenterY, "#1a3a28", "#2e6a44", "#70c090");

                    ctx.font = "10px Arial";
                    ctx.fillStyle = "#90d0a8";
                    ctx.textBaseline = "middle";
                    ctx.fillText(fname, tx + 8, chipCenterY, tw - 75);
                    ctx.textBaseline = "alphabetic";
                    ty = boxY + boxH + 8;
                }

                // ── Trigger Words section ─────────────────────────
                const words = Array.isArray(p.triggerWords) ? p.triggerWords.filter(Boolean) : [];
                if (words.length > 0 && ty + 30 < H - 4) {
                    const sectionX = tx;
                    const sectionW = tw;

                    // Header bar with "Copy All" chip
                    const headerY = ty;
                    const headerH = 20;
                    ctx.beginPath();
                    _rrect(ctx, sectionX, headerY, sectionW, headerH, 5);
                    ctx.fillStyle = "rgba(245,158,11,0.12)";
                    ctx.fill();
                    ctx.strokeStyle = "rgba(245,158,11,0.3)";
                    ctx.lineWidth = 0.8;
                    ctx.stroke();

                    ctx.font = "bold 10px Arial";
                    ctx.fillStyle = "#f0a050";
                    ctx.textBaseline = "middle";
                    ctx.fillText("✦ Trigger Words", sectionX + 8, headerY + headerH / 2);
                    ctx.textBaseline = "alphabetic";

                    const allStr = words.join(", ");
                    this._drawCopyChip(ctx, "⎘ Copy All", () => {
                        navigator.clipboard?.writeText(allStr).catch(() => {});
                    }, sectionX + sectionW - 4, headerY + headerH / 2,
                       "#2a1e08", "#6a4a18", "#d4900a");

                    ty = headerY + headerH + 5;

                    // Chips area
                    if (ty + 22 < H - 4) {
                        const chipsAreaY = ty;
                        const availH = Math.min(H - chipsAreaY - 28, 80);
                        const maxRows = Math.max(1, Math.floor((availH + 5) / 22));
                        const newY = this._drawWordChips(
                            ctx, words, sectionX, chipsAreaY, sectionW,
                            "rgba(245,158,11,0.15)", "rgba(245,158,11,0.4)", "#f0b840",
                            maxRows
                        );
                        ty = newY + 8;
                    }
                }

                // ── Example Prompts section ───────────────────────
                const prompts = Array.isArray(p.examplePrompts) ? p.examplePrompts.filter(Boolean) : [];
                if (prompts.length > 0 && ty + 30 < H - 4) {
                    // Header
                    const headerY = ty;
                    const headerH = 20;
                    ctx.beginPath();
                    _rrect(ctx, tx, headerY, tw, headerH, 5);
                    ctx.fillStyle = "rgba(112,216,144,0.1)";
                    ctx.fill();
                    ctx.strokeStyle = "rgba(112,216,144,0.25)";
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                    ctx.font = "bold 10px Arial";
                    ctx.fillStyle = "#70d890";
                    ctx.textBaseline = "middle";
                    ctx.fillText(`💡 Example Prompts  (${prompts.length})`, tx + 8, headerY + headerH / 2);
                    ctx.textBaseline = "alphabetic";
                    ty = headerY + headerH + 5;

                    prompts.slice(0, 2).forEach((prompt, i) => {
                        if (ty + 16 >= H - 24) return;
                        const pStr = String(prompt);
                        const chipCenterY = ty + 6;
                        this._drawCopyChip(ctx, `⎘ #${i + 1}`, () => {
                            navigator.clipboard?.writeText(pStr).catch(() => {});
                        }, tx + tw - 4, chipCenterY, "#0e2a18", "#205a30", "#50c070");

                        ctx.font = "9.5px Arial";
                        ctx.fillStyle = "#78a898";
                        const pLines = this._wrap(ctx, pStr, tw - 60);
                        pLines.slice(0, 2).forEach(l => {
                            if (ty + 2 >= H - 24) return;
                            ctx.fillText(l, tx, ty + 12, tw - 65);
                            ty += 13;
                        });
                        ty += 4;
                    });
                }

                // ── Civitai URL ───────────────────────────────────
                if (p.civitaiUrl && ty + 12 <= H - 4) {
                    ctx.font = "9px Arial";
                    ctx.fillStyle = "#3a6acc";
                    ctx.fillText(p.civitaiUrl.replace("https://", ""), tx, H - 6, tw);
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
