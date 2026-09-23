import { useRef, useState } from "react";
import type { PreconTool } from "@/lib/precon-meta";
import { useRoomAt, useSymbolMatches } from "@/hooks/use-precon";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-error";
import type { PendingMeasurement } from "./measurement-composer";
import { moveVertex } from "./saved-edit-model";
import {
  duplicateIndices,
  emptyReview,
  keptWithManual,
  requestGuard,
  stepCurrent,
  toggleDropped,
  toggleManualAt,
  type SymbolReview,
} from "./detection-model";

const DUPLICATE_THRESHOLD_PT = 6;
const MANUAL_TOGGLE_THRESHOLD_PT = 6;

/** A detected room awaiting Accept / Edit boundary / Cancel — nothing is persisted yet. */
export interface RoomPreview {
  vertices: number[][];
  label: string | null;
  areaM2: number;
  selectedVertex: number | null;
}

/** The template box, awaiting an explicit Search — nothing has been sent. */
export interface SymbolTemplate {
  rect: [number, number, number, number];
}

export type DuplicateWarning = { indices: ReadonlySet<number>; existingCount: number };

interface Args {
  activeSheet: { id: string } | null;
  tool: PreconTool;
  /** Every saved count marker on this sheet (all rows) — the duplicate check's baseline. */
  existingCountPoints: number[][];
  setPending: (pending: PendingMeasurement | null) => void;
  setNote: (note: string | null) => void;
  onFallbackToArea: () => void;
}

/**
 * Room fill and Find symbol as CORRECTABLE workflows: a detection lands in a
 * review state with explicit Accept / repair / Cancel controls, never straight
 * into a saved row. Every async answer is bound to the sheet, tool and request
 * that fired it — a stale answer changes nothing on screen.
 */
export function useDetectionTools({ activeSheet, tool, existingCountPoints, setPending, setNote, onFallbackToArea }: Args) {
  const sheetId = activeSheet?.id ?? null;
  const roomAt = useRoomAt(sheetId);
  const symbolMatches = useSymbolMatches(sheetId);
  const guardRef = useRef(requestGuard());
  const [room, setRoom] = useState<RoomPreview | null>(null);
  const [template, setTemplate] = useState<SymbolTemplate | null>(null);
  const [review, setReview] = useState<SymbolReview | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateWarning | null>(null);
  const [noRoomFound, setNoRoomFound] = useState(false);

  const reset = () => {
    guardRef.current.invalidate();
    setRoom(null);
    setTemplate(null);
    setReview(null);
    setDuplicates(null);
    setNoRoomFound(false);
  };

  // ── Room fill ──────────────────────────────────────────────────────────────
  const roomFillAt = (pt: [number, number]) => {
    if (!sheetId) return;
    setNoRoomFound(false);
    const ticket = guardRef.current.begin(sheetId, tool);
    roomAt.mutate(
      { x: pt[0], y: pt[1] },
      {
        onSuccess: (result) => {
          if (!guardRef.current.isLive(ticket)) return;
          setRoom({ vertices: result.vertices.map((v) => [...v]), label: result.label, areaM2: result.areaM2, selectedVertex: null });
        },
        onError: (error) => {
          if (!guardRef.current.isLive(ticket)) return;
          if (getApiErrorStatus(error) === 404) setNoRoomFound(true);
          else setNote(getApiErrorMessage(error, "Could not find the space"));
        },
      },
    );
  };

  const roomMoveVertex = (index: number, pt: number[]) =>
    setRoom((current) => (current ? { ...current, vertices: moveVertex(current.vertices, index, pt), selectedVertex: index } : current));

  const roomAccept = () => {
    if (!room) return;
    setPending({ tool: "area", vertices: room.vertices, description: room.label ?? "" });
    setRoom(null);
  };

  // ── Find symbol ────────────────────────────────────────────────────────────
  const startTemplate = (rect: [number, number, number, number]) => {
    setDuplicates(null);
    setReview(null);
    setTemplate({ rect });
  };

  const searchTemplate = () => {
    if (!sheetId || !template) return;
    const ticket = guardRef.current.begin(sheetId, tool);
    symbolMatches.mutate(template.rect, {
      onSuccess: (result) => {
        if (!guardRef.current.isLive(ticket)) return;
        setTemplate(null);
        if (result.points.length === 0) {
          setNote("No symbol found in that box — drag tighter round one symbol, or place markers by hand with Count (C).");
          return;
        }
        setReview(emptyReview(result.name, result.points));
      },
      onError: (error) => {
        if (!guardRef.current.isLive(ticket)) return;
        setNote(getApiErrorMessage(error, "Could not search the sheet"));
      },
    });
  };

  const patchReview = (updater: (current: SymbolReview) => SymbolReview) => {
    setDuplicates(null);
    setReview((current) => (current ? updater(current) : current));
  };

  /** True when the click was consumed by add-missed mode (a manual marker toggled). */
  const captureCanvasClick = (pt: [number, number]): boolean => {
    if (!review?.addingMissed) return false;
    patchReview((current) => toggleManualAt(current, pt, MANUAL_TOGGLE_THRESHOLD_PT));
    return true;
  };

  const confirmCount = () => {
    if (!review) return;
    const combined = keptWithManual(review);
    if (combined.length === 0) return;
    const clashes = duplicateIndices(combined, existingCountPoints, DUPLICATE_THRESHOLD_PT);
    if (clashes.size > 0 && !review.override) {
      setDuplicates({ indices: clashes, existingCount: clashes.size });
      return;
    }
    setPending({ tool: "count", vertices: combined, description: `${review.name ?? "Symbol"} × ${combined.length}` });
    setReview(null);
    setDuplicates(null);
  };

  /** Drop exactly the clashing markers, then commit whatever remains. */
  const dropDuplicatesAndConfirm = () => {
    if (!review || !duplicates) return;
    const combined = keptWithManual(review);
    const remaining = combined.filter((_, i) => !duplicates.indices.has(i));
    setDuplicates(null);
    if (remaining.length === 0) {
      setNote("Every marker duplicated an already-counted one — nothing new to add.");
      setReview(null);
      return;
    }
    setPending({ tool: "count", vertices: remaining, description: `${review.name ?? "Symbol"} × ${remaining.length}` });
    setReview(null);
  };

  const overrideDuplicatesAndConfirm = () => {
    if (!review) return;
    setDuplicates(null);
    setReview({ ...review, override: true });
    const combined = keptWithManual(review);
    setPending({ tool: "count", vertices: combined, description: `${review.name ?? "Symbol"} × ${combined.length}` });
    setReview(null);
  };

  return {
    room,
    template,
    review,
    duplicates,
    noRoomFound,
    searching: roomAt.isPending || symbolMatches.isPending,
    reset,
    roomFillAt,
    roomMoveVertex,
    roomAccept,
    roomCancel: () => setRoom(null),
    fallbackToArea: () => {
      setNoRoomFound(false);
      onFallbackToArea();
    },
    startTemplate,
    searchTemplate,
    cancelTemplate: () => setTemplate(null),
    toggleMatch: (index: number) => patchReview((current) => toggleDropped(current, index)),
    rejectAll: () => patchReview((current) => ({ ...current, dropped: new Set(current.points.map((_, i) => i)) })),
    stepMatch: (delta: 1 | -1) => patchReview((current) => stepCurrent(current, delta)),
    toggleAddMissed: () => patchReview((current) => ({ ...current, addingMissed: !current.addingMissed })),
    captureCanvasClick,
    confirmCount,
    dropDuplicatesAndConfirm,
    overrideDuplicatesAndConfirm,
    discardReview: () => {
      setReview(null);
      setDuplicates(null);
    },
  };
}
