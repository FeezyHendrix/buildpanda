import { Button } from "@/components/atoms/button";
import { scaleRatioOf } from "@/lib/precon-meta";
import type { CalibrationPreview } from "@/api/precon-editor";

interface Props {
  preview: CalibrationPreview;
  applying: boolean;
  onApply: () => void;
  onCancel: () => void;
  /** Opens the line in the inspector, where its basis is confirmed explicitly. */
  onOpenRow: (rowId: string) => void;
}

const num = (value: number | null) => (value === null ? "—" : String(Math.round(value * 100) / 100));

/**
 * Contract 12's "committed having been seen": every line's before/after at the
 * proposed scale, the unresolved legacy lines that block the apply (each links
 * to the inspector for its explicit basis confirmation), and an Apply pinned
 * to this preview's token — figures change only after they were shown.
 */
export function CalibrationPreviewPanel({ preview, applying, onApply, onCancel, onOpenRow }: Props) {
  return (
    <div className="absolute right-3 top-3 z-20 flex w-96 max-h-[calc(100%-1.5rem)] flex-col gap-2 overflow-y-auto rounded-lg border border-line bg-white p-3 shadow-lg" data-calibration-preview onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div>
        <p className="text-sm font-semibold text-gray-900">
          Re-scale to 1:{scaleRatioOf(preview.newScaleMmPerPt)}
          {preview.currentScaleMmPerPt ? ` (from 1:${scaleRatioOf(preview.currentScaleMmPerPt)})` : " (first calibration)"}
        </p>
        <p className="text-xs text-gray-500">
          {preview.affectedRows.length} line{preview.affectedRows.length === 1 ? "" : "s"} would be restated. Nothing changes until Apply.
        </p>
      </div>

      {preview.affectedRows.length > 0 ? (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[11px] font-semibold capitalize text-gray-500">
              <th className="py-1">Line</th>
              <th className="py-1 text-right">Gross</th>
              <th className="py-1 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {preview.affectedRows.map((row) => (
              <tr key={row.rowId} className="border-t border-line-hair" data-preview-row={row.rowId}>
                <td className="max-w-40 truncate py-1 pr-2 text-gray-800">
                  {row.description}
                  <span className="ml-1 text-[10px] text-gray-400">×{row.contributions}</span>
                </td>
                <td className="py-1 text-right tabular-nums text-gray-700">
                  {num(row.currentQtyGross)} → <span className="font-semibold">{num(row.newQtyGross)}</span>
                </td>
                <td className="py-1 text-right tabular-nums text-gray-700">
                  {num(row.currentQty)} → <span className="font-semibold">{num(row.newQty)}</span> {row.unit ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-gray-500">No measured line is affected on this drawing.</p>
      )}

      {preview.legacySuggestions.length > 0 ? (
        <div className="rounded-md bg-surface-alt p-2" data-legacy-suggestions>
          <p className="text-xs font-semibold text-gray-700">Previous selection rule, unconfirmed</p>
          {preview.legacySuggestions.map((sug) => (
            <button key={sug.geometryId} type="button" className="mt-0.5 block text-xs text-gray-700 underline" onClick={() => onOpenRow(sug.rowId)}>
              Legacy shape: old rule suggests {sug.proposedViewportId ? `region ${sug.proposedViewportId}` : "the sheet scale"} — confirm explicitly in the inspector
            </button>
          ))}
        </div>
      ) : null}
      {preview.rebindSuggestions.length > 0 ? (
        <div className="rounded-md bg-surface-alt p-2" data-rebind-suggestions>
          <p className="text-xs font-semibold text-gray-700">Shapes sitting over a different region than they record</p>
          {preview.rebindSuggestions.map((sug) => (
            <p key={sug.geometryId} className="mt-0.5 text-xs text-gray-600">
              {sug.proposedViewportId ? `Proposed: region ${sug.proposedViewportId}` : "Proposed: the sheet scale"} (unconfirmed — no rebind command exists yet; correct via an explicit shape edit)
            </p>
          ))}
        </div>
      ) : null}
      {preview.unresolvedRowIds.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2" data-unresolved-rows>
          <p className="text-xs font-semibold text-amber-800">
            {preview.unresolvedRowIds.length} line{preview.unresolvedRowIds.length === 1 ? "" : "s"} record no measurement basis, so their figures cannot be restated{preview.blocked ? " — the apply is blocked until each is confirmed" : ""}.
          </p>
          <ul className="mt-1 space-y-0.5">
            {preview.unresolvedRowIds.map((rowId) => (
              <li key={rowId}>
                <button type="button" className="text-xs text-amber-900 underline" onClick={() => onOpenRow(rowId)}>
                  Confirm this line's basis in the inspector
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" loading={applying} disabled={preview.blocked} title={preview.blocked ? "Confirm every unresolved line first" : undefined} onClick={onApply}>
          Apply this scale
        </Button>
      </div>
    </div>
  );
}
CalibrationPreviewPanel.displayName = "CalibrationPreviewPanel";
