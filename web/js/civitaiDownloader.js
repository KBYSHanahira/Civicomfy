import { app } from "../../../scripts/app.js";
import { addCssLink } from "./utils/dom.js";
import { CivitaiDownloaderUI } from "./ui/UI.js";
import { Dialog } from "./ui/dialog.js";
import { showModelDetailModal } from "./ui/handlers/myModelsHandler.js";
import { attachSystemMonitor, setSystemMonitorEnabled, setSystemMonitorOption } from "./ui/systemMonitor.js";
import { initTagAutocomplete, setTagAutocompleteEnabled, setTagAutocompleteOption } from "./ui/tagAutocomplete.js";

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
        // With a file path the modal can resolve previews itself — thumbnail for
        // the inline image, full-size sidecar only on zoom. Without one, fall
        // back to whatever URL the node carries.
        has_preview:        !!p.filePath,
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
    // Inline SVG: Font Awesome is only loaded once the modal opens.
    civitaiButton.innerHTML = `<svg aria-hidden="true" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13.5h10"/></svg>Civicomfy`;
    civitaiButton.id = "civitai-downloader-button";
    civitaiButton.className = "cfy-launch";
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
            // The UI never came up, so there is no ui.dialog to borrow: mount a
            // standalone one on the page (the stylesheet is already loaded).
            new Dialog(() => document.body).alert({
                title: 'Civicomfy failed to initialize',
                message: 'The plugin could not start. Check the browser console for the underlying error.',
                tone: 'error',
            });
        }
    };

    buttonGroup.appendChild(civitaiButton);
    attachSystemMonitor(buttonGroup);
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

// ComfyUI settings (Settings › Civicomfy). Rows are listed in order, so sortOrder counts down.
let settingOrder = 99;
const monitorSetting = (key, name, type, defaultValue, extra = {}) => ({
    id: `Civicomfy.SystemMonitor.${key}`, category: ["Civicomfy", "System monitor", key], name, type, defaultValue,
    sortOrder: settingOrder--, ...extra, onChange: (value) => setSystemMonitorOption(key, value),
});
const tagSetting = (key, name, type, defaultValue, extra = {}) => ({
    id: `Civicomfy.TagAutocomplete.${key}`, category: ["Civicomfy", "Tag autocomplete", key], name, type, defaultValue,
    sortOrder: settingOrder--, ...extra, onChange: (value) => setTagAutocompleteOption(key, value),
});

// --- Initialization ---
app.registerExtension({
    name: "Civicomfy.CivitaiDownloader",
    settings: [{
        id: "Civicomfy.SystemMonitor",
        category: ["Civicomfy", "Features", "SystemMonitor"],
        name: "Enable System Monitor (CPU / RAM / GPU meters in the top bar)",
        type: "boolean",
        defaultValue: true,
        sortOrder: 201,
        onChange: (value) => setSystemMonitorEnabled(value),
    },
    monitorSetting("cpu", "Show CPU usage", "boolean", true),
    monitorSetting("ram", "Show RAM usage", "boolean", true),
    monitorSetting("gpu", "Show GPU load (NVIDIA)", "boolean", true),
    monitorSetting("vram", "Show VRAM usage (NVIDIA)", "boolean", true),
    monitorSetting("temp", "Show GPU temperature (NVIDIA)", "boolean", true),
    monitorSetting("disk", "Show models disk usage", "boolean", true),
    monitorSetting("units", "RAM / VRAM / disk values", "combo", "GB", { options: ["GB", "%"] }),
    monitorSetting("interval", "Refresh interval (seconds)", "slider", 1, { attrs: { min: 0.5, max: 10, step: 0.5 } }),
    {
        id: "Civicomfy.TagAutocomplete",
        category: ["Civicomfy", "Features", "TagAutocomplete"],
        name: "Enable Tag Autocomplete (Danbooru tag suggestions in prompt boxes)",
        type: "boolean",
        defaultValue: true,
        sortOrder: 200,
        onChange: (value) => setTagAutocompleteEnabled(value),
    },
    tagSetting("danbooru", "Include Danbooru tags (TC: tagcomplete, AP: Autocomplete-Plus)", "boolean", true),
    tagSetting("e621", "Include e621 tags (E6)", "boolean", true),
    tagSetting("max", "Maximum suggestions", "slider", 20, { attrs: { min: 5, max: 50, step: 1 } }),
    tagSetting("minChars", "Characters typed before suggesting", "slider", 1, { attrs: { min: 1, max: 5, step: 1 } }),
    tagSetting("underscores", "Insert underscores as spaces (long_hair → long hair)", "boolean", true),
    tagSetting("escape", "Escape parentheses so they are not read as weights", "boolean", true),
    tagSetting("comma", "Add \", \" after the inserted tag", "boolean", true),
    tagSetting("aliases", "Show aliases and translations", "boolean", true),
    ],
    async setup(appInstance) {
        console.log(`[${EXTENSION_NAME}] Setting up Civicomfy Extension...`);
        addCssLink(CSS_URL);
        addMenuButton();
        initTagAutocomplete();

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

        /** Plate path with the bottom-right corner cut, like the modal's buttons. Caller opens beginPath. */
        function _plate(ctx, x, y, w, h, cut) {
            cut = Math.max(0, Math.min(cut, w / 2, h / 2));
            ctx.moveTo(x, y);
            ctx.lineTo(x + w, y);
            ctx.lineTo(x + w, y + h - cut);
            ctx.lineTo(x + w - cut, y + h);
            ctx.lineTo(x, y + h);
            ctx.closePath();
        }

        const _copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});

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
                this.bgcolor = CiviComfyModelInfoNode.THEME.bg;
                // Nodes 2.0 renders nodes as DOM, where onDrawBackground never shows. It gives
                // this widget a canvas of its own (WidgetLegacy) to draw the same card on.
                // On the classic canvas the widget is hidden ([0, -4], ComfyUI's hidden-widget
                // size; a real height would feed back into the node size) and onDrawBackground draws.
                this._card = this.addCustomWidget({
                    name: "civicomfy_card",
                    type: "civicomfy_card",
                    value: null,
                    serialize: false,
                    // Nodes 2.0 sets the canvas wrapper's min-height to this height, and a node
                    // cannot be dragged smaller than its content, so keep it at the minimum.
                    computeSize: (width) => (LG.vueNodesMode ? [width, this.min_size[1]] : [0, -4]),
                    // Having this makes Nodes 2.0 stretch the widget's row over the node's spare height.
                    computeLayoutSize: () => ({ minHeight: this.min_size[1] }),
                    // WidgetLegacy sizes the canvas bitmap to computeSize; stretch it over the row
                    // and redraw at its real height. Its resize observer calls this on every resize.
                    draw: (ctx, node, width) => {
                        if (!LG.vueNodesMode) return;
                        const canvas = ctx.canvas;
                        canvas.style.height = "100%";
                        const height = canvas.clientHeight;
                        if (width < node.min_size[0] || height < node.min_size[1]) return; // first draw is before layout
                        const scale = canvas.width / width;
                        canvas.height = height * scale;
                        ctx.scale(scale, scale);
                        node._drawCard(ctx, width, height);
                    },
                    mouse: (e, pos, node) => e.type === "pointerdown" && node.onMouseDown(e, pos),
                });
            }

            _redraw() {
                this.graph?.setDirtyCanvas(true, true);
                this._card.triggerDraw?.(); // set by Nodes 2.0's widget canvas
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
                // A slower earlier URL must not replace a newer preview.
                img.onload = () => { if (this._imgSrc !== url) return; this._img = img; this._imgLoaded = true; this._redraw(); };
                img.onerror = () => { if (this._imgSrc !== url) return; this._img = null; this._redraw(); };
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

            /** Text cut to maxW with an ellipsis (fillText's maxWidth squashes glyphs instead). */
            _fit(ctx, text, maxW) {
                text = String(text);
                if (ctx.measureText(text).width <= maxW) return text;
                let s = text;
                while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
                return s + "…";
            }

            /** Mono action chip right-aligned at rightX; returns its left x. */
            _drawChip(ctx, label, rightX, centerY, action) {
                const T = CiviComfyModelInfoNode.THEME;
                ctx.font = `600 9px ${T.mono}`;
                ctx.letterSpacing = "1px";
                const w = Math.ceil(ctx.measureText(label).width) + 14;
                const h = 18;
                const x = rightX - w;
                const y = centerY - h / 2;
                ctx.beginPath();
                _plate(ctx, x, y, w, h, 5);
                ctx.fillStyle = T.accentSoft;
                ctx.fill();
                ctx.strokeStyle = T.accentDim;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.fillStyle = T.accentText;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(label, x + w / 2, centerY + 0.5);
                ctx.textAlign = "left";
                ctx.letterSpacing = "0px";
                this._clickZones.push({ x, y, w, h, action });
                return x;
            }

            /** Wrapping tag chips; a "+N" chip stands for words that did not fit. Returns the bottom y. */
            _drawWordChips(ctx, words, startX, startY, maxW, maxRows) {
                const T = CiviComfyModelInfoNode.THEME;
                const CHIP_H = 20, GAP = 4, PAD_X = 8;
                ctx.font = `12px ${T.font}`;
                const moreW = ctx.measureText("+99").width + PAD_X * 2;
                let cx = startX, cy = startY, rows = 0, drawn = 0;
                const drawChip = (label, x, y, w, muted) => {
                    ctx.beginPath();
                    _plate(ctx, x, y, w, CHIP_H, 5);
                    ctx.fillStyle = T.panel;
                    ctx.fill();
                    ctx.strokeStyle = T.lineStrong;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.fillStyle = muted ? T.textFaint : T.text;
                    ctx.textBaseline = "middle";
                    ctx.fillText(this._fit(ctx, label, w - PAD_X * 2), x + PAD_X, y + CHIP_H / 2 + 0.5);
                };
                // On the last row, leave room for the "+N" chip when words remain after this one.
                const room = (i) => maxW - (rows === maxRows - 1 && words.length - i > 1 ? moreW + GAP : 0);
                for (let i = 0; i < words.length; i++) {
                    let wW = Math.min(ctx.measureText(words[i]).width + PAD_X * 2, room(i));
                    if (cx + wW > startX + room(i) && cx > startX) {
                        if (rows === maxRows - 1) break;
                        cx = startX;
                        cy += CHIP_H + GAP;
                        rows++;
                        wW = Math.min(wW, room(i));
                    }
                    drawChip(words[i], cx, cy, wW, false);
                    drawn++;
                    cx += wW + GAP;
                }
                if (drawn < words.length) drawChip(`+${words.length - drawn}`, cx, cy, moreW, true); // full list in Info
                return cy + CHIP_H;
            }

            /** "// LABEL ──── [CHIP]" section heading; returns the y below it. */
            _drawSectionLabel(ctx, x, y, w, label, chip) {
                const T = CiviComfyModelInfoNode.THEME;
                const cy = y + 9;
                let right = x + w;
                if (chip) right = this._drawChip(ctx, chip.label, x + w, cy, chip.action) - 8;
                ctx.font = `600 9px ${T.mono}`;
                ctx.letterSpacing = "1.5px";
                ctx.fillStyle = T.accent;
                ctx.textBaseline = "middle";
                const text = `// ${label.toUpperCase()}`;
                ctx.fillText(text, x, cy + 0.5);
                const ruleX = x + ctx.measureText(text).width + 8;
                ctx.letterSpacing = "0px";
                if (right > ruleX) {
                    ctx.strokeStyle = T.line;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(ruleX, cy + 0.5);
                    ctx.lineTo(right, cy + 0.5);
                    ctx.stroke();
                }
                return y + 18;
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
                this._drawCard(ctx, this.size[0], this.size[1]);
            }

            _drawCard(ctx, W, H) {
                this._clickZones = [];
                const T = CiviComfyModelInfoNode.THEME;
                const p = this.properties;
                const pad = 12;

                // Clip to the node so long names and prompts never draw outside it.
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, W, H);
                ctx.clip();
                ctx.fillStyle = T.bg;
                ctx.fillRect(0, 0, W, H);
                ctx.fillStyle = T.accent;
                ctx.fillRect(0, 0, W, 2);

                // ── Preview, framed by the modal's corner brackets ──
                const imgX = pad, imgY = pad + 2;
                const imgW = Math.min(170, Math.floor(W * 0.3));
                let imgH = H - imgY - pad;
                if (this._img && this._imgLoaded) {
                    imgH = Math.min(imgH, Math.round(imgW * this._img.naturalHeight / this._img.naturalWidth));
                    ctx.drawImage(this._img, imgX, imgY, imgW, imgH);
                } else {
                    ctx.fillStyle = T.panel;
                    ctx.fillRect(imgX, imgY, imgW, imgH);
                    ctx.font = `600 9px ${T.mono}`;
                    ctx.letterSpacing = "1.5px";
                    ctx.fillStyle = T.textFaint;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    if (ctx.measureText("NO PREVIEW").width < imgW - 8) ctx.fillText("NO PREVIEW", imgX + imgW / 2, imgY + imgH / 2);
                    ctx.textAlign = "left";
                    ctx.letterSpacing = "0px";
                }
                ctx.strokeStyle = T.lineStrong;
                ctx.lineWidth = 1;
                ctx.strokeRect(imgX + 0.5, imgY + 0.5, imgW - 1, imgH - 1);
                const b = 10, o = 3;
                ctx.strokeStyle = T.accent;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(imgX - o, imgY - o + b);
                ctx.lineTo(imgX - o, imgY - o);
                ctx.lineTo(imgX - o + b, imgY - o);
                ctx.moveTo(imgX + imgW + o - b, imgY + imgH + o);
                ctx.lineTo(imgX + imgW + o, imgY + imgH + o);
                ctx.lineTo(imgX + imgW + o, imgY + imgH + o - b);
                ctx.stroke();

                // ── Text column ──
                const tx = imgX + imgW + 16;
                const tw = W - tx - pad;
                const footerH = p.civitaiUrl ? 22 : 0;
                let ty = pad + 2;

                const infoLeft = this._drawChip(ctx, "INFO", tx + tw, ty + 9, () => showCivicomfyNodeInfo(this.properties));

                // Name: two lines at most, clear of the Info chip.
                ctx.font = `700 15px ${T.display}`;
                ctx.fillStyle = T.text;
                ctx.textBaseline = "top";
                const titleW = infoLeft - tx - 10;
                const nameLines = this._wrap(ctx, p.modelName || "–", titleW);
                nameLines.slice(0, 2).forEach((line, i) => {
                    const last = i === 1 && nameLines.length > 2;
                    ctx.fillText(last ? this._fit(ctx, line + " " + nameLines[2], titleW) : line, tx, ty);
                    ty += 19;
                });
                ty += 5;

                // Type (solid) and base model (outlined) badges, then creator / version.
                let mx = tx;
                const badge = (text, solid) => {
                    if (tx + tw - mx < 24) return; // no room left on a narrow node
                    ctx.font = `700 9px ${T.mono}`;
                    ctx.letterSpacing = "1px";
                    const bw = Math.min(ctx.measureText(text).width + 12, tx + tw - mx);
                    ctx.beginPath();
                    _plate(ctx, mx, ty, bw, 16, 4);
                    if (solid) {
                        ctx.fillStyle = T.accent;
                        ctx.fill();
                    } else {
                        ctx.strokeStyle = T.lineStrong;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                    ctx.fillStyle = solid ? T.onAccent : T.textDim;
                    ctx.textBaseline = "middle";
                    ctx.fillText(this._fit(ctx, text, bw - 12), mx + 6, ty + 8.5);
                    ctx.letterSpacing = "0px";
                    mx += bw + 5;
                };
                if (p.modelType) badge(String(p.modelType).toUpperCase(), true);
                if (p.baseModel) badge(String(p.baseModel).toUpperCase(), false);
                const meta = [p.creator && `BY ${p.creator}`, p.versionName && `VER ${p.versionName}`].filter(Boolean).join("  ·  ");
                if (meta) {
                    ctx.font = `10px ${T.mono}`;
                    ctx.fillStyle = T.textFaint;
                    ctx.textBaseline = "middle";
                    if (mx > tx && mx + 6 + ctx.measureText(meta).width > tx + tw) {
                        ty += 21;
                        mx = tx;
                    }
                    const metaX = mx === tx ? tx : mx + 6;
                    ctx.fillText(this._fit(ctx, meta, tx + tw - metaX), metaX, ty + 8.5);
                }
                if (mx > tx || meta) ty += 28;

                // File name, with a copy chip.
                const fname = p.fileName || (p.filePath ? String(p.filePath).split(/[\/\\]/).pop() : "");
                if (fname) {
                    const h = 26;
                    ctx.fillStyle = T.recess;
                    ctx.fillRect(tx, ty, tw, h);
                    ctx.strokeStyle = T.line;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, h - 1);
                    const chipLeft = this._drawChip(ctx, "COPY", tx + tw - 4, ty + h / 2, () => _copy(fname));
                    ctx.font = `11px ${T.mono}`;
                    ctx.fillStyle = T.text;
                    ctx.textBaseline = "middle";
                    ctx.fillText(this._fit(ctx, fname, chipLeft - tx - 18), tx + 9, ty + h / 2 + 0.5);
                    ty += h + 12;
                }

                // Trigger words.
                const words = Array.isArray(p.triggerWords) ? p.triggerWords.filter(Boolean) : [];
                if (words.length && ty + 44 < H - footerH) {
                    ty = this._drawSectionLabel(ctx, tx, ty, tw, `Trigger words · ${words.length}`, { label: "COPY ALL", action: () => _copy(words.join(", ")) }) + 6;
                    const maxRows = Math.max(1, Math.min(3, Math.floor((H - footerH - ty - 48) / 24)));
                    ty = this._drawWordChips(ctx, words, tx, ty, tw, maxRows) + 14;
                }

                // Example prompts fill whatever height is left.
                const prompts = Array.isArray(p.examplePrompts) ? p.examplePrompts.filter(Boolean) : [];
                if (prompts.length && ty + 44 < H - footerH) {
                    ty = this._drawSectionLabel(ctx, tx, ty, tw, `Example prompts · ${prompts.length}`) + 6;
                    const LINE = 15;
                    const textW = tw - 88; // clear of the "COPY #n" chip on the first line
                    let drawn = 0;
                    for (let i = 0; i < prompts.length; i++) {
                        const maxLines = Math.floor((H - footerH - pad - ty - 14) / LINE);
                        if (maxLines < 1) break;
                        drawn++;
                        const text = String(prompts[i]);
                        ctx.font = `11.5px ${T.font}`;
                        const lines = this._wrap(ctx, text, textW);
                        // Earlier prompts stop at 4 lines so later ones still get room.
                        const shown = Math.min(lines.length, maxLines, i < prompts.length - 1 ? 4 : maxLines);
                        const cardH = shown * LINE + 14;
                        ctx.fillStyle = T.panel;
                        ctx.fillRect(tx, ty, tw, cardH);
                        ctx.fillStyle = T.accentDim;
                        ctx.fillRect(tx, ty, 2, cardH);
                        this._drawChip(ctx, `COPY #${i + 1}`, tx + tw - 6, ty + 13, () => _copy(text));
                        ctx.font = `11.5px ${T.font}`;
                        ctx.fillStyle = T.textDim;
                        ctx.textBaseline = "top";
                        for (let li = 0; li < shown; li++) {
                            const cut = li === shown - 1 && lines.length > shown;
                            ctx.fillText(cut ? this._fit(ctx, lines[li] + " " + lines[li + 1], textW) : lines[li], tx + 12, ty + 7 + li * LINE);
                        }
                        ty += cardH + 6;
                    }
                    if (drawn < prompts.length && ty + 12 < H - footerH - 4) {
                        ctx.font = `600 9px ${T.mono}`;
                        ctx.letterSpacing = "1px";
                        ctx.fillStyle = T.textFaint;
                        ctx.textBaseline = "top";
                        ctx.fillText(`+${prompts.length - drawn} MORE · OPEN INFO`, tx, ty + 2);
                        ctx.letterSpacing = "0px";
                    }
                }

                // Civitai link.
                if (p.civitaiUrl) {
                    ctx.strokeStyle = T.line;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(tx, H - footerH + 0.5);
                    ctx.lineTo(tx + tw, H - footerH + 0.5);
                    ctx.stroke();
                    ctx.font = `10px ${T.mono}`;
                    ctx.fillStyle = T.textFaint;
                    ctx.textBaseline = "middle";
                    ctx.fillText(this._fit(ctx, "↗ " + String(p.civitaiUrl).replace(/^https?:\/\//, ""), tw), tx, H - footerH / 2);
                }

                ctx.textBaseline = "alphabetic";
                ctx.restore();
            }

            onConfigure(info) {
                if (info?.properties) Object.assign(this.properties, info.properties);
                if (this.properties.imageUrl) this._loadImg(this.properties.imageUrl);
            }
        }

        CiviComfyModelInfoNode.title = "CiviComfy Model Info";
        CiviComfyModelInfoNode.category = "Civicomfy";
        // Mirrors the modal's "Field Terminal" tokens (styles/00-tokens.css, --cfy-*).
        CiviComfyModelInfoNode.THEME = {
            bg:         "#0a0a0b",
            panel:      "#16171a",
            recess:     "#050506",
            line:       "rgba(236,234,228,0.09)",
            lineStrong: "rgba(236,234,228,0.18)",
            text:       "#eceae4",
            textDim:    "#a3a098",
            textFaint:  "#8d8a82",
            accent:     "#ff6b1a",
            accentText: "#ff8a4c",
            accentSoft: "rgba(255,107,26,0.08)",
            accentDim:  "rgba(255,107,26,0.45)",
            onAccent:   "#0a0a0b",
            font:    '"Bahnschrift", "Segoe UI", "Leelawadee UI", "Yu Gothic UI", sans-serif',
            display: '"Bahnschrift SemiBold", "Bahnschrift", "Segoe UI", "Yu Gothic UI", sans-serif',
            mono:    '"Cascadia Mono", Consolas, "Yu Gothic UI", monospace',
        };
        LG.registerNodeType("CiviComfyModelInfo", CiviComfyModelInfoNode);
        console.log("[Civicomfy] Registered CiviComfyModelInfo node type.");
    },
});
