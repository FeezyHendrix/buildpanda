import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

// Voice notes need speech intelligibility, not music fidelity: mono at 16 kHz
// (Whisper's own input rate) and a low bitrate make the upload ~4x smaller than
// HIGH_QUALITY's stereo 44.1 kHz / 128 kbps, so transcription starts far sooner
// with no accuracy loss on speech.
//
// Metering is on because a recorder that shows nothing while you speak gives
// you no reason to believe it heard you, and no way to notice a dead mic until
// the note is already sent.
const SPEECH_RECORDING = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
};

/** Metering is roughly -160 dB (silence) to 0 dB (peak); this maps it to 0..1. */
const FLOOR_DB = -50;

export interface Recording {
  uri: string;
  durationSeconds: number;
}

export interface VoiceRecorder {
  isRecording: boolean;
  isPaused: boolean;
  /** Elapsed recording time in whole seconds, for the on-screen timer. */
  seconds: number;
  /** 0..1 input level, for the live meter. */
  level: number;
  error: string | null;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  /** Stops and returns the file with the duration measured while recording. */
  stop: () => Promise<Recording | null>;
  /** Stops and throws the recording away — for cancel and unmount. */
  discard: () => Promise<void>;
}

function levelFrom(metering: number | undefined): number {
  if (metering === undefined || Number.isNaN(metering)) return 0;
  if (metering >= 0) return 1;
  return Math.max(0, Math.min(1, (metering - FLOOR_DB) / -FLOOR_DB));
}

/**
 * expo-audio's recorder with the parts a voice note needs: a level to watch, a
 * pause for when someone interrupts you, and a duration captured before the
 * recorder is stopped — read afterwards it is whatever the live state has
 * decayed to, which is how a note ended up claiming to be zero seconds long.
 */
export function useVoiceRecorder(): VoiceRecorder {
  const recorder = useAudioRecorder(SPEECH_RECORDING);
  const state = useAudioRecorderState(recorder);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  // the last duration seen while running; the state resets as the recorder stops
  const lastSeconds = useRef(0);
  const running = useRef(false);
  const starting = useRef(false);
  const mounted = useRef(true);
  const generation = useRef(0);

  const seconds = Math.floor((state.durationMillis ?? 0) / 1000);
  if (state.isRecording && seconds > 0) lastSeconds.current = seconds;
  running.current = state.isRecording || isPaused;

  const start = useCallback(async () => {
    if (starting.current || running.current) return;
    starting.current = true;
    const attempt = ++generation.current;
    setError(null);
    setIsPaused(false);
    lastSeconds.current = 0;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!mounted.current || attempt !== generation.current) return;
      if (!permission.granted) {
        setError("Microphone access is off. Enable it in Settings to record a note.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!mounted.current || attempt !== generation.current) {
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      recorder.record();
      running.current = true;
    } catch {
      if (mounted.current) setError("Could not start the microphone. Close other recording apps and try again.");
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    } finally {
      starting.current = false;
    }
  }, [recorder]);

  const pause = useCallback(() => {
    try { recorder.pause(); setIsPaused(true); }
    catch { setError("Could not pause the recording. Try stopping it instead."); }
  }, [recorder]);

  const resume = useCallback(() => {
    try { recorder.record(); setIsPaused(false); }
    catch { setError("Could not resume the recording. Try recording again."); }
  }, [recorder]);

  const stop = useCallback(async (): Promise<Recording | null> => {
    const measured = lastSeconds.current;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      return uri ? { uri, durationSeconds: measured } : null;
    } catch {
      setError("Could not finish this recording. Try recording again.");
      return null;
    } finally {
      setIsPaused(false);
      running.current = false;
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }
  }, [recorder]);

  const discard = useCallback(async () => {
    generation.current += 1;
    if (!running.current) return;
    try {
      await recorder.stop();
    } catch {
      // a recorder that already stopped is the state we wanted
    }
    setIsPaused(false);
    running.current = false;
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
  }, [recorder]);

  // leaving the screen mid-recording must not leave the mic open
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (running.current) {
        void recorder.stop().catch(() => undefined)
          .then(() => setAudioModeAsync({ allowsRecording: false })).catch(() => undefined);
      }
    };
  }, [recorder]);

  return {
    isRecording: state.isRecording,
    isPaused,
    seconds: state.isRecording || isPaused ? Math.max(seconds, lastSeconds.current) : lastSeconds.current,
    level: state.isRecording ? levelFrom(state.metering) : 0,
    error,
    start,
    pause,
    resume,
    stop,
    discard,
  };
}
