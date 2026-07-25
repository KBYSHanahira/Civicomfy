import { app } from "../../../scripts/app.js";
import { addCssLink } from "./utils/dom.js";
import { CivitaiDownloaderUI } from "./ui/UI.js";
import { showModelDetailModal } from "./ui/handlers/myModelsHandler.js";

console.log("Loading Civicomfy UI...");

// --- Configuration ---
const EXTENSION_NAME = "Civicomfy";
const CSS_URL = `../civitaiDownloader.css`;
const PLACEHOLDER_IMAGE_URL = `/extensions/Civicomfy/images/placeholder.jpeg`;

// ─── Detailed model-info popup for the CiviComfyModelInfo workflow node ────────
// Renders the SAME modal as the My Models detail view (showModelDetailModal),
// so the node's ⓘ Info popup looks identical. Node properties are mapped into
// the My Models `model` shape; the preview image comes from the node's imageUrl.
function showCivicomfyNodeInfo(props = {}) {
    const p = props || {};
    const model = {
        name:               p.fileName || (p.filePath ? String(p.filePath).split(/[/\\]/).pop() : ""),
        model_name:         p.modelName || "",
        model_type:         p.modelType || "",
        base_model:         p.baseModel || "",
        version_name:       p.versionName || "",
        creator:            p.creator || "",
        civitai_model_id:   p.modelId || "",
        civitai_version_id: "",
        trained_words:      Array.isArray(p.triggerWords)   ? p.triggerWords   : [],
        example_prompts:    Array.isArray(p.examplePrompts) ? p.examplePrompts : [],
        description:        p.description || "",
        rel_path:           p.filePath || "",
        has_preview:        false,
        preview_url:        p.imageUrl || "",
    };
    showModelDetailModal(model, {
        attachTo: document.body,
        fixed: true,
        showSendToWorkflow: false,
    });
}

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
                    description: "",
                    triggerWords: [],
                    examplePrompts: [],
                    fileName: "",
                    filePath: "",
                };
                this.size = [580, 360];
                this.resizable = true;
                this.min_size = [200, 90];
                this._img = null;
                this._imgLoaded = false;
                this._imgSrc = "";
                this._clickZones = [];
                this.bgcolor = "#1f1e1d";
            }

            // Report a small minimum so the user can freely shrink the node.
            // Never auto-grow to fit content — content is clipped to this.size,
            // so the node always keeps whatever size the user set (even when its
            // model/content changes on "Update Workflow").
            computeSize() {
                return [200, 90];
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
                // Character-accumulating wrap that prefers breaking at spaces or
                // commas, but hard-breaks any run that has none (e.g. long
                // "<lora:...>" / comma-joined prompt strings). Every returned
                // line is guaranteed to be <= maxW, so it never overflows.
                const s = String(text);
                const lines = [];
                let cur = "";
                let lastBreak = -1; // length of cur right after a space/comma
                for (let i = 0; i < s.length; i++) {
                    cur += s[i];
                    if (s[i] === " " || s[i] === ",") lastBreak = cur.length;
                    if (ctx.measureText(cur).width > maxW && cur.length > 1) {
                        const cut = (lastBreak > 0 && lastBreak < cur.length) ? lastBreak : cur.length - 1;
                        lines.push(cur.slice(0, cut).replace(/\s+$/, ""));
                        cur = cur.slice(cut).replace(/^\s+/, "");
                        lastBreak = -1;
                    }
                }
                if (cur.trim()) lines.push(cur.replace(/\s+$/, ""));
                return lines;
            }

            /** Draw a copy button chip, returns the left-edge x */
            _drawCopyChip(ctx, label, actionFn, rightEdgeX, centerY,
                          bgColor = "#3a2a23", borderColor = "#6b4331", textColor = "#e6a184") {
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
                // Reserve room for a possible "+N" overflow chip on the last row.
                const moreW = ctx.measureText("+99").width + PAD_X * 2;
                let cx = startX, cy = startY, rows = 0;
                let drawn = 0;
                const drawChip = (label, x, y, w) => {
                    ctx.beginPath();
                    _rrect(ctx, x, y, w, CHIP_H, 5);
                    ctx.fillStyle = chipBg;
                    ctx.fill();
                    ctx.strokeStyle = chipBorder;
                    ctx.lineWidth = 0.7;
                    ctx.stroke();
                    ctx.fillStyle = chipText;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(label, x + w / 2, y + CHIP_H / 2, w - 6);
                    ctx.textAlign = "left";
                    ctx.textBaseline = "alphabetic";
                };
                for (let i = 0; i < words.length; i++) {
                    const w = words[i];
                    // Clamp: a single word can never exceed the row width.
                    const wW = Math.min(ctx.measureText(w).width + PAD_X * 2, maxW);
                    const isLastRow = rows === maxRows - 1;
                    const remaining = words.length - i;
                    // On the final row keep space for the "+N" chip unless this
                    // is the very last word and it fits as-is.
                    const rowLimit = startX + maxW
                        - ((isLastRow && remaining > 1) ? moreW + CHIP_GAP_X : 0);
                    if (cx + wW > rowLimit && cx > startX) {
                        if (isLastRow) break;
                        cx = startX; cy += CHIP_H + CHIP_GAP_Y; rows++;
                    }
                    drawChip(w, cx, cy, wW);
                    drawn++;
                    cx += wW + CHIP_GAP_X;
                }
                if (drawn < words.length) {
                    // "+N" chip — signals hidden words (full list in ⓘ Info).
                    drawChip(`+${words.length - drawn}`, cx, cy, moreW);
                }
                return cy + CHIP_H; // bottom of last row
            }

            /** Draw a section box header bar and return y after the header */
            _drawSectionHeader(ctx, label, x, y, w,
                               bgColor = "rgba(255,255,255,0.05)",
                               borderColor = "rgba(255,255,255,0.1)",
                               textColor = "rgba(245,244,239,0.7)") {
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

            /**
             * Unified section header bar — one consistent style for every block
             * (Trigger Words, Example Prompts, …). Draws a tinted rounded bar
             * with a left accent stripe, an icon + label, and an optional
             * right-aligned action chip. Returns the y just below the bar.
             *
             * @param opts.label       Section title text.
             * @param opts.accent      6-digit hex accent (e.g. "#f5a942"); tints
             *                          bg/border/stripe/text/chip consistently.
             * @param opts.icon        Optional glyph drawn before the label.
             * @param opts.actionLabel Optional chip label (e.g. "⎘ Copy All").
             * @param opts.action      Click handler for the chip.
             */
            _drawSectionBar(ctx, x, y, w, opts) {
                const { label, accent = "#d97757", icon = "",
                        actionLabel = null, action = null } = opts;
                const H = CiviComfyModelInfoNode.SECTION_BAR_H;
                // Tinted background + border
                ctx.beginPath();
                _rrect(ctx, x, y, w, H, 6);
                ctx.fillStyle = accent + "1f";   // ~12% alpha
                ctx.fill();
                ctx.strokeStyle = accent + "4d"; // ~30% alpha
                ctx.lineWidth = 0.8;
                ctx.stroke();
                // Left accent stripe
                ctx.beginPath();
                _rrect(ctx, x + 3, y + 5, 3, H - 10, 1.5);
                ctx.fillStyle = accent;
                ctx.fill();
                // Icon + label
                ctx.font = "bold 10px Arial";
                ctx.fillStyle = accent;
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.fillText(icon ? `${icon}  ${label}` : label, x + 12, y + H / 2);
                ctx.textBaseline = "alphabetic";
                // Optional right-aligned action chip
                if (actionLabel && action) {
                    this._drawCopyChip(ctx, actionLabel, action, x + w - 4, y + H / 2,
                                       accent + "26", accent + "73", accent);
                }
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
                const pad = 12;
                const T = CiviComfyModelInfoNode.THEME;

                // ── Background ──────────────────────────────────
                ctx.fillStyle = T.bg;
                ctx.fillRect(0, 0, W, H);

                // Top accent hairline — same blue→purple gradient as the UI header.
                const topGrad = ctx.createLinearGradient(0, 0, W, 0);
                topGrad.addColorStop(0, CiviComfyModelInfoNode.ACCENT.info);
                topGrad.addColorStop(1, CiviComfyModelInfoNode.ACCENT.base);
                ctx.fillStyle = topGrad;
                ctx.fillRect(0, 0, W, 2);

                // Subtle inner border
                ctx.strokeStyle = T.border;
                ctx.lineWidth = 1;
                ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

                // Clip all node content to its own bounds so nothing (long
                // prompts, names, chips) can ever draw outside the node.
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, W, H);
                ctx.clip();

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
                    ctx.strokeStyle = T.border;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    _rrect(ctx, pad, pad, imgW, imgColH, 7);
                    ctx.fillStyle = T.surface;
                    ctx.fill();
                    ctx.strokeStyle = T.border;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.font = "28px Arial";
                    ctx.fillStyle = T.textFaint;
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

                // ── Info button (top-right) ───────────────────────
                // Opens a detailed, self-contained model-info popup.
                const AC = CiviComfyModelInfoNode.ACCENT;
                const infoLeftX = this._drawCopyChip(
                    ctx, "ⓘ Info",
                    () => showCivicomfyNodeInfo(this.properties),
                    tx + tw, pad + 8,
                    AC.info + "26", AC.info + "73", AC.info
                );

                // ── Model Name ────────────────────────────────────
                ctx.font = "bold 13px Arial";
                ctx.fillStyle = T.text;
                const nameLines = this._wrap(ctx, p.modelName || "–", tw);
                nameLines.slice(0, 2).forEach((l, idx) => {
                    // Keep the first line clear of the Info chip.
                    const lineMaxW = idx === 0 ? Math.max(40, infoLeftX - tx - 8) : tw;
                    ctx.fillText(l, tx, ty, lineMaxW);
                    ty += 17;
                });
                ty += 3;

                // ── Meta pills row (type = blue accent, base = purple accent) ──
                if (p.modelType || p.baseModel) {
                    let mx = tx;
                    const drawPill = (text, accent) => {
                        ctx.font = "bold 9px Arial";
                        const pw = ctx.measureText(text).width + 14;
                        const ph = 16;
                        const py = ty - 12;
                        ctx.beginPath();
                        _rrect(ctx, mx, py, pw, ph, 8);
                        ctx.fillStyle = accent + "26";
                        ctx.fill();
                        ctx.strokeStyle = accent + "66";
                        ctx.lineWidth = 0.7;
                        ctx.stroke();
                        ctx.fillStyle = accent;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(text, mx + pw / 2, py + ph / 2);
                        ctx.textAlign = "left";
                        ctx.textBaseline = "alphabetic";
                        mx += pw + 6;
                    };
                    if (p.modelType) drawPill(p.modelType.toUpperCase(), AC.info);
                    if (p.baseModel) drawPill(p.baseModel, AC.base);
                    ty += 20;
                }

                // ── Creator · Version — one quiet meta line ───────
                {
                    const metaParts = [];
                    if (p.creator)     metaParts.push(`by ${p.creator}`);
                    if (p.versionName) metaParts.push(`ver ${p.versionName}`);
                    if (metaParts.length) {
                        ctx.font = "10px Arial";
                        ctx.fillStyle = T.textDim;
                        ctx.fillText(metaParts.join("   ·   "), tx, ty, tw);
                        ty += 15;
                    }
                }
                ty += 2;

                // ── Filename box ──────────────────────────────────
                const fname = p.fileName || (p.filePath ? p.filePath.split(/[\/\\]/).pop() : '');
                if (fname) {
                    const accent = CiviComfyModelInfoNode.ACCENT.file;
                    const boxH = 24;
                    const boxY = ty - 2;
                    ctx.beginPath();
                    _rrect(ctx, tx, boxY, tw, boxH, 6);
                    ctx.fillStyle = accent + "14";
                    ctx.fill();
                    ctx.strokeStyle = accent + "33";
                    ctx.lineWidth = 0.8;
                    ctx.stroke();

                    const chipCenterY = boxY + boxH / 2;
                    const chipRight = tx + tw - 4;
                    this._drawCopyChip(ctx, "⎘ Copy", () => {
                        navigator.clipboard?.writeText(fname).catch(() => {});
                    }, chipRight, chipCenterY, accent + "26", accent + "66", accent);

                    ctx.font = "10px Arial";
                    ctx.fillStyle = accent;
                    ctx.textBaseline = "middle";
                    ctx.fillText(fname, tx + 8, chipCenterY, tw - 75);
                    ctx.textBaseline = "alphabetic";
                    ty = boxY + boxH + CiviComfyModelInfoNode.SECTION_GAP;
                }

                // ── Trigger Words section ─────────────────────────
                const words = Array.isArray(p.triggerWords) ? p.triggerWords.filter(Boolean) : [];
                if (words.length > 0 && ty + 30 < H - 4) {
                    const sectionX = tx;
                    const sectionW = tw;
                    const accent = CiviComfyModelInfoNode.ACCENT.trigger;

                    const allStr = words.join(", ");
                    ty = this._drawSectionBar(ctx, sectionX, ty, sectionW, {
                        label: "Trigger Words",
                        icon: "✦",
                        accent,
                        actionLabel: "⎘ Copy All",
                        action: () => { navigator.clipboard?.writeText(allStr).catch(() => {}); },
                    }) + 5;

                    // Chips area
                    if (ty + 22 < H - 4) {
                        const chipsAreaY = ty;
                        const availH = Math.min(H - chipsAreaY - 28, 80);
                        const maxRows = Math.max(1, Math.floor((availH + 5) / 22));
                        const newY = this._drawWordChips(
                            ctx, words, sectionX, chipsAreaY, sectionW,
                            accent + "26", accent + "66", accent,
                            maxRows
                        );
                        ty = newY + 8;
                    }
                }

                // ── Example Prompts section ───────────────────────
                const prompts = Array.isArray(p.examplePrompts) ? p.examplePrompts.filter(Boolean) : [];
                if (prompts.length > 0 && ty + 30 < H - 4) {
                    const accent = CiviComfyModelInfoNode.ACCENT.prompt;
                    ty = this._drawSectionBar(ctx, tx, ty, tw, {
                        label: `Example Prompts  (${prompts.length})`,
                        icon: "💡",
                        accent,
                    }) + 5;

                    prompts.slice(0, 2).forEach((prompt, i) => {
                        if (ty + 16 >= H - 24) return;
                        const pStr = String(prompt);

                        // Measure first so the card wraps snugly around its text.
                        ctx.font = "9.5px Arial";
                        // Wrap narrow enough that the first line clears the copy
                        // chip; all lines then fit comfortably inside the node.
                        const pLines = this._wrap(ctx, pStr, tw - 60);
                        const MAX_LINES = 3;
                        const shown = Math.min(MAX_LINES, pLines.length);

                        // Card background wrapping the prompt lines.
                        const cardTop = ty;
                        const cardH = shown * 13 + 12;
                        ctx.beginPath();
                        _rrect(ctx, tx, cardTop, tw, cardH, 5);
                        ctx.fillStyle = accent + "12";
                        ctx.fill();
                        ctx.strokeStyle = accent + "26";
                        ctx.lineWidth = 0.7;
                        ctx.stroke();

                        const chipCenterY = cardTop + 9;
                        this._drawCopyChip(ctx, `⎘ #${i + 1}`, () => {
                            navigator.clipboard?.writeText(pStr).catch(() => {});
                        }, tx + tw - 5, chipCenterY, accent + "22", accent + "55", accent);

                        ctx.font = "9.5px Arial";
                        ctx.fillStyle = "#9fc7b3";
                        let lineY = cardTop + 6;
                        for (let li = 0; li < shown; li++) {
                            if (lineY + 14 >= H - 6) break;
                            let line = pLines[li];
                            if (li === shown - 1 && pLines.length > shown) line += "…";
                            ctx.fillText(line, tx + 8, lineY + 12, tw - 16);
                            lineY += 13;
                        }
                        ty = cardTop + cardH + CiviComfyModelInfoNode.SECTION_GAP;
                    });
                }

                // ── Civitai URL footer ────────────────────────────
                if (p.civitaiUrl && ty + 16 <= H - 4) {
                    // Hairline separator above the footer.
                    ctx.strokeStyle = "rgba(255,255,255,0.07)";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(tx, H - 18.5);
                    ctx.lineTo(tx + tw, H - 18.5);
                    ctx.stroke();
                    ctx.font = "9px Arial";
                    ctx.fillStyle = AC.info + "aa";
                    ctx.fillText("🔗 " + p.civitaiUrl.replace(/^https?:\/\//, ""), tx, H - 6, tw);
                }

                ctx.restore(); // end node-bounds clip
            }

            onConfigure(info) {
                if (info?.properties) Object.assign(this.properties, info.properties);
                if (this.properties.imageUrl) this._loadImg(this.properties.imageUrl);
            }
        }

        CiviComfyModelInfoNode.title = "CiviComfy Model Info";
        CiviComfyModelInfoNode.category = "Civicomfy";
        // ── Shared design tokens ──────────────────────────────────────────────
        // Mirrors the Civicomfy modal CSS (:root --cfy-*) so the workflow node
        // and the HTML UI read as one system.
        CiviComfyModelInfoNode.SECTION_BAR_H = 22;  // height of every section header
        CiviComfyModelInfoNode.SECTION_GAP   = 8;   // vertical gap between blocks
        CiviComfyModelInfoNode.THEME = {
            bg:        "#1f1e1d",             // node surface  (= --cfy-bg)
            surface:   "#30302e",             // inner cards   (= --cfy-surface)
            border:    "rgba(245,244,239,0.14)",
            text:      "#f5f4ef",             // = --cfy-text
            textDim:   "rgba(245,244,239,0.62)",
            textFaint: "rgba(245,244,239,0.38)",
        };
        CiviComfyModelInfoNode.ACCENT = {
            info:    "#d97757",  // --cfy-accent   (Claude coral)
            base:    "#c2603f",  // --cfy-accent-2 (deep coral)
            file:    "#6d9d6d",  // --cfy-success  (sage) — "file ok"
            trigger: "#d99a4e",  // --cfy-amber
            prompt:  "#7fa88d",  // muted sage for prompt blocks
        };
        LG.registerNodeType("CiviComfyModelInfo", CiviComfyModelInfoNode);
        console.log("[Civicomfy] Registered CiviComfyModelInfo node type.");
    },
});
