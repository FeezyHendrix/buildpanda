import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import type { CommentAssignee } from "@/api/participants";
import { Button, OptionRow, Text } from "@/components/atoms";
import { ICON_DANGER, ICON_INVERSE, ICON_STRONG, ICON_SUBTLE, ICON_SUCCESS } from "@/constants/colors";
import { SegmentedTabs, type SegmentedTab } from "@/components/molecules/segmented-tabs";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { VoiceNote } from "./voice-note";
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
    if (next === mode) return;
    // leaving a mode mid-recording must not leave the mic running
    void recorder.discard();
    setMode(next);
    setCaptured(null);
    setMediaError(null);
  }

  function cancel() {
    void recorder.discard();
    onCancel();
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
          onPress={cancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel comment"
          className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt"
        >
          <Ionicons name="close" size={22} color={ICON_STRONG} />
        </Pressable>
      </View>

      <SegmentedTabs tabs={MODES} active={mode} onChange={switchMode} />

      <TextInput
        value={text}
        onChangeText={setText}
        autoFocus={mode === COMMENT_MODE.TEXT}
        placeholder={mode === COMMENT_MODE.TEXT ? "What needs attention here?" : "Add a caption (optional)"}
        placeholderTextColor={ICON_SUBTLE}
        multiline
        className="mt-2 max-h-24 min-h-11 rounded-xl bg-surface-alt px-3 py-2.5 text-[15px] text-black-500"
        style={{ fontFamily: "PlusJakartaSans_400Regular" }}
      />

      {mode === COMMENT_MODE.AUDIO ? (
        <View className="mt-2">
          <VoiceNote
            recorder={recorder}
            captured={captured?.kind === MEDIA_KIND.AUDIO ? { uri: captured.uri, durationSeconds: captured.durationSeconds } : null}
            onCaptured={(audio) => setCaptured({ kind: MEDIA_KIND.AUDIO, ...audio })}
            onDiscard={() => setCaptured(null)}
          />
        </View>
      ) : mode === COMMENT_MODE.VIDEO ? (
        <View className="mt-2 flex-row items-center gap-2 rounded-xl border border-hairline px-3 py-2">
          {captured ? (
            <>
              <Ionicons name="checkmark-circle" size={18} color={ICON_SUCCESS} />
              <Text weight="semibold" className="text-[13px]">
                Video captured · {formatClock(captured.durationSeconds)}
              </Text>
              <View className="flex-1" />
              <Pressable
                onPress={() => setCaptured(null)}
                accessibilityRole="button"
                accessibilityLabel="Discard the video"
                className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt"
              >
                <Ionicons name="trash-outline" size={18} color={ICON_DANGER} />
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => void recordVideo()}
              accessibilityRole="button"
              className="min-h-14 flex-row items-center gap-2 rounded-full bg-primary-500 px-5"
            >
              <Ionicons name="videocam-outline" size={16} color={ICON_INVERSE} />
              <Text weight="semibold" className="text-[13px] text-white">
                Record video
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
        <View className="pt-3">
          <OptionRow
            label="Assign to"
            options={[
              { value: NOBODY, label: "Nobody" },
              ...assignees.map((person) => ({ value: person.id, label: person.name })),
            ]}
            value={assigneeId}
            onChange={setAssigneeId}
          />
        </View>
      ) : null}

      <View className="flex-row items-center gap-2 pt-3">
        <Button variant="ghost" onPress={cancel} className="flex-1">
          Cancel
        </Button>
        <Button onPress={submit} disabled={!canSubmit} loading={busy} className="flex-1">
          Save comment
        </Button>
      </View>
    </View>
  );
}
