import type { PreconBoqRow, PreconSheet } from "@/api/precon";
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
}

const DRAW_HINT = "click to add points, Enter to finish, Esc to cancel, Shift for ortho";

function instruction(tool: PreconTool, selectedRow: PreconBoqRow | null, drawingEnabled: boolean): string | null {
  const meta = PRECON_TOOL_BY_KEY[tool];
  if (tool === "select") return null;
  if (tool === "scale") return "click two points a known distance apart, then Enter";
  if (!drawingEnabled) return null;
  if (tool === "deduct") return `draw the opening on “${selectedRow?.description ?? "the selected line"}”, Enter to apply`;
  if (tool === "comment") return selectedRow ? `click where the comment belongs; it attaches to “${selectedRow.description}”` : "click where the comment belongs";
  if (tool === "legend" || tool === "magnifier") return null;
  if (tool === "length") return `${meta.label} · ${meta.unit} — click two points`;
  return `${meta.label} · ${meta.unit} — ${DRAW_HINT}`;
}

/** Scale, what the current tool will do, and the running total while drawing. */
export function SheetStatusBar({ sheet, tool, selectedRow, redrawing, onToggleRedraw, drawingEnabled, draft }: Props) {
  if (!sheet.scaleMmPerPt) return null;
  const meta = PRECON_TOOL_BY_KEY[tool];
  const calibration = sheet.scaleConfidence === 1 ? "scale set by reviewer" : `calibration ${Math.round((sheet.scaleConfidence ?? 0) * 100)}%`;
  const canRedraw = Boolean(meta.measure && selectedRow && drawingEnabled);
  const total = meta.measure && draft.length > 0 ? runningTotal(meta.measure, draft, sheet.scaleMmPerPt) : null;
  const hint = instruction(tool, selectedRow, drawingEnabled);
  return (
    <p className="flex flex-wrap items-center gap-x-2 border-b border-gray-100 px-3 py-1 text-[11px] text-gray-400">
      <span>
        1:{scaleRatioOf(sheet.scaleMmPerPt)} · dims in {sheet.dimUnit ?? "mm"} · {calibration}
      </span>
      {canRedraw && redrawing ? (
        <span className="text-gray-600">
          — redrawing “{selectedRow?.description}” as {meta.label.toLowerCase()}
          <button type="button" className="ml-1 font-semibold text-primary-600 hover:underline" onClick={onToggleRedraw}>
            draw a new line instead
          </button>
        </span>
      ) : canRedraw ? (
        <span className="text-gray-600">
          — {hint}
          <button type="button" className="ml-1 font-semibold text-primary-600 hover:underline" onClick={onToggleRedraw}>
            redraw “{selectedRow?.description}” instead
          </button>
        </span>
      ) : hint ? (
        <span>— {hint}</span>
      ) : null}
      {total ? <span className="ml-auto font-semibold tabular-nums text-gray-700">{total}</span> : null}
    </p>
  );
}
SheetStatusBar.displayName = "SheetStatusBar";
