import { useState } from "react";
import { randomUUID } from "expo-crypto";
import type { DrawingMarkup } from "@/api/drawing-markup";
import { FOLLOW_UP, type PinCommentDraft } from "@/components/plan-review/comment-composer";
import { MEDIA_KIND, MARKUP_KIND, type MarkupPoint } from "@/components/plan-review/markup-types";
import { drawingMarkupsRepository } from "@/db/drawing-markups-repository";
import type { Db } from "@/db/client";
import { materialApprovalsRepository } from "@/db/material-approvals-repository";
import { flushOutbox } from "@/db/outbox";
import { rfisRepository } from "@/db/rfis-repository";
import { stageMedia } from "@/lib/stage-media";

// What a reviewer does to a markup: comment on it, resolve it, remove it.
// Every one of them is written locally and queued, including a voice or video
// note, which is staged on disk and uploaded when signal returns. Resolving
// and deleting a markup the server already knows about queue against its
// server id; the one thing refused offline is resolving a markup whose own
// create has not landed yet, because there is nothing on the server to resolve.
//
// A pin can also raise an RFI or a material approval. Those are written
// locally too, pointing at the pin's local id; the outbox holds them until the
// pin's own create lands and re-points them at the server id.

/** The web's `${sheet.code} — ${text.slice(0, 80)}` for a follow-up's subject or title. */
const FOLLOW_UP_TITLE_CHARS = 80;

export interface MarkupActionsContext {
  db: Db;
  projectId: string;
  sheetId: string | undefined;
  versionId: string | null;
  /** The drawing number shown on the strip; it leads the follow-up's subject. */
  sheetCode: string;
  pageNo: number;
  onChanged: () => Promise<void> | void;
  onError: (message: string) => void;
}

/** The RFI or approval the note asked for, written against the pin it came from. */
async function raiseFollowUp(ctx: MarkupActionsContext, draft: PinCommentDraft, markupId: string): Promise<void> {
  if (draft.followUp === FOLLOW_UP.NONE || !ctx.sheetId || !ctx.versionId) return;
  const heading = `${ctx.sheetCode} — ${draft.text.slice(0, FOLLOW_UP_TITLE_CHARS)}`;
  const reference = {
    documentId: ctx.sheetId,
    documentVersionId: ctx.versionId,
    sourceMarkupId: markupId,
  };
  if (draft.followUp === FOLLOW_UP.RFI) {
    await rfisRepository.createLocal(ctx.db, ctx.projectId, {
      subject: heading,
      question: draft.text,
      ballInCourtId: draft.assigneeId,
      ballInCourtName: draft.assigneeName,
      ...reference,
    });
    return;
  }
  await materialApprovalsRepository.createLocal(ctx.db, ctx.projectId, {
    title: heading,
    // the route insists on a material; the note is the best name the site has for it
    materialName: draft.text.slice(0, FOLLOW_UP_TITLE_CHARS),
    description: draft.text,
    requestedReviewerId: draft.assigneeId,
    requestedReviewerName: draft.assigneeName,
    ...reference,
  });
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

    /** A pinned comment: the pin, its note, any recording, and any follow-up, all queued. */
    async submitComment(draft: PinCommentDraft, at: MarkupPoint, onPlaced: (markupId: string) => void) {
      if (!ctx.sheetId || !ctx.versionId) return;
      await run(async () => {
        const markupId = await drawingMarkupsRepository.createLocal(ctx.db, {
          projectId: ctx.projectId,
          documentId: ctx.sheetId!,
          documentVersionId: ctx.versionId!,
          pageNo: ctx.pageNo,
          kind: MARKUP_KIND.PIN,
          geometry: { kind: "pin", at, space: "percent" },
          color: draft.color,
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
        await raiseFollowUp(ctx, draft, markupId);
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

    /** Resolved or reopened on the device first; the server hears when there is signal. */
    async setResolved(markup: DrawingMarkup, resolved: boolean) {
      await run(async () => {
        await drawingMarkupsRepository.setResolvedLocal(ctx.db, ctx.projectId, markup.id, resolved);
        await ctx.onChanged();
        void flushOutbox(ctx.db).then(() => ctx.onChanged());
      }, "Couldn't update that markup.");
    },

    /** Gone from the sheet at once; a server-known markup has its delete queued. */
    async remove(markup: DrawingMarkup, onRemoved: () => void) {
      await run(async () => {
        await drawingMarkupsRepository.deleteLocal(ctx.db, ctx.projectId, markup.id);
        await ctx.onChanged();
        onRemoved();
        void flushOutbox(ctx.db).then(() => ctx.onChanged());
      }, "Couldn't delete that markup.");
    },

    /** Push anything queued, then reread. */
    async sync() {
      await flushOutbox(ctx.db);
      await ctx.onChanged();
    },
  };
}
