import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import type { DrawingMarkup } from "@/api/drawing-markup";
import { Spinner, Text } from "@/components/atoms";
import type { MarkupKind } from "./markup-types";

const KIND_LABELS: Record<MarkupKind, string> = {
  pin: "Pin",
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

export function MarkupPanel({
  markup,
  busy,
  onAddComment,
  onResolve,
  onDelete,
  onClose,
}: {
  markup: DrawingMarkup;
  busy: boolean;
  onAddComment: (body: string) => void;
  onResolve: (resolved: boolean) => void;
  onDelete: () => void;
  onClose: () => void;
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
        {!markup.isCurrentRevision ? (
          <View className="rounded-full bg-warning-50 px-2 py-0.5">
            <Text weight="semibold" className="text-[9px] uppercase text-warning-700">
              Superseded sheet
            </Text>
          </View>
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
            <View key={comment.id} className="pb-3">
              <View className="flex-row items-center gap-2">
                <Text weight="semibold" className="text-[13px]">
                  {comment.authorName ?? "Unknown"}
                </Text>
                <Text tone="secondary" className="text-[11px]">
                  {commentTime(comment.createdAt)}
                </Text>
                {comment.mediaKind ? (
                  <View className="flex-row items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5">
                    <Ionicons name={comment.mediaKind === "audio" ? "mic-outline" : "videocam-outline"} size={11} color="#004DE7" />
                    <Text tone="brand" className="text-[10px]">
                      {comment.mediaKind === "audio" ? "Audio" : "Video"}
                      {comment.mediaDurationSeconds ? ` · ${comment.mediaDurationSeconds}s` : ""}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="pt-0.5 text-sm">{comment.body}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <View className="flex-row items-center gap-2 px-4 pb-3 pt-1">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment…"
          placeholderTextColor="#ADADAD"
          multiline
          className="max-h-24 min-h-11 flex-1 rounded-xl bg-surface-alt px-3 py-2.5 text-[15px] text-ink"
          style={{ fontFamily: "PlusJakartaSans_400Regular" }}
        />
        <Pressable
          onPress={send}
          disabled={busy || !draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send comment"
          className={`h-11 w-11 items-center justify-center rounded-full ${draft.trim() && !busy ? "bg-primary-500" : "bg-surface-alt"}`}
        >
          <Ionicons name="send" size={18} color={draft.trim() && !busy ? "#FFFFFF" : "#ADADAD"} />
        </Pressable>
      </View>
    </View>
  );
}
