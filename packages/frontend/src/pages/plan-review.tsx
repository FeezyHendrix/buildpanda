/*
 * Drawing Review Workspace.
 * Inside a project (/project/:projectId/plans/review) it reviews the
 * project's uploaded plan documents; without a project it falls back to
 * bundled demo sheets. Markup, notes and recordings are session-local.
 * Production expansion points: persist markup/notes via the documents
 * module, stored recordings with real audio capture, session identity,
 * collaboration, calibrated sheet scales, permissions and audit trail.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FileText } from "lucide-react";
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
import {
  MOCK_SHEETS,
  adaptPlanDocuments,
  clamp,
  generateId,
  type Pt,
  type Sheet,
} from "./plan-review/plan-review-data";
import {
  NOTE_TYPE,
  PARTICIPANT_ACTIVE,
  POPOVER,
  sheetAt,
  type Note,
  type Pin,
  type PopoverId,
} from "./plan-review/plan-review-types";
import { ReviewNotesPanel } from "./plan-review/plan-review-notes-panel";
import { MarkupToolbar } from "./plan-review/plan-review-toolbar";
import { WorkspaceHeader } from "./plan-review/plan-review-header";
import { PlanReviewStatusBar } from "./plan-review/plan-review-status-bar";
import { PlanReviewViewer } from "./plan-review/plan-review-viewer";
import { useMarkupTools, type CommentAnchor } from "./plan-review/use-markup-tools";
import { usePinComments } from "./plan-review/use-pin-comments";
import { usePlanRecording } from "./plan-review/use-plan-recording";
import { useReviewShortcuts } from "./plan-review/use-review-shortcuts";
import { useSheetNavigation } from "./plan-review/use-sheet-navigation";
import { useSheetScale } from "./plan-review/use-sheet-scale";

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

  const [isFavorite, setIsFavorite] = useState(false);
  const [openPopover, setOpenPopover] = useState<PopoverId | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pins, setPins] = useState<Pin[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [pendingPinId, setPendingPinId] = useState<string | null>(null);
  const [notesPanelOpen, setNotesPanelOpen] = useState(true);
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null);

  const drawingRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const nav = useSheetNavigation(sheets.length, () => {
    markup.resetTransient();
  });

  const hasSheets = sheets.length > 0;
  const canCompare = sheets.length >= 2;
  const sheet = hasSheets ? sheetAt(sheets, nav.activeSheetIndex) : null;
  const compareSheet = hasSheets ? sheetAt(sheets, nav.compareSheetIndex) : null;
  const currentRevision = sheet ? (nav.sheetRevisions[sheet.id] ?? sheet.revision) : "";

  const { data: participants = [] } = useParticipants(projectId);
  const assignees = useMemo(
    () =>
      participants
        .filter((p) => p.userId && p.status === PARTICIPANT_ACTIVE)
        .map((p) => ({ id: p.userId!, name: p.name ?? p.email })),
    [participants],
  );

  const versionId = sheet?.documentVersionId ?? null;
  const markupQuery = useDrawingMarkups(projectId, versionId, nav.pdfPage);
  const createMarkup = useCreateDrawingMarkup(projectId);
  const addMarkupComment = useAddMarkupComment(projectId);
  const deleteMarkup = useDeleteDrawingMarkup(projectId);
  const uploadFile = useUploadFile();
  const createRfi = useCreateRfi();
  const createApproval = useCreateApproval();

  const scale = useSheetScale(nav.setPdfPageCount);

  const pointFromEvent = useCallback((e: { clientX: number; clientY: number }): Pt | null => {
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }, []);

  const recording = usePlanRecording({
    pointFromEvent,
    onStart: () => {
      setNotes((n) => n.filter((note) => note.type !== NOTE_TYPE.RECORDING));
      setOpenPopover(null);
    },
    onStop: (durationSeconds) => {
      if (!sheet) return;
      setNotes((n) => [
        ...n,
        {
          id: generateId("note"),
          type: NOTE_TYPE.RECORDING,
          text: `Walkthrough of ${sheet.code}`,
          author: "You",
          createdAt: Date.now(),
          sheetId: sheet.id,
          pinId: null,
          durationSeconds,
        },
      ]);
    },
    onClear: () => setNotes((n) => n.filter((note) => note.type !== NOTE_TYPE.RECORDING)),
  });

  const markup = useMarkupTools({
    sheet,
    projectId,
    pageNo: nav.pdfPage,
    drawingRef,
    pointFromEvent,
    captureTrace: recording.captureTrace,
    markupQuery,
    createMarkup,
    deleteMarkup,
    pins,
    setPins,
    setNotes,
    pendingPinId,
    setPendingPinId,
    setCommentAnchor,
  });

  const comments = usePinComments({
    sheet,
    projectId,
    persistMarkup: markup.persistMarkup,
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
  });

  const commentCount = notes.filter((n) => n.type === NOTE_TYPE.COMMENT).length;
  const recordingCount = notes.filter((n) => n.type === NOTE_TYPE.RECORDING).length;
  const orderedNotes = useMemo(() => [...notes].sort((a, b) => b.createdAt - a.createdAt), [notes]);

  useEffect(() => {
    nav.setActiveSheetIndex((i) => clamp(i, 0, Math.max(0, sheets.length - 1)));
    nav.setCompareSheetIndex((i) => clamp(i, 0, Math.max(0, sheets.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheets.length]);

  const appliedRequestedSheet = useRef(false);
  useEffect(() => {
    if (appliedRequestedSheet.current || !requestedSheetId || sheets.length === 0) return;
    const index = sheets.findIndex((s) => s.id === requestedSheetId);
    if (index >= 0) nav.setActiveSheetIndex(index);
    appliedRequestedSheet.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheets, requestedSheetId]);

  useReviewShortcuts({ nav, markup, openPopover, setOpenPopover });

  useEffect(() => {
    if (openPopover === POPOVER.SEARCH) searchRef.current?.focus();
    else if (searchQuery) setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPopover]);

  function openBlendPanel(): void {
    nav.openBlend();
    setOpenPopover(null);
  }

  function exitWorkspace(): void {
    if (projectId) navigate(`/project/${projectId}/plans`);
    else if (window.history.length > 1) navigate(-1);
    else navigate("/dashboard");
  }

  // ── Search ──
  const query = searchQuery.trim().toLowerCase();
  const sheetResults = query
    ? sheets
        .map((s, index) => ({ ...s, index }))
        .filter((s) => s.code.toLowerCase().includes(query) || s.title.toLowerCase().includes(query))
    : [];
  const noteResults = query ? notes.filter((n) => n.text.toLowerCase().includes(query)) : [];
  const resultCount = sheetResults.length + noteResults.length;

  if (projectId && docsQuery.isPending) {
    return (
      <main className="flex h-dvh items-center justify-center bg-white">
        <Spinner size="md" />
      </main>
    );
  }

  if (!hasSheets || !sheet) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <FileText size={28} className="text-gray-300" />
        <p className="text-base font-semibold text-gray-900">No plans to review yet</p>
        <p className="max-w-sm text-sm text-gray-500">
          Upload drawings to the Plans page and they&apos;ll open here for markup, comparison and walkthroughs.
        </p>
        {projectId && (
          <Link
            to={`/project/${projectId}/plans`}
            className="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Go to Plans
          </Link>
        )}
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-white font-sans text-gray-900">
      <WorkspaceHeader
        sheet={sheet}
        currentRevision={currentRevision}
        scaleLabel={scale.labelFor(sheet.id)}
        popover={{ open: openPopover, onOpen: setOpenPopover }}
        nav={{ activeIndex: nav.activeSheetIndex, count: sheets.length, onGo: nav.goTo }}
        revision={{
          onSelect: (rev) => {
            nav.setSheetRevisions((r) => ({ ...r, [sheet.id]: rev }));
            setOpenPopover(null);
          },
        }}
        favorite={{ active: isFavorite, onToggle: () => setIsFavorite((f) => !f) }}
        markupVisible={markup.markupVisible}
        onToggleMarkup={() => {
          markup.setMarkupVisible((v) => !v);
          setOpenPopover(null);
        }}
        compare={{
          can: canCompare,
          onBlend: openBlendPanel,
          splitOpen: nav.split.open,
          onToggleSplit: () => {
            nav.setSplit((s) => ({ ...s, open: !s.open }));
            setOpenPopover(null);
          },
        }}
        search={{
          query: searchQuery,
          trimmed: searchQuery.trim(),
          onQueryChange: setSearchQuery,
          inputRef: searchRef,
          sheetResults,
          noteResults,
          resultCount,
          sheetCodeFor: (sheetId) => sheets.find((s) => s.id === sheetId)?.code ?? "",
          onGoToSheet: nav.goTo,
          onGoToSheetById: (sheetId) => {
            const index = sheets.findIndex((s) => s.id === sheetId);
            if (index >= 0) nav.goTo(index);
          },
        }}
        onRecordStart={recording.start}
        onExit={exitWorkspace}
      />

      <MarkupToolbar
        activeTool={markup.activeTool}
        onSelectTool={markup.selectTool}
        markupColor={markup.markupColor}
        onSelectColor={(color) => {
          markup.setMarkupColor(color);
          setOpenPopover(null);
        }}
        colorOpen={openPopover === POPOVER.COLOR}
        onToggleColor={() => setOpenPopover(openPopover === POPOVER.COLOR ? null : POPOVER.COLOR)}
        measuring={markup.measureStart !== null}
        canCompare={canCompare}
        onCompare={openBlendPanel}
      />

      {/* ── Workspace ── */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <PlanReviewViewer
          sheet={sheet}
          sheets={sheets}
          compareSheet={compareSheet}
          currentRevision={currentRevision}
          canCompare={canCompare}
          nav={nav}
          markup={markup}
          scale={scale}
          recording={recording}
          drawingRef={drawingRef}
          popover={{ open: openPopover, onOpen: setOpenPopover }}
          comment={{
            anchor: commentAnchor,
            assignees,
            projectId,
            busy: createMarkup.isPending || addMarkupComment.isPending || uploadFile.isPending,
            onCancel: () => setCommentAnchor(null),
            onSubmit: (capture) => void comments.submitPinComment(capture),
          }}
        />

        <ReviewNotesPanel
          open={notesPanelOpen}
          onToggle={() => setNotesPanelOpen((o) => !o)}
          notes={{ items: orderedNotes, commentCount, recordingCount }}
          recording={{
            playProgress: recording.playProgress,
            onStart: recording.start,
            onPlay: recording.play,
            onClear: recording.clear,
          }}
          composer={{
            value: comments.noteDraft,
            onChange: comments.setNoteDraft,
            onSubmit: comments.submitComment,
            inputRef: composerRef,
            pinnedSheetCode: pendingPinId ? sheet.code : null,
          }}
          onOpenNote={(note) => {
            const index = sheets.findIndex((s) => s.id === note.sheetId);
            if (index >= 0) nav.goTo(index);
          }}
          sheetCodeFor={(sheetId) => sheets.find((s) => s.id === sheetId)?.code ?? "—"}
        />
      </div>

      <PlanReviewStatusBar
        sheets={sheets}
        sheet={sheet}
        nav={nav}
        markup={markup}
        recording={recording}
        save={{
          canPersist: Boolean(projectId && sheet.documentVersionId),
          isSaving: createMarkup.isPending || addMarkupComment.isPending || deleteMarkup.isPending,
          hasError: Boolean(createMarkup.error ?? addMarkupComment.error ?? deleteMarkup.error),
          markupLoading: markupQuery.isPending,
        }}
      />
    </main>
  );
}
