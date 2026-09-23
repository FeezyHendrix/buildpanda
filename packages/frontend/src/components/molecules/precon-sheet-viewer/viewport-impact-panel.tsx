import { Button } from "@/components/atoms/button";
import type { ViewportPreview } from "@/api/precon-editor";

interface Props {
  preview: ViewportPreview;
  applying: boolean;
  onApply: (confirmed: boolean) => void;
  onCancel: () => void;
  /** Opens the unresolved line in the inspector for its explicit basis confirmation. */
  onOpenRow: (rowId: string) => void;
}

const num = (value: number | null) => (value === null ? "—" : String(Math.round(value * 100) / 100));

/**
 * What the proposed region set does before it does it: the lines a re-scaled
 * region restates (before/after), and the regions being withdrawn WITH the
 * measurements taken inside them — withdrawing those needs an explicit
 * confirmation, never a silent orphaning (contract 12).
 */
export function ViewportImpactPanel({ preview, applying, onApply, onCancel, onOpenRow }: Props) {
  return (
    <div className="absolute right-3 top-3 z-20 flex w-96 max-h-[calc(100%-1.5rem)] flex-col gap-2 overflow-y-auto rounded-lg border border-line bg-white p-3 shadow-lg" data-viewport-impact onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <p className="text-sm font-semibold text-gray-900">Scale region change</p>
      {preview.rescaled.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-gray-700">Lines restated by the new region scale</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {preview.rescaled.map((row) => (
              <li key={row.rowId} className="flex justify-between gap-2 border-t border-line-hair py-1" data-rescaled-row={row.rowId}>
                <span className="min-w-0 truncate text-gray-800">{row.description}</span>
                <span className="shrink-0 tabular-nums text-gray-700">
                  {num(row.currentQty)} → <span className="font-semibold">{num(row.newQty)}</span> {row.unit ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview.removed.map((region) => (
        <div key={region.viewportId} className="rounded-md border border-amber-200 bg-amber-50 p-2" data-removed-region={region.viewportId}>
          <p className="text-xs font-semibold text-amber-800">
            Region {region.label} is being withdrawn
            {region.measurements.length > 0 ? ` — ${region.measurements.length} measurement${region.measurements.length === 1 ? "" : "s"} were taken in it` : ""}
          </p>
          {region.measurements.length > 0 ? (
            <ul className="mt-1 list-inside list-disc text-xs text-amber-700">
              {region.measurements.map((m) => (
                <li key={m.geometryId}>{m.description}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
      {preview.rescaled.length === 0 && preview.removed.length === 0 && preview.unresolvedRowIds.length === 0 ? (
        <p className="text-xs text-gray-500">No measured line is affected by this region change.</p>
      ) : null}
      {preview.unresolvedRowIds.length > 0 ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-2" data-unresolved-block>
          <p className="text-xs font-semibold text-red-800">
            {preview.unresolvedRowIds.length} line{preview.unresolvedRowIds.length === 1 ? "" : "s"} record no measurement basis — the region change cannot proceed until each is confirmed. No override exists.
          </p>
          <ul className="mt-1 space-y-0.5">
            {preview.unresolvedRowIds.map((rowId) => (
              <li key={rowId}>
                <button type="button" className="text-xs text-red-900 underline" onClick={() => onOpenRow(rowId)}>
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
        {preview.unresolvedRowIds.length > 0 ? (
          <Button size="sm" disabled title="Confirm every unresolved line first — withdrawal confirmation does not override a missing basis">
            Blocked
          </Button>
        ) : preview.removed.length > 0 ? (
          <Button size="sm" variant="danger" loading={applying} onClick={() => onApply(true)}>
            Withdraw region anyway
          </Button>
        ) : (
          <Button size="sm" loading={applying} onClick={() => onApply(false)}>
            Apply regions
          </Button>
        )}
      </div>
    </div>
  );
}
ViewportImpactPanel.displayName = "ViewportImpactPanel";
