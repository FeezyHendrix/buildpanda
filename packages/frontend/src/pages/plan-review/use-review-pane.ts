import { useCallback, useEffect, useRef, useState } from "react";
import { useCreateRfi } from "@/hooks/use-rfis";
import { useCreateApproval } from "@/hooks/use-approvals";
import { useUploadFile } from "@/hooks/use-files";
import {
  useAddMarkupComment,
  useCreateDrawingMarkup,
  useDeleteDrawingMarkup,
  useDrawingMarkups,
} from "@/hooks/use-drawing-markup";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import type { CommentAssignee, CommentCapture } from "@/lib/markup-meta";
import { clamp, type Pt, type Sheet } from "./plan-review-data";
import type { Pin } from "./plan-review-types";
import { useMarkupThread } from "./use-markup-thread";
import { useMarkupTools, type CommentAnchor } from "./use-markup-tools";
import { usePinComments } from "./use-pin-comments";
import { useReviewShortcuts } from "./use-review-shortcuts";
import { useSheetNavigation } from "./use-sheet-navigation";
import { useSheetScale } from "./use-sheet-scale";
import type { ReviewTools } from "./use-review-tools";

export interface ReviewPaneContext {
  sheets: Sheet[];
  projectId: string | undefined;
  assignees: CommentAssignee[];
  tools: ReviewTools;
}

/** Each pane owns its document/page anchor, drafts, threads and mutations. */
export function useReviewPane(
  { sheets, projectId, assignees, tools }: ReviewPaneContext,
  initialIndex = 0,
  active = true,
) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null);
  const drawingRef = useRef<HTMLDivElement>(null);
  const nav = useSheetNavigation(
    sheets.length,
    () => {
      markup.resetTransient();
      scale.setCalibrateOpen(false);
    },
    initialIndex,
  );
  const activeIndex = clamp(nav.activeSheetIndex, 0, Math.max(0, sheets.length - 1));
  const sheet = sheets[activeIndex] ?? null;
  const markupQuery = useDrawingMarkups(projectId, sheet?.documentVersionId, nav.pdfPage);
  const createMarkup = useCreateDrawingMarkup(projectId);
  const addMarkupComment = useAddMarkupComment(projectId);
  const deleteMarkup = useDeleteDrawingMarkup(projectId);
  const uploadFile = useUploadFile();
  const createRfi = useCreateRfi();
  const createApproval = useCreateApproval();
  const thread = useMarkupThread({ projectId, assignees, addComment: addMarkupComment, remove: deleteMarkup });
  const scale = useSheetScale(nav.setPdfPageCount);
  const pointFromEvent = useCallback((event: { clientX: number; clientY: number }): Pt | null => {
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }, []);
  const markup = useMarkupTools({
    sheet,
    projectId,
    pageNo: nav.pdfPage,
    drawingRef,
    pointFromEvent,
    markupQuery,
    createMarkup,
    deleteMarkup,
    pins,
    setPins,
    setCommentAnchor,
    setThreadTarget: thread.setTarget,
    tools,
  });
  const comments = usePinComments({
    sheet,
    projectId,
    persistMarkup: markup.persistMarkup,
    commentAnchor,
    setCommentAnchor,
    uploadFile,
    addMarkupComment,
    createRfi,
    createApproval,
  });
  useReviewShortcuts({ nav, markup, enabled: active, onDismiss: () => scale.setCalibrateOpen(false) });

  // Switching tools or documents discards unfinished gestures, never saved marks.
  useEffect(() => {
    markup.resetTransient();
    scale.setCalibrateOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools.activeTool, tools.markupVisible, sheet?.documentVersionId]);
  useEffect(() => {
    if (!active) {
      markup.resetTransient();
      scale.setCalibrateOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return {
    sheet,
    activeIndex,
    nav,
    markup,
    scale,
    drawingRef,
    thread,
    markupQuery,
    comment: {
      anchor: commentAnchor,
      assignees,
      projectId,
      busy:
        createMarkup.isPending ||
        addMarkupComment.isPending ||
        uploadFile.isPending ||
        createRfi.isPending ||
        createApproval.isPending,
      onCancel: () => setCommentAnchor(null),
      onSubmit: (capture: CommentCapture) => {
        void comments
          .submitPinComment(capture)
          .catch((error) => toast(getApiErrorMessage(error, "Could not save this comment"), "error"));
      },
    },
    save: {
      canPersist: Boolean(projectId && sheet?.documentVersionId),
      isSaving:
        createMarkup.isPending ||
        addMarkupComment.isPending ||
        deleteMarkup.isPending ||
        thread.actions.resolve.isPending ||
        uploadFile.isPending ||
        createRfi.isPending ||
        createApproval.isPending,
      hasError: Boolean(
        createMarkup.error ??
          addMarkupComment.error ??
          deleteMarkup.error ??
          thread.actions.resolve.error ??
          uploadFile.error ??
          createRfi.error ??
          createApproval.error,
      ),
      loadError: markupQuery.isError,
      markupLoading: markupQuery.isPending,
    },
  };
}
export type ReviewPane = ReturnType<typeof useReviewPane>;
