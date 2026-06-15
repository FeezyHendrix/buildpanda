import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, statSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const FPS = 30;
const LEAD_IN = 14;
const PAD = 26;
const INTRO_MIN = 150;
const OUTRO_MIN = 150;

const ROOT = process.cwd();
const TMP = "/tmp/bp-ann-vo";
const OUT = path.join(ROOT, "out");
const PUB = path.join(ROOT, "public", "audio");

function loadEnv() {
  const merged = { ...process.env };
  const f = path.join(ROOT, ".env");
  if (existsSync(f)) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) merged[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return merged;
}

const ENV = loadEnv();
const OPENAI_KEY = ENV.OPENAI_API_KEY;
const OPENAI_VOICE = ENV.OPENAI_VOICE || "onyx";
const OPENAI_MODEL = ENV.OPENAI_TTS_MODEL || "tts-1-hd";
if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY is required");

const dataSrc = readFileSync(path.join(ROOT, "src", "announcement-data.ts"), "utf8");

function extractString(name) {
  const re = new RegExp(`export const ${name} =\\s*([\\s\\S]*?);`);
  const m = dataSrc.match(re);
  if (!m) throw new Error(`Could not find ${name}`);
  return eval(m[1]);
}

const INTRO_TEXT = extractString("ANNOUNCEMENT_NARRATION_INTRO");
const OUTRO_TEXT = extractString("ANNOUNCEMENT_OUTRO_NARRATION");

const sceneBlock = dataSrc.match(/export const ANNOUNCEMENT_SCENES[\s\S]*?\n\];/)[0];
const scenes = [];
const idRe = /id:\s*"([^"]+)"[\s\S]*?narration:\s*\n?\s*"([\s\S]*?)",\n/g;
let mm;
while ((mm = idRe.exec(sceneBlock)) !== null) {
  scenes.push({ id: mm[1], narration: mm[2].replace(/\\"/g, '"') });
}

function ff(args) {
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args]);
}

function durationOf(file) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nokey=1:noprint_wrappers=1", file,
  ]);
  return parseFloat(out.toString().trim());
}

function synth(key, text) {
  const raw = path.join(TMP, `raw_${key}.wav`);
  const body = JSON.stringify({ model: OPENAI_MODEL, voice: OPENAI_VOICE, input: text, response_format: "wav" });
  execFileSync("curl", [
    "-sS", "https://api.openai.com/v1/audio/speech",
    "-H", `Authorization: Bearer ${OPENAI_KEY}`,
    "-H", "Content-Type: application/json",
    "-d", body, "-o", raw,
  ]);
  if (!existsSync(raw) || statSync(raw).size < 2000) {
    throw new Error(`TTS failed for ${key}: ${existsSync(raw) ? readFileSync(raw, "utf8").slice(0, 200) : "no file"}`);
  }
  const wav = path.join(TMP, `vo_${key}.wav`);
  ff([
    "-i", raw,
    "-af",
    "highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=8:release=180,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04:stop_periods=-1:stop_threshold=-45dB:stop_silence=0.20,loudnorm=I=-16:TP=-1.5:LRA=11",
    "-ar", "48000", "-ac", "2", wav,
  ]);
  return { wav, frames: Math.ceil(durationOf(wav) * FPS) };
}

mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(PUB, { recursive: true });

const parts = [
  { key: "intro", text: INTRO_TEXT, min: INTRO_MIN },
  ...scenes.map((s) => ({ key: s.id, text: s.narration, min: 96 })),
  { key: "outro", text: OUTRO_TEXT, min: OUTRO_MIN },
];

console.log(`Synthesizing ${parts.length} VO clips with OpenAI ${OPENAI_MODEL} / ${OPENAI_VOICE}...`);

const timing = {};
const clips = [];
let cursor = 0;
for (const p of parts) {
  const { wav, frames } = synth(p.key, p.text);
  const dur = Math.max(p.min, frames + PAD);
  timing[p.key] = dur;
  clips.push({ key: p.key, wav, voStart: cursor + LEAD_IN, voFrames: frames });
  cursor += dur;
  console.log(`  ${p.key}: VO ${frames}f -> scene ${dur}f`);
}

const totalFrames = cursor;
const trackWav = path.join(TMP, "vo_track.wav");
const silence = path.join(TMP, "silence.wav");
ff(["-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo`, "-t", String(totalFrames / FPS), silence]);

const inputs = ["-i", silence];
const filters = [];
clips.forEach((c, i) => {
  inputs.push("-i", c.wav);
  const delayMs = Math.round((c.voStart / FPS) * 1000);
  filters.push(`[${i + 1}]adelay=${delayMs}|${delayMs}[d${i}]`);
});
const mixLabels = clips.map((_, i) => `[d${i}]`).join("");
const filterComplex = `${filters.join(";")};[0]${mixLabels}amix=inputs=${clips.length + 1}:normalize=0:duration=longest[out]`;
ff([...inputs, "-filter_complex", filterComplex, "-map", "[out]", "-ar", "48000", "-ac", "2", trackWav]);

const finalAudio = path.join(PUB, "announcement-vo.wav");
ff(["-i", trackWav, "-af", "loudnorm=I=-15:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2", finalAudio]);

const tsLines = [
  "export const ANNOUNCEMENT_FPS = 30;",
  `export const ANNOUNCEMENT_TOTAL_FRAMES = ${totalFrames};`,
  "export const ANNOUNCEMENT_TIMING: Record<string, number> = {",
  ...Object.entries(timing).map(([k, v]) => `  ${k}: ${v},`),
  "};",
  "",
];
writeFileSync(path.join(ROOT, "src", "announcement-timing.generated.ts"), tsLines.join("\n"));

console.log(`Done. Total ${totalFrames} frames (${(totalFrames / FPS).toFixed(1)}s). VO -> public/audio/announcement-vo.wav`);
