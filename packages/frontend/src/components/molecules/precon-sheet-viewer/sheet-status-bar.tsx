import type { PreconBoqRow, PreconSheet, SheetViewport } from "@/api/precon";
import { PRECON_TOOL_BY_KEY, scaleRatioOf, type PreconTool } from "@/lib/precon-meta";
import { runningTotal } from "./measure-maths";

interface Props {
  sheet: PreconSheet;
  tool: PreconTool;
  selectedRow: PreconBoqRow | null;
  /** The selected line will be redrawn instead of a new one created. */
  redrawing: boolean;
  onToggleRedraw: () => void;
  drawingEnabled: boolean;
  draft: number[][];
  /** The viewport the draft started in, whose scale it is measured with. */
  viewport?: SheetViewport | null;
  /** A tool that cannot run — the one just tried, else the active one — named on screen, never tooltip-only. */
  notice?: { toolLabel: string; reason: string } | null;
  /** Switches to Set scale; offered inline whenever the sheet has no scale. */
  onFixScale?: () => void;
}

const DRAW_HINT = "click to add points, Backspace removes the last, Enter to finish, Esc to cancel, Shift for ortho";
const ARC_HINT = "Alt-click for an arc";

function instruction(tool: PreconTool, selectedRow: PreconBoqRow | null, drawingEnabled: boolean): string | null {
  const meta = PRECON_TOOL_BY_KEY[tool];
  if (tool === "select") return null;
  if (tool === "scale") return "click two points a known distance apart, then Enter";
  if (tool === "viewports") return "drag a box round the detail, then give it a scale";
  if (!drawingEnabled) return null;
  if (tool === "deduct") return `draw the opening on “${selectedRow?.description ?? "the selected line"}”, Enter to apply`;
  if (tool === "typical") return `set how many floors or areas repeat “${selectedRow?.description ?? "the selected line"}”`;
  if (tool === "pen") return "drag on the sheet to draw; a note, not a measurement";
  if (tool === "comment") return selectedRow ? `click where the comment belongs; it attaches to “${selectedRow.description}”` : "click where the comment belongs";
  if (tool === "room_fill") return `${meta.label} · ${meta.unit} — click inside an enclosed space`;
  if (tool === "find_symbol") return `${meta.label} · ${meta.unit} — drag a box round one symbol`;
  if (tool === "legend" || tool === "magnifier" || tool === "overlay") return null;
  if (tool === "length") return `${meta.label} · ${meta.unit} — click two points, ${ARC_HINT}`;
  if (tool === "linear" || tool === "wall_area") return `${meta.label} · ${meta.unit} — ${DRAW_HINT}, ${ARC_HINT}`;
  if (tool === "area" || tool === "volume") return `${meta.label} · ${meta.unit} — ${DRAW_HINT}, or drag a rectangle`;
  return `${meta.label} · ${meta.unit} — ${DRAW_HINT}`;
}

/** Scale, what the current tool will do, and the running total while drawing. */
export function SheetStatusBar({ sheet, tool, selectedRow, redrawing, onToggleRedraw, drawingEnabled, draft, viewport = null, notice = null, onFixScale }: Props) {
  const mmPerPt = viewport?.scaleMmPerPt ?? sheet.scaleMmPerPt;
  const meta = PRECON_TOOL_BY_KEY[tool];
  const calibration = sheet.scaleConfidence === 1 ? "scale set by reviewer" : `calibration ${Math.round((sheet.scaleConfidence ?? 0) * 100)}%`;
  const canRedraw = Boolean(meta.measure && selectedRow && drawingEnabled);
  const total = meta.measure && draft.length > 0 && mmPerPt ? runningTotal(meta.measure, draft, mmPerPt) : null;
  const hint = instruction(tool, selectedRow, drawingEnabled);
  // A tool that cannot run has no instruction, so name it plainly rather than
  // leave the bar blank — the unscaled sheet used to state nothing at all.
  const toolLine = hint ?? (tool === "select" ? null : meta.unit ? `${meta.label} · ${meta.unit}` : meta.label);
  return (
    <p className="flex flex-wrap items-center gap-x-2 border-b border-line-hair px-3 py-1 text-xs text-ink-muted">
      <span>
        {sheet.scaleMmPerPt ? `1:${scaleRatioOf(sheet.scaleMmPerPt)} · dims in ${sheet.dimUnit ?? "mm"} · ${calibration}` : "no sheet scale yet — measuring needs one"}
        {viewport ? (
          <span className="text-ink-subtle">
            {" "}
            · in viewport {viewport.label} at 1:{scaleRatioOf(viewport.scaleMmPerPt)}
          </span>
        ) : null}
      </span>
      {canRedraw && redrawing ? (
        <span className="text-ink-subtle">
          — redrawing “{selectedRow?.description}” as {meta.label.toLowerCase()}
          <button type="button" className="ml-1 font-semibold text-primary-600 hover:underline" onClick={onToggleRedraw}>
            draw a new line instead
          </button>
        </span>
      ) : canRedraw ? (
        <span className="text-ink-subtle">
          — {hint}
          <button type="button" className="ml-1 font-semibold text-primary-600 hover:underline" onClick={onToggleRedraw}>
            redraw “{selectedRow?.description}” instead
          </button>
        </span>
      ) : toolLine ? (
        <span className="text-ink-subtle">— {toolLine}</span>
      ) : null}
      {notice ? (
        <span className="font-medium text-ink">
          · {notice.toolLabel} — {notice.reason}
        </span>
      ) : null}
      {!sheet.scaleMmPerPt && onFixScale ? (
        <button type="button" data-fix-scale="true" className="font-semibold text-primary-600 hover:underline" onClick={onFixScale}>
          Set scale
        </button>
      ) : null}
      {total ? <span className="ml-auto font-semibold tabular-nums text-ink">{total}</span> : null}
    </p>
  );
}
SheetStatusBar.displayName = "SheetStatusBar";
