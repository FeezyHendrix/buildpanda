import { useState } from "react";
import { randomUUID } from "expo-crypto";
import { drawingMarkupApi, type DrawingMarkup } from "@/api/drawing-markup";
import { MEDIA_KIND, MARKUP_KIND, type CommentDraft, type MarkupPoint } from "@/components/plan-review/markup-types";
import { drawingMarkupsRepository } from "@/db/drawing-markups-repository";
import type { Db } from "@/db/client";
import { flushOutbox } from "@/db/outbox";
import { stageMedia } from "@/lib/stage-media";

// What a reviewer does to a markup: comment on it, resolve it, remove it.
// Everything a crew member creates is written locally and queued, including a
// voice or video note, which is staged on disk and uploaded when signal
// returns. Resolving and deleting a markup the server already knows about
// still need a connection, because they act on the server's own record.

export interface MarkupActionsContext {
  db: Db;
  projectId: string;
  sheetId: string | undefined;
  versionId: string | null;
  pageNo: number;
  onChanged: () => Promise<void> | void;
  onError: (message: string) => void;
}

function messageFor(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function useMarkupActions(ctx: MarkupActionsContext) {
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      console.error(fallback, err);
      ctx.onError(messageFor(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,

    /** A pinned comment: the pin, its note, and any recording, all queued. */
    async submitComment(draft: CommentDraft, at: MarkupPoint, onPlaced: (markupId: string) => void) {
      if (!ctx.sheetId || !ctx.versionId) return;
      await run(async () => {
        const markupId = await drawingMarkupsRepository.createLocal(ctx.db, {
          projectId: ctx.projectId,
          documentId: ctx.sheetId!,
          documentVersionId: ctx.versionId!,
          pageNo: ctx.pageNo,
          kind: MARKUP_KIND.PIN,
          geometry: { kind: "pin", at, space: "percent" },
        });
        // the recording is copied somewhere durable now; it uploads when there is signal
        const staged =
          draft.mediaUri && draft.mediaKind
            ? stageMedia(draft.mediaUri, randomUUID(), draft.mediaKind === MEDIA_KIND.AUDIO ? "voice-note.m4a" : "site-video.mov")
            : null;
        await drawingMarkupsRepository.addCommentLocal(ctx.db, markupId, ctx.projectId, {
          body: draft.text,
          mediaKind: draft.mediaKind,
          stagedMediaUri: staged,
          mediaDurationSeconds: draft.mediaDurationSeconds,
          assigneeId: draft.assigneeId,
        });
        await ctx.onChanged();
        onPlaced(markupId);
        void flushOutbox(ctx.db).then(() => ctx.onChanged());
      }, "Couldn't save that comment.");
    },

    async addComment(markup: DrawingMarkup, body: string) {
      await run(async () => {
        await drawingMarkupsRepository.addCommentLocal(ctx.db, markup.id, ctx.projectId, { body });
        await ctx.onChanged();
        void flushOutbox(ctx.db).then(() => ctx.onChanged());
      }, "Couldn't post that comment.");
    },

    async setResolved(markup: DrawingMarkup, resolved: boolean) {
      await run(async () => {
        await drawingMarkupApi.setResolved(ctx.projectId, markup.id, resolved);
        await ctx.onChanged();
      }, "Couldn't update that markup.");
    },

    /** A markup that never reached the server is dropped locally with its queued push. */
    async remove(markup: DrawingMarkup, onRemoved: () => void) {
      await run(async () => {
        if (markup.id.startsWith("local_")) await drawingMarkupsRepository.removeLocal(ctx.db, markup.id);
        else await drawingMarkupApi.remove(ctx.projectId, markup.id);
        await ctx.onChanged();
        onRemoved();
      }, "Couldn't delete that markup.");
    },

    /** Push anything queued, then reread. */
    async sync() {
      await flushOutbox(ctx.db);
      await ctx.onChanged();
    },
  };
}
