import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { voiceNoteError } from "@buildpanda/rich-content";
import { request } from "@/api/client";
import { useLocalDb } from "@/db/provider";
import { updateCommentsRepository } from "@/db/update-comments-repository";
import type { UpdateCommentRow } from "@/db/schema";
import { cacheFileById } from "@/lib/download-file";
import { features } from "@/lib/feature-access";
import { loadPendingMedia } from "@/lib/pending-media";
import { requireAccess, requireCurrentAccess } from "@/lib/project-access-store";
import { useProjectAccess } from "@/lib/project-access-provider";
import { useSyncState } from "@/lib/sync-provider";

export function useUpdateAudio(row: UpdateCommentRow) {
  const { db } = useLocalDb();
  const { generation, allows } = useProjectAccess();
  const { isOnline } = useSyncState();
  const [state, setState] = useState({ key: "", uri: "", error: "" });
  const key = `${row.id}:${row.audioFileId}:${row.stagedAudioUri}:${generation}:${isOnline}`;
  useEffect(() => {
    let active = true;
    if (!db || !allows(features.updates.read)) return;
    void (async () => {
      const ticket = requireAccess(row.projectId, features.updates.read);
      if (!updateCommentsRepository.find(db, row.projectId, row.id)) throw new Error("This comment is no longer available.");
      let uri = "";
      if (row.stagedAudioUri) uri = await loadPendingMedia(row.stagedAudioUri);
      else if (row.audioFileId) {
        if (isOnline) {
          const info = await request<{ mimeType: string; sizeBytes: number }>(`/files/${row.audioFileId}`);
          const error = voiceNoteError(info.mimeType, info.sizeBytes);
          if (error) throw new Error(error);
        }
        requireCurrentAccess(ticket);
        if (Platform.OS === "web") {
          if (!isOnline) throw new Error("Connect to listen to this voice note.");
          uri = (await request<{ url: string }>(`/files/${row.audioFileId}/url`)).url;
        } else uri = await cacheFileById(row.audioFileId, "voice-note.m4a", "updates", isOnline);
      }
      requireCurrentAccess(ticket);
      if (active) setState({ key, uri, error: "" });
    })().catch((error: unknown) => { if (active) setState({ key, uri: "", error: error instanceof Error ? error.message : "Voice note unavailable." }); });
    return () => { active = false; };
  }, [db, key, row.projectId, row.id, row.audioFileId, row.stagedAudioUri, isOnline, allows]);
  return state.key === key && allows(features.updates.read) ? state : { key, uri: "", error: "" };
}
