import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/atoms";
import { ICON_BRAND, ICON_DEFAULT, ICON_INVERSE, ICON_STRONG } from "@/constants/colors";
import { useVoiceRecorder, type Recording } from "@/hooks/use-voice-recorder";

// Recording is a moment, not a destination. Speaking about what just happened
// on site should not cost a screen transition and the loss of whatever you
// were looking at, so the recorder rises over the current screen. The page
// comes after, when there are drafts to read.

const BARS = 24;
const IDLE_HEIGHT = 4;
const MAX_HEIGHT = 44;

function clock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  return `${m}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/** A waveform that scrolls as you speak, so the mic is visibly listening. */
function Waveform({ level, active }: { level: number; active: boolean }) {
  // The animated values are rendered, so they live in state (created once);
  // only the write head, which no render reads, is a ref.
  const [bars] = useState(() => [...Array(BARS)].map(() => new Animated.Value(IDLE_HEIGHT)));
  const write = useRef(0);

  useEffect(() => {
    if (!active) return;
    // newest sample enters at the write head, so the shape travels left to right
    const bar = bars[write.current % BARS]!;
    write.current += 1;
    Animated.timing(bar, {
      toValue: IDLE_HEIGHT + level * (MAX_HEIGHT - IDLE_HEIGHT),
      duration: 110,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [level, active, bars]);

  useEffect(() => {
    if (active) return;
    bars.forEach((b) => b.setValue(IDLE_HEIGHT));
    write.current = 0;
  }, [active, bars]);

  return (
    <View className="h-12 flex-row items-center justify-center gap-[3px]" accessibilityLabel="Microphone level">
      {bars.map((bar, i) => (
        <Animated.View key={i} className="w-[3px] rounded-full bg-primary-500" style={{ height: bar }} />
      ))}
    </View>
  );
}
Waveform.displayName = "Waveform";

/** The record button, breathing with the voice it is hearing. */
function RecordButton({ level, live, onPress }: { level: number; live: boolean; onPress: () => void }) {
  const [halo] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(halo, { toValue: live ? level : 0, duration: 120, useNativeDriver: true }).start();
  }, [level, live, halo]);

  return (
    <View className="items-center justify-center">
      <Animated.View
        pointerEvents="none"
        className="absolute h-24 w-24 rounded-full bg-primary-500"
        style={{
          opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }),
          transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
        }}
      />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={live ? "Stop recording" : "Start recording"}
        className={`h-20 w-20 items-center justify-center rounded-full ${live ? "bg-error-500" : "bg-primary-500"}`}
      >
        <Ionicons name={live ? "stop" : "mic"} size={32} color={ICON_INVERSE} />
      </Pressable>
    </View>
  );
}
RecordButton.displayName = "RecordButton";

/**
 * Rises over whatever is on screen, records, and hands the finished audio back.
 * It never navigates; the caller decides what to do with the recording.
 */
export function VoiceCaptureSheet({
  visible,
  onClose,
  onRecorded,
}: {
  visible: boolean;
  onClose: () => void;
  onRecorded: (recording: Recording) => void;
}) {
  const insets = useSafeAreaInsets();
  const recorder = useVoiceRecorder();
  const live = recorder.isRecording || recorder.isPaused;

  // opening the sheet starts listening: the tap on the mic was the intent
  useEffect(() => {
    if (visible) void recorder.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function finish() {
    const recording = await recorder.stop();
    if (!recording || recording.durationSeconds < 1) {
      onClose();
      return;
    }
    onRecorded(recording);
  }

  function cancel() {
    void recorder.discard();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cancel}>
      <Pressable onPress={cancel} accessibilityLabel="Dismiss" className="flex-1 bg-black-900/40" />
      <View className="rounded-t-3xl bg-surface px-5 pt-3" style={{ paddingBottom: insets.bottom + 20 }}>
        <View className="items-center">
          <View className="h-1 w-10 rounded-full bg-grey-100" />
        </View>

        <View className="flex-row items-center pt-3">
          <Text weight="bold" className="flex-1 text-lg">
            {recorder.isPaused ? "Paused" : live ? "Listening…" : "Voice note"}
          </Text>
          <Pressable
            onPress={cancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel recording"
            className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt"
          >
            <Ionicons name="close" size={22} color={ICON_STRONG} />
          </Pressable>
        </View>

        <Text tone="secondary" className="pb-2 text-[13px]">
          Describe what happened on site. Panda AI drafts the records for you to review.
        </Text>

        <Waveform level={recorder.level} active={recorder.isRecording} />

        <Text weight="bold" className="pb-4 text-center text-3xl tabular-nums">
          {clock(recorder.seconds)}
        </Text>

        <View className="flex-row items-center justify-center gap-8">
          <Pressable
            onPress={() => (recorder.isPaused ? recorder.resume() : recorder.pause())}
            disabled={!live}
            accessibilityRole="button"
            accessibilityLabel={recorder.isPaused ? "Resume" : "Pause"}
            className={`h-14 w-14 items-center justify-center rounded-full bg-surface-alt ${live ? "" : "opacity-40"}`}
          >
            <Ionicons name={recorder.isPaused ? "play" : "pause"} size={22} color={ICON_DEFAULT} />
          </Pressable>

          <RecordButton level={recorder.level} live={live} onPress={() => (live ? void finish() : void recorder.start())} />

          <Pressable
            onPress={() => void finish()}
            disabled={!live || recorder.seconds < 1}
            accessibilityRole="button"
            accessibilityLabel="Finish and review"
            className={`h-14 w-14 items-center justify-center rounded-full bg-primary-50 ${live && recorder.seconds >= 1 ? "" : "opacity-40"}`}
          >
            <Ionicons name="arrow-forward" size={22} color={ICON_BRAND} />
          </Pressable>
        </View>

        {recorder.error ? (
          <Text tone="danger" className="pt-3 text-center text-xs">
            {recorder.error}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}
VoiceCaptureSheet.displayName = "VoiceCaptureSheet";
