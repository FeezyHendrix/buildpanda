import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const FPS = 30;
const TRANSITION = 16;
const TITLE = 80;
const SCENE = 116;
const OUTRO = 80;
const N = 6;

const ROOT = process.cwd();
const TMP = "/tmp/bp-demo";
const OUT = path.join(ROOT, "out");

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
  return parseFloat(
    execFileSync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=nokey=1:noprint_wrappers=1", file,
    ]).toString().trim(),
  );
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
      "-f", "lavfi", "-i", `aevalsrc=${chordExpr(chord)}:d=4.0:s=48000`,
      "-af", "afade=t=in:st=0:d=0.7,afade=t=out:st=3.3:d=0.7", "-ac", "1", file,
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
    "-af", "lowpass=f=2500,aecho=0.8:0.9:75|130|200:0.3|0.22|0.14,highpass=f=55,volume=0.95",
    "-ar", "48000", "-ac", "2", "-t", String(totalSec), bed,
  ]);
  return bed;
}

function buildClick() {
  const click = path.join(TMP, "click.wav");
  ff([
    "-f", "lavfi", "-i", "aevalsrc=0.5*sin(2*PI*1800*t)*exp(-t*55):d=0.08:s=48000",
    "-af", "highpass=f=400,volume=0.7", "-ac", "2", click,
  ]);
  return click;
}

function main() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  const sceneStart = [];
  let cur = TITLE - TRANSITION;
  for (let k = 0; k < N; k++) {
    sceneStart.push(cur);
    cur += SCENE - TRANSITION;
  }
  const totalFrames = cur + OUTRO;
  const totalSec = totalFrames / FPS;
  const clickMs = sceneStart.map((s) => Math.round(((s + SCENE - TRANSITION - 8) / FPS) * 1000));

  const bed = buildMusicBed(totalSec);
  const click = buildClick();

  const n = clickMs.length;
  const splits = Array.from({ length: n }, (_, i) => `[c${i}]`).join("");
  const delays = clickMs.map((ms, i) => `[c${i}]adelay=${ms}|${ms}[d${i}]`).join(";");
  const mixIn = clickMs.map((_, i) => `[d${i}]`).join("");
  const clickbus = path.join(TMP, "clickbus.wav");
  ff([
    "-i", click, "-filter_complex",
    `[0:a]asplit=${n}${splits};${delays};${mixIn}amix=inputs=${n}:normalize=0[cmix];` +
      `[cmix]apad=pad_dur=${totalSec},atrim=0:${totalSec}[cb]`,
    "-map", "[cb]", "-ar", "48000", "-ac", "2", clickbus,
  ]);

  const out = path.join(OUT, "demo-master.wav");
  ff([
    "-i", bed, "-i", clickbus, "-filter_complex",
    "[0:a]volume=1.0[m];[1:a]volume=0.4[c];[m][c]amix=inputs=2:normalize=0[mx];" +
      "[mx]loudnorm=I=-16:TP=-1.5:LRA=11[o]",
    "-map", "[o]", "-ar", "48000", "-ac", "2", out,
  ]);

  console.log(JSON.stringify({
    totalFrames, totalSec: Number(totalSec.toFixed(2)),
    masterDur: Number(durationOf(out).toFixed(2)),
  }, null, 2));
}

main();
