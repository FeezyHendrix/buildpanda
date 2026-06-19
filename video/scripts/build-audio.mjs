import { execFileSync } from "node:child_process";
import {
  writeFileSync, readFileSync, statSync, mkdirSync, rmSync, existsSync,
} from "node:fs";
import path from "node:path";

const FPS = 30;
const TRANSITION = 16;
const LEAD_IN = 12;
const TAIL_OUT = 20;
const SCENE_MIN = 96;
const TITLE_MIN = 105;
const OUTRO_MIN = 120;
const VOICE = "Samantha";
const RATE = 178;

const ROOT = process.cwd();
const TMP = "/tmp/bp-vo";
const OUT = path.join(ROOT, "out");

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
const ELEVEN_KEY = ENV.ELEVENLABS_API_KEY;
const OPENAI_KEY = ENV.OPENAI_API_KEY;
const ELEVEN_VOICE = ENV.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const ELEVEN_MODEL = ENV.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const OPENAI_VOICE = ENV.OPENAI_VOICE || "onyx";
const OPENAI_MODEL = ENV.OPENAI_TTS_MODEL || "tts-1-hd";
const PROVIDER = ELEVEN_KEY ? "elevenlabs" : OPENAI_KEY ? "openai" : `say:${VOICE}`;

const SCENE_IDS = [
  "signup", "dashboard", "overview", "next", "kanban",
  "gantt", "boq", "rfis", "bim", "client",
];

const NARRATION = {
  title:
    "Here's how to run your first project on BuildPanda, in ten simple steps.",
  signup:
    "Step one. Create your account. Sign up in seconds, and you're ready to set up your first build.",
  dashboard:
    "Step two. Your dashboard. Every active project, its progress, and what needs you today, all in one place.",
  overview:
    "Step three. Open a project and it's ready from day one. Budget, phases, and milestones, built for you from your schedule and bill of quantities.",
  next:
    "Step four. Always know what's next. The work that needs your attention is surfaced before it has a chance to slip.",
  kanban:
    "Step five. Plan the work on a board. Organise tasks and subtasks, and move them across as the build progresses.",
  gantt:
    "Step six. See the whole programme. Your schedule as a Gantt chart, with dependencies and the critical path.",
  boq:
    "Step seven. Track your materials. Work straight from the bill of quantities as items are ordered and used on site.",
  rfis:
    "Step eight. Raise and track R F Is. Log a question, route it to the right person, and keep every answer on the record.",
  bim:
    "Step nine. Open the B I M model. View the federated model, select any element, and assign it to a person.",
  client:
    "Step ten. Keep your client in the loop. They see real progress and where the budget goes, so the questions stop coming to you.",
  outro:
    "That's it. Set up your first project today, at buildpanda dot io.",
};

const CHORDS = [
  { notes: [261.63, 329.63, 392.0], sub: 130.81 },
  { notes: [246.94, 293.66, 392.0], sub: 196.0 },
  { notes: [220.0, 261.63, 329.63], sub: 110.0 },
  { notes: [220.0, 261.63, 349.23], sub: 174.61 },
];

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

function frameToMs(frame) {
  return Math.round((frame / FPS) * 1000);
}

function synthVoice(key, outBase) {
  const text = NARRATION[key];
  if (ELEVEN_KEY) {
    const file = `${outBase}.mp3`;
    const body = JSON.stringify({
      text,
      model_id: ELEVEN_MODEL,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true },
    });
    execFileSync("curl", [
      "-sS", "-X", "POST",
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}`,
      "-H", `xi-api-key: ${ELEVEN_KEY}`,
      "-H", "Content-Type: application/json",
      "-d", body, "-o", file,
    ]);
    return file;
  }
  if (OPENAI_KEY) {
    const file = `${outBase}.wav`;
    const body = JSON.stringify({ model: OPENAI_MODEL, voice: OPENAI_VOICE, input: text, response_format: "wav" });
    execFileSync("curl", [
      "-sS", "https://api.openai.com/v1/audio/speech",
      "-H", `Authorization: Bearer ${OPENAI_KEY}`,
      "-H", "Content-Type: application/json",
      "-d", body, "-o", file,
    ]);
    return file;
  }
  const file = `${outBase}.aiff`;
  execFileSync("say", ["-v", VOICE, "-r", String(RATE), "-o", file, text]);
  return file;
}

function makeVoiceClip(key) {
  const rawFile = synthVoice(key, path.join(TMP, `raw_${key}`));
  if (!existsSync(rawFile) || statSync(rawFile).size < 1500) {
    const peek = existsSync(rawFile) ? readFileSync(rawFile, "utf8").slice(0, 300) : "no output";
    throw new Error(`TTS failed for "${key}" via ${PROVIDER}: ${peek}`);
  }
  const wav = path.join(TMP, `vo_${key}.wav`);
  ff([
    "-i", rawFile,
    "-af",
    "highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=8:release=180,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04:stop_periods=-1:stop_threshold=-45dB:stop_silence=0.18",
    "-ar", "48000", "-ac", "2", wav,
  ]);
  return { wav, frames: Math.ceil(durationOf(wav) * FPS) };
}

function chordExpr({ notes, sub }) {
  const parts = [];
  for (const f of notes) {
    parts.push(`0.06*sin(2*PI*${f}*t)`);
    parts.push(`0.06*sin(2*PI*${(f * 1.005).toFixed(3)}*t)`);
  }
  parts.push(`0.095*sin(2*PI*${sub}*t)`);
  return parts.join("+");
}

function buildMusicBed(totalSec) {
  const chordFiles = [];
  CHORDS.forEach((chord, i) => {
    const file = path.join(TMP, `chord_${i}.wav`);
    ff([
      "-f", "lavfi",
      "-i", `aevalsrc=${chordExpr(chord)}:d=4.0:s=48000`,
      "-af", "afade=t=in:st=0:d=0.7,afade=t=out:st=3.3:d=0.7",
      "-ac", "1", file,
    ]);
    chordFiles.push(file);
  });

  const listFile = path.join(TMP, "chords.txt");
  writeFileSync(listFile, chordFiles.map((f) => `file '${f}'`).join("\n"));
  const prog = path.join(TMP, "prog.wav");
  ff(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", prog]);

  const looped = path.join(TMP, "bedraw.wav");
  ff(["-stream_loop", "-1", "-i", prog, "-t", String(totalSec + 1), looped]);

  const bed = path.join(TMP, "musicbed.wav");
  ff([
    "-i", looped,
    "-af",
    "lowpass=f=2500,aecho=0.8:0.9:75|130|200:0.3|0.22|0.14,highpass=f=55,volume=0.95",
    "-ar", "48000", "-ac", "2",
    "-t", String(totalSec), bed,
  ]);
  return bed;
}

function buildClick() {
  const click = path.join(TMP, "click.wav");
  ff([
    "-f", "lavfi",
    "-i", "aevalsrc=0.5*sin(2*PI*1800*t)*exp(-t*55):d=0.08:s=48000",
    "-af", "highpass=f=400,volume=0.7", "-ac", "2", click,
  ]);
  return click;
}

function buildVoiceBus(segments, totalSec) {
  const inputs = [];
  segments.forEach((s) => inputs.push("-i", s.wav));
  const delays = segments
    .map((s, i) => `[${i}:a]adelay=${s.atMs}|${s.atMs}[v${i}]`)
    .join(";");
  const mixIn = segments.map((_, i) => `[v${i}]`).join("");
  const filter =
    `${delays};${mixIn}amix=inputs=${segments.length}:normalize=0:dropout_transition=0[vmix];` +
    `[vmix]apad=pad_dur=${totalSec},atrim=0:${totalSec}[vobus]`;
  const out = path.join(TMP, "vobus.wav");
  ff([...inputs, "-filter_complex", filter, "-map", "[vobus]", "-ar", "48000", "-ac", "2", out]);
  return out;
}

function buildClickBus(click, clickMsList, totalSec) {
  const n = clickMsList.length;
  const splits = Array.from({ length: n }, (_, i) => `[c${i}]`).join("");
  const delays = clickMsList
    .map((ms, i) => `[c${i}]adelay=${ms}|${ms}[d${i}]`)
    .join(";");
  const mixIn = clickMsList.map((_, i) => `[d${i}]`).join("");
  const filter =
    `[0:a]asplit=${n}${splits};${delays};${mixIn}amix=inputs=${n}:normalize=0[cmix];` +
    `[cmix]apad=pad_dur=${totalSec},atrim=0:${totalSec}[clickbus]`;
  const out = path.join(TMP, "clickbus.wav");
  ff(["-i", click, "-filter_complex", filter, "-map", "[clickbus]", "-ar", "48000", "-ac", "2", out]);
  return out;
}

function master(bed, vobus, clickbus) {
  const ducked = path.join(TMP, "musicducked.wav");
  ff([
    "-i", bed, "-i", vobus,
    "-filter_complex",
    "[0:a][1:a]sidechaincompress=threshold=0.03:ratio=12:attack=5:release=320:makeup=1[duck]",
    "-map", "[duck]", "-ar", "48000", "-ac", "2", ducked,
  ]);

  const out = path.join(OUT, "master.wav");
  ff([
    "-i", ducked, "-i", vobus, "-i", clickbus,
    "-filter_complex",
    "[0:a]volume=0.85[m];[1:a]volume=1.0[v];[2:a]volume=0.4[c];" +
      "[m][v][c]amix=inputs=3:normalize=0[mx];[mx]loudnorm=I=-16:TP=-1.5:LRA=11[outa]",
    "-map", "[outa]", "-ar", "48000", "-ac", "2", out,
  ]);
  return out;
}

function writeTiming(titleDur, sceneDurs, outroDur) {
  const file = path.join(ROOT, "src", "timing.generated.ts");
  const body =
    `export const TRANSITION_DURATION = ${TRANSITION};\n` +
    `export const TITLE_DURATION = ${titleDur};\n` +
    `export const OUTRO_DURATION = ${outroDur};\n` +
    `export const SCENE_DURATIONS: number[] = [\n  ${sceneDurs.join(", ")},\n];\n`;
  writeFileSync(file, body);
}

function main() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  console.log(`voice provider: ${PROVIDER}`);

  const vo = {};
  for (const key of ["title", ...SCENE_IDS, "outro"]) {
    vo[key] = makeVoiceClip(key);
  }

  const titleDur = Math.max(TITLE_MIN, vo.title.frames + LEAD_IN + TAIL_OUT + TRANSITION);
  const sceneDurs = SCENE_IDS.map((id) =>
    Math.max(SCENE_MIN, vo[id].frames + LEAD_IN + TAIL_OUT + 2 * TRANSITION),
  );
  const outroDur = Math.max(OUTRO_MIN, vo.outro.frames + LEAD_IN + TAIL_OUT + TRANSITION);

  const sceneStart = [];
  let cursor = titleDur - TRANSITION;
  for (let k = 0; k < sceneDurs.length; k++) {
    sceneStart.push(cursor);
    cursor += sceneDurs[k] - TRANSITION;
  }
  const outroStart = cursor;
  const totalFrames = outroStart + outroDur;
  const totalSec = totalFrames / FPS;

  const segments = [];
  segments.push({ wav: vo.title.wav, atMs: frameToMs(LEAD_IN) });
  SCENE_IDS.forEach((id, k) => {
    segments.push({ wav: vo[id].wav, atMs: frameToMs(sceneStart[k] + TRANSITION + LEAD_IN) });
  });
  segments.push({ wav: vo.outro.wav, atMs: frameToMs(outroStart + TRANSITION + LEAD_IN) });

  const clickMsList = SCENE_IDS.map((_, k) =>
    frameToMs(sceneStart[k] + sceneDurs[k] - TRANSITION - 8),
  );

  const bed = buildMusicBed(totalSec);
  const click = buildClick();
  const vobus = buildVoiceBus(segments, totalSec);
  const clickbus = buildClickBus(click, clickMsList, totalSec);
  const masterFile = master(bed, vobus, clickbus);

  writeTiming(titleDur, sceneDurs, outroDur);

  const report = {
    provider: PROVIDER,
    titleDur,
    sceneDurs,
    outroDur,
    totalFrames,
    totalSec: Number(totalSec.toFixed(2)),
    masterDur: Number(durationOf(masterFile).toFixed(2)),
  };
  console.log(JSON.stringify(report, null, 2));
}

main();
