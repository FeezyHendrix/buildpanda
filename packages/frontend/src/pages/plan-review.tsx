import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { useProjectDocuments } from "@/hooks/use-documents";
import { useParticipants } from "@/hooks/use-participants";
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
import { MOCK_SHEETS, adaptPlanDocuments, clamp, type Pt, type Sheet } from "./plan-review/plan-review-data";
import { PARTICIPANT_ACTIVE, type Pin } from "./plan-review/plan-review-types";
import { MarkupToolbar } from "./plan-review/plan-review-toolbar";
import { WorkspaceHeader } from "./plan-review/plan-review-header";
import { PlanReviewStatusBar } from "./plan-review/plan-review-status-bar";
import { PlanReviewViewer } from "./plan-review/plan-review-viewer";
import { useMarkupThread } from "./plan-review/use-markup-thread";
import { useMarkupTools, type CommentAnchor } from "./plan-review/use-markup-tools";
import { usePinComments } from "./plan-review/use-pin-comments";
import { useReviewShortcuts } from "./plan-review/use-review-shortcuts";
import { useSheetNavigation } from "./plan-review/use-sheet-navigation";
import { useSheetScale } from "./plan-review/use-sheet-scale";

/** Project drawing review: one canvas, one tool strip, and persisted comment threads. */
export default function DrawingReviewWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedSheetId = searchParams.get("sheet");
  const docsQuery = useProjectDocuments(projectId);
  const sheets = useMemo<Sheet[]>(
    () => (projectId ? adaptPlanDocuments(docsQuery.data ?? [], projectId) : MOCK_SHEETS),
    [projectId, docsQuery.data],
  );
  const [pins, setPins] = useState<Pin[]>([]);
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null);
  const drawingRef = useRef<HTMLDivElement>(null);
  const nav = useSheetNavigation(sheets.length, () => {
    markup.resetTransient();
    scale.setCalibrateOpen(false);
  });
  const activeIndex = clamp(nav.activeSheetIndex, 0, Math.max(0, sheets.length - 1));
  const sheet = sheets[activeIndex] ?? null;
  const canCompare = sheets.length >= 2;
  const comparing = nav.comparing && canCompare;
  const { data: participants = [] } = useParticipants(projectId);
  const assignees = useMemo(
    () =>
      participants
        .filter((p) => p.userId && p.status === PARTICIPANT_ACTIVE)
        .map((p) => ({ id: p.userId!, name: p.name ?? p.email })),
    [participants],
  );
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
  useReviewShortcuts({ nav, markup, onDismiss: () => scale.setCalibrateOpen(false) });

  const appliedRequestedSheet = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedSheetId || appliedRequestedSheet.current === requestedSheetId) return;
    const index = sheets.findIndex((item) => item.id === requestedSheetId);
    if (index < 0) return;
    nav.goTo(index);
    appliedRequestedSheet.current = requestedSheetId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheets, requestedSheetId]);

  function exitWorkspace(): void {
    if (projectId) navigate(`/project/${projectId}/plans`);
    else if (window.history.length > 1) navigate(-1);
    else navigate("/dashboard");
  }

  if (projectId && docsQuery.isPending)
    return (
      <main className="flex h-dvh items-center justify-center bg-white">
        <Spinner size="md" />
      </main>
    );
  if (projectId && docsQuery.isError)
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-white p-6">
        <p className="text-sm text-gray-600">Could not load this project's plans.</p>
        <Button onClick={() => void docsQuery.refetch()} loading={docsQuery.isFetching}>
          Try again
        </Button>
      </main>
    );
  if (!sheet)
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <FileText size={28} className="text-gray-300" />
        <p className="text-base font-semibold text-gray-900">No plans to review yet</p>
        <p className="text-sm text-gray-500">Upload a drawing to start reviewing it.</p>
        {projectId ? (
          <Link to={`/project/${projectId}/plans`} className="text-sm font-semibold text-primary-600">
            Go to Plans
          </Link>
        ) : null}
      </main>
    );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-white font-sans text-gray-900">
      <WorkspaceHeader
        sheets={sheets}
        activeIndex={activeIndex}
        comparing={comparing}
        onSelectSheet={nav.goTo}
        onExit={exitWorkspace}
      />
      <MarkupToolbar
        activeTool={markup.activeTool}
        onSelectTool={(tool) => {
          markup.selectTool(tool);
          scale.setCalibrateOpen(false);
        }}
        markupColor={markup.markupColor}
        onSelectColor={markup.setMarkupColor}
        markupVisible={markup.markupVisible}
        onToggleMarkup={() => markup.setMarkupVisible((visible) => !visible)}
        canCompare={canCompare}
        comparing={comparing}
        onCompare={nav.toggleCompare}
      />
      {!comparing && markupQuery.isError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-2 text-sm text-red-600"
        >
          Could not load annotations.
          <Button variant="ghost" size="sm" loading={markupQuery.isFetching} onClick={() => void markupQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}
      <PlanReviewViewer
        sheet={sheet}
        sheets={sheets}
        nav={nav}
        markup={markup}
        scale={scale}
        drawingRef={drawingRef}
        thread={thread}
        comment={{
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
          onSubmit: (capture) => {
            void comments
              .submitPinComment(capture)
              .catch((error) => toast(getApiErrorMessage(error, "Could not save this comment"), "error"));
          },
        }}
      />
      {!comparing ? (
        <PlanReviewStatusBar
          save={{
            canPersist: Boolean(projectId && sheet.documentVersionId),
            isSaving:
              createMarkup.isPending ||
              addMarkupComment.isPending ||
              deleteMarkup.isPending ||
              thread.actions.resolve.isPending,
            hasError: Boolean(
              createMarkup.error ?? addMarkupComment.error ?? deleteMarkup.error ?? thread.actions.resolve.error,
            ),
            loadError: markupQuery.isError,
            markupLoading: markupQuery.isPending,
          }}
        />
      ) : null}
    </main>
  );
}
