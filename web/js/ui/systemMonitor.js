// Top-bar system monitor: CPU, RAM, NVIDIA GPU load/VRAM/temperature and the models disk.
import { api } from "../../../../scripts/api.js";

const HOT_PERCENT = 90;
const HOT_TEMP = 80;
const GB = 1024 ** 3;

// Mirrors the Civicomfy.SystemMonitor.* settings; set through setSystemMonitorOption.
const options = { cpu: true, ram: true, gpu: true, vram: true, temp: true, disk: true, interval: 1, units: "GB" };

let enabled = true;
let anchor = null;
let root = null;
let timer = null;
const meters = new Map();
let seen = new Set(); // meter keys set by the latest render

const gb = (bytes) => `${(bytes / GB).toFixed(1)} GB`;
const gbShort = (bytes) => { const v = bytes / GB; return v < 100 ? v.toFixed(1) : Math.round(v); };

function setMeter(key, label, percent, value, title, hot = percent >= HOT_PERCENT, wide = false) {
    let el = meters.get(key);
    if (!el) {
        el = document.createElement("div");
        el.className = wide ? "cfy-meter cfy-meter-wide" : "cfy-meter";
        el.innerHTML = `<span class="cfy-meter-fill"></span><span class="cfy-meter-label"></span><span class="cfy-meter-value"></span>`;
        el.querySelector(".cfy-meter-label").textContent = label;
        root.appendChild(el);
        meters.set(key, el);
    }
    seen.add(key);
    el.style.setProperty("--cfy-meter", `${Math.min(percent, 100)}%`);
    el.classList.toggle("is-hot", hot);
    el.querySelector(".cfy-meter-value").textContent = value;
    el.title = title;
}

// RAM, VRAM and disk show "used / total GB" or a percentage, per the units setting.
function setMemoryMeter(key, label, used, total, title) {
    const percent = (used / total) * 100;
    const inGb = options.units === "GB";
    const value = inGb ? `${gbShort(used)} / ${gbShort(total)} GB` : `${Math.round(percent)}%`;
    setMeter(key, label, percent, value, `${title} ${gb(used)} / ${gb(total)} (${percent.toFixed(1)}%)`, percent >= HOT_PERCENT, inGb);
}

function render(stats) {
    seen = new Set();
    if (options.cpu) setMeter("cpu", "CPU", stats.cpu, `${Math.round(stats.cpu)}%`, `CPU ${stats.cpu.toFixed(1)}%`);
    if (options.ram) setMemoryMeter("ram", "RAM", stats.ram.used, stats.ram.total, "RAM");
    const multi = stats.gpus.length > 1;
    stats.gpus.forEach((gpu, i) => {
        const n = multi ? ` ${i}` : "";
        if (options.gpu) setMeter(`gpu${i}`, `GPU${n}`, gpu.util, `${gpu.util}%`, `${gpu.name} · load ${gpu.util}%`);
        if (options.vram) setMemoryMeter(`vram${i}`, `VRAM${n}`, gpu.vram_used, gpu.vram_total, `${gpu.name} · VRAM`);
        if (options.temp) setMeter(`temp${i}`, `TEMP${n}`, gpu.temp, `${gpu.temp}°`, `${gpu.name} · ${gpu.temp}°C`, gpu.temp >= HOT_TEMP);
    });
    if (options.disk && stats.disk) setMemoryMeter("disk", "DISK", stats.disk.used, stats.disk.total, "Models disk");
    // A GPU lost to a driver reset drops out of the response; drop its meters too.
    for (const [key, el] of meters) {
        if (!seen.has(key)) {
            el.remove();
            meters.delete(key);
        }
    }
}

// Each loop is bound to the root it was started for, so a loop whose fetch
// resolves after the monitor was toggled off/on ends instead of doubling up.
async function poll(el) {
    if (!document.hidden) {
        let stats = null;
        let status = 0;
        try {
            const res = await api.fetchApi("/civitai/system_stats");
            if (res.ok) stats = await res.json();
            else status = res.status;
        } catch {
            // server restarting: keep trying
        }
        if (root !== el) return;
        if (status) {
            // Backend without this route (not restarted since update): stop asking.
            console.warn(`[Civicomfy] System monitor disabled: /civitai/system_stats returned ${status}.`);
            teardown();
            return;
        }
        if (stats) render(stats);
    }
    if (root === el) timer = setTimeout(poll, options.interval * 1000, el);
}

function teardown() {
    clearTimeout(timer);
    timer = null;
    root.remove();
    root = null;
    meters.clear();
}

function sync() {
    if (enabled && anchor) {
        if (!root) {
            root = document.createElement("div");
            root.className = "cfy-monitor";
            poll(root);
        }
        anchor.after(root);
    } else if (root) {
        teardown();
    }
}

export function attachSystemMonitor(afterEl) {
    anchor = afterEl;
    sync();
}

export function setSystemMonitorOption(name, value) {
    options[name] = value;
    // Rebuild on the next poll so meters keep their order and width.
    root?.replaceChildren();
    meters.clear();
}

export function setSystemMonitorEnabled(on) {
    enabled = on;
    sync();
}
