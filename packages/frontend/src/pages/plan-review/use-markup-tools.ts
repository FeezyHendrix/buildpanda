import { useMemo, useRef, useState } from "react";
import { MARKUP_KIND, type MarkupGeometry } from "@/api/drawing-markup";
import type {
  useCreateDrawingMarkup,
  useDeleteDrawingMarkup,
  useDrawingMarkups,
} from "@/hooks/use-drawing-markup";
import { generateId, type Pt, type Sheet } from "./plan-review-data";
import { hitTestMarkup, normalizedRect, type Markup } from "./plan-review-markup";
import {
  SELECTION_KIND,
  TOOL,
  toLocalMarkup,
  type Note,
  type Pin,
  type Selection,
  type Tool,
} from "./plan-review-types";

const DEFAULT_MARKUP_COLOR = "#004DE7";
/** Pen samples closer than this (in sheet percent) are dropped, so a stroke stays a light polyline. */
const PEN_MIN_STEP_PCT = 0.4;
/** A cloud smaller than this in either axis is treated as a stray click, not a markup. */
const CLOUD_MIN_SIZE_PCT = 1;
/** Vertical offset from the click so the comment popover clears the pointer. */
const COMMENT_ANCHOR_OFFSET_PX = 14;

/** Where a comment popover is anchored: viewport position plus the sheet point it marks. */
export interface CommentAnchor {
  x: number;
  y: number;
  at: Pt;
}

export type PersistMarkup = (
  tool: "pen" | "cloud" | "measure" | "pin",
  geometry: MarkupGeometry,
) => Promise<string | null>;

interface MarkupToolsArgs {
  sheet: Sheet | null;
  projectId: string | undefined;
  /** PDF page the markup belongs to; image sheets stay on page 1. */
  pageNo: number;
  drawingRef: React.RefObject<HTMLDivElement | null>;
  /** Locate a pointer event in sheet-percentage space; null when the canvas is not mounted. */
  pointFromEvent: (e: { clientX: number; clientY: number }) => Pt | null;
  /** Walkthrough recorder hook-in, sampled on every pointer move over the sheet. */
  captureTrace: (e: { clientX: number; clientY: number }) => void;
  markupQuery: ReturnType<typeof useDrawingMarkups>;
  createMarkup: ReturnType<typeof useCreateDrawingMarkup>;
  deleteMarkup: ReturnType<typeof useDeleteDrawingMarkup>;
  pins: Pin[];
  setPins: React.Dispatch<React.SetStateAction<Pin[]>>;
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  pendingPinId: string | null;
  setPendingPinId: React.Dispatch<React.SetStateAction<string | null>>;
  setCommentAnchor: React.Dispatch<React.SetStateAction<CommentAnchor | null>>;
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
 * a demo sheet that has no document behind it. Pins and notes are owned by the
 * page because the comment composer and notes panel share them.
 */
export function useMarkupTools({
  sheet,
  projectId,
  pageNo,
  drawingRef,
  pointFromEvent,
  captureTrace,
  markupQuery,
  createMarkup,
  deleteMarkup,
  pins,
  setPins,
  setNotes,
  pendingPinId,
  setPendingPinId,
  setCommentAnchor,
}: MarkupToolsArgs): MarkupToolsController {
  const [activeTool, setActiveTool] = useState<Tool>(TOOL.SELECT);
  const [markupColor, setMarkupColor] = useState(DEFAULT_MARKUP_COLOR);
  const [markupVisible, setMarkupVisible] = useState(true);
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [draft, setDraft] = useState<Markup | null>(null);
  const [measureStart, setMeasureStart] = useState<Pt | null>(null);
  const [measureCursor, setMeasureCursor] = useState<Pt | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [isPanning, setIsPanning] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const penPoints = useRef<Pt[]>([]);
  const cloudOrigin = useRef<Pt | null>(null);
  const draggingPin = useRef<string | null>(null);
  const suppressNextClick = useRef(false);

  /** Server markup is the source of truth; local state only holds the in-progress draft. */
  const persisted = useMemo(() => toLocalMarkup(markupQuery.data ?? []), [markupQuery.data]);
  const sheetPins = sheet ? [...persisted.pins, ...pins.filter((p) => p.sheetId === sheet.id)] : [];
  const sheetMarkups = sheet
    ? [...persisted.markups, ...markups.filter((m) => m.sheetId === sheet.id)]
    : [];

  function resetTransient(): void {
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
    captureTrace(e);

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
    if (
      activeTool === TOOL.CLOUD &&
      draft?.tool === MARKUP_KIND.CLOUD &&
      draft.rect.w > CLOUD_MIN_SIZE_PCT &&
      draft.rect.h > CLOUD_MIN_SIZE_PCT
    ) {
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
