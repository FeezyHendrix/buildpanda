import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { MARKUP_KIND, type DrawingMarkup } from "@/api/drawing-markup";
import type { PreconBoqRow } from "@/api/precon";
import { useAbility } from "@/contexts/ability-context";
import { useAddPreconMarkupComment, useCreatePreconMarkup, usePreconMarkups } from "@/hooks/use-precon-markups";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { CommentPin } from "@/pages/plan-review/plan-review-pin";
import { PinComposerPopover } from "./pin-composer-popover";
import { PinThreadPopover } from "./pin-thread-popover";
import type { PopoverAnchor } from "./pin-popover";

const OPEN_COLOR = "#004DE7";
const RESOLVED_COLOR = "#9CA3AF";

export interface PinLayerProps {
  sessionId: string;
  /** The sheet on screen; pins are filtered to it and new pins anchor to it. */
  sheetId: string;
  /** Canvas size in pixels — the same values SheetOverlay receives. */
  widthPx: number;
  heightPx: number;
  /** Sheet points → canvas pixels (the viewer's `toPx`). */
  toPx: (pt: number[]) => [number, number];
  /** Canvas pixels → sheet points (the viewer's `toPt`); new pins are stored in sheet points. */
  toPt: (pxX: number, pxY: number) => [number, number];
  /** The transform wrapper's scale, so pins keep a constant on-screen size. */
  cssZoom: number;
  /** True while the Comment tool (N) is active: a click on the sheet drops a pin. */
  placing: boolean;
  /** The bill line a new pin attaches to (the selected row at pin time). */
  selectedRowId: string | null;
  rowById: ReadonlyMap<string, PreconBoqRow>;
  /** Called once a new pin and its first comment are saved (return the palette to Select). */
  onPlaced?: () => void;
  /** Clicking a pin that carries a bill line selects that line. */
  onSelectRow?: (rowId: string) => void;
}

interface Draft {
  sheetId: string;
  at: [number, number];
  anchor: PopoverAnchor;
}

export function lineLabelFor(rowId: string | null, rowById: ReadonlyMap<string, PreconBoqRow>): string | null {
  if (!rowId) return null;
  const row = rowById.get(rowId);
  if (!row) return "a line no longer on the bill";
  return row.code ? `${row.code} · ${row.description}` : row.description;
}

function pinLabel(markup: DrawingMarkup): string {
  const n = markup.comments.length;
  return `${n} comment${n === 1 ? "" : "s"}${markup.resolvedAt ? " · resolved" : ""}`;
}

function anchorBelow(el: Element): PopoverAnchor {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.bottom + 8 };
}

/**
 * Pinned comments over a take-off sheet. Render inside the viewer's transform
 * wrapper next to SheetOverlay; give it `key={sheetId}` so drafts reset when
 * the sheet changes. Reads/writes go through the drawing-markup register.
 */
export function PinLayer({
  sessionId,
  sheetId,
  widthPx,
  heightPx,
  toPx,
  toPt,
  cssZoom,
  placing,
  selectedRowId,
  rowById,
  onPlaced,
  onSelectRow,
}: PinLayerProps) {
  const canEdit = useAbility().can("edit", "takeoffs");
  const { data: markups = [] } = usePreconMarkups(sessionId);
  const createMarkup = useCreatePreconMarkup(sessionId);
  const addComment = useAddPreconMarkupComment(sessionId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState<{ id: string; anchor: PopoverAnchor } | null>(null);

  const pins = useMemo(
    () => markups.filter((m) => m.preconSheetId === sheetId && m.geometry.kind === MARKUP_KIND.PIN),
    [markups, sheetId],
  );
  const openMarkup = open ? (pins.find((m) => m.id === open.id) ?? null) : null;
  const activeDraft = draft?.sheetId === sheetId ? draft : null;
  const capturing = placing && canEdit && !activeDraft;
  const counterScale = 1 / Math.max(cssZoom, 0.01);

  function dropPin(e: React.MouseEvent<HTMLDivElement>): void {
    if (!capturing) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = rect.width / widthPx;
    const at = toPt((e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale);
    setOpen(null);
    setDraft({ sheetId, at, anchor: { x: e.clientX, y: e.clientY + 12 } });
  }

  async function saveDraft(body: string): Promise<void> {
    if (!activeDraft) return;
    try {
      const markup = await createMarkup.mutateAsync({
        sheetId,
        rowId: selectedRowId,
        kind: MARKUP_KIND.PIN,
        geometry: { kind: MARKUP_KIND.PIN, at: { x: activeDraft.at[0], y: activeDraft.at[1] } },
      });
      await addComment.mutateAsync({ markupId: markup.id, body });
      setDraft(null);
      onPlaced?.();
    } catch (error) {
      toast(getApiErrorMessage(error, "Could not save the comment."), "error");
    }
  }

  function openThread(e: React.MouseEvent, markup: DrawingMarkup): void {
    e.stopPropagation();
    setDraft(null);
    setOpen({ id: markup.id, anchor: anchorBelow(e.currentTarget) });
    if (markup.preconRowId) onSelectRow?.(markup.preconRowId);
  }

  return (
    <div
      className={cn("absolute left-0 top-0", capturing ? "cursor-crosshair" : "pointer-events-none")}
      style={{ width: widthPx, height: heightPx }}
      onClick={dropPin}
      onMouseDown={(e) => {
        if (capturing) e.stopPropagation();
      }}
    >
      {pins.map((markup) => {
        if (markup.geometry.kind !== MARKUP_KIND.PIN) return null;
        const [x, y] = toPx([markup.geometry.at.x, markup.geometry.at.y]);
        return (
          <div
            key={markup.id}
            className="pointer-events-auto absolute"
            style={{ left: x, top: y, transform: `scale(${counterScale})`, transformOrigin: "0 0" }}
          >
            <CommentPin
              color={markup.resolvedAt ? RESOLVED_COLOR : markup.color || OPEN_COLOR}
              label={pinLabel(markup)}
              selected={open?.id === markup.id}
              draggable={false}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => openThread(e, markup)}
            />
          </div>
        );
      })}
      {activeDraft ? (
        <div
          className="pointer-events-none absolute"
          style={{ left: toPx(activeDraft.at)[0], top: toPx(activeDraft.at)[1], transform: `scale(${counterScale})`, transformOrigin: "0 0" }}
        >
          <CommentPin color={OPEN_COLOR} label="New comment" selected draggable={false} />
        </div>
      ) : null}

      {activeDraft ? (
        <PinComposerPopover
          anchor={activeDraft.anchor}
          lineLabel={lineLabelFor(selectedRowId, rowById)}
          color={OPEN_COLOR}
          busy={createMarkup.isPending || addComment.isPending}
          onCancel={() => setDraft(null)}
          onSubmit={(body) => void saveDraft(body)}
        />
      ) : null}
      {openMarkup && open ? (
        <PinThreadPopover
          anchor={open.anchor}
          sessionId={sessionId}
          markup={openMarkup}
          lineLabel={lineLabelFor(openMarkup.preconRowId, rowById)}
          canEdit={canEdit}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}
PinLayer.displayName = "PinLayer";
