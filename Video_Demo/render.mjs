// Fallback frame-by-frame renderer: headless Chrome (CDP over Node's built-in
// WebSocket) seeks the paused GSAP timeline, screenshots each frame, ffmpeg encodes.
// Used only because the HyperFrames CLI could not be installed in this sandbox.
// Usage: node render.mjs [out.mp4] [startSec] [endSec]
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const out = process.argv[2] || "tuples-reel.mp4";
const FPS = 30, W = 1080, H = 1920;
const page = "file://" + resolve("index.html");
const port = 9333 + Math.floor(Math.random() * 500);

const chrome = spawn("/usr/bin/google-chrome", [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
  `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, "--user-data-dir=/tmp/hf-chrome-" + port, "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });

let targets;
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {}
  await sleep(250);
}
const tgt = targets.find((t) => t.type === "page");
ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); } };

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: page });
await sleep(1500);
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };

await ev(`document.fonts.ready.then(() => document.fonts.size)`);
await ev(`window.__seek = (t) => {
  document.querySelectorAll('.clip').forEach((el) => {
    const s = parseFloat(el.dataset.start), d = parseFloat(el.dataset.duration);
    el.style.display = (t >= s && t < s + d) ? '' : 'none';
  });
  window.__timelines.main.seek(t, false);
  return true;
}`);

const dur = parseFloat(await ev(`document.getElementById('root').dataset.duration`));
const t0 = parseFloat(process.argv[3] ?? 0), t1 = parseFloat(process.argv[4] ?? dur);
const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });

const frames = Math.round((t1 - t0) * FPS);
for (let i = 0; i < frames; i++) {
  await ev(`window.__seek(${(t0 + i / FPS).toFixed(4)})`);
  const { data } = await send("Page.captureScreenshot", { format: "jpeg", quality: 95, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
  if (!ff.stdin.write(Buffer.from(data, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 90 === 0) console.log(`frame ${i}/${frames}`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
ws.close(); chrome.kill();
console.log("done", out);
