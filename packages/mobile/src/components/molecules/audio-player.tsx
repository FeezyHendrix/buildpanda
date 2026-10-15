import Ionicons from "@expo/vector-icons/Ionicons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/atoms";
import { ICON_INVERSE } from "@/constants/colors";

export function audioTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Unmounting on an access/scope change disposes the player and stops playback. */
export function AudioPlayer({ uri, durationSeconds }: { uri: string; durationSeconds: number }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState("");
  async function toggle() {
    setError("");
    try {
      if (status.playing) player.pause();
      else {
        if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) await player.seekTo(0);
        player.play();
      }
    } catch { setError("Could not play this recording. Try again."); }
  }
  return <View className="gap-2 rounded-xl bg-surface-alt p-3">
    <View className="flex-row items-center gap-3">
      <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"}
        onPress={() => void toggle()} className="h-11 w-11 items-center justify-center rounded-full bg-primary-500">
        <Ionicons name={status.playing ? "pause" : "play"} color={ICON_INVERSE} size={20} />
      </Pressable>
      <View className="flex-1 gap-1">
        <Text weight="semibold" className="text-sm">Voice note</Text>
        <Text tone="secondary" className="text-xs">{audioTime(status.currentTime)} / {audioTime(status.duration || durationSeconds)}</Text>
      </View>
    </View>
    {error ? <Text tone="danger" className="text-xs">{error}</Text> : null}
  </View>;
}
