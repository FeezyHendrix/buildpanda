import Ionicons from "@expo/vector-icons/Ionicons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import type { DrawingMarkup, DrawingMarkupComment } from "@/api/drawing-markup";
import { Spinner, Text } from "@/components/atoms";
import { cacheFileById } from "@/lib/download-file";
import { MEDIA_KIND, type MarkupKind } from "./markup-types";

const KIND_LABELS: Record<MarkupKind, string> = {
  pin: "Comment",
  pen: "Sketch",
  cloud: "Cloud",
  measure: "Measurement",
};

function commentTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function mediaClock(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return ` · ${m}:${String(s).padStart(2, "0")}`;
}

function AudioCommentControl({
  comment,
  onError,
}: {
  comment: DrawingMarkupComment;
  onError: (message: string) => void;
}) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!comment.fileId) return;
    if (status.playing) {
      player.pause();
      return;
    }
    if (loadedUri) {
      player.play();
      return;
    }
    setLoading(true);
    try {
      const uri = await cacheFileById(comment.fileId, `${comment.id}.m4a`);
      player.replace(uri);
      setLoadedUri(uri);
      player.play();
    } catch (err) {
      console.error("audio comment load failed", err);
      onError("Couldn't load that voice note. Try again when you have signal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Pressable
      onPress={() => void toggle()}
      accessibilityRole="button"
      accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"}
      className="mt-1 h-11 flex-row items-center gap-2 self-start rounded-full bg-primary-50 px-4"
    >
      {loading ? (
        <Spinner size="xs" />
      ) : (
        <Ionicons name={status.playing ? "pause" : "play"} size={16} color="#004DE7" />
      )}
      <Text weight="semibold" tone="brand" className="text-[13px]">
        Voice note{mediaClock(comment.mediaDurationSeconds)}
      </Text>
    </Pressable>
  );
}

function VideoCommentControl({
  comment,
  onError,
}: {
  comment: DrawingMarkupComment;
  onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function open() {
    if (!comment.fileId) return;
    setLoading(true);
    try {
      const uri = await cacheFileById(comment.fileId, `${comment.id}.mov`);
      router.push(
        `/tools/documents/view?uri=${encodeURIComponent(uri)}&name=${encodeURIComponent("Video note")}` as never,
      );
    } catch (err) {
      console.error("video comment load failed", err);
      onError("Couldn't load that video. Try again when you have signal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Pressable
      onPress={() => void open()}
      accessibilityRole="button"
      accessibilityLabel="Play video note"
      className="mt-1 h-11 flex-row items-center gap-2 self-start rounded-full bg-primary-50 px-4"
    >
      {loading ? <Spinner size="xs" /> : <Ionicons name="videocam" size={16} color="#004DE7" />}
      <Text weight="semibold" tone="brand" className="text-[13px]">
        Video note{mediaClock(comment.mediaDurationSeconds)}
      </Text>
    </Pressable>
  );
}

function CommentRow({
  comment,
  onError,
}: {
  comment: DrawingMarkupComment;
  onError: (message: string) => void;
}) {
  return (
    <View className="pb-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text weight="semibold" className="text-[13px]">
          {comment.authorName ?? "Unknown"}
        </Text>
        <Text tone="secondary" className="text-[11px]">
          {commentTime(comment.createdAt)}
        </Text>
        {comment.assigneeName ? (
          <View className="flex-row items-center gap-1 rounded-full bg-surface-alt px-2 py-0.5">
            <Ionicons name="person-outline" size={10} color="#5C5C5C" />
            <Text tone="secondary" className="text-[10px]">
              {comment.assigneeName}
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="pt-0.5 text-sm">{comment.body}</Text>
      {comment.mediaKind === MEDIA_KIND.AUDIO ? (
        <AudioCommentControl comment={comment} onError={onError} />
      ) : null}
      {comment.mediaKind === MEDIA_KIND.VIDEO ? (
        <VideoCommentControl comment={comment} onError={onError} />
      ) : null}
    </View>
  );
}

export function MarkupPanel({
  markup,
  busy,
  onAddComment,
  onResolve,
  onDelete,
  onClose,
  onError,
}: {
  markup: DrawingMarkup;
  busy: boolean;
  onAddComment: (body: string) => void;
  onResolve: (resolved: boolean) => void;
  onDelete: () => void;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const resolved = Boolean(markup.resolvedAt);

  function send() {
    const body = draft.trim();
    if (!body || busy) return;
    onAddComment(body);
    setDraft("");
  }

  return (
    <View className="border-t border-hairline bg-surface">
      <View className="flex-row items-center gap-2 px-4 pt-3">
        <View className="h-3 w-3 rounded-full" style={{ backgroundColor: markup.color }} />
        <Text weight="semibold" className="text-[15px]">
          {KIND_LABELS[markup.kind]}
        </Text>
        {markup.revisionLabel ? (
          <Text tone="secondary" className="text-xs">
            {markup.revisionLabel}
          </Text>
        ) : null}
        {resolved ? (
          <View className="rounded-full bg-success-50 px-2 py-0.5">
            <Text weight="semibold" tone="brand" className="text-[9px] uppercase">
              Resolved
            </Text>
          </View>
        ) : null}
        <View className="flex-1" />
        {busy ? <Spinner size="xs" /> : null}
        <Pressable
          onPress={() => onResolve(!resolved)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={resolved ? "Reopen markup" : "Resolve markup"}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt"
        >
          <Ionicons name={resolved ? "refresh-outline" : "checkmark-circle-outline"} size={22} color="#00753B" />
        </Pressable>
        <Pressable
          onPress={onDelete}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Delete markup"
          className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt"
        >
          <Ionicons name="trash-outline" size={20} color="#B3261E" />
        </Pressable>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close markup panel"
          className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt"
        >
          <Ionicons name="close" size={22} color="#5C5C5C" />
        </Pressable>
      </View>

      <Text tone="secondary" className="px-4 pt-1 text-xs">
        {markup.authorName ?? "Unknown"} · {commentTime(markup.createdAt)}
      </Text>

      <ScrollView className="max-h-44 px-4 pt-2" keyboardShouldPersistTaps="handled">
        {markup.comments.length === 0 ? (
          <Text tone="secondary" className="pb-2 text-[13px]">
            No comments yet.
          </Text>
        ) : (
          markup.comments.map((comment) => (
            <CommentRow key={comment.id} comment={comment} onError={onError} />
          ))
        )}
      </ScrollView>

      <View className="flex-row items-center gap-2 px-4 pb-3 pt-1">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Reply…"
          placeholderTextColor="#ADADAD"
          multiline
          className="max-h-24 min-h-11 flex-1 rounded-xl bg-surface-alt px-3 py-2.5 text-[15px] text-ink"
          style={{ fontFamily: "PlusJakartaSans_400Regular" }}
        />
        <Pressable
          onPress={send}
          disabled={busy || !draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send reply"
          className={`h-11 w-11 items-center justify-center rounded-full ${draft.trim() && !busy ? "bg-primary-500" : "bg-surface-alt"}`}
        >
          <Ionicons name="send" size={18} color={draft.trim() && !busy ? "#FFFFFF" : "#ADADAD"} />
        </Pressable>
      </View>
    </View>
  );
}
