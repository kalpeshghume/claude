// Loads reel.config.json, then applies env vars, then CLI flags (CLI wins).
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function parseArgs(argv) {
  const flags = {}, rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { rest.push(a); continue; }
    const [k, inline] = a.slice(2).split("=");
    const next = argv[i + 1];
    if (inline !== undefined) flags[k] = inline;
    else if (next !== undefined && !next.startsWith("--")) { flags[k] = next; i++; }
    else flags[k] = true;
  }
  return { flags, rest };
}

const num = (v) => (v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined);

export function loadConfig(flags = {}, env = process.env) {
  const cfg = JSON.parse(readFileSync(resolve(KIT, "reel.config.json"), "utf8"));
  const { sound, voice, thumbnail } = cfg;

  // ---- env ----
  if (num(env.SFX) === 0) sound.sfx.enabled = false;
  if (num(env.SFX_MASTER) !== undefined) sound.master = num(env.SFX_MASTER);
  for (const [k, c] of Object.entries(sound.sfx.categories)) {
    const v = num(env["SFX_" + k.toUpperCase()]);
    if (v === 0) c.enabled = false; else if (v !== undefined) c.volume = v;
  }
  if (num(env.VOICE) === 0) voice.enabled = false;
  if (num(env.VOICE_VOLUME) !== undefined) voice.volume = num(env.VOICE_VOLUME);
  if (env.VOICE_PROVIDER) voice.provider = env.VOICE_PROVIDER;
  if (env.VOICE_NAME) voice.voice = env.VOICE_NAME;
  if (num(env.VOICE_SPEED) !== undefined) voice.speed = num(env.VOICE_SPEED);
  if (env.THUMB_STYLE) thumbnail.style = env.THUMB_STYLE;
  if (num(env.THUMB) === 0) thumbnail.enabled = false;

  // ---- CLI ----
  const f = flags;
  if (f.sfx === "off" || f.sfx === "0") sound.sfx.enabled = false;
  if (num(f["sfx-master"]) !== undefined) sound.master = num(f["sfx-master"]);
  if (f.voice === "off" || f.voice === "0") voice.enabled = false;
  else if (typeof f.voice === "string" && f.voice !== "on") voice.provider = f.voice;           // --voice mock | kokoro | none
  if (f["voice-name"]) voice.voice = f["voice-name"];
  if (num(f["voice-speed"]) !== undefined) voice.speed = num(f["voice-speed"]);
  if (num(f["voice-volume"]) !== undefined) voice.volume = num(f["voice-volume"]);
  if (f.thumb === "off" || f.thumb === "0") thumbnail.enabled = false;
  else if (typeof f.thumb === "string") thumbnail.style = f.thumb;                                // --thumb neon | all
  if (voice.provider === "none") voice.enabled = false;
  cfg.render = !!f.render;
  return cfg;
}
