import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import type { CommentAssignee } from "@/api/participants";
import { Spinner, Text } from "@/components/atoms";
import { SegmentedTabs, type SegmentedTab } from "@/components/molecules/segmented-tabs";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { MEDIA_KIND, type CommentDraft, type MediaKind } from "./markup-types";

type CommentMode = "text" | "audio" | "video";

const COMMENT_MODE = {
  TEXT: "text",
  AUDIO: "audio",
  VIDEO: "video",
} as const satisfies Record<string, CommentMode>;

const MODES: readonly SegmentedTab<CommentMode>[] = [
  { key: COMMENT_MODE.TEXT, label: "Note" },
  { key: COMMENT_MODE.AUDIO, label: "Audio" },
  { key: COMMENT_MODE.VIDEO, label: "Video" },
] as const;

const NOBODY = "";

interface CapturedMedia {
  kind: MediaKind;
  uri: string;
  durationSeconds: number;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CommentComposer({
  assignees,
  busy,
  onCancel,
  onSubmit,
}: {
  assignees: CommentAssignee[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (draft: CommentDraft) => void;
}) {
  const [mode, setMode] = useState<CommentMode>(COMMENT_MODE.TEXT);
  const [text, setText] = useState("");
  const [assigneeId, setAssigneeId] = useState(NOBODY);
  const [captured, setCaptured] = useState<CapturedMedia | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const recorder = useVoiceRecorder();

  function switchMode(next: CommentMode) {
    setMode(next);
    setCaptured(null);
    setMediaError(null);
  }

  async function stopAudio() {
    const uri = await recorder.stop();
    if (uri) setCaptured({ kind: MEDIA_KIND.AUDIO, uri, durationSeconds: recorder.seconds });
  }

  async function recordVideo() {
    setMediaError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setMediaError("Camera access is off. Enable it in Settings to record a video.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["videos"] });
    const asset = result.assets?.[0];
    if (!asset) return;
    setCaptured({
      kind: MEDIA_KIND.VIDEO,
      uri: asset.uri,
      durationSeconds: Math.round((asset.duration ?? 0) / 1000),
    });
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed && !captured) return;
    onSubmit({
      text:
        trimmed ||
        (captured?.kind === MEDIA_KIND.VIDEO ? "Video note" : "Voice note"),
      mediaKind: captured?.kind ?? null,
      mediaUri: captured?.uri ?? null,
      mediaDurationSeconds: captured?.durationSeconds ?? null,
      assigneeId: assigneeId === NOBODY ? null : assigneeId,
    });
  }

  const canSubmit = Boolean(text.trim() || captured) && !recorder.isRecording && !busy;

  return (
    <View className="border-t border-hairline bg-surface px-4 pb-3 pt-2">
      <View className="flex-row items-center">
        <Text weight="semibold" className="text-[15px]">
          Add comment
        </Text>
        <View className="flex-1" />
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel comment"
          className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt"
        >
          <Ionicons name="close" size={22} color="#5C5C5C" />
        </Pressable>
      </View>

      <SegmentedTabs tabs={MODES} active={mode} onChange={switchMode} />

      <TextInput
        value={text}
        onChangeText={setText}
        autoFocus
        placeholder={mode === COMMENT_MODE.TEXT ? "What needs attention here?" : "Add a caption (optional)"}
        placeholderTextColor="#ADADAD"
        multiline
        className="mt-2 max-h-24 min-h-11 rounded-xl bg-surface-alt px-3 py-2.5 text-[15px] text-ink"
        style={{ fontFamily: "PlusJakartaSans_400Regular" }}
      />

      {mode !== COMMENT_MODE.TEXT ? (
        <View className="mt-2 flex-row items-center gap-2 rounded-xl border border-hairline px-3 py-2">
          {recorder.isRecording ? (
            <Pressable
              onPress={() => void stopAudio()}
              accessibilityRole="button"
              className="h-11 flex-row items-center gap-2 rounded-full bg-error-500 px-4"
            >
              <Ionicons name="stop" size={16} color="#FFFFFF" />
              <Text weight="semibold" className="text-[13px] text-white">
                Stop · {formatClock(recorder.seconds)}
              </Text>
            </Pressable>
          ) : captured ? (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#00753B" />
              <Text weight="semibold" className="text-[13px]">
                {captured.kind === MEDIA_KIND.VIDEO ? "Video" : "Audio"} captured · {formatClock(captured.durationSeconds)}
              </Text>
              <View className="flex-1" />
              <Pressable
                onPress={() => setCaptured(null)}
                accessibilityRole="button"
                accessibilityLabel="Discard recording"
                className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt"
              >
                <Ionicons name="trash-outline" size={18} color="#B3261E" />
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => void (mode === COMMENT_MODE.VIDEO ? recordVideo() : recorder.start())}
              accessibilityRole="button"
              className="h-11 flex-row items-center gap-2 rounded-full bg-primary-500 px-4"
            >
              <Ionicons name={mode === COMMENT_MODE.VIDEO ? "videocam-outline" : "mic-outline"} size={16} color="#FFFFFF" />
              <Text weight="semibold" className="text-[13px] text-white">
                Record {mode === COMMENT_MODE.VIDEO ? "video" : "audio"}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
      {mediaError || recorder.error ? (
        <Text tone="danger" className="pt-1.5 text-xs">
          {mediaError ?? recorder.error}
        </Text>
      ) : null}

      {assignees.length > 0 ? (
        <View className="pt-2">
          <Text tone="secondary" className="pb-1 text-[11px] uppercase">
            Assign to
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {[{ id: NOBODY, name: "Nobody" }, ...assignees].map((person) => {
                const active = assigneeId === person.id;
                return (
                  <Pressable
                    key={person.id || "nobody"}
                    onPress={() => setAssigneeId(person.id)}
                    accessibilityRole="button"
                    className={`h-9 items-center justify-center rounded-full px-3 ${active ? "bg-primary-50" : "bg-surface-alt"}`}
                  >
                    <Text weight="semibold" className={`text-xs ${active ? "text-primary-600" : "text-ink-secondary"}`}>
                      {person.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ) : null}

      <View className="flex-row items-center justify-end gap-2 pt-3">
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          className="h-11 items-center justify-center rounded-full px-4 active:bg-surface-alt"
        >
          <Text weight="semibold" tone="secondary" className="text-[13px]">
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          accessibilityRole="button"
          className={`h-11 flex-row items-center gap-2 rounded-full px-5 ${canSubmit ? "bg-primary-500" : "bg-surface-alt"}`}
        >
          {busy ? <Spinner size="xs" tone="current" /> : null}
          <Text weight="semibold" className={`text-[13px] ${canSubmit ? "text-white" : "text-ink-secondary"}`}>
            Save comment
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
