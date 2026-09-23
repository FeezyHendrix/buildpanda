import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { ExtractionSummary } from "@/components/molecules/precon-session/extraction-report";
import type { PreconSheet, PreconSheetKind } from "@/api/precon";
import { useRemeasurePreconSheet, useUpdatePreconSheet } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { SHEET_KIND_OPTIONS, scaleRatioOf } from "@/lib/precon-meta";
import { useRatioScale } from "@/components/molecules/precon-sheet-viewer/use-ratio-scale";
import { toast } from "@/lib/toast";
import { LayerMapTable } from "./layer-map-table";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

interface Props {
  sessionId: string;
  sheet: PreconSheet;
  onDrawScale: () => void;
  onClose: () => void;
}

const FIELD = cn(INPUT_SM_CLASS, "mt-0.5");
const DIM_UNITS = ["mm", "cm", "m"] as const;

/**
 * What the engine read off a sheet, editable. A typed or drawn scale is
 * authoritative; changing type or scale offers a re-measure of just this sheet.
 */
export function SheetSettings({ sessionId, sheet, onDrawScale, onClose }: Props) {
  const update = useUpdatePreconSheet(sessionId);
  const remeasure = useRemeasurePreconSheet(sessionId);
  const [kind, setKind] = useState<PreconSheetKind>(sheet.kind);
  const [title, setTitle] = useState(sheet.title ?? "");
  const [ratio, setRatio] = useState(sheet.scaleMmPerPt ? String(scaleRatioOf(sheet.scaleMmPerPt)) : "");
  const [dimUnit, setDimUnit] = useState<(typeof DIM_UNITS)[number]>(sheet.dimUnit ?? "mm");
  const isPdf = /\.pdf$/i.test(sheet.fileName);
  const scale = useRatioScale(sessionId, sheet);
  const currentRatio = sheet.scaleMmPerPt ? String(scaleRatioOf(sheet.scaleMmPerPt)) : "";
  const ratioChanged = ratio.trim() !== currentRatio;

  const save = () => {
    // Non-dimensional fields keep the plain PATCH; the SCALE only ever moves
    // through preview -> token-pinned apply (contract 12) — no direct write.
    update.mutate(
      { sheetId: sheet.id, input: { kind, title: title.trim() === "" ? null : title.trim(), dimUnit } },
      {
        onSuccess: () => toast("Sheet updated.", "success"),
        onError: (e) => toast(getApiErrorMessage(e, "Could not update the sheet."), "error"),
      },
    );
    if (ratioChanged) {
      const parsed = Number(ratio);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast("Scale must be a positive ratio, e.g. 100 for 1:100.", "error");
        return;
      }
      void scale.runPreview(parsed);
    }
  };

  return (
    <div
      className="absolute right-3 top-3 z-20 w-72 space-y-3 rounded-lg border border-line bg-white p-3 shadow-lg"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-900">{sheet.code ?? `Page ${sheet.pageNumber}`}</p>
          <p className="text-xs text-gray-500">
            {sheet.scaleConfidence === 1 ? "Scale set by reviewer" : sheet.scaleMmPerPt ? `Engine read 1:${scaleRatioOf(sheet.scaleMmPerPt)} at ${Math.round((sheet.scaleConfidence ?? 0) * 100)}%` : "No scale detected"}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-700">
          Close
        </button>
      </div>

      {sheet.geoSummary ? <ExtractionSummary summary={sheet.geoSummary} /> : null}

      <label className="block text-xs text-gray-500">
        Sheet type
        <select className={FIELD} value={kind} onChange={(e) => setKind(e.target.value as PreconSheetKind)}>
          {SHEET_KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-gray-500">
        Title
        <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={sheet.fileName} />
      </label>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="block text-xs text-gray-500">
          Scale 1 :
          <input className={FIELD} inputMode="numeric" value={ratio} onChange={(e) => setRatio(e.target.value)} placeholder="100" />
        </label>
        <label className="block text-xs text-gray-500">
          Dims in
          <select className={FIELD} value={dimUnit} onChange={(e) => setDimUnit(e.target.value as (typeof DIM_UNITS)[number])}>
            {DIM_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" onClick={onDrawScale} className="text-xs font-medium text-primary-600 hover:underline">
        Or draw a known dimension on the sheet
      </button>

      {scale.preview ? (
        <div className="rounded-md border border-primary-100 bg-primary-50 p-2" data-settings-scale-preview>
          <p className="text-xs font-semibold text-primary-800">
            1:{scaleRatioOf(scale.preview.newScaleMmPerPt)} would restate {scale.preview.affectedRows.length} line{scale.preview.affectedRows.length === 1 ? "" : "s"}
            {scale.preview.unresolvedRowIds.length > 0 ? ` — blocked by ${scale.preview.unresolvedRowIds.length} unconfirmed legacy line(s)` : ""}.
          </p>
          <div className="mt-1.5 flex gap-2">
            <Button size="sm" loading={scale.applying} disabled={scale.preview.blocked} onClick={() => scale.apply(() => toast("Scale applied; every affected line was restated.", "success"))}>
              Apply previewed scale
            </Button>
            <Button size="sm" variant="secondary" onClick={scale.clear}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {scale.error ? <p className="text-xs text-red-600" data-settings-scale-error>{scale.error}</p> : null}

      <div className="flex gap-2 border-t border-line-hair pt-3">
        <Button size="sm" loading={update.isPending || scale.previewing} onClick={save}>
          Save
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={remeasure.isPending}
          disabled={!isPdf}
          title={isPdf ? "Re-read this sheet with the saved type and scale" : "Only PDF sheets can be re-measured"}
          onClick={() =>
            remeasure.mutate(sheet.id, {
              onSuccess: () => toast("Re-measuring this sheet. Its unverified lines will be replaced.", "info"),
              onError: (e) => toast(getApiErrorMessage(e, "Could not re-measure the sheet."), "error"),
            })
          }
        >
          Re-measure
        </Button>
      </div>
      {isPdf ? null : <LayerMapTable sessionId={sessionId} />}
    </div>
  );
}
SheetSettings.displayName = "SheetSettings";
