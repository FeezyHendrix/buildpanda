import { useState } from "react";
import { drawingMarkupApi, type DrawingMarkup } from "@/api/drawing-markup";
import { uploadProjectFile } from "@/api/files";
import { MEDIA_KIND, type CommentDraft, type MarkupPoint } from "@/components/plan-review/markup-types";
import { drawingMarkupsRepository } from "@/db/drawing-markups-repository";
import type { Db } from "@/db/client";
import { flushOutbox } from "@/db/outbox";

// What a reviewer does to a markup once it exists: comment on it, resolve it,
// remove it. A comment still needs signal, because its voice or video note is
// uploaded before the comment is written and this app has no local staging for
// media yet; the geometry itself is queued and never lost.

const VOICE_NOTE_FILE = { name: "voice-note.m4a", mime: "audio/m4a" } as const;
const VIDEO_NOTE_FILE = { name: "site-video.mov", mime: "video/quicktime" } as const;

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

    /** A pinned comment: the pin, its media, and the first comment. */
    async submitComment(draft: CommentDraft, at: MarkupPoint, onPlaced: (markupId: string) => void) {
      if (!ctx.sheetId || !ctx.versionId) return;
      await run(async () => {
        let fileId: string | null = null;
        if (draft.mediaUri && draft.mediaKind) {
          const media = draft.mediaKind === MEDIA_KIND.AUDIO ? VOICE_NOTE_FILE : VIDEO_NOTE_FILE;
          fileId = (await uploadProjectFile(ctx.projectId, draft.mediaUri, media.name, media.mime)).id;
        }
        const created = await drawingMarkupApi.create(ctx.projectId, {
          documentId: ctx.sheetId!,
          documentVersionId: ctx.versionId!,
          pageNo: ctx.pageNo,
          kind: "pin",
          geometry: { kind: "pin", at, space: "percent" },
        });
        await drawingMarkupApi.addComment(ctx.projectId, created.id, {
          body: draft.text,
          mediaKind: draft.mediaKind,
          fileId,
          mediaDurationSeconds: draft.mediaDurationSeconds,
          assigneeId: draft.assigneeId,
        });
        await ctx.onChanged();
        onPlaced(created.id);
      }, "Couldn't save that comment.");
    },

    async addComment(markup: DrawingMarkup, body: string) {
      await run(async () => {
        await drawingMarkupApi.addComment(ctx.projectId, markup.id, { body });
        await ctx.onChanged();
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
