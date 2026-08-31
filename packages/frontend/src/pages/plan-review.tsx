/*
 * Drawing Review Workspace.
 * Inside a project (/project/:projectId/plans/review) it reviews the
 * project's uploaded plan documents; without a project it falls back to
 * bundled demo sheets. Markup, notes and recordings are session-local.
 * Production expansion points: persist markup/notes via the documents
 * module, stored recordings with real audio capture, session identity,
 * collaboration, calibrated sheet scales, permissions and audit trail.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Eye,
  EyeOff,
  FileText,
  Layers,
  Lock,
  MessageSquare,
  Minus,
  MoreHorizontal,
  Plus,
  Ruler,
  Search,
  Sparkles,
  Square,
  Star,
  Trash2,
  Unlock,
  Video,
  X,
} from "lucide-react";
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
import { MARKUP_KIND, type MarkupGeometry } from "@/api/drawing-markup";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { CommentComposerPopover } from "./plan-review/plan-review-comment";
import { CommentPin } from "./plan-review/plan-review-pin";
import {
  COMMENT_MODE,
  FOLLOW_UP,
  type CommentCapture,
} from "./plan-review/plan-review-comment-types";
import {
  MOCK_SHEETS,
  SHEET_KIND,
  adaptPlanDocuments,
  clamp,
  formatClock,
  generateId,
  type Pt,
  type Sheet,
} from "./plan-review/plan-review-data";
import {
  MarkupLayer,
  hitTestMarkup,
  normalizedRect,
  type Markup,
} from "./plan-review/plan-review-markup";
import {
  BLEND_MODE,
  BLEND_MODES,
  CALIBRATED_LABEL,
  KEY,
  NOTE_TYPE,
  PANE,
  PARTICIPANT_ACTIVE,
  PLAYBACK_SECONDS,
  POPOVER,
  REC_STATUS,
  REVISIONS,
  SELECTION_KIND,
  TOOL,
  TOOLS,
  TOOL_CURSORS,
  sheetAt,
  toLocalMarkup,
  type BlendMode,
  type Note,
  type PaneSide,
  type Pin,
  type PopoverId,
  type RecStatus,
  type Selection,
  type Tool,
} from "./plan-review/plan-review-types";
import { IconBtn, Kbd, POP_ITEM_CLS, PopShell } from "./plan-review/plan-review-ui";
import { SheetImage } from "./plan-review/plan-review-sheet-image";
import { SheetPane } from "./plan-review/plan-review-sheet-pane";
import { ReviewNotesPanel } from "./plan-review/plan-review-notes-panel";
import { MarkupToolbar } from "./plan-review/plan-review-toolbar";
import { BlendComparisonPanel } from "./plan-review/plan-review-blend-panel";


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

  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [sheetRevisions, setSheetRevisions] = useState<Record<string, string>>({});
  const [activeTool, setActiveTool] = useState<Tool>(TOOL.SELECT);
  const [markupColor, setMarkupColor] = useState("#004DE7");
  const [markupVisible, setMarkupVisible] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  const [openPopover, setOpenPopover] = useState<PopoverId | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [blendPanelOpen, setBlendPanelOpen] = useState(false);
  const [blendMode, setBlendMode] = useState<BlendMode | null>(null);
  const [blendAmount, setBlendAmount] = useState(50);
  const [compareSheetIndex, setCompareSheetIndex] = useState(1);

  const [split, setSplit] = useState({
    open: false,
    primaryIndex: 0,
    compareIndex: 1,
    primaryZoom: 100,
    compareZoom: 100,
    locked: false,
    synced: false,
    dividerRatio: 0.5,
  });

  const [zoom, setZoom] = useState(100);
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [draft, setDraft] = useState<Markup | null>(null);
  const [measureStart, setMeasureStart] = useState<Pt | null>(null);
  const [measureCursor, setMeasureCursor] = useState<Pt | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [imgAspect, setImgAspect] = useState(0.775);
  const [sheetScales, setSheetScales] = useState<Record<string, number>>({});
  const [scaleLabels, setScaleLabels] = useState<Record<string, string>>({});
  const [calibrateOpen, setCalibratePopoverOpen] = useState(false);
  const [calibrateInput, setCalibrateInput] = useState("");

  const [pins, setPins] = useState<Pin[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [pendingPinId, setPendingPinId] = useState<string | null>(null);
  const [notesPanelOpen, setNotesPanelOpen] = useState(true);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [commentAnchor, setCommentAnchor] = useState<{ x: number; y: number; at: Pt } | null>(null);

  const [recStatus, setRecStatus] = useState<RecStatus>(REC_STATUS.IDLE);
  const [recSeconds, setRecSeconds] = useState(0);
  const [trace, setTrace] = useState<Pt[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [playProgress, setPlayProgress] = useState<number | null>(null);

  const drawingRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const splitStageRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lastTraceAt = useRef(0);
  const playTimer = useRef<number | null>(null);
  const panStart = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const penPoints = useRef<Pt[]>([]);
  const cloudOrigin = useRef<Pt | null>(null);
  const draggingPin = useRef<string | null>(null);
  const suppressNextClick = useRef(false);

  const hasSheets = sheets.length > 0;
  const canCompare = sheets.length >= 2;
  const sheet = hasSheets ? sheetAt(sheets, activeSheetIndex) : null;
  const compareSheet = hasSheets ? sheetAt(sheets, compareSheetIndex) : null;
  const currentRevision = sheet ? (sheetRevisions[sheet.id] ?? sheet.revision) : "";

  const { data: participants = [] } = useParticipants(projectId);
  const assignees = useMemo(
    () =>
      participants
        .filter((p) => p.userId && p.status === PARTICIPANT_ACTIVE)
        .map((p) => ({ id: p.userId!, name: p.name ?? p.email })),
    [participants],
  );

  const versionId = sheet?.documentVersionId ?? null;
  const markupQuery = useDrawingMarkups(projectId, versionId, pdfPage);
  const createMarkup = useCreateDrawingMarkup(projectId);
  const addMarkupComment = useAddMarkupComment(projectId);
  const deleteMarkup = useDeleteDrawingMarkup(projectId);
  const uploadFile = useUploadFile();
  const createRfi = useCreateRfi();
  const createApproval = useCreateApproval();

  /** Server markup is the source of truth; local state only holds the in-progress draft. */
  const persisted = useMemo(() => toLocalMarkup(markupQuery.data ?? []), [markupQuery.data]);
  const sheetPins = sheet ? [...persisted.pins, ...pins.filter((p) => p.sheetId === sheet.id)] : [];
  const sheetMarkups = sheet
    ? [...persisted.markups, ...markups.filter((m) => m.sheetId === sheet.id)]
    : [];

  const isSaving = createMarkup.isPending || addMarkupComment.isPending || deleteMarkup.isPending;
  const saveError = createMarkup.error ?? addMarkupComment.error ?? deleteMarkup.error;
  const commentCount = notes.filter((n) => n.type === NOTE_TYPE.COMMENT).length;
  const recordingCount = notes.filter((n) => n.type === NOTE_TYPE.RECORDING).length;
  const orderedNotes = useMemo(() => [...notes].sort((a, b) => b.createdAt - a.createdAt), [notes]);

  useEffect(() => {
    setActiveSheetIndex((i) => clamp(i, 0, Math.max(0, sheets.length - 1)));
    setCompareSheetIndex((i) => clamp(i, 0, Math.max(0, sheets.length - 1)));
  }, [sheets.length]);

  const appliedRequestedSheet = useRef(false);
  useEffect(() => {
    if (appliedRequestedSheet.current || !requestedSheetId || sheets.length === 0) return;
    const index = sheets.findIndex((s) => s.id === requestedSheetId);
    if (index >= 0) setActiveSheetIndex(index);
    appliedRequestedSheet.current = true;
  }, [sheets, requestedSheetId]);

  useEffect(() => {
    if (!openPopover) return;
    function onDown(e: MouseEvent): void {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-popover-root]") && !target.closest("[data-popover-trigger]")) {
        setOpenPopover(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openPopover]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === KEY.ESCAPE) {
        setOpenPopover(null);
        setMeasureStart(null);
        setSelection(null);
        return;
      }
      const target = e.target as HTMLElement;
      // A rich-text editor is a contenteditable div, not an input, so it must be
      // excluded explicitly or typing "/" or a tool letter fires a shortcut and
      // swallows the character.
      if (
        e.isComposing ||
        target.isContentEditable ||
        target.closest("[data-popover-root]") ||
        target.closest("[data-comment-popover]") ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if ((e.key === KEY.DELETE || e.key === KEY.BACKSPACE) && selection) {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (e.key === KEY.SLASH) {
        e.preventDefault();
        setOpenPopover(POPOVER.SEARCH);
        return;
      }
      const tool = TOOLS.find((t) => t.shortcut.toLowerCase() === e.key.toLowerCase());
      if (tool) {
        selectTool(tool.id);
        return;
      }
      if (!split.open && e.key === KEY.ARROW_LEFT) goToSheet(activeSheetIndex - 1);
      if (!split.open && e.key === KEY.ARROW_RIGHT) goToSheet(activeSheetIndex + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (openPopover === POPOVER.SEARCH) searchRef.current?.focus();
    else if (searchQuery) setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPopover]);

  useEffect(() => {
    if (recStatus !== REC_STATUS.RECORDING) return;
    const id = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recStatus]);

  useEffect(() => {
    return () => {
      if (playTimer.current !== null) window.clearInterval(playTimer.current);
    };
  }, []);

  function goToSheet(index: number): void {
    setActiveSheetIndex(clamp(index, 0, sheets.length - 1));
    setSelection(null);
    setMeasureStart(null);
    setDraft(null);
  }

  function selectTool(tool: Tool): void {
    setActiveTool(tool);
    setMeasureStart(null);
    setDraft(null);
    if (tool !== TOOL.SELECT) setSelection(null);
  }

  function pointFromEvent(e: { clientX: number; clientY: number }): Pt | null {
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }

  function handleSheetRender(state: {
    aspect: number;
    detectedScale: { label: string; feetPerPct: number } | null;
    pageCount?: number;
  }): void {
    setImgAspect(state.aspect);
    if (state.pageCount !== undefined) setPdfPageCount(state.pageCount);
    if (!sheet || !state.detectedScale) return;
    const detected = state.detectedScale;
    setSheetScales((current) =>
      current[sheet.id] ? current : { ...current, [sheet.id]: detected.feetPerPct },
    );
    setScaleLabels((current) => (current[sheet.id] ? current : { ...current, [sheet.id]: detected.label }));
  }

  function handleCalibrateSubmit(): void {
    if (!sheet || !selection || selection.kind !== SELECTION_KIND.MARKUP || !calibrateInput) return;
    const markup = markups.find((m) => m.id === selection.id);
    if (!markup || markup.tool !== MARKUP_KIND.MEASURE) return;
    const val = Number.parseFloat(calibrateInput);
    if (Number.isNaN(val) || val <= 0) return;

    const dxPct = markup.b.x - markup.a.x;
    const dyPct = (markup.b.y - markup.a.y) * imgAspect;
    const distPct = Math.hypot(dxPct, dyPct);
    
    setSheetScales((s) => ({ ...s, [sheet.id]: val / distPct }));
    setScaleLabels((s) => ({ ...s, [sheet.id]: CALIBRATED_LABEL }));
    setCalibratePopoverOpen(false);
    setCalibrateInput("");
    import("@/lib/toast").then((m) => m.toast("Scale calibrated", "success"));
  }

  function deleteSelection(): void {
    if (!selection) return;
    const isPersisted = (markupQuery.data ?? []).some((m) => m.id === selection.id);
    if (isPersisted) {
      deleteMarkup.mutate(selection.id);
    } else if (selection.kind === SELECTION_KIND.PIN) {
      setPins((p) => p.filter((pin) => pin.id !== selection.id));
      setNotes((n) => n.map((note) => (note.pinId === selection.id ? { ...note, pinId: null } : note)));
      if (pendingPinId === selection.id) setPendingPinId(null);
    } else {
      setMarkups((m) => m.filter((markup) => markup.id !== selection.id));
    }
    setSelection(null);
  }

  /**
   * Writes markup through the API when the sheet is a real project document.
   * Demo sheets have no document behind them, so they stay in local state and
   * the status bar reports them as unsaved rather than claiming otherwise.
   */
  async function persistMarkup(
    tool: "pen" | "cloud" | "measure" | "pin",
    geometry: MarkupGeometry,
  ): Promise<string | null> {
    if (!sheet) return null;
    if (!projectId || !sheet.documentId || !sheet.documentVersionId) {
      const local = { id: generateId("mk"), sheetId: sheet.id, color: markupColor };
      if (geometry.kind === MARKUP_KIND.PEN) setMarkups((m) => [...m, { ...local, tool: "pen", points: geometry.points }]);
      if (geometry.kind === MARKUP_KIND.CLOUD) setMarkups((m) => [...m, { ...local, tool: "cloud", rect: geometry.rect }]);
      if (geometry.kind === MARKUP_KIND.MEASURE) setMarkups((m) => [...m, { ...local, tool: "measure", a: geometry.a, b: geometry.b }]);
      if (geometry.kind === MARKUP_KIND.PIN) setPins((p) => [...p, { ...local, x: geometry.at.x, y: geometry.at.y, noteId: null }]);
      return local.id;
    }
    const created = await createMarkup.mutateAsync({
      documentId: sheet.documentId,
      documentVersionId: sheet.documentVersionId,
      pageNo: pdfPage,
      kind: tool,
      geometry,
      color: markupColor,
    });
    return created.id;
  }

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
        subject: `${sheet.code} — ${capture.text.slice(0, 80)}`,
        question: capture.text,
        ballInCourtId: capture.assigneeId ?? null,
        ...reference,
      });
      toast("RFI raised from this comment", "success");
    } else if (capture.followUp === FOLLOW_UP.APPROVAL) {
      await createApproval.mutateAsync({
        projectId,
        title: `${sheet.code} — ${capture.text.slice(0, 80)}`,
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

  function handleDrawingClick(e: React.MouseEvent<HTMLDivElement>): void {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    if (!sheet) return;
    const point = pointFromEvent(e);
    if (!point) return;

    if (activeTool === TOOL.COMMENT) {
      setCommentAnchor({ x: e.clientX, y: e.clientY + 14, at: point });
      return;
    }

    if (activeTool === TOOL.MEASURE) {
      if (!measureStart) {
        setMeasureStart(point);
        setMeasureCursor(point);
      } else {
        void persistMarkup("measure", { kind: "measure", a: measureStart, b: point });
        setMeasureStart(null);
        setMeasureCursor(null);
      }
      return;
    }

    if (activeTool === TOOL.SELECT) {
      const hit = hitTestMarkup(sheetMarkups, point);
      setSelection(hit ? { kind: SELECTION_KIND.MARKUP, id: hit.id } : null);
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (!sheet) return;
    const point = pointFromEvent(e);
    if (!point) return;

    if (activeTool === TOOL.PAN) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      panStart.current = { x: e.clientX, y: e.clientY, left: canvas.scrollLeft, top: canvas.scrollTop };
      setIsPanning(true);
      drawingRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (activeTool === TOOL.PEN) {
      penPoints.current = [point];
      setDraft({ id: "draft", sheetId: sheet.id, tool: "pen", color: markupColor, points: [point] });
      drawingRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (activeTool === TOOL.CLOUD) {
      cloudOrigin.current = point;
      setDraft({ id: "draft", sheetId: sheet.id, tool: "cloud", color: markupColor, rect: { ...point, w: 0, h: 0 } });
      drawingRef.current?.setPointerCapture(e.pointerId);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    if (recStatus === REC_STATUS.RECORDING) {
      const now = Date.now();
      if (now - lastTraceAt.current >= 50) {
        lastTraceAt.current = now;
        const tracePoint = pointFromEvent(e);
        if (tracePoint) setTrace((t) => (t.length >= 500 ? [...t.slice(1), tracePoint] : [...t, tracePoint]));
      }
    }

    if (activeTool === TOOL.PAN && panStart.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.scrollLeft = panStart.current.left - (e.clientX - panStart.current.x);
      canvas.scrollTop = panStart.current.top - (e.clientY - panStart.current.y);
      return;
    }

    const point = pointFromEvent(e);
    if (!point || !sheet) return;

    if (draggingPin.current) {
      const pinId = draggingPin.current;
      setPins((p) => p.map((pin) => (pin.id === pinId ? { ...pin, x: point.x, y: point.y } : pin)));
      return;
    }
    if (activeTool === TOOL.MEASURE && measureStart) {
      setMeasureCursor(point);
      return;
    }
    if (activeTool === TOOL.PEN && penPoints.current.length > 0) {
      const last = penPoints.current[penPoints.current.length - 1];
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.4) return;
      penPoints.current = [...penPoints.current, point];
      setDraft({ id: "draft", sheetId: sheet.id, tool: "pen", color: markupColor, points: penPoints.current });
      return;
    }
    if (activeTool === TOOL.CLOUD && cloudOrigin.current) {
      setDraft({
        id: "draft",
        sheetId: sheet.id,
        tool: "cloud",
        color: markupColor,
        rect: normalizedRect(cloudOrigin.current, point),
      });
    }
  }

  function handlePointerUp(): void {
    if (draggingPin.current) {
      draggingPin.current = null;
      suppressNextClick.current = true;
      return;
    }
    if (activeTool === TOOL.PAN) {
      panStart.current = null;
      setIsPanning(false);
      return;
    }
    if (!sheet) return;
    if (activeTool === TOOL.PEN && penPoints.current.length > 1) {
      void persistMarkup("pen", { kind: "pen", points: penPoints.current });
    }
    if (activeTool === TOOL.CLOUD && draft?.tool === MARKUP_KIND.CLOUD && draft.rect.w > 1 && draft.rect.h > 1) {
      void persistMarkup("cloud", { kind: "cloud", rect: draft.rect });
    }
    penPoints.current = [];
    cloudOrigin.current = null;
    setDraft(null);
  }

  function handlePinPointerDown(e: React.PointerEvent, pinId: string): void {
    if (activeTool !== TOOL.SELECT) return;
    e.stopPropagation();
    setSelection({ kind: SELECTION_KIND.PIN, id: pinId });
    draggingPin.current = pinId;
    drawingRef.current?.setPointerCapture(e.pointerId);
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

  // ── Recording ──
  function startRecording(): void {
    setNotes((n) => n.filter((note) => note.type !== NOTE_TYPE.RECORDING));
    setPlayProgress(null);
    setTrace([]);
    setRecSeconds(0);
    setRecStatus(REC_STATUS.RECORDING);
    setOpenPopover(null);
  }

  function stopRecording(): void {
    if (!sheet) return;
    setRecStatus(REC_STATUS.SAVED);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 4000);
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
        durationSeconds: recSeconds,
      },
    ]);
  }

  function clearRecording(): void {
    if (playTimer.current !== null) window.clearInterval(playTimer.current);
    setNotes((n) => n.filter((note) => note.type !== NOTE_TYPE.RECORDING));
    setRecStatus(REC_STATUS.IDLE);
    setPlayProgress(null);
    setTrace([]);
    setRecSeconds(0);
  }

  function playRecording(): void {
    if (trace.length === 0 || playProgress !== null) return;
    const stepMs = 50;
    const steps = (PLAYBACK_SECONDS * 1000) / stepMs;
    let step = 0;
    setPlayProgress(0);
    playTimer.current = window.setInterval(() => {
      step += 1;
      if (step >= steps) {
        if (playTimer.current !== null) window.clearInterval(playTimer.current);
        playTimer.current = null;
        setPlayProgress(null);
      } else {
        setPlayProgress(step / steps);
      }
    }, stepMs);
  }

  // ── Split view ──
  function setPaneZoom(pane: PaneSide, nextZoom: number): void {
    const next = clamp(nextZoom, 50, 200);
    setSplit((s) => ({
      ...s,
      primaryZoom: pane === PANE.PRIMARY || s.synced ? next : s.primaryZoom,
      compareZoom: pane === PANE.COMPARE || s.synced ? next : s.compareZoom,
    }));
  }

  function startDividerDrag(e: React.MouseEvent): void {
    e.preventDefault();
    function onMove(ev: MouseEvent): void {
      const rect = splitStageRef.current?.getBoundingClientRect();
      if (!rect) return;
      setSplit((s) => ({ ...s, dividerRatio: clamp((ev.clientX - rect.left) / rect.width, 0.25, 0.75) }));
    }
    function onUp(): void {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function openBlendPanel(): void {
    setBlendPanelOpen(true);
    setBlendMode((m) => m ?? BLEND_MODE.DIFFERENCES);
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

  const canPersist = Boolean(projectId && sheet?.documentVersionId);
  function describeSaveState(): string {
    if (recStatus === REC_STATUS.RECORDING) return `Recording walkthrough · ${formatClock(recSeconds)}`;
    if (savedFlash) return "Walkthrough saved";
    if (saveError) return "Could not save — retry";
    if (isSaving) return "Saving…";
    if (!canPersist) return "Demo sheet — markup not saved";
    if (markupQuery.isPending) return "Loading markup…";
    return "All changes saved";
  }
  const saveState = describeSaveState();
  const contextState = split.open
    ? `Comparing ${sheetAt(sheets, split.primaryIndex).code} / ${sheetAt(sheets, split.compareIndex).code}`
    : sheet
      ? `Sheet ${sheet.code}${blendPanelOpen && blendMode ? ` · ${BLEND_MODES.find((m) => m.id === blendMode)?.label} · ${blendAmount}%` : ""}`
      : "No sheets";
  const activeToolLabel = TOOLS.find((t) => t.id === activeTool)?.label ?? "Select";

  const traceVisible = playProgress === null ? trace : trace.slice(0, Math.max(2, Math.floor(trace.length * playProgress)));
  const traceTip = traceVisible[traceVisible.length - 1];
  const measureDraft: Markup | null =
    sheet && activeTool === TOOL.MEASURE && measureStart && measureCursor
      ? { id: "draft-measure", sheetId: sheet.id, tool: "measure", color: markupColor, a: measureStart, b: measureCursor }
      : null;
  const blendReady =
    blendPanelOpen && blendMode && canCompare && sheet?.kind === SHEET_KIND.IMAGE && compareSheet?.kind === SHEET_KIND.IMAGE;

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
      {/* ── Top navigation ── */}
      <header className="relative z-40 flex shrink-0 items-center gap-2 border-b border-[#F0F0F0] bg-white px-3 py-2">
        <button
          type="button"
          onClick={exitWorkspace}
          title="Exit document review"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
        >
          <X size={15} /> Exit
        </button>
        <div className="flex items-center">
          <IconBtn label="Previous sheet" disabled={activeSheetIndex === 0} onClick={() => goToSheet(activeSheetIndex - 1)}>
            <ChevronLeft size={17} />
          </IconBtn>
          <IconBtn
            label="Next sheet"
            disabled={activeSheetIndex === sheets.length - 1}
            onClick={() => goToSheet(activeSheetIndex + 1)}
          >
            <ChevronRight size={17} />
          </IconBtn>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <FileText size={15} className="shrink-0 text-gray-400" />
          <span className="truncate text-sm font-semibold text-gray-900">
            {sheet.code} · {sheet.title}
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 text-xs text-gray-500 sm:flex">
            {currentRevision}
            {sheet.scale ? ` · ${sheet.scale}` : ""}
            {!sheet.scale && scaleLabels[sheet.id] === CALIBRATED_LABEL && (
              <span className="flex items-center gap-1 rounded bg-primary-50 px-1.5 py-0.5 font-medium text-primary-700">
                <Ruler size={10} /> Calibrated
              </span>
            )}
            {!sheet.scale && scaleLabels[sheet.id] && scaleLabels[sheet.id] !== CALIBRATED_LABEL && (
              <span className="flex items-center gap-1 rounded bg-primary-50 px-1.5 py-0.5 font-medium text-primary-700">
                <Sparkles size={10} /> {scaleLabels[sheet.id]} from sheet
              </span>
            )}
            {!sheet.scale && !scaleLabels[sheet.id] && (
              <span className="flex items-center gap-1 rounded bg-[#F6F6F6] px-1.5 py-0.5 text-gray-500">
                No scale on sheet — measure, then Calibrate
              </span>
            )}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              data-popover-trigger
              aria-haspopup="true"
              aria-expanded={openPopover === POPOVER.REVISION}
              title="Select revision"
              onClick={() => setOpenPopover(openPopover === POPOVER.REVISION ? null : POPOVER.REVISION)}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
            >
              {currentRevision} <ChevronDown size={12} />
            </button>
            {openPopover === POPOVER.REVISION && (
              <PopShell className="right-0 w-36">
                {(sheet.scale ? REVISIONS : [currentRevision]).map((rev) => (
                  <button
                    key={rev}
                    type="button"
                    onClick={() => {
                      setSheetRevisions((r) => ({ ...r, [sheet.id]: rev }));
                      setOpenPopover(null);
                    }}
                    className={cn(POP_ITEM_CLS, "justify-between")}
                  >
                    {rev}
                    {rev === currentRevision ? <Check size={14} className="text-primary-600" /> : null}
                  </button>
                ))}
              </PopShell>
            )}
          </div>

          <IconBtn
            label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            pressed={isFavorite}
            onClick={() => setIsFavorite((f) => !f)}
            className={isFavorite ? "text-amber-500 hover:text-amber-500" : undefined}
          >
            <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
          </IconBtn>

          <div className="relative">
            <IconBtn
              label="Search sheets and notes (/)"
              data-popover-trigger
              hasPopup
              expanded={openPopover === POPOVER.SEARCH}
              onClick={() => setOpenPopover(openPopover === POPOVER.SEARCH ? null : POPOVER.SEARCH)}
            >
              <Search size={16} />
            </IconBtn>
            {openPopover === POPOVER.SEARCH && (
              <PopShell className="right-0 w-80 p-3">
                <div className="flex items-center gap-2 rounded-lg bg-[#F6F6F6] px-2.5 py-2">
                  <Search size={14} className="shrink-0 text-gray-400" />
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === KEY.ESCAPE) {
                        setSearchQuery("");
                        setOpenPopover(null);
                      }
                    }}
                    aria-label="Search sheets and markup"
                    placeholder="Search sheets and markup"
                    className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                  />
                  <Kbd>Esc</Kbd>
                </div>
                {!query ? (
                  <p className="px-1 pt-3 text-xs text-gray-400">Search sheets and markup</p>
                ) : resultCount === 0 ? (
                  <p className="px-1 pt-3 text-xs text-gray-500">No results for &ldquo;{searchQuery.trim()}&rdquo;</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto pt-2">
                    <p className="px-1 pb-1 text-[11px] text-gray-500">
                      {resultCount} result{resultCount === 1 ? "" : "s"}
                    </p>
                    {sheetResults.length > 0 && (
                      <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Sheets</p>
                    )}
                    {sheetResults.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          goToSheet(s.index);
                          setOpenPopover(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[#F6F6F6]"
                      >
                        <FileText size={13} className="shrink-0 text-gray-400" />
                        <span className="font-medium text-gray-900">{s.code}</span>
                        <span className="truncate text-gray-500">{s.title}</span>
                      </button>
                    ))}
                    {noteResults.length > 0 && (
                      <p className="px-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Markup &amp; Notes
                      </p>
                    )}
                    {noteResults.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          const index = sheets.findIndex((s) => s.id === n.sheetId);
                          if (index >= 0) goToSheet(index);
                          setOpenPopover(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[#F6F6F6]"
                      >
                        <MessageSquare size={13} className="shrink-0 text-gray-400" />
                        <span className="truncate text-gray-600">{n.text}</span>
                        <span className="ml-auto shrink-0 text-gray-400">
                          {sheets.find((s) => s.id === n.sheetId)?.code ?? ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </PopShell>
            )}
          </div>

          <IconBtn
            label={markupVisible ? "Hide all markup" : "Show all markup"}
            pressed={markupVisible}
            onClick={() => setMarkupVisible((v) => !v)}
          >
            {markupVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          </IconBtn>

          <div className="relative">
            <button
              type="button"
              data-popover-trigger
              aria-haspopup="true"
              aria-expanded={openPopover === POPOVER.REVIEW_TOOLS}
              title="Review tools"
              onClick={() => setOpenPopover(openPopover === POPOVER.REVIEW_TOOLS ? null : POPOVER.REVIEW_TOOLS)}
              className="flex items-center gap-1.5 rounded-lg border border-[#EDEDED] bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-[#F6F6F6]"
            >
              <span className="hidden sm:inline">Review Tools</span>
              <MoreHorizontal size={16} className="sm:hidden" />
              <ChevronDown size={13} className="hidden sm:inline" />
            </button>
            {openPopover === POPOVER.REVIEW_TOOLS && (
              <PopShell className="right-0 w-56">
                {canCompare && (
                  <button type="button" onClick={openBlendPanel} className={POP_ITEM_CLS}>
                    <Layers size={15} /> Compare Revisions
                  </button>
                )}
                {canCompare && (
                  <button
                    type="button"
                    onClick={() => {
                      setSplit((s) => ({ ...s, open: !s.open }));
                      setOpenPopover(null);
                    }}
                    className={POP_ITEM_CLS}
                  >
                    <Columns2 size={15} /> {split.open ? "Exit Split View" : "Split View"}
                  </button>
                )}
                <button type="button" onClick={startRecording} className={POP_ITEM_CLS}>
                  <Video size={15} /> Record Walkthrough
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMarkupVisible((v) => !v);
                    setOpenPopover(null);
                  }}
                  className={POP_ITEM_CLS}
                >
                  {markupVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                  {markupVisible ? "Hide Markup" : "Show Markup"}
                </button>
              </PopShell>
            )}
          </div>
        </div>
      </header>

      <MarkupToolbar
        activeTool={activeTool}
        onSelectTool={selectTool}
        markupColor={markupColor}
        onSelectColor={(color) => {
          setMarkupColor(color);
          setOpenPopover(null);
        }}
        colorOpen={openPopover === POPOVER.COLOR}
        onToggleColor={() => setOpenPopover(openPopover === POPOVER.COLOR ? null : POPOVER.COLOR)}
        measuring={measureStart !== null}
        canCompare={canCompare}
        onCompare={openBlendPanel}
      />

      {/* ── Workspace ── */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative flex min-h-0 min-w-0 flex-[2] flex-col overflow-hidden">
          {!split.open ? (
            <div ref={canvasRef} className="relative min-h-0 flex-1 overflow-auto bg-[#F0F0F0] p-4 sm:p-8">
              <div className="mx-auto" style={{ width: `${zoom}%`, minWidth: "min(560px, 100%)" }}>
                <div
                  ref={drawingRef}
                  onClick={handleDrawingClick}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className={cn(
                    "relative w-full touch-none rounded-lg border border-[#E2E2E2] bg-white shadow-lg",
                    isPanning ? "cursor-grabbing" : TOOL_CURSORS[activeTool],
                  )}
                >
                  <SheetImage
                    sheet={sheet}
                    className="block w-full rounded-lg"
                    pageNumber={pdfPage}
                    onRender={handleSheetRender}
                  />

                  {blendReady && compareSheet?.src && (
                    <>
                      <img
                        src={compareSheet.src}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        className="pointer-events-none absolute inset-0 h-full w-full rounded-lg"
                        style={
                          blendMode === BLEND_MODE.DIFFERENCES
                            ? { mixBlendMode: "difference", opacity: blendAmount / 100 }
                            : blendMode === BLEND_MODE.GHOST
                              ? { opacity: (blendAmount / 100) * 0.6, filter: "grayscale(0.9)" }
                              : { mixBlendMode: "multiply", opacity: blendAmount / 100 }
                        }
                      />
                      {blendMode === BLEND_MODE.HIGHLIGHT && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-lg bg-yellow-300"
                          style={{ mixBlendMode: "multiply", opacity: (blendAmount / 100) * 0.35 }}
                        />
                      )}
                      <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-red-700 shadow-sm ring-1 ring-black/10">
                        <span className="size-2 rounded-full bg-red-500" /> {sheet.code} · {currentRevision} (current)
                      </span>
                      <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-sky-700 shadow-sm ring-1 ring-black/10">
                        <span className="size-2 rounded-full bg-sky-500" /> {compareSheet.code} · {compareSheet.revision} (compare)
                      </span>
                    </>
                  )}

                  {markupVisible && (
                    <MarkupLayer
                      markups={sheetMarkups}
                      draft={draft ?? measureDraft}
                      selectedId={selection?.kind === SELECTION_KIND.MARKUP ? selection.id : null}
                      scale={sheet.scale}
                      aspect={imgAspect}
                      customFtPerPct={sheetScales[sheet.id]}
                    />
                  )}

                  {markupVisible &&
                    sheetPins.map((pin, index) => (
                      <CommentPin
                        key={pin.id}
                        color={pin.color}
                        label={`Comment ${index + 1}`}
                        selected={selection?.kind === SELECTION_KIND.PIN && selection.id === pin.id}
                        draggable={activeTool === TOOL.SELECT}
                        onPointerDown={(e) => handlePinPointerDown(e, pin.id)}
                        onClick={(e) => {
                          if (activeTool === TOOL.SELECT) e.stopPropagation();
                        }}
                        style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                      />
                    ))}

                  {(recStatus === REC_STATUS.RECORDING || (recStatus === REC_STATUS.SAVED && trace.length > 1)) && (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    >
                      <polyline
                        points={traceVisible.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke="#004DE7"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.55"
                        vectorEffect="non-scaling-stroke"
                      />
                      {traceTip && <circle cx={traceTip.x} cy={traceTip.y} r="1.1" fill="#004DE7" />}
                    </svg>
                  )}
                </div>
              </div>

              <div className="absolute bottom-4 left-4 z-30 flex items-center gap-1 rounded-lg bg-white/95 p-1 shadow-lg ring-1 ring-black/5">
                <IconBtn label="Zoom out" disabled={zoom <= 50} onClick={() => setZoom((z) => clamp(z - 25, 50, 300))} className="size-7">
                  <Minus size={13} />
                </IconBtn>
                <span className="w-11 text-center font-mono text-[11px] text-gray-600">{zoom}%</span>
                <IconBtn label="Zoom in" disabled={zoom >= 300} onClick={() => setZoom((z) => clamp(z + 25, 50, 300))} className="size-7">
                  <Plus size={13} />
                </IconBtn>
              </div>

              {selection && (
                <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/95 py-1 pl-3 pr-1 shadow-lg ring-1 ring-black/5">
                  <span className="text-[11px] font-medium text-gray-600">
                    {selection.kind === SELECTION_KIND.PIN ? "Pin selected — drag to move" : "Markup selected"}
                  </span>
                  {selection.kind === SELECTION_KIND.MARKUP && markups.find((m) => m.id === selection.id)?.tool === MARKUP_KIND.MEASURE && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCalibratePopoverOpen((o) => !o)}
                        className="flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 hover:bg-primary-100"
                      >
                        <Ruler size={11} /> Calibrate
                      </button>
                      {calibrateOpen && (
                        <div data-popover-root className="absolute left-1/2 top-full mt-2 w-56 -translate-x-1/2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-black/5">
                          <p className="text-xs font-semibold text-gray-900">Calibrate scale</p>
                          <p className="mt-0.5 text-[11px] text-gray-500">Enter the actual distance for this measurement.</p>
                          <div className="mt-2.5 flex items-center gap-2">
                            <input
                              type="number"
                              step="any"
                              value={calibrateInput}
                              onChange={(e) => setCalibrateInput(e.target.value)}
                              placeholder="Feet (e.g. 10.5)"
                              className="h-8 w-full rounded-md bg-[#F6F6F6] px-2.5 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-primary-600/20"
                            />
                            <button
                              type="button"
                              onClick={handleCalibrateSubmit}
                              className="h-8 shrink-0 rounded-md bg-primary-600 px-3 text-xs font-semibold text-white hover:bg-primary-700"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={deleteSelection}
                    className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                  <Kbd>Del</Kbd>
                </div>
              )}
            </div>
          ) : (
            <div ref={splitStageRef} className="flex min-h-0 flex-1 flex-col gap-2 bg-[#F0F0F0] p-3 md:flex-row md:gap-0">
              <div className="flex min-h-0 min-w-0 flex-1 md:flex-none" style={{ flexBasis: `${split.dividerRatio * 100}%` }}>
                <SheetPane
                  paneKey="primary"
                  label="Primary"
                  sheets={sheets}
                  sheetIndex={split.primaryIndex}
                  zoom={split.primaryZoom}
                  locked={false}
                  optionsOpen={openPopover === POPOVER.PANE_OPTS_PRIMARY}
                  onToggleOptions={() => setOpenPopover(openPopover === POPOVER.PANE_OPTS_PRIMARY ? null : POPOVER.PANE_OPTS_PRIMARY)}
                  onSheetChange={(index) => setSplit((s) => ({ ...s, primaryIndex: index }))}
                  onZoomChange={(nextZoom) => setPaneZoom(PANE.PRIMARY, nextZoom)}
                  onFit={() => {
                    setSplit((s) => ({ ...s, primaryZoom: 100, compareZoom: s.synced ? 100 : s.compareZoom }));
                    setOpenPopover(null);
                  }}
                />
              </div>

              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize panes"
                onMouseDown={startDividerDrag}
                className="hidden w-2 shrink-0 cursor-col-resize flex-col items-center justify-center gap-2 md:flex"
              >
                <span className="h-16 w-1 rounded-full bg-gray-300" />
              </div>
              <div className="flex items-center justify-center gap-2 md:hidden">
                <span className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                <SheetPane
                  paneKey="compare"
                  label="Compare"
                  sheets={sheets}
                  sheetIndex={split.compareIndex}
                  zoom={split.compareZoom}
                  locked={split.locked}
                  optionsOpen={openPopover === POPOVER.PANE_OPTS_COMPARE}
                  onToggleOptions={() => setOpenPopover(openPopover === POPOVER.PANE_OPTS_COMPARE ? null : POPOVER.PANE_OPTS_COMPARE)}
                  onSheetChange={(index) => setSplit((s) => ({ ...s, compareIndex: index }))}
                  onZoomChange={(nextZoom) => setPaneZoom(PANE.COMPARE, nextZoom)}
                  onFit={() => {
                    setSplit((s) => ({ ...s, compareZoom: 100, primaryZoom: s.synced ? 100 : s.primaryZoom }));
                    setOpenPopover(null);
                  }}
                />
              </div>

              <div className="absolute right-5 top-5 z-20 flex items-center gap-1 rounded-lg bg-white/95 p-1 shadow-lg ring-1 ring-black/5">
                <IconBtn
                  label={split.locked ? "Unlock compare pane" : "Lock compare pane"}
                  pressed={split.locked}
                  active={split.locked}
                  onClick={() => setSplit((s) => ({ ...s, locked: !s.locked }))}
                  className="size-7"
                >
                  {split.locked ? <Lock size={13} /> : <Unlock size={13} />}
                </IconBtn>
                <IconBtn
                  label={split.synced ? "Disable zoom sync" : "Sync zoom across panes"}
                  pressed={split.synced}
                  active={split.synced}
                  onClick={() =>
                    setSplit((s) => ({ ...s, synced: !s.synced, compareZoom: !s.synced ? s.primaryZoom : s.compareZoom }))
                  }
                  className="size-7"
                >
                  <Columns2 size={13} />
                </IconBtn>
                <button
                  type="button"
                  aria-label="Exit Split View"
                  title="Exit Split View"
                  onClick={() => setSplit((s) => ({ ...s, open: false }))}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-[#F6F6F6] hover:text-gray-900"
                >
                  <X size={13} /> Exit Split View
                </button>
              </div>
            </div>
          )}

          {/* ── Blend comparison panel ── */}
          {blendPanelOpen && !split.open && (
            <BlendComparisonPanel
              blendMode={blendMode}
              amount={blendAmount}
              sheets={sheets}
              sheetCode={sheet.code}
              revision={currentRevision}
              compareIndex={compareSheetIndex}
              blendReady={Boolean(blendReady)}
              onModeChange={setBlendMode}
              onAmountChange={setBlendAmount}
              onCompareIndexChange={setCompareSheetIndex}
              onReset={() => setBlendAmount(50)}
              onOpenSplit={() => setSplit((s) => ({ ...s, open: true }))}
              onClose={() => {
                setBlendPanelOpen(false);
                setBlendMode(null);
              }}
            />
          )}

          {recStatus === REC_STATUS.RECORDING && (
            <button
              type="button"
              aria-label="Stop recording"
              title="Stop recording"
              onClick={stopRecording}
              className="absolute bottom-16 right-4 z-30 flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xl hover:bg-red-500"
            >
              <span className="size-2 animate-pulse rounded-full bg-white" />
              <Square size={13} fill="currentColor" /> Stop · {formatClock(recSeconds)}
            </button>
          )}

          {/* ── Page switcher — fixed to the viewer, never inside the pan/zoom surface ── */}
          {pdfPageCount > 1 && !split.open && (
            <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 rounded-full bg-white/95 p-1 shadow-xl ring-1 ring-black/5">
              <IconBtn
                label="Previous page"
                disabled={pdfPage <= 1}
                onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                className="size-8"
              >
                <ChevronLeft size={15} />
              </IconBtn>
              <span className="min-w-16 text-center font-mono text-xs text-gray-700">
                {pdfPage} / {pdfPageCount}
              </span>
              <IconBtn
                label="Next page"
                disabled={pdfPage >= pdfPageCount}
                onClick={() => setPdfPage((p) => Math.min(pdfPageCount, p + 1))}
                className="size-8"
              >
                <ChevronRight size={15} />
              </IconBtn>
            </div>
          )}

          {commentAnchor && (
            <CommentComposerPopover
              anchor={{ x: commentAnchor.x, y: commentAnchor.y }}
              assignees={assignees}
              color={markupColor}
              projectId={projectId}
              busy={createMarkup.isPending || addMarkupComment.isPending || uploadFile.isPending}
              onCancel={() => setCommentAnchor(null)}
              onSubmit={(capture) => void submitPinComment(capture)}
            />
          )}
        </section>

        <ReviewNotesPanel
          open={notesPanelOpen}
          onToggle={() => setNotesPanelOpen((o) => !o)}
          notes={{ items: orderedNotes, commentCount, recordingCount }}
          recording={{
            playProgress,
            onStart: startRecording,
            onPlay: playRecording,
            onClear: clearRecording,
          }}
          composer={{
            value: noteDraft,
            onChange: setNoteDraft,
            onSubmit: submitComment,
            inputRef: composerRef,
            pinnedSheetCode: pendingPinId ? sheet.code : null,
          }}
          onOpenNote={(note) => {
            const index = sheets.findIndex((s) => s.id === note.sheetId);
            if (index >= 0) goToSheet(index);
          }}
          sheetCodeFor={(sheetId) => sheets.find((s) => s.id === sheetId)?.code ?? "—"}
        />
      </div>

      {/* ── Status bar ── */}
      <footer
        role="status"
        aria-live="polite"
        className="flex shrink-0 items-center gap-3 border-t border-[#F0F0F0] bg-white px-3 py-1.5 text-[11px] text-gray-500"
      >
        <span className="flex items-center gap-1.5">
          {recStatus === REC_STATUS.RECORDING ? (
            <span className="size-2 animate-pulse rounded-full bg-red-500" />
          ) : (
            <Check size={12} className="text-green-600" />
          )}
          {saveState}
        </span>
        <span className="mx-auto truncate text-gray-700">{contextState}</span>
        <span className="flex shrink-0 items-center gap-2">
          Tool: {activeToolLabel}
          {!markupVisible && <span className="flex items-center gap-1 text-amber-600"><EyeOff size={11} /> Markup hidden</span>}
        </span>
      </footer>
    </main>
  );
}

