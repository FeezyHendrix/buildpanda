import { useRef, useState } from "react";
import { MARKUP_KIND, type DrawingMarkup, type MarkupGeometry } from "@/api/drawing-markup";
import type {
  useCreateDrawingMarkup,
  useDeleteDrawingMarkup,
  useDrawingMarkups,
} from "@/hooks/use-drawing-markup";
import { generateId, type Pt, type Sheet } from "./plan-review-data";
import { hitTestMarkup, type Markup } from "./plan-review-markup";
import { SELECTION_KIND, TOOL, type Pin, type Selection, type Tool } from "./plan-review-types";
import { usePersistedMarkup } from "./use-persisted-markup";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import type { ReviewTools } from "./use-review-tools";


/** Pen samples closer than this (in sheet percent) are dropped, so a stroke stays a light polyline. */
const PEN_MIN_STEP_PCT = 0.4;
/** Vertical offset from the click so the comment popover clears the pointer. */
const COMMENT_ANCHOR_OFFSET_PX = 14;

function reportSaveError(error: unknown): void {
  toast(getApiErrorMessage(error, "Could not save this annotation"), "error");
}

/** Where a comment popover is anchored: viewport position plus the sheet point it marks. */
export interface CommentAnchor {
  x: number;
  y: number;
  at: Pt;
}

/** A persisted markup whose thread is open, and where on screen the popover hangs. */
export interface ThreadTarget {
  id: string;
  anchor: { x: number; y: number };
}

export type PersistMarkup = (
  tool: "pen" | "cloud" | "measure" | "pin",
  geometry: MarkupGeometry,
) => Promise<string | null>;

interface MarkupToolsArgs {
  tools: ReviewTools;
  sheet: Sheet | null;
  projectId: string | undefined;
  /** PDF page the markup belongs to; image sheets stay on page 1. */
  pageNo: number;
  drawingRef: React.RefObject<HTMLDivElement | null>;
  /** Locate a pointer event in sheet-percentage space; null when the canvas is not mounted. */
  pointFromEvent: (e: { clientX: number; clientY: number }) => Pt | null;
  markupQuery: ReturnType<typeof useDrawingMarkups>;
  createMarkup: ReturnType<typeof useCreateDrawingMarkup>;
  deleteMarkup: ReturnType<typeof useDeleteDrawingMarkup>;
  pins: Pin[];
  setPins: React.Dispatch<React.SetStateAction<Pin[]>>;
  setCommentAnchor: React.Dispatch<React.SetStateAction<CommentAnchor | null>>;
  /** Open (or close, with null) the thread of a persisted markup. */
  setThreadTarget: (target: ThreadTarget | null) => void;
}

export interface MarkupToolsController {
  activeTool: Tool;
  markupColor: string;
  setMarkupColor: React.Dispatch<React.SetStateAction<string>>;
  markupVisible: boolean;
  setMarkupVisible: React.Dispatch<React.SetStateAction<boolean>>;
  /** Local (unsaved) markup only — server markup arrives through the query. */
  markups: Markup[];
  draft: Markup | null;
  measureStart: Pt | null;
  setMeasureStart: React.Dispatch<React.SetStateAction<Pt | null>>;
  selection: Selection;
  setSelection: React.Dispatch<React.SetStateAction<Selection>>;
  isPanning: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** Persisted markup for the active sheet unioned with anything still local. */
  sheetMarkups: Markup[];
  sheetPins: Pin[];
  /** The server records behind the persisted pins and markup, by id. */
  serverMarkups: ReadonlyMap<string, DrawingMarkup>;
  /** Resolved, or raised on a superseded revision — drawn faded. */
  dimmedIds: ReadonlySet<string>;
  /** Open a persisted markup's thread; a no-op for local (unsaved) markup. */
  openThread: (id: string, anchor: { x: number; y: number }) => void;
  /** The rubber-band line drawn between the first measure click and the cursor. */
  measureDraft: Markup | null;
  selectTool: (tool: Tool) => void;
  /** Drop any in-progress selection, measurement or stroke — used when the sheet changes. */
  resetTransient: () => void;
  deleteSelection: () => void;
  persistMarkup: PersistMarkup;
  handleDrawingClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  handlePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  handlePointerUp: () => void;
  handlePinPointerDown: (e: React.PointerEvent, pinId: string) => void;
}

/**
 * The drawing engine for the review workspace: the active tool, the markup a
 * reviewer draws, and every pointer gesture over the sheet. Server markup is the
 * source of truth; local state only holds the in-progress draft and any markup on
 * a demo sheet that has no document behind it. The page owns local demo pins; persisted comments use the shared thread UI.
 */
export function useMarkupTools({
  sheet,
  projectId,
  pageNo,
  drawingRef,
  pointFromEvent,
  markupQuery,
  createMarkup,
  deleteMarkup,
  pins,
  setPins,
  setCommentAnchor,
  setThreadTarget,
  tools,
}: MarkupToolsArgs): MarkupToolsController {
  const { activeTool, setActiveTool, markupColor, setMarkupColor, markupVisible, setMarkupVisible } = tools;
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [draft, setDraft] = useState<Markup | null>(null);
  const [measureStart, setMeasureStart] = useState<Pt | null>(null);
  const [measureCursor, setMeasureCursor] = useState<Pt | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [isPanning, setIsPanning] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const penPoints = useRef<Pt[]>([]);
  const draggingPin = useRef<string | null>(null);
  const suppressNextClick = useRef(false);

  /** Server markup is the source of truth; local state only holds the in-progress draft. */
  const persisted = usePersistedMarkup(markupQuery.data);
  const serverMarkups = persisted.byId;
  const sheetPins = sheet ? [...persisted.pins, ...pins.filter((p) => p.sheetId === sheet.id)] : [];
  const sheetMarkups = sheet
    ? [...persisted.markups, ...markups.filter((m) => m.sheetId === sheet.id)]
    : [];

  function resetTransient(): void {
    setSelection(null);
    setThreadTarget(null);
    setMeasureStart(null);
    setDraft(null);
    setMeasureCursor(null);
    setCommentAnchor(null);
    penPoints.current = [];
    panStart.current = null;
    draggingPin.current = null;
    suppressNextClick.current = false;
    setIsPanning(false);
  }

  function selectTool(tool: Tool): void {
    resetTransient();
    setActiveTool(tool);
  }

  function openThread(id: string, anchor: { x: number; y: number }): void {
    const record = serverMarkups.get(id);
    if (!record) return;
    setSelection({ kind: record.kind === MARKUP_KIND.PIN ? SELECTION_KIND.PIN : SELECTION_KIND.MARKUP, id });
    setThreadTarget({ id, anchor });
  }

  function deleteSelection(): void {
    if (!selection) return;
    const isPersisted = serverMarkups.has(selection.id);
    setThreadTarget(null);
    if (isPersisted) {
      deleteMarkup.mutate(selection.id);
    } else if (selection.kind === SELECTION_KIND.PIN) {
      setPins((p) => p.filter((pin) => pin.id !== selection.id));
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
      pageNo,
      kind: tool,
      geometry,
      color: markupColor,
    });
    return created.id;
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
      setCommentAnchor({ x: e.clientX, y: e.clientY + COMMENT_ANCHOR_OFFSET_PX, at: point });
      return;
    }

    if (activeTool === TOOL.MEASURE) {
      if (!measureStart) {
        setMeasureStart(point);
        setMeasureCursor(point);
      } else {
        if (Math.hypot(point.x - measureStart.x, point.y - measureStart.y) > 0) {
          void persistMarkup("measure", { kind: "measure", a: measureStart, b: point }).catch(reportSaveError);
        }
        setMeasureStart(null);
        setMeasureCursor(null);
      }
      return;
    }

    if (activeTool === TOOL.SELECT) {
      const hit = hitTestMarkup(sheetMarkups, point);
      setSelection(hit ? { kind: SELECTION_KIND.MARKUP, id: hit.id } : null);
      if (hit && serverMarkups.has(hit.id)) {
        setThreadTarget({ id: hit.id, anchor: { x: e.clientX, y: e.clientY + COMMENT_ANCHOR_OFFSET_PX } });
      } else {
        setThreadTarget(null);
      }
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
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>): void {
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
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < PEN_MIN_STEP_PCT) return;
      penPoints.current = [...penPoints.current, point];
      setDraft({ id: "draft", sheetId: sheet.id, tool: "pen", color: markupColor, points: penPoints.current });
      return;
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
      void persistMarkup("pen", { kind: "pen", points: penPoints.current }).catch(reportSaveError);
    }
    penPoints.current = [];
    setDraft(null);
  }

  function handlePinPointerDown(e: React.PointerEvent, pinId: string): void {
    if (activeTool !== TOOL.SELECT) return;
    e.stopPropagation();
    setSelection({ kind: SELECTION_KIND.PIN, id: pinId });
    draggingPin.current = pinId;
    drawingRef.current?.setPointerCapture(e.pointerId);
  }

  const measureDraft: Markup | null =
    sheet && activeTool === TOOL.MEASURE && measureStart && measureCursor
      ? { id: "draft-measure", sheetId: sheet.id, tool: "measure", color: markupColor, a: measureStart, b: measureCursor }
      : null;

  return {
    activeTool,
    markupColor,
    setMarkupColor,
    markupVisible,
    setMarkupVisible,
    markups,
    draft,
    measureStart,
    setMeasureStart,
    selection,
    setSelection,
    isPanning,
    canvasRef,
    sheetMarkups,
    sheetPins,
    serverMarkups,
    dimmedIds: persisted.dimmedIds,
    openThread,
    measureDraft,
    selectTool,
    resetTransient,
    deleteSelection,
    persistMarkup,
    handleDrawingClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePinPointerDown,
  };
}
