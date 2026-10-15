import { View } from "react-native";
import { Button, PendingBadge, Spinner, Text } from "@/components/atoms";
import { AudioPlayer } from "@/components/molecules/audio-player";
import { RichContent } from "@/components/rich-text/rich-content";
import type { Db } from "@/db/client";
import type { UpdateCommentRow } from "@/db/schema";
import { useUpdateComments } from "@/hooks/use-update-comments";
import { useUpdateAudio } from "@/hooks/use-update-audio";
import { formatDateTime } from "@/lib/dates";
import { features } from "@/lib/feature-access";
import { useProjectAccess } from "@/lib/project-access-provider";
import { CommentComposer } from "./comment-composer";

function CommentAudio({ comment }: { comment: UpdateCommentRow }) {
  const audio = useUpdateAudio(comment);
  return audio.uri ? <AudioPlayer key={audio.key} uri={audio.uri} durationSeconds={comment.audioDurationSeconds ?? 0} /> :
    <Text tone="secondary" className="rounded-xl bg-surface-alt p-3 text-sm">{audio.error || "Loading voice note…"}</Text>;
}

export function CommentThread({ db, projectId, updateId }: { db: Db; projectId: string; updateId: string }) {
  const comments = useUpdateComments(db, projectId, updateId);
  const access = useProjectAccess();
  return <View className="gap-4">
    <View className="flex-row items-center justify-between">
      <Text weight="bold" className="text-base">Comments{comments.data.length ? ` (${comments.data.length})` : ""}</Text>
      <Button variant="ghost" onPress={() => void comments.refresh()} loading={comments.refreshing}>Refresh</Button>
    </View>
    {comments.error ? <Text tone="danger">{comments.error}</Text> : null}
    {comments.isPending ? <Spinner /> : comments.data.length === 0 ? <Text tone="secondary">No comments yet.</Text> : null}
    {comments.data.map((comment) => <View key={comment.id} className="gap-2 rounded-2xl bg-surface p-4">
      <View className="flex-row items-center gap-2">
        <Text weight="semibold" className="flex-1">{comment.authorName}</Text>
        {comment.isPendingSync ? <PendingBadge /> : null}
      </View>
      <Text tone="secondary" className="text-xs">{formatDateTime(comment.createdAt)}</Text>
      {comment.body || comment.bodyHtml ? <RichContent html={comment.bodyHtml} text={comment.body} projectId={projectId} /> : null}
      {comment.audioFileId || comment.stagedAudioUri ? <CommentAudio key={`${comment.id}:${access.generation}`} comment={comment} /> : null}
    </View>)}
    {access.allows(features.updates.actions.comment) ? <CommentComposer key={`${projectId}:${access.generation}`}
      projectId={projectId} updateId={updateId} onPost={comments.add} /> : null}
  </View>;
}
