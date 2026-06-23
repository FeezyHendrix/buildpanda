let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  return audioContext;
}

// A short two-note rising chime — distinct enough to read as a BuildPanda
// message ping while still sounding like a notification, and generated at
// runtime so it ships without an audio asset.
export function playMessageChime(): void {
  const ctx = getContext();
  if (!ctx) return;
  void ctx.resume().catch(() => undefined);

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  master.connect(ctx.destination);

  const notes = [
    { freq: 660, start: 0, dur: 0.16 },
    { freq: 988, start: 0.12, dur: 0.26 },
  ];

  for (const note of notes) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(note.freq, now + note.start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now + note.start);
    gain.gain.exponentialRampToValueAtTime(1, now + note.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now + note.start);
    osc.stop(now + note.start + note.dur + 0.02);
  }
}
