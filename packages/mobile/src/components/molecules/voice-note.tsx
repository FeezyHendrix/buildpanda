import Ionicons from "@expo/vector-icons/Ionicons";
import { AudioPlayer } from "./audio-player";
import { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";
import { Text } from "@/components/atoms";
import { ICON_DANGER, ICON_DEFAULT, ICON_INVERSE } from "@/constants/colors";
import type { VoiceRecorder } from "@/hooks/use-voice-recorder";

// A voice note recorded on site is often the only record of what someone saw.
// Recording it blind — no level, no playback, no pause — gives no reason to
// believe it worked, which is why notes get re-recorded or quietly lost.

const BARS = 14;

export interface CapturedAudio {
  uri: string;
  durationSeconds: number;
}

function clock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  return `${m}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/** A live level meter, so a dead mic is obvious while there is still time. */
function LevelMeter({ level, active }: { level: number; active: boolean }) {
  const bars = useRef([...Array(BARS)].map(() => new Animated.Value(0.15))).current;
  useEffect(() => {
    if (!active) {
      bars.forEach((b) => b.setValue(0.15));
      return;
    }
    // the centre bars react hardest, so speech reads as a shape rather than a row
    bars.forEach((bar, i) => {
      const weight = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
      const target = 0.15 + level * (0.4 + weight * 0.6) * (0.7 + Math.random() * 0.6);
      Animated.timing(bar, { toValue: Math.min(1, target), duration: 90, useNativeDriver: false }).start();
    });
  }, [level, active, bars]);

  return (
    <View className="h-8 flex-1 flex-row items-center justify-center gap-1" accessibilityLabel="Microphone level">
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          className={active ? "w-1 rounded-full bg-primary-500" : "w-1 rounded-full bg-grey-100"}
          style={{ height: bar.interpolate({ inputRange: [0, 1], outputRange: [4, 30] }) }}
        />
      ))}
    </View>
  );
}
LevelMeter.displayName = "LevelMeter";

/** Record, watch the level, pause, then hear it back before sending. */
export function VoiceNote({
  recorder,
  captured,
  onCaptured,
  onDiscard,
  maxDurationSeconds,
}: {
  recorder: VoiceRecorder;
  captured: CapturedAudio | null;
  onCaptured: (audio: CapturedAudio) => void;
  onDiscard: () => void;
  maxDurationSeconds?: number;
}) {
  const stopping = useRef(false);
  useEffect(() => {
    if (!maxDurationSeconds || recorder.seconds < maxDurationSeconds || !recorder.isRecording || stopping.current) return;
    stopping.current = true;
    void recorder.stop().then((audio) => { if (audio) onCaptured(audio); }).finally(() => { stopping.current = false; });
  }, [maxDurationSeconds, recorder.seconds, recorder.isRecording, recorder.stop, onCaptured]);
  if (captured) return <View className="gap-2"><AudioPlayer uri={captured.uri} durationSeconds={captured.durationSeconds} />
    <Pressable accessibilityRole="button" accessibilityLabel="Remove voice note" onPress={onDiscard} className="min-h-11 justify-center px-3">
      <Text tone="danger">Remove voice note</Text>
    </Pressable></View>;

  const live = recorder.isRecording || recorder.isPaused;
  return (
    <View className="gap-2 rounded-xl border border-hairline px-3 py-2">
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => {
            if (!live) {
              void recorder.start();
              return;
            }
            void recorder.stop().then((result) => {
              if (result) onCaptured(result);
            });
          }}
          accessibilityRole="button"
          accessibilityLabel={live ? "Stop recording" : "Record a voice note"}
          className={`h-11 w-11 items-center justify-center rounded-full ${live ? "bg-error-500" : "bg-primary-500"}`}
        >
          <Ionicons name={live ? "stop" : "mic"} size={18} color={ICON_INVERSE} />
        </Pressable>

        {live ? <LevelMeter level={recorder.level} active={recorder.isRecording} /> : (
          <Text tone="secondary" className="flex-1 text-[13px]">
            Record a voice note
          </Text>
        )}

        {live ? (
          <Pressable
            onPress={() => (recorder.isPaused ? recorder.resume() : recorder.pause())}
            accessibilityRole="button"
            accessibilityLabel={recorder.isPaused ? "Resume recording" : "Pause recording"}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt"
          >
            <Ionicons name={recorder.isPaused ? "play" : "pause"} size={18} color={ICON_DEFAULT} />
          </Pressable>
        ) : null}
      </View>

      {live ? (
        <Text tone="secondary" className="text-center text-[11px] tabular-nums">
          {recorder.isPaused ? `Paused · ${clock(recorder.seconds)}` : clock(recorder.seconds)}
        </Text>
      ) : null}
    </View>
  );
}
VoiceNote.displayName = "VoiceNote";
