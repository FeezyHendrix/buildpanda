export const MAX_VOICE_NOTE_SECONDS = 5 * 60;
export const MAX_VOICE_NOTE_BYTES = 25 * 1024 * 1024;
export const VOICE_NOTE_TYPES = ["audio/m4a", "audio/x-m4a", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg"] as const;

export function voiceNoteError(mimeType: string, bytes: number, seconds?: number): string | null {
  if (!(VOICE_NOTE_TYPES as readonly string[]).includes(mimeType.split(";")[0] ?? "")) return "Choose an audio recording.";
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_VOICE_NOTE_BYTES) return "Voice notes must be between 1 byte and 25 MB.";
  if (seconds !== undefined && (!Number.isFinite(seconds) || seconds < 1 || seconds > MAX_VOICE_NOTE_SECONDS)) return "Record between 1 second and 5 minutes.";
  return null;
}
