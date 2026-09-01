import { useState } from "react";
import type { useAddMarkupComment } from "@/hooks/use-drawing-markup";
import type { useCreateApproval } from "@/hooks/use-approvals";
import type { useCreateRfi } from "@/hooks/use-rfis";
import type { useUploadFile } from "@/hooks/use-files";
import { toast } from "@/lib/toast";
import { COMMENT_MODE, FOLLOW_UP, type CommentCapture } from "./plan-review-comment-types";
import { generateId, type Sheet } from "./plan-review-data";
import { NOTE_TYPE, type Note, type Pin } from "./plan-review-types";
import type { CommentAnchor, PersistMarkup } from "./use-markup-tools";

/** Longest slice of the comment body reused as an RFI subject / approval title. */
const FOLLOW_UP_TITLE_CHARS = 80;

interface PinCommentsArgs {
  sheet: Sheet | null;
  projectId: string | undefined;
  /** Writes the pin markup the comment hangs off; from {@link useMarkupTools}. */
  persistMarkup: PersistMarkup;
  setPins: React.Dispatch<React.SetStateAction<Pin[]>>;
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  pendingPinId: string | null;
  setPendingPinId: React.Dispatch<React.SetStateAction<string | null>>;
  commentAnchor: CommentAnchor | null;
  setCommentAnchor: React.Dispatch<React.SetStateAction<CommentAnchor | null>>;
  uploadFile: ReturnType<typeof useUploadFile>;
  addMarkupComment: ReturnType<typeof useAddMarkupComment>;
  createRfi: ReturnType<typeof useCreateRfi>;
  createApproval: ReturnType<typeof useCreateApproval>;
}

export interface PinCommentsController {
  noteDraft: string;
  setNoteDraft: React.Dispatch<React.SetStateAction<string>>;
  /** Persist the pin, attach the captured comment, and raise any follow-up on it. */
  submitPinComment: (capture: CommentCapture) => Promise<void>;
  /** Session-local note from the review-notes composer, optionally tied to a pending pin. */
  submitComment: () => void;
}

/**
 * Comments raised against a point on a sheet: the pin markup they anchor to, the
 * captured text/audio/video, and the RFI or approval a reviewer can raise off the
 * same comment so the drawing stays the system of record for the request.
 */
export function usePinComments({
  sheet,
  projectId,
  persistMarkup,
  setPins,
  setNotes,
  pendingPinId,
  setPendingPinId,
  commentAnchor,
  setCommentAnchor,
  uploadFile,
  addMarkupComment,
  createRfi,
  createApproval,
}: PinCommentsArgs): PinCommentsController {
  const [noteDraft, setNoteDraft] = useState("");

  async function uploadCapturedMedia(capture: CommentCapture): Promise<string | null> {
    if (!capture.mediaBlob || !projectId) return null;
    const extension = capture.mode === COMMENT_MODE.VIDEO ? "webm" : "webm";
    const file = new File([capture.mediaBlob], `${capture.mode}-note-${Date.now()}.${extension}`, {
      type: capture.mediaBlob.type || (capture.mode === COMMENT_MODE.VIDEO ? "video/webm" : "audio/webm"),
    });
    const uploaded = await uploadFile.mutateAsync({ file, projectId });
    return uploaded.id;
  }

  async function raiseFollowUp(capture: CommentCapture, markupId: string): Promise<void> {
    if (!projectId || !sheet?.documentId || !sheet.documentVersionId) return;
    const reference = {
      documentId: sheet.documentId,
      documentVersionId: sheet.documentVersionId,
      sourceMarkupId: markupId,
    };
    if (capture.followUp === FOLLOW_UP.RFI) {
      await createRfi.mutateAsync({
        projectId,
        subject: `${sheet.code} — ${capture.text.slice(0, FOLLOW_UP_TITLE_CHARS)}`,
        question: capture.text,
        ballInCourtId: capture.assigneeId ?? null,
        ...reference,
      });
      toast("RFI raised from this comment", "success");
    } else if (capture.followUp === FOLLOW_UP.APPROVAL) {
      await createApproval.mutateAsync({
        projectId,
        title: `${sheet.code} — ${capture.text.slice(0, FOLLOW_UP_TITLE_CHARS)}`,
        description: capture.text,
        requestedReviewerId: capture.assigneeId ?? null,
        ...reference,
      });
      toast("Approval requested from this comment", "success");
    }
  }

  async function submitPinComment(capture: CommentCapture): Promise<void> {
    const anchor = commentAnchor;
    if (!anchor) return;
    const markupId = await persistMarkup("pin", { kind: "pin", at: anchor.at });
    if (markupId && projectId && sheet?.documentVersionId) {
      const fileId = await uploadCapturedMedia(capture);
      await addMarkupComment.mutateAsync({
        markupId,
        body: capture.text,
        bodyHtml: capture.bodyHtml,
        assigneeId: capture.assigneeId,
        mediaKind: capture.mode === COMMENT_MODE.TEXT ? null : capture.mode,
        fileId,
        mediaDurationSeconds: capture.mediaDurationSeconds,
      });
      await raiseFollowUp(capture, markupId);
    }
    setCommentAnchor(null);
  }

  function submitComment(): void {
    const text = noteDraft.trim();
    if (!text || !sheet) return;
    const pinId = pendingPinId;
    const noteId = generateId("note");
    setNotes((n) => [
      ...n,
      {
        id: noteId,
        type: NOTE_TYPE.COMMENT,
        text,
        author: "You",
        createdAt: Date.now(),
        sheetId: sheet.id,
        pinId,
        durationSeconds: null,
      },
    ]);
    if (pinId) {
      setPins((p) => p.map((pin) => (pin.id === pinId ? { ...pin, noteId } : pin)));
      setPendingPinId(null);
    }
    setNoteDraft("");
  }

  return { noteDraft, setNoteDraft, submitPinComment, submitComment };
}
