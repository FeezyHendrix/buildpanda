import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useCallback, useState } from "react";

export interface VoiceRecorder {
  isRecording: boolean;
  /** Elapsed recording time in whole seconds, for the on-screen timer. */
  seconds: number;
  error: string | null;
  start: () => Promise<void>;
  /** Stops and returns the recorded file URI, or null if nothing was captured. */
  stop: () => Promise<string | null>;
}

/**
 * Thin wrapper over expo-audio's recorder that exposes just what the capture
 * screen needs: a start/stop pair and a live seconds counter. Permission and
 * audio-session setup happen on `start`, so the screen can stay declarative.
 */
export function useVoiceRecorder(): VoiceRecorder {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError("Microphone access is off. Enable it in Settings to record a note.");
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  const stop = useCallback(async () => {
    await recorder.stop();
    return recorder.uri;
  }, [recorder]);

  return {
    isRecording: state.isRecording,
    seconds: Math.floor((state.durationMillis ?? 0) / 1000),
    error,
    start,
    stop,
  };
}
