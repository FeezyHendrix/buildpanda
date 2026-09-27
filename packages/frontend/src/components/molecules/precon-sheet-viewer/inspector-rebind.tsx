import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import type { PreconBoqRow, PreconSheet } from "@/api/precon";
import type { ScaleBinding } from "@/api/precon-row-types";
import { scaleRatioOf } from "@/lib/precon-meta";
import type { useRowCommands } from "./use-row-commands";

interface Props {
  row: PreconBoqRow;
  sheet: PreconSheet | null;
  /** The row's single measuring geometry — rebind targets a shape, not a line. */
  geometryId: string;
  binding: ScaleBinding;
  commands: ReturnType<typeof useRowCommands>;
}

const ratio = (mmPerPt: number | null | undefined) => (mmPerPt ? `1:${scaleRatioOf(mmPerPt)}` : "unscaled");

/**
 * Contract: a transform never changes a recorded binding; only THIS explicit
 * act does, and the figure will move. The new quantity is the SERVER's to
 * compute (openings re-cut against their parents; review returns when a
 * number moves), so the panel states the old figure and the scale change —
 * never a fabricated new one.
 */
export function InspectorRebind({ row, sheet, geometryId, binding, commands }: Props) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const viewports = sheet?.viewports ?? [];
  const current =
    binding.source === "sheet"
      ? `sheet scale (${ratio(binding.appliedMmPerPt)})`
      : `region ${viewports.find((v) => v.id === binding.viewportId)?.label ?? binding.viewportId} (${ratio(binding.appliedMmPerPt)})`;
  const options = [
    ...(binding.source === "sheet" ? [] : [{ id: "sheet", label: `Sheet scale (${ratio(sheet?.scaleMmPerPt)})` }]),
    ...viewports
      .filter((v) => !(binding.source === "viewport" && binding.viewportId === v.id))
      .map((v) => ({ id: v.id, label: `Region ${v.label ?? v.id} (${ratio(v.scaleMmPerPt)})` })),
  ];
  const scaleChoice = choice === "sheet" ? ({ source: "sheet" } as const) : ({ source: "viewport", viewportId: choice } as const);

  return (
    <div data-rebind>
      <p className="text-xs text-gray-600">
        Measured against <span className="font-medium text-gray-800">{current}</span>
      </p>
      {open ? (
        <div className="mt-1 rounded-md border border-line p-2">
          <label className="block text-xs font-medium text-gray-600">
            Re-measure against
            <select aria-label="Rebind scale source" className="mt-1 h-8 w-full rounded-md border border-line px-2 text-sm" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">choose a scale…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1.5 text-xs text-gray-500" data-rebind-preview>
            Now {row.qty ?? "—"} {row.unit ?? ""}. The server re-measures the shape and re-cuts its openings on apply — the new figure is
            computed there, and the line returns for review if it moves.
          </p>
          <div className="mt-1.5 flex gap-2">
            <Button size="sm" disabled={!choice} loading={commands.saving} onClick={() => setConfirming(true)}>
              Rebind…
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" className="text-xs text-primary-600 underline" onClick={() => setOpen(true)}>
          Change scale binding…
        </button>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Re-measure this line against a different scale?"
        description={`The figure (currently ${row.qty ?? "—"} ${row.unit ?? ""}) will be recomputed by the server and the line goes back for review if it changes. This is reversible from the history.`}
        confirmLabel="Rebind and re-measure"
        cancelLabel="Keep the current binding"
        onConfirm={() => {
          setConfirming(false);
          commands.rebindGeometry(row, geometryId, scaleChoice, () => setOpen(false));
        }}
      />
    </div>
  );
}
InspectorRebind.displayName = "InspectorRebind";
