import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { ExtractionSummary } from "@/components/molecules/precon-session/extraction-report";
import type { PreconSheet, PreconSheetKind } from "@/api/precon";
import { useRemeasurePreconSheet, useUpdatePreconSheet } from "@/hooks/use-precon";
import { getApiErrorMessage } from "@/lib/api-error";
import { SHEET_KIND_OPTIONS, mmPerPtForRatio, scaleRatioOf } from "@/lib/precon-meta";
import { toast } from "@/lib/toast";
import { LayerMapTable } from "./layer-map-table";

interface Props {
  sessionId: string;
  sheet: PreconSheet;
  onDrawScale: () => void;
  onClose: () => void;
}

const FIELD = "mt-0.5 h-8 w-full rounded-lg border-0 bg-[#F6F6F6] px-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-100";
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

  const save = () => {
    const parsed = ratio.trim() === "" ? null : Number(ratio);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
      toast("Scale must be a positive ratio, e.g. 100 for 1:100.", "error");
      return;
    }
    update.mutate(
      {
        sheetId: sheet.id,
        input: {
          kind,
          title: title.trim() === "" ? null : title.trim(),
          scaleMmPerPt: parsed === null ? null : mmPerPtForRatio(parsed),
          dimUnit,
        },
      },
      {
        onSuccess: () => toast("Sheet updated. Re-measure to redraw its lines.", "success"),
        onError: (e) => toast(getApiErrorMessage(e, "Could not update the sheet."), "error"),
      },
    );
  };

  return (
    <div
      className="absolute right-3 top-3 z-20 w-72 space-y-3 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-900">{sheet.code ?? `Page ${sheet.pageNumber}`}</p>
          <p className="text-[11px] text-gray-500">
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

      <div className="flex gap-2 border-t border-gray-100 pt-3">
        <Button size="sm" loading={update.isPending} onClick={save}>
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
