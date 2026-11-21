// Danbooru / e621 tag autocomplete for ComfyUI prompt textareas.
// Data: /civitai/tags.csv (tag,category,count,alias,sources), merged on the server from SOURCES.
import { api } from "../../../../scripts/api.js";

const WIKI_URL = { d: "https://danbooru.donmai.us/wiki_pages/", e: "https://e621.net/wiki_pages/" };
// Same ids as server/routes/TagAutocomplete.py. site: d = Danbooru, e = e621.
const SOURCES = {
    tc: { label: "TC", name: "a1111 tagcomplete · Danbooru", site: "d" },
    ap: { label: "AP", name: "Autocomplete-Plus · Danbooru (JA/ZH/KO aliases)", site: "d" },
    e6: { label: "E6", name: "a1111 tagcomplete · e621", site: "e" },
};
// Classic canvas widgets, and Nodes 2.0 (Vue) node textareas.
const PROMPT_SELECTOR = "textarea.comfy-multiline-input, .lg-node textarea";

// Mirrors the Civicomfy.TagAutocomplete.* settings; set through setTagAutocompleteOption.
const options = { max: 20, minChars: 1, underscores: true, escape: true, comma: true, aliases: true, danbooru: true, e621: true };

let enabled = true;
let tags = null;
let loading = null;
let popup = null;
let target = null;
let results = [];
let active = 0;
let tokenStart = 0;

// Katakana folds to hiragana so either script matches the aliases.
const fold = (s) => s.toLowerCase().replace(/ /g, "_").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

function parseCsvLine(line) {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quoted) {
            if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') quoted = false;
            else cell += c;
        } else if (c === '"') quoted = true;
        else if (c === ",") { cells.push(cell); cell = ""; }
        else cell += c;
    }
    cells.push(cell);
    return cells;
}

function ensureTags() {
    if (tags || loading) return loading;
    loading = api.fetchApi("/civitai/tags.csv").then(async (res) => {
        if (!res.ok) return; // still downloading on the server: retried on the next keystroke
        tags = (await res.text()).split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
            const [tag, category, , alias = "", sources = ""] = parseCsvLine(line);
            const aliases = alias ? alias.split(",") : [];
            return {
                tag, key: fold(tag), category, aliases, aliasKeys: aliases.map(fold), count: 0,
                sources: sources.split(" ").filter((s) => SOURCES[s.split(":")[0]]).map((s) => {
                    const [id, n] = s.split(":");
                    return { id, count: Number(n) };
                }),
            };
        });
        rank();
    }).catch(() => {}).finally(() => { loading = null; });
    return loading;
}

// Post counts are per site (e621's "wolf" dwarfs Danbooru's), so a tag ranks by
// its count on the enabled sites only; 0 hides it.
function rank() {
    for (const t of tags) {
        t.count = 0;
        for (const s of t.sources) if (options[SOURCES[s.id].site === "d" ? "danbooru" : "e621"]) t.count = Math.max(t.count, s.count);
    }
    tags.sort((a, b) => b.count - a.count);
}

function search(q) {
    const out = [];
    const picked = new Set();
    const add = (t, alias) => { picked.add(t); out.push({ t, alias }); return out.length >= options.max; };
    const exact = tags.find((t) => t.key === q && t.count);
    if (exact) add(exact, null);
    for (const t of tags) {
        if (!t.count) break; // sorted: the rest are on disabled sites
        if (!picked.has(t) && t.key.startsWith(q) && add(t, null)) return out;
    }
    for (const t of tags) {
        if (!t.count) break;
        if (picked.has(t)) continue;
        const i = t.aliasKeys.findIndex((a) => a.startsWith(q));
        if (i >= 0 && add(t, t.aliases[i])) return out;
    }
    if (q.length < 2) return out;
    for (const t of tags) {
        if (!t.count) break;
        if (!picked.has(t) && t.key.includes(q) && add(t, null)) return out;
    }
    return out;
}

// Underscores become spaces (not in emoticons like ^_^), and parentheses are
// escaped so they are not read as prompt weights.
function formatTag(tag) {
    if (options.underscores && /[a-z0-9]/i.test(tag)) tag = tag.replace(/_/g, " ");
    return options.escape ? tag.replace(/([()])/g, "\\$1") : tag;
}

// Strip a weight wrapper "(tag:1.2)" but keep escaped parens that belong to the tag, as in "miku \(cosplay\)".
const promptKey = (part) => fold(part.trim().replace(/^[([{]+/, "").replace(/(?<!\\)[)\]}]+$/, "").replace(/:[\d.]+$/, "").replace(/\\/g, ""));

function formatCount(n) {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
    return String(n);
}

// Viewport position of the caret, via a mirror element with the textarea's text metrics.
// Offsets are scaled by the canvas zoom, which ComfyUI applies as a CSS transform.
function caretPoint(ta, pos) {
    const s = getComputedStyle(ta);
    const mirror = document.createElement("div");
    for (const p of ["padding", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "tabSize"]) mirror.style[p] = s[p];
    // clientWidth leaves out the border and the vertical scrollbar, matching where the text wraps.
    Object.assign(mirror.style, { boxSizing: "border-box", width: `${ta.clientWidth}px`, position: "absolute", visibility: "hidden", whiteSpace: "pre-wrap", overflowWrap: "break-word", top: "0", left: "-9999px" });
    mirror.textContent = ta.value.slice(0, pos);
    const marker = document.createElement("span");
    marker.textContent = "​";
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const rect = ta.getBoundingClientRect();
    const scale = rect.width / ta.offsetWidth || 1;
    const point = {
        x: rect.left + (ta.clientLeft + marker.offsetLeft - ta.scrollLeft) * scale,
        y: rect.top + (ta.clientTop + marker.offsetTop + marker.offsetHeight - ta.scrollTop) * scale,
        lineTop: rect.top + (ta.clientTop + marker.offsetTop - ta.scrollTop) * scale,
    };
    mirror.remove();
    return point;
}

function close() {
    popup?.remove();
    popup = null;
    target = null;
    results = [];
}

function setActive(i) {
    active = (i + results.length) % results.length;
    const rows = popup.querySelector(".cfy-ac-list").children;
    for (let n = 0; n < rows.length; n++) rows[n].classList.toggle("active", n === active);
    rows[active]?.scrollIntoView({ block: "nearest" });
}

// The tag with the typed part wrapped in <mark>; fold() keeps ASCII tags the same length.
function tagLabel(t, q) {
    const label = document.createElement("span");
    label.className = "cfy-ac-tag";
    const at = t.key.indexOf(q);
    if (at < 0) {
        label.textContent = t.tag;
        return label;
    }
    const mark = document.createElement("mark");
    mark.textContent = t.tag.slice(at, at + q.length);
    label.append(t.tag.slice(0, at), mark, t.tag.slice(at + q.length));
    return label;
}

// execCommand keeps the insertion on the undo stack and fires the input event ComfyUI listens to.
function insert(i) {
    const ta = target;
    const caret = ta.selectionStart;
    const comma = !options.comma || ta.value.slice(caret).trimStart().startsWith(",") ? "" : ", ";
    const text = formatTag(results[i].t.tag) + comma;
    close();
    ta.setSelectionRange(tokenStart, caret);
    document.execCommand("insertText", false, text);
}

function render(ta, q) {
    // The tag being typed is not "already used".
    const rest = ta.value.slice(0, tokenStart) + ta.value.slice(ta.selectionStart);
    const used = new Set(rest.split(/[,\n]/).map(promptKey));
    if (!popup) {
        popup = document.createElement("div");
        popup.className = "cfy-ac";
        popup.innerHTML = `<div class="cfy-ac-list"></div><div class="cfy-ac-foot"><span><kbd>↑</kbd><kbd>↓</kbd> select</span><span><kbd>Enter</kbd> insert</span><span><kbd>Esc</kbd> close</span><span class="cfy-ac-legend">${Object.entries(SOURCES).map(([id, s]) => `<b class="cfy-ac-src-${id}" title="${s.name}">${s.label}</b>`).join("")}</span></div>`;
        popup.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in the textarea
        popup.addEventListener("click", (e) => {
            const item = e.target.closest(".cfy-ac-item");
            if (!item) return;
            const r = results[Number(item.dataset.i)];
            if (e.target.closest(".cfy-ac-wiki")) window.open(WIKI_URL[r.t.category[0]] + encodeURIComponent(r.t.tag), "_blank", "noopener");
            else insert(Number(item.dataset.i));
        });
        popup.addEventListener("mousemove", (e) => {
            const item = e.target.closest(".cfy-ac-item");
            if (item && Number(item.dataset.i) !== active) setActive(Number(item.dataset.i));
        });
        document.body.appendChild(popup);
    }
    target = ta;
    popup.querySelector(".cfy-ac-list").replaceChildren(...results.map(({ t, alias }, i) => {
        const row = document.createElement("div");
        row.className = `cfy-ac-item cfy-ac-cat-${t.category}${used.has(t.key) ? " is-used" : ""}`;
        row.dataset.i = i;
        row.innerHTML = `<span class="cfy-ac-alias"></span><span class="cfy-ac-src">${t.sources.map((s) => `<b class="cfy-ac-src-${s.id}">${SOURCES[s.id].label}</b>`).join("")}</span><span class="cfy-ac-count"></span><span class="cfy-ac-wiki" title="Open wiki"><svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h4.5A1.5 1.5 0 0 1 8 4.5V13a1.5 1.5 0 0 0-1.5-1.5H2zM14 3H9.5A1.5 1.5 0 0 0 8 4.5V13a1.5 1.5 0 0 1 1.5-1.5H14z"/></svg></span>`;
        row.prepend(tagLabel(t, q));
        row.querySelector(".cfy-ac-alias").textContent = options.aliases ? alias ?? t.aliases.find((a) => a !== t.tag) ?? "" : ""; // some lists repeat the tag itself
        row.querySelector(".cfy-ac-count").textContent = formatCount(t.count);
        row.title = [t.tag, ...t.sources.map((s) => `${SOURCES[s.id].name}: ${s.count.toLocaleString()} posts`)].join("\n");
        return row;
    }));
    setActive(0);

    const pt = caretPoint(ta, tokenStart);
    const w = popup.offsetWidth;
    const h = popup.offsetHeight;
    popup.style.left = `${Math.max(4, Math.min(pt.x, innerWidth - w - 4))}px`;
    popup.style.top = `${pt.y + h + 4 > innerHeight ? Math.max(4, pt.lineTop - h - 2) : pt.y + 2}px`;
}

async function update(ta) {
    const caret = ta.selectionStart;
    const before = ta.value.slice(0, caret);
    // A token also starts after a closing weight paren: "(red hair:1.2) bl".
    const paren = [...before.matchAll(/(?<!\\)\)/g)].pop()?.index ?? -1;
    const start = Math.max(before.lastIndexOf(","), before.lastIndexOf("\n"), paren) + 1;
    const lead = before.slice(start).match(/^(?:\s|\\?[([{])*/)[0].length;
    tokenStart = start + lead;
    const token = before.slice(tokenStart).replace(/\\/g, "");
    // Skip weights ("tag:1.2") and LoRA/embedding syntax ("<lora:...>", "embedding:").
    if (document.activeElement !== ta || token.trim().length < options.minChars || token.includes(":") || token.startsWith("<") || ta.selectionEnd !== caret) return close();
    if (!tags) {
        // Re-read the textarea once loaded: the text, caret or setting may have changed meanwhile.
        await ensureTags();
        if (tags && enabled && document.activeElement === ta) update(ta);
        return;
    }
    const q = fold(token);
    results = search(q);
    if (results.length) render(ta, q);
    else close();
}

export function initTagAutocomplete() {
    // IME composition (Japanese input) is matched once it is confirmed, on compositionend.
    document.addEventListener("input", (e) => {
        if (!enabled || !e.target.matches?.(PROMPT_SELECTOR) || e.isComposing) return;
        if (e.inputType?.startsWith("history")) close(); // undo/redo
        else update(e.target);
    });
    document.addEventListener("compositionend", (e) => {
        if (enabled && e.target.matches?.(PROMPT_SELECTOR)) update(e.target);
    });
    // Capture on window so ComfyUI's own keybindings never see the keys the list uses.
    window.addEventListener("keydown", (e) => {
        if (!popup || e.target !== target || e.isComposing) return;
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return close(); // e.g. Ctrl+Enter queues the prompt
        if (e.key === "ArrowDown") setActive(active + 1);
        else if (e.key === "ArrowUp") setActive(active - 1);
        else if (e.key === "Enter" || e.key === "Tab") insert(active);
        else if (e.key === "Escape") close();
        else {
            if (["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(e.key)) close();
            return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);
    document.addEventListener("focusout", (e) => { if (e.target === target) close(); });
    document.addEventListener("pointerdown", (e) => { if (popup && !popup.contains(e.target) && e.target !== target) close(); }, true);
    document.addEventListener("wheel", (e) => { if (popup && !popup.contains(e.target)) close(); }, { capture: true, passive: true });
}

export function setTagAutocompleteOption(name, value) {
    options[name] = value;
    close(); // the open list was built with the old options
    if (tags && (name === "danbooru" || name === "e621")) rank();
}

export function setTagAutocompleteEnabled(on) {
    enabled = on;
    if (!on) close();
}
